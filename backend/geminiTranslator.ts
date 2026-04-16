import { randomBytes } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function geminiTranslate(text: string, apiKey?: string) {
  const genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-lite" });

  const prompt = `Translate the following text to Myanmar language. Keep the meaning and tone.
  Text: ${text}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("[Gemini Error]", error);
    return text;
  }
}

export function generateGeminiId(): string {
  return randomBytes(18).toString("hex");
}
