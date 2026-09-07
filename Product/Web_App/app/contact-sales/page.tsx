'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { AuthButton, AuthFooter, AuthHeading, AuthShell, Field } from '@/components/auth-shell'

export default function ContactSalesPage() {
  const [submitted, setSubmitted] = useState(false)

  return (
    <AuthShell eyebrow="Enterprise" title="Talk to sales" description="Use the existing enterprise route for the recruiter demo without changing the design system.">
      <AuthHeading eyebrow="Enterprise" title="Talk to CostPilot sales." description="Share a few details and we will use the Scale plan flow for the demo conversation." />
      {submitted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 font-mono text-xs leading-6 text-emerald-800">
          Demo sales request captured. For this recruiter build, Scale stays sales-led and does not go through checkout.
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
          }}
        >
          <Field label="Work email" type="email" placeholder="you@company.com" required />
          <Field label="Company" placeholder="Acme AI" required />
          <Field label="What do you need?" placeholder="Enterprise controls, custom retention, and support" required />
          <AuthButton>Send request <ArrowRight size={14} /></AuthButton>
        </form>
      )}
      <AuthFooter>Prefer the self-serve path? <Link href="/signup?plan=starter" className="font-bold text-primary hover:underline">Start free</Link></AuthFooter>
    </AuthShell>
  )
}
