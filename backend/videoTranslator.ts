import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { geminiTranslate } from "./geminiTranslator";
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

        // ── Download with yt-dlp using cookies and player client strategies ──
        console.log("[Video Translator] Downloading with yt-dlp (using cookies)...");

        const strategies = [
          // WITH COOKIES - tv client
          ["--cookies", cookiePath, "--extractor-args", "youtube:player_client=tv", "-f", "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b", "--merge-output-format", "mp4"],
          // WITH COOKIES - web_creator client
          ["--cookies", cookiePath, "--extractor-args", "youtube:player_client=web_creator", "-f", "bv*+ba/b", "--merge-output-format", "mp4"],
          // WITH COOKIES - generic
          ["--cookies", cookiePath, "-f", "b", "--recode-video", "mp4"],
          // WITHOUT COOKIES - tv client
          ["--extractor-args", "youtube:player_client=tv", "-f", "b[ext=mp4]/b", "--merge-output-format", "mp4"],
          // WITHOUT COOKIES - mweb client
          ["--extractor-args", "youtube:player_client=mweb", "-f", "b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4"],
          // WITHOUT COOKIES - generic fallback
          ["-f", "bv*+ba/b", "--merge-output-format", "mp4"],
        ];

        let dlSuccess = false;
        for (let i = 0; i < strategies.length; i++) {
          await fs.unlink(tempVideoPath).catch(() => {});
          try {
            const isCookie = strategies[i].includes("--cookies");
            const label = isCookie ? "WithCookies" : "NoCookies";
            console.log(`[Video Translator] Strategy ${i + 1}/${strategies.length} [${label}]...`);

            await execFileAsync("yt-dlp", [
              "--no-check-certificates",
              "--no-playlist",
              "--no-warnings",
              "--max-filesize", "50M",
              ...strategies[i],
              "-o", tempVideoPath,
              url
            ], { timeout: 300000 });

            const stat = await fs.stat(tempVideoPath).catch(() => null);
            if (stat && stat.size > 10000) {
              dlSuccess = true;
              console.log(`[Video Translator] ✅ Strategy ${i + 1} [${label}] success (${Math.round(stat.size / 1024)}KB)`);
              break;
            }
          } catch (e: any) {
            console.warn(`[Video Translator] Strategy ${i + 1} failed: ${e.message?.slice(0, 100)}`);
          }
        }

        if (!dlSuccess) {
          throw new Error("ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ။ YouTube bot detection ကြောင့် ဖြစ်နိုင်ပါသည်။");
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
