import { SrtCue, AudioResult } from "../../shared/types/segment";

export type VoiceType = "thiha" | "nilar";

export interface TtsOptions {
  voice: VoiceType;
  speed?: number;
  pitch?: number;
}

export interface TtsInput {
  text: string;
  options: TtsOptions;
  character?: string;
}

export interface TtsOutput {
  audio: AudioResult;
  srt: SrtCue[];
  rawSrt: string;
}