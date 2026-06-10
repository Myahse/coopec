import { useCallback, useEffect, useMemo, useState } from 'react'
import { TablePaginationBar } from '@/components/TablePagination'
import { TableColumnFilterInput } from '@/components/TableColumnFilterInput'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  searchEnvoiDemandeClient,
  soumettreOffrePret,
  type EnvoiDemandeClientRow,
} from '@/services/pret-envoi-demande'
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

type SortKey = Exclude<keyof EnvoiDemandeClientRow, 'rowKey' | 'idDemande'>

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right'; filterable?: boolean }[] = [
  { key: 'nomClient', label: 'NOM CLIENT', filterable: true },
  { key: 'montantPret', label: 'MONTANT PRET', align: 'right', filterable: true },
  { key: 'dateDemande', label: 'DATE_DEMANDE', filterable: true },
  { key: 'motif', label: 'MOTIF', filterable: true },
  { key: 'agence', label: 'AGENCE', filterable: true },
  { key: 'typePret', label: 'TYPE PRET', filterable: true },
  { key: 'cppId', label: 'cpp_id', filterable: true },
  { key: 'codeDir', label: 'CODE_DIR', filterable: true },
  { key: 'wnvId', label: 'WNV_ID', filterable: true },
  { key: 'loginValid', label: 'LOGIN_VALID', filterable: true },
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

function emptyColumnFilters(): Record<SortKey, string> {
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
    loginValid: '',
  }
}

export function EnvoiDemandeClientPage() {
  const f = useDashboardFilters()

  const [rows, setRows] = useState<EnvoiDemandeClientRow[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [headerFilters, setHeaderFilters] = useState(emptyColumnFilters)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      const list = await searchEnvoiDemandeClient({
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
      setError(err instanceof Error ? err.message : 'Impossible de charger les demandes client')
    } finally {
      setIsLoading(false)
    }
  }, [scope.codeAgence, scope.direction, scope.institution])

  useEffect(() => {
    void loadList()
  }, [loadList])

  function setHeaderFilter(key: SortKey, value: string) {
    setHeaderFilters((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSoumissionOffre() {
    if (!selectedRow) {
      setError('Sélectionnez une demande dans le tableau.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await soumettreOffrePret({
        idDemande: selectedRow.idDemande,
        wnvId: selectedRow.wnvId || undefined,
        cppId: selectedRow.cppId || undefined,
        login: getConnectedUserLogin() || selectedRow.loginValid || undefined,
        codeAgence: selectedRow.agence || scope.codeAgence,
      })
      setSuccess('Offre soumise avec succès.')
      await loadList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Soumission offre impossible')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardTablePageLayout
      title="Envoi demande client"
      cardTitle="Demandes client"
      cardDescription="Sélectionnez une demande puis soumettez l'offre."
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
          <table className="min-w-[1200px] w-full border-collapse text-xs">
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
                    Aucune demande à envoyer.
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
                        <td className={TABLE_TD_MONO_CLASS}>{r.loginValid || '—'}</td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>

        <div className="flex w-[160px] shrink-0 flex-col items-stretch justify-start pt-8">
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-[72px] whitespace-normal border-primary px-3 py-4 text-center text-sm font-medium text-primary hover:bg-primary/10"
            disabled={!selectedRow || isSubmitting}
            onClick={() => void handleSoumissionOffre()}
          >
            {isSubmitting ? 'Envoi…' : 'Soumission offre'}
          </Button>
        </div>
      </div>
    </DashboardTablePageLayout>
  )
}
