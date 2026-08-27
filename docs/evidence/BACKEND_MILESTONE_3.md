# Backend milestone 3: Altana authority boundary

Observed: 2026-08-27 UTC

## Implemented

- Exact `@altananetwork/sdk` `0.8.0` and `viem` `2.56.0` dependencies.
- BNB testnet-only session drafts with a required target+selector allowlist, positive spend cap, 10-minute to 7-day expiry, and `registerInKeyStore: true`.
- Public KeyStore read-back from fixed chain `97`, fixed RPC origin, and fixed KeyStore `0x6b8361C29d05D498b1a12B54A37310f94171E94A`.
- Key IDs derived as `keccak256(SEC1 public key)`, matching Altana SDK `0.8.0`.
- A local proof runner that retains the admin key in an environment variable, retains the generated session signer in memory, checks calldata against the granted selector, revokes in `finally`, and exits nonzero unless revocation is confirmed and read back as invalid.

## Verified

| Check | Result |
| --- | --- |
| Typecheck | Passed, including the local proof runner |
| Test suite | 14 passed |
| Production build | Passed as ESM |
| Production dependency audit | No known vulnerabilities |
| Address-only runner | Derived the wallet and explorer URLs without submitting a transaction or printing a secret |
| Live KeyStore read | HTTP 200 at BNB testnet block `127608965`; a synthetic public key returned `authorized: false` and `revoked-or-unregistered` |

The live read exercised the production-built Fastify route, Viem RPC client, deployed KeyStore ABI, key derivation, block pinning, and both Altana and BscScan explorer links.

## Explicitly not yet proven

- No funded session grant has been submitted.
- No session-key transaction has been submitted.
- No active-to-revoked KeyStore transition has been recorded.
- No transaction hash is claimed.

Those three onchain steps are the next proof gate. A passing negative read is not a substitute for them.

## Production release

- Code revision: `88a6aa6a3761d6023ce54490529339e617edc9e4`
- Railway deployment: `f1789c5a-fdfb-456a-be78-d68e1d9ed66d`
- Deployment status: `SUCCESS`
- Public API: `https://api-production-b9a7.up.railway.app`

The live `/healthz` response matched the full intended code revision. A clean public smoke then returned:

| Public check | Result |
| --- | --- |
| `/v1/altana/config` | Chain `97`; expected deployed KeyStore |
| `/v1/altana/sessions/prepare` | HTTP 201; selector and spend limits retained; `onchain: false`; KeyStore registration required |
| `/v1/altana/authority` | HTTP 200; live negative read at block `127610340` |
| 32-byte private-key-shaped authority input | HTTP 422 |
| Existing category and agent discovery paths | Four categories and one live rebalancing result |
| Security headers | HSTS, CSP, frame, and content-type protections present |

One earlier upload carried an incorrectly expanded revision marker and briefly served it. The pre-ship gate rejected that marker; Railway deployment `bafc6e2a-78e9-40e9-8efe-5b5cbafee488` was superseded and is now `REMOVED`. No success claim relies on that deployment.
