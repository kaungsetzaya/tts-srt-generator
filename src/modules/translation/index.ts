// Translation Module - Public API
// Input: video/audio → Output: translated text

export { TranslationPipeline, translationPipeline } from "./pipeline";
export { whisper } from "./services/whisper";
export { getGeminiService, translateText, translateSegments } from "./services/gemini";
export type { TranslationInput, TranslationOutput, WhisperResult } from "./types";