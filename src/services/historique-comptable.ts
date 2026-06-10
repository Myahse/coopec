import { appendQuery, readJsonIfOk } from './api-json'
import { searchAbonnements } from './abonnement'
import { getDashboardMontantsCollectes } from './dashboard'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { Summary } from './openapi-components'

export type HistoriqueComptableMode = 'collecte' | 'reversement'

export type HistoriqueComptableSearchBody = {
  codeAgence: string
  dateDebut: string
  dateFin: string
  mode: HistoriqueComptableMode
  codeDirection?: string
  direction?: string
  institution?: string
  codeInstitution?: string
}

export type HistoriqueExtractionRow = {
  rowKey: string
  agence: string
  dateExtraction: string
  clefExtraction: string
}

export type HistoriqueComptableDetailRow = {
  rowKey: string
  leCollecte: string
  compteLes: string
  compteLce: string
  montantCollecte: number
  dateCollecte: string
  numGuichet: string
  leCollecteur: string
  clefExtraction?: string
}

export type HistoriqueComptableResult = {
  extractions: HistoriqueExtractionRow[]
  details: HistoriqueComptableDetailRow[]
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

function mapSummaryToDetail(row: Summary, idx: number): HistoriqueComptableDetailRow {
  const r = row as Summary & Record<string, unknown>
  const clef = str(r.reference ?? r.clefExtraction ?? r.clef ?? '')
  const dateCollecte = str(r.date0peration ?? r.dateCollecte ?? r.date)
  return {
    rowKey: clef || `detail-${idx}`,
    leCollecte: str(r.leCollecte ?? r.motif ?? r.numabonnement ?? 'Collecte'),
    compteLes: str(r.compteLes ?? r.compteLES ?? r.ancienNumeroDeCompte),
    compteLce: str(r.compteLce ?? r.compteLCE ?? r.nouveauNumeroDeCompte),
    montantCollecte: num(r.montant),
    dateCollecte,
    numGuichet: str(r.numGuichet ?? r.numgichet ?? r.numGuichet),
    leCollecteur: str(r.nomCollecteur ?? r.collecteur),
    clefExtraction: clef || undefined,
  }
}

function mapRawToDetail(raw: unknown, idx: number): HistoriqueComptableDetailRow {
  if (!raw || typeof raw !== 'object') {
    return mapSummaryToDetail({}, idx)
  }
  const r = raw as Record<string, unknown>
  const clef = str(r.clefExtraction ?? r.clef ?? r.reference)
  return {
    rowKey: clef || `detail-${idx}`,
    leCollecte: str(r.leCollecte ?? r.collecte ?? r.libelle ?? r.motif),
    compteLes: str(r.compteLes ?? r.compteLES),
    compteLce: str(r.compteLce ?? r.compteLCE),
    montantCollecte: num(r.montantCollecte ?? r.montant),
    dateCollecte: str(r.dateCollecte ?? r.date0peration ?? r.date),
    numGuichet: str(r.numGuichet ?? r.numgichet),
    leCollecteur: str(r.leCollecteur ?? r.nomCollecteur ?? r.collecteur),
    clefExtraction: clef || undefined,
  }
}

function buildExtractions(
  details: HistoriqueComptableDetailRow[],
  agence: string,
): HistoriqueExtractionRow[] {
  const byClef = new Map<string, HistoriqueExtractionRow>()
  for (const d of details) {
    const clef = d.clefExtraction ?? d.dateCollecte ?? '—'
    const key = `${agence}|${clef}`
    if (!byClef.has(key)) {
      byClef.set(key, {
        rowKey: key,
        agence,
        dateExtraction: d.dateCollecte || '—',
        clefExtraction: clef,
      })
    }
  }
  return [...byClef.values()]
}

async function fallbackSearch(body: HistoriqueComptableSearchBody): Promise<HistoriqueComptableResult> {
  let details: HistoriqueComptableDetailRow[] = []

  if (body.mode === 'reversement') {
    const env = await searchAbonnements({
      agence: body.codeAgence,
      status: '3',
      dateDebut: body.dateDebut,
      dateFin: body.dateFin,
    })
    const list = extractListFromApiEnvelope(env) as Record<string, unknown>[]
    details = list.map((row, idx) => {
      const d = mapRawToDetail(row, idx)
      return {
        ...d,
        leCollecte: d.leCollecte || str(row.numabonnemntTemp ?? row.idwAbonnement),
        compteLes: d.compteLes || str(row.compteLes ?? row.compteLesN),
        compteLce: d.compteLce || str(row.compteLce ?? row.compteLceN),
        leCollecteur: d.leCollecteur || str(row.codeCollect),
      }
    })
  } else {
    const rows = await getDashboardMontantsCollectes({ agence: body.codeAgence })
    const debut = new Date(`${body.dateDebut}T00:00:00`).getTime()
    const fin = new Date(`${body.dateFin}T23:59:59`).getTime()
    const inRange = rows.filter((row) => {
      const raw = row.date0peration
      if (!raw) return true
      const t = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`).getTime()
      if (Number.isNaN(t)) return true
      return t >= debut && t <= fin
    })
    details = inRange.map((row, idx) => mapSummaryToDetail(row, idx))
  }

  return {
    extractions: buildExtractions(details, body.codeAgence),
    details,
  }
}

function parseApiResult(raw: unknown, agence: string): HistoriqueComptableResult {
  if (!raw || typeof raw !== 'object') {
    return { extractions: [], details: [] }
  }
  const o = raw as Record<string, unknown>
  const data = (o.data && typeof o.data === 'object' ? o.data : o) as Record<string, unknown>

  const extRaw = extractListFromApiEnvelope(data.extractions ?? data.fichiers ?? [])
  const detRaw = extractListFromApiEnvelope(data.details ?? data.lignes ?? data.operations ?? data)

  const details = detRaw.length
    ? detRaw.map((row, idx) => mapRawToDetail(row, idx))
    : extractListFromApiEnvelope(data).map((row, idx) => mapRawToDetail(row, idx))

  const extractions = extRaw.length
    ? extRaw.map((row, idx) => {
        const r = row as Record<string, unknown>
        const clef = str(r.clefExtraction ?? r.clef)
        return {
          rowKey: clef || `ext-${idx}`,
          agence: str(r.agence ?? r.codeAgence) || agence,
          dateExtraction: str(r.dateExtraction ?? r.date),
          clefExtraction: clef,
        }
      })
    : buildExtractions(details, agence)

  return { extractions, details }
}

export async function searchHistoriqueComptable(
  body: HistoriqueComptableSearchBody,
): Promise<HistoriqueComptableResult> {
  try {
    const res = await apiFetch(
      appendQuery('/api/historique-comptable/search', {
        all: true,
        direction: body.codeDirection ?? body.direction,
        institution: body.institution ?? body.codeInstitution,
      }),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(body),
      },
    )
    const raw = await readJsonIfOk<unknown>(res, `Historique comptable search failed (${res.status})`)
    return parseApiResult(raw, body.codeAgence)
  } catch {
    return fallbackSearch(body)
  }
}

export async function repositionnerFichierHistorique(body: {
  codeAgence: string
  clefExtraction: string
}): Promise<{ message?: string }> {
  const res = await apiFetch('/api/historique-comptable/repositionner-fichier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<{ message?: string }>(res, `Repositionner fichier failed (${res.status})`)
}

export async function repositionnerCarteHistorique(body: {
  codeAgence: string
  clefExtraction?: string
  compteLes?: string
  compteLce?: string
}): Promise<{ message?: string }> {
  const res = await apiFetch('/api/historique-comptable/repositionner-carte', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<{ message?: string }>(res, `Repositionner carte failed (${res.status})`)
}
