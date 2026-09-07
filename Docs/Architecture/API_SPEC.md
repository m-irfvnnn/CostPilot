# CostPilot — API_SPEC.md

## Purpose

This file defines the implemented API, webhook, RPC, event, and acquisition payload contracts used by CostPilot.

Only validated contracts belong here.

Planned APIs must not be documented as implemented until development and verification are complete.

Never place real secrets, tokens, API keys, service-role values, or private credentials in this file.

---

# 1. General API Rules

All application APIs should:

- use JSON where applicable
- validate authentication
- validate input
- return safe errors
- avoid leaking stack traces
- avoid leaking credentials
- preserve backward compatibility where practical
- document actual request/response behavior after implementation

Protected customer writes follow:

```text
Browser
→ Firebase Authentication
→ Firebase ID Token
→ Next.js Server API
→ Firebase Admin Verification
→ Supabase Service Role
```

---

# 2. Firebase Profile Sync API

## Endpoint

```text
POST /api/auth/sync-profile
```

## Purpose

Synchronizes an authenticated Firebase user into the CostPilot `profiles` table.

---

## Authentication

Header:

```text
Authorization: Bearer <Firebase ID token>
```

The server verifies the token with Firebase Admin.

---

## Optional Request Body

The route accepts an optional JSON body:

```json
{
  "acquisition_context": {
    "source": "linkedin",
    "source_id": "campaign_42",
    "medium": "paid_social",
    "campaign": "launch_q3",
    "referrer": "https://www.linkedin.com/feed/",
    "utm_source": "linkedin",
    "utm_medium": "paid_social",
    "utm_campaign": "launch_q3",
    "utm_content": "hero_cta",
    "utm_term": null,
    "partner_id": null,
    "creator_id": null,
    "referral_id": null
  }
}
```

All acquisition fields are optional.

When present, the body is normalized into the existing PLG attribution flow.

---

## Server Flow

```text
Request
→ Verify Firebase ID Token
→ Parse Optional Acquisition Context
→ Extract Firebase UID
→ Normalize Safe User Metadata
→ Upsert profiles
→ Persist First-Touch/PLG Acquisition Context
→ Update last_login_at
→ Return Safe Profile Data
```

---

## Identity Rule

Stable external identity:

```text
firebase_uid
```

Internal identity:

```text
profiles.id
```

Email must not be treated as the durable primary identity.

---

## Response

Representative implemented shape:

```json
{
  "profile": {
    "id": "uuid",
    "firebase_uid": "firebase-uid-string",
    "email": "user@example.com",
    "display_name": "Jane Doe",
    "photo_url": "https://example.com/avatar.jpg",
    "auth_provider": "google.com",
    "last_login_at": "2026-08-25T12:00:00.000Z"
  }
}
```

Actual code remains the source of truth.

---

## Error Responses

Current implemented error behavior:

- `401` when the bearer token is missing
- `401` when Firebase token verification fails with `invalid_token`
- `400` for other safe request/service failures surfaced by the route
- `400` when the optional JSON body is malformed

```json
{
  "error": "missing_token"
}
```

```json
{
  "error": "invalid_token"
}
```

The route also returns:

```json
{
  "error": "profile_sync_failed"
}
```

or another safe error string emitted by server-side validation/service code, with HTTP `400`.

---

# 3. Onboarding Persistence API

## Endpoint

```text
POST /api/onboarding
```

## Purpose

Persists CostPilot onboarding and establishes account/workspace membership.

---

## Authentication

Header:

```text
Authorization: Bearer <Firebase ID token>
```

The token is verified server-side.

---

## Request Body

Current onboarding fields include:

```json
{
  "company_size": "11–50",
  "providers": ["OpenAI", "AWS"],
  "estimated_monthly_spend": "$1K–$5K"
}
```

The exact accepted values are defined by application validation logic.

---

## Server Flow

```text
Verify Firebase Token
→ Resolve Supabase Profile
→ Create / Reuse Account
→ Create / Reuse Membership
→ Persist Onboarding Response
→ Mark Account Onboarding Complete
→ Return Safe Identifiers
```

---

## Response

Representative implemented shape:

```json
{
  "profile": {
    "id": "uuid",
    "firebase_uid": "firebase-uid-string"
  },
  "account": {
    "id": "uuid",
    "name": "Acme Workspace",
    "onboarding_status": "completed"
  },
  "onboarding_response": {
    "id": "uuid"
  }
}
```

---

## Current Error Contracts

Examples include:

```json
{
  "error": "missing_token"
}
```

```json
{
  "error": "invalid_token"
}
```

```json
{
  "error": "profile_not_found"
}
```

```json
{
  "error": "invalid_company_size"
}
```

```json
{
  "error": "invalid_providers"
}
```

```json
{
  "error": "invalid_estimated_monthly_spend"
}
```

---

# 4. Product Events API

## Endpoint

```text
POST /api/events
```

## Purpose

Persists approved product lifecycle events.

---

## Authentication

Header:

```text
Authorization: Bearer <Firebase ID token>
```

---

## Request Contract

Current request concept:

```json
{
  "event_id": "cp_evt_account-1:dashboard_viewed:attempt-1",
  "event_name": "dashboard_viewed",
  "event_properties": {}
}
```

The server resolves:

- Firebase UID
- profile
- account when available
- event source
- event trust level

`event_id` is optional for compatibility, but recommended for retry-safe clients.
When present it must be stable for the same logical event and use the
`cp_evt_...` prefix.

---

## Approved Event Names

Current allowlist:

```text
account_created
signup
login
onboarding_started
onboarding_completed
dashboard_viewed
workflow_viewed
usage_viewed
provider_viewed
provider_connection_started
provider_connected
provider_connection_failed
provider_disconnected
ai_usage_recorded
workflow_observed
workflow_run_observed
usage_synced
insight_generated
budget_created
budget_updated
budget_threshold_reached
budget_exceeded
alert_configured
provider_limit_created
provider_limit_updated
provider_limit_approaching
provider_limit_exceeded
alert_created
alert_viewed
alert_resolved
first_cost_data_received
forecast_viewed
recommendation_generated
recommendation_viewed
recommendation_dismissed
recommendation_applied
alert_triggered
plan_selected
upgrade_clicked
upgrade_requested
checkout_started
subscription_activated
```

Arbitrary browser-supplied event names are rejected.

---

## Stored Event Contract

The `product_events` model supports:

```text
event_id
profile_id
account_id
firebase_uid
event_name
event_source
event_trust_level
occurred_at
event_properties
created_at
```

Current default source:

```text
web_app
```

Browser events are stored as `untrusted`. Server, system, billing, gateway,
n8n, and usage-ingest events are stored as `trusted`. Lifecycle state such as
activation, PQL, customer health, expansion, and risk must be derived from
trusted server-side data and existing Supabase views/RPCs, not asserted by the
browser.

---

## Event Behavior

### signup

Triggered after successful Firebase signup and profile synchronization.

Account may not yet exist.

### login

Triggered after successful authentication and profile synchronization.

May legitimately repeat across sessions.

### onboarding_started

Triggered when an authenticated user enters onboarding.

Client-side render-loop duplication is guarded.

### onboarding_completed

Triggered after successful onboarding persistence.

Can include safe properties such as:

- company size
- provider count
- estimated monthly spend

### dashboard_viewed

Triggered after authenticated dashboard access.

May repeat on later genuine visits.

### provider_connected / usage_synced / insight_generated / budget_created / alert_configured

Triggered by the authenticated Phase 6 product-intelligence runtime.

These events feed activation scoring and PQL-compatible qualification.

---

# 5. Unified Acquisition Contract

Phase 3.1 introduced the canonical acquisition envelope.

Primary implementation:

```text
Acquisition/Shared/acquisition-foundation.ts
```

Web App bridge:

```text
Product/Web_App/lib/acquisition.ts
```

---

## AcquisitionEnvelope

Implemented contract:

```ts
type AcquisitionEnvelope = {
  channel:
    | 'inbound'
    | 'plg'
    | 'outbound'
    | 'partner'
    | 'creator'
    | 'referral'

  source: string | null
  source_id: string | null
  medium: string | null
  campaign: string | null
  referrer: string | null

  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null

  partner_id: string | null
  creator_id: string | null
  referral_id: string | null
}
```

---

# 6. Acquisition Channel Taxonomy

Canonical channels:

```text
inbound
plg
outbound
partner
creator
referral
```

All future acquisition engines should map into one of these canonical values.

---

# 7. Acquisition Normalization Rules

Current normalization behavior includes:

- trim leading/trailing whitespace
- collapse repeated internal whitespace where applicable
- normalize token-like values
- convert empty strings to null
- reject invalid channels
- reject malformed non-object payloads
- reject unreasonable field lengths
- preserve source identifiers

Do not create separate incompatible contracts for each acquisition channel.

---

# 8. Acquisition Source Examples

Current source catalog includes examples such as:

## Inbound

```text
website
pricing_form
demo_request
```

## PLG

```text
organic_signup
paid_signup
direct_signup
```

## Outbound

```text
scraper
manual_prospecting
signal_outbound
```

## Partner

```text
agency
consultant
```

## Creator

```text
youtube
linkedin
newsletter
podcast
```

## Referral

```text
customer_referral
partner_referral
invite
```

These values represent current normalization guidance.

The architecture may remain extensible rather than hardcoding every future source.

---

# 9. Existing Lead Acquisition Mapping

Current Pre-CRM lead metadata can map into the AcquisitionEnvelope.

Relevant existing fields:

```text
staged_leads.source_type
staged_leads.raw_payload
staged_leads.event_id
```

Helper:

```text
resolveAcquisitionChannelFromSourceType()
```

Existing mappings include:

```text
inbound
→ channel = inbound

outbound_scraped
→ channel = outbound
```

---

# 10. Inbound Acquisition Mapping Contract

Existing inbound payload metadata may contribute:

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
```

Possible source inputs include:

- `source_type`
- raw payload source
- form
- event ID
- campaign metadata
- UTM fields
- referrer

Current state:

normalization exists.

Unified database attribution persistence is implemented.

---

# 11. Outbound Acquisition Mapping Contract

Existing outbound architecture maps to:

```text
channel = outbound
```

Potential metadata sources include:

- scraper
- domain
- source URL
- contact email
- signal source
- campaign metadata
- medium

The existing scraper and outreach engines remain unchanged.

---

# 12. PLG Acquisition Mapping Contract

Existing PLG/customer architecture:

```text
Firebase Signup
→ Profile
→ Onboarding
→ Product Events
```

maps to:

```text
channel = plg
```

Potential identity/source inputs include:

- Firebase UID
- profile ID
- product-event source
- acquisition metadata
- UTM fields from the implemented browser capture layer

Current state:

contract, capture, and persisted PLG attribution support exist.

---

# 13. Partner Acquisition Contract

Current unified envelope supports:

```text
channel = partner
partner_id
```

Suggested source categories currently include:

```text
agency
consultant
```
Implemented persistence surfaces:

- `public.acquisition_partners`
- `Data/Supabase/Migrations/19_acquisition_entities.sql`
- `Product/Web_App/lib/server/acquisition-entities-service.ts`

---

# 14. Creator Acquisition Contract

Current envelope supports:

```text
channel = creator
creator_id
```

Current source examples include:

```text
youtube
linkedin
newsletter
podcast
```
Implemented persistence surfaces:

- `public.acquisition_creators`
- `Data/Supabase/Migrations/19_acquisition_entities.sql`
- `Product/Web_App/lib/server/acquisition-entities-service.ts`

---

# 15. Referral Acquisition Contract

Current envelope supports:

```text
channel = referral
referral_id
```

Current source examples include:

```text
customer_referral
partner_referral
invite
```
Implemented persistence surfaces:

- `public.acquisition_referrals`
- `Data/Supabase/Migrations/19_acquisition_entities.sql`
- `Product/Web_App/lib/server/acquisition-entities-service.ts`

---

# 16. Acquisition Persistence + Resolver Contract

Implemented database/runtime surfaces:

```text
AcquisitionEnvelope
→ acquisition_touches
→ acquisition_touch_lineage
→ acquisition_resolved_attribution
→ acquisition_channel_metrics
```

Current implemented persistence includes:

- `public.acquisition_touches`
- `public.acquisition_partners`
- `public.acquisition_creators`
- `public.acquisition_referrals`
- `public.acquisition_touch_lineage`
- `public.acquisition_resolved_attribution`
- `public.acquisition_channel_metrics`

Current implemented server-side logic includes:

- immutable first-touch persistence
- mutable last-touch upsert behavior
- append-only interaction history
- partner / creator / referral entity upsert support
- explainable resolver behavior derived from touch history

Expected fields may include:

```text
id
profile_id
account_id
lead_id
firebase_uid

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

touch_type
metadata
occurred_at
created_at
```

This section describes planned direction only.

Do not treat `acquisition_touches` as implemented until a migration and validation exist.

---

# 17. Planned Attribution Touch Types

Not yet implemented.

Expected values:

```text
first_touch
last_touch
interaction
```

The actual database contract must be documented after implementation.

---

# 18. Existing Profile Attribution Fields

Existing schema includes:

```text
profiles.first_touch_source
profiles.first_touch_medium
profiles.first_touch_campaign
profiles.first_touch_referrer
```

Current status:

schema exists.

Operational first-touch persistence is implemented.

---

# 19. Hookdeck → n8n Ingestion Contract

Current inbound route:

```text
POST /webhook/hookdeck-lead-ingest
```

Local example:

```text
http://localhost:5678/webhook/hookdeck-lead-ingest
```

Development test route may use:

```text
/webhook-test/hookdeck-lead-ingest
```

---

## Example Ingestion Payload

Representative existing shape:

```json
{
  "hookdeck_metadata": {
    "event_id": "evt_hk_9981a3b",
    "attempts": 1,
    "timestamp": "2026-08-13T14:24:50Z"
  },
  "body": {
    "event": "lead.captured",
    "email": "alex@ai-labs.io",
    "company_name": "AI Labs Corp",
    "monthly_spend": "$20k+",
    "raw_payload": {
      "source": "website",
      "form": "pricing",
      "message": "Interested in CostPilot"
    },
    "ingested_at": "2026-08-13T14:24:49Z"
  }
}
```

Required sanitizer identity fields include:

- email
- unique event identity

Exact runtime behavior remains defined by the live n8n workflow.

---

# 20. Sanitizer Contract

Successful sanitized lead shape may include:

```json
{
  "event_id": "evt_test_valid_001",
  "email": "alex@ai-labs.io",
  "email_domain": "ai-labs.io",
  "company_name": "AI Labs",
  "raw_payload": {
    "source": "website"
  },
  "firmographics": {
    "industry": "SaaS",
    "employees": 50
  },
  "sanitized": true
}
```

Rejected lead shape may include:

```json
{
  "event_id": "evt_test_rejected_001",
  "email": "junk@tempmail.com",
  "sanitized": false,
  "reason": "temporary_email_provider"
}
```

Known rejection reasons include concepts such as:

```text
email_missing
email_invalid_format
temporary_email_provider
personal_domain
student_domain
competitor_domain
```

---

# 21. Lead Deduplication RPC

RPC:

```text
get_or_create_lead
```

Purpose:

race-safe lead identity creation/deduplication.

Representative request:

```json
{
  "p_event_id": "evt_v3_new_001",
  "p_email": "founder@nova-ai.io",
  "p_company_name": "Nova AI",
  "p_raw_payload": {
    "source": "test",
    "form": "pricing"
  },
  "p_firmographics": {
    "industry": "AI",
    "employees": 30
  }
}
```

Representative response:

```json
[
  {
    "lead_id": 7,
    "is_new": true
  }
]
```

Current deduplication uses normalized email uniqueness and conflict-safe handling.

---

# 22. Lead Timeline RPC

RPC:

```text
append_lead_event
```

Representative request:

```json
{
  "p_lead_id": 7,
  "p_event_type": "lead.captured.duplicate",
  "p_event_data": {
    "source": "website"
  }
}
```

Representative success response:

```json
[
  {
    "ok": true
  }
]
```

Current event types include concepts such as:

```text
lead.captured
lead.captured.duplicate
lead.scored
```

---

# 23. Spam Logging RPC

RPC:

```text
log_spam
```

Representative request:

```json
{
  "p_event_id": "evt_v3_rej_001",
  "p_email": "spam@mailinator.com",
  "p_reason": "temporary_email_provider",
  "p_raw_payload": {
    "source": "bot"
  }
}
```

Representative response:

```json
[
  {
    "ok": true
  }
]
```

---

# 24. Lead Scoring RPC

RPC:

```text
update_lead_score
```

Representative request:

```json
{
  "p_lead_id": 7,
  "p_icp_score": 88,
  "p_buying_intent": "high",
  "p_icebreaker": "Relevant personalized message",
  "p_status": "qualified"
}
```

Current scoring outputs may include:

```text
icp_score
buying_intent
personalized_icebreaker
status
firmographics
```

---

# 25. Email Verification Failure RPC

RPC:

```text
mark_lead_unverified
```

Representative request:

```json
{
  "p_lead_id": 7
}
```

Purpose:

- mark lead unverified
- append verification-failure timeline state
- prevent further CRM qualification flow

---

# 26. Jurisdiction Blocking RPC

RPC:

```text
mark_lead_blocked
```

Purpose:

mark unsupported jurisdictions as blocked and prevent qualification/CRM routing.

---

# 27. Abuse Monitoring RPCs

Existing anti-abuse RPCs include:

```text
record_abuse
count_abuse_since
count_events_since
count_leads_by_ip_since
```

Used for:

- abuse history
- rate limiting
- daily circuit breaking
- IP flood protection

---

# 28. Outbound Readiness RPC

RPC:

```text
mark_ready_to_push
```

Purpose:

mark a qualified outbound lead ready for outreach/sales handling.

---

# 29. Outreach RPC Contracts

Existing RPCs include:

```text
insert_outreach
mark_outreach_sent
mark_lead_emailed
```

These support:

- outreach ledger creation
- send state
- lead email state
- timeline progression

---

# 30. Reply → Deal RPCs

Existing RPCs include:

```text
get_replied_outreach
mark_deal_created
```

Used by the outbound reply-to-deal workflow.

Current known technical debt:

`get_replied_outreach(p_limit)` semantics may require correction later if relevant.

---

# 31. Gemini Scoring Contract

Current AI qualification uses Gemini.

Logical request:

```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "<qualification prompt>"
        }
      ]
    }
  ]
}
```

Current expected model-output contract:

```json
{
  "icp_score": 88,
  "buying_intent": "high",
  "personalized_icebreaker": "Relevant personalized message"
}
```

Parser validates:

- score range
- intent values
- message shape

Provider changes must preserve the output contract unless the qualification architecture is intentionally changed.

---

# 32. Qualification Routing Contract

Canonical scoring authority:

- `Automation/n8n/Code_Nodes/n8n-gemini-score.js`
- `Automation/n8n/Code_Nodes/n8n-gemini-parse.js`
- `Automation/n8n/Inbound/lead-ingestion-qualification.workflow.json`

Current runtime flow:

```text
Gemini fit + intent
→ staged lead update
→ qualification signal assembly
→ evaluate_lead_qualification RPC
→ MQL / SQL / PQL-compatible state
→ existing CRM / nurture / outbound routing

Base routing rule preserved:

icp_score >= 70
→ qualified / CRM-ready path

icp_score < 70
→ nurture path
```

Phase 4 formalized the derived qualification layer without replacing the scorer.

`POST /rest/v1/rpc/evaluate_lead_qualification`

Request:

```json
{
  "p_lead_id": 123,
  "p_evaluation_type": "score_update",
  "p_source_runtime": "precrm_n8n"
}
```

Response shape:

```json
[
  {
    "evaluation_id": "uuid",
    "lead_id": 123,
    "profile_id": "uuid-or-null",
    "account_id": "uuid-or-null",
    "fit_score": 78,
    "buying_intent": "high",
    "mql_status": "qualified",
    "sql_status": "sales_ready",
    "pql_status": "insufficient_product_signals",
    "crm_ready": true,
    "outbound_ready": false,
    "priority_score": 93,
    "priority_tier": "urgent",
    "explanation": "Explainable qualification reason",
    "evaluated_at": "2026-08-27T00:00:00.000Z"
  }
]
```

Current derived states:

- `mql_status`: `qualified` | `nurture` | `disqualified`
- `sql_status`: `sales_ready` | `awaiting_engagement` | `nurture` | `disqualified`
- `pql_status`: `insufficient_product_signals` | `product_qualified` | `product_activated`

Current PQL behavior stays inside the existing qualification runtime. It now advances only when real Phase 6 product signals are present, rather than treating signup or dashboard views as product qualification.

## 32.1 Sales Routing Contract

Phase 5 extends the derived qualification contract into deterministic sales routing without replacing the existing scorer or CRM workflow ownership.

`POST /rest/v1/rpc/route_lead_to_sales`

Request:

```json
{
  "p_lead_id": 123,
  "p_trigger": "qualification_runtime",
  "p_force_reassign": false
}
```

Response shape:

```json
[
  {
    "assignment_id": "uuid",
    "lead_id": 123,
    "qualification_evaluation_id": "uuid",
    "routing_status": "assigned",
    "owner_type": "sdr",
    "rep_id": "uuid",
    "rep_code": "sdr_na_1",
    "rep_name": "Alex North",
    "priority_tier": "high",
    "priority_score": 84,
    "segment": "mid_market",
    "geography": "north_america",
    "routing_reason": "outbound_sql_to_sdr",
    "eligible_for_sales": true,
    "manual_override": false,
    "needs_ae_handoff": false,
    "crm_sync_status": "pending",
    "slack_sync_status": "pending",
    "last_routed_at": "2026-08-27T00:00:00.000Z"
  }
]
```

Current routing states:

- `pending`
- `assigned`
- `unassigned`
- `handoff_pending`
- `handed_off`
- `retry_required`
- `manually_overridden`

Current sync states:

- `not_started`
- `pending`
- `synced`
- `retry_required`
- `failed`
- `not_applicable`

Additional routing RPCs:

- `POST /rest/v1/rpc/override_sales_assignment`
- `POST /rest/v1/rpc/update_sales_assignment_sync`

Current analytics/operations views:

- `public.current_sales_queue`
- `public.sdr_sales_queue`
- `public.ae_sales_queue`
- `public.unassigned_sales_queue`
- `public.hot_sales_leads`
- `public.sales_handoff_queue`

---

# 33. MX Service Contract

Local health endpoint:

```text
GET http://localhost:9001/health
```

Expected response:

```json
{
  "ok": true
}
```

MX logic is used in outbound gating.

---

# 34. HubSpot Integration Contract

Current purposes include:

- qualified inbound contact synchronization
- deal creation
- outbound contact synchronization
- reply-to-deal processing

Known environment variable names may include:

```text
HUBSPOT_BASE_URL
HUBSPOT_ACCESS_TOKEN
```

Never store real values in this file.

---

# 35. Slack Integration Contract

Slack is used for operational and sales alerts.

Examples include:

- qualified lead
- nurture
- ready-to-push
- outreach sent
- reply/deal creation

Configuration may use:

```text
SLACK_WEBHOOK_URL
```

Never document the real webhook value.

---

# 36. Brevo Integration Contract

Brevo supports:

- nurture email sending
- outbound outreach sending

Sending may be environment-gated.

Safe tests must avoid unintended real email delivery.

---

# 37. Hookdeck Integration Contract

Hookdeck provides inbound webhook reliability.

Known configuration names may include:

```text
HOOKDECK_API_KEY
HOOKDECK_SIGNING_SECRET
HOOKDECK_SOURCE_URL
```

Never document real values.

---

# 38. Firebase Client Configuration

Current client configuration uses public Firebase environment names such as:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

These are client configuration values, not Supabase service-role credentials.

---

# 39. Firebase Admin / Supabase Server Configuration

Current server-side configuration includes safe variable names such as:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON
PAYU_MERCHANT_KEY
PAYU_SALT
PAYU_ENV
PAYU_BASE_URL
```

Rules:

- never expose service-role credentials to browser code
- never prefix protected server secrets with `NEXT_PUBLIC_`
- never print secret values
- never commit real secrets

PayU rule:

- `PAYU_ENV` must remain `test`
- `PAYU_SALT` must remain server-only

---

# 40. PayU TEST Billing Foundation

Current billing implementation uses a TEST-only PayU workflow with persisted transaction and account-plan state.

Implemented routes:

```text
POST /api/billing/payu/checkout
POST /api/billing/payu/webhook
```

Current checkout contract:

- validates authenticated user context
- validates the canonical server-side plan catalog
- creates a test transaction id
- generates a PayU Hosted Checkout request hash server-side
- returns safe form-post data for `https://test.payu.in/_payment`
- persists a pending billing transaction
- moves the account plan into `pending_payment`
- does not expose `PAYU_SALT`

Current webhook contract:

- accepts PayU callback payloads
- validates the reverse hash server-side
- rejects tampered payloads
- returns a normalized internal result
- persists verified payment state idempotently
- activates or fails the account plan from the verified webhook result
- does not trust browser success/failure redirects

Current boundary:

- no live billing behavior
- no recurring live subscription charging
- no invoice automation
- PayU dashboard webhook-visibility inconsistency remains non-blocking technical debt

---

# 40.1 Customer Health Retention Contract

Phase 7 adds one account-centric retention and expansion runtime.

Canonical SQL surfaces:

- `public.account_health_signal_assembly`
- `public.evaluate_account_health(uuid, text)`
- `public.customer_health_evaluations`
- `public.current_customer_health`
- `public.at_risk_accounts`
- `public.dormant_accounts`
- `public.payment_risk_accounts`
- `public.expansion_ready_accounts`
- `public.intervention_needed_accounts`
- `public.recently_activated_accounts`
- `public.customer_health_metrics`

Current evaluation states:

- `health_state`: `healthy` | `watch` | `at_risk` | `critical`
- `lifecycle_state`: `new` | `onboarding` | `newly_activated` | `activated` | `low_adoption` | `dormant` | `churned`
- `churn_risk`: `low` | `medium` | `high` | `critical`
- `expansion_state`: `none` | `watch` | `expansion_candidate` | `upgrade_ready` | `sales_followup`

Current authoritative churn rule:

- `churned` is not inferred from inactivity alone
- authoritative churn currently requires an explicit account-plan cancellation state such as `cancelled_at`

Representative `evaluate_account_health(...)` result shape:

```json
[
  {
    "evaluation_id": "uuid",
    "account_id": "uuid",
    "health_score": 82,
    "health_state": "healthy",
    "lifecycle_state": "activated",
    "churn_risk": "low",
    "expansion_score": 61,
    "expansion_state": "expansion_candidate",
    "recommended_action": "monitor",
    "recommended_lead_id": 123,
    "recommended_owner_type": "ae",
    "authoritative_churned": false,
    "needs_intervention": false,
    "evaluated_at": "2026-08-27T00:00:00.000Z"
  }
]
```

Current behavior:

- activation is reused as a health input and is not rescored separately
- billing state is reused from existing `account_plans` and `billing_transactions`
- qualification and sales context are reused from existing Phase 4 and Phase 5 views
- expansion handoff stays compatible with existing routing by returning recommended lead and owner context instead of creating a second routing engine

# 41. Retool API Position

No Retool UI source is stored in this repository, but the backend query-contract layer now exists.

Current backend design:

```text
Supabase GTM Analytics Views
+ existing safe RPCs
+ HubSpot
+ n8n
+ Product Events
+ Attribution
→ Retool RevOps Command Center
```

Retool should consume stable contracts.

It must not become the primary data store.

Implemented read contracts include:

- `public.gtm_executive_summary`
- `public.gtm_lifecycle_funnel`
- `public.gtm_acquisition_conversion_metrics`
- `public.gtm_acquisition_first_touch_mix`
- `public.gtm_acquisition_last_touch_mix`
- `public.gtm_qualification_summary`
- `public.gtm_qualification_distribution`
- `public.gtm_sales_workload_summary`
- `public.gtm_product_summary`
- `public.gtm_customer_health_summary`
- `public.gtm_lead_volume_trend`
- `public.gtm_account_lifecycle_trend`
- `public.gtm_spend_trend`
- `public.gtm_customer_health_trend`
- `public.gtm_sales_assignment_activity_trend`

Retool-safe operational actions must continue to reuse canonical RPCs such as:

- `public.evaluate_lead_qualification(...)`
- `public.route_lead_to_sales(...)`
- `public.override_sales_assignment(...)`
- `public.evaluate_account_health(...)`

---

# 42. Product Provider Management APIs

## Endpoint

```text
POST /api/product/providers
```

## Purpose

Manages real provider connection metadata for the authenticated account.

Supported actions:

```json
{ "action": "add", "provider": "deepseek" }
```

```json
{ "action": "disconnect", "id": "provider-connection-uuid" }
```

```json
{ "action": "reconnect", "id": "provider-connection-uuid" }
```

```json
{ "action": "remove", "id": "provider-connection-uuid" }
```

Authentication:

```text
Authorization: Bearer <Firebase ID token>
```

Security behavior:

- provider mutation is scoped to the authenticated account
- raw provider API keys are not accepted or returned by this route
- `remove` is a soft management removal and preserves historical `usage_records`
- DeepSeek/LiteLLM is the only currently active provider setup path

---

# 43. Product Provider Usage Limit API

## Endpoint

```text
POST /api/product/provider-limits
```

## Purpose

Persists configured provider usage allowances and calculates quota consumption from real `usage_records`.

Request:

```json
{
  "provider_connection_id": "provider-connection-uuid",
  "limit_type": "tokens",
  "limit_amount": 1000000,
  "limit_period": "monthly",
  "threshold_percentage": 70,
  "enabled": true
}
```

Supported `limit_type` values:

- `tokens`
- `requests`
- `cost_credits`

Supported `limit_period` values:

- `daily`
- `weekly`
- `monthly`

Authentication:

```text
Authorization: Bearer <Firebase ID token>
```

Security behavior:

- writes are scoped to the authenticated account
- quota rules store allowance metadata only
- actual usage is calculated from existing `usage_records`
- provider secrets remain server-side

---

# 44. API / Contract Change Rule

Whenever implementation adds or changes:

- API routes
- webhooks
- RPCs
- event names
- event payloads
- acquisition fields
- database write contracts
- integration payloads

Required process:

```text
Implement
→ Test
→ Verify
→ Update API_SPEC.md
```

Do not document speculative payloads as live contracts.

---

# 45. Security Rule

Never store in this file:

- API keys
- access tokens
- passwords
- private keys
- service-role values
- real webhook secrets
- session tokens
- production credentials

Use variable names and sanitized examples only.

---

# 46. Current Contract Status

Implemented:

- Firebase profile sync API
- onboarding API
- product events API
- PayU TEST checkout API
- PayU TEST webhook API
- product provider management API
- product provider usage limit API
- account health evaluation RPC
- customer health / retention queue views
- GTM analytics read-model views for Retool/backend command-center consumption
- hosted synthetic demo harness for canonical reset/seed/reseed/validate/benchmark operations
- Pre-CRM webhook
- Pre-CRM RPCs
- Gemini scoring contract
- MX health contract
- unified AcquisitionEnvelope

Not yet implemented:

- public partner persistence API
- public creator persistence API
- public referral persistence API

These should be documented only after implementation.
```
