
import { createAuthClient } from "better-auth/react";
import { sentinelClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || "https://stonewaymd.vercel.app",
  basePath: "/api/auth",
  plugins: [sentinelClient()],
});

export const { signIn, signOut, useSession } = authClient;
