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

// Security Headers
app.use((req, res, next) => {
  // Content-Security-Policy - Restrict content sources
  res.setHeader("Content-Security-Policy", 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https: blob:; " +
    "media-src 'self' blob: https:; " +
    "connect-src 'self' https://generativelanguage.googleapis.com https://choco.de5.net https://*.vercel.app; " +
    "frame-src 'self' https://www.youtube.com https://youtube.com; " +
    "frame-ancestors 'none';"
  );
  
  // Strict-Transport-Security - Enforce HTTPS
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  
  // X-Frame-Options - Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // X-Content-Type-Options - Prevent MIME-sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // X-XSS-Protection - Enable browser XSS filter
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer-Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions-Policy
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

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