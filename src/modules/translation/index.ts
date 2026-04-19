import type { TranslationInput, TranslationOutput } from "./types";
import { processAudio } from "./pipeline";

export async function translateAudio(input: TranslationInput): Promise<TranslationOutput> {
  return processAudio(input);
}

export { type TranslationInput, type TranslationOutput } from "./types";