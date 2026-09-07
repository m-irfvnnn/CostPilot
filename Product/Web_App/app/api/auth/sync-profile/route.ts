import { NextResponse } from 'next/server'
import { mapAttributedCustomerAcquisitionEnvelope } from '@/lib/acquisition'
import { createDefaultAcquisitionAttributionService } from '@/lib/server/acquisition-attribution-service'
import { getFirebaseAdminAuth } from '@/lib/server/firebase-admin'
import { buildProfileUpsertInput, parseBearerToken } from '@/lib/server/profile-sync-core'
import { upsertProfile } from '@/lib/server/supabase-admin'

export const runtime = 'nodejs'

function getAuthHeader(request: Request) {
  return parseBearerToken(request.headers.get('authorization'))
}

async function parseOptionalJsonBody(request: Request) {
  const raw = await request.text()
  if (!raw.trim()) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw new Error('invalid_payload')
  }
}

export async function POST(request: Request) {
  const token = getAuthHeader(request)
  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 })
  }

  try {
    const payload = await parseOptionalJsonBody(request)
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token, true)
    const profile = await upsertProfile(buildProfileUpsertInput(decoded))
    await createDefaultAcquisitionAttributionService().persist({
      profile_id: profile.id,
      firebase_uid: decoded.uid,
      occurred_at: profile.last_login_at ?? new Date().toISOString(),
      envelope: mapAttributedCustomerAcquisitionEnvelope({
        firebase_uid: decoded.uid,
        profile_id: profile.id,
        event_name: 'profile_sync',
        event_source: 'web_app',
        event_properties:
          payload.acquisition_context && typeof payload.acquisition_context === 'object'
            ? (payload.acquisition_context as Record<string, unknown>)
            : {},
      }),
      metadata: {
        event_name: 'profile_sync',
        auth_provider: decoded.firebase?.sign_in_provider ?? null,
      },
      persist_last_touch: false,
      persist_interaction: false,
    })

    return NextResponse.json({
      profile: {
        id: profile.id,
        firebase_uid: profile.firebase_uid,
        email: profile.email,
        display_name: profile.display_name,
        photo_url: profile.photo_url,
        auth_provider: profile.auth_provider,
        last_login_at: profile.last_login_at,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'profile_sync_failed'
    const status =
      message === 'invalid_token'
        ? 401
        : message.startsWith('Missing environment variable:')
          ? 500
          : message.startsWith('Supabase request failed:')
            ? 502
            : 400
    return NextResponse.json({ error: message }, { status })
  }
}
