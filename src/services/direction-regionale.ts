import { readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import type {
  Agence,
  ApiResponseListAgence,
  ApiResponseListSummary,
  ApiResponseString,
  ApiResponseWDirectionRegionalDto,
  Summary,
  WDirectionRegionalDto,
} from './openapi-components'

export type { WDirectionRegionalDto as DirectionRegionaleDto }
export type { Summary as DirectionRegionaleListRow }
export type { ApiResponseListSummary, ApiResponseWDirectionRegionalDto, ApiResponseListAgence, ApiResponseString }

export type DirectionRegionale = Summary

export type DirectionRegionaleOption = {
  value: string
  label: string
}

function extractRows(body: unknown): Summary[] {
  if (Array.isArray(body)) return body as Summary[]
  if (!body || typeof body !== 'object') return []
  const obj = body as Record<string, unknown>
  if (Array.isArray(obj.data)) return obj.data as Summary[]

  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    const nested = obj.data as Record<string, unknown>
    if (Array.isArray(nested.content)) return nested.content as Summary[]
    if (Array.isArray(nested.data)) return nested.data as Summary[]
  }
  if (Array.isArray(obj.content)) return obj.content as Summary[]
  return []
}

function pickDirectionLabel(r: Summary): string {
  const row = r as unknown as Record<string, unknown>
  const candidates = [
    row.nomDirectionRegionale,
    row.libelleDirectionRegionale,
    row.nomDirection,
    row.libelleDirection,
    row.libelledir,
    row.libelleDir,
    row.nomClient,
    row.nomCollecteur,
    row.motif,
    row.reference,
  ]
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function pickDirectionValue(r: Summary): string {
  const row = r as unknown as Record<string, unknown>
  const candidates = [row.codedir, row.codeDirectionRegionale, row.codeDirection, row.reference]
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  const label = pickDirectionLabel(r)
  return label.trim()
}

export async function getDirectionRegionaleOptions(): Promise<DirectionRegionaleOption[]> {
  const rows = await getDirectionsRegionalesRawRows()
  const seen = new Set<string>()
  const out: DirectionRegionaleOption[] = []
  for (const r of rows) {
    const value = pickDirectionValue(r)
    const label = pickDirectionLabel(r) || value
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push({ value, label })
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return out
}


export async function getDirectionsRegionalesRawRows(): Promise<Summary[]> {
  const res = await apiFetch('/api/direction-regionale', {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  const body = await readJsonIfOk<unknown>(res, `Get directions failed (${res.status})`)
  return extractRows(body)
}

export async function getDirectionsRegionales(): Promise<string[]> {
  const opts = await getDirectionRegionaleOptions()
  return opts.map((o) => o.label)
}

export async function getDirectionRegionaleByCode(code: string): Promise<ApiResponseWDirectionRegionalDto> {
  const c = String(code ?? '').trim()
  if (!c) throw new Error('code is required')

  const res = await apiFetch(`/api/direction-regionale/${encodeURIComponent(c)}`, { method: 'GET' })
  return readJsonIfOk<ApiResponseWDirectionRegionalDto>(res, `Get direction regionale failed (${res.status})`)
}

export type CreateDirectionRegionaleBody = WDirectionRegionalDto

export async function createDirectionRegionale(
  body: CreateDirectionRegionaleBody,
): Promise<ApiResponseWDirectionRegionalDto> {
  const res = await apiFetch('/api/direction-regionale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseWDirectionRegionalDto>(res, `Create direction regionale failed (${res.status})`)
}

export type UpdateDirectionRegionaleBody = WDirectionRegionalDto


export async function updateDirectionRegionale(
  code: string,
  body: UpdateDirectionRegionaleBody,
): Promise<ApiResponseWDirectionRegionalDto> {
  const c = String(code ?? '').trim()
  if (!c) throw new Error('code is required')

  const res = await apiFetch(`/api/direction-regionale/${encodeURIComponent(c)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseWDirectionRegionalDto>(res, `Update direction regionale failed (${res.status})`)
}

export async function deleteDirectionRegionale(code: string): Promise<ApiResponseString> {
  const c = String(code ?? '').trim()
  if (!c) throw new Error('code is required')

  const res = await apiFetch(`/api/direction-regionale/${encodeURIComponent(c)}`, { method: 'DELETE' })
  return readJsonIfOk<ApiResponseString>(res, `Delete direction regionale failed (${res.status})`)
}

export type { Agence as AgenceByDirection }


export async function getAgencesByDirection(codeDirection: string): Promise<ApiResponseListAgence> {
  const c = String(codeDirection ?? '').trim()
  if (!c) throw new Error('codeDirection is required')

  const res = await apiFetch(`/api/direction-regionale/${encodeURIComponent(c)}/agences`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponseListAgence>(res, `Get agences by direction failed (${res.status})`)
}
