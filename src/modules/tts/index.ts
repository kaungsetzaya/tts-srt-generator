import type { TtsInput } from "./types";
import { processText } from "./pipeline";

export async function generateTts(input: TtsInput) {
  return processText(input);
}

export { type TtsInput, type TtsOutput, type VoiceType } from "./types";