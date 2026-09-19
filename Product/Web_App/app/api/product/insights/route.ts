import { NextResponse } from 'next/server'

import { createDefaultProductIntelligenceService } from '@/lib/server/product-intelligence-service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const service = createDefaultProductIntelligenceService()
    const result = await service.refreshProductInsights(request.headers.get('authorization'))
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'product_insight_refresh_failed'
    const status = message === 'missing_token' || message === 'invalid_token'
      ? 401
      : message === 'profile_not_found' || message === 'account_not_found'
        ? 404
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}
