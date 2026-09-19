"use client"

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { trackProductEvent } from '@/lib/product-events'

const steps = [
  {
    title: 'Your role',
    options: ['Founder / CEO', 'RevOps', 'Engineering', 'Finance / FinOps', 'Product Ops', 'Other'],
    multi: false,
    description: 'What best describes your role?',
  },
  {
    title: 'Company country',
    options: ['United States', 'United Kingdom', 'India', 'Canada', 'Germany', 'Other'],
    multi: false,
    description: 'Where is your company primarily based?',
  },
  {
    title: 'Company size',
    options: ['1–10', '11–50', '51–200', '201–500', '500+'],
    multi: false,
    description: 'How many people will use this workspace?',
  },
  {
    title: 'Infrastructure providers',
    options: ['OpenAI', 'Anthropic', 'Google Gemini', 'AWS', 'Azure', 'Twilio', 'Other'],
    multi: true,
    description: 'Which providers should CostPilot track first?',
  },
  {
    title: 'Approximate monthly API/AI spend',
    options: ['<$1K', '$1K–$5K', '$5K–$10K', '$10K–$25K', '$25K+'],
    multi: false,
    description: 'This helps us tailor your starting dashboard.',
  },
  {
    title: 'Primary use case',
    options: ['AI agents', 'n8n workflows', 'Support automation', 'Sales automation', 'Product analytics', 'Other'],
    multi: false,
    description: 'What should CostPilot help you monitor first?',
  },
]

export default function Onboarding() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [company, setCompany] = useState('')
  const [name, setName] = useState('')
  const trackedStarted = useRef(false)
  const [selected, setSelected] = useState<string[][]>(() =>
    Array.from({ length: steps.length }, () => []),
  )

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/login')
        return
      }

      setLoading(false)
    })

    return unsubscribe
  }, [router])

  useEffect(() => {
    if (loading || trackedStarted.current || !auth.currentUser) return
    trackedStarted.current = true
    void trackProductEvent(auth.currentUser, 'onboarding_started').catch(() => undefined)
  }, [loading])

  const current = steps[stage]
  const canContinue = selected[stage].length > 0

  const toggleOption = (option: string) => {
    setSelected((previous) =>
      previous.map((stepSelections, index) => {
        if (index !== stage) return stepSelections
        if (!current.multi) return [option]

        return stepSelections.includes(option)
          ? stepSelections.filter((selection) => selection !== option)
          : [...stepSelections, option]
      }),
    )
  }

  const handleNext = () => {
    if (!canContinue) return

    if (stage === steps.length - 1) {
      void submitOnboarding()
      return
    }

    setStage((currentStage) => currentStage + 1)
  }

  const submitOnboarding = async () => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      router.replace('/login')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const idToken = await currentUser.getIdToken()
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          company,
          job_title: selected[0][0],
          country: selected[1][0],
          company_size: selected[2][0],
          providers: selected[3],
          estimated_monthly_spend: selected[4][0],
          plan_interest: 'not_sure',
          primary_use_case: selected[5][0],
        }),
      })

      if (!response.ok) {
        throw new Error('onboarding_failed')
      }

      await trackProductEvent(currentUser, 'onboarding_completed', {
        company_size: selected[2][0],
        provider_count: selected[3].length,
        estimated_monthly_spend: selected[4][0],
        plan_interest: 'not_sure',
        primary_use_case: selected[5][0],
      })
      router.replace('/dashboard')
    } catch {
      setError('We could not save your onboarding right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    setStage((currentStage) => Math.max(0, currentStage - 1))
  }

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center">
            <p className="text-xs text-primary">
              Step {stage + 1} of {steps.length}
            </p>
          </div>
          <h2 className="font-heading text-2xl mt-4">{current.title}</h2>
          <p className="font-mono text-sm text-slate-600 mt-2">{current.description}</p>
          {stage === 0 && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-primary"
              />
              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Company name"
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-primary"
              />
            </div>
          )}
          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {current.options.map((option) => {
              const isSelected = selected[stage].includes(option)

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleOption(option)}
                  aria-pressed={isSelected}
                  className={`px-4 py-3 rounded-lg w-full text-left ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {option}
                  {isSelected && <Check className="inline-block ml-2" size={14} />}
                </button>
              )
            })}
          </div>
          <div className="flex justify-between mt-6">
            {stage > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:border-primary hover:text-primary"
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={!canContinue || submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {stage === steps.length - 1 && submitting ? 'Saving...' : 'Continue'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
