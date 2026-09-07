import { NextResponse } from 'next/server'

import { createDefaultBillingService } from '@/lib/server/billing-service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const payload = await request.json()
    const service = createDefaultBillingService()
    const result = await service.startCheckout(authHeader, payload, new URL(request.url).origin)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'payu_checkout_failed'
    const normalizedMessage = message.startsWith('Missing environment variable: PAYU_') ? 'payu_not_configured' : message
    const status =
      normalizedMessage === 'missing_token' || normalizedMessage === 'invalid_token'
        ? 401
        : normalizedMessage === 'profile_not_found'
          ? 404
          : normalizedMessage === 'account_not_found'
            ? 409
          : normalizedMessage === 'invalid_plan_id' ||
              normalizedMessage === 'plan_not_checkout_enabled' ||
              normalizedMessage === 'invalid_checkout_payload' ||
              normalizedMessage === 'invalid_redirect_path' ||
              normalizedMessage === 'profile_email_required' ||
              normalizedMessage === 'invalid_payu_env' ||
              normalizedMessage === 'invalid_payu_base_url'
            ? 400
            : normalizedMessage === 'payu_not_configured'
              ? 503
            : 500

    return NextResponse.json({ error: normalizedMessage }, { status })
  }
}
