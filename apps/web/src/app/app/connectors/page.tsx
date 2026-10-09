"use client";

import { useState } from "react";
import Link from "next/link";
import {
  GitBranch,
  Package,
  Sparkles,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface ConnectorManifestUI {
  id: string;
  name: string;
  description: string;
  category: string;
  reads: string[];
  requiredScopes: string[];
  writes: string[];
  authType: string;
  status: "connected" | "available" | "coming_soon";
}

const CONNECTORS: ConnectorManifestUI[] = [
  {
    id: "github",
    name: "GitHub Public Repositories",
    description: "Extracts recently updated repositories, descriptions, primary programming languages, and demo links.",
    category: "Version Control",
    reads: [
      "Public repositories & topics",
      "Repository markdown descriptions",
      "Language usage statistics",
      "Live homepage & deployment URLs",
    ],
    requiredScopes: ["None (for public repositories)", "repo:read (optional for private)"],
    writes: [
      "active_projects (name, description, repo_url, live_url, tech_stack)",
      "technical_profile.primary_languages",
    ],
    authType: "Optional Personal Access Token",
    status: "connected",
  },
  {
    id: "npm",
    name: "npm Package Registry",
    description: "Synchronizes published libraries, package versions, and keywords into your technical profile.",
    category: "Package Registry",
    reads: ["Published packages by maintainer", "README descriptions & keywords", "Latest version tags"],
    requiredScopes: ["None (Public npm registry API)"],
    writes: [
      "past_projects / active_projects",
      "technical_profile.tools",
    ],
    authType: "npm Username",
    status: "available",
  },
  {
    id: "huggingface",
    name: "Hugging Face Hub",
    description: "Syncs public AI models, datasets, and Spaces into your developer identity.",
    category: "AI & ML",
    reads: ["Public models and datasets", "Model tags & pipeline architectures", "Hugging Face Spaces"],
    requiredScopes: ["read (Hugging Face User Access Token)"],
    writes: [
      "active_projects (AI models & spaces)",
      "technical_profile.tools",
    ],
    authType: "Hugging Face Token",
    status: "available",
  },
  {
    id: "notion",
    name: "Notion Project Tracker",
    description: "Syncs planned project ideas, roadmaps, and frequent prompts directly from a Notion database.",
    category: "Notes & Docs",
    reads: ["Specified database pages", "Project statuses and tags", "Prompt scratchpad blocks"],
    requiredScopes: ["Read content (Notion Integration Secret)"],
    writes: [
      "planned_ideas (title, summary, priority, tags)",
      "frequent_prompts",
    ],
    authType: "Notion Integration Token",
    status: "coming_soon",
  },
];

export default function ConnectorsPage() {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ id: string; success: boolean; msg: string } | null>(null);

  const handleTriggerSync = async (connectorId: string) => {
    setSyncingId(connectorId);
    setSyncFeedback(null);
    try {
      const res = await fetch("/api/v1/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration: connectorId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncFeedback({
          id: connectorId,
          success: true,
          msg: data.result?.message || `Successfully synchronized ${connectorId}!`,
        });
      } else {
        setSyncFeedback({
          id: connectorId,
          success: false,
          msg: data.error || data.result?.message || "Sync encountered an error.",
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        id: connectorId,
        success: false,
        msg: err.message || "Failed to trigger sync.",
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex items-center justify-between border-b border-neutral-900 pb-3 text-xs">
        <div className="flex items-center space-x-6">
          <Link href="/app/editor" className="text-neutral-500 hover:text-white transition">
            editor (/app/editor)
          </Link>
          <Link href="/app/prompts" className="text-neutral-500 hover:text-white transition">
            prompts (/app/prompts)
          </Link>
          <Link href="/app/key" className="text-neutral-500 hover:text-white transition">
            api key hub (/app/key)
          </Link>
          <span className="font-bold text-white border-b-2 border-white pb-3 -mb-3.5">
            connectors (/app/connectors)
          </span>
          <Link href="/app/activity" className="text-neutral-500 hover:text-white transition">
            activity (/app/activity)
          </Link>
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-neutral-950 p-5 border border-neutral-900 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Permission Manifests & Zero Data Loss
          </h2>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Every StoneWay connector explicitly declares what data it reads, the required permissions, and exactly
          which profile fields it writes. All sync actions are logged to your append-only audit trail with field
          source attribution, ensuring existing data is never wiped or overwritten.
        </p>
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONNECTORS.map((connector) => (
          <div
            key={connector.id}
            className="bg-neutral-950 border border-neutral-900 hover:border-neutral-800 transition rounded-lg p-5 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{connector.name}</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-mono">
                    {connector.category}
                  </span>
                </div>

                <span
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                    connector.status === "connected"
                      ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                      : connector.status === "available"
                      ? "bg-blue-950/60 border-blue-800 text-blue-300"
                      : "bg-neutral-900 border-neutral-800 text-neutral-500"
                  }`}
                >
                  {connector.status.replace("_", " ")}
                </span>
              </div>

              <p className="text-xs text-neutral-400">{connector.description}</p>

              {/* Manifest Specs */}
              <div className="space-y-2 pt-2 border-t border-neutral-900 text-xs">
                <div>
                  <span className="text-neutral-500 text-[11px] font-semibold uppercase block">
                    Reads:
                  </span>
                  <ul className="list-disc pl-4 text-neutral-400 text-[11px] space-y-0.5">
                    {connector.reads.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span className="text-neutral-500 text-[11px] font-semibold uppercase block">
                    Writes to StoneWay.json:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {connector.writes.map((w, i) => (
                      <code
                        key={i}
                        className="text-[10px] bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded text-neutral-300 font-mono"
                      >
                        {w}
                      </code>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-neutral-500 text-[11px] font-semibold uppercase block">
                    Auth Scope:
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {connector.requiredScopes.join(", ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-neutral-900 flex items-center justify-between">
              {connector.status === "connected" ? (
                <button
                  onClick={() => handleTriggerSync(connector.id)}
                  disabled={syncingId === connector.id}
                  className="flex items-center gap-1.5 bg-white text-black font-semibold text-xs px-3 py-1.5 rounded hover:bg-neutral-200 transition disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncingId === connector.id ? "animate-spin" : ""}`}
                  />
                  <span>{syncingId === connector.id ? "Syncing..." : "Sync Now"}</span>
                </button>
              ) : connector.status === "available" ? (
                <button
                  onClick={() => handleTriggerSync(connector.id)}
                  disabled={syncingId === connector.id}
                  className="flex items-center gap-1.5 border border-neutral-700 text-neutral-300 font-semibold text-xs px-3 py-1.5 rounded hover:bg-neutral-900 transition disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncingId === connector.id ? "animate-spin" : ""}`}
                  />
                  <span>Run Test Sync</span>
                </button>
              ) : (
                <span className="text-[11px] text-neutral-600 font-mono italic">
                  Connector in review
                </span>
              )}

              {syncFeedback?.id === connector.id && (
                <div
                  className={`text-[11px] flex items-center gap-1 font-medium ${
                    syncFeedback.success ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {syncFeedback.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{syncFeedback.msg}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
