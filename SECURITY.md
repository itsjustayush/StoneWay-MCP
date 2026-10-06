# StoneWay Security Policy

We take the security and integrity of StoneWay and its user data seriously. This document describes our security architecture, best practices, and the process for reporting vulnerabilities.

---

## 1. Supported Versions

Security updates and patches are actively applied to the latest `main` branch of the StoneWay repository:

| Version / Branch | Supported          |
| ---------------- | ------------------ |
| `main`           | :white_check_mark: |
| < 0.1.0          | :x:                |

---

## 2. Core Cryptographic Architecture & Invariants

StoneWay is designed with a defense-in-depth posture:

1. **Authentication Token Hashing:**
   - User API keys (`sw_<random-bytes>`) are never stored in plaintext in database lookup tables.
   - Authentication requests verify the incoming token against a **SHA-256 hash** stored in the `api_keys` table.
2. **AES-256-GCM Envelope Encryption:**
   - Any sensitive credentials stored in `StoneWayConfig` (including integration tokens and the revealable copy of the API key) are encrypted with **AES-256-GCM** using the environment-level secret key (`STONEWAY_ENCRYPTION_KEY`).
   - Every encryption operation generates a unique, cryptographically random **96-bit Initialization Vector (IV)** and verifies the **128-bit authentication tag** upon decryption.
3. **Zero Plaintext Invariant:**
   - Plaintext credentials are never persisted to database tables, never output to stdout/stderr logs, and never returned to any MCP tool or agent-facing REST endpoint.
4. **Safety Envelopes:**
   - All profile and bio content returned to MCP clients is framed in an untrusted user data boundary to guard against secondary prompt injection attacks.

---

## 3. Reporting a Vulnerability

If you discover a potential security vulnerability in StoneWay:

1. **Do NOT open a public GitHub issue.** Public disclosure exposes active users and self-hosted deployments before a fix can be deployed.
2. **Report Privately:**
   - Use GitHub's **Private Vulnerability Reporting** feature directly on the repository: `https://github.com/itsjustayush/StoneWay-MCP/security/advisories/new`
   - Alternatively, contact the maintainer directly via the contact channels listed in the project repository.
3. **Include the Following Details:**
   - Description of the vulnerability and potential impact.
   - Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
   - Component affected (Web app, REST API, MCP stdio server, database schema, or connector).

### Response SLA
- **Initial Response:** Within 48 hours acknowledging receipt of the report.
- **Triage & Patching:** High/critical severity issues will be prioritized for patching and released as a priority security fix.

---

## 4. Best Practices for Users & Agents

- **Keep Your `STONEWAY_TOKEN` Secret:** Treat your StoneWay key like an SSH key or master password. Never commit your MCP config files to public Git repositories.
- **Rotate Compromised Keys Immediately:** If an agent log or screenshot leaks your key, visit `/app/key` in the web dashboard and click **Regenerate**. This invalidates the old key across all agents instantly.
- **Minimal Permissions:** Always grant minimal required scopes when configuring third-party tokens (e.g., GitHub Personal Access Tokens).
