
export type DashboardFilterFields = {
  direction: string
  agence: string
  institution: string
}

export type DashboardApiScopeQuery = {
  direction?: string
  codeDirection?: string
  agence?: string
  codeAgence?: string
  institution?: string
  codeInstitution?: string
 
  all?: boolean
}

export function dashboardFiltersToApiQuery(f: DashboardFilterFields): DashboardApiScopeQuery {
  const direction = f.direction === 'Toutes' ? '' : f.direction.trim()
  const agence = f.agence === 'Toutes' ? '' : f.agence.trim()
  const institution = f.institution === 'Toutes' ? '' : f.institution.trim()

  const directionToutes = f.direction === 'Toutes'
  const agenceToutes = f.agence === 'Toutes'

  return {
    direction: direction || undefined,
    codeDirection: direction || undefined,
    agence: agence || undefined,
    codeAgence: agence || undefined,
    institution: institution || undefined,
    codeInstitution: institution || undefined,
    /** Direction et/ou agence « Toutes » : périmètre élargi (`all=true`), filtres restants en query. */
    all: directionToutes || agenceToutes ? true : undefined,
  }
}
