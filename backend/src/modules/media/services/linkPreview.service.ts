import { load } from "cheerio";
import { HttpsProxyAgent } from "https-proxy-agent";
import { r2Service } from "./r2.service";
import { generateShortId } from "../../../modules/_core/filename";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

const YTDLP_PATH = process.env.YTDL_PATH || "yt-dlp";
const COOKIE_PATH = process.env.YTDL_COOKIE_PATH || path.resolve(process.cwd(), "backend/cookies.txt");

async function fetchThumbnailViaYtDlp(url: string): Promise<{ thumbnail: string; title: string } | null> {
  const baseArgs = [
    "--no-warnings", "--quiet",
    "--dump-json", "--no-download", "--no-playlist",
  ];
  const proxyUrl = getProxyUrl();
  if (proxyUrl) baseArgs.push("--proxy", proxyUrl);

  const tryRun = async (args: string[]): Promise<{ thumbnail: string; title: string } | null> => {
    try {
      const { stdout } = await execFileAsync(YTDLP_PATH, [...args, url], { timeout: 30000 });
      const info = JSON.parse(stdout);
      if (info?.thumbnail || info?.title) {
        return { thumbnail: info.thumbnail || "", title: info.title || "" };
      }
    } catch {}
    return null;
  };

  const result = await tryRun(baseArgs);
  if (result) return result;
  return tryRun([...baseArgs, "--cookies", COOKIE_PATH]);
}


const MOBILE_USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
];

function getRandomUserAgent(): string {
  return MOBILE_USER_AGENTS[Math.floor(Math.random() * MOBILE_USER_AGENTS.length)];
}

function getProxyUrl(): string {
  const h = process.env.EDGE_TTS_PROXY_HOST;
  const p = process.env.EDGE_TTS_PROXY_PORT;
  const u = process.env.EDGE_TTS_PROXY_USER;
  const s = process.env.EDGE_TTS_PROXY_PASS;
  return h && p && u && s ? `http://${u}:${s}@${h}:${p}` : "";
}

function getFacebookCookieString(): string {
  const envCookie = process.env.FB_COOKIE_STRING;
  if (envCookie) return envCookie;
  
  try {
    const fs = require("fs");
    const cookiePath = path.resolve(process.cwd(), "backend/cookies.txt");
    const content = fs.readFileSync(cookiePath, "utf-8");
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
  let m = url.match(/\/v\/(\d+)/);
  if (m) return m[1];
  m = url.match(/\/videos\/(\d+)/);
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

function parseNetscapeCookies(cookieString: string): Array<{ name: string; value: string; domain: string; path: string; expires: number; secure: boolean }> {
  const cookies: Array<{ name: string; value: string; domain: string; path: string; expires: number; secure: boolean }> = [];
  const pairs = cookieString.split(/;\s*/);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx < 0) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    cookies.push({
      name,
      value,
      domain: ".facebook.com",
      path: "/",
      expires: Date.now() + 86400000 * 365,
      secure: true,
    });
  }
  return cookies;
}

async function fetchFacebookWithPuppeteer(url: string): Promise<{ image: string; title: string } | null> {
  try {
    console.log("[LinkPreview] Launching Puppeteer for:", url);

    const puppeteerExtra = await import("puppeteer-extra");
    const stealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
    puppeteerExtra.default.use(stealthPlugin());

    const browser = await puppeteerExtra.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--window-size=1280x800",
        "--hide-scrollbars",
        "--disable-web-security",
      ],
    });

    const page = await browser.newPage();

    const cookieString = getFacebookCookieString();
    if (cookieString) {
      const parsedCookies = parseNetscapeCookies(cookieString);
      await page.setCookie(...parsedCookies);
      console.log("[LinkPreview] Set", parsedCookies.length, "cookies for Puppeteer");
    }

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const image = await page.$eval('meta[property="og:image"]', (el) => el.getAttribute("content") || "") ||
                  await page.$eval('meta[property="og:image:secure_url"]', (el) => el.getAttribute("content") || "") || "";
    const title = await page.$eval('meta[property="og:title"]', (el) => el.getAttribute("content") || "") ||
                  await page.$eval("title", (el) => el.textContent || "") || "Facebook Video";

    console.log("[LinkPreview] Puppeteer extracted:", { title: title.slice(0, 50), image: image.slice(0, 80) });

    await browser.close();
    return { image, title };
  } catch (e: any) {
    console.warn("[LinkPreview] Puppeteer failed:", e.message);
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

    // Try yt-dlp FIRST - most reliable for Facebook thumbnails
    try {
      console.log("[LinkPreview] Trying yt-dlp for Facebook thumbnail:", url);
      const ytdlpResult = await fetchThumbnailViaYtDlp(url);
      if (ytdlpResult?.thumbnail) {
        image = ytdlpResult.thumbnail;
        if (ytdlpResult.title) title = ytdlpResult.title;
        image = await proxyImageToR2(image);
        console.log("[LinkPreview] yt-dlp Facebook thumbnail success");
      }
    } catch (e: any) {
      console.warn("[LinkPreview] yt-dlp Facebook failed:", e.message);
    }

    const cookieString = getFacebookCookieString();

    if (!image && cookieString) {
      try {
        const puppeteerResult = await fetchFacebookWithPuppeteer(url);
        if (puppeteerResult && puppeteerResult.image) {
          image = resolveUrl(url, puppeteerResult.image);
          image = await proxyImageToR2(image);
          title = puppeteerResult.title;
          console.log("[LinkPreview] Found thumbnail via Puppeteer");
        }
      } catch (e: any) {
        console.warn("[LinkPreview] Puppeteer failed:", e.message);
      }
    }

    if (!image && cookieString) {
      try {
        console.log("[LinkPreview] Fetching Facebook URL with Cookie header:", url);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const proxyUrl = getProxyUrl();
        const fetchOptions: any = {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": cookieString,
          },
          redirect: "follow",
        };
        if (proxyUrl) {
          fetchOptions.dispatcher = new HttpsProxyAgent(proxyUrl);
          console.log("[LinkPreview] Using proxy:", proxyUrl.replace(/:[^:@]+@/, ":***@"));
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeout);

        if (response.ok) {
          const html = await response.text();
          const $ = load(html);
          const getMeta = (prop: string) => $(`meta[property="${prop}"]`).attr("content") || $(`meta[name="${prop}"]`).attr("content") || "";

          image = getMeta("og:image:secure_url") || getMeta("og:image:url") || getMeta("og:image") || getMeta("twitter:image") || "";

          console.log(`[LinkPreview] Cookie fetch status: ${response.status}, html length: ${html.length}, og:image found: ${!!image}`);
          title = getMeta("og:title") || $("title").text() || title;

          if (image) {
            image = resolveUrl(url, image);
            image = await proxyImageToR2(image);
            console.log("[LinkPreview] Found thumbnail via Cookie fetch");
          }
        } else {
          console.warn(`[LinkPreview] Cookie fetch returned HTTP ${response.status}`);
        }
      } catch (e: any) {
        console.warn("[LinkPreview] Cookie fetch failed:", e.message);
      }
    }

    if (!image) {
      console.log("[LinkPreview] Falling back to downloaderService (yt-dlp) for FB video info...");
      try {
        const { downloaderService } = require("./downloader.service");
        const info = await downloaderService.getVideoInfo(url);
        if (info?.thumbnail) {
          console.log("[LinkPreview] Found thumbnail via yt-dlp:", info.thumbnail.slice(0, 50));
          image = await proxyImageToR2(info.thumbnail);
          if (info.title) title = info.title;
        } else {
          console.warn("[LinkPreview] yt-dlp returned no thumbnail for", url);
        }
      } catch (e: any) {
        console.warn("[LinkPreview] yt-dlp fallback failed:", e.message);
      }
    }

    if (!image) {
      console.warn("[LinkPreview] All thumbnail extraction methods failed for", url);
    }

    return {
      title: title || "Facebook Video",
      description: "",
      image: image || FALLBACK_FACEBOOK_ICON,
      siteName: "Facebook",
    };
  }

  if (url.includes("tiktok.com")) {
    let tiktokImage = "";
    let tiktokTitle = "TikTok Video";

    // Try yt-dlp first - most reliable
    try {
      console.log("[LinkPreview] Trying yt-dlp for TikTok thumbnail:", url);
      const ytdlpResult = await fetchThumbnailViaYtDlp(url);
      if (ytdlpResult?.thumbnail) {
        tiktokImage = ytdlpResult.thumbnail;
        if (ytdlpResult.title) tiktokTitle = ytdlpResult.title;
        console.log("[LinkPreview] yt-dlp TikTok thumbnail success");
      }
    } catch (e: any) {
      console.warn("[LinkPreview] yt-dlp TikTok failed:", e.message);
    }

    // Fallback: oEmbed API
    if (!tiktokImage) {
      try {
        const cleanUrl = url.split("?")[0];
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
        const proxyUrl = getProxyUrl();
        const curlArgs = ["-s", "--max-time", "10"];
        if (proxyUrl) curlArgs.push("--proxy", proxyUrl);
        curlArgs.push("-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        curlArgs.push(oembedUrl);
        const { stdout } = await execFileAsync("curl", curlArgs, { timeout: 15000 });
        if (stdout) {
          const data = JSON.parse(stdout);
          if (data?.thumbnail_url) {
            tiktokImage = data.thumbnail_url;
            tiktokTitle = data.title || data.author_name || tiktokTitle;
            console.log("[LinkPreview] TikTok oEmbed success");
          }
        }
      } catch (e: any) {
        console.warn("[LinkPreview] TikTok oEmbed failed:", e.message);
      }
    }

    // Fallback: generic og:image fetch
    if (!tiktokImage) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": getRandomUserAgent() },
        });
        clearTimeout(timeout);
        if (response.ok) {
          const html = await response.text();
          const $ = load(html);
          const getMeta = (prop: string) => $(`meta[property="${prop}"]`).attr("content") || $(`meta[name="${prop}"]`).attr("content") || "";
          tiktokImage = getMeta("og:image:secure_url") || getMeta("og:image:url") || getMeta("og:image") || getMeta("twitter:image") || "";
          tiktokTitle = getMeta("og:title") || $("title").text() || tiktokTitle;
          if (tiktokImage) console.log("[LinkPreview] TikTok og:image fetch success");
        }
      } catch (e: any) {
        console.warn("[LinkPreview] TikTok generic fetch failed:", e.message);
      }
    }

    return { title: tiktokTitle, description: "", image: tiktokImage, siteName: "TikTok" };
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
