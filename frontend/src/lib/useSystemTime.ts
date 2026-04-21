import { useMemo } from "react";
import { trpc } from "./trpc";

export function useSystemTime() {
  const { data: serverTime } = trpc.system.time.useQuery(undefined, {
    staleTime: Infinity,
    refetchInterval: 60_000,
  });

  const tz = serverTime?.timezone || "UTC";

  const fmt = useMemo(() => {
    return (d: string | Date | null | undefined, locale = "en-US") => {
      if (!d) return "—";
      try {
        return new Date(d).toLocaleDateString(locale, {
          timeZone: tz,
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      } catch {
        return "—";
      }
    };
  }, [tz]);

  const fmtTime = useMemo(() => {
    return (d: string | Date | null | undefined, locale = "en-US") => {
      if (!d) return "Never";
      try {
        return new Date(d).toLocaleString(locale, {
          timeZone: tz,
          day: "2-digit",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch {
        return "—";
      }
    };
  }, [tz]);

  const fmtDuration = useMemo(() => {
    return (ms: number) => {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
    };
  }, []);

  return { tz, fmt, fmtTime, fmtDuration, serverNow: serverTime?.now };
}
