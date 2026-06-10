import { readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import type { AgenceDto, ApiResponseAgenceDto, ApiResponseListSummary, ApiResponseString } from './openapi-components'

export type { AgenceDto }
export type { ApiResponseAgenceDto, ApiResponseListSummary, ApiResponseString }

/** Corps création / mise à jour : schéma `AgenceDto` (OpenAPI). */
export type CreateAgenceBody = AgenceDto
export type UpdateAgenceBody = AgenceDto

/** `GET /api/agence` → `ApiResponseListSummary` (schéma documenté). */
export async function getAgences(): Promise<ApiResponseListSummary> {
  const res = await apiFetch('/api/agence', { method: 'GET' })
  return readJsonIfOk<ApiResponseListSummary>(res, `Get agences failed (${res.status})`)
}

export async function getAgenceById(id: number | string): Promise<ApiResponseAgenceDto> {
  const res = await apiFetch(`/api/agence/${encodeURIComponent(String(id))}`, { method: 'GET' })
  return readJsonIfOk<ApiResponseAgenceDto>(res, `Get agence failed (${res.status})`)
}

export async function getAgenceByCodeAgence(codeAgence: string): Promise<ApiResponseAgenceDto> {
  const code = String(codeAgence ?? '').trim()
  if (!code) throw new Error('codeAgence is required')

  const res = await apiFetch(`/api/agence/code-agence/${encodeURIComponent(code)}`, { method: 'GET' })
  return readJsonIfOk<ApiResponseAgenceDto>(res, `Get agence by codeAgence failed (${res.status})`)
}

export async function createAgence(body: CreateAgenceBody): Promise<ApiResponseAgenceDto> {
  const res = await apiFetch('/api/agence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseAgenceDto>(res, `Create agence failed (${res.status})`)
}

/** `PATCH /api/agence/{id}` (OpenAPI `editAgence`). */
export async function updateAgence(id: number | string, body: UpdateAgenceBody): Promise<ApiResponseAgenceDto> {
  const res = await apiFetch(`/api/agence/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseAgenceDto>(res, `Update agence failed (${res.status})`)
}

export async function deleteAgence(id: number | string): Promise<ApiResponseString> {
  const res = await apiFetch(`/api/agence/${encodeURIComponent(String(id))}`, { method: 'DELETE' })
  return readJsonIfOk<ApiResponseString>(res, `Delete agence failed (${res.status})`)
}
