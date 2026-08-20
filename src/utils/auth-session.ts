import type { AuthResponse, AuthUser, UserContext } from '@/services/auth'

const AUTH_KEY = 'coopec_auth'
const USER_KEY = 'coopec_user'
const TOKEN_KEY = 'coopec_token'
const BASIC_KEY = 'coopec_basic'
const REMEMBER_SESSION_KEY = 'coopec_remember_session'

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  sessionStorage.setItem(key, value)
  localStorage.setItem(key, value)
}

function removeStorage(key: string): void {
  sessionStorage.removeItem(key)
  localStorage.removeItem(key)
}

function unwrapAuthPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.user && typeof o.user === 'object') return o
  const nested = o.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const inner = nested as Record<string, unknown>
    if (inner.user && typeof inner.user === 'object') return inner
  }
  return null
}

function parseAuth(raw: string | null): AuthResponse | null {
  if (!raw) return null
  try {
    const parsed = unwrapAuthPayload(JSON.parse(raw))
    if (!parsed?.user || typeof parsed.user !== 'object') return null
    const isLogin = parsed.isLogin
    const loggedIn =
      isLogin === true ||
      isLogin === 'true' ||
      isLogin === 1 ||
      isLogin === '1' ||
      isLogin === undefined
    if (isLogin === false || isLogin === 'false' || isLogin === 0 || isLogin === '0') return null
    return {
      isLogin: loggedIn,
      user: parsed.user as AuthUser,
    }
  } catch {
    return null
  }
}

export function getStoredToken(): string | null {
  try {
    const raw = readStorage(TOKEN_KEY)
    return raw?.trim() || null
  } catch {
    return null
  }
}

/** Basic auth header value (`Basic …`) — session only (Swagger-style, no prompt). */
export function getStoredBasicAuthorization(): string | null {
  try {
    return sessionStorage.getItem(BASIC_KEY)?.trim() || null
  } catch {
    return null
  }
}

export function setStoredBasicAuthorization(username: string, password: string): void {
  try {
    const user = username.trim()
    if (!user) {
      sessionStorage.removeItem(BASIC_KEY)
      return
    }
    const raw = `${user}:${password}`
    const bytes = new TextEncoder().encode(raw)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
    sessionStorage.setItem(BASIC_KEY, `Basic ${btoa(bin)}`)
  } catch {
    // ignore
  }
}

export function clearStoredBasicAuthorization(): void {
  try {
    sessionStorage.removeItem(BASIC_KEY)
  } catch {
    // ignore
  }
}

export function isRememberSessionEnabled(): boolean {
  try {
    return localStorage.getItem(REMEMBER_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function setRememberSessionFlag(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(REMEMBER_SESSION_KEY, '1')
    else localStorage.removeItem(REMEMBER_SESSION_KEY)
  } catch {
    // ignore
  }
}

function clearPersistedAuthStorage(): void {
  try {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

/** Keep localStorage session when auth or token was saved (persistent login). */
export function sanitizePersistedAuth(): void {
  try {
    const hasAuth = Boolean(localStorage.getItem(AUTH_KEY))
    const hasUser = Boolean(localStorage.getItem(USER_KEY))
    const hasToken = Boolean(localStorage.getItem(TOKEN_KEY))
    if (hasAuth || hasUser || hasToken) {
      setRememberSessionFlag(true)
      return
    }
  } catch {
    // ignore
  }
  if (isRememberSessionEnabled()) return
  clearPersistedAuthStorage()
}

export function hydrateSessionFromRememberedAuth(): void {
  try {
    const auth = localStorage.getItem(AUTH_KEY)
    const user = localStorage.getItem(USER_KEY)
    const token = localStorage.getItem(TOKEN_KEY)
    if (!auth && !user && !token) return
    setRememberSessionFlag(true)
    if (auth) writeStorage(AUTH_KEY, auth)
    if (user) writeStorage(USER_KEY, user)
    if (token) writeStorage(TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export function getStoredAuth(): AuthResponse | null {
  return parseAuth(readStorage(AUTH_KEY))
}

export function getStoredUserContext(): UserContext | null {
  try {
    const raw = readStorage(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserContext
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  // Same as before: profile session is enough to enter the app shell.
  if (getStoredAuth() != null) return true
  if (getStoredToken()) return true
  return getStoredUserContext() != null
}

export function setAuthSession(
  auth: AuthResponse,
  userContext: UserContext,
  token?: string | null,
): void {
  const authRaw = JSON.stringify(auth)
  const userRaw = JSON.stringify(userContext)

  writeStorage(AUTH_KEY, authRaw)
  writeStorage(USER_KEY, userRaw)
  setRememberSessionFlag(true)

  if (token?.trim()) writeStorage(TOKEN_KEY, token.trim())
  else removeStorage(TOKEN_KEY)
}

export function setStoredToken(token: string | null): void {
  try {
    if (!token?.trim()) {
      removeStorage(TOKEN_KEY)
      return
    }
    writeStorage(TOKEN_KEY, token.trim())
    setRememberSessionFlag(true)
  } catch {
    // ignore
  }
}

export function clearAuthSession(): void {
  try {
    removeStorage(AUTH_KEY)
    removeStorage(USER_KEY)
    removeStorage(TOKEN_KEY)
  } catch {
    // ignore
  }
  clearStoredBasicAuthorization()
  setRememberSessionFlag(false)
  clearPersistedAuthStorage()
}
