# Production rollback

Sakoso's backend is stateless in this milestone: it has no database, migrations, volumes, or durable queues. A rollback only changes the deployed image and its environment variables.

## Trigger conditions

- `/healthz` stops returning HTTP 200 or reports an unexpected revision;
- a required public route begins returning server errors at more than twice its observed baseline;
- p95 response latency rises by more than 50% without an upstream-only explanation;
- sensitive data appears in a response or log;
- live agent discovery returns wrong-chain or inactive identities.

## Preferred rollback

1. Open the Railway `api` service's deployment history.
2. Select the last verified deployment and choose **Rollback**.
3. Confirm `/healthz` returns the prior expected revision.
4. Exercise `/v1/categories`, `/v1/coverage`, `/v1/agents`, and `/v1/mandates/prepare`.
5. Inspect deploy and HTTP logs for new errors.

Railway restores the selected deployment's image and variables. Image retention depends on the account plan, so this path is time-limited.

## Source rebuild fallback

If the prior image is no longer retained, check out the last verified Git revision locally, run `pnpm verify` and `pnpm audit --prod`, then deploy that exact tree with `railway up --service api`. Do not rewrite `main` or use `git reset --hard` as a rollback mechanism.

## Verification boundary

Railway's `/healthz` check gates a new deployment but is not a continuous uptime monitor. Railway logs and metrics are the current observability layer; independent continuous probing remains an open production gap.
