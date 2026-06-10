/** Single-object payload from `{ data, success, message }` envelopes. */
export function extractDataFromApiEnvelope<T>(env: unknown): T | null {
  if (!env || typeof env !== 'object') return null
  const o = env as Record<string, unknown>
  if (o.data === undefined || o.data === null) return null
  return o.data as T
}

/** Normalize list payloads */
export function extractListFromApiEnvelope(env: unknown): unknown[] {
  if (Array.isArray(env)) return env
  if (!env || typeof env !== 'object') return []
  const o = env as Record<string, unknown>
  if (Array.isArray(o.data)) return o.data
  if (Array.isArray(o.content)) return o.content
  if (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) {
    const nested = o.data as Record<string, unknown>
    if (Array.isArray(nested.content)) return nested.content
    if (Array.isArray(nested.data)) return nested.data
  }
  return []
}
