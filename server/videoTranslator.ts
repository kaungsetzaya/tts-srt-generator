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

        // --- Try Cobalt API v10 first (most reliable for YouTube) ---
        try {
            const controller = new AbortController();
            const cobaltTimeout = setTimeout(() => controller.abort(), 15000);
            const cobaltRes = await fetch("https://api.cobalt.tools/", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url, downloadMode: "auto" }),
                signal: controller.signal,
            });
            clearTimeout(cobaltTimeout);
            const cobaltData = await cobaltRes.json() as any;
            if (cobaltData && (cobaltData.status === "tunnel" || cobaltData.status === "redirect") && cobaltData.url) {
                downloadUrl = cobaltData.url;
                console.log(`[Video Translator] Cobalt API v10 success. Status: ${cobaltData.status}`);
            } else if (cobaltData?.status === "picker" && cobaltData?.picker?.length > 0) {
                downloadUrl = cobaltData.picker[0]?.url || "";
                if (downloadUrl) console.log(`[Video Translator] Cobalt API v10 picker mode, picked first.`);
            } else {
                console.log(`[Video Translator] Cobalt returned unexpected:`, JSON.stringify(cobaltData).slice(0, 300));
            }
        } catch (e: any) {
            console.warn("[Cobalt API v10 Error]", e.name === "AbortError" ? "Timeout" : e.message?.slice(0, 200));
        }

        if (downloadUrl) {
            console.log(`[Video Translator] Downloading via Cobalt URL...`);
            await execAsync(`curl -s -L --max-time 120 -o "${tempVideoPath}" "${downloadUrl}"`, { timeout: 130000 });
        } else {
            // --- Fallback to yt-dlp ---
            console.log("[Video Translator] Cobalt unavailable, using yt-dlp fallback...");
            const cookiePath = path.join(process.cwd(), 'cookies.txt');
            const hasCookies = existsSync(cookiePath);
            const cookieFlag = hasCookies ? `--cookies "${cookiePath}"` : "";
            
            // ── STEP 1: Ensure yt-dlp is up-to-date ──
            try {
                await execAsync("pip3 install --upgrade --pre yt-dlp 2>/dev/null", { timeout: 90000 });
                console.log("[Video Translator] yt-dlp updated");
            } catch {
                try { await execAsync("yt-dlp -U 2>/dev/null", { timeout: 30000 }); } catch {}
            }

            // ── STEP 2: Smart download strategies ──
            // CRITICAL: yt-dlp nightly requires --js-runtimes nodejs for n-challenge solving
            //   (deno is default but typically not installed on VPS)
            // CRITICAL: Android/iOS clients DON'T support cookies (yt-dlp skips them)
            //   Web client NEEDS cookies to avoid "bot" detection on datacenter IPs
            const jsRuntime = `--js-runtimes node`;
            const commonFlags = `${jsRuntime} --no-check-certificates --no-playlist --no-warnings --geo-bypass --max-filesize 50M`;
            
            const formatStrategies = [
                // ─── GROUP A: Web clients WITH cookies + JS runtime (best for datacenter IPs) ───
                ...(hasCookies ? [
                    // Strategy 1: Web with cookies + nodejs (solves both n-challenge + bot detection)
                    `${cookieFlag} ${commonFlags} -f "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b" --merge-output-format mp4`,
                    // Strategy 2: web_creator with cookies
                    `${cookieFlag} ${commonFlags} --extractor-args "youtube:player_client=web_creator" -f "bv*+ba/b" --merge-output-format mp4`,
                    // Strategy 3: Web with cookies, any format
                    `${cookieFlag} ${commonFlags} -f "b" --recode-video mp4`,
                ] : []),

                // ─── GROUP B: Mobile clients WITHOUT cookies (may work if IP not flagged) ───
                // Strategy 4: web_creator without cookies
                `${commonFlags} --extractor-args "youtube:player_client=web_creator" -f "b[ext=mp4]/bv*+ba/b" --merge-output-format mp4`,
                // Strategy 5: Android client — no cookies, no n-challenge needed
                `${commonFlags} --extractor-args "youtube:player_client=android" -f "b[ext=mp4]/b" --merge-output-format mp4`,
                // Strategy 6: Default (web) without cookies
                `${commonFlags} -f "bv*+ba/b" --merge-output-format mp4`,

                // ─── GROUP C: Last resort ───
                `${commonFlags} -f "worst[ext=mp4]/worst" --recode-video mp4`,
            ];
            
            let dlSuccess = false;
            for (let i = 0; i < formatStrategies.length; i++) {
                const fmtStr = formatStrategies[i];
                await fs.unlink(tempVideoPath).catch(() => {});
                try {
                    const isCookie = fmtStr.includes("--cookies");
                    const groupLabel = isCookie ? "Web+Cookies" : "NoCookies";
                    console.log(`[Video Translator] Strategy ${i + 1}/${formatStrategies.length} [${groupLabel}]: yt-dlp ${fmtStr.slice(0, 140)}...`);
                    await execAsync(
                        `yt-dlp ${fmtStr} -o "${tempVideoPath}" "${url}"`,
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
