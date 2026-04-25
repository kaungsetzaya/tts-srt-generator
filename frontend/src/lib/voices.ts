/**
 * Voice Definitions — Frontend exports
 * Tier 1: Edge-TTS Myanmar voices (Thiha, Nilar) - 1 credit
 * Tier 2: Murf AI voices (Character voices) - 3 credits
 * Tier 3: Google Gemini 3.1 Flash TTS voices - 3 credits
 */

export type VoiceTier = "tier1" | "tier2" | "tier3";

export interface Voice {
  id: string;
  name: string;
  nameMm: string;
  gender: "male" | "female";
  tier: VoiceTier;
  description: string;
}

// ─── Tier 1: Edge-TTS Myanmar Voices ─────────────────────────────────────────
export const TIER1_VOICES: Voice[] = [
  {
    id: "thiha",
    name: "Thiha",
    nameMm: "သီဟ",
    gender: "male",
    tier: "tier1",
    description: "Myanmar Male Voice",
  },
  {
    id: "nilar",
    name: "Nilar",
    nameMm: "နီလာ",
    gender: "female",
    tier: "tier1",
    description: "Myanmar Female Voice",
  },
];

// ─── Tier 2: Murf AI Character Voices ────────────────────────────────────────
export const TIER2_VOICES: Voice[] = [
  {
    id: "ryan",
    name: "Ryan",
    nameMm: "ရဲရင့်",
    gender: "male",
    tier: "tier2",
    description: "American Male Voice",
  },
  {
    id: "ronnie",
    name: "Ronnie",
    nameMm: "ရောင်နီ",
    gender: "male",
    tier: "tier2",
    description: "British Male Voice",
  },
  {
    id: "lucas",
    name: "Lucas",
    nameMm: "လင်းခန့်",
    gender: "male",
    tier: "tier2",
    description: "Australian Male Voice",
  },
  {
    id: "daniel",
    name: "Daniel",
    nameMm: "ဒေဝ",
    gender: "male",
    tier: "tier2",
    description: "British Male Voice",
  },
  {
    id: "evander",
    name: "Evander",
    nameMm: "အဂ္ဂ",
    gender: "male",
    tier: "tier2",
    description: "American Male Voice",
  },
  {
    id: "michelle",
    name: "Michelle",
    nameMm: "မေချို",
    gender: "female",
    tier: "tier2",
    description: "American Female Voice",
  },
  {
    id: "iris",
    name: "Iris",
    nameMm: "အိန္ဒြာ",
    gender: "female",
    tier: "tier2",
    description: "Irish Female Voice",
  },
  {
    id: "charlotte",
    name: "Charlotte",
    nameMm: "သီရိ",
    gender: "female",
    tier: "tier2",
    description: "British Female Voice",
  },
  {
    id: "amara",
    name: "Amara",
    nameMm: "အမရာ",
    gender: "female",
    tier: "tier2",
    description: "African Female Voice",
  },
];

// ─── Tier 3: Google Gemini 3.1 Flash TTS Voices ──────────────────────────────
export const TIER3_VOICES: Voice[] = [
  {
    id: "gemini_puck",
    name: "Puck",
    nameMm: "ပက်က်စ်",
    gender: "male",
    tier: "tier3",
    description: "US Male Voice",
  },
  {
    id: "gemini_charon",
    name: "Charon",
    nameMm: "ခရောန်",
    gender: "male",
    tier: "tier3",
    description: "US Male Voice",
  },
  {
    id: "gemini_kore",
    name: "Kore",
    nameMm: "ကိုရဲ",
    gender: "male",
    tier: "tier3",
    description: "US Male Voice",
  },
  {
    id: "gemini_fenrir",
    name: "Fenrir",
    nameMm: "ဖေနရ်စ်",
    gender: "male",
    tier: "tier3",
    description: "US Male Voice",
  },
  {
    id: "gemini_aoede",
    name: "Aoede",
    nameMm: "အိုအီးဒီ",
    gender: "female",
    tier: "tier3",
    description: "US Female Voice",
  },
  {
    id: "gemini_callirrhoe",
    name: "Callirrhoe",
    nameMm: "ကယ်လ်ရိုရဲ",
    gender: "female",
    tier: "tier3",
    description: "US Female Voice",
  },
  {
    id: "gemini_dione",
    name: "Dione",
    nameMm: "ဒိုအီနဲ",
    gender: "female",
    tier: "tier3",
    description: "US Female Voice",
  },
  {
    id: "gemini_enceladus",
    name: "Enceladus",
    nameMm: "အန်စီလေးဒက်စ်",
    gender: "female",
    tier: "tier3",
    description: "US Female Voice",
  },
];

// ─── Combined ────────────────────────────────────────────────────────────────
export const ALL_VOICES: Voice[] = [
  ...TIER1_VOICES,
  ...TIER2_VOICES,
  ...TIER3_VOICES,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const VOICE_CREDITS: Record<VoiceTier, number> = {
  tier1: 1,
  tier2: 3,
  tier3: 3,
};

export function getVoiceCredits(voiceId: string): number {
  const voice = ALL_VOICES.find(v => v.id === voiceId);
  return voice ? VOICE_CREDITS[voice.tier] : 1;
}

export function getVoiceTier(voiceId: string): VoiceTier {
  return ALL_VOICES.find(v => v.id === voiceId)?.tier ?? "tier1";
}

export function getVoicesByTier(tier: VoiceTier): Voice[] {
  return ALL_VOICES.filter(v => v.tier === tier);
}

export function getMalesByTier(tier: VoiceTier): Voice[] {
  return getVoicesByTier(tier).filter(v => v.gender === "male");
}

export function getFemalesByTier(tier: VoiceTier): Voice[] {
  return getVoicesByTier(tier).filter(v => v.gender === "female");
}
