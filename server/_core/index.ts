import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleTelegramUpdate, setWebhook } from "../telegram-bot";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
  app.get("*", (req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Set Telegram webhook
    const webhookUrl = `https://choco.de5.net/webhook/telegram`;
    setWebhook(webhookUrl).catch(console.error);
  });
}

startServer().catch(console.error);
