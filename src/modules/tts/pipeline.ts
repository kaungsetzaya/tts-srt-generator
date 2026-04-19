import type { TtsInput, TtsOutput } from "../types";
import { generateSpeech } from "./services/edgeTts";

export class TtsPipeline {
  async process(input: TtsInput): Promise<TtsOutput> {
    return generateSpeech(input);
  }
}

export const ttsPipeline = new TtsPipeline();