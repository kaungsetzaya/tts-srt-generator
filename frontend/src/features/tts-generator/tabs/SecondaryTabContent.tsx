import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Calendar,
  CheckCircle2,
  Layout,
  Layers,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

function SectionHeader({ title, subtitle, icon: Icon, accent }: { title: string; subtitle?: string; icon: any; accent: string }) {
  return (
    <div className="text-center mb-8 sm:mb-10">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl mb-4 shadow-xl" style={{ background: `linear-gradient(135deg, ${accent}20, ${accent}05)`, border: `1px solid ${accent}30` }}>
        <Icon className="w-8 h-8" style={{ color: accent }} />
      </div>
      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
        {title}
      </h2>
      {subtitle && <p className="text-sm font-bold mt-2 opacity-60 px-4">{subtitle}</p>}
    </div>
  );
}

function SecondaryTabContent(props: SecondaryTabContentProps) {
  const {
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
    logoutMutation,
    themeValues,
    accent,
    accentSecondary,
    setSecondaryTab,
    showSuccess,
  } = props;

  const { fmtTime } = useSystemTime();
  const { isDark, textColor, subtextColor, cardBg, cardBorder, boxShadow, inputBg, inputBorder, labelBg, box, labelStyle } = themeValues;

  if (!secondaryTab) return null;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4">
      {/* ── SETTINGS TAB ── */}
      {secondaryTab === "settings" && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto py-2 sm:py-6">
          <SectionHeader title={t.settingsTitle} icon={Settings} accent={accent} />
          
          <div className="space-y-6">
            <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
              <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>
                <ShieldCheck className="w-3.5 h-3.5 mr-2" /> API Configuration
              </div>
              <div className="mt-4 space-y-5">
                <div>
                  <h3 className="font-black text-sm mb-1 uppercase tracking-wider">{t.geminiKey}</h3>
                  <p className="text-xs font-bold opacity-60 mb-4">{t.geminiKeyDesc}</p>
                  
                  <AnimatePresence mode="wait">
                    {savedKey ? (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        className="p-4 border-2 border-green-500/30 bg-green-500/5 rounded-2xl mb-5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-xs text-green-600 font-black uppercase tracking-widest">{t.keyActive}</p>
                            <p className="text-xs font-mono opacity-60">{savedKey.slice(0, 8)}{"*".repeat(12)}</p>
                          </div>
                        </div>
                        <button onClick={() => { setSavedKey(""); localStorage.removeItem("gemini_key"); }} className="text-[10px] font-black text-red-500 hover:underline uppercase tracking-tighter">
                          {t.removeKey}
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 border border-dashed rounded-2xl mb-5 text-center" style={{ borderColor: cardBorder }}>
                        <p className="text-xs font-bold opacity-40">{t.keyNone}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3 flex-col sm:flex-row">
                    <div className="relative flex-1">
                      <input
                        value={geminiKey}
                        onChange={e => setGeminiKey(e.target.value)}
                        placeholder={t.geminiKeyPlaceholder}
                        className="w-full p-3.5 pl-4 rounded-xl border focus:ring-2 focus:ring-orange-500/20 font-mono text-sm transition-all"
                        style={{ background: inputBg, borderColor: inputBorder, color: textColor }}
                      />
                    </div>
                    <button
                      onClick={() => { if (geminiKey.trim()) { setSavedKey(geminiKey.trim()); localStorage.setItem("gemini_key", geminiKey.trim()); setGeminiKey(""); showSuccess("API Key Saved Successfully"); } }}
                      className="px-6 py-3.5 font-black text-xs uppercase tracking-widest text-white rounded-xl transition-all hover:scale-[1.03] active:scale-95 shadow-lg"
                      style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})` }}
                    >
                      {t.saveKey}
                    </button>
                  </div>
                  <p className="text-[10px] font-bold mt-4 flex items-center gap-1.5 px-1" style={{ color: "#ef4444" }}>
                    <AlertCircle className="w-3 h-3" /> {t.keyWarning}
                  </p>
                </div>
              </div>
            </div>

            <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
              <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>
                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Quick Access
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                {[
                  { id: "history", icon: HistoryIcon, label: lang === "mm" ? "မှတ်တမ်း" : "History" },
                  { id: "plan", icon: Star, label: "Subscription" },
                  { id: "guide", icon: BookOpen, label: lang === "mm" ? "လမ်းညွှန်" : "Guide" }
                ].map(link => (
                  <button
                    key={link.id}
                    onClick={() => setSecondaryTab(link.id as any)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all hover:scale-105 active:scale-95 group"
                    style={{ background: inputBg, borderColor: cardBorder }}
                  >
                    <link.icon className="w-5 h-5 transition-colors group-hover:text-orange-500" style={{ color: accent }} />
                    <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: textColor }}>{link.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── HISTORY TAB ── */}
      {secondaryTab === "history" && (
        <div className="max-w-3xl mx-auto py-2 sm:py-6">
          <SectionHeader title={lang === "mm" ? "အသုံးပြုမှတ်တမ်း" : "Usage History"} subtitle={lang === "mm" ? "သင်၏ ဖန်တီးမှုအားလုံးကို ဤနေရာတွင် ကြည့်နိုင်ပါသည်" : "View all your past generations here"} icon={HistoryIcon} accent={accent} />
          
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <CircularLoader size={40} stroke={3} color={accent} />
              <p className="text-sm font-black animate-pulse uppercase tracking-widest" style={{ color: accent }}>Refreshing History</p>
            </div>
          ) : !unifiedHistory || unifiedHistory.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
              <div className="text-center py-16 px-4">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: accent15 }}>
                  <ClockIcon className="w-10 h-10" style={{ color: accent }} />
                </div>
                <h3 className="text-xl font-black mb-2 uppercase tracking-wide">{lang === "mm" ? "မှတ်တမ်း မရှိသေးပါ" : "No history yet"}</h3>
                <p className="text-sm font-bold opacity-60 mb-8 max-w-sm mx-auto leading-relaxed">{lang === "mm" ? "သင်၏ ပထမ TTS ဖန်တီးမှုကို စတင်ပါ။ စာသားရိုက်ထည့်ပြီး Generate ခလုတ်ကို နှိပ်ပါ" : "Start generating your first creation! Your history records will appear right here."}</p>
                <button onClick={() => setSecondaryTab(null)} className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all hover:scale-105 shadow-xl text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})` }}>
                  {lang === "mm" ? "စတင်ဖန်တီးရန်" : "Start Generating"}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
              {(unifiedHistory?.reduce((acc: any[], item: any) => {
                if (acc.find(x => x.id === item.id)) return acc;
                acc.push(item); return acc;
              }, []) || []).map((item: any) => {
                const isCredit = item.origin === "credit";
                const isError = item.status === "fail";
                const isRefund = item.type === "REFUND" || item.type === "tts_refund";
                const isPositive = (item.amount || 0) > 0;
                
                const labels: Record<string, string> = lang === "mm" ? { tts: "စာမှအသံ", translate_file: "ဗီဒီယိုဘာသာပြန်", translate_link: "Link ဘာသာပြန်", dub_file: "Auto Creator", dub_link: "Auto Creator", TRIAL: "Trial Reward", REFUND: "Refund", GEN_AUDIO: "TTS", VIDEO_DUB: "Auto Creator", SUBSCRIPTION: "Plan Purchase", tts_refund: "Refund" } : { tts: "TTS", translate_file: "Video Translate", dub_file: "Auto Creator", TRIAL: "Trial Reward", REFUND: "Refund", GEN_AUDIO: "TTS", VIDEO_DUB: "Auto Creator", SUBSCRIPTION: "Plan Purchase", tts_refund: "Refund" };
                const label = labels[item.type] || item.type.replace("_", " ");

                return (
                  <motion.div
                    key={item.id} variants={itemVariants}
                    className="group relative flex items-center gap-4 p-4 rounded-2xl border backdrop-blur-xl transition-all hover:scale-[1.01] hover:shadow-lg"
                    style={{ background: cardBg, borderColor: isError ? "#ef444430" : cardBorder }}
                  >
                    <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" style={{ background: isError ? "#ef4444" : isRefund ? "#22c55e" : accent }} />
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shadow-inner shrink-0" style={{ background: isError ? "rgba(239,68,68,0.15)" : isRefund ? "rgba(34,197,94,0.15)" : accent15, color: isError ? "#ef4444" : isRefund ? "#22c55e" : accent }}>
                      {item.type?.includes("translate") ? <FileVideo className="w-5 h-5" /> : item.type?.includes("dub") ? <Wand2 className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-black text-sm uppercase tracking-wide truncate">{label}</span>
                        {isError && <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-black uppercase">Failed</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold opacity-50 uppercase">
                        <ClockIcon className="w-3 h-3" /> {fmtTime(item.createdAt)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-black ${isPositive ? "text-green-500" : isError ? "opacity-20" : "text-orange-500"}`}>
                        {isPositive ? "+" : isError ? "" : "-"}{item.amount || 0}
                      </div>
                      <div className="text-[9px] font-black uppercase opacity-40">Credits</div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      )}

      {/* ── PLAN TAB ── */}
      {secondaryTab === "plan" && (
        <div className="max-w-4xl mx-auto py-2 sm:py-6">
          <SectionHeader title={lang === "mm" ? "သင့် Plan" : "Your Plan"} icon={Crown} accent={accent} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-3xl border-2 p-6 sm:p-8 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}15, ${cardBg})`, borderColor: accent40, boxShadow }}>
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Crown className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-orange-500/10 shadow-inner">
                      <Star className="w-6 h-6 text-orange-500" fill="currentColor" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-widest">{currentPlan === "trial" ? (lang === "mm" ? "အစမ်းသုံး Plan" : "Trial Plan") : currentPlan?.toUpperCase()}</h3>
                      <p className="text-xs font-bold opacity-60 uppercase tracking-tighter">Current active subscription</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {(() => {
                      const tu = (subStatus as any)?.trialUsage;
                      const tl = (subStatus as any)?.trialLimits;
                      const data = currentPlan === "trial" && tu && tl ? [
                        { label: lang === "mm" ? "TTS (Standard)" : "TTS (Standard)", used: tu.tts || 0, total: tl.totalTtsSrt || 0, color: accent },
                        { label: lang === "mm" ? "TTS (Premium)" : "TTS (Premium)", used: tu.characterUse || 0, total: tl.totalCharacterUse || 0, color: "#f59e0b" },
                        { label: lang === "mm" ? "ဗီဒီယိုဘာသာပြန်" : "Video Translation", used: tu.videoTranslate || 0, total: tl.totalVideoTranslate || 0, color: "#60a5fa" },
                        { label: lang === "mm" ? "ဗီဒီယိုဖန်တီးမှု" : "Video Creation", used: tu.aiVideo || 0, total: tl.totalAiVideo || 0, color: "#4ade80" }
                      ] : planUsage && planLimits ? [
                        { label: lang === "mm" ? "TTS (Standard)" : "TTS (Standard)", used: planUsage.tts || 0, total: planLimits.dailyTtsSrt || 0, color: accent },
                        { label: lang === "mm" ? "TTS (Premium)" : "TTS (Premium)", used: planUsage.characterUse || 0, total: planLimits.dailyCharacterUse || 0, color: "#f59e0b" },
                        { label: lang === "mm" ? "ဗီဒီယိုဘာသာပြန်" : "Video Translation", used: planUsage.videoTranslate || 0, total: planLimits.dailyVideoTranslate || 0, color: "#60a5fa" },
                        { label: lang === "mm" ? "ဗီဒီယိုဖန်တီးမှု" : "Video Creation", used: planUsage.aiVideo || 0, total: planLimits.dailyAiVideo || 0, color: "#4ade80" }
                      ] : [];

                      return data.map((u, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">{u.label}</span>
                            <span className="text-xs font-black" style={{ color: u.used >= u.total ? "#ef4444" : u.color }}>{u.used} / {u.total}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/5 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((u.used / u.total) * 100, 100)}%` }} className="h-full rounded-full" style={{ background: u.used >= u.total ? "#ef4444" : u.color }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className={box} style={{ background: cardBg, borderColor: cardBorder, boxShadow }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-orange-500" fill="currentColor" />
                  </div>
                  <h4 className="font-black text-sm uppercase tracking-wider">Quick Top-up</h4>
                </div>
                <p className="text-xs font-medium opacity-60 mb-5 leading-relaxed">Need more credits? You can upgrade your plan anytime to get instant access.</p>
                <button className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg transition-transform hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})` }}>
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LIBRARY (FILES) TAB ── */}
      {secondaryTab === "files" && (
        <div className="max-w-6xl mx-auto py-2 sm:py-6">
          <SectionHeader title={lang === "mm" ? "လိုင်ဘရီ" : "Library"} subtitle={lang === "mm" ? "သင်၏ သိမ်းဆည်းထားသော ဖိုင်အားလုံး" : "Your stored generations & uploads"} icon={FolderOpen} accent={accent} />
          
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/5 dark:bg-white/5 border" style={{ borderColor: cardBorder }}>
              {["all", "video", "audio"].map((f) => (
                <button
                  key={f} onClick={() => setLibraryFilter(f as any)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${libraryFilter === f ? "shadow-md scale-105" : "opacity-40 hover:opacity-100"}`}
                  style={libraryFilter === f ? { background: accent, color: "#fff" } : { color: textColor }}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border opacity-60 text-[11px] font-black uppercase tracking-tighter" style={{ borderColor: cardBorder }}>
              <Info className="w-3.5 h-3.5" /> Auto-deletes in 7 days
            </div>
          </div>

          {filesLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <CircularLoader size={48} stroke={4} color={accent} />
              <p className="text-sm font-black animate-pulse uppercase tracking-[0.3em]" style={{ color: accent }}>Syncing Library</p>
            </div>
          ) : !userFiles || userFiles.length === 0 ? (
            <div className="text-center py-32 rounded-3xl border border-dashed" style={{ borderColor: cardBorder, background: cardBg }}>
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center" style={{ background: accent15 }}>
                <FolderOpen className="w-10 h-10" style={{ color: accent }} opacity={0.3} />
              </div>
              <h3 className="text-xl font-black mb-2 uppercase tracking-wide">Empty Library</h3>
              <p className="text-sm font-bold opacity-40 max-w-xs mx-auto">Upload or generate content to see your library fill up.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {(() => {
                const grouped = [
                  { type: "video", label: lang === "mm" ? "ဗီဒီယိုများ" : "Videos", icon: FileVideo, color: "#60a5fa", files: userFiles.filter(f => f.filename.match(/\.(mp4|mov|avi|webm)$/i)) },
                  { type: "audio", label: lang === "mm" ? "အသံဖိုင်များ" : "Audio Files", icon: FileAudio, color: "#f59e0b", files: userFiles.filter(f => f.filename.match(/\.(mp3|wav|ogg|m4a)$/i)) },
                  { type: "text", label: lang === "mm" ? "စာသားဖိုင်များ" : "SRT/Docs", icon: FileText, color: "#4ade80", files: userFiles.filter(f => f.filename.match(/\.(srt|txt|vtt)$/i)) }
                ].filter(s => s.files.length > 0 && (libraryFilter === "all" || libraryFilter === s.type));

                return grouped.map(section => (
                  <motion.div key={section.type} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex items-center gap-3 px-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: section.color + "20" }}>
                        <section.icon className="w-4 h-4" style={{ color: section.color }} />
                      </div>
                      <h4 className="font-black text-sm uppercase tracking-[0.2em]">{section.label}</h4>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: section.color + "15", color: section.color }}>{section.files.length}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {section.files.map((file, idx) => {
                        const shortIdMatch = file.filename.match(/LUMIX_(LMX[A-Z0-9]+)_(DUB|TRANS|TTS|SRT)/);
                        const shortId = shortIdMatch?.[1] ?? "FILE";
                        const typeTag = shortIdMatch?.[2] ?? section.type.toUpperCase();
                        const daysLeft = file.lastModified ? Math.max(0, Math.ceil((new Date(file.lastModified).getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))) : 7;
                        
                        return (
                          <motion.div
                            key={file.key} variants={itemVariants} initial="hidden" animate="show"
                            className="group relative flex flex-col rounded-3xl border overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl"
                            style={{ background: cardBg, borderColor: cardBorder }}
                          >
                            {section.type === "video" ? (
                              <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer" className="relative aspect-video bg-black/60 flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-orange-500 shadow-xl transition-transform group-hover:scale-110">
                                  <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                                </div>
                                <div className="absolute top-3 right-3 flex gap-1.5">
                                  <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-black text-white uppercase tracking-widest">{typeTag}</span>
                                </div>
                              </a>
                            ) : (
                              <div className="aspect-video flex items-center justify-center relative" style={{ background: `linear-gradient(135deg, ${section.color}15, ${section.color}05)` }}>
                                <section.icon className="w-10 h-10" style={{ color: section.color }} opacity={0.4} />
                                <div className="absolute top-3 right-3">
                                  <span className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md text-[9px] font-black uppercase tracking-widest" style={{ color: section.color }}>{typeTag}</span>
                                </div>
                              </div>
                            )}

                            <div className="p-4 flex-1 flex flex-col">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider" style={{ background: accent15, color: accent }}>{shortId}</span>
                                <span className="text-[10px] font-bold opacity-40 ml-auto">{fmtTime(file.lastModified).split(' ')[0]}</span>
                              </div>
                              <h5 className="text-sm font-black truncate mb-3" style={{ color: textColor }}>{file.filename}</h5>
                              
                              <div className="mt-auto space-y-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-white/5">
                                  <ClockIcon className={`w-3.5 h-3.5 ${daysLeft <= 2 ? "text-red-500 animate-pulse" : "opacity-40"}`} />
                                  <span className={`text-[10px] font-black uppercase tracking-tighter ${daysLeft <= 2 ? "text-red-500" : "opacity-50"}`}>
                                    {daysLeft === 0 ? "Expires Today" : `${daysLeft} Days Remaining`}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <a href={file.downloadUrl} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
                                    <Download className="w-3.5 h-3.5" /> <span className="text-[10px] font-black uppercase">Save</span>
                                  </a>
                                  <button onClick={() => { if(window.confirm(`Delete "${file.filename}"?`)) deleteFileMutation.mutate({ key: file.key }); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-colors hover:bg-red-500 hover:text-white">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── GUIDE TAB ── */}
      {secondaryTab === "guide" && (
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
