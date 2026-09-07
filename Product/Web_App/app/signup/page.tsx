"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AuthButton, AuthFooter, AuthHeading, AuthShell, Divider, Field } from '@/components/auth-shell'
import { GoogleIcon } from '@/components/google-icon'
import { registerWithEmail, loginWithGoogle } from '@/lib/auth'
import { buildPlanHref, normalizePlanIntent, setStoredPlanIntent } from '@/lib/demo-plan-intent'
import { syncCurrentFirebaseUser } from '@/lib/profile-sync'
import { trackProductEvent } from '@/lib/product-events'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<ReturnType<typeof normalizePlanIntent>>(() => {
    if (typeof window === 'undefined') return null
    return normalizePlanIntent(new URLSearchParams(window.location.search).get('plan'))
  })

  useEffect(() => {
    const plan = normalizePlanIntent(new URLSearchParams(window.location.search).get('plan'))
    if (!plan) return
    setSelectedPlan(plan)
    setStoredPlanIntent(plan)
  }, [])

  const continueToOnboarding = async (user: Parameters<typeof syncCurrentFirebaseUser>[0]) => {
    await syncCurrentFirebaseUser(user).catch(() => undefined)
    try {
      await trackProductEvent(user, 'signup')
    } catch {
      void 0
    }
    router.replace(buildPlanHref('/onboarding', selectedPlan))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const credential = await registerWithEmail(email, password)
      await continueToOnboarding(credential.user)
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    try {
      const credential = await loginWithGoogle()
      await continueToOnboarding(credential.user)
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell eyebrow="Welcome" title="Start your journey" description="Sign up to use the app.">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <Field label="Email" type="email" placeholder="you@company.com" value={email} onChange={(e)=>setEmail(e.target.value)}/>
        <Field label="Password" type="password" placeholder="Your password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <AuthButton disabled={loading}>{loading ? 'Signing up...' : 'Sign up'} <ArrowRight size={14} /></AuthButton>
      </form>
      <Divider />
      <button type="button" className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white font-mono text-xs font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary" onClick={handleGoogle} disabled={loading}>
        {loading ? 'Signing in...' : <><GoogleIcon />Sign in with Google</>}
      </button>
      <AuthFooter>Already have an account? <Link href="/login" onClick={() => selectedPlan && setStoredPlanIntent(selectedPlan)} className="font-bold text-primary hover:underline">Log in</Link></AuthFooter>
    </AuthShell>
  )
}
