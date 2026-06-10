import { appendQuery, readJsonIfOk } from './api-json'
import { searchEtatSuiviClientele, type EtatSuiviClienteleRow } from './etat-suivi-clientele'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { SearchClientDto, Summary } from './openapi-components'

export type SearchEtatCompensationBody = SearchClientDto & {
  agencyCodes?: string[]
  direction?: string
  institution?: string
}

export type EtatCompensationRow = {
  rowKey: string
  coopecCreance: string
  agenceCreance: string
  cumulMontantCollecte: number | undefined
  coopecRecouvrement: string
  agenceRecouvrement: string
}

const CUSTOM_PATH = import.meta.env.VITE_ETAT_COMPENSATION_PATH as string | undefined

const DEFAULT_POST_PATHS = [
  '/api/etat/compensation',
  '/api/pret/compensation',
  '/api/pret/etat-compensation',
  '/api/operation/search-compensation',
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

export function mapRawToEtatCompensationRow(raw: unknown, idx: number): EtatCompensationRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Summary & Record<string, unknown>

  const coopecCreance = str(
    r.coopecCreance ?? r.coopecCréance ?? r.institutionCreance ?? r.codeInstitutionCreance,
  )
  const agenceCreance = str(r.agenceCreance ?? r.agenceCréance ?? r.nomAgenceCreance)
  const coopecRecouvrement = str(
    r.coopecRecouvrement ?? r.coopecRecouvre ?? r.institutionRecouvrement ?? r.codeInstitutionRecouvrement,
  )
  const agenceRecouvrement = str(
    r.agenceRecouvrement ?? r.nomAgenceRecouvrement ?? r.agenceRecouvre ?? r.NOM_AGENCE,
  )

  if (!coopecCreance && !agenceCreance && !coopecRecouvrement && !agenceRecouvrement) return null

  const rowKey = `${coopecCreance}|${agenceCreance}|${coopecRecouvrement}|${agenceRecouvrement}|${idx}`

  return {
    rowKey,
    coopecCreance,
    agenceCreance,
    cumulMontantCollecte: num(
      r.cumulMontantCollecte ??
        r.cumulCollecte ??
        r.montantCollecteCumul ??
        r.montantCollecte ??
        r.mtCollecte,
    ),
    coopecRecouvrement,
    agenceRecouvrement,
  }
}

async function tryDedicatedPost(body: SearchEtatCompensationBody): Promise<EtatCompensationRow[] | null> {
  const paths = CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_POST_PATHS
  const payload = {
    codeAgence: body.codeAgence,
    agence: body.codeAgence,
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    direction: body.direction,
    codeDirection: body.direction,
    institution: body.institution,
    codeInstitution: body.institution,
    agencyCodes: body.agencyCodes,
  }
  const query = {
    all: 'true',
    direction: body.direction,
    institution: body.institution,
  }

  for (const path of paths) {
    try {
      const res = await apiFetch(appendQuery(path, query), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(payload),
      })
      const raw = await readJsonIfOk<unknown>(res, `État compensation failed (${res.status})`)
      const list = extractListFromApiEnvelope(raw)
      const mapped = list
        .map((row, idx) => mapRawToEtatCompensationRow(row, idx))
        .filter((r): r is EtatCompensationRow => r != null)
      if (mapped.length) return mapped
    } catch {
      /* next */
    }
  }
  return null
}

function resolveAgencyCodes(body: SearchEtatCompensationBody): string[] {
  const single = str(body.codeAgence)
  if (single) return [single]
  return [...new Set((body.agencyCodes ?? []).map((c) => c.trim()).filter(Boolean))]
}

function compensationKey(row: EtatSuiviClienteleRow): string {
  return `${row.coopecCreance}|${row.agenceCreance}|${row.coopecRecouvrement}|${row.agenceRecouvrement}`
}

function aggregateFromSuiviRows(suiviRows: EtatSuiviClienteleRow[]): EtatCompensationRow[] {
  const map = new Map<string, EtatCompensationRow>()

  for (const row of suiviRows) {
    const key = compensationKey(row)
    const amt = typeof row.cumulMontantCollecte === 'number' ? row.cumulMontantCollecte : 0
    const existing = map.get(key)

    if (!existing) {
      map.set(key, {
        rowKey: key,
        coopecCreance: row.coopecCreance,
        agenceCreance: row.agenceCreance,
        cumulMontantCollecte: amt || undefined,
        coopecRecouvrement: row.coopecRecouvrement,
        agenceRecouvrement: row.agenceRecouvrement,
      })
      continue
    }

    existing.cumulMontantCollecte = (existing.cumulMontantCollecte ?? 0) + amt
  }

  return [...map.values()]
}

async function fallbackFromSuiviClientele(
  body: SearchEtatCompensationBody,
  agencyLabels: Record<string, string>,
): Promise<EtatCompensationRow[]> {
  const suiviRows = await searchEtatSuiviClientele(body, agencyLabels)
  return aggregateFromSuiviRows(suiviRows)
}

/** État de compensation — cumul collecté par coopec et agence créance / recouvrement. */
export async function searchEtatCompensation(
  body: SearchEtatCompensationBody,
  agencyLabels: Record<string, string> = {},
): Promise<EtatCompensationRow[]> {
  const dedicated = await tryDedicatedPost(body)
  if (dedicated?.length) return dedicated

  const codes = resolveAgencyCodes(body)
  if (!codes.length) return []

  const rows: EtatCompensationRow[] = []
  const seen = new Set<string>()

  for (const code of codes) {
    const labels = { ...agencyLabels }
    if (!labels[code]) labels[code] = agencyLabels[code] || code
    const chunk = await fallbackFromSuiviClientele(
      { ...body, codeAgence: code, agencyCodes: [code] },
      labels,
    )
    for (const row of chunk) {
      if (seen.has(row.rowKey)) continue
      seen.add(row.rowKey)
      rows.push(row)
    }
  }
  return rows
}
