import { useCallback, useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import { TablePaginationBar } from '@/components/TablePagination'
import { TableExportButtons } from '@/components/TableExportButtons'
import { TableColumnFilterInput } from '@/components/TableColumnFilterInput'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import { searchChargeEpargne, type ChargeEpargneRow } from '@/services/charge-epargne'
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
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

type SortKey = keyof Pick<
  ChargeEpargneRow,
  'nomAgence' | 'datePaie' | 'totalTransactions' | 'totalMontant'
>

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right'; filterable?: boolean }[] = [
  { key: 'nomAgence', label: 'NOM AGENCE', filterable: true },
  { key: 'datePaie', label: 'DATE PAIE', filterable: true },
  { key: 'totalTransactions', label: 'TOTAL TRANSACTIONS', align: 'right', filterable: true },
  { key: 'totalMontant', label: "CHARGE D'EPARGNE", align: 'right', filterable: true },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultDateDebut(): string {
  const y = new Date().getFullYear()
  return `${y}-01-01`
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

function formatMontant(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}

export function ChargeEpargnePage() {
  const f = useDashboardFilters()

  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<ChargeEpargneRow[]>([])
  const [columnFilter, setColumnFilter] = useState('')
  const [nomAgenceFilter, setNomAgenceFilter] = useState('')
  const [datePaieFilter, setDatePaieFilter] = useState('')
  const [transactionsFilter, setTransactionsFilter] = useState('')
  const [montantFilter, setMontantFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agencyScope = useMemo(() => {
    const sessionAgence = getConnectedUserCodeAgence()
    const directionApi = f.direction !== 'Toutes' ? f.direction.trim() : undefined
    const allScopedAgencies = f.agences.map((a) => a.value).filter(Boolean)

    if (f.agency !== 'Toutes') {
      return {
        agencyCodes: [f.agency.trim()],
        direction: directionApi,
      }
    }

    if (directionApi && allScopedAgencies.length) {
      return {
        agencyCodes: allScopedAgencies,
        direction: directionApi,
      }
    }

    if (allScopedAgencies.length) {
      return {
        agencyCodes: allScopedAgencies,
        direction: directionApi,
      }
    }

    return {
      agencyCodes: sessionAgence ? [sessionAgence] : [],
      direction: directionApi,
    }
  }, [f.agency, f.agences, f.direction])

  const agencyLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of f.agences) {
      map[a.value] = a.label || f.labelForAgencyCode(a.value)
    }
    for (const code of agencyScope.agencyCodes) {
      map[code] = map[code] || f.labelForAgencyCode(code)
    }
    return map
  }, [agencyScope.agencyCodes, f, f.agences])

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
      const list = await searchChargeEpargne(
        {
          dateDebut,
          dateFin,
          codeDir: agencyScope.direction,
          agencyCodes: agencyScope.agencyCodes,
          direction: agencyScope.direction,
        },
        agencyLabels,
      )
      setRows(list)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : "Impossible de charger les charges d'épargne")
    } finally {
      setIsLoading(false)
    }
  }, [agencyLabels, agencyScope, dateDebut, dateFin, f.isAgencesByDirectionLoading])

  const filteredSorted = useMemo(() => {
    let out = rows
    const q = columnFilter.trim().toLowerCase()
    if (q) {
      out = out.filter((r) =>
        COLUMNS.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)),
      )
    }
    const agenceQ = nomAgenceFilter.trim().toLowerCase()
    if (agenceQ) out = out.filter((r) => r.nomAgence.toLowerCase().includes(agenceQ))
    const dateQ = datePaieFilter.trim().toLowerCase()
    if (dateQ) {
      out = out.filter(
        (r) =>
          r.datePaie.toLowerCase().includes(dateQ) ||
          formatDateDisplay(r.datePaie).toLowerCase().includes(dateQ),
      )
    }
    const txQ = transactionsFilter.trim()
    if (txQ) out = out.filter((r) => String(r.totalTransactions).includes(txQ))
    const montantQ = montantFilter.trim().replace(/\s/g, '')
    if (montantQ) out = out.filter((r) => String(r.totalMontant).includes(montantQ))

    if (!sortKey) return out
    const dir = sortDir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (sortKey === 'totalTransactions' || sortKey === 'totalMontant') {
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
    nomAgenceFilter,
    datePaieFilter,
    transactionsFilter,
    montantFilter,
    sortKey,
    sortDir,
  ])
  const tablePg = useTablePagination(filteredSorted)

  const montantTotal = useMemo(
    () => filteredSorted.reduce((acc, r) => acc + r.totalMontant, 0),
    [filteredSorted],
  )

  const totalTransactions = useMemo(
    () => filteredSorted.reduce((acc, r) => acc + r.totalTransactions, 0),
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
      'charge_epargne',
      "Charge d'épargne",
      filteredSorted.map((r) => ({
        'NOM AGENCE': r.nomAgence,
        'DATE PAIE': formatDateDisplay(r.datePaie),
        'TOTAL TRANSACTIONS': r.totalTransactions,
        "CHARGE D'EPARGNE": r.totalMontant,
      })),
    )
  }

  function exportPdf() {
    exportTableToPdf(
      "Charge d'épargne",
      'charge_epargne',
      COLUMNS.map((c) => c.label),
      filteredSorted.map((r) => [
        r.nomAgence,
        formatDateDisplay(r.datePaie),
        String(r.totalTransactions),
        formatMontant(r.totalMontant),
      ]),
    )
  }

  return (
    <DashboardTablePageLayout
      title="Charge d'épargne"
      cardTitle="Charge d'épargne"
      cardDescription="Période et charges d'épargne par agence et date de paiement."
      alerts={
        error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null
      }
      toolbar={
        <>
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
            <TableExportButtons
              className="ml-auto"
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
              <Label className="shrink-0 text-xs text-muted-foreground">Total transactions :</Label>
              <Input
                readOnly
                className="h-8 w-[100px] text-center text-xs tabular-nums"
                value={String(totalTransactions)}
              />
            </div>
            <div className="flex min-w-[240px] flex-1 items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">Montant total :</Label>
              <Input readOnly className="h-8 text-xs tabular-nums" value={formatMontant(montantTotal)} />
            </div>
            <div className="text-xs text-muted-foreground">{filteredSorted.length} ligne(s)</div>
          </div>
        ) : null
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
        <table className="min-w-[800px] w-full border-collapse text-xs">
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
                        col.key === 'nomAgence'
                          ? nomAgenceFilter
                          : col.key === 'datePaie'
                            ? datePaieFilter
                            : col.key === 'totalTransactions'
                              ? transactionsFilter
                              : montantFilter
                      }
                      onChange={(value) => {
                        if (col.key === 'nomAgence') setNomAgenceFilter(value)
                        else if (col.key === 'datePaie') setDatePaieFilter(value)
                        else if (col.key === 'totalTransactions') setTransactionsFilter(value)
                        else setMontantFilter(value)
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
                    <td className={`${TABLE_TD_CLASS} max-w-[240px] truncate`}>{r.nomAgence}</td>
                    <td className={TABLE_TD_CLASS}>{formatDateDisplay(r.datePaie)}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{r.totalTransactions}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.totalMontant)}
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
