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
        
        let downloadUrl = "";

        // --- Try Cobalt API v10 first ---
        try {
            const controller = new AbortController();
            const cobaltTimeout = setTimeout(() => controller.abort(), 20000);
            const cobaltRes = await fetch("https://api.cobalt.tools/", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (compatible; CobaltClient/1.0)",
                },
                body: JSON.stringify({ url, downloadMode: "auto", videoQuality: "720", audioFormat: "mp3" }),
                signal: controller.signal,
            });
            clearTimeout(cobaltTimeout);
            if (cobaltRes.ok) {
                const cobaltData = await cobaltRes.json() as any;
                if (cobaltData && (cobaltData.status === "tunnel" || cobaltData.status === "redirect") && cobaltData.url) {
                    downloadUrl = cobaltData.url;
                    console.log(`[Video Translator] Cobalt API success. Status: ${cobaltData.status}`);
                } else if (cobaltData?.status === "picker" && cobaltData?.picker?.length > 0) {
                    downloadUrl = cobaltData.picker[0]?.url || "";
                    if (downloadUrl) console.log(`[Video Translator] Cobalt API picker mode, picked first.`);
                } else {
                    console.log(`[Video Translator] Cobalt returned:`, JSON.stringify(cobaltData).slice(0, 300));
                }
            } else {
                console.warn(`[Video Translator] Cobalt API HTTP ${cobaltRes.status}`);
            }
        } catch (e: any) {
            console.warn("[Cobalt API Error]", e.name === "AbortError" ? "Timeout" : e.message?.slice(0, 200));
        }

        if (downloadUrl) {
            console.log(`[Video Translator] Downloading via Cobalt URL...`);
            // 🔐 FFmpeg Command Guard: execFile with argument array
            await execFileAsync("curl", ["-s", "-L", "--max-time", "120", "-o", tempVideoPath, downloadUrl], { timeout: 130000 });
        } else {
            // --- Fallback to yt-dlp ---
            console.log("[Video Translator] Cobalt unavailable, using yt-dlp fallback...");
            const cookiePath = path.join(process.cwd(), 'cookies.txt');
            const hasCookies = existsSync(cookiePath);
            
            // ── STEP 1: Ensure yt-dlp is up-to-date ──
            try {
                await execFileAsync("pip3", ["install", "--upgrade", "--pre", "yt-dlp"], { timeout: 90000 });
                console.log("[Video Translator] yt-dlp updated");
            } catch {
                try { await execFileAsync("yt-dlp", ["-U"], { timeout: 30000 }); } catch {}
            }

            // ── STEP 2: Smart download strategies — all using execFile ──
            const baseArgs = ["--no-check-certificates", "--no-playlist", "--no-warnings", "--geo-bypass", "--max-filesize", "50M"];
            
            const formatStrategies: string[][] = [
                // tv client — most reliable without cookies
                [...baseArgs, "--extractor-args", "youtube:player_client=tv", "-f", "b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4"],
                // mweb client
                [...baseArgs, "--extractor-args", "youtube:player_client=mweb", "-f", "b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4"],
                // android client
                [...baseArgs, "--extractor-args", "youtube:player_client=android", "-f", "b[ext=mp4]/b", "--merge-output-format", "mp4"],
                // web_creator client
                [...baseArgs, "--extractor-args", "youtube:player_client=web_creator", "-f", "b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4"],
                ...(hasCookies ? [
                    [...baseArgs, "--cookies", cookiePath, "--extractor-args", "youtube:player_client=tv", "-f", "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b", "--merge-output-format", "mp4"],
                    [...baseArgs, "--cookies", cookiePath, "--extractor-args", "youtube:player_client=web_creator", "-f", "bv*+ba/b", "--merge-output-format", "mp4"],
                    [...baseArgs, "--cookies", cookiePath, "-f", "b", "--recode-video", "mp4"],
                ] : []),
                // generic fallback
                [...baseArgs, "-f", "bv*+ba/b", "--merge-output-format", "mp4"],
                [...baseArgs, "-f", "worst[ext=mp4]/worst", "--recode-video", "mp4"],
            ];
            
            let dlSuccess = false;
            for (let i = 0; i < formatStrategies.length; i++) {
                await fs.unlink(tempVideoPath).catch(() => {});
                try {
                    const isCookie = formatStrategies[i].includes("--cookies");
                    const groupLabel = isCookie ? "Web+Cookies" : "NoCookies";
                    console.log(`[Video Translator] Strategy ${i + 1}/${formatStrategies.length} [${groupLabel}]...`);
                    // 🔐 FFmpeg Command Guard: execFile prevents command injection
                    await execFileAsync(
                        "yt-dlp",
                        [...formatStrategies[i], "-o", tempVideoPath, url],
                        { timeout: 300000 }
                    );
                    const checkStat = await fs.stat(tempVideoPath).catch(() => null);
                    if (checkStat && checkStat.size > 10000) {
                        dlSuccess = true;
                        console.log(`[Video Translator] ✅ Strategy ${i + 1} [${groupLabel}] success (${Math.round(checkStat.size / 1024)}KB)`);
                        break;
                    } else {
                        console.warn(`[Video Translator] Strategy ${i + 1} produced empty/tiny file (${checkStat?.size ?? 0} bytes)`);
                    }
                } catch (e: any) {
                    const msg = e.message?.slice(0, 300) ?? "";
                    console.warn(`[Video Translator] Strategy ${i + 1} failed: ${msg}`);
                }
            }
            
            if (!dlSuccess) {
                throw new Error(
                    "ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ။ YouTube bot detection ကြောင့် ဖြစ်နိုင်ပါသည်။\n" +
                    "ဖြေရှင်းနည်း: cookies.txt ကို browser မှ အသစ်ပြန် export လုပ်ပါ။"
                );
            }
        }

        // Verify file exists and has content
        const fileStat = await fs.stat(tempVideoPath).catch(() => null);
        if (!fileStat || fileStat.size < 1000) {
            throw new Error("Downloaded file is empty or too small. The video may be unavailable or restricted.");
        }
        console.log(`[Video Translator] Video downloaded: ${Math.round(fileStat.size / 1024 / 1024 * 10) / 10}MB`);

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
