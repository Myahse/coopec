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
  const parts = t.split('.')
  if (parts.length !== 3 || parts.some((p) => !p.length)) return undefined
  return t
}

function extractTokenFromResponseHeaders(res: Response): string | undefined {
  const tryAuth = (value: string | null): string | undefined => {
    const v = value?.trim()
    if (!v) return undefined
    const lower = v.toLowerCase()
    if (lower.startsWith('bearer ')) return v.slice('bearer '.length).trim() || undefined
    return jwtLikeString(v) ?? v
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
    if (v) return jwtLikeString(v) ?? v
  }

  return undefined
}

function extractTokenFromJsonBody(data: unknown, depth = 0): string | undefined {
  if (depth > 10 || data == null) return undefined

  if (typeof data === 'string') {
    return jwtLikeString(data)
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
    /^(token|accessToken|access_token|jwt|idToken|id_token|bearer|authToken|auth_token|bearerToken|access)$/i

  for (const [k, v] of Object.entries(record)) {
    if (typeof v === 'string' && keyRe.test(k)) {
      const fromKey = jwtLikeString(v) ?? v.trim()
      if (fromKey) return fromKey
    }
    const nested = extractTokenFromJsonBody(v, depth + 1)
    if (nested) return nested
  }

  return undefined
}

export async function login(params: LoginParams): Promise<LoginResult> {
  const apiBase = resolveApiBase()
  const url = `${apiBase}${resolveLoginPath()}`

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
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
  const authPayload =
    typeof data === 'object' && data
      ? (() => {
          const o = data as Record<string, unknown>
          if (o.user && typeof o.user === 'object') return o
          const nested = o.data
          if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
            const inner = nested as Record<string, unknown>
            if (inner.user && typeof inner.user === 'object') return inner
          }
          return null
        })()
      : null

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

  function profileLabelFromAuthUser(u: AuthUser): string {
    return resolveAccountProfileLabel(u as Record<string, unknown>)
  }

  const userContext: UserContext = auth?.user
    ? {
        name: String(auth.user.nomUtilisateur ?? auth.user.login ?? params.username ?? 'Utilisateur'),
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
            name: String((data as any).userContext.name ?? params.username ?? 'Utilisateur'),
            direction: resolveAccountDirectionFromApi(
              (data as any).userContext as Record<string, unknown> | undefined,
              String((data as any).userContext?.direction ?? ''),
            ),
            agency: String((data as any).userContext.agency ?? '—'),
            profile: resolveAccountProfileLabel(
              (data as any).userContext as Record<string, unknown> | undefined,
              String((data as any).userContext?.profile ?? ''),
            ),
            login: String((data as any).userContext.login ?? params.username ?? '—'),
            email: String((data as any).userContext.email ?? '—'),
            telephone: String((data as any).userContext.telephone ?? '—'),
          }
        : {
            name: params.username || 'Utilisateur',
            direction: '—',
            agency: '—',
            profile: '—',
            login: params.username || '—',
            email: '—',
            telephone: '—',
          })

  return { response: res, userContext, auth, token, data }
}

