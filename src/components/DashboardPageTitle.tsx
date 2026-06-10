import { useLocation } from 'react-router-dom'
import { resolveDashboardPageSection } from '@/constants/dashboard-sections'
import { cn } from '@/lib/utils'
import { DASHBOARD_PAGE_SECTION_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from '@/constants/table-styles'

type DashboardPageTitleProps = {
  title: string
  /** Sidebar / drawer parent; inferred from the current route when omitted. */
  section?: string
  className?: string
}

export function DashboardPageTitle({ title, section, className }: DashboardPageTitleProps) {
  const { pathname } = useLocation()
  const resolvedSection = section ?? resolveDashboardPageSection(pathname)

  return (
    <div className={cn('min-w-0', className)}>
      {resolvedSection ? <div className={DASHBOARD_PAGE_SECTION_CLASS}>{resolvedSection}</div> : null}
      <h1 className={cn(DASHBOARD_PAGE_TITLE_CLASS, resolvedSection ? 'mt-1' : undefined)}>{title}</h1>
    </div>
  )
}
