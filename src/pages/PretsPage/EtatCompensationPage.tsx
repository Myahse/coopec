import { useCallback, useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { TableColumnFilterInput } from '@/components/TableColumnFilterInput'
import { TablePaginationBar } from '@/components/TablePagination'
import { TableExportButtons } from '@/components/TableExportButtons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  searchEtatCompensation,
  type EtatCompensationRow,
} from '@/services/etat-compensation'
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

type SortKey = Exclude<keyof EtatCompensationRow, 'rowKey'>

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right'; filterable?: boolean }[] = [
  { key: 'coopecCreance', label: 'Coopec Créance', filterable: true },
  { key: 'agenceCreance', label: 'Agence Créance', filterable: true },
  { key: 'cumulMontantCollecte', label: 'Cumul Montant collecté', align: 'right', filterable: true },
  { key: 'coopecRecouvrement', label: 'Coopec Recouvrement', filterable: true },
  { key: 'agenceRecouvrement', label: 'Agence Recouvrement', filterable: true },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultDateDebut(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function formatMontant(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return ''
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}

function emptyColumnFilters(): Record<SortKey, string> {
  return {
    coopecCreance: '',
    agenceCreance: '',
    cumulMontantCollecte: '',
    coopecRecouvrement: '',
    agenceRecouvrement: '',
  }
}

export function EtatCompensationPage() {
  const f = useDashboardFilters()

  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<EtatCompensationRow[]>([])
  const [columnFilter, setColumnFilter] = useState('')
  const [headerFilters, setHeaderFilters] = useState(emptyColumnFilters)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agencyScope = useMemo(() => {
    const sessionAgence = getConnectedUserCodeAgence()
    const directionApi = f.direction !== 'Toutes' ? f.direction.trim() : undefined
    const institutionApi = f.institution !== 'Toutes' ? f.institution.trim() : undefined

    if (f.agency !== 'Toutes') {
      const code = f.agency.trim()
      return {
        codeAgence: code,
        agencyCodes: [code],
        direction: directionApi,
        institution: institutionApi,
      }
    }

    const codes = f.agences.map((a) => a.value).filter(Boolean)
    if (codes.length) {
      return {
        codeAgence: undefined,
        agencyCodes: codes,
        direction: directionApi,
        institution: institutionApi,
      }
    }

    return {
      codeAgence: sessionAgence || undefined,
      agencyCodes: sessionAgence ? [sessionAgence] : [],
      direction: directionApi,
      institution: institutionApi,
    }
  }, [f.agency, f.agences, f.direction, f.institution])

  const agencyLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of f.agences) {
      map[a.value] = a.label || f.labelForAgencyCode(a.value)
    }
    if (agencyScope.codeAgence) {
      map[agencyScope.codeAgence] = f.labelForAgencyCode(agencyScope.codeAgence)
    }
    return map
  }, [agencyScope.codeAgence, f, f.agences])

  const loadList = useCallback(async () => {
    if (!agencyScope.codeAgence && !agencyScope.agencyCodes.length) {
      setError('Sélectionnez une agence ou une direction dans les filtres du tableau de bord.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const list = await searchEtatCompensation(
        {
          dateDebut,
          dateFin,
          codeAgence: agencyScope.codeAgence ?? '',
          agencyCodes: agencyScope.agencyCodes,
          direction: agencyScope.direction,
          institution: agencyScope.institution,
        },
        agencyLabels,
      )
      setRows(list)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger l’état de compensation')
    } finally {
      setIsLoading(false)
    }
  }, [agencyLabels, agencyScope, dateDebut, dateFin])

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
        if (col.key === 'cumulMontantCollecte') {
          return String(val ?? '').replace(/\s/g, '').includes(fq)
        }
        return String(val ?? '').toLowerCase().includes(fq)
      })
    }

    if (!sortKey) return out
    const dir = sortDir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (sortKey === 'cumulMontantCollecte') {
        return (((av as number | undefined) ?? 0) - ((bv as number | undefined) ?? 0)) * dir
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'fr', {
        sensitivity: 'base',
        numeric: true,
      }) * dir
    })
  }, [rows, columnFilter, headerFilters, sortKey, sortDir])
  const tablePg = useTablePagination(filteredSorted)

  const totalMontantCollecte = useMemo(
    () =>
      filteredSorted.reduce(
        (acc, r) => acc + (typeof r.cumulMontantCollecte === 'number' ? r.cumulMontantCollecte : 0),
        0,
      ),
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
      'etat_compensation',
      'Compensation',
      filteredSorted.map((r) => ({
        'Coopec Créance': r.coopecCreance,
        'Agence Créance': r.agenceCreance,
        'Cumul Montant collecté': r.cumulMontantCollecte ?? '',
        'Coopec Recouvrement': r.coopecRecouvrement,
        'Agence Recouvrement': r.agenceRecouvrement,
      })),
    )
  }

  function exportPdf() {
    exportTableToPdf(
      'État de compensation',
      'etat_compensation',
      COLUMNS.map((c) => c.label),
      filteredSorted.map((r) => [
        r.coopecCreance,
        r.agenceCreance,
        formatMontant(r.cumulMontantCollecte),
        r.coopecRecouvrement,
        r.agenceRecouvrement,
      ]),
    )
  }

  return (
    <DashboardTablePageLayout
      title="État de compensation"
      cardTitle="Compensation"
      cardDescription="Cumul des montants collectés par coopec et agence de créance / recouvrement."
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
        <div className="flex min-w-[280px] items-center gap-2">
          <Label className="shrink-0 text-xs font-semibold text-foreground">Montant Collecté :</Label>
          <Input
            readOnly
            className="h-8 max-w-[200px] text-xs tabular-nums"
            value={formatMontant(totalMontantCollecte)}
          />
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
                <td colSpan={5} className={TABLE_EMPTY_CELL_CLASS}>
                  Chargement…
                </td>
              </tr>
            ) : null}
            {!isLoading && !filteredSorted.length ? (
              <tr>
                <td colSpan={5} className={TABLE_EMPTY_CELL_CLASS}>
                  Choisissez la période puis cliquez sur EXECUTER.
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? tablePg.pageItems.map((r) => (
                  <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                    <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>{r.coopecCreance || '—'}</td>
                    <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>{r.agenceCreance || '—'}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.cumulMontantCollecte) || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>
                      {r.coopecRecouvrement || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>
                      {r.agenceRecouvrement || '—'}
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
