import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function loadLocalEnv(names) {
  if (process.env.COSTPILOT_LOAD_LOCAL_ENV !== '1') return
  if (names.every((name) => process.env[name])) return

  const envText = readFileSync('/Users/mac/Documents/CostPilot/.env', 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match || !names.includes(match[1]) || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

loadLocalEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])

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
    headers: { Prefer: 'return=representation' },
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

function daysAgo(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

function monthStart() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

function nowIso() {
  return new Date().toISOString()
}

async function createPhase7Account({ token, spend = 420, priorSpend = 40 }) {
  const profile = await insertRow('profiles', {
    firebase_uid: `${token}-uid`,
    email: `${token}@example.com`,
    display_name: 'Phase 7 Synthetic User',
    auth_provider: 'password',
    last_login_at: daysAgo(1),
  })

  const account = await insertRow('accounts', {
    name: 'Phase 7 Synthetic RevOps Account',
    slug: token,
    primary_domain: `${token}.example.com`,
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
    company_size: '51-200',
    providers: ['DeepSeek'],
    estimated_monthly_spend: '$1K-$5K',
    raw_answers: { synthetic: true, phase: 7 },
    completed_at: daysAgo(10),
  })

  await insertRow('account_plans', {
    account_id: account.id,
    profile_id: profile.id,
    current_plan_id: 'growth',
    plan_status: 'active',
    billing_provider: 'payu',
    billing_interval: 'monthly',
    metadata: { synthetic: true, phase: 7 },
    activated_at: daysAgo(8),
  })

  const connection = await insertRow('provider_connections', {
    account_id: account.id,
    provider: 'deepseek',
    connection_mode: 'demo_fixture',
    connection_status: 'connected',
    metadata: { synthetic: true, phase: 7 },
    connected_at: daysAgo(9),
    last_synced_at: daysAgo(1),
  })

  await insertRow('usage_records', {
    account_id: account.id,
    provider_connection_id: connection.id,
    provider: 'deepseek',
    service_name: 'litellm-workflow-gateway',
    model_name: 'costpilot-deepseek-chat',
    usage_quantity: 90000,
    usage_unit: 'tokens',
    unit_price: 0.000001,
    calculated_cost: spend,
    usage_at: nowIso(),
    period_start: `${monthStart()}T00:00:00.000Z`,
    source_type: 'api_sync',
    source_record_id: `${token}_usage_current`,
    metadata: { synthetic: true, workflow: 'phase7_revops_signal_validation' },
  })

  await insertRow('usage_records', {
    account_id: account.id,
    provider_connection_id: connection.id,
    provider: 'deepseek',
    service_name: 'litellm-workflow-gateway',
    model_name: 'costpilot-deepseek-chat',
    usage_quantity: 10000,
    usage_unit: 'tokens',
    unit_price: 0.000001,
    calculated_cost: priorSpend,
    usage_at: daysAgo(45),
    period_start: daysAgo(60),
    period_end: daysAgo(30),
    source_type: 'api_sync',
    source_record_id: `${token}_usage_prior`,
    metadata: { synthetic: true, workflow: 'phase7_revops_signal_validation' },
  })

  await insertRow('provider_usage_limits', {
    account_id: account.id,
    provider_connection_id: connection.id,
    limit_type: 'tokens',
    limit_amount: 100000,
    limit_period: 'monthly',
    threshold_percentage: 70,
    enabled: true,
    metadata: { synthetic: true, phase: 7 },
  })

  await insertRow('budgets', {
    account_id: account.id,
    budget_scope: 'account',
    period_month: monthStart(),
    amount: 300,
    currency: 'USD',
    threshold_percentage: 80,
    alerting_enabled: true,
    status: 'active',
    created_by_profile_id: profile.id,
  })

  await insertRow('cost_recommendations', {
    account_id: account.id,
    provider_connection_id: connection.id,
    provider: 'deepseek',
    service_name: 'litellm-workflow-gateway',
    model_name: 'costpilot-deepseek-chat',
    recommendation_type: 'projected_budget_overrun',
    priority: 'high',
    status: 'open',
    title: 'Synthetic Phase 7 optimization',
    summary: 'Synthetic recommendation used to validate the RevOps signal bridge.',
    observed_value: spend,
    metadata: { synthetic: true, phase: 7 },
  })

  const eventNames = [
    'signup',
    'onboarding_completed',
    'provider_connected',
    'usage_synced',
    'insight_generated',
    'budget_created',
    'alert_configured',
    'upgrade_requested',
  ]

  for (const eventName of eventNames) {
    await insertRow('product_events', {
      profile_id: profile.id,
      account_id: account.id,
      firebase_uid: profile.firebase_uid,
      event_id: `${token}_${eventName}`,
      event_name: eventName,
      event_source: 'system',
      event_trust_level: 'trusted',
      event_properties: { synthetic: true, phase: 7 },
      occurred_at: daysAgo(1),
      created_at: daysAgo(1),
    })
  }

  await rpc('evaluate_account_health', {
    p_account_id: account.id,
    p_evaluation_type: 'synthetic_scenario',
  })

  return { account, profile }
}

runtimeTest('revops signal orchestration is idempotent, scoped, and outcome-aware', async () => {
  const token = uniqueToken('phase7_revops')
  const { account } = await createPhase7Account({ token })

  const firstRun = await rpc('generate_revops_signals', {
    p_account_id: account.id,
    p_source: 'phase7_runtime_test',
  })

  assert.equal(firstRun.length >= 5, true)

  const generatedTypes = new Set(firstRun.map((row) => row.signal_type))
  for (const expectedType of [
    'PQL_REACHED',
    'BUDGET_PRESSURE',
    'ALLOWANCE_PRESSURE',
    'SIGNIFICANT_USAGE_GROWTH',
    'UPGRADE_INTENT',
    'SUBSCRIPTION_ACTIVATED',
  ]) {
    assert.equal(generatedTypes.has(expectedType), true, `${expectedType} should be generated`)
  }

  await rpc('generate_revops_signals', {
    p_account_id: account.id,
    p_source: 'phase7_runtime_test',
  })

  const queueRows = await fetchRows(`revops_signal_queue?account_id=eq.${account.id}&select=signal_key,signal_type,status,owner_type,internal_owner_name`)
  const uniqueKeys = new Set(queueRows.map((row) => row.signal_key))
  assert.equal(uniqueKeys.size, queueRows.length)
  assert.equal(queueRows.some((row) => row.internal_owner_name === 'Priya Shah'), true)
  assert.equal(queueRows.some((row) => row.internal_owner_name === 'Sofia Chen'), true)

  const signalToComplete = queueRows.find((row) => row.signal_type === 'PQL_REACHED')
  const outcome = await rpc('record_revops_signal_outcome', {
    p_signal_key: signalToComplete.signal_key,
    p_status: 'completed',
    p_outcome_status: 'previewed',
    p_outcome_notes: 'Synthetic Phase 7 outcome feedback.',
    p_workflow_execution_id: 'phase7-runtime-test',
    p_slack_notified: false,
  })

  assert.equal(outcome[0].status, 'completed')
  assert.equal(outcome[0].outcome_status, 'previewed')

  const otherToken = uniqueToken('phase7_revops_other')
  const { account: otherAccount } = await createPhase7Account({
    token: otherToken,
    spend: 120,
    priorSpend: 80,
  })

  await rpc('generate_revops_signals', {
    p_account_id: account.id,
    p_source: 'phase7_runtime_test',
  })

  const otherRows = await fetchRows(`revops_signal_queue?account_id=eq.${otherAccount.id}&select=id`)
  assert.equal(otherRows.length, 0)
})
