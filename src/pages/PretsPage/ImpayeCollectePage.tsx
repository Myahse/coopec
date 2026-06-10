import { useCallback, useMemo, useState } from 'react'
import { TablePaginationBar } from '@/components/TablePagination'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  searchImpayeCollecte,
  type ImpayeCollecteRow,
} from '@/services/pret-impaye-collecte'
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
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

const COLUMNS: { key: keyof ImpayeCollecteRow; label: string; align?: 'left' | 'right' }[] = [
  { key: 'carte', label: 'CARTE' },
  { key: 'datePaiement', label: 'DATE PAIEMENT' },
  { key: 'montantCollecte', label: 'MONTANT COLLECTE', align: 'right' },
  { key: 'referenceCredit', label: 'REFERENCE CREDIT' },
  { key: 'nomClient', label: 'NOM CLIENT' },
  { key: 'agence', label: 'AGENCE' },
  { key: 'nomCollectrice', label: 'NOM COLLECTRICE' },
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

export function ImpayeCollectePage() {
  const f = useDashboardFilters()

  const [dateDebut, setDateDebut] = useState(defaultDateDebut)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<ImpayeCollecteRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agencyScope = useMemo(() => {
    const sessionAgence = getConnectedUserCodeAgence()
    const directionApi = f.direction !== 'Toutes' ? f.direction.trim() : undefined
    const institutionApi = f.institution !== 'Toutes' ? f.institution.trim() : undefined

    if (f.agency !== 'Toutes') {
      return {
        codeAgence: f.agency.trim(),
        direction: directionApi,
        institution: institutionApi,
      }
    }

    const codes = f.agences.map((a) => a.value).filter(Boolean)
    return {
      codeAgence: sessionAgence || codes[0] || undefined,
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

  const tablePg = useTablePagination(rows)

  const loadList = useCallback(async () => {
    if (!agencyScope.codeAgence) {
      setError('Sélectionnez une agence dans les filtres du tableau de bord.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const list = await searchImpayeCollecte(
        {
          dateDebut,
          dateFin,
          codeAgence: agencyScope.codeAgence,
          direction: agencyScope.direction,
          institution: agencyScope.institution,
        },
        agencyLabels,
      )
      setRows(list)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger les impayés collecte')
    } finally {
      setIsLoading(false)
    }
  }, [agencyLabels, agencyScope, dateDebut, dateFin])

  function exportXls() {
    exportJsonToXlsx(
      'impaye_collecte',
      'Impayés collecte',
      rows.map((r) => ({
        CARTE: r.carte,
        'DATE PAIEMENT': formatDateDisplay(r.datePaiement),
        'MONTANT COLLECTE': r.montantCollecte ?? '',
        'REFERENCE CREDIT': r.referenceCredit,
        'NOM CLIENT': r.nomClient,
        AGENCE: r.agence,
        'NOM COLLECTRICE': r.nomCollectrice,
      })),
    )
  }

  function exportPdf() {
    exportTableToPdf(
      'Impayés collecte',
      'impaye_collecte',
      COLUMNS.map((c) => c.label),
      rows.map((r) => [
        r.carte,
        formatDateDisplay(r.datePaiement),
        formatMontant(r.montantCollecte),
        r.referenceCredit,
        r.nomClient,
        r.agence,
        r.nomCollectrice,
      ]),
    )
  }

  return (
    <DashboardTablePageLayout
      title="Impayés collecte"
      cardTitle="Collectes impayées"
      cardDescription="Période et détail des impayés de collecte par carte et client."
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
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-w-[52px] border-primary text-primary hover:bg-primary/10"
              disabled={!rows.length}
              onClick={exportXls}
            >
              XLS
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-w-[52px] border-primary text-primary hover:bg-primary/10"
              disabled={!rows.length}
              onClick={exportPdf}
            >
              PDF
            </Button>
          </div>
        </div>
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
        <table className="min-w-[1000px] w-full border-collapse text-xs">
          <thead className={tableTheadClass({ sticky: true })}>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={col.align === 'right' ? 'px-2 py-2 text-right' : 'px-2 py-2 text-left'}
                >
                  {col.label}
                </th>
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
            {!isLoading && !rows.length ? (
              <tr>
                <td colSpan={7} className={TABLE_EMPTY_CELL_CLASS}>
                  Choisissez la période puis cliquez sur EXECUTER.
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? tablePg.pageItems.map((r) => (
                  <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                    <td className={TABLE_TD_MONO_CLASS}>{r.carte || '—'}</td>
                    <td className={TABLE_TD_CLASS}>{formatDateDisplay(r.datePaiement)}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.montantCollecte)}
                    </td>
                    <td className={`${TABLE_TD_CLASS} max-w-[140px] truncate`}>
                      {r.referenceCredit || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>
                      {r.nomClient || '—'}
                    </td>
                    <td className={TABLE_TD_CLASS}>{r.agence || '—'}</td>
                    <td className={`${TABLE_TD_CLASS} max-w-[140px] truncate`}>
                      {r.nomCollectrice || '—'}
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
