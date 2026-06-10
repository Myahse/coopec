import { CourbeCollectPanel } from '@/components/CourbeCollectPanel'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'

export function CourbeCollectPage() {
  return (
    <DashboardTablePageLayout
      title="Courbe collect"
      cardTitle="Graphiques"
      cardDescription="Collecte jour et collecte sur l'année : chaque graphique affiche le montant collecté et les commissions."
    >
      <CourbeCollectPanel variant="page" />
    </DashboardTablePageLayout>
  )
}
