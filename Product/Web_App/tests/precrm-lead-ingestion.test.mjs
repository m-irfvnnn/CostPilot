import test from 'node:test'
import assert from 'node:assert/strict'

const { buildWebsiteSignupLeadPayload } = await import('../lib/server/precrm-lead-ingestion.ts')

const profile = {
  id: 'profile-1',
  firebase_uid: 'firebase-uid-1',
  email: 'founder@loomexample.dev',
  display_name: 'Loom Founder',
  photo_url: null,
  auth_provider: 'password',
  last_login_at: null,
  first_touch_source: null,
  first_touch_medium: null,
  first_touch_campaign: null,
  first_touch_referrer: null,
  created_at: '2026-09-04T12:00:00.000Z',
  updated_at: '2026-09-04T12:00:00.000Z',
}

const account = {
  id: 'account-1',
  name: 'Loom Example Workspace',
  slug: 'loom-example-workspace',
  primary_domain: 'loomexample.dev',
  onboarding_status: 'completed',
  created_at: '2026-09-04T12:00:00.000Z',
  updated_at: '2026-09-04T12:00:00.000Z',
}

test('website signup payload uses stable event id and onboarding GTM fields', () => {
  const payload = buildWebsiteSignupLeadPayload({
    profile,
    account,
    occurred_at: '2026-09-04T12:10:00.000Z',
    onboarding: {
      name: 'Loom Founder',
      company: 'Loom Example',
      job_title: 'Founder / CEO',
      country: 'United States',
      company_size: '11–50',
      providers: ['Google Gemini'],
      estimated_monthly_spend: '$1K–$5K',
      plan_interest: 'growth',
      primary_use_case: 'n8n workflows',
      raw_answers: {},
    },
  })

  assert.equal(payload.event_id, 'signup-firebase-uid-1-account-1')
  assert.equal(payload.source, 'website_signup')
  assert.equal(payload.source_type, 'inbound')
  assert.equal(payload.email, 'founder@loomexample.dev')
  assert.equal(payload.company_name, 'Loom Example')
  assert.equal(payload.domain, 'loomexample.dev')
  assert.equal(payload.job_title, 'Founder / CEO')
  assert.equal(payload.plan_interest, 'growth')
  assert.equal(payload.monthly_ai_api_spend, 3000)
  assert.equal(payload.account_id, 'account-1')
  assert.equal(payload.profile_id, 'profile-1')
  assert.deepEqual(payload.providers, ['Google Gemini'])
})
