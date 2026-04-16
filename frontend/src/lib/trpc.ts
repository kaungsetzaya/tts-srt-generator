import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

export const trpc = createTRPCReact<any>({
  transformer: superjson,
  // Use production backend URL from env, fallback to current origin
  links: [
    (opts) => ({
      http: ({ url }) => {
        const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
        return opts.httpLink({ url: `${baseUrl}/api/trpc` });
      },
    }),
  ],
});
