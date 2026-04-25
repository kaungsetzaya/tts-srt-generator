import { load } from "cheerio";
import { r2Service } from "./r2.service";
import { generateShortId } from "../../../modules/_core/filename";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

const MOBILE_USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
];

function getRandomUserAgent(): string {
  return MOBILE_USER_AGENTS[Math.floor(Math.random() * MOBILE_USER_AGENTS.length)];
}

function getFacebookCookieString(): string {
  // First try env variable, then try cookies.txt file
  const envCookie = process.env.FB_COOKIE_STRING;
  if (envCookie) return envCookie;
  
  // Try to read from cookies.txt file
  try {
    const fs = require("fs");
    const cookiePath = path.resolve(process.cwd(), "backend/cookies.txt");
    const content = fs.readFileSync(cookiePath, "utf-8");
    // Parse Netscape cookie format to Cookie header string
    const lines = content.split("\n");
    const cookies: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const parts = trimmed.split("\t");
      if (parts.length >= 7 && parts[0].includes("facebook.com")) {
        cookies.push(`${parts[5]}=${parts[6]}`);
      }
    }
    return cookies.join("; ");
  } catch {
    return "";
  }
}

export interface LinkPreviewData {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

const FALLBACK_FACEBOOK_ICON = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";

function isFacebookUrl(url: string): boolean {
  return url.includes("facebook.com") || url.includes("fb.watch");
}

function extractFacebookVideoId(url: string): string | null {
  let m = url.match(/\/videos\/(\d+)/);
  if (m) return m[1];
  m = url.match(/\/reel\/(\d+)/);
  if (m) return m[1];
  m = url.match(/[?&]v=(\d+)/);
  if (m) return m[1];
  return null;
}

async function fetchFacebookGraphThumbnail(videoId: string): Promise<string | null> {
  const token = process.env.FACEBOOK_APP_ACCESS_TOKEN;
  if (!token) {
    console.warn("[LinkPreview] FACEBOOK_APP_ACCESS_TOKEN not set, Graph API skipped");
    return null;
  }
  try {
    const apiUrl = `https://graph.facebook.com/v22.0/${videoId}?fields=picture,thumbnails{uri}&access_token=${token}`;
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      console.warn("[LinkPreview] Graph API returned", response.status);
      return null;
    }
    const data = await response.json() as any;
    const picture = data?.picture || data?.thumbnails?.data?.[0]?.uri || null;
    if (picture) {
      console.log("[LinkPreview] Graph API thumbnail found for", videoId);
    }
    return picture;
  } catch (e: any) {
    console.warn("[LinkPreview] Graph API failed:", e.message);
    return null;
  }
}

function resolveUrl(base: string, relative: string): string {
  if (!relative) return "";
  if (relative.startsWith("/")) {
    return `https://www.facebook.com${relative}`;
  }
  if (relative.startsWith("http://") || relative.startsWith("https://") || relative.startsWith("//")) {
    return relative;
  }
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

async function proxyImageToR2(imageUrl: string): Promise<string> {
  if (!r2Service.isEnabled()) {
    console.log("[LinkPreview] R2 not enabled, skipping proxy");
    return imageUrl;
  }
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.facebook.com/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.warn(`[LinkPreview] Proxy fetch returned ${response.status}, falling back to original URL`);
      return imageUrl;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    let ext = imageUrl.split("?")[0].split(".").pop() || "jpg";
    const mimeMap: Record<string, string> = {
      jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif", webp: "webp", avif: "avif", svg: "svg+xml",
    };
    ext = mimeMap[ext.toLowerCase()] || ext;
    const key = `static/previews/${generateShortId()}_preview.${ext === "svg+xml" ? "svg" : ext}`;
    await r2Service.uploadFile(key, buffer, `image/${ext}`);
    const signedUrl = await r2Service.getSignedDownloadUrl(key, 3600);
    console.log("[LinkPreview] Proxied to R2:", signedUrl.slice(0, 80) + "...");
    return signedUrl;
  } catch (e: any) {
    console.warn("[LinkPreview] Proxy fetch failed, returning original URL:", e.message);
    return imageUrl;
  }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  const isFacebook = isFacebookUrl(url);

  if (isFacebook) {
    let image = "";
    let title = "Facebook Video";
    
    // Try Cheerio fetch with Cookie header first
    const cookieString = getFacebookCookieString();
    if (cookieString) {
      try {
        console.log("[LinkPreview] Fetching Facebook URL with Cookie header:", url);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": cookieString,
          },
          redirect: "follow",
        });
        clearTimeout(timeout);
        
        if (response.ok) {
          const html = await response.text();
          const $ = load(html);
          const getMeta = (prop: string) => $(`meta[property="${prop}"]`).attr("content") || $(`meta[name="${prop}"]`).attr("content") || "";
          
          image = getMeta("og:image:secure_url") || getMeta("og:image:url") || getMeta("og:image") || getMeta("twitter:image") || "";
          title = getMeta("og:title") || $("title").text() || title;
          
          if (image) {
            image = resolveUrl(url, image);
            image = await proxyImageToR2(image);
            console.log("[LinkPreview] Found thumbnail via Cookie fetch");
          }
        }
      } catch (e: any) {
        console.warn("[LinkPreview] Cookie fetch failed:", e.message);
      }
    }
    
    // Fallback: try Graph API if no image yet
    if (!image) {
      const videoId = extractFacebookVideoId(url);
      if (videoId) {
        const graphThumb = await fetchFacebookGraphThumbnail(videoId);
        if (graphThumb) {
          image = await proxyImageToR2(graphThumb);
        }
      }
    }

    // Fallback: try yt-dlp
    if (!image) {
      console.log("[LinkPreview] Falling back to downloaderService (yt-dlp) for FB video info...");
      try {
        const { downloaderService } = require("./downloader.service");
        const info = await downloaderService.getVideoInfo(url);
        if (info?.thumbnail) {
          image = await proxyImageToR2(info.thumbnail);
          if (info.title) title = info.title;
        }
      } catch (e: any) {
        console.warn("[LinkPreview] yt-dlp fallback failed:", e.message);
      }
    }

    return {
      title: title || "Facebook Video",
      description: "",
      image: image || FALLBACK_FACEBOOK_ICON,
      siteName: "Facebook",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": getRandomUserAgent() },
    });
    clearTimeout(timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const $ = load(html);
    const getMeta = (prop: string) => $(`meta[property="${prop}"]`).attr("content") || $(`meta[name="${prop}"]`).attr("content") || "";

    let image = getMeta("og:image:secure_url") || getMeta("og:image:url") || getMeta("og:image") || getMeta("twitter:image") || "";
    if (image) image = resolveUrl(url, image);

    return {
      title: getMeta("og:title") || $("title").text() || url,
      description: getMeta("og:description") || getMeta("description"),
      image: image,
      siteName: getMeta("og:site_name") || new URL(url).hostname,
    };
  } catch (error: any) {
    console.error("[LinkPreview] Fetch failed for", url, error.message);
    return { title: url, description: "", image: "", siteName: new URL(url).hostname };
  }
}