import { useCallback, useMemo, useState } from 'react'
import { Filter, Search } from 'lucide-react'
import { TablePaginationBar } from '@/components/TablePagination'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { SortableTh } from '@/components/SortableTh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import { searchAbonnements, type Abonnement } from '@/services/abonnement'
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
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

type SortKey =
  | 'carte'
  | 'dateAbonnement'
  | 'montant'
  | 'compteLce'
  | 'compteLes'
  | 'nomClient'
  | 'status'
  | 'dateReversement'
  | 'agence'
  | 'solde'

type EtatRow = Abonnement & {
  rowKey: string
  numeroCarte: string
  dateReversement?: string
  solde?: number
}

function monthRangeIso(): { debut: string; fin: string } {
  const now = new Date()
  const debut = new Date(now.getFullYear(), now.getMonth(), 1)
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    debut: debut.toISOString().slice(0, 10),
    fin: fin.toISOString().slice(0, 10),
  }
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

function statusLabel(code: number | string | undefined): string {
  const n = Number(code)
  switch (n) {
    case 1:
      return 'Activé'
    case 2:
      return 'Pleine'
    case 3:
      return 'Reversé'
    case 4:
      return 'Suspendu'
    case 5:
      return 'Suspendu auto'
    default:
      return code !== undefined && code !== '' ? String(code) : '—'
  }
}

function numeroCarteFrom(row: Abonnement): string {
  return String(row.numabonnemntTemp ?? row.idwAbonnement ?? row.numeroCompte ?? '').trim()
}

function mapEtatRow(row: Abonnement, idx: number): EtatRow {
  const raw = row as Abonnement & Record<string, unknown>
  const soldeRaw = raw.solde ?? raw.x3
  const soldeNum =
    typeof soldeRaw === 'number'
      ? soldeRaw
      : typeof soldeRaw === 'string'
        ? Number(soldeRaw.replace(/\s/g, '').replace(',', '.'))
        : NaN
  const dateReversement = String(
    raw.dateReversement ?? raw.datereversement ?? raw.datepassage ?? raw.dateFin ?? '',
  ).trim()

  return {
    ...row,
    rowKey: numeroCarteFrom(row) || `row-${idx}`,
    numeroCarte: numeroCarteFrom(row),
    dateReversement: dateReversement || undefined,
    solde: Number.isFinite(soldeNum) ? soldeNum : undefined,
  }
}

export function EtatsCartesReverseesPage() {
  const f = useDashboardFilters()
  const defaultRange = useMemo(() => monthRangeIso(), [])

  const [dateDebut, setDateDebut] = useState(defaultRange.debut)
  const [dateFin, setDateFin] = useState(defaultRange.fin)
  const [clientFilter, setClientFilter] = useState('')

  const [rows, setRows] = useState<EtatRow[]>([])
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
      const query: Record<string, string> = {}
      if (clientFilter.trim()) query.search = clientFilter.trim()

      const env = await searchAbonnements(
        {
          agence,
          status: '3',
          dateDebut,
          dateFin,
        },
        query,
      )
      const list = extractListFromApiEnvelope(env) as Abonnement[]
      setRows(list.map(mapEtatRow))
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger l’état des cartes reversées')
    } finally {
      setIsLoading(false)
    }
  }, [agence, clientFilter, dateDebut, dateFin])

  const filteredSorted = useMemo(() => {
    let out = rows
    const q = columnFilter.trim().toLowerCase()
    if (q) {
      out = out.filter((r) =>
        [
          r.numeroCarte,
          r.nomClient,
          r.codeAgence,
          r.compteLce,
          r.compteLes,
          statusLabel(r.status),
          formatDate(r.dateAbonnement),
          formatDate(r.dateReversement),
          formatMontant(r.montantCollect),
          formatMontant(r.solde),
        ].some((v) => String(v ?? '').toLowerCase().includes(q)),
      )
    }
    if (!sortKey) return out
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (r: EtatRow): string | number => {
      switch (sortKey) {
        case 'carte':
          return r.numeroCarte
        case 'dateAbonnement':
          return String(r.dateAbonnement ?? '')
        case 'montant':
          return typeof r.montantCollect === 'number' ? r.montantCollect : 0
        case 'compteLce':
          return String(r.compteLce ?? r.compteLceN ?? '')
        case 'compteLes':
          return String(r.compteLes ?? r.compteLesN ?? '')
        case 'nomClient':
          return String(r.nomClient ?? '')
        case 'status':
          return statusLabel(r.status)
        case 'dateReversement':
          return String(r.dateReversement ?? '')
        case 'agence':
          return String(r.codeAgence ?? r.codeAgenceN ?? '')
        case 'solde':
          return typeof r.solde === 'number' ? r.solde : 0
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function exportXls() {
    if (!filteredSorted.length) return
    exportJsonToXlsx(
      'etat_cartes_reversees',
      'Cartes reversées',
      filteredSorted.map((r) => ({
        'N° Carte': r.numeroCarte,
        'Date abonnement': formatDate(r.dateAbonnement),
        'Montant contrat': r.montantCollect ?? '',
        'Compte LCE': r.compteLce ?? r.compteLceN ?? '',
        'Compte LES': r.compteLes ?? r.compteLesN ?? '',
        'Nom client': r.nomClient ?? '',
        Status: statusLabel(r.status),
        'Date reversement': formatDate(r.dateReversement),
        Agence: r.codeAgence ?? r.codeAgenceN ?? '',
        Solde: r.solde ?? '',
      })),
    )
  }

  function exportPdf() {
    if (!filteredSorted.length) return
    exportTableToPdf(
      'État des cartes reversées',
      'etat_cartes_reversees',
      [
        'N° Carte',
        'Date abonnement',
        'Montant contrat',
        'Compte LCE',
        'Compte LES',
        'Nom client',
        'Status',
        'Date reversement',
        'Agence',
        'Solde',
      ],
      filteredSorted.map((r) => [
        r.numeroCarte,
        formatDate(r.dateAbonnement),
        formatMontant(r.montantCollect),
        r.compteLce ?? r.compteLceN ?? '',
        r.compteLes ?? r.compteLesN ?? '',
        r.nomClient ?? '',
        statusLabel(r.status),
        formatDate(r.dateReversement),
        r.codeAgence ?? r.codeAgenceN ?? '',
        formatMontant(r.solde),
      ]),
    )
  }

  return (
    <DashboardTablePageLayout
      title="États des cartes reversées"
      cardTitle="Cartes reversées"
      cardDescription="Période, recherche client et liste des abonnements reversés."
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
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">Client</Label>
                <div className="flex items-center gap-1">
                  <Input
                    className="h-8 w-[180px] text-xs"
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    placeholder="Nom ou code client"
                  />
                  <Button type="button" variant="outline" size="icon-sm" className="h-8 w-8 shrink-0" disabled>
                    <Search className="size-3.5" aria-hidden />
                  </Button>
                </div>
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
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!filteredSorted.length}
                onClick={exportXls}
              >
                Export Excel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!filteredSorted.length}
                onClick={exportPdf}
              >
                Export PDF
              </Button>
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
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="min-w-[1200px] w-full border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <SortableTh label="N° Carte" active={sortKey === 'carte'} dir={sortDir} onSort={() => toggleSort('carte')} />
                <SortableTh label="Date abonnement" active={sortKey === 'dateAbonnement'} dir={sortDir} onSort={() => toggleSort('dateAbonnement')} />
                <SortableTh label="Montant contrat" active={sortKey === 'montant'} dir={sortDir} onSort={() => toggleSort('montant')} align="right" />
                <SortableTh label="Compte LCE" active={sortKey === 'compteLce'} dir={sortDir} onSort={() => toggleSort('compteLce')} />
                <SortableTh label="Compte LES" active={sortKey === 'compteLes'} dir={sortDir} onSort={() => toggleSort('compteLes')} />
                <SortableTh label="Nom client" active={sortKey === 'nomClient'} dir={sortDir} onSort={() => toggleSort('nomClient')} />
                <SortableTh label="Statut" active={sortKey === 'status'} dir={sortDir} onSort={() => toggleSort('status')} />
                <SortableTh label="Date reversement" active={sortKey === 'dateReversement'} dir={sortDir} onSort={() => toggleSort('dateReversement')} />
                <SortableTh label="Agence" active={sortKey === 'agence'} dir={sortDir} onSort={() => toggleSort('agence')} />
                <SortableTh label="Solde" active={sortKey === 'solde'} dir={sortDir} onSort={() => toggleSort('solde')} align="right" />
              </tr>
            </thead>
            <tbody className={TABLE_TBODY_CLASS}>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className={TABLE_EMPTY_CELL_CLASS}>
                    Chargement…
                  </td>
                </tr>
              ) : null}
              {!isLoading && !filteredSorted.length ? (
                <tr>
                  <td colSpan={10} className={TABLE_EMPTY_CELL_CLASS}>
                    Cliquez sur EXECUTER pour afficher les cartes reversées.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r) => (
                    <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                      <td className={TABLE_TD_MONO_CLASS}>{r.numeroCarte || '—'}</td>
                      <td className={TABLE_TD_CLASS}>{formatDate(r.dateAbonnement)}</td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.montantCollect)}</td>
                      <td className={TABLE_TD_MONO_CLASS}>{r.compteLce ?? r.compteLceN ?? '—'}</td>
                      <td className={TABLE_TD_MONO_CLASS}>{r.compteLes ?? r.compteLesN ?? '—'}</td>
                      <td className={`${TABLE_TD_CLASS} max-w-[200px] truncate`}>{r.nomClient ?? '—'}</td>
                      <td className={TABLE_TD_CLASS}>{statusLabel(r.status)}</td>
                      <td className={TABLE_TD_CLASS}>{formatDate(r.dateReversement)}</td>
                      <td className={TABLE_TD_CLASS}>{r.codeAgence ?? r.codeAgenceN ?? '—'}</td>
                      <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.solde)}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
      </div>
    </DashboardTablePageLayout>
  )
}
