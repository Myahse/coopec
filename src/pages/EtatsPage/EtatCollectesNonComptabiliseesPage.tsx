import { useCallback, useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { TableColumnFilterInput } from '@/components/TableColumnFilterInput'
import { TablePaginationBar } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  searchCollectesNonComptabilisees,
  type CollecteNonComptabiliseeRow,
} from '@/services/etat-collectes-non-comptabilisees'
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

type SortKey = keyof Pick<
  CollecteNonComptabiliseeRow,
  'nomAgence' | 'count' | 'montantCollecte' | 'datePaie' | 'montantArrete' | 'montantExtrait'
>

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right'; filterable?: boolean }[] = [
  { key: 'nomAgence', label: 'NOM AGENCE', filterable: true },
  { key: 'datePaie', label: 'DATE PAIE', filterable: true },
  { key: 'count', label: 'TOTAL TRANSACTIONS', align: 'right', filterable: true },
  { key: 'montantCollecte', label: 'TOTAL MONTANT', align: 'right', filterable: true },
  { key: 'montantArrete', label: 'MONTANT ARRETE', align: 'right' },
  { key: 'montantExtrait', label: 'MONTANT EXTRAIT', align: 'right' },
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

export function EtatCollectesNonComptabiliseesPage() {
  const f = useDashboardFilters()

  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<CollecteNonComptabiliseeRow[]>([])
  const [columnFilter, setColumnFilter] = useState('')
  const [nomAgenceFilter, setNomAgenceFilter] = useState('')
  const [datePaieFilter, setDatePaieFilter] = useState('')
  const [countFilter, setCountFilter] = useState('')
  const [montantCollecteFilter, setMontantCollecteFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agencyScope = useMemo(() => {
    const sessionAgence = getConnectedUserCodeAgence()
    const directionApi = f.direction !== 'Toutes' ? f.direction.trim() : undefined
    const institutionApi = f.institution !== 'Toutes' ? f.institution.trim() : undefined
    const allScopedAgencies = f.agences.map((a) => a.value).filter(Boolean)

    if (f.agency !== 'Toutes') {
      const code = f.agency.trim()
      return {
        agencyCodes: [code],
        direction: directionApi,
        institution: institutionApi,
      }
    }

    if (directionApi && allScopedAgencies.length) {
      return {
        agencyCodes: allScopedAgencies,
        direction: directionApi,
        institution: institutionApi,
      }
    }

    if (allScopedAgencies.length) {
      return {
        agencyCodes: allScopedAgencies,
        direction: directionApi,
        institution: institutionApi,
      }
    }

    return {
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
      const list = await searchCollectesNonComptabilisees(
        {
          dateDebut,
          dateFin,
          codeDir: agencyScope.direction,
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
        err instanceof Error ? err.message : 'Impossible de charger les collectes non comptabilisées',
      )
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
    if (agenceQ) {
      out = out.filter((r) => r.nomAgence.toLowerCase().includes(agenceQ))
    }
    const dateQ = datePaieFilter.trim().toLowerCase()
    if (dateQ) {
      out = out.filter(
        (r) =>
          r.datePaie.toLowerCase().includes(dateQ) ||
          formatDateDisplay(r.datePaie).toLowerCase().includes(dateQ),
      )
    }
    const countQ = countFilter.trim()
    if (countQ) {
      out = out.filter((r) => String(r.count).includes(countQ))
    }
    const montantQ = montantCollecteFilter.trim().replace(/\s/g, '')
    if (montantQ) {
      out = out.filter((r) => String(r.montantCollecte).includes(montantQ))
    }
    if (!sortKey) return out
    const dir = sortDir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (sortKey === 'count' || sortKey === 'montantCollecte' || sortKey === 'montantArrete' || sortKey === 'montantExtrait') {
        const an = typeof av === 'number' ? av : 0
        const bn = typeof bv === 'number' ? bv : 0
        return (an - bn) * dir
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'fr', {
        sensitivity: 'base',
        numeric: true,
      }) * dir
    })
  }, [rows, columnFilter, nomAgenceFilter, datePaieFilter, countFilter, montantCollecteFilter, sortKey, sortDir])
  const tablePg = useTablePagination(filteredSorted)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <DashboardTablePageLayout
      title="États des collectes non comptabilisées"
      cardTitle="Collectes non comptabilisées"
      cardDescription="Période et liste des collectes non comptabilisées par agence."
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
          <table className="min-w-[1000px] w-full border-collapse text-xs">
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
                              : col.key === 'count'
                                ? countFilter
                                : montantCollecteFilter
                        }
                        onChange={(value) => {
                          if (col.key === 'nomAgence') setNomAgenceFilter(value)
                          else if (col.key === 'datePaie') setDatePaieFilter(value)
                          else if (col.key === 'count') setCountFilter(value)
                          else setMontantCollecteFilter(value)
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
                  <td colSpan={6} className={TABLE_EMPTY_CELL_CLASS}>
                    Chargement…
                  </td>
                </tr>
              ) : null}
              {!isLoading && !filteredSorted.length ? (
                <tr>
                  <td colSpan={6} className={TABLE_EMPTY_CELL_CLASS}>
                    Choisissez la période puis cliquez sur EXECUTER.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r) => (
                    <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                      <td className={`${TABLE_TD_CLASS} max-w-[240px] truncate`}>{r.nomAgence}</td>
                      <td className={TABLE_TD_CLASS}>{formatDateDisplay(r.datePaie)}</td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{r.count}</td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                        {formatMontant(r.montantCollecte)}
                      </td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                        {formatMontant(r.montantArrete)}
                      </td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                        {formatMontant(r.montantExtrait)}
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
