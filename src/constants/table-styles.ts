/** Green table header — aligned with Gestion des abonnements */
export const TABLE_THEAD_CLASS = 'bg-primary text-primary-foreground'

export function tableTheadClass(options?: { sticky?: boolean }): string {
  if (options?.sticky) {
    return `sticky top-0 z-10 ${TABLE_THEAD_CLASS} backdrop-blur-sm`
  }
  return TABLE_THEAD_CLASS
}

/** Standard table shell used on Abonnements, Collecteurs, Clients, etc. */
export const TABLE_WRAPPER_CLASS = 'overflow-x-auto rounded-xl ring-1 ring-border'

/** Scrollable variant for full-height dashboard sub-pages */
export const TABLE_WRAPPER_SCROLL_CLASS = 'overflow-auto rounded-xl ring-1 ring-border'

/** Table area inside a flex page — grows and scrolls vertically */
export const TABLE_SCROLL_AREA_CLASS = `min-h-0 min-w-0 flex-1 ${TABLE_WRAPPER_SCROLL_CLASS}`

/** Full-viewport dashboard page shell (table + filters) */
export const DASHBOARD_TABLE_PAGE_CLASS =
  'flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground'

export const DASHBOARD_TABLE_PAGE_HEADER_CLASS = 'shrink-0 px-4 pb-2 pt-4 lg:px-6'

/** Small section label above main page title (e.g. « Dashboard »). */
export const DASHBOARD_PAGE_SECTION_CLASS =
  'text-xs font-medium uppercase tracking-wide text-muted-foreground'

/** Main page title — same style as Gestion des utilisateurs. */
export const DASHBOARD_PAGE_TITLE_CLASS =
  'truncate text-2xl font-semibold tracking-tight text-foreground'

export const DASHBOARD_TABLE_PAGE_BODY_CLASS =
  'flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 lg:px-6'

/** `border-collapse` enables global vertical column separators (see index.css). */
export const TABLE_CLASS = 'w-full border-collapse text-xs'

export const TABLE_HEAD_ROW_CLASS =
  '[&>th]:px-2 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-medium [&>th]:text-xs'

/** Second header row with per-column filters — kept compact to save vertical space. */
export const TABLE_HEAD_FILTER_ROW_CLASS =
  'bg-primary/90 [&>th]:min-w-0 [&>th]:max-w-[9rem] [&>th]:px-1 [&>th]:py-0.5 [&>th]:align-top'

export const TABLE_COLUMN_FILTER_WRAP_CLASS = 'relative min-w-0 w-full max-w-[8.5rem]'

export const TABLE_COLUMN_FILTER_INPUT_CLASS =
  'h-5 min-h-0 w-full min-w-0 border-primary-foreground/25 bg-primary/15 px-1 pl-5 text-[10px] leading-none text-primary-foreground shadow-none placeholder:text-primary-foreground/45'

export const TABLE_COLUMN_FILTER_NARROW_CLASS = 'max-w-[5rem] text-right'

export const TABLE_TBODY_CLASS = 'divide-y divide-border'

export const TABLE_ROW_CLASS = 'hover:bg-muted/30'

export const TABLE_ROW_SELECTABLE_CLASS = 'cursor-pointer hover:bg-muted/30'

export const TABLE_ROW_ACTIVE_CLASS = 'bg-primary/10 hover:bg-primary/15'

export const TABLE_TD_CLASS = 'px-2 py-2'

export const TABLE_TD_MONO_CLASS = 'px-2 py-2 font-mono text-[11px]'

export const TABLE_EMPTY_CELL_CLASS = 'px-3 py-10 text-center text-sm text-muted-foreground'
