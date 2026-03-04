# Convex Setup (SlayZone)

This folder contains Convex backend code used by leaderboard auth/data.

## Dev Setup

1. Install dependencies from repo root:
   - `pnpm install`
2. Push backend changes to your dev deployment:
   - `npx convex dev --once`
3. Confirm required env vars exist:
   - `npx convex env list`

Required env vars:
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `SITE_URL` (base URL for standard redirects, e.g. `http://127.0.0.1:3210`)
- `JWT_PRIVATE_KEY`
- `JWKS`

## Production Pre-Ship Checklist

1. Create a separate GitHub OAuth app for production.
2. Set production callback URL in GitHub OAuth app:
   - `https://<your-prod-convex-site>/api/auth/callback/github`
3. Point production client to production Convex URL (`VITE_CONVEX_URL`).
4. Set production Convex env vars (`--prod`):
   - `AUTH_GITHUB_ID`
   - `AUTH_GITHUB_SECRET`
   - `SITE_URL=http://127.0.0.1:3210` (or your chosen base URL)
5. Generate and set auth keys as a pair on prod:
   - `JWT_PRIVATE_KEY`
   - `JWKS`
   - Important: these must match each other.
6. Verify desktop callback routing works in packaged app:
   - protocol/deeplink callback flow tested (`slayzone://auth/callback`)
   - sign-in results in authenticated state after redirect
7. Verify CSP still allows Convex endpoints in renderer:
   - `https://*.convex.cloud`
   - `wss://*.convex.cloud`
   - `https://*.convex.site`
   - `wss://*.convex.site`
8. Smoke test sign-in/sign-out on production deployment with a real GitHub account.
9. Add basic monitoring:
   - watch `npx convex logs --prod` for auth callback/sign-in errors after release.
10. Keep auth hidden behind your intended feature flag/environment gate until rollout.

## Notes

- For desktop OAuth, `SITE_URL` is used to validate allowed `redirectTo`.
- SlayZone auth allows the desktop deep-link destination `slayzone://auth/callback` via `convex/auth.ts` redirect callback.
- `JWT_PRIVATE_KEY`/`JWKS` errors usually show up as:
  - missing env var
  - sign-in callback succeeds but session activation fails
