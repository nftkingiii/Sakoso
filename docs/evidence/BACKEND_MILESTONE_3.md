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
