import { randomBytes } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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
