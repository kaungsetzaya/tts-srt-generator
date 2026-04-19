export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface TranslatedSegment extends Segment {
  translatedText: string;
}

export interface AudioResult {
  audioBuffer: Buffer;
  durationMs: number;
}

export interface SrtCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}