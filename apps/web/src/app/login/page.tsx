"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Github, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGitHubLogin = async () => {
    setLoading(true);
    try {
      await signIn.social({
        provider: "github",
        callbackURL: "/app/editor",
      });
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 border border-neutral-800 bg-neutral-950 p-8 rounded-lg space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-white tracking-wide">SIGN IN TO STONEWAY</h1>
        <p className="text-xs text-neutral-400">
          Connect with your GitHub builder account to manage your profile and keys.
        </p>
      </div>

      <button
        onClick={handleGitHubLogin}
        disabled={loading}
        className="w-full flex items-center justify-center space-x-2 bg-white text-black text-xs font-bold py-2.5 px-4 rounded hover:bg-neutral-200 transition disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Github className="w-4 h-4" />
        )}
        <span>Continue with GitHub</span>
      </button>

      <div className="text-[11px] text-neutral-500 pt-4 border-t border-neutral-900">
        By signing in, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-white">Terms</Link> and{" "}
        <Link href="/privacy" className="underline hover:text-white">Privacy Policy</Link>.
      </div>
    </div>
  );
}
