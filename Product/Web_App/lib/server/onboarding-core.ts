export type OnboardingPayload = {
  name?: string
  company?: string
  job_title?: string
  country?: string
  company_size: string
  providers: string[]
  estimated_monthly_spend: string
  plan_interest?: string
  primary_use_case?: string
  team_size?: string
  ai_provider_interest?: string[]
  message?: string
}

export type ResolvedOnboardingPayload = OnboardingPayload & {
  raw_answers: Record<string, unknown>
}

export type ResolvedAccountName = {
  name: string
  slug: string
}

const allowedCompanySizes = ['1–10', '11–50', '51–200', '201–500', '500+'] as const
const allowedSpendRanges = ['<$1K', '$1K–$5K', '$5K–$10K', '$10K–$25K', '$25K+'] as const
const allowedProviders = ['OpenAI', 'Anthropic', 'Google Gemini', 'AWS', 'Azure', 'Twilio', 'Other'] as const
const allowedPlanInterests = ['starter', 'growth', 'scale', 'not_sure'] as const

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

export function parseOnboardingPayload(input: unknown): ResolvedOnboardingPayload {
  if (!input || typeof input !== 'object') {
    throw new Error('invalid_payload')
  }

  const payload = input as Record<string, unknown>
  const companySize = payload.company_size
  const providers = payload.providers
  const spend = payload.estimated_monthly_spend
  const planInterest = payload.plan_interest

  if (typeof companySize !== 'string' || !allowedCompanySizes.includes(companySize as any)) {
    throw new Error('invalid_company_size')
  }

  if (!Array.isArray(providers) || providers.length === 0 || !providers.every((provider) => typeof provider === 'string' && allowedProviders.includes(provider as any))) {
    throw new Error('invalid_providers')
  }

  if (typeof spend !== 'string' || !allowedSpendRanges.includes(spend as any)) {
    throw new Error('invalid_estimated_monthly_spend')
  }

  if (planInterest !== undefined && (typeof planInterest !== 'string' || !allowedPlanInterests.includes(planInterest as any))) {
    throw new Error('invalid_plan_interest')
  }

  const optionalText = (key: keyof OnboardingPayload) => {
    const value = payload[key]
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : undefined
  }

  const providerInterest = Array.isArray(payload.ai_provider_interest)
    ? payload.ai_provider_interest.filter((provider): provider is string => typeof provider === 'string' && allowedProviders.includes(provider as any))
    : undefined

  return {
    name: optionalText('name'),
    company: optionalText('company'),
    job_title: optionalText('job_title'),
    country: optionalText('country'),
    company_size: companySize,
    providers: [...providers],
    estimated_monthly_spend: spend,
    plan_interest: typeof planInterest === 'string' ? planInterest : undefined,
    primary_use_case: optionalText('primary_use_case'),
    team_size: optionalText('team_size'),
    ai_provider_interest: providerInterest,
    message: optionalText('message'),
    raw_answers: {
      name: optionalText('name'),
      company: optionalText('company'),
      job_title: optionalText('job_title'),
      country: optionalText('country'),
      company_size: companySize,
      providers: [...providers],
      estimated_monthly_spend: spend,
      plan_interest: typeof planInterest === 'string' ? planInterest : undefined,
      primary_use_case: optionalText('primary_use_case'),
      team_size: optionalText('team_size'),
      ai_provider_interest: providerInterest,
      message: optionalText('message'),
    },
  }
}

export function deriveAccountName(email: string | null | undefined, company?: string | null) {
  const safeCompany = company?.trim()
  if (safeCompany) {
    return { name: normalizeAccountName(safeCompany), slug: slugify(`${safeCompany}-workspace`) || 'my-workspace' }
  }

  const safeEmail = email?.trim().toLowerCase() ?? ''
  const domain = safeEmail.includes('@') ? safeEmail.split('@')[1] : ''
  if (!domain || domain.endsWith('gmail.com') || domain.endsWith('googlemail.com') || domain.endsWith('outlook.com') || domain.endsWith('hotmail.com') || domain.endsWith('yahoo.com')) {
    return { name: 'My Workspace', slug: 'my-workspace' }
  }

  const base = domain.split('.')[0] || 'workspace'
  const name = `${base
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')} Workspace`
  return { name, slug: slugify(`${base}-workspace`) }
}

export function normalizeAccountName(name: string) {
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed : 'My Workspace'
}
