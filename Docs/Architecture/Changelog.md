> LEGACY / HISTORICAL REFERENCE
>
> This document is not a current master project-memory file.
>
> Current source of truth:
> `CODEX.md`, `TASK.md`, `STATE.md`, `ARCHITECTURE.md`, `Docs/Architecture/API_SPEC.md`, `CHANGELOG.md`, `README.md`, `FILE_STRUCTURE.md`

# Changelog.md — System Evolution

**Why this file is used:** A record of the system's evolution — versions, features added, and fixes. Future clients and future-you can see how the engine matured.

## V2.0 — Hookdeck Reliability Gateway + AI Scoring (current, in progress)

**Added:**
- Hookdeck as Module 0 webhook reliability gateway (design from `gtmops_architecture_blueprint.pdf` V2.0): queueing, rate-throttling, dead-letter queue + automatic retries during downstream outages
- Gemini AI scoring module (`Revops/AI_Qualification/ai-qualification-score.ts`): strict-JSON ICP scoring (icp_score 0–100, buying_intent, personalized_icebreaker), temperature 0.2
- n8n ingestion workflow draft: Webhook → Sanitize Lead → Is Sanitized? → Supabase insert
- `.clinerules` (coding standards, security-first, RevOps business logic)
- `.env.example` + hardened `.gitignore`
- docker-compose for n8n with `host.docker.internal:host-gateway` mapping

**Fixes:**
- Networking: local n8n → Supabase connectivity fixed by using the OrbStack bridge instead of `127.0.0.1` (container → host routing)
- `staged_leads` GRANTs: explicit `service_role` grants added because newer Supabase no longer auto-exposes new tables to API roles
- Git repo: was initialized at `~` (home dir) — re-initialized inside the project folder; stray `~/.git` backed up
- n8n Supabase node params: converted from old `columns` format to current `dataToSend`/`fieldsUi.fieldValues` + `tableId`/`operation: create` (old `table`/`insert` params caused "Could not get parameter tableId" and "null value in column event_id" errors)
- n8n workflow versioning: PATCHes create new versions — must `n8n publish:workflow --id=1` + restart for webhooks to use them
- package.json: `simulate` script pointed at `.js` but file is `.cjs` — fixed

**Verified (first end-to-end run, Aug 2026):**
- Valid lead → sanitized (email normalized, whitespace stripped) → inserted into `staged_leads`
- Rejected lead (@tempmail.com + control chars) → dropped, not inserted
- Duplicate `event_id` → blocked by unique constraint

**Hardening (Stage 3 dedup + Stage 5 anti-ICP + Stage 1 fail-logging), verified:**
- Migration 02: `staged_leads.status`, `lead_events` timeline, `spam_log` + RPC helpers `get_or_create_lead` (returns lead_id + is_new), `append_lead_event`, `log_spam`
- seed.sql added (was referenced in config.toml but missing)
- Sanitizer extended: student domains (`.edu` + academic TLDs), competitor domains, blocked jurisdictions → 12/12 unit tests
- Workflow rebuilt on RPC calls (HTTP Request nodes + service-role header credential) — fixes the n8n zero-item trap where a Supabase lookup returning 0 rows silently killed the branch
- E2E verified: new email → inserted with status 'new'; repeat email → NO duplicate row, `lead.captured.duplicate` event appended; rejected leads → `spam_log` with reason

**Stage 6 — Gemini AI Scoring wired into n8n (verified live, Aug 2026):**
- Real `.env` created (gitignored): `GEMINI_API_KEY` + local Supabase service-role key; `docker-compose.yml` interpolates `GEMINI_API_KEY`/`GEMINI_ENDPOINT` from it (no secrets in tracked files)
- Model refresh: gemini-1.5-flash and gemini-2.0-flash are RETIRED from generateContent (404) — moved to `gemini-2.5-flash`; `thinkingConfig.thinkingBudget: 0` required because 2.5-flash's default thinking consumes the output budget and truncates JSON (`MAX_TOKENS`)
- Migration 03: `staged_leads.buying_intent` column + `update_lead_score` RPC (persists icp_score/buying_intent/personalized_icebreaker/status + appends `lead.scored` event)
- Migration 04: `append_lead_event`/`log_spam`/`update_lead_score` now return `[{ok:true}]` — the void RPCs returned 204 + empty body, and n8n's `responseFormat: json` threw a JSON parse error that killed the branch AFTER the DB write (this is why earlier runs "worked" but showed `status: error`)
- Migration 05: unique index on `lower(email)` + `get_or_create_lead` rewritten with `ON CONFLICT (lower(email)) DO NOTHING` — two webhooks arriving within the same second used to both pass the SELECT and create duplicate rows; now the loser returns the winner's row (`is_new:false`)
- Workflow grew to 10 nodes: Webhook → Sanitize → IF → Dedup RPC → Append Event → **Score (build prompt)** → **Call Gemini API** (HTTP node, `?key={{ $env.GEMINI_API_KEY }}`) → **Parse & validate** → **Update Lead Score RPC** | Log Spam
- n8n 2.34 pitfalls hit & fixed: Code-node sandbox exposes neither `process.env` nor `this.getCredentials`; expressions only evaluate when the parameter starts with `=`; `$env` in expressions is blocked by `N8N_BLOCK_ENV_ACCESS_IN_NODE` (default true) → set `false` in compose (local dev only); n8n login API field is now `emailOrLdapLoginId` (not `email`)
- E2E verified (all executions SUCCESS): new lead + firmographics → icp_score 70 / buying_intent medium / status qualified / icebreaker written + `lead.scored` event; duplicate → NOT re-scored, only `lead.captured.duplicate`; no-firmographics lead → inserted, status 'new', not scored; temp-mail → `spam_log`

**Stage 0 — Hookdeck reliability gateway (verified live, Aug 2026):**
- CLI logged in with project API key (`hookdeck ci`); source `hookdeck-lead-ingest` + CLI destination created automatically by `hookdeck listen`
- Tunnel: `https://hkdk.events/3at57n99zasz2d` → `http://localhost:5678/webhook/hookdeck-lead-ingest` (path pinned via `--path` flag)
- `HOOKDECK_API_KEY` + `HOOKDECK_SOURCE_URL` added to gitignored `.env`; restart helper `Automation/Hookdeck/start_hookdeck.sh` (tunnel is session-bound)
- E2E through Hookdeck verified: ack 200 → delivered → n8n → Gemini → Supabase (lead 61 scored 85/high/qualified, execution SUCCESS)
- Frontend forms should now post to the Hookdeck URL, not the raw n8n webhook

**Repo hygiene (Aug 2026):**
- Initial commit `6529438` pushed to private GitHub repo `github.com/m-irfvnnn/pre-crm-engine` (secrets scan clean; `.env` gitignored; n8n dev password scrubbed from State.md)

**Stage 4 — company enrichment (ACTIVATED + verified live, Aug 2026):**
- Provider: Apollo (`POST /v1/organizations/enrich`). Two auth discoveries: Apollo requires the key in the `X-Api-Key` HEADER (body/query rejected), and n8n 2.34.5 only sends custom headers on HTTP Request **typeVersion 2 with `headerParametersJson`** (when `jsonParameters: true`) — v4 nodes, `options.headers`, `headersUi`, and httpHeaderAuth credentials are all silently dropped (verified via local echo server + httpbin)
- Migration 07: `update_lead_score` gains `p_firmographics` — enriched firmographics now persisted on the lead (previously only used in the Gemini prompt)
- `ENRICH_API_KEY` (n8n credential `Apollo API Key (dev)` created but unused — header via env expression instead) + `ENRICH_BASE_URL` in gitignored `.env`
- Live E2E: test12@duck.com → deliverable → Apollo enrich duck.com → firmographics persisted `{industry: "information technology & services", employees: 490, country: "United States", city: "Paoli", enriched_by: "apollo"}` → Gemini scored 75/medium → qualified. Execution SUCCESS
- Placement: enrichment runs only for NEW + deliverable leads (after verification, before scoring) — never wastes credits on duplicates/bounces; form firmographics preserved, org fills gaps
- Provider: Emailable (250 free credits, any-email signup; `?api_key=` query param). Two earlier providers rejected: Abstract (keys returned "Invalid API key" server-side) and Hunter (requires professional email at signup) — normalizer still supports Abstract/Hunter/ZeroBounce/mailboxlayer shapes (19/19 unit tests)
- `EMAIL_VERIFY_API_KEY` + `EMAIL_VERIFY_BASE_URL` added to gitignored `.env` + compose interpolation → n8n container env (container recreated)
- Live E2E both ways: `test@duck.com` (deliverable/accepted_email) → verification passed → Gemini scored qualified (85/medium); `fake.user123@no-such-domain-xyz.com` (invalid_domain) → `mark_lead_unverified` → status `unverified` + `lead.verification.failed` event, never scored. Both executions SUCCESS
- Note: modern providers mark most big-mailbox probes (Gmail/iCloud/Outlook, role accounts) undeliverable/risky — the conservative unverified tagging is intentional CRM hygiene
- Caveat: Emailable's free 250 credits are one-time; fine for dev/demo, top up later for real volume

**Stage 5 — blocked-jurisdiction enforcement (IMPLEMENTED + verified live, Aug 2026):**
- Two enforcement layers. (1) At the door: the sanitizer now USES its long-defined `BLOCKED_JURISDICTIONS` set — any payload carrying `country_code` or `country` in a blocked jurisdiction (KP/IR/CU/SY/BY/RU/VE/MM/SD/ZW) is rejected with reason `blocked_jurisdiction` → spam_log, zero credits spent. (2) Post-enrichment backstop: new `Check Jurisdiction` node maps enrichment-revealed country (Apollo returns country as a NAME, e.g. "Russia"/"Russian Federation"; name→ISO alias map shared with the sanitizer) → `Jurisdiction OK?` IF → `Block Jurisdiction` RPC
- Migration 08: `mark_lead_blocked` RPC — status `disqualified` + `lead.blocked.jurisdiction` timeline event. Blocked leads are stored but NEVER scored/CRM'd
- Unit tests: sanitizer 17/17 (5 new jurisdiction cases), jurisdiction node 30/30 (names, codes, lowercase, aliases, allowed countries, empty firmographics)
- Live E2E (3 paths): RU code in payload → spam_log `blocked_jurisdiction`; deliverable rediffmail with Russia firmographics → status `disqualified`, icp_score NULL, `lead.blocked.jurisdiction` event; NEW duck.com lead → still enriched + scored 75/qualified. Workflow grew 18 → 21 nodes
- Finding: blocked-country email domains (yandex.ru, mail.ru, vk.com, yandex.com) are undeliverable/risky per Emailable — the door check is the primary shield; the post-enrichment path fires via form-provided firmographics or future enrichment providers

**Module 4 — CRM routing + Slack alerts (IMPLEMENTED + verified live, Aug 2026):**
- `CRM Ready?` IF after scoring: icp_score >= 70 (deliverability already guaranteed upstream by Stage 2) → HubSpot chain; else → `Slack Alert: Nurture` (no CRM touch)
- HubSpot chain: `HubSpot: Upsert Contact` (POST /crm/v3/objects/contacts?&idProperty=email — upserts by email, returns contact id) → `HubSpot: Create Deal` (POST /crm/v3/objects/deals with inline association to the contact) → `Slack Alert: Qualified Lead` with score/intent/icebreaker/deal URL (speed-to-lead)
- Key discovery: the deal→contact association type id is **3** (`deal_to_contact`) on this portal — type 5 ("contact_to_deal") is rejected with INVALID_FROM_OBJECT. Verified via /crm/v3/associations/deals/contacts/types. Inline associations work (201 + linked), but a STALE contact id from an earlier failed run also 400s — always use a freshly upserted contact id from the previous node
- Slack incoming webhook responds with plain text `ok` — the Slack HTTP nodes use `responseFormat: text`, NOT json (would throw a parse error otherwise)
- `HUBSPOT_ACCESS_TOKEN` (private app, free CRM plan) + `SLACK_WEBHOOK_URL` (free Slack plan, incoming webhook) in gitignored `.env` + compose interpolation → container env
- Live E2E (both executions SUCCESS): test20@duck.com → scored 75/qualified → HubSpot deal "DuckDuckGo Inc — PreCRM" + contact test20@duck.com + deal_to_contact association + Slack qualified alert; test1@rediffmail.com → scored 0/nurture → Slack nurture alert, NO HubSpot deal. Workflow grew 21 → 26 nodes

**Module 4 follow-up — nurture emails via Brevo (IMPLEMENTED + verified live, Aug 2026):**
- Env-gated on `BREVO_API_KEY` (free tier: 300 emails/day, no credit card, personal email OK as sender — verified live: account m.irfvnnn@gmail.com, plan free, sender Mohammad Irfan verified). Gate off → nurture = Slack notice only (prior behavior preserved)
- Chain on the nurture branch: `Send Nurture Email?` IF → `Build Nurture Email` (Code: prompt builder, 11/11 tests) → `Call Gemini (Nurture Email)` → `Parse Nurture Email` (Code: strict-JSON extractor with fallback template, 11/11 tests) → `Send Nurture Email (Brevo)` (POST /v3/smtp/email, `api-key` header via v2 headerParametersJson) → `Log Nurture Email` (`append_lead_event` → `lead.nurture.email.sent` timeline event)
- Model centralized: both Gemini nodes now use `$env.GEMINI_ENDPOINT` (was hardcoded per-node). **Moved to gemini-2.5-flash-lite** — 2.5-flash's free-tier daily quota exhausted mid-session under E2E load (429 quota exceeded); lite has a separate, higher pool (verified: scoring 85/high, nurture email writing, both strict JSON)
- Live E2E: contact@rediffmail.com → scored 15/nurture → Gemini wrote subject "Quick thought on retail efficiency" → Brevo sent (201) → `lead.nurture.email.sent` logged. Execution SUCCESS. Workflow grew 26 → 32 nodes
- Two bugs hit during E2E (both fixed): Build Nurture Email didn't pass `email` through (Brevo rejected with "email is missing in to"); Log Nurture Email read `$json` from the Brevo response instead of `$('Parse Nurture Email')` (PostgREST "could not find the function" — undefined p_lead_id dropped the key)

## V1.0 — Staging Foundations (initial build)

**Added:**
- Supabase local project (`Pre-CRM_Engine`) with migration 01: `staged_leads` table (event_id unique, email, company_name, raw_payload, firmographics, icp_score, personalized_icebreaker, timestamps), email + icp_score indexes, `set_updated_at` trigger, RLS with service_role policy
- Ingestion & Sanitization logic: email regex validation, disposable-domain blocklist (20 providers), personal-domain blocklist (15 providers), malformed-text/control-character stripping
- Webhook simulator (`Automation/Webhooks/simulate_webhook.cjs`) with synthetic VALID + REJECTED payloads
- TypeScript scaffold (tsconfig, package.json, `npm run typecheck`/`build`/`simulate`)

## Roadmap (unreleased)
- V2.1: email deliverability verification (Stage 2), dedup/identity stitching (Stage 3)
- V2.2: enrichment waterfall (Stage 4), anti-ICP hard exclusions (Stage 5), Gemini wired into n8n (Stage 6)
- V3.0: Module 4 smart routing — HubSpot CRM sync (≥70), Slack alerts, speed-to-lead channels (voice/SMS/email), nurture flow, HITL takeover
