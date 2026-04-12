import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Clock, Mic, FileVideo, Wand2, CheckCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";

type Lang = "mm" | "en";

const T = {
  mm: {
    title: "အသုံးပြုမှုမှတ်တမ်း",
    subtitle: "သင်၏ LUMIX အသုံးပြုမှု မှတ်တမ်းများ",
    back: "နောက်သို့",
    feature: "အမျိုးအစား",
    voice: "အသံ",
    chars: "စာလုံးရေ",
    status: "အခြေအနေ",
    time: "အချိန်",
    success: "အောင်မြင်",
    fail: "မအောင်မြင်",
    noHistory: "အသုံးပြုမှု မှတ်တမ်း မရှိသေးပါ",
    tts: "စာမှအသံ",
    translate_file: "ဗီဒီယိုဘာသာပြန်",
    translate_link: "Link ဘာသာပြန်",
    dub_file: "AI Video (ဖိုင်)",
    dub_link: "AI Video (Link)",
  },
  en: {
    title: "Usage History",
    subtitle: "Your LUMIX usage history",
    back: "Back",
    feature: "Type",
    voice: "Voice",
    chars: "Characters",
    status: "Status",
    time: "Time",
    success: "Success",
    fail: "Failed",
    noHistory: "No usage history yet",
    tts: "Text to Speech",
    translate_file: "Video Translate",
    translate_link: "Link Translate",
    dub_file: "AI Video (File)",
    dub_link: "AI Video (Link)",
  }
};

function featureIcon(feat: string) {
  if (feat === "tts") return <Mic className="w-4 h-4" />;
  if (feat?.includes("translate")) return <FileVideo className="w-4 h-4" />;
  if (feat?.includes("dub")) return <Wand2 className="w-4 h-4" />;
  return <Clock className="w-4 h-4" />;
}

export default function History() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lumix_lang") as Lang) || "mm");
  const t = T[lang];
  const [, navigate] = useLocation();
  const { data: history, isLoading } = trpc.history.getMyHistory.useQuery({ limit: 100 });

  const isDark = true; // match main app
  const accent = "oklch(0.65 0.25 310)";
  const cardBg = "rgba(15, 12, 41, 0.6)";
  const cardBorder = "rgba(192,111,48,0.2)";
  const textColor = "#F0EEFF";
  const subtextColor = "rgba(240,238,255,0.6)";

  // Format time in user timezone
  const formatTime = (date: any) => {
    if (!date) return "-";
    const d = new Date(date);
    const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return d.toLocaleString(lang === "mm" ? "my-MM" : "en-US", {
      timeZone: userTZ,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const featureLabel = (feat: string) => {
    return (t as any)[feat] || feat;
  };

  return (
    <div className="min-h-screen font-sans" style={{
      background: "linear-gradient(135deg, #0F0C29 0%, #302B63 50%, #24243E 100%)",
      color: textColor
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b backdrop-blur-xl" style={{ borderColor: cardBorder, background: 'rgba(15,12,41,0.8)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/lumix")} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors hover:opacity-80" style={{ borderColor: cardBorder, color: accent }}>
            <ArrowLeft className="w-4 h-4" /> {t.back}
          </button>
          <h1 className="text-lg sm:text-xl font-black uppercase tracking-widest" style={{ color: accent }}>{t.title}</h1>
        </div>
        <button onClick={() => setLang(lang === "mm" ? "en" : "mm")} className="px-2 py-1 text-xs font-bold rounded border" style={{ borderColor: cardBorder, background: cardBg, color: textColor }}>
          {lang === "mm" ? "EN" : "MM"}
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <p className="text-sm font-bold mb-6" style={{ color: subtextColor }}>{t.subtitle}</p>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: "transparent" }} />
          </div>
        ) : !history || history.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-bold" style={{ color: subtextColor }}>{t.noHistory}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border backdrop-blur-xl transition-all" style={{ background: cardBg, borderColor: cardBorder }}>
                <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: item.status === "fail" ? "rgba(220,38,38,0.2)" : "rgba(192,111,48,0.15)", color: item.status === "fail" ? "#ef4444" : accent }}>
                  {featureIcon(item.feature || "tts")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold truncate">{featureLabel(item.feature || "tts")}</span>
                    {item.status === "success" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: subtextColor }}>
                    {item.voice && <span>{item.character || item.voice}</span>}
                    {(item.charCount ?? 0) > 0 && <span>{item.charCount?.toLocaleString()} {lang === "mm" ? "စာလုံး" : "chars"}</span>}
                    {(item.durationMs ?? 0) > 0 && <span>{Math.floor((item.durationMs ?? 0) / 1000)}s</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-semibold" style={{ color: subtextColor }}>{formatTime(item.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
