import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSpeech, generateSRT, SUPPORTED_VOICES } from "./tts";
import { generateSpeechVPS, checkVPSTTSHealth } from "./vps-tts";
import { saveTtsConversion } from "./db";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  tts: router({

    generateAudio: publicProcedure
      .input(
        z.object({
          text: z.string().min(1, "Text cannot be empty").max(5000, "Text too long"),
          voice: z.enum(["thiha", "nilar"]).default("thiha"),
          tone: z.number().min(-20).max(20).default(0),
          speed: z.number().min(0.5).max(2.0).default(1.0),
          aspectRatio: z.enum(["9:16", "16:9"]).default("16:9"),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Generate audio using VPS TTS if configured, otherwise use built-in
          let audioBuffer: Buffer;
          let vpsAudioUrl: string | undefined;
          if (ENV.vpsTtsApiUrl) {
            // Use VPS TTS server
            const pitch = input.tone; // Pass as number
            const rate = Math.round((input.speed - 1) * 100); // Convert speed to rate percentage
            const vpsResult = await generateSpeechVPS(input.text, input.voice, rate, pitch);
            audioBuffer = vpsResult.audioBuffer;
            vpsAudioUrl = vpsResult.audioUrl;
          } else {
            // Fallback to built-in Edge TTS
            audioBuffer = await generateSpeech(input.text, input.voice, input.speed, input.tone);
          }

          // Always upload audio to S3 for consistent CORS support and preview playback
          const audioKey = `tts/public/${Date.now()}-${Math.random().toString(36).substring(7)}-audio.mp3`;
          const s3Result = await storagePut(audioKey, audioBuffer, "audio/mpeg");
          const audioUrl = s3Result.url;

          // Generate SRT
          const srtContent = generateSRT(input.text, input.speed);
          const srtBuffer = Buffer.from(srtContent, "utf-8");

          // Upload SRT to S3 (public access, no user tracking)
          const srtKey = `tts/public/${Date.now()}-${Math.random().toString(36).substring(7)}-subtitles.srt`;
          const { url: srtUrl } = await storagePut(srtKey, srtBuffer, "text/plain");

          // No database tracking for public access

          return {
            success: true,
            audioUrl,
            srtUrl,
            srtContent,
          };
        } catch (error) {
          console.error("TTS generation error:", error);
          throw new Error(`Failed to generate TTS: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }),

    preview: publicProcedure
      .input(
        z.object({
          voice: z.enum(["thiha", "nilar"]).default("thiha"),
          tone: z.number().min(-20).max(20).default(0),
          speed: z.number().min(0.5).max(2.0).default(1.0),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Use a short test phrase
          const testText = "မြန်မာ စာသားကို အသံပြောင်းပြီး SRT ဖိုင်ထုတ်ပေးပါသည်။";
          let audioBuffer: Buffer;
          if (ENV.vpsTtsApiUrl) {
            // Use VPS TTS server
            const pitch = input.tone; // Pass as number
            const rate = Math.round((input.speed - 1) * 100); // Convert speed to rate percentage
            const vpsResult = await generateSpeechVPS(testText, input.voice, rate, pitch);
            audioBuffer = vpsResult.audioBuffer;
          } else {
            // Fallback to built-in Edge TTS
            audioBuffer = await generateSpeech(testText, input.voice, input.speed, input.tone);
          }
          return {
            success: true,
            audio: audioBuffer.toString("base64"),
            mimeType: "audio/mpeg",
          };
        } catch (error) {
          console.error("Preview generation error:", error);
          throw new Error(`Failed to generate preview: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }),

    getVoices: publicProcedure.query(() => {
      return Object.entries(SUPPORTED_VOICES).map(([key, value]) => ({
        id: key,
        name: value.name,
      }));
    }),
  }),

  video: router({
    uploadAndTranslate: publicProcedure
      .input(
        z.object({
          videoUrl: z.string().url("Invalid video URL"),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return {
            success: true,
            originalText: "Sample original text from video",
            translatedText: "ဗီဒီယိုမှ နမူနာ မြန်မာ ဘာသာပြန်ထားသည့် စာသားဖြစ်သည်။",
          };
        } catch (error) {
          console.error("Video processing error:", error);
          throw new Error(`Failed to process video: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
