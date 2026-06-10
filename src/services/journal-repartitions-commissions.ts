import { appendQuery, readJsonIfOk } from './api-json'
import { getCourbeCollect } from './courbe-collect'
import { apiFetch } from './http'
import { extractDataFromApiEnvelope, extractListFromApiEnvelope } from '@/utils/api-envelope'

export type SearchJournalRepartitionsCommissionsBody = {
  dateDebut: string
  dateFin: string
  codeAgence?: string
  codeDir?: string
  direction?: string
  agencyCodes?: string[]
  institution?: string
}

export type EtatRepartitionCommissionData = {
  commission?: number
  montantCollecte?: number
}

export type RepartitionCommissionRow = {
  rowKey: string
  direction: string
  agence: string
  codeAgence: string
  montant: number
  commission: number
}

const CUSTOM_PATH = import.meta.env.VITE_JOURNAL_REPARTITIONS_COMMISSIONS_PATH as string | undefined

const OFFICIAL_POST_PATH = '/api/etat-operation/repartition-commission'

const DEFAULT_POST_PATHS = [
  OFFICIAL_POST_PATH,
  '/api/etat-operation/repartition-commissions',
  '/api/etat/repartition-commissions',
  '/api/operation/journal-commissions',
  '/api/collecte/repartition-commissions',
  '/api/dashboard/journal-repartitions-commissions',
]

function isOfficialRepartitionCommissionPath(path: string): boolean {
  const p = path.trim().toLowerCase()
  return (
    p === OFFICIAL_POST_PATH ||
    p.endsWith('/etat-operation/repartition-commission') ||
    p.endsWith('/etat-operation/repartition-commissions')
  )
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

function buildOfficialPostBody(body: SearchJournalRepartitionsCommissionsBody) {
  return {
    codeAgence: str(body.codeAgence),
    codeDir: str(body.codeDir ?? body.direction),
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
  }
}

export function mapOfficialSummaryToRepartitionRow(
  data: EtatRepartitionCommissionData,
  body: SearchJournalRepartitionsCommissionsBody,
  labels?: { direction?: string; agence?: string },
): RepartitionCommissionRow {
  const codeAgence = str(body.codeAgence)
  const codeDir = str(body.codeDir ?? body.direction)
  return {
    rowKey: `${codeDir}|${codeAgence}`,
    direction: labels?.direction || codeDir || '—',
    agence: labels?.agence || codeAgence || '—',
    codeAgence,
    montant: num(data.montantCollecte),
    commission: num(data.commission),
  }
}

export function mapRawToRepartitionCommissionRow(
  raw: unknown,
  idx: number,
  labels?: { direction?: string; agence?: string; codeAgence?: string },
): RepartitionCommissionRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const codeAgence = str(r.codeAgence ?? r.agence ?? r.codeagence ?? labels?.codeAgence)
  const agence =
    str(r.nomAgence ?? r.libelleAgence ?? r.agenceLabel ?? r.agence ?? labels?.agence) || codeAgence
  const direction =
    str(
      r.direction ??
        r.nomDirection ??
        r.libelleDirection ??
        r.libelleDirectionRegionale ??
        r.nomDirectionRegionale ??
        labels?.direction,
    ) || '—'
  if (!agence && !codeAgence && direction === '—') return null

  const montant = num(
    r.montant ?? r.montantCollecte ?? r.montantCollect ?? r.montantTotal ?? r.totalCollecte,
  )
  const commission = num(
    r.commission ?? r.montantCommission ?? r.montantCommision ?? r.totalCommission,
  )

  return {
    rowKey: codeAgence || `${direction}-${agence}` || `row-${idx}`,
    direction,
    agence: agence || '—',
    codeAgence: codeAgence || agence,
    montant,
    commission,
  }
}

function resolveOfficialAgencyCodes(body: SearchJournalRepartitionsCommissionsBody): string[] {
  const fromList = [...new Set((body.agencyCodes ?? []).map((c) => c.trim()).filter(Boolean))]
  if (fromList.length) return fromList
  const single = str(body.codeAgence)
  if (single) return [single]
  return []
}

async function tryOfficialPost(
  body: SearchJournalRepartitionsCommissionsBody,
  agencyLabels: AgencyLookupLabels = {},
): Promise<RepartitionCommissionRow[] | null> {
  const codeDir = str(body.codeDir ?? body.direction)
  if (!codeDir) return null

  const agencies = resolveOfficialAgencyCodes(body)
  if (!agencies.length) return null

  const results = await Promise.all(
    agencies.map(async (codeAgence) => {
      try {
        const res = await apiFetch(OFFICIAL_POST_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', accept: '*/*' },
          body: JSON.stringify(
            buildOfficialPostBody({ ...body, codeAgence, codeDir, direction: codeDir }),
          ),
        })
        const raw = await readJsonIfOk<unknown>(
          res,
          `État répartition commission failed (${res.status})`,
        )
        const data = extractDataFromApiEnvelope<EtatRepartitionCommissionData>(raw)
        if (!data || typeof data !== 'object' || Array.isArray(data)) return null
        const labels = agencyLabels[codeAgence]
        return mapOfficialSummaryToRepartitionRow(
          data,
          { ...body, codeAgence, codeDir, direction: codeDir },
          { direction: labels?.direction, agence: labels?.agence },
        )
      } catch {
        return null
      }
    }),
  )

  const anySuccess = results.some((r) => r !== null)
  if (!anySuccess) return null

  return results.filter((r): r is RepartitionCommissionRow => r !== null)
}

async function tryDedicatedPost(
  body: SearchJournalRepartitionsCommissionsBody,
): Promise<{ rows: RepartitionCommissionRow[]; official: boolean } | null> {
  const paths = CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_POST_PATHS
  const codeDir = str(body.codeDir ?? body.direction)
  const query = {
    all: 'true',
    direction: codeDir,
    institution: body.institution,
  }

  for (const path of paths) {
    const official = isOfficialRepartitionCommissionPath(path)
    const payload = official
      ? buildOfficialPostBody(body)
      : {
          dateDebut: body.dateDebut,
          dateFin: body.dateFin,
          codeAgence: body.codeAgence,
          agence: body.codeAgence,
          codeDir,
          direction: codeDir,
          codeDirection: codeDir,
          institution: body.institution,
          codeInstitution: body.institution,
          agencyCodes: body.agencyCodes,
        }
    if (official && (!resolveOfficialAgencyCodes(body).length || !codeDir)) continue

    try {
      const res = await apiFetch(appendQuery(path, query), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(payload),
      })
      const raw = await readJsonIfOk<unknown>(
        res,
        `Journal répartitions commissions failed (${res.status})`,
      )

      if (official) {
        const data = extractDataFromApiEnvelope<EtatRepartitionCommissionData>(raw)
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return {
            rows: [mapOfficialSummaryToRepartitionRow(data, body)],
            official: true,
          }
        }
        return { rows: [], official: true }
      }

      const list = extractListFromApiEnvelope(raw)
      const mapped = list
        .map((row, idx) => mapRawToRepartitionCommissionRow(row, idx))
        .filter((r): r is RepartitionCommissionRow => r != null)
      if (mapped.length) return { rows: mapped, official: false }
    } catch {
      /* next */
    }
  }
  return null
}

function resolveAgencyCodes(body: SearchJournalRepartitionsCommissionsBody): string[] {
  return resolveOfficialAgencyCodes(body)
}

async function fallbackCourbeForAgence(
  body: SearchJournalRepartitionsCommissionsBody,
  codeAgence: string,
  directionLabel: string,
  agenceLabel: string,
): Promise<RepartitionCommissionRow | null> {
  const result = await getCourbeCollect({
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    agence: codeAgence,
    direction: body.codeDir ?? body.direction,
    institution: body.institution,
  })

  const montant = result.collecteJour.reduce((acc, p) => acc + (p.montantCollecte ?? 0), 0)
  const commission = result.collecteJour.reduce((acc, p) => acc + (p.commission ?? 0), 0)
  if (!montant && !commission) return null

  return {
    rowKey: codeAgence,
    direction: directionLabel || '—',
    agence: agenceLabel || codeAgence,
    codeAgence,
    montant,
    commission,
  }
}

export type AgencyLookupLabels = Record<string, { direction: string; agence: string }>

/** Journal des répartitions des collectes — POST /api/etat-operation/repartition-commission */
export async function searchJournalRepartitionsCommissions(
  body: SearchJournalRepartitionsCommissionsBody,
  agencyLabels: AgencyLookupLabels = {},
): Promise<RepartitionCommissionRow[]> {
  let officialResponded = false
  let rows: RepartitionCommissionRow[] = []

  const official = await tryOfficialPost(body, agencyLabels)
  if (official !== null) {
    rows = official
    officialResponded = true
  } else {
    const dedicated = await tryDedicatedPost(body)
    if (dedicated) {
      rows = dedicated.rows
      officialResponded = dedicated.official
    }
  }

  if (officialResponded) return rows

  const codes = resolveAgencyCodes(body)
  if (!codes.length) return []

  const fallbackRows: RepartitionCommissionRow[] = []
  for (const code of codes) {
    const agLabels = agencyLabels[code]
    const row = await fallbackCourbeForAgence(
      body,
      code,
      agLabels?.direction ?? '—',
      agLabels?.agence ?? code,
    )
    if (row) fallbackRows.push(row)
  }
  return fallbackRows
}
