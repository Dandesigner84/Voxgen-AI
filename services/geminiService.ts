import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ToneType, VoiceName } from "../types";

// Initialize API client
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const refineText = async (text: string, tone: ToneType, useBackgroundMusic: boolean): Promise<string> => {
  // Even if tone is neutral, we might need to process instructions if present
  if (tone === ToneType.Neutral && !useBackgroundMusic && !text.match(/[\[<]/)) return text;

  const ai = getClient();
  
  let specificInstruction = "";
  
  if (useBackgroundMusic) {
    specificInstruction += " O usuário solicitou fundo musical. Adapte o ritmo da fala para ser fluido e cadenciado. ";
  }

  if (tone === ToneType.Preaching) {
    specificInstruction += " ESTILO DE PREGAÇÃO CRISTÃ: O texto deve ser reescrito como uma mensagem espiritual poderosa. Use retórica emotiva, repetições para ênfase, pausas dramáticas e pontos de exclamação para momentos de pico. A fala deve soar como um pastor pregando com autoridade e unção. ";
  } else if (tone === ToneType.Sales) {
    specificInstruction += " ESTILO VENDAS/BLACK FRIDAY: Urgente, rápido, persuasivo e altamente energético. Use frases curtas e impacto. ";
  } else if (tone === ToneType.Soothing) {
    specificInstruction += " ESTILO CALMO: Suave, lento, acolhedor e relaxante. ";
  }

  const prompt = `
    Você é um roteirista e diretor de áudio profissional especializado em Português do Brasil.
    Sua tarefa é reescrever o texto do usuário para corresponder ao tom: "${tone}".
    
    Configuração:
    - Tom: ${tone}
    - Instruções Extras: ${specificInstruction}
    
    REGRAS CRÍTICAS PARA COMANDOS E EFEITOS SONOROS:
    O sistema de voz não entende comandos como [pausa] ou [risada] diretamente. Você deve CONVERTER esses comandos em PONTUAÇÃO e PALAVRAS para simular o efeito na fala.
    
    1. **[pausa] / <pausa>**: Substitua por reticências "..." ou quebras de linha para forçar o tempo. Ex: "Olá [pausa] amigos" -> "Olá... amigos."
    2. **[risada] / [rir]**: Substitua por onomatopeias naturais. Ex: "Isso é engraçado [risada]" -> "Isso é engraçado, ha ha ha!"
    3. **[sussurro]**: Não há comando direto, então use reticências e palavras suaves.
    4. **[grito] / [alto]**: Use CAIXA ALTA e pontos de exclamação!!!
    5. **[rápido]**: Remova vírgulas e junte frases.
    
    RESPEITE TODOS OS COMANDOS ENTRE [] ou <>. O usuário confia que você vai interpretar a intenção dele e transformar no melhor texto falado possível.
    
    REGRAS GERAIS:
    - Sem Recusas: Gere o roteiro final imediatamente.
    - Idioma: Português do Brasil.
    - Retorne APENAS o texto refinado.

    Texto de Entrada: "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text?.trim() || text;
  } catch (e) {
    console.error("Refine text failed", e);
    return text;
  }
};

export const generateSpeech = async (text: string, voice: VoiceName): Promise<string> => {
  const ai = getClient();
  
  // Using the specific TTS model and configuration from the system instructions
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO], 
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  // Extract the base64 audio data
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!base64Audio) {
    throw new Error("Não foi possível receber dados de áudio da API. O modelo pode ter recusado a solicitação ou encontrado um erro.");
  }

  return base64Audio;
};

// --- Music Mode Services ---

export interface SongMetadata {
  title: string;
  lyrics: string;
  styleTag: string; // Simplified style for internal logic (rock, electronic, lofi)
  coverColor: string;
}

export const generateSongMetadata = async (description: string): Promise<SongMetadata> => {
  const ai = getClient();
  
  const prompt = `
    Você é um compositor e produtor musical criativo. O usuário quer uma música sobre: "${description}".
    
    Gere:
    1. Um Título criativo.
    2. Uma letra curta (Refrão + 1 Estrofe).
    3. Uma tag de estilo musical (Escolha UM: 'Rock', 'Electronic', 'Lo-Fi', 'Ambient').
    4. Uma cor Hexadecimal para a capa.

    Responda estritamente em JSON com este esquema:
    {
      "title": "...",
      "lyrics": "...",
      "styleTag": "...",
      "coverColor": "#..."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            lyrics: { type: Type.STRING },
            styleTag: { type: Type.STRING },
            coverColor: { type: Type.STRING }
          }
        }
      }
    });
    
    const text = response.text || "{}";
    return JSON.parse(text) as SongMetadata;
  } catch (e) {
    console.error(e);
    // Fallback
    return {
      title: "Música Sem Título",
      lyrics: "Erro ao gerar letra.",
      styleTag: "Ambient",
      coverColor: "#555555"
    };
  }
};

// --- Avatar Mode Services ---

export interface AvatarBehavior {
  energy: number;      // 0.1 to 3.0 (Speed of idle movement)
  range: number;       // 0.1 to 2.0 (Amplitude of movement)
  rotationSpeed: number; // 0.1 to 2.0 (How fast it tilts)
  responsiveness: number; // 0.5 to 3.0 (How much audio affects it)
}

export const generateAvatarBehavior = async (description: string): Promise<AvatarBehavior> => {
  const ai = getClient();

  const prompt = `
    Você é um diretor de animação. O usuário descreve como um personagem deve se comportar: "${description}".
    
    Traduza isso para parâmetros físicos de animação:
    - energy: Velocidade do movimento ocioso (respiração/balanço). Alto = Agitado.
    - range: Amplitude do movimento (o quanto ele se move na tela).
    - rotationSpeed: Velocidade de inclinação da cabeça.
    - responsiveness: O quanto ele reage ao áudio (pulos/impacto). 

    Responda estritamente em JSON.
    Exemplo: "Calmo" -> {"energy": 0.5, "range": 0.3, "rotationSpeed": 0.2, "responsiveness": 0.8}
    Exemplo: "Dançando frenético" -> {"energy": 2.5, "range": 1.5, "rotationSpeed": 1.8, "responsiveness": 2.5}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
           type: Type.OBJECT,
           properties: {
             energy: { type: Type.NUMBER },
             range: { type: Type.NUMBER },
             rotationSpeed: { type: Type.NUMBER },
             responsiveness: { type: Type.NUMBER }
           }
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text) as AvatarBehavior;
  } catch (e) {
    // Default behavior (Balanced)
    return {
      energy: 1.0,
      range: 0.5,
      rotationSpeed: 0.5,
      responsiveness: 1.0
    };
  }
};