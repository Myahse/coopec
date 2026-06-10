import type { ReactNode } from 'react'
import { DashboardPageTitle } from '@/components/DashboardPageTitle'
import {
  DASHBOARD_TABLE_PAGE_BODY_CLASS,
  DASHBOARD_TABLE_PAGE_CLASS,
  DASHBOARD_TABLE_PAGE_HEADER_CLASS,
} from '@/constants/table-styles'

type DashboardPageShellProps = {
  title: string
  section?: string
  headerActions?: ReactNode
  children: ReactNode
}

/** Page chrome (title + padded body) for screens with multiple section cards. */
export function DashboardPageShell({ title, section, headerActions, children }: DashboardPageShellProps) {
  return (
    <div className={DASHBOARD_TABLE_PAGE_CLASS}>
      <div className={DASHBOARD_TABLE_PAGE_HEADER_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardPageTitle title={title} section={section} />
          {headerActions ? <div className="flex flex-wrap items-center gap-2">{headerActions}</div> : null}
        </div>
      </div>
      <div className={DASHBOARD_TABLE_PAGE_BODY_CLASS}>{children}</div>
    </div>
  )
}
