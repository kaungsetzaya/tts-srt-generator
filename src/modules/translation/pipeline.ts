import type { TranslationInput, TranslationOutput } from "../types";
import { whisper } from "./services/whisper";
import { translateText } from "./services/gemini";

// ═══════════════════════════════════════════════════════════════
// Translation Pipeline (VIDEO → TEXT)
// Input: audio → Whisper → Gemini → Output: translated text
// ═══════════════════════════════════════════════════════════════

export class TranslationPipeline {
  async process(input: TranslationInput): Promise<TranslationOutput> {
    const { audioBuffer, userApiKey } = input;

    // Step 1: Transcribe with Whisper
    const whisperResult = await whisper.transcribe(audioBuffer);

    if (!whisperResult.text.trim()) {
      throw new Error("No speech detected in video");
    }

    // Step 2: Translate FULL text with Gemini (not segmented)
    const myanmarText = await translateText(whisperResult.text);

    return {
      englishText: whisperResult.text,
      myanmarText,
      // Return segments for dubbing to reuse (optional)
      segments: whisperResult.segments,
    };
  }
}

export const translationPipeline = new TranslationPipeline();