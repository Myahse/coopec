import { useCallback, useMemo, useState } from 'react'
import { FilterChoiceField } from '@/components/FilterChoiceField'
import { TablePaginationBar } from '@/components/TablePagination'
import { DashboardPageShell } from '@/layouts/DashboardPageShell'
import { DashboardSectionCard } from '@/layouts/DashboardSectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  repositionnerCarteHistorique,
  repositionnerFichierHistorique,
  searchHistoriqueComptable,
  type HistoriqueComptableDetailRow,
  type HistoriqueComptableMode,
  type HistoriqueExtractionRow,
} from '@/services/historique-comptable'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_ACTIVE_CLASS,
  TABLE_ROW_SELECTABLE_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_CLASS,
  TABLE_TD_MONO_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  TABLE_WRAPPER_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
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

function formatMontant(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}

export function HistoriqueComptablePage() {
  const f = useDashboardFilters()

  const [mode, setMode] = useState<HistoriqueComptableMode>('collecte')
  const [dateDebut, setDateDebut] = useState(todayIso)
  const [dateFin, setDateFin] = useState(todayIso)

  const [extractions, setExtractions] = useState<HistoriqueExtractionRow[]>([])
  const [details, setDetails] = useState<HistoriqueComptableDetailRow[]>([])
  const [selectedExtractionKey, setSelectedExtractionKey] = useState<string | null>(null)
  const [selectedDetailKey, setSelectedDetailKey] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [isRepositionPending, setIsRepositionPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const agence = useMemo(() => {
    const a = f.agency !== 'Toutes' ? f.agency.trim() : ''
    return a || getConnectedUserCodeAgence()
  }, [f.agency])

  const selectedExtraction = useMemo(
    () => extractions.find((e) => e.rowKey === selectedExtractionKey) ?? null,
    [extractions, selectedExtractionKey],
  )

  const selectedDetail = useMemo(
    () => details.find((d) => d.rowKey === selectedDetailKey) ?? null,
    [details, selectedDetailKey],
  )

  const filteredDetails = useMemo(() => {
    if (!selectedExtraction?.clefExtraction) return details
    return details.filter(
      (d) =>
        d.clefExtraction === selectedExtraction.clefExtraction ||
        d.dateCollecte === selectedExtraction.dateExtraction,
    )
  }, [details, selectedExtraction])
  const tablePg = useTablePagination(filteredDetails)

  const montantTotal = useMemo(
    () => filteredDetails.reduce((acc, r) => acc + (r.montantCollecte ?? 0), 0),
    [filteredDetails],
  )

  const nombreFichiers = extractions.length

  const loadData = useCallback(async () => {
    if (!agence) {
      setError('Sélectionnez une agence dans les filtres du tableau de bord.')
      return
    }
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setSelectedExtractionKey(null)
    setSelectedDetailKey(null)
    try {
      const res = await searchHistoriqueComptable({
        codeAgence: agence,
        dateDebut,
        dateFin,
        mode,
      })
      setExtractions(res.extractions)
      setDetails(res.details)
    } catch (err) {
      setExtractions([])
      setDetails([])
      setError(err instanceof Error ? err.message : 'Impossible de charger l’historique comptable')
    } finally {
      setIsLoading(false)
    }
  }, [agence, dateDebut, dateFin, mode])

  async function handleRepositionnerFichier() {
    if (!selectedExtraction || !agence) {
      setError('Sélectionnez une ligne d’extraction (tableau du haut).')
      return
    }
    setIsRepositionPending(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await repositionnerFichierHistorique({
        codeAgence: agence,
        clefExtraction: selectedExtraction.clefExtraction,
      })
      setSuccess(res.message ?? 'Fichier repositionné.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repositionnement fichier impossible')
    } finally {
      setIsRepositionPending(false)
    }
  }

  async function handleRepositionnerCarte() {
    if (!selectedDetail || !agence) {
      setError('Sélectionnez une ligne dans le tableau des détails.')
      return
    }
    setIsRepositionPending(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await repositionnerCarteHistorique({
        codeAgence: agence,
        clefExtraction: selectedDetail.clefExtraction,
        compteLes: selectedDetail.compteLes,
        compteLce: selectedDetail.compteLce,
      })
      setSuccess(res.message ?? 'Carte repositionnée.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repositionnement carte impossible')
    } finally {
      setIsRepositionPending(false)
    }
  }

  const exportBase = `historique_comptable_${mode}_${new Date().toISOString().slice(0, 10)}`

  function exportExtractionsXls() {
    if (!extractions.length) return
    exportJsonToXlsx(
      `${exportBase}_extractions`,
      'Extractions',
      extractions.map((e) => ({
        Agence: e.agence,
        'Date extraction': e.dateExtraction,
        "Clef d'extraction": e.clefExtraction,
      })),
    )
  }

  function exportDetailsXls() {
    if (!filteredDetails.length) return
    exportJsonToXlsx(
      `${exportBase}_details`,
      'Détails',
      filteredDetails.map((r) => ({
        'Le collecté': r.leCollecte,
        'Compte LES': r.compteLes,
        'Compte LCE': r.compteLce,
        'Montant collecté': r.montantCollecte,
        'Date collecte': r.dateCollecte,
        'N° Guichet': r.numGuichet,
        'Le collecteur': r.leCollecteur,
      })),
    )
  }

  function exportDetailsPdf() {
    if (!filteredDetails.length) return
    exportTableToPdf(
      `Historique comptable — ${mode === 'collecte' ? 'Collecte' : 'Reversement'}`,
      `${exportBase}_details`,
      [
        'Le collecté',
        'Compte LES',
        'Compte LCE',
        'Montant',
        'Date collecte',
        'N° Guichet',
        'Collecteur',
      ],
      filteredDetails.map((r) => [
        r.leCollecte,
        r.compteLes,
        r.compteLce,
        formatMontant(r.montantCollecte),
        formatDate(r.dateCollecte),
        r.numGuichet,
        r.leCollecteur,
      ]),
    )
  }

  return (
    <DashboardPageShell
      title="Historique comptable"
      headerActions={
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!extractions.length}
            onClick={exportExtractionsXls}
          >
            XLS extractions
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!filteredDetails.length}
            onClick={exportDetailsXls}
          >
            XLS
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!filteredDetails.length}
            onClick={exportDetailsPdf}
          >
            PDF
          </Button>
        </>
      }
    >
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

      <DashboardSectionCard title="Critères de recherche">
        <div className="flex flex-wrap items-end gap-3">
          <FilterChoiceField
            label="Mode"
            name="hist-mode"
            value={mode}
            onValueChange={(v) => setMode(v as HistoriqueComptableMode)}
            options={[
              { value: 'collecte', label: 'Collecte' },
              { value: 'reversement', label: 'Reversement' },
            ]}
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
            className="h-8 min-w-[110px] border-primary text-primary hover:bg-primary/10"
            disabled={isLoading}
            onClick={() => void loadData()}
          >
            {isLoading ? 'Chargement…' : 'EXECUTER'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 border-primary text-primary hover:bg-primary/10"
            disabled={isRepositionPending || !selectedExtraction}
            onClick={() => void handleRepositionnerFichier()}
          >
            REPOSITIONNER FICHIER
          </Button>
        </div>
      </DashboardSectionCard>

      <DashboardSectionCard title="Fichiers d'extraction" className="shrink-0">
        <div className="flex items-end justify-end gap-2">
          <Label className="text-xs text-muted-foreground">Nombre total de fichier(s)</Label>
          <Input readOnly className="h-7 w-16 text-center text-xs tabular-nums" value={String(nombreFichiers)} />
        </div>
        <div className={`max-h-[140px] ${TABLE_WRAPPER_CLASS}`}>
          <table className="w-full min-w-[500px] border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <th>Agence</th>
                <th>Date extraction</th>
                <th>Clef d&apos;extraction</th>
              </tr>
            </thead>
            <tbody className={TABLE_TBODY_CLASS}>
              {extractions.map((e) => {
                const active = e.rowKey === selectedExtractionKey
                return (
                  <tr
                    key={e.rowKey}
                    className={[TABLE_ROW_SELECTABLE_CLASS, active ? TABLE_ROW_ACTIVE_CLASS : ''].join(' ')}
                    onClick={() => setSelectedExtractionKey(e.rowKey)}
                  >
                    <td className={TABLE_TD_CLASS}>{e.agence}</td>
                    <td className={TABLE_TD_CLASS}>{formatDate(e.dateExtraction)}</td>
                    <td className={TABLE_TD_MONO_CLASS}>{e.clefExtraction || '—'}</td>
                  </tr>
                )
              })}
              {!isLoading && !extractions.length ? (
                <tr>
                  <td colSpan={3} className={TABLE_EMPTY_CELL_CLASS}>
                    Aucune extraction — cliquez sur EXECUTER.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DashboardSectionCard>

      <DashboardSectionCard
        title="Détails"
        className="min-h-0 flex-1"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
              disabled={isRepositionPending || !selectedDetail}
              onClick={() => void handleRepositionnerCarte()}
            >
              Repositionner Carte
            </Button>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Montant total</Label>
              <Input
                readOnly
                className="h-8 w-40 bg-muted text-right text-xs tabular-nums"
                value={formatMontant(montantTotal)}
              />
            </div>
          </div>
        }
      >
        <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="min-w-[1000px] w-full border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <th>Le collecté</th>
                <th>Compte LES</th>
                <th>Compte LCE</th>
                <th className="text-right">Montant collecté</th>
                <th>Date collecte</th>
                <th>N° guichet</th>
                <th>Le collecteur</th>
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
              {!isLoading && !filteredDetails.length ? (
                <tr>
                  <td colSpan={7} className={TABLE_EMPTY_CELL_CLASS}>
                    Aucun détail pour cette sélection.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r) => {
                    const active = r.rowKey === selectedDetailKey
                    return (
                      <tr
                        key={r.rowKey}
                        className={[TABLE_ROW_SELECTABLE_CLASS, active ? TABLE_ROW_ACTIVE_CLASS : ''].join(' ')}
                        onClick={() => setSelectedDetailKey(r.rowKey)}
                      >
                        <td className={`${TABLE_TD_CLASS} max-w-[140px] truncate`}>{r.leCollecte || '—'}</td>
                        <td className={TABLE_TD_MONO_CLASS}>{r.compteLes || '—'}</td>
                        <td className={TABLE_TD_MONO_CLASS}>{r.compteLce || '—'}</td>
                        <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>
                          {formatMontant(r.montantCollecte)}
                        </td>
                        <td className={TABLE_TD_CLASS}>{formatDate(r.dateCollecte)}</td>
                        <td className={TABLE_TD_MONO_CLASS}>{r.numGuichet || '—'}</td>
                        <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>{r.leCollecteur || '—'}</td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
        <TablePaginationBar {...tablePg} />
      </DashboardSectionCard>
    </DashboardPageShell>
  )
}
