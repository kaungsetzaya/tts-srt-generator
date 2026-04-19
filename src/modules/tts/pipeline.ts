import type { TtsInput, TtsOutput } from "../types";
import { edgeTts } from "./services/edgeTts";

// ═══════════════════════════════════════════════════════════════
// TTS Pipeline
// Input: text → Output: audio + SRT
// ═══════════════════════════════════════════════════════════════

export class TtsPipeline {
  async process(input: TtsInput): Promise<TtsOutput> {
    const result = await edgeTts.generate(input);

    return {
      audio: result.audio,
      srt: result.srt,
      rawSrt: result.rawSrt,
    };
  }
}

export const ttsPipeline = new TtsPipeline();