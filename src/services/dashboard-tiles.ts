import { dashboardStatsQueryFromFilters, getDashboardStats } from '@/services/dashboard-stats'

export type DashboardFiltersSnapshot = {
  direction: string
  agence: string
  institution: string
  collecteur?: string
}

export type DashboardTileSnapshot = {
  collecteursEnLigne: number | null
  montantsCollectes: number | null
  nombreOperations: number | null
  chargesEpargne: number | null
  nombreCartesVendues: number | null
  operationsAnnulees: number | null
  montantsVerses: number | null
  collecteursAyantCollecte: number | null
  collecteursTotal: number | null
  clientsInactifs: number | null
}

export type DashboardTileErrors = Partial<{
  dashboard: string
}>

function emptySnapshot(): DashboardTileSnapshot {
  return {
    collecteursEnLigne: null,
    montantsCollectes: null,
    nombreOperations: null,
    chargesEpargne: null,
    nombreCartesVendues: null,
    operationsAnnulees: null,
    montantsVerses: null,
    collecteursAyantCollecte: null,
    collecteursTotal: null,
    clientsInactifs: null,
  }
}

export async function loadDashboardTileSnapshot(
  f: DashboardFiltersSnapshot,
): Promise<{ snapshot: DashboardTileSnapshot; errors: DashboardTileErrors }> {
  const errors: DashboardTileErrors = {}

  try {
    const base = dashboardStatsQueryFromFilters({
      direction: f.direction,
      agence: f.agence,
      institution: f.institution,
    })
    const snapshot = await getDashboardStats({
      ...base,
      collecteur: f.collecteur,
    })
    return { snapshot, errors }
  } catch (err) {
    errors.dashboard = err instanceof Error ? err.message : 'Statistiques dashboard indisponibles'
    return { snapshot: emptySnapshot(), errors }
  }
}
