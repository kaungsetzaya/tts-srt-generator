import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleTelegramUpdate, setWebhook } from "../telegram-bot";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Security
  app.disable("x-powered-by");

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(express.json({ limit: "35mb" }));
  app.use(express.urlencoded({ limit: "35mb", extended: true }));

  // Telegram webhook
  app.post("/webhook/telegram", async (req, res) => {
    try {
      await handleTelegramUpdate(req.body);
      res.json({ ok: true });
    } catch (error) {
      console.error("[Telegram webhook error]", error);
      res.json({ ok: false });
    }
  });

  // tRPC API
  app.use("/api/trpc", createExpressMiddleware({
    router: appRouter,
    createContext,
  }));

  // Static files
  const staticPath = path.join(process.cwd(), "dist/public");
  app.use(express.static(staticPath));
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

  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, "127.0.0.1", () => {
    console.log(`Server running on http://localhost:${port}/`);
    const webhookUrl = `https://choco.de5.net/webhook/telegram`;
    setWebhook(webhookUrl).catch(console.error);
  });
}

startServer().catch(console.error);
