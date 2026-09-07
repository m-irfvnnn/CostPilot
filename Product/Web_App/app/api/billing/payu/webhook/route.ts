import { NextResponse } from 'next/server'

import { createDefaultBillingService } from '@/lib/server/billing-service'
import { parsePayuCallbackBody } from '@/lib/server/payu'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const payload = await parsePayuCallbackBody(request)
    const service = createDefaultBillingService()
    const result = await service.handleVerifiedWebhook(payload)

    return NextResponse.json(
      {
        ok: true,
        result,
      },
      { status: 202 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'payu_webhook_failed'
    const status =
      message === 'invalid_payu_payload' ||
      message === 'missing_payu_fields' ||
      message === 'invalid_payu_status' ||
      message === 'invalid_amount' ||
      message === 'invalid_payu_key' ||
      message === 'invalid_payu_hash'
        ? 400
        : 500

    return NextResponse.json({ error: message }, { status })
  }
}
