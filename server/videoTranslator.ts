import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import { promisify } from 'util';
import { geminiTranslate } from "./geminiTranslator";

const execAsync = promisify(exec);

// ------------------ Extract Audio ------------------
async function extractAudio(videoBuffer: Buffer): Promise<string> {
    const tempVideoPath = path.join(tmpdir(), `${randomUUID()}.mp4`);
    const tempAudioPath = path.join(tmpdir(), `${randomUUID()}.mp3`);

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

// ------------------ Whisper ------------------
async function transcribeLocalWhisper(audioPath: string): Promise<{ text: string, srt: string }> {
    const outputDir = path.dirname(audioPath);
    const baseName = path.parse(audioPath).name;

    await execAsync(`whisper "${audioPath}" --model base --output_dir "${outputDir}" --output_format all`);

    const text = await fs.readFile(path.join(outputDir, `${baseName}.txt`), 'utf-8');
    const srt = await fs.readFile(path.join(outputDir, `${baseName}.srt`), 'utf-8');

    await fs.unlink(path.join(outputDir, `${baseName}.txt`)).catch(() => {});
    await fs.unlink(path.join(outputDir, `${baseName}.srt`)).catch(() => {});

    return { text, srt };
}

// ------------------ FILE UPLOAD (FIXED EXPORT) ------------------
export async function translateVideo(videoBuffer: Buffer, filename: string, userApiKey?: string) {
    let audioPath: string | null = null;

    try {
        audioPath = await extractAudio(videoBuffer);

        const { text: englishText, srt: originalSrt } = await transcribeLocalWhisper(audioPath);

        const { myanmar: myanmarText } = await geminiTranslate(englishText, userApiKey);

        return {
            englishText,
            myanmarText,
            srtContent: originalSrt
        };
    } finally {
        if (audioPath) await fs.unlink(audioPath).catch(() => {});
    }
}

// ------------------ LINK VERSION (FIXED) ------------------

export async function translateVideoLink(url: string, userApiKey?: string) {
    const videoFilename = `${randomUUID()}.mp4`;
    const tempVideoPath = path.join(tmpdir(), videoFilename);
    const tempAudioPath = path.join(tmpdir(), `${randomUUID()}.mp3`);
    
    try {
        console.log(`[Video Translator] Attempting to download: ${url}`);
        
        let downloadUrl = "";

        // --- Try Cobalt API v10 (current) ---
        try {
            const cobaltRes = await fetch("https://api.cobalt.tools/", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url, downloadMode: "auto" })
            });
            const cobaltData = await cobaltRes.json() as any;
            // v10 returns { status: "tunnel"|"redirect"|"picker", url: "..." }
            if (cobaltData && (cobaltData.status === "tunnel" || cobaltData.status === "redirect") && cobaltData.url) {
                downloadUrl = cobaltData.url;
                console.log(`[Video Translator] Cobalt API v10 success. Status: ${cobaltData.status}`);
            } else if (cobaltData?.picker) {
                // picker mode: pick first item
                downloadUrl = cobaltData.picker[0]?.url || "";
                if (downloadUrl) console.log(`[Video Translator] Cobalt API v10 picker mode, picked first.`);
            }
        } catch (e) {
            console.error("[Cobalt API v10 Error]", e);
        }

        if (downloadUrl) {
            console.log(`[Video Translator] Downloading via Cobalt URL...`);
            await execAsync(`curl -s -L --max-time 120 -o "${tempVideoPath}" "${downloadUrl}"`);
        } else {
            // --- Fallback to yt-dlp (supports YouTube, Facebook, TikTok, etc.) ---
            console.log("[Video Translator] Cobalt unavailable, using yt-dlp fallback...");
            const cookiePath = path.join(process.cwd(), 'cookies.txt');
            const cookieFlag = existsSync(cookiePath) ? `--cookies "${cookiePath}"` : "";
            // Best quality video under 50MB, prefer mp4
            await execAsync(
                `yt-dlp ${cookieFlag} -f "bestvideo[ext=mp4][filesize<50M]+bestaudio[ext=m4a]/best[ext=mp4][filesize<50M]/best" --merge-output-format mp4 -o "${tempVideoPath}" "${url}"`,
                { timeout: 300000 }
            );
        }

        // Verify file exists and has content
        const stat = await fs.stat(tempVideoPath).catch(() => null);
        if (!stat || stat.size < 1000) {
            throw new Error("Downloaded file is empty or too small. The video may be unavailable or restricted.");
        }

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
        const { myanmar: myanmarText } = await geminiTranslate(englishText, userApiKey);

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
