import { appendQuery, readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'

export type SearchEtatConsolideQuery = {
  dateDebut: string
  dateFin: string
  codeAgence?: string
  direction?: string
  institution?: string
  format?: 'html'
}

export type EtatConsolideResult = {
  html?: string
  url?: string
}

const CUSTOM_PATH = import.meta.env.VITE_ETAT_CONSOLIDE_PATH as string | undefined

const DEFAULT_PATHS = [
  '/api/etat/consolide',
  '/api/etat/etat-consolide',
  '/api/report/consolide',
  '/api/etat/consolides',
  '/api/dashboard/etat-consolide',
]

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
  if (!raw) return ''
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

function buildReportUrl(path: string, query: SearchEtatConsolideQuery): string {
  const base = resolveApiBase()
  const q = {
    dateDebut: query.dateDebut,
    dateFin: query.dateFin,
    codeAgence: query.codeAgence,
    agence: query.codeAgence,
    direction: query.direction,
    institution: query.institution,
    format: query.format ?? 'html',
  }
  const normalized = path.startsWith('/') ? path : `/${path}`
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v) qs.set(k, String(v))
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return `${base}${normalized}${suffix}`
}

function parseJsonPayload(raw: unknown): EtatConsolideResult | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const url = str(r.url ?? r.lien ?? r.link ?? r.href)
  const html = str(r.html ?? r.content ?? r.contenu)
  if (url) return { url }
  if (html) return { html }
  const data = r.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    const dataUrl = str(d.url ?? d.lien ?? d.link)
    const dataHtml = str(d.html ?? d.content)
    if (dataUrl) return { url: dataUrl }
    if (dataHtml) return { html: dataHtml }
  }
  return null
}

/** Récupère le rapport consolidé HTML (contenu ou URL). */
export async function fetchEtatConsolideReport(
  query: SearchEtatConsolideQuery,
): Promise<EtatConsolideResult> {
  const paths = CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_PATHS
  const payload = {
    dateDebut: query.dateDebut,
    dateFin: query.dateFin,
    codeAgence: query.codeAgence,
    agence: query.codeAgence,
    direction: query.direction,
    institution: query.institution,
    format: 'html',
  }
  const q = { ...payload, all: 'true' }

  for (const path of paths) {
    for (const method of ['GET', 'POST'] as const) {
      try {
        const res = await apiFetch(appendQuery(path, method === 'GET' ? q : undefined), {
          method,
          headers:
            method === 'POST'
              ? { 'Content-Type': 'application/json', accept: 'text/html,application/json,*/*' }
              : { accept: 'text/html,application/json,*/*' },
          body: method === 'POST' ? JSON.stringify(payload) : undefined,
        })

        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('text/html')) {
          const html = await res.text()
          if (html.trim()) return { html }
          continue
        }

        const raw = await readJsonIfOk<unknown>(res, `État consolidé failed (${res.status})`)
        const parsed = parseJsonPayload(raw)
        if (parsed) return parsed

        const list = extractListFromApiEnvelope(raw)
        if (list.length === 1) {
          const one = parseJsonPayload(list[0])
          if (one) return one
        }
      } catch {
        /* next */
      }
    }
  }

  const fallbackPath = paths[0] ?? '/api/etat/consolide'
  return { url: buildReportUrl(fallbackPath, query) }
}
