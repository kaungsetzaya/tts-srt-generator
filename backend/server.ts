import express from "express";
import cors from "cors";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { randomBytes } from "crypto";
import type { TrpcContext } from "./_core/context";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the 'static' directory
app.use("/static", express.static(path.join(process.cwd(), "static")));

// Serve frontend build files (for direct VPS access without Vercel)
app.use(express.static(path.join(process.cwd(), "frontend/dist")));

// SPA fallback - serve index.html for non-API routes
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) {
    return next();
  }
  res.sendFile(path.join(process.cwd(), "frontend/dist/index.html"));
});

// tRPC middleware
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export function startServer() {
  app.listen(port, () => {
    console.log(`[LUMIX] Server running on http://0.0.0.0:${port}/`);
    console.log(`[LUMIX] Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

export function generateServerId(): string {
  return randomBytes(12).toString("hex");
}