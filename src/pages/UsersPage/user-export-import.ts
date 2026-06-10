import * as XLSX from 'xlsx'
import { findUsers, searchUsers } from '@/services/user'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'
import { mapApiUserToUserRow, normalizeUserRowFromImport } from './user-mappers'
import type { UserRow } from './types'

type FetchAllParams = {
  queryApplied: string
  filterDirection: string
  filterAgence: string
  pageSize: number
  directionQueryParam: (value: string) => string
  agenceQueryParam: (value: string) => string
}

export async function fetchAllUserRowsForExport(params: FetchAllParams): Promise<UserRow[]> {
  const q = params.queryApplied.trim()
  const size = params.pageSize
  const merged: UserRow[] = []
  for (let pageIdx = 0; pageIdx < 500; pageIdx++) {
    const payload = q
      ? await searchUsers({ search: q, page: pageIdx, size })
      : await findUsers({
          direction: params.directionQueryParam(params.filterDirection),
          agence: params.agenceQueryParam(params.filterAgence),
          page: pageIdx,
          size,
        })
    const data = Array.isArray(payload.data) ? payload.data : []
    merged.push(...data.map((u, idx) => mapApiUserToUserRow(u, pageIdx, idx)))
    if (data.length < size) break
  }
  return merged
}

const USER_EXPORT_HEADERS = [
  'Matricule',
  'Nom & prénoms',
  'Téléphone',
  'Email',
  'Agence',
  'Direction',
  'Profil',
  'Niveau',
] as const

export function exportUsersToXlsx(rows: UserRow[]) {
  exportJsonToXlsx(
    'utilisateurs',
    'Utilisateurs',
    rows.map((r) => ({
      Matricule: r.matricule,
      'Nom & prénoms': r.nomPrenoms,
      Téléphone: r.telephone,
      Email: r.email,
      Agence: r.agence,
      Direction: r.direction,
      Profil: r.libelleProfil?.trim() || '—',
      Niveau: r.niveau,
    })),
  )
}

export function exportUsersToPdf(rows: UserRow[]) {
  exportTableToPdf(
    'Gestion des utilisateurs',
    'utilisateurs',
    [...USER_EXPORT_HEADERS],
    rows.map((r) => [
      r.matricule,
      r.nomPrenoms,
      r.telephone,
      r.email,
      r.agence,
      r.direction,
      r.libelleProfil?.trim() || '—',
      r.niveau,
    ]),
  )
}

export async function importUsersFromXls(file: File): Promise<UserRow[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  return json.map((row, idx) => normalizeUserRowFromImport(row, idx))
}
