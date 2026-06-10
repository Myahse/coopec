import { readJsonIfOk } from './api-json'
import { apiFetch } from './http'
import type {
  ApiResponseListUtilisateurWithOtherInfo,
  ApiResponseListWorkFlow,
  ApiResponseString,
  UtilisateurWithOtherInfo,
  WUtilisateurDto,
  WUtilisateurUpdateAgenceDto,
  WUtilisateurUpdateDto,
  WorkFlowRegisterDto,
} from './openapi-components'

/** `POST /api/user/renvoyer-parametre` — paramètres de connexion (JSON strict). */
export type RenvoyerParametreUserBody = {
  codeOperation: string
  codeBanque: string
  login: string
}

export type {
  UtilisateurWithOtherInfo as FindUserDto,
  ApiResponseListUtilisateurWithOtherInfo as FindUsersResponse,
  RenvoyerParametreUserBody as RenvoyerParametreBody,
  WUtilisateurDto as CreateUserBody,
  WUtilisateurUpdateDto as UpdateUserBody,
  WUtilisateurUpdateAgenceDto as ChangerAgenceBody,
  WorkFlowRegisterDto as WorkflowSaveBody,
}

export type FindUsersQuery = {
  direction: string
  agence: string
  niveau?: number
  page?: number
  size?: number
}

export type SearchUsersQuery = {
  search: string
  page?: number
  size?: number
}

function toQueryString(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function findUsers(query: FindUsersQuery): Promise<ApiResponseListUtilisateurWithOtherInfo> {
  const page = query.page ?? 0
  const size = query.size ?? 10

  const useNiveauEndpoint = typeof query.niveau === 'number' && Number.isFinite(query.niveau)
  const path = useNiveauEndpoint ? '/api/user/find-niveau' : '/api/user/find'

  const res = await apiFetch(
    `${path}${toQueryString({
      direction: query.direction,
      agence: query.agence,
      niveau: useNiveauEndpoint ? query.niveau : undefined,
      page,
      size,
    })}`,
    { method: 'GET', headers: { accept: '*/*' } },
  )
  return readJsonIfOk<ApiResponseListUtilisateurWithOtherInfo>(res, `Find users failed (${res.status})`)
}

export async function findUsersByDirectionAgence(
  query: Pick<FindUsersQuery, 'direction' | 'agence' | 'page' | 'size'>,
): Promise<ApiResponseListUtilisateurWithOtherInfo> {
  return findUsers({
    direction: query.direction,
    agence: query.agence,
    page: query.page,
    size: query.size,
  })
}

export async function findUsersByDirectionAgenceNiveau(
  query: Pick<FindUsersQuery, 'direction' | 'agence' | 'page' | 'size'> & { niveau: number },
): Promise<ApiResponseListUtilisateurWithOtherInfo> {
  return findUsers(query)
}

export async function createUser(body: WUtilisateurDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Create user failed (${res.status})`)
}

/** `PATCH /api/user/{login}` (OpenAPI `update`). */
export async function updateUser(login: string, body: WUtilisateurUpdateDto): Promise<ApiResponseString> {
  const l = String(login ?? '').trim()
  if (!l) throw new Error('login is required')

  const res = await apiFetch(`/api/user/${encodeURIComponent(l)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Update user failed (${res.status})`)
}

export async function deleteUser(login: string): Promise<ApiResponseString> {
  const l = String(login ?? '').trim()
  if (!l) throw new Error('login is required')

  const res = await apiFetch(`/api/user/${encodeURIComponent(l)}`, { method: 'DELETE', headers: { accept: '*/*' } })
  return readJsonIfOk<ApiResponseString>(res, `Delete user failed (${res.status})`)
}

export async function changerAgence(body: WUtilisateurUpdateAgenceDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/user/changer-agence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Changer agence failed (${res.status})`)
}

export async function renvoyerParametre(body: RenvoyerParametreUserBody): Promise<ApiResponseString> {
  const payload: RenvoyerParametreUserBody = {
    codeOperation: String(body.codeOperation ?? '').trim(),
    codeBanque: String(body.codeBanque ?? '').trim(),
    login: String(body.login ?? '').trim(),
  }
  const res = await apiFetch('/api/user/renvoyer-parametre', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(payload),
  })
  return readJsonIfOk<ApiResponseString>(res, `Renvoyer paramètre failed (${res.status})`)
}

/** `GET /api/user/workflow-list` — paramètre requis `login` (OpenAPI). */
export async function getWorkflowList(login: string): Promise<ApiResponseListWorkFlow> {
  const l = String(login ?? '').trim()
  if (!l) throw new Error('login is required')

  const res = await apiFetch(`/api/user/workflow-list${toQueryString({ login: l })}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  })
  return readJsonIfOk<ApiResponseListWorkFlow>(res, `Workflow list failed (${res.status})`)
}

export async function saveWorkflowAssociation(body: WorkFlowRegisterDto): Promise<ApiResponseString> {
  const res = await apiFetch('/api/user/workflow-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: '*/*' },
    body: JSON.stringify(body),
  })
  return readJsonIfOk<ApiResponseString>(res, `Workflow save failed (${res.status})`)
}

export async function searchUsers(query: SearchUsersQuery): Promise<ApiResponseListUtilisateurWithOtherInfo> {
  const search = query.search.trim()
  const page = query.page ?? 0
  const size = query.size ?? 10

  const res = await apiFetch(
    `/api/user/search${toQueryString({
      search,
      page,
      size,
    })}`,
    { method: 'GET', headers: { accept: '*/*' } },
  )
  return readJsonIfOk<ApiResponseListUtilisateurWithOtherInfo>(res, `Search users failed (${res.status})`)
}
