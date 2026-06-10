import { appendQuery, readJsonIfOk } from './api-json'
import { searchAbonnements } from './abonnement'
import { apiFetch } from './http'
import { searchHistoriqueComptable } from './historique-comptable'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'

export type CourbeCollectPoint = {
  date: string
  montantCollecte: number
  commission: number
}

export type CourbeCollectQuery = {
  dateDebut: string
  dateFin: string
  /** Code agence (vide si filtre dashboard = « Toutes »). */
  agence?: string
  direction?: string
  institution?: string
  /** Liste des agences de la direction quand agence = Toutes. */
  agencyCodes?: string[]
}

function apiDirection(query: CourbeCollectQuery): string | undefined {
  const d = String(query.direction ?? '').trim()
  return d && d !== 'Toutes' ? d : undefined
}

function apiInstitution(query: CourbeCollectQuery): string | undefined {
  const i = String(query.institution ?? '').trim()
  return i && i !== 'Toutes' ? i : undefined
}

function resolveAgencyCodes(query: CourbeCollectQuery): string[] {
  const single = String(query.agence ?? '').trim()
  if (single) return [single]
  const fromDirection = (query.agencyCodes ?? []).map((c) => c.trim()).filter(Boolean)
  if (fromDirection.length) return [...new Set(fromDirection)]
  const session = getConnectedUserCodeAgence()
  return session ? [session] : []
}

function courbePostBody(query: CourbeCollectQuery, agence: string) {
  const direction = apiDirection(query)
  const institution = apiInstitution(query)
  return {
    dateDebut: query.dateDebut,
    dateFin: query.dateFin,
    agence,
    codeAgence: agence,
    direction,
    codeDirection: direction,
    institution,
    codeInstitution: institution,
  }
}

function searchQueryOpts(query: CourbeCollectQuery) {
  return {
    all: true as const,
    direction: apiDirection(query),
    institution: apiInstitution(query),
  }
}

export type CourbeCollectResult = {
  collecteJour: CourbeCollectPoint[]
  collecteAnnee: CourbeCollectPoint[]
}

type RawRow = {
  date: string
  montantCollecte: number
  commission: number
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
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const dd = m[1].padStart(2, '0')
    const mm = m[2].padStart(2, '0')
    let yy = m[3]
    if (yy.length === 2) yy = `20${yy}`
    return `${yy}-${mm}-${dd}`
  }
  try {
    const d = new Date(s.includes('T') ? s : `${s}T12:00:00`)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch {
    /* keep */
  }
  return s
}

function enumerateDays(dateDebut: string, dateFin: string): string[] {
  const start = new Date(`${dateDebut}T00:00:00`)
  const end = new Date(`${dateFin}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []
  const out: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function enumerateMonths(dateDebut: string, dateFin: string): string[] {
  const y0 = Number.parseInt(dateDebut.slice(0, 4), 10)
  const y1 = Number.parseInt(dateFin.slice(0, 4), 10)
  if (!Number.isFinite(y0) || !Number.isFinite(y1)) return []
  const start = Math.min(y0, y1)
  const end = Math.max(y0, y1)
  const out: string[] = []
  for (let year = start; year <= end; year++) {
    for (let m = 1; m <= 12; m++) {
      out.push(`${year}-${String(m).padStart(2, '0')}`)
    }
  }
  return out
}

type Bucket = { montantCollecte: number; commission: number }

function addToBucket(map: Map<string, Bucket>, key: string, row: RawRow) {
  const prev = map.get(key) ?? { montantCollecte: 0, commission: 0 }
  map.set(key, {
    montantCollecte: prev.montantCollecte + row.montantCollecte,
    commission: prev.commission + row.commission,
  })
}

export function aggregateCollecteJour(
  rows: RawRow[],
  dateDebut: string,
  dateFin: string,
): CourbeCollectPoint[] {
  const byDay = new Map<string, Bucket>()
  for (const row of rows) {
    const key = toIsoDateKey(row.date)
    if (!key) continue
    addToBucket(byDay, key, row)
  }
  return enumerateDays(dateDebut, dateFin).map((date) => {
    const b = byDay.get(date) ?? { montantCollecte: 0, commission: 0 }
    return { date, montantCollecte: b.montantCollecte, commission: b.commission }
  })
}

export function aggregateCollecteAnnee(
  rows: RawRow[],
  dateDebut: string,
  dateFin: string,
): CourbeCollectPoint[] {
  const byMonth = new Map<string, Bucket>()
  for (const row of rows) {
    const day = toIsoDateKey(row.date)
    if (!day || day.length < 7) continue
    addToBucket(byMonth, day.slice(0, 7), row)
  }
  return enumerateMonths(dateDebut, dateFin).map((date) => {
    const b = byMonth.get(date) ?? { montantCollecte: 0, commission: 0 }
    return { date, montantCollecte: b.montantCollecte, commission: b.commission }
  })
}

function parseItemToRawRow(item: unknown): RawRow | null {
  const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
  const date = toIsoDateKey(
    String(r.date ?? r.jour ?? r.dateCollecte ?? r.date0peration ?? r.dateAbonnement ?? r.heureoperation ?? ''),
  )
  if (!date) return null
  return {
    date,
    montantCollecte: num(
      r.montantCollecte ?? r.montantCollect ?? r.montant ?? r.total ?? r.valeur,
    ),
    commission: num(r.commission ?? r.montantCommission ?? r.montantCommision),
  }
}

function parseRawRows(list: unknown[]): RawRow[] {
  return list.map(parseItemToRawRow).filter((p): p is RawRow => p != null)
}

function parsePointsList(list: unknown[], monthKeys = false): CourbeCollectPoint[] {
  return list
    .map((item) => {
      const row = parseItemToRawRow(item)
      if (!row) return null
      return {
        date: monthKeys && row.date.length >= 7 ? row.date.slice(0, 7) : row.date,
        montantCollecte: row.montantCollecte,
        commission: row.commission,
      }
    })
    .filter((p): p is CourbeCollectPoint => p != null)
}

function parseDualFromApi(raw: unknown, query: CourbeCollectQuery): CourbeCollectResult | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const jourRaw = o.collecteJour ?? o.collecte_jour ?? o.jour ?? o.parJour
  const anneeRaw = o.collecteAnnee ?? o.collecte_annee ?? o.annee ?? o.parAnnee ?? o.parMois

  const jourList = jourRaw != null ? extractListFromApiEnvelope(jourRaw) : []
  const anneeList = anneeRaw != null ? extractListFromApiEnvelope(anneeRaw) : []

  if (!jourList.length && !anneeList.length) return null

  const jourRows = parseRawRows(jourList)
  const anneeRows = parseRawRows(anneeList)

  return {
    collecteJour:
      jourRows.length > 0
        ? aggregateCollecteJour(jourRows, query.dateDebut, query.dateFin)
        : parsePointsList(jourList),
    collecteAnnee:
      anneeRows.length > 0
        ? aggregateCollecteAnnee(anneeRows, query.dateDebut, query.dateFin)
        : parsePointsList(anneeList, true).length > 0
          ? aggregateCollecteAnnee(
              parsePointsList(anneeList, true).map((p) => ({
                date: `${p.date}-01`,
                montantCollecte: p.montantCollecte,
                commission: p.commission,
              })),
              query.dateDebut,
              query.dateFin,
            )
          : [],
  }
}

function buildFromRawRows(rows: RawRow[], query: CourbeCollectQuery): CourbeCollectResult {
  return {
    collecteJour: aggregateCollecteJour(rows, query.dateDebut, query.dateFin),
    collecteAnnee: aggregateCollecteAnnee(rows, query.dateDebut, query.dateFin),
  }
}

async function fallbackAbonnementRaw(query: CourbeCollectQuery, agence: string): Promise<RawRow[]> {
  if (!agence) return []

  const env = await searchAbonnements(
    {
      agence,
      status: '1',
      dateDebut: query.dateDebut,
      dateFin: query.dateFin,
    },
    searchQueryOpts(query),
  )
  return parseRawRows(extractListFromApiEnvelope(env))
}

async function fallbackHistoriqueRaw(query: CourbeCollectQuery, agence: string): Promise<RawRow[]> {
  if (!agence) return []

  const direction = apiDirection(query)
  const institution = apiInstitution(query)

  const res = await searchHistoriqueComptable({
    codeAgence: agence,
    dateDebut: query.dateDebut,
    dateFin: query.dateFin,
    mode: 'collecte',
    codeDirection: direction,
    direction,
    institution,
    codeInstitution: institution,
  })

  return res.details.map((d) => ({
    date: d.dateCollecte,
    montantCollecte: d.montantCollecte ?? 0,
    commission: 0,
  }))
}

const CUSTOM_PATH = import.meta.env.VITE_COURBE_COLLECT_PATH as string | undefined

const DEFAULT_PATHS = [
  '/api/dashboard/courbe-collect',
  '/api/collecte/courbe',
  '/api/operation/courbe-collect',
]

async function fallbackRawForAgence(query: CourbeCollectQuery, agence: string): Promise<RawRow[]> {
  const ab = await fallbackAbonnementRaw(query, agence)
  if (ab.length) return ab
  return fallbackHistoriqueRaw(query, agence)
}

async function fetchDedicatedForAgence(query: CourbeCollectQuery, agence: string): Promise<RawRow[] | null> {
  const paths = CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_PATHS

  for (const path of paths) {
    try {
      const res = await apiFetch(appendQuery(path, searchQueryOpts(query)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(courbePostBody(query, agence)),
      })
      const raw = await readJsonIfOk<unknown>(res, `Courbe collect failed (${res.status})`)
      const rows = parseRawRows(extractListFromApiEnvelope(raw))
      if (rows.length) return rows
      const dual = parseDualFromApi(raw, query)
      if (dual?.collecteJour.length) {
        return dual.collecteJour.map((p) => ({
          date: p.date,
          montantCollecte: p.montantCollecte,
          commission: p.commission,
        }))
      }
    } catch {
      /* next */
    }
  }
  return null
}

async function fetchRawForAgence(query: CourbeCollectQuery, agence: string): Promise<RawRow[]> {
  const dedicated = await fetchDedicatedForAgence(query, agence)
  if (dedicated?.length) return dedicated
  return fallbackRawForAgence(query, agence)
}

/** Courbes jour + année avec montant collecté et commissions (filtres agence / direction / institution). */
export async function getCourbeCollect(query: CourbeCollectQuery): Promise<CourbeCollectResult> {
  const agencies = resolveAgencyCodes(query)
  if (!agencies.length) {
    throw new Error(
      'Sélectionnez une agence ou une direction dans les filtres du tableau de bord (barre latérale / Administration).',
    )
  }

  const allRows: RawRow[] = []
  for (const code of agencies) {
    const rows = await fetchRawForAgence(query, code)
    allRows.push(...rows)
  }

  return buildFromRawRows(allRows, query)
}
