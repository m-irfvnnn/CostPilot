import { createDefaultAcquisitionAttributionService } from './acquisition-attribution-service.ts'
import { deriveAccountName, parseOnboardingPayload, type ResolvedOnboardingPayload, type ResolvedAccountName } from './onboarding-core'
import { triggerWebsiteSignupLeadIngestion, type PreCrmLeadIngestionResult } from './precrm-lead-ingestion'
import { buildProfileUpsertInput, type VerifiedFirebaseToken } from './profile-sync-core'
import {
  getAccountByProfileId,
  getMembershipByAccountAndProfileId,
  getProfileByFirebaseUid,
  type SupabaseAccount,
  type SupabaseMembership,
  type SupabaseOnboardingResponse,
  type SupabaseProfile,
  updateAccountOnboardingStatus,
  upsertAccount,
  upsertAccountMembership,
  upsertOnboardingResponse,
} from './supabase-admin'

export type FirebaseVerifier = {
  verifyIdToken(token: string, checkRevoked: boolean): Promise<VerifiedFirebaseToken>
}

export type OnboardingSyncResult = {
  profile: SupabaseProfile
  account: SupabaseAccount
  membership: SupabaseMembership
  onboarding_response: SupabaseOnboardingResponse
  lead_ingestion: PreCrmLeadIngestionResult
}

export type OnboardingServiceDependencies = {
  verifier: FirebaseVerifier
  parseToken: (header: string | null) => string | null
  resolveProfileByToken: (token: VerifiedFirebaseToken) => Promise<SupabaseProfile>
  getAccountByProfileId: typeof getAccountByProfileId
  getMembershipByAccountAndProfileId: (accountId: string, profileId: string) => Promise<SupabaseMembership | null>
  upsertAccount: typeof upsertAccount
  upsertAccountMembership: typeof upsertAccountMembership
  upsertOnboardingResponse: typeof upsertOnboardingResponse
  updateAccountOnboardingStatus: typeof updateAccountOnboardingStatus
  linkAttributionToAccount: (profileId: string, accountId: string) => Promise<unknown>
  triggerLeadIngestion: (input: {
    profile: SupabaseProfile
    account: SupabaseAccount
    onboarding: ResolvedOnboardingPayload
    occurred_at: string
  }) => Promise<PreCrmLeadIngestionResult>
  deriveAccountName: (email: string | null | undefined, company?: string | null) => ResolvedAccountName
  parsePayload: (payload: unknown) => ResolvedOnboardingPayload
  now: () => string
}

export function createOnboardingService(dependencies: OnboardingServiceDependencies) {
  return {
    async sync(authHeader: string | null, payload: unknown): Promise<OnboardingSyncResult> {
      const token = dependencies.parseToken(authHeader)
      if (!token) throw new Error('missing_token')

      const onboarding = dependencies.parsePayload(payload)
      const verified = await dependencies.verifier.verifyIdToken(token, true)
      const profile = await dependencies.resolveProfileByToken(verified)
      const existingAccount = await dependencies.getAccountByProfileId(profile.id)
      const shouldTriggerLeadIngestion = existingAccount?.onboarding_status !== 'completed'
      const derived = dependencies.deriveAccountName(profile.email ?? verified.email ?? null, onboarding.company)
      const primaryDomain = profile.email?.split('@')[1] ?? verified.email?.split('@')[1] ?? null

      const account =
        existingAccount ??
        (await dependencies.upsertAccount({
          name: derived.name,
          slug: derived.slug,
          primary_domain: primaryDomain,
          onboarding_status: 'in_progress',
        }))

      const existingMembership = await dependencies.getMembershipByAccountAndProfileId(account.id, profile.id)
      const membership = await dependencies.upsertAccountMembership({
        account_id: account.id,
        profile_id: profile.id,
        role: 'owner',
        is_owner: existingMembership?.is_owner ?? !existingAccount,
      })

      const onboardingResponse = await dependencies.upsertOnboardingResponse({
        profile_id: profile.id,
        account_id: account.id,
        company_size: onboarding.company_size,
        providers: onboarding.providers,
        estimated_monthly_spend: onboarding.estimated_monthly_spend,
        raw_answers: onboarding.raw_answers,
        completed_at: dependencies.now(),
      })

      await dependencies.linkAttributionToAccount(profile.id, account.id)

      const updatedAccount = await dependencies.updateAccountOnboardingStatus(account.id, 'completed')
      const leadIngestion = shouldTriggerLeadIngestion
        ? await dependencies.triggerLeadIngestion({
            profile,
            account: updatedAccount,
            onboarding,
            occurred_at: onboardingResponse.completed_at ?? dependencies.now(),
          })
        : { status: 'skipped' as const, reason: 'already_completed' as const }

      return {
        profile,
        account: updatedAccount,
        membership,
        onboarding_response: onboardingResponse,
        lead_ingestion: leadIngestion,
      }
    },
  }
}

export function createDefaultOnboardingService(dependencies: {
  verifier: FirebaseVerifier
  parseToken: (header: string | null) => string | null
  now: () => string
}) {
  return createOnboardingService({
    ...dependencies,
    resolveProfileByToken: async (token) => {
      const profile = await getProfileByFirebaseUid(token.uid)
      if (!profile) throw new Error('profile_not_found')
      return profile
    },
    getAccountByProfileId,
    getMembershipByAccountAndProfileId,
    upsertAccount,
    upsertAccountMembership,
    upsertOnboardingResponse,
    updateAccountOnboardingStatus,
    triggerLeadIngestion: triggerWebsiteSignupLeadIngestion,
    linkAttributionToAccount: async (profileId, accountId) =>
      createDefaultAcquisitionAttributionService().persist({
        profile_id: profileId,
        account_id: accountId,
        occurred_at: dependencies.now(),
        envelope: {
          channel: 'plg',
          source: 'web_app',
          source_id: profileId,
          medium: 'onboarding',
          campaign: null,
          referrer: null,
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          utm_content: null,
          utm_term: null,
          partner_id: null,
          creator_id: null,
          referral_id: null,
        },
        metadata: {
          event_name: 'account_link',
        },
        persist_first_touch: false,
        persist_last_touch: false,
        persist_interaction: false,
      }),
    deriveAccountName,
    parsePayload: parseOnboardingPayload,
  })
}

export { buildProfileUpsertInput }
