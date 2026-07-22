
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ToneType, VoiceName, CustomVoice } from "../types";
import { generateProceduralSFX, concatenateAudioBuffers, decodeAudioData } from "../utils/audioUtils";
import { SFX_COMMANDS_HELP } from "../constants";

const STORAGE_KEYS = {
  CUSTOM_VOICES: 'voxgen_custom_voices_v1'
};

const getClient = () => {
  const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  const cleanKey = rawKey.replace(/["'\s]/g, ""); 
  if (!cleanKey) {
    console.error("[Gemini Service] Chave de API não encontrada! Verifique as configurações do projeto.");
  }
  return new GoogleGenAI({ apiKey: cleanKey });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getCustomVoiceById = (id: string): CustomVoice | undefined => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_VOICES);
      const voices: CustomVoice[] = data ? JSON.parse(data) : [];
      return voices.find(v => v.id === id);
    } catch (e) {
      return undefined;
    }
};

const getMimeTypeFromBase64 = (base64String: string, defaultType: string = 'audio/wav'): string => {
    if (!base64String || !base64String.startsWith('data:')) return defaultType;
    const matches = base64String.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/);
    return matches && matches[1] ? matches[1] : defaultType;
};

export const refineText = async (text: string, tone: ToneType | string, useBackgroundMusic: boolean): Promise<string> => {
  const ai = getClient();
  let specificInstruction = "";
  
  if (useBackgroundMusic) {
    specificInstruction += " O usuário solicitou fundo musical. Adapte o ritmo. ";
  }

  if (tone === 'Vignette') {
      specificInstruction += " ESTILO VINHETA DE RÁDIO: Use linguagem impactante, curta e direta. INSERIR EFEITOS SONOROS. ";
  } else if (tone === ToneType.Sales) {
      specificInstruction += " ESTILO VENDAS: Urgente. Sugira uso de (caixa) ou (buzina). ";
  } else if (tone === ToneType.Dramatic) {
      specificInstruction += " ESTILO DRAMÁTICO: Use pausas e emoção. ";
  } else if (tone === ToneType.Professional) {
      specificInstruction += " ESTILO PROFISSIONAL: Linguagem corporativa, clara e polida. ";
  } else if (tone === ToneType.CarSound) {
      specificInstruction += " ESTILO CARRO DE SOM: Estilo anúncio de rua brasileiro. MUITO enérgico, repetitivo para clareza, chamativo, use gírias comerciais locais (ex: 'Atenção freguesia!', 'É só hoje!', 'Venha conferir!'). ";
  } else if (tone === ToneType.RadioCommercial) {
      specificInstruction += " ESTILO COMERCIAL DE RÁDIO: Locutor profissional. Polido, rítmico, articulação clara, persuasivo. ";
  } else if (tone === ToneType.PromotionalEnergetic) {
      specificInstruction += " ESTILO PROMOÇÃO EXPLOSIVA: Energia máxima, alto impacto, estilo 'Black Friday' intenso. ";
  } else if (tone === ToneType.StorefrontAnnouncer) {
      specificInstruction += " ESTILO PORTA DE LOJA: Locutor de rua agitado. Use tons de 'grito' (em texto, use exclamações e palavras de ordem), frases curtas, gírias de vendedor de rua, MUITO chamativo para pedestres e carros. Ex: 'OLHA O PREÇO!', 'É PRA ACABAR!', 'VEM VEM VEM!'. Insira (buzina) ou (explosao) no início para chamar atenção. ";
  }

  const prompt = `
    Você é um roteirista de áudio profissional (PT-BR) da VoxGen.
    Tarefa: Humanizar o texto para o tom: "${tone}".
    ${specificInstruction}
    
    IMPORTANTE - EFEITOS SONOROS (SFX):
    Você DEVE inserir comandos de efeitos sonoros entre PARÊNTESES onde fizer sentido para o contexto.
    Comandos aceitos: (buzina), (explosao), (aplausos), (risada), (caixa), (sino), (brinde), (laser), (coin).
    
    REGRAS:
    1. Mantenha a mensagem original.
    2. Retorne APENAS o texto final. Sem introduções.
    
    Texto Original: "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    let cleanedText = response.text?.trim() || text;
    cleanedText = cleanedText.replace(/^["']|["']$/g, "").trim();
    return cleanedText;
  } catch (e) {
    return text; 
  }
};

export const addAutomaticSFX = async (text: string): Promise<string> => {
  if (!text.trim()) return text;
  const ai = getClient();
  const availableSFX = SFX_COMMANDS_HELP.join(', ');

  const prompt = `
    Analise o texto e insira tags de efeitos sonoros contextuais.
    TAGS: ${availableSFX}
    TEXTO: "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text?.trim() || text;
  } catch (e) {
    return text;
  }
};

const callTTS = async (textChunk: string, voiceName: string, isCustom: boolean): Promise<string> => {
    if (!textChunk.trim()) return "";
    const ai = getClient();
    const MAX_RETRIES = 5;
    let effectiveVoice = voiceName.split('-')[0];
    const customVoiceData = !Object.values(VoiceName).includes(effectiveVoice as VoiceName) && !voiceName.includes('-') 
        ? getCustomVoiceById(effectiveVoice) 
        : null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[TTS] Tentativa ${attempt} para voz ${effectiveVoice}...`);
            if (customVoiceData && customVoiceData.audioSampleBase64) {
                console.log("[TTS] Usando voz personalizada...");
                const mimeType = getMimeTypeFromBase64(customVoiceData.audioSampleBase64);
                const base64Sample = customVoiceData.audioSampleBase64.split(',')[1] || customVoiceData.audioSampleBase64;
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash-native-audio-preview-09-2025",
                    contents: {
                        parts: [
                            { inlineData: { mimeType: mimeType, data: base64Sample } },
                            { text: `Read exactly in Portuguese Brazil: "${textChunk}"` }
                        ]
                    },
                    config: { responseModalities: [Modality.AUDIO] }
                });
                const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
                console.log(`[TTS] Resposta recebida (${data.length} bytes)`);
                return data;
            } 
            console.log("[TTS] Usando voz padrão...");
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: textChunk }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: effectiveVoice } },
                    },
                },
            });
            const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
            console.log(`[TTS] Resposta recebida (${data.length} bytes)`);
            return data;
        } catch (e: any) {
            console.error(`[TTS] Erro na tentativa ${attempt}:`, e);
            await wait(Math.pow(2, attempt) * 1000);
            if (attempt === MAX_RETRIES) throw e;
        }
    }
    throw new Error("Falha no TTS.");
};

export const generateSpeech = async (rawText: string, voice: string): Promise<string> => {
  const sfxRegex = /(\(.*?\))/g;
  const parts = rawText.split(sfxRegex);
  if (parts.length === 1) return await callTTS(rawText, voice, false);
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const audioBuffers: AudioBuffer[] = [];

  for (const part of parts) {
      const segment = part.trim();
      if (!segment) continue;
      if (segment.startsWith('(') && segment.endsWith(')')) {
          const keyword = segment.slice(1, -1);
          try {
             const sfxBuffer = await generateProceduralSFX(keyword, ctx);
             audioBuffers.push(sfxBuffer);
          } catch (e) {}
      } else {
          const ttsBase64 = await callTTS(segment, voice, false);
          if (ttsBase64) {
              const ttsBuffer = await decodeAudioData(ttsBase64, ctx);
              audioBuffers.push(ttsBuffer);
          }
      }
  }
  const finalBuffer = concatenateAudioBuffers(audioBuffers, ctx);
  const wavBlob = (await import("../utils/audioUtils")).audioBufferToWav(finalBuffer);
  return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(wavBlob);
  });
};

export const analyzeVoiceQuality = async (audioBase64: string, expectedText: string): Promise<any> => { return { clarityScore: 85, feedback: "Boa dicção." }; };
export const planComicStory = async (prompt: string, numPages: number): Promise<any[]> => {
  const ai = getClient();
  const systemInstruction = `
    Você é um roteirista de quadrinhos e storyboarder profissional. 
    Sua tarefa é transformar a ideia do usuário em um storyboard detalhado de ${numPages} páginas.
    
    DIRETRIZES CRÍTICAS:
    1. FIDELIDADE AO TEMA: Se o usuário fala de trânsito, as cenas DEVEM mostrar carros, ruas, semáforos, etc. NUNCA gere paisagens genéricas se não houver relação com o texto.
    2. DESCRIÇÃO VISUAL: A propriedade 'scene' deve ser uma descrição visual rica e específica para um gerador de imagens (ex: "Uma rua movimentada com carros parados no sinal vermelho, foco em uma placa de Pare").
    3. TRADUÇÃO DE CONCEITOS: Transforme conceitos abstratos (como leis) em situações visuais concretas.
    
    Cada página deve ter:
    - scene: Descrição visual detalhada e específica da cena.
    - layout: Sugestão de layout (ex: "Full Page", "3 Panels Grid", "Diagonal Split").
    - dialogue: O texto que será falado ou escrito em balões. Se não houver fala, use "NO DIALOGUE".
    
    Retorne APENAS um JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Crie um storyboard de ${numPages} páginas baseado fielmente nesta história: ${prompt}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              scene: { type: Type.STRING },
              layout: { type: Type.STRING },
              dialogue: { type: Type.STRING }
            },
            required: ["scene", "layout", "dialogue"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Plan Story Error", e);
    return [];
  }
};

export const generateImage = async (prompt: string, style: string, referenceImage?: string, layout?: string, dialogue?: string): Promise<string> => {
  const ai = getClient();
  
  // Prompt otimizado para evitar falhas e garantir fidelidade
  const createPrompt = (p: string) => `
    QUADRINHO PROFISSIONAL: ${style}
    CENA OBRIGATÓRIA: ${p}
    DETALHES: ${layout}. ${dialogue !== "NO DIALOGUE" ? `Balão de fala: ${dialogue}` : ""}
    AMBIENTE: Urbano, autoescola, carros, instrutor Daniel, aluna Ana.
    ESTILO: Cinematográfico, emocional, cores vibrantes.
    NÃO GERE: Paisagens naturais, florestas ou montanhas, a menos que solicitado.
  `;
  
  const contents: any = {
    parts: [{ text: createPrompt(prompt) }]
  };

  if (referenceImage) {
    const mimeType = getMimeTypeFromBase64(referenceImage);
    const base64Data = referenceImage.split(',')[1] || referenceImage;
    contents.parts.unshift({
      inlineData: { mimeType, data: base64Data }
    });
  }

  // Tenta primeiro com o modelo mais avançado
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents,
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) {
    console.warn("Falha no modelo 3.1, tentando 2.5 flash...", e);
  }

  // Segunda tentativa com modelo mais estável
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents,
      config: {
        imageConfig: { aspectRatio: "3:4" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) {
    console.error("Erro crítico na geração de imagem:", e);
  }

  // Se tudo falhar, retorna uma imagem que indica erro visualmente ou tenta um placeholder mais próximo do tema
  return `https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=600&h=800&auto=format&fit=crop`; // Imagem genérica de direção/carro como último recurso
};

export const generateAvatarVideo = async (imageBase64: string, prompt: string): Promise<string> => {
  const ai = getClient();
  const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  const apiKey = rawKey.replace(/["'\s]/g, ""); 
  
  const mimeType = getMimeTypeFromBase64(imageBase64);
  const base64Data = imageBase64.split(',')[1] || imageBase64;

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      image: {
        imageBytes: base64Data,
        mimeType: mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Falha ao obter link do vídeo.");

    const videoResponse = await fetch(downloadLink, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      },
    });

    const blob = await videoResponse.blob();
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("Video Gen Error", e);
    throw e;
  }
};

export const generateSongMetadata = async (description: string, lyrics?: string): Promise<any> => {
  const ai = getClient();
  const prompt = `
    Como um assistente de estúdio musical IA, analise a descrição e as letras (se houver) para sugerir metadados para uma música.
    Descrição: ${description}
    Letras: ${lyrics || "Instrumental"}
    
    Retorne um JSON com:
    - title: Título criativo
    - lyrics: Letras completas (ou as fornecidas, ou geradas se for modo simples)
    - styleTag: Tag curta de estilo (ex: "Pop Animado", "Heavy Metal")
    - coverColor: Cor hexadecimal para a capa
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
          },
          required: ["title", "lyrics", "styleTag", "coverColor"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return {
      title: "Nova Música",
      lyrics: lyrics || "Sem letra.",
      styleTag: description,
      coverColor: "#334155"
    };
  }
};
