import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Copy, Check } from "lucide-react";

export default function VideoTranslator() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setTranslatedText(null);
      setOriginalText(null);
    } else {
      alert("Please select a valid video file");
    }
  };

  const handleUpload = async () => {
    if (!videoFile) {
      alert("Please select a video file");
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("video", videoFile);

      const response = await fetch("/api/video/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      setOriginalText(result.originalText);
      setTranslatedText(result.translatedText);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to process video. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyTranslation = () => {
    if (translatedText) {
      navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[oklch(0.65_0.25_310)] via-[oklch(0.6_0.28_280)] to-[oklch(0.65_0.25_310)] bg-clip-text text-transparent">
            VIDEO TRANSLATOR
          </h1>
          <p className="text-[oklch(0.6_0.15_280)] text-lg">
            Upload video → Extract audio → Translate to Myanmar
          </p>
        </div>

        {/* Upload Section */}
        <div
          className="bg-[oklch(0.08_0.01_280)] border-2 border-dashed border-[oklch(0.3_0.15_310)] rounded-lg p-8 mb-8 text-center cursor-pointer hover:border-[oklch(0.65_0.25_310)] transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className="w-12 h-12 mx-auto mb-4 text-[oklch(0.65_0.25_310)]" />
          <p className="text-xl font-semibold mb-2">
            {videoFile ? videoFile.name : "Click to upload video"}
          </p>
          <p className="text-[oklch(0.5_0.1_280)] text-sm">
            Supported formats: MP4, WebM, MOV, AVI
          </p>
        </div>

        {/* Process Button */}
        <div className="mb-8">
          <Button
            onClick={handleUpload}
            disabled={!videoFile || isProcessing}
            className="w-full bg-gradient-to-r from-[oklch(0.65_0.25_310)] to-[oklch(0.6_0.28_280)] hover:from-[oklch(0.7_0.28_310)] hover:to-[oklch(0.65_0.3_280)] text-black font-bold py-3 rounded-lg transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "PROCESS VIDEO"
            )}
          </Button>
        </div>

        {/* Results Section */}
        {(originalText || translatedText) && (
          <div className="space-y-6">
            {/* Original Text */}
            {originalText && (
              <div className="bg-[oklch(0.08_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-6 rounded-lg">
                <h3 className="text-sm font-bold text-[oklch(0.6_0.28_280)] uppercase tracking-wider mb-3">
                  Original Text
                </h3>
                <p className="text-[oklch(0.85_0.1_280)] leading-relaxed">
                  {originalText}
                </p>
              </div>
            )}

            {/* Translated Text */}
            {translatedText && (
              <div className="bg-[oklch(0.08_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-6 rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-sm font-bold text-[oklch(0.65_0.25_310)] uppercase tracking-wider">
                    Myanmar Translation
                  </h3>
                  <Button
                    onClick={handleCopyTranslation}
                    size="sm"
                    variant="outline"
                    className="border-[oklch(0.65_0.25_310)] text-[oklch(0.65_0.25_310)] hover:bg-[oklch(0.65_0.25_310)] hover:text-black"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[oklch(0.85_0.1_280)] leading-relaxed text-lg font-semibold">
                  {translatedText}
                </p>
                <p className="text-[oklch(0.5_0.1_280)] text-sm mt-4">
                  💡 Paste this text into the Text-to-Speech generator to create Myanmar audio
                </p>
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-[oklch(0.08_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-6 rounded-lg">
          <h3 className="text-sm font-bold text-[oklch(0.6_0.28_280)] uppercase tracking-wider mb-3">
            How it works
          </h3>
          <ol className="space-y-2 text-[oklch(0.7_0.15_280)] text-sm">
            <li>1. Upload your video file (any language)</li>
            <li>2. System extracts audio and transcribes it</li>
            <li>3. Text is automatically translated to Myanmar</li>
            <li>4. Copy the Myanmar text to use in Text-to-Speech</li>
            <li>5. Generate Myanmar audio and download</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
