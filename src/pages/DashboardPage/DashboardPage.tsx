import { useEffect, useMemo, useState, type ReactNode } from 'react'
import heroSlide1 from '../../assets/ChatGPT Image Apr 22, 2026, 09_10_19 AM.png'
import heroSlide2 from '../../assets/Gemini_Generated_Image_ch8q8tch8q8tch8q.png'
import heroSlide3 from '../../assets/ChatGPT Image Apr 21, 2026, 07_03_26 PM.png'
import { DashboardAdminInfoCard } from '@/components/DashboardAdminInfoCard'
import { enrichDashboardSidebarUser, getDashboardSidebarUser } from '@/utils/dashboard-sidebar-user'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { getStoredAuth } from '@/utils/auth-session'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  CreditCard,
  HandCoins,
  Receipt,
  Users,
  UsersRound,
  UserX,
  XCircle,
} from 'lucide-react'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import { listCollecteursParAgence } from '@/services/collecteur'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import type { CollecteurSelectOption } from '@/utils/collecteur-select-options'
import { collecteurLabelForCode, mapCollecteurSelectOptions } from '@/utils/collecteur-select-options'
import {
  loadDashboardTileSnapshot,
  type DashboardTileSnapshot,
  type DashboardTileErrors,
} from '@/services/dashboard-tiles'

function emptySnapshot(): DashboardTileSnapshot {
  return {
    collecteursEnLigne: null,
    montantsCollectes: null,
    nombreOperations: null,
    chargesEpargne: null,
    nombreCartesVendues: null,
    operationsAnnulees: null,
    montantsVerses: null,
    collecteursAyantCollecte: null,
    collecteursTotal: null,
    clientsInactifs: null,
  }
}

type DashboardCardItem =
  | { kind: 'simple'; id: string; label: string; value: string; Icon: LucideIcon }
  | {
      kind: 'collecteurs-ayant-total'
      id: 'collecteurs-ayant-total'
      label: string
      Icon: LucideIcon
      ayant: string
      total: string
      pulse: boolean
    }

function buildDashboardCards(
  s: DashboardTileSnapshot,
  loading: boolean,
  opts?: { collecteurSelected?: boolean },
): DashboardCardItem[] {
  const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
  const fmt = (n: number | null) => {
    if (n === null || !Number.isFinite(n)) return '—'
    return nf.format(n)
  }

  const isCollecteurScoped = Boolean(opts?.collecteurSelected)

  return [
    { kind: 'simple', id: 'en-ligne', label: 'Collecteurs en ligne', value: fmt(s.collecteursEnLigne), Icon: Users },
    { kind: 'simple', id: 'montants', label: 'Montants collectés', value: fmt(s.montantsCollectes), Icon: BadgeCheck },
    { kind: 'simple', id: 'operations', label: "Nombre d'opérations effectuées", value: fmt(s.nombreOperations), Icon: Receipt },
    { kind: 'simple', id: 'charges', label: "Charges d'épargne", value: fmt(s.chargesEpargne), Icon: HandCoins },
    { kind: 'simple', id: 'cartes', label: 'Nombre de cartes vendues', value: fmt(s.nombreCartesVendues), Icon: CreditCard },
    { kind: 'simple', id: 'annulees', label: 'Opérations annulées', value: fmt(s.operationsAnnulees), Icon: XCircle },
    { kind: 'simple', id: 'verses', label: 'Montants versés', value: fmt(s.montantsVerses), Icon: BadgeCheck },
    {
      kind: 'collecteurs-ayant-total',
      id: 'collecteurs-ayant-total',
      label: 'Collecteurs',
      Icon: UsersRound,
      // When scoped to a single collecteur, the "total collecteurs" KPI should be 1.
      // The backend may still return global totals; we force the UI to match the selected scope.
      ayant: isCollecteurScoped ? '1' : fmt(s.collecteursAyantCollecte),
      total: isCollecteurScoped ? '1' : fmt(s.collecteursTotal),
      pulse: loading,
    },
  ]
}

function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      className={[
        'inline-block h-6 w-6 rounded-full border-2 border-muted-foreground/35 border-t-transparent align-middle',
        'animate-spin',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Chargement"
      role="status"
    />
  )
}

function renderCollecteursAyantTotalBlock(
  card: Extract<DashboardCardItem, { kind: 'collecteurs-ayant-total' }>,
  size: 'dashboard' | 'modal',
): ReactNode {
  const isDash = size === 'dashboard'
  const valueClass = isDash
    ? 'text-lg font-semibold tabular-nums text-foreground sm:text-xl'
    : 'text-base font-semibold tabular-nums text-foreground sm:text-lg'
  const labelClass = isDash
    ? 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground'
    : 'text-[10px] font-medium text-muted-foreground'

  return (
    <div
      className={[
        isDash
          ? 'mt-auto rounded-xl border border-border bg-background px-2 py-2.5 text-center'
          : 'mt-0 rounded-lg border border-border/60 bg-background/50 px-2 py-2',
        card.pulse ? 'text-muted-foreground animate-pulse' : '',
      ].join(' ')}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/30 px-1.5 py-1.5">
          <div className={labelClass}>Ayant collecté</div>
          <div className={valueClass}>{card.pulse ? <InlineSpinner className="h-5 w-5" /> : card.ayant}</div>
        </div>
        <div className="rounded-lg bg-muted/30 px-1.5 py-1.5">
          <div className={labelClass}>Total</div>
          <div className={valueClass}>{card.pulse ? <InlineSpinner className="h-5 w-5" /> : card.total}</div>
        </div>
      </div>
    </div>
  )
}

function formatTileCount(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}

function ClientsCountBannerCard({
  label,
  count,
  loading,
  error,
  Icon,
}: {
  label: string
  count: number | null
  loading: boolean
  error?: string
  Icon: LucideIcon
}) {
  return (
    <div
      className="shrink-0 rounded-2xl bg-card/90 px-3.5 py-2.5 text-card-foreground shadow-sm ring-1 ring-border backdrop-blur-md"
      title={error}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div
            className={[
              'text-2xl font-semibold tabular-nums leading-tight text-foreground',
            ].join(' ')}
          >
            {loading ? <InlineSpinner /> : formatTileCount(count)}
          </div>
        </div>
      </div>
      {error ? <p className="mt-1 max-w-[10rem] truncate text-[10px] text-destructive">{error}</p> : null}
    </div>
  )
}

export function DashboardPage() {
  const f = useDashboardFilters()
  const adminUser = useMemo(() => {
    const base = getDashboardSidebarUser()
    const authUser = getStoredAuth()?.user as Record<string, unknown> | undefined
    return enrichDashboardSidebarUser(
      base,
      {
        agenceOptions: f.agences,
        agencesRows: f.agencesAllRows,
        directionChoices: f.directionChoicesAll,
      },
      getConnectedUserCodeAgence() || undefined,
      authUser,
    )
  }, [f.agences, f.agencesAllRows, f.directionChoicesAll])

  const [heroSlideIndex, setHeroSlideIndex] = useState(0)
  const [tileSnapshot, setTileSnapshot] = useState<DashboardTileSnapshot>(() => emptySnapshot())
  const [tilesLoading, setTilesLoading] = useState(false)
  const [tileErrors, setTileErrors] = useState<DashboardTileErrors>({})
  const [collecteurSelected, setCollecteurSelected] = useState('Tous')
  const [collecteursOptions, setCollecteursOptions] = useState<CollecteurSelectOption[]>([])
  const [isCollecteursLoading, setIsCollecteursLoading] = useState(false)
  const [collecteursError, setCollecteursError] = useState<string | null>(null)

  const collecteurSelectedLabel = useMemo(() => {
    if (!collecteurSelected) return ''
    if (collecteurSelected === 'Tous') return 'Tous'
    return collecteurLabelForCode(collecteurSelected, collecteursOptions)
  }, [collecteurSelected, collecteursOptions])

  const heroSlides = useMemo(() => [heroSlide1, heroSlide2, heroSlide3], [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setHeroSlideIndex((i) => (i + 1) % heroSlides.length)
    }, 6000)
    return () => window.clearInterval(id)
  }, [heroSlides.length])

  useEffect(() => {
    let cancelled = false
    setTilesLoading(true)
    setTileErrors({})
    ;(async () => {
      const { snapshot, errors } = await loadDashboardTileSnapshot({
        direction: f.direction,
        agence: f.agency,
        institution: f.institution,
      })
      if (!cancelled) {
        setTileSnapshot(snapshot)
        setTileErrors(errors)
      }
      if (!cancelled) setTilesLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [f.direction, f.agency, f.institution])

  useEffect(() => {
    // Filters changed: keep UI consistent, but do not auto-load.
    setCollecteursOptions([])
    setCollecteursError(null)
    setIsCollecteursLoading(false)
    setCollecteurSelected('Tous')

    return () => {
      // noop
    }
  }, [f.agences, f.agency, f.direction])

  async function handleChargerCollecteurs() {
    const agencyCodes =
      f.agency !== 'Toutes'
        ? [f.agency.trim()].filter(Boolean)
        : f.direction !== 'Toutes'
          ? f.agences.map((a) => a.value).filter(Boolean)
          : []

    if (!agencyCodes.length) {
      setCollecteursOptions([])
      setCollecteursError('Sélectionnez une direction ou une agence.')
      setCollecteurSelected('Tous')
      return
    }

    setIsCollecteursLoading(true)
    setCollecteursError(null)
    try {
      const results = await Promise.allSettled(
        agencyCodes.map(async (code) => extractListFromApiEnvelope(await listCollecteursParAgence(code))),
      )

      const rows = results
        .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
        .filter((x) => x && typeof x === 'object')

      setCollecteursOptions(mapCollecteurSelectOptions(rows))
      setCollecteurSelected('Tous')
    } catch (err) {
      setCollecteursOptions([])
      setCollecteursError(err instanceof Error ? err.message : 'Impossible de charger les collecteurs')
      setCollecteurSelected('Tous')
    } finally {
      setIsCollecteursLoading(false)
    }
  }

  async function handleAfficher() {
    setTilesLoading(true)
    setTileErrors({})
    try {
      const { snapshot, errors } = await loadDashboardTileSnapshot({
        direction: f.direction,
        agence: f.agency,
        institution: f.institution,
        collecteur: collecteurSelected !== 'Tous' ? collecteurSelected : undefined,
      })
      setTileSnapshot(snapshot)
      setTileErrors(errors)
    } finally {
      setTilesLoading(false)
    }
  }

  const dashboardCards = useMemo(
    () =>
      buildDashboardCards(tileSnapshot, tilesLoading, {
        collecteurSelected: collecteurSelected !== 'Tous',
      }),
    [tileSnapshot, tilesLoading, collecteurSelected],
  )

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      {/* Hero section (top part of the screen) */}
      <header className="relative h-[58vh] min-h-[320px] w-full shrink-0 overflow-hidden bg-muted sm:h-[54vh] md:h-[50vh] lg:h-[46vh]">
        <div
          className="absolute inset-0 flex h-full w-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${heroSlideIndex * 100}%)` }}
        >
          {heroSlides.map((src) => (
            <div key={src} className="h-full w-full shrink-0">
              <img src={src} alt="Hero" className="h-full w-full object-cover object-left-top" />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-background/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/35 to-transparent" />
        <div className="relative z-10 flex h-full flex-wrap items-end justify-between gap-3 px-4 pb-5 sm:px-6 lg:px-8">
          <DashboardAdminInfoCard user={adminUser} className="sm:min-w-[18rem] sm:max-w-md" />
          <ClientsCountBannerCard
            label="Clients inactifs"
            count={tileSnapshot.clientsInactifs}
            loading={tilesLoading}
            error={
              !tilesLoading && tileSnapshot.clientsInactifs == null ? tileErrors.dashboard : undefined
            }
            Icon={UserX}
          />
          <div className="min-w-0 max-w-xl rounded-2xl bg-card/90 px-4 py-3 text-card-foreground shadow-sm ring-1 ring-border backdrop-blur-md sm:ml-auto">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bienvenue</div>
            <div className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              Bienvenue sur votre dashboard COOPEC
            </div>
          </div>
        </div>

      </header>

      {/* Content */}
      <main className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="sticky top-0 z-30 border-b border-border bg-background/85 px-4 py-1.5 backdrop-blur sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <Label className="text-xs text-muted-foreground">Institution</Label>
              <Button
                type="button"
                variant="outline"
                className="mt-1 w-full justify-between gap-2 h-9"
                disabled={f.isInstitutionsLoading || f.institutionLocked}
                onClick={() => f.openFiltersDrawer('institution')}
              >
                <span className="min-w-0 flex-1 truncate text-left">{f.selectedInstitutionLabel || 'Choisir'}</span>
                <span className="shrink-0 text-muted-foreground">▼</span>
              </Button>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <Button
                type="button"
                variant="outline"
                className="mt-1 w-full justify-between gap-2 h-9"
                disabled={f.isInstitutionsLoading}
                onClick={() => f.openFiltersDrawer('direction')}
              >
                <span className="min-w-0 flex-1 truncate text-left">{f.selectedDirectionLabel || 'Choisir'}</span>
                <span className="shrink-0 text-muted-foreground">▼</span>
              </Button>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Agence</Label>
              <Button
                type="button"
                variant="outline"
                className="mt-1 w-full justify-between gap-2 h-9"
                disabled={f.direction !== 'Toutes' && f.isAgencesByDirectionLoading}
                onClick={() => f.openFiltersDrawer('agency')}
              >
                <span className="min-w-0 flex-1 truncate text-left">{f.selectedAgencyLabel || 'Choisir'}</span>
                <span className="shrink-0 text-muted-foreground">▼</span>
              </Button>
            </div>
          </div>
        </div>

        <section className="px-4 pt-1.5 sm:px-6 lg:px-8">
          <div className="mb-3 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button
              type="button"
              onClick={() => void handleChargerCollecteurs()}
              disabled={isCollecteursLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isCollecteursLoading ? 'Chargement…' : 'Charger la liste des collecteurs'}
            </Button>

            <div className="w-full max-w-md sm:max-w-none sm:w-96">
              <Select
                value={collecteurSelected}
                onValueChange={(v) => {
                  if (v == null || v === '') return
                  setCollecteurSelected(v)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      isCollecteursLoading
                        ? 'Chargement des collecteurs…'
                        : collecteursError
                          ? 'Collecteurs indisponibles'
                          : 'Choisir un collecteur'
                    }
                  >
                    {collecteurSelectedLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false} className="max-h-72 min-w-[280px]">
                  <SelectItem value="Tous">Tous</SelectItem>
                  {collecteursOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} title={`${o.label} (${o.value})`}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate">{o.label}</span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">{o.value}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {collecteursError ? (
                <div className="mt-1 text-[11px] text-destructive">{collecteursError}</div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleAfficher()}
              disabled={tilesLoading}
            >
              Afficher
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardCards.map((card) => {
              const Icon = card.Icon
              return (
              <Card key={card.id} className="h-full rounded-2xl">
                <CardContent className="flex h-full min-h-[128px] flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-snug [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
                        {card.label}
                      </div>
                    </div>
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground ring-1 ring-border">
                      <Icon className="size-6" aria-hidden="true" />
                    </div>
                  </div>

                  {card.kind === 'simple' ? (
                    <div
                      className={[
                        'mt-auto rounded-xl border border-border bg-background px-3 py-2 text-center',
                        'font-semibold tracking-tight text-foreground',
                        'text-2xl sm:text-2xl',
                        'truncate',
                      ].join(' ')}
                      title={tilesLoading ? undefined : card.value}
                    >
                      {tilesLoading ? <InlineSpinner /> : card.value}
                    </div>
                  ) : (
                    renderCollecteursAyantTotalBlock(card, 'dashboard')
                  )}
                </CardContent>
              </Card>
              )
            })}
          </div>

          {tileErrors.dashboard ? (
            <div className="mt-3 text-xs text-destructive">{tileErrors.dashboard}</div>
          ) : null}
        </section>

        <div className="h-8" />
      </main>
      </div>

      {/* no modal: Afficher refreshes KPI stats */}
    </>
  )
}

