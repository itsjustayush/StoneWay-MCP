import Link from "next/link";

export default function SecurityPage() {
  return (
    <div className="max-w-3xl space-y-8 text-neutral-300 text-xs leading-relaxed">
      <div className="border-b border-neutral-900 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-wide">SECURITY POLICY &amp; ARCHITECTURE</h1>
        <Link href="/" className="text-neutral-500 hover:text-white transition">← back to home</Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">1. Cryptographic Invariants</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
          <li><strong>Authentication:</strong> API bearer keys are verified via deterministic <strong>SHA-256 hash lookup</strong> in Neon Postgres. Raw keys are never stored in plain text.</li>
          <li><strong>Envelope Encryption:</strong> Third-party integration credentials and revealable token backups are encrypted at rest with <strong>AES-256-GCM</strong> using a unique 96-bit Initialization Vector (IV) and 128-bit authentication tag per write.</li>
          <li><strong>Zero Plaintext Secret Exposure:</strong> Credentials never touch server logs or MCP tool outputs.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">2. Responsible Disclosure</h2>
        <p className="text-neutral-400">
          If you discover a vulnerability, please report it privately via GitHub Security Advisories
          on the repository: <code className="text-neutral-300">https://github.com/itsjustayush/StoneWay-MCP/security/advisories</code>.
          Do not file public issues for active security vulnerabilities.
        </p>
      </section>
    </div>
  );
}
