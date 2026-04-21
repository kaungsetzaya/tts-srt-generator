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
    id: "gemini_alex",
    name: "Alex",
    nameMm: "အဲလက်စ်",
    gender: "male",
    tier: "tier3",
    description: "US Male Voice",
  },
  {
    id: "gemini_aria",
    name: "Aria",
    nameMm: "အာရီအာ",
    gender: "female",
    tier: "tier3",
    description: "US Female Voice",
  },
  {
    id: "gemini_asha",
    name: "Asha",
    nameMm: "အာရှာ",
    gender: "female",
    tier: "tier3",
    description: "Indian Female Voice",
  },
  {
    id: "gemini_b中年",
    name: "B中年人",
    nameMm: "ဘင်္ဂလား",
    gender: "male",
    tier: "tier3",
    description: "B中年 Male Voice",
  },
  {
    id: "gemini_dustin",
    name: "Dustin",
    nameMm: "ဒါစတင်",
    gender: "male",
    tier: "tier3",
    description: "US Male Voice",
  },
  {
    id: "gemini_emma",
    name: "Emma",
    nameMm: "အမ်မာ",
    gender: "female",
    tier: "tier3",
    description: "British Female Voice",
  },
  {
    id: "gemini_eric",
    name: "Eric",
    nameMm: "အီရစ်",
    gender: "male",
    tier: "tier3",
    description: "US Male Voice",
  },
  {
    id: "gemini_female_01",
    name: "Luna",
    nameMm: "လူနာ",
    gender: "female",
    tier: "tier3",
    description: "Female Voice 1",
  },
  {
    id: "gemini_female_02",
    name: "Sophia",
    nameMm: "စိုဖီအာ",
    gender: "female",
    tier: "tier3",
    description: "Female Voice 2",
  },
  {
    id: "gemini_kokoro",
    name: "Kokoro",
    nameMm: "ကိုကိုရို",
    gender: "female",
    tier: "tier3",
    description: "Japanese Female Voice",
  },
  {
    id: "gemini_male_01",
    name: "Kian",
    nameMm: "ကီရာန်",
    gender: "male",
    tier: "tier3",
    description: "Male Voice 1",
  },
  {
    id: "gemini_male_02",
    name: "Adrian",
    nameMm: "အဒရီအန်",
    gender: "male",
    tier: "tier3",
    description: "Male Voice 2",
  },
  {
    id: "gemini_male_03",
    name: "Berk",
    nameMm: "ဘားက်",
    gender: "male",
    tier: "tier3",
    description: "Male Voice 3",
  },
  {
    id: "gemini_puck",
    name: "Puck",
    nameMm: "ပတ်ခ်",
    gender: "male",
    tier: "tier3",
    description: "US Male Voice",
  },
  {
    id: "gemini_soren",
    name: "Soren",
    nameMm: "စိုးရင်",
    gender: "male",
    tier: "tier3",
    description: "Danish Male Voice",
  },
  {
    id: "gemini_studio_female",
    name: "Serena",
    nameMm: "စီရီနာ",
    gender: "female",
    tier: "tier3",
    description: "Studio Female Voice",
  },
  {
    id: "gemini_studio_male",
    name: "James",
    nameMm: "ဂျိမ်းစ်",
    gender: "male",
    tier: "tier3",
    description: "Studio Male Voice",
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
