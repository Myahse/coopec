import { appendQuery, readJsonIfOk } from './api-json'
import { toSearchAbonnementPayload } from './abonnement'
import { listCollecteursParAgence } from './collecteur'
import { apiFetch } from './http'
import type {
  ArreteToValidDetailsDto,
  ApiResponseArreteToValidDetails,
  ApiResponseListArreteToValidListItem,
  ApiResponseListArreteValidationDto,
  ApiResponseListOperationNA,
  ApiResponseListSummary,
  ApiResponseListWAbonnement,
  ApiResponseString,
  ArreteCollecteDto,
  ArreteToValidListItem,
  ArreteValidationDto,
  Summary,
  SearchAbonnementDto,
  SearchArreteValidationDto,
  SearchClientDto,
  SearchCollecteurOperationDto,
  ValiderArreteCollecteurDto,
} from './openapi-components'
import { extractDataFromApiEnvelope, extractListFromApiEnvelope } from '@/utils/api-envelope'

export type { ArreteValidationDto as ArreteValidationRow }
export type { SearchArreteValidationDto as SearchArreteValidationBody }
export type { ValiderArreteCollecteurDto as ValiderArreteCollectBody }
export type { ArreteCollecteDto as FaireArreteBody }
export type { SearchCollecteurOperationDto as SearchCollecteurOperationBody }
export type { SearchClientDto as SearchClientBody }
export type { SearchAbonnementDto as ListReversementCarteBody }

export type ArreteToValidDetailsQuery = {
  reference: string
  codeAgence?: string
  date?: string
  loginCollecteur?: string
}

export type ReversementCarteQuery = {
  motif: string
  login: string
}

function collecteurLoginsFromList(rows: unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const login = String(row.login ?? row.loginclient ?? row.loginCollecteur ?? '').trim()
    if (!login || seen.has(login)) continue
    seen.add(login)
    out.push(login)
  }
  return out
}

/** OpenAPI : `GET /list-arrete-to-valid?dateOp=&login=` — agrégé par agence. */
async function listArretesToValidMergedForAgence(
  body: SearchArreteValidationDto,
  options?: { valide?: boolean },
): Promise<ArreteToValidListItem[]> {
  const codeAgence = String(body.codeAgence ?? '').trim()
  const dateOp = String(body.date ?? '').trim()
  if (!codeAgence) throw new Error('Code agence requis.')
  if (!dateOp) throw new Error('Date requise.')

  const collecteursEnv = await listCollecteursParAgence(codeAgence)
  const logins = collecteurLoginsFromList(extractListFromApiEnvelope(collecteursEnv))
  if (!logins.length) return []

  const merged: ArreteToValidListItem[] = []
  for (const login of logins) {
    try {
      const path = appendQuery('/api/operation/list-arrete-to-valid', {
        dateOp,
        login,
        ...(options?.valide ? { valide: true } : {}),
      })
      const res = await apiFetch(path, { method: 'GET', headers: { accept: '*/*' } })
      const env = await readJsonIfOk<ApiResponseListArreteToValidListItem>(
        res,
        `List arrêtés collecteur failed (${res.status})`,
      )
      merged.push(...extractArreteToValidList(env))
    } catch {
      /* collecteur sans arrêté pour cette date */
    }
  }
  return merged
}

export async function faireArrete(body: ArreteCollecteDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/operation/faire-arrete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Faire arrêté failed (${res.status})`)
}

export async function getOperationsNonArrete(
  body: SearchCollecteurOperationDto,
): Promise<ApiResponseListOperationNA> {
  const res = await apiFetch('/api/operation/non-arrete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseListOperationNA>(res, `Non arrêté failed (${res.status})`)
}

export async function getOperationsNonArreteSansCompte(
  body: SearchCollecteurOperationDto,
): Promise<ApiResponseListOperationNA> {
  const res = await apiFetch('/api/operation/non-arrete-sans-compte', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseListOperationNA>(res, `Non arrêté sans compte failed (${res.status})`)
}

export async function getOperationsNonArreteAvecCompte(
  body: SearchCollecteurOperationDto,
): Promise<ApiResponseListOperationNA> {
  const res = await apiFetch('/api/operation/non-arrete-avec-compte', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseListOperationNA>(res, `Non arrêté avec compte failed (${res.status})`)
}

/** Détails d’une opération non arrêtée (écran arrêtés / annulations). */
export async function getDetailsOperationNonArrete(reference: string): Promise<ApiResponseListSummary> {
  const r = String(reference ?? '').trim()
  if (!r) throw new Error('reference is required')

  const res = await apiFetch(`/api/operation/non-arrete/${encodeURIComponent(r)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponseListSummary>(res, `Détails opération failed (${res.status})`)
}

export type ListArreteToValidByCollecteurQuery = {
  dateOp: string
  login: string
}

/** GET `/api/operation/list-arrete-to-valid?dateOp=&login=` */
export async function listArretesToValidByCollecteur(
  query: ListArreteToValidByCollecteurQuery,
): Promise<ApiResponseListArreteToValidListItem> {
  const dateOp = String(query.dateOp ?? '').trim()
  const login = String(query.login ?? '').trim()
  if (!dateOp) throw new Error('dateOp is required')
  if (!login) throw new Error('login is required')

  const path = appendQuery('/api/operation/list-arrete-to-valid', { dateOp, login })
  const res = await apiFetch(path, { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListArreteToValidListItem>(
    res,
    `List arrêtés collecteur failed (${res.status})`,
  )
}

/** Arrêtés en attente pour une agence et une date. */
export async function listArretesAValider(
  body: SearchArreteValidationDto,
): Promise<ApiResponseListArreteValidationDto> {
  const list = await listArretesToValidMergedForAgence(body)
  return { data: mapArreteToValidListToValidationRows(list) }
}

function mapArreteToValidListToValidationRows(list: ArreteToValidListItem[]): ArreteValidationDto[] {
  return list.map((r) => ({
    date: r.dateenreg,
    codeCollecteur: r.codecltcoll,
    nomCollecteur: r.nomcoll,
    montantDeclare: r.mntcoll,
    montantConstate: r.mntpoint,
    reference: r.x6,
    loginCollecteur: r.loginpoint,
    compteLes: r.x3,
  }))
}

/** Arrêtés déjà validés (même route, `valide=true` si supporté par le backend). */
export async function listArretesValides(
  body: SearchArreteValidationDto,
): Promise<ApiResponseListArreteValidationDto> {
  const list = await listArretesToValidMergedForAgence(body, { valide: true })
  return { data: mapArreteToValidListToValidationRows(list) }
}

/** GET /api/operation/arrete-to-valid-details — détails arrêté en attente de validation. */
export async function getArreteToValidDetails(
  query: ArreteToValidDetailsQuery,
): Promise<ApiResponseArreteToValidDetails> {
  const reference = String(query.reference ?? '').trim()
  if (!reference) throw new Error('reference is required')

  const path = appendQuery('/api/operation/arrete-to-valid-details', { reference })
  const res = await apiFetch(path, { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseArreteToValidDetails>(res, `Détails arrêté à valider failed (${res.status})`)
}

/** Normalise `arrete-to-valid-details` (objet ou liste) pour affichage. */
export function summariesFromArreteToValidDetails(env: unknown): Summary[] {
  const data = extractDataFromApiEnvelope<unknown>(env)
  if (!data) return []
  if (Array.isArray(data)) return data as Summary[]
  if (typeof data === 'object') {
    const d = data as ArreteToValidDetailsDto
    return [
      {
        reference: d.reference,
        nomClient: d.nomClient,
        montant: d.montant,
        numabonnement: d.numAbonnemnt,
        compteLes: d.compteLES ?? d.compteLESN,
        compteLce: d.compteLCE ?? d.compteLCEN,
        date0peration: d.heureoperation,
      },
    ]
  }
  return []
}

/** Normalise la liste `list-arrete-to-valid` (format collecteur). */
export function extractArreteToValidList(env: unknown): ArreteToValidListItem[] {
  return extractListFromApiEnvelope(env) as ArreteToValidListItem[]
}

/** POST /api/operation/valid-arrete-collect */
export async function validerArreteCollecteur(
  body: ValiderArreteCollecteurDto,
): Promise<ApiResponseString> {
  const res = await apiFetch('/api/operation/valid-arrete-collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Validation arrêté failed (${res.status})`)
}

/** POST /api/operation/list-reversement-carte — corps : agence, status, dateDebut, dateFin. */
export async function listReversementCarte(
  body: SearchAbonnementDto,
): Promise<ApiResponseListWAbonnement> {
  const res = await apiFetch('/api/operation/list-reversement-carte', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(toSearchAbonnementPayload(body)),
  })
  return readJsonIfOk<ApiResponseListWAbonnement>(res, `List reversement carte failed (${res.status})`)
}

/** GET /api/operation/reversement-carte/{numAbonnement} */
export async function reversementCarte(
  numAbonnement: string,
  query: ReversementCarteQuery,
): Promise<ApiResponseString> {
  const num = String(numAbonnement ?? '').trim()
  if (!num) throw new Error('numAbonnement is required')

  const path = appendQuery(`/api/operation/reversement-carte/${encodeURIComponent(num)}`, {
    motif: query.motif,
    login: query.login,
  })
  const res = await apiFetch(path, { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseString>(res, `Reversement carte failed (${res.status})`)
}

export async function searchOperationsAnnulees(
  body: SearchClientDto,
  query?: { collecteur?: string },
): Promise<ApiResponseListSummary> {
  const path = appendQuery('/api/operation/search-annule-collect', {
    collecteur: query?.collecteur,
  })
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseListSummary>(res, `Search annulations failed (${res.status})`)
}
