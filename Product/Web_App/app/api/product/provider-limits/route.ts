import { NextResponse } from 'next/server'

import { createDefaultProductIntelligenceService } from '@/lib/server/product-intelligence-service'

export const runtime = 'nodejs'

type LimitPayload = {
  provider_connection_id: string
  limit_type: 'tokens' | 'requests' | 'cost_credits'
  limit_amount: number
  limit_period: 'daily' | 'weekly' | 'monthly'
  threshold_percentage: number
  enabled: boolean
}

function parsePayload(payload: unknown): LimitPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_provider_limit_payload')
  const source = payload as Record<string, unknown>
  const providerConnectionId = source.provider_connection_id
  const limitType = source.limit_type
  const limitPeriod = source.limit_period
  const limitAmount = Number(source.limit_amount)
  const thresholdPercentage = Number(source.threshold_percentage ?? 70)
  const enabled = source.enabled == null ? true : source.enabled

  if (typeof providerConnectionId !== 'string' || !providerConnectionId.trim()) throw new Error('invalid_provider_connection_id')
  if (limitType !== 'tokens' && limitType !== 'requests' && limitType !== 'cost_credits') throw new Error('invalid_limit_type')
  if (limitPeriod !== 'daily' && limitPeriod !== 'weekly' && limitPeriod !== 'monthly') throw new Error('invalid_limit_period')
  if (!Number.isFinite(limitAmount) || limitAmount <= 0) throw new Error('invalid_limit_amount')
  if (!Number.isFinite(thresholdPercentage) || thresholdPercentage < 1 || thresholdPercentage > 100) throw new Error('invalid_limit_threshold')
  if (typeof enabled !== 'boolean') throw new Error('invalid_limit_enabled')

  return {
    provider_connection_id: providerConnectionId.trim(),
    limit_type: limitType,
    limit_amount: limitAmount,
    limit_period: limitPeriod,
    threshold_percentage: thresholdPercentage,
    enabled,
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const payload = parsePayload(await request.json())
    const service = createDefaultProductIntelligenceService()
    const result = await service.upsertProviderUsageLimit(authHeader, payload)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'provider_limit_update_failed'
    const status =
      message === 'missing_token' || message === 'invalid_token'
        ? 401
        : message === 'profile_not_found' || message === 'provider_connection_not_found'
          ? 404
          : message === 'account_not_found'
            ? 409
            : 400

    return NextResponse.json({ error: message }, { status })
  }
}
