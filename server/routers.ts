import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSpeech, generateSRT, SUPPORTED_VOICES } from "./tts";
import { generateSpeechVPS, checkVPSTTSHealth } from "./vps-tts";
import { saveTtsConversion } from "./db";
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
          let audioBuffer: Buffer;
          let vpsAudioUrl: string | undefined;

          if (ENV.vpsTtsApiUrl) {
            const pitch = input.tone;
            const rate = Math.round((input.speed - 1) * 100);
            const vpsResult = await generateSpeechVPS(input.text, input.voice, rate, pitch, input.aspectRatio);
            audioBuffer = vpsResult.audioBuffer;
            vpsAudioUrl = vpsResult.audioUrl;
          } else {
            audioBuffer = await generateSpeech(input.text, input.voice, input.speed, input.tone);
            vpsAudioUrl = "";
          }

          // Use VPS audio URL directly, skip S3
          const audioUrl = vpsAudioUrl || "";

          // Generate SRT
          const srtContent = generateSRT(input.text, input.speed);
          const srtUrl = "";

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
          const testText = "မြန်မာ စာသားကို အသံပြောင်းပြီး SRT ဖိုင်ထုတ်ပေးပါသည်။";
          let audioBuffer: Buffer;

          if (ENV.vpsTtsApiUrl) {
            const pitch = input.tone;
            const rate = Math.round((input.speed - 1) * 100);
            const vpsResult = await generateSpeechVPS(testText, input.voice, rate, pitch);
            audioBuffer = vpsResult.audioBuffer;
          } else {
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
