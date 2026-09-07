import type { BillingPlanId } from './billing-plans'

const STORAGE_KEY = 'costpilot.demo.plan_intent'

export function normalizePlanIntent(value: string | null | undefined): BillingPlanId | null {
  if (value === 'starter' || value === 'growth' || value === 'scale') {
    return value
  }

  return null
}

export function getStoredPlanIntent() {
  if (typeof window === 'undefined') return null
  return normalizePlanIntent(window.sessionStorage.getItem(STORAGE_KEY))
}

export function setStoredPlanIntent(planId: BillingPlanId | null) {
  if (typeof window === 'undefined') return

  if (!planId) {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return
  }

  window.sessionStorage.setItem(STORAGE_KEY, planId)
}

export function buildPlanHref(pathname: string, planId: BillingPlanId | null) {
  if (!planId) return pathname
  return `${pathname}?plan=${planId}`
}
