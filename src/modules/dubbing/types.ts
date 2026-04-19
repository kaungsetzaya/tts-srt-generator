import type { DubbingOptions as DubOptions } from "./types";

export type VoiceType = "thiha" | "nilar";

export interface DubbingOptions {
  voice: VoiceType;
  speed?: number;
  pitch?: number;
  srtEnabled?: boolean;
}

export interface DubbingInput {
  videoBuffer: Buffer;
  filename: string;
  options: DubbingOptions;
  userApiKey?: string;
}

export interface DubbingOutput {
  videoBuffer: Buffer;
  srtContent?: string;
  durationMs: number;
}