import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { randomBytes } from "crypto";

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_STATE_MAX_AGE = 10 * 60 * 1000; // 10 minutes

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function generateState(): string {
  return randomBytes(32).toString("hex");
}

export function registerOAuthRoutes(app: Express) {
  // Initiate OAuth flow — generate state and redirect to provider
  app.get("/api/oauth/start", (req: Request, res: Response) => {
    const state = generateState();
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(OAUTH_STATE_COOKIE, state, {
      ...cookieOptions,
      maxAge: OAUTH_STATE_MAX_AGE,
      httpOnly: true,
    });
    // Redirect to OAuth provider with state
    const providerUrl = `${process.env.OAUTH_SERVER_URL}/authorize?client_id=${process.env.VITE_APP_ID}&redirect_uri=${encodeURIComponent(process.env.SITE_URL + "/api/oauth/callback")}&state=${state}&response_type=code`;
    res.redirect(302, providerUrl);
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const storedState = req.cookies?.[OAUTH_STATE_COOKIE];

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // Validate state parameter to prevent CSRF
    if (!storedState || state !== storedState) {
      res.status(403).json({ error: "Invalid or expired OAuth state" });
      return;
    }

    // Clear the state cookie after use
    res.clearCookie(OAUTH_STATE_COOKIE);

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        id: userInfo.openId,
        openId: userInfo.openId,
        name: userInfo.name ?? undefined,
        telegramFirstName: userInfo.name ?? undefined,
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
