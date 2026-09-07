# CostPilot — CHANGELOG.md

## Purpose

This file records meaningful completed changes in CostPilot.

Only implemented and validated work should be listed here.

Do not use this file for future plans.

Future work belongs in `TASK.md`.

---

# Unreleased

## Single-Page Product Simplification

Status:

IMPLEMENTED LOCALLY

Changed:

- simplified visible customer navigation to `Dashboard` and `Settings`
- merged provider setup, n8n instrumentation, usage/cost telemetry, workflow activity, activation/PQL summary, plan context, and roadmap into the primary dashboard story
- added `POST /api/product/test-run` so the authenticated dashboard can trigger the existing `CostPilot Product/PQL Test` n8n webhook with server-side account/workspace context
- kept advanced budgets, alerts, recommendations, health, expansion, risk, and RevOps concepts as backend/internal or roadmap framing instead of separate primary customer pages

## Dynamic RevOps Signal Account Context

Status:

IMPLEMENTED LOCALLY

Changed:

- removed `COSTPILOT_REVOPS_SIGNAL_ACCOUNT_ID` from the RevOps n8n runtime dependency
- updated `CostPilot RevOps Signal Orchestration` to generate/discover signals across eligible accounts
- added an actionable-signal guard so no-signal runs finish clearly without calling HubSpot or Slack
- kept health/risk/expansion-style signals as backend-only by filtering the workflow to current product/plan/usage signal types

## Final Core Cleanup + Portfolio Polish

Status:

IMPLEMENTED LOCALLY

Changed:

- tightened recruiter-facing README/STATE wording so PayU, retention, expansion, and risk are not presented as finished customer-facing production modules
- replaced visible dashboard `prototype` wording with clearer AI telemetry language
- archived the older standalone LiteLLM/DeepSeek prototype workflow under `Automation/n8n/Archive/`
- kept `CostPilot Product/PQL Test` as the flagship product telemetry workflow
- removed ignored local/generated artifacts and unused placeholder public assets

## Dynamic Product/PQL Account Context

Status:

IMPLEMENTED LOCALLY

Changed:

- removed hardcoded workspace/account context from `CostPilot Product/PQL Test`
- added `Normalize Product Account Context` with a clear `missing_account_context` failure
- added a safe webhook input so each test execution can receive `account_id` and `workspace_id`
- updated usage ingestion to accept dynamic account/workspace context and reject mismatches
- updated dashboard `Copy for n8n` output to include the authenticated account/workspace ID

## Real n8n Integration UX + Product/PQL Test Workflow

Status:

IMPLEMENTED LOCALLY

Added:

- real dashboard provider modal titled `Instrument Your AI Workflow`
- one primary `Copy for n8n` integration configuration for `/api/product/usage/ingest`
- isolated n8n workflow export `Automation/n8n/Prototype/costpilot-product-pql-test.workflow.json`

Validated:

- n8n execution `257` ran Gemini once and ingested real usage telemetry
- Gemini usage captured 37 total tokens with `$0` estimated cost
- retrying the same `usage_event_id` returned `200 deduplicated`
- trusted product events emitted: `usage_synced`, `ai_usage_recorded`, `workflow_run_observed`, `first_cost_data_received`
- activation state reflects provider connected + usage synced with activation score `60`
- `pnpm typecheck`
- `pnpm test`
- `pnpm exec next build --webpack`

## Website Signup → Pre-CRM Bridge

Status:

IMPLEMENTED LOCALLY

Added:

- server-side website signup lead payload builder for first-time onboarding completion
- stable `signup-<firebase_uid>-<account_id>` Pre-CRM event ID
- `COSTPILOT_PRECRM_INGEST_URL` web app environment variable
- richer onboarding GTM fields stored through the existing `onboarding_responses.raw_answers`

Preserved:

- login does not create leads
- repeated onboarding for an already-completed account skips lead ingestion
- n8n webhook contract stays `hookdeck-lead-ingest`
- Pre-CRM dedupe continues to use `$json.event_id`

Validated:

- `pnpm typecheck`
- `pnpm test`
- `pnpm exec next build --webpack`

## Phase 8 — Final E2E + Portfolio Readiness Audit

Status:

IN VALIDATION

Validated:

- local CostPilot web/API server responds on `localhost:3000`
- Docker runtime health for `revops_n8n`, `costpilot_litellm`, and `revops_mx`
- hosted Supabase table/view API access for product intelligence and Retool-facing views
- migrations `01` through `39` are applied to hosted Supabase project `uivrfaqghtgawgyesnap`
- real DeepSeek/LiteLLM usage ingestion reaches CostPilot and deduplicates by stable `usage_event_id`
- RevOps signal orchestration has persisted successful manual executions in n8n

Identified:

- `~/Documents/CostPilot` is not currently initialized as a Git repository
- Brevo API key is present, but Brevo currently rejects the caller IP with `401`
- `docker-compose.yml` still uses the floating n8n `latest` image tag
- older architecture docs still contain local-Supabase/Pre-CRM-era references

---

## Phase 6 — Product Events + Lifecycle Intelligence Hardening

Status:

COMPLETE

Added:

- `Data/Supabase/Migrations/37_product_event_lifecycle_intelligence.sql`

Implemented:

- additive `product_events` envelope fields for retry-safe `event_id`, explicit `occurred_at`, and `event_trust_level`
- expanded canonical event allowlist for provider, usage, workflow, budget, allowance, alert, recommendation, billing, and engagement lifecycle signals
- server-assigned trusted/untrusted event boundary
- idempotent event lookup before product-event inserts when `event_id` is present
- compatibility fallback so current event tracking still works before migration 37 is applied to hosted Supabase
- lifecycle signal emission from existing provider, budget, alert, recommendation, and real AI usage paths without creating duplicate lifecycle systems

Validated:

- Web App `pnpm typecheck`
- Web App `pnpm test`
- Web App `pnpm exec next build --webpack`
- hosted Supabase REST connectivity
- hosted migration 37 applied and present in remote migration history
- trusted and untrusted product events persist with stable `event_id`, `occurred_at`, and `event_trust_level`
- duplicate `event_id` insert returns one logical event
- existing DeepSeek usage ingestion retry returns `deduplicated` without adding another usage record
- account activation, health, expansion, risk, and Retool-facing lifecycle views remain queryable
- revops_n8n, costpilot_litellm, revops_mx, n8n to LiteLLM, and n8n to hosted Supabase connectivity

## Phase 5 — Complete Real Product Experience

Status:

COMPLETE

Added:

- `Data/Supabase/Migrations/36_provider_usage_limits.sql`
- `Product/Web_App/app/api/product/providers/route.ts`
- `Product/Web_App/app/api/product/provider-limits/route.ts`

Implemented:

- real authenticated `/dashboard` as the customer-facing product dashboard backed by hosted Supabase data
- final customer navigation: Overview, Workflows, Usage / Costs, Providers, Budgets, Alerts, Recommendations, and Settings
- real workflow/run attribution from `usage_records` metadata, including provider, model, execution, node, tokens, cost, and latency
- real Usage / Costs filtering by provider, model, workflow, and period
- real provider management for DeepSeek/LiteLLM with add, disconnect, reconnect, and soft-remove behavior
- provider usage allowance tracking for tokens, requests, and cost credits across daily, weekly, and monthly periods
- provider quota consumption, remaining allowance, reset period, and lightweight runway messaging
- minimal Settings area for workspace, plan, provider, usage-control, security, and logout context
- strict `/dashboard` real-data behavior while retaining isolated synthetic `/demo`
- controlled cleanup of one confirmed zero-cost DeepSeek prototype `usage_records` row

Validated:

- hosted Supabase migration 36 applied and marked applied
- hosted DeepSeek monthly token limit persisted and calculated from one real costed `usage_records` row
- Web App `pnpm typecheck`
- Web App `pnpm test`
- Web App `pnpm exec next build --webpack`

## Phase 10 — Historical Demo Data + Portfolio Demo Readiness

Status:

COMPLETE

Added:

- `Product/Web_App/scripts/phase10-demo-harness.mjs`
- `Data/Supabase/Migrations/29_phase10_runtime_performance.sql`
- `Data/Supabase/Migrations/30_phase10_account_health_qualification_reuse.sql`
- `Data/Supabase/Migrations/31_phase10_gtm_funnel_optimization.sql`
- `Data/Supabase/Migrations/32_phase10_current_sales_queue_optimization.sql`
- `Data/Supabase/Migrations/33_phase10_gtm_qualification_summary_optimization.sql`
- `supabase/config.toml`
- `Portfolio/Phase10_Demo_State.md`

Implemented:

- deterministic hosted Phase 10 cohort version `phase10_v1` over canonical acquisition, qualification, sales, product, billing, and health tables
- hosted-safe `seed`, `reset`, `reseed`, `validate`, `benchmark`, and `summary` harness commands scoped to `phase10_demo_*` synthetic records
- primary Loom-safe synthetic records for partner-led closed loop, outbound SQL, expansion, and budget-pressure stories
- direct `gtm_qualification_summary` aggregation from latest persisted qualification evaluations to remove the remaining slow nested qualification path
- executive, funnel, sales-queue, product, and health analytics performance corrections without changing existing Retool-facing summary contracts
- hosted demo freeze reference documenting commands, stable records, expected state, and unsupported metrics

Validated:

- hosted `CostPilot Demo` Phase 10 synthetic data persisted without reseeding legacy/non-demo data
- hosted `gtm_executive_summary` benchmark reduced to `1284ms`
- hosted `gtm_qualification_summary` benchmark reduced to `209ms`
- hosted `gtm_lifecycle_funnel` benchmark `482ms`
- hosted `gtm_product_summary` benchmark `177ms`
- hosted `gtm_customer_health_summary` benchmark `174ms`
- hosted Phase 10 validation for:
  - `phase10_demo_partner_anchor`
  - `phase10_demo_partner_anchor_lead`
  - `phase10_demo_outbound_sql_1`
  - `phase10_demo_referral_expand_1`
  - `phase10_demo_budget_pressure_1`
- root `npm run build`
- Web App `npm run typecheck`
- Web App `npm run build -- --webpack`
- Web App `node --test tests/*.mjs`
- `Automation/n8n/Tests/*.cjs`

## Phase 9 — Closed-Loop Validation Harness

Status:

COMPLETE

Added:

- `Product/Web_App/tests/phase9-closed-loop-runtime.test.mjs`
- `Data/Supabase/Migrations/28_gtm_executive_summary_sales_summary_reuse.sql`

Implemented:

- deterministic Phase 9 synthetic cohort coverage for lead, account, activation, billing, health, expansion, analytics, and Retool-facing queue validation
- environment-gated Supabase runtime tests so local regression runs no longer fail hard when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are unavailable
- Supabase seed-path correction in `Data/Supabase/Config/config.toml` so `db.seed.sql_paths` points at the committed synthetic seed file

Validated:

- root `npm run build`
- Web App `pnpm typecheck`
- Web App `npm run build -- --webpack`
- Web App `node --test tests/*.mjs`
- `Automation/n8n/Tests/*.cjs`
- `Revops/AI_Qualification/tests/*.mjs` with runtime coverage skipped cleanly when Supabase env is absent
- `Revops/Sales_Routing/tests/*.mjs` with runtime coverage skipped cleanly when Supabase env is absent
- hosted `CostPilot Demo` Supabase Phase 9 closed-loop runtime validation
- hosted `public.gtm_executive_summary` query returns without timeout after summary-view reuse optimization

## Phase 8 — GTM Analytics + Retool RevOps Command Center Backend

Status:

BACKEND COMPLETE — RETOOL UI PENDING

Added:

- `Data/Supabase/Migrations/25_gtm_analytics_retool_backend.sql`
- `Data/Supabase/Migrations/26_gtm_executive_summary_optimization.sql`
- `Data/Supabase/Migrations/27_gtm_customer_health_summary_optimization.sql`
- `Product/Web_App/tests/gtm-analytics-runtime.test.mjs`

Implemented:

- canonical GTM analytics read models spanning acquisition, qualification, sales, product, billing, and retention domains
- lifecycle funnel analytics over lead, account, activation, payment, health, and expansion stages
- Retool-ready acquisition conversion, touch-mix, qualification distribution, sales workload, product summary, health summary, and trend views
- executive GTM summary contracts that return `NULL` for unavailable churn and retention metrics rather than fabricating values
- append-only corrective migrations to keep executive and health summary queries fast under growing synthetic test data
- hosted Supabase alignment for the analytics migration chain through `27`

Validated:

- root `npm run build`
- Web App `npm run typecheck`
- Web App `npm run build -- --webpack`
- Web App `node --test tests/*.mjs`
- `Revops/AI_Qualification/tests/qualification-runtime.test.mjs`
- `Revops/Sales_Routing/tests/sales-routing-runtime.test.mjs`
- `Automation/n8n/Tests/*.cjs`
- local Phase 8 migration application
- hosted Phase 8 migration application
- local Supabase schema lint
- GTM analytics runtime coverage against the hosted demo project
- empty-state-safe analytics responses with no fabricated chart data
- duplicate analytics audit confirming no second attribution, qualification, sales queue, product-calculation, health, or billing system was introduced
- Retool read-contract readiness using existing Supabase-backed resources only

## Phase 7 — Retention + Expansion

Status:

COMPLETE

Added:

- `Data/Supabase/Migrations/24_retention_expansion.sql`
- `Customer Success/Retention/retention-contract.ts`
- `Product/Web_App/tests/customer-health-runtime.test.mjs`

Implemented:

- canonical account-health signal assembly over product usage, activation, billing, engagement, qualification, and sales context
- append-only `customer_health_evaluations` history with idempotent evaluation fingerprints
- explainable `evaluate_account_health(...)` runtime for health, lifecycle, churn-risk, expansion state, reasons, and recommended actions
- authoritative churn support through cancellation fields on `account_plans`
- account-centric operational queue views for at-risk, dormant, payment-risk, recently-activated, intervention-needed, and expansion-ready accounts
- retention metrics foundation through `customer_health_metrics`
- expansion handoff compatibility through recommended lead and owner outputs that reuse existing Phase 5 routing
- health refresh hooks inside existing product-event, product-intelligence, and PayU billing flows

Validated:

- root `npm run build`
- Web App `npm run typecheck`
- Web App `npm run build -- --webpack`
- Web App `node --test tests/*.mjs`
- `Revops/AI_Qualification/tests/qualification-runtime.test.mjs`
- `Revops/Sales_Routing/tests/sales-routing-runtime.test.mjs`
- `Automation/n8n/Tests/*.cjs`
- local Phase 7 migration application
- local Supabase schema lint

## Phase 6 — Product Intelligence + Activation + Billing

Status:

COMPLETE

Added:

- `Data/Supabase/Migrations/23_product_intelligence_activation_billing.sql`
- `Product/Web_App/lib/billing-plans.ts`
- `Product/Web_App/lib/server/billing-service.ts`
- `Product/Web_App/lib/server/product-intelligence-core.ts`
- `Product/Web_App/lib/server/product-intelligence-service.ts`
- `Product/Web_App/app/api/product/overview/route.ts`
- `Product/Web_App/app/api/product/demo-sync/route.ts`
- `Product/Web_App/app/api/product/budget/route.ts`
- `Product/Web_App/tests/billing-service.test.mjs`
- `Product/Web_App/tests/product-intelligence-core.test.mjs`
- `Product/Web_App/tests/product-intelligence-service.test.mjs`
- `Product/Web_App/tests/product-intelligence-runtime.test.mjs`

Implemented:

- canonical provider connection, usage/cost, budget, alert, recommendation, billing-transaction, and account-plan persistence
- demo-fixture provider sync through the existing authenticated Web App runtime
- current-month spend, provider attribution, service attribution, budget status, activation, and dashboard overview SQL views
- deterministic forecast, budget-threshold, projected-overrun, and spend-spike logic
- deterministic recommendation generation from observed spend and budget signals
- 100-point activation model with the `>= 80` activated threshold
- Phase 4 PQL extension through `product_qualified` and `product_activated`
- PayU TEST checkout persistence, verified webhook idempotency, and account-plan activation
- dashboard migration from hardcoded spend cards to persisted product and billing data

Validated:

- root `npm run build`
- Web App `npm run typecheck`
- Web App `npm run build -- --webpack`
- Web App `node --test tests/*.mjs`
- `Revops/AI_Qualification/tests/qualification-runtime.test.mjs`
- `Revops/Sales_Routing/tests/sales-routing-runtime.test.mjs`
- `Automation/n8n/Tests/*.cjs`
- local Phase 6 migration application
- local Supabase schema lint

Technical debt:

- PayU TEST dashboard webhook-registration visibility remains inconsistent, but verified webhook routing and hash validation are working and Phase 6 does not depend on that dashboard view rendering correctly

## PayU TEST Billing Foundation

Status:

COMPLETE

Added:

- `Product/Web_App/app/api/billing/payu/checkout/route.ts`
- `Product/Web_App/app/api/billing/payu/webhook/route.ts`
- `Product/Web_App/lib/server/payu.ts`
- `Product/Web_App/tests/payu-billing.test.mjs`

Implemented:

- PayU TEST-only server configuration and validation
- server-side PayU request hash generation
- server-side reverse-hash webhook verification
- minimal authenticated checkout payload generation
- normalized webhook result with future idempotency-key support

Preserved:

- no live billing mode
- no live recurring billing mode
- no browser-trusted payment success state

## Phase 5 — Sales Automation + Routing

Status:

COMPLETE

Added:

- `Data/Supabase/Migrations/22_sales_routing.sql`
- `Revops/Sales_Routing/routing-contract.ts`
- `Revops/Sales_Routing/tests/sales-routing-runtime.test.mjs`
- `public.sales_reps`
- `public.sales_assignments`
- `public.sales_assignment_history`
- `public.sales_routing_signal_assembly`
- `public.route_lead_to_sales(...)`
- `public.override_sales_assignment(...)`
- `public.update_sales_assignment_sync(...)`
- sales queue views for current, SDR, AE, unassigned, hot, and handoff operations

Integrated:

- existing qualification outputs into one deterministic routing contract
- existing inbound qualification workflow with inbound and outbound sales-routing evaluation
- existing HubSpot nodes with CRM sync-state tracking
- existing Slack alerts with assignment and routing context
- existing reply-to-deal workflow with qualification refresh, routing refresh, and AE handoff support

Implemented:

- deterministic SDR / AE ownership assignment
- SQL-only sales eligibility guardrails
- direct AE routing for enterprise or urgent high-intent SQL leads
- SDR-to-AE handoff on reply/deal activity
- idempotent routing and duplicate-assignment prevention
- manual override persistence and retry-state tracking

Preserved:

- canonical qualification runtime ownership in the existing n8n Gemini path
- existing inbound qualified vs nurture behavior
- existing outbound `ready_to_push` gating behavior
- existing HubSpot, Slack, outreach, and reply/deal infrastructure

Validation completed for:

- root `npm run build`
- Web App `npm run typecheck`
- Web App `npm run build -- --webpack`
- Web App `node --test tests/*.mjs`
- all deterministic `Automation/n8n/Tests/*.cjs`
- workflow JSON regeneration and JSON validation
- local Supabase migration application
- qualification + sales-routing runtime REST/RPC tests
- RLS and security-definer sales-routing RPC checks

## Phase 4 — AI Lead Intelligence + Qualification

Status:

COMPLETE

Added:

- `Data/Supabase/Migrations/21_qualification_evaluations.sql`
- `Revops/AI_Qualification/qualification-contract.ts`
- `Revops/AI_Qualification/tests/qualification-runtime.test.mjs`
- `public.qualification_evaluations`
- `public.lead_qualification_signal_assembly`
- `public.evaluate_lead_qualification(...)`
- `public.lead_current_qualification`
- `public.qualification_channel_metrics`

Integrated:

- existing Gemini `icp_score` and `buying_intent` outputs into one explainable qualification contract
- acquisition, engagement, onboarding, profile, account, and product signals into one assembled evaluation surface
- qualification re-evaluation into the existing inbound CRM-ready, nurture, outbound-ready, outreach-sent, and reply-to-deal paths

Implemented:

- formal MQL derivation on top of the existing fit/intent engine
- formal SQL derivation that reuses CRM readiness, outbound readiness, and reply/deal engagement
- lightweight explainable priority scoring and tiers
- explicit PQL deferral through `insufficient_product_signals`

Preserved:

- canonical runtime Gemini scorer ownership in `Automation/n8n/Code_Nodes/`
- existing inbound qualified vs nurture behavior
- existing outbound `ready_to_push` gating behavior
- existing HubSpot, Slack, nurture, and reply/deal infrastructure

Validation completed for:

- root `npm run build`
- Web App `npm run typecheck`
- Web App `npm run build -- --webpack`
- Web App `node --test tests/*.mjs`
- all deterministic `Automation/n8n/Tests/*.cjs`
- workflow JSON regeneration and JSON validation
- local Supabase migration application
- qualification runtime REST/RPC tests
- RLS and security-definer qualification RPC checks

## Phase 3 — Acquisition Layer

### Phase 3.1 — Unified Acquisition Foundation

Status:

COMPLETE

Added:

- canonical acquisition channel taxonomy
- unified `AcquisitionEnvelope`
- acquisition metadata normalization
- validation for acquisition payloads
- inbound acquisition mapping
- outbound acquisition mapping
- PLG acquisition mapping
- partner-compatible acquisition fields
- creator-compatible acquisition fields
- referral-compatible acquisition fields

Created:

- `Acquisition/Shared/acquisition-foundation.ts`
- `Acquisition/Shared/tests/acquisition-foundation.test.mjs`
- `Product/Web_App/lib/acquisition.ts`
- `Product/Web_App/tests/acquisition-foundation.test.mjs`

Canonical acquisition channels:

- inbound
- plg
- outbound
- partner
- creator
- referral

Unified acquisition metadata now supports:

- channel
- source
- source_id
- medium
- campaign
- referrer
- utm_source
- utm_medium
- utm_campaign
- utm_content
- utm_term
- partner_id
- creator_id
- referral_id

Validation completed for:

- normalization
- channel validation
- inbound mapping
- outbound mapping
- PLG mapping
- partner mapping
- creator mapping
- referral mapping
- root build
- Web App typecheck
- Web App webpack production build
- acquisition tests
- existing Pre-CRM regression tests

Database changes:

None.

Phase 3.1 was intentionally implemented as a contract and normalization foundation only.

### Phase 3.2 — Attribution Data Model + Persistence

Status:

COMPLETE

Added:

- `public.acquisition_touches`
- immutable first-touch persistence
- last-touch upsert behavior
- interaction touch history
- server-side acquisition attribution service
- profile/account/lead/Firebase identity support inside the shared attribution layer

Created:

- `Data/Supabase/Migrations/17_acquisition_touches.sql`
- `Product/Web_App/lib/server/acquisition-attribution-core.ts`
- `Product/Web_App/lib/server/acquisition-attribution-service.ts`
- `Product/Web_App/tests/acquisition-attribution-service.test.mjs`

Validation completed for:

- local migration application
- local schema lint
- first-touch immutability
- interaction persistence
- linkage behavior
- Web App typecheck
- Web App webpack build
- root build
- Web App tests
- Pre-CRM regression tests

### Phase 3.3 — Acquisition Capture + Existing Engine Integration

Status:

COMPLETE

Added:

- browser-safe acquisition capture for PLG entry points
- acquisition context persistence across landing → auth → profile sync
- sync-profile acquisition-context ingestion
- product-event inheritance of stored acquisition context
- lead-engine acquisition-touch capture at the existing `get_or_create_lead` persistence point
- inbound and outbound acquisition-touch creation without redesigning the 53-node workflow
- outbound outreach canonicality audit confirming the active runtime remains in the n8n code nodes

Created:

- `Product/Web_App/lib/acquisition-browser.ts`
- `Product/Web_App/components/acquisition-capture.tsx`
- `Product/Web_App/tests/acquisition-browser.test.mjs`
- `Data/Supabase/Migrations/18_lead_acquisition_capture.sql`

### Phase 3.4 — Partner + Creator + Referral Acquisition Engines

Status:

COMPLETE

Added:

- unified partner / creator / referral attribution capture on top of the existing `AcquisitionEnvelope`
- entity persistence using the same attribution architecture rather than channel-specific systems
- referral-link/code compatibility through normalized browser capture aliases
- automatic entity upsert support inside the acquisition attribution service

Created:

- `Data/Supabase/Migrations/19_acquisition_entities.sql`
- `Product/Web_App/lib/server/acquisition-entities-core.ts`
- `Product/Web_App/lib/server/acquisition-entities-service.ts`
- `Product/Web_App/tests/acquisition-entities-service.test.mjs`

Validation completed for:

- partner attribution capture
- creator attribution capture
- referral attribution capture
- customer / lead linkage regression safety
- local migration application
- local schema lint
- Web App tests
- acquisition tests
- Pre-CRM regression tests

### Phase 3.5 — Attribution Resolver + Acquisition Analytics Foundation

Status:

COMPLETE

Added:

- explainable resolver behavior for first-touch, last-touch, and latest interaction
- identity-lineage SQL stitched across lead, Firebase UID, profile, and account where supported
- analytics-ready views built directly on `acquisition_touches`
- stable operational surfaces for later Retool consumption without introducing a separate warehouse

Created:

- `Data/Supabase/Migrations/20_acquisition_resolver_analytics.sql`
- `Product/Web_App/lib/server/acquisition-resolver-core.ts`
- `Product/Web_App/tests/acquisition-resolver-core.test.mjs`

Validation completed for:

- resolver logic
- first-touch preservation
- last-touch resolution
- interaction history preservation
- local migration application
- local schema lint
- Web App tests
- acquisition tests
- workflow builder validation
- Pre-CRM regression tests

### Phase 3.6 — Phase 3 Full Integration Validation + Closure

Status:

COMPLETE

Validated:

- root build
- Web App typecheck
- Web App webpack production build
- Web App tests
- acquisition tests
- Pre-CRM regression tests
- workflow JSON validity
- workflow builder regeneration in a temp copy
- local Supabase migrations 19–20
- local Supabase schema lint
- MX tests
- security boundary review

---

# Phase 2 — Supabase Data Layer

Status:

COMPLETE

---

## Phase 2.1 — Data Model Audit + Design

Completed:

- audited existing Supabase Pre-CRM schema
- identified reusable lead/customer architecture
- separated Pre-CRM lead identity from product/customer identity
- designed Firebase UID → Supabase profile model
- designed:
  - profiles
  - accounts
  - account_members
  - onboarding_responses
  - product_events
- defined server-side identity/security boundary

No runtime database changes were introduced in this sub-phase.

---

## Phase 2.2 — Core Customer Schema

Added:

`Data/Supabase/Migrations/16_core_customer_model.sql`

Created customer/product tables:

- `profiles`
- `accounts`
- `account_members`
- `onboarding_responses`
- `product_events`

Added:

- foreign keys
- indexes
- uniqueness constraints
- timestamps
- RLS
- service-role protected access pattern
- first-touch profile fields

Existing migrations 01–15 remained unchanged.

Validation included:

- migration application
- foreign keys
- indexes
- RLS
- service-role policies
- Supabase lint
- Pre-CRM schema regression safety

---

## Phase 2.3 — Firebase → Supabase Profile Synchronization

Added secure Firebase → Supabase customer identity synchronization.

Created:

- `Product/Web_App/app/api/auth/sync-profile/route.ts`
- `Product/Web_App/lib/server/firebase-admin.ts`
- `Product/Web_App/lib/server/supabase-admin.ts`
- `Product/Web_App/lib/server/profile-sync-core.ts`
- `Product/Web_App/lib/profile-sync.ts`
- `Product/Web_App/tests/profile-sync.test.mjs`

Added:

- Firebase Admin token verification
- server-side Supabase service-role access
- profile upsert keyed by `firebase_uid`
- last-login updates
- email/password signup synchronization
- email/password login synchronization
- Google auth synchronization
- idempotent repeated profile synchronization

Security validated:

- Firebase token verification server-side
- Supabase service-role isolation
- no secret leakage
- existing RLS preserved

---

## Phase 2.4 — Onboarding Persistence + Account Model

Added:

`POST /api/onboarding`

Created:

- `Product/Web_App/app/api/onboarding/route.ts`
- `Product/Web_App/lib/server/onboarding-core.ts`
- `Product/Web_App/lib/server/onboarding-service.ts`
- `Product/Web_App/tests/onboarding-service.test.mjs`

Implemented:

- authenticated onboarding persistence
- profile resolution
- account creation
- account reuse
- account membership creation
- duplicate membership prevention
- first-user owner assignment
- onboarding response persistence
- onboarding status completion
- repeat-submission safety
- dashboard redirect after persistence

Persisted onboarding data includes:

- company size
- providers
- estimated monthly spend
- raw answers
- completion timestamp

Validation completed for:

- onboarding API
- account creation
- account reuse
- membership
- onboarding persistence
- idempotency
- existing profile sync compatibility
- TypeScript
- Next.js build
- tests

---

## Phase 2.5 — Product Event Engine

Added:

`POST /api/events`

Created:

- `Product/Web_App/app/api/events/route.ts`
- `Product/Web_App/lib/server/product-events-core.ts`
- `Product/Web_App/lib/server/product-events-service.ts`
- `Product/Web_App/lib/product-events.ts`
- `Product/Web_App/tests/product-events.test.mjs`

Implemented approved product events:

- `signup`
- `login`
- `onboarding_started`
- `onboarding_completed`
- `dashboard_viewed`

Added:

- server-side Firebase verification
- profile resolution
- account resolution
- event-name allowlist
- event-properties validation
- protected product-event persistence
- render-loop duplicate protection where appropriate

No additional database migration was required.

Validation completed for:

- all five event types
- profile/account resolution
- event API
- event allowlist
- payload validation
- TypeScript
- Next.js production build
- existing authentication/onboarding compatibility

---

## Phase 2.6 — Integration Validation + Closure

Validated full customer flow:

Firebase Authentication
→ Supabase Profile
→ Account
→ Membership
→ Onboarding Persistence
→ Product Events
→ Dashboard

Validated:

- profiles
- accounts
- account_members
- onboarding_responses
- product_events
- RLS
- Firebase verification
- service-role isolation
- browser-write protection
- Pre-CRM regression safety

Resolved final validation blockers:

### Web App cold-start typecheck

Added a reliable typecheck workflow that generates Next.js route types before running TypeScript validation.

### MX deterministic testing

Improved MX testability using injected DNS resolver behavior.

Preserved compiled MX architecture under:

`dist/Automation/Local_Services/MX_Service/`

Final validation:

- root build PASS
- Web App typecheck PASS
- Next.js webpack build PASS
- profile sync tests PASS
- onboarding tests PASS
- product event tests PASS
- MX tests 8/8 PASS

Phase 2 officially closed.

---

# Phase 1 — Website + Authentication

Status:

COMPLETE

Implemented customer-facing Web App using:

- Next.js
- React
- TypeScript
- Firebase Authentication

Implemented routes:

- `/`
- `/signup`
- `/login`
- `/onboarding`
- `/dashboard`

Implemented:

- email/password signup
- email/password login
- Google authentication
- logout
- onboarding wizard
- dashboard access

Web App location:

`Product/Web_App/`

Validated:

- TypeScript
- Next.js production build
- routing
- Firebase imports
- environment-variable protection

---

# Repository Consolidation

Migrated the previous standalone Pre-CRM Engine into the CostPilot domain-based repository.

Major current locations include:

## Acquisition

`Acquisition/Signal_Outbound/`

Contains:

- scraper
- outreach logic
- fixtures

## Automation

`Automation/n8n/`

Contains:

- inbound workflow
- outbound reply workflow
- Code Nodes
- builders
- tests

Other automation areas include:

- Hookdeck
- Webhooks
- MX Service

## Data

`Data/Supabase/`

Contains:

- config
- migrations
- seed

## RevOps

`Revops/AI_Qualification/`

Contains reusable AI qualification logic.

Migration preserved existing behavior while reorganizing files by CostPilot domain responsibility.

---

# Pre-CRM Engine Validation

Existing Pre-CRM capabilities validated after repository migration:

- lead sanitization
- anti-abuse
- email verification
- enrichment
- jurisdiction filtering
- lead deduplication
- Gemini scoring
- nurture generation
- MX validation
- outbound gating
- scraper extraction
- outreach generation
- reply processing
- HubSpot handoff
- Slack notification paths
- Brevo send paths

Current inbound workflow:

`Automation/n8n/Inbound/lead-ingestion-qualification.workflow.json`

Validated structure:

- 53 nodes
- 45 connections

Current reply-to-deal workflow:

`Automation/n8n/Outbound/outbound-reply-to-deal.workflow.json`

Validated structure:

- 7 nodes
- 6 connections

---

# Infrastructure / Build Improvements

Standardized package-manager boundaries:

Repository root:

`npm`

Web App:

`pnpm`

Removed unnecessary root pnpm artifacts.

Preserved generated artifacts outside source directories.

Root TypeScript build outputs into:

`dist/`

Web App build outputs into:

`.next/`

Improved deterministic MX validation.

Improved Web App cold-start type validation.

---

# Security Improvements

Established security rules including:

- Firebase token verification server-side
- Supabase service-role access server-side only
- no service-role access from browser code
- RLS protection
- no secret values in documentation
- environment-variable names only in `.env.example`
- Git secret protection
- safe local testing without unintended production CRM/email/Slack actions

---

# Documentation Improvements

Established living project-memory documents:

- `CODEX.md`
- `TASK.md`
- `STATE.md`
- `ARCHITECTURE.md`
- `Docs/Architecture/API_SPEC.md`
- `CHANGELOG.md`
- `README.md`
- `FILE_STRUCTURE.md`

Documentation rule:

Implement
→ Test
→ Verify
→ Update project memory

Planned capabilities must not be documented as implemented.

---

# Current Development Position

Completed:

- Phase 1
- Phase 2
- Phase 3.1

Current next work:

Phase 6 — Product Intelligence + Activation + Billing

Current objective:

Product Signals / Activation
→ Billing / Spend Intelligence
→ Insights / Alerts
→ Lifecycle Readiness
