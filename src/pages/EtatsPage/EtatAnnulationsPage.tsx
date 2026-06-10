import { useCallback, useEffect, useMemo, useState } from 'react'
import { TablePaginationBar } from '@/components/TablePagination'
import { FilterChoiceField } from '@/components/FilterChoiceField'
import { Filter } from 'lucide-react'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import { listCollecteursParAgence } from '@/services/collecteur'
import { searchOperationsAnnulees } from '@/services/operation'
import type { Summary } from '@/services/openapi-components'
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
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import {
  collecteurLabelForCode,
  mapCollecteurSelectOptions,
  type CollecteurSelectOption,
} from '@/utils/collecteur-select-options'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'

const TOUS_COLLECTEUR = '__tous__'

type SortKey = 'date' | 'reference' | 'montant' | 'collecteur' | 'client' | 'motif' | 'carte'

type AnnulationRow = {
  rowKey: string
  date: string
  reference: string
  montant: number | undefined
  collecteur: string
  client: string
  motif: string
  carte: string
}

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right' }[] = [
  { key: 'date', label: 'DATE' },
  { key: 'reference', label: 'REFERENCE' },
  { key: 'montant', label: 'MONTANT', align: 'right' },
  { key: 'collecteur', label: 'LE COLLECTEUR' },
  { key: 'client', label: 'NOM ET PRENOMS DU CLIENT' },
  { key: 'motif', label: 'MOTIF' },
  { key: 'carte', label: 'N° Carte' },
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

function formatMontant(n: number | string | undefined): string {
  if (n === undefined || n === null || n === '') return '—'
  const num = typeof n === 'string' ? Number(n.replace(/\s/g, '').replace(',', '.')) : n
  if (!Number.isFinite(num)) return String(n)
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(num)
}

function mapAnnulationRow(row: Summary, idx: number, collecteurs: CollecteurSelectOption[]): AnnulationRow {
  const r = row as Summary & Record<string, unknown>
  const collecteurRaw = String(row.nomCollecteur ?? r.leCollecteur ?? r.collecteur ?? '').trim()
  const collecteur = collecteurRaw
    ? collecteurLabelForCode(collecteurRaw, collecteurs)
    : '—'
  const carte = String(row.numabonnement ?? r.numAbonnemnt ?? r.numeroCarte ?? '').trim()
  const reference = String(row.reference ?? '').trim()
  const montantNum =
    typeof row.montant === 'number' && Number.isFinite(row.montant)
      ? row.montant
      : Number(String(row.montant ?? '').replace(/\s/g, '').replace(',', '.'))
  return {
    rowKey: reference || carte || `annul-${idx}`,
    date: formatDateDisplay(row.date0peration),
    reference: reference || '—',
    montant: Number.isFinite(montantNum) ? montantNum : undefined,
    collecteur,
    client: String(row.nomClient ?? '').trim() || '—',
    motif: String(row.motif ?? '').trim() || '—',
    carte: carte || '—',
  }
}

export function EtatAnnulationsPage() {
  const f = useDashboardFilters()

  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(todayIso)
  const [collecteurId, setCollecteurId] = useState(TOUS_COLLECTEUR)
  const [collecteurs, setCollecteurs] = useState<CollecteurSelectOption[]>([])
  const [rows, setRows] = useState<AnnulationRow[]>([])
  const [columnFilter, setColumnFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isLoadingCollecteurs, setIsLoadingCollecteurs] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agence = useMemo(() => {
    const a = f.agency !== 'Toutes' ? f.agency.trim() : ''
    return a || getConnectedUserCodeAgence()
  }, [f.agency])

  const collecteurOptions = useMemo(
    () => [{ value: TOUS_COLLECTEUR, label: 'Tous' }, ...collecteurs],
    [collecteurs],
  )

  const loadCollecteurs = useCallback(async () => {
    if (!agence) {
      setError('Sélectionnez une agence dans les filtres du tableau de bord.')
      return
    }
    setIsLoadingCollecteurs(true)
    setError(null)
    try {
      const env = await listCollecteursParAgence(agence)
      setCollecteurs(mapCollecteurSelectOptions(extractListFromApiEnvelope(env)))
    } catch (err) {
      setCollecteurs([])
      setError(err instanceof Error ? err.message : 'Impossible de charger les collecteurs')
    } finally {
      setIsLoadingCollecteurs(false)
    }
  }, [agence])

  useEffect(() => {
    void loadCollecteurs()
  }, [loadCollecteurs])

  const loadList = useCallback(async () => {
    if (!agence) {
      setError('Sélectionnez une agence dans les filtres du tableau de bord.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const body = { codeAgence: agence, dateDebut, dateFin }
      const query =
        collecteurId !== TOUS_COLLECTEUR ? { collecteur: collecteurId } : undefined
      const env = await searchOperationsAnnulees(body, query)
      const list = Array.isArray(env.data) ? env.data : []
      setRows(list.map((r, idx) => mapAnnulationRow(r, idx, collecteurs)))
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger les annulations')
    } finally {
      setIsLoading(false)
    }
  }, [agence, collecteurId, collecteurs, dateDebut, dateFin])

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
      if (sortKey === 'montant') {
        const an = typeof av === 'number' ? av : 0
        const bn = typeof bv === 'number' ? bv : 0
        return (an - bn) * dir
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'fr', {
        sensitivity: 'base',
        numeric: true,
      }) * dir
    })
  }, [rows, columnFilter, sortKey, sortDir])
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
      title="États des annulations"
      cardTitle="Annulations"
      cardDescription="Période, collecteur et liste des opérations annulées."
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
          <FilterChoiceField
            label="Collecteur"
            name="etat-annulations-collecteur"
            value={collecteurId}
            onValueChange={setCollecteurId}
            options={collecteurOptions}
            disabled={isLoadingCollecteurs}
            placeholder={isLoadingCollecteurs ? 'Chargement…' : 'Choisir un collecteur'}
            variant="select"
          />
          <Button
            type="button"
            variant="outline"
            className="h-8 min-w-[90px] border-primary text-primary hover:bg-primary/10"
            disabled={isLoading}
            onClick={() => void loadList()}
          >
            {isLoading ? 'Chargement…' : 'Afficher'}
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
          <div className="text-xs text-muted-foreground">{filteredSorted.length} annulation(s)</div>
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
                  <td colSpan={7} className={TABLE_EMPTY_CELL_CLASS}>
                    Chargement…
                  </td>
                </tr>
              ) : null}
              {!isLoading && !filteredSorted.length ? (
                <tr>
                  <td colSpan={7} className={TABLE_EMPTY_CELL_CLASS}>
                    Choisissez la période puis cliquez sur Afficher.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r) => (
                    <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                      <td className={TABLE_TD_CLASS}>{r.date}</td>
                      <td className={`${TABLE_TD_CLASS} max-w-[140px] truncate`}>{r.reference}</td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                        {formatMontant(r.montant)}
                      </td>
                      <td className={`${TABLE_TD_CLASS} max-w-[180px] truncate`}>{r.collecteur}</td>
                      <td className={`${TABLE_TD_CLASS} max-w-[220px] truncate`}>{r.client}</td>
                      <td className={`${TABLE_TD_CLASS} max-w-[200px] truncate`}>{r.motif}</td>
                      <td className={TABLE_TD_MONO_CLASS}>{r.carte}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
      </div>
    </DashboardTablePageLayout>
  )
}
