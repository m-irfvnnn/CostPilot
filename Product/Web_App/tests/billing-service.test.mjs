import test from 'node:test'
import assert from 'node:assert/strict'

import { createDefaultBillingService, isVerifiedSuccessfulPayment } from '../lib/server/billing-service.ts'

function createBillingHarness() {
  const calls = {
    transactions: [],
    plans: [],
    events: [],
    health: [],
    accounts: [],
    memberships: [],
  }

  const service = createDefaultBillingService({
    parseToken: (header) => (header?.startsWith('Bearer ') ? header.slice(7) : null),
    verifier: {
      async verifyIdToken() {
        return { uid: 'uid-1', email: 'user@example.com' }
      },
    },
    resolveProfileByUid: async () => ({
      id: 'profile-1',
      firebase_uid: 'uid-1',
      email: 'user@example.com',
      display_name: 'Test User',
      photo_url: null,
      auth_provider: 'password',
      last_login_at: null,
      first_touch_source: null,
      first_touch_medium: null,
      first_touch_campaign: null,
      first_touch_referrer: null,
      created_at: '2026-08-20T10:00:00.000Z',
      updated_at: '2026-08-20T10:00:00.000Z',
    }),
    resolveAccountByProfileId: async () => ({
      id: 'account-1',
      name: 'Acme Workspace',
      slug: 'acme',
      primary_domain: 'acme.com',
      onboarding_status: 'completed',
      created_at: '2026-08-20T10:00:00.000Z',
      updated_at: '2026-08-20T10:00:00.000Z',
    }),
    upsertAccount: async (input) => {
      const account = {
        id: `account-${calls.accounts.length + 1}`,
        name: input.name,
        slug: input.slug,
        primary_domain: input.primary_domain,
        onboarding_status: input.onboarding_status,
        created_at: '2026-08-20T10:00:00.000Z',
        updated_at: '2026-08-20T10:00:00.000Z',
      }
      calls.accounts.push(account)
      return account
    },
    upsertAccountMembership: async (input) => {
      const membership = {
        id: `membership-${calls.memberships.length + 1}`,
        account_id: input.account_id,
        profile_id: input.profile_id,
        role: input.role,
        is_owner: input.is_owner,
        created_at: '2026-08-20T10:00:00.000Z',
      }
      calls.memberships.push(membership)
      return membership
    },
    getCheckoutService: () => ({
      async build() {
        return {
          payment_url: 'https://test.payu.in/_payment',
          method: 'POST',
          test_mode: true,
          callback_authority: 'webhook',
          webhook_path: '/api/billing/payu/webhook',
          redirect_urls: {
            success_url: 'https://costpilot.test/billing/payu/success',
            failure_url: 'https://costpilot.test/billing/payu/failure',
          },
          plan: {
            id: 'growth',
            label: 'CostPilot Growth',
            billing_interval: 'monthly',
            amount: '1.00',
            currency: 'INR',
          },
          transaction: {
            txnid: 'cp_growth_txn_1',
            account_id: 'account-1',
            profile_id: 'profile-1',
          },
          form_fields: {
            txnid: 'cp_growth_txn_1',
            hash: 'hash',
          },
        }
      },
    }),
    getWebhookService: () => ({
      handle() {
        return {
          source: 'payu_webhook',
          verification_status: 'verified',
          authority: 'server_webhook',
          idempotency_key: 'idem-1',
          payment_reference: {
            txnid: 'cp_growth_txn_1',
            mihpayid: 'mih-1',
          },
          payment_state: 'success',
          amount: '1.00',
          plan_id: 'growth',
          account_id: 'account-1',
          profile_id: 'profile-1',
          callback_urls: {
            success_url: 'https://costpilot.test/billing/payu/success',
            failure_url: 'https://costpilot.test/billing/payu/failure',
          },
          persistence_status: 'deferred_until_phase6',
        }
      },
    }),
    getBillingTransactionByProviderTxnId: async (providerTxnId) =>
      calls.transactions.find((row) => row.provider_txn_id === providerTxnId) ?? null,
    upsertBillingTransaction: async (input) => {
      const existingIndex = calls.transactions.findIndex((row) => row.provider_txn_id === input.provider_txn_id)
      const row = {
        id: existingIndex >= 0 ? calls.transactions[existingIndex].id : `txn-${calls.transactions.length + 1}`,
        account_id: input.account_id ?? null,
        profile_id: input.profile_id ?? null,
        billing_provider: 'payu',
        plan_id: input.plan_id,
        billing_interval: input.billing_interval ?? null,
        amount: String(input.amount),
        currency: input.currency,
        provider_txn_id: input.provider_txn_id,
        provider_payment_id: input.provider_payment_id ?? null,
        payment_status: input.payment_status,
        verification_status: input.verification_status,
        idempotency_key: input.idempotency_key ?? null,
        checkout_payload: input.checkout_payload ?? {},
        verified_payload: input.verified_payload ?? {},
        activated_at: input.activated_at ?? null,
        verified_at: input.verified_at ?? null,
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-27T00:00:00.000Z',
      }
      if (existingIndex >= 0) calls.transactions[existingIndex] = row
      else calls.transactions.push(row)
      return row
    },
    getAccountPlan: async () => null,
    upsertAccountPlan: async (input) => {
      const plan = {
        id: `plan-${calls.plans.length + 1}`,
        account_id: input.account_id,
        profile_id: input.profile_id ?? null,
        current_plan_id: input.current_plan_id,
        plan_status: input.plan_status,
        billing_provider: 'payu',
        billing_interval: input.billing_interval,
        latest_transaction_id: input.latest_transaction_id ?? null,
        activated_at: input.activated_at ?? null,
        expires_at: input.expires_at ?? null,
        metadata: input.metadata ?? {},
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-27T00:00:00.000Z',
      }
      calls.plans.push(plan)
      return plan
    },
    insertEvent: async (input) => {
      calls.events.push(input)
      return { id: calls.events.length, ...input, created_at: '2026-08-27T00:00:00.000Z' }
    },
    evaluateAccountHealth: async (accountId, evaluationType) => {
      calls.health.push({ accountId, evaluationType })
      return [{ account_id: accountId }]
    },
    now: () => new Date('2026-08-27T12:00:00.000Z'),
  })

  return { service, calls }
}

test('checkout persists a pending billing transaction and pending account plan state', async () => {
  const { service, calls } = createBillingHarness()
  const result = await service.startCheckout('Bearer token', { plan_id: 'growth' }, 'https://costpilot.test')

  assert.equal(result.plan.id, 'growth')
  assert.equal(calls.transactions.length, 1)
  assert.equal(calls.transactions[0].payment_status, 'pending')
  assert.equal(calls.plans[calls.plans.length - 1].plan_status, 'pending_payment')
  assert.equal(calls.events.some((event) => event.event_name === 'plan_selected'), true)
  assert.equal(calls.events.some((event) => event.event_name === 'upgrade_requested'), true)
  assert.deepEqual(calls.health, [{ accountId: 'account-1', evaluationType: 'billing_state_change' }])
})

test('verified webhook success activates the account plan and remains idempotent', async () => {
  const { service, calls } = createBillingHarness()
  await service.startCheckout('Bearer token', { plan_id: 'growth' }, 'https://costpilot.test')

  const first = await service.handleVerifiedWebhook({})
  const second = await service.handleVerifiedWebhook({})

  assert.equal(first.duplicate, false)
  assert.equal(first.transaction.payment_status, 'success')
  assert.equal(first.account_plan.plan_status, 'active')
  assert.equal(second.duplicate, true)
  assert.equal(calls.transactions.length, 1)
  assert.equal(calls.health.some((entry) => entry.accountId === 'account-1' && entry.evaluationType === 'billing_state_change'), true)
})

test('verified successful payment helper does not trust unverified state', () => {
  assert.equal(isVerifiedSuccessfulPayment({ payment_status: 'success', verification_status: 'verified' }), true)
  assert.equal(isVerifiedSuccessfulPayment({ payment_status: 'success', verification_status: 'pending' }), false)
})

test('billing bootstrap creates a minimal workspace when onboarding was bypassed', async () => {
  const { calls } = createBillingHarness()
  const service = createDefaultBillingService({
    parseToken: (header) => (header?.startsWith('Bearer ') ? header.slice(7) : null),
    verifier: {
      async verifyIdToken() {
        return { uid: 'uid-2', email: 'demo@gmail.com' }
      },
    },
    resolveProfileByUid: async () => ({
      id: 'profile-2',
      firebase_uid: 'uid-2',
      email: 'demo@gmail.com',
      display_name: 'Demo User',
      photo_url: null,
      auth_provider: 'google',
      last_login_at: null,
      first_touch_source: null,
      first_touch_medium: null,
      first_touch_campaign: null,
      first_touch_referrer: null,
      created_at: '2026-08-20T10:00:00.000Z',
      updated_at: '2026-08-20T10:00:00.000Z',
    }),
    resolveAccountByProfileId: async () => calls.accounts[0] ?? null,
    upsertAccount: async (input) => {
      const account = {
        id: 'account-bootstrap',
        name: input.name,
        slug: input.slug,
        primary_domain: input.primary_domain,
        onboarding_status: input.onboarding_status,
        created_at: '2026-08-20T10:00:00.000Z',
        updated_at: '2026-08-20T10:00:00.000Z',
      }
      calls.accounts.push(account)
      return account
    },
    upsertAccountMembership: async (input) => {
      const membership = {
        id: 'membership-bootstrap',
        account_id: input.account_id,
        profile_id: input.profile_id,
        role: input.role,
        is_owner: input.is_owner,
        created_at: '2026-08-20T10:00:00.000Z',
      }
      calls.memberships.push(membership)
      return membership
    },
    getCheckoutService: () => ({
      async build() {
        return {
          payment_url: 'https://test.payu.in/_payment',
          method: 'POST',
          test_mode: true,
          callback_authority: 'webhook',
          webhook_path: '/api/billing/payu/webhook',
          redirect_urls: {
            success_url: 'https://costpilot.test/billing/payu/success',
            failure_url: 'https://costpilot.test/billing/payu/failure',
          },
          plan: {
            id: 'growth',
            label: 'CostPilot Growth',
            billing_interval: 'monthly',
            amount: '1.00',
            currency: 'INR',
          },
          transaction: {
            txnid: 'cp_growth_txn_bootstrap',
            account_id: 'account-bootstrap',
            profile_id: 'profile-2',
          },
          form_fields: {
            txnid: 'cp_growth_txn_bootstrap',
            hash: 'hash',
          },
        }
      },
    }),
    getWebhookService: () => ({
      handle() {
        return {
          source: 'payu_webhook',
          verification_status: 'verified',
          authority: 'server_webhook',
          idempotency_key: 'idem-bootstrap',
          payment_reference: {
            txnid: 'cp_growth_txn_bootstrap',
            mihpayid: 'mih-bootstrap',
          },
          payment_state: 'success',
          amount: '1.00',
          plan_id: 'growth',
          account_id: 'account-bootstrap',
          profile_id: 'profile-2',
          callback_urls: {
            success_url: 'https://costpilot.test/billing/payu/success',
            failure_url: 'https://costpilot.test/billing/payu/failure',
          },
          persistence_status: 'deferred_until_phase6',
        }
      },
    }),
    getBillingTransactionByProviderTxnId: async () => null,
    upsertBillingTransaction: async (input) => ({
      id: 'txn-bootstrap',
      account_id: input.account_id,
      profile_id: input.profile_id,
      billing_provider: 'payu',
      plan_id: input.plan_id,
      billing_interval: input.billing_interval ?? null,
      amount: String(input.amount),
      currency: input.currency,
      provider_txn_id: input.provider_txn_id,
      provider_payment_id: input.provider_payment_id ?? null,
      payment_status: input.payment_status,
      verification_status: input.verification_status,
      idempotency_key: input.idempotency_key ?? null,
      checkout_payload: input.checkout_payload ?? {},
      verified_payload: input.verified_payload ?? {},
      activated_at: input.activated_at ?? null,
      verified_at: input.verified_at ?? null,
      created_at: '2026-08-27T00:00:00.000Z',
      updated_at: '2026-08-27T00:00:00.000Z',
    }),
    getAccountPlan: async () => null,
    upsertAccountPlan: async (input) => ({
      id: 'plan-bootstrap',
      account_id: input.account_id,
      profile_id: input.profile_id ?? null,
      current_plan_id: input.current_plan_id,
      plan_status: input.plan_status,
      billing_provider: 'payu',
      billing_interval: input.billing_interval,
      latest_transaction_id: input.latest_transaction_id ?? null,
      activated_at: input.activated_at ?? null,
      expires_at: input.expires_at ?? null,
      metadata: input.metadata ?? {},
      created_at: '2026-08-27T00:00:00.000Z',
      updated_at: '2026-08-27T00:00:00.000Z',
    }),
    insertEvent: async () => ({ id: 1, created_at: '2026-08-27T00:00:00.000Z' }),
    evaluateAccountHealth: async () => [{ account_id: 'account-bootstrap' }],
    now: () => new Date('2026-08-27T12:00:00.000Z'),
  })

  const result = await service.startCheckout('Bearer token', { plan_id: 'growth' }, 'https://costpilot.test')

  assert.equal(result.payment_url, 'https://test.payu.in/_payment')
  assert.equal(calls.accounts.length, 1)
  assert.equal(calls.memberships.length, 1)
  assert.equal(calls.accounts[0].slug, 'my-workspace-profile-')
})
