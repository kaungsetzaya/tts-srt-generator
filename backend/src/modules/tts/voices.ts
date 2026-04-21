/**
 * Voice Definitions — Tier-based voice system
 *
 * Tier 1: Edge-TTS Myanmar voices (Thiha, Nilar) - Free
 * Tier 2: Murf AI voices (Character voices) - Premium
 * Tier 3: Google Gemini 3.1 Flash TTS voices - Premium
 */

export type VoiceTier = "tier1" | "tier2" | "tier3";

// ─── Tier 1: Edge-TTS Myanmar Voices ─────────────────────────────────────────
export const TIER1_VOICES = {
  thiha: {
    id: "thiha",
    name: "Thiha",
    nameMm: "သီဟ",
    gender: "male" as const,
    edgeVoice: "my-MM-ThihaNeural",
    tier: "tier1" as VoiceTier,
    description: "Myanmar Male Voice",
  },
  nilar: {
    id: "nilar",
    name: "Nilar",
    nameMm: "နီလာ",
    gender: "female" as const,
    edgeVoice: "my-MM-NilarNeural",
    tier: "tier1" as VoiceTier,
    description: "Myanmar Female Voice",
  },
} as const;

// ─── Tier 2: Murf AI Character Voices ────────────────────────────────────────
export const TIER2_VOICES = {
  ryan: {
    id: "ryan",
    name: "Ryan",
    nameMm: "ရဲရင့်",
    gender: "male" as const,
    murfId: "en-US-ryan",
    baseVoice: "thiha" as const,
    tier: "tier2" as VoiceTier,
    description: "American Male Voice",
  },
  ronnie: {
    id: "ronnie",
    name: "Ronnie",
    nameMm: "ရောင်နီ",
    gender: "male" as const,
    murfId: "en-US-ronnie",
    baseVoice: "thiha" as const,
    tier: "tier2" as VoiceTier,
    description: "British Male Voice",
  },
  lucas: {
    id: "lucas",
    name: "Lucas",
    nameMm: "လင်းခန့်",
    gender: "male" as const,
    murfId: "en-US-lucas",
    baseVoice: "thiha" as const,
    tier: "tier2" as VoiceTier,
    description: "Australian Male Voice",
  },
  daniel: {
    id: "daniel",
    name: "Daniel",
    nameMm: "ဒေဝ",
    gender: "male" as const,
    murfId: "en-US-daniel",
    baseVoice: "thiha" as const,
    tier: "tier2" as VoiceTier,
    description: "British Male Voice",
  },
  evander: {
    id: "evander",
    name: "Evander",
    nameMm: "အဂ္ဂ",
    gender: "male" as const,
    murfId: "en-US-evander",
    baseVoice: "thiha" as const,
    tier: "tier2" as VoiceTier,
    description: "American Male Voice",
  },
  michelle: {
    id: "michelle",
    name: "Michelle",
    nameMm: "မေချို",
    gender: "female" as const,
    murfId: "en-US-michelle",
    baseVoice: "nilar" as const,
    tier: "tier2" as VoiceTier,
    description: "American Female Voice",
  },
  iris: {
    id: "iris",
    name: "Iris",
    nameMm: "အိန္ဒြာ",
    gender: "female" as const,
    murfId: "en-US-iris",
    baseVoice: "nilar" as const,
    tier: "tier2" as VoiceTier,
    description: "Irish Female Voice",
  },
  charlotte: {
    id: "charlotte",
    name: "Charlotte",
    nameMm: "သီရိ",
    gender: "female" as const,
    murfId: "en-US-charlotte",
    baseVoice: "nilar" as const,
    tier: "tier2" as VoiceTier,
    description: "British Female Voice",
  },
  amara: {
    id: "amara",
    name: "Amara",
    nameMm: "အမရာ",
    gender: "female" as const,
    murfId: "en-US-amara",
    baseVoice: "nilar" as const,
    tier: "tier2" as VoiceTier,
    description: "African Female Voice",
  },
} as const;

// ─── Tier 3: Google Gemini 3.1 Flash TTS Voices ──────────────────────────────
export const TIER3_VOICES = {
  // Male Voices
  gemini_alex: {
    id: "gemini_alex",
    name: "Alex",
    nameMm: "အဲလက်စ်",
    gender: "male" as const,
    geminiVoiceId: "alex",
    tier: "tier3" as VoiceTier,
    description: "US Male Voice",
  },
  gemini_aria: {
    id: "gemini_aria",
    name: "Aria",
    nameMm: "အာရီအာ",
    gender: "female" as const,
    geminiVoiceId: "aria",
    tier: "tier3" as VoiceTier,
    description: "US Female Voice",
  },
  gemini_asha: {
    id: "gemini_asha",
    name: "Asha",
    nameMm: "အာရှာ",
    gender: "female" as const,
    geminiVoiceId: "asha",
    tier: "tier3" as VoiceTier,
    description: "Indian Female Voice",
  },
  gemini_b中年: {
    id: "gemini_b中年",
    name: "B中年人",
    nameMm: "ဘင်္ဂလား",
    gender: "male" as const,
    geminiVoiceId: "B中年",
    tier: "tier3" as VoiceTier,
    description: "B中年 Male Voice",
  },
  gemini_dustin: {
    id: "gemini_dustin",
    name: "Dustin",
    nameMm: "ဒါစတင်",
    gender: "male" as const,
    geminiVoiceId: "dustin",
    tier: "tier3" as VoiceTier,
    description: "US Male Voice",
  },
  gemini_emma: {
    id: "gemini_emma",
    name: "Emma",
    nameMm: "အမ်မာ",
    gender: "female" as const,
    geminiVoiceId: "emma",
    tier: "tier3" as VoiceTier,
    description: "British Female Voice",
  },
  gemini_eric: {
    id: "gemini_eric",
    name: "Eric",
    nameMm: "အီရစ်",
    gender: "male" as const,
    geminiVoiceId: "eric",
    tier: "tier3" as VoiceTier,
    description: "US Male Voice",
  },
  gemini_female_01: {
    id: "gemini_female_01",
    name: "Luna",
    nameMm: "လူနာ",
    gender: "female" as const,
    geminiVoiceId: "female_01",
    tier: "tier3" as VoiceTier,
    description: "Female Voice 1",
  },
  gemini_female_02: {
    id: "gemini_female_02",
    name: "Sophia",
    nameMm: "စိုဖီအာ",
    gender: "female" as const,
    geminiVoiceId: "female_02",
    tier: "tier3" as VoiceTier,
    description: "Female Voice 2",
  },
  gemini_kokoro: {
    id: "gemini_kokoro",
    name: "Kokoro",
    nameMm: "ကိုကိုရို",
    gender: "female" as const,
    geminiVoiceId: "kokoro",
    tier: "tier3" as VoiceTier,
    description: "Japanese Female Voice",
  },
  gemini_male_01: {
    id: "gemini_male_01",
    name: "Kian",
    nameMm: "ကီရာန်",
    gender: "male" as const,
    geminiVoiceId: "male_01",
    tier: "tier3" as VoiceTier,
    description: "Male Voice 1",
  },
  gemini_male_02: {
    id: "gemini_male_02",
    name: "Adrian",
    nameMm: "အဒရီအန်",
    gender: "male" as const,
    geminiVoiceId: "male_02",
    tier: "tier3" as VoiceTier,
    description: "Male Voice 2",
  },
  gemini_male_03: {
    id: "gemini_male_03",
    name: "Berk",
    nameMm: "ဘားက်",
    gender: "male" as const,
    geminiVoiceId: "male_03",
    tier: "tier3" as VoiceTier,
    description: "Male Voice 3",
  },
  gemini_puck: {
    id: "gemini_puck",
    name: "Puck",
    nameMm: "ပတ်ခ်",
    gender: "male" as const,
    geminiVoiceId: "puck",
    tier: "tier3" as VoiceTier,
    description: "US Male Voice",
  },
  gemini_soren: {
    id: "gemini_soren",
    name: "Soren",
    nameMm: "စိုးရင်",
    gender: "male" as const,
    geminiVoiceId: "soren",
    tier: "tier3" as VoiceTier,
    description: "Danish Male Voice",
  },
  gemini_studio_female: {
    id: "gemini_studio_female",
    name: "Serena",
    nameMm: "စီရီနာ",
    gender: "female" as const,
    geminiVoiceId: "studio_female",
    tier: "tier3" as VoiceTier,
    description: "Studio Female Voice",
  },
  gemini_studio_male: {
    id: "gemini_studio_male",
    name: "James",
    nameMm: "ဂျိမ်းစ်",
    gender: "male" as const,
    geminiVoiceId: "studio_male",
    tier: "tier3" as VoiceTier,
    description: "Studio Male Voice",
  },
} as const;

// ─── Combined Voices Map ───────────────────────────────────────────────────────
export const ALL_VOICES = {
  ...TIER1_VOICES,
  ...TIER2_VOICES,
  ...TIER3_VOICES,
} as const;

export type VoiceId = keyof typeof ALL_VOICES;
export type Tier1VoiceId = keyof typeof TIER1_VOICES;
export type Tier2VoiceId = keyof typeof TIER2_VOICES;
export type Tier3VoiceId = keyof typeof TIER3_VOICES;

// ─── Credit Costs ─────────────────────────────────────────────────────────────
export const VOICE_CREDITS: Record<VoiceTier, number> = {
  tier1: 1,
  tier2: 3,
  tier3: 3,
};

export function getVoiceCredits(voiceId: VoiceId): number {
  const voice = ALL_VOICES[voiceId];
  return voice ? VOICE_CREDITS[voice.tier] : 1;
}

export function getVoiceTier(voiceId: VoiceId): VoiceTier {
  return ALL_VOICES[voiceId]?.tier ?? "tier1";
}

export function isVoiceInTier(voiceId: VoiceId, tier: VoiceTier): boolean {
  return getVoiceTier(voiceId) === tier;
}

// ─── Voice Selection Helpers ───────────────────────────────────────────────────
export function getVoicesByTier(tier: VoiceTier): Array<typeof ALL_VOICES[VoiceId]> {
  const tierVoices: Array<typeof ALL_VOICES[VoiceId]> = [];
  for (const voice of Object.values(ALL_VOICES)) {
    if (voice.tier === tier) tierVoices.push(voice);
  }
  return tierVoices;
}

export function getMalesByTier(tier: VoiceTier): Array<typeof ALL_VOICES[VoiceId]> {
  return getVoicesByTier(tier).filter(v => v.gender === "male");
}

export function getFemalesByTier(tier: VoiceTier): Array<typeof ALL_VOICES[VoiceId]> {
  return getVoicesByTier(tier).filter(v => v.gender === "female");
}
