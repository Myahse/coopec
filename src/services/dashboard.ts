import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { apiFetch } from './http'
import type { Summary } from './openapi-components'

function explicitMontantsPath(): string | null {
  const raw = (import.meta.env.VITE_DASHBOARD_COLLECTE_MONTANTS_PATH as string | undefined)?.trim()
  if (!raw) return null
  return raw.startsWith('/') ? raw : `/${raw}`
}

function toQueryString(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

async function parseJsonOrText(res: Response) {
  const contentType = res.headers.get('content-type') ?? ''
  return contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text()
}

function pickErrorMessage(data: unknown, fallback: string) {
  return (typeof data === 'object' &&
    data &&
    'message' in data &&
    typeof (data as { message?: string }).message === 'string' &&
    (data as { message?: string }).message) ||
    fallback
}

export type DashboardMontantsCollectesQuery = {
  direction?: string
  agence?: string
  institution?: string
  search?: string
  all?: boolean
}

async function fetchMontantsHttp(
  path: string,
  query: DashboardMontantsCollectesQuery,
  search: string,
): Promise<Summary[]> {
  const res = await apiFetch(
    `${path}${toQueryString({
      direction: query.direction,
      agence: query.agence,
      institution: query.institution,
      all: query.all ? 'true' : undefined,
      ...(search ? { search } : {}),
    })}`,
    { method: 'GET', headers: { accept: '*/*' } },
  )

  const data = await parseJsonOrText(res)
  if (!res.ok) throw new Error(pickErrorMessage(data, `Get montants collectés failed (${res.status})`))
  const list = extractListFromApiEnvelope(data)
  return list.filter((r) => r && typeof r === 'object') as Summary[]
}


export async function getDashboardMontantsCollectes(
  query: DashboardMontantsCollectesQuery = {},
): Promise<Summary[]> {
  const search = String(query.search ?? '').trim()
  const customPath = explicitMontantsPath()
  if (!customPath) return []
  return fetchMontantsHttp(customPath, query, search)
}
