import * as React from "react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Crown, Mic, FileVideo, Wand2, CheckCircle, AlertCircle, Sparkles, Zap, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

type Lang = "mm" | "en";

const T = {
  mm: {
    title: "Trial အသုံးပြုမှု",
    subtitle: "သင်၏ အခမဲ့ အသုံးပြုခွင့်များ",
    back: "နောက်သို့",
    trialActive: "Trial Active ဖြစ်နေသည်",
    noTrial: "Trial ကာလ မရှိပါ",
    remaining: "ကျန်",
    used: "သုံးပြီး",
    daysLeft: "ရက် ကျန်သည်",
    expired: "သက်တမ်းကုန်",
    limitsTitle: "ကန့်သတ်ချက်များ",
    cta: "Plan များ ကြည့်ရန်",
    features: {
      ttsTitle: "စာမှအသံ (Standard)",
      ttsDesc: "Thiha/Nilar အသံများဖြင့် ဖန်တီးခြင်း",
      charTitle: "Character Voice",
      charDesc: "Ryan, Michelle စသည့် Premium အသံများ",
      videoTitle: "ဗီဒီယိုဘာသာပြန်",
      videoDesc: "ဗီဒီယိုမှ မြန်မာဘာသာသို့ ဘာသာပြန်ခြင်း",
      aiVideoTitle: "Auto Creator (Standard)",
      aiVideoDesc: "AI ဖြင့် ဗီဒီယို ဖန်တီးခြင်း",
    },
    limits: {
      charLimitStd: "စာလုံးရေ (Standard)",
      charLimitChar: "စာလုံးရေ (Premium)",
      maxVideoSize: "ဗီဒီယို အရွယ်အစား",
      maxVideoDuration: "ဗီဒီယို အချိန်",
    }
  },
  en: {
    title: "Trial Usage",
    subtitle: "Your free trial allowances",
    back: "Back",
    trialActive: "Trial Active",
    noTrial: "No Trial",
    remaining: "left",
    used: "used",
    daysLeft: "days left",
    expired: "Expired",
    limitsTitle: "System Limits",
    cta: "View Plans",
    features: {
      ttsTitle: "TTS (Standard)",
      ttsDesc: "Thiha/Nilar standard voices",
      charTitle: "Character Voice",
      charDesc: "Premium character voices",
      videoTitle: "Video Translate",
      videoDesc: "Translate video to Myanmar",
      aiVideoTitle: "Auto Creator",
      aiVideoDesc: "AI Video generation",
    },
    limits: {
      charLimitStd: "Chars (Standard)",
      charLimitChar: "Chars (Premium)",
      maxVideoSize: "Max File Size",
      maxVideoDuration: "Max Duration",
    }
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
};

export default function TrialInfo() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lumix_lang") as Lang) || "mm");
  const t = T[lang];
  const [, navigate] = useLocation();
  const { data: subStatus, isLoading } = trpc.subscription.myStatus.useQuery();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const accent = "#C06F30";
  const accentSecondary = "#F4B34F";
  const cardBg = isDark ? "rgba(15, 15, 15, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(192, 111, 48, 0.15)";
  const textColor = isDark ? "#EBE6D8" : "#2B1D1C";
  const subtextColor = isDark ? "rgba(235, 230, 216, 0.5)" : "#6b5c50";

  const isTrial = subStatus?.plan === "trial";
  const usage = subStatus?.usage;
  const limits = subStatus?.limits;

  const daysLeft = subStatus?.expiresAt
    ? Math.max(0, Math.ceil((new Date(subStatus.expiresAt).getTime() - Date.now()) / 86400000))
    : 0;

  const features = isTrial && usage && limits ? [
    { icon: Mic, title: t.features.ttsTitle, desc: t.features.ttsDesc, used: usage.tts, total: limits.dailyTtsSrt, color: accent },
    { icon: Sparkles, title: t.features.charTitle, desc: t.features.charDesc, used: usage.characterUse, total: limits.dailyCharacterUse, color: "#f59e0b" },
    { icon: FileVideo, title: t.features.videoTitle, desc: t.features.videoDesc, used: usage.videoTranslate, total: limits.dailyVideoTranslate, color: "#60a5fa" },
    { icon: Wand2, title: t.features.aiVideoTitle, desc: t.features.aiVideoDesc, used: usage.aiVideo, total: limits.dailyAiVideo, color: "#4ade80" },
  ] : [];

  return (
    <div className="min-h-screen font-sans flex flex-col" style={{
      background: isDark 
        ? "radial-gradient(circle at top left, #1a1a1a 0%, #0a0a0a 100%)"
        : "radial-gradient(circle at top left, #ffffff 0%, #f1f5f9 100%)",
      color: textColor
    }}>
      {/* Header Bar */}
      <div className="sticky top-0 z-50 backdrop-blur-2xl border-b" style={{ borderColor: cardBorder, background: isDark ? "rgba(10,10,10,0.8)" : "rgba(255,255,255,0.8)" }}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/lumix")} 
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all" 
            style={{ borderColor: cardBorder, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(192,111,48,0.05)", color: accent }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t.back}
          </motion.button>
          <h1 className="text-lg font-black uppercase tracking-[0.2em]" style={{ 
            background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
          }}>{t.title}</h1>
          <div className="w-20" /> {/* Spacer */}
        </div>
      </div>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 sm:py-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: "transparent" }} />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 animate-pulse">Syncing Status</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
            {/* Main Status Card */}
            <motion.div variants={itemVariants} className="p-8 rounded-[2.5rem] border relative overflow-hidden shadow-2xl" style={{ background: cardBg, borderColor: cardBorder }}>
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Crown className="w-24 h-24" style={{ color: accent }} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner" style={{ background: isTrial ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.1)", color: isTrial ? "#f59e0b" : "#ef4444" }}>
                    {isTrial ? <Crown className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-widest">{isTrial ? t.trialActive : t.noTrial}</h2>
                    <p className="text-xs font-bold opacity-50 uppercase">{t.subtitle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Status</div>
                    <div className="text-sm font-black uppercase tracking-wider text-green-500">Active</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Expires In</div>
                    <div className={`text-sm font-black uppercase tracking-wider ${daysLeft <= 2 ? "text-red-500" : ""}`}>{daysLeft} {t.daysLeft}</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Feature Usage */}
            {isTrial && (
              <div className="space-y-4">
                {features.map((feat, idx) => {
                  const pct = feat.total > 0 ? (feat.used / feat.total) * 100 : 0;
                  const isExhausted = feat.used >= feat.total;
                  return (
                    <motion.div key={idx} variants={itemVariants} className="p-5 rounded-3xl border backdrop-blur-xl group hover:scale-[1.02] transition-all" style={{ background: cardBg, borderColor: cardBorder }}>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner" style={{ background: `${feat.color}15`, color: feat.color }}>
                          <feat.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-end mb-2">
                            <div>
                              <h3 className="text-sm font-black uppercase tracking-wide">{feat.title}</h3>
                              <p className="text-[10px] font-bold opacity-40 uppercase">{feat.desc}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black" style={{ color: isExhausted ? "#ef4444" : feat.color }}>{feat.total - feat.used}</span>
                              <span className="text-[10px] font-black opacity-30 ml-1 uppercase">{t.remaining}</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/5 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }} className="h-full rounded-full" style={{ background: isExhausted ? "#ef4444" : feat.color }} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* CTA */}
            <motion.div variants={itemVariants} className="pt-4 text-center">
              <button 
                onClick={() => navigate("/lumix")} 
                className="w-full py-4 rounded-2xl text-white font-black uppercase tracking-[0.2em] shadow-xl group transition-all hover:scale-[1.02] active:scale-95" 
                style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})` }}
              >
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5 fill-white" />
                  {t.cta}
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <p className="mt-4 text-[10px] font-bold opacity-40 uppercase tracking-widest italic">Failed attempts are automatically refunded by our system</p>
            </motion.div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
