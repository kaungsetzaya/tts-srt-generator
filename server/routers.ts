import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSpeech, SUPPORTED_VOICES } from "./tts";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "secret");

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    loginWithCode: publicProcedure
      .input(z.object({ code: z.string().length(6) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.select().from(users)
          .where(eq(users.telegramCode, input.code))
          .limit(1);

        if (result.length === 0) {
          throw new Error("Invalid code. Get your code from @lumixmmbot on Telegram.");
        }

        const user = result[0];

        const token = await new SignJWT({
          userId: user.id,
          telegramId: user.telegramId,
          name: user.telegramFirstName,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("30d")
          .sign(JWT_SECRET);

        ctx.res.cookie(COOKIE_NAME, token, {
          httpOnly: true,
          secure: true,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          sameSite: "lax",
        });

        return {
          success: true,
          name: user.telegramFirstName,
          username: user.telegramUsername,
        };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  tts: router({
    generateAudio: publicProcedure
      .input(z.object({
        text: z.string().min(1).max(5000),
        voice: z.enum(["thiha", "nilar"]).default("thiha"),
        tone: z.number().min(-20).max(20).default(0),
        speed: z.number().min(0.5).max(2.0).default(1.0),
        aspectRatio: z.enum(["9:16", "16:9"]).default("16:9"),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await generateSpeech(input.text, input.voice, input.speed, input.tone);
          const srtContent = input.aspectRatio === "9:16" ? result.srtContent916 : result.srtContent169;
          return {
            success: true,
            audioBase64: result.audioBuffer.toString("base64"),
            mimeType: "audio/mpeg",
            srtContent,
            srtContent916: result.srtContent916,
            srtContent169: result.srtContent169,
            durationMs: result.durationMs,
          };
        } catch (error) {
          throw new Error(`Failed to generate TTS: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }),

    preview: publicProcedure
      .input(z.object({
        voice: z.enum(["thiha", "nilar"]).default("thiha"),
        tone: z.number().min(-20).max(20).default(0),
        speed: z.number().min(0.5).max(2.0).default(1.0),
      }))
      .mutation(async ({ input }) => {
        const testText = "မြန်မာ စာသားကို အသံပြောင်းပြီး SRT ဖိုင်ထုတ်ပေးပါသည်။";
        const result = await generateSpeech(testText, input.voice, input.speed, input.tone);
        return {
          success: true,
          audio: result.audioBuffer.toString("base64"),
          mimeType: "audio/mpeg",
        };
      }),

    getVoices: publicProcedure.query(() => {
      return Object.entries(SUPPORTED_VOICES).map(([key, value]) => ({
        id: key,
        name: value.name,
      }));
    }),
  }),
});

export type AppRouter = typeof appRouter;
