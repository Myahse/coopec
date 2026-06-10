import { useCallback, useEffect, useMemo, useState } from 'react'
import { TablePaginationBar } from '@/components/TablePagination'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { FilterChoiceField } from '@/components/FilterChoiceField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  getPretEtatNiveaux,
  searchEtatPret,
  type EtatPretRow,
  type PretNiveauOption,
} from '@/services/pret-etat'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { getConnectedUserCodeAgence, getConnectedUserLogin } from '@/utils/connected-user-login'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

const COLUMNS: { key: keyof EtatPretRow; label: string; align?: 'left' | 'right' }[] = [
  { key: 'libellePret', label: 'Libelle Prêt' },
  { key: 'dateDemande', label: 'DATE DEMANDE' },
  { key: 'taux', label: 'Taux', align: 'right' },
  { key: 'montantPret', label: 'MONTANT_PRET', align: 'right' },
  { key: 'nomClient', label: 'NOM_CLIENT' },
  { key: 'motif', label: 'MOTIF' },
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

function formatTaux(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)
}

export function EtatsPretsPage() {
  const f = useDashboardFilters()

  const [niveauOptions, setNiveauOptions] = useState<PretNiveauOption[]>([])
  const [niveau, setNiveau] = useState('')
  const [dateDebut, setDateDebut] = useState(todayIso)
  const [dateFin, setDateFin] = useState(todayIso)
  const [rows, setRows] = useState<EtatPretRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const scope = useMemo(() => {
    const sessionAgence = getConnectedUserCodeAgence()
    const directionApi = f.direction !== 'Toutes' ? f.direction.trim() : undefined
    const institutionApi = f.institution !== 'Toutes' ? f.institution.trim() : undefined
    const codeAgence =
      f.agency !== 'Toutes' ? f.agency.trim() : sessionAgence || undefined
    return { codeAgence, direction: directionApi, institution: institutionApi }
  }, [f.agency, f.direction, f.institution])

  const tablePg = useTablePagination(rows)

  useEffect(() => {
    void getPretEtatNiveaux().then((opts) => {
      setNiveauOptions(opts)
      setNiveau((prev) => prev || opts[0]?.value || '')
    })
  }, [])

  const loadList = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const list = await searchEtatPret({
        niveau: niveau || undefined,
        dateDebut,
        dateFin,
        codeAgence: scope.codeAgence,
        direction: scope.direction,
        institution: scope.institution,
        login: getConnectedUserLogin() || undefined,
      })
      setRows(list)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger l’état des prêts')
    } finally {
      setIsLoading(false)
    }
  }, [dateDebut, dateFin, niveau, scope.codeAgence, scope.direction, scope.institution])

  function exportXls() {
    exportJsonToXlsx(
      'etat_pret',
      'État prêt',
      rows.map((r) => ({
        'Libelle Prêt': r.libellePret,
        'DATE DEMANDE': formatDateDisplay(r.dateDemande),
        Taux: r.taux ?? '',
        MONTANT_PRET: r.montantPret ?? '',
        NOM_CLIENT: r.nomClient,
        MOTIF: r.motif,
      })),
    )
  }

  function exportPdf() {
    exportTableToPdf(
      'État des prêts',
      'etat_pret',
      COLUMNS.map((c) => c.label),
      rows.map((r) => [
        r.libellePret,
        formatDateDisplay(r.dateDemande),
        formatTaux(r.taux),
        formatMontant(r.montantPret),
        r.nomClient,
        r.motif,
      ]),
    )
  }

  return (
    <DashboardTablePageLayout
      title="État des prêts"
      cardTitle="Suivi des demandes"
      cardDescription="Filtrez par niveau et période pour consulter l’état des prêts."
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
            <FilterChoiceField
              label="Niveau"
              name="etat-pret-niveau"
              value={niveau}
              onValueChange={setNiveau}
              options={niveauOptions.map((o) => ({ value: o.value, label: o.label }))}
              variant="select"
              triggerClassName="h-8 min-w-[280px] max-w-[420px] text-xs"
            />
            <div className="grid gap-1">
              <Label className="text-[10px] text-muted-foreground">Date début</Label>
              <Input
                type="date"
                className="h-8 w-[140px] text-xs"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] text-muted-foreground">Date fin</Label>
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
              className="h-8 min-w-[80px] border-primary text-primary hover:bg-primary/10"
              disabled={isLoading}
              onClick={() => void loadList()}
            >
              {isLoading ? 'Chargement…' : 'Filtre'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!rows.length}
              onClick={exportXls}
            >
              Export XLS
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!rows.length}
              onClick={exportPdf}
            >
              Export PDF
            </Button>
          </div>
        </div>
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
        <table className="min-w-[900px] w-full border-collapse text-xs">
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
                <td colSpan={6} className={TABLE_EMPTY_CELL_CLASS}>
                  Chargement…
                </td>
              </tr>
            ) : null}
            {!isLoading && !rows.length ? (
              <tr>
                <td colSpan={6} className={TABLE_EMPTY_CELL_CLASS}>
                  {hasSearched
                    ? 'Aucun prêt pour ces critères.'
                    : 'Choisissez le niveau et la période puis cliquez sur Filtre.'}
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? tablePg.pageItems.map((r) => (
                  <tr key={r.rowKey} className={TABLE_ROW_CLASS}>
                    <td className={`${TABLE_TD_CLASS} max-w-[180px] truncate`}>
                      {r.libellePret || '—'}
                    </td>
                    <td className={TABLE_TD_CLASS}>{formatDateDisplay(r.dateDemande)}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatTaux(r.taux)}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                      {formatMontant(r.montantPret)}
                    </td>
                    <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>
                      {r.nomClient || '—'}
                    </td>
                    <td className={`${TABLE_TD_CLASS} max-w-[200px] truncate`}>{r.motif || '—'}</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </DashboardTablePageLayout>
  )
}
