import { randomBytes } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function geminiTranslateForDub(segments: any[], apiKey?: string) {
  const genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-lite" });

  const prompt = `Translate the following segments to Myanmar language for video dubbing. Keep the meaning and tone. Return the result as a JSON array of objects with 'text' property.
  Segments: ${JSON.stringify(segments.map(s => s.text))}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\[.*\]/s);
    const translatedTexts = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    const translatedSegments = segments.map((seg, i) => ({
      ...seg,
      text: translatedTexts[i]?.text || translatedTexts[i] || seg.text
    }));

    return { translated: translatedSegments };
  } catch (error) {
    console.error("[Gemini Dub Error]", error);
    return { translated: segments };
  }
}

export function generateTranslationId(): string {
  return randomBytes(18).toString("hex");
}
