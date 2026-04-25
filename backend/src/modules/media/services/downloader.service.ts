import { randomBytes } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { isAllowedVideoUrl } from "../../../../_core/security";

const execFileAsync = promisify(execFile);

// Get proxy URL from environment (same as Edge TTS)
function getProxyUrl(): string {
  const h = process.env.EDGE_TTS_PROXY_HOST;
  const p = process.env.EDGE_TTS_PROXY_PORT;
  const u = process.env.EDGE_TTS_PROXY_USER;
  const s = process.env.EDGE_TTS_PROXY_PASS;
  return h && p && u && s ? `http://${u}:${s}@${h}:${p}` : "";
}

// Rate limiting for YouTube/Social downloads
let activeDownloads = 0;
const MAX_CONCURRENT = 2;
const downloadQueue: Array<() => Promise<any>> = [];
let processingQueue = false;
let lastYoutubeRequest = 0;

async function processQueue() {
  if (processingQueue || activeDownloads >= MAX_CONCURRENT) return;
  processingQueue = true;
  
  while (downloadQueue.length > 0 && activeDownloads < MAX_CONCURRENT) {
    const next = downloadQueue.shift();
    if (next) {
      activeDownloads++;
      next().finally(() => {
        activeDownloads--;
        processQueue();
      });
    }
  }
  processingQueue = false;
}

function queueDownload<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const wrapped = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };
    downloadQueue.push(wrapped);
    processQueue();
  });
}

// Extra delay for YouTube to avoid bot detection
function youtubeDelay() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastYoutubeRequest;
  const minDelay = 5000; // 5 seconds minimum between YouTube requests
  if (timeSinceLastRequest < minDelay) {
    return new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
  }
  return Promise.resolve();
}

// Common User-Agent
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const COOKIE_PATH = path.resolve(process.cwd(), "backend/cookies.txt");

// Supported platforms
const SUPPORTED_PLATFORMS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "facebook.com",
  "fb.watch",
  "instagram.com",
];

function isSupported(url: string): boolean {
  return SUPPORTED_PLATFORMS.some(p => url.includes(p));
}

function isYouTube(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

export async function getVideoInfo(url: string): Promise<{ duration: number; filesize: number; title?: string } | null> {
  if (!isAllowedVideoUrl(url)) {
    console.warn("[Downloader] Unsupported platform:", url);
    return null;
  }

  // Extra delay for YouTube
  if (isYouTube(url)) {
    await youtubeDelay();
    lastYoutubeRequest = Date.now();
  }

  const proxyUrl = getProxyUrl();
  const baseArgs = [
    "--user-agent", USER_AGENT,
    "--no-warnings",
    "--quiet",
    "--extractor-args", "youtube:player_client=android",
    "--add-header", "Accept-Language: en-US,en;q=0.9",
    "--dump-json",
    "--no-download",
    "--no-playlist",
    "--abort-on-unavailable-fragment",
    "--max-redirects", "3",
  ];
  
  if (proxyUrl) {
    baseArgs.push("--proxy", proxyUrl);
  }

  // Try without cookies first
  try {
    const { stdout } = await execFileAsync("yt-dlp", [...baseArgs, url], { timeout: 60000 });
    const info = JSON.parse(stdout);
    return {
      duration: info.duration || 0,
      filesize: info.filesize || info.filesize_approx || 0,
      title: info.title || ""
    };
  } catch (error) {
    console.error("[Downloader getVideoInfo Error]", error);
    
    // For YouTube, try with cookies + retry
    if (isYouTube(url)) {
      try {
        const { stdout } = await execFileAsync("yt-dlp", [
          "--cookies", COOKIE_PATH,
          ...baseArgs,
          url
        ], { timeout: 60000 });
        const info = JSON.parse(stdout);
        return {
          duration: info.duration || 0,
          filesize: info.filesize || info.filesize_approx || 0,
          title: info.title || ""
        };
      } catch (e) {
        console.error("[Downloader getVideoInfo Fallback Error]", e);
      }
    }
    return null;
  }
}

export async function downloadVideo(url: string, outputPath: string, options: { timeout?: number } = {}) {
  if (!isAllowedVideoUrl(url)) {
    return { success: false, error: "Unsupported platform. Use YouTube, TikTok, or Facebook." };
  }

  // Extra delay for YouTube
  if (isYouTube(url)) {
    await youtubeDelay();
    lastYoutubeRequest = Date.now();
  }

  // Queue downloads for multiple users
  return queueDownload(async () => {
    const proxyUrl = getProxyUrl();
    const baseArgs = [
      "--user-agent", USER_AGENT,
      "--extractor-args", "youtube:player_client=android",
      "--add-header", "Accept-Language: en-US,en;q=0.9",
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "-o", outputPath,
      "--no-playlist",
      "--abort-on-unavailable-fragment",
      "--max-redirects", "3",
    ];
    
    if (proxyUrl) {
      baseArgs.push("--proxy", proxyUrl);
    }

    try {
      await execFileAsync("yt-dlp", [...baseArgs, url], { timeout: options.timeout || 300000 });
      return { success: true };
    } catch (error: any) {
      console.error("[Downloader Error - Trying with cookies]", error);
      
      // Fallback with cookies for age-restricted
      try {
        await execFileAsync("yt-dlp", [
          "--cookies", COOKIE_PATH,
          ...baseArgs,
          url
        ], { timeout: options.timeout || 300000 });
        return { success: true };
      } catch (cookieError: any) {
        console.error("[Downloader Fallback Error]", cookieError);
        return { success: false, error: cookieError.message || "Failed to download video" };
      }
    }
  });
}

export function generateDownloadId(): string {
  return randomBytes(18).toString("hex");
}

export const downloaderService = {
  getVideoInfo,
  downloadVideo,
  generateDownloadId,
  isSupported,
};
