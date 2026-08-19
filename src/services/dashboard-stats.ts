import { appendQuery, parseJsonOrText, pickErrorMessage } from '@/services/api-json'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { dashboardFiltersToApiQuery, type DashboardFilterFields } from '@/utils/dashboard-filter-query'
import { apiFetch } from './http'
import type { DashboardTileSnapshot } from './dashboard-tiles'

export const DASHBOARD_STATS_PATH =
  (import.meta.env.VITE_DASHBOARD_STATS_PATH as string | undefined)?.trim() || '/api/dashboard/stats'

export type DashboardStatsQuery = {
  direction?: string
  agence?: string
  institution?: string
  /** Optionnel: période (permet d'afficher des dates antérieures). */
  dateDebut?: string
  dateFin?: string
  /** Filtrer par collecteur (login/code) quand le backend le supporte. */
  collecteur?: string
}

export function dashboardStatsQueryFromFilters(f: DashboardFilterFields): DashboardStatsRequestQuery {
  const q = dashboardFiltersToApiQuery(f)
  return {
    direction: q.direction,
    agence: q.agence,
    institution: q.institution,
    all: q.all,
  }
}

export type DashboardStatsRequestQuery = DashboardStatsQuery & { all?: boolean }

/** Champs renvoyés par `GET /api/dashboard/stats` dans `data`. */
export type DashboardStatsDto = {
  collecteurTotal?: number
  collecteurEnLigne?: number
  montantCollectes?: number
  operationEffectues?: number
  chargeEpargne?: number
  carteVendues?: number
  operationAnnules?: number
  montantVerses?: number
  ayantCollectes?: number
  clientInactifs?: number
}

const STATS_FIELD_KEYS: Record<keyof DashboardTileSnapshot, string[]> = {
  collecteursEnLigne: ['collecteurEnLigne', 'collecteursEnLigne', 'collecteurs_en_ligne'],
  montantsCollectes: ['montantCollectes', 'montantsCollectes', 'montants_collectes'],
  nombreOperations: ['operationEffectues', 'operationsEffectuees', 'nombreOperations'],
  chargesEpargne: ['chargeEpargne', 'chargesEpargne', 'charges_epargne'],
  nombreCartesVendues: ['carteVendues', 'nombreCartesVendues', 'cartesVendues'],
  operationsAnnulees: ['operationAnnules', 'operationsAnnulees', 'operations_annulees'],
  montantsVerses: ['montantVerses', 'montantsVerses', 'montants_verses'],
  collecteursAyantCollecte: ['ayantCollectes', 'collecteursAyantCollecte', 'collecteurs_ayant_collecte'],
  collecteursTotal: ['collecteurTotal', 'collecteursTotal', 'nombreCollecteurs', 'totalCollecteurs'],
  clientsInactifs: ['clientInactifs', 'clientsInactifs', 'nombreClientsInactifs', 'clientInactif'],
}

function pickFiniteNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = source[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(String(v).replace(/\s+/g, '').replace(',', '.'))
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function unwrapStatsBody(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>
  if (root.status === 401 || root.error) return null

  const candidates: unknown[] = [root.data, root.stats, root.result, root.payload, root]
  for (const c of candidates) {
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      return c as Record<string, unknown>
    }
  }
  return root
}

export function mapDashboardStatsResponse(data: unknown): DashboardTileSnapshot {
  const body = unwrapStatsBody(data) ?? {}
  const snapshot = {} as DashboardTileSnapshot
  for (const key of Object.keys(STATS_FIELD_KEYS) as (keyof DashboardTileSnapshot)[]) {
    snapshot[key] = pickFiniteNumber(body, STATS_FIELD_KEYS[key])
  }
  return snapshot
}

function hasAnyStat(snapshot: DashboardTileSnapshot): boolean {
  return Object.values(snapshot).some((v) => v !== null)
}

function statsBasePath(): string {
  return (DASHBOARD_STATS_PATH.startsWith('/') ? DASHBOARD_STATS_PATH : `/${DASHBOARD_STATS_PATH}`).replace(
    /\/$/,
    '',
  )
}

/** Code agence transmis en query (`codeAgence`), pas dans le path URL. */
export function resolveStatsCodeAgence(query: DashboardStatsRequestQuery): string | undefined {
  const fromFilter = String(query.agence ?? '').trim()
  if (!fromFilter || fromFilter === 'Toutes') return query.all ? undefined : getConnectedUserCodeAgence() || undefined
  if (query.all) return fromFilter || undefined
  if (fromFilter) return fromFilter
  return getConnectedUserCodeAgence() || undefined
}

function buildStatsRequestQuery(
  query: DashboardStatsRequestQuery,
): Record<string, string | boolean | undefined> {
  const directionRaw = String(query.direction ?? '').trim()
  const agenceRaw = String(query.agence ?? '').trim()
  const institutionRaw = String(query.institution ?? '').trim()
  const dateDebutRaw = String(query.dateDebut ?? '').trim()
  const dateFinRaw = String(query.dateFin ?? '').trim()
  const direction = directionRaw && directionRaw !== 'Toutes' ? directionRaw : ''
  const agence = agenceRaw && agenceRaw !== 'Toutes' ? agenceRaw : ''
  const institution = institutionRaw && institutionRaw !== 'Toutes' ? institutionRaw : ''
  const dateDebut = dateDebutRaw ? dateDebutRaw : ''
  const dateFin = dateFinRaw ? dateFinRaw : ''
  const codeAgence = resolveStatsCodeAgence(query)
  const collecteur = String(query.collecteur ?? '').trim()

  if (query.all) {
    return {
      all: true,
      codeAgence: codeAgence || agence || undefined,
      // Backends are inconsistent: send both keys.
      codeDirection: direction || undefined,
      codeDir: direction || undefined,
      institution: institution || undefined,
      codeInstitution: institution || undefined,
      // Backends are inconsistent: send multiple likely keys.
      collecteur: collecteur || undefined,
      login: collecteur || undefined,
      dateDebut: dateDebut || undefined,
      dateFin: dateFin || undefined,
    }
  }

  return {
    codeAgence: codeAgence || agence || undefined,
    agence: agence || codeAgence || undefined,
    direction: direction || undefined,
    // Backends are inconsistent: send both keys.
    codeDirection: direction || undefined,
    codeDir: direction || undefined,
    institution: institution || undefined,
    codeInstitution: institution || undefined,
    collecteur: collecteur || undefined,
    login: collecteur || undefined,
    dateDebut: dateDebut || undefined,
    dateFin: dateFin || undefined,
  }
}

export async function getDashboardStats(
  query: DashboardStatsRequestQuery = {},
): Promise<DashboardTileSnapshot> {
  const codeAgence = resolveStatsCodeAgence(query)
  if (!codeAgence && !query.all) {
    throw new Error(
      'Sélectionnez une agence, « Toutes », ou une direction « Toutes » pour charger les statistiques.',
    )
  }

  const url = appendQuery(statsBasePath(), buildStatsRequestQuery(query))
  const res = await apiFetch(url, { method: 'GET', headers: { accept: 'application/json' } })
  const data = await parseJsonOrText(res)
  if (!res.ok) {
    throw new Error(pickErrorMessage(data, `Statistiques dashboard indisponibles (${res.status})`))
  }
  const snapshot = mapDashboardStatsResponse(data)
  if (!hasAnyStat(snapshot)) {
    throw new Error('Réponse statistiques dashboard vide ou non reconnue')
  }
  return snapshot
}
