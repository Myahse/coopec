import type { useTablePagination } from '@/hooks/use-table-pagination'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type TablePaginationProps = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  enabled: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  className?: string
}

export function TablePagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  enabled,
  onPageChange,
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  if (!enabled) return null

  const from = page * pageSize + 1
  const to = Math.min(totalCount, (page + 1) * pageSize)

  return (
    <div
      className={
        className ??
        'flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3'
      }
    >
      <div className="text-xs text-muted-foreground">
        {from}–{to} sur <span className="font-medium text-foreground">{totalCount}</span>
        <span className="mx-1">·</span>
        page {page + 1}/{totalPages}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="table-page-size" className="whitespace-nowrap text-xs text-muted-foreground">
            Par page
          </Label>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              if (!v) return
              onPageSizeChange(Number.parseInt(v, 10))
            }}
          >
            <SelectTrigger id="table-page-size" className="h-8 w-[76px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page <= 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          Précédent
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        >
          Suivant
        </Button>
      </div>
    </div>
  )
}

type TablePaginationState = ReturnType<typeof useTablePagination<unknown>>

/** Renders pagination controls from `useTablePagination` — spread the hook result. */
export function TablePaginationBar({
  page,
  pageSize,
  totalCount,
  totalPages,
  enabled,
  setPage,
  setPageSize,
}: TablePaginationState) {
  return (
    <TablePagination
      page={page}
      pageSize={pageSize}
      totalCount={totalCount}
      totalPages={totalPages}
      enabled={enabled}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
    />
  )
}
