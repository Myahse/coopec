import { useCallback, useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { TablePaginationBar } from '@/components/TablePagination'
import { TableExportButtons } from '@/components/TableExportButtons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  searchValidationMensuelleCollecte,
  type ValidationMensuelleCollecteRow,
} from '@/services/validation-mensuelle-collecte'
import {
  TABLE_EMPTY_CELL_CLASS,
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
  ValidationMensuelleCollecteRow,
  | 'collecteur'
  | 'agence'
  | 'collecteFcfa'
  | 'collecteM1'
  | 'commissionRealisee'
  | 'commissionM1'
  | 'adhesionProspect'
  | 'carteVendu'
>

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right' }[] = [
  { key: 'collecteur', label: 'COLLECTEUR' },
  { key: 'agence', label: 'AGENCE' },
  { key: 'collecteFcfa', label: 'COLLECTE(FCFA)', align: 'right' },
  { key: 'collecteM1', label: 'COLLECTE M-1', align: 'right' },
  { key: 'commissionRealisee', label: 'COMMISION REALISEE', align: 'right' },
  { key: 'commissionM1', label: 'COMMISION M-1', align: 'right' },
  { key: 'adhesionProspect', label: 'ADHESSION PROSPECT', align: 'right' },
  { key: 'carteVendu', label: 'CARTE VENDU', align: 'right' },
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

export function ValidationMensuelleCollectePage() {
  const f = useDashboardFilters()

  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<ValidationMensuelleCollecteRow[]>([])
  const [columnFilter, setColumnFilter] = useState('')
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
      const list = await searchValidationMensuelleCollecte(
        {
          dateDebut,
          dateFin,
          codeAgence: agencyScope.codeAgence,
          agencyCodes: agencyScope.agencyCodes,
          direction: agencyScope.direction,
          institution: agencyScope.institution,
        },
        agencyLabels,
      )
      setRows(list)
    } catch (err) {
      setRows([])
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger la validation mensuelle des collectes',
      )
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
    if (!sortKey) return out
    const dir = sortDir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (
        sortKey === 'collecteFcfa' ||
        sortKey === 'collecteM1' ||
        sortKey === 'commissionRealisee' ||
        sortKey === 'commissionM1' ||
        sortKey === 'adhesionProspect' ||
        sortKey === 'carteVendu'
      ) {
        return ((av as number) - (bv as number)) * dir
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'fr', {
        sensitivity: 'base',
        numeric: true,
      }) * dir
    })
  }, [rows, columnFilter, sortKey, sortDir])
  const tablePg = useTablePagination(filteredSorted)

  const totals = useMemo(
    () => ({
      collecteFcfa: filteredSorted.reduce((acc, r) => acc + r.collecteFcfa, 0),
      collecteM1: filteredSorted.reduce((acc, r) => acc + r.collecteM1, 0),
      commissionRealisee: filteredSorted.reduce((acc, r) => acc + r.commissionRealisee, 0),
      commissionM1: filteredSorted.reduce((acc, r) => acc + r.commissionM1, 0),
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

  function exportXls() {
    exportJsonToXlsx(
      'validation_mensuelle_collecte',
      'Validation mensuelle',
      filteredSorted.map((r) => ({
        COLLECTEUR: r.collecteur,
        AGENCE: r.agence,
        'COLLECTE(FCFA)': r.collecteFcfa,
        'COLLECTE M-1': r.collecteM1,
        'COMMISION REALISEE': r.commissionRealisee,
        'COMMISION M-1': r.commissionM1,
        'ADHESSION PROSPECT': r.adhesionProspect,
        'CARTE VENDU': r.carteVendu,
      })),
    )
  }

  function exportPdf() {
    exportTableToPdf(
      'Validation mensuelles des données de collecte',
      'validation_mensuelle_collecte',
      COLUMNS.map((c) => c.label),
      filteredSorted.map((r) => [
        r.collecteur,
        r.agence,
        formatMontant(r.collecteFcfa),
        formatMontant(r.collecteM1),
        formatMontant(r.commissionRealisee),
        formatMontant(r.commissionM1),
        formatMontant(r.adhesionProspect),
        formatMontant(r.carteVendu),
      ]),
    )
  }

  return (
    <DashboardTablePageLayout
      title="Validation mensuelles des données de collecte"
      cardTitle="Validation mensuelle"
      cardDescription="Période, synthèse par collecteur et agence (collecte, commissions, adhésions, cartes)."
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
        filteredSorted.length > 0 ? (
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-[200px] flex-1 items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">Total collecte :</Label>
              <Input readOnly className="h-8 text-xs tabular-nums" value={formatMontant(totals.collecteFcfa)} />
            </div>
            <div className="flex min-w-[200px] flex-1 items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">Total collecte M-1 :</Label>
              <Input readOnly className="h-8 text-xs tabular-nums" value={formatMontant(totals.collecteM1)} />
            </div>
            <div className="flex min-w-[200px] flex-1 items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">Total commission :</Label>
              <Input
                readOnly
                className="h-8 text-xs tabular-nums"
                value={formatMontant(totals.commissionRealisee)}
              />
            </div>
            <div className="flex min-w-[200px] flex-1 items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">Total commission M-1 :</Label>
              <Input readOnly className="h-8 text-xs tabular-nums" value={formatMontant(totals.commissionM1)} />
            </div>
          </div>
        ) : null
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
                    <td className={`${TABLE_TD_CLASS} max-w-[180px] truncate`}>{r.collecteur}</td>
                    <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>{r.agence}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.collecteFcfa) || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.collecteM1) || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.commissionRealisee) || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.commissionM1) || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.adhesionProspect) || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.carteVendu) || '—'}
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
