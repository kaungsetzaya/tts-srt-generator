/**
 * Shared types for LUMIX TTS/SRT Generator
 * Used by both frontend and backend to avoid duplication.
 *
 * Drizzle schema types and errors are re-exported for convenience.
 */

export type * from "../drizzle/schema";
export { HttpError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from "./_core/errors";

// ─── Trial & Plan Limits ────────────────────────────────────────────────

export interface TrialLimits {
  charLimitStandard: number;
  charLimitCharacter: number;
  totalTtsSrt: number;
  totalCharacterUse: number;
  totalAiVideo: number;
  totalAiVideoChar: number;
  totalVideoTranslate: number;
  maxVideoSizeMB: number;
  maxVideoDurationSec: number;
  maxAiVideoDurationSecStd: number;
  maxAiVideoDurationSecChar: number;
}

export interface PlanLimits {
  charLimitStandard: number;
  charLimitCharacter: number;
  dailyTtsSrt: number;
  dailyCharacterUse: number;
  dailyAiVideo: number;
  dailyVideoTranslate: number;
}

export interface TrialUsage {
  tts: number;
  characterUse: number;
  aiVideo: number;
  aiVideoChar: number;
  videoTranslate: number;
}

export interface SubscriptionStatus {
  active: boolean;
  plan: string | null;
  expiresAt: string | null;
  limits: PlanLimits;
  usage: {
    tts: number;
    characterUse: number;
    aiVideo: number;
    videoTranslate: number;
  };
  trialUsage: TrialUsage | null;
  trialLimits: TrialLimits | null;
}

// ─── Voice & Character Types ────────────────────────────────────────────

export type VoiceKey = "thiha" | "nilar";

export type CharacterKey =
  | "ryan"
  | "ronnie"
  | "lucas"
  | "daniel"
  | "evander"
  | "michelle"
  | "iris"
  | "charlotte"
  | "amara";

// ─── Dub (AI Video) Types ───────────────────────────────────────────────

export interface DubOptions {
  voice: VoiceKey;
  character?: string;
  speed: number;
  pitch: number;
  srtEnabled: boolean;
  srtFontSize?: number;
  srtColor?: string;
  srtDropShadow?: boolean;
  srtBlurBg?: boolean;
  srtMarginV?: number;
  srtBlurSize?: number;
  srtBlurColor?: "black" | "white";
  srtFullWidth?: boolean;
  srtBorderRadius?: "rounded" | "square";
  userApiKey?: string; // User's own Gemini API key
}

export interface DubResult {
  videoBase64: string;
  myanmarText: string;
  srtContent: string;
  durationMs: number;
}

// ─── TTS Result Types ───────────────────────────────────────────────────

export interface GenerateResult {
  audioBuffer: ArrayBuffer; // Buffer on backend, represented as ArrayBuffer in shared type
  srtContent: string;
  rawSrt: string;
  durationMs: number;
}

// ─── Video Translation Result ────────────────────────────────────────────

export interface TranslateResult {
  englishText: string;
  myanmarText: string;
  srtContent: string;
}