import { readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import type { ApiResponseString, WPersonneReferenceDto } from './openapi-components'

export type { WPersonneReferenceDto as PersonneRessourceBody }

export async function savePersonneRessource(body: WPersonneReferenceDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/personne-ressource', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Save personne ressource failed (${res.status})`)
}

export async function getPersonneRessource(codeClient: string): Promise<unknown> {
  const c = String(codeClient ?? '').trim()
  if (!c) throw new Error('codeClient is required')

  const res = await apiFetch(`/api/personne-ressource/${encodeURIComponent(c)}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<unknown>(res, `Get personne ressource failed (${res.status})`)
}
