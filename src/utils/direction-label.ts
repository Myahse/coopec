import {
  directionLabelForAgenceCode,
  directionLabelForCode,
} from '@/utils/organization-filters'

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function pickCode(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

/** Libellé direction renvoyé avec l'utilisateur (`nomDirection`, etc.). */
export function pickNomDirectionFromUser(user: Record<string, unknown>): string {
  return pickString(user, [
    'nomDirection',
    'libelleDirection',
    'nomDirectionRegionale',
    'libelleDirectionRegionale',
    'libelledir',
    'libelleDir',
  ])
}

/** Libellé type utilisateur — uniquement si présent dans la réponse API (pas de table locale). */
export function pickLibelleTypeUtilisateur(user: Record<string, unknown>): string {
  return pickString(user, [
    'libelleTypeUtilisateur',
    'libelle_type_utilisateur',
    'nomTypeUtilisateur',
    'libelleType',
    'typeUtilisateurLibelle',
  ])
}

export function pickCodeDirectionFromUser(user: Record<string, unknown>): string {
  return pickCode(user, ['codeDirection', 'codeDirectionRegionale', 'codedir', 'code_direction'])
}

export function pickTypeUtilisateurFromUser(user: Record<string, unknown>): string {
  return pickCode(user, ['typeUtilisateur', 'type_utilisateur'])
}

/** Direction telle que renvoyée par l’API : libellés puis codes (`codeDirection`, `typeUtilisateur`, etc.). */
export function resolveAccountDirectionFromApi(
  authUser?: Record<string, unknown>,
  storedDirection?: string,
): string {
  if (authUser) {
    const nom = pickNomDirectionFromUser(authUser)
    if (nom) return nom

    const typeLib = pickLibelleTypeUtilisateur(authUser)
    if (typeLib) return typeLib

    const codeDir = pickCodeDirectionFromUser(authUser)
    if (codeDir) return codeDir

    const typeCode = pickTypeUtilisateurFromUser(authUser)
    if (typeCode) return typeCode
  }

  const stored = String(storedDirection ?? '').trim()
  if (stored) return stored

  return '—'
}

export type AccountDirectionLookup = {
  agenceCode: string
  agencesRows: unknown[]
  directionChoices: { value: string; label: string }[]
}

/**
 * Libellé « Direction » sur la carte compte : champs API utilisateur,
 * puis référentiel directions régionales (code ou agence).
 */
export function resolveAccountDirectionLabel(
  user: Record<string, unknown> | undefined,
  lookup: AccountDirectionLookup,
): string {
  if (user) {
    const nom = pickNomDirectionFromUser(user)
    if (nom) return nom

    const typeLib = pickLibelleTypeUtilisateur(user)
    if (typeLib) return typeLib

    const codeDir = pickCodeDirectionFromUser(user)
    if (codeDir) {
      const lbl = directionLabelForCode(codeDir, lookup.directionChoices)
      if (lbl !== '—') return lbl
    }
  }

  const fromAgence = directionLabelForAgenceCode(
    lookup.agenceCode,
    lookup.agencesRows,
    lookup.directionChoices,
  )
  if (fromAgence !== '—') return fromAgence

  return '—'
}
