import test from 'node:test'
import assert from 'node:assert/strict'

import { createDefaultProductIntelligenceService } from '../lib/server/product-intelligence-service.ts'

function createServiceHarness() {
  const calls = {
    plans: 0,
    connections: [],
    usage: [],
    events: [],
    alerts: [],
    resolvedAlerts: [],
    recommendations: [],
    dismissedRecommendations: [],
    budgets: [],
    providerLimits: [],
    providerStatusUpdates: [],
    evaluatedLeadIds: [],
    health: [],
    usageBySource: new Map(),
  }

  const activationState = {
    account_id: 'account-1',
    signup_at: '2026-08-20T10:00:00.000Z',
    onboarding_completed_at: '2026-08-20T10:10:00.000Z',
    provider_connected_at: null,
    usage_synced_at: null,
    insight_generated_at: null,
    budget_created_at: null,
    alert_configured_at: null,
    first_cost_data_received_at: null,
    provider_connected: false,
    usage_synced: false,
    insight_generated: false,
    budget_created: false,
    alert_configured: false,
    activation_score: 0,
    activated: false,
    latest_activation_signal_at: null,
    activated_at: null,
    time_to_value_hours: null,
  }

  const service = createDefaultProductIntelligenceService({
    parseToken: (header) => (header?.startsWith('Bearer ') ? header.slice(7) : null),
    verifier: {
      async verifyIdToken() {
        return { uid: 'uid-1', email: 'user@example.com' }
      },
    },
    resolveProfileByUid: async () => ({
      id: 'profile-1',
      firebase_uid: 'uid-1',
      email: 'user@example.com',
      display_name: 'Test User',
      photo_url: null,
      auth_provider: 'password',
      last_login_at: null,
      first_touch_source: null,
      first_touch_medium: null,
      first_touch_campaign: null,
      first_touch_referrer: null,
      created_at: '2026-08-20T10:00:00.000Z',
      updated_at: '2026-08-20T10:00:00.000Z',
    }),
    resolveAccountByProfileId: async () => ({
      id: 'account-1',
      name: 'Acme Workspace',
      slug: 'acme',
      primary_domain: 'acme.com',
      onboarding_status: 'completed',
      created_at: '2026-08-20T10:00:00.000Z',
      updated_at: '2026-08-20T10:00:00.000Z',
    }),
    resolveAccountBySlug: async () => ({
      id: 'account-1',
      name: 'Acme Workspace',
      slug: 'my-workspace-8a192182',
      primary_domain: 'acme.com',
      onboarding_status: 'completed',
      created_at: '2026-08-20T10:00:00.000Z',
      updated_at: '2026-08-20T10:00:00.000Z',
    }),
    resolveAccountById: async (accountId) => accountId === 'account-1' ? ({
      id: 'account-1',
      name: 'Acme Workspace',
      slug: 'my-workspace-8a192182',
      primary_domain: 'acme.com',
      onboarding_status: 'completed',
      created_at: '2026-08-20T10:00:00.000Z',
      updated_at: '2026-08-20T10:00:00.000Z',
    }) : null,
    getAccountPlan: async () => null,
    upsertAccountPlan: async (input) => {
      calls.plans += 1
      return {
        id: 'plan-1',
        account_id: input.account_id,
        profile_id: input.profile_id ?? null,
        current_plan_id: input.current_plan_id,
        plan_status: input.plan_status,
        billing_provider: 'payu',
        billing_interval: input.billing_interval,
        latest_transaction_id: input.latest_transaction_id ?? null,
        activated_at: input.activated_at ?? null,
        expires_at: input.expires_at ?? null,
        metadata: input.metadata ?? {},
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-27T00:00:00.000Z',
      }
    },
    listProviderConnections: async () => calls.connections,
    upsertProviderConnection: async (input) => {
      const connection = {
        id: `conn-${input.provider}`,
        account_id: input.account_id,
        provider: input.provider,
        connection_mode: input.connection_mode,
        connection_status: input.connection_status,
        external_reference: null,
        metadata: input.metadata ?? {},
        connected_at: input.connected_at ?? '2026-08-27T00:00:00.000Z',
        last_synced_at: input.last_synced_at ?? null,
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-27T00:00:00.000Z',
      }
      calls.connections.push(connection)
      return connection
    },
    getProviderConnectionForAccount: async (id, accountId) => calls.connections.find((connection) => connection.id === id && connection.account_id === accountId) ?? null,
    updateProviderConnectionForAccount: async (input) => {
      const connection = calls.connections.find((row) => row.id === input.id && row.account_id === input.account_id)
      if (!connection) throw new Error('provider_connection_not_found')
      connection.connection_status = input.connection_status
      connection.metadata = input.metadata ?? connection.metadata
      connection.last_synced_at = input.last_synced_at ?? connection.last_synced_at
      calls.providerStatusUpdates.push(input)
      return connection
    },
    upsertUsageRecords: async (rows) => {
      calls.usage.push(...rows)
      return rows.map((row, index) => ({
        id: `usage-${index}`,
        ...row,
        usage_quantity: String(row.usage_quantity),
        unit_price: String(row.unit_price),
        calculated_cost: String(row.calculated_cost),
        created_at: '2026-08-27T00:00:00.000Z',
      })).map((row) => {
        calls.usageBySource.set(`${row.provider_connection_id}|${row.source_type}|${row.source_record_id}`, row)
        return row
      })
    },
    getUsageRecordBySource: async (input) => calls.usageBySource.get(`${input.provider_connection_id}|${input.source_type}|${input.source_record_id}`) ?? null,
    listApiSyncUsageRecords: async () => [...calls.usageBySource.values()],
    listUsageRecordsSince: async (input) => [...calls.usageBySource.values()].filter((row) =>
      row.account_id === input.accountId &&
      (!input.provider || row.provider === input.provider) &&
      row.usage_at >= input.since &&
      row.usage_at < input.until
    ),
    listProviderUsageLimits: async () => calls.providerLimits,
    upsertProviderUsageLimit: async (input) => {
      const existing = calls.providerLimits.find((row) =>
        row.account_id === input.account_id &&
        row.provider_connection_id === input.provider_connection_id &&
        row.limit_type === input.limit_type &&
        row.limit_period === input.limit_period
      )
      const limit = {
        id: existing?.id ?? `limit-${calls.providerLimits.length + 1}`,
        account_id: input.account_id,
        provider_connection_id: input.provider_connection_id,
        limit_type: input.limit_type,
        limit_amount: String(input.limit_amount),
        limit_period: input.limit_period,
        threshold_percentage: input.threshold_percentage ?? 70,
        enabled: input.enabled ?? true,
        metadata: input.metadata ?? {},
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-27T00:00:00.000Z',
      }
      if (existing) Object.assign(existing, limit)
      else calls.providerLimits.push(limit)
      return limit
    },
    getLatestOnboardingResponseForAccount: async () => ({
      id: 'onboarding-1',
      profile_id: 'profile-1',
      account_id: 'account-1',
      company_size: '11-50',
      providers: ['OpenAI', 'Anthropic'],
      estimated_monthly_spend: '$1K-$5K',
      raw_answers: {},
      completed_at: '2026-08-20T10:10:00.000Z',
      created_at: '2026-08-20T10:10:00.000Z',
      updated_at: '2026-08-20T10:10:00.000Z',
    }),
    getAccountDashboardOverview: async () => ({
      account_id: 'account-1',
      account_name: 'Acme Workspace',
      current_month_spend: '1000.00',
      projected_month_end_spend: '1400.00',
      average_daily_spend: '45.00',
      last_7_day_spend: '500.00',
      prior_7_day_spend: '250.00',
      usage_record_count: 4,
      last_usage_at: '2026-08-27T00:00:00.000Z',
      budget_id: null,
      budget_amount: null,
      budget_currency: 'USD',
      threshold_percentage: null,
      budget_used_percentage: null,
      projected_budget_used_percentage: null,
      projected_budget_variance: null,
      projected_overrun: false,
      provider_connected: true,
      usage_synced: true,
      insight_generated: true,
      budget_created: false,
      alert_configured: false,
      activation_score: 60,
      activated: false,
      activated_at: null,
      time_to_value_hours: '2.00',
      current_plan_id: 'starter',
      plan_status: 'active',
      billing_provider: 'payu',
      billing_interval: 'monthly',
    }),
    listProviderSpendCurrentMonth: async () => [
      { account_id: 'account-1', provider: 'openai', spend: '620.00', usage_quantity: '1', usage_record_count: 2, last_usage_at: null },
    ],
    listServiceSpendCurrentMonth: async () => [
      { account_id: 'account-1', provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', spend: '430.00', usage_quantity: '1', usage_record_count: 2, average_unit_price: '0.000005', last_usage_at: null },
    ],
    listDailySpendCurrentMonth: async () => [
      { account_id: 'account-1', spend_date: '2026-08-22', spend: '40.00' },
      { account_id: 'account-1', spend_date: '2026-08-23', spend: '41.00' },
      { account_id: 'account-1', spend_date: '2026-08-24', spend: '42.00' },
      { account_id: 'account-1', spend_date: '2026-08-25', spend: '90.00' },
      { account_id: 'account-1', spend_date: '2026-08-26', spend: '92.00' },
      { account_id: 'account-1', spend_date: '2026-08-27', spend: '95.00' },
    ],
    getCurrentMonthBudgetStatus: async () => ({
      account_id: 'account-1',
      budget_id: null,
      budget_amount: null,
      currency: null,
      threshold_percentage: null,
      alerting_enabled: null,
      budget_status: null,
      current_month_spend: '1000.00',
      projected_month_end_spend: '1400.00',
      budget_used_percentage: null,
      projected_budget_used_percentage: null,
      projected_budget_variance: null,
      projected_overrun: false,
    }),
    getAccountActivationState: async () => activationState,
    getCurrentCustomerHealth: async () => ({
      account_id: 'account-1',
      account_name: 'Acme Workspace',
      onboarding_status: 'completed',
      company_size: '11-50',
      estimated_monthly_spend: '$1K-$5K',
      current_plan_id: 'starter',
      plan_status: 'active',
      current_month_spend: '1000.00',
      projected_month_end_spend: '1400.00',
      budget_amount: null,
      projected_overrun: false,
      activation_score: 60,
      activated: false,
      activated_at: null,
      time_to_value_hours: '2.00',
      connected_provider_count: 2,
      active_service_count: 1,
      last_usage_at: '2026-08-27T00:00:00.000Z',
      last_synced_at: '2026-08-27T00:00:00.000Z',
      last_login_at: '2026-08-27T00:00:00.000Z',
      last_product_event_at: '2026-08-27T00:00:00.000Z',
      days_since_last_usage: 0,
      days_since_last_sync: 0,
      days_since_last_login: 0,
      days_since_last_product_event: 0,
      open_alert_count: 0,
      open_high_alert_count: 0,
      open_critical_alert_count: 0,
      open_recommendation_count: 1,
      applied_recommendation_count: 0,
      sales_ready_lead_count: 0,
      qualified_lead_count: 0,
      assigned_sales_lead_count: 0,
      ae_owned_lead_count: 0,
      sdr_owned_lead_count: 0,
      has_manual_sales_override: false,
      latest_sales_owner_type: null,
      latest_sales_routing_status: null,
      top_lead_id: null,
      evaluation_id: 'health-1',
      evaluation_type: 'engagement_refresh',
      rule_version: 'phase7_v1',
      health_score: 72,
      health_state: 'watch',
      lifecycle_state: 'activated',
      churn_risk: 'medium',
      expansion_score: 36,
      expansion_state: 'watch',
      recommended_action: 'monitor',
      recommended_lead_id: null,
      recommended_owner_type: null,
      authoritative_churned: false,
      needs_intervention: false,
      reasons: {},
      evaluated_at: '2026-08-27T00:00:00.000Z',
    }),
    listOpenProductAlerts: async () => calls.alerts,
    insertProductAlert: async (input) => {
      const alert = { id: `alert-${calls.alerts.length + 1}`, status: 'open', triggered_at: '2026-08-27T00:00:00.000Z', resolved_at: null, ...input }
      calls.alerts.push(alert)
      return alert
    },
    resolveProductAlert: async (id) => {
      calls.resolvedAlerts.push(id)
      return { id }
    },
    listOpenCostRecommendations: async () => calls.recommendations,
    insertCostRecommendation: async (input) => {
      const recommendation = { id: `rec-${calls.recommendations.length + 1}`, status: 'open', generated_at: '2026-08-27T00:00:00.000Z', updated_at: '2026-08-27T00:00:00.000Z', ...input }
      calls.recommendations.push(recommendation)
      return recommendation
    },
    dismissCostRecommendation: async (id) => {
      calls.dismissedRecommendations.push(id)
      return { id }
    },
    upsertBudget: async (input) => {
      calls.budgets.push(input)
      return {
        id: 'budget-1',
        account_id: input.account_id,
        provider_connection_id: input.provider_connection_id ?? null,
        provider: input.provider ?? null,
        budget_scope: input.budget_scope,
        period_month: input.period_month,
        amount: String(input.amount),
        currency: input.currency,
        threshold_percentage: input.threshold_percentage ?? null,
        alerting_enabled: input.alerting_enabled ?? true,
        status: input.status ?? 'active',
        created_by_profile_id: input.created_by_profile_id ?? null,
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-27T00:00:00.000Z',
      }
    },
    insertEvent: async (input) => {
      calls.events.push(input)
      return { id: calls.events.length, ...input, created_at: '2026-08-27T00:00:00.000Z' }
    },
    listLeadIdsByAccount: async () => [101, 202],
    evaluateLeadQualification: async (leadId) => {
      calls.evaluatedLeadIds.push(leadId)
      return [{ lead_id: leadId }]
    },
    evaluateAccountHealth: async (accountId, evaluationType) => {
      calls.health.push({ accountId, evaluationType })
      return [{ account_id: accountId }]
    },
    validateProviderCredential: async (provider, apiKey) => ({
      ok: apiKey !== 'invalid-key',
      safeError: apiKey === 'invalid-key' ? `${provider}_authentication_failed` : undefined,
      reference: `${provider}_credential_reference`,
      model_hint: provider === 'gemini' ? 'gemini-3.5-flash-lite' : 'deepseek-chat',
    }),
    now: () => new Date('2026-08-27T12:00:00.000Z'),
  })

  return { service, calls, activationState }
}

test('demo sync creates demo provider connections, usage records, events, and qualification refreshes', async () => {
  const { service, calls } = createServiceHarness()
  const result = await service.runDemoSync('Bearer token')

  assert.equal(result.connection_count >= 2, true)
  assert.equal(result.usage_record_count >= 4, true)
  assert.equal(calls.events.some((event) => event.event_name === 'provider_connected'), true)
  assert.equal(calls.events.some((event) => event.event_name === 'usage_synced'), true)
  assert.equal(calls.events.some((event) => event.event_name === 'insight_generated'), true)
  assert.deepEqual(calls.evaluatedLeadIds, [101, 202])
  assert.equal(calls.health.some((entry) => entry.accountId === 'account-1' && entry.evaluationType === 'product_signal_refresh'), true)
})

test('budget upsert emits budget and alert configuration events and refreshes downstream signals', async () => {
  const { service, calls } = createServiceHarness()
  const result = await service.upsertAccountBudget('Bearer token', {
    amount: 12000,
    threshold_percentage: 80,
    provider: null,
  })

  assert.equal(result.budget.amount, '12000.00')
  assert.equal(calls.budgets.length, 1)
  assert.equal(calls.events.some((event) => event.event_name === 'budget_created'), true)
  assert.equal(calls.events.some((event) => event.event_name === 'alert_configured'), true)
  assert.equal(calls.health.some((entry) => entry.accountId === 'account-1' && entry.evaluationType === 'product_signal_refresh'), true)
})

test('dashboard overview reuses persisted product views and ensures a default plan exists', async () => {
  const { service, calls } = createServiceHarness()
  const result = await service.getDashboardOverview('Bearer token')

  assert.equal(result.account.name, 'Acme Workspace')
  assert.equal(result.provider_spend.length, 1)
  assert.equal(calls.plans >= 1, true)
  assert.equal(result.health?.health_state, 'watch')
  assert.equal(calls.health.some((entry) => entry.accountId === 'account-1' && entry.evaluationType === 'engagement_refresh'), true)
})

test('provider management stores DeepSeek metadata and soft-disconnects without deleting usage', async () => {
  const { service, calls } = createServiceHarness()
  const added = await service.addProviderConnection('Bearer token', 'deepseek', 'valid-key')

  assert.equal(added.connection.provider, 'deepseek')
  assert.equal(added.connection.connection_status, 'connected')
  assert.equal(added.connection.metadata.secret_in_browser, false)
  assert.equal(added.connection.metadata.credential_reference, 'deepseek_credential_reference')

  await service.updateProviderConnectionStatus('Bearer token', {
    id: added.connection.id,
    action: 'remove',
  })

  assert.equal(calls.connections.length, 1)
  assert.equal(calls.connections[0].connection_status, 'disconnected')
  assert.equal(Boolean(calls.connections[0].metadata.removed_at), true)
  assert.equal(calls.providerStatusUpdates.length, 1)
})

test('provider management supports Gemini and rejects invalid keys safely', async () => {
  const { service, calls } = createServiceHarness()
  const added = await service.addProviderConnection('Bearer token', 'gemini', 'valid-key')

  assert.equal(added.connection.provider, 'gemini')
  assert.equal(added.connection.connection_status, 'connected')
  assert.equal(added.connection.metadata.model_hint, 'gemini-3.5-flash-lite')

  await assert.rejects(
    () => service.addProviderConnection('Bearer token', 'gemini', 'invalid-key'),
    /gemini_authentication_failed/,
  )
  assert.equal(calls.events.some((event) => event.event_name === 'provider_connection_failed'), true)
})

test('provider usage limits calculate monthly token quota from real usage records', async () => {
  const { service } = createServiceHarness()
  const added = await service.addProviderConnection('Bearer token', 'deepseek', 'valid-key')

  await service.ingestAiUsage({
    usage_event_id: 'cp_usage_quota_test',
    account_id: 'account-1',
    workspace_id: 'account-1',
    account_slug: 'my-workspace-8a192182',
    provider: 'deepseek',
    service_name: 'litellm-chat-completions',
    model_name: 'deepseek-chat',
    input_tokens: 25,
    output_tokens: 12,
    total_tokens: 37,
    estimated_cost: 0.00002684,
    latency_ms: 1575,
    usage_at: '2026-08-27T12:00:00.000Z',
    workflow: 'litellm-deepseek-usage-prototype',
    workflow_id: 'prototype-workflow',
    n8n_execution_id: '40',
    node: 'HTTP Request: Call LiteLLM',
    environment: 'local',
    business_action: 'prototype_usage_capture',
    litellm_request_id: 'chatcmpl-quota-test',
    tags: ['costpilot', 'prototype', 'deepseek'],
  })

  await service.upsertProviderUsageLimit('Bearer token', {
    provider_connection_id: added.connection.id,
    limit_type: 'tokens',
    limit_amount: 1000000,
    limit_period: 'monthly',
    threshold_percentage: 70,
    enabled: true,
  })

  const overview = await service.getDashboardOverview('Bearer token')
  const limit = overview.provider_usage_limits.find((row) => row.provider_connection_id === added.connection.id)

  assert.equal(limit.used_amount, 37)
  assert.equal(limit.remaining_amount, 999963)
  assert.equal(limit.consumed_percentage, 0.004)
  assert.equal(limit.status, 'healthy')
})

test('AI usage ingestion creates one DeepSeek record and deduplicates retries', async () => {
  const { service, calls } = createServiceHarness()
  const payload = {
    usage_event_id: 'cp_usage_test_123',
    account_id: 'account-1',
    workspace_id: 'account-1',
    account_slug: 'my-workspace-8a192182',
    provider: 'deepseek',
    service_name: 'litellm-chat-completions',
    model_name: 'deepseek-chat',
    input_tokens: 25,
    output_tokens: 12,
    total_tokens: 37,
    estimated_cost: 0.00002684,
    latency_ms: 1575,
    usage_at: '2026-08-27T12:00:00.000Z',
    workflow: 'litellm-deepseek-usage-prototype',
    workflow_id: 'prototype-workflow',
    n8n_execution_id: '40',
    node: 'HTTP Request: Call LiteLLM',
    environment: 'local',
    business_action: 'prototype_usage_capture',
    litellm_request_id: 'chatcmpl-test',
    tags: ['costpilot', 'prototype', 'deepseek'],
  }

  const first = await service.ingestAiUsage(payload)
  const second = await service.ingestAiUsage(payload)

  assert.equal(first.status, 'created')
  assert.equal(second.status, 'deduplicated')
  assert.equal(calls.usage.length, 1)
  assert.equal(calls.usage[0].provider, 'deepseek')
  assert.equal(calls.usage[0].source_record_id, 'cp_usage_test_123')
  assert.equal(calls.events.some((event) => event.event_name === 'usage_synced'), true)
})

test('AI usage ingestion accepts Gemini free-tier telemetry without inventing cost', async () => {
  const { service, calls } = createServiceHarness()
  const result = await service.ingestAiUsage({
    usage_event_id: 'cp_usage_gemini_test_123',
    account_id: 'account-1',
    workspace_id: 'account-1',
    account_slug: 'my-workspace-8a192182',
    provider: 'gemini',
    service_name: 'generative-language',
    model_name: 'gemini-3.5-flash-lite',
    input_tokens: 41,
    output_tokens: 9,
    total_tokens: 50,
    estimated_cost: 0,
    latency_ms: 830,
    usage_at: '2026-08-27T12:00:00.000Z',
    workflow: 'support-agent',
    workflow_id: 'support-agent',
    n8n_execution_id: '41',
    node: 'Gemini Classifier',
    environment: 'local',
    business_action: 'classify_ticket',
    litellm_request_id: null,
    tags: ['costpilot', 'prototype', 'gemini'],
  })

  assert.equal(result.status, 'created')
  assert.equal(calls.usage[0].provider, 'gemini')
  assert.equal(calls.usage[0].calculated_cost, 0)
})

test('AI usage ingestion rejects mismatched dynamic account context', async () => {
  const { service } = createServiceHarness()

  await assert.rejects(
    () => service.ingestAiUsage({
      usage_event_id: 'cp_usage_context_mismatch',
      account_id: 'account-1',
      workspace_id: 'other-account',
      account_slug: 'my-workspace-8a192182',
      provider: 'gemini',
      service_name: 'generative-language',
      model_name: 'gemini-3.5-flash-lite',
      input_tokens: 41,
      output_tokens: 9,
      total_tokens: 50,
      estimated_cost: 0,
      latency_ms: 830,
      usage_at: '2026-08-27T12:00:00.000Z',
      workflow: 'support-agent',
      workflow_id: 'support-agent',
      n8n_execution_id: '41',
      node: 'Gemini Classifier',
      environment: 'local',
      business_action: 'classify_ticket',
      litellm_request_id: null,
      tags: ['costpilot', 'product-pql', 'gemini'],
    }),
    /account_context_mismatch/,
  )
})
