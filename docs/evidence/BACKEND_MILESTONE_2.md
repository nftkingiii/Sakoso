# Backend milestone 2: production deployment

Observed: 2026-08-27 UTC

## Verified release

- Public API: `https://sakoso.up.railway.app`
- Railway deployment: `91f1ffe0-f789-457f-8335-df68c0357278`
- Served Git revision: `f6d4f3735126efb577b7892d8035263f1a7a4e22`
- Deployment status: `SUCCESS`
- Image digest: `sha256:21138fffae0fd2422b433fe678afb8a49e076a95fdce344c968709c623d2146c`

Railway built with Node 24.19.0 and pnpm 11.11.0, enforced the frozen lockfile, verified 176 lock entries against its supply-chain policy, ran the TypeScript build, and gated activation on `GET /healthz` returning HTTP 200.

## Public workflow proof

One clean public run returned:

| Check | Result |
| --- | --- |
| `GET /healthz` | 200; exact revision above |
| Security headers | HSTS, CSP, X-Frame-Options, X-Content-Type-Options present |
| `GET /v1/categories` | 200; all four required categories |
| `GET /v1/coverage` | 200; complete; live counts `1 / 3 / 1 / 3` |
| `GET /v1/agents?category=rebalancing&limit=3` | 200; BSC mainnet evidence only |
| `POST /v1/mandates/prepare` | 201; digest shape valid; `onchain: false`; wallet confirmation required |
| Unsupported category | 422 `VALIDATION_ERROR` |

Local release verification also passed 7 tests, typecheck, build, frozen offline install, and `pnpm audit --prod` with no known vulnerabilities.

## Adverse states retained as evidence

1. The first deploy was rejected before build because Railway's live schema expects numeric `drainingSeconds`; the source configuration was corrected and re-verified.
2. The next isolated build failed closed on an unapproved `esbuild` postinstall. The exact script and dependency path were reviewed, then pnpm was configured to allow only `esbuild`; the successful Railway build verified all 176 lock entries.
3. The first public `/v1/coverage` call returned 502 when one of four parallel 8004scan calls reached the 5-second upstream timeout. Individual category probes passed, followed by three consecutive complete coverage responses and a complete end-to-end rerun. This remains a transient reliability risk, not a hidden success claim.

## Remaining boundaries

- Railway's health check gates deployments but is not continuous uptime monitoring.
- There is no earlier successful production image for this first release; source rebuild at the verified Git revision is the current fallback. Later releases can use Railway image rollback while retained.
- The deployed backend still does not create Altana sessions, submit ERC-8183 jobs, move funds, or claim onchain execution.
