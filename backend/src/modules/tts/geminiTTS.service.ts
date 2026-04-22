import { TIER3_VOICES, type Tier3VoiceId } from "./voices";

const GEMINI_MODEL = "gemini-3.1-flash-tts-preview";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function generateGeminiSpeech(
  text: string,
  voiceId: Tier3VoiceId,
  maxRetries = 3
): Promise<{ audioBuffer: Buffer; durationMs: number }> {
  const voice = TIER3_VOICES[voiceId];
  if (!voice) throw new Error(`Unknown Tier 3 voice: ${voiceId}`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const promptText = `[Director's Note: natural Burmese spoken tone] ${text}`;

  const requestBody = {
    contents: [{
      parts: [{ text: promptText }]
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

  let lastError;
  console.log(`[Gemini TTS] Key prefix: ${apiKey?.slice(0, 10)}...`);
  console.log(`[Gemini TTS] Request:`, JSON.stringify(requestBody, null, 2));
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[Gemini TTS] Attempt ${i + 1}...`);
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 500) {
          console.warn(`[Gemini TTS] Attempt ${i + 1} failed. Retrying...`);
          continue;
        }
        throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!audioBase64) {
        throw new Error("No audio data returned from Gemini");
      }

      const audioBuffer = Buffer.from(audioBase64, "base64");

      return {
        audioBuffer,
        durationMs: Math.round(text.length * 150),
      };

    } catch (err) {
      lastError = err;
      if (i === maxRetries - 1) throw err;
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  throw lastError;
}

export async function generateGeminiSpeechWithSRT(
  text: string,
  voiceId: Tier3VoiceId,
  aspectRatio: "9:16" | "16:9" = "16:9"
): Promise<{ audioBuffer: Buffer; srtContent: string; durationMs: number }> {
  const { audioBuffer, durationMs } = await generateGeminiSpeech(text, voiceId);
  return { audioBuffer, srtContent: "", durationMs };
}

export const geminiTTSService = {
  generateGeminiSpeech,
  generateGeminiSpeechWithSRT,
};
