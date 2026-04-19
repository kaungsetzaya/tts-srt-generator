import type { TranslationInput, TranslationOutput } from "../types";
import { whisper } from "./services/whisper";
import { getGeminiService } from "./services/gemini";

export class TranslationPipeline {
  async process(input: TranslationInput): Promise<TranslationOutput> {
    const { audioBuffer, userApiKey } = input;

    // Step 1: Transcribe with Whisper
    const whisperResult = await whisper.transcribe(audioBuffer);

    if (!whisperResult.text.trim()) {
      throw new Error("No speech detected in video");
    }

    // Step 2: Translate with Gemini (uses full text, not segmented)
    const gemini = getGeminiService();
    const myanmarText = await gemini.translate(whisperResult.text);

    return {
      englishText: whisperResult.text,
      myanmarText,
      segments: whisperResult.segments,
    };
  }
}

export const translationPipeline = new TranslationPipeline();