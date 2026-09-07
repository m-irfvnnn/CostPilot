import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildProductEventInsert,
  parseProductEventName,
  parseProductEventProperties,
  PRODUCT_EVENT_NAMES,
} from '../lib/server/product-events-core.ts'

const createHarness = (overrides = {}) => {
  const calls = { inserts: 0, profiles: 0, accounts: 0, health: [] }
  const deps = {
    parseToken: (header) => {
      if (!header?.startsWith('Bearer ')) return null
      return header.slice(7)
    },
    verifier: {
      async verifyIdToken(token) {
        if (token === 'bad-token') throw new Error('invalid_token')
        return { uid: 'uid-1', email: 'user@acme.com', firebase: { sign_in_provider: 'password' } }
      },
    },
    resolveProfileByUid: async () => {
      calls.profiles += 1
      return {
        id: 'profile-1',
        firebase_uid: 'uid-1',
        email: 'user@acme.com',
        display_name: 'User',
        photo_url: null,
        auth_provider: 'password',
        last_login_at: null,
        created_at: 'now',
        updated_at: 'now',
      }
    },
    resolveAccountByProfileId: async () => {
      calls.accounts += 1
      return {
        id: 'account-1',
        name: 'Acme',
        slug: 'acme',
        primary_domain: 'acme.com',
        onboarding_status: 'completed',
        created_at: 'now',
        updated_at: 'now',
      }
    },
    insertEvent: async (input) => {
      calls.inserts += 1
      return { id: 10, ...input, created_at: '2026-08-25T12:00:00.000Z' }
    },
    persistAttribution: async () => ({ ok: true }),
    evaluateAccountHealth: async (accountId, evaluationType) => {
      calls.health.push({ accountId, evaluationType })
      return [{ account_id: accountId }]
    },
    ...overrides,
  }

  return { calls, deps }
}

test('approved event names are allowlisted', () => {
  for (const name of PRODUCT_EVENT_NAMES) {
    assert.equal(parseProductEventName(name), name)
  }
  assert.throws(() => parseProductEventName('bad_event'), /invalid_event_name/)
})

test('event properties are sanitized and validated', () => {
  const props = parseProductEventProperties({
    company_size: '11–50',
    providers: ['OpenAI', { nested: true }],
    metadata: { foo: 'bar' },
  })
  assert.equal(props.company_size, '11–50')
  assert.equal(Array.isArray(props.providers), true)
  assert.equal(typeof props.metadata, 'object')
  assert.throws(() => parseProductEventProperties(null), /invalid_event_properties/)
})

test('buildProductEventInsert defaults the source to web_app', () => {
  const event = buildProductEventInsert({
    firebase_uid: 'uid-1',
    profile_id: 'profile-1',
    account_id: 'account-1',
    event_name: 'login',
    event_properties: { a: 1 },
  })

  assert.equal(event.event_source, 'web_app')
  assert.equal(event.event_trust_level, 'untrusted')
  assert.equal(event.event_name, 'login')
})

test('buildProductEventInsert accepts a retry-safe event id', () => {
  const event = buildProductEventInsert({
    event_id: 'cp_evt_account-1:dashboard_viewed:attempt-1',
    firebase_uid: 'uid-1',
    profile_id: 'profile-1',
    account_id: 'account-1',
    event_name: 'dashboard_viewed',
    event_properties: { a: 1 },
  })

  assert.equal(event.event_id, 'cp_evt_account-1:dashboard_viewed:attempt-1')
  assert.equal(event.occurred_at.length > 0, true)
  assert.throws(() => buildProductEventInsert({
    event_id: 'bad id',
    firebase_uid: 'uid-1',
    profile_id: 'profile-1',
    account_id: 'account-1',
    event_name: 'dashboard_viewed',
    event_properties: {},
  }), /invalid_event_id/)
})

test('event service writes an event with resolved profile and account', async () => {
  const { calls, deps } = createHarness()
  const { createDefaultProductEventService } = await import('../lib/server/product-events-service.ts')
  const service = createDefaultProductEventService(deps)

  const result = await service.track('Bearer good-token', {
    event_id: 'cp_evt_account-1:dashboard_viewed:unit',
    event_name: 'dashboard_viewed',
    event_properties: { source: 'unit-test' },
  })

  assert.equal(calls.profiles, 1)
  assert.equal(calls.accounts, 1)
  assert.equal(calls.inserts, 1)
  assert.deepEqual(calls.health, [{ accountId: 'account-1', evaluationType: 'engagement_refresh' }])
  assert.equal(result.event.event_id, 'cp_evt_account-1:dashboard_viewed:unit')
  assert.equal(result.event.event_trust_level, 'untrusted')
  assert.equal(result.profile.firebase_uid, 'uid-1')
  assert.equal(result.account?.id, 'account-1')
})

test('event service rejects missing or invalid tokens', async () => {
  const { deps } = createHarness()
  const { createDefaultProductEventService } = await import('../lib/server/product-events-service.ts')
  const service = createDefaultProductEventService(deps)

  await assert.rejects(() => service.track(null, { event_name: 'login', event_properties: {} }), /missing_token/)
  await assert.rejects(() => service.track('Bearer bad-token', { event_name: 'login', event_properties: {} }), /invalid_token/)
})

test('event service rejects unknown events', () => {
  assert.throws(() => parseProductEventName('signupx'), /invalid_event_name/)
})
