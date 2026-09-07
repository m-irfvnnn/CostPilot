-- ============================================
-- Pre-CRM Engine — Seed Data (dev only)
-- ============================================
-- Loaded on `supabase db reset` (see config.toml db.seed.sql_paths).
-- Strictly synthetic test data — never real PII.

-- Staged leads at various pipeline states (for dev/demo visibility)
insert into public.staged_leads (event_id, email, company_name, raw_payload, firmographics, icp_score, status) values
  ('evt_seed_001', 'ceo@acme-robotics.io', 'Acme Robotics', '{"source":"seed","form":"website"}', '{"industry":"Robotics","employees":120,"funding":"Series B"}', 82, 'qualified'),
  ('evt_seed_002', 'ops@fintech-flow.com',  'Fintech Flow',   '{"source":"seed","form":"pricing"}', '{"industry":"FinTech","employees":45,"funding":"Series A"}', 74, 'qualified'),
  ('evt_seed_003', 'growth@nimbus-saas.io', 'Nimbus SaaS',    '{"source":"seed","form":"website"}', '{"industry":"SaaS","employees":18,"funding":"Seed"}', 58, 'nurture'),
  ('evt_seed_004', 'marketing@bluecollar-ai.io', 'BlueCollar AI', '{"source":"seed","form":"ebook"}', '{"industry":"AI","employees":200,"funding":"Series C"}', 91, 'qualified'),
  ('evt_seed_005', 'hello@mom-pop-store.com', 'Mom & Pop Store', '{"source":"seed","form":"contact"}', '{"industry":"Retail","employees":4,"funding":null}', 22, 'disqualified')
on conflict (event_id) do nothing;

-- Timeline events for the seeded leads (identity stitching demo)
insert into public.lead_events (lead_id, event_type, event_data)
select id, 'lead.captured', jsonb_build_object('source', raw_payload->>'source', 'form', raw_payload->>'form')
from public.staged_leads
where event_id like 'evt_seed_%'
on conflict do nothing;
