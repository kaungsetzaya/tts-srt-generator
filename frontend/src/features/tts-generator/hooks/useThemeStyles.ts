/**
 * useThemeStyles — Eliminates 600+ inline style objects across the app.
 * Returns memoized class names and CSS variables for consistent theming.
 */
import { useMemo } from "react";

export interface ThemeValues {
  isDark: boolean;
  textColor: string;
  subtextColor: string;
  cardBg: string;
  cardBorder: string;
  boxShadow: string;
  inputBg: string;
  inputBorder: string;
  labelBg: string;
  box: string;
  labelStyle: string;
}

export function useThemeStyles(themeValues: ThemeValues) {
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
  } = themeValues;

  return useMemo(() => {
    const accent = "#C06F30";
    const accentSecondary = "#F4B34F";
    const error = "#dc2626";
    const warning = "#f59e0b";

    // ── Base Card ──
    const card = {
      className:
        "rounded-2xl border p-3 sm:p-4 transition-all duration-200",
      style: {
        background: cardBg,
        borderColor: cardBorder,
        boxShadow,
      } as React.CSSProperties,
    };

    // ── Section Label / Badge ──
    const label = {
      className:
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider mb-3",
      style: {
        background: labelBg,
        color: accent,
        border: `1px solid ${cardBorder}`,
      } as React.CSSProperties,
    };

    // ── Input / Textarea ──
    const input = {
      className:
        "w-full border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C06F30]/40 focus:border-[#C06F30] transition-colors disabled:opacity-50",
      style: {
        background: inputBg,
        borderColor: inputBorder,
        color: textColor,
      } as React.CSSProperties,
    };

    // ── Primary Button ──
    const btnPrimary = {
      className:
        "relative overflow-hidden flex items-center justify-center gap-2 rounded-2xl text-white font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]",
      style: {
        background: `linear-gradient(135deg, ${accent}, ${accentSecondary})`,
      } as React.CSSProperties,
    };

    // ── Secondary / Outline Button ──
    const btnOutline = {
      className:
        "flex items-center justify-center gap-2 rounded-xl border font-bold text-sm transition-all hover:shadow-md active:scale-[0.98]",
      style: {
        borderColor: accent,
        color: accent,
        background: isDark ? "rgba(192,111,48,0.08)" : "rgba(244,179,79,0.04)",
      } as React.CSSProperties,
    };

    // ── Selection Grid Item ──
    const gridItem = (isActive: boolean) => ({
      className:
        "py-2.5 px-2 border rounded-xl text-xs font-bold transition-all text-center disabled:opacity-40 hover:border-[#C06F30]/60",
      style: {
        borderColor: isActive ? accent : cardBorder,
        background: isActive
          ? isDark
            ? "rgba(192,111,48,0.15)"
            : "rgba(244,179,79,0.06)"
          : "transparent",
        color: isActive ? accent : textColor,
        boxShadow: isActive && !isDark
          ? "0 2px 8px rgba(192,111,48,0.12)"
          : "none",
      } as React.CSSProperties,
    });

    // ── Tier Tab Button ──
    const tierTab = (isActive: boolean) => ({
      className:
        "flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center",
      style: {
        background: isActive
          ? `linear-gradient(135deg, ${accent}25, ${accentSecondary}18)`
          : "transparent",
        border: `1.5px solid ${isActive ? accent : cardBorder}`,
        color: isActive ? accent : subtextColor,
      } as React.CSSProperties,
    });

    // ── Toast Error ──
    const toastError = {
      className:
        "flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border backdrop-blur-xl",
      style: {
        background: isDark ? "rgba(220,38,38,0.92)" : "#fef2f2",
        borderColor: isDark ? "rgba(248,113,113,0.5)" : "#fecaca",
        color: isDark ? "#fff" : "#991b1b",
      } as React.CSSProperties,
    };

    // ── Toast Success ──
    const toastSuccess = {
      className:
        "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-xl",
      style: {
        background: "rgba(34, 197, 94, 0.95)",
        borderColor: "rgba(34, 197, 94, 0.5)",
        color: "#fff",
      } as React.CSSProperties,
    };

    // ── Character Counter Badge ──
    const charCounter = (
      len: number,
      limit: number,
      isAdmin: boolean
    ) => {
      if (isAdmin) {
        return {
          className: "px-2 py-1 rounded-lg text-xs font-bold",
          style: {
            background: inputBg,
            color: accent,
            border: `1px solid ${accent}`,
          } as React.CSSProperties,
        };
      }
      const pct = len / limit;
      const isOver = len >= limit;
      const isWarn = pct > 0.9;
      return {
        className: "px-2 py-1 rounded-lg text-xs font-bold transition-colors",
        style: {
          background: isOver
            ? "rgba(220,38,38,0.15)"
            : isWarn
              ? "rgba(245,158,11,0.15)"
              : inputBg,
          color: isOver ? error : isWarn ? warning : accent,
          border: `1px solid ${isOver ? error : isWarn ? warning : accent}`,
        } as React.CSSProperties,
      };
    };

    return {
      card,
      label,
      input,
      btnPrimary,
      btnOutline,
      gridItem,
      tierTab,
      toastError,
      toastSuccess,
      charCounter,
      accent,
      accentSecondary,
      error,
      warning,
      isDark,
      textColor,
      subtextColor,
      cardBg,
      cardBorder,
      inputBg,
      inputBorder,
    };
  }, [
    isDark,
    textColor,
    subtextColor,
    cardBg,
    cardBorder,
    boxShadow,
    inputBg,
    inputBorder,
    labelBg,
  ]);
}

export default useThemeStyles;
