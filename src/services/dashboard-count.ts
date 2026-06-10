import { extractListFromApiEnvelope } from '@/utils/api-envelope'

function pickFiniteNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = source[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(String(v).replace(/\s+/g, '').replace(',', '.'))
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

const COUNT_KEYS = [
  'totalElements',
  'total',
  'totalCount',
  'count',
  'nombre',
  'nombreClientsInactifs',
  'clientInactifs',
  'clientsInactifs',
  'clientInactif',
  'nombreCollecteurs',
  'nombreCollecteursTotal',
  'collecteursTotal',
  'totalCollecteurs',
  'collecteurTotal',
] as const

/** Extrait un compteur depuis une réponse paginée ou un nombre direct. */
export function extractDashboardCount(data: unknown): number | null {
  if (typeof data === 'number' && Number.isFinite(data)) return data

  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>

  const direct = pickFiniteNumber(root, [...COUNT_KEYS])
  if (direct !== null) return direct

  for (const nested of [root.data, root.result, root.payload, root.stats]) {
    if (typeof nested === 'number' && Number.isFinite(nested)) return nested
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue
    const inner = nested as Record<string, unknown>
    const fromInner = pickFiniteNumber(inner, [...COUNT_KEYS])
    if (fromInner !== null) return fromInner
  }

  const list = extractListFromApiEnvelope(data)
  if (list.length > 0) {
    const fromRoot = pickFiniteNumber(root, ['size', 'totalElements', 'total'])
    if (fromRoot !== null && fromRoot >= list.length) return fromRoot
    return list.length
  }

  return null
}
