# CostPilot Web App

This is the deployable Next.js application for CostPilot.

It covers:

- the recruiter-facing landing page
- Firebase authentication flows
- onboarding and profile sync
- product event capture
- the spend-intelligence dashboard
- acquisition attribution and billing integration hooks

## Local commands

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

## Environment

Copy `.env.example` to `.env.local` for local work. For Vercel, configure the same keys as project environment variables and do not commit local env files.

Required groups:

- Firebase public web config
- Firebase Admin service account JSON
- Supabase URL and service-role key
- PayU TEST credentials only

## Deployment note

When deploying on Vercel, set the project root to `Product/Web_App`.

The root [README.md](/Users/mac/.codex/.chatgpt-projects/g-p-6a89f756782c819186253616b405970c/CostPilot_mirror/README.md) is the public repository entry point. Architecture and demo-state references live under [`Docs/Architecture`](Docs/Architecture) and [`Portfolio`](../Portfolio).
