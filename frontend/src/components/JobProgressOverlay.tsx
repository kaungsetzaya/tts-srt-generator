import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Wand2 } from "lucide-react";

interface JobProgressOverlayProps {
  isVisible: boolean;
  progress: number;
  message: string;
  isDark: boolean;
  accent: string;
  title?: string;
  lang?: "en" | "mm";
}

export function JobProgressOverlay({
  isVisible,
  progress,
  message,
  isDark,
  accent,
  title = "Processing...",
  lang = "mm"
}: JobProgressOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md mx-4"
        >
          <div 
            className="rounded-2xl p-4 shadow-2xl overflow-hidden"
            style={{
              background: isDark ? "rgba(30, 25, 24, 0.95)" : "rgba(255, 255, 255, 0.95)",
              border: `1px solid ${isDark ? "rgba(192,111,48,0.3)" : "rgba(192,111,48,0.2)"}`,
              boxShadow: `0 10px 40px -10px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(192,111,48,0.2)'}`,
            }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center relative flex-shrink-0"
                style={{ 
                  background: isDark ? "rgba(192,111,48,0.15)" : "rgba(192,111,48,0.1)",
                  border: `1px solid ${isDark ? "rgba(192,111,48,0.3)" : "rgba(192,111,48,0.2)"}`
                }}
              >
                <div className="absolute inset-0 rounded-xl animate-spin" style={{ borderTop: `2px solid ${accent}`, borderRadius: "0.75rem" }} />
                <Wand2 className="w-5 h-5" style={{ color: accent }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 
                    className="text-sm uppercase tracking-wider font-black"
                    style={{ color: isDark ? "#ebe6d8" : "#2B1D1C" }}
                  >
                    {title}
                  </h3>
                  <span 
                    className="text-lg font-black"
                    style={{ color: accent }}
                  >
                    {Math.round(progress)}%
                  </span>
                </div>
                
                <p 
                  className="text-xs font-medium truncate"
                  style={{ color: isDark ? "#ecceb6" : "#8B7355" }}
                >
                  {message || (lang === "mm" ? "အနည်းငယ်စောင့်ဆိုင်းပါ..." : "Please wait...")}
                </p>

                <div className="mt-2 relative">
                  <div 
                    className="h-1.5 w-full rounded-full overflow-hidden"
                    style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}
                  >
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "easeOut", duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${accent}, #F4B34F)` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
