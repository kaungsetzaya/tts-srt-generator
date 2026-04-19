import { randomBytes } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function getVideoInfo(url: string): Promise<{ duration: number; filesize: number } | null> {
  try {
    const { stdout } = await execFileAsync("yt-dlp", [
      "--dump-json",
      "--no-download",
      url
    ], { timeout: 60000 });
    const info = JSON.parse(stdout);
    return {
      duration: info.duration || 0,
      filesize: info.filesize || info.filesize_approx || 0
    };
  } catch (error) {
    console.error("[getVideoInfo Error]", error);
    return null;
  }
}

export async function downloadVideo(url: string, outputPath: string, options: { timeout?: number } = {}) {
  try {
    // Using yt-dlp for robust video downloading
    await execFileAsync("yt-dlp", [
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "-o", outputPath,
      url
    ], { timeout: options.timeout || 300000 });
    return { success: true };
  } catch (error: any) {
    console.error("[Download Error]", error);
    return { success: false, error: error.message };
  }
}

export function generateDownloadId(): string {
  return randomBytes(18).toString("hex");
}
