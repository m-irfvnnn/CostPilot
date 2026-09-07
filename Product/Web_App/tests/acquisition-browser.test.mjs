import test from 'node:test'
import assert from 'node:assert/strict'

import {
  captureAcquisitionContextFromLocation,
  mergeAcquisitionContexts,
  mergeProductEventPropertiesWithAcquisitionContext,
  parseStoredAcquisitionContext,
} from '../lib/acquisition-browser.ts'

test('capture derives direct signup context without external referral or utm parameters', () => {
  const result = captureAcquisitionContextFromLocation({
    location: {
      href: 'https://costpilot.app/signup',
      origin: 'https://costpilot.app',
      pathname: '/signup',
      search: '',
    },
    document_referrer: '',
    now: '2026-08-25T12:00:00.000Z',
  })

  assert.equal(result.has_signal, false)
  assert.equal(result.context.source, 'direct_signup')
  assert.equal(result.context.medium, 'direct')
  assert.equal(result.context.referrer, null)
})

test('capture normalizes UTM and partner metadata from landing URLs', () => {
  const result = captureAcquisitionContextFromLocation({
    location: {
      href: 'https://costpilot.app/signup?utm_source=LinkedIn&utm_medium=Paid%20Social&utm_campaign=Launch%20Q3&utm_content=Hero%20CTA&partner_id=agency_42',
      origin: 'https://costpilot.app',
      pathname: '/signup',
      search: '?utm_source=LinkedIn&utm_medium=Paid%20Social&utm_campaign=Launch%20Q3&utm_content=Hero%20CTA&partner_id=agency_42',
    },
    document_referrer: 'https://www.linkedin.com/feed/',
    now: '2026-08-25T12:00:00.000Z',
  })

  assert.equal(result.has_signal, true)
  assert.equal(result.context.source, 'linkedin')
  assert.equal(result.context.medium, 'paid_social')
  assert.equal(result.context.campaign, 'launch_q3')
  assert.equal(result.context.utm_content, 'hero_cta')
  assert.equal(result.context.partner_id, 'agency_42')
})

test('capture accepts partner, creator, and referral aliases from landing URLs', () => {
  const result = captureAcquisitionContextFromLocation({
    location: {
      href: 'https://costpilot.app/signup?utm_source=YouTube&creator=creator_88&partner=consultant_42&referral_code=invite_7',
      origin: 'https://costpilot.app',
      pathname: '/signup',
      search: '?utm_source=YouTube&creator=creator_88&partner=consultant_42&referral_code=invite_7',
    },
    document_referrer: 'https://youtube.com/watch?v=123',
    now: '2026-08-25T12:00:00.000Z',
  })

  assert.equal(result.has_signal, true)
  assert.equal(result.context.creator_id, 'creator_88')
  assert.equal(result.context.partner_id, 'consultant_42')
  assert.equal(result.context.referral_id, 'invite_7')
})

test('merge preserves prior landing context when later pages provide no new signal', () => {
  const existing = parseStoredAcquisitionContext({
    source: 'linkedin',
    medium: 'paid_social',
    campaign: 'launch_q3',
    referrer: 'https://www.linkedin.com/feed/',
    captured_at: '2026-08-25T12:00:00.000Z',
    landing_path: '/signup',
    landing_search: '?utm_source=linkedin',
  })

  const incoming = parseStoredAcquisitionContext({
    source: 'direct_signup',
    medium: 'direct',
    captured_at: '2026-08-25T12:05:00.000Z',
    landing_path: '/login',
    landing_search: '',
  })

  const merged = mergeAcquisitionContexts(existing, incoming, false)

  assert.equal(merged.source, 'linkedin')
  assert.equal(merged.medium, 'paid_social')
  assert.equal(merged.campaign, 'launch_q3')
})

test('product event properties inherit stored acquisition context while allowing explicit overrides', () => {
  const properties = mergeProductEventPropertiesWithAcquisitionContext(
    {
      provider_count: 2,
      source: 'custom_source',
    },
    parseStoredAcquisitionContext({
      source: 'organic_signup',
      medium: 'referral',
      campaign: 'launch_q3',
      referrer: 'https://example.com/article',
      captured_at: '2026-08-25T12:00:00.000Z',
      landing_path: '/signup',
      landing_search: '?utm_campaign=launch_q3',
    }),
  )

  assert.equal(properties.source, 'custom_source')
  assert.equal(properties.medium, 'referral')
  assert.equal(properties.campaign, 'launch_q3')
  assert.equal(properties.referrer, 'https://example.com/article')
  assert.equal(properties.provider_count, 2)
})
