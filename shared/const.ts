/**
 * Shared constants for LUMIX TTS/SRT Generator
 * Used by both frontend and backend.
 */

export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// ─── App Routes ──────────────────────────────────────────────────────────
export const ROUTES = {
  home: "/",
  login: "/login",
  lumix: "/lumix",
  admin: "/admin",
} as const;

// ─── Subscription Plans ─────────────────────────────────────────────────
export const PLANS = {
  trial: "trial",
  oneMonth: "1month",
  threeMonth: "3month",
  sixMonth: "6month",
  lifetime: "lifetime",
} as const;

export type PlanKey = (typeof PLANS)[keyof typeof PLANS];

// ─── Feature Keys (for usage tracking in DB) ───────────────────────────
export const FEATURES = {
  tts: "tts",
  dubFile: "dub_file",
  dubLink: "dub_link",
  translateFile: "translate_file",
  translateLink: "translate_link",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

// ─── Default Limits ─────────────────────────────────────────────────────
export const TRIAL_DEFAULTS: Omit<import("./types").TrialLimits, never> = {
  charLimitStandard: 20000,
  charLimitCharacter: 2000,
  totalTtsSrt: 7,
  totalCharacterUse: 2,
  totalAiVideo: 2,
  totalAiVideoChar: 1,
  totalVideoTranslate: 2,
  maxVideoSizeMB: 25,
  maxVideoDurationSec: 150,
  maxAiVideoDurationSecStd: 180,
  maxAiVideoDurationSecChar: 90,
};

export const PAID_PLAN_LIMITS: Omit<import("./types").PlanLimits, never> = {
  charLimitStandard: 30000,
  charLimitCharacter: 2000,
  dailyTtsSrt: 999,
  dailyCharacterUse: 999,
  dailyAiVideo: 999,
  dailyVideoTranslate: 999,
};

// ─── Frontend-only helpers ──────────────────────────────────────────────
export const getLoginUrl = () => `${window.location.origin}/login`;