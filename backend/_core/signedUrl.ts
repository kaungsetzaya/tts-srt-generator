/**
 * Signed Download URL Generator
 * Creates HMAC-signed, time-limited download links for video files.
 * Separated from index.ts to avoid circular imports (videoDubber Ã¢â€ â€™ index Ã¢â€ â€™ routers Ã¢â€ â€™ videoDubber).
 */
import { createHmac } from "crypto";

/**
 * Generate a signed download URL for a file in static/downloads/.
 * The link expires after 1 hour.
 */
export function generateSignedDownloadUrl(filename: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required for download URL signing");
  }
  const baseUrl = process.env.BASE_URL || "https://choco.de5.net";
  // Links expire after 1 hour
  const expiry = String(Date.now() + 60 * 60 * 1000);
  const signature = createHmac("sha256", secret)
    .update(`${filename}:${expiry}`)
    .digest("hex")
    .slice(0, 32);
  const token = `${signature}-${expiry}`;
  return `${baseUrl}/downloads/${token}/${filename}`;
}
