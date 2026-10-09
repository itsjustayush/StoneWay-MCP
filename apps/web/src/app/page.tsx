"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Terminal, Shield, Cpu, RefreshCw, Key } from "lucide-react";

export default function LandingPage() {
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const installCommand = "npx -y stoneway-mcp";
  const jsonConfig = `{
  "mcpServers": {
    "stoneway": {
      "command": "npx",
      "args": ["-y", "stoneway-mcp"],
      "env": {
        "STONEWAY_TOKEN": "sw_your_token_here",
        "STONEWAY_API_URL": "https://stoneway.vercel.app/api/v1"
      }
    }
  }
}`;

  const copyToClipboard = (text: string, setFn: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  return (
    <div className="space-y-12">
      {/* Top Banner & GitHub Badge */}
      <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
        <a
          href="https://github.com/itsjustayush/StoneWay-MCP"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center space-x-2 text-xs border border-neutral-800 bg-neutral-950 px-3 py-1 rounded-full text-neutral-400 hover:text-white hover:border-neutral-700 transition"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>GitHub: itsjustayush/StoneWay-MCP</span>
        </a>
        <span className="text-xs text-neutral-600">v0.1.0 • MIT Open Source</span>
      </div>

      {/* ASCII Art Block */}
      <div className="overflow-x-auto py-2">
        <pre className="text-[10px] md:text-xs leading-none text-neutral-200 select-all font-mono">
{`███████╗████████╗ ██████╗ ███╗   ██╗███████╗██╗    ██╗ █████╗ ██╗   ██╗    ███╗   ███╗██████╗ 
██╔════╝╚══██╔══╝██╔═══██╗████╗  ██║██╔════╝██║    ██║██╔══██╗╚██╗ ██╔╝    ████╗ ████║██╔══██╗
███████╗   ██║   ██║   ██║██╔██╗ ██║█████╗  ██║ █╗ ██║███████║ ╚████╔╝     ██╔████╔██║██║  ██║
╚════██║   ██║   ██║   ██║██║╚██╗██║██╔══╝  ██║███╗██║██╔══██║  ╚██╔╝      ██║╚██╔╝██║██║  ██║
███████║   ██║   ╚██████╔╝██║ ╚████║███████╗╚███╔███╔╝██║  ██║   ██║       ██║ ╚═╝ ██║██████╔╝
╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝       ╚═╝     ╚═╝╚═════╝`}
        </pre>
      </div>

      {/* Tagline */}
      <div className="space-y-4 max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
          Give every AI agent the same you.
        </h1>
        <p className="text-neutral-300 text-sm font-medium leading-relaxed">
          StoneWay gives your AI agents a persistent, user-owned source of identity, projects, preferences and context.
        </p>
        <p className="text-neutral-500 text-xs italic">
          &ldquo;StoneWay isn&rsquo;t where your AI remembers you. It&rsquo;s where your agents learn who you are.&rdquo;
        </p>
      </div>

      {/* Quick Setup / Copyable Install Box */}
      <div className="border border-neutral-800 bg-neutral-950 p-6 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-neutral-400">
            <Terminal className="w-4 h-4 text-neutral-400" />
            <span>MCP CLIENT CONFIGURATION</span>
          </div>
          <button
            onClick={() => copyToClipboard(jsonConfig, setCopiedJson)}
            className="flex items-center space-x-1 text-xs border border-neutral-800 px-3 py-1 rounded hover:bg-neutral-900 transition text-neutral-300"
          >
            {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedJson ? "Copied" : "Copy JSON"}</span>
          </button>
        </div>

        <pre className="text-xs bg-black p-4 rounded border border-neutral-900 overflow-x-auto text-neutral-300">
          <code>{jsonConfig}</code>
        </pre>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-neutral-900">
          <div className="text-xs text-neutral-500">
            Add to <code className="text-neutral-300">claude_desktop_config.json</code> or your agent configuration.
          </div>
          <Link
            href="/docs"
            className="text-xs underline text-neutral-400 hover:text-white transition"
          >
            View Complete Setup Guide →
          </Link>
        </div>
      </div>

      {/* Tri-File Core Architecture */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-white tracking-wide border-b border-neutral-900 pb-2">
          THE TRI-FILE PERSISTENT MEMORY MODEL
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-neutral-900 p-5 rounded space-y-3 bg-neutral-950/40">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <Cpu className="w-4 h-4 text-neutral-400" />
              <span>1. StoneWay.md</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Raw, unstructured scratchpad memory. Both you and your AI agents deposit commit
              logs, prompt ideas, tech stacks, and quick scratch notes here.
            </p>
          </div>

          <div className="border border-neutral-900 p-5 rounded space-y-3 bg-neutral-950/40">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <RefreshCw className="w-4 h-4 text-neutral-400" />
              <span>2. StoneWay.json</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Structured builder matrix schema-validated by Zod. Agents read this first to
              understand your identity, projects, public links, and preferences.
            </p>
          </div>

          <div className="border border-neutral-900 p-5 rounded space-y-3 bg-neutral-950/40">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <Shield className="w-4 h-4 text-neutral-400" />
              <span>3. StoneWayConfig</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              AES-256-GCM encrypted envelope. Securely stores your API token and optional external
              connectors (GitHub PAT, Notion). Zero plaintext exposure.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Bullet Points */}
      <div className="border border-neutral-900 p-6 rounded space-y-4">
        <h3 className="text-sm font-bold text-white">KEY CAPABILITIES</h3>
        <ul className="text-xs text-neutral-400 space-y-2.5 list-disc pl-4">
          <li>
            <strong className="text-neutral-200">Zero-Data-Loss Invariant:</strong> Unparseable or off-schema fields from agents are automatically preserved into an overflow metadata array.
          </li>
          <li>
            <strong className="text-neutral-200">Instant Bio Generation:</strong> Tool <code className="text-neutral-300">get_bio</code> generates platform-tailored bios (GitHub, X, LinkedIn, Devpost) filtered strictly to public fields.
          </li>
          <li>
            <strong className="text-neutral-200">One Token for All Agents:</strong> A single revocable <code className="text-neutral-300">sw_...</code> bearer token shared across all your local IDEs and CLI agents.
          </li>
          <li>
            <strong className="text-neutral-200">Prompt Injection Safety Envelope:</strong> Context responses are wrapped in immutable boundaries to protect calling LLMs from untrusted memory execution.
          </li>
          <li>
            <strong className="text-neutral-200">Co-located Latency:</strong> Pinned to Washington D.C. (<code className="text-neutral-300">iad1</code>) right alongside Neon Serverless PostgreSQL for sub-25ms API response times.
          </li>
        </ul>
      </div>

      {/* Call to action */}
      <div className="flex flex-wrap items-center gap-4 pt-4">
        <Link
          href="/login"
          className="bg-white text-black text-xs font-bold px-6 py-2.5 rounded hover:bg-neutral-200 transition"
        >
          Get Started with GitHub →
        </Link>
        <Link
          href="/docs"
          className="border border-neutral-800 text-xs px-6 py-2.5 rounded hover:border-neutral-600 transition text-neutral-300"
        >
          Read the Documentation
        </Link>
      </div>
    </div>
  );
}
