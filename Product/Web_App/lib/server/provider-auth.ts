import { createHash } from 'node:crypto'

import type { ProductProvider } from './product-intelligence-core'

type ProviderCredentialCheck = {
  ok: boolean
  safeError?: string
  reference: string
  model_hint: string
}

function credentialReference(provider: ProductProvider, apiKey: string) {
  const fingerprint = createHash('sha256').update(`${provider}:${apiKey}`).digest('hex').slice(0, 16)
  return `${provider}_${fingerprint}`
}

function safeProviderError(provider: ProductProvider, status: number) {
  if (status === 401 || status === 403) return `${provider}_authentication_failed`
  if (status === 429) return `${provider}_rate_limited`
  return `${provider}_connection_test_failed`
}

export async function validateProviderCredential(provider: ProductProvider, apiKey: string): Promise<ProviderCredentialCheck> {
  const key = apiKey.trim()
  if (!key) throw new Error('missing_provider_api_key')

  if (provider === 'deepseek') {
    const response = await fetch('https://api.deepseek.com/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        ok: false,
        safeError: safeProviderError(provider, response.status),
        reference: credentialReference(provider, key),
        model_hint: 'deepseek-chat',
      }
    }

    return {
      ok: true,
      reference: credentialReference(provider, key),
      model_hint: 'deepseek-chat',
    }
  }

  if (provider === 'gemini') {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
    url.searchParams.set('key', key)
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        ok: false,
        safeError: safeProviderError(provider, response.status),
        reference: credentialReference(provider, key),
        model_hint: 'gemini-3.5-flash-lite',
      }
    }

    return {
      ok: true,
      reference: credentialReference(provider, key),
      model_hint: 'gemini-3.5-flash-lite',
    }
  }

  throw new Error('provider_setup_coming_soon')
}
