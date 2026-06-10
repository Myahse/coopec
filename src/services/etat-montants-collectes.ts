import { appendQuery, readJsonIfOk } from './api-json'
import { getDashboardMontantsCollectes } from './dashboard'
import { searchHistoriqueComptable } from './historique-comptable'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { SearchClientDto, Summary } from './openapi-components'

export type SearchEtatMontantsCollectesBody = SearchClientDto & {
  codeDir?: string
  direction?: string
}

export type SearchEtatMontantsCollectesQuery = {
  collecteur?: string
  client?: string
  carte?: string
  idTypeCollect?: string
  typeCollect?: string
  codeOper?: string
}

export type EtatMontantCollecteRow = {
  rowKey: string
  numEnreg: string
  datePaiem: string
  numAbonnement: string
  client: string
  collecteur: string
  typeCollecte: string
  reference: string
  mtContrat: number | undefined
  mtCollecte: number | undefined
}

const CUSTOM_PATH = import.meta.env.VITE_ETAT_MONTANTS_COLLECTES_PATH as string | undefined

const OFFICIAL_POST_PATH = '/api/etat-operation/montant-collecte'

const DEFAULT_POST_PATHS = [
  OFFICIAL_POST_PATH,
  '/api/operation/search-collect',
  '/api/operation/search-montants-collect',
  '/api/collecte/etat-montants',
  '/api/collecte/search-montants',
]

function isOfficialMontantCollectePath(path: string): boolean {
  const p = path.trim().toLowerCase()
  return p === OFFICIAL_POST_PATH || p.endsWith('/etat-operation/montant-collecte')
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

function inDateRange(iso: string, debut: string, fin: string): boolean {
  const key = toIsoDateKey(iso)
  if (!key) return true
  return key >= debut && key <= fin
}

function buildOfficialPostBody(body: SearchEtatMontantsCollectesBody) {
  return {
    codeAgence: str(body.codeAgence),
    codeDir: str(body.codeDir ?? body.direction),
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
  }
}

function buildPostBody(body: SearchEtatMontantsCollectesBody, query: SearchEtatMontantsCollectesQuery) {
  const typeId = str(query.idTypeCollect ?? query.typeCollect)
  const codeOper = str(query.codeOper)
  const codeDir = str(body.codeDir ?? body.direction)
  return {
    codeAgence: body.codeAgence,
    agence: body.codeAgence,
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    ...(codeDir ? { codeDir, codeDirection: codeDir, direction: codeDir } : {}),
    ...(typeId ? { idTypeCollect: typeId, typeCollect: typeId } : {}),
    ...(codeOper ? { codeOper } : {}),
    ...(query.client ? { client: query.client, nomClient: query.client } : {}),
    ...(query.collecteur ? { collecteur: query.collecteur, loginCollecteur: query.collecteur } : {}),
    ...(query.carte ? { carte: query.carte, numAbonnement: query.carte } : {}),
  }
}

function buildQueryParams(query: SearchEtatMontantsCollectesQuery): Record<string, string | undefined> {
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

function isOfficialClientMontantCollecteRow(r: Record<string, unknown>): boolean {
  return Boolean(
    str(r.nomclient) ||
      (str(r.codeclt) && (str(r.loginclient) || str(r.gsmprincipale))),
  )
}

export function mapRawToEtatMontantCollecteRow(raw: unknown, idx: number): EtatMontantCollecteRow {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Summary & Record<string, unknown>

  if (isOfficialClientMontantCollecteRow(r)) {
    const codeClient = str(r.codeClient ?? r.codecliorig)
    const loginclient = str(r.loginclient ?? r.gsmprincipale)
    return {
      rowKey: codeClient || loginclient || str(r.codeclt) || `row-${idx}`,
      numEnreg: str(r.codeclt ?? r.numniv),
      datePaiem: str(r.dateconnexion ?? r.datecreation),
      numAbonnement: loginclient,
      client: str(r.nomclient ?? r.nomClient),
      collecteur: str(r.login ?? r.nomCollecteur ?? r.leCollecteur ?? r.collecteur),
      typeCollecte: str(r.profession ?? r.codeactivite ?? r.leCollecte ?? r.typeCollecte),
      reference: codeClient || str(r.codeclt),
      mtContrat: num(r.mtContrat ?? r.montantContrat ?? r.montantMise ?? r.x1),
      mtCollecte: num(r.montant ?? r.mtCollecte ?? r.montantCollecte ?? r.montantCollect),
    }
  }

  const reference = str(r.reference ?? r.codeClient ?? r.codecliorig)
  const numAbonnement = str(
    r.numabonnement ??
      r.numAbonnement ??
      r.numabonnemnt ??
      r.numAbonnemnt ??
      r.numeroCompte ??
      r.loginclient ??
      r.gsmprincipale,
  )
  const collecteur = str(
    r.nomCollecteur ?? r.leCollecteur ?? r.collecteur ?? r.codeCollect ?? r.login,
  )
  const typeCollecte = str(
    r.leCollecte ??
      r.typeCollecte ??
      r.libelleTypeCollect ??
      r.codetypcol ??
      r.collecte ??
      r.motif ??
      r.profession ??
      r.codeactivite,
  )
  const dateRaw = str(
    r.heureoperation ??
      r.date0peration ??
      r.datePaiem ??
      r.dateCollecte ??
      r.date ??
      r.dateconnexion ??
      r.datecreation,
  )
  const mtCollecte = num(r.montant ?? r.mtCollecte ?? r.montantCollecte ?? r.montantCollect)
  const mtContrat = num(
    r.mtContrat ?? r.montantContrat ?? r.montantCollect ?? r.x1 ?? r.montantMise,
  )
  return {
    rowKey: reference || numAbonnement || str(r.codeClient) || `row-${idx}`,
    numEnreg: str(r.numgichet ?? r.numGuichet ?? r.numEnreg ?? r.numenreg ?? r.codeclt),
    datePaiem: dateRaw,
    numAbonnement,
    client: str(r.nomClient ?? r.nomclient ?? r.client ?? r.codeClient),
    collecteur,
    typeCollecte,
    reference,
    mtContrat,
    mtCollecte,
  }
}

function applyClientFilters(
  rows: EtatMontantCollecteRow[],
  body: SearchEtatMontantsCollectesBody,
  query: SearchEtatMontantsCollectesQuery,
  skipDateFilter = false,
): EtatMontantCollecteRow[] {
  const collecteurQ = str(query.collecteur).toLowerCase()
  const clientQ = str(query.client).toLowerCase()
  const carteQ = str(query.carte).toLowerCase()
  const typeQ = str(query.idTypeCollect ?? query.typeCollect ?? query.codeOper).toLowerCase()

  return rows.filter((row) => {
    if (!skipDateFilter && !inDateRange(row.datePaiem, body.dateDebut, body.dateFin)) return false
    if (collecteurQ) {
      const c = row.collecteur.toLowerCase()
      if (!c.includes(collecteurQ)) return false
    }
    if (clientQ) {
      const haystack = [row.client, row.numAbonnement, row.reference, row.numEnreg]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(clientQ)) return false
    }
    if (carteQ) {
      const haystack = [row.numAbonnement, row.reference, row.numEnreg].join(' ').toLowerCase()
      if (!haystack.includes(carteQ)) return false
    }
    if (typeQ) {
      const t = row.typeCollecte.toLowerCase()
      if (!t.includes(typeQ)) return false
    }
    return true
  })
}

async function tryOfficialPost(
  body: SearchEtatMontantsCollectesBody,
): Promise<unknown[] | null> {
  const codeAgence = str(body.codeAgence)
  const codeDir = str(body.codeDir ?? body.direction)
  if (!codeAgence || !codeDir) return null

  try {
    const res = await apiFetch(OFFICIAL_POST_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      body: JSON.stringify(buildOfficialPostBody(body)),
    })
    const raw = await readJsonIfOk<unknown>(res, `Search montants collectés failed (${res.status})`)
    return extractListFromApiEnvelope(raw)
  } catch {
    return null
  }
}

async function tryDedicatedPost(
  body: SearchEtatMontantsCollectesBody,
  query: SearchEtatMontantsCollectesQuery,
): Promise<{ list: unknown[]; official: boolean } | null> {
  const paths = CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_POST_PATHS
  const q = buildQueryParams(query)

  for (const path of paths) {
    const official = isOfficialMontantCollectePath(path)
    const payload = official ? buildOfficialPostBody(body) : buildPostBody(body, query)
    if (official && (!str(body.codeAgence) || !str(body.codeDir ?? body.direction))) continue

    try {
      const res = await apiFetch(appendQuery(path, q), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(payload),
      })
      const raw = await readJsonIfOk<unknown>(res, `Search montants collectés failed (${res.status})`)
      const list = extractListFromApiEnvelope(raw)
      if (official || list.length) return { list, official }
    } catch {
      /* next path */
    }
  }
  return null
}

async function fallbackDashboardRows(
  body: SearchEtatMontantsCollectesBody,
  query: SearchEtatMontantsCollectesQuery,
): Promise<unknown[]> {
  const rows = await getDashboardMontantsCollectes({
    agence: body.codeAgence,
    search: query.client,
    all: true,
  })
  return rows.filter((row) => inDateRange(str(row.date0peration), body.dateDebut, body.dateFin))
}

async function fallbackHistoriqueRows(body: SearchEtatMontantsCollectesBody): Promise<unknown[]> {
  const res = await searchHistoriqueComptable({
    codeAgence: body.codeAgence,
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    mode: 'collecte',
  })
  return res.details.map((d) => ({
    numgichet: d.numGuichet,
    date0peration: d.dateCollecte,
    leCollecte: d.leCollecte,
    nomCollecteur: d.leCollecteur,
    montant: d.montantCollecte,
    reference: d.clefExtraction,
    compteLes: d.compteLes,
    compteLce: d.compteLce,
  }))
}

/** Liste des montants collectés (écran état) — essaie plusieurs endpoints puis repli historique / dashboard. */
export async function searchEtatMontantsCollectes(
  body: SearchEtatMontantsCollectesBody,
  query: SearchEtatMontantsCollectesQuery = {},
): Promise<EtatMontantCollecteRow[]> {
  let rawList: unknown[] = []
  let officialResponded = false

  const official = await tryOfficialPost(body)
  if (official !== null) {
    rawList = official
    officialResponded = true
  } else {
    const dedicated = await tryDedicatedPost(body, query)
    if (dedicated) {
      rawList = dedicated.list
      officialResponded = dedicated.official
    }
  }

  if (!officialResponded) {
    const dashboardRows = await fallbackDashboardRows(body, query)
    rawList = dashboardRows.length ? dashboardRows : await fallbackHistoriqueRows(body)
  }

  const mapped = rawList.map((row, idx) => mapRawToEtatMontantCollecteRow(row, idx))
  return applyClientFilters(mapped, body, query, officialResponded)
}
