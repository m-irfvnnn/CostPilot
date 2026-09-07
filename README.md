# CostPilot

CostPilot is a recruiter-ready portfolio project for AI workflow cost intelligence: connect an AI provider, instrument a workflow, run a test, and see usage, tokens, model, workflow, execution, cost, and activation/PQL signals in one dashboard.

The project combines a deployable Next.js web app with a broader backend automation backbone built around Supabase, Firebase, n8n, Hookdeck, Gemini scoring, HubSpot, Slack, and synthetic portfolio demo data.

## What this project shows

- full-stack SaaS product thinking, from landing page to authenticated dashboard
- GTM and RevOps systems design across inbound, outbound, and PLG flows
- AI-assisted qualification, routing, and operational automation
- data modeling for acquisition, accounts, product usage, billing test state, and lifecycle signals
- portfolio-ready demo discipline with synthetic-only seeded records

## Architecture at a glance

```text
Acquisition
-> Attribution
-> Qualification
-> Sales Routing
-> Product Intelligence
-> Billing
-> Retention
-> Expansion
-> Analytics
```

### Customer lifecycle flow

```text
Landing Page
-> Signup / Login
-> Firebase Authentication
-> Supabase Profile + Account
-> Onboarding
-> Product Events
-> Dashboard
```

### Revenue operations flow

```text
Inbound or Outbound Signal
-> Sanitization and Deduplication
-> Verification and Enrichment
-> AI Qualification
-> Routing and CRM Handoff
-> Product / Billing Visibility
-> Health, Alerts, and Expansion Signals
```

## Recruiter-facing feature summary

- responsive Next.js landing page and authenticated dashboard
- Firebase auth and profile sync
- Supabase-backed onboarding, product events, and account state
- acquisition attribution foundation for inbound, PLG, partner, creator, referral, and outbound signals
- lead qualification and sales-routing layers
- AI workflow usage, provider/model attribution, cost rollups, and activation/PQL signal foundations
- billing integration hooks with PayU TEST mode safeguards, documented as deferred portfolio functionality
- lifecycle and RevOps signal foundations kept mostly internal, without claiming production retention or expansion automation

## Tech stack

| Layer | Tools |
|---|---|
| Web app | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Auth | Firebase Auth, Firebase Admin |
| Data | Supabase, PostgreSQL, SQL migrations |
| Automation | n8n, Hookdeck, local webhook services |
| AI / enrichment | Gemini, Apollo, verification providers |
| CRM / comms | HubSpot, Slack, Brevo |
| Billing | PayU TEST integration |
| Deployment | Vercel for the web app |

## Repository layout

| Path | Purpose |
|---|---|
| `Product/Web_App` | Deployable Next.js app for the portfolio site and dashboard |
| `Acquisition`, `Revops`, `Automation` | GTM, routing, webhook, and workflow logic |
| `Data/Supabase` | schema migrations and seeded synthetic data |
| `Docs/Architecture` | deeper architecture, API, and deployment references |
| `Portfolio` | synthetic demo-state notes and recruiter demo guidance |

## Synthetic data disclosure

This repository is intended for public portfolio use. Demo accounts, leads, spend, billing, and lifecycle records are synthetic only.

- Synthetic cohort reference: [`Portfolio/Phase10_Demo_State.md`](./Portfolio/Phase10_Demo_State.md)
- Historical demo window: `2026-03-02` through `2026-08-29`
- Synthetic prefix: `phase10_demo_`
- Unsupported analytics fields remain intentionally `NULL` where noted in the portfolio docs

Do not represent demo records as real customers, production revenue, or live transactions.

## Public repo curation

Recommended to include in a recruiter-facing GitHub repo:

- source code under `Product/Web_App`, `Acquisition`, `Revops`, `Automation`, and `Data/Supabase`
- architecture and deployment docs under `Docs/Architecture`
- portfolio disclosure and demo references under `Portfolio`
- lockfiles, package manifests, and safe env examples

Recommended to exclude:

- `.env`, `.env.local`, `.env.*`, `.enc.local`, and any secret files
- `.next`, `node_modules`, `dist`, coverage, caches, and local Supabase temp state
- `.DS_Store` and editor-specific noise
- internal AI-assistant working files such as `CODEX.md`, `TASK.md`, `STATE.md`, and local instruction files

## Local setup

### Root automation workspace

```bash
npm install
npm run build
```

Copy the root `.env.example` to `.env` only for local private development. Never commit the filled file.

### Web app

```bash
cd Product/Web_App
pnpm install
pnpm dev
```

Create `Product/Web_App/.env.local` from `Product/Web_App/.env.example` and use only test or synthetic configuration values.

## Deployment

Vercel deployment target:

- framework: Next.js
- project root: `Product/Web_App`
- build command: `pnpm build`
- output: default Next.js output

Required Vercel environment groups:

- Firebase public web config
- Firebase Admin service account JSON
- Supabase URL
- Supabase service-role key
- PayU TEST merchant key, salt, env, and base URL

Keep PayU in `test` mode for the public portfolio deployment.

## Demo references

- Recruiter demo guide: [`Portfolio/README.md`](./Portfolio/README.md)
- Synthetic cohort details: [`Portfolio/Phase10_Demo_State.md`](./Portfolio/Phase10_Demo_State.md)
- Architecture index: [`Docs/Architecture/README.md`](./Docs/Architecture/README.md)

## Project status

Final portfolio readiness is in core cleanup and publication polish as of September 5, 2026.

That means the repo now contains:

- deterministic synthetic demo-state support
- historical seeded records for cross-page walkthroughs
- validation and benchmark scripts for hosted demo data
- real AI usage telemetry through local gateway/provider integration tests
- hosted Supabase product intelligence and lifecycle event ingestion
- controlled RevOps signal orchestration through n8n, HubSpot, Slack, and Supabase feedback
- recruiter-facing portfolio framing without pretending synthetic data is real customer activity

Current product scope:

- `/dashboard` is the authenticated real product surface and is intentionally organized as one guided page.
- `/demo` is a synthetic read-only preview for recruiter walkthroughs.
- Working customer journey: connect Gemini or DeepSeek, copy n8n instrumentation, run a server-triggered Product/PQL test, and refresh usage/cost intelligence.
- Roadmap concepts such as advanced budgets, alerts, recommendations, automated optimization, retention, expansion, and production billing should be framed as future work unless specifically validated.

Important local operation notes:

- Local n8n reaches the CostPilot web/API server at `host.docker.internal:3000`, so `pnpm dev` must be running in `Product/Web_App` before local usage-ingestion tests.
- LiteLLM is an internal Docker service on container port `4000`; do not expose it publicly for the portfolio demo.
- Avoid `n8n execute` while the running n8n task broker owns port `5679`; use the existing n8n UI for controlled manual workflow runs.
- PayU remains TEST-only and is not part of the primary Loom flow.

# Core Technology Stack

## Web Application

- Next.js 16
- React 19
- TypeScript
- Firebase Authentication
- pnpm

## Backend / Data

- Supabase
- PostgreSQL
- Firebase Admin
- Next.js server APIs

## Automation

- n8n
- Hookdeck
- Docker / OrbStack

## AI

- Gemini
- LiteLLM gateway
- DeepSeek telemetry prototype

## CRM / Revenue Operations

- HubSpot
- Slack
- Brevo

## Enrichment / Verification

- Apollo-style company enrichment
- provider-compatible email verification
- custom MX verification service

## Future Operations Interface

- Retool

Retool backend preparation is implemented through stable Supabase GTM analytics views and safe RPC contracts.

No Retool UI source is stored in this repository.

Retool will not be the system of record.

---

# Repository Structure

```text
CostPilot/
├── Strategy/
├── Product/
├── Data/
├── Acquisition/
├── Revops/
├── Automation/
├── Customer Success/
├── Analytics/
├── Docs/
└── Portfolio/
```

The repository is organized by domain responsibility.

Framework-specific applications remain self-contained.

---

# Important Locations

## Customer Web App

```text
Product/Web_App/
```

## Supabase

```text
Data/Supabase/
```

## Signal-Based Outbound

```text
Acquisition/Signal_Outbound/
```

## Unified Acquisition Foundation

```text
Acquisition/Shared/
```

## AI Qualification

```text
Revops/AI_Qualification/
```

Canonical runtime ownership remains in the existing n8n Gemini scoring and workflow path.

Phase 4 added:

- `Data/Supabase/Migrations/21_qualification_evaluations.sql`
- `Revops/AI_Qualification/qualification-contract.ts`
- `Revops/AI_Qualification/tests/qualification-runtime.test.mjs`
- explainable qualification evaluation history and analytics views
- formal MQL / SQL derivation
- explicit PQL deferral through `insufficient_product_signals`

Phase 5 added:

- `Data/Supabase/Migrations/22_sales_routing.sql`
- `Revops/Sales_Routing/routing-contract.ts`
- `Revops/Sales_Routing/tests/sales-routing-runtime.test.mjs`
- canonical sales routing tables, queue views, and RPCs
- deterministic SDR / AE assignment with handoff, retry, and manual override support
- n8n routing-state integration in inbound, outbound, and reply-to-deal workflows

## n8n

```text
Automation/n8n/
```

## MX Verification Service

```text
Automation/Local_Services/MX_Service/
```

---

# Customer Data Model

Current customer/product tables include:

- `profiles`
- `accounts`
- `account_members`
- `onboarding_responses`
- `product_events`

Current core customer migration:

```text
Data/Supabase/Migrations/16_core_customer_model.sql
```

Firebase remains the authentication provider.

Supabase Auth is not currently used.

Identity model:

```text
Firebase UID
↔
profiles.firebase_uid
↔
profiles.id
```

---

# Pre-CRM Data Model

Existing acquisition/revenue tables include:

- `staged_leads`
- `lead_events`
- `spam_log`
- `abuse_events`
- `outreach`

The existing Pre-CRM engine is intentionally preserved and reused.

Later phases should extend it rather than rebuild it.

---

# Product Events

Current approved product events:

- `signup`
- `login`
- `onboarding_started`
- `onboarding_completed`
- `dashboard_viewed`

Endpoint:

```text
POST /api/events
```

Product events are persisted server-side after Firebase verification.

---

# Current Web APIs

Implemented:

```text
POST /api/auth/sync-profile
POST /api/onboarding
POST /api/events
```

Detailed contracts:

```text
Docs/Architecture/API_SPEC.md
```

---

# Authentication

Current authentication supports:

- email/password signup
- email/password login
- Google authentication
- logout
- Firebase auth-state tracking

Protected customer writes use:

```text
Browser
→ Firebase
→ Firebase ID Token
→ Next.js Server API
→ Firebase Admin
→ Supabase
```

Supabase service-role credentials never belong in browser code.

---

# Local Development

## Repository Root

The CostPilot root uses:

```text
npm
```

Typical dependency installation:

```bash
npm install
```

Typical root build:

```bash
npm run build
```

---

# Web App Development

Move into:

```bash
cd Product/Web_App
```

Install dependencies:

```bash
pnpm install
```

Run development server:

```bash
pnpm dev
```

Run cold-start type validation:

```bash
npm run typecheck
```

Run production build:

```bash
./node_modules/.bin/next build --webpack
```

Use the actual scripts defined in `Product/Web_App/package.json` if they change later.

---

# Web App Tests

Current tests include:

- profile synchronization
- onboarding persistence
- product events
- acquisition foundation

Example:

```bash
node --test tests/*.mjs
```

---

# Root / Automation Validation

Build root code before running tests that depend on `dist/`:

```bash
npm run build
```

Existing automation tests live under:

```text
Automation/n8n/Tests/
```

Generated JavaScript should remain under:

```text
dist/
```

Do not manually copy build output into source folders.

---

# Local Services

Current local services may include:

## n8n

```text
http://localhost:5678
```

## MX Service

```text
http://localhost:9001
```

MX health:

```text
GET /health
```

## Supabase

Hosted Supabase is the active source of truth for CostPilot data.

Local Supabase runtime/state is not required for the current recruiter demo. Keep migration SQL files in Git, but keep local Supabase cache/temp files ignored.

---

# Environment Variables

Actual secret values must never be committed to documentation.

Common configuration names may include:

## Firebase Client

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

## Server

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON
```

## Integrations

Examples:

```text
GEMINI_API_KEY
HUBSPOT_ACCESS_TOKEN
SLACK_WEBHOOK_URL
BREVO_API_KEY
HOOKDECK_API_KEY
HOOKDECK_SIGNING_SECRET
```

Use local/deployment secret configuration for actual values.

---

# Security Principles

- never expose Supabase service-role credentials in browser code
- verify Firebase ID tokens server-side
- keep RLS enabled
- do not commit `.env` secret values
- do not print secrets in logs
- avoid production external side effects during local testing
- use deterministic/mocked tests where practical

---

# Existing Pre-CRM Capabilities

The repository already contains working implementations for:

- lead sanitization
- anti-abuse
- email verification
- lead deduplication
- company enrichment
- jurisdiction filtering
- Gemini ICP scoring
- nurture routing
- nurture generation
- signal-based scraping
- MX validation
- outbound qualification
- AI outreach
- outreach persistence
- HubSpot synchronization
- Slack notifications
- Brevo send paths
- reply-to-deal processing

Future development must reuse or extend these systems.

---

# Duplicate Feature Prevention

Before implementing new functionality:

```text
Search
→ Reuse
→ Extend
→ Adapt
→ Refactor
→ Create New
```

Do not create duplicate implementations merely because an existing feature lives in another folder.

This rule is particularly important for:

- qualification
- lead validation
- automation
- CRM logic
- acquisition
- outreach
- customer identity
- product events

---

# Project Memory

Primary project-memory documents:

```text
CODEX.md
TASK.md
STATE.md
ARCHITECTURE.md
Docs/Architecture/API_SPEC.md
CHANGELOG.md
README.md
FILE_STRUCTURE.md
```

Their roles:

- `CODEX.md` — development rules
- `TASK.md` — approved execution roadmap
- `STATE.md` — current system state
- `ARCHITECTURE.md` — implemented architecture
- `API_SPEC.md` — technical contracts
- `CHANGELOG.md` — completed history
- `README.md` — project overview
- `FILE_STRUCTURE.md` — repository navigation

---

# Autonomous Development

Codex may execute `TASK.md` sequentially under the rules in `CODEX.md`.

Required workflow:

```text
Audit
→ Reuse
→ Implement
→ Test
→ Fix
→ Retest
→ Integration Test
→ Update Project Memory
→ Proceed
```

Codex must never proceed past a failed validation gate.

Major architecture/product/strategy decisions still require user approval.

---

# Major Phase Audits

Before a major phase:

perform a capability audit when overlap with existing functionality is possible.

After a major phase:

perform a full system audit covering:

- architecture correctness
- duplicate implementations
- regression safety
- security
- schema consistency
- API consistency
- tests/builds
- project-memory accuracy

A major phase should not advance until this audit passes.

---

# Current Roadmap Position

```text
Phase 1 — COMPLETE
Website + Authentication

Phase 2 — COMPLETE
Supabase Data Layer

Phase 3 — COMPLETE
Acquisition Layer

Phase 3.1 — COMPLETE
Unified Acquisition Foundation

Phase 3.2 — COMPLETE
Attribution Data Model + Persistence

Phase 3.3 — COMPLETE
Acquisition Capture + Existing Engine Integration

Phase 3.4 — COMPLETE
Partner + Creator + Referral Acquisition Engines

Phase 3.5 — COMPLETE
Attribution Resolver + Acquisition Analytics Foundation

Phase 3.6 — COMPLETE
Phase 3 Full Integration Validation + Closure

Phase 4 — COMPLETE
AI Lead Intelligence + Qualification

Phase 5 — COMPLETE
Sales Automation + Routing

Phase 6 — COMPLETE
Product Intelligence + Activation + Billing

Phase 7 — COMPLETE
Retention + Expansion
```

Later major phases include:

- GTM Analytics + Retool Command Center UI completion
- Final closed-loop validation and portfolio readiness

Detailed execution is maintained in:

`TASK.md`

---

# Product Direction

CostPilot should evolve as one connected revenue lifecycle:

```text
Multiple Acquisition Engines
→ Unified Attribution
→ Lead / Customer Identity
→ Qualification
→ Sales
→ Product
→ Activation
→ Retention
→ Expansion
→ Analytics
```

The goal is not to accumulate isolated demo features.

The goal is to demonstrate one coherent, measurable, automated revenue operating system.
```
