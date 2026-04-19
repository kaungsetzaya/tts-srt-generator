import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleTelegramUpdate, setWebhook } from "../telegram-bot";
import {
  corsMiddleware,
  xssProtectionMiddleware,
  apiRateLimiter,
  securityHeaders,
  cleanTempFiles,
  requestIdMiddleware,
  memoryGuardMiddleware,
} from "./security";
import { validateEnv } from "./env";
import { recoverInterruptedJobs } from "../jobs";
import { createHmac } from "crypto";
import { promises as fs, createReadStream, statSync } from "fs";

async function startServer() {
  // ──────────────────────────────────────────
  // 🔐 ENV VALIDATION — fail fast on missing vars
  // ──────────────────────────────────────────
  validateEnv();

  const app = express();
  const server = createServer(app);

  // ──────────────────────────────────────────
  // 🔐 SECURITY LAYER 1 — Basic Headers
  // ──────────────────────────────────────────
  app.disable("x-powered-by"); // Server info မပြ
  app.set("trust proxy", 1);   // Nginx/Cloudflare ရှေ့မှာ proxy ထားလို့

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        "script-src-elem": ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "style-src-elem": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "https://wsrv.nl", "https://img.youtube.com"],
        mediaSrc: ["'self'", "blob:", "data:"],
        connectSrc: ["'self'", "https://choco.de5.net", "https://lumix-studio.vercel.app", "https://*.vercel.app"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(securityHeaders);  // X-Frame-Options, X-XSS-Protection etc.

  // ──────────────────────────────────────────
  // 🔐 SECURITY LAYER 2 — Request ID Tracking
  // ──────────────────────────────────────────
  app.use(requestIdMiddleware);

  // ──────────────────────────────────────────
  // 🔐 SECURITY LAYER 3 — CORS
  // ──────────────────────────────────────────
  app.use(corsMiddleware);

  // ──────────────────────────────────────────
  // 🔐 SECURITY LAYER 4 — Body Parser (size limit)
  // ──────────────────────────────────────────
  app.use(express.json({ limit: "35mb" }));
  app.use(express.urlencoded({ limit: "35mb", extended: true }));

  // ──────────────────────────────────────────
  // 🔐 SECURITY LAYER 5 — XSS / SQLi Pattern Check
  // ──────────────────────────────────────────
  app.use("/api", xssProtectionMiddleware);

  // ──────────────────────────────────────────
  // 🔐 SECURITY LAYER 6 — API Rate Limiting (60 req/min per IP)
  // ──────────────────────────────────────────
  app.use("/api/trpc", apiRateLimiter(60));

  // ──────────────────────────────────────────
  // 🔐 SECURITY LAYER 7 — Memory Guard (reject if RAM > 90%)
  // ──────────────────────────────────────────
  app.use("/api/trpc", memoryGuardMiddleware);

  // ──────────────────────────────────────────
  // Telegram Webhook (Telegram IP range only check optional)
  // ──────────────────────────────────────────
  app.post("/webhook/telegram", async (req, res) => {
    try {
      await handleTelegramUpdate(req.body);
      res.json({ ok: true });
    } catch (error) {
      console.error("[Telegram webhook error]", error);
      res.json({ ok: false });
    }
  });

  // ──────────────────────────────────────────
  // Video Downloads — Signed URL auth gate
  // Previously public: any user could guess another's video URL.
  // Now: /downloads/:token/:filename validates an HMAC signature.
  // ──────────────────────────────────────────
  const DOWNLOAD_SECRET = process.env.JWT_SECRET || "fallback-download-secret";
  const downloadsDir = path.join(process.cwd(), 'static', 'downloads');

  // Generate a signed download URL (called from routers when a dub job completes)
  app.get('/downloads/:token/:filename', (req, res) => {
    const { token, filename } = req.params;

    // Validate token: HMAC(filename + expiry, secret)
    // Token format: hex_signature-expiry_timestamp
    const parts = token.split('-');
    if (parts.length !== 2) {
      res.status(403).json({ error: "Invalid download token" });
      return;
    }

    const [signature, expiryStr] = parts;
    const expiry = parseInt(expiryStr, 10);

    if (isNaN(expiry) || Date.now() > expiry) {
      res.status(403).json({ error: "Download link expired" });
      return;
    }

    const expected = createHmac('sha256', DOWNLOAD_SECRET)
      .update(`${filename}:${expiryStr}`)
      .digest('hex')
      .slice(0, 32);

    if (signature !== expected) {
      res.status(403).json({ error: "Invalid download signature" });
      return;
    }

    // Serve the file with Range request support (required for <video> elements)
    const filePath = path.join(downloadsDir, filename);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(downloadsDir))) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    // Check file exists
    let stat: any;
    try {
      stat = statSync(resolved);
    } catch {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Handle Range request (required for video seeking / Chrome playback)
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
        return;
      }

      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4',
        'Content-Disposition': `inline; filename="${filename}"`,
      });
      createReadStream(resolved, { start, end }).pipe(res);
    } else {
      // Full file download
      res.set({
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${filename}"`,
      });
      createReadStream(resolved).pipe(res);
    }
  });

  // Legacy /downloads/* for backward compat during transition (1h cache)
  app.use('/downloads', express.static(downloadsDir, {
    maxAge: '1h',
    etag: true,
  }));

  // ──────────────────────────────────────────
  // tRPC API
  // ──────────────────────────────────────────
  app.use("/api/trpc", createExpressMiddleware({
    router: appRouter,
    createContext,
  }));

  // ──────────────────────────────────────────
  // Static Files (SPA)
  // ──────────────────────────────────────────
  const staticPath = path.join(process.cwd(), "dist/public");
  app.use(express.static(staticPath, {
    maxAge: "7d",       // Static assets cache
    etag: true,
  }));

  app.get("*", async (req, res) => {
    const fsPromises = await import("fs/promises");
    let html = await fsPromises.readFile(path.join(staticPath, "index.html"), "utf8");
    html = html.replace(
      "<title>LUMIX TTS</title>",
      `<title>LUMIX TTS</title>
    <meta property="og:title" content="LUMIX TTS" />
    <meta property="og:description" content="Myanmar AI Voice Generator - Convert text to speech with SRT subtitle" />
    <meta property="og:url" content="https://choco.de5.net" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://choco.de5.net/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="LUMIX TTS" />
    <meta name="twitter:description" content="Myanmar AI Voice Generator" />
    <meta name="twitter:image" content="https://choco.de5.net/og-image.png" />`
    );
    res.send(html);
  });

  // ──────────────────────────────────────────
  // Global Error Handler (URIError, JSON parse, etc.)
  // ──────────────────────────────────────────
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof URIError) {
      console.warn("[URIError]", err.message);
      res.status(400).json({ error: { message: "Invalid URL encoding" } });
      return;
    }
    if (err.type === "entity.parse.failed") {
      res.status(400).json({ error: { message: "Invalid JSON" } });
      return;
    }
    console.error("[Unhandled Error]", err.message || err);
    res.status(500).json({ error: { message: "Internal server error" } });
  });

  // ──────────────────────────────────────────
  // Job Recovery — mark interrupted jobs as failed on startup
  // Without this, jobs stuck at "processing" after a restart
  // stay that way forever and users see a permanent spinner.
  // ──────────────────────────────────────────
  await recoverInterruptedJobs();

  // ──────────────────────────────────────────
  // Download File Cleanup — delete dubbed videos older than 24h
  // Without this, static/downloads/ grows unbounded on disk.
  // ──────────────────────────────────────────
  async function cleanDownloadFiles() {
    try {
      const dir = path.join(process.cwd(), 'static', 'downloads');
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      const files = await fs.readdir(dir);
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      let cleaned = 0;
      for (const file of files) {
        try {
          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath);
          if (now - stat.mtimeMs > TWENTY_FOUR_HOURS) {
            await fs.unlink(filePath);
            cleaned++;
          }
        } catch {}
      }
      if (cleaned > 0) {
        console.log(`[Cleanup] Removed ${cleaned} old download files (>24h)`);
      }
    } catch {}
  }

  // Run cleanup every 30 minutes
  setInterval(cleanDownloadFiles, 30 * 60 * 1000);

  // ──────────────────────────────────────────
  // Startup
  // ──────────────────────────────────────────
  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, "0.0.0.0", () => {
    console.log(`[LUMIX] Server running on http://0.0.0.0:${port}/`);
    console.log(`[LUMIX] Environment: ${process.env.NODE_ENV || "development"}`);
    const webhookUrl = `https://choco.de5.net/webhook/telegram`;
    setWebhook(webhookUrl).catch(console.error);
    // Initial cleanup runs
    cleanTempFiles();
    cleanDownloadFiles();
  });
}

startServer().catch(console.error);

// ─── Signed URL helper (re-exported from shared utility) ────────
export { generateSignedDownloadUrl } from "./signedUrl";

