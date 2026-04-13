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

async function startServer() {
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
        connectSrc: ["'self'"],
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
  // Video Downloads (public static folder)
  // ──────────────────────────────────────────
  const downloadsDir = path.join(process.cwd(), 'static', 'downloads');
  app.use('/downloads', express.static(downloadsDir, {
    maxAge: '1h',  // Short cache for downloads
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
    const fs = await import("fs/promises");
    let html = await fs.readFile(path.join(staticPath, "index.html"), "utf8");
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
  // Startup
  // ──────────────────────────────────────────
  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, "0.0.0.0", () => {
    console.log(`[LUMIX] Server running on http://0.0.0.0:${port}/`);
    console.log(`[LUMIX] Environment: ${process.env.NODE_ENV || "development"}`);
    const webhookUrl = `https://choco.de5.net/webhook/telegram`;
    setWebhook(webhookUrl).catch(console.error);
    // Initial temp file cleanup
    cleanTempFiles();
  });
}

startServer().catch(console.error);
