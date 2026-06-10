import { useCallback, useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import { TablePaginationBar } from '@/components/TablePagination'
import { TableExportButtons } from '@/components/TableExportButtons'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  listExtractionCartesAReverser,
  type ExtractionCarteRow,
} from '@/services/extraction-carte'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_MONO_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'
import { downloadTextFile, tableToDelimitedText } from '@/utils/txt-download'

type SortKey = keyof ExtractionCarteRow

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'collecte', label: 'COLLECTE' },
  { key: 'les', label: 'LES' },
  { key: 'lesN', label: 'LES N' },
  { key: 'lce', label: 'LCE' },
  { key: 'lceN', label: 'LCE N' },
  { key: 'date', label: 'DATE' },
  { key: 'montant', label: 'MONTANT' },
  { key: 'commission', label: 'COMMISSION' },
  { key: 'produit', label: 'PRODUIT' },
  { key: 'client', label: 'CLIENT' },
  { key: 'adhesion', label: 'ADHESION' },
  { key: 'partSociale', label: 'PART SOCIALE' },
  { key: 'droits', label: 'DROITS' },
  { key: 'frais', label: 'FRAIS' },
  { key: 'collecteurs', label: 'COLLECTEURS' },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function rowToArray(r: ExtractionCarteRow): string[] {
  return COLUMNS.map((c) => r[c.key] ?? '')
}

export function ExtractionCartesAReverserPage() {
  const f = useDashboardFilters()

  const [dateDebut, setDateDebut] = useState(todayIso)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<ExtractionCarteRow[]>([])
  const [columnFilter, setColumnFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agence = useMemo(() => {
    const a = f.agency !== 'Toutes' ? f.agency.trim() : ''
    return a || getConnectedUserCodeAgence()
  }, [f.agency])

  const loadList = useCallback(async () => {
    if (!agence) {
      setError('Sélectionnez une agence dans les filtres du tableau de bord.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const list = await listExtractionCartesAReverser({ agence, dateDebut, dateFin })
      setRows(list)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger l’extraction')
    } finally {
      setIsLoading(false)
    }
  }, [agence, dateDebut, dateFin])

  const filteredSorted = useMemo(() => {
    let out = rows
    const q = columnFilter.trim().toLowerCase()
    if (q) {
      out = out.filter((r) =>
        Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)),
      )
    }
    if (!sortKey) return out
    const dir = sortDir === 'asc' ? 1 : -1
    return [...out].sort((a, b) =>
      String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'fr', {
        sensitivity: 'base',
        numeric: true,
      }) * dir,
    )
  }, [rows, columnFilter, sortKey, sortDir])
  const tablePg = useTablePagination(filteredSorted)

  const headers = useMemo(() => COLUMNS.map((c) => c.label), [])
  const bodyRows = useMemo(() => filteredSorted.map(rowToArray), [filteredSorted])

  const datedName = `extraction_cartes_a_reverser_${new Date().toISOString().slice(0, 10)}`

  function exportTxt(ibank: boolean) {
    if (!bodyRows.length) return
    const sep = ibank ? ';' : '\t'
    const content = tableToDelimitedText(headers, bodyRows, sep, { includeHeader: !ibank })
    downloadTextFile(`${datedName}${ibank ? '_ibank' : ''}.txt`, content)
  }

  function exportXls() {
    if (!filteredSorted.length) return
    const data = filteredSorted.map((r) => {
      const o: Record<string, string> = {}
      for (const c of COLUMNS) o[c.label] = r[c.key] ?? ''
      return o
    })
    exportJsonToXlsx(datedName, 'Extraction', data)
  }

  function exportPdf() {
    if (!bodyRows.length) return
    exportTableToPdf('Extraction des cartes à reverser', datedName, headers, bodyRows)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <DashboardTablePageLayout
      title="Extraction des cartes à reverser"
      cardTitle="Cartes à reverser"
      cardDescription="Période, prévisualisation et export TXT, Excel ou PDF."
      alerts={
        error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null
      }
      toolbar={
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 min-w-[110px] border-primary text-primary hover:bg-primary/10"
                disabled={isLoading}
                onClick={() => void loadList()}
              >
                {isLoading ? 'Chargement…' : 'EXECUTER'}
              </Button>
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
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-primary/60 text-primary"
                disabled={!bodyRows.length}
                onClick={() => exportTxt(false)}
              >
                TXT
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-primary/60 text-primary"
                disabled={!bodyRows.length}
                onClick={() => exportTxt(true)}
              >
                TXT IBANK
              </Button>
              <TableExportButtons
                disabled={!bodyRows.length}
                onExportXls={exportXls}
                onExportPdf={exportPdf}
              />
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
        rows.length > 0 && !isLoading ? (
          <div className="text-xs text-muted-foreground">{filteredSorted.length} ligne(s)</div>
        ) : null
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="min-w-[1500px] w-full border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                {COLUMNS.map((col) => (
                  <SortableTh
                    key={col.key}
                    label={col.label}
                    active={sortKey === col.key}
                    dir={sortDir}
                    onSort={() => toggleSort(col.key)}
                  />
                ))}
              </tr>
            </thead>
            <tbody className={TABLE_TBODY_CLASS}>
              {isLoading ? (
                <tr>
                  <td colSpan={15} className={TABLE_EMPTY_CELL_CLASS}>
                    Chargement…
                  </td>
                </tr>
              ) : null}
              {!isLoading && !filteredSorted.length ? (
                <tr>
                  <td colSpan={15} className={TABLE_EMPTY_CELL_CLASS}>
                    Cliquez sur EXECUTER pour charger les cartes à reverser.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r, idx) => (
                    <tr key={`${r.adhesion}-${idx}`} className={TABLE_ROW_CLASS}>
                      {COLUMNS.map((col) => (
                        <td key={col.key} className={`${TABLE_TD_MONO_CLASS} max-w-[160px] truncate`}>
                          {r[col.key] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
      </div>
    </DashboardTablePageLayout>
  )
}
