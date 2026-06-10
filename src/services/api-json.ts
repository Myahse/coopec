  
export function appendQuery(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    qs.set(key, String(value))
  }
  const tail = qs.toString()
  if (!tail) return path
  return `${path}${path.includes('?') ? '&' : '?'}${tail}`
}

export async function parseJsonOrText(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? ''
  return contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text()
}

export function pickErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    for (const key of ['message', 'error', 'detail', 'description', 'title']) {
      const v = o[key]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return fallback
}

export async function readJsonIfOk<T>(res: Response, fallbackError: string): Promise<T> {
  const data = await parseJsonOrText(res)
  if (!res.ok) {
    throw new Error(pickErrorMessage(data, fallbackError))
  }
  return data as T
}
