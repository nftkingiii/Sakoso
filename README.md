# Sakoso

**Hire agents. Keep control.**

Sakoso is a bounded marketplace for financial agents on BNB Chain. It is being built for BNB Chain's **Build the Era** challenge around one principle: an onchain identity is not enough to trust with capital. Users should be able to compare live evidence, grant narrow authority, inspect outcomes, and revoke access.

`Sakoso` is the ASCII product spelling of the Yorùbá verb `ṣàkóso`: to control, manage, or administer.

## Product milestones

This repository contains a proof-first vertical slice:

- an original responsive marketplace interface with live discovery, authority drafting, and onchain verification as separate top-level workflows;
- live ERC-8004 discovery through 8004scan, pinned to registered and active BSC mainnet identities;
- the four required marketplace categories as first-class API values;
- normalized identity, protocol, payment, score, feedback, and freshness evidence;
- deterministic bounded-mandate drafts with explicit spend, expiry, slippage, contract, and function limits;
- deterministic Altana session drafts with selector-level call permissions, a mandatory spend cap, bounded expiry, and mandatory KeyStore registration;
- block-pinned reads of live BNB testnet authority state from Altana's KeyStore;
- a local grant, execute, verify, revoke, verify runner that never sends either signer key to the API or writes generated session material to disk;
- security headers, rate limits, request-size limits, upstream timeouts, schema validation, and secret redaction.

The interface does not simulate wallet state. Its two prepare flows create unsigned commitments; they do **not** create authority. The local Altana runner is the only signing path in this milestone, and its first funded onchain run is still pending.

## API

| Route | Purpose |
| --- | --- |
| `GET /` | Responsive Sakoso marketplace and authority interface |
| `GET /healthz` | Liveness and served revision |
| `GET /v1/categories` | The four official marketplace categories |
| `GET /v1/coverage` | Live coverage and leading candidate for every required category |
| `GET /v1/agents` | Live BSC agent discovery and comparison evidence |
| `POST /v1/mandates/prepare` | Validate and hash a bounded mandate for later wallet confirmation |
| `GET /v1/altana/config` | Pinned BNB testnet, KeyStore, and explorer configuration |
| `POST /v1/altana/sessions/prepare` | Validate and hash selector-scoped Altana permissions |
| `GET /v1/altana/authority` | Read a public session key's live KeyStore state at a specific block |

Example discovery:

```bash
curl "http://localhost:8080/v1/agents?category=health-factor-monitoring&endpointVerified=true"
```

Production product and API: `https://sakoso.up.railway.app`

```bash
curl "https://sakoso.up.railway.app/healthz"
```

## Local development

Requirements: Node.js 24+ and pnpm 11.11.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

An 8004scan API key is optional for development and should only be placed in `.env`, never in browser code or source control. See `.env.example`.

## Local Altana proof

The proof runner keeps the admin signer in a local environment variable and keeps the generated session signer in memory only. Start by deriving the EIP-7702 wallet address without sending a transaction:

```powershell
$env:ALTANA_ADMIN_PRIVATE_KEY = Read-Host -MaskInput "Altana testnet admin private key"
$env:ALTANA_PROOF_MODE = "address"
pnpm altana:proof
Remove-Item Env:ALTANA_ADMIN_PRIVATE_KEY
Remove-Item Env:ALTANA_PROOF_MODE
```

Fund only the printed smart-wallet address with testnet BNB. A funded proof run additionally requires an explicit target, function signature, matching calldata, spend cap, and call value. It grants a registered session, verifies it directly against the KeyStore, executes the permitted call, revokes the key in `finally`, and verifies that the key is no longer valid. Do not use a mainnet key.

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
- `revoked-or-unregistered` is intentionally ambiguous: the KeyStore's boolean read proves that the key is not currently authorized, not whether it existed previously.
- Passing tests and a live negative KeyStore read do not substitute for the pending funded grant/execute/revoke transaction sequence.
- The [proof matrix](docs/PROOF_MATRIX.md) marks unfinished integrations explicitly.

## License

MIT
