import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Upload, Copy, Check, FileVideo, Languages } from "lucide-react";
import { useLocation } from "wouter";

export default function VideoTranslator() {
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ englishText: string; myanmarText: string; srtContent: string } | null>(null);
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: me } = trpc.auth.me.useQuery();
  const translateMutation = trpc.video.translate.useMutation();

  const handleFile = (f: File) => {
    if (f.size > 25 * 1024 * 1024) { alert("Max file size is 25MB"); return; }
    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/mkv"];
    if (!validTypes.some(t => f.type.startsWith("video/"))) { alert("Please upload a video file"); return; }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleTranslate = async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await translateMutation.mutateAsync({ videoBase64: base64, filename: file.name });
        if (res.success) {
          setResult({ englishText: res.englishText, myanmarText: res.myanmarText, srtContent: res.srtContent });
          setEditedText(res.myanmarText);
        }
      } catch (e: any) {
        alert(e.message ?? "Translation failed");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const C = "#C06F30";
  const isLoading = translateMutation.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/80">
        <div className="flex items-center gap-2">
          <Languages className="w-5 h-5" style={{ color: C }} />
          <span className="font-black uppercase tracking-widest text-sm" style={{ color: C }}>Video Translator</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/lumix" className="text-xs px-3 py-1 border border-border opacity-60 hover:opacity-100 transition-all uppercase tracking-wider">TTS Page</a>
          {me?.role === "admin" && (
            <a href="/admin" className="text-xs px-3 py-1 border border-border opacity-60 hover:opacity-100 transition-all uppercase tracking-wider">Admin</a>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Title */}
        <div className="text-center py-6">
          <h1 className="text-3xl font-black uppercase tracking-widest mb-2" style={{ color: C }}>Video → Myanmar</h1>
          <p className="text-sm opacity-50">Upload video and get Myanmar translation</p>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs opacity-40">
            <span>Max 25MB</span>
            <span>•</span>
            <span>Max 3 minutes</span>
            <span>•</span>
            <span>Any language → Myanmar</span>
          </div>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
            dragOver ? "border-primary bg-[rgba(192,111,48,0.1)]" :
            file ? "border-green-500/50 bg-green-500/5" :
            "border-border hover:border-primary/50"
          }`}>
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          {file ? (
            <div>
              <FileVideo className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="font-bold text-green-400">{file.name}</p>
              <p className="text-xs opacity-50 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              <p className="text-xs opacity-40 mt-2">Click to change file</p>
            </div>
          ) : (
            <div>
              <Upload className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-bold opacity-60">Drop video here or click to upload</p>
              <p className="text-xs opacity-40 mt-2">MP4, WebM, MOV, AVI — max 25MB, 3 minutes</p>
            </div>
          )}
        </div>

        {/* Translate Button */}
        {file && (
          <button onClick={handleTranslate} disabled={isLoading}
            className="w-full py-4 font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 transition-all rounded-xl"
            style={{ background: isLoading ? "rgba(192,111,48,0.4)" : C }}>
            {isLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Processing... (1-3 minutes)</>
            ) : (
              <><Languages className="w-5 h-5" /> Translate to Myanmar</>
            )}
          </button>
        )}

        {/* Processing animation — no tech details */}
        {isLoading && (
          <div className="border border-border bg-card p-8 rounded-xl text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: C }} />
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: C, animationDelay: "0.3s" }} />
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: C, animationDelay: "0.6s" }} />
            </div>
            <p className="text-sm font-bold opacity-60">Translating your video...</p>
            <p className="text-xs opacity-40 mt-2">This may take 1-3 minutes depending on video length</p>
          </div>
        )}

        {/* Results — editable with copy button */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black uppercase tracking-wider" style={{ color: C }}>Translation Result</h2>
              <button onClick={handleCopy}
                className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl font-bold transition-all hover:scale-105"
                style={{ background: copied ? "#4ade80" : C }}>
                {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Text</>}
              </button>
            </div>

            <div className="border border-border bg-card rounded-xl overflow-hidden">
              <textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                className="w-full min-h-[300px] p-6 text-sm bg-transparent focus:outline-none resize-y font-sans"
                style={{ lineHeight: "2.2", color: "inherit" }}
              />
            </div>

            {/* New Translation */}
            <button onClick={() => { setFile(null); setResult(null); setEditedText(""); }}
              className="w-full py-3 border border-border font-bold uppercase text-sm hover:opacity-70 transition-all rounded-xl">
              Translate Another Video
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
