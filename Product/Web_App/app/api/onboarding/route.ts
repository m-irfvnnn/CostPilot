import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/server/firebase-admin'
import { createDefaultOnboardingService } from '@/lib/server/onboarding-service'
import { parseBearerToken } from '@/lib/server/profile-sync-core'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const service = createDefaultOnboardingService({
      verifier: getFirebaseAdminAuth(),
      parseToken: parseBearerToken,
      now: () => new Date().toISOString(),
    })
    const payload = await request.json()
    const result = await service.sync(authHeader, payload)
    return NextResponse.json({
      profile: {
        id: result.profile.id,
        firebase_uid: result.profile.firebase_uid,
      },
      account: {
        id: result.account.id,
        name: result.account.name,
        onboarding_status: result.account.onboarding_status,
      },
      onboarding_response: {
        id: result.onboarding_response.id,
      },
      lead_ingestion: result.lead_ingestion,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'onboarding_failed'
    const status =
      message === 'missing_token' || message === 'invalid_token'
        ? 401
        : message === 'profile_not_found'
          ? 404
          : 400
    return NextResponse.json({ error: message }, { status })
  }
}
