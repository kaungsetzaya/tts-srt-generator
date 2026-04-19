/**
 * ██████████████████████████████████████████
 *  LUMIX STUDIO — Environment Configuration & Validation
 *  Server boot မှာ env vars စစ်ဆေးခြင်း
 * ██████████████████████████████████████████
 */

// ─── Parsed environment (existing) ────────────────────
export const ENV = {
  appId: (process.env.VITE_APP_ID ?? "").trim(),
  cookieSecret: (process.env.JWT_SECRET ?? "").trim(),
  databaseUrl: (process.env.DATABASE_URL ?? "").trim(),
  oAuthServerUrl: (process.env.OAUTH_SERVER_URL ?? "").trim(),
  ownerOpenId: (process.env.OWNER_OPEN_ID ?? "").trim(),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: (process.env.BUILT_IN_FORGE_API_URL ?? "").trim(),
  forgeApiKey: (process.env.BUILT_IN_FORGE_API_KEY ?? "").trim(),
  vpsTtsApiUrl: (process.env.VPS_TTS_API_URL ?? "").trim() || null,
  vpsTtsAudioBaseUrl: (process.env.VPS_TTS_AUDIO_BASE_URL ?? "").trim() || null,
  vpsTtsHealthCheckUrl: (process.env.VPS_TTS_HEALTH_CHECK_URL ?? "").trim() || null,
};

// ─── Startup validation ──────────────────────────────

interface EnvRequirement {
  key: string;
  required: boolean;
  description: string;
}

const ENV_REQUIREMENTS: EnvRequirement[] = [
  { key: "DATABASE_URL", required: true, description: "MySQL connection string (mysql://user:pass@host:3306/db)" },
  { key: "JWT_SECRET", required: true, description: "Secret key for JWT token signing (min 32 chars recommended)" },
  { key: "ADMIN_TELEGRAM_ID", required: true, description: "Telegram ID of the admin user" },
  { key: "GEMINI_API_KEY", required: false, description: "Google Gemini API key(s) for translation (comma-separated)" },
  { key: "TELEGRAM_BOT_TOKEN", required: false, description: "Telegram bot token for auth codes" },
  { key: "ADMIN_BYPASS_CODE", required: false, description: "Admin bypass code for direct login" },
  { key: "ALLOWED_ORIGINS", required: false, description: "Comma-separated list of allowed CORS origins" },
  { key: "BASE_URL", required: false, description: "Public base URL (e.g. https://choco.de5.net)" },
];

/**
 * Validate required environment variables at startup.
 * Throws with a clear checklist if any required vars are missing.
 */
export function validateEnv(): void {
  const missing: EnvRequirement[] = [];
  const warnings: EnvRequirement[] = [];

  for (const req of ENV_REQUIREMENTS) {
    const value = process.env[req.key];
    if (!value || value.trim() === "") {
      if (req.required) {
        missing.push(req);
      } else {
        warnings.push(req);
      }
    }
  }

  // Warn about optional missing vars
  if (warnings.length > 0) {
    console.warn("[ENV] Optional environment variables not set:");
    for (const w of warnings) {
      console.warn(`  ⚠ ${w.key} — ${w.description}`);
    }
  }

  // Fail fast on required missing vars
  if (missing.length > 0) {
    const lines = missing.map(
      (m) => `  ✗ ${m.key} — ${m.description}`
    );
    const msg = [
      "",
      "═══════════════════════════════════════════════════════",
      " LUMIX STUDIO — Missing Required Environment Variables",
      "═══════════════════════════════════════════════════════",
      "",
      ...lines,
      "",
      " Set these in your .env file or environment before starting.",
      " The server cannot start without them.",
      "═══════════════════════════════════════════════════════",
      "",
    ].join("\n");

    throw new Error(msg);
  }

  console.log("[ENV] ✅ All required environment variables validated");
}
