import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveAcquisitionAttribution } from '../lib/server/acquisition-resolver-core.ts'

test('resolver returns explainable first-touch, last-touch, and latest interaction snapshots', () => {
  const resolved = resolveAcquisitionAttribution([
    {
      id: 'touch-1',
      touch_type: 'first_touch',
      occurred_at: '2026-08-25T12:00:00.000Z',
      channel: 'inbound',
      source: 'website',
      source_id: 'evt_1',
      medium: 'pricing_form',
      campaign: 'launch_a',
      referrer: 'https://example.com',
      lead_id: 10,
    },
    {
      id: 'touch-2',
      touch_type: 'interaction',
      occurred_at: '2026-08-25T12:05:00.000Z',
      channel: 'creator',
      source: 'youtube',
      source_id: 'creator_1',
      medium: 'influencer',
      campaign: 'launch_a',
      referrer: 'https://youtube.com/watch?v=1',
      creator_id: 'creator_1',
      profile_id: 'profile_1',
      firebase_uid: 'firebase_1',
    },
    {
      id: 'touch-3',
      touch_type: 'last_touch',
      occurred_at: '2026-08-25T12:10:00.000Z',
      channel: 'referral',
      source: 'invite',
      source_id: 'ref_1',
      medium: 'referral',
      campaign: 'launch_b',
      referrer: null,
      referral_id: 'ref_1',
      profile_id: 'profile_1',
      account_id: 'account_1',
      firebase_uid: 'firebase_1',
    },
    {
      id: 'touch-4',
      touch_type: 'interaction',
      occurred_at: '2026-08-25T12:15:00.000Z',
      channel: 'referral',
      source: 'invite',
      source_id: 'ref_1',
      medium: 'referral',
      campaign: 'launch_b',
      referrer: null,
      referral_id: 'ref_1',
      profile_id: 'profile_1',
      account_id: 'account_1',
      firebase_uid: 'firebase_1',
    },
  ])

  assert.equal(resolved.first_touch?.id, 'touch-1')
  assert.equal(resolved.last_touch?.id, 'touch-3')
  assert.equal(resolved.latest_interaction?.id, 'touch-4')
  assert.equal(resolved.interaction_count, 2)
  assert.deepEqual(resolved.channels_seen, ['inbound', 'creator', 'referral'])
  assert.deepEqual(resolved.sources_seen, ['website', 'youtube', 'invite'])
  assert.deepEqual(resolved.campaigns_seen, ['launch_a', 'launch_b'])
  assert.deepEqual(resolved.identity, {
    lead_id: null,
    profile_id: 'profile_1',
    account_id: 'account_1',
    firebase_uid: 'firebase_1',
  })
})

test('resolver falls back to chronological touches when dedicated touch types are absent', () => {
  const resolved = resolveAcquisitionAttribution([
    {
      id: 'touch-a',
      touch_type: 'interaction',
      occurred_at: '2026-08-25T12:00:00.000Z',
      channel: 'partner',
      source: 'agency',
      source_id: 'partner_1',
      medium: 'partner',
      campaign: null,
      referrer: null,
      partner_id: 'partner_1',
    },
    {
      id: 'touch-b',
      touch_type: 'interaction',
      occurred_at: '2026-08-25T12:10:00.000Z',
      channel: 'outbound',
      source: 'scraper',
      source_id: 'example.com',
      medium: 'signal_outbound',
      campaign: 'signal_q3',
      referrer: 'https://example.com/team',
    },
  ])

  assert.equal(resolved.first_touch?.id, 'touch-a')
  assert.equal(resolved.last_touch?.id, 'touch-b')
  assert.equal(resolved.latest_interaction?.id, 'touch-b')
})
