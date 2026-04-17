import { randomUUID } from "crypto";
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import ffmpeg from 'fluent-ffmpeg';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { geminiTranslate } from "./geminiTranslator";
import { downloadVideo } from "./_core/multiDownloader";
import { isAllowedVideoUrl, isPathWithinDir, sanitizeForAI } from "./_core/security";

const execFileAsync = promisify(execFile);

// ------------------ Extract Audio ------------------
async function extractAudio(videoBuffer: Buffer): Promise<string> {
    // 🔐 UUID filenames
    const id = randomUUID();
    const tempVideoPath = path.join(tmpdir(), `vt_in_${id}.mp4`);
    const tempAudioPath = path.join(tmpdir(), `vt_aud_${id}.mp3`);

    // 🔐 Path traversal check
    if (!isPathWithinDir(tempVideoPath, tmpdir()) || !isPathWithinDir(tempAudioPath, tmpdir())) {
        throw new Error("Invalid temp directory.");
    }

    await fs.writeFile(tempVideoPath, videoBuffer);

    return new Promise((resolve, reject) => {
        ffmpeg(tempVideoPath)
            .noVideo()
            .audioCodec('libmp3lame')
            .on('end', async () => {
                await fs.unlink(tempVideoPath).catch(() => {});
                resolve(tempAudioPath);
            })
            .on('error', async (err) => {
                await fs.unlink(tempVideoPath).catch(() => {});
                reject(err);
            })
            .save(tempAudioPath);
    });
}

// ------------------ Whisper — execFile with argument array ------------------
async function transcribeLocalWhisper(audioPath: string): Promise<{ text: string, srt: string }> {
    const outputDir = path.dirname(audioPath);
    const baseName = path.parse(audioPath).name;

    // 🔐 FFmpeg Command Guard: execFile with argument array
    await execFileAsync("whisper", [
        audioPath,
        "--model", "base",
        "--output_dir", outputDir,
        "--output_format", "all"
    ]);

    const textPath = path.join(outputDir, `${baseName}.txt`);
    const srtPath = path.join(outputDir, `${baseName}.srt`);

    // 🔐 Path traversal check
    if (!isPathWithinDir(textPath, outputDir) || !isPathWithinDir(srtPath, outputDir)) {
        throw new Error("Invalid file path detected.");
    }

    const text = await fs.readFile(textPath, 'utf-8');
    const srt = await fs.readFile(srtPath, 'utf-8');

    await fs.unlink(textPath).catch(() => {});
    await fs.unlink(srtPath).catch(() => {});

    return { text, srt };
}

// ------------------ FILE UPLOAD ------------------
export async function translateVideo(videoBuffer: Buffer, filename: string, userApiKey?: string) {
    let audioPath: string | null = null;

    try {
        audioPath = await extractAudio(videoBuffer);

        const { text: englishText, srt: originalSrt } = await transcribeLocalWhisper(audioPath);

        // 🔐 Prompt Injection Guard
        const sanitizedText = sanitizeForAI(englishText);
        const { myanmar: myanmarText } = await geminiTranslate(sanitizedText, userApiKey);

        return {
            englishText,
            myanmarText,
            srtContent: originalSrt
        };
    } finally {
        if (audioPath) await fs.unlink(audioPath).catch(() => {});
    }
}

// ------------------ LINK VERSION ------------------

export async function translateVideoLink(url: string, userApiKey?: string) {
    // 🔐 yt-dlp Domain Whitelist
    if (!isAllowedVideoUrl(url)) {
        throw new Error("ခွင့်ပြုထားသော Link များသာ သုံးနိုင်ပါသည်။ YouTube, TikTok, Facebook Link သာ ထည့်ပါ။");
    }

    // 🔐 UUID filenames
    const id = randomUUID();
    const tempVideoPath = path.join(tmpdir(), `vt_dl_${id}.mp4`);
    const tempAudioPath = path.join(tmpdir(), `vt_dlaud_${id}.mp3`);
    
    // 🔐 Path traversal check
    if (!isPathWithinDir(tempVideoPath, tmpdir()) || !isPathWithinDir(tempAudioPath, tmpdir())) {
        throw new Error("Invalid temp directory.");
    }

    try {
        console.log(`[Video Translator] Attempting to download: ${url}`);

        const cookiePath = path.join(process.cwd(), 'cookies.txt');
        const hasCookies = existsSync(cookiePath);

        if (!hasCookies) {
          throw new Error("cookies.txt not found. Please upload cookies.txt to the server.");
        }

        // ── Download with unified multi-platform downloader ──
        console.log(`[Video Translator] Downloading: ${url}`);

        const dlResult = await downloadVideo(url, tempVideoPath, {
          timeout: 300000
        });

        if (!dlResult.success) {
          throw new Error(`Download failed: ${dlResult.error}`);
        }

        const fileStat = await fs.stat(tempVideoPath).catch(() => null);
        if (fileStat) console.log(`[Video Translator] Video downloaded: ${Math.round(fileStat.size / 1024 / 1024 * 10) / 10}MB`);

        console.log(`[Video Translator] Extracting Audio...`);
        await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
                .noVideo()
                .audioCodec('libmp3lame')
                .on('end', resolve)
                .on('error', reject)
                .save(tempAudioPath);
        });

        console.log(`[Video Translator] Sending to local Whisper...`);
        const { text: englishText, srt: originalSrt } = await transcribeLocalWhisper(tempAudioPath);

        if (!englishText || !englishText.trim()) {
            throw new Error("Whisper could not detect any speech in this video.");
        }

        console.log(`[Video Translator] Translating with Gemini...`);
        // 🔐 Prompt Injection Guard
        const sanitizedText = sanitizeForAI(englishText);
        const { myanmar: myanmarText } = await geminiTranslate(sanitizedText, userApiKey);

        return { 
            englishText, 
            myanmarText, 
            srtContent: originalSrt,
        };
    } catch (error: any) {
        console.error("[Video Translator Error]", error);
        throw new Error(`Failed to process link: ${error.message}`);
    } finally {
        await fs.unlink(tempVideoPath).catch(() => {});
        await fs.unlink(tempAudioPath).catch(() => {});
    }
}

// ------------------ Job Processor Registration ------------------
import { registerProcessor, updateJob } from "./jobs";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

registerProcessor("translate_file", async (job) => {
    const { videoBase64, filename, userId } = job.input;
    
    updateJob(job.id, { progress: 20, message: "Extracting audio..." });
    
    try {
        const buffer = Buffer.from(videoBase64, "base64");
        const result = await translateVideo(buffer, filename);
        
        updateJob(job.id, { 
            status: "completed", 
            progress: 100, 
            result,
            message: "Done"
        });
    } catch (error: any) {
        // Refund credits on failure
        if (userId) {
            try {
                const db = await getDb();
                if (db) {
                    // Add back credits
                    await db.update(users)
                        .set({ credits: sql`credits + ${5}` })
                        .where(eq(users.id, userId));
                    console.log(`[Translate] Refunded 5 credits to user ${userId}`);
                }
            } catch (refundErr) {
                console.error("[Translate] Refund failed:", refundErr);
            }
        }
        
        updateJob(job.id, { 
            status: "failed", 
            error: error.message || "Translation failed",
            message: "Failed"
        });
    }
});

// Register processor for URL translation
registerProcessor("translate_link", async (job) => {
    const { url, userId } = job.input;
    
    updateJob(job.id, { progress: 20, message: "Downloading video..." });
    
    try {
        const result = await translateVideoLink(url);
        
        updateJob(job.id, { 
            status: "completed", 
            progress: 100, 
            result,
            message: "Done"
        });
    } catch (error: any) {
        // Refund credits on failure
        if (userId) {
            try {
                const db = await getDb();
                if (db) {
                    await db.update(users)
                        .set({ credits: sql`credits + ${5}` })
                        .where(eq(users.id, userId));
                    console.log(`[Translate Link] Refunded 5 credits to user ${userId}`);
                }
            } catch (refundErr) {
                console.error("[Translate Link] Refund failed:", refundErr);
            }
        }
        
        updateJob(job.id, { 
            status: "failed", 
            error: error.message || "Translation failed",
            message: "Failed"
        });
    }
});
