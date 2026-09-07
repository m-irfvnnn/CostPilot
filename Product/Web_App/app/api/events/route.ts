import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/server/firebase-admin'
import { createDefaultProductEventService } from '@/lib/server/product-events-service'
import { parseProductEventId, parseProductEventName, parseProductEventProperties } from '@/lib/server/product-events-core'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const payload = await request.json()
    const event_id = parseProductEventId(payload?.event_id)
    const event_name = parseProductEventName(payload?.event_name)
    const event_properties = parseProductEventProperties(payload?.event_properties ?? {})

    const service = createDefaultProductEventService({
      verifier: getFirebaseAdminAuth(),
    })

    const result = await service.track(authHeader, {
      event_id,
      event_name,
      event_properties,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'event_failed'
    const status =
      message === 'missing_token'
        ? 401
        : message === 'invalid_event_id' || message === 'invalid_event_name' || message === 'invalid_event_properties'
          ? 400
          : message === 'profile_not_found'
            ? 404
            : 400
    return NextResponse.json({ error: message }, { status })
  }
}
