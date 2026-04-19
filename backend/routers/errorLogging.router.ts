/**
 * Browser Error Logging — catches frontend crashes
 * Called by frontend/src/main.tsx via window.onerror and unhandledrejection
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { t } from "./trpc";
import { getDb } from "../db";
import { errorLogs } from "../../drizzle/schema";

export const errorLoggingRouter = t.procedure
  .input(
    z.object({
      errorMessage: z.string().max(2000),
      source: z.enum(["window.onerror", "unhandledrejection", "react_error_boundary"]),
      stackTrace: z.string().max(5000).optional(),
      url: z.string().max(500).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return { success: false };
    try {
      await db.insert(errorLogs).values({
        id: randomUUID(),
        userId: ctx.user?.userId ?? null,
        feature: "browser",
        errorCode: input.source,
        errorMessage: input.errorMessage,
        stackTrace: input.stackTrace ?? null,
        severity: "error",
        resolved: false,
      });
      return { success: true };
    } catch (e) {
      console.error("[logBrowserError]", e);
      return { success: false };
    }
  });
