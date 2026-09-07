import { NextResponse } from 'next/server'

import { createDefaultBillingService } from '@/lib/server/billing-service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const service = createDefaultBillingService()
    const plan = await service.getCurrentPlan(authHeader)
    return NextResponse.json({ plan }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'billing_plan_load_failed'
    const status = message === 'missing_token' || message === 'invalid_token'
      ? 401
      : message === 'profile_not_found'
        ? 404
        : message === 'account_not_found'
          ? 409
          : 500

    return NextResponse.json({ error: message }, { status })
  }
}
