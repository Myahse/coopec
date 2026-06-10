import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type UsersPaginationProps = {
  page: number
  pageSize: number
  rowsCount: number
  isLoading: boolean
  onPageChange: (updater: (p: number) => number) => void
  onPageSizeChange: (size: number) => void
}

export function UsersPagination({
  page,
  pageSize,
  rowsCount,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: UsersPaginationProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <div className="text-xs text-muted-foreground">
        Page <span className="font-medium text-foreground">{page + 1}</span>
        <span className="mx-1">·</span>
        {pageSize} par page
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="users-page-size" className="whitespace-nowrap text-xs text-muted-foreground">
            Taille
          </Label>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              if (!v) return
              onPageSizeChange(Number.parseInt(v, 10))
            }}
          >
            <SelectTrigger id="users-page-size" className="h-8 w-[76px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isLoading || page <= 0}
          onClick={() => onPageChange((p) => Math.max(0, p - 1))}
        >
          Précédent
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isLoading || rowsCount < pageSize}
          onClick={() => onPageChange((p) => p + 1)}
        >
          Suivant
        </Button>
      </div>
    </div>
  )
}
