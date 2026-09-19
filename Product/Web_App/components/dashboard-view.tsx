'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CircleDollarSign,
  Cpu,
  GitBranch,
  LayoutDashboard,
  LineChart,
  LoaderCircle,
  Menu,
  PlugZap,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'

import { BILLING_PLAN_LIST } from '@/lib/billing-plans'
import type {
  DashboardPayload,
  DemoAlertStatus,
  DemoBudget,
  DemoBudgetScope,
  DemoProductState,
  DemoProvider,
  DemoRecommendationStatus,
  LiveAiUsageRecord,
} from '@/lib/dashboard-types'

const supportedRealProviders = [
  { provider: 'deepseek', label: 'DeepSeek', setup: 'Validated through CostPilot Gateway / LiteLLM', supported: true },
  { provider: 'gemini', label: 'Gemini', setup: 'Validated through Google Generative Language API', supported: true },
] as const

type RealProviderName = (typeof supportedRealProviders)[number]['provider']
type ProviderLimitPayload = {
  provider_connection_id: string
  limit_type: 'tokens' | 'requests' | 'cost_credits'
  limit_amount: number
  limit_period: 'daily' | 'weekly' | 'monthly'
  threshold_percentage: number
  enabled: boolean
}

export type DashboardSection = 'overview' | 'workflows' | 'usage' | 'providers' | 'budgets' | 'alerts' | 'recommendations' | 'settings'

const navItems: Array<{ id: DashboardSection; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'settings', label: 'Settings', icon: Settings },
]

function formatCurrency(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatUsageCost(value: number) {
  if (Math.abs(value) < 1 && value !== 0) return `$${value.toFixed(6)}`
  return formatCurrency(value)
}

function readLiveMetadata(row: LiveAiUsageRecord, key: string) {
  const value = row.metadata?.[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null
}

function formatProvider(provider: string) {
  return provider
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function formatStateLabel(value: string | null | undefined) {
  if (!value) return 'Unavailable'
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not synced'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function periodStart(period: 'today' | 'week' | 'month') {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (period === 'week') {
    const daysSinceMonday = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - daysSinceMonday)
  }
  if (period === 'month') start.setDate(1)
  return start
}

function formatLimitAmount(type: ProviderLimitPayload['limit_type'], value: number) {
  if (type === 'cost_credits') return formatUsageCost(value)
  return formatNumber(value)
}

function usageRunway(limit: NonNullable<DashboardPayload['provider_usage_limits']>[number]) {
  if (!limit.enabled) return 'Allowance monitoring is disabled.'
  if (limit.consumed_percentage >= 100) return 'Allowance has been exceeded for this period.'
  if (limit.consumed_percentage < 1) return 'Allowance unlikely to be exhausted this period.'
  const start = new Date(limit.period_start).getTime()
  const end = new Date(limit.period_end).getTime()
  const nowMs = Date.now()
  const elapsed = Math.max(nowMs - start, 1)
  const total = Math.max(end - start, 1)
  const projected = (limit.used_amount / elapsed) * total
  if (!Number.isFinite(projected) || limit.used_amount <= 0) return 'Insufficient usage history.'
  if (projected < limit.limit_amount) return 'Allowance unlikely to be exhausted this period.'
  const remainingMs = ((limit.limit_amount - limit.used_amount) / Math.max(limit.used_amount, 1)) * elapsed
  const remainingDays = Math.max(Math.ceil(remainingMs / 86_400_000), 0)
  return remainingDays > 0 ? `At current usage, estimated exhaustion in ~${remainingDays} day${remainingDays === 1 ? '' : 's'}.` : 'Allowance exhaustion is imminent.'
}

function defaultModelForProvider(provider: string) {
  if (provider === 'gemini') return 'gemini-3.5-flash-lite'
  if (provider === 'deepseek') return 'deepseek-chat'
  return 'model-name'
}

function serviceForProvider(provider: string) {
  if (provider === 'gemini') return 'generative-language'
  if (provider === 'deepseek') return 'litellm-chat-completions'
  return 'chat-completions'
}

function buildTelemetryExample(data: DashboardPayload | null, provider: string, selectedModel?: string) {
  const model = selectedModel?.trim() || defaultModelForProvider(provider)
  const callNode = provider === 'gemini' ? 'Call Gemini API' : 'HTTP Request: Call LiteLLM'
  const promptTokensExpression = provider === 'gemini'
    ? `{{ $('${callNode}').first().json.usageMetadata?.promptTokenCount || 0 }}`
    : `{{ $('${callNode}').first().json.usage?.prompt_tokens || 0 }}`
  const completionTokensExpression = provider === 'gemini'
    ? `{{ $('${callNode}').first().json.usageMetadata?.candidatesTokenCount || 0 }}`
    : `{{ $('${callNode}').first().json.usage?.completion_tokens || 0 }}`
  const totalTokensExpression = provider === 'gemini'
    ? `{{ $('${callNode}').first().json.usageMetadata?.totalTokenCount || 0 }}`
    : `{{ $('${callNode}').first().json.usage?.total_tokens || 0 }}`
  return {
    account_id: data?.account.id ?? 'your-account-id',
    workspace_id: data?.account.id ?? 'your-workspace-id',
    usage_event_id: 'cp_usage_{{$workflow.id}}_{{$execution.id}}_ai_usage',
    account_slug: data?.account.slug ?? 'your-workspace-slug',
    workflow_id: '{{$workflow.id}}',
    workflow_name: '{{$workflow.name}}',
    execution_id: '{{$execution.id}}',
    node_id: provider === 'gemini' ? 'gemini-product-test' : 'litellm-product-test',
    node_name: provider === 'gemini' ? 'Gemini Product Usage' : 'LiteLLM Product Usage',
    provider,
    service_name: serviceForProvider(provider),
    model_name: model,
    model,
    input_tokens: promptTokensExpression,
    output_tokens: completionTokensExpression,
    total_tokens: totalTokensExpression,
    estimated_cost: provider === 'gemini' ? 0 : "{{ $('HTTP Request: Call LiteLLM').first().json._hidden_params?.response_cost || 0 }}",
    latency_ms: "{{ Date.now() - Date.parse($('Set Product Test Context').first().json.started_at) }}",
    usage_at: '{{$now.toISO()}}',
    workflow: '{{$workflow.name}}',
    n8n_execution_id: '{{$execution.id}}',
    node: provider === 'gemini' ? 'Gemini Product Usage' : 'LiteLLM Product Usage',
    environment: 'local',
    business_action: 'product_usage_test',
    litellm_request_id: provider === 'deepseek' ? '{{$json.id}}' : null,
    tags: ['costpilot', 'product-pql', provider],
  }
}

function buildN8nSnippet(data: DashboardPayload | null, provider: string, selectedModel?: string) {
  const accountId = data?.account.id ?? 'your-workspace-id'
  const accountSlug = data?.account.slug ?? 'your-workspace-slug'
  const model = selectedModel?.trim() || defaultModelForProvider(provider)
  const callNode = provider === 'gemini' ? 'Call Gemini API' : 'HTTP Request: Call LiteLLM'
  const tokenUsage = provider === 'gemini'
    ? {
        input: `$('${callNode}').first().json.usageMetadata?.promptTokenCount || 0`,
        output: `$('${callNode}').first().json.usageMetadata?.candidatesTokenCount || 0`,
        total: `$('${callNode}').first().json.usageMetadata?.totalTokenCount || 0`,
      }
    : {
        input: `$('${callNode}').first().json.usage?.prompt_tokens || 0`,
        output: `$('${callNode}').first().json.usage?.completion_tokens || 0`,
        total: `$('${callNode}').first().json.usage?.total_tokens || 0`,
      }
  const estimatedCost = provider === 'gemini'
    ? '0'
    : `($('${callNode}').first().json._hidden_params?.response_cost || $('${callNode}').first().json.usage?.cost || 0)`
  const litellmRequestId = provider === 'deepseek' ? `$('${callNode}').first().json.id || null` : 'null'
  const bodyParametersJson = [
    '={{ JSON.stringify({',
    `  account_id: '${accountId}',`,
    `  workspace_id: '${accountId}',`,
    `  usage_event_id: 'cp_usage_' + ($workflow.id || 'workflow') + '_' + ($execution.id || 'manual') + '_${provider}_product_test',`,
    `  account_slug: '${accountSlug}',`,
    `  workflow_id: $workflow.id || 'costpilot-product-pql-test',`,
    `  workflow_name: $workflow.name || 'CostPilot Product/PQL Test',`,
    `  execution_id: $execution.id || 'manual',`,
    `  node_id: '${provider === 'gemini' ? 'gemini-product-test' : 'litellm-product-test'}',`,
    `  node_name: '${provider === 'gemini' ? 'Gemini Product Usage' : 'LiteLLM Product Usage'}',`,
    `  provider: '${provider}',`,
    `  service_name: '${serviceForProvider(provider)}',`,
    `  model_name: '${model}',`,
    `  model: '${model}',`,
    `  input_tokens: ${tokenUsage.input},`,
    `  output_tokens: ${tokenUsage.output},`,
    `  total_tokens: ${tokenUsage.total},`,
    `  estimated_cost: ${estimatedCost},`,
    `  latency_ms: Date.now() - Date.parse($('Set Product Test Context').first().json.started_at),`,
    `  usage_at: $now.toISO(),`,
    `  workflow: $workflow.name || 'CostPilot Product/PQL Test',`,
    `  n8n_execution_id: $execution.id || 'manual',`,
    `  node: '${provider === 'gemini' ? 'Gemini Product Usage' : 'LiteLLM Product Usage'}',`,
    `  environment: 'local',`,
    `  business_action: 'product_usage_test',`,
    `  litellm_request_id: ${litellmRequestId},`,
    `  tags: ['costpilot', 'product-pql', '${provider}'],`,
    '}) }}',
  ].join('\n')

  return JSON.stringify({
    method: 'POST',
    url: 'http://host.docker.internal:3000/api/product/usage/ingest',
    headers: {
      Authorization: 'Bearer {{$env.COSTPILOT_USAGE_INGEST_KEY}}',
      'Content-Type': 'application/json',
    },
    bodyParametersJson,
  }, null, 2)
}

function MetricCard({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string
  value: string
  note?: string
  tone?: 'neutral' | 'warning'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_-24px_rgba(15,23,42,.3)]">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{label}</p>
      <p className="mt-3 font-heading text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      {note ? (
        <p className={`mt-2 font-mono text-[11px] ${tone === 'warning' ? 'text-amber-600' : 'text-slate-500'}`}>{note}</p>
      ) : null}
    </div>
  )
}

function Sidebar({
  open,
  activeSection,
  onSectionChange,
  onClose,
}: {
  open: boolean
  activeSection: DashboardSection
  onSectionChange: (section: DashboardSection) => void
  onClose: () => void
}) {
  return (
    <aside
      className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white p-5 transition-transform lg:static lg:translate-x-0`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles size={16} />
          </span>
          <span className="font-heading text-lg font-bold tracking-tight text-slate-950">CostPilot</span>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden" aria-label="Close navigation">
          <X size={18} />
        </button>
      </div>
      <div className="mt-10">
        <p className="px-2 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
        <nav className="mt-3 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onSectionChange(id)
                onClose()
              }}
              className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left font-mono text-xs transition-colors ${
                activeSection === id
                  ? 'bg-secondary text-primary'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon size={16} />
                {label}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}

function SpendChart({ dailySpend }: { dailySpend: DashboardPayload['daily_spend'] }) {
  if (dailySpend.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-heading text-base font-bold text-slate-900">Spend over time</h2>
        <p className="mt-3 font-mono text-xs text-slate-500">No usage records have been synced for the current month yet.</p>
      </div>
    )
  }

  const maxSpend = Math.max(...dailySpend.map((row) => row.spend), 1)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-heading text-base font-bold text-slate-900">Spend over time</h2>
          <p className="mt-1 font-mono text-[11px] text-slate-400">Persisted daily spend for the current month</p>
        </div>
        <LineChart size={17} className="text-primary" />
      </div>
      <div className="mt-6 flex h-56 items-end gap-2">
        {dailySpend.map((row) => (
          <div key={row.spend_date} className="flex flex-1 flex-col justify-end gap-2">
            <div
              className="rounded-t-md bg-gradient-to-t from-primary to-cyan-400"
              style={{ height: `${Math.max((row.spend / maxSpend) * 100, 6)}%` }}
            />
            <span className="font-mono text-[9px] text-slate-400">{row.spend_date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function createPaymentForm(payload: Record<string, string>, action: string) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = action
  for (const [key, value] of Object.entries(payload)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}

function StatusBadge({ label }: { label: string }) {
  const tone = label === 'healthy' || label === 'connected' || label === 'success' || label === 'api_sync'
    ? 'bg-emerald-50 text-emerald-700'
    : label === 'watch' || label === 'demo' || label === 'warning' || label === 'snoozed' || label === 'approaching'
      ? 'bg-amber-50 text-amber-700'
      : label === 'critical' || label === 'high_usage' || label === 'exceeded'
        ? 'bg-rose-50 text-rose-700'
      : 'bg-slate-100 text-slate-600'

  return <span className={`rounded px-2 py-1 font-mono text-[9px] font-bold uppercase ${tone}`}>{formatStateLabel(label)}</span>
}

function budgetStatus(budget: DemoBudget) {
  if (!budget.enabled) return 'paused'
  if (budget.forecast > budget.amount) return 'projected overspend'
  if ((budget.current_spend / Math.max(budget.amount, 1)) * 100 >= budget.threshold_percentage) return 'threshold reached'
  return 'on track'
}

function BudgetsSection({
  demoProduct,
  onCreateBudget,
  onUpdateBudget,
  onDeleteBudget,
  onResetBudgets,
}: {
  demoProduct: DemoProductState
  onCreateBudget?: (budget: Omit<DemoBudget, 'id' | 'current_spend' | 'forecast' | 'enabled'>) => void
  onUpdateBudget?: (budgetId: string, updates: Partial<Pick<DemoBudget, 'amount' | 'threshold_percentage' | 'enabled'>>) => void
  onDeleteBudget?: (budgetId: string) => void
  onResetBudgets?: () => void
}) {
  const [name, setName] = useState('Demo Workflow Budget')
  const [scope, setScope] = useState<DemoBudgetScope>('workflow')
  const [target, setTarget] = useState(demoProduct.workflows[0]?.name ?? 'Lead Qualification')
  const [amount, setAmount] = useState('1000')
  const [threshold, setThreshold] = useState('80')

  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-base font-bold text-slate-900">Budget controls</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-400">Synthetic workspace, provider, and workflow guardrails</p>
          </div>
          <button type="button" onClick={() => onResetBudgets?.()} className="button-secondary justify-center">Reset demo budgets</button>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-slate-100 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
                <th className="pb-3">Budget</th>
                <th className="pb-3">Scope</th>
                <th className="pb-3">Spend</th>
                <th className="pb-3">Forecast</th>
                <th className="pb-3">Remaining</th>
                <th className="pb-3">Threshold</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demoProduct.budgets.map((budget) => {
                const consumed = (budget.current_spend / Math.max(budget.amount, 1)) * 100
                const overage = Math.max(budget.forecast - budget.amount, 0)
                return (
                  <tr key={budget.id} className="font-mono text-xs text-slate-600">
                    <td className="py-4">
                      <p className="font-heading text-sm font-bold text-slate-900">{budget.name}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{budget.target}</p>
                    </td>
                    <td className="py-4">{formatStateLabel(budget.scope)}</td>
                    <td className="py-4">{formatCurrency(budget.current_spend)} <span className="text-slate-400">({consumed.toFixed(0)}%)</span></td>
                    <td className={`py-4 font-bold ${overage ? 'text-amber-600' : 'text-slate-900'}`}>{formatCurrency(budget.forecast)}</td>
                    <td className="py-4">{formatCurrency(Math.max(budget.amount - budget.current_spend, 0))}</td>
                    <td className="py-4">
                      <input
                        aria-label={`${budget.name} threshold`}
                        value={budget.threshold_percentage}
                        onChange={(event) => onUpdateBudget?.(budget.id, { threshold_percentage: Number(event.target.value) })}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-primary"
                      />%
                    </td>
                    <td className="py-4"><StatusBadge label={budgetStatus(budget)} /></td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onUpdateBudget?.(budget.id, { enabled: !budget.enabled })} className="button-secondary px-3 py-2">
                          {budget.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" onClick={() => onUpdateBudget?.(budget.id, { amount: Math.round(budget.amount * 1.1) })} className="button-secondary px-3 py-2">
                          Raise 10%
                        </button>
                        <button type="button" onClick={() => onDeleteBudget?.(budget.id)} className="button-secondary px-3 py-2">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-heading text-base font-bold text-slate-900">Create demo budget</h2>
        <p className="mt-1 font-mono text-[11px] text-slate-400">This changes only local synthetic demo state.</p>
        <div className="mt-5 grid gap-3">
          <label className="font-mono text-[11px] text-slate-500">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary" /></label>
          <label className="font-mono text-[11px] text-slate-500">Scope<select value={scope} onChange={(event) => setScope(event.target.value as DemoBudgetScope)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"><option value="workspace">Entire workspace</option><option value="provider">Provider</option><option value="workflow">Workflow</option></select></label>
          <label className="font-mono text-[11px] text-slate-500">Target<input value={target} onChange={(event) => setTarget(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="font-mono text-[11px] text-slate-500">Budget<input value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary" /></label>
            <label className="font-mono text-[11px] text-slate-500">Threshold %<input value={threshold} onChange={(event) => setThreshold(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary" /></label>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onCreateBudget?.({ name, scope, target, amount: Number(amount), threshold_percentage: Number(threshold) })}
          className="button-primary mt-5 w-full justify-center"
        >
          Create Budget
        </button>
      </div>
    </section>
  )
}

function AlertsSection({
  demoProduct,
  onSetAlertStatus,
}: {
  demoProduct: DemoProductState
  onSetAlertStatus?: (alertId: string, status: DemoAlertStatus) => void
}) {
  const activeCount = demoProduct.alerts.filter((alert) => alert.status === 'active').length
  const totalImpact = demoProduct.alerts
    .filter((alert) => alert.status === 'active')
    .reduce((total, alert) => total + alert.financial_impact, 0)

  return (
    <section className="mt-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Active alerts" value={formatNumber(activeCount)} note="Synthetic control signals" />
        <MetricCard label="Financial impact" value={formatCurrency(totalImpact)} note="Open risk this month" tone={totalImpact > 0 ? 'warning' : 'neutral'} />
        <MetricCard label="Resolved / snoozed" value={formatNumber(demoProduct.alerts.length - activeCount)} note="Updated in demo state" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {demoProduct.alerts.map((alert) => (
          <article key={alert.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={alert.severity} />
                  <StatusBadge label={alert.status} />
                  <span className="rounded bg-slate-100 px-2 py-1 font-mono text-[9px] font-bold uppercase text-slate-600">{alert.type.replaceAll('_', ' ')}</span>
                </div>
                <h2 className="mt-4 font-heading text-lg font-bold text-slate-900">{alert.title}</h2>
                <p className="mt-2 font-mono text-xs leading-5 text-slate-500">{alert.recommended_action}</p>
              </div>
              <p className="font-heading text-xl font-bold text-slate-950">{formatCurrency(alert.financial_impact)}</p>
            </div>
            <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-[11px] text-slate-500 sm:grid-cols-2">
              <span>Source: <b className="text-slate-700">{alert.source}</b></span>
              <span>Detected: <b className="text-slate-700">{formatDateTime(alert.detected_at)}</b></span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => onSetAlertStatus?.(alert.id, 'resolved')} className="button-primary justify-center" disabled={alert.status === 'resolved'}>Resolve</button>
              <button type="button" onClick={() => onSetAlertStatus?.(alert.id, 'snoozed')} className="button-secondary justify-center" disabled={alert.status === 'snoozed'}>Snooze</button>
              <button type="button" onClick={() => onSetAlertStatus?.(alert.id, 'active')} className="button-secondary justify-center" disabled={alert.status === 'active'}>Reopen</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function RecommendationsSection({
  demoProduct,
  onSetRecommendationStatus,
}: {
  demoProduct: DemoProductState
  onSetRecommendationStatus?: (recommendationId: string, status: DemoRecommendationStatus) => void
}) {
  const openSavings = demoProduct.recommendations
    .filter((recommendation) => recommendation.status === 'open')
    .reduce((total, recommendation) => total + recommendation.potential_savings, 0)

  return (
    <section className="mt-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Open savings" value={formatCurrency(openSavings)} note="Potential monthly reduction" />
        <MetricCard label="Captured savings" value={formatCurrency(demoProduct.captured_savings)} note="Simulated applied actions" />
        <MetricCard label="Forecast reduction" value={formatCurrency(demoProduct.forecast_reduction)} note="Reflected back in Overview" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {demoProduct.recommendations.map((recommendation) => (
          <article key={recommendation.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <StatusBadge label={recommendation.status} />
                <h2 className="mt-4 font-heading text-lg font-bold text-slate-900">{recommendation.title}</h2>
              </div>
              <p className="font-heading text-xl font-bold text-emerald-600">{formatCurrency(recommendation.potential_savings)}</p>
            </div>
            <p className="mt-4 font-mono text-xs leading-5 text-slate-600">{recommendation.problem}</p>
            <div className="mt-5 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-[11px] text-slate-500">
              <p>Workflow: <b className="text-slate-700">{recommendation.workflow}</b></p>
              <p>Model: <b className="text-slate-700">{recommendation.provider} / {recommendation.model}</b></p>
              <p>Current cost: <b className="text-slate-700">{formatCurrency(recommendation.current_cost)}</b></p>
              <p>Confidence: <b className="text-slate-700">{formatStateLabel(recommendation.confidence)}</b> · Impact: <b className="text-slate-700">{formatStateLabel(recommendation.impact)}</b></p>
            </div>
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-800">Demo simulation only. No provider or model configuration is changed.</div>
            <p className="mt-4 font-mono text-xs leading-5 text-slate-500">{recommendation.action}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => onSetRecommendationStatus?.(recommendation.id, 'applied')} className="button-primary justify-center" disabled={recommendation.status !== 'open'}>Apply</button>
              <button type="button" onClick={() => onSetRecommendationStatus?.(recommendation.id, 'dismissed')} className="button-secondary justify-center" disabled={recommendation.status !== 'open'}>Dismiss</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-heading text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-2 font-mono text-xs leading-5 text-slate-500">{description}</p>
    </div>
  )
}

function RealWorkflowsSection({ liveUsage }: { liveUsage?: LiveAiUsageRecord[] }) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)

  if (!liveUsage?.length) {
    return <section className="mt-8"><EmptyState title="No workflow telemetry yet." description="CostPilot will show real workflow, execution, node, token, latency, and cost metadata after AI/API usage is ingested." /></section>
  }

  const workflows = new Map<string, { runs: number; tokens: number; cost: number; latency: number; latest: LiveAiUsageRecord; records: LiveAiUsageRecord[] }>()
  for (const row of liveUsage) {
    const key = readLiveMetadata(row, 'workflow') ?? 'Unattributed workflow'
    const current = workflows.get(key)
    const latency = Number(readLiveMetadata(row, 'latency_ms') ?? 0)
    workflows.set(key, {
      runs: (current?.runs ?? 0) + 1,
      tokens: (current?.tokens ?? 0) + row.usage_quantity,
      cost: (current?.cost ?? 0) + row.calculated_cost,
      latency: (current?.latency ?? 0) + latency,
      latest: current && new Date(current.latest.usage_at) > new Date(row.usage_at) ? current.latest : row,
      records: [...(current?.records ?? []), row],
    })
  }
  const workflowEntries = [...workflows.entries()]
  const activeWorkflowName = selectedWorkflow ?? workflowEntries[0]?.[0] ?? null
  const activeWorkflow = activeWorkflowName ? workflows.get(activeWorkflowName) : null

  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-base font-bold text-slate-900">Observed workflows</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-400">Real runs derived from usage_records metadata</p>
          </div>
          <GitBranch size={17} className="text-primary" />
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-slate-100 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
                <th className="pb-3">Workflow</th>
                <th className="pb-3">Latest activity</th>
                <th className="pb-3">Provider / model</th>
                <th className="pb-3">Runs</th>
                <th className="pb-3">Tokens</th>
                <th className="pb-3">Cost</th>
                <th className="pb-3">Avg / run</th>
                <th className="pb-3">Avg latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workflowEntries.map(([workflow, summary]) => (
                <tr
                  key={workflow}
                  onClick={() => setSelectedWorkflow(workflow)}
                  className={`cursor-pointer font-mono text-xs transition-colors hover:bg-slate-50 ${activeWorkflowName === workflow ? 'bg-secondary/50' : ''}`}
                >
                  <td className="py-4 font-heading text-sm font-bold text-slate-900">{workflow}</td>
                  <td className="py-4">{formatDateTime(summary.latest.usage_at)}</td>
                  <td className="py-4">{formatProvider(summary.latest.provider)} / {summary.latest.model_name ?? summary.latest.service_name}</td>
                  <td className="py-4">{formatNumber(summary.runs)}</td>
                  <td className="py-4">{formatNumber(summary.tokens)}</td>
                  <td className="py-4 font-bold text-slate-900">{formatUsageCost(summary.cost)}</td>
                  <td className="py-4">{formatUsageCost(summary.cost / Math.max(summary.runs, 1))}</td>
                  <td className="py-4">{Math.round(summary.latency / Math.max(summary.runs, 1))}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-heading text-base font-bold text-slate-900">{activeWorkflowName ?? 'Workflow runs'}</h2>
        <p className="mt-1 font-mono text-[11px] text-slate-400">Real execution and node telemetry</p>
        <div className="mt-5 divide-y divide-slate-100">
          {(activeWorkflow?.records ?? []).map((run) => (
            <div key={run.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs font-bold text-slate-700">{readLiveMetadata(run, 'n8n_execution_id') ?? run.source_record_id}</p>
                <StatusBadge label={run.source_type} />
              </div>
              <p className="mt-1 font-mono text-[10px] text-slate-400">{formatDateTime(run.usage_at)} · {readLiveMetadata(run, 'node') ?? 'Unattributed node'}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MetricCard label="Tokens" value={formatNumber(run.usage_quantity)} />
                <MetricCard label="Cost" value={formatUsageCost(run.calculated_cost)} />
                <MetricCard label="Latency" value={`${readLiveMetadata(run, 'latency_ms') ?? '0'}ms`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function WorkflowsSection({ demoProduct, liveUsage }: { demoProduct: DemoProductState; liveUsage?: LiveAiUsageRecord[] }) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(demoProduct.workflows[0]?.id ?? '')
  const selectedWorkflow = demoProduct.workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? demoProduct.workflows[0]
  const latestLiveRun = liveUsage?.[0] ?? null

  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      {latestLiveRun ? (
        <div className="xl:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-emerald-700">Live / Real usage</p>
              <h2 className="mt-2 font-heading text-base font-bold text-slate-900">{readLiveMetadata(latestLiveRun, 'workflow') ?? 'AI telemetry test workflow'}</h2>
              <p className="mt-1 font-mono text-[11px] text-slate-500">This run was captured from a real AI workflow integration test.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Tokens" value={formatNumber(liveUsage?.reduce((sum, row) => sum + row.usage_quantity, 0) ?? latestLiveRun.usage_quantity)} />
              <MetricCard label="Cost" value={formatUsageCost(liveUsage?.reduce((sum, row) => sum + row.calculated_cost, 0) ?? latestLiveRun.calculated_cost)} />
              <MetricCard label="Latency" value={`${readLiveMetadata(latestLiveRun, 'latency_ms') ?? '0'}ms`} />
            </div>
          </div>
        </div>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-base font-bold text-slate-900">AI workflows</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-400">Synthetic runs, tokens, latency, and monthly cost</p>
          </div>
          <GitBranch size={17} className="text-primary" />
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-slate-100 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
                <th className="pb-3">Workflow</th>
                <th className="pb-3">Model</th>
                <th className="pb-3">Runs</th>
                <th className="pb-3">Tokens</th>
                <th className="pb-3">Cost</th>
                <th className="pb-3">Avg / run</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demoProduct.workflows.map((workflow) => (
                <tr
                  key={workflow.id}
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                  className={`cursor-pointer font-mono text-xs transition-colors hover:bg-slate-50 ${selectedWorkflow?.id === workflow.id ? 'bg-secondary/50' : ''}`}
                >
                  <td className="py-4">
                    <p className="font-heading text-sm font-bold text-slate-900">{workflow.name}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{workflow.trend} month over month</p>
                  </td>
                  <td className="py-4 text-slate-600">{workflow.provider} / {workflow.model}</td>
                  <td className="py-4 text-slate-600">{formatNumber(workflow.runs)}</td>
                  <td className="py-4 text-slate-600">{formatNumber(workflow.total_tokens)}</td>
                  <td className="py-4 font-bold text-slate-900">{formatCurrency(workflow.monthly_cost)}</td>
                  <td className="py-4 text-slate-600">{formatCurrency(workflow.avg_cost_per_run)}</td>
                  <td className="py-4"><StatusBadge label={workflow.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-base font-bold text-slate-900">{selectedWorkflow?.name ?? 'Workflow detail'}</h2>
              <p className="mt-1 font-mono text-[11px] text-slate-400">Cost-bearing step visibility</p>
            </div>
            <Cpu size={17} className="text-primary" />
          </div>
          <div className="mt-5 space-y-3">
            {(selectedWorkflow?.nodes ?? []).map((node, index) => (
              <div key={node} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-mono text-xs text-slate-600">{index + 1}. {node}</span>
                <span className="font-mono text-[10px] text-slate-400">{node.toLowerCase().includes('ai') || node.toLowerCase().includes('write') || node.toLowerCase().includes('synthesize') || node.toLowerCase().includes('summarize') ? 'cost driver' : 'supporting'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-heading text-base font-bold text-slate-900">Recent runs</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {(selectedWorkflow?.run_history ?? []).map((run) => (
              <div key={run.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-bold text-slate-700">{run.id}</p>
                  <StatusBadge label={run.status} />
                </div>
                <p className="mt-1 font-mono text-[10px] text-slate-400">{formatDateTime(run.timestamp)} · {run.provider} / {run.model}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MetricCard label="Tokens" value={formatNumber(run.total_tokens)} />
                  <MetricCard label="Cost" value={formatCurrency(run.cost)} />
                  <MetricCard label="Latency" value={`${run.latency_ms}ms`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function UsageSection({ demoProduct, liveUsage }: { demoProduct: DemoProductState; liveUsage?: LiveAiUsageRecord[] }) {
  const [providerFilter, setProviderFilter] = useState('all')
  const [workflowFilter, setWorkflowFilter] = useState('all')
  const providers = ['all', ...new Set(demoProduct.usage.map((row) => row.provider))]
  const workflows = ['all', ...new Set(demoProduct.usage.map((row) => row.workflow))]
  const filteredUsage = demoProduct.usage.filter((row) =>
    (providerFilter === 'all' || row.provider === providerFilter) &&
    (workflowFilter === 'all' || row.workflow === workflowFilter)
  )

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-heading text-base font-bold text-slate-900">Usage / Costs</h2>
          <p className="mt-1 font-mono text-[11px] text-slate-400">Synthetic provider, model, request, token, and cost attribution</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary">
            {providers.map((provider) => <option key={provider} value={provider}>{provider === 'all' ? 'All providers' : provider}</option>)}
          </select>
          <select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary">
            {workflows.map((workflow) => <option key={workflow} value={workflow}>{workflow === 'all' ? 'All workflows' : workflow}</option>)}
          </select>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">Last 30 days</span>
        </div>
      </div>
      {liveUsage?.length ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-emerald-700">Live / Real usage</p>
              <p className="mt-1 font-mono text-xs text-slate-600">Actual LiteLLM / DeepSeek runs captured through the CostPilot ingestion API.</p>
            </div>
            <StatusBadge label={`${liveUsage.length} run${liveUsage.length === 1 ? '' : 's'}`} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-emerald-100 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
                  <th className="pb-3">Provider</th>
                  <th className="pb-3">Model</th>
                  <th className="pb-3">Workflow</th>
                  <th className="pb-3">Execution</th>
                  <th className="pb-3">Tokens</th>
                  <th className="pb-3">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {liveUsage.map((row) => (
                  <tr key={row.id} className="font-mono text-xs text-slate-600">
                    <td className="py-3 font-bold text-slate-900">{formatProvider(row.provider)}</td>
                    <td className="py-3">{row.model_name ?? row.service_name}</td>
                    <td className="py-3">{readLiveMetadata(row, 'workflow') ?? 'AI telemetry test'}</td>
                    <td className="py-3">{readLiveMetadata(row, 'n8n_execution_id') ?? 'manual'}</td>
                    <td className="py-3">{formatNumber(row.usage_quantity)}</td>
                    <td className="py-3 font-bold text-slate-900">{formatUsageCost(row.calculated_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left">
          <thead>
            <tr className="border-b border-slate-100 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
              <th className="pb-3">Provider</th>
              <th className="pb-3">Model</th>
              <th className="pb-3">Workflow</th>
              <th className="pb-3">Requests</th>
              <th className="pb-3">Tokens</th>
              <th className="pb-3">Cost</th>
              <th className="pb-3">Avg / request</th>
              <th className="pb-3">MoM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsage.map((row) => (
              <tr key={row.id} className="font-mono text-xs text-slate-600">
                <td className="py-4 font-bold text-slate-900">{row.provider}</td>
                <td className="py-4">{row.model}</td>
                <td className="py-4">{row.workflow}</td>
                <td className="py-4">{formatNumber(row.requests)}</td>
                <td className="py-4">{formatNumber(row.tokens)}</td>
                <td className="py-4 font-bold text-slate-900">{formatCurrency(row.cost)}</td>
                <td className="py-4">{formatCurrency(row.avg_cost_per_request)}</td>
                <td className={`py-4 font-bold ${row.mom_change.startsWith('-') ? 'text-emerald-600' : 'text-amber-600'}`}>{row.mom_change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ProvidersSection({
  data,
  demoProduct,
  liveUsage,
  onConnectProvider,
  onDisconnectProvider,
}: {
  data: DashboardPayload | null
  demoProduct: DemoProductState
  liveUsage?: LiveAiUsageRecord[]
  onConnectProvider?: (providerId: string) => void
  onDisconnectProvider?: (providerId: string) => void
}) {
  const [selectedProvider, setSelectedProvider] = useState<'deepseek' | 'gemini'>('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [copiedSnippet, setCopiedSnippet] = useState<'json' | 'n8n' | null>(null)
  const liveByProvider = new Map<string, LiveAiUsageRecord[]>()
  for (const row of liveUsage ?? []) {
    liveByProvider.set(row.provider, [...(liveByProvider.get(row.provider) ?? []), row])
  }
  const selectedDemoProvider = demoProduct.providers.find((provider) => provider.provider === selectedProvider)
  const activeProvider = selectedDemoProvider?.provider ?? selectedProvider
  const telemetryExample = buildTelemetryExample(data, activeProvider)
  const n8nSnippet = buildN8nSnippet(data, activeProvider)
  const copyText = async (text: string, type: 'json' | 'n8n') => {
    await navigator.clipboard.writeText(text)
    setCopiedSnippet(type)
    window.setTimeout(() => setCopiedSnippet(null), 1800)
  }
  const testDemoConnection = () => {
    if (!apiKey.trim()) {
      setMessage({ tone: 'error', text: 'Enter any demo key to simulate validation.' })
      return
    }
    if (apiKey.toLowerCase().includes('fail') || apiKey.toLowerCase().includes('invalid')) {
      setMessage({ tone: 'error', text: 'Demo authentication failed. Try a different synthetic key.' })
      return
    }
    if (selectedDemoProvider) onConnectProvider?.(selectedDemoProvider.id)
    setApiKey('')
    setMessage({ tone: 'success', text: `${formatProvider(activeProvider)} connected in demo mode. Synthetic key was not stored.` })
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-heading text-base font-bold text-slate-900">Add provider</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-400">Demo validation is synthetic. Use any demo key except words like invalid or fail.</p>
          </div>
          <div className="grid gap-3 sm:min-w-[420px] sm:grid-cols-[160px_1fr]">
            <select value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value as 'deepseek' | 'gemini')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary">
              <option value="deepseek">DeepSeek</option>
              <option value="gemini">Gemini</option>
            </select>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={`${formatProvider(selectedProvider)} demo API key`}
              autoComplete="off"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary"
            />
            <button type="button" onClick={testDemoConnection} className="button-primary justify-center sm:col-span-2">
              <PlugZap size={14} />
              Test Connection
            </button>
          </div>
        </div>
        {message ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 font-mono text-xs ${message.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {message.text}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {demoProduct.providers.map((provider: DemoProvider) => (
        <article key={provider.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-base font-bold text-slate-900">{provider.name}</h2>
              <p className="mt-1 font-mono text-[11px] text-slate-400">{provider.connection_label}</p>
            </div>
            <StatusBadge label={provider.status} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <MetricCard label="Spend" value={formatCurrency(provider.monthly_spend)} />
            <MetricCard label="Requests" value={formatNumber(provider.requests)} />
          </div>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">Last sync</p>
            <p className="mt-1 font-mono text-xs text-slate-600">{formatDateTime(provider.last_synced_at)}</p>
          </div>
          <button
            type="button"
            onClick={() => provider.status === 'not_connected' ? onConnectProvider?.(provider.id) : onDisconnectProvider?.(provider.id)}
            className={provider.status === 'not_connected' ? 'button-primary mt-5 w-full justify-center' : 'button-secondary mt-5 w-full justify-center'}
          >
            {provider.status === 'not_connected' ? 'Connect demo provider' : 'Disconnect demo provider'}
          </button>
        </article>
        ))}
        {[...liveByProvider.entries()].map(([provider, rows]) => (
        <article key={`live-${provider}`} className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-emerald-700">Live / Real usage</p>
              <h2 className="mt-2 font-heading text-base font-bold text-slate-900">{formatProvider(provider)}</h2>
              <p className="mt-1 font-mono text-[11px] text-slate-500">CostPilot Gateway / LiteLLM</p>
            </div>
            <StatusBadge label="connected" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <MetricCard label="Spend" value={formatUsageCost(rows.reduce((sum, row) => sum + row.calculated_cost, 0))} />
            <MetricCard label="Tokens" value={formatNumber(rows.reduce((sum, row) => sum + row.usage_quantity, 0))} />
          </div>
          <div className="mt-5 rounded-lg border border-emerald-200 bg-white/70 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">Latest real sync</p>
            <p className="mt-1 font-mono text-xs text-slate-600">{formatDateTime(rows[0]?.usage_at)}</p>
          </div>
        </article>
        ))}
      </div>

      {selectedDemoProvider?.status === 'connected' ? (
        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-secondary to-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-primary">Integrate CostPilot</p>
              <h2 className="mt-2 font-heading text-base font-bold text-slate-900">Copy demo telemetry metadata into n8n</h2>
              <p className="mt-2 font-mono text-xs leading-5 text-slate-600">Synthetic examples only. No API keys, secrets, or real provider credentials are included.</p>
            </div>
            <StatusBadge label={`${formatProvider(activeProvider)} demo`} />
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-white/70 bg-white/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-sm font-bold text-slate-900">JSON metadata</h3>
                <button type="button" onClick={() => void copyText(JSON.stringify(telemetryExample, null, 2), 'json')} className="button-secondary px-3 py-2">
                  {copiedSnippet === 'json' ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
              <pre className="mt-4 max-h-[360px] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-[11px] leading-5 text-slate-100">{JSON.stringify(telemetryExample, null, 2)}</pre>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-sm font-bold text-slate-900">n8n HTTP Request example</h3>
                <button type="button" onClick={() => void copyText(n8nSnippet, 'n8n')} className="button-secondary px-3 py-2">
                  {copiedSnippet === 'n8n' ? 'Copied' : 'Copy n8n'}
                </button>
              </div>
              <pre className="mt-4 max-h-[360px] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-[11px] leading-5 text-slate-100">{n8nSnippet}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function RealUsageSection({ data, liveUsage }: { data: DashboardPayload | null; liveUsage?: LiveAiUsageRecord[] }) {
  const [providerFilter, setProviderFilter] = useState('all')
  const [modelFilter, setModelFilter] = useState('all')
  const [workflowFilter, setWorkflowFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month'>('month')
  const serviceSpend = data?.service_spend ?? []
  const usageRows = liveUsage ?? []
  const providers = ['all', ...new Set([
    ...usageRows.map((row) => row.provider),
    ...serviceSpend.map((row) => row.provider),
  ])]
  const models = ['all', ...new Set(usageRows.map((row) => row.model_name ?? row.service_name).filter(Boolean))]
  const workflows = ['all', ...new Set(usageRows.map((row) => readLiveMetadata(row, 'workflow') ?? 'Unattributed').filter(Boolean))]
  const filteredUsage = usageRows.filter((row) => {
    const workflow = readLiveMetadata(row, 'workflow') ?? 'Unattributed'
    const model = row.model_name ?? row.service_name
    return (providerFilter === 'all' || row.provider === providerFilter) &&
      (modelFilter === 'all' || model === modelFilter) &&
      (workflowFilter === 'all' || workflow === workflowFilter) &&
      new Date(row.usage_at) >= periodStart(periodFilter)
  })
  const totalTokens = filteredUsage
    .filter((row) => row.usage_unit === 'tokens')
    .reduce((sum, row) => sum + row.usage_quantity, 0)
  const totalCost = filteredUsage.reduce((sum, row) => sum + row.calculated_cost, 0)
  const averageCost = filteredUsage.length ? totalCost / filteredUsage.length : 0
  const averageLatency = filteredUsage.length
    ? Math.round(filteredUsage.reduce((sum, row) => sum + Number(readLiveMetadata(row, 'latency_ms') ?? 0), 0) / filteredUsage.length)
    : 0

  if (!serviceSpend.length && !usageRows.length) {
    return <section className="mt-8"><EmptyState title="No AI/API usage recorded yet." description="CostPilot will show provider, model/service, token, cost, workflow, and latency attribution after real usage is ingested." /></section>
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total tokens" value={formatNumber(totalTokens)} note="Filtered real usage" />
        <MetricCard label="Requests" value={formatNumber(filteredUsage.length)} note="Usage records in view" />
        <MetricCard label="Total cost" value={formatUsageCost(totalCost)} note="Actual calculated spend" />
        <MetricCard label="Avg latency" value={`${averageLatency}ms`} note={`${formatUsageCost(averageCost)} avg cost / request`} />
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary">
          {providers.map((provider) => <option key={provider} value={provider}>{provider === 'all' ? 'All providers' : formatProvider(provider)}</option>)}
        </select>
        <select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary">
          {models.map((model) => <option key={model} value={model}>{model === 'all' ? 'All models' : model}</option>)}
        </select>
        <select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary">
          {workflows.map((workflow) => <option key={workflow} value={workflow}>{workflow === 'all' ? 'All workflows' : workflow}</option>)}
        </select>
        <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as 'today' | 'week' | 'month')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary">
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">Real API-sync records</span>
      </div>

      {usageRows.length ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6">
          <h2 className="font-heading text-base font-bold text-slate-900">Live AI usage records</h2>
          <p className="mt-1 font-mono text-[11px] text-slate-500">Actual server-side telemetry captured from AI workflow integration tests.</p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead>
                <tr className="border-b border-emerald-100 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
                  <th className="pb-3">Time</th>
                  <th className="pb-3">Provider</th>
                  <th className="pb-3">Model</th>
                  <th className="pb-3">Workflow</th>
                  <th className="pb-3">Execution</th>
                  <th className="pb-3">Node</th>
                  <th className="pb-3">Tokens</th>
                  <th className="pb-3">Cost</th>
                  <th className="pb-3">Latency</th>
                  <th className="pb-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {filteredUsage.map((row) => (
                  <tr key={row.id} className="font-mono text-xs text-slate-600">
                    <td className="py-3">{formatDateTime(row.usage_at)}</td>
                    <td className="py-3 font-bold text-slate-900">{formatProvider(row.provider)}</td>
                    <td className="py-3">{row.model_name ?? row.service_name}</td>
                    <td className="py-3">{readLiveMetadata(row, 'workflow') ?? 'Unattributed'}</td>
                    <td className="py-3">{readLiveMetadata(row, 'n8n_execution_id') ?? 'manual'}</td>
                    <td className="py-3">{readLiveMetadata(row, 'node') ?? 'Unattributed'}</td>
                    <td className="py-3">{formatNumber(row.usage_quantity)}</td>
                    <td className="py-3 font-bold text-slate-900">{formatUsageCost(row.calculated_cost)}</td>
                    <td className="py-3">{readLiveMetadata(row, 'latency_ms') ?? '0'}ms</td>
                    <td className="py-3">{row.source_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredUsage.length ? <p className="mt-4 font-mono text-xs text-slate-500">No usage records match the selected filters.</p> : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-heading text-base font-bold text-slate-900">Service and model spend</h2>
        <p className="mt-1 font-mono text-[11px] text-slate-400">Current-month Supabase rollup from usage_records</p>
        {serviceSpend.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-100 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
                  <th className="pb-3">Provider</th>
                  <th className="pb-3">Service</th>
                  <th className="pb-3">Model</th>
                  <th className="pb-3">Records</th>
                  <th className="pb-3">Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serviceSpend.map((row) => (
                  <tr key={`${row.provider}_${row.service_name}_${row.model_name ?? 'na'}`} className="font-mono text-xs text-slate-600">
                    <td className="py-4 font-bold text-slate-900">{formatProvider(row.provider)}</td>
                    <td className="py-4">{row.service_name}</td>
                    <td className="py-4">{row.model_name ?? 'Not attributed'}</td>
                    <td className="py-4">{formatNumber(row.usage_record_count ?? 0)}</td>
                    <td className="py-4 font-bold text-slate-900">{formatUsageCost(row.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 font-mono text-xs text-slate-500">No service-level spend has been recorded yet.</p>
        )}
      </div>
    </section>
  )
}

function RealProvidersSection({
  data,
  liveUsage,
  onAddProvider,
  onDisconnectProvider,
  onReconnectProvider,
  onRemoveProvider,
  savingProvider,
  onSaveProviderLimit,
  savingProviderLimit,
}: {
  data: DashboardPayload | null
  liveUsage?: LiveAiUsageRecord[]
  onAddProvider?: (provider: RealProviderName, apiKey: string) => void | Promise<void>
  onDisconnectProvider?: (connectionId: string) => void | Promise<void>
  onReconnectProvider?: (connectionId: string, apiKey: string) => void | Promise<void>
  onRemoveProvider?: (connectionId: string) => void | Promise<void>
  savingProvider?: boolean
  onSaveProviderLimit?: (payload: ProviderLimitPayload) => void | Promise<void>
  savingProviderLimit?: boolean
}) {
  const [selectedProvider, setSelectedProvider] = useState<RealProviderName>('deepseek')
  const [providerApiKey, setProviderApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState(defaultModelForProvider('deepseek'))
  const [reconnectKeys, setReconnectKeys] = useState<Record<string, string>>({})
  const [copiedSnippet, setCopiedSnippet] = useState<'n8n' | null>(null)
  const [integrationOpen, setIntegrationOpen] = useState(false)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [limitType, setLimitType] = useState<ProviderLimitPayload['limit_type']>('tokens')
  const [limitPeriod, setLimitPeriod] = useState<ProviderLimitPayload['limit_period']>('monthly')
  const [limitAmount, setLimitAmount] = useState('1000000')
  const [limitThreshold, setLimitThreshold] = useState('70')
  const [limitEnabled, setLimitEnabled] = useState(true)
  const connections = data?.connections ?? []
  const activeConnectionId = selectedConnectionId ?? connections[0]?.id ?? null
  const activeConnection = connections.find((connection) => connection.id === activeConnectionId) ?? connections[0] ?? null
  const activeLimit = data?.provider_usage_limits?.find((limit) => limit.provider_connection_id === activeConnection?.id) ?? null
  const selectedProviderConfig = supportedRealProviders.find((provider) => provider.provider === selectedProvider)
  const activeProvider = activeConnection?.provider ?? selectedProvider
  const activeModel = selectedModel || defaultModelForProvider(activeProvider)
  const n8nSnippet = buildN8nSnippet(data, activeProvider, activeModel)
  const realProviderCards = supportedRealProviders.filter((provider) => provider.supported)
  const copyText = async (text: string, type: 'n8n') => {
    await navigator.clipboard.writeText(text)
    setCopiedSnippet(type)
    window.setTimeout(() => setCopiedSnippet(null), 1800)
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {realProviderCards.map((provider) => {
          const connection = connections.find((row) => row.provider === provider.provider)
          const providerUsage = (liveUsage ?? []).filter((row) => row.provider === provider.provider)
          const spend = data?.provider_spend.find((row) => row.provider === provider.provider)
          const models = [...new Set(providerUsage.map((row) => row.model_name ?? row.service_name))]
          return (
            <article key={provider.provider} className={`rounded-xl border bg-white p-5 sm:p-6 ${selectedProvider === provider.provider ? 'border-primary' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProvider(provider.provider)
                    setSelectedModel(defaultModelForProvider(provider.provider))
                    if (connection) setSelectedConnectionId(connection.id)
                  }}
                  className="text-left"
                >
                  <h2 className="font-heading text-base font-bold text-slate-900">{provider.label}</h2>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">{connection?.external_reference ?? provider.setup}</p>
                </button>
                <StatusBadge label={connection?.connection_status ?? 'disconnected'} />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <MetricCard label="Requests" value={formatNumber(providerUsage.length)} />
                <MetricCard label="Tokens" value={formatNumber(providerUsage.reduce((sum, row) => sum + row.usage_quantity, 0))} />
                <MetricCard label="Cost" value={formatUsageCost(spend?.spend ?? providerUsage.reduce((sum, row) => sum + row.calculated_cost, 0))} />
                <MetricCard label="Models" value={formatNumber(models.length)} />
              </div>
              <p className="mt-4 font-mono text-[11px] leading-5 text-slate-500">
                {models.length ? `Used models: ${models.join(', ')}` : 'No model usage recorded yet.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {connection?.connection_status === 'connected' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedConnectionId(connection.id)
                        setSelectedProvider(provider.provider)
                        setSelectedModel(defaultModelForProvider(provider.provider))
                        setIntegrationOpen(true)
                      }}
                      className="button-primary px-3 py-2"
                    >
                      Integrate CostPilot
                    </button>
                    <button type="button" onClick={() => void onDisconnectProvider?.(connection.id)} disabled={savingProvider || !onDisconnectProvider} className="button-secondary px-3 py-2">Disconnect</button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProvider(provider.provider)
                      setSelectedModel(defaultModelForProvider(provider.provider))
                      if (connection) setSelectedConnectionId(connection.id)
                      setIntegrationOpen(false)
                    }}
                    className="button-primary px-3 py-2"
                  >
                    Connect
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-heading text-base font-bold text-slate-900">Connect provider</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-400">Paste a provider key once. CostPilot tests it server-side and never returns it to the browser.</p>
          </div>
          <div className="grid gap-3 sm:min-w-[420px] sm:grid-cols-[160px_1fr]">
              <select
                value={selectedProvider}
                onChange={(event) => {
                  const provider = event.target.value as RealProviderName
                  setSelectedProvider(provider)
                  setSelectedModel(defaultModelForProvider(provider))
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary"
              >
              {realProviderCards.map((provider) => (
                <option key={provider.provider} value={provider.provider}>{provider.label}</option>
              ))}
            </select>
            <input
              type="password"
              value={providerApiKey}
              onChange={(event) => setProviderApiKey(event.target.value)}
              placeholder={`${selectedProviderConfig?.label ?? 'Provider'} API key`}
              autoComplete="off"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={async () => {
                await onAddProvider?.(selectedProvider, providerApiKey)
                setProviderApiKey('')
                setIntegrationOpen(true)
              }}
              disabled={savingProvider || !onAddProvider || !selectedProviderConfig?.supported || !providerApiKey.trim()}
              className="button-primary justify-center disabled:opacity-60 sm:col-span-2"
            >
              {savingProvider ? <LoaderCircle size={14} className="animate-spin" /> : <PlugZap size={14} />}
              {savingProvider ? 'Testing...' : 'Test & Connect'}
            </button>
          </div>
        </div>
      </div>

      {!connections.length ? (
        <EmptyState title="No providers connected yet." description="Choose DeepSeek or Gemini, test a key, then copy the CostPilot integration snippet into your AI workflow." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {connections.map((connection) => {
            const spend = data?.provider_spend.find((row) => row.provider === connection.provider)
            const providerUsage = (liveUsage ?? []).filter((row) => row.provider === connection.provider)
            const models = [...new Set(providerUsage.map((row) => row.model_name ?? row.service_name))]
            const latestUsageAt = providerUsage
              .map((row) => row.usage_at)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
            const limit = data?.provider_usage_limits?.find((row) => row.provider_connection_id === connection.id)
            return (
              <article key={connection.id} className={`rounded-xl border bg-white p-5 sm:p-6 ${activeConnection?.id === connection.id ? 'border-primary' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => setSelectedConnectionId(connection.id)} className="text-left">
                    <h2 className="font-heading text-base font-bold text-slate-900">{formatProvider(connection.provider)}</h2>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{connection.external_reference ?? connection.connection_mode ?? 'Server-side connection'}</p>
                  </button>
                  <StatusBadge label={connection.connection_status} />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <MetricCard label="Spend" value={formatUsageCost(spend?.spend ?? 0)} />
                  <MetricCard label="Records" value={formatNumber(spend?.usage_record_count ?? providerUsage.length)} />
                  <MetricCard label="Tokens" value={formatNumber(providerUsage.reduce((sum, row) => sum + row.usage_quantity, 0))} />
                  <MetricCard label="Requests" value={formatNumber(providerUsage.length)} />
                </div>
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">Last activity</p>
                  <p className="mt-1 font-mono text-xs text-slate-600">{formatDateTime(connection.last_synced_at ?? latestUsageAt ?? null)}</p>
                  <p className="mt-2 font-mono text-[10px] text-slate-400">Models: {models.length ? models.join(', ') : 'Not attributed yet'}</p>
                </div>
                <div className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-3">
                  {limit ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">{formatStateLabel(limit.limit_period)} {formatStateLabel(limit.limit_type)} limit</p>
                        <StatusBadge label={limit.status} />
                      </div>
                      <p className="mt-2 font-heading text-lg font-bold text-slate-900">{formatLimitAmount(limit.limit_type, limit.used_amount)} used</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">{formatLimitAmount(limit.limit_type, limit.remaining_amount)} remaining of {formatLimitAmount(limit.limit_type, limit.limit_amount)} · {limit.consumed_percentage.toFixed(3)}%</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-400">{usageRunway(limit)}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-400">Resets {formatDateTime(limit.period_end)}</p>
                    </>
                  ) : (
                    <p className="font-mono text-xs text-slate-500">No usage limit configured.</p>
                  )}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {connection.connection_status === 'connected' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedConnectionId(connection.id)
                          setSelectedProvider(connection.provider as RealProviderName)
                          setSelectedModel(defaultModelForProvider(connection.provider))
                          setIntegrationOpen(true)
                        }}
                        className="button-primary px-3 py-2"
                      >
                        Integrate CostPilot
                      </button>
                      <button type="button" onClick={() => void onDisconnectProvider?.(connection.id)} disabled={savingProvider || !onDisconnectProvider} className="button-secondary px-3 py-2">Disconnect</button>
                    </>
                  ) : (
                    <>
                      <input
                        type="password"
                        value={reconnectKeys[connection.id] ?? ''}
                        onChange={(event) => setReconnectKeys((current) => ({ ...current, [connection.id]: event.target.value }))}
                        placeholder={`${formatProvider(connection.provider)} API key`}
                        autoComplete="off"
                        className="min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await onReconnectProvider?.(connection.id, reconnectKeys[connection.id] ?? '')
                          setReconnectKeys((current) => ({ ...current, [connection.id]: '' }))
                          setIntegrationOpen(true)
                        }}
                        disabled={savingProvider || !onReconnectProvider || !(reconnectKeys[connection.id] ?? '').trim()}
                        className="button-primary px-3 py-2"
                      >
                        Reconnect
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const confirmed = window.confirm('Remove this provider connection from active management? Historical CostPilot usage and cost telemetry will remain available.')
                      if (confirmed) void onRemoveProvider?.(connection.id)
                    }}
                    disabled={savingProvider || !onRemoveProvider}
                    className="button-secondary px-3 py-2"
                  >
                    Remove
                  </button>
                  <button type="button" onClick={() => setSelectedConnectionId(connection.id)} className="button-secondary px-3 py-2">Set usage limit</button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {activeConnection ? (
        <div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="font-heading text-base font-bold text-slate-900">Set usage limit</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-400">{formatProvider(activeConnection.provider)} quota guardrail</p>
            <div className="mt-5 grid gap-3">
              <label className="font-mono text-[11px] text-slate-500">Limit type<select value={limitType} onChange={(event) => setLimitType(event.target.value as ProviderLimitPayload['limit_type'])} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"><option value="tokens">Tokens</option><option value="requests">API requests</option><option value="cost_credits">Cost credits</option></select></label>
              <label className="font-mono text-[11px] text-slate-500">Allowance<input value={limitAmount} onChange={(event) => setLimitAmount(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary" /></label>
              <label className="font-mono text-[11px] text-slate-500">Period<select value={limitPeriod} onChange={(event) => setLimitPeriod(event.target.value as ProviderLimitPayload['limit_period'])} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
              <label className="font-mono text-[11px] text-slate-500">Alert threshold %<input value={limitThreshold} onChange={(event) => setLimitThreshold(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary" /></label>
              <label className="flex items-center gap-2 font-mono text-[11px] text-slate-500"><input type="checkbox" checked={limitEnabled} onChange={(event) => setLimitEnabled(event.target.checked)} /> Enabled</label>
            </div>
            <button
              type="button"
              onClick={() => void onSaveProviderLimit?.({
                provider_connection_id: activeConnection.id,
                limit_type: limitType,
                limit_amount: Number(limitAmount),
                limit_period: limitPeriod,
                threshold_percentage: Number(limitThreshold),
                enabled: limitEnabled,
              })}
              disabled={savingProviderLimit || !onSaveProviderLimit}
              className="button-primary mt-5 w-full justify-center"
            >
              {savingProviderLimit ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {savingProviderLimit ? 'Saving limit' : 'Save usage limit'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="font-heading text-base font-bold text-slate-900">Provider detail</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-400">Recent real runs, workflow attribution, and quota state</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Provider" value={formatProvider(activeConnection.provider)} />
              <MetricCard label="Status" value={formatStateLabel(activeConnection.connection_status)} />
              <MetricCard label="Gateway" value={activeConnection.external_reference ?? activeConnection.connection_mode ?? 'Server-side'} />
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
                    <th className="pb-3">Time</th>
                    <th className="pb-3">Workflow</th>
                    <th className="pb-3">Model</th>
                    <th className="pb-3">Tokens</th>
                    <th className="pb-3">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(liveUsage ?? []).filter((row) => row.provider === activeConnection.provider).slice(0, 5).map((row) => (
                    <tr key={row.id} className="font-mono text-xs text-slate-600">
                      <td className="py-3">{formatDateTime(row.usage_at)}</td>
                      <td className="py-3">{readLiveMetadata(row, 'workflow') ?? 'Unattributed'}</td>
                      <td className="py-3">{row.model_name ?? row.service_name}</td>
                      <td className="py-3">{formatNumber(row.usage_quantity)}</td>
                      <td className="py-3 font-bold text-slate-900">{formatUsageCost(row.calculated_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!(liveUsage ?? []).some((row) => row.provider === activeConnection.provider) ? (
              <p className="mt-4 font-mono text-xs text-slate-500">No recent runs for this provider yet.</p>
            ) : null}
          </div>

        </div>
      ) : null}

      {integrationOpen && activeConnection ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_-40px_rgba(15,23,42,.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-primary">n8n Integration</p>
                <h2 className="mt-2 font-heading text-xl font-bold tracking-tight text-slate-950">Instrument Your AI Workflow</h2>
                <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-slate-600">
                  Paste this configuration into an n8n HTTP Request node after your AI call so CostPilot can attribute usage by provider, model, workflow, execution, node, and business action.
                </p>
              </div>
              <button type="button" onClick={() => setIntegrationOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close integration modal">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(90vh-96px)] overflow-auto p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Provider" value={formatProvider(activeProvider)} />
                <MetricCard label="Selected model" value={activeModel} />
                <MetricCard label="Workspace" value={data?.account.slug ?? data?.account.name ?? 'Workspace'} />
                <MetricCard label="Integration type" value="n8n" />
              </div>
              <label className="mt-5 block max-w-sm font-mono text-[11px] text-slate-500">
                Model
                <input
                  value={activeModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
                />
              </label>
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-heading text-sm font-bold text-slate-900">Copy for n8n</h3>
                    <p className="mt-1 font-mono text-[11px] leading-5 text-slate-500">Use the ingest key only from n8n/server environment variables. No provider or Supabase secrets are included.</p>
                  </div>
                  <button type="button" onClick={() => void copyText(n8nSnippet, 'n8n')} className="button-secondary justify-center px-3 py-2">
                    {copiedSnippet === 'n8n' ? 'Copied' : 'Copy for n8n'}
                  </button>
                </div>
                <pre className="mt-4 max-h-[420px] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-[11px] leading-5 text-slate-100">{n8nSnippet}</pre>
              </div>
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={() => setIntegrationOpen(false)} className="button-secondary px-4 py-2">Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function RealBudgetsSection({
  data,
  budgetAmount,
  budgetThreshold,
  onBudgetAmountChange,
  onBudgetThresholdChange,
  onSaveBudget,
  savingBudget,
}: {
  data: DashboardPayload | null
  budgetAmount: string
  budgetThreshold: string
  onBudgetAmountChange: (value: string) => void
  onBudgetThresholdChange: (value: string) => void
  onSaveBudget?: (() => void | Promise<void>) | null
  savingBudget: boolean
}) {
  const hasBudget = Number(data?.overview?.budget_amount ?? 0) > 0
  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-[1fr_.85fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-heading text-base font-bold text-slate-900">Current budget</h2>
        <p className="mt-1 font-mono text-[11px] text-slate-400">Persisted account-level monthly budget</p>
        {hasBudget ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Budget" value={formatCurrency(Number(data?.overview.budget_amount ?? 0))} />
            <MetricCard label="Consumed" value={`${Number(data?.overview.budget_used_percentage ?? 0).toFixed(1)}%`} />
            <MetricCard label="Variance" value={formatCurrency(Number(data?.overview.projected_budget_variance ?? 0))} tone={Number(data?.overview.projected_budget_variance ?? 0) > 0 ? 'warning' : 'neutral'} />
          </div>
        ) : (
          <p className="mt-4 font-mono text-xs text-slate-500">No budget is configured yet. Create one to enable threshold and projected-overrun signals.</p>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-heading text-base font-bold text-slate-900">{hasBudget ? 'Update budget' : 'Create budget'}</h2>
        <div className="mt-5 grid gap-3">
          <label className="font-mono text-[11px] text-slate-500">Monthly budget<input value={budgetAmount} onChange={(event) => onBudgetAmountChange(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary" /></label>
          <label className="font-mono text-[11px] text-slate-500">Threshold percentage<input value={budgetThreshold} onChange={(event) => onBudgetThresholdChange(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary" /></label>
        </div>
        <button onClick={() => void onSaveBudget?.()} disabled={savingBudget || !onSaveBudget} className="button-primary mt-5 w-full justify-center">
          {savingBudget ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {savingBudget ? 'Saving budget' : 'Save budget'}
        </button>
      </div>
    </section>
  )
}

function RealAlertsSection({
  data,
  onResolveAlert,
}: {
  data: DashboardPayload | null
  onResolveAlert?: (alertId: string) => void | Promise<void>
}) {
  const alerts = data?.alerts ?? []
  if (!alerts.length) {
    return <section className="mt-8"><EmptyState title="No alerts" description="CostPilot will surface budget threshold, projected overspend, and spend spike alerts when real usage crosses a rule." /></section>
  }

  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-2">
      {alerts.map((alert) => (
        <article key={alert.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={alert.severity} />
            <StatusBadge label={alert.status ?? 'open'} />
          </div>
          <h2 className="mt-4 font-heading text-lg font-bold text-slate-900">{formatStateLabel(alert.alert_type)}</h2>
          <p className="mt-2 font-mono text-xs text-slate-500">Observed {alert.observed_value == null ? 'value unavailable' : formatUsageCost(alert.observed_value)} against {alert.threshold_value == null ? 'no threshold' : formatUsageCost(alert.threshold_value)}.</p>
          <button type="button" onClick={() => void onResolveAlert?.(alert.id)} disabled={!onResolveAlert || (alert.status ?? 'open') === 'resolved'} className="button-primary mt-5 justify-center">Resolve</button>
        </article>
      ))}
    </section>
  )
}

function RealRecommendationsSection({
  data,
  onDismissRecommendation,
}: {
  data: DashboardPayload | null
  onDismissRecommendation?: (recommendationId: string) => void | Promise<void>
}) {
  const recommendations = data?.recommendations ?? []
  if (!recommendations.length) {
    return <section className="mt-8"><EmptyState title="No recommendations" description="Optimization recommendations will appear after CostPilot has enough spend concentration, budget, or anomaly context." /></section>
  }

  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-3">
      {recommendations.map((recommendation) => (
        <article key={recommendation.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-lg font-bold text-slate-900">{recommendation.title}</h2>
            <StatusBadge label={recommendation.status ?? recommendation.priority} />
          </div>
          <p className="mt-3 font-mono text-xs leading-5 text-slate-500">{recommendation.summary}</p>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-[11px] text-slate-500">
            <p>{formatProvider(recommendation.provider ?? 'account')} {recommendation.model_name ? `/ ${recommendation.model_name}` : ''}</p>
            <p className="mt-1">Observed: {recommendation.observed_value == null ? 'Not available' : formatUsageCost(recommendation.observed_value)}</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" disabled className="button-secondary justify-center opacity-60">Apply requires provider automation</button>
            <button type="button" onClick={() => void onDismissRecommendation?.(recommendation.id)} disabled={!onDismissRecommendation || (recommendation.status ?? 'open') !== 'open'} className="button-primary justify-center">Dismiss</button>
          </div>
        </article>
      ))}
    </section>
  )
}

function compactLiveUsage(liveUsage?: LiveAiUsageRecord[]) {
  const rows = liveUsage ?? []
  const tokens = rows.reduce((sum, row) => sum + row.usage_quantity, 0)
  const cost = rows.reduce((sum, row) => sum + row.calculated_cost, 0)
  const latest = [...rows].sort((a, b) => new Date(b.usage_at).getTime() - new Date(a.usage_at).getTime())[0] ?? null
  return { rows, tokens, cost, latest }
}

function DashboardHeader({
  data,
  userBadge,
  userEmail,
  onLogout,
  toolbarActions,
  onRunIntegrationTest,
  runningIntegrationTest,
}: {
  data: DashboardPayload | null
  userBadge: string
  userEmail?: string | null
  onLogout?: (() => void | Promise<void>) | null
  toolbarActions?: ReactNode
  onRunIntegrationTest?: (() => void | Promise<void>) | null
  runningIntegrationTest?: boolean
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-background/90 px-5 py-4 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading text-xl font-bold tracking-tight text-slate-950">CostPilot</p>
          <p className="font-mono text-[11px] text-slate-500">AI workflow cost intelligence</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[.12em] text-slate-600">
            {formatProvider(data?.plan?.current_plan_id ?? 'free')} Plan
          </span>
          {onRunIntegrationTest ? (
            <button type="button" onClick={() => void onRunIntegrationTest()} disabled={runningIntegrationTest} className="button-primary px-3 py-2">
              {runningIntegrationTest ? <LoaderCircle size={14} className="animate-spin" /> : <PlugZap size={14} />}
              {runningIntegrationTest ? 'Running' : 'Run Test'}
            </button>
          ) : null}
          {toolbarActions}
          {onLogout ? (
            <button type="button" onClick={() => void onLogout()} className="button-secondary px-3 py-2">Log out</button>
          ) : null}
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-cyan-400 font-mono text-[10px] font-bold text-white" title={userEmail ?? undefined}>
            {userBadge}
          </div>
        </div>
      </div>
    </header>
  )
}

function KpiRow({ data, liveUsage }: { data: DashboardPayload | null; liveUsage?: LiveAiUsageRecord[] }) {
  const usage = compactLiveUsage(liveUsage)
  const activeProvider = [...(data?.connections ?? [])]
    .filter((connection) => connection.connection_status === 'connected')
    .sort((a, b) => new Date(b.connected_at ?? b.last_synced_at ?? 0).getTime() - new Date(a.connected_at ?? a.last_synced_at ?? 0).getTime())[0]?.provider
  const avgCost = usage.rows.length ? usage.cost / usage.rows.length : 0

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Current Spend" value={formatUsageCost(Number(data?.overview?.current_month_spend ?? usage.cost))} note="This month" />
      <MetricCard label="Tokens" value={formatNumber(usage.tokens)} note={usage.rows.length ? 'Tracked usage' : 'No usage yet'} />
      <MetricCard label="Workflow Runs" value={formatNumber(usage.rows.length)} note="Recorded executions" />
      <MetricCard label="Active Provider" value={activeProvider ? formatProvider(activeProvider) : 'None'} note={data?.connections.length ? 'Connected' : 'Connect one'} />
      <MetricCard label="Avg Cost / Run" value={formatUsageCost(avgCost)} note="Real telemetry" />
    </section>
  )
}

function UsageTrend({ liveUsage }: { liveUsage?: LiveAiUsageRecord[] }) {
  const rows = [...(liveUsage ?? [])].sort((a, b) => new Date(a.usage_at).getTime() - new Date(b.usage_at).getTime()).slice(-10)
  const maxTokens = Math.max(...rows.map((row) => row.usage_quantity), 1)
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100
    const y = 88 - (row.usage_quantity / maxTokens) * 72
    return { x, y, row }
  })
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPoints = points.length ? `0,96 ${linePoints} 100,96` : ''

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-42px_rgba(15,23,42,.4)] sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-950">Usage / Cost Trend</h2>
          <p className="mt-1 font-mono text-[11px] text-slate-400">Recent tracked runs</p>
        </div>
        <LineChart size={18} className="text-primary" />
      </div>
      {rows.length ? (
        <div className="mt-8">
          <svg viewBox="0 0 100 100" className="h-64 w-full overflow-visible">
            <defs>
              <linearGradient id="usage-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(67, 82, 255)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="rgb(34, 211, 238)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill="url(#usage-area)" />
            <polyline points={linePoints} fill="none" stroke="rgb(67, 82, 255)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point) => (
              <circle key={point.row.id} cx={point.x} cy={point.y} r="2.4" fill="white" stroke="rgb(67, 82, 255)" strokeWidth="1.8" />
            ))}
          </svg>
          <div className="mt-3 flex justify-between font-mono text-[10px] text-slate-400">
            <span>{formatDateTime(rows[0]?.usage_at ?? null)}</span>
            <span>{formatDateTime(rows.at(-1)?.usage_at ?? null)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid h-64 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 font-mono text-xs text-slate-500">No usage yet</div>
      )}
    </div>
  )
}

function UsageBreakdown({ data, liveUsage }: { data: DashboardPayload | null; liveUsage?: LiveAiUsageRecord[] }) {
  const rows = liveUsage ?? []
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.provider, (totals.get(row.provider) ?? 0) + row.usage_quantity)
  for (const connection of data?.connections ?? []) {
    if (connection.connection_status === 'connected' && !totals.has(connection.provider)) totals.set(connection.provider, 0)
  }
  const breakdown = [...totals.entries()]
  const max = Math.max(...breakdown.map(([, value]) => Number(value)), 1)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-42px_rgba(15,23,42,.4)] sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-950">Usage Breakdown</h2>
          <p className="mt-1 font-mono text-[11px] text-slate-400">By provider</p>
        </div>
        <CircleDollarSign size={18} className="text-primary" />
      </div>
      <div className="mt-8 space-y-5">
        {breakdown.length ? breakdown.map(([provider, value]) => (
          <div key={provider}>
            <div className="flex justify-between font-mono text-xs">
              <span className="font-bold text-slate-700">{formatProvider(provider)}</span>
              <span className="text-slate-500">{formatNumber(Number(value))}</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400" style={{ width: `${Math.max((Number(value) / max) * 100, 8)}%` }} />
            </div>
          </div>
        )) : (
          <div className="grid h-64 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 font-mono text-xs text-slate-500">No provider usage yet</div>
        )}
      </div>
    </div>
  )
}

function WorkflowActivity({ liveUsage }: { liveUsage?: LiveAiUsageRecord[] }) {
  const rows = [...(liveUsage ?? [])].sort((a, b) => new Date(b.usage_at).getTime() - new Date(a.usage_at).getTime()).slice(0, 6)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-42px_rgba(15,23,42,.4)] sm:p-6">
      <h2 className="font-heading text-lg font-bold text-slate-950">AI Workflow Activity</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-slate-100 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
              <th className="pb-3">Workflow</th>
              <th className="pb-3">Provider</th>
              <th className="pb-3">Model</th>
              <th className="pb-3">Tokens</th>
              <th className="pb-3">Cost</th>
              <th className="pb-3">Last Run</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="font-mono text-xs text-slate-600">
                <td className="py-4 font-heading text-sm font-bold text-slate-900">{readLiveMetadata(row, 'workflow') ?? 'AI workflow'}</td>
                <td className="py-4">{formatProvider(row.provider)}</td>
                <td className="py-4">{row.model_name ?? row.service_name}</td>
                <td className="py-4">{formatNumber(row.usage_quantity)}</td>
                <td className="py-4 font-bold text-slate-900">{formatUsageCost(row.calculated_cost)}</td>
                <td className="py-4">{formatDateTime(row.usage_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="mt-5 font-mono text-xs text-slate-500">No usage yet</p> : null}
      </div>
    </section>
  )
}

function ProductSignalCard({ data }: { data: DashboardPayload | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-42px_rgba(15,23,42,.4)] sm:p-6">
      <h2 className="font-heading text-lg font-bold text-slate-950">Product Signal</h2>
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between"><span className="font-mono text-xs text-slate-500">Activation</span><b className="font-heading text-slate-950">{data?.activation?.activation_score ?? 0}</b></div>
        <div className="flex items-center justify-between"><span className="font-mono text-xs text-slate-500">Provider</span><StatusBadge label={data?.activation?.provider_connected ? 'connected' : 'pending'} /></div>
        <div className="flex items-center justify-between"><span className="font-mono text-xs text-slate-500">Usage</span><StatusBadge label={data?.activation?.usage_synced ? 'synced' : 'pending'} /></div>
        <div className="flex items-center justify-between"><span className="font-mono text-xs text-slate-500">PQL</span><StatusBadge label="pending" /></div>
      </div>
    </div>
  )
}

function CompactIntegrationsCard({
  data,
  liveUsage,
  onAddProvider,
  onDisconnectProvider,
  onReconnectProvider,
  savingProvider,
}: {
  data: DashboardPayload | null
  liveUsage?: LiveAiUsageRecord[]
  onAddProvider?: (provider: RealProviderName, apiKey: string) => void | Promise<void>
  onDisconnectProvider?: (connectionId: string) => void | Promise<void>
  onReconnectProvider?: (connectionId: string, apiKey: string) => void | Promise<void>
  savingProvider?: boolean
}) {
  const [provider, setProvider] = useState<RealProviderName>('gemini')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(defaultModelForProvider('gemini'))
  const [integrationOpen, setIntegrationOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const connections = data?.connections ?? []
  const activeConnection = connections.find((connection) => connection.provider === provider) ?? connections[0] ?? null
  const activeProvider = (activeConnection?.provider ?? provider) as RealProviderName
  const snippet = buildN8nSnippet(data, activeProvider, model)
  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-42px_rgba(15,23,42,.4)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-950">Integrations</h2>
          <p className="mt-1 font-mono text-[11px] text-slate-400">Gemini and DeepSeek</p>
        </div>
        <StatusBadge label={connections.some((connection) => connection.connection_status === 'connected') ? 'connected' : 'pending'} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {supportedRealProviders.map((item) => {
          const connection = connections.find((row) => row.provider === item.provider)
          const providerUsage = (liveUsage ?? []).filter((row) => row.provider === item.provider)
          return (
            <div key={item.provider} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-heading text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">{providerUsage[0]?.model_name ?? defaultModelForProvider(item.provider)}</p>
                </div>
                <StatusBadge label={connection?.connection_status ?? 'disconnected'} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {connection?.connection_status === 'connected' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setProvider(item.provider)
                        setModel(defaultModelForProvider(item.provider))
                        setIntegrationOpen(true)
                      }}
                      className="button-primary px-3 py-2"
                    >
                      Integrate
                    </button>
                    <button type="button" onClick={() => void onDisconnectProvider?.(connection.id)} disabled={savingProvider || !onDisconnectProvider} className="button-secondary px-3 py-2">Disconnect</button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setProvider(item.provider)
                      setModel(defaultModelForProvider(item.provider))
                    }}
                    className="button-secondary px-3 py-2"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[150px_1fr_auto]">
        <select
          value={provider}
          onChange={(event) => {
            const nextProvider = event.target.value as RealProviderName
            setProvider(nextProvider)
            setModel(defaultModelForProvider(nextProvider))
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary"
        >
          <option value="gemini">Gemini</option>
          <option value="deepseek">DeepSeek</option>
        </select>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={`${formatProvider(provider)} API key`}
          autoComplete="off"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={async () => {
            const existing = connections.find((connection) => connection.provider === provider)
            if (existing) await onReconnectProvider?.(existing.id, apiKey)
            else await onAddProvider?.(provider, apiKey)
            setApiKey('')
            setIntegrationOpen(true)
          }}
          disabled={savingProvider || !apiKey.trim() || (!onAddProvider && !onReconnectProvider)}
          className="button-primary justify-center disabled:opacity-60"
        >
          {savingProvider ? <LoaderCircle size={14} className="animate-spin" /> : <PlugZap size={14} />}
          Test & Connect
        </button>
      </div>

      {integrationOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_-40px_rgba(15,23,42,.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-primary">Copy for n8n</p>
                <h2 className="mt-2 font-heading text-xl font-bold text-slate-950">Instrument Your AI Workflow</h2>
              </div>
              <button type="button" onClick={() => setIntegrationOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close integration modal">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(90vh-90px)] overflow-auto p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard label="Provider" value={formatProvider(activeProvider)} />
                <MetricCard label="Model" value={model} />
                <MetricCard label="Workspace" value={data?.account.slug ?? 'Workspace'} />
              </div>
              <label className="mt-5 block max-w-sm font-mono text-[11px] text-slate-500">
                Model
                <input value={model} onChange={(event) => setModel(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary" />
              </label>
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-heading text-sm font-bold text-slate-900">HTTP Request configuration</p>
                  <button type="button" onClick={() => void copySnippet()} className="button-secondary px-3 py-2">{copied ? 'Copied' : 'Copy'}</button>
                </div>
                <pre className="mt-4 max-h-[380px] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-[11px] leading-5 text-slate-100">{snippet}</pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function PlanUsageCard({
  data,
  onStartGrowthCheckout,
  startingCheckout,
}: {
  data: DashboardPayload | null
  onStartGrowthCheckout?: (() => void | Promise<void>) | null
  startingCheckout?: boolean
}) {
  const [open, setOpen] = useState(false)
  const planId = data?.plan?.current_plan_id ?? 'free'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-42px_rgba(15,23,42,.4)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-950">Plan Usage</h2>
          <p className="mt-1 font-mono text-xs text-slate-500">{formatProvider(planId)} Plan</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="button-secondary justify-center">Manage Plan</button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Workflow Runs" value={formatNumber(data?.provider_spend.reduce((sum, row) => sum + row.usage_record_count, 0) ?? 0)} note="Tracked" />
        <MetricCard label="Providers" value={formatNumber(data?.connections.length ?? 0)} note="Connected" />
        <MetricCard label="Usage Tracking" value={(data?.connections.length ?? 0) > 0 ? 'Active' : 'Pending'} note={data?.plan?.plan_status ?? 'active'} />
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,.55)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-primary">Subscription</p>
                <h2 className="mt-2 font-heading text-xl font-bold text-slate-950">Manage Plan</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close plan modal"><X size={18} /></button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {BILLING_PLAN_LIST.map((plan) => (
                <div key={plan.id} className={`rounded-xl border p-4 ${plan.id === planId ? 'border-primary bg-secondary/50' : 'border-slate-200 bg-white'}`}>
                  <p className="font-heading text-sm font-bold text-slate-900">{plan.label.replace('CostPilot ', '')}</p>
                  <p className="mt-3 font-mono text-xs text-slate-500">{plan.id === planId ? 'Current' : plan.id === 'growth' ? 'TEST only' : 'Contact Sales'}</p>
                  {plan.id === 'growth' && plan.id !== planId && onStartGrowthCheckout ? (
                    <button type="button" onClick={() => void onStartGrowthCheckout()} disabled={startingCheckout} className="button-primary mt-4 w-full justify-center">
                      {startingCheckout ? 'Preparing' : 'Open TEST checkout'}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ComingSoonCard() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="font-heading text-lg font-bold text-slate-950">Coming Soon</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {['Budgets', 'Cost Alerts', 'Recommendations', 'More Providers', 'Automated Optimization'].map((item) => (
          <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">{item}</span>
        ))}
      </div>
    </section>
  )
}

function SettingsSection({
  data,
  userEmail,
  onLogout,
  onGoToProviders,
}: {
  data: DashboardPayload | null
  userEmail?: string | null
  onLogout?: (() => void | Promise<void>) | null
  onGoToProviders: () => void
}) {
  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-heading text-base font-bold text-slate-900">Workspace settings</h2>
        <p className="mt-1 font-mono text-[11px] text-slate-400">Real account information for this authenticated workspace</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <MetricCard label="Workspace" value={data?.account.name ?? 'Unavailable'} note={data?.account.onboarding_status ?? 'Status unavailable'} />
          <MetricCard label="Signed in as" value={userEmail ?? data?.profile.email ?? 'Unavailable'} note="Firebase-authenticated user" />
          <MetricCard label="Plan" value={formatProvider(data?.plan?.current_plan_id ?? 'starter')} note={data?.plan?.plan_status ?? 'active'} />
          <MetricCard label="Providers" value={formatNumber(data?.connections.length ?? 0)} note="Managed server-side" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-heading text-base font-bold text-slate-900">Usage controls</h2>
          <p className="mt-2 font-mono text-xs leading-5 text-slate-500">Provider allowances are configured in Providers. Financial budgets are configured in Budgets. CostPilot keeps those controls separate so token/request allowance does not get confused with dollar spend.</p>
          <button type="button" onClick={onGoToProviders} className="button-primary mt-5 w-full justify-center">
            Manage providers <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-heading text-base font-bold text-slate-900">Security</h2>
          <p className="mt-2 font-mono text-xs leading-5 text-slate-500">Provider secrets are not shown in the browser. DeepSeek access is routed through the server-side LiteLLM gateway.</p>
          {onLogout ? (
            <button type="button" onClick={() => void onLogout()} className="button-secondary mt-5 w-full justify-center">
              Log out
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

type DashboardViewProps = {
  data: DashboardPayload | null
  loading?: boolean
  error?: string | null
  userEmail?: string | null
  userBadge?: string
  onLogout?: (() => void | Promise<void>) | null
  toolbarActions?: ReactNode
  demoNotice?: string | null
  readOnly?: boolean
  planIntent?: string | null
  billingNotice?: string | null
  budgetAmount: string
  budgetThreshold: string
  onBudgetAmountChange: (value: string) => void
  onBudgetThresholdChange: (value: string) => void
  onSaveBudget?: (() => void | Promise<void>) | null
  savingBudget?: boolean
  onStartGrowthCheckout?: (() => void | Promise<void>) | null
  startingCheckout?: boolean
  growthCheckoutLabel?: string | null
  onContactSales?: (() => void | Promise<void>) | null
  activeSection?: DashboardSection
  onSectionChange?: (section: DashboardSection) => void
  demoProduct?: DemoProductState | null
  liveUsage?: LiveAiUsageRecord[]
  onConnectDemoProvider?: (providerId: string) => void
  onDisconnectDemoProvider?: (providerId: string) => void
  onCreateDemoBudget?: (budget: Omit<DemoBudget, 'id' | 'current_spend' | 'forecast' | 'enabled'>) => void
  onUpdateDemoBudget?: (budgetId: string, updates: Partial<Pick<DemoBudget, 'amount' | 'threshold_percentage' | 'enabled'>>) => void
  onDeleteDemoBudget?: (budgetId: string) => void
  onResetDemoBudgets?: () => void
  onSetDemoAlertStatus?: (alertId: string, status: DemoAlertStatus) => void
  onSetDemoRecommendationStatus?: (recommendationId: string, status: DemoRecommendationStatus) => void
  onResolveRealAlert?: (alertId: string) => void | Promise<void>
  onDismissRealRecommendation?: (recommendationId: string) => void | Promise<void>
  onAddRealProvider?: (provider: RealProviderName, apiKey: string) => void | Promise<void>
  onDisconnectRealProvider?: (connectionId: string) => void | Promise<void>
  onReconnectRealProvider?: (connectionId: string, apiKey: string) => void | Promise<void>
  onRemoveRealProvider?: (connectionId: string) => void | Promise<void>
  savingProvider?: boolean
  onSaveProviderLimit?: (payload: ProviderLimitPayload) => void | Promise<void>
  savingProviderLimit?: boolean
  onRunIntegrationTest?: (() => void | Promise<void>) | null
  runningIntegrationTest?: boolean
  integrationTestResult?: string | null
}

export function DashboardView({
  data,
  loading = false,
  error,
  userEmail,
  userBadge = 'CP',
  onLogout,
  toolbarActions,
  demoNotice,
  readOnly = false,
  planIntent,
  billingNotice,
  budgetAmount,
  budgetThreshold,
  onBudgetAmountChange,
  onBudgetThresholdChange,
  onSaveBudget,
  savingBudget = false,
  onStartGrowthCheckout,
  startingCheckout = false,
  growthCheckoutLabel,
  onContactSales,
  activeSection = 'overview',
  onSectionChange,
  demoProduct,
  liveUsage,
  onConnectDemoProvider,
  onDisconnectDemoProvider,
  onCreateDemoBudget,
  onUpdateDemoBudget,
  onDeleteDemoBudget,
  onResetDemoBudgets,
  onSetDemoAlertStatus,
  onSetDemoRecommendationStatus,
  onResolveRealAlert,
  onDismissRealRecommendation,
  onAddRealProvider,
  onDisconnectRealProvider,
  onReconnectRealProvider,
  onRemoveRealProvider,
  savingProvider = false,
  onSaveProviderLimit,
  savingProviderLimit = false,
  onRunIntegrationTest,
  runningIntegrationTest = false,
  integrationTestResult,
}: DashboardViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [internalActiveSection, setInternalActiveSection] = useState<DashboardSection>(activeSection)
  const currentSection = onSectionChange ? activeSection : internalActiveSection
  const changeSection = (section: DashboardSection) => {
    if (onSectionChange) {
      onSectionChange(section)
      return
    }
    setInternalActiveSection(section)
  }

  if (loading) return <div className="p-4">Loading...</div>

  const workspaceBudget = demoProduct?.budgets.find((budget) => budget.scope === 'workspace') ?? null
  const currentSpend = workspaceBudget?.current_spend ?? Number(data?.overview?.current_month_spend ?? 0)
  const projectedSpend = Math.max((workspaceBudget?.forecast ?? Number(data?.overview?.projected_month_end_spend ?? 0)) - (demoProduct?.forecast_reduction ?? 0), 0)
  const budgetAmountValue = workspaceBudget?.amount ?? Number(data?.overview?.budget_amount ?? 0)
  const budgetUsedPercentage = budgetAmountValue > 0 ? (currentSpend / budgetAmountValue) * 100 : Number(data?.overview?.budget_used_percentage ?? 0)
  const activeDemoAlerts = demoProduct?.alerts.filter((alert) => alert.status === 'active') ?? []
  const liveRunCount = liveUsage?.length ?? 0
  const liveTotalCost = liveUsage?.reduce((sum, row) => sum + row.calculated_cost, 0) ?? 0
  const liveAverageCost = liveRunCount > 0 ? liveTotalCost / liveRunCount : 0
  const liveAverageLatency = liveRunCount > 0
    ? Math.round(liveUsage!.reduce((sum, row) => sum + Number(readLiveMetadata(row, 'latency_ms') ?? 0), 0) / liveRunCount)
    : 0
  const topServices = data?.service_spend.slice(0, 4) ?? []
  const sectionTitle = currentSection === 'overview' ? 'Dashboard' : currentSection === 'usage' ? 'Usage / Costs' : formatStateLabel(currentSection)
  const sectionDescription =
    currentSection === 'overview'
      ? 'AI workflow spend, forecast, budget risk, providers, alerts, and optimization opportunities.'
    : currentSection === 'workflows'
        ? demoProduct ? 'Synthetic AI workflow runs, cost-bearing steps, tokens, and latency.' : 'Real workflow runs derived from usage_records metadata.'
        : currentSection === 'usage'
          ? demoProduct ? 'Synthetic provider, model, request, token, and cost attribution.' : 'Real provider, model, token, timestamp, and cost attribution.'
          : currentSection === 'providers'
            ? demoProduct ? 'Synthetic provider connections for the recruiter demo workspace.' : 'Real provider connections from provider_connections.'
            : currentSection === 'budgets'
              ? demoProduct ? 'Create and adjust synthetic cost guardrails for workspace, provider, and workflow spend.' : 'Create or update real account-level cost guardrails.'
              : currentSection === 'alerts'
                ? demoProduct ? 'Resolve, snooze, and reopen synthetic budget, anomaly, token, and retry-cost alerts.' : 'Real budget, projection, and spend-spike alerts.'
                : currentSection === 'recommendations'
                  ? demoProduct ? 'Apply or dismiss simulated optimization actions and watch financial state update.' : 'Real optimization recommendations from product intelligence.'
                  : 'Workspace, plan, provider, usage-control, and security settings.'

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        open={sidebarOpen}
        activeSection={currentSection}
        onSectionChange={changeSection}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen ? <button className="fixed inset-0 z-20 bg-slate-950/20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" /> : null}
      <div className="min-w-0 flex-1">
        {!demoProduct ? (
          <DashboardHeader
            data={data}
            userBadge={userBadge}
            userEmail={userEmail}
            onLogout={onLogout}
            toolbarActions={toolbarActions}
            onRunIntegrationTest={onRunIntegrationTest}
            runningIntegrationTest={runningIntegrationTest}
          />
        ) : (
        <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open navigation">
              <Menu size={19} />
            </button>
            <div>
              <p className="font-heading text-sm font-bold text-slate-900">{data?.account.name ?? 'CostPilot Workspace'}</p>
              <p className="font-mono text-[10px] text-slate-400">{readOnly ? 'Read-only demo workspace' : 'Product intelligence workspace'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {onLogout ? (
              <button type="button" onClick={() => void onLogout()} className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-slate-500 hover:text-primary">
                Log out
              </button>
            ) : (
              <Link href="/signup" className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-slate-500 hover:text-primary">
                Create workspace
              </Link>
            )}
            <Bell size={17} className="text-slate-400" />
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-cyan-400 font-mono text-[10px] font-bold text-white" title={userEmail ?? undefined}>
              {userBadge}
            </div>
          </div>
        </header>
        )}

        <main className="mx-auto max-w-[1450px] p-5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">
                <i className="h-1.5 w-1.5 rounded-full bg-primary" />
                Product intelligence
              </p>
              <h1 className="mt-3 font-heading text-3xl font-bold tracking-[-.04em] text-slate-950 sm:text-4xl">{sectionTitle}</h1>
              <p className="mt-2 font-mono text-xs text-slate-500">{sectionDescription}</p>
              {demoNotice ? <span className="demo-label mt-4 inline-flex">{demoNotice}</span> : null}
            </div>
            {demoProduct && toolbarActions ? <div className="flex flex-wrap gap-3">{toolbarActions}</div> : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 font-mono text-xs text-rose-700">{error}</div>
          ) : null}
          {billingNotice ? (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 font-mono text-xs text-sky-800">{billingNotice}</div>
          ) : null}

          {currentSection === 'overview' && !demoProduct ? (
            <div className="mt-8 space-y-6">
              {integrationTestResult ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-mono text-xs text-emerald-700">
                  {integrationTestResult.replace('Integration test ', '').replace(' were attributed to this workspace.', ' tracked successfully.')}
                </div>
              ) : null}
              <KpiRow data={data} liveUsage={liveUsage} />
              <section className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
                <UsageTrend liveUsage={liveUsage} />
                <UsageBreakdown data={data} liveUsage={liveUsage} />
              </section>
              <WorkflowActivity liveUsage={liveUsage} />
              <section className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
                <CompactIntegrationsCard
                  data={data}
                  liveUsage={liveUsage}
                  onAddProvider={onAddRealProvider}
                  onDisconnectProvider={onDisconnectRealProvider}
                  onReconnectProvider={onReconnectRealProvider}
                  savingProvider={savingProvider}
                />
                <ProductSignalCard data={data} />
              </section>
              <PlanUsageCard data={data} onStartGrowthCheckout={onStartGrowthCheckout} startingCheckout={startingCheckout} />
              <ComingSoonCard />
            </div>
          ) : null}

          {currentSection === 'overview' && demoProduct ? (
            <>
              <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <MetricCard
                  label="Current spend"
                  value={formatCurrency(currentSpend)}
                  note={data?.connections.length ? `${data.connections.length} provider connection${data.connections.length === 1 ? '' : 's'}` : 'No provider connected yet'}
                />
                <MetricCard
                  label="Projected spend"
                  value={formatCurrency(projectedSpend)}
                  note={projectedSpend > budgetAmountValue && budgetAmountValue > 0 ? 'Projected to exceed budget' : 'Deterministic month-end run rate'}
                  tone={projectedSpend > budgetAmountValue && budgetAmountValue > 0 ? 'warning' : 'neutral'}
                />
                <MetricCard
                  label="Budget"
                  value={budgetAmountValue > 0 ? formatCurrency(budgetAmountValue) : 'Not set'}
                  note={budgetAmountValue > 0 ? `${budgetUsedPercentage.toFixed(1)}% consumed` : 'Configure one to unlock threshold alerts'}
                />
                <MetricCard
                  label="Savings"
                  value={demoProduct ? formatCurrency(demoProduct.estimated_savings) : formatCurrency(data?.recommendations.reduce((sum, row) => sum + Number(row.observed_value ?? 0), 0) ?? 0)}
                  note={demoProduct?.captured_savings ? `${formatCurrency(demoProduct.captured_savings)} captured in demo` : 'Open optimization opportunity'}
                />
                <MetricCard
                  label="Workflow runs"
                  value={formatNumber(demoProduct?.total_workflow_runs ?? liveRunCount)}
                  note={demoProduct ? 'Across AI workflows' : 'Real API-sync runs'}
                />
                <MetricCard
                  label="Avg cost / run"
                  value={demoProduct ? formatCurrency(demoProduct.average_cost_per_run) : formatUsageCost(liveAverageCost)}
                  note={`${demoProduct?.average_latency_ms ?? liveAverageLatency}ms avg latency`}
                />
              </section>

              <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_.9fr]">
                <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-secondary to-white p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-primary">Connect and test</p>
                      <h2 className="mt-2 font-heading text-base font-bold text-slate-900">Instrument one AI workflow</h2>
                      <p className="mt-2 font-mono text-xs leading-5 text-slate-600">
                        Connect Gemini or DeepSeek, copy the n8n setup when needed, then run a real Product/PQL integration test with this workspace context passed automatically.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => changeSection('overview')} className="button-secondary justify-center">
                        Dashboard
                      </button>
                      {onRunIntegrationTest ? (
                        <button
                          type="button"
                          onClick={() => void onRunIntegrationTest()}
                          disabled={runningIntegrationTest}
                          className="button-primary justify-center"
                        >
                          {runningIntegrationTest ? <LoaderCircle size={14} className="animate-spin" /> : <PlugZap size={14} />}
                          {runningIntegrationTest ? 'Running test' : 'Run Integration Test'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {integrationTestResult ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-mono text-xs text-emerald-700">
                      {integrationTestResult}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-heading text-base font-bold text-slate-900">Activation / PQL signal</h2>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">Simple product-intelligence summary</p>
                    </div>
                    <Sparkles size={17} className="text-primary" />
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <MetricCard label="Activation score" value={`${data?.activation?.activation_score ?? 0}`} note={data?.activation?.activated ? 'Activated' : 'Not fully activated yet'} />
                    <MetricCard label="Provider connected" value={data?.activation?.provider_connected ? 'Yes' : 'No'} note="Required for product signal" />
                    <MetricCard label="Usage synced" value={data?.activation?.usage_synced ? 'Yes' : 'No'} note="Real telemetry received" />
                    <MetricCard label="PQL status" value="Not yet qualified" note="Lifecycle backend keeps this conservative until enough evidence exists" />
                  </div>
                </div>
              </section>

              {!demoProduct ? (
                <RealProvidersSection
                  data={data}
                  liveUsage={liveUsage}
                  onAddProvider={onAddRealProvider}
                  onDisconnectProvider={onDisconnectRealProvider}
                  onReconnectProvider={onReconnectRealProvider}
                  onRemoveProvider={onRemoveRealProvider}
                  savingProvider={savingProvider}
                  onSaveProviderLimit={onSaveProviderLimit}
                  savingProviderLimit={savingProviderLimit}
                />
              ) : (
                <ProvidersSection
                  data={data}
                  demoProduct={demoProduct}
                  liveUsage={liveUsage}
                  onConnectProvider={onConnectDemoProvider}
                  onDisconnectProvider={onDisconnectDemoProvider}
                />
              )}

              {demoProduct ? <UsageSection demoProduct={demoProduct} liveUsage={liveUsage} /> : <RealUsageSection data={data} liveUsage={liveUsage} />}
              {demoProduct ? <WorkflowsSection demoProduct={demoProduct} liveUsage={liveUsage} /> : <RealWorkflowsSection liveUsage={liveUsage} />}

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
            <SpendChart dailySpend={data?.daily_spend ?? []} />
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-heading text-base font-bold text-slate-900">Spend by provider</h2>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">Current month</p>
                </div>
                <CircleDollarSign size={17} className="text-primary" />
              </div>
              <div className="mt-6 space-y-4">
                {(data?.provider_spend ?? []).length === 0 ? (
                  <p className="font-mono text-xs text-slate-500">No persisted spend yet.</p>
                ) : (
                  (data?.provider_spend ?? []).map((provider) => {
                    const maxSpend = Math.max(...(data?.provider_spend ?? []).map((row) => row.spend), 1)
                    return (
                      <div key={provider.provider}>
                        <div className="flex justify-between font-mono text-[11px]">
                          <span className="text-slate-600">{formatProvider(provider.provider)}</span>
                          <span className="font-bold text-slate-900">{formatCurrency(provider.spend)}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400" style={{ width: `${Math.max((provider.spend / maxSpend) * 100, 8)}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-base font-bold text-slate-900">Active alerts</h2>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">Budget, projection, and spend-spike signals</p>
                </div>
                <Bell size={17} className="text-primary" />
              </div>
              <div className="mt-5 divide-y divide-slate-100">
                {activeDemoAlerts.length === 0 && (data?.alerts ?? []).length === 0 ? (
                  <p className="py-2 font-mono text-xs text-slate-500">No open alerts.</p>
                ) : (
                  activeDemoAlerts.length > 0 ? activeDemoAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs leading-5 text-slate-600">{alert.title}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <StatusBadge label={alert.severity} />
                          <span className="rounded bg-slate-100 px-2 py-1 font-mono text-[9px] font-bold uppercase text-slate-600">{formatCurrency(alert.financial_impact)} impact</span>
                        </div>
                      </div>
                    </div>
                  )) : (data?.alerts ?? []).slice(0, 3).map((alert) => (
                    <div key={alert.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs leading-5 text-slate-600">{alert.alert_type.replaceAll('_', ' ')}</p>
                        <span className="mt-2 inline-block rounded bg-amber-50 px-2 py-1 font-mono text-[9px] font-bold uppercase text-amber-700">{alert.severity}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-base font-bold text-slate-900">Top cost drivers</h2>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">Observed provider and service concentration</p>
                </div>
                <TrendingUp size={17} className="text-primary" />
              </div>
              <div className="mt-5 space-y-4">
                {topServices.length === 0 ? (
                  <p className="font-mono text-xs text-slate-500">{demoProduct ? 'Demo service attribution is not available yet.' : 'Real service-level attribution appears after usage is ingested.'}</p>
                ) : (
                  topServices.map((service) => (
                    <div key={`${service.provider}_${service.service_name}_${service.model_name ?? 'na'}`} className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-xs text-slate-700">{service.service_name}</p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">
                          {formatProvider(service.provider)}
                          {service.model_name ? ` / ${service.model_name}` : ''}
                        </p>
                      </div>
                      <p className="font-heading text-sm font-bold text-slate-900">{formatCurrency(service.spend)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-secondary to-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles size={16} />
                </div>
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-primary">Optimization recommendations</p>
                  <p className="mt-1 font-mono text-xs leading-5 text-slate-600">Derived from observed spend, budget coverage, provider concentration, and recent spikes.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {(demoProduct?.recommendations ?? data?.recommendations ?? []).length === 0 ? (
                  <p className="font-mono text-xs text-slate-500">Recommendations appear after usage sync and cost attribution.</p>
                ) : (
                  demoProduct?.recommendations.slice(0, 3).map((recommendation) => (
                    <div key={recommendation.id} className="rounded-xl border border-white/60 bg-white/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-heading text-sm font-bold text-slate-900">{recommendation.title}</p>
                        <StatusBadge label={recommendation.status} />
                      </div>
                      <p className="mt-2 font-mono text-xs leading-5 text-slate-600">{recommendation.problem}</p>
                    </div>
                  )) ?? (data?.recommendations ?? []).slice(0, 3).map((recommendation) => (
                    <div key={recommendation.id} className="rounded-xl border border-white/60 bg-white/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-heading text-sm font-bold text-slate-900">{recommendation.title}</p>
                        <span className="rounded bg-slate-950 px-2 py-1 font-mono text-[9px] font-bold uppercase text-white">{recommendation.priority}</span>
                      </div>
                      <p className="mt-2 font-mono text-xs leading-5 text-slate-600">{recommendation.summary}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-base font-bold text-slate-900">Budget guardrail</h2>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">{readOnly ? 'Synthetic monthly limit for the demo workspace' : 'Account-level monthly budget and alert threshold'}</p>
                </div>
                <ShieldCheck size={17} className="text-primary" />
              </div>
              <div className="mt-5 grid gap-3">
                <label className="font-mono text-[11px] text-slate-500">
                  Monthly budget
                  <input
                    value={workspaceBudget?.amount ?? budgetAmount}
                    onChange={(event) => onBudgetAmountChange(event.target.value)}
                    disabled={readOnly}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </label>
                <label className="font-mono text-[11px] text-slate-500">
                  Threshold percentage
                  <input
                    value={workspaceBudget?.threshold_percentage ?? budgetThreshold}
                    onChange={(event) => onBudgetThresholdChange(event.target.value)}
                    disabled={readOnly}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </label>
              </div>
              {readOnly ? (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-500">Demo workspace is read-only and uses synthetic budget data.</div>
              ) : (
                <button onClick={() => void onSaveBudget?.()} disabled={savingBudget} className="button-primary mt-5 w-full justify-center">
                  {savingBudget ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  {savingBudget ? 'Saving budget' : 'Save budget'}
                </button>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-base font-bold text-slate-900">Plan and billing</h2>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">Canonical plan catalog and PayU TEST checkout</p>
                </div>
                <Wallet size={17} className="text-primary" />
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Current plan</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="font-heading text-xl font-bold text-slate-900">{formatProvider(data?.plan?.current_plan_id ?? 'starter')}</p>
                  <span className="rounded bg-white px-2 py-1 font-mono text-[9px] font-bold uppercase text-slate-600">{data?.plan?.plan_status ?? 'active'}</span>
                </div>
                {planIntent ? (
                  <p className="mt-3 font-mono text-[11px] text-slate-500">Selected demo plan intent: {formatProvider(planIntent)}.</p>
                ) : null}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {BILLING_PLAN_LIST.map((plan) => (
                  <div key={plan.id} className={`rounded-xl border p-4 ${plan.featured ? 'border-primary bg-secondary/40' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-heading text-sm font-bold text-slate-900">{plan.label.replace('CostPilot ', '')}</p>
                      {plan.featured ? <span className="rounded bg-primary px-2 py-1 font-mono text-[9px] font-bold uppercase text-white">Popular</span> : null}
                    </div>
                    <p className="mt-4 font-heading text-2xl font-bold text-slate-950">
                      {plan.amount === '0.00' ? '$0' : '$99'}
                      {plan.billing_interval === 'monthly' && plan.amount !== '0.00' ? <small className="font-mono text-[10px] font-normal text-slate-400"> / month</small> : null}
                    </p>
                    <p className="mt-2 font-mono text-[11px] leading-5 text-slate-500">{plan.description}</p>
                  </div>
                ))}
              </div>
              {readOnly && !onStartGrowthCheckout && !onContactSales ? (
                <Link href="/signup" className="button-primary mt-5 w-full justify-center">
                  Open your own workspace <ArrowUpRight size={14} />
                </Link>
              ) : (
                <div className="mt-5 space-y-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-800">TEST checkout — no real charge.</div>
                  {onStartGrowthCheckout ? (
                    <button onClick={() => void onStartGrowthCheckout()} disabled={startingCheckout} className="button-primary w-full justify-center">
                      {startingCheckout ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
                      {startingCheckout ? 'Preparing PayU test checkout' : (growthCheckoutLabel ?? 'Start Growth plan test checkout')}
                    </button>
                  ) : null}
                  {onContactSales ? (
                    <button type="button" onClick={() => void onContactSales()} className="button-secondary w-full justify-center">
                      Talk to Sales <ArrowUpRight size={14} />
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-base font-bold text-slate-900">Coming soon</h2>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">Roadmap controls kept out of the main product promise</p>
                </div>
                <Settings size={17} className="text-primary" />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {['Advanced budgets', 'Cost alerts', 'Recommendations', 'More providers', 'Automated optimization'].map((item) => (
                  <span key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">{item}</span>
                ))}
              </div>
            </div>
          </section>
            </>
          ) : null}

          {currentSection === 'workflows' ? (demoProduct ? <WorkflowsSection demoProduct={demoProduct} liveUsage={liveUsage} /> : <RealWorkflowsSection liveUsage={liveUsage} />) : null}
          {currentSection === 'usage' ? (demoProduct ? <UsageSection demoProduct={demoProduct} liveUsage={liveUsage} /> : <RealUsageSection data={data} liveUsage={liveUsage} />) : null}
          {currentSection === 'providers' && demoProduct ? (
            <ProvidersSection
              data={data}
              demoProduct={demoProduct}
              liveUsage={liveUsage}
              onConnectProvider={onConnectDemoProvider}
              onDisconnectProvider={onDisconnectDemoProvider}
            />
          ) : null}
          {currentSection === 'providers' && !demoProduct ? (
            <RealProvidersSection
              data={data}
              liveUsage={liveUsage}
              onAddProvider={onAddRealProvider}
              onDisconnectProvider={onDisconnectRealProvider}
              onReconnectProvider={onReconnectRealProvider}
              onRemoveProvider={onRemoveRealProvider}
              savingProvider={savingProvider}
              onSaveProviderLimit={onSaveProviderLimit}
              savingProviderLimit={savingProviderLimit}
            />
          ) : null}
          {currentSection === 'budgets' && demoProduct ? (
            <BudgetsSection
              demoProduct={demoProduct}
              onCreateBudget={onCreateDemoBudget}
              onUpdateBudget={onUpdateDemoBudget}
              onDeleteBudget={onDeleteDemoBudget}
              onResetBudgets={onResetDemoBudgets}
            />
          ) : null}
          {currentSection === 'budgets' && !demoProduct ? (
            <RealBudgetsSection
              data={data}
              budgetAmount={budgetAmount}
              budgetThreshold={budgetThreshold}
              onBudgetAmountChange={onBudgetAmountChange}
              onBudgetThresholdChange={onBudgetThresholdChange}
              onSaveBudget={onSaveBudget}
              savingBudget={savingBudget}
            />
          ) : null}
          {currentSection === 'alerts' && demoProduct ? (
            <AlertsSection
              demoProduct={demoProduct}
              onSetAlertStatus={onSetDemoAlertStatus}
            />
          ) : null}
          {currentSection === 'alerts' && !demoProduct ? <RealAlertsSection data={data} onResolveAlert={onResolveRealAlert} /> : null}
          {currentSection === 'recommendations' && demoProduct ? (
            <RecommendationsSection
              demoProduct={demoProduct}
              onSetRecommendationStatus={onSetDemoRecommendationStatus}
            />
          ) : null}
          {currentSection === 'recommendations' && !demoProduct ? <RealRecommendationsSection data={data} onDismissRecommendation={onDismissRealRecommendation} /> : null}
          {currentSection === 'settings' ? (
            <SettingsSection
              data={data}
              userEmail={userEmail}
              onLogout={onLogout}
              onGoToProviders={() => changeSection('overview')}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}
