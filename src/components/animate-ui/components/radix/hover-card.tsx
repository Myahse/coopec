import * as React from 'react'
import { cn } from '@/lib/utils'

type Side = 'top' | 'bottom' | 'left' | 'right'
type Align = 'start' | 'center' | 'end'

type HoverCardContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  followCursor: boolean | 'x' | 'y'
  cursor: { x: number; y: number } | null
  setCursor: (pos: { x: number; y: number } | null) => void
}

const HoverCardContext = React.createContext<HoverCardContextValue | null>(null)

export function HoverCard({
  children,
  followCursor = false,
}: {
  children: React.ReactNode
  followCursor?: boolean | 'x' | 'y'
}) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null)

  const value = React.useMemo<HoverCardContextValue>(
    () => ({ open, setOpen, triggerRef, followCursor, cursor, setCursor }),
    [open, followCursor, cursor],
  )

  return <HoverCardContext.Provider value={value}>{children}</HoverCardContext.Provider>
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (value: T) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(value)
      else (ref as any).current = value
    }
  }
}

export function HoverCardTrigger({
  asChild,
  children,
}: {
  asChild?: boolean
  children: React.ReactElement
}) {
  const ctx = React.useContext(HoverCardContext)
  if (!ctx) throw new Error('HoverCardTrigger must be used within HoverCard')

  const child = React.Children.only(children) as React.ReactElement<any>
  const childProps = (child.props ?? {}) as any
  const onMouseEnter = (e: React.MouseEvent) => {
    childProps?.onMouseEnter?.(e)
    ctx.setOpen(true)
  }
  const onMouseLeave = (e: React.MouseEvent) => {
    childProps?.onMouseLeave?.(e)
    ctx.setOpen(false)
    ctx.setCursor(null)
  }
  const onMouseMove = (e: React.MouseEvent) => {
    childProps?.onMouseMove?.(e)
    if (!ctx.followCursor) return
    ctx.setCursor({ x: e.clientX, y: e.clientY })
  }
  const onFocus = (e: React.FocusEvent) => {
    childProps?.onFocus?.(e)
    ctx.setOpen(true)
  }
  const onBlur = (e: React.FocusEvent) => {
    childProps?.onBlur?.(e)
    ctx.setOpen(false)
    ctx.setCursor(null)
  }

  const ref = mergeRefs((child as any).ref, (node: HTMLElement | null) => {
    ctx.triggerRef.current = node
  })

  if (asChild) {
    return React.cloneElement(child as any, {
      ref,
      onMouseEnter,
      onMouseLeave,
      onMouseMove,
      onFocus,
      onBlur,
    })
  }

  return (
    <span
      ref={ref as any}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      onFocus={onFocus as any}
      onBlur={onBlur as any}
      className="inline-flex"
    >
      {child}
    </span>
  )
}

export function HoverCardContent({
  side = 'top',
  sideOffset = 8,
  align = 'center',
  alignOffset = 0,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  side?: Side
  sideOffset?: number
  align?: Align
  alignOffset?: number
}) {
  const ctx = React.useContext(HoverCardContext)
  if (!ctx) throw new Error('HoverCardContent must be used within HoverCard')
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)

  React.useEffect(() => {
    if (!ctx.open) return

    // follow cursor positioning
    if (ctx.followCursor && ctx.cursor) {
      const pad = 12
      setPos({ top: ctx.cursor.y + pad, left: ctx.cursor.x + pad })
      return
    }

    const trigger = ctx.triggerRef.current
    const content = ref.current
    if (!trigger || !content) return

    const t = trigger.getBoundingClientRect()
    const c = content.getBoundingClientRect()

    let left = t.left
    let top = t.top

    // align axis based on side
    if (side === 'top' || side === 'bottom') {
      if (align === 'start') left = t.left + alignOffset
      if (align === 'center') left = t.left + t.width / 2 - c.width / 2 + alignOffset
      if (align === 'end') left = t.right - c.width + alignOffset

      top = side === 'top' ? t.top - c.height - sideOffset : t.bottom + sideOffset
    } else {
      if (align === 'start') top = t.top + alignOffset
      if (align === 'center') top = t.top + t.height / 2 - c.height / 2 + alignOffset
      if (align === 'end') top = t.bottom - c.height + alignOffset

      left = side === 'left' ? t.left - c.width - sideOffset : t.right + sideOffset
    }

    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    left = Math.min(Math.max(left, margin), vw - c.width - margin)
    top = Math.min(Math.max(top, margin), vh - c.height - margin)

    setPos({ top, left })
  }, [ctx.open, ctx.followCursor, ctx.cursor, side, sideOffset, align, alignOffset])

  if (!ctx.open) return null

  return (
    <div
      ref={ref}
      role="dialog"
      aria-hidden={!ctx.open}
      className={cn(
        'fixed z-50 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg',
        'animate-in fade-in-0 zoom-in-95',
        className,
      )}
      style={pos ? { top: pos.top, left: pos.left } : undefined}
      {...props}
    >
      {children}
    </div>
  )
}

