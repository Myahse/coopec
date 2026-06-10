import { appendQuery, readJsonIfOk } from './api-json'
import { listCollecteursParAgence } from './collecteur'
import { searchEtatMontantsCollectes } from './etat-montants-collectes'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { collecteurLabelForCode, mapCollecteurSelectOptions } from '@/utils/collecteur-select-options'

export type SearchValidationMensuelleCollecteBody = {
  dateDebut: string
  dateFin: string
  codeAgence?: string
  agencyCodes?: string[]
  direction?: string
  institution?: string
}

export type ValidationMensuelleCollecteRow = {
  rowKey: string
  collecteur: string
  agence: string
  codeAgence: string
  collecteFcfa: number
  collecteM1: number
  commissionRealisee: number
  commissionM1: number
  adhesionProspect: number
  carteVendu: number
}

const CUSTOM_PATH = import.meta.env.VITE_VALIDATION_MENSUELLE_COLLECTE_PATH as string | undefined

const DEFAULT_POST_PATHS = [
  '/api/etat/validation-mensuelle-collecte',
  '/api/collecte/validation-mensuelle',
  '/api/operation/validation-mensuelle-collecte',
  '/api/dashboard/validation-mensuelle-collecte',
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

function shiftMonthRange(dateDebut: string, dateFin: string): { dateDebut: string; dateFin: string } {
  const start = new Date(`${dateDebut}T12:00:00`)
  const end = new Date(`${dateFin}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { dateDebut, dateFin }
  }
  start.setMonth(start.getMonth() - 1)
  end.setMonth(end.getMonth() - 1)
  return {
    dateDebut: start.toISOString().slice(0, 10),
    dateFin: end.toISOString().slice(0, 10),
  }
}

export function mapRawToValidationMensuelleRow(
  raw: unknown,
  idx: number,
  labels?: { agence?: string; codeAgence?: string },
): ValidationMensuelleCollecteRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const codeAgence = str(r.codeAgence ?? r.agence ?? labels?.codeAgence)
  const agence =
    str(r.nomAgence ?? r.libelleAgence ?? r.agenceLabel ?? r.agence ?? labels?.agence) || codeAgence
  const collecteur = str(
    r.nomCollecteur ??
      r.leCollecteur ??
      r.collecteur ??
      r.nomClient ??
      r.loginclient ??
      r.login,
  )
  if (!collecteur && !agence && !codeAgence) return null

  return {
    rowKey: str(r.rowKey) || `${codeAgence}-${collecteur}` || `row-${idx}`,
    collecteur: collecteur || '—',
    agence: agence || '—',
    codeAgence: codeAgence || agence,
    collecteFcfa: num(
      r.collecteFcfa ??
        r.collecte ??
        r.montantCollecte ??
        r.montantCollect ??
        r.montant,
    ),
    collecteM1: num(r.collecteM1 ?? r.collecteM_1 ?? r.montantCollecteM1 ?? r.montantM1),
    commissionRealisee: num(
      r.commissionRealisee ??
        r.commission ??
        r.montantCommission ??
        r.commisionRealisee ??
        r.montantCommision,
    ),
    commissionM1: num(r.commissionM1 ?? r.commissionM_1 ?? r.commisionM1 ?? r.montantCommissionM1),
    adhesionProspect: num(
      r.adhesionProspect ??
        r.adhesionsProspect ??
        r.nombreAdhesion ??
        r.adhesion ??
        r.prospect,
    ),
    carteVendu: num(r.carteVendu ?? r.cartesVendues ?? r.nombreCarte ?? r.carteVendues),
  }
}

async function tryDedicatedPost(
  body: SearchValidationMensuelleCollecteBody,
): Promise<ValidationMensuelleCollecteRow[] | null> {
  const paths = CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_POST_PATHS
  const payload = {
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    codeAgence: body.codeAgence,
    agence: body.codeAgence,
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
        `Validation mensuelle collecte failed (${res.status})`,
      )
      const list = extractListFromApiEnvelope(raw)
      const mapped = list
        .map((row, idx) =>
          mapRawToValidationMensuelleRow(row, idx, {
            codeAgence: body.codeAgence,
            agence: body.codeAgence,
          }),
        )
        .filter((r): r is ValidationMensuelleCollecteRow => r != null)
      if (mapped.length) return mapped
    } catch {
      /* next path */
    }
  }
  return null
}

function resolveAgencyCodes(body: SearchValidationMensuelleCollecteBody): string[] {
  const single = str(body.codeAgence)
  if (single) return [single]
  return [...new Set((body.agencyCodes ?? []).map((c) => c.trim()).filter(Boolean))]
}

async function fallbackFromMontantsCollectes(
  body: SearchValidationMensuelleCollecteBody,
  codeAgence: string,
  nomAgence: string,
): Promise<ValidationMensuelleCollecteRow[]> {
  const m1 = shiftMonthRange(body.dateDebut, body.dateFin)
  const collecteursEnv = await listCollecteursParAgence(codeAgence)
  const collecteurs = mapCollecteurSelectOptions(extractListFromApiEnvelope(collecteursEnv))

  const [currentRows, m1Rows] = await Promise.all([
    searchEtatMontantsCollectes(
      { codeAgence, dateDebut: body.dateDebut, dateFin: body.dateFin },
      {},
    ),
    searchEtatMontantsCollectes(
      { codeAgence, dateDebut: m1.dateDebut, dateFin: m1.dateFin },
      {},
    ),
  ])

  const sumByCollecteur = (rows: typeof currentRows) => {
    const map = new Map<string, number>()
    for (const row of rows) {
      const key = str(row.collecteur)
      if (!key) continue
      map.set(key, (map.get(key) ?? 0) + (row.mtCollecte ?? 0))
    }
    return map
  }

  const current = sumByCollecteur(currentRows)
  const previous = sumByCollecteur(m1Rows)
  const keys = new Set<string>([
    ...collecteurs.map((c) => c.label),
    ...current.keys(),
    ...previous.keys(),
  ])

  const out: ValidationMensuelleCollecteRow[] = []
  let idx = 0
  for (const key of keys) {
    const collecteFcfa = current.get(key) ?? 0
    const collecteM1 = previous.get(key) ?? 0
    if (!collecteFcfa && !collecteM1) continue
    const login = collecteurs.find((c) => c.label === key)?.value
    out.push({
      rowKey: `${codeAgence}-${login ?? key}-${idx}`,
      collecteur: login ? collecteurLabelForCode(login, collecteurs) || key : key,
      agence: nomAgence || codeAgence,
      codeAgence,
      collecteFcfa,
      collecteM1,
      commissionRealisee: 0,
      commissionM1: 0,
      adhesionProspect: 0,
      carteVendu: 0,
    })
    idx += 1
  }
  return out
}

/** Validation mensuelle des données de collecte — par collecteur et agence. */
export async function searchValidationMensuelleCollecte(
  body: SearchValidationMensuelleCollecteBody,
  agencyLabels: Record<string, string> = {},
): Promise<ValidationMensuelleCollecteRow[]> {
  const dedicated = await tryDedicatedPost(body)
  if (dedicated?.length) return dedicated

  const codes = resolveAgencyCodes(body)
  if (!codes.length) return []

  const rows: ValidationMensuelleCollecteRow[] = []
  for (const code of codes) {
    const nomAgence = agencyLabels[code] || code
    const chunk = await fallbackFromMontantsCollectes(body, code, nomAgence)
    rows.push(...chunk)
  }
  return rows
}
