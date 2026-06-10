import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardPageTitle } from '@/components/DashboardPageTitle'
import {
  DASHBOARD_TABLE_PAGE_BODY_CLASS,
  DASHBOARD_TABLE_PAGE_CLASS,
  DASHBOARD_TABLE_PAGE_HEADER_CLASS,
} from '@/constants/table-styles'

type DashboardTablePageLayoutProps = {
  section?: string
  title: string
  headerActions?: ReactNode
  /** Filters or extra blocks above the main table card */
  top?: ReactNode
  /** Alerts shown above the main card (errors, success messages). */
  alerts?: ReactNode
  cardTitle?: string
  cardDescription?: string
  toolbar?: ReactNode
  children: ReactNode
  /** Client-side table pagination bar (shown below the table). */
  pagination?: ReactNode
  footer?: ReactNode
}

export function DashboardTablePageLayout({
  section,
  title,
  headerActions,
  top,
  alerts,
  cardTitle,
  cardDescription,
  toolbar,
  children,
  pagination,
  footer,
}: DashboardTablePageLayoutProps) {
  return (
    <div className={DASHBOARD_TABLE_PAGE_CLASS}>
      <div className={DASHBOARD_TABLE_PAGE_HEADER_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardPageTitle title={title} section={section} />
          {headerActions ? <div className="flex flex-wrap items-center gap-2">{headerActions}</div> : null}
        </div>
      </div>

      <div className={DASHBOARD_TABLE_PAGE_BODY_CLASS}>
        {top}
        {alerts}
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
          {cardTitle || cardDescription ? (
            <CardHeader className="shrink-0 border-b border-border">
              {cardTitle ? <CardTitle>{cardTitle}</CardTitle> : null}
              {cardDescription ? <CardDescription>{cardDescription}</CardDescription> : null}
            </CardHeader>
          ) : null}
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
            {toolbar}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
            {pagination ? <div className="shrink-0">{pagination}</div> : null}
            {footer ? <div className="shrink-0">{footer}</div> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
