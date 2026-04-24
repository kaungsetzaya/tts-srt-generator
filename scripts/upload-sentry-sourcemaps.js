#!/usr/bin/env node
/**
 * Upload backend source maps to Sentry after esbuild bundling.
 * Requires SENTRY_AUTH_TOKEN in environment.
 */
import { execSync } from "child_process";

const authToken = process.env.SENTRY_AUTH_TOKEN;
if (!authToken) {
  console.log("[Sentry] SENTRY_AUTH_TOKEN not set — skipping source map upload.");
  process.exit(0);
}

try {
  console.log("[Sentry] Uploading backend source maps...");
  execSync(
    `npx sentry-cli sourcemaps upload --org lumix-studio --project node-express dist/index.cjs.map dist/`,
    {
      stdio: "inherit",
      env: { ...process.env, SENTRY_AUTH_TOKEN: authToken },
    }
  );
  console.log("[Sentry] Backend source maps uploaded.");
} catch (e) {
  console.error("[Sentry] Failed to upload source maps:", e);
  process.exit(1);
}
