import test from 'node:test'
import assert from 'node:assert/strict'

const parseToken = (header) => {
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}

const parsePayload = (payload) => {
  if (!payload || typeof payload !== 'object') throw new Error('invalid_payload')
  const { company_size: companySize, providers, estimated_monthly_spend: spend } = payload
  if (typeof companySize !== 'string') throw new Error('invalid_company_size')
  if (!Array.isArray(providers) || providers.length === 0) throw new Error('invalid_providers')
  if (typeof spend !== 'string') throw new Error('invalid_estimated_monthly_spend')
  return {
    company_size: companySize,
    providers,
    estimated_monthly_spend: spend,
    raw_answers: payload,
  }
}

const deriveAccountName = (email) => {
  const domain = email?.split('@')[1]
  if (!domain || ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com'].includes(domain)) {
    return { name: 'My Workspace', slug: 'my-workspace' }
  }
  const base = domain.split('.')[0] || 'workspace'
  return { name: `${base[0].toUpperCase()}${base.slice(1)} Workspace`, slug: `${base}-workspace` }
}

const createHarness = (overrides = {}) => {
  const calls = {
    accountCreates: 0,
    membershipCreates: 0,
    responseCreates: 0,
    statusUpdates: 0,
  }

  const deps = {
    parseToken,
    verifier: {
      async verifyIdToken(token) {
        if (token === 'bad-token') throw new Error('invalid_token')
        return {
          uid: 'firebase-uid-1',
          email: 'founder@acme.com',
          name: 'Founder',
          picture: 'https://example.com/avatar.png',
          firebase: { sign_in_provider: 'password' },
        }
      },
    },
    resolveProfileByToken: async () => ({
      id: 'profile-1',
      firebase_uid: 'firebase-uid-1',
      email: 'founder@acme.com',
      display_name: 'Founder',
      photo_url: null,
      auth_provider: 'password',
      last_login_at: null,
      created_at: '2026-08-25T12:00:00.000Z',
      updated_at: '2026-08-25T12:00:00.000Z',
    }),
    getAccountByProfileId: async () => null,
    getMembershipByAccountAndProfileId: async () => null,
    upsertAccount: async (input) => {
      calls.accountCreates += 1
      return { id: 'account-1', ...input, created_at: 'now', updated_at: 'now' }
    },
    upsertAccountMembership: async (input) => {
      calls.membershipCreates += 1
      return { id: 'membership-1', created_at: 'now', ...input }
    },
    upsertOnboardingResponse: async (input) => {
      calls.responseCreates += 1
      return { id: 'response-1', ...input, created_at: 'now', updated_at: 'now' }
    },
    updateAccountOnboardingStatus: async (accountId, status) => {
      calls.statusUpdates += 1
      return { id: accountId, name: 'Acme Workspace', slug: 'acme-workspace', primary_domain: 'acme.com', onboarding_status: status, created_at: 'now', updated_at: 'now' }
    },
    now: () => '2026-08-25T12:00:00.000Z',
    ...overrides,
  }

  const sync = async (authHeader, payload) => {
    const token = deps.parseToken(authHeader)
    if (!token) throw new Error('missing_token')
    const onboarding = parsePayload(payload)
    const verified = await deps.verifier.verifyIdToken(token, true)
    const profile = await deps.resolveProfileByToken(verified)
    const existingAccount = await deps.getAccountByProfileId(profile.id)
    const derived = deriveAccountName(profile.email ?? verified.email ?? null)
    const primaryDomain = profile.email?.split('@')[1] ?? verified.email?.split('@')[1] ?? null
    const account =
      existingAccount ??
      (await deps.upsertAccount({
        name: derived.name,
        slug: derived.slug,
        primary_domain: primaryDomain,
        onboarding_status: 'in_progress',
      }))
    const existingMembership = await deps.getMembershipByAccountAndProfileId(account.id, profile.id)
    const membership = await deps.upsertAccountMembership({
      account_id: account.id,
      profile_id: profile.id,
      role: 'owner',
      is_owner: existingMembership?.is_owner ?? !existingAccount,
    })
    const onboardingResponse = await deps.upsertOnboardingResponse({
      profile_id: profile.id,
      account_id: account.id,
      company_size: onboarding.company_size,
      providers: onboarding.providers,
      estimated_monthly_spend: onboarding.estimated_monthly_spend,
      raw_answers: onboarding.raw_answers,
      completed_at: deps.now(),
    })
    const accountUpdate = await deps.updateAccountOnboardingStatus(account.id, 'completed')
    return { profile, account: accountUpdate, membership, onboarding_response: onboardingResponse }
  }

  return { calls, sync, deps }
}

test('onboarding sync creates account, membership, and response', async () => {
  const { calls, sync } = createHarness()
  const result = await sync('Bearer good-token', {
    company_size: '11–50',
    providers: ['OpenAI', 'AWS'],
    estimated_monthly_spend: '$1K–$5K',
  })

  assert.equal(result.account.onboarding_status, 'completed')
  assert.equal(calls.accountCreates, 1)
  assert.equal(calls.membershipCreates, 1)
  assert.equal(calls.responseCreates, 1)
  assert.equal(calls.statusUpdates, 1)
  assert.equal(result.membership.is_owner, true)
})

test('missing token is rejected', async () => {
  const { sync } = createHarness()
  await assert.rejects(() => sync(null, {}), /missing_token/)
})

test('invalid token path is rejected', async () => {
  const { sync } = createHarness({
    verifier: {
      async verifyIdToken() {
        throw new Error('invalid_token')
      },
    },
  })

  await assert.rejects(
    () =>
      sync('Bearer bad-token', {
        company_size: '11–50',
        providers: ['OpenAI'],
        estimated_monthly_spend: '$1K–$5K',
      }),
    /invalid_token/,
  )
})

test('existing account and membership are reused on duplicate submission', async () => {
  const { calls, sync } = createHarness({
    getAccountByProfileId: async () => ({
      id: 'account-1',
      name: 'Acme Workspace',
      slug: 'acme-workspace',
      primary_domain: 'acme.com',
      onboarding_status: 'completed',
      created_at: 'now',
      updated_at: 'now',
    }),
    getMembershipByAccountAndProfileId: async () => ({
      id: 'membership-1',
      account_id: 'account-1',
      profile_id: 'profile-1',
      role: 'owner',
      is_owner: true,
      created_at: 'now',
    }),
  })

  const result = await sync('Bearer good-token', {
    company_size: '11–50',
    providers: ['OpenAI', 'AWS'],
    estimated_monthly_spend: '$1K–$5K',
  })

  assert.equal(result.account.id, 'account-1')
  assert.equal(result.membership.is_owner, true)
  assert.equal(calls.accountCreates, 0)
})
