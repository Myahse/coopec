import * as React from 'react'
import { cn } from '@/lib/utils'

type AccordionType = 'single' | 'multiple'

type AccordionContextValue = {
  type: AccordionType
  collapsible: boolean
  openValues: Set<string>
  toggle: (value: string) => void
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)

export function Accordion({
  type = 'single',
  collapsible = true,
  defaultValue,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  type?: AccordionType
  collapsible?: boolean
  defaultValue?: string | string[]
}) {
  const [openValues, setOpenValues] = React.useState<Set<string>>(() => {
    if (defaultValue == null) return new Set()
    const values = Array.isArray(defaultValue) ? defaultValue : [defaultValue]
    return new Set(values)
  })

  const toggle = React.useCallback(
    (value: string) => {
      setOpenValues((prev) => {
        const next = new Set(prev)
        const isOpen = next.has(value)

        if (type === 'single') {
          if (isOpen) {
            if (collapsible) next.delete(value)
          } else {
            next.clear()
            next.add(value)
          }
          return next
        }

        // multiple
        if (isOpen) next.delete(value)
        else next.add(value)
        return next
      })
    },
    [type, collapsible],
  )

  const ctx = React.useMemo<AccordionContextValue>(
    () => ({ type, collapsible, openValues, toggle }),
    [type, collapsible, openValues, toggle],
  )

  return (
    <AccordionContext.Provider value={ctx}>
      <div className={cn('w-full divide-y divide-border', className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

type AccordionItemContextValue = { value: string; isOpen: boolean }
const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null)

export function AccordionItem({
  value,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value: string
}) {
  const ctx = React.useContext(AccordionContext)
  if (!ctx) throw new Error('AccordionItem must be used within Accordion')

  const isOpen = ctx.openValues.has(value)

  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div
        className={cn('last:border-b-0', className)}
        data-state={isOpen ? 'open' : 'closed'}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
}

export function AccordionTrigger({
  className,
  children,
  showArrow = true,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  showArrow?: boolean
}) {
  const ctx = React.useContext(AccordionContext)
  const itemCtx = React.useContext(AccordionItemContext)
  if (!ctx || !itemCtx) throw new Error('AccordionTrigger must be used within AccordionItem')

  const { value, isOpen } = itemCtx

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
      aria-expanded={isOpen}
      onClick={() => ctx.toggle(value)}
      {...props}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {showArrow && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      )}
    </button>
  )
}

export function AccordionContent({
  className,
  children,
  keepRendered = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  keepRendered?: boolean
}) {
  const itemCtx = React.useContext(AccordionItemContext)
  if (!itemCtx) throw new Error('AccordionContent must be used within AccordionItem')

  const isOpen = itemCtx.isOpen
  if (!keepRendered && !isOpen) return null

  return (
    <div
      className={cn('px-4 pb-4 text-sm text-muted-foreground', !isOpen && 'hidden', className)}
      {...props}
    >
      {children}
    </div>
  )
}

