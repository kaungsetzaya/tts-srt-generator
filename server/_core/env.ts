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
