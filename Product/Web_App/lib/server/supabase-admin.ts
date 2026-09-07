type SupabaseProfileInput = {
  firebase_uid: string
  email: string | null
  display_name: string | null
  photo_url: string | null
  auth_provider: string | null
  last_login_at: string
}

type SupabaseAccountInput = {
  name: string
  slug: string
  primary_domain: string | null
  onboarding_status: string | null
}

type SupabaseMembershipInput = {
  account_id: string
  profile_id: string
  role: string
  is_owner: boolean
}

type SupabaseOnboardingResponseInput = {
  profile_id: string
  account_id: string
  company_size: string
  providers: string[]
  estimated_monthly_spend: string
  raw_answers: Record<string, unknown>
  completed_at: string
}

export type SupabaseProfile = {
  id: string
  firebase_uid: string
  email: string | null
  display_name: string | null
  photo_url: string | null
  auth_provider: string | null
  last_login_at: string | null
  first_touch_source: string | null
  first_touch_medium: string | null
  first_touch_campaign: string | null
  first_touch_referrer: string | null
  created_at: string
  updated_at: string
}

export type SupabaseAccount = {
  id: string
  name: string
  slug: string | null
  primary_domain: string | null
  onboarding_status: string | null
  created_at: string
  updated_at: string
}

export type SupabaseMembership = {
  id: string
  account_id: string
  profile_id: string
  role: string
  is_owner: boolean
  created_at: string
}

export type SupabaseOnboardingResponse = {
  id: string
  profile_id: string
  account_id: string | null
  company_size: string | null
  providers: string[]
  estimated_monthly_spend: string | null
  raw_answers: Record<string, unknown>
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type SupabaseProductEvent = {
  id: number
  event_id: string | null
  account_id: string | null
  profile_id: string | null
  firebase_uid: string | null
  event_name: string
  event_source: string | null
  event_trust_level: 'trusted' | 'untrusted'
  occurred_at: string
  event_properties: Record<string, unknown>
  created_at: string
}

export type SupabaseAcquisitionTouch = {
  id: string
  profile_id: string | null
  account_id: string | null
  lead_id: number | null
  firebase_uid: string | null
  channel: string
  source: string | null
  source_id: string | null
  medium: string | null
  campaign: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  partner_id: string | null
  creator_id: string | null
  referral_id: string | null
  touch_type: string
  identity_key: string
  occurred_at: string
  metadata: Record<string, unknown>
  created_at: string
}

export type SupabaseAcquisitionPartner = {
  partner_id: string
  name: string
  partner_type: 'agency' | 'consultant'
  status: 'active' | 'inactive' | 'paused'
  source_identifier: string | null
  default_campaign: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SupabaseAcquisitionCreator = {
  creator_id: string
  name: string
  platform: 'youtube' | 'linkedin' | 'newsletter' | 'podcast'
  status: 'active' | 'inactive' | 'paused'
  source_identifier: string | null
  default_campaign: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SupabaseAcquisitionReferral = {
  referral_id: string
  referral_code: string
  referring_profile_id: string | null
  referring_account_id: string | null
  referring_partner_id: string | null
  status: 'active' | 'inactive' | 'redeemed'
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SupabaseProviderConnection = {
  id: string
  account_id: string
  provider: 'openai' | 'anthropic' | 'aws' | 'google' | 'azure' | 'demo' | 'deepseek' | 'gemini'
  connection_mode: 'demo_fixture' | 'api_key' | 'manual_import'
  connection_status: 'connected' | 'syncing' | 'error' | 'disconnected'
  external_reference: string | null
  metadata: Record<string, unknown>
  connected_at: string
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export type SupabaseUsageRecord = {
  id: string
  account_id: string
  provider_connection_id: string
  provider: 'openai' | 'anthropic' | 'aws' | 'google' | 'azure' | 'demo' | 'deepseek' | 'gemini'
  service_name: string
  model_name: string | null
  usage_quantity: string
  usage_unit: string
  unit_price: string
  calculated_cost: string
  usage_at: string
  period_start: string | null
  period_end: string | null
  source_type: 'demo_fixture' | 'manual_sync' | 'api_sync'
  source_record_id: string
  metadata: Record<string, unknown>
  created_at: string
}

export type SupabaseProviderUsageLimit = {
  id: string
  account_id: string
  provider_connection_id: string
  limit_type: 'tokens' | 'requests' | 'cost_credits'
  limit_amount: string
  limit_period: 'daily' | 'weekly' | 'monthly'
  threshold_percentage: number
  enabled: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SupabaseBudget = {
  id: string
  account_id: string
  provider_connection_id: string | null
  provider: 'openai' | 'anthropic' | 'aws' | 'google' | 'azure' | 'demo' | 'deepseek' | 'gemini' | null
  budget_scope: 'account' | 'provider'
  period_month: string
  amount: string
  currency: string
  threshold_percentage: number | null
  alerting_enabled: boolean
  status: 'active' | 'inactive' | 'archived'
  created_by_profile_id: string | null
  created_at: string
  updated_at: string
}

export type SupabaseProductAlert = {
  id: string
  account_id: string
  provider_connection_id: string | null
  budget_id: string | null
  provider: 'openai' | 'anthropic' | 'aws' | 'google' | 'azure' | 'demo' | 'deepseek' | 'gemini' | null
  alert_type: 'budget_threshold_reached' | 'projected_budget_overrun' | 'spend_spike'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'resolved' | 'suppressed'
  threshold_value: string | null
  observed_value: string | null
  observed_period: string
  metadata: Record<string, unknown>
  triggered_at: string
  resolved_at: string | null
}

export type SupabaseCostRecommendation = {
  id: string
  account_id: string
  provider_connection_id: string | null
  provider: 'openai' | 'anthropic' | 'aws' | 'google' | 'azure' | 'demo' | 'deepseek' | 'gemini' | null
  service_name: string | null
  model_name: string | null
  recommendation_type:
    | 'budget_missing'
    | 'projected_budget_overrun'
    | 'provider_cost_concentration'
    | 'service_cost_concentration'
    | 'spend_spike'
    | 'high_unit_cost'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'dismissed' | 'applied'
  title: string
  summary: string
  observed_value: string | null
  metadata: Record<string, unknown>
  generated_at: string
  updated_at: string
}

export type SupabaseBillingTransaction = {
  id: string
  account_id: string | null
  profile_id: string | null
  billing_provider: 'payu'
  plan_id: 'starter' | 'growth' | 'scale'
  billing_interval: 'monthly' | 'custom' | null
  amount: string
  currency: string
  provider_txn_id: string
  provider_payment_id: string | null
  payment_status: 'pending' | 'success' | 'failed'
  verification_status: 'pending' | 'verified' | 'rejected'
  idempotency_key: string | null
  checkout_payload: Record<string, unknown>
  verified_payload: Record<string, unknown>
  activated_at: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export type SupabaseAccountPlan = {
  id: string
  account_id: string
  profile_id: string | null
  current_plan_id: 'starter' | 'growth' | 'scale'
  plan_status: 'active' | 'pending_payment' | 'inactive' | 'failed_payment'
  billing_provider: 'payu'
  billing_interval: 'monthly' | 'custom'
  latest_transaction_id: string | null
  activated_at: string | null
  expires_at: string | null
  cancellation_requested_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SupabaseCustomerHealthEvaluation = {
  id: string
  account_id: string
  evaluation_type: 'runtime' | 'product_signal_refresh' | 'billing_state_change' | 'engagement_refresh' | 'manual_review' | 'synthetic_scenario' | 'cancellation_state_change'
  rule_version: string
  health_score: number
  health_state: 'healthy' | 'watch' | 'at_risk' | 'critical'
  lifecycle_state: 'new' | 'onboarding' | 'newly_activated' | 'activated' | 'low_adoption' | 'dormant' | 'churned'
  churn_risk: 'low' | 'medium' | 'high' | 'critical'
  expansion_score: number
  expansion_state: 'none' | 'watch' | 'expansion_candidate' | 'upgrade_ready' | 'sales_followup'
  adoption_component: number
  engagement_component: number
  value_component: number
  billing_component: number
  risk_penalty: number
  authoritative_churned: boolean
  needs_intervention: boolean
  recommended_action: string
  recommended_lead_id: number | null
  recommended_owner_type: 'sdr' | 'ae' | null
  reasons: Record<string, unknown>
  evaluation_fingerprint: string
  evaluated_at: string
  created_at: string
}

export type SupabaseCurrentCustomerHealth = {
  account_id: string
  account_name: string
  onboarding_status: string | null
  company_size: string | null
  estimated_monthly_spend: string | null
  current_plan_id: 'starter' | 'growth' | 'scale'
  plan_status: 'active' | 'pending_payment' | 'inactive' | 'failed_payment'
  current_month_spend: string | null
  projected_month_end_spend: string | null
  budget_amount: string | null
  projected_overrun: boolean | null
  activation_score: number | null
  activated: boolean | null
  activated_at: string | null
  time_to_value_hours: string | null
  connected_provider_count: number
  active_service_count: number
  last_usage_at: string | null
  last_synced_at: string | null
  last_login_at: string | null
  last_product_event_at: string | null
  days_since_last_usage: number | null
  days_since_last_sync: number | null
  days_since_last_login: number | null
  days_since_last_product_event: number | null
  open_alert_count: number
  open_high_alert_count: number
  open_critical_alert_count: number
  open_recommendation_count: number
  applied_recommendation_count: number
  sales_ready_lead_count: number
  qualified_lead_count: number
  assigned_sales_lead_count: number
  ae_owned_lead_count: number
  sdr_owned_lead_count: number
  has_manual_sales_override: boolean
  latest_sales_owner_type: 'sdr' | 'ae' | null
  latest_sales_routing_status: string | null
  top_lead_id: number | null
  evaluation_id: string | null
  evaluation_type: SupabaseCustomerHealthEvaluation['evaluation_type'] | null
  rule_version: string | null
  health_score: number | null
  health_state: SupabaseCustomerHealthEvaluation['health_state'] | null
  lifecycle_state: SupabaseCustomerHealthEvaluation['lifecycle_state'] | null
  churn_risk: SupabaseCustomerHealthEvaluation['churn_risk'] | null
  expansion_score: number | null
  expansion_state: SupabaseCustomerHealthEvaluation['expansion_state'] | null
  recommended_action: string | null
  recommended_lead_id: number | null
  recommended_owner_type: 'sdr' | 'ae' | null
  authoritative_churned: boolean | null
  needs_intervention: boolean | null
  reasons: Record<string, unknown> | null
  evaluated_at: string | null
}

export type SupabaseCustomerHealthMetrics = {
  total_accounts: number
  healthy_accounts: number
  watch_accounts: number
  at_risk_accounts: number
  critical_accounts: number
  dormant_accounts: number
  payment_risk_accounts: number
  expansion_candidate_accounts: number
  upgrade_ready_accounts: number
  sales_followup_accounts: number
  activated_accounts: number
  activated_account_rate: string | null
  budget_adoption_rate: string | null
  active_provider_rate: string | null
  logo_churn_available: boolean
  revenue_churn_available: boolean
  grr_available: boolean
  nrr_available: boolean
}

export type SupabaseAccountDashboardOverview = {
  account_id: string
  account_name: string
  current_month_spend: string | null
  projected_month_end_spend: string | null
  average_daily_spend: string | null
  last_7_day_spend: string | null
  prior_7_day_spend: string | null
  usage_record_count: number | null
  last_usage_at: string | null
  budget_id: string | null
  budget_amount: string | null
  budget_currency: string | null
  threshold_percentage: number | null
  budget_used_percentage: string | null
  projected_budget_used_percentage: string | null
  projected_budget_variance: string | null
  projected_overrun: boolean | null
  provider_connected: boolean | null
  usage_synced: boolean | null
  insight_generated: boolean | null
  budget_created: boolean | null
  alert_configured: boolean | null
  activation_score: number | null
  activated: boolean | null
  activated_at: string | null
  time_to_value_hours: string | null
  current_plan_id: 'starter' | 'growth' | 'scale' | null
  plan_status: 'active' | 'pending_payment' | 'inactive' | 'failed_payment' | null
  billing_provider: 'payu' | null
  billing_interval: 'monthly' | 'custom' | null
}

export type SupabaseProviderSpendCurrentMonth = {
  account_id: string
  provider: string
  spend: string
  usage_quantity: string
  usage_record_count: number
  last_usage_at: string | null
}

export type SupabaseServiceSpendCurrentMonth = {
  account_id: string
  provider: string
  service_name: string
  model_name: string | null
  spend: string
  usage_quantity: string
  usage_record_count: number
  average_unit_price: string
  last_usage_at: string | null
}

export type SupabaseDailySpendCurrentMonth = {
  account_id: string
  spend_date: string
  spend: string
}

export type SupabaseActivationState = {
  account_id: string
  signup_at: string | null
  onboarding_completed_at: string | null
  provider_connected_at: string | null
  usage_synced_at: string | null
  insight_generated_at: string | null
  budget_created_at: string | null
  alert_configured_at: string | null
  first_cost_data_received_at: string | null
  provider_connected: boolean
  usage_synced: boolean
  insight_generated: boolean
  budget_created: boolean
  alert_configured: boolean
  activation_score: number
  activated: boolean
  latest_activation_signal_at: string | null
  activated_at: string | null
  time_to_value_hours: string | null
}

export type SupabaseBudgetStatusCurrentMonth = {
  account_id: string
  budget_id: string | null
  budget_amount: string | null
  currency: string | null
  threshold_percentage: number | null
  alerting_enabled: boolean | null
  budget_status: string | null
  current_month_spend: string | null
  projected_month_end_spend: string | null
  budget_used_percentage: string | null
  projected_budget_used_percentage: string | null
  projected_budget_variance: string | null
  projected_overrun: boolean | null
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function getSupabaseConfig() {
  return {
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

async function supabaseRequest(path: string, init: RequestInit) {
  const { url, serviceRoleKey } = getSupabaseConfig()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Supabase request failed: ${response.status} ${body}`)
  }

  return response
}

export async function upsertProfile(input: SupabaseProfileInput): Promise<SupabaseProfile> {
  const response = await supabaseRequest('profiles?on_conflict=firebase_uid&select=*', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      ...input,
    }),
  })

  const rows = (await response.json()) as SupabaseProfile[]
  const profile = rows[0]
  if (!profile) throw new Error('Supabase profile upsert returned no rows')
  return profile
}

export async function getProfileByFirebaseUid(firebaseUid: string): Promise<SupabaseProfile | null> {
  const response = await supabaseRequest(`profiles?firebase_uid=eq.${firebaseUid}&limit=1&select=*`, {
    method: 'GET',
  })
  const rows = (await response.json()) as SupabaseProfile[]
  return rows[0] ?? null
}

export async function getProfileById(profileId: string): Promise<SupabaseProfile | null> {
  const response = await supabaseRequest(`profiles?id=eq.${profileId}&limit=1&select=*`, {
    method: 'GET',
  })
  const rows = (await response.json()) as SupabaseProfile[]
  return rows[0] ?? null
}

export async function getAccountByProfileId(profileId: string): Promise<SupabaseAccount | null> {
  const response = await supabaseRequest(`account_members?profile_id=eq.${profileId}&select=account:accounts(*)`, {
    method: 'GET',
    headers: {
      Prefer: 'return=representation',
    },
  })

  const rows = (await response.json()) as Array<{ account: SupabaseAccount | null }>
  return rows[0]?.account ?? null
}

export async function upsertAccount(input: SupabaseAccountInput): Promise<SupabaseAccount> {
  const response = await supabaseRequest('accounts?on_conflict=slug&select=*', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(input),
  })

  const rows = (await response.json()) as SupabaseAccount[]
  const account = rows[0]
  if (!account) throw new Error('Supabase account upsert returned no rows')
  return account
}

export async function getAccountBySlug(slug: string): Promise<SupabaseAccount | null> {
  const response = await supabaseRequest(`accounts?slug=eq.${encodeURIComponent(slug)}&limit=1&select=*`, {
    method: 'GET',
  })
  const rows = (await response.json()) as SupabaseAccount[]
  return rows[0] ?? null
}

export async function getAccountById(accountId: string): Promise<SupabaseAccount | null> {
  const response = await supabaseRequest(`accounts?id=eq.${encodeURIComponent(accountId)}&limit=1&select=*`, {
    method: 'GET',
  })
  const rows = (await response.json()) as SupabaseAccount[]
  return rows[0] ?? null
}

export async function upsertAccountMembership(input: SupabaseMembershipInput): Promise<SupabaseMembership> {
  const response = await supabaseRequest('account_members?on_conflict=account_id,profile_id&select=*', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(input),
  })

  const rows = (await response.json()) as SupabaseMembership[]
  const membership = rows[0]
  if (!membership) throw new Error('Supabase membership upsert returned no rows')
  return membership
}

export async function getMembershipByAccountAndProfileId(accountId: string, profileId: string): Promise<SupabaseMembership | null> {
  const response = await supabaseRequest(
    `account_members?account_id=eq.${accountId}&profile_id=eq.${profileId}&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseMembership[]
  return rows[0] ?? null
}

export async function upsertOnboardingResponse(input: SupabaseOnboardingResponseInput): Promise<SupabaseOnboardingResponse> {
  const existing = await supabaseRequest(
    `onboarding_responses?profile_id=eq.${input.profile_id}&account_id=eq.${input.account_id}&order=updated_at.desc&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await existing.json()) as SupabaseOnboardingResponse[]
  if (rows[0]) {
    const current = rows[0]
    const response = await supabaseRequest(`onboarding_responses?id=eq.${current.id}&select=*`, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(input),
    })
    const updatedRows = (await response.json()) as SupabaseOnboardingResponse[]
    const updated = updatedRows[0]
    if (!updated) throw new Error('Supabase onboarding update returned no rows')
    return updated
  }

  const response = await supabaseRequest('onboarding_responses?select=*', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(input),
  })
  const createdRows = (await response.json()) as SupabaseOnboardingResponse[]
  const created = createdRows[0]
  if (!created) throw new Error('Supabase onboarding insert returned no rows')
  return created
}

export async function getLatestOnboardingResponseForAccount(accountId: string): Promise<SupabaseOnboardingResponse | null> {
  const response = await supabaseRequest(
    `onboarding_responses?account_id=eq.${accountId}&order=updated_at.desc&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseOnboardingResponse[]
  return rows[0] ?? null
}

export async function updateAccountOnboardingStatus(accountId: string, onboardingStatus: string) {
  const response = await supabaseRequest(`accounts?id=eq.${accountId}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ onboarding_status: onboardingStatus }),
  })

  const rows = (await response.json()) as SupabaseAccount[]
  const account = rows[0]
  if (!account) throw new Error('Supabase account status update returned no rows')
  return account
}

export async function insertProductEvent(input: {
  event_id?: string | null
  firebase_uid: string | null
  profile_id: string | null
  account_id: string | null
  event_name: string
  event_source: string
  event_trust_level?: 'trusted' | 'untrusted'
  occurred_at?: string
  event_properties: Record<string, unknown>
}): Promise<SupabaseProductEvent> {
  if (input.event_id) {
    const existing = await getProductEventByEventId(input.event_id).catch((error) => {
      if (isMissingProductEventEnvelopeColumn(error)) return null
      throw error
    })
    if (existing) return existing
  }

  const response = await insertProductEventRow(input).catch((error) => {
    if (!isMissingProductEventEnvelopeColumn(error)) throw error
    return insertProductEventRow(toLegacyProductEventInput(input))
  })

  const rows = (await response.json()) as SupabaseProductEvent[]
  const event = rows[0]
  if (!event) throw new Error('Supabase product event insert returned no rows')
  return event
}

function isMissingProductEventEnvelopeColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('product_events') &&
    (message.includes('event_id') || message.includes('occurred_at') || message.includes('event_trust_level'))
  )
}

function toLegacyProductEventInput(input: {
  firebase_uid: string | null
  profile_id: string | null
  account_id: string | null
  event_name: string
  event_source: string
  event_properties: Record<string, unknown>
}) {
  return {
    firebase_uid: input.firebase_uid,
    profile_id: input.profile_id,
    account_id: input.account_id,
    event_name: input.event_name,
    event_source: input.event_source,
    event_properties: input.event_properties,
  }
}

function insertProductEventRow(input: Record<string, unknown>) {
  return supabaseRequest('product_events?select=*', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(input),
  })
}

export async function getProductEventByEventId(eventId: string): Promise<SupabaseProductEvent | null> {
  const response = await supabaseRequest(
    `product_events?event_id=eq.${encodeURIComponent(eventId)}&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseProductEvent[]
  return rows[0] ?? null
}

export async function getAcquisitionTouchByIdentity(identityKey: string, touchType: string): Promise<SupabaseAcquisitionTouch | null> {
  const response = await supabaseRequest(
    `acquisition_touches?identity_key=eq.${encodeURIComponent(identityKey)}&touch_type=eq.${touchType}&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseAcquisitionTouch[]
  return rows[0] ?? null
}

export async function insertAcquisitionTouch(input: Omit<SupabaseAcquisitionTouch, 'id' | 'identity_key' | 'created_at'>): Promise<SupabaseAcquisitionTouch> {
  const response = await supabaseRequest('acquisition_touches?select=*', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(input),
  })

  const rows = (await response.json()) as SupabaseAcquisitionTouch[]
  const touch = rows[0]
  if (!touch) throw new Error('Supabase acquisition touch insert returned no rows')
  return touch
}

export async function updateAcquisitionTouch(id: string, input: Partial<Omit<SupabaseAcquisitionTouch, 'id' | 'identity_key' | 'created_at'>>): Promise<SupabaseAcquisitionTouch> {
  const response = await supabaseRequest(`acquisition_touches?id=eq.${id}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(input),
  })

  const rows = (await response.json()) as SupabaseAcquisitionTouch[]
  const touch = rows[0]
  if (!touch) throw new Error('Supabase acquisition touch update returned no rows')
  return touch
}

export async function linkAcquisitionTouchesToProfile(firebaseUid: string, profileId: string) {
  const response = await supabaseRequest(
    `acquisition_touches?firebase_uid=eq.${encodeURIComponent(firebaseUid)}&profile_id=is.null&select=*`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ profile_id: profileId }),
    },
  )

  return (await response.json()) as SupabaseAcquisitionTouch[]
}

export async function linkAcquisitionTouchesToAccount(profileId: string, accountId: string) {
  const response = await supabaseRequest(
    `acquisition_touches?profile_id=eq.${profileId}&account_id=is.null&select=*`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ account_id: accountId }),
    },
  )

  return (await response.json()) as SupabaseAcquisitionTouch[]
}

export async function updateProfileFirstTouchFields(profileId: string, input: {
  first_touch_source?: string | null
  first_touch_medium?: string | null
  first_touch_campaign?: string | null
  first_touch_referrer?: string | null
}): Promise<SupabaseProfile> {
  const response = await supabaseRequest(`profiles?id=eq.${profileId}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(input),
  })

  const rows = (await response.json()) as SupabaseProfile[]
  const profile = rows[0]
  if (!profile) throw new Error('Supabase profile first-touch update returned no rows')
  return profile
}

export async function upsertAcquisitionPartner(input: Omit<SupabaseAcquisitionPartner, 'created_at' | 'updated_at'>): Promise<SupabaseAcquisitionPartner> {
  const response = await supabaseRequest('acquisition_partners?on_conflict=partner_id&select=*', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(input),
  })

  const rows = (await response.json()) as SupabaseAcquisitionPartner[]
  const partner = rows[0]
  if (!partner) throw new Error('Supabase acquisition partner upsert returned no rows')
  return partner
}

export async function upsertAcquisitionCreator(input: Omit<SupabaseAcquisitionCreator, 'created_at' | 'updated_at'>): Promise<SupabaseAcquisitionCreator> {
  const response = await supabaseRequest('acquisition_creators?on_conflict=creator_id&select=*', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(input),
  })

  const rows = (await response.json()) as SupabaseAcquisitionCreator[]
  const creator = rows[0]
  if (!creator) throw new Error('Supabase acquisition creator upsert returned no rows')
  return creator
}

export async function upsertAcquisitionReferral(input: Omit<SupabaseAcquisitionReferral, 'created_at' | 'updated_at'>): Promise<SupabaseAcquisitionReferral> {
  const response = await supabaseRequest('acquisition_referrals?on_conflict=referral_id&select=*', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(input),
  })

  const rows = (await response.json()) as SupabaseAcquisitionReferral[]
  const referral = rows[0]
  if (!referral) throw new Error('Supabase acquisition referral upsert returned no rows')
  return referral
}

export async function listProviderConnections(accountId: string): Promise<SupabaseProviderConnection[]> {
  const response = await supabaseRequest(
    `provider_connections?account_id=eq.${accountId}&order=connected_at.asc&select=*`,
    { method: 'GET' },
  )
  return (await response.json()) as SupabaseProviderConnection[]
}

export async function getProviderConnectionForAccount(id: string, accountId: string): Promise<SupabaseProviderConnection | null> {
  const response = await supabaseRequest(
    `provider_connections?id=eq.${id}&account_id=eq.${accountId}&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseProviderConnection[]
  return rows[0] ?? null
}

export async function upsertProviderConnection(input: {
  account_id: string
  provider: SupabaseProviderConnection['provider']
  connection_mode: SupabaseProviderConnection['connection_mode']
  connection_status: SupabaseProviderConnection['connection_status']
  external_reference?: string | null
  metadata?: Record<string, unknown>
  connected_at?: string
  last_synced_at?: string | null
}): Promise<SupabaseProviderConnection> {
  const response = await supabaseRequest(
    'provider_connections?on_conflict=account_id,provider,connection_mode&select=*',
    {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        external_reference: null,
        metadata: {},
        ...input,
      }),
    },
  )
  const rows = (await response.json()) as SupabaseProviderConnection[]
  const connection = rows[0]
  if (!connection) throw new Error('Supabase provider connection upsert returned no rows')
  return connection
}

export async function updateProviderConnectionForAccount(input: {
  id: string
  account_id: string
  connection_status: SupabaseProviderConnection['connection_status']
  metadata?: Record<string, unknown>
  last_synced_at?: string | null
}): Promise<SupabaseProviderConnection> {
  const response = await supabaseRequest(`provider_connections?id=eq.${input.id}&account_id=eq.${input.account_id}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      connection_status: input.connection_status,
      metadata: input.metadata ?? {},
      last_synced_at: input.last_synced_at ?? null,
    }),
  })
  const rows = (await response.json()) as SupabaseProviderConnection[]
  const connection = rows[0]
  if (!connection) throw new Error('provider_connection_not_found')
  return connection
}

export async function upsertUsageRecords(
  input: Array<{
    account_id: string
    provider_connection_id: string
    provider: SupabaseUsageRecord['provider']
    service_name: string
    model_name?: string | null
    usage_quantity: number | string
    usage_unit: string
    unit_price: number | string
    calculated_cost: number | string
    usage_at: string
    period_start?: string | null
    period_end?: string | null
    source_type: SupabaseUsageRecord['source_type']
    source_record_id: string
    metadata?: Record<string, unknown>
  }>,
): Promise<SupabaseUsageRecord[]> {
  const response = await supabaseRequest(
    'usage_records?on_conflict=provider_connection_id,source_type,source_record_id&select=*',
    {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(input.map((row) => ({
        model_name: null,
        metadata: {},
        ...row,
      }))),
    },
  )
  return (await response.json()) as SupabaseUsageRecord[]
}

export async function getUsageRecordBySource(input: {
  provider_connection_id: string
  source_type: SupabaseUsageRecord['source_type']
  source_record_id: string
}): Promise<SupabaseUsageRecord | null> {
  const response = await supabaseRequest(
    `usage_records?provider_connection_id=eq.${input.provider_connection_id}&source_type=eq.${input.source_type}&source_record_id=eq.${encodeURIComponent(input.source_record_id)}&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseUsageRecord[]
  return rows[0] ?? null
}

export async function listApiSyncUsageRecords(accountId: string, limit = 10): Promise<SupabaseUsageRecord[]> {
  const response = await supabaseRequest(
    `usage_records?account_id=eq.${accountId}&source_type=eq.api_sync&order=usage_at.desc&limit=${limit}&select=*`,
    { method: 'GET' },
  )
  return (await response.json()) as SupabaseUsageRecord[]
}

export async function listUsageRecordsSince(input: {
  accountId: string
  provider?: SupabaseUsageRecord['provider'] | null
  since: string
  until: string
  limit?: number
}): Promise<SupabaseUsageRecord[]> {
  const providerFilter = input.provider ? `&provider=eq.${input.provider}` : ''
  const response = await supabaseRequest(
    `usage_records?account_id=eq.${input.accountId}${providerFilter}&usage_at=gte.${encodeURIComponent(input.since)}&usage_at=lt.${encodeURIComponent(input.until)}&order=usage_at.desc&limit=${input.limit ?? 1000}&select=*`,
    { method: 'GET' },
  )
  return (await response.json()) as SupabaseUsageRecord[]
}

export async function listProviderUsageLimits(accountId: string): Promise<SupabaseProviderUsageLimit[]> {
  const response = await supabaseRequest(
    `provider_usage_limits?account_id=eq.${accountId}&order=created_at.asc&select=*`,
    { method: 'GET' },
  )
  return (await response.json()) as SupabaseProviderUsageLimit[]
}

export async function upsertProviderUsageLimit(input: {
  account_id: string
  provider_connection_id: string
  limit_type: SupabaseProviderUsageLimit['limit_type']
  limit_amount: number | string
  limit_period: SupabaseProviderUsageLimit['limit_period']
  threshold_percentage?: number
  enabled?: boolean
  metadata?: Record<string, unknown>
}): Promise<SupabaseProviderUsageLimit> {
  const response = await supabaseRequest('provider_usage_limits?on_conflict=account_id,provider_connection_id,limit_type,limit_period&select=*', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      threshold_percentage: input.threshold_percentage ?? 70,
      enabled: input.enabled ?? true,
      metadata: input.metadata ?? {},
      ...input,
    }),
  })
  const rows = (await response.json()) as SupabaseProviderUsageLimit[]
  const limit = rows[0]
  if (!limit) throw new Error('provider_usage_limit_upsert_failed')
  return limit
}

export async function upsertBudget(input: {
  account_id: string
  provider_connection_id?: string | null
  provider?: SupabaseBudget['provider']
  budget_scope: SupabaseBudget['budget_scope']
  period_month: string
  amount: number | string
  currency: string
  threshold_percentage?: number | null
  alerting_enabled?: boolean
  status?: SupabaseBudget['status']
  created_by_profile_id?: string | null
}): Promise<SupabaseBudget> {
  const filterProvider = input.provider ?? '__account__'
  const existingResponse = await supabaseRequest(
    `budgets?account_id=eq.${input.account_id}&budget_scope=eq.${input.budget_scope}&period_month=eq.${input.period_month}&select=*`,
    { method: 'GET' },
  )
  const rows = (await existingResponse.json()) as SupabaseBudget[]
  const existing = rows.find((row) => (row.provider ?? '__account__') === filterProvider)

  if (existing) {
    const response = await supabaseRequest(`budgets?id=eq.${existing.id}&select=*`, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        provider_connection_id: input.provider_connection_id ?? null,
        provider: input.provider ?? null,
        amount: input.amount,
        currency: input.currency,
        threshold_percentage: input.threshold_percentage ?? null,
        alerting_enabled: input.alerting_enabled ?? true,
        status: input.status ?? 'active',
        created_by_profile_id: input.created_by_profile_id ?? null,
      }),
    })
    const updatedRows = (await response.json()) as SupabaseBudget[]
    const budget = updatedRows[0]
    if (!budget) throw new Error('Supabase budget update returned no rows')
    return budget
  }

  const response = await supabaseRequest('budgets?select=*', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      provider_connection_id: input.provider_connection_id ?? null,
      provider: input.provider ?? null,
      threshold_percentage: input.threshold_percentage ?? null,
      alerting_enabled: input.alerting_enabled ?? true,
      status: input.status ?? 'active',
      created_by_profile_id: input.created_by_profile_id ?? null,
      ...input,
    }),
  })
  const createdRows = (await response.json()) as SupabaseBudget[]
  const budget = createdRows[0]
  if (!budget) throw new Error('Supabase budget insert returned no rows')
  return budget
}

export async function getCurrentMonthBudgetStatus(accountId: string): Promise<SupabaseBudgetStatusCurrentMonth | null> {
  const response = await supabaseRequest(
    `account_budget_status_current_month?account_id=eq.${accountId}&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseBudgetStatusCurrentMonth[]
  return rows[0] ?? null
}

export async function listOpenProductAlerts(accountId: string): Promise<SupabaseProductAlert[]> {
  const response = await supabaseRequest(
    `product_alerts?account_id=eq.${accountId}&status=eq.open&order=triggered_at.desc&select=*`,
    { method: 'GET' },
  )
  return (await response.json()) as SupabaseProductAlert[]
}

export async function insertProductAlert(input: {
  account_id: string
  provider_connection_id?: string | null
  budget_id?: string | null
  provider?: SupabaseProductAlert['provider']
  alert_type: SupabaseProductAlert['alert_type']
  severity: SupabaseProductAlert['severity']
  status?: SupabaseProductAlert['status']
  threshold_value?: number | string | null
  observed_value?: number | string | null
  observed_period: string
  metadata?: Record<string, unknown>
  triggered_at?: string
}): Promise<SupabaseProductAlert> {
  const response = await supabaseRequest('product_alerts?select=*', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      provider_connection_id: input.provider_connection_id ?? null,
      budget_id: input.budget_id ?? null,
      provider: input.provider ?? null,
      status: input.status ?? 'open',
      threshold_value: input.threshold_value ?? null,
      observed_value: input.observed_value ?? null,
      metadata: input.metadata ?? {},
      triggered_at: input.triggered_at ?? new Date().toISOString(),
      ...input,
    }),
  })
  const rows = (await response.json()) as SupabaseProductAlert[]
  const alert = rows[0]
  if (!alert) throw new Error('Supabase product alert insert returned no rows')
  return alert
}

export async function resolveProductAlert(id: string, resolvedAt: string): Promise<SupabaseProductAlert> {
  const response = await supabaseRequest(`product_alerts?id=eq.${id}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      status: 'resolved',
      resolved_at: resolvedAt,
    }),
  })
  const rows = (await response.json()) as SupabaseProductAlert[]
  const alert = rows[0]
  if (!alert) throw new Error('Supabase product alert update returned no rows')
  return alert
}

export async function resolveProductAlertForAccount(id: string, accountId: string, resolvedAt: string): Promise<SupabaseProductAlert> {
  const response = await supabaseRequest(`product_alerts?id=eq.${id}&account_id=eq.${accountId}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      status: 'resolved',
      resolved_at: resolvedAt,
    }),
  })
  const rows = (await response.json()) as SupabaseProductAlert[]
  const alert = rows[0]
  if (!alert) throw new Error('product_alert_not_found')
  return alert
}

export async function listOpenCostRecommendations(accountId: string): Promise<SupabaseCostRecommendation[]> {
  const response = await supabaseRequest(
    `cost_recommendations?account_id=eq.${accountId}&status=eq.open&order=generated_at.desc&select=*`,
    { method: 'GET' },
  )
  return (await response.json()) as SupabaseCostRecommendation[]
}

export async function insertCostRecommendation(input: {
  account_id: string
  provider_connection_id?: string | null
  provider?: SupabaseCostRecommendation['provider']
  service_name?: string | null
  model_name?: string | null
  recommendation_type: SupabaseCostRecommendation['recommendation_type']
  priority: SupabaseCostRecommendation['priority']
  status?: SupabaseCostRecommendation['status']
  title: string
  summary: string
  observed_value?: number | string | null
  metadata?: Record<string, unknown>
  generated_at?: string
}): Promise<SupabaseCostRecommendation> {
  const response = await supabaseRequest('cost_recommendations?select=*', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      provider_connection_id: input.provider_connection_id ?? null,
      provider: input.provider ?? null,
      service_name: input.service_name ?? null,
      model_name: input.model_name ?? null,
      status: input.status ?? 'open',
      observed_value: input.observed_value ?? null,
      metadata: input.metadata ?? {},
      generated_at: input.generated_at ?? new Date().toISOString(),
      ...input,
    }),
  })
  const rows = (await response.json()) as SupabaseCostRecommendation[]
  const recommendation = rows[0]
  if (!recommendation) throw new Error('Supabase recommendation insert returned no rows')
  return recommendation
}

export async function dismissCostRecommendation(id: string): Promise<SupabaseCostRecommendation> {
  const response = await supabaseRequest(`cost_recommendations?id=eq.${id}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      status: 'dismissed',
    }),
  })
  const rows = (await response.json()) as SupabaseCostRecommendation[]
  const recommendation = rows[0]
  if (!recommendation) throw new Error('Supabase recommendation update returned no rows')
  return recommendation
}

export async function dismissCostRecommendationForAccount(id: string, accountId: string): Promise<SupabaseCostRecommendation> {
  const response = await supabaseRequest(`cost_recommendations?id=eq.${id}&account_id=eq.${accountId}&select=*`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      status: 'dismissed',
    }),
  })
  const rows = (await response.json()) as SupabaseCostRecommendation[]
  const recommendation = rows[0]
  if (!recommendation) throw new Error('cost_recommendation_not_found')
  return recommendation
}

export async function getAccountDashboardOverview(accountId: string): Promise<SupabaseAccountDashboardOverview | null> {
  const response = await supabaseRequest(
    `account_dashboard_overview?account_id=eq.${accountId}&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseAccountDashboardOverview[]
  return rows[0] ?? null
}

export async function listProviderSpendCurrentMonth(accountId: string): Promise<SupabaseProviderSpendCurrentMonth[]> {
  const response = await supabaseRequest(
    `account_provider_spend_current_month?account_id=eq.${accountId}&order=spend.desc&select=*`,
    { method: 'GET' },
  )
  return (await response.json()) as SupabaseProviderSpendCurrentMonth[]
}

export async function listServiceSpendCurrentMonth(accountId: string): Promise<SupabaseServiceSpendCurrentMonth[]> {
  const response = await supabaseRequest(
    `account_service_spend_current_month?account_id=eq.${accountId}&order=spend.desc&select=*`,
    { method: 'GET' },
  )
  return (await response.json()) as SupabaseServiceSpendCurrentMonth[]
}

export async function listDailySpendCurrentMonth(accountId: string): Promise<SupabaseDailySpendCurrentMonth[]> {
  const response = await supabaseRequest(
    `account_daily_spend_current_month?account_id=eq.${accountId}&order=spend_date.asc&select=*`,
    { method: 'GET' },
  )
  return (await response.json()) as SupabaseDailySpendCurrentMonth[]
}

export async function getAccountActivationState(accountId: string): Promise<SupabaseActivationState | null> {
  const response = await supabaseRequest(
    `account_activation_state?account_id=eq.${accountId}&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseActivationState[]
  return rows[0] ?? null
}

export async function getAccountPlan(accountId: string): Promise<SupabaseAccountPlan | null> {
  const response = await supabaseRequest(`account_plans?account_id=eq.${accountId}&limit=1&select=*`, {
    method: 'GET',
  })
  const rows = (await response.json()) as SupabaseAccountPlan[]
  return rows[0] ?? null
}

export async function upsertAccountPlan(input: {
  account_id: string
  profile_id?: string | null
  current_plan_id: SupabaseAccountPlan['current_plan_id']
  plan_status: SupabaseAccountPlan['plan_status']
  billing_provider?: 'payu'
  billing_interval: SupabaseAccountPlan['billing_interval']
  latest_transaction_id?: string | null
  activated_at?: string | null
  expires_at?: string | null
  cancellation_requested_at?: string | null
  cancelled_at?: string | null
  cancellation_reason?: string | null
  metadata?: Record<string, unknown>
}): Promise<SupabaseAccountPlan> {
  const response = await supabaseRequest('account_plans?on_conflict=account_id&select=*', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      profile_id: input.profile_id ?? null,
      billing_provider: input.billing_provider ?? 'payu',
      latest_transaction_id: input.latest_transaction_id ?? null,
      activated_at: input.activated_at ?? null,
      expires_at: input.expires_at ?? null,
      cancellation_requested_at: input.cancellation_requested_at ?? null,
      cancelled_at: input.cancelled_at ?? null,
      cancellation_reason: input.cancellation_reason ?? null,
      metadata: input.metadata ?? {},
      ...input,
    }),
  })
  const rows = (await response.json()) as SupabaseAccountPlan[]
  const plan = rows[0]
  if (!plan) throw new Error('Supabase account plan upsert returned no rows')
  return plan
}

export async function getBillingTransactionByProviderTxnId(providerTxnId: string): Promise<SupabaseBillingTransaction | null> {
  const response = await supabaseRequest(
    `billing_transactions?billing_provider=eq.payu&provider_txn_id=eq.${providerTxnId}&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseBillingTransaction[]
  return rows[0] ?? null
}

export async function upsertBillingTransaction(input: {
  account_id?: string | null
  profile_id?: string | null
  billing_provider?: 'payu'
  plan_id: SupabaseBillingTransaction['plan_id']
  billing_interval?: SupabaseBillingTransaction['billing_interval']
  amount: number | string
  currency: string
  provider_txn_id: string
  provider_payment_id?: string | null
  payment_status: SupabaseBillingTransaction['payment_status']
  verification_status: SupabaseBillingTransaction['verification_status']
  idempotency_key?: string | null
  checkout_payload?: Record<string, unknown>
  verified_payload?: Record<string, unknown>
  activated_at?: string | null
  verified_at?: string | null
}): Promise<SupabaseBillingTransaction> {
  const response = await supabaseRequest(
    'billing_transactions?on_conflict=billing_provider,provider_txn_id&select=*',
    {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        account_id: input.account_id ?? null,
        profile_id: input.profile_id ?? null,
        billing_provider: input.billing_provider ?? 'payu',
        billing_interval: input.billing_interval ?? null,
        provider_payment_id: input.provider_payment_id ?? null,
        idempotency_key: input.idempotency_key ?? null,
        checkout_payload: input.checkout_payload ?? {},
        verified_payload: input.verified_payload ?? {},
        activated_at: input.activated_at ?? null,
        verified_at: input.verified_at ?? null,
        ...input,
      }),
    },
  )
  const rows = (await response.json()) as SupabaseBillingTransaction[]
  const transaction = rows[0]
  if (!transaction) throw new Error('Supabase billing transaction upsert returned no rows')
  return transaction
}

export async function listLeadIdsByAccount(accountId: string): Promise<number[]> {
  const response = await supabaseRequest(
    `lead_qualification_signal_assembly?account_id=eq.${accountId}&select=lead_id`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as Array<{ lead_id: number }>
  return rows.map((row) => row.lead_id)
}

export async function evaluateLeadQualification(leadId: number, evaluationType = 'runtime', sourceRuntime = 'system') {
  const response = await supabaseRequest('rpc/evaluate_lead_qualification', {
    method: 'POST',
    body: JSON.stringify({
      p_lead_id: leadId,
      p_evaluation_type: evaluationType,
      p_source_runtime: sourceRuntime,
    }),
  })
  return (await response.json()) as Array<Record<string, unknown>>
}

export async function evaluateAccountHealth(
  accountId: string,
  evaluationType: SupabaseCustomerHealthEvaluation['evaluation_type'] = 'runtime',
) {
  const response = await supabaseRequest('rpc/evaluate_account_health', {
    method: 'POST',
    body: JSON.stringify({
      p_account_id: accountId,
      p_evaluation_type: evaluationType,
    }),
  })
  return (await response.json()) as Array<Record<string, unknown>>
}

export async function getCurrentCustomerHealth(accountId: string): Promise<SupabaseCurrentCustomerHealth | null> {
  const response = await supabaseRequest(
    `current_customer_health?account_id=eq.${accountId}&limit=1&select=*`,
    { method: 'GET' },
  )
  const rows = (await response.json()) as SupabaseCurrentCustomerHealth[]
  return rows[0] ?? null
}

export async function getCustomerHealthMetrics(): Promise<SupabaseCustomerHealthMetrics | null> {
  const response = await supabaseRequest('customer_health_metrics?limit=1&select=*', {
    method: 'GET',
  })
  const rows = (await response.json()) as SupabaseCustomerHealthMetrics[]
  return rows[0] ?? null
}
