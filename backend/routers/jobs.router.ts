/**
 * Jobs Router — start dub jobs, check status
 */
import { z } from "zod";
import { t, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { isAllowedVideoUrl } from "../_core/security";
import { createJob, getJobAsync } from "../jobs";
import { deductCredits } from "./credits";

export const jobsRouter = t.router({
  startDub: protectedProcedure
    .input(
      z.object({
        url: z.string(),
        voice: z.enum(["thiha", "nilar", "ryan", "ronnie", "lucas", "daniel", "evander", "michelle", "iris", "charlotte", "amara"]),
        srtEnabled: z.boolean().optional().default(true),
        srtFontSize: z.number().optional().default(24),
        srtColor: z.string().optional().default("#ffffff"),
        srtMarginV: z.number().optional().default(30),
        srtBlurBg: z.boolean().optional().default(true),
        srtBlurSize: z.number().optional().default(8),
        srtBlurColor: z.enum(["black", "white"]).optional().default("black"),
        srtBoxPadding: z.number().optional().default(4),
        srtFullWidth: z.boolean().optional().default(false),
        srtDropShadow: z.boolean().optional().default(true),
        srtBorderRadius: z.enum(["rounded", "square"]).optional().default("rounded"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;

      if (!isAllowedVideoUrl(input.url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or disallowed URL",
        });
      }

      await deductCredits(
        userId,
        10,
        "video_dub",
        `Video Dub Link: ${input.voice}`
      );

      const jobId = createJob("dub_link", {
        url: input.url,
        voice: input.voice,
        speed: 1.2,
        pitch: 0,
        srtEnabled: input.srtEnabled,
        srtFontSize: input.srtFontSize,
        srtColor: input.srtColor,
        srtMarginV: input.srtMarginV,
        srtBlurBg: input.srtBlurBg,
        srtBlurSize: input.srtBlurSize,
        srtBlurColor: input.srtBlurColor,
        srtBoxPadding: input.srtBoxPadding,
        srtFullWidth: input.srtFullWidth,
        srtDropShadow: input.srtDropShadow,
        srtBorderRadius: input.srtBorderRadius,
        userId,
      }, userId);

      return { jobId };
    }),

  getStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const job = await getJobAsync(input.jobId);
      if (!job) {
        return { status: "not_found" as const, progress: 0, message: "" };
      }
      return {
        status: job.status,
        progress: job.progress,
        message: job.message ?? "",
        error: job.error,
        result: job.status === "completed" ? job.result : undefined,
      };
    }),
});
