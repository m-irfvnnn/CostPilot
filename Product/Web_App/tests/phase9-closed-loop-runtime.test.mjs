import test from 'node:test'
import assert from 'node:assert/strict'

const baseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const runtimeTestOptions =
  baseUrl && serviceRoleKey
    ? {}
    : { skip: 'requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' }

const runtimeTest = (name, fn) => test(name, runtimeTestOptions, fn)

const PHASE9_CAMPAIGN = 'phase9_validation'
const PHASE9_PREFIX = 'phase9_demo'

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

async function patchRows(path, payload) {
  const rows = await rest(path, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  })
  return Array.isArray(rows) ? rows : []
}

async function fetchSingle(path) {
  const rows = await fetchRows(path)
  return rows[0] ?? null
}

function isoDaysAgo(days, hours = 12) {
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

async function ensureRecord({ queryPath, table, payload }) {
  const existing = await fetchSingle(queryPath)
  if (existing) return existing
  return insertRow(table, payload)
}

async function ensureProfile(slug, displayName, lastLoginAt = isoDaysAgo(1)) {
  const profile = await ensureRecord({
    queryPath: `profiles?firebase_uid=eq.${PHASE9_PREFIX}_${slug}_uid&limit=1&select=*`,
    table: 'profiles',
    payload: {
      firebase_uid: `${PHASE9_PREFIX}_${slug}_uid`,
      email: `${PHASE9_PREFIX}.${slug}@example.com`,
      display_name: displayName,
      auth_provider: 'password',
      last_login_at: lastLoginAt,
    },
  })

  await patchRows(`profiles?firebase_uid=eq.${PHASE9_PREFIX}_${slug}_uid&select=*`, {
    email: `${PHASE9_PREFIX}.${slug}@example.com`,
    display_name: displayName,
    auth_provider: 'password',
    last_login_at: lastLoginAt,
  })

  return profile
}

async function ensureAccount(slug, name) {
  const account = await ensureRecord({
    queryPath: `accounts?slug=eq.${PHASE9_PREFIX}_${slug}&limit=1&select=*`,
    table: 'accounts',
    payload: {
      name,
      slug: `${PHASE9_PREFIX}_${slug}`,
      primary_domain: 'example.com',
      onboarding_status: 'completed',
    },
  })

  await patchRows(`accounts?slug=eq.${PHASE9_PREFIX}_${slug}&select=*`, {
    name,
    primary_domain: 'example.com',
    onboarding_status: 'completed',
  })

  return account
}

async function ensureMembership(accountId, profileId) {
  return ensureRecord({
    queryPath: `account_members?account_id=eq.${accountId}&profile_id=eq.${profileId}&limit=1&select=*`,
    table: 'account_members',
    payload: {
      account_id: accountId,
      profile_id: profileId,
      role: 'owner',
      is_owner: true,
    },
  })
}

async function ensureOnboarding(accountId, profileId, companySize, providers, spend, completedAt) {
  const onboarding = await ensureRecord({
    queryPath: `onboarding_responses?account_id=eq.${accountId}&profile_id=eq.${profileId}&limit=1&select=*`,
    table: 'onboarding_responses',
    payload: {
      profile_id: profileId,
      account_id: accountId,
      company_size: companySize,
      providers,
      estimated_monthly_spend: spend,
      raw_answers: { company_size: companySize, providers, estimated_monthly_spend: spend, synthetic: true },
      completed_at: completedAt,
    },
  })

  await patchRows(`onboarding_responses?account_id=eq.${accountId}&profile_id=eq.${profileId}&select=*`, {
    company_size: companySize,
    providers,
    estimated_monthly_spend: spend,
    raw_answers: { company_size: companySize, providers, estimated_monthly_spend: spend, synthetic: true },
    completed_at: completedAt,
  })

  return onboarding
}

async function ensurePlan(accountId, profileId, payload) {
  const plan = await ensureRecord({
    queryPath: `account_plans?account_id=eq.${accountId}&limit=1&select=*`,
    table: 'account_plans',
    payload: {
      account_id: accountId,
      profile_id: profileId,
      billing_provider: 'payu',
      billing_interval: 'monthly',
      metadata: { synthetic: true, cohort: 'phase9' },
      ...payload,
    },
  })

  await patchRows(`account_plans?account_id=eq.${accountId}&select=*`, {
    profile_id: profileId,
    billing_provider: 'payu',
    billing_interval: 'monthly',
    metadata: { synthetic: true, cohort: 'phase9' },
    ...payload,
  })

  return plan
}

async function ensureLead(slug, payload) {
  const lead = await ensureRecord({
    queryPath: `staged_leads?event_id=eq.${PHASE9_PREFIX}_${slug}_lead&limit=1&select=*`,
    table: 'staged_leads',
    payload: {
      event_id: `${PHASE9_PREFIX}_${slug}_lead`,
      email: `${PHASE9_PREFIX}.${slug}@example.com`,
      company_name: payload.company_name,
      raw_payload: {
        synthetic: true,
        cohort: 'phase9',
        campaign: PHASE9_CAMPAIGN,
        ...payload.raw_payload,
      },
      firmographics: payload.firmographics,
      icp_score: payload.icp_score,
      buying_intent: payload.buying_intent,
      status: payload.status,
      source_type: payload.source_type,
    },
  })

  await patchRows(`staged_leads?event_id=eq.${PHASE9_PREFIX}_${slug}_lead&select=*`, {
    company_name: payload.company_name,
    raw_payload: {
      synthetic: true,
      cohort: 'phase9',
      campaign: PHASE9_CAMPAIGN,
      ...payload.raw_payload,
    },
    firmographics: payload.firmographics,
    icp_score: payload.icp_score,
    buying_intent: payload.buying_intent,
    status: payload.status,
    source_type: payload.source_type,
  })

  return lead
}

async function ensureLeadEvent(leadId, eventType, eventData = {}) {
  return ensureRecord({
    queryPath: `lead_events?lead_id=eq.${leadId}&event_type=eq.${eventType}&limit=1&select=*`,
    table: 'lead_events',
    payload: {
      lead_id: leadId,
      event_type: eventType,
      event_data: { synthetic: true, cohort: 'phase9', ...eventData },
    },
  })
}

async function ensureTouch(leadId, payload) {
  return ensureRecord({
    queryPath: `acquisition_touches?lead_id=eq.${leadId}&touch_type=eq.${payload.touch_type}&limit=1&select=*`,
    table: 'acquisition_touches',
    payload,
  })
}

async function ensureEvent(accountId, profileId, firebaseUid, eventName, createdAt) {
  const event = await ensureRecord({
    queryPath: `product_events?account_id=eq.${accountId}&event_name=eq.${eventName}&limit=1&select=*`,
    table: 'product_events',
    payload: {
      account_id: accountId,
      profile_id: profileId,
      firebase_uid: firebaseUid,
      event_name: eventName,
      event_source: 'system',
      event_properties: { synthetic: true, cohort: 'phase9' },
      created_at: createdAt,
    },
  })

  await patchRows(`product_events?account_id=eq.${accountId}&event_name=eq.${eventName}&select=*`, {
    profile_id: profileId,
    firebase_uid: firebaseUid,
    event_source: 'system',
    event_properties: { synthetic: true, cohort: 'phase9' },
    created_at: createdAt,
  })

  return event
}

async function ensureConnection(accountId, provider, connectedAt, syncedAt, status = 'connected') {
  const connection = await ensureRecord({
    queryPath: `provider_connections?account_id=eq.${accountId}&provider=eq.${provider}&connection_mode=eq.demo_fixture&limit=1&select=*`,
    table: 'provider_connections',
    payload: {
      account_id: accountId,
      provider,
      connection_mode: 'demo_fixture',
      connection_status: status,
      metadata: { adapter: 'demo_fixture_v1', synthetic: true, cohort: 'phase9' },
      connected_at: connectedAt,
      last_synced_at: syncedAt,
    },
  })

  await patchRows(`provider_connections?account_id=eq.${accountId}&provider=eq.${provider}&connection_mode=eq.demo_fixture&select=*`, {
    connection_status: status,
    metadata: { adapter: 'demo_fixture_v1', synthetic: true, cohort: 'phase9' },
    connected_at: connectedAt,
    last_synced_at: syncedAt,
  })

  return connection
}

async function ensureUsage(accountId, providerConnectionId, sourceRecordId, provider, serviceName, modelName, cost, daysAgo) {
  const usage = await ensureRecord({
    queryPath: `usage_records?provider_connection_id=eq.${providerConnectionId}&source_type=eq.demo_fixture&source_record_id=eq.${sourceRecordId}&limit=1&select=*`,
    table: 'usage_records',
    payload: {
      account_id: accountId,
      provider_connection_id: providerConnectionId,
      provider,
      service_name: serviceName,
      model_name: modelName,
      usage_quantity: 100000,
      usage_unit: 'tokens',
      unit_price: 0.000005,
      calculated_cost: cost,
      usage_at: isoDaysAgo(daysAgo),
      period_start: `${currentMonthStart()}T00:00:00.000Z`,
      period_end: null,
      source_type: 'demo_fixture',
      source_record_id: sourceRecordId,
      metadata: { synthetic: true, cohort: 'phase9' },
    },
  })

  await patchRows(
    `usage_records?provider_connection_id=eq.${providerConnectionId}&source_type=eq.demo_fixture&source_record_id=eq.${sourceRecordId}&select=*`,
    {
      account_id: accountId,
      provider,
      service_name: serviceName,
      model_name: modelName,
      usage_quantity: 100000,
      usage_unit: 'tokens',
      unit_price: 0.000005,
      calculated_cost: cost,
      usage_at: isoDaysAgo(daysAgo),
      period_start: `${currentMonthStart()}T00:00:00.000Z`,
      period_end: null,
      metadata: { synthetic: true, cohort: 'phase9' },
    },
  )

  return usage
}

async function ensureBudget(accountId, profileId, amount, thresholdPercentage, daysAgo) {
  const budget = await ensureRecord({
    queryPath: `budgets?account_id=eq.${accountId}&budget_scope=eq.account&period_month=eq.${currentMonthStart()}&limit=1&select=*`,
    table: 'budgets',
    payload: {
      account_id: accountId,
      provider_connection_id: null,
      provider: null,
      budget_scope: 'account',
      period_month: currentMonthStart(),
      amount,
      currency: 'USD',
      threshold_percentage: thresholdPercentage,
      alerting_enabled: true,
      status: 'active',
      created_by_profile_id: profileId,
      created_at: isoDaysAgo(daysAgo),
      updated_at: isoDaysAgo(daysAgo),
    },
  })

  await patchRows(`budgets?account_id=eq.${accountId}&budget_scope=eq.account&period_month=eq.${currentMonthStart()}&select=*`, {
    amount,
    currency: 'USD',
    threshold_percentage: thresholdPercentage,
    alerting_enabled: true,
    status: 'active',
    created_by_profile_id: profileId,
    created_at: isoDaysAgo(daysAgo),
    updated_at: isoDaysAgo(daysAgo),
  })

  return budget
}

async function ensureAlert(accountId, alertType, severity, observedValue, daysAgo) {
  const alert = await ensureRecord({
    queryPath: `product_alerts?account_id=eq.${accountId}&alert_type=eq.${alertType}&status=eq.open&limit=1&select=*`,
    table: 'product_alerts',
    payload: {
      account_id: accountId,
      provider_connection_id: null,
      budget_id: null,
      provider: null,
      alert_type: alertType,
      severity,
      status: 'open',
      threshold_value: 80,
      observed_value: observedValue,
      observed_period: currentMonthStart(),
      metadata: { synthetic: true, cohort: 'phase9' },
      triggered_at: isoDaysAgo(daysAgo),
      resolved_at: null,
    },
  })

  await patchRows(`product_alerts?account_id=eq.${accountId}&alert_type=eq.${alertType}&status=eq.open&select=*`, {
    severity,
    threshold_value: 80,
    observed_value: observedValue,
    observed_period: currentMonthStart(),
    metadata: { synthetic: true, cohort: 'phase9' },
    triggered_at: isoDaysAgo(daysAgo),
    resolved_at: null,
  })

  return alert
}

async function ensureRecommendation(accountId, provider, type, priority, title, observedValue, daysAgo) {
  const recommendation = await ensureRecord({
    queryPath: `cost_recommendations?account_id=eq.${accountId}&recommendation_type=eq.${type}&provider=eq.${provider}&status=eq.open&limit=1&select=*`,
    table: 'cost_recommendations',
    payload: {
      account_id: accountId,
      provider_connection_id: null,
      provider,
      service_name: null,
      model_name: null,
      recommendation_type: type,
      priority,
      status: 'open',
      title,
      summary: 'Synthetic Phase 9 validation recommendation.',
      observed_value: observedValue,
      metadata: { synthetic: true, cohort: 'phase9' },
      generated_at: isoDaysAgo(daysAgo),
    },
  })

  await patchRows(
    `cost_recommendations?account_id=eq.${accountId}&recommendation_type=eq.${type}&provider=eq.${provider}&status=eq.open&select=*`,
    {
      priority,
      title,
      summary: 'Synthetic Phase 9 validation recommendation.',
      observed_value: observedValue,
      metadata: { synthetic: true, cohort: 'phase9' },
      generated_at: isoDaysAgo(daysAgo),
    },
  )

  return recommendation
}

async function ensureBillingTransaction(accountId, profileId, slug, planId, paymentStatus, amount, daysAgo) {
  const transaction = await ensureRecord({
    queryPath: `billing_transactions?billing_provider=eq.payu&provider_txn_id=eq.${PHASE9_PREFIX}_${slug}_txn&limit=1&select=*`,
    table: 'billing_transactions',
    payload: {
      account_id: accountId,
      profile_id: profileId,
      billing_provider: 'payu',
      plan_id: planId,
      billing_interval: 'monthly',
      amount,
      currency: 'INR',
      provider_txn_id: `${PHASE9_PREFIX}_${slug}_txn`,
      provider_payment_id: `${PHASE9_PREFIX}_${slug}_mih`,
      payment_status: paymentStatus,
      verification_status: 'verified',
      idempotency_key: `${PHASE9_PREFIX}_${slug}_idem`,
      checkout_payload: { synthetic: true },
      verified_payload: { synthetic: true },
      activated_at: paymentStatus === 'success' ? isoDaysAgo(daysAgo) : null,
      verified_at: isoDaysAgo(daysAgo),
    },
  })

  await patchRows(`billing_transactions?billing_provider=eq.payu&provider_txn_id=eq.${PHASE9_PREFIX}_${slug}_txn&select=*`, {
    account_id: accountId,
    profile_id: profileId,
    plan_id: planId,
    billing_interval: 'monthly',
    amount,
    currency: 'INR',
    provider_payment_id: `${PHASE9_PREFIX}_${slug}_mih`,
    payment_status: paymentStatus,
    verification_status: 'verified',
    idempotency_key: `${PHASE9_PREFIX}_${slug}_idem`,
    checkout_payload: { synthetic: true },
    verified_payload: { synthetic: true },
    activated_at: paymentStatus === 'success' ? isoDaysAgo(daysAgo) : null,
    verified_at: isoDaysAgo(daysAgo),
  })

  return transaction
}

async function resetOutreachState(leadId, slug) {
  await patchRows(`outreach?lead_id=eq.${leadId}&subject=eq.phase9_${slug}&select=*`, {
    status: 'sent',
    reply_received_at: null,
    deal_id: null,
    sent_at: isoDaysAgo(1),
    next_followup_at: null,
  })
}

async function ensureOutreach(leadId, slug, status, replyAt, dealId = null) {
  const outreach = await ensureRecord({
    queryPath: `outreach?lead_id=eq.${leadId}&subject=eq.phase9_${slug}&limit=1&select=*`,
    table: 'outreach',
    payload: {
      lead_id: leadId,
      email: `${PHASE9_PREFIX}.${slug}@example.com`,
      subject: `phase9_${slug}`,
      body: 'Synthetic Phase 9 validation outreach.',
      status,
      sent_at: isoDaysAgo(1),
      next_followup_at: null,
      reply_received_at: replyAt,
      deal_id: dealId,
    },
  })

  await patchRows(`outreach?lead_id=eq.${leadId}&subject=eq.phase9_${slug}&select=*`, {
    email: `${PHASE9_PREFIX}.${slug}@example.com`,
    body: 'Synthetic Phase 9 validation outreach.',
    status,
    sent_at: isoDaysAgo(1),
    next_followup_at: null,
    reply_received_at: replyAt,
    deal_id: dealId,
  })

  return outreach
}

runtimeTest('Phase 9 closed-loop cohort reuses existing contracts for client, revops, analytics, and Retool-facing validation', async () => {
  const partner = await ensureRecord({
    queryPath: 'acquisition_partners?partner_id=eq.phase9_partner_alliance&limit=1&select=*',
    table: 'acquisition_partners',
    payload: {
      partner_id: 'phase9_partner_alliance',
      name: 'Phase9 Partner Alliance',
      partner_type: 'agency',
      status: 'active',
      source_identifier: 'phase9_partner_alliance',
      default_campaign: PHASE9_CAMPAIGN,
      metadata: { synthetic: true, cohort: 'phase9' },
    },
  })

  const creator = await ensureRecord({
    queryPath: 'acquisition_creators?creator_id=eq.phase9_creator_signal&limit=1&select=*',
    table: 'acquisition_creators',
    payload: {
      creator_id: 'phase9_creator_signal',
      name: 'Phase9 Signal Creator',
      platform: 'linkedin',
      status: 'active',
      source_identifier: 'phase9_creator_signal',
      default_campaign: PHASE9_CAMPAIGN,
      metadata: { synthetic: true, cohort: 'phase9' },
    },
  })

  const referral = await ensureRecord({
    queryPath: 'acquisition_referrals?referral_id=eq.phase9_customer_referral&limit=1&select=*',
    table: 'acquisition_referrals',
    payload: {
      referral_id: 'phase9_customer_referral',
      referral_code: 'PHASE9REF',
      referring_profile_id: null,
      referring_account_id: null,
      referring_partner_id: partner.partner_id,
      status: 'active',
      metadata: { synthetic: true, cohort: 'phase9' },
    },
  })

  const leadScenarios = [
    {
      slug: 'partner_full_loop',
      company_name: 'Phase9 Partner Full Loop',
      source_type: 'inbound',
      status: 'qualified',
      icp_score: 82,
      buying_intent: 'medium',
      raw_payload: { source: 'partner_portal', medium: 'partner', partner_id: partner.partner_id, campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'AI', employees: 45, country_code: 'US' },
      channel: 'partner',
    },
    {
      slug: 'outbound_sdr',
      company_name: 'Phase9 Outbound SDR',
      source_type: 'outbound_scraped',
      status: 'ready_to_push',
      icp_score: 79,
      buying_intent: 'high',
      raw_payload: { source: 'scraper', medium: 'signal_outbound', url: 'https://example.com/outbound', campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'AI', employees: 70, country_code: 'US' },
      channel: 'outbound',
    },
    {
      slug: 'creator_mql',
      company_name: 'Phase9 Creator MQL',
      source_type: 'inbound',
      status: 'nurture',
      icp_score: 68,
      buying_intent: 'high',
      raw_payload: { source: 'linkedin_creator', medium: 'creator', creator_id: creator.creator_id, campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'SaaS', employees: 45, country_code: 'US' },
      channel: 'creator',
    },
    {
      slug: 'referral_hot_sql',
      company_name: 'Phase9 Referral SQL',
      source_type: 'inbound',
      status: 'qualified',
      icp_score: 88,
      buying_intent: 'high',
      raw_payload: { source: 'customer_referral', medium: 'referral', referral_id: referral.referral_id, campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'FinTech', employees: 340, country_code: 'US' },
      channel: 'referral',
    },
    {
      slug: 'inbound_new',
      company_name: 'Phase9 New Inbound',
      source_type: 'inbound',
      status: 'nurture',
      icp_score: 42,
      buying_intent: 'low',
      raw_payload: { source: 'website', form: 'contact', medium: 'web_form', campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'Retail', employees: 8, country_code: 'US' },
      channel: 'inbound',
    },
    {
      slug: 'signup_only',
      company_name: 'Phase9 Signup Only',
      source_type: 'inbound',
      status: 'qualified',
      icp_score: 63,
      buying_intent: 'medium',
      raw_payload: { source: 'pricing_form', form: 'pricing_form', medium: 'web_form', campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'Infra', employees: 25, country_code: 'US' },
      channel: 'inbound',
    },
    {
      slug: 'activated_account',
      company_name: 'Phase9 Activated Account',
      source_type: 'inbound',
      status: 'qualified',
      icp_score: 76,
      buying_intent: 'high',
      raw_payload: { source: 'website', form: 'demo_request', medium: 'web_form', campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'AI', employees: 90, country_code: 'US' },
      channel: 'inbound',
    },
    {
      slug: 'at_risk_account',
      company_name: 'Phase9 At Risk Account',
      source_type: 'inbound',
      status: 'qualified',
      icp_score: 72,
      buying_intent: 'medium',
      raw_payload: { source: 'content', form: 'ebook', medium: 'content', campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'Security', employees: 60, country_code: 'US' },
      channel: 'inbound',
    },
    {
      slug: 'dormant_account',
      company_name: 'Phase9 Dormant Account',
      source_type: 'inbound',
      status: 'qualified',
      icp_score: 74,
      buying_intent: 'medium',
      raw_payload: { source: 'partner_blog', form: 'ebook', medium: 'content', campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'SaaS', employees: 80, country_code: 'US' },
      channel: 'inbound',
    },
    {
      slug: 'payment_risk_account',
      company_name: 'Phase9 Payment Risk Account',
      source_type: 'inbound',
      status: 'qualified',
      icp_score: 81,
      buying_intent: 'high',
      raw_payload: { source: 'demo_request', form: 'demo_request', medium: 'web_form', campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'AI', employees: 110, country_code: 'US' },
      channel: 'inbound',
    },
    {
      slug: 'expansion_ready',
      company_name: 'Phase9 Expansion Ready',
      source_type: 'inbound',
      status: 'qualified',
      icp_score: 84,
      buying_intent: 'high',
      raw_payload: { source: 'partner_portal', form: 'demo_request', medium: 'partner', campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'AI', employees: 160, country_code: 'US' },
      channel: 'inbound',
    },
    {
      slug: 'upgrade_budget_overrun',
      company_name: 'Phase9 Upgrade Overrun',
      source_type: 'inbound',
      status: 'qualified',
      icp_score: 86,
      buying_intent: 'high',
      raw_payload: { source: 'website', form: 'pricing_form', medium: 'paid_social', campaign: PHASE9_CAMPAIGN },
      firmographics: { industry: 'Data', employees: 140, country_code: 'US' },
      channel: 'inbound',
    },
  ]

  const createdLeads = new Map()

  for (const scenario of leadScenarios) {
    const lead = await ensureLead(scenario.slug, scenario)
    createdLeads.set(scenario.slug, lead)

    await ensureTouch(lead.id, {
      lead_id: lead.id,
      firebase_uid: null,
      profile_id: null,
      account_id: null,
      channel: scenario.channel,
      source: scenario.raw_payload.source,
      source_id: `${PHASE9_PREFIX}_${scenario.slug}_source`,
      medium: scenario.raw_payload.medium,
      campaign: PHASE9_CAMPAIGN,
      referrer: `https://costpilot.test/${scenario.slug}`,
      utm_source: scenario.raw_payload.source,
      utm_medium: scenario.raw_payload.medium,
      utm_campaign: PHASE9_CAMPAIGN,
      utm_content: scenario.slug,
      utm_term: null,
      partner_id: scenario.raw_payload.partner_id ?? null,
      creator_id: scenario.raw_payload.creator_id ?? null,
      referral_id: scenario.raw_payload.referral_id ?? null,
      touch_type: 'first_touch',
      occurred_at: isoDaysAgo(12),
      metadata: { synthetic: true, cohort: 'phase9' },
    })

    await ensureTouch(lead.id, {
      lead_id: lead.id,
      firebase_uid: null,
      profile_id: null,
      account_id: null,
      channel: scenario.channel,
      source: scenario.raw_payload.source,
      source_id: `${PHASE9_PREFIX}_${scenario.slug}_source`,
      medium: scenario.raw_payload.medium,
      campaign: PHASE9_CAMPAIGN,
      referrer: `https://costpilot.test/${scenario.slug}/pricing`,
      utm_source: scenario.raw_payload.source,
      utm_medium: scenario.raw_payload.medium,
      utm_campaign: PHASE9_CAMPAIGN,
      utm_content: `${scenario.slug}_last`,
      utm_term: null,
      partner_id: scenario.raw_payload.partner_id ?? null,
      creator_id: scenario.raw_payload.creator_id ?? null,
      referral_id: scenario.raw_payload.referral_id ?? null,
      touch_type: 'last_touch',
      occurred_at: isoDaysAgo(1),
      metadata: { synthetic: true, cohort: 'phase9' },
    })

    if (scenario.source_type === 'outbound_scraped') {
      await ensureLeadEvent(lead.id, 'lead.ready_to_push')
    }

    await rpc('evaluate_lead_qualification', {
      p_lead_id: lead.id,
      p_evaluation_type: scenario.source_type === 'outbound_scraped' ? 'outbound_ready' : 'score_update',
      p_source_runtime: 'system',
    })
  }

  const outboundLead = createdLeads.get('outbound_sdr')
  const canonicalLead = createdLeads.get('partner_full_loop')
  const referralLead = createdLeads.get('referral_hot_sql')

  await resetOutreachState(canonicalLead.id, 'partner_full_loop')

  const outboundRoute = await rpc('route_lead_to_sales', {
    p_lead_id: outboundLead.id,
    p_trigger: 'phase9_outbound_queue',
    p_force_reassign: false,
  })
  assert.equal(outboundRoute[0].current_owner_type, 'sdr')

  const canonicalRoute = await rpc('route_lead_to_sales', {
    p_lead_id: canonicalLead.id,
    p_trigger: 'phase9_partner_route',
    p_force_reassign: true,
  })
  assert.equal(canonicalRoute[0].current_owner_type, 'sdr')

  await ensureOutreach(canonicalLead.id, 'partner_full_loop', 'replied', isoDaysAgo(0), `${PHASE9_PREFIX}_partner_full_loop_deal`)

  const canonicalHandoff = await rpc('route_lead_to_sales', {
    p_lead_id: canonicalLead.id,
    p_trigger: 'phase9_partner_handoff',
    p_force_reassign: false,
  })
  assert.equal(canonicalHandoff[0].current_owner_type, 'ae')
  assert.equal(canonicalHandoff[0].routing_status, 'handed_off')

  const referralRoute = await rpc('route_lead_to_sales', {
    p_lead_id: referralLead.id,
    p_trigger: 'phase9_referral_route',
    p_force_reassign: false,
  })
  assert.equal(referralRoute[0].current_owner_type, 'ae')

  const referralOverride = await rpc('override_sales_assignment', {
    p_lead_id: referralLead.id,
    p_rep_code: 'ae_global_1',
    p_reason: 'phase9_synthetic_override',
    p_force_owner_type: 'ae',
  })
  assert.equal(referralOverride[0].routing_status, 'manually_overridden')

  const accountScenarios = [
    {
      slug: 'partner_full_loop',
      name: 'Phase9 Partner Full Loop',
      companySize: '51-200',
      providers: ['OpenAI', 'Anthropic'],
      spend: '$10K-$25K',
      lastLoginAt: isoDaysAgo(1),
      plan: { current_plan_id: 'starter', plan_status: 'active', activated_at: isoDaysAgo(5) },
      events: ['signup', 'onboarding_completed', 'provider_connected', 'usage_synced', 'insight_generated', 'budget_created', 'alert_configured', 'dashboard_viewed'],
      connections: [
        { provider: 'openai', connectedAt: isoDaysAgo(9), syncedAt: isoDaysAgo(1), costs: [420, 260] },
        { provider: 'anthropic', connectedAt: isoDaysAgo(8), syncedAt: isoDaysAgo(1), costs: [210] },
      ],
      budget: { amount: 1400, threshold: 80, daysAgo: 3 },
      recommendation: { provider: 'openai', type: 'provider_cost_concentration', priority: 'medium', title: 'Review OpenAI concentration', observedValue: 420, daysAgo: 1 },
      billing: { planId: 'starter', paymentStatus: 'success', amount: 1, daysAgo: 1 },
    },
    {
      slug: 'signup_only',
      name: 'Phase9 Signup Only',
      companySize: '11-50',
      providers: ['OpenAI'],
      spend: '$1K-$5K',
      lastLoginAt: isoDaysAgo(1),
      plan: { current_plan_id: 'starter', plan_status: 'active', activated_at: isoDaysAgo(2) },
      events: ['signup', 'onboarding_completed', 'dashboard_viewed'],
      connections: [],
      budget: null,
      recommendation: null,
      billing: null,
    },
    {
      slug: 'activated_account',
      name: 'Phase9 Activated Account',
      companySize: '11-50',
      providers: ['OpenAI'],
      spend: '$5K-$10K',
      lastLoginAt: isoDaysAgo(1),
      plan: { current_plan_id: 'starter', plan_status: 'active', activated_at: isoDaysAgo(4) },
      events: ['signup', 'onboarding_completed', 'provider_connected', 'usage_synced', 'insight_generated', 'budget_created', 'alert_configured', 'dashboard_viewed'],
      connections: [{ provider: 'openai', connectedAt: isoDaysAgo(6), syncedAt: isoDaysAgo(1), costs: [310, 190] }],
      budget: { amount: 900, threshold: 80, daysAgo: 2 },
      recommendation: { provider: 'openai', type: 'budget_missing', priority: 'low', title: 'Budget established', observedValue: 0, daysAgo: 1 },
      billing: null,
    },
    {
      slug: 'at_risk_account',
      name: 'Phase9 At Risk Account',
      companySize: '11-50',
      providers: ['OpenAI'],
      spend: '$1K-$5K',
      lastLoginAt: isoDaysAgo(6),
      plan: { current_plan_id: 'starter', plan_status: 'active', activated_at: isoDaysAgo(12) },
      events: ['signup', 'onboarding_completed', 'provider_connected', 'dashboard_viewed'],
      connections: [{ provider: 'openai', connectedAt: isoDaysAgo(14), syncedAt: isoDaysAgo(12), costs: [] }],
      budget: null,
      recommendation: null,
      billing: null,
    },
    {
      slug: 'dormant_account',
      name: 'Phase9 Dormant Account',
      companySize: '11-50',
      providers: ['OpenAI'],
      spend: '$5K-$10K',
      lastLoginAt: isoDaysAgo(30),
      plan: { current_plan_id: 'growth', plan_status: 'active', activated_at: isoDaysAgo(20) },
      eventDaysAgo: {
        signup: 30,
        onboarding_completed: 29,
        provider_connected: 30,
        usage_synced: 28,
        insight_generated: 28,
        budget_created: 28,
      },
      events: ['signup', 'onboarding_completed', 'provider_connected', 'usage_synced', 'insight_generated', 'budget_created'],
      connections: [{ provider: 'openai', connectedAt: isoDaysAgo(30), syncedAt: isoDaysAgo(28), costs: [180], usageDaysAgo: [28] }],
      budget: { amount: 1200, threshold: 80, daysAgo: 10 },
      recommendation: null,
      billing: null,
    },
    {
      slug: 'payment_risk_account',
      name: 'Phase9 Payment Risk Account',
      companySize: '51-200',
      providers: ['OpenAI'],
      spend: '$10K-$25K',
      lastLoginAt: isoDaysAgo(2),
      plan: { current_plan_id: 'growth', plan_status: 'failed_payment', activated_at: isoDaysAgo(9) },
      events: ['signup', 'onboarding_completed', 'provider_connected', 'usage_synced', 'insight_generated', 'budget_created', 'alert_configured', 'dashboard_viewed'],
      connections: [{ provider: 'openai', connectedAt: isoDaysAgo(12), syncedAt: isoDaysAgo(1), costs: [330] }],
      budget: { amount: 1000, threshold: 75, daysAgo: 2 },
      recommendation: null,
      billing: { planId: 'growth', paymentStatus: 'failed', amount: 1, daysAgo: 1 },
    },
    {
      slug: 'expansion_ready',
      name: 'Phase9 Expansion Ready',
      companySize: '51-200',
      providers: ['OpenAI', 'Anthropic'],
      spend: '$10K-$25K',
      lastLoginAt: isoDaysAgo(1),
      plan: { current_plan_id: 'starter', plan_status: 'active', activated_at: isoDaysAgo(11) },
      events: ['signup', 'onboarding_completed', 'provider_connected', 'usage_synced', 'insight_generated', 'budget_created', 'alert_configured', 'dashboard_viewed'],
      connections: [
        { provider: 'openai', connectedAt: isoDaysAgo(14), syncedAt: isoDaysAgo(1), costs: [360, 290] },
        { provider: 'anthropic', connectedAt: isoDaysAgo(13), syncedAt: isoDaysAgo(1), costs: [240] },
      ],
      budget: { amount: 1800, threshold: 85, daysAgo: 4 },
      recommendation: { provider: 'openai', type: 'provider_cost_concentration', priority: 'medium', title: 'Expansion usage concentration', observedValue: 360, daysAgo: 1 },
      billing: null,
    },
    {
      slug: 'upgrade_budget_overrun',
      name: 'Phase9 Upgrade Overrun',
      companySize: '51-200',
      providers: ['OpenAI', 'Anthropic', 'AWS'],
      spend: '$25K-$50K',
      lastLoginAt: isoDaysAgo(1),
      plan: { current_plan_id: 'starter', plan_status: 'active', activated_at: isoDaysAgo(9) },
      events: ['signup', 'onboarding_completed', 'provider_connected', 'usage_synced', 'insight_generated', 'budget_created', 'alert_configured', 'dashboard_viewed', 'upgrade_requested'],
      connections: [
        { provider: 'openai', connectedAt: isoDaysAgo(12), syncedAt: isoDaysAgo(1), costs: [520, 420] },
        { provider: 'anthropic', connectedAt: isoDaysAgo(11), syncedAt: isoDaysAgo(1), costs: [430] },
        { provider: 'aws', connectedAt: isoDaysAgo(11), syncedAt: isoDaysAgo(1), costs: [290] },
      ],
      budget: { amount: 900, threshold: 80, daysAgo: 3 },
      recommendation: { provider: 'openai', type: 'projected_budget_overrun', priority: 'high', title: 'Projected overrun', observedValue: 520, daysAgo: 1 },
      billing: null,
    },
  ]

  const createdAccounts = new Map()

  for (const scenario of accountScenarios) {
    const profile = await ensureProfile(scenario.slug, scenario.name, scenario.lastLoginAt)
    const account = await ensureAccount(scenario.slug, scenario.name)
    createdAccounts.set(scenario.slug, { profile, account })

    await ensureMembership(account.id, profile.id)
    await ensureOnboarding(account.id, profile.id, scenario.companySize, scenario.providers, scenario.spend, isoDaysAgo(10))
    await ensurePlan(account.id, profile.id, scenario.plan)

    for (const eventName of scenario.events) {
      const daysAgo = scenario.eventDaysAgo?.[eventName] ?? (eventName === 'signup' ? 12 : 1)
      await ensureEvent(account.id, profile.id, profile.firebase_uid, eventName, isoDaysAgo(daysAgo))
    }

    let usageIndex = 0
    for (const connectionSpec of scenario.connections) {
      const connection = await ensureConnection(account.id, connectionSpec.provider, connectionSpec.connectedAt, connectionSpec.syncedAt)
      for (const cost of connectionSpec.costs) {
        usageIndex += 1
        const usageDaysAgo = connectionSpec.usageDaysAgo?.[usageIndex - 1] ?? usageIndex
        await ensureUsage(
          account.id,
          connection.id,
          `${PHASE9_PREFIX}_${scenario.slug}_${usageIndex}`,
          connectionSpec.provider,
          'chat-completions',
          'gpt-4o-mini',
          cost,
          usageDaysAgo,
        )
      }
    }

    if (scenario.budget) {
      await ensureBudget(account.id, profile.id, scenario.budget.amount, scenario.budget.threshold, scenario.budget.daysAgo)
    }

    if (scenario.recommendation) {
      await ensureRecommendation(
        account.id,
        scenario.recommendation.provider,
        scenario.recommendation.type,
        scenario.recommendation.priority,
        scenario.recommendation.title,
        scenario.recommendation.observedValue,
        scenario.recommendation.daysAgo,
      )
    }

    if (scenario.slug === 'upgrade_budget_overrun') {
      await ensureAlert(account.id, 'projected_budget_overrun', 'high', 140, 1)
    }

    if (scenario.billing) {
      await ensureBillingTransaction(account.id, profile.id, scenario.slug, scenario.billing.planId, scenario.billing.paymentStatus, scenario.billing.amount, scenario.billing.daysAgo)
    }
  }

  const canonical = createdAccounts.get('partner_full_loop')
  const canonicalHealth = await rpc('evaluate_account_health', {
    p_account_id: canonical.account.id,
    p_evaluation_type: 'synthetic_scenario',
  })
  assert.equal(canonicalHealth[0].health_state, 'healthy')
  assert.equal(canonicalHealth[0].expansion_state, 'expansion_candidate')

  const signupOnly = createdAccounts.get('signup_only')
  const signupOverview = await fetchSingle(`account_dashboard_overview?account_id=eq.${signupOnly.account.id}&limit=1&select=*`)
  assert.equal(signupOverview.activation_score < 80, true)

  const activated = createdAccounts.get('activated_account')
  const activatedState = await fetchSingle(`account_activation_state?account_id=eq.${activated.account.id}&limit=1&select=*`)
  assert.equal(activatedState.activated, true)

  const atRisk = createdAccounts.get('at_risk_account')
  const atRiskHealth = await rpc('evaluate_account_health', {
    p_account_id: atRisk.account.id,
    p_evaluation_type: 'synthetic_scenario',
  })
  assert.equal(['at_risk', 'critical'].includes(atRiskHealth[0].health_state), true)

  const dormant = createdAccounts.get('dormant_account')
  const dormantHealth = await rpc('evaluate_account_health', {
    p_account_id: dormant.account.id,
    p_evaluation_type: 'synthetic_scenario',
  })
  assert.equal(dormantHealth[0].lifecycle_state, 'dormant')

  const paymentRisk = createdAccounts.get('payment_risk_account')
  const paymentHealth = await rpc('evaluate_account_health', {
    p_account_id: paymentRisk.account.id,
    p_evaluation_type: 'synthetic_scenario',
  })
  assert.equal(paymentHealth[0].health_state, 'critical')

  const expansionReady = createdAccounts.get('expansion_ready')
  const expansionHealth = await rpc('evaluate_account_health', {
    p_account_id: expansionReady.account.id,
    p_evaluation_type: 'synthetic_scenario',
  })
  assert.equal(expansionHealth[0].expansion_state, 'expansion_candidate')

  const upgrade = createdAccounts.get('upgrade_budget_overrun')
  const upgradeHealth = await rpc('evaluate_account_health', {
    p_account_id: upgrade.account.id,
    p_evaluation_type: 'synthetic_scenario',
  })
  assert.equal(upgradeHealth[0].expansion_state, 'sales_followup')

  const productSummary = await fetchSingle('gtm_product_summary?select=*')
  const healthSummary = await fetchSingle('gtm_customer_health_summary?select=*')
  const qualificationSummary = await fetchSingle('gtm_qualification_summary?select=*')
  const expansionReadyCount =
    numeric(healthSummary.expansion_candidate_accounts)
    + numeric(healthSummary.upgrade_ready_accounts)
    + numeric(healthSummary.sales_followup_accounts)

  assert.equal(numeric(productSummary.open_alert_count) >= 1, true)
  assert.equal(numeric(productSummary.activated_accounts) >= 3, true)
  assert.equal(numeric(healthSummary.at_risk_accounts) >= 1, true)
  assert.equal(expansionReadyCount >= 2, true)
  assert.equal(numeric(qualificationSummary.evaluated_leads) >= leadScenarios.length, true)

  const lifecycleRows = await fetchRows(
    `gtm_lifecycle_funnel?acquisition_campaign=eq.${PHASE9_CAMPAIGN}&select=stage_name,stage_count&order=stage_order.asc`,
  )
  const lifecycle = lifecycleRows.reduce((acc, row) => {
    acc[row.stage_name] = (acc[row.stage_name] ?? 0) + numeric(row.stage_count)
    return acc
  }, {})
  assert.equal(lifecycle.acquired >= leadScenarios.length, true)
  assert.equal(lifecycle.mql >= 8, true)
  assert.equal(lifecycle.sql >= 4, true)
  assert.equal(lifecycle.routed >= 3, true)
  assert.equal(lifecycle.signup >= accountScenarios.length, true)
  assert.equal(lifecycle.account >= accountScenarios.length, true)
  assert.equal(lifecycle.activated >= 3, true)
  assert.equal(lifecycle.paid >= 1, true)
  assert.equal(lifecycle.healthy >= 1, true)

  const cohortMetrics = await fetchRows(`gtm_acquisition_conversion_metrics?acquisition_campaign=eq.${PHASE9_CAMPAIGN}&select=lead_count,account_count`)
  const totalLeadCount = cohortMetrics.reduce((sum, row) => sum + numeric(row.lead_count), 0)
  const totalAccountCount = cohortMetrics.reduce((sum, row) => sum + numeric(row.account_count), 0)
  assert.equal(totalLeadCount >= leadScenarios.length, true)
  assert.equal(totalAccountCount >= accountScenarios.length, true)

  const currentSalesQueue = await fetchRows(
    `current_sales_queue?lead_id=in.(${canonicalLead.id},${outboundLead.id},${referralLead.id})&select=lead_id,current_owner_type,routing_status,rep_code`,
  )
  assert.equal(currentSalesQueue.length, 3)
  assert.equal(currentSalesQueue.some((row) => row.lead_id === canonicalLead.id && row.current_owner_type === 'ae'), true)
  assert.equal(currentSalesQueue.some((row) => row.lead_id === outboundLead.id && row.current_owner_type === 'sdr'), true)
  assert.equal(currentSalesQueue.some((row) => row.lead_id === referralLead.id && row.routing_status === 'manually_overridden'), true)

  const paymentRiskRows = await fetchRows(`payment_risk_accounts?account_id=eq.${paymentRisk.account.id}&select=account_id`)
  assert.equal(paymentRiskRows.length, 1)

  const dormantRows = await fetchRows(`dormant_accounts?account_id=eq.${dormant.account.id}&select=account_id`)
  assert.equal(dormantRows.length, 1)

  const expansionRows = await fetchRows(
    `expansion_ready_accounts?account_id=in.(${canonical.account.id},${expansionReady.account.id},${upgrade.account.id})&select=account_id,expansion_state`,
  )
  assert.equal(expansionRows.length >= 3, true)
})
