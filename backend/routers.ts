import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomBytes, randomUUID } from "crypto";
import { generateSpeech, SUPPORTED_VOICES } from "./tts";
import { dubVideoFromBuffer, dubVideoFromLink } from "./videoDubber";
import { isAllowedVideoUrl } from "./_core/security";

const t = initTRPC.create();

export const appRouter = t.router({
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
        } catch (error) {
          console.error("[TTS Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate audio. Please try again.",
          });
        }
      }),
  }),
  auth: t.router({
    verify: t.procedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const user = await db.query.users.findFirst({
          where: (u: any, { eq }: any) => eq(u.telegramCode, input.code),
        });

        if (!user || !user.telegramCodeExpiresAt || new Date(user.telegramCodeExpiresAt) < new Date()) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired code" });
        }

        // Clear code after successful login
        await db.update(users).set({ telegramCode: null }).where(eq(users.id, user.id));

        return { success: true, userId: user.id };
      }),
  }),
});

export type AppRouter = typeof appRouter;
