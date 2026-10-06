import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "StoneWay — Unified Agent Memory & Bio Protocol",
  description: "Notion for your AI agents. Cloud-backed, persistent developer memory and bio automation via MCP.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-black text-neutral-200 antialiased flex flex-col selection:bg-white selection:text-black">
        {/* Minimal Monospace Top Nav */}
        <header className="border-b border-neutral-900 bg-black/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between text-xs tracking-wider">
            <div className="flex items-center space-x-6">
              <Link href="/" className="font-bold text-white hover:opacity-80 transition">
                STONEWAY
              </Link>
              <Link href="/docs" className="text-neutral-400 hover:text-white transition">
                docs
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-neutral-300 hover:text-white border border-neutral-800 px-3 py-1 rounded hover:border-neutral-600 transition"
              >
                sign in / dashboard
              </Link>
              <a
                href="https://github.com/itsjustayush/StoneWay-MCP"
                target="_blank"
                rel="noreferrer"
                className="text-neutral-400 hover:text-white transition"
              >
                [github]
              </a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">{children}</main>

        {/* Minimal Monospace Footer */}
        <footer className="border-t border-neutral-900 py-8 text-neutral-500 text-xs">
          <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              Built with 🖤 by{" "}
              <a
                href="https://github.com/itsjustayush"
                target="_blank"
                rel="noreferrer"
                className="text-neutral-300 underline hover:text-white"
              >
                itsjustayush
              </a>{" "}
              under the MIT License.
            </div>
            <div className="flex flex-wrap items-center gap-4 text-neutral-400">
              <Link href="/privacy" className="hover:text-white transition">
                privacy
              </Link>
              <Link href="/terms" className="hover:text-white transition">
                terms
              </Link>
              <Link href="/disclaimer" className="hover:text-white transition">
                disclaimer
              </Link>
              <Link href="/security" className="hover:text-white transition">
                security
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
