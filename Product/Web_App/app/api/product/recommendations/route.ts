import { NextResponse } from 'next/server'

import { createDefaultProductIntelligenceService } from '@/lib/server/product-intelligence-service'

export const runtime = 'nodejs'

function parsePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_recommendation_payload')
  const id = (payload as Record<string, unknown>).id
  if (typeof id !== 'string' || !id.trim()) throw new Error('invalid_recommendation_id')
  return id.trim()
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const recommendationId = parsePayload(await request.json())
    const service = createDefaultProductIntelligenceService()
    const result = await service.dismissRecommendation(authHeader, recommendationId)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'product_recommendation_update_failed'
    const status =
      message === 'missing_token' || message === 'invalid_token'
        ? 401
        : message === 'profile_not_found' || message === 'cost_recommendation_not_found'
          ? 404
          : message === 'account_not_found'
            ? 409
            : 400

    return NextResponse.json({ error: message }, { status })
  }
}
