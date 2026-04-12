/**
 * Multi-platform video downloader (YouTube, TikTok, Facebook)
 * Uses yt-dlp with platform-specific strategies
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execFileAsync = promisify(execFile);

interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
  platform?: string;
}

function detectPlatform(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('shorts/')) {
    return 'youtube';
  }
  if (url.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (url.includes('facebook.com') || url.includes('fb.watch')) {
    return 'facebook';
  }
  return 'unknown';
}

function getDownloadStrategies(platform: string, cookiePath?: string): string[][] {
  const strategies: string[][] = [];
  
  // Base options
  const baseOptions = [
    "--no-check-certificates",
    "--no-playlist",
    "--no-warnings",
    "--max-filesize", "100M",
    "--socket-timeout", "60",
    "--retries", "2",
  ];

  if (platform === 'youtube') {
    // YouTube - most aggressive anti-bot
    if (cookiePath) {
      strategies.push(
        [...baseOptions, "--cookies", cookiePath, "-f", "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b", "--merge-output-format", "mp4"],
        [...baseOptions, "--cookies", cookiePath, "--extractor-args", "youtube:player_client=tv", "-f", "b[ext=mp4]/b", "--merge-output-format", "mp4"],
        [...baseOptions, "--cookies", cookiePath, "--extractor-args", "youtube:player_client=web_creator", "-f", "b", "--recode-video", "mp4"],
      );
    }
    // No cookies fallback
    strategies.push(
      [...baseOptions, "-f", "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b", "--merge-output-format", "mp4"],
      [...baseOptions, "--extractor-args", "youtube:player_client=tv", "-f", "b[ext=mp4]/b", "--merge-output-format", "mp4"],
      [...baseOptions, "--extractor-args", "youtube:player_client=mweb", "-f", "b", "--recode-video", "mp4"],
      [...baseOptions, "-f", "worst[ext=mp4]/worst", "--recode-video", "mp4"],
    );
  } else if (platform === 'tiktok') {
    // TikTok - less aggressive
    if (cookiePath) {
      strategies.push([...baseOptions, "--cookies", cookiePath, "-f", "bv*+ba/b", "--merge-output-format", "mp4"]);
    }
    strategies.push(
      [...baseOptions, "-f", "bv*+ba/b", "--merge-output-format", "mp4"],
      [...baseOptions, "-f", "b", "--recode-video", "mp4"],
      [...baseOptions, "-f", "worst", "--recode-video", "mp4"],
    );
  } else if (platform === 'facebook') {
    // Facebook
    if (cookiePath) {
      strategies.push([...baseOptions, "--cookies", cookiePath, "-f", "bv*+ba/b", "--merge-output-format", "mp4"]);
    }
    strategies.push(
      [...baseOptions, "-f", "bv*+ba/b", "--merge-output-format", "mp4"],
      [...baseOptions, "-f", "b", "--recode-video", "mp4"],
      [...baseOptions, "-f", "worst", "--recode-video", "mp4"],
    );
  } else {
    // Generic fallback
    strategies.push(
      [...baseOptions, "-f", "bv*+ba/b", "--merge-output-format", "mp4"],
      [...baseOptions, "-f", "b", "--recode-video", "mp4"],
    );
  }

  return strategies;
}

export async function downloadVideo(
  url: string,
  outputPath: string,
  options: { cookiesPath?: string; timeout?: number } = {}
): Promise<DownloadResult> {
  const platform = detectPlatform(url);
  
  if (platform === 'unknown') {
    return { success: false, error: "Unsupported platform. Use YouTube, TikTok, or Facebook." };
  }

  const cookiePath = options.cookiesPath;
  const strategies = getDownloadStrategies(platform, cookiePath);
  
  console.log(`[Downloader] Platform: ${platform}, Strategies: ${strategies.length}`);

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    const hasCookies = strategy.includes("--cookies");
    const label = hasCookies ? "Cookies" : "NoCookies";
    
    console.log(`[Downloader] Strategy ${i + 1}/${strategies.length} [${label}]...`);

    try {
      await execFileAsync("yt-dlp", [
        ...strategy,
        "-o", outputPath,
        url
      ], { timeout: options.timeout || 300000 });

      const stat = await fs.stat(outputPath).catch(() => null);
      if (stat && stat.size > 10000) {
        console.log(`[Downloader] ✅ Success (${Math.round(stat.size / 1024 / 1024 * 10) / 10}MB)`);
        return { success: true, filePath: outputPath, platform };
      }
    } catch (e: any) {
      const errorMsg = e.message?.slice(0, 100) || "Unknown error";
      console.log(`[Downloader] Strategy ${i + 1} failed: ${errorMsg}`);
      
      // Skip remaining if auth required
      if (errorMsg.includes("Sign in") || errorMsg.includes("login") || errorMsg.includes("age")) {
        console.log(`[Downloader] Auth/age restricted - skipping remaining strategies`);
        break;
      }
    }

    // Delay between retries
    if (i < strategies.length - 1) {
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }

  return { success: false, error: "All download strategies failed", platform };
}
