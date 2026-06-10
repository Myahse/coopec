import { appendQuery, readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import type {
  AnnulerCollecteRequestDto,
  ApiResponseListTransaction,
  ApiResponseListWAbonnement,
  ApiResponseListWObjectifDto,
  ApiResponseListWTypePret,
  ApiResponseString,
  SearchAbonnementDto,
  SearchObjectifDto,
  WPiecePretDto,
  WObjectifDto,
  WTypePretDto,
  WTypePretListItem,
} from './openapi-components'

export type {
  WTypePretDto as TypePretDto,
  WTypePretListItem as TypePretListItem,
  WPiecePretDto as PiecePretDto,
  WObjectifDto as ObjectifDto,
}
export type { SearchObjectifDto as SearchObjectifBody, SearchAbonnementDto as SearchAdministrationAbonnementBody }
export type { AnnulerCollecteRequestDto as AnnulerCollecteBody }

export async function getTypesPret(): Promise<ApiResponseListWTypePret> {
  const res = await apiFetch('/api/administration/type-pret', { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListWTypePret>(res, `Get type prêt failed (${res.status})`)
}

export async function createTypePret(body: WTypePretDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/administration/type-pret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Create type prêt failed (${res.status})`)
}

export async function updateTypePret(id: number | string, body: WTypePretDto): Promise<ApiResponseString> {
  const typePretId = String(id ?? '').trim()
  if (!typePretId) throw new Error('Identifiant type prêt manquant.')

  const path = `/api/administration/type-pret/${encodeURIComponent(typePretId)}`
  const res = await apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  if (res.ok) return readJsonIfOk<ApiResponseString>(res, `Update type prêt failed (${res.status})`)

  const putRes = await apiFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(putRes, `Update type prêt failed (${putRes.status})`)
}

export async function addPieceToTypePret(body: WPiecePretDto): Promise<ApiResponseString> {
  const typePret = Number(body.typePret)
  const typePiece = Number(body.typePiece)
  if (!Number.isFinite(typePret) || typePret <= 0) {
    throw new Error('Identifiant type prêt manquant.')
  }
  if (!Number.isFinite(typePiece) || typePiece <= 0) {
    throw new Error('Sélectionnez un type de pièce.')
  }

  const obligatoire = String(body.obligatoire ?? 'N').trim().toUpperCase()
  const rectoVerso = String(body.rectoVerso ?? 'N').trim().toUpperCase()
  const payload: WPiecePretDto = {
    typePret,
    typePiece,
    obligatoire: obligatoire === 'O' ? 'O' : 'N',
    rectoVerso: rectoVerso === 'O' ? 'O' : 'N',
    createdBy: String(body.createdBy ?? '').trim() || undefined,
  }

  const res = await apiFetch('/api/administration/type-pret/piece', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(payload),
  })
  return readJsonIfOk<ApiResponseString>(res, `Add piece to type prêt failed (${res.status})`)
}

export async function createObjectif(body: WObjectifDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/administration/objectif', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Create objectif failed (${res.status})`)
}

export async function searchObjectifs(body: SearchObjectifDto): Promise<ApiResponseListWObjectifDto> {
  const res = await apiFetch('/api/administration/objectif/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseListWObjectifDto>(res, `Search objectifs failed (${res.status})`)
}

export async function deleteObjectif(id: number | string): Promise<ApiResponseString> {
  const objectifId = String(id ?? '').trim()
  if (!objectifId) throw new Error('Identifiant objectif manquant.')

  const numericId = Number(objectifId)
  const body = { id: Number.isFinite(numericId) ? numericId : objectifId }

  const res = await apiFetch('/api/administration/objectif', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  if (res.ok) return readJsonIfOk<ApiResponseString>(res, `Delete objectif failed (${res.status})`)

  const pathRes = await apiFetch(`/api/administration/objectif/${encodeURIComponent(objectifId)}`, {
    method: 'DELETE',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponseString>(pathRes, `Delete objectif failed (${pathRes.status})`)
}

export async function updateObjectif(id: number | string, body: WObjectifDto): Promise<ApiResponseString> {
  const objectifId = String(id ?? '').trim()
  if (!objectifId) throw new Error('Identifiant objectif manquant.')

  const numericId = Number(objectifId)
  const payload: WObjectifDto = {
    ...body,
    id: Number.isFinite(numericId) ? numericId : body.id,
  }
  const path = `/api/administration/objectif/${encodeURIComponent(objectifId)}`

  const res = await apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(payload),
  })
  if (res.ok) return readJsonIfOk<ApiResponseString>(res, `Update objectif failed (${res.status})`)

  const putRes = await apiFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(payload),
  })
  return readJsonIfOk<ApiResponseString>(putRes, `Update objectif failed (${putRes.status})`)
}

export async function listAbonnementsAdmin(
  body: SearchAbonnementDto,
  query?: { carte?: string },
): Promise<ApiResponseListWAbonnement> {
  const path = appendQuery('/api/administration/list-abonnement', {
    all: true,
    carte: query?.carte,
  })

  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseListWAbonnement>(res, `List abonnements failed (${res.status})`)
}

export async function annulerCollecte(body: AnnulerCollecteRequestDto): Promise<unknown> {
  const res = await apiFetch('/api/administration/annuler-collecte', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<unknown>(res, `Annuler collecte failed (${res.status})`)
}

export async function supprimerAbonnement(numAbonnement: string): Promise<unknown> {
  const n = String(numAbonnement ?? '').trim()
  if (!n) throw new Error('numAbonnement is required')

  const res = await apiFetch(`/api/administration/supprimer-abonnement/${encodeURIComponent(n)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<unknown>(res, `Supprimer abonnement failed (${res.status})`)
}

export async function supprimerAbonnementClient(numAbonnement: string): Promise<unknown> {
  const n = String(numAbonnement ?? '').trim()
  if (!n) throw new Error('numAbonnement is required')

  const res = await apiFetch(`/api/administration/supprimer-abonnement-client/${encodeURIComponent(n)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<unknown>(res, `Supprimer abonnement client failed (${res.status})`)
}

export async function listCollecteAbonnement(carte: string): Promise<ApiResponseListTransaction> {
  const c = String(carte ?? '').trim()
  if (!c) throw new Error('carte is required')

  const res = await apiFetch(`/api/administration/list-collecte-abonnement/${encodeURIComponent(c)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponseListTransaction>(res, `List collecte abonnement failed (${res.status})`)
}
