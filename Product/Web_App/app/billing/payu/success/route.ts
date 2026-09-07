import { NextResponse } from 'next/server'

import { createDefaultBillingService } from '@/lib/server/billing-service'
import { parsePayuCallbackBody } from '@/lib/server/payu'

function buildDestination(request: Request, billing: 'success' | 'failed') {
  const url = new URL(request.url)
  const next = url.searchParams.get('next') || '/demo'
  const plan = url.searchParams.get('plan')
  const destination = new URL(next, url.origin)
  destination.searchParams.set('billing', billing)
  if (plan) destination.searchParams.set('plan', plan)
  return destination
}

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return NextResponse.redirect(buildDestination(request, 'success'))
}

export async function POST(request: Request) {
  try {
    const payload = await parsePayuCallbackBody(request)
    const service = createDefaultBillingService()
    await service.handleVerifiedWebhook(payload)
    return NextResponse.redirect(buildDestination(request, 'success'))
  } catch {
    return NextResponse.redirect(buildDestination(request, 'failed'))
  }
}
