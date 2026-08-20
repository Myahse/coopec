import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DashboardPageShell } from '@/layouts/DashboardPageShell'
import { DashboardSectionCard } from '@/layouts/DashboardSectionCard'

type AidePageShellProps = {
  title: string
  children: ReactNode
}

export function AidePageShell({ title, children }: AidePageShellProps) {
  const navigate = useNavigate()

  return (
    <DashboardPageShell
      title={title}
      section="Aide"
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
      <div className="flex flex-col items-center gap-4">
        
        <DashboardSectionCard
          title="Liens"
          className="mx-auto w-full max-w-5xl [&_[data-slot=card-header]]:text-center"
          contentClassName="flex flex-col items-center"
        >
          {children}
        </DashboardSectionCard>
      </div>
    </DashboardPageShell>
  )
}
