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

function isoNowMinusDays(days, hours = 12) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(hours, 0, 0, 0)
  return date.toISOString()
}

function currentMonthStart() {
  const date = new Date()
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString().slice(0, 10)
}

function numeric(value) {
  return value == null ? null : Number(value)
}

async function fetchSingle(path) {
  const rows = await fetchRows(path)
  return rows[0] ?? null
}

runtimeTest('Phase 8 GTM analytics views expose executive, funnel, acquisition, sales, product, retention, trend, and empty-state-safe metrics', async () => {
  const beforeExecutive = await fetchSingle('gtm_executive_summary?select=*')
  const beforeQualification = await fetchSingle('gtm_qualification_summary?select=*')
  const beforeProduct = await fetchSingle('gtm_product_summary?select=*')
  const beforeHealth = await fetchSingle('gtm_customer_health_summary?select=*')
  const beforeSalesOverall = await fetchSingle('gtm_sales_workload_summary?owner_type=eq.all&rep_code=eq.all&select=*')

  const richToken = uniqueToken('phase8_rich')
  const richSource = `${richToken}_source`
  const richCampaign = `${richToken}_campaign`

  const profile = await insertRow('profiles', {
    firebase_uid: `${richToken}-uid`,
    email: `${richToken}@example.com`,
    display_name: 'Phase 8 Rich User',
    auth_provider: 'password',
    last_login_at: isoNowMinusDays(1),
  })

  const account = await insertRow('accounts', {
    name: 'Phase 8 Rich Account',
    slug: richToken,
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
    providers: ['OpenAI'],
    estimated_monthly_spend: '$5K-$10K',
    raw_answers: {},
    completed_at: isoNowMinusDays(6),
  })

  await insertRow('account_plans', {
    account_id: account.id,
    profile_id: profile.id,
    current_plan_id: 'growth',
    plan_status: 'active',
    billing_provider: 'payu',
    billing_interval: 'monthly',
    latest_transaction_id: null,
    activated_at: isoNowMinusDays(0),
    expires_at: null,
    metadata: {},
  })

  const connection = await insertRow('provider_connections', {
    account_id: account.id,
    provider: 'openai',
    connection_mode: 'demo_fixture',
    connection_status: 'connected',
    external_reference: null,
    metadata: { adapter: 'demo_fixture_v1' },
    connected_at: isoNowMinusDays(5),
    last_synced_at: isoNowMinusDays(0),
  })

  const secondConnection = await insertRow('provider_connections', {
    account_id: account.id,
    provider: 'anthropic',
    connection_mode: 'demo_fixture',
    connection_status: 'connected',
    external_reference: null,
    metadata: { adapter: 'demo_fixture_v1' },
    connected_at: isoNowMinusDays(4),
    last_synced_at: isoNowMinusDays(0),
  })

  await insertRow('usage_records', {
    account_id: account.id,
    provider_connection_id: connection.id,
    provider: 'openai',
    service_name: 'chat-completions',
    model_name: 'gpt-4o-mini',
    usage_quantity: 550000,
    usage_unit: 'tokens',
    unit_price: 0.0005,
    calculated_cost: 275,
    usage_at: isoNowMinusDays(0),
    period_start: `${currentMonthStart()}T00:00:00.000Z`,
    period_end: null,
    source_type: 'demo_fixture',
    source_record_id: `${richToken}_usage_1`,
    metadata: { workload: 'analytics' },
  })

  await insertRow('usage_records', {
    account_id: account.id,
    provider_connection_id: secondConnection.id,
    provider: 'anthropic',
    service_name: 'messages',
    model_name: 'claude-3-5-sonnet',
    usage_quantity: 220000,
    usage_unit: 'tokens',
    unit_price: 0.0008,
    calculated_cost: 176,
    usage_at: isoNowMinusDays(0),
    period_start: `${currentMonthStart()}T00:00:00.000Z`,
    period_end: null,
    source_type: 'demo_fixture',
    source_record_id: `${richToken}_usage_2`,
    metadata: { workload: 'support' },
  })

  await insertRow('budgets', {
    account_id: account.id,
    provider_connection_id: null,
    provider: null,
    budget_scope: 'account',
    period_month: currentMonthStart(),
    amount: 400,
    currency: 'USD',
    threshold_percentage: 80,
    alerting_enabled: true,
    status: 'active',
    created_by_profile_id: profile.id,
  })

  await insertRow('product_alerts', {
    account_id: account.id,
    provider_connection_id: null,
    budget_id: null,
    provider: null,
    alert_type: 'budget_threshold_reached',
    severity: 'high',
    status: 'open',
    threshold_value: 80,
    observed_value: 91,
    observed_period: currentMonthStart(),
    metadata: {},
    triggered_at: isoNowMinusDays(0),
    resolved_at: null,
  })

  await insertRow('cost_recommendations', {
    account_id: account.id,
    provider_connection_id: null,
    provider: 'openai',
    service_name: 'chat-completions',
    model_name: 'gpt-4o-mini',
    recommendation_type: 'projected_budget_overrun',
    priority: 'high',
    status: 'open',
    title: 'Review projected overrun',
    summary: 'Observed spend is approaching the monthly budget.',
    observed_value: 275,
    metadata: {},
    generated_at: isoNowMinusDays(0),
  })

  for (const eventName of ['signup', 'onboarding_completed', 'provider_connected', 'usage_synced', 'insight_generated', 'budget_created', 'alert_configured', 'dashboard_viewed']) {
    await insertRow('product_events', {
      profile_id: profile.id,
      account_id: account.id,
      firebase_uid: profile.firebase_uid,
      event_name: eventName,
      event_source: 'system',
      event_properties: {},
      created_at: isoNowMinusDays(eventName === 'signup' ? 7 : 0),
    })
  }

  for (const eventName of ['dashboard_viewed', 'dashboard_viewed', 'dashboard_viewed', 'forecast_viewed', 'recommendation_viewed']) {
    await insertRow('product_events', {
      profile_id: profile.id,
      account_id: account.id,
      firebase_uid: profile.firebase_uid,
      event_name: eventName,
      event_source: 'system',
      event_properties: {},
      created_at: isoNowMinusDays(0),
    })
  }

  const lead = await insertRow('staged_leads', {
    event_id: `${richToken}_lead`,
    email: profile.email,
    company_name: 'Phase 8 Rich Lead',
    raw_payload: { source: 'website' },
    firmographics: { industry: 'AI', employees: 42, country_code: 'US' },
    icp_score: 86,
    buying_intent: 'high',
    status: 'qualified',
    source_type: 'inbound',
  })

  await insertRow('acquisition_touches', {
    lead_id: lead.id,
    firebase_uid: profile.firebase_uid,
    channel: 'inbound',
    source: richSource,
    source_id: `${richToken}_source_id`,
    medium: 'organic',
    campaign: richCampaign,
    referrer: 'https://costpilot.test',
    utm_source: richSource,
    utm_medium: 'organic',
    utm_campaign: richCampaign,
    touch_type: 'first_touch',
    occurred_at: isoNowMinusDays(7),
    metadata: {},
  })

  await insertRow('acquisition_touches', {
    lead_id: lead.id,
    firebase_uid: profile.firebase_uid,
    channel: 'inbound',
    source: richSource,
    source_id: `${richToken}_source_id`,
    medium: 'organic',
    campaign: richCampaign,
    referrer: 'https://costpilot.test/pricing',
    utm_source: richSource,
    utm_medium: 'organic',
    utm_campaign: richCampaign,
    touch_type: 'last_touch',
    occurred_at: isoNowMinusDays(0),
    metadata: {},
  })

  await insertRow('acquisition_touches', {
    lead_id: lead.id,
    firebase_uid: profile.firebase_uid,
    channel: 'inbound',
    source: richSource,
    source_id: `${richToken}_source_id`,
    medium: 'organic',
    campaign: richCampaign,
    referrer: 'https://costpilot.test/demo',
    utm_source: richSource,
    utm_medium: 'organic',
    utm_campaign: richCampaign,
    touch_type: 'interaction',
    occurred_at: isoNowMinusDays(0),
    metadata: {},
  })

  const qualification = await rpc('evaluate_lead_qualification', {
    p_lead_id: lead.id,
    p_evaluation_type: 'score_update',
    p_source_runtime: 'system',
  })

  assert.equal(qualification[0].mql_status, 'qualified')
  assert.equal(qualification[0].sql_status, 'sales_ready')
  assert.equal(qualification[0].pql_status, 'product_activated')

  await rpc('route_lead_to_sales', {
    p_lead_id: lead.id,
    p_trigger: 'phase8_runtime_test',
    p_force_reassign: false,
  })

  const outreach = await insertRow('outreach', {
    lead_id: lead.id,
    email: profile.email,
    subject: 'Phase 8 outreach',
    body: 'Initial outreach body',
    status: 'replied',
    sent_at: isoNowMinusDays(0),
    next_followup_at: null,
    reply_received_at: isoNowMinusDays(0),
    deal_id: null,
  })

  await rpc('mark_deal_created', {
    p_id: outreach.id,
    p_deal_id: `${richToken}_deal`,
  })

  await insertRow('billing_transactions', {
    account_id: account.id,
    profile_id: profile.id,
    billing_provider: 'payu',
    plan_id: 'growth',
    billing_interval: 'monthly',
    amount: 1,
    currency: 'INR',
    provider_txn_id: `${richToken}_txn`,
    provider_payment_id: `${richToken}_mih`,
    payment_status: 'success',
    verification_status: 'verified',
    idempotency_key: `${richToken}_idem`,
    checkout_payload: {},
    verified_payload: {},
    activated_at: isoNowMinusDays(0),
    verified_at: isoNowMinusDays(0),
  })

  const healthEvaluation = await rpc('evaluate_account_health', {
    p_account_id: account.id,
    p_evaluation_type: 'synthetic_scenario',
  })
  assert.equal(healthEvaluation[0].health_state, 'healthy')

  const lowToken = uniqueToken('phase8_low')
  const lowSource = `${lowToken}_source`
  const lowCampaign = `${lowToken}_campaign`
  const lowLead = await insertRow('staged_leads', {
    event_id: `${lowToken}_lead`,
    email: `${lowToken}@example.com`,
    company_name: 'Phase 8 Low Lead',
    raw_payload: { source: 'guide' },
    firmographics: { industry: 'AI', employees: 3 },
    icp_score: 42,
    buying_intent: 'low',
    status: 'nurture',
    source_type: 'inbound',
  })

  await insertRow('acquisition_touches', {
    lead_id: lowLead.id,
    channel: 'inbound',
    source: lowSource,
    source_id: `${lowToken}_source_id`,
    medium: 'content',
    campaign: lowCampaign,
    referrer: 'https://costpilot.test/blog',
    utm_source: lowSource,
    utm_medium: 'content',
    utm_campaign: lowCampaign,
    touch_type: 'first_touch',
    occurred_at: isoNowMinusDays(3),
    metadata: {},
  })

  await insertRow('acquisition_touches', {
    lead_id: lowLead.id,
    channel: 'inbound',
    source: lowSource,
    source_id: `${lowToken}_source_id`,
    medium: 'content',
    campaign: lowCampaign,
    referrer: 'https://costpilot.test/blog',
    utm_source: lowSource,
    utm_medium: 'content',
    utm_campaign: lowCampaign,
    touch_type: 'last_touch',
    occurred_at: isoNowMinusDays(2),
    metadata: {},
  })

  const lowQualification = await rpc('evaluate_lead_qualification', {
    p_lead_id: lowLead.id,
    p_evaluation_type: 'score_update',
    p_source_runtime: 'system',
  })

  assert.equal(lowQualification[0].mql_status, 'nurture')

  const afterExecutive = await fetchSingle('gtm_executive_summary?select=*')
  const afterQualification = await fetchSingle('gtm_qualification_summary?select=*')
  const afterProduct = await fetchSingle('gtm_product_summary?select=*')
  const afterHealth = await fetchSingle('gtm_customer_health_summary?select=*')
  const afterSalesOverall = await fetchSingle('gtm_sales_workload_summary?owner_type=eq.all&rep_code=eq.all&select=*')

  assert.equal(numeric(afterExecutive.total_leads) >= numeric(beforeExecutive.total_leads) + 2, true)
  assert.equal(numeric(afterExecutive.total_accounts) >= numeric(beforeExecutive.total_accounts) + 1, true)
  assert.equal(numeric(afterExecutive.mql_count) >= numeric(beforeExecutive.mql_count) + 1, true)
  assert.equal(numeric(afterExecutive.sql_count) >= numeric(beforeExecutive.sql_count) + 1, true)
  assert.equal(numeric(afterExecutive.pql_count) >= numeric(beforeExecutive.pql_count) + 1, true)
  assert.equal(numeric(afterExecutive.routed_leads) >= numeric(beforeExecutive.routed_leads) + 1, true)
  assert.equal(numeric(afterExecutive.current_monitored_spend) >= numeric(beforeExecutive.current_monitored_spend) + 275, true)
  assert.equal(afterExecutive.revenue_churn_percentage, null)
  assert.equal(afterExecutive.logo_churn_percentage, null)
  assert.equal(afterExecutive.grr_percentage, null)
  assert.equal(afterExecutive.nrr_percentage, null)

  assert.equal(numeric(afterQualification.evaluated_leads) >= numeric(beforeQualification.evaluated_leads) + 2, true)
  assert.equal(numeric(afterQualification.mql_count) >= numeric(beforeQualification.mql_count) + 1, true)
  assert.equal(numeric(afterQualification.sql_count) >= numeric(beforeQualification.sql_count) + 1, true)
  assert.equal(numeric(afterQualification.pql_count) >= numeric(beforeQualification.pql_count) + 1, true)

  assert.equal(numeric(afterProduct.total_accounts) >= numeric(beforeProduct.total_accounts) + 1, true)
  assert.equal(numeric(afterProduct.current_monitored_spend) >= numeric(beforeProduct.current_monitored_spend) + 275, true)
  assert.equal(numeric(afterProduct.open_alert_count) >= numeric(beforeProduct.open_alert_count) + 1, true)
  assert.equal(numeric(afterProduct.open_recommendation_count) >= numeric(beforeProduct.open_recommendation_count) + 1, true)

  assert.equal(numeric(afterHealth.evaluated_accounts) >= numeric(beforeHealth.evaluated_accounts) + 1, true)
  assert.equal(numeric(afterHealth.healthy_accounts) >= numeric(beforeHealth.healthy_accounts) + 1, true)

  assert.equal(numeric(afterSalesOverall.queued_leads) >= numeric(beforeSalesOverall.queued_leads) + 1, true)
  assert.equal(numeric(afterSalesOverall.assigned_leads) >= numeric(beforeSalesOverall.assigned_leads) + 1, true)
  assert.equal(numeric(afterSalesOverall.deal_leads) >= numeric(beforeSalesOverall.deal_leads) + 1, true)

  const richFunnel = await fetchRows(`gtm_lifecycle_funnel?acquisition_source=eq.${richSource}&acquisition_campaign=eq.${richCampaign}&select=stage_name,stage_count,conversion_from_previous_percentage,conversion_from_acquired_percentage&order=stage_order.asc`)
  const richCounts = Object.fromEntries(richFunnel.map((row) => [row.stage_name, row]))
  for (const stageName of ['acquired', 'mql', 'sql', 'routed', 'sales_engaged', 'deal_created', 'signup', 'account', 'activated', 'pql', 'paid', 'healthy']) {
    assert.equal(richCounts[stageName].stage_count, 1, `expected ${stageName} count to be 1`)
  }
  assert.equal(numeric(richCounts.mql.conversion_from_previous_percentage), 100)
  assert.equal(numeric(richCounts.paid.conversion_from_previous_percentage), 100)

  const lowFunnel = await fetchRows(`gtm_lifecycle_funnel?acquisition_source=eq.${lowSource}&acquisition_campaign=eq.${lowCampaign}&select=stage_name,stage_count,conversion_from_previous_percentage&order=stage_order.asc`)
  const lowCounts = Object.fromEntries(lowFunnel.map((row) => [row.stage_name, row]))
  assert.equal(lowCounts.acquired.stage_count, 1)
  assert.equal(lowCounts.mql.stage_count, 0)
  assert.equal(numeric(lowCounts.mql.conversion_from_previous_percentage), 0)
  assert.equal(lowCounts.sql.stage_count, 0)
  assert.equal(lowCounts.sql.conversion_from_previous_percentage, null)

  const acquisitionMetrics = await fetchRows(`gtm_acquisition_conversion_metrics?acquisition_source=eq.${richSource}&acquisition_campaign=eq.${richCampaign}&select=*`)
  assert.equal(acquisitionMetrics[0].acquired_identities, 1)
  assert.equal(acquisitionMetrics[0].lead_count, 1)
  assert.equal(acquisitionMetrics[0].signup_count, 1)
  assert.equal(acquisitionMetrics[0].account_count, 1)
  assert.equal(numeric(acquisitionMetrics[0].mql_conversion_percentage), 100)
  assert.equal(numeric(acquisitionMetrics[0].sql_conversion_percentage), 100)
  assert.equal(numeric(acquisitionMetrics[0].activation_conversion_percentage), 100)
  assert.equal(numeric(acquisitionMetrics[0].paid_conversion_percentage), 100)

  const qualificationDistribution = await fetchRows('gtm_qualification_distribution?acquisition_channel=eq.inbound&buying_intent=eq.high&select=lead_count,average_fit_score')
  assert.equal(qualificationDistribution.some((row) => numeric(row.lead_count) >= 1 && numeric(row.average_fit_score) >= 80), true)

  const leadQueue = await fetchRows(`current_sales_queue?lead_id=eq.${lead.id}&select=rep_code,current_owner_type,deal_state`)
  assert.equal(leadQueue[0].deal_state, 'deal_created')

  const repWorkload = await fetchRows(`gtm_sales_workload_summary?rep_code=eq.${leadQueue[0].rep_code}&select=assigned_leads,deal_leads,owner_type`)
  assert.equal(repWorkload.some((row) => numeric(row.assigned_leads) >= 1 && numeric(row.deal_leads) >= 1), true)

  const today = new Date().toISOString().slice(0, 10)
  const leadTrend = await fetchRows(`gtm_lead_volume_trend?metric_day=eq.${today}&acquisition_channel=eq.inbound&select=acquired_count,mql_count,sql_count`)
  assert.equal(leadTrend.some((row) => numeric(row.acquired_count) >= 2 && numeric(row.mql_count) >= 1 && numeric(row.sql_count) >= 1), true)

  const accountTrend = await fetchRows(`gtm_account_lifecycle_trend?metric_day=eq.${today}&select=signup_accounts,activated_accounts,paid_accounts`)
  assert.equal(accountTrend.some((row) => numeric(row.activated_accounts) >= 1 && numeric(row.paid_accounts) >= 1), true)

  const spendTrend = await fetchRows(`gtm_spend_trend?metric_day=eq.${today}&select=active_accounts,total_spend`)
  assert.equal(spendTrend.some((row) => numeric(row.active_accounts) >= 1 && numeric(row.total_spend) >= 275), true)

  const healthTrend = await fetchRows(`gtm_customer_health_trend?metric_day=eq.${today}&select=evaluation_count,healthy_count`)
  assert.equal(healthTrend.some((row) => numeric(row.evaluation_count) >= 1 && numeric(row.healthy_count) >= 1), true)

  const salesTrend = await fetchRows(`gtm_sales_assignment_activity_trend?metric_day=eq.${today}&select=activity_count,routed_count`)
  assert.equal(salesTrend.some((row) => numeric(row.activity_count) >= 1 && numeric(row.routed_count) >= 1), true)

  const emptyMetrics = await fetchRows('gtm_acquisition_conversion_metrics?acquisition_source=eq.phase8_missing_source&select=*')
  assert.deepEqual(emptyMetrics, [])
})
