import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type DashboardSectionCardProps = {
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  contentClassName?: string
}

/** Rounded bordered section — use inside dashboard pages with multiple panels. */
export function DashboardSectionCard({
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
}: DashboardSectionCardProps) {
  return (
    <Card className={cn('flex min-h-0 min-w-0 flex-col', className)}>
      {title || description ? (
        <CardHeader className="shrink-0 border-b border-border">
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn('flex min-h-0 flex-1 flex-col gap-4 pt-4', contentClassName)}>
        {children}
      </CardContent>
      {footer ? <CardFooter className="shrink-0">{footer}</CardFooter> : null}
    </Card>
  )
}
