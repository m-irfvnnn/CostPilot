# Phase 10 Demo State

Phase 10 demo data is synthetic only.

Do not present these records as real customers, revenue, or production transactions.

## Cohort

- version: `phase10_v1`
- synthetic prefix: `phase10_demo_`
- historical window: `2026-03-02T11:00:00.000Z` through `2026-08-29T12:00:00.000Z`
- synthetic companies: `24`
- synthetic accounts: `19`
- hosted target: `CostPilot Demo`

## Harness Commands

- seed: `node Product/Web_App/scripts/phase10-demo-harness.mjs seed`
- reset: `node Product/Web_App/scripts/phase10-demo-harness.mjs reset`
- reseed: `node Product/Web_App/scripts/phase10-demo-harness.mjs reseed`
- validate: `node Product/Web_App/scripts/phase10-demo-harness.mjs validate`
- benchmark: `node Product/Web_App/scripts/phase10-demo-harness.mjs benchmark`
- summary: `node Product/Web_App/scripts/phase10-demo-harness.mjs summary`

`reset` deletes only `phase10_demo_*` synthetic records and must not be repurposed for non-demo cleanup.

## Primary Loom Records

- primary account: `phase10_demo_partner_anchor`
  - account_id: `e3eacd41-0871-48f1-b36c-9b7bc24038ed`
- primary lead: `phase10_demo_partner_anchor_lead`
  - lead_id: `102`
- outbound opportunity: `phase10_demo_outbound_sql_1`
  - lead_id: `121`
- expansion account: `phase10_demo_referral_expand_1`
  - account_id: `2fca4782-e79e-4bea-8829-575f62acb9f9`
- budget-pressure account: `phase10_demo_budget_pressure_1`
  - account_id: `8f9cfdfc-fb93-4792-a22d-00ecf3f0a5ed`

## Expected Demo State

- `phase10_demo_partner_anchor` is paid, activated, healthy, and expansion-eligible
- `phase10_demo_outbound_sql_1` is routed into the SDR workflow
- `phase10_demo_referral_expand_1` shows healthy expansion pressure
- `phase10_demo_budget_pressure_1` shows budget pressure with upgrade/sales follow-up signals
- GTM Overview, Acquisition, Qualification, Sales, Product, and Customers pages all contain populated synthetic demo rows

## Unsupported Metrics

These remain intentionally unavailable and should stay `NULL` in analytics until canonical support exists:

- `nrr_percentage`
- `grr_percentage`
- `revenue_churn_percentage`
- `logo_churn_percentage`

## Benchmark Snapshot

Hosted benchmark on `2026-08-29`:

- `gtm_executive_summary`: `1284ms`
- `gtm_qualification_summary`: `209ms`
- `gtm_lifecycle_funnel`: `482ms`
- `gtm_product_summary`: `177ms`
- `gtm_customer_health_summary`: `174ms`
