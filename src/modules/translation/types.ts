import { Segment } from "../../../shared/types/segment";

export interface TranslationInput {
  audioBuffer: Buffer;
  userApiKey?: string;
}

export interface TranslationOutput {
  englishText: string;
  myanmarText: string;
  segments?: Segment[];
}

export interface WhisperResult {
  text: string;
  segments: Segment[];
}