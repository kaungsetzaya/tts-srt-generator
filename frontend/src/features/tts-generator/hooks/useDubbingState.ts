import { useState, useRef, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import type { VoiceTier } from "@/lib/voices";

export interface DubbingResult {
  videoUrl: string;
  srtUrl?: string;
  srtContent?: string;
  videoId?: string;
  videoBase64?: string;
}

export interface UseDubbingStateReturn {
  // State
  dubVideoFile: File | null;
  setDubVideoFile: (f: File | null) => void;
  dubVideoUrl: string;
  setDubVideoUrl: (url: string) => void;
  dubDragOver: boolean;
  setDubDragOver: (v: boolean) => void;
  dubResult: DubbingResult | null;
  setDubResult: (r: DubbingResult | null) => void;
  dubProgress: number;
  setDubProgress: (p: number) => void;
  dubProgressMessage: string;
  setDubProgressMessage: (m: string) => void;
  dubPreviewUrl: string;
  setDubPreviewUrl: (url: string) => void;
  dubDetectedRatio: "9:16" | "16:9";
  setDubDetectedRatio: (r: "9:16" | "16:9") => void;
  dubVideoWidth: number;
  setDubVideoWidth: (w: number) => void;
  dubVideoHeight: number;
  setDubVideoHeight: (h: number) => void;
  videoPreviewError: string;
  setVideoPreviewError: (e: string) => void;
  videoLoading: boolean;
  setVideoLoading: (v: boolean) => void;
  dubSelectedVoice: string;
  setDubSelectedVoice: (v: string) => void;
  dubSelectedTier: VoiceTier;
  setDubSelectedTier: (t: VoiceTier) => void;

  // SRT settings
  srtEnabled: boolean;
  setSrtEnabled: (v: boolean) => void;
  srtFontSize: number;
  setSrtFontSize: (v: number) => void;
  srtColor: string;
  setSrtColor: (v: string) => void;
  srtDropShadow: boolean;
  setSrtDropShadow: (v: boolean) => void;
  srtBlurBg: boolean;
  setSrtBlurBg: (v: boolean) => void;
  srtMarginV: number;
  setSrtMarginV: (v: number) => void;
  srtBlurOpacity: number;
  setSrtBlurOpacity: (v: number) => void;
  srtBlurColor: "black" | "white" | "transparent";
  setSrtBlurColor: (v: "black" | "white" | "transparent") => void;
  srtFullWidth: boolean;
  setSrtFullWidth: (v: boolean) => void;
  srtBorderRadius: "rounded" | "square";
  setSrtBorderRadius: (v: "rounded" | "square") => void;
  srtBoxPadding: number;
  setSrtBoxPadding: (v: number) => void;

  // Refs
  dubFileRef: React.RefObject<HTMLInputElement | null>;
  dubResultVideoRef: React.RefObject<HTMLVideoElement | null>;
  dubPreviewRef: React.RefObject<HTMLVideoElement | null>;

  // Computed
  computeSrtPreviewStyle: React.CSSProperties;

  // Job state
  activeJobId: string | null;

  // Mutation status
  startDubMutationPending: boolean;
  dubFileMutationPending: boolean;

  // Handlers
  handleDubVideoFile: (f: File) => void;
  handleDubGenerate: () => Promise<void>;
  handleDubDownload: () => void;
  handleDubPreview: () => void;
  handleDubReset: () => void;
  pollJobStatus: (jobId: string) => void;
  isExternalVideoUrl: (url: string) => boolean;
  isYouTubeUrl: (url: string) => boolean;
  getYouTubeVideoId: (url: string) => string | null;
  linkPreview?: { title: string; description: string; image: string; siteName: string };
  linkPreviewLoading: boolean;
}

export function useDubbingState(
  showError: (msg: string) => void,
  showSuccess: (msg: string) => void,
  utils: any
): UseDubbingStateReturn {
  // === DUBBING TAB STATE ===
  const [dubVideoFile, setDubVideoFile] = useState<File | null>(null);
  const [dubVideoUrl, setDubVideoUrl] = useState<string>("");
  const [dubDragOver, setDubDragOver] = useState(false);
  const [dubResult, setDubResult] = useState<DubbingResult | null>(null);
  const [dubProgress, setDubProgress] = useState<number>(0);
  const [dubProgressMessage, setDubProgressMessage] = useState<string>("");
  const dubResultVideoRef = useRef<HTMLVideoElement>(null);

  // Dubbing wizard state
  const [dubPreviewUrl, setDubPreviewUrl] = useState<string>("");
  const dubPreviewRef = useRef<HTMLVideoElement>(null);
  const [dubDetectedRatio, setDubDetectedRatio] = useState<"9:16" | "16:9">("16:9");
  const [dubVideoWidth, setDubVideoWidth] = useState(1920);
  const [dubVideoHeight, setDubVideoHeight] = useState(1080);
  const [videoPreviewError, setVideoPreviewError] = useState<string>("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [dubSelectedVoice, setDubSelectedVoice] = useState<string>("thiha");
  const [dubSelectedTier, setDubSelectedTier] = useState<VoiceTier>("tier1");

  // Dubbing SRT overlay settings
  const [srtEnabled, setSrtEnabled] = useState(true);
  const [srtFontSize, setSrtFontSize] = useState(24);
  const [srtColor, setSrtColor] = useState("#ffffff");
  const [srtDropShadow, setSrtDropShadow] = useState(true);
  const [srtBlurBg, setSrtBlurBg] = useState(true);
  const [srtMarginV, setSrtMarginV] = useState(30);
  const [srtBlurOpacity, setSrtBlurOpacity] = useState(50);
  const [srtBlurColor, setSrtBlurColor] = useState<"black" | "white" | "transparent">("black");
  const [srtFullWidth, setSrtFullWidth] = useState(false);
  const [srtBorderRadius, setSrtBorderRadius] = useState<"rounded" | "square">("rounded");
  const [srtBoxPadding, setSrtBoxPadding] = useState(4);

  const dubFileRef = useRef<HTMLInputElement>(null);

  // Mutations
  const dubFileMutation = trpc.video.dubFile.useMutation();
  const dubLinkMutation = trpc.video.dubLink.useMutation();
  const startDubMutation = trpc.jobs.startDub.useMutation();

  // Job-based status
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Link preview for platform URLs (Facebook, etc.)
  const linkPreviewQuery = trpc.video.getLinkPreview.useQuery(
    { url: dubVideoUrl.trim() },
    {
      enabled: !!dubVideoUrl.trim() && !dubVideoFile && !dubPreviewUrl.startsWith("http"),
      retry: false,
      staleTime: Infinity,
    }
  );

  // Fallback: fetch video info (thumbnail) from yt-dlp when link preview has no image
  const isFacebook = dubVideoUrl.includes("facebook.com") || dubVideoUrl.includes("fb.watch");
  const needsThumbnailFallback = isFacebook && !!linkPreviewQuery.data && !linkPreviewQuery.data.image;
  const videoInfoQuery = trpc.video.getVideoInfo.useQuery(
    { url: dubVideoUrl.trim() },
    {
      enabled: needsThumbnailFallback,
      retry: false,
      staleTime: Infinity,
    }
  );

  const jobStatusQuery = trpc.jobs.getStatus.useQuery(
    { jobId: activeJobId ?? "" },
    {
      enabled: !!activeJobId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === "completed" || data?.status === "failed") return false;
        return 3000;
      },
      retry: false,
      staleTime: 0,
    }
  );

  // Extract platform embed URL from URL for actual video preview
  const getPlatformEmbedUrl = (url: string): { type: "youtube" | "facebook" | "tiktok" | null; embedUrl: string | null } => {
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
    }
    // YouTube share URLs
    const ytShareMatch = url.match(/youtube\.com\/share\/v\/([a-zA-Z0-9_-]+)/);
    if (ytShareMatch) {
      return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${ytShareMatch[1]}` };
    }
    // Facebook
    if (url.includes("facebook.com") || url.includes("fb.watch")) {
      return { type: "facebook", embedUrl: url };
    }
    // TikTok
    const tiktokMatch = url.match(/tiktok\.com\/(@[\w.]+)\/video\/(\d+)/);
    if (tiktokMatch) {
      return { type: "tiktok", embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[2]}` };
    }
    const tiktokShareMatch = url.match(/tiktok\.com\/t\/([a-zA-Z0-9]+)/);
    if (tiktokShareMatch) {
      return { type: "tiktok", embedUrl: `https://www.tiktok.com/embed/v2/${tiktokShareMatch[1]}` };
    }
    if (url.includes("tiktok.com")) {
      return { type: "tiktok", embedUrl: null };
    }
    return { type: null, embedUrl: null };
  };

  // Auto-preview when URL changes
  const dubPreviewUrlRef = useRef<string>("");

  useEffect(() => {
    if (!dubVideoUrl && !dubVideoFile) {
      setDubPreviewUrl("");
      setVideoPreviewError("");
      setVideoLoading(false);
      setDubResult(null);
      dubPreviewUrlRef.current = "";
      return;
    }
    if (!dubVideoUrl.trim() || dubVideoFile) return;
    const timer = setTimeout(() => {
      const url = dubVideoUrl.trim();
      if (!url || dubPreviewUrlRef.current === url) return;
      dubPreviewUrlRef.current = url;
      setVideoPreviewError("");
      setDubResult(null);
      // Only auto-preview if URL looks like a direct video file
      // YouTube/Facebook/TikTok share links are HTML pages, not videos
      const isDirectVideo = /\.(mp4|webm|mov|mkv|avi)(\?.*)?$/i.test(url);
      if (isDirectVideo) {
        setDubPreviewUrl(url);
      } else {
        // For platform URLs, get embed URL for iframe preview
        const embed = getPlatformEmbedUrl(url);
        if (embed.type && embed.embedUrl) {
          // Set aspect ratio based on platform
          if (embed.type === "tiktok" || embed.type === "facebook") {
            setDubDetectedRatio("9:16");
          }
          setDubPreviewUrl(`embed:${embed.type}:${embed.embedUrl}`);
        } else if (embed.type) {
          setDubPreviewUrl("platform-url");
        } else {
          setDubPreviewUrl("platform-url");
        }
      }
      setVideoLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [dubVideoUrl, dubVideoFile]);

  // React to dub job status changes
  useEffect(() => {
    if (!activeJobId) return;
    if (jobStatusQuery.error) {
      const errMsg = (jobStatusQuery.error as any)?.message || "Dubbing status check failed. Please try again.";
      showError(errMsg);
      setActiveJobId(null);
      setDubProgress(0);
      setDubProgressMessage("");
      return;
    }
    if (!jobStatusQuery.data) return;
    const status = jobStatusQuery.data;
    if (status.status === "completed" && status.result) {
      setDubResult(status.result as DubbingResult);
      setActiveJobId(null);
      setDubProgress(100);
      setDubProgressMessage("");
      utils.subscription.myStatus.invalidate();
    } else if (status.status === "failed") {
      showError(status.error || "Dubbing failed. Please try again.");
      setActiveJobId(null);
      setDubProgress(0);
      setDubProgressMessage("");
    } else if (status.status === "processing" || status.status === "pending") {
      setDubProgress(status.progress ?? 0);
      setDubProgressMessage(status.message || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId, jobStatusQuery.data, jobStatusQuery.error]);

  // Timeout guard: if dubbing takes > 15 minutes, surface an error
  useEffect(() => {
    if (!activeJobId) return;
    const timeout = setTimeout(() => {
      if (activeJobId) {
        showError("Dubbing timed out after 15 minutes. Please try a shorter video.");
        setActiveJobId(null);
      }
    }, 15 * 60 * 1000);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId]);

  // Load video when result arrives
  useEffect(() => {
    if (dubResult?.videoUrl && dubResultVideoRef.current) {
      dubResultVideoRef.current.load();
    }
  }, [dubResult?.videoUrl]);

  const computeSrtPreviewStyle = useMemo(() => {
    const vw = dubVideoWidth;
    const vh = dubVideoHeight;
    const containerWidth = dubDetectedRatio === "9:16" ? Math.min(240, window.innerWidth * 0.55) : window.innerWidth;
    const scale = containerWidth / vw;
    const fontScaleFactor = vh / 720;
    const baseFontSize = (srtFontSize ?? 24) * fontScaleFactor * 1.5;
    const scaledFontSize = baseFontSize * scale;
    const marginV = 80 + (srtMarginV ?? 30) * 3 * (vh / 1080);
    const topPercent = ((vh - marginV) / vh) * 100;
    const bgAlpha = srtBlurOpacity / 100;
    const outline = Math.max(4, (srtBoxPadding ?? 4) * 3);
    const scaledPadding = outline * scale;
    const shadowSize = 2 * scale;

    return {
      fontSize: `${Math.max(10, Math.min(22, scaledFontSize))}px`,
      color: srtColor,
      fontWeight: "bold" as const,
      textShadow: srtDropShadow
        ? `0 ${shadowSize}px ${shadowSize * 2}px rgba(0,0,0,0.9), 0 -${shadowSize / 2}px ${shadowSize}px rgba(0,0,0,0.6)`
        : "none",
      background: srtBlurBg
        ? srtBlurColor === "black"
          ? `rgba(0,0,0,${bgAlpha})`
          : srtBlurColor === "white"
            ? `rgba(255,255,255,${bgAlpha})`
            : `rgba(128,128,128,${bgAlpha})`
        : "transparent",
      backdropFilter: srtBlurBg ? `blur(${Math.max(2, srtBlurOpacity / 15)}px)` : "none",
      borderRadius: srtBorderRadius === "rounded" ? "6px" : "0px",
      padding: `${Math.max(2, scaledPadding)}px ${Math.max(6, scaledPadding * 1.5)}px`,
      width: srtFullWidth ? "calc(100% - 24px)" : "fit-content",
      margin: "0 auto",
      maxWidth: "calc(100% - 24px)",
      minWidth: 0,
      wordWrap: "break-word" as const,
      wordBreak: "normal" as const,
      overflowWrap: "anywhere" as const,
      lineHeight: 1.3,
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "-webkit-box" as const,
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical" as const,
      position: "absolute" as const,
      left: 0,
      right: 0,
      bottom: `${Math.max(2, Math.min(40, topPercent * 0.4))}%`,
      zIndex: 5,
      textAlign: "center" as const,
      pointerEvents: "none" as const,
    };
  }, [
    dubVideoWidth,
    dubVideoHeight,
    dubDetectedRatio,
    srtFontSize,
    srtMarginV,
    srtBlurOpacity,
    srtBlurColor,
    srtBlurBg,
    srtBoxPadding,
    srtFullWidth,
    srtDropShadow,
    srtBorderRadius,
    srtColor,
  ]);

  const handleDubVideoFile = (f: File) => {
    if (f.size > 25 * 1024 * 1024) {
      showError("File too large. Max 25MB.");
      return;
    }
    if (dubPreviewUrl && dubVideoFile) {
      URL.revokeObjectURL(dubPreviewUrl);
    }
    setDubVideoFile(f);
    setDubVideoUrl("");
    setDubResult(null);
    setVideoPreviewError("");
    const url = URL.createObjectURL(f);
    setDubPreviewUrl(url);
    setVideoLoading(false);
  };

  const CHARACTER_VOICES_MAP: Record<string, { base: string }> = {
    ryan: { base: "thiha" },
    ronnie: { base: "thiha" },
    lucas: { base: "thiha" },
    daniel: { base: "thiha" },
    evander: { base: "thiha" },
    michelle: { base: "nilar" },
    iris: { base: "nilar" },
    charlotte: { base: "nilar" },
    amara: { base: "nilar" },
  };

  const handleDubGenerate = async () => {
    console.log("[GENERATE] Starting dubbing...");
    const dubVoiceToUse = dubSelectedVoice;

    setDubResult(null);
    setDubProgress(0);
    setVideoPreviewError("");

    if (dubVideoUrl.trim()) {
      try {
        console.log("[GENERATE] Using URL:", dubVideoUrl.trim());
        const res = await startDubMutation.mutateAsync({
          url: dubVideoUrl.trim(),
          voice: dubVoiceToUse as any,
          srtEnabled,
          srtFontSize,
          srtColor,
          srtMarginV,
          srtBlurBg,
          srtBlurOpacity,
          srtBlurColor,
          srtBoxPadding,
          srtFullWidth,
          srtDropShadow,
          srtBorderRadius,
        });
        console.log("[GENERATE] Job started:", res.jobId);
        setActiveJobId(res.jobId);
        pollJobStatus(res.jobId);
      } catch (e: any) {
        console.error("[DUB LINK ERROR]", e);
        showError(e?.message || "Dubbing failed");
      }
      return;
    }

    if (!dubVideoFile) {
      console.log("[GENERATE] No video file or URL");
      return;
    }

    console.log("[GENERATE] Using file:", dubVideoFile.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await dubFileMutation.mutateAsync({
          videoBase64: base64,
          filename: dubVideoFile.name,
          voice: dubVoiceToUse as any,
          srtEnabled,
          srtFontSize,
          srtColor,
          srtMarginV,
          srtBlurBg,
          srtBlurOpacity,
          srtBlurColor,
          srtBoxPadding,
          srtFullWidth,
          srtDropShadow,
          srtBorderRadius,
        });
        console.log("[GENERATE] File job started:", res.jobId);
        setActiveJobId(res.jobId);
        pollJobStatus(res.jobId);
        utils.subscription.myStatus.invalidate();
      } catch (e: any) {
        console.error("[DUB FILE ERROR]", e);
        showError(e?.message || "Dubbing failed");
      }
    };
    reader.readAsDataURL(dubVideoFile);
  };

  const handleDubDownload = () => {
    if (dubResult?.videoUrl) {
      const a = document.createElement("a");
      a.href = dubResult.videoUrl;
      a.download = `Dubbed_Myanmar_${Date.now()}.mp4`;
      a.click();
    } else if (dubResult?.videoBase64) {
      const binary = atob(dubResult.videoBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Dubbed_Myanmar_${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const isExternalVideoUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes("youtube.com") ||
      lower.includes("youtu.be") ||
      lower.includes("tiktok.com") ||
      lower.includes("facebook.com") ||
      lower.includes("fb.watch") ||
      lower.includes("fb.com")
    );
  };

  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
    return null;
  };

  const isYouTubeUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes("youtube.com") || lower.includes("youtu.be");
  };

  const handleDubPreview = () => {
    setVideoLoading(true);
    setVideoPreviewError("");

    try {
      if (dubVideoFile) {
        const url = URL.createObjectURL(dubVideoFile);
        setDubPreviewUrl(url);
        setVideoLoading(false);
      } else if (dubVideoUrl.trim()) {
        setDubPreviewUrl(dubVideoUrl.trim());
        setVideoLoading(false);
      }
    } catch (error) {
      setVideoPreviewError("Failed to load video. Please try again.");
      setVideoLoading(false);
      console.error("Video preview error:", error);
    }
  };

  const handleDubReset = () => {
    if (dubPreviewUrl && dubVideoFile) {
      URL.revokeObjectURL(dubPreviewUrl);
    }
    setDubVideoFile(null);
    setDubVideoUrl("");
    setDubResult(null);
    setDubPreviewUrl("");
    setDubDetectedRatio("16:9");
    setVideoLoading(false);
    setVideoPreviewError("");
  };

  const pollJobStatus = (jobId: string) => {
    setActiveJobId(jobId);
  };

  return {
    dubVideoFile,
    setDubVideoFile,
    dubVideoUrl,
    setDubVideoUrl,
    dubDragOver,
    setDubDragOver,
    dubResult,
    setDubResult,
    dubProgress,
    setDubProgress,
    dubProgressMessage,
    setDubProgressMessage,
    dubPreviewUrl,
    setDubPreviewUrl,
    dubDetectedRatio,
    setDubDetectedRatio,
    dubVideoWidth,
    setDubVideoWidth,
    dubVideoHeight,
    setDubVideoHeight,
    videoPreviewError,
    setVideoPreviewError,
    videoLoading,
    setVideoLoading,
    dubSelectedVoice,
    setDubSelectedVoice,
    dubSelectedTier,
    setDubSelectedTier,
    srtEnabled,
    setSrtEnabled,
    srtFontSize,
    setSrtFontSize,
    srtColor,
    setSrtColor,
    srtDropShadow,
    setSrtDropShadow,
    srtBlurBg,
    setSrtBlurBg,
    srtMarginV,
    setSrtMarginV,
    srtBlurOpacity,
    setSrtBlurOpacity,
    srtBlurColor,
    setSrtBlurColor,
    srtFullWidth,
    setSrtFullWidth,
    srtBorderRadius,
    setSrtBorderRadius,
    srtBoxPadding,
    setSrtBoxPadding,
    dubFileRef,
    dubResultVideoRef,
    dubPreviewRef,
    computeSrtPreviewStyle,
    activeJobId,
    startDubMutationPending: startDubMutation.isPending,
    dubFileMutationPending: dubFileMutation.isPending,
    handleDubVideoFile,
    handleDubGenerate,
    handleDubDownload,
    handleDubPreview,
    handleDubReset,
    pollJobStatus,
    isExternalVideoUrl,
    isYouTubeUrl,
    getYouTubeVideoId,
    linkPreview: linkPreviewQuery.data
      ? {
          ...linkPreviewQuery.data,
          image:
            linkPreviewQuery.data.image ||
            videoInfoQuery.data?.thumbnail ||
            "",
        }
      : undefined,
    linkPreviewLoading: linkPreviewQuery.isLoading || videoInfoQuery.isLoading,
  };
}
