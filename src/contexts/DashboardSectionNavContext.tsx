import { createContext, useContext } from 'react'

export type DashboardSectionLink = { label: string; to: string }

type DashboardSectionNavContextValue = {
  openSection: (section: DashboardSectionLink) => void
}

export const DashboardSectionNavContext = createContext<DashboardSectionNavContextValue | null>(null)

export function useDashboardSectionNav(): DashboardSectionNavContextValue {
  const ctx = useContext(DashboardSectionNavContext)
  if (!ctx) throw new Error('useDashboardSectionNav must be used within DashboardSectionsShell')
  return ctx
}
