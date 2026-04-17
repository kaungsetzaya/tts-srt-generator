import { randomBytes } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function geminiTranslateForDub(segments: any[], apiKey?: string) {
  const genAI = new GoogleGenerativeAI(
    apiKey || process.env.GEMINI_API_KEY || ""
  );
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-lite" });

  const prompt = `Translate the following English/other language segments to clean Myanmar (Burmese) language only. Rules:
1. Output ONLY Burmese/Myanmar text - no English, no other languages
2. NO "....." or "...." or any dots/suspension marks
3. Write all text in ONE continuous paragraph (no line breaks within a segment)
4. Keep natural speaking tone
5. Return as JSON array with 'text' property for each segment

Segments: ${JSON.stringify(segments.map(s => s.text))}`

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\[[\s\S]*?\]/) as RegExpMatchArray | null;
    const translatedTexts = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    const translatedSegments = segments.map((seg, i) => ({
      ...seg,
      text: translatedTexts[i]?.text || translatedTexts[i] || seg.text,
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
