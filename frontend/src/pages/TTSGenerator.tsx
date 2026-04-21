import { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useSystemTime } from "@/lib/useSystemTime";
import { Slider } from "@/components/ui/slider";
import {
  ChevronUp,
  Loader2,
  Download,
  Volume2,
  LogOut,
  Crown,
  AlertCircle,
  Mic,
  FileVideo,
  Settings,
  Sparkles,
  Upload,
  Sun,
  Moon,
  Copy,
  Check,
  Link as LinkIcon,
  Wand2,
  Clock as ClockIcon,
  Info,
  ChevronDown,
  BookOpen,
  History as HistoryIcon,
  Zap,
  ExternalLink,
  Subtitles,
  Star,
} from "lucide-react";
import { useLocation } from "wouter";
import { TTSGeneratorLayout } from "@/components/TTSGeneratorLayout";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { JobProgressOverlay } from "@/components/JobProgressOverlay";
import { ACCENT, ACCENT_SECONDARY } from "@shared/const";

type MainTab = "tts" | "video" | "dubbing";
type SecondaryTab = "history" | "plan" | "guide" | "settings" | null;
type Lang = "mm" | "en";

// ─── Helper: Convert YouTube URL to embed URL ─────────────
function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;

  // Match various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=0&controls=1`;
    }
  }

  return null;
}

// ─── User-friendly error messages ─────────────
function friendlyError(raw: string): string {
  if (!raw) return "တစ်ခုခုမှားယွင်းနေပါသည်။ ထပ်ကြိုးစားပါ။";
  // Common backend errors → user-friendly Myanmar messages
  if (raw.includes("Insufficient credits"))
    return "Credit မလုံလောက်ပါ။ Plan ဝယ်ယူပါ။";
  if (raw.includes("Please login")) return "ကျေးဇူးပြု၍ Login ဝင်ပါ။";
  if (raw.includes("banned"))
    return "သင့် Account ကို ပိတ်ထားပါသည်။ Admin ကို ဆက်သွယ်ပါ။";
  if (raw.includes("File too large") || raw.includes("Max 25MB"))
    return "ဖိုင်အကြီးလွန်ပါသည်။ အများဆုံး 25MB အထိသာ တင်နိုင်ပါသည်။";
  if (raw.includes("Whisper could not detect"))
    return "ဗီဒီယိုတွင် စကားပြောသံ ရှာမတွေ့ပါ။ အသံပါသော ဗီဒီယိုကို ထပ်ကြိုးစားပါ။";
  if (raw.includes("MURF_API_KEY not configured"))
    return "Voice Change စနစ် ပြင်ဆင်ဆဲဖြစ်ပါသည်။ Standard Voice ကို သုံးပါ။";
  if (
    raw.includes("yt-dlp") ||
    raw.includes("download") ||
    raw.includes("ဒေါင်းလုတ်မရပါ")
  )
    return "ဗီဒီယို Link ကို ဒေါင်းလုတ်မရပါ။ Link ကို စစ်ပြီး ထပ်ကြိုးစားပါ။";
  if (
    raw.includes("Command failed") ||
    raw.includes("/tmp/") ||
    raw.includes("/root/")
  )
    return "လုပ်ဆောင်မှု မအောင်မြင်ပါ။ ခဏစောင့်ပြီး ထပ်ကြိုးစားပါ။";
  if (raw.includes("Too many login"))
    return "Login ကြိုးစားမှု များလွန်ပါသည်။ ၁ မိနစ်စောင့်ပြီး ထပ်ကြိုးစားပါ။";
  if (raw.includes("Invalid code"))
    return "Code မှားနေပါသည်။ Telegram Bot မှ Code အသစ်ယူပါ။";
  if (raw.includes("No active subscription"))
    return "Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။";
  if (raw.includes("Database") || raw.includes("DB"))
    return "စနစ် ယာယီ ချို့ယွင်းနေပါသည်။ ခဏစောင့်ပြီး ထပ်ကြိုးစားပါ။";
  if (raw.includes("Invalid text")) return "စာသား ထည့်ပါ။";
  if (raw.includes("Failed to generate audio"))
    return "အသံ ဖန်တီး၍ မရပါ။ ထပ်ကြိုးစားပါ။";
  // If it's already Myanmar text, return as is
  if (/[\u1000-\u109F]/.test(raw)) return raw;
  // Generic fallback
  return "တစ်ခုခု မှားယွင်းနေပါသည်။ ထပ်ကြိုးစားပါ။";
}

const T = {
  mm: {
    appName: "LUMIX",
    tabs: {
      tts: "စာမှအသံ",
      video: "ဗီဒီယိုဘာသာပြန်",
      dubbing: "Auto Creator",
      settings: "ဆက်တင်",
      history: "မှတ်တမ်း",
      plan: "Plan",
      guide: "လမ်းညွှန်",
    },
    inputText: "စာသားထည့်ပါ",
    inputPlaceholder: "စာသားရိုက်ထည့်ပါ...",
    voiceSelection: "အသံရွေးချယ်မှု",
    male: "ကျား",
    female: "မ",
    tone: "အသံနိမ့်မြင့်",
    speed: "အမြန်နှုန်း",
    aspectRatio: "SRT အချိုး",
    generate: "ဖန်တီးမည်",
    generating: "ဖန်တီးနေသည်...",
    download: "ဒေါင်းလုတ်",
    noSub: "Subscription မရှိပါ",
    noSubMsg: "TTS Generator သုံးဖို့ subscription လိုအပ်ပါတယ်",
    contact: "Admin ကိုဆက်သွယ်ပါ",
    logout: "ထွက်မည်",
    admin: "Admin",
    daysLeft: "ရက် ကျန်သည်",
    lower: "နိမ့်",
    higher: "မြင့်",
    slower: "နှေး",
    faster: "မြန်",
    preview: "နားဆင်မည်",
    videoTitle: "ဗီဒီယိုမှ မြန်မာဘာသာပြန်",
    videoDesc: "ဗီဒီယို (သို့) Link ထည့်ပြီး မြန်မာဘာသာပြန်ရယူပါ",
    videoLimit: "အများဆုံး ၂၅MB (သို့) ဗီဒီယိုအရှည်၂မိနစ်၃ဝစက္ကန့်",
    dropVideo: "ဗီဒီယိုဖိုင် ဤနေရာတွင်ချပါ သို့မဟုတ် နှိပ်ပါ",
    linkInputLabel: "VIDEO LINK ထည့်ရန်",
    linkPlaceholder: "https://youtube.com/...",
    orLine: "သို့မဟုတ်",
    translateBtn: "မြန်မာဘာသာပြန်မည်",
    translating: "ဘာသာပြန်နေသည်...",
    result: "ဘာသာပြန်ရလဒ်",
    translateAnother: "နောက်ထပ် ဗီဒီယိုဘာသာပြန်မည်",
    settingsTitle: "ဆက်တင်များ",
    geminiKey: "API Key",
    geminiKeyDesc: "သင်၏ API key ထည့်ပါ",
    geminiKeyPlaceholder: "API key...",
    saveKey: "သိမ်းမည်",
    removeKey: "ဖျက်မည်",
    keyActive: "API Key သုံးနေသည်",
    keyNone: "API Key မရှိ",
    copyText: "ကော်ပီကူးမည်",
    copied: "ကော်ပီကူးပြီး",
    downloadVideo: "ဗီဒီယိုဒေါင်းလုတ်",
  },
  en: {
    appName: "LUMIX",
    tabs: {
      tts: "TTS",
      video: "Translate",
      dubbing: "Auto Creator",
      settings: "Settings",
      history: "History",
      plan: "Plan",
      guide: "Guide",
    },
    inputText: "Input Text",
    inputPlaceholder: "Enter your text here...",
    voiceSelection: "Voice Selection",
    male: "Male",
    female: "Female",
    tone: "Tone / Pitch",
    speed: "Speed / Rate",
    aspectRatio: "SRT Aspect Ratio",
    generate: "Generate",
    generating: "Generating...",
    download: "Download",
    noSub: "No Subscription",
    noSubMsg: "You need a subscription to use TTS Generator",
    contact: "Contact Admin",
    logout: "Logout",
    admin: "Admin",
    daysLeft: "days left",
    lower: "Lower",
    higher: "Higher",
    slower: "Slower",
    faster: "Faster",
    preview: "Preview",
    videoTitle: "VIDEO TRANSLATION",
    videoDesc: "Upload video or paste link for Myanmar translation",
    videoLimit: "Max 25MB or video length 2 minutes 30 seconds",
    dropVideo: "Drop video here or click to upload",
    linkInputLabel: "VIDEO LINK",
    linkPlaceholder: "https://youtube.com/...",
    orLine: "OR",
    translateBtn: "Translate to Myanmar",
    translating: "Translating...",
    result: "Translation Result",
    translateAnother: "Translate Another Video",
    settingsTitle: "Settings",
    geminiKey: "API Key",
    geminiKeyDesc: "Add your own API key",
    geminiKeyPlaceholder: "API key...",
    saveKey: "Save",
    removeKey: "Remove",
    keyActive: "Using your API Key",
    keyNone: "No API Key",
    copyText: "Copy Text",
    copied: "Copied!",
    downloadVideo: "Download Video",
  },
};

// Helper: hex color + opacity → 8-digit hex
const withOpacity = (color: string, opacity: number) => {
  if (color.startsWith("#") && color.length === 7) {
    const hex = color.slice(1);
    const alpha = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${hex}${alpha}`;
  }
  return color;
};


// Premium UI Colors (Derived from shared constants)
const accent = ACCENT;
const accentSecondary = ACCENT_SECONDARY;
const deepRed = "#861C1C";
const peach = "#ECCEB6";
const cream = "#EBE6D8";
const darkBrown = "#2B1D1C";

// Premium color scheme for light mode — Warm Sand & Copper
const lightBg = "#FBF8F4";
const lightCardBg = "#FFFFFF";
const lightCardBorder = "rgba(192,111,48,0.12)";
const lightText = "#2B1D1C";
const lightSubtext = "#8B7355";

const accent15 = withOpacity(ACCENT, 0.15);
const accent30 = withOpacity(ACCENT, 0.3);
const accent40 = withOpacity(ACCENT, 0.4);
const accent80 = withOpacity(ACCENT, 0.8);

export default function TTSGenerator() {
  const [mainTab, setMainTab] = useState<MainTab>("tts");
  const [secondaryTab, setSecondaryTab] = useState<SecondaryTab>(null);
  const [menuOpen, setMenuOpen] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const [lang, setLang] = useState<Lang>("mm");
  const t = T[lang];

  // Error toast state
  const [errorToast, setErrorToast] = useState("");
  const showError = (msg: string) => {
    setErrorToast(friendlyError(msg));
    setTimeout(() => setErrorToast(""), 5000);
  };

  // Success toast state
  const [successToast, setSuccessToast] = useState("");
  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 3000);
  };

  const [text, setText] = useState("");
  const [voice, setVoice] = useState<"thiha" | "nilar">("thiha");
  const [character, setCharacter] = useState<string>("");
  const [voiceMode, setVoiceMode] = useState<"standard" | "character">(
    "standard"
  );
  const [tone, setTone] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("16:9");
  const [generatedFiles, setGeneratedFiles] = useState<{
    audioObjectUrl: string;
    srtContent: string;
    durationMs: number;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // === VIDEO TAB STATE ===
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [videoResult, setVideoResult] = useState<{
    myanmarText: string;
    srtContent?: string;
  } | null>(null);
  const [editedVideoText, setEditedVideoText] = useState("");
  const [videoCopied, setVideoCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Translation job polling state
  const [translateJobId, setTranslateJobId] = useState<string | null>(null);
  const [translateJobProgress, setTranslateJobProgress] = useState(0);
  const [translateJobMessage, setTranslateJobMessage] = useState("");
  const [translateJobType, setTranslateJobType] = useState<"file" | "link">("file");

  // tRPC polling queries for translation jobs
  const translateFileJobQuery = trpc.video.getTranslateJob.useQuery(
    { jobId: translateJobId ?? "" },
    {
      enabled: !!translateJobId && translateJobType === "file",
      refetchInterval: (data) => {
        // Stop polling once done
        if (data?.status === "completed" || data?.status === "failed") return false;
        return 3000;
      },
      retry: false,
      staleTime: 0,
    }
  );
  const translateLinkJobQuery = trpc.video.getTranslateLinkJob.useQuery(
    { jobId: translateJobId ?? "" },
    {
      enabled: !!translateJobId && translateJobType === "link",
      refetchInterval: (data) => {
        if (data?.status === "completed" || data?.status === "failed") return false;
        return 3000;
      },
      retry: false,
      staleTime: 0,
    }
  );

  // Video preview state for translate tab
  const [translatePreviewUrl, setTranslatePreviewUrl] = useState<string>("");
  const [translateVideoLoading, setTranslateVideoLoading] = useState(false);
  const [translateVideoError, setTranslateVideoError] = useState<string>("");

  // === DUBBING TAB STATE (fully independent) ===
  const [dubVideoFile, setDubVideoFile] = useState<File | null>(null);
  const [dubVideoUrl, setDubVideoUrl] = useState<string>("");
  const [dubDragOver, setDubDragOver] = useState(false);
  const [dubResult, setDubResult] = useState<{
    videoUrl?: string;
    videoBase64?: string;
    myanmarText: string;
    srtContent: string;
    durationMs: number;
  } | null>(null);

  const dubFileRef = useRef<HTMLInputElement>(null);
  const dubResultVideoRef = useRef<HTMLVideoElement>(null);

  // Dubbing wizard state
  const [dubPreviewUrl, setDubPreviewUrl] = useState<string>("");
  const dubPreviewRef = useRef<HTMLVideoElement>(null);
  const [dubDetectedRatio, setDubDetectedRatio] = useState<"9:16" | "16:9">(
    "16:9"
  );
  const [dubVideoWidth, setDubVideoWidth] = useState(1920);
  const [dubVideoHeight, setDubVideoHeight] = useState(1080);
  const [videoPreviewError, setVideoPreviewError] = useState<string>("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [dubVoice, setDubVoice] = useState<"thiha" | "nilar">("thiha");
  const [dubCharacter, setDubCharacter] = useState<string>("");
const [dubVoiceMode, setDubVoiceMode] = useState<"standard" | "character">(
      "standard"
    );

  // Dubbing SRT overlay settings
  const [srtEnabled, setSrtEnabled] = useState(true);
  const [srtFontSize, setSrtFontSize] = useState(24); // Better for Burmese text
  const [srtColor, setSrtColor] = useState("#ffffff");
  const [srtDropShadow, setSrtDropShadow] = useState(true);
  const [srtBlurBg, setSrtBlurBg] = useState(true);
  const [srtMarginV, setSrtMarginV] = useState(30);
  const [srtBlurOpacity, setSrtBlurOpacity] = useState(80);
  const [srtBlurColor, setSrtBlurColor] = useState<"black" | "white">("black");
  const [srtFullWidth, setSrtFullWidth] = useState(false);
  const [srtBorderRadius, setSrtBorderRadius] = useState<"rounded" | "square">(
    "rounded"
  );
  const [srtBoxPadding, setSrtBoxPadding] = useState(4); // Blur box height/padding in px

  const computeSrtPreviewStyle = useMemo(() => {
    const vw = dubVideoWidth;
    const vh = dubVideoHeight;
    const fontScaleFactor = vh / 490;
    const assFontSize = Math.round((srtFontSize ?? 24) * fontScaleFactor * 2.0);
    const containerWidth = dubDetectedRatio === "9:16" ? Math.min(240, window.innerWidth * 0.55) : window.innerWidth;
    const scale = containerWidth / vw;
    const scaledFontSize = assFontSize * scale;
    const assMarginV = Math.round((80 + (srtMarginV ?? 30) * 3) * (vh / 1080));
    const topPercent = ((vh - assMarginV) / vh) * 100;
    const bgAlpha = srtBlurOpacity / 100;
    const assOutline = Math.max(4, (srtBoxPadding ?? 4) * 3);
    const scaledPadding = assOutline * scale;
    const shadowSize = 2 * scale;

    return {
      wrapperTop: `${Math.max(2, Math.round(topPercent))}%`,
      fontSize: `${Math.max(6, Math.round(scaledFontSize))}px`,
      padding: srtFullWidth
        ? `${scaledPadding}px 0`
        : `${scaledPadding}px ${scaledPadding + 10 * scale}px`,
      background: srtBlurBg
        ? srtBlurColor === "black"
          ? `rgba(0,0,0,${bgAlpha.toFixed(2)})`
          : `rgba(255,255,255,${bgAlpha.toFixed(2)})`
        : "transparent",
      textShadow: srtDropShadow
        ? `${shadowSize}px ${shadowSize}px ${4 * scale}px rgba(0,0,0,0.8)`
        : "none",
    };
  }, [dubVideoWidth, dubVideoHeight, dubDetectedRatio, srtFontSize, srtMarginV, srtBlurOpacity, srtBlurColor, srtBlurBg, srtBoxPadding, srtFullWidth, srtDropShadow]);

  // Accordion state for mobile-friendly collapsible sections
  const [voiceAccordionOpen, setVoiceAccordionOpen] = useState(true);
  const [speedAccordionOpen, setSpeedAccordionOpen] = useState(false);
  const [srtAccordionOpen, setSrtAccordionOpen] = useState(true);

  const [geminiKey, setGeminiKey] = useState("");
  const [savedKey, setSavedKey] = useState(
    () => localStorage.getItem("gemini_key") || ""
  );

  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: unifiedHistory, isLoading: historyLoading } =
    trpc.history.getUnifiedHistory.useQuery({ limit: 100 });
  const { data: me } = trpc.auth.me.useQuery();
  const { data: subStatus, isLoading: subLoading } =
    trpc.subscription.myStatus.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/login";
    },
  });
  const generateMutation = trpc.tts.generateAudio.useMutation();
  const translateMutation = trpc.video.translate.useMutation();
  const translateLinkMutation = trpc.video.translateLink.useMutation();
  // Separate mutations for dubbing tab
  const dubFileMutation = trpc.video.dubFile.useMutation();
  const dubLinkMutation = trpc.video.dubLink.useMutation();

  // Job-based mutations
  const startDubMutation = trpc.jobs.startDub.useMutation();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobStatusQuery = trpc.jobs.getStatus.useQuery(
    { jobId: activeJobId ?? "" },
    {
      enabled: !!activeJobId,
      refetchInterval: (data) => {
        if (data?.status === "completed" || data?.status === "failed") return false;
        return 3000;
      },
      retry: false,
      staleTime: 0,
    }
  );

  const isAdmin = me?.role === "admin";
  const hasActiveSub = isAdmin || subStatus?.active;
  const hasPlan = isAdmin || !!subStatus?.plan; // user has trial or subscription
  const planLimits = subStatus?.limits;
  const planUsage = subStatus?.usage;
  const currentPlan = subStatus?.plan;

  // Compute character limit for current voice mode based on plan
  const getCharLimit = () => {
    if (isAdmin) return 99999;
    if (!currentPlan) return 0; // No plan yet
    if (currentPlan === "trial") {
      // Trial: Thiha/Nilar 5000, others 1600
      return voiceMode === "character" ? 1600 : 5000;
    }
    // Regular: Thiha/Nilar 30000, others 2000
    return voiceMode === "character" ? 2000 : 30000;
  };
  const currentCharLimit = getCharLimit();

  const daysLeft = subStatus?.expiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subStatus.expiresAt).getTime() - Date.now()) / 86400000
        )
      )
    : null;

  const isDark = theme === "dark";
  const subColor = accent;

  // ─── Premium theme-aware derived values ───
  const bgColor = isDark ? "#0f0f0f" : lightBg;
  const textColor = isDark ? cream : lightText;
  const subtextColor = isDark ? peach : lightSubtext;
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : lightCardBg;
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : lightCardBorder;
  const boxShadow = isDark
    ? "0 4px 24px rgba(0,0,0,0.3)"
    : "0 8px 32px rgba(192,111,48,0.06), 0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.9)";
  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "#F8F4EE";
  const inputBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(192,111,48,0.15)";

  // 3D Panel styles (for subtitle settings)
  const panelStyle = isDark
    ? { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }
    : { background: "linear-gradient(160deg, #FFFFFF 0%, #FFF9F2 100%)", border: "1px solid rgba(192,111,48,0.15)", boxShadow: "0 16px 48px rgba(192,111,48,0.08), 0 4px 16px rgba(0,0,0,0.04), inset 0 2px 0 rgba(255,255,255,0.95)" };

  // Auto-preview video for translate tab when URL changes
  useEffect(() => {
    if (videoUrl.trim() && !videoFile) {
      setTranslateVideoLoading(true);
      setTranslateVideoError("");
      // Simulate loading delay
      const timer = setTimeout(() => {
        setTranslatePreviewUrl(videoUrl.trim());
        setTranslateVideoLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!videoUrl && !videoFile) {
      setTranslatePreviewUrl("");
      setTranslateVideoError("");
      setTranslateVideoLoading(false);
    }
  }, [videoUrl, videoFile]);

  // Auto-preview video for dubbing tab when URL changes
  const dubPreviewMutation = trpc.video.previewLink.useMutation();
  const dubPreviewUrlRef = useRef<string>("");

  useEffect(() => {
    if (!dubVideoUrl && !dubVideoFile) {
      setDubPreviewUrl("");
      setVideoPreviewError("");
      setVideoLoading(false);
      dubPreviewUrlRef.current = "";
      return;
    }
    if (!dubVideoUrl.trim() || dubVideoFile) return;
    const timer = setTimeout(() => {
      const url = dubVideoUrl.trim();
      if (!url || dubPreviewUrlRef.current === url) return;
      dubPreviewUrlRef.current = url;
      setVideoPreviewError("");
      setDubPreviewUrl(url);
      setVideoLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [dubVideoUrl, dubVideoFile]);

  // Set audio source when generatedFiles.audioObjectUrl changes
  useEffect(() => {
    if (generatedFiles?.audioObjectUrl && audioRef.current) {
      audioRef.current.src = generatedFiles.audioObjectUrl;
      audioRef.current.load();
    }
  }, [generatedFiles?.audioObjectUrl]);

  // Light theme: Premium Warm Gradient, Dark: Keep Deep Dark
  const bgGradient = isDark
    ? "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0f0f0f 100%)"
    : "linear-gradient(180deg, #FBF8F4 0%, #F8F4EE 50%, #F5F0EA 100%)";

  // (cardBg, cardBorder, textColor, subtextColor, inputBg, inputBorder, boxShadow 
  //  are defined in the premium theme block above — do not redeclare here)
  const labelBg = isDark ? "rgba(192,111,48,0.15)" : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(251,248,244,0.98))";

  const box =
    "relative border p-4 md:p-5 pt-8 backdrop-blur-xl transition-all duration-300 rounded-2xl mt-6";
  const labelStyle =
    "absolute -top-3.5 left-4 px-3 py-1 text-xs uppercase tracking-widest font-black rounded-lg z-10 border";

  const handleGenerate = async () => {
    if (!text.trim()) return;
    try {
      const result = await generateMutation.mutateAsync({
        text,
        voice,
        tone,
        speed,
        aspectRatio,
        character: voiceMode === "character" ? character : undefined,
      });
      if (result.success && result.audioBase64) {
        try {
          const binary = atob(result.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
          if (bytes.length === 0) {
            showError(
              lang === "mm"
                ? "အသံ ဖန်တီး၍ မရပါ။ ထပ်ကြိုးစားပါ။"
                : "Generated audio is empty. Please try again."
            );
            return;
          }
          const blob = new Blob([bytes], {
            type: result.mimeType || "audio/mpeg",
          });
          const audioObjectUrl = URL.createObjectURL(blob);
          setGeneratedFiles({
            audioObjectUrl,
            srtContent: result.srtContent || "",
            durationMs: result.durationMs || 0,
          });
          utils.subscription.myStatus.invalidate();
        } catch (decodeErr: any) {
          console.error("[TTS Decode Error]", decodeErr);
          showError(
            lang === "mm"
              ? "အသံ ဖိုင် ပြင်ဆင်၍ မရပါ။"
              : "Failed to process audio file."
          );
        }
      } else {
        showError(
          lang === "mm"
            ? "အသံ ဖန်တီး၍ မရပါ။ ထပ်ကြိုးစားပါ。"
            : "No audio was generated. Please try again."
        );
      }
    } catch (e: any) {
      console.error("[TTS Generate Error]", e);
      showError(e?.message || "Failed");
    }
  };

  const handleVideoFile = (f: File) => {
    if (f.size > 25 * 1024 * 1024) {
      showError("File too large. Max 25MB.");
      return;
    }
    setVideoFile(f);
    setVideoUrl("");
    setVideoResult(null);
  };

  // React to translation job query data — handles ALL states and errors
  const activeTranslateJobQuery = translateJobType === "file" ? translateFileJobQuery : translateLinkJobQuery;
  const activeTranslateJobData = activeTranslateJobQuery.data;
  const activeTranslateJobError = activeTranslateJobQuery.error;

  useEffect(() => {
    if (!translateJobId) return;

    // Handle network/server error from the polling request itself
    if (activeTranslateJobError) {
      const errMsg = (activeTranslateJobError as any)?.message || "Translation polling failed. Please try again.";
      showError(errMsg);
      setTranslateJobId(null);
      setTranslateJobProgress(0);
      setTranslateJobMessage("");
      return;
    }

    if (!activeTranslateJobData) return;

    if (activeTranslateJobData.status === "completed" && activeTranslateJobData.result) {
      setVideoResult({
        myanmarText: activeTranslateJobData.result.myanmarText,
        srtContent: activeTranslateJobData.result.srtContent,
      });
      setEditedVideoText(activeTranslateJobData.result.myanmarText);
      setTranslateJobId(null);
      setTranslateJobProgress(100);
      setTranslateJobMessage("");
      utils.subscription.myStatus.invalidate();
    } else if (activeTranslateJobData.status === "failed") {
      showError(activeTranslateJobData.error || "Translation failed. Please try again.");
      setTranslateJobId(null);
      setTranslateJobProgress(0);
      setTranslateJobMessage("");
    } else {
      // Still processing: update progress + message
      const pct = activeTranslateJobData.progress ?? 0;
      setTranslateJobProgress(pct > 0 ? pct : 10);
      setTranslateJobMessage((activeTranslateJobData as any).message || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translateJobId, activeTranslateJobData, activeTranslateJobError]);

  // Timeout guard: if translation takes > 10 minutes, surface an error
  useEffect(() => {
    if (!translateJobId) return;
    const timeout = setTimeout(() => {
      if (translateJobId) {
        showError("Translation timed out after 10 minutes. Please try a shorter video.");
        setTranslateJobId(null);
        setTranslateJobProgress(0);
      }
    }, 10 * 60 * 1000);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translateJobId]);

  // Poll translation job status — just set the jobId and let tRPC queries do the work
  const pollTranslateJob = (jobId: string, jobType: "file" | "link") => {
    setTranslateJobType(jobType);
    setTranslateJobId(jobId);
    setTranslateJobProgress(10);
  };

  const handleTranslate = async () => {
    if (videoUrl.trim()) {
      try {
        const res = await translateLinkMutation.mutateAsync({
          url: videoUrl.trim(),
        });
        if (res.jobId) {
          pollTranslateJob(res.jobId, "link");
        }
      } catch (e: any) {
        showError(e?.message || "Link Translation failed");
      }
      return;
    }

    if (!videoFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await translateMutation.mutateAsync({
          videoBase64: base64,
          filename: videoFile.name,
        });
        if (res.jobId) {
          pollTranslateJob(res.jobId, "file");
        }
      } catch (e: any) {
        showError(e?.message || "Translation failed");
      }
    };
    reader.readAsDataURL(videoFile);
  };

  const handleVideoCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedVideoText);
      setVideoCopied(true);
      setTimeout(() => setVideoCopied(false), 2000);
    } catch {
      /* fallback */
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const withCRLF = normalized.replace(/\n/g, "\r\n");
    const blob = new Blob(["\uFEFF" + withCRLF], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVideoReset = () => {
    setVideoFile(null);
    setVideoUrl("");
    setVideoResult(null);
    setEditedVideoText("");
    setTranslateJobId(null);
    setTranslateJobProgress(0);
  };

  // Video download from URL (for video tab)
  const handleVideoDownloadFromUrl = async () => {
    if (!videoUrl.trim()) return;
    // Open in new tab to let browser handle download
    window.open(videoUrl.trim(), "_blank");
  };

  // === DUBBING TAB HANDLERS (fully independent) ===
  const handleDubVideoFile = (f: File) => {
    if (f.size > 25 * 1024 * 1024) {
      showError("File too large. Max 25MB.");
      return;
    }
    setDubVideoFile(f);
    setDubVideoUrl("");
    setDubResult(null);
    // Create preview URL from uploaded file
    const url = URL.createObjectURL(f);
    setDubPreviewUrl(url);
  };

  // Character voice base mapping (for sending correct base voice)
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
    const dubVoiceToUse =
      dubVoiceMode === "standard" ? dubVoice : dubCharacter;

    // Use job-based API for dubbing (handles long processing time)
    if (dubVideoUrl.trim()) {
      try {
const res = await startDubMutation.mutateAsync({
           url: dubVideoUrl.trim(),
           voice: dubVoiceToUse,
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
        setActiveJobId(res.jobId);
        // Poll for job status
        pollJobStatus(res.jobId);
      } catch (e: any) {
        console.error("[DUB LINK ERROR]", e);
        showError(e?.message || "Dubbing failed");
      }
      return;
    }

    if (!dubVideoFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
         const res = await dubFileMutation.mutateAsync({
          videoBase64: base64,
          filename: dubVideoFile.name,
          voice: dubVoiceToUse,
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
        setActiveJobId(res.jobId);
        utils.subscription.myStatus.invalidate();
      } catch (e: any) {
        console.error("[DUB FILE ERROR]", e);
        showError(e?.message || "Dubbing failed");
      }
    };
    reader.readAsDataURL(dubVideoFile);
  };

  // React to dub job status changes — handles ALL states and errors
  useEffect(() => {
    if (!activeJobId) return;
    if (jobStatusQuery.error) {
      const errMsg = (jobStatusQuery.error as any)?.message || "Dubbing status check failed. Please try again.";
      showError(errMsg);
      setActiveJobId(null);
      return;
    }
    if (!jobStatusQuery.data) return;
    const status = jobStatusQuery.data;
    if (status.status === "completed" && status.result) {
      setDubResult(status.result as any);
      setActiveJobId(null);
      utils.subscription.myStatus.invalidate();
    } else if (status.status === "failed") {
      showError(status.error || "Dubbing failed. Please try again.");
      setActiveJobId(null);
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

  // Poll job status — just set activeJobId and let tRPC query handle polling
  const pollJobStatus = (jobId: string) => {
    setActiveJobId(jobId);
  };

  const handleDubDownload = () => {
    if (dubResult?.videoUrl) {
      // Direct download from URL
      const a = document.createElement("a");
      a.href = dubResult.videoUrl;
      a.download = `Dubbed_Myanmar_${Date.now()}.mp4`;
      a.click();
    } else if (dubResult?.videoBase64) {
      // Fallback to base64
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

  // Detect if a URL is an external platform link (YouTube, TikTok, Facebook)
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

  // Extract YouTube video ID from various URL formats
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    // youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    // youtube.com/shorts/VIDEO_ID
    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
    // youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    // youtube.com/embed/VIDEO_ID
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
      } else if (dubVideoUrl.trim()) {
        // For external URLs (YouTube/TikTok/FB), we can't preview directly
        // but we set the URL to show the external link card
        setDubPreviewUrl(dubVideoUrl.trim());
        if (isExternalVideoUrl(dubVideoUrl.trim())) {
          setVideoLoading(false); // No loading for external URLs
        }
      }
    } catch (error) {
      setVideoPreviewError("Failed to load video. Please try again.");
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
  };

  const { fmtTime } = useSystemTime();

  // Header is now in layout, always sticky

  const headerBar = (
    <div
      className="flex flex-nowrap items-center justify-between py-1 px-2 sm:px-4 w-full h-full gap-1 sm:gap-2 overflow-hidden"
    >
      
      <div className="flex items-center gap-1 sm:gap-2 sm:ml-auto">
        {subLoading ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl">
            <div className="w-10 h-3 rounded animate-pulse" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
            <div className="w-5 h-3 rounded animate-pulse" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
          </div>
        ) : (
        <div
          className="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-semibold relative overflow-hidden"
          style={{
            background: hasActiveSub 
              ? "linear-gradient(135deg, rgba(192,111,48,0.25) 0%, rgba(244,179,79,0.15) 50%, rgba(192,111,48,0.25) 100%)"
              : isDark 
                ? "rgba(75,85,99,0.3)" 
                : "rgba(229,231,235,0.5)",
            border: `1px solid ${hasActiveSub ? "rgba(244,179,79,0.5)" : "rgba(156,163,175,0.3)"}`,
          }}
        >
          {hasActiveSub && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ animationDuration: "2s" }} />
          )}
          {hasActiveSub ? (
            <>
              <div className="relative z-10 flex items-center gap-1 sm:gap-2">
                <span 
                  className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-xs font-bold uppercase tracking-wider"
                  style={{
                    background: "linear-gradient(135deg, #C06F30 0%, #F4B34F 100%)",
                    color: "#fff",
                    boxShadow: "0 2px 8px rgba(192,111,48,0.4)",
                  }}
                >
                  {isAdmin ? "Admin" : (subStatus?.plan === "trial" ? (lang === "mm" ? "အစမ်း" : "Trial") : subStatus?.plan)}
                </span>
              </div>
              <div className="relative z-10 hidden sm:block flex-1 h-2 max-w-[100px] rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }}>
                <motion.div 
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: isAdmin ? "100%" : `${Math.min(100, ((subStatus?.credits ?? 0) / (planLimits?.maxCredits ?? 800)) * 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    background: "linear-gradient(90deg, #C06F30, #F4B34F, #FCD34D)",
                    boxShadow: "0 0 10px rgba(244,179,79,0.5)",
                  }}
                />
              </div>
              <div className="relative z-10 flex items-center gap-1 sm:gap-2 font-bold" style={{ color: isDark ? "#F4B34F" : "#B45309" }}>
                <span className="text-[11px] sm:text-sm">{isAdmin ? "Admin" : subStatus?.credits}</span>
                {!isAdmin && <span className="hidden sm:inline text-xs opacity-70 uppercase">credits</span>}
              </div>
            </>
          ) : (
            <>
              <span className="relative z-10 text-[10px] sm:text-sm font-medium" style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
                {me ? (lang === "mm" ? "အခမဲ့" : "Free") : ""}
              </span>
              <div className="relative z-10 hidden sm:block flex-1 h-2 max-w-[100px] rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                <div 
                  className="h-full rounded-full"
                  style={{
                    width: "0%",
                    background: isDark ? "#4B5563" : "#9CA3AF",
                  }}
                />
              </div>
              <span className="relative z-10 text-[11px] sm:text-sm" style={{ color: isDark ? "#6B7280" : "#9CA3AF" }}>
                {subStatus?.credits ?? 0}
              </span>
            </>
          )}
        </div>
        )}
        <span
          className="hidden sm:inline text-xs font-bold px-1.5 sm:px-2.5 py-1 rounded-full"
          style={{
            background: isDark
              ? "rgba(192,111,48,0.1)"
              : "rgba(244,179,79,0.06)",
            color: accent,
          }}
        >
          @{(me as any)?.username || me?.name}
        </span>
        <div
          className="w-px h-5 mx-0.5"
          style={{
            background: isDark
              ? "rgba(192,111,48,0.3)"
              : "rgba(192,111,48,0.12)",
          }}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setLang(lang === "mm" ? "en" : "mm")}
          className="px-2.5 py-1 text-xs font-black rounded-lg uppercase tracking-widest transition-all"
          style={{
            border: `1px solid ${isDark ? "rgba(192,111,48,0.35)" : "rgba(192,111,48,0.15)"}`,
            background: isDark
              ? "rgba(192,111,48,0.1)"
              : "rgba(255,255,255,0.7)",
            color: textColor,
          }}
        >
          {lang === "mm" ? "EN" : "MM"}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="p-1.5 rounded-lg transition-all flex items-center justify-center"
          style={{
            border: `1px solid ${isDark ? "rgba(192,111,48,0.35)" : "rgba(192,111,48,0.15)"}`,
            background: isDark
              ? "rgba(192,111,48,0.1)"
              : "rgba(255,255,255,0.7)",
            color: textColor,
          }}
        >
          {isDark ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => logoutMutation.mutate()}
          className="flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all"
          style={{
            border: "1px solid rgba(239,68,68,0.3)",
            background: isDark
              ? "rgba(239,68,68,0.08)"
              : "rgba(239,68,68,0.05)",
            color: "#ef4444",
          }}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.logout}</span>
        </motion.button>
      </div>
    </div>
  );

  return (
    <TTSGeneratorLayout
      currentSecondaryTab={secondaryTab}
      onTabChange={setSecondaryTab}
      backgroundStyle={{ background: bgGradient }}
      mainTab={mainTab}
      setMainTab={setMainTab}
      isDark={isDark}
      lang={lang}
      setLang={setLang}
      headerBar={headerBar}
      showLogo={true}
    >
      <div
          className="h-full relative transition-colors duration-500 font-sans"
          style={{ color: textColor }}
        >
        <JobProgressOverlay 
          isVisible={Boolean(translateJobId) || Boolean(activeJobId) || generateMutation.isPending}
          progress={translateJobId ? translateJobProgress : activeJobId ? ((jobStatusQuery.data as any)?.progress ?? 0) : generateMutation.isPending ? 85 : 0}
          message={translateJobId ? translateJobMessage : activeJobId ? ((jobStatusQuery.data as any)?.message ?? "") : generateMutation.isPending ? (lang === "mm" ? "အသံ ဖန်တီးနေသည်..." : "Generating audio...") : ""}
          title={translateJobId ? (lang === "mm" ? "ဗီဒီယို ဘာသာပြန်" : "Video Translation") : activeJobId ? "Auto Creator" : "Text to Speech"}
          isDark={isDark}
          accent={accent}
          lang={lang}
        />

        {/* Error Toast */}
        {errorToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 max-w-[90vw]">
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border"
              style={{
                background: isDark ? "rgba(220,38,38,0.9)" : "#fef2f2",
                borderColor: isDark ? "rgba(248,113,113,0.5)" : "#fecaca",
                color: isDark ? "#fff" : "#991b1b",
                backdropFilter: "blur(12px)",
              }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-bold">{errorToast}</span>
              <button
                onClick={() => setErrorToast("")}
                className="ml-2 opacity-60 hover:opacity-100 text-lg"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Success Toast */}
        {successToast && (
          <div className="fixed top-4 right-4 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 max-w-[90vw]">
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border"
              style={{
                background: "rgba(34, 197, 94, 0.95)",
                borderColor: "rgba(34, 197, 94, 0.5)",
                color: "#fff",
                backdropFilter: "blur(12px)",
              }}
            >
              <Check className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-bold">{successToast}</span>
              <button
                onClick={() => setSuccessToast("")}
                className="ml-2 opacity-60 hover:opacity-100 text-lg"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Subtle Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: isDark ? 0.05 : 0.04 }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(0deg, transparent 24%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 25%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 26%, transparent 27%, transparent 74%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 75%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 25%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 26%, transparent 27%, transparent 74%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 75%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 76%, transparent 77%, transparent)`,
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        <div className="relative z-10 py-3 sm:py-4 md:py-5 pt-4 sm:pt-5">
          {/* Main Tab Content - Only show when no secondary tab is active */}
          {!secondaryTab && (
            <>
              {/* === TTS TAB === */}
              {mainTab === "tts" && (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                  <div className="mb-2 sm:mb-4 relative text-center py-1">
                    <h1
                      className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-wider sm:tracking-widest mb-2"
                      style={{ textShadow: "none", color: accent }}
                    >
                      TTS Generator
                    </h1>
                    <p
                      className="text-xs sm:text-sm font-bold uppercase tracking-wider opacity-80 mt-1"
                      style={{ color: subtextColor }}
                    >
                      Convert Text to Speech
                    </p>
                    {/* No Plan Banner */}
                    {!isAdmin && !hasPlan && me && !subLoading && (
                      <div
                        className="mt-3 mx-auto max-w-lg flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
                        style={{
                          background: isDark
                            ? "rgba(220,38,38,0.15)"
                            : "#fef2f2",
                          border: "1px solid rgba(220,38,38,0.3)",
                          color: "#dc2626",
                        }}
                      >
                        <AlertCircle className="w-4 h-4" />
                        {lang === "mm"
                          ? "Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။"
                          : "No active subscription. Contact Admin."}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 max-w-6xl mx-auto">
                    <div className="lg:col-span-2 space-y-2">
                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                          position: text.trim() ? "sticky" : "relative",
                          top: text.trim() ? "20px" : "auto",
                          zIndex: text.trim() ? 10 : "auto",
                        }}
                      >
                        <div
                          className={labelStyle}
                          style={{
                            background: labelBg,
                            color: accent,
                            borderColor: cardBorder,
                          }}
                        >
                          {t.inputText}
                        </div>
                        <div className="relative">
                          <textarea
                            value={text}
                            onChange={e => {
                              if (
                                !isAdmin &&
                                e.target.value.length > currentCharLimit
                              )
                                return;
                              setText(e.target.value);
                            }}
                            placeholder={t.inputPlaceholder}
                            disabled={!hasPlan}
                            className="w-full h-28 sm:h-32 md:h-40 p-3 sm:p-4 pr-24 border rounded-xl focus:outline-none focus:ring-2 resize-none disabled:opacity-50 transition-colors text-sm leading-relaxed"
                            style={{
                              background: inputBg,
                              borderColor:
                                !isAdmin && text.length > currentCharLimit * 0.9
                                  ? text.length >= currentCharLimit
                                    ? "#dc2626"
                                    : "#f59e0b"
                                  : inputBorder,
                              color: textColor,
                              fontFamily:
                                lang === "mm"
                                  ? "'Pyidaungsu', sans-serif"
                                  : "inherit",
                            }}
                          />
                          {/* Real-time character count - always visible */}
                          <div
                            className="absolute bottom-3 right-3 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                            style={{
                              background:
                                !isAdmin && text.length > currentCharLimit * 0.9
                                  ? text.length >= currentCharLimit
                                    ? "rgba(220, 38, 38, 0.2)"
                                    : "rgba(245, 158, 11, 0.2)"
                                  : inputBg,
                              color:
                                !isAdmin && text.length > currentCharLimit * 0.9
                                  ? text.length >= currentCharLimit
                                    ? "#dc2626"
                                    : "#f59e0b"
                                  : accent,
                              border: `1px solid ${!isAdmin && text.length > currentCharLimit * 0.9 ? (text.length >= currentCharLimit ? "#dc2626" : "#f59e0b") : accent}`,
                            }}
                          >
                            {text.length.toLocaleString()} /{" "}
                            {!isAdmin && hasPlan
                              ? currentCharLimit.toLocaleString()
                              : "∞"}
                          </div>
                        </div>
                        <div
                          className="mt-2 flex items-center justify-between text-xs font-semibold"
                          style={{ color: subtextColor }}
                        >
                          <span>
                            {!isAdmin &&
                              hasPlan &&
                              currentPlan !== "trial" &&
                              planUsage &&
                              planLimits && (
                                <span
                                  style={{
                                    color:
                                      voiceMode === "character"
                                        ? planUsage.characterUse >=
                                          planLimits.dailyCharacterUse
                                          ? "#dc2626"
                                          : subtextColor
                                        : planUsage.tts >=
                                            planLimits.dailyTtsSrt
                                          ? "#dc2626"
                                          : subtextColor,
                                  }}
                                >
                                  {lang === "mm" ? "ယနေ့" : "Today"}:{" "}
                                  {voiceMode === "character"
                                    ? `${planUsage.characterUse}/${planLimits.dailyCharacterUse}`
                                    : `${planUsage.tts}/${planLimits.dailyTtsSrt}`}{" "}
                                  {lang === "mm" ? "ကြိမ်" : "uses"}
                                </span>
                              )}
                          </span>
                          <span className="text-[10px] opacity-70">
                            {lang === "mm" ? "စာလုံး" : "characters"}
                          </span>
                        </div>
                      </div>

                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                        }}
                      >
                        <div
                          className={labelStyle}
                          style={{
                            background: labelBg,
                            color: accent,
                            borderColor: cardBorder,
                          }}
                        >
                          {t.voiceSelection}
                        </div>
                        <div className="space-y-4 sm:space-y-5">
                          {[
                            {
                              label: t.male,
                              voices: [
                                { id: "thiha", name: "သီဟ", isStd: true },
                                { id: "ryan", name: "ရဲရင့်", isStd: false },
                                { id: "ronnie", name: "ရောင်နီ", isStd: false },
                                { id: "lucas", name: "လင်းခန့်", isStd: false },
                                { id: "daniel", name: "ဒေဝ", isStd: false },
                                { id: "evander", name: "အဂ္ဂ", isStd: false },
                              ],
                            },
                            {
                              label: t.female,
                              voices: [
                                { id: "nilar", name: "နီလာ", isStd: true },
                                {
                                  id: "michelle",
                                  name: "မေချို",
                                  isStd: false,
                                },
                                { id: "iris", name: "အိန္ဒြာ", isStd: false },
                                { id: "charlotte", name: "သီရိ", isStd: false },
                                { id: "amara", name: "အမရာ", isStd: false },
                              ],
                            },
                          ].map(({ label: grpLabel, voices }) => {
                            const limitText =
                              voiceMode === "character"
                                ? "0/2000"
                                : grpLabel === t.male
                                  ? "0/30000"
                                  : "0/30000";
                            const voiceName =
                              grpLabel === t.male ? "Thiha" : "Nilar";
                            return (
                              <div key={grpLabel}>
                                <div className="flex items-center justify-between mb-2 sm:mb-3">
                                  <p
                                    className="text-xs font-bold uppercase tracking-wider"
                                    style={{ color: subtextColor }}
                                  >
                                    {grpLabel}
                                  </p>
                                  <span
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    style={{
                                      background: isDark
                                        ? "rgba(192,111,48,0.1)"
                                        : "rgba(192,111,48,0.08)",
                                      color: accent,
                                    }}
                                  >
                                    {voiceMode === "character"
                                      ? `Character: ${limitText}`
                                      : `${voiceName}: ${limitText}`}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                                  {voices.map(v => {
                                    const isSelected = v.isStd
                                      ? voiceMode === "standard" &&
                                        voice ===
                                          (v.id === "thiha" ? "thiha" : "nilar")
                                      : voiceMode === "character" &&
                                        character === v.id;
                                    return (
                                      <button
                                        key={v.id}
                                        disabled={!hasPlan}
                                        onClick={() => {
                                          if (v.isStd) {
                                            setVoiceMode("standard");
                                            setVoice(v.id as any);
                                            setCharacter("");
                                          } else {
                                            setVoiceMode("character");
                                            setCharacter(v.id);
                                          }
                                        }}
                                        className="py-2 sm:py-2.5 px-2 sm:px-3 border rounded-xl text-xs sm:text-sm font-bold transition-all disabled:opacity-40"
                                        style={{
                                          borderColor: isSelected
                                            ? accent
                                            : cardBorder,
                                          background: isSelected
                                            ? isDark
                                              ? "rgba(192,111,48,0.2)"
                                              : "rgba(244,179,79,0.08)"
                                            : "transparent",
                                          color: isSelected
                                            ? accent
                                            : textColor,
                                          boxShadow: "none",
                                        }}
                                      >
                                        {v.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {[
                          {
                            label: t.tone,
                            value: tone,
                            setValue: setTone,
                            min: -20,
                            max: 20,
                            step: 1,
                            display: `${tone > 0 ? "+" : ""}${tone} Hz`,
                            leftLabel: t.lower,
                            rightLabel: t.higher,
                          },
                          {
                            label: t.speed,
                            value: speed,
                            setValue: setSpeed,
                            min: 0.5,
                            max: 2.0,
                            step: 0.1,
                            display: `${speed.toFixed(1)}x`,
                            leftLabel: t.slower,
                            rightLabel: t.faster,
                          },
                        ].map(
                          ({
                            label: lbl,
                            value,
                            setValue,
                            min,
                            max,
                            step,
                            display,
                            leftLabel,
                            rightLabel,
                          }) => (
                            <div
                              key={lbl}
                              className={box}
                              style={{
                                background: cardBg,
                                borderColor: cardBorder,
                                boxShadow,
                              }}
                            >
                              <div
                                className={labelStyle}
                                style={{
                                  background: labelBg,
                                  color: accent,
                                  borderColor: cardBorder,
                                }}
                              >
                                {lbl}
                              </div>
                              <div className="mt-2">
                                <Slider
                                  value={[value]}
                                  onValueChange={v => setValue(v[0])}
                                  min={min}
                                  max={max}
                                  step={step}
                                  disabled={!hasPlan}
                                  className="w-full"
                                />
                                <div className="flex justify-between items-center text-xs font-bold mt-3 sm:mt-4">
                                  <span style={{ color: subtextColor }}>
                                    {leftLabel}
                                  </span>
                                  <span style={{ color: accent }}>
                                    {display}
                                  </span>
                                  <span style={{ color: subtextColor }}>
                                    {rightLabel}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 sm:space-y-6">
                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                          position: "sticky",
                          top: "20px",
                        }}
                      >
                        <div
                          className={labelStyle}
                          style={{
                            background: labelBg,
                            color: accent,
                            borderColor: cardBorder,
                          }}
                        >
                          {t.aspectRatio}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6 mt-1">
                          {(["9:16", "16:9"] as const).map(ratio => (
                            <button
                              key={ratio}
                              onClick={() => setAspectRatio(ratio)}
                              disabled={!hasPlan}
                              className="py-2.5 sm:py-3 border rounded-xl font-black uppercase transition-all disabled:opacity-40"
                              style={{
                                borderColor:
                                  aspectRatio === ratio ? accent : cardBorder,
                                background:
                                  aspectRatio === ratio
                                    ? isDark
                                      ? "rgba(192,111,48,0.15)"
                                      : "rgba(244,179,79,0.06)"
                                    : "transparent",
                                color:
                                  aspectRatio === ratio ? accent : textColor,
                                boxShadow:
                                  aspectRatio === ratio && !isDark
                                    ? "0 4px 12px rgba(192,111,48,0.15)"
                                    : "none",
                              }}
                            >
                              {ratio}
                            </button>
                          ))}
                        </div>

                        <motion.button
                          onClick={handleGenerate}
                          disabled={
                            generateMutation.isPending ||
                            !text.trim() ||
                            !hasPlan ||
                            (!isAdmin && text.length > currentCharLimit)
                          }
                          whileHover={{ scale: generateMutation.isPending ? 1 : 1.02 }}
                          whileTap={{ scale: generateMutation.isPending ? 1 : 0.98 }}
                          className="w-full relative overflow-hidden group flex items-center justify-center gap-3 py-4 sm:py-5 rounded-2xl text-white font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                          style={{
                            background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                          {generateMutation.isPending ? (
                            <>
                              <div className="relative flex items-center gap-3">
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                  className="relative"
                                >
                                  <Loader2 className="w-6 h-6" />
                                </motion.div>
                                <motion.div
                                  animate={{ scale: [0.8, 1.2, 0.8] }}
                                  transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                                  className="w-3 h-3 rounded-full bg-white"
                                />
                                <motion.div
                                  animate={{ scale: [0.8, 1.2, 0.8] }}
                                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                  className="w-3 h-3 rounded-full bg-white"
                                />
                                <motion.div
                                  animate={{ scale: [0.8, 1.2, 0.8] }}
                                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                                  className="w-3 h-3 rounded-full bg-white"
                                />
                              </div>
                              <span className="relative z-10">{t.generating}</span>
                            </>
                          ) : (
                            <>
                              <div className="relative">
                                <Volume2 className="w-6 h-6" />
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
                              </div>
                              <span className="relative z-10">{t.generate}</span>
                              <span 
                                className="relative z-10 px-3 py-1.5 rounded-full text-[13px] font-black"
                                style={{ 
                                  background: "#fff", 
                                  color: accent,
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                                }}
                              >
                                {voiceMode === "character" ? "3" : "1"} credits
                              </span>
                              <Sparkles className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </>
                          )}
                        </motion.button>

                        {generatedFiles && (
                          <div
                            className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t"
                            style={{ borderColor: cardBorder }}
                          >
                            <p
                              className="text-xs font-bold uppercase tracking-wider mb-3"
                              style={{ color: subtextColor }}
                            >
                              {t.preview}{" "}
                              {generatedFiles.durationMs > 0 &&
                                `(${Math.floor(generatedFiles.durationMs / 1000 / 60)}:${String(Math.floor(generatedFiles.durationMs / 1000) % 60).padStart(2, "0")})`}
                            </p>
                            <audio
                              ref={audioRef}
                              controls
                              className="w-full mb-4 rounded-xl"
                              style={{ accentColor: accent }}
                            />
                            <div className="space-y-3">
                              <button
                                onClick={() => {
                                  const a = document.createElement("a");
                                  a.href = generatedFiles.audioObjectUrl;
                                  a.download = `Myanmar_TTS_${Date.now()}.mp3`;
                                  a.click();
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border font-bold text-sm transition-colors"
                                style={{
                                  borderColor: accent,
                                  color: accent,
                                  background: isDark
                                    ? "rgba(192,111,48,0.1)"
                                    : "rgba(244,179,79,0.05)",
                                }}
                              >
                                <Download className="w-4 h-4" /> MP3 Audio
                              </button>
                              <button
                                onClick={() =>
                                  downloadFile(
                                    generatedFiles.srtContent,
                                    `Myanmar_TTS_${aspectRatio.replace(":", "x")}_${Date.now()}.srt`
                                  )
                                }
                                className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border font-bold text-sm transition-colors"
                                style={{
                                  borderColor: accentSecondary,
                                  color: accentSecondary,
                                  background: isDark
                                    ? "rgba(244,179,79,0.1)"
                                    : "rgba(244,179,79,0.05)",
                                }}
                              >
                                <Download className="w-4 h-4" /> SRT (
                                {aspectRatio})
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === VIDEO TAB — Simple Translation === */}
              {mainTab === "video" && (
                <div className="max-w-xl mx-auto animate-in fade-in zoom-in-95 duration-300 space-y-4">
                  <div className="text-center mb-2 sm:mb-4">
                    <h2
                      className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider sm:tracking-widest mb-2 leading-normal"
                      style={{ textShadow: "none", color: accent }}
                    >
                      {t.videoTitle}
                    </h2>
                    <p
                      className="font-bold tracking-wider text-xs sm:text-sm mt-1"
                      style={{ color: subtextColor }}
                    >
                      {t.videoDesc}
                    </p>
                    <p className="text-xs mt-1" style={{ color: subtextColor }}>
                      {t.videoLimit}
                    </p>
                    {!isAdmin && !hasPlan && me && !subLoading && (
                      <div
                        className="mt-3 mx-auto max-w-md flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
                        style={{
                          background: isDark
                            ? "rgba(220,38,38,0.15)"
                            : "#fef2f2",
                          border: "1px solid rgba(220,38,38,0.3)",
                          color: "#dc2626",
                        }}
                      >
                        <AlertCircle className="w-4 h-4" />
                        {lang === "mm"
                          ? "Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။"
                          : "No subscription. Contact Admin."}
                      </div>
                    )}
                  </div>

                  {!videoResult && (
                    <>
                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                        }}
                      >
                        <div
                          className={labelStyle}
                          style={{
                            background: labelBg,
                            color: accent,
                            borderColor: cardBorder,
                          }}
                        >
                          {t.linkInputLabel}
                          <span className="text-[10px] opacity-70 ml-2">
                            (
                            {lang === "mm"
                              ? "YouTube / TikTok / Facebook"
                              : "YouTube / TikTok / Facebook"}
                            )
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <LinkIcon
                            className="w-5 h-5 flex-shrink-0"
                            style={{ color: subtextColor }}
                          />
                          <input
                            type="text"
                            value={videoUrl}
                            onChange={e => {
                              setVideoUrl(e.target.value);
                              if (e.target.value) {
                                setVideoFile(null);
                                setVideoPreviewError("");
                                setVideoLoading(false);
                              }
                            }}
                            placeholder={t.linkPlaceholder}
                            className="flex-1 bg-transparent border-b-2 py-2 focus:outline-none transition-colors text-sm min-w-0"
                            style={{
                              borderColor: videoUrl ? accent : inputBorder,
                              color: textColor,
                            }}
                          />
                        </div>
                      </div>

                      <div
                        className="flex items-center justify-center gap-4 my-2"
                        style={{ color: subtextColor }}
                      >
                        <div
                          className="h-px w-16 sm:w-20"
                          style={{ background: isDark ? textColor : "#94a3b8" }}
                        ></div>
                        <span className="text-xs font-bold uppercase tracking-widest">
                          {t.orLine}
                        </span>
                        <div
                          className="h-px w-16 sm:w-20"
                          style={{ background: isDark ? textColor : "#94a3b8" }}
                        ></div>
                      </div>

                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                        }}
                      >
                        <div
                          className={labelStyle}
                          style={{
                            background: labelBg,
                            color: accent,
                            borderColor: cardBorder,
                          }}
                        >
                          Upload
                        </div>
                        <div
                          onDragOver={e => {
                            e.preventDefault();
                            setDragOver(true);
                          }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={e => {
                            e.preventDefault();
                            setDragOver(false);
                            if (e.dataTransfer.files[0])
                              handleVideoFile(e.dataTransfer.files[0]);
                          }}
                          onClick={() => fileRef.current?.click()}
                          className="border-2 border-dashed py-6 sm:py-8 px-4 rounded-xl text-center cursor-pointer transition-all mt-1"
                          style={{
                            borderColor: dragOver
                              ? accent
                              : videoFile
                                ? "#16a34a"
                                : inputBorder,
                            background: dragOver
                              ? isDark
                                ? "rgba(192,111,48,0.1)"
                                : "rgba(244,179,79,0.05)"
                              : inputBg,
                            opacity: videoUrl ? 0.4 : 1,
                          }}
                        >
                          <input
                            ref={fileRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={e => {
                              if (e.target.files?.[0])
                                handleVideoFile(e.target.files[0]);
                            }}
                          />
                          {videoFile ? (
                            <>
                              <FileVideo className="w-8 h-8 mx-auto mb-2 text-green-600" />
                              <p className="font-bold text-green-600 text-sm">
                                {videoFile.name}
                              </p>
                              <p
                                className="text-xs font-semibold mt-1"
                                style={{ color: subtextColor }}
                              >
                                {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                              </p>
                            </>
                          ) : (
                            <>
                              <Upload
                                className="w-8 h-8 mx-auto mb-2"
                                style={{ color: subtextColor }}
                              />
                              <p
                                className="font-bold text-sm"
                                style={{ color: subtextColor }}
                              >
                                {t.dropVideo}
                              </p>
                              <p
                                className="text-xs font-semibold mt-2"
                                style={{ color: subtextColor }}
                              >
                                MP4, MOV, AVI, MKV
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Video Preview removed from translate tab — not needed */}

                      {(videoFile || videoUrl) && !translateJobId && (
                        <button
                          onClick={handleTranslate}
                          disabled={
                            translateMutation.isPending ||
                            translateLinkMutation.isPending ||
                            !!translateJobId
                          }
                          className="w-full flex items-center justify-center gap-2 py-3.5 sm:py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all disabled:opacity-50 hover:scale-[1.02] mt-4 shadow-lg text-sm sm:text-base relative"
                          style={{
                            background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
                            boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
                          }}
                        >
                          {translateMutation.isPending ||
                          translateLinkMutation.isPending ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              {t.translating}
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5" />
                              {t.translateBtn}
                              <span 
                                className="px-3 py-1.5 rounded-full text-[13px] font-black"
                                style={{ 
                                  background: "#fff", 
                                  color: accent,
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                                }}
                              >
                                5 credits
                              </span>
                            </>
                          )}
                        </button>
                      )}

                      {(translateMutation.isPending ||
                        translateLinkMutation.isPending ||
                        !!translateJobId) && (
                        <div
                          className={box}
                          style={{
                            background: cardBg,
                            borderColor: cardBorder,
                            boxShadow,
                          }}
                        >
                          <div className="flex items-center justify-center gap-4 py-4">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full animate-pulse"
                                style={{ background: accent }}
                              />
                              <div
                                className="w-3 h-3 rounded-full animate-pulse"
                                style={{
                                  background: accent,
                                  animationDelay: "0.3s",
                                }}
                              />
                              <div
                                className="w-3 h-3 rounded-full animate-pulse"
                                style={{
                                  background: accent,
                                  animationDelay: "0.6s",
                                }}
                              />
                            </div>
                            <span
                              className="text-sm font-bold"
                              style={{ color: subtextColor }}
                            >
                              {translateJobMessage
                                ? `${translateJobMessage} (${translateJobProgress}%)`
                                : `${t.translating} (${translateJobProgress}%)`}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {videoResult && (
                    <div
                      className={box}
                      style={{
                        background: cardBg,
                        borderColor: cardBorder,
                        boxShadow,
                      }}
                    >
                      <div
                        className={labelStyle}
                        style={{
                          background: labelBg,
                          color: accent,
                          borderColor: cardBorder,
                        }}
                      >
                        {t.result}
                      </div>
                      <div className="space-y-4 mt-2">
                        <div className="flex justify-center">
                          <button
                            onClick={handleVideoCopy}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all hover:scale-105"
                            style={{
                              background: videoCopied ? "#4ade80" : accent,
                              color: "var(--foreground)",
                            }}
                          >
                            {videoCopied ? (
                              <>
                                <Check className="w-4 h-4" /> {t.copied}
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" /> {t.copyText}
                              </>
                            )}
                          </button>
                        </div>
                        <textarea
                          value={editedVideoText}
                          onChange={e => setEditedVideoText(e.target.value)}
                          className="w-full min-h-[200px] sm:min-h-[250px] p-4 sm:p-5 rounded-xl border focus:outline-none focus:ring-2 resize-y text-sm font-sans"
                          style={{
                            background: inputBg,
                            borderColor: inputBorder,
                            color: textColor,
                            lineHeight: "2.2",
                          }}
                        />
                        <button
                          onClick={handleVideoReset}
                          className="w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-colors hover:opacity-100 opacity-70"
                          style={{
                            borderColor: cardBorder,
                            color: subtextColor,
                          }}
                        >
                          {t.translateAnother}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* === DUBBING TAB — Auto Creator === */}
              {mainTab === "dubbing" && (
                <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
                  <div className="text-center mb-2 sm:mb-4">
                    <h2
                      className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wider sm:tracking-widest mb-2 leading-normal"
                      style={{ textShadow: "none", color: accent }}
                    >
                      {lang === "mm"
                        ? "Auto Creator"
                        : "Auto Creator"}
                    </h2>
                    <p
                      className="font-bold tracking-wider text-xs sm:text-sm mt-1"
                      style={{ color: subtextColor }}
                    >
                      {lang === "mm"
                        ? "ဖြင့် Video ဖန်တီးခြင်း"
                        : "Create dubbed videos with AI"}
                    </p>
                    {!isAdmin && !hasPlan && me && !subLoading && (
                      <div
                        className="mt-3 mx-auto max-w-md flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
                        style={{
                          background: isDark
                            ? "rgba(220,38,38,0.15)"
                            : "#fef2f2",
                          border: "1px solid rgba(220,38,38,0.3)",
                          color: "#dc2626",
                        }}
                      >
                        <AlertCircle className="w-4 h-4" />
                        {lang === "mm"
                          ? "Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။"
                          : "No subscription. Contact Admin."}
                      </div>
                    )}
                  </div>

                  {/* ── STEP: Video Input ── */}
                  {!dubPreviewUrl && !dubResult && (
                    <div className="space-y-4">
                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                        }}
                      >
                        <div
                          className={labelStyle}
                          style={{
                            background: labelBg,
                            color: accent,
                            borderColor: cardBorder,
                          }}
                        >
                          {t.linkInputLabel}
                          <span className="text-[10px] opacity-70 ml-2">
                            (
                            {lang === "mm"
                              ? "YouTube / TikTok / Facebook"
                              : "YouTube / TikTok / Facebook"}
                            )
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <LinkIcon
                            className="w-5 h-5 flex-shrink-0"
                            style={{ color: subtextColor }}
                          />
                          <input
                            type="text"
                            value={dubVideoUrl}
                            onChange={e => {
                              setDubVideoUrl(e.target.value);
                              if (e.target.value) {
                                setDubVideoFile(null);
                                setVideoPreviewError("");
                                setVideoLoading(false);
                              }
                            }}
                            placeholder={t.linkPlaceholder}
                            className="flex-1 bg-transparent border-b-2 py-2 focus:outline-none transition-colors text-sm min-w-0"
                            style={{
                              borderColor: dubVideoUrl ? accent : inputBorder,
                              color: textColor,
                            }}
                          />
                        </div>
                        {videoPreviewError && (
                          <div
                            className="mt-3 p-3 rounded-xl"
                            style={{
                              background: "rgba(220, 38, 38, 0.1)",
                              border: "1px solid rgba(220, 38, 38, 0.3)",
                            }}
                          >
                            <p
                              className="text-xs font-semibold"
                              style={{ color: "#dc2626" }}
                            >
                              {videoPreviewError}
                            </p>
                          </div>
                        )}
                      </div>

                      <div
                        className="flex items-center justify-center gap-4 my-2"
                        style={{ color: subtextColor }}
                      >
                        <div
                          className="h-px w-16 sm:w-20"
                          style={{ background: isDark ? textColor : "#94a3b8" }}
                        ></div>
                        <span className="text-xs font-bold uppercase tracking-widest">
                          {t.orLine}
                        </span>
                        <div
                          className="h-px w-16 sm:w-20"
                          style={{ background: isDark ? textColor : "#94a3b8" }}
                        ></div>
                      </div>

                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                        }}
                      >
                        <div
                          className={labelStyle}
                          style={{
                            background: labelBg,
                            color: accent,
                            borderColor: cardBorder,
                          }}
                        >
                          Upload
                        </div>
                        <div
                          onDragOver={e => {
                            e.preventDefault();
                            setDubDragOver(true);
                          }}
                          onDragLeave={() => setDubDragOver(false)}
                          onDrop={e => {
                            e.preventDefault();
                            setDubDragOver(false);
                            if (e.dataTransfer.files[0])
                              handleDubVideoFile(e.dataTransfer.files[0]);
                          }}
                          onClick={() => dubFileRef.current?.click()}
                          className="border-2 border-dashed py-6 sm:py-8 px-4 rounded-xl text-center cursor-pointer transition-all mt-1"
                          style={{
                            borderColor: dubDragOver
                              ? accent
                              : dubVideoFile
                                ? "#16a34a"
                                : inputBorder,
                            background: dubDragOver
                              ? isDark
                                ? "rgba(192,111,48,0.1)"
                                : "rgba(244,179,79,0.05)"
                              : inputBg,
                            opacity: dubVideoUrl ? 0.4 : 1,
                          }}
                        >
                          <input
                            ref={dubFileRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={e => {
                              if (e.target.files?.[0])
                                handleDubVideoFile(e.target.files[0]);
                            }}
                          />
                          {dubVideoFile ? (
                            <>
                              <FileVideo className="w-8 h-8 mx-auto mb-2 text-green-600" />
                              <p className="font-bold text-green-600 text-sm">
                                {dubVideoFile.name}
                              </p>
                              <p
                                className="text-xs font-semibold mt-1"
                                style={{ color: subtextColor }}
                              >
                                {(dubVideoFile.size / 1024 / 1024).toFixed(1)}{" "}
                                MB
                              </p>
                            </>
                          ) : (
                            <>
                              <Upload
                                className="w-8 h-8 mx-auto mb-2"
                                style={{ color: subtextColor }}
                              />
                              <p
                                className="font-bold text-sm"
                                style={{ color: subtextColor }}
                              >
                                {t.dropVideo}
                              </p>
                              <p
                                className="text-xs font-semibold mt-2"
                                style={{ color: subtextColor }}
                              >
                                MP4, MOV, AVI, MKV
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── STEP: Video Preview + Settings ── */}
                  {dubPreviewUrl && !dubResult && (
                    <div className="space-y-4">
                      {/* Video Preview — Sticky at top, always visible */}
                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                          position: "sticky",
                          top: "60px",
                          zIndex: 45,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={labelStyle}
                            style={{
                              background: labelBg,
                              color: accent,
                              borderColor: cardBorder,
                            }}
                          >
                            {lang === "mm" ? "ဗီဒီယိုကြိုကြည့်" : "Video Preview"}
                          </div>
                          <button
                            onClick={() => { setDubVideoUrl(""); setDubPreviewUrl(""); setDubVideoFile(null); }}
                            className="text-xs px-2 py-1 rounded hover:bg-red-500/20 text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex justify-center mt-2">
                          {/* Preview: spinner → blob video → info card → HTML5 video */}
                          {dubPreviewUrl === "loading" ||
                          dubPreviewMutation.isPending ? (
                            <div
                              className="w-full rounded-xl flex flex-col items-center justify-center gap-3 py-14"
                              style={{
                                background: "rgba(0,0,0,0.2)",
                                border: `1px dashed ${cardBorder}`,
                                minHeight: "180px",
                              }}
                            >
                              <Loader2
                                className="w-10 h-10 animate-spin"
                                style={{ color: accent }}
                              />
                              <p
                                className="text-sm font-bold"
                                style={{ color: subtextColor }}
                              >
                                {lang === "mm"
                                  ? "ဗီဒီယို ပြင်ဆင်နေသည်..."
                                  : "Preparing preview..."}
                              </p>
                            </div>
                          ) : dubPreviewUrl.startsWith("blob:") ? (
                            <div
                              style={{
                                width:
                                  dubDetectedRatio === "9:16"
                                    ? "min(240px, 55vw)"
                                    : "100%",
                                margin:
                                  dubDetectedRatio === "9:16" ? "0 auto" : "0",
                                aspectRatio:
                                  dubDetectedRatio === "9:16" ? "9/16" : "16/9",
                                borderRadius: "12px",
                                overflow: "hidden",
                                position: "relative",
                                background: "var(--background)",
                              }}
                            >
                              <video
                                ref={dubPreviewRef}
                                src={dubPreviewUrl}
                                controls
                                className="w-full h-full"
                                style={{
                                  objectFit: "cover",
                                  borderRadius: "12px",
                                  display: "block",
                                }}
                                onLoadedMetadata={e => {
                                  const v = e.currentTarget;
                                  setDubVideoWidth(v.videoWidth);
                                  setDubVideoHeight(v.videoHeight);
                                  if (v.videoHeight > v.videoWidth)
                                    setDubDetectedRatio("9:16");
                                  else setDubDetectedRatio("16:9");
                                  setVideoLoading(false);
                                }}
                                onError={() => {
                                  setVideoLoading(false);
                                }}
                              />
                              {srtEnabled && (
                                <div
                                  className="absolute left-0 right-0 flex justify-center pointer-events-none"
                                  style={{
                                    zIndex: 10,
                                    top: `${100 - srtMarginV}%`,
                                    transform: "translateY(-50%)",
                                    transition: "top 0.2s ease-out",
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: `${srtBoxPadding * 2}px ${srtBoxPadding * 4}px`,
                                      borderRadius: srtFullWidth
                                        ? "0"
                                        : srtBorderRadius === "rounded"
                                          ? "12px"
                                          : "4px",
                                      fontSize: `${Math.round(srtFontSize * 0.8)}px`,
                                      color: srtColor,
                                      textShadow: srtDropShadow ? "2px 2px 4px rgba(0,0,0,0.8)" : "none",
                                      background: srtBlurBg 
                                        ? srtBlurColor === "black" 
                                          ? `rgba(0,0,0,${Math.min(1, srtBlurOpacity / 100)})` 
                                          : srtBlurColor === "white"
                                            ? `rgba(255,255,255,${Math.min(1, srtBlurOpacity / 100)})`
                                            : "transparent"
                                        : "transparent",
                                      textAlign: "center",
                                      width: srtFullWidth ? "100%" : "auto",
                                      maxWidth: srtFullWidth ? "100%" : "90%",
                                      fontFamily:
                                        "'Noto Sans Myanmar', 'Pyidaungsu', sans-serif",
                                      transition: "all 0.2s ease-out",
                                    }}
                                  >
                                    {lang === "mm"
                                      ? "မြန်မာ စာတန်း နမူနာ"
                                      : "Subtitle Preview"}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : dubPreviewUrl.startsWith("fallback:") ||
                            isExternalVideoUrl(dubPreviewUrl) ? (
                            <div
                              className="rounded-xl overflow-hidden"
                              style={{
                                position: "relative",
                                width:
                                  aspectRatio === "9:16" ? "min(240px, 55vw)" : "100%",
                                aspectRatio:
                                  aspectRatio === "9:16" ? "9/16" : "16/9",
                                margin: aspectRatio === "9:16" ? "0 auto" : "0",
                                background: "var(--background)",
                                borderRadius: "12px",
                                overflow: "hidden",
                              }}
                            >
                              {(() => {
                                const ytMatch = dubPreviewUrl.match(
                                  /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/
                                );
                                const videoId = ytMatch ? ytMatch[1] : null;
                                return videoId ? (
                                  <img
                                    src={`https://img.youtube.com/vi/${videoId}/0.jpg`}
                                    alt="thumbnail"
                                    onError={e => {
                                      (e.target as HTMLImageElement).src =
                                        `https://wsrv.nl/?url=https://img.youtube.com/vi/${videoId}/0.jpg`;
                                    }}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      borderRadius: "12px",
                                      display: "block",
                                      position: "absolute",
                                      top: 0,
                                      left: 0,
                                    }}
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex flex-col items-center justify-center gap-2"
                                    style={{ minHeight: "180px" }}
                                  >
                                    <ExternalLink
                                      className="w-8 h-8"
                                      style={{ color: accent }}
                                    />
                                    <p
                                      className="text-xs font-bold"
                                      style={{ color: subtextColor }}
                                    >
                                      {lang === "mm"
                                        ? "ဗီဒီယို Link အဆင်သင့်"
                                        : "Video Link Ready"}
                                    </p>
                                  </div>
                                );
                              })()}
                              {srtEnabled && (
                                <div
                                  className="absolute left-0 right-0 flex justify-center pointer-events-none"
                                  style={{
                                    zIndex: 10,
                                    top: `${100 - srtMarginV}%`,
                                    transform: "translateY(-50%)",
                                    transition: "top 0.2s ease-out",
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: computeSrtPreviewStyle.padding,
                                      borderRadius: srtFullWidth
                                        ? "0"
                                        : srtBorderRadius === "rounded"
                                          ? "12px"
                                          : "4px",
                                      fontSize: computeSrtPreviewStyle.fontSize,
                                      color: srtColor,
                                      textShadow: computeSrtPreviewStyle.textShadow,
                                      background: computeSrtPreviewStyle.background,
                                      backdropFilter: "none",
                                      textAlign: "center",
                                      width: srtFullWidth ? "100%" : "auto",
                                      maxWidth: srtFullWidth ? "100%" : "90%",
                                      fontFamily: "Noto Sans Myanmar",
                                      transition: "all 0.2s ease-out",
                                    }}
                                  >
                                    {lang === "mm"
                                      ? "မြန်မာ စာတန်း နမူနာ"
                                      : "Subtitle Preview"}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              style={{
                                width:
                                  dubDetectedRatio === "9:16"
                                    ? "min(240px, 55vw)"
                                    : "100%",
                                maxWidth:
                                  dubDetectedRatio === "9:16"
                                    ? "240px"
                                    : "100%",
                                aspectRatio:
                                  dubDetectedRatio === "9:16" ? "9/16" : "16/9",
                                position: "relative",
                                overflow: "hidden",
                                borderRadius: "12px",
                              }}
                            >
                              {getYouTubeEmbedUrl(dubVideoUrl) ? (
                                // YouTube embed iframe
                                <iframe
                                  src={getYouTubeEmbedUrl(dubVideoUrl)!}
                                  title="YouTube video preview"
                                  className="w-full h-full"
                                  style={{
                                    border: "none",
                                    borderRadius: "12px",
                                  }}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  onLoad={() => {
                                    setVideoLoading(false);
                                    setVideoPreviewError("");
                                  }}
                                  onError={() => {
                                    setVideoPreviewError(
                                      "Failed to load video. Check if the link is valid or try uploading the file."
                                    );
                                    setVideoLoading(false);
                                  }}
                                />
                              ) : (
                                // HTML5 video tag for uploaded files
                                <video
                                  ref={dubPreviewRef}
                                  src={dubPreviewUrl}
                                  controls
                                  className="w-full h-full"
                                  style={{
                                    objectFit: "cover",
                                    borderRadius: "12px",
                                  }}
                                  onLoadedMetadata={e => {
                                    const v = e.currentTarget;
                                    setDubVideoWidth(v.videoWidth);
                                    setDubVideoHeight(v.videoHeight);
                                    if (h > w) setDubDetectedRatio("9:16");
                                    else setDubDetectedRatio("16:9");
                                    setVideoLoading(false);
                                    setVideoPreviewError("");
                                  }}
                                  onError={() => {
                                    setVideoPreviewError(
                                      "Failed to load video. Check if the link is valid or try uploading the file."
                                    );
                                    setVideoLoading(false);
                                  }}
                                />
                              )}
                              {videoLoading && (
                                <div
                                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl"
                                  style={{ zIndex: 20 }}
                                >
                                  <Loader2 className="w-8 h-8 animate-spin text-white" />
                                </div>
                              )}
                              {videoPreviewError && (
                                <div
                                  className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl p-4"
                                  style={{ zIndex: 20 }}
                                >
                                  <div className="text-center">
                                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                                    <p className="text-white text-sm font-semibold">
                                      {videoPreviewError}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {srtEnabled && (
                                <div
                                  className="absolute left-0 right-0 flex justify-center pointer-events-none"
                                  style={{
                                    zIndex: 10,
                                    top: `${100 - srtMarginV}%`,
                                    transform: "translateY(-50%)",
                                    transition: "top 0.2s ease-out",
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: computeSrtPreviewStyle.padding,
                                      borderRadius: srtFullWidth
                                        ? "0"
                                        : srtBorderRadius === "rounded"
                                          ? "12px"
                                          : "4px",
                                      fontSize: computeSrtPreviewStyle.fontSize,
                                      color: srtColor,
                                      textShadow: computeSrtPreviewStyle.textShadow,
                                      background: computeSrtPreviewStyle.background,
                                      backdropFilter: "none",
                                      textAlign: "center",
                                      width: srtFullWidth ? "100%" : "auto",
                                      maxWidth: srtFullWidth ? "100%" : "90%",
                                      transition: "all 0.2s ease-out",
                                    }}
                                  >
                                    {lang === "mm"
                                      ? "မြန်မာ စာတန်း နမူနာ"
                                      : "Subtitle Preview"}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {!isExternalVideoUrl(dubPreviewUrl) && (
                          <div
                            className="flex items-center justify-center gap-2 mt-3 text-xs"
                            style={{ color: subtextColor }}
                          >
                            <span
                              className="px-2 py-1 rounded-lg border font-bold"
                              style={{ borderColor: cardBorder }}
                            >
                              {dubDetectedRatio}
                            </span>
                            <span>
                              {lang === "mm" ? "အချိုး" : "Aspect Ratio"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ── ACCORDION: Voice Selection ── */}
                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                        }}
                      >
                        <button
                          onClick={() =>
                            setVoiceAccordionOpen(!voiceAccordionOpen)
                          }
                          className="w-full flex items-center justify-between"
                          style={{ marginTop: "-4px" }}
                        >
                          <div
                            className={labelStyle}
                            style={{
                              background: labelBg,
                              color: accent,
                              borderColor: cardBorder,
                            }}
                          >
                            {t.voiceSelection}
                          </div>
                          <ChevronDown
                            className={`w-5 h-5 transition-transform duration-200 ${voiceAccordionOpen ? "rotate-180" : ""}`}
                            style={{ color: accent }}
                          />
                        </button>
                        {voiceAccordionOpen && (
                          <div className="space-y-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            {[
                              {
                                label: t.male,
                                voices: [
                                  { id: "thiha", name: "သီဟ", isStd: true },
                                  { id: "ryan", name: "ရဲရင့်", isStd: false },
                                  {
                                    id: "ronnie",
                                    name: "ရောင်နီ",
                                    isStd: false,
                                  },
                                  {
                                    id: "lucas",
                                    name: "လင်းခန့်",
                                    isStd: false,
                                  },
                                  { id: "daniel", name: "ဒေဝ", isStd: false },
                                  { id: "evander", name: "အဂ္ဂ", isStd: false },
                                ],
                              },
                              {
                                label: t.female,
                                voices: [
                                  { id: "nilar", name: "နီလာ", isStd: true },
                                  {
                                    id: "michelle",
                                    name: "မေချို",
                                    isStd: false,
                                  },
                                  { id: "iris", name: "အိန္ဒြာ", isStd: false },
                                  {
                                    id: "charlotte",
                                    name: "သီရိ",
                                    isStd: false,
                                  },
                                  { id: "amara", name: "အမရာ", isStd: false },
                                ],
                              },
                            ].map(({ label: grpLabel, voices }) => (
                              <div key={grpLabel}>
                                <p
                                  className="text-xs font-bold uppercase tracking-wider mb-2"
                                  style={{ color: subtextColor }}
                                >
                                  {grpLabel}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                  {voices.map(v => {
                                    const isSelected = v.isStd
                                      ? dubVoiceMode === "standard" &&
                                        dubVoice ===
                                          (v.id === "thiha" ? "thiha" : "nilar")
                                      : dubVoiceMode === "character" &&
                                        dubCharacter === v.id;
                                    return (
                                      <button
                                        key={v.id}
                                        onClick={() => {
                                          if (v.isStd) {
                                            setDubVoiceMode("standard");
                                            setDubVoice(v.id as any);
                                            setDubCharacter("");
                                          } else {
                                            setDubVoiceMode("character");
                                            setDubCharacter(v.id);
                                          }
                                        }}
                                        className="py-2 px-2 border rounded-xl text-xs font-bold transition-all"
                                        style={{
                                          borderColor: isSelected
                                            ? accent
                                            : cardBorder,
                                          background: isSelected
                                            ? isDark
                                              ? "rgba(192,111,48,0.2)"
                                              : "rgba(244,179,79,0.08)"
                                            : "transparent",
                                          color: isSelected
                                            ? accent
                                            : textColor,
                                          boxShadow: "none",
                                        }}
                                      >
                                        {v.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
)}
                        </div>

                      {/* ═══ Premium 3D Subtitle Settings Panel ═══ */}
                      <div
                        className="panel-floating p-3 sm:p-5"
                        style={{
                          ...panelStyle,
                          borderRadius: 20,
                        }}
                      >
                        {/* Panel Header with Toggle */}
                        <div className="flex items-center justify-between mb-3 sm:mb-5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center"
                              style={{
                                background: isDark ? "rgba(192,111,48,0.2)" : "linear-gradient(135deg, rgba(192,111,48,0.12), rgba(244,179,79,0.08))",
                                border: `1px solid ${isDark ? "rgba(192,111,48,0.3)" : "rgba(192,111,48,0.15)"}`,
                              }}
                            >
                              <Subtitles className="w-4 h-4" style={{ color: accent }} />
                            </div>
                            <div>
                              <span className="text-sm font-bold block" style={{ color: textColor }}>
                                {lang === "mm" ? "စာတန်း ဆက်တင်" : "Subtitle Settings"}
                              </span>
                              <span className="text-[10px]" style={{ color: subtextColor }}>
                                {lang === "mm" ? "စာတန်းပုံစံ ပြင်ဆင်ရန်" : "Customize appearance"}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const next = !srtEnabled;
                              setSrtEnabled(next);
                              setSrtAccordionOpen(next);
                            }}
                            className={`relative w-10 h-5 sm:w-14 sm:h-7 rounded-full transition-all duration-300`}
                            style={{
                              background: srtEnabled
                                ? "linear-gradient(135deg, #C06F30, #F4B34F)"
                                : isDark ? "rgba(255,255,255,0.1)" : "#E5E0D8",
                              boxShadow: srtEnabled ? "0 2px 12px rgba(192,111,48,0.3)" : "inset 0 1px 3px rgba(0,0,0,0.1)",
                            }}
                          >
                            <div
                              className={`absolute top-0.5 w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full transition-transform duration-300 ${srtEnabled ? "translate-x-[22px] sm:translate-x-7" : "translate-x-0.5"}`}
                              style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}
                            />
                          </button>
                        </div>

                        {/* Settings Groups — collapsible */}
                        {srtAccordionOpen && (
                        <div className="space-y-5">
                          
                          {/* ── Group: Text ── */}
                          <div>
                            <div className="section-header">
                              <span>✦</span>
                              <span>{lang === "mm" ? "စာသား" : "TEXT"}</span>
                            </div>

                            {/* Font Size */}
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                                  {lang === "mm" ? "စာလုံးအရွယ်" : "Text Size"}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { label: lang === "mm" ? "သေးငယ်သော" : "Small", val: 18 },
                                  { label: lang === "mm" ? "အလတ်စား" : "Medium", val: 24 },
                                  { label: lang === "mm" ? "ကြီးမားသော" : "Large", val: 32 }
                                ].map(size => (
                                  <button
                                    key={size.val}
                                    onClick={() => setSrtFontSize(size.val)}
                                    className="py-2 rounded-xl text-xs font-bold transition-all"
                                    style={{
                                      background: srtFontSize === size.val
                                        ? "linear-gradient(135deg, #C06F30, #F4B34F)"
                                        : isDark ? "rgba(255,255,255,0.05)" : "#F0EBE3",
                                      color: srtFontSize === size.val ? "#fff" : subtextColor,
                                      boxShadow: srtFontSize === size.val ? "0 2px 8px rgba(192,111,48,0.25)" : "none",
                                      border: `1px solid ${srtFontSize === size.val ? "transparent" : isDark ? "rgba(255,255,255,0.05)" : "rgba(192,111,48,0.08)"}`
                                    }}
                                  >
                                    {size.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Text Color */}
                            <div>
                              <span className="text-xs font-semibold block mb-2.5" style={{ color: subtextColor }}>
                                {lang === "mm" ? "စာအရောင်" : "Text Color"}
                              </span>
                              <div className="flex gap-2.5 flex-wrap">
                                {["#ffffff", "#000000", "#fbbf24", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#ec4899"].map(color => (
                                  <button
                                    key={color}
                                    onClick={() => setSrtColor(color)}
                                    className={`color-swatch ${srtColor === color ? "active" : ""}`}
                                    style={{ 
                                      background: color,
                                      borderColor: srtColor === color ? accent : "transparent",
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* ── Group: Layout ── */}
                          <div>
                            <div className="section-header">
                              <span>◈</span>
                              <span>{lang === "mm" ? "အနေအထား" : "LAYOUT"}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              {/* Box Height */}
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                                    {lang === "mm" ? "အမြင့်" : "Height"}
                                  </span>
                                  <span className="text-xs font-bold" style={{ color: accent }}>
                                    {srtBoxPadding}px
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="2"
                                  max="20"
                                  value={srtBoxPadding}
                                  onChange={e => setSrtBoxPadding(Number(e.target.value))}
                                  className="premium-slider w-full"
                                />
                              </div>

                              {/* Position */}
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                                    {lang === "mm" ? "အနေအထား" : "Position"}
                                  </span>
                                  <span className="text-[10px] font-semibold" style={{ color: subtextColor, opacity: 0.8 }}>
                                    {lang === "mm" ? "အောက် > အပေါ်" : "Bottom > Top"} ({srtMarginV}%)
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={srtMarginV}
                                  onChange={e => setSrtMarginV(Number(e.target.value))}
                                  className="premium-slider w-full"
                                />
                              </div>
                            </div>

                            {/* Full Width Toggle */}
                            <div className="flex items-center justify-between mt-3 py-2.5 px-3 rounded-xl" style={{
                              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(192,111,48,0.03)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(192,111,48,0.08)"}`,
                            }}>
                              <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                                {lang === "mm" ? "အပြည့်အစုံ" : "Full Width"}
                              </span>
                              <button
                                onClick={() => setSrtFullWidth(!srtFullWidth)}
                                className="relative w-12 h-6 rounded-full transition-all duration-300"
                                style={{
                                  background: srtFullWidth
                                    ? "linear-gradient(135deg, #C06F30, #F4B34F)"
                                    : isDark ? "rgba(255,255,255,0.1)" : "#E5E0D8",
                                  boxShadow: srtFullWidth ? "0 2px 8px rgba(192,111,48,0.25)" : "inset 0 1px 3px rgba(0,0,0,0.1)",
                                }}
                              >
                                <div
                                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${srtFullWidth ? "translate-x-6" : "translate-x-0.5"}`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* ── Group: Background ── */}
                          <div>
                            <div className="section-header">
                              <span>❖</span>
                              <span>{lang === "mm" ? "နောက်ခံ" : "BACKGROUND"}</span>
                            </div>

                            {/* Background Blur Toggle */}
                            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl mb-3" style={{
                              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(192,111,48,0.03)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(192,111,48,0.08)"}`,
                            }}>
                              <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                                {lang === "mm" ? "နောက်ခံ Blur" : "Background Blur"}
                              </span>
                              <button
                                onClick={() => setSrtBlurBg(!srtBlurBg)}
                                className="relative w-12 h-6 rounded-full transition-all duration-300"
                                style={{
                                  background: srtBlurBg
                                    ? "linear-gradient(135deg, #C06F30, #F4B34F)"
                                    : isDark ? "rgba(255,255,255,0.1)" : "#E5E0D8",
                                  boxShadow: srtBlurBg ? "0 2px 8px rgba(192,111,48,0.25)" : "inset 0 1px 3px rgba(0,0,0,0.1)",
                                }}
                              >
                                <div
                                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${srtBlurBg ? "translate-x-6" : "translate-x-0.5"}`}
                                />
                              </button>
                            </div>

                            {srtBlurBg && (
                              <div className="space-y-3 pl-3 ml-1" style={{
                                borderLeft: `2px solid ${isDark ? "rgba(192,111,48,0.2)" : "rgba(192,111,48,0.12)"}`,
                              }}>
                                {/* Blur Opacity */}
                                <div>
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                                      {lang === "mm" ? "အလင်းပိတ်မှု" : "Opacity"}
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: accent }}>
                                      {srtBlurOpacity}%
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={srtBlurOpacity}
                                    onChange={e => setSrtBlurOpacity(Number(e.target.value))}
                                    className="premium-slider w-full"
                                  />
                                </div>

                                {/* Blur Color */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                                    {lang === "mm" ? "Blur အရောင်" : "Blur Color"}
                                  </span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setSrtBlurColor("black")}
                                      className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                                      style={{
                                        background: srtBlurColor === "black"
                                          ? "linear-gradient(135deg, #1f1f1f, #333)"
                                          : isDark ? "rgba(255,255,255,0.05)" : "#F0EBE3",
                                        color: srtBlurColor === "black" ? "#fff" : subtextColor,
                                        border: `1px solid ${srtBlurColor === "black" ? accent : "transparent"}`,
                                        boxShadow: srtBlurColor === "black" ? `0 2px 8px rgba(192,111,48,0.2)` : "none",
                                      }}
                                    >
                                      {lang === "mm" ? "မည်း" : "Dark"}
                                    </button>
                                    <button
                                      onClick={() => setSrtBlurColor("white")}
                                      className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                                      style={{
                                        background: srtBlurColor === "white"
                                          ? "linear-gradient(135deg, #fff, #F5F0EA)"
                                          : isDark ? "rgba(255,255,255,0.05)" : "#F0EBE3",
                                        color: srtBlurColor === "white" ? "#2B1D1C" : subtextColor,
                                        border: `1px solid ${srtBlurColor === "white" ? accent : "transparent"}`,
                                        boxShadow: srtBlurColor === "white" ? `0 2px 8px rgba(192,111,48,0.2)` : "none",
                                      }}
>
                                      {lang === "mm" ? "ဖြူ" : "Light"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          </div>
                        )}
                      </div>

                      {/* Generate Dubbing Button */}
                      <motion.button
                        onClick={handleDubGenerate}
                        disabled={
                          startDubMutation.isPending ||
                          dubFileMutation.isPending ||
                          activeJobId !== null ||
                          dubPreviewUrl === "loading"
                        }
                        whileHover={{ scale: startDubMutation.isPending || dubFileMutation.isPending || activeJobId !== null ? 1 : 1.02 }}
                        whileTap={{ scale: startDubMutation.isPending || dubFileMutation.isPending || activeJobId !== null ? 1 : 0.98 }}
                        className="w-full relative overflow-hidden group flex items-center justify-center gap-3 py-4 sm:py-5 rounded-2xl text-white font-black uppercase tracking-wider transition-all disabled:opacity-50 mt-2 text-sm sm:text-base"
                        style={{
                          background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        {startDubMutation.isPending || dubFileMutation.isPending || activeJobId !== null ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                              className="relative"
                            >
                              <Loader2 className="w-6 h-6" />
                            </motion.div>
                            <span className="relative z-10 text-xs sm:text-sm">
                              {lang === "mm"
                                ? "ဖန်တီးနေသည်... (၃-၅ မိနစ်)"
                                : "Generating... (3-5 min)"}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="relative">
                              <Wand2 className="w-6 h-6" />
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
                            </div>
                            <span className="relative z-10">
                              {lang === "mm"
                                ? "AI ဖြင့် ဖန်တီးမည်"
                                : "Generate with AI"}
                            </span>
                            <span 
                              className="relative z-10 px-3 py-1.5 rounded-full text-[13px] font-black"
                              style={{ 
                                background: "#fff", 
                                color: accent,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                              }}
                            >
                              10 credits
                            </span>
                            <Sparkles className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </>
                        )}
                      </motion.button>

                      {(startDubMutation.isPending || activeJobId !== null) && (
                        <div
                          className={box}
                          style={{
                            background: cardBg,
                            borderColor: cardBorder,
                            boxShadow,
                          }}
                        >
                          <div className="flex flex-col items-center justify-center gap-4 py-6">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full animate-pulse"
                                style={{ background: accent }}
                              />
                              <div
                                className="w-3 h-3 rounded-full animate-pulse"
                                style={{
                                  background: accent,
                                  animationDelay: "0.3s",
                                }}
                              />
                              <div
                                className="w-3 h-3 rounded-full animate-pulse"
                                style={{
                                  background: accent,
                                  animationDelay: "0.6s",
                                }}
                              />
                            </div>
                            
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleDubReset}
                        className="w-full py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider opacity-50 hover:opacity-100 transition-all"
                        style={{ borderColor: cardBorder, color: subtextColor }}
                      >
                        ← {lang === "mm" ? "ဗီဒီယိုပြောင်းမည်" : "Change Video"}
                      </button>
                    </div>
                  )}

                  {/* Dubbing Result — Final Video + Download */}
                  {dubResult && (
                    <div className="space-y-4">
                      {/* Video Player */}
                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                        }}
                      >
                        <div
                          className={labelStyle}
                          style={{
                            background: labelBg,
                            color: accent,
                            borderColor: cardBorder,
                          }}
                        >
                          {lang === "mm"
                            ? "AI ဖန်တီးပြီး ဗီဒီယို"
                            : "Auto Creator Generated Video"}
                        </div>
                        <div className="flex justify-center mt-2">
                          <div
                            style={{
                              width: dubDetectedRatio === "9:16" ? "min(240px, 55vw)" : "100%",
                              margin: dubDetectedRatio === "9:16" ? "0 auto" : "0",
                              aspectRatio:
                                dubDetectedRatio === "9:16" ? "9/16" : "16/9",
                              borderRadius: "12px",
                              overflow: "hidden",
                            }}
                          >
                            <video
                              ref={dubResultVideoRef}
                              controls
                              className="w-full h-full rounded-xl"
                              style={{
                                objectFit: "cover",
                                background: "var(--background)",
                              }}
                              src={
                                dubResult.videoUrl ||
                                (() => {
                                  try {
                                    const b = atob(dubResult.videoBase64 || "");
                                    const arr = new Uint8Array(b.length);
                                    for (let i = 0; i < b.length; i++)
                                      arr[i] = b.charCodeAt(i);
                                    return URL.createObjectURL(
                                      new Blob([arr], { type: "video/mp4" })
                                    );
                                  } catch {
                                    return "";
                                  }
                                })()
                              }
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-3 mt-4">
                          <button
                            onClick={handleDubDownload}
                            className="flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:scale-105 shadow-lg text-white"
                            style={{
                              background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
                              boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
                            }}
                          >
                            <Download className="w-5 h-5" />{" "}
                            {lang === "mm" ? "MP4 ဒေါင်းလုတ်" : "Download MP4"}
                          </button>
                        </div>
                      </div>

                      {/* Reset */}
                      <button
                        onClick={handleDubReset}
                        className="w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-colors hover:opacity-100 opacity-70"
                        style={{ borderColor: cardBorder, color: subtextColor }}
                      >
                        {lang === "mm"
                          ? "နောက်ထပ် ဗီဒီယိုဖန်တီးမည်"
                          : "Create Another Video"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* === SETTINGS TAB === */}
          {secondaryTab === "settings" && (
            <div className="max-w-xl mx-auto py-2 sm:py-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center mb-3 sm:mb-5">
                <h2
                  className="text-2xl sm:text-3xl font-black uppercase tracking-widest mb-2"
                  style={{ color: accent }}
                >
                  {t.settingsTitle}
                </h2>
              </div>
              <div
                className={box}
                style={{
                  background: cardBg,
                  borderColor: cardBorder,
                  boxShadow,
                }}
              >
                <div
                  className={labelStyle}
                  style={{
                    background: labelBg,
                    color: accent,
                    borderColor: cardBorder,
                  }}
                >
                  API Key
                </div>
                <div className="space-y-4 mt-2">
                  <div>
                    <p className="font-bold mb-1 text-sm">{t.geminiKey}</p>
                    <p
                      className="text-xs font-semibold mb-4"
                      style={{ color: subtextColor }}
                    >
                      {t.geminiKeyDesc}
                    </p>
                    {savedKey ? (
                      <div className="p-3 border-2 border-green-500/40 bg-green-500/10 rounded-xl mb-4">
                        <p className="text-xs text-green-600 font-bold mb-1">
                          ✓ {t.keyActive}
                        </p>
                        <p
                          className="text-xs font-mono"
                          style={{ color: subtextColor }}
                        >
                          {savedKey.slice(0, 8)}
                          {"*".repeat(15)}
                        </p>
                      </div>
                    ) : (
                      <div
                        className="p-3 border border-dashed rounded-xl mb-4 text-sm font-semibold"
                        style={{ borderColor: cardBorder, color: subtextColor }}
                      >
                        {t.keyNone}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <input
                        value={geminiKey}
                        onChange={e => setGeminiKey(e.target.value)}
                        placeholder={t.geminiKeyPlaceholder}
                        className="flex-1 min-w-0 p-3 rounded-xl border focus:outline-none focus:ring-2 font-mono text-sm transition-colors"
                        style={{
                          background: inputBg,
                          borderColor: inputBorder,
                          color: textColor,
                        }}
                      />
                      <button
                        onClick={() => {
                          if (geminiKey.trim()) {
                            setSavedKey(geminiKey.trim());
                            localStorage.setItem(
                              "gemini_key",
                              geminiKey.trim()
                            );
                            setGeminiKey("");
                          }
                        }}
                        className="px-4 sm:px-5 font-bold text-sm text-white rounded-xl transition-transform hover:scale-105 shadow-md"
                        style={{ background: accent }}
                      >
                        {t.saveKey}
                      </button>
                      {savedKey && (
                        <button
                          onClick={() => {
                            setSavedKey("");
                            localStorage.removeItem("gemini_key");
                          }}
                          className="px-3 sm:px-4 font-bold text-sm border border-red-500 text-red-600 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                          {t.removeKey}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Links Section */}
              <div
                className={box}
                style={{
                  background: cardBg,
                  borderColor: cardBorder,
                  boxShadow,
                }}
              >
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setSecondaryTab("history")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] min-h-[44px]"
                    style={{
                      background: inputBg,
                      border: `1px solid ${cardBorder}`,
                    }}
                  >
                    <HistoryIcon
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: accent }}
                    />
                    <span
                      className="text-sm font-bold"
                      style={{ color: textColor }}
                    >
                      {lang === "mm" ? "မှတ်တမ်း" : "History"}
                    </span>
                  </button>
                  <button
                    onClick={() => setSecondaryTab("plan")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] min-h-[44px]"
                    style={{
                      background: inputBg,
                      border: `1px solid ${cardBorder}`,
                    }}
                  >
                    <Star
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: accent }}
                    />
                    <span
                      className="text-sm font-bold"
                      style={{ color: textColor }}
                    >
                      Plan
                    </span>
                  </button>
                  <button
                    onClick={() => setSecondaryTab("guide")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] min-h-[44px]"
                    style={{
                      background: inputBg,
                      border: `1px solid ${cardBorder}`,
                    }}
                  >
                    <BookOpen
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: accent }}
                    />
                    <span
                      className="text-sm font-bold"
                      style={{ color: textColor }}
                    >
                      {lang === "mm" ? "လမ်းညွှန်" : "Guide"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* === HISTORY TAB === */}
          {secondaryTab === "history" && (
            <div className="max-w-3xl mx-auto py-2 sm:py-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center mb-6">
                <h2
                  className="text-2xl sm:text-3xl font-black uppercase tracking-widest mb-2"
                  style={{ color: accent }}
                >
                  {lang === "mm" ? "အသုံးပြုမှတ်တမ်း" : "Usage History"}
                </h2>
                <p
                  className="text-xs sm:text-sm"
                  style={{ color: subtextColor }}
                >
                  {lang === "mm"
                    ? "သင်၏ ဖန်တီးမှုအားလုံးကို ဤနေရာတွင် ကြည့်နိုင်ပါသည်"
                    : "View all your past generations here"}
                </p>
              </div>
              {historyLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div
                    className="w-8 h-8 border-2 rounded-full animate-spin"
                    style={{
                      borderColor: accent,
                      borderTopColor: "transparent",
                    }}
                  />
                </div>
              ) : !unifiedHistory || unifiedHistory.length === 0 ? (
                <div
                  className={box}
                  style={{
                    background: cardBg,
                    borderColor: cardBorder,
                    boxShadow,
                  }}
                >
                  <div className="text-center py-12 sm:py-16 px-4">
                    <div
                      className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                      style={{ background: accent15 }}
                    >
                      <ClockIcon
                        className="w-10 h-10"
                        style={{ color: accent }}
                      />
                    </div>
                    <h3
                      className="text-xl sm:text-2xl font-bold mb-2"
                      style={{ color: textColor }}
                    >
                      {lang === "mm" ? "မှတ်တမ်း မရှိသေးပါ" : "No history yet"}
                    </h3>
                    <p
                      className="text-sm mb-6 max-w-md mx-auto"
                      style={{ color: subtextColor, lineHeight: "1.7" }}
                    >
                      {lang === "mm"
                        ? "သင်၏ ပထမ TTS ဖန်တီးမှုကို စတင်ပါ။ စာသားရိုက်ထည့်ပြီး Generate ခလုတ်ကို နှိပ်ပါ"
                        : "Start generating your first audio! Type your text and click the Generate button."}
                    </p>
                    <button
                      onClick={() => setSecondaryTab(null)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:scale-105 hover:shadow-lg"
                      style={{
                        background: accent,
                        border: `2px solid ${accent}`,
                        color: "var(--foreground)",
                      }}
                    >
                      <Wand2 className="w-4 h-4" />
                      {lang === "mm" ? "စတင်ဖန်တီးရန်" : "Start Generating"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {unifiedHistory?.map((item: any) => {
                    const isCredit = item.origin === "credit";
                    const isTask = item.origin === "task";
                    const isError = item.status === "fail";
                    const isPositive = (item.amount || 0) > 0;
                    
                    const featureLabel = (type: string) => {
                      const labels: Record<string, string> =
                        lang === "mm"
                          ? {
                              tts: "စာမှအသံ",
                              translate_file: "ဗီဒီယိုဘာသာပြန်",
                              translate_link: "Link ဘာသာပြန်",
                              dub_file: "Auto Creator (ဖိုင်)",
                              dub_link: "Auto Creator (Link)",
                              TRIAL: "Trial Rewards",
                              GEN_AUDIO: "TTS အသံဖန်တီးမှု",
                              VIDEO_DUB: "Video Dubbing",
                              SUBSCRIPTION: "Subscription",
                              REFUND: "ပြန်အမ်းငွေ",
                            }
                          : {
                              tts: "Text to Speech",
                              translate_file: "Video Translate",
                              translate_link: "Link Translate",
                              dub_file: "Auto Creator (File)",
                              dub_link: "Auto Creator (Link)",
                              TRIAL: "Trial Credits",
                              GEN_AUDIO: "TTS Generation",
                              VIDEO_DUB: "Video Dubbing",
                              SUBSCRIPTION: "Subscription",
                              REFUND: "Refund",
                            };
                      return labels[type] || type.replace("_", " ");
                    };

                    const featureEmoji = (type: string) => {
                      if (type === "tts" || type === "GEN_AUDIO") return "🎙️";
                      if (type?.includes("translate")) return "📹";
                      if (type?.includes("dub") || type === "VIDEO_DUB") return "🎬";
                      if (type === "SUBSCRIPTION") return "👑";
                      if (type === "REFUND") return "♻️";
                      if (type === "TRIAL") return "🎁";
                      return "💰";
                    };

                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-4 rounded-2xl border transition-all hover:bg-white/5"
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                        }}
                      >
                        <div
                          className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                          style={{
                            background: isError ? "rgba(220,38,38,0.15)" : isCredit ? (isPositive ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)") : accent15,
                            color: isError ? "#ef4444" : isCredit ? (isPositive ? "#22c55e" : "#f59e0b") : accent,
                          }}
                        >
                          {featureEmoji(item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-sm sm:text-base truncate" style={{ color: textColor }}>
                              {featureLabel(item.type)}
                            </span>
                            {isCredit && (
                              <span className={`text-sm font-black whitespace-nowrap ${isPositive ? "text-green-400" : "text-amber-500"}`}>
                                {isPositive ? "+" : ""}{item.amount}
                              </span>
                            )}
                            {isTask && !isError && (
                               <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-bold uppercase tracking-wider">
                                 {lang === "mm" ? "ပြီးစီး" : "Success"}
                               </span>
                            )}
                            {isError && (
                               <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold uppercase tracking-wider">
                                 {lang === "mm" ? "မအောင်မြင်" : "Failed"}
                               </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-xs truncate opacity-60" style={{ color: subtextColor }}>
                              {item.description}
                            </p>
                            <span className="text-[10px] opacity-30 whitespace-nowrap">
                              {fmtTime(item.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* === PLAN TAB === */}
          {secondaryTab === "plan" && (
            <div className="max-w-3xl mx-auto py-2 sm:py-4 animate-in fade-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="text-center mb-8">
                <h2
                  className="text-2xl sm:text-3xl font-black uppercase tracking-widest mb-2"
                  style={{ color: accent }}
                >
                  {lang === "mm" ? "သင့် Plan" : "Your Plan"}
                </h2>
              </div>

              {/* Current Plan Card */}
              <div
                className="rounded-2xl border-2 p-6 sm:p-8 mb-6"
                style={{
                  background: `linear-gradient(135deg, ${isDark ? "rgba(192,111,48,0.15)" : "rgba(192,111,48,0.05)"}, ${cardBg})`,
                  borderColor: accent40,
                  boxShadow: boxShadow,
                }}
              >
                <div className="flex items-center justify-between mb-3 sm:mb-5">
                  <div className="flex items-center gap-3">
                    <Star
                      className="w-6 h-6"
                      style={{
                        color: currentPlan === "trial" ? "#f59e0b" : accent,
                      }}
                    />
                    <span
                      className="text-lg sm:text-xl font-black uppercase tracking-wider"
                      style={{ color: textColor }}
                    >
                      {currentPlan === "trial"
                        ? lang === "mm"
                          ? "အစမ်းသုံး Plan"
                          : "Trial Plan"
                        : currentPlan?.toUpperCase() ||
                          (lang === "mm" ? "Plan မရှိ" : "No Plan")}
                    </span>
                  </div>
                </div>

                {/* Usage Progress Bars */}
                {(() => {
                  const tu = (subStatus as any)?.trialUsage;
                  const tl = (subStatus as any)?.trialLimits;
                  const usage =
                    currentPlan === "trial" && tu && tl
                      ? [
                          {
                            label:
                              lang === "mm"
                                ? "အသံဖန်တီးမှု (Standard)"
                                : "Voice Generation (Standard)",
                            used: tu.tts || 0,
                            total: tl.totalTtsSrt || 0,
                            color: accent,
                          },
                          {
                            label:
                              lang === "mm"
                                ? "အသံပြောင်းမှု (Premium)"
                                : "Voice Change (Premium)",
                            used: tu.characterUse || 0,
                            total: tl.totalCharacterUse || 0,
                            color: "#f59e0b",
                          },
                          {
                            label:
                              lang === "mm"
                                ? "ဗီဒီယိုဘာသာပြန်"
                                : "Video Translation",
                            used: tu.videoTranslate || 0,
                            total: tl.totalVideoTranslate || 0,
                            color: "#60a5fa",
                          },
                          {
                            label:
                              lang === "mm"
                                ? "ဗီဒီယိုဖန်တီးမှု"
                                : "Video Creation",
                            used: tu.aiVideo || 0,
                            total: tl.totalAiVideo || 0,
                            color: "#4ade80",
                          },
                        ]
                      : currentPlan !== "trial" && planUsage && planLimits
                        ? [
                            {
                              label:
                                lang === "mm"
                                  ? "အသံဖန်တီးမှု"
                                  : "Voice Generation",
                              used: planUsage.tts || 0,
                              total: planLimits.dailyTtsSrt || 0,
                              color: accent,
                            },
                            {
                              label:
                                lang === "mm"
                                  ? "အသံပြောင်းမှု"
                                  : "Voice Change",
                              used: planUsage.characterUse || 0,
                              total: planLimits.dailyCharacterUse || 0,
                              color: "#f59e0b",
                            },
                            {
                              label:
                                lang === "mm"
                                  ? "ဗီဒီယိုဘာသာပြန်"
                                  : "Video Translation",
                              used: planUsage.videoTranslate || 0,
                              total: planLimits.dailyVideoTranslate || 0,
                              color: "#60a5fa",
                            },
                            {
                              label:
                                lang === "mm"
                                  ? "ဗီဒီယိုဖန်တီးမှု"
                                  : "Video Creation",
                              used: planUsage.aiVideo || 0,
                              total: planLimits.dailyAiVideo || 0,
                              color: "#4ade80",
                            },
                          ]
                        : [];
                  return (
                    <div className="space-y-4">
                      {usage.map((u, i) => (
                        <div key={i}>
                          <div className="flex justify-between mb-1.5">
                            <span
                              className="text-xs sm:text-sm font-bold"
                              style={{ color: subtextColor }}
                            >
                              {u.label}
                            </span>
                            <span
                              className="text-xs sm:text-sm font-black"
                              style={{
                                color: u.used >= u.total ? "#dc2626" : u.color,
                              }}
                            >
                              {u.used} / {u.total}
                            </span>
                          </div>
                          <div
                            className="h-2 rounded-full overflow-hidden"
                            style={{
                              background: isDark
                                ? "rgba(255,255,255,0.08)"
                                : "rgba(0,0,0,0.08)",
                            }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width:
                                  u.total > 0
                                    ? `${Math.min((u.used / u.total) * 100, 100)}%`
                                    : "0%",
                                background:
                                  u.used >= u.total ? "#dc2626" : u.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Subscription Plans */}
              <div className="mt-8">
                <h3
                  className="text-lg font-black uppercase tracking-wider mb-6 text-center"
                  style={{ color: accent }}
                >
                  {lang === "mm" ? "Plan များ" : "Plans"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[
                    {
                      name: "Starter",
                      price: "15,000 Ks",
                      credits: 50,
                      period: lang === "mm" ? "/ လ" : "/ mo",
                      features: [
                        lang === "mm"
                          ? "အသံဖန်တီးမှု ၁၅/ရက်"
                          : "15 generations/day",
                        lang === "mm" ? "စာလုံး ၂၀,၀၀၀" : "20,000 chars",
                        lang === "mm" ? "ဗီဒီယို ၃/ရက်" : "3 videos/day",
                      ],
                      color: "#60a5fa",
                      popular: false,
                    },
                    {
                      name: "Creator",
                      price: "35,000 Ks",
                      credits: 200,
                      period: lang === "mm" ? "/ လ" : "/ mo",
                      features: [
                        lang === "mm"
                          ? "အသံဖန်တီးမှု ၃၀/ရက်"
                          : "30 generations/day",
                        lang === "mm" ? "စာလုံး ၃၀,၀၀၀" : "30,000 chars",
                        lang === "mm" ? "ဗီဒီယို ၁၀/ရက်" : "10 videos/day",
                      ],
                      color: accent,
                      popular: true,
                    },
                    {
                      name: "Pro",
                      price: "75,000 Ks",
                      credits: 500,
                      period: lang === "mm" ? "/ လ" : "/ mo",
                      features: [
                        lang === "mm"
                          ? "အသံဖန်တီးမှု အကန့်အသတ်မဲ့"
                          : "Unlimited generations",
                        lang === "mm" ? "စာလုံး ၁၀၀,၀၀၀" : "100,000 chars",
                        lang === "mm" ? "ဗီဒီယို အကန့်အသတ်မဲ့" : "Unlimited videos",
                        lang === "mm"
                          ? "Premium Voices အကုန်"
                          : "All premium voices",
                      ],
                      color: accent,
                      popular: false,
                    },
                  ].map(plan => (
                    <div
                      key={plan.name}
                      className="rounded-2xl border p-5 sm:p-6 relative transition-all hover:scale-[1.02]"
                      style={{
                        background: `linear-gradient(145deg, ${cardBg}, ${isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)"})`,
                        borderColor: plan.popular ? accent : cardBorder,
                        boxShadow: plan.popular
                          ? `0 4px 16px rgba(0,0,0,0.1)`
                          : boxShadow,
                      }}
                    >
                      {plan.popular && (
                        <div
                          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                          style={{
                            background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
                            color: "#fff",
                          }}
                        >
                          {lang === "mm" ? "လူကြိုက်များ" : "Popular"}
                        </div>
                      )}
                      <h4
                        className="text-lg font-black uppercase mt-1"
                        style={{ color: plan.color }}
                      >
                        {plan.name}
                      </h4>
                      <div className="flex items-baseline gap-1 mt-2 mb-4">
                        <span
                          className="text-2xl sm:text-3xl font-black"
                          style={{ color: textColor }}
                        >
                          {plan.price}
                        </span>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: subtextColor }}
                        >
                          {plan.period}
                        </span>
                      </div>
                      <div className="space-y-2.5 mb-6">
                        {plan.features.map((f, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2.5 text-xs sm:text-sm"
                            style={{ color: subtextColor }}
                          >
                            <span
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                              style={{
                                background: plan.color + "20",
                                color: plan.color,
                              }}
                            >
                              ✓
                            </span>{" "}
                            {f}
                          </div>
                        ))}
                      </div>
                      <button
                        className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:brightness-110"
                        style={{
                          background: plan.popular
                            ? `linear-gradient(135deg, ${accent}, ${accentSecondary})`
                            : "transparent",
                          color: plan.popular ? "#fff" : accent,
                          border: plan.popular
                            ? "none"
                            : `2px solid ${accent40}`,
                        }}
                      >
                        {lang === "mm" ? "ဝယ်ယူရန်" : "Subscribe"}
                      </button>
                    </div>
                  ))}
                </div>
                <p
                  className="text-center text-xs sm:text-sm mt-6 font-semibold"
                  style={{ color: subtextColor }}
                >
                  💬{" "}
                  {lang === "mm"
                    ? "ဝယ်ယူရန် Admin ကို Telegram မှ ဆက်သွယ်ပါ"
                    : "Contact Admin via Telegram to subscribe"}
                </p>
              </div>
            </div>
          )}

          {/* === GUIDE TAB === */}
          {secondaryTab === "guide" && (
            <div className="max-w-3xl mx-auto py-2 sm:py-4 animate-in fade-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="text-center mb-8">
                <h2
                  className="text-2xl sm:text-3xl font-black uppercase tracking-widest mb-2"
                  style={{ color: accent }}
                >
                  {lang === "mm" ? "အသုံးပြုနည်း" : "How to Use"}
                </h2>
              </div>
              <div className="space-y-5">
                {/* TTS Guide */}
                <div
                  className="rounded-2xl border p-5 sm:p-7"
                  style={{
                    background: cardBg,
                    borderColor: cardBorder,
                    boxShadow,
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: accent15 }}
                    >
                      🎙️
                    </span>
                    <h3
                      className="text-base sm:text-lg font-black uppercase tracking-wider"
                      style={{ color: accent }}
                    >
                      {lang === "mm" ? "စာမှအသံ (TTS)" : "Text-to-Speech (TTS)"}
                    </h3>
                  </div>
                  <div className="space-y-2.5 pl-1">
                    {(lang === "mm"
                      ? [
                          '① "စာမှအသံ" tab ကို နှိပ်ပါ',
                          "② မြန်မာစာသား ထည့်ပါ",
                          "③ အသံ ရွေးပါ — Standard သို့ Premium Voice",
                          "④ Speed နှင့် Pitch လိုအပ်ရင် ချိန်ညှိပါ",
                          "⑤ SRT Subtitle ရလိုရင် Aspect Ratio ရွေးပါ",
                          '⑥ "ဖန်တီးမည်" နှိပ်ပါ',
                          "⑦ MP3 နှင့် SRT ကို Download ယူပါ",
                        ]
                      : [
                          '① Click the "TTS" tab',
                          "② Enter your Myanmar text",
                          "③ Select a voice — Standard or Premium",
                          "④ Adjust Speed and Pitch if needed",
                          "⑤ Choose SRT Aspect Ratio if you want subtitles",
                          '⑥ Click "Generate"',
                          "⑦ Download your MP3 and SRT files",
                        ]
                    ).map((step, i) => (
                      <p
                        key={i}
                        className="text-xs sm:text-sm leading-relaxed"
                        style={{ color: textColor }}
                      >
                        {step}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Video Translate Guide */}
                <div
                  className="rounded-2xl border p-5 sm:p-7"
                  style={{
                    background: cardBg,
                    borderColor: cardBorder,
                    boxShadow,
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: "#60a5fa15" }}
                    >
                      📹
                    </span>
                    <h3
                      className="text-base sm:text-lg font-black uppercase tracking-wider"
                      style={{ color: accent }}
                    >
                      {lang === "mm" ? "ဗီဒီယိုဘာသာပြန်" : "Video Translation"}
                    </h3>
                  </div>
                  <div className="space-y-2.5 pl-1">
                    {(lang === "mm"
                      ? [
                          '① "ဗီဒီယိုဘာသာပြန်" tab ကို နှိပ်ပါ',
                          "② ဗီဒီယိုဖိုင် တင်ပါ (25MB အောက်) သို့ Link ထည့်ပါ",
                          '③ "မြန်မာဘာသာပြန်မည်" နှိပ်ပါ',
                          "④ Wait...",
                          "⑤ ရလဒ်ကို ကြည့်ပါ / ကော်ပီကူးပါ",
                        ]
                      : [
                          '① Click the "Translate" tab',
                          "② Upload a video (under 25MB) or paste a link",
                          '③ Click "Translate to Myanmar"',
                          "④ Wait...",
                          "⑤ View or copy the translation result",
                        ]
                    ).map((step, i) => (
                      <p
                        key={i}
                        className="text-xs sm:text-sm leading-relaxed"
                        style={{ color: textColor }}
                      >
                        {step}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Auto Creator Guide */}
                <div
                  className="rounded-2xl border p-5 sm:p-7"
                  style={{
                    background: cardBg,
                    borderColor: cardBorder,
                    boxShadow,
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: "#4ade8015" }}
                    >
                      🎬
                    </span>
                    <h3
                      className="text-base sm:text-lg font-black uppercase tracking-wider"
                      style={{ color: accent }}
                    >
                      {lang === "mm"
                        ? "All-in-One Video Maker"
                        : "All-in-One Video Maker"}
                    </h3>
                  </div>
                  <div className="space-y-2.5 pl-1">
                    {(lang === "mm"
                      ? [
                          '① "Auto Creator" tab ကို နှိပ်ပါ',
                          "② ဗီဒီယိုဖိုင် တင်ပါ (25MB အောက်) သို့ Link ထည့်ပါ",
                          '③ ဗီဒီယို Preview ကြည့်ပြီး "ဆက်လုပ်မည်" နှိပ်ပါ',
                          "④ အသံ ရွေးပါ — Standard သို့ Premium Voice",
                          "⑤ Speed / Pitch ချိန်ညှိပါ",
                          "⑥ စာတန်းထိုး ဆက်တင် ရွေးပါ",
                          '⑦ "ဖန်တီးမည်" နှိပ်ပါ (၃-၅ မိနစ် ကြာနိုင်)',
                          "⑧ ရလဒ်ဗီဒီယိုကို Download ယူပါ",
                        ]
                      : [
                          '① Click the "Auto Creator" tab',
                          "② Upload a video (under 25MB) or paste a link",
                          '③ Preview and click "Continue"',
                          "④ Select a voice — Standard or Premium",
                          "⑤ Adjust Speed / Pitch",
                          "⑥ Configure subtitle settings",
                          '⑦ Click "Generate" (may take 3-5 minutes)',
                          "⑧ Download the final video",
                        ]
                    ).map((step, i) => (
                      <p
                        key={i}
                        className="text-xs sm:text-sm leading-relaxed"
                        style={{ color: textColor }}
                      >
                        {step}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Tips */}
                <div
                  className="rounded-2xl border p-5 sm:p-7"
                  style={{
                    background: `linear-gradient(135deg, ${isDark ? "rgba(245,158,11,0.05)" : "rgba(245,158,11,0.03)"}, ${cardBg})`,
                    borderColor: "#f59e0b30",
                    boxShadow,
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: "#f59e0b15" }}
                    >
                      💡
                    </span>
                    <h3
                      className="text-base sm:text-lg font-black uppercase tracking-wider"
                      style={{ color: "#f59e0b" }}
                    >
                      {lang === "mm" ? "Tips" : "Tips"}
                    </h3>
                  </div>
                  <div className="space-y-2.5 pl-1">
                    {(lang === "mm"
                      ? [
                          "• Standard Voice — စာလုံး ၂၀,၀၀၀ အထိ ရိုက်နိုင်",
                          "• Premium Voice — စာလုံး ၁,၆၀၀ အထိ ရိုက်နိုင်",
                          "• ဗီဒီယို အများဆုံး 25MB အထိ တင်နိုင်",
                          "• YouTube, TikTok, Facebook Link များ သုံးနိုင်",
                          "• ပြဿနာ ရှိပါက Admin ကို Telegram မှ ဆက်သွယ်ပါ",
                        ]
                      : [
                          "• Standard Voice — up to 20,000 characters",
                          "• Premium Voice — up to 1,600 characters",
                          "• Max video upload: 25MB",
                          "• Supported: YouTube, TikTok, Facebook links",
                          "• Contact Admin via Telegram for support",
                        ]
                    ).map((tip, i) => (
                      <p
                        key={i}
                        className="text-xs sm:text-sm leading-relaxed"
                        style={{ color: subtextColor }}
                      >
                        {tip}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </TTSGeneratorLayout>
  );
}
// rebuild trigger 1776026701
// dev branch 1776027867
