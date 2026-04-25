import { load } from "cheerio";
import { r2Service } from "./r2.service";
import { generateShortId } from "../../../modules/_core/filename";

// Randomized mobile User-Agents to bypass Facebook bot detection
const MOBILE_USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
];

function getRandomUserAgent(): string {
  return MOBILE_USER_AGENTS[Math.floor(Math.random() * MOBILE_USER_AGENTS.length)];
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

// Proxy fetch: download image and upload to R2 to avoid hotlinking blocks
async function proxyImageToR2(imageUrl: string): Promise<string> {
  if (!r2Service.isEnabled()) return imageUrl;
  try {
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": getRandomUserAgent() },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return imageUrl;
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = imageUrl.split("?")[0].split(".").pop() || "jpg";
    const key = `static/previews/${generateShortId()}_preview.${ext}`;
    await r2Service.uploadFile(key, buffer, `image/${ext}`);
    return await r2Service.getSignedUrl(key, 3600);
  } catch (e: any) {
    console.warn("[LinkPreview] Proxy fetch failed, returning original URL:", e.message);
    return imageUrl;
  }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  const isFacebook = isFacebookUrl(url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const userAgent = isFacebook ? getRandomUserAgent() : MOBILE_USER_AGENTS[0];

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);

    const getMeta = (prop: string): string => {
      const val = $(`meta[property="${prop}"]`).attr("content") ||
                  $(`meta[name="${prop}"]`).attr("content") || "";
      return val.trim();
    };

    // Metadata extraction in order:
    // 1. og:image:secure_url  2. og:image:url  3. og:image  4. twitter:image:src  5. twitter:image
    let image = getMeta("og:image:secure_url") ||
                getMeta("og:image:url") ||
                getMeta("og:image") ||
                getMeta("twitter:image:src") ||
                getMeta("twitter:image") ||
                "";

    if (image) {
      image = resolveUrl(url, image);
      // For Facebook, try to proxy the image to avoid hotlink blocks
      if (isFacebook && image.includes("fbcdn.net")) {
        image = await proxyImageToR2(image);
      }
    }

    if (isFacebook && !image) {
      image = FALLBACK_FACEBOOK_ICON;
    }

    return {
      title: getMeta("og:title") || getMeta("twitter:title") || $("title").text() || url,
      description: getMeta("og:description") || getMeta("twitter:description") || getMeta("description"),
      image,
      siteName: getMeta("og:site_name") || getMeta("twitter:site") || new URL(url).hostname,
    };
  } catch (error: any) {
    console.error("[LinkPreview] Failed to fetch preview for", url, error.message);

    if (isFacebook) {
      return {
        title: "Facebook Video",
        description: "",
        image: FALLBACK_FACEBOOK_ICON,
        siteName: "facebook.com",
      };
    }

    return {
      title: url,
      description: "",
      image: "",
      siteName: new URL(url).hostname,
    };
  }
}
