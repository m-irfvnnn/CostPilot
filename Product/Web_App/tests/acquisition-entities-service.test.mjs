import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCreatorRegistryInput,
  buildPartnerRegistryInput,
  buildReferralRegistryInput,
} from '../lib/server/acquisition-entities-core.ts'
import {
  mapCreatorAcquisitionEnvelope,
  mapPartnerAcquisitionEnvelope,
  mapReferralAcquisitionEnvelope,
} from '../lib/acquisition.ts'

test('partner registry input reuses normalized partner attribution fields', () => {
  const input = buildPartnerRegistryInput(
    mapPartnerAcquisitionEnvelope({
      partner_id: 'partner_1',
      raw_payload: {
        source: 'consultant',
        campaign: 'Partner Launch',
      },
    }),
    {
      partner_name: 'RevOps Allies',
      partner_type: 'consultant',
    },
  )

  assert.deepEqual(input, {
    partner_id: 'partner_1',
    name: 'RevOps Allies',
    partner_type: 'consultant',
    status: 'active',
    source_identifier: 'partner_1',
    default_campaign: 'partner_launch',
    metadata: {
      partner_name: 'RevOps Allies',
      partner_type: 'consultant',
      source: 'consultant',
      medium: 'partner',
      referrer: null,
    },
  })
})

test('creator registry input reuses normalized creator attribution fields', () => {
  const input = buildCreatorRegistryInput(
    mapCreatorAcquisitionEnvelope({
      creator_id: 'creator_1',
      raw_payload: {
        source: 'podcast',
        medium: 'influencer',
      },
    }),
    {
      creator_name: 'Ops Weekly',
      creator_platform: 'podcast',
    },
  )

  assert.deepEqual(input, {
    creator_id: 'creator_1',
    name: 'Ops Weekly',
    platform: 'podcast',
    status: 'active',
    source_identifier: 'creator_1',
    default_campaign: null,
    metadata: {
      creator_name: 'Ops Weekly',
      creator_platform: 'podcast',
      source: 'podcast',
      medium: 'influencer',
      referrer: null,
    },
  })
})

test('referral registry input supports identity linkage and referral codes', () => {
  const input = buildReferralRegistryInput(
    mapReferralAcquisitionEnvelope({
      referral_id: 'ref_1',
      raw_payload: {
        source: 'invite',
      },
    }),
    {
      profile_id: 'profile_1',
      account_id: 'account_1',
    },
    {
      referral_code: 'invite-abc',
      referring_partner_id: 'partner_9',
    },
  )

  assert.deepEqual(input, {
    referral_id: 'ref_1',
    referral_code: 'invite-abc',
    referring_profile_id: 'profile_1',
    referring_account_id: 'account_1',
    referring_partner_id: 'partner_9',
    status: 'active',
    metadata: {
      referral_code: 'invite-abc',
      referring_partner_id: 'partner_9',
      source: 'invite',
      medium: 'referral',
      campaign: null,
      referrer: null,
    },
  })
})

test('entity registry service upserts every applicable entity row from one envelope', async () => {
  const calls = []
  const { createAcquisitionEntityRegistryService } = await import('../lib/server/acquisition-entities-service.ts')
  const service = createAcquisitionEntityRegistryService({
    upsertPartner: async (input) => {
      calls.push(['partner', input])
      return input
    },
    upsertCreator: async (input) => {
      calls.push(['creator', input])
      return input
    },
    upsertReferral: async (input) => {
      calls.push(['referral', input])
      return input
    },
  })

  await service.sync({
    envelope: mapReferralAcquisitionEnvelope({
      referral_id: 'ref_1',
      raw_payload: { source: 'invite', partner_id: 'partner_1' },
    }),
    profile_id: 'profile_1',
    account_id: 'account_1',
    metadata: { referral_code: 'invite_1' },
  })

  assert.equal(calls.length, 2)
  assert.deepEqual(
    calls.map((entry) => entry[0]),
    ['partner', 'referral'],
  )
  assert.equal(calls[0][1].partner_id, 'partner_1')
  assert.equal(calls[1][1].referral_id, 'ref_1')
})
