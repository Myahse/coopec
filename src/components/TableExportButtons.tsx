import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TableExportButtonsProps = {
  disabled?: boolean
  onExportXls: () => void
  onExportPdf: () => void
  className?: string
}

/** Export XLS / PDF — same labels and style as Gestion des utilisateurs. */
export function TableExportButtons({
  disabled = false,
  onExportXls,
  onExportPdf,
  className,
}: TableExportButtonsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onExportXls}>
        Export XLS
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onExportPdf}>
        Export PDF
      </Button>
    </div>
  )
}
