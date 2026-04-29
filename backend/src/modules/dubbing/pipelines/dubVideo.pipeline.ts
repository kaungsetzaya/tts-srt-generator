import { randomUUID } from "crypto";
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

import ffmpeg from 'fluent-ffmpeg';
import { ffmpegService } from '../../media/services/ffmpeg.service';
import { getVideoInfo, downloadVideo } from '../../media/services/downloader.service';
import { whisperService } from '../../translation/services/whisper.service';
import { geminiService } from '../../translation/services/gemini.service';
import { ttsService } from '../../tts/tts.service';
import { TIER2_VOICES, type VoiceId, type Tier2VoiceId } from '../../tts/voices';
import { assBuilderService } from '../services/assBuilder.service';
import { isAllowedVideoUrl } from '../../../../_core/security';
import { updateJob } from '../../../../jobs';
import { generateSignedDownloadUrl } from '../../../../_core/signedUrl';
import { generateShortId, buildOutputFilename } from '../../../../src/modules/_core/filename';

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
    const clean = text.replace(/[\r]+/g, "").trim();
    if (!clean) return [""];

    // AI က \n ထည့်ပေးပြီးသားဆိုရင် အဲ့ဒီအတိုင်း သုံး - time ထပ်မခွဲ
    if (clean.includes('\n')) {
        const parts = clean.split('\n').map(p => p.trim()).filter(p => p);
        return [parts.slice(0, 2).join('\n')];
    }

    const graphemes = [...segmenter.segment(clean)].map(g => g.segment);

    // တိုနေရင် ၁ ကြောင်းတည်း
    if (graphemes.length <= maxCharsPerLine) {
        return [clean];
    }

    // ရှည်နေရင် အလယ်နားက သင့်တော်တဲ့နေရာမှ ၂ ကြောင်းခွဲ
    const mid = Math.floor(graphemes.length / 2);
    let splitIndex = mid;

    for (let i = 0; i < 15; i++) {
        if (mid + i < graphemes.length &&
            (graphemes[mid + i] === ' ' || graphemes[mid + i] === '၊' || graphemes[mid + i] === '။')) {
            splitIndex = mid + i + 1;
            break;
        }
        if (mid - i > 0 &&
            (graphemes[mid - i] === ' ' || graphemes[mid - i] === '၊' || graphemes[mid - i] === '။')) {
            splitIndex = mid - i + 1;
            break;
        }
    }

    const line1 = graphemes.slice(0, splitIndex).join("").trim();
    const line2 = graphemes.slice(splitIndex).join("").trim();

    return [line1 + "\n" + line2];
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
      const dl = await downloadVideo(url, tempVideoPath);
      if (!dl.success) throw new Error(dl.error || "Download failed");
      const buffer = await fs.readFile(tempVideoPath);
      return await this.execute(buffer, "video.mp4", options, jobId);
    } finally {
      await fs.unlink(tempVideoPath).catch(() => {});
    }
  }

  async execute(videoBuffer: Buffer, filename: string, options: DubOptions, jobId?: string) {
    const shortId = generateShortId();
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

      // ── English က ကျန်နေတဲ့ segments တွေ retry ──
      const isEnglish = (t: string) => /^[a-zA-Z0-9\s.,!?'"()\-:;]+$/.test(t.trim());
      const badSegs = translatedSegments.filter(s => s.translatedText.trim() && isEnglish(s.translatedText));

      if (badSegs.length > 0) {
        console.warn(`[Dub] ${badSegs.length} segments still English, retrying...`);
        const retried = await geminiService.translateSegments(
          badSegs.map(s => ({ index: s.index, start: s.start, end: s.end, text: s.text })),
          options.userApiKey
        );
        for (const r of retried) {
          const idx = translatedSegments.findIndex(s => s.index === r.index);
          if (idx !== -1) translatedSegments[idx].translatedText = r.translatedText;
        }
      }

      // ── Step 4b: Merge short segments ──
      function mergeShortSegments(segs: typeof translatedSegments): ActiveSegment[] {
        const MIN_SLOT_MS = 2000;   // ← 1500 → 2000
        const MAX_SLOT_MS = 6000;   // ← 3500 → 6000
        const MAX_GAP_SEC = 1.5;    // ← 0.5 → 1.5  ← ဒါပဲ အဓိက
        if (segs.length === 0) return [];
        const filtered = segs.filter(s => s.translatedText.trim());
        const merged: ActiveSegment[] = [];
        let current = { ...filtered[0] };
        for (let i = 1; i < filtered.length; i++) {
          const currentSlotMs = (current.end - current.start) * 1000;
          const gap = filtered[i].start - current.end;
          const mergedSlotMs = (filtered[i].end - current.start) * 1000;
          const shouldMerge =
            currentSlotMs < MIN_SLOT_MS &&
            gap < MAX_GAP_SEC &&        // ← 1.5s ထိ gap ရှိရင် merge လုပ်
            mergedSlotMs <= MAX_SLOT_MS;
          if (shouldMerge) {
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
        // TTS အတွက် \n ဖြုတ် (subtitle အတွက် original text ကို text field မှာ သိမ်းမယ်)
        const ttsText = seg.translatedText
          .replace(/\\n/g, ' ')
          .replace(/\n/g, ' ')
          .replace(/\.\.\./g, '။')
          .replace(/…/g, '။')
          // ── Extra Gemini junk ဖြုတ် ──
          .replace(/^\s*(Here is|Translation:|မြန်မာ:).*/gim, '')
          .replace(/\*\*[^*]+\*\*/g, '')
          .replace(/[#_*\[\]]/g, '')
          // ── Punctuation normalize ──
          .replace(/၊\s*/g, '၊ ')
          .replace(/။\s*/g, '။ ')
          .replace(/\s+/g, ' ')
          .trim();

        console.log(`[TTS] seg ${seg.index}: "${ttsText.slice(0, 40)}..."`);
        const r = await ttsService.generateSpeech(
          ttsText, options.voice as VoiceId,
          1.15,
          options.pitch ?? 0, "16:9"
        );
        let audioBuffer = r.audioBuffer;

        const mp3Path  = path.join(tempDir, `tts_raw_${seg.index}.mp3`);
        const rawWav   = path.join(tempDir, `tts_raw_${seg.index}.wav`);
        const trimWav  = path.join(tempDir, `tts_trim_${seg.index}.wav`);
        await fs.writeFile(mp3Path, audioBuffer);
        await ffmpegService.convertToWav(mp3Path, rawWav);

        let finalWav = rawWav;
        try {
          await ffmpegService.trimSilenceWav(rawWav, trimWav, -35, 0.1);
          const trimDur = await ffmpegService.getAudioDurationMs(trimWav);
          const rawDur  = await ffmpegService.getAudioDurationMs(rawWav);
          if (trimDur >= rawDur * 0.75) {  // 0.5 → 0.75
            finalWav = trimWav;
            console.log(`[TTS] trimmed seg ${seg.index}: ${rawDur}ms → ${trimDur}ms`);
          }
        } catch {}

        const durationMs = await ffmpegService.getAudioDurationMs(finalWav);
        const slotMs = (seg.end - seg.start) * 1000;
        let finalText = seg.translatedText;
        let finalDurationMs = durationMs;

        // ratio 1.5x ကျော်ရင် တိုတိုပြန်ပြောင်း retry
        if (durationMs / slotMs > 1.5) {
          console.warn(`[TTS] seg ${seg.index} ratio=${(durationMs/slotMs).toFixed(2)}x too high, retrying with shorter text...`);
          
          const shorterText = await geminiService.makeShorter(seg.translatedText, slotMs, options.userApiKey);
          if (shorterText) {
            const mp3Short = path.join(tempDir, `tts_short_${seg.index}.mp3`);
            const wavShort = path.join(tempDir, `tts_short_${seg.index}.wav`);
            let shortBuffer: Buffer;

            // Retry TTS မှာလည်း \n ဖြုတ်
            const retryTtsText = shorterText
              .replace(/\\n/g, ' ')
              .replace(/\n/g, ' ')
              .replace(/\.\.\./g, '။')     // ... → ။ (ellipsis ဖြုတ်)
              .replace(/…/g, '။')          // unicode ellipsis
              .replace(/။\s+/g, '။')       // ။ နောက် extra space ဖြုတ်
              .replace(/၊\s+/g, '၊')       // ၊ နောက် extra space ဖြုတ်
              .replace(/\s+/g, ' ')
              .trim();

            const retryR = await ttsService.generateSpeech(
              retryTtsText, options.voice as VoiceId,
              1.15,
              options.pitch ?? 0, "16:9"
            );
            shortBuffer = retryR.audioBuffer;

            await fs.writeFile(mp3Short, shortBuffer);
            await ffmpegService.convertToWav(mp3Short, wavShort);

            // Silence trim လည်း retry မှာ လုပ်ရမယ်
            const trimShort = path.join(tempDir, `tts_short_trim_${seg.index}.wav`);
            try {
              await ffmpegService.trimSilenceWav(wavShort, trimShort, -35, 0.1);
              const trimDur = await ffmpegService.getAudioDurationMs(trimShort);
              const rawDur  = await ffmpegService.getAudioDurationMs(wavShort);
              if (trimDur >= rawDur * 0.75) {
                await fs.copyFile(trimShort, wavShort);
              }
            } catch {}

            const shortDurMs = await ffmpegService.getAudioDurationMs(wavShort);
            const newRatio = shortDurMs / slotMs;
            console.log(`[TTS] seg ${seg.index} retry: ${shortDurMs}ms ratio=${newRatio.toFixed(2)}x`);
            if (newRatio <= 1.5) {
              finalWav = wavShort;
              finalDurationMs = shortDurMs;
              finalText = shorterText;
            }
          }
        }

        console.log(`[TTS] seg ${seg.index}: tts=${finalDurationMs}ms slot=${slotMs.toFixed(0)}ms ratio=${(finalDurationMs/slotMs).toFixed(2)}x`);
        return { path: finalWav, durationMs: finalDurationMs, text: finalText, index: seg.index };
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

      // ── Step 7: Concat & Merge ──
      const processedVideoPath = path.join(tempDir, 'processed_video.mp4');
      const ttsTrackPath       = path.join(tempDir, 'tts_track.wav');

      // Video concat - re-encode (not copy) to avoid glitch on different encoding/fps
      await ffmpegService.concatVideoFiles(slots.map(s => s.videoFile), processedVideoPath);

      // Audio concat
      await ffmpegService.concatAudioFiles(slots.map(s => s.audioFile), ttsTrackPath);

      // Final duration sync
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

      // Build subtitles
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

      // Merge video + audio + subtitles
      if (jobId) updateJob(jobId, { progress: 85, message: "Merging video + audio..." });

      const fontPath = process.env.MYANMAR_FONT_PATH ||
        (process.platform === 'win32'
          ? 'C:/Windows/Fonts/mmrtext.ttf'
          : '/usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf');

      const hasSubtitles = options.srtEnabled !== false && processedForSrt.length > 0;
      if (hasSubtitles) {
        const dims = await ffmpegService.getVideoSize(tempVideoPath);
        const assContent = assBuilderService.buildAssContent(
          processedForSrt, fontPath, dims.width, dims.height, options as any
        );
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
      const finalFilename = buildOutputFilename(shortId, "DUB", "mp4");
      const finalDir  = path.join(process.cwd(), 'static', 'downloads');
      await fs.mkdir(finalDir, { recursive: true });
      await fs.copyFile(tempOutputPath, path.join(finalDir, finalFilename));

      const allTranslatedText = translatedSegments.map(s => s.translatedText).join('\n');
      const allSrtContent = processedForSrt.map((s, i) => {
        return `${i + 1}\n${formatTimestamp(s.startMs)} --> ${formatTimestamp(s.endMs)}\n${s.text}\n`;
      }).join('\n');

      return {
        videoUrl:    await generateSignedDownloadUrl(finalFilename),
        filename:    finalFilename,
        shortId,
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