import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ACQUISITION_CHANNELS,
  mapLeadAcquisitionEnvelope,
  normalizeAcquisitionEnvelope,
} from '../lib/acquisition.ts'

test('web app re-exports the shared acquisition foundation', () => {
  assert.deepEqual(ACQUISITION_CHANNELS, ['inbound', 'plg', 'outbound', 'partner', 'creator', 'referral'])

  const envelope = normalizeAcquisitionEnvelope({
    channel: 'plg',
    source: 'web_app',
    source_id: 'firebase_uid',
  })

  assert.equal(envelope.channel, 'plg')
  assert.equal(envelope.source, 'web_app')
  assert.equal(envelope.source_id, 'firebase_uid')

  const leadEnvelope = mapLeadAcquisitionEnvelope({
    source_type: 'inbound',
    event_id: 'evt_web_1',
    raw_payload: {
      source: 'website',
    },
  })

  assert.equal(leadEnvelope.channel, 'inbound')
  assert.equal(leadEnvelope.source, 'website')
})
