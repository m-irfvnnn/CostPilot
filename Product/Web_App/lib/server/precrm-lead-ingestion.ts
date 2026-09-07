import type { ResolvedOnboardingPayload } from './onboarding-core'
import type { SupabaseAccount, SupabaseProfile } from './supabase-admin'

export type PreCrmLeadIngestionResult =
  | { status: 'skipped'; reason: 'already_completed' | 'missing_ingest_url' | 'missing_email' }
  | { status: 'queued'; event_id: string }
  | { status: 'failed'; event_id: string; reason: string }

function getPreCrmIngestUrl() {
  return process.env.COSTPILOT_PRECRM_INGEST_URL || ''
}

function normalizeDomain(email: string | null | undefined) {
  const domain = email?.split('@')[1]?.trim().toLowerCase()
  return domain || null
}

function parseSpendRange(range: string) {
  const normalized = range.replace(/\s/g, '').toUpperCase()
  if (normalized === '<$1K') return 500
  if (normalized === '$1K–$5K' || normalized === '$1K-$5K') return 3000
  if (normalized === '$5K–$10K' || normalized === '$5K-$10K') return 7500
  if (normalized === '$10K–$25K' || normalized === '$10K-$25K') return 17500
  if (normalized === '$25K+') return 25000
  return null
}

export function buildWebsiteSignupLeadPayload(input: {
  profile: SupabaseProfile
  account: SupabaseAccount
  onboarding: ResolvedOnboardingPayload
  occurred_at: string
}) {
  const { profile, account, onboarding, occurred_at } = input
  const email = profile.email
  const domain = normalizeDomain(email)
  const company = onboarding.company || account.name
  const event_id = `signup-${profile.firebase_uid}-${account.id}`

  return {
    event_id,
    source: 'website_signup',
    source_type: 'inbound',
    name: onboarding.name || profile.display_name || null,
    email,
    company,
    company_name: company,
    domain,
    job_title: onboarding.job_title || null,
    role: onboarding.job_title || null,
    country: onboarding.country || null,
    company_size: onboarding.company_size,
    plan_interest: onboarding.plan_interest || 'not_sure',
    monthly_ai_api_spend: parseSpendRange(onboarding.estimated_monthly_spend),
    estimated_monthly_spend: onboarding.estimated_monthly_spend,
    primary_use_case: onboarding.primary_use_case || null,
    providers: onboarding.providers,
    account_id: account.id,
    profile_id: profile.id,
    submitted_at: occurred_at,
    firmographics: {
      company_name: company,
      domain,
      country: onboarding.country || null,
      employees: onboarding.company_size,
      monthly_spend: parseSpendRange(onboarding.estimated_monthly_spend),
      provider_interest: onboarding.providers,
      primary_use_case: onboarding.primary_use_case || null,
    },
    raw_payload: {
      synthetic: false,
      source: 'website_signup',
      account_id: account.id,
      profile_id: profile.id,
      onboarding_response: onboarding.raw_answers,
    },
  }
}

export async function triggerWebsiteSignupLeadIngestion(input: {
  profile: SupabaseProfile
  account: SupabaseAccount
  onboarding: ResolvedOnboardingPayload
  occurred_at: string
}): Promise<PreCrmLeadIngestionResult> {
  if (!input.profile.email) return { status: 'skipped', reason: 'missing_email' }

  const ingestUrl = getPreCrmIngestUrl()
  const payload = buildWebsiteSignupLeadPayload(input)
  if (!ingestUrl) return { status: 'skipped', reason: 'missing_ingest_url' }

  try {
    const response = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CostPilot-Source': 'website_signup',
        'X-CostPilot-Event-Id': payload.event_id,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { status: 'failed', event_id: payload.event_id, reason: `${response.status} ${body.slice(0, 160)}`.trim() }
    }

    return { status: 'queued', event_id: payload.event_id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_ingestion_error'
    return { status: 'failed', event_id: payload.event_id, reason: message }
  }
}
