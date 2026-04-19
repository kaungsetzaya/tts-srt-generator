import { Segment } from "../../../shared/types/segment";

// ═══════════════════════════════════════════════════════════════
// Translation Types (VIDEO → TEXT ONLY)
// ═══════════════════════════════════════════════════════════════

export interface TranslationInput {
  audioBuffer: Buffer;
  userApiKey?: string;
}

export interface TranslationOutput {
  englishText: string;
  myanmarText: string;
  // Optional segments fordubbing to reuse
  segments?: Segment[];
}

export interface WhisperResult {
  text: string;
  segments: Segment[];
}