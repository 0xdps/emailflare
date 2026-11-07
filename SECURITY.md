# Security Policy

Security is a foundational priority for EmailFlare. As an edge-native email platform handling sensitive transactional communications and customer mailboxes, we take security reports seriously.

---

## Reporting a Vulnerability

If you discover a potential vulnerability or security issue, **please do not open a public issue with reproduction details or exploit code.**

Instead, report it privately via one of the following channels:

- **GitHub Private Vulnerability Reporting:** Submit a report via the [Security Advisory tab](https://github.com/0xdps/emailflare/security/advisories) on GitHub.
- **Email:** Contact the maintainers privately at `security@emailflare.dev` (or the repository owner).

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:

1. A clear description of the vulnerability.
2. The affected files, routes, or component endpoints.
3. Step-by-step instructions or proof-of-concept (PoC) to reproduce the behavior.
4. An assessment of potential impact (e.g., unauthorized access, data exposure, XSS).
5. Suggested remediation or mitigation if available.

We will review your submission promptly, validate the findings, prepare a fix, and coordinate public disclosure once the patch is released.

---

## Security Architecture & Best Practices

EmailFlare incorporates built-in defensive architecture:

- **Isolated HTML Email Viewer:** Inbound emails are rendered inside a strict `sandbox=""` iframe without `allow-same-origin`. This completely prevents embedded scripts or malicious HTML from reading session cookies, accessing local storage, or interacting with the parent application origin.
- **Tracking Pixel & Remote Image Blocking:** Remote images and tracking beacons are blocked by default until the reader explicitly requests them.
- **Fine-Grained Role-Based Access Control (RBAC):** Access dimensions (`inbox`, `api`, `tester`) and administrator roles are validated on every database query and server action, ensuring members cannot access unauthorized mailboxes or provision API keys without explicit grants.
- **Edge Token Storage & Hashing:** Password hashes use modern cryptographic algorithms (PBKDF2/argon2), and API keys are stored as cryptographically hashed tokens.
- **Zero Server Management:** Running 100% serverless on Cloudflare's edge eliminates OS-level vulnerability vectors, container escapes, and unpatched server demons.
