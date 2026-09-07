import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDemoUsageFixtures,
  deriveAlertCandidates,
  deriveRecommendationCandidates,
  normalizeProvider,
  pickDemoProviders,
} from '../lib/server/product-intelligence-core.ts'

test('provider normalization and demo provider selection reuse onboarding provider context', () => {
  assert.equal(normalizeProvider('OpenAI'), 'openai')
  assert.equal(normalizeProvider('AWS Bedrock'), 'aws')
  assert.equal(normalizeProvider('DeepSeek through LiteLLM'), 'deepseek')
  assert.deepEqual(pickDemoProviders(['OpenAI', 'Anthropic', 'AWS']), ['openai', 'anthropic', 'aws'])
  assert.deepEqual(pickDemoProviders([]), ['openai', 'anthropic', 'aws'])
})

test('demo usage fixtures are deterministic for the current month window', () => {
  const fixtures = buildDemoUsageFixtures({
    accountId: 'account-1',
    providers: ['openai', 'anthropic'],
    now: new Date('2026-08-27T12:00:00.000Z'),
  })

  assert.equal(fixtures.length, 4)
  assert.equal(fixtures[0].source_record_id.startsWith('openai_2026-08'), true)
  assert.equal(fixtures.every((fixture) => fixture.period_start.startsWith('2026-08-01')), true)
})

test('demo usage fixtures support DeepSeek without changing existing providers', () => {
  const fixtures = buildDemoUsageFixtures({
    accountId: 'account-1',
    providers: ['deepseek'],
    now: new Date('2026-08-27T12:00:00.000Z'),
  })

  assert.equal(fixtures.length, 1)
  assert.equal(fixtures[0].provider, 'deepseek')
  assert.equal(fixtures[0].service_name, 'litellm-chat-completions')
})

test('alert derivation identifies budget threshold, projected overrun, and spend spikes', () => {
  const alerts = deriveAlertCandidates({
    budgetStatus: {
      account_id: 'account-1',
      budget_id: 'budget-1',
      budget_amount: '1000.00',
      currency: 'USD',
      threshold_percentage: 80,
      alerting_enabled: true,
      budget_status: 'active',
      current_month_spend: '920.00',
      projected_month_end_spend: '1325.00',
      budget_used_percentage: '92.00',
      projected_budget_used_percentage: '132.50',
      projected_budget_variance: '325.00',
      projected_overrun: true,
    },
    dailySpend: [
      { account_id: 'account-1', spend_date: '2026-08-20', spend: '40.00' },
      { account_id: 'account-1', spend_date: '2026-08-21', spend: '42.00' },
      { account_id: 'account-1', spend_date: '2026-08-22', spend: '39.00' },
      { account_id: 'account-1', spend_date: '2026-08-23', spend: '44.00' },
      { account_id: 'account-1', spend_date: '2026-08-24', spend: '88.00' },
      { account_id: 'account-1', spend_date: '2026-08-25', spend: '96.00' },
      { account_id: 'account-1', spend_date: '2026-08-26', spend: '92.00' },
      { account_id: 'account-1', spend_date: '2026-08-27', spend: '98.00' },
    ],
    now: new Date('2026-08-27T12:00:00.000Z'),
  })

  assert.equal(alerts.some((alert) => alert.alert_type === 'budget_threshold_reached'), true)
  assert.equal(alerts.some((alert) => alert.alert_type === 'projected_budget_overrun'), true)
  assert.equal(alerts.some((alert) => alert.alert_type === 'spend_spike'), true)
})

test('recommendation derivation stays deterministic and explainable', () => {
  const recommendations = deriveRecommendationCandidates({
    spendSummary: {
      current_month_spend: '1000.00',
      projected_month_end_spend: '1400.00',
    },
    budgetStatus: {
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
    },
    providerSpend: [
      { account_id: 'account-1', provider: 'openai', spend: '620.00', usage_quantity: '1', usage_record_count: 2, last_usage_at: null },
      { account_id: 'account-1', provider: 'anthropic', spend: '380.00', usage_quantity: '1', usage_record_count: 2, last_usage_at: null },
    ],
    serviceSpend: [
      { account_id: 'account-1', provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', spend: '430.00', usage_quantity: '1', usage_record_count: 2, average_unit_price: '0.000005', last_usage_at: null },
    ],
    alertCandidates: [{ provider: null, alert_type: 'spend_spike', severity: 'high', threshold_value: 10, observed_value: 20, observed_period: '2026-08-27', metadata: {} }],
  })

  assert.equal(recommendations.some((row) => row.recommendation_type === 'budget_missing'), true)
  assert.equal(recommendations.some((row) => row.recommendation_type === 'provider_cost_concentration'), true)
  assert.equal(recommendations.some((row) => row.recommendation_type === 'service_cost_concentration'), true)
  assert.equal(recommendations.some((row) => row.recommendation_type === 'high_unit_cost'), true)
  assert.equal(recommendations.some((row) => row.recommendation_type === 'spend_spike'), true)
})
