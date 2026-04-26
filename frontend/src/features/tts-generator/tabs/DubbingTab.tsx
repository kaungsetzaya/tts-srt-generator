import { useState, useMemo } from "react";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Sparkles,
  Upload,
  FileVideo,
  Link as LinkIcon,
  Download,
  ChevronDown,
  Subtitles,
  Mic,
  Crown,
  Zap,
  Wand2,
  Trash2,
  Play,
  AlertCircle,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
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
import type { ThemeValues } from "../types";

export interface DubbingTabProps {
  lang: "mm" | "en";
  t: any;
  dubVideoFile: File | null;
  setDubVideoFile: (f: File | null) => void;
  dubVideoUrl: string;
  setDubVideoUrl: (v: string) => void;
  dubDragOver: boolean;
  setDubDragOver: (v: boolean) => void;
  dubResult: any;
  setDubResult: (v: any) => void;
  dubProgress: number;
  setDubProgress: (p: number) => void;
  dubProgressMessage: string;
  setDubProgressMessage: (m: string) => void;
  dubPreviewUrl: string;
  setDubPreviewUrl: (v: string) => void;
  dubDetectedRatio: "9:16" | "16:9";
  setDubDetectedRatio: (r: "9:16" | "16:9") => void;
  dubVideoWidth: number;
  setDubVideoWidth: (v: number) => void;
  dubVideoHeight: number;
  setDubVideoHeight: (v: number) => void;
  videoPreviewError: string;
  setVideoPreviewError: (v: string) => void;
  videoLoading: boolean;
  setVideoLoading: (v: boolean) => void;
  dubSelectedVoice: string;
  setDubSelectedVoice: (v: string) => void;
  dubSelectedTier: VoiceTier;
  setDubSelectedTier: (t: VoiceTier) => void;
  srtEnabled: boolean;
  setSrtEnabled: (v: boolean) => void;
  srtFontSize: number;
  setSrtFontSize: (v: number) => void;
  srtColor: string;
  setSrtColor: (v: string) => void;
  srtDropShadow: boolean;
  setSrtDropShadow: (v: boolean) => void;
  srtBlurBg: boolean;
  setSrtBlurBg: (v: boolean) => void;
  srtMarginV: number;
  setSrtMarginV: (v: number) => void;
  srtBlurOpacity: number;
  setSrtBlurOpacity: (v: number) => void;
  srtBlurColor: "black" | "white" | "transparent";
  setSrtBlurColor: (v: "black" | "white" | "transparent") => void;
  srtFullWidth: boolean;
  setSrtFullWidth: (v: boolean) => void;
  srtBorderRadius: "rounded" | "square";
  setSrtBorderRadius: (v: "rounded" | "square") => void;
  srtBoxPadding: number;
  setSrtBoxPadding: (v: number) => void;
  dubFileRef: React.RefObject<HTMLInputElement | null>;
  dubResultVideoRef: React.RefObject<HTMLVideoElement | null>;
  dubPreviewRef: React.RefObject<HTMLVideoElement | null>;
  computeSrtPreviewStyle: React.CSSProperties;
  activeJobId: string | null;
  startDubMutationPending: boolean;
  dubFileMutationPending: boolean;
  handleDubVideoFile: (f: File) => void;
  handleDubGenerate: () => Promise<void>;
  handleDubDownload: () => void;
  handleDubPreview: () => void;
  handleDubReset: () => void;
  voiceAccordionOpen: boolean;
  setVoiceAccordionOpen: (v: boolean) => void;
  speedAccordionOpen: boolean;
  setSpeedAccordionOpen: (v: boolean) => void;
  srtAccordionOpen: boolean;
  setSrtAccordionOpen: (v: boolean) => void;
  isAdmin: boolean;
  hasActiveSub: boolean;
  hasPlan: boolean;
  me: any;
  subLoading: boolean;
  themeValues: ThemeValues;
  accent: string;
  accentSecondary: string;
  showError: (msg: string) => void;
  linkPreview?: { title: string; description: string; image: string; siteName: string } | null;
  linkPreviewLoading?: boolean;
}

function DubbingTab({
  lang,
  t,
  dubVideoFile,
  setDubVideoFile,
  dubVideoUrl,
  setDubVideoUrl,
  dubDragOver,
  setDubDragOver,
  dubResult,
  setDubResult,
  dubProgress,
  setDubProgress,
  dubProgressMessage,
  dubPreviewUrl,
  setDubPreviewUrl,
  dubDetectedRatio,
  setDubDetectedRatio,
  dubVideoWidth,
  setDubVideoWidth,
  dubVideoHeight,
  setDubVideoHeight,
  videoPreviewError,
  setVideoPreviewError,
  videoLoading,
  setVideoLoading,
  dubSelectedVoice,
  setDubSelectedVoice,
  dubSelectedTier,
  setDubSelectedTier,
  srtEnabled,
  setSrtEnabled,
  srtFontSize,
  setSrtFontSize,
  srtColor,
  setSrtColor,
  srtDropShadow,
  setSrtDropShadow,
  srtBlurBg,
  setSrtBlurBg,
  srtMarginV,
  setSrtMarginV,
  srtBlurOpacity,
  setSrtBlurOpacity,
  srtBlurColor,
  setSrtBlurColor,
  srtFullWidth,
  setSrtFullWidth,
  srtBorderRadius,
  setSrtBorderRadius,
  srtBoxPadding,
  setSrtBoxPadding,
  dubFileRef,
  dubResultVideoRef,
  dubPreviewRef,
  computeSrtPreviewStyle,
  activeJobId,
  startDubMutationPending,
  dubFileMutationPending,
  handleDubVideoFile,
  handleDubGenerate,
  handleDubDownload,
  handleDubPreview,
  handleDubReset,
  voiceAccordionOpen,
  setVoiceAccordionOpen,
  speedAccordionOpen,
  setSpeedAccordionOpen,
  srtAccordionOpen,
  setSrtAccordionOpen,
  isAdmin,
  hasActiveSub,
  hasPlan,
  me,
  subLoading,
  themeValues,
  accent,
  accentSecondary,
  showError,
  linkPreview,
  linkPreviewLoading,
}: DubbingTabProps) {
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
    panelStyle,
    box,
    labelStyle,
  } = themeValues;

  return (
    <div className="w-full px-4 lg:px-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="text-center mb-2 sm:mb-4">
        {!isAdmin && !hasPlan && me && !subLoading && (
          <div
            className="mt-3 mx-auto max-w-md flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
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
              : "No subscription. Contact Admin."}
          </div>
        )}
      </div>

      {/* ── STEP: Video Input ── */}
      {!dubPreviewUrl && !dubResult && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-6">
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
              {t.linkInputLabel}
              <span className="text-[10px] opacity-70 ml-2">
                (
                {lang === "mm"
                  ? "YouTube / TikTok / Facebook"
                  : "YouTube / TikTok / Facebook"}
                )
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <LinkIcon
                className="w-5 h-5 flex-shrink-0"
                style={{ color: subtextColor }}
              />
              <input
                type="text"
                value={dubVideoUrl}
                onChange={e => {
                  setDubVideoUrl(e.target.value);
                  if (e.target.value) {
                    setDubVideoFile(null);
                    setVideoPreviewError("");
                    setVideoLoading(false);
                  }
                }}
                placeholder={t.linkPlaceholder}
                className="flex-1 bg-transparent border-b-2 py-2 focus:outline-none transition-colors text-sm min-w-0"
                style={{
                  borderColor: dubVideoUrl ? accent : inputBorder,
                  color: textColor,
                }}
              />
            </div>
            {videoPreviewError && (
              <div
                className="mt-3 p-3 rounded-xl"
                style={{
                  background: "rgba(220, 38, 38, 0.1)",
                  border: "1px solid rgba(220, 38, 38, 0.3)",
                }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{ color: "#dc2626" }}
                >
                  {videoPreviewError}
                </p>
              </div>
            )}
          </div>

          <div
            className="flex items-center justify-center gap-4 my-2"
            style={{ color: subtextColor }}
          >
            <div
              className="h-px w-16 sm:w-20"
              style={{ background: isDark ? textColor : "#94a3b8" }}
            ></div>
            <span className="text-xs font-bold uppercase tracking-widest">
              {t.orLine}
            </span>
            <div
              className="h-px w-16 sm:w-20"
              style={{ background: isDark ? textColor : "#94a3b8" }}
            ></div>
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
              Upload
            </div>
            <div
              onDragOver={e => {
                e.preventDefault();
                setDubDragOver(true);
              }}
              onDragLeave={() => setDubDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDubDragOver(false);
                if (e.dataTransfer.files[0])
                  handleDubVideoFile(e.dataTransfer.files[0]);
              }}
              onClick={() => dubFileRef.current?.click()}
              className="border-2 border-dashed py-6 sm:py-8 px-4 rounded-xl text-center cursor-pointer transition-all mt-1"
              style={{
                borderColor: dubDragOver
                  ? accent
                  : dubVideoFile
                    ? "#16a34a"
                    : inputBorder,
                background: dubDragOver
                  ? isDark
                    ? "rgba(192,111,48,0.1)"
                    : "rgba(244,179,79,0.05)"
                  : inputBg,
                opacity: dubVideoUrl ? 0.4 : 1,
              }}
            >
              <input
                ref={dubFileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.[0])
                    handleDubVideoFile(e.target.files[0]);
                }}
              />
              {dubVideoFile ? (
                <>
                  <FileVideo className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <p className="font-bold text-green-600 text-sm">
                    {dubVideoFile.name}
                  </p>
                  <p
                    className="text-xs font-semibold mt-1"
                    style={{ color: subtextColor }}
                  >
                    {(dubVideoFile.size / 1024 / 1024).toFixed(1)}{" "}
                    MB
                  </p>
                </>
              ) : (
                <>
                  <Upload
                    className="w-8 h-8 mx-auto mb-2"
                    style={{ color: subtextColor }}
                  />
                  <p
                    className="font-bold text-sm"
                    style={{ color: subtextColor }}
                  >
                    {t.dropVideo}
                  </p>
                  <p
                    className="text-xs font-semibold mt-2"
                    style={{ color: subtextColor }}
                  >
                    MP4, MOV, AVI, MKV
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

{/* ── STEP: Video Preview + Settings ── */}
      {dubPreviewUrl && !dubResult && (
        <div className="flex flex-col lg:flex-row gap-6 pb-20 lg:pb-4 items-start relative">
          {/* Preview - Left column */}
          <div className="w-full lg:w-1/2 lg:sticky lg:top-4 shrink-0 flex flex-col z-20">
            <div 
              className="relative border backdrop-blur-xl transition-all duration-300 rounded-3xl overflow-hidden shadow-2xl flex flex-col w-full mx-auto" 
              style={{ 
                background: cardBg, 
                borderColor: cardBorder, 
                boxShadow,
                aspectRatio: dubDetectedRatio === "9:16" ? "9/16" : "16/9",
                maxHeight: "calc(100vh - 140px)"
              }}
            >
              <div className="flex items-center justify-between px-3 pt-2 flex-shrink-0">
                <div className={labelStyle} style={{ background: labelBg, color: accent, borderColor: cardBorder }}>
                  {lang === "mm" ? "ဗီဒီယိုကြိုကြည့်" : "Video Preview"}
                </div>
                <button onClick={() => { setDubVideoUrl(""); setDubPreviewUrl(""); setDubVideoFile(null); }} className="text-xs px-2 py-1 rounded hover:bg-red-500/20 text-red-400">✕</button>
              </div>
              <div className="flex-1 min-h-0 p-2 relative flex justify-center items-center">
                {videoLoading ? (
                  <div className="w-full h-64 rounded-xl flex flex-col items-center justify-center gap-3" style={{ background: "rgba(0,0,0,0.2)", border: `1px dashed ${cardBorder}` }}>
                    <span className="text-xs font-semibold" style={{ color: subtextColor }}>Preparing preview...</span>
                  </div>
                ) : dubPreviewUrl === "platform-url" ? (
                  <div className="w-full h-64 rounded-xl flex flex-col items-center justify-center gap-3" style={{ background: "rgba(0,0,0,0.2)", border: `1px dashed ${cardBorder}` }}>
                    <FileVideo className="w-10 h-10" style={{ color: accent }} />
                    <span className="text-xs font-semibold text-center px-4" style={{ color: subtextColor }}>
                      {lang === "mm" ? "ဗီဒီယိုဖိုင်ကို ဒေါင်းလုတ်လုပ်ပြီးမှ ကြိုတင်ကြည့်ရှုနိုင်ပါမည်" : "Video preview not available for platform URLs. Proceed to generate."}
                    </span>
                  </div>
                ) : dubPreviewUrl.startsWith("embed:") ? (
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-black">
                    {(() => {
                      const parts = dubPreviewUrl.split(":");
                      const platform = parts[1];
                      const embedUrl = parts.slice(2).join(":");
                      if (platform === "youtube") {
                        return (
                          <iframe
                            src={embedUrl}
                            className="w-full h-full"
                            style={{ border: "none" }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="YouTube video preview"
                          />
                        );
                      }
                      if (platform === "facebook") {
                        const rawImage = linkPreview?.image || "";
                        // Fallback: if image is the Wikipedia logo, treat as no preview
                        const isFallbackIcon = rawImage.includes("wikipedia");
                        // Cache buster: append timestamp to fbcdn.net and/or fallback URLs
                        const displayImage = rawImage.includes("fbcdn.net") || isFallbackIcon
                          ? `${rawImage}${rawImage.includes("?") ? "&" : "?"}t=${Date.now()}`
                          : rawImage;
                        return (
                          <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/40">
                            {linkPreviewLoading ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} />
                                <span className="text-xs font-semibold" style={{ color: subtextColor }}>Loading preview...</span>
                              </div>
                            ) : displayImage && !isFallbackIcon ? (
                              <>
                                <img
                                  src={displayImage}
                                  alt={linkPreview?.title || "Facebook Video"}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  crossOrigin="anonymous"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                /> 
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                  <p className="text-white font-bold text-sm line-clamp-2">{linkPreview?.title || "Facebook Video"}</p>
                                  <p className="text-white/60 text-xs mt-1">{linkPreview?.siteName || "facebook.com"}</p>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(24,119,242,0.9)" }}>
                                    <Play className="w-8 h-8 text-white ml-1" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-3">
                                <svg className="w-16 h-16" fill="#1877F2" viewBox="0 0 24 24">
                                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                </svg>
                                <span className="text-sm font-bold" style={{ color: "#1877F2" }}>Facebook Video</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (platform === "tiktok") {
                        const rawImage = linkPreview?.image || "";
                        const isFallback = !rawImage || rawImage.includes("tiktokcdn");
                        return (
                          <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/40">
                            {linkPreviewLoading ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} />
                                <span className="text-xs font-semibold" style={{ color: subtextColor }}>Loading preview...</span>
                              </div>
                            ) : rawImage && !isFallback ? (
                              <>
                                <img
                                  src={rawImage}
                                  alt={linkPreview?.title || "TikTok Video"}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                  <p className="text-white font-bold text-sm line-clamp-2">{linkPreview?.title || "TikTok Video"}</p>
                                  <p className="text-white/60 text-xs mt-1">{linkPreview?.siteName || "tiktok.com"}</p>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                                    <Play className="w-8 h-8 text-white ml-1" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-3">
                                <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none">
                                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.97a8.19 8.19 0 004.76 1.52V7.04a4.84 4.84 0 01-1-.35z" fill="#00f2ea"/>
                                </svg>
                                <span className="text-xs font-semibold" style={{ color: subtextColor }}>TikTok Video</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl">
                    {/* Background Layer — blurred cinematic fill */}
                    <video
                      src={dubPreviewUrl}
                      className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 pointer-events-none"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                    {/* Foreground Layer — clean video fills container, object-contain preserves aspect ratio */}
                    <video
                      ref={dubPreviewRef}
                      src={dubPreviewUrl}
                      className="relative z-10 w-full h-full object-contain rounded-lg cursor-pointer"
                      controls
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        setDubVideoWidth(v.videoWidth);
                        setDubVideoHeight(v.videoHeight);
                        setDubDetectedRatio(v.videoWidth < v.videoHeight ? "9:16" : "16:9");
                      }}
                      onError={() => {
                        setVideoPreviewError("Failed to load video preview.");
                      }}
                      onClick={() => {
                        const v = dubPreviewRef.current;
                        if (!v) return;
                        v.paused ? v.play() : v.pause();
                      }}
                    />
                    {/* Real-time Subtitle Preview */}
                    {srtEnabled && activeJobId === null && (
                      <div style={computeSrtPreviewStyle}>
                        {lang === "mm" ? "ဤနေရာတွင် စာတန်းထိုးကို မြင်ရပါမည်" : "Subtitle preview"}
                      </div>
                    )}
                    {/* Dubbing Loader Overlay */}
                    {activeJobId !== null && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                          <div className="text-center">
                            <div className="text-white text-sm font-bold">Generating</div>
                            <div className="text-white text-2xl font-black">{dubProgress}%</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Video Preview Error */}
                    {videoPreviewError && activeJobId === null && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl" style={{ background: "rgba(220, 38, 38, 0.9)", border: "1px solid rgba(220, 38, 38, 0.5)" }}>
                        <p className="text-xs font-semibold text-white">{videoPreviewError}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Settings - Right column, scrollable on both mobile and desktop */}
          <div className="w-full lg:w-1/2 space-y-4 pb-24 lg:pb-8">

          {/* ── ACCORDION: Voice Selection ── */}
          <div
            className={box}
            style={{
              background: cardBg,
              borderColor: cardBorder,
              boxShadow,
            }}
          >
            <button
              onClick={() =>
                setVoiceAccordionOpen(!voiceAccordionOpen)
              }
              className="w-full flex items-center justify-between"
              style={{ marginTop: "-4px" }}
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
              <ChevronDown
                className={`w-5 h-5 transition-transform duration-200 ${voiceAccordionOpen ? "rotate-180" : ""}`}
                style={{ color: accent }}
              />
            </button>
{voiceAccordionOpen && (
              <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Tier Tabs */}
                <div className="flex gap-1 p-1 bg-black/10 rounded-lg">
                  {([
                    { id: "tier1" as VoiceTier, label: "Tier 1", subLabel: lang === "mm" ? "၁ ကရက်ဒစ်" : "1 Credit" },
                    { id: "tier2" as VoiceTier, label: "Tier 2", subLabel: lang === "mm" ? "၃ ကရက်ဒစ်" : "3 Credits" },
                    { id: "tier3" as VoiceTier, label: "Tier 3", subLabel: lang === "mm" ? "၅ ကရက်ဒစ်" : "5 Credits" },
                  ] as const).map(tier => (
                    <button
                      key={tier.id}
                      onClick={() => setDubSelectedTier(tier.id)}
                      className="flex-1 py-2 px-2 rounded-md text-xs font-bold transition-all"
                      style={{
                        background: dubSelectedTier === tier.id
                          ? `linear-gradient(135deg, ${accent}40, ${accentSecondary}30)`
                          : "transparent",
                        border: `1px solid ${dubSelectedTier === tier.id ? accent : "transparent"}`,
                        color: dubSelectedTier === tier.id ? accent : subtextColor,
                      }}
                    >
                      <div>{tier.label}</div>
                      <div className="text-[10px] font-normal opacity-60">{tier.subLabel}</div>
                    </button>
                  ))}
                </div>

                {/* Males */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5 px-1" style={{ color: subtextColor }}>
                    {t.male}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ALL_VOICES.filter(v => v.tier === dubSelectedTier && v.gender === "male").map(v => (
                      <button
                        key={v.id}
                        onClick={() => setDubSelectedVoice(v.id)}
                        className="py-2 px-1 border rounded-lg text-xs font-bold transition-all"
                        style={{
                          borderColor: dubSelectedVoice === v.id ? accent : cardBorder,
                          background: dubSelectedVoice === v.id
                            ? isDark ? "rgba(192,111,48,0.2)" : "rgba(244,179,79,0.08)"
                            : "transparent",
                          color: dubSelectedVoice === v.id ? accent : textColor,
                        }}
                      >
                        <div className="truncate">{lang === "mm" ? v.nameMm : v.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Females */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5 px-1" style={{ color: subtextColor }}>
                    {t.female}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ALL_VOICES.filter(v => v.tier === dubSelectedTier && v.gender === "female").map(v => (
                      <button
                        key={v.id}
                        onClick={() => setDubSelectedVoice(v.id)}
                        className="py-2 px-1 border rounded-lg text-xs font-bold transition-all"
                        style={{
                          borderColor: dubSelectedVoice === v.id ? accent : cardBorder,
                          background: dubSelectedVoice === v.id
                            ? isDark ? "rgba(192,111,48,0.2)" : "rgba(244,179,79,0.08)"
                            : "transparent",
                          color: dubSelectedVoice === v.id ? accent : textColor,
                        }}
                      >
                        <div className="truncate">{lang === "mm" ? v.nameMm : v.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}
            </div>

          {/* ═══ Premium 3D Subtitle Settings Panel ═══ */}
          <div
            className="panel-floating p-3 sm:p-5"
            style={{
              ...panelStyle,
              borderRadius: 20,
            }}
          >
            {/* Panel Header with Toggle */}
            <div className="flex items-center justify-between mb-3 sm:mb-5">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: isDark ? "rgba(192,111,48,0.2)" : "linear-gradient(135deg, rgba(192,111,48,0.12), rgba(244,179,79,0.08))",
                    border: `1px solid ${isDark ? "rgba(192,111,48,0.3)" : "rgba(192,111,48,0.15)"}`,
                  }}
                >
                  <Subtitles className="w-4 h-4" style={{ color: accent }} />
                </div>
                <div>
                  <span className="text-sm font-bold block" style={{ color: textColor }}>
                    {lang === "mm" ? "စာတန်း ဆက်တင်" : "Subtitle Settings"}
                  </span>
                  <span className="text-[10px]" style={{ color: subtextColor }}>
                    {lang === "mm" ? "စာတန်းပုံစံ ပြင်ဆင်ရန်" : "Customize appearance"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  const next = !srtEnabled;
                  setSrtEnabled(next);
                  setSrtAccordionOpen(next);
                }}
                className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 border-2 border-transparent`}
                style={{
                  background: srtEnabled
                    ? "linear-gradient(135deg, #C06F30, #F4B34F)"
                    : isDark ? "rgba(255,255,255,0.1)" : "#E5E0D8",
                  boxShadow: srtEnabled ? "0 2px 12px rgba(192,111,48,0.3)" : "inset 0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${srtEnabled ? "translate-x-5" : "translate-x-0"}`}
                  style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}
                />
              </button>
            </div>

            {/* Settings Groups — collapsible */}
            {srtAccordionOpen && (
            <div className="space-y-5">
              
              {/* ── Group: Text ── */}
              <div>
                <div className="section-header">
                  <span>✦</span>
                  <span>{lang === "mm" ? "စာသား" : "TEXT"}</span>
                </div>

                {/* Font Size */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                      {lang === "mm" ? "စာလုံးအရွယ်" : "Text Size"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: lang === "mm" ? "သေးငယ်သော" : "Small", val: 18 },
                      { label: lang === "mm" ? "အလတ်စား" : "Medium", val: 24 },
                      { label: lang === "mm" ? "ကြီးမားသော" : "Large", val: 32 }
                    ].map(size => (
                      <button
                        key={size.val}
                        onClick={() => setSrtFontSize(size.val)}
                        className="py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: srtFontSize === size.val
                            ? "linear-gradient(135deg, #C06F30, #F4B34F)"
                            : isDark ? "rgba(255,255,255,0.05)" : "#F0EBE3",
                          color: srtFontSize === size.val ? "#fff" : subtextColor,
                          boxShadow: srtFontSize === size.val ? "0 2px 8px rgba(192,111,48,0.25)" : "none",
                          border: `1px solid ${srtFontSize === size.val ? "transparent" : isDark ? "rgba(255,255,255,0.05)" : "rgba(192,111,48,0.08)"}`
                        }}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Color */}
                <div>
                  <span className="text-xs font-semibold block mb-2.5" style={{ color: subtextColor }}>
                    {lang === "mm" ? "စာအရောင်" : "Text Color"}
                  </span>
                  <div className="flex gap-2.5 flex-wrap">
                    {["#ffffff", "#000000", "#fbbf24", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#ec4899"].map(color => (
                      <button
                        key={color}
                        onClick={() => setSrtColor(color)}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 transition-transform hover:scale-110`}
                        style={{ 
                          background: color,
                          border: `2px solid ${srtColor === color ? accent : "transparent"}`,
                          boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Group: Background (includes Layout) ── */}
              <div className="p-3 rounded-2xl" style={{
                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(192,111,48,0.03)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(192,111,48,0.08)"}`,
              }}>
                <div className="section-header">
                  <span>❖</span>
                  <span>{lang === "mm" ? "နောက်ခံ" : "BACKGROUND"}</span>
                </div>

                {/* Background Blur Toggle */}
                <div className="flex items-center justify-between py-2.5 px-3 rounded-xl mb-3" style={{
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(192,111,48,0.03)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(192,111,48,0.08)"}`,
                }}>
                  <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                    {lang === "mm" ? "နောက်ခံ Blur" : "Background Blur"}
                  </span>
                  <button
                    onClick={() => setSrtBlurBg(!srtBlurBg)}
                    className="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 border-2 border-transparent"
                    style={{
                      background: srtBlurBg
                        ? "linear-gradient(135deg, #C06F30, #F4B34F)"
                        : isDark ? "rgba(255,255,255,0.1)" : "#E5E0D8",
                      boxShadow: srtBlurBg ? "0 2px 8px rgba(192,111,48,0.25)" : "inset 0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${srtBlurBg ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                {srtBlurBg && (
                  <div className="space-y-3 pl-3 ml-1" style={{
                    borderLeft: `2px solid ${isDark ? "rgba(192,111,48,0.2)" : "rgba(192,111,48,0.12)"}`,
                  }}>
                    {/* Blur Opacity */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                          {lang === "mm" ? "အလင်းပိတ်မှု" : "Opacity"}
                        </span>
                        <span className="text-xs font-bold" style={{ color: accent }}>
                          {srtBlurOpacity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={srtBlurOpacity}
                        onChange={e => setSrtBlurOpacity(Number(e.target.value))}
                        className="premium-slider w-full"
                      />
                    </div>

                    {/* Blur Color */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                        {lang === "mm" ? "Blur အရောင်" : "Blur Color"}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSrtBlurColor("black")}
                          className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                          style={{
                            background: srtBlurColor === "black"
                              ? "linear-gradient(135deg, #1f1f1f, #333)"
                              : isDark ? "rgba(255,255,255,0.05)" : "#F0EBE3",
                            color: srtBlurColor === "black" ? "#fff" : subtextColor,
                            border: `1px solid ${srtBlurColor === "black" ? accent : "transparent"}`,
                            boxShadow: srtBlurColor === "black" ? `0 2px 8px rgba(192,111,48,0.2)` : "none",
                          }}
                        >
                          {lang === "mm" ? "မည်း" : "Dark"}
                        </button>
                        <button
                          onClick={() => setSrtBlurColor("white")}
                          className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                          style={{
                            background: srtBlurColor === "white"
                              ? "linear-gradient(135deg, #fff, #F5F0EA)"
                              : isDark ? "rgba(255,255,255,0.05)" : "#F0EBE3",
                            color: srtBlurColor === "white" ? "#2B1D1C" : subtextColor,
                            border: `1px solid ${srtBlurColor === "white" ? accent : "transparent"}`,
                            boxShadow: srtBlurColor === "white" ? `0 2px 8px rgba(192,111,48,0.2)` : "none",
                          }}
                        >
                          {lang === "mm" ? "ဖြူ" : "Light"}
                        </button>
                        <button
                          onClick={() => setSrtBlurColor("transparent")}
                          className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                          style={{
                            background: srtBlurColor === "transparent"
                              ? "linear-gradient(135deg, rgba(200,200,200,0.3), rgba(150,150,150,0.1))"
                              : isDark ? "rgba(255,255,255,0.05)" : "#F0EBE3",
                            color: srtBlurColor === "transparent" ? "#3b82f6" : subtextColor,
                            border: `1px solid ${srtBlurColor === "transparent" ? accent : "transparent"}`,
                            boxShadow: srtBlurColor === "transparent" ? `0 2px 8px rgba(192,111,48,0.2)` : "none",
                          }}
                        >
                          {lang === "mm" ? "ဖောက်ထွင်း" : "Glass"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </div>
            )}

            {/* ── Layout (inside Background) ── */}
            <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(192,111,48,0.08)"}` }}>
              <div className="section-header mb-2">
                <span>◈</span>
                <span>{lang === "mm" ? "အနေအထား" : "LAYOUT"}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Box Height */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                      {lang === "mm" ? "အမြင့်" : "Height"}
                    </span>
                    <span className="text-xs font-bold" style={{ color: accent }}>
                      {srtBoxPadding}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={srtBoxPadding}
                    onChange={e => setSrtBoxPadding(Number(e.target.value))}
                    className="premium-slider w-full"
                  />
                </div>

                {/* Position */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                      {lang === "mm" ? "အနေအထား" : "Position"}
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: subtextColor, opacity: 0.8 }}>
                      {lang === "mm" ? "အောက် > အပေါ်" : "Bottom > Top"} ({srtMarginV}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={srtMarginV}
                    onChange={e => setSrtMarginV(Number(e.target.value))}
                    className="premium-slider w-full"
                  />
                </div>
              </div>

              {/* Full Width Toggle */}
              <div className="flex items-center justify-between mt-3 py-2.5 px-3 rounded-xl" style={{
                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(192,111,48,0.03)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(192,111,48,0.08)"}`,
              }}>
                <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                  {lang === "mm" ? "အပြည့်အစုံ" : "Full Width"}
                </span>
                <button
                  onClick={() => setSrtFullWidth(!srtFullWidth)}
                  className="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 border-2 border-transparent"
                  style={{
                    background: srtFullWidth
                      ? "linear-gradient(135deg, #C06F30, #F4B34F)"
                      : isDark ? "rgba(255,255,255,0.1)" : "#E5E0D8",
                    boxShadow: srtFullWidth ? "0 2px 8px rgba(192,111,48,0.25)" : "inset 0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${srtFullWidth ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {activeJobId !== null && (
            <div className="w-full mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                  {dubProgressMessage || (lang === "mm" ? "ဖန်တီးနေသည်..." : "Generating...")}
                </span>
                <span className="text-xs font-bold" style={{ color: accent }}>
                  {dubProgress}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(192,111,48,0.1)" }}>
                <motion.div 
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accentSecondary})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${dubProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}

          {/* Generate Dubbing Button */}
          <motion.button
            onClick={handleDubGenerate}
            disabled={
              startDubMutationPending ||
              dubFileMutationPending ||
              activeJobId !== null
            }
            whileHover={{ scale: startDubMutationPending || dubFileMutationPending || activeJobId !== null ? 1 : 1.02 }}
            whileTap={{ scale: startDubMutationPending || dubFileMutationPending || activeJobId !== null ? 1 : 0.98 }}
            className="w-full relative overflow-hidden group flex items-center justify-center gap-3 py-4 sm:py-5 rounded-2xl text-white font-black uppercase tracking-wider transition-all disabled:opacity-50 mt-2 text-sm sm:text-base"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {startDubMutationPending || dubFileMutationPending || activeJobId !== null ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="relative"
                >
                  <Loader2 className="w-6 h-6" />
                </motion.div>
                <span className="relative z-10 text-xs sm:text-sm">
                  {lang === "mm"
                    ? "ဖန်တီးနေသည်..."
                    : "Generating..."}
                </span>
              </>
            ) : (
              <>
                <div className="relative">
                  <Wand2 className="w-6 h-6" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
                </div>
                <span className="relative z-10">
                  {lang === "mm"
                    ? "ဖန်တီးမည်"
                    : "Generate"}
                </span>
                <span 
                  className="relative z-10 px-3 py-1.5 rounded-full text-[13px] font-black"
                  style={{ 
                    background: "#fff", 
                    color: accent,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                  }}
                >
                  10 credits
                </span>
                <Sparkles className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </>
            )}
          </motion.button>

          <button
            onClick={handleDubReset}
            className="w-full py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider opacity-50 hover:opacity-100 transition-all"
            style={{ borderColor: cardBorder, color: subtextColor }}
          >
            ← {lang === "mm" ? "ဗီဒီယိုပြောင်းမည်" : "Change Video"}
          </button>
          </div>
        </div>
      )}

      {/* Dubbing Result — Final Video + Download */}
      {dubResult && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-6">
          {/* Video Player */}
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
              {lang === "mm"
                ? "AI ဖန်တီးပြီး ဗီဒီယို"
                : "Auto Creator Generated Video"}
            </div>
            <div className="flex justify-center mt-2 p-2">
              <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl" style={{ maxHeight: '75vh', aspectRatio: dubDetectedRatio === "9:16" ? "9/16" : "16/9" }}>
                {/* Background Layer — blurred cinematic fill */}
                <video
                  src={dubResult.videoUrl}
                  className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 pointer-events-none"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
                {/* Foreground Layer — clean video */}
                <video
                  key={dubResult.videoUrl}
                  ref={dubResultVideoRef}
                  controls
                  preload="metadata"
                  className="relative z-10 w-full h-full object-contain rounded-lg"
                  src={dubResult.videoUrl}
                  onError={() => {
                    setVideoPreviewError("Failed to load the generated video. The download link may have expired. Try downloading instead.");
                    }}
                  />
                </div>
              </div>
            {videoPreviewError && (
              <div className="mt-3 p-3 rounded-xl mx-auto max-w-md" style={{ background: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.3)" }}>
                <p className="text-xs font-semibold text-center" style={{ color: "#dc2626" }}>{videoPreviewError}</p>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
              <button
                onClick={handleDubDownload}
                className="flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:scale-105 shadow-lg text-white"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
                  boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
                }}
              >
                <Download className="w-5 h-5" />{" "}
                {lang === "mm" ? "MP4 ဒေါင်းလုတ်" : "Download MP4"}
              </button>

            </div>
          </div>

          {/* Reset */}
          <button
            onClick={handleDubReset}
            className="w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-colors hover:opacity-100 opacity-70"
            style={{ borderColor: cardBorder, color: subtextColor }}
          >
            {lang === "mm"
              ? "နောက်ထပ် ဗီဒီယိုဖန်တီးမည်"
              : "Create Another Video"}
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(DubbingTab);
