export type VerifiedFirebaseToken = {
  uid: string
  email?: string | null
  name?: string | null
  picture?: string | null
  firebase?: {
    sign_in_provider?: string
  }
}

export function parseBearerToken(header: string | null) {
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  return token.length > 0 ? token : null
}

export function buildProfileUpsertInput(token: VerifiedFirebaseToken) {
  return {
    firebase_uid: token.uid,
    email: token.email ?? null,
    display_name: token.name ?? null,
    photo_url: token.picture ?? null,
    auth_provider: token.firebase?.sign_in_provider ?? null,
    last_login_at: new Date().toISOString(),
  }
}
