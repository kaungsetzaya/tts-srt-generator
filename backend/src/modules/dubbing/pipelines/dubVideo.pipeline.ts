import { randomUUID } from "crypto";
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

// Individual Services as per ARCHITECTURE.md
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

/**
 * Split text into chunks of max 2 lines each, based on grapheme length.
 * Returns an array of text chunks, each fitting within 2 lines.
 */
const segmenter = new Intl.Segmenter("my", { granularity: "grapheme" });
function graphemeLen(s: string): number {
    return [...segmenter.segment(s)].length;
}

function splitToSubtitleChunks(text: string, maxCharsPerLine: number): string[] {
    // Clean up text Ã¢â‚¬â€ flatten newlines
    const clean = text.replace(/[\n\r]+/g, " ").trim();
    if (!clean) return [""];

    const maxCharsPerEntry = maxCharsPerLine * 2;
    const glen = graphemeLen(clean);

    // If it fits in one entry (1 or 2 lines), just return it
    if (glen <= maxCharsPerEntry) {
        // Split to 2 lines if needed
        if (glen > maxCharsPerLine) {
            const mid = Math.ceil(glen / 2);
            const graphemes = [...segmenter.segment(clean)].map(g => g.segment);
            const line1 = graphemes.slice(0, mid).join("").trim();
            const line2 = graphemes.slice(mid).join("").trim();
            return [line1 + "\n" + line2];
        }
        return [clean];
    }

    // Text is too long for 2 lines Ã¢â‚¬â€ split into multiple entries
    const graphemes = [...segmenter.segment(clean)].map(g => g.segment);
    const chunks: string[] = [];
    let pos = 0;

    while (pos < graphemes.length) {
        const remaining = graphemes.length - pos;
        const chunkSize = Math.min(maxCharsPerEntry, remaining);
        const chunkGraphemes = graphemes.slice(pos, pos + chunkSize);
        const chunkText = chunkGraphemes.join("");

        // Split this chunk into 2 lines if it's longer than 1 line
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
  /**
   * Orchestrates dubbing from a remote URL.
   */
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

  /**
   * Orchestrates the multi-step dubbing process.
   * Step-by-step numbering as per ARCHITECTURE.md compliance.
   */
  async execute(videoBuffer: Buffer, filename: string, options: DubOptions, jobId?: string) {
    const id = randomUUID();
    const tempDir = path.join(tmpdir(), `dub_pipe_${id}`);
    await fs.mkdir(tempDir, { recursive: true });

    const tempVideoPath = path.join(tempDir, `input.mp4`);
    const tempAudioExtract = path.join(tempDir, `extracted.mp3`);
    const tempFinalAudio = path.join(tempDir, `final_audio.mp3`);
    const tempAssPath = path.join(tempDir, `subtitles.ass`);
    const tempOutputPath = path.join(tempDir, `output.mp4`);

    try {
      // Step 1: Write video and validate metadata
      if (jobId) updateJob(jobId, { progress: 10, message: "Initializing video data..." });
      await fs.writeFile(tempVideoPath, videoBuffer);
      const videoDurationSec = await ffmpegService.getVideoDuration(tempVideoPath);
      if (videoDurationSec > 150) throw new Error("Video too long. Max 2min 30sec.");
      console.log(`[Dubbing Pipeline] Step 1 OK: video duration ${videoDurationSec}s`);

      // Step 2: Extract audio for transcription
      if (jobId) updateJob(jobId, { progress: 20, message: "Extracting audio for analysis..." });
      await ffmpegService.extractAudio(tempVideoPath, tempAudioExtract);
      console.log(`[Dubbing Pipeline] Step 2 OK: audio extracted`);

      // Step 3: Transcribe with Whisper
      if (jobId) updateJob(jobId, { progress: 35, message: "Transcribing speech..." });
      const segments = await whisperService.transcribe(tempAudioExtract);
      if (segments.length === 0) throw new Error("No speech detected in video");
      console.log(`[Dubbing Pipeline] Step 3 OK: ${segments.length} segments transcribed`);

      // Step 4: Translate segments with Gemini
      if (jobId) updateJob(jobId, { progress: 50, message: "Translating to Myanmar..." });
      const translatedSegments = await geminiService.translateSegments(
        segments.map((s, i) => ({ index: i, start: s.start, end: s.end, text: s.text })),
        options.userApiKey
      );
      console.log(`[Dubbing Pipeline] Step 4 OK: translated segments ready`);

      // Step 5: Generate TTS per segment (concurrent with limiter)
      const FIXED_SPEED = 1.1;
      const TINY_PAUSE_MS = 100;
      const CONCURRENCY = 1;

      const activeSegments = translatedSegments.filter(seg => seg.translatedText.trim());

      if (activeSegments.length === 0) {
        throw new Error("No translated segments to generate voice for.");
      }

      async function generateTtsForSegment(seg: typeof translatedSegments[0]): Promise<{ partPath: string; duration: number; text: string; index: number }> {
        const isCharacter = options.voice in CHARACTER_VOICES;
        let audioBuffer: Buffer;

        try {
          console.log(`[Dubbing Pipeline] Generating TTS for segment ${seg.index}: "${seg.translatedText.slice(0, 50)}..." (voice: ${options.voice})`);
          if (isCharacter) {
              const ttsResult = await ttsService.generateSpeechWithCharacter(
                  seg.translatedText,
                  options.voice as CharacterKey,
                  FIXED_SPEED,
                  "16:9",
                  options.pitch ?? 0
              );
              audioBuffer = ttsResult.audioBuffer;
          } else {
              const ttsResult = await ttsService.generateSpeech(seg.translatedText, options.voice as VoiceKey, FIXED_SPEED, options.pitch ?? 0, "16:9");
              audioBuffer = ttsResult.audioBuffer;
          }
          console.log(`[Dubbing Pipeline] TTS generated for segment ${seg.index}, audio size: ${audioBuffer.length} bytes`);
        } catch (err: any) {
          console.error(`[Dubbing Pipeline] TTS generation failed for segment ${seg.index}:`, err.message);
          throw new Error(`Voice generation failed: ${err.message}`);
        }

        // Write raw MP3 from TTS engine then convert to WAV for accurate concat
        const tempPartMp3 = path.join(tempDir, `tts_raw_${seg.index}.mp3`);
        const partPath    = path.join(tempDir, `tts_${seg.index}.wav`);
        await fs.writeFile(tempPartMp3, audioBuffer);

        // Trim leading/trailing silence from TTS engine output
        const trimmedMp3  = path.join(tempDir, `tts_trim_${seg.index}.mp3`);
        const originalDuration = await ffmpegService.getAudioDurationMs(tempPartMp3);
        let sourceMp3 = tempPartMp3;
        try {
            await ffmpegService.runFilter(
                tempPartMp3,
                'silenceremove=start_periods=1:start_duration=0.05:start_threshold=-55dB:stop_periods=1:stop_duration=0.05:stop_threshold=-55dB',
                trimmedMp3
            );
            const trimmedDuration = await ffmpegService.getAudioDurationMs(trimmedMp3);
            if (trimmedDuration >= originalDuration * 0.5) {
                sourceMp3 = trimmedMp3;
                console.log(`[Dubbing Pipeline] Silence trimmed segment ${seg.index}: ${originalDuration}ms → ${trimmedDuration}ms`);
            } else {
                console.warn(`[Dubbing Pipeline] Silence trim too aggressive for segment ${seg.index}, using original`);
            }
        } catch (err: any) {
            console.warn(`[Dubbing Pipeline] Silence trim failed for segment ${seg.index}: ${err.message}`);
        }

        // Convert to PCM WAV for sample-accurate concatenation
        await ffmpegService.convertToWav(sourceMp3, partPath);
        const duration = await ffmpegService.getAudioDurationMs(partPath);

        return { partPath, duration, text: seg.translatedText, index: seg.index };
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
            if (running === 0 && nextIndex === items.length) {
              resolve(results);
            }
          }
          launchNext();
        });
      }

      const ttsResults = await runWithConcurrency(activeSegments, generateTtsForSegment, CONCURRENCY);
      console.log(`[Dubbing Pipeline] Step 5 OK: ${ttsResults.length} TTS segments generated`);

      const audioParts: string[] = [];
      const audioTimeline: Array<{ startMs: number; endMs: number; text: string }> = [];
      let timelinePosMs = 0;

      // Generate silence parts as WAV (matches concatAudioFiles WAV output)
      // This avoids MP3 encoder-delay accumulation across silence inserts.
      for (let i = 0; i < activeSegments.length; i++) {
        const seg = activeSegments[i];
        const result = ttsResults[i];
        if (!result) {
          console.error(`[Dubbing Pipeline] Missing TTS result for segment ${i}`);
          continue;
        }

        const targetStartMs = Math.round(seg.start * 1000);
        const targetEndMs   = Math.round(seg.end * 1000);
        const targetDurationMs = Math.max(targetEndMs - targetStartMs, 100);

        // Fill gap from current position to original segment start with silence
        const gapMs = targetStartMs - timelinePosMs;
        if (gapMs > 10) {
          const silencePath = path.join(tempDir, `gap_${i}.wav`);
          await ffmpegService.generateSilenceWav(gapMs, silencePath);
          audioParts.push(silencePath);
          timelinePosMs += gapMs;
        }

        // Speed up TTS if longer than the target window
        let finalAudioPath = result.partPath;
        let actualDurationMs = result.duration;

        if (result.duration > targetDurationMs * 1.05) {
          const speedRatio = targetDurationMs / result.duration;
          const spedUpPath = path.join(tempDir, `sped_${seg.index}.wav`);
          try {
            await ffmpegService.speedUpAudioWav(result.partPath, spedUpPath, speedRatio);
            finalAudioPath = spedUpPath;
            actualDurationMs = await ffmpegService.getAudioDurationMs(spedUpPath);
            console.log(`[Dubbing Pipeline] Segment ${seg.index} sped up ${speedRatio.toFixed(3)}x → ${actualDurationMs}ms`);
          } catch (err: any) {
            console.warn(`[Dubbing Pipeline] Speed up failed for segment ${seg.index}, using original: ${err.message}`);
          }
        }

        // Record where this audio sits in the timeline BEFORE advancing
        const segStartMs = timelinePosMs;
        const segEndMs   = timelinePosMs + actualDurationMs;

        // Convert TTS part to WAV if it isn't already (silence removals produce MP3)
        let wavPartPath = finalAudioPath;
        if (!finalAudioPath.endsWith('.wav')) {
          wavPartPath = finalAudioPath.replace(/\.[^.]+$/, '_pcm.wav');
          await ffmpegService.convertToWav(finalAudioPath, wavPartPath);
        }

        audioParts.push(wavPartPath);
        audioTimeline.push({
          startMs: segStartMs,
          endMs:   segEndMs,
          text:    result.text,
        });

        timelinePosMs = segEndMs;
      }

      // Add trailing silence to match video duration (WAV for accurate concat)
      const videoDurationMs = Math.round(videoDurationSec * 1000);
      if (timelinePosMs < videoDurationMs) {
        const trailingSilencePath = path.join(tempDir, `trailing_silence.wav`);
        await ffmpegService.generateSilenceWav(videoDurationMs - timelinePosMs, trailingSilencePath);
        audioParts.push(trailingSilencePath);
        timelinePosMs = videoDurationMs;
      }
      
      if (audioParts.length === 0) {
        throw new Error("No audio parts generated - all TTS segments failed");
      }

      // Build subtitle entries — timing anchored to actual audio position.
      // Subtitle starts exactly when its audio starts, ends when the audio ends
      // plus a small hold (150ms) so it doesn't flash away. Never bleeds into
      // the next segment's start so there's no overlap during silences.
      const maxCharsPerLine = Math.max(12, Math.round(40 - (options.srtFontSize ?? 24) * 0.5));
      const processedForSrt: Array<{ startMs: number; endMs: number; text: string }> = [];

      for (let i = 0; i < audioTimeline.length; i++) {
        const seg = audioTimeline[i];
        const subtitleStartMs = seg.startMs;
        // Hold subtitle visible until the next subtitle appears (covers silence gaps).
        // The last subtitle stays until the end of the video.
        const subtitleEndMs = i < audioTimeline.length - 1
          ? audioTimeline[i + 1].startMs
          : timelinePosMs;

        const chunks = splitToSubtitleChunks(seg.text, maxCharsPerLine);

        if (chunks.length === 1) {
          processedForSrt.push({
            startMs: subtitleStartMs,
            endMs:   subtitleEndMs,
            text:    chunks[0],
          });
        } else {
          const totalDuration = subtitleEndMs - subtitleStartMs;
          const perChunkDuration = Math.floor(totalDuration / chunks.length);
          for (let c = 0; c < chunks.length; c++) {
            processedForSrt.push({
              startMs: subtitleStartMs + c * perChunkDuration,
              endMs:   c < chunks.length - 1
                ? subtitleStartMs + (c + 1) * perChunkDuration
                : subtitleEndMs,
              text: chunks[c],
            });
          }
        }
      }

      // Final audio duration
      const totalAudioDurationSec = timelinePosMs / 1000;
      
      if (totalAudioDurationSec < 1.0) {
        throw new Error(`Generated narration too short (${totalAudioDurationSec.toFixed(2)}s). TTS may have failed.`);
      }
      
      // Calculate speed ratio to make video match narration
      // Clamp to reasonable range: 0.5x (slow down) to 2.0x (speed up)
      const rawRatio = totalAudioDurationSec / videoDurationSec;
      const videoSpeedRatio = Math.max(0.5, Math.min(2.0, rawRatio));

      console.log(`[Dubbing Pipeline] Narration duration: ${totalAudioDurationSec.toFixed(2)}s, Original video: ${videoDurationSec.toFixed(2)}s`);
      if (videoSpeedRatio !== rawRatio) {
        console.warn(`[Dubbing Pipeline] Speed ratio clamped from ${rawRatio.toFixed(4)} to ${videoSpeedRatio.toFixed(4)}`);
      }
      console.log(`[Dubbing Pipeline] Applying video speed ratio: ${videoSpeedRatio.toFixed(4)}`);

      // Step 6: Concat audio parts and merge with video
      // concatAudioFiles now outputs a sample-accurate PCM WAV directly.
      const tempConcatAudio = path.join(tempDir, `concat_raw.wav`);
      
      // Step 6a: Concatenate audio parts using ffmpeg concat demuxer (sample-accurate)
      if (jobId) updateJob(jobId, { progress: 80, message: "Assembling final narration..." });
      console.log(`[Dubbing Pipeline] Concatenating ${audioParts.length} audio parts...`);
      await ffmpegService.concatAudioFiles(audioParts, tempConcatAudio);
      console.log(`[Dubbing Pipeline] Audio concatenated to ${tempConcatAudio}`);

      // Step 6b: Audio is already PCM WAV from concatAudioFiles — no re-encode needed.
      const tempWavAudio = tempConcatAudio;
      console.log(`[Dubbing Pipeline] Using WAV audio: ${tempWavAudio}`);
      let finalAudioPath = tempWavAudio;
      
      // Step 6c: Subtitles - cross-platform font resolution
      const fontPath = process.env.MYANMAR_FONT_PATH || 
        (process.platform === "win32" 
          ? "C:/Windows/Fonts/mmrtext.ttf" 
          : "/usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf");
      
      console.log(`[Dubbing Pipeline] Using font: ${fontPath}`);
      
      if (!existsSync(finalAudioPath)) {
        throw new Error("Final concatenated audio file not found.");
      }

      const audioStats = await fs.stat(finalAudioPath);
      if (audioStats.size === 0) {
        throw new Error("Final concatenated audio file is empty.");
      }

      try {
        if (options.srtEnabled !== false && processedForSrt.length > 0) {
          console.log(`[Dubbing Pipeline] Merging video with audio and subtitles...`);
          const videoDimensions = await ffmpegService.getVideoSize(tempVideoPath);
          
          const assContent = assBuilderService.buildAssContent(processedForSrt, fontPath, videoDimensions.width, videoDimensions.height, options as any);
          await fs.writeFile(tempAssPath, assContent);
          await ffmpegService.mergeVideoAudioSubtitles(tempVideoPath, finalAudioPath, tempAssPath, tempOutputPath, {
            videoDurationSec: totalAudioDurationSec, // New duration
            videoSpeedRatio,
            fontPath,
            onProgress: (p: number) => {
              if (jobId) {
                const mergeProgress = 85 + Math.floor((p / 100) * 10);
                updateJob(jobId, { progress: mergeProgress, message: "Merging visuals with audio..." });
              }
            }
          });
        } else {
          console.log(`[Dubbing Pipeline] Merging video with audio...`);
          await ffmpegService.mergeVideoAudio(tempVideoPath, finalAudioPath, tempOutputPath, {
            videoDurationSec: totalAudioDurationSec, // New duration
            videoSpeedRatio,
            onProgress: (p: number) => {
              if (jobId) {
                const mergeProgress = 85 + Math.floor((p / 100) * 10);
                updateJob(jobId, { progress: mergeProgress, message: "Merging visuals with audio..." });
              }
            }
          });
        }
      } catch (err: any) {
        console.error("[Dubbing Pipeline] Merge step failed:", err.message);
        throw err;
      }

      // Step 8: Move to final storage
      const finalFilename = `dub_${id}.mp4`;
      const finalDir = path.join(process.cwd(), "static", "downloads");
      await fs.mkdir(finalDir, { recursive: true });
      const finalPath = path.join(finalDir, finalFilename);
      await fs.copyFile(tempOutputPath, finalPath);

      const totalDurationMs = processedForSrt.length > 0
          ? processedForSrt[processedForSrt.length - 1].endMs
          : 0;

      const allTranslatedText = translatedSegments.map(s => s.translatedText).join("\n");
      
      const allSrtContent = processedForSrt
          .map((s, i) => {
              const start = formatTimestamp(s.startMs);
              const end = formatTimestamp(s.endMs);
              return `${i + 1}\n${start} --> ${end}\n${s.text}\n`;
          })
          .join("\n");

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
