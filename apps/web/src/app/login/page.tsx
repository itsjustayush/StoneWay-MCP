"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Github, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [loadingProvider, setLoadingProvider] = useState<"github" | "google" | null>(null);

  const handleOAuthLogin = async (provider: "github" | "google") => {
    setLoadingProvider(provider);
    try {
      await signIn.social({
        provider,
        callbackURL: "/app/editor",
        errorCallbackURL: "/auth/error",
      });
    } catch {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 border border-neutral-800 bg-neutral-950 p-8 rounded-lg space-y-6 text-center font-mono">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-white tracking-wider">SIGN IN TO STONEWAY</h1>
        <p className="text-xs text-neutral-400">
          Connect your builder identity to manage personal context, keys, and agent sync.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        {/* GitHub Sign-In */}
        <button
          onClick={() => handleOAuthLogin("github")}
          disabled={loadingProvider !== null}
          className="w-full flex items-center justify-center space-x-2.5 bg-white text-black text-xs font-bold py-2.5 px-4 rounded hover:bg-neutral-200 transition disabled:opacity-50"
        >
          {loadingProvider === "github" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Github className="w-4 h-4" />
          )}
          <span>Continue with GitHub</span>
        </button>

        {/* Google Sign-In */}
        <button
          onClick={() => handleOAuthLogin("google")}
          disabled={loadingProvider !== null}
          className="w-full flex items-center justify-center space-x-2.5 bg-neutral-900 border border-neutral-800 text-white text-xs font-bold py-2.5 px-4 rounded hover:bg-neutral-800 hover:border-neutral-700 transition disabled:opacity-50"
        >
          {loadingProvider === "google" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>
      </div>

      <div className="text-[11px] text-neutral-500 pt-4 border-t border-neutral-900">
        By signing in, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-white">Terms</Link> and{" "}
        <Link href="/privacy" className="underline hover:text-white">Privacy Policy</Link>.
      </div>
    </div>
  );
}
