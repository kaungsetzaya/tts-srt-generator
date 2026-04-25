import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Sparkles,
  Upload,
  FileVideo,
  Link as LinkIcon,
  Copy,
  Check,
  Download,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import CircularLoader from "@/features/tts-generator/components/CircularLoader";
import type { ThemeValues } from "../types";

export interface VideoTranslateTabProps {
  lang: "mm" | "en";
  t: any;
  videoFile: File | null;
  setVideoFile: (f: File | null) => void;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  videoResult: any;
  setVideoResult: (v: any) => void;
  editedVideoText: string;
  setEditedVideoText: (v: string) => void;
  videoCopied: boolean;
  setVideoCopied: (v: boolean) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  translateJobId: string | null;
  translateJobProgress: number;
  translateJobMessage: string;
  translateJobType: "file" | "link";
  translateMutationPending: boolean;
  translateLinkMutationPending: boolean;
  handleVideoFile: (f: File) => void;
  handleTranslate: () => Promise<void>;
  handleVideoCopy: () => Promise<void>;
  handleVideoReset: () => void;
  handleVideoDownloadFromUrl: () => Promise<void>;
  downloadFile: (content: string, filename: string) => void;
  hasActiveSub: boolean;
  themeValues: ThemeValues;
  accent: string;
  accentSecondary: string;
  isAdmin: boolean;
  hasPlan: boolean;
  me: any;
  subLoading: boolean;
  setVideoPreviewError: (v: string) => void;
  setVideoLoading: (v: boolean) => void;
}

function VideoTranslateTab({
  lang,
  t,
  videoFile,
  setVideoFile,
  videoUrl,
  setVideoUrl,
  dragOver,
  setDragOver,
  videoResult,
  editedVideoText,
  setEditedVideoText,
  videoCopied,
  fileRef,
  translateJobId,
  translateMutationPending,
  translateLinkMutationPending,
  handleVideoFile,
  handleTranslate,
  handleVideoCopy,
  handleVideoReset,
  accent,
  accentSecondary,
  isAdmin,
  hasPlan,
  me,
  subLoading,
  themeValues,
  setVideoPreviewError,
  setVideoLoading,
}: VideoTranslateTabProps) {
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

  return (
    <div className="w-full px-4 lg:px-6 animate-in fade-in zoom-in-95 duration-300 space-y-4">
      <div className="text-center mb-2 sm:mb-4">
        <p className="text-xs mt-1" style={{ color: subtextColor }}>
          {t.videoLimit}
        </p>
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

      {!videoResult && (
        <React.Fragment>
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
                value={videoUrl}
                onChange={e => {
                  setVideoUrl(e.target.value);
                  if (e.target.value) {
                    setVideoFile(null);
                    setVideoPreviewError("");
                    setVideoLoading(false);
                  }
                }}
                placeholder={t.linkPlaceholder}
                className="flex-1 bg-transparent border-b-2 py-2 focus:outline-none transition-colors text-sm min-w-0"
                style={{
                  borderColor: videoUrl ? accent : inputBorder,
                  color: textColor,
                }}
              />
            </div>
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
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files[0])
                  handleVideoFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed py-6 sm:py-8 px-4 rounded-xl text-center cursor-pointer transition-all mt-1"
              style={{
                borderColor: dragOver
                  ? accent
                  : videoFile
                    ? "#16a34a"
                    : inputBorder,
                background: dragOver
                  ? isDark
                    ? "rgba(192,111,48,0.1)"
                    : "rgba(244,179,79,0.05)"
                  : inputBg,
                opacity: videoUrl ? 0.4 : 1,
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.[0])
                    handleVideoFile(e.target.files[0]);
                }}
              />
              {videoFile ? (
                <>
                  <FileVideo className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <p className="font-bold text-green-600 text-sm">
                    {videoFile.name}
                  </p>
                  <p
                    className="text-xs font-semibold mt-1"
                    style={{ color: subtextColor }}
                  >
                    {(videoFile.size / 1024 / 1024).toFixed(1)} MB
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

          {/* Video Preview removed from translate tab — not needed */}

          {(videoFile || videoUrl) && !translateJobId && (
            <button
              onClick={handleTranslate}
              disabled={
                translateMutationPending ||
                translateLinkMutationPending ||
                !!translateJobId
              }
              className="w-full flex items-center justify-center gap-2 py-3.5 sm:py-4 rounded-2xl text-white font-black uppercase tracking-widest transition-all disabled:opacity-50 hover:scale-[1.02] mt-4 shadow-lg text-sm sm:text-base relative"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
                boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
              }}
            >
              {translateMutationPending ||
              translateLinkMutationPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.translating}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  {t.translateBtn}
                  <span 
                    className="px-3 py-1.5 rounded-full text-[13px] font-black"
                    style={{ 
                      background: "#fff", 
                      color: accent,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                    }}
                  >
                    5 credits
                   </span>
                 </>
               )}
             </button>
           )}
         </React.Fragment>
       )}

       {videoResult && (
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
            {t.result}
          </div>
          <div className="space-y-4 mt-2">
            <div className="flex justify-center">
              <button
                onClick={handleVideoCopy}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all hover:scale-105"
                style={{
                  background: videoCopied ? "#4ade80" : accent,
                  color: "var(--foreground)",
                }}
              >
                {videoCopied ? (
                  <>
                    <Check className="w-4 h-4" /> {t.copied}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> {t.copyText}
                  </>
                )}
              </button>
            </div>
            <textarea
              value={editedVideoText}
              onChange={e => setEditedVideoText(e.target.value)}
              className="w-full min-h-[200px] sm:min-h-[250px] p-4 sm:p-5 rounded-xl border focus:outline-none focus:ring-2 resize-y text-sm font-sans"
              style={{
                background: inputBg,
                borderColor: inputBorder,
                color: textColor,
                lineHeight: "2.2",
              }}
            />
            <button
              onClick={handleVideoReset}
              className="w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-colors hover:opacity-100 opacity-70"
              style={{
                borderColor: cardBorder,
                color: subtextColor,
              }}
            >
              {t.translateAnother}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(VideoTranslateTab);
