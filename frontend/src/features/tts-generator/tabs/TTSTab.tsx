import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import {
  Loader2,
  Download,
  Volume2,
  Sparkles,
  Copy,
  Check,
  Play,
  Mic,
  AlertCircle,
} from "lucide-react";
import CircularLoader from "@/features/tts-generator/components/CircularLoader";
import {
  ALL_VOICES,
  TIER1_VOICES,
  TIER2_VOICES,
  TIER3_VOICES,
  getVoiceCredits,
  type VoiceTier,
  type Voice,
} from "@/lib/voices";
import { accent, accentSecondary } from "@/features/tts-generator/constants/colors";
import type { ThemeValues } from "../types";

export interface TTSTabProps {
  lang: "mm" | "en";
  t: any;
  text: string;
  setText: (v: string) => void;
  selectedVoice: string;
  setSelectedVoice: (v: string) => void;
  selectedTier: VoiceTier;
  setSelectedTier: (t: VoiceTier) => void;
  tone: number;
  setTone: (v: number) => void;
  speed: number;
  setSpeed: (v: number) => void;
  aspectRatio: "9:16" | "16:9";
  setAspectRatio: (v: "9:16" | "16:9") => void;
  generatedFiles: any;
  setGeneratedFiles: (v: any) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  handleGenerate: () => Promise<void>;
  getCharLimit: (isAdmin: boolean, plan?: string | null) => number;
  isAdmin: boolean;
  currentPlan: string | undefined;
  themeValues: ThemeValues;
  showError: (msg: string) => void;
  // Inferred from outer-scope usage inside the original JSX
  hasPlan: boolean;
  me: any;
  subLoading: boolean;
  isGenerating: boolean;
  downloadFile: (content: string, filename: string) => void;
  planUsage?: any;
  planLimits?: any;
}

function TTSTab({
  lang,
  t,
  text,
  setText,
  selectedVoice,
  setSelectedVoice,
  selectedTier,
  setSelectedTier,
  tone,
  setTone,
  speed,
  setSpeed,
  aspectRatio,
  setAspectRatio,
  generatedFiles,
  setGeneratedFiles,
  audioRef,
  handleGenerate,
  getCharLimit,
  isAdmin,
  currentPlan,
  themeValues,
  showError,
  hasPlan,
  me,
  subLoading,
  isGenerating,
  downloadFile,
  planUsage,
  planLimits,
}: TTSTabProps) {
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

  const currentCharLimit = useMemo(
    () => getCharLimit(isAdmin, currentPlan),
    [getCharLimit, isAdmin, currentPlan]
  );

  return (
                  <div className="animate-in fade-in zoom-in-95 duration-300">
                    <div className="mb-2 sm:mb-4 relative text-center py-1">
                      {!isAdmin && !hasPlan && me && !subLoading && (
                      <div
                        className="mt-3 mx-auto max-w-lg flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
                        style={{
                          background: isDark
                            ? "rgba(220,38,38,0.15)"
                            : "#fef2f2",
                          border: "1px solid rgba(220,38,38,0.3)",
                          color: "#dc2626",
                        }}
                      >
                        <AlertCircle className="w-4 h-4" />
                        {lang === "mm"
                          ? "Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။"
                          : "No active subscription. Contact Admin."}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 max-w-6xl mx-auto">
                    <div className="lg:col-span-2 space-y-2">
                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                          position: "sticky",
                          top: "20px",
                          zIndex: 10,
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
                          {t.inputText}
                        </div>
                        <div className="relative">
                          <textarea
                            value={text}
                            onChange={e => {
                              if (
                                !isAdmin &&
                                e.target.value.length > currentCharLimit
                              )
                                return;
                              setText(e.target.value);
                            }}
                            placeholder={t.inputPlaceholder}
                            disabled={!hasPlan}
                            className="w-full h-28 sm:h-32 md:h-40 p-3 sm:p-4 pr-24 border rounded-xl focus:outline-none focus:ring-2 resize-none disabled:opacity-50 transition-colors text-sm leading-relaxed"
                            style={{
                              background: inputBg,
                              borderColor:
                                !isAdmin && text.length > currentCharLimit * 0.9
                                  ? text.length >= currentCharLimit
                                    ? "#dc2626"
                                    : "#f59e0b"
                                  : inputBorder,
                              color: textColor,
                              fontFamily:
                                lang === "mm"
                                  ? "'Pyidaungsu', sans-serif"
                                  : "inherit",
                            }}
                          />
                          {/* Real-time character count - always visible */}
                          <div
                            className="absolute bottom-3 right-3 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                            style={{
                              background:
                                !isAdmin && text.length > currentCharLimit * 0.9
                                  ? text.length >= currentCharLimit
                                    ? "rgba(220, 38, 38, 0.2)"
                                    : "rgba(245, 158, 11, 0.2)"
                                  : inputBg,
                              color:
                                !isAdmin && text.length > currentCharLimit * 0.9
                                  ? text.length >= currentCharLimit
                                    ? "#dc2626"
                                    : "#f59e0b"
                                  : accent,
                              border: `1px solid ${!isAdmin && text.length > currentCharLimit * 0.9 ? (text.length >= currentCharLimit ? "#dc2626" : "#f59e0b") : accent}`,
                            }}
                          >
                            {text.length.toLocaleString()} /{" "}
                            {!isAdmin && hasPlan
                              ? currentCharLimit.toLocaleString()
                              : "∞"}
                          </div>
                        </div>
                        <div
                          className="mt-2 flex items-center justify-between text-xs font-semibold"
                          style={{ color: subtextColor }}
                        >
                          <span>
                            {!isAdmin &&
                              hasPlan &&
                              currentPlan !== "trial" &&
                              planUsage &&
                              planLimits && <></>}
                          </span>
                          <span className="text-[10px] opacity-70">
                            {lang === "mm" ? "စာလုံး" : "characters"}
                          </span>
                        </div>
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
                          {t.voiceSelection}
                        </div>

                        {/* Tier Tabs */}
                        <div className="flex gap-1 p-2">
                          {([
                            { id: "tier1" as VoiceTier, label: "Tier 1", subLabel: lang === "mm" ? "၁ ကရက်ဒစ်" : "1 Credit", voices: TIER1_VOICES },
                            { id: "tier2" as VoiceTier, label: "Tier 2", subLabel: lang === "mm" ? "၃ ကရက်ဒစ်" : "3 Credits", voices: TIER2_VOICES },
                            { id: "tier3" as VoiceTier, label: "Tier 3", subLabel: lang === "mm" ? "၅ ကရက်ဒစ်" : "5 Credits", voices: TIER3_VOICES },
                          ] as const).map(tier => (
                            <button
                              key={tier.id}
                              onClick={() => setSelectedTier(tier.id)}
                              className="flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all"
                              style={{
                                background: selectedTier === tier.id
                                  ? `linear-gradient(135deg, ${accent}30, ${accentSecondary}20)`
                                  : "transparent",
                                border: `1px solid ${selectedTier === tier.id ? accent : cardBorder}`,
                                color: selectedTier === tier.id ? accent : subtextColor,
                              }}
                            >
                              <div>{tier.label}</div>
                              <div className="text-[9px] font-normal opacity-60">{tier.subLabel}</div>
                            </button>
                          ))}
                        </div>

                        {/* Voice Grid */}
                        <div className="px-2 pb-2 space-y-3">
                          {/* Males */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1" style={{ color: subtextColor }}>
                              {t.male}
                            </p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                              {ALL_VOICES.filter(v => v.tier === selectedTier && v.gender === "male").map(v => (
                                <button
                                  key={v.id}
                                  disabled={!hasPlan}
                                  onClick={() => setSelectedVoice(v.id)}
                                  className="py-2 px-2 border rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                  style={{
                                    borderColor: selectedVoice === v.id ? accent : cardBorder,
                                    background: selectedVoice === v.id
                                      ? isDark ? "rgba(192,111,48,0.2)" : "rgba(244,179,79,0.08)"
                                      : "transparent",
                                    color: selectedVoice === v.id ? accent : textColor,
                                  }}
                                >
                                  <div className=" truncate">{lang === "mm" ? v.nameMm : v.name}</div>
                                  <div className="text-[9px] font-normal opacity-50">{v.description.split(" ")[0]}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Females */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1" style={{ color: subtextColor }}>
                              {t.female}
                            </p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                              {ALL_VOICES.filter(v => v.tier === selectedTier && v.gender === "female").map(v => (
                                <button
                                  key={v.id}
                                  disabled={!hasPlan}
                                  onClick={() => setSelectedVoice(v.id)}
                                  className="py-2 px-2 border rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                  style={{
                                    borderColor: selectedVoice === v.id ? accent : cardBorder,
                                    background: selectedVoice === v.id
                                      ? isDark ? "rgba(192,111,48,0.2)" : "rgba(244,179,79,0.08)"
                                      : "transparent",
                                    color: selectedVoice === v.id ? accent : textColor,
                                  }}
                                >
                                  <div className="truncate">{lang === "mm" ? v.nameMm : v.name}</div>
                                  <div className="text-[9px] font-normal opacity-50">{v.description.split(" ")[0]}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {[
                          {
                            label: t.tone,
                            value: tone,
                            setValue: setTone,
                            min: -20,
                            max: 20,
                            step: 1,
                            display: `${tone > 0 ? "+" : ""}${tone} Hz`,
                            leftLabel: t.lower,
                            rightLabel: t.higher,
                          },
                          {
                            label: t.speed,
                            value: speed,
                            setValue: setSpeed,
                            min: 0.5,
                            max: 2.0,
                            step: 0.1,
                            display: `${speed.toFixed(1)}x`,
                            leftLabel: t.slower,
                            rightLabel: t.faster,
                          },
                        ].map(
                          ({
                            label: lbl,
                            value,
                            setValue,
                            min,
                            max,
                            step,
                            display,
                            leftLabel,
                            rightLabel,
                          }) => (
                            <div
                              key={lbl}
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
                                {lbl}
                              </div>
                              <div className="mt-2">
                                <Slider
                                  value={[value]}
                                  onValueChange={v => setValue(v[0])}
                                  min={min}
                                  max={max}
                                  step={step}
                                  disabled={!hasPlan}
                                  className="w-full"
                                />
                                <div className="flex justify-between items-center text-xs font-bold mt-3 sm:mt-4">
                                  <span style={{ color: subtextColor }}>
                                    {leftLabel}
                                  </span>
                                  <span style={{ color: accent }}>
                                    {display}
                                  </span>
                                  <span style={{ color: subtextColor }}>
                                    {rightLabel}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 sm:space-y-6">
                      <div
                        className={box}
                        style={{
                          background: cardBg,
                          borderColor: cardBorder,
                          boxShadow,
                          position: "sticky",
                          top: "20px",
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
                          {t.aspectRatio}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6 mt-1">
                          {(["9:16", "16:9"] as const).map(ratio => (
                            <button
                              key={ratio}
                              onClick={() => setAspectRatio(ratio)}
                              disabled={!hasPlan}
                              className="py-2.5 sm:py-3 border rounded-xl font-black uppercase transition-all disabled:opacity-40"
                              style={{
                                borderColor:
                                  aspectRatio === ratio ? accent : cardBorder,
                                background:
                                  aspectRatio === ratio
                                    ? isDark
                                      ? "rgba(192,111,48,0.15)"
                                      : "rgba(244,179,79,0.06)"
                                    : "transparent",
                                color:
                                  aspectRatio === ratio ? accent : textColor,
                                boxShadow:
                                  aspectRatio === ratio && !isDark
                                    ? "0 4px 12px rgba(192,111,48,0.15)"
                                    : "none",
                              }}
                            >
                              {ratio}
                            </button>
                          ))}
                        </div>

                        <motion.button
                          onClick={handleGenerate}
                          disabled={
                            isGenerating ||
                            !text.trim() ||
                            !hasPlan ||
                            (!isAdmin && text.length > currentCharLimit)
                          }
                          whileHover={{ scale: isGenerating ? 1 : 1.02 }}
                          whileTap={{ scale: isGenerating ? 1 : 0.98 }}
                          className="w-full relative overflow-hidden group flex items-center justify-center gap-3 py-4 sm:py-5 rounded-2xl text-white font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                          style={{
                            background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                          {isGenerating ? (
                            <>
                              <div className="relative flex items-center gap-3">
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                  className="relative"
                                >
                                  <Loader2 className="w-6 h-6" />
                                </motion.div>
                                <motion.div
                                  animate={{ scale: [0.8, 1.2, 0.8] }}
                                  transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                                  className="w-3 h-3 rounded-full bg-white"
                                />
                                <motion.div
                                  animate={{ scale: [0.8, 1.2, 0.8] }}
                                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                  className="w-3 h-3 rounded-full bg-white"
                                />
                                <motion.div
                                  animate={{ scale: [0.8, 1.2, 0.8] }}
                                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                                  className="w-3 h-3 rounded-full bg-white"
                                />
                              </div>
                              <span className="relative z-10">{t.generating}</span>
                            </>
                          ) : (
                            <>
                              <div className="relative">
                                <Volume2 className="w-6 h-6" />
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
                              </div>
                              <span className="relative z-10">{t.generate}</span>
                              <span
                                className="relative z-10 px-3 py-1.5 rounded-full text-[13px] font-black"
                                style={{
                                  background: "#fff",
                                  color: accent,
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                                }}
                              >
                                {getVoiceCredits(selectedVoice)} credits
                              </span>
                              <Sparkles className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </>
                          )}
                        </motion.button>

                        {generatedFiles && (
                          <div
                            className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t"
                            style={{ borderColor: cardBorder }}
                          >
                            <p
                              className="text-xs font-bold uppercase tracking-wider mb-3"
                              style={{ color: subtextColor }}
                            >
                              {t.preview}{" "}
                              {generatedFiles.durationMs > 0 &&
                                `(${Math.floor(generatedFiles.durationMs / 1000 / 60)}:${String(Math.floor(generatedFiles.durationMs / 1000) % 60).padStart(2, "0")})`}
                            </p>
                            <audio
                              ref={audioRef}
                              controls
                              className="w-full mb-4 rounded-xl"
                              style={{ accentColor: accent }}
                            />
                            <div className="space-y-3">
                              <button
                                onClick={() => {
                                  const a = document.createElement("a");
                                  a.href = generatedFiles.audioObjectUrl;
                                  a.download = `Myanmar_TTS_${Date.now()}.mp3`;
                                  a.click();
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border font-bold text-sm transition-colors"
                                style={{
                                  borderColor: accent,
                                  color: accent,
                                  background: isDark
                                    ? "rgba(192,111,48,0.1)"
                                    : "rgba(244,179,79,0.05)",
                                }}
                              >
                                <Download className="w-4 h-4" /> MP3 Audio
                              </button>
                              <button
                                onClick={() =>
                                  downloadFile(
                                    generatedFiles.srtContent,
                                    `Myanmar_TTS_${aspectRatio.replace(":", "x")}_${Date.now()}.srt`
                                  )
                                }
                                className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border font-bold text-sm transition-colors"
                                style={{
                                  borderColor: accentSecondary,
                                  color: accentSecondary,
                                  background: isDark
                                    ? "rgba(244,179,79,0.1)"
                                    : "rgba(244,179,79,0.05)",
                                }}
                              >
                                <Download className="w-4 h-4" /> SRT (
                                {aspectRatio})
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
  );
}

export default React.memo(TTSTab);
