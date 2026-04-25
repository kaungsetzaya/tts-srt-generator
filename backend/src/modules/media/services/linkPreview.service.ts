import { load } from "cheerio";

const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface LinkPreviewData {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

const FALLBACK_FACEBOOK_ICON = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);

    // Extract Open Graph and Twitter Card meta tags
    const getMeta = (prop: string): string => {
      const val = $(`meta[property="${prop}"]`).attr("content") ||
                  $(`meta[name="${prop}"]`).attr("content") || "";
      return val.trim();
    };

    let image = getMeta("og:image") || getMeta("twitter:image") || getMeta("twitter:image:src");

    // If it's a Facebook URL and no image found, use fallback
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
    
    // Fallback for Facebook URLs
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
