# Sakoso backend threat model

## Trust boundaries

1. Public HTTP requests cross into Sakoso and are schema-validated with strict size and rate limits.
2. ERC-8004 data crosses from 8004scan into Sakoso and is parsed as untrusted JSON.
3. A mandate draft crosses back to the user for explicit wallet confirmation. The backend does not sign it.
4. Public Altana authority inputs are limited to an address and SEC1 public key. Sakoso derives the key ID and reads one fixed KeyStore through one fixed RPC origin.
5. Altana signing happens only in the local proof runner. The admin key remains in the operator's environment; the generated session signer remains in memory and is never returned by the HTTP API.

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
| Grant broader Altana authority than shown | Session drafts require at least one target+selector pair, one positive spend cap, bounded expiry, and KeyStore registration. |
| Send a signer secret to the public API | The authority route accepts exactly a wallet address and a 65-byte SEC1 public key; a 32-byte private-key shape is rejected. |
| Turn the Altana reader into an SSRF/RPC proxy | Chain, RPC origin, contract, ABI, and function are hard-coded; user input cannot select any of them. |
| Execute calldata outside the displayed permission | The local runner derives the allowed selector and rejects calldata with a different first four bytes. |
| Leave a live key after execution failure | The local runner attempts admin-signed revocation in `finally`, performs a post-revocation KeyStore read, and exits nonzero unless revocation is confirmed and the key reads invalid. |
| Exhaust anonymous upstream quota | Server cache, upstream timeout, and request rate limits. |
| Leak an upstream key | Server-only environment variable and request-log header redaction. |

## Not yet implemented

- Wallet authentication and ownership checks.
- Persistence and per-owner authorization for mandate records.
- A funded Altana grant/execute/revoke proof with public transaction hashes. The read-back path and local runner exist, but no transaction proof is claimed yet.
- ERC-8183 hiring and settlement.
- Independent endpoint probing and pinned-IP SSRF protection.

These are open boundaries, not shipped capabilities.
