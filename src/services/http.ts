function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
  if (!raw) return ''
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

function credentialWithoutBearerScheme(raw: string): string {
  const t = raw.trim()
  const m = /^Bearer\s+(.+)$/i.exec(t)
  return (m ? m[1] : t).trim()
}

function isPlausibleBearerToken(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (t.includes('@')) return false
  if (t.startsWith('__coopec_')) return false
  // Prefer real JWTs; ignore short / email-like garbage stored as "token".
  const parts = t.split('.')
  if (parts.length === 3) {
    const b64url = /^[A-Za-z0-9_-]+$/
    return parts.every((p) => p.length >= 8 && b64url.test(p))
  }
  return t.length >= 24
}

import {
  getStoredBasicAuthorization,
  getStoredToken,
  setStoredToken,
} from '@/utils/auth-session'
import { COOKIE_SESSION_TOKEN } from '@/services/auth'

export { getStoredToken, setStoredToken }

export async function apiFetch(path: string, init: RequestInit = {}) {
  const apiBase = resolveApiBase()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${apiBase}${normalizedPath}`

  const token = getStoredToken()
  const raw = token ? credentialWithoutBearerScheme(token) : ''
  let bearerPayload =
    raw && raw !== COOKIE_SESSION_TOKEN && isPlausibleBearerToken(raw) ? raw : ''
  if (token && !bearerPayload) {
    // Drop bad values like "Bearer user@email.com" left from older extraction.
    setStoredToken(null)
  }

  const basic = getStoredBasicAuthorization()
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (!headers.has('X-Requested-With')) headers.set('X-Requested-With', 'XMLHttpRequest')
  if (!headers.has('Authorization')) {
    if (bearerPayload) {
      headers.set('Authorization', `Bearer ${bearerPayload}`)
      headers.set('X-Auth-Token', bearerPayload)
    } else if (basic) {
      // Same as Swagger when the browser has saved HTTP Basic for the API host.
      headers.set('Authorization', basic)
    }
  }

  return fetch(url, {
    credentials: 'include',
    ...init,
    headers,
  })
}
