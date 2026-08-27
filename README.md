# Sakoso

**Hire agents. Keep control.**

Sakoso is a bounded marketplace for financial agents on BNB Chain. It is being built for BNB Chain's **Build the Era** challenge around one principle: an onchain identity is not enough to trust with capital. Users should be able to compare live evidence, grant narrow authority, inspect outcomes, and revoke access.

`Sakoso` is the ASCII product spelling of the Yorùbá verb `ṣàkóso`: to control, manage, or administer.

## Backend milestone 1

This repository currently contains the first backend vertical slice:

- live ERC-8004 discovery through 8004scan, pinned to registered and active BSC mainnet identities;
- the four required marketplace categories as first-class API values;
- normalized identity, protocol, payment, score, feedback, and freshness evidence;
- deterministic bounded-mandate drafts with explicit spend, expiry, slippage, contract, and function limits;
- security headers, rate limits, request-size limits, upstream timeouts, schema validation, and secret redaction.

The mandate endpoint prepares an unsigned commitment. It does **not** create an Altana session, submit an ERC-8183 job, move funds, or claim an onchain result.

## API

| Route | Purpose |
| --- | --- |
| `GET /healthz` | Liveness and served revision |
| `GET /v1/categories` | The four official marketplace categories |
| `GET /v1/coverage` | Live coverage and leading candidate for every required category |
| `GET /v1/agents` | Live BSC agent discovery and comparison evidence |
| `POST /v1/mandates/prepare` | Validate and hash a bounded mandate for later wallet confirmation |

Example discovery:

```bash
curl "http://localhost:8080/v1/agents?category=health-factor-monitoring&endpointVerified=true"
```

Production API: `https://api-production-b9a7.up.railway.app`

```bash
curl "https://api-production-b9a7.up.railway.app/healthz"
```

## Local development

Requirements: Node.js 24+ and pnpm 11.11.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

An 8004scan API key is optional for development and should only be placed in `.env`, never in browser code or source control. See `.env.example`.

## Verification

```bash
pnpm verify
pnpm audit --prod
```

Production deploys use Railway's Railpack builder, a revision-bearing health check, bounded restart policy, and graceful shutdown. The [rollback procedure](docs/ROLLBACK.md) records the release triggers and recovery path.

## Evidence boundaries

- 8004scan data is external registry/indexer evidence and is labeled by source and observation time.
- Owner-declared activity is not equivalent to an independently healthy endpoint.
- A Sakoso mandate draft is not authority until the wallet creates the corresponding onchain session.
- The [proof matrix](docs/PROOF_MATRIX.md) marks unfinished integrations explicitly.

## License

MIT
