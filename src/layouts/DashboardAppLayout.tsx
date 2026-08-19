import { Outlet, useNavigate } from 'react-router-dom'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { DashboardFiltersProvider } from '@/contexts/DashboardFiltersContext'
import { useDashboardSectionNav } from '@/contexts/DashboardSectionNavContext'
import { DashboardSectionsShell } from '@/layouts/DashboardSectionsShell'
import { logout } from '@/services/session'

function DashboardChrome() {
  const navigate = useNavigate()
  const { openSection } = useDashboardSectionNav()

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden bg-background text-foreground">
      <DashboardSidebar
        onSelectItem={openSection}
        onLogout={async () => {
          await logout()
          navigate('/')
        }}
      />
      {/* overflow-auto: fallback scroll when zoom shrinks the viewport */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export function DashboardAppLayout() {
  return (
    <DashboardFiltersProvider>
      <DashboardSectionsShell>
        <DashboardChrome />
      </DashboardSectionsShell>
    </DashboardFiltersProvider>
  )
}
