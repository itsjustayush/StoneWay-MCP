"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Save,
  Download,
  Upload,
  Check,
  Code2,
  FileText,
  Plus,
  Trash2,
  Play,
  HelpCircle,
  Copy,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { PromptItem, PromptLibrary } from "@stoneway/shared";

export default function PromptsManagerPage() {
  const [library, setLibrary] = useState<PromptLibrary>({
    schema_version: 1,
    prompts: [],
  });
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"builder" | "json" | "markdown">("builder");
  const [rawJson, setRawJson] = useState("");
  const [markdownInput, setMarkdownInput] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [testArgs, setTestArgs] = useState<Record<string, string>>({});
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testProfile, setTestProfile] = useState<any>({});
  const [copied, setCopied] = useState(false);

  const fetchLibrary = async () => {
    try {
      const res = await fetch("/api/user/prompts");
      if (res.ok) {
        const data = await res.json();
        const lib = data.library || { schema_version: 1, prompts: [] };
        setLibrary(lib);
        setRawJson(JSON.stringify(lib, null, 2));
        setVersion(data.version || 0);
        if (lib.prompts.length > 0) {
          setSelectedPrompt(lib.prompts[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setTestProfile(data.stoneway_json || {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLibrary();
    fetchProfile();
  }, []);

  const handleSaveJson = async (libToSave: PromptLibrary) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ library: libToSave }),
      });
      if (res.ok) {
        const data = await res.json();
        setLibrary(data.library);
        setRawJson(JSON.stringify(data.library, null, 2));
        setVersion(data.version);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      } else {
        const err = await res.json();
        alert(`Failed to save: ${err.error || "Validation error"}`);
      }
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleImportMarkdown = async () => {
    if (!markdownInput.trim()) {
      alert("Please paste PROMPTS.md content first.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: markdownInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setLibrary(data.library);
        setRawJson(JSON.stringify(data.library, null, 2));
        setVersion(data.version);
        setActiveTab("builder");
        if (data.library.prompts.length > 0) {
          setSelectedPrompt(data.library.prompts[0]);
        }
        alert("PROMPTS.md imported and converted successfully!");
      } else {
        const err = await res.json();
        alert(`Import failed: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPrompt = (type: "prompt" | "skill") => {
    const newName = `custom_${type}_${Date.now().toString().slice(-4)}`;
    const newItem: PromptItem = {
      name: newName,
      type,
      title: type === "prompt" ? "New Custom Prompt" : "New Skill Standard",
      description: type === "prompt" ? "Describe how agents should run this" : "Guidelines for coding style or conventions",
      template:
        type === "prompt"
          ? "Please perform {{task}} using my preferred stack: {{profile.technical_profile.primary_framework}}."
          : "Always adhere to my engineering standards:\n1. Strict types\n2. Modular components\n3. Responsive layout.",
      arguments:
        type === "prompt"
          ? [{ name: "task", description: "What needs to be accomplished", required: true }]
          : [],
      tags: [type],
    };

    const updated = {
      ...library,
      prompts: [...library.prompts, newItem],
    };
    setLibrary(updated);
    setRawJson(JSON.stringify(updated, null, 2));
    setSelectedPrompt(newItem);
  };

  const handleDeletePrompt = (name: string) => {
    const updated = {
      ...library,
      prompts: library.prompts.filter((p) => p.name !== name),
    };
    setLibrary(updated);
    setRawJson(JSON.stringify(updated, null, 2));
    if (selectedPrompt?.name === name) {
      setSelectedPrompt(updated.prompts[0] || null);
    }
  };

  const handleTestRender = () => {
    if (!selectedPrompt) return;
    let rendered = selectedPrompt.template;

    // Substitute arguments
    for (const [k, v] of Object.entries(testArgs)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
    }

    // Substitute profile paths
    rendered = rendered.replace(/\{\{profile\.([a-zA-Z0-9_\.]+)\}\}/g, (_match, path) => {
      const parts = path.split(".");
      let curr = testProfile;
      for (const p of parts) {
        curr = curr?.[p];
      }
      return typeof curr === "string" ? curr : JSON.stringify(curr) || "";
    });

    setTestOutput(rendered);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "PROMPTS.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="text-xs text-neutral-500 py-12 text-center">Loading prompt library...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex items-center justify-between border-b border-neutral-900 pb-3 text-xs">
        <div className="flex items-center space-x-6">
          <Link href="/app/editor" className="text-neutral-500 hover:text-white transition">
            editor (/app/editor)
          </Link>
          <span className="font-bold text-white border-b-2 border-white pb-3 -mb-3.5">
            prompts (/app/prompts)
          </span>
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
          Library Version: <span className="text-white font-mono">v{version}</span>
        </div>
      </div>

      {/* Header controls bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-950 p-4 border border-neutral-800 rounded-lg">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("builder")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              activeTab === "builder"
                ? "bg-white text-black font-bold"
                : "text-neutral-400 hover:text-white border border-neutral-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Builder</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("json");
              setRawJson(JSON.stringify(library, null, 2));
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              activeTab === "json"
                ? "bg-white text-black font-bold"
                : "text-neutral-400 hover:text-white border border-neutral-800"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>PROMPTS.json Raw</span>
          </button>

          <button
            onClick={() => setActiveTab("markdown")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition ${
              activeTab === "markdown"
                ? "bg-white text-black font-bold"
                : "text-neutral-400 hover:text-white border border-neutral-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Import PROMPTS.md</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "builder" && (
            <>
              <button
                onClick={() => handleAddPrompt("prompt")}
                className="flex items-center space-x-1 text-xs border border-neutral-800 px-3 py-1.5 rounded hover:bg-neutral-900 transition text-neutral-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Prompt</span>
              </button>
              <button
                onClick={() => handleAddPrompt("skill")}
                className="flex items-center space-x-1 text-xs border border-neutral-800 px-3 py-1.5 rounded hover:bg-neutral-900 transition text-neutral-300"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Add Skill</span>
              </button>
            </>
          )}

          <button
            onClick={() => {
              if (activeTab === "json") {
                try {
                  const parsed = JSON.parse(rawJson);
                  handleSaveJson(parsed);
                } catch {
                  alert("Invalid JSON format");
                }
              } else {
                handleSaveJson(library);
              }
            }}
            disabled={saving}
            className="flex items-center space-x-1.5 bg-neutral-100 text-black text-xs font-bold px-3 py-1.5 rounded hover:bg-white transition disabled:opacity-50"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedSuccess ? "Saved!" : saving ? "Saving..." : "Save Library"}</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="flex items-center space-x-1 text-xs border border-neutral-800 px-3 py-1.5 rounded hover:bg-neutral-900 transition text-neutral-300"
            title="Download PROMPTS.json"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Visual Interactive Builder */}
      {activeTab === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Prompt & Skill List */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-neutral-800 text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Saved Prompts & Skills</span>
              <span className="text-[10px] text-neutral-500 font-mono">{library.prompts.length} total</span>
            </div>

            {library.prompts.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                No prompts or skills defined yet. Click &ldquo;Add Prompt&rdquo; or import a PROMPTS.md file.
              </div>
            ) : (
              <div className="divide-y divide-neutral-900 max-h-[600px] overflow-y-auto">
                {library.prompts.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setSelectedPrompt(p);
                      setTestArgs({});
                      setTestOutput(null);
                    }}
                    className={`w-full text-left p-3 transition flex items-start justify-between gap-2 ${
                      selectedPrompt?.name === p.name ? "bg-neutral-900 border-l-2 border-white" : "hover:bg-neutral-900/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">{p.name}</span>
                        <span
                          className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border ${
                            p.type === "skill"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }`}
                        >
                          {p.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">{p.title || p.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Selected Prompt Editor & Live Preview (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPrompt ? (
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">{selectedPrompt.name}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                      {selectedPrompt.type}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeletePrompt(selectedPrompt.name)}
                    className="p-1.5 text-neutral-500 hover:text-red-400 transition"
                    title="Delete prompt"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-1">
                      Display Title
                    </label>
                    <input
                      type="text"
                      value={selectedPrompt.title || ""}
                      onChange={(e) => {
                        const updated = library.prompts.map((p) =>
                          p.name === selectedPrompt.name ? { ...p, title: e.target.value } : p
                        );
                        setLibrary({ ...library, prompts: updated });
                        setSelectedPrompt({ ...selectedPrompt, title: e.target.value });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-neutral-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={selectedPrompt.description || ""}
                      onChange={(e) => {
                        const updated = library.prompts.map((p) =>
                          p.name === selectedPrompt.name ? { ...p, description: e.target.value } : p
                        );
                        setLibrary({ ...library, prompts: updated });
                        setSelectedPrompt({ ...selectedPrompt, description: e.target.value });
                      }}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-neutral-600"
                    />
                  </div>
                </div>

                {/* Template Content */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] uppercase tracking-wider text-neutral-400">
                      Template (Supports &#123;&#123;var&#125;&#125; and &#123;&#123;profile.*&#125;&#125;)
                    </label>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      e.g. &#123;&#123;profile.technical_profile.primary_framework&#125;&#125;
                    </span>
                  </div>
                  <textarea
                    value={selectedPrompt.template}
                    onChange={(e) => {
                      const updated = library.prompts.map((p) =>
                        p.name === selectedPrompt.name ? { ...p, template: e.target.value } : p
                      );
                      setLibrary({ ...library, prompts: updated });
                      setSelectedPrompt({ ...selectedPrompt, template: e.target.value });
                    }}
                    rows={6}
                    className="w-full bg-black border border-neutral-800 rounded p-3 font-mono text-xs text-neutral-200 outline-none focus:border-neutral-600 leading-relaxed"
                  />
                </div>

                {/* Live Argument Tester */}
                {selectedPrompt.arguments && selectedPrompt.arguments.length > 0 && (
                  <div className="border-t border-neutral-900 pt-4 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      Test Variable Substitution
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedPrompt.arguments.map((arg) => (
                        <div key={arg.name}>
                          <label className="block text-[10px] font-mono text-neutral-400 mb-0.5">
                            {arg.name} {arg.required && <span className="text-red-400">*</span>}
                          </label>
                          <input
                            type="text"
                            placeholder={arg.description || arg.default || ""}
                            value={testArgs[arg.name] || ""}
                            onChange={(e) => setTestArgs({ ...testArgs, [arg.name]: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-neutral-600"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleTestRender}
                      className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded text-xs text-white font-semibold transition"
                    >
                      Render Preview
                    </button>
                  </div>
                )}

                {testOutput && (
                  <div className="bg-black border border-neutral-800 rounded p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                      <span>Rendered Output:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(testOutput);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                        className="text-neutral-400 hover:text-white flex items-center gap-1"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap">{testOutput}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-12 text-center text-xs text-neutral-500">
                Select a prompt on the left to edit or preview.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Raw PROMPTS.json */}
      {activeTab === "json" && (
        <div className="border border-neutral-800 rounded-lg overflow-hidden bg-black">
          <textarea
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            className="w-full h-[600px] bg-black text-neutral-200 font-mono text-xs p-4 resize-none outline-none focus:ring-1 focus:ring-neutral-700 leading-relaxed"
            placeholder="Paste raw PROMPTS.json..."
            spellCheck={false}
          />
        </div>
      )}

      {/* TAB 3: Import from PROMPTS.md */}
      {activeTab === "markdown" && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
              <Upload className="w-4 h-4 text-neutral-400" />
              Import PROMPTS.md Markdown
            </h3>
            <p className="text-xs text-neutral-400">
              Paste markdown with &ldquo;## Prompt: name&rdquo; or &ldquo;## Skill: name&rdquo; headings followed by fenced code blocks.
              StoneWay will parse, validate, and convert it into a structured, versioned PROMPTS.json library.
            </p>
          </div>

          <textarea
            value={markdownInput}
            onChange={(e) => setMarkdownInput(e.target.value)}
            rows={12}
            placeholder={`## Prompt: landing_page
Design a landing page using my preferred stack {{profile.technical_profile.primary_framework}}.

## Skill: ui_standards
Follow strict 8px grid and mobile-first principles.`}
            className="w-full bg-black border border-neutral-800 rounded p-4 font-mono text-xs text-neutral-200 outline-none focus:border-neutral-600 leading-relaxed"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">
              Templates are plain-text with safe substitution only. No untrusted code execution.
            </span>
            <button
              onClick={handleImportMarkdown}
              disabled={saving}
              className="bg-white text-black px-4 py-2 rounded text-xs font-bold hover:bg-neutral-200 transition disabled:opacity-50"
            >
              {saving ? "Converting & Validating..." : "Convert & Import to PROMPTS.json"}
            </button>
          </div>
        </div>
      )}

      {/* Footer message */}
      <div className="text-[11px] text-neutral-500 flex items-center justify-between">
        <span>StoneWay MCP automatically registers custom prompts and skills for every connected agent.</span>
        <span>Version: v{version}</span>
      </div>
    </div>
  );
}
