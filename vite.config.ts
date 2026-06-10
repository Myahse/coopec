import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import type http from 'node:http'

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
              proxyReq.setHeader('referer', 'https://www.djoganapayci.com/COOPEC_DEMO')
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
                // Allow self-signed / misconfigured certs in dev proxy
                secure: false,
                cookieDomainRewrite: 'localhost',
                // Session cookies from login are often scoped to a narrow Path (e.g. /api/auth) or marked
                // Secure+SameSite=None; that breaks follow-up calls from http://localhost. Normalize for dev.
                configure: (proxy) => {
                  proxy.on('proxyRes', (proxyRes: http.IncomingMessage) => {
                    const raw = proxyRes.headers['set-cookie']
                    if (!raw) return
                    const cookies = Array.isArray(raw) ? raw : [raw]
                    proxyRes.headers['set-cookie'] = cookies.map((cookie) => {
                      let c = String(cookie)
                        .replace(/;\s*Secure/gi, '')
                        .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
                      if (/;\s*Path=/i.test(c)) c = c.replace(/;\s*Path=[^;]*/gi, '; Path=/')
                      else c += '; Path=/'
                      return c
                    })
                  })
                  proxy.on('proxyReq', (proxyReq: http.ClientRequest) => {
                    proxyReq.setHeader('origin', apiProxyTarget)
                    proxyReq.setHeader('referer', `${apiProxyTarget}/`)
                    if (!proxyReq.getHeader('accept')) {
                      proxyReq.setHeader('accept', '*/*')
                    }
                  })
                },
              },
            }
          : {}),
      },
    },
  }
})

