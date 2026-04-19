export interface JobStatus {
  id: string;
  type: "tts" | "translation" | "dubbing";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
  input: Record<string, unknown>;
  result?: unknown;
  error?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  jobId?: string;
}