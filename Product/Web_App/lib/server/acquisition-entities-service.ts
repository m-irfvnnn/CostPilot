import type { AcquisitionEnvelope } from '../acquisition.ts'
import {
  buildCreatorRegistryInput,
  buildPartnerRegistryInput,
  buildReferralRegistryInput,
} from './acquisition-entities-core.ts'
import {
  upsertAcquisitionCreator,
  upsertAcquisitionPartner,
  upsertAcquisitionReferral,
} from './supabase-admin.ts'

type JsonRecord = Record<string, unknown>

export type AcquisitionEntityRegistryDeps = {
  upsertPartner: typeof upsertAcquisitionPartner
  upsertCreator: typeof upsertAcquisitionCreator
  upsertReferral: typeof upsertAcquisitionReferral
}

export function createAcquisitionEntityRegistryService(deps: AcquisitionEntityRegistryDeps) {
  return {
    async sync(input: {
      envelope: AcquisitionEnvelope
      profile_id?: string | null
      account_id?: string | null
      metadata?: JsonRecord
    }) {
      const partner = buildPartnerRegistryInput(input.envelope, input.metadata)
      if (partner) await deps.upsertPartner(partner)

      const creator = buildCreatorRegistryInput(input.envelope, input.metadata)
      if (creator) await deps.upsertCreator(creator)

      const referral = buildReferralRegistryInput(
        input.envelope,
        {
          profile_id: input.profile_id ?? null,
          account_id: input.account_id ?? null,
        },
        input.metadata,
      )
      if (referral) await deps.upsertReferral(referral)
    },
  }
}

export function createDefaultAcquisitionEntityRegistryService() {
  return createAcquisitionEntityRegistryService({
    upsertPartner: upsertAcquisitionPartner,
    upsertCreator: upsertAcquisitionCreator,
    upsertReferral: upsertAcquisitionReferral,
  })
}
