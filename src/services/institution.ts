import { readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import type {
  ApiResponseInstitutionDto,
  ApiResponseListInstitutionDto,
  ApiResponseString,
  InstitutionDto,
} from './openapi-components'

export type { InstitutionDto, ApiResponseInstitutionDto, ApiResponseListInstitutionDto, ApiResponseString }

export type Institution = InstitutionDto

export async function getInstitutions(): Promise<ApiResponseListInstitutionDto> {
  const res = await apiFetch('/api/institution', { method: 'GET' })
  return readJsonIfOk<ApiResponseListInstitutionDto>(res, `Get institutions failed (${res.status})`)
}

export async function getInstitutionByCode(code: string): Promise<ApiResponseInstitutionDto> {
  const c = String(code ?? '').trim()
  if (!c) throw new Error('code is required')

  const res = await apiFetch(`/api/institution/${encodeURIComponent(c)}`, { method: 'GET' })
  return readJsonIfOk<ApiResponseInstitutionDto>(res, `Get institution failed (${res.status})`)
}

export type CreateInstitutionBody = InstitutionDto
export type UpdateInstitutionBody = InstitutionDto

export async function createInstitution(body: CreateInstitutionBody): Promise<ApiResponseInstitutionDto> {
  const res = await apiFetch('/api/institution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseInstitutionDto>(res, `Create institution failed (${res.status})`)
}

/** `PATCH /api/institution/{code}` (OpenAPI `editInstitution`). */
export async function updateInstitution(code: string, body: UpdateInstitutionBody): Promise<ApiResponseInstitutionDto> {
  const c = String(code ?? '').trim()
  if (!c) throw new Error('code is required')

  const res = await apiFetch(`/api/institution/${encodeURIComponent(c)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseInstitutionDto>(res, `Update institution failed (${res.status})`)
}

export async function deleteInstitution(code: string): Promise<ApiResponseString> {
  const c = String(code ?? '').trim()
  if (!c) throw new Error('code is required')

  const res = await apiFetch(`/api/institution/${encodeURIComponent(c)}`, { method: 'DELETE' })
  return readJsonIfOk<ApiResponseString>(res, `Delete institution failed (${res.status})`)
}
