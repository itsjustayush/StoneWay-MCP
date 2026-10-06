"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[StoneWay Client Error]:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 font-mono">
      <h1 className="text-2xl font-bold text-red-400 tracking-wider">SYSTEM RECOVERY</h1>
      <p className="text-neutral-400 text-xs max-w-md">
        An unexpected state occurred while rendering this interface. Your data remains safely encrypted in the vault.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="text-xs bg-white text-black font-bold px-4 py-2 rounded hover:bg-neutral-200 transition"
        >
          try again
        </button>
        <Link
          href="/"
          className="text-xs text-neutral-300 border border-neutral-800 px-4 py-2 rounded hover:border-neutral-600 transition"
        >
          home
        </Link>
      </div>
    </div>
  );
}
