import { appendQuery, readJsonIfOk } from './api-json'
import { listAbonnementsAdmin } from './administration'
import { apiFetch } from './http'
import { extractDataFromApiEnvelope, extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { DashboardFilterFields } from '@/utils/dashboard-filter-query'
import { dashboardFiltersToApiQuery } from '@/utils/dashboard-filter-query'
import type {
  AbonnementReversementRequestDto,
  AbonnementUpdateCompteRequestDto,
  ApiResponseCompte,
  ApiResponseListWAbonnement,
  ApiResponseString,
  ApiResponseWAbonnement,
  Compte,
  SearchAbonnementDto,
  WAbonnement,
} from './openapi-components'

export type { SearchAbonnementDto as SearchAbonnementBody, WAbonnement as Abonnement }
export type { AbonnementUpdateCompteRequestDto as AbonnementUpdateCompteBody }
export type { AbonnementReversementRequestDto as AbonnementReversementBody }
export type { ApiResponseListWAbonnement, ApiResponseWAbonnement, ApiResponseCompte, ApiResponseString }
export type { Compte as CompteAbonnement } from './openapi-components'

export type PrefixCompteAbonnement = {
  compteClient_prefix?: string
  compteLCE_prefix?: string
  compteLES_prefix?: string
  compteLCE_N_prefix?: string
  compteLES_N_prefix?: string
}

export type ApiResponsePrefixCompte = {
  message?: string
  data?: PrefixCompteAbonnement
  success?: boolean
}

export const ABONNEMENT_SEARCH_STATUS_CODES = ['1', '2', '3', '4', '5'] as const

/** Tokens attendus par POST /api/administration/list-abonnement */
export const ABONNEMENT_ADMIN_STATUS_TOKENS = [
  'active',
  'pleine',
  'reversee',
  'suspendue',
  'suspendue_auto',
] as const

export type AbonnementUiStatusFilter =
  | 'ACTIVEES'
  | 'PLEINES'
  | 'REVERSEES'
  | 'SUSPENDUES'
  | 'SUSPENDUES_AUTO'
  | 'TOUS'

export function abonnementStatusCodesForUiFilter(filter: AbonnementUiStatusFilter): string[] {
  switch (filter) {
    case 'ACTIVEES':
      return ['1']
    case 'PLEINES':
      return ['2']
    case 'REVERSEES':
      return ['3']
    case 'SUSPENDUES':
      return ['4']
    case 'SUSPENDUES_AUTO':
      return ['5']
    case 'TOUS':
      return [...ABONNEMENT_SEARCH_STATUS_CODES]
  }
}

export function abonnementAdminStatusTokensForUiFilter(filter: AbonnementUiStatusFilter): string[] {
  switch (filter) {
    case 'ACTIVEES':
      return ['active']
    case 'PLEINES':
      return ['pleine']
    case 'REVERSEES':
      return ['reversee']
    case 'SUSPENDUES':
      return ['suspendue']
    case 'SUSPENDUES_AUTO':
      return ['suspendue_auto']
    case 'TOUS':
      return [...ABONNEMENT_ADMIN_STATUS_TOKENS]
  }
}

function applyAbonnementPageQueryFilters(
  rows: WAbonnement[],
  query?: SearchAbonnementsPageQuery,
): WAbonnement[] {
  const collecteur = String(query?.collecteur ?? '').trim()
  const search = String(query?.search ?? '').trim().toLowerCase()
  const compte = String(query?.compte ?? '').trim().toLowerCase()

  return rows.filter((row) => {
    if (collecteur && String(row.codeCollect ?? '').trim() !== collecteur) return false
    if (search) {
      const haystack = [row.nomClient, row.codeClient, row.gsmprincipale, row.numeroCompte]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ')
      if (!haystack.includes(search)) return false
    }
    if (compte) {
      const haystack = [
        row.compteLce,
        row.compteLes,
        row.compteLceN,
        row.compteLesN,
        row.numeroCompte,
        row.idwAbonnement,
      ]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ')
      if (!haystack.includes(compte)) return false
    }
    return true
  })
}

function abonnementRowKey(row: WAbonnement): string {
  return String(
    row.idwAbonnement ?? row.numabonnemntTemp ?? `${row.codeClient ?? ''}-${row.dateAbonnement ?? ''}`,
  ).trim()
}

export function mergeAbonnementRows(lists: WAbonnement[][]): WAbonnement[] {
  const seen = new Set<string>()
  const out: WAbonnement[] = []
  for (const list of lists) {
    for (const row of list) {
      const key = abonnementRowKey(row)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(row)
    }
  }
  return out
}

function assertNonEmptyStatus(status: string): string {
  const s = String(status ?? '').trim()
  if (!s) throw new Error('Le statut est obligatoire pour la recherche d’abonnements.')
  return s
}


export function toSearchAbonnementPayload(body: SearchAbonnementDto): SearchAbonnementDto {
  return {
    agence: String(body.agence ?? '').trim(),
    status: assertNonEmptyStatus(body.status),
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
  }
}

export async function searchAbonnements(
  body: SearchAbonnementDto,
  query?: {
    search?: string
    collecteur?: string
    compte?: string
    all?: boolean
    direction?: string
    institution?: string
  },
): Promise<ApiResponseListWAbonnement> {
  const payload = toSearchAbonnementPayload(body)

  const path = appendQuery('/api/abonnement/search', {
    all: query?.all ?? true,
    search: query?.search,
    collecteur: query?.collecteur,
    compte: query?.compte,
    direction: query?.direction,
    institution: query?.institution,
  })

  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(payload),
  })
  return readJsonIfOk<ApiResponseListWAbonnement>(res, `Search abonnements failed (${res.status})`)
}

export type SearchAbonnementsQuery = {
  search?: string
  collecteur?: string
  compte?: string
  all?: boolean
  direction?: string
  institution?: string
}


export type SearchAbonnementsPageQuery = Pick<SearchAbonnementsQuery, 'search' | 'collecteur' | 'compte'>

export async function searchAbonnementsWithDashboardFilters(
  body: SearchAbonnementDto,
  dashboard: DashboardFilterFields,
  query?: SearchAbonnementsPageQuery,
): Promise<ApiResponseListWAbonnement> {
  const scope = dashboardFiltersToApiQuery(dashboard)
  return searchAbonnements(body, {
    ...query,
    all: scope.all ?? true,
    direction: scope.direction ?? scope.codeDirection,
    institution: scope.institution ?? scope.codeInstitution,
  })
}

/** Liste via POST /api/administration/list-abonnement (« Tous » = une requête par statut, puis fusion). */
export async function searchAbonnementsForPage(
  base: Omit<SearchAbonnementDto, 'status'>,
  statusFilter: AbonnementUiStatusFilter,
  _dashboard: DashboardFilterFields,
  query?: SearchAbonnementsPageQuery,
): Promise<WAbonnement[]> {
  const tokens = abonnementAdminStatusTokensForUiFilter(statusFilter)
  const payloadBase = {
    agence: String(base.agence ?? '').trim(),
    dateDebut: base.dateDebut,
    dateFin: base.dateFin,
  }

  const lists = await Promise.all(
    tokens.map(async (status) => {
      const env = await listAbonnementsAdmin(
        { ...payloadBase, status },
        { carte: query?.compte },
      )
      return extractListFromApiEnvelope(env) as WAbonnement[]
    }),
  )

  return applyAbonnementPageQueryFilters(mergeAbonnementRows(lists), query)
}

export async function updateCompteAbonnement(body: AbonnementUpdateCompteRequestDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/abonnement/update-compte', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Update compte abonnement failed (${res.status})`)
}

export async function reversementAbonnement(body: AbonnementReversementRequestDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/abonnement/reversement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Reversement abonnement failed (${res.status})`)
}

export async function getAbonnement(abonnement: string): Promise<ApiResponseWAbonnement> {
  const a = String(abonnement ?? '').trim()
  if (!a) throw new Error('abonnement is required')

  const res = await apiFetch(`/api/abonnement/${encodeURIComponent(a)}`, { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseWAbonnement>(res, `Get abonnement failed (${res.status})`)
}

export async function getCompteAbonnement(numAbonnement: string): Promise<ApiResponseCompte> {
  const n = String(numAbonnement ?? '').trim()
  if (!n) throw new Error('numAbonnement is required')

  const res = await apiFetch(`/api/abonnement/get-compte/${encodeURIComponent(n)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponseCompte>(res, `Get compte abonnement failed (${res.status})`)
}

export async function getPrefixCompteAbonnement(numAbonnement: string): Promise<ApiResponsePrefixCompte> {
  const n = String(numAbonnement ?? '').trim()
  if (!n) throw new Error('numAbonnement is required')

  const res = await apiFetch(`/api/abonnement/prefix-compte/${encodeURIComponent(n)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponsePrefixCompte>(res, `Prefix compte abonnement failed (${res.status})`)
}

export function abonnementNumero(row: WAbonnement): string {
  return String(row.idwAbonnement ?? row.numabonnemntTemp ?? row.numeroCompte ?? '').trim()
}

export async function loadAbonnementDetail(abonnement: string): Promise<WAbonnement | null> {
  const env = await getAbonnement(abonnement)
  return extractDataFromApiEnvelope<WAbonnement>(env)
}

export async function loadCompteAbonnement(numAbonnement: string): Promise<{
  compte: Compte | null
  prefix: PrefixCompteAbonnement | null
}> {
  const [compteEnv, prefixEnv] = await Promise.all([
    getCompteAbonnement(numAbonnement),
    getPrefixCompteAbonnement(numAbonnement),
  ])
  return {
    compte: extractDataFromApiEnvelope(compteEnv),
    prefix: extractDataFromApiEnvelope(prefixEnv),
  }
}
