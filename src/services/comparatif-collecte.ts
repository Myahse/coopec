import { readJsonIfOk } from './api-json'
import { getAgencesByDirection } from './direction-regionale'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { agencyCode } from '@/utils/organization-filters'

export type SearchComparatifCollecteBody = {
  dateDebut: string
  dateFin: string
  codeAgence?: string
  codeDir?: string
  agencyCodes?: string[]
  direction?: string
}

export type ComparatifCollectePeriodeTotals = {
  totalMontant: number
  totalCommision: number
}

export type ComparatifCollecteRow = {
  rowKey: string
  codeClient: string
  login: string
  nomCollecteur: string
  totalCartes: number
  totalClients: number
  collecteCourant: number
  commissionCourant: number
  collecteM1: number | undefined
  commissionM1: number | undefined
}

const CUSTOM_PATH = import.meta.env.VITE_COMPARATIF_COLLECTE_PATH as string | undefined

const OFFICIAL_POST_PATH = '/api/etat-operation/compratif-collecte'

const DEFAULT_POST_PATHS = [
  OFFICIAL_POST_PATH,
  '/api/etat/comparatif-collecte',
  '/api/etat-operation/comparatif-collecte',
  '/api/collecte/comparatif',
]

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function readPeriodeTotals(
  periode: unknown,
  key: 'CURRENT' | 'PREVIOUS_MONTH',
): ComparatifCollectePeriodeTotals | undefined {
  if (!periode || typeof periode !== 'object') return undefined
  const block = (periode as Record<string, unknown>)[key]
  if (!block || typeof block !== 'object') return undefined
  const b = block as Record<string, unknown>
  return {
    totalMontant: num(b.totalMontant ?? b.montant ?? b.montantCollecte),
    totalCommision: num(
      b.totalCommision ?? b.totalCommission ?? b.commission ?? b.montantCommission,
    ),
  }
}

export function mapRawToComparatifCollecteRow(raw: unknown, idx: number): ComparatifCollecteRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const login = str(r.login ?? r.loginCollecteur)
  const codeClient = str(r.codeClient ?? r.codeclient)
  const nomCollecteur = str(r.nomCollecteur ?? r.collecteur ?? r.nom)
  if (!login && !codeClient && !nomCollecteur) return null

  const current = readPeriodeTotals(r.periode, 'CURRENT')
  const previous = readPeriodeTotals(r.periode, 'PREVIOUS_MONTH')

  return {
    rowKey: login || codeClient || `row-${idx}`,
    codeClient,
    login,
    nomCollecteur: nomCollecteur || '—',
    totalCartes: num(r.totalCartes ?? r.nombreCartes ?? r.cartes),
    totalClients: num(r.totalClients ?? r.nombreClients ?? r.clients),
    collecteCourant: current?.totalMontant ?? 0,
    commissionCourant: current?.totalCommision ?? 0,
    collecteM1: previous?.totalMontant,
    commissionM1: previous?.totalCommision,
  }
}

function mapResponseList(raw: unknown): ComparatifCollecteRow[] {
  const list = extractListFromApiEnvelope(raw)
  return list
    .map((row, idx) => mapRawToComparatifCollecteRow(row, idx))
    .filter((r): r is ComparatifCollecteRow => r != null)
}

function buildOfficialPostBody(codeAgence: string, body: SearchComparatifCollecteBody) {
  return {
    codeAgence,
    codeDir: str(body.codeDir ?? body.direction),
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
  }
}

async function resolveAgencyCodes(body: SearchComparatifCollecteBody): Promise<string[]> {
  const fromList = (body.agencyCodes ?? []).map((c) => c.trim()).filter(Boolean)
  const unique = [...new Set(fromList)]
  if (unique.length) return unique

  const single = str(body.codeAgence)
  if (single) return [single]

  const codeDir = str(body.codeDir ?? body.direction)
  if (!codeDir) return []

  try {
    const env = await getAgencesByDirection(codeDir)
    const list = extractListFromApiEnvelope(env)
    const codes = list
      .map((row) => agencyCode(row as Record<string, unknown>))
      .filter(Boolean)
    return [...new Set(codes)]
  } catch {
    return []
  }
}

async function tryOfficialPost(
  body: SearchComparatifCollecteBody,
): Promise<ComparatifCollecteRow[] | null> {
  const codeDir = str(body.codeDir ?? body.direction)
  const agencies = await resolveAgencyCodes(body)
  if (!agencies.length) return codeDir ? [] : null

  const results = await Promise.all(
    agencies.map(async (codeAgence) => {
      try {
        const res = await apiFetch(OFFICIAL_POST_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', accept: '*/*' },
          body: JSON.stringify(buildOfficialPostBody(codeAgence, body)),
        })
        const raw = await readJsonIfOk<unknown>(res, `Comparatif collecte failed (${res.status})`)
        return mapResponseList(raw)
      } catch {
        return null
      }
    }),
  )

  const anySuccess = results.some((r) => r !== null)
  if (!anySuccess) return null

  const merged = results.flatMap((r) => r ?? [])
  const seen = new Set<string>()
  return merged.filter((row) => {
    if (seen.has(row.rowKey)) return false
    seen.add(row.rowKey)
    return true
  })
}

async function tryLegacyPost(body: SearchComparatifCollecteBody): Promise<ComparatifCollecteRow[] | null> {
  const paths = (CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_POST_PATHS).filter(
    (p) => p !== OFFICIAL_POST_PATH,
  )
  const codeAgence = str(body.codeAgence ?? body.agencyCodes?.[0])

  for (const path of paths) {
    try {
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({
          codeAgence,
          codeDir: str(body.codeDir ?? body.direction),
          dateDebut: body.dateDebut,
          dateFin: body.dateFin,
        }),
      })
      const raw = await readJsonIfOk<unknown>(res, `Comparatif collecte failed (${res.status})`)
      const mapped = mapResponseList(raw)
      if (mapped.length) return mapped
    } catch {
      /* next */
    }
  }
  return null
}

/** Comparatif collecte par collecteur — période courante vs mois précédent. */
export async function searchComparatifCollecte(
  body: SearchComparatifCollecteBody,
): Promise<ComparatifCollecteRow[]> {
  const official = await tryOfficialPost(body)
  if (official !== null) return official

  const legacy = await tryLegacyPost(body)
  if (legacy !== null) return legacy

  return []
}
