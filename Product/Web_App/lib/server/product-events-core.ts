export const PRODUCT_EVENT_NAMES = [
  'account_created',
  'signup',
  'login',
  'onboarding_started',
  'onboarding_completed',
  'dashboard_viewed',
  'workflow_viewed',
  'usage_viewed',
  'provider_viewed',
  'provider_connection_started',
  'provider_connected',
  'provider_connection_failed',
  'provider_disconnected',
  'ai_usage_recorded',
  'workflow_observed',
  'workflow_run_observed',
  'usage_synced',
  'insight_generated',
  'budget_created',
  'budget_updated',
  'budget_threshold_reached',
  'budget_exceeded',
  'alert_configured',
  'provider_limit_created',
  'provider_limit_updated',
  'provider_limit_approaching',
  'provider_limit_exceeded',
  'alert_created',
  'alert_viewed',
  'alert_resolved',
  'first_cost_data_received',
  'forecast_viewed',
  'recommendation_generated',
  'recommendation_viewed',
  'recommendation_dismissed',
  'recommendation_applied',
  'alert_triggered',
  'plan_selected',
  'upgrade_clicked',
  'upgrade_requested',
  'checkout_started',
  'subscription_activated',
] as const

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number]
export type ProductEventTrustLevel = 'trusted' | 'untrusted'
export type ProductEventSource = 'web_app' | 'server' | 'system' | 'usage_ingest_api' | 'billing' | 'n8n' | 'gateway'

export type VerifiedFirebaseToken = {
  uid: string
  email?: string | null
  name?: string | null
  picture?: string | null
  firebase?: {
    sign_in_provider?: string
  }
}

export type ProductEventPayload = Record<string, unknown>

export type ProductEventInput = {
  event_id?: string | null
  event_name: ProductEventName
  event_source: ProductEventSource
  event_properties: ProductEventPayload
  occurred_at?: string | null
  event_trust_level?: ProductEventTrustLevel
}

const eventIdPattern = /^cp_evt_[a-zA-Z0-9._:-]+$/

export function parseProductEventName(value: unknown): ProductEventName {
  if (typeof value !== 'string') throw new Error('invalid_event_name')
  if ((PRODUCT_EVENT_NAMES as readonly string[]).includes(value)) return value as ProductEventName
  throw new Error('invalid_event_name')
}

export function parseProductEventId(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error('invalid_event_id')
  const trimmed = value.trim()
  if (!eventIdPattern.test(trimmed) || trimmed.length > 160) throw new Error('invalid_event_id')
  return trimmed
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'object') {
    if (depth >= 4) return null
    if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeValue(item, depth + 1))
    if (value instanceof Date) return value.toISOString()
    if (isPlainObject(value)) {
      const result: Record<string, unknown> = {}
      for (const [key, nestedValue] of Object.entries(value).slice(0, 50)) {
        result[key] = sanitizeValue(nestedValue, depth + 1)
      }
      return result
    }
  }
  return null
}

export function parseProductEventProperties(value: unknown): ProductEventPayload {
  if (!isPlainObject(value)) throw new Error('invalid_event_properties')
  const json = JSON.stringify(value)
  if (!json || json.length > 8000) throw new Error('invalid_event_properties')
  return sanitizeValue(value) as ProductEventPayload
}

export function buildProductEventInsert(input: {
  event_id?: string | null
  firebase_uid: string | null
  profile_id: string | null
  account_id: string | null
  event_name: ProductEventName
  event_source?: ProductEventSource | null
  event_properties?: unknown
  occurred_at?: string | null
  event_trust_level?: ProductEventTrustLevel
}) {
  const event_source = input.event_source ?? 'web_app'
  return {
    event_id: parseProductEventId(input.event_id),
    firebase_uid: input.firebase_uid,
    profile_id: input.profile_id,
    account_id: input.account_id,
    event_name: input.event_name,
    event_source,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
    event_trust_level: input.event_trust_level ?? (event_source === 'web_app' ? 'untrusted' : 'trusted'),
    event_properties: parseProductEventProperties(input.event_properties ?? {}),
  }
}

export function buildEventSummary(record: {
  id: number
  event_id?: string | null
  event_name: string
  event_source: string | null
  event_trust_level?: string | null
  occurred_at?: string | null
  created_at: string
}) {
  return {
    id: record.id,
    event_id: record.event_id ?? null,
    event_name: record.event_name,
    event_source: record.event_source,
    event_trust_level: record.event_trust_level ?? null,
    occurred_at: record.occurred_at ?? record.created_at,
    created_at: record.created_at,
  }
}
