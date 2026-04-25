/**
 * Signed Download URL Generator
 * Creates HMAC-signed, time-limited download links for video files.
 * Falls back to Cloudflare R2 signed URLs when R2 is configured.
 * Separated from index.ts to avoid circular imports.
 */
import { createHmac } from "crypto";
import { r2Service, r2Key } from "../src/modules/media/services/r2.service";

/**
 * Generate a signed download URL for a file.
 * Uses R2 when configured and userId is provided, otherwise falls back to local HMAC signing.
 * Links expire after 1 hour.
 */
export async function generateSignedDownloadUrl(
  filename: string,
  userId?: string,
  type: "video" | "audio" | "subtitle" | "asset" | "template" = "video"
): Promise<string> {
  // Try R2 first if configured
  if (r2Service.isEnabled()) {
    const needsUserId = type !== "asset" && type !== "template";
    if (!needsUserId || userId) {
      const key = r2Key(type, filename, userId);
      return r2Service.getSignedDownloadUrl(key, 3600);
    }
    // If userId missing for user-content, fall through to local HMAC
  }

  // Fallback: local HMAC-signed URL
  const secret = process.env.DOWNLOAD_SECRET;
  if (!secret) {
    throw new Error("DOWNLOAD_SECRET is required for download URL signing");
  }
  const baseUrl = process.env.BASE_URL || "https://choco.de5.net";
  const expiry = String(Date.now() + 60 * 60 * 1000);
  // Use full 64-char HMAC for max security
  const signature = createHmac("sha256", secret)
    .update(`${filename}:${expiry}`)
    .digest("hex");
  // Use underscore delimiter to avoid filename conflicts (filenames may contain hyphens)
  const token = `${signature}_${expiry}`;
  return `${baseUrl}/downloads/${token}/${filename}`;
}
