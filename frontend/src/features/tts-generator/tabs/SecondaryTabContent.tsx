import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  LogOut,
  Mic,
  FileVideo,
  Wand2,
  Check,
  ChevronDown,
  Star,
  Clock as ClockIcon,
  AlertCircle,
  Zap,
  FolderOpen,
  FileAudio,
  FileText,
  Trash2,
  Download,
  ExternalLink,
  Settings,
  Sun,
  Moon,
  BookOpen,
  History as HistoryIcon,
  Info,
  Sparkles,
  Play,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useSystemTime } from "@/lib/useSystemTime";
import CircularLoader from "@/features/tts-generator/components/CircularLoader";
import {
  accent as _accent,
  accentSecondary as _accentSecondary,
  accent15,
  accent40,
} from "@/features/tts-generator/constants/colors";
import type { ThemeValues } from "../types";

interface SecondaryTabContentProps {
  secondaryTab: "history" | "plan" | "guide" | "settings" | "files" | null;
  lang: "mm" | "en";
  t: any;
  isAdmin: boolean;
  me: any;
  subStatus: any;
  subLoading: boolean;
  planLimits: any;
  planUsage: any;
  currentPlan: string | undefined;
  daysLeft: number | null;
  hasActiveSub: boolean;
  hasPlan: boolean;
  unifiedHistory: any;
  historyLoading: boolean;
  userFiles: any[];
  filesLoading: boolean;
  libraryFilter: "all" | "video" | "audio" | "text";
  setLibraryFilter: (v: any) => void;
  deleteFileMutation: any;
  geminiKey: string;
  setGeminiKey: (v: string) => void;
  savedKey: string;
  setSavedKey: (v: string) => void;
  generateMutation: any;
  logoutMutation: any;
  navigate: (path: string) => void;
  themeValues: ThemeValues;
  accent: string;
  accentSecondary: string;
  setMainTab: (tab: "tts" | "video" | "dubbing") => void;
  setSecondaryTab: (tab: any) => void;
  showSuccess: (msg: string) => void;
}

function SecondaryTabContent({
  secondaryTab,
  lang,
  t,
  subStatus,
  planLimits,
  planUsage,
  currentPlan,
  unifiedHistory,
  historyLoading,
  userFiles,
  filesLoading,
  libraryFilter,
  setLibraryFilter,
  deleteFileMutation,
  geminiKey,
  setGeminiKey,
  savedKey,
  setSavedKey,
  generateMutation,
  logoutMutation,
  navigate,
  themeValues,
  accent,
  accentSecondary,
  setMainTab,
  setSecondaryTab,
  showSuccess,
}: SecondaryTabContentProps) {
  const { fmtTime } = useSystemTime();

  const {
    isDark,
    textColor,
    subtextColor,
    cardBg,
    cardBorder,
    boxShadow,
    inputBg,
    inputBorder,
    labelBg,
    box,
    labelStyle,
  } = themeValues;

  if (!secondaryTab) return null;

  return (
    <>
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
                <p className="text-xs mb-2" style={{ color: "#ef4444" }}>
                  {t.keyWarning}
                </p>
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
            <div className="space-y-2">
              {(unifiedHistory?.reduce((acc: any[], item: any) => {
                if (acc.find(x => x.id === item.id)) return acc;
                
                if (item.origin === "credit" && item.amount > 0) {
                  const isDupRefund = acc.find(x => 
                    x.origin === "credit" && 
                    x.amount === item.amount &&
                    Math.abs(new Date(x.createdAt).getTime() - new Date(item.createdAt).getTime()) < 60000
                  );
                  if (isDupRefund) return acc;
                }
                
                acc.push(item);
                return acc;
              }, []) || []).map((item: any) => {
                const isCredit = item.origin === "credit";
                const isTask = item.origin === "task";
                const isError = item.status === "fail";
                const isRefund = item.type === "REFUND" || item.type === "tts_refund";
                const isPositive = (item.amount || 0) > 0;
                
                const featureLabel = (type: string) => {
                  const labels: Record<string, string> =
                    lang === "mm"
                      ? {
                          tts: "စာမှအသံ",
                          translate_file: "ဗီဒီယိုဘာသာပြန်",
                          translate_link: "Link ဘာသာပြန်",
                          dub_file: "Auto Creator",
                          dub_link: "Auto Creator",
                          TRIAL: "Trial",
                          GEN_AUDIO: "TTS",
                          VIDEO_DUB: "Dubbing",
                          SUBSCRIPTION: "Plan",
                          REFUND: "ပြန်အမ်း",
                          tts_refund: "TTS ပြန်အမ်း",
                        }
                      : {
                          tts: "Text to Speech",
                          translate_file: "Video Translate",
                          translate_link: "Link Translate",
                          dub_file: "Auto Creator",
                          dub_link: "Auto Creator",
                          TRIAL: "Trial",
                          GEN_AUDIO: "TTS",
                          VIDEO_DUB: "Dubbing",
                          SUBSCRIPTION: "Plan",
                          REFUND: "Refund",
                          tts_refund: "TTS Refund",
                        };
                  return labels[type] || type.replace("_", " ");
                };

                const voiceNameMap: Record<string, string> = {
                  thiha: lang === "mm" ? "သီဟ" : "Thiha",
                  nilar: lang === "mm" ? "နီလာ" : "Nilar",
                  ryan: lang === "mm" ? "ရဲရင့်" : "Ryan",
                  ronnie: lang === "mm" ? "ရောင်နီ" : "Ronnie",
                  lucas: lang === "mm" ? "လင်းခန့်" : "Lucas",
                  daniel: lang === "mm" ? "ဒေဝ" : "Daniel",
                  evander: lang === "mm" ? "အဂ္ဂ" : "Evander",
                  michelle: lang === "mm" ? "မေချို" : "Michelle",
                  iris: lang === "mm" ? "အိန္ဒြာ" : "Iris",
                  charlotte: lang === "mm" ? "သီရိ" : "Charlotte",
                  amara: lang === "mm" ? "အမရာ" : "Amara",
                };
                
                const voiceDisplayRegex = /(?:TTS:\s*|Dub:\s*|Refund:\s*)(thiha|nilar|ryan|ronnie|lucas|daniel|evander|michelle|iris|charlotte|amara)/i;
                const parsedVoiceMatch = item.description?.match(voiceDisplayRegex);
                const rawVoice = parsedVoiceMatch ? parsedVoiceMatch[1].toLowerCase() : (item.character || item.voice || "");
                
                const voiceDisplay = rawVoice 
                  ? (voiceNameMap[rawVoice] || rawVoice)
                  : "";

                // Status badge config
                let statusConfig = { bg: "", color: "", label: "" };
                if (isError) {
                  statusConfig = { 
                    bg: "rgba(220,38,38,0.1)", 
                    color: "#ef4444", 
                    label: lang === "mm" ? "မအောင်မြင်" : "Failed" 
                  };
                } else if (isRefund) {
                  statusConfig = { 
                    bg: "rgba(34,197,94,0.1)", 
                    color: "#22c55e", 
                    label: lang === "mm" ? "ပြန်အမ်း" : "Refunded" 
                  };
                } else if (isTask && item.amount > 0) {
                  statusConfig = { 
                    bg: "rgba(192,111,48,0.1)", 
                    color: "#f59e0b", 
                    label: "-" + item.amount 
                  };
                } else if (isPositive) {
                  statusConfig = { 
                    bg: "rgba(34,197,94,0.1)", 
                    color: "#22c55e", 
                    label: "+" + item.amount 
                  };
                } else {
                  statusConfig = { 
                    bg: "rgba(245,158,11,0.1)", 
                    color: "#f59e0b", 
                    label: String(item.amount) 
                  };
                }

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative overflow-hidden rounded-xl border transition-all hover:border-opacity-50"
                    style={{
                      background: isDark ? "rgba(20,20,20,0.6)" : "rgba(255,255,255,0.7)",
                      borderColor: isError ? "rgba(220,38,38,0.2)" : isRefund ? "rgba(34,197,94,0.2)" : cardBorder,
                    }}
                  >
                    {/* Left accent bar */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                      style={{ 
                        background: isError ? "#ef4444" : isRefund ? "#22c55e" : accent 
                      }}
                    />
                    
                    <div className="flex items-center gap-3 p-3 pl-4">
                      {/* Feature icon */}
                      <div
                        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black"
                        style={{
                          background: isError 
                            ? "rgba(220,38,38,0.15)" 
                            : isRefund 
                              ? "rgba(34,197,94,0.15)" 
                              : accent15,
                          color: isError ? "#ef4444" : isRefund ? "#22c55e" : accent,
                        }}
                      >
                        {item.type?.includes("translate") ? <FileVideo className="w-4 h-4" /> : item.type?.includes("dub") ? <Wand2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-sm truncate" style={{ color: textColor }}>
                            {featureLabel(item.type)}
                          </span>
                          {voiceDisplay && (
                            <span 
                              className="text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider"
                              style={{ 
                                background: accent15, 
                                color: accent 
                              }}
                            >
                              {voiceDisplay}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] opacity-40" style={{ color: subtextColor }}>
                          {fmtTime(item.createdAt)}
                        </span>
                      </div>
                      
                      {/* Credits & Status */}
                      <div className="flex flex-col items-end gap-1">
                        {isCredit && isPositive && (
                          <span className="text-sm font-black" style={{ color: "#22c55e" }}>
                            +{item.amount}
                          </span>
                        )}
                        {isCredit && !isPositive && (
                          <span className="text-sm font-black" style={{ color: "#f59e0b" }}>
                            {item.amount}
                          </span>
                        )}
                        {!isCredit && isError && (
                          <span className="text-sm font-black" style={{ color: "#ef4444" }}>
                            0
                          </span>
                        )}
                        {!isCredit && !isError && isRefund && item.amount > 0 && (
                          <span className="text-sm font-black" style={{ color: "#22c55e" }}>
                            +{item.amount}
                          </span>
                        )}
                        {!isCredit && !isError && !isRefund && item.amount > 0 && (
                          <span className="text-sm font-black" style={{ color: "#ef4444" }}>
                            -{item.amount}
                          </span>
                        )}
                        <span 
                          className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                          style={{ 
                            background: statusConfig.bg, 
                            color: statusConfig.color 
                          }}
                        >
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

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


      {secondaryTab === "files" && (
        <div className="max-w-4xl mx-auto py-2 sm:py-4 animate-in fade-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="text-center mb-6">
            <h2
              className="text-2xl sm:text-3xl font-black uppercase tracking-widest mb-2"
              style={{ color: accent }}
            >
              {lang === "mm" ? "လိုင်ဘရီ" : "Library"}
            </h2>
            <p className="text-xs sm:text-sm" style={{ color: subtextColor }}>
              {lang === "mm"
                ? "သင့်ဖန်တီးထားသော ဖိုင်အားလုံးကို ဤနေရာတွင် ကြည့်ရှုပါ"
                : "All your generated files in one place"}
            </p>
          </div>

          {/* Privacy Notice */}
          <div
            className="mb-6 rounded-xl border p-4 flex items-start gap-3"
            style={{
              background: isDark ? "rgba(192,111,48,0.08)" : "rgba(192,111,48,0.04)",
              borderColor: isDark ? "rgba(192,111,48,0.25)" : "rgba(192,111,48,0.15)",
            }}
          >
            <ClockIcon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: accent }} />
            <div>
              <p className="text-sm font-bold" style={{ color: textColor }}>
                {lang === "mm" ? "လုံခြုံမှု အသိပေးချက်" : "Privacy Notice"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: subtextColor }}>
                {lang === "mm"
                  ? "ဖိုင်များကို လုံခြုံမှု အတွက် ၇ ရက် အတွင်း အလိုအလျောက် ပျက်သွားပါမည်။"
                  : "Files are automatically deleted after 7 days for security."}
              </p>
            </div>
          </div>

          {filesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div
                className="w-8 h-8 border-2 rounded-full animate-spin"
                style={{ borderColor: accent, borderTopColor: "transparent" }}
              />
            </div>
          ) : !userFiles || userFiles.length === 0 ? (
            <div
              className={box}
              style={{ background: cardBg, borderColor: cardBorder, boxShadow }}
            >
              <div className="text-center py-12 sm:py-16 px-4">
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{ background: accent15 }}
                >
                  <FolderOpen className="w-10 h-10" style={{ color: accent }} />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: textColor }}>
                  {lang === "mm" ? "လိုင်ဘရီမှာ ဖိုင် မရှိသေးပါ" : "Library is empty"}
                </h3>
                <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: subtextColor, lineHeight: "1.7" }}>
                  {lang === "mm"
                    ? "ပထမဆုံး TTS၊ Video Translate သို့မဟုတ် Dubbing ကို စတင်ဖန်တီးပါ"
                    : "Start generating your first TTS, Video Translation, or Dubbing"}
                </p>
                <button
                  onClick={() => setSecondaryTab(null)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:scale-105 hover:shadow-lg"
                  style={{ background: accent, border: `2px solid ${accent}`, color: "#fff" }}
                >
                  <Wand2 className="w-4 h-4" />
                  {lang === "mm" ? "စတင်ဖန်တီးရန်" : "Start Creating"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {([
                  { key: "all", label: lang === "mm" ? "အားလုံး" : "All", icon: FolderOpen },
                  { key: "video", label: lang === "mm" ? "ဗီဒီယို" : "Video", icon: FileVideo },
                  { key: "audio", label: lang === "mm" ? "အသံ" : "Audio", icon: FileAudio },
                  { key: "text", label: lang === "mm" ? "စာသား" : "Text", icon: FileText },
                ] as const).map((tab) => {
                  const isActive = libraryFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setLibraryFilter(tab.key)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap"
                      style={{
                        background: isActive ? accent : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                        color: isActive ? "#fff" : subtextColor,
                        border: isActive ? `2px solid ${accent}` : `2px solid ${cardBorder}`,
                        boxShadow: isActive ? `0 4px 12px ${accent}40` : "none",
                      }}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* File Sections */}
              {(() => {
                const sections = [];
                if (libraryFilter === "all" || libraryFilter === "video") {
                  const videoFiles = userFiles.filter((f) => f.type === "video");
                  if (videoFiles.length > 0) {
                    sections.push({
                      type: "video" as const,
                      title: lang === "mm" ? "ဗီဒီယိုဖိုင်များ" : "Videos",
                      icon: FileVideo,
                      color: "#ef4444",
                      files: videoFiles,
                    });
                  }
                }
                if (libraryFilter === "all" || libraryFilter === "audio") {
                  const audioFiles = userFiles.filter((f) => f.type === "audio");
                  if (audioFiles.length > 0) {
                    sections.push({
                      type: "audio" as const,
                      title: lang === "mm" ? "အသံဖိုင်များ" : "Audio",
                      icon: FileAudio,
                      color: "#8b5cf6",
                      files: audioFiles,
                    });
                  }
                }
                if (libraryFilter === "all" || libraryFilter === "audio" || libraryFilter === "text") {
                  const srtFiles = userFiles.filter((f) => f.type === "subtitle");
                  if (srtFiles.length > 0) {
                    if (libraryFilter === "audio") {
                      // Under Audio tab, show SRT alongside audio
                      const existing = sections.find((s) => s.type === "audio");
                      if (existing) {
                        existing.files = [...existing.files, ...srtFiles];
                      } else {
                        sections.push({
                          type: "audio" as const,
                          title: lang === "mm" ? "အသံ နှင့် စာတန်း" : "Audio & Subtitles",
                          icon: FileAudio,
                          color: "#8b5cf6",
                          files: srtFiles,
                        });
                      }
                    } else {
                      sections.push({
                        type: "subtitle" as const,
                        title: lang === "mm" ? "စာတန်းထိုးဖိုင်များ" : "Subtitles",
                        icon: FileText,
                        color: "#22c55e",
                        files: srtFiles,
                      });
                    }
                  }
                }
                return sections.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-sm font-semibold" style={{ color: subtextColor }}>
                      {lang === "mm" ? "ဤကဏ္ဍတွင် ဖိုင် မရှိပါ" : "No files in this category"}
                    </p>
                  </div>
                ) : (
                  sections.map((section) => (
                    <div key={section.type + section.title}>
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: section.color + "15" }}
                        >
                          <section.icon className="w-4 h-4" style={{ color: section.color }} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: textColor }}>
                          {section.title}
                        </h3>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: section.color + "15", color: section.color }}
                        >
                          {section.files.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {section.files.map((file, idx) => {
                          const shortIdMatch = file.filename.match(/LUMIX_(LMX[A-Z0-9]+)_(DUB|TRANS|TTS|SRT)/);
                          const shortId = shortIdMatch?.[1] ?? "—";
                          const feature = shortIdMatch?.[2] ?? "";
                          const size = file.size
                            ? file.size > 1024 * 1024
                              ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                              : `${(file.size / 1024).toFixed(1)} KB`
                            : "";
                          const daysLeft = file.lastModified
                            ? Math.max(0, Math.ceil(
                                (new Date(file.lastModified).getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now()) /
                                  (24 * 60 * 60 * 1000)
                              ))
                            : 7;
                          const isExpiringSoon = daysLeft <= 2;
                          return (
                            <motion.div
                              key={file.key}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="group relative rounded-2xl border overflow-hidden transition-all hover:border-opacity-60 hover:shadow-lg"
                              style={{
                                background: isDark ? "rgba(20,20,20,0.5)" : "rgba(255,255,255,0.6)",
                                borderColor: cardBorder,
                                boxShadow,
                              }}
                            >
                              {section.type === "video" ? (
                                <a
                                  href={file.downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="relative block w-full aspect-video bg-black/40 overflow-hidden"
                                >
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div
                                      className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                                      style={{ background: "rgba(192,111,48,0.9)", boxShadow: "0 4px 20px rgba(192,111,48,0.4)" }}
                                    >
                                      <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                                    </div>
                                  </div>
                                  <div className="absolute top-2 right-2">
                                    <span
                                      className="text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider backdrop-blur-md"
                                      style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
                                    >
                                      {feature}
                                    </span>
                                  </div>
                                  <div className="absolute bottom-2 left-2">
                                    <span
                                      className="text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-md"
                                      style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.8)" }}
                                    >
                                      {size}
                                    </span>
                                  </div>
                                </a>
                              ) : (
                                <div className="relative w-full aspect-video flex items-center justify-center overflow-hidden" style={{ background: section.color + "08" }}>
                                  <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                    style={{ background: section.color + "12" }}
                                  >
                                    <section.icon className="w-8 h-8" style={{ color: section.color }} />
                                  </div>
                                  <div className="absolute top-2 right-2">
                                    <span
                                      className="text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider"
                                      style={{ background: section.color + "12", color: section.color }}
                                    >
                                      {feature}
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                                    style={{ background: accent15, color: accent }}
                                  >
                                    {shortId}
                                  </span>
                                  <span className="text-[10px] font-medium" style={{ color: subtextColor }}>
                                    {size}
                                  </span>
                                </div>
                                 <p className="font-bold text-sm truncate mb-1" style={{ color: textColor }}>
                                   {file.filename}
                                 </p>
                                 <p className="text-[10px] font-medium mb-3" style={{ color: subtextColor }}>
                                   {(() => {
                                     const d = new Date(file.lastModified);
                                     const dateStr = d.toLocaleDateString(lang === "mm" ? "my-MM" : "en-US", {
                                       year: "numeric",
                                       month: "short",
                                       day: "numeric",
                                     });
                                     const timeStr = d.toLocaleTimeString(lang === "mm" ? "my-MM" : "en-US", {
                                       hour: "2-digit",
                                       minute: "2-digit",
                                       hour12: true,
                                     });
                                     return `${dateStr} · ${timeStr}`;
                                   })()}
                                 </p>
                                 <div className="flex items-center gap-1.5 mb-4">
                                   <ClockIcon
                                     className="w-3.5 h-3.5 flex-shrink-0"
                                     style={{ color: isExpiringSoon ? "#ef4444" : subtextColor }}
                                   />
                                  <span
                                    className="text-xs font-semibold"
                                    style={{ color: isExpiringSoon ? "#ef4444" : subtextColor }}
                                  >
                                    {daysLeft === 0
                                      ? lang === "mm" ? "ယနေ့ ပျက်မည်" : "Expires today"
                                      : lang === "mm"
                                        ? `⏳ ${daysLeft} ရက် ကျန်`
                                        : `⏳ ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <a
                                    href={file.downloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:brightness-110 hover:scale-[1.02]"
                                    style={{ background: accent, color: "#fff" }}
                                  >
                                    <Download className="w-4 h-4" />
                                    {lang === "mm" ? "ဒေါင်းလုတ်" : "Download"}
                                  </a>
                                  <button
                                    onClick={() => {
                                      const msg = lang === "mm" ? `"${file.filename}" ဖိုင်ကို ဖျက်မည်မှာ သေချာပါသလား?` : `Are you sure you want to delete "${file.filename}"?`;
                                      if (window.confirm(msg)) {
                                        deleteFileMutation.mutate({ key: file.key });
                                      }
                                    }}
                                    disabled={deleteFileMutation.isPending}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:brightness-110 disabled:opacity-50 hover:scale-[1.02]"
                                    style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    {lang === "mm" ? "ဖျက်ရန်" : "Delete"}
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                );
              })()}
            </div>
          )}
        </div>
      )}

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
                      "② ဗီဒီယို ဖိုင် တင်ပါ",
                      '③ "မြန်မာဘာသာပြန်မည်" နှိပ်ပါ',
                      "④ စောင့်ပါ",
                      "⑤ ရလဒ်ကို ကြည့်ပါ / ကော်ပီကူးပါ",
                    ]
                  : [
                      '① Click the "Translate" tab',
                      "② Upload a video (under 25MB)",
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
                      "② ဗီဒီယို ဖိုင် တင်ပါ",
                      '③ ဗီဒီယို Preview ကြည့်ပြီး "ဆက်လုပ်မည်" နှိပ်ပါ',
                      "④ အသံ ရွေးပါ — Standard သို့ Premium Voice",
                      "⑤ Speed / Pitch ချိန်ညှိပါ",
                      "⑥ စာတန်းထိုး ဆက်တင် ရွေးပါ",
                      '⑦ "ဖန်တီးမည်" နှိပ်ပါ',
                      "⑧ ရလဒ်ဗီဒီယိုကို Download ယူပါ",
                    ]
                  : [
                      '① Click the "Auto Creator" tab',
                      "② Upload a video (under 25MB)",
                      '③ Preview and click "Continue"',
                      "④ Select a voice — Standard or Premium",
                      "⑤ Adjust Speed / Pitch",
                      "⑥ Configure subtitle settings",
                      '⑦ Click "Generate"',
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

    </>
  );
}

export default React.memo(SecondaryTabContent);
