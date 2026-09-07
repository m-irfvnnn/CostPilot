import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function parseServiceAccount() {
  const raw = requireEnv('FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON')
  const parsed = JSON.parse(raw) as {
    projectId?: string
    clientEmail?: string
    privateKey?: string
    project_id?: string
    client_email?: string
    private_key?: string
  }

  const projectId = parsed.projectId ?? parsed.project_id
  const clientEmail = parsed.clientEmail ?? parsed.client_email
  const privateKey = parsed.privateKey ?? parsed.private_key

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Invalid FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON')
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  }
}

export function getFirebaseAdminAuth() {
  if (!getApps().length) {
    const serviceAccount = parseServiceAccount()
    initializeApp({
      credential: cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey.replace(/\\n/g, '\n'),
      }),
    })
  }

  return getAuth()
}
