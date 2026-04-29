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
    <div className="flex items-center justify-end w-full h-full gap-1.5 sm:gap-3 px-2 sm:px-4">
      {/* ── Credits / Plan Pill ── */}
      {subLoading ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl">
          <div className="w-8 h-3 rounded animate-pulse" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }} />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Plan badge — compact on mobile */}
          {hasActiveSub && (
            <span
              className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "linear-gradient(135deg, #C06F30, #F4B34F)",
                color: "#fff",
                boxShadow: "0 1px 4px rgba(192,111,48,0.3)",
              }}
            >
              {isAdmin ? "Admin" : subStatus?.plan === "trial" ? (lang === "mm" ? "အစမ်း" : "Trial") : subStatus?.plan}
            </span>
          )}

          {/* Credits display */}
          <div
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-semibold"
            style={{
              background: hasActiveSub
                ? isDark
                  ? "rgba(192,111,48,0.15)"
                  : "rgba(244,179,79,0.10)"
                : isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
              border: `1px solid ${hasActiveSub ? "rgba(244,179,79,0.35)" : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
            }}
          >
            {/* Credit progress bar — desktop only */}
            <div className="hidden sm:block w-12 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: isAdmin ? "100%" : `${Math.min(100, ((subStatus?.credits ?? 0) / (planLimits?.maxCredits ?? 800)) * 100)}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{
                  background: "linear-gradient(90deg, #C06F30, #F4B34F)",
                }}
              />
            </div>

            {/* Credit number */}
            <span className="font-bold tabular-nums" style={{ color: hasActiveSub ? "#F4B34F" : isDark ? "#9CA3AF" : "#6B7280" }}>
              {isAdmin ? "∞" : subStatus?.credits ?? 0}
            </span>
            {!isAdmin && (
              <span className="hidden sm:inline text-[10px] opacity-60 uppercase">cr</span>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="hidden sm:block w-px h-5 mx-0.5" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }} />

      {/* ── Action Buttons ── */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Username — desktop only */}
        <span
          className="hidden sm:inline text-[11px] font-medium px-2 py-1 rounded-full"
          style={{
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
          }}
        >
          @{(me as any)?.username || me?.name}
        </span>

        {/* Lang toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setLang(lang === "mm" ? "en" : "mm")}
          className="w-8 h-8 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1 flex items-center justify-center text-[11px] font-black rounded-lg uppercase tracking-wider transition-all"
          style={{
            border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)",
            color: textColor,
          }}
        >
          {lang === "mm" ? "EN" : "MM"}
        </motion.button>

        {/* Theme toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{
            border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)",
            color: textColor,
          }}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </motion.button>

        {/* Logout */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => logoutMutation.mutate()}
          className="w-8 h-8 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 flex items-center justify-center gap-1 rounded-lg transition-all"
          style={{
            border: "1px solid rgba(239,68,68,0.2)",
            background: isDark ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.03)",
            color: "#ef4444",
          }}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px] font-bold">{t.logout}</span>
        </motion.button>
      </div>
    </div>
  );
});

HeaderBar.displayName = "HeaderBar";
export default HeaderBar;
