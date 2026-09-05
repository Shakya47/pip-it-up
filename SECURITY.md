# Security Policy

## Supported Versions

| Version | Supported |
| :--- | :--- |
| `0.1.x` | Yes — current public beta |
| `< 0.1.0` | No |

During `0.x`, only the **latest published minor** receives security fixes; there are no backports. Once `1.0.0` ships, the latest minor of the current major is supported and this file will be revised.

## Reporting a Vulnerability

If you discover a security vulnerability in `pip-it-up`, please report it privately:

- **Preferred reporting channel**: [GitHub Security Advisories](https://github.com/Shakya47/pip-it-up/security/advisories/new)

Please do not open public issues or discussions for security matters. When submitting a report, please include:
1. Affected package(s) and version(s)
2. Detailed step-by-step reproduction instructions or a minimal proof of concept
3. Potential impact and attack scenarios

Architectural constraints and core security invariants are documented in [`MAINTENANCE_GUIDE.md`](./specs/MAINTENANCE_GUIDE.md).

## Disclosure Policy

We follow a coordinated vulnerability disclosure process:

| Stage | Commitment |
| :--- | :--- |
| Acknowledgement | within 5 business days |
| Triage and severity assessment | within 10 business days |
| Fix released (high or critical) | within 30 days of acknowledgement |
| Fix released (low or medium) | next scheduled release |
| Public advisory | published at release, crediting the reporter unless they decline |

There is currently no formal bug bounty program.

## Scope

### In Scope
- `@pip-it-up/core` (latest published versions on npm)
- `@pip-it-up/react` (latest published versions on npm)

### Out of Scope
- `examples/playground`, `apps/storybook`, the landing site, and `docs/` — these are demonstration and development applications, not consumed as libraries.

### Explicitly Out of Scope (Threat Model Boundaries)
The following behaviors are explicit trust boundaries and by design:
- Same-origin trust violations — the Document PiP API is same-origin by browser design; any script on the page already has full access.
- Denial of service by opening many PiP windows — the user can close the tab, and window creation is gated on user activation.
- CSS injection via consumer-supplied `pipBodyStyles` — documented trusted input ([`packages/core/src/types.ts`](./packages/core/src/types.ts)); sanitisation is the consumer's responsibility.
- Inline handlers executing in cloned content under `mode: 'clone'` — documented trust boundary ([`packages/core/src/dom-modes.ts`](./packages/core/src/dom-modes.ts)), equivalent to `innerHTML`.
- Keystroke visibility to opener listeners when `forwardKeyboardEvents` is enabled — documented with an opt-out (SEC-202).
