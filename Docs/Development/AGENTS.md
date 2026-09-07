> LEGACY / HISTORICAL REFERENCE
>
> This file predates the current root project-memory set and should not be treated as the active development authority.
>
> Current source of truth:
> `CODEX.md`, `TASK.md`, `STATE.md`, `ARCHITECTURE.md`, `Docs/Architecture/API_SPEC.md`, `CHANGELOG.md`, `README.md`, `FILE_STRUCTURE.md`

# AGENTS.md

Read `Readme.md` (overview), `.clinerules` (business rules), and `Important Files/` (DEPLOYMENT.md, ARCHITECTURE.md, API_SPEC.md) for detail. This file is only the compact living config.

## 1. PROJECT
- **Stack:** Node.js + TypeScript (ESM, `strict`, ES2022), Apple Silicon (M5) optimized.
- **Pipeline (Pre-CRM gatekeeper):** 7 gated stages — Hookdeck → Sanitize → Verify → Dedup → Enrich → Anti-ICP → Score, then Module 4 routes by `icp_score`. n8n (Docker/OrbStack) runs the workflow; hosted Supabase is the source of truth (migrations live under `Data/Supabase/migrations/`).
- **External APIs:** Hookdeck, Emailable, Apollo, Gemini (AI score/nurture), HubSpot, Slack, Brevo. DeepSeek for orchestration.

## 2. COMMANDS
- **Install:** `npm install` (Python scripts are stdlib-only; `pip` is unavailable).
- **Start:** `docker compose up -d` (n8n on :5678, LiteLLM internal, MX on :9001); start the Next.js app separately when product API testing is needed; reconnect Hookdeck only for webhook E2E tests.
- **Simulate:** `node scripts/simulate_webhook.cjs`; `node scripts/demo_5_leads.cjs`.
- **Test:** `node scripts/test-*.cjs` (one harness per Code-node snippet).
- **Type-check/build:** `npm run typecheck` (`tsc --noEmit`); `npm run build`.

## 3. CONVENTIONS
- Workflow JSON's source of truth is `scripts/build_workflow.py` — edit code snippets, rebuild; never hand-edit `n8n/ingestion_workflow.json`.
- n8n Code nodes have duplicate copies in `supabase/snippets/*.js` and the workflow JSON — keep in sync (edit snippets, rebuild).
- Secrets via `process.env` only, mirrored in `.env.example`; never commit `.env`.

## 4. ARCHITECTURE
- Every stage is a gate: fail → logged and stopped, never scored or CRM'd.
- CRM Gatekeeper: HubSpot only if `icp_score >= 70` AND email verified deliverable.
- Identity stitching: check existing Supabase emails before creating records (no duplicates).

## 5. DEFINITION OF DONE
- Feature works through the real path (Hookdeck → n8n → Supabase → Gemini → HubSpot/Slack/Brevo).
- Follows 7-stage gated architecture + `.clinerules`; snippets and workflow JSON in sync.
- Relevant `node scripts/test-*.cjs` passed; result verified end-to-end.
- No new deps unless an existing one can't solve it; no duplicate utilities/docs; no unrelated refactors.

## 6. DEBUGGING
- Diagnose root cause from the error/log before changing code.
- Don't blindly retry a failing command; change something meaningful after each failure.
- Don't chase unrelated pre-existing warnings; fix only genuine errors from current work.
- Prefer automated tests and direct verification over manual code re-reading.

## 7. CONSTRAINTS
- Dev/test data is synthetic only (e.g. `alex@ai-labs.io`) — never real PII.
- Blocked jurisdictions KP/IR/CU/SY/BY/RU/VE/MM/SD/ZW auto-disqualify at door + after enrichment — never scored or CRM'd.
- Migrations run in order `01`–`08` — preserve ordering when adding one.
- Keep this file < 100 lines; replace rules in place, never append history or logs.
