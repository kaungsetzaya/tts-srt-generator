import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useSystemTime } from "@/lib/useSystemTime";
import { useDubbingState } from "@/features/tts-generator/hooks/useDubbingState";
import { useTTSState } from "@/features/tts-generator/hooks/useTTSState";
import { useVideoState } from "@/features/tts-generator/hooks/useVideoState";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { T } from "@/features/tts-generator/constants/translations";
import type { Lang } from "@/features/tts-generator/constants/translations";
import {
  accent,
  accentSecondary,
  peach,
  cream,
  lightBg,
  lightCardBg,
  lightCardBorder,
  lightText,
  lightSubtext,
} from "@/features/tts-generator/constants/colors";
import type { ThemeValues } from "@/features/tts-generator/types";
import { friendlyError } from "@/features/tts-generator/utils/friendlyError";

type MainTab = "tts" | "video" | "dubbing";
type SecondaryTab = "history" | "plan" | "guide" | "settings" | "files" | null;

export function useTTSGeneratorState() {
  const [mainTab, setMainTab] = useState<MainTab>("dubbing");
  const [secondaryTab, setSecondaryTab] = useState<SecondaryTab>(null);
  const [libraryFilter, setLibraryFilter] = useState<"all" | "video" | "audio" | "text">("all");
  const [menuOpen, setMenuOpen] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const [lang, setLangRaw] = useState<Lang>(() => (localStorage.getItem("lumix_lang") as Lang) || "mm");
  const setLang = (l: Lang) => {
    localStorage.setItem("lumix_lang", l);
    setLangRaw(l);
  };
  const t = T[lang];

  // Error toast state
  const [errorToast, setErrorToast] = useState("");
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = (msg: string) => {
    setErrorToast(friendlyError(msg));
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => setErrorToast(""), 5000);
  };

  // Success toast state
  const [successToast, setSuccessToast] = useState("");
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = setTimeout(() => setSuccessToast(""), 3000);
  };

  // tRPC utils — MUST be declared before hooks that use it
  const utils = trpc.useUtils();

  const ttsState = useTTSState(showError, lang, utils);
  const videoState = useVideoState(showError, utils);
  const dubbingState = useDubbingState(showError, showSuccess, utils);

  // Accordion state for mobile-friendly collapsible sections
  const [voiceAccordionOpen, setVoiceAccordionOpen] = useState(true);
  const [speedAccordionOpen, setSpeedAccordionOpen] = useState(false);
  const [srtAccordionOpen, setSrtAccordionOpen] = useState(true);

  const [, navigate] = useLocation();
  const { data: unifiedHistory, isLoading: historyLoading } =
    trpc.history.getUnifiedHistory.useQuery({ limit: 100 });
  const { data: userFiles, isLoading: filesLoading } =
    trpc.files.list.useQuery(undefined, { enabled: secondaryTab === "files" });
  const deleteFileMutation = trpc.files.deleteFile.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate();
    },
  });
  const { data: me } = trpc.auth.me.useQuery();
  const { data: subStatus, isLoading: subLoading } =
    trpc.subscription.myStatus.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      sessionStorage.removeItem("gemini_key");
      window.location.href = "/login";
    },
  });
  // generateMutation is now owned by useTTSState and exposed via ttsState.
  // Do NOT create a second instance here — it would be a separate mutation
  // instance, causing isGenerating to always be false in TTSTab.

  const isAdmin = me?.role === "admin";
  const hasActiveSub = !!(isAdmin || subStatus?.active);
  const hasPlan = !!(isAdmin || subStatus?.plan);
  const planLimits = subStatus?.limits;
  const planUsage = subStatus?.usage;
  const currentPlan = subStatus?.plan;

  const currentCharLimit = ttsState.getCharLimit(isAdmin, currentPlan);

  const daysLeft = subStatus?.expiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subStatus.expiresAt).getTime() - Date.now()) / 86400000
        )
      )
    : null;

  const isDark = theme === "dark";
  const subColor = accent;

  // ─── Premium B&W theme-aware derived values ───
  const bgColor = isDark ? "#0f0f0f" : lightBg;
  const textColor = isDark ? cream : lightText;
  const subtextColor = isDark ? peach : lightSubtext;
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : lightCardBg;
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : lightCardBorder;
  const boxShadow = isDark
    ? "0 4px 24px rgba(0,0,0,0.3)"
    : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)";
  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "#F7F7F7";
  const inputBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  // 3D Panel styles (for subtitle settings)
  const panelStyle = isDark
    ? { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }
    : { background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.02)" };

  // Auto-preview video for translate tab when URL changes
  // Set audio source when generatedFiles.audioObjectUrl changes
  useEffect(() => {
    if (ttsState.generatedFiles?.audioObjectUrl && ttsState.audioRef.current) {
      ttsState.audioRef.current.src = ttsState.generatedFiles.audioObjectUrl;
      ttsState.audioRef.current.load();
    }
  }, [ttsState.generatedFiles?.audioObjectUrl]);

  // Light theme: Pure White B&W, Dark: Deep Dark
  const bgGradient = isDark
    ? "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0f0f0f 100%)"
    : "#FFFFFF";

  const labelBg = isDark ? "rgba(192,111,48,0.15)" : "#F5F5F5";

  const box =
    "relative border p-4 md:p-5 pt-8 backdrop-blur-xl transition-all duration-300 rounded-2xl mt-6";
  const labelStyle =
    "absolute -top-3.5 left-4 px-3 py-1 text-xs uppercase tracking-widest font-black rounded-lg z-10 border";

  const themeValues: ThemeValues = {
    isDark,
    bgColor,
    textColor,
    subtextColor,
    cardBg,
    cardBorder,
    boxShadow,
    inputBg,
    inputBorder,
    labelBg,
    accent,
    accentSecondary,
    panelStyle,
    box,
    labelStyle,
  };

  // useSystemTime keeps server time query alive; fmtTime unused in this component
  useSystemTime();

  return {
    mainTab,
    setMainTab,
    secondaryTab,
    setSecondaryTab,
    libraryFilter,
    setLibraryFilter,
    menuOpen,
    setMenuOpen,
    theme,
    toggleTheme,
    lang,
    setLang,
    t,
    errorToast,
    setErrorToast,
    showError,
    successToast,
    setSuccessToast,
    showSuccess,
    utils,
    ...ttsState,
    ...videoState,
    ...dubbingState,
    voiceAccordionOpen,
    setVoiceAccordionOpen,
    speedAccordionOpen,
    setSpeedAccordionOpen,
    srtAccordionOpen,
    setSrtAccordionOpen,
    navigate,
    unifiedHistory,
    historyLoading,
    userFiles,
    filesLoading,
    deleteFileMutation,
    me,
    subStatus,
    subLoading,
    logoutMutation,
    generateMutation: ttsState.generateMutation,
    isAdmin,
    hasActiveSub,
    hasPlan,
    planLimits,
    planUsage,
    currentPlan,
    currentCharLimit,
    daysLeft,
    isDark,
    subColor,
    bgColor,
    textColor,
    subtextColor,
    cardBg,
    cardBorder,
    boxShadow,
    inputBg,
    inputBorder,
    panelStyle,
    bgGradient,
    labelBg,
    box,
    labelStyle,
    themeValues,
  };
}

export type UseTTSGeneratorStateReturn = ReturnType<typeof useTTSGeneratorState>;
