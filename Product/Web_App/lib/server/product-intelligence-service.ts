import {
  buildProductEventInsert,
  type ProductEventName,
  type VerifiedFirebaseToken,
} from './product-events-core.ts'
import {
  calculateProjectedSpend,
  buildDemoUsageFixtures,
  deriveAlertCandidates,
  deriveRecommendationCandidates,
  normalizeProvider,
  pickDemoProviders,
  roundCurrency,
  type ProductProvider,
} from './product-intelligence-core.ts'
import { getFirebaseAdminAuth } from './firebase-admin.ts'
import { parseBearerToken } from './profile-sync-core.ts'
import {
  evaluateAccountHealth,
  evaluateLeadQualification,
  getAccountActivationState,
  getAccountById,
  getAccountByProfileId,
  getAccountBySlug,
  getCurrentCustomerHealth,
  getAccountDashboardOverview,
  getAccountPlan,
  getProviderConnectionForAccount,
  getCurrentMonthBudgetStatus,
  getLatestOnboardingResponseForAccount,
  getProfileByFirebaseUid,
  insertCostRecommendation,
  insertProductAlert,
  insertProductEvent,
  getUsageRecordBySource,
  listApiSyncUsageRecords,
  listDailySpendCurrentMonth,
  listLeadIdsByAccount,
  listOpenCostRecommendations,
  listOpenProductAlerts,
  listProviderConnections,
  listProviderUsageLimits,
  listProviderSpendCurrentMonth,
  listServiceSpendCurrentMonth,
  listUsageRecordsSince,
  resolveProductAlert,
  resolveProductAlertForAccount,
  dismissCostRecommendation,
  dismissCostRecommendationForAccount,
  upsertAccountPlan,
  upsertBudget,
  upsertProviderConnection,
  updateProviderConnectionForAccount,
  upsertProviderUsageLimit,
  upsertUsageRecords,
  type SupabaseAccount,
  type SupabaseActivationState,
  type SupabaseProviderUsageLimit,
  type SupabaseProfile,
  type SupabaseUsageRecord,
} from './supabase-admin.ts'
import { validateProviderCredential } from './provider-auth.ts'

type AuthContext = {
  verified: VerifiedFirebaseToken
  profile: SupabaseProfile
  account: SupabaseAccount
}

type ProductIntelligenceServiceDeps = {
  parseToken?: (header: string | null) => string | null
  verifier?: ReturnType<typeof getFirebaseAdminAuth>
  resolveProfileByUid?: (firebaseUid: string) => Promise<SupabaseProfile | null>
  resolveAccountByProfileId?: (profileId: string) => Promise<SupabaseAccount | null>
  resolveAccountById?: typeof getAccountById
  resolveAccountBySlug?: typeof getAccountBySlug
  listProviderConnections?: typeof listProviderConnections
  getProviderConnectionForAccount?: typeof getProviderConnectionForAccount
  upsertProviderConnection?: typeof upsertProviderConnection
  updateProviderConnectionForAccount?: typeof updateProviderConnectionForAccount
  upsertUsageRecords?: typeof upsertUsageRecords
  getUsageRecordBySource?: typeof getUsageRecordBySource
  listApiSyncUsageRecords?: typeof listApiSyncUsageRecords
  listUsageRecordsSince?: typeof listUsageRecordsSince
  listProviderUsageLimits?: typeof listProviderUsageLimits
  upsertProviderUsageLimit?: typeof upsertProviderUsageLimit
  getLatestOnboardingResponseForAccount?: typeof getLatestOnboardingResponseForAccount
  getAccountDashboardOverview?: typeof getAccountDashboardOverview
  listProviderSpendCurrentMonth?: typeof listProviderSpendCurrentMonth
  listServiceSpendCurrentMonth?: typeof listServiceSpendCurrentMonth
  listDailySpendCurrentMonth?: typeof listDailySpendCurrentMonth
  getCurrentMonthBudgetStatus?: typeof getCurrentMonthBudgetStatus
  getAccountActivationState?: typeof getAccountActivationState
  getCurrentCustomerHealth?: typeof getCurrentCustomerHealth
  listOpenProductAlerts?: typeof listOpenProductAlerts
  insertProductAlert?: typeof insertProductAlert
  resolveProductAlert?: typeof resolveProductAlert
  resolveProductAlertForAccount?: typeof resolveProductAlertForAccount
  listOpenCostRecommendations?: typeof listOpenCostRecommendations
  insertCostRecommendation?: typeof insertCostRecommendation
  dismissCostRecommendation?: typeof dismissCostRecommendation
  dismissCostRecommendationForAccount?: typeof dismissCostRecommendationForAccount
  upsertBudget?: typeof upsertBudget
  insertEvent?: typeof insertProductEvent
  listLeadIdsByAccount?: typeof listLeadIdsByAccount
  evaluateLeadQualification?: typeof evaluateLeadQualification
  evaluateAccountHealth?: typeof evaluateAccountHealth
  getAccountPlan?: typeof getAccountPlan
  upsertAccountPlan?: typeof upsertAccountPlan
  validateProviderCredential?: typeof validateProviderCredential
  now?: () => Date
}

export type AiUsageIngestionInput = {
  usage_event_id: string
  account_id: string | null
  workspace_id: string | null
  account_slug: string
  provider: ProductProvider
  service_name: string
  model_name: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated_cost: number
  latency_ms: number | null
  usage_at: string
  workflow: string
  workflow_id: string
  n8n_execution_id: string
  node: string
  environment: string
  business_action: string
  litellm_request_id: string | null
  tags: string[]
}

function buildAlertKey(input: { provider: string | null; type: string; date: string }) {
  return `${input.provider ?? 'account'}|${input.type}|${input.date}`
}

function buildRecommendationKey(input: {
  provider: string | null
  service: string | null
  model: string | null
  type: string
}) {
  return `${input.provider ?? 'account'}|${input.service ?? 'service'}|${input.model ?? 'model'}|${input.type}`
}

function currentPeriodMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString().slice(0, 10)
}

function periodWindow(period: SupabaseProviderUsageLimit['limit_period'], now: Date) {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)

  if (period === 'weekly') {
    const daysSinceMonday = (start.getUTCDay() + 6) % 7
    start.setUTCDate(start.getUTCDate() - daysSinceMonday)
  }

  if (period === 'monthly') {
    start.setUTCDate(1)
  }

  const end = new Date(start)
  if (period === 'daily') end.setUTCDate(end.getUTCDate() + 1)
  if (period === 'weekly') end.setUTCDate(end.getUTCDate() + 7)
  if (period === 'monthly') end.setUTCMonth(end.getUTCMonth() + 1)

  return { start: start.toISOString(), end: end.toISOString() }
}

function quotaUsedAmount(limit: SupabaseProviderUsageLimit, rows: SupabaseUsageRecord[]) {
  if (!limit.enabled) return 0
  if (limit.limit_type === 'requests') return rows.length
  if (limit.limit_type === 'cost_credits') {
    return rows.reduce((sum, row) => sum + Number(row.calculated_cost), 0)
  }
  return rows
    .filter((row) => row.usage_unit === 'tokens')
    .reduce((sum, row) => sum + Number(row.usage_quantity), 0)
}

function quotaStatus(input: { enabled: boolean; consumedPercentage: number }) {
  if (!input.enabled) return 'disabled'
  if (input.consumedPercentage >= 100) return 'exceeded'
  if (input.consumedPercentage >= 90) return 'high_usage'
  if (input.consumedPercentage >= 70) return 'approaching'
  return 'healthy'
}

function roundPercentage(value: number) {
  return Math.round(value * 1000) / 1000
}

export function createDefaultProductIntelligenceService(deps: ProductIntelligenceServiceDeps = {}) {
  const parseToken = deps.parseToken ?? parseBearerToken
  const verifier = deps.verifier ?? getFirebaseAdminAuth()
  const resolveProfileByUid = deps.resolveProfileByUid ?? getProfileByFirebaseUid
  const resolveAccountByProfileId = deps.resolveAccountByProfileId ?? getAccountByProfileId
  const resolveAccountById = deps.resolveAccountById ?? getAccountById
  const resolveAccountBySlug = deps.resolveAccountBySlug ?? getAccountBySlug
  const getOverview = deps.getAccountDashboardOverview ?? getAccountDashboardOverview
  const getActivationState = deps.getAccountActivationState ?? getAccountActivationState
  const getCustomerHealth = deps.getCurrentCustomerHealth ?? getCurrentCustomerHealth
  const getBudgetStatus = deps.getCurrentMonthBudgetStatus ?? getCurrentMonthBudgetStatus
  const getOnboardingResponse = deps.getLatestOnboardingResponseForAccount ?? getLatestOnboardingResponseForAccount
  const getPlan = deps.getAccountPlan ?? getAccountPlan
  const persistPlan = deps.upsertAccountPlan ?? upsertAccountPlan
  const fetchConnections = deps.listProviderConnections ?? listProviderConnections
  const fetchConnectionForAccount = deps.getProviderConnectionForAccount ?? getProviderConnectionForAccount
  const persistConnection = deps.upsertProviderConnection ?? upsertProviderConnection
  const updateConnectionForAccount = deps.updateProviderConnectionForAccount ?? updateProviderConnectionForAccount
  const persistUsageRecords = deps.upsertUsageRecords ?? upsertUsageRecords
  const lookupUsageRecordBySource = deps.getUsageRecordBySource ?? getUsageRecordBySource
  const fetchApiSyncUsageRecords = deps.listApiSyncUsageRecords ?? listApiSyncUsageRecords
  const fetchUsageRecordsSince = deps.listUsageRecordsSince ?? listUsageRecordsSince
  const fetchProviderUsageLimits = deps.listProviderUsageLimits ?? listProviderUsageLimits
  const persistProviderUsageLimit = deps.upsertProviderUsageLimit ?? upsertProviderUsageLimit
  const fetchProviderSpend = deps.listProviderSpendCurrentMonth ?? listProviderSpendCurrentMonth
  const fetchServiceSpend = deps.listServiceSpendCurrentMonth ?? listServiceSpendCurrentMonth
  const fetchDailySpend = deps.listDailySpendCurrentMonth ?? listDailySpendCurrentMonth
  const fetchOpenAlerts = deps.listOpenProductAlerts ?? listOpenProductAlerts
  const createAlert = deps.insertProductAlert ?? insertProductAlert
  const closeAlert = deps.resolveProductAlert ?? resolveProductAlert
  const closeAlertForAccount = deps.resolveProductAlertForAccount ?? resolveProductAlertForAccount
  const fetchOpenRecommendations = deps.listOpenCostRecommendations ?? listOpenCostRecommendations
  const createRecommendation = deps.insertCostRecommendation ?? insertCostRecommendation
  const closeRecommendation = deps.dismissCostRecommendation ?? dismissCostRecommendation
  const closeRecommendationForAccount = deps.dismissCostRecommendationForAccount ?? dismissCostRecommendationForAccount
  const persistBudget = deps.upsertBudget ?? upsertBudget
  const insertEvent = deps.insertEvent ?? insertProductEvent
  const fetchLeadIds = deps.listLeadIdsByAccount ?? listLeadIdsByAccount
  const runQualification = deps.evaluateLeadQualification ?? evaluateLeadQualification
  const runAccountHealth = deps.evaluateAccountHealth ?? evaluateAccountHealth
  const validateCredential = deps.validateProviderCredential ?? validateProviderCredential
  const now = deps.now ?? (() => new Date())

  async function resolveAuthContext(authHeader: string | null): Promise<AuthContext> {
    const token = parseToken(authHeader)
    if (!token) throw new Error('missing_token')

    const verified = (await verifier.verifyIdToken(token, true)) as VerifiedFirebaseToken
    const profile = await resolveProfileByUid(verified.uid)
    if (!profile) throw new Error('profile_not_found')

    const account = await resolveAccountByProfileId(profile.id)
    if (!account) throw new Error('account_not_found')

    return { verified, profile, account }
  }

  async function emitSystemEvent(
    context: AuthContext,
    eventName: ProductEventName,
    eventProperties: Record<string, unknown>,
    eventId?: string,
  ) {
    return insertEvent(
      buildProductEventInsert({
        event_id: eventId,
        firebase_uid: context.verified.uid,
        profile_id: context.profile.id,
        account_id: context.account.id,
        event_name: eventName,
        event_source: 'system',
        event_trust_level: 'trusted',
        event_properties: eventProperties,
      }),
    )
  }

  async function emitAccountUsageEvent(
    accountId: string,
    eventName: ProductEventName,
    eventProperties: Record<string, unknown>,
    eventId?: string,
  ) {
    return insertEvent(
      buildProductEventInsert({
        event_id: eventId,
        firebase_uid: null,
        profile_id: null,
        account_id: accountId,
        event_name: eventName,
        event_source: 'usage_ingest_api',
        event_trust_level: 'trusted',
        event_properties: eventProperties,
      }),
    )
  }

  async function ensureDefaultPlan(context: AuthContext) {
    const existing = await getPlan(context.account.id)
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

  async function refreshDerivedSignals(context: AuthContext, reason: 'demo_sync' | 'budget_update' | 'api_sync') {
    const timestamp = now().toISOString()
    const budgetStatus = await getBudgetStatus(context.account.id)
    const overview = await getOverview(context.account.id)
    const providerSpend = await fetchProviderSpend(context.account.id)
    const serviceSpend = await fetchServiceSpend(context.account.id)
    const dailySpend = await fetchDailySpend(context.account.id)
    const openAlerts = await fetchOpenAlerts(context.account.id)
    const openRecommendations = await fetchOpenRecommendations(context.account.id)

    const alertCandidates = deriveAlertCandidates({
      budgetStatus,
      dailySpend,
      now: now(),
    })
    const recommendationCandidates = deriveRecommendationCandidates({
      spendSummary: {
        current_month_spend: overview?.current_month_spend ?? budgetStatus?.current_month_spend ?? '0',
        projected_month_end_spend: overview?.projected_month_end_spend ?? budgetStatus?.projected_month_end_spend ?? '0',
      },
      budgetStatus,
      providerSpend,
      serviceSpend,
      alertCandidates,
    })

    const alertKeys = new Set(alertCandidates.map((candidate) => buildAlertKey({
      provider: candidate.provider,
      type: candidate.alert_type,
      date: candidate.observed_period,
    })))

    for (const alert of openAlerts) {
      const key = buildAlertKey({
        provider: alert.provider,
        type: alert.alert_type,
        date: alert.observed_period,
      })
      if (!alertKeys.has(key)) {
        await closeAlert(alert.id, timestamp)
      }
    }

    let newAlertCount = 0
    for (const candidate of alertCandidates) {
      const key = buildAlertKey({
        provider: candidate.provider,
        type: candidate.alert_type,
        date: candidate.observed_period,
      })
      const exists = openAlerts.some((alert) => buildAlertKey({
        provider: alert.provider,
        type: alert.alert_type,
        date: alert.observed_period,
      }) === key)
      if (exists) continue
      const createdAlert = await createAlert({
        account_id: context.account.id,
        provider: candidate.provider,
        budget_id: budgetStatus?.budget_id ?? null,
        alert_type: candidate.alert_type,
        severity: candidate.severity,
        threshold_value: candidate.threshold_value,
        observed_value: candidate.observed_value,
        observed_period: candidate.observed_period,
        metadata: {
          ...candidate.metadata,
          reason,
        },
        triggered_at: timestamp,
      })
      await emitSystemEvent(context, 'alert_created', {
        alert_id: createdAlert.id,
        alert_type: createdAlert.alert_type,
        severity: createdAlert.severity,
        reason,
      }, `cp_evt_${context.account.id}:alert_created:${createdAlert.id}`)
      newAlertCount += 1
    }

    const recommendationKeys = new Set(recommendationCandidates.map((candidate) => buildRecommendationKey({
      provider: candidate.provider,
      service: candidate.service_name,
      model: candidate.model_name,
      type: candidate.recommendation_type,
    })))

    for (const recommendation of openRecommendations) {
      const key = buildRecommendationKey({
        provider: recommendation.provider,
        service: recommendation.service_name,
        model: recommendation.model_name,
        type: recommendation.recommendation_type,
      })
      if (!recommendationKeys.has(key)) {
        await closeRecommendation(recommendation.id)
      }
    }

    let newRecommendationCount = 0
    for (const candidate of recommendationCandidates) {
      const key = buildRecommendationKey({
        provider: candidate.provider,
        service: candidate.service_name,
        model: candidate.model_name,
        type: candidate.recommendation_type,
      })
      const exists = openRecommendations.some((recommendation) => buildRecommendationKey({
        provider: recommendation.provider,
        service: recommendation.service_name,
        model: recommendation.model_name,
        type: recommendation.recommendation_type,
      }) === key)
      if (exists) continue
      const createdRecommendation = await createRecommendation({
        account_id: context.account.id,
        provider: candidate.provider,
        service_name: candidate.service_name,
        model_name: candidate.model_name,
        recommendation_type: candidate.recommendation_type,
        priority: candidate.priority,
        title: candidate.title,
        summary: candidate.summary,
        observed_value: candidate.observed_value,
        metadata: {
          ...candidate.metadata,
          reason,
        },
        generated_at: timestamp,
      })
      await emitSystemEvent(context, 'recommendation_generated', {
        recommendation_id: createdRecommendation.id,
        recommendation_type: createdRecommendation.recommendation_type,
        priority: createdRecommendation.priority,
        reason,
      }, `cp_evt_${context.account.id}:recommendation_generated:${createdRecommendation.id}`)
      newRecommendationCount += 1
    }

    if (newAlertCount > 0) {
      await emitSystemEvent(context, 'alert_triggered', {
        count: newAlertCount,
        reason,
      }, `cp_evt_${context.account.id}:alert_triggered:${reason}:${timestamp.slice(0, 10)}`)
    }

    if (newRecommendationCount > 0) {
      await emitSystemEvent(context, 'insight_generated', {
        count: newRecommendationCount,
        reason,
      }, `cp_evt_${context.account.id}:insight_generated:${reason}:${timestamp.slice(0, 10)}`)
    }

    return { newAlertCount, newRecommendationCount }
  }

  async function refreshLeadQualification(context: AuthContext) {
    const leadIds = await fetchLeadIds(context.account.id)
    const uniqueLeadIds = [...new Set(leadIds)]
    for (const leadId of uniqueLeadIds) {
      await runQualification(leadId, 'score_update', 'system')
    }
    return uniqueLeadIds.length
  }

  async function buildProviderUsageLimitSummaries(context: AuthContext) {
    const [limits, connections] = await Promise.all([
      fetchProviderUsageLimits(context.account.id),
      fetchConnections(context.account.id),
    ])
    const connectionById = new Map(connections.map((connection) => [connection.id, connection]))
    const summaries = []

    for (const limit of limits) {
      const connection = connectionById.get(limit.provider_connection_id)
      if (!connection) continue
      const window = periodWindow(limit.limit_period, now())
      const rows = await fetchUsageRecordsSince({
        accountId: context.account.id,
        provider: connection.provider,
        since: window.start,
        until: window.end,
      })
      const usedAmount = roundCurrency(quotaUsedAmount(limit, rows))
      const limitAmount = Number(limit.limit_amount)
      const consumedPercentage = roundPercentage((usedAmount / Math.max(limitAmount, 1)) * 100)

      summaries.push({
        id: limit.id,
        provider_connection_id: limit.provider_connection_id,
        provider: connection.provider,
        limit_type: limit.limit_type,
        limit_amount: limitAmount,
        limit_period: limit.limit_period,
        threshold_percentage: limit.threshold_percentage,
        enabled: limit.enabled,
        used_amount: usedAmount,
        remaining_amount: roundCurrency(Math.max(limitAmount - usedAmount, 0)),
        consumed_percentage: consumedPercentage,
        period_start: window.start,
        period_end: window.end,
        status: quotaStatus({ enabled: limit.enabled, consumedPercentage }),
      })
    }

    return summaries
  }

  return {
    async getDashboardOverview(authHeader: string | null) {
      const context = await resolveAuthContext(authHeader)
      await ensureDefaultPlan(context)
      await runAccountHealth(context.account.id, 'engagement_refresh')

      const [overview, activation, providerSpend, serviceSpend, dailySpend, alerts, recommendations, connections, plan, health, providerUsageLimits] =
        await Promise.all([
          getOverview(context.account.id),
          getActivationState(context.account.id),
          fetchProviderSpend(context.account.id),
          fetchServiceSpend(context.account.id),
          fetchDailySpend(context.account.id),
          fetchOpenAlerts(context.account.id),
          fetchOpenRecommendations(context.account.id),
          fetchConnections(context.account.id),
          getPlan(context.account.id),
          getCustomerHealth(context.account.id),
          buildProviderUsageLimitSummaries(context),
        ])

      return {
        profile: {
          id: context.profile.id,
          email: context.profile.email,
          display_name: context.profile.display_name,
        },
        account: {
          id: context.account.id,
          name: context.account.name,
          slug: context.account.slug,
          onboarding_status: context.account.onboarding_status,
        },
        overview: {
          ...overview,
          current_month_spend: roundCurrency(Number(overview?.current_month_spend ?? 0)),
          projected_month_end_spend: roundCurrency(Number(overview?.projected_month_end_spend ?? 0)),
          average_daily_spend: roundCurrency(Number(overview?.average_daily_spend ?? 0)),
          budget_used_percentage: roundCurrency(Number(overview?.budget_used_percentage ?? 0)),
          projected_budget_used_percentage: roundCurrency(Number(overview?.projected_budget_used_percentage ?? 0)),
          projected_budget_variance: roundCurrency(Number(overview?.projected_budget_variance ?? 0)),
        },
        activation,
        provider_spend: providerSpend.map((row) => ({
          ...row,
          label: normalizeProvider(row.provider),
          spend: roundCurrency(Number(row.spend)),
        })),
        service_spend: serviceSpend.map((row) => ({
          ...row,
          spend: roundCurrency(Number(row.spend)),
          average_unit_price: Number(row.average_unit_price),
        })),
        daily_spend: dailySpend.map((row) => ({
          ...row,
          spend: roundCurrency(Number(row.spend)),
        })),
        alerts: alerts.map((row) => ({
          ...row,
          observed_value: row.observed_value == null ? null : roundCurrency(Number(row.observed_value)),
          threshold_value: row.threshold_value == null ? null : roundCurrency(Number(row.threshold_value)),
        })),
        recommendations: recommendations.map((row) => ({
          ...row,
          observed_value: row.observed_value == null ? null : roundCurrency(Number(row.observed_value)),
        })),
        connections: connections.map((connection) => ({
          id: connection.id,
          provider: connection.provider,
          connection_mode: connection.connection_mode,
          connection_status: connection.connection_status,
          connected_at: connection.connected_at,
          external_reference: connection.external_reference,
          last_synced_at: connection.last_synced_at,
        })),
        provider_usage_limits: providerUsageLimits,
        plan,
        health,
      }
    },

    async ingestAiUsage(input: AiUsageIngestionInput) {
      if (input.provider !== 'deepseek' && input.provider !== 'gemini') throw new Error('unsupported_provider')
      const account = input.account_id
        ? await resolveAccountById(input.account_id)
        : await resolveAccountBySlug(input.account_slug)
      if (!account) throw new Error('account_not_found')
      if (input.workspace_id && input.workspace_id !== account.id) throw new Error('account_context_mismatch')
      if (input.account_slug && input.account_slug !== account.slug) throw new Error('account_context_mismatch')

      const timestamp = now().toISOString()
      const connection = await persistConnection({
        account_id: account.id,
        provider: input.provider,
        connection_mode: 'api_key',
        connection_status: 'connected',
        external_reference: input.provider === 'deepseek' ? 'costpilot-litellm-gateway' : 'costpilot-gemini-ingest',
        metadata: {
          gateway: input.provider === 'deepseek' ? 'litellm' : 'costpilot_usage_ingest',
          source: 'real_ai_usage',
          environment: input.environment,
        },
        connected_at: timestamp,
        last_synced_at: input.usage_at,
      })

      const existing = await lookupUsageRecordBySource({
        provider_connection_id: connection.id,
        source_type: 'api_sync',
        source_record_id: input.usage_event_id,
      })

      if (existing) {
        return {
          status: 'deduplicated' as const,
          provider_connection: connection,
          usage_record: existing,
          derived: null,
        }
      }

      const unitPrice = input.total_tokens > 0 ? input.estimated_cost / input.total_tokens : 0
      const [usageRecord] = await persistUsageRecords([
        {
          account_id: account.id,
          provider_connection_id: connection.id,
          provider: input.provider,
          service_name: input.service_name,
          model_name: input.model_name,
          usage_quantity: input.total_tokens,
          usage_unit: 'tokens',
          unit_price: unitPrice,
          calculated_cost: input.estimated_cost,
          usage_at: input.usage_at,
          period_start: null,
          period_end: null,
          source_type: 'api_sync',
          source_record_id: input.usage_event_id,
          metadata: {
            workflow: input.workflow,
            workflow_id: input.workflow_id,
            n8n_execution_id: input.n8n_execution_id,
            node: input.node,
            environment: input.environment,
            business_action: input.business_action,
            input_tokens: input.input_tokens,
            output_tokens: input.output_tokens,
            latency_ms: input.latency_ms,
            litellm_request_id: input.litellm_request_id,
            tags: input.tags,
            source: input.provider === 'deepseek' ? 'litellm_deepseek_prototype' : 'gemini_usage_ingest',
          },
        },
      ])

      await emitAccountUsageEvent(account.id, 'usage_synced', {
        provider: input.provider,
        usage_event_id: input.usage_event_id,
        source_type: 'api_sync',
        workflow: input.workflow,
        workflow_id: input.workflow_id,
        n8n_execution_id: input.n8n_execution_id,
      }, `cp_evt_${account.id}:usage_synced:${input.usage_event_id}`)

      await emitAccountUsageEvent(account.id, 'ai_usage_recorded', {
        provider: input.provider,
        model_name: input.model_name,
        usage_event_id: input.usage_event_id,
        total_tokens: input.total_tokens,
        calculated_cost: input.estimated_cost,
        latency_ms: input.latency_ms,
        workflow: input.workflow,
        workflow_id: input.workflow_id,
        n8n_execution_id: input.n8n_execution_id,
        node: input.node,
      }, `cp_evt_${account.id}:ai_usage_recorded:${input.usage_event_id}`)

      await emitAccountUsageEvent(account.id, 'workflow_run_observed', {
        workflow: input.workflow,
        workflow_id: input.workflow_id,
        n8n_execution_id: input.n8n_execution_id,
        node: input.node,
        business_action: input.business_action,
      }, `cp_evt_${account.id}:workflow_run_observed:${input.usage_event_id}`)

      await emitAccountUsageEvent(account.id, 'first_cost_data_received', {
        provider: input.provider,
        usage_event_id: input.usage_event_id,
        calculated_cost: input.estimated_cost,
      }, `cp_evt_${account.id}:first_cost_data_received:${input.usage_event_id}`)

      const derived = await refreshDerivedSignals({ verified: { uid: 'system' }, profile: { id: null } as unknown as SupabaseProfile, account }, 'api_sync')
      await runAccountHealth(account.id, 'product_signal_refresh')

      return {
        status: 'created' as const,
        provider_connection: connection,
        usage_record: usageRecord,
        derived,
      }
    },

    async listLiveAiUsage(authHeader: string | null) {
      const context = await resolveAuthContext(authHeader)
      const rows = await fetchApiSyncUsageRecords(context.account.id, 10)
      return {
        account: { id: context.account.id, name: context.account.name, slug: context.account.slug },
        usage: rows.map((row) => ({
          id: row.id,
          provider: row.provider,
          service_name: row.service_name,
          model_name: row.model_name,
          usage_quantity: Number(row.usage_quantity),
          usage_unit: row.usage_unit,
          calculated_cost: roundCurrency(Number(row.calculated_cost)),
          unit_price: Number(row.unit_price),
          usage_at: row.usage_at,
          source_type: row.source_type,
          source_record_id: row.source_record_id,
          metadata: row.metadata,
        })),
      }
    },

    async runDemoSync(authHeader: string | null) {
      const context = await resolveAuthContext(authHeader)
      await ensureDefaultPlan(context)

      const beforeActivation = await getActivationState(context.account.id)
      const onboarding = await getOnboardingResponse(context.account.id)
      const providers = pickDemoProviders(onboarding?.providers ?? [])
      const existingConnections = await fetchConnections(context.account.id)

      const createdProviders: ProductProvider[] = []
      const connections = []
      for (const provider of providers) {
        const existed = existingConnections.some((row) => row.provider === provider && row.connection_mode === 'demo_fixture')
        const connection = await persistConnection({
          account_id: context.account.id,
          provider,
          connection_mode: 'demo_fixture',
          connection_status: 'connected',
          external_reference: null,
          metadata: {
            adapter: 'demo_fixture_v1',
          },
          connected_at: now().toISOString(),
          last_synced_at: now().toISOString(),
        })
        if (!existed) createdProviders.push(provider)
        connections.push(connection)
      }

      for (const provider of createdProviders) {
        await emitSystemEvent(context, 'provider_connected', {
          provider,
          mode: 'demo_fixture',
        }, `cp_evt_${context.account.id}:provider_connected:demo_fixture:${provider}`)
      }

      const fixtureRows = buildDemoUsageFixtures({
        accountId: context.account.id,
        providers,
        now: now(),
      })

      const connectionByProvider = new Map(connections.map((row) => [row.provider, row]))
      const usageRows = fixtureRows.map((row) => {
        const connection = connectionByProvider.get(row.provider)
        if (!connection) throw new Error('provider_connection_missing')
        return {
          account_id: context.account.id,
          provider_connection_id: connection.id,
          provider: row.provider,
          service_name: row.service_name,
          model_name: row.model_name,
          usage_quantity: row.usage_quantity,
          usage_unit: row.usage_unit,
          unit_price: row.unit_price,
          calculated_cost: row.calculated_cost,
          usage_at: row.usage_at,
          period_start: row.period_start,
          period_end: row.period_end,
          source_type: 'demo_fixture' as const,
          source_record_id: row.source_record_id,
          metadata: row.metadata,
        }
      })

      const persistedUsage = await persistUsageRecords(usageRows)

      await emitSystemEvent(context, 'usage_synced', {
        provider_count: providers.length,
        usage_record_count: persistedUsage.length,
        period_month: currentPeriodMonth(now()),
      }, `cp_evt_${context.account.id}:usage_synced:demo_fixture:${currentPeriodMonth(now())}`)

      if (!beforeActivation?.usage_synced) {
        await emitSystemEvent(context, 'first_cost_data_received', {
          usage_record_count: persistedUsage.length,
        }, `cp_evt_${context.account.id}:first_cost_data_received:demo_fixture`)
      }

      const derived = await refreshDerivedSignals(context, 'demo_sync')
      const refreshedLeads = await refreshLeadQualification(context)
      await runAccountHealth(context.account.id, 'product_signal_refresh')
      const activation = await getActivationState(context.account.id)

      return {
        providers,
        connection_count: connections.length,
        usage_record_count: persistedUsage.length,
        new_alert_count: derived.newAlertCount,
        new_recommendation_count: derived.newRecommendationCount,
        refreshed_lead_count: refreshedLeads,
        activation,
      }
    },

    async upsertAccountBudget(
      authHeader: string | null,
      input: {
        amount: number
        threshold_percentage: number
        provider?: ProductProvider | null
      },
    ) {
      const context = await resolveAuthContext(authHeader)
      await ensureDefaultPlan(context)
      const beforeActivation = await getActivationState(context.account.id)
      const connections = await fetchConnections(context.account.id)
      const providerConnection = input.provider
        ? connections.find((row) => row.provider === input.provider)
        : null

      const budget = await persistBudget({
        account_id: context.account.id,
        provider_connection_id: providerConnection?.id ?? null,
        provider: input.provider ?? null,
        budget_scope: input.provider ? 'provider' : 'account',
        period_month: currentPeriodMonth(now()),
        amount: input.amount.toFixed(2),
        currency: 'USD',
        threshold_percentage: input.threshold_percentage,
        alerting_enabled: true,
        status: 'active',
        created_by_profile_id: context.profile.id,
      })

      await emitSystemEvent(context, 'budget_created', {
        budget_scope: budget.budget_scope,
        provider: budget.provider,
        amount: budget.amount,
        threshold_percentage: budget.threshold_percentage,
      }, `cp_evt_${context.account.id}:budget_created:${budget.id}`)

      if (!beforeActivation?.alert_configured && budget.threshold_percentage != null) {
        await emitSystemEvent(context, 'alert_configured', {
          budget_scope: budget.budget_scope,
          provider: budget.provider,
          threshold_percentage: budget.threshold_percentage,
        }, `cp_evt_${context.account.id}:alert_configured:${budget.id}`)
      }

      const derived = await refreshDerivedSignals(context, 'budget_update')
      const refreshedLeads = await refreshLeadQualification(context)
      await runAccountHealth(context.account.id, 'product_signal_refresh')
      const overview = await getOverview(context.account.id)
      const activation = await getActivationState(context.account.id)

      return {
        budget,
        overview,
        activation,
        new_alert_count: derived.newAlertCount,
        new_recommendation_count: derived.newRecommendationCount,
        refreshed_lead_count: refreshedLeads,
      }
    },

    async addProviderConnection(authHeader: string | null, provider: ProductProvider, apiKey: string) {
      const context = await resolveAuthContext(authHeader)
      if (provider !== 'deepseek' && provider !== 'gemini') throw new Error('provider_setup_coming_soon')
      const credentialCheck = await validateCredential(provider, apiKey)
      if (!credentialCheck.ok) {
        await emitSystemEvent(context, 'provider_connection_failed', {
          provider,
          reason: credentialCheck.safeError,
        }, `cp_evt_${context.account.id}:provider_connection_failed:${provider}:${now().toISOString().slice(0, 10)}`)
        throw new Error(credentialCheck.safeError ?? 'provider_authentication_failed')
      }

      const connection = await persistConnection({
        account_id: context.account.id,
        provider,
        connection_mode: 'api_key',
        connection_status: 'connected',
        external_reference: provider === 'deepseek' ? 'costpilot-litellm-gateway' : 'costpilot-gemini-ingest',
        metadata: {
          gateway: provider === 'deepseek' ? 'litellm' : 'gemini_api',
          credential_storage: 'validated_reference_only',
          credential_reference: credentialCheck.reference,
          model_hint: credentialCheck.model_hint,
          secret_in_browser: false,
          source: 'provider_management',
        },
        connected_at: now().toISOString(),
        last_synced_at: now().toISOString(),
      })

      await emitSystemEvent(context, 'provider_connected', {
        provider,
        mode: 'validated_reference_only',
      }, `cp_evt_${context.account.id}:provider_connected:${connection.id}`)
      await runAccountHealth(context.account.id, 'product_signal_refresh')

      return { connection }
    },

    async updateProviderConnectionStatus(
      authHeader: string | null,
      input: {
        id: string
        action: 'disconnect' | 'reconnect' | 'remove'
        api_key?: string
      },
    ) {
      const context = await resolveAuthContext(authHeader)
      const existing = await fetchConnectionForAccount(input.id, context.account.id)
      if (!existing) throw new Error('provider_connection_not_found')
      if (input.action === 'reconnect' && !input.api_key?.trim()) throw new Error('missing_provider_api_key')

      const credentialCheck = input.action === 'reconnect' && input.api_key
        ? await validateCredential(existing.provider, input.api_key)
        : null
      if (credentialCheck && !credentialCheck.ok) {
        await emitSystemEvent(context, 'provider_connection_failed', {
          provider: existing.provider,
          provider_connection_id: existing.id,
          action: input.action,
          reason: credentialCheck.safeError,
        }, `cp_evt_${context.account.id}:provider_connection_failed:${existing.id}:${now().toISOString().slice(0, 10)}`)
        throw new Error(credentialCheck.safeError ?? 'provider_authentication_failed')
      }

      const metadata = {
        ...(existing.metadata ?? {}),
        ...(credentialCheck ? {
          credential_storage: 'validated_reference_only',
          credential_reference: credentialCheck.reference,
          model_hint: credentialCheck.model_hint,
          secret_in_browser: false,
        } : {}),
        ...(input.action === 'remove'
          ? { removed_at: now().toISOString(), removed_by: 'dashboard' }
          : { last_status_action: input.action, last_status_action_at: now().toISOString() }),
      }

      const connection = await updateConnectionForAccount({
        id: existing.id,
        account_id: context.account.id,
        connection_status: input.action === 'reconnect' ? 'connected' : 'disconnected',
        metadata,
        last_synced_at: input.action === 'reconnect' ? now().toISOString() : existing.last_synced_at,
      })

      await emitSystemEvent(context, input.action === 'reconnect' ? 'provider_connected' : 'provider_disconnected', {
        provider: existing.provider,
        provider_connection_id: existing.id,
        action: input.action,
      }, `cp_evt_${context.account.id}:provider_${input.action}:${existing.id}`)
      await runAccountHealth(context.account.id, 'product_signal_refresh')
      return { connection }
    },

    async upsertProviderUsageLimit(
      authHeader: string | null,
      input: {
        provider_connection_id: string
        limit_type: SupabaseProviderUsageLimit['limit_type']
        limit_amount: number
        limit_period: SupabaseProviderUsageLimit['limit_period']
        threshold_percentage: number
        enabled: boolean
      },
    ) {
      const context = await resolveAuthContext(authHeader)
      const connection = await fetchConnectionForAccount(input.provider_connection_id, context.account.id)
      if (!connection) throw new Error('provider_connection_not_found')

      const limit = await persistProviderUsageLimit({
        account_id: context.account.id,
        provider_connection_id: connection.id,
        limit_type: input.limit_type,
        limit_amount: input.limit_amount,
        limit_period: input.limit_period,
        threshold_percentage: input.threshold_percentage,
        enabled: input.enabled,
        metadata: {
          source: 'dashboard_provider_management',
        },
      })

      await emitSystemEvent(context, 'provider_limit_updated', {
        provider: connection.provider,
        provider_connection_id: connection.id,
        limit_id: limit.id,
        limit_type: limit.limit_type,
        limit_period: limit.limit_period,
        threshold_percentage: limit.threshold_percentage,
        enabled: limit.enabled,
      }, `cp_evt_${context.account.id}:provider_limit_updated:${limit.id}`)

      return { limit, provider_usage_limits: await buildProviderUsageLimitSummaries(context) }
    },

    async resolveAlert(authHeader: string | null, alertId: string) {
      if (!alertId) throw new Error('invalid_alert_id')
      const context = await resolveAuthContext(authHeader)
      const alert = await closeAlertForAccount(alertId, context.account.id, now().toISOString())
      await emitSystemEvent(context, 'alert_resolved', {
        alert_id: alert.id,
        alert_type: alert.alert_type,
        provider: alert.provider,
      }, `cp_evt_${context.account.id}:alert_resolved:${alert.id}`)
      await runAccountHealth(context.account.id, 'product_signal_refresh')
      return { alert }
    },

    async dismissRecommendation(authHeader: string | null, recommendationId: string) {
      if (!recommendationId) throw new Error('invalid_recommendation_id')
      const context = await resolveAuthContext(authHeader)
      const recommendation = await closeRecommendationForAccount(recommendationId, context.account.id)
      await emitSystemEvent(context, 'recommendation_dismissed', {
        recommendation_id: recommendation.id,
        recommendation_type: recommendation.recommendation_type,
        provider: recommendation.provider,
      }, `cp_evt_${context.account.id}:recommendation_dismissed:${recommendation.id}`)
      await runAccountHealth(context.account.id, 'product_signal_refresh')
      return { recommendation }
    },
  }
}

export function projectMonthEndFromOverview(input: {
  current_month_spend: number
  as_of: Date
}) {
  const daysInMonth = new Date(Date.UTC(input.as_of.getUTCFullYear(), input.as_of.getUTCMonth() + 1, 0)).getUTCDate()
  const elapsedDays = input.as_of.getUTCDate()
  return calculateProjectedSpend(input.current_month_spend, elapsedDays, daysInMonth)
}

export function deriveActivationFromState(state: SupabaseActivationState | null) {
  if (!state) {
    return {
      activation_score: 0,
      activated: false,
    }
  }
  return {
    activation_score: state.activation_score,
    activated: state.activated,
  }
}
