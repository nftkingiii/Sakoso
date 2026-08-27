# Proof matrix

| Requirement | Implementation | Evidence | Status |
| --- | --- | --- | --- |
| Live BSC agent discovery | Fixed 8004scan query for chain 56, registered and active identities | Integration test plus live API response | Partial |
| Four equal categories | Stable taxonomy plus live coverage aggregation | `/v1/categories`, `/v1/coverage`, route tests, and 2026-08-27 live smoke results | Partial; candidates found in all four, depth still needs measurement |
| Decision-useful data | Normalized identity, protocols, payments, score, feedback, and freshness | `/v1/agents` response | Partial; independent probes pending |
| Bounded authority | Canonical mandate payload with spend, expiry, slippage, target, and selector limits | `/v1/mandates/prepare` tests | Partial; unsigned draft only |
| Altana | Planned session creation, onchain limits, and revocation | None yet | Missing |
| ERC-8183 hiring | Planned buyer-side job lifecycle | None yet | Missing |
| Agent advantage | Planned paired task measurements | None yet | Missing |
| Public deployment | Revision-bearing health endpoint exists | `/healthz` served `local-smoke` locally | Missing production proof |
