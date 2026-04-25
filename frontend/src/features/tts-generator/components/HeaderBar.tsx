import React from "react";
import { motion } from "framer-motion";
import { LogOut, Sun, Moon } from "lucide-react";
import type { Lang } from "@/features/tts-generator/constants/translations";

interface HeaderBarProps {
  isDark: boolean;
  accent: string;
  accentSecondary: string;
  textColor: string;
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleTheme: () => void;
  logoutMutation: any;
  subLoading: boolean;
  hasActiveSub: boolean;
  isAdmin: boolean;
  subStatus?: any;
  planLimits?: any;
  me?: any;
  t: any;
}

const HeaderBar: React.FC<HeaderBarProps> = React.memo(({
  isDark,
  accent,
  accentSecondary,
  textColor,
  lang,
  setLang,
  toggleTheme,
  logoutMutation,
  subLoading,
  hasActiveSub,
  isAdmin,
  subStatus,
  planLimits,
  me,
  t,
}) => {
  return (
    <div className="flex flex-nowrap items-center justify-between py-1 px-2 sm:px-4 w-full h-full gap-1 sm:gap-2 overflow-hidden">
      {/* Mobile Logo */}
      <div className="flex items-center gap-2 md:hidden">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md"
          style={{
            background: `linear-gradient(135deg, ${accent}30, ${accentSecondary}20)`,
            border: `1px solid ${isDark ? "rgba(192,111,48,0.5)" : "rgba(192,111,48,0.4)"}`,
          }}
        >
          <span className="text-sm font-black" style={{ color: "#C06F30", textShadow: `0 0 8px ${accent}60` }}>
            L
          </span>
        </div>
        <span
          className="text-sm font-black tracking-widest"
          style={{
            background: "linear-gradient(135deg, #C06F30, #F4B34F)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          LUMIX
        </span>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 sm:ml-auto">
        {subLoading ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl">
            <div className="w-10 h-3 rounded animate-pulse" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }} />
            <div className="w-5 h-3 rounded animate-pulse" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }} />
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-semibold relative overflow-hidden"
            style={{
              background: hasActiveSub
                ? "linear-gradient(135deg, rgba(192,111,48,0.25) 0%, rgba(244,179,79,0.15) 50%, rgba(192,111,48,0.25) 100%)"
                : isDark
                  ? "rgba(75,85,99,0.3)"
                  : "rgba(229,231,235,0.5)",
              border: `1px solid ${hasActiveSub ? "rgba(244,179,79,0.5)" : "rgba(156,163,175,0.3)"}`,
            }}
          >
            {hasActiveSub && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ animationDuration: "2s" }} />
            )}
            {hasActiveSub ? (
              <>
                <div className="relative z-10 flex items-center gap-1 sm:gap-2">
                  <span
                    className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-xs font-bold uppercase tracking-wider"
                    style={{
                      background: "linear-gradient(135deg, #C06F30 0%, #F4B34F 100%)",
                      color: "#fff",
                      boxShadow: "0 2px 8px rgba(192,111,48,0.4)",
                    }}
                  >
                    {isAdmin ? "Admin" : subStatus?.plan === "trial" ? (lang === "mm" ? "အစမ်း" : "Trial") : subStatus?.plan}
                  </span>
                </div>
                <div className="relative z-10 hidden sm:block flex-1 h-2 max-w-[100px] rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: isAdmin ? "100%" : `${Math.min(100, ((subStatus?.credits ?? 0) / (planLimits?.maxCredits ?? 800)) * 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{
                      background: "linear-gradient(90deg, #C06F30, #F4B34F, #FCD34D)",
                      boxShadow: "0 0 10px rgba(244,179,79,0.5)",
                    }}
                  />
                </div>
                <div className="relative z-10 flex items-center gap-1 sm:gap-2 font-bold" style={{ color: isDark ? "#F4B34F" : "#B45309" }}>
                  <span className="text-[11px] sm:text-sm">{isAdmin ? "Admin" : subStatus?.credits}</span>
                  {!isAdmin && <span className="hidden sm:inline text-xs opacity-70 uppercase">credits</span>}
                </div>
              </>
            ) : (
              <>
                <span className="relative z-10 text-[10px] sm:text-sm font-medium" style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
                  {me ? (lang === "mm" ? "အခမဲ့" : "Free") : ""}
                </span>
                <div className="relative z-10 hidden sm:block flex-1 h-2 max-w-[100px] rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                  <div className="h-full rounded-full" style={{ width: "0%", background: isDark ? "#4B5563" : "#9CA3AF" }} />
                </div>
                <span className="relative z-10 text-[11px] sm:text-sm" style={{ color: isDark ? "#6B7280" : "#9CA3AF" }}>
                  {subStatus?.credits ?? 0}
                </span>
              </>
            )}
          </div>
        )}
        <span
          className="hidden sm:inline text-xs font-bold px-1.5 sm:px-2.5 py-1 rounded-full"
          style={{
            background: isDark ? "rgba(192,111,48,0.1)" : "rgba(244,179,79,0.06)",
            color: accent,
          }}
        >
          @{(me as any)?.username || me?.name}
        </span>
        <div className="w-px h-5 mx-0.5" style={{ background: isDark ? "rgba(192,111,48,0.3)" : "rgba(192,111,48,0.12)" }} />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setLang(lang === "mm" ? "en" : "mm")}
          className="px-2.5 py-1 text-xs font-black rounded-lg uppercase tracking-widest transition-all"
          style={{
            border: `1px solid ${isDark ? "rgba(192,111,48,0.35)" : "rgba(192,111,48,0.15)"}`,
            background: isDark ? "rgba(192,111,48,0.1)" : "rgba(255,255,255,0.7)",
            color: textColor,
          }}
        >
          {lang === "mm" ? "EN" : "MM"}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="p-1.5 rounded-lg transition-all flex items-center justify-center"
          style={{
            border: `1px solid ${isDark ? "rgba(192,111,48,0.35)" : "rgba(192,111,48,0.15)"}`,
            background: isDark ? "rgba(192,111,48,0.1)" : "rgba(255,255,255,0.7)",
            color: textColor,
          }}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => logoutMutation.mutate()}
          className="flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all"
          style={{
            border: "1px solid rgba(239,68,68,0.3)",
            background: isDark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)",
            color: "#ef4444",
          }}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.logout}</span>
        </motion.button>
      </div>
    </div>
  );
});

HeaderBar.displayName = "HeaderBar";
export default HeaderBar;
