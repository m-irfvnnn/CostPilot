import test from 'node:test'
import assert from 'node:assert/strict'

import { parseBearerToken, buildProfileUpsertInput } from '../lib/server/profile-sync-core.ts'

test('parseBearerToken returns the bearer token', () => {
  assert.equal(parseBearerToken('Bearer abc123'), 'abc123')
})

test('parseBearerToken rejects missing or malformed auth headers', () => {
  assert.equal(parseBearerToken(null), null)
  assert.equal(parseBearerToken('Token abc123'), null)
  assert.equal(parseBearerToken('Bearer   '), null)
})

test('buildProfileUpsertInput maps firebase claims to profile input', () => {
  const originalNow = Date.now
  Date.now = () => new Date('2026-08-25T12:00:00.000Z').valueOf()

  const input = buildProfileUpsertInput({
    uid: 'uid_123',
    email: 'user@example.com',
    name: 'Jane Doe',
    picture: 'https://example.com/photo.jpg',
    firebase: { sign_in_provider: 'google.com' },
  })

  Date.now = originalNow

  assert.equal(input.firebase_uid, 'uid_123')
  assert.equal(input.email, 'user@example.com')
  assert.equal(input.display_name, 'Jane Doe')
  assert.equal(input.photo_url, 'https://example.com/photo.jpg')
  assert.equal(input.auth_provider, 'google.com')
  assert.ok(input.last_login_at)
})

test('buildProfileUpsertInput keeps null-safe fields', () => {
  const input = buildProfileUpsertInput({ uid: 'uid_456' })
  assert.equal(input.email, null)
  assert.equal(input.display_name, null)
  assert.equal(input.photo_url, null)
  assert.equal(input.auth_provider, null)
})
