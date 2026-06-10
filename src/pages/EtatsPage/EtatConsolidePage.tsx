import { useCallback, useMemo, useState } from 'react'
import { LineChart } from 'lucide-react'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import { fetchEtatConsolideReport } from '@/services/etat-consolide'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'

function defaultDateDebut(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function endOfMonthIso(): string {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

export function EtatConsolidePage() {
  const f = useDashboardFilters()

  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(endOfMonthIso)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [reportUrl, setReportUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scope = useMemo(() => {
    const sessionAgence = getConnectedUserCodeAgence()
    const directionApi = f.direction !== 'Toutes' ? f.direction.trim() : undefined
    const institutionApi = f.institution !== 'Toutes' ? f.institution.trim() : undefined
    const codeAgence =
      f.agency !== 'Toutes' ? f.agency.trim() : sessionAgence || undefined
    return { codeAgence, direction: directionApi, institution: institutionApi }
  }, [f.agency, f.direction, f.institution])

  const loadReport = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setHtmlContent(null)
    setReportUrl(null)
    try {
      const result = await fetchEtatConsolideReport({
        dateDebut,
        dateFin,
        codeAgence: scope.codeAgence,
        direction: scope.direction,
        institution: scope.institution,
        format: 'html',
      })
      if (result.html) {
        setHtmlContent(result.html)
        return
      }
      if (result.url) {
        setReportUrl(result.url)
        window.open(result.url, '_blank', 'noopener,noreferrer')
        return
      }
      setError('Aucun rapport HTML disponible pour cette période.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’afficher le lien consolidé')
    } finally {
      setIsLoading(false)
    }
  }, [dateDebut, dateFin, scope.codeAgence, scope.direction, scope.institution])

  return (
    <DashboardTablePageLayout
      title="État consolidé"
      cardTitle="Rapport consolidé"
      cardDescription="Sélectionnez la période puis affichez le rapport HTML."
      alerts={
        error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <LineChart className="size-8 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-xs text-muted-foreground">Période du</span>
            <Input
              type="date"
              className="h-8 w-[140px] text-xs"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">au</span>
            <Input
              type="date"
              className="h-8 w-[140px] text-xs"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="h-8 min-w-[160px] border-primary px-4 text-primary hover:bg-primary/10"
              disabled={isLoading}
              onClick={() => void loadReport()}
            >
              {isLoading ? 'Chargement…' : 'AFFICHER LE LIEN'}
            </Button>
          </div>
          <span className="text-sm font-medium text-primary">Html</span>
        </div>
      }
    >
      {htmlContent ? (
        <iframe
          title="État consolidé"
          className="min-h-[480px] w-full flex-1 rounded-md border border-border bg-white"
          srcDoc={htmlContent}
          sandbox="allow-same-origin"
        />
      ) : reportUrl ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          <p>Le rapport a été ouvert dans un nouvel onglet.</p>
          <a
            href={reportUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline hover:no-underline"
          >
            Rouvrir le lien HTML
          </a>
        </div>
      ) : (
        <div className="flex min-h-[200px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Choisissez la période puis cliquez sur AFFICHER LE LIEN.
        </div>
      )}
    </DashboardTablePageLayout>
  )
}
