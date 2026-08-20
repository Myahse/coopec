import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import type http from 'node:http'

function summarizeLoginBody(buf: Buffer): void {
  try {
    const text = buf.toString('utf8')
    const j = JSON.parse(text) as Record<string, unknown>
    const keys = Object.keys(j)
    console.info(`[vite-proxy] login body keys: ${keys.join(', ') || '(none)'}`)
    const user = j.user
    if (user && typeof user === 'object' && !Array.isArray(user)) {
      console.info(`[vite-proxy] user keys: ${Object.keys(user as object).join(', ')}`)
    }
    const data = j.data
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      console.info(`[vite-proxy] data keys: ${Object.keys(data as object).join(', ')}`)
    }
    for (const [k, v] of Object.entries(j)) {
      if (typeof v !== 'string') continue
      const parts = v.split('.')
      if (parts.length === 3 && v.length >= 40) {
        console.info(`[vite-proxy] JWT-like top-level field: ${k} (len=${v.length})`)
      }
    }
  } catch {
    console.info(`[vite-proxy] login body not JSON (bytes=${buf.length})`)
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim()

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/COOPEC_DEMO': {
          target: 'https://www.djoganapayci.com',
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: 'localhost',
          configure: (proxy) => {
            ;(proxy as any).on('proxyReq', (proxyReq: any) => {
              proxyReq.setHeader('origin', 'https://www.djoganapayci.com')
              proxyReq.setHeader('referer', 'http://localhost:5173/COOPEC_DEMO')
              proxyReq.setHeader('host', 'www.djoganapayci.com')
              proxyReq.setHeader('accept', 'application/json')
              proxyReq.setHeader('content-type', 'application/json')
              proxyReq.setHeader('accept-encoding', 'gzip, deflate, br')
              proxyReq.setHeader('accept-language', 'en-US,en;q=0.9')
              proxyReq.setHeader('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
              proxyReq.setHeader('x-requested-with', 'XMLHttpRequest')
              proxyReq.setHeader('x-csrf-token', '1234567890')
            })
          },
        },
        ...(apiProxyTarget
          ? {
              '/api': {
                target: apiProxyTarget,
                changeOrigin: true,
                secure: false,
                cookieDomainRewrite: 'localhost',
                selfHandleResponse: true,
                configure: (proxy) => {
                  proxy.on('proxyReq', (proxyReq: http.ClientRequest) => {
                    // Required: API returns 403 if Origin is localhost (same as Docker/nginx).
                    proxyReq.setHeader('origin', apiProxyTarget.replace(/\/$/, ''))
                    proxyReq.setHeader('referer', `${apiProxyTarget.replace(/\/$/, '')}/`)
                    proxyReq.setHeader('accept-encoding', 'identity')
                    if (!proxyReq.getHeader('accept')) {
                      proxyReq.setHeader('accept', '*/*')
                    }
                    if (!proxyReq.getHeader('x-requested-with')) {
                      proxyReq.setHeader('x-requested-with', 'XMLHttpRequest')
                    }
                  })

                  proxy.on('proxyRes', (proxyRes: http.IncomingMessage, req, res) => {
                    delete proxyRes.headers['www-authenticate']
                    // Upstream may gzip; we asked for identity, but drop encoding if present.
                    delete proxyRes.headers['content-encoding']
                    delete proxyRes.headers['content-length']

                    const raw = proxyRes.headers['set-cookie']
                    if (raw) {
                      const cookies = Array.isArray(raw) ? raw : [raw]
                      proxyRes.headers['set-cookie'] = cookies.map((cookie) => {
                        let c = String(cookie)
                          .replace(/;\s*Domain=[^;]*/gi, '')
                          .replace(/;\s*Secure/gi, '')
                          .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
                        if (!/;\s*SameSite=/i.test(c)) c += '; SameSite=Lax'
                        if (/;\s*Path=/i.test(c)) c = c.replace(/;\s*Path=[^;]*/gi, '; Path=/')
                        else c += '; Path=/'
                        return c
                      })
                      proxyRes.headers['x-coopec-has-session'] = '1'
                    }

                    const chunks: Buffer[] = []
                    proxyRes.on('data', (chunk: Buffer) => {
                      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
                    })
                    proxyRes.on('end', () => {
                      const buf = Buffer.concat(chunks)
                      const url = String((req as { url?: string }).url ?? '')
                      if (/\/auth\/login/i.test(url)) {
                        const names = raw
                          ? (Array.isArray(raw) ? raw : [raw]).map((c) => String(c).split('=')[0])
                          : []
                        const headerNames = Object.keys(proxyRes.headers)
                        const authHdr = proxyRes.headers['authorization'] || proxyRes.headers['x-access-token'] || proxyRes.headers['x-auth-token']
                        console.info(
                          `[vite-proxy] ${url} → ${proxyRes.statusCode} set-cookie=${names.length ? names.join(',') : '(none)'} authHeader=${Boolean(authHdr)} headers=${headerNames.join(',')}`,
                        )
                        summarizeLoginBody(buf)
                      }

                      res.writeHead(proxyRes.statusCode ?? 500, proxyRes.headers)
                      res.end(buf)
                    })
                    proxyRes.on('error', (err) => {
                      console.error('[vite-proxy] upstream error', err)
                      if (!res.headersSent) res.writeHead(502)
                      res.end('Bad Gateway')
                    })
                  })
                },
              },
            }
          : {}),
      },
    },
  }
})
