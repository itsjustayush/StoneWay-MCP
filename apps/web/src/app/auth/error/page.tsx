"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const getErrorMessage = () => {
    switch (error) {
      case "access_denied":
        return "Sign-in was cancelled or permission was denied by the provider.";
      case "configuration_error":
        return "The authentication provider is not configured properly. Check OAuth credentials.";
      case "oauth_callback_error":
        return "Failed to complete the OAuth callback. Please try again.";
      case "verification_failed":
        return "Verification code or session is invalid or expired.";
      default:
        return errorDescription || "An unexpected error occurred during authentication. Your session has not been created.";
    }
  };

  return (
    <div className="max-w-md mx-auto my-16 border border-red-950/60 bg-neutral-950 p-8 rounded-lg space-y-6 text-center font-mono">
      <div className="flex justify-center">
        <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-800/60 flex items-center justify-center text-red-400">
          <AlertCircle className="w-6 h-6" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-lg font-bold text-white tracking-wider">
          AUTHENTICATION ERROR
        </h1>
        <p className="text-xs text-neutral-400 leading-relaxed">
          {getErrorMessage()}
        </p>
        {error && (
          <div className="inline-block px-2.5 py-1 mt-2 text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-400 rounded">
            code: <span className="text-neutral-200">{error}</span>
          </div>
        )}
      </div>

      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center text-xs">
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 bg-white text-black font-bold py-2.5 px-4 rounded hover:bg-neutral-200 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </Link>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 border border-neutral-800 text-neutral-300 py-2.5 px-4 rounded hover:border-neutral-600 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return Home</span>
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto my-16 p-8 text-center text-neutral-500 font-mono text-xs">
          Loading error details...
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
