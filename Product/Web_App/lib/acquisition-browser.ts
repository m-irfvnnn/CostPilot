import { mapPlgAcquisitionEnvelope, type AcquisitionEnvelope } from './acquisition.ts'

export type BrowserAcquisitionContext = Omit<AcquisitionEnvelope, 'channel'> & {
  captured_at: string | null
  landing_path: string | null
  landing_search: string | null
}

type BrowserLocationLike = {
  href: string
  origin: string
  pathname: string
  search: string
}

type CaptureResult = {
  context: BrowserAcquisitionContext
  has_signal: boolean
}

const STORAGE_KEY = 'costpilot.acquisition.context.v1'
const SIGNAL_KEYS = [
  'source',
  'source_id',
  'medium',
  'campaign',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'partner_id',
  'creator_id',
  'referral_id',
]
const SIGNAL_ALIAS_KEYS = ['partner', 'creator', 'referral_code', 'referral', 'ref']
const PAID_MEDIA_TOKENS = ['cpc', 'ppc', 'paid', 'paid_social', 'display', 'sponsored', 'affiliate']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function pickFirst(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return null
}

function pickSearchParam(searchParams: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key)
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return null
}

function parseExternalReferrer(referrer: string | null | undefined, origin: string) {
  if (!referrer) return null

  try {
    const referrerUrl = new URL(referrer)
    return referrerUrl.origin === origin ? null : referrerUrl.toString()
  } catch {
    return null
  }
}

function hasPaidMedium(value: string | null) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return PAID_MEDIA_TOKENS.some((token) => normalized.includes(token))
}

function toContext(envelope: AcquisitionEnvelope, extras: {
  captured_at: string | null
  landing_path: string | null
  landing_search: string | null
}): BrowserAcquisitionContext {
  return {
    source: envelope.source,
    source_id: envelope.source_id,
    medium: envelope.medium,
    campaign: envelope.campaign,
    referrer: envelope.referrer,
    utm_source: envelope.utm_source,
    utm_medium: envelope.utm_medium,
    utm_campaign: envelope.utm_campaign,
    utm_content: envelope.utm_content,
    utm_term: envelope.utm_term,
    partner_id: envelope.partner_id,
    creator_id: envelope.creator_id,
    referral_id: envelope.referral_id,
    ...extras,
  }
}

export function captureAcquisitionContextFromLocation(input: {
  location: BrowserLocationLike
  document_referrer?: string | null
  now?: string
}): CaptureResult {
  const searchParams = new URL(input.location.href).searchParams
  const externalReferrer = parseExternalReferrer(input.document_referrer ?? null, input.location.origin)
  const utmMedium = pickFirst(searchParams.get('utm_medium'), searchParams.get('medium'))
  const partnerId = pickSearchParam(searchParams, 'partner_id', 'partner')
  const creatorId = pickSearchParam(searchParams, 'creator_id', 'creator')
  const referralId = pickSearchParam(searchParams, 'referral_id', 'referral_code', 'referral', 'ref')
  const explicitSignal =
    SIGNAL_KEYS.some((key) => searchParams.get(key)?.trim()) ||
    SIGNAL_ALIAS_KEYS.some((key) => searchParams.get(key)?.trim())
  const hasSignal = explicitSignal || !!externalReferrer

  const source =
    pickFirst(searchParams.get('source'), searchParams.get('utm_source')) ??
    (hasPaidMedium(utmMedium) ? 'paid_signup' : externalReferrer ? 'organic_signup' : 'direct_signup')

  const medium =
    utmMedium ??
    (externalReferrer ? 'referral' : 'direct')

  const envelope = mapPlgAcquisitionEnvelope({
    event_source: 'web_app',
    source,
    source_id: pickFirst(searchParams.get('source_id'), searchParams.get('campaign_id')),
    medium,
    campaign: pickFirst(searchParams.get('campaign'), searchParams.get('utm_campaign')),
    referrer: externalReferrer,
    event_properties: {
      utm_source: searchParams.get('utm_source'),
      utm_medium: searchParams.get('utm_medium'),
      utm_campaign: searchParams.get('utm_campaign'),
      utm_content: searchParams.get('utm_content'),
      utm_term: searchParams.get('utm_term'),
      partner_id: partnerId,
      creator_id: creatorId,
      referral_id: referralId,
    },
  })

  return {
    context: toContext(envelope, {
      captured_at: input.now ?? new Date().toISOString(),
      landing_path: input.location.pathname,
      landing_search: input.location.search || null,
    }),
    has_signal: hasSignal,
  }
}

export function parseStoredAcquisitionContext(value: unknown): BrowserAcquisitionContext | null {
  if (!isPlainObject(value)) return null

  const envelope = mapPlgAcquisitionEnvelope({
    event_source: 'web_app',
    source: typeof value.source === 'string' ? value.source : null,
    source_id: typeof value.source_id === 'string' ? value.source_id : null,
    medium: typeof value.medium === 'string' ? value.medium : null,
    campaign: typeof value.campaign === 'string' ? value.campaign : null,
    referrer: typeof value.referrer === 'string' ? value.referrer : null,
    event_properties: {
      utm_source: typeof value.utm_source === 'string' ? value.utm_source : null,
      utm_medium: typeof value.utm_medium === 'string' ? value.utm_medium : null,
      utm_campaign: typeof value.utm_campaign === 'string' ? value.utm_campaign : null,
      utm_content: typeof value.utm_content === 'string' ? value.utm_content : null,
      utm_term: typeof value.utm_term === 'string' ? value.utm_term : null,
      partner_id: typeof value.partner_id === 'string' ? value.partner_id : null,
      creator_id: typeof value.creator_id === 'string' ? value.creator_id : null,
      referral_id: typeof value.referral_id === 'string' ? value.referral_id : null,
    },
  })

  return toContext(envelope, {
    captured_at: typeof value.captured_at === 'string' ? value.captured_at : null,
    landing_path: typeof value.landing_path === 'string' ? value.landing_path : null,
    landing_search: typeof value.landing_search === 'string' ? value.landing_search : null,
  })
}

export function mergeAcquisitionContexts(
  existing: BrowserAcquisitionContext | null,
  incoming: BrowserAcquisitionContext,
  allowOverwrite: boolean,
) {
  if (!existing) return incoming
  if (!allowOverwrite) return existing

  return {
    source: incoming.source ?? existing.source,
    source_id: incoming.source_id ?? existing.source_id,
    medium: incoming.medium ?? existing.medium,
    campaign: incoming.campaign ?? existing.campaign,
    referrer: incoming.referrer ?? existing.referrer,
    utm_source: incoming.utm_source ?? existing.utm_source,
    utm_medium: incoming.utm_medium ?? existing.utm_medium,
    utm_campaign: incoming.utm_campaign ?? existing.utm_campaign,
    utm_content: incoming.utm_content ?? existing.utm_content,
    utm_term: incoming.utm_term ?? existing.utm_term,
    partner_id: incoming.partner_id ?? existing.partner_id,
    creator_id: incoming.creator_id ?? existing.creator_id,
    referral_id: incoming.referral_id ?? existing.referral_id,
    captured_at: incoming.captured_at ?? existing.captured_at,
    landing_path: incoming.landing_path ?? existing.landing_path,
    landing_search: incoming.landing_search ?? existing.landing_search,
  }
}

export function readStoredAcquisitionContext(storage: Pick<Storage, 'getItem'> = window.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parseStoredAcquisitionContext(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeStoredAcquisitionContext(
  context: BrowserAcquisitionContext,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
) {
  storage.setItem(STORAGE_KEY, JSON.stringify(context))
  return context
}

export function captureAndStoreAcquisitionContext(input: {
  location?: BrowserLocationLike
  document_referrer?: string | null
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  now?: string
} = {}) {
  if (typeof window === 'undefined') return null

  const location = input.location ?? window.location
  const storage = input.storage ?? window.localStorage
  const existing = readStoredAcquisitionContext(storage)
  const captured = captureAcquisitionContextFromLocation({
    location,
    document_referrer: input.document_referrer ?? document.referrer,
    now: input.now,
  })

  const merged = mergeAcquisitionContexts(existing, captured.context, captured.has_signal || !existing)
  return writeStoredAcquisitionContext(merged, storage)
}

export function getStoredAcquisitionContext() {
  if (typeof window === 'undefined') return null
  return readStoredAcquisitionContext(window.localStorage)
}

export function mergeProductEventPropertiesWithAcquisitionContext(
  eventProperties: Record<string, unknown> = {},
  context: BrowserAcquisitionContext | null = getStoredAcquisitionContext(),
) {
  if (!context) return eventProperties

  return {
    source: context.source,
    source_id: context.source_id,
    medium: context.medium,
    campaign: context.campaign,
    referrer: context.referrer,
    utm_source: context.utm_source,
    utm_medium: context.utm_medium,
    utm_campaign: context.utm_campaign,
    utm_content: context.utm_content,
    utm_term: context.utm_term,
    partner_id: context.partner_id,
    creator_id: context.creator_id,
    referral_id: context.referral_id,
    acquisition_captured_at: context.captured_at,
    acquisition_landing_path: context.landing_path,
    acquisition_landing_search: context.landing_search,
    ...eventProperties,
  }
}
