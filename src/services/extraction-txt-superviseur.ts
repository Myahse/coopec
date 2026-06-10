import { pickErrorMessage } from './api-json'
import { apiFetch } from './http'
import { getConnectedUserLogin } from '@/utils/connected-user-login'
import { parseContentDispositionFilename } from '@/utils/txt-download'
import type { WAbonnement } from './openapi-components'

export type ExtractionTxtSuperviseurSearchBody = {
  agence: string
  dateDebut: string
  dateFin: string
  idTypeCollect?: number | string
  codeOper?: string
  /** Path segment after `/api/extraire-txt/` (e.g. `compensation-bm`). */
  endpointSlug?: string
  login?: string
}

export type ExtractionTxtSuperviseurRow = {
  collecte: string
  les: string
  lce: string
  date: string
  montant: string
  commission: string
  produit: string
  client: string
  adhesion: string
  partSociale: string
  droit: string
  frais: string
  collecteur: string
  clefExtraction?: string
}

export type ExtractionTxtSuperviseurResult = {
  /** Contenu brut du fichier TXT renvoyé par l’API. */
  text: string
  /** Nom suggéré par l’API (`Content-Disposition`) si présent. */
  filename?: string
  clefExtraction?: string
  /** @deprecated Utiliser `text`. Conservé pour compatibilité. */
  rawText?: string
  rows: ExtractionTxtSuperviseurRow[]
}

/** Segments `POST /api/extraire-txt/{slug}` documentés OpenAPI. */
export const EXTRAIRE_TXT_ENDPOINTS = [
  { value: 'compensation-bm', label: 'Versement — Bank Micro', format: 'bm' as const },
  { value: 'compensation-ibank', label: 'Versement — IBank', format: 'ibank' as const },
  { value: 'reversement-bm', label: 'Reversement — Bank Micro', format: 'bm' as const },
  { value: 'reversement-ibank', label: 'Reversement — IBank', format: 'ibank' as const },
] as const

export type ExtraireTxtEndpointSlug = (typeof EXTRAIRE_TXT_ENDPOINTS)[number]['value']

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

function numStr(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'string' && v.trim()) return v.trim()
  return ''
}

function formatDateValue(v: unknown): string {
  const s = str(v)
  if (!s) return ''
  try {
    const d = new Date(s.includes('T') ? s : `${s}T12:00:00`)
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('fr-FR')
  } catch {
    /* keep raw */
  }
  return s
}

function normalizeEndpointSlug(raw?: string): string {
  const s = raw?.trim()
  if (!s) return ''
  return s.toLowerCase().replace(/_/g, '-')
}

/** Corps OpenAPI strict : login, codeAgence, dateDebut, dateFin uniquement. */
export type ExtraireTxtRequestBody = {
  login: string
  codeAgence: string
  dateDebut: string
  dateFin: string
}

function buildExtraireTxtPayload(
  body: ExtractionTxtSuperviseurSearchBody,
  login: string,
): ExtraireTxtRequestBody {
  return {
    login,
    codeAgence: body.agence.trim(),
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
  }
}

function isAttachmentResponse(res: Response): boolean {
  const cd = res.headers.get('content-disposition') ?? ''
  return /attachment/i.test(cd) || /filename=/i.test(cd)
}

function looksLikeTxtFileBody(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (trimmed.includes('\t')) return true
  if (trimmed.includes(';') && trimmed.includes('\n')) return true
  return trimmed.split(/\r?\n/).filter((l) => l.trim()).length > 1
}

type ExtraireTxtFileRead = {
  text: string
  filename?: string
  errorPayload?: unknown
}

/** L’API renvoie un fichier TXT (corps brut ou pièce jointe), pas un tableau JSON. */
async function readExtraireTxtFileResponse(res: Response): Promise<ExtraireTxtFileRead> {
  const contentType = res.headers.get('content-type') ?? ''
  const filename = parseContentDispositionFilename(res.headers.get('content-disposition'))
  const body = await res.text()

  if (!res.ok) {
    let errorPayload: unknown = body
    const trimmed = body.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || contentType.includes('application/json')) {
      try {
        errorPayload = JSON.parse(body) as unknown
      } catch {
        errorPayload = body
      }
    }
    return { text: '', filename, errorPayload }
  }

  const trimmed = body.trim()
  if (!trimmed) return { text: '', filename }

  if (isAttachmentResponse(res) || looksLikeTxtFileBody(body)) {
    return { text: trimmed, filename }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[') || contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(body) as unknown
      const fromJson = extractExtraireTxtContent(parsed)
      return { text: fromJson, filename }
    } catch {
      return { text: trimmed, filename }
    }
  }

  return { text: trimmed, filename }
}

async function postExtraireTxt(path: string, payload: ExtraireTxtRequestBody) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify(payload),
  })
  const file = await readExtraireTxtFileResponse(res)
  return { res, file }
}

/** Extrait le contenu fichier TXT depuis une réponse API (texte brut ou enveloppe JSON). */
export function extractExtraireTxtContent(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (!raw || typeof raw !== 'object') return ''
  if (Array.isArray(raw)) {
    if (raw.every((line) => typeof line === 'string')) return raw.join('\n').trim()
    return ''
  }
  const o = raw as Record<string, unknown>
  for (const key of ['data', 'content', 'fichier', 'file', 'text', 'body', 'result']) {
    const v = o[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function resolveExtraireTxtPath(body: ExtractionTxtSuperviseurSearchBody): string {
  const custom = import.meta.env.VITE_EXTRACTION_TXT_SUPERVISEUR_PATH as string | undefined
  if (custom?.trim()) {
    const path = custom.trim()
    if (path.startsWith('/api/')) return path
    return `/api/extraire-txt/${path.replace(/^\/+/, '')}`
  }

  const slug =
    normalizeEndpointSlug(body.endpointSlug) ||
    normalizeEndpointSlug(body.codeOper) ||
    'compensation-bm'

  return `/api/extraire-txt/${slug}`
}

export function mapToExtractionTxtSuperviseurRow(row: unknown): ExtractionTxtSuperviseurRow {
  const r = (row && typeof row === 'object' ? row : {}) as WAbonnement & Record<string, unknown>
  return {
    collecte: str(r.collecte ?? r.codeCollect ?? r.leCollecte ?? r.codetypcol),
    les: str(r.compteLes ?? r.compteLES ?? r.les),
    lce: str(r.compteLce ?? r.compteLCE ?? r.lce),
    date: formatDateValue(r.date ?? r.dateCollecte ?? r.dateAbonnement ?? r.heureoperation),
    montant: numStr(r.montantCollect ?? r.montant ?? r.montantCollecte),
    commission: numStr(r.montantCommission ?? r.montantCommision ?? r.commission),
    produit: str(r.produit ?? r.libelleProduit ?? r.libelle),
    client: str(r.nomClient ?? r.client ?? r.codeClient),
    adhesion: str(r.numabonnemntTemp ?? r.adhesion ?? r.idwAbonnement ?? r.numeroCompte),
    partSociale: str(r.partSociale ?? r.x1),
    droit: str(r.droit ?? r.droits ?? r.x4),
    frais: str(r.frais ?? r.x5),
    collecteur: str(r.collecteur ?? r.nomCollecteur ?? r.leCollecteur ?? r.codeCollect),
    clefExtraction: str(r.clefExtraction ?? r.clef ?? r.reference) || undefined,
  }
}

const TXT_TABLE_COLUMN_KEYS: (keyof ExtractionTxtSuperviseurRow)[] = [
  'collecte',
  'les',
  'lce',
  'date',
  'montant',
  'commission',
  'produit',
  'client',
  'adhesion',
  'partSociale',
  'droit',
  'frais',
  'collecteur',
]

function isTxtHeaderLine(cells: string[]): boolean {
  const joined = cells.join(' ').toUpperCase()
  return joined.includes('COLLECTE') || (joined.includes('LES') && joined.includes('LCE'))
}

function detectTxtSeparator(line: string): '\t' | ';' {
  const tabs = (line.match(/\t/g) ?? []).length
  const semis = (line.match(/;/g) ?? []).length
  return semis > tabs ? ';' : '\t'
}

/** Parse le contenu TXT (tab ou point-virgule) en lignes pour le tableau. */
export function parseExtractionTxtTableRows(text: string): ExtractionTxtSuperviseurRow[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return []

  const sep = detectTxtSeparator(lines[0])
  let start = 0
  const firstCells = lines[0].split(sep).map((c) => c.trim())
  if (isTxtHeaderLine(firstCells)) start = 1

  const rows: ExtractionTxtSuperviseurRow[] = []
  for (let i = start; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.trim())
    if (!cells.some(Boolean)) continue
    const row = {} as ExtractionTxtSuperviseurRow
    for (let j = 0; j < TXT_TABLE_COLUMN_KEYS.length; j++) {
      const key = TXT_TABLE_COLUMN_KEYS[j]
      if (key === 'clefExtraction') continue
      row[key] = cells[j] ?? ''
    }
    rows.push(row)
  }
  return rows
}

function parseFileResult(file: ExtraireTxtFileRead): ExtractionTxtSuperviseurResult {
  const text = file.text
  const rows = parseExtractionTxtTableRows(text)
  return {
    text,
    filename: file.filename,
    rawText: text || undefined,
    rows,
  }
}

export async function listExtractionTxtSuperviseur(
  body: ExtractionTxtSuperviseurSearchBody,
): Promise<ExtractionTxtSuperviseurResult> {
  const login = body.login?.trim() || getConnectedUserLogin()
  if (!login) {
    throw new Error('Utilisateur non connecté — login requis pour l’extraction TXT.')
  }
  if (!body.agence?.trim()) {
    throw new Error('Code agence requis pour l’extraction TXT.')
  }

  const path = resolveExtraireTxtPath(body)
  const payload = buildExtraireTxtPayload(body, login)

  const { res, file } = await postExtraireTxt(path, payload)
  if (!res.ok) {
    throw new Error(pickErrorMessage(file.errorPayload, `Extraction TXT failed (${res.status})`))
  }
  return parseFileResult(file)
}
