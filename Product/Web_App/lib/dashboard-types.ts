export type DashboardPayload = {
  profile: {
    id: string
    email: string | null
    display_name: string | null
  }
  account: {
    id: string
    name: string
    slug?: string
    onboarding_status: string | null
  }
  overview: {
    current_month_spend?: number
    projected_month_end_spend?: number
    average_daily_spend?: number
    budget_amount?: string | null
    budget_used_percentage?: number
    projected_budget_variance?: number
    threshold_percentage?: number | null
    activation_score?: number
    activated?: boolean
    current_plan_id?: string | null
    plan_status?: string | null
  }
  activation: {
    provider_connected: boolean
    usage_synced: boolean
    insight_generated: boolean
    budget_created: boolean
    alert_configured: boolean
    activation_score: number
    activated: boolean
    activated_at: string | null
    time_to_value_hours: string | null
  } | null
  provider_spend: Array<{
    provider: string
    spend: number
    usage_record_count: number
  }>
  service_spend: Array<{
    provider: string
    service_name: string
    model_name: string | null
    spend: number
    usage_quantity?: string | number
    usage_record_count?: number
    average_unit_price?: number
    last_usage_at?: string | null
  }>
  daily_spend: Array<{
    spend_date: string
    spend: number
  }>
  alerts: Array<{
    id: string
    alert_type: string
    severity: string
    status?: string
    observed_value: number | null
    threshold_value: number | null
    observed_period?: string | null
  }>
  recommendations: Array<{
    id: string
    title: string
    summary: string
    priority: string
    status?: string
    provider?: string | null
    service_name?: string | null
    model_name?: string | null
    recommendation_type?: string
    observed_value: number | null
  }>
  connections: Array<{
    id: string
    provider: string
    connection_mode?: string
    connection_status: string
    connected_at?: string | null
    last_synced_at: string | null
    external_reference?: string | null
  }>
  provider_usage_limits?: Array<{
    id: string
    provider_connection_id: string
    provider: string
    limit_type: 'tokens' | 'requests' | 'cost_credits'
    limit_amount: number
    limit_period: 'daily' | 'weekly' | 'monthly'
    threshold_percentage: number
    enabled: boolean
    used_amount: number
    remaining_amount: number
    consumed_percentage: number
    period_start: string
    period_end: string
    status: 'healthy' | 'approaching' | 'high_usage' | 'exceeded' | 'disabled'
  }>
  plan: {
    current_plan_id: string
    plan_status: string
  } | null
  health?: {
    health_score: number | null
    health_state: string | null
    churn_risk: string | null
    expansion_score: number | null
    expansion_state: string | null
    recommended_action: string | null
  } | null
}

export type DemoProviderStatus = 'connected' | 'not_connected' | 'demo'

export type DemoProvider = {
  id: string
  name: string
  provider: string
  status: DemoProviderStatus
  connection_label: string
  last_synced_at: string | null
  monthly_spend: number
  requests: number
}

export type DemoWorkflowRun = {
  id: string
  timestamp: string
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost: number
  latency_ms: number
  status: 'success' | 'warning' | 'failed'
  steps: Array<{
    name: string
    cost: number
    latency_ms: number
    status: 'success' | 'warning' | 'failed'
  }>
}

export type DemoWorkflow = {
  id: string
  name: string
  provider: string
  model: string
  runs: number
  total_tokens: number
  monthly_cost: number
  avg_cost_per_run: number
  latency_ms: number
  status: 'healthy' | 'watch' | 'paused'
  trend: string
  nodes: string[]
  run_history: DemoWorkflowRun[]
}

export type DemoUsageRecord = {
  id: string
  provider: string
  model: string
  workflow: string
  requests: number
  tokens: number
  cost: number
  avg_cost_per_request: number
  mom_change: string
}

export type LiveAiUsageRecord = {
  id: string
  provider: string
  service_name: string
  model_name: string | null
  usage_quantity: number
  usage_unit: string
  calculated_cost: number
  unit_price: number
  usage_at: string
  source_type: string
  source_record_id: string
  metadata: Record<string, unknown> | null
}

export type DemoBudgetScope = 'workspace' | 'provider' | 'workflow'

export type DemoBudget = {
  id: string
  name: string
  scope: DemoBudgetScope
  target: string
  amount: number
  current_spend: number
  forecast: number
  threshold_percentage: number
  enabled: boolean
}

export type DemoAlertStatus = 'active' | 'snoozed' | 'resolved'
export type DemoAlertSeverity = 'critical' | 'warning' | 'info'

export type DemoAlert = {
  id: string
  type: 'budget_threshold' | 'projected_overspend' | 'cost_anomaly' | 'workflow_cost_spike' | 'token_spike' | 'high_retry_cost'
  severity: DemoAlertSeverity
  title: string
  source: string
  detected_at: string
  financial_impact: number
  status: DemoAlertStatus
  recommended_action: string
}

export type DemoRecommendationStatus = 'open' | 'applied' | 'dismissed'

export type DemoRecommendation = {
  id: string
  title: string
  problem: string
  workflow: string
  provider: string
  model: string
  current_cost: number
  potential_savings: number
  confidence: 'high' | 'medium' | 'low'
  impact: 'high' | 'medium' | 'low'
  action: string
  status: DemoRecommendationStatus
}

export type DemoProductState = {
  providers: DemoProvider[]
  workflows: DemoWorkflow[]
  usage: DemoUsageRecord[]
  budgets: DemoBudget[]
  alerts: DemoAlert[]
  recommendations: DemoRecommendation[]
  total_workflow_runs: number
  average_cost_per_run: number
  estimated_savings: number
  captured_savings: number
  forecast_reduction: number
  total_tokens: number
  average_latency_ms: number
}
