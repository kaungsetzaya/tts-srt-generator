import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Crown, Mic, FileVideo, Wand2, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";

type Lang = "mm" | "en";

const T = {
  mm: {
    title: "Trial အသုံးပြုမှုအချက်အလက်",
    subtitle: "သင်၏ Trial ကာလအတွင်း ကျန်ရှိသော အသုံးပြုခွင့်",
    back: "နောက်သို့",
    trialActive: "Trial လုပ်ဆောင်နေသည်",
    noTrial: "Trial ကာလ မရှိပါ",
    remaining: "ကျန်ရှိသည်",
    used: "သုံးပြီး",
    of: "/",
    daysLeft: "ရက် ကျန်သည်",
    expired: "သက်တမ်းကုန်",
    features: {
      ttsTitle: "TTS / စာမှအသံ (Thiha/Nilar)",
      ttsDesc: "စံအသံ Thiha/Nilar ဖြင့် TTS ဖန်တီးခြင်း",
      charTitle: "Character Voice (Character Voices)",
      charDesc: "Ryan, Michelle စသည့် Character အသံများ",
      videoTitle: "Video Translation",
      videoDesc: "ဗီဒီယိုမှ မြန်မာဘာသာပြန်ခြင်း",
      aiVideoTitle: "Auto Creator (Standard Voice)",
      aiVideoDesc: "AI ဖြင့် ဗီဒီယို ဖန်တီးခြင်း (Thiha/Nilar)",
      aiVideoCharTitle: "Auto Creator (Character Voice)",
      aiVideoCharDesc: "AI ဖြင့် ဗီဒီယို ဖန်တီးခြင်း (Character)",
    },
    limits: {
      charLimitStd: "စာလုံးရေ ကန့်သတ်ချက် (Standard)",
      charLimitChar: "စာလုံးရေ ကန့်သတ်ချက် (Character)",
      maxVideoSize: "ဗီဒီယို အရွယ်အစား ကန့်သတ်ချက်",
      maxVideoDuration: "ဗီဒီယို အချိန် ကန့်သတ်ချက်",
      aiVideoStdDuration: "Auto Creator အချိန် (Standard)",
      aiVideoCharDuration: "Auto Creator အချိန် (Character)",
    },
    contactAdmin: "Subscription ဝယ်ယူရန် Admin ကို ဆက်သွယ်ပါ",
    errorRefund: "❗ Error ဖြစ်ပွားပါက ထို attempt ကို ပြန်ပေးပါမည်",
  },
  en: {
    title: "Trial Usage Info",
    subtitle: "Your remaining trial allowances",
    back: "Back",
    trialActive: "Trial Active",
    noTrial: "No Trial",
    remaining: "remaining",
    used: "used",
    of: "/",
    daysLeft: "days left",
    expired: "Expired",
    features: {
      ttsTitle: "TTS / Text to Speech (Thiha/Nilar)",
      ttsDesc: "Generate speech using standard Thiha/Nilar voices",
      charTitle: "Character Voice (Characters)",
      charDesc: "Ryan, Michelle and other character voices",
      videoTitle: "Video Translation",
      videoDesc: "Translate video audio to Myanmar",
      aiVideoTitle: "Auto Creator (Standard Voice)",
      aiVideoDesc: "Create AI dubbed videos with Thiha/Nilar",
      aiVideoCharTitle: "Auto Creator (Character Voice)",
      aiVideoCharDesc: "Create AI dubbed videos with characters",
    },
    limits: {
      charLimitStd: "Character limit (Standard)",
      charLimitChar: "Character limit (Character)",
      maxVideoSize: "Max video size",
      maxVideoDuration: "Max video duration",
      aiVideoStdDuration: "Auto Creator duration (Standard)",
      aiVideoCharDuration: "Auto Creator duration (Character)",
    },
    contactAdmin: "Contact Admin to purchase a subscription",
    errorRefund: "❗ Failed attempts are automatically refunded",
  }
};

export default function TrialInfo() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lumix_lang") as Lang) || "mm");
  const t = T[lang];
  const [, navigate] = useLocation();
  const { data: subStatus } = trpc.subscription.myStatus.useQuery();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const accent = "#C06F30";
  const cardBg = isDark ? "rgba(15, 12, 41, 0.6)" : "rgba(255, 255, 255, 0.8)";
  const cardBorder = isDark ? "rgba(192,111,48,0.2)" : "rgba(192,111,48,0.15)";
  const textColor = isDark ? "#EBE6D8" : "#2B1D1C";
  const subtextColor = isDark ? "rgba(240,238,255,0.6)" : "#6b5c50";

  const isTrial = subStatus?.plan === "trial";
  const usage = subStatus?.usage;
  const limits = subStatus?.limits;

  const daysLeft = subStatus?.expiresAt
    ? Math.max(0, Math.ceil((new Date(subStatus.expiresAt).getTime() - Date.now()) / 86400000))
    : 0;

  type FeatureCard = {
    icon: React.ReactNode;
    title: string;
    desc: string;
    used: number;
    total: number;
    color: string;
  };

  const features: FeatureCard[] = isTrial && usage && limits ? [
    {
      icon: <Mic className="w-5 h-5" />,
      title: t.features.ttsTitle,
      desc: t.features.ttsDesc,
      used: usage.tts,
      total: limits.dailyTtsSrt,
      color: "#C06F30",
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: t.features.charTitle,
      desc: t.features.charDesc,
      used: usage.characterUse,
      total: limits.dailyCharacterUse,
      color: "#F4B34F",
    },
    {
      icon: <FileVideo className="w-5 h-5" />,
      title: t.features.videoTitle,
      desc: t.features.videoDesc,
      used: usage.videoTranslate,
      total: limits.dailyVideoTranslate,
      color: "#C06F30",
    },
    {
      icon: <Wand2 className="w-5 h-5" />,
      title: t.features.aiVideoTitle,
      desc: t.features.aiVideoDesc,
      used: usage.aiVideo,
      total: limits.dailyAiVideo,
      color: "#34d399",
    },
    {
      icon: <Wand2 className="w-5 h-5" />,
      title: t.features.aiVideoCharTitle,
      desc: t.features.aiVideoCharDesc,
      used: usage.aiVideo || 0, // Fallback
      total: limits.dailyAiVideo || 0,
      color: "#fbbf24",
    },
  ] : [];

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

      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        {/* Trial Status Banner */}
        <div className="p-4 sm:p-5 rounded-2xl border backdrop-blur-xl mb-6" style={{ background: cardBg, borderColor: isTrial ? "rgba(251,191,36,0.3)" : "rgba(220,38,38,0.3)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isTrial ? <Crown className="w-6 h-6 text-amber-400" /> : <AlertCircle className="w-6 h-6 text-red-400" />}
              <div>
                <p className="font-black text-sm uppercase tracking-wider" style={{ color: isTrial ? "#fbbf24" : "#ef4444" }}>
                  {isTrial ? t.trialActive : t.noTrial}
                </p>
                {isTrial && daysLeft > 0 && (
                  <p className="text-xs font-bold mt-1" style={{ color: daysLeft > 3 ? "#4ade80" : "#ef4444" }}>
                    {daysLeft} {t.daysLeft}
                  </p>
                )}
                {isTrial && daysLeft === 0 && (
                  <p className="text-xs font-bold mt-1 text-red-400">{t.expired}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Feature Usage Cards */}
        {isTrial && features.length > 0 ? (
          <div className="space-y-4">
            {features.map((feat, idx) => {
              const remaining = Math.max(0, feat.total - feat.used);
              const pct = feat.total > 0 ? (feat.used / feat.total) * 100 : 0;
              const isExhausted = remaining === 0;
              return (
                <div key={idx} className="p-4 rounded-2xl border backdrop-blur-xl transition-all" style={{ background: cardBg, borderColor: isExhausted ? "rgba(220,38,38,0.3)" : cardBorder }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${feat.color}20`, color: feat.color }}>
                      {feat.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold">{feat.title}</h3>
                        <div className="flex items-center gap-1.5">
                          {isExhausted ? (
                            <span className="text-xs font-bold text-red-400">0 {t.remaining}</span>
                          ) : (
                            <span className="text-xs font-bold" style={{ color: feat.color }}>
                              {remaining} {t.remaining}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs mb-3" style={{ color: subtextColor }}>{feat.desc}</p>
                      {/* Progress bar */}
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            background: isExhausted ? "#ef4444" : feat.color,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 text-xs font-semibold" style={{ color: subtextColor }}>
                        <span>{feat.used} {t.used}</span>
                        <span>{feat.used}{t.of}{feat.total}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Limits Info */}
            {limits && (
              <div className="p-4 rounded-2xl border backdrop-blur-xl" style={{ background: cardBg, borderColor: cardBorder }}>
                <h3 className="text-sm font-black uppercase tracking-wider mb-3" style={{ color: accent }}>
                  {lang === "mm" ? "ကန့်သတ်ချက်များ" : "Limits"}
                </h3>
                <div className="space-y-2 text-xs">
                  {[
                    { label: t.limits.charLimitStd, value: `${(limits as any).charLimitStandard?.toLocaleString() ?? 0} chars` },
                    { label: t.limits.charLimitChar, value: `${(limits as any).charLimitCharacter?.toLocaleString() ?? 0} chars` },
                    { label: t.limits.maxVideoSize, value: `${(limits as any).maxVideoSizeMB ?? 0}MB` },
                    { label: t.limits.maxVideoDuration, value: `${Math.floor(((limits as any).maxVideoDurationSec ?? 0) / 60)}:${String(((limits as any).maxVideoDurationSec ?? 0) % 60).padStart(2, "0")}` },
                    { label: t.limits.aiVideoStdDuration, value: `${Math.floor(((limits as any).maxAiVideoDurationSecStd ?? 0) / 60)}:${String(((limits as any).maxAiVideoDurationSecStd ?? 0) % 60).padStart(2, "0")}` },
                    { label: t.limits.aiVideoCharDuration, value: `${Math.floor(((limits as any).maxAiVideoDurationSecChar ?? 0) / 60)}:${String(((limits as any).maxAiVideoDurationSecChar ?? 0) % 60).padStart(2, "0")}` },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}>
                      <span style={{ color: subtextColor }}>{item.label}</span>
                      <span className="font-bold" style={{ color: textColor }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error refund notice */}
            <div className="p-3 rounded-xl text-center text-xs font-bold" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
              {t.errorRefund}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400 opacity-50" />
            <p className="text-sm font-bold mb-4" style={{ color: subtextColor }}>{t.contactAdmin}</p>
            <a href="https://t.me/LumixOfficialBot" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold text-sm uppercase tracking-wider transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${accent}, #F4B34F)` }}>
              Telegram Bot
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
