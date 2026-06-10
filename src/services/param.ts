import { readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import type {
  ApiResponseListWCivilite,
  ApiResponseListWPays,
  ApiResponseListWPeriode,
  ApiResponseListWSecteuractivite,
  ApiResponseListWSituationMatrimonial,
  ApiResponseListWTypeClient,
  ApiResponseListWTypeCollect,
  ApiResponseListWTypePieceAdm,
  Summary,
} from './openapi-components'

export type { WCivilite as Civilite, WPays as Pays, WPeriode as Periode } from './openapi-components'
export type { WSecteuractivite as SecteurActivite, WSituationMatrimonial as SituationMatrimoniale } from './openapi-components'
export type { WTypeClient as TypeClient, WTypeCollect as TypeCollecte, WTypePieceAdm as TypePiece } from './openapi-components'
/** OpenAPI lists `Summary` as the item schema for pret nature / pallier arrays. */
export type { Summary as PretParamRow } from './openapi-components'

export async function getCivilites(): Promise<ApiResponseListWCivilite> {
  const res = await apiFetch('/api/param/civilite', { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListWCivilite>(res, `Get civilite failed (${res.status})`)
}

export async function getPays(): Promise<ApiResponseListWPays> {
  const res = await apiFetch('/api/param/pays', { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListWPays>(res, `Get pays failed (${res.status})`)
}

export async function getPeriodes(): Promise<ApiResponseListWPeriode> {
  const res = await apiFetch('/api/param/periode', { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListWPeriode>(res, `Get periode failed (${res.status})`)
}

/** OpenAPI: `200` body is `array` of `Summary` (no `ApiResponse` wrapper). */
export async function getPretNatures(): Promise<Summary[]> {
  const res = await apiFetch('/api/param/pret/nature', { method: 'GET', headers: { accept: '*/*' } })
  const raw = await readJsonIfOk<Summary[] | { data?: Summary[] }>(res, `Get pret nature failed (${res.status})`)
  return Array.isArray(raw) ? raw : (raw.data ?? [])
}

/** OpenAPI: `200` body is `array` of `Summary` (no `ApiResponse` wrapper). */
export async function getPretPalliers(): Promise<Summary[]> {
  const res = await apiFetch('/api/param/pret/pallier', { method: 'GET', headers: { accept: '*/*' } })
  const raw = await readJsonIfOk<Summary[] | { data?: Summary[] }>(res, `Get pret pallier failed (${res.status})`)
  return Array.isArray(raw) ? raw : (raw.data ?? [])
}

export async function getSecteursActivite(): Promise<ApiResponseListWSecteuractivite> {
  const res = await apiFetch('/api/param/secteur-activite', { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListWSecteuractivite>(res, `Get secteur activite failed (${res.status})`)
}

export async function getSituationsMatrimoniales(): Promise<ApiResponseListWSituationMatrimonial> {
  const res = await apiFetch('/api/param/situation-matrimonial', { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListWSituationMatrimonial>(res, `Get situation matrimonial failed (${res.status})`)
}

export async function getTypesClient(): Promise<ApiResponseListWTypeClient> {
  const res = await apiFetch('/api/param/type-client', { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListWTypeClient>(res, `Get type client failed (${res.status})`)
}

export async function getTypesCollecte(): Promise<ApiResponseListWTypeCollect> {
  const res = await apiFetch('/api/param/type-collecte', { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListWTypeCollect>(res, `Get type collecte failed (${res.status})`)
}

export async function getTypesPiece(): Promise<ApiResponseListWTypePieceAdm> {
  const res = await apiFetch('/api/param/type-piece', { method: 'GET', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseListWTypePieceAdm>(res, `Get type piece failed (${res.status})`)
}
