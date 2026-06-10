import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Filter } from 'lucide-react'
import {
  DirectionAgenceFilterButton,
  DirectionAgenceFilterSheet,
} from '@/components/DirectionAgenceFilterSheet'
import { TablePaginationBar } from '@/components/TablePagination'
import { TableExportButtons } from '@/components/TableExportButtons'
import { FilterChoiceField } from '@/components/FilterChoiceField'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { searchClients } from '@/services/client'
import { listCollecteursParAgence } from '@/services/collecteur'
import { useDirectionAgenceFilters } from '@/hooks/use-direction-agence-filters'
import {
  searchEtatMontantsCollectes,
  type EtatMontantCollecteRow,
} from '@/services/etat-montants-collectes'
import { getTypesCollecte } from '@/services/param'
import type { WTypeCollect } from '@/services/openapi-components'
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
import { useTablePagination } from '@/hooks/use-table-pagination'
import {
  mapTypeCollecteSelectOptions,
  typeCollecteLabelForValue,
  type TypeCollecteSelectOption,
} from '@/utils/type-collecte-select-options'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

const TOUS = '__tous__'

type SortKey = keyof Pick<
  EtatMontantCollecteRow,
  | 'numEnreg'
  | 'datePaiem'
  | 'numAbonnement'
  | 'client'
  | 'collecteur'
  | 'typeCollecte'
  | 'reference'
  | 'mtContrat'
  | 'mtCollecte'
>

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right' }[] = [
  { key: 'numEnreg', label: 'N° ENREG' },
  { key: 'datePaiem', label: 'DATE PAIEM.' },
  { key: 'numAbonnement', label: 'N° ABONNEMENT' },
  { key: 'client', label: 'CLIENT' },
  { key: 'collecteur', label: 'COLLECTEUR' },
  { key: 'typeCollecte', label: 'TYPE COLLECTE' },
  { key: 'reference', label: 'REFERENCE' },
  { key: 'mtContrat', label: 'MT CONTRAT', align: 'right' },
  { key: 'mtCollecte', label: 'MT COLLECTE', align: 'right' },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
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

function decorateRow(
  row: EtatMontantCollecteRow,
  collecteurs: CollecteurSelectOption[],
  typeOptions: TypeCollecteSelectOption[],
): EtatMontantCollecteRow {
  const collecteur = row.collecteur
    ? collecteurLabelForCode(row.collecteur, collecteurs)
    : '—'
  const typeCollecte = row.typeCollecte
    ? typeCollecteLabelForValue(row.typeCollecte, typeOptions) || row.typeCollecte
    : '—'
  return {
    ...row,
    datePaiem: formatDateDisplay(row.datePaiem),
    collecteur,
    typeCollecte,
    numEnreg: row.numEnreg || '—',
    numAbonnement: row.numAbonnement || '—',
    client: row.client || '—',
    reference: row.reference || '—',
  }
}

export function EtatMontantsCollectesPage() {
  const navigate = useNavigate()
  const orgFilters = useDirectionAgenceFilters({
    onScopeChange: () => {
      setRows([])
      setCollecteurFilter(TOUS)
      setClientFilter(TOUS)
    },
  })

  const [dateDebut, setDateDebut] = useState(todayIso)
  const [dateFin, setDateFin] = useState(todayIso)
  const [collecteurFilter, setCollecteurFilter] = useState(TOUS)
  const [clientFilter, setClientFilter] = useState(TOUS)
  const [typeCollecteId, setTypeCollecteId] = useState('')
  const [typesCollecte, setTypesCollecte] = useState<WTypeCollect[]>([])

  const [collecteurs, setCollecteurs] = useState<CollecteurSelectOption[]>([])
  const [clientPickerItems, setClientPickerItems] = useState<{ value: string; label: string }[]>([])

  const [rows, setRows] = useState<EtatMontantCollecteRow[]>([])
  const [columnFilter, setColumnFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [isLoadingCollecteurs, setIsLoadingCollecteurs] = useState(false)
  const [isLoadingClients, setIsLoadingClients] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agence = orgFilters.agenceCode

  const typeCollecteOptions = useMemo(
    () => mapTypeCollecteSelectOptions(typesCollecte),
    [typesCollecte],
  )

  const collecteurOptions = useMemo(
    () => [{ value: TOUS, label: 'Tous' }, ...collecteurs],
    [collecteurs],
  )

  const clientOptions = useMemo(
    () => [{ value: TOUS, label: 'Tous' }, ...clientPickerItems],
    [clientPickerItems],
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
        const usable = active.length ? active : list
        if (cancelled) return
        setTypesCollecte(usable)
        if (usable.length) {
          const epargne = usable.find((t) =>
            String(t.libelle ?? '')
              .toUpperCase()
              .includes('EPARGNE'),
          )
          const pick = epargne ?? usable[0]
          setTypeCollecteId(String(pick.idTypeCollect ?? pick.codeOper ?? ''))
        }
      } catch {
        if (!cancelled) setTypesCollecte([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadCollecteurs = useCallback(async () => {
    if (!agence) return
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

  const loadClients = useCallback(async () => {
    if (!agence) return
    setIsLoadingClients(true)
    setError(null)
    try {
      const env = await searchClients({ codeAgence: agence, dateDebut, dateFin })
      const list = extractListFromApiEnvelope(env) as Record<string, unknown>[]
      const items = list.map((raw) => {
        const login = String(raw.loginclient ?? raw.login ?? '').trim()
        const code = String(raw.codeClient ?? raw.codeclt ?? login).trim()
        const nom = String(raw.nomclient ?? raw.nomClient ?? '').trim()
        const value = login || code
        const label = nom ? `${nom}${code ? ` (${code})` : ''}` : value || 'Client'
        return { value, label }
      })
      setClientPickerItems(items.filter((it) => it.value))
    } catch (err) {
      setClientPickerItems([])
      setError(err instanceof Error ? err.message : 'Impossible de charger les clients')
    } finally {
      setIsLoadingClients(false)
    }
  }, [agence, dateDebut, dateFin])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

  const loadList = useCallback(async () => {
    const scopeError = orgFilters.getScopeError()
    if (scopeError) {
      setError(scopeError)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const list = await searchEtatMontantsCollectes(
        { codeAgence: orgFilters.agenceCode, codeDir: orgFilters.codeDir, dateDebut, dateFin },
        {
          collecteur: collecteurFilter !== TOUS ? collecteurFilter : undefined,
          client: clientFilter !== TOUS ? clientFilter : undefined,
          carte: clientFilter !== TOUS ? clientFilter : undefined,
          idTypeCollect: typeCollecteId || undefined,
          codeOper: selectedType?.codeOper ? String(selectedType.codeOper) : undefined,
        },
      )
      setRows(list.map((r) => decorateRow(r, collecteurs, typeCollecteOptions)))
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger les montants collectés')
    } finally {
      setIsLoading(false)
    }
  }, [
    clientFilter,
    collecteurFilter,
    collecteurs,
    dateDebut,
    dateFin,
    orgFilters,
    selectedType?.codeOper,
    typeCollecteId,
    typeCollecteOptions,
  ])

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
      if (sortKey === 'mtContrat' || sortKey === 'mtCollecte') {
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

  const totalMtCollecte = useMemo(
    () =>
      filteredSorted.reduce((acc, r) => acc + (typeof r.mtCollecte === 'number' ? r.mtCollecte : 0), 0),
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
      'etat_montants_collectes',
      'Montants collectés',
      filteredSorted.map((r) => ({
        'N° ENREG': r.numEnreg,
        'DATE PAIEM.': r.datePaiem,
        'N° ABONNEMENT': r.numAbonnement,
        CLIENT: r.client,
        COLLECTEUR: r.collecteur,
        'TYPE COLLECTE': r.typeCollecte,
        REFERENCE: r.reference,
        'MT CONTRAT': r.mtContrat ?? '',
        'MT COLLECTE': r.mtCollecte ?? '',
      })),
    )
  }

  function exportPdf() {
    exportTableToPdf(
      'État des montants collectés',
      'etat_montants_collectes',
      COLUMNS.map((c) => c.label),
      filteredSorted.map((r) => [
        r.numEnreg,
        r.datePaiem,
        r.numAbonnement,
        r.client,
        r.collecteur,
        r.typeCollecte,
        r.reference,
        formatMontant(r.mtContrat),
        formatMontant(r.mtCollecte),
      ]),
    )
  }

  return (
    <>
    <DashboardTablePageLayout
      title="États des montants collectés"
      cardTitle="Montants collectés"
      cardDescription="Filtres, export et détail des montants collectés."
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
            <FilterChoiceField
              label="Collecteur"
              name="etat-montants-collecteur"
              value={collecteurFilter}
              onValueChange={setCollecteurFilter}
              options={collecteurOptions}
              disabled={isLoadingCollecteurs}
              placeholder={isLoadingCollecteurs ? 'Chargement…' : 'Choisir un collecteur'}
              variant="select"
            />
            <FilterChoiceField
              label="Client"
              name="etat-montants-client"
              value={clientFilter}
              onValueChange={setClientFilter}
              options={clientOptions}
              disabled={isLoadingClients}
              placeholder={isLoadingClients ? 'Chargement…' : 'Choisir un client'}
              variant="select"
            />
            <FilterChoiceField
              label="Type de collecte"
              name="etat-montants-type-collecte"
              value={typeCollecteId}
              onValueChange={setTypeCollecteId}
              options={typeCollecteOptions}
              variant="auto"
              triggerClassName="h-8 w-[200px] text-xs"
            />
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
            <Button
              type="button"
              variant="outline"
              className="h-8 border-primary text-primary hover:bg-primary/10"
              onClick={() => navigate('/dashboard/historique')}
            >
              COMPTABILITE CLIENT
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 border-primary text-primary hover:bg-primary/10"
              onClick={() => navigate('/dashboard/abonnements')}
            >
              ETAT ABONNEMENT
            </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <TableExportButtons
              disabled={!filteredSorted.length}
              onExportXls={exportXls}
              onExportPdf={exportPdf}
            />
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
        <div className="flex items-center justify-end gap-2">
          <Label className="text-xs text-muted-foreground">Total MT COLLECTE</Label>
          <Input
            readOnly
            className="h-8 w-[140px] text-right text-xs tabular-nums"
            value={formatMontant(totalMtCollecte)}
          />
        </div>
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="min-w-[1200px] w-full border-collapse text-xs">
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
                  <td colSpan={9} className={TABLE_EMPTY_CELL_CLASS}>
                    Chargement…
                  </td>
                </tr>
              ) : null}
              {!isLoading && !filteredSorted.length ? (
                <tr>
                  <td colSpan={9} className={TABLE_EMPTY_CELL_CLASS}>
                    Sélectionnez une direction, une agence et une période puis cliquez sur EXECUTER.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r) => (
                    <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                      <td className={TABLE_TD_MONO_CLASS}>{r.numEnreg}</td>
                      <td className={TABLE_TD_CLASS}>{r.datePaiem}</td>
                      <td className={TABLE_TD_MONO_CLASS}>{r.numAbonnement}</td>
                      <td className={`${TABLE_TD_CLASS} max-w-[200px] truncate`}>{r.client}</td>
                      <td className={`${TABLE_TD_CLASS} max-w-[180px] truncate`}>{r.collecteur}</td>
                      <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>{r.typeCollecte}</td>
                      <td className={`${TABLE_TD_CLASS} max-w-[140px] truncate`}>{r.reference}</td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                        {formatMontant(r.mtContrat)}
                      </td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                        {formatMontant(r.mtCollecte)}
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
