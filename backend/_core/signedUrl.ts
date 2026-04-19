/**
 * Signed Download URL Generator
 * Creates HMAC-signed, time-limited download links for video files.
 * Separated from index.ts to avoid circular imports (videoDubber → index → routers → videoDubber).
 */
import { createHmac } from "crypto";

/**
 * Generate a signed download URL for a file in static/downloads/.
 * The link expires after 1 hour.
 */
export function generateSignedDownloadUrl(filename: string): string {
  const secret = process.env.JWT_SECRET || "fallback-download-secret";
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
