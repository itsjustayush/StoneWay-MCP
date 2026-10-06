# StoneWay Privacy Policy

**Last Updated:** October 2026  
**Effective Date:** October 2026

StoneWay ("StoneWay", "we", "us", or "our") is an open-source, cloud-backed Model Context Protocol (MCP) server and web application designed to act as persistent, synchronized memory for developers, builders, and AI agents.

This Privacy Policy explains how data is collected, processed, encrypted, stored, and deleted when you use the StoneWay hosted application, the StoneWay MCP server (`stoneway-mcp`), and associated services (collectively, the "Service").

---

## 1. Open Source & Self-Hosting Scope

- **Self-Hosted Deployments:** If you run your own instance of the StoneWay web app, database, or MCP server, you are the independent data controller. You control your own database, encryption keys, and environment variables. We have zero access to your self-hosted data.
- **Hosted Cloud Service:** If you use an official or community-hosted deployment of StoneWay, this policy explains the precise operational and cryptographic measures governing your data.

---

## 2. Information We Collect

We adhere to strict data minimization principles. We only collect data necessary to provide persistent memory and context for your AI workflows.

### A. Account & Identity Information
When you authenticate via GitHub OAuth, we request minimal read-only permissions (`read:user`, `user:email`). We collect:
- Your GitHub numerical ID, GitHub username, and display name.
- Your primary email address associated with your GitHub account.
- Your GitHub avatar URL.
*We never request or accept the `repo` scope or administrative permissions on your GitHub repositories.*

### B. Builder Memory & Profile Content
To serve context to your AI agents, you and your connected agents create and modify:
- **`StoneWay.md` (Raw Scratchpad & Memory):** Unstructured text containing project notes, bios, links, system prompts, tech stacks, and chronological builder logs.
- **`StoneWay.json` (Structured Builder Matrix):** Schema-validated profile fields, including identity, technical skills, public/private contact details, active projects, past projects, planned ideas, and overflow metadata (`unstructured_metadata[]`).
- **Revision History:** Diffs and chronological snapshots of changes made to your profile, including the timestamp and the self-reported agent label (e.g., `claude-desktop`, `cursor`).

### C. Authentication Tokens & Credentials
- **StoneWay API Key (`STONEWAY_TOKEN`):** Generated in the format `sw_<random-bytes>`. The cloud database stores **only a cryptographic SHA-256 hash** of this token for verifying agent MCP requests. An encrypted copy is preserved strictly in an AES-256-GCM envelope to allow the authenticated user to reveal it in the web dashboard.
- **Integration Credentials (`StoneWayConfig`):** If you optionally connect third-party services (such as a GitHub Personal Access Token or a Notion Integration Secret), these credentials are stored **exclusively inside an AES-256-GCM encrypted envelope**.

---

## 3. How We Use and Process Data

We use your data solely to fulfill the core functionality of StoneWay:
1. **Serving Authenticated MCP Requests:** Allowing AI agents authorized with your `STONEWAY_TOKEN` to read (`get_profile_context`, `get_bio`) and update (`update_profile_context`, `append_note`) your builder context.
2. **Dashboard Management:** Allowing you to view, edit, download, or wipe your `StoneWay.md` and `StoneWay.json` files.
3. **Third-Party Connectors:** Fetching public or authorized data (e.g., your public GitHub repositories, npm packages, or Notion databases) when explicitly triggered by you or your agents.
4. **Bio Generation:** Constructing platform-tailored bios using **only** fields designated with `"visibility": "public"`.

### What We NEVER Do With Your Data:
- **We NEVER sell, rent, or lease your personal data to any third party or data broker.**
- **We NEVER use your private profile data, prompts, or notes to train foundation AI models.**
- **We NEVER expose private contact fields or secret credentials to public endpoints or unauthenticated callers.**
- **We NEVER log or expose plaintext credentials in server logs or API responses.**

---

## 4. Cryptographic Security & Architecture

StoneWay is built with a zero-plaintext security posture for confidential credentials:

1. **Symmetric Encryption at Rest:** All external integration tokens and the revealable copy of your `STONEWAY_TOKEN` are encrypted using **AES-256-GCM**. Every write operation utilizes a unique, cryptographically random 96-bit Initialization Vector (IV) and produces an authentication tag. Decryption occurs strictly in-memory during server-side execution.
2. **Hash-Based Authentication:** Incoming MCP tool requests authenticate via the SHA-256 hash of your bearer token. The database never decrypts config records on the authentication hot path.
3. **Strict Separation of Public and Private Data:** 
   - Fields tagged `"visibility": "private"` (such as private emails, phone numbers, or physical locations) are inaccessible to public bio tools (`get_bio`) or public profile pages (`/@username`).
   - Private data is only accessible to agents providing a valid, unrevoked bearer token.
4. **Prompt Injection Safety Envelopes:** All profile context returned through the MCP server is enclosed in an immutable safety envelope warning calling LLMs that the content represents untrusted user memory and must not be executed as system instructions.

---

## 5. Third-Party Infrastructure & Sub-processors

When using the hosted cloud service, data is processed by vetted infrastructure providers:
- **Neon Inc. (Serverless PostgreSQL):** Cloud database storage with encryption at rest and automated backups.
- **GitHub (OAuth Provider):** Identity verification and token exchange.
- **Hosting Provider (e.g., Vercel):** Serverless edge runtime and application hosting.

---

## 6. Data Retention, Rights & Deletion (GDPR / CCPA)

You have full sovereignty over your data:

- **Right to Access & Portability:** You can inspect your complete `StoneWay.md` and `StoneWay.json` anytime in the web dashboard and export/download them as standalone files with a single click.
- **Right to Rectification:** You can edit or prune your markdown and structured profile at any time.
- **Right to Erasure (Wipe & Delete):** 
  - You can trigger a **Wipe Profile** action in the web UI. This immediately purges the active `StoneWay.md`, resets `StoneWay.json`, and revokes your API token.
  - Snapshot revisions are archived for a maximum 30-day grace period to safeguard against accidental agent corruption, after which they are permanently deleted from database storage.
  - To request immediate, permanent deletion of your user account and all historical revisions, you can submit a deletion request via our support/repository channels.

---

## 7. Children's Privacy

The Service is not intended for or directed toward individuals under the age of 13 (or under 16 in the European Economic Area). We do not knowingly collect personal information from children.

---

## 8. Changes to this Policy

We may update this Privacy Policy from time to time. Updates will be reflected by the "Last Updated" date at the top of this document and committed directly to the public GitHub repository. Continued use of the Service following notice of changes constitutes acceptance of the revised policy.

---

## 9. Contact & Security Inquiries

If you have questions, privacy concerns, or data requests regarding StoneWay:
- **Repository Issues / Security:** Open a private vulnerability report or issue on GitHub: `https://github.com/itsjustayush/StoneWay-MCP`
- **Email:** Contact the maintainers directly via the repository profile.
