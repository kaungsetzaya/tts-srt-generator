/**
 * Cloudflare R2 Storage Service
 * S3-compatible API for storing generated videos and audio files.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
};
