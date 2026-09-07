import { mapAttributedCustomerAcquisitionEnvelope } from '../acquisition.ts'
import { createDefaultAcquisitionAttributionService } from './acquisition-attribution-service.ts'
import { buildProductEventInsert, type ProductEventName, type VerifiedFirebaseToken } from './product-events-core.ts'
import { parseBearerToken } from './profile-sync-core.ts'
import { getFirebaseAdminAuth } from './firebase-admin.ts'
import {
  evaluateAccountHealth,
  getAccountByProfileId,
  getProfileByFirebaseUid,
  insertProductEvent,
  type SupabaseAccount,
  type SupabaseProfile,
} from './supabase-admin.ts'

export type ProductEventServiceDeps = {
  parseToken?: (header: string | null) => string | null
  verifier?: ReturnType<typeof getFirebaseAdminAuth>
  resolveProfileByUid?: (firebaseUid: string) => Promise<SupabaseProfile | null>
  resolveAccountByProfileId?: (profileId: string) => Promise<SupabaseAccount | null>
  insertEvent?: typeof insertProductEvent
  persistAttribution?: (input: {
    profile_id: string | null
    account_id: string | null
    firebase_uid: string
    occurred_at: string
    envelope: unknown
    metadata: Record<string, unknown>
  }) => Promise<unknown>
  evaluateAccountHealth?: typeof evaluateAccountHealth
  now?: () => string
}

export type ProductEventServiceInput = {
  event_id?: string | null
  event_name: ProductEventName
  event_properties: Record<string, unknown>
}

export function createDefaultProductEventService(deps: ProductEventServiceDeps = {}) {
  const parseToken = deps.parseToken ?? parseBearerToken
  const verifier = deps.verifier ?? getFirebaseAdminAuth()
  const resolveProfileByUid = deps.resolveProfileByUid ?? getProfileByFirebaseUid
  const resolveAccountByProfileId = deps.resolveAccountByProfileId ?? getAccountByProfileId
  const insertEvent = deps.insertEvent ?? insertProductEvent
  const runAccountHealth = deps.evaluateAccountHealth ?? evaluateAccountHealth
  const persistAttribution =
    deps.persistAttribution ??
    (async (input) =>
      createDefaultAcquisitionAttributionService().persist({
        ...input,
      }))

  return {
    async track(authHeader: string | null, input: ProductEventServiceInput) {
      const token = parseToken(authHeader)
      if (!token) throw new Error('missing_token')

      const verified = (await verifier.verifyIdToken(token, true)) as VerifiedFirebaseToken
      const profile = await resolveProfileByUid(verified.uid)
      if (!profile) throw new Error('profile_not_found')

      const account = await resolveAccountByProfileId(profile.id)
      const event = buildProductEventInsert({
        event_id: input.event_id,
        firebase_uid: verified.uid,
        profile_id: profile.id,
        account_id: account?.id ?? null,
        event_name: input.event_name,
        event_source: 'web_app',
        event_trust_level: 'untrusted',
        event_properties: input.event_properties,
      })

      const record = await insertEvent(event)
      await persistAttribution({
        profile_id: profile.id,
        account_id: account?.id ?? null,
        firebase_uid: verified.uid,
        occurred_at: record.created_at,
        envelope: mapAttributedCustomerAcquisitionEnvelope({
          firebase_uid: verified.uid,
          profile_id: profile.id,
          event_name: input.event_name,
          event_source: event.event_source,
          event_properties: event.event_properties,
        }),
        metadata: {
          event_name: input.event_name,
          event_source: event.event_source,
        },
      })

      if (
        account?.id &&
        ['dashboard_viewed', 'forecast_viewed', 'recommendation_viewed', 'plan_selected', 'upgrade_requested'].includes(input.event_name)
      ) {
        await runAccountHealth(account.id, 'engagement_refresh')
      }

      return {
        event: {
          id: record.id,
          event_id: record.event_id,
          event_name: record.event_name,
          event_source: record.event_source,
          event_trust_level: record.event_trust_level,
          occurred_at: record.occurred_at,
          created_at: record.created_at,
        },
        profile: {
          id: profile.id,
          firebase_uid: profile.firebase_uid,
        },
        account: account ? { id: account.id, name: account.name } : null,
      }
    },
  }
}
