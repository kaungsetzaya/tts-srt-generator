import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSystemTime } from "@/lib/useSystemTime";
import { ArrowLeft, Clock, Mic, FileVideo, Wand2, CheckCircle, XCircle, Sparkles, Coins, History as HistoryIcon, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { motion } from "framer-motion";

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
  if (feat === "tts") return <Mic className="w-5 h-5" />;
  if (feat?.includes("translate")) return <FileVideo className="w-5 h-5" />;
  if (feat?.includes("dub")) return <Wand2 className="w-5 h-5" />;
  return <Clock className="w-5 h-5" />;
}

export default function History() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lumix_lang") as Lang) || "mm");
  const t = T[lang];
  const [, navigate] = useLocation();
  const { data: history, isLoading } = trpc.history.getUnifiedHistory.useQuery({ limit: 100 });
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const accent = "#C06F30";
  const accentSecondary = "#F4B34F";
  const accent15 = "rgba(192,111,48,0.15)";
  const cardBg = isDark ? "rgba(20, 18, 16, 0.7)" : "rgba(255, 255, 255, 0.9)";
  const cardBorder = isDark ? "rgba(192,111,48,0.2)" : "rgba(192,111,48,0.15)";
  const textColor = isDark ? "#EBE6D8" : "#2B1D1C";
  const subtextColor = isDark ? "rgba(235,230,216,0.6)" : "#6b5c50";
  const boxShadow = isDark 
    ? "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.05)" 
    : "0 8px 32px rgba(192,111,48,0.1), inset 0 1px 1px rgba(255,255,255,0.8)";

  const { fmtTime } = useSystemTime();
  const formatTime = (date: any) => {
    if (!date) return "-";
    return fmtTime(date, lang === "mm" ? "my-MM" : "en-US");
  };

  const featureLabel = (feat: string) => {
    const labels: Record<string, string> = lang === "mm" ? { tts: "စာမှအသံ", translate_file: "ဗီဒီယိုဘာသာပြန်", translate_link: "Link ဘာသာပြန်", dub_file: "Auto Creator", dub_link: "Auto Creator", TRIAL: "Trial Reward", REFUND: "Refund", GEN_AUDIO: "TTS", VIDEO_DUB: "Auto Creator", SUBSCRIPTION: "Plan Purchase", tts_refund: "Refund" } : { tts: "TTS", translate_file: "Video Translate", dub_file: "Auto Creator", TRIAL: "Trial Reward", REFUND: "Refund", GEN_AUDIO: "TTS", VIDEO_DUB: "Auto Creator", SUBSCRIPTION: "Plan Purchase", tts_refund: "Refund" };
    return labels[feat] || feat.replace("_", " ");
  };

  const dedupedHistory = history?.reduce((acc: typeof history, item: any) => {
    const existing = acc.find((x: any) => x.id === item.id);
    if (!existing) acc.push(item);
    return acc;
  }, [] as typeof history) ?? [];

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 400, damping: 28 } }
  };

  return (
    <div className="min-h-screen font-sans transition-colors duration-500 flex flex-col selection:bg-orange-500/30" style={{
      background: isDark 
        ? "linear-gradient(135deg, #0a0a0a 0%, #141210 50%, #0a0a0a 100%)"
        : "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 50%, #E2E8F0 100%)",
      color: textColor
    }}>
      {/* Floating Header */}
      <div className="sticky top-0 z-[60] w-full backdrop-blur-3xl border-b transition-all duration-300" style={{ 
        borderColor: cardBorder, 
        background: isDark ? 'rgba(10,10,10,0.8)' : 'rgba(255,255,255,0.8)' 
      }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/lumix")} 
              className="flex items-center justify-center w-10 h-10 rounded-2xl border transition-all shadow-lg" 
              style={{ 
                borderColor: cardBorder, 
                background: isDark ? 'rgba(192,111,48,0.1)' : 'rgba(192,111,48,0.05)',
                color: accent 
              }}
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-[0.2em] flex items-center gap-2" style={{ 
                background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}>
                {t.title}
              </h1>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-0.5 hidden sm:block">
                {t.subtitle}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setLang(lang === "mm" ? "en" : "mm")} 
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all hover:scale-105 active:scale-95 shadow-lg" 
            style={{ 
              borderColor: cardBorder, 
              background: cardBg, 
              color: accent,
            }}
          >
            {lang === "mm" ? "EN" : "MM"}
          </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: "transparent" }} />
            <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse" style={{ color: accent }}>Syncing History</p>
          </div>
        ) : !dedupedHistory || dedupedHistory.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-32 flex flex-col items-center justify-center rounded-[3rem] border border-dashed"
            style={{ borderColor: cardBorder, background: cardBg }}
          >
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 rotate-12 shadow-2xl" style={{ background: isDark ? "rgba(192,111,48,0.15)" : "rgba(192,111,48,0.05)" }}>
              <HistoryIcon className="w-12 h-12" style={{ color: accent }} opacity={0.3} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-widest mb-3">{t.noHistory}</h2>
            <p className="text-sm font-bold opacity-40 max-w-xs mx-auto">Your creative journey starts here. Generate some magic to see your records!</p>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {dedupedHistory.map((item: any) => {
              const isCreditTx = item.origin === "credit";
              const isFailed = item.status === "fail";
              const isRefund = item.type === "REFUND" || item.type === "tts_refund";
              const isPositive = (item.amount || 0) > 0;
              
              return (
                <motion.div 
                  key={item.id} 
                  variants={itemVariants}
                  className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-6 rounded-[2rem] border backdrop-blur-3xl transition-all hover:scale-[1.01] hover:shadow-2xl" 
                  style={{ 
                    background: cardBg, 
                    borderColor: isFailed ? "rgba(239,68,68,0.3)" : cardBorder,
                    boxShadow
                  }}
                >
                  <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full" style={{ background: isFailed ? "#ef4444" : isRefund ? "#22c55e" : accent }} />
                  <div className="flex items-center gap-5">
                    <div 
                      className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner relative overflow-hidden" 
                      style={{ 
                        background: isFailed 
                          ? "rgba(239,68,68,0.1)" 
                          : isRefund
                            ? "rgba(34,197,94,0.1)"
                            : accent15, 
                        color: isFailed ? "#ef4444" : isRefund ? "#22c55e" : accent 
                      }}
                    >
                      {isCreditTx ? <Coins className="w-7 h-7" /> : featureIcon(item.type || "tts")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                        <span className="text-lg font-black uppercase tracking-wide">
                          {isCreditTx 
                            ? (item.type === "trial" ? (lang === "mm" ? "Trial Reward" : "Trial Reward") : (lang === "mm" ? "Purchase" : "Purchase")) 
                            : featureLabel(item.type || "tts")}
                        </span>
                        {isFailed ? (
                          <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20">
                            Failed
                          </span>
                        ) : isRefund ? (
                          <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-500 border border-green-500/20">
                            Refunded
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-500 border border-orange-500/20">
                            Success
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold opacity-50 uppercase tracking-tighter">
                        {isCreditTx ? (
                          <span className={isPositive ? "text-green-500" : ""}>
                            {isPositive ? "+" : ""}{item.amount} Credits
                          </span>
                        ) : (
                          <>
                            {item.character && <span className="flex items-center gap-1.5"><Mic className="w-3.5 h-3.5" /> {item.character}</span>}
                            {item.description && <span className="truncate max-w-[200px] border-l pl-3 border-white/10">{item.description}</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:pl-6" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">
                      {formatTime(item.createdAt).split(' ')[0]}
                    </div>
                    <div className="text-sm font-black" style={{ color: accent }}>
                      {formatTime(item.createdAt).split(' ').slice(1).join(' ')}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
