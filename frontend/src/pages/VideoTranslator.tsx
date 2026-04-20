import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Upload, Copy, Check, FileVideo, Languages } from "lucide-react";
import { useLocation } from "wouter";

export default function VideoTranslator() {
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ englishText: string; myanmarText: string; srtContent: string } | null>(null);
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: me } = trpc.auth.me.useQuery();
  const translateMutation = trpc.video.translate.useMutation();
  const getJobQuery = trpc.video.getTranslateJob.useQuery(
    { jobId: jobId! },
    { enabled: !!jobId, refetchInterval: 3000 }
  );

  useEffect(() => {
    if (jobId && getJobQuery.data) {
      if (getJobQuery.data.status === "completed" && getJobQuery.data.result) {
        setResult({
          englishText: getJobQuery.data.result.englishText || "",
          myanmarText: getJobQuery.data.result.myanmarText || "",
          srtContent: getJobQuery.data.result.srtContent || "",
        });
        setEditedText(getJobQuery.data.result.myanmarText || "");
        setJobId(null);
        setJobProgress(100);
        queryClient.invalidateQueries({ queryKey: ["subscription", "myStatus"] });
      } else if (getJobQuery.data.status === "failed") {
        setJobError(getJobQuery.data.error || "Translation failed");
        setJobId(null);
      } else {
        setJobProgress(getJobQuery.data.progress);
      }
    }
  }, [jobId, getJobQuery.data]);

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
    setJobError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await translateMutation.mutateAsync({ videoBase64: base64, filename: file.name });
        if (res.jobId) {
          setJobId(res.jobId);
          setJobProgress(10);
          setJobError(null);
        }
      } catch (e: any) {
        setJobError(e.message || "Translation failed");
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
    <TTSGeneratorLayout
      currentSecondaryTab={null}
      onTabChange={() => {}}
      mainTab="video"
      setMainTab={(t) => { if (t === 'tts') navigate('/lumix'); }}
      headerBar={
        <div className="flex items-center justify-between py-1.5 px-1 sm:px-4 w-full h-full">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="font-black text-base sm:text-lg tracking-tighter" style={{ color: C }}>LUMIX</div>
            <span className="text-[10px] sm:text-xs opacity-50 uppercase tracking-widest font-bold ml-1">Translator</span>
          </div>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
        {/* Title */}
        <div className="text-center py-4 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-widest mb-2" style={{ color: C }}>Video → Myanmar</h1>
          <p className="text-xs sm:text-sm opacity-50">Upload video and get Myanmar translation</p>
          <div className="flex items-center justify-center gap-3 sm:gap-4 mt-3 text-[10px] sm:text-xs opacity-40 uppercase font-bold tracking-tighter">
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
          className={`border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-all rounded-2xl ${
            dragOver ? "border-primary bg-[rgba(192,111,48,0.1)]" :
            file ? "border-green-500/50 bg-green-500/5" :
            "border-border hover:border-primary/50"
          }`}>
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          {file ? (
            <div>
              <FileVideo className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-green-400" />
              <p className="font-bold text-green-400 text-sm sm:text-base">{file.name}</p>
              <p className="text-[10px] sm:text-xs opacity-50 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              <p className="text-[10px] sm:text-xs opacity-40 mt-2 italic">Click to change file</p>
            </div>
          ) : (
            <div>
              <Upload className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-30" />
              <p className="font-bold opacity-60 text-sm sm:text-base">Drop video here or click to upload</p>
              <p className="text-[10px] sm:text-xs opacity-40 mt-2 uppercase tracking-wide">MP4, WebM, MOV, AVI — max 25MB</p>
            </div>
          )}
        </div>

        {/* Translate Button */}
        {file && !jobId && !result && (
          <button onClick={handleTranslate} disabled={isLoading}
            className="w-full py-3.5 sm:py-4 font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 transition-all rounded-xl text-white text-xs sm:text-sm"
            style={{ background: isLoading ? "rgba(192,111,48,0.4)" : C }}>
            {isLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Translating...</>
            ) : (
              <><Languages className="w-5 h-5" /> Translate to Myanmar</>
            )}
          </button>
        )}

        {/* Processing animation */}
        {(isLoading || jobId) && (
          <div className="border border-border bg-card p-6 sm:p-8 rounded-2xl text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: C }} />
              <div className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: C, animationDelay: "0.2s" }} />
              <div className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: C, animationDelay: "0.4s" }} />
            </div>
            <p className="text-xs sm:text-sm font-bold opacity-60">Translating your video...</p>
            {jobId && <p className="text-[10px] sm:text-xs font-mono opacity-40">Progress: {jobProgress}%</p>}
          </div>
        )}

        {/* Error display */}
        {jobError && (
          <div className="border border-red-500/30 bg-red-500/5 p-5 sm:p-6 rounded-2xl text-center">
            <p className="text-xs sm:text-sm font-bold text-red-400">Error: {jobError}</p>
            <button onClick={() => { setJobError(null); setFile(null); }}
              className="mt-4 text-[10px] uppercase font-black tracking-widest px-6 py-2 border border-red-500/20 hover:bg-red-500/10 transition-all rounded-xl text-red-400">
              Try Again
            </button>
          </div>
        )}

        {/* Results — editable with copy button */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="font-black uppercase tracking-wider text-sm sm:text-base" style={{ color: C }}>Translation Result</h2>
              <button onClick={handleCopy}
                className="flex items-center gap-2 text-[10px] px-4 py-2 rounded-full font-black uppercase tracking-widest text-white transition-all active:scale-95"
                style={{ background: copied ? "#22c55e" : C }}>
                {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Text</>}
              </button>
            </div>

            <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-2xl">
              <textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                className="w-full min-h-[300px] sm:min-h-[400px] p-5 sm:p-8 text-xs sm:text-sm bg-transparent focus:outline-none resize-y font-sans leading-relaxed"
                style={{ lineHeight: "2", color: "inherit" }}
              />
            </div>

            {/* New Translation */}
            <button onClick={() => { setFile(null); setResult(null); setEditedText(""); }}
              className="w-full py-3 border border-border font-black uppercase text-[10px] sm:text-xs tracking-widest hover:bg-accent transition-all rounded-xl opacity-60">
              Translate Another Video
            </button>
          </div>
        )}
      </div>
    </TTSGeneratorLayout>
  );
}
