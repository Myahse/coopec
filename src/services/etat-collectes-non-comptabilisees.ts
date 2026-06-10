import { appendQuery, readJsonIfOk } from './api-json'
import { getAgencesByDirection } from './direction-regionale'
import { searchHistoriqueComptable } from './historique-comptable'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { agencyCode } from '@/utils/organization-filters'

export type SearchCollectesNonComptabiliseesBody = {
  dateDebut: string
  dateFin: string
  codeAgence?: string
  codeDir?: string
  agencyCodes?: string[]
  direction?: string
  institution?: string
}

export type CollecteNonComptabiliseeRow = {
  rowKey: string
  nomAgence: string
  codeAgence: string
  count: number
  montantCollecte: number
  datePaie: string
  montantArrete: number | undefined
  montantExtrait: number | undefined
}

const CUSTOM_PATH = import.meta.env.VITE_ETAT_COLLECTES_NON_COMPTABILISEES_PATH as string | undefined

const OFFICIAL_POST_PATH = '/api/etat-operation/collecte-non-comptabilise'

const DEFAULT_POST_PATHS = [
  OFFICIAL_POST_PATH,
  '/api/operation/search-collect-non-comptabilise',
  '/api/etat/collectes-non-comptabilisees',
  '/api/collecte/non-comptabilise',
  '/api/historique-comptable/collectes-non-comptabilisees',
]

function isOfficialCollecteNonComptabilisePath(path: string): boolean {
  const p = path.trim().toLowerCase()
  return p === OFFICIAL_POST_PATH || p.endsWith('/etat-operation/collecte-non-comptabilise')
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

export function mapRawToCollecteNonComptabiliseeRow(
  raw: unknown,
  idx: number,
  agencyLabel?: string,
): CollecteNonComptabiliseeRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const codeAgence = str(r.codeAgence ?? r.agence ?? r.codeagence)
  const nomAgence = str(r.nomAgence ?? r.nomagence ?? r.libelleAgence ?? r.nom ?? agencyLabel) || codeAgence
  if (!nomAgence && !codeAgence) return null

  const count = num(
    r.totalTransactions ?? r.count ?? r.nombre ?? r.nb ?? r.nbr ?? r.totalTransaction,
  )
  const montantCollecte = num(
    r.totalMontant ??
      r.montantCollecte ??
      r.montantCollect ??
      r.montant ??
      r.mntcoll ??
      r.montantTotal,
  )
  const montantArrete = num(r.montantArrete ?? r.montantArret ?? r.mntarrete ?? r.mntArrete)
  const montantExtrait = num(r.montantExtrait ?? r.montantExtr ?? r.mntextrait ?? r.mntExtrait)
  const dateRaw = str(r.datePaie ?? r.datePaiem ?? r.date0peration ?? r.date)
  const datePaie = toIsoDateKey(dateRaw) || dateRaw

  return {
    rowKey: `${datePaie}|${codeAgence || nomAgence}|${idx}`,
    nomAgence: nomAgence || '—',
    codeAgence: codeAgence || nomAgence,
    count,
    montantCollecte,
    datePaie,
    montantArrete: montantArrete || undefined,
    montantExtrait: montantExtrait || undefined,
  }
}

function buildOfficialPostBody(codeAgence: string, body: SearchCollectesNonComptabiliseesBody) {
  return {
    codeAgence,
    codeDir: str(body.codeDir ?? body.direction),
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
  }
}

function buildLegacyPostBody(body: SearchCollectesNonComptabiliseesBody) {
  const codeDir = str(body.codeDir ?? body.direction)
  return {
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    codeAgence: body.codeAgence,
    agence: body.codeAgence,
    codeDir,
    direction: codeDir || body.direction,
    codeDirection: codeDir || body.direction,
    institution: body.institution,
    codeInstitution: body.institution,
    agencyCodes: body.agencyCodes,
  }
}

function mapResponseList(
  raw: unknown,
  agencyLabel?: string,
): CollecteNonComptabiliseeRow[] {
  const list = extractListFromApiEnvelope(raw)
  return list
    .map((row, idx) => mapRawToCollecteNonComptabiliseeRow(row, idx, agencyLabel))
    .filter((r): r is CollecteNonComptabiliseeRow => r != null)
}

async function resolveOfficialAgencyCodes(
  body: SearchCollectesNonComptabiliseesBody,
): Promise<string[]> {
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
  body: SearchCollectesNonComptabiliseesBody,
  agencyLabels: Record<string, string>,
): Promise<CollecteNonComptabiliseeRow[] | null> {
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
        const raw = await readJsonIfOk<unknown>(
          res,
          `Search collectes non comptabilisées failed (${res.status})`,
        )
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

async function tryDedicatedPost(
  body: SearchCollectesNonComptabiliseesBody,
  agencyLabels: Record<string, string>,
): Promise<CollecteNonComptabiliseeRow[] | null> {
  const paths = CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_POST_PATHS
  const query = {
    all: 'true',
    direction: body.direction ?? body.codeDir,
    institution: body.institution,
  }

  for (const path of paths) {
    if (isOfficialCollecteNonComptabilisePath(path)) {
      const official = await tryOfficialPost(body, agencyLabels)
      if (official !== null) return official
      continue
    }

    try {
      const res = await apiFetch(appendQuery(path, query), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(buildLegacyPostBody(body)),
      })
      const raw = await readJsonIfOk<unknown>(
        res,
        `Search collectes non comptabilisées failed (${res.status})`,
      )
      const mapped = mapResponseList(raw)
      if (mapped.length) return mapped
    } catch {
      /* next */
    }
  }
  return null
}

async function fallbackHistoriqueForAgence(
  body: SearchCollectesNonComptabiliseesBody,
  codeAgence: string,
  nomAgence: string,
): Promise<CollecteNonComptabiliseeRow | null> {
  const res = await searchHistoriqueComptable({
    codeAgence,
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    mode: 'collecte',
    direction: body.direction,
    institution: body.institution,
  })

  const extractionKeys = new Set(
    res.extractions.map((e) => str(e.clefExtraction)).filter(Boolean),
  )

  const nonComptabilisees = res.details.filter((d) => {
    const clef = str(d.clefExtraction)
    return !clef || !extractionKeys.has(clef)
  })

  const comptabilisees = res.details.filter((d) => {
    const clef = str(d.clefExtraction)
    return clef && extractionKeys.has(clef)
  })

  if (!nonComptabilisees.length && !comptabilisees.length) return null

  const montantCollecte = nonComptabilisees.reduce((acc, d) => acc + (d.montantCollecte ?? 0), 0)
  const montantExtrait = comptabilisees.reduce((acc, d) => acc + (d.montantCollecte ?? 0), 0)
  const dates = nonComptabilisees
    .map((d) => toIsoDateKey(d.dateCollecte))
    .filter(Boolean)
    .sort()

  return {
    rowKey: codeAgence,
    nomAgence,
    codeAgence,
    count: nonComptabilisees.length,
    montantCollecte,
    datePaie: dates.at(-1) ?? '',
    montantArrete: undefined,
    montantExtrait: montantExtrait || undefined,
  }
}

function resolveAgencyCodes(body: SearchCollectesNonComptabiliseesBody): string[] {
  const fromList = (body.agencyCodes ?? []).map((c) => c.trim()).filter(Boolean)
  const unique = [...new Set(fromList)]
  if (unique.length) return unique
  const single = str(body.codeAgence)
  return single ? [single] : []
}

/** État des collectes non comptabilisées — agrégé par agence. */
export async function searchCollectesNonComptabilisees(
  body: SearchCollectesNonComptabiliseesBody,
  agencyLabels: Record<string, string> = {},
): Promise<CollecteNonComptabiliseeRow[]> {
  const dedicated = await tryDedicatedPost(body, agencyLabels)
  if (dedicated !== null) return dedicated

  const codes = resolveAgencyCodes(body)
  if (!codes.length) return []

  const rows: CollecteNonComptabiliseeRow[] = []
  for (const code of codes) {
    const label = agencyLabels[code] || code
    const row = await fallbackHistoriqueForAgence(body, code, label)
    if (row && (row.count > 0 || row.montantCollecte > 0 || row.montantExtrait)) {
      rows.push(row)
    }
  }
  return rows
}
