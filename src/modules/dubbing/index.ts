// Dubbing Module - Public API
// Input: video → Output: dubbed video

export { DubbingPipeline, dubbingPipeline } from "./pipeline";
export { buildAssSubtitle } from "./services/assBuilder";
export type { DubbingInput, DubbingOutput, DubbingOptions } from "./types";