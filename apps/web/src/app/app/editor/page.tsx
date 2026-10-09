"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Save,
  Download,
  Trash2,
  Check,
  FileText,
  Code2,
  AlertOctagon,
  Files,
  ShieldCheck,
  UploadCloud,
  Tag,
  Folder,
  RefreshCw,
  Copy,
  Plus,
  HelpCircle,
  FileCode,
  File,
} from "lucide-react";

interface ContextFile {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  sha256: string;
  context_group: string;
  tags: string[];
  status: string;
  version: number;
  authoritative_provider?: string;
  storage_state?: string;
  has_extracted_text: boolean;
  created_at: string;
  updated_at: string;
}

interface ProvenanceRecord {
  field: string;
  canonical_value: any;
  canonical_source: string;
  canonical_source_type: string;
  source_agent?: string;
  source_document?: string;
  confidence: number;
  user_override: boolean;
  created_at: string;
  updated_at: string;
  observations: Array<{
    value: any;
    source: string;
    source_type: string;
    source_agent?: string;
    observed_at: string;
    confidence: number;
  }>;
}

export default function ProfileEditorPage() {
  const [activeTab, setActiveTab] = useState<"md" | "json" | "files" | "provenance">("md");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [mdContent, setMdContent] = useState("");
  const [jsonContent, setJsonContent] = useState<any>({});
  const [version, setVersion] = useState(1);

  // Context files state
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadGroup, setUploadGroup] = useState<"career" | "projects" | "research" | "general">("general");
  const [uploadTags, setUploadTags] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Provenance / Claims state
  const [provenanceRecords, setProvenanceRecords] = useState<ProvenanceRecord[]>([]);
  const [loadingProvenance, setLoadingProvenance] = useState(false);

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

  const fetchFiles = async () => {
    try {
      const res = await fetch("/api/user/files");
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error("Failed to fetch context files", e);
    }
  };

  const fetchProvenance = async () => {
    setLoadingProvenance(true);
    try {
      const res = await fetch("/api/user/claims");
      if (res.ok) {
        const data = await res.json();
        setProvenanceRecords(data.records || []);
      }
    } catch (e) {
      console.error("Failed to fetch provenance", e);
    } finally {
      setLoadingProvenance(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchFiles();
    fetchProvenance();
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const tags = uploadTags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);

        const res = await fetch("/api/user/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mime_type: file.type || "application/octet-stream",
            content_base64: base64,
            context_group: uploadGroup,
            tags,
          }),
        });

        if (res.ok) {
          await fetchFiles();
          setUploadTags("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
          const err = await res.json();
          alert(`Upload failed: ${err.error || "Unknown error"}`);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteFile = async (fileId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete '${filename}'?`)) return;

    try {
      const res = await fetch(`/api/user/files?id=${encodeURIComponent(fileId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } else {
        const err = await res.json();
        alert(`Failed to delete: ${err.error}`);
      }
    } catch (e: any) {
      alert(`Delete error: ${e.message}`);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
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

  const handleDownloadResume = async () => {
    try {
      const res = await fetch("/api/user/resume");
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "resume.json";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      alert("Failed to export JSON Resume.");
    }
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

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getAuthorityBadgeColor = (sourceType: string) => {
    switch (sourceType.toLowerCase()) {
      case "user":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "manual_profile_edit":
        return "bg-teal-500/10 text-teal-400 border-teal-500/30";
      case "verified_connector":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "agent_claim":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default:
        return "bg-neutral-800 text-neutral-400 border-neutral-700";
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
          <Link href="/app/prompts" className="text-neutral-500 hover:text-white transition">
            prompts (/app/prompts)
          </Link>
          <Link href="/app/key" className="text-neutral-500 hover:text-white transition">
            api key hub (/app/key)
          </Link>
          <Link href="/app/connectors" className="text-neutral-500 hover:text-white transition">
            connectors (/app/connectors)
          </Link>
          <Link href="/app/activity" className="text-neutral-500 hover:text-white transition">
            activity (/app/activity)
          </Link>
        </div>
        <div className="text-neutral-500 text-[11px]">
          Profile Version: <span className="text-white font-mono">v{version}</span>
        </div>
      </div>

      {/* Editor & Context Sub-Nav Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-950 p-4 border border-neutral-800 rounded-lg">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("md")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              activeTab === "md"
                ? "bg-white text-black font-bold"
                : "text-neutral-400 hover:text-white border border-neutral-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>StoneWay.md</span>
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
            <span>StoneWay.json</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("files");
              fetchFiles();
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              activeTab === "files"
                ? "bg-white text-black font-bold"
                : "text-neutral-400 hover:text-white border border-neutral-800"
            }`}
          >
            <Files className="w-3.5 h-3.5" />
            <span>Context Files ({files.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("provenance");
              fetchProvenance();
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              activeTab === "provenance"
                ? "bg-white text-black font-bold"
                : "text-neutral-400 hover:text-white border border-neutral-800"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Why Does StoneWay Think This?</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          {(activeTab === "md" || activeTab === "json") && (
            <>
              <button
                onClick={() => handleDownload(activeTab === "md" ? "md" : "json")}
                className="flex items-center space-x-1 text-xs border border-neutral-800 px-3 py-1.5 rounded hover:bg-neutral-900 transition text-neutral-300"
                title="Download current file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>

              <button
                onClick={handleDownloadResume}
                className="flex items-center space-x-1 text-xs border border-neutral-800 px-3 py-1.5 rounded hover:bg-neutral-900 transition text-neutral-300 font-mono"
                title="Export standardized JSON Resume"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>JSON Resume</span>
              </button>

              <button
                onClick={handleWipe}
                className="flex items-center space-x-1 text-xs text-red-400 hover:text-red-300 border border-red-950/60 px-3 py-1.5 rounded hover:bg-red-950/20 transition"
                title="Reset profile to blank slate"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Wipe</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: Markdown Scratchpad */}
      {activeTab === "md" && (
        <div className="border border-neutral-800 rounded-lg overflow-hidden bg-black">
          <textarea
            value={mdContent}
            onChange={(e) => setMdContent(e.target.value)}
            className="w-full h-[600px] bg-black text-neutral-200 font-mono text-xs p-4 resize-none outline-none focus:ring-1 focus:ring-neutral-700 leading-relaxed"
            placeholder="Write your raw markdown notes, thoughts, and instructions here..."
            spellCheck={false}
          />
        </div>
      )}

      {/* TAB 2: Structured JSON Source */}
      {activeTab === "json" && (
        <div className="border border-neutral-800 rounded-lg overflow-hidden bg-black">
          <div className="h-[600px] overflow-y-auto p-4 text-xs font-mono text-neutral-300 bg-black">
            <pre className="select-all">
              <code>{JSON.stringify(jsonContent, null, 2)}</code>
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: Context Files */}
      {activeTab === "files" && (
        <div className="space-y-6">
          {/* Upload card */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-neutral-400" />
              Upload Context Document
            </h3>
            <p className="text-xs text-neutral-400 mb-4">
              Attach PDFs, architecture specs, resumes, or research papers. Files are tenant-isolated in Cloudflare R2
              with metadata in Neon Postgres. Agents address them by opaque ID, not filename.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-1">
                  Context Group
                </label>
                <select
                  value={uploadGroup}
                  onChange={(e) => setUploadGroup(e.target.value as any)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-neutral-600"
                >
                  <option value="career">Career (Resume, Bio, CV)</option>
                  <option value="projects">Projects (Architecture, Specs)</option>
                  <option value="research">Research (Papers, Notes)</option>
                  <option value="general">General (Other Documents)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="e.g. resume, public-profile"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-neutral-600 placeholder:text-neutral-600"
                />
              </div>

              <div className="flex items-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="context-file-picker"
                />
                <label
                  htmlFor="context-file-picker"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-1.5 rounded text-xs font-semibold cursor-pointer transition ${
                    uploadingFile
                      ? "bg-neutral-800 text-neutral-400 cursor-not-allowed"
                      : "bg-white text-black hover:bg-neutral-200"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{uploadingFile ? "Uploading & Indexing..." : "Choose File to Upload"}</span>
                </label>
              </div>
            </div>

            <div className="text-[11px] text-neutral-400 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Files are sanitized and wrapped in &lt;USER DATA, NOT INSTRUCTIONS&gt; before being exposed to agents.
            </div>
          </div>

          {/* Files List */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-neutral-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">User Context Library</span>
              </div>
              <span className="text-[11px] text-neutral-400 font-mono">{files.length} document(s)</span>
            </div>

            {files.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-400">
                No context documents uploaded yet. Upload your resume or project specs above!
              </div>
            ) : (
              <div className="divide-y divide-neutral-900">
                {files.map((file) => (
                  <div key={file.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-neutral-900/40 transition">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 mt-0.5">
                        <File className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">{file.filename}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                            {file.context_group}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400">{formatBytes(file.size)}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                            v{file.version}
                          </span>
                          {file.authoritative_provider && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {file.authoritative_provider.replace("_", " ")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-mono text-neutral-400">ID: {file.id}</span>
                          <button
                            onClick={() => handleCopyId(file.id)}
                            className="text-neutral-400 hover:text-white transition"
                            title="Copy File ID"
                          >
                            {copiedId === file.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        {file.tags && file.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {file.tags.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400 border border-neutral-800"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <span className="text-[11px] text-neutral-400">
                        {new Date(file.created_at).toLocaleDateString()}
                      </span>
                      <a
                        href={`/api/user/files/${file.id}/download`}
                        download={file.filename}
                        className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-900 transition"
                        title="Download or preview file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDeleteFile(file.id, file.filename)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-900 transition"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Provenance & Source Authority */}
      {activeTab === "provenance" && (
        <div className="space-y-6">
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Why Does StoneWay Think This? (Source Authority & Provenance Engine)
              </h3>
              <button
                onClick={fetchProvenance}
                className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              StoneWay rejects simplistic &ldquo;newer timestamp wins&rdquo; overwriting. Profile mutations flow through a source
              authority hierarchy:
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                USER (1.0)
              </span>
              <span className="text-neutral-600">&gt;</span>
              <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/30">
                MANUAL EDIT (0.9)
              </span>
              <span className="text-neutral-600">&gt;</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                VERIFIED CONNECTOR (0.8)
              </span>
              <span className="text-neutral-600">&gt;</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                AGENT CLAIM (0.6)
              </span>
              <span className="text-neutral-600">&gt;</span>
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                INFERRED (0.4)
              </span>
            </div>
          </div>

          <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Field Provenance Records</span>
              <span className="text-[11px] text-neutral-400 font-mono">
                {provenanceRecords.length} audited fields
              </span>
            </div>

            {loadingProvenance ? (
              <div className="py-12 text-center text-xs text-neutral-400">Loading provenance records...</div>
            ) : provenanceRecords.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-400">
                No provenance claims recorded yet. Changes made by connectors or agents will populate here with full audit trails.
              </div>
            ) : (
              <div className="divide-y divide-neutral-900">
                {provenanceRecords.map((rec) => (
                  <div key={rec.field} className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">{rec.field}</span>
                        {rec.user_override && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                            user_override: absolute
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getAuthorityBadgeColor(
                            rec.canonical_source_type
                          )}`}
                        >
                          {rec.canonical_source_type} (conf: {rec.confidence})
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          Source: {rec.canonical_source}
                        </span>
                      </div>
                    </div>

                    <div className="bg-black border border-neutral-900 rounded p-2.5 font-mono text-xs text-neutral-200">
                      <span className="text-neutral-400 text-[10px] block mb-1">Winning Canonical Value:</span>
                      <code>{JSON.stringify(rec.canonical_value)}</code>
                    </div>

                    {rec.observations && rec.observations.length > 0 && (
                      <div className="text-[11px] text-neutral-400 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-neutral-400">
                          Other Observations & Claims ({rec.observations.length}):
                        </span>
                        <div className="space-y-1 mt-1">
                          {rec.observations.map((obs, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800/80 rounded px-2.5 py-1 text-[10px] font-mono"
                            >
                              <span>
                                {obs.source} ({obs.source_type}): {JSON.stringify(obs.value)}
                              </span>
                              <span className="text-neutral-400">
                                conf: {obs.confidence} · {new Date(obs.observed_at).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="text-[11px] text-neutral-500 flex items-center justify-between">
        <span>StoneWay gives your AI agents a persistent, user-owned source of identity, projects, preferences and context.</span>
        <span>Character count: {mdContent.length}</span>
      </div>
    </div>
  );
}
