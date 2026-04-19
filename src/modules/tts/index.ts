// TTS Module - Public API
// Input: text → Output: audio + optional SRT

export { TtsPipeline, ttsPipeline } from "./pipeline";
export { edgeTts } from "./services/edgeTts";
export type { TtsInput, TtsOutput, VoiceType, TtsOptions } from "./types";