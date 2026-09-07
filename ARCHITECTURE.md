```md
# CostPilot — ARCHITECTURE.md

## Purpose

This file describes CostPilot's implemented system architecture.

Only validated implementation belongs here.

Future capabilities belong in `TASK.md` until they are built, tested, and verified.

---

# 1. System Overview

CostPilot is an AI-native B2B SaaS + GTM + RevOps + AI automation system.

Long-term lifecycle:

Acquisition
→ Attribution
→ Lead Intelligence
→ Qualification
→ Sales
→ Product
→ Activation
→ Retention
→ Expansion
→ Analytics

Current implemented architecture covers:

- website and authentication
- customer identity
- account/workspace model
- onboarding
- product events
- inbound Pre-CRM acquisition
- signal-based outbound acquisition
- AI qualification
- unified attribution persistence
- Web App acquisition capture
- lead-engine acquisition capture integration
- partner / creator / referral entity persistence
- explainable attribution resolution
- analytics-ready acquisition SQL views
- nurture/outreach automation
- CRM handoff
- reply-to-deal automation
- unified acquisition normalization foundation
- provider connection persistence
- normalized usage and cost persistence
- cost attribution views
- deterministic forecasting
- budget controls
- persistent product alerts
- deterministic optimization recommendations
- activation scoring
- PayU TEST billing state
- account-health signal assembly
- deterministic customer health evaluation
- churn-risk and authoritative churn state
- expansion opportunity evaluation
- customer-success and expansion queue views
- GTM executive analytics views
- lifecycle funnel analytics views
- cross-domain GTM trend views
- Retool query-contract views and action boundaries

Phase 8 backend analytics architecture is complete. This repository owns the Retool-facing query-contract layer and validation harness, not a separate Retool UI codebase.

---

# 2. Repository Architecture

Primary repository:

`~/Documents/CostPilot/`

Top-level domains:

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

Architecture principle:

business/domain ownership first,
framework structure second.

Framework applications remain self-contained.

---

# 3. Customer Web Application

Location:

`Product/Web_App/`

Technology:

- Next.js 16
- React 19
- TypeScript
- Firebase Authentication
- pnpm

Current routes:

- `/`
- `/signup`
- `/login`
- `/onboarding`
- `/dashboard`
- `/demo`

Current APIs:

- `POST /api/auth/sync-profile`
- `POST /api/onboarding`
- `POST /api/events`
- `GET /api/product/overview`
- `GET /api/product/usage/ingest`
- `POST /api/product/usage/ingest`
- `POST /api/product/demo-sync`
- `POST /api/product/budget`
- `POST /api/product/providers`
- `POST /api/product/provider-limits`
- `POST /api/product/alerts`
- `POST /api/product/recommendations`
- `POST /api/billing/payu/checkout`
- `POST /api/billing/payu/webhook`

---

# 4. Customer Identity Architecture

Firebase remains the authentication provider.

Supabase Auth is not used.

Flow:

```text
Browser
→ Firebase Authentication
→ Firebase ID Token
→ Next.js Server API
→ Firebase Admin Verification
→ Supabase
```

Identity model:

```text
Firebase UID
↔
profiles.firebase_uid
↔
profiles.id
```

Rules:

- Firebase UID is the stable external identity.
- `profiles.id` is the internal customer identity.
- email is not the durable identity key.
- protected Supabase writes occur server-side.

---

# 5. Firebase → Supabase Profile Synchronization

Endpoint:

`POST /api/auth/sync-profile`

Flow:

```text
Firebase User
→ ID Token
→ Server Verification
→ Profile Upsert
→ Supabase profiles
```

Implemented behavior:

- verifies Firebase token server-side
- creates or updates profile
- uses `firebase_uid` for idempotency
- updates safe identity metadata
- updates last-login information
- prevents duplicate profile creation for the same Firebase UID

---

# 6. Customer Data Architecture

Customer/product tables currently include:

- `profiles`
- `accounts`
- `account_members`
- `onboarding_responses`
- `product_events`
- `provider_connections`
- `usage_records`
- `budgets`
- `product_alerts`
- `cost_recommendations`
- `billing_transactions`
- `account_plans`
- `customer_health_evaluations`

Primary schema migration:

`Data/Supabase/Migrations/16_core_customer_model.sql`

These tables are separate from the older Pre-CRM lead model.

---

# 7. Account / Workspace Architecture

Relationship:

```text
Profile
→ Account Membership
→ Account
```

Tables:

- `profiles`
- `accounts`
- `account_members`

Current behavior:

- onboarding can create a workspace/account
- repeated onboarding reuses the existing account
- initial creator becomes owner
- duplicate membership rows are prevented

This architecture supports future multi-user customer accounts.

---

# 8. Onboarding Architecture

Endpoint:

`POST /api/onboarding`

Current flow:

```text
Authenticated Firebase User
→ Verify ID Token
→ Resolve Profile
→ Create / Reuse Account
→ Create / Reuse Membership
→ Persist Onboarding Response
→ Mark Onboarding Completed
→ Dashboard
```

Currently persisted onboarding data includes:

- company size
- providers
- estimated monthly spend
- raw answer payload
- completion timestamp

Repeated submissions update current onboarding state safely.

---

# 9. Product Event Architecture

Endpoint:

`POST /api/events`

Approved current events:

- `signup`
- `login`
- `onboarding_started`
- `onboarding_completed`
- `dashboard_viewed`

Flow:

```text
Web App
→ Firebase ID Token
→ /api/events
→ Firebase Admin Verification
→ Profile Resolution
→ Account Resolution when available
→ product_events
```

Current default source:

`web_app`

Event records support:

- profile identity
- Firebase UID
- account identity when available
- event name
- source
- properties
- timestamp

Arbitrary client event names are not allowed.

---

# 10. Pre-CRM Revenue Intelligence Architecture

The existing Pre-CRM engine remains a core reusable system.

It must not be rebuilt unnecessarily.

Primary principle:

```text
Raw Lead
≠
Immediate CRM Entry
```

Current inbound flow:

```text
Lead Source
→ Hookdeck
→ n8n
→ Anti-Abuse
→ Sanitization
→ Deduplication
→ Email Verification
→ Enrichment
→ Jurisdiction Validation
→ Gemini Qualification
→ Supabase
→ Qualified / Nurture Routing
→ HubSpot
→ Slack
```

Primary workflow:

`Automation/n8n/Inbound/lead-ingestion-qualification.workflow.json`

Validated structure:

- 53 nodes
- 45 connections

---

# 11. Pre-CRM Database Architecture

Existing lead/revenue tables include:

- `staged_leads`
- `lead_events`
- `spam_log`
- `abuse_events`
- `outreach`

Important existing concepts:

- unique event IDs
- race-safe lead deduplication
- unique normalized email handling
- lead timeline
- anti-abuse history
- qualification score
- buying intent
- firmographics
- source type
- outreach state
- reply state
- HubSpot deal tracking

The Pre-CRM model remains operational alongside the newer customer/product model.

---

# 12. Lead Validation Architecture

Existing validation stages include:

```text
Incoming Lead
→ Abuse Check
→ Sanitization
→ Email Validation
→ Deduplication
→ Deliverability Verification
→ Enrichment
→ Jurisdiction Validation
```

Capabilities include:

- honeypot detection
- fast-submit detection
- IP flood control
- daily circuit breaker
- disposable-domain rejection
- malformed-email handling
- personal/student/competitor domain handling
- provider-agnostic email verification parsing
- jurisdiction blocking

Turnstile parser/test logic exists but is not yet wired into the active workflow.

---

# 13. AI Qualification Architecture

Current AI qualification uses Gemini.

Logical flow:

```text
Lead + Firmographics
→ Qualification Prompt
→ Gemini
→ Strict JSON Response
→ Validation / Parsing
→ Supabase Score Update
→ Qualification Signal Assembly
→ Qualification Evaluation RPC
→ MQL / SQL / PQL-Compatible State
→ Existing Routing Decision
```

Current outputs include:

- `icp_score`
- `buying_intent`
- `personalized_icebreaker`
- qualification status

Canonical runtime ownership remains:

- `Automation/n8n/Inbound/lead-ingestion-qualification.workflow.json`
- `Automation/n8n/Code_Nodes/n8n-gemini-score.js`
- `Automation/n8n/Code_Nodes/n8n-gemini-parse.js`
- existing Supabase lead/RPC layer

Current base threshold:

`icp_score >= 70`

Phase 4 adds one explainable derived qualification layer:

- `public.lead_qualification_signal_assembly`
- `public.evaluate_lead_qualification(...)`
- `public.qualification_evaluations`
- `public.lead_current_qualification`
- `public.qualification_channel_metrics`

MQL is derived from fit, buying intent, acquisition context, and engagement/product-adjacent evidence.

SQL is derived from CRM readiness, outbound readiness, reply/deal activity, and meaningful engagement.

PQL now remains inside the Phase 4 qualification runtime and resolves to:

- `insufficient_product_signals` when the provider connection, usage sync, and insight chain is incomplete
- `product_qualified` when provider connection, usage sync, and first insight are present
- `product_activated` when the account reaches the Phase 6 activation threshold

---

# 14. Sales Routing Architecture

Phase 5 extends the qualification layer into one deterministic sales-routing layer.

Current routing data model:

- `public.sales_reps`
- `public.sales_assignments`
- `public.sales_assignment_history`
- `public.sales_routing_signal_assembly`

Current routing contract:

```text
Qualification
→ route_lead_to_sales RPC
→ SDR / AE assignment
→ queue views
→ existing HubSpot / Slack workflow branches
→ reply / handoff updates
```

Current routing rules are explainable and deterministic:

- only sales-eligible SQL leads can be assigned
- outbound SQL routes to SDR by default
- enterprise or urgent high-intent SQL can route to AE directly
- positive reply or active deal context can trigger AE handoff
- missing rep coverage or downstream sync failures move the assignment to `retry_required`
- manual overrides are preserved unless a forced reassignment is requested

This layer reuses the existing qualification, outbound gate, HubSpot, Slack, and reply-to-deal infrastructure rather than creating a second routing stack.

---

# 15. Nurture Architecture

Low-fit or lower-score leads may enter nurture.

Current flow:

```text
Nurture Candidate
→ Gemini Nurture Message
→ Parse / Validate
→ Brevo Send when enabled
→ Persist Outreach State
→ Slack / Operational Signal
```

This should be reused in future qualification and sales phases.

---

# 16. Signal-Based Outbound Architecture

Location:

`Acquisition/Signal_Outbound/`

Implemented components include:

- scraper
- website/domain crawling
- company/contact extraction
- fixtures
- qualification inputs
- MX checks
- outbound gate
- AI outreach generation
- outreach persistence
- email sending path
- CRM synchronization
- operational alerts

Flow:

```text
Target Account
→ Scraper
→ Extract Company / Contact Data
→ Qualification
→ MX Gate
→ Outbound Gate
→ AI Outreach
→ Outreach Persistence
→ Optional Send
→ CRM Sync
```

This engine must be extended, not rebuilt.

---

# 17. Reply → Deal Architecture

Workflow:

`Automation/n8n/Outbound/outbound-reply-to-deal.workflow.json`

Validated structure:

- 7 nodes
- 6 connections

Flow:

```text
Scheduled Reply Check
→ Fetch Replied Outreach
→ Split Rows
→ Fetch CRM Contact
→ Create Deal
→ Mark Deal Created
→ Slack Alert
```

This remains part of the existing sales handoff architecture.

---

# 17. MX Service Architecture

Location:

`Automation/Local_Services/MX_Service/`

Source:

TypeScript

Compiled output:

`dist/Automation/Local_Services/MX_Service/`

Local health endpoint:

`GET http://localhost:9001/health`

MX tests currently pass deterministically.

Generated JS must remain in `dist/`, not source directories.

---

# 18. Automation Architecture

Primary automation platform:

n8n

Location:

`Automation/n8n/`

Major areas:

- `Inbound/`
- `Outbound/`
- `Code_Nodes/`
- `Builders/`
- `Tests/`

n8n remains the orchestration backbone for:

- lead ingestion
- qualification
- enrichment
- nurture
- outbound
- CRM handoff
- reply processing

It should not be replaced without explicit architectural approval.

---

# 19. Hookdeck Architecture

Hookdeck acts as the inbound webhook reliability layer.

Typical architecture:

```text
External Lead Source
→ Hookdeck
→ n8n
→ Pre-CRM Engine
```

Local testing may call n8n directly.

---

# 20. External Integration Architecture

Current integrations include:

## Firebase

Authentication and customer identity.

## Supabase

Persistent storage for:

- Pre-CRM
- customer data
- product events
- future attribution

## n8n

Workflow orchestration.

## Hookdeck

Inbound webhook gateway.

## Gemini

AI qualification and messaging.

## Apollo

Company enrichment.

## Email Verification Providers

Deliverability checks through provider-compatible parsing.

## HubSpot

CRM contact/deal handoff.

## Slack

Operational and sales alerts.

## Brevo

Outbound and nurture email sending.

## Retool

No Retool UI source is stored in this repository.

The backend query-contract layer is implemented through cross-domain GTM analytics views and existing safe RPCs.

It must not become the system of record.

---

# 21. Phase 3 Unified Acquisition Architecture

Phase 3.1 introduced a canonical acquisition foundation.

Primary implementation:

`Acquisition/Shared/acquisition-foundation.ts`

Web App bridge:

`Product/Web_App/lib/acquisition.ts`

Canonical channels:

- `inbound`
- `plg`
- `outbound`
- `partner`
- `creator`
- `referral`

---

# 22. Unified Acquisition Envelope

Current normalized acquisition contract:

```text
channel
source
source_id
medium
campaign
referrer
utm_source
utm_medium
utm_campaign
utm_content
utm_term
partner_id
creator_id
referral_id
```

Normalization behavior includes:

- whitespace cleanup
- token normalization
- null conversion
- channel validation
- length validation
- malformed input rejection

All future acquisition channels should normalize into this contract.

---

# 23. Inbound Acquisition Mapping

Existing inbound architecture remains unchanged.

Conceptual mapping:

```text
Hookdeck / Website Lead
→ Existing Payload
→ Acquisition Normalizer
→ channel = inbound
```

Existing compatible metadata includes:

- `source_type`
- source
- form
- event ID
- raw payload
- campaign metadata
- UTM-compatible fields
- referrer

Attribution persistence and lead-touch capture are implemented.

---

# 24. Outbound Acquisition Mapping

Existing outbound system maps conceptually to:

`channel = outbound`

Possible source identity may come from:

- scraper
- domain
- source URL
- manual prospecting
- signal source
- email/contact identity

The existing scraper and outreach architecture remains canonical.

---

# 25. PLG Acquisition Mapping

Current PLG architecture:

```text
Landing
→ Firebase Signup
→ Profile
→ Onboarding
→ Product Events
```

Maps conceptually to:

`channel = plg`

Current product events contribute attribution metadata.

Browser UTM/referrer persistence is implemented through the Web App acquisition capture layer.

---

# 26. Partner / Creator / Referral Foundation

The unified acquisition contract already supports:

- `partner_id`
- `creator_id`
- `referral_id`

Current status:

implemented in the unified acquisition layer.

Persistent entity support now lives in:

- `Data/Supabase/Migrations/19_acquisition_entities.sql`
- `Product/Web_App/lib/server/acquisition-entities-core.ts`
- `Product/Web_App/lib/server/acquisition-entities-service.ts`

---

# 27. Current Attribution Architecture

Existing attribution-related schema:

`profiles.first_touch_source`
`profiles.first_touch_medium`
`profiles.first_touch_campaign`
`profiles.first_touch_referrer`

Current state:

schema and runtime persistence both exist.

Existing source signals include:

- `staged_leads.source_type`
- `staged_leads.raw_payload`
- `product_events.event_source`
- Phase 3.1 normalized acquisition envelope

Resolver and analytics-ready SQL now sit on top of the implemented attribution foundation through:

- `Product/Web_App/lib/server/acquisition-resolver-core.ts`
- `Data/Supabase/Migrations/20_acquisition_resolver_analytics.sql`

---

# 28. Implemented Phase 3.2 Attribution Architecture

Implemented and validated.

Current direction:

```text
Acquisition Source
→ AcquisitionEnvelope
→ Acquisition Touch
→ Lead / Profile / Firebase Identity
→ Account Identity when available
```

Expected responsibilities:

- acquisition history
- first-touch persistence
- later interaction persistence
- last-touch support
- lead/customer identity linkage

Phase 3.3 should extend capture wiring without rebuilding this layer.

---

# 29. Security Architecture

Protected customer/data write flow:

```text
Browser
→ Firebase Authentication
→ Firebase ID Token
→ Next.js Server API
→ Firebase Admin Verification
→ Supabase Service Role
```

Rules:

- service-role credentials remain server-side
- Firebase tokens are verified server-side
- direct browser access to protected writes is not used
- RLS remains enabled
- secrets remain in environment configuration
- logs and documentation must not expose secrets

---

# 30. Supabase Architecture

Supabase currently stores two primary operational domains:

## Pre-CRM

Lead and revenue pipeline data.

## Product / Customer

User, account, onboarding, and product-event data.

Phase 3 currently preserves both existing domains while extending them with unified acquisition attribution.

Migrations must remain append-only.

---

# 31. Package Architecture

Repository root:

`npm`

Files:

- `package.json`
- `package-lock.json`

Web App:

`pnpm`

Files:

- `Product/Web_App/package.json`
- `Product/Web_App/pnpm-lock.yaml`

Do not mix dependency contexts.

---

# 32. Build Architecture

Root TypeScript build outputs generated files under:

`dist/`

Web App generates Next.js output under:

`.next/`

Generated artifacts are not source architecture and should not be manually edited.

---

# 33. Duplicate Feature Prevention Architecture

CostPilot contains substantial existing functionality.

Before adding a new implementation:

```text
Search Existing System
→ Reuse
→ Extend
→ Adapt
→ Refactor
→ Only Then Create New
```

Particularly protect against duplicate implementations of:

- lead sanitization
- anti-abuse
- verification
- enrichment
- jurisdiction checking
- AI qualification
- nurture
- scraper
- MX logic
- outbound gating
- outreach
- CRM handoff
- Slack notifications
- Brevo sending
- reply-to-deal
- authentication
- profile sync
- onboarding
- product events
- acquisition normalization

Domain location alone is not justification for duplicating functionality.

---

# 34. Retool Architecture Strategy

This repository intentionally keeps Retool as an external operational interface over the backend analytics layer.

Current backend architecture:

```text
Supabase GTM Analytics Views
+ existing safe RPCs
+ Acquisition Attribution
+ Product Events
+ Qualification
+ n8n
+ HubSpot
+ Customer Health
→ Retool RevOps Command Center
```

Retool will provide operational views and actions over these existing contracts.

Retool must not replace:

- Supabase
- HubSpot
- n8n
- core application logic

Retool must not become the system of record.

---

# 35. Current Architecture Status

Phase 1:

COMPLETE

Phase 2:

COMPLETE

Phase 3.1:

COMPLETE

Phase 3.2:

COMPLETE

Current next architecture task:

Phase 10 historical demo architecture is implemented and validated

---

# 36. Major Phase Audit Rule

Before every major phase:

audit existing architecture and reusable capabilities.

After every major phase:

audit the resulting system for:

- duplicate features
- architecture drift
- unnecessary files
- incompatible contracts
- regression failures
- security issues
- stale documentation

A major phase must not be considered complete until this audit passes.

---

# 37. Architecture Documentation Rule

This file is living architecture documentation.

Required update flow:

```text
Implement
→ Test
→ Integration Validate
→ Audit
→ Update ARCHITECTURE.md
```

Do not document roadmap items as implemented merely because they appear in `TASK.md`.

The repository and validated runtime behavior remain the ultimate source of truth.
```

Phase 10 architecture additions:

- one hosted-safe deterministic harness in `Product/Web_App/scripts/phase10-demo-harness.mjs`
- append-only performance migrations `29` through `33`
- historical synthetic data flows through canonical tables, RPCs, and views rather than a parallel demo model
- reset behavior is scoped to `phase10_demo_*` entities only
- the hosted demo-state reference lives in `Portfolio/Phase10_Demo_State.md`
