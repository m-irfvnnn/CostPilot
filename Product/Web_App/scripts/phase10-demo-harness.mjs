import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'

const baseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const verbose = process.env.PHASE10_VERBOSE === '1'

const PREFIX = 'phase10_demo'
const COHORT_VERSION = 'phase10_v1'
const CAMPAIGN_DEFAULT = 'phase10_historical_demo'
const DEMO_END_AT = '2026-08-29T12:00:00.000Z'
const DEMO_END = new Date(DEMO_END_AT)
const DEMO_START_AT = isoFromOffset(180, 11)

const PARTNER_ID = 'phase10_partner_alliance'
const CREATOR_ID = 'phase10_creator_review'
const REFERRAL_ID = 'phase10_referral_program'

const SALES_REP_CODES = {
  sdr: 'sdr_na_1',
  sdrGlobal: 'sdr_global_1',
  ae: 'ae_global_1',
  aeEnterprise: 'ae_ent_na_1',
}

const BRACKET_BY_REVENUE = {
  low: '$1K-$5K',
  medium: '$5K-$10K',
  high: '$10K-$25K',
  higher: '$25K-$50K',
}

const PROVIDER_DISPLAY = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  aws: 'AWS',
}

const PROVIDER_TEMPLATES = {
  openai: [
    { service_name: 'chat-completions', model_name: 'gpt-4o-mini', quantity: 180000, unit_price: 0.0000045 },
    { service_name: 'responses', model_name: 'gpt-4.1-mini', quantity: 95000, unit_price: 0.000006 },
  ],
  anthropic: [
    { service_name: 'messages', model_name: 'claude-3-5-sonnet', quantity: 76000, unit_price: 0.0000085 },
  ],
  aws: [
    { service_name: 'bedrock-runtime', model_name: 'claude-3-haiku', quantity: 54000, unit_price: 0.000007 },
  ],
}

const USAGE_SCHEDULES = {
  healthy: {
    priorDays: [58, 55, 52, 49, 46, 42, 39, 34],
    currentDays: [28, 26, 24, 21, 19, 17, 14, 11, 8, 6, 4, 2, 1],
    currentMultiplier: 1.12,
  },
  mature_light: {
    priorDays: [57, 53, 48, 43, 37],
    currentDays: [28, 22, 18, 13, 9, 5, 2],
    currentMultiplier: 1.05,
  },
  newly_activated: {
    priorDays: [],
    currentDays: [10, 8, 6, 4, 3, 2, 1],
    currentMultiplier: 1,
  },
  at_risk: {
    priorDays: [58, 54, 50, 46, 41, 36, 33],
    currentDays: [28, 23, 18, 12, 9],
    currentMultiplier: 0.58,
  },
  dormant: {
    priorDays: [58, 54, 50, 45, 39, 33],
    currentDays: [28, 25, 22],
    currentMultiplier: 0.42,
  },
  payment_risk: {
    priorDays: [58, 54, 50, 46, 41, 36],
    currentDays: [28, 24, 20, 15, 11, 8, 5, 3, 1],
    currentMultiplier: 1.08,
  },
  expansion: {
    priorDays: [58, 55, 52, 49, 46, 42, 38, 34],
    currentDays: [28, 26, 24, 22, 20, 18, 15, 12, 10, 8, 6, 4, 3, 2, 1],
    currentMultiplier: 1.38,
  },
  budget_pressure: {
    priorDays: [58, 54, 50, 46, 41, 36],
    currentDays: [28, 26, 23, 21, 18, 16, 14, 12, 10, 8, 6, 5, 4, 3, 2, 1],
    currentMultiplier: 1.62,
  },
  cancelled: {
    priorDays: [120, 107, 93, 81, 69, 57, 48, 39],
    currentDays: [],
    currentMultiplier: 0,
  },
}

function isoFromOffset(daysAgo, hour = 12, minute = 0) {
  const date = new Date(DEMO_END)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  date.setUTCHours(hour, minute, 0, 0)
  return date.toISOString()
}

function demoDateOnly(daysAgo) {
  return isoFromOffset(daysAgo).slice(0, 10)
}

function currentMonthStart() {
  return new Date(Date.UTC(DEMO_END.getUTCFullYear(), DEMO_END.getUTCMonth(), 1, 0, 0, 0, 0))
    .toISOString()
    .slice(0, 10)
}

function numeric(value) {
  return value == null ? 0 : Number(value)
}

function logStep(message, details = null) {
  if (!verbose) return
  const payload = details == null ? message : `${message} ${JSON.stringify(details)}`
  console.error(`[phase10] ${payload}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function md5(value) {
  return crypto.createHash('md5').update(value).digest('hex')
}

function eqValue(value) {
  return encodeURIComponent(value)
}

function inClause(values) {
  return values.map((value) => `"${String(value).replaceAll('"', '\\"')}"`).join(',')
}

function baseMetadata(extra = {}) {
  return {
    synthetic: true,
    demo: true,
    cohort: 'phase10',
    version: COHORT_VERSION,
    ...extra,
  }
}

function makeCompany({
  slug,
  name,
  leadSourceType = 'inbound',
  channel = 'inbound',
  source = 'website',
  medium = 'web_form',
  campaign = CAMPAIGN_DEFAULT,
  form = 'demo_request',
  icpScore = 75,
  buyingIntent = 'medium',
  leadStatus = 'qualified',
  employees = 60,
  country = 'US',
  industry = 'AI',
  firstTouchDaysAgo = 145,
  lastTouchDaysAgo = 122,
  interactionDaysAgo = 100,
  hasAccount = true,
  accountCreatedDaysAgo = 95,
  onboardingCompletedDaysAgo = 90,
  companySize = '51-200',
  spendBracket = BRACKET_BY_REVENUE.high,
  lastLoginDaysAgo = 2,
  productPattern = 'healthy',
  providers = ['openai', 'anthropic'],
  planId = 'growth',
  planStatus = 'active',
  planActivatedDaysAgo = 85,
  planExpiresDaysAgo = null,
  cancellationRequestedDaysAgo = null,
  cancelledDaysAgo = null,
  cancellationReason = null,
  billingHistory = [{ suffix: 'latest', paymentStatus: 'success', verificationStatus: 'verified', daysAgo: 24, amount: 1 }],
  budget = { amount: 1600, threshold: 82, daysAgo: 24, status: 'active' },
  alerts = [],
  recommendations = [],
  eventExtras = [],
  routeMode = 'default',
  historicalHealth = [],
  historicalQualification = [],
  usageBaseCost = 58,
  currentProviderStatus = {},
  openPipeline = false,
  roleNotes = [],
  sourceIds = {},
} = {}) {
  return {
    slug,
    name,
    leadSourceType,
    channel,
    source,
    medium,
    campaign,
    form,
    icpScore,
    buyingIntent,
    leadStatus,
    employees,
    country,
    industry,
    firstTouchDaysAgo,
    lastTouchDaysAgo,
    interactionDaysAgo,
    hasAccount,
    accountCreatedDaysAgo,
    onboardingCompletedDaysAgo,
    companySize,
    spendBracket,
    lastLoginDaysAgo,
    productPattern,
    providers,
    planId,
    planStatus,
    planActivatedDaysAgo,
    planExpiresDaysAgo,
    cancellationRequestedDaysAgo,
    cancelledDaysAgo,
    cancellationReason,
    billingHistory,
    budget,
    alerts,
    recommendations,
    eventExtras,
    routeMode,
    historicalHealth,
    historicalQualification,
    usageBaseCost,
    currentProviderStatus,
    openPipeline,
    roleNotes,
    sourceIds,
  }
}

const COHORT = [
  makeCompany({
    slug: 'partner_anchor',
    name: 'Phase10 Demo Partner Anchor',
    channel: 'partner',
    source: 'partner_portal',
    medium: 'partner',
    campaign: 'phase10_partner_alliance',
    icpScore: 84,
    buyingIntent: 'medium',
    employees: 92,
    firstTouchDaysAgo: 164,
    lastTouchDaysAgo: 147,
    interactionDaysAgo: 128,
    accountCreatedDaysAgo: 118,
    onboardingCompletedDaysAgo: 113,
    spendBracket: BRACKET_BY_REVENUE.high,
    lastLoginDaysAgo: 1,
    productPattern: 'expansion',
    providers: ['openai', 'anthropic', 'aws'],
    planId: 'growth',
    planActivatedDaysAgo: 106,
    budget: { amount: 2400, threshold: 84, daysAgo: 36, status: 'active' },
    alerts: [{ type: 'budget_threshold_reached', severity: 'low', observedValue: 78, daysAgo: 5, status: 'open' }],
    recommendations: [{ provider: 'openai', type: 'provider_cost_concentration', priority: 'medium', title: 'Review OpenAI concentration', observedValue: 690, daysAgo: 3, status: 'open' }],
    eventExtras: [
      ...eventSeries('dashboard_viewed', [27, 24, 21, 16, 12, 8, 5, 2]),
      ...eventSeries('forecast_viewed', [19, 9, 3]),
      ...eventSeries('recommendation_viewed', [10, 4]),
      ...eventSeries('plan_selected', [95]),
    ],
    routeMode: 'handoff',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'watch', 76, 32, 132),
      healthSnapshot('healthy', 'activated', 'low', 'expansion_candidate', 84, 58, 44),
    ],
    historicalQualification: [
      qualificationSnapshot('qualified', 'awaiting_engagement', 'insufficient_product_signals', 79, 'medium', 82, 'high', 150),
    ],
    usageBaseCost: 72,
    roleNotes: ['primary_customer', 'primary_lead', 'partner_sourced', 'sdr_to_ae_handoff'],
    sourceIds: { partner_id: PARTNER_ID },
  }),
  makeCompany({
    slug: 'healthy_finops_1',
    name: 'Phase10 Demo FinOps North',
    source: 'pricing_page',
    medium: 'pricing_intent',
    campaign: 'phase10_pricing_intent',
    employees: 58,
    firstTouchDaysAgo: 170,
    lastTouchDaysAgo: 141,
    interactionDaysAgo: 116,
    accountCreatedDaysAgo: 108,
    onboardingCompletedDaysAgo: 104,
    spendBracket: BRACKET_BY_REVENUE.high,
    lastLoginDaysAgo: 2,
    productPattern: 'healthy',
    providers: ['openai', 'anthropic'],
    planId: 'growth',
    planActivatedDaysAgo: 93,
    budget: { amount: 1800, threshold: 80, daysAgo: 31, status: 'active' },
    recommendations: [{ provider: 'anthropic', type: 'service_cost_concentration', priority: 'low', title: 'Watch Anthropic service mix', observedValue: 240, daysAgo: 6, status: 'open' }],
    eventExtras: [...eventSeries('dashboard_viewed', [26, 20, 13, 7, 1]), ...eventSeries('forecast_viewed', [15, 5])],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('watch', 'activated', 'medium', 'watch', 68, 24, 120),
      healthSnapshot('healthy', 'activated', 'low', 'watch', 79, 38, 38),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'product_qualified', 77, 'medium', 78, 'high', 145)],
    usageBaseCost: 56,
    roleNotes: ['healthy_mature'],
  }),
  makeCompany({
    slug: 'healthy_growth_2',
    name: 'Phase10 Demo Growth Graph',
    channel: 'plg',
    source: 'product_signup',
    medium: 'plg',
    campaign: 'phase10_plg_activation',
    buyingIntent: 'low',
    employees: 32,
    firstTouchDaysAgo: 162,
    lastTouchDaysAgo: 135,
    interactionDaysAgo: 120,
    accountCreatedDaysAgo: 98,
    onboardingCompletedDaysAgo: 95,
    companySize: '11-50',
    spendBracket: BRACKET_BY_REVENUE.medium,
    lastLoginDaysAgo: 2,
    productPattern: 'mature_light',
    providers: ['openai'],
    planId: 'starter',
    planActivatedDaysAgo: 88,
    budget: { amount: 820, threshold: 78, daysAgo: 29, status: 'active' },
    eventExtras: [...eventSeries('dashboard_viewed', [24, 17, 10, 4]), ...eventSeries('recommendation_viewed', [9])],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('watch', 'newly_activated', 'medium', 'watch', 66, 18, 102),
      healthSnapshot('healthy', 'activated', 'low', 'watch', 80, 30, 32),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'nurture', 'product_activated', 70, 'low', 62, 'medium', 130)],
    usageBaseCost: 28,
    roleNotes: ['healthy_mature', 'plg'],
  }),
  makeCompany({
    slug: 'healthy_platform_3',
    name: 'Phase10 Demo Platform Mesh',
    source: 'content',
    medium: 'ebook',
    campaign: 'phase10_inbound_content',
    employees: 128,
    firstTouchDaysAgo: 173,
    lastTouchDaysAgo: 149,
    interactionDaysAgo: 121,
    accountCreatedDaysAgo: 114,
    onboardingCompletedDaysAgo: 109,
    spendBracket: BRACKET_BY_REVENUE.high,
    lastLoginDaysAgo: 3,
    productPattern: 'healthy',
    providers: ['openai', 'aws'],
    planId: 'growth',
    planActivatedDaysAgo: 100,
    budget: { amount: 2100, threshold: 83, daysAgo: 34, status: 'active' },
    recommendations: [{ provider: 'aws', type: 'service_cost_concentration', priority: 'medium', title: 'Review Bedrock workload split', observedValue: 280, daysAgo: 8, status: 'open' }],
    eventExtras: [...eventSeries('dashboard_viewed', [28, 23, 18, 14, 9, 4]), ...eventSeries('forecast_viewed', [21, 11])],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('watch', 'activated', 'medium', 'watch', 69, 22, 118),
      healthSnapshot('healthy', 'activated', 'low', 'watch', 81, 34, 35),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'product_qualified', 80, 'medium', 80, 'high', 151)],
    usageBaseCost: 50,
    roleNotes: ['healthy_mature'],
  }),
  makeCompany({
    slug: 'newly_activated_1',
    name: 'Phase10 Demo Quickstart One',
    source: 'demo_request',
    medium: 'web_form',
    campaign: 'phase10_pricing_intent',
    employees: 44,
    firstTouchDaysAgo: 48,
    lastTouchDaysAgo: 35,
    interactionDaysAgo: 18,
    accountCreatedDaysAgo: 15,
    onboardingCompletedDaysAgo: 9,
    companySize: '11-50',
    spendBracket: BRACKET_BY_REVENUE.medium,
    lastLoginDaysAgo: 1,
    productPattern: 'newly_activated',
    providers: ['openai'],
    planId: 'starter',
    planActivatedDaysAgo: 8,
    budget: { amount: 720, threshold: 80, daysAgo: 7, status: 'active' },
    recommendations: [{ provider: 'openai', type: 'budget_missing', priority: 'low', title: 'Budget now configured', observedValue: 0, daysAgo: 4, status: 'open' }],
    eventExtras: [...eventSeries('dashboard_viewed', [9, 7, 4, 2]), ...eventSeries('forecast_viewed', [3])],
    routeMode: 'none',
    historicalHealth: [healthSnapshot('watch', 'onboarding', 'medium', 'watch', 63, 16, 12)],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'insufficient_product_signals', 75, 'medium', 74, 'high', 22)],
    usageBaseCost: 18,
    roleNotes: ['newly_activated'],
  }),
  makeCompany({
    slug: 'newly_activated_2',
    name: 'Phase10 Demo Quickstart Two',
    source: 'pricing_form',
    medium: 'pricing_intent',
    campaign: 'phase10_pricing_intent',
    employees: 26,
    firstTouchDaysAgo: 42,
    lastTouchDaysAgo: 28,
    interactionDaysAgo: 14,
    accountCreatedDaysAgo: 12,
    onboardingCompletedDaysAgo: 8,
    companySize: '11-50',
    spendBracket: BRACKET_BY_REVENUE.low,
    lastLoginDaysAgo: 1,
    productPattern: 'newly_activated',
    providers: ['openai'],
    planId: 'starter',
    planStatus: 'pending_payment',
    planActivatedDaysAgo: 7,
    budget: { amount: 460, threshold: 76, daysAgo: 6, status: 'active' },
    eventExtras: [...eventSeries('dashboard_viewed', [8, 5, 2])],
    routeMode: 'none',
    historicalHealth: [healthSnapshot('watch', 'onboarding', 'medium', 'watch', 60, 12, 10)],
    historicalQualification: [qualificationSnapshot('qualified', 'awaiting_engagement', 'insufficient_product_signals', 69, 'medium', 66, 'medium', 18)],
    usageBaseCost: 14,
    roleNotes: ['newly_activated'],
  }),
  makeCompany({
    slug: 'creator_launch_1',
    name: 'Phase10 Demo Creator Launch',
    channel: 'creator',
    source: 'creator_review',
    medium: 'creator',
    campaign: 'phase10_creator_review',
    buyingIntent: 'high',
    employees: 38,
    firstTouchDaysAgo: 54,
    lastTouchDaysAgo: 37,
    interactionDaysAgo: 17,
    accountCreatedDaysAgo: 16,
    onboardingCompletedDaysAgo: 9,
    companySize: '11-50',
    spendBracket: BRACKET_BY_REVENUE.medium,
    lastLoginDaysAgo: 1,
    productPattern: 'newly_activated',
    providers: ['openai', 'anthropic'],
    planId: 'starter',
    planActivatedDaysAgo: 8,
    budget: { amount: 880, threshold: 82, daysAgo: 7, status: 'active' },
    recommendations: [{ provider: 'openai', type: 'provider_cost_concentration', priority: 'low', title: 'Monitor creator workload growth', observedValue: 120, daysAgo: 5, status: 'open' }],
    eventExtras: [...eventSeries('dashboard_viewed', [8, 6, 3, 1]), ...eventSeries('recommendation_viewed', [4])],
    routeMode: 'none',
    historicalHealth: [healthSnapshot('watch', 'onboarding', 'medium', 'watch', 62, 20, 11)],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'insufficient_product_signals', 73, 'high', 88, 'urgent', 24)],
    usageBaseCost: 20,
    roleNotes: ['newly_activated', 'creator_account'],
    sourceIds: { creator_id: CREATOR_ID },
  }),
  makeCompany({
    slug: 'at_risk_usage_drop_1',
    name: 'Phase10 Demo Usage Drop',
    source: 'content',
    medium: 'content',
    campaign: 'phase10_inbound_content',
    employees: 74,
    firstTouchDaysAgo: 158,
    lastTouchDaysAgo: 136,
    interactionDaysAgo: 111,
    accountCreatedDaysAgo: 100,
    onboardingCompletedDaysAgo: 96,
    spendBracket: BRACKET_BY_REVENUE.medium,
    lastLoginDaysAgo: 12,
    productPattern: 'at_risk',
    providers: ['openai'],
    planId: 'starter',
    planActivatedDaysAgo: 92,
    budget: { amount: 980, threshold: 80, daysAgo: 33, status: 'active' },
    eventExtras: [...eventSeries('dashboard_viewed', [20, 12]), ...eventSeries('forecast_viewed', [18])],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'watch', 78, 20, 88),
      healthSnapshot('watch', 'activated', 'medium', 'watch', 58, 18, 27),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'product_qualified', 74, 'medium', 72, 'medium', 130)],
    usageBaseCost: 44,
    roleNotes: ['at_risk'],
  }),
  makeCompany({
    slug: 'at_risk_sync_gap_2',
    name: 'Phase10 Demo Sync Gap',
    source: 'website',
    medium: 'web_form',
    campaign: 'phase10_pricing_intent',
    employees: 82,
    firstTouchDaysAgo: 155,
    lastTouchDaysAgo: 134,
    interactionDaysAgo: 112,
    accountCreatedDaysAgo: 102,
    onboardingCompletedDaysAgo: 97,
    spendBracket: BRACKET_BY_REVENUE.medium,
    lastLoginDaysAgo: 14,
    productPattern: 'at_risk',
    providers: ['openai', 'anthropic'],
    planId: 'growth',
    planActivatedDaysAgo: 90,
    budget: { amount: 1320, threshold: 82, daysAgo: 34, status: 'active' },
    currentProviderStatus: { anthropic: { lastSyncedDaysAgo: 16 } },
    eventExtras: [...eventSeries('dashboard_viewed', [19]), ...eventSeries('forecast_viewed', [22])],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'watch', 79, 24, 90),
      healthSnapshot('watch', 'activated', 'high', 'watch', 54, 20, 23),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'product_qualified', 76, 'medium', 76, 'high', 133)],
    usageBaseCost: 46,
    roleNotes: ['at_risk'],
  }),
  makeCompany({
    slug: 'at_risk_budgetless_3',
    name: 'Phase10 Demo Budgetless',
    source: 'content',
    medium: 'ebook',
    campaign: 'phase10_inbound_content',
    employees: 52,
    firstTouchDaysAgo: 149,
    lastTouchDaysAgo: 127,
    interactionDaysAgo: 110,
    accountCreatedDaysAgo: 98,
    onboardingCompletedDaysAgo: 94,
    spendBracket: BRACKET_BY_REVENUE.low,
    lastLoginDaysAgo: 10,
    productPattern: 'at_risk',
    providers: ['openai'],
    planId: 'starter',
    planActivatedDaysAgo: 86,
    budget: null,
    eventExtras: [...eventSeries('dashboard_viewed', [18])],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'watch', 74, 12, 84),
      healthSnapshot('at_risk', 'activated', 'high', 'watch', 47, 10, 19),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'awaiting_engagement', 'product_qualified', 69, 'medium', 62, 'medium', 121)],
    usageBaseCost: 34,
    roleNotes: ['at_risk'],
  }),
  makeCompany({
    slug: 'dormant_workspace_1',
    name: 'Phase10 Demo Dormant Workspace',
    source: 'partner_blog',
    medium: 'content',
    campaign: 'phase10_partner_alliance',
    employees: 64,
    firstTouchDaysAgo: 175,
    lastTouchDaysAgo: 150,
    interactionDaysAgo: 118,
    accountCreatedDaysAgo: 122,
    onboardingCompletedDaysAgo: 118,
    spendBracket: BRACKET_BY_REVENUE.medium,
    lastLoginDaysAgo: 31,
    productPattern: 'dormant',
    providers: ['openai'],
    planId: 'growth',
    planActivatedDaysAgo: 112,
    budget: { amount: 1100, threshold: 80, daysAgo: 42, status: 'active' },
    eventExtras: [...eventSeries('dashboard_viewed', [27])],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'watch', 80, 18, 76),
      healthSnapshot('at_risk', 'activated', 'critical', 'watch', 41, 12, 26),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'product_qualified', 73, 'medium', 74, 'high', 145)],
    usageBaseCost: 30,
    roleNotes: ['dormant'],
  }),
  makeCompany({
    slug: 'dormant_workspace_2',
    name: 'Phase10 Demo Idle Team',
    source: 'website',
    medium: 'demo_request',
    campaign: 'phase10_pricing_intent',
    employees: 46,
    firstTouchDaysAgo: 166,
    lastTouchDaysAgo: 138,
    interactionDaysAgo: 116,
    accountCreatedDaysAgo: 120,
    onboardingCompletedDaysAgo: 114,
    companySize: '11-50',
    spendBracket: BRACKET_BY_REVENUE.low,
    lastLoginDaysAgo: 28,
    productPattern: 'dormant',
    providers: ['openai'],
    planId: 'starter',
    planActivatedDaysAgo: 108,
    budget: { amount: 780, threshold: 78, daysAgo: 46, status: 'active' },
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('watch', 'activated', 'medium', 'watch', 63, 10, 68),
      healthSnapshot('at_risk', 'activated', 'critical', 'watch', 39, 8, 24),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'awaiting_engagement', 'product_qualified', 67, 'medium', 60, 'medium', 136)],
    usageBaseCost: 20,
    roleNotes: ['dormant'],
  }),
  makeCompany({
    slug: 'payment_risk_growth_1',
    name: 'Phase10 Demo Billing Risk One',
    source: 'demo_request',
    medium: 'web_form',
    campaign: 'phase10_pricing_intent',
    employees: 88,
    firstTouchDaysAgo: 132,
    lastTouchDaysAgo: 110,
    interactionDaysAgo: 84,
    accountCreatedDaysAgo: 78,
    onboardingCompletedDaysAgo: 72,
    spendBracket: BRACKET_BY_REVENUE.high,
    lastLoginDaysAgo: 2,
    productPattern: 'payment_risk',
    providers: ['openai', 'anthropic'],
    planId: 'growth',
    planStatus: 'failed_payment',
    planActivatedDaysAgo: 68,
    billingHistory: [
      { suffix: 'renewal_2', paymentStatus: 'success', verificationStatus: 'verified', daysAgo: 55, amount: 1 },
      { suffix: 'renewal_3', paymentStatus: 'failed', verificationStatus: 'verified', daysAgo: 4, amount: 1 },
    ],
    budget: { amount: 1900, threshold: 82, daysAgo: 28, status: 'active' },
    alerts: [{ type: 'budget_threshold_reached', severity: 'medium', observedValue: 81, daysAgo: 3, status: 'open' }],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'watch', 82, 34, 48),
      healthSnapshot('critical', 'activated', 'critical', 'none', 28, 0, 6),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'product_activated', 82, 'high', 89, 'urgent', 96)],
    usageBaseCost: 62,
    roleNotes: ['payment_risk'],
  }),
  makeCompany({
    slug: 'payment_risk_scale_2',
    name: 'Phase10 Demo Billing Risk Two',
    source: 'website',
    medium: 'paid_social',
    campaign: 'phase10_pricing_intent',
    employees: 140,
    firstTouchDaysAgo: 145,
    lastTouchDaysAgo: 122,
    interactionDaysAgo: 89,
    accountCreatedDaysAgo: 84,
    onboardingCompletedDaysAgo: 79,
    spendBracket: BRACKET_BY_REVENUE.high,
    lastLoginDaysAgo: 3,
    productPattern: 'payment_risk',
    providers: ['openai', 'aws'],
    planId: 'growth',
    planStatus: 'failed_payment',
    planActivatedDaysAgo: 70,
    billingHistory: [
      { suffix: 'renewal_2', paymentStatus: 'success', verificationStatus: 'verified', daysAgo: 57, amount: 1 },
      { suffix: 'renewal_3', paymentStatus: 'failed', verificationStatus: 'verified', daysAgo: 6, amount: 1 },
    ],
    budget: { amount: 2300, threshold: 84, daysAgo: 30, status: 'active' },
    alerts: [{ type: 'spend_spike', severity: 'high', observedValue: 135, daysAgo: 5, status: 'open' }],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'watch', 81, 36, 54),
      healthSnapshot('critical', 'activated', 'critical', 'none', 24, 0, 8),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'product_activated', 84, 'high', 92, 'urgent', 101)],
    usageBaseCost: 68,
    roleNotes: ['payment_risk'],
  }),
  makeCompany({
    slug: 'referral_expand_1',
    name: 'Phase10 Demo Referral Expand',
    channel: 'referral',
    source: 'customer_referral',
    medium: 'referral',
    campaign: 'phase10_referral_program',
    icpScore: 89,
    buyingIntent: 'high',
    employees: 165,
    firstTouchDaysAgo: 123,
    lastTouchDaysAgo: 104,
    interactionDaysAgo: 68,
    accountCreatedDaysAgo: 63,
    onboardingCompletedDaysAgo: 59,
    spendBracket: BRACKET_BY_REVENUE.higher,
    lastLoginDaysAgo: 1,
    productPattern: 'budget_pressure',
    providers: ['openai', 'anthropic', 'aws'],
    planId: 'starter',
    planActivatedDaysAgo: 55,
    budget: { amount: 1200, threshold: 80, daysAgo: 24, status: 'active' },
    alerts: [{ type: 'projected_budget_overrun', severity: 'high', observedValue: 142, daysAgo: 2, status: 'open' }],
    recommendations: [{ provider: 'openai', type: 'projected_budget_overrun', priority: 'high', title: 'Upgrade before projected overrun', observedValue: 960, daysAgo: 2, status: 'open' }],
    eventExtras: [...eventSeries('dashboard_viewed', [24, 20, 14, 9, 5, 2]), ...eventSeries('forecast_viewed', [11, 2]), ...eventSeries('upgrade_requested', [4]), ...eventSeries('plan_selected', [54])],
    routeMode: 'sales_followup',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'expansion_candidate', 82, 54, 34),
      healthSnapshot('healthy', 'activated', 'low', 'upgrade_ready', 85, 78, 10),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'product_activated', 88, 'high', 98, 'urgent', 88)],
    usageBaseCost: 74,
    roleNotes: ['expansion_account', 'referral_sourced', 'sales_followup'],
    sourceIds: { referral_id: REFERRAL_ID },
  }),
  makeCompany({
    slug: 'expansion_candidate_2',
    name: 'Phase10 Demo Expansion Loop',
    source: 'website',
    medium: 'web_form',
    campaign: 'phase10_pricing_intent',
    employees: 98,
    firstTouchDaysAgo: 138,
    lastTouchDaysAgo: 115,
    interactionDaysAgo: 80,
    accountCreatedDaysAgo: 76,
    onboardingCompletedDaysAgo: 71,
    spendBracket: BRACKET_BY_REVENUE.high,
    lastLoginDaysAgo: 2,
    productPattern: 'expansion',
    providers: ['openai', 'anthropic'],
    planId: 'starter',
    planActivatedDaysAgo: 67,
    budget: { amount: 1680, threshold: 84, daysAgo: 26, status: 'active' },
    recommendations: [{ provider: 'openai', type: 'provider_cost_concentration', priority: 'medium', title: 'Review expansion concentration', observedValue: 520, daysAgo: 3, status: 'open' }],
    eventExtras: [...eventSeries('dashboard_viewed', [22, 19, 15, 11, 7, 3]), ...eventSeries('forecast_viewed', [18, 6])],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'watch', 78, 28, 56),
      healthSnapshot('healthy', 'activated', 'low', 'expansion_candidate', 84, 60, 16),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'product_activated', 81, 'medium', 82, 'high', 95)],
    usageBaseCost: 60,
    roleNotes: ['expansion_candidate'],
  }),
  makeCompany({
    slug: 'expansion_candidate_3',
    name: 'Phase10 Demo Multi Provider',
    channel: 'plg',
    source: 'product_signup',
    medium: 'plg',
    campaign: 'phase10_plg_activation',
    buyingIntent: 'medium',
    employees: 57,
    firstTouchDaysAgo: 131,
    lastTouchDaysAgo: 108,
    interactionDaysAgo: 79,
    accountCreatedDaysAgo: 73,
    onboardingCompletedDaysAgo: 68,
    spendBracket: BRACKET_BY_REVENUE.high,
    lastLoginDaysAgo: 1,
    productPattern: 'expansion',
    providers: ['openai', 'aws'],
    planId: 'starter',
    planActivatedDaysAgo: 66,
    budget: { amount: 1560, threshold: 84, daysAgo: 22, status: 'active' },
    eventExtras: [...eventSeries('dashboard_viewed', [23, 18, 12, 6, 2]), ...eventSeries('forecast_viewed', [9])],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'watch', 75, 24, 52),
      healthSnapshot('healthy', 'activated', 'low', 'expansion_candidate', 82, 56, 14),
    ],
    historicalQualification: [qualificationSnapshot('qualified', 'awaiting_engagement', 'product_activated', 78, 'medium', 74, 'medium', 82)],
    usageBaseCost: 48,
    roleNotes: ['expansion_candidate', 'plg'],
  }),
  makeCompany({
    slug: 'budget_pressure_1',
    name: 'Phase10 Demo Budget Pressure',
    source: 'pricing_page',
    medium: 'pricing_intent',
    campaign: 'phase10_pricing_intent',
    icpScore: 87,
    buyingIntent: 'medium',
    employees: 148,
    firstTouchDaysAgo: 116,
    lastTouchDaysAgo: 98,
    interactionDaysAgo: 63,
    accountCreatedDaysAgo: 60,
    onboardingCompletedDaysAgo: 55,
    spendBracket: BRACKET_BY_REVENUE.higher,
    lastLoginDaysAgo: 1,
    productPattern: 'budget_pressure',
    providers: ['openai', 'anthropic', 'aws'],
    planId: 'starter',
    planActivatedDaysAgo: 50,
    budget: { amount: 880, threshold: 80, daysAgo: 18, status: 'active' },
    alerts: [{ type: 'projected_budget_overrun', severity: 'high', observedValue: 154, daysAgo: 1, status: 'open' }],
    recommendations: [{ provider: 'openai', type: 'projected_budget_overrun', priority: 'high', title: 'Starter plan is under pressure', observedValue: 830, daysAgo: 1, status: 'open' }],
    eventExtras: [...eventSeries('dashboard_viewed', [20, 16, 13, 9, 6, 4, 2]), ...eventSeries('forecast_viewed', [7, 2]), ...eventSeries('plan_selected', [48])],
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('healthy', 'activated', 'low', 'watch', 80, 30, 28),
      healthSnapshot('watch', 'activated', 'medium', 'upgrade_ready', 65, 73, 6),
    ],
    historicalQualification: [qualificationSnapshot('nurture', 'nurture', 'product_activated', 66, 'medium', 55, 'medium', 64)],
    usageBaseCost: 78,
    roleNotes: ['budget_pressure', 'upgrade_ready'],
  }),
  makeCompany({
    slug: 'cancelled_historical_1',
    name: 'Phase10 Demo Historical Churn',
    source: 'website',
    medium: 'web_form',
    campaign: 'phase10_inbound_content',
    leadStatus: 'nurture',
    buyingIntent: 'low',
    employees: 88,
    firstTouchDaysAgo: 174,
    lastTouchDaysAgo: 149,
    interactionDaysAgo: 119,
    accountCreatedDaysAgo: 136,
    onboardingCompletedDaysAgo: 130,
    spendBracket: BRACKET_BY_REVENUE.medium,
    lastLoginDaysAgo: 44,
    productPattern: 'cancelled',
    providers: ['openai'],
    planId: 'starter',
    planStatus: 'inactive',
    planActivatedDaysAgo: 120,
    planExpiresDaysAgo: 20,
    cancellationRequestedDaysAgo: 26,
    cancelledDaysAgo: 20,
    cancellationReason: 'synthetic_demo_churn',
    billingHistory: [
      { suffix: 'initial', paymentStatus: 'success', verificationStatus: 'verified', daysAgo: 102, amount: 1 },
    ],
    budget: null,
    routeMode: 'none',
    historicalHealth: [
      healthSnapshot('watch', 'activated', 'medium', 'watch', 58, 8, 52),
      healthSnapshot('critical', 'churned', 'critical', 'none', 18, 0, 18, { authoritative_churned: true }),
    ],
    historicalQualification: [qualificationSnapshot('nurture', 'nurture', 'insufficient_product_signals', 54, 'low', 34, 'low', 158)],
    usageBaseCost: 24,
    roleNotes: ['cancelled_historical'],
  }),
  makeCompany({
    slug: 'outbound_sql_1',
    name: 'Phase10 Demo Outbound SQL One',
    leadSourceType: 'outbound_scraped',
    channel: 'outbound',
    source: 'scraper',
    medium: 'signal_outbound',
    campaign: 'phase10_outbound_aiops',
    icpScore: 81,
    buyingIntent: 'high',
    leadStatus: 'ready_to_push',
    employees: 74,
    firstTouchDaysAgo: 31,
    lastTouchDaysAgo: 20,
    interactionDaysAgo: 9,
    hasAccount: false,
    routeMode: 'sdr',
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'insufficient_product_signals', 79, 'high', 94, 'urgent', 18)],
    roleNotes: ['outbound_opportunity', 'hot_sql', 'sdr_owned'],
  }),
  makeCompany({
    slug: 'hot_sql_2',
    name: 'Phase10 Demo Inbound Hot SQL',
    source: 'demo_request',
    medium: 'web_form',
    campaign: 'phase10_pricing_intent',
    icpScore: 90,
    buyingIntent: 'high',
    leadStatus: 'qualified',
    employees: 320,
    firstTouchDaysAgo: 26,
    lastTouchDaysAgo: 17,
    interactionDaysAgo: 8,
    hasAccount: false,
    routeMode: 'manual_override',
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'insufficient_product_signals', 88, 'high', 99, 'urgent', 15)],
    roleNotes: ['hot_sql', 'manual_override'],
  }),
  makeCompany({
    slug: 'creator_opportunity_1',
    name: 'Phase10 Demo Creator Opportunity',
    channel: 'creator',
    source: 'creator_review',
    medium: 'creator',
    campaign: 'phase10_creator_review',
    icpScore: 78,
    buyingIntent: 'high',
    leadStatus: 'qualified',
    employees: 68,
    firstTouchDaysAgo: 36,
    lastTouchDaysAgo: 21,
    interactionDaysAgo: 7,
    hasAccount: false,
    routeMode: 'sdr',
    historicalQualification: [qualificationSnapshot('qualified', 'awaiting_engagement', 'insufficient_product_signals', 74, 'high', 86, 'high', 19)],
    roleNotes: ['creator_opportunity'],
    sourceIds: { creator_id: CREATOR_ID },
  }),
  makeCompany({
    slug: 'routing_retry_1',
    name: 'Phase10 Demo Routing Retry',
    source: 'partner_portal',
    medium: 'partner',
    campaign: 'phase10_partner_alliance',
    icpScore: 83,
    buyingIntent: 'medium',
    leadStatus: 'qualified',
    employees: 84,
    firstTouchDaysAgo: 40,
    lastTouchDaysAgo: 25,
    interactionDaysAgo: 9,
    hasAccount: false,
    routeMode: 'retry_required',
    historicalQualification: [qualificationSnapshot('qualified', 'sales_ready', 'insufficient_product_signals', 80, 'medium', 82, 'high', 21)],
    roleNotes: ['retry_required'],
    sourceIds: { partner_id: PARTNER_ID },
  }),
  makeCompany({
    slug: 'inbound_nurture_1',
    name: 'Phase10 Demo Nurture Queue',
    source: 'content',
    medium: 'ebook',
    campaign: 'phase10_inbound_content',
    icpScore: 56,
    buyingIntent: 'low',
    leadStatus: 'nurture',
    employees: 18,
    firstTouchDaysAgo: 22,
    lastTouchDaysAgo: 11,
    interactionDaysAgo: 5,
    hasAccount: false,
    routeMode: 'none',
    historicalQualification: [qualificationSnapshot('nurture', 'nurture', 'insufficient_product_signals', 52, 'low', 28, 'low', 9)],
    roleNotes: ['nurture_only'],
  }),
]

function eventSeries(name, days) {
  return days.map((daysAgo, index) => ({ event_name: name, daysAgo, hour: 9 + (index % 8), key: `${name}_${daysAgo}` }))
}

function healthSnapshot(healthState, lifecycleState, churnRisk, expansionState, healthScore, expansionScore, daysAgo, overrides = {}) {
  return {
    healthState,
    lifecycleState,
    churnRisk,
    expansionState,
    healthScore,
    expansionScore,
    daysAgo,
    ...overrides,
  }
}

function qualificationSnapshot(mqlStatus, sqlStatus, pqlStatus, fitScore, buyingIntent, priorityScore, priorityTier, daysAgo) {
  return {
    mqlStatus,
    sqlStatus,
    pqlStatus,
    fitScore,
    buyingIntent,
    priorityScore,
    priorityTier,
    daysAgo,
  }
}

function requireEnv() {
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }
}

async function rest(path, init = {}) {
  requireEnv()
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`REST ${path} failed: ${response.status} ${body}`)
  }

  if (response.status === 204) return null
  return response.json()
}

async function rpc(name, payload) {
  return rest(`rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  })
}

async function fetchRows(path) {
  return rest(path, { method: 'GET' })
}

async function fetchSingle(path) {
  const rows = await fetchRows(path)
  return rows[0] ?? null
}

async function insertRow(table, payload) {
  const rows = await rest(`${table}?select=*`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
  return Array.isArray(rows) ? rows[0] : rows
}

async function patchRows(path, payload) {
  const rows = await rest(path, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
  return Array.isArray(rows) ? rows : []
}

async function deleteRows(path) {
  return rest(path, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })
}

async function ensureRecord({ queryPath, table, payload, patchPayload = payload }) {
  const existing = await fetchSingle(queryPath)
  if (existing) {
    if (patchPayload) {
      await patchRows(queryPath.replace('&limit=1', '').replace('?limit=1', '?'), patchPayload)
    }
    return existing
  }
  return insertRow(table, payload)
}

async function ensurePhase10Entities() {
  await ensureRecord({
    queryPath: `acquisition_partners?partner_id=eq.${PARTNER_ID}&limit=1&select=*`,
    table: 'acquisition_partners',
    payload: {
      partner_id: PARTNER_ID,
      name: 'Phase10 Partner Alliance',
      partner_type: 'agency',
      status: 'active',
      source_identifier: PARTNER_ID,
      default_campaign: 'phase10_partner_alliance',
      metadata: baseMetadata({ entity: 'partner' }),
      created_at: isoFromOffset(180),
      updated_at: isoFromOffset(10),
    },
    patchPayload: {
      name: 'Phase10 Partner Alliance',
      partner_type: 'agency',
      status: 'active',
      source_identifier: PARTNER_ID,
      default_campaign: 'phase10_partner_alliance',
      metadata: baseMetadata({ entity: 'partner' }),
      created_at: isoFromOffset(180),
      updated_at: isoFromOffset(10),
    },
  })

  await ensureRecord({
    queryPath: `acquisition_creators?creator_id=eq.${CREATOR_ID}&limit=1&select=*`,
    table: 'acquisition_creators',
    payload: {
      creator_id: CREATOR_ID,
      name: 'Phase10 Creator Review',
      platform: 'linkedin',
      status: 'active',
      source_identifier: CREATOR_ID,
      default_campaign: 'phase10_creator_review',
      metadata: baseMetadata({ entity: 'creator' }),
      created_at: isoFromOffset(160),
      updated_at: isoFromOffset(12),
    },
    patchPayload: {
      name: 'Phase10 Creator Review',
      platform: 'linkedin',
      status: 'active',
      source_identifier: CREATOR_ID,
      default_campaign: 'phase10_creator_review',
      metadata: baseMetadata({ entity: 'creator' }),
      created_at: isoFromOffset(160),
      updated_at: isoFromOffset(12),
    },
  })

  await ensureRecord({
    queryPath: `acquisition_referrals?referral_id=eq.${REFERRAL_ID}&limit=1&select=*`,
    table: 'acquisition_referrals',
    payload: {
      referral_id: REFERRAL_ID,
      referral_code: 'PHASE10REF',
      referring_profile_id: null,
      referring_account_id: null,
      referring_partner_id: PARTNER_ID,
      status: 'active',
      metadata: baseMetadata({ entity: 'referral' }),
      created_at: isoFromOffset(120),
      updated_at: isoFromOffset(15),
    },
    patchPayload: {
      referral_code: 'PHASE10REF',
      referring_profile_id: null,
      referring_account_id: null,
      referring_partner_id: PARTNER_ID,
      status: 'active',
      metadata: baseMetadata({ entity: 'referral' }),
      created_at: isoFromOffset(120),
      updated_at: isoFromOffset(15),
    },
  })
}

function profileEmail(slug) {
  return `${PREFIX}.${slug}@example.com`
}

function accountSlug(slug) {
  return `${PREFIX}_${slug}`
}

function leadEventId(slug) {
  return `${PREFIX}_${slug}_lead`
}

async function ensureProfile(scenario) {
  const createdAt = isoFromOffset(scenario.accountCreatedDaysAgo + 1, 10)
  const lastLoginAt = isoFromOffset(scenario.lastLoginDaysAgo, 13)
  const profile = await ensureRecord({
    queryPath: `profiles?firebase_uid=eq.${accountSlug(scenario.slug)}_uid&limit=1&select=*`,
    table: 'profiles',
    payload: {
      firebase_uid: `${accountSlug(scenario.slug)}_uid`,
      email: profileEmail(scenario.slug),
      display_name: scenario.name,
      auth_provider: 'password',
      last_login_at: lastLoginAt,
      created_at: createdAt,
      updated_at: lastLoginAt,
    },
    patchPayload: {
      email: profileEmail(scenario.slug),
      display_name: scenario.name,
      auth_provider: 'password',
      last_login_at: lastLoginAt,
      created_at: createdAt,
      updated_at: lastLoginAt,
    },
  })

  await patchRows(`profiles?firebase_uid=eq.${accountSlug(scenario.slug)}_uid&select=*`, {
    email: profileEmail(scenario.slug),
    display_name: scenario.name,
    auth_provider: 'password',
    last_login_at: lastLoginAt,
    created_at: createdAt,
    updated_at: lastLoginAt,
  })

  return (await fetchSingle(`profiles?firebase_uid=eq.${accountSlug(scenario.slug)}_uid&limit=1&select=*`)) ?? profile
}

async function ensureAccount(scenario) {
  const createdAt = isoFromOffset(scenario.accountCreatedDaysAgo, 11)
  const updatedAt = isoFromOffset(Math.min(scenario.lastLoginDaysAgo, 1), 12)
  const account = await ensureRecord({
    queryPath: `accounts?slug=eq.${accountSlug(scenario.slug)}&limit=1&select=*`,
    table: 'accounts',
    payload: {
      name: scenario.name,
      slug: accountSlug(scenario.slug),
      primary_domain: `${scenario.slug}.example.com`,
      onboarding_status: 'completed',
      created_at: createdAt,
      updated_at: updatedAt,
    },
    patchPayload: {
      name: scenario.name,
      primary_domain: `${scenario.slug}.example.com`,
      onboarding_status: 'completed',
      created_at: createdAt,
      updated_at: updatedAt,
    },
  })

  await patchRows(`accounts?slug=eq.${accountSlug(scenario.slug)}&select=*`, {
    name: scenario.name,
    primary_domain: `${scenario.slug}.example.com`,
    onboarding_status: 'completed',
    created_at: createdAt,
    updated_at: updatedAt,
  })

  return (await fetchSingle(`accounts?slug=eq.${accountSlug(scenario.slug)}&limit=1&select=*`)) ?? account
}

async function ensureMembership(accountId, profileId, createdAt) {
  const membership = await ensureRecord({
    queryPath: `account_members?account_id=eq.${accountId}&profile_id=eq.${profileId}&limit=1&select=*`,
    table: 'account_members',
    payload: {
      account_id: accountId,
      profile_id: profileId,
      role: 'owner',
      is_owner: true,
      created_at: createdAt,
    },
    patchPayload: {
      role: 'owner',
      is_owner: true,
      created_at: createdAt,
    },
  })

  await patchRows(`account_members?account_id=eq.${accountId}&profile_id=eq.${profileId}&select=*`, {
    role: 'owner',
    is_owner: true,
    created_at: createdAt,
  })

  return (await fetchSingle(`account_members?account_id=eq.${accountId}&profile_id=eq.${profileId}&limit=1&select=*`)) ?? membership
}

async function ensureOnboarding(accountId, profileId, scenario) {
  const completedAt = isoFromOffset(scenario.onboardingCompletedDaysAgo, 14)
  const createdAt = isoFromOffset(scenario.onboardingCompletedDaysAgo + 3, 10)
  const onboarding = await ensureRecord({
    queryPath: `onboarding_responses?account_id=eq.${accountId}&profile_id=eq.${profileId}&limit=1&select=*`,
    table: 'onboarding_responses',
    payload: {
      account_id: accountId,
      profile_id: profileId,
      company_size: scenario.companySize,
      providers: scenario.providers.map((provider) => PROVIDER_DISPLAY[provider]),
      estimated_monthly_spend: scenario.spendBracket,
      raw_answers: baseMetadata({
        company_size: scenario.companySize,
        providers: scenario.providers.map((provider) => PROVIDER_DISPLAY[provider]),
        estimated_monthly_spend: scenario.spendBracket,
      }),
      completed_at: completedAt,
      created_at: createdAt,
      updated_at: completedAt,
    },
    patchPayload: {
      company_size: scenario.companySize,
      providers: scenario.providers.map((provider) => PROVIDER_DISPLAY[provider]),
      estimated_monthly_spend: scenario.spendBracket,
      raw_answers: baseMetadata({
        company_size: scenario.companySize,
        providers: scenario.providers.map((provider) => PROVIDER_DISPLAY[provider]),
        estimated_monthly_spend: scenario.spendBracket,
      }),
      completed_at: completedAt,
      created_at: createdAt,
      updated_at: completedAt,
    },
  })

  await patchRows(`onboarding_responses?account_id=eq.${accountId}&profile_id=eq.${profileId}&select=*`, {
    company_size: scenario.companySize,
    providers: scenario.providers.map((provider) => PROVIDER_DISPLAY[provider]),
    estimated_monthly_spend: scenario.spendBracket,
    raw_answers: baseMetadata({
      company_size: scenario.companySize,
      providers: scenario.providers.map((provider) => PROVIDER_DISPLAY[provider]),
      estimated_monthly_spend: scenario.spendBracket,
    }),
    completed_at: completedAt,
    created_at: createdAt,
    updated_at: completedAt,
  })

  return (
    (await fetchSingle(`onboarding_responses?account_id=eq.${accountId}&profile_id=eq.${profileId}&limit=1&select=*`)) ??
    onboarding
  )
}

async function ensureLead(scenario) {
  const createdAt = isoFromOffset(scenario.firstTouchDaysAgo - 1, 9)
  const rawPayload = {
    source: scenario.source,
    medium: scenario.medium,
    campaign: scenario.campaign,
    form: scenario.form,
    ...scenario.sourceIds,
  }
  const existing = await fetchSingle(`staged_leads?event_id=eq.${leadEventId(scenario.slug)}&limit=1&select=*`)
  let lead = existing
  if (!lead) {
    const created = await rpc('get_or_create_lead', {
      p_event_id: leadEventId(scenario.slug),
      p_email: profileEmail(scenario.slug),
      p_company_name: scenario.name,
      p_raw_payload: baseMetadata(rawPayload),
      p_firmographics: { industry: scenario.industry, employees: scenario.employees, country_code: scenario.country },
      p_source_type: scenario.leadSourceType,
      p_ip: null,
    })
    const leadId = created[0]?.lead_id
    lead = await fetchSingle(`staged_leads?id=eq.${leadId}&limit=1&select=*`)
  }

  await patchRows(`staged_leads?event_id=eq.${leadEventId(scenario.slug)}&select=*`, {
    company_name: scenario.name,
    raw_payload: baseMetadata(rawPayload),
    firmographics: { industry: scenario.industry, employees: scenario.employees, country_code: scenario.country },
    icp_score: scenario.icpScore,
    buying_intent: scenario.buyingIntent,
    status: scenario.leadStatus,
    source_type: scenario.leadSourceType,
    created_at: createdAt,
    updated_at: isoFromOffset(Math.max(scenario.interactionDaysAgo - 1, 1), 10),
  })

  return (await fetchSingle(`staged_leads?event_id=eq.${leadEventId(scenario.slug)}&limit=1&select=*`)) ?? lead
}

async function ensureTouch(leadId, scenario, touchType, daysAgo, suffix) {
  const sourceId = `${PREFIX}_${scenario.slug}_${suffix}`
  const occurredAt = isoFromOffset(daysAgo, 10 + (daysAgo % 8), daysAgo % 30)
  const queryPath =
    touchType === 'interaction'
      ? `acquisition_touches?source_id=eq.${sourceId}&touch_type=eq.${touchType}&limit=1&select=*`
      : `acquisition_touches?lead_id=eq.${leadId}&touch_type=eq.${touchType}&limit=1&select=*`
  const payload = {
    lead_id: leadId,
    channel: scenario.channel,
    source: scenario.source,
    source_id: sourceId,
    medium: scenario.medium,
    campaign: scenario.campaign,
    referrer: `https://demo.costpilot.app/${scenario.slug}`,
    utm_source: scenario.source,
    utm_medium: scenario.medium,
    utm_campaign: scenario.campaign,
    utm_content: suffix,
    utm_term: null,
    partner_id: scenario.sourceIds.partner_id ?? null,
    creator_id: scenario.sourceIds.creator_id ?? null,
    referral_id: scenario.sourceIds.referral_id ?? null,
    touch_type: touchType,
    occurred_at: occurredAt,
    metadata: baseMetadata({ touch_label: suffix }),
  }
  const touch = await ensureRecord({
    queryPath,
    table: 'acquisition_touches',
    payload,
    patchPayload: payload,
  })

  await patchRows(queryPath.replace('&limit=1', ''), payload)
  return (await fetchSingle(queryPath)) ?? touch
}

async function syncLeadTouchTimeline(leadId, scenario) {
  await patchRows(`acquisition_touches?lead_id=eq.${leadId}&touch_type=eq.first_touch&select=*`, {
    channel: scenario.channel,
    source: scenario.source,
    source_id: `${PREFIX}_${scenario.slug}_first_touch`,
    medium: scenario.medium,
    campaign: scenario.campaign,
    referrer: `https://demo.costpilot.app/${scenario.slug}`,
    utm_source: scenario.source,
    utm_medium: scenario.medium,
    utm_campaign: scenario.campaign,
    utm_content: 'first_touch',
    utm_term: null,
    partner_id: scenario.sourceIds.partner_id ?? null,
    creator_id: scenario.sourceIds.creator_id ?? null,
    referral_id: scenario.sourceIds.referral_id ?? null,
    occurred_at: isoFromOffset(scenario.firstTouchDaysAgo, 10 + (scenario.firstTouchDaysAgo % 8), scenario.firstTouchDaysAgo % 30),
    metadata: baseMetadata({ touch_label: 'first_touch' }),
  })

  await patchRows(`acquisition_touches?lead_id=eq.${leadId}&touch_type=eq.last_touch&select=*`, {
    channel: scenario.channel,
    source: scenario.source,
    source_id: `${PREFIX}_${scenario.slug}_last_touch`,
    medium: scenario.medium,
    campaign: scenario.campaign,
    referrer: `https://demo.costpilot.app/${scenario.slug}`,
    utm_source: scenario.source,
    utm_medium: scenario.medium,
    utm_campaign: scenario.campaign,
    utm_content: 'last_touch',
    utm_term: null,
    partner_id: scenario.sourceIds.partner_id ?? null,
    creator_id: scenario.sourceIds.creator_id ?? null,
    referral_id: scenario.sourceIds.referral_id ?? null,
    occurred_at: isoFromOffset(scenario.lastTouchDaysAgo, 10 + (scenario.lastTouchDaysAgo % 8), scenario.lastTouchDaysAgo % 30),
    metadata: baseMetadata({ touch_label: 'last_touch' }),
  })

  await ensureTouch(leadId, scenario, 'interaction', scenario.interactionDaysAgo, 'interaction_1')
}

async function ensureLeadEvent(leadId, eventType, daysAgo, suffix, eventData = {}) {
  const createdAt = isoFromOffset(daysAgo, 11 + (daysAgo % 7))
  return ensureRecord({
    queryPath: `lead_events?lead_id=eq.${leadId}&event_type=eq.${eqValue(eventType)}&created_at=eq.${eqValue(createdAt)}&limit=1&select=*`,
    table: 'lead_events',
    payload: {
      lead_id: leadId,
      event_type: eventType,
      event_data: baseMetadata({ key: suffix, ...eventData }),
      created_at: createdAt,
    },
    patchPayload: {
      event_data: baseMetadata({ key: suffix, ...eventData }),
    },
  })
}

async function ensureProductEvent(accountId, profileId, firebaseUid, eventName, daysAgo, key, extraProperties = {}) {
  const createdAt = isoFromOffset(daysAgo, 9 + (daysAgo % 8), daysAgo % 23)
  return ensureRecord({
    queryPath: `product_events?account_id=eq.${accountId}&event_name=eq.${eventName}&created_at=eq.${eqValue(createdAt)}&limit=1&select=*`,
    table: 'product_events',
    payload: {
      account_id: accountId,
      profile_id: profileId,
      firebase_uid: firebaseUid,
      event_name: eventName,
      event_source: 'system',
      event_properties: baseMetadata({ key, ...extraProperties }),
      created_at: createdAt,
    },
    patchPayload: {
      profile_id: profileId,
      firebase_uid: firebaseUid,
      event_source: 'system',
      event_properties: baseMetadata({ key, ...extraProperties }),
    },
  })
}

async function ensureProviderConnection(accountId, provider, connectedDaysAgo, lastSyncedDaysAgo, status = 'connected') {
  const connectedAt = isoFromOffset(connectedDaysAgo, 12)
  const lastSyncedAt = lastSyncedDaysAgo == null ? null : isoFromOffset(lastSyncedDaysAgo, 13)
  return ensureRecord({
    queryPath: `provider_connections?account_id=eq.${accountId}&provider=eq.${provider}&connection_mode=eq.demo_fixture&limit=1&select=*`,
    table: 'provider_connections',
    payload: {
      account_id: accountId,
      provider,
      connection_mode: 'demo_fixture',
      connection_status: status,
      metadata: baseMetadata({ adapter: 'demo_fixture_v1', provider }),
      connected_at: connectedAt,
      last_synced_at: lastSyncedAt,
      created_at: connectedAt,
      updated_at: lastSyncedAt ?? connectedAt,
    },
    patchPayload: {
      connection_status: status,
      metadata: baseMetadata({ adapter: 'demo_fixture_v1', provider }),
      connected_at: connectedAt,
      last_synced_at: lastSyncedAt,
      created_at: connectedAt,
      updated_at: lastSyncedAt ?? connectedAt,
    },
  })
}

function buildUsageRecords(scenario) {
  const schedule = USAGE_SCHEDULES[scenario.productPattern]
  const records = []
  const providers = scenario.providers
  providers.forEach((provider, providerIndex) => {
    const templates = PROVIDER_TEMPLATES[provider]
    const connectedDaysAgo = scenario.onboardingCompletedDaysAgo - 1 + providerIndex
    const lastSyncedDaysAgo = scenario.currentProviderStatus[provider]?.lastSyncedDaysAgo ?? Math.max(1, scenario.lastLoginDaysAgo)
    const connectionStatus = scenario.currentProviderStatus[provider]?.status ?? 'connected'

    schedule.priorDays.forEach((daysAgo, index) => {
      const template = templates[index % templates.length]
      const amount = round2(scenario.usageBaseCost * (1 + providerIndex * 0.28) * (1 + (index % 3) * 0.06))
      records.push({
        provider,
        connectedDaysAgo,
        lastSyncedDaysAgo,
        connectionStatus,
        daysAgo,
        amount,
        service_name: template.service_name,
        model_name: template.model_name,
        usage_quantity: template.quantity,
        unit_price: template.unit_price,
      })
    })

    schedule.currentDays.forEach((daysAgo, index) => {
      const template = templates[index % templates.length]
      const amount = round2(
        scenario.usageBaseCost
          * schedule.currentMultiplier
          * (1 + providerIndex * 0.24)
          * (1 + (index % 4) * 0.08),
      )
      records.push({
        provider,
        connectedDaysAgo,
        lastSyncedDaysAgo,
        connectionStatus,
        daysAgo,
        amount,
        service_name: template.service_name,
        model_name: template.model_name,
        usage_quantity: Math.round(template.quantity * (1 + (index % 3) * 0.05)),
        unit_price: template.unit_price,
      })
    })
  })
  return records.sort((a, b) => b.daysAgo - a.daysAgo)
}

function round2(value) {
  return Math.round(value * 100) / 100
}

async function ensureUsageRecord(accountId, providerConnectionId, slug, index, record) {
  const usageAt = isoFromOffset(record.daysAgo, 14 - (index % 5))
  return ensureRecord({
    queryPath: `usage_records?provider_connection_id=eq.${providerConnectionId}&source_type=eq.demo_fixture&source_record_id=eq.${PREFIX}_${slug}_${index}&limit=1&select=*`,
    table: 'usage_records',
    payload: {
      account_id: accountId,
      provider_connection_id: providerConnectionId,
      provider: record.provider,
      service_name: record.service_name,
      model_name: record.model_name,
      usage_quantity: record.usage_quantity,
      usage_unit: 'tokens',
      unit_price: record.unit_price,
      calculated_cost: record.amount,
      usage_at: usageAt,
      period_start: `${currentMonthStart()}T00:00:00.000Z`,
      period_end: null,
      source_type: 'demo_fixture',
      source_record_id: `${PREFIX}_${slug}_${index}`,
      metadata: baseMetadata({ provider: record.provider }),
      created_at: usageAt,
    },
    patchPayload: {
      provider: record.provider,
      service_name: record.service_name,
      model_name: record.model_name,
      usage_quantity: record.usage_quantity,
      usage_unit: 'tokens',
      unit_price: record.unit_price,
      calculated_cost: record.amount,
      usage_at: usageAt,
      period_start: `${currentMonthStart()}T00:00:00.000Z`,
      period_end: null,
      metadata: baseMetadata({ provider: record.provider }),
      created_at: usageAt,
    },
  })
}

async function ensureBudget(accountId, profileId, scenario) {
  if (!scenario.budget) return null
  const createdAt = isoFromOffset(scenario.budget.daysAgo, 11)
  return ensureRecord({
    queryPath: `budgets?account_id=eq.${accountId}&budget_scope=eq.account&period_month=eq.${currentMonthStart()}&limit=1&select=*`,
    table: 'budgets',
    payload: {
      account_id: accountId,
      provider_connection_id: null,
      provider: null,
      budget_scope: 'account',
      period_month: currentMonthStart(),
      amount: scenario.budget.amount,
      currency: 'USD',
      threshold_percentage: scenario.budget.threshold,
      alerting_enabled: true,
      status: scenario.budget.status,
      created_by_profile_id: profileId,
      created_at: createdAt,
      updated_at: createdAt,
    },
    patchPayload: {
      amount: scenario.budget.amount,
      currency: 'USD',
      threshold_percentage: scenario.budget.threshold,
      alerting_enabled: true,
      status: scenario.budget.status,
      created_by_profile_id: profileId,
      created_at: createdAt,
      updated_at: createdAt,
    },
  })
}

async function ensureAlert(accountId, alert, profileBudgetId = null) {
  const triggeredAt = isoFromOffset(alert.daysAgo, 15)
  return ensureRecord({
    queryPath: `product_alerts?account_id=eq.${accountId}&alert_type=eq.${alert.type}&observed_period=eq.${currentMonthStart()}&status=eq.${alert.status}&limit=1&select=*`,
    table: 'product_alerts',
    payload: {
      account_id: accountId,
      provider_connection_id: null,
      budget_id: profileBudgetId,
      provider: null,
      alert_type: alert.type,
      severity: alert.severity,
      status: alert.status,
      threshold_value: 80,
      observed_value: alert.observedValue,
      observed_period: currentMonthStart(),
      metadata: baseMetadata({ alert_type: alert.type }),
      triggered_at: triggeredAt,
      resolved_at: alert.status === 'resolved' ? isoFromOffset(Math.max(alert.daysAgo - 1, 0), 16) : null,
    },
    patchPayload: {
      severity: alert.severity,
      status: alert.status,
      threshold_value: 80,
      observed_value: alert.observedValue,
      observed_period: currentMonthStart(),
      metadata: baseMetadata({ alert_type: alert.type }),
      triggered_at: triggeredAt,
      resolved_at: alert.status === 'resolved' ? isoFromOffset(Math.max(alert.daysAgo - 1, 0), 16) : null,
    },
  })
}

async function ensureRecommendation(accountId, recommendation) {
  const generatedAt = isoFromOffset(recommendation.daysAgo, 16)
  return ensureRecord({
    queryPath: `cost_recommendations?account_id=eq.${accountId}&recommendation_type=eq.${recommendation.type}&provider=eq.${recommendation.provider}&status=eq.${recommendation.status}&limit=1&select=*`,
    table: 'cost_recommendations',
    payload: {
      account_id: accountId,
      provider_connection_id: null,
      provider: recommendation.provider,
      service_name: null,
      model_name: null,
      recommendation_type: recommendation.type,
      priority: recommendation.priority,
      status: recommendation.status,
      title: recommendation.title,
      summary: 'Synthetic Phase 10 optimization recommendation.',
      observed_value: recommendation.observedValue,
      metadata: baseMetadata({ recommendation_type: recommendation.type }),
      generated_at: generatedAt,
      updated_at: generatedAt,
    },
    patchPayload: {
      priority: recommendation.priority,
      status: recommendation.status,
      title: recommendation.title,
      summary: 'Synthetic Phase 10 optimization recommendation.',
      observed_value: recommendation.observedValue,
      metadata: baseMetadata({ recommendation_type: recommendation.type }),
      generated_at: generatedAt,
      updated_at: generatedAt,
    },
  })
}

async function ensureBillingTransaction(accountId, profileId, scenario, entry) {
  const createdAt = isoFromOffset(entry.daysAgo, 17)
  const providerTxnId = `${PREFIX}_${scenario.slug}_${entry.suffix}`
  return ensureRecord({
    queryPath: `billing_transactions?billing_provider=eq.payu&provider_txn_id=eq.${providerTxnId}&limit=1&select=*`,
    table: 'billing_transactions',
    payload: {
      account_id: accountId,
      profile_id: profileId,
      billing_provider: 'payu',
      plan_id: scenario.planId,
      billing_interval: 'monthly',
      amount: entry.amount,
      currency: 'INR',
      provider_txn_id: providerTxnId,
      provider_payment_id: `${providerTxnId}_mih`,
      payment_status: entry.paymentStatus,
      verification_status: entry.verificationStatus,
      idempotency_key: `${providerTxnId}_idem`,
      checkout_payload: baseMetadata({ txn: providerTxnId }),
      verified_payload: baseMetadata({ txn: providerTxnId }),
      activated_at: entry.paymentStatus === 'success' ? createdAt : null,
      verified_at: createdAt,
      created_at: createdAt,
      updated_at: createdAt,
    },
    patchPayload: {
      account_id: accountId,
      profile_id: profileId,
      plan_id: scenario.planId,
      billing_interval: 'monthly',
      amount: entry.amount,
      currency: 'INR',
      provider_payment_id: `${providerTxnId}_mih`,
      payment_status: entry.paymentStatus,
      verification_status: entry.verificationStatus,
      idempotency_key: `${providerTxnId}_idem`,
      checkout_payload: baseMetadata({ txn: providerTxnId }),
      verified_payload: baseMetadata({ txn: providerTxnId }),
      activated_at: entry.paymentStatus === 'success' ? createdAt : null,
      verified_at: createdAt,
      created_at: createdAt,
      updated_at: createdAt,
    },
  })
}

async function ensurePlan(accountId, profileId, scenario, latestTransactionId = null) {
  const createdAt = isoFromOffset(scenario.accountCreatedDaysAgo, 15)
  const activatedAt = isoFromOffset(scenario.planActivatedDaysAgo, 10)
  const expiresAt = scenario.planExpiresDaysAgo == null ? null : isoFromOffset(scenario.planExpiresDaysAgo, 10)
  const cancellationRequestedAt =
    scenario.cancellationRequestedDaysAgo == null ? null : isoFromOffset(scenario.cancellationRequestedDaysAgo, 12)
  const cancelledAt = scenario.cancelledDaysAgo == null ? null : isoFromOffset(scenario.cancelledDaysAgo, 12)
  return ensureRecord({
    queryPath: `account_plans?account_id=eq.${accountId}&limit=1&select=*`,
    table: 'account_plans',
    payload: {
      account_id: accountId,
      profile_id: profileId,
      current_plan_id: scenario.planId,
      plan_status: scenario.planStatus,
      billing_provider: 'payu',
      billing_interval: 'monthly',
      latest_transaction_id: latestTransactionId,
      activated_at: activatedAt,
      expires_at: expiresAt,
      metadata: baseMetadata({ plan: scenario.planId }),
      created_at: createdAt,
      updated_at: isoFromOffset(Math.max(scenario.lastLoginDaysAgo, 1), 16),
      cancellation_requested_at: cancellationRequestedAt,
      cancelled_at: cancelledAt,
      cancellation_reason: scenario.cancellationReason,
    },
    patchPayload: {
      profile_id: profileId,
      current_plan_id: scenario.planId,
      plan_status: scenario.planStatus,
      billing_provider: 'payu',
      billing_interval: 'monthly',
      latest_transaction_id: latestTransactionId,
      activated_at: activatedAt,
      expires_at: expiresAt,
      metadata: baseMetadata({ plan: scenario.planId }),
      created_at: createdAt,
      updated_at: isoFromOffset(Math.max(scenario.lastLoginDaysAgo, 1), 16),
      cancellation_requested_at: cancellationRequestedAt,
      cancelled_at: cancelledAt,
      cancellation_reason: scenario.cancellationReason,
    },
  })
}

async function ensureHistoricalQualification(lead, account, profile, scenario, snapshot, index) {
  const evaluatedAt = isoFromOffset(snapshot.daysAgo, 10)
  return ensureRecord({
    queryPath: `qualification_evaluations?lead_id=eq.${lead.id}&evaluation_type=eq.score_update&evaluated_at=eq.${eqValue(evaluatedAt)}&limit=1&select=*`,
    table: 'qualification_evaluations',
    payload: {
      lead_id: lead.id,
      profile_id: profile?.id ?? null,
      account_id: account?.id ?? null,
      evaluation_type: 'score_update',
      source_runtime: 'system',
      rule_version: 'phase10_seed_v1',
      fit_score: snapshot.fitScore,
      buying_intent: snapshot.buyingIntent,
      acquisition_channel: scenario.channel,
      acquisition_source: scenario.source,
      acquisition_campaign: scenario.campaign,
      lead_status: scenario.leadStatus,
      mql_status: snapshot.mqlStatus,
      sql_status: snapshot.sqlStatus,
      pql_status: snapshot.pqlStatus,
      crm_ready: snapshot.sqlStatus === 'sales_ready',
      outbound_ready: scenario.leadSourceType === 'outbound_scraped' && snapshot.sqlStatus === 'sales_ready',
      priority_score: snapshot.priorityScore,
      priority_tier: snapshot.priorityTier,
      explanation: `Synthetic historical qualification snapshot ${index + 1}.`,
      evaluation_reasons: baseMetadata({ fit_band: snapshot.fitScore >= 75 ? 'strong' : 'medium' }),
      engagement_summary: baseMetadata({ touch_count: 3 }),
      product_summary: baseMetadata({ pql_status: snapshot.pqlStatus }),
      acquisition_summary: baseMetadata({ channel: scenario.channel, source: scenario.source }),
      evaluated_at: evaluatedAt,
      created_at: evaluatedAt,
    },
    patchPayload: {
      profile_id: profile?.id ?? null,
      account_id: account?.id ?? null,
      rule_version: 'phase10_seed_v1',
      fit_score: snapshot.fitScore,
      buying_intent: snapshot.buyingIntent,
      acquisition_channel: scenario.channel,
      acquisition_source: scenario.source,
      acquisition_campaign: scenario.campaign,
      lead_status: scenario.leadStatus,
      mql_status: snapshot.mqlStatus,
      sql_status: snapshot.sqlStatus,
      pql_status: snapshot.pqlStatus,
      crm_ready: snapshot.sqlStatus === 'sales_ready',
      outbound_ready: scenario.leadSourceType === 'outbound_scraped' && snapshot.sqlStatus === 'sales_ready',
      priority_score: snapshot.priorityScore,
      priority_tier: snapshot.priorityTier,
      explanation: `Synthetic historical qualification snapshot ${index + 1}.`,
      evaluation_reasons: baseMetadata({ fit_band: snapshot.fitScore >= 75 ? 'strong' : 'medium' }),
      engagement_summary: baseMetadata({ touch_count: 3 }),
      product_summary: baseMetadata({ pql_status: snapshot.pqlStatus }),
      acquisition_summary: baseMetadata({ channel: scenario.channel, source: scenario.source }),
      created_at: evaluatedAt,
    },
  })
}

async function ensureHistoricalHealth(accountId, scenario, snapshot, index) {
  const evaluatedAt = isoFromOffset(snapshot.daysAgo, 18)
  const fingerprint = md5(JSON.stringify({ slug: scenario.slug, snapshot, index, version: COHORT_VERSION }))
  return ensureRecord({
    queryPath: `customer_health_evaluations?account_id=eq.${accountId}&evaluation_type=eq.synthetic_scenario&evaluated_at=eq.${eqValue(evaluatedAt)}&limit=1&select=*`,
    table: 'customer_health_evaluations',
    payload: {
      account_id: accountId,
      evaluation_type: 'synthetic_scenario',
      rule_version: 'phase10_seed_v1',
      health_score: snapshot.healthScore,
      health_state: snapshot.healthState,
      lifecycle_state: snapshot.lifecycleState,
      churn_risk: snapshot.churnRisk,
      expansion_score: snapshot.expansionScore,
      expansion_state: snapshot.expansionState,
      adoption_component: snapshot.adoption_component ?? Math.min(30, Math.max(8, Math.floor(snapshot.healthScore * 0.3))),
      engagement_component: snapshot.engagement_component ?? Math.min(20, Math.max(4, Math.floor(snapshot.healthScore * 0.18))),
      value_component: snapshot.value_component ?? Math.min(25, Math.max(4, Math.floor(snapshot.healthScore * 0.22))),
      billing_component: snapshot.billing_component ?? (snapshot.healthState === 'critical' ? 0 : 10),
      risk_penalty: snapshot.risk_penalty ?? Math.max(0, Math.min(100, 40 - Math.floor(snapshot.healthScore / 3))),
      authoritative_churned: snapshot.authoritative_churned ?? false,
      needs_intervention: snapshot.needs_intervention ?? ['at_risk', 'critical'].includes(snapshot.healthState),
      recommended_action: recommendedActionForSnapshot(snapshot),
      recommended_lead_id: null,
      recommended_owner_type: snapshot.expansionState === 'sales_followup' ? 'ae' : null,
      reasons: baseMetadata({ historical: true, state: snapshot.healthState }),
      evaluation_fingerprint: fingerprint,
      evaluated_at: evaluatedAt,
      created_at: evaluatedAt,
    },
    patchPayload: {
      rule_version: 'phase10_seed_v1',
      health_score: snapshot.healthScore,
      health_state: snapshot.healthState,
      lifecycle_state: snapshot.lifecycleState,
      churn_risk: snapshot.churnRisk,
      expansion_score: snapshot.expansionScore,
      expansion_state: snapshot.expansionState,
      adoption_component: snapshot.adoption_component ?? Math.min(30, Math.max(8, Math.floor(snapshot.healthScore * 0.3))),
      engagement_component: snapshot.engagement_component ?? Math.min(20, Math.max(4, Math.floor(snapshot.healthScore * 0.18))),
      value_component: snapshot.value_component ?? Math.min(25, Math.max(4, Math.floor(snapshot.healthScore * 0.22))),
      billing_component: snapshot.billing_component ?? (snapshot.healthState === 'critical' ? 0 : 10),
      risk_penalty: snapshot.risk_penalty ?? Math.max(0, Math.min(100, 40 - Math.floor(snapshot.healthScore / 3))),
      authoritative_churned: snapshot.authoritative_churned ?? false,
      needs_intervention: snapshot.needs_intervention ?? ['at_risk', 'critical'].includes(snapshot.healthState),
      recommended_action: recommendedActionForSnapshot(snapshot),
      recommended_lead_id: null,
      recommended_owner_type: snapshot.expansionState === 'sales_followup' ? 'ae' : null,
      reasons: baseMetadata({ historical: true, state: snapshot.healthState }),
      evaluation_fingerprint: fingerprint,
      created_at: evaluatedAt,
    },
  })
}

function recommendedActionForSnapshot(snapshot) {
  if (snapshot.lifecycleState === 'churned') return 'review_churn_recovery'
  if (snapshot.lifecycleState === 'dormant') return 'reactivate_account'
  if (snapshot.expansionState === 'sales_followup') return 'route_to_ae'
  if (snapshot.expansionState === 'upgrade_ready') return 'prompt_upgrade'
  if (snapshot.healthState === 'critical' || snapshot.healthState === 'at_risk') return 'customer_intervention'
  if (snapshot.lifecycleState === 'newly_activated') return 'reinforce_activation'
  return 'monitor'
}

async function ensureOutreach(leadId, scenario, status, daysAgo, dealId = null) {
  const sentAt = isoFromOffset(daysAgo, 10)
  const replyAt = status === 'replied' ? isoFromOffset(Math.max(daysAgo - 1, 0), 12) : null
  return ensureRecord({
    queryPath: `outreach?lead_id=eq.${leadId}&subject=eq.${eqValue(`${PREFIX}_${scenario.slug}_${status}`)}&limit=1&select=*`,
    table: 'outreach',
    payload: {
      lead_id: leadId,
      email: profileEmail(scenario.slug),
      subject: `${PREFIX}_${scenario.slug}_${status}`,
      body: 'Synthetic Phase 10 outreach.',
      status,
      sent_at: sentAt,
      next_followup_at: null,
      reply_received_at: replyAt,
      deal_id: dealId,
      created_at: sentAt,
      updated_at: replyAt ?? sentAt,
    },
    patchPayload: {
      email: profileEmail(scenario.slug),
      body: 'Synthetic Phase 10 outreach.',
      status,
      sent_at: sentAt,
      next_followup_at: null,
      reply_received_at: replyAt,
      deal_id: dealId,
      created_at: sentAt,
      updated_at: replyAt ?? sentAt,
    },
  })
}

async function resetOutreachState(leadId, scenario) {
  await patchRows(`outreach?lead_id=eq.${leadId}&subject=eq.${eqValue(`${PREFIX}_${scenario.slug}_replied`)}&select=*`, {
    status: 'sent',
    sent_at: isoFromOffset(6, 10),
    next_followup_at: null,
    reply_received_at: null,
    deal_id: null,
    updated_at: isoFromOffset(6, 10),
  })
}

async function ensureSalesAssignmentHistory(assignmentId, leadId, accountId, profileId, actionType, reason, createdAt, overrides = {}) {
  return ensureRecord({
    queryPath: `sales_assignment_history?assignment_id=eq.${assignmentId}&action_type=eq.${actionType}&created_at=eq.${eqValue(createdAt)}&limit=1&select=*`,
    table: 'sales_assignment_history',
    payload: {
      assignment_id: assignmentId,
      lead_id: leadId,
      account_id: accountId,
      profile_id: profileId,
      action_type: actionType,
      from_rep_id: overrides.from_rep_id ?? null,
      to_rep_id: overrides.to_rep_id ?? null,
      from_owner_type: overrides.from_owner_type ?? null,
      to_owner_type: overrides.to_owner_type ?? null,
      from_status: overrides.from_status ?? null,
      to_status: overrides.to_status ?? 'assigned',
      reason,
      context: baseMetadata({ actionType, ...overrides.context }),
      created_at: createdAt,
    },
    patchPayload: {
      account_id: accountId,
      profile_id: profileId,
      from_rep_id: overrides.from_rep_id ?? null,
      to_rep_id: overrides.to_rep_id ?? null,
      from_owner_type: overrides.from_owner_type ?? null,
      to_owner_type: overrides.to_owner_type ?? null,
      from_status: overrides.from_status ?? null,
      to_status: overrides.to_status ?? 'assigned',
      reason,
      context: baseMetadata({ actionType, ...overrides.context }),
    },
  })
}

async function fetchRepByCode(repCode) {
  const rep = await fetchSingle(`sales_reps?rep_code=eq.${repCode}&limit=1&select=*`)
  if (!rep) throw new Error(`missing sales rep ${repCode}`)
  return rep
}

async function ensureManualRetryAssignment({ lead, profile, account, evaluation }) {
  const rep = null
  const routedAt = isoFromOffset(4, 14)
  const assignment = await ensureRecord({
    queryPath: `sales_assignments?lead_id=eq.${lead.id}&limit=1&select=*`,
    table: 'sales_assignments',
    payload: {
      lead_id: lead.id,
      profile_id: profile?.id ?? null,
      account_id: account?.id ?? null,
      qualification_evaluation_id: evaluation.evaluation_id,
      current_rep_id: rep?.id ?? null,
      current_owner_type: null,
      segment: 'mid_market',
      geography: 'north_america',
      acquisition_channel: 'partner',
      acquisition_source: 'partner_portal',
      fit_score: evaluation.fit_score,
      buying_intent: evaluation.buying_intent,
      mql_status: evaluation.mql_status,
      sql_status: evaluation.sql_status,
      priority_tier: evaluation.priority_tier,
      priority_score: evaluation.priority_score,
      routing_status: 'retry_required',
      routing_reason: 'phase10_demo_retry_required',
      routing_rule_version: 'phase10_seed_v1',
      eligible_for_sales: true,
      manual_override: false,
      manual_override_reason: null,
      needs_ae_handoff: false,
      crm_sync_status: 'failed',
      slack_sync_status: 'retry_required',
      retry_count: 1,
      last_error: 'Synthetic retry state for demo workload.',
      last_routed_at: routedAt,
      assigned_at: null,
      handoff_at: null,
      last_synced_at: routedAt,
      created_at: routedAt,
      updated_at: routedAt,
    },
    patchPayload: {
      profile_id: profile?.id ?? null,
      account_id: account?.id ?? null,
      qualification_evaluation_id: evaluation.evaluation_id,
      current_rep_id: null,
      current_owner_type: null,
      segment: 'mid_market',
      geography: 'north_america',
      acquisition_channel: 'partner',
      acquisition_source: 'partner_portal',
      fit_score: evaluation.fit_score,
      buying_intent: evaluation.buying_intent,
      mql_status: evaluation.mql_status,
      sql_status: evaluation.sql_status,
      priority_tier: evaluation.priority_tier,
      priority_score: evaluation.priority_score,
      routing_status: 'retry_required',
      routing_reason: 'phase10_demo_retry_required',
      routing_rule_version: 'phase10_seed_v1',
      eligible_for_sales: true,
      manual_override: false,
      manual_override_reason: null,
      needs_ae_handoff: false,
      crm_sync_status: 'failed',
      slack_sync_status: 'retry_required',
      retry_count: 1,
      last_error: 'Synthetic retry state for demo workload.',
      last_routed_at: routedAt,
      assigned_at: null,
      handoff_at: null,
      last_synced_at: routedAt,
      created_at: routedAt,
      updated_at: routedAt,
    },
  })

  await ensureSalesAssignmentHistory(assignment.id, lead.id, account?.id ?? null, profile?.id ?? null, 'routed', 'phase10_demo_retry_required', isoFromOffset(4, 14), {
    to_status: 'retry_required',
  })
  await ensureSalesAssignmentHistory(assignment.id, lead.id, account?.id ?? null, profile?.id ?? null, 'retry_marked', 'phase10_demo_retry_required', isoFromOffset(3, 11), {
    from_status: 'retry_required',
    to_status: 'retry_required',
  })
  return assignment
}

async function rebuildCurrentLeadState(seed) {
  const evaluations = new Map()
  const assignments = new Map()

  for (const scenario of COHORT) {
    const lead = seed.leads.get(scenario.slug)
    const result = await rpc('evaluate_lead_qualification', {
      p_lead_id: lead.id,
      p_evaluation_type: scenario.leadSourceType === 'outbound_scraped' ? 'outbound_ready' : 'score_update',
      p_source_runtime: 'system',
    })
    evaluations.set(scenario.slug, result[0])

    if (scenario.routeMode === 'none') continue

    if (scenario.routeMode === 'retry_required') {
      const assignment = await ensureManualRetryAssignment({
        lead,
        profile: seed.profiles.get(scenario.slug) ?? null,
        account: seed.accounts.get(scenario.slug) ?? null,
        evaluation: result[0],
      })
      assignments.set(scenario.slug, assignment)
      continue
    }

    if (scenario.routeMode === 'handoff') {
      await resetOutreachState(lead.id, scenario)
      const firstRoute = await rpc('route_lead_to_sales', {
        p_lead_id: lead.id,
        p_trigger: 'phase10_initial_route',
        p_force_reassign: true,
      })
      assignments.set(scenario.slug, firstRoute[0])
      await ensureSalesAssignmentHistory(firstRoute[0].assignment_id, lead.id, firstRoute[0].account_id, firstRoute[0].profile_id, 'routed', 'phase10_initial_route', isoFromOffset(52, 11), {
        to_rep_id: firstRoute[0].current_rep_id,
        to_owner_type: firstRoute[0].current_owner_type,
        to_status: firstRoute[0].routing_status,
      })
      await ensureSalesAssignmentHistory(firstRoute[0].assignment_id, lead.id, firstRoute[0].account_id, firstRoute[0].profile_id, 'assigned', 'phase10_sdr_contact', isoFromOffset(50, 12), {
        to_rep_id: firstRoute[0].current_rep_id,
        to_owner_type: firstRoute[0].current_owner_type,
        to_status: 'assigned',
      })
      await ensureOutreach(lead.id, scenario, 'replied', 7, `${PREFIX}_${scenario.slug}_deal`)
      await ensureLeadEvent(lead.id, 'lead.outreach.email.sent', 8, `${scenario.slug}_outreach_sent`)
      await ensureLeadEvent(lead.id, 'lead.outreach.deal.created', 7, `${scenario.slug}_deal_created`, { deal_id: `${PREFIX}_${scenario.slug}_deal` })
      const handoff = await rpc('route_lead_to_sales', {
        p_lead_id: lead.id,
        p_trigger: 'phase10_handoff_route',
        p_force_reassign: false,
      })
      assignments.set(scenario.slug, handoff[0])
      await ensureSalesAssignmentHistory(handoff[0].assignment_id, lead.id, handoff[0].account_id, handoff[0].profile_id, 'handoff', 'phase10_handoff_route', isoFromOffset(7, 13), {
        from_owner_type: 'sdr',
        to_owner_type: 'ae',
        to_rep_id: handoff[0].current_rep_id,
        from_status: 'assigned',
        to_status: handoff[0].routing_status,
      })
      continue
    }

    const route = await rpc('route_lead_to_sales', {
      p_lead_id: lead.id,
      p_trigger: `phase10_${scenario.routeMode}`,
      p_force_reassign: true,
    })
    assignments.set(scenario.slug, route[0])
    await ensureSalesAssignmentHistory(route[0].assignment_id, lead.id, route[0].account_id, route[0].profile_id, 'routed', `phase10_${scenario.routeMode}`, isoFromOffset(5, 11), {
      to_rep_id: route[0].current_rep_id,
      to_owner_type: route[0].current_owner_type,
      to_status: route[0].routing_status,
    })

    if (scenario.routeMode === 'manual_override') {
      const override = await rpc('override_sales_assignment', {
        p_lead_id: lead.id,
        p_rep_code: SALES_REP_CODES.ae,
        p_reason: 'phase10_demo_strategic_override',
        p_force_owner_type: 'ae',
      })
      assignments.set(scenario.slug, override[0])
      await ensureSalesAssignmentHistory(override[0].assignment_id, lead.id, override[0].account_id, override[0].profile_id, 'manual_override', 'phase10_demo_strategic_override', isoFromOffset(2, 14), {
        from_owner_type: route[0].current_owner_type,
        to_owner_type: 'ae',
        from_status: route[0].routing_status,
        to_status: override[0].routing_status,
        to_rep_id: override[0].current_rep_id,
      })
    }
  }

  return { evaluations, assignments }
}

async function rebuildCurrentAccountHealth(seed) {
  const results = new Map()
  for (const scenario of COHORT.filter((item) => item.hasAccount)) {
    const account = seed.accounts.get(scenario.slug)
    const result = await rpc('evaluate_account_health', {
      p_account_id: account.id,
      p_evaluation_type: 'synthetic_scenario',
    })
    results.set(scenario.slug, result[0])
  }
  return results
}

async function buildScenarioRecords(scenario, seed) {
  logStep('scenario:start', { slug: scenario.slug, hasAccount: scenario.hasAccount, routeMode: scenario.routeMode })
  let lead = await ensureLead(scenario)
  seed.leads.set(scenario.slug, lead)
  await ensureLeadEvent(lead.id, 'lead.captured', scenario.firstTouchDaysAgo - 1, `${scenario.slug}_captured`, { source: scenario.source })

  if (scenario.leadSourceType === 'outbound_scraped') {
    await ensureLeadEvent(lead.id, 'lead.ready_to_push', scenario.interactionDaysAgo, `${scenario.slug}_ready_to_push`)
    await ensureLeadEvent(lead.id, 'lead.outreach.email.sent', Math.max(scenario.interactionDaysAgo - 1, 1), `${scenario.slug}_outreach_sent`)
  }

  let profile = null
  let account = null
  if (scenario.hasAccount) {
    profile = await ensureProfile(scenario)
    account = await ensureAccount(scenario)
    seed.profiles.set(scenario.slug, profile)
    seed.accounts.set(scenario.slug, account)

    logStep('scenario:account_ready', { slug: scenario.slug, leadId: lead.id, profileId: profile.id, accountId: account.id })
    await ensureMembership(account.id, profile.id, isoFromOffset(scenario.accountCreatedDaysAgo, 12))
    await ensureOnboarding(account.id, profile.id, scenario)

    const billingTransactions = []
    for (const entry of scenario.billingHistory) {
      billingTransactions.push(await ensureBillingTransaction(account.id, profile.id, scenario, entry))
    }
    const latestTransactionId = billingTransactions.sort((a, b) => new Date(b.verified_at) - new Date(a.verified_at))[0]?.id ?? null
    await ensurePlan(account.id, profile.id, scenario, latestTransactionId)

    const activationEvents = activationEventSchedule(scenario)
    for (const activationEvent of activationEvents) {
      await ensureProductEvent(
        account.id,
        profile.id,
        profile.firebase_uid,
        activationEvent.event_name,
        activationEvent.daysAgo,
        activationEvent.key,
        activationEvent.event_properties,
      )
    }
    for (const extraEvent of scenario.eventExtras) {
      await ensureProductEvent(
        account.id,
        profile.id,
        profile.firebase_uid,
        extraEvent.event_name,
        extraEvent.daysAgo,
        extraEvent.key,
        extraEvent.event_properties,
      )
    }

    const usageRecords = buildUsageRecords(scenario)
    const connectionMap = new Map()
    for (const provider of scenario.providers) {
      const firstProviderUsage = usageRecords.find((item) => item.provider === provider)
      const connection = await ensureProviderConnection(
        account.id,
        provider,
        firstProviderUsage?.connectedDaysAgo ?? scenario.onboardingCompletedDaysAgo,
        firstProviderUsage?.lastSyncedDaysAgo ?? scenario.lastLoginDaysAgo,
        firstProviderUsage?.connectionStatus ?? 'connected',
      )
      connectionMap.set(provider, connection)
    }
    let usageIndex = 1
    for (const record of usageRecords) {
      await ensureUsageRecord(account.id, connectionMap.get(record.provider).id, scenario.slug, usageIndex, record)
      usageIndex += 1
    }

    const budget = await ensureBudget(account.id, profile.id, scenario)
    for (const alert of scenario.alerts) {
      await ensureAlert(account.id, alert, budget?.id ?? null)
    }
    for (const recommendation of scenario.recommendations) {
      await ensureRecommendation(account.id, recommendation)
    }

    for (const snapshot of scenario.historicalHealth) {
      await ensureHistoricalHealth(account.id, scenario, snapshot, scenario.historicalHealth.indexOf(snapshot))
    }
  }

  const persistedLead = await fetchSingle(`staged_leads?event_id=eq.${leadEventId(scenario.slug)}&limit=1&select=*`)
  if (!persistedLead) {
    logStep('scenario:lead_recovered', { slug: scenario.slug, priorLeadId: lead.id })
    lead = await ensureLead(scenario)
    seed.leads.set(scenario.slug, lead)
    await ensureLeadEvent(lead.id, 'lead.captured', scenario.firstTouchDaysAgo - 1, `${scenario.slug}_captured`, { source: scenario.source })
    if (scenario.leadSourceType === 'outbound_scraped') {
      await ensureLeadEvent(lead.id, 'lead.ready_to_push', scenario.interactionDaysAgo, `${scenario.slug}_ready_to_push`)
      await ensureLeadEvent(lead.id, 'lead.outreach.email.sent', Math.max(scenario.interactionDaysAgo - 1, 1), `${scenario.slug}_outreach_sent`)
    }
  } else {
    lead = persistedLead
    seed.leads.set(scenario.slug, lead)
  }

  await syncLeadTouchTimeline(lead.id, scenario)

  for (const snapshot of scenario.historicalQualification) {
    await ensureHistoricalQualification(lead, account, profile, scenario, snapshot, scenario.historicalQualification.indexOf(snapshot))
  }

  logStep('scenario:done', { slug: scenario.slug, leadId: lead.id, profileId: profile?.id ?? null, accountId: account?.id ?? null })
}

function activationEventSchedule(scenario) {
  const onboardingDaysAgo = scenario.onboardingCompletedDaysAgo
  const schedule = [
    { event_name: 'signup', daysAgo: scenario.accountCreatedDaysAgo, key: 'signup' },
    { event_name: 'onboarding_started', daysAgo: Math.max(scenario.accountCreatedDaysAgo - 1, 1), key: 'onboarding_started' },
    { event_name: 'onboarding_completed', daysAgo: onboardingDaysAgo, key: 'onboarding_completed' },
  ]

  if (scenario.providers.length > 0) {
    schedule.push({ event_name: 'provider_connected', daysAgo: Math.max(onboardingDaysAgo - 1, 1), key: 'provider_connected' })
    const usageSignalDaysAgo =
      scenario.productPattern === 'newly_activated'
        ? 8
        : scenario.productPattern === 'dormant'
          ? 28
          : scenario.productPattern === 'cancelled'
            ? 40
            : 12
    schedule.push({ event_name: 'usage_synced', daysAgo: usageSignalDaysAgo, key: 'usage_synced' })
    schedule.push({ event_name: 'insight_generated', daysAgo: Math.max(usageSignalDaysAgo - 1, 1), key: 'insight_generated' })
  }

  if (scenario.budget) {
    schedule.push({ event_name: 'budget_created', daysAgo: scenario.budget.daysAgo, key: 'budget_created' })
    schedule.push({ event_name: 'alert_configured', daysAgo: Math.max(scenario.budget.daysAgo - 1, 1), key: 'alert_configured' })
  }

  return schedule
}

async function seedPhase10Cohort() {
  const seed = {
    leads: new Map(),
    accounts: new Map(),
    profiles: new Map(),
  }

  await ensurePhase10Entities()
  for (const scenario of COHORT) {
    await buildScenarioRecords(scenario, seed)
  }

  const currentLeadState = await rebuildCurrentLeadState(seed)
  const currentHealthState = await rebuildCurrentAccountHealth(seed)

  return {
    seed,
    currentLeadState,
    currentHealthState,
    cohort: COHORT,
    meta: {
      prefix: PREFIX,
      version: COHORT_VERSION,
      start: DEMO_START_AT,
      end: DEMO_END_AT,
    },
  }
}

async function resetPhase10Cohort() {
  const leadRows = await fetchRows(`staged_leads?event_id=like.${PREFIX}_*&select=id`)
  const profileRows = await fetchRows(`profiles?firebase_uid=like.${PREFIX}_*&select=id`)
  const accountRows = await fetchRows(`accounts?slug=like.${PREFIX}_*&select=id`)
  const leadIds = leadRows.map((row) => row.id)
  const profileIds = profileRows.map((row) => row.id)
  const accountIds = accountRows.map((row) => row.id)

  if (accountIds.length > 0) {
    const inAccounts = inClause(accountIds)
    await deleteRows(`customer_health_evaluations?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`billing_transactions?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`cost_recommendations?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`product_alerts?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`budgets?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`usage_records?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`provider_connections?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`product_events?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`onboarding_responses?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`account_members?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`account_plans?account_id=in.(${inAccounts})&select=id`)
    await deleteRows(`acquisition_touches?account_id=in.(${inAccounts})&select=id`)
  }

  if (profileIds.length > 0) {
    const inProfiles = inClause(profileIds)
    await deleteRows(`qualification_evaluations?profile_id=in.(${inProfiles})&select=id`)
    await deleteRows(`acquisition_touches?profile_id=in.(${inProfiles})&select=id`)
  }

  if (leadIds.length > 0) {
    const inLeads = inClause(leadIds)
    const assignmentRows = await fetchRows(`sales_assignments?lead_id=in.(${inLeads})&select=id`)
    if (assignmentRows.length > 0) {
      const assignmentIds = inClause(assignmentRows.map((row) => row.id))
      await deleteRows(`sales_assignment_history?assignment_id=in.(${assignmentIds})&select=id`)
    }
    await deleteRows(`sales_assignments?lead_id=in.(${inLeads})&select=id`)
    await deleteRows(`qualification_evaluations?lead_id=in.(${inLeads})&select=id`)
    await deleteRows(`outreach?lead_id=in.(${inLeads})&select=id`)
    await deleteRows(`lead_events?lead_id=in.(${inLeads})&select=id`)
    await deleteRows(`acquisition_touches?lead_id=in.(${inLeads})&select=id`)
  }

  await deleteRows(`acquisition_touches?source_id=like.${PREFIX}_*&select=id`)
  await deleteRows(`billing_transactions?provider_txn_id=like.${PREFIX}_*&select=id`)
  await deleteRows(`profiles?firebase_uid=like.${PREFIX}_*&select=id`)
  await deleteRows(`accounts?slug=like.${PREFIX}_*&select=id`)
  await deleteRows(`staged_leads?event_id=like.${PREFIX}_*&select=id`)
  await deleteRows(`acquisition_referrals?referral_id=like.phase10_*&select=referral_id`)
  await deleteRows(`acquisition_creators?creator_id=like.phase10_*&select=creator_id`)
  await deleteRows(`acquisition_partners?partner_id=like.phase10_*&select=partner_id`)

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const [remainingLeads, remainingProfiles, remainingAccounts] = await Promise.all([
      fetchRows(`staged_leads?event_id=like.${PREFIX}_*&select=id`),
      fetchRows(`profiles?firebase_uid=like.${PREFIX}_*&select=id`),
      fetchRows(`accounts?slug=like.${PREFIX}_*&select=id`),
    ])

    if (remainingLeads.length === 0 && remainingProfiles.length === 0 && remainingAccounts.length === 0) {
      logStep('reset:confirmed_absent', { attempt })
      return {
        deletedLeadCount: leadIds.length,
        deletedAccountCount: accountIds.length,
        deletedProfileCount: profileIds.length,
      }
    }

    logStep('reset:waiting_for_replica', {
      attempt,
      remainingLeads: remainingLeads.length,
      remainingProfiles: remainingProfiles.length,
      remainingAccounts: remainingAccounts.length,
    })
    await sleep(1500)
  }

  throw new Error('phase10_reset_not_fully_visible')
}

async function reseedPhase10Cohort() {
  await resetPhase10Cohort()
  return seedPhase10Cohort()
}

async function fetchNamedIds() {
  const partnerLead = await fetchSingle(`staged_leads?event_id=eq.${leadEventId('partner_anchor')}&limit=1&select=id,event_id`)
  const partnerAccount = await fetchSingle(`accounts?slug=eq.${accountSlug('partner_anchor')}&limit=1&select=id,slug`)
  const outboundLead = await fetchSingle(`staged_leads?event_id=eq.${leadEventId('outbound_sql_1')}&limit=1&select=id,event_id`)
  const expansionAccount = await fetchSingle(`accounts?slug=eq.${accountSlug('referral_expand_1')}&limit=1&select=id,slug`)
  const budgetAccount = await fetchSingle(`accounts?slug=eq.${accountSlug('budget_pressure_1')}&limit=1&select=id,slug`)
  return {
    partnerLead,
    partnerAccount,
    outboundLead,
    expansionAccount,
    budgetAccount,
  }
}

async function validatePhase10Cohort() {
  const named = await fetchNamedIds()
  assert.ok(named.partnerLead?.id)
  assert.ok(named.partnerAccount?.id)
  assert.ok(named.outboundLead?.id)
  assert.ok(named.expansionAccount?.id)
  assert.ok(named.budgetAccount?.id)

  const partnerOverview = await fetchSingle(`account_dashboard_overview?account_id=eq.${named.partnerAccount.id}&limit=1&select=*`)
  const partnerHealth = await fetchSingle(`current_customer_health?account_id=eq.${named.partnerAccount.id}&limit=1&select=*`)
  const partnerQualification = await fetchSingle(`lead_current_qualification?lead_id=eq.${named.partnerLead.id}&limit=1&select=*`)
  const partnerSales = await fetchSingle(`current_sales_queue?lead_id=eq.${named.partnerLead.id}&limit=1&select=*`)
  const outboundSales = await fetchSingle(`current_sales_queue?lead_id=eq.${named.outboundLead.id}&limit=1&select=*`)
  const expansionHealth = await fetchSingle(`current_customer_health?account_id=eq.${named.expansionAccount.id}&limit=1&select=*`)
  const budgetHealth = await fetchSingle(`current_customer_health?account_id=eq.${named.budgetAccount.id}&limit=1&select=*`)

  assert.equal(partnerOverview.activated, true)
  assert.equal(partnerOverview.activation_score >= 80, true)
  assert.equal(numeric(partnerOverview.current_month_spend) > 0, true)
  assert.equal(partnerOverview.budget_amount != null, true)
  assert.equal(partnerHealth.health_state, 'healthy')
  assert.equal(['expansion_candidate', 'sales_followup'].includes(partnerHealth.expansion_state), true)
  assert.equal(partnerQualification.sql_status, 'sales_ready')
  assert.equal(partnerSales.current_owner_type, 'ae')
  assert.equal(partnerSales.routing_status, 'handed_off')
  assert.equal(outboundSales.current_owner_type, 'sdr')
  assert.equal(expansionHealth.expansion_state, 'sales_followup')
  assert.equal(['upgrade_ready', 'sales_followup'].includes(budgetHealth.expansion_state), true)

  const executive = await fetchSingle('gtm_executive_summary?select=*')
  const qualification = await fetchSingle('gtm_qualification_summary?select=*')
  const product = await fetchSingle('gtm_product_summary?select=*')
  const health = await fetchSingle('gtm_customer_health_summary?select=*')
  const lifecycleRows = await fetchRows(`gtm_lifecycle_funnel?acquisition_campaign=like.phase10_*&select=stage_name,stage_count`)
  const acquisitionRows = await fetchRows(`gtm_acquisition_conversion_metrics?acquisition_campaign=like.phase10_*&select=acquisition_channel,lead_count,account_count`)
  const salesRows = await fetchRows('gtm_sales_workload_summary?select=*')
  const leadTrend = await fetchRows('gtm_lead_volume_trend?select=*')
  const lifecycleTrend = await fetchRows('gtm_account_lifecycle_trend?select=*')
  const spendTrend = await fetchRows('gtm_spend_trend?select=*')
  const healthTrend = await fetchRows('gtm_customer_health_trend?select=*')
  const salesTrend = await fetchRows('gtm_sales_assignment_activity_trend?select=*')

  assert.equal(numeric(executive.total_leads) >= COHORT.length, true)
  assert.equal(numeric(executive.total_accounts) >= COHORT.filter((scenario) => scenario.hasAccount).length, true)
  assert.equal(numeric(qualification.mql_count) >= 15, true)
  assert.equal(numeric(qualification.sql_count) >= 8, true)
  assert.equal(numeric(product.activated_accounts) >= 10, true)
  assert.equal(numeric(health.expansion_candidate_accounts) >= 3, true)
  assert.equal(numeric(health.sales_followup_accounts) >= 1, true)
  assert.equal(lifecycleRows.some((row) => row.stage_name === 'expansion_ready' && numeric(row.stage_count) >= 2), true)
  assert.equal(acquisitionRows.some((row) => row.acquisition_channel === 'partner'), true)
  assert.equal(acquisitionRows.some((row) => row.acquisition_channel === 'creator'), true)
  assert.equal(acquisitionRows.some((row) => row.acquisition_channel === 'referral'), true)
  assert.equal(salesRows.some((row) => row.owner_type === 'sdr'), true)
  assert.equal(salesRows.some((row) => row.owner_type === 'ae'), true)
  assert.equal(leadTrend.length > 0, true)
  assert.equal(lifecycleTrend.length > 0, true)
  assert.equal(spendTrend.length > 0, true)
  assert.equal(healthTrend.length > 0, true)
  assert.equal(salesTrend.length > 0, true)

  return {
    named,
    executive,
    qualification,
    product,
    health,
  }
}

async function benchmarkPhase10Views() {
  const queries = [
    'gtm_executive_summary?select=*',
    'gtm_lifecycle_funnel?select=stage_name,stage_count&limit=200',
    'gtm_acquisition_conversion_metrics?select=*',
    'gtm_qualification_summary?select=*',
    'gtm_sales_workload_summary?select=*',
    'gtm_product_summary?select=*',
    'gtm_customer_health_summary?select=*',
    'gtm_lead_volume_trend?select=*',
    'gtm_account_lifecycle_trend?select=*',
    'gtm_spend_trend?select=*',
    'gtm_customer_health_trend?select=*',
    'gtm_sales_assignment_activity_trend?select=*',
  ]

  const results = []
  for (const path of queries) {
    const started = Date.now()
    const rows = await fetchRows(path)
    results.push({ path, ms: Date.now() - started, rows: Array.isArray(rows) ? rows.length : 1 })
  }
  return results
}

async function summarizePhase10() {
  const named = await fetchNamedIds()
  const executive = await fetchSingle('gtm_executive_summary?select=*')
  const health = await fetchSingle('gtm_customer_health_summary?select=*')
  const qualification = await fetchSingle('gtm_qualification_summary?select=*')
  const partnerHealth = await fetchSingle(`current_customer_health?account_id=eq.${named.partnerAccount.id}&limit=1&select=activation_score,health_state,expansion_state,current_plan_id,plan_status,current_month_spend,budget_amount,projected_month_end_spend`)
  return {
    cohortVersion: COHORT_VERSION,
    prefix: PREFIX,
    totalCompanies: COHORT.length,
    totalLeads: COHORT.length,
    totalAccounts: COHORT.filter((scenario) => scenario.hasAccount).length,
    dateRange: { start: DEMO_START_AT, end: DEMO_END_AT },
    named,
    executive,
    qualification,
    health,
    primaryAccount: partnerHealth,
  }
}

async function main() {
  const command = process.argv[2] ?? 'summary'
  if (!['seed', 'reset', 'reseed', 'validate', 'benchmark', 'summary'].includes(command)) {
    throw new Error(`unsupported_command:${command}`)
  }

  let result
  if (command === 'seed') result = await seedPhase10Cohort()
  if (command === 'reset') result = await resetPhase10Cohort()
  if (command === 'reseed') result = await reseedPhase10Cohort()
  if (command === 'validate') result = await validatePhase10Cohort()
  if (command === 'benchmark') result = await benchmarkPhase10Views()
  if (command === 'summary') result = await summarizePhase10()

  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || String(error))
    process.exitCode = 1
  })
}

export {
  PREFIX,
  COHORT_VERSION,
  DEMO_START_AT,
  DEMO_END_AT,
  COHORT,
  seedPhase10Cohort,
  resetPhase10Cohort,
  reseedPhase10Cohort,
  validatePhase10Cohort,
  benchmarkPhase10Views,
  summarizePhase10,
}
