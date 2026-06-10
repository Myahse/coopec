import { readJsonIfOk } from './api-json'
import { searchAbonnements } from './abonnement'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { WAbonnement } from './openapi-components'

export type ExtractionCarteSearchBody = {
  agence: string
  dateDebut: string
  dateFin: string
}

export type ExtractionCarteRow = {
  collecte: string
  les: string
  lesN: string
  lce: string
  lceN: string
  date: string
  montant: string
  commission: string
  produit: string
  client: string
  adhesion: string
  partSociale: string
  droits: string
  frais: string
  collecteurs: string
}

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

function numStr(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'string' && v.trim()) return v.trim()
  return ''
}

export function mapAbonnementToExtractionRow(row: WAbonnement): ExtractionCarteRow {
  const r = row as WAbonnement & Record<string, unknown>
  return {
    collecte: str(r.codeCollect ?? r.collecte ?? r.codetypcol),
    les: str(r.compteLes),
    lesN: str(r.compteLesN ?? r.compteLESN),
    lce: str(r.compteLce),
    lceN: str(r.compteLceN ?? r.compteLCEN),
    date: str(r.dateAbonnement ?? r.heureoperation ?? r.dateDebut),
    montant: numStr(r.montantCollect ?? r.montant),
    commission: numStr(r.montantCommission ?? r.montantCommision ?? r.commission),
    produit: str(r.produit ?? r.libelleProduit ?? r.codetypcol),
    client: str(r.nomClient ?? r.codeClient),
    adhesion: str(r.numabonnemntTemp ?? r.idwAbonnement ?? r.numeroCompte),
    partSociale: str(r.partSociale ?? r.x1),
    droits: str(r.droits ?? r.droit ?? r.x4),
    frais: str(r.frais ?? r.x5),
    collecteurs: str(r.codeCollect ?? r.nomCollecteur ?? r.collecteur),
  }
}

function mapList(list: unknown[]): ExtractionCarteRow[] {
  return list.map((item) => mapAbonnementToExtractionRow(item as WAbonnement))
}

/** Cartes pleines à reverser — endpoint dédié si disponible, sinon recherche abonnements status 2. */
export async function listExtractionCartesAReverser(
  body: ExtractionCarteSearchBody,
): Promise<ExtractionCarteRow[]> {
  try {
    const res = await apiFetch('/api/abonnement/extraction-cartes-a-reverser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      body: JSON.stringify(body),
    })
    const raw = await readJsonIfOk<unknown>(res, `Extraction cartes à reverser failed (${res.status})`)
    return mapList(extractListFromApiEnvelope(raw))
  } catch {
    const env = await searchAbonnements({
      agence: body.agence,
      status: '2',
      dateDebut: body.dateDebut,
      dateFin: body.dateFin,
    })
    return mapList(extractListFromApiEnvelope(env))
  }
}
