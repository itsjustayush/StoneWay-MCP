import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="max-w-3xl space-y-10 text-neutral-300 text-xs leading-relaxed">
      <div className="border-b border-neutral-900 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">STONEWAY DOCUMENTATION</h1>
          <p className="text-neutral-500 mt-1">Integration, client configuration, and memory reconciliation guide</p>
        </div>
        <Link href="/" className="text-neutral-500 hover:text-white transition">← home</Link>
      </div>

      {/* 1. Quick Start */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">1. Quick Start</h2>
        <p className="text-neutral-400">
          StoneWay acts as a cloud-backed memory vault for your AI agents. All your agents share the same
          unified memory and single bearer token.
        </p>
        <ol className="list-decimal pl-5 space-y-2 text-neutral-400">
          <li>Sign in to the StoneWay dashboard using your GitHub account at <Link href="/login" className="text-white underline">/login</Link>.</li>
          <li>Navigate to <Link href="/app/key" className="text-white underline">/app/key</Link> and copy your API key (<code className="text-neutral-300">sw_...</code>).</li>
          <li>Paste the MCP configuration snippet into your favorite AI tool (see client guides below).</li>
        </ol>
      </section>

      {/* 2. Client Setup */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">2. MCP Client Setup</h2>
        
        <div className="space-y-2">
          <h3 className="font-bold text-neutral-200">Claude Desktop (Python / uvx - Recommended)</h3>
          <p className="text-neutral-400">
            Open <code className="text-neutral-300">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows) or <code className="text-neutral-300">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) and add:
          </p>
          <pre className="p-3 bg-neutral-950 border border-neutral-900 rounded text-[11px] text-neutral-300 overflow-x-auto">
{`{
  "mcpServers": {
    "stoneway": {
      "command": "uvx",
      "args": ["stoneway-mcp"],
      "env": {
        "STONEWAY_TOKEN": "sw_your_token_here",
        "STONEWAY_API_URL": "https://stoneway.vercel.app/api/v1"
      }
    }
  }
}`}
          </pre>
        </div>

        <div className="space-y-2">
          <h3 className="font-bold text-neutral-200">Cursor IDE</h3>
          <p className="text-neutral-400">
            Navigate to <strong>Cursor Settings → Features → MCP</strong>, click <strong>+ Add New MCP Server</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-neutral-400">
            <li><strong>Type:</strong> <code className="text-neutral-300">command</code></li>
            <li><strong>Command:</strong> <code className="text-neutral-300">uvx stoneway-mcp</code> (or <code className="text-neutral-300">python -m stoneway_mcp</code>)</li>
            <li><strong>Environment:</strong> <code className="text-neutral-300">STONEWAY_TOKEN=sw_...</code></li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="font-bold text-neutral-200">Offline / Local Workspace Mode (No Cloud Token Needed)</h3>
          <p className="text-neutral-400">
            You can run StoneWay completely offline directly inside your git repositories:
          </p>
          <pre className="p-3 bg-neutral-950 border border-neutral-900 rounded text-[11px] text-neutral-300 overflow-x-auto">
{`{
  "mcpServers": {
    "stoneway-local": {
      "command": "uvx",
      "args": ["stoneway-mcp", "--mode", "local", "--local-dir", "."]
    }
  }
}`}
          </pre>
        </div>
      </section>

      {/* 3. The Tools */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">3. Available MCP Tools</h2>
        <div className="space-y-3">
          <div className="border border-neutral-900 p-3 rounded bg-neutral-950/40">
            <code className="text-white font-bold">get_profile_context</code>
            <p className="text-neutral-400 mt-1">
              Primary tool. Call this first in any conversation. Returns structured <code className="text-neutral-300">StoneWay.json</code>, raw <code className="text-neutral-300">StoneWay.md</code>, and flags if newer unreconciled markdown lines exist.
            </p>
          </div>
          <div className="border border-neutral-900 p-3 rounded bg-neutral-950/40">
            <code className="text-white font-bold">update_profile_context</code>
            <p className="text-neutral-400 mt-1">
              Merges structured JSON updates and/or appends notes. Employs optimistic locking with <code className="text-neutral-300">base_version</code> to prevent conflicting agent writes.
            </p>
          </div>
          <div className="border border-neutral-900 p-3 rounded bg-neutral-950/40">
            <code className="text-white font-bold">append_note</code>
            <p className="text-neutral-400 mt-1">
              Quickly records a timestamped builder note or scratchpad observation directly to <code className="text-neutral-300">StoneWay.md</code>.
            </p>
          </div>
          <div className="border border-neutral-900 p-3 rounded bg-neutral-950/40">
            <code className="text-white font-bold">get_bio</code>
            <p className="text-neutral-400 mt-1">
              Generates platform-tailored bios (<code className="text-neutral-300">github</code>, <code className="text-neutral-300">x</code>, <code className="text-neutral-300">linkedin</code>, <code className="text-neutral-300">devpost</code>) filtered strictly to public profile fields.
            </p>
          </div>
          <div className="border border-neutral-900 p-3 rounded bg-neutral-950/40">
            <code className="text-white font-bold">trigger_external_sync</code>
            <p className="text-neutral-400 mt-1">
              Triggers on-demand synchronization for connected external platforms like GitHub.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Zero Data Loss Invariant */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">4. Zero-Data-Loss Invariant</h2>
        <p className="text-neutral-400">
          When AI agents send patches to StoneWay, unexpected or unmapped fields are NEVER discarded.
          The reconciliation engine intercepts off-schema properties and nests them cleanly into
          an <code className="text-neutral-300">unstructured_metadata[]</code> array with origin timestamps and source agent labels.
        </p>
      </section>
    </div>
  );
}
