/**
 * Video Router — file/link dubbing and translation with job system
 */
import { z } from "zod";
import { t, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { isAllowedVideoUrl } from "../_core/security";
import { dubVideoFromBuffer, dubVideoFromLink } from "../videoDubber";
import { createJob, getJobAsync, updateJob } from "../jobs";
import { deductCredits, addCredits } from "./credits";

export const videoRouter = t.router({
  dubFile: protectedProcedure
    .input(
      z.object({
        videoBase64: z.string(),
        filename: z.string(),
        voice: z.enum(["thiha", "nilar"]),
        srtEnabled: z.boolean().optional().default(true),
        srtFontSize: z.number().optional().default(24),
        srtColor: z.string().optional().default("#ffffff"),
        srtMarginV: z.number().optional().default(30),
        srtBlurBg: z.boolean().optional().default(true),
        srtBlurSize: z.number().optional().default(8),
        srtBlurColor: z.enum(["black", "white"]).optional().default("black"),
        srtBoxPadding: z.number().optional().default(4),
        srtFullWidth: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;

      // Size check — reject >25MB before deducting credits
      const videoSize = input.videoBase64.length * 0.75; // base64 → bytes approx
      if (videoSize > 25 * 1024 * 1024) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File too large. Max 25MB.",
        });
      }

      await deductCredits(userId, 10, "video_dub", `Video Dub: ${input.voice}`);
      try {
        const jobId = createJob("dub_file", {
          videoBase64: input.videoBase64,
          filename: input.filename,
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
          userId,
        }, userId);

        return { jobId };
      } catch (error: any) {
        await addCredits(userId, 10, "video_dub_refund", `Refund: Video dub failed`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to dub video.",
        });
      }
    }),

  dubLink: protectedProcedure
    .input(
      z.object({
        url: z.string(),
        voice: z.enum(["thiha", "nilar"]),
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
      await deductCredits(userId, 10, "video_dub", `Video Dub: ${input.voice}`);
      try {
        return await dubVideoFromLink(input.url, {
          voice: input.voice,
          speed: 1.2,
          pitch: 0,
          srtEnabled: true,
        });
      } catch (error: any) {
        await addCredits(userId, 10, "video_dub_refund", "Refund: Video dub failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to dub video.",
        });
      }
    }),

  previewLink: t.procedure
    .input(z.object({ url: z.string() }))
    .mutation(async ({ input }) => {
      return { title: "Video", duration: 0, thumbnail: "" };
    }),

  translate: protectedProcedure
    .input(z.object({ videoBase64: z.string(), filename: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const videoSize = input.videoBase64.length * 0.75;
      if (videoSize > 25 * 1024 * 1024) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File too large. Max 25MB.",
        });
      }
      
      const userId = ctx.user!.userId;
      const jobId = createJob("translate_file", { 
        videoBase64: input.videoBase64, 
        filename: input.filename,
        userId 
      });
      
      try {
        await deductCredits(userId, 5, "video_translate", "Video Translate");
      } catch (creditErr: any) {
        updateJob(jobId, { status: "failed", error: creditErr.message, progress: 0 });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: creditErr.message || "Insufficient credits",
        });
      }
      
      return { jobId };
    }),
  
  getTranslateJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const job = await getJobAsync(input.jobId);
      if (!job) return { status: "failed", error: "Job not found", progress: 0, message: "" };
      return {
        status: job.status,
        progress: job.progress,
        message: job.message ?? "",
        error: job.error,
        result: job.status === "completed" ? job.result : undefined,
      };
    }),
  
  translateLink: protectedProcedure
    .input(z.object({ url: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!isAllowedVideoUrl(input.url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or disallowed URL",
        });
      }
      
      const userId = ctx.user!.userId;
      const jobId = createJob("translate_link", { 
        url: input.url,
        userId 
      });
      
      try {
        await deductCredits(userId, 5, "video_translate", "Video Translate");
      } catch (creditErr: any) {
        updateJob(jobId, { status: "failed", error: creditErr.message, progress: 0 });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: creditErr.message || "Insufficient credits",
        });
      }
      
      return { jobId };
    }),
    
  getTranslateLinkJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const job = await getJobAsync(input.jobId);
      if (!job) return { status: "failed", error: "Job not found", progress: 0, message: "" };
      return {
        status: job.status,
        progress: job.progress,
        message: job.message ?? "",
        error: job.error,
        result: job.status === "completed" ? job.result : undefined,
      };
    }),
});
