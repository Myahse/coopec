import { appendQuery, readJsonIfOk } from './api-json'
import { mapRawToWorkflowPretRow } from './pret-workflow'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { VValidPretCoopec } from './openapi-components'

export type SearchEnvoiDemandeClientQuery = {
  codeAgence?: string
  direction?: string
  institution?: string
  login?: string
}

export type EnvoiDemandeClientRow = {
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
  loginValid: string
}

export type SoumissionOffreBody = {
  idDemande?: number
  wnvId?: string | number
  cppId?: string
  login?: string
  codeAgence?: string
}

const LIST_CUSTOM_PATH = import.meta.env.VITE_PRET_ENVOI_DEMANDE_LIST_PATH as string | undefined
const SOUMISSION_CUSTOM_PATH = import.meta.env.VITE_PRET_SOUMISSION_OFFRE_PATH as string | undefined

const DEFAULT_LIST_PATHS = [
  '/api/pret/envoi-demande-client',
  '/api/pret/demandes-offre',
  '/api/pret/list-envoi-client',
  '/api/pret/demandes-a-soumettre',
  '/api/pret/workflow',
  '/api/pret/valid-pret-coopec',
]

const DEFAULT_SOUMISSION_PATHS = [
  '/api/pret/soumission-offre',
  '/api/pret/envoi-offre',
  '/api/pret/soumettre-offre',
  '/api/pret/envoi-demande-client/soumettre',
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

export function mapRawToEnvoiDemandeClientRow(raw: unknown, idx: number): EnvoiDemandeClientRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as VValidPretCoopec & Record<string, unknown>
  const base = mapRawToWorkflowPretRow(raw, idx)
  const idDemande = base?.idDemande ?? num(r.idwDemandePret ?? r.idDemande)
  const nomClient = base?.nomClient ?? str(r.nomClient ?? r.NOM_CLIENT)
  if (!nomClient && idDemande == null) return null

  return {
    rowKey: base?.rowKey ?? (idDemande != null ? String(idDemande) : `edc-${idx}`),
    idDemande: idDemande ?? undefined,
    nomClient,
    montantPret: base?.montantPret ?? num(r.montantPret ?? r.MONTANT_PRET),
    dateDemande: base?.dateDemande ?? str(r.dateDemande ?? r.DATE_DEMANDE),
    motif: base?.motif ?? str(r.motif ?? r.MOTIF),
    agence: base?.agence ?? str(r.codeAgence ?? r.AGENCE),
    typePret: base?.typePret ?? str(r.idtypePret ?? r.TYPE_PRET),
    cppId: base?.cppId ?? str(r.cppId ?? r.cpp_id),
    codeDir: base?.codeDir ?? str(r.codeDir ?? r.CODE_DIR),
    wnvId: str(r.wnvId ?? r.WNV_ID ?? r.wnv_id),
    loginValid: str(r.loginValid ?? r.LOGIN_VALID ?? base?.loginValid),
  }
}

async function tryListPaths(query: SearchEnvoiDemandeClientQuery): Promise<EnvoiDemandeClientRow[] | null> {
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
        const raw = await readJsonIfOk<unknown>(res, `Envoi demande client failed (${res.status})`)
        const list = extractListFromApiEnvelope(raw)
        const mapped = list
          .map((row, idx) => mapRawToEnvoiDemandeClientRow(row, idx))
          .filter((r): r is EnvoiDemandeClientRow => r != null)
        if (mapped.length) return mapped
      } catch {
        /* next */
      }
    }
  }
  return null
}

/** Liste des demandes prêt en attente d'envoi / soumission d'offre. */
export async function searchEnvoiDemandeClient(
  query: SearchEnvoiDemandeClientQuery,
): Promise<EnvoiDemandeClientRow[]> {
  const list = await tryListPaths(query)
  return list ?? []
}

/** Soumettre l'offre pour la demande sélectionnée. */
export async function soumettreOffrePret(body: SoumissionOffreBody): Promise<void> {
  const paths = SOUMISSION_CUSTOM_PATH?.trim()
    ? [SOUMISSION_CUSTOM_PATH.trim()]
    : DEFAULT_SOUMISSION_PATHS
  let lastErr: Error | null = null

  for (const path of paths) {
    try {
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(body),
      })
      await readJsonIfOk<unknown>(res, `Soumission offre failed (${res.status})`)
      return
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastErr ?? new Error('Soumission offre impossible')
}
