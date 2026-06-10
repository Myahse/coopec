import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** Few options → radios; more → dropdown. */
export const FILTER_CHOICE_RADIO_MAX = 4

export type FilterChoiceOption<T extends string = string> = {
  value: T
  label: string
}

type FilterChoiceFieldProps<T extends string = string> = {
  label?: string
  name: string
  value: T
  onValueChange: (value: T) => void
  options: FilterChoiceOption<T>[]
  disabled?: boolean
  placeholder?: string
  triggerClassName?: string
  labelClassName?: string
  /** `auto`: radio if ≤4 options, else select */
  variant?: 'radio' | 'select' | 'auto'
  className?: string
}

export function FilterChoiceField<T extends string = string>({
  label,
  name,
  value,
  onValueChange,
  options,
  disabled = false,
  placeholder,
  triggerClassName,
  labelClassName = 'text-[10px] text-muted-foreground',
  variant = 'auto',
  className,
}: FilterChoiceFieldProps<T>) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''
  const useRadio =
    variant === 'radio' || (variant === 'auto' && options.length > 0 && options.length <= FILTER_CHOICE_RADIO_MAX)

  if (useRadio) {
    return (
      <div className={cn('grid gap-1', className)}>
        {label ? <Label className={labelClassName}>{label}</Label> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-1.5 text-xs',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              )}
            >
              <input
                type="radio"
                name={name}
                checked={value === opt.value}
                onChange={() => onValueChange(opt.value)}
                disabled={disabled}
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-1', className)}>
      {label ? <Label className={labelClassName}>{label}</Label> : null}
      <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled || !options.length}>
        <SelectTrigger className={triggerClassName ?? 'h-8 w-[220px] text-xs'}>
          <SelectValue placeholder={placeholder ?? label ?? 'Choisir'}>
            {selectedLabel || placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.length ? (
            options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">Aucune option disponible</div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
