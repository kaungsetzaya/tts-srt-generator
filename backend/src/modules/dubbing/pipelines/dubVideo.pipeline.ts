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

export interface DubOptions {
  voice: string;
  speed?: number;
  pitch?: number;
  srtEnabled?: boolean;
  srtFontSize?: number;
  srtColor?: string;
  srtMarginV?: number;
  srtBlurBg?: boolean;
  srtBlurSize?: number;
  srtBlurColor?: "black" | "white";
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
  async executeFromLink(url: string, options: DubOptions) {
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
  async execute(videoBuffer: Buffer, filename: string, options: DubOptions) {
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
      await fs.writeFile(tempVideoPath, videoBuffer);
      const videoDurationSec = await ffmpegService.getVideoDuration(tempVideoPath);
      if (videoDurationSec > 150) throw new Error("Video too long. Max 2min 30sec.");

      // Step 2: Extract audio for transcription
      await ffmpegService.extractAudio(tempVideoPath, tempAudioExtract);

      // Step 3: Transcribe with Whisper
      const segments = await whisperService.transcribe(tempAudioExtract);
      if (segments.length === 0) throw new Error("No speech detected in video");

      // Step 4: Translate segments with Gemini
      const translatedSegments = await geminiService.translateSegments(
        segments.map((s, i) => ({ index: i, start: s.start, end: s.end, text: s.text })),
        options.userApiKey
      );

      // Step 5: Generate TTS per segment
      const FIXED_SPEED = 1.2;
      const TINY_PAUSE_MS = 150;
      const audioParts: string[] = [];
      const processedForSrt: any[] = [];
      let cursorMs = 0;

      for (const seg of translatedSegments) {
        if (!seg.translatedText.trim()) continue;

        const isCharacter = options.voice in CHARACTER_VOICES;
        const baseVoice = isCharacter 
            ? CHARACTER_VOICES[options.voice as CharacterKey].base 
            : (options.voice as VoiceKey);

        const tts = await ttsService.generateSpeech(seg.translatedText, baseVoice, FIXED_SPEED, options.pitch ?? 0);
        
        const partPath = path.join(tempDir, `tts_${seg.index}.mp3`);
        await fs.writeFile(partPath, tts.audioBuffer);
        
        const duration = await ffmpegService.getAudioDurationMs(partPath);
        
        processedForSrt.push({ startMs: cursorMs, endMs: cursorMs + duration, text: seg.translatedText });
        audioParts.push(partPath);
        cursorMs += duration + TINY_PAUSE_MS; 
      }

      // Step 6: Concat audio parts and merge with video
      const listPath = path.join(tempDir, "concat_list.txt");
      const listContent = audioParts.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
      await fs.writeFile(listPath, listContent);

      const tempConcatAudio = path.join(tempDir, `concat_raw.mp3`);
      
      // Step 6a: Actually concatenate audio parts using ffmpeg
      await ffmpegService.concatAudioFiles(listPath, tempConcatAudio);

      // Step 6b: Character voice conversion (Module-to-Module call via Service)
      let finalAudioPath = tempConcatAudio;
      // ... murf logic would go here ...
      
      // Step 6c: Subtitles - cross-platform font resolution
      const fontPath = process.env.MYANMAR_FONT_PATH || 
        (process.platform === "win32" 
          ? "C:/Windows/Fonts/ Myanmar3.ttf" 
          : "/usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf");
      
      if (options.srtEnabled !== false && processedForSrt.length > 0) {
        const videoDimensions = await ffmpegService.getVideoSize(tempVideoPath);
        const assContent = assBuilderService.buildAssContent(processedForSrt, fontPath, videoDimensions.width, videoDimensions.height, options as any);
        await fs.writeFile(tempAssPath, assContent);
        await ffmpegService.mergeVideoAudioSubtitles(tempVideoPath, finalAudioPath, tempAssPath, tempOutputPath, {
          videoDurationSec,
          fontPath,
        });
      } else {
        await ffmpegService.mergeVideoAudio(tempVideoPath, finalAudioPath, tempOutputPath, {
          videoDurationSec,
        });
      }

      // Step 8: Move to final storage
      const finalFilename = `dub_${id}.mp4`;
      const finalDir = path.join(process.cwd(), "static", "downloads");
      await fs.mkdir(finalDir, { recursive: true });
      const finalPath = path.join(finalDir, finalFilename);
      await fs.copyFile(tempOutputPath, finalPath);

      return { 
          videoUrl: `/downloads/${finalFilename}`,
          id
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
