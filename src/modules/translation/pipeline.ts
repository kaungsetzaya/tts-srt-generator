import type { TranslationInput, TranslationOutput } from "../types";
import { whisper } from "./services/whisper";
import { gemini } from "./services/gemini";

export class TranslationPipeline {
  async process(input: TranslationInput): Promise<TranslationOutput> {
    const { audioBuffer, userApiKey } = input;

    const whisperResult = await whisper.transcribe(audioBuffer);
    
    if (!whisperResult.text.trim()) {
      throw new Error("No speech detected in video");
    }

    const myanmarText = await gemini.translate(whisperResult.text);

    return {
      englishText: whisperResult.text,
      myanmarText,
      segments: whisperResult.segments,
    };
  }
}

export const translationPipeline = new TranslationPipeline();