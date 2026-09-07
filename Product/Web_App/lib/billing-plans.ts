export type BillingPlanId = 'starter' | 'growth' | 'scale'

export type BillingPlan = {
  id: BillingPlanId
  label: string
  description: string
  billing_interval: 'monthly' | 'custom'
  amount: string
  currency: 'INR'
  checkout_enabled: boolean
  featured?: boolean
  cta: string
  perks: string[]
  productinfo: string
  history_days: number | null
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  starter: {
    id: 'starter',
    label: 'CostPilot Starter',
    description: 'Explore CostPilot',
    billing_interval: 'monthly',
    amount: '0.00',
    currency: 'INR',
    checkout_enabled: false,
    cta: 'Start Free',
    perks: ['1 workspace', '7-day spend history', 'Core dashboards'],
    productinfo: 'CostPilot Starter',
    history_days: 7,
  },
  growth: {
    id: 'growth',
    label: 'CostPilot Growth',
    description: 'Monitor growing infrastructure',
    billing_interval: 'monthly',
    amount: '1.00',
    currency: 'INR',
    checkout_enabled: true,
    featured: true,
    cta: 'Start Growth Test',
    perks: ['Unlimited workspaces', '90-day spend history', 'Budget thresholds'],
    productinfo: 'CostPilot Growth TEST Monthly',
    history_days: 90,
  },
  scale: {
    id: 'scale',
    label: 'CostPilot Scale',
    description: 'For larger environments',
    billing_interval: 'custom',
    amount: '0.00',
    currency: 'INR',
    checkout_enabled: false,
    cta: 'Talk to Sales',
    perks: ['Custom data retention', 'Advanced controls', 'Dedicated support'],
    productinfo: 'CostPilot Scale',
    history_days: null,
  },
}

export const BILLING_PLAN_LIST = Object.values(BILLING_PLANS)
