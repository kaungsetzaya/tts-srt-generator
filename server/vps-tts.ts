import axios from "axios";
import { ENV } from "./_core/env";

/**
 * VPS TTS Service - Handles communication with custom VPS Edge TTS server
 * Expects Flask API format with specific voice names and parameters
 */

interface VPSTTSRequest {
  text: string;
  voice: string;
  pitch: number;
  speed: number;
  volume: number;
  filename: string;
}

interface VPSTTSResponse {
  audio_url: string;
  srt_content?: string;
  filename: string;
}

/**
 * Map voice names from our format to VPS format
 * VPS accepts: my-MM-ThihaNeural (male), my-MM-NilarNeural (female)
 */
function mapVoiceToVPS(voice: string): string {
  const lowerVoice = voice.toLowerCase();
  
  if (lowerVoice === "nilar" || lowerVoice === "my-mm-nilar" || lowerVoice === "my-mm-nilarneural") {
    return "my-MM-NilarNeural";
  }
  
  // Default to Thiha for any other input
  return "my-MM-ThihaNeural";
}

/**
 * Generate speech using VPS Edge TTS server
 */
export async function generateSpeechVPS(
  text: string,
  voice: string,
  rate: number = 0,
  pitch: number = 0
): Promise<{ audioBuffer: Buffer; audioUrl: string; srtContent?: string }> {
  if (!ENV.vpsTtsApiUrl) {
    throw new Error("VPS_TTS_API_URL not configured");
  }

  try {
    // Generate unique filename
    const filename = `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Map voice to VPS format
    const vpsVoice = mapVoiceToVPS(voice);

    // Prepare request payload
    const payload: VPSTTSRequest = {
      text,
      voice: vpsVoice,
      pitch,
      speed: rate, // rate is already in percentage, convert to speed offset
      volume: 0, // Default volume
      filename,
    };

    // Call VPS API
    const response = await axios.post(ENV.vpsTtsApiUrl, payload, {
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200 && response.data) {
      const vpsResponse: VPSTTSResponse = response.data;

      // Fetch audio file from VPS
      // VPS returns /audio/filename.mp3, but ENV.vpsTtsAudioBaseUrl already ends with /audio/
      // So we need to extract just the filename
      const audioFilename = vpsResponse.audio_url.split('/').pop() || vpsResponse.audio_url;
      const audioUrl = `${ENV.vpsTtsAudioBaseUrl}${audioFilename}`;
      
      const audioResponse = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
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

/**
 * Check VPS TTS server health
 */
export async function checkVPSTTSHealth(): Promise<boolean> {
  if (!ENV.vpsTtsHealthCheckUrl) {
    console.warn("VPS_TTS_HEALTH_CHECK_URL not configured");
    return false;
  }

  try {
    const response = await axios.get(ENV.vpsTtsHealthCheckUrl, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch (error) {
    console.error(
      "VPS TTS health check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return false;
  }
}

/**
 * Get audio URL from VPS server
 */
export function getVPSAudioUrl(audioPath: string): string {
  if (!ENV.vpsTtsAudioBaseUrl) {
    throw new Error("VPS_TTS_AUDIO_BASE_URL not configured");
  }

  // Remove leading slash if present
  const cleanPath = audioPath.startsWith("/") ? audioPath.slice(1) : audioPath;
  return `${ENV.vpsTtsAudioBaseUrl}${cleanPath}`;
}
