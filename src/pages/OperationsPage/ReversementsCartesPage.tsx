import { useCallback, useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import {
  DirectionAgenceFilterButton,
  DirectionAgenceFilterSheet,
} from '@/components/DirectionAgenceFilterSheet'
import { TablePaginationBar } from '@/components/TablePagination'
import { SortableTh } from '@/components/SortableTh'
import { FilterChoiceField } from '@/components/FilterChoiceField'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { WAbonnement as Abonnement } from '@/services/openapi-components'
import { listReversementCarte, reversementCarte } from '@/services/operation'
import { useDirectionAgenceFilters } from '@/hooks/use-direction-agence-filters'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_ACTIVE_CLASS,
  TABLE_ROW_SELECTABLE_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_CLASS,
  TABLE_TD_MONO_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { getConnectedUserLogin } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

type CarteFilter = 'PLEINES' | 'SUSPENDUES_AUTO'

type SortKey =
  | 'carte'
  | 'nomClient'
  | 'codeAgence'
  | 'dateAbonnement'
  | 'gsm'
  | 'compteLce'
  | 'compteLes'
  | 'montant'

type Row = Abonnement & { rowKey: string; numeroCarte: string }

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function statusToken(filter: CarteFilter): string {
  return filter === 'PLEINES' ? 'pleine' : 'suspendue_auto'
}

function formatDate(iso: string | undefined): string {
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

function numeroCarteFrom(row: Abonnement): string {
  return String(row.numabonnemntTemp ?? row.idwAbonnement ?? row.numeroCompte ?? '').trim()
}

function rowKeyFrom(row: Abonnement, idx: number): string {
  return numeroCarteFrom(row) || `row-${idx}`
}

function mapRows(list: Abonnement[]): Row[] {
  return list.map((r, idx) => ({
    ...r,
    rowKey: rowKeyFrom(r, idx),
    numeroCarte: numeroCarteFrom(r),
  }))
}

function motifFor(filter: CarteFilter): string {
  return filter === 'PLEINES' ? 'Reversement carte pleine' : 'Reversement carte suspendue auto'
}

export function ReversementsCartesPage() {
  const orgFilters = useDirectionAgenceFilters({
    onScopeChange: () => {
      setRows([])
      setSelected(new Set())
    },
  })

  const [carteFilter, setCarteFilter] = useState<CarteFilter>('PLEINES')
  const [dateDebut, setDateDebut] = useState(todayIso)
  const [dateFin, setDateFin] = useState(todayIso)

  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [columnFilter, setColumnFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const login = useMemo(() => getConnectedUserLogin(), [])

  const loadList = useCallback(async () => {
    const scopeError = orgFilters.getScopeError()
    if (scopeError) {
      setError(scopeError)
      return
    }
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setSelected(new Set())
    try {
      const env = await listReversementCarte({
        agence: orgFilters.agenceCode,
        status: statusToken(carteFilter),
        dateDebut,
        dateFin,
      })
      const list = extractListFromApiEnvelope(env) as Abonnement[]
      setRows(mapRows(list))
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger les cartes')
    } finally {
      setIsLoading(false)
    }
  }, [carteFilter, dateDebut, dateFin, orgFilters])

  const filteredSorted = useMemo(() => {
    let out = rows
    const q = columnFilter.trim().toLowerCase()
    if (q) {
      out = out.filter((r) =>
        [
          r.numeroCarte,
          r.nomClient,
          r.codeAgence,
          r.gsmprincipale,
          r.compteLce,
          r.compteLes,
          formatMontant(r.montantCollect),
        ].some((v) => String(v ?? '').toLowerCase().includes(q)),
      )
    }
    if (!sortKey) return out
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (r: Row): string | number => {
      switch (sortKey) {
        case 'carte':
          return r.numeroCarte
        case 'nomClient':
          return String(r.nomClient ?? '')
        case 'codeAgence':
          return String(r.codeAgence ?? '')
        case 'dateAbonnement':
          return String(r.dateAbonnement ?? '')
        case 'gsm':
          return String(r.gsmprincipale ?? '')
        case 'compteLce':
          return String(r.compteLce ?? '')
        case 'compteLes':
          return String(r.compteLes ?? '')
        case 'montant':
          return typeof r.montantCollect === 'number' ? r.montantCollect : 0
      }
    }
    return [...out].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base' }) * dir
    })
  }, [rows, columnFilter, sortKey, sortDir])
  const tablePg = useTablePagination(filteredSorted)

  const allVisibleSelected =
    filteredSorted.length > 0 && filteredSorted.every((r) => selected.has(r.rowKey))

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const r of filteredSorted) next.delete(r.rowKey)
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const r of filteredSorted) next.add(r.rowKey)
        return next
      })
    }
  }

  async function runTraitement(targetRows: Row[]) {
    if (!login) {
      setError('Session utilisateur introuvable (login).')
      return
    }
    if (!targetRows.length) {
      setError('Sélectionnez au moins une carte.')
      return
    }
    setIsProcessing(true)
    setError(null)
    setSuccess(null)
    const motif = motifFor(carteFilter)
    let ok = 0
    const failures: string[] = []
    for (const row of targetRows) {
      const numero = row.numeroCarte
      if (!numero) {
        failures.push('Ligne sans numéro de carte')
        continue
      }
      try {
        await reversementCarte(numero, { motif, login })
        ok += 1
      } catch (err) {
        failures.push(
          `${numero}: ${err instanceof Error ? err.message : 'échec'}`,
        )
      }
    }
    if (ok > 0) {
      setSuccess(`${ok} reversement(s) effectué(s).`)
      await loadList()
    }
    if (failures.length) {
      setError(failures.slice(0, 3).join(' · ') + (failures.length > 3 ? '…' : ''))
    }
    setIsProcessing(false)
  }

  async function handleTraitement() {
    const targets =
      selected.size > 0
        ? filteredSorted.filter((r) => selected.has(r.rowKey))
        : filteredSorted
    await runTraitement(targets)
  }

  const exportFilenameBase = `reversements_cartes_${carteFilter.toLowerCase()}`

  function exportReversementsXls() {
    if (!filteredSorted.length) return
    exportJsonToXlsx(
      exportFilenameBase,
      'Reversements',
      filteredSorted.map((r) => ({
        'N° Carte': r.numeroCarte,
        'Nom client': r.nomClient ?? '',
        'Code agence': r.codeAgence ?? '',
        'Date abonnement': formatDate(r.dateAbonnement),
        'GSM client': r.gsmprincipale ?? '',
        'Compte LCE': r.compteLce ?? '',
        'Compte LES': r.compteLes ?? '',
        'Montant contrat': r.montantCollect ?? '',
      })),
    )
  }

  function exportReversementsPdf() {
    if (!filteredSorted.length) return
    const typeLabel =
      carteFilter === 'PLEINES' ? 'Cartes pleines' : 'Cartes suspendues auto'
    exportTableToPdf(
      `Reversements des cartes — ${typeLabel}`,
      exportFilenameBase,
      [
        'N° Carte',
        'Nom client',
        'Code agence',
        'Date abonnement',
        'GSM',
        'Compte LCE',
        'Compte LES',
        'Montant contrat',
      ],
      filteredSorted.map((r) => [
        r.numeroCarte,
        r.nomClient ?? '',
        r.codeAgence ?? '',
        formatDate(r.dateAbonnement),
        r.gsmprincipale ?? '',
        r.compteLce ?? '',
        r.compteLes ?? '',
        formatMontant(r.montantCollect),
      ]),
    )
  }

  return (
    <>
    <DashboardTablePageLayout
      title="Reversements des cartes"
      cardTitle="Reversements"
      cardDescription="Cartes pleines ou suspendues auto — sélection, traitement et export."
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <FilterChoiceField
                label="Type de carte"
                name="carte-filter"
                value={carteFilter}
                onValueChange={(v) => setCarteFilter(v as CarteFilter)}
                options={[
                  { value: 'PLEINES', label: 'Carte(s) pleine(s)' },
                  { value: 'SUSPENDUES_AUTO', label: 'Carte(s) suspendues auto' },
                ]}
              />
            </div>

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
                className="h-8 min-w-[110px] border-primary text-primary hover:bg-primary/10"
                disabled={isLoading || !orgFilters.hasScope}
                onClick={() => void loadList()}
              >
                {isLoading ? 'Chargement…' : 'EXECUTER'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 min-w-[110px] border-primary text-primary hover:bg-primary/10"
                disabled={isProcessing || !rows.length}
                onClick={() => void handleTraitement()}
              >
                {isProcessing ? 'Traitement…' : 'TRAITEMENT'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-primary/60 text-primary"
                disabled={!filteredSorted.length}
                onClick={exportReversementsXls}
              >
                Export Excel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-primary/60 text-primary"
                disabled={!filteredSorted.length}
                onClick={exportReversementsPdf}
              >
                Export PDF
              </Button>
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
        rows.length > 0 && !isLoading ? (
          <div className="text-xs text-muted-foreground">
            {filteredSorted.length} carte(s) · {selected.size} sélectionnée(s)
            {selected.size === 0 ? ' — TRAITEMENT appliquera toute la liste visible' : ''}
          </div>
        ) : null
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="min-w-[1100px] w-full border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <th className="w-10 px-2 py-2.5">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={() => toggleAllVisible()}
                    aria-label="Tout sélectionner"
                  />
                </th>
                <SortableTh label="N° Carte" active={sortKey === 'carte'} dir={sortDir} onSort={() => toggleSort('carte')} />
                <SortableTh label="Nom client" active={sortKey === 'nomClient'} dir={sortDir} onSort={() => toggleSort('nomClient')} />
                <SortableTh label="Code agence" active={sortKey === 'codeAgence'} dir={sortDir} onSort={() => toggleSort('codeAgence')} />
                <SortableTh label="Date abonnement" active={sortKey === 'dateAbonnement'} dir={sortDir} onSort={() => toggleSort('dateAbonnement')} />
                <SortableTh label="GSM client" active={sortKey === 'gsm'} dir={sortDir} onSort={() => toggleSort('gsm')} />
                <SortableTh label="Compte LCE" active={sortKey === 'compteLce'} dir={sortDir} onSort={() => toggleSort('compteLce')} />
                <SortableTh label="Compte LES" active={sortKey === 'compteLes'} dir={sortDir} onSort={() => toggleSort('compteLes')} />
                <SortableTh label="Montant contrat" active={sortKey === 'montant'} dir={sortDir} onSort={() => toggleSort('montant')} align="right" />
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
                    Cliquez sur EXECUTER pour charger les cartes éligibles au reversement.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r) => (
                    <tr
                      key={r.rowKey}
                      className={[
                        TABLE_ROW_SELECTABLE_CLASS,
                        selected.has(r.rowKey) ? TABLE_ROW_ACTIVE_CLASS : '',
                      ].join(' ')}
                    >
                      <td className={TABLE_TD_CLASS}>
                        <Checkbox
                          checked={selected.has(r.rowKey)}
                          onCheckedChange={() => toggleRow(r.rowKey)}
                          aria-label={`Sélectionner ${r.numeroCarte}`}
                        />
                      </td>
                      <td className={TABLE_TD_MONO_CLASS}>{r.numeroCarte || '—'}</td>
                      <td className={`${TABLE_TD_CLASS} max-w-[200px] truncate`}>{r.nomClient ?? '—'}</td>
                      <td className={TABLE_TD_CLASS}>{r.codeAgence ?? '—'}</td>
                      <td className={TABLE_TD_CLASS}>{formatDate(r.dateAbonnement)}</td>
                      <td className={TABLE_TD_CLASS}>{r.gsmprincipale ?? '—'}</td>
                      <td className={TABLE_TD_MONO_CLASS}>{r.compteLce ?? '—'}</td>
                      <td className={TABLE_TD_MONO_CLASS}>{r.compteLes ?? '—'}</td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.montantCollect)}</td>
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
