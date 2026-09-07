import { NextResponse } from 'next/server'

import { normalizeProvider } from '@/lib/server/product-intelligence-core'
import { createDefaultProductIntelligenceService } from '@/lib/server/product-intelligence-service'

export const runtime = 'nodejs'

function parsePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_provider_payload')
  const source = payload as Record<string, unknown>
  const action = source.action
  if (action !== 'add' && action !== 'disconnect' && action !== 'reconnect' && action !== 'remove') {
    throw new Error('invalid_provider_action')
  }

  if (action === 'add') {
    const provider = typeof source.provider === 'string' ? normalizeProvider(source.provider) : null
    if (!provider || provider === 'demo') throw new Error('invalid_provider')
    const apiKey = source.api_key
    if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('missing_provider_api_key')
    return { action, provider, api_key: apiKey.trim() } as const
  }

  const id = source.id
  if (typeof id !== 'string' || !id.trim()) throw new Error('invalid_provider_connection_id')
  const apiKey = source.api_key
  if (action === 'reconnect' && (typeof apiKey !== 'string' || !apiKey.trim())) throw new Error('missing_provider_api_key')
  return { action, id: id.trim(), api_key: typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : undefined } as const
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const payload = parsePayload(await request.json())
    const service = createDefaultProductIntelligenceService()
    const result = payload.action === 'add'
      ? await service.addProviderConnection(authHeader, payload.provider, payload.api_key)
      : await service.updateProviderConnectionStatus(authHeader, {
          id: payload.id,
          action: payload.action,
          api_key: payload.api_key,
        })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'provider_update_failed'
    const status =
      message === 'missing_token' || message === 'invalid_token'
        ? 401
        : message === 'profile_not_found' || message === 'provider_connection_not_found'
          ? 404
          : message === 'account_not_found'
            ? 409
            : message === 'provider_setup_coming_soon' ||
                message === 'invalid_provider_payload' ||
                message === 'invalid_provider_action' ||
                message === 'invalid_provider' ||
                message === 'missing_provider_api_key' ||
                message.endsWith('_authentication_failed') ||
                message.endsWith('_connection_test_failed') ||
                message.endsWith('_rate_limited') ||
                message === 'invalid_provider_connection_id'
              ? 400
              : 400

    return NextResponse.json({ error: message }, { status })
  }
}
