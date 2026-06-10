import { appendQuery, readJsonIfOk } from './api-json'
import { searchEtatMontantsCollectes } from './etat-montants-collectes'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { Summary } from './openapi-components'

export type SearchImpayeCollecteQuery = {
  dateDebut: string
  dateFin: string
  codeAgence?: string
  direction?: string
  institution?: string
}

export type ImpayeCollecteRow = {
  rowKey: string
  carte: string
  datePaiement: string
  montantCollecte: number | undefined
  referenceCredit: string
  nomClient: string
  agence: string
  nomCollectrice: string
}

const CUSTOM_PATH = import.meta.env.VITE_PRET_IMPAYE_COLLECTE_PATH as string | undefined

const DEFAULT_POST_PATHS = [
  '/api/pret/impaye-collecte',
  '/api/etat/impaye-collecte',
  '/api/collecte/impayes',
  '/api/collecte/impaye-collecte',
  '/api/operation/search-impaye-collecte',
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

export function mapRawToImpayeCollecteRow(raw: unknown, idx: number): ImpayeCollecteRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Summary & Record<string, unknown>

  const carte = str(r.carte ?? r.CARTE ?? r.numabonnement ?? r.numAbonnement ?? r.numabonnemnt)
  const datePaiement = str(
    r.datePaiement ?? r.DATE_PAIEMENT ?? r.datePaiem ?? r.date0peration ?? r.dateCollecte ?? r.date,
  )
  const referenceCredit = str(
    r.referenceCredit ?? r.REFERENCE_CREDIT ?? r.reference ?? r.refCredit ?? r.clefExtraction,
  )
  const nomClient = str(r.nomClient ?? r.NOM_CLIENT ?? r.client)
  const nomCollectrice = str(
    r.nomCollectrice ?? r.NOM_COLLECTRICE ?? r.nomCollecteur ?? r.collecteur ?? r.leCollecteur,
  )

  if (!carte && !datePaiement && !nomClient && !referenceCredit) return null

  const rowKey = referenceCredit || carte || `impaye-${idx}`

  return {
    rowKey,
    carte,
    datePaiement,
    montantCollecte: num(
      r.montantCollecte ?? r.MONTANT_COLLECTE ?? r.montant ?? r.mtCollecte ?? r.montantCollect,
    ),
    referenceCredit,
    nomClient,
    agence: str(r.agence ?? r.AGENCE ?? r.codeAgence ?? r.nomAgence),
    nomCollectrice,
  }
}

async function tryDedicatedPost(query: SearchImpayeCollecteQuery): Promise<ImpayeCollecteRow[] | null> {
  const paths = CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_POST_PATHS
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
        const raw = await readJsonIfOk<unknown>(res, `Impayés collecte failed (${res.status})`)
        const list = extractListFromApiEnvelope(raw)
        const mapped = list
          .map((row, idx) => mapRawToImpayeCollecteRow(row, idx))
          .filter((r): r is ImpayeCollecteRow => r != null)
        if (mapped.length) return mapped
      } catch {
        /* next */
      }
    }
  }
  return null
}

async function fallbackFromMontantsCollectes(
  query: SearchImpayeCollecteQuery,
  nomAgence: string,
): Promise<ImpayeCollecteRow[]> {
  if (!query.codeAgence) return []
  const rows = await searchEtatMontantsCollectes(
    { codeAgence: query.codeAgence, dateDebut: query.dateDebut, dateFin: query.dateFin },
    {},
  )
  return rows.map((row, idx) =>
    mapRawToImpayeCollecteRow(
      {
        carte: row.numAbonnement,
        datePaiement: row.datePaiem,
        montantCollecte: row.mtCollecte,
        referenceCredit: row.reference,
        nomClient: row.client,
        agence: nomAgence,
        nomCollectrice: row.collecteur,
      },
      idx,
    ),
  ).filter((r): r is ImpayeCollecteRow => r != null)
}

/** Impayés collecte — liste par période et agence. */
export async function searchImpayeCollecte(
  query: SearchImpayeCollecteQuery,
  agencyLabels: Record<string, string> = {},
): Promise<ImpayeCollecteRow[]> {
  const dedicated = await tryDedicatedPost(query)
  if (dedicated?.length) return dedicated

  const code = str(query.codeAgence)
  if (!code) return []

  const nomAgence = agencyLabels[code] || code
  return fallbackFromMontantsCollectes({ ...query, codeAgence: code }, nomAgence)
}
