import { Star } from "lucide-react";

interface CompactUsageDisplayProps {
  subStatus: any;
  isCollapsed: boolean;
}

export function CompactUsageDisplay({ subStatus, isCollapsed }: CompactUsageDisplayProps) {
  if (!subStatus?.active) {
    return (
      <div className="px-3 py-2 text-xs opacity-60">
        <p>No subscription</p>
      </div>
    );
  }

  const plan = subStatus.plan;
  const isTrial = plan === "trial";

  // Trial usage
  if (isTrial && subStatus.trialUsage && subStatus.trialLimits) {
    const usage = subStatus.trialUsage;
    const limits = subStatus.trialLimits;

    const remainingTTS = limits.totalTtsSrt - usage.tts;
    const remainingAI = limits.totalAiVideo - usage.aiVideo;
    const remainingChar = limits.totalCharacterUse - usage.characterUse;
    const remainingTranslate = limits.totalVideoTranslate - usage.videoTranslate;

    if (isCollapsed) {
      return (
        <div className="px-2 py-3 text-center">
          <Star className="w-5 h-5 mx-auto mb-1" style={{ color: "#f59e0b" }} />
          <div className="text-xs font-bold text-yellow-500">TRIAL</div>
        </div>
      );
    }

    return (
      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center gap-2 mb-2 p-2 rounded-lg" style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
          <Star className="w-4 h-4" style={{ color: "#f59e0b" }} />
          <span className="text-xs font-bold text-yellow-500">TRIAL</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* TTS */}
          <div className="p-2 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
            <div className="opacity-60" style={{ fontSize: "9px" }}>TTS</div>
            <div className="font-bold">
              {usage.tts}/{limits.totalTtsSrt}
              <span className={remainingTTS <= 2 ? "text-red-400" : "text-green-400"}>
                ({remainingTTS})
              </span>
            </div>
          </div>

          {/* Auto Creator */}
          <div className="p-2 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
            <div className="opacity-60" style={{ fontSize: "9px" }}>Auto Creator</div>
            <div className="font-bold">
              {usage.aiVideo}/{limits.totalAiVideo}
              <span className={remainingAI <= 1 ? "text-red-400" : "text-green-400"}>
                ({remainingAI})
              </span>
            </div>
          </div>

          {/* Character Voice */}
          <div className="p-2 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
            <div className="opacity-60" style={{ fontSize: "9px" }}>VC</div>
            <div className="font-bold">
              {usage.characterUse}/{limits.totalCharacterUse}
              <span className={remainingChar <= 1 ? "text-red-400" : "text-green-400"}>
                ({remainingChar})
              </span>
            </div>
          </div>

          {/* Video Translate */}
          <div className="p-2 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
            <div className="opacity-60" style={{ fontSize: "9px" }}>Translate</div>
            <div className="font-bold">
              {usage.videoTranslate}/{limits.totalVideoTranslate}
              <span className={remainingTranslate <= 1 ? "text-red-400" : "text-green-400"}>
                ({remainingTranslate})
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Subscription usage
  if (subStatus.usage && subStatus.limits) {
    const usage = subStatus.usage;
    const limits = subStatus.limits;

    if (isCollapsed) {
      return (
        <div className="px-2 py-3 text-center">
          <Star className="w-5 h-5 mx-auto mb-1" style={{ color: "#16a34a" }} />
          <div className="text-xs font-bold text-green-500">{plan?.toUpperCase()}</div>
        </div>
      );
    }

    return (
      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center gap-2 mb-2 p-2 rounded-lg" style={{ background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
          <Star className="w-4 h-4" style={{ color: "#22c55e" }} />
          <span className="text-xs font-bold text-green-400">{plan?.toUpperCase()}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* TTS */}
          <div className="p-2 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
            <div className="opacity-60" style={{ fontSize: "9px" }}>TTS (Today)</div>
            <div className="font-bold">
              {usage.tts}/{limits.dailyTtsSrt}
            </div>
          </div>

          {/* Character Voice */}
          <div className="p-2 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
            <div className="opacity-60" style={{ fontSize: "9px" }}>VC (Today)</div>
            <div className="font-bold">
              {usage.characterUse}/{limits.dailyCharacterUse}
            </div>
          </div>

          {/* Video Translate */}
          <div className="p-2 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
            <div className="opacity-60" style={{ fontSize: "9px" }}>Translate</div>
            <div className="font-bold">
              {usage.videoTranslate}/{limits.dailyVideoTranslate}
            </div>
          </div>

          {/* Auto Creator */}
          <div className="p-2 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
            <div className="opacity-60" style={{ fontSize: "9px" }}>Auto Creator</div>
            <div className="font-bold">
              {usage.aiVideo}/{limits.dailyAiVideo}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
