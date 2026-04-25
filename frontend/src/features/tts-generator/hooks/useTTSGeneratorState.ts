import { useState, useEffect } from "react";
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
  const showError = (msg: string) => {
    setErrorToast(friendlyError(msg));
    setTimeout(() => setErrorToast(""), 5000);
  };

  // Success toast state
  const [successToast, setSuccessToast] = useState("");
  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 3000);
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
      localStorage.removeItem("gemini_key");
      window.location.href = "/login";
    },
  });
  const generateMutation = trpc.tts.generateAudio.useMutation({
    onSuccess: () => {
      utils.history.getUnifiedHistory.invalidate();
    },
  });

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

  // ─── Premium theme-aware derived values ───
  const bgColor = isDark ? "#0f0f0f" : lightBg;
  const textColor = isDark ? cream : lightText;
  const subtextColor = isDark ? peach : lightSubtext;
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : lightCardBg;
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : lightCardBorder;
  const boxShadow = isDark
    ? "0 4px 24px rgba(0,0,0,0.3)"
    : "0 8px 32px rgba(192,111,48,0.06), 0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.9)";
  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "#F8F4EE";
  const inputBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(192,111,48,0.15)";

  // 3D Panel styles (for subtitle settings)
  const panelStyle = isDark
    ? { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }
    : { background: "linear-gradient(160deg, #FFFFFF 0%, #FFF9F2 100%)", border: "1px solid rgba(192,111,48,0.15)", boxShadow: "0 16px 48px rgba(192,111,48,0.08), 0 4px 16px rgba(0,0,0,0.04), inset 0 2px 0 rgba(255,255,255,0.95)" };

  // Auto-preview video for translate tab when URL changes
  // Set audio source when generatedFiles.audioObjectUrl changes
  useEffect(() => {
    if (ttsState.generatedFiles?.audioObjectUrl && ttsState.audioRef.current) {
      ttsState.audioRef.current.src = ttsState.generatedFiles.audioObjectUrl;
      ttsState.audioRef.current.load();
    }
  }, [ttsState.generatedFiles?.audioObjectUrl]);

  // Light theme: Premium Warm Gradient, Dark: Keep Deep Dark
  const bgGradient = isDark
    ? "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0f0f0f 100%)"
    : "linear-gradient(180deg, #FBF8F4 0%, #F8F4EE 50%, #F5F0EA 100%)";

  // (cardBg, cardBorder, textColor, subtextColor, inputBg, inputBorder, boxShadow 
  //  are defined in the premium theme block above — do not redeclare here)
  const labelBg = isDark ? "rgba(192,111,48,0.15)" : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(251,248,244,0.98))";

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
    generateMutation,
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
