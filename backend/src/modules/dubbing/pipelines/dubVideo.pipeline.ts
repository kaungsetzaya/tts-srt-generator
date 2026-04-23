import { randomUUID } from "crypto";
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

import { ffmpegService } from '../../media/services/ffmpeg.service';
import { getVideoInfo, downloadVideo } from '../../media/services/downloader.service';
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

// ── Segment type ──
interface ActiveSegment {
  index: number;
  start: number;  // seconds
  end: number;    // seconds
  translatedText: string;
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

    const tempVideoPath    = path.join(tempDir, 'input.mp4');
    const tempAudioExtract = path.join(tempDir, 'extracted.mp3');
    const tempAssPath      = path.join(tempDir, 'subtitles.ass');
    const tempOutputPath   = path.join(tempDir, 'output.mp4');

    try {
      // ── Step 1: Write & validate ──
      if (jobId) updateJob(jobId, { progress: 10, message: "Initializing video data..." });
      await fs.writeFile(tempVideoPath, videoBuffer);
      const videoDurationSec = await ffmpegService.getVideoDuration(tempVideoPath);
      if (videoDurationSec > 150) throw new Error("Video too long. Max 2min 30sec.");
      console.log(`[Dub] video duration: ${videoDurationSec}s`);

      // ── Step 2: Extract audio ──
      if (jobId) updateJob(jobId, { progress: 20, message: "Extracting audio..." });
      await ffmpegService.extractAudio(tempVideoPath, tempAudioExtract);

      // ── Step 3: Transcribe ──
      if (jobId) updateJob(jobId, { progress: 35, message: "Transcribing speech..." });
      const segments = await whisperService.transcribe(tempAudioExtract);
      if (segments.length === 0) throw new Error("No speech detected in video");
      console.log(`[Dub] transcribed: ${segments.length} segments`);

      // ── Step 4: Translate ──
      if (jobId) updateJob(jobId, { progress: 50, message: "Translating to Myanmar..." });
      const translatedSegments = await geminiService.translateSegments(
        segments.map((s, i) => ({ index: i, start: s.start, end: s.end, text: s.text })),
        options.userApiKey
      );

      // ── Step 4b: Merge short segments ──
      function mergeShortSegments(segs: typeof translatedSegments): ActiveSegment[] {
        const MIN_SLOT_MS = 1500;
        const MAX_SLOT_MS = 5000;
        if (segs.length === 0) return [];
        const filtered = segs.filter(s => s.translatedText.trim());
        const merged: ActiveSegment[] = [];
        let current = { ...filtered[0] };
        for (let i = 1; i < filtered.length; i++) {
          const currentSlotMs = (current.end - current.start) * 1000;
          const gap = filtered[i].start - current.end;
          const mergedSlotMs = (filtered[i].end - current.start) * 1000;
          if (currentSlotMs < MIN_SLOT_MS && gap < 0.5 && mergedSlotMs <= MAX_SLOT_MS) {
            current = {
              ...current,
              end: filtered[i].end,
              translatedText: current.translatedText + ' ' + filtered[i].translatedText,
            };
            console.log(`[Merge] ${current.index}+${filtered[i].index} → ${mergedSlotMs.toFixed(0)}ms`);
          } else {
            merged.push(current);
            current = { ...filtered[i] };
          }
        }
        merged.push(current);
        console.log(`[Dub] merged: ${filtered.length} → ${merged.length} segments`);
        return merged;
      }

      const activeSegments = mergeShortSegments(translatedSegments);
      if (activeSegments.length === 0) throw new Error("No segments to dub.");

      // ── Step 5: Generate TTS ──
      async function generateTts(seg: ActiveSegment): Promise<{ path: string; durationMs: number; text: string; index: number }> {
        console.log(`[TTS] seg ${seg.index}: "${seg.translatedText.slice(0, 40)}..."`);
        const isChar = options.voice in CHARACTER_VOICES;
        let audioBuffer: Buffer;
        if (isChar) {
          const r = await ttsService.generateSpeechWithCharacter(seg.translatedText, options.voice as CharacterKey, 1.0, "16:9", options.pitch ?? 0);
          audioBuffer = r.audioBuffer;
        } else {
          const r = await ttsService.generateSpeech(seg.translatedText, options.voice as VoiceKey, 1.0, options.pitch ?? 0, "16:9");
          audioBuffer = r.audioBuffer;
        }

        const mp3Path  = path.join(tempDir, `tts_raw_${seg.index}.mp3`);
        const rawWav   = path.join(tempDir, `tts_raw_${seg.index}.wav`);
        const trimWav  = path.join(tempDir, `tts_trim_${seg.index}.wav`);
        await fs.writeFile(mp3Path, audioBuffer);
        await ffmpegService.convertToWav(mp3Path, rawWav);

        let finalWav = rawWav;
        try {
          await ffmpegService.trimSilenceWav(rawWav, trimWav, -50, 0.05);
          const trimDur = await ffmpegService.getAudioDurationMs(trimWav);
          const rawDur  = await ffmpegService.getAudioDurationMs(rawWav);
          if (trimDur >= rawDur * 0.5) {
            finalWav = trimWav;
            console.log(`[TTS] trimmed seg ${seg.index}: ${rawDur}ms → ${trimDur}ms`);
          }
        } catch {}

        const durationMs = await ffmpegService.getAudioDurationMs(finalWav);
        const slotMs = (seg.end - seg.start) * 1000;
        console.log(`[TTS] seg ${seg.index}: tts=${durationMs}ms slot=${slotMs.toFixed(0)}ms ratio=${(durationMs/slotMs).toFixed(2)}x`);
        return { path: finalWav, durationMs, text: seg.translatedText, index: seg.index };
      }

      if (jobId) updateJob(jobId, { progress: 55, message: "Generating Myanmar voice..." });
      const ttsResults: Array<{ path: string; durationMs: number; text: string; index: number }> = [];
      for (let i = 0; i < activeSegments.length; i++) {
        const r = await generateTts(activeSegments[i]);
        ttsResults.push(r);
        if (jobId) updateJob(jobId, { progress: 55 + Math.floor((i + 1) / activeSegments.length * 20), message: `Generating voice (${i+1}/${activeSegments.length})...` });
      }
      console.log(`[Dub] TTS done: ${ttsResults.length} segments`);

      // ────────────────────────────────────────────────────────
      // KEY INSIGHT:
      // We build PARALLEL structures:
      //   videoTrack: [intro?] [seg0_video] [gap0?] [seg1_video] ... [outro?]
      //   audioTrack: [intro_silence?] [seg0_tts] [gap0_silence?] [seg1_tts] ... [outro_silence?]
      //
      // For each speech segment:
      //   - video is stretched/squeezed to match TTS duration exactly
      //   - audio is raw TTS (no warp)
      //   - gap uses REAL gap duration from original video (not TTS-based)
      // ────────────────────────────────────────────────────────

      const firstSeg = activeSegments[0];
      const lastSeg  = activeSegments[activeSegments.length - 1];

      // Struct to track each "slot" in both tracks
      interface TrackSlot {
        type: 'intro' | 'speech' | 'gap' | 'outro';
        videoFile: string;
        audioFile: string;
        durationMs: number; // the ACTUAL duration both tracks use for this slot
      }
      const slots: TrackSlot[] = [];

      // ── Intro ──
      if (firstSeg.start > 0.05) {
        const introDurMs = Math.round(firstSeg.start * 1000);
        const introVideo   = path.join(tempDir, 'vp_intro.mp4');
        const introSilence = path.join(tempDir, 'ap_intro.wav');
        await ffmpegService.extractVideoSegment(tempVideoPath, 0, firstSeg.start, introVideo);
        await ffmpegService.generateSilenceWav(introDurMs, introSilence);
        // measure actual video duration (codec may differ slightly)
        const actualDurMs = await ffmpegService.getAudioDurationMs(introVideo);
        slots.push({ type: 'intro', videoFile: introVideo, audioFile: introSilence, durationMs: actualDurMs });
      }

      // ── Speech segments + gaps ──
      for (let i = 0; i < activeSegments.length; i++) {
        const seg    = activeSegments[i];
        const result = ttsResults[i];
        const ttsDurMs = result.durationMs;

        // Video stretched to match TTS duration exactly
        const speechVideo = path.join(tempDir, `vp_speech_${seg.index}.mp4`);
        await ffmpegService.extractVideoSegment(
          tempVideoPath,
          seg.start,
          seg.end,
          speechVideo,
          ttsDurMs  // ← stretch video to TTS duration
        );
        // Verify actual rendered duration
        const actualVideoDurMs = await ffmpegService.getAudioDurationMs(speechVideo);

        // Pad TTS if video rendered slightly longer (codec rounding)
        let audioFile = result.path;
        if (actualVideoDurMs > ttsDurMs + 20) {
          const paddedPath = path.join(tempDir, `ap_speech_padded_${seg.index}.wav`);
          await ffmpegService.padAudioWithSilence(result.path, paddedPath, actualVideoDurMs);
          audioFile = paddedPath;
        }

        slots.push({ type: 'speech', videoFile: speechVideo, audioFile, durationMs: actualVideoDurMs });

        // ── Gap ──
        if (i < activeSegments.length - 1) {
          const nextSeg = activeSegments[i + 1];
          const gapStartSec = seg.end;
          const gapEndSec   = nextSeg.start;
          const gapDurMs    = Math.round((gapEndSec - gapStartSec) * 1000);
          if (gapDurMs > 50) {
            const gapVideo   = path.join(tempDir, `vp_gap_${i}.mp4`);
            const gapSilence = path.join(tempDir, `ap_gap_${i}.wav`);
            await ffmpegService.extractVideoSegment(tempVideoPath, gapStartSec, gapEndSec, gapVideo);
            const actualGapMs = await ffmpegService.getAudioDurationMs(gapVideo);
            await ffmpegService.generateSilenceWav(actualGapMs, gapSilence);
            slots.push({ type: 'gap', videoFile: gapVideo, audioFile: gapSilence, durationMs: actualGapMs });
          }
        }
      }

      // ── Outro ──
      if (videoDurationSec - lastSeg.end > 0.1) {
        const outroDurMs  = Math.round((videoDurationSec - lastSeg.end) * 1000);
        const outroVideo   = path.join(tempDir, 'vp_outro.mp4');
        const outroSilence = path.join(tempDir, 'ap_outro.wav');
        await ffmpegService.extractVideoSegment(tempVideoPath, lastSeg.end, videoDurationSec, outroVideo);
        const actualDurMs = await ffmpegService.getAudioDurationMs(outroVideo);
        await ffmpegService.generateSilenceWav(actualDurMs, outroSilence);
        slots.push({ type: 'outro', videoFile: outroVideo, audioFile: outroSilence, durationMs: actualDurMs });
      }

      // ── Log slots for debugging ──
      console.log('\n=== SLOTS ===');
      let totalVideoMs = 0;
      let totalAudioMs = 0;
      for (const slot of slots) {
        const aDurMs = await ffmpegService.getAudioDurationMs(slot.audioFile);
        console.log(`[${slot.type}] video=${slot.durationMs}ms audio=${aDurMs}ms`);
        totalVideoMs += slot.durationMs;
        totalAudioMs += aDurMs;
      }
      console.log(`TOTAL: video=${totalVideoMs}ms audio=${totalAudioMs}ms diff=${totalVideoMs - totalAudioMs}ms`);
      console.log('=============\n');

      // ── Concatenate video track ──
      const processedVideoPath = path.join(tempDir, 'processed_video.mp4');
      await ffmpegService.concatVideoFiles(slots.map(s => s.videoFile), processedVideoPath);

      // ── Concatenate audio track ──
      const ttsTrackPath = path.join(tempDir, 'tts_track.wav');
      await ffmpegService.concatAudioFiles(slots.map(s => s.audioFile), ttsTrackPath);

      // ── Final duration check ──
      const finalVideoDurMs = await ffmpegService.getAudioDurationMs(processedVideoPath);
      const finalAudioDurMs = await ffmpegService.getAudioDurationMs(ttsTrackPath);
      console.log(`[Dub] final video=${finalVideoDurMs}ms audio=${finalAudioDurMs}ms`);

      let finalAudioPath = ttsTrackPath;
      const finalDiff = finalVideoDurMs - finalAudioDurMs;
      if (finalDiff > 50) {
        finalAudioPath = path.join(tempDir, 'tts_padded.wav');
        await ffmpegService.padAudioWithSilence(ttsTrackPath, finalAudioPath, finalVideoDurMs);
        console.log(`[Dub] padded audio +${finalDiff}ms`);
      } else if (finalDiff < -50) {
        finalAudioPath = path.join(tempDir, 'tts_trimmed.wav');
        await ffmpegService.trimAudioToduration(ttsTrackPath, finalAudioPath, finalVideoDurMs);
        console.log(`[Dub] trimmed audio ${finalDiff}ms`);
      }

      // ── Build subtitles from slot timing ──
      const maxCharsPerLine = Math.max(12, Math.round(40 - (options.srtFontSize ?? 24) * 0.5));
      const processedForSrt: Array<{ startMs: number; endMs: number; text: string }> = [];
      let curMs = 0;
      for (const slot of slots) {
        if (slot.type === 'speech') {
          const seg    = activeSegments.find(s => slot.videoFile.includes(`speech_${s.index}`))!;
          const result = ttsResults.find(r => r.index === seg?.index);
          const text   = result?.text || '';
          const endMs  = curMs + slot.durationMs;
          const chunks = splitToSubtitleChunks(text, maxCharsPerLine);
          if (chunks.length === 1) {
            processedForSrt.push({ startMs: curMs, endMs, text: chunks[0] });
          } else {
            const perChunk = Math.floor(slot.durationMs / chunks.length);
            for (let c = 0; c < chunks.length; c++) {
              processedForSrt.push({
                startMs: curMs + c * perChunk,
                endMs: c < chunks.length - 1 ? curMs + (c + 1) * perChunk : endMs,
                text: chunks[c],
              });
            }
          }
        }
        curMs += slot.durationMs;
      }

      // ── Merge & export ──
      if (jobId) updateJob(jobId, { progress: 85, message: "Merging video + audio..." });
      const fontPath = process.env.MYANMAR_FONT_PATH ||
        (process.platform === 'win32'
          ? 'C:/Windows/Fonts/mmrtext.ttf'
          : '/usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf');

      const hasSubtitles = options.srtEnabled !== false && processedForSrt.length > 0;
      if (hasSubtitles) {
        const dims = await ffmpegService.getVideoSize(tempVideoPath);
        const assContent = assBuilderService.buildAssContent(processedForSrt, fontPath, dims.width, dims.height, options as any);
        await fs.writeFile(tempAssPath, assContent);
      }

      await ffmpegService.mergeDubbedVideoSimple(
        processedVideoPath,
        finalAudioPath,
        tempOutputPath,
        {
          subtitlesPath: hasSubtitles ? tempAssPath : undefined,
          fontPath:      hasSubtitles ? fontPath    : undefined,
          onProgress: (p) => {
            if (jobId) updateJob(jobId, { progress: 85 + Math.floor(p / 100 * 10), message: "Finalizing..." });
          },
        }
      );

      // ── Save output ──
      const finalFilename = `dub_${id}.mp4`;
      const finalDir  = path.join(process.cwd(), 'static', 'downloads');
      await fs.mkdir(finalDir, { recursive: true });
      await fs.copyFile(tempOutputPath, path.join(finalDir, finalFilename));

      const allTranslatedText = translatedSegments.map(s => s.translatedText).join('\n');
      const allSrtContent = processedForSrt.map((s, i) => {
        return `${i + 1}\n${formatTimestamp(s.startMs)} --> ${formatTimestamp(s.endMs)}\n${s.text}\n`;
      }).join('\n');

      return {
        videoUrl:    `/downloads/${finalFilename}`,
        filename:    finalFilename,
        id,
        myanmarText: allTranslatedText,
        srtContent:  allSrtContent,
        durationMs:  curMs,
      };

    } catch (err) {
      console.error('[Dub Error]', err);
      throw err;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export const dubVideoPipeline = new DubVideoPipeline();