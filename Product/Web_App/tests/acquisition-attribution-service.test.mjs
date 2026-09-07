import test from 'node:test'
import assert from 'node:assert/strict'

import {
  mapAttributedCustomerAcquisitionEnvelope,
  mapCreatorAcquisitionEnvelope,
  mapInboundAcquisitionEnvelope,
  mapPartnerAcquisitionEnvelope,
  mapPlgAcquisitionEnvelope,
  mapReferralAcquisitionEnvelope,
} from '../lib/acquisition.ts'

const createHarness = async () => {
  const state = {
    touches: [],
    nextTouchId: 1,
    profiles: new Map([
      [
        'profile-1',
        {
          id: 'profile-1',
          firebase_uid: 'firebase-uid-1',
          email: 'user@example.com',
          display_name: 'User',
          photo_url: null,
          auth_provider: 'password',
          last_login_at: null,
          first_touch_source: null,
          first_touch_medium: null,
          first_touch_campaign: null,
          first_touch_referrer: null,
          created_at: '2026-08-25T12:00:00.000Z',
          updated_at: '2026-08-25T12:00:00.000Z',
        },
      ],
      [
        'profile-2',
        {
          id: 'profile-2',
          firebase_uid: 'firebase-uid-2',
          email: 'existing@example.com',
          display_name: 'Existing',
          photo_url: null,
          auth_provider: 'password',
          last_login_at: null,
          first_touch_source: 'website',
          first_touch_medium: 'web_form',
          first_touch_campaign: 'launch_a',
          first_touch_referrer: 'https://example.com',
          created_at: '2026-08-25T12:00:00.000Z',
          updated_at: '2026-08-25T12:00:00.000Z',
        },
      ],
    ]),
  }

  const identityKeyOf = (row) => {
    if (row.profile_id) return row.profile_id
    if (row.firebase_uid) return row.firebase_uid
    if (row.lead_id) return `lead:${row.lead_id}`
    if (row.source_id) return `source:${row.source_id}`
    throw new Error('missing_identity')
  }

  const deps = {
    async getTouchByIdentity(identityKey, touchType) {
      return state.touches.find((touch) => touch.identity_key === identityKey && touch.touch_type === touchType) ?? null
    },
    async insertTouch(input) {
      const record = {
        id: `touch-${state.nextTouchId++}`,
        identity_key: identityKeyOf(input),
        created_at: input.occurred_at,
        ...input,
      }
      state.touches.push(record)
      return record
    },
    async updateTouch(id, patch) {
      const index = state.touches.findIndex((touch) => touch.id === id)
      assert.notEqual(index, -1)
      const current = state.touches[index]
      const updated = {
        ...current,
        ...patch,
        identity_key: identityKeyOf({ ...current, ...patch }),
      }
      state.touches[index] = updated
      return updated
    },
    async getProfileById(profileId) {
      return state.profiles.get(profileId) ?? null
    },
    async updateProfileFirstTouchFields(profileId, patch) {
      const current = state.profiles.get(profileId)
      assert.ok(current)
      const updated = { ...current, ...patch }
      state.profiles.set(profileId, updated)
      return updated
    },
    async linkTouchesToProfile(firebaseUid, profileId) {
      for (const touch of state.touches) {
        if (touch.firebase_uid === firebaseUid && !touch.profile_id) {
          touch.profile_id = profileId
          touch.identity_key = identityKeyOf(touch)
        }
      }
      return state.touches.filter((touch) => touch.firebase_uid === firebaseUid)
    },
    async linkTouchesToAccount(profileId, accountId) {
      for (const touch of state.touches) {
        if (touch.profile_id === profileId && !touch.account_id) {
          touch.account_id = accountId
        }
      }
      return state.touches.filter((touch) => touch.profile_id === profileId)
    },
  }

  const { createAcquisitionAttributionService } = await import('../lib/server/acquisition-attribution-service.ts')
  return {
    state,
    service: createAcquisitionAttributionService(deps),
  }
}

test('valid acquisition touch insert persists first, last, and interaction rows', async () => {
  const { service, state } = await createHarness()
  const result = await service.persist({
    profile_id: 'profile-1',
    firebase_uid: 'firebase-uid-1',
    occurred_at: '2026-08-25T12:01:00.000Z',
    envelope: mapPlgAcquisitionEnvelope({
      firebase_uid: 'firebase-uid-1',
      event_name: 'signup',
      event_source: 'web_app',
    }),
    metadata: { event_name: 'signup' },
  })

  assert.equal(state.touches.length, 3)
  assert.equal(result.first_touch?.touch_type, 'first_touch')
  assert.equal(result.last_touch?.touch_type, 'last_touch')
  assert.equal(result.interaction?.touch_type, 'interaction')
  assert.equal(state.profiles.get('profile-1')?.first_touch_source, 'web_app')
})

test('repeated first-touch persistence does not overwrite the original first touch', async () => {
  const { service, state } = await createHarness()
  await service.persist({
    profile_id: 'profile-2',
    firebase_uid: 'firebase-uid-2',
    occurred_at: '2026-08-25T12:01:00.000Z',
    envelope: mapInboundAcquisitionEnvelope({
      event_id: 'evt_1',
      raw_payload: {
        source: 'website',
        form: 'pricing_form',
        utm_campaign: 'launch_a',
        referrer: 'https://example.com',
      },
    }),
    metadata: { event_name: 'signup' },
  })

  const repeated = await service.persist({
    profile_id: 'profile-2',
    firebase_uid: 'firebase-uid-2',
    occurred_at: '2026-08-25T12:05:00.000Z',
    envelope: mapInboundAcquisitionEnvelope({
      event_id: 'evt_2',
      raw_payload: {
        source: 'demo_request',
        form: 'demo_request',
        utm_campaign: 'launch_b',
        referrer: 'https://alt.example.com',
      },
    }),
    metadata: { event_name: 'login' },
  })

  assert.equal(repeated.first_touch?.source, 'website')
  assert.equal(state.profiles.get('profile-2')?.first_touch_source, 'website')
  assert.equal(state.profiles.get('profile-2')?.first_touch_campaign, 'launch_a')
})

test('last-touch is updated while interaction history continues to append', async () => {
  const { service, state } = await createHarness()
  await service.persist({
    profile_id: 'profile-1',
    firebase_uid: 'firebase-uid-1',
    occurred_at: '2026-08-25T12:01:00.000Z',
    envelope: mapPlgAcquisitionEnvelope({
      firebase_uid: 'firebase-uid-1',
      event_name: 'signup',
      event_source: 'web_app',
    }),
    metadata: { event_name: 'signup' },
  })

  const result = await service.persist({
    profile_id: 'profile-1',
    firebase_uid: 'firebase-uid-1',
    occurred_at: '2026-08-25T12:10:00.000Z',
    envelope: mapPlgAcquisitionEnvelope({
      firebase_uid: 'firebase-uid-1',
      event_name: 'dashboard_viewed',
      event_source: 'web_app',
    }),
    metadata: { event_name: 'dashboard_viewed' },
  })

  const lastTouches = state.touches.filter((touch) => touch.touch_type === 'last_touch')
  const interactions = state.touches.filter((touch) => touch.touch_type === 'interaction')

  assert.equal(lastTouches.length, 1)
  assert.equal(interactions.length, 2)
  assert.equal(result.last_touch?.medium, 'dashboard_viewed')
})

test('profile and account linkage updates prior firebase-only touches', async () => {
  const { service, state } = await createHarness()
  await service.persist({
    firebase_uid: 'firebase-uid-1',
    occurred_at: '2026-08-25T12:00:00.000Z',
    envelope: mapPlgAcquisitionEnvelope({
      firebase_uid: 'firebase-uid-1',
      event_name: 'signup',
      event_source: 'web_app',
    }),
    metadata: { event_name: 'signup' },
  })

  await service.persist({
    profile_id: 'profile-1',
    account_id: 'account-1',
    firebase_uid: 'firebase-uid-1',
    occurred_at: '2026-08-25T12:02:00.000Z',
    envelope: mapPlgAcquisitionEnvelope({
      firebase_uid: 'firebase-uid-1',
      profile_id: 'profile-1',
      event_name: 'login',
      event_source: 'web_app',
    }),
    metadata: { event_name: 'login' },
    persist_first_touch: false,
    persist_last_touch: false,
    persist_interaction: false,
  })

  assert.equal(state.touches.every((touch) => touch.profile_id === 'profile-1'), true)
  assert.equal(state.touches.every((touch) => touch.account_id === 'account-1'), true)
})

test('lead linkage is supported for pre-crm attribution rows', async () => {
  const { service } = await createHarness()
  const result = await service.persist({
    lead_id: 42,
    occurred_at: '2026-08-25T12:00:00.000Z',
    envelope: mapInboundAcquisitionEnvelope({
      event_id: 'evt_lead_42',
      raw_payload: {
        source: 'website',
        source_id: 'src_precrm_42',
      },
    }),
    metadata: { event_name: 'lead.captured' },
  })

  assert.equal(result.first_touch?.lead_id, 42)
  assert.equal(result.last_touch?.identity_key, 'lead:42')
})

test('creator envelope supports nullable partner and referral identifiers', async () => {
  const { service } = await createHarness()
  const result = await service.persist({
    firebase_uid: 'creator-firebase-1',
    occurred_at: '2026-08-25T12:00:00.000Z',
    envelope: mapCreatorAcquisitionEnvelope({
      creator_id: 'creator_123',
      raw_payload: {
        source: 'youtube',
      },
    }),
    metadata: { event_name: 'creator_click' },
  })

  assert.equal(result.first_touch?.creator_id, 'creator_123')
  assert.equal(result.first_touch?.partner_id, null)
  assert.equal(result.first_touch?.referral_id, null)
})

test('partner acquisition persists partner channel and identifier', async () => {
  const { service } = await createHarness()
  const result = await service.persist({
    firebase_uid: 'partner-firebase-1',
    occurred_at: '2026-08-25T12:00:00.000Z',
    envelope: mapPartnerAcquisitionEnvelope({
      partner_id: 'partner_123',
      raw_payload: {
        source: 'consultant',
        campaign: 'Partner Launch',
      },
    }),
    metadata: { event_name: 'partner_click' },
  })

  assert.equal(result.first_touch?.channel, 'partner')
  assert.equal(result.first_touch?.partner_id, 'partner_123')
  assert.equal(result.last_touch?.source, 'consultant')
})

test('referral acquisition persists referral channel and identifier', async () => {
  const { service } = await createHarness()
  const result = await service.persist({
    firebase_uid: 'referral-firebase-1',
    occurred_at: '2026-08-25T12:00:00.000Z',
    envelope: mapReferralAcquisitionEnvelope({
      referral_id: 'ref_123',
      raw_payload: {
        source: 'invite',
        medium: 'referral',
      },
    }),
    metadata: { event_name: 'signup', referral_code: 'invite_123' },
  })

  assert.equal(result.first_touch?.channel, 'referral')
  assert.equal(result.first_touch?.referral_id, 'ref_123')
  assert.equal(result.interaction?.medium, 'referral')
})

test('customer attribution mapper upgrades plg events to partner, creator, or referral when identifiers are present', () => {
  const partner = mapAttributedCustomerAcquisitionEnvelope({
    firebase_uid: 'firebase-uid-partner',
    event_name: 'signup',
    event_source: 'web_app',
    event_properties: {
      partner_id: 'partner_1',
      source: 'agency',
    },
  })

  const creator = mapAttributedCustomerAcquisitionEnvelope({
    firebase_uid: 'firebase-uid-creator',
    event_name: 'signup',
    event_source: 'web_app',
    event_properties: {
      creator_id: 'creator_1',
      source: 'youtube',
    },
  })

  const referral = mapAttributedCustomerAcquisitionEnvelope({
    firebase_uid: 'firebase-uid-referral',
    event_name: 'signup',
    event_source: 'web_app',
    event_properties: {
      referral_id: 'referral_1',
      source: 'invite',
    },
  })

  assert.equal(partner.channel, 'partner')
  assert.equal(creator.channel, 'creator')
  assert.equal(referral.channel, 'referral')
})

test('invalid acquisition envelopes are rejected', async () => {
  const { service } = await createHarness()
  await assert.rejects(
    () =>
      service.persist({
        firebase_uid: 'firebase-uid-1',
        occurred_at: '2026-08-25T12:00:00.000Z',
        envelope: { channel: 'bad_channel' },
      }),
    /invalid_acquisition_channel/,
  )
})
