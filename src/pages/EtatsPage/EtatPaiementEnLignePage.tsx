import { useCallback, useMemo, useState } from 'react'
import {
  DirectionAgenceFilterButton,
  DirectionAgenceFilterSheet,
} from '@/components/DirectionAgenceFilterSheet'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { TablePaginationBar } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  searchEtatPaiementEnLigne,
  type EtatPaiementEnLigneRow,
} from '@/services/etat-paiement-en-ligne'
import { useDirectionAgenceFilters } from '@/hooks/use-direction-agence-filters'
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
import { useTablePagination } from '@/hooks/use-table-pagination'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

type SortKey = keyof EtatPaiementEnLigneRow

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right' }[] = [
  { key: 'refOperation', label: 'Ref Opération' },
  { key: 'date', label: 'date' },
  { key: 'nomAgence', label: 'NOM_AGENCE' },
  { key: 'montant', label: 'MONTANT', align: 'right' },
  { key: 'nomClient', label: 'NOM_CLIENT' },
  { key: 'numAbonnemn', label: 'NUMABONNEMN' },
  { key: 'montantColl', label: 'MONTANT_COLL', align: 'right' },
  { key: 'collectrice', label: 'Collectrice' },
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
  if (n === undefined || !Number.isFinite(n)) return ''
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}

export function EtatPaiementEnLignePage() {
  const orgFilters = useDirectionAgenceFilters({ onScopeChange: () => setRows([]) })

  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<EtatPaiementEnLigneRow[]>([])
  const [champSaisie, setChampSaisie] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agencyLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [code, labels] of Object.entries(orgFilters.agencyLabels)) {
      map[code] = labels.agence
    }
    return map
  }, [orgFilters.agencyLabels])

  const loadList = useCallback(async () => {
    const scopeError = orgFilters.getScopeError()
    if (scopeError) {
      setError(scopeError)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const list = await searchEtatPaiementEnLigne(
        {
          dateDebut,
          dateFin,
          codeAgence: orgFilters.agenceCode,
          codeDir: orgFilters.codeDir,
        },
        agencyLabels,
      )
      setRows(list)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger l’état paiement en ligne')
    } finally {
      setIsLoading(false)
    }
  }, [agencyLabels, dateDebut, dateFin, orgFilters])

  const filteredSorted = useMemo(() => {
    let out = rows
    const q = champSaisie.trim().toLowerCase()
    if (q) {
      out = out.filter((r) =>
        COLUMNS.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)),
      )
    }

    if (!sortKey) return out
    const dir = sortDir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (sortKey === 'montant' || sortKey === 'montantColl') {
        return (((av as number | undefined) ?? 0) - ((bv as number | undefined) ?? 0)) * dir
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'fr', {
        sensitivity: 'base',
        numeric: true,
      }) * dir
    })
  }, [rows, champSaisie, sortKey, sortDir])
  const tablePg = useTablePagination(filteredSorted)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function exportXls() {
    exportJsonToXlsx(
      'etat_paiement_en_ligne',
      'Paiement en ligne',
      filteredSorted.map((r) => ({
        'Ref Opération': r.refOperation,
        date: formatDateDisplay(r.date),
        NOM_AGENCE: r.nomAgence,
        MONTANT: r.montant ?? '',
        NOM_CLIENT: r.nomClient,
        NUMABONNEMN: r.numAbonnemn,
        MONTANT_COLL: r.montantColl ?? '',
        Collectrice: r.collectrice,
      })),
    )
  }

  function exportPdf() {
    exportTableToPdf(
      'État paiement en ligne',
      'etat_paiement_en_ligne',
      COLUMNS.map((c) => c.label),
      filteredSorted.map((r) => [
        r.refOperation,
        formatDateDisplay(r.date),
        r.nomAgence,
        formatMontant(r.montant),
        r.nomClient,
        r.numAbonnemn,
        formatMontant(r.montantColl),
        r.collectrice,
      ]),
    )
  }

  return (
    <>
    <DashboardTablePageLayout
      title="État paiement en ligne"
      cardTitle="Paiements en ligne"
      cardDescription="Période, export et détail des opérations de paiement en ligne."
      alerts={
        error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null
      }
      toolbar={
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
      }
      footer={
        <div className="flex min-w-[280px] items-center gap-2">
          <Label className="shrink-0 text-xs text-muted-foreground">Champ de saisie</Label>
          <Input
            className="h-8 max-w-[280px] text-xs"
            value={champSaisie}
            onChange={(e) => setChampSaisie(e.target.value)}
            placeholder="Filtrer les lignes…"
          />
        </div>
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
        <table className="min-w-[1100px] w-full border-collapse text-xs">
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
          </thead>
          <tbody className={TABLE_TBODY_CLASS}>
            {isLoading ? (
              <tr>
                <td colSpan={8} className={TABLE_EMPTY_CELL_CLASS}>
                  Chargement…
                </td>
              </tr>
            ) : null}
            {!isLoading && !filteredSorted.length ? (
              <tr>
                <td colSpan={8} className={TABLE_EMPTY_CELL_CLASS}>
                  Choisissez la période puis cliquez sur EXECUTER.
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? tablePg.pageItems.map((r) => (
                  <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                    <td className={`${TABLE_TD_CLASS} max-w-[120px] truncate`}>
                      {r.refOperation || '—'}
                    </td>
                    <td className={TABLE_TD_CLASS}>{formatDateDisplay(r.date)}</td>
                    <td className={`${TABLE_TD_CLASS} max-w-[140px] truncate`}>
                      {r.nomAgence || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.montant) || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>
                      {r.nomClient || '—'}
                    </td>
                    <td className={TABLE_TD_MONO_CLASS}>{r.numAbonnemn || '—'}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.montantColl) || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} max-w-[140px] truncate`}>
                      {r.collectrice || '—'}
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
