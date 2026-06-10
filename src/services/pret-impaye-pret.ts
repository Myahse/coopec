import { appendQuery, readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { VImpayePret } from './openapi-components'

export type SearchImpayePretQuery = {
  dateDebut: string
  dateFin: string
  codeAgence?: string
  direction?: string
  institution?: string
}

export type ImpayePretRow = {
  rowKey: string
  refCredit: string
  dateEcheance: string
  montantEcheance: number | undefined
  nomClient: string
  codeAgence: string
  nomCollectrice: string
}

const CUSTOM_PATH = import.meta.env.VITE_PRET_IMPAYE_PRET_PATH as string | undefined

const DEFAULT_PATHS = [
  '/api/pret/impaye-pret',
  '/api/etat/impaye-pret',
  '/api/pret/impayes',
  '/api/pret/impaye',
  '/api/operation/search-impaye-pret',
]

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

export function mapRawToImpayePretRow(
  raw: unknown,
  idx: number,
  agencyLabels: Record<string, string> = {},
): ImpayePretRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as VImpayePret & Record<string, unknown>

  const refCredit = str(r.refCredit ?? r.REF_CREDIT ?? r.reference)
  const dateEcheance = str(r.dateEcheance ?? r.DATE_ECHEANCE ?? r.date)
  const nomClient = str(r.nomClient ?? r.NOM_CLIENT)
  const codeAgenceRaw = str(r.codeAgence ?? r.CODE_AGENCE ?? r.agence)
  const nomCollectrice = str(
    r.nomCollectrice ?? r.NOM_COLLECTRICE ?? r.codeCollectrice ?? r.collecteur,
  )

  if (!refCredit && !dateEcheance && !nomClient) return null

  const codeAgence = agencyLabels[codeAgenceRaw] || codeAgenceRaw

  return {
    rowKey: `${refCredit}|${dateEcheance}|${idx}`,
    refCredit,
    dateEcheance,
    montantEcheance: num(r.montantEcheance ?? r.montant_échéance ?? r.montant_echeance ?? r.MONTANT_ECHEANCE),
    nomClient,
    codeAgence,
    nomCollectrice,
  }
}

/** Impayés prêt — échéances impayées par période et agence. */
export async function searchImpayePret(
  query: SearchImpayePretQuery,
  agencyLabels: Record<string, string> = {},
): Promise<ImpayePretRow[]> {
  const paths = CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_PATHS
  const payload = {
    dateDebut: query.dateDebut,
    dateFin: query.dateFin,
    codeAgence: query.codeAgence,
    agence: query.codeAgence,
    direction: query.direction,
    institution: query.institution,
  }
  const q = { all: 'true', ...payload }

  for (const path of paths) {
    for (const method of ['POST', 'GET'] as const) {
      try {
        const res = await apiFetch(appendQuery(path, method === 'GET' ? q : undefined), {
          method,
          headers:
            method === 'POST'
              ? { 'Content-Type': 'application/json', accept: '*/*' }
              : { accept: '*/*' },
          body: method === 'POST' ? JSON.stringify(payload) : undefined,
        })
        const raw = await readJsonIfOk<unknown>(res, `Impayés prêt failed (${res.status})`)
        const list = extractListFromApiEnvelope(raw)
        const mapped = list
          .map((row, idx) => mapRawToImpayePretRow(row, idx, agencyLabels))
          .filter((r): r is ImpayePretRow => r != null)
        if (mapped.length) return mapped
      } catch {
        /* next */
      }
    }
  }
  return []
}
