import type { User } from 'firebase/auth'
import { getStoredAcquisitionContext } from './acquisition-browser'

export type SyncedProfile = {
  id: string
  firebase_uid: string
  email: string | null
  display_name: string | null
  photo_url: string | null
  auth_provider: string | null
  last_login_at: string | null
}

export async function syncCurrentFirebaseUser(user: User) {
  const token = await user.getIdToken()
  const acquisition_context = getStoredAcquisitionContext()
  const response = await fetch('/api/auth/sync-profile', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      acquisition_context,
    }),
  })

  if (!response.ok) {
    let message = 'Profile sync failed'

    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) {
        message = payload.error
      }
    } catch {
      void 0
    }

    throw new Error(message)
  }

  const data = (await response.json()) as { profile: SyncedProfile }
  return data.profile
}
