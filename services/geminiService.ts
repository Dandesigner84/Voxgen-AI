import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ToneType, VoiceName } from "../types";

// Inicializa cliente com limpeza da chave (remove aspas e espaços)
const getClient = () => {
  // Tenta pegar de várias fontes possíveis injetadas pelo Vite
  const rawKey = process.env.API_KEY || "";
  const cleanKey = rawKey.replace(/["'\s]/g, ""); 
  return new GoogleGenAI({ apiKey: cleanKey });
};

export const refineText = async (text: string, tone: ToneType, useBackgroundMusic: boolean): Promise<string> => {
  // Se for neutro e sem música, não gasta tokens refinando
  if (tone === ToneType.Neutral && !useBackgroundMusic && !text.match(/[\[<]/)) return text;

  const ai = getClient();
  
  let specificInstruction = "";
  
  if (useBackgroundMusic) {
    specificInstruction += " O usuário solicitou fundo musical. Adapte o ritmo da fala para ser fluido e cadenciado. ";
  }

  if (tone === ToneType.Preaching) {
    specificInstruction += " ESTILO DE PREGAÇÃO CRISTÃ: O texto deve ser reescrito como uma mensagem espiritual poderosa. Use retórica emotiva, pausas dramáticas (...) e pontos de exclamação. A fala deve soar como um pastor pregando com autoridade. ";
  } else if (tone === ToneType.Sales) {
    specificInstruction += " ESTILO VENDAS/BLACK FRIDAY: Urgente, rápido, persuasivo e altamente energético. ";
  } else if (tone === ToneType.Soothing) {
    specificInstruction += " ESTILO CALMO: Suave, lento, acolhedor e relaxante. ";
  }

  const prompt = `
    Você é um roteirista de áudio profissional (PT-BR).
    Tarefa: Reescrever o texto para o tom: "${tone}".
    Extras: ${specificInstruction}
    
    REGRAS PARA EFEITOS SONOROS:
    Converta comandos como [pausa], [risada], [grito] em pontuação e palavras.
    1. [pausa] -> Use reticências "..."
    2. [risada] -> Use "ha ha ha!"
    3. [grito] -> Use CAIXA ALTA e !!!
    
    Texto: "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text?.trim() || text;
  } catch (e) {
    console.warn("Refine text failed, using original text.", e);
    return text; // Falha silenciosa para não travar o app
  }
};

export const generateSpeech = async (text: string, voice: VoiceName): Promise<string> => {
  const ai = getClient();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: ['AUDIO'], // String direta para evitar erro de importação
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("API retornou sucesso mas sem áudio. Texto pode ser muito longo ou bloqueado.");
    }

    return base64Audio;
  } catch (e: any) {
    console.error("TTS Error:", e);
    const errStr = e.toString().toLowerCase();

    // Tratamento específico para erro de Chave Vazada (Leaked Key)
    if (errStr.includes("leaked") || (errStr.includes("permission_denied") && errStr.includes("key"))) {
        throw new Error("SUA CHAVE API FOI BLOQUEADA PELO GOOGLE. Motivo: Vazamento de segurança detectado. Por favor, gere uma NOVA chave em aistudio.google.com e atualize sua Vercel/env.");
    }

    if (errStr.includes("400") || errStr.includes("invalid_argument")) throw new Error("Erro 400: Chave API inválida ou configuração incorreta.");
    if (errStr.includes("403")) throw new Error("Erro 403: Permissão negada. Verifique sua Chave API.");
    if (errStr.includes("429")) throw new Error("Erro 429: Muitos pedidos (Cota excedida). Aguarde um pouco.");
    
    // Se a mensagem de erro vier do objeto JSON do Google
    if (e.message) throw new Error(`Erro da API: ${e.message}`);

    throw e;
  }
};

// --- Music Generation Services ---

export const generateSongMetadata = async (description: string, userLyrics?: string): Promise<any> => {
  const ai = getClient();
  
  let prompt = "";
  if (userLyrics) {
    // User provided lyrics, we need Title and Style matching lyrics
    prompt = `
      Analise a letra da música abaixo e a descrição de estilo "${description}".
      Gere um metadado JSON contendo:
      - title: Um título criativo para a música.
      - styleTag: Uma tag de estilo musical curta em inglês (ex: 'Lo-fi', 'Heavy Metal', 'Pop', 'Jazz').
      - coverColor: Uma cor hex (ex: #FF5500) que combine com a emoção da música.
      - lyrics: Retorne a letra original do usuário intacta.

      Letra do Usuário:
      "${userLyrics.substring(0, 2000)}..."
    `;
  } else {
    // Generate everything from scratch
    prompt = `
      Gere metadados JSON para uma nova música baseada na descrição: "${description}".
      Schema:
      - title: Título criativo.
      - lyrics: Letra da música em PT-BR (2 estrofes e refrão).
      - styleTag: Estilo musical em inglês (ex: 'Electronic', 'Rock', 'Ambient').
      - coverColor: Cor hex.
    `;
  }

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
  } catch (e) {
      console.error("Metadata gen failed", e);
      // Fallback seguro
      return { 
        title: "Nova Música", 
        lyrics: userLyrics || "Erro ao gerar letra...", 
        styleTag: "Ambient", 
        coverColor: "#334155" 
      };
  }
};

export const generateAvatarBehavior = async (description: string): Promise<any> => {
   const ai = getClient();
   try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Gere comportamento JSON para: ${description}. Schema: {energy, range, rotationSpeed, responsiveness}`,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
   } catch {
      return { energy: 1, range: 0.5, rotationSpeed: 0.5, responsiveness: 1 };
   }
};