import type { AcquisitionEnvelope } from '../acquisition.ts'

type JsonRecord = Record<string, unknown>

type AcquisitionIdentityContext = {
  profile_id?: string | null
  account_id?: string | null
}

export type AcquisitionPartnerInput = {
  partner_id: string
  name: string
  partner_type: 'agency' | 'consultant'
  status: 'active' | 'inactive' | 'paused'
  source_identifier: string | null
  default_campaign: string | null
  metadata: JsonRecord
}

export type AcquisitionCreatorInput = {
  creator_id: string
  name: string
  platform: 'youtube' | 'linkedin' | 'newsletter' | 'podcast'
  status: 'active' | 'inactive' | 'paused'
  source_identifier: string | null
  default_campaign: string | null
  metadata: JsonRecord
}

export type AcquisitionReferralInput = {
  referral_id: string
  referral_code: string
  referring_profile_id: string | null
  referring_account_id: string | null
  referring_partner_id: string | null
  status: 'active' | 'inactive' | 'redeemed'
  metadata: JsonRecord
}

function isPlainObject(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readMetadataValue(metadata: JsonRecord | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizePartnerType(value: string | null): 'agency' | 'consultant' {
  return value === 'consultant' ? 'consultant' : 'agency'
}

function normalizeCreatorPlatform(value: string | null): 'youtube' | 'linkedin' | 'newsletter' | 'podcast' {
  if (value === 'linkedin' || value === 'newsletter' || value === 'podcast') return value
  return 'youtube'
}

function normalizePartnerStatus(value: string | null): 'active' | 'inactive' | 'paused' {
  if (value === 'inactive' || value === 'paused') return value
  return 'active'
}

function normalizeCreatorStatus(value: string | null): 'active' | 'inactive' | 'paused' {
  if (value === 'inactive' || value === 'paused') return value
  return 'active'
}

function normalizeReferralStatus(value: string | null): 'active' | 'inactive' | 'redeemed' {
  if (value === 'inactive' || value === 'redeemed') return value
  return 'active'
}

function sanitizeMetadata(input: JsonRecord | undefined, extras: JsonRecord) {
  return {
    ...(isPlainObject(input) ? input : {}),
    ...extras,
  }
}

export function buildPartnerRegistryInput(
  envelope: AcquisitionEnvelope,
  metadata: JsonRecord | undefined = {},
): AcquisitionPartnerInput | null {
  if (!envelope.partner_id) return null

  return {
    partner_id: envelope.partner_id,
    name: readMetadataValue(metadata, 'partner_name') ?? envelope.partner_id,
    partner_type: normalizePartnerType(readMetadataValue(metadata, 'partner_type') ?? envelope.source),
    status: normalizePartnerStatus(readMetadataValue(metadata, 'partner_status')),
    source_identifier: envelope.source_id,
    default_campaign: envelope.campaign,
    metadata: sanitizeMetadata(metadata, {
      source: envelope.source,
      medium: envelope.medium,
      referrer: envelope.referrer,
    }),
  }
}

export function buildCreatorRegistryInput(
  envelope: AcquisitionEnvelope,
  metadata: JsonRecord | undefined = {},
): AcquisitionCreatorInput | null {
  if (!envelope.creator_id) return null

  return {
    creator_id: envelope.creator_id,
    name: readMetadataValue(metadata, 'creator_name') ?? envelope.creator_id,
    platform: normalizeCreatorPlatform(readMetadataValue(metadata, 'creator_platform') ?? envelope.source),
    status: normalizeCreatorStatus(readMetadataValue(metadata, 'creator_status')),
    source_identifier: envelope.source_id,
    default_campaign: envelope.campaign,
    metadata: sanitizeMetadata(metadata, {
      source: envelope.source,
      medium: envelope.medium,
      referrer: envelope.referrer,
    }),
  }
}

export function buildReferralRegistryInput(
  envelope: AcquisitionEnvelope,
  identity: AcquisitionIdentityContext = {},
  metadata: JsonRecord | undefined = {},
): AcquisitionReferralInput | null {
  if (!envelope.referral_id) return null

  return {
    referral_id: envelope.referral_id,
    referral_code: readMetadataValue(metadata, 'referral_code') ?? envelope.referral_id,
    referring_profile_id: readMetadataValue(metadata, 'referring_profile_id') ?? identity.profile_id ?? null,
    referring_account_id: readMetadataValue(metadata, 'referring_account_id') ?? identity.account_id ?? null,
    referring_partner_id: readMetadataValue(metadata, 'referring_partner_id') ?? envelope.partner_id ?? null,
    status: normalizeReferralStatus(readMetadataValue(metadata, 'referral_status')),
    metadata: sanitizeMetadata(metadata, {
      source: envelope.source,
      medium: envelope.medium,
      campaign: envelope.campaign,
      referrer: envelope.referrer,
    }),
  }
}
