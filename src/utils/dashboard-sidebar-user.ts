import { resolveAccountProfileLabel } from '@/utils/profile-label'
import { getStoredAuth, getStoredUserContext } from '@/utils/auth-session'
import { agencyLabelForCode, directionLabelForCode } from '@/utils/organization-filters'
import { resolveAccountDirectionFromApi } from '@/utils/direction-label'

export type DashboardSidebarUser = {
  name: string
  direction: string
  agency: string
  profile: string
  login: string
  email: string
  telephone: string
}

function profileFromAuthUser(u: Record<string, unknown>): string {
  return resolveAccountProfileLabel(u)
}

function directionFromAuthUser(u: Record<string, unknown>): string {
  return resolveAccountDirectionFromApi(u)
}

function fromAuthUser(u: Record<string, unknown>): DashboardSidebarUser {
  return {
    name: String(u.nomUtilisateur ?? u.login ?? 'Utilisateur'),
    direction: directionFromAuthUser(u),
    agency: String(u.codeAgence ?? '—'),
    profile: profileFromAuthUser(u),
    login: String(u.login ?? '—'),
    email: String(u.email ?? '—'),
    telephone: String(u.telephone ?? '—'),
  }
}

export type DashboardUserLabelLookup = {
  agenceOptions: { value: string; label: string }[]
  agencesRows: unknown[]
  directionChoices: { value: string; label: string }[]
}

/** Enrichit l’agence (libellé) ; direction et profil restent tels que l’API / session. */
export function enrichDashboardSidebarUser(
  user: DashboardSidebarUser | undefined,
  lookup: DashboardUserLabelLookup,
  agenceCodeOverride?: string,
  _authUser?: Record<string, unknown>,
): DashboardSidebarUser | undefined {
  if (!user) return undefined
  const agCode = String(agenceCodeOverride ?? user.agency ?? '').trim()
  const agency = agencyLabelForCode(agCode, lookup.agenceOptions, lookup.agencesRows)
  // Convert direction code (often numeric) to its human label when we can.
  const direction = directionLabelForCode(user.direction, lookup.directionChoices)
  return { ...user, agency, direction }
}


export function getDashboardSidebarUser(): DashboardSidebarUser | undefined {
  try {
    let fromAuth: DashboardSidebarUser | undefined
    const authUser = getStoredAuth()?.user
    if (authUser) fromAuth = fromAuthUser(authUser as Record<string, unknown>)

    const u = getStoredUserContext()
    if (!u) return fromAuth
    return {
      name: String(u.name ?? fromAuth?.name ?? 'Utilisateur'),
      direction: resolveAccountDirectionFromApi(
        authUser as Record<string, unknown> | undefined,
        String(u.direction ?? fromAuth?.direction ?? '—'),
      ),
      agency: String(u.agency ?? fromAuth?.agency ?? '—'),
      profile: resolveAccountProfileLabel(
        authUser as Record<string, unknown> | undefined,
        String(u.profile ?? fromAuth?.profile ?? '—'),
      ),
      login: String(u.login ?? fromAuth?.login ?? '—'),
      email: String(u.email ?? fromAuth?.email ?? '—'),
      telephone: String(u.telephone ?? fromAuth?.telephone ?? '—'),
    }
  } catch {
    return undefined
  }
}
