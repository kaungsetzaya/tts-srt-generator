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
    const prompt = this.buildPrompt(text);
    
    for (const modelId of MODELS) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelId });
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
      } catch (e) {
        console.error(`[Gemini] Model ${modelId} failed:`, e);
        continue;
      }
    }
    throw new Error("All Gemini models failed");
  }

  private buildPrompt(text: string): string {
    return `Translate the following English text to Burmese (Myanmar). 
Maintain the original meaning and tone. 
Respond with ONLY the translated text, nothing else.

English: ${text}`;
  }

  applyPhonetics(text: string): string {
    let result = text;
    for (const [en, mm] of Object.entries(PHONETIC_MAP)) {
      result = result.replace(new RegExp(en, "gi"), mm);
    }
    return result;
  }
}