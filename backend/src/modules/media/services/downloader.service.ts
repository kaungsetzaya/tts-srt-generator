import { randomBytes } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execFileAsync = promisify(execFile);

// Rate limiting for YouTube/Social downloads
let activeDownloads = 0;
const MAX_CONCURRENT = 2;
const downloadQueue: Array<() => Promise<any>> = [];
let processingQueue = false;

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

// Random delay to avoid rate limiting
function randomDelay() {
  const delay = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds
  return new Promise(resolve => setTimeout(resolve, delay));
}

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

export async function getVideoInfo(url: string): Promise<{ duration: number; filesize: number; title?: string } | null> {
  if (!isSupported(url)) {
    console.warn("[Downloader] Unsupported platform:", url);
    return null;
  }

  await randomDelay(); // Rate limit info requests

  try {
    let args = [
      "--dump-json",
      "--no-download",
      url
    ];

    const { stdout } = await execFileAsync("yt-dlp", args, { timeout: 60000 });
    const info = JSON.parse(stdout);
    return {
      duration: info.duration || 0,
      filesize: info.filesize || info.filesize_approx || 0,
      title: info.title || ""
    };
  } catch (error) {
    console.error("[Downloader getVideoInfo Error]", error);
    // Try with cookies as fallback
    try {
      const { stdout } = await execFileAsync("yt-dlp", [
        "--cookies", path.resolve(process.cwd(), "backend/cookies.txt"),
        "--dump-json",
        "--no-download",
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
      return null;
    }
  }
}

export async function downloadVideo(url: string, outputPath: string, options: { timeout?: number } = {}) {
  if (!isSupported(url)) {
    return { success: false, error: "Unsupported platform. Use YouTube, TikTok, or Facebook." };
  }

  // Queue downloads for multiple users
  return queueDownload(async () => {
    await randomDelay(); // Rate limit between downloads

    try {
      let args = [
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", outputPath,
        url
      ];

      await execFileAsync("yt-dlp", args, { timeout: options.timeout || 300000 });
      return { success: true };
    } catch (error: any) {
      console.error("[Downloader Error - Trying with cookies]", error);
      
      // Fallback with cookies
      try {
        await execFileAsync("yt-dlp", [
          "--cookies", path.resolve(process.cwd(), "backend/cookies.txt"),
          "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
          "--merge-output-format", "mp4",
          "-o", outputPath,
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
