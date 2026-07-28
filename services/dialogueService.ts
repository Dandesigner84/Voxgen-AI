import { GoogleGenAI, Type } from "@google/genai";
import { generateSpeech } from "./geminiService";
import { decodeAudioData, concatenateAudioBuffers, audioBufferToWav } from "../utils/audioUtils";

export interface SpeakerConfig {
  id: 'speakerA' | 'speakerB';
  roleLabel: string; // e.g. "Atendente" or "Locutor 1"
  voice: string;     // e.g. "Kore" or "Puck"
}

export interface DialogueLine {
  id: string;
  speakerId: 'speakerA' | 'speakerB';
  text: string;
}

export interface DialoguePreset {
  id: string;
  title: string;
  description: string;
  category: string;
  speakerA: { roleLabel: string; voice: string };
  speakerB: { roleLabel: string; voice: string };
  lines: { speakerId: 'speakerA' | 'speakerB'; text: string }[];
}

export const DIALOGUE_PRESETS: DialoguePreset[] = [
  {
    id: 'vendas_desconto',
    title: 'Negociação de Vendas & Desconto',
    description: 'Atendente atencioso oferecendo oferta imperdível para cliente indeciso.',
    category: 'Comercial',
    speakerA: { roleLabel: 'Vendedor', voice: 'Kore' },
    speakerB: { roleLabel: 'Cliente', voice: 'Zephyr' },
    lines: [
      { speakerId: 'speakerA', text: 'Olá! Seja muito bem-vindo à nossa loja! Procura algo em especial hoje?' },
      { speakerId: 'speakerB', text: 'Oi! Eu estava olhando essa TV aqui, mas achei o preço um pouco puxado...' },
      { speakerId: 'speakerA', text: 'Entendo perfeitamente! Mas olha só (caixa): se você levar hoje, eu consigo liberá-la com 25% de desconto e frete grátis!' },
      { speakerId: 'speakerB', text: 'Sério? Com frete grátis e esse desconto, fica irrecusável! Vou levar agora mesmo!' },
      { speakerId: 'speakerA', text: 'Excelente escolha! Vamos ao caixa finalizar sua compra (aplausos).' }
    ]
  },
  {
    id: 'radio_dupla',
    title: 'Programa de Rádio Matinal em Dupla',
    description: 'Dois locutores interagindo com dinamismo e humor nas notícias da manhã.',
    category: 'Rádio',
    speakerA: { roleLabel: 'Locutor Leo', voice: 'Puck' },
    speakerB: { roleLabel: 'Locutora Ana', voice: 'Kore-Radio' },
    lines: [
      { speakerId: 'speakerA', text: 'Bom dia, ouvinte VoxGen! Sextou com força total e muita energia positiva no ar!' },
      { speakerId: 'speakerB', text: 'Com certeza, Leo! E já começamos o dia com notícias quentinhas do trânsito e do clima pra você não passar perrengue.' },
      { speakerId: 'speakerA', text: 'Exatamente! Solzão brilhando e trânsito fluindo super bem nas principais avenidas da cidade (buzina).' },
      { speakerId: 'speakerB', text: 'Aumente o som, porque agora vem aquele hit que você ama! Fique ligado na VoxGen!' }
    ]
  },
  {
    id: 'podcast_entrevista',
    title: 'Entrevista de Podcast & Dicas',
    description: 'Apresentador entrevistando especialista sobre inteligência artificial e negócios.',
    category: 'Podcast',
    speakerA: { roleLabel: 'Host Marcos', voice: 'Charon' },
    speakerB: { roleLabel: 'Especialista Bia', voice: 'Zephyr-Story' },
    lines: [
      { speakerId: 'speakerA', text: 'Seja bem-vinda ao nosso podcast, Bia! Como a inteligência artificial está transformando a produção de conteúdo?' },
      { speakerId: 'speakerB', text: 'Obrigada, Marcos! Hoje em dia, a IA permite que pequenos empreendedores criem anúncios profissionais em minutos com custo quase zero.' },
      { speakerId: 'speakerA', text: 'Sensacional! E qual é o primeiro passo para quem quer começar sem complicação?' },
      { speakerId: 'speakerB', text: 'O segredo é começar com ferramentas acessíveis como a VoxGen para criar narrações e boletins automáticos.' }
    ]
  },
  {
    id: 'carro_som_dupla',
    title: 'Anúncio de Rua em Dupla (Gritado)',
    description: 'Dois anunciantes de rua disputando a atenção dos clientes com muita animação.',
    category: 'Carro de Som',
    speakerA: { roleLabel: 'Anunciante 1', voice: 'Fenrir-Promo' },
    speakerB: { roleLabel: 'Anunciante 2', voice: 'Zephyr' },
    lines: [
      { speakerId: 'speakerA', text: 'Atenção, dona de casa! Atenção freguesia! É hoje a grande queima de estoque (buzina)!' },
      { speakerId: 'speakerB', text: 'É preço de fábrica pra zerar tudo! Frango fresco, frutas selecionadas e muito mais!' },
      { speakerId: 'speakerA', text: 'Não compre em outro lugar sem antes conferir nossos preços imbatíveis! Vem pra cá (caixa)!' }
    ]
  }
];

function getGeminiClient() {
  const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  const cleanKey = rawKey.replace(/["'\s]/g, "");
  return new GoogleGenAI({ apiKey: cleanKey });
}

/**
 * Gera um roteiro de diálogo com IA baseado na situação/tema
 */
export async function generateDialogueScriptWithAI(
  situationPrompt: string,
  speakerA: SpeakerConfig,
  speakerB: SpeakerConfig,
  numTurns: number = 4
): Promise<DialogueLine[]> {
  const ai = getGeminiClient();

  const systemInstruction = `
    Você é um roteirista sênior especialista em áudio, comerciais de rádio, podcasts e diálogos publicitários em Português do Brasil.
    Sua missão é criar um diálogo natural, envolvente e dinâmico entre duas pessoas para síntese de voz.

    PERSONAGENS:
    - Personagem A: "${speakerA.roleLabel}"
    - Personagem B: "${speakerB.roleLabel}"

    DIRETRIZES:
    1. Crie exatamente entre ${numTurns} e ${numTurns * 2} falas alternadas.
    2. O diálogo deve ser fluido, realista, com bom ritmo e linguagem natural de conversação falada.
    3. PODE incluir até 3 tags de efeitos sonoros entre parênteses para aumentar o realismo (ex: (buzina), (risada), (aplausos), (caixa), (sino)).
    4. Mantenha as frases curtas e diretas para gravação perfeita em síntese de voz.

    Sua resposta DEVE ser estritamente um JSON no formato:
    {
      "lines": [
        { "speakerId": "speakerA", "text": "Texto falado pelo Personagem A" },
        { "speakerId": "speakerB", "text": "Texto falado pelo Personagem B" }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Situação do Diálogo: "${situationPrompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speakerId: { type: Type.STRING, enum: ["speakerA", "speakerB"] },
                  text: { type: Type.STRING }
                },
                required: ["speakerId", "text"]
              }
            }
          },
          required: ["lines"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    if (parsed.lines && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
      return parsed.lines.map((l: any, idx: number) => ({
        id: `line_${Date.now()}_${idx}`,
        speakerId: l.speakerId === 'speakerB' ? 'speakerB' : 'speakerA',
        text: l.text || ''
      }));
    }
  } catch (error) {
    console.error("[Dialogue Service] Erro ao gerar roteiro com IA:", error);
  }

  // Fallback caso a IA falhe
  return [
    { id: `line_1`, speakerId: 'speakerA', text: `Olá! Como podemos te ajudar hoje?` },
    { id: `line_2`, speakerId: 'speakerB', text: `Oi! Gostaria de saber mais sobre as opções disponíveis.` },
    { id: `line_3`, speakerId: 'speakerA', text: `Perfeito! Temos ofertas especiais com entrega rápida pra você (caixa)!` }
  ];
}

/**
 * Cria um buffer de silêncio para criar uma pausa natural entre falas
 */
function createSilenceBuffer(durationSeconds: number, audioContext: AudioContext): AudioBuffer {
  const sampleRate = audioContext.sampleRate || 24000;
  const frameCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
  return audioContext.createBuffer(1, frameCount, sampleRate);
}

/**
 * Sintetiza linha por linha e junta tudo em um único AudioBuffer e Base64 WAV
 */
export async function generateDialogueAudio(
  lines: DialogueLine[],
  speakerA: SpeakerConfig,
  speakerB: SpeakerConfig,
  audioContext: AudioContext,
  pauseDurationSeconds: number = 0.35,
  onProgress?: (current: number, total: number) => void
): Promise<{ audioBuffer: AudioBuffer; audioBase64: string; duration: number; textSummary: string }> {
  if (!lines || lines.length === 0) {
    throw new Error("Nenhuma linha de diálogo para sintetizar.");
  }

  const audioBuffers: AudioBuffer[] = [];
  const pauseBuffer = createSilenceBuffer(pauseDurationSeconds, audioContext);
  const textSummaryParts: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.text.trim()) continue;

    if (onProgress) onProgress(i + 1, lines.length);

    const voice = line.speakerId === 'speakerB' ? speakerB.voice : speakerA.voice;
    const speakerLabel = line.speakerId === 'speakerB' ? speakerB.roleLabel : speakerA.roleLabel;

    textSummaryParts.push(`[${speakerLabel}]: ${line.text}`);

    console.log(`[Dialogue] Gerando fala ${i + 1}/${lines.length} com voz ${voice}...`);
    const lineBase64 = await generateSpeech(line.text, voice);
    if (lineBase64) {
      const lineBuffer = await decodeAudioData(lineBase64, audioContext);
      audioBuffers.push(lineBuffer);
      // Adiciona pausa entre falas (exceto na última)
      if (i < lines.length - 1) {
        audioBuffers.push(pauseBuffer);
      }
    }
  }

  if (audioBuffers.length === 0) {
    throw new Error("Não foi possível gerar os áudios das falas.");
  }

  // Concatena todos os buffers em um único áudio completo
  const finalBuffer = concatenateAudioBuffers(audioBuffers, audioContext);
  const wavBlob = audioBufferToWav(finalBuffer);

  const audioBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res.split(',')[1] || res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(wavBlob);
  });

  return {
    audioBuffer: finalBuffer,
    audioBase64,
    duration: Math.round(finalBuffer.duration),
    textSummary: textSummaryParts.join("\n")
  };
}
