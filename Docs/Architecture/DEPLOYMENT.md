> LEGACY / HISTORICAL REFERENCE
>
> This deployment guide remains useful reference material, but it is not a current master project-memory file.
>
> Current source of truth:
> `CODEX.md`, `TASK.md`, `STATE.md`, `ARCHITECTURE.md`, `Docs/Architecture/API_SPEC.md`, `CHANGELOG.md`, `README.md`, `FILE_STRUCTURE.md`

# CostPilot — Local Demo Operations & Deployment Reference

**Why this file is used:** This is the manual for taking this project from an empty machine (or a fresh company laptop, or a client's server) to a fully working pipeline. It covers every account you need, every API key and where to get it, the exact `.env` configuration, bring-up order, how to verify the install, and how to troubleshoot common failures.

> Target audience: a developer (me, a teammate, or a client's engineer) who has never seen this project. If you follow this top to bottom, it works.

---

## 1. What you are deploying

CostPilot currently uses hosted Supabase as the source of truth, local Docker services for n8n/LiteLLM/MX, Firebase Auth in the Next.js app, Retool for internal analytics, HubSpot/Slack/Brevo/Hookdeck for GTM integrations, DeepSeek through LiteLLM for AI telemetry, and PayU TEST for sandbox billing flows.

```
Form/webhook → Hookdeck → n8n → hosted Supabase
             → qualification/routing → HubSpot + Slack + optional Brevo
             → Retool internal views
             → product app reads hosted Supabase
```

Use synthetic/demo data for validation. Do not run real outbound campaigns from the local demo stack.

---

## 2. Prerequisites (software on the machine)

| Requirement | Why | Install |
|---|---|---|
| Docker / OrbStack | Runs n8n (and Supabase on macOS via OrbStack) | macOS: [OrbStack](https://orbstack.dev). Windows/Linux: [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| Supabase CLI | Applies hosted migrations and checks migration history | `brew install supabase/tap/supabase` (macOS) |
| Hookdeck CLI | Creates the webhook tunnel | `brew install hookdeck/hookdeck/hookdeck` (macOS) or `curl -sSL https://cli.hookdeck.com/install | bash` |
| Node.js 18+ | Unit tests, simulator, workflow builder | `brew install node` or [nodejs.org](https://nodejs.org) |
| Python 3 | The workflow builder script | Preinstalled on macOS (`python3`) |
| `git` + a GitHub account | Clone the repo, push changes | Standard |

Verify: `docker --version`, `supabase --version`, `hookdeck version`, `node --version`, `python3 --version`.

---

## 3. Accounts & API keys (every key you need, and where to get it)

> **Rule:** ALL secrets live in the gitignored `.env` file — never in code, never committed, never pasted into the n8n UI unless via env expression. The workflow reads them from the container environment.

| # | Service | Env var(s) | Where to get it | Free tier | Notes |
|---|---|---|---|---|---|
| 1 | **Gemini API** | `GEMINI_API_KEY`, `GEMINI_ENDPOINT` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Free | Model: `gemini-2.5-flash-lite` (high free quota). 1.5/2.0 flash are retired; 2.5-flash works but exhausts daily quota fast — keep flash-lite |
| 2 | **Emailable** (email verify) | `EMAIL_VERIFY_API_KEY`, `EMAIL_VERIFY_BASE_URL` | [app.emailable.com](https://app.emailable.com) → API | 250 one-time credits | Any email signup works (personal OK). `BASE_URL=https://api.emailable.com/v1/verify` |
| 3 | **Apollo** (enrichment) | `ENRICH_API_KEY`, `ENRICH_BASE_URL` | [app.apollo.io](https://app.apollo.io) → API settings | Free starter | Key goes in the `X-Api-Key` HEADER (not body/query). `BASE_URL=https://api.apollo.io/v1/organizations/enrich` |
| 4 | **HubSpot** (CRM) | `HUBSPOT_ACCESS_TOKEN`, `HUBSPOT_BASE_URL` | HubSpot → Settings → Integrations → **Private Apps** → Create private app (scopes: contacts read/write, deals read/write) | Free CRM plan | Token shown ONCE at creation — copy it then. `BASE_URL=https://api.hubapi.com` |
| 5 | **Slack** (alerts) | `SLACK_WEBHOOK_URL` | [api.slack.com/apps](https://api.slack.com/apps) → Create app → Incoming Webhooks → Add New Webhook to Workspace | Free plan | Store the full webhook URL only in `.env`; never paste it into docs or workflow exports. |
| 6 | **Brevo** (nurture email) | `BREVO_API_KEY`, `BREVO_BASE_URL`, `BREVO_SENDER_NAME`, `BREVO_SENDER_EMAIL` | [brevo.com](https://www.brevo.com) → Settings → API Keys; **and** Settings → Senders → Add + **verify** your sender email | 300 emails/day | ⚠️ The sender email must be verified (click the email Brevo sends) or the API rejects sends. `BASE_URL=https://api.brevo.com/v3/smtp/email` |
| 7 | **Hookdeck** (gateway) | `HOOKDECK_API_KEY`, `HOOKDECK_SOURCE_URL` | [dashboard.hookdeck.com](https://dashboard.hookdeck.com) → CLI/API keys | Free starter | Used by `Automation/Hookdeck/start_hookdeck.sh`. `SOURCE_URL` = your `https://hkdk.events/…` source |
| 8 | **Hosted Supabase** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase hosted project settings | Hosted project | Current project: `uivrfaqghtgawgyesnap`. Keep service-role server-side only. |
| — | (optional) | `HOOKDECK_SIGNING_SECRET` | Hookdeck dashboard → Source → Signing | — | Only if you enable payload signing |

> **If a provider is missing/unset:** the pipeline degrades gracefully. No `EMAIL_VERIFY_API_KEY` → verification gate off (leads pass straight through). No `ENRICH_API_KEY` → enrichment off. No `BREVO_API_KEY` → nurture = Slack notice only. No `HUBSPOT_ACCESS_TOKEN`/`SLACK_WEBHOOK_URL` → routing stops after scoring. Everything is env-gated by design.

---

## 4. The `.env` file (full reference)

Copy the template and fill it in:

```bash
cp .env.example .env
```

Complete variable reference:

```ini
# ---------- App ----------
NODE_ENV=development
PORT=5678

# ---------- Hosted Supabase ----------
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…        # server-side only; never expose in browser/client bundles

# ---------- n8n ----------
N8N_HOST=localhost
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_SECURE_COOKIE=false
WEBHOOK_URL=http://localhost:5678/
N8N_ENCRYPTION_KEY=…               # any long random string; keep stable across restarts
N8N_USER_MANAGEMENT_JWT_SECRET=…

# ---------- Hookdeck ----------
HOOKDECK_API_KEY=…
HOOKDECK_SOURCE_URL=https://hkdk.events/…   # your public source URL
# HOOKDECK_SIGNING_SECRET=…        # optional, only with signing enabled

# ---------- Gemini (AI scoring + nurture email copy) ----------
GEMINI_API_KEY=…
GEMINI_ENDPOINT=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent

# ---------- Email verification (Stage 2) ----------
EMAIL_VERIFY_API_KEY=…             # empty = gate off
EMAIL_VERIFY_BASE_URL=https://api.emailable.com/v1/verify

# ---------- Enrichment (Stage 4) ----------
ENRICH_API_KEY=…                   # empty = gate off
ENRICH_BASE_URL=https://api.apollo.io/v1/organizations/enrich

# ---------- HubSpot (Module 4) ----------
HUBSPOT_ACCESS_TOKEN=…             # private app token
HUBSPOT_BASE_URL=https://api.hubapi.com

# ---------- Slack (Module 4) ----------
SLACK_WEBHOOK_URL=…

# ---------- Brevo nurture emails (Module 4 follow-up) ----------
BREVO_API_KEY=…                    # empty = nurture = Slack notice only
BREVO_BASE_URL=https://api.brevo.com/v3/smtp/email
BREVO_SENDER_NAME=Your Name
BREVO_SENDER_EMAIL=your-verified-sender@example.com

# ---------- Synthetic test payload (dev only) ----------
TEST_LEAD_EMAIL=alex@ai-labs.io
```

**Changing any key later:** edit `.env`, then recreate the container so the new env lands:

```bash
docker compose up -d     # recreate, NOT just restart
docker exec revops_n8n printenv EMAIL_VERIFY_API_KEY   # verify it landed (len > 0)
```

> ⚠️ `docker compose restart` does NOT pick up .env changes — you must recreate with `up -d`.

---

## 5. Bring-up order (fresh machine)

```bash
# 1. Clone
git clone https://github.com/m-irfvnnn/pre-crm-engine.git
cd pre-crm-engine

# 2. Environment
cp .env.example .env
# … fill in every key from §3 / §4 …

# 3. Database (hosted Supabase)
# Link the Supabase CLI project once, then apply migrations with supabase db push.
# Do not start local Supabase for the current recruiter demo stack.

# 4. n8n (from repo root)
docker compose up -d           # starts n8n on http://localhost:5678
# wait for health: curl http://localhost:5678/healthz → 200

# 5. Workflow
# Option A (recommended, reproducible): python3 Automation/n8n/Builders/build_workflow.py
#   → regenerates Automation/n8n/Inbound/lead-ingestion-qualification.workflow.json from the code nodes
# Then import Automation/n8n/Inbound/lead-ingestion-qualification.workflow.json in the n8n UI (Workflows → ⋯ → Import),
#   re-select credentials/env references if needed,
#   and activate the workflow.
# Option B: if the workflow JSON was exported from an existing instance,
#   import it and re-map credentials — then publish + restart n8n.

# 6. Hookdeck tunnel (from repo root)
Automation/Hookdeck/start_hookdeck.sh    # reconnects https://hkdk.events/… → localhost:5678

# 7. Verify (see §7)
node Automation/n8n/Tests/test-sanitize.cjs && node Automation/n8n/Tests/test-jurisdiction.cjs
```

---

## 6. The n8n login (first time)

The workflow container has its own user store. On first boot, create the owner account in the browser (localhost:5678) or via the API. The login endpoint in n8n 2.34 uses:

```bash
curl -s -c /tmp/n8n-cookies.txt -H "Content-Type: application/json" \
  -d '{"emailOrLdapLoginId":"dev@precrm.local","password":"…"}' \
  http://localhost:5678/rest/login
```

> n8n 2.34 quirk: the login field is `emailOrLdapLoginId` (not `email`), and the REST API needs ~5s extra after `healthz` returns 200 before login works.

---

## 7. Verification checklist (prove it works)

### 7.1 Unit tests (no network needed)
```bash
node Automation/n8n/Tests/test-sanitize.cjs        # expect: 17 passed
node Automation/n8n/Tests/test-jurisdiction.cjs    # expect: 30 passed
node Automation/n8n/Tests/test-nurture-prompt.cjs  # expect: 11 passed
node Automation/n8n/Tests/test-nurture-parse.cjs   # expect: 11 passed
```

### 7.2 End-to-end (the real path)
```bash
# Send a synthetic lead through the FULL pipeline (Hookdeck → n8n → … → HubSpot/Slack)
curl -s -X POST "$HOOKDECK_SOURCE_URL" -H "Content-Type: application/json" -d '{
  "event_id": "evt_demo_'"$(date +%s)"'",
  "email": "test20@duck.com",
  "company_name": "DuckDuckGo Inc",
  "raw_payload": {"source": "deploy-check"},
  "firmographics": {}
}'
```

Expected chain of evidence:
1. **Hookdeck** returns `{"status":"SUCCESS",…}` (ack 200)
2. **n8n** execution status = `success` (Workflows → Executions)
3. **Supabase** `staged_leads` has a new row (status `qualified`, icp_score ≥ 70, firmographics with `enriched_by: "apollo"`)
4. **Timeline** (`lead_events`) has `lead.captured` + `lead.scored`
5. **HubSpot** has a new deal + contact (associated)
6. **Slack** channel received the qualified-lead alert
7. (nurture path, score < 70) **Brevo** sent a Gemini-written email + `lead.nurture.email.sent` timeline event

> `test20@duck.com` is a known-deliverable synthetic test address (Emailable says deliverable; Apollo enriches duck.com → DuckDuckGo). Use synthetic addresses only — never real PII in dev.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| n8n execution shows `error`, nothing in DB | Execution data opaque; check the decoded message | Pull `/rest/executions/<id>`, decode `data` as flatted-JSON (see repo history) or just re-run with a fresh event_id |
| `The service is receiving too many requests` / `quota exceeded` from Gemini | Free-tier daily quota exhausted (2.5-flash is low) | Switch `GEMINI_ENDPOINT` to `gemini-2.5-flash-lite` (separate higher pool) and `docker compose up -d` |
| Brevo: `email is missing in to` | Nurture prompt node didn't pass `email` through | Rebuild workflow from code nodes (`python3 Automation/n8n/Builders/build_workflow.py`) — fixed in current source |
| PostgREST: `Could not find the function …` | A node sent `undefined` params (e.g. `$json` was the last HTTP response, not your data) | Reference earlier nodes explicitly: `$('Parse Nurture Email').first().json.lead_id` |
| Custom header not sent (Apollo/HubSpot auth fails) | n8n 2.34.5 silently drops headers on v4 nodes / credentials / `options.headers` | Use HTTP Request **typeVersion 2** with `jsonParameters: true` + `headerParametersJson` (as in `build_workflow.py`) |
| HubSpot deal create → `INVALID_FROM_OBJECT` | Wrong association type id | Use **3** (`deal_to_contact`); verify via `GET /crm/v3/associations/deals/contacts/types` |
| Slack node errors on JSON parse | Slack replies plain-text `ok` | Node must use `responseFormat: text` |
| Duplicate rows for same email | Pre-migration-05 race | Unique index `lower(email)` + `ON CONFLICT` — already in migrations; re-run `supabase migration up` |
| Supabase RPC returns 204 empty → n8n branch dies | Void RPC + `responseFormat: json` | All RPCs return `[{ok:true}]` (migrations 04+) — re-apply migrations |
| Hookdeck URL dead after reboot | Tunnel is session-bound | `Automation/Hookdeck/start_hookdeck.sh` |
| Env var empty in container | `.env` change without recreate | `docker compose up -d` (not restart) |

---

## 9. Security checklist (before sharing / selling)

- [ ] `.env` is gitignored — verify `git status` never shows it, and `git ls-files | grep .env` shows only `.env.example`
- [ ] No API keys in any committed file (`grep -r "xkeysib\|pat-\|AIza" --include="*.json" --include="*.py" --include="*.md"` → empty)
- [ ] Workflow JSON contains no secrets (keys come from `$env.*` expressions only)
- [ ] `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` is **local-dev only** — for any shared/hosted instance, set it back to `true` and use proper n8n credentials instead
- [ ] Use synthetic test emails in dev, never real PII
- [ ] The GitHub repo is **PRIVATE** (this repo is `m-irfvnnn/pre-crm-engine`, private)

---

## 10. Handing this to a client / new machine (the selling version)

1. Clone the repo (private) onto the target machine.
2. Walk through §3 (accounts + keys) and §4 (.env) with the client — each free tier needs their own signup, or they use yours in dev first.
3. Run §5 bring-up, §7 verification.
4. Give them this manual + `Task.md`/`ARCHITECTURE.md` for context.
5. Remind them: keys are theirs, .env is never committed, and the repo has zero secrets by construction.

> To customize for a client: edit the ICP rules (`Docs/Development/.clinerules`), the jurisdiction blocklist (`Automation/n8n/Code_Nodes/n8n-ingestion-sanitize.js` + `Automation/n8n/Code_Nodes/n8n-jurisdiction-check.js`), the competitor domains, and the Slack channel/webhook. Rebuild the workflow with `python3 Automation/n8n/Builders/build_workflow.py` and redeploy.

---

## 11. v2 outbound additions (M6/M7) — ops notes

### Reply → Deal cron (workflow `YKd8JZItw9IupV2z`, every 15 min)
- Polls `get_replied_outreach` for rows `status='replied' AND deal_id IS NULL`; for each: GET the HubSpot contact by email → create a deal (`Outbound Reply — <company>`, associated via assoc type **3**) → `mark_deal_created` → Slack. Zero rows = silent no-op.
- RPCs live in `supabase/migrations/15_reply_deal.sql`.
- **Manual trigger (n8n 2.34.5 internal API — must pass an OBJECT):**
  `curl -b <cookies> -X POST http://localhost:5678/rest/workflows/YKd8JZItw9IupV2z/run -H 'Content-Type: application/json' -d '{"triggerToStartFrom":{"name":"Reply Cron: Every 15 min"}}'`
  (n8n workflow IDs are alphanumeric, not sequential ints — read the id from the POST /rest/workflows response.)

### Full-loop demo driver
`Automation/Webhooks/demo_m7_loop.cjs` reads a scrape JSON, keeps decision-makers, attaches enrichment-simulated firmographics, and posts to the outbound webhook. It maps the fixture's fictional `acmeindustries.com` emails to `example.com` (real MX) so contacts flow through to outreach + HubSpot. Fixture site stays on `acmeindustries.com` so `test-scraper-extract` (26/26) stays green.

### MX sidecar (containerized)
Runs as the `mx-service` service in docker-compose (container `revops_mx`, node:20-alpine, `restart: always`, health-checked) — auto-starts with `docker compose up -d`. n8n reaches it on the compose network as `http://mx-service:9001/mx?domain=...` (no `host.docker.internal` needed for it). It does outbound DNS only — no API keys. The compiled `dist/Automation/Local_Services/MX_Service/mx-service.js` is volume-mounted (run `npm run build` first on a fresh clone). Port 9001 is also mapped to the host for curl/debug. Standalone debugging without Docker: `npm run mx:start`. (n8n's Code-node sandbox can't use Node `dns`, hence the sidecar.)

### Email-verification in the demo (important)
- The verify stage (Emailable) correctly rejects the reserved `example.com` domain (`state=undeliverable`, reason `invalid_domain`) and the sanitizer blocks personal domains (`personal_domain`). Both are correct gate behaviour.
- For a run that reaches outreach + HubSpot, the demo uses the env-gated verify-OFF path: blank `EMAIL_VERIFY_API_KEY` in `.env` → `docker compose up -d` (recreates n8n with the new env) → run the demo → restore the key → `docker compose up -d`. Verification-ON is proven separately (the undeliverable rejection). A real, non-personal inbox you own lets the demo run with verification ON.
