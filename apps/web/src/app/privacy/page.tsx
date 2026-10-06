import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl space-y-8 text-neutral-300 text-xs leading-relaxed">
      <div className="border-b border-neutral-900 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-wide">PRIVACY POLICY</h1>
        <Link href="/" className="text-neutral-500 hover:text-white transition">← back to home</Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">1. Open Source & Self-Hosting Notice</h2>
        <p>
          If you self-host StoneWay, you are the sole data controller. You maintain your own
          database and encryption keys. The authors and maintainers have zero access to your
          self-hosted infrastructure.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">2. Data We Collect & Store</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
          <li><strong>Account Data:</strong> GitHub ID, username, email, and avatar obtained via GitHub OAuth (minimal read-only scopes: <code className="text-neutral-300">read:user</code>, <code className="text-neutral-300">user:email</code>). We never request repo write scopes.</li>
          <li><strong>Memory Files:</strong> Your raw markdown notes (<code className="text-neutral-300">StoneWay.md</code>) and structured JSON matrix (<code className="text-neutral-300">StoneWay.json</code>).</li>
          <li><strong>API Credentials:</strong> Your StoneWay API token is stored as a <strong>cryptographic SHA-256 hash</strong> for authentication. An encrypted copy is kept inside an AES-256-GCM envelope strictly for your manual dashboard reveal.</li>
          <li><strong>Third-Party Tokens:</strong> Optional external tokens (GitHub PAT, Notion token) are encrypted using AES-256-GCM with a 96-bit random IV. They are never logged or exposed in plaintext.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">3. What We Never Do</h2>
        <p className="text-neutral-400">
          We never sell, rent, monetize, or trade your personal data. We never use your private
          profile content, notes, or agent prompts to train machine learning models.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">4. Your Rights (Export & Deletion)</h2>
        <p className="text-neutral-400">
          You can download your entire profile as raw <code className="text-neutral-300">.md</code> and <code className="text-neutral-300">.json</code> files at any time. You can wipe your active memory with one click in the editor, and all historical revisions are soft-archived for 30 days before permanent destruction.
        </p>
      </section>
    </div>
  );
}
