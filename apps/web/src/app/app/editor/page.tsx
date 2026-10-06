"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Save, Download, Trash2, Check, FileText, Code2, AlertOctagon } from "lucide-react";

export default function ProfileEditorPage() {
  const [activeTab, setActiveTab] = useState<"md" | "json">("md");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [mdContent, setMdContent] = useState("");
  const [jsonContent, setJsonContent] = useState<any>({});
  const [version, setVersion] = useState(1);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setMdContent(data.stoneway_md || "");
        setJsonContent(data.stoneway_json || {});
        setVersion(data.version || 1);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveMd = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stoneway_md: mdContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setVersion(data.version);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = (type: "md" | "json") => {
    const filename = type === "md" ? "StoneWay.md" : "StoneWay.json";
    const text = type === "md" ? mdContent : JSON.stringify(jsonContent, null, 2);
    const blob = new Blob([text], { type: type === "md" ? "text/markdown" : "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWipe = async () => {
    if (
      !confirm(
        "CRITICAL: Are you sure you want to completely wipe and reset your StoneWay profile? This will restore the starter template. (A snapshot backup will be kept for 30 days)."
      )
    ) {
      return;
    }
    const doubleConfirm = prompt("Type 'WIPE' to confirm permanent profile reset:");
    if (doubleConfirm !== "WIPE") {
      alert("Wipe action cancelled.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", { method: "DELETE" });
      if (res.ok) {
        await fetchProfile();
        alert("Profile reset to default starter template.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-xs text-neutral-500 py-12 text-center">Loading editor...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex items-center justify-between border-b border-neutral-900 pb-3 text-xs">
        <div className="flex items-center space-x-6">
          <span className="font-bold text-white border-b-2 border-white pb-3 -mb-3.5">
            editor (/app/editor)
          </span>
          <Link href="/app/key" className="text-neutral-500 hover:text-white transition">
            api key hub (/app/key)
          </Link>
        </div>
        <div className="text-neutral-500 text-[11px]">
          Profile Version: <span className="text-white font-mono">v{version}</span>
        </div>
      </div>

      {/* Editor Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-950 p-4 border border-neutral-800 rounded-lg">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab("md")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              activeTab === "md"
                ? "bg-white text-black font-bold"
                : "text-neutral-400 hover:text-white border border-neutral-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>StoneWay.md (Editable)</span>
          </button>

          <button
            onClick={() => setActiveTab("json")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              activeTab === "json"
                ? "bg-white text-black font-bold"
                : "text-neutral-400 hover:text-white border border-neutral-800"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>StoneWay.json (Agent Source)</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === "md" && (
            <button
              onClick={handleSaveMd}
              disabled={saving}
              className="flex items-center space-x-1.5 bg-neutral-100 text-black text-xs font-bold px-3 py-1.5 rounded hover:bg-white transition disabled:opacity-50"
            >
              {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savedSuccess ? "Saved!" : saving ? "Saving..." : "Save .md"}</span>
            </button>
          )}

          <button
            onClick={() => handleDownload(activeTab)}
            className="flex items-center space-x-1 text-xs border border-neutral-800 px-3 py-1.5 rounded hover:bg-neutral-900 transition text-neutral-300"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          <button
            onClick={handleWipe}
            className="flex items-center space-x-1 text-xs text-red-400 hover:text-red-300 border border-red-950/60 px-3 py-1.5 rounded hover:bg-red-950/20 transition"
            title="Reset profile to blank slate"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Wipe</span>
          </button>
        </div>
      </div>

      {/* Main Code Editor Pane */}
      <div className="border border-neutral-800 rounded-lg overflow-hidden bg-black">
        {activeTab === "md" ? (
          <textarea
            value={mdContent}
            onChange={(e) => setMdContent(e.target.value)}
            className="w-full h-[600px] bg-black text-neutral-200 font-mono text-xs p-4 resize-none outline-none focus:ring-1 focus:ring-neutral-700 leading-relaxed"
            placeholder="Write your raw markdown notes, thoughts, and instructions here..."
            spellCheck={false}
          />
        ) : (
          <div className="h-[600px] overflow-y-auto p-4 text-xs font-mono text-neutral-300 bg-black">
            <pre className="select-all">
              <code>{JSON.stringify(jsonContent, null, 2)}</code>
            </pre>
          </div>
        )}
      </div>

      <div className="text-[11px] text-neutral-500 flex items-center justify-between">
        <span>Tip: Connected AI agents read StoneWay.json as primary semantic context and append logs to StoneWay.md.</span>
        <span>Character count: {mdContent.length}</span>
      </div>
    </div>
  );
}
