import { appendQuery, readJsonIfOk } from './api-json'
import { mapRawToEnvoiDemandeClientRow } from './pret-envoi-demande'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'

export type SearchDeblocagePretsQuery = {
  codeAgence?: string
  direction?: string
  institution?: string
  login?: string
}

export type DeblocagePretRow = {
  rowKey: string
  idDemande: number | undefined
  nomClient: string
  montantPret: number | undefined
  dateDemande: string
  motif: string
  agence: string
  typePret: string
  cppId: string
  codeDir: string
  wnvId: string
}

export type DeblocagePretBody = {
  idDemande?: number
  wnvId?: string | number
  cppId?: string
  login?: string
  codeAgence?: string
}

const LIST_CUSTOM_PATH = import.meta.env.VITE_PRET_DEBLOCAGE_LIST_PATH as string | undefined
const DEBLOCAGE_CUSTOM_PATH = import.meta.env.VITE_PRET_DEBLOCAGE_PATH as string | undefined
const CONTRAT_CUSTOM_PATH = import.meta.env.VITE_PRET_CONTRAT_PATH as string | undefined

const DEFAULT_LIST_PATHS = [
  '/api/pret/deblocage',
  '/api/pret/demandes-deblocage',
  '/api/pret/list-deblocage',
  '/api/pret/a-debloquer',
  '/api/pret/envoi-demande-client',
  '/api/pret/valid-pret-coopec',
]

const DEFAULT_DEBLOCAGE_PATHS = [
  '/api/pret/debloquer',
  '/api/pret/deblocage/executer',
  '/api/pret/deblocage',
]

const contratPaths = (id: number | string) => [
  CONTRAT_CUSTOM_PATH?.trim()
    ? CONTRAT_CUSTOM_PATH.replace('{id}', String(id))
    : '',
  `/api/pret/contrat/${encodeURIComponent(String(id))}`,
  `/api/pret/imprimer-contrat/${encodeURIComponent(String(id))}`,
  `/api/pret/deblocage/contrat/${encodeURIComponent(String(id))}`,
].filter(Boolean)

export function mapRawToDeblocagePretRow(raw: unknown, idx: number): DeblocagePretRow | null {
  const mapped = mapRawToEnvoiDemandeClientRow(raw, idx)
  if (!mapped) return null
  const { loginValid: _, ...row } = mapped
  return row
}

async function tryListPaths(query: SearchDeblocagePretsQuery): Promise<DeblocagePretRow[] | null> {
  const paths = LIST_CUSTOM_PATH?.trim() ? [LIST_CUSTOM_PATH.trim()] : DEFAULT_LIST_PATHS
  const q = {
    all: 'true',
    codeAgence: query.codeAgence,
    agence: query.codeAgence,
    direction: query.direction,
    institution: query.institution,
    login: query.login,
  }

  for (const path of paths) {
    for (const method of ['GET', 'POST'] as const) {
      try {
        const res = await apiFetch(appendQuery(path, q), {
          method,
          headers:
            method === 'POST'
              ? { 'Content-Type': 'application/json', accept: '*/*' }
              : { accept: '*/*' },
          body: method === 'POST' ? JSON.stringify(q) : undefined,
        })
        const raw = await readJsonIfOk<unknown>(res, `Déblocage prêts failed (${res.status})`)
        const list = extractListFromApiEnvelope(raw)
        const mapped = list
          .map((row, idx) => mapRawToDeblocagePretRow(row, idx))
          .filter((r): r is DeblocagePretRow => r != null)
        if (mapped.length) return mapped
      } catch {
        /* next */
      }
    }
  }
  return null
}

/** Liste des prêts en attente de déblocage. */
export async function searchDeblocagePrets(query: SearchDeblocagePretsQuery): Promise<DeblocagePretRow[]> {
  const list = await tryListPaths(query)
  return list ?? []
}

/** Débloquer le prêt pour la demande sélectionnée. */
export async function debloquerPret(body: DeblocagePretBody): Promise<void> {
  const paths = DEBLOCAGE_CUSTOM_PATH?.trim() ? [DEBLOCAGE_CUSTOM_PATH.trim()] : DEFAULT_DEBLOCAGE_PATHS
  let lastErr: Error | null = null

  for (const path of paths) {
    try {
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(body),
      })
      await readJsonIfOk<unknown>(res, `Déblocage failed (${res.status})`)
      return
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastErr ?? new Error('Déblocage impossible')
}

/** Télécharge le contrat PDF depuis l'API si disponible. */
export async function fetchContratPretBlob(idDemande: number | string): Promise<Blob | null> {
  for (const path of contratPaths(idDemande)) {
    try {
      const res = await apiFetch(path, { method: 'GET', headers: { accept: 'application/pdf,*/*' } })
      if (!res.ok) continue
      const blob = await res.blob()
      if (blob.size > 0) return blob
    } catch {
      /* next */
    }
  }
  return null
}

export function defaultContratFilename(idDemande: number | string): string {
  const d = new Date().toISOString().slice(0, 10)
  return `contrat_pret_${idDemande}_${d}.pdf`
}
