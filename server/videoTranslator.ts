import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { geminiTranslateBatch } from "./geminiTranslator";
import { isAllowedVideoUrl, isPathWithinDir, sanitizeForAI } from "./_core/security";

const execFileAsync = promisify(execFile);

// ------------------ Extract Audio ------------------
async function extractAudio(videoBuffer: Buffer): Promise<string> {
    const id = randomUUID();
    const tempVideoPath = path.join(tmpdir(), `vt_in_${id}.mp4`);
    const tempAudioPath = path.join(tmpdir(), `vt_aud_${id}.mp3`);

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
            .on('error', async (err: any) => {
                await fs.unlink(tempVideoPath).catch(() => {});
                reject(err);
            })
            .save(tempAudioPath);
    });
}

// ------------------ Whisper — returns segments[] ------------------
async function transcribeLocalWhisper(audioPath: string): Promise<{
    text: string;
    segments: { start: number; end: number; text: string }[];
}> {
    console.log(`[Translate] Starting transcription for: ${audioPath}`);
    const outputDir = path.dirname(audioPath);
    const baseName = path.parse(audioPath).name;
    // Use backend/transcriber.py (same script, works for both)
    const scriptPath = path.join(process.cwd(), "backend", "transcriber.py");
    const outputJson = path.join(outputDir, `${baseName}_transcription.json`);

    console.log(`[Translate] Running: python3 ${scriptPath} ${audioPath} ${outputJson}`);
    await execFileAsync("python3", [scriptPath, audioPath, outputJson], {
        timeout: 300000,
    });
    console.log(`[Translate] Transcription done, reading: ${outputJson}`);

    if (!isPathWithinDir(outputJson, outputDir)) {
        throw new Error("Invalid file path detected.");
    }

    const data = JSON.parse(await fs.readFile(outputJson, "utf-8"));
    await fs.unlink(outputJson).catch(() => {});

    return {
        text: data.text || "",
        segments: (data.segments || []) as { start: number; end: number; text: string }[],
    };
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
    let idx = 1;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const text = (translatedTexts[i] || "").trim();
        if (!text) continue;
        const startMs = Math.round(seg.start * 1000);
        const endMs = Math.round(seg.end * 1000);
        lines.push(String(idx++));
        lines.push(`${msToSrtTime(startMs)} --> ${msToSrtTime(endMs)}`);
        lines.push(text);
        lines.push("");
    }
    return lines.join("\r\n");
}

// ------------------ FILE UPLOAD ------------------
export async function translateVideo(videoBuffer: Buffer, filename: string, userApiKey?: string) {
    let audioPath: string | null = null;

    try {
        console.log(`[Translate] Step 1: Extracting audio from ${filename} (${videoBuffer.length} bytes)`);
        audioPath = await extractAudio(videoBuffer);
        console.log(`[Translate] Step 2: Audio extracted to ${audioPath}`);

        console.log(`[Translate] Step 3: Starting Whisper transcription...`);
        const { text: englishText, segments } = await transcribeLocalWhisper(audioPath);
        console.log(`[Translate] Step 4: Transcription done, ${segments.length} segments`);

        if (!englishText || !englishText.trim()) {
            throw new Error("No speech detected in video.");
        }

        const sanitizedSegments = segments.map((s, i) => ({
            index: i,
            start: s.start,
            end: s.end,
            text: sanitizeForAI(s.text),
        }));

        console.log(`[Translate] Step 5: Starting Gemini batch translation...`);
        const { translated } = await geminiTranslateBatch(sanitizedSegments, userApiKey);
        const myanmarText = translated.map(s => s.text).join(" ");
        console.log(`[Translate] Step 6: Translation done`);

        const srtContent = buildMyanmarSRT(segments, translated.map(s => s.text));

        return { englishText, myanmarText, srtContent };
    } finally {
        if (audioPath) await fs.unlink(audioPath).catch(() => {});
    }
}

// ------------------ LINK VERSION ------------------
export async function translateVideoLink(url: string, userApiKey?: string) {
    if (!isAllowedVideoUrl(url)) {
        throw new Error("ခွင့်ပြုထားသော Link များသာ သုံးနိုင်ပါသည်။ YouTube, TikTok, Facebook Link သာ ထည့်ပါ။");
    }

    const id = randomUUID();
    const tempVideoPath = path.join(tmpdir(), `vt_dl_${id}.mp4`);
    const tempAudioPath = path.join(tmpdir(), `vt_dlaud_${id}.mp3`);

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
            await execFileAsync("curl", ["-s", "-L", "--max-time", "120", "-o", tempVideoPath, downloadUrl], { timeout: 130000 });
        } else {
            // --- Fallback to yt-dlp ---
            console.log("[Video Translator] Cobalt unavailable, using yt-dlp fallback...");
            const cookiePath = path.join(process.cwd(), 'cookies.txt');
            const hasCookies = existsSync(cookiePath);

            try {
                await execFileAsync("pip3", ["install", "--upgrade", "--pre", "yt-dlp"], { timeout: 90000 });
                console.log("[Video Translator] yt-dlp updated");
            } catch {
                try { await execFileAsync("yt-dlp", ["-U"], { timeout: 30000 }); } catch {}
            }

            const baseArgs = ["--no-check-certificates", "--no-playlist", "--no-warnings", "--geo-bypass", "--max-filesize", "50M"];
            const formatStrategies: string[][] = [
                ...(hasCookies ? [
                    [...baseArgs, "--cookies", cookiePath, "--extractor-args", "youtube:player_client=tv", "-f", "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b", "--merge-output-format", "mp4"],
                    [...baseArgs, "--cookies", cookiePath, "--extractor-args", "youtube:player_client=web_creator", "-f", "bv*+ba/b", "--merge-output-format", "mp4"],
                    [...baseArgs, "--cookies", cookiePath, "-f", "b", "--recode-video", "mp4"],
                ] : []),
                [...baseArgs, "--extractor-args", "youtube:player_client=tv", "-f", "b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4"],
                [...baseArgs, "--extractor-args", "youtube:player_client=mweb", "-f", "b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4"],
                [...baseArgs, "--extractor-args", "youtube:player_client=android", "-f", "b[ext=mp4]/b", "--merge-output-format", "mp4"],
                [...baseArgs, "--extractor-args", "youtube:player_client=web_creator", "-f", "b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4"],
                [...baseArgs, "-f", "bv*+ba/b", "--merge-output-format", "mp4"],
                [...baseArgs, "-f", "worst[ext=mp4]/worst", "--recode-video", "mp4"],
            ];

            let dlSuccess = false;
            for (let i = 0; i < formatStrategies.length; i++) {
                await fs.unlink(tempVideoPath).catch(() => {});
                try {
                    const isCookie = formatStrategies[i].includes("--cookies");
                    console.log(`[Video Translator] Strategy ${i + 1}/${formatStrategies.length} [${isCookie ? "Cookies" : "NoCookies"}]...`);
                    await execFileAsync("yt-dlp", [...formatStrategies[i], "-o", tempVideoPath, url], { timeout: 300000 });
                    const checkStat = await fs.stat(tempVideoPath).catch(() => null);
                    if (checkStat && checkStat.size > 10000) {
                        dlSuccess = true;
                        console.log(`[Video Translator] ✅ Strategy ${i + 1} success (${Math.round(checkStat.size / 1024)}KB)`);
                        break;
                    }
                } catch (e: any) {
                    console.warn(`[Video Translator] Strategy ${i + 1} failed: ${e.message?.slice(0, 300)}`);
                }
            }

            if (!dlSuccess) {
                throw new Error(
                    "ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ။ YouTube bot detection ကြောင့် ဖြစ်နိုင်ပါသည်။\n" +
                    "ဖြေရှင်းနည်း: cookies.txt ကို browser မှ အသစ်ပြန် export လုပ်ပါ။"
                );
            }
        }

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
        const { text: englishText, segments } = await transcribeLocalWhisper(tempAudioPath);

        if (!englishText || !englishText.trim()) {
            throw new Error("Whisper could not detect any speech in this video.");
        }

        console.log(`[Video Translator] Translating with Gemini batch (${segments.length} segments)...`);
        const sanitizedSegments = segments.map((s, i) => ({
            index: i,
            start: s.start,
            end: s.end,
            text: sanitizeForAI(s.text),
        }));
        const { translated } = await geminiTranslateBatch(sanitizedSegments, userApiKey);
        const myanmarText = translated.map(s => s.text).join(" ");
        const srtContent = buildMyanmarSRT(segments, translated.map(s => s.text));

        return { englishText, myanmarText, srtContent };
    } catch (error: any) {
        console.error("[Video Translator Error]", error);
        throw new Error(`Failed to process link: ${error.message}`);
    } finally {
        await fs.unlink(tempVideoPath).catch(() => {});
        await fs.unlink(tempAudioPath).catch(() => {});
    }
}
