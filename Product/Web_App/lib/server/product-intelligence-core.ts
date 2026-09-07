import type {
  SupabaseActivationState,
  SupabaseBudgetStatusCurrentMonth,
  SupabaseDailySpendCurrentMonth,
  SupabaseProviderSpendCurrentMonth,
  SupabaseServiceSpendCurrentMonth,
} from './supabase-admin.ts'

export const PRODUCT_PROVIDER_VALUES = ['openai', 'anthropic', 'aws', 'google', 'azure', 'demo', 'deepseek', 'gemini'] as const
export type ProductProvider = (typeof PRODUCT_PROVIDER_VALUES)[number]

export type DemoUsageFixture = {
  provider: ProductProvider
  service_name: string
  model_name: string | null
  usage_quantity: number
  usage_unit: string
  unit_price: number
  calculated_cost: number
  usage_at: string
  period_start: string
  period_end: string
  source_record_id: string
  metadata: Record<string, unknown>
}

export type ProductAlertCandidate = {
  provider: ProductProvider | null
  alert_type: 'budget_threshold_reached' | 'projected_budget_overrun' | 'spend_spike'
  severity: 'low' | 'medium' | 'high' | 'critical'
  threshold_value: number | null
  observed_value: number | null
  observed_period: string
  metadata: Record<string, unknown>
}

export type ProductRecommendationCandidate = {
  provider: ProductProvider | null
  service_name: string | null
  model_name: string | null
  recommendation_type:
    | 'budget_missing'
    | 'projected_budget_overrun'
    | 'provider_cost_concentration'
    | 'service_cost_concentration'
    | 'spend_spike'
    | 'high_unit_cost'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  summary: string
  observed_value: number | null
  metadata: Record<string, unknown>
}

export type ActivationMilestoneSummary = {
  provider_connected: boolean
  usage_synced: boolean
  insight_generated: boolean
  budget_created: boolean
  alert_configured: boolean
  activation_score: number
  activated: boolean
}

export function normalizeProvider(value: string): ProductProvider {
  const input = value.trim().toLowerCase()
  if (input.includes('anthropic')) return 'anthropic'
  if (input.includes('aws') || input.includes('bedrock')) return 'aws'
  if (input.includes('gemini')) return 'gemini'
  if (input.includes('google')) return 'google'
  if (input.includes('azure')) return 'azure'
  if (input.includes('deepseek')) return 'deepseek'
  if (input.includes('openai')) return 'openai'
  return 'demo'
}

export function formatProviderLabel(provider: ProductProvider) {
  switch (provider) {
    case 'openai':
      return 'OpenAI'
    case 'anthropic':
      return 'Anthropic'
    case 'aws':
      return 'AWS'
    case 'google':
      return 'Google'
    case 'azure':
      return 'Azure'
    case 'deepseek':
      return 'DeepSeek'
    case 'gemini':
      return 'Gemini'
    default:
      return 'Demo'
  }
}

export function pickDemoProviders(onboardingProviders: string[] = []) {
  const normalized = onboardingProviders
    .map((value) => normalizeProvider(value))
    .filter((value, index, array) => array.indexOf(value) === index)

  if (normalized.length > 0) return normalized.slice(0, 3)
  return ['openai', 'anthropic', 'aws'] satisfies ProductProvider[]
}

function getMonthWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
  return { start, next }
}

function iso(date: Date) {
  return date.toISOString()
}

export function buildDemoUsageFixtures(input: {
  accountId: string
  providers: ProductProvider[]
  now: Date
}) {
  const { start, next } = getMonthWindow(input.now)
  const baseFixtures: Record<ProductProvider, Array<Omit<DemoUsageFixture, 'usage_at' | 'period_start' | 'period_end' | 'source_record_id'>>> = {
    openai: [
      { provider: 'openai', service_name: 'chat-completions', model_name: 'gpt-4o-mini', usage_quantity: 820000, usage_unit: 'tokens', unit_price: 0.000002, calculated_cost: 1640, metadata: { workload: 'support_ai' } },
      { provider: 'openai', service_name: 'responses', model_name: 'gpt-4.1-mini', usage_quantity: 630000, usage_unit: 'tokens', unit_price: 0.0000025, calculated_cost: 1575, metadata: { workload: 'sales_assistant' } },
    ],
    anthropic: [
      { provider: 'anthropic', service_name: 'messages', model_name: 'claude-3-5-sonnet', usage_quantity: 540000, usage_unit: 'tokens', unit_price: 0.000004, calculated_cost: 2160, metadata: { workload: 'analysis' } },
      { provider: 'anthropic', service_name: 'messages', model_name: 'claude-3-5-haiku', usage_quantity: 470000, usage_unit: 'tokens', unit_price: 0.0000017, calculated_cost: 799, metadata: { workload: 'classification' } },
    ],
    aws: [
      { provider: 'aws', service_name: 'bedrock-runtime', model_name: 'claude-3-haiku', usage_quantity: 420000, usage_unit: 'tokens', unit_price: 0.0000019, calculated_cost: 798, metadata: { workload: 'product_search' } },
      { provider: 'aws', service_name: 'lambda', model_name: null, usage_quantity: 1800000, usage_unit: 'requests', unit_price: 0.0000002, calculated_cost: 360, metadata: { workload: 'event_pipeline' } },
    ],
    google: [
      { provider: 'google', service_name: 'vertex-ai', model_name: 'gemini-1.5-pro', usage_quantity: 300000, usage_unit: 'tokens', unit_price: 0.000003, calculated_cost: 900, metadata: { workload: 'reporting' } },
      { provider: 'google', service_name: 'bigquery', model_name: null, usage_quantity: 95, usage_unit: 'gb_processed', unit_price: 0.45, calculated_cost: 42.75, metadata: { workload: 'analytics' } },
    ],
    azure: [
      { provider: 'azure', service_name: 'azure-openai', model_name: 'gpt-4o', usage_quantity: 250000, usage_unit: 'tokens', unit_price: 0.000005, calculated_cost: 1250, metadata: { workload: 'copilot' } },
      { provider: 'azure', service_name: 'functions', model_name: null, usage_quantity: 1200000, usage_unit: 'requests', unit_price: 0.00000025, calculated_cost: 300, metadata: { workload: 'automation' } },
    ],
    demo: [
      { provider: 'demo', service_name: 'demo-runtime', model_name: 'synthetic', usage_quantity: 1000, usage_unit: 'events', unit_price: 0.1, calculated_cost: 100, metadata: { workload: 'demo' } },
    ],
    deepseek: [
      { provider: 'deepseek', service_name: 'litellm-chat-completions', model_name: 'deepseek-chat', usage_quantity: 100000, usage_unit: 'tokens', unit_price: 0.000001, calculated_cost: 0.1, metadata: { workload: 'litellm_prototype' } },
    ],
    gemini: [
      { provider: 'gemini', service_name: 'generative-language', model_name: 'gemini-3.5-flash-lite', usage_quantity: 75000, usage_unit: 'tokens', unit_price: 0, calculated_cost: 0, metadata: { workload: 'free_tier_demo', billing_note: 'free_tier_usage' } },
    ],
  }

  return input.providers.flatMap((provider, providerIndex) => {
    const fixtures = baseFixtures[provider] ?? baseFixtures.demo
    return fixtures.map((fixture, fixtureIndex) => {
      const day = Math.min(4 + providerIndex * 3 + fixtureIndex * 5, 26)
      const usageAt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day, 12, 0, 0, 0))
      return {
        ...fixture,
        usage_at: iso(usageAt),
        period_start: iso(start),
        period_end: iso(next),
        source_record_id: `${provider}_${start.toISOString().slice(0, 7)}_${fixture.service_name}_${fixture.model_name ?? 'na'}_${fixtureIndex}`,
      }
    })
  })
}

export function calculateProjectedSpend(currentMonthSpend: number, elapsedDays: number, daysInMonth: number) {
  if (currentMonthSpend <= 0 || elapsedDays <= 0 || daysInMonth <= 0) return 0
  return roundCurrency((currentMonthSpend / elapsedDays) * daysInMonth)
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

export function deriveAlertCandidates(input: {
  budgetStatus: SupabaseBudgetStatusCurrentMonth | null
  dailySpend: SupabaseDailySpendCurrentMonth[]
  now: Date
}): ProductAlertCandidate[] {
  const observedPeriod = input.now.toISOString().slice(0, 10)
  const alerts: ProductAlertCandidate[] = []
  const budgetUsed = Number(input.budgetStatus?.budget_used_percentage ?? 0)
  const threshold = input.budgetStatus?.threshold_percentage ?? null
  const projectedOverrun = Boolean(input.budgetStatus?.projected_overrun)

  if (threshold != null && budgetUsed >= threshold) {
    alerts.push({
      provider: null,
      alert_type: 'budget_threshold_reached',
      severity: budgetUsed >= 100 ? 'critical' : budgetUsed >= 90 ? 'high' : 'medium',
      threshold_value: threshold,
      observed_value: roundCurrency(budgetUsed),
      observed_period: observedPeriod,
      metadata: {
        budget_used_percentage: roundCurrency(budgetUsed),
      },
    })
  }

  if (projectedOverrun) {
    const variance = Number(input.budgetStatus?.projected_budget_variance ?? 0)
    alerts.push({
      provider: null,
      alert_type: 'projected_budget_overrun',
      severity: variance >= 1000 ? 'critical' : variance >= 250 ? 'high' : 'medium',
      threshold_value: Number(input.budgetStatus?.budget_amount ?? 0) || null,
      observed_value: roundCurrency(Number(input.budgetStatus?.projected_month_end_spend ?? 0)),
      observed_period: observedPeriod,
      metadata: {
        projected_budget_variance: roundCurrency(variance),
      },
    })
  }

  if (input.dailySpend.length >= 8) {
    const sorted = [...input.dailySpend].sort((left, right) => left.spend_date.localeCompare(right.spend_date))
    const recent = sorted.slice(-3).reduce((sum, row) => sum + Number(row.spend), 0) / 3
    const prior = sorted.slice(-6, -3).reduce((sum, row) => sum + Number(row.spend), 0) / 3
    if (prior > 0 && recent >= prior * 1.35) {
      alerts.push({
        provider: null,
        alert_type: 'spend_spike',
        severity: recent >= prior * 1.75 ? 'critical' : 'high',
        threshold_value: roundCurrency(prior),
        observed_value: roundCurrency(recent),
        observed_period: observedPeriod,
        metadata: {
          recent_three_day_average: roundCurrency(recent),
          prior_three_day_average: roundCurrency(prior),
        },
      })
    }
  }

  return alerts
}

export function deriveRecommendationCandidates(input: {
  spendSummary: { current_month_spend: string | null; projected_month_end_spend: string | null }
  budgetStatus: SupabaseBudgetStatusCurrentMonth | null
  providerSpend: SupabaseProviderSpendCurrentMonth[]
  serviceSpend: SupabaseServiceSpendCurrentMonth[]
  alertCandidates: ProductAlertCandidate[]
}): ProductRecommendationCandidate[] {
  const recommendations: ProductRecommendationCandidate[] = []
  const currentSpend = Number(input.spendSummary.current_month_spend ?? 0)
  const projectedSpend = Number(input.spendSummary.projected_month_end_spend ?? 0)

  if (!input.budgetStatus?.budget_id) {
    recommendations.push({
      provider: null,
      service_name: null,
      model_name: null,
      recommendation_type: 'budget_missing',
      priority: currentSpend > 0 ? 'high' : 'medium',
      title: 'Set an account budget',
      summary: 'Create a monthly budget so CostPilot can detect threshold risk and projected overruns.',
      observed_value: currentSpend > 0 ? roundCurrency(currentSpend) : null,
      metadata: {},
    })
  }

  if (Boolean(input.budgetStatus?.projected_overrun)) {
    recommendations.push({
      provider: null,
      service_name: null,
      model_name: null,
      recommendation_type: 'projected_budget_overrun',
      priority: 'urgent',
      title: 'Projected spend exceeds your budget',
      summary: `Current run rate projects ${projectedSpend.toFixed(2)} for the month, above the configured budget.`,
      observed_value: roundCurrency(Number(input.budgetStatus?.projected_budget_variance ?? 0)),
      metadata: {},
    })
  }

  const topProvider = input.providerSpend[0]
  if (topProvider && currentSpend > 0) {
    const share = roundCurrency((Number(topProvider.spend) / currentSpend) * 100)
    if (share >= 55) {
      recommendations.push({
        provider: normalizeProvider(topProvider.provider),
        service_name: null,
        model_name: null,
        recommendation_type: 'provider_cost_concentration',
        priority: share >= 70 ? 'high' : 'medium',
        title: `${formatProviderLabel(normalizeProvider(topProvider.provider))} drives most of your spend`,
        summary: `${formatProviderLabel(normalizeProvider(topProvider.provider))} accounts for ${share}% of current-month spend. Review workload concentration and fallback options.`,
        observed_value: share,
        metadata: {},
      })
    }
  }

  const topService = input.serviceSpend[0]
  if (topService && currentSpend > 0) {
    const share = roundCurrency((Number(topService.spend) / currentSpend) * 100)
    if (share >= 35) {
      recommendations.push({
        provider: normalizeProvider(topService.provider),
        service_name: topService.service_name,
        model_name: topService.model_name,
        recommendation_type: 'service_cost_concentration',
        priority: share >= 50 ? 'high' : 'medium',
        title: `${topService.service_name} is a top cost driver`,
        summary: `${topService.service_name}${topService.model_name ? ` / ${topService.model_name}` : ''} represents ${share}% of current-month spend.`,
        observed_value: share,
        metadata: {},
      })
    }

    if (Number(topService.average_unit_price) >= 0.000004) {
      recommendations.push({
        provider: normalizeProvider(topService.provider),
        service_name: topService.service_name,
        model_name: topService.model_name,
        recommendation_type: 'high_unit_cost',
        priority: 'medium',
        title: 'High unit-cost usage detected',
        summary: `${topService.service_name}${topService.model_name ? ` / ${topService.model_name}` : ''} is running at a comparatively high observed unit price in your account.`,
        observed_value: roundCurrency(Number(topService.average_unit_price)),
        metadata: {},
      })
    }
  }

  if (input.alertCandidates.some((alert) => alert.alert_type === 'spend_spike')) {
    recommendations.push({
      provider: null,
      service_name: null,
      model_name: null,
      recommendation_type: 'spend_spike',
      priority: 'high',
      title: 'Investigate the recent spend spike',
      summary: 'Daily spend accelerated sharply compared with the prior few days. Check newly deployed workloads and retry loops.',
      observed_value: null,
      metadata: {},
    })
  }

  return recommendations
}

export function summarizeActivationMilestones(state: Pick<
  SupabaseActivationState,
  'provider_connected' | 'usage_synced' | 'insight_generated' | 'budget_created' | 'alert_configured' | 'activation_score' | 'activated'
>): ActivationMilestoneSummary {
  return {
    provider_connected: state.provider_connected,
    usage_synced: state.usage_synced,
    insight_generated: state.insight_generated,
    budget_created: state.budget_created,
    alert_configured: state.alert_configured,
    activation_score: state.activation_score,
    activated: state.activated,
  }
}
