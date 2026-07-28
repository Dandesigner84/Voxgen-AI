import { GoogleGenAI, Modality } from "@google/genai";
import { UserRole } from "../types";
import { generateSpeech } from "./geminiService";
import { decodeAudioData, mixAudioBuffers } from "../utils/audioUtils";

export interface BoletimConfig {
  enabled: boolean;
  niche: string;
  customNiche?: string;
  city: string;
  state: string;
  country: string;
  intervalMinutes: number;
  newsCount: number;
  maxDuration: string;
  voice: string;
  style: string;
  language: string;
  temperature: number;
  bgMusicSource: 'none' | 'preset' | 'upload' | 'youtube';
  selectedBgPresetId?: string;
  uploadedBgAudioBase64?: string;
  uploadedBgName?: string;
  youtubeUrl?: string;
  youtubeTitle?: string;
  youtubeThumbnail?: string;
  youtubeStartTime?: number;
  youtubeEndTime?: number;
  musicVolume: number; // 0.0 to 1.0
  duckingIntensity: number; // 0.0 to 1.0
}

export interface BoletimHistoryItem {
  id: string;
  createdAt: string; // ISO date
  niche: string;
  location: string;
  sources: string[];
  scriptText: string;
  voice: string;
  duration: number;
  generationStatus: 'success' | 'failed';
  playbackStatus: 'queued' | 'played';
  audioData?: AudioBuffer;
  audioBase64?: string;
}

export interface YouTubeMetadata {
  title: string;
  thumbnailUrl: string;
  author: string;
  url: string;
}

const STORAGE_KEYS = {
  CONFIG: 'voxgen_boletim_config_v1',
  HISTORY: 'voxgen_boletim_history_v1',
  USAGE: 'voxgen_boletim_daily_usage_v1',
};

export const DEFAULT_BOLETIM_CONFIG: BoletimConfig = {
  enabled: false,
  niche: 'Tecnologia',
  customNiche: '',
  city: 'São Paulo',
  state: 'SP',
  country: 'Brasil',
  intervalMinutes: 30,
  newsCount: 3,
  maxDuration: '60s',
  voice: 'Kore',
  style: 'Informativo Rádio',
  language: 'Português (BR)',
  temperature: 0.7,
  bgMusicSource: 'preset',
  selectedBgPresetId: 'news_24h',
  musicVolume: 0.25,
  duckingIntensity: 0.15,
};

export const BOLETIM_PRESETS = [
  { id: 'news_24h', name: 'Vinheta Notícias 24h', style: 'jornalismo' },
  { id: 'radio_urgente', name: 'Rádio Jornalismo Urgente', style: 'urgente' },
  { id: 'soft_news', name: 'Soft News Background', style: 'suave' },
  { id: 'synth_beat', name: 'Synth Pop Radio Beat', style: 'moderno' },
  { id: 'carro_som', name: 'Carro de Som Anúncio', style: 'promocional' },
];

/**
 * Retorna o limite de boletins diários de acordo com a função/plano do usuário
 */
export function getPlanMaxBoletims(userRole?: UserRole): number {
  if (userRole === 'admin' || userRole === 'corporate-admin') return 999;
  if (userRole === 'corporate-user') return 15;
  return 4; // Plano padrão / Grátis
}

/**
 * Obtém o uso diário atual de boletins
 */
export function getDailyBoletimUsage(userRole?: UserRole): { dateStr: string; count: number; maxLimit: number } {
  const maxLimit = getPlanMaxBoletims(userRole);
  const today = new Date().toISOString().split('T')[0];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USAGE);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.dateStr === today) {
        return { dateStr: today, count: parsed.count || 0, maxLimit };
      }
    }
  } catch (e) {}
  return { dateStr: today, count: 0, maxLimit };
}

/**
 * Incrementa o contador de boletins do dia
 */
export function incrementDailyBoletimUsage(userRole?: UserRole): { allowed: boolean; newCount: number; maxLimit: number } {
  const usage = getDailyBoletimUsage(userRole);
  if (usage.count >= usage.maxLimit) {
    return { allowed: false, newCount: usage.count, maxLimit: usage.maxLimit };
  }
  const newCount = usage.count + 1;
  try {
    localStorage.setItem(STORAGE_KEYS.USAGE, JSON.stringify({
      dateStr: usage.dateStr,
      count: newCount
    }));
  } catch (e) {}
  return { allowed: true, newCount, maxLimit: usage.maxLimit };
}

/**
 * Salva a configuração no localStorage
 */
export function saveBoletimConfig(config: BoletimConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (e) {}
}

/**
 * Carrega a configuração do localStorage
 */
export function loadBoletimConfig(): BoletimConfig {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (data) {
      return { ...DEFAULT_BOLETIM_CONFIG, ...JSON.parse(data) };
    }
  } catch (e) {}
  return DEFAULT_BOLETIM_CONFIG;
}

/**
 * Salva um novo boletim no histórico local
 */
export function saveBoletimHistoryItem(item: BoletimHistoryItem): void {
  try {
    const history = getBoletimHistory();
    // Guarda os últimos 30 itens sem o buffer pesado para não estourar o localStorage
    const itemToStore = {
      ...item,
      audioData: undefined // Não guarda o buffer bruto no json
    };
    const updated = [itemToStore, ...history.slice(0, 29)];
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Retorna o histórico de boletins
 */
export function getBoletimHistory(): BoletimHistoryItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {}
  return [];
}

/**
 * Extrai o ID do vídeo do YouTube a partir de qualquer formato de URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.trim().match(regExp);
  return (match && match[1] && match[1].length === 11) ? match[1] : null;
}

/**
 * Busca metadados de vídeo do YouTube via noembed/oembed com limpeza de URL e fallback resiliente
 */
export async function fetchYouTubeMetadata(youtubeUrl: string): Promise<YouTubeMetadata> {
  if (!youtubeUrl.trim()) throw new Error("Link do YouTube inválido.");

  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("Não foi possível identificar o ID do vídeo do YouTube. Verifique o link e tente novamente.");
  }

  // URL limpa sem parâmetros de playlist (&list=...) que podem travar o oEmbed
  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const defaultThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (!data.error && data.title) {
        return {
          title: data.title,
          thumbnailUrl: data.thumbnail_url || defaultThumbnail,
          author: data.author_name || "Canal YouTube",
          url: cleanUrl
        };
      }
    }
  } catch (e) {
    console.warn("[YouTube Metadata] Falha no noembed:", e);
  }

  try {
    const ytOembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
    const res = await fetch(ytOembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.title) {
        return {
          title: data.title,
          thumbnailUrl: data.thumbnail_url || defaultThumbnail,
          author: data.author_name || "Canal YouTube",
          url: cleanUrl
        };
      }
    }
  } catch (e) {
    console.warn("[YouTube Metadata] Falha no youtube oembed:", e);
  }

  // Fallback de alta confiabilidade
  return {
    title: `Trilha YouTube (${videoId})`,
    thumbnailUrl: defaultThumbnail,
    author: "YouTube",
    url: cleanUrl
  };
}

/**
 * Garante o cliente do Gemini
 */
function getGeminiClient() {
  const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  const cleanKey = rawKey.replace(/["'\s]/g, "");
  return new GoogleGenAI({ apiKey: cleanKey });
}

/**
 * Pesquisa notícias recentes via Gemini Search Grounding e elabora o roteiro em linguagem de rádio
 */
export async function searchNewsAndGenerateScript(config: BoletimConfig): Promise<{ script: string; sources: string[]; headlines: string[] }> {
  const ai = getGeminiClient();
  const effectiveNiche = config.niche === 'Personalizado' ? (config.customNiche || 'Notícias Gerais') : config.niche;
  const locationStr = [config.city, config.state, config.country].filter(Boolean).join(', ');

  const prompt = `
    Você é o editor-chefe e locutor sênior da rádio "VoxGen Notícias".
    Sua missão é criar um boletim de notícias atualizado em áudio/rádio sobre o nicho: "${effectiveNiche}".
    
    LOCALIZAÇÃO PRIORITÁRIA: "${locationStr}".
    IDIOMA OBRIGATÓRIO: "${config.language}".
    QUANTIDADE DE NOTÍCIAS: Exatamente ${config.newsCount} notícias principais.
    DURAÇÃO MÁXIMA ESTIMADA: ${config.maxDuration}.
    ESTILO DA LOCUÇÃO: "${config.style}".

    Sua resposta DEVE usar notícias reais e recentes. Utilize o recurso de busca para encontrar fatos dos últimos dias.

    REGRAS DE OURO PARA ROTEIRO DE RÁDIO:
    1. ABERTURA AUTOMÁTICA IMPACTANTE:
       Inicie com uma vinheta falada marcante, ex: "Atenção ouvintes! Este é o seu Boletim Informativo VoxGen, trazendo as principais notícias de ${effectiveNiche} para ${config.city || 'sua região'}."
    2. CONTEÚDO DAS NOTÍCIAS:
       - Resuma as notícias mais relevantes e recentes dos últimos dias.
       - Elimine duplicidades ou fatos antigos.
       - Use linguagem dinâmica, direta, natural de locução de rádio (frases curtas, conectores fluidos).
       - Evite repetições de nomes ou termos.
    3. ENCERRAMENTO AUTOMÁTICO PROFISSIONAL:
       Termine com uma chamada clássica de rádio, ex: "Estas foram as notícias de agora no seu Boletim VoxGen. Continue conosco para mais atualizações ao longo da programação. Uma ótima hora para você!"
    4. EFEITOS SONOROS (OPCIONAL):
       Pode usar até 2 tags discretas como (sino) ou (caixa) entre frases se combinar com o tom.

    FORMATO DA RESPOSTA:
    Retorne a resposta estritamente em formato JSON com as chaves:
    {
      "headlines": ["Título resumo notícia 1", "Título resumo notícia 2"],
      "sources": ["Nome da Fonte / Portal 1", "Nome da Fonte / Portal 2"],
      "script": "Texto completo do roteiro pronto para ser lido pelo TTS"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: config.temperature,
      }
    });

    const text = response.text || "";
    // Tenta extrair JSON do resultado
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        script: parsed.script || text,
        sources: Array.isArray(parsed.sources) ? parsed.sources : ["Busca Web VoxGen"],
        headlines: Array.isArray(parsed.headlines) ? parsed.headlines : [effectiveNiche]
      };
    }

    return {
      script: text.replace(/```json|```/g, "").trim(),
      sources: ["Fontes de Notícias Confiáveis"],
      headlines: [`Boletim de ${effectiveNiche}`]
    };
  } catch (e: any) {
    console.error("[Boletim IA] Erro ao pesquisar notícias:", e);
    // Fallback de roteiro emergencial em caso de indisponibilidade da busca
    const fallbackScript = `Atenção ouvintes! Este é o seu Boletim Informativo VoxGen. Trazendo as últimas atualizações de ${effectiveNiche} para ${config.city || 'a sua região'}. O mercado e as principais movimentações seguem em destaque no dia de hoje. Acompanhe a nossa programação para mais detalhes atualizados a qualquer momento. VoxGen Notícias, a informação em primeiro lugar!`;
    return {
      script: fallbackScript,
      sources: ["Agência VoxGen"],
      headlines: [`Atualização de ${effectiveNiche}`]
    };
  }
}

/**
 * Gera um fundo musical de amostra ou simula um tom instrumental para o boletim
 */
async function generateProceduralBgMusicBuffer(ctx: AudioContext, durationSeconds: number, style: string): Promise<AudioBuffer> {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.ceil(sampleRate * durationSeconds);
  const buffer = ctx.createBuffer(2, frameCount, sampleRate);
  
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Gera uma onda senoidal suave com pulsações rítmicas de fundo
  const baseFreq = style === 'urgente' ? 110 : style === 'jornalismo' ? 130 : 98;
  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    // Acorde suave com pad sintético
    const pad = (Math.sin(2 * Math.PI * baseFreq * t) + Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.5) * 0.1;
    // Pulso rítmico leve a cada segundo
    const pulse = Math.exp(-10 * (t % 1.0)) * 0.05;
    
    left[i] = pad + pulse;
    right[i] = pad + pulse;
  }

  return buffer;
}

/**
 * Executa o fluxo completo do Boletim Inteligente IA
 */
export async function executeBoletimGeneration(
  config: BoletimConfig,
  audioCtx: AudioContext,
  userRole?: UserRole
): Promise<BoletimHistoryItem> {
  // 1. Verificar limite diário
  const limitCheck = incrementDailyBoletimUsage(userRole);
  if (!limitCheck.allowed) {
    throw new Error(
      `Você atingiu o limite diário de ${limitCheck.maxLimit} boletins automáticos. O limite será renovado automaticamente no próximo dia ou poderá ser ampliado conforme seu plano.`
    );
  }

  try {
    // 2. Pesquisar notícias e gerar roteiro
    console.log("[Boletim IA] Pesquisando notícias e estruturando roteiro...");
    const { script, sources, headlines } = await searchNewsAndGenerateScript(config);

    // 3. Gerar locução da narração
    console.log("[Boletim IA] Gerando locução da narração com a voz:", config.voice);
    const speechBase64 = await generateSpeech(script, config.voice);
    const voiceBuffer = await decodeAudioData(speechBase64, audioCtx);

    // 4. Misturar fundo musical se ativado
    let finalBuffer = voiceBuffer;
    if (config.bgMusicSource !== 'none') {
      console.log("[Boletim IA] Aplicando fundo musical e ducking...");
      let bgBuffer: AudioBuffer;

      if (config.bgMusicSource === 'upload' && config.uploadedBgAudioBase64) {
        bgBuffer = await decodeAudioData(config.uploadedBgAudioBase64, audioCtx);
      } else {
        // Usa o preset ou procedural
        bgBuffer = await generateProceduralBgMusicBuffer(
          audioCtx, 
          voiceBuffer.duration + 2.0, 
          config.selectedBgPresetId || 'news_24h'
        );
      }

      finalBuffer = await mixAudioBuffers(
        voiceBuffer, 
        bgBuffer, 
        audioCtx, 
        config.style, 
        config.duckingIntensity
      );
    }

    const duration = Math.round(finalBuffer.duration);
    const location = [config.city, config.state].filter(Boolean).join(' - ') || 'Nacional';

    const historyItem: BoletimHistoryItem = {
      id: `boletim_${Date.now()}`,
      createdAt: new Date().toISOString(),
      niche: config.niche === 'Personalizado' ? (config.customNiche || 'Geral') : config.niche,
      location,
      sources,
      scriptText: script,
      voice: config.voice,
      duration,
      generationStatus: 'success',
      playbackStatus: 'queued',
      audioData: finalBuffer
    };

    // Salva no histórico
    saveBoletimHistoryItem(historyItem);

    // Dispara evento global para o Smart Play receber automaticamente na fila "📰 Boletins IA"
    window.dispatchEvent(new CustomEvent('voxgen-boletim-created', { detail: historyItem }));

    return historyItem;
  } catch (error: any) {
    console.error("[Boletim IA] Erro na geração do boletim:", error);
    
    const failedItem: BoletimHistoryItem = {
      id: `boletim_failed_${Date.now()}`,
      createdAt: new Date().toISOString(),
      niche: config.niche,
      location: [config.city, config.state].filter(Boolean).join(' - ') || 'Nacional',
      sources: [],
      scriptText: 'Erro ao gerar o boletim. Verifique sua conexão e tente novamente.',
      voice: config.voice,
      duration: 0,
      generationStatus: 'failed',
      playbackStatus: 'queued'
    };
    saveBoletimHistoryItem(failedItem);
    throw error;
  }
}
