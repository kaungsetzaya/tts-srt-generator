/**
 * Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†
 *  LUMIX STUDIO Ã¢â‚¬â€ tRPC Router Registry
 *  All routers are defined in individual files under routers/
 *  This file only assembles them into the appRouter tree.
 * Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†
 */
import { z } from "zod";
import { t } from "./routers/trpc";
import { authRouter } from "./routers/auth.router";
import { ttsRouter } from "./routers/tts.router";
import { videoRouter } from "./routers/video.router";
import { jobsRouter } from "./routers/jobs.router";
import { historyRouter } from "./routers/history.router";
import { subscriptionRouter } from "./routers/subscription.router";
import { settingsRouter } from "./routers/settings.router";
import { adminRouter } from "./routers/admin.router";
import { adminStatsRouter } from "./routers/adminStats.router";
import { errorLoggingRouter } from "./routers/errorLogging.router";
import { filesRouter } from "./routers/files.router";

// System info (public)
const systemRouter = t.router({
  time: t.procedure.query(() => {
    const now = new Date();
    return {
      now: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: -now.getTimezoneOffset(),
    };
  }),
});

// AI chat stub
const aiRouter = t.router({
  chat: t.procedure
    .input(
      z.object({
        messages: z.array(
          z.object({ role: z.string(), content: z.string() })
        ),
      })
    )
    .mutation(async () => {
      return { content: "AI chat is not yet implemented." };
    }),
});

export const appRouter = t.router({
  auth: authRouter,
  tts: ttsRouter,
  video: videoRouter,
  jobs: jobsRouter,
  history: historyRouter,
  subscription: subscriptionRouter,
  ai: aiRouter,
  settings: settingsRouter,
  admin: adminRouter,
  adminStats: adminStatsRouter,
  logBrowserError: errorLoggingRouter,
  files: filesRouter,
  system: systemRouter,
});

export type AppRouter = typeof appRouter;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Side-effect: register job processors Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
import { registerAllProcessors } from "./src/modules/_core/processors/index";
registerAllProcessors();
