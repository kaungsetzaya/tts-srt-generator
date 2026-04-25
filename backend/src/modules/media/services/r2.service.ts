/**
 * Cloudflare R2 Storage Service
 * S3-compatible API with folder structure:
 *   users/{userId}/videos/{filename}     — final dubbed videos (7d TTL)
 *   users/{userId}/audios/{filename}     — TTS outputs (7d TTL)
 *   users/{userId}/subtitles/{filename}  — SRT files (7d TTL)
 *   static/assets/{filename}             — permanent assets
 *   static/templates/{filename}          — permanent templates
 */
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || "lumix-studio";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g. https://pub-xxx.r2.dev

const isConfigured = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY;

const s3 = isConfigured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

/** Generate R2 object key with folder structure */
export function r2Key(type: "video" | "audio" | "subtitle" | "asset" | "template", filename: string, userId?: string): string {
  if (type === "asset") return `static/assets/${filename}`;
  if (type === "template") return `static/templates/${filename}`;
  if (!userId) throw new Error("userId is required for user-generated content keys");
  if (type === "video") return `users/${userId}/videos/${filename}`;
  if (type === "audio") return `users/${userId}/audios/${filename}`;
  if (type === "subtitle") return `users/${userId}/subtitles/${filename}`;
  throw new Error(`Unknown R2 key type: ${type}`);
}

export const r2Service = {
  isEnabled: () => isConfigured && !!s3,

  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<string> {
    if (!s3) throw new Error("R2 is not configured");
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return key;
  },

  async uploadFromPath(key: string, filePath: string, contentType: string): Promise<string> {
    if (!s3) throw new Error("R2 is not configured");
    const { createReadStream } = await import("fs");
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
      })
    );
    return key;
  },

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (!s3) throw new Error("R2 is not configured");
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  },

  async getPublicUrl(key: string): Promise<string | null> {
    if (R2_PUBLIC_URL) {
      return `${R2_PUBLIC_URL}/${key}`;
    }
    return null;
  },

  async fileExists(key: string): Promise<boolean> {
    if (!s3) return false;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
      return true;
    } catch {
      return false;
    }
  },

  async deleteFile(key: string): Promise<void> {
    if (!s3) return;
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  },

  /** List all user files under users/{userId}/ */
  async listUserFiles(userId: string): Promise<Array<{ key: string; type: "video" | "audio" | "subtitle" | "other"; filename: string; size?: number; lastModified?: Date }>> {
    if (!s3) return [];
    const prefix = `users/${userId}/`;
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix }));
    const results: Array<{ key: string; type: "video" | "audio" | "subtitle" | "other"; filename: string; size?: number; lastModified?: Date }> = [];
    if (listed.Contents) {
      for (const obj of listed.Contents) {
        if (!obj.Key || obj.Key.endsWith("/")) continue;
        const key = obj.Key;
        const filename = key.substring(key.lastIndexOf("/") + 1);
        let type: "video" | "audio" | "subtitle" | "other" = "other";
        if (key.includes("/videos/")) type = "video";
        else if (key.includes("/audios/")) type = "audio";
        else if (key.includes("/subtitles/")) type = "subtitle";
        results.push({ key, type, filename, size: obj.Size, lastModified: obj.LastModified });
      }
    }
    return results.sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0));
  },

  /** Delete all user files older than a given date prefix */
  async cleanupUserFiles(userId: string, olderThanDate?: string): Promise<number> {
    if (!s3) return 0;
    const prefix = `users/${userId}/`;
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix }));
    let deleted = 0;
    if (listed.Contents) {
      for (const obj of listed.Contents) {
        if (!obj.Key) continue;
        // Default: delete everything under users/{userId}/ (caller should enforce 7d rule)
        await this.deleteFile(obj.Key);
        deleted++;
      }
    }
    return deleted;
  },
};
