import { createTRPCReact } from "@trpc/react-query";

// Use `any` for standalone frontend deploy (backend types not available on Vercel)
export const trpc = createTRPCReact<any>();
