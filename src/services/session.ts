import { clearAuthSession } from '@/utils/auth-session'

  export async function logout() {

  const logoutUrlRaw = import.meta.env.VITE_LOGOUT_URL as string | undefined
  const logoutUrl = logoutUrlRaw?.trim()
  try {
    if (logoutUrl) {
      const url = logoutUrl.startsWith('/') ? `${window.location.origin}${logoutUrl}` : logoutUrl
      await fetch(url, { method: 'GET', credentials: 'include' })
    }
  } catch {
   
  } finally {
    clearAuthSession()
  }
}

