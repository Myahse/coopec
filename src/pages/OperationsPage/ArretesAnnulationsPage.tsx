import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Search } from 'lucide-react'
import {
  DirectionAgenceFilterButton,
  DirectionAgenceFilterSheet,
} from '@/components/DirectionAgenceFilterSheet'
import { FilterChoiceField } from '@/components/FilterChoiceField'
import { TableExportButtons } from '@/components/TableExportButtons'
import { DashboardPageShell } from '@/layouts/DashboardPageShell'
import { DashboardSectionCard } from '@/layouts/DashboardSectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { listCollecteursParAgence, listCollecteursAvecSoldeParAgence } from '@/services/collecteur'
import { mapCollecteurSelectOptions } from '@/utils/collecteur-select-options'
import { useDirectionAgenceFilters } from '@/hooks/use-direction-agence-filters'
import { getClientCollecteur } from '@/services/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  extractArreteToValidList,
  faireArrete,
  getDetailsOperationNonArrete,
  getOperationsNonArreteAvecCompte,
  getOperationsNonArreteSansCompte,
  listArretesToValidByCollecteur,
  searchOperationsAnnulees,
} from '@/services/operation'
import { getTypesCollecte } from '@/services/param'
import type { ArreteToValidListItem, OperationNA, Summary, WTypeCollect } from '@/services/openapi-components'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_CLASS,
  TABLE_TD_MONO_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { getConnectedUserLogin } from '@/utils/connected-user-login'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'
import {
  mapTypeCollecteSelectOptions,
  typeCollecteLabelForValue,
} from '@/utils/type-collecte-select-options'

type ViewMode = 'operations' | 'annulations' | 'arretes'

type CollecteurItem = {
  login: string
  label: string
  codeClient?: string
}

type CollecteurSoldeRow = {
  rowKey: string
  nom: string
  solde: number | undefined
}

const SOLDES_EXPORT_COLUMNS = ['Collecteur', 'Solde'] as const

function mapCollecteurSoldeRow(row: Record<string, unknown>, idx: number): CollecteurSoldeRow {
  const nom = String(
    row.nomclient ?? row.nomCollecteur ?? row.nomClient ?? row.nom ?? '',
  ).trim()
  const soldeRaw = row.solde
  const solde =
    typeof soldeRaw === 'number'
      ? soldeRaw
      : Number(String(soldeRaw ?? '').replace(/\s/g, '').replace(',', '.'))
  return {
    rowKey: nom || `solde-${idx}`,
    nom: nom || '—',
    solde: Number.isFinite(solde) ? solde : undefined,
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDateDisplay(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('fr-FR')
  } catch {
    return iso
  }
}

function formatMontant(n: number | string | undefined): string {
  if (n === undefined || n === null || n === '') return '—'
  const num = typeof n === 'string' ? Number(n.replace(/\s/g, '').replace(',', '.')) : n
  if (!Number.isFinite(num)) return String(n)
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(num)
}

function operationDate(row: OperationNA): string {
  return formatDateDisplay(row.heureoperation)
}

function sumMontant(rows: OperationNA[]): number {
  return rows.reduce((acc, r) => {
    const m = typeof r.montant === 'number' ? r.montant : Number(r.montant)
    return acc + (Number.isFinite(m) ? m : 0)
  }, 0)
}

function normalizeSummary(row: Summary): Summary {
  const r = row as Summary & Record<string, unknown>
  const compteLes = String(r.compteLes ?? r.compteLES ?? r.compteLESN ?? '').trim()
  const compteLce = String(r.compteLce ?? r.compteLCE ?? r.compteLCEN ?? '').trim()
  return {
    ...row,
    compteLes: compteLes || row.compteLes,
    compteLce: compteLce || row.compteLce,
  }
}

export function ArretesAnnulationsPage() {
  const orgFilters = useDirectionAgenceFilters({
    onScopeChange: () => {
      setSelectedLogin('')
      setCollecteurs([])
      setRowsAvecCompte([])
      setRowsSansCompte([])
      setRowsAnnulations([])
      setRowsArretes([])
    },
  })

  const [typesCollecte, setTypesCollecte] = useState<WTypeCollect[]>([])
  const [typeCollecteId, setTypeCollecteId] = useState('')
  const [dateDebut, setDateDebut] = useState(todayIso)
  const [dateFin, setDateFin] = useState(todayIso)

  const [viewMode, setViewMode] = useState<ViewMode>('operations')
  const [collecteurSearch, setCollecteurSearch] = useState('')
  const [soldesOpen, setSoldesOpen] = useState(false)
  const [soldesLoading, setSoldesLoading] = useState(false)
  const [soldesError, setSoldesError] = useState<string | null>(null)
  const [soldesRows, setSoldesRows] = useState<CollecteurSoldeRow[]>([])
  const [collecteurs, setCollecteurs] = useState<CollecteurItem[]>([])
  const [selectedLogin, setSelectedLogin] = useState('')

  const [rowsAvecCompte, setRowsAvecCompte] = useState<OperationNA[]>([])
  const [rowsSansCompte, setRowsSansCompte] = useState<OperationNA[]>([])
  const [rowsAnnulations, setRowsAnnulations] = useState<Summary[]>([])
  const [rowsArretes, setRowsArretes] = useState<ArreteToValidListItem[]>([])

  const [opDetailOpen, setOpDetailOpen] = useState(false)
  const [opDetailLoading, setOpDetailLoading] = useState(false)
  const [opDetailError, setOpDetailError] = useState<string | null>(null)
  const [opDetailRows, setOpDetailRows] = useState<Summary[]>([])
  const [opDetailReference, setOpDetailReference] = useState('')

  const [isLoadingCollecteurs, setIsLoadingCollecteurs] = useState(false)
  const [isLoadingOps, setIsLoadingOps] = useState(false)
  const [isArretePending, setIsArretePending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const agence = orgFilters.agenceCode
  const direction = orgFilters.codeDir

  const selectedCollecteur = useMemo(
    () => collecteurs.find((c) => c.login === selectedLogin) ?? null,
    [collecteurs, selectedLogin],
  )

  const typeCollecteOptions = useMemo(
    () => mapTypeCollecteSelectOptions(typesCollecte),
    [typesCollecte],
  )

  const selectedTypeCollecteLabel = useMemo(
    () => typeCollecteLabelForValue(typeCollecteId, typeCollecteOptions),
    [typeCollecteId, typeCollecteOptions],
  )

  const filteredCollecteurs = useMemo(() => {
    const q = collecteurSearch.trim().toLowerCase()
    if (!q) return collecteurs
    return collecteurs.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.login.toLowerCase().includes(q) ||
        (c.codeClient ?? '').toLowerCase().includes(q),
    )
  }, [collecteurs, collecteurSearch])

  const totalOps = useMemo(() => sumMontant(rowsAvecCompte), [rowsAvecCompte])
  const nombreOps = rowsAvecCompte.length

  const totalSoldes = useMemo(
    () => soldesRows.reduce((acc, r) => acc + (typeof r.solde === 'number' ? r.solde : 0), 0),
    [soldesRows],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const env = await getTypesCollecte()
        const list = Array.isArray(env.data) ? env.data : []
        if (cancelled) return
        const active = list.filter((t) => t.etat === undefined || t.etat === 1 || t.etat === 0)
        const usable = active.length ? active : list
        setTypesCollecte(usable)
        const options = mapTypeCollecteSelectOptions(usable)
        if (options.length && !typeCollecteId) {
          setTypeCollecteId(options[0].value)
        }
      } catch {
        if (!cancelled) setTypesCollecte([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadCollecteurs = useCallback(async () => {
    const scopeError = orgFilters.getScopeError()
    if (scopeError) {
      setError(scopeError)
      return
    }
    setIsLoadingCollecteurs(true)
    setError(null)
    setViewMode('operations')
    try {
      const env = await listCollecteursParAgence(agence)
      const next = mapCollecteurSelectOptions(extractListFromApiEnvelope(env)).map((o) => ({
        login: o.value,
        label: o.label,
        codeClient: o.codeClient,
      }))
      setCollecteurs(next)
      setSelectedLogin((prev) => (prev && next.some((c) => c.login === prev) ? prev : ''))
      setRowsAvecCompte([])
      setRowsSansCompte([])
    } catch (err) {
      setCollecteurs([])
      setError(err instanceof Error ? err.message : 'Impossible de charger les collecteurs')
    } finally {
      setIsLoadingCollecteurs(false)
    }
  }, [agence, orgFilters.getScopeError])

  const loadSoldesCollecteurs = useCallback(async () => {
    const scopeError = orgFilters.getScopeError()
    if (scopeError) {
      setError(scopeError)
      return
    }
    setSoldesOpen(true)
    setSoldesLoading(true)
    setSoldesError(null)
    setSoldesRows([])
    try {
      const env = await listCollecteursAvecSoldeParAgence(agence)
      const list = extractListFromApiEnvelope(env) as Record<string, unknown>[]
      setSoldesRows(list.map((row, idx) => mapCollecteurSoldeRow(row, idx)))
    } catch (err) {
      setSoldesRows([])
      setSoldesError(err instanceof Error ? err.message : 'Impossible de charger les soldes')
    } finally {
      setSoldesLoading(false)
    }
  }, [agence, orgFilters.getScopeError])

  function exportSoldesXls() {
    exportJsonToXlsx(
      'soldes_collecteurs',
      'Soldes des collecteurs',
      soldesRows.map((r) => ({
        Collecteur: r.nom,
        Solde: r.solde ?? '',
      })),
    )
  }

  function exportSoldesPdf() {
    exportTableToPdf(
      'Soldes des collecteurs',
      'soldes_collecteurs',
      [...SOLDES_EXPORT_COLUMNS],
      soldesRows.map((r) => [r.nom, formatMontant(r.solde)]),
    )
  }

  const loadOperationsForCollecteur = useCallback(
    async (login: string) => {
      if (!login) return
      setIsLoadingOps(true)
      setError(null)
      setViewMode('operations')
      try {
        const body = { login, statDate: dateDebut, endDate: dateFin }
        const [avec, sans] = await Promise.all([
          getOperationsNonArreteAvecCompte(body),
          getOperationsNonArreteSansCompte(body),
        ])
        setRowsAvecCompte(Array.isArray(avec.data) ? avec.data : [])
        setRowsSansCompte(Array.isArray(sans.data) ? sans.data : [])
        setRowsAnnulations([])
      } catch (err) {
        setRowsAvecCompte([])
        setRowsSansCompte([])
        setError(err instanceof Error ? err.message : 'Impossible de charger les opérations')
      } finally {
        setIsLoadingOps(false)
      }
    },
    [dateDebut, dateFin],
  )

  const selectCollecteur = useCallback(
    (login: string) => {
      const next = String(login ?? '').trim()
      if (!next) return
      setSelectedLogin(next)
      setViewMode('operations')
      void loadOperationsForCollecteur(next)
    },
    [loadOperationsForCollecteur],
  )

  const loadArretesList = useCallback(async () => {
    if (!selectedLogin) {
      setError('Sélectionnez un collecteur pour afficher les arrêtés.')
      return
    }
    setViewMode('arretes')
    setIsLoadingOps(true)
    setError(null)
    setRowsAvecCompte([])
    setRowsSansCompte([])
    setRowsAnnulations([])
    try {
      const env = await listArretesToValidByCollecteur({
        dateOp: dateFin,
        login: selectedLogin,
      })
      setRowsArretes(extractArreteToValidList(env))
    } catch (err) {
      setRowsArretes([])
      setError(err instanceof Error ? err.message : 'Impossible de charger les arrêtés')
    } finally {
      setIsLoadingOps(false)
    }
  }, [dateFin, selectedLogin])

  const openOperationDetails = useCallback(async (reference: string | undefined) => {
    const ref = String(reference ?? '').trim()
    if (!ref) return
    setOpDetailReference(ref)
    setOpDetailOpen(true)
    setOpDetailLoading(true)
    setOpDetailError(null)
    setOpDetailRows([])
    try {
      const env = await getDetailsOperationNonArrete(ref)
      setOpDetailRows(
        (Array.isArray(env.data) ? env.data : []).map((row) => normalizeSummary(row)),
      )
    } catch (err) {
      setOpDetailError(err instanceof Error ? err.message : 'Détails indisponibles')
    } finally {
      setOpDetailLoading(false)
    }
  }, [])

  const loadAnnulations = useCallback(async () => {
    const scopeError = orgFilters.getScopeError()
    if (scopeError) {
      setError(scopeError)
      return
    }
    setViewMode('annulations')
    setIsLoadingOps(true)
    setError(null)
    setRowsAvecCompte([])
    setRowsSansCompte([])
    try {
      const body = { codeAgence: agence, dateDebut, dateFin }
      const query = selectedLogin ? { collecteur: selectedLogin } : undefined
      const env = await searchOperationsAnnulees(body, query)
      setRowsAnnulations(
        (Array.isArray(env.data) ? env.data : []).map((row) => normalizeSummary(row)),
      )
    } catch (err) {
      setRowsAnnulations([])
      setError(err instanceof Error ? err.message : 'Impossible de charger les annulations')
    } finally {
      setIsLoadingOps(false)
    }
  }, [agence, dateDebut, dateFin, orgFilters.getScopeError, selectedLogin])

  useEffect(() => {
    if (!agence) return
    void loadCollecteurs()
  }, [agence, loadCollecteurs])

  async function handleFaireArrete() {
    if (!selectedCollecteur || !orgFilters.hasScope) {
      setError('Sélectionnez une direction, une agence et un collecteur.')
      return
    }
    if (!rowsAvecCompte.length && !rowsSansCompte.length) {
      setError('Aucune opération à arrêter.')
      return
    }
    setIsArretePending(true)
    setError(null)
    setSuccess(null)
    try {
      let compteCollecteur = ''
      let nomCollecteur = selectedCollecteur.label
      let codeClientCollecteur = selectedCollecteur.codeClient ?? ''
      try {
        const cc = await getClientCollecteur(selectedCollecteur.login)
        const d = cc.data
        if (d) {
          nomCollecteur = String(d.nomCollecteur ?? nomCollecteur).trim()
          codeClientCollecteur = codeClientCollecteur || String(selectedCollecteur.codeClient ?? '').trim()
        }
      } catch {
        /* optional enrichment */
      }

      const compteToCredit =
        String(rowsAvecCompte[0]?.compteLCE ?? rowsAvecCompte[0]?.compteLCEN ?? '').trim() || compteCollecteur

      const res = await faireArrete({
        montant: totalOps,
        codeAgence: agence,
        login: getConnectedUserLogin(),
        codeClientCollecteur,
        nomCollecteur,
        compteToCredit,
        compteCollecteur: compteToCredit,
        loginCollecteur: selectedCollecteur.login,
        codeDirection: direction || undefined,
        dateDebut,
        dateFin,
      })
      setSuccess(res.message ?? "Arrêté effectué avec succès.")
      await loadOperationsForCollecteur(selectedCollecteur.login)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'arrêté")
    } finally {
      setIsArretePending(false)
    }
  }

  const showOperationsLayout = viewMode === 'operations'
  const showAnnulationsTable = viewMode === 'annulations'
  const showArretesTable = viewMode === 'arretes'

  return (
    <>
    <DashboardPageShell title="Arrêté / annulations">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      <DashboardSectionCard title="Critères">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap items-end gap-2">
          <FilterChoiceField
            label="Collecte"
            name="arretes-type-collecte"
            value={typeCollecteId}
            onValueChange={setTypeCollecteId}
            options={typeCollecteOptions}
            placeholder={selectedTypeCollecteLabel || 'Type de collecte'}
            labelClassName="text-[10px] uppercase tracking-wide text-muted-foreground"
          />

          <div className="grid gap-1">
            <Label className="text-[10px] text-muted-foreground">Du</Label>
            <Input
              type="date"
              className="h-8 w-[140px] text-xs"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>

          <div className="grid gap-1">
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
            className="h-8 border-primary text-primary hover:bg-primary/10"
            disabled={isLoadingCollecteurs || !orgFilters.hasScope}
            onClick={() => void loadCollecteurs()}
          >
            Lister des collecteurs
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 border-primary text-primary hover:bg-primary/10"
            disabled={soldesLoading || !orgFilters.hasScope}
            onClick={() => void loadSoldesCollecteurs()}
          >
            {soldesLoading ? 'Chargement…' : 'Soldes des collecteurs'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 border-primary text-primary hover:bg-primary/10"
            disabled={!orgFilters.hasScope || isLoadingOps}
            onClick={() => void loadAnnulations()}
          >
            Liste des annulations
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 border-primary text-primary hover:bg-primary/10"
            disabled={!selectedLogin || isLoadingOps}
            onClick={() => void loadArretesList()}
          >
            Liste des arrêtés
          </Button>
          </div>
          <DirectionAgenceFilterButton filters={orgFilters} />
        </div>
      </DashboardSectionCard>

      <DashboardSectionCard
        className="min-h-0 flex-1"
        contentClassName="flex min-h-0 h-full flex-row gap-0 overflow-hidden p-0"
      >
        <aside className="relative z-20 flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-card">
          <div className="flex shrink-0 items-center justify-between bg-primary px-2 py-1.5 text-primary-foreground">
            <span className="text-xs font-semibold">Collecteur</span>
            <Search className="size-3.5 opacity-80" aria-hidden />
          </div>

          <div className="shrink-0 space-y-2 border-b border-border px-2 py-2">
            <Input
              className="h-8 text-xs"
              placeholder="Rechercher un collecteur…"
              value={collecteurSearch}
              onChange={(e) => setCollecteurSearch(e.target.value)}
            />
            <FilterChoiceField
              name="arretes-collecteur-select"
              label="Sélection"
              value={selectedLogin}
              onValueChange={selectCollecteur}
              options={collecteurs.map((c) => ({
                value: c.login,
                label: c.label === c.login ? c.login : `${c.label} — ${c.login}`,
              }))}
              disabled={isLoadingCollecteurs || !collecteurs.length}
              placeholder={
                isLoadingCollecteurs ? 'Chargement…' : 'Choisir un collecteur'
              }
              variant="select"
              triggerClassName="h-8 w-full text-xs"
              labelClassName="text-[10px] text-muted-foreground"
            />
          </div>

          <div
            role="listbox"
            aria-label="Liste des collecteurs"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {isLoadingCollecteurs ? (
              <div className="px-2 py-4 text-xs text-muted-foreground">Chargement…</div>
            ) : null}
            {!isLoadingCollecteurs && !filteredCollecteurs.length ? (
              <div className="px-2 py-4 text-xs text-muted-foreground">Aucun collecteur</div>
            ) : null}
            {filteredCollecteurs.map((c) => {
              const active = c.login === selectedLogin
              const radioId = `collecteur-${c.login}`
              return (
                <label
                  key={c.login}
                  htmlFor={radioId}
                  role="option"
                  aria-selected={active}
                  title={`${c.label} (${c.login})`}
                  className={[
                    'flex cursor-pointer items-start gap-2 border-b border-border/60 px-2.5 py-2.5',
                    'hover:bg-muted/40',
                    active ? 'bg-primary/15 ring-1 ring-inset ring-primary/25' : '',
                  ].join(' ')}
                >
                  <input
                    id={radioId}
                    type="radio"
                    name="arretes-collecteur-list"
                    className="mt-0.5 size-3.5 shrink-0 accent-primary"
                    checked={active}
                    onChange={() => selectCollecteur(c.login)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium leading-snug">{c.label}</span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                      {c.login}
                      {c.codeClient ? ` · ${c.codeClient}` : ''}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </aside>

        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
          <div className="flex min-h-0 flex-[3] flex-col border-b border-border">
            <div className={TABLE_SCROLL_AREA_CLASS}>
              <table className="min-w-[1100px] w-full border-collapse text-xs">
                <thead className={tableTheadClass({ sticky: true })}>
                  {showArretesTable ? (
                    <tr className={TABLE_HEAD_ROW_CLASS}>
                      <th>Date enreg.</th>
                      <th>Code client coll.</th>
                      <th>Nom collecteur</th>
                      <th className="text-right">Mnt collecte</th>
                      <th>Login point</th>
                      <th className="text-right">Mnt point</th>
                      <th>Référence</th>
                      <th>Info</th>
                    </tr>
                  ) : showAnnulationsTable ? (
                    <tr className={TABLE_HEAD_ROW_CLASS}>
                      <th>Date</th>
                      <th>Référence</th>
                      <th>N° abonnement</th>
                      <th>Client</th>
                      <th>Compte LES</th>
                      <th>Compte LCE</th>
                      <th>Collecteur</th>
                      <th>Montant</th>
                      <th>Motif</th>
                    </tr>
                  ) : (
                    <tr className={TABLE_HEAD_ROW_CLASS}>
                      <th>Code client</th>
                      <th>Compte LES N</th>
                      <th>Compte LCE N</th>
                      <th>N° Carte</th>
                      <th>Nom et prénoms client</th>
                      <th>Date</th>
                      <th>Référence</th>
                      <th className="text-right">Montant</th>
                      <th className="w-10" />
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-border">
                  {showArretesTable
                    ? rowsArretes.map((r, idx) => (
                        <tr key={`arrete-${r.x6 ?? r.loginpoint ?? idx}`} className={TABLE_ROW_CLASS}>
                          <td className={TABLE_TD_CLASS}>{formatDateDisplay(r.dateenreg)}</td>
                          <td className={TABLE_TD_MONO_CLASS}>{r.codecltcoll ?? '—'}</td>
                          <td className={`${TABLE_TD_CLASS} max-w-[180px] truncate`}>{r.nomcoll ?? '—'}</td>
                          <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.mntcoll)}</td>
                          <td className={TABLE_TD_MONO_CLASS}>{r.loginpoint ?? '—'}</td>
                          <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.mntpoint)}</td>
                          <td className={`${TABLE_TD_CLASS} max-w-[120px] truncate`}>{r.x6 ?? '—'}</td>
                          <td className={`${TABLE_TD_CLASS} max-w-[120px] truncate`}>{r.x3 ?? '—'}</td>
                        </tr>
                      ))
                    : showAnnulationsTable
                    ? rowsAnnulations.map((r, idx) => (
                        <tr key={`${r.reference ?? idx}`} className={TABLE_ROW_CLASS}>
                          <td className={TABLE_TD_CLASS}>{formatDateDisplay(r.date0peration)}</td>
                          <td className={`${TABLE_TD_CLASS} max-w-[120px] truncate`}>{r.reference ?? '—'}</td>
                          <td className={TABLE_TD_CLASS}>{r.numabonnement ?? '—'}</td>
                          <td className={`${TABLE_TD_CLASS} max-w-[180px] truncate`}>{r.nomClient ?? '—'}</td>
                          <td className={TABLE_TD_MONO_CLASS}>{r.compteLes ?? '—'}</td>
                          <td className={TABLE_TD_MONO_CLASS}>{r.compteLce ?? '—'}</td>
                          <td className={`${TABLE_TD_CLASS} max-w-[140px] truncate`}>{r.nomCollecteur ?? '—'}</td>
                          <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.montant)}</td>
                          <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>{r.motif ?? '—'}</td>
                        </tr>
                      ))
                    : rowsAvecCompte.map((r, idx) => (
                        <tr key={`${r.reference ?? idx}`} className={TABLE_ROW_CLASS}>
                          <td className={TABLE_TD_CLASS}>{r.codeClient ?? '—'}</td>
                          <td className={TABLE_TD_MONO_CLASS}>{r.compteLESN ?? r.compteLES ?? '—'}</td>
                          <td className={TABLE_TD_MONO_CLASS}>{r.compteLCEN ?? r.compteLCE ?? '—'}</td>
                          <td className={TABLE_TD_MONO_CLASS}>{r.numAbonnemnt ?? '—'}</td>
                          <td className={`${TABLE_TD_CLASS} max-w-[200px] truncate`}>{r.nomClient ?? '—'}</td>
                          <td className={TABLE_TD_CLASS}>{operationDate(r)}</td>
                          <td className={`${TABLE_TD_CLASS} max-w-[120px] truncate`}>{r.reference ?? '—'}</td>
                          <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.montant)}</td>
                          <td className={TABLE_TD_CLASS}>
                            <Button
                              type="button"
                              size="sm"
                              variant="info"
                              className="h-7 px-2 text-[10px]"
                              disabled={!r.reference}
                              onClick={() => void openOperationDetails(r.reference)}
                            >
                              Détail
                            </Button>
                          </td>
                        </tr>
                      ))}
                  {!isLoadingOps &&
                  ((showArretesTable && !rowsArretes.length) ||
                    (showAnnulationsTable && !rowsAnnulations.length) ||
                    (showOperationsLayout && !rowsAvecCompte.length && selectedLogin)) ? (
                    <tr>
                      <td colSpan={9} className={TABLE_EMPTY_CELL_CLASS}>
                        {showArretesTable
                          ? 'Aucun arrêté pour ce collecteur et cette date.'
                          : selectedLogin || showAnnulationsTable
                            ? 'Aucune opération pour cette sélection.'
                            : 'Sélectionnez un collecteur.'}
                      </td>
                    </tr>
                  ) : null}
                  {isLoadingOps ? (
                    <tr>
                      <td colSpan={9} className={TABLE_EMPTY_CELL_CLASS}>
                        Chargement…
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1 border-t border-border bg-muted/30 px-2 py-0.5">
              <Button type="button" variant="ghost" size="icon-xs" disabled title="Export PDF">
                <FileText className="size-3.5 text-destructive" />
              </Button>
            </div>
          </div>

          {/* Arrêté action row */}
          {showOperationsLayout ? (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-2">
              <Button
                type="button"
                variant="outline"
                className="min-w-[200px] border-primary text-primary hover:bg-primary/10"
                disabled={isArretePending || !selectedLogin}
                onClick={() => void handleFaireArrete()}
              >
                {isArretePending ? 'Arrêté en cours…' : "Effectuer l'arrêté"}
              </Button>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap text-muted-foreground">Nombre d&apos;opération</Label>
                <Input readOnly className="h-8 w-24 text-xs tabular-nums" value={String(nombreOps)} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap text-muted-foreground">Total</Label>
                <Input readOnly className="h-8 w-32 text-xs tabular-nums" value={formatMontant(totalOps)} />
              </div>
            </div>
          ) : null}

          {/* Bottom table — sans compte */}
          {showOperationsLayout ? (
            <div className="flex min-h-0 flex-[2] flex-col">
              <div className="shrink-0 bg-neutral-600 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                Liste des opérations sans compte
              </div>
              <div className={TABLE_SCROLL_AREA_CLASS}>
                <table className="min-w-[1100px] w-full border-collapse text-xs">
                  <thead className={tableTheadClass({ sticky: true })}>
                    <tr className={TABLE_HEAD_ROW_CLASS}>
                      <th>Code client</th>
                      <th>Compte LES</th>
                      <th>Compte LCE</th>
                      <th>N° d&apos;abonnement</th>
                      <th>Nom et prénoms client</th>
                      <th>Date</th>
                      <th>Référence</th>
                      <th className="text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_TBODY_CLASS}>
                    {rowsSansCompte.map((r, idx) => (
                      <tr key={`sans-${r.reference ?? idx}`} className={TABLE_ROW_CLASS}>
                        <td className={TABLE_TD_CLASS}>{r.codeClient ?? '—'}</td>
                        <td className={TABLE_TD_MONO_CLASS}>{r.compteLES ?? '—'}</td>
                        <td className={TABLE_TD_MONO_CLASS}>{r.compteLCE ?? '—'}</td>
                        <td className={TABLE_TD_MONO_CLASS}>{r.numAbonnemnt ?? '—'}</td>
                        <td className={`${TABLE_TD_CLASS} max-w-[200px] truncate`}>{r.nomClient ?? '—'}</td>
                        <td className={TABLE_TD_CLASS}>{operationDate(r)}</td>
                        <td className={`${TABLE_TD_CLASS} max-w-[120px] truncate`}>{r.reference ?? '—'}</td>
                        <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.montant)}</td>
                      </tr>
                    ))}
                    {!isLoadingOps && selectedLogin && !rowsSansCompte.length ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                          Aucune opération sans compte.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </DashboardSectionCard>

      <Dialog open={soldesOpen} onOpenChange={setSoldesOpen}>
        <DialogContent className="max-h-[min(90dvh,720px)] w-[calc(100%-2rem)] max-w-3xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle>Soldes des collecteurs</DialogTitle>
            <DialogDescription>
              {orgFilters.selectedAgencyLabel || agence || '—'}
              {soldesRows.length ? ` — ${soldesRows.length} collecteur(s)` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end border-b border-border px-4 py-2">
            <TableExportButtons
              disabled={soldesLoading || !soldesRows.length}
              onExportXls={exportSoldesXls}
              onExportPdf={exportSoldesPdf}
            />
          </div>
          <div className="max-h-[min(55vh,480px)] overflow-auto px-4 py-3">
            {soldesLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : null}
            {soldesError ? <p className="text-sm text-destructive">{soldesError}</p> : null}
            {!soldesLoading && !soldesError ? (
              <table className="w-full min-w-[360px] border-collapse text-xs">
                <thead className={tableTheadClass({ sticky: true })}>
                  <tr className={TABLE_HEAD_ROW_CLASS}>
                    <th>Collecteur</th>
                    <th className="text-right">Solde</th>
                  </tr>
                </thead>
                <tbody className={TABLE_TBODY_CLASS}>
                  {soldesRows.map((r) => (
                    <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                      <td className={TABLE_TD_CLASS}>{r.nom}</td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                        {formatMontant(r.solde)}
                      </td>
                    </tr>
                  ))}
                  {!soldesRows.length ? (
                    <tr>
                      <td colSpan={2} className={TABLE_EMPTY_CELL_CLASS}>
                        Aucun solde pour cette agence.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            ) : null}
          </div>
          <DialogFooter className="flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Total : <span className="font-medium text-foreground">{formatMontant(totalSoldes)}</span>
            </p>
            <Button type="button" variant="success" onClick={() => setSoldesOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={opDetailOpen} onOpenChange={setOpDetailOpen}>
        <DialogContent className="max-h-[min(90dvh,640px)] w-[calc(100%-2rem)] max-w-2xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border">
            <DialogTitle>Détail opération</DialogTitle>
            <DialogDescription className="font-mono text-xs">{opDetailReference || '—'}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto px-4 py-3">
            {opDetailLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : null}
            {opDetailError ? <p className="text-sm text-destructive">{opDetailError}</p> : null}
            {!opDetailLoading && !opDetailError && !opDetailRows.length ? (
              <p className="text-sm text-muted-foreground">Aucun détail pour cette référence.</p>
            ) : null}
            <ul className="space-y-2 text-sm">
              {opDetailRows.map((d, i) => (
                <li key={i} className="rounded-md border border-border px-3 py-2">
                  <div className="font-medium">{d.nomClient ?? '—'}</div>
                  <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
                    <span>Date : {formatDateDisplay(d.date0peration)}</span>
                    <span>Montant : {formatMontant(d.montant)}</span>
                    <span>Réf. : {d.reference ?? '—'}</span>
                    <span>N° abonnement : {d.numabonnement ?? '—'}</span>
                    <span>Collecteur : {d.nomCollecteur ?? '—'}</span>
                    {d.motif ? <span>Motif : {d.motif}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button type="button" variant="success" className="w-full" onClick={() => setOpDetailOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPageShell>
    <DirectionAgenceFilterSheet filters={orgFilters} />
    </>
  )
}
