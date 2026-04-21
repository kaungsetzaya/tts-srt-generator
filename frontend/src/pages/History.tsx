import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSystemTime } from "@/lib/useSystemTime";
import { ArrowLeft, Clock, Mic, FileVideo, Wand2, CheckCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";

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
    video_upload: "ဗီဒီယိုဘာသာပြန်",
    video_link: "Link ဘာသာပြန်",
    dub_file: "Auto Creator (ဖိုင်)",
    dub_link: "Auto Creator (Link)",
    trial: "မင်္ဂလာဆောင်းပါး",
    purchase: "ဝယ်ယူခြင်း",
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
    video_upload: "Video Translate",
    video_link: "Link Translate",
    dub_file: "Auto Creator (File)",
    dub_link: "Auto Creator (Link)",
    trial: "Trial",
    purchase: "Purchase",
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
  const { data: history, isLoading } = trpc.history.getUnifiedHistory.useQuery({ limit: 100 });
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const accent = "#C06F30";
  const cardBg = isDark ? "rgba(15, 12, 41, 0.6)" : "rgba(255, 255, 255, 0.8)";
  const cardBorder = isDark ? "rgba(192,111,48,0.2)" : "rgba(192,111,48,0.15)";
  const textColor = isDark ? "#EBE6D8" : "#2B1D1C";
  const subtextColor = isDark ? "rgba(240,238,255,0.6)" : "#6b5c50";

  const { fmtTime } = useSystemTime();
  const formatTime = (date: any) => {
    if (!date) return "-";
    return fmtTime(date, lang === "mm" ? "my-MM" : "en-US");
  };

  const featureLabel = (feat: string) => {
    return (t as any)[feat] || feat;
  };

  const dedupedHistory = history?.reduce((acc: typeof history, item) => {
    const existing = acc.find((x) => x.id === item.id);
    if (!existing) acc.push(item);
    return acc;
  }, [] as typeof history) ?? [];

  return (
    <div className="min-h-screen font-sans transition-colors duration-500" style={{
      background: isDark 
        ? "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0f0f0f 100%)"
        : "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 50%, #E2E8F0 100%)",
      color: textColor
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b backdrop-blur-xl" style={{ 
        borderColor: cardBorder, 
        background: isDark ? 'rgba(15,12,41,0.8)' : 'rgba(255,255,255,0.8)' 
      }}>
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
        ) : !dedupedHistory || dedupedHistory.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-bold" style={{ color: subtextColor }}>{t.noHistory}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dedupedHistory.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border backdrop-blur-xl transition-all" style={{ background: cardBg, borderColor: cardBorder }}>
                <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: item.status === "fail" ? "rgba(220,38,38,0.2)" : "rgba(192,111,48,0.15)", color: item.status === "fail" ? "#ef4444" : accent }}>
                  {item.origin === "credit" ? <CheckCircle className="w-4 h-4" /> : featureIcon(item.type || "tts")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold truncate">{item.origin === "credit" ? (item.type === "trial" ? (lang === "mm" ? "မင်္ဂလာဆောင်းပါး" : "Trial") : (lang === "mm" ? "ဝယ်ယူခြင်း" : "Purchase")) : featureLabel(item.type || "tts")}</span>
                    {item.status === "success" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: subtextColor }}>
                    {item.origin === "credit" && item.amount ? (
                      <span>{item.amount > 0 ? "+" : ""}{item.amount} {lang === "mm" ? "ကရက်ဒစ်" : "credits"}</span>
                    ) : (
                      <>
                        {item.voice && <span>{item.character || item.voice}</span>}
                        {item.description && <span className="truncate max-w-[150px]">{item.description}</span>}
                      </>
                    )}
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
