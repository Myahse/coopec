import { appendQuery, readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import type {
  ApiResponseListWClient,
  ApiResponseString,
  ApiResponseWClientCollecteur,
  SearchClientDto,
  WClientDto,
} from './openapi-components'

/** `POST /api/client/renvoyer-parametre` — corps strict. */
export type RenvoyerParametreClientBody = {
  codeOperation: string
  codeBanque: string
  login: string
}

export type {
  ApiResponseListWClient,
  ApiResponseString,
  ApiResponseWClientCollecteur,
  CodeSmsRequest,
  SearchClientDto as SearchClientBody,
  WClient as ClientRow,
} from './openapi-components'

export type UpdateClientBody = WClientDto

export async function searchClients(
  body: SearchClientDto,
  query?: { search?: string; collecteur?: string },
): Promise<ApiResponseListWClient> {
  const path = appendQuery('/api/client/search', {
    all: true,
    search: query?.search,
    collecteur: query?.collecteur,
  })

  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseListWClient>(res, `Search clients failed (${res.status})`)
}

export async function updateClient(login: string, body: UpdateClientBody): Promise<unknown> {
  const l = String(login ?? '').trim()
  if (!l) throw new Error('login is required')

  const res = await apiFetch(`/api/client/update/${encodeURIComponent(l)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<unknown>(res, `Update client failed (${res.status})`)
}

export async function renvoyerParametreClient(body: RenvoyerParametreClientBody): Promise<ApiResponseString> {
  const payload: RenvoyerParametreClientBody = {
    codeOperation: String(body.codeOperation ?? '').trim(),
    codeBanque: String(body.codeBanque ?? '').trim(),
    login: String(body.login ?? '').trim(),
  }
  const res = await apiFetch('/api/client/renvoyer-parametre', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(payload),
  })
  return readJsonIfOk<ApiResponseString>(res, `Renvoyer paramètre client failed (${res.status})`)
}

export async function renvoyerParametreAutreClient(codeClient: string): Promise<ApiResponseString> {
  const c = String(codeClient ?? '').trim()
  if (!c) throw new Error('codeClient is required')

  const res = await apiFetch(`/api/client/renvoyer-parametre/${encodeURIComponent(c)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponseString>(res, `Renvoyer paramètre autre client failed (${res.status})`)
}

// OpenAPI: 200 content is untyped object (no components schema $ref).
export async function getClientDetails(codeClient: string): Promise<unknown> {
  const c = String(codeClient ?? '').trim()
  if (!c) throw new Error('codeClient is required')

  const res = await apiFetch(`/api/client/details/${encodeURIComponent(c)}`, { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<unknown>(res, `Get client details failed (${res.status})`)
}

export async function getImpayeCollecte(carte: string): Promise<unknown> {
  const c = String(carte ?? '').trim()
  if (!c) throw new Error('carte is required')

  const res = await apiFetch(`/api/client/impaye-collecte/${encodeURIComponent(c)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<unknown>(res, `Get impayé collecte failed (${res.status})`)
}

export async function getClientCollecteur(login: string): Promise<ApiResponseWClientCollecteur> {
  const l = String(login ?? '').trim()
  if (!l) throw new Error('login is required')

  const res = await apiFetch(`/api/client/collecteur/${encodeURIComponent(l)}`, { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseWClientCollecteur>(res, `Get client collecteur failed (${res.status})`)
}
