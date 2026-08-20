import { resolveAccountDirectionFromApi } from '@/utils/direction-label'
import { resolveAccountProfileLabel } from '@/utils/profile-label'

export type LoginParams = {
  username: string
  password: string
}

export type AuthUser = {
  codeAgence: string
  institutionCode?: string
  codeInstitution?: string
  codeBanque?: string
  email: string
  etat: number
  habilitation: number
  login: string
  nomUtilisateur: string
  profil: number
  libelleProfil?: string
  reinitialisercompte: number
  superviseur: number
  telephone: string
  typeUtilisateur: number
}

export type AuthResponse = {
  isLogin: boolean
  user: AuthUser
}

export type UserContext = {
  name: string
  direction: string
  agency: string
  profile: string
  login: string
  email: string
  telephone: string
}

export type LoginResult = {
  response: Response
  userContext: UserContext
  auth?: AuthResponse
  token?: string
  data: unknown
}

export type ResetPasswordWebBody = {
  codeOperation: string
  codeBanque: string
  login: string
}

export async function resetPasswordWeb(body: ResetPasswordWebBody): Promise<Response> {
  const apiBase = resolveApiBase()
  const url = `${apiBase}/api/auth/reset-password-web`

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? ''
    const data = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text()
    const message =
      (typeof data === 'object' && data && 'message' in data && typeof (data as any).message === 'string'
        ? (data as any).message
        : null) || `Reset password failed (${res.status})`
    throw new Error(message)
  }

  return res
}

function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
  if (!raw) return ''
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

function resolveLoginPath(): string {
  const raw = (import.meta.env.VITE_LOGIN_PATH as string | undefined)?.trim()
  // This app is the WEB interface; default to the WEB login endpoint.
  if (!raw) return '/api/auth/login-web'
  return raw.startsWith('/') ? raw : `/${raw}`
}

function jwtLikeString(value: string): string | undefined {
  const t = value.trim()
  if (t.length < 32) return undefined
  // Emails like a.b@c.com have 3 "." segments — never treat as JWT.
  if (t.includes('@')) return undefined
  const parts = t.split('.')
  if (parts.length !== 3) return undefined
  // Real JWTs use base64url segments.
  const b64url = /^[A-Za-z0-9_-]+$/
  if (parts.every((p) => p.length >= 8 && b64url.test(p))) return t
  return undefined
}

function collectSetCookieHeaders(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    try {
      return headers.getSetCookie()
    } catch {
      // fall through
    }
  }
  const single = res.headers.get('set-cookie')
  return single ? [single] : []
}

function extractTokenFromSetCookie(res: Response): string | undefined {
  const cookieNameRe =
    /^(token|access_token|accessToken|auth_token|authToken|jwt|bearer|session|JSESSIONID|coopec[_-]?token)$/i
  for (const raw of collectSetCookieHeaders(res)) {
    const first = String(raw).split(';')[0] ?? ''
    const eq = first.indexOf('=')
    if (eq <= 0) continue
    const name = first.slice(0, eq).trim()
    const value = first.slice(eq + 1).trim()
    if (!value) continue
    if (cookieNameRe.test(name)) {
      return credentialWithoutBearerScheme(decodeURIComponent(value))
    }
    const asJwt = jwtLikeString(decodeURIComponent(value))
    if (asJwt && asJwt.includes('.')) return asJwt
  }
  return undefined
}

function extractTokenFromResponseHeaders(res: Response): string | undefined {
  const tryAuth = (value: string | null): string | undefined => {
    const v = value?.trim()
    if (!v) return undefined
    const lower = v.toLowerCase()
    if (lower.startsWith('bearer ')) {
      const payload = v.slice('bearer '.length).trim()
      return jwtLikeString(payload) ?? (payload.includes('@') ? undefined : payload || undefined)
    }
    if (lower.startsWith('basic ')) return undefined
    return jwtLikeString(v)
  }

  const named = tryAuth(res.headers.get('authorization') ?? res.headers.get('Authorization'))
  if (named) return named

  for (const key of [
    'x-access-token',
    'access-token',
    'x-auth-token',
    'x-token',
    'jwt',
    'token',
  ] as const) {
    const v = res.headers.get(key)?.trim()
    if (v) {
      const asJwt = jwtLikeString(v)
      if (asJwt) return asJwt
    }
  }

  return extractTokenFromSetCookie(res)
}

function extractTokenFromJsonBody(data: unknown, depth = 0): string | undefined {
  if (depth > 12 || data == null) return undefined

  if (typeof data === 'string') {
    const t = data.trim()
    if (!t) return undefined
    if (/^Bearer\s+/i.test(t)) return t.replace(/^Bearer\s+/i, '').trim()
    return jwtLikeString(t)
  }

  if (typeof data === 'number' && Number.isFinite(data)) {
    return undefined
  }

  if (typeof data !== 'object') return undefined

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractTokenFromJsonBody(item, depth + 1)
      if (found) return found
    }
    return undefined
  }

  const record = data as Record<string, unknown>
  const keyRe =
    /^(token|accessToken|access_token|jwt|jwttoken|jwtToken|idToken|id_token|bearer|authToken|auth_token|bearerToken|access|jeton|sessionToken|session_token|authorization|Authorization|clef|cleSession|idSession|sessionId)$/i

  for (const [k, v] of Object.entries(record)) {
    if (typeof v === 'string' && keyRe.test(k)) {
      const raw = v.trim()
      if (!raw || raw.includes('@')) continue
      if (/^Bearer\s+/i.test(raw)) {
        const payload = raw.replace(/^Bearer\s+/i, '').trim()
        if (payload && !payload.includes('@')) return payload
        continue
      }
      const fromKey = jwtLikeString(raw)
      if (fromKey) return fromKey
    }
    // Any JWT-shaped string anywhere in the payload (regardless of key name).
    if (typeof v === 'string') {
      const asJwt = jwtLikeString(v)
      if (asJwt && asJwt.split('.').length === 3) return asJwt
    }
    const nested = extractTokenFromJsonBody(v, depth + 1)
    if (nested) return nested
  }

  return undefined
}

/** Marker when API authenticates via cookie only (no Bearer in body/headers). */
export const COOKIE_SESSION_TOKEN = '__coopec_cookie_session__'

function credentialWithoutBearerScheme(raw: string): string {
  const t = raw.trim()
  const m = /^Bearer\s+(.+)$/i.exec(t)
  return (m ? m[1] : t).trim()
}

export async function login(params: LoginParams): Promise<LoginResult> {
  const apiBase = resolveApiBase()
  const url = `${apiBase}${resolveLoginPath()}`
  const username = String(params.username ?? '').trim()
  const password = String(params.password ?? '')

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    // Some backends expect `login`, OpenAPI uses `username` — send both.
    body: JSON.stringify({ username, password, login: username }),
  })

  const contentType = res.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text()

  let token = extractTokenFromResponseHeaders(res)

  if (!res.ok) {
    const message =
      (typeof data === 'object' && data && 'message' in data && typeof (data as any).message === 'string'
        ? (data as any).message
        : null) ||
      `Login failed (${res.status})`
    throw new Error(message)
  }

  let auth: AuthResponse | undefined
  const root =
    typeof data === 'object' && data && !Array.isArray(data) ? (data as Record<string, unknown>) : null
  const nested =
    root?.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null

  const authPayload =
    root && root.user != null && typeof root.user === 'object'
      ? root
      : nested && nested.user != null && typeof nested.user === 'object'
        ? nested
        : null

  const explicitFail =
    (root && (root.isLogin === false || root.isLogin === 'false' || root.isLogin === 0 || root.isLogin === '0')) ||
    (root && (root.user === null || root.user === undefined) && !token)

  if (explicitFail && !authPayload) {
    const msg =
      (typeof root?.message === 'string' && root.message.trim()) ||
      (typeof nested?.message === 'string' && String(nested.message).trim()) ||
      'Identifiants invalides'
    throw new Error(msg)
  }

  if (authPayload?.user && typeof authPayload.user === 'object') {
    const isLogin = authPayload.isLogin
    const rejected =
      isLogin === false || isLogin === 'false' || isLogin === 0 || isLogin === '0'
    if (rejected) throw new Error('Identifiants invalides')
    auth = { isLogin: true, user: authPayload.user as AuthUser }
  }

  if (!token && typeof data === 'object' && data) {
    token = extractTokenFromJsonBody(data)
  }

  // Optional: mark cookie-backed session when proxy rewrote Set-Cookie.
  const hasSessionCookie =
    res.headers.get('x-coopec-has-session') === '1' || collectSetCookieHeaders(res).length > 0
  if (!token?.trim() && auth?.user && hasSessionCookie) {
    token = COOKIE_SESSION_TOKEN
  }

  try {
    const rootKeys =
      typeof data === 'object' && data && !Array.isArray(data)
        ? Object.keys(data as object)
        : []
    const userKeys =
      auth?.user && typeof auth.user === 'object' ? Object.keys(auth.user as object) : []
    console.info('[coopec login]', {
      hasToken: Boolean(token?.trim()),
      hasSessionCookie,
      rootKeys,
      userKeys,
    })
  } catch {
    // ignore
  }

  function profileLabelFromAuthUser(u: AuthUser): string {
    return resolveAccountProfileLabel(u as Record<string, unknown>)
  }

  const userContext: UserContext = auth?.user
    ? {
        name: String(auth.user.nomUtilisateur ?? auth.user.login ?? username ?? 'Utilisateur'),
        direction: resolveAccountDirectionFromApi(auth.user as Record<string, unknown>),
        agency: String(auth.user.codeAgence ?? '—'),
        profile: profileLabelFromAuthUser(auth.user),
        login: String(auth.user.login ?? '—'),
        email: String(auth.user.email ?? '—'),
        telephone: String(auth.user.telephone ?? '—'),
      }
    : (typeof data === 'object' &&
      data &&
      'userContext' in data &&
      typeof (data as any).userContext === 'object' &&
      (data as any).userContext
        ? {
            name: String((data as any).userContext.name ?? username ?? 'Utilisateur'),
            direction: resolveAccountDirectionFromApi(
              (data as any).userContext as Record<string, unknown> | undefined,
              String((data as any).userContext?.direction ?? ''),
            ),
            agency: String((data as any).userContext.agency ?? '—'),
            profile: resolveAccountProfileLabel(
              (data as any).userContext as Record<string, unknown> | undefined,
              String((data as any).userContext?.profile ?? ''),
            ),
            login: String((data as any).userContext.login ?? username ?? '—'),
            email: String((data as any).userContext.email ?? '—'),
            telephone: String((data as any).userContext.telephone ?? '—'),
          }
        : {
            name: username || 'Utilisateur',
            direction: '—',
            agency: '—',
            profile: '—',
            login: username || '—',
            email: '—',
            telephone: '—',
          })

  return { response: res, userContext, auth, token, data }
}

