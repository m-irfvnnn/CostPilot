import {
  buildAcquisitionTouchRecord,
  parseAcquisitionEnvelope,
  type AcquisitionIdentityInput,
  type AcquisitionTouchType,
  type AttributionMetadata,
} from './acquisition-attribution-core.ts'
import {
  getAcquisitionTouchByIdentity,
  getProfileById,
  insertAcquisitionTouch,
  linkAcquisitionTouchesToAccount,
  linkAcquisitionTouchesToProfile,
  type SupabaseAcquisitionTouch,
  type SupabaseProfile,
  updateAcquisitionTouch,
  updateProfileFirstTouchFields,
} from './supabase-admin.ts'
import { createDefaultAcquisitionEntityRegistryService } from './acquisition-entities-service.ts'

type PersistAcquisitionInput = AcquisitionIdentityInput & {
  envelope: unknown
  occurred_at: string
  metadata?: AttributionMetadata
  persist_first_touch?: boolean
  persist_last_touch?: boolean
  persist_interaction?: boolean
}

type PersistAcquisitionResult = {
  first_touch: SupabaseAcquisitionTouch | null
  last_touch: SupabaseAcquisitionTouch | null
  interaction: SupabaseAcquisitionTouch | null
}

export type AcquisitionAttributionDependencies = {
  getTouchByIdentity: typeof getAcquisitionTouchByIdentity
  insertTouch: typeof insertAcquisitionTouch
  updateTouch: typeof updateAcquisitionTouch
  getProfileById: typeof getProfileById
  updateProfileFirstTouchFields: typeof updateProfileFirstTouchFields
  linkTouchesToProfile: typeof linkAcquisitionTouchesToProfile
  linkTouchesToAccount: typeof linkAcquisitionTouchesToAccount
  syncEntities?: (input: {
    envelope: ReturnType<typeof parseAcquisitionEnvelope>
    profile_id: string | null
    account_id: string | null
    metadata?: AttributionMetadata
  }) => Promise<void>
}

function buildIdentityKey(input: {
  profile_id: string | null
  firebase_uid: string | null
  lead_id: number | null
  source_id: string | null
}) {
  if (input.profile_id) return input.profile_id
  if (input.firebase_uid) return input.firebase_uid
  if (input.lead_id) return `lead:${input.lead_id}`
  if (input.source_id) return `source:${input.source_id}`
  throw new Error('acquisition_identity_required')
}

function buildFirstTouchPatch(profile: SupabaseProfile, touch: {
  source: string | null
  medium: string | null
  campaign: string | null
  referrer: string | null
}) {
  const patch: {
    first_touch_source?: string | null
    first_touch_medium?: string | null
    first_touch_campaign?: string | null
    first_touch_referrer?: string | null
  } = {}

  if (!profile.first_touch_source && touch.source) patch.first_touch_source = touch.source
  if (!profile.first_touch_medium && touch.medium) patch.first_touch_medium = touch.medium
  if (!profile.first_touch_campaign && touch.campaign) patch.first_touch_campaign = touch.campaign
  if (!profile.first_touch_referrer && touch.referrer) patch.first_touch_referrer = touch.referrer

  return patch
}

async function maybeLinkIdentity(deps: AcquisitionAttributionDependencies, identity: {
  profile_id: string | null
  account_id: string | null
  firebase_uid: string | null
}) {
  if (identity.profile_id && identity.firebase_uid) {
    await deps.linkTouchesToProfile(identity.firebase_uid, identity.profile_id)
  }

  if (identity.profile_id && identity.account_id) {
    await deps.linkTouchesToAccount(identity.profile_id, identity.account_id)
  }
}

async function upsertTouchByIdentity(
  deps: AcquisitionAttributionDependencies,
  input: Parameters<typeof buildAcquisitionTouchRecord>[0],
) {
  const record = buildAcquisitionTouchRecord(input)
  const identityKey = buildIdentityKey({
    profile_id: record.profile_id,
    firebase_uid: record.firebase_uid,
    lead_id: record.lead_id,
    source_id: record.source_id,
  })
  const existing = await deps.getTouchByIdentity(identityKey, record.touch_type)

  if (!existing) {
    return deps.insertTouch(record)
  }

  return deps.updateTouch(existing.id, {
    profile_id: record.profile_id,
    account_id: record.account_id,
    lead_id: record.lead_id,
    firebase_uid: record.firebase_uid,
    channel: record.channel,
    source: record.source,
    source_id: record.source_id,
    medium: record.medium,
    campaign: record.campaign,
    referrer: record.referrer,
    utm_source: record.utm_source,
    utm_medium: record.utm_medium,
    utm_campaign: record.utm_campaign,
    utm_content: record.utm_content,
    utm_term: record.utm_term,
    partner_id: record.partner_id,
    creator_id: record.creator_id,
    referral_id: record.referral_id,
    occurred_at: record.occurred_at,
    metadata: record.metadata,
  })
}

export function createAcquisitionAttributionService(deps: AcquisitionAttributionDependencies) {
  return {
    async persist(input: PersistAcquisitionInput): Promise<PersistAcquisitionResult> {
      const envelope = parseAcquisitionEnvelope(input.envelope)
      const persistFirstTouch = input.persist_first_touch ?? true
      const persistLastTouch = input.persist_last_touch ?? true
      const persistInteraction = input.persist_interaction ?? true

      const baseRecord = buildAcquisitionTouchRecord({
        ...input,
        envelope,
        touch_type: 'interaction',
      })

      if (deps.syncEntities) {
        await deps.syncEntities({
          envelope,
          profile_id: baseRecord.profile_id,
          account_id: baseRecord.account_id,
          metadata: input.metadata,
        })
      }

      await maybeLinkIdentity(deps, {
        profile_id: baseRecord.profile_id,
        account_id: baseRecord.account_id,
        firebase_uid: baseRecord.firebase_uid,
      })

      let firstTouch: SupabaseAcquisitionTouch | null = null
      let lastTouch: SupabaseAcquisitionTouch | null = null
      let interaction: SupabaseAcquisitionTouch | null = null

      const identityKey = buildIdentityKey({
        profile_id: baseRecord.profile_id,
        firebase_uid: baseRecord.firebase_uid,
        lead_id: baseRecord.lead_id,
        source_id: baseRecord.source_id,
      })

      if (persistFirstTouch) {
        firstTouch = await deps.getTouchByIdentity(identityKey, 'first_touch')
        if (!firstTouch) {
          firstTouch = await deps.insertTouch({
            ...baseRecord,
            touch_type: 'first_touch',
          })
        }
      }

      if (persistLastTouch) {
        lastTouch = await upsertTouchByIdentity(deps, {
          ...input,
          envelope,
          touch_type: 'last_touch',
        })
      }

      if (persistInteraction) {
        interaction = await deps.insertTouch({
          ...baseRecord,
          touch_type: 'interaction',
        })
      }

      if (persistFirstTouch && baseRecord.profile_id) {
        const profile = await deps.getProfileById(baseRecord.profile_id)
        if (profile) {
          const patch = buildFirstTouchPatch(profile, {
            source: firstTouch?.source ?? baseRecord.source,
            medium: firstTouch?.medium ?? baseRecord.medium,
            campaign: firstTouch?.campaign ?? baseRecord.campaign,
            referrer: firstTouch?.referrer ?? baseRecord.referrer,
          })

          if (Object.keys(patch).length > 0) {
            await deps.updateProfileFirstTouchFields(baseRecord.profile_id, patch)
          }
        }
      }

      return {
        first_touch: firstTouch,
        last_touch: lastTouch,
        interaction,
      }
    },
  }
}

export function createDefaultAcquisitionAttributionService() {
  return createAcquisitionAttributionService({
    getTouchByIdentity: getAcquisitionTouchByIdentity,
    insertTouch: insertAcquisitionTouch,
    updateTouch: updateAcquisitionTouch,
    getProfileById,
    updateProfileFirstTouchFields,
    linkTouchesToProfile: linkAcquisitionTouchesToProfile,
    linkTouchesToAccount: linkAcquisitionTouchesToAccount,
    syncEntities: async (input) => createDefaultAcquisitionEntityRegistryService().sync(input),
  })
}
