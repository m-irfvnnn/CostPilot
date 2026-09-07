import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPayuWebhookIdempotencyKey,
  createDefaultPayuCheckoutService,
  createDefaultPayuWebhookService,
  createPayuRequestHash,
  createPayuResponseHash,
  getPayuServerConfig,
  parsePayuWebhookPayload,
} from '../lib/server/payu.ts'

const baseEnv = {
  PAYU_MERCHANT_KEY: 'merchant_test_key',
  PAYU_SALT: 'merchant_test_salt',
  PAYU_ENV: 'test',
  PAYU_BASE_URL: 'https://test.payu.in',
}

test('payu env validation enforces test mode and safe base url', () => {
  const config = getPayuServerConfig(baseEnv)
  assert.equal(config.env, 'test')
  assert.equal(config.baseUrl, 'https://test.payu.in')
  assert.equal(config.paymentUrl, 'https://test.payu.in/_payment')
  assert.throws(() => getPayuServerConfig({ ...baseEnv, PAYU_ENV: 'live' }), /invalid_payu_env/)
  assert.throws(() => getPayuServerConfig({ ...baseEnv, PAYU_BASE_URL: 'https://secure.payu.in' }), /invalid_payu_base_url/)
})

test('request hash generation matches the documented regular hosted-checkout sequence', () => {
  const hash = createPayuRequestHash(
    {
      key: 'gtKFFx',
      txnid: '123456789',
      amount: '10.00',
      productinfo: 'Test Product',
      firstname: 'John',
      email: 'john@example.com',
    },
    'eCwWELxi',
  )

  assert.equal(
    hash,
    'e5bc15c618ad4d502dfa4fa7bf625cbd8985f5715ef83af21183e6992f4d4dbd80789f51b58eec66dde2ef2ccaa23ad30c7251a8ba0a784a8640002866270794',
  )
})

test('valid webhook verification succeeds and normalizes a deferred persistence result', () => {
  const payload = {
    key: baseEnv.PAYU_MERCHANT_KEY,
    txnid: 'cp_growth_123',
    amount: '1.00',
    productinfo: 'CostPilot Growth TEST Monthly',
    firstname: 'Test User',
    email: 'user@example.com',
    status: 'success',
    udf1: 'growth',
    udf2: 'account_123',
    udf3: 'profile_123',
    udf4: 'https://costpilot.test/billing/payu/success',
    udf5: 'https://costpilot.test/billing/payu/failure',
    mihpayid: 'payu_123',
  }
  payload.hash = createPayuResponseHash(payload, baseEnv.PAYU_SALT)

  const service = createDefaultPayuWebhookService({
    getConfig: () => ({ ...getPayuServerConfig(baseEnv), salt: baseEnv.PAYU_SALT }),
  })

  const result = service.handle(payload)
  assert.equal(result.verification_status, 'verified')
  assert.equal(result.payment_reference.txnid, 'cp_growth_123')
  assert.equal(result.payment_reference.mihpayid, 'payu_123')
  assert.equal(result.persistence_status, 'deferred_until_phase6')
  assert.equal(result.idempotency_key, buildPayuWebhookIdempotencyKey(payload))
})

test('invalid webhook hash is rejected', () => {
  const service = createDefaultPayuWebhookService({
    getConfig: () => ({ ...getPayuServerConfig(baseEnv), salt: baseEnv.PAYU_SALT }),
  })

  assert.throws(
    () =>
      service.handle({
        key: baseEnv.PAYU_MERCHANT_KEY,
        txnid: 'cp_growth_123',
        amount: '1.00',
        productinfo: 'CostPilot Growth TEST Monthly',
        firstname: 'Test User',
        email: 'user@example.com',
        status: 'success',
        hash: 'bad-hash',
      }),
    /invalid_payu_hash/,
  )
})

test('modified amount or transaction id invalidates webhook verification', () => {
  const original = {
    key: baseEnv.PAYU_MERCHANT_KEY,
    txnid: 'cp_growth_123',
    amount: '1.00',
    productinfo: 'CostPilot Growth TEST Monthly',
    firstname: 'Test User',
    email: 'user@example.com',
    status: 'success',
    mihpayid: 'payu_123',
  }
  const hash = createPayuResponseHash(original, baseEnv.PAYU_SALT)
  const service = createDefaultPayuWebhookService({
    getConfig: () => ({ ...getPayuServerConfig(baseEnv), salt: baseEnv.PAYU_SALT }),
  })

  assert.throws(() => service.handle({ ...original, hash, amount: '2.00' }), /invalid_payu_hash/)
  assert.throws(() => service.handle({ ...original, hash, txnid: 'cp_growth_999' }), /invalid_payu_hash/)
})

test('duplicate-event readiness uses a stable idempotency key', () => {
  const payload = {
    txnid: 'cp_growth_123',
    mihpayid: 'payu_123',
    status: 'success',
  }

  assert.equal(buildPayuWebhookIdempotencyKey(payload), buildPayuWebhookIdempotencyKey(payload))
  assert.notEqual(
    buildPayuWebhookIdempotencyKey(payload),
    buildPayuWebhookIdempotencyKey({ ...payload, status: 'failed' }),
  )
})

test('missing required webhook fields are rejected', () => {
  assert.throws(() => parsePayuWebhookPayload({ key: 'merchant_key' }), /missing_payu_fields/)
})

test('checkout foundation is server-only and never exposes the salt', async () => {
  const service = createDefaultPayuCheckoutService({
    parseToken: (header) => (header?.startsWith('Bearer ') ? header.slice(7) : null),
    verifier: {
      async verifyIdToken(token) {
        if (token === 'bad') throw new Error('invalid_token')
        return { uid: 'uid_123', email: 'user@example.com' }
      },
    },
    resolveProfileByUid: async () => ({
      id: 'profile_123',
      firebase_uid: 'uid_123',
      email: 'user@example.com',
      display_name: 'Test User',
      photo_url: null,
      auth_provider: 'password',
      last_login_at: null,
      first_touch_source: null,
      first_touch_medium: null,
      first_touch_campaign: null,
      first_touch_referrer: null,
      created_at: 'now',
      updated_at: 'now',
    }),
    resolveAccountByProfileId: async () => ({
      id: 'account_123',
      name: 'Acme Workspace',
      slug: 'acme',
      primary_domain: 'acme.com',
      onboarding_status: 'completed',
      created_at: 'now',
      updated_at: 'now',
    }),
    getConfig: () => ({ ...getPayuServerConfig(baseEnv), salt: baseEnv.PAYU_SALT }),
    now: () => new Date('2026-08-28T10:00:00.000Z'),
    generateTxnId: () => 'cp_growth_fixed',
  })

  const result = await service.build(
    'Bearer good',
    { plan_id: 'growth', success_path: '/billing/payu/success', failure_path: '/billing/payu/failure' },
    'https://costpilot.test',
  )

  assert.equal(result.payment_url, 'https://test.payu.in/_payment')
  assert.equal(result.test_mode, true)
  assert.equal(result.callback_authority, 'webhook')
  assert.equal('salt' in result.form_fields, false)
  assert.equal(JSON.stringify(result).includes(baseEnv.PAYU_SALT), false)
  assert.equal(result.form_fields.hash.length > 0, true)
  assert.equal(result.form_fields.phone, '9999999999')
})
