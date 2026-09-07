'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BillingPlanId } from '@/lib/billing-plans'

import { DashboardView } from '@/components/dashboard-view'
import { logout } from '@/lib/auth'
import { createPaymentForm } from '@/components/dashboard-view'
import { getStoredPlanIntent, normalizePlanIntent, setStoredPlanIntent } from '@/lib/demo-plan-intent'
import { getDemoDashboardPayload } from '@/lib/demo-dashboard'
import { useDemoProductState } from '@/lib/demo-product-state'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'
import type { DashboardPayload, LiveAiUsageRecord } from '@/lib/dashboard-types'
import type { DashboardSection } from '@/components/dashboard-view'
import Link from 'next/link'

type BillingSnapshot = NonNullable<DashboardPayload['plan']>

function applyPlanToDemo(data: DashboardPayload, plan: BillingSnapshot | null): DashboardPayload {
  if (!plan) return data

  return {
    ...data,
    overview: {
      ...data.overview,
      current_plan_id: plan.current_plan_id,
      plan_status: plan.plan_status,
    },
    plan,
  }
}

export default function DemoDashboardPage() {
  const router = useRouter()
  const [baseData] = useState<DashboardPayload>(() => getDemoDashboardPayload())
  const [planState, setPlanState] = useState<BillingSnapshot | null>(baseData.plan)
  const data = applyPlanToDemo(baseData, planState)
  const [budgetAmount, setBudgetAmount] = useState(String(Math.round(Number(baseData.overview.budget_amount ?? 0))))
  const [budgetThreshold, setBudgetThreshold] = useState(String(baseData.overview.threshold_percentage ?? 80))
  const [user, setUser] = useState<User | null>(null)
  const [startingCheckout, setStartingCheckout] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanId | null>(null)
  const [billingStatus, setBillingStatus] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview')
  const [liveUsage, setLiveUsage] = useState<LiveAiUsageRecord[]>([])
  const {
    demoState,
    connectProvider,
    disconnectProvider,
    createBudget,
    updateBudget,
    deleteBudget,
    resetBudgets,
    setAlertStatus,
    setRecommendationStatus,
  } = useDemoProductState()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const plan = normalizePlanIntent(params.get('plan')) ?? getStoredPlanIntent()
    const billing = params.get('billing')
    setSelectedPlan(plan)
    setBillingStatus(billing)
    if (plan) {
      setStoredPlanIntent(plan)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setPlanState(baseData.plan)
      setLiveUsage([])
      return
    }

    void (async () => {
      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/billing/plan', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error ?? 'billing_plan_load_failed')
        }
        const payload = (await response.json()) as { plan: BillingSnapshot | null }
        setPlanState(payload.plan ?? baseData.plan)

        const usageResponse = await fetch('/api/product/usage/ingest', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        })
        if (usageResponse.ok) {
          const usagePayload = (await usageResponse.json()) as { usage?: LiveAiUsageRecord[] }
          setLiveUsage(usagePayload.usage ?? [])
        } else if (usageResponse.status !== 401 && usageResponse.status !== 404 && usageResponse.status !== 409) {
          const body = await usageResponse.json().catch(() => ({}))
          throw new Error(body.error ?? 'live_usage_load_failed')
        }
      } catch (planError) {
        setError(planError instanceof Error ? planError.message : 'billing_plan_load_failed')
      }
    })()
  }, [baseData.plan, user])

  const startGrowthCheckout = async () => {
    if (!user) {
      router.push('/signup?plan=growth')
      return
    }

    setStartingCheckout(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/billing/payu/checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: 'growth',
          success_path: '/billing/payu/success?next=/demo&plan=growth',
          failure_path: '/billing/payu/failure?next=/demo&plan=growth',
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'payu_checkout_failed')
      }
      const payload = await response.json()
      createPaymentForm(payload.form_fields, payload.payment_url)
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : 'payu_checkout_failed'
      setError(message === 'payu_not_configured' ? 'PayU TEST checkout is not configured in this local environment yet.' : message)
      setStartingCheckout(false)
    }
  }

  const billingNotice =
    billingStatus === 'success'
      ? 'TEST payment verified. The Growth plan is now active for this signed-in demo account.'
      : billingStatus === 'failed'
        ? 'TEST payment did not complete. Your previous plan is unchanged and you can retry anytime.'
        : billingStatus === 'cancelled'
          ? 'TEST checkout was cancelled. Your previous plan is unchanged.'
          : selectedPlan === 'growth'
            ? user
              ? 'Growth TEST is selected for this signed-in demo account. Use the upgrade action below to open the PayU sandbox checkout.'
              : 'Growth TEST is selected for this demo. Sign in first, then use the upgrade action to open the PayU sandbox checkout.'
            : selectedPlan === 'scale'
              ? 'Scale is sales-led in this demo build. Use the existing sales contact route for the enterprise flow.'
              : null

  return (
    <DashboardView
      data={data}
      error={error}
      userEmail={user?.email ?? null}
      userBadge={user?.email?.slice(0, 2).toUpperCase() ?? 'DM'}
      onLogout={user ? async () => {
        await logout()
        router.replace('/')
      } : null}
      demoNotice="Demo workspace — synthetic data"
      readOnly
      planIntent={selectedPlan}
      billingNotice={billingNotice}
      budgetAmount={budgetAmount}
      budgetThreshold={budgetThreshold}
      onBudgetAmountChange={setBudgetAmount}
      onBudgetThresholdChange={setBudgetThreshold}
      onStartGrowthCheckout={user ? startGrowthCheckout : selectedPlan === 'growth' ? startGrowthCheckout : null}
      startingCheckout={startingCheckout}
      growthCheckoutLabel={user ? 'Open PayU Growth TEST checkout' : 'Sign in to open Growth TEST checkout'}
      onContactSales={selectedPlan === 'scale' ? async () => router.push('/contact-sales?plan=scale') : null}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      demoProduct={demoState}
      liveUsage={liveUsage}
      onConnectDemoProvider={connectProvider}
      onDisconnectDemoProvider={disconnectProvider}
      onCreateDemoBudget={createBudget}
      onUpdateDemoBudget={updateBudget}
      onDeleteDemoBudget={deleteBudget}
      onResetDemoBudgets={resetBudgets}
      onSetDemoAlertStatus={setAlertStatus}
      onSetDemoRecommendationStatus={setRecommendationStatus}
      toolbarActions={
        <>
          <Link href="/" className="button-secondary w-fit">Back to site</Link>
          {!user ? <Link href={selectedPlan ? `/signup?plan=${selectedPlan}` : '/signup'} className="button-secondary w-fit">Create workspace</Link> : null}
        </>
      }
    />
  )
}
