import { NextResponse } from 'next/server'

import { createDefaultProductIntelligenceService } from '@/lib/server/product-intelligence-service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const service = createDefaultProductIntelligenceService()
    const result = await service.runDemoSync(authHeader)
    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'product_demo_sync_failed'
    const status =
      message === 'missing_token' || message === 'invalid_token'
        ? 401
        : message === 'profile_not_found'
          ? 404
          : message === 'account_not_found'
            ? 409
            : 400

    return NextResponse.json({ error: message }, { status })
  }
}
