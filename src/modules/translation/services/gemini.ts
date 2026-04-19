import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Segment, TranslatedSegment } from "../../../shared/types/segment";

const MODELS = [
  "models/gemini-3.1-flash-lite-preview",
  "models/gemini-2.5-flash-lite",
];

const PHONETIC_MAP: Record<string, string> = {
  CEO: "စီအီးအို",
  FBI: "အက်ဖ်ဘီအိုင်",
  AI: "အေအိုင်",
  UK: "ယူကေလိုင်း",
  US: "ယူအက်စ်",
};

export class GeminiTranslationService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async translate(text: string): Promise<string> {
    const prompt = `You are a translator. Translate EXACTLY word-for-word to Myanmar Burmese.
Keep exact meaning. Output ONLY the translation in Myanmar.
No explanation, no notes.

TRANSLATE: ${text}`;

    for (const modelId of MODELS) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelId });
        const result = await model.generateContent(prompt);
        const response = result.response;
        let translated = response.text();

        // Clean up response
        translated = this.cleanResponse(translated);

        return this.applyPhonetics(translated);
      } catch (e) {
        console.error(`[Gemini] Model ${modelId} failed:`, e);
        continue;
      }
    }
    throw new Error("All Gemini models failed");
  }

  async translateBatch(segments: Segment[]): Promise<TranslatedSegment[]> {
    // For dubbing: batch translate with timestamps preserved
    const lines = segments.map((s) => s.text);
    const prompt = `Translate these segments to Myanmar Burmese.
Output ONLY translations as JSON array.
Keep exact same number of lines.

STRICT RULES:
1. ONLY TRANSLATE: Output ONLY translations.
2. ONLY MYANMAR: Output in Myanmar script.
3. CLEAN OUTPUT: JSON array ONLY. No notes.

SEGMENTS: ${JSON.stringify(lines)}`;

    for (const modelId of MODELS) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelId,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: { type: "ARRAY", items: { type: "STRING" } },
          },
        });

        const result = await model.generateContent(prompt);
        const translations = JSON.parse(result.response.text());

        return segments.map((seg, i) => ({
          ...seg,
          translatedText: this.applyPhonetics(translations[i] || seg.text),
        }));
      } catch (e) {
        console.error(`[Gemini] Batch failed:`, e);
        continue;
      }
    }

    // Fallback: return original if all fail
    return segments.map((seg) => ({
      ...seg,
      translatedText: seg.text,
    }));
  }

  private cleanResponse(text: string): string {
    // Remove markers like ```myanmar or ```, quotes, etc.
    return text
      .replace(/^```[a-z]*\n?/g, "")
      .replace(/```$/g, "")
      .replace(/^["']|["']$/g, "")
      .trim();
  }

  applyPhonetics(text: string): string {
    let result = text;
    for (const [en, mm] of Object.entries(PHONETIC_MAP)) {
      result = result.replace(new RegExp(en, "gi"), mm);
    }
    return result;
  }
}

// Singleton instance
let geminiInstance: GeminiTranslationService | null = null;

export function getGeminiService(): GeminiTranslationService {
  if (!geminiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }
    geminiInstance = new GeminiTranslationService(apiKey);
  }
  return geminiInstance;
}

export async function translateWithGemini(
  segments: Segment[],
  _userApiKey?: string
): Promise<TranslatedSegment[]> {
  const service = getGeminiService();
  return service.translateBatch(segments);
}