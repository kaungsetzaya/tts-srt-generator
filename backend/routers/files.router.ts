/**
 * Files Router — list user's generated files from R2
 */
import { z } from "zod";
import { t, protectedProcedure } from "./trpc";
import { r2Service } from "../src/modules/media/services/r2.service";

export const filesRouter = t.router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user!.userId;
      if (!r2Service.isEnabled()) {
        return [];
      }
      const files = await r2Service.listUserFiles(userId);
      return Promise.all(
        files.map(async (f) => ({
          key: f.key,
          type: f.type,
          filename: f.filename,
          size: f.size ?? 0,
          lastModified: f.lastModified?.toISOString() ?? new Date().toISOString(),
          downloadUrl: await r2Service.getSignedDownloadUrl(f.key, 3600),
        }))
      );
    }),

  deleteFile: protectedProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;
      if (!input.key.startsWith(`users/${userId}/`)) {
        throw new Error("Unauthorized");
      }
      await r2Service.deleteFile(input.key);
      return { success: true };
    }),
});
