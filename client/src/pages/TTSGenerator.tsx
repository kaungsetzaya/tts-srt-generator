import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Slider } from "@/components/ui/slider";
import { Loader2, Download, Volume2, LogOut, Crown, AlertCircle, Mic, FileVideo, Settings, Sparkles, Upload, Sun, Moon, Copy, Check, Link as LinkIcon, Wand2 } from "lucide-react";
import { useLocation } from "wouter";

type Tab = "tts" | "video" | "dubbing" | "settings";
type Theme = "dark" | "light";
type Lang = "mm" | "en";
const ACCENT_DARK = "oklch(0.65 0.25 310)";
const ACCENT_SECONDARY_DARK = "oklch(0.6 0.28 280)";
const ACCENT_LIGHT = "#6d28d9";
const ACCENT_SECONDARY_LIGHT = "#4c1d95";

const T = {
  mm: {
    appName: "LUMIX",
    tabs: { tts: "စာမှအသံထုတ်ရန်", video: "ဗီဒီယိုဘာသာပြန်", dubbing: "AI ဖြင့် video ဖန်တီးခြင်း", settings: "ဆက်တင်" },
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
    videoDesc: "ဗီဒီယို (သို့) LINK ထည့်ပြီး မြန်မာဘာသာပြန်ရယူပါ",
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
  },
  en: {
    appName: "LUMIX",
    tabs: { tts: "TTS", video: "Video Translation", dubbing: "AI Auto Video Maker", settings: "Settings" },
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
  }
};

export default function TTSGenerator() {
  const [tab, setTab] = useState<Tab>("tts");
  const [theme, setTheme] = useState<Theme>("dark");
  const [lang, setLang] = useState<Lang>("mm");
  const t = T[lang];

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
  const [videoResult, setVideoResult] = useState<{ myanmarText: string; srtContent?: string; downloadedVideoBase64?: string } | null>(null);
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

  const [geminiKey, setGeminiKey] = useState("");
  const [savedKey, setSavedKey] = useState(() => localStorage.getItem("gemini_key") || "");

  const [, navigate] = useLocation();
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

  const daysLeft = subStatus?.expiresAt
    ? Math.max(0, Math.ceil((new Date(subStatus.expiresAt).getTime() - Date.now()) / 86400000))
    : null;

  // --- GORGEOUS PREMIUM UI COLORS ---
  const isDark = theme === "dark";
  
  // Vibrant Purples for Accents
  const accent = isDark ? ACCENT_DARK : ACCENT_LIGHT;
  const accentSecondary = isDark ? ACCENT_SECONDARY_DARK : ACCENT_SECONDARY_LIGHT;
  const subColor = isAdmin ? accent : daysLeft === null ? accent : daysLeft > 14 ? "#16a34a" : daysLeft > 4 ? "#ea580c" : "#dc2626";

  // Beautiful Pink/Purple gradient for Light, Cyberpunk for Dark
  const bgGradient = isDark
    ? "linear-gradient(135deg, #0F0C29 0%, #302B63 50%, #24243E 100%)"
    : "linear-gradient(135deg, #ede9fe 0%, #f5d0fe 100%)";

  // Frosted Glass Effect for Cards!
  const cardBg = isDark ? "rgba(15, 12, 41, 0.6)" : "rgba(255, 255, 255, 0.9)";
  const cardBorder = isDark ? "rgba(167, 139, 250, 0.2)" : "rgba(109, 40, 217, 0.2)";
  const textColor = isDark ? "#F0EEFF" : "#1f1147";
  const labelBg = isDark ? "#1f1b3e" : "#f8f5ff";
  const inputBg = isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.98)";

  const getSafeErrorMessage = (error: unknown, fallback: string): string => {
    const raw = (error as any)?.message || fallback;
    if (typeof raw !== "string") return fallback;
    if (raw.includes("/tmp/") || raw.includes("/root/") || raw.includes("Command failed:")) return fallback;
    return raw;
  };

  // Perfect padding and margins to prevent any overlapping
  const box = "relative border p-4 md:p-5 pt-8 backdrop-blur-xl transition-all duration-300 rounded-2xl mt-6 shadow-[0_8px_32px_rgba(0,0,0,0.05)]";
  const labelStyle = "absolute -top-3.5 left-4 px-3 py-1 text-xs uppercase tracking-widest font-black rounded-lg z-10 shadow-sm border-t border-l border-r";
  const ttsControls = [
    { label: t.tone, value: tone, setValue: setTone, min: -20, max: 20, step: 1, display: `${tone > 0 ? "+" : ""}${tone} Hz`, leftLabel: t.lower, rightLabel: t.higher, disabled: false },
    { label: t.speed, value: speed, setValue: setSpeed, min: 0.5, max: 2.0, step: 0.1, display: `${speed.toFixed(1)}x${speed === 1 ? " (Normal)" : ""}`, leftLabel: t.slower, rightLabel: t.faster, disabled: false },
  ] as const;

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
      }
    } catch (e: any) { alert(getSafeErrorMessage(e, "Audio generate မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။")); }
  };

  const handleVideoFile = (f: File) => {
    if (f.size > 25 * 1024 * 1024) { alert("Max 25MB"); return; }
    setVideoFile(f);
    setVideoUrl("");
    setVideoResult(null);
  };

  const handleTranslate = async () => {
    if (videoUrl.trim()) {
      try {
        const res = await translateLinkMutation.mutateAsync({ url: videoUrl.trim() });
        if (res.success) {
            setVideoResult({ myanmarText: res.myanmarText, srtContent: res.srtContent, downloadedVideoBase64: (res as any).downloadedVideoBase64 });
            setEditedVideoText(res.myanmarText);
        }
      } catch (e: any) { alert(getSafeErrorMessage(e, "Link ဘာသာပြန်မရပါ။ ထပ်မံကြိုးစားပါ။")); }
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
        }
      } catch (e: any) { alert(getSafeErrorMessage(e, "ဗီဒီယိုဘာသာပြန်မရပါ။ ထပ်မံကြိုးစားပါ။")); }
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

  // === DUBBING TAB HANDLERS (fully independent) ===
  const handleDubVideoFile = (f: File) => {
    if (f.size > 25 * 1024 * 1024) { alert("Max 25MB"); return; }
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
    };

    if (dubVideoUrl.trim()) {
      try {
        const res = await dubLinkMutation.mutateAsync({ url: dubVideoUrl.trim(), ...dubOpts });
        if (res.success) {
          setDubResult({ videoBase64: res.videoBase64, myanmarText: res.myanmarText, srtContent: res.srtContent, durationMs: res.durationMs });
          setDubEditedText(res.myanmarText);
        }
      } catch (e: any) { alert(getSafeErrorMessage(e, "AI Auto Video Maker လုပ်ဆောင်မှု မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။")); }
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
        }
      } catch (e: any) { alert(getSafeErrorMessage(e, "AI Auto Video Maker လုပ်ဆောင်မှု မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။")); }
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

  const handleSourceVideoDownload = () => {
    if (!videoResult?.downloadedVideoBase64) return;
    const binary = atob(videoResult.downloadedVideoBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Source_Video_${Date.now()}.mp4`;
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

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-500 font-sans" style={{ background: bgGradient, color: textColor }}>
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDark ? 0.05 : 0.3 }}>
        <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(0deg, transparent 24%, ${isDark ? '#66ccff' : '#ffffff'} 25%, ${isDark ? '#66ccff' : '#ffffff'} 26%, transparent 27%, transparent 74%, ${isDark ? '#66ccff' : '#ffffff'} 75%, ${isDark ? '#66ccff' : '#ffffff'} 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, ${isDark ? '#66ccff' : '#ffffff'} 25%, ${isDark ? '#66ccff' : '#ffffff'} 26%, transparent 27%, transparent 74%, ${isDark ? '#66ccff' : '#ffffff'} 75%, ${isDark ? '#66ccff' : '#ffffff'} 76%, transparent 77%, transparent)`, backgroundSize: '50px 50px' }} />
      </div>

      {/* TOP NAVIGATION */}
      <div className="relative z-10 flex items-center justify-between px-6 py-3 border-b backdrop-blur-xl" style={{ borderColor: cardBorder, background: isDark ? 'rgba(15,12,41,0.8)' : 'rgba(255,255,255,0.6)' }}>
        <span className="font-black uppercase tracking-widest text-lg" style={{ color: accent, textShadow: isDark ? `0 0 10px ${accent}` : 'none' }}>{t.appName}</span>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1 text-xs font-bold" style={{ color: subColor }}>
            {hasActiveSub ? <Crown className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{isAdmin ? t.admin : subStatus?.active && daysLeft !== null ? `${subStatus.plan} · ${daysLeft} ${t.daysLeft}` : subStatus?.active ? subStatus.plan : t.noSub}</span>
          </div>
          <span className="hidden md:inline text-xs font-bold opacity-90" style={{ color: accent, textShadow: isDark ? `0 0 10px ${accent}` : "none" }}>@{me?.username || me?.name}</span>
          <div className="flex items-center gap-2 border-l pl-3 ml-1" style={{ borderColor: cardBorder }}>
            <button onClick={() => setLang(lang === "mm" ? "en" : "mm")} className="px-2 py-1 text-xs font-bold rounded border transition-colors uppercase" style={{ borderColor: cardBorder, background: cardBg, color: textColor }}>{lang === "mm" ? "EN" : "MM"}</button>
            <button onClick={() => setTheme(isDark ? "light" : "dark")} className="p-1.5 rounded border transition-colors flex items-center justify-center" style={{ borderColor: cardBorder, background: cardBg, color: textColor }}>{isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
            <button onClick={() => logoutMutation.mutate()} className="flex items-center gap-1 text-xs px-3 py-1.5 border border-red-500/50 text-red-500 hover:bg-red-500/10 rounded transition-all font-bold uppercase"><LogOut className="w-3 h-3" /> <span className="hidden sm:inline">{t.logout}</span></button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="relative z-10 flex gap-1 sm:gap-2 px-2 sm:px-6 pt-3 sm:pt-4 border-b overflow-x-auto" style={{ borderColor: cardBorder, background: isDark ? 'rgba(15,12,41,0.5)' : 'rgba(255,255,255,0.3)' }}>
        {([{ id: "tts" as Tab, label: t.tabs.tts, icon: <Mic className="w-4 h-4" /> }, { id: "video" as Tab, label: t.tabs.video, icon: <FileVideo className="w-4 h-4" /> }, { id: "dubbing" as Tab, label: t.tabs.dubbing, icon: <Wand2 className="w-4 h-4" /> }, { id: "settings" as Tab, label: t.tabs.settings, icon: <Settings className="w-4 h-4" /> }]).map(({ id, label: lbl, icon }) => (
          <button key={id} onClick={() => setTab(id)} className="flex items-center gap-1.5 px-3 sm:px-5 py-2.5 text-[11px] sm:text-sm font-bold uppercase tracking-wide sm:tracking-widest transition-all border-b rounded-t-xl whitespace-nowrap shrink-0" style={{ borderColor: tab === id ? accent : 'transparent', color: tab === id ? accent : (isDark ? 'rgba(255,255,255,0.65)' : 'rgba(42,28,90,0.75)'), background: tab === id ? cardBg : 'transparent' }}>{icon} {lbl}</button>
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-8">

        {/* === TTS TAB === */}
        {tab === "tts" && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="mb-6 relative text-center py-2">
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-widest mb-3" style={{ textShadow: isDark ? `0 0 20px ${accent}, 0 0 40px ${accent}` : 'none', color: accent }}>TTS Generator</h1>
              <p className="text-sm md:text-base font-bold uppercase tracking-widest opacity-80 mt-2" style={{ color: accentSecondary }}>Convert Text to Speech</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <div className="lg:col-span-2 space-y-2">
                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.inputText}</div>
                  <textarea value={text} onChange={e => setText(e.target.value)} placeholder={t.inputPlaceholder} disabled={!hasActiveSub} className="w-full h-32 md:h-40 p-4 border rounded-xl focus:outline-none focus:ring-2 resize-none disabled:opacity-50 transition-colors text-sm leading-relaxed" style={{ background: inputBg, borderColor: cardBorder, color: textColor }} />
                  <div className="mt-2 text-xs text-right font-semibold opacity-60">{text.length}</div>
                </div>
                
                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.voiceSelection}</div>
                  <div className="space-y-5">
                    {[{ label: t.male, voices: [{ id: "thiha", name: "သီဟ", isStd: true }, { id: "ryan", name: "ရဲရင့်", isStd: false }, { id: "ronnie", name: "ရောင်နီ", isStd: false }, { id: "lucas", name: "လင်းခန့်", isStd: false }, { id: "daniel", name: "ဒေဝ", isStd: false }, { id: "evander", name: "အဂ္ဂ", isStd: false }]}, { label: t.female, voices: [{ id: "nilar", name: "နီလာ", isStd: true }, { id: "michelle", name: "မေချို", isStd: false }, { id: "iris", name: "အိန္ဒြာ", isStd: false }, { id: "charlotte", name: "သီရိ", isStd: false }, { id: "amara", name: "အမရာ", isStd: false }]}].map(({ label: grpLabel, voices }) => (
                      <div key={grpLabel}><p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">{grpLabel}</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{voices.map(v => { const isSelected = v.isStd ? voiceMode === "standard" && voice === (v.id === "thiha" ? "thiha" : "nilar") : voiceMode === "character" && character === v.id; return (<button key={v.id} disabled={!hasActiveSub} onClick={() => { if (v.isStd) { setVoiceMode("standard"); setVoice(v.id as any); setCharacter(""); } else { setVoiceMode("character"); setCharacter(v.id); } }} className="py-2.5 px-3 border rounded-xl text-sm font-bold transition-all disabled:opacity-40" style={{ borderColor: isSelected ? accent : cardBorder, background: isSelected ? (isDark ? 'rgba(167,139,250,0.2)' : '#ffffff') : 'transparent', color: isSelected ? accent : textColor, boxShadow: isSelected && isDark ? `0 0 15px rgba(167,139,250,0.3)` : (isSelected && !isDark ? '0 4px 12px rgba(124,58,237,0.15)' : 'none') }}>{v.name}</button>); })}</div></div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {ttsControls.map(({ label: lbl, value, setValue, min, max, step, display, leftLabel, rightLabel, disabled }) => (
                    <div key={lbl} className={box} style={{ background: cardBg, borderColor: cardBorder }}><div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{lbl}</div><div className="mt-2"><Slider value={[value]} onValueChange={v => setValue(v[0])} min={min} max={max} step={step} disabled={!hasActiveSub || disabled} className="w-full" /><div className="flex justify-between items-center text-xs font-bold mt-4"><span className="opacity-60">{leftLabel}</span><span style={{ color: accent }}>{display}</span><span className="opacity-60">{rightLabel}</span></div></div></div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className={box} style={{ background: cardBg, borderColor: cardBorder, position: "sticky", top: "20px" }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.aspectRatio} & Action</div>
                  <div className="grid grid-cols-2 gap-3 mb-6 mt-1">{(['9:16', '16:9'] as const).map(ratio => (<button key={ratio} onClick={() => setAspectRatio(ratio)} disabled={!hasActiveSub} className="py-3 border rounded-xl font-black uppercase transition-all disabled:opacity-40" style={{ borderColor: aspectRatio === ratio ? accent : cardBorder, background: aspectRatio === ratio ? (isDark ? 'rgba(167,139,250,0.15)' : '#ffffff') : 'transparent', color: aspectRatio === ratio ? accent : textColor, boxShadow: aspectRatio === ratio && !isDark ? '0 4px 12px rgba(124,58,237,0.15)' : 'none' }}>{ratio}</button>))}</div>
                  
                  <button onClick={handleGenerate} disabled={generateMutation.isPending || !text.trim() || !hasActiveSub} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] shadow-lg" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px ${accent}66` }}>{generateMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin" />{t.generating}</> : <><Volume2 className="w-5 h-5" />{t.generate}</>}</button>
                  
                  {generatedFiles && (<div className="mt-6 pt-6 border-t" style={{ borderColor: cardBorder }}><p className="text-xs font-bold uppercase tracking-wider mb-3 opacity-80" style={{ color: accentSecondary }}>{t.preview} {generatedFiles.durationMs > 0 && `(${Math.floor(generatedFiles.durationMs / 1000 / 60)}:${String(Math.floor(generatedFiles.durationMs / 1000) % 60).padStart(2, "0")})`}</p><audio ref={audioRef} controls className="w-full mb-4 rounded-xl" style={{ accentColor: accent }} /><div className="space-y-3"><button onClick={() => { const a = document.createElement("a"); a.href = generatedFiles.audioObjectUrl; a.download = `Myanmar_TTS_${Date.now()}.mp3`; a.click(); }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-colors" style={{ borderColor: accent, color: accent, background: isDark ? 'rgba(167,139,250,0.1)' : '#ffffff' }}><Download className="w-4 h-4" /> MP3 Audio</button><button onClick={() => downloadFile(generatedFiles.srtContent, `Myanmar_TTS_${aspectRatio.replace(":", "x")}_${Date.now()}.srt`)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-colors" style={{ borderColor: accentSecondary, color: accentSecondary, background: isDark ? 'rgba(99,102,241,0.1)' : '#ffffff' }}><Download className="w-4 h-4" /> SRT ({aspectRatio})</button></div></div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === VIDEO TAB — Simple Translation === */}
        {tab === "video" && (
          <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-300 space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-widest mb-3 leading-normal" style={{ textShadow: isDark ? `0 0 20px ${accent}` : 'none', color: accent }}>{t.videoTitle}</h2>
              <p className="font-bold opacity-80 uppercase tracking-wider text-sm mt-2">{t.videoDesc}</p>
              <p className="text-xs opacity-60 mt-2">{t.videoLimit}</p>
            </div>

            {!videoResult && (
              <>
                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.linkInputLabel}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <LinkIcon className="w-5 h-5 opacity-50" />
                    <input type="text" value={videoUrl} onChange={(e) => { setVideoUrl(e.target.value); if (e.target.value) setVideoFile(null); }} placeholder={t.linkPlaceholder} className="flex-1 bg-transparent border-b-2 py-2 focus:outline-none transition-colors text-sm" style={{ borderColor: videoUrl ? accent : cardBorder, color: textColor }} />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 opacity-50 my-2">
                  <div className="h-px w-20" style={{ background: textColor }}></div><span className="text-xs font-bold uppercase tracking-widest">{t.orLine}</span><div className="h-px w-20" style={{ background: textColor }}></div>
                </div>

                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>Upload</div>
                  <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleVideoFile(e.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()} className="border-2 border-dashed py-8 px-4 rounded-xl text-center cursor-pointer transition-all mt-1" style={{ borderColor: dragOver ? accent : videoFile ? "#16a34a" : cardBorder, background: dragOver ? (isDark ? 'rgba(167,139,250,0.1)' : '#ffffff') : inputBg, opacity: videoUrl ? 0.4 : 1 }}>
                    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleVideoFile(e.target.files[0]); }} />
                    {videoFile ? (<><FileVideo className="w-8 h-8 mx-auto mb-2 text-green-600" /><p className="font-bold text-green-600 text-sm">{videoFile.name}</p><p className="text-xs font-semibold opacity-70 mt-1">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p></>) : (<><Upload className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="font-bold opacity-80 text-sm">{t.dropVideo}</p><p className="text-xs font-semibold opacity-60 mt-2">MP4, MOV, AVI, MKV</p></>)}
                  </div>
                </div>

                {(videoFile || videoUrl) && (
                  <button onClick={handleTranslate} disabled={translateMutation.isPending || translateLinkMutation.isPending} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all disabled:opacity-50 hover:scale-[1.02] mt-4 shadow-lg" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px ${accent}66` }}>
                    {(translateMutation.isPending || translateLinkMutation.isPending) ? <><Loader2 className="w-5 h-5 animate-spin" />{t.translating}</> : <><Sparkles className="w-5 h-5" />{t.translateBtn}</>}
                  </button>
                )}

                {(translateMutation.isPending || translateLinkMutation.isPending) && (
                  <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                    <div className="flex items-center justify-center gap-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent }} />
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent, animationDelay: "0.3s" }} />
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent, animationDelay: "0.6s" }} />
                      </div>
                      <span className="text-sm font-bold opacity-60">{t.translating}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {videoResult && (
              <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.result}</div>
                <div className="space-y-4 mt-2">
                  <div className="flex justify-end">
                    <button onClick={handleVideoCopy}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all hover:scale-105"
                      style={{ background: videoCopied ? "#4ade80" : accent, color: videoCopied ? "#000" : "#fff" }}>
                      {videoCopied ? <><Check className="w-4 h-4" /> {t.copied}</> : <><Copy className="w-4 h-4" /> {t.copyText}</>}
                    </button>
                  </div>
                  {videoResult.downloadedVideoBase64 && (
                    <button
                      onClick={handleSourceVideoDownload}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-colors"
                      style={{ borderColor: accentSecondary, color: accentSecondary, background: isDark ? "rgba(99,102,241,0.1)" : "#fff" }}
                    >
                      <Download className="w-4 h-4" /> {lang === "mm" ? "မူရင်းဗီဒီယို ဒေါင်းလုတ်" : "Download Source Video"}
                    </button>
                  )}
                  <textarea
                    value={editedVideoText}
                    onChange={e => setEditedVideoText(e.target.value)}
                    className="w-full min-h-[250px] p-5 rounded-xl border focus:outline-none focus:ring-2 resize-y text-sm font-sans"
                    style={{ background: inputBg, borderColor: cardBorder, color: textColor, lineHeight: "2.2" }}
                  />
                  <button onClick={handleVideoReset} className="w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-colors hover:opacity-100 opacity-70" style={{ borderColor: cardBorder }}>{t.translateAnother}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === DUBBING TAB — Wizard Flow (fully independent state) === */}
        {tab === "dubbing" && (
          <div className="max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-300 space-y-5">
            <div className="text-center mb-6">
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-widest mb-3 leading-normal" style={{ textShadow: isDark ? `0 0 20px ${accent}` : 'none', color: accent }}>{lang === "mm" ? "AI ဖြင့် video ဖန်တီးခြင်း" : "AI AUTO VIDEO MAKER"}</h2>
              <p className="font-bold opacity-85 tracking-wide text-sm mt-2">{lang === "mm" ? "Video တင်ပါ → အသံရွေးပါ → Auto Sync ဖြင့် MP4 ထုတ်ပါ" : "Upload video → choose voice → auto sync and export MP4"}</p>
            </div>

            {/* ── STEP: Video Input ── */}
            {!dubPreviewUrl && !dubResult && (
              <>
                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.linkInputLabel}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <LinkIcon className="w-5 h-5 opacity-50" />
                    <input type="text" value={dubVideoUrl} onChange={(e) => { setDubVideoUrl(e.target.value); if (e.target.value) setDubVideoFile(null); }} placeholder={t.linkPlaceholder} className="flex-1 bg-transparent border-b-2 py-2 focus:outline-none transition-colors text-sm" style={{ borderColor: dubVideoUrl ? accent : cardBorder, color: textColor }} />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 opacity-50 my-2">
                  <div className="h-px w-20" style={{ background: textColor }}></div><span className="text-xs font-bold uppercase tracking-widest">{t.orLine}</span><div className="h-px w-20" style={{ background: textColor }}></div>
                </div>

                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>Upload</div>
                  <div onDragOver={e => { e.preventDefault(); setDubDragOver(true); }} onDragLeave={() => setDubDragOver(false)} onDrop={e => { e.preventDefault(); setDubDragOver(false); if (e.dataTransfer.files[0]) handleDubVideoFile(e.dataTransfer.files[0]); }} onClick={() => dubFileRef.current?.click()} className="border-2 border-dashed py-8 px-4 rounded-xl text-center cursor-pointer transition-all mt-1" style={{ borderColor: dubDragOver ? accent : dubVideoFile ? "#16a34a" : cardBorder, background: dubDragOver ? (isDark ? 'rgba(167,139,250,0.1)' : '#ffffff') : inputBg, opacity: dubVideoUrl ? 0.4 : 1 }}>
                    <input ref={dubFileRef} type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleDubVideoFile(e.target.files[0]); }} />
                    {dubVideoFile ? (<><FileVideo className="w-8 h-8 mx-auto mb-2 text-green-600" /><p className="font-bold text-green-600 text-sm">{dubVideoFile.name}</p><p className="text-xs font-semibold opacity-70 mt-1">{(dubVideoFile.size / 1024 / 1024).toFixed(1)} MB</p></>) : (<><Upload className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="font-bold opacity-80 text-sm">{t.dropVideo}</p><p className="text-xs font-semibold opacity-60 mt-2">MP4, MOV, AVI, MKV</p></>)}
                  </div>
                </div>

                {(dubVideoFile || dubVideoUrl) && (
                  <button onClick={handleDubPreview} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all hover:scale-[1.02] mt-4 shadow-lg" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px ${accent}66` }}>
                    <FileVideo className="w-5 h-5" /> {lang === "mm" ? "ဗီဒီယိုကြိုကြည့်ရန်" : "Preview Video"}
                  </button>
                )}
              </>
            )}

            {/* ── STEP: Video Preview + Settings ── */}
            {dubPreviewUrl && !dubResult && (
              <>
                {/* Video Preview */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{lang === "mm" ? "ဗီဒီယိုကြိုကြည့်" : "Video Preview"}</div>
                  <div className="flex justify-center mt-2">
                    <div style={{
                      width: dubDetectedRatio === "9:16" ? "280px" : "100%",
                      maxWidth: dubDetectedRatio === "9:16" ? "280px" : "640px",
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
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 5 }}>
                          <div style={{
                            padding: "6px 16px",
                            borderRadius: "8px",
                            fontSize: `${srtFontSize}px`,
                            color: srtColor,
                            textShadow: srtDropShadow ? "2px 2px 4px rgba(0,0,0,0.8)" : "none",
                            background: srtBlurBg ? "rgba(0,0,0,0.5)" : "transparent",
                            backdropFilter: srtBlurBg ? "blur(8px)" : "none",
                            textAlign: "center",
                            maxWidth: "90%",
                          }}>
                            {lang === "mm" ? "မြန်မာ စာတန်း နမူနာ" : "Subtitle Preview Text"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-3 text-xs opacity-50">
                    <span className="px-2 py-1 rounded-lg border font-bold" style={{ borderColor: cardBorder }}>{dubDetectedRatio}</span>
                    <span>{lang === "mm" ? "အချိုး" : "Aspect Ratio"}</span>
                  </div>
                </div>

                {/* Voice & Pitch Settings */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.voiceSelection}</div>
                  <div className="space-y-4">
                    {[{ label: t.male, voices: [{ id: "thiha", name: "သီဟ", isStd: true }, { id: "ryan", name: "ရဲရင့်", isStd: false }, { id: "ronnie", name: "ရောင်နီ", isStd: false }, { id: "lucas", name: "လင်းခန့်", isStd: false }, { id: "daniel", name: "ဒေဝ", isStd: false }, { id: "evander", name: "အဂ္ဂ", isStd: false }]}, { label: t.female, voices: [{ id: "nilar", name: "နီလာ", isStd: true }, { id: "michelle", name: "မေချို", isStd: false }, { id: "iris", name: "အိန္ဒြာ", isStd: false }, { id: "charlotte", name: "သီရိ", isStd: false }, { id: "amara", name: "အမရာ", isStd: false }]}].map(({ label: grpLabel, voices }) => (
                      <div key={grpLabel}><p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">{grpLabel}</p><div className="grid grid-cols-3 gap-2">{voices.map(v => { const isSelected = v.isStd ? dubVoiceMode === "standard" && dubVoice === (v.id === "thiha" ? "thiha" : "nilar") : dubVoiceMode === "character" && dubCharacter === v.id; return (<button key={v.id} onClick={() => { if (v.isStd) { setDubVoiceMode("standard"); setDubVoice(v.id as any); setDubCharacter(""); } else { setDubVoiceMode("character"); setDubCharacter(v.id); } }} className="py-2 px-2 border rounded-xl text-xs font-bold transition-all" style={{ borderColor: isSelected ? accent : cardBorder, background: isSelected ? (isDark ? 'rgba(167,139,250,0.2)' : '#ffffff') : 'transparent', color: isSelected ? accent : textColor, boxShadow: isSelected && isDark ? `0 0 12px rgba(167,139,250,0.3)` : 'none' }}>{v.name}</button>); })}</div></div>
                    ))}
                  </div>
                </div>

                {/* Speed & Pitch */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                    <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.speed}</div>
                    <div className="mt-2">
                      <Slider value={[dubSpeed]} onValueChange={v => setDubSpeed(v[0])} min={0.5} max={2.0} step={0.1} className="w-full" />
                      <div className="flex justify-between items-center text-xs font-bold mt-3"><span className="opacity-60">{t.slower}</span><span style={{ color: accent }}>{dubSpeed.toFixed(1)}x{dubSpeed === 1 ? " (Normal)" : ""}</span><span className="opacity-60">{t.faster}</span></div>
                    </div>
                  </div>
                  <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                    <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.tone}</div>
                    <div className="mt-2">
                      <Slider value={[dubPitch]} onValueChange={v => setDubPitch(v[0])} min={-20} max={20} step={1} className="w-full" />
                      <div className="flex justify-between items-center text-xs font-bold mt-3"><span className="opacity-60">{t.lower}</span><span style={{ color: accent }}>{dubPitch > 0 ? "+" : ""}{dubPitch} Hz</span><span className="opacity-60">{t.higher}</span></div>
                    </div>
                  </div>
                </div>

                {/* SRT Settings */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{lang === "mm" ? "စာတန်းထိုး ဆက်တင်" : "Subtitle Settings"}</div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-bold text-sm">{lang === "mm" ? "စာတန်းထိုး ဗီဒီယိုပေါ်ပြမည်" : "Show Subtitles on Video"}</p>
                        <p className="text-xs opacity-50 mt-0.5">{lang === "mm" ? "SRT စာတန်းထိုး ဖွင့်/ပိတ်" : "Toggle subtitle overlay on/off"}</p>
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
                          <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">{lang === "mm" ? "စာအရွယ်အစား" : "Text Size"}</p>
                          <div className="flex items-center gap-3">
                            <Slider value={[srtFontSize]} onValueChange={v => setSrtFontSize(v[0])} min={12} max={48} step={2} className="flex-1" />
                            <span className="text-sm font-black min-w-[40px] text-right" style={{ color: accent }}>{srtFontSize}px</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">{lang === "mm" ? "စာအရောင်" : "Text Color"}</p>
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
                          <p className="text-xs font-bold uppercase tracking-wider opacity-70">{lang === "mm" ? "အရိပ်ထည့်မည်" : "Drop Shadow"}</p>
                          <button onClick={() => setSrtDropShadow(!srtDropShadow)}
                            className="relative w-11 h-6 rounded-full transition-all"
                            style={{ background: srtDropShadow ? accent : (isDark ? "rgba(255,255,255,0.15)" : "#d1d5db") }}>
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${srtDropShadow ? "left-5" : "left-0.5"}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <p className="text-xs font-bold uppercase tracking-wider opacity-70">{lang === "mm" ? "နောက်ခံ ဝါးမည်" : "Blur Background"}</p>
                          <button onClick={() => setSrtBlurBg(!srtBlurBg)}
                            className="relative w-11 h-6 rounded-full transition-all"
                            style={{ background: srtBlurBg ? accent : (isDark ? "rgba(255,255,255,0.15)" : "#d1d5db") }}>
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${srtBlurBg ? "left-5" : "left-0.5"}`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Generate Dubbing Button */}
                <button onClick={handleDubGenerate} disabled={dubFileMutation.isPending || dubLinkMutation.isPending} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all disabled:opacity-50 hover:scale-[1.02] mt-2 shadow-lg" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px ${accent}66` }}>
                  {(dubFileMutation.isPending || dubLinkMutation.isPending) ? <><Loader2 className="w-5 h-5 animate-spin" />{lang === "mm" ? "ဖန်တီးနေသည်... (၃-၅ မိနစ်ကြာနိုင်)" : "Generating... (may take 3-5 min)"}</> : <><Wand2 className="w-5 h-5" />{lang === "mm" ? "AI ဖြင့် Video ဖန်တီးမည်" : "Generate AI Video"}</>}
                </button>

                {(dubFileMutation.isPending || dubLinkMutation.isPending) && (
                  <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                    <div className="flex flex-col items-center justify-center gap-4 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent }} />
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent, animationDelay: "0.3s" }} />
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accent, animationDelay: "0.6s" }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold opacity-80">{lang === "mm" ? "အသံထည့်နေသည်..." : "Generating dubbed video..."}</p>
                        <p className="text-xs opacity-50 mt-2">{lang === "mm" ? "ဗီဒီယိုအရှည်ပေါ်မူတည်ပြီး ၃-၅ မိနစ်ကြာနိုင်ပါတယ်" : "This may take 3-5 minutes depending on video length"}</p>
                        <div className="flex items-center justify-center gap-6 mt-4 text-xs opacity-40">
                          <span>🎙️ {lang === "mm" ? "အသံထုတ်နေသည်" : "Generating TTS"}</span>
                          <span>🎬 {lang === "mm" ? "ဗီဒီယိုပေါင်းနေသည်" : "Combining video"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={handleDubReset} className="w-full py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider opacity-50 hover:opacity-100 transition-all" style={{ borderColor: cardBorder }}>
                  ← {lang === "mm" ? "ဗီဒီယိုပြောင်းမည်" : "Change Video"}
                </button>
              </>
            )}

            {/* Dubbing Result — Final Video + Download */}
            {dubResult && (
              <div className="space-y-4">
                {/* Video Player */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{lang === "mm" ? "အသံထည့်ပြီး ဗီဒီယို" : "DUBBED VIDEO"}</div>
                  <div className="flex justify-center mt-2">
                    <video
                      ref={dubResultVideoRef}
                      controls
                      className="w-full rounded-xl"
                      style={{ maxHeight: "480px", background: "#000" }}
                      src={`data:video/mp4;base64,${dubResult.videoBase64}`}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button onClick={handleDubDownload}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:scale-105 shadow-lg text-white"
                      style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px ${accent}66` }}>
                      <Download className="w-5 h-5" /> {lang === "mm" ? "MP4 ဒေါင်းလုတ်" : "Download MP4"}
                    </button>
                  </div>
                </div>

                {/* Translation Text */}
                <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
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
                      className="w-full min-h-[150px] p-4 rounded-xl border focus:outline-none focus:ring-2 resize-y text-sm font-sans"
                      style={{ background: inputBg, borderColor: cardBorder, color: textColor, lineHeight: "2.2" }}
                    />
                  </div>
                </div>

                {/* Reset */}
                <button onClick={handleDubReset} className="w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-colors hover:opacity-100 opacity-70" style={{ borderColor: cardBorder }}>
                  {lang === "mm" ? "နောက်ထပ် ဗီဒီယိုအသံထည့်မည်" : "Dub Another Video"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* === SETTINGS TAB === */}
        {tab === "settings" && (
          <div className="max-w-xl mx-auto py-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black uppercase tracking-widest mb-2" style={{ color: accent }}>{t.settingsTitle}</h2>
            </div>
            <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
              <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>API Key</div>
              <div className="space-y-4 mt-2">
                <div>
                  <p className="font-bold mb-1 text-sm">{t.geminiKey}</p>
                  <p className="text-xs font-semibold opacity-70 mb-4">{t.geminiKeyDesc}</p>
                  {savedKey ? (<div className="p-3 border-2 border-green-500/40 bg-green-500/10 rounded-xl mb-4"><p className="text-xs text-green-600 dark:text-green-500 font-bold mb-1">✓ {t.keyActive}</p><p className="text-xs opacity-70 font-mono">{savedKey.slice(0, 8)}{"*".repeat(15)}</p></div>) : (<div className="p-3 border border-dashed rounded-xl mb-4 opacity-70 text-sm font-semibold" style={{ borderColor: cardBorder }}>{t.keyNone}</div>)}
                  <div className="flex gap-2">
                    <input value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder={t.geminiKeyPlaceholder} className="flex-1 p-3 rounded-xl border focus:outline-none focus:ring-2 font-mono text-sm transition-colors" style={{ background: inputBg, borderColor: cardBorder, color: textColor }} />
                    <button onClick={() => { if (geminiKey.trim()) { setSavedKey(geminiKey.trim()); localStorage.setItem("gemini_key", geminiKey.trim()); setGeminiKey(""); } }} className="px-5 font-bold text-sm text-white rounded-xl transition-transform hover:scale-105 shadow-md" style={{ background: accent }}>{t.saveKey}</button>
                    {savedKey && (<button onClick={() => { setSavedKey(""); localStorage.removeItem("gemini_key"); }} className="px-4 font-bold text-sm border border-red-500 text-red-600 dark:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">{t.removeKey}</button>)}
                  </div>
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
