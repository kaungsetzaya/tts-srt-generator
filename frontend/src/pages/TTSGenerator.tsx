import { useTTSGeneratorState } from "@/features/tts-generator/hooks/useTTSGeneratorState";
import TTSGeneratorContent from "@/features/tts-generator/components/TTSGeneratorContent";

export default function TTSGenerator() {
  const state = useTTSGeneratorState();
  return <TTSGeneratorContent {...state} />;
}
