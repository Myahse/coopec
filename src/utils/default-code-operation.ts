import { getStoredAuth } from '@/utils/auth-session'
  
export function defaultCodeOperationRenvoiParametres(): string {
  const env = (import.meta.env.VITE_CODE_OPERATION as string | undefined)?.trim()
  if (env) return env
  try {
    const parsed = getStoredAuth() as Record<string, unknown> | null
    if (!parsed) return ''
    const top = parsed.codeOperation
    if (typeof top === 'string' && top.trim()) return top.trim()
    const u = parsed.user
    if (u && typeof u === 'object') {
      const co = (u as Record<string, unknown>).codeOperation
      if (typeof co === 'string' && co.trim()) return co.trim()
    }
    return ''
  } catch {
    return ''
  }
}
