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

import { getStoredToken, setStoredToken } from '@/utils/auth-session'

export { getStoredToken, setStoredToken }

export async function apiFetch(path: string, init: RequestInit = {}) {
  const apiBase = resolveApiBase()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${apiBase}${normalizedPath}`

  const token = getStoredToken()
  const bearerPayload = token ? credentialWithoutBearerScheme(token) : ''
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (!headers.has('X-Requested-With')) headers.set('X-Requested-With', 'XMLHttpRequest')
  if (bearerPayload && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${bearerPayload}`)
  if (bearerPayload && !headers.has('X-Auth-Token')) headers.set('X-Auth-Token', bearerPayload)

  return fetch(url, {
    credentials: 'include',
    ...init,
    headers,
  })
}
