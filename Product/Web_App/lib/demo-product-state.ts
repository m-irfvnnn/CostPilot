'use client'

import { useState } from 'react'
import type { DemoAlertStatus, DemoBudget, DemoProductState, DemoProviderStatus, DemoRecommendationStatus } from './dashboard-types'

const INITIAL_DEMO_STATE: DemoProductState = {
  providers: [
    {
      id: 'deepseek-litellm',
      name: 'DeepSeek',
      provider: 'deepseek',
      status: 'connected',
      connection_label: 'CostPilot Gateway / LiteLLM',
      last_synced_at: '2026-08-29T12:00:00.000Z',
      monthly_spend: 1685,
      requests: 18420,
    },
    {
      id: 'openai-api',
      name: 'OpenAI',
      provider: 'openai',
      status: 'connected',
      connection_label: 'Demo API connection',
      last_synced_at: '2026-08-29T11:45:00.000Z',
      monthly_spend: 4120,
      requests: 22800,
    },
    {
      id: 'anthropic-api',
      name: 'Anthropic',
      provider: 'anthropic',
      status: 'connected',
      connection_label: 'Demo API connection',
      last_synced_at: '2026-08-29T10:20:00.000Z',
      monthly_spend: 2410,
      requests: 14640,
    },
    {
      id: 'google-ai',
      name: 'Gemini',
      provider: 'gemini',
      status: 'not_connected',
      connection_label: 'Not connected',
      last_synced_at: null,
      monthly_spend: 0,
      requests: 0,
    },
    {
      id: 'aws-bedrock',
      name: 'AWS',
      provider: 'aws',
      status: 'not_connected',
      connection_label: 'Not connected',
      last_synced_at: null,
      monthly_spend: 0,
      requests: 0,
    },
  ],
  workflows: [
    {
      id: 'lead-qualification',
      name: 'Lead Qualification',
      provider: 'DeepSeek',
      model: 'deepseek-chat via LiteLLM',
      runs: 842,
      total_tokens: 918400,
      monthly_cost: 384,
      avg_cost_per_run: 0.46,
      latency_ms: 1280,
      status: 'healthy',
      trend: '+18%',
      nodes: ['Validate Lead', 'AI Scoring', 'CRM Update'],
      run_history: [
        {
          id: 'run-lq-1048',
          timestamp: '2026-08-29T11:58:00.000Z',
          provider: 'DeepSeek',
          model: 'deepseek-chat',
          input_tokens: 890,
          output_tokens: 210,
          total_tokens: 1100,
          cost: 0.52,
          latency_ms: 1194,
          status: 'success',
          steps: [
            { name: 'Validate Lead', cost: 0, latency_ms: 84, status: 'success' },
            { name: 'AI Scoring', cost: 0.52, latency_ms: 1010, status: 'success' },
            { name: 'CRM Update', cost: 0, latency_ms: 100, status: 'success' },
          ],
        },
        {
          id: 'run-lq-1047',
          timestamp: '2026-08-29T11:41:00.000Z',
          provider: 'DeepSeek',
          model: 'deepseek-chat',
          input_tokens: 780,
          output_tokens: 190,
          total_tokens: 970,
          cost: 0.45,
          latency_ms: 1266,
          status: 'success',
          steps: [
            { name: 'Validate Lead', cost: 0, latency_ms: 72, status: 'success' },
            { name: 'AI Scoring', cost: 0.45, latency_ms: 1084, status: 'success' },
            { name: 'CRM Update', cost: 0, latency_ms: 110, status: 'success' },
          ],
        },
      ],
    },
    {
      id: 'support-agent',
      name: 'Customer Support Agent',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      runs: 1250,
      total_tokens: 1640000,
      monthly_cost: 920,
      avg_cost_per_run: 0.74,
      latency_ms: 940,
      status: 'healthy',
      trend: '+9%',
      nodes: ['Classify Ticket', 'Draft Reply', 'Escalation Check'],
      run_history: [
        {
          id: 'run-cs-7731',
          timestamp: '2026-08-29T11:50:00.000Z',
          provider: 'OpenAI',
          model: 'gpt-4o-mini',
          input_tokens: 1160,
          output_tokens: 330,
          total_tokens: 1490,
          cost: 0.81,
          latency_ms: 902,
          status: 'success',
          steps: [
            { name: 'Classify Ticket', cost: 0.18, latency_ms: 210, status: 'success' },
            { name: 'Draft Reply', cost: 0.63, latency_ms: 620, status: 'success' },
            { name: 'Escalation Check', cost: 0, latency_ms: 72, status: 'success' },
          ],
        },
      ],
    },
    {
      id: 'research-assistant',
      name: 'Research Assistant',
      provider: 'Anthropic',
      model: 'claude-3-5-sonnet',
      runs: 318,
      total_tokens: 740000,
      monthly_cost: 1180,
      avg_cost_per_run: 3.71,
      latency_ms: 2860,
      status: 'watch',
      trend: '+31%',
      nodes: ['Collect Sources', 'Synthesize', 'Risk Summary'],
      run_history: [
        {
          id: 'run-ra-2810',
          timestamp: '2026-08-29T10:56:00.000Z',
          provider: 'Anthropic',
          model: 'claude-3-5-sonnet',
          input_tokens: 3140,
          output_tokens: 720,
          total_tokens: 3860,
          cost: 4.1,
          latency_ms: 3090,
          status: 'warning',
          steps: [
            { name: 'Collect Sources', cost: 0, latency_ms: 420, status: 'success' },
            { name: 'Synthesize', cost: 4.1, latency_ms: 2490, status: 'warning' },
            { name: 'Risk Summary', cost: 0, latency_ms: 180, status: 'success' },
          ],
        },
      ],
    },
    {
      id: 'outbound-personalization',
      name: 'Outbound Personalization',
      provider: 'DeepSeek',
      model: 'deepseek-chat via LiteLLM',
      runs: 674,
      total_tokens: 504200,
      monthly_cost: 256,
      avg_cost_per_run: 0.38,
      latency_ms: 1105,
      status: 'healthy',
      trend: '-6%',
      nodes: ['Enrich Context', 'Write Email', 'Compliance Check'],
      run_history: [
        {
          id: 'run-op-4412',
          timestamp: '2026-08-29T09:44:00.000Z',
          provider: 'DeepSeek',
          model: 'deepseek-chat',
          input_tokens: 610,
          output_tokens: 180,
          total_tokens: 790,
          cost: 0.31,
          latency_ms: 1042,
          status: 'success',
          steps: [
            { name: 'Enrich Context', cost: 0, latency_ms: 140, status: 'success' },
            { name: 'Write Email', cost: 0.31, latency_ms: 812, status: 'success' },
            { name: 'Compliance Check', cost: 0, latency_ms: 90, status: 'success' },
          ],
        },
      ],
    },
    {
      id: 'document-analysis',
      name: 'Document Analysis',
      provider: 'OpenAI',
      model: 'gpt-4.1-mini',
      runs: 196,
      total_tokens: 620000,
      monthly_cost: 690,
      avg_cost_per_run: 3.52,
      latency_ms: 2140,
      status: 'healthy',
      trend: '+4%',
      nodes: ['Extract Text', 'Summarize', 'Route Finding'],
      run_history: [
        {
          id: 'run-da-1920',
          timestamp: '2026-08-29T08:12:00.000Z',
          provider: 'OpenAI',
          model: 'gpt-4.1-mini',
          input_tokens: 4200,
          output_tokens: 520,
          total_tokens: 4720,
          cost: 3.84,
          latency_ms: 2180,
          status: 'success',
          steps: [
            { name: 'Extract Text', cost: 0, latency_ms: 260, status: 'success' },
            { name: 'Summarize', cost: 3.84, latency_ms: 1780, status: 'success' },
            { name: 'Route Finding', cost: 0, latency_ms: 140, status: 'success' },
          ],
        },
      ],
    },
  ],
  usage: [
    { id: 'usage-deepseek-chat', provider: 'DeepSeek', model: 'deepseek-chat via LiteLLM', workflow: 'Lead Qualification', requests: 1516, tokens: 1422600, cost: 640, avg_cost_per_request: 0.42, mom_change: '+14%' },
    { id: 'usage-openai-4o-mini', provider: 'OpenAI', model: 'gpt-4o-mini', workflow: 'Customer Support Agent', requests: 1250, tokens: 1640000, cost: 920, avg_cost_per_request: 0.74, mom_change: '+9%' },
    { id: 'usage-anthropic-sonnet', provider: 'Anthropic', model: 'claude-3-5-sonnet', workflow: 'Research Assistant', requests: 318, tokens: 740000, cost: 1180, avg_cost_per_request: 3.71, mom_change: '+31%' },
    { id: 'usage-openai-41-mini', provider: 'OpenAI', model: 'gpt-4.1-mini', workflow: 'Document Analysis', requests: 196, tokens: 620000, cost: 690, avg_cost_per_request: 3.52, mom_change: '+4%' },
  ],
  budgets: [
    {
      id: 'budget-workspace-ai',
      name: 'Monthly AI Budget',
      scope: 'workspace',
      target: 'Entire workspace',
      amount: 10000,
      current_spend: 7420,
      forecast: 11180,
      threshold_percentage: 80,
      enabled: true,
    },
    {
      id: 'budget-research-assistant',
      name: 'Research Assistant Guardrail',
      scope: 'workflow',
      target: 'Research Assistant',
      amount: 1500,
      current_spend: 1180,
      forecast: 1840,
      threshold_percentage: 75,
      enabled: true,
    },
    {
      id: 'budget-openai',
      name: 'OpenAI Provider Limit',
      scope: 'provider',
      target: 'OpenAI',
      amount: 2000,
      current_spend: 1610,
      forecast: 2260,
      threshold_percentage: 85,
      enabled: true,
    },
  ],
  alerts: [
    {
      id: 'alert-projected-overspend',
      type: 'projected_overspend',
      severity: 'critical',
      title: 'Workspace budget is projected to overspend',
      source: 'Entire workspace',
      detected_at: '2026-08-29T12:04:00.000Z',
      financial_impact: 1180,
      status: 'active',
      recommended_action: 'Apply savings recommendations or raise the workspace budget before month end.',
    },
    {
      id: 'alert-workflow-cost-spike',
      type: 'workflow_cost_spike',
      severity: 'warning',
      title: 'Research Assistant cost increased 31%',
      source: 'Research Assistant',
      detected_at: '2026-08-29T11:36:00.000Z',
      financial_impact: 340,
      status: 'active',
      recommended_action: 'Review context size and model choice for synthesis steps.',
    },
    {
      id: 'alert-token-spike',
      type: 'token_spike',
      severity: 'warning',
      title: 'Document Analysis token volume is climbing',
      source: 'Document Analysis',
      detected_at: '2026-08-29T10:52:00.000Z',
      financial_impact: 210,
      status: 'snoozed',
      recommended_action: 'Shorten input context or split large documents into smaller runs.',
    },
  ],
  recommendations: [
    {
      id: 'rec-switch-research-model',
      title: 'Switch research synthesis to a lower-cost model',
      problem: 'Research Assistant uses the most expensive model for every synthesis run.',
      workflow: 'Research Assistant',
      provider: 'Anthropic',
      model: 'claude-3-5-sonnet',
      current_cost: 1180,
      potential_savings: 420,
      confidence: 'high',
      impact: 'high',
      action: 'Simulate routing routine research runs to a lower-cost model.',
      status: 'open',
    },
    {
      id: 'rec-reduce-support-context',
      title: 'Reduce repeated support context',
      problem: 'Customer Support Agent sends repeated policy context in every reply draft.',
      workflow: 'Customer Support Agent',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      current_cost: 920,
      potential_savings: 260,
      confidence: 'medium',
      impact: 'medium',
      action: 'Simulate trimming prompt context and caching static policy text.',
      status: 'open',
    },
    {
      id: 'rec-investigate-retry-cost',
      title: 'Investigate retry waste in document analysis',
      problem: 'A small set of document runs repeats expensive summarization steps.',
      workflow: 'Document Analysis',
      provider: 'OpenAI',
      model: 'gpt-4.1-mini',
      current_cost: 690,
      potential_savings: 180,
      confidence: 'medium',
      impact: 'medium',
      action: 'Simulate adding retry caps and surfacing failed extraction causes.',
      status: 'open',
    },
  ],
  total_workflow_runs: 3280,
  average_cost_per_run: 1.05,
  estimated_savings: 1840,
  captured_savings: 0,
  forecast_reduction: 0,
  total_tokens: 4382600,
  average_latency_ms: 1665,
}

export function useDemoProductState() {
  const [providers, setProviders] = useState(INITIAL_DEMO_STATE.providers)
  const [budgets, setBudgets] = useState(INITIAL_DEMO_STATE.budgets)
  const [alerts, setAlerts] = useState(INITIAL_DEMO_STATE.alerts)
  const [recommendations, setRecommendations] = useState(INITIAL_DEMO_STATE.recommendations)
  const [capturedSavings, setCapturedSavings] = useState(INITIAL_DEMO_STATE.captured_savings)
  const [forecastReduction, setForecastReduction] = useState(INITIAL_DEMO_STATE.forecast_reduction)

  const openSavings = recommendations
    .filter((recommendation) => recommendation.status === 'open')
    .reduce((total, recommendation) => total + recommendation.potential_savings, 0)

  const demoState: DemoProductState = {
    ...INITIAL_DEMO_STATE,
    providers,
    budgets,
    alerts,
    recommendations,
    captured_savings: capturedSavings,
    forecast_reduction: forecastReduction,
    estimated_savings: openSavings,
  }

  function setProviderStatus(providerId: string, status: DemoProviderStatus) {
    setProviders((current) =>
      current.map((provider) =>
        provider.id === providerId
          ? {
              ...provider,
              status,
              connection_label: status === 'connected' ? provider.connection_label.replace('Not connected', 'Demo API connection') : status === 'demo' ? 'Synthetic import' : 'Not connected',
              last_synced_at: status === 'not_connected' ? null : '2026-08-29T12:00:00.000Z',
              monthly_spend: status === 'not_connected' ? 0 : provider.monthly_spend || 520,
              requests: status === 'not_connected' ? 0 : provider.requests || 4100,
            }
          : provider,
      ),
    )
  }

  return {
    demoState,
    connectProvider: (providerId: string) => setProviderStatus(providerId, 'connected'),
    disconnectProvider: (providerId: string) => setProviderStatus(providerId, 'not_connected'),
    createBudget: (budget: Omit<DemoBudget, 'id' | 'current_spend' | 'forecast' | 'enabled'>) => {
      setBudgets((current) => [
        {
          ...budget,
          id: `budget-demo-${current.length + 1}`,
          current_spend: Math.round(budget.amount * 0.58),
          forecast: Math.round(budget.amount * 1.08),
          enabled: true,
        },
        ...current,
      ])
    },
    updateBudget: (budgetId: string, updates: Partial<Pick<DemoBudget, 'amount' | 'threshold_percentage' | 'enabled'>>) => {
      setBudgets((current) =>
        current.map((budget) => {
          if (budget.id !== budgetId) return budget
          const amount = updates.amount ?? budget.amount
          const currentSpendRatio = budget.amount > 0 ? budget.current_spend / budget.amount : 0.6
          const forecastRatio = budget.amount > 0 ? budget.forecast / budget.amount : 1.1
          return {
            ...budget,
            ...updates,
            amount,
            current_spend: Math.round(amount * currentSpendRatio),
            forecast: Math.round(amount * forecastRatio),
          }
        }),
      )
    },
    deleteBudget: (budgetId: string) => {
      setBudgets((current) => current.filter((budget) => budget.id !== budgetId))
    },
    resetBudgets: () => setBudgets(INITIAL_DEMO_STATE.budgets),
    setAlertStatus: (alertId: string, status: DemoAlertStatus) => {
      setAlerts((current) => current.map((alert) => alert.id === alertId ? { ...alert, status } : alert))
    },
    setRecommendationStatus: (recommendationId: string, status: DemoRecommendationStatus) => {
      const selected = recommendations.find((recommendation) => recommendation.id === recommendationId)
      if (status === 'applied' && selected?.status === 'open') {
        setCapturedSavings((value) => value + selected.potential_savings)
        setForecastReduction((value) => value + selected.potential_savings)
      }
      setRecommendations((current) => current.map((recommendation) => recommendation.id === recommendationId ? { ...recommendation, status } : recommendation))
    },
  }
}
