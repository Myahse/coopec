import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type SortableThProps = {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onSort: () => void
  className?: string
  align?: 'left' | 'right'
}

export function SortableTh({ label, active, dir, onSort, className, align = 'left' }: SortableThProps) {
  return (
    <th className={cn(align === 'right' && 'text-right', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex w-full items-center gap-1 font-medium hover:opacity-90',
          align === 'right' ? 'justify-end' : 'text-left',
        )}
        onClick={onSort}
      >
        <span>{label}</span>
        {!active ? (
          <ArrowUpDown className="size-3 shrink-0 opacity-50" aria-hidden />
        ) : dir === 'asc' ? (
          <ArrowUp className="size-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDown className="size-3 shrink-0" aria-hidden />
        )}
      </button>
    </th>
  )
}
