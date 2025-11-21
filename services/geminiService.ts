import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("Chave da API não encontrada. Configure VITE_GOOGLE_API_KEY no .env ou na Vercel.");
}

export const genAI = new GoogleGenerativeAI(apiKey);

export const generateVoice = async (text: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text }],
        },
      ],
    });

    return response.response.text();
  } catch (error) {
    console.error("Erro ao gerar conteúdo:", error);
    throw error;
  }
};
