import test from 'node:test'
import assert from 'node:assert/strict'

const baseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const runtimeTestOptions =
  baseUrl && serviceRoleKey
    ? {}
    : { skip: 'requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' }

const runtimeTest = (name, fn) => test(name, runtimeTestOptions, fn)

async function rest(path, init = {}) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`REST ${path} failed: ${response.status} ${body}`)
  }

  if (response.status === 204) return null
  return response.json()
}

async function rpc(name, payload) {
  return rest(`rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  })
}

async function insertRow(path, payload) {
  const rows = await rest(`${path}?select=*`, {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  })
  return Array.isArray(rows) ? rows[0] : rows
}

async function fetchRows(path) {
  return rest(path, { method: 'GET' })
}

function uniqueToken(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

runtimeTest('product intelligence views roll up spend, budgets, activation, and PQL-compatible qualification', async () => {
  const token = uniqueToken('phase6')
  const profile = await insertRow('profiles', {
    firebase_uid: `${token}-uid`,
    email: `${token}@example.com`,
    display_name: 'Phase 6 User',
    auth_provider: 'password',
    last_login_at: '2026-08-27T10:00:00.000Z',
  })

  const account = await insertRow('accounts', {
    name: 'Phase 6 Account',
    slug: token,
    primary_domain: 'example.com',
    onboarding_status: 'completed',
  })

  await insertRow('account_members', {
    account_id: account.id,
    profile_id: profile.id,
    role: 'owner',
    is_owner: true,
  })

  await insertRow('onboarding_responses', {
    profile_id: profile.id,
    account_id: account.id,
    company_size: '11-50',
    providers: ['OpenAI', 'Anthropic'],
    estimated_monthly_spend: '$5K-$10K',
    raw_answers: {},
    completed_at: '2026-08-27T10:05:00.000Z',
  })

  const providerConnection = await insertRow('provider_connections', {
    account_id: account.id,
    provider: 'openai',
    connection_mode: 'demo_fixture',
    connection_status: 'connected',
    metadata: { adapter: 'demo_fixture_v1' },
    connected_at: '2026-08-27T10:10:00.000Z',
    last_synced_at: '2026-08-27T10:12:00.000Z',
  })

  await insertRow('usage_records', {
    account_id: account.id,
    provider_connection_id: providerConnection.id,
    provider: 'openai',
    service_name: 'chat-completions',
    model_name: 'gpt-4o-mini',
    usage_quantity: 100000,
    usage_unit: 'tokens',
    unit_price: 0.000005,
    calculated_cost: 500,
    usage_at: '2026-08-27T10:12:00.000Z',
    period_start: '2026-08-01T00:00:00.000Z',
    period_end: '2026-09-01T00:00:00.000Z',
    source_type: 'demo_fixture',
    source_record_id: `${token}_usage_1`,
    metadata: { workload: 'support_ai' },
  })

  await insertRow('budgets', {
    account_id: account.id,
    budget_scope: 'account',
    period_month: '2026-08-01',
    amount: 600,
    currency: 'USD',
    threshold_percentage: 80,
    alerting_enabled: true,
    status: 'active',
    created_by_profile_id: profile.id,
  })

  for (const eventName of ['signup', 'onboarding_completed', 'provider_connected', 'usage_synced', 'insight_generated', 'budget_created', 'alert_configured']) {
    await insertRow('product_events', {
      profile_id: profile.id,
      account_id: account.id,
      firebase_uid: profile.firebase_uid,
      event_name: eventName,
      event_source: 'system',
      event_properties: {},
    })
  }

  const spendSummary = await fetchRows(`account_spend_summary_current_month?account_id=eq.${account.id}&select=account_id,current_month_spend,projected_month_end_spend`)
  assert.equal(Number(spendSummary[0].current_month_spend) >= 500, true)

  const budgetStatus = await fetchRows(`account_budget_status_current_month?account_id=eq.${account.id}&select=budget_amount,budget_used_percentage,projected_overrun`)
  assert.equal(Number(budgetStatus[0].budget_used_percentage) >= 80, true)

  const activation = await fetchRows(`account_activation_state?account_id=eq.${account.id}&select=activation_score,activated,time_to_value_hours`)
  assert.equal(activation[0].activation_score, 100)
  assert.equal(activation[0].activated, true)

  const lead = await insertRow('staged_leads', {
    event_id: token,
    email: profile.email,
    company_name: 'Phase 6 Lead',
    raw_payload: { source: 'website' },
    firmographics: { industry: 'AI', employees: 45 },
    icp_score: 78,
    buying_intent: 'high',
    status: 'qualified',
    source_type: 'inbound',
  })

  const qualification = await rpc('evaluate_lead_qualification', {
    p_lead_id: lead.id,
    p_evaluation_type: 'score_update',
    p_source_runtime: 'system',
  })

  assert.equal(qualification[0].pql_status, 'product_activated')
  const overview = await fetchRows(`account_dashboard_overview?account_id=eq.${account.id}&select=current_plan_id,activation_score`)
  assert.equal(overview[0].activation_score, 100)
  assert.equal(overview[0].current_plan_id, 'starter')
})
