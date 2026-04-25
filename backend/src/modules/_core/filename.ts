/**
 * Lumix Studio Filename Generator
 * Format: LUMIX_[ProjectID]_[Feature].[ext]
 * Short ID: LMX + 3 random alphanumeric chars (6 chars total)
 */
import { customAlphabet } from "nanoid";

const shortIdGenerator = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 3);

export function generateShortId(): string {
  return `LMX${shortIdGenerator()}`; // e.g. LMX782, LMXA1B
}

export type FeatureCode = "DUB" | "TRANS" | "TTS" | "SRT";

export function buildOutputFilename(
  shortId: string,
  feature: FeatureCode,
  ext: string
): string {
  const cleanExt = ext.replace(/^\./, "");
  return `LUMIX_${shortId}_${feature}.${cleanExt}`;
}

/** Map a feature slug to its canonical code */
export function featureToCode(feature: "dub" | "translate" | "tts" | "subtitle" | "srt"): FeatureCode {
  switch (feature) {
    case "dub": return "DUB";
    case "translate": return "TRANS";
    case "tts": return "TTS";
    case "subtitle":
    case "srt": return "SRT";
  }
}
