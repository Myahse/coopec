import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Filter } from 'lucide-react'
import { TablePaginationBar } from '@/components/TablePagination'
import { TableExportButtons } from '@/components/TableExportButtons'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters, type DashboardFiltersContextValue } from '@/contexts/DashboardFiltersContext'
import { listExtractionTxt, type ExtractionTxtRow } from '@/services/extraction-txt'
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
import { downloadTextFile } from '@/utils/txt-download'

const LOAD_ENDPOINT = 'compensation-bm' as const
const IBANK_ENDPOINT = 'compensation-ibank' as const

function initialAgenceCode(f: DashboardFiltersContextValue): string {
  if (f.agency !== 'Toutes') return f.agency.trim()
  return getConnectedUserCodeAgence()
}

type SortKey = keyof ExtractionTxtRow

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'collecte', label: 'COLLECTE' },
  { key: 'les', label: 'LES' },
  { key: 'lce', label: 'LCE' },
  { key: 'date', label: 'DATE' },
  { key: 'montant', label: 'MONTANT' },
  { key: 'commission', label: 'COMMISSION' },
  { key: 'produit', label: 'PRODUIT' },
  { key: 'client', label: 'CLIENT' },
  { key: 'adhesion', label: 'ADHESION' },
  { key: 'partSociale', label: 'PART SOCIALE' },
  { key: 'droit', label: 'DROIT' },
  { key: 'frais', label: 'FRAIS' },
  { key: 'collecteur', label: 'COLLECTEUR' },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultDateDebut(): string {
  const y = new Date().getFullYear()
  return `${y}-01-01`
}

function searchBody(agence: string, dateDebut: string, dateFin: string) {
  return { agence, dateDebut, dateFin }
}

export function ExtractionTxtPage() {
  const f = useDashboardFilters()

  const [codeAgence, setCodeAgence] = useState(() => initialAgenceCode(f))
  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(todayIso)
  const [txtContent, setTxtContent] = useState('')
  const [txtFilename, setTxtFilename] = useState<string | undefined>()
  const [rows, setRows] = useState<ExtractionTxtRow[]>([])
  const [columnFilter, setColumnFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [isIbankExportPending, setIsIbankExportPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (f.agency !== 'Toutes') {
      setCodeAgence(f.agency.trim())
    }
  }, [f.agency])

  const agenceLabel = useMemo(() => {
    if (!codeAgence) return ''
    const hit = f.agences.find((a) => a.value === codeAgence)
    if (hit?.label && hit.label !== hit.value) return hit.label
    return f.labelForAgencyCode(codeAgence)
  }, [codeAgence, f])

  const loadList = useCallback(async () => {
    const agence = codeAgence.trim()
    if (!agence) {
      setError('Sélectionnez une agence (bouton Agence ci-dessus).')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await listExtractionTxt({
        ...searchBody(agence, dateDebut, dateFin),
        endpoint: LOAD_ENDPOINT,
      })
      const text = res.text.trim()
      setTxtContent(text)
      setTxtFilename(res.filename)
      setRows(res.rows)
      if (!text && !res.rows.length) {
        setError('Aucune donnée pour cette période.')
      }
    } catch (err) {
      setTxtContent('')
      setTxtFilename(undefined)
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger l’extraction TXT')
    } finally {
      setIsLoading(false)
    }
  }, [codeAgence, dateDebut, dateFin])

  const filteredSorted = useMemo(() => {
    let out = rows
    const q = columnFilter.trim().toLowerCase()
    if (q) {
      out = out.filter((r) =>
        COLUMNS.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)),
      )
    }
    if (!sortKey || sortKey === 'clefExtraction') return out
    const dir = sortDir === 'asc' ? 1 : -1
    return [...out].sort((a, b) =>
      String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'fr', {
        sensitivity: 'base',
        numeric: true,
      }) * dir,
    )
  }, [rows, columnFilter, sortKey, sortDir])
  const tablePg = useTablePagination(filteredSorted)

  const datedName = `extraction_txt_${new Date().toISOString().slice(0, 10)}`

  function exportTxtBm() {
    if (!txtContent.trim()) return
    downloadTextFile(txtFilename ?? `${datedName}_bm.txt`, txtContent)
  }

  function exportXls() {
    if (!filteredSorted.length) return
    const data = filteredSorted.map((r) => {
      const row: Record<string, string> = {}
      for (const c of COLUMNS) row[c.label] = String(r[c.key] ?? '')
      return row
    })
    exportJsonToXlsx('extraction_txt', 'Extraction TXT', data)
  }

  function exportPdf() {
    if (!filteredSorted.length) return
    const headers = COLUMNS.map((c) => c.label)
    const body = filteredSorted.map((r) => COLUMNS.map((c) => String(r[c.key] ?? '')))
    exportTableToPdf('Extraction des fichiers TXT', 'extraction_txt', headers, body)
  }

  async function exportTxtIbank() {
    const agence = codeAgence.trim()
    if (!agence) {
      setError('Sélectionnez une agence (bouton Agence ci-dessus).')
      return
    }
    setIsIbankExportPending(true)
    setError(null)
    try {
      const res = await listExtractionTxt({
        ...searchBody(agence, dateDebut, dateFin),
        endpoint: IBANK_ENDPOINT,
      })
      const text = res.text.trim()
      if (!text) {
        setError('Aucun contenu TXT IBANK pour la période sélectionnée.')
        return
      }
      downloadTextFile(res.filename ?? `${datedName}_ibank.txt`, text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export TXT IBANK impossible')
    } finally {
      setIsIbankExportPending(false)
    }
  }

  function toggleSort(key: SortKey) {
    if (key === 'clefExtraction') return
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <DashboardTablePageLayout
      title="Extraction des fichiers TXT"
      cardTitle="Extraction TXT"
      cardDescription="Agence, période, prévisualisation et export TXT, Excel ou PDF."
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
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">Agence</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-[200px] justify-between gap-2 border-primary px-2 text-xs text-primary hover:bg-primary/10"
                  disabled={f.direction !== 'Toutes' && f.isAgencesByDirectionLoading}
                  onClick={() => f.openFiltersDrawer('agency')}
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {codeAgence
                      ? agenceLabel && agenceLabel !== codeAgence
                        ? agenceLabel
                        : 'Agence sélectionnée'
                      : 'Choisir une agence'}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
                </Button>
              </div>
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
                className="h-8 min-w-[110px] border-primary text-primary hover:bg-primary/10"
                disabled={isLoading || !codeAgence.trim()}
                onClick={() => void loadList()}
              >
                {isLoading ? 'Chargement…' : 'EXECUTER'}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="h-8 min-w-[72px] bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!txtContent.trim()}
                onClick={exportTxtBm}
              >
                TXT
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 min-w-[96px] border-primary text-primary hover:bg-primary/10"
                disabled={isIbankExportPending || !codeAgence.trim()}
                onClick={() => void exportTxtIbank()}
              >
                {isIbankExportPending ? 'Export…' : 'TXT IBANK'}
              </Button>
              <TableExportButtons
                disabled={!filteredSorted.length}
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
          <div className="text-xs text-muted-foreground">
            {filteredSorted.length} ligne(s)
            {agenceLabel ? ` — ${agenceLabel}` : ''}
          </div>
        ) : null
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="min-w-[1400px] w-full border-collapse text-xs">
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
                  <td colSpan={13} className={TABLE_EMPTY_CELL_CLASS}>
                    Chargement…
                  </td>
                </tr>
              ) : null}
              {!isLoading && !filteredSorted.length ? (
                <tr>
                  <td colSpan={13} className={TABLE_EMPTY_CELL_CLASS}>
                    Choisissez l&apos;agence et la période, puis cliquez sur EXECUTER.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r, idx) => (
                    <tr key={`${r.adhesion}-${r.les}-${idx}`} className={TABLE_ROW_CLASS}>
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
