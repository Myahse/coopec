import type { UtilisateurWithOtherInfo } from '@/services/openapi-components'
import { pickLibelleProfil } from '@/utils/profile-label'
import type { UserRow } from './types'

function normalizeUserLoginFromApi(u: Record<string, unknown>): string | undefined {
  const v = u.login
  if (typeof v === 'string') {
    const t = v.trim()
    if (t) return t
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return undefined
}

export function mapApiUserToUserRow(u: UtilisateurWithOtherInfo, page: number, idx: number): UserRow {
  const uAny = u as Record<string, unknown>
  const adresseRaw = uAny.adresse
  const adresse = typeof adresseRaw === 'string' ? adresseRaw : undefined
  const profil = typeof u.idProfil === 'number' && Number.isFinite(u.idProfil) ? u.idProfil : undefined
  const libelleProfil = pickLibelleProfil(u)
  const etat = typeof u.etat === 'number' && Number.isFinite(u.etat) ? u.etat : undefined
  const coRaw = uAny.codeOperation
  const codeOperation =
    typeof coRaw === 'string'
      ? coRaw.trim() || undefined
      : typeof coRaw === 'number' && Number.isFinite(coRaw)
        ? String(coRaw)
        : undefined
  return {
    id: String(u.matricule ?? u.login ?? `${page}_${idx}`),
    matricule: String(u.matricule ?? '—'),
    nomPrenoms: String(u.nomUtilisateur ?? '—'),
    telephone: String(u.telephone ?? '—'),
    email: String(u.email ?? '—'),
    agence: String(u.nomAgence ?? u.codeAgence ?? '—'),
    direction: String(u.nomDirection ?? u.codeDirection ?? '—'),
    niveau: u.niveau === 0 || u.niveau ? String(u.niveau) : '—',
    login: normalizeUserLoginFromApi(uAny),
    codeAgence:
      typeof u.codeAgence === 'string'
        ? u.codeAgence.trim()
        : typeof u.codeAgence === 'number' && Number.isFinite(u.codeAgence)
          ? String(u.codeAgence)
          : undefined,
    institutionCode: typeof u.institutionCode === 'string' ? u.institutionCode : undefined,
    adresse,
    profil,
    libelleProfil,
    etat,
    codeOperation,
  }
}

export function normalizeUserRowFromImport(input: Partial<UserRow> & Record<string, unknown>, idx: number): UserRow {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = input[k]
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
    }
    return ''
  }

  const matricule = pick('matricule', 'Matricule', 'MATRICULE')
  const nomPrenoms = pick('nomPrenoms', 'nom prenoms', 'Nom & prénoms', 'Nom & prenoms', 'Nom', 'NOM')
  const telephone = pick('telephone', 'Téléphone', 'Telephone', 'TEL', 'tel')
  const email = pick('email', 'Email', 'E-mail', 'MAIL')
  const agence = pick('agence', 'Agence', 'AGENCE')
  const direction = pick('direction', 'Direction', 'DIRECTION')
  const niveau = pick('niveau', 'Niveau', 'NIVEAU')

  return {
    id: `${Date.now()}_${idx}`,
    matricule: matricule || `U-${String(idx + 1).padStart(4, '0')}`,
    nomPrenoms: nomPrenoms || '—',
    telephone: telephone || '—',
    email: email || '—',
    agence: agence || '—',
    direction: direction || '—',
    niveau: niveau || '—',
  }
}
