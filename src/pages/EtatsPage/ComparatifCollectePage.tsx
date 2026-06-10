import { useCallback, useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import { TableColumnFilterInput } from '@/components/TableColumnFilterInput'
import { TablePaginationBar } from '@/components/TablePagination'
import { TableExportButtons } from '@/components/TableExportButtons'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  searchComparatifCollecte,
  type ComparatifCollecteRow,
} from '@/services/comparatif-collecte'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_FILTER_ROW_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_CLASS,
  TABLE_TD_MONO_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

type SortKey = keyof Pick<
  ComparatifCollecteRow,
  | 'codeClient'
  | 'login'
  | 'nomCollecteur'
  | 'totalCartes'
  | 'totalClients'
  | 'collecteCourant'
  | 'commissionCourant'
  | 'collecteM1'
  | 'commissionM1'
>

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right'; filterable?: boolean }[] = [
  { key: 'codeClient', label: 'CODE CLIENT', filterable: true },
  { key: 'login', label: 'LOGIN', filterable: true },
  { key: 'nomCollecteur', label: 'COLLECTEUR', filterable: true },
  { key: 'totalCartes', label: 'TOTAL CARTES', align: 'right', filterable: true },
  { key: 'totalClients', label: 'TOTAL CLIENTS', align: 'right', filterable: true },
  { key: 'collecteCourant', label: 'COLLECTE COURANT', align: 'right', filterable: true },
  { key: 'commissionCourant', label: 'COMMISSION COURANT', align: 'right', filterable: true },
  { key: 'collecteM1', label: 'COLLECTE M-1', align: 'right', filterable: true },
  { key: 'commissionM1', label: 'COMMISSION M-1', align: 'right', filterable: true },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultDateDebut(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function formatMontant(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}

function emptyFilters(): Record<SortKey, string> {
  return {
    codeClient: '',
    login: '',
    nomCollecteur: '',
    totalCartes: '',
    totalClients: '',
    collecteCourant: '',
    commissionCourant: '',
    collecteM1: '',
    commissionM1: '',
  }
}

export function ComparatifCollectePage() {
  const f = useDashboardFilters()

  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<ComparatifCollecteRow[]>([])
  const [columnFilter, setColumnFilter] = useState('')
  const [headerFilters, setHeaderFilters] = useState(emptyFilters)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agencyScope = useMemo(() => {
    const sessionAgence = getConnectedUserCodeAgence()
    const directionApi = f.direction !== 'Toutes' ? f.direction.trim() : undefined
    const allScopedAgencies = f.agences.map((a) => a.value).filter(Boolean)

    if (f.agency !== 'Toutes') {
      return { agencyCodes: [f.agency.trim()], direction: directionApi }
    }
    if (directionApi && allScopedAgencies.length) {
      return { agencyCodes: allScopedAgencies, direction: directionApi }
    }
    if (allScopedAgencies.length) {
      return { agencyCodes: allScopedAgencies, direction: directionApi }
    }
    return {
      agencyCodes: sessionAgence ? [sessionAgence] : [],
      direction: directionApi,
    }
  }, [f.agency, f.agences, f.direction])

  const loadList = useCallback(async () => {
    if (f.isAgencesByDirectionLoading) {
      setError('Chargement des agences de la direction…')
      return
    }
    if (!agencyScope.agencyCodes.length && !agencyScope.direction) {
      setError('Sélectionnez une agence ou une direction dans les filtres du tableau de bord.')
      return
    }
    if (agencyScope.direction && !agencyScope.agencyCodes.length) {
      setError('Aucune agence trouvée pour cette direction.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const list = await searchComparatifCollecte({
        dateDebut,
        dateFin,
        codeDir: agencyScope.direction,
        agencyCodes: agencyScope.agencyCodes,
        direction: agencyScope.direction,
      })
      setRows(list)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger le comparatif collecte')
    } finally {
      setIsLoading(false)
    }
  }, [agencyScope, dateDebut, dateFin, f.isAgencesByDirectionLoading])

  const filteredSorted = useMemo(() => {
    let out = rows
    const q = columnFilter.trim().toLowerCase()
    if (q) {
      out = out.filter((r) =>
        COLUMNS.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)),
      )
    }
    for (const col of COLUMNS) {
      const fq = headerFilters[col.key].trim().toLowerCase().replace(/\s/g, '')
      if (!fq) continue
      out = out.filter((r) => {
        const val = r[col.key]
        if (typeof val === 'number') return String(val).includes(fq)
        return String(val ?? '').toLowerCase().includes(fq)
      })
    }
    if (!sortKey) return out
    const dir = sortDir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (
        sortKey === 'totalCartes' ||
        sortKey === 'totalClients' ||
        sortKey === 'collecteCourant' ||
        sortKey === 'commissionCourant' ||
        sortKey === 'collecteM1' ||
        sortKey === 'commissionM1'
      ) {
        return (((av as number | undefined) ?? 0) - ((bv as number | undefined) ?? 0)) * dir
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'fr', {
        sensitivity: 'base',
        numeric: true,
      }) * dir
    })
  }, [rows, columnFilter, headerFilters, sortKey, sortDir])

  const tablePg = useTablePagination(filteredSorted)

  const totals = useMemo(
    () => ({
      collecteCourant: filteredSorted.reduce((acc, r) => acc + r.collecteCourant, 0),
      commissionCourant: filteredSorted.reduce((acc, r) => acc + r.commissionCourant, 0),
      collecteM1: filteredSorted.reduce((acc, r) => acc + (r.collecteM1 ?? 0), 0),
      commissionM1: filteredSorted.reduce((acc, r) => acc + (r.commissionM1 ?? 0), 0),
    }),
    [filteredSorted],
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function setHeaderFilter(key: SortKey, value: string) {
    setHeaderFilters((prev) => ({ ...prev, [key]: value }))
  }

  function exportXls() {
    exportJsonToXlsx(
      'comparatif_collecte',
      'Comparatif collecte',
      filteredSorted.map((r) => ({
        'CODE CLIENT': r.codeClient,
        LOGIN: r.login,
        COLLECTEUR: r.nomCollecteur,
        'TOTAL CARTES': r.totalCartes,
        'TOTAL CLIENTS': r.totalClients,
        'COLLECTE COURANT': r.collecteCourant,
        'COMMISSION COURANT': r.commissionCourant,
        'COLLECTE M-1': r.collecteM1 ?? '',
        'COMMISSION M-1': r.commissionM1 ?? '',
      })),
    )
  }

  function exportPdf() {
    exportTableToPdf(
      'Comparatif collecte',
      'comparatif_collecte',
      COLUMNS.map((c) => c.label),
      filteredSorted.map((r) => [
        r.codeClient,
        r.login,
        r.nomCollecteur,
        String(r.totalCartes),
        String(r.totalClients),
        formatMontant(r.collecteCourant),
        formatMontant(r.commissionCourant),
        formatMontant(r.collecteM1),
        formatMontant(r.commissionM1),
      ]),
    )
  }

  return (
    <DashboardTablePageLayout
      title="Comparatif collecte"
      cardTitle="Comparatif collecte"
      cardDescription="Collecte et commission par collecteur — période courante vs mois précédent."
      alerts={
        error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null
      }
      toolbar={
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-wrap items-end gap-2">
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
                className="h-8 min-w-[100px] border-primary text-primary hover:bg-primary/10"
                disabled={isLoading}
                onClick={() => void loadList()}
              >
                {isLoading ? 'Chargement…' : 'EXECUTER'}
              </Button>
            </div>
            <TableExportButtons
              disabled={!filteredSorted.length}
              onExportXls={exportXls}
              onExportPdf={exportPdf}
            />
          </div>
          <div className="flex max-w-xs items-center gap-2">
            <Filter className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              className="h-7 text-xs"
              placeholder="Filtrer le tableau…"
              value={columnFilter}
              onChange={(e) => setColumnFilter(e.target.value)}
            />
          </div>
        </>
      }
      footer={
        rows.length > 0 && !isLoading ? (
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-[200px] items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">Σ collecte courant :</Label>
              <Input readOnly className="h-8 text-xs tabular-nums" value={formatMontant(totals.collecteCourant)} />
            </div>
            <div className="flex min-w-[200px] items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">Σ commission courant :</Label>
              <Input readOnly className="h-8 text-xs tabular-nums" value={formatMontant(totals.commissionCourant)} />
            </div>
            <div className="text-xs text-muted-foreground">{filteredSorted.length} collecteur(s)</div>
          </div>
        ) : null
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
        <table className="min-w-[1200px] w-full border-collapse text-xs">
          <thead className={tableTheadClass({ sticky: true })}>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              {COLUMNS.map((col) => (
                <SortableTh
                  key={col.key}
                  label={col.label}
                  active={sortKey === col.key}
                  dir={sortDir}
                  align={col.align}
                  onSort={() => toggleSort(col.key)}
                />
              ))}
            </tr>
            <tr className={TABLE_HEAD_FILTER_ROW_CLASS}>
              {COLUMNS.map((col) => (
                <th key={`filter-${col.key}`} className={col.align === 'right' ? 'text-right' : 'text-left'}>
                  {col.filterable ? (
                    <TableColumnFilterInput
                      align={col.align}
                      value={headerFilters[col.key]}
                      onChange={(value) => setHeaderFilter(col.key, value)}
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={TABLE_TBODY_CLASS}>
            {isLoading ? (
              <tr>
                <td colSpan={9} className={TABLE_EMPTY_CELL_CLASS}>
                  Chargement…
                </td>
              </tr>
            ) : null}
            {!isLoading && !filteredSorted.length ? (
              <tr>
                <td colSpan={9} className={TABLE_EMPTY_CELL_CLASS}>
                  Choisissez la période puis cliquez sur EXECUTER.
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? tablePg.pageItems.map((r) => (
                  <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                    <td className={TABLE_TD_MONO_CLASS}>{r.codeClient || '—'}</td>
                    <td className={TABLE_TD_MONO_CLASS}>{r.login || '—'}</td>
                    <td className={`${TABLE_TD_CLASS} max-w-[220px] truncate`}>{r.nomCollecteur}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{r.totalCartes}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{r.totalClients}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.collecteCourant)}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.commissionCourant)}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.collecteM1)}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.commissionM1)}
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </DashboardTablePageLayout>
  )
}
