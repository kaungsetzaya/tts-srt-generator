/**
 * Voice Definitions Ã¢â‚¬â€ Tier-based voice system
 *
 * Tier 1: Edge-TTS Myanmar voices (Thiha, Nilar) - Free
 * Tier 2: Murf AI voices (Character voices) - Premium
 * Tier 3: Google Gemini 3.1 Flash TTS voices - Premium
 */

export type VoiceTier = "tier1" | "tier2" | "tier3";

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Tier 1: Edge-TTS Myanmar Voices Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export const TIER1_VOICES = {
  thiha: {
    id: "thiha",
    name: "Thiha",
    nameMm: "Ã¡â‚¬Å¾Ã¡â‚¬Â®Ã¡â‚¬Å¸",
    gender: "male" as const,
    edgeVoice: "my-MM-ThihaNeural",
    tier: "tier1" as VoiceTier,
    description: "Myanmar Male Voice",
  },
  nilar: {
    id: "nilar",
    name: "Nilar",
    nameMm: "Ã¡â‚¬â€Ã¡â‚¬Â®Ã¡â‚¬Å“Ã¡â‚¬Â¬",
    gender: "female" as const,
    edgeVoice: "my-MM-NilarNeural",
    tier: "tier1" as VoiceTier,
    description: "Myanmar Female Voice",
  },
} as const;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Tier 2: Murf AI Character Voices Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export const TIER2_VOICES = {
  ryan: {
    id: "ryan",
    name: "Ryan",
    nameMm: "Ã¡â‚¬â€ºÃ¡â‚¬Â²Ã¡â‚¬â€ºÃ¡â‚¬â€žÃ¡â‚¬Â·Ã¡â‚¬Âº",
    gender: "male" as const,
    murfId: "en-US-ryan",
    baseVoice: "thiha" as const,
    tier: "tier2" as VoiceTier,
    description: "American Male Voice",
  },
  ronnie: {
    id: "ronnie",
    name: "Ronnie",
    nameMm: "Ã¡â‚¬â€ºÃ¡â‚¬Â±Ã¡â‚¬Â¬Ã¡â‚¬â€žÃ¡â‚¬ÂºÃ¡â‚¬â€Ã¡â‚¬Â®",
    gender: "male" as const,
    murfId: "en-US-ronnie",
    baseVoice: "thiha" as const,
    tier: "tier2" as VoiceTier,
    description: "British Male Voice",
  },
  lucas: {
    id: "lucas",
    name: "Lucas",
    nameMm: "Ã¡â‚¬Å“Ã¡â‚¬â€žÃ¡â‚¬ÂºÃ¡â‚¬Â¸Ã¡â‚¬ÂÃ¡â‚¬â€Ã¡â‚¬Â·Ã¡â‚¬Âº",
    gender: "male" as const,
    murfId: "en-US-lucas",
    baseVoice: "thiha" as const,
    tier: "tier2" as VoiceTier,
    description: "Australian Male Voice",
  },
  daniel: {
    id: "daniel",
    name: "Daniel",
    nameMm: "Ã¡â‚¬â€™Ã¡â‚¬Â±Ã¡â‚¬Â",
    gender: "male" as const,
    murfId: "en-US-daniel",
    baseVoice: "thiha" as const,
    tier: "tier2" as VoiceTier,
    description: "British Male Voice",
  },
  evander: {
    id: "evander",
    name: "Evander",
    nameMm: "Ã¡â‚¬Â¡Ã¡â‚¬â€šÃ¡â‚¬Â¹Ã¡â‚¬â€š",
    gender: "male" as const,
    murfId: "en-US-evander",
    baseVoice: "thiha" as const,
    tier: "tier2" as VoiceTier,
    description: "American Male Voice",
  },
  michelle: {
    id: "michelle",
    name: "Michelle",
    nameMm: "Ã¡â‚¬â„¢Ã¡â‚¬Â±Ã¡â‚¬ÂÃ¡â‚¬Â»Ã¡â‚¬Â­Ã¡â‚¬Â¯",
    gender: "female" as const,
    murfId: "en-US-michelle",
    baseVoice: "nilar" as const,
    tier: "tier2" as VoiceTier,
    description: "American Female Voice",
  },
  iris: {
    id: "iris",
    name: "Iris",
    nameMm: "Ã¡â‚¬Â¡Ã¡â‚¬Â­Ã¡â‚¬â€Ã¡â‚¬Â¹Ã¡â‚¬â€™Ã¡â‚¬Â¼Ã¡â‚¬Â¬",
    gender: "female" as const,
    murfId: "en-US-iris",
    baseVoice: "nilar" as const,
    tier: "tier2" as VoiceTier,
    description: "Irish Female Voice",
  },
  charlotte: {
    id: "charlotte",
    name: "Charlotte",
    nameMm: "Ã¡â‚¬Å¾Ã¡â‚¬Â®Ã¡â‚¬â€ºÃ¡â‚¬Â­",
    gender: "female" as const,
    murfId: "en-US-charlotte",
    baseVoice: "nilar" as const,
    tier: "tier2" as VoiceTier,
    description: "British Female Voice",
  },
  amara: {
    id: "amara",
    name: "Amara",
    nameMm: "Ã¡â‚¬Â¡Ã¡â‚¬â„¢Ã¡â‚¬â€ºÃ¡â‚¬Â¬",
    gender: "female" as const,
    murfId: "en-US-amara",
    baseVoice: "nilar" as const,
    tier: "tier2" as VoiceTier,
    description: "African Female Voice",
  },
} as const;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Tier 3: Google Gemini 3.1 Flash TTS Voices Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export const TIER3_VOICES = {
  gemini_puck: {
    id: "gemini_puck",
    name: "Puck",
    nameMm: "ပက်က်စ်",
    gender: "male" as const,
    geminiVoiceId: "Puck",
    tier: "tier3" as VoiceTier,
    description: "US Male Voice",
  },
  gemini_charon: {
    id: "gemini_charon",
    name: "Charon",
    nameMm: "ခရောန်",
    gender: "male" as const,
    geminiVoiceId: "Charon",
    tier: "tier3" as VoiceTier,
    description: "US Male Voice",
  },
  gemini_kore: {
    id: "gemini_kore",
    name: "Kore",
    nameMm: "ကိုရဲ",
    gender: "male" as const,
    geminiVoiceId: "Kore",
    tier: "tier3" as VoiceTier,
    description: "US Male Voice",
  },
  gemini_fenrir: {
    id: "gemini_fenrir",
    name: "Fenrir",
    nameMm: "ဖေနရ်စ်",
    gender: "male" as const,
    geminiVoiceId: "Fenrir",
    tier: "tier3" as VoiceTier,
    description: "US Male Voice",
  },
  gemini_aoede: {
    id: "gemini_aoede",
    name: "Aoede",
    nameMm: "အိုအီးဒီ",
    gender: "female" as const,
    geminiVoiceId: "Aoede",
    tier: "tier3" as VoiceTier,
    description: "US Female Voice",
  },
  gemini_callirrhoe: {
    id: "gemini_callirrhoe",
    name: "Callirrhoe",
    nameMm: "ကယ်လ်ရိုရဲ",
    gender: "female" as const,
    geminiVoiceId: "Callirrhoe",
    tier: "tier3" as VoiceTier,
    description: "US Female Voice",
  },
  gemini_dione: {
    id: "gemini_dione",
    name: "Dione",
    nameMm: "ဒိုအီနဲ",
    gender: "female" as const,
    geminiVoiceId: "Dione",
    tier: "tier3" as VoiceTier,
    description: "US Female Voice",
  },
  gemini_enceladus: {
    id: "gemini_enceladus",
    name: "Enceladus",
    nameMm: "အန်စီလေးဒက်စ်",
    gender: "female" as const,
    geminiVoiceId: "Enceladus",
    tier: "tier3" as VoiceTier,
    description: "US Female Voice",
  },
} as const;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Combined Voices Map Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export const ALL_VOICES = {
  ...TIER1_VOICES,
  ...TIER2_VOICES,
  ...TIER3_VOICES,
} as const;

export type VoiceId = keyof typeof ALL_VOICES;
export type Tier1VoiceId = keyof typeof TIER1_VOICES;
export type Tier2VoiceId = keyof typeof TIER2_VOICES;
export type Tier3VoiceId = keyof typeof TIER3_VOICES;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Credit Costs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Voice Selection Helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
