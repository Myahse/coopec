import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  TABLE_COLUMN_FILTER_INPUT_CLASS,
  TABLE_COLUMN_FILTER_NARROW_CLASS,
  TABLE_COLUMN_FILTER_WRAP_CLASS,
} from '@/constants/table-styles'

type TableColumnFilterInputProps = {
  value: string
  onChange: (value: string) => void
  align?: 'left' | 'right'
  className?: string
  placeholder?: string
}

/** Compact per-column filter used in green table header rows. */
export function TableColumnFilterInput({
  value,
  onChange,
  align = 'left',
  className,
  placeholder = '…',
}: TableColumnFilterInputProps) {
  const narrow = align === 'right'

  return (
    <div
      className={cn(
        TABLE_COLUMN_FILTER_WRAP_CLASS,
        narrow && 'ml-auto',
        className,
      )}
    >
      <Search
        className="pointer-events-none absolute left-1 top-1/2 size-2.5 -translate-y-1/2 text-primary-foreground/55"
        aria-hidden
      />
      <Input
        className={cn(
          TABLE_COLUMN_FILTER_INPUT_CLASS,
          narrow && TABLE_COLUMN_FILTER_NARROW_CLASS,
        )}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filtrer la colonne"
      />
    </div>
  )
}
