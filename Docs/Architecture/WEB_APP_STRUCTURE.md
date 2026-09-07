> LEGACY / HISTORICAL REFERENCE
>
> This document is not the canonical repository structure guide.
>
> Current source of truth:
> `CODEX.md`, `TASK.md`, `STATE.md`, `ARCHITECTURE.md`, `Docs/Architecture/API_SPEC.md`, `CHANGELOG.md`, `README.md`, `FILE_STRUCTURE.md`

# Web App Structure

## Location
- `Product/Web_App/`

## Purpose
- Self-contained Next.js application for the CostPilot marketing site, signup flow, Firebase auth, onboarding, and dashboard.

## Architecture
- `app/` uses the Next.js App Router.
- `components/` contains shared UI and auth shell components.
- `lib/` contains Firebase auth initialization, auth helpers, and utilities.
- `public/` contains static icons and placeholder assets.

## Firebase Authentication
- Client Firebase initialization lives in `Product/Web_App/lib/firebase.ts`.
- Auth helpers live in `Product/Web_App/lib/auth.ts`.
- Email/password signup and login, Google sign-in, logout, and `onAuthStateChanged` gating are used by the app routes.

## Customer Journey
- `/` -> `/signup` -> Firebase auth -> `/onboarding` -> `/dashboard`
- `/login` -> `/dashboard`
- Unauthenticated users are redirected to `/login` from protected routes.

## Important Folders
- `app/`
- `components/`
- `lib/`
- `public/`
- `next.config.mjs`
- `tsconfig.json`
- `package.json`
- `pnpm-lock.yaml`

## Vercel Requirement
- Vercel should use `Product/Web_App` as the project Root Directory for this app.

## Notes
- Keep the app self-contained when migrating or deploying.
- Do not split framework folders across other CostPilot top-level folders unless a technical dependency requires it.
