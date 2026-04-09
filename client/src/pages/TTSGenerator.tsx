import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Slider } from "@/components/ui/slider";
import { Loader2, Download, Volume2, LogOut, Crown, AlertCircle, Mic, FileVideo, Settings, Sparkles, Upload, Sun, Moon, Copy, Check, Link as LinkIcon, Wand2, Clock, Info, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";

type Tab = "tts" | "video" | "dubbing" | "settings" | "history" | "plan" | "guide";
type Theme = "dark" | "light";
type Lang = "mm" | "en";

// ─── User-friendly error messages ─────────────
function friendlyError(raw: string): string {
  if (!raw) return "တစ်ခုခုမှားယွင်းနေပါသည်။ ထပ်ကြိုးစားပါ။";
  // Common backend errors → user-friendly Myanmar messages
  if (raw.includes("Subscription expired")) return "သင့် Subscription သက်တမ်းကုန်ဆုံးသွားပါပြီ။ Admin ကို ဆက်သွယ်ပါ။";
  if (raw.includes("Please login")) return "ကျေးဇူးပြု၍ Login ဝင်ပါ။";
  if (raw.includes("banned")) return "သင့် Account ကို ပိတ်ထားပါသည်။ Admin ကို ဆက်သွယ်ပါ။";
  if (raw.includes("File too large") || raw.includes("Max 25MB")) return "ဖိုင်အကြီးလွန်ပါသည်။ အများဆုံး 25MB အထိသာ တင်နိုင်ပါသည်။";
  if (raw.includes("Whisper could not detect")) return "ဗီဒီယိုတွင် စကားပြောသံ ရှာမတွေ့ပါ။ အသံပါသော ဗီဒီယိုကို ထပ်ကြိုးစားပါ။";
  if (raw.includes("MURF_API_KEY not configured")) return "Voice Change စနစ် ပြင်ဆင်ဆဲဖြစ်ပါသည်။ Standard Voice ကို သုံးပါ။";
  if (raw.includes("yt-dlp") || raw.includes("download") || raw.includes("ဒေါင်းလုတ်မရပါ")) return "ဗီဒီယို Link ကို ဒေါင်းလုတ်မရပါ။ Link ကို စစ်ပြီး ထပ်ကြိုးစားပါ။";
  if (raw.includes("Command failed") || raw.includes("/tmp/") || raw.includes("/root/")) return "လုပ်ဆောင်မှု မအောင်မြင်ပါ။ ခဏစောင့်ပြီး ထပ်ကြိုးစားပါ။";
  if (raw.includes("Too many login")) return "Login ကြိုးစားမှု များလွန်ပါသည်။ ၁ မိနစ်စောင့်ပြီး ထပ်ကြိုးစားပါ။";
  if (raw.includes("Invalid code")) return "Code မှားနေပါသည်။ Telegram Bot မှ Code အသစ်ယူပါ။";
  if (raw.includes("No active subscription")) return "Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။";
  if (raw.includes("Database") || raw.includes("DB")) return "စနစ် ယာယီ ချို့ယွင်းနေပါသည်။ ခဏစောင့်ပြီး ထပ်ကြိုးစားပါ။";
  if (raw.includes("Invalid text")) return "စာသား ထည့်ပါ။";
  if (raw.includes("Failed to generate audio")) return "အသံ ဖန်တီး၍ မရပါ။ ထပ်ကြိုးစားပါ။";
  // If it's already Myanmar text, return as is
  if (/[\u1000-\u109F]/.test(raw)) return raw;
  // Generic fallback
  return "တစ်ခုခု မှားယွင်းနေပါသည်။ ထပ်ကြိုးစားပါ။";
}

const T = {
  mm: {
    appName: "LUMIX",
    tabs: { tts: "စာမှအသံ", video: "ဗီဒီယိုဘာသာပြန်", dubbing: "AI Video", settings: "ဆက်တင်", history: "မှတ်တမ်း", plan: "Plan", guide: "လမ်းညွှန်" },
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
    videoLimit: "အများဆုံး ၂၅MB (သို့) YouTube/TikTok Link",
    dropVideo: "ဗီဒီယိုဖိုင် ဤနေရာတွင်ချပါ သို့မဟုတ် နှိပ်ပါ",
    linkInputLabel: "VIDEO LINK ထည့်ရန်",
    linkPlaceholder: "https://youtube.com/...",
    orLine: "သို့မဟုတ်",
    translateBtn: "မြန်မာဘာသာပြန်မည်",
    translating: "ဘာသာပြန်နေသည်... (၁-၃ မိနစ် ကြာနိုင်)",
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
    tabs: { tts: "TTS", video: "Translate", dubbing: "AI Video", settings: "Settings", history: "History", plan: "Plan", guide: "Guide" },
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
    videoLimit: "Max 25MB or YouTube/TikTok Link",
    dropVideo: "Drop video here or click to upload",
    linkInputLabel: "VIDEO LINK",
    linkPlaceholder: "https://youtube.com/...",
    orLine: "OR",
    translateBtn: "Translate to Myanmar",
    translating: "Processing... (may take 1-3 minutes)",
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
  }
};

export default function TTSGenerator() {
  const [tab, setTab] = useState<Tab>("tts");
  const [theme, setTheme] = useState<Theme>("dark");
  const [lang, setLang] = useState<Lang>("mm");
  const t = T[lang];

  // Error toast state
  const [errorToast, setErrorToast] = useState("");
  const showError = (msg: string) => {
    setErrorToast(friendlyError(msg));
    setTimeout(() => setErrorToast(""), 5000);
  };

  const [text, setText] = useState("");
  const [voice, setVoice] = useState<"thiha" | "nilar">("thiha");
  const [character, setCharacter] = useState<string>("");
  const [voiceMode, setVoiceMode] = useState<"standard" | "character">("standard");
  const [tone, setTone] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("16:9");
  const [generatedFiles, setGeneratedFiles] = useState<{ audioObjectUrl: string; srtContent: string; durationMs: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // === VIDEO TAB STATE ===
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [videoResult, setVideoResult] = useState<{ myanmarText: string; srtContent?: string } | null>(null);
  const [editedVideoText, setEditedVideoText] = useState("");
  const [videoCopied, setVideoCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // === DUBBING TAB STATE (fully independent) ===
  const [dubVideoFile, setDubVideoFile] = useState<File | null>(null);
  const [dubVideoUrl, setDubVideoUrl] = useState<string>("");
  const [dubDragOver, setDubDragOver] = useState(false);
  const [dubResult, setDubResult] = useState<{ videoBase64: string; myanmarText: string; srtContent: string; durationMs: number } | null>(null);
  const [dubEditedText, setDubEditedText] = useState("");
  const [dubCopied, setDubCopied] = useState(false);
  const dubFileRef = useRef<HTMLInputElement>(null);
  const dubResultVideoRef = useRef<HTMLVideoElement>(null);

  // Dubbing wizard state
  const [dubPreviewUrl, setDubPreviewUrl] = useState<string>("");
  const dubPreviewRef = useRef<HTMLVideoElement>(null);
  const [dubDetectedRatio, setDubDetectedRatio] = useState<"9:16" | "16:9">("16:9");
  const [dubVoice, setDubVoice] = useState<"thiha" | "nilar">("thiha");
  const [dubCharacter, setDubCharacter] = useState<string>("");
  const [dubVoiceMode, setDubVoiceMode] = useState<"standard" | "character">("standard");
  const [dubSpeed, setDubSpeed] = useState(1.0);
  const [dubPitch, setDubPitch] = useState(0);

  // Dubbing SRT overlay settings
  const [srtEnabled, setSrtEnabled] = useState(true);
  const [srtFontSize, setSrtFontSize] = useState(24);
  const [srtColor, setSrtColor] = useState("#ffffff");
  const [srtDropShadow, setSrtDropShadow] = useState(true);
  const [srtBlurBg, setSrtBlurBg] = useState(true);
  const [srtMarginV, setSrtMarginV] = useState(30);
  const [srtBlurSize, setSrtBlurSize] = useState(8);
  const [srtBlurColor, setSrtBlurColor] = useState<"black" | "white">("black");
  const [srtFullWidth, setSrtFullWidth] = useState(false);
  const [srtBorderRadius, setSrtBorderRadius] = useState<"rounded" | "square">("rounded");
  const [srtBoxPadding, setSrtBoxPadding] = useState(8); // Blur box height/padding in px

  // Accordion state for mobile-friendly collapsible sections
  const [voiceAccordionOpen, setVoiceAccordionOpen] = useState(true);
  const [speedAccordionOpen, setSpeedAccordionOpen] = useState(false);
  const [srtAccordionOpen, setSrtAccordionOpen] = useState(false);

  const [geminiKey, setGeminiKey] = useState("");
  const [savedKey, setSavedKey] = useState(() => localStorage.getItem("gemini_key") || "");

  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: subStatus, isLoading: subLoading } = trpc.subscription.myStatus.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: () => { window.location.href = "/login"; } });
  const generateMutation = trpc.tts.generateAudio.useMutation();
  const translateMutation = trpc.video.translate.useMutation();
  const translateLinkMutation = trpc.video.translateLink.useMutation();
  // Separate mutations for dubbing tab
  const dubFileMutation = trpc.video.dubFile.useMutation();
  const dubLinkMutation = trpc.video.dubLink.useMutation();

  const isAdmin = me?.role === "admin";
  const hasActiveSub = isAdmin || subStatus?.active;
  const hasPlan = isAdmin || !!subStatus?.plan; // user has trial or subscription
  const planLimits = subStatus?.limits;
  const planUsage = subStatus?.usage;
  const currentPlan = subStatus?.plan;

  // Compute character limit for current voice mode
  const currentCharLimit = isAdmin ? 99999 : (voiceMode === "character" ? (planLimits?.charLimitCharacter ?? 0) : (planLimits?.charLimitStandard ?? 0));

  const daysLeft = subStatus?.expiresAt
    ? Math.max(0, Math.ceil((new Date(subStatus.expiresAt).getTime() - Date.now()) / 86400000))
    : null;

  // --- PREMIUM UI COLORS ---
  const isDark = theme === "dark";
  
  // Premium colors - light theme uses deep indigo/violet that's readable
  const accent = isDark ? "oklch(0.65 0.25 310)" : "#6d28d9"; 
  const accentSecondary = isDark ? "oklch(0.6 0.28 280)" : "#4c1d95"; 
  const subColor = isAdmin ? accent : daysLeft === null ? accent : daysLeft > 14 ? "#16a34a" : daysLeft > 4 ? "#ea580c" : "#dc2626";

  // Light theme: clean white/slate, Dark: cyberpunk gradient
  const bgGradient = isDark
    ? "linear-gradient(135deg, #0F0C29 0%, #302B63 50%, #24243E 100%)"
    : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)";

  // Card backgrounds
  const cardBg = isDark ? "rgba(15, 12, 41, 0.6)" : "rgba(255, 255, 255, 0.85)";
  const cardBorder = isDark ? "rgba(167, 139, 250, 0.2)" : "rgba(109, 40, 217, 0.15)";
  const textColor = isDark ? "#F0EEFF" : "#1e1b4b";
  const subtextColor = isDark ? "rgba(240,238,255,0.6)" : "#475569";
  const labelBg = isDark ? "#1f1b3e" : "#ffffff";
  const inputBg = isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.9)";
  const inputBorder = isDark ? "rgba(167,139,250,0.2)" : "rgba(109, 40, 217, 0.2)";

  const box = "relative border p-4 md:p-5 pt-8 backdrop-blur-xl transition-all duration-300 rounded-2xl mt-6";
  const boxShadow = isDark ? "0 8px 32px rgba(0,0,0,0.2)" : "0 4px 24px rgba(109, 40, 217, 0.08)";
  const labelStyle = "absolute -top-3.5 left-4 px-3 py-1 text-xs uppercase tracking-widest font-black rounded-lg z-10 shadow-sm border";

  const handleGenerate = async () => {
    if (!text.trim()) return;
    try {
      const result = await generateMutation.mutateAsync({ text, voice, tone, speed, aspectRatio, character: voiceMode === "character" ? character : undefined });
      if (result.success) {
        const binary = atob(result.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: result.mimeType });
        const audioObjectUrl = URL.createObjectURL(blob);
        setGeneratedFiles({ audioObjectUrl, srtContent: result.srtContent, durationMs: result.durationMs });
        setTimeout(() => { if (audioRef.current) { audioRef.current.src = audioObjectUrl; audioRef.current.load(); } }, 100);
        // Refresh usage counters
        utils.subscription.myStatus.invalidate();
      }
    } catch (e: any) { showError(e?.message || "Failed"); }
  };

  const handleVideoFile = (f: File) => {
    if (f.size > 25 * 1024 * 1024) { showError("File too large. Max 25MB."); return; }
    setVideoFile(f);
    setVideoUrl("");
    setVideoResult(null);
  };

  const handleTranslate = async () => {
    if (videoUrl.trim()) {
      try {
        const res = await translateLinkMutation.mutateAsync({ url: videoUrl.trim() });
        if (res.success) {
            setVideoResult({ myanmarText: res.myanmarText, srtContent: res.srtContent });
            setEditedVideoText(res.myanmarText);
            utils.subscription.myStatus.invalidate();
        }
      } catch (e: any) { showError(e?.message || "Link Translation failed"); }
      return;
    }

    if (!videoFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await translateMutation.mutateAsync({ videoBase64: base64, filename: videoFile.name });
        if (res.success) {
            setVideoResult({ myanmarText: res.myanmarText, srtContent: res.srtContent });
            setEditedVideoText(res.myanmarText);
            utils.subscription.myStatus.invalidate();
        }
      } catch (e: any) { showError(e?.message || "Translation failed"); }
    };
    reader.readAsDataURL(videoFile);
  };

  const handleVideoCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedVideoText);
      setVideoCopied(true);
      setTimeout(() => setVideoCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleVideoReset = () => {
    setVideoFile(null);
    setVideoUrl("");
    setVideoResult(null);
    setEditedVideoText("");
  };

  // Video download from URL (for video tab)
  const handleVideoDownloadFromUrl = async () => {
    if (!videoUrl.trim()) return;
    // Open in new tab to let browser handle download
    window.open(videoUrl.trim(), "_blank");
  };

  // === DUBBING TAB HANDLERS (fully independent) ===
  const handleDubVideoFile = (f: File) => {
    if (f.size > 25 * 1024 * 1024) { showError("File too large. Max 25MB."); return; }
    setDubVideoFile(f);
    setDubVideoUrl("");
    setDubResult(null);
  };

  const handleDubGenerate = async () => {
    const dubOpts = {
      voice: dubVoiceMode === "standard" ? dubVoice : (CHARACTER_VOICES_MAP[dubCharacter]?.base || dubVoice) as "thiha" | "nilar",
      character: dubVoiceMode === "character" ? dubCharacter : undefined,
      speed: dubSpeed,
      pitch: dubPitch,
      srtEnabled,
      srtFontSize,
      srtColor,
      srtDropShadow,
      srtBlurBg,
      srtMarginV,
      srtBlurSize,
      srtBlurColor,
      srtFullWidth,
      srtBorderRadius,
    };

    if (dubVideoUrl.trim()) {
      try {
        const res = await dubLinkMutation.mutateAsync({ url: dubVideoUrl.trim(), ...dubOpts });
        if (res.success) {
          setDubResult({ videoBase64: res.videoBase64, myanmarText: res.myanmarText, srtContent: res.srtContent, durationMs: res.durationMs });
          setDubEditedText(res.myanmarText);
          utils.subscription.myStatus.invalidate();
        }
      } catch (e: any) { showError(e?.message || "Dubbing failed"); }
      return;
    }

    if (!dubVideoFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await dubFileMutation.mutateAsync({ videoBase64: base64, filename: dubVideoFile.name, ...dubOpts });
        if (res.success) {
          setDubResult({ videoBase64: res.videoBase64, myanmarText: res.myanmarText, srtContent: res.srtContent, durationMs: res.durationMs });
          setDubEditedText(res.myanmarText);
          utils.subscription.myStatus.invalidate();
        }
      } catch (e: any) { showError(e?.message || "Dubbing failed"); }
    };
    reader.readAsDataURL(dubVideoFile);
  };

  const handleDubCopy = async () => {
    try {
      await navigator.clipboard.writeText(dubEditedText);
      setDubCopied(true);
      setTimeout(() => setDubCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const handleDubDownload = () => {
    if (!dubResult?.videoBase64) return;
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
  };

  const handleDubPreview = () => {
    if (dubVideoFile) {
      const url = URL.createObjectURL(dubVideoFile);
      setDubPreviewUrl(url);
    } else if (dubVideoUrl.trim()) {
      setDubPreviewUrl(dubVideoUrl.trim());
    }
  };

  const handleDubReset = () => {
    if (dubPreviewUrl && dubVideoFile) {
      URL.revokeObjectURL(dubPreviewUrl);
    }
    setDubVideoFile(null);
    setDubVideoUrl("");
    setDubResult(null);
    setDubEditedText("");
    setDubPreviewUrl("");
    setDubDetectedRatio("16:9");
  };

  // Character voice base mapping (for sending correct base voice)
  const CHARACTER_VOICES_MAP: Record<string, { base: string }> = {
    ryan: { base: "thiha" }, ronnie: { base: "thiha" }, lucas: { base: "thiha" },
    daniel: { base: "thiha" }, evander: { base: "thiha" },
    michelle: { base: "nilar" }, iris: { base: "nilar" }, charlotte: { base: "nilar" }, amara: { base: "nilar" },
  };

  // Thailand time formatter → now real user timezone
  const thaiTime = () => {
    const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Date().toLocaleString("en-US", {
      timeZone: userTZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      day: "2-digit",
      month: "short",
    });
  };

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-500 font-sans" style={{ background: bgGradient, color: textColor }}>
      {/* Error Toast */}
      {errorToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 max-w-[90vw]">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border" style={{
            background: isDark ? "rgba(220,38,38,0.9)" : "#fef2f2",
            borderColor: isDark ? "rgba(248,113,113,0.5)" : "#fecaca",
            color: isDark ? "#fff" : "#991b1b",
            backdropFilter: "blur(12px)",
          }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-bold">{errorToast}</span>
            <button onClick={() => setErrorToast("")} className="ml-2 opacity-60 hover:opacity-100 text-lg">×</button>
          </div>
        </div>
      )}

      {/* Subtle Grid Background */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDark ? 0.05 : 0.15 }}>
        <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(0deg, transparent 24%, ${isDark ? '#66ccff' : '#6d28d9'} 25%, ${isDark ? '#66ccff' : '#6d28d9'} 26%, transparent 27%, transparent 74%, ${isDark ? '#66ccff' : '#6d28d9'} 75%, ${isDark ? '#66ccff' : '#6d28d9'} 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, ${isDark ? '#66ccff' : '#6d28d9'} 25%, ${isDark ? '#66ccff' : '#6d28d9'} 26%, transparent 27%, transparent 74%, ${isDark ? '#66ccff' : '#6d28d9'} 75%, ${isDark ? '#66ccff' : '#6d28d9'} 76%, transparent 77%, transparent)`, backgroundSize: '50px 50px' }} />
      </div>

      {/* TOP NAVIGATION */}
      <div className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-3 border-b backdrop-blur-xl" style={{ borderColor: cardBorder, background: isDark ? 'rgba(15,12,41,0.8)' : 'rgba(255,255,255,0.85)' }}>
        <div className="flex items-center gap-2">
          <span className="font-black uppercase tracking-widest text-base sm:text-lg" style={{ color: accent, textShadow: isDark ? `0 0 10px ${accent}` : 'none' }}>{t.appName}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-1 text-xs font-bold" style={{ color: subColor }}>
            {hasActiveSub ? <Crown className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{isAdmin ? t.admin : subStatus?.active && daysLeft !== null ? `${subStatus.plan === 'trial' ? (lang === 'mm' ? 'အစမ်းသုံး' : 'Trial') : subStatus.plan} · ${daysLeft} ${t.daysLeft}` : subStatus?.active ? subStatus.plan : (me ? (lang === 'mm' ? 'Subscription မရှိ' : t.noSub) : t.noSub)}</span>
          </div>
          {/* Username display */}
          <span className="hidden md:inline text-xs font-bold" style={{ color: accent }}>@{(me as any)?.username || me?.name}</span>
          <div className="flex items-center gap-1 sm:gap-2 border-l pl-2 sm:pl-3 ml-1" style={{ borderColor: cardBorder }}>
            <button onClick={() => setLang(lang === "mm" ? "en" : "mm")} className="px-2 py-1 text-xs font-bold rounded border transition-colors uppercase" style={{ borderColor: cardBorder, background: cardBg, color: textColor }}>{lang === "mm" ? "EN" : "MM"}</button>
            <button onClick={() => setTheme(isDark ? "light" : "dark")} className="p-1.5 rounded border transition-colors flex items-center justify-center" style={{ borderColor: cardBorder, background: cardBg, color: textColor }}>{isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
            <button onClick={() => logoutMutation.mutate()} className="flex items-center gap-1 text-xs px-2 sm:px-3 py-1.5 border border-red-500/50 text-red-500 hover:bg-red-500/10 rounded transition-all font-bold uppercase"><LogOut className="w-3 h-3" /> <span className="hidden sm:inline">{t.logout}</span></button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="relative z-10 flex gap-1 px-2 sm:px-4 pt-2 sm:pt-3 border-b overflow-x-auto scrollbar-hide" style={{ borderColor: cardBorder, background: isDark ? 'rgba(15,12,41,0.5)' : 'rgba(255,255,255,0.5)' }}>
        {([{ id: "tts" as Tab, label: t.tabs.tts, icon: <Mic className="w-3.5 h-3.5" /> }, { id: "video" as Tab, label: t.tabs.video, icon: <FileVideo className="w-3.5 h-3.5" /> }, { id: "dubbing" as Tab, label: t.tabs.dubbing, icon: <Wand2 className="w-3.5 h-3.5" /> }, { id: "history" as Tab, label: t.tabs.history, icon: <Clock className="w-3.5 h-3.5" /> }, { id: "plan" as Tab, label: t.tabs.plan, icon: <Crown className="w-3.5 h-3.5" /> }, { id: "guide" as Tab, label: t.tabs.guide, icon: <Info className="w-3.5 h-3.5" /> }, { id: "settings" as Tab, label: t.tabs.settings, icon: <Settings className="w-3.5 h-3.5" /> }]).map(({ id, label: lbl, icon }) => (
          <button key={id} onClick={() => setTab(id)} className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all border-b-2 rounded-t-xl whitespace-nowrap" style={{ borderColor: tab === id ? accent : 'transparent', color: tab === id ? accent : subtextColor, background: tab === id ? cardBg : 'transparent' }}>{icon} {lbl}</button>
        ))}
      </div>

      <div className="relative z-10 px-3 sm:px-4 py-6 sm:py-8 md:py-10 max-w-7xl mx-auto">

        {/* === TTS TAB === */}
        {tab === "tts" && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="mb-4 sm:mb-6 relative text-center py-2">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-wider sm:tracking-widest mb-2" style={{ textShadow: isDark ? `0 0 20px ${accent}, 0 0 40px ${accent}` : 'none', color: accent }}>TTS Generator</h1>
              <p className="text-xs sm:text-sm font-bold uppercase tracking-wider opacity-80 mt-1" style={{ color: subtextColor }}>Convert Text to Speech</p>
              {/* Plan Usage Banner */}
              {!isAdmin && hasPlan && planLimits && planUsage && (
                <div className="mt-3 mx-auto max-w-lg flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: isDark ? 'rgba(167,139,250,0.1)' : 'rgba(109,40,217,0.06)', border: `1px solid ${cardBorder}` }}>
                  <span className="px-2 py-0.5 rounded-lg" style={{ background: currentPlan === 'trial' ? '#f59e0b' : '#16a34a', color: '#fff' }}>{currentPlan === 'trial' ? (lang === 'mm' ? 'အစမ်းသုံး' : 'TRIAL') : (currentPlan?.toUpperCase() ?? 'SUB')}</span>
                  {currentPlan === 'trial' && (subStatus as any)?.trialUsage && (subStatus as any)?.trialLimits ? (
                    <>
                      <span style={{ color: subtextColor }}>TTS: <b style={{ color: (subStatus as any).trialUsage.tts >= (subStatus as any).trialLimits.totalTtsSrt ? '#dc2626' : accent }}>{(subStatus as any).trialUsage.tts}/{(subStatus as any).trialLimits.totalTtsSrt}</b></span>
                      <span style={{ color: subtextColor }}>VC: <b style={{ color: (subStatus as any).trialUsage.characterUse >= (subStatus as any).trialLimits.totalCharacterUse ? '#dc2626' : accent }}>{(subStatus as any).trialUsage.characterUse}/{(subStatus as any).trialLimits.totalCharacterUse}</b></span>
                      <span style={{ color: subtextColor }}>{lang === 'mm' ? 'စာလုံး' : 'Chars'}: <b style={{ color: accent }}>{voiceMode === 'character' ? (subStatus as any).trialLimits.charLimitCharacter.toLocaleString() : (subStatus as any).trialLimits.charLimitStandard.toLocaleString()}</b></span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: subtextColor }}>TTS: <b style={{ color: planUsage.tts >= planLimits.dailyTtsSrt ? '#dc2626' : accent }}>{planUsage.tts}/{planLimits.dailyTtsSrt}</b></span>
                      <span style={{ color: subtextColor }}>VC: <b style={{ color: planUsage.characterUse >= planLimits.dailyCharacterUse ? '#dc2626' : accent }}>{planUsage.characterUse}/{planLimits.dailyCharacterUse}</b></span>
                      <span style={{ color: subtextColor }}>{lang === 'mm' ? 'စာလုံး' : 'Chars'}: <b style={{ color: accent }}>{currentCharLimit.toLocaleString()}</b></span>
                    </>
                  )}
                </div>
              )}
              {/* No Plan Banner */}
              {!isAdmin && !hasPlan && me && (
                <div className="mt-3 mx-auto max-w-lg flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold" style={{ background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626' }}>
                  <AlertCircle className="w-4 h-4" />
                  {lang === 'mm' ? 'Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။' : 'No active subscription. Contact Admin.'}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
              <div className="lg:col-span-2 space-y-2">
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.inputText}</div>
                  <textarea value={text} onChange={e => { if (!isAdmin && e.target.value.length > currentCharLimit) return; setText(e.target.value); }} placeholder={t.inputPlaceholder} disabled={!hasPlan} className="w-full h-28 sm:h-32 md:h-40 p-3 sm:p-4 border rounded-xl focus:outline-none focus:ring-2 resize-none disabled:opacity-50 transition-colors text-sm leading-relaxed" style={{ background: inputBg, borderColor: inputBorder, color: textColor }} />
                  <div className="mt-2 flex items-center justify-between text-xs font-semibold" style={{ color: subtextColor }}>
                    <span>
                      {!isAdmin && hasPlan && planUsage && planLimits && (
                        <span style={{ color: voiceMode === "character" ? (planUsage.characterUse >= planLimits.dailyCharacterUse ? "#dc2626" : subtextColor) : (planUsage.tts >= planLimits.dailyTtsSrt ? "#dc2626" : subtextColor) }}>
                          {lang === "mm" ? "ယနေ့" : "Today"}: {voiceMode === "character" ? `${planUsage.characterUse}/${planLimits.dailyCharacterUse}` : `${planUsage.tts}/${planLimits.dailyTtsSrt}`} {lang === "mm" ? "ကြိမ်" : "uses"}
                        </span>
                      )}
                    </span>
                    <span style={{ color: !isAdmin && text.length > currentCharLimit * 0.9 ? "#dc2626" : subtextColor }}>
                      {text.length}{!isAdmin && hasPlan ? ` / ${currentCharLimit.toLocaleString()}` : ""}
                    </span>
                  </div>
                </div>
                
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.voiceSelection}</div>
                  <div className="space-y-4 sm:space-y-5">
                    {[{ label: t.male, voices: [{ id: "thiha", name: "သီဟ", isStd: true }, { id: "ryan", name: "ရဲရင့်", isStd: false }, { id: "ronnie", name: "ရောင်နီ", isStd: false }, { id: "lucas", name: "လင်းခန့်", isStd: false }, { id: "daniel", name: "ဒေဝ", isStd: false }, { id: "evander", name: "အဂ္ဂ", isStd: false }]}, { label: t.female, voices: [{ id: "nilar", name: "နီလာ", isStd: true }, { id: "michelle", name: "မေချို", isStd: false }, { id: "iris", name: "အိန္ဒြာ", isStd: false }, { id: "charlotte", name: "သီရိ", isStd: false }, { id: "amara", name: "အမရာ", isStd: false }]}].map(({ label: grpLabel, voices }) => (
                      <div key={grpLabel}><p className="text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3" style={{ color: subtextColor }}>{grpLabel}</p><div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">{voices.map(v => { const isSelected = v.isStd ? voiceMode === "standard" && voice === (v.id === "thiha" ? "thiha" : "nilar") : voiceMode === "character" && character === v.id; return (<button key={v.id} disabled={!hasPlan} onClick={() => { if (v.isStd) { setVoiceMode("standard"); setVoice(v.id as any); setCharacter(""); } else { setVoiceMode("character"); setCharacter(v.id); } }} className="py-2 sm:py-2.5 px-2 sm:px-3 border rounded-xl text-xs sm:text-sm font-bold transition-all disabled:opacity-40" style={{ borderColor: isSelected ? accent : cardBorder, background: isSelected ? (isDark ? 'rgba(167,139,250,0.2)' : 'rgba(109,40,217,0.08)') : 'transparent', color: isSelected ? accent : textColor, boxShadow: isSelected && isDark ? `0 0 15px rgba(167,139,250,0.3)` : (isSelected && !isDark ? '0 4px 12px rgba(109,40,217,0.15)' : 'none') }}>{v.name}</button>); })}</div></div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {[{ label: t.tone, value: tone, setValue: setTone, min: -20, max: 20, step: 1, display: `${tone > 0 ? "+" : ""}${tone} Hz`, leftLabel: t.lower, rightLabel: t.higher }, { label: t.speed, value: speed, setValue: setSpeed, min: 0.5, max: 2.0, step: 0.1, display: `${speed.toFixed(1)}x`, leftLabel: t.slower, rightLabel: t.faster }].map(({ label: lbl, value, setValue, min, max, step, display, leftLabel, rightLabel }) => (
                    <div key={lbl} className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}><div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{lbl}</div><div className="mt-2"><Slider value={[value]} onValueChange={v => setValue(v[0])} min={min} max={max} step={step} disabled={!hasPlan} className="w-full" /><div className="flex justify-between items-center text-xs font-bold mt-3 sm:mt-4"><span style={{ color: subtextColor }}>{leftLabel}</span><span style={{ color: accent }}>{display}</span><span style={{ color: subtextColor }}>{rightLabel}</span></div></div></div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow, position: "sticky", top: "20px" }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.aspectRatio}</div>
                  <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6 mt-1">{(['9:16', '16:9'] as const).map(ratio => (<button key={ratio} onClick={() => setAspectRatio(ratio)} disabled={!hasPlan} className="py-2.5 sm:py-3 border rounded-xl font-black uppercase transition-all disabled:opacity-40" style={{ borderColor: aspectRatio === ratio ? accent : cardBorder, background: aspectRatio === ratio ? (isDark ? 'rgba(167,139,250,0.15)' : 'rgba(109,40,217,0.06)') : 'transparent', color: aspectRatio === ratio ? accent : textColor, boxShadow: aspectRatio === ratio && !isDark ? '0 4px 12px rgba(109,40,217,0.15)' : 'none' }}>{ratio}</button>))}</div>
                  
                  <button onClick={handleGenerate} disabled={generateMutation.isPending || !text.trim() || !hasPlan || (!isAdmin && text.length > currentCharLimit)} className="w-full flex items-center justify-center gap-2 py-3.5 sm:py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] shadow-lg text-sm sm:text-base" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px rgba(109,40,217,0.25)` }}>{generateMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin" />{t.generating}</> : <><Volume2 className="w-5 h-5" />{t.generate}</>}</button>
                  
                  {generatedFiles && (<div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t" style={{ borderColor: cardBorder }}><p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: subtextColor }}>{t.preview} {generatedFiles.durationMs > 0 && `(${Math.floor(generatedFiles.durationMs / 1000 / 60)}:${String(Math.floor(generatedFiles.durationMs / 1000) % 60).padStart(2, "0")})`}</p><audio ref={audioRef} controls className="w-full mb-4 rounded-xl" style={{ accentColor: accent }} /><div className="space-y-3"><button onClick={() => { const a = document.createElement("a"); a.href = generatedFiles.audioObjectUrl; a.download = `Myanmar_TTS_${Date.now()}.mp3`; a.click(); }} className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border font-bold text-sm transition-colors" style={{ borderColor: accent, color: accent, background: isDark ? 'rgba(167,139,250,0.1)' : 'rgba(109,40,217,0.05)' }}><Download className="w-4 h-4" /> MP3 Audio</button><button onClick={() => downloadFile(generatedFiles.srtContent, `Myanmar_TTS_${aspectRatio.replace(":", "x")}_${Date.now()}.srt`)} className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border font-bold text-sm transition-colors" style={{ borderColor: accentSecondary, color: accentSecondary, background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(76,29,149,0.05)' }}><Download className="w-4 h-4" /> SRT ({aspectRatio})</button></div></div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === VIDEO TAB — Simple Translation === */}
        {tab === "video" && (
          <div className="max-w-xl mx-auto animate-in fade-in zoom-in-95 duration-300 space-y-4">
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider sm:tracking-widest mb-2 leading-normal" style={{ textShadow: isDark ? `0 0 20px ${accent}` : 'none', color: accent }}>{t.videoTitle}</h2>
              <p className="font-bold tracking-wider text-xs sm:text-sm mt-1" style={{ color: subtextColor }}>{t.videoDesc}</p>
              <p className="text-xs mt-1" style={{ color: subtextColor }}>{t.videoLimit}</p>
              {/* Video Translation Usage Banner */}
              {!isAdmin && hasPlan && planLimits && planUsage && (
                <div className="mt-3 mx-auto max-w-md flex items-center justify-center gap-3 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: isDark ? 'rgba(167,139,250,0.1)' : 'rgba(109,40,217,0.06)', border: `1px solid ${cardBorder}` }}>
                  <span className="px-2 py-0.5 rounded-lg" style={{ background: currentPlan === 'trial' ? '#f59e0b' : '#16a34a', color: '#fff' }}>{currentPlan === 'trial' ? (lang === 'mm' ? 'အစမ်းသုံး' : 'TRIAL') : (currentPlan?.toUpperCase() ?? 'SUB')}</span>
                  <span style={{ color: planUsage.videoTranslate >= planLimits.dailyVideoTranslate ? '#dc2626' : subtextColor }}>{lang === 'mm' ? 'ယနေ့' : 'Today'}: <b style={{ color: planUsage.videoTranslate >= planLimits.dailyVideoTranslate ? '#dc2626' : accent }}>{planUsage.videoTranslate}/{planLimits.dailyVideoTranslate}</b> {lang === 'mm' ? 'ကြိမ်' : 'uses'}</span>
                </div>
              )}
              {!isAdmin && !hasPlan && me && (
                <div className="mt-3 mx-auto max-w-md flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold" style={{ background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626' }}>
                  <AlertCircle className="w-4 h-4" />
                  {lang === 'mm' ? 'Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။' : 'No subscription. Contact Admin.'}
                </div>
              )}
            </div>

            {!videoResult && (
              <>
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.linkInputLabel}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <LinkIcon className="w-5 h-5 flex-shrink-0" style={{ color: subtextColor }} />
                    <input type="text" value={videoUrl} onChange={(e) => { setVideoUrl(e.target.value); if (e.target.value) setVideoFile(null); }} placeholder={t.linkPlaceholder} className="flex-1 bg-transparent border-b-2 py-2 focus:outline-none transition-colors text-sm min-w-0" style={{ borderColor: videoUrl ? accent : inputBorder, color: textColor }} />
                  </div>
                  {/* Video Download from Link */}
                  {videoUrl.trim() && (
                    <button onClick={handleVideoDownloadFromUrl} className="flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 border" style={{ borderColor: accent, color: accent, background: isDark ? 'rgba(167,139,250,0.1)' : 'rgba(109,40,217,0.05)' }}>
                      <Download className="w-3.5 h-3.5" /> {t.downloadVideo}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-center gap-4 my-2" style={{ color: subtextColor }}>
                  <div className="h-px w-16 sm:w-20" style={{ background: isDark ? textColor : '#94a3b8' }}></div><span className="text-xs font-bold uppercase tracking-widest">{t.orLine}</span><div className="h-px w-16 sm:w-20" style={{ background: isDark ? textColor : '#94a3b8' }}></div>
                </div>

                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>Upload</div>
                  <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleVideoFile(e.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()} className="border-2 border-dashed py-6 sm:py-8 px-4 rounded-xl text-center cursor-pointer transition-all mt-1" style={{ borderColor: dragOver ? accent : videoFile ? "#16a34a" : inputBorder, background: dragOver ? (isDark ? 'rgba(167,139,250,0.1)' : 'rgba(109,40,217,0.05)') : inputBg, opacity: videoUrl ? 0.4 : 1 }}>
                    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleVideoFile(e.target.files[0]); }} />
                    {videoFile ? (<><FileVideo className="w-8 h-8 mx-auto mb-2 text-green-600" /><p className="font-bold text-green-600 text-sm">{videoFile.name}</p><p className="text-xs font-semibold mt-1" style={{ color: subtextColor }}>{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p></>) : (<><Upload className="w-8 h-8 mx-auto mb-2" style={{ color: subtextColor }} /><p className="font-bold text-sm" style={{ color: subtextColor }}>{t.dropVideo}</p><p className="text-xs font-semibold mt-2" style={{ color: subtextColor }}>MP4, MOV, AVI, MKV</p></>)}
                  </div>
                </div>

                {(videoFile || videoUrl) && (
                  <button onClick={handleTranslate} disabled={translateMutation.isPending || translateLinkMutation.isPending} className="w-full flex items-center justify-center gap-2 py-3.5 sm:py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all disabled:opacity-50 hover:scale-[1.02] mt-4 shadow-lg text-sm sm:text-base" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px rgba(109,40,217,0.25)` }}>
                    {(translateMutation.isPending || translateLinkMutation.isPending) ? <><Loader2 className="w-5 h-5 animate-spin" />{t.translating}</> : <><Sparkles className="w-5 h-5" />{t.translateBtn}</>}
                  </button>
                )}

                {(translateMutation.isPending || translateLinkMutation.isPending) && (
                  <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                    <div className="flex items-center justify-center gap-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent }} />
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent, animationDelay: "0.3s" }} />
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent, animationDelay: "0.6s" }} />
                      </div>
                      <span className="text-sm font-bold" style={{ color: subtextColor }}>{t.translating}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {videoResult && (
              <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.result}</div>
                <div className="space-y-4 mt-2">
                  <div className="flex justify-end">
                    <button onClick={handleVideoCopy}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all hover:scale-105"
                      style={{ background: videoCopied ? "#4ade80" : accent, color: videoCopied ? "#000" : "#fff" }}>
                      {videoCopied ? <><Check className="w-4 h-4" /> {t.copied}</> : <><Copy className="w-4 h-4" /> {t.copyText}</>}
                    </button>
                  </div>
                  <textarea
                    value={editedVideoText}
                    onChange={e => setEditedVideoText(e.target.value)}
                    className="w-full min-h-[200px] sm:min-h-[250px] p-4 sm:p-5 rounded-xl border focus:outline-none focus:ring-2 resize-y text-sm font-sans"
                    style={{ background: inputBg, borderColor: inputBorder, color: textColor, lineHeight: "2.2" }}
                  />
                  <button onClick={handleVideoReset} className="w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-colors hover:opacity-100 opacity-70" style={{ borderColor: cardBorder, color: subtextColor }}>{t.translateAnother}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === DUBBING TAB — AI Auto Video Maker === */}
        {tab === "dubbing" && (
          <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300 space-y-4">
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wider sm:tracking-widest mb-2 leading-normal" style={{ textShadow: isDark ? `0 0 20px ${accent}` : 'none', color: accent }}>
                {lang === "mm" ? "AI Auto Video Maker" : "AI Auto Video Maker"}
              </h2>
              <p className="font-bold tracking-wider text-xs sm:text-sm mt-1" style={{ color: subtextColor }}>
                {lang === "mm" ? "AI ဖြင့် Video ဖန်တီးခြင်း" : "Create dubbed videos with AI"}
              </p>
              {/* AI Video Usage Banner */}
              {!isAdmin && hasPlan && planLimits && planUsage && (
                <div className="mt-3 mx-auto max-w-md flex items-center justify-center gap-3 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: isDark ? 'rgba(167,139,250,0.1)' : 'rgba(109,40,217,0.06)', border: `1px solid ${cardBorder}` }}>
                  <span className="px-2 py-0.5 rounded-lg" style={{ background: currentPlan === 'trial' ? '#f59e0b' : '#16a34a', color: '#fff' }}>{currentPlan === 'trial' ? (lang === 'mm' ? 'အစမ်းသုံး' : 'TRIAL') : (currentPlan?.toUpperCase() ?? 'SUB')}</span>
                  <span style={{ color: planUsage.aiVideo >= planLimits.dailyAiVideo ? '#dc2626' : subtextColor }}>{lang === 'mm' ? 'ယနေ့' : 'Today'}: <b style={{ color: planUsage.aiVideo >= planLimits.dailyAiVideo ? '#dc2626' : accent }}>{planUsage.aiVideo}/{planLimits.dailyAiVideo}</b> {lang === 'mm' ? 'ကြိမ်' : 'uses'}</span>
                </div>
              )}
              {!isAdmin && !hasPlan && me && (
                <div className="mt-3 mx-auto max-w-md flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold" style={{ background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626' }}>
                  <AlertCircle className="w-4 h-4" />
                  {lang === 'mm' ? 'Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။' : 'No subscription. Contact Admin.'}
                </div>
              )}
            </div>

            {/* ── STEP: Video Input ── */}
            {!dubPreviewUrl && !dubResult && (
              <>
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.linkInputLabel}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <LinkIcon className="w-5 h-5 flex-shrink-0" style={{ color: subtextColor }} />
                    <input type="text" value={dubVideoUrl} onChange={(e) => { setDubVideoUrl(e.target.value); if (e.target.value) setDubVideoFile(null); }} placeholder={t.linkPlaceholder} className="flex-1 bg-transparent border-b-2 py-2 focus:outline-none transition-colors text-sm min-w-0" style={{ borderColor: dubVideoUrl ? accent : inputBorder, color: textColor }} />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 my-2" style={{ color: subtextColor }}>
                  <div className="h-px w-16 sm:w-20" style={{ background: isDark ? textColor : '#94a3b8' }}></div><span className="text-xs font-bold uppercase tracking-widest">{t.orLine}</span><div className="h-px w-16 sm:w-20" style={{ background: isDark ? textColor : '#94a3b8' }}></div>
                </div>

                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>Upload</div>
                  <div onDragOver={e => { e.preventDefault(); setDubDragOver(true); }} onDragLeave={() => setDubDragOver(false)} onDrop={e => { e.preventDefault(); setDubDragOver(false); if (e.dataTransfer.files[0]) handleDubVideoFile(e.dataTransfer.files[0]); }} onClick={() => dubFileRef.current?.click()} className="border-2 border-dashed py-6 sm:py-8 px-4 rounded-xl text-center cursor-pointer transition-all mt-1" style={{ borderColor: dubDragOver ? accent : dubVideoFile ? "#16a34a" : inputBorder, background: dubDragOver ? (isDark ? 'rgba(167,139,250,0.1)' : 'rgba(109,40,217,0.05)') : inputBg, opacity: dubVideoUrl ? 0.4 : 1 }}>
                    <input ref={dubFileRef} type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleDubVideoFile(e.target.files[0]); }} />
                    {dubVideoFile ? (<><FileVideo className="w-8 h-8 mx-auto mb-2 text-green-600" /><p className="font-bold text-green-600 text-sm">{dubVideoFile.name}</p><p className="text-xs font-semibold mt-1" style={{ color: subtextColor }}>{(dubVideoFile.size / 1024 / 1024).toFixed(1)} MB</p></>) : (<><Upload className="w-8 h-8 mx-auto mb-2" style={{ color: subtextColor }} /><p className="font-bold text-sm" style={{ color: subtextColor }}>{t.dropVideo}</p><p className="text-xs font-semibold mt-2" style={{ color: subtextColor }}>MP4, MOV, AVI, MKV</p></>)}
                  </div>
                </div>

                {(dubVideoFile || dubVideoUrl) && (
                  <button onClick={handleDubPreview} className="w-full flex items-center justify-center gap-2 py-3.5 sm:py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all hover:scale-[1.02] mt-4 shadow-lg text-sm sm:text-base" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px rgba(109,40,217,0.25)` }}>
                    <FileVideo className="w-5 h-5" /> {lang === "mm" ? "ဗီဒီယိုကြိုကြည့်ရန်" : "Preview Video"}
                  </button>
                )}
              </>
            )}

            {/* ── STEP: Video Preview + Settings ── */}
            {dubPreviewUrl && !dubResult && (
              <>
                {/* Video Preview — STICKY on scroll */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow, position: "sticky", top: "8px", zIndex: 20 }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{lang === "mm" ? "ဗီဒီယိုကြိုကြည့်" : "Video Preview"}</div>
                  <div className="flex justify-center mt-2">
                    <div style={{
                      width: dubDetectedRatio === "9:16" ? "200px" : "100%",
                      maxWidth: dubDetectedRatio === "9:16" ? "200px" : "100%",
                      aspectRatio: dubDetectedRatio === "9:16" ? "9/16" : "16/9",
                      position: "relative",
                      overflow: "hidden",
                      borderRadius: "12px",
                    }}>
                      <video
                        ref={dubPreviewRef}
                        src={dubPreviewUrl}
                        controls
                        className="w-full h-full"
                        style={{ objectFit: "cover", borderRadius: "12px" }}
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          const w = v.videoWidth;
                          const h = v.videoHeight;
                          if (h > w) setDubDetectedRatio("9:16");
                          else setDubDetectedRatio("16:9");
                        }}
                      />
                      {srtEnabled && (
                        <div className="absolute left-0 right-0 flex justify-center pointer-events-none"
                          style={{
                            zIndex: 10,
                            top: `${Math.max(2, Math.round(78 - (srtMarginV / 200) * 76))}%`,
                            transition: "top 0.2s ease-out",
                          }}>
                          <div style={{
                            padding: srtFullWidth ? `${srtBoxPadding}px 0` : `${srtBoxPadding}px ${srtBoxPadding + 10}px`,
                            borderRadius: srtFullWidth ? "0" : (srtBorderRadius === "rounded" ? "12px" : "4px"),
                            fontSize: `${Math.max(10, Math.min(srtFontSize, 22))}px`,
                            color: srtColor,
                            textShadow: srtDropShadow ? "2px 2px 4px rgba(0,0,0,0.8)" : "none",
                            background: srtBlurBg ? (srtBlurColor === "black" ? `rgba(0,0,0,${Math.min(0.85, srtBlurSize * 0.06)})` : `rgba(255,255,255,${Math.min(0.85, srtBlurSize * 0.06)})`) : "transparent",
                            backdropFilter: srtBlurBg ? `blur(${srtBlurSize}px)` : "none",
                            textAlign: "center",
                            width: srtFullWidth ? "100%" : "auto",
                            maxWidth: srtFullWidth ? "100%" : "90%",
                            transition: "all 0.2s ease-out",
                          }}>
                            {lang === "mm" ? "မြန်မာ စာတန်း နမူနာ" : "Subtitle Preview"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-3 text-xs" style={{ color: subtextColor }}>
                    <span className="px-2 py-1 rounded-lg border font-bold" style={{ borderColor: cardBorder }}>{dubDetectedRatio}</span>
                    <span>{lang === "mm" ? "အချိုး" : "Aspect Ratio"}</span>
                  </div>
                </div>

                {/* ── ACCORDION: Voice Selection ── */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <button onClick={() => setVoiceAccordionOpen(!voiceAccordionOpen)} className="w-full flex items-center justify-between" style={{ marginTop: "-4px" }}>
                    <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.voiceSelection}</div>
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${voiceAccordionOpen ? "rotate-180" : ""}`} style={{ color: accent }} />
                  </button>
                  {voiceAccordionOpen && (
                    <div className="space-y-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      {[{ label: t.male, voices: [{ id: "thiha", name: "သီဟ", isStd: true }, { id: "ryan", name: "ရဲရင့်", isStd: false }, { id: "ronnie", name: "ရောင်နီ", isStd: false }, { id: "lucas", name: "လင်းခန့်", isStd: false }, { id: "daniel", name: "ဒေဝ", isStd: false }, { id: "evander", name: "အဂ္ဂ", isStd: false }]}, { label: t.female, voices: [{ id: "nilar", name: "နီလာ", isStd: true }, { id: "michelle", name: "မေချို", isStd: false }, { id: "iris", name: "အိန္ဒြာ", isStd: false }, { id: "charlotte", name: "သီရိ", isStd: false }, { id: "amara", name: "အမရာ", isStd: false }]}].map(({ label: grpLabel, voices }) => (
                        <div key={grpLabel}><p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: subtextColor }}>{grpLabel}</p><div className="grid grid-cols-3 gap-2">{voices.map(v => { const isSelected = v.isStd ? dubVoiceMode === "standard" && dubVoice === (v.id === "thiha" ? "thiha" : "nilar") : dubVoiceMode === "character" && dubCharacter === v.id; return (<button key={v.id} onClick={() => { if (v.isStd) { setDubVoiceMode("standard"); setDubVoice(v.id as any); setDubCharacter(""); } else { setDubVoiceMode("character"); setDubCharacter(v.id); } }} className="py-2 px-2 border rounded-xl text-xs font-bold transition-all" style={{ borderColor: isSelected ? accent : cardBorder, background: isSelected ? (isDark ? 'rgba(167,139,250,0.2)' : 'rgba(109,40,217,0.08)') : 'transparent', color: isSelected ? accent : textColor, boxShadow: isSelected && isDark ? `0 0 12px rgba(167,139,250,0.3)` : 'none' }}>{v.name}</button>); })}</div></div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── ACCORDION: Speed & Pitch ── */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <button onClick={() => setSpeedAccordionOpen(!speedAccordionOpen)} className="w-full flex items-center justify-between" style={{ marginTop: "-4px" }}>
                    <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{lang === "mm" ? "အမြန်နှုန်း / အသံနိမ့်မြင့်" : "Speed / Pitch"}</div>
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${speedAccordionOpen ? "rotate-180" : ""}`} style={{ color: accent }} />
                  </button>
                  {speedAccordionOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: subtextColor }}>{t.speed}</p>
                        <Slider value={[dubSpeed]} onValueChange={v => setDubSpeed(v[0])} min={0.5} max={2.0} step={0.1} className="w-full" />
                        <div className="flex justify-between items-center text-xs font-bold mt-3"><span style={{ color: subtextColor }}>{t.slower}</span><span style={{ color: accent }}>{dubSpeed.toFixed(1)}x</span><span style={{ color: subtextColor }}>{t.faster}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: subtextColor }}>{t.tone}</p>
                        <Slider value={[dubPitch]} onValueChange={v => setDubPitch(v[0])} min={-20} max={20} step={1} className="w-full" />
                        <div className="flex justify-between items-center text-xs font-bold mt-3"><span style={{ color: subtextColor }}>{t.lower}</span><span style={{ color: accent }}>{dubPitch > 0 ? "+" : ""}{dubPitch} Hz</span><span style={{ color: subtextColor }}>{t.higher}</span></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── ACCORDION: SRT Settings ── */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <button onClick={() => setSrtAccordionOpen(!srtAccordionOpen)} className="w-full flex items-center justify-between" style={{ marginTop: "-4px" }}>
                    <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{lang === "mm" ? "စာတန်းထိုး ဆက်တင်" : "Subtitle Settings"}</div>
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${srtAccordionOpen ? "rotate-180" : ""}`} style={{ color: accent }} />
                  </button>
                  {srtAccordionOpen && (
                  <div className="space-y-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-bold text-sm">{lang === "mm" ? "စာတန်းထိုး ပြမည်" : "Show Subtitles"}</p>
                        <p className="text-xs mt-0.5" style={{ color: subtextColor }}>{lang === "mm" ? "SRT စာတန်းထိုး ဖွင့်/ပိတ်" : "Toggle subtitle on/off"}</p>
                      </div>
                      <button onClick={() => setSrtEnabled(!srtEnabled)}
                        className="relative w-14 h-7 rounded-full transition-all"
                        style={{ background: srtEnabled ? accent : (isDark ? "rgba(255,255,255,0.15)" : "#d1d5db") }}>
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${srtEnabled ? "left-8" : "left-1"}`} />
                      </button>
                    </div>

                    {srtEnabled && (
                      <div className="space-y-4 pt-3 border-t" style={{ borderColor: cardBorder }}>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: subtextColor }}>{lang === "mm" ? "စာအရွယ်အစား" : "Text Size"}</p>
                          <div className="flex items-center gap-3">
                            <Slider value={[srtFontSize]} onValueChange={v => setSrtFontSize(v[0])} min={12} max={48} step={2} className="flex-1" />
                            <span className="text-sm font-black min-w-[40px] text-right" style={{ color: accent }}>{srtFontSize}px</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: subtextColor }}>{lang === "mm" ? "စာအရောင်" : "Text Color"}</p>
                          <div className="flex gap-2 flex-wrap">
                            {["#ffffff", "#facc15", "#4ade80", "#60a5fa", "#f472b6", "#c084fc", "#fb923c", "#f87171"].map(c => (
                              <button key={c} onClick={() => setSrtColor(c)}
                                className="w-8 h-8 rounded-lg border-2 transition-all hover:scale-110"
                                style={{ background: c, borderColor: srtColor === c ? accent : "transparent", boxShadow: srtColor === c ? `0 0 10px ${c}` : "none" }} />
                            ))}
                            <div className="relative">
                              <input type="color" value={srtColor} onChange={e => setSrtColor(e.target.value)}
                                className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0" style={{ background: "transparent" }} />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: subtextColor }}>{lang === "mm" ? "အရိပ်ထည့်မည်" : "Drop Shadow"}</p>
                          <button onClick={() => setSrtDropShadow(!srtDropShadow)}
                            className="relative w-11 h-6 rounded-full transition-all"
                            style={{ background: srtDropShadow ? accent : (isDark ? "rgba(255,255,255,0.15)" : "#d1d5db") }}>
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${srtDropShadow ? "left-5" : "left-0.5"}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: subtextColor }}>{lang === "mm" ? "နောက်ခံ ဘောက်စ်" : "Background Box"}</p>
                          <button onClick={() => setSrtBlurBg(!srtBlurBg)}
                            className="relative w-11 h-6 rounded-full transition-all"
                            style={{ background: srtBlurBg ? accent : (isDark ? "rgba(255,255,255,0.15)" : "#d1d5db") }}>
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${srtBlurBg ? "left-5" : "left-0.5"}`} />
                          </button>
                        </div>

                        {srtBlurBg && (
                          <div className="space-y-4 pl-2 border-l-2" style={{ borderColor: `${accent}40` }}>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: subtextColor }}>{lang === "mm" ? "ဘောက်စ် အရောင်" : "Box Color"}</p>
                              <div className="flex gap-2">
                                <button onClick={() => setSrtBlurColor("black")}
                                  className="flex-1 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all"
                                  style={{ borderColor: srtBlurColor === "black" ? accent : cardBorder, background: srtBlurColor === "black" ? (isDark ? "rgba(167,139,250,0.15)" : "rgba(109,40,217,0.08)") : "transparent", color: textColor }}>
                                  ⬛ {lang === "mm" ? "အမဲ" : "Black"}
                                </button>
                                <button onClick={() => setSrtBlurColor("white")}
                                  className="flex-1 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all"
                                  style={{ borderColor: srtBlurColor === "white" ? accent : cardBorder, background: srtBlurColor === "white" ? (isDark ? "rgba(167,139,250,0.15)" : "rgba(109,40,217,0.08)") : "transparent", color: textColor }}>
                                  ⬜ {lang === "mm" ? "အဖြူ" : "White"}
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: subtextColor }}>{lang === "mm" ? "ဝါးအဆင့်" : "Blur Intensity"}</p>
                              <div className="flex items-center gap-3">
                                <Slider value={[srtBlurSize]} onValueChange={v => setSrtBlurSize(v[0])} min={1} max={20} step={1} className="flex-1" />
                                <span className="text-sm font-black min-w-[40px] text-right" style={{ color: accent }}>{srtBlurSize}px</span>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: subtextColor }}>{lang === "mm" ? "ဘောက်စ် အမြင့်" : "Box Height"}</p>
                              <div className="flex items-center gap-3">
                                <Slider value={[srtBoxPadding]} onValueChange={v => setSrtBoxPadding(v[0])} min={2} max={30} step={1} className="flex-1" />
                                <span className="text-sm font-black min-w-[40px] text-right" style={{ color: accent }}>{srtBoxPadding}px</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between py-1">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: subtextColor }}>{lang === "mm" ? "ဘေးဘောင်အပြည့်" : "Full Width Bar"}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: subtextColor }}>{lang === "mm" ? "ဘေးတိုက် အစွန်ထိ ပြည့်အောင်" : "Edge to edge"}</p>
                              </div>
                              <button onClick={() => setSrtFullWidth(!srtFullWidth)}
                                className="relative w-11 h-6 rounded-full transition-all"
                                style={{ background: srtFullWidth ? accent : (isDark ? "rgba(255,255,255,0.15)" : "#d1d5db") }}>
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${srtFullWidth ? "left-5" : "left-0.5"}`} />
                              </button>
                            </div>

                            {!srtFullWidth && (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: subtextColor }}>{lang === "mm" ? "ထောင့် ပုံစံ" : "Corner Style"}</p>
                                <div className="flex gap-2">
                                  <button onClick={() => setSrtBorderRadius("rounded")}
                                    className="flex-1 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all"
                                    style={{ borderColor: srtBorderRadius === "rounded" ? accent : cardBorder, background: srtBorderRadius === "rounded" ? (isDark ? "rgba(167,139,250,0.15)" : "rgba(109,40,217,0.08)") : "transparent", color: textColor }}>
                                    ◉ {lang === "mm" ? "အဝိုင်း" : "Rounded"}
                                  </button>
                                  <button onClick={() => setSrtBorderRadius("square")}
                                    className="flex-1 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all"
                                    style={{ borderColor: srtBorderRadius === "square" ? accent : cardBorder, background: srtBorderRadius === "square" ? (isDark ? "rgba(167,139,250,0.15)" : "rgba(109,40,217,0.08)") : "transparent", color: textColor }}>
                                    ◻ {lang === "mm" ? "လေးထောင့်" : "Square"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: subtextColor }}>{lang === "mm" ? "စာတန်း အနေအထား" : "Subtitle Position"}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] opacity-50">{lang === "mm" ? "အောက်" : "Bottom"}</span>
                            <Slider value={[srtMarginV]} onValueChange={v => setSrtMarginV(v[0])} min={5} max={200} step={5} className="flex-1" />
                            <span className="text-[10px] opacity-50">{lang === "mm" ? "အထက်" : "Top"}</span>
                          </div>
                          <p className="text-xs text-center mt-1 font-bold" style={{ color: accent }}>{lang === "mm" ? "အမြင့်" : "Position"}: {srtMarginV}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>

                {/* Generate Dubbing Button */}
                <button onClick={handleDubGenerate} disabled={dubFileMutation.isPending || dubLinkMutation.isPending} className="w-full flex items-center justify-center gap-2 py-3.5 sm:py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all disabled:opacity-50 hover:scale-[1.02] mt-2 shadow-lg text-sm sm:text-base" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px rgba(109,40,217,0.25)` }}>
                  {(dubFileMutation.isPending || dubLinkMutation.isPending) ? <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-xs sm:text-sm">{lang === "mm" ? "ဖန်တီးနေသည်... (၃-၅ မိနစ်)" : "Generating... (3-5 min)"}</span></> : <><Wand2 className="w-5 h-5" />{lang === "mm" ? "AI ဖြင့် ဖန်တီးမည်" : "Generate with AI"}</>}
                </button>

                {(dubFileMutation.isPending || dubLinkMutation.isPending) && (
                  <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                    <div className="flex flex-col items-center justify-center gap-4 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent }} />
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent, animationDelay: "0.3s" }} />
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent, animationDelay: "0.6s" }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold" style={{ color: textColor }}>{lang === "mm" ? "AI ဖြင့် ဖန်တီးနေသည်..." : "Creating with AI..."}</p>
                        <p className="text-xs mt-2" style={{ color: subtextColor }}>{lang === "mm" ? "ဗီဒီယိုအရှည်ပေါ်မူတည်ပြီး ၃-၅ မိနစ်ကြာနိုင်ပါတယ်" : "This may take 3-5 minutes"}</p>
                        <div className="flex items-center justify-center gap-4 sm:gap-6 mt-4 text-xs" style={{ color: subtextColor }}>
                          <span>🎙️ {lang === "mm" ? "အသံထုတ်နေသည်" : "Generating TTS"}</span>
                          <span>🎬 {lang === "mm" ? "ဗီဒီယိုပေါင်းနေသည်" : "Combining video"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={handleDubReset} className="w-full py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider opacity-50 hover:opacity-100 transition-all" style={{ borderColor: cardBorder, color: subtextColor }}>
                  ← {lang === "mm" ? "ဗီဒီယိုပြောင်းမည်" : "Change Video"}
                </button>
              </>
            )}

            {/* Dubbing Result — Final Video + Download */}
            {dubResult && (
              <div className="space-y-4">
                {/* Video Player */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{lang === "mm" ? "AI ဖန်တီးပြီး ဗီဒီယို" : "AI Generated Video"}</div>
                  <div className="flex justify-center mt-2">
                    <video
                      ref={dubResultVideoRef}
                      controls
                      className="w-full rounded-xl"
                      style={{ maxHeight: "480px", background: "#000" }}
                      src={(() => { try { const b = atob(dubResult.videoBase64); const arr = new Uint8Array(b.length); for(let i=0;i<b.length;i++) arr[i]=b.charCodeAt(i); return URL.createObjectURL(new Blob([arr], {type:'video/mp4'})); } catch { return `data:video/mp4;base64,${dubResult.videoBase64}`; } })()}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button onClick={handleDubDownload}
                      className="flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:scale-105 shadow-lg text-white"
                      style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px rgba(109,40,217,0.25)` }}>
                      <Download className="w-5 h-5" /> {lang === "mm" ? "MP4 ဒေါင်းလုတ်" : "Download MP4"}
                    </button>
                  </div>
                </div>

                {/* Translation Text */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{lang === "mm" ? "ဘာသာပြန်စာသား" : "Translation Text"}</div>
                  <div className="space-y-3 mt-2">
                    <div className="flex justify-end">
                      <button onClick={handleDubCopy}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all hover:scale-105"
                        style={{ background: dubCopied ? "#4ade80" : accent, color: dubCopied ? "#000" : "#fff" }}>
                        {dubCopied ? <><Check className="w-4 h-4" /> {t.copied}</> : <><Copy className="w-4 h-4" /> {t.copyText}</>}
                      </button>
                    </div>
                    <textarea
                      value={dubEditedText}
                      onChange={e => setDubEditedText(e.target.value)}
                      className="w-full min-h-[120px] sm:min-h-[150px] p-4 rounded-xl border focus:outline-none focus:ring-2 resize-y text-sm font-sans"
                      style={{ background: inputBg, borderColor: inputBorder, color: textColor, lineHeight: "2.2" }}
                    />
                  </div>
                </div>

                {/* Reset */}
                <button onClick={handleDubReset} className="w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-colors hover:opacity-100 opacity-70" style={{ borderColor: cardBorder, color: subtextColor }}>
                  {lang === "mm" ? "နောက်ထပ် ဗီဒီယိုဖန်တီးမည်" : "Create Another Video"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* === SETTINGS TAB === */}
        {tab === "settings" && (
          <div className="max-w-xl mx-auto py-4 sm:py-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-widest mb-2" style={{ color: accent }}>{t.settingsTitle}</h2>
            </div>
            <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
              <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>API Key</div>
              <div className="space-y-4 mt-2">
                <div>
                  <p className="font-bold mb-1 text-sm">{t.geminiKey}</p>
                  <p className="text-xs font-semibold mb-4" style={{ color: subtextColor }}>{t.geminiKeyDesc}</p>
                  {savedKey ? (<div className="p-3 border-2 border-green-500/40 bg-green-500/10 rounded-xl mb-4"><p className="text-xs text-green-600 font-bold mb-1">✓ {t.keyActive}</p><p className="text-xs font-mono" style={{ color: subtextColor }}>{savedKey.slice(0, 8)}{"*".repeat(15)}</p></div>) : (<div className="p-3 border border-dashed rounded-xl mb-4 text-sm font-semibold" style={{ borderColor: cardBorder, color: subtextColor }}>{t.keyNone}</div>)}
                  <div className="flex gap-2 flex-wrap">
                    <input value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder={t.geminiKeyPlaceholder} className="flex-1 min-w-0 p-3 rounded-xl border focus:outline-none focus:ring-2 font-mono text-sm transition-colors" style={{ background: inputBg, borderColor: inputBorder, color: textColor }} />
                    <button onClick={() => { if (geminiKey.trim()) { setSavedKey(geminiKey.trim()); localStorage.setItem("gemini_key", geminiKey.trim()); setGeminiKey(""); } }} className="px-4 sm:px-5 font-bold text-sm text-white rounded-xl transition-transform hover:scale-105 shadow-md" style={{ background: accent }}>{t.saveKey}</button>
                    {savedKey && (<button onClick={() => { setSavedKey(""); localStorage.removeItem("gemini_key"); }} className="px-3 sm:px-4 font-bold text-sm border border-red-500 text-red-600 hover:bg-red-500/10 rounded-xl transition-colors">{t.removeKey}</button>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === HISTORY TAB === */}
        {tab === "history" && (
          <div className="max-w-3xl mx-auto py-4 sm:py-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-widest mb-2" style={{ color: accent }}>{lang === "mm" ? "အသုံးပြုမှတ်တမ်း" : "Usage History"}</h2>
              <p className="text-xs sm:text-sm" style={{ color: subtextColor }}>{lang === "mm" ? "သင်၏ ဖန်တီးမှုအားလုံးကို ဤနေရာတွင် ကြည့်နိုင်ပါသည်" : "View all your past generations here"}</p>
            </div>
            {(() => {
              const logs = (subStatus as any)?.recentLogs || [];
              if (logs.length === 0) return (
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                  <div className="text-center py-10">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: subtextColor }} />
                    <p className="text-sm font-bold" style={{ color: subtextColor }}>{lang === "mm" ? "မှတ်တမ်း မရှိသေးပါ" : "No history yet"}</p>
                  </div>
                </div>
              );
              return (
                <div className="space-y-2">
                  {logs.map((log: any, i: number) => (
                    <div key={i} className={`${box} flex items-center gap-3`} style={{ background: cardBg, borderColor: cardBorder, boxShadow, padding: "12px 16px" }}>
                      <span className="text-lg">{log.type === "tts" ? "🎙️" : log.type === "video" ? "📹" : "🎬"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold truncate" style={{ color: textColor }}>{log.type?.toUpperCase()} — {log.voice || "-"}</p>
                        <p className="text-[10px] sm:text-xs" style={{ color: subtextColor }}>{new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.status === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{log.status === "success" ? "✓" : "✗"}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* === PLAN TAB === */}
        {tab === "plan" && (
          <div className="max-w-3xl mx-auto py-4 sm:py-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-block mb-4">
                <span className="text-5xl sm:text-6xl font-black uppercase tracking-tighter" style={{ color: accent, textShadow: `0 0 40px ${accent}60` }}>LUMIX</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-widest mb-1" style={{ color: textColor }}>{lang === "mm" ? "သင့် Plan" : "Your Plan"}</h2>
            </div>

            {/* Current Plan Card */}
            <div className="rounded-2xl border-2 p-6 sm:p-8 mb-6" style={{ background: `linear-gradient(135deg, ${isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.05)'}, ${cardBg})`, borderColor: accent + '40', boxShadow: `0 0 30px ${accent}15` }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <Crown className="w-6 h-6" style={{ color: currentPlan === 'trial' ? '#f59e0b' : accent }} />
                  <span className="text-lg sm:text-xl font-black uppercase tracking-wider" style={{ color: textColor }}>{currentPlan === 'trial' ? (lang === 'mm' ? 'အစမ်းသုံး Plan' : 'Trial Plan') : currentPlan?.toUpperCase() || (lang === 'mm' ? 'Plan မရှိ' : 'No Plan')}</span>
                </div>
                {daysLeft !== null && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-black" style={{ background: daysLeft > 4 ? '#16a34a20' : '#dc262620', color: daysLeft > 4 ? '#16a34a' : '#dc2626' }}>{daysLeft} {lang === "mm" ? "ရက်ကျန်" : "days left"}</span>
                )}
              </div>

              {/* Usage Progress Bars */}
              {(() => {
                const tu = (subStatus as any)?.trialUsage;
                const tl = (subStatus as any)?.trialLimits;
                const usage = currentPlan === 'trial' && tu && tl ? [
                  { label: lang === 'mm' ? 'အသံဖန်တီးမှု (Standard)' : 'Voice Generation (Standard)', used: tu.ttsUsed || 0, total: tl.ttsLimit || 0, color: accent },
                  { label: lang === 'mm' ? 'အသံပြောင်းမှု (Premium)' : 'Voice Change (Premium)', used: tu.characterUsed || 0, total: tl.characterLimit || 0, color: '#f59e0b' },
                  { label: lang === 'mm' ? 'ဗီဒီယိုဘာသာပြန်' : 'Video Translation', used: tu.videoUsed || 0, total: tl.videoLimit || 0, color: '#60a5fa' },
                  { label: lang === 'mm' ? 'ဗီဒီယိုဖန်တီးမှု' : 'Video Creation', used: tu.aiVideoUsed || 0, total: tl.aiVideoLimit || 0, color: '#4ade80' },
                ] : planUsage && planLimits ? [
                  { label: lang === 'mm' ? 'အသံဖန်တီးမှု' : 'Voice Generation', used: planUsage.tts, total: planLimits.dailyTtsSrt, color: accent },
                  { label: lang === 'mm' ? 'အသံပြောင်းမှု' : 'Voice Change', used: planUsage.characterUse, total: planLimits.dailyCharacterUse, color: '#f59e0b' },
                  { label: lang === 'mm' ? 'ဗီဒီယိုဘာသာပြန်' : 'Video Translation', used: planUsage.videoTranslate, total: planLimits.dailyVideoTranslate, color: '#60a5fa' },
                  { label: lang === 'mm' ? 'ဗီဒီယိုဖန်တီးမှု' : 'Video Creation', used: planUsage.aiVideo, total: planLimits.dailyAiVideo, color: '#4ade80' },
                ] : [];
                return (
                  <div className="space-y-4">
                    {usage.map((u, i) => (
                      <div key={i}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-xs sm:text-sm font-bold" style={{ color: subtextColor }}>{u.label}</span>
                          <span className="text-xs sm:text-sm font-black" style={{ color: u.used >= u.total ? '#dc2626' : u.color }}>{u.used} / {u.total}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: u.total > 0 ? `${Math.min((u.used / u.total) * 100, 100)}%` : '0%', background: u.used >= u.total ? '#dc2626' : u.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Subscription Plans */}
            <div className="mt-8">
              <h3 className="text-lg font-black uppercase tracking-wider mb-6 text-center" style={{ color: accent }}>{lang === "mm" ? "Plan များ" : "Plans"}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  { name: "Starter", price: "5,000 Ks", period: lang === "mm" ? "/ လ" : "/ mo", features: [lang === "mm" ? "အသံဖန်တီးမှု ၁၅/ရက်" : "15 generations/day", lang === "mm" ? "စာလုံး ၂၀,၀၀၀" : "20,000 chars", lang === "mm" ? "ဗီဒီယို ၃/ရက်" : "3 videos/day"], color: "#60a5fa", popular: false },
                  { name: "Pro", price: "15,000 Ks", period: lang === "mm" ? "/ လ" : "/ mo", features: [lang === "mm" ? "အသံဖန်တီးမှု ၅၀/ရက်" : "50 generations/day", lang === "mm" ? "စာလုံး ၅၀,၀၀၀" : "50,000 chars", lang === "mm" ? "ဗီဒီယို ၁၀/ရက်" : "10 videos/day", lang === "mm" ? "Premium Voices အကုန်" : "All premium voices"], color: accent, popular: true },
                  { name: "Business", price: "30,000 Ks", period: lang === "mm" ? "/ လ" : "/ mo", features: [lang === "mm" ? "အကန့်အသတ်မဲ့" : "Unlimited", lang === "mm" ? "စာလုံး ၁၀၀,၀၀၀" : "100,000 chars", lang === "mm" ? "ဗီဒီယို ၂၀/ရက်" : "20 videos/day", "Priority Support"], color: "#f59e0b", popular: false },
                  { name: "Enterprise", price: lang === "mm" ? "ညှိနှိုင်း" : "Custom", period: "", features: [lang === "mm" ? "အကုန်အကန့်အသတ်မဲ့" : "Everything unlimited", "API Access", "24/7 Support", lang === "mm" ? "စနစ်ချိတ်ဆက်မှု" : "Custom integration"], color: "#c084fc", popular: false },
                ].map(plan => (
                  <div key={plan.name} className="rounded-2xl border p-5 sm:p-6 relative transition-all hover:scale-[1.02]" style={{ background: `linear-gradient(145deg, ${cardBg}, ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'})`, borderColor: plan.popular ? accent : cardBorder, boxShadow: plan.popular ? `0 0 25px ${accent}30` : boxShadow }}>
                    {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, color: "#fff" }}>{lang === "mm" ? "လူကြိုက်များ" : "Popular"}</div>}
                    <h4 className="text-lg font-black uppercase mt-1" style={{ color: plan.color }}>{plan.name}</h4>
                    <div className="flex items-baseline gap-1 mt-2 mb-4">
                      <span className="text-2xl sm:text-3xl font-black" style={{ color: textColor }}>{plan.price}</span>
                      <span className="text-xs font-semibold" style={{ color: subtextColor }}>{plan.period}</span>
                    </div>
                    <div className="space-y-2.5 mb-6">
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-xs sm:text-sm" style={{ color: subtextColor }}>
                          <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ background: plan.color + '20', color: plan.color }}>✓</span> {f}
                        </div>
                      ))}
                    </div>
                    <button className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:brightness-110" style={{ background: plan.popular ? `linear-gradient(135deg, ${accent}, ${accentSecondary})` : 'transparent', color: plan.popular ? '#fff' : accent, border: plan.popular ? 'none' : `2px solid ${accent}40` }}>
                      {lang === "mm" ? "ဝယ်ယူရန်" : "Subscribe"}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs sm:text-sm mt-6 font-semibold" style={{ color: subtextColor }}>💬 {lang === "mm" ? "ဝယ်ယူရန် Admin ကို Telegram မှ ဆက်သွယ်ပါ" : "Contact Admin via Telegram to subscribe"}</p>
            </div>
          </div>
        )}

        {/* === GUIDE TAB === */}
        {tab === "guide" && (
          <div className="max-w-3xl mx-auto py-4 sm:py-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-block mb-4">
                <span className="text-5xl sm:text-6xl font-black uppercase tracking-tighter" style={{ color: accent, textShadow: `0 0 40px ${accent}60` }}>LUMIX</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-widest mb-1" style={{ color: textColor }}>{lang === "mm" ? "အသုံးပြုနည်း" : "How to Use"}</h2>
              <p className="text-xs sm:text-sm" style={{ color: subtextColor }}>{lang === "mm" ? "Feature တစ်ခုချင်းစီ၏ အသေးစိတ် လမ်းညွှန်ချက်" : "Step-by-step guide for every feature"}</p>
            </div>
            <div className="space-y-5">
              {/* TTS Guide */}
              <div className="rounded-2xl border p-5 sm:p-7" style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: accent + '15' }}>🎙️</span>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-wider" style={{ color: accent }}>{lang === "mm" ? "စာမှအသံ (TTS)" : "Text-to-Speech (TTS)"}</h3>
                </div>
                <div className="space-y-2.5 pl-1">
                  {(lang === "mm" ? [
                    "① \"စာမှအသံ\" tab ကို နှိပ်ပါ",
                    "② မြန်မာစာသား ထည့်ပါ",
                    "③ အသံ ရွေးပါ — Standard သို့ Premium Voice",
                    "④ Speed နှင့် Pitch လိုအပ်ရင် ချိန်ညှိပါ",
                    "⑤ SRT Subtitle ရလိုရင် Aspect Ratio ရွေးပါ",
                    "⑥ \"ဖန်တီးမည်\" နှိပ်ပါ",
                    "⑦ MP3 နှင့် SRT ကို Download ယူပါ",
                  ] : [
                    "① Click the \"TTS\" tab",
                    "② Enter your Myanmar text",
                    "③ Select a voice — Standard or Premium",
                    "④ Adjust Speed and Pitch if needed",
                    "⑤ Choose SRT Aspect Ratio if you want subtitles",
                    "⑥ Click \"Generate\"",
                    "⑦ Download your MP3 and SRT files",
                  ]).map((step, i) => (
                    <p key={i} className="text-xs sm:text-sm leading-relaxed" style={{ color: textColor }}>{step}</p>
                  ))}
                </div>
              </div>

              {/* Video Translate Guide */}
              <div className="rounded-2xl border p-5 sm:p-7" style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: '#60a5fa15' }}>📹</span>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-wider" style={{ color: accent }}>{lang === "mm" ? "ဗီဒီယိုဘာသာပြန်" : "Video Translation"}</h3>
                </div>
                <div className="space-y-2.5 pl-1">
                  {(lang === "mm" ? [
                    "① \"ဗီဒီယိုဘာသာပြန်\" tab ကို နှိပ်ပါ",
                    "② ဗီဒီယိုဖိုင် တင်ပါ (25MB အောက်) သို့ Link ထည့်ပါ",
                    "③ \"မြန်မာဘာသာပြန်မည်\" နှိပ်ပါ",
                    "④ ၁-၃ မိနစ် စောင့်ပါ",
                    "⑤ ရလဒ်ကို ကြည့်ပါ / ကော်ပီကူးပါ",
                  ] : [
                    "① Click the \"Translate\" tab",
                    "② Upload a video (under 25MB) or paste a link",
                    "③ Click \"Translate to Myanmar\"",
                    "④ Wait 1-3 minutes",
                    "⑤ View or copy the translation result",
                  ]).map((step, i) => (
                    <p key={i} className="text-xs sm:text-sm leading-relaxed" style={{ color: textColor }}>{step}</p>
                  ))}
                </div>
              </div>

              {/* AI Video Guide */}
              <div className="rounded-2xl border p-5 sm:p-7" style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: '#4ade8015' }}>🎬</span>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-wider" style={{ color: accent }}>{lang === "mm" ? "All-in-One Video Maker" : "All-in-One Video Maker"}</h3>
                </div>
                <div className="space-y-2.5 pl-1">
                  {(lang === "mm" ? [
                    "① \"AI Video\" tab ကို နှိပ်ပါ",
                    "② ဗီဒီယိုဖိုင် တင်ပါ (25MB အောက်) သို့ Link ထည့်ပါ",
                    "③ ဗီဒီယို Preview ကြည့်ပြီး \"ဆက်လုပ်မည်\" နှိပ်ပါ",
                    "④ အသံ ရွေးပါ — Standard သို့ Premium Voice",
                    "⑤ Speed / Pitch ချိန်ညှိပါ",
                    "⑥ စာတန်းထိုး ဆက်တင် ရွေးပါ",
                    "⑦ \"ဖန်တီးမည်\" နှိပ်ပါ (၃-၅ မိနစ် ကြာနိုင်)",
                    "⑧ ရလဒ်ဗီဒီယိုကို Download ယူပါ",
                  ] : [
                    "① Click the \"AI Video\" tab",
                    "② Upload a video (under 25MB) or paste a link",
                    "③ Preview and click \"Continue\"",
                    "④ Select a voice — Standard or Premium",
                    "⑤ Adjust Speed / Pitch",
                    "⑥ Configure subtitle settings",
                    "⑦ Click \"Generate\" (may take 3-5 minutes)",
                    "⑧ Download the final video",
                  ]).map((step, i) => (
                    <p key={i} className="text-xs sm:text-sm leading-relaxed" style={{ color: textColor }}>{step}</p>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="rounded-2xl border p-5 sm:p-7" style={{ background: `linear-gradient(135deg, ${isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.03)'}, ${cardBg})`, borderColor: '#f59e0b30', boxShadow }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: '#f59e0b15' }}>💡</span>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-wider" style={{ color: '#f59e0b' }}>{lang === "mm" ? "Tips" : "Tips"}</h3>
                </div>
                <div className="space-y-2.5 pl-1">
                  {(lang === "mm" ? [
                    "• Standard Voice — စာလုံး ၂၀,၀၀၀ အထိ ရိုက်နိုင်",
                    "• Premium Voice — စာလုံး ၁,၆၀၀ အထိ ရိုက်နိုင်",
                    "• ဗီဒီယို အများဆုံး 25MB အထိ တင်နိုင်",
                    "• YouTube, TikTok, Facebook Link များ သုံးနိုင်",
                    "• ပြဿနာ ရှိပါက Admin ကို Telegram မှ ဆက်သွယ်ပါ",
                  ] : [
                    "• Standard Voice — up to 20,000 characters",
                    "• Premium Voice — up to 1,600 characters",
                    "• Max video upload: 25MB",
                    "• Supported: YouTube, TikTok, Facebook links",
                    "• Contact Admin via Telegram for support",
                  ]).map((tip, i) => (
                    <p key={i} className="text-xs sm:text-sm leading-relaxed" style={{ color: subtextColor }}>{tip}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
