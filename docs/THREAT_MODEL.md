# Sakoso backend threat model

## Trust boundaries

1. Public HTTP requests cross into Sakoso and are schema-validated with strict size and rate limits.
2. ERC-8004 data crosses from 8004scan into Sakoso and is parsed as untrusted JSON.
3. A mandate draft crosses back to the user for explicit wallet confirmation. The backend does not sign it.

## Assets

- User wallet authority and future Altana sessions.
- Mandate constraints, digests, and execution receipts.
- Server-side upstream API credentials.
- Accurate agent identity and performance evidence.

## Initial abuse cases and controls

| Abuse case | Control in this milestone |
| --- | --- |
| Use Sakoso as an SSRF proxy | Upstream origin is hard-coded; request input never supplies a URL. |
| List placeholder or wrong-chain identities | Every upstream query fixes BSC mainnet, registered, and active filters. |
| Oversized or malformed request | 32 KiB body limit and Zod validation at every public boundary. |
| Create an unbounded mandate | Expiry, spend, slippage, target, and selector limits are mandatory. |
| Treat a draft as permission | Responses explicitly say `onchain: false` and require wallet confirmation. |
| Exhaust anonymous upstream quota | Server cache, upstream timeout, and request rate limits. |
| Leak an upstream key | Server-only environment variable and request-log header redaction. |

## Not yet implemented

- Wallet authentication and ownership checks.
- Persistence and per-owner authorization for mandate records.
- Altana session registration, revocation, and onchain read-back.
- ERC-8183 hiring and settlement.
- Independent endpoint probing and pinned-IP SSRF protection.

These are open boundaries, not shipped capabilities.
