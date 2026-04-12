/**
 * Cobalt.tools API integration for YouTube downloads
 * Fallback when yt-dlp fails due to bot detection
 */

import { promises as fs } from 'fs';

const COBALT_API_URL = process.env.COBALT_API_URL || "https://api.cobalt.tools/api/json";
const COBALT_API_KEY = process.env.COBALT_API_KEY || ""; // Optional for public instance

interface CobaltRequest {
  url: string;
  vQuality?: "144" | "240" | "360" | "480" | "720" | "1080" | "1440" | "2160" | "max";
  aFormat?: "best" | "mp3" | "ogg" | "wav" | "opus";
  filenamePattern?: "classic" | "pretty" | "basic" | "nerdy";
  isAudioOnly?: boolean;
}

interface CobaltResponse {
  status: "tunnel" | "redirect" | "error";
  url?: string;
  text?: string;
  error?: {
    code: string;
  };
}

/**
 * Download YouTube video using Cobalt API
 * Returns download URL or null if failed
 */
export async function getCobaltDownloadUrl(
  youtubeUrl: string,
  options: { audioOnly?: boolean; quality?: string } = {}
): Promise<string | null> {
  try {
    console.log(`[Cobalt] Requesting download for: ${youtubeUrl}`);

    const body: CobaltRequest = {
      url: youtubeUrl,
      vQuality: (options.quality as any) || "480",
      aFormat: "best",
      filenamePattern: "pretty",
      isAudioOnly: options.audioOnly || false,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    if (COBALT_API_KEY) {
      headers["Authorization"] = `Api-Key ${COBALT_API_KEY}`;
    }

    const response = await fetch(COBALT_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[Cobalt] API error: ${response.status}`);
      return null;
    }

    const data: CobaltResponse = await response.json();

    if (data.status === "error") {
      console.error(`[Cobalt] Error: ${data.error?.code || "unknown"}`);
      return null;
    }

    if (data.status === "redirect" && data.url) {
      console.log(`[Cobalt] Got redirect URL`);
      return data.url;
    }

    if (data.status === "tunnel" && data.url) {
      console.log(`[Cobalt] Got tunnel/stream URL`);
      return data.url;
    }

    return null;
  } catch (error: any) {
    console.error(`[Cobalt] Request failed: ${error.message}`);
    return null;
  }
}

/**
 * Download video file from Cobalt URL and return as buffer
 */
export async function downloadWithCobalt(
  youtubeUrl: string,
  options: { audioOnly?: boolean; maxSizeMB?: number } = {}
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const downloadUrl = await getCobaltDownloadUrl(youtubeUrl, options);
  
  if (!downloadUrl) {
    return null;
  }

  try {
    console.log(`[Cobalt] Downloading from: ${downloadUrl.slice(0, 50)}...`);
    
    const response = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.error(`[Cobalt] Download failed: ${response.status}`);
      return null;
    }

    const contentLength = response.headers.get("content-length");
    const sizeMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : 0;
    
    if (options.maxSizeMB && sizeMB > options.maxSizeMB) {
      console.error(`[Cobalt] File too large: ${sizeMB.toFixed(1)}MB > ${options.maxSizeMB}MB`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const contentType = response.headers.get("content-type") || 
                       (options.audioOnly ? "audio/mp3" : "video/mp4");

    console.log(`[Cobalt] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);
    
    return { buffer, mimeType: contentType };
  } catch (error: any) {
    console.error(`[Cobalt] Download error: ${error.message}`);
    return null;
  }
}
