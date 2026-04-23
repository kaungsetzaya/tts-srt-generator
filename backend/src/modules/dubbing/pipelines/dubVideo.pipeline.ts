import { randomUUID } from "crypto";
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

import { ffmpegService } from '../../media/services/ffmpeg.service';
import { downloaderService, getVideoInfo, downloadVideo } from '../../media/services/downloader.service';
import { whisperService } from '../../translation/services/whisper.service';
import { geminiService } from '../../translation/services/gemini.service';
import { ttsService, CHARACTER_VOICES, CharacterKey, VoiceKey } from '../../tts/services/tts.service';
import { assBuilderService } from '../services/assBuilder.service';
import { isAllowedVideoUrl } from '../../../../_core/security';
import { updateJob } from '../../../../jobs';

function formatTimestamp(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const millis = ms % 1000;
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

const segmenter = new Intl.Segmenter("my", { granularity: "grapheme" });
function graphemeLen(s: string): number {
    return [...segmenter.segment(s)].length;
}

function splitToSubtitleChunks(text: string, maxCharsPerLine: number): string[] {
    const clean = text.replace(/[\n\r]+/g, " ").trim();
    if (!clean) return [""];
    const maxCharsPerEntry = maxCharsPerLine * 2;
    const glen = graphemeLen(clean);
    if (glen <= maxCharsPerEntry) {
        if (glen > maxCharsPerLine) {
            const mid = Math.ceil(glen / 2);
            const graphemes = [...segmenter.segment(clean)].map(g => g.segment);
            const line1 = graphemes.slice(0, mid).join("").trim();
            const line2 = graphemes.slice(mid).join("").trim();
            return [line1 + "\n" + line2];
        }
        return [clean];
    }
    const graphemes = [...segmenter.segment(clean)].map(g => g.segment);
    const chunks: string[] = [];
    let pos = 0;
    while (pos < graphemes.length) {
        const remaining = graphemes.length - pos;
        const chunkSize = Math.min(maxCharsPerEntry, remaining);
        const chunkText = graphemes.slice(pos, pos + chunkSize).join("");
        if (graphemeLen(chunkText) > maxCharsPerLine) {
            const halfLen = Math.ceil(chunkSize / 2);
            const line1 = graphemes.slice(pos, pos + halfLen).join("").trim();
            const line2 = graphemes.slice(pos + halfLen, pos + chunkSize).join("").trim();
            chunks.push(line1 + "\n" + line2);
        } else {
            chunks.push(chunkText.trim());
        }
        pos += chunkSize;
    }
    return chunks.filter(c => c.trim());
}

export interface DubOptions {
  voice: string;
  speed?: number;
  pitch?: number;
  srtEnabled?: boolean;
  srtFontSize?: number;
  srtColor?: string;
  srtMarginV?: number;
  srtBlurBg?: boolean;
  srtBlurOpacity?: number;
  srtBlurColor?: "black" | "white" | "transparent";
  srtBoxPadding?: number;
  srtFullWidth?: boolean;
  srtDropShadow?: boolean;
  srtBorderRadius?: "rounded" | "square";
  userApiKey?: string;
}

export class DubVideoPipeline {
  async executeFromLink(url: string, options: DubOptions, jobId?: string) {
    if (!isAllowedVideoUrl(url)) throw new Error("Disallowed URL");
    const info = await getVideoInfo(url);
    if (!info) throw new Error("Could not get video info");
    if (info.duration > 150) throw new Error("Video too long (max 150s)");
    const id = randomUUID();
    const tempVideoPath = path.join(tmpdir(), `dl_${id}.mp4`);
    try {
      await downloadVideo(url, tempVideoPath);
      const buffer = await fs.readFile(tempVideoPath);
      return await this.execute(buffer, "video.mp4", options, jobId);
    } finally {
        await fs.unlink(tempVideoPath).catch(() => {});
    }
  }

  async execute(videoBuffer: Buffer, filename: string, options: DubOptions, jobId?: string) {
    const id = randomUUID();
    const tempDir = path.join(tmpdir(), `dub_pipe_${id}`);
    await fs.mkdir(tempDir, { recursive: true });

    const tempVideoPath = path.join(tempDir, `input.mp4`);
    const tempAudioExtract = path.join(tempDir, `extracted.mp3`);
    const tempOriginalAudio = path.join(tempDir, `original_audio.mp3`);
    const tempAssPath = path.join(tempDir, `subtitles.ass`);
    const tempOutputPath = path.join(tempDir, `output.mp4`);

    try {
      if (jobId) updateJob(jobId, { progress: 10, message: "Initializing video data..." });
      await fs.writeFile(tempVideoPath, videoBuffer);
      const videoDurationSec = await ffmpegService.getVideoDuration(tempVideoPath);
      if (videoDurationSec > 150) throw new Error("Video too long. Max 2min 30sec.");
      console.log(`[Dubbing Pipeline] Step 1 OK: video duration ${videoDurationSec}s`);

      if (jobId) updateJob(jobId, { progress: 20, message: "Extracting audio for analysis..." });
      await ffmpegService.extractAudio(tempVideoPath, tempAudioExtract);
      console.log(`[Dubbing Pipeline] Step 2 OK: audio extracted`);

      if (jobId) updateJob(jobId, { progress: 35, message: "Transcribing speech..." });
      const segments = await whisperService.transcribe(tempAudioExtract);
      if (segments.length === 0) throw new Error("No speech detected in video");
      console.log(`[Dubbing Pipeline] Step 3 OK: ${segments.length} segments transcribed`);

      if (jobId) updateJob(jobId, { progress: 50, message: "Translating to Myanmar..." });
      const translatedSegments = await geminiService.translateSegments(
        segments.map((s, i) => ({ index: i, start: s.start, end: s.end, text: s.text })),
        options.userApiKey
      );
      console.log(`[Dubbing Pipeline] Step 4 OK: translated segments ready`);

      const CONCURRENCY = 1;
      const activeSegments = translatedSegments.filter(seg => seg.translatedText.trim());
      if (activeSegments.length === 0) throw new Error("No translated segments to generate voice for.");

      async function generateTtsForSegment(seg: typeof translatedSegments[0]): Promise<{ partPath: string; duration: number; text: string; index: number }> {
        const isCharacter = options.voice in CHARACTER_VOICES;
        let audioBuffer: Buffer;
        try {
          console.log(`[Dubbing Pipeline] Generating TTS for segment ${seg.index}: "${seg.translatedText.slice(0, 50)}..." (voice: ${options.voice})`);
          if (isCharacter) {
              const ttsResult = await ttsService.generateSpeechWithCharacter(seg.translatedText, options.voice as CharacterKey, 1.1, "16:9", options.pitch ?? 0);
              audioBuffer = ttsResult.audioBuffer;
          } else {
              const ttsResult = await ttsService.generateSpeech(seg.translatedText, options.voice as VoiceKey, 1.1, options.pitch ?? 0, "16:9");
              audioBuffer = ttsResult.audioBuffer;
          }
        } catch (err: any) {
          console.error(`[Dubbing Pipeline] TTS generation failed for segment ${seg.index}:`, err.message);
          throw new Error(`Voice generation failed: ${err.message}`);
        }

        const tempPartMp3 = path.join(tempDir, `tts_raw_${seg.index}.mp3`);
        const rawWav = path.join(tempDir, `tts_raw_${seg.index}.wav`);
        const partPath = path.join(tempDir, `tts_${seg.index}.wav`);
        await fs.writeFile(tempPartMp3, audioBuffer);
        await ffmpegService.convertToWav(tempPartMp3, rawWav);

        const originalDuration = await ffmpegService.getAudioDurationMs(rawWav);
        let sourceWav = rawWav;
        try {
            await ffmpegService.trimSilenceWav(rawWav, partPath, -55, 0.05);
            const trimmedDuration = await ffmpegService.getAudioDurationMs(partPath);
            if (trimmedDuration >= originalDuration * 0.5) {
                sourceWav = partPath;
                console.log(`[Dubbing Pipeline] Silence trimmed segment ${seg.index}: ${originalDuration}ms -> ${trimmedDuration}ms`);
            } else {
                console.warn(`[Dubbing Pipeline] Silence trim too aggressive for segment ${seg.index}, using original`);
                await fs.copyFile(rawWav, partPath).catch(() => {});
            }
        } catch (err: any) {
            console.warn(`[Dubbing Pipeline] Silence trim failed for segment ${seg.index}: ${err.message}`);
            await fs.copyFile(rawWav, partPath).catch(() => {});
        }

        const duration = await ffmpegService.getAudioDurationMs(sourceWav);
        return { partPath: sourceWav, duration, text: seg.translatedText, index: seg.index };
      }

      async function runWithConcurrency<T>(items: typeof activeSegments, fn: (item: typeof activeSegments[0]) => Promise<T>, limit: number): Promise<T[]> {
        const results: T[] = new Array(items.length);
        let running = 0;
        let nextIndex = 0;
        return new Promise<T[]>((resolve, reject) => {
          function launchNext() {
            while (running < limit && nextIndex < items.length) {
              const idx = nextIndex++;
              running++;
              fn(items[idx])
                .then(result => {
                  results[idx] = result;
                  if (jobId) {
                    const ttsProgress = 50 + Math.floor((results.filter(r => r).length / items.length) * 25);
                    updateJob(jobId, { progress: ttsProgress, message: `Generating Myanmar voice (${results.filter(r => r).length}/${items.length})...` });
                  }
                })
                .catch(reject)
                .finally(() => { running--; launchNext(); });
            }
            if (running === 0 && nextIndex === items.length) resolve(results);
          }
          launchNext();
        });
      }

      const ttsResults = await runWithConcurrency(activeSegments, generateTtsForSegment, CONCURRENCY);
      console.log(`[Dubbing Pipeline] Step 5 OK: ${ttsResults.length} TTS segments generated`);

      // ── EXTRACT VIDEO WITHOUT AUDIO ──
      const videoOnlyPath = path.join(tempDir, `video_only.mp4`);
      await ffmpegService.extractVideoOnly(tempVideoPath, videoOnlyPath);

      // ── BUILD TTS TRACK: concatenate all TTS segments ──

      // ── BUILD TTS TRACK: concatenate all TTS segments ──
      const ttsTrackParts: string[] = [];
      for (let i = 0; i < activeSegments.length; i++) {
        const result = ttsResults[i];
        if (!result) continue;
        ttsTrackParts.push(result.partPath);
      }

      const ttsConcatedPath = path.join(tempDir, `tts_concated.wav`);
      await ffmpegService.concatAudioFiles(ttsTrackParts, ttsConcatedPath);

      const videoDurationMs = Math.round(videoDurationSec * 1000);
      const ttsDurationMs = await ffmpegService.getAudioDurationMs(ttsConcatedPath);
      let finalTtsTrackPath = ttsConcatedPath;
      const diff = videoDurationMs - ttsDurationMs;

      if (Math.abs(diff) > 10) {
        finalTtsTrackPath = path.join(tempDir, `tts_synced.wav`);
        if (diff > 0) {
          console.log(`[Dubbing Pipeline] Padding: video=${videoDurationMs}ms tts=${ttsDurationMs}ms diff=${diff}ms`);
          await ffmpegService.padAudioWithSilence(ttsConcatedPath, finalTtsTrackPath, videoDurationMs);
        } else {
          console.log(`[Dubbing Pipeline] Stretching: video=${videoDurationMs}ms tts=${ttsDurationMs}ms diff=${diff}ms`);
          await ffmpegService.adjustAudioSpeed(ttsConcatedPath, finalTtsTrackPath, videoDurationMs / ttsDurationMs);
        }
      } else {
        console.log(`[Dubbing Pipeline] Match: video=${videoDurationMs}ms tts=${ttsDurationMs}ms`);
      }

      // ── BUILD SUBTITLE TIMING (from original video timestamps) ──
      let currentMs = 0;
      const segOutputPositions: Array<{ index: number; startMs: number; endMs: number }> = [];

      for (let i = 0; i < activeSegments.length; i++) {
        const seg = activeSegments[i];
        const segDur = Math.round((seg.end - seg.start) * 1000);
        segOutputPositions.push({ index: seg.index, startMs: currentMs, endMs: currentMs + segDur });
        currentMs += segDur;
      }

      const maxCharsPerLine = Math.max(12, Math.round(40 - (options.srtFontSize ?? 24) * 0.5));
      const processedForSrt: Array<{ startMs: number; endMs: number; text: string }> = [];

      for (let i = 0; i < segOutputPositions.length; i++) {
        const pos = segOutputPositions[i];
        const result = ttsResults.find(r => r && r.index === pos.index);
        const text = result?.text || '';
        const endMs = i < segOutputPositions.length - 1 ? segOutputPositions[i + 1].startMs : currentMs;

        const chunks = splitToSubtitleChunks(text, maxCharsPerLine);
        if (chunks.length === 1) {
          processedForSrt.push({ startMs: pos.startMs, endMs, text: chunks[0] });
        } else {
          const totalDuration = endMs - pos.startMs;
          const perChunk = Math.floor(totalDuration / chunks.length);
          for (let c = 0; c < chunks.length; c++) {
            processedForSrt.push({
              startMs: pos.startMs + c * perChunk,
              endMs: c < chunks.length - 1 ? pos.startMs + (c + 1) * perChunk : endMs,
              text: chunks[c],
            });
          }
        }
      }

      // Merge
      const fontPath = process.env.MYANMAR_FONT_PATH || (process.platform === "win32" ? "C:/Windows/Fonts/mmrtext.ttf" : "/usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf");

      const hasSubtitles = options.srtEnabled !== false && processedForSrt.length > 0;
      if (hasSubtitles) {
        console.log(`[Dubbing Pipeline] Building subtitles...`);
        const videoDimensions = await ffmpegService.getVideoSize(tempVideoPath);
        const assContent = assBuilderService.buildAssContent(processedForSrt, fontPath, videoDimensions.width, videoDimensions.height, options as any);
        await fs.writeFile(tempAssPath, assContent);
      }

      console.log(`[Dubbing Pipeline] Merging video + TTS track${hasSubtitles ? ' + subtitles' : ''}...`);
      await ffmpegService.mergeDubbedVideoSimple(
        videoOnlyPath,
        finalTtsTrackPath,
        tempOutputPath,
        {
          subtitlesPath: hasSubtitles ? tempAssPath : undefined,
          fontPath: hasSubtitles ? fontPath : undefined,
          onProgress: (p: number) => {
            if (jobId) updateJob(jobId, { progress: 85 + Math.floor((p / 100) * 10), message: "Merging visuals with audio..." });
          },
        }
      );

      // Move to final
      const finalFilename = `dub_${id}.mp4`;
      const finalDir = path.join(process.cwd(), "static", "downloads");
      await fs.mkdir(finalDir, { recursive: true });
      const finalPath = path.join(finalDir, finalFilename);
      await fs.copyFile(tempOutputPath, finalPath);

      const totalDurationMs = processedForSrt.length > 0 ? processedForSrt[processedForSrt.length - 1].endMs : 0;
      const allTranslatedText = translatedSegments.map(s => s.translatedText).join("\n");
      const allSrtContent = processedForSrt.map((s, i) => {
        const start = formatTimestamp(s.startMs);
        const end = formatTimestamp(s.endMs);
        return `${i + 1}\n${start} --> ${end}\n${s.text}\n`;
      }).join("\n");

      return {
        videoUrl: `/downloads/${finalFilename}`,
        filename: finalFilename,
        id,
        myanmarText: allTranslatedText,
        srtContent: allSrtContent,
        durationMs: totalDurationMs,
      };

    } catch (err) {
      console.error("[Dubbing Pipeline Error]", err);
      throw err;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export const dubVideoPipeline = new DubVideoPipeline();
