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

function limitTo2Lines(text: string): string {
    const lines = text.split(/[\n\r]+/).filter(l => l.trim());
    if (lines.length > 2) {
        return lines.slice(0, 2).join("\n");
    }
    return lines.join("\n");
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
      return await this.execute(buffer, "video.mp4", options);
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

      // Step 2: Extract audio for transcription
      if (jobId) updateJob(jobId, { progress: 20, message: "Extracting audio for analysis..." });
      await ffmpegService.extractAudio(tempVideoPath, tempAudioExtract);

      // Step 3: Transcribe with Whisper
      if (jobId) updateJob(jobId, { progress: 35, message: "Transcribing speech..." });
      const segments = await whisperService.transcribe(tempAudioExtract);
      if (segments.length === 0) throw new Error("No speech detected in video");

      // Step 4: Translate segments with Gemini
      if (jobId) updateJob(jobId, { progress: 50, message: "Translating to Myanmar..." });
      const translatedSegments = await geminiService.translateSegments(
        segments.map((s, i) => ({ index: i, start: s.start, end: s.end, text: s.text })),
        options.userApiKey
      );

      // Step 5: Generate TTS per segment (concurrent with limiter)
      const FIXED_SPEED = 1.2;
      const TINY_PAUSE_MS = 150;
      const CONCURRENCY = 1;

      const activeSegments = translatedSegments.filter(seg => seg.translatedText.trim());

      async function generateTtsForSegment(seg: typeof translatedSegments[0]): Promise<{ partPath: string; duration: number; text: string; index: number }> {
        const isCharacter = options.voice in CHARACTER_VOICES;
        let audioBuffer: Buffer;

        if (isCharacter) {
            const ttsResult = await ttsService.generateSpeechWithCharacter(
                seg.translatedText,
                options.voice as CharacterKey,
                FIXED_SPEED,
                undefined,
                options.pitch ?? 0
            );
            audioBuffer = ttsResult.audioBuffer;
        } else {
            const ttsResult = await ttsService.generateSpeech(seg.translatedText, options.voice as VoiceKey, FIXED_SPEED, options.pitch ?? 0);
            audioBuffer = ttsResult.audioBuffer;
        }

        const partPath = path.join(tempDir, `tts_${seg.index}.mp3`);
        await fs.writeFile(partPath, audioBuffer);
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

      const audioParts: string[] = [];
      const processedForSrt: any[] = [];
      let timelinePosMs = 0;
      const NATURAL_PAUSE_MS = 200; // Natural gap between lines

      for (let i = 0; i < activeSegments.length; i++) {
        const result = ttsResults[i];
        
        // Add natural pause before segment (except the first one if it starts at 0)
        if (i > 0) {
          const silencePath = path.join(tempDir, `pause_${i}.mp3`);
          await ffmpegService.generateSilence(NATURAL_PAUSE_MS, silencePath);
          audioParts.push(silencePath);
          timelinePosMs += NATURAL_PAUSE_MS;
        } else {
           // First segment starts at its original intended time OR 0
           const startOffset = Math.round((activeSegments[0].start || 0) * 1000);
           if (startOffset > 0) {
             const silencePath = path.join(tempDir, `initial_pause.mp3`);
             await ffmpegService.generateSilence(startOffset, silencePath);
             audioParts.push(silencePath);
             timelinePosMs += startOffset;
           }
        }
        
        // Add the translated speech
        audioParts.push(result.partPath);
        processedForSrt.push({ 
          startMs: timelinePosMs, 
          endMs: timelinePosMs + result.duration, 
          text: result.text 
        });
        
        timelinePosMs += result.duration;
      }

      // Final audio duration
      const totalAudioDurationSec = timelinePosMs / 1000;
      
      // Calculate speed ratio to make video match narration
      // If audio is 65s and video is 60s, ratio is 1.083 (slows video down)
      const videoSpeedRatio = totalAudioDurationSec / videoDurationSec;

      console.log(`[Dubbing Pipeline] Narration duration: ${totalAudioDurationSec.toFixed(2)}s, Original video: ${videoDurationSec.toFixed(2)}s`);
      console.log(`[Dubbing Pipeline] Applying video speed ratio: ${videoSpeedRatio.toFixed(4)}`);

      // Step 6: Concat audio parts and merge with video
      const listPath = path.join(tempDir, "concat_list.txt");
      const listContent = audioParts.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
      await fs.writeFile(listPath, listContent);

      const tempConcatAudio = path.join(tempDir, `concat_raw.mp3`);
      
      // Step 6a: Actually concatenate audio parts using ffmpeg
      if (jobId) updateJob(jobId, { progress: 80, message: "Assembling final narration..." });
      await ffmpegService.concatAudioFiles(listPath, tempConcatAudio);

      // Step 6b: Character voice conversion (Module-to-Module call via Service)
      let finalAudioPath = tempConcatAudio;
      // ... murf logic would go here ...
      
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

      if (options.srtEnabled !== false && processedForSrt.length > 0) {
        console.log(`[Dubbing Pipeline] Merging video with audio and subtitles...`);
        const videoDimensions = await ffmpegService.getVideoSize(tempVideoPath);
        
        const limitedSegments = processedForSrt.map(s => ({
            ...s,
            text: limitTo2Lines(s.text)
        }));
        
        const assContent = assBuilderService.buildAssContent(limitedSegments, fontPath, videoDimensions.width, videoDimensions.height, options as any);
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
              const limitedText = limitTo2Lines(s.text);
              return `${i + 1}\n${start} --> ${end}\n${limitedText}\n`;
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
