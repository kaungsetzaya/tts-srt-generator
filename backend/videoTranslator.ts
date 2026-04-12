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
          // WITH COOKIES - tv client with user-agent
          ["--cookies", cookiePath, "--extractor-args", "youtube:player_client=tv", "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "--add-header", "Referer:https://www.youtube.com/", "-f", "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b", "--merge-output-format", "mp4"],
          // WITH COOKIES - web client
          ["--cookies", cookiePath, "--extractor-args", "youtube:player_client=web", "--user-agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36", "-f", "bv*+ba/b", "--merge-output-format", "mp4"],
          // WITH COOKIES - android client
          ["--cookies", cookiePath, "--extractor-args", "youtube:player_client=android", "-f", "b", "--recode-video", "mp4"],
          // WITHOUT COOKIES - tv client
          ["--extractor-args", "youtube:player_client=tv", "--user-agent", "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0)", "-f", "b[ext=mp4]/b", "--merge-output-format", "mp4"],
          // WITHOUT COOKIES - ios client
          ["--extractor-args", "youtube:player_client=ios", "--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)", "-f", "b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4"],
          // Fallback - lowest quality
          ["-f", "worst[ext=mp4]/worst", "--recode-video", "mp4"],
        ];

        let dlSuccess = false;
        let lastError = "";
        
        for (let i = 0; i < strategies.length; i++) {
          await fs.unlink(tempVideoPath).catch(() => {});
          
          // Delay between retries to avoid rate limiting
          if (i > 0) {
            const delayMs = 2000 * i; // 2s, 4s, 6s, 8s, 10s
            console.log(`[Video Translator] Waiting ${delayMs}ms before retry...`);
            await new Promise(r => setTimeout(r, delayMs));
          }
          
          try {
            const isCookie = strategies[i].includes("--cookies");
            const hasUA = strategies[i].includes("--user-agent");
            const label = isCookie ? "WithCookies" : (hasUA ? "WithUA" : "Fallback");
            console.log(`[Video Translator] Strategy ${i + 1}/${strategies.length} [${label}]...`);

            await execFileAsync("yt-dlp", [
              "--no-check-certificates",
              "--no-playlist",
              "--no-warnings",
              "--max-filesize", "50M",
              "--socket-timeout", "30",
              "--retries", "3",
              "--fragment-retries", "3",
              ...strategies[i],
              "-o", tempVideoPath,
              url
            ], { timeout: 180000 }); // Reduced to 3 min per strategy

            const stat = await fs.stat(tempVideoPath).catch(() => null);
            if (stat && stat.size > 10000) {
              dlSuccess = true;
              console.log(`[Video Translator] ✅ Strategy ${i + 1} [${label}] success (${Math.round(stat.size / 1024)}KB)`);
              break;
            }
          } catch (e: any) {
            lastError = e.message || "Unknown error";
            const errorShort = lastError.slice(0, 150);
            console.warn(`[Video Translator] Strategy ${i + 1} failed: ${errorShort}`);
            
            // If error contains "Sign in", skip remaining strategies
            if (lastError.includes("Sign in") || lastError.includes("age-restricted")) {
              console.error("[Video Translator] Video requires login or is age-restricted");
              break;
            }
          }
        }

        if (!dlSuccess) {
          // Provide detailed error for debugging
          const errorDetail = lastError.includes("bot") ? "Bot detection" : 
                             lastError.includes("age") ? "Age restricted" :
                             lastError.includes("private") ? "Private video" :
                             lastError.includes("not available") ? "Video unavailable" : "Unknown";
          console.error(`[Video Translator] All strategies failed. Last error type: ${errorDetail}`);
          console.error(`[Video Translator] Full error: ${lastError.slice(0, 500)}`);
          
          throw new Error(`ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ။ (${errorDetail}) YouTube က bot detection လုပ်နေတာ ဖြစ်နိုင်ပါသည်။ နောက်မှ ထပ်ကြိုးစားပါ သို့မဟုတ် တခြား link သုံးပါ။`);
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
