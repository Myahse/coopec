import { appendQuery, readJsonIfOk } from './api-json'
import { searchEtatMontantsCollectes } from './etat-montants-collectes'
import { searchHistoriqueComptable } from './historique-comptable'
import { getTypesCollecte } from './param'
import { apiFetch } from './http'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { SearchClientDto, Summary, WTypeCollect } from './openapi-components'

export type SearchEtatPaiementEnLigneBody = SearchClientDto & {
  codeDir?: string
  direction?: string
  agencyCodes?: string[]
  institution?: string
}

export type EtatPaiementEnLigneRow = {
  rowKey: string
  refOperation: string
  date: string
  nomAgence: string
  montant: number | undefined
  nomClient: string
  numAbonnemn: string
  montantColl: number | undefined
  collectrice: string
}

const CUSTOM_PATH = import.meta.env.VITE_ETAT_PAIEMENT_EN_LIGNE_PATH as string | undefined

const OFFICIAL_POST_PATH = '/api/etat-operation/paiement-en-ligne'

const DEFAULT_POST_PATHS = [
  OFFICIAL_POST_PATH,
  '/api/etat/paiement-en-ligne',
  '/api/paiement/en-ligne',
  '/api/operation/search-paiement-en-ligne',
  '/api/operation/paiement-ligne',
  '/api/collecte/paiement-en-ligne',
]

function isOfficialPaiementEnLignePath(path: string): boolean {
  const p = path.trim().toLowerCase()
  return p === OFFICIAL_POST_PATH || p.endsWith('/etat-operation/paiement-en-ligne')
}

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

function buildOfficialPostBody(body: SearchEtatPaiementEnLigneBody) {
  return {
    codeAgence: str(body.codeAgence),
    codeDir: str(body.codeDir ?? body.direction),
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
  }
}

function ligneTypeIds(types: WTypeCollect[]): string[] {
  return types
    .filter((t) => {
      const label = str(t.libelle).toUpperCase()
      return (
        label.includes('LIGNE') ||
        label.includes('WEB') ||
        label.includes('MOBILE') ||
        label.includes('PAIEMENT')
      )
    })
    .map((t) => str(t.idTypeCollect ?? t.codeOper))
    .filter(Boolean)
}

export function mapRawToEtatPaiementEnLigneRow(
  raw: unknown,
  idx: number,
  nomAgence = '',
): EtatPaiementEnLigneRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Summary & Record<string, unknown>

  const refOperation = str(r.refOperation ?? r.reference ?? r.clefExtraction ?? r.refOp)
  const date = str(
    r.date ?? r.datePaiement ?? r.datePaiem ?? r.heureoperation ?? r.date0peration ?? r.dateCollecte,
  )
  const nomClient = str(r.nomClient ?? r.NOM_CLIENT ?? r.client ?? r.codeClient ?? r.nomclient)
  const numAbonnemn = str(
    r.numAbonnemn ??
      r.NUMABONNEMN ??
      r.numabonnemnt ??
      r.numAbonnemnt ??
      r.numabonnement ??
      r.numAbonnement,
  )
  const collectrice = str(
    r.collectrice ?? r.Collectrice ?? r.nomCollecteur ?? r.leCollecteur ?? r.collecteur ?? r.codeCollect,
  )

  if (!refOperation && !date && !nomClient && !numAbonnemn) return null

  return {
    rowKey: refOperation || numAbonnemn || `ligne-${idx}`,
    refOperation,
    date,
    nomAgence: str(r.nomAgence ?? r.NOM_AGENCE ?? r.agence ?? nomAgence),
    montant: num(r.montant ?? r.MONTANT ?? r.montantContrat ?? r.mtContrat ?? r.x1),
    nomClient,
    numAbonnemn,
    montantColl: num(
      r.montantColl ?? r.MONTANT_COLL ?? r.montantCollecte ?? r.mtCollecte ?? r.montantCollect,
    ),
    collectrice,
  }
}

async function tryOfficialPost(
  body: SearchEtatPaiementEnLigneBody,
): Promise<unknown[] | null> {
  const codeAgence = str(body.codeAgence)
  const codeDir = str(body.codeDir ?? body.direction)
  if (!codeAgence || !codeDir) return null

  try {
    const res = await apiFetch(OFFICIAL_POST_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      body: JSON.stringify(buildOfficialPostBody(body)),
    })
    const raw = await readJsonIfOk<unknown>(res, `État paiement en ligne failed (${res.status})`)
    return extractListFromApiEnvelope(raw)
  } catch {
    return null
  }
}

async function tryDedicatedPost(
  body: SearchEtatPaiementEnLigneBody,
): Promise<{ list: unknown[]; official: boolean } | null> {
  const paths = CUSTOM_PATH?.trim() ? [CUSTOM_PATH.trim()] : DEFAULT_POST_PATHS
  const codeDir = str(body.codeDir ?? body.direction)
  const query = {
    all: 'true',
    direction: codeDir,
    institution: body.institution,
  }

  for (const path of paths) {
    const official = isOfficialPaiementEnLignePath(path)
    const payload = official
      ? buildOfficialPostBody(body)
      : {
          codeAgence: body.codeAgence,
          agence: body.codeAgence,
          dateDebut: body.dateDebut,
          dateFin: body.dateFin,
          codeDir,
          codeDirection: codeDir,
          direction: codeDir,
          institution: body.institution,
          codeInstitution: body.institution,
          agencyCodes: body.agencyCodes,
        }
    if (official && (!str(body.codeAgence) || !codeDir)) continue

    try {
      const res = await apiFetch(appendQuery(path, query), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(payload),
      })
      const raw = await readJsonIfOk<unknown>(res, `État paiement en ligne failed (${res.status})`)
      const list = extractListFromApiEnvelope(raw)
      if (official || list.length) return { list, official }
    } catch {
      /* next */
    }
  }
  return null
}

function resolveAgencyCodes(body: SearchEtatPaiementEnLigneBody): string[] {
  const single = str(body.codeAgence)
  if (single) return [single]
  return [...new Set((body.agencyCodes ?? []).map((c) => c.trim()).filter(Boolean))]
}

async function fallbackFromMontantsCollectes(
  body: SearchEtatPaiementEnLigneBody,
  codeAgence: string,
  nomAgence: string,
): Promise<EtatPaiementEnLigneRow[]> {
  let typeIds: string[] = []
  try {
    const env = await getTypesCollecte()
    const types = extractListFromApiEnvelope(env) as WTypeCollect[]
    typeIds = ligneTypeIds(types)
  } catch {
    typeIds = []
  }

  const queries =
    typeIds.length > 0
      ? typeIds.map((id) => ({ idTypeCollect: id, typeCollect: id }))
      : [{ idTypeCollect: undefined, typeCollect: undefined }]

  const rows: EtatPaiementEnLigneRow[] = []
  const seen = new Set<string>()

  for (const q of queries) {
    const list = await searchEtatMontantsCollectes(
      {
        codeAgence,
        codeDir: body.codeDir ?? body.direction,
        dateDebut: body.dateDebut,
        dateFin: body.dateFin,
      },
      q,
    )
    for (const row of list) {
      if (typeIds.length === 0) {
        const typeLabel = row.typeCollecte.toUpperCase()
        if (
          !typeLabel.includes('LIGNE') &&
          !typeLabel.includes('WEB') &&
          !typeLabel.includes('MOBILE') &&
          !typeLabel.includes('PAIEMENT')
        ) {
          continue
        }
      }
      const mapped = mapRawToEtatPaiementEnLigneRow(
        {
          refOperation: row.reference,
          date: row.datePaiem,
          nomAgence,
          montant: row.mtContrat,
          nomClient: row.client,
          numAbonnemn: row.numAbonnement,
          montantColl: row.mtCollecte,
          collectrice: row.collecteur,
        },
        rows.length,
        nomAgence,
      )
      if (!mapped || seen.has(mapped.rowKey)) continue
      seen.add(mapped.rowKey)
      rows.push(mapped)
    }
  }
  return rows
}

async function fallbackFromHistorique(
  body: SearchEtatPaiementEnLigneBody,
  codeAgence: string,
  nomAgence: string,
): Promise<EtatPaiementEnLigneRow[]> {
  const res = await searchHistoriqueComptable({
    codeAgence,
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    mode: 'collecte',
  })
  return res.details
    .map((d, idx) =>
      mapRawToEtatPaiementEnLigneRow(
        {
          refOperation: d.clefExtraction,
          date: d.dateCollecte,
          nomAgence,
          montant: d.montantCollecte,
          numAbonnemn: d.leCollecte || d.compteLes,
          montantColl: d.montantCollecte,
          collectrice: d.leCollecteur,
        },
        idx,
        nomAgence,
      ),
    )
    .filter((r): r is EtatPaiementEnLigneRow => r != null)
}

/** État paiement en ligne — POST /api/etat-operation/paiement-en-ligne */
export async function searchEtatPaiementEnLigne(
  body: SearchEtatPaiementEnLigneBody,
  agencyLabels: Record<string, string> = {},
): Promise<EtatPaiementEnLigneRow[]> {
  let rawList: unknown[] = []
  let officialResponded = false

  const official = await tryOfficialPost(body)
  if (official !== null) {
    rawList = official
    officialResponded = true
  } else {
    const dedicated = await tryDedicatedPost(body)
    if (dedicated) {
      rawList = dedicated.list
      officialResponded = dedicated.official
    }
  }

  if (officialResponded) {
    const nomAgence =
      agencyLabels[str(body.codeAgence)] || str(body.codeAgence)
    return rawList
      .map((row, idx) => mapRawToEtatPaiementEnLigneRow(row, idx, nomAgence))
      .filter((r): r is EtatPaiementEnLigneRow => r != null)
  }

  const codes = resolveAgencyCodes(body)
  if (!codes.length) return []

  const rows: EtatPaiementEnLigneRow[] = []
  for (const code of codes) {
    const nomAgence = agencyLabels[code] || code
    const montants = await fallbackFromMontantsCollectes(body, code, nomAgence)
    const chunk = montants.length
      ? montants
      : await fallbackFromHistorique(body, code, nomAgence)
    rows.push(...chunk)
  }
  return rows
}
