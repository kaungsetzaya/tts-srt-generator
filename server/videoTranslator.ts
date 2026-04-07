import { promises as fs } from 'fs';
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
        console.log(`[Video Translator] Bypassing YouTube block using Cobalt API for: ${url}`);
        
        let downloadUrl = "";
        try {
            // Native fetch API ကို သုံးပြီး Headers အပြည့်အစုံနဲ့ လှမ်းခေါ်ပါမယ်
            const res = await fetch("https://api.cobalt.tools/api/json", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Origin": "https://cobalt.tools",
                    "Referer": "https://cobalt.tools/"
                },
                body: JSON.stringify({ url: url })
            });
            
            const data = await res.json() as any;
            if (data && data.url) {
                downloadUrl = data.url;
                console.log(`[Video Translator] Cobalt API Success! Download Link generated.`);
            }
        } catch (e) {
            console.error("[Cobalt API Error]", e);
        }

        if (!downloadUrl) {
            console.log("[Video Translator] Cobalt API failed, falling back to yt-dlp...");
            const cookiePath = path.join(process.cwd(), 'cookies.txt');
            await execAsync(`yt-dlp --cookies "${cookiePath}" -f "b" -o "${tempVideoPath}" "${url}"`);
        } else {
            console.log(`[Video Translator] Downloading raw video file from API...`);
            await execAsync(`curl -s -L -o "${tempVideoPath}" "${downloadUrl}"`);
        }

        const videoBuffer = await fs.readFile(tempVideoPath);
        const videoBase64 = videoBuffer.toString('base64');

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

        if (!englishText || !(englishText || "").trim()) {
            throw new Error("Whisper could not detect any speech.");
        }

        console.log(`[Video Translator] Translating...`);
        const { myanmar: myanmarText, modelUsed } = await geminiTranslate(englishText, userApiKey);
        
        let myanmarSRT = originalSrt;
        try {
            // @ts-ignore
            if (typeof buildMyanmarSRT === 'function') {
                // @ts-ignore
                myanmarSRT = await buildMyanmarSRT(originalSrt, myanmarText);
            }
        } catch (e) {}

        return { 
            englishText, 
            myanmarText, 
            srtContent: myanmarSRT,
            videoBase64: videoBase64,
            videoFilename: "LUMIX_Video.mp4"
        };
    } catch (error: any) {
        console.error("[Video Translator Error]", error);
        throw new Error(`Failed to process link: ${error.message}`);
    } finally {
        await fs.unlink(tempVideoPath).catch(() => {});
        await fs.unlink(tempAudioPath).catch(() => {});
    }
}
