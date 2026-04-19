import { Segment, TranslatedSegment, SrtCue, AudioResult } from "../../../shared/types/segment";
import type { VoiceType } from "../../tts/types";

export interface DubbingOptions {
  voice: VoiceType;
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
}