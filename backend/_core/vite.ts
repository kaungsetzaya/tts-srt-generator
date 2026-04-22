import { randomBytes } from "crypto";
import type { ViteDevServer } from "vite";

export function setupVite(app: any, server: any) {
  // Simple mock for vite setup in production
  // Replace with real vite setup for development
  console.log("[Vite] Setup complete");
}

export function generateViteId(): string {
  return randomBytes(18).toString("hex");
}
