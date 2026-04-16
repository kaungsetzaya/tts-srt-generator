import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomBytes, randomUUID } from "crypto";
import { generateSpeech, SUPPORTED_VOICES } from "./tts";
import { dubVideoFromBuffer, dubVideoFromLink } from "./videoDubber";
import { isAllowedVideoUrl } from "./_core/security";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

import superjson from "superjson";

const t = initTRPC.create({
  transformer: superjson,
});

export const appRouter = t.router({
  auth: t.router({
    me: t.procedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      return ctx.user;
    }),
    logout: t.procedure.mutation(async ({ ctx }) => {
      return { success: true };
    }),
    verify: t.procedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // Handle potential batched input
        const code = typeof input === 'string' ? input : input.code;
        
        const user = await db.query.users.findFirst({
          where: (u: any, { eq }: any) => eq(u.telegramCode, code),
        });

        if (!user || !user.telegramCodeExpiresAt || new Date(user.telegramCodeExpiresAt) < new Date()) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired code" });
        }

        // Clear code after successful login
        await db.update(users).set({ telegramCode: null }).where(eq(users.id, user.id));

        // Generate session token and return user info
        const sessionToken = randomUUID();
        await db.update(users).set({ sessionToken, sessionTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) }).where(eq(users.id, user.id)); // 7 day expiry

        return { success: true, userId: user.id, sessionToken };
      }),
  }),
  tts: t.router({
    generateAudio: t.procedure
      .input(
        z.object({
          text: z.string(),
          voice: z.enum(["thiha", "nilar"]).optional(),
          rate: z.number().optional(),
          pitch: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const result = await generateSpeech(
            input.text,
            input.voice,
            input.rate,
            input.pitch
          );
          return {
            audioUrl: "data:audio/mp3;base64," + result.audioBuffer.toString("base64"),
            srtContent: result.srtContent,
          };
        } catch (error: any) {
          console.error("[TTS Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to generate audio. Please try again.",
          });
        }
      }),
  }),
  dub: t.router({
    fromLink: t.procedure
      .input(
        z.object({
          url: z.string(),
          voice: z.enum(["thiha", "nilar"]),
          speed: z.number().optional(),
          pitch: z.number().optional(),
          srtEnabled: z.boolean().optional(),
          userApiKey: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await dubVideoFromLink(input.url, {
            voice: input.voice,
            speed: input.speed ?? 1.0,
            pitch: input.pitch ?? 0,
            srtEnabled: input.srtEnabled ?? true,
            userApiKey: input.userApiKey,
          });
        } catch (error: any) {
          console.error("[Dub Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to dub video.",
          });
        }
      }),
  }),
  history: t.router({
    getMyHistory: t.procedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx }) => {
        return [];
      }),
  }),
  subscription: t.router({
    myStatus: t.procedure.query(async ({ ctx }) => {
      return { active: false, plan: null };
    }),
  }),
});

export type AppRouter = typeof appRouter;
