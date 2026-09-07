import type { User } from 'firebase/auth'
import { mergeProductEventPropertiesWithAcquisitionContext } from './acquisition-browser'

export type ProductEventName =
  | 'account_created'
  | 'signup'
  | 'login'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'dashboard_viewed'
  | 'workflow_viewed'
  | 'usage_viewed'
  | 'provider_viewed'
  | 'provider_connection_started'
  | 'provider_connected'
  | 'provider_connection_failed'
  | 'provider_disconnected'
  | 'ai_usage_recorded'
  | 'workflow_observed'
  | 'workflow_run_observed'
  | 'usage_synced'
  | 'insight_generated'
  | 'budget_created'
  | 'budget_updated'
  | 'budget_threshold_reached'
  | 'budget_exceeded'
  | 'alert_configured'
  | 'provider_limit_created'
  | 'provider_limit_updated'
  | 'provider_limit_approaching'
  | 'provider_limit_exceeded'
  | 'alert_created'
  | 'alert_viewed'
  | 'alert_resolved'
  | 'first_cost_data_received'
  | 'forecast_viewed'
  | 'recommendation_generated'
  | 'recommendation_viewed'
  | 'recommendation_dismissed'
  | 'recommendation_applied'
  | 'alert_triggered'
  | 'plan_selected'
  | 'upgrade_clicked'
  | 'upgrade_requested'
  | 'checkout_started'
  | 'subscription_activated'

export async function trackProductEvent(
  user: User,
  event_name: ProductEventName,
  event_properties: Record<string, unknown> = {},
  event_id?: string,
) {
  const token = await user.getIdToken()
  const response = await fetch('/api/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      event_id,
      event_name,
      event_properties: mergeProductEventPropertiesWithAcquisitionContext(event_properties),
    }),
  })

  if (!response.ok) {
    throw new Error('event_tracking_failed')
  }

  return (await response.json()) as unknown
}
