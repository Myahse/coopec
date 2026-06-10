import { appendQuery, readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { ValidPretRequest, VValidPretCoopec } from './openapi-components'

export type SearchWorkflowPretQuery = {
  codeAgence?: string
  direction?: string
  institution?: string
  login?: string
}

export type WorkflowPretRow = {
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
  loginValid: string
}

export type PretPieceRow = {
  id: string
  label: string
  url?: string
  contentType?: string
}

const LIST_CUSTOM_PATH = import.meta.env.VITE_PRET_WORKFLOW_LIST_PATH as string | undefined
const VALID_CUSTOM_PATH = import.meta.env.VITE_PRET_WORKFLOW_VALID_PATH as string | undefined
const REJECT_CUSTOM_PATH = import.meta.env.VITE_PRET_WORKFLOW_REJECT_PATH as string | undefined

const DEFAULT_LIST_PATHS = [
  '/api/pret/workflow',
  '/api/pret/demandes-a-valider',
  '/api/pret/valid-pret-coopec',
  '/api/pret/list-workflow',
  '/api/pret/workflow-list',
]

const DEFAULT_VALID_PATHS = [
  '/api/pret/valider',
  '/api/pret/valid',
  '/api/pret/workflow/valider',
  '/api/pret/accept',
]

const DEFAULT_REJECT_PATHS = [
  '/api/pret/rejeter',
  '/api/pret/reject',
  '/api/pret/workflow/rejeter',
]

const PIECES_PATHS = (id: number | string) => [
  `/api/pret/pieces/${encodeURIComponent(String(id))}`,
  `/api/pret/documents/${encodeURIComponent(String(id))}`,
  `/api/pret/demande/${encodeURIComponent(String(id))}/pieces`,
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

export function mapRawToWorkflowPretRow(raw: unknown, idx: number): WorkflowPretRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as VValidPretCoopec & Record<string, unknown>

  const idDemande = num(r.idwDemandePret ?? r.idDemande ?? r.id)
  const nomClient = str(r.nomClient ?? r.NOM_CLIENT ?? r.client)
  const dateDemande = str(r.dateDemande ?? r.DATE_DEMANDE ?? r.date)
  const agence = str(r.codeAgence ?? r.agence ?? r.AGENCE)
  const cppId = str(r.cppId ?? r.cpp_id ?? r.CPP_ID)

  if (!nomClient && !idDemande && !dateDemande) return null

  const rowKey = idDemande != null ? String(idDemande) : `wf-${idx}`

  return {
    rowKey,
    idDemande: idDemande != null ? idDemande : undefined,
    nomClient,
    montantPret: num(r.montantPret ?? r.MONTANT_PRET ?? r.montant),
    dateDemande,
    motif: str(r.motif ?? r.MOTIF),
    agence,
    typePret: str(r.idtypePret ?? r.typePret ?? r.TYPE_PRET ?? r.libelleTypePret),
    cppId,
    codeDir: str(r.codeDir ?? r.CODE_DIR),
    loginValid: str(r.loginValid ?? r.LOGIN_V ?? r.login),
  }
}

async function tryListPaths(query: SearchWorkflowPretQuery): Promise<WorkflowPretRow[] | null> {
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
    try {
      const res = await apiFetch(appendQuery(path, q), {
        method: 'GET',
        headers: { accept: '*/*' },
      })
      const raw = await readJsonIfOk<unknown>(res, `Workflow prêt list failed (${res.status})`)
      const list = extractListFromApiEnvelope(raw)
      const mapped = list
        .map((row, idx) => mapRawToWorkflowPretRow(row, idx))
        .filter((r): r is WorkflowPretRow => r != null)
      if (mapped.length) return mapped
    } catch {
      try {
        const res = await apiFetch(appendQuery(path, q), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', accept: '*/*' },
          body: JSON.stringify(q),
        })
        const raw = await readJsonIfOk<unknown>(res, `Workflow prêt list failed (${res.status})`)
        const list = extractListFromApiEnvelope(raw)
        const mapped = list
          .map((row, idx) => mapRawToWorkflowPretRow(row, idx))
          .filter((r): r is WorkflowPretRow => r != null)
        if (mapped.length) return mapped
      } catch {
        /* next */
      }
    }
  }
  return null
}

async function postAction(
  paths: string[],
  customPath: string | undefined,
  body: ValidPretRequest,
  errorLabel: string,
): Promise<void> {
  const candidates = customPath?.trim() ? [customPath.trim()] : paths
  let lastErr: Error | null = null

  for (const path of candidates) {
    try {
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(body),
      })
      await readJsonIfOk<unknown>(res, `${errorLabel} failed (${res.status})`)
      return
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastErr ?? new Error(errorLabel)
}

/** Liste des demandes de prêt en attente de validation. */
export async function searchWorkflowPret(query: SearchWorkflowPretQuery): Promise<WorkflowPretRow[]> {
  const list = await tryListPaths(query)
  return list ?? []
}

/** Valider une demande de prêt. */
export async function validerWorkflowPret(body: ValidPretRequest): Promise<void> {
  await postAction(DEFAULT_VALID_PATHS, VALID_CUSTOM_PATH, body, 'Validation prêt')
}

/** Rejeter une demande de prêt. */
export async function rejeterWorkflowPret(body: ValidPretRequest): Promise<void> {
  await postAction(DEFAULT_REJECT_PATHS, REJECT_CUSTOM_PATH, body, 'Rejet prêt')
}

function mapPiece(raw: unknown, idx: number): PretPieceRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id ?? r.idPiece ?? r.nomFichier ?? r.libelle ?? `piece-${idx}`)
  const label = str(r.libelle ?? r.nomFichier ?? r.nom ?? r.label ?? id)
  const url = str(r.url ?? r.lien ?? r.path ?? r.chemin)
  if (!label && !url) return null
  return {
    id: id || `piece-${idx}`,
    label: label || id,
    url: url || undefined,
    contentType: str(r.contentType ?? r.type) || undefined,
  }
}

/** Pièces jointes d'une demande de prêt. */
export async function listPretPieces(idDemande: number | string): Promise<PretPieceRow[]> {
  for (const path of PIECES_PATHS(idDemande)) {
    try {
      const res = await apiFetch(path, { method: 'GET', headers: { accept: '*/*' } })
      const raw = await readJsonIfOk<unknown>(res, `Pièces prêt failed (${res.status})`)
      const list = extractListFromApiEnvelope(raw)
      const mapped = list
        .map((row, idx) => mapPiece(row, idx))
        .filter((p): p is PretPieceRow => p != null)
      if (mapped.length) return mapped
    } catch {
      /* next */
    }
  }
  return []
}

/** Consultation régularité client (demande sélectionnée). */
export async function fetchPretRegularite(idDemande: number | string): Promise<string> {
  const paths = [
    `/api/pret/regularite/${encodeURIComponent(String(idDemande))}`,
    `/api/pret/consultation-regularite/${encodeURIComponent(String(idDemande))}`,
  ]
  for (const path of paths) {
    try {
      const res = await apiFetch(path, { method: 'GET', headers: { accept: '*/*' } })
      const raw = await readJsonIfOk<unknown>(res, `Régularité failed (${res.status})`)
      if (typeof raw === 'string') return raw
      const data = raw as Record<string, unknown>
      return str(data.message ?? data.libelle ?? data.resultat ?? JSON.stringify(data))
    } catch {
      /* next */
    }
  }
  return 'Consultation régularité non disponible pour cette demande.'
}

/** Consultation cumul cartes (demande sélectionnée). */
export async function fetchPretCumulCarte(idDemande: number | string): Promise<string> {
  const paths = [
    `/api/pret/cumul-carte/${encodeURIComponent(String(idDemande))}`,
    `/api/pret/cumul-cartes/${encodeURIComponent(String(idDemande))}`,
  ]
  for (const path of paths) {
    try {
      const res = await apiFetch(path, { method: 'GET', headers: { accept: '*/*' } })
      const raw = await readJsonIfOk<unknown>(res, `Cumul carte failed (${res.status})`)
      if (typeof raw === 'string') return raw
      const data = raw as Record<string, unknown>
      return str(data.message ?? data.libelle ?? data.cumul ?? data.resultat ?? JSON.stringify(data))
    } catch {
      /* next */
    }
  }
  return 'Consultation cumul cartes non disponible pour cette demande.'
}

/** Ajout de pièces à une demande (fichiers). */
export async function uploadPretPieces(idDemande: number | string, files: File[]): Promise<void> {
  if (!files.length) return
  const paths = [
    `/api/pret/pieces/${encodeURIComponent(String(idDemande))}`,
    `/api/pret/demande/${encodeURIComponent(String(idDemande))}/pieces`,
  ]

  const form = new FormData()
  for (const file of files) {
    form.append('files', file)
    form.append('file', file)
  }

  let lastErr: Error | null = null
  for (const path of paths) {
    try {
      const res = await apiFetch(path, {
        method: 'POST',
        body: form,
      })
      await readJsonIfOk<unknown>(res, `Ajout pièces failed (${res.status})`)
      return
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastErr ?? new Error('Ajout de pièces impossible')
}
