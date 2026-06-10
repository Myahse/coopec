import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_TARGET = (
  process.env.API_PROXY_TARGET || 'https://coopeccollect.djogana-pay.com:9091'
).replace(/\/$/, '')

const SKIP_REQ_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'origin',
  'referer',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-for',
  'x-real-ip',
])

function rewriteSetCookie(cookie: string): string {
  let c = cookie
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;\s*Secure/gi, '')
    .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
  if (/;\s*Path=/i.test(c)) c = c.replace(/;\s*Path=[^;]*/gi, '; Path=/')
  else c += '; Path=/'
  return c
}

function collectSetCookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().map(rewriteSetCookie)
  }
  const single = headers.get('set-cookie')
  return single ? [rewriteSetCookie(single)] : []
}

function resolveApiSubpath(req: VercelRequest): string {
  const pathParam = req.query.path
  if (pathParam) {
    return Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam)
  }
  const incoming = new URL(req.url || '/', 'http://localhost')
  return incoming.pathname.replace(/^\/api\/?/, '')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const subpath = resolveApiSubpath(req)
  const incoming = new URL(req.url || '/', 'http://localhost')
  const backendSearch = new URLSearchParams(incoming.search)
  backendSearch.delete('path')
  const qs = backendSearch.toString()
  const targetUrl = `${API_TARGET}/api/${subpath}${qs ? `?${qs}` : ''}`

  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (SKIP_REQ_HEADERS.has(key.toLowerCase())) continue
    if (value === undefined) continue
    headers[key] = Array.isArray(value) ? value.join(', ') : value
  }

  headers.origin = API_TARGET
  headers.referer = `${API_TARGET}/`
  if (!headers.accept) headers.accept = '*/*'
  if (!headers['x-requested-with']) headers['x-requested-with'] = 'XMLHttpRequest'

  let body: string | undefined
  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    if (typeof req.body === 'string') body = req.body
    else if (req.body !== undefined && req.body !== null) body = JSON.stringify(req.body)
  }

  const upstream = await fetch(targetUrl, {
    method: req.method ?? 'GET',
    headers,
    body,
  })

  res.status(upstream.status)

  const cookies = collectSetCookies(upstream.headers)
  if (cookies.length) res.setHeader('set-cookie', cookies)

  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (k === 'transfer-encoding' || k === 'connection' || k === 'set-cookie') return
    res.setHeader(key, value)
  })

  const buffer = Buffer.from(await upstream.arrayBuffer())
  res.send(buffer)
}
