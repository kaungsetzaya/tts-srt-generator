import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export interface VideoResult {
  myanmarText: string;
  srtContent?: string;
}

export interface UseVideoStateReturn {
  videoFile: File | null;
  setVideoFile: (f: File | null) => void;
  videoUrl: string;
  setVideoUrl: (url: string) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  videoResult: VideoResult | null;
  setVideoResult: (v: VideoResult | null) => void;
  editedVideoText: string;
  setEditedVideoText: (v: string) => void;
  videoCopied: boolean;
  setVideoCopied: (v: boolean) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  translateJobId: string | null;
  translateJobProgress: number;
  translateJobMessage: string;
  translateJobType: "file" | "link";
  translatePreviewUrl: string;
  setTranslatePreviewUrl: (v: string) => void;
  translateVideoLoading: boolean;
  setTranslateVideoLoading: (v: boolean) => void;
  translateVideoError: string;
  setTranslateVideoError: (v: string) => void;

  // Handlers
  handleVideoFile: (f: File) => void;
  handleTranslate: () => Promise<void>;
  handleVideoCopy: () => Promise<void>;
  handleVideoReset: () => void;
  handleVideoDownloadFromUrl: () => Promise<void>;
  downloadFile: (content: string, filename: string) => void;
  pollTranslateJob: (jobId: string, jobType: "file" | "link") => void;
}

export function useVideoState(
  showError: (msg: string) => void,
  utils: any
): UseVideoStateReturn {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null);
  const [editedVideoText, setEditedVideoText] = useState("");
  const [videoCopied, setVideoCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Translation job polling state
  const [translateJobId, setTranslateJobId] = useState<string | null>(null);
  const [translateJobProgress, setTranslateJobProgress] = useState(0);
  const [translateJobMessage, setTranslateJobMessage] = useState("");
  const [translateJobType, setTranslateJobType] = useState<"file" | "link">("file");

  // tRPC polling queries for translation jobs
  const translateFileJobQuery = trpc.video.getTranslateJob.useQuery(
    { jobId: translateJobId ?? "" },
    {
      enabled: !!translateJobId && translateJobType === "file",
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === "completed" || data?.status === "failed") return false;
        return 3000;
      },
      retry: false,
      staleTime: 0,
    }
  );
  const translateLinkJobQuery = trpc.video.getTranslateLinkJob.useQuery(
    { jobId: translateJobId ?? "" },
    {
      enabled: !!translateJobId && translateJobType === "link",
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === "completed" || data?.status === "failed") return false;
        return 3000;
      },
      retry: false,
      staleTime: 0,
    }
  );

  // Video preview state for translate tab
  const [translatePreviewUrl, setTranslatePreviewUrl] = useState<string>("");
  const [translateVideoLoading, setTranslateVideoLoading] = useState(false);
  const [translateVideoError, setTranslateVideoError] = useState<string>("");

  const translateMutation = trpc.video.translate.useMutation();
  const translateLinkMutation = trpc.video.translateLink.useMutation();

  // Auto-preview video for translate tab when URL changes
  useEffect(() => {
    if (videoUrl.trim() && !videoFile) {
      setTranslateVideoLoading(true);
      setTranslateVideoError("");
      const timer = setTimeout(() => {
        setTranslatePreviewUrl(videoUrl.trim());
        setTranslateVideoLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!videoUrl && !videoFile) {
      setTranslatePreviewUrl("");
      setTranslateVideoError("");
      setTranslateVideoLoading(false);
    }
  }, [videoUrl, videoFile]);

  // React to translation job query data
  const activeTranslateJobQuery = translateJobType === "file" ? translateFileJobQuery : translateLinkJobQuery;
  const activeTranslateJobData = activeTranslateJobQuery.data;
  const activeTranslateJobError = activeTranslateJobQuery.error;

  useEffect(() => {
    if (!translateJobId) return;

    if (activeTranslateJobError) {
      const errMsg = (activeTranslateJobError as any)?.message || "Translation polling failed. Please try again.";
      showError(errMsg);
      setTranslateJobId(null);
      setTranslateJobProgress(0);
      setTranslateJobMessage("");
      return;
    }

    if (!activeTranslateJobData) return;

    if (activeTranslateJobData.status === "completed" && activeTranslateJobData.result) {
      setVideoResult({
        myanmarText: activeTranslateJobData.result.myanmarText,
        srtContent: activeTranslateJobData.result.srtContent,
      });
      setEditedVideoText(activeTranslateJobData.result.myanmarText);
      setTranslateJobId(null);
      setTranslateJobProgress(100);
      setTranslateJobMessage("");
      utils.subscription.myStatus.invalidate();
    } else if (activeTranslateJobData.status === "failed") {
      showError(activeTranslateJobData.error || "Translation failed. Please try again.");
      setTranslateJobId(null);
      setTranslateJobProgress(0);
      setTranslateJobMessage("");
    } else {
      const pct = activeTranslateJobData.progress ?? 0;
      setTranslateJobProgress(pct > 0 ? pct : 10);
      setTranslateJobMessage((activeTranslateJobData as any).message || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translateJobId, activeTranslateJobData, activeTranslateJobError]);

  // Timeout guard: if translation takes > 10 minutes, surface an error
  useEffect(() => {
    if (!translateJobId) return;
    const timeout = setTimeout(() => {
      if (translateJobId) {
        showError("Translation timed out after 10 minutes. Please try a shorter video.");
        setTranslateJobId(null);
        setTranslateJobProgress(0);
      }
    }, 10 * 60 * 1000);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translateJobId]);

  const handleVideoFile = (f: File) => {
    if (f.size > 25 * 1024 * 1024) {
      showError("File too large. Max 25MB.");
      return;
    }
    setVideoFile(f);
    setVideoUrl("");
    setVideoResult(null);
  };

  const pollTranslateJob = (jobId: string, jobType: "file" | "link") => {
    setTranslateJobType(jobType);
    setTranslateJobId(jobId);
    setTranslateJobProgress(10);
  };

  const handleTranslate = async () => {
    if (videoUrl.trim()) {
      try {
        const res = await translateLinkMutation.mutateAsync({
          url: videoUrl.trim(),
        });
        if (res.jobId) {
          pollTranslateJob(res.jobId, "link");
        }
      } catch (e: any) {
        showError(e?.message || "Link Translation failed");
      }
      return;
    }

    if (!videoFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await translateMutation.mutateAsync({
          videoBase64: base64,
          filename: videoFile.name,
        });
        if (res.jobId) {
          pollTranslateJob(res.jobId, "file");
        }
      } catch (e: any) {
        showError(e?.message || "Translation failed");
      }
    };
    reader.readAsDataURL(videoFile);
  };

  const handleVideoCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedVideoText);
      setVideoCopied(true);
      setTimeout(() => setVideoCopied(false), 2000);
    } catch {
      /* fallback */
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const withCRLF = normalized.replace(/\n/g, "\r\n");
    const blob = new Blob(["\uFEFF" + withCRLF], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVideoReset = () => {
    setVideoFile(null);
    setVideoUrl("");
    setVideoResult(null);
    setEditedVideoText("");
    setTranslateJobId(null);
    setTranslateJobProgress(0);
  };

  const handleVideoDownloadFromUrl = async () => {
    if (!videoUrl.trim()) return;
    window.open(videoUrl.trim(), "_blank");
  };

  return {
    videoFile, setVideoFile,
    videoUrl, setVideoUrl,
    dragOver, setDragOver,
    videoResult, setVideoResult,
    editedVideoText, setEditedVideoText,
    videoCopied, setVideoCopied,
    fileRef,
    translateJobId, translateJobProgress, translateJobMessage, translateJobType,
    translatePreviewUrl, setTranslatePreviewUrl,
    translateVideoLoading, setTranslateVideoLoading,
    translateVideoError, setTranslateVideoError,
    handleVideoFile,
    handleTranslate,
    handleVideoCopy,
    handleVideoReset,
    handleVideoDownloadFromUrl,
    downloadFile,
    pollTranslateJob,
  };
}
