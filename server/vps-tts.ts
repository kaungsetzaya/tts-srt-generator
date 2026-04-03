import axios from "axios";
import { ENV } from "./_core/env";

interface VPSTTSRequest {
  text: string;
  voice: string;
  pitch: number;
  speed: number;
  volume: number;
  filename: string;
  aspect_ratio: string;
}

interface VPSTTSResponse {
  audio_url: string;
  srt_content?: string;
  filename: string;
}

function mapVoiceToVPS(voice: string): string {
  const lowerVoice = voice.toLowerCase();
  if (lowerVoice === "nilar" || lowerVoice === "my-mm-nilar" || lowerVoice === "my-mm-nilarneural") {
    return "my-MM-NilarNeural";
  }
  return "my-MM-ThihaNeural";
}

export async function generateSpeechVPS(
  text: string,
  voice: string,
  rate: number = 0,
  pitch: number = 0,
  aspectRatio: string = "16:9"
): Promise<{ audioBuffer: Buffer; audioUrl: string; srtContent?: string }> {
  if (!ENV.vpsTtsApiUrl) {
    throw new Error("VPS_TTS_API_URL not configured");
  }

  try {
    const filename = `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const vpsVoice = mapVoiceToVPS(voice);

    const payload: VPSTTSRequest = {
      text,
      voice: vpsVoice,
      pitch,
      speed: rate,
      volume: 0,
      filename,
      aspect_ratio: aspectRatio,
    };

    const response = await axios.post(ENV.vpsTtsApiUrl, payload, {
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200 && response.data) {
      const vpsResponse: VPSTTSResponse = response.data;

      const audioFilename = vpsResponse.audio_url.split('/').pop() || vpsResponse.audio_url;
      const audioUrl = `${ENV.vpsTtsAudioBaseUrl}${audioFilename}`;

      const audioResponse = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
      });

      return {
        audioBuffer: Buffer.from(audioResponse.data as ArrayBuffer),
        audioUrl: audioUrl,
        srtContent: vpsResponse.srt_content,
      };
    } else {
      throw new Error(`VPS TTS API returned status ${response.status}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMsg =
        error.response?.data?.error || error.response?.statusText || error.message;
      throw new Error(`VPS TTS API error: ${error.response?.status} - ${errorMsg}`);
    }
    throw new Error(
      `Failed to generate speech from VPS: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function checkVPSTTSHealth(): Promise<boolean> {
  if (!ENV.vpsTtsHealthCheckUrl) {
    console.warn("VPS_TTS_HEALTH_CHECK_URL not configured");
    return false;
  }
  try {
    const response = await axios.get(ENV.vpsTtsHealthCheckUrl, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    console.error("VPS TTS health check failed:", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
}

export function getVPSAudioUrl(audioPath: string): string {
  if (!ENV.vpsTtsAudioBaseUrl) {
    throw new Error("VPS_TTS_AUDIO_BASE_URL not configured");
  }
  const cleanPath = audioPath.startsWith("/") ? audioPath.slice(1) : audioPath;
  return `${ENV.vpsTtsAudioBaseUrl}${cleanPath}`;
}
