import type { DashboardPayload } from '@/lib/dashboard-types'
import {
  deriveAlertCandidates,
  deriveRecommendationCandidates,
  roundCurrency,
  type ProductProvider,
} from '@/lib/server/product-intelligence-core'

const DEMO_AS_OF = new Date('2026-08-29T12:00:00.000Z')
const PERIOD_MONTH = '2026-08'
const ACCOUNT_ID = 'demo-account-costpilot'
const PROFILE_ID = 'demo-profile-costpilot'

const dailySpend = [
  198, 205, 214, 221, 236, 242, 251, 259, 266, 274, 281, 289, 298, 306,
  314, 321, 337, 351, 362, 376, 384, 391, 418, 447, 472, 496, 521, 548, 579,
]

const providerSpendRows = [
  { provider: 'openai', spend: 4120, usage_record_count: 3 },
  { provider: 'anthropic', spend: 2410, usage_record_count: 2 },
  { provider: 'aws', spend: 1295, usage_record_count: 2 },
] satisfies DashboardPayload['provider_spend']

const serviceSpendRows = [
  { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', spend: 2380 },
  { provider: 'openai', service_name: 'responses', model_name: 'gpt-4.1-mini', spend: 1740 },
  { provider: 'anthropic', service_name: 'messages', model_name: 'claude-3-5-sonnet', spend: 1570 },
  { provider: 'anthropic', service_name: 'messages', model_name: 'claude-3-5-haiku', spend: 840 },
  { provider: 'aws', service_name: 'bedrock-runtime', model_name: 'claude-3-haiku', spend: 910 },
  { provider: 'aws', service_name: 'lambda', model_name: null, spend: 385 },
] satisfies DashboardPayload['service_spend']

function toTitle(value: string | null | undefined) {
  if (!value) return 'Not available'
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

export function getDemoDashboardPayload(): DashboardPayload {
  const currentMonthSpend = roundCurrency(providerSpendRows.reduce((sum, row) => sum + row.spend, 0))
  const budgetAmount = 9000
  const projectedMonthEndSpend = 10140
  const budgetUsedPercentage = roundCurrency((currentMonthSpend / budgetAmount) * 100)

  const budgetStatus = {
    account_id: ACCOUNT_ID,
    budget_id: 'demo-budget-1',
    budget_amount: String(budgetAmount),
    currency: 'USD',
    threshold_percentage: 80,
    alerting_enabled: true,
    budget_status: 'active',
    current_month_spend: String(currentMonthSpend),
    projected_month_end_spend: String(projectedMonthEndSpend),
    budget_used_percentage: String(budgetUsedPercentage),
    projected_budget_used_percentage: String(roundCurrency((projectedMonthEndSpend / budgetAmount) * 100)),
    projected_budget_variance: String(roundCurrency(projectedMonthEndSpend - budgetAmount)),
    projected_overrun: true,
  }

  const derivedAlerts = deriveAlertCandidates({
    budgetStatus,
    dailySpend: dailySpend.map((spend, index) => ({
      account_id: ACCOUNT_ID,
      spend_date: `2026-08-${String(index + 1).padStart(2, '0')}`,
      spend: String(spend),
    })),
    now: DEMO_AS_OF,
  })

  const derivedRecommendations = deriveRecommendationCandidates({
    spendSummary: {
      current_month_spend: String(currentMonthSpend),
      projected_month_end_spend: String(projectedMonthEndSpend),
    },
    budgetStatus,
    providerSpend: providerSpendRows.map((row) => ({
      account_id: ACCOUNT_ID,
      provider: row.provider as ProductProvider,
      spend: String(row.spend),
      usage_quantity: '1',
      usage_record_count: row.usage_record_count,
      last_usage_at: DEMO_AS_OF.toISOString(),
    })),
    serviceSpend: serviceSpendRows.map((row) => ({
      account_id: ACCOUNT_ID,
      provider: row.provider as ProductProvider,
      service_name: row.service_name,
      model_name: row.model_name,
      spend: String(row.spend),
      usage_quantity: '1',
      usage_record_count: 1,
      average_unit_price: '0.000005',
      last_usage_at: DEMO_AS_OF.toISOString(),
    })),
    alertCandidates: derivedAlerts,
  })

  return {
    profile: {
      id: PROFILE_ID,
      email: null,
      display_name: 'Demo Workspace',
    },
    account: {
      id: ACCOUNT_ID,
      name: 'CostPilot Demo Workspace',
      onboarding_status: 'completed',
    },
    overview: {
      current_month_spend: currentMonthSpend,
      projected_month_end_spend: projectedMonthEndSpend,
      average_daily_spend: roundCurrency(currentMonthSpend / 29),
      budget_amount: String(budgetAmount),
      budget_used_percentage: budgetUsedPercentage,
      projected_budget_variance: projectedMonthEndSpend - budgetAmount,
      threshold_percentage: 80,
      activation_score: 92,
      activated: true,
      current_plan_id: 'growth',
      plan_status: 'active',
    },
    activation: {
      provider_connected: true,
      usage_synced: true,
      insight_generated: true,
      budget_created: true,
      alert_configured: true,
      activation_score: 92,
      activated: true,
      activated_at: '2026-08-18T10:00:00.000Z',
      time_to_value_hours: '1.6',
    },
    provider_spend: providerSpendRows,
    service_spend: serviceSpendRows,
    daily_spend: dailySpend.map((spend, index) => ({
      spend_date: `2026-08-${String(index + 1).padStart(2, '0')}`,
      spend,
    })),
    alerts: derivedAlerts.map((alert, index) => ({
      id: `demo-alert-${index + 1}`,
      alert_type: alert.alert_type,
      severity: alert.severity,
      observed_value: alert.observed_value,
      threshold_value: alert.threshold_value,
    })),
    recommendations: [
      ...derivedRecommendations.slice(0, 2).map((recommendation, index) => ({
        id: `demo-recommendation-${index + 1}`,
        title: recommendation.title,
        summary: recommendation.summary,
        priority: recommendation.priority,
        observed_value: recommendation.observed_value,
      })),
      {
        id: 'demo-recommendation-3',
        title: 'Review expansion-ready usage',
        summary: 'This synthetic workspace shows rising spend alongside healthy activation, which is a strong expansion pattern.',
        priority: 'medium',
        observed_value: 78,
      },
    ],
    connections: [
      { id: 'demo-conn-openai', provider: 'openai', connection_status: 'connected', last_synced_at: DEMO_AS_OF.toISOString() },
      { id: 'demo-conn-anthropic', provider: 'anthropic', connection_status: 'connected', last_synced_at: DEMO_AS_OF.toISOString() },
      { id: 'demo-conn-aws', provider: 'aws', connection_status: 'connected', last_synced_at: DEMO_AS_OF.toISOString() },
    ],
    plan: {
      current_plan_id: 'growth',
      plan_status: 'active',
    },
    health: {
      health_score: 88,
      health_state: 'healthy',
      churn_risk: 'low',
      expansion_score: 76,
      expansion_state: 'upgrade_ready',
      recommended_action: `Synthetic signal set for ${PERIOD_MONTH}: ${toTitle('prompt_upgrade')}`,
    },
  }
}
