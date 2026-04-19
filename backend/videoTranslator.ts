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

// ─── Pre-flight: check python3 + faster-whisper are available ─────────────────
export async function checkPythonAndWhisper(): Promise<void> {
    try {
        await execFileAsync("python3", ["-c", "import faster_whisper; print('ok')"], {
            timeout: 10000,
            killSignal: "SIGKILL",
        });
    } catch (err: any) {
        const msg = (err?.stderr || err?.message || String(err));
        if (msg.includes("No module named") || msg.includes("ModuleNotFound")) {
            throw new Error("Server: faster-whisper မထည့်သွင်းရသေးပါ။ Admin ကို ဆက်သွယ်ပါ။");
        }
        if (msg.includes("ENOENT") || msg.includes("not found")) {
            throw new Error("Server: Python3 မတွေ့ပါ။ Admin ကို ဆက်သွယ်ပါ။");
        }
        throw new Error(`Server: Python check failed — ${msg.slice(0, 200)}`);
    }
}

// ------------------ Whisper — Python script with faster-whisper ------------------
async function transcribeLocalWhisper(audioPath: string): Promise<{ text: string; segments: { start: number; end: number; text: string }[] }> {
    console.log(`[Translate] Starting transcription for: ${audioPath}`);
    const outputDir = path.dirname(audioPath);
    const baseName = path.parse(audioPath).name;
    const scriptPath = path.join(process.cwd(), "backend", "transcriber.py");
    const outputJson = path.join(outputDir, `${baseName}_transcription.json`);

    console.log(`[Translate] Running: python3 ${scriptPath} ${audioPath} ${outputJson}`);
    // 🔐 Command Guard: execFile with argument array + SIGKILL to guarantee termination
    await execFileAsync("python3", [scriptPath, audioPath, outputJson], {
        timeout: 300000,
        killSignal: "SIGKILL",
        maxBuffer: 10 * 1024 * 1024,
    });
    console.log(`[Translate] Transcription done, reading: ${outputJson}`);

    // 🔐 Path traversal check
    if (!isPathWithinDir(outputJson, outputDir)) {
        throw new Error("Invalid file path detected.");
    }

    const data = JSON.parse(await fs.readFile(outputJson, "utf-8"));
    await fs.unlink(outputJson).catch(() => {});

    return { text: data.text || "", segments: (data.segments || []) as { start: number; end: number; text: string }[] };
}

// ------------------ SRT Builder ------------------
function msToSrtTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = ms % 1000;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(mil).padStart(3,"0")}`;
}

function buildMyanmarSRT(
    segments: { start: number; end: number; text: string }[],
    translatedTexts: string[]
): string {
    const lines: string[] = [];
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const text = (translatedTexts[i] || "").trim();
        if (!text) continue;
        const startMs = Math.round(seg.start * 1000);
        const endMs = Math.round(seg.end * 1000);
        lines.push(`${lines.length / 4 + 1 | 0}`);
        lines.push(`${msToSrtTime(startMs)} --> ${msToSrtTime(endMs)}`);
        lines.push(text);
        lines.push("");
    }
    // Re-number
    let idx = 1;
    const content = lines.map((l, i) => (i % 4 === 0 ? String(idx++) : l)).join("\n");
    return content.replace(/\n/g, "\r\n");
}

// ------------------ FILE UPLOAD ------------------
export async function translateVideo(
    videoBuffer: Buffer,
    filename: string,
    userApiKey?: string,
    onProgress?: (pct: number, msg: string) => void
) {
    const videoSizeMB = videoBuffer.length / 1024 / 1024;
    if (videoSizeMB > 25) {
        throw new Error("Video too large. Max 25MB.");
    }

    let audioPath: string | null = null;
    let videoPath: string | null = null;

    try {
        // Write temp video for duration check
        const id = randomUUID();
        videoPath = path.join(tmpdir(), `vt_${id}.mp4`);
        await fs.writeFile(videoPath, videoBuffer);

        // Check duration
        const duration = await getVideoDuration(videoPath);
        if (duration > 150) {
            throw new Error("Video too long. Max 2min 30sec.");
        }

        onProgress?.(15, "Audio ထုတ်နေသည်...");
        console.log(`[Translate] Step 1: Extracting audio from ${filename} (${Math.round(videoSizeMB)}MB`);
        audioPath = await extractAudio(videoBuffer);
        console.log(`[Translate] Step 2: Audio extracted to ${audioPath}`);

        onProgress?.(30, "Whisper AI ဖြင့် အသံမှစာသားပြောင်းနေသည်...");
        console.log(`[Translate] Step 3: Starting Whisper transcription...`);
        const { text: englishText, segments } = await transcribeLocalWhisper(audioPath);
        console.log(`[Translate] Step 4: Transcription done, ${segments.length} segments`);

        if (!englishText || !englishText.trim()) {
            throw new Error("No speech detected in video.");
        }

        // 🔐 Prompt Injection Guard - Translate ALL at once as paragraph
        if (!englishText || englishText.trim().length === 0) {
            throw new Error("No English text to translate.");
        }
        
        onProgress?.(70, "Gemini AI ဖြင့် မြန်မာဘာသာပြန်နေသည်...");
        console.log(`[Translate] English text: "${englishText.substring(0, 100)}..."`);
        
        const { myanmar } = await geminiTranslate(englishText, userApiKey);
        
        console.log(`[Translate] Myanmar result: "${myanmar.substring(0, 100)}..."`);
        
        return {
            englishText: englishText,
            myanmarText: myanmar,
        };
    } finally {
        if (audioPath) await fs.unlink(audioPath).catch(() => {});
        if (videoPath) await fs.unlink(videoPath).catch(() => {});
    }
}

// ------------------ LINK VERSION ------------------

export async function translateVideoLink(url: string, userApiKey?: string, onProgress?: (pct: number, msg: string) => void) {
    // 🔐 yt-dlp Domain Whitelist
    if (!isAllowedVideoUrl(url)) {
        throw new Error("ခွင့်ပြုထားသော Link များသာ သုံးနိုင်ပါသည်။ YouTube, TikTok, Facebook Link သာ ထည့်ပါ။");
    }

    // Check video info before downloading
    const { getVideoInfo } = await import("./_core/multiDownloader");
    const info = await getVideoInfo(url);
    if (!info) {
        throw new Error("Could not get video info. Check URL.");
    }
    if (info.duration > 150) {
        throw new Error("Video too long. Max 2min 30sec.");
    }
    if (info.filesize > 25 * 1024 * 1024) {
        throw new Error("Video too large. Max 25MB.");
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
        onProgress?.(15, "ဗီဒီယို ဒေါင်းလော့ဆွဲနေသည်...");
        console.log(`[Video Translator] Downloading: ${url}`);

        const dlResult = await downloadVideo(url, tempVideoPath, {
          timeout: 300000
        });

        if (!dlResult.success) {
          throw new Error(`Download failed: ${dlResult.error}`);
        }

        const fileStat = await fs.stat(tempVideoPath).catch(() => null);
        if (fileStat) console.log(`[Video Translator] Video downloaded: ${Math.round(fileStat.size / 1024 / 1024 * 10) / 10}MB`);

        onProgress?.(35, "Audio ထုတ်နေသည်...");
        console.log(`[Video Translator] Extracting Audio...`);
        await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
                .noVideo()
                .audioCodec('libmp3lame')
                .on('end', resolve)
                .on('error', reject)
                .save(tempAudioPath);
        });

        onProgress?.(50, "Whisper AI ဖြင့် အသံမှစာသားပြောင်းနေသည်...");
        console.log(`[Video Translator] Sending to local Whisper...`);
        const { text: englishText, segments } = await transcribeLocalWhisper(tempAudioPath);

        if (!englishText || !englishText.trim()) {
            throw new Error("Whisper could not detect any speech in this video.");
        }
        
        console.log(`[Video Translator] English: "${englishText.substring(0, 100)}..."`);

        onProgress?.(80, "Gemini AI ဖြင့် မြန်မာဘာသာပြန်နေသည်...");
        console.log(`[Video Translator] Translating with Gemini...`);
        
        // Translate ALL at once using geminiTranslate (simple call)
        const { myanmar } = await geminiTranslate(englishText, userApiKey);
        
        console.log(`[Video Translator] Myanmar: "${myanmar.substring(0, 100)}..."`);

        return { 
            englishText, 
            myanmarText: myanmar, 
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
    console.log(`[TranslateJob] Starting translate_file job: ${job.id}`);
    const { videoBase64, filename, userId } = job.input;
    
    updateJob(job.id, { progress: 10, message: "Audio ထုတ်နေသည်..." });
    
    try {
        // Pre-flight check: ensure Python+Whisper are available
        await checkPythonAndWhisper();
        
        console.log(`[TranslateJob] Calling translateVideo for: ${filename}`);
        const buffer = Buffer.from(videoBase64, "base64");
        const result = await translateVideo(buffer, filename, undefined, (pct, msg) => {
            updateJob(job.id, { progress: pct, message: msg });
        });
        console.log(`[TranslateJob] translateVideo result:`, result);
        
        updateJob(job.id, { 
            status: "completed", 
            progress: 100, 
            result,
            message: "ပြီးပါပြီ"
        });
    } catch (error: any) {
        console.error(`[TranslateJob] Error:`, error.message);
        // Refund credits on failure
        if (userId) {
            try {
                const db = await getDb();
                if (db) {
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
    
    updateJob(job.id, { progress: 10, message: "ဗီဒီယို Link စစ်ဆေးနေသည်..." });
    
    try {
        // Pre-flight check: ensure Python+Whisper are available
        await checkPythonAndWhisper();
        
        const result = await translateVideoLink(url, undefined, (pct, msg) => {
            updateJob(job.id, { progress: pct, message: msg });
        });
        
        updateJob(job.id, { 
            status: "completed", 
            progress: 100, 
            result,
            message: "ပြီးပါပြီ"
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
