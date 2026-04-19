import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Segment, TranslatedSegment } from "../../../shared/types/segment";

// ═══════════════════════════════════════════════════════════════
// Gemini Translation Service (ONE SOURCE OF TRUTH)
// ═══════════════════════════════════════════════════════════════

const MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
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

  /** Translate FULL text to Myanmar (for Translation pipeline) */
  async translateFull(text: string): Promise<string> {
    const prompt = `You are a professional translator. Translate EXACTLY word-for-word to Myanmar Burmese.
Keep exact meaning and tone. Output ONLY the translation in Myanmar script.
No explanation, no notes, no intro or outro.

TRANSLATE TO MYANMAR: ${text}`;

    for (const modelId of MODELS) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelId });
        const result = await model.generateContent(prompt);
        let translated = result.response.text();
        
        return this.applyPhonetics(this.cleanResponse(translated));
      } catch (e) {
        console.error(`[Gemini] Model ${modelId} failed:`, e);
        continue;
      }
    }
    throw new Error("All Gemini models failed");
  }

  /** Translate segments in batch (for Dubbing pipeline) - preserves timestamps */
  async translateBatch(segments: Segment[]): Promise<TranslatedSegment[]> {
    const lines = segments.map((s) => s.text);
    const prompt = `Translate these segments to Myanmar Burmese.
Output ONLY translations as JSON array.
Keep exact same number of lines and order.

STRICT RULES:
1. ONLY TRANSLATE: Output ONLY translations.
2. ONLY MYANMAR: Output in Myanmar script.
3. CLEAN OUTPUT: JSON array ONLY. No notes.

SEGMENTS TO TRANSLATE: ${JSON.stringify(lines)}`;

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

    // Fallback: return original text if all models fail
    return segments.map((seg) => ({
      ...seg,
      translatedText: seg.text,
    }));
  }

  private cleanResponse(text: string): string {
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

/** Translate full text (for Translation pipeline) */
export async function translateText(text: string): Promise<string> {
  const service = getGeminiService();
  return service.translateFull(text);
}

/** Translate segments (for Dubbing pipeline) */
export async function translateSegments(
  segments: Segment[]
): Promise<TranslatedSegment[]> {
  const service = getGeminiService();
  return service.translateBatch(segments);
}