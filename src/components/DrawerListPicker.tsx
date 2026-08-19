type DrawerListPickerProps = {
  items: { value: string; label: string }[]
  selectedValue: string
  onSelect: (value: string) => void
  emptyLabel: string
}

export function DrawerListPicker({ items, selectedValue, onSelect, emptyLabel }: DrawerListPickerProps) {
  if (!items.length) {
    return <div className="text-sm text-muted-foreground">{emptyLabel}</div>
  }

  return (
    <div className="grid gap-2">
      <div className="text-xs text-muted-foreground">
        {items.length} élément{items.length > 1 ? 's' : ''}
      </div>
      <div className="max-h-[240px] overflow-auto rounded-lg border border-border">
        {items.map((it) => {
          const isActive = it.value === selectedValue
          return (
            <button
              key={it.value}
              type="button"
              className={[
                'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                'border-b border-border last:border-b-0',
                isActive ? 'bg-primary/10' : 'bg-background',
              ].join(' ')}
              onClick={() => onSelect(it.value)}
            >
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {isActive ? <span className="shrink-0 text-xs text-primary">Sélectionné</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
