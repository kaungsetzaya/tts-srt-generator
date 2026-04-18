import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from './const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Use choco.de5.net backend directly
const getBackendUrl = () => {
  // Direct choco.de5.net for all deployments
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // If accessing via choco.de5.net or localhost, use that directly
    if (host === 'choco.de5.net' || host === 'www.choco.de5.net' || host === 'localhost') {
      return 'https://choco.de5.net';
    }
  }
  // Default to choco.de5.net
  return 'https://choco.de5.net';
};

const BACKEND_URL = getBackendUrl();

const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: BACKEND_URL ? `${BACKEND_URL}/api/trpc` : '/api/trpc',
      transformer: superjson,
      fetch(input, init) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 600000); // 10 min
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));
      },
    }),
  ],
});

// ────────────────────────────────────────────────────
// 🌐 BROWSER ERROR CAPTURE — sends real browser errors
//    (window.onerror, unhandled promise rejections)
//    to the admin error reports via logBrowserError
// ────────────────────────────────────────────────────
function sendBrowserError(errorMessage: string, source: "window.onerror" | "unhandledrejection" | "react_error_boundary", stack?: string) {
  // Use raw fetch to avoid circular dependency with trpc
  fetch(BACKEND_URL ? `${BACKEND_URL}/api/trpc/logBrowserError` : '/api/trpc/logBrowserError', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      json: {
        errorMessage: errorMessage.slice(0, 2000),
        source,
        stackTrace: stack?.slice(0, 5000) || undefined,
        url: window.location.href.slice(0, 500),
      },
    }),
  }).catch(() => {}); // silently fail — don't cause more errors
}

// Capture unhandled JS errors (syntax errors, runtime crashes, etc.)
window.onerror = (message, _source, _lineno, _colno, error) => {
  const msg = typeof message === "string" ? message : "Unknown browser error";
  sendBrowserError(msg, "window.onerror", error?.stack);
};

// Capture unhandled promise rejections
window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection");
  const stack = reason instanceof Error ? reason.stack : undefined;
  sendBrowserError(msg, "unhandledrejection", stack);
};

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
