import { readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import type {
  ApiResponseListHistorique,
  ApiResponseListWClient,
  ApiResponseListWClientDatas,
  ApiResponseListWClientSolde,
  ApiResponseString,
  ChangementAgenceCollecteurRequestDto,
  CodeSmsRequest,
  RemplacementCollecteurRequestDto,
  WClientDto,
} from './openapi-components'

/** `POST /api/collecteur/renvoyer-parametre` — même contrat que pour l’utilisateur. */
export type RenvoyerParametreCollecteurBody = {
  codeOperation: string
  codeBanque: string
  login: string
}

export type { WClientDto as CollecteurBody }
export type { ChangementAgenceCollecteurRequestDto as ChangementAgenceCollecteurBody }
export type { RemplacementCollecteurRequestDto as RemplacementCollecteurBody }
export type { CodeSmsRequest }

export async function createCollecteur(body: WClientDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/collecteur', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Create collecteur failed (${res.status})`)
}

export async function updateCollecteur(login: string, body: WClientDto): Promise<unknown> {
  const l = String(login ?? '').trim()
  if (!l) throw new Error('login is required')

  const res = await apiFetch(`/api/collecteur/update/${encodeURIComponent(l)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<unknown>(res, `Update collecteur failed (${res.status})`)
}

export async function changementAgenceCollecteur(body: ChangementAgenceCollecteurRequestDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/collecteur/changement-agence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Changement agence collecteur failed (${res.status})`)
}

export async function renvoyerParametreCollecteur(body: RenvoyerParametreCollecteurBody): Promise<ApiResponseString> {
  const payload: RenvoyerParametreCollecteurBody = {
    codeOperation: String(body.codeOperation ?? '').trim(),
    codeBanque: String(body.codeBanque ?? '').trim(),
    login: String(body.login ?? '').trim(),
  }
  const res = await apiFetch('/api/collecteur/renvoyer-parametre', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(payload),
  })
  return readJsonIfOk<ApiResponseString>(res, `Renvoyer paramètre collecteur failed (${res.status})`)
}

export async function remplacementCollecteur(body: RemplacementCollecteurRequestDto): Promise<unknown> {
  const res = await apiFetch('/api/collecteur/remplacement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<unknown>(res, `Remplacement collecteur failed (${res.status})`)
}

export async function listCollecteursParAgence(agence: string): Promise<ApiResponseListWClientDatas> {
  const a = String(agence ?? '').trim()
  if (!a) throw new Error('agence is required')

  const res = await apiFetch(`/api/collecteur/liste/${encodeURIComponent(a)}`, { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListWClientDatas>(res, `Liste collecteur par agence failed (${res.status})`)
}

export async function listCollecteursAvecSoldeParAgence(agence: string): Promise<ApiResponseListWClientSolde> {
  const a = String(agence ?? '').trim()
  if (!a) throw new Error('agence is required')

  const res = await apiFetch(`/api/collecteur/liste/${encodeURIComponent(a)}/solde`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponseListWClientSolde>(res, `Liste collecteur solde failed (${res.status})`)
}

export async function listClientsParCollecteur(login: string): Promise<ApiResponseListWClient> {
  const l = String(login ?? '').trim()
  if (!l) throw new Error('login is required')

  const res = await apiFetch(`/api/collecteur/liste-client/${encodeURIComponent(l)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponseListWClient>(res, `Liste client par collecteur failed (${res.status})`)
}

export async function getHistoriqueChangementAgence(codeClient: string): Promise<ApiResponseListHistorique> {
  const c = String(codeClient ?? '').trim()
  if (!c) throw new Error('codeClient is required')

  const res = await apiFetch(`/api/collecteur/changement-agence-historique/${encodeURIComponent(c)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponseListHistorique>(res, `Historique changement agence failed (${res.status})`)
}
