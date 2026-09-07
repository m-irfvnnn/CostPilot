import { NextResponse } from 'next/server'

import { createDefaultProductIntelligenceService } from '@/lib/server/product-intelligence-service'

export const runtime = 'nodejs'

function productTestWebhookUrl() {
  return process.env.COSTPILOT_PRODUCT_PQL_TEST_URL ?? 'http://localhost:5678/webhook/costpilot-product-pql-test'
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const service = createDefaultProductIntelligenceService()
    const overview = await service.getDashboardOverview(authHeader)
    const response = await fetch(productTestWebhookUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: overview.account.id,
        workspace_id: overview.account.id,
        account_slug: overview.account.slug,
      }),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        {
          error: body?.error ?? 'product_test_run_failed',
          status: response.status,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      account_id: overview.account.id,
      workspace_id: overview.account.id,
      account_slug: overview.account.slug,
      result: body,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'product_test_run_failed'
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
