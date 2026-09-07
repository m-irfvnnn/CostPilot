type TouchRecord = {
  id: string
  touch_type: 'first_touch' | 'last_touch' | 'interaction'
  occurred_at: string
  created_at?: string | null
  channel: string
  source: string | null
  source_id: string | null
  medium: string | null
  campaign: string | null
  referrer: string | null
  partner_id?: string | null
  creator_id?: string | null
  referral_id?: string | null
  lead_id?: number | null
  profile_id?: string | null
  account_id?: string | null
  firebase_uid?: string | null
}

export type ResolvedAcquisitionTouch = {
  id: string
  touch_type: 'first_touch' | 'last_touch' | 'interaction'
  occurred_at: string
  channel: string
  source: string | null
  source_id: string | null
  medium: string | null
  campaign: string | null
  referrer: string | null
  partner_id: string | null
  creator_id: string | null
  referral_id: string | null
}

export type ResolvedAcquisitionAttribution = {
  first_touch: ResolvedAcquisitionTouch | null
  last_touch: ResolvedAcquisitionTouch | null
  latest_interaction: ResolvedAcquisitionTouch | null
  interaction_count: number
  channels_seen: string[]
  sources_seen: string[]
  campaigns_seen: string[]
  identity: {
    lead_id: number | null
    profile_id: string | null
    account_id: string | null
    firebase_uid: string | null
  }
}

function toComparableDate(value: string, fallback: string | null | undefined) {
  return new Date(fallback ?? value).toISOString()
}

function sortTouches(touches: TouchRecord[]) {
  return [...touches].sort((left, right) => {
    const leftOccurred = toComparableDate(left.occurred_at, left.created_at)
    const rightOccurred = toComparableDate(right.occurred_at, right.created_at)
    if (leftOccurred < rightOccurred) return -1
    if (leftOccurred > rightOccurred) return 1

    const leftCreated = toComparableDate(left.created_at ?? left.occurred_at, left.occurred_at)
    const rightCreated = toComparableDate(right.created_at ?? right.occurred_at, right.occurred_at)
    if (leftCreated < rightCreated) return -1
    if (leftCreated > rightCreated) return 1

    return left.id.localeCompare(right.id)
  })
}

function summarizeTouch(touch: TouchRecord | null | undefined): ResolvedAcquisitionTouch | null {
  if (!touch) return null
  return {
    id: touch.id,
    touch_type: touch.touch_type,
    occurred_at: touch.occurred_at,
    channel: touch.channel,
    source: touch.source,
    source_id: touch.source_id,
    medium: touch.medium,
    campaign: touch.campaign,
    referrer: touch.referrer,
    partner_id: touch.partner_id ?? null,
    creator_id: touch.creator_id ?? null,
    referral_id: touch.referral_id ?? null,
  }
}

function findFirstOfType(touches: TouchRecord[], touchType: TouchRecord['touch_type']) {
  const matches = sortTouches(touches.filter((touch) => touch.touch_type === touchType))
  return matches[0] ?? null
}

function findLastOfType(touches: TouchRecord[], touchType: TouchRecord['touch_type']) {
  const matches = sortTouches(touches.filter((touch) => touch.touch_type === touchType))
  return matches.at(-1) ?? null
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))]
}

export function resolveAcquisitionAttribution(touches: TouchRecord[]): ResolvedAcquisitionAttribution {
  const ordered = sortTouches(touches)
  const firstTouch = findFirstOfType(ordered, 'first_touch') ?? ordered[0] ?? null
  const lastTouch = findLastOfType(ordered, 'last_touch') ?? ordered.at(-1) ?? null
  const latestInteraction = findLastOfType(ordered, 'interaction') ?? ordered.at(-1) ?? null
  const identityAnchor = ordered.at(-1) ?? ordered[0] ?? null

  return {
    first_touch: summarizeTouch(firstTouch),
    last_touch: summarizeTouch(lastTouch),
    latest_interaction: summarizeTouch(latestInteraction),
    interaction_count: ordered.filter((touch) => touch.touch_type === 'interaction').length,
    channels_seen: uniqueValues(ordered.map((touch) => touch.channel)),
    sources_seen: uniqueValues(ordered.map((touch) => touch.source)),
    campaigns_seen: uniqueValues(ordered.map((touch) => touch.campaign)),
    identity: {
      lead_id: identityAnchor?.lead_id ?? null,
      profile_id: identityAnchor?.profile_id ?? null,
      account_id: identityAnchor?.account_id ?? null,
      firebase_uid: identityAnchor?.firebase_uid ?? null,
    },
  }
}
