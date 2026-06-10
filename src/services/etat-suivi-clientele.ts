import { appendQuery, readJsonIfOk } from './api-json'
import { searchEtatDetaillePret, type EtatCollectePretRow } from './etat-collecte-prets'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { SearchClientDto, Summary, VImpayePret } from './openapi-components'

export type SearchEtatSuiviClienteleBody = SearchClientDto & {
  agencyCodes?: string[]
  direction?: string
  institution?: string
}

export type EtatSuiviClienteleRow = {
  rowKey: string
  coopecCreance: string
  agenceCreance: string
  nomClient: string
  contact: string
  montantPret: number | undefined
  numeroDomiciliation: string
  cumulMontantCollecte: number | undefined
  coopecRecouvrement: string
  agenceRecouvrement: string
  compteLce: string
  impayes: number | undefined
}

const CUSTOM_PATH = import.meta.env.VITE_ETAT_SUIVI_CLIENTELE_PATH as string | undefined

const DEFAULT_POST_PATHS = [
  '/api/etat/suivi-clientele',
  '/api/pret/suivi-clientele',
  '/api/pret/etat-suivi-clientele',
  '/api/operation/search-suivi-clientele',
]

const IMPAYE_PATHS = [
  '/api/pret/impaye',
  '/api/etat/impaye-pret',
  '/api/pret/impayes',
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

export function mapRawToEtatSuiviClienteleRow(raw: unknown, idx: number): EtatSuiviClienteleRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Summary & Record<string, unknown>

  const nomClient = str(r.nomClient ?? r.nomDuClient ?? r.client ?? r.NOM_CLIENT)
  const numeroDomiciliation = str(
    r.numeroDomiciliation ??
      r.numeroDeDomiciliation ??
      r.compteDomiciliation ??
      r.numeroCompteDomiciliation ??
      r.compteLes,
  )
  const agenceCreance = str(r.agenceCreance ?? r.agenceCréance ?? r.nomAgenceCreance)
  const agenceRecouvrement = str(
    r.agenceRecouvrement ?? r.nomAgenceRecouvrement ?? r.agenceRecouvre ?? r.NOM_AGENCE,
  )

  if (!nomClient && !numeroDomiciliation && !agenceCreance && !agenceRecouvrement) return null

  const rowKey = `${nomClient}|${numeroDomiciliation}|${agenceCreance}|${idx}`

  return {
    rowKey,
    coopecCreance: str(
      r.coopecCreance ?? r.coopecCréance ?? r.institutionCreance ?? r.codeInstitutionCreance ?? r.institution,
    ),
    agenceCreance,
    nomClient,
    contact: str(r.contact ?? r.telephone ?? r.tel ?? r.mobile ?? r.numeroTelephone),
    montantPret: num(r.montantPret ?? r.montantContrat ?? r.mtContrat),
    numeroDomiciliation,
    cumulMontantCollecte: num(
      r.cumulMontantCollecte ??
        r.cumulCollecte ??
        r.montantCollecteCumul ??
        r.montantCollecte ??
        r.mtCollecte,
    ),
    coopecRecouvrement: str(
      r.coopecRecouvrement ??
        r.coopecRecouvre ??
        r.institutionRecouvrement ??
        r.codeInstitutionRecouvrement,
    ),
    agenceRecouvrement,
    compteLce: str(r.compteLce ?? r.compteLCE ?? r.compteLCEN),
    impayes: num(r.impayes ?? r.impaye ?? r.montantImpaye ?? r.montantEcheance),
  }
}

async function tryDedicatedPost(
  body: SearchEtatSuiviClienteleBody,
): Promise<EtatSuiviClienteleRow[] | null> {
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
      const raw = await readJsonIfOk<unknown>(res, `Suivi clientèle failed (${res.status})`)
      const list = extractListFromApiEnvelope(raw)
      const mapped = list
        .map((row, idx) => mapRawToEtatSuiviClienteleRow(row, idx))
        .filter((r): r is EtatSuiviClienteleRow => r != null)
      if (mapped.length) return mapped
    } catch {
      /* next */
    }
  }
  return null
}

function resolveAgencyCodes(body: SearchEtatSuiviClienteleBody): string[] {
  const single = str(body.codeAgence)
  if (single) return [single]
  return [...new Set((body.agencyCodes ?? []).map((c) => c.trim()).filter(Boolean))]
}

function groupKey(row: EtatCollectePretRow): string {
  return `${row.client}|${row.numeroCompteDomiciliation}|${row.agenceCreance}|${row.agenceRecouvrement}`
}

function aggregateFromPretRows(
  pretRows: EtatCollectePretRow[],
  labels: { institution?: string },
): EtatSuiviClienteleRow[] {
  const map = new Map<string, EtatSuiviClienteleRow>()

  for (const row of pretRows) {
    const key = groupKey(row)
    const existing = map.get(key)
    const mt = typeof row.mtCollecte === 'number' ? row.mtCollecte : 0

    if (!existing) {
      map.set(key, {
        rowKey: key,
        coopecCreance: labels.institution ?? '',
        agenceCreance: row.agenceCreance,
        nomClient: row.client,
        contact: '',
        montantPret: row.montantContrat,
        numeroDomiciliation: row.numeroCompteDomiciliation,
        cumulMontantCollecte: mt || undefined,
        coopecRecouvrement: labels.institution ?? '',
        agenceRecouvrement: row.agenceRecouvrement,
        compteLce: row.compteLce,
        impayes: undefined,
      })
      continue
    }

    existing.cumulMontantCollecte = (existing.cumulMontantCollecte ?? 0) + mt
    if (existing.montantPret === undefined && row.montantContrat !== undefined) {
      existing.montantPret = row.montantContrat
    }
    if (!existing.compteLce && row.compteLce) existing.compteLce = row.compteLce
  }

  return [...map.values()]
}

async function fetchImpayesByClient(
  body: SearchEtatSuiviClienteleBody,
): Promise<Map<string, number>> {
  const payload = {
    codeAgence: body.codeAgence,
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    direction: body.direction,
    institution: body.institution,
  }
  const query = { all: 'true' }

  for (const path of IMPAYE_PATHS) {
    try {
      const res = await apiFetch(appendQuery(path, query), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(payload),
      })
      const raw = await readJsonIfOk<unknown>(res, `Impayés prêt failed (${res.status})`)
      const list = extractListFromApiEnvelope(raw) as VImpayePret[]
      if (!list.length) continue

      const out = new Map<string, number>()
      for (const item of list) {
        const client = str(item.nomClient).toLowerCase()
        if (!client) continue
        const amt = num(item.montantEcheance) ?? 0
        out.set(client, (out.get(client) ?? 0) + amt)
      }
      return out
    } catch {
      try {
        const res = await apiFetch(appendQuery(path, query), {
          method: 'GET',
          headers: { accept: '*/*' },
        })
        const raw = await readJsonIfOk<unknown>(res, `Impayés prêt failed (${res.status})`)
        const list = extractListFromApiEnvelope(raw) as VImpayePret[]
        if (!list.length) continue
        const out = new Map<string, number>()
        for (const item of list) {
          const client = str(item.nomClient).toLowerCase()
          if (!client) continue
          const amt = num(item.montantEcheance) ?? 0
          out.set(client, (out.get(client) ?? 0) + amt)
        }
        return out
      } catch {
        /* next path */
      }
    }
  }
  return new Map()
}

function applyImpayes(rows: EtatSuiviClienteleRow[], impayes: Map<string, number>): EtatSuiviClienteleRow[] {
  if (!impayes.size) return rows
  return rows.map((row) => {
    const key = row.nomClient.toLowerCase()
    const amt = impayes.get(key)
    if (amt === undefined) return row
    return { ...row, impayes: amt }
  })
}

async function fallbackFromDetaillePret(
  body: SearchEtatSuiviClienteleBody,
  agencyLabels: Record<string, string>,
): Promise<EtatSuiviClienteleRow[]> {
  const pretRows = await searchEtatDetaillePret(body, agencyLabels)
  const institution = str(body.institution)
  const aggregated = aggregateFromPretRows(pretRows, { institution })
  const impayes = await fetchImpayesByClient(body)
  return applyImpayes(aggregated, impayes)
}

/** État de suivi clientèle — synthèse prêt par client et agence. */
export async function searchEtatSuiviClientele(
  body: SearchEtatSuiviClienteleBody,
  agencyLabels: Record<string, string> = {},
): Promise<EtatSuiviClienteleRow[]> {
  const dedicated = await tryDedicatedPost(body)
  if (dedicated?.length) {
    const impayes = await fetchImpayesByClient(body)
    return applyImpayes(dedicated, impayes)
  }

  const codes = resolveAgencyCodes(body)
  if (!codes.length) return []

  const rows: EtatSuiviClienteleRow[] = []
  for (const code of codes) {
    const nomAgence = agencyLabels[code] || code
    const labels = { ...agencyLabels }
    if (!labels[code]) labels[code] = nomAgence
    const chunk = await fallbackFromDetaillePret(
      { ...body, codeAgence: code, agencyCodes: [code] },
      labels,
    )
    rows.push(...chunk)
  }
  return rows
}
