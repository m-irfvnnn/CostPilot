import { NextResponse } from 'next/server'

import {
  createDefaultProductIntelligenceService,
  type AiUsageIngestionInput,
} from '@/lib/server/product-intelligence-service'

export const runtime = 'nodejs'

type RawPayload = Record<string, unknown>

const usageEventPattern = /^cp_usage_[a-zA-Z0-9_-]+$/

function readInternalKey(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  if (authorization.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim()
  return request.headers.get('x-costpilot-ingest-key')?.trim() ?? ''
}

function requireString(payload: RawPayload, field: keyof AiUsageIngestionInput) {
  const value = payload[field]
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`invalid_${String(field)}`)
  return value.trim()
}

function optionalString(payload: RawPayload, field: keyof AiUsageIngestionInput) {
  const value = payload[field]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function requireFiniteNumber(payload: RawPayload, field: keyof AiUsageIngestionInput, minimum = 0) {
  const value = payload[field]
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(number) || number < minimum) throw new Error(`invalid_${String(field)}`)
  return number
}

function optionalFiniteNumber(payload: RawPayload, field: keyof AiUsageIngestionInput) {
  const value = payload[field]
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(number) || number < 0) throw new Error(`invalid_${String(field)}`)
  return number
}

function normalizePayload(payload: RawPayload): AiUsageIngestionInput {
  const usage_event_id = requireString(payload, 'usage_event_id')
  if (!usageEventPattern.test(usage_event_id)) throw new Error('invalid_usage_event_id')

  const usage_at = requireString(payload, 'usage_at')
  if (Number.isNaN(Date.parse(usage_at))) throw new Error('invalid_usage_at')

  const provider = requireString(payload, 'provider')
  if (provider !== 'deepseek' && provider !== 'gemini') throw new Error('unsupported_provider')

  const tagsValue = payload.tags
  const tags = Array.isArray(tagsValue) ? tagsValue.filter((tag): tag is string => typeof tag === 'string') : []

  return {
    usage_event_id,
    account_id: optionalString(payload, 'account_id'),
    workspace_id: optionalString(payload, 'workspace_id'),
    account_slug: optionalString(payload, 'account_slug') ?? '',
    provider,
    service_name: requireString(payload, 'service_name'),
    model_name: requireString(payload, 'model_name'),
    input_tokens: requireFiniteNumber(payload, 'input_tokens'),
    output_tokens: requireFiniteNumber(payload, 'output_tokens'),
    total_tokens: requireFiniteNumber(payload, 'total_tokens'),
    estimated_cost: requireFiniteNumber(payload, 'estimated_cost'),
    latency_ms: optionalFiniteNumber(payload, 'latency_ms'),
    usage_at,
    workflow: requireString(payload, 'workflow'),
    workflow_id: requireString(payload, 'workflow_id'),
    n8n_execution_id: requireString(payload, 'n8n_execution_id'),
    node: requireString(payload, 'node'),
    environment: requireString(payload, 'environment'),
    business_action: requireString(payload, 'business_action'),
    litellm_request_id: typeof payload.litellm_request_id === 'string' && payload.litellm_request_id.trim() ? payload.litellm_request_id.trim() : null,
    tags,
  }
}

export async function POST(request: Request) {
  const configuredKey = process.env.COSTPILOT_USAGE_INGEST_KEY?.trim()
  if (!configuredKey) return NextResponse.json({ error: 'usage_ingest_not_configured' }, { status: 503 })

  const requestKey = readInternalKey(request)
  if (!requestKey || requestKey !== configuredKey) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const raw = (await request.json()) as RawPayload
    const input = normalizePayload(raw)
    const service = createDefaultProductIntelligenceService()
    const result = await service.ingestAiUsage(input)

    return NextResponse.json({
      status: result.status,
      provider_connection_id: result.provider_connection.id,
      usage_record_id: result.usage_record.id,
      usage_event_id: result.usage_record.source_record_id,
      provider: result.usage_record.provider,
      total_tokens: Number(result.usage_record.usage_quantity),
      calculated_cost: Number(result.usage_record.calculated_cost),
    }, { status: result.status === 'deduplicated' ? 200 : 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'usage_ingest_failed'
    const status =
      message === 'account_not_found'
        ? 404
        : message === 'account_context_mismatch'
          ? 409
        : message === 'unsupported_provider'
          ? 400
          : message.startsWith('invalid_')
            ? 400
            : 500

    return NextResponse.json({ error: message }, { status })
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')

  try {
    const service = createDefaultProductIntelligenceService()
    const result = await service.listLiveAiUsage(authHeader)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'live_usage_load_failed'
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
