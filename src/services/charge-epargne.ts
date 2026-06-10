import { appendQuery, readJsonIfOk } from './api-json'
import { getAgencesByDirection } from './direction-regionale'
import { searchEtatMontantsCollectes } from './etat-montants-collectes'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { agencyCode } from '@/utils/organization-filters'
import type { Summary } from './openapi-components'

export type SearchChargeEpargneBody = {
  dateDebut: string
  dateFin: string
  codeAgence?: string
  codeDir?: string
  agencyCodes?: string[]
  direction?: string
}

export type SearchChargeEpargneQuery = {
  collecteur?: string
  client?: string
  carte?: string
  idTypeCollect?: string
  typeCollect?: string
  codeOper?: string
}

export type ChargeEpargneRow = {
  rowKey: string
  nomAgence: string
  codeAgence: string
  datePaie: string
  totalTransactions: number
  totalMontant: number
}

const CUSTOM_PATH = import.meta.env.VITE_CHARGE_EPARGNE_PATH as string | undefined

const OFFICIAL_POST_PATH = '/api/etat-operation/charge-epargne'

const DEFAULT_POST_PATHS = [
  OFFICIAL_POST_PATH,
  '/api/operation/search-charge-epargne',
  '/api/etat/charge-epargne',
  '/api/collecte/charge-epargne',
  '/api/dashboard/charge-epargne',
]

function isOfficialChargeEpargnePath(path: string): boolean {
  const p = path.trim().toLowerCase()
  return p === OFFICIAL_POST_PATH || p.endsWith('/etat-operation/charge-epargne')
}

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

function toIsoDateKey(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  try {
    const d = new Date(s.includes('T') ? s : `${s}T12:00:00`)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch {
    /* keep */
  }
  return s
}

function buildOfficialPostBody(codeAgence: string, body: SearchChargeEpargneBody) {
  return {
    codeAgence,
    codeDir: str(body.codeDir ?? body.direction),
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
  }
}

function buildLegacyPostBody(body: SearchChargeEpargneBody, query: SearchChargeEpargneQuery) {
  const typeId = str(query.idTypeCollect ?? query.typeCollect)
  const codeOper = str(query.codeOper)
  const codeDir = str(body.codeDir ?? body.direction)
  const codeAgence = str(body.codeAgence ?? body.agencyCodes?.[0])
  return {
    codeAgence,
    agence: codeAgence,
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    ...(codeDir ? { codeDir, codeDirection: codeDir, direction: codeDir } : {}),
    ...(typeId ? { idTypeCollect: typeId, typeCollect: typeId } : {}),
    ...(codeOper ? { codeOper } : {}),
    ...(query.client ? { client: query.client, nomClient: query.client } : {}),
    ...(query.collecteur ? { collecteur: query.collecteur, loginCollecteur: query.collecteur } : {}),
    ...(query.carte ? { carte: query.carte, numCarte: query.carte } : {}),
    agencyCodes: body.agencyCodes,
  }
}

function buildQueryParams(query: SearchChargeEpargneQuery): Record<string, string | undefined> {
  const typeId = str(query.idTypeCollect ?? query.typeCollect)
  return {
    all: 'true',
    collecteur: query.collecteur,
    client: query.client,
    search: query.client,
    carte: query.carte,
    idTypeCollect: typeId || undefined,
    typeCollect: typeId || undefined,
    codeOper: query.codeOper,
  }
}

export function mapRawToChargeEpargneRow(
  raw: unknown,
  idx: number,
  agencyLabel?: string,
): ChargeEpargneRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Summary & Record<string, unknown>

  const codeAgence = str(r.codeAgence ?? r.agence ?? r.codeagence)
  const nomAgence =
    str(r.nomAgence ?? r.nomagence ?? r.libelleAgence ?? r.nom ?? agencyLabel) || codeAgence

  const totalTransactions = num(
    r.totalTransactions ?? r.count ?? r.nombre ?? r.nb ?? r.nbr ?? r.totalTransaction,
  )
  const totalMontant = num(
    r.totalMontant ??
      r.chargeEpargne ??
      r.chargesEpargne ??
      r.charge_epargne ??
      r.montantCollecte ??
      r.montant ??
      r.montantTotal,
  )
  const dateRaw = str(
    r.datePaie ?? r.datePaiem ?? r.heureoperation ?? r.date0peration ?? r.dateCollecte ?? r.date,
  )
  const datePaie = toIsoDateKey(dateRaw) || dateRaw

  const isOfficialShape =
    r.totalMontant !== undefined ||
    r.totalTransactions !== undefined ||
    (nomAgence && datePaie && !r.numCarte && !r.numabonnement && !r.reference)

  if (isOfficialShape) {
    if (!nomAgence && !codeAgence) return null
    return {
      rowKey: `${datePaie}|${codeAgence || nomAgence}|${idx}`,
      nomAgence: nomAgence || '—',
      codeAgence: codeAgence || nomAgence,
      datePaie,
      totalTransactions,
      totalMontant,
    }
  }

  const chargeEpargne = num(
    r.chargeEpargne ?? r.chargesEpargne ?? r.charge_epargne ?? r.droit ?? r.frais ?? r.partSociale,
  )
  if (!nomAgence && !codeAgence && !chargeEpargne && !totalMontant) return null

  return {
    rowKey: `${datePaie}|${codeAgence || nomAgence || 'row'}|${idx}`,
    nomAgence: nomAgence || '—',
    codeAgence: codeAgence || nomAgence || '—',
    datePaie,
    totalTransactions: totalTransactions || 1,
    totalMontant: chargeEpargne || totalMontant,
  }
}

function mapResponseList(raw: unknown, agencyLabel?: string): ChargeEpargneRow[] {
  const list = extractListFromApiEnvelope(raw)
  return list
    .map((row, idx) => mapRawToChargeEpargneRow(row, idx, agencyLabel))
    .filter((r): r is ChargeEpargneRow => r != null)
}

async function resolveOfficialAgencyCodes(body: SearchChargeEpargneBody): Promise<string[]> {
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
  body: SearchChargeEpargneBody,
  agencyLabels: Record<string, string>,
): Promise<ChargeEpargneRow[] | null> {
  const codeDir = str(body.codeDir ?? body.direction)
  const agencies = await resolveOfficialAgencyCodes(body)
  if (!agencies.length) return codeDir ? [] : null

  const results = await Promise.all(
    agencies.map(async (codeAgence) => {
      try {
        const res = await apiFetch(OFFICIAL_POST_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', accept: '*/*' },
          body: JSON.stringify(buildOfficialPostBody(codeAgence, body)),
        })
        const raw = await readJsonIfOk<unknown>(res, `Search charge épargne failed (${res.status})`)
        return mapResponseList(raw, agencyLabels[codeAgence])
      } catch {
        return null
      }
    }),
  )

  const anySuccess = results.some((r) => r !== null)
  if (!anySuccess) return null

  return results.flatMap((r) => r ?? [])
}

async function tryLegacyPost(
  body: SearchChargeEpargneBody,
  query: SearchChargeEpargneQuery,
  agencyLabels: Record<string, string>,
): Promise<ChargeEpargneRow[] | null> {
  const paths = (CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_POST_PATHS).filter(
    (p) => !isOfficialChargeEpargnePath(p),
  )
  const q = buildQueryParams(query)
  const codeAgence = str(body.codeAgence ?? body.agencyCodes?.[0])

  for (const path of paths) {
    try {
      const res = await apiFetch(appendQuery(path, q), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(buildLegacyPostBody({ ...body, codeAgence }, query)),
      })
      const raw = await readJsonIfOk<unknown>(res, `Search charge épargne failed (${res.status})`)
      const mapped = mapResponseList(raw, agencyLabels[codeAgence])
      if (mapped.length) return mapped
    } catch {
      /* next */
    }
  }
  return null
}

async function fallbackMontantsCollectes(
  body: SearchChargeEpargneBody,
  query: SearchChargeEpargneQuery,
  agencyLabels: Record<string, string>,
): Promise<ChargeEpargneRow[]> {
  const codes = await resolveOfficialAgencyCodes(body)
  const merged: ChargeEpargneRow[] = []

  for (const codeAgence of codes.length ? codes : [str(body.codeAgence)]) {
    if (!codeAgence) continue
    const rows = await searchEtatMontantsCollectes(
      { codeAgence, dateDebut: body.dateDebut, dateFin: body.dateFin },
      query,
    )
    const mapped = rows.map((row, idx) =>
      mapRawToChargeEpargneRow(
        {
          nomAgence: agencyLabels[codeAgence] || codeAgence,
          codeAgence,
          datePaie: row.datePaiem,
          totalMontant: row.mtCollecte,
          totalTransactions: 1,
          reference: row.reference,
          numCarte: row.numAbonnement,
        },
        idx,
        agencyLabels[codeAgence],
      ),
    )
    merged.push(...mapped.filter((r): r is ChargeEpargneRow => r != null))
  }

  return merged
}

/** Charge d'épargne — POST par agence/direction, réponse agrégée par date et agence. */
export async function searchChargeEpargne(
  body: SearchChargeEpargneBody,
  agencyLabels: Record<string, string> = {},
  query: SearchChargeEpargneQuery = {},
): Promise<ChargeEpargneRow[]> {
  const official = await tryOfficialPost(body, agencyLabels)
  if (official !== null) return official

  const legacy = await tryLegacyPost(body, query, agencyLabels)
  if (legacy !== null) return legacy

  return fallbackMontantsCollectes(body, query, agencyLabels)
}
