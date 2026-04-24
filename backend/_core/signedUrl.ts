/**
 * Signed Download URL Generator
 * Creates HMAC-signed, time-limited download links for video files.
 * Falls back to Cloudflare R2 signed URLs when R2 is configured.
 * Separated from index.ts to avoid circular imports.
 */
import { createHmac } from "crypto";
import { r2Service } from "../src/modules/media/services/r2.service";

/**
 * Generate a signed download URL for a video file.
 * Uses R2 when configured, otherwise falls back to local HMAC signing.
 * Links expire after 1 hour.
 */
export async function generateSignedDownloadUrl(filename: string): Promise<string> {
  // Try R2 first if configured
  if (r2Service.isEnabled()) {
    return r2Service.getSignedDownloadUrl(filename, 3600);
  }

  // Fallback: local HMAC-signed URL
  const secret = process.env.DOWNLOAD_SECRET;
  if (!secret) {
    throw new Error("DOWNLOAD_SECRET is required for download URL signing");
  }
  const baseUrl = process.env.BASE_URL || "https://choco.de5.net";
  const expiry = String(Date.now() + 60 * 60 * 1000);
  const signature = createHmac("sha256", secret)
    .update(`${filename}:${expiry}`)
    .digest("hex")
    .slice(0, 32);
  const token = `${signature}-${expiry}`;
  return `${baseUrl}/downloads/${token}/${filename}`;
}
