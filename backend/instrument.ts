import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: "https://b09108995b3c483075e2d94726a83c20@o4511277328760832.ingest.de.sentry.io/4511277348880464",
  integrations: [nodeProfilingIntegration()],
  environment: process.env.NODE_ENV || "development",
  // Send structured logs to Sentry
  enableLogs: true,
  // Tracing
  tracesSampleRate: 1.0,
  // Profiling
  profileSessionSampleRate: 1.0,
  profileLifecycle: "trace",
  // PII
  sendDefaultPii: true,
});

export default Sentry;
