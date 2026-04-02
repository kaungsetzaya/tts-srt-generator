import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Play, Volume2 } from "lucide-react";

export default function TTSGenerator() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<"thiha" | "nilar">("thiha");
  const [tone, setTone] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("16:9");
  const [previewAudio, setPreviewAudio] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<{ audioUrl: string; srtUrl: string; audioData?: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const generateMutation = trpc.tts.generateAudio.useMutation();
  const previewMutation = trpc.tts.preview.useMutation();
  const voicesQuery = trpc.tts.getVoices.useQuery();

  const handlePreview = async () => {
    try {
      const result = await previewMutation.mutateAsync({
        voice,
        tone,
        speed,
      });
      if (result.success) {
        const audioData = Buffer.from(result.audio, "base64");
        const blob = new Blob([audioData], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        setPreviewAudio(url);
        setIsPreviewPlaying(true);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
        }
      }
    } catch (error) {
      console.error("Preview error:", error);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      alert("Please enter some text");
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        text,
        voice,
        tone,
        speed,
        aspectRatio,
      });

      if (result.success) {
        // Store the generated files URLs for display
        setGeneratedFiles({
          audioUrl: result.audioUrl,
          srtUrl: result.srtUrl,
        });
      }
    } catch (error) {
      console.error("Generation error:", error);
      alert("Failed to generate audio and SRT");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative">
      {/* Background grid effect */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(102, 204, 255, 0.05) 25%, rgba(102, 204, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(102, 204, 255, 0.05) 75%, rgba(102, 204, 255, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(102, 204, 255, 0.05) 25%, rgba(102, 204, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(102, 204, 255, 0.05) 75%, rgba(102, 204, 255, 0.05) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header with HUD styling */}
        <div className="mb-12 relative">
          <div className="absolute -top-4 -left-4 w-8 h-8 border-2 border-[oklch(0.65_0.25_310)] opacity-70"></div>
          <div className="absolute -top-4 -right-4 w-8 h-8 border-2 border-[oklch(0.65_0.25_310)] opacity-70"></div>
          <div className="absolute -bottom-4 -left-4 w-8 h-8 border-2 border-[oklch(0.65_0.25_310)] opacity-70"></div>
          <div className="absolute -bottom-4 -right-4 w-8 h-8 border-2 border-[oklch(0.65_0.25_310)] opacity-70"></div>

          <div className="text-center py-8">
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-widest mb-2"
              style={{
                textShadow: '0 0 20px oklch(0.65 0.25 310), 0 0 40px oklch(0.65 0.25 310), 0 0 60px oklch(0.65 0.25 310)',
                color: 'oklch(0.65 0.25 310)'
              }}>
              TTS Generator
            </h1>
            <p className="text-lg uppercase tracking-widest opacity-80"
              style={{
                textShadow: '0 0 10px oklch(0.6 0.28 280)',
                color: 'oklch(0.6 0.28 280)'
              }}>
              Convert Text to Speech with Cyberpunk Flair
            </p>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Left panel - Input and settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Text Input */}
            <div className="relative border-2 border-[oklch(0.2_0.02_280_/_60%)] p-6 bg-[oklch(0.08_0.01_280_/_50%)] backdrop-blur">
              <div className="absolute -top-3 left-4 px-2 bg-background text-xs uppercase tracking-widest font-bold"
                style={{ color: 'oklch(0.6 0.28 280)' }}>
                Input Text
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your text here... (max 5000 characters)"
                maxLength={5000}
                className="w-full h-40 bg-[oklch(0.08_0.01_280)] text-[oklch(0.95_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-4 focus:outline-none focus:border-[oklch(0.65_0.25_310)] focus:ring-2 focus:ring-[oklch(0.65_0.25_310_/_30%)] resize-none"
              />
              <div className="mt-2 text-xs text-right opacity-60">
                {text.length} / 5000
              </div>
            </div>

            {/* Voice Selection */}
            <div className="relative border-2 border-[oklch(0.2_0.02_280_/_60%)] p-6 bg-[oklch(0.08_0.01_280_/_50%)] backdrop-blur">
              <div className="absolute -top-3 left-4 px-2 bg-background text-xs uppercase tracking-widest font-bold"
                style={{ color: 'oklch(0.6 0.28 280)' }}>
                Voice Selection
              </div>
              <Select value={voice} onValueChange={(v) => setVoice(v as "thiha" | "nilar")}>
                <SelectTrigger className="w-full bg-[oklch(0.08_0.01_280)] border-[oklch(0.2_0.02_280_/_60%)] text-[oklch(0.95_0.01_280)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[oklch(0.08_0.01_280)] border-[oklch(0.2_0.02_280_/_60%)]">
                  <SelectItem value="thiha" className="text-[oklch(0.95_0.01_280)]">Thiha (Female)</SelectItem>
                  <SelectItem value="nilar" className="text-[oklch(0.95_0.01_280)]">Nilar (Male)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tone Control */}
            <div className="relative border-2 border-[oklch(0.2_0.02_280_/_60%)] p-6 bg-[oklch(0.08_0.01_280_/_50%)] backdrop-blur">
              <div className="absolute -top-3 left-4 px-2 bg-background text-xs uppercase tracking-widest font-bold"
                style={{ color: 'oklch(0.6 0.28 280)' }}>
                Tone / Pitch
              </div>
              <div className="space-y-4 mt-2">
                <Slider
                  value={[tone]}
                  onValueChange={(v) => setTone(v[0])}
                  min={-20}
                  max={20}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between items-center text-sm">
                  <span className="opacity-70">Lower</span>
                  <span className="font-bold text-[oklch(0.65_0.25_310)]">{tone > 0 ? '+' : ''}{tone} Hz</span>
                  <span className="opacity-70">Higher</span>
                </div>
              </div>
            </div>

            {/* Speed Control */}
            <div className="relative border-2 border-[oklch(0.2_0.02_280_/_60%)] p-6 bg-[oklch(0.08_0.01_280_/_50%)] backdrop-blur">
              <div className="absolute -top-3 left-4 px-2 bg-background text-xs uppercase tracking-widest font-bold"
                style={{ color: 'oklch(0.6 0.28 280)' }}>
                Speed / Rate
              </div>
              <div className="space-y-4 mt-2">
                <Slider
                  value={[speed]}
                  onValueChange={(v) => setSpeed(v[0])}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between items-center text-sm">
                  <span className="opacity-70">Slower</span>
                  <span className="font-bold text-[oklch(0.65_0.25_310)]">{speed.toFixed(1)}x</span>
                  <span className="opacity-70">Faster</span>
                </div>
              </div>
            </div>

            {/* Aspect Ratio Selection */}
            <div className="relative border-2 border-[oklch(0.2_0.02_280_/_60%)] p-6 bg-[oklch(0.08_0.01_280_/_50%)] backdrop-blur">
              <div className="absolute -top-3 left-4 px-2 bg-background text-xs uppercase tracking-widest font-bold"
                style={{ color: 'oklch(0.6 0.28 280)' }}>
                SRT Aspect Ratio
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                {(['9:16', '16:9'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-3 px-4 border-2 font-bold uppercase tracking-wider transition-all duration-200 ${
                      aspectRatio === ratio
                        ? 'border-[oklch(0.65_0.25_310)] bg-[oklch(0.65_0.25_310_/_20%)] text-[oklch(0.65_0.25_310)] shadow-[0_0_15px_oklch(0.65_0.25_310_/_50%)]'
                        : 'border-[oklch(0.2_0.02_280_/_60%)] text-[oklch(0.95_0.01_280)] hover:border-[oklch(0.6_0.28_280)]'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel - Preview and Actions */}
          <div className="space-y-6">
            {/* Generate Section */}
            <div className="relative border-2 border-[oklch(0.2_0.02_280_/_60%)] p-6 bg-[oklch(0.08_0.01_280_/_50%)] backdrop-blur">
              <div className="absolute -top-3 left-4 px-2 bg-background text-xs uppercase tracking-widest font-bold"
                style={{ color: 'oklch(0.6 0.28_280)' }}>
                Generate & Download
              </div>
              <div className="space-y-4 mt-4">
                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || !text.trim()}
                  className="w-full btn-cyan flex items-center justify-center gap-2"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
                <p className="text-xs opacity-60 text-center">
                  Generates both MP3 audio and SRT subtitle files
                </p>
                
                {/* Download Links Section */}
                {generatedFiles && (
                  <div className="space-y-4 pt-4 border-t border-[oklch(0.2_0.02_280_/_60%)]">
                    {/* Audio Preview Player */}
                    <div className="bg-[oklch(0.08_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-3 rounded">
                      <p className="text-xs font-bold text-[oklch(0.6_0.28_280)] uppercase tracking-wider mb-2">Preview Audio:</p>
                      <audio
                        controls
                        src={generatedFiles.audioUrl}
                        crossOrigin="anonymous"
                        className="w-full"
                        style={{
                          accentColor: 'oklch(0.65 0.25 310)'
                        }}
                      />
                    </div>
                    
                    <p className="text-xs font-bold text-[oklch(0.65_0.25_310)] uppercase tracking-wider">Ready to Download:</p>
                    <a
                      href={generatedFiles.audioUrl}
                      download={`audio-${Date.now()}.mp3`}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[oklch(0.65_0.25_310_/_20%)] border border-[oklch(0.65_0.25_310)] text-[oklch(0.65_0.25_310)] hover:bg-[oklch(0.65_0.25_310_/_40%)] transition-all duration-200 rounded font-semibold text-sm uppercase tracking-wider"
                    >
                      <Download className="w-4 h-4" />
                      Audio (MP3)
                    </a>
                    <a
                      href={generatedFiles.srtUrl}
                      download={`subtitles-${Date.now()}.srt`}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[oklch(0.6_0.28_280_/_20%)] border border-[oklch(0.6_0.28_280)] text-[oklch(0.6_0.28_280)] hover:bg-[oklch(0.6_0.28_280_/_40%)] transition-all duration-200 rounded font-semibold text-sm uppercase tracking-wider"
                    >
                      <Download className="w-4 h-4" />
                      Subtitles (SRT)
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="relative border-2 border-[oklch(0.2_0.02_280_/_60%)] p-6 bg-[oklch(0.08_0.01_280_/_50%)] backdrop-blur">
              <div className="absolute -top-3 left-4 px-2 bg-background text-xs uppercase tracking-widest font-bold"
                style={{ color: 'oklch(0.6 0.28_280)' }}>
                Info
              </div>
              <div className="space-y-3 mt-4 text-xs opacity-70">
                <div>
                  <p className="font-bold text-[oklch(0.6_0.28_280)] mb-1">Supported Voices:</p>
                  <p>Thiha (Female), Nilar (Male)</p>
                </div>
                <div>
                  <p className="font-bold text-[oklch(0.6_0.28_280)] mb-1">Tone Range:</p>
                  <p>-20 to +20 Hz</p>
                </div>
                <div>
                  <p className="font-bold text-[oklch(0.6_0.28_280)] mb-1">Speed Range:</p>
                  <p>0.5x to 2.0x</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden audio element for preview */}
      <audio ref={audioRef} />
    </div>
  );
}
