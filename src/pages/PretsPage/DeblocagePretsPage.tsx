import { useCallback, useEffect, useMemo, useState } from 'react'
import { TablePaginationBar } from '@/components/TablePagination'
import { TableColumnFilterInput } from '@/components/TableColumnFilterInput'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  debloquerPret,
  defaultContratFilename,
  fetchContratPretBlob,
  searchDeblocagePrets,
  type DeblocagePretBody,
  type DeblocagePretRow,
} from '@/services/pret-deblocage'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_FILTER_ROW_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_ACTIVE_CLASS,
  TABLE_ROW_SELECTABLE_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_CLASS,
  TABLE_TD_MONO_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { getConnectedUserCodeAgence, getConnectedUserLogin } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { exportTableToPdf } from '@/utils/table-export'

type DataSortKey = Exclude<keyof DeblocagePretRow, 'rowKey' | 'idDemande'>

const COLUMNS: { key: DataSortKey; label: string; align?: 'left' | 'right'; filterable?: boolean }[] = [
  { key: 'nomClient', label: 'NOM CLIENT', filterable: true },
  { key: 'montantPret', label: 'MONTANT PRET', align: 'right', filterable: true },
  { key: 'dateDemande', label: 'DATE_DEMANDE', filterable: true },
  { key: 'motif', label: 'MOTIF', filterable: true },
  { key: 'agence', label: 'AGENCE', filterable: true },
  { key: 'typePret', label: 'TYPE PRET', filterable: true },
  { key: 'cppId', label: 'cpp_id', filterable: true },
  { key: 'codeDir', label: 'CODE_DIR', filterable: true },
  { key: 'wnvId', label: 'WNV_ID', filterable: true },
]

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

function emptyColumnFilters(): Record<DataSortKey, string> {
  return {
    nomClient: '',
    montantPret: '',
    dateDemande: '',
    motif: '',
    agence: '',
    typePret: '',
    cppId: '',
    codeDir: '',
    wnvId: '',
  }
}

export function DeblocagePretsPage() {
  const f = useDashboardFilters()

  const [rows, setRows] = useState<DeblocagePretRow[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [headerFilters, setHeaderFilters] = useState(emptyColumnFilters)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeblocagePending, setIsDeblocagePending] = useState(false)
  const [isPrintPending, setIsPrintPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const scope = useMemo(() => {
    const sessionAgence = getConnectedUserCodeAgence()
    const directionApi = f.direction !== 'Toutes' ? f.direction.trim() : undefined
    const institutionApi = f.institution !== 'Toutes' ? f.institution.trim() : undefined
    const codeAgence =
      f.agency !== 'Toutes' ? f.agency.trim() : sessionAgence || undefined
    return { codeAgence, direction: directionApi, institution: institutionApi }
  }, [f.agency, f.direction, f.institution])

  const selectedRow = useMemo(
    () => rows.find((r) => r.rowKey === selectedKey) ?? null,
    [rows, selectedKey],
  )

  const filteredRows = useMemo(() => {
    let out = rows
    for (const col of COLUMNS) {
      const fq = headerFilters[col.key].trim().toLowerCase().replace(/\s/g, '')
      if (!fq) continue
      out = out.filter((r) => {
        const val = r[col.key]
        if (col.key === 'montantPret') {
          return String(val ?? '').replace(/\s/g, '').includes(fq)
        }
        return String(val ?? '').toLowerCase().includes(fq)
      })
    }
    return out
  }, [rows, headerFilters])
  const tablePg = useTablePagination(filteredRows)

  const loadList = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const list = await searchDeblocagePrets({
        codeAgence: scope.codeAgence,
        direction: scope.direction,
        institution: scope.institution,
        login: getConnectedUserLogin() || undefined,
      })
      setRows(list)
      setSelectedKey((prev) => {
        if (!list.length) return null
        if (prev && list.some((r) => r.rowKey === prev)) return prev
        return list[0]?.rowKey ?? null
      })
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Impossible de charger les prêts à débloquer')
    } finally {
      setIsLoading(false)
    }
  }, [scope.codeAgence, scope.direction, scope.institution])

  useEffect(() => {
    void loadList()
  }, [loadList])

  function setHeaderFilter(key: DataSortKey, value: string) {
    setHeaderFilters((prev) => ({ ...prev, [key]: value }))
  }

  function actionBody(row: DeblocagePretRow): DeblocagePretBody {
    return {
      idDemande: row.idDemande,
      wnvId: row.wnvId || undefined,
      cppId: row.cppId || undefined,
      login: getConnectedUserLogin() || undefined,
      codeAgence: row.agence || scope.codeAgence,
    }
  }

  async function handleDeblocage() {
    if (!selectedRow) {
      setError('Sélectionnez une demande dans le tableau.')
      return
    }
    setIsDeblocagePending(true)
    setError(null)
    setSuccess(null)
    try {
      await debloquerPret(actionBody(selectedRow))
      setSuccess('Prêt débloqué avec succès.')
      await loadList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Déblocage impossible')
    } finally {
      setIsDeblocagePending(false)
    }
  }

  async function handleImprimerContrat() {
    if (!selectedRow?.idDemande) {
      setError('Sélectionnez une demande avec un identifiant.')
      return
    }
    setIsPrintPending(true)
    setError(null)
    try {
      const blob = await fetchContratPretBlob(selectedRow.idDemande)
      if (blob) {
        downloadBlob(blob, defaultContratFilename(selectedRow.idDemande))
        setSuccess('Contrat téléchargé.')
        return
      }

      exportTableToPdf(
        `Contrat prêt — ${selectedRow.nomClient}`,
        `contrat_pret_${selectedRow.idDemande}`,
        ['Champ', 'Valeur'],
        [
          ['Client', selectedRow.nomClient],
          ['Montant prêt', formatMontant(selectedRow.montantPret)],
          ['Date demande', formatDateDisplay(selectedRow.dateDemande)],
          ['Motif', selectedRow.motif],
          ['Agence', selectedRow.agence],
          ['Type prêt', selectedRow.typePret],
          ['cpp_id', selectedRow.cppId],
          ['CODE_DIR', selectedRow.codeDir],
          ['WNV_ID', selectedRow.wnvId],
        ],
      )
      setSuccess('Contrat généré (PDF).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impression contrat impossible')
    } finally {
      setIsPrintPending(false)
    }
  }

  function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardTablePageLayout
      title="Déblocage des prêts"
      cardTitle="Prêts à débloquer"
      cardDescription="Sélectionnez une demande, débloquez le prêt ou imprimez le contrat."
      alerts={
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
      }
      toolbar={
        <Button
          type="button"
          variant="outline"
          className="h-8 border-primary text-primary hover:bg-primary/10"
          disabled={isLoading}
          onClick={() => void loadList()}
        >
          {isLoading ? 'Chargement…' : 'Actualiser'}
        </Button>
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className="flex min-h-0 flex-1 gap-4">
        <div className={`min-w-0 flex-1 ${TABLE_SCROLL_AREA_CLASS}`}>
          <table className="min-w-[1100px] w-full border-collapse text-xs">
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
                <th className="px-2 py-2 text-left">Action</th>
              </tr>
              <tr className={TABLE_HEAD_FILTER_ROW_CLASS}>
                {COLUMNS.map((col) => (
                  <th key={`f-${col.key}`} className={col.align === 'right' ? 'text-right' : 'text-left'}>
                    {col.filterable ? (
                      <TableColumnFilterInput
                        align={col.align}
                        value={headerFilters[col.key]}
                        onChange={(value) => setHeaderFilter(col.key, value)}
                      />
                    ) : null}
                  </th>
                ))}
                <th />
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
              {!isLoading && !filteredRows.length ? (
                <tr>
                  <td colSpan={10} className={TABLE_EMPTY_CELL_CLASS}>
                    Aucun prêt en attente de déblocage.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r) => {
                    const active = r.rowKey === selectedKey
                    return (
                      <tr
                        key={r.rowKey}
                        className={[TABLE_ROW_SELECTABLE_CLASS, active ? TABLE_ROW_ACTIVE_CLASS : ''].join(' ')}
                        onClick={() => setSelectedKey(r.rowKey)}
                      >
                        <td className={`${TABLE_TD_CLASS} max-w-[140px] truncate`}>{r.nomClient || '—'}</td>
                        <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                          {formatMontant(r.montantPret)}
                        </td>
                        <td className={TABLE_TD_CLASS}>{formatDateDisplay(r.dateDemande)}</td>
                        <td className={`${TABLE_TD_CLASS} max-w-[120px] truncate`}>{r.motif || '—'}</td>
                        <td className={TABLE_TD_CLASS}>{r.agence || '—'}</td>
                        <td className={TABLE_TD_CLASS}>{r.typePret || '—'}</td>
                        <td className={TABLE_TD_MONO_CLASS}>{r.cppId || '—'}</td>
                        <td className={TABLE_TD_MONO_CLASS}>{r.codeDir || '—'}</td>
                        <td className={TABLE_TD_MONO_CLASS}>{r.wnvId || '—'}</td>
                        <td className={TABLE_TD_CLASS}>{active ? 'Sélectionné' : ''}</td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>

        <div className="flex w-[160px] shrink-0 flex-col items-stretch gap-3 pt-8">
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-[72px] whitespace-normal border-primary px-3 py-4 text-center text-sm font-medium text-primary hover:bg-primary/10"
            disabled={!selectedRow || isDeblocagePending}
            onClick={() => void handleDeblocage()}
          >
            {isDeblocagePending ? 'Traitement…' : 'Déblocage'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-[72px] whitespace-normal border-primary px-3 py-4 text-center text-sm font-medium text-primary hover:bg-primary/10"
            disabled={!selectedRow?.idDemande || isPrintPending}
            onClick={() => void handleImprimerContrat()}
          >
            {isPrintPending ? 'Génération…' : 'Imprimer contrat'}
          </Button>
        </div>
      </div>
    </DashboardTablePageLayout>
  )
}
