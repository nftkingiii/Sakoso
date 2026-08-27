# Proof matrix

| Requirement | Implementation | Evidence | Status |
| --- | --- | --- | --- |
| Live BSC agent discovery | Fixed 8004scan query for chain 56, registered and active identities | Integration test plus live API response | Partial |
| Four equal categories | Stable taxonomy plus live coverage aggregation | `/v1/categories`, `/v1/coverage`, route tests, and 2026-08-27 live smoke results | Partial; candidates found in all four, depth still needs measurement |
| Decision-useful data | Normalized identity, protocols, payments, score, feedback, and freshness | `/v1/agents` response | Partial; independent probes pending |
| Bounded authority | Canonical mandate and Altana session payloads with spend, expiry, target, and selector limits | Prepare-route tests and deterministic digests | Partial; unsigned drafts only |
| Altana authority read-back | Fixed BNB testnet KeyStore read, derived key ID, block pin, and explorer links | Route tests plus live negative read at block `127608965` | Verified for read path; active-to-revoked transition pending |
| Altana session lifecycle | Local owner-signed grant, selector-scoped execute, `finally` revocation, and before/after KeyStore verification | Typechecked proof runner; address-only dry run | Partial; funded onchain transactions not yet produced |
| ERC-8183 hiring | Planned buyer-side job lifecycle | None yet | Missing |
| Agent advantage | Planned paired task measurements | None yet | Missing |
| Public deployment | Railway configuration, revision-bearing health endpoint, and rollback procedure | Deployment `f1789c5a-fdfb-456a-be78-d68e1d9ed66d`; `/healthz` serves code revision `88a6aa6`; full Altana and existing-route smoke | Verified; superseded bad-marker release and earlier transient upstream timeout retained in milestone evidence |
