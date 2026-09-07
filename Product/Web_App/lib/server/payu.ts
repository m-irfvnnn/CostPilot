import crypto from 'node:crypto'

import { BILLING_PLANS, type BillingPlanId } from '../billing-plans.ts'
import { getFirebaseAdminAuth } from './firebase-admin.ts'
import { parseBearerToken, type VerifiedFirebaseToken } from './profile-sync-core.ts'
import {
  getAccountByProfileId,
  getProfileByFirebaseUid,
  type SupabaseAccount,
  type SupabaseProfile,
} from './supabase-admin.ts'

const PAYU_TEST_BASE_URL = 'https://test.payu.in'
const PAYU_PAYMENT_PATH = '/_payment'
const PAYU_ALLOWED_ENV = 'test'
const PAYU_TEST_PHONE = '9999999999'

export const PAYU_TEST_PLANS = BILLING_PLANS

export type PayuServerConfig = {
  merchantKey: string
  env: 'test'
  baseUrl: string
  paymentUrl: string
}

export type PayuHashInput = {
  key: string
  txnid: string
  amount: string
  productinfo: string
  firstname: string
  email: string
  udf1?: string | null
  udf2?: string | null
  udf3?: string | null
  udf4?: string | null
  udf5?: string | null
}

export type PayuWebhookPayload = {
  key: string
  txnid: string
  amount: string
  productinfo: string
  firstname: string
  email: string
  status: string
  hash: string
  udf1: string
  udf2: string
  udf3: string
  udf4: string
  udf5: string
  phone: string
  mihpayid: string
  mode: string
  unmappedstatus: string
  additional_charges: string
  splitInfo: string
}

export type PayuNormalizedWebhookResult = {
  source: 'payu_webhook'
  verification_status: 'verified'
  authority: 'server_webhook'
  idempotency_key: string
  payment_reference: {
    txnid: string
    mihpayid: string | null
  }
  payment_state: 'success' | 'failed' | 'pending'
  amount: string
  plan_id: string | null
  account_id: string | null
  profile_id: string | null
  callback_urls: {
    success_url: string | null
    failure_url: string | null
  }
  persistence_status: 'deferred_until_phase6'
}

export type PayuCheckoutResponse = {
  payment_url: string
  method: 'POST'
  test_mode: true
  callback_authority: 'webhook'
  webhook_path: '/api/billing/payu/webhook'
  redirect_urls: {
    success_url: string
    failure_url: string
  }
  plan: {
    id: string
    label: string
    billing_interval: string
    amount: string
    currency: string
  }
  transaction: {
    txnid: string
    account_id: string | null
    profile_id: string
  }
  form_fields: Record<string, string>
}

export type PayuCheckoutDeps = {
  parseToken?: (header: string | null) => string | null
  verifier?: {
    verifyIdToken(token: string, checkRevoked: boolean): Promise<VerifiedFirebaseToken>
  }
  resolveProfileByUid?: (firebaseUid: string) => Promise<SupabaseProfile | null>
  resolveAccountByProfileId?: (profileId: string) => Promise<SupabaseAccount | null>
  getConfig?: () => PayuServerConfig & { salt: string }
  now?: () => Date
  generateTxnId?: (input: { profileId: string; accountId: string | null; now: Date; planId: string }) => string
}

function requireEnv(name: string, env: NodeJS.ProcessEnv) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function assertSafeBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' || url.origin !== PAYU_TEST_BASE_URL) {
    throw new Error('invalid_payu_base_url')
  }
  return url.origin
}

function sha512Hex(value: string) {
  return crypto.createHash('sha512').update(value).digest('hex')
}

function sha256Hex(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function toStringValue(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  return ''
}

function normalizeAmount(amount: string) {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error('invalid_amount')
  return numeric.toFixed(2)
}

function ensureRelativePath(value: string | null | undefined, fallback: string) {
  const candidate = (value ?? '').trim()
  if (!candidate) return fallback
  if (!candidate.startsWith('/')) throw new Error('invalid_redirect_path')
  if (candidate.startsWith('//')) throw new Error('invalid_redirect_path')
  return candidate
}

function joinUrl(origin: string, path: string) {
  return new URL(path, origin).toString()
}

function normalizeUdf(input: {
  udf1?: string | null
  udf2?: string | null
  udf3?: string | null
  udf4?: string | null
  udf5?: string | null
}) {
  return {
    udf1: toStringValue(input.udf1),
    udf2: toStringValue(input.udf2),
    udf3: toStringValue(input.udf3),
    udf4: toStringValue(input.udf4),
    udf5: toStringValue(input.udf5),
  }
}

function getAdditionalCharges(input: Partial<PayuWebhookPayload> & Record<string, unknown>) {
  return toStringValue(input.additional_charges || input.additionalCharges)
}

function getSplitInfo(input: Partial<PayuWebhookPayload> & Record<string, unknown>) {
  return toStringValue(input.splitInfo)
}

export function getPayuServerConfig(env: NodeJS.ProcessEnv = process.env) {
  const merchantKey = requireEnv('PAYU_MERCHANT_KEY', env)
  const salt = requireEnv('PAYU_SALT', env)
  const configuredEnv = requireEnv('PAYU_ENV', env)
  if (configuredEnv !== PAYU_ALLOWED_ENV) throw new Error('invalid_payu_env')
  const baseUrl = assertSafeBaseUrl(requireEnv('PAYU_BASE_URL', env))

  return {
    merchantKey,
    salt,
    env: PAYU_ALLOWED_ENV,
    baseUrl,
    paymentUrl: `${baseUrl}${PAYU_PAYMENT_PATH}`,
  } as const
}

export function createPayuRequestHash(input: PayuHashInput, salt: string) {
  const udf = normalizeUdf(input)
  const sequence = [
    input.key,
    input.txnid,
    input.amount,
    input.productinfo,
    input.firstname,
    input.email,
    udf.udf1,
    udf.udf2,
    udf.udf3,
    udf.udf4,
    udf.udf5,
    '',
    '',
    '',
    '',
    '',
    salt,
  ].join('|')

  return sha512Hex(sequence)
}

export function createPayuResponseHash(input: Partial<PayuWebhookPayload> & Record<string, unknown>, salt: string) {
  const udf = normalizeUdf(input)
  const prefix = []
  const additionalCharges = getAdditionalCharges(input)
  if (additionalCharges) prefix.push(additionalCharges)
  prefix.push(salt)
  prefix.push(toStringValue(input.status))

  const splitInfo = getSplitInfo(input)
  if (splitInfo) prefix.push(splitInfo)

  const sequence = [
    ...prefix,
    '',
    '',
    '',
    '',
    '',
    udf.udf5,
    udf.udf4,
    udf.udf3,
    udf.udf2,
    udf.udf1,
    toStringValue(input.email),
    toStringValue(input.firstname),
    toStringValue(input.productinfo),
    toStringValue(input.amount),
    toStringValue(input.txnid),
    toStringValue(input.key),
  ].join('|')

  return sha512Hex(sequence)
}

export function verifyPayuResponseHash(input: Partial<PayuWebhookPayload> & Record<string, unknown>, salt: string) {
  const providedHash = toStringValue(input.hash).toLowerCase()
  if (!providedHash) return false
  const expectedHash = createPayuResponseHash(input, salt).toLowerCase()
  return constantTimeEqual(expectedHash, providedHash)
}

export function parsePayuWebhookPayload(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('invalid_payu_payload')
  }

  const source = input as Record<string, unknown>
  const payload: PayuWebhookPayload = {
    key: toStringValue(source.key),
    txnid: toStringValue(source.txnid),
    amount: normalizeAmount(toStringValue(source.amount)),
    productinfo: toStringValue(source.productinfo),
    firstname: toStringValue(source.firstname),
    email: toStringValue(source.email),
    status: toStringValue(source.status).toLowerCase(),
    hash: toStringValue(source.hash),
    udf1: toStringValue(source.udf1),
    udf2: toStringValue(source.udf2),
    udf3: toStringValue(source.udf3),
    udf4: toStringValue(source.udf4),
    udf5: toStringValue(source.udf5),
    phone: toStringValue(source.phone),
    mihpayid: toStringValue(source.mihpayid),
    mode: toStringValue(source.mode),
    unmappedstatus: toStringValue(source.unmappedstatus),
    additional_charges: getAdditionalCharges(source),
    splitInfo: getSplitInfo(source),
  }

  if (!payload.key || !payload.txnid || !payload.amount || !payload.productinfo || !payload.firstname || !payload.email || !payload.status || !payload.hash) {
    throw new Error('missing_payu_fields')
  }

  if (!['success', 'failed', 'failure', 'pending'].includes(payload.status)) {
    throw new Error('invalid_payu_status')
  }

  return payload
}

export function buildPayuWebhookIdempotencyKey(payload: Pick<PayuWebhookPayload, 'txnid' | 'mihpayid' | 'status'>) {
  return sha256Hex(`${payload.txnid}|${payload.mihpayid || 'none'}|${payload.status}`)
}

export function normalizePayuWebhookResult(payload: PayuWebhookPayload): PayuNormalizedWebhookResult {
  return {
    source: 'payu_webhook',
    verification_status: 'verified',
    authority: 'server_webhook',
    idempotency_key: buildPayuWebhookIdempotencyKey(payload),
    payment_reference: {
      txnid: payload.txnid,
      mihpayid: payload.mihpayid || null,
    },
    payment_state: payload.status === 'failure' ? 'failed' : (payload.status as 'success' | 'failed' | 'pending'),
    amount: payload.amount,
    plan_id: payload.udf1 || null,
    account_id: payload.udf2 || null,
    profile_id: payload.udf3 || null,
    callback_urls: {
      success_url: payload.udf4 || null,
      failure_url: payload.udf5 || null,
    },
    persistence_status: 'deferred_until_phase6',
  }
}

export async function parsePayuCallbackBody(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData()
    return Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : '']))
  }

  if (contentType.includes('application/json')) {
    return (await request.json()) as unknown
  }

  const raw = await request.text()
  if (!raw.trim()) throw new Error('invalid_payu_payload')
  if (raw.includes('=')) return Object.fromEntries(new URLSearchParams(raw).entries())
  return JSON.parse(raw) as unknown
}

export function createDefaultPayuWebhookService(deps: {
  getConfig?: () => PayuServerConfig & { salt: string }
} = {}) {
  const getConfig = deps.getConfig ?? getPayuServerConfig

  return {
    handle(payload: unknown) {
      const config = getConfig()
      const parsed = parsePayuWebhookPayload(payload)

      if (parsed.key !== config.merchantKey) throw new Error('invalid_payu_key')
      if (!verifyPayuResponseHash(parsed, config.salt)) throw new Error('invalid_payu_hash')

      return normalizePayuWebhookResult(parsed)
    },
  }
}

function parseCheckoutInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('invalid_checkout_payload')
  }

  const payload = input as Record<string, unknown>
  const planId = toStringValue(payload.plan_id) as BillingPlanId
  if (!planId || !(planId in PAYU_TEST_PLANS)) throw new Error('invalid_plan_id')

  const plan = PAYU_TEST_PLANS[planId]
  if (!plan.checkout_enabled) throw new Error('plan_not_checkout_enabled')

  return {
    plan,
    firstname: toStringValue(payload.firstname),
    phone: toStringValue(payload.phone),
    successPath: ensureRelativePath(toStringValue(payload.success_path), '/billing/payu/success'),
    failurePath: ensureRelativePath(toStringValue(payload.failure_path), '/billing/payu/failure'),
  }
}

function defaultGenerateTxnId(input: { profileId: string; accountId: string | null; now: Date; planId: string }) {
  const base = [
    'cp',
    input.planId,
    input.accountId?.slice(0, 8) || 'acctless',
    input.profileId.slice(0, 8),
    String(input.now.getTime()),
  ]
    .join('_')
    .replace(/[^a-zA-Z0-9_]/g, '')

  return base.slice(0, 40)
}

export function createDefaultPayuCheckoutService(deps: PayuCheckoutDeps = {}) {
  const parseToken = deps.parseToken ?? parseBearerToken
  const verifier = deps.verifier ?? getFirebaseAdminAuth()
  const resolveProfileByUid = deps.resolveProfileByUid ?? getProfileByFirebaseUid
  const resolveAccountByProfileId = deps.resolveAccountByProfileId ?? getAccountByProfileId
  const getConfig = deps.getConfig ?? getPayuServerConfig
  const now = deps.now ?? (() => new Date())
  const generateTxnId = deps.generateTxnId ?? defaultGenerateTxnId

  return {
    async build(authHeader: string | null, input: unknown, origin: string): Promise<PayuCheckoutResponse> {
      const token = parseToken(authHeader)
      if (!token) throw new Error('missing_token')

      const verified = await verifier.verifyIdToken(token, true)
      const profile = await resolveProfileByUid(verified.uid)
      if (!profile) throw new Error('profile_not_found')

      const account = await resolveAccountByProfileId(profile.id)
      const checkout = parseCheckoutInput(input)
      const config = getConfig()
      const checkoutNow = now()
      const successUrl = joinUrl(origin, checkout.successPath)
      const failureUrl = joinUrl(origin, checkout.failurePath)
      const txnid = generateTxnId({
        profileId: profile.id,
        accountId: account?.id ?? null,
        now: checkoutNow,
        planId: checkout.plan.id,
      })

      const firstname = checkout.firstname || profile.display_name || profile.email?.split('@')[0] || 'CostPilot'
      const email = profile.email
      const phone = checkout.phone || PAYU_TEST_PHONE
      if (!email) throw new Error('profile_email_required')

      const formFields: Record<string, string> = {
        key: config.merchantKey,
        txnid,
        amount: checkout.plan.amount,
        productinfo: checkout.plan.productinfo,
        firstname,
        email,
        phone,
        surl: successUrl,
        furl: failureUrl,
        udf1: checkout.plan.id,
        udf2: account?.id ?? '',
        udf3: profile.id,
        udf4: successUrl,
        udf5: failureUrl,
        hash: createPayuRequestHash(
          {
            key: config.merchantKey,
            txnid,
            amount: checkout.plan.amount,
            productinfo: checkout.plan.productinfo,
            firstname,
            email,
            udf1: checkout.plan.id,
            udf2: account?.id ?? '',
            udf3: profile.id,
            udf4: successUrl,
            udf5: failureUrl,
          },
          config.salt,
        ),
      }

      return {
        payment_url: config.paymentUrl,
        method: 'POST',
        test_mode: true,
        callback_authority: 'webhook',
        webhook_path: '/api/billing/payu/webhook',
        redirect_urls: {
          success_url: successUrl,
          failure_url: failureUrl,
        },
        plan: {
          id: checkout.plan.id,
          label: checkout.plan.label,
          billing_interval: checkout.plan.billing_interval,
          amount: checkout.plan.amount,
          currency: checkout.plan.currency,
        },
        transaction: {
          txnid,
          account_id: account?.id ?? null,
          profile_id: profile.id,
        },
        form_fields: formFields,
      }
    },
  }
}
