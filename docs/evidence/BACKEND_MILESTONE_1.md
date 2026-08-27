# Backend milestone 1 evidence

Observed locally on 2026-08-27 against the official 8004scan API.

## Verification

- `pnpm verify`: typecheck, 6 tests, and production build passed.
- `pnpm audit --prod`: no known vulnerabilities found.
- `pnpm audit signatures`: 176 packages had verified registry signatures.
- `GET /healthz`: HTTP 200 with revision `local-smoke`.
- Security headers observed: Content Security Policy, `X-Frame-Options: SAMEORIGIN`, and `X-Content-Type-Options: nosniff`.

## Live BSC category smoke test

The backend queried registered, owner-declared active identities on BSC mainnet through 8004scan. At least one result was returned for every required category:

| Category | Upstream total at observation | First result |
| --- | ---: | --- |
| Rebalancing | 1 | BNB LP Range Rebalancer |
| Grid trading | 3 | DeFiBot.agent |
| Yield optimisation | 1 | Yield Compass (Agent Studio) |
| Health factor monitoring | 3 | Health Factor Monitor |

These results establish live discovery coverage at one point in time. They do not prove endpoint health, task quality, or safe execution; those checks remain open in the proof matrix.
