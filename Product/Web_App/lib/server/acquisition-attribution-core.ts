import { normalizeAcquisitionEnvelope, type AcquisitionEnvelope } from '../acquisition.ts'

export const ACQUISITION_TOUCH_TYPES = ['first_touch', 'last_touch', 'interaction'] as const

export type AcquisitionTouchType = (typeof ACQUISITION_TOUCH_TYPES)[number]

export type AcquisitionIdentityInput = {
  profile_id?: string | null
  account_id?: string | null
  lead_id?: number | null
  firebase_uid?: string | null
}

export type AttributionMetadata = Record<string, unknown>

const METADATA_MAX_BYTES = 8000

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
        if (/secret|token|password|key|authorization/i.test(key)) continue
        result[key] = sanitizeValue(nestedValue, depth + 1)
      }
      return result
    }
  }
  return null
}

function sanitizeIdentifier(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function parseAcquisitionTouchType(value: unknown): AcquisitionTouchType {
  if (typeof value !== 'string' || !ACQUISITION_TOUCH_TYPES.includes(value as AcquisitionTouchType)) {
    throw new Error('invalid_touch_type')
  }
  return value as AcquisitionTouchType
}

export function parseAcquisitionEnvelope(value: unknown): AcquisitionEnvelope {
  return normalizeAcquisitionEnvelope(value)
}

export function parseAcquisitionIdentity(input: AcquisitionIdentityInput) {
  return {
    profile_id: sanitizeIdentifier(input.profile_id),
    account_id: sanitizeIdentifier(input.account_id),
    lead_id: typeof input.lead_id === 'number' && Number.isInteger(input.lead_id) && input.lead_id > 0 ? input.lead_id : null,
    firebase_uid: sanitizeIdentifier(input.firebase_uid),
  }
}

export function parseAcquisitionMetadata(value: unknown): AttributionMetadata {
  if (value == null) return {}
  if (!isPlainObject(value)) throw new Error('invalid_acquisition_metadata')
  const sanitized = sanitizeValue(value)
  if (!isPlainObject(sanitized)) throw new Error('invalid_acquisition_metadata')
  const json = JSON.stringify(sanitized)
  if (!json || json.length > METADATA_MAX_BYTES) throw new Error('invalid_acquisition_metadata')
  return sanitized
}

export function buildAcquisitionTouchRecord(input: {
  envelope: AcquisitionEnvelope
  touch_type: AcquisitionTouchType
  occurred_at: string
  metadata?: AttributionMetadata
} & AcquisitionIdentityInput) {
  const envelope = parseAcquisitionEnvelope(input.envelope)
  const identity = parseAcquisitionIdentity(input)

  return {
    ...identity,
    channel: envelope.channel,
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
    touch_type: parseAcquisitionTouchType(input.touch_type),
    occurred_at: input.occurred_at,
    metadata: parseAcquisitionMetadata(input.metadata),
  }
}
