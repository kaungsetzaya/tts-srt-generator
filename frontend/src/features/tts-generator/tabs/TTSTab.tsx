import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import {
  Loader2,
  Download,
  Volume2,
  Sparkles,
  AlertCircle,
  Mic,
} from "lucide-react";
import {
  ALL_VOICES,
  TIER1_VOICES,
  TIER2_VOICES,
  TIER3_VOICES,
  getVoiceCredits,
  type VoiceTier,
} from "@/lib/voices";
import { useThemeStyles } from "@/features/tts-generator/hooks/useThemeStyles";
import type { ThemeValues } from "../types";

// ── Types ──
export interface TTSTabProps {
  lang: "mm" | "en";
  t: Record<string, string>;
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
  generatedFiles: {
    audioObjectUrl: string;
    srtContent: string;
    durationMs: number;
  } | null;
  setGeneratedFiles: (v: any) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  handleGenerate: () => Promise<void>;
  getCharLimit: (isAdmin: boolean, plan?: string | null) => number;
  isAdmin: boolean;
  currentPlan: string | undefined;
  themeValues: ThemeValues;
  showError: (msg: string) => void;
  hasPlan: boolean;
  me: { id?: string } | null;
  subLoading: boolean;
  isGenerating: boolean;
  downloadFile: (content: string, filename: string) => void;
  planUsage?: Record<string, number>;
  planLimits?: Record<string, number>;
}

// ── Tier definitions ──
const TIERS = [
  { id: "tier1" as VoiceTier, label: "Tier 1", credits: 1, voices: TIER1_VOICES },
  { id: "tier2" as VoiceTier, label: "Tier 2", credits: 3, voices: TIER2_VOICES },
  { id: "tier3" as VoiceTier, label: "Tier 3", credits: 5, voices: TIER3_VOICES },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function TTSTab(props: TTSTabProps) {
  const styles = useThemeStyles(props.themeValues);
  const { isDark, textColor, subtextColor } = props.themeValues;
  const charLimit = useMemo(
    () => props.getCharLimit(props.isAdmin, props.currentPlan),
    [props.getCharLimit, props.isAdmin, props.currentPlan]
  );

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <NoSubscriptionAlert {...props} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 max-w-6xl mx-auto">
        {/* LEFT COLUMN — Inputs */}
        <div className="lg:col-span-2 space-y-3">
          <TextInputCard {...props} charLimit={charLimit} styles={styles} />
          <VoiceSelector {...props} styles={styles} />
          <ControlsGrid {...props} styles={styles} />
        </div>

        {/* RIGHT COLUMN — Action + Result */}
        <div className="space-y-4">
          <ActionCard {...props} styles={styles} />
        </div>
      </div>
    </div>
  );
}

// ── No-Subscription Banner ──
function NoSubscriptionAlert({ isAdmin, hasPlan, me, subLoading, lang, themeValues }: TTSTabProps) {
  if (isAdmin || hasPlan || !me || subLoading) return null;
  const { isDark } = themeValues;
  return (
    <div
      className="mt-2 mx-auto max-w-lg flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
      style={{
        background: isDark ? "rgba(220,38,38,0.12)" : "#fef2f2",
        border: "1px solid rgba(220,38,38,0.25)",
        color: "#dc2626",
      }}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      {lang === "mm"
        ? "Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။"
        : "No active subscription. Contact Admin."}
    </div>
  );
}

// ── Text Input Card ──
function TextInputCard({
  lang,
  t,
  text,
  setText,
  isAdmin,
  hasPlan,
  currentPlan,
  styles,
  charLimit,
}: TTSTabProps & { styles: ReturnType<typeof useThemeStyles>; charLimit: number }) {
  const isOverLimit = !isAdmin && text.length >= charLimit;
  const pct = isAdmin ? 0 : Math.min((text.length / charLimit) * 100, 100);
  const isWarn = !isAdmin && text.length > charLimit * 0.9 && !isOverLimit;

  let barColor = "#C06F30";
  if (isOverLimit) barColor = "#dc2626";
  else if (isWarn) barColor = "#f59e0b";

  return (
    <section {...styles.card}>
      <div {...styles.label}>{t.inputText}</div>
      <div className="relative">
        <label htmlFor="tts-text" className="sr-only">
          {t.inputPlaceholder}
        </label>
        <textarea
          id="tts-text"
          value={text}
          onChange={(e) => {
            if (!isAdmin && e.target.value.length > charLimit) return;
            setText(e.target.value);
          }}
          placeholder={t.inputPlaceholder}
          disabled={!hasPlan}
          aria-invalid={isOverLimit}
          aria-describedby="char-count"
          className={`${styles.input.className} h-28 sm:h-32 md:h-40 p-3 sm:p-4 resize-none text-sm leading-relaxed`}
          style={{
            ...styles.input.style,
            borderColor: isOverLimit
              ? "#dc2626"
              : isWarn
                ? "#f59e0b"
                : styles.input.style.borderColor,
            fontFamily: lang === "mm" ? "'Pyidaungsu', sans-serif" : "inherit",
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          }}
        />
        {/* Progress bar */}
        <div className="h-[3px] w-full" style={{ background: styles.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
          <div
            className="h-full transition-all duration-300 ease-out rounded-r-full"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>
        {/* Counter footer */}
        <div
          id="char-count"
          className="flex items-center justify-between px-3 py-2 rounded-b-xl border-t-0 border"
          style={{
            background: styles.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)",
            borderColor: isOverLimit
              ? "#dc2626"
              : isWarn
                ? "#f59e0b"
                : styles.inputBorder,
            borderTop: "none",
          }}
          aria-live="polite"
        >
          <span className="text-[11px] font-semibold" style={{ color: styles.subtextColor }}>
            {lang === "mm" ? "စာလုံး" : "characters"}
          </span>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: barColor }}>
            {text.length.toLocaleString()}
            <span className="opacity-40 mx-0.5" style={{ color: styles.subtextColor }}>/</span>
            <span style={{ color: styles.subtextColor }}>
              {!isAdmin && hasPlan ? charLimit.toLocaleString() : "∞"}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

// ── Voice Selector ──
function VoiceSelector({
  lang,
  t,
  selectedVoice,
  setSelectedVoice,
  selectedTier,
  setSelectedTier,
  hasPlan,
  styles,
  themeValues,
}: TTSTabProps & { styles: ReturnType<typeof useThemeStyles> }) {
  const { subtextColor } = themeValues;

  return (
    <section {...styles.card}>
      <div {...styles.label}>{t.voiceSelection}</div>

      {/* Tier Tabs */}
      <div className="flex gap-2 p-1" role="tablist" aria-label="Voice tier">
        {TIERS.map((tier) => {
          const active = selectedTier === tier.id;
          const tabStyle = styles.tierTab(active);
          return (
            <button
              key={tier.id}
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedTier(tier.id)}
              className={tabStyle.className}
              style={tabStyle.style}
            >
              <div>{tier.label}</div>
              <div className="text-[10px] font-medium opacity-70">
                {lang === "mm" ? `${tier.credits} ကရက်ဒစ်` : `${tier.credits} Credit${tier.credits > 1 ? "s" : ""}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Voice Grid */}
      <div className="px-1 pb-2 space-y-4 mt-2">
        <VoiceGroup
          title={t.male}
          gender="male"
          tier={selectedTier}
          selected={selectedVoice}
          onSelect={setSelectedVoice}
          disabled={!hasPlan}
          lang={lang}
          styles={styles}
          subtextColor={subtextColor}
        />
        <VoiceGroup
          title={t.female}
          gender="female"
          tier={selectedTier}
          selected={selectedVoice}
          onSelect={setSelectedVoice}
          disabled={!hasPlan}
          lang={lang}
          styles={styles}
          subtextColor={subtextColor}
        />
      </div>
    </section>
  );
}

// ── Voice Group (Male/Female) ──
function VoiceGroup({
  title,
  gender,
  tier,
  selected,
  onSelect,
  disabled,
  lang,
  styles,
  subtextColor,
}: {
  title: string;
  gender: "male" | "female";
  tier: VoiceTier;
  selected: string;
  onSelect: (id: string) => void;
  disabled: boolean;
  lang: "mm" | "en";
  styles: ReturnType<typeof useThemeStyles>;
  subtextColor: string;
}) {
  const voices = useMemo(
    () => ALL_VOICES.filter((v) => v.tier === tier && v.gender === gender),
    [tier, gender]
  );

  return (
    <div>
      <p
        className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1"
        style={{ color: subtextColor }}
      >
        {title}
      </p>
      <div
        className="grid grid-cols-3 sm:grid-cols-4 gap-2"
        role="radiogroup"
        aria-label={`${title} voices`}
      >
        {voices.map((v) => {
          const active = selected === v.id;
          const item = styles.gridItem(active);
          return (
            <button
              key={v.id}
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onSelect(v.id)}
              className={item.className}
              style={item.style}
            >
              <div className="truncate">{lang === "mm" ? v.nameMm : v.name}</div>
              <div className="text-[9px] font-normal opacity-50">
                {v.description?.split(" ")[0] ?? ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Speed + Tone Controls ──
function ControlsGrid({
  t,
  tone,
  setTone,
  speed,
  setSpeed,
  hasPlan,
  styles,
}: TTSTabProps & { styles: ReturnType<typeof useThemeStyles> }) {
  const controls = [
    {
      label: t.tone,
      value: tone,
      set: setTone,
      min: -20,
      max: 20,
      step: 1,
      display: `${tone > 0 ? "+" : ""}${tone} Hz`,
      left: t.lower,
      right: t.higher,
    },
    {
      label: t.speed,
      value: speed,
      set: setSpeed,
      min: 0.5,
      max: 2.0,
      step: 0.1,
      display: `${speed.toFixed(1)}x`,
      left: t.slower,
      right: t.faster,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      {controls.map((c) => (
        <section key={c.label} {...styles.card}>
          <div {...styles.label}>{c.label}</div>
          <div className="mt-2">
            <Slider
              value={[c.value]}
              onValueChange={(v) => c.set(v[0])}
              min={c.min}
              max={c.max}
              step={c.step}
              disabled={!hasPlan}
              aria-label={c.label}
              className="w-full"
            />
            <div className="flex justify-between items-center text-xs font-bold mt-3">
              <span style={{ color: styles.subtextColor }}>{c.left}</span>
              <span style={{ color: styles.accent }}>{c.display}</span>
              <span style={{ color: styles.subtextColor }}>{c.right}</span>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Action Card (Aspect Ratio + Generate + Result) ──
function ActionCard({
  lang,
  t,
  aspectRatio,
  setAspectRatio,
  hasPlan,
  isAdmin,
  text,
  charLimit,
  isGenerating,
  handleGenerate,
  selectedVoice,
  generatedFiles,
  audioRef,
  downloadFile,
  styles,
  themeValues,
}: TTSTabProps & { styles: ReturnType<typeof useThemeStyles>; charLimit: number }) {
  const { isDark } = themeValues;
  const isDisabled =
    isGenerating || !text.trim() || !hasPlan || (!isAdmin && text.length > charLimit);

  return (
    <section {...styles.card} style={{ ...styles.card.style, position: "sticky", top: 20 }}>
      <div {...styles.label}>{t.aspectRatio}</div>
      <div className="grid grid-cols-2 gap-3 mb-5 mt-1">
        {(["9:16", "16:9"] as const).map((ratio) => {
          const active = aspectRatio === ratio;
          return (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              disabled={!hasPlan}
              className="py-2.5 sm:py-3 border rounded-xl font-black uppercase transition-all disabled:opacity-40 hover:border-[#C06F30]/50"
              style={{
                borderColor: active ? styles.accent : styles.cardBorder,
                background: active
                  ? isDark
                    ? "rgba(192,111,48,0.12)"
                    : "rgba(244,179,79,0.05)"
                  : "transparent",
                color: active ? styles.accent : styles.textColor,
              }}
              aria-pressed={active}
            >
              {ratio}
            </button>
          );
        })}
      </div>

      {/* Generate Button */}
      <motion.button
        onClick={handleGenerate}
        disabled={isDisabled}
        whileHover={{ scale: isDisabled ? 1 : 1.02 }}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        className={`${styles.btnPrimary.className} w-full py-4 sm:py-5 text-sm sm:text-base gap-3`}
        style={styles.btnPrimary.style}
        aria-busy={isGenerating}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        {isGenerating ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Loader2 className="w-6 h-6" />
            </motion.div>
            <span>{t.generating}</span>
          </>
        ) : (
          <>
            <Volume2 className="w-6 h-6" aria-hidden="true" />
            <span>{t.generate}</span>
            <span
              className="px-3 py-1 rounded-full text-[13px] font-black"
              style={{ background: "#fff", color: styles.accent }}
            >
              {getVoiceCredits(selectedVoice)} cr
            </span>
            <Sparkles className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
          </>
        )}
      </motion.button>

      {/* Result Preview */}
      {generatedFiles && (
        <div className="pt-5 sm:pt-6 border-t mt-5" style={{ borderColor: styles.cardBorder }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: styles.subtextColor }}>
            {t.preview}{" "}
            {generatedFiles.durationMs > 0 &&
              `(${Math.floor(generatedFiles.durationMs / 1000 / 60)}:${String(
                Math.floor(generatedFiles.durationMs / 1000) % 60
              ).padStart(2, "0")})`}
          </p>
          <audio
            ref={audioRef}
            controls
            className="w-full mb-4 rounded-xl"
            style={{ accentColor: styles.accent }}
          />
          <div className="space-y-3">
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = generatedFiles.audioObjectUrl;
                a.download = `Myanmar_TTS_${Date.now()}.mp3`;
                a.click();
              }}
              className={`${styles.btnOutline.className} w-full py-2.5 sm:py-3`}
              style={styles.btnOutline.style}
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
              className={`${styles.btnOutline.className} w-full py-2.5 sm:py-3`}
              style={{
                ...styles.btnOutline.style,
                borderColor: styles.accentSecondary,
                color: styles.accentSecondary,
              }}
            >
              <Download className="w-4 h-4" /> SRT ({aspectRatio})
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default React.memo(TTSTab);
