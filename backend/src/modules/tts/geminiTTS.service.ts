/**
 * Gemini TTS Service — Google Gemini 3.1 Flash TTS for Tier 3 voices
 */
import { TIER3_VOICES, type Tier3VoiceId } from "./voices";

interface GeminiTTSRequest {
  contents: Array<{
    parts: Array<{ text: string }>;
  }>;
  generationConfig: {
    responseModalities: string;
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: string;
        };
      };
    };
  };
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent";

/**
 * Generate speech using Google Gemini 3.1 Flash TTS
 */
export async function generateGeminiSpeech(
  text: string,
  voiceId: Tier3VoiceId,
  languageCode: string = "my-MM"
): Promise<{ audioBuffer: Buffer; durationMs: number }> {
  const voice = TIER3_VOICES[voiceId];
  if (!voice) {
    throw new Error(`Unknown Tier 3 voice: ${voiceId}`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const request: GeminiTTSRequest = {
    contents: [{
      parts: [{ text }]
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice.geminiVoiceId,
          },
        },
      },
    },
  };

  console.log(`[Gemini TTS] Generating: "${text.slice(0, 50)}..." [Voice: ${voice.name}]`);

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gemini TTS Error] HTTP ${response.status}: ${errorText.slice(0, 500)}`);
    throw new Error(`Gemini TTS API error: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Gemini TTS error: ${data.error.message}`);
  }

  // Gemini returns base64 encoded audio in the response
  const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioBase64) {
    throw new Error("No audio data in Gemini response");
  }

  const audioBuffer = Buffer.from(audioBase64, "base64");

  // Estimate duration (roughly 150 chars per second for TTS)
  const estimatedDurationMs = Math.round(text.length * (1000 / 150));

  return {
    audioBuffer,
    durationMs: estimatedDurationMs,
  };
}

/**
 * Generate speech with SRT subtitles using Gemini TTS
 */
export async function generateGeminiSpeechWithSRT(
  text: string,
  voiceId: Tier3VoiceId,
  aspectRatio: "9:16" | "16:9" = "16:9"
): Promise<{ audioBuffer: Buffer; srtContent: string; durationMs: number }> {
  const { audioBuffer, durationMs } = await generateGeminiSpeech(text, voiceId);

  // For now, return empty SRT - subtitle generation would need audio analysis
  const srtContent = "";

  return {
    audioBuffer,
    srtContent,
    durationMs,
  };
}

export const geminiTTSService = {
  generateGeminiSpeech,
  generateGeminiSpeechWithSRT,
};
