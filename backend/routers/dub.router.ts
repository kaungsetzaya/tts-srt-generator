/**
 * Dub Router — legacy video dubbing from link
 */
import { z } from "zod";
import { t, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { dubVideoFromLink } from "../videoDubber";

export const dubRouter = t.router({
  fromLink: protectedProcedure
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
});
