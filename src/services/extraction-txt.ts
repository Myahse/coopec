import {
  EXTRAIRE_TXT_ENDPOINTS,
  listExtractionTxtSuperviseur,
  type ExtractionTxtSuperviseurResult,
  type ExtractionTxtSuperviseurRow,
  type ExtraireTxtEndpointSlug,
} from './extraction-txt-superviseur'

export {
  EXTRAIRE_TXT_ENDPOINTS,
  type ExtraireTxtEndpointSlug,
}

export type ExtractionTxtEndpoint = ExtraireTxtEndpointSlug

export type ExtractionTxtSearchBody = {
  agence: string
  dateDebut: string
  dateFin: string
  endpoint: ExtractionTxtEndpoint
  login?: string
}

export type ExtractionTxtRow = ExtractionTxtSuperviseurRow
export type ExtractionTxtResult = ExtractionTxtSuperviseurResult

export function extraireTxtFileFormat(endpoint: ExtractionTxtEndpoint): 'bm' | 'ibank' {
  return EXTRAIRE_TXT_ENDPOINTS.find((e) => e.value === endpoint)?.format ?? 'bm'
}

/** POST `/api/extraire-txt/{compensation|reversement}-{bm|ibank}` */
export async function listExtractionTxt(body: ExtractionTxtSearchBody): Promise<ExtractionTxtResult> {
  return listExtractionTxtSuperviseur({
    agence: body.agence,
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    login: body.login,
    endpointSlug: body.endpoint,
  })
}
