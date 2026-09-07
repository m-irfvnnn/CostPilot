'use client'

import { useEffect, useRef, useState, startTransition } from 'react'
import { Clock3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, type User } from 'firebase/auth'

import { DashboardView, createPaymentForm } from '@/components/dashboard-view'
import { logout } from '@/lib/auth'
import type { DashboardPayload, LiveAiUsageRecord } from '@/lib/dashboard-types'
import { auth } from '@/lib/firebase'
import { syncCurrentFirebaseUser } from '@/lib/profile-sync'
import { trackProductEvent } from '@/lib/product-events'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [liveUsage, setLiveUsage] = useState<LiveAiUsageRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [budgetAmount, setBudgetAmount] = useState('12000')
  const [budgetThreshold, setBudgetThreshold] = useState('80')
  const [savingBudget, setSavingBudget] = useState(false)
  const [startingCheckout, setStartingCheckout] = useState(false)
  const [savingProvider, setSavingProvider] = useState(false)
  const [savingProviderLimit, setSavingProviderLimit] = useState(false)
  const [runningIntegrationTest, setRunningIntegrationTest] = useState(false)
  const [integrationTestResult, setIntegrationTestResult] = useState<string | null>(null)
  const trackedViewed = useRef(false)

  const loadOverview = async (currentUser: User) => {
    const token = await currentUser.getIdToken()
    const response = await fetch('/api/product/overview', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'dashboard_load_failed')
    }
    const payload = (await response.json()) as DashboardPayload
    setData(payload)
    const usageResponse = await fetch('/api/product/usage/ingest', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    if (usageResponse.ok) {
      const usagePayload = (await usageResponse.json()) as { usage?: LiveAiUsageRecord[] }
      setLiveUsage(usagePayload.usage ?? [])
    } else {
      setLiveUsage([])
    }
    if (payload.overview?.budget_amount) {
      setBudgetAmount(String(Math.round(Number(payload.overview.budget_amount))))
    }
    if (payload.overview?.threshold_percentage) {
      setBudgetThreshold(String(payload.overview.threshold_percentage))
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      startTransition(() => {
        setUser(currentUser)
        setLoading(false)
        if (!currentUser) {
          router.replace('/login')
        }
      })
    })

    return unsubscribe
  }, [router])

  useEffect(() => {
    if (!user) return

    void (async () => {
      try {
        await syncCurrentFirebaseUser(user)
        await loadOverview(user)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'dashboard_load_failed'
        if (message === 'account_not_found') {
          router.replace('/onboarding')
          return
        }
        setError(message)
      }
    })()
  }, [router, user])

  useEffect(() => {
  if (loading || trackedViewed.current || !user) return
    trackedViewed.current = true
    void trackProductEvent(user, 'dashboard_viewed').catch(() => undefined)
  }, [loading, user])

  const handleLogout = async () => {
    await logout()
    router.replace('/')
  }

  const saveBudget = async () => {
    if (!user) return
    setSavingBudget(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/product/budget', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Number(budgetAmount),
          threshold_percentage: Number(budgetThreshold),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'product_budget_failed')
      }
      await loadOverview(user)
    } catch (budgetError) {
      setError(budgetError instanceof Error ? budgetError.message : 'product_budget_failed')
    } finally {
      setSavingBudget(false)
    }
  }

  const startGrowthCheckout = async () => {
    if (!user) return
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
          success_path: '/dashboard?billing=success',
          failure_path: '/dashboard?billing=failed',
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'payu_checkout_failed')
      }
      const payload = await response.json()
      createPaymentForm(payload.form_fields, payload.payment_url)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'payu_checkout_failed')
      setStartingCheckout(false)
    }
  }

  const resolveAlert = async (alertId: string) => {
    if (!user) return
    setError(null)
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/product/alerts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: alertId }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'product_alert_update_failed')
      }
      await loadOverview(user)
    } catch (alertError) {
      setError(alertError instanceof Error ? alertError.message : 'product_alert_update_failed')
    }
  }

  const dismissRecommendation = async (recommendationId: string) => {
    if (!user) return
    setError(null)
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/product/recommendations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: recommendationId }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'product_recommendation_update_failed')
      }
      await loadOverview(user)
    } catch (recommendationError) {
      setError(recommendationError instanceof Error ? recommendationError.message : 'product_recommendation_update_failed')
    }
  }

  const updateProvider = async (payload: Record<string, unknown>) => {
    if (!user) return
    setSavingProvider(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/product/providers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'provider_update_failed')
      }
      await loadOverview(user)
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : 'provider_update_failed')
    } finally {
      setSavingProvider(false)
    }
  }

  const saveProviderLimit = async (payload: Record<string, unknown>) => {
    if (!user) return
    setSavingProviderLimit(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/product/provider-limits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'provider_limit_update_failed')
      }
      await loadOverview(user)
    } catch (limitError) {
      setError(limitError instanceof Error ? limitError.message : 'provider_limit_update_failed')
    } finally {
      setSavingProviderLimit(false)
    }
  }

  const runIntegrationTest = async () => {
    if (!user) return
    setRunningIntegrationTest(true)
    setIntegrationTestResult(null)
    setError(null)
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/product/test-run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error ?? 'product_test_run_failed')
      }
      const totalTokens = body?.result?.total_tokens
      const status = body?.result?.usage_ingest_status ?? 'captured'
      setIntegrationTestResult(
        typeof totalTokens === 'number'
          ? `Integration test ${status}. ${totalTokens} tokens were attributed to this workspace.`
          : `Integration test ${status}. Refreshing usage now.`,
      )
      await loadOverview(user)
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'product_test_run_failed')
    } finally {
      setRunningIntegrationTest(false)
    }
  }

  return (
    <DashboardView
      data={data}
      loading={loading}
      error={error}
      userEmail={user?.email ?? null}
      userBadge={user?.email?.slice(0, 2).toUpperCase() ?? 'CP'}
      onLogout={handleLogout}
      toolbarActions={
        <>
          <button onClick={() => user && void loadOverview(user)} className="button-secondary w-fit">
            <Clock3 size={14} />
            Refresh real data
          </button>
        </>
      }
      budgetAmount={budgetAmount}
      budgetThreshold={budgetThreshold}
      onBudgetAmountChange={setBudgetAmount}
      onBudgetThresholdChange={setBudgetThreshold}
      onSaveBudget={saveBudget}
      savingBudget={savingBudget}
      onStartGrowthCheckout={startGrowthCheckout}
      startingCheckout={startingCheckout}
      liveUsage={liveUsage}
      onResolveRealAlert={resolveAlert}
      onDismissRealRecommendation={dismissRecommendation}
      onAddRealProvider={(provider, apiKey) => updateProvider({ action: 'add', provider, api_key: apiKey })}
      onDisconnectRealProvider={(id) => updateProvider({ action: 'disconnect', id })}
      onReconnectRealProvider={(id, apiKey) => updateProvider({ action: 'reconnect', id, api_key: apiKey })}
      onRemoveRealProvider={(id) => updateProvider({ action: 'remove', id })}
      savingProvider={savingProvider}
      onSaveProviderLimit={saveProviderLimit}
      savingProviderLimit={savingProviderLimit}
      onRunIntegrationTest={runIntegrationTest}
      runningIntegrationTest={runningIntegrationTest}
      integrationTestResult={integrationTestResult}
    />
  )
}
