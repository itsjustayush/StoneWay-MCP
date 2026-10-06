import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-3xl space-y-8 text-neutral-300 text-xs leading-relaxed">
      <div className="border-b border-neutral-900 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-wide">TERMS OF SERVICE</h1>
        <Link href="/" className="text-neutral-500 hover:text-white transition">← back to home</Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">1. &quot;AS-IS&quot; &amp; Disclaimer of Warranties</h2>
        <p className="text-neutral-400">
          THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. THE AUTHORS, MAINTAINERS,
          AND CONTRIBUTORS DISCLAIM ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED,
          INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">2. Absolute Limitation of Liability ($0.00 Cap)</h2>
        <p className="text-neutral-400">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE AUTHORS OR CONTRIBUTORS BE
          LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES (INCLUDING
          LOSS OF DATA, WORK STOPPAGE, OR AGENT HALLUCINATIONS). MAXIMUM AGGREGATE LIABILITY SHALL
          NOT EXCEED $0.00 USD.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">3. AI Agent Execution &amp; Hallucinations</h2>
        <p className="text-neutral-400">
          StoneWay is a context persistence layer. The maintainers do NOT control the behavior,
          reasoning, hallucinated code, or prompt injections of third-party AI agents (Claude, Cursor,
          custom scripts) connected to your account. You assume all risk for connecting autonomous
          agents to your profile.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">4. User Responsibility for Bearer Tokens</h2>
        <p className="text-neutral-400">
          You are solely responsible for safeguarding your <code className="text-neutral-300">STONEWAY_TOKEN</code>.
          If you leak or commit your token to public code repositories, the maintainers bear zero
          liability. Use the dashboard to immediately regenerate or revoke compromised keys.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">5. Indemnification</h2>
        <p className="text-neutral-400">
          You agree to indemnify, defend, and hold harmless the authors and contributors of StoneWay
          from any claims, damages, or liabilities arising out of your use of the Service or actions
          taken by your connected AI agents.
        </p>
      </section>
    </div>
  );
}
