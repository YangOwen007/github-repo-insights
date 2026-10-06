# Deployment

## Runtime and prerequisites

Tested runtime: Node.js 24.18.0; supported range: 24.x from 24.18.0. Package manager: pnpm 10.34.6. Required external service: outbound HTTPS to `api.github.com`, plus GitHub's avatar host for images. No database, migrations, seeds, persistent disk, or OAuth callback is required.

A public URL requires a hosting account and a completed deployment. No deployment account or domain is configured in this repository. A server-only `GITHUB_TOKEN` is optional but useful for shared IP quotas. Use `.env.example` for names, not real credentials.

## Vercel

The existing app supports Vercel's Next.js runtime. This is the recommended path, not a configured or verified deployment.

1. Import this repository into your Vercel account after pushing reviewed changes.
2. Select the **Next.js** preset and repository root. Select **Node.js 24.x** in project settings.
3. Set `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel honors `packageManager: pnpm@10.34.6`. Build command: `pnpm build`; install command: `pnpm install --frozen-lockfile`. Keep the framework output default (`.next`).
4. Optionally add a dedicated `GITHUB_TOKEN` for each intended environment. Keep preview and production settings separate; redeploy after variable changes.
5. Deploy a preview first and run the checks below. Configure hosting request limits and spending alerts before broader public promotion.
6. Promote the verified deployment, then add its real URL to GitHub About and README. Do not insert a placeholder demo link.

References: [Node.js runtime settings](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [package managers and Corepack](https://vercel.com/docs/package-managers). Check build logs for actual runtime and package manager versions.

## Generic Node hosting

```bash
npm install --global pnpm@10.34.6
pnpm install --frozen-lockfile
pnpm build
pnpm start --hostname 0.0.0.0 --port 3000
```

For a host-assigned port, use `PORT` with `pnpm start` or pass that port explicitly. Set variables through host secret settings. Run behind an HTTPS reverse proxy and use the host's process supervisor. Preserve `.next` with the matching package/lockfile version. Multiple instances have independent cache and request budgets. No application database backup is needed.

## Post-deployment checks

- `/api/health`: HTTP 200 and `{"status":"ok"}`. This is liveness, not GitHub readiness.
- `/`: render real reports for `YangOwen007/github-repo-insights` and `facebook/react`, including charts and sampling notices.
- `/api/insights`: missing/malformed repo returns 400; nonexistent public repo returns 404; exhausted GitHub quota returns 429.
- Inspect response headers for `X-Content-Type-Options: nosniff`, framing restrictions, and `Cache-Control: no-store` on reports. Check the browser console for hydration/chart failures.
- Test narrow viewport, keyboard navigation, loading announcements, error recovery, and an empty repository.
- Confirm browser JS/network responses contain no token. Monitor provider 5xx/429 rates, request duration, and GitHub quota; never log authorization headers or payloads.

The app does not implement a full script-src CSP or distributed rate limiter. HTTPS/HSTS and distributed limits must be supplied by hosting configuration when needed.

## Recovery and rollback

| Symptom | Action |
| --- | --- |
| Frozen install fails | Use pinned pnpm. Regenerate the lockfile locally only after reviewing manifest changes; commit both together. |
| Unsupported Node | Select documented Node 24.x and rebuild. |
| Report 429 | Wait for quota reset, check token expiry/permissions, and apply hosting limits. The per-process guard returns `Retry-After: 60`. |
| Report 502/503 | Check GitHub status, outbound networking, and API response changes; retry later. |
| Repo moved | Same-origin redirects are supported. If redirect resolution fails, enter the current canonical name. |
| Broken deployment | Promote the previous successful deployment, or redeploy a known-good commit with its matching lockfile. Re-run health and real-report checks. |

Rollback does not rotate credentials or restore host environment settings automatically. Record settings without secret values. Revoke exposed credentials through GitHub before deploying a replacement.
