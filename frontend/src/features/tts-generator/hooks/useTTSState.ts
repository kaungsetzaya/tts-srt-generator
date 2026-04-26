import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import type { VoiceTier } from "@/lib/voices";

export interface GeneratedFiles {
  audioObjectUrl: string;
  srtContent: string;
  durationMs: number;
}

export interface UseTTSStateReturn {
  text: string;
  setText: (v: string) => void;
  selectedVoice: string;
  setSelectedVoice: (v: string) => void;
  selectedTier: VoiceTier;
  setSelectedTier: (t: VoiceTier) => void;
  tone: number;
  setTone: (v: number) => void;
  speed: number;
  setSpeed: (v: number) => void;
  aspectRatio: "9:16" | "16:9";
  setAspectRatio: (v: "9:16" | "16:9") => void;
  generatedFiles: GeneratedFiles | null;
  setGeneratedFiles: (v: GeneratedFiles | null) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  geminiKey: string;
  setGeminiKey: (v: string) => void;
  savedKey: string;
  setSavedKey: (v: string) => void;
  handleGenerate: () => Promise<void>;
  getCharLimit: (isAdmin: boolean, currentPlan?: string | null) => number;
  generateMutation: { isPending: boolean };
}

export function useTTSState(
  showError: (msg: string) => void,
  lang: "mm" | "en",
  utils: any
): UseTTSStateReturn {
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<string>("thiha");
  const [selectedTier, setSelectedTier] = useState<VoiceTier>("tier1");
  const [tone, setTone] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("16:9");
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFiles | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [geminiKey, setGeminiKey] = useState("");
  const [savedKey, setSavedKey] = useState(() => localStorage.getItem("gemini_key") || "");

  const generateMutation = trpc.tts.generateAudio.useMutation({
    onSuccess: () => {
      utils.history.getUnifiedHistory.invalidate();
    },
  });

  const getCharLimit = (isAdmin: boolean, currentPlan?: string | null) => {
    if (isAdmin) return 999999;
    if (!currentPlan) return 0;
    if (selectedTier === "tier1") {
      return currentPlan === "trial" ? 50000 : 100000;
    }
    return currentPlan === "trial" ? 10000 : 50000;
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    try {
      const result = await generateMutation.mutateAsync({
        text,
        voice: selectedVoice as any,
        tone,
        speed,
        aspectRatio,
      });
      if (result.success && result.audioBase64) {
        try {
          const binary = atob(result.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
          if (bytes.length === 0) {
            showError(
              lang === "mm"
                ? "အသံ ဖန်တီး၍ မရပါ။ ထပ်ကြိုးစားပါ။"
                : "Generated audio is empty. Please try again."
            );
            return;
          }
          const blob = new Blob([bytes], {
            type: result.mimeType || "audio/mpeg",
          });
          const audioObjectUrl = URL.createObjectURL(blob);
          setGeneratedFiles({
            audioObjectUrl,
            srtContent: result.srtContent || "",
            durationMs: result.durationMs || 0,
          });
          utils.subscription.myStatus.invalidate();
        } catch (decodeErr: any) {
          console.error("[TTS Decode Error]", decodeErr);
          showError(
            lang === "mm"
              ? "အသံ ဖိုင် ပြင်ဆင်၍ မရပါ။"
              : "Failed to process audio file."
          );
        }
      } else {
        showError(
          lang === "mm"
            ? "အသံ ဖန်တီး၍ မရပါ။ ထပ်ကြိုးစားပါ。"
            : "No audio was generated. Please try again."
        );
      }
    } catch (e: any) {
      console.error("[TTS Generate Error]", e);
      showError(e?.message || "Failed");
    }
  };

  return {
    text,
    setText,
    selectedVoice,
    setSelectedVoice,
    selectedTier,
    setSelectedTier,
    tone,
    setTone,
    speed,
    setSpeed,
    aspectRatio,
    setAspectRatio,
    generatedFiles,
    setGeneratedFiles,
    audioRef,
    geminiKey,
    setGeminiKey,
    savedKey,
    setSavedKey,
    handleGenerate,
    getCharLimit,
    generateMutation,
  };
}
