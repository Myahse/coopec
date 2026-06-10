import { useCallback, useMemo, useRef, useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CourbeCollectChartBlock } from '@/components/CourbeCollectChartBlock'
import { exportCourbeCollectChartsPdf } from '@/utils/chart-export'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import { getCourbeCollect, type CourbeCollectPoint } from '@/services/courbe-collect'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function yearStartIso(): string {
  const y = new Date().getFullYear()
  return `${y}-01-01`
}

type Props = {
  className?: string
  variant?: 'page' | 'embedded'
}

function sumCollecte(points: CourbeCollectPoint[]): number {
  return points.reduce((acc, p) => acc + p.montantCollecte, 0)
}

function sumCommission(points: CourbeCollectPoint[]): number {
  return points.reduce((acc, p) => acc + p.commission, 0)
}

function formatTotal(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}

function TotalsBadge({ points }: { points: CourbeCollectPoint[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
      <span>
        Collecté <span className="font-semibold text-[var(--chart-1)]">{formatTotal(sumCollecte(points))}</span>
      </span>
      <span>
        Commissions <span className="font-semibold text-[var(--chart-2)]">{formatTotal(sumCommission(points))}</span>
      </span>
    </div>
  )
}

export function CourbeCollectPanel({ className, variant = 'embedded' }: Props) {
  const isPage = variant === 'page'
  const f = useDashboardFilters()
  const [dateDebut, setDateDebut] = useState(yearStartIso)
  const [dateFin, setDateFin] = useState(todayIso)
  const [collecteJour, setCollecteJour] = useState<CourbeCollectPoint[]>([])
  const [collecteAnnee, setCollecteAnnee] = useState<CourbeCollectPoint[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const jourChartRef = useRef<HTMLDivElement | null>(null)
  const anneeChartRef = useRef<HTMLDivElement | null>(null)

  const agenceCode = useMemo(() => (f.agency !== 'Toutes' ? f.agency.trim() : ''), [f.agency])

  const agencyCodesForDirection = useMemo(
    () => (f.agency === 'Toutes' ? f.agences.map((a) => a.value).filter(Boolean) : []),
    [f.agency, f.agences],
  )

  const filterSummary = useMemo(() => {
    const parts: string[] = []
    if (f.institution !== 'Toutes') parts.push(`Institution : ${f.selectedInstitutionLabel}`)
    if (f.direction !== 'Toutes') parts.push(`Direction : ${f.selectedDirectionLabel}`)
    if (f.agency !== 'Toutes') parts.push(`Agence : ${f.selectedAgencyLabel}`)
    else if (agencyCodesForDirection.length)
      parts.push(`${agencyCodesForDirection.length} agence(s) de la direction`)
    else parts.push('Agence : session utilisateur')
    return parts.join(' · ')
  }, [
    f.institution,
    f.direction,
    f.agency,
    f.selectedInstitutionLabel,
    f.selectedDirectionLabel,
    f.selectedAgencyLabel,
    agencyCodesForDirection.length,
  ])

  const emptyHint = 'Choisissez la période puis cliquez sur EXECUTER.'

  const periodLabel = useMemo(
    () => `Période du ${dateDebut} au ${dateFin}`,
    [dateDebut, dateFin],
  )

  const exportAllPdf = useCallback(async () => {
    if (!hasLoaded || (!collecteJour.length && !collecteAnnee.length)) return
    setIsExportingPdf(true)
    try {
      await exportCourbeCollectChartsPdf({
        filenameBase: 'courbe_collect',
        filterSummary,
        periodLabel,
        charts: [
          { title: 'Collecte jour', container: jourChartRef.current },
          { title: 'Collecte sur l’année', container: anneeChartRef.current },
        ],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export PDF impossible')
    } finally {
      setIsExportingPdf(false)
    }
  }, [hasLoaded, collecteJour.length, collecteAnnee.length, filterSummary, periodLabel])

  const loadCourbe = useCallback(async () => {
    if (dateDebut > dateFin) {
      setError('La date de début doit être antérieure à la date de fin.')
      setCollecteJour([])
      setCollecteAnnee([])
      setHasLoaded(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await getCourbeCollect({
        dateDebut,
        dateFin,
        agence: agenceCode || undefined,
        agencyCodes: agencyCodesForDirection.length ? agencyCodesForDirection : undefined,
        direction: f.direction !== 'Toutes' ? f.direction : undefined,
        institution: f.institution !== 'Toutes' ? f.institution : undefined,
      })
      setCollecteJour(data.collecteJour)
      setCollecteAnnee(data.collecteAnnee)
      setHasLoaded(true)
    } catch (err) {
      setCollecteJour([])
      setCollecteAnnee([])
      setHasLoaded(false)
      setError(err instanceof Error ? err.message : 'Impossible de charger les courbes')
    } finally {
      setIsLoading(false)
    }
  }, [agenceCode, agencyCodesForDirection, dateDebut, dateFin, f.direction, f.institution])

  return (
    <div className={className}>
      <div
        className={[
          isPage ? 'rounded-xl border border-border bg-card p-4 shadow-sm' : 'rounded-xl border border-border bg-card p-3 shadow-sm',
        ].join(' ')}
      >
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="grid gap-0.5">
            <Label className="text-[10px] text-muted-foreground">Du</Label>
            <Input
              type="date"
              className="h-8 w-[140px] text-xs"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>
          <div className="grid gap-0.5">
            <Label className="text-[10px] text-muted-foreground">Au</Label>
            <Input
              type="date"
              className="h-8 w-[140px] text-xs"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-8 min-w-[110px] border-primary text-primary hover:bg-primary/10"
            disabled={isLoading}
            onClick={() => void loadCourbe()}
          >
            {isLoading ? 'Chargement…' : 'EXECUTER'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 gap-1.5 border-primary/60 text-primary"
            disabled={isLoading || isExportingPdf || !hasLoaded || (!collecteJour.length && !collecteAnnee.length)}
            onClick={() => void exportAllPdf()}
          >
            <FileDown className="size-3.5" aria-hidden />
            {isExportingPdf ? 'Export…' : 'PDF (2 graphiques)'}
          </Button>
        </div>

        {error ? <p className="mb-3 text-xs text-destructive">{error}</p> : null}

        <p className="mb-3 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
          Filtres actifs — {filterSummary}
        </p>

        <div className={isLoading ? 'space-y-6 animate-pulse opacity-60' : 'space-y-6'}>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">Collecte jour</h3>
              {hasLoaded && !isLoading ? <TotalsBadge points={collecteJour} /> : null}
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Montant collecté et commissions, jour par jour (Du → Au).
            </p>
            <CourbeCollectChartBlock
              title="Collecte jour"
              points={collecteJour}
              tall={isPage}
              scale="jour"
              emptyHint={!hasLoaded && !isLoading ? emptyHint : undefined}
              exportFilenameBase="courbe_collect_jour"
              filterSummary={filterSummary}
              periodLabel={periodLabel}
              chartContainerRef={jourChartRef}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
                Collecte sur l&apos;année
              </h3>
              {hasLoaded && !isLoading ? <TotalsBadge points={collecteAnnee} /> : null}
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Montant collecté et commissions agrégés par mois sur la ou les années de la période.
            </p>
            <CourbeCollectChartBlock
              title="Collecte sur l'année"
              points={collecteAnnee}
              tall={isPage}
              scale="annee"
              emptyHint={!hasLoaded && !isLoading ? emptyHint : undefined}
              exportFilenameBase="courbe_collect_annee"
              filterSummary={filterSummary}
              periodLabel={periodLabel}
              chartContainerRef={anneeChartRef}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
