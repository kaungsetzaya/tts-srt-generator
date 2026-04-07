import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Slider } from "@/components/ui/slider";
import { Loader2, Download, Volume2, LogOut, Crown, AlertCircle, Mic, FileVideo, Settings, Sparkles, Upload, ChevronRight, Sun, Moon, Copy, Check, Link as LinkIcon } from "lucide-react";
import { useLocation } from "wouter";

type Tab = "tts" | "video" | "settings";
type Theme = "dark" | "light";
type Lang = "mm" | "en";

const T = {
  mm: {
    appName: "LUMIX",
    tabs: { tts: "စာမှအသံထုတ်ရန်", video: "ဗီဒီယိုဘာသာပြန်", settings: "ဆက်တင်" },
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
    geminiKey: "Gemini API Key",
    geminiKeyDesc: "သင်၏ Gemini API key ထည့်ပါ",
    geminiKeyPlaceholder: "AIzaSy...",
    saveKey: "သိမ်းမည်",
    removeKey: "ဖျက်မည်",
    keyActive: "API Key သုံးနေသည်",
    keyNone: "API Key မရှိ",
  },
  en: {
    appName: "LUMIX",
    tabs: { tts: "TTS", video: "Video Translation", settings: "Settings" },
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
    videoTitle: "VIDEO TRANSCRIPTION",
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
    geminiKey: "Gemini API Key",
    geminiKeyDesc: "Add your own Gemini API key",
    geminiKeyPlaceholder: "AIzaSy...",
    saveKey: "Save",
    removeKey: "Remove",
    keyActive: "Using your API Key",
    keyNone: "No API Key",
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

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [videoResult, setVideoResult] = useState<{ myanmarText: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [geminiKey, setGeminiKey] = useState("");
  const [savedKey, setSavedKey] = useState(() => localStorage.getItem("gemini_key") || "");

  const [, navigate] = useLocation();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: subStatus, isLoading: subLoading } = trpc.subscription.myStatus.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: () => { window.location.href = "/login"; } });
  const generateMutation = trpc.tts.generateAudio.useMutation();
  const translateMutation = trpc.video.translate.useMutation();
  const translateLinkMutation = trpc.video.translateLink.useMutation();

  const isAdmin = me?.role === "admin";
  const hasActiveSub = isAdmin || subStatus?.active;

  const daysLeft = subStatus?.expiresAt
    ? Math.max(0, Math.ceil((new Date(subStatus.expiresAt).getTime() - Date.now()) / 86400000))
    : null;

  // --- GORGEOUS PREMIUM UI COLORS ---
  const isDark = theme === "dark";
  
  // Vibrant Purples for Accents
  const accent = isDark ? "oklch(0.65 0.25 310)" : "#7c3aed"; 
  const accentSecondary = isDark ? "oklch(0.6 0.28 280)" : "#5b21b6"; 
  const subColor = isAdmin ? accent : daysLeft === null ? accent : daysLeft > 14 ? "#16a34a" : daysLeft > 4 ? "#ea580c" : "#dc2626";

  // Beautiful Pink/Purple gradient for Light, Cyberpunk for Dark
  const bgGradient = isDark
    ? "linear-gradient(135deg, #0F0C29 0%, #302B63 50%, #24243E 100%)"
    : "linear-gradient(135deg, #A18CD1 0%, #FBC2EB 100%)";

  // Frosted Glass Effect for Cards!
  const cardBg = isDark ? "rgba(15, 12, 41, 0.6)" : "rgba(255, 255, 255, 0.45)";
  const cardBorder = isDark ? "rgba(167, 139, 250, 0.2)" : "rgba(255, 255, 255, 0.8)";
  const textColor = isDark ? "#F0EEFF" : "#1e1b4b";
  const labelBg = isDark ? "#1f1b3e" : "#ffffff";
  const inputBg = isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.6)";

  // Perfect padding and margins to prevent any overlapping
  const box = "relative border p-4 md:p-5 pt-8 backdrop-blur-xl transition-all duration-300 rounded-2xl mt-6 shadow-[0_8px_32px_rgba(0,0,0,0.05)]";
  const labelStyle = "absolute -top-3.5 left-4 px-3 py-1 text-xs uppercase tracking-widest font-black rounded-lg z-10 shadow-sm border-t border-l border-r";

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
    } catch (e: any) { alert(e?.message || "Failed"); }
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
            setVideoResult({ myanmarText: res.myanmarText });
        }
      } catch (e: any) { alert(e?.message || "Link Translation failed"); }
      return;
    }

    if (!videoFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await translateMutation.mutateAsync({ videoBase64: base64, filename: videoFile.name });
        if (res.success) {
            setVideoResult({ myanmarText: res.myanmarText });
        }
      } catch (e: any) { alert(e?.message || "Translation failed"); }
    };
    reader.readAsDataURL(videoFile);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
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
      <div className="relative z-10 flex gap-2 px-6 pt-4 border-b" style={{ borderColor: cardBorder, background: isDark ? 'rgba(15,12,41,0.5)' : 'rgba(255,255,255,0.3)' }}>
        {([{ id: "tts" as Tab, label: t.tabs.tts, icon: <Mic className="w-4 h-4" /> }, { id: "video" as Tab, label: t.tabs.video, icon: <FileVideo className="w-4 h-4" /> }, { id: "settings" as Tab, label: t.tabs.settings, icon: <Settings className="w-4 h-4" /> }]).map(({ id, label: lbl, icon }) => (
          <button key={id} onClick={() => setTab(id)} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold uppercase tracking-widest transition-all border-b rounded-t-xl" style={{ borderColor: tab === id ? accent : 'transparent', color: tab === id ? accent : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(30,27,75,0.5)'), background: tab === id ? cardBg : 'transparent' }}>{icon} {lbl}</button>
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-10">

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
                  {[{ label: t.tone, value: tone, setValue: setTone, min: -20, max: 20, step: 1, display: `${tone > 0 ? "+" : ""}${tone} Hz`, leftLabel: t.lower, rightLabel: t.higher, disabled: voiceMode === "character" }, { label: t.speed, value: speed, setValue: setSpeed, min: 0.5, max: 2.0, step: 0.1, display: `${speed.toFixed(1)}x`, leftLabel: t.slower, rightLabel: t.faster, disabled: false }].map(({ label: lbl, value, setValue, min, max, step, display, leftLabel, rightLabel, disabled }) => (
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

        {/* === VIDEO TAB === */}
        {tab === "video" && (
          <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300 space-y-4">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-widest mb-3 leading-normal" style={{ textShadow: isDark ? `0 0 20px ${accent}` : 'none', color: accent }}>{t.videoTitle}</h2>
              <p className="font-bold opacity-80 uppercase tracking-wider text-sm mt-2">{t.videoDesc}</p>
              <p className="text-xs opacity-60 mt-2">{t.videoLimit}</p>
            </div>

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

            {(videoFile || videoUrl) && !videoResult && (
              <button onClick={handleTranslate} disabled={translateMutation.isPending || translateLinkMutation.isPending} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all disabled:opacity-50 hover:scale-[1.02] mt-6 shadow-lg" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`, boxShadow: isDark ? `0 0 20px ${accent}` : `0 8px 20px ${accent}66` }}>
                {(translateMutation.isPending || translateLinkMutation.isPending) ? <><Loader2 className="w-5 h-5 animate-spin" />{t.translating}</> : <><Sparkles className="w-5 h-5" />{t.translateBtn}</>}
              </button>
            )}

            {(translateMutation.isPending || translateLinkMutation.isPending) && (
              <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                <div className="flex items-center justify-between mt-1 text-xs font-bold">
                  {["Extract", "Whisper", "Gemini", "Done"].map((s, i) => (<div key={s} className="flex items-center gap-2 opacity-80"><div className="w-6 h-6 rounded-full border-2 flex items-center justify-center animate-pulse" style={{ borderColor: accent, color: accent }}>{i + 1}</div><span className="hidden sm:inline">{s}</span>{i < 3 && <ChevronRight className="w-4 h-4 opacity-30 ml-1" />}</div>))}
                </div>
              </div>
            )}

            {videoResult && (
              <div className={box} style={{ background: cardBg, borderColor: cardBorder }}>
                <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>{t.result}</div>
                <div className="space-y-4 mt-2">
                  {/* Copy button only — no SRT export */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(videoResult.myanmarText);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all hover:scale-105"
                      style={{ borderColor: accent, color: accent, background: isDark ? 'rgba(167,139,250,0.1)' : '#ffffff' }}
                    >
                      {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Text</>}
                    </button>
                  </div>
                  <div className="rounded-xl p-4 max-h-72 overflow-y-auto border" style={{ background: inputBg, borderColor: cardBorder }}>
                    <pre className="text-sm whitespace-pre-wrap leading-relaxed font-sans">{videoResult.myanmarText}</pre>
                  </div>
                  <button onClick={() => { setVideoFile(null); setVideoUrl(""); setVideoResult(null); setCopied(false); }} className="w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-colors hover:opacity-100 opacity-70" style={{ borderColor: cardBorder }}>{t.translateAnother}</button>
                </div>
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
