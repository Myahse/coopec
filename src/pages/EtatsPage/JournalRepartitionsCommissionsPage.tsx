import { useCallback, useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import {
  DirectionAgenceFilterButton,
  DirectionAgenceFilterSheet,
} from '@/components/DirectionAgenceFilterSheet'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { TableColumnFilterInput } from '@/components/TableColumnFilterInput'
import { TablePaginationBar } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  searchJournalRepartitionsCommissions,
  type RepartitionCommissionRow,
} from '@/services/journal-repartitions-commissions'
import { useDirectionAgenceFilters } from '@/hooks/use-direction-agence-filters'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_FILTER_ROW_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

type SortKey = keyof Pick<RepartitionCommissionRow, 'direction' | 'agence' | 'montant' | 'commission'>

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right'; filterable?: boolean }[] = [
  { key: 'direction', label: 'DIRECTION', filterable: true },
  { key: 'agence', label: 'Agence', filterable: true },
  { key: 'montant', label: 'Montant', align: 'right', filterable: true },
  { key: 'commission', label: 'Commission', align: 'right', filterable: true },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatMontant(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return ''
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}

export function JournalRepartitionsCommissionsPage() {
  const orgFilters = useDirectionAgenceFilters({
    allowAllAgencies: true,
    onScopeChange: () => setRows([]),
  })

  const [dateDebut, setDateDebut] = useState(todayIso)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<RepartitionCommissionRow[]>([])
  const [columnFilter, setColumnFilter] = useState('')
  const [directionFilter, setDirectionFilter] = useState('')
  const [agenceFilter, setAgenceFilter] = useState('')
  const [montantFilter, setMontantFilter] = useState('')
  const [commissionFilter, setCommissionFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    const scopeError = orgFilters.getScopeError()
    if (scopeError) {
      setError(scopeError)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const list = await searchJournalRepartitionsCommissions(
        {
          dateDebut,
          dateFin,
          codeAgence: orgFilters.allAgenciesSelected ? undefined : orgFilters.agenceCode,
          agencyCodes: orgFilters.allAgenciesSelected ? orgFilters.agencyCodesForQuery : undefined,
          codeDir: orgFilters.codeDir,
        },
        orgFilters.agencyLabels,
      )
      setRows(list)
    } catch (err) {
      setRows([])
      setError(
        err instanceof Error ? err.message : 'Impossible de charger le journal des répartitions des collectes',
      )
    } finally {
      setIsLoading(false)
    }
  }, [dateDebut, dateFin, orgFilters])

  const filteredSorted = useMemo(() => {
    let out = rows
    const q = columnFilter.trim().toLowerCase()
    if (q) {
      out = out.filter((r) =>
        COLUMNS.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)),
      )
    }
    const dirQ = directionFilter.trim().toLowerCase()
    if (dirQ) out = out.filter((r) => r.direction.toLowerCase().includes(dirQ))
    const agenceQ = agenceFilter.trim().toLowerCase()
    if (agenceQ) out = out.filter((r) => r.agence.toLowerCase().includes(agenceQ))
    const montantQ = montantFilter.trim().replace(/\s/g, '')
    if (montantQ) out = out.filter((r) => String(r.montant).includes(montantQ))
    const commissionQ = commissionFilter.trim().replace(/\s/g, '')
    if (commissionQ) out = out.filter((r) => String(r.commission).includes(commissionQ))

    if (!sortKey) return out
    const dir = sortDir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (sortKey === 'montant' || sortKey === 'commission') {
        return ((av as number) - (bv as number)) * dir
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'fr', {
        sensitivity: 'base',
        numeric: true,
      }) * dir
    })
  }, [
    rows,
    columnFilter,
    directionFilter,
    agenceFilter,
    montantFilter,
    commissionFilter,
    sortKey,
    sortDir,
  ])
  const tablePg = useTablePagination(filteredSorted)

  const totalCollecte = useMemo(
    () => filteredSorted.reduce((acc, r) => acc + r.montant, 0),
    [filteredSorted],
  )

  const totalCommission = useMemo(
    () => filteredSorted.reduce((acc, r) => acc + r.commission, 0),
    [filteredSorted],
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function exportXls() {
    exportJsonToXlsx(
      'journal_repartitions_collectes',
      'Répartitions des collectes',
      filteredSorted.map((r) => ({
        DIRECTION: r.direction,
        Agence: r.agence,
        Montant: r.montant,
        Commission: r.commission,
      })),
    )
  }

  function exportPdf() {
    exportTableToPdf(
      'Journal des répartitions des collectes',
      'journal_repartitions_collectes',
      COLUMNS.map((c) => c.label),
      filteredSorted.map((r) => [
        r.direction,
        r.agence,
        formatMontant(r.montant),
        formatMontant(r.commission),
      ]),
    )
  }

  return (
    <>
    <DashboardTablePageLayout
      title="Journal des répartitions des collectes"
      cardTitle="Répartitions des collectes"
      cardDescription="Montant collecté et commission par direction et agence — période et export."
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
                disabled={isLoading || !orgFilters.hasScope}
                onClick={() => void loadList()}
              >
                {isLoading ? 'Chargement…' : 'EXECUTER'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 min-w-[52px] border-primary text-primary hover:bg-primary/10"
                disabled={!filteredSorted.length}
                onClick={exportXls}
              >
                XLS
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 min-w-[52px] border-primary text-primary hover:bg-primary/10"
                disabled={!filteredSorted.length}
                onClick={exportPdf}
              >
                PDF
              </Button>
              <DirectionAgenceFilterButton filters={orgFilters} />
            </div>
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
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-[240px] flex-1 items-center gap-2">
            <Label className="shrink-0 text-xs text-muted-foreground">Total collecté :</Label>
            <Input
              readOnly
              className="h-8 text-xs tabular-nums"
              value={formatMontant(totalCollecte)}
            />
          </div>
          <div className="flex min-w-[240px] flex-1 items-center gap-2">
            <Label className="shrink-0 text-xs text-muted-foreground">Commission :</Label>
            <Input
              readOnly
              className="h-8 text-xs tabular-nums"
              value={formatMontant(totalCommission)}
            />
          </div>
        </div>
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="min-w-[900px] w-full border-collapse text-xs">
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
                        value={
                          col.key === 'direction'
                            ? directionFilter
                            : col.key === 'agence'
                              ? agenceFilter
                              : col.key === 'montant'
                                ? montantFilter
                                : commissionFilter
                        }
                        onChange={(value) => {
                          if (col.key === 'direction') setDirectionFilter(value)
                          else if (col.key === 'agence') setAgenceFilter(value)
                          else if (col.key === 'montant') setMontantFilter(value)
                          else setCommissionFilter(value)
                        }}
                      />
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={TABLE_TBODY_CLASS}>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className={TABLE_EMPTY_CELL_CLASS}>
                    Chargement…
                  </td>
                </tr>
              ) : null}
              {!isLoading && !filteredSorted.length ? (
                <tr>
                  <td colSpan={4} className={TABLE_EMPTY_CELL_CLASS}>
                    Choisissez la période puis cliquez sur EXECUTER.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r) => (
                    <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                      <td className={`${TABLE_TD_CLASS} max-w-[220px] truncate`}>{r.direction}</td>
                      <td className={`${TABLE_TD_CLASS} max-w-[200px] truncate`}>{r.agence}</td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                        {formatMontant(r.montant) || '—'}
                      </td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                        {formatMontant(r.commission) || '—'}
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
      </div>
    </DashboardTablePageLayout>
    <DirectionAgenceFilterSheet filters={orgFilters} />
    </>
  )
}
