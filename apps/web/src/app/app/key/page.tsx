"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Key, Copy, Check, Eye, EyeOff, RefreshCw, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function KeyHubPage() {
  const [loading, setLoading] = useState(true);
  const [keyInfo, setKeyInfo] = useState<any>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchKeyInfo = async (reveal = false) => {
    try {
      const res = await fetch(`/api/user/key${reveal ? "?reveal=true" : ""}`);
      if (res.ok) {
        const data = await res.json();
        setKeyInfo(data);
        if (reveal && data.token) {
          setRevealedToken(data.token);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeyInfo(false);
  }, []);

  const handleReveal = () => {
    if (revealedToken) {
      setRevealedToken(null);
    } else {
      fetchKeyInfo(true);
    }
  };

  const handleRegenerate = async () => {
    if (
      !confirm(
        "WARNING: Regenerating your key will immediately invalidate the active token across all connected AI agents (Claude Desktop, Cursor, etc.). Do you want to proceed?"
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/user/key", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRevealedToken(data.token);
        fetchKeyInfo(false);
        alert("New key generated! Remember to update your MCP client configuration.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("Are you sure you want to revoke your API key? All agents will immediately lose access.")) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/user/key", { method: "DELETE" });
      if (res.ok) {
        setRevealedToken(null);
        fetchKeyInfo(false);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const copyToken = () => {
    if (!revealedToken) return;
    navigator.clipboard.writeText(revealedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="text-xs text-neutral-500 py-12 text-center">Loading key status...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Navigation tabs */}
      <div className="flex items-center space-x-6 border-b border-neutral-900 pb-3 text-xs">
        <Link href="/app/editor" className="text-neutral-500 hover:text-white transition">
          editor (/app/editor)
        </Link>
        <Link href="/app/prompts" className="text-neutral-500 hover:text-white transition">
          prompts (/app/prompts)
        </Link>
        <span className="font-bold text-white border-b-2 border-white pb-3 -mb-3.5">
          api key hub (/app/key)
        </span>
        <Link href="/app/connectors" className="text-neutral-500 hover:text-white transition">
          connectors (/app/connectors)
        </Link>
        <Link href="/app/activity" className="text-neutral-500 hover:text-white transition">
          activity (/app/activity)
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-white tracking-wide flex items-center space-x-2">
          <Key className="w-5 h-5 text-neutral-400" />
          <span>UNIFIED AGENT ACCESS TOKEN</span>
        </h1>
        <p className="text-xs text-neutral-400">
          One single bearer key powers all of your local and cloud AI agents. Keep it secret.
        </p>
      </div>

      {/* Key Card */}
      <div className="border border-neutral-800 bg-neutral-950 p-6 rounded-lg space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Status: {keyInfo?.has_active_key ? "ACTIVE" : "NO ACTIVE KEY"}</span>
            </div>
            <div className="text-[11px] text-neutral-500">
              Created: {keyInfo?.created_at ? new Date(keyInfo.created_at).toLocaleDateString() : "N/A"}
              {keyInfo?.last_used_at && ` • Last used: ${new Date(keyInfo.last_used_at).toLocaleDateString()}`}
            </div>
          </div>
        </div>

        {/* Token Reveal Box */}
        <div className="space-y-2">
          <label className="text-[11px] text-neutral-400 uppercase tracking-wider">Bearer Token</label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-black border border-neutral-900 rounded px-3 py-2 text-xs font-mono text-neutral-300 overflow-x-auto select-all">
              {revealedToken ? revealedToken : "sw_••••••••••••••••••••••••••••••••••••••••••••"}
            </div>
            <button
              onClick={handleReveal}
              className="border border-neutral-800 px-3 py-2 rounded text-xs hover:border-neutral-600 transition flex items-center space-x-1"
              title={revealedToken ? "Hide key" : "Reveal key"}
            >
              {revealedToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            {revealedToken && (
              <button
                onClick={copyToken}
                className="bg-white text-black px-3 py-2 rounded text-xs font-bold hover:bg-neutral-200 transition flex items-center space-x-1"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-neutral-900">
          <button
            onClick={handleRegenerate}
            disabled={actionLoading}
            className="flex items-center space-x-1.5 text-xs border border-neutral-800 px-4 py-2 rounded hover:bg-neutral-900 transition disabled:opacity-50 text-neutral-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Regenerate Key</span>
          </button>

          {keyInfo?.has_active_key && (
            <button
              onClick={handleRevoke}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 text-xs text-red-400 hover:text-red-300 border border-red-950/60 px-4 py-2 rounded hover:bg-red-950/20 transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Revoke Key</span>
            </button>
          )}
        </div>
      </div>

      {/* Security Warning Notice */}
      <div className="border border-amber-950/40 bg-amber-950/10 p-4 rounded text-xs text-amber-300/80 space-y-1">
        <div className="flex items-center space-x-2 font-bold text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Security Reminder</span>
        </div>
        <p className="leading-relaxed">
          Never commit your <code className="text-amber-200">STONEWAY_TOKEN</code> to public GitHub repos or chat logs.
          If your token is leaked, click <strong>Regenerate Key</strong> immediately to cut off unauthorized access.
        </p>
      </div>
    </div>
  );
}
