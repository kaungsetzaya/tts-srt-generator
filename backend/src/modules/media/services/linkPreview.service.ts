import { load } from "cheerio";

// Mobile User-Agent is more likely to get full HTML from social platforms
const MOBILE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1";

export interface LinkPreviewData {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

const FALLBACK_FACEBOOK_ICON = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";

function resolveUrl(base: string, relative: string): string {
  if (!relative || relative.startsWith("http://") || relative.startsWith("https://") || relative.startsWith("//")) {
    return relative;
  }
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": MOBILE_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
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

    // Extract Open Graph, Twitter Card, and link rel meta tags
    const getMeta = (prop: string): string => {
      const val = $(`meta[property="${prop}"]`).attr("content") ||
                  $(`meta[name="${prop}"]`).attr("content") || "";
      return val.trim();
    };

    // Look for image in order: og:image, twitter:image, link[rel='image_src']
    let image = getMeta("og:image") || 
                getMeta("twitter:image") || 
                getMeta("twitter:image:src") ||
                $("link[rel='image_src']").attr("href") ||
                "";

    // Resolve relative URLs to absolute
    if (image) {
      image = resolveUrl(url, image);
    }

    // Facebook fallback
    const isFacebook = url.includes("facebook.com") || url.includes("fb.watch");
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
    
    if (url.includes("facebook.com") || url.includes("fb.watch")) {
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
