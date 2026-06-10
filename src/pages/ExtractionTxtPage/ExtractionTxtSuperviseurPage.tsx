import { useCallback, useEffect, useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import { FilterChoiceField } from '@/components/FilterChoiceField'
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
  listExtractionTxtSuperviseur,
  type ExtractionTxtSuperviseurRow,
} from '@/services/extraction-txt-superviseur'
import { repositionnerFichierHistorique } from '@/services/historique-comptable'
import { getTypesCollecte } from '@/services/param'
import type { WTypeCollect } from '@/services/openapi-components'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_MONO_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'
import {
  mapTypeCollecteSelectOptions,
  typeCollecteLabelForValue,
} from '@/utils/type-collecte-select-options'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'
import { downloadTextFile, tableToDelimitedText } from '@/utils/txt-download'

type SortKey = keyof ExtractionTxtSuperviseurRow

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

function rowToArray(r: ExtractionTxtSuperviseurRow): string[] {
  return COLUMNS.map((c) => (c.key === 'clefExtraction' ? '' : (r[c.key] ?? '')))
}

export function ExtractionTxtSuperviseurPage() {
  const f = useDashboardFilters()

  const [typesCollecte, setTypesCollecte] = useState<WTypeCollect[]>([])
  const [typeCollecteId, setTypeCollecteId] = useState('')
  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<ExtractionTxtSuperviseurRow[]>([])
  const [clefExtraction, setClefExtraction] = useState<string | undefined>()
  const [columnFilter, setColumnFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [isRepositionPending, setIsRepositionPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const agence = useMemo(() => {
    const a = f.agency !== 'Toutes' ? f.agency.trim() : ''
    return a || getConnectedUserCodeAgence()
  }, [f.agency])

  const typeCollecteOptions = useMemo(
    () => mapTypeCollecteSelectOptions(typesCollecte),
    [typesCollecte],
  )

  const selectedTypeCollecteLabel = useMemo(
    () => typeCollecteLabelForValue(typeCollecteId, typeCollecteOptions),
    [typeCollecteId, typeCollecteOptions],
  )

  const selectedType = useMemo(
    () => typesCollecte.find((t) => String(t.idTypeCollect ?? t.codeOper ?? '') === typeCollecteId),
    [typesCollecte, typeCollecteId],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const env = await getTypesCollecte()
        const list = extractListFromApiEnvelope(env) as WTypeCollect[]
        const active = list.filter((t) => t.etat === undefined || t.etat === 1)
        if (cancelled) return
        const usable = active.length ? active : list
        setTypesCollecte(usable)
        const options = mapTypeCollecteSelectOptions(usable)
        if (options.length) setTypeCollecteId(options[0].value)
      } catch {
        if (!cancelled) setTypesCollecte([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadList = useCallback(async () => {
    if (!agence) {
      setError('Sélectionnez une agence dans les filtres du tableau de bord.')
      return
    }
    if (!typeCollecteId) {
      setError('Sélectionnez un type de collecte.')
      return
    }
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await listExtractionTxtSuperviseur({
        agence,
        dateDebut,
        dateFin,
        idTypeCollect: typeCollecteId,
        codeOper: selectedType?.codeOper,
      })
      setRows(res.rows)
      const clef =
        res.clefExtraction ?? res.rows.find((r) => r.clefExtraction)?.clefExtraction
      setClefExtraction(clef)
    } catch (err) {
      setRows([])
      setClefExtraction(undefined)
      setError(err instanceof Error ? err.message : 'Impossible de charger l’extraction TXT')
    } finally {
      setIsLoading(false)
    }
  }, [agence, dateDebut, dateFin, typeCollecteId, selectedType?.codeOper])

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

  const headers = useMemo(() => COLUMNS.map((c) => c.label), [])
  const exportRows = useMemo(() => filteredSorted.map(rowToArray), [filteredSorted])

  const datedName = `extraction_txt_superviseur_${new Date().toISOString().slice(0, 10)}`

  function exportTxt() {
    if (!exportRows.length) return
    const content = tableToDelimitedText(headers, exportRows, '\t', { includeHeader: false })
    downloadTextFile(`${datedName}.txt`, content)
  }

  function exportXls() {
    if (!filteredSorted.length) return
    const data = filteredSorted.map((r) => {
      const row: Record<string, string> = {}
      for (const c of COLUMNS) row[c.label] = cellDisplay(c.key, r)
      return row
    })
    exportJsonToXlsx('extraction_txt_superviseur', 'Extraction superviseur', data)
  }

  function exportPdf() {
    if (!filteredSorted.length) return
    const body = filteredSorted.map((r) => COLUMNS.map((c) => cellDisplay(c.key, r)))
    exportTableToPdf(
      'Extraction des fichiers TXT superviseur',
      'extraction_txt_superviseur',
      headers,
      body,
    )
  }

  async function handleRepositionnerFichier() {
    const clef = clefExtraction ?? rows.find((r) => r.clefExtraction)?.clefExtraction
    if (!agence) {
      setError('Sélectionnez une agence dans les filtres du tableau de bord.')
      return
    }
    if (!clef) {
      setError('Aucune clef d’extraction — exécutez d’abord la recherche ou vérifiez la réponse API.')
      return
    }
    setIsRepositionPending(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await repositionnerFichierHistorique({ codeAgence: agence, clefExtraction: clef })
      setSuccess(res.message ?? 'Fichier repositionné.')
      await loadList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repositionnement fichier impossible')
    } finally {
      setIsRepositionPending(false)
    }
  }

  function cellDisplay(key: SortKey, row: ExtractionTxtSuperviseurRow): string {
    if (key === 'collecte') {
      const raw = String(row.collecte ?? '').trim()
      if (!raw) return '—'
      return typeCollecteLabelForValue(raw, typeCollecteOptions)
    }
    const v = row[key]
    return v ? String(v) : '—'
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
      title="Extraction des fichiers TXT superviseur"
      cardTitle="Extraction superviseur"
      cardDescription="Type de collecte, période, export TXT, Excel, PDF et repositionnement fichier."
      alerts={
        error || success ? (
          <>
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
          </>
        ) : null
      }
      toolbar={
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-wrap items-end gap-2">
            <FilterChoiceField
              label="Type de collecte"
              name="extraction-txt-sup-type-collecte"
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
              className="h-8 min-w-[110px] border-primary text-primary hover:bg-primary/10"
              disabled={isLoading}
              onClick={() => void loadList()}
            >
              {isLoading ? 'Chargement…' : 'EXECUTER'}
            </Button>

            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="h-8 min-w-[72px] bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!exportRows.length}
                onClick={exportTxt}
              >
                TXT
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-8 border-primary text-primary hover:bg-primary/10"
            disabled={isRepositionPending || !rows.length}
            onClick={() => void handleRepositionnerFichier()}
          >
            {isRepositionPending ? 'Repositionnement…' : 'Repositionner Fichier'}
          </Button>
        </div>
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
                    Choisissez le type de collecte et la période, puis cliquez sur EXECUTER.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r, idx) => (
                    <tr key={`${r.adhesion}-${r.les}-${idx}`} className={TABLE_ROW_CLASS}>
                      {COLUMNS.map((col) => (
                        <td key={col.key} className={`${TABLE_TD_MONO_CLASS} max-w-[160px] truncate`}>
                          {cellDisplay(col.key, r)}
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
