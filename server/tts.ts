import { tts, getVoices } from "edge-tts";

/**
 * Supported voices mapping
 */
export const SUPPORTED_VOICES = {
  thiha: {
    name: "Thiha",
    shortName: "my-MM-ThihaNeural", // Burmese male voice
  },
  nilar: {
    name: "Nilar",
    shortName: "my-MM-NilarNeural", // Burmese female voice
  },
};

export type VoiceKey = keyof typeof SUPPORTED_VOICES;

/**
 * Generate speech audio using Edge TTS
 * @param text - Text to convert to speech
 * @param voice - Voice selection (thiha or nilar)
 * @param rate - Speech rate as percentage string (e.g., "+50%" or "-20%", default "0%")
 * @param pitch - Pitch adjustment in Hz (e.g., "+10Hz" or "-5Hz", default "0Hz")
 * @returns Audio buffer in MP3 format
 */
export async function generateSpeech(
  text: string,
  voice: VoiceKey = "thiha",
  rate: number = 1.0,
  pitch: number = 0
): Promise<Buffer> {
  const voiceConfig = SUPPORTED_VOICES[voice];
  if (!voiceConfig) {
    throw new Error(`Unsupported voice: ${voice}`);
  }

  // Convert rate (1.0 = normal) to percentage string
  // rate 1.0 = 0%, rate 1.5 = +50%, rate 0.5 = -50%
  const ratePercent = Math.round((rate - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

  // Clamp pitch to valid range and convert to Hz string
  const clampedPitch = Math.max(-20, Math.min(20, pitch));
  const pitchStr = clampedPitch >= 0 ? `+${clampedPitch}Hz` : `${clampedPitch}Hz`;

  try {
    const audioBuffer = await tts(text, {
      voice: voiceConfig.shortName,
      rate: rateStr,
      pitch: pitchStr,
    });

    return audioBuffer;
  } catch (error) {
    console.error("TTS generation error:", error);
    throw new Error(`Failed to generate speech: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Calculate approximate duration of speech in milliseconds
 * @param text - Text content
 * @param rate - Speech rate (1.0 = normal speed)
 * @returns Duration in milliseconds
 */
export function estimateSpeechDuration(text: string, rate: number = 1.0): number {
  // Average speaking rate is about 150 words per minute
  // This is approximately 400ms per word
  const wordCount = text.trim().split(/\s+/).length;
  const baseMs = wordCount * 400; // Base duration at rate 1.0
  return Math.round(baseMs / rate);
}

/**
 * Format time for SRT subtitle format (HH:MM:SS,mmm)
 */
export function formatSrtTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

/**
 * Generate SRT subtitle content from text
 * @param text - Full text content
 * @param rate - Speech rate (1.0 = normal, affects timing)
 * @param charsPerLine - Characters per subtitle line (default 42)
 * @returns SRT formatted string
 */
export function generateSRT(
  text: string,
  rate: number = 1.0,
  charsPerLine: number = 42
): string {
  const lines = text.split("\n").filter((line) => line.trim());
  const subtitles: string[] = [];
  let subtitleIndex = 1;
  let currentTime = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Split line into chunks of charsPerLine
    const chunks = line.match(new RegExp(`.{1,${charsPerLine}}`, "g")) || [line];

    for (const chunk of chunks) {
      const duration = estimateSpeechDuration(chunk, rate);
      const startTime = formatSrtTime(currentTime);
      const endTime = formatSrtTime(currentTime + duration);

      subtitles.push(`${subtitleIndex}`);
      subtitles.push(`${startTime} --> ${endTime}`);
      subtitles.push(chunk.trim());
      subtitles.push("");

      currentTime += duration;
      subtitleIndex++;
    }
  }

  return subtitles.join("\n");
}
