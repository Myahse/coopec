import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DashboardPageShell } from '@/layouts/DashboardPageShell'
import { DashboardSectionCard } from '@/layouts/DashboardSectionCard'

export function DashboardPlaceholderPage() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <DashboardPageShell
      title="Page"
      headerActions={
        <>
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
            Retour dashboard
          </Button>
          <Button type="button" onClick={() => navigate(-1)}>
            Retour
          </Button>
        </>
      }
    >
      <DashboardSectionCard title="À venir" className="mx-auto w-full max-w-3xl">
        <div className="text-sm text-muted-foreground">
          <div className="break-all">
            <span className="text-foreground/80">Chemin:</span> {location.pathname}
          </div>
        </div>
      </DashboardSectionCard>
    </DashboardPageShell>
  )
}
