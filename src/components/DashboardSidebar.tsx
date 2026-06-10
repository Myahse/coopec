import { Link, useLocation, useNavigate } from 'react-router-dom'
import logo from '@/assets/logo-1-Photoroom.png'
import { Button } from '@/components/ui/button'
import { DASHBOARD_SECTIONS } from '@/constants/dashboard-sections'
export type DashboardSidebarItem = {
  label: string
  to: string
}

type DashboardSidebarProps = {
  onNavigate?: () => void
  onLogout?: () => void
  className?: string
  /** When set, section rows trigger this (e.g. open dashboard drawer) instead of only navigating. */
  onSelectItem?: (item: DashboardSidebarItem) => void
}

export const dashboardSidebarItems: DashboardSidebarItem[] = [...DASHBOARD_SECTIONS]

const DASHBOARD_HOME_PATH = '/dashboard'

function sectionRowClass(isActive: boolean): string {
  return [
    'block w-full rounded-none border-0 border-b px-3 py-2.5 text-left text-sm text-sidebar-foreground transition-colors',
    isActive
      ? 'border-b-sidebar-ring bg-white/15 font-semibold shadow-sm'
      : 'border-sidebar-border hover:border-b-sidebar-ring hover:bg-white/10',
  ].join(' ')
}

export function DashboardSidebar({ onNavigate, onLogout, className, onSelectItem }: DashboardSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const isDashboardHome = location.pathname === DASHBOARD_HOME_PATH

  function goToDashboardHome() {
    onNavigate?.()
    navigate(DASHBOARD_HOME_PATH)
  }

  return (
    <aside
      className={[
        'flex h-full min-h-0 w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex shrink-0 justify-center border-b border-sidebar-border bg-white px-3 py-5">
        <Link
          to={DASHBOARD_HOME_PATH}
          onClick={() => onNavigate?.()}
          className="inline-flex rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Retour au tableau de bord"
        >
          <img src={logo} alt="COOPEC" className="h-14 w-auto max-w-[220px] object-contain sm:h-16" />
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <nav className="w-full py-3">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/80">
            Sections
          </div>
          <ul className="w-full space-y-0">
            <li className="w-full">
              <button
                type="button"
                className={sectionRowClass(isDashboardHome)}
                onClick={goToDashboardHome}
              >
                Tableau de bord
              </button>
            </li>
            {dashboardSidebarItems.map((item) => {
              const isActive =
                item.to === DASHBOARD_HOME_PATH
                  ? false
                  : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)

              return (
                <li key={item.to} className="w-full">
                  <button
                    type="button"
                    className={sectionRowClass(isActive)}
                    onClick={() => {
                      onNavigate?.()
                      if (onSelectItem) {
                        onSelectItem(item)
                      } else {
                        navigate(item.to)
                      }
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {onLogout ? (
        <div className="border-t border-sidebar-border px-3 py-3">
          <Button
            type="button"
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="w-full border-white bg-white font-semibold text-primary shadow-sm hover:bg-white/90 hover:text-primary"
          >
            Déconnexion
          </Button>
        </div>
      ) : null}
    </aside>
  )
}
