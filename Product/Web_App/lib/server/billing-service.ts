import { BILLING_PLANS, BILLING_PLAN_LIST, type BillingPlanId } from '../billing-plans.ts'
import { buildProductEventInsert, type VerifiedFirebaseToken } from './product-events-core.ts'
import { getFirebaseAdminAuth } from './firebase-admin.ts'
import { deriveAccountName } from './onboarding-core.ts'
import {
  buildPayuWebhookIdempotencyKey,
  createDefaultPayuCheckoutService,
  createDefaultPayuWebhookService,
  type PayuNormalizedWebhookResult,
} from './payu.ts'
import { parseBearerToken } from './profile-sync-core.ts'
import {
  evaluateAccountHealth,
  getAccountByProfileId,
  getAccountPlan,
  getBillingTransactionByProviderTxnId,
  getProfileByFirebaseUid,
  upsertAccount,
  upsertAccountMembership,
  insertProductEvent,
  upsertAccountPlan,
  upsertBillingTransaction,
  type SupabaseAccount,
  type SupabaseBillingTransaction,
  type SupabaseProfile,
} from './supabase-admin.ts'

type AuthContext = {
  verified: VerifiedFirebaseToken
  profile: SupabaseProfile
  account: SupabaseAccount
}

type BillingServiceDeps = {
  parseToken?: (header: string | null) => string | null
  verifier?: ReturnType<typeof getFirebaseAdminAuth>
  resolveProfileByUid?: (firebaseUid: string) => Promise<SupabaseProfile | null>
  resolveAccountByProfileId?: (profileId: string) => Promise<SupabaseAccount | null>
  upsertAccount?: typeof upsertAccount
  upsertAccountMembership?: typeof upsertAccountMembership
  getCheckoutService?: typeof createDefaultPayuCheckoutService
  getWebhookService?: typeof createDefaultPayuWebhookService
  getBillingTransactionByProviderTxnId?: typeof getBillingTransactionByProviderTxnId
  upsertBillingTransaction?: typeof upsertBillingTransaction
  getAccountPlan?: typeof getAccountPlan
  upsertAccountPlan?: typeof upsertAccountPlan
  evaluateAccountHealth?: typeof evaluateAccountHealth
  insertEvent?: typeof insertProductEvent
  now?: () => Date
}

function planStatusFromPaymentState(state: PayuNormalizedWebhookResult['payment_state']) {
  if (state === 'success') return 'active' as const
  if (state === 'failed') return 'failed_payment' as const
  return 'pending_payment' as const
}

export function createDefaultBillingService(deps: BillingServiceDeps = {}) {
  const parseToken = deps.parseToken ?? parseBearerToken
  const verifier = deps.verifier ?? getFirebaseAdminAuth()
  const resolveProfileByUid = deps.resolveProfileByUid ?? getProfileByFirebaseUid
  const resolveAccountByProfileId = deps.resolveAccountByProfileId ?? getAccountByProfileId
  const persistAccount = deps.upsertAccount ?? upsertAccount
  const persistMembership = deps.upsertAccountMembership ?? upsertAccountMembership
  const getCheckoutService = deps.getCheckoutService ?? createDefaultPayuCheckoutService
  const getWebhookService = deps.getWebhookService ?? createDefaultPayuWebhookService
  const lookupTransaction = deps.getBillingTransactionByProviderTxnId ?? getBillingTransactionByProviderTxnId
  const persistTransaction = deps.upsertBillingTransaction ?? upsertBillingTransaction
  const lookupPlan = deps.getAccountPlan ?? getAccountPlan
  const persistPlan = deps.upsertAccountPlan ?? upsertAccountPlan
  const runAccountHealth = deps.evaluateAccountHealth ?? evaluateAccountHealth
  const insertEvent = deps.insertEvent ?? insertProductEvent
  const now = deps.now ?? (() => new Date())

  async function ensureBillingAccount(profile: SupabaseProfile) {
    const existing = await resolveAccountByProfileId(profile.id)
    if (existing) return existing

    const derived = deriveAccountName(profile.email)
    const primaryDomain = profile.email?.split('@')[1] ?? null
    const account = await persistAccount({
      name: derived.name,
      slug: `${derived.slug}-${profile.id.slice(0, 8)}`,
      primary_domain: primaryDomain,
      onboarding_status: 'completed',
    })

    await persistMembership({
      account_id: account.id,
      profile_id: profile.id,
      role: 'owner',
      is_owner: true,
    })

    return account
  }

  async function resolveAuthContext(authHeader: string | null): Promise<AuthContext> {
    const token = parseToken(authHeader)
    if (!token) throw new Error('missing_token')
    const verified = (await verifier.verifyIdToken(token, true)) as VerifiedFirebaseToken
    const profile = await resolveProfileByUid(verified.uid)
    if (!profile) throw new Error('profile_not_found')
    const account = await ensureBillingAccount(profile)
    return { verified, profile, account }
  }

  async function emitEvent(context: AuthContext, eventName: 'plan_selected' | 'upgrade_requested', eventProperties: Record<string, unknown>) {
    return insertEvent(
      buildProductEventInsert({
        firebase_uid: context.verified.uid,
        profile_id: context.profile.id,
        account_id: context.account.id,
        event_name: eventName,
        event_source: 'web_app',
        event_properties: eventProperties,
      }),
    )
  }

  async function ensureDefaultPlan(context: AuthContext) {
    const existing = await lookupPlan(context.account.id)
    if (existing) return existing
    return persistPlan({
      account_id: context.account.id,
      profile_id: context.profile.id,
      current_plan_id: 'starter',
      plan_status: 'active',
      billing_interval: 'monthly',
      metadata: {
        source: 'phase6_default',
      },
    })
  }

  return {
    listPlans() {
      return BILLING_PLAN_LIST
    },

    async getCurrentPlan(authHeader: string | null) {
      const context = await resolveAuthContext(authHeader)
      return ensureDefaultPlan(context)
    },

    async startCheckout(authHeader: string | null, payload: unknown, origin: string) {
      const context = await resolveAuthContext(authHeader)
      const checkoutService = getCheckoutService()
      const result = await checkoutService.build(authHeader, payload, origin)
      const plan = BILLING_PLANS[result.plan.id as BillingPlanId]
      await ensureDefaultPlan(context)

      await persistTransaction({
        account_id: context.account.id,
        profile_id: context.profile.id,
        plan_id: result.plan.id as BillingPlanId,
        billing_interval: result.plan.billing_interval as 'monthly' | 'custom',
        amount: result.plan.amount,
        currency: result.plan.currency,
        provider_txn_id: result.transaction.txnid,
        payment_status: 'pending',
        verification_status: 'pending',
        checkout_payload: {
          payment_url: result.payment_url,
          form_fields: result.form_fields,
          callback_urls: result.redirect_urls,
        },
      })

      await persistPlan({
        account_id: context.account.id,
        profile_id: context.profile.id,
        current_plan_id: result.plan.id as BillingPlanId,
        plan_status: 'pending_payment',
        billing_interval: result.plan.billing_interval as 'monthly' | 'custom',
        metadata: {
          source: 'payu_checkout',
        },
      })

      await emitEvent(context, 'plan_selected', {
        plan_id: plan.id,
        billing_interval: plan.billing_interval,
      })

      if (plan.id !== 'starter') {
        await emitEvent(context, 'upgrade_requested', {
          plan_id: plan.id,
          provider: 'payu',
        })
      }

      await runAccountHealth(context.account.id, 'billing_state_change')

      return result
    },

    async handleVerifiedWebhook(payload: unknown) {
      const service = getWebhookService()
      const result = service.handle(payload)
      const existing = await lookupTransaction(result.payment_reference.txnid)
      const idempotencyKey = buildPayuWebhookIdempotencyKey({
        txnid: result.payment_reference.txnid,
        mihpayid: result.payment_reference.mihpayid ?? '',
        status: result.payment_state,
      })

      if (existing?.idempotency_key === idempotencyKey && existing.verification_status === 'verified') {
        return {
          duplicate: true,
          normalized: result,
          transaction: existing,
          account_plan: existing.account_id ? await lookupPlan(existing.account_id) : null,
        }
      }

      const verifiedAt = now().toISOString()
      const transaction = await persistTransaction({
        account_id: result.account_id ?? existing?.account_id ?? null,
        profile_id: result.profile_id ?? existing?.profile_id ?? null,
        plan_id: (result.plan_id ?? existing?.plan_id ?? 'starter') as BillingPlanId,
        billing_interval: ((result.plan_id ? BILLING_PLANS[result.plan_id as BillingPlanId].billing_interval : existing?.billing_interval) ?? 'monthly') as 'monthly' | 'custom',
        amount: result.amount,
        currency: existing?.currency ?? 'INR',
        provider_txn_id: result.payment_reference.txnid,
        provider_payment_id: result.payment_reference.mihpayid ?? null,
        payment_status: result.payment_state === 'pending' ? 'pending' : result.payment_state,
        verification_status: 'verified',
        idempotency_key: idempotencyKey,
        checkout_payload: existing?.checkout_payload ?? {},
        verified_payload: result as unknown as Record<string, unknown>,
        activated_at: result.payment_state === 'success' ? verifiedAt : null,
        verified_at: verifiedAt,
      })

      let accountPlan = null
      if (transaction.account_id) {
        const currentPlan = await lookupPlan(transaction.account_id)
        accountPlan = await persistPlan({
          account_id: transaction.account_id,
          profile_id: transaction.profile_id,
          current_plan_id: transaction.plan_id,
          plan_status: planStatusFromPaymentState(result.payment_state),
          billing_interval: (transaction.billing_interval ?? BILLING_PLANS[transaction.plan_id].billing_interval) as 'monthly' | 'custom',
          latest_transaction_id: transaction.id,
          activated_at: result.payment_state === 'success' ? verifiedAt : currentPlan?.activated_at ?? null,
          metadata: {
            latest_payment_state: result.payment_state,
            latest_provider_txn_id: transaction.provider_txn_id,
          },
        })
        await runAccountHealth(transaction.account_id, 'billing_state_change')
      }

      return {
        duplicate: false,
        normalized: result,
        transaction,
        account_plan: accountPlan,
      }
    },
  }
}

export function isVerifiedSuccessfulPayment(transaction: Pick<SupabaseBillingTransaction, 'payment_status' | 'verification_status'>) {
  return transaction.payment_status === 'success' && transaction.verification_status === 'verified'
}
