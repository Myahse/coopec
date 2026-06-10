import { appendQuery, readJsonIfOk } from './api-json'
import { getAgencesByDirection } from './direction-regionale'
import { searchEtatMontantsCollectes } from './etat-montants-collectes'
import { getTypesCollecte } from './param'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { agencyCode } from '@/utils/organization-filters'
import type { SearchClientDto, Summary, WTypeCollect } from './openapi-components'

export type SearchEtatCollectePretsBody = {
  dateDebut: string
  dateFin: string
  codeAgence?: string
  codeDir?: string
  agencyCodes?: string[]
  direction?: string
}

export type SearchEtatPretDetailBody = SearchClientDto & {
  agencyCodes?: string[]
  direction?: string
  institution?: string
}

export type EtatCollectePretAgregatRow = {
  rowKey: string
  nomAgence: string
  codeAgence: string
  datePaie: string
  totalTransactions: number
  totalMontant: number
}

export type EtatCollectePretRow = {
  rowKey: string
  datePaiement: string
  agenceRecouvrement: string
  agenceCreance: string
  numeroCompteDomiciliation: string
  numeroAbonnement: string
  client: string
  collecteur: string
  reference: string
  montantContrat: number | undefined
  mtCollecte: number | undefined
  compteLce: string
}

type EtatPretPathConfig = {
  customPath?: string
  defaultPaths: string[]
  errorLabel: string
}

const OFFICIAL_COLLECTE_PRET_PATH = '/api/etat-operation/collecte-pret'

const COLLECTE_PRETS_PATHS: EtatPretPathConfig = {
  customPath: import.meta.env.VITE_ETAT_COLLECTE_PRETS_PATH as string | undefined,
  defaultPaths: [
    OFFICIAL_COLLECTE_PRET_PATH,
    '/api/etat/collecte-prets',
    '/api/collecte/prets',
    '/api/operation/search-collecte-prets',
    '/api/pret/collecte',
    '/api/dashboard/collecte-prets',
  ],
  errorLabel: 'État collecte prêts',
}

function isOfficialCollectePretPath(path: string): boolean {
  const p = path.trim().toLowerCase()
  return p === OFFICIAL_COLLECTE_PRET_PATH || p.endsWith('/etat-operation/collecte-pret')
}

const DETAILLE_PRET_PATHS: EtatPretPathConfig = {
  customPath: import.meta.env.VITE_ETAT_DETAILLE_PRET_PATH as string | undefined,
  defaultPaths: [
    '/api/etat/detaille-pret',
    '/api/pret/etat-detaille',
    '/api/pret/detail',
    '/api/operation/search-detaille-pret',
    '/api/pret/etat-detaille-pret',
  ],
  errorLabel: 'État détaillé prêt',
}

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

function numZero(v: unknown): number {
  return num(v) ?? 0
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

export function mapRawToEtatCollectePretAgregatRow(
  raw: unknown,
  idx: number,
  agencyLabel?: string,
): EtatCollectePretAgregatRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const codeAgence = str(r.codeAgence ?? r.agence ?? r.codeagence)
  const nomAgence =
    str(r.nomAgence ?? r.nomagence ?? r.libelleAgence ?? r.nom ?? agencyLabel) || codeAgence
  const totalTransactions = numZero(
    r.totalTransactions ?? r.count ?? r.nombre ?? r.nb ?? r.nbr ?? r.totalTransaction,
  )
  const totalMontant = numZero(
    r.totalMontant ??
      r.mtCollecte ??
      r.montantCollecte ??
      r.montant ??
      r.montantTotal ??
      r.montantContrat,
  )
  const dateRaw = str(
    r.datePaie ??
      r.datePaiement ??
      r.datePaiem ??
      r.heureoperation ??
      r.date0peration ??
      r.dateCollecte ??
      r.date,
  )
  const datePaie = toIsoDateKey(dateRaw) || dateRaw
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

function mapAgregatResponseList(raw: unknown, agencyLabel?: string): EtatCollectePretAgregatRow[] {
  const list = extractListFromApiEnvelope(raw)
  return list
    .map((row, idx) => mapRawToEtatCollectePretAgregatRow(row, idx, agencyLabel))
    .filter((r): r is EtatCollectePretAgregatRow => r != null)
}

function buildOfficialCollectePretBody(codeAgence: string, body: SearchEtatCollectePretsBody) {
  return {
    codeAgence,
    codeDir: str(body.codeDir ?? body.direction),
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
  }
}

async function resolveCollectePretAgencyCodes(body: SearchEtatCollectePretsBody): Promise<string[]> {
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

async function tryOfficialCollectePretPost(
  body: SearchEtatCollectePretsBody,
  agencyLabels: Record<string, string>,
): Promise<EtatCollectePretAgregatRow[] | null> {
  const codeDir = str(body.codeDir ?? body.direction)
  const agencies = await resolveCollectePretAgencyCodes(body)
  if (!agencies.length) return codeDir ? [] : null

  const results = await Promise.all(
    agencies.map(async (codeAgence) => {
      try {
        const res = await apiFetch(OFFICIAL_COLLECTE_PRET_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', accept: '*/*' },
          body: JSON.stringify(buildOfficialCollectePretBody(codeAgence, body)),
        })
        const raw = await readJsonIfOk<unknown>(res, `État collecte prêts failed (${res.status})`)
        return mapAgregatResponseList(raw, agencyLabels[codeAgence])
      } catch {
        return null
      }
    }),
  )

  const anySuccess = results.some((r) => r !== null)
  if (!anySuccess) return null

  return results.flatMap((r) => r ?? [])
}

async function tryLegacyCollectePretPost(
  body: SearchEtatCollectePretsBody,
  agencyLabels: Record<string, string>,
): Promise<EtatCollectePretAgregatRow[] | null> {
  const custom = COLLECTE_PRETS_PATHS.customPath?.trim()
  const paths = (custom ? [custom] : COLLECTE_PRETS_PATHS.defaultPaths).filter(
    (p) => !isOfficialCollectePretPath(p),
  )

  for (const path of paths) {
    try {
      const codeAgence = str(body.codeAgence ?? body.agencyCodes?.[0])
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({
          codeAgence,
          agence: codeAgence,
          codeDir: str(body.codeDir ?? body.direction),
          dateDebut: body.dateDebut,
          dateFin: body.dateFin,
          direction: body.direction,
          agencyCodes: body.agencyCodes,
        }),
      })
      const raw = await readJsonIfOk<unknown>(res, `État collecte prêts failed (${res.status})`)
      const mapped = mapAgregatResponseList(raw, agencyLabels[codeAgence])
      if (mapped.length) return mapped
    } catch {
      /* next */
    }
  }
  return null
}

function aggregateDetailRows(
  rows: EtatCollectePretRow[],
  nomAgence: string,
  codeAgence: string,
): EtatCollectePretAgregatRow[] {
  const buckets = new Map<string, EtatCollectePretAgregatRow>()

  for (const row of rows) {
    const datePaie = toIsoDateKey(row.datePaiement) || row.datePaiement
    const key = `${datePaie}|${codeAgence}`
    const existing = buckets.get(key)
    const mt = numZero(row.mtCollecte)

    if (existing) {
      existing.totalTransactions += 1
      existing.totalMontant += mt
    } else {
      buckets.set(key, {
        rowKey: key,
        nomAgence,
        codeAgence,
        datePaie,
        totalTransactions: 1,
        totalMontant: mt,
      })
    }
  }

  return [...buckets.values()]
}

async function fallbackCollectePretAgregat(
  body: SearchEtatCollectePretsBody,
  agencyLabels: Record<string, string>,
): Promise<EtatCollectePretAgregatRow[]> {
  const codes = await resolveCollectePretAgencyCodes(body)
  const merged: EtatCollectePretAgregatRow[] = []

  for (const code of codes.length ? codes : [str(body.codeAgence)]) {
    if (!code) continue
    const nomAgence = agencyLabels[code] || code
    const detailBody: SearchEtatPretDetailBody = {
      codeAgence: code,
      dateDebut: body.dateDebut,
      dateFin: body.dateFin,
      direction: body.direction,
    }
    const detail = await fallbackFromMontantsCollectes(detailBody, code, nomAgence)
    merged.push(...aggregateDetailRows(detail, nomAgence, code))
  }

  return merged
}

function pretTypeIds(types: WTypeCollect[]): string[] {
  return types
    .filter((t) => {
      const label = str(t.libelle).toUpperCase()
      return label.includes('PRET') || label.includes('PRÊT') || label.includes('CREDIT')
    })
    .map((t) => str(t.idTypeCollect ?? t.codeOper))
    .filter(Boolean)
}

export function mapRawToEtatCollectePretRow(
  raw: unknown,
  idx: number,
  labels?: { agenceRecouvrement?: string; agenceCreance?: string },
): EtatCollectePretRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Summary & Record<string, unknown>
  const reference = str(r.reference)
  const numeroAbonnement = str(
    r.numabonnement ?? r.numAbonnement ?? r.numabonnemnt ?? r.numAbonnemnt ?? r.numeroCompte,
  )
  const client = str(r.nomClient ?? r.client ?? r.codeClient)
  const collecteur = str(r.nomCollecteur ?? r.leCollecteur ?? r.collecteur ?? r.codeCollect)
  const datePaiement = str(
    r.datePaiement ?? r.datePaiem ?? r.heureoperation ?? r.date0peration ?? r.dateCollecte ?? r.date,
  )
  if (!reference && !numeroAbonnement && !client && !datePaiement) return null

  return {
    rowKey: reference || numeroAbonnement || `pret-${idx}`,
    datePaiement,
    agenceRecouvrement: str(
      r.agenceRecouvrement ??
        r.nomAgenceRecouvrement ??
        r.agenceRecouvre ??
        labels?.agenceRecouvrement,
    ),
    agenceCreance: str(
      r.agenceCreance ??
        r.agenceCréance ??
        r.nomAgenceCreance ??
        r.agenceCreancier ??
        labels?.agenceCreance,
    ),
    numeroCompteDomiciliation: str(
      r.numeroCompteDomiciliation ??
        r.compteDomiciliation ??
        r.numeroCompte ??
        r.compteLes ??
        r.compteLES,
    ),
    numeroAbonnement,
    client,
    collecteur,
    reference,
    montantContrat: num(
      r.montantContrat ?? r.mtContrat ?? r.montantCollect ?? r.x1 ?? r.montantMise,
    ),
    mtCollecte: num(r.mtCollecte ?? r.montant ?? r.montantCollecte ?? r.montantCollect),
    compteLce: str(r.compteLce ?? r.compteLCE ?? r.compteLCEN ?? r.compteLCEnouveau),
  }
}

async function tryDedicatedPost(
  body: SearchEtatPretDetailBody,
  pathConfig: EtatPretPathConfig,
): Promise<EtatCollectePretRow[] | null> {
  const custom = pathConfig.customPath?.trim()
  const paths = custom ? [custom] : pathConfig.defaultPaths
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
      const raw = await readJsonIfOk<unknown>(
        res,
        `${pathConfig.errorLabel} failed (${res.status})`,
      )
      const list = extractListFromApiEnvelope(raw)
      const mapped = list
        .map((row, idx) =>
          mapRawToEtatCollectePretRow(row, idx, {
            agenceRecouvrement: body.codeAgence,
            agenceCreance: body.codeAgence,
          }),
        )
        .filter((r): r is EtatCollectePretRow => r != null)
      if (mapped.length) return mapped
    } catch {
      /* next */
    }
  }
  return null
}

function resolveAgencyCodes(body: SearchEtatPretDetailBody): string[] {
  const single = str(body.codeAgence)
  if (single) return [single]
  return [...new Set((body.agencyCodes ?? []).map((c) => c.trim()).filter(Boolean))]
}

async function fallbackFromMontantsCollectes(
  body: SearchEtatPretDetailBody,
  codeAgence: string,
  nomAgence: string,
): Promise<EtatCollectePretRow[]> {
  let typeIds: string[] = []
  try {
    const env = await getTypesCollecte()
    const types = extractListFromApiEnvelope(env) as WTypeCollect[]
    typeIds = pretTypeIds(types)
  } catch {
    typeIds = []
  }

  const queries =
    typeIds.length > 0
      ? typeIds.map((id) => ({ idTypeCollect: id, typeCollect: id }))
      : [{ idTypeCollect: undefined, typeCollect: undefined }]

  const rows: EtatCollectePretRow[] = []
  const seen = new Set<string>()

  for (const q of queries) {
    const list = await searchEtatMontantsCollectes(
      { codeAgence, dateDebut: body.dateDebut, dateFin: body.dateFin },
      q,
    )
    for (const row of list) {
      if (typeIds.length === 0) {
        const typeLabel = row.typeCollecte.toUpperCase()
        if (!typeLabel.includes('PRET') && !typeLabel.includes('PRÊT') && !typeLabel.includes('CREDIT')) {
          continue
        }
      }
      const mapped = mapRawToEtatCollectePretRow(
        {
          datePaiement: row.datePaiem,
          numAbonnement: row.numAbonnement,
          nomClient: row.client,
          nomCollecteur: row.collecteur,
          reference: row.reference,
          montantContrat: row.mtContrat,
          montant: row.mtCollecte,
          agenceRecouvrement: nomAgence,
          agenceCreance: nomAgence,
        },
        rows.length,
        { agenceRecouvrement: nomAgence, agenceCreance: nomAgence },
      )
      if (!mapped || seen.has(mapped.rowKey)) continue
      seen.add(mapped.rowKey)
      rows.push(mapped)
    }
  }
  return rows
}

async function searchEtatPretReport(
  body: SearchEtatPretDetailBody,
  agencyLabels: Record<string, string>,
  pathConfig: EtatPretPathConfig,
): Promise<EtatCollectePretRow[]> {
  const dedicated = await tryDedicatedPost(body, pathConfig)
  if (dedicated?.length) return dedicated

  const codes = resolveAgencyCodes(body)
  if (!codes.length) return []

  const rows: EtatCollectePretRow[] = []
  for (const code of codes) {
    const nomAgence = agencyLabels[code] || code
    const chunk = await fallbackFromMontantsCollectes(body, code, nomAgence)
    rows.push(...chunk)
  }
  return rows
}

/** État collecte des prêts — agrégé par agence et date de paiement. */
export async function searchEtatCollectePrets(
  body: SearchEtatCollectePretsBody,
  agencyLabels: Record<string, string> = {},
): Promise<EtatCollectePretAgregatRow[]> {
  const official = await tryOfficialCollectePretPost(body, agencyLabels)
  if (official !== null) return official

  const legacy = await tryLegacyCollectePretPost(body, agencyLabels)
  if (legacy !== null) return legacy

  return fallbackCollectePretAgregat(body, agencyLabels)
}

/** État détaillé prêt — détail des opérations prêt par période. */
export async function searchEtatDetaillePret(
  body: SearchEtatPretDetailBody,
  agencyLabels: Record<string, string> = {},
): Promise<EtatCollectePretRow[]> {
  return searchEtatPretReport(body, agencyLabels, DETAILLE_PRET_PATHS)
}
