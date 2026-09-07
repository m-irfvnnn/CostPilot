import { NextResponse } from 'next/server'

import { createDefaultProductIntelligenceService } from '@/lib/server/product-intelligence-service'
import { normalizeProvider } from '@/lib/server/product-intelligence-core'

function parseBudgetPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('invalid_budget_payload')
  }

  const source = payload as Record<string, unknown>
  const amount = Number(source.amount)
  const threshold = Number(source.threshold_percentage)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('invalid_budget_amount')
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100) {
    throw new Error('invalid_budget_threshold')
  }

  const provider = typeof source.provider === 'string' && source.provider.trim()
    ? normalizeProvider(source.provider)
    : null

  return {
    amount,
    threshold_percentage: threshold,
    provider,
  }
}

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const payload = parseBudgetPayload(await request.json())
    const service = createDefaultProductIntelligenceService()
    const result = await service.upsertAccountBudget(authHeader, payload)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'product_budget_failed'
    const status =
      message === 'missing_token' || message === 'invalid_token'
        ? 401
        : message === 'profile_not_found'
          ? 404
          : message === 'account_not_found'
            ? 409
            : message === 'invalid_budget_payload' ||
                message === 'invalid_budget_amount' ||
                message === 'invalid_budget_threshold'
              ? 400
              : 400

    return NextResponse.json({ error: message }, { status })
  }
}
