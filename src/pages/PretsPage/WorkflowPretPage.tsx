import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilterChoiceField } from '@/components/FilterChoiceField'
import { TablePaginationBar } from '@/components/TablePagination'
import { TableColumnFilterInput } from '@/components/TableColumnFilterInput'
import { DashboardPageShell } from '@/layouts/DashboardPageShell'
import { DashboardSectionCard } from '@/layouts/DashboardSectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  fetchPretCumulCarte,
  fetchPretRegularite,
  listPretPieces,
  rejeterWorkflowPret,
  searchWorkflowPret,
  uploadPretPieces,
  validerWorkflowPret,
  type PretPieceRow,
  type WorkflowPretRow,
} from '@/services/pret-workflow'
import { getWorkflowList } from '@/services/user'
import type { WorkFlow } from '@/services/openapi-components'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_ACTIVE_CLASS,
  TABLE_ROW_SELECTABLE_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_CLASS,
  TABLE_TD_MONO_CLASS,
  TABLE_HEAD_FILTER_ROW_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { getConnectedUserCodeAgence, getConnectedUserLogin } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'

type Decision = 'accepter' | 'rejeter'
type OuiNon = 'non' | 'oui'

type SortKey = Exclude<keyof WorkflowPretRow, 'rowKey' | 'idDemande'>

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right'; filterable?: boolean }[] = [
  { key: 'nomClient', label: 'NOM CLIENT', filterable: true },
  { key: 'montantPret', label: 'MONTANT PRET', align: 'right', filterable: true },
  { key: 'dateDemande', label: 'DATE_DEMANDE', filterable: true },
  { key: 'motif', label: 'MOTIF', filterable: true },
  { key: 'agence', label: 'AGENCE', filterable: true },
  { key: 'typePret', label: 'TYPE PRET', filterable: true },
  { key: 'cppId', label: 'cpp_id', filterable: true },
  { key: 'codeDir', label: 'CODE_DIR', filterable: true },
  { key: 'loginValid', label: 'LOGIN_V', filterable: true },
]

const OUI_NON_OPTIONS = [
  { value: 'non' as const, label: 'NON' },
  { value: 'oui' as const, label: 'OUI' },
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
    loginValid: '',
  }
}

export function WorkflowPretPage() {
  const f = useDashboardFilters()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<WorkflowPretRow[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [headerFilters, setHeaderFilters] = useState(emptyColumnFilters)
  const [decision, setDecision] = useState<Decision>('accepter')
  const [motifAction, setMotifAction] = useState('')
  const [checkRegularite, setCheckRegularite] = useState<OuiNon>('non')
  const [checkCumulCartes, setCheckCumulCartes] = useState<OuiNon>('non')
  const [checkBic, setCheckBic] = useState<OuiNon>('non')

  const [pieces, setPieces] = useState<PretPieceRow[]>([])
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  const [isPiecesLoading, setIsPiecesLoading] = useState(false)
  const [isUploadPending, setIsUploadPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [consultMessage, setConsultMessage] = useState<string | null>(null)

  const [niveauOpen, setNiveauOpen] = useState(false)
  const [niveauLoading, setNiveauLoading] = useState(false)
  const [niveauRows, setNiveauRows] = useState<WorkFlow[]>([])
  const [niveauError, setNiveauError] = useState<string | null>(null)

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

  const selectedPiece = useMemo(
    () => pieces.find((p) => p.id === selectedPieceId) ?? null,
    [pieces, selectedPieceId],
  )

  const loadList = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const list = await searchWorkflowPret({
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
      setError(err instanceof Error ? err.message : 'Impossible de charger le workflow prêt')
    } finally {
      setIsLoading(false)
    }
  }, [scope.codeAgence, scope.direction, scope.institution])

  const loadPieces = useCallback(async (idDemande: number | string) => {
    setIsPiecesLoading(true)
    try {
      const list = await listPretPieces(idDemande)
      setPieces(list)
      setSelectedPieceId(list[0]?.id ?? null)
    } catch {
      setPieces([])
      setSelectedPieceId(null)
    } finally {
      setIsPiecesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!selectedRow?.idDemande) {
      setPieces([])
      setSelectedPieceId(null)
      return
    }
    void loadPieces(selectedRow.idDemande)
  }, [selectedRow?.idDemande, loadPieces])

  function setHeaderFilter(key: SortKey, value: string) {
    setHeaderFilters((prev) => ({ ...prev, [key]: value }))
  }

  async function handleOk() {
    if (!selectedRow?.idDemande) {
      setError('Sélectionnez une demande dans le tableau.')
      return
    }
    if (decision === 'rejeter' && !motifAction.trim()) {
      setError('Indiquez un motif pour le rejet.')
      return
    }

    setIsActionPending(true)
    setError(null)
    setSuccess(null)
    try {
      const body = {
        idDemande: selectedRow.idDemande,
        login: getConnectedUserLogin() || undefined,
        motif: motifAction.trim() || selectedRow.motif || undefined,
      }
      if (decision === 'accepter') {
        await validerWorkflowPret(body)
        setSuccess('Demande acceptée.')
      } else {
        await rejeterWorkflowPret(body)
        setSuccess('Demande rejetée.')
      }
      setMotifAction('')
      await loadList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible')
    } finally {
      setIsActionPending(false)
    }
  }

  async function openNiveauValidation() {
    const login = getConnectedUserLogin()
    if (!login) {
      setNiveauError('Login utilisateur introuvable.')
      setNiveauOpen(true)
      return
    }
    setNiveauOpen(true)
    setNiveauLoading(true)
    setNiveauError(null)
    try {
      const res = await getWorkflowList(login)
      setNiveauRows(res.data ?? [])
    } catch (err) {
      setNiveauRows([])
      setNiveauError(err instanceof Error ? err.message : 'Impossible de charger les niveaux')
    } finally {
      setNiveauLoading(false)
    }
  }

  async function handleConsultRegularite() {
    if (!selectedRow?.idDemande) {
      setError('Sélectionnez une demande.')
      return
    }
    setConsultMessage(null)
    try {
      const msg = await fetchPretRegularite(selectedRow.idDemande)
      setConsultMessage(msg)
    } catch (err) {
      setConsultMessage(err instanceof Error ? err.message : 'Consultation impossible')
    }
  }

  async function handleConsultCumulCarte() {
    if (!selectedRow?.idDemande) {
      setError('Sélectionnez une demande.')
      return
    }
    setConsultMessage(null)
    try {
      const msg = await fetchPretCumulCarte(selectedRow.idDemande)
      setConsultMessage(msg)
    } catch (err) {
      setConsultMessage(err instanceof Error ? err.message : 'Consultation impossible')
    }
  }

  async function handleUploadPieces(files: FileList | null) {
    if (!files?.length || !selectedRow?.idDemande) return
    setIsUploadPending(true)
    setError(null)
    try {
      await uploadPretPieces(selectedRow.idDemande, [...files])
      setSuccess('Pièces ajoutées.')
      await loadPieces(selectedRow.idDemande)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ajout de pièces impossible')
    } finally {
      setIsUploadPending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <DashboardPageShell title="Workflow prêt">
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
      {consultMessage ? (
        <Alert>
          <AlertDescription>{consultMessage}</AlertDescription>
        </Alert>
      ) : null}

      <DashboardSectionCard title="Décision">
        <div className="flex flex-wrap items-end gap-4">
          <FilterChoiceField
            name="wf-decision"
            value={decision}
            onValueChange={(v) => setDecision(v as Decision)}
            options={[
              { value: 'accepter', label: 'Accepter' },
              { value: 'rejeter', label: 'Rejeter' },
            ]}
            variant="radio"
          />
          <Button
            type="button"
            variant="outline"
            className="h-8 min-w-[64px] border-primary text-primary hover:bg-primary/10"
            disabled={isActionPending || !selectedRow}
            onClick={() => void handleOk()}
          >
            {isActionPending ? '…' : 'OK'}
          </Button>
          <div className="grid min-w-[200px] flex-1 gap-1">
            <Label className="text-[10px] text-muted-foreground">Motif</Label>
            <Input
              className="h-8 text-xs"
              value={motifAction}
              onChange={(e) => setMotifAction(e.target.value)}
              placeholder="Motif de validation ou de rejet"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-8 border-primary text-primary hover:bg-primary/10"
            onClick={() => void openNiveauValidation()}
          >
            Niveau validation
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 border-primary text-primary hover:bg-primary/10"
            disabled={isLoading}
            onClick={() => void loadList()}
          >
            {isLoading ? 'Chargement…' : 'Actualiser'}
          </Button>
        </div>
      </DashboardSectionCard>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[1fr_280px]">
        <DashboardSectionCard title="Demandes de prêt" className="min-h-[320px]">
          <div className={TABLE_SCROLL_AREA_CLASS}>
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
                    <td colSpan={9} className={TABLE_EMPTY_CELL_CLASS}>
                      Chargement…
                    </td>
                  </tr>
                ) : null}
                {!isLoading && !filteredRows.length ? (
                  <tr>
                    <td colSpan={9} className={TABLE_EMPTY_CELL_CLASS}>
                      Aucune demande en attente.
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
                          <td className={TABLE_TD_MONO_CLASS}>{r.loginValid || '—'}</td>
                        </tr>
                      )
                    })
                  : null}
              </tbody>
            </table>
          </div>
          <TablePaginationBar {...tablePg} />
        </DashboardSectionCard>

        <DashboardSectionCard title="Vérifications" className="min-h-[320px]">
          <div className="flex flex-col gap-4">
            <FilterChoiceField
              label="Avez-vous consulté la régularité ?"
              name="wf-regularite"
              value={checkRegularite}
              onValueChange={(v) => setCheckRegularite(v as OuiNon)}
              options={OUI_NON_OPTIONS}
              variant="radio"
            />
            <FilterChoiceField
              label="Avez-vous consulté le cumul des cartes ?"
              name="wf-cumul"
              value={checkCumulCartes}
              onValueChange={(v) => setCheckCumulCartes(v as OuiNon)}
              options={OUI_NON_OPTIONS}
              variant="radio"
            />
            <FilterChoiceField
              label="Avez-vous consulté le B I C ?"
              name="wf-bic"
              value={checkBic}
              onValueChange={(v) => setCheckBic(v as OuiNon)}
              options={OUI_NON_OPTIONS}
              variant="radio"
            />
          </div>
        </DashboardSectionCard>
      </div>

      <DashboardSectionCard title="Pièces jointes">
        <div className="grid min-h-[240px] gap-4 lg:grid-cols-[200px_1fr_140px]">
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium">Image(s)</Label>
            <div className="min-h-[160px] flex-1 overflow-auto rounded-md border border-border bg-muted/30 p-1">
              {isPiecesLoading ? (
                <p className="p-2 text-xs text-muted-foreground">Chargement…</p>
              ) : null}
              {!isPiecesLoading && !pieces.length ? (
                <p className="p-2 text-xs text-muted-foreground">Aucune pièce.</p>
              ) : null}
              {!isPiecesLoading
                ? pieces.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={[
                        'mb-1 block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted',
                        selectedPieceId === p.id ? 'bg-primary/15 font-medium' : '',
                      ].join(' ')}
                      onClick={() => setSelectedPieceId(p.id)}
                    >
                      {p.label}
                    </button>
                  ))
                : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleUploadPieces(e.target.files)}
            />
            <Button
              type="button"
              variant="secondary"
              className="h-8 text-xs"
              disabled={!selectedRow?.idDemande || isUploadPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploadPending ? 'Envoi…' : 'Ajouter des pièces'}
            </Button>
          </div>

          <div className="flex min-h-[200px] items-center justify-center rounded-md border border-border bg-muted/20 p-2">
            {selectedPiece?.url ? (
              selectedPiece.contentType?.startsWith('image/') ||
              /\.(png|jpe?g|gif|webp|bmp)$/i.test(selectedPiece.url) ? (
                <img
                  src={selectedPiece.url}
                  alt={selectedPiece.label}
                  className="max-h-[280px] max-w-full object-contain"
                />
              ) : (
                <a
                  href={selectedPiece.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline"
                >
                  Ouvrir {selectedPiece.label}
                </a>
              )
            ) : (
              <span className="text-xs text-muted-foreground">
                {selectedRow ? 'Sélectionnez une pièce à afficher.' : 'Sélectionnez une demande.'}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 border-primary text-primary hover:bg-primary/10"
              disabled={!selectedRow?.idDemande}
              onClick={() => void handleConsultRegularite()}
            >
              Régularité
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 border-primary text-primary hover:bg-primary/10"
              disabled={!selectedRow?.idDemande}
              onClick={() => void handleConsultCumulCarte()}
            >
              Cumul carte
            </Button>
          </div>
        </div>
      </DashboardSectionCard>

      <Sheet open={niveauOpen} onOpenChange={setNiveauOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Niveau validation</SheetTitle>
            <SheetDescription>Workflow associé à votre compte.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {niveauLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : null}
            {niveauError ? (
              <Alert variant="destructive">
                <AlertDescription>{niveauError}</AlertDescription>
              </Alert>
            ) : null}
            {!niveauLoading && !niveauError && !niveauRows.length ? (
              <p className="text-sm text-muted-foreground">Aucun niveau configuré.</p>
            ) : null}
            {niveauRows.map((w, idx) => (
              <div key={idx} className="rounded-md border border-border p-3 text-xs">
                <p>
                  <span className="text-muted-foreground">SD :</span> {w.loginussd ?? '—'} (niv.{' '}
                  {w.nivsd ?? '—'})
                </p>
                <p className="mt-1">
                  <span className="text-muted-foreground">PR :</span> {w.loginuspr ?? '—'} (niv.{' '}
                  {w.nivpr ?? '—'})
                </p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </DashboardPageShell>
  )
}
