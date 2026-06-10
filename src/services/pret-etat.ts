import { appendQuery, readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { VValidPretCoopec } from './openapi-components'

export type SearchEtatPretQuery = {
  niveau?: string
  dateDebut: string
  dateFin: string
  codeAgence?: string
  direction?: string
  institution?: string
  login?: string
}

export type EtatPretRow = {
  rowKey: string
  libellePret: string
  dateDemande: string
  taux: number | undefined
  montantPret: number | undefined
  nomClient: string
  motif: string
  agence: string
  status: string
}

export type PretNiveauOption = { value: string; label: string }

const LIST_CUSTOM_PATH = import.meta.env.VITE_PRET_ETAT_PATH as string | undefined
const NIVEAU_CUSTOM_PATH = import.meta.env.VITE_PRET_ETAT_NIVEAUX_PATH as string | undefined

const DEFAULT_LIST_PATHS = [
  '/api/pret/etat',
  '/api/pret/etats',
  '/api/pret/etat-pret',
  '/api/etat/pret',
  '/api/pret/valid-pret-coopec',
]

const DEFAULT_NIVEAU_PATHS = [
  '/api/param/pret/niveau',
  '/api/pret/niveaux',
  '/api/pret/etat/niveaux',
]

const FALLBACK_NIVEAUX: PretNiveauOption[] = [
  {
    value: 'ATTENTE_VALIDATION_COM',
    label: 'DEMANDE EN ATTENTE DE VALIDATION DE LA COMMISSION',
  },
  { value: 'ATTENTE_VALIDATION', label: 'DEMANDE EN ATTENTE DE VALIDATION' },
  { value: 'VALIDEE', label: 'DEMANDE VALIDÉE' },
  { value: 'REJETEE', label: 'DEMANDE REJETÉE' },
  { value: 'OFFRE_SOUMISE', label: 'OFFRE SOUMISE' },
  { value: 'DEBLOQUEE', label: 'PRÊT DÉBLOQUÉ' },
  { value: 'TOUS', label: 'TOUS LES NIVEAUX' },
]

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(/\s/g, '').replace(',', '.').replace('%', ''))
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

export function mapRawToEtatPretRow(raw: unknown, idx: number): EtatPretRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as VValidPretCoopec & Record<string, unknown>

  const nomClient = str(r.nomClient ?? r.NOM_CLIENT)
  const dateDemande = str(r.dateDemande ?? r.DATE_DEMANDE)
  const libellePret = str(
    r.libellePret ?? r.libellePrêt ?? r.LIBELLE_PRET ?? r.typePret ?? r.idtypePret,
  )
  const idDemande = num(r.idwDemandePret ?? r.idDemande)

  if (!nomClient && !dateDemande && !libellePret && idDemande == null) return null

  return {
    rowKey: idDemande != null ? String(idDemande) : `etat-pret-${idx}`,
    libellePret,
    dateDemande,
    taux: num(r.taux ?? r.Taux ?? r.tauxInteret ?? r.tauxUsure),
    montantPret: num(r.montantPret ?? r.MONTANT_PRET ?? r.montant),
    nomClient,
    motif: str(r.motif ?? r.MOTIF),
    agence: str(r.codeAgence ?? r.agence),
    status: str(r.status ?? r.niveau ?? r.niveauPret),
  }
}

function mapNiveauOption(raw: unknown, idx: number): PretNiveauOption | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const value = str(r.code ?? r.value ?? r.id ?? r.status ?? r.niveau)
  const label = str(r.libelle ?? r.label ?? r.nom ?? r.description ?? value)
  if (!value && !label) return null
  return { value: value || `niveau-${idx}`, label: label || value }
}

/** Options du filtre « Niveau ». */
export async function getPretEtatNiveaux(): Promise<PretNiveauOption[]> {
  const paths = NIVEAU_CUSTOM_PATH?.trim() ? [NIVEAU_CUSTOM_PATH.trim()] : DEFAULT_NIVEAU_PATHS

  for (const path of paths) {
    try {
      const res = await apiFetch(path, { method: 'GET', headers: { accept: '*/*' } })
      const raw = await readJsonIfOk<unknown>(res, `Niveaux prêt failed (${res.status})`)
      const list = extractListFromApiEnvelope(raw)
      const mapped = list
        .map((row, idx) => mapNiveauOption(row, idx))
        .filter((o): o is PretNiveauOption => o != null)
      if (mapped.length) return mapped
    } catch {
      /* next */
    }
  }
  return FALLBACK_NIVEAUX
}

async function tryListPaths(query: SearchEtatPretQuery): Promise<EtatPretRow[] | null> {
  const paths = LIST_CUSTOM_PATH?.trim() ? [LIST_CUSTOM_PATH.trim()] : DEFAULT_LIST_PATHS
  const payload = {
    niveau: query.niveau,
    status: query.niveau,
    dateDebut: query.dateDebut,
    dateFin: query.dateFin,
    codeAgence: query.codeAgence,
    direction: query.direction,
    institution: query.institution,
    login: query.login,
  }
  const q = {
    all: 'true',
    ...payload,
  }

  for (const path of paths) {
    for (const method of ['POST', 'GET'] as const) {
      try {
        const res = await apiFetch(appendQuery(path, method === 'GET' ? q : undefined), {
          method,
          headers:
            method === 'POST'
              ? { 'Content-Type': 'application/json', accept: '*/*' }
              : { accept: '*/*' },
          body: method === 'POST' ? JSON.stringify(payload) : undefined,
        })
        const raw = await readJsonIfOk<unknown>(res, `État prêt failed (${res.status})`)
        const list = extractListFromApiEnvelope(raw)
        let mapped = list
          .map((row, idx) => mapRawToEtatPretRow(row, idx))
          .filter((r): r is EtatPretRow => r != null)

        if (query.niveau && query.niveau !== 'TOUS') {
          const nq = query.niveau.toLowerCase()
          mapped = mapped.filter(
            (r) =>
              r.status.toLowerCase().includes(nq) ||
              String(r.status) === query.niveau ||
              nq.includes('attente') === r.motif.toLowerCase().includes('attente'),
          )
        }

        if (mapped.length) return mapped
      } catch {
        /* next */
      }
    }
  }
  return null
}

/** État des prêts — liste filtrée par niveau et période. */
export async function searchEtatPret(query: SearchEtatPretQuery): Promise<EtatPretRow[]> {
  const list = await tryListPaths(query)
  return list ?? []
}
