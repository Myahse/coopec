import { getStoredAuth } from '@/utils/auth-session'

export function getConnectedUserCodeAgence(): string {
  try {
    const u = getStoredAuth()?.user
    if (!u) return ''
    const c = u.codeAgence
    if (typeof c === 'string' && c.trim()) return c.trim()
    if (typeof c === 'number' && Number.isFinite(c)) return String(c)
    return ''
  } catch {
    return ''
  }
}

export function getConnectedUserInstitutionCode(): string {
  try {
    const u = getStoredAuth()?.user
    if (!u) return ''
    const rec = u as Record<string, unknown>
    for (const key of ['institutionCode', 'codeInstitution', 'codeBanque'] as const) {
      const v = rec[key]
      if (typeof v === 'string' && v.trim()) return v.trim()
      if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    }
    return ''
  } catch {
    return ''
  }
}

export function getConnectedUserLogin(): string {
  try {
    const login = getStoredAuth()?.user?.login
    if (typeof login === 'string' && login.trim()) return login.trim()
    return ''
  } catch {
    return ''
  }
}
