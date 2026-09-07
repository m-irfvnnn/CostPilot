# CostPilot — FILE_STRUCTURE.md

## Purpose

This file documents the meaningful repository structure of CostPilot.

It is a navigation and ownership guide.

It should describe:

- major domains
- important applications
- important services
- primary source locations
- responsibility boundaries

It should NOT list:

- every trivial source file
- generated artifacts
- `node_modules`
- `.next`
- compiled `dist` contents
- secret files
- temporary files

Update this document only when the repository structure meaningfully changes.

---

# 1. Repository Root

Primary repository:

`~/Documents/CostPilot/`

Current top-level structure:

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
├── Portfolio/
│
├── CODEX.md
├── TASK.md
├── STATE.md
├── ARCHITECTURE.md
├── CHANGELOG.md
├── README.md
├── FILE_STRUCTURE.md
│
├── package.json
├── package-lock.json
├── tsconfig.json
├── docker-compose.yml
└── .gitignore
```

Top-level folders are organized primarily by domain responsibility.

---

# 2. Root Project-Memory Files

## `CODEX.md`

Purpose:

Permanent AI development instructions.

Defines:

- autonomous-development rules
- validation gates
- security rules
- architecture rules
- duplicate-feature prevention
- documentation behavior
- stop/approval conditions

---

## `TASK.md`

Purpose:

Approved execution roadmap.

Defines:

- current development phase
- pending phases
- sequential execution tasks
- completion conditions

Codex should execute this file sequentially.

---

## `STATE.md`

Purpose:

Current implemented system state.

Tracks:

- active phase
- implemented capabilities
- system health
- known limitations
- next task

---

## `ARCHITECTURE.md`

Purpose:

Implemented system architecture.

Should contain only functionality that has been built and validated.

---

## `CHANGELOG.md`

Purpose:

Historical record of meaningful completed development.

---

## `README.md`

Purpose:

High-level entry point for developers, recruiters, and reviewers.

---

## `FILE_STRUCTURE.md`

Purpose:

Repository ownership and navigation reference.

---

# 3. Strategy Domain

Location:

```text
Strategy/
```

Purpose:

Business, GTM, positioning, market, ICP, persona, pricing, lifecycle, and strategic planning artifacts.

Possible responsibilities include:

- TAM / SAM / SOM
- ICP
- personas
- positioning
- messaging
- pricing strategy
- acquisition strategy
- customer lifecycle strategy
- GTM metrics

Strategy files should not contain runtime application logic.

---

# 4. Product Domain

Location:

```text
Product/
```

Purpose:

Customer-facing CostPilot product functionality.

Current primary application:

```text
Product/
└── Web_App/
```

---

# 5. Web Application

Location:

```text
Product/Web_App/
```

This is a self-contained Next.js application.

Important structure:

```text
Product/Web_App/
├── app/
├── components/
├── lib/
├── public/
├── tests/
│
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── next.config.mjs
├── postcss.config.mjs
├── components.json
└── .env.example
```

The Web App uses:

`pnpm`

Do not move its framework configuration to the repository root.

---

# 6. Web App Routes

Important route locations include:

```text
Product/Web_App/app/
├── page.tsx
├── signup/
├── login/
├── onboarding/
├── dashboard/
├── demo/
├── billing/
└── api/
```

Current user-facing routes include:

```text
/
 /signup
 /login
 /onboarding
 /dashboard
 /demo
```

---

# 7. Web App API Routes

Current API structure includes:

```text
Product/Web_App/app/api/
├── auth/
│   └── sync-profile/
├── billing/
│   └── payu/
│       ├── checkout/
│       └── webhook/
├── product/
│   ├── budget/
│   ├── demo-sync/
│   ├── overview/
│   ├── provider-limits/
│   ├── providers/
│   ├── recommendations/
│   └── usage/
├── onboarding/
└── events/
```

Implemented APIs:

```text
POST /api/auth/sync-profile
POST /api/onboarding
POST /api/events
POST /api/billing/payu/checkout
POST /api/billing/payu/webhook
GET /api/product/overview
GET /api/product/usage/ingest
POST /api/product/usage/ingest
POST /api/product/demo-sync
POST /api/product/budget
POST /api/product/providers
POST /api/product/provider-limits
POST /api/product/alerts
POST /api/product/recommendations
```

New Web App API routes should be created here unless architecture clearly requires another service.

Before creating a new route, search for an existing equivalent endpoint.

---

# 8. Web App Server Utilities

Important server-side logic is located under:

```text
Product/Web_App/lib/server/
```

Current responsibilities include:

- Firebase Admin initialization
- Supabase service-role access
- profile synchronization
- onboarding business logic
- product-event persistence
- acquisition attribution persistence
- PayU TEST billing helpers
- product intelligence services
- account plan and billing state services

Examples include:

```text
firebase-admin.ts
supabase-admin.ts
profile-sync-core.ts
onboarding-core.ts
onboarding-service.ts
product-events-core.ts
product-events-service.ts
acquisition-attribution-core.ts
acquisition-attribution-service.ts
payu.ts
billing-service.ts
product-intelligence-core.ts
product-intelligence-service.ts
```

Protected credentials must remain inside server-side execution paths.

---

# 9. Web App Client / Shared Helpers

Location:

```text
Product/Web_App/lib/
```

Current responsibilities include:

- Firebase client initialization
- authentication helpers
- profile synchronization client
- product-event client
- acquisition compatibility / normalization bridge

Important current files include:

```text
firebase.ts
auth.ts
profile-sync.ts
product-events.ts
acquisition.ts
```

Do not place service-role logic here if the module can enter the browser bundle.

---

# 10. Web App Tests

Location:

```text
Product/Web_App/tests/
```

Current test areas include:

- Firebase/profile synchronization
- onboarding persistence
- product events
- product intelligence and dashboard overview
- PayU TEST billing
- customer health and retention runtime
- Phase 9 closed-loop runtime validation
- Phase 10 hosted demo harness validation
- acquisition foundation
- acquisition attribution persistence
- browser acquisition capture

Examples:

```text
profile-sync.test.mjs
onboarding-service.test.mjs
product-events.test.mjs
product-intelligence-service.test.mjs
billing-service.test.mjs
customer-health-runtime.test.mjs
phase9-closed-loop-runtime.test.mjs
acquisition-foundation.test.mjs
acquisition-attribution-service.test.mjs
acquisition-browser.test.mjs
```

Future tests should remain close to the Web App when they validate Web App behavior.

---

# 11. Data Domain

Location:

```text
Data/
```

Purpose:

Persistent data-layer architecture.

Current primary system:

```text
Data/Supabase/
```

---

# 12. Supabase Structure

Current structure:

```text
Data/Supabase/
├── Config/
├── Migrations/
└── Seed/
```

Responsibilities:

## `Config/`

Supabase development configuration.

## `Migrations/`

Append-only database migrations.

## `Seed/`

Safe development seed data.

---

# 13. Supabase Migration Rules

Current migration history includes:

```text
01
→
33
```

Current important customer migration:

```text
16_core_customer_model.sql
17_acquisition_touches.sql
18_lead_acquisition_capture.sql
19_acquisition_entities.sql
20_acquisition_resolver_analytics.sql
21_qualification_evaluations.sql
22_sales_routing.sql
23_product_intelligence_activation_billing.sql
24_retention_expansion.sql
25_gtm_analytics_retool_backend.sql
26_gtm_executive_summary_optimization.sql
27_gtm_customer_health_summary_optimization.sql
28_gtm_executive_summary_sales_summary_reuse.sql
29_phase10_runtime_performance.sql
30_phase10_account_health_qualification_reuse.sql
31_phase10_gtm_funnel_optimization.sql
32_phase10_current_sales_queue_optimization.sql
33_phase10_gtm_qualification_summary_optimization.sql
24_retention_expansion.sql
25_gtm_analytics_retool_backend.sql
26_gtm_executive_summary_optimization.sql
27_gtm_customer_health_summary_optimization.sql
```

Future migrations must continue sequentially.

Example:

```text
17_*.sql
18_*.sql
...
```

Never modify a historical migration merely to add a later feature.

---

# 14. Current Pre-CRM Database Layer

Existing Supabase tables include:

```text
staged_leads
lead_events
spam_log
abuse_events
outreach
```

These belong to the operational lead/revenue intelligence architecture.

Do not create duplicate lead tables unless architecture explicitly requires them.

---

# 15. Current Customer / Product Database Layer

Existing tables include:

```text
profiles
accounts
account_members
onboarding_responses
product_events
provider_connections
usage_records
budgets
product_alerts
cost_recommendations
billing_transactions
account_plans
customer_health_evaluations
```

These belong to the customer/product identity model.

Future attribution tables should link into these models rather than replacing them.

Current implemented attribution persistence extends this layer with:

```text
acquisition_touches
```

Ownership:

- schema: `Data/Supabase/Migrations/17_acquisition_touches.sql`
- server persistence logic: `Product/Web_App/lib/server/acquisition-attribution-core.ts`
- service orchestration: `Product/Web_App/lib/server/acquisition-attribution-service.ts`
- regression tests: `Product/Web_App/tests/acquisition-attribution-service.test.mjs`

Current implemented lead-engine/browser capture extends this layer with:

- lead capture migration: `Data/Supabase/Migrations/18_lead_acquisition_capture.sql`
- partner / creator / referral entity migration: `Data/Supabase/Migrations/19_acquisition_entities.sql`
- resolver / analytics migration: `Data/Supabase/Migrations/20_acquisition_resolver_analytics.sql`
- Web App browser capture helper: `Product/Web_App/lib/acquisition-browser.ts`
- Web App capture component: `Product/Web_App/components/acquisition-capture.tsx`
- browser-capture regression tests: `Product/Web_App/tests/acquisition-browser.test.mjs`
- entity-registry helpers: `Product/Web_App/lib/server/acquisition-entities-*.ts`
- attribution resolver helper: `Product/Web_App/lib/server/acquisition-resolver-core.ts`
- entity/resolver regression tests:
  - `Product/Web_App/tests/acquisition-entities-service.test.mjs`
  - `Product/Web_App/tests/acquisition-resolver-core.test.mjs`

---

# 16. Acquisition Domain

Location:

```text
Acquisition/
```

Purpose:

Customer/lead acquisition engines and shared acquisition logic.

Current important structure:

```text
Acquisition/
├── Shared/
└── Signal_Outbound/
```

---

# 17. Shared Acquisition Foundation

Location:

```text
Acquisition/Shared/
```

Current structure includes:

```text
Acquisition/Shared/
├── acquisition-foundation.ts
└── tests/
    └── acquisition-foundation.test.mjs
```

Purpose:

Canonical acquisition normalization boundary.

Responsibilities include:

- channel taxonomy
- AcquisitionEnvelope
- normalization
- validation
- source mapping
- channel mapping

This should remain the canonical shared acquisition contract.

Do not create separate incompatible acquisition-envelope implementations elsewhere.

---

# 18. Signal-Based Outbound

Location:

```text
Acquisition/Signal_Outbound/
```

Current structure:

```text
Acquisition/Signal_Outbound/
├── Scraper/
├── Outreach/
└── Fixtures/
```

---

# 19. Signal Outbound — Scraper

Location:

```text
Acquisition/Signal_Outbound/Scraper/
```

Current responsibilities include:

- website crawling
- rendering
- extraction
- company/contact discovery
- normalization
- scraper types

Representative files include:

```text
index.ts
crawl.ts
extract.ts
render.ts
types.ts
```

Do not build a second scraper elsewhere without first auditing this implementation.

---

# 20. Signal Outbound — Outreach

Location:

```text
Acquisition/Signal_Outbound/Outreach/
```

Current responsibility:

AI-assisted outbound outreach generation.

Existing implementation includes:

```text
ai-outreach-generate.ts
```

n8n also contains active outreach prompt/parser logic.

Future work must determine the canonical runtime implementation before creating additional outreach generators.

---

# 21. Signal Outbound — Fixtures

Location:

```text
Acquisition/Signal_Outbound/Fixtures/
```

Purpose:

Safe test/demo acquisition inputs.

Fixtures should be preferred for local validation instead of paid/live acquisition activity where possible.

---

# 22. RevOps Domain

Location:

```text
Revops/
```

Purpose:

Revenue Operations, qualification, routing, and revenue intelligence logic.

Current important area:

```text
Revops/AI_Qualification/
Revops/Sales_Routing/
```

---

# 23. AI Qualification

Location:

```text
Revops/AI_Qualification/
```

Current implementation includes:

```text
ai-qualification-score.ts
qualification-contract.ts
tests/qualification-runtime.test.mjs
```

Important note:

The active n8n workflow also contains qualification Code Nodes.

Before extending AI qualification, audit both:

```text
Revops/AI_Qualification/
```

and:

```text
Automation/n8n/Code_Nodes/
```

Avoid creating duplicate scoring engines.

Canonical runtime ownership remains in the active n8n Code Nodes and inbound workflow.

Phase 4 extends that runtime with one qualification contract and one runtime-tested evaluation layer.

---

# 24. Sales Routing

Location:

```text
Revops/Sales_Routing/
```

Current implementation includes:

```text
routing-contract.ts
tests/sales-routing-runtime.test.mjs
```

This module defines the canonical TypeScript routing contract for the sales-assignment layer.

Runtime ownership still remains in Supabase RPCs plus the existing n8n workflows.

---

# 25. Automation Domain

Location:

```text
Automation/
```

Purpose:

Workflow orchestration, webhooks, services, and automation infrastructure.

Current structure includes:

```text
Automation/
├── n8n/
├── Hookdeck/
├── Webhooks/
└── Local_Services/
```

---

# 26. n8n Structure

Location:

```text
Automation/n8n/
```

Current structure:

```text
Automation/n8n/
├── Inbound/
├── Outbound/
├── Code_Nodes/
├── Builders/
└── Tests/
```

n8n is the canonical orchestration backbone for the existing Pre-CRM engine.

---

# 27. n8n Inbound

Location:

```text
Automation/n8n/Inbound/
```

Primary workflow:

```text
lead-ingestion-qualification.workflow.json
```

Current validated workflow:

- 65 nodes
- 57 connections

Responsibilities include:

- ingestion
- abuse checks
- sanitization
- deduplication
- email verification
- enrichment
- jurisdiction checks
- Gemini qualification
- qualification re-evaluation
- sales routing
- nurture routing
- CRM handoff
- Slack notification
- outbound branch support

Do not build a duplicate inbound engine elsewhere.

---

# 28. n8n Outbound

Location:

```text
Automation/n8n/Outbound/
```

Primary workflow:

```text
outbound-reply-to-deal.workflow.json
```

Current validated structure:

- 11 nodes
- 10 connections

Responsibilities include:

- reply polling
- contact resolution
- qualification refresh
- sales routing refresh
- deal creation
- deal-state persistence
- Slack alerting

---

# 29. n8n Code Nodes

Location:

```text
Automation/n8n/Code_Nodes/
```

Existing code covers capabilities such as:

- ingestion sanitization
- anti-abuse
- Turnstile parsing
- email verification parsing
- enrichment parsing
- jurisdiction checking
- Gemini scoring
- Gemini parsing
- outbound gating
- outreach prompt generation
- outreach parsing
- nurture prompt generation
- nurture parsing
- reply splitting

Before adding new automation logic, search this directory first.

---

# 30. n8n Builders

Location:

```text
Automation/n8n/Builders/
```

Current purpose:

Programmatic workflow generation/build support.

Existing builder includes:

```text
build_workflow.py
```

Changes to Code Nodes may require builder/workflow regeneration.

---

# 30. n8n Tests

Location:

```text
Automation/n8n/Tests/
```

Current test coverage includes:

- sanitizer
- anti-abuse
- verification parser
- enrichment parser
- jurisdiction
- outbound gate
- nurture
- outreach
- reply splitting
- scraper extraction
- MX validation

Future changes to shared Pre-CRM behavior must run appropriate regression tests here.

---

# 31. Hookdeck

Location:

```text
Automation/Hookdeck/
```

Current helper:

```text
start_hookdeck.sh
```

Purpose:

Inbound webhook reliability/tunneling support.

Architecture:

```text
Lead Source
→ Hookdeck
→ n8n
```

---

# 32. Webhook Utilities

Location:

```text
Automation/Webhooks/
```

Current responsibilities:

- local webhook simulation
- demonstrations
- inbound testing
- outbound testing

Examples include:

```text
simulate_webhook.cjs
demo_5_leads.cjs
demo_outbound.cjs
demo_m7_loop.cjs
```

Prefer safe local simulations over production side effects.

---

# 33. Local Services

Location:

```text
Automation/Local_Services/
```

Current major service:

```text
MX_Service/
```

---

# 34. MX Service

Location:

```text
Automation/Local_Services/MX_Service/
```

Current source includes:

```text
mx-service.ts
mx-check.ts
```

Purpose:

Email-domain MX validation for outbound qualification.

Compiled output belongs under:

```text
dist/Automation/Local_Services/MX_Service/
```

Do not place compiled JavaScript into the source directory.

---

# 35. Customer Success Domain

Location:

```text
Customer Success/
```

Purpose:

Account-centric retention, customer health, churn-risk, and expansion logic.

Current implemented structure includes:

```text
Customer Success/
└── Retention/
    └── retention-contract.ts
```

Current responsibilities include:

- customer health evaluation contract
- churn-risk and authoritative churn semantics
- expansion-state contract alignment
- customer-success queue ownership guidance
- retention analytics naming consistency

Phase 7 runtime ownership is shared between this contract layer, Supabase retention views/RPCs, and existing product/billing/sales integrations.

---

# 36. Analytics Domain

Location:

```text
Analytics/
```

Purpose:

Future reporting and analytics models.

Expected later responsibilities include:

- acquisition performance
- attribution
- funnel analytics
- qualification metrics
- pipeline analytics
- activation
- retention
- expansion
- GTM performance

Analytics should be built on stable operational data rather than duplicate source-of-truth tables.

---

# 37. Docs Domain

Location:

```text
Docs/
```

Purpose:

Detailed technical/project documentation.

Current important area:

```text
Docs/Architecture/
```

---

# 38. Architecture Documentation

Location:

```text
Docs/Architecture/
```

Current important file:

```text
API_SPEC.md
```

Other historical/supporting architecture documentation may also exist.

Primary architecture source of truth for the whole project remains:

```text
ARCHITECTURE.md
```

at the repository root.

Avoid maintaining multiple competing living architecture documents.

Historical docs may remain for reference but should not override current project-memory files.

---

# 39. Portfolio Domain

Location:

```text
Portfolio/
```

Purpose:

Recruiter/demo-facing artifacts.

Existing/future responsibilities may include:

- architecture diagrams
- portfolio screenshots
- demo assets
- Loom support
- recruiter-facing visuals
- frozen demo-state references

Current important area includes:

```text
Portfolio/Architecture_Diagrams/
Portfolio/Phase10_Demo_State.md
```

Portfolio assets should consume the implemented system rather than drive runtime architecture.

---

# 40. Generated Artifacts

Generated directories may include:

```text
dist/
Product/Web_App/.next/
node_modules/
Product/Web_App/node_modules/
```

These are not source architecture.

Rules:

- do not manually edit
- do not document every generated file
- do not commit where ignored
- regenerate through normal build commands

---

# 41. Environment Files

Sensitive configuration may exist in:

```text
.env
Product/Web_App/.env.local
```

Example templates may exist as:

```text
.env.example
Product/Web_App/.env.example
```

Rules:

- `.env.example` should contain names/placeholders only
- actual credentials must never be documented here
- secret values must never be added to `FILE_STRUCTURE.md`

---

# 42. Package Manager Boundaries

Repository root:

```text
npm
```

Files:

```text
package.json
package-lock.json
```

Web App:

```text
pnpm
```

Files:

```text
Product/Web_App/package.json
Product/Web_App/pnpm-lock.yaml
```

Never create a second unnecessary root package-manager lockfile.

---

# 43. Current Canonical Capability Ownership

The following ownership map helps prevent duplicate features.

| Capability | Canonical Area |
|---|---|
| Web UI | `Product/Web_App/` |
| Firebase client auth | `Product/Web_App/lib/` |
| Firebase Admin | `Product/Web_App/lib/server/` |
| Customer API routes | `Product/Web_App/app/api/` |
| Customer DB | `Data/Supabase/` |
| Acquisition normalization | `Acquisition/Shared/` |
| Signal scraping | `Acquisition/Signal_Outbound/Scraper/` |
| Outbound source logic | `Acquisition/Signal_Outbound/` |
| AI qualification contract | `Revops/AI_Qualification/` |
| Runtime qualification scoring | active n8n Code Nodes + `Automation/n8n/Inbound/` |
| Workflow orchestration | `Automation/n8n/` |
| Inbound lead engine | `Automation/n8n/Inbound/` |
| Reply/deal workflow | `Automation/n8n/Outbound/` |
| n8n shared logic | `Automation/n8n/Code_Nodes/` |
| n8n tests | `Automation/n8n/Tests/` |
| MX validation | `Automation/Local_Services/MX_Service/` |
| Supabase migrations | `Data/Supabase/Migrations/` |
| Technical contracts | `Docs/Architecture/API_SPEC.md` |
| System architecture | `ARCHITECTURE.md` |
| Current state | `STATE.md` |
| Roadmap | `TASK.md` |

---

# 44. Duplicate Feature Prevention

Before creating a new file for a major capability:

1. search the entire repository
2. inspect equivalent implementations
3. inspect related tests
4. identify canonical ownership
5. reuse where possible
6. extend where possible
7. adapt where possible
8. refactor where justified
9. create new only if necessary

Preferred sequence:

```text
Search
→ Reuse
→ Extend
→ Adapt
→ Refactor
→ Create
```

A different folder location is not enough reason to duplicate behavior.

---

# 45. Duplicate Database Prevention

Before creating:

- a table
- RPC
- view
- index
- event store
- identity model

search:

```text
Data/Supabase/Migrations/
```

and inspect existing schema.

Do not create parallel customer, lead, event, or attribution models when existing ones can be extended.

---

# 47. Duplicate API Prevention

Before creating a new Web App API route, inspect:

```text
Product/Web_App/app/api/
```

Determine whether an existing route can safely support the capability.

Do not overload unrelated routes merely to avoid creating a legitimate new API, but also do not create duplicate APIs.

---

# 48. Duplicate n8n Prevention

Before creating:

- a workflow
- Code Node
- parser
- qualification function
- integration flow

inspect:

```text
Automation/n8n/
```

especially:

```text
Inbound/
Outbound/
Code_Nodes/
```

The existing Pre-CRM engine should remain the canonical revenue workflow foundation.

---

# 49. Major Phase Audit Rule

Before a new major phase:

audit existing repository capabilities that may overlap with the planned work.

After completing a major phase:

audit:

- new files
- architecture
- duplicate functionality
- database changes
- APIs
- workflows
- integrations
- tests
- security
- documentation

Only then allow progression into the next major phase.

---

# 50. Current Phase-Specific Structure

Current Phase 3 acquisition architecture includes:

```text
Acquisition/
├── Shared/
│   ├── acquisition-foundation.ts
│   └── tests/
│
└── Signal_Outbound/
    ├── Scraper/
    ├── Outreach/
    └── Fixtures/
```

Current implemented capture/integration also uses:

```text
Product/Web_App/components/acquisition-capture.tsx
Product/Web_App/lib/acquisition-browser.ts
Product/Web_App/lib/server/acquisition-attribution-*.ts
Data/Supabase/Migrations/17_acquisition_touches.sql
Data/Supabase/Migrations/18_lead_acquisition_capture.sql
```

Do not create a new top-level domain solely for attribution unless the architecture genuinely requires it.

Prefer using:

```text
Acquisition/
Data/Supabase/
Product/Web_App/
Automation/n8n/
```

according to responsibility.

---

# 50. Retool Placement

No Retool UI source is currently stored in this repository.

Retool-facing backend preparation currently lives in Supabase migrations and runtime tests, not in a separate Retool code folder.

When introduced later, it should be treated as an operational interface, not source-of-truth architecture.

Possible future documentation/code organization may live under an appropriate RevOps/analytics area.

Do not create a Retool folder prematurely unless actual Retool implementation files/configuration exist.

Future logical architecture:

```text
Supabase
+ Acquisition
+ Product Events
+ Qualification
+ HubSpot
+ n8n
+ Customer Health
→ Retool
```

---

# 51. Structure Change Rule

Update this file when:

- a new major application is added
- a major service is introduced
- a new top-level domain is created
- a major domain changes ownership
- important shared infrastructure moves
- repository organization materially changes

Do NOT update for:

- minor helper files
- generated artifacts
- trivial test additions
- temporary files

---

# 52. Current Repository Direction

CostPilot should remain one coherent system:

```text
Strategy
        ↓
Acquisition
        ↓
Attribution
        ↓
Lead / Customer Identity
        ↓
Qualification
        ↓
Sales
        ↓
Product
        ↓
Activation
        ↓
Retention
        ↓
Expansion
        ↓
Analytics
```

Repository structure should reinforce this lifecycle rather than fragment it into duplicated feature implementations.
