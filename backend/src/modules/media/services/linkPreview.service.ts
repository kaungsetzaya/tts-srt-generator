import { load } from "cheerio";

// Desktop User-Agent for Facebook (must match a real browser exactly)
const DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
  // If relative starts with /, prepend Facebook domain
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

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  const isFacebook = isFacebookUrl(url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // Use Facebook-specific headers when scraping Facebook URLs
    const fetchHeaders: Record<string, string> = isFacebook
      ? {
          "User-Agent": DESKTOP_USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        }
      : {
          "User-Agent": DESKTOP_USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        };

    const response = await fetch(url, {
      signal: controller.signal,
      headers: fetchHeaders,
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

    // Metadata extraction in specific order:
    // 1. og:image:secure_url  2. og:image  3. twitter:image
    let image = getMeta("og:image:secure_url") ||
                getMeta("og:image") ||
                getMeta("twitter:image") ||
                getMeta("twitter:image:src") ||
                "";

    // Fix relative URLs — prepend https://www.facebook.com for Facebook paths
    if (image) {
      image = resolveUrl(url, image);
    }

    // Facebook fallback
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
