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

function daysAgo(days, hours = 12) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(hours, 0, 0, 0)
  return date.toISOString()
}

function monthStart(daysOffset = 0) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - daysOffset)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString().slice(0, 10)
}

async function createAccountScenario(prefix, options = {}) {
  const token = uniqueToken(prefix)
  const profile = await insertRow('profiles', {
    firebase_uid: `${token}-uid`,
    email: `${token}@example.com`,
    display_name: `${prefix} User`,
    auth_provider: 'password',
    last_login_at: options.last_login_at ?? daysAgo(1),
  })

  const account = await insertRow('accounts', {
    name: `${prefix} Account`,
    slug: token,
    primary_domain: 'example.com',
    onboarding_status: options.onboarding_status ?? 'completed',
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
    company_size: options.company_size ?? '11-50',
    providers: options.providers ?? ['OpenAI'],
    estimated_monthly_spend: options.estimated_monthly_spend ?? '$1K-$5K',
    raw_answers: {},
    completed_at: options.onboarding_completed_at ?? daysAgo(10),
  })

  await insertRow('account_plans', {
    account_id: account.id,
    profile_id: profile.id,
    current_plan_id: options.current_plan_id ?? 'starter',
    plan_status: options.plan_status ?? 'active',
    billing_provider: 'payu',
    billing_interval: 'monthly',
    latest_transaction_id: null,
    activated_at: options.plan_activated_at ?? daysAgo(10),
    expires_at: options.expires_at ?? null,
    cancellation_requested_at: options.cancellation_requested_at ?? null,
    cancelled_at: options.cancelled_at ?? null,
    cancellation_reason: options.cancellation_reason ?? null,
    metadata: options.plan_metadata ?? {},
  })

  for (const event of options.events ?? []) {
    await insertRow('product_events', {
      profile_id: profile.id,
      account_id: account.id,
      firebase_uid: profile.firebase_uid,
      event_name: event.name,
      event_source: event.source ?? 'system',
      event_properties: event.properties ?? {},
      created_at: event.created_at ?? daysAgo(event.days_ago ?? 0),
    })
  }

  const connectionIds = new Map()
  for (const connection of options.connections ?? []) {
    const row = await insertRow('provider_connections', {
      account_id: account.id,
      provider: connection.provider,
      connection_mode: connection.connection_mode ?? 'demo_fixture',
      connection_status: connection.connection_status ?? 'connected',
      external_reference: null,
      metadata: connection.metadata ?? {},
      connected_at: connection.connected_at ?? daysAgo(connection.connected_days_ago ?? 5),
      last_synced_at: connection.last_synced_at ?? (connection.sync_days_ago == null ? null : daysAgo(connection.sync_days_ago)),
    })
    connectionIds.set(connection.provider, row.id)
  }

  let usageIndex = 0
  for (const usage of options.usage ?? []) {
    usageIndex += 1
    await insertRow('usage_records', {
      account_id: account.id,
      provider_connection_id: connectionIds.get(usage.provider),
      provider: usage.provider,
      service_name: usage.service_name,
      model_name: usage.model_name ?? null,
      usage_quantity: usage.usage_quantity ?? 100000,
      usage_unit: usage.usage_unit ?? 'tokens',
      unit_price: usage.unit_price ?? 0.000005,
      calculated_cost: usage.calculated_cost,
      usage_at: usage.usage_at ?? daysAgo(usage.days_ago ?? 1),
      period_start: usage.period_start ?? `${monthStart(usage.days_ago ?? 1)}T00:00:00.000Z`,
      period_end: usage.period_end ?? null,
      source_type: usage.source_type ?? 'demo_fixture',
      source_record_id: `${token}_${usage.provider}_${usage.service_name}_${usageIndex}`,
      metadata: usage.metadata ?? {},
    })
  }

  if (options.budget) {
    await insertRow('budgets', {
      account_id: account.id,
      provider_connection_id: null,
      provider: null,
      budget_scope: 'account',
      period_month: monthStart(),
      amount: options.budget.amount,
      currency: 'USD',
      threshold_percentage: options.budget.threshold_percentage,
      alerting_enabled: options.budget.alerting_enabled ?? true,
      status: options.budget.status ?? 'active',
      created_by_profile_id: profile.id,
      created_at: options.budget.created_at ?? daysAgo(options.budget.days_ago ?? 2),
      updated_at: options.budget.updated_at ?? daysAgo(options.budget.days_ago ?? 2),
    })
  }

  for (const alert of options.alerts ?? []) {
    await insertRow('product_alerts', {
      account_id: account.id,
      provider_connection_id: null,
      budget_id: null,
      provider: null,
      alert_type: alert.alert_type,
      severity: alert.severity,
      status: alert.status ?? 'open',
      threshold_value: alert.threshold_value ?? 80,
      observed_value: alert.observed_value ?? 95,
      observed_period: alert.observed_period ?? monthStart(),
      metadata: {},
      triggered_at: alert.triggered_at ?? daysAgo(alert.days_ago ?? 1),
      resolved_at: alert.resolved_at ?? null,
    })
  }

  for (const recommendation of options.recommendations ?? []) {
    await insertRow('cost_recommendations', {
      account_id: account.id,
      provider_connection_id: null,
      provider: recommendation.provider ?? null,
      service_name: recommendation.service_name ?? null,
      model_name: recommendation.model_name ?? null,
      recommendation_type: recommendation.recommendation_type,
      priority: recommendation.priority ?? 'medium',
      status: recommendation.status ?? 'open',
      title: recommendation.title ?? 'Observed cost pattern',
      summary: recommendation.summary ?? 'Synthetic recommendation for runtime testing.',
      observed_value: recommendation.observed_value ?? null,
      metadata: {},
      generated_at: recommendation.generated_at ?? daysAgo(recommendation.days_ago ?? 1),
    })
  }

  if (options.billing_transaction) {
    await insertRow('billing_transactions', {
      account_id: account.id,
      profile_id: profile.id,
      billing_provider: 'payu',
      plan_id: options.billing_transaction.plan_id ?? options.current_plan_id ?? 'starter',
      billing_interval: 'monthly',
      amount: options.billing_transaction.amount ?? 1,
      currency: 'INR',
      provider_txn_id: `${token}_txn`,
      provider_payment_id: `${token}_mih`,
      payment_status: options.billing_transaction.payment_status,
      verification_status: options.billing_transaction.verification_status ?? 'verified',
      idempotency_key: `${token}_idem`,
      checkout_payload: {},
      verified_payload: {},
      activated_at: options.billing_transaction.activated_at ?? null,
      verified_at: options.billing_transaction.verified_at ?? daysAgo(options.billing_transaction.days_ago ?? 1),
    })
  }

  return { token, profile, account }
}

async function evaluateAccount(accountId) {
  const result = await rpc('evaluate_account_health', {
    p_account_id: accountId,
    p_evaluation_type: 'synthetic_scenario',
  })
  return result[0]
}

async function fetchCurrentHealth(accountId) {
  const rows = await fetchRows(`current_customer_health?account_id=eq.${accountId}&limit=1&select=*`)
  return rows[0]
}

async function createQualifiedLeadForAccount(account, profile, token) {
  const lead = await insertRow('staged_leads', {
    event_id: token,
    email: profile.email,
    company_name: 'Expansion Lead',
    raw_payload: { source: 'product' },
    firmographics: { industry: 'AI', employees: 150 },
    icp_score: 84,
    buying_intent: 'high',
    status: 'qualified',
    source_type: 'inbound',
  })

  await rpc('evaluate_lead_qualification', {
    p_lead_id: lead.id,
    p_evaluation_type: 'score_update',
    p_source_runtime: 'system',
  })

  await rpc('route_lead_to_sales', {
    p_lead_id: lead.id,
    p_trigger: 'phase7_expansion_seed',
    p_force_reassign: false,
  })

  return lead
}

runtimeTest('customer health runtime classifies healthy, newly activated, low-adoption, dormant, failed-payment, disconnected, and churned accounts', async () => {
  const healthy = await createAccountScenario('healthy', {
    current_plan_id: 'growth',
    estimated_monthly_spend: '$10K-$25K',
    events: [
      { name: 'signup', days_ago: 12 },
      { name: 'onboarding_completed', days_ago: 10 },
      { name: 'provider_connected', days_ago: 9 },
      { name: 'usage_synced', days_ago: 1 },
      { name: 'insight_generated', days_ago: 2 },
      { name: 'budget_created', days_ago: 3 },
      { name: 'alert_configured', days_ago: 3 },
      { name: 'dashboard_viewed', days_ago: 1 },
      { name: 'forecast_viewed', days_ago: 1 },
      { name: 'recommendation_viewed', days_ago: 1 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 9, sync_days_ago: 1 },
      { provider: 'anthropic', connected_days_ago: 8, sync_days_ago: 1 },
    ],
    usage: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 420, days_ago: 1 },
      { provider: 'openai', service_name: 'responses', model_name: 'gpt-4.1-mini', calculated_cost: 280, days_ago: 8 },
      { provider: 'anthropic', service_name: 'messages', model_name: 'claude-3-5-sonnet', calculated_cost: 310, days_ago: 4 },
      { provider: 'anthropic', service_name: 'messages', model_name: 'claude-3-5-haiku', calculated_cost: 220, days_ago: 20 },
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 400, days_ago: 38 },
    ],
    budget: { amount: 1600, threshold_percentage: 80, days_ago: 3 },
    recommendations: [
      { recommendation_type: 'provider_cost_concentration', priority: 'medium', days_ago: 2 },
    ],
  })

  const newlyActivated = await createAccountScenario('newly_activated', {
    current_plan_id: 'starter',
    events: [
      { name: 'signup', days_ago: 6 },
      { name: 'onboarding_completed', days_ago: 5 },
      { name: 'provider_connected', days_ago: 4 },
      { name: 'usage_synced', days_ago: 2 },
      { name: 'insight_generated', days_ago: 2 },
      { name: 'budget_created', days_ago: 1 },
      { name: 'alert_configured', days_ago: 1 },
      { name: 'dashboard_viewed', days_ago: 1 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 4, sync_days_ago: 2 },
    ],
    usage: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 180, days_ago: 2 },
      { provider: 'openai', service_name: 'responses', model_name: 'gpt-4.1-mini', calculated_cost: 120, days_ago: 1 },
    ],
    budget: { amount: 900, threshold_percentage: 75, days_ago: 1 },
    recommendations: [
      { recommendation_type: 'budget_missing', priority: 'low', status: 'applied', days_ago: 1, title: 'Applied budget setup' },
    ],
  })

  const lowAdoption = await createAccountScenario('low_adoption', {
    last_login_at: daysAgo(6),
    events: [
      { name: 'signup', days_ago: 20 },
      { name: 'onboarding_completed', days_ago: 18 },
      { name: 'provider_connected', days_ago: 17 },
      { name: 'dashboard_viewed', days_ago: 6 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 17, sync_days_ago: 17 },
    ],
  })

  const dormant = await createAccountScenario('dormant', {
    last_login_at: daysAgo(30),
    current_plan_id: 'growth',
    events: [
      { name: 'signup', days_ago: 60 },
      { name: 'onboarding_completed', days_ago: 58 },
      { name: 'provider_connected', days_ago: 57 },
      { name: 'usage_synced', days_ago: 55 },
      { name: 'insight_generated', days_ago: 54 },
      { name: 'budget_created', days_ago: 53 },
      { name: 'alert_configured', days_ago: 53 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 57, sync_days_ago: 30 },
    ],
    usage: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 240, days_ago: 35 },
      { provider: 'openai', service_name: 'responses', model_name: 'gpt-4.1-mini', calculated_cost: 210, days_ago: 42 },
    ],
    budget: { amount: 1200, threshold_percentage: 80, days_ago: 53 },
  })

  const failedPayment = await createAccountScenario('failed_payment', {
    current_plan_id: 'growth',
    plan_status: 'failed_payment',
    events: [
      { name: 'signup', days_ago: 18 },
      { name: 'onboarding_completed', days_ago: 17 },
      { name: 'provider_connected', days_ago: 16 },
      { name: 'usage_synced', days_ago: 2 },
      { name: 'insight_generated', days_ago: 2 },
      { name: 'budget_created', days_ago: 3 },
      { name: 'alert_configured', days_ago: 3 },
      { name: 'dashboard_viewed', days_ago: 2 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 16, sync_days_ago: 2 },
    ],
    usage: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 320, days_ago: 2 },
    ],
    budget: { amount: 900, threshold_percentage: 75, days_ago: 3 },
    billing_transaction: {
      payment_status: 'failed',
      verification_status: 'verified',
      amount: 1,
      days_ago: 1,
    },
  })

  const disconnected = await createAccountScenario('provider_disconnected', {
    current_plan_id: 'growth',
    events: [
      { name: 'signup', days_ago: 21 },
      { name: 'onboarding_completed', days_ago: 20 },
      { name: 'provider_connected', days_ago: 19 },
      { name: 'usage_synced', days_ago: 10 },
      { name: 'insight_generated', days_ago: 10 },
      { name: 'budget_created', days_ago: 9 },
      { name: 'alert_configured', days_ago: 9 },
      { name: 'dashboard_viewed', days_ago: 5 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 19, sync_days_ago: 10, connection_status: 'disconnected' },
    ],
    usage: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 250, days_ago: 10 },
    ],
    budget: { amount: 800, threshold_percentage: 80, days_ago: 9 },
    alerts: [
      { alert_type: 'spend_spike', severity: 'high', days_ago: 4 },
    ],
  })

  const churned = await createAccountScenario('churned', {
    current_plan_id: 'growth',
    plan_status: 'inactive',
    last_login_at: daysAgo(35),
    cancellation_requested_at: daysAgo(7),
    cancelled_at: daysAgo(5),
    cancellation_reason: 'synthetic_demo_churn',
    events: [
      { name: 'signup', days_ago: 70 },
      { name: 'onboarding_completed', days_ago: 68 },
      { name: 'provider_connected', days_ago: 67 },
      { name: 'usage_synced', days_ago: 50 },
      { name: 'insight_generated', days_ago: 49 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 67, sync_days_ago: 40, connection_status: 'disconnected' },
    ],
    usage: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 150, days_ago: 45 },
    ],
    expires_at: daysAgo(4),
  })

  const healthyEval = await evaluateAccount(healthy.account.id)
  const newEval = await evaluateAccount(newlyActivated.account.id)
  const lowEval = await evaluateAccount(lowAdoption.account.id)
  const dormantEval = await evaluateAccount(dormant.account.id)
  const failedEval = await evaluateAccount(failedPayment.account.id)
  const disconnectedEval = await evaluateAccount(disconnected.account.id)
  const churnedEval = await evaluateAccount(churned.account.id)

  assert.equal(healthyEval.health_state, 'healthy')
  assert.equal(healthyEval.churn_risk, 'low')

  assert.equal(newEval.lifecycle_state, 'newly_activated')
  assert.equal(['healthy', 'watch'].includes(newEval.health_state), true)

  assert.equal(lowEval.lifecycle_state, 'low_adoption')
  assert.equal(['at_risk', 'critical'].includes(lowEval.health_state), true)

  assert.equal(dormantEval.lifecycle_state, 'dormant')
  assert.equal(dormantEval.churn_risk, 'critical')

  assert.equal(failedEval.health_state, 'critical')
  assert.equal(failedEval.churn_risk, 'critical')
  assert.equal(failedEval.recommended_action, 'resolve_billing')

  assert.equal(disconnectedEval.needs_intervention, true)
  assert.equal(['high', 'critical'].includes(disconnectedEval.churn_risk), true)

  assert.equal(churnedEval.authoritative_churned, true)
  assert.equal(churnedEval.lifecycle_state, 'churned')

  const paymentRiskRows = await fetchRows(`payment_risk_accounts?account_id=eq.${failedPayment.account.id}&select=account_id`)
  assert.equal(paymentRiskRows.length, 1)

  const dormantRows = await fetchRows(`dormant_accounts?account_id=eq.${dormant.account.id}&select=account_id`)
  assert.equal(dormantRows.length, 1)

  const recentRows = await fetchRows(`recently_activated_accounts?account_id=eq.${newlyActivated.account.id}&select=account_id`)
  assert.equal(recentRows.length, 1)
})

runtimeTest('expansion states distinguish expansion candidate, upgrade ready, and sales followup while reusing sales context', async () => {
  const expansionCandidate = await createAccountScenario('expansion_candidate', {
    current_plan_id: 'starter',
    company_size: '51-200',
    events: [
      { name: 'signup', days_ago: 25 },
      { name: 'onboarding_completed', days_ago: 24 },
      { name: 'provider_connected', days_ago: 23 },
      { name: 'usage_synced', days_ago: 1 },
      { name: 'insight_generated', days_ago: 2 },
      { name: 'budget_created', days_ago: 4 },
      { name: 'alert_configured', days_ago: 4 },
      { name: 'dashboard_viewed', days_ago: 1 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 23, sync_days_ago: 1 },
      { provider: 'anthropic', connected_days_ago: 22, sync_days_ago: 1 },
    ],
    usage: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 320, days_ago: 1 },
      { provider: 'anthropic', service_name: 'messages', model_name: 'claude-3-5-sonnet', calculated_cost: 290, days_ago: 5 },
      { provider: 'openai', service_name: 'responses', model_name: 'gpt-4.1-mini', calculated_cost: 180, days_ago: 18 },
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 700, days_ago: 45 },
    ],
    budget: { amount: 2000, threshold_percentage: 85, days_ago: 4 },
  })

  const upgradeReady = await createAccountScenario('upgrade_ready', {
    current_plan_id: 'starter',
    estimated_monthly_spend: '$25K-$50K',
    events: [
      { name: 'signup', days_ago: 18 },
      { name: 'onboarding_completed', days_ago: 17 },
      { name: 'provider_connected', days_ago: 16 },
      { name: 'usage_synced', days_ago: 1 },
      { name: 'insight_generated', days_ago: 1 },
      { name: 'budget_created', days_ago: 3 },
      { name: 'alert_configured', days_ago: 3 },
      { name: 'dashboard_viewed', days_ago: 1 },
      { name: 'upgrade_requested', days_ago: 1 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 16, sync_days_ago: 1 },
      { provider: 'anthropic', connected_days_ago: 15, sync_days_ago: 1 },
      { provider: 'aws', connected_days_ago: 15, sync_days_ago: 1 },
    ],
    usage: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 520, days_ago: 1 },
      { provider: 'anthropic', service_name: 'messages', model_name: 'claude-3-5-sonnet', calculated_cost: 430, days_ago: 3 },
      { provider: 'aws', service_name: 'bedrock-runtime', model_name: 'claude-3-haiku', calculated_cost: 290, days_ago: 7 },
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 410, days_ago: 42 },
    ],
    budget: { amount: 900, threshold_percentage: 80, days_ago: 3 },
  })

  const salesFollowup = await createAccountScenario('sales_followup', {
    current_plan_id: 'growth',
    estimated_monthly_spend: '$25K-$50K',
    events: [
      { name: 'signup', days_ago: 30 },
      { name: 'onboarding_completed', days_ago: 28 },
      { name: 'provider_connected', days_ago: 27 },
      { name: 'usage_synced', days_ago: 1 },
      { name: 'insight_generated', days_ago: 1 },
      { name: 'budget_created', days_ago: 2 },
      { name: 'alert_configured', days_ago: 2 },
      { name: 'dashboard_viewed', days_ago: 1 },
      { name: 'upgrade_requested', days_ago: 1 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 27, sync_days_ago: 1 },
      { provider: 'anthropic', connected_days_ago: 26, sync_days_ago: 1 },
      { provider: 'aws', connected_days_ago: 26, sync_days_ago: 1 },
    ],
    usage: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 650, days_ago: 1 },
      { provider: 'anthropic', service_name: 'messages', model_name: 'claude-3-5-sonnet', calculated_cost: 460, days_ago: 4 },
      { provider: 'aws', service_name: 'bedrock-runtime', model_name: 'claude-3-haiku', calculated_cost: 310, days_ago: 6 },
      { provider: 'openai', service_name: 'responses', model_name: 'gpt-4.1-mini', calculated_cost: 430, days_ago: 40 },
    ],
    budget: { amount: 1100, threshold_percentage: 80, days_ago: 2 },
  })

  const routedLead = await createQualifiedLeadForAccount(salesFollowup.account, salesFollowup.profile, salesFollowup.token)

  const candidateEval = await evaluateAccount(expansionCandidate.account.id)
  const upgradeEval = await evaluateAccount(upgradeReady.account.id)
  const followupEval = await evaluateAccount(salesFollowup.account.id)

  assert.equal(candidateEval.expansion_state, 'expansion_candidate')
  assert.equal(upgradeEval.expansion_state, 'upgrade_ready')
  assert.equal(upgradeEval.recommended_action, 'prompt_upgrade')
  assert.equal(followupEval.expansion_state, 'sales_followup')
  assert.equal(followupEval.recommended_lead_id, routedLead.id)
  assert.equal(followupEval.recommended_owner_type, 'ae')

  const readyRows = await fetchRows(
    `expansion_ready_accounts?account_id=in.(${expansionCandidate.account.id},${upgradeReady.account.id},${salesFollowup.account.id})&select=account_id,expansion_state`,
  )
  assert.equal(readyRows.length, 3)
})

runtimeTest('customer health evaluation is idempotent and queue views expose intervention membership', async () => {
  const dormant = await createAccountScenario('idempotent_dormant', {
    last_login_at: daysAgo(29),
    current_plan_id: 'growth',
    events: [
      { name: 'signup', days_ago: 45 },
      { name: 'onboarding_completed', days_ago: 44 },
      { name: 'provider_connected', days_ago: 43 },
      { name: 'usage_synced', days_ago: 40 },
      { name: 'insight_generated', days_ago: 39 },
      { name: 'budget_created', days_ago: 39 },
      { name: 'alert_configured', days_ago: 39 },
    ],
    connections: [
      { provider: 'openai', connected_days_ago: 43, sync_days_ago: 29 },
    ],
    usage: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', calculated_cost: 210, days_ago: 31 },
      { provider: 'openai', service_name: 'responses', model_name: 'gpt-4.1-mini', calculated_cost: 180, days_ago: 41 },
    ],
    budget: { amount: 1200, threshold_percentage: 80, days_ago: 39 },
  })

  const first = await evaluateAccount(dormant.account.id)
  const second = await evaluateAccount(dormant.account.id)
  assert.equal(first.evaluation_id, second.evaluation_id)

  const history = await fetchRows(`customer_health_evaluations?account_id=eq.${dormant.account.id}&select=id`)
  assert.equal(history.length, 1)

  const current = await fetchCurrentHealth(dormant.account.id)
  assert.equal(current.needs_intervention, true)

  const interventionRows = await fetchRows(`intervention_needed_accounts?account_id=eq.${dormant.account.id}&select=account_id`)
  assert.equal(interventionRows.length, 1)

  const atRiskRows = await fetchRows(`at_risk_accounts?account_id=eq.${dormant.account.id}&select=account_id`)
  assert.equal(atRiskRows.length, 1)
})

runtimeTest('customer health metrics expose valid current-state distributions without fabricating churn rates', async () => {
  const metricsRows = await fetchRows('customer_health_metrics?limit=1&select=*')
  const metrics = metricsRows[0]
  assert.equal(typeof metrics.total_accounts, 'number')
  assert.equal(metrics.total_accounts >= 1, true)
  assert.equal(metrics.logo_churn_available, false)
  assert.equal(metrics.revenue_churn_available, false)
  assert.equal(metrics.grr_available, false)
  assert.equal(metrics.nrr_available, false)
})
