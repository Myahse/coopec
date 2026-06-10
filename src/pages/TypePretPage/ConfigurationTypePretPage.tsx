import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TablePaginationBar } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FilterChoiceField } from '@/components/FilterChoiceField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TABLE_SCROLL_AREA_CLASS, tableTheadClass } from '@/constants/table-styles'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { addPieceToTypePret, createTypePret, getTypesPret, updateTypePret } from '@/services/administration'
import { getTypesPiece } from '@/services/param'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { getConnectedUserInstitutionCode, getConnectedUserLogin } from '@/utils/connected-user-login'
import {
  emptyTypePretForm,
  emptyTypePretPieceForm,
  formToPiecePretDto,
  formToTypePretDto,
  formatOuiNonFlag,
  formatTypePretMontant,
  mapTypePretList,
  naturePretOptionsFromRows,
  typePretRowToForm,
  type TypePretFormState,
  type TypePretPieceFormState,
  type TypePretRow,
} from '@/utils/type-pret-mappers'
import { useTablePagination } from '@/hooks/use-table-pagination'

function numField(
  label: string,
  value: number,
  onChange: (n: number) => void,
  step = '1',
) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        className="mt-1"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  )
}

export function ConfigurationTypePretPage() {
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<TypePretRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [pieceLabels, setPieceLabels] = useState<Record<number, string>>({})
  const [pieceOptions, setPieceOptions] = useState<{ value: string; label: string }[]>([])
  const [selected, setSelected] = useState<TypePretRow | null>(null)
  const [pieceForm, setPieceForm] = useState<TypePretPieceFormState>(() => emptyTypePretPieceForm())
  const [pieceFormError, setPieceFormError] = useState<string | null>(null)
  const [isPieceSaving, setIsPieceSaving] = useState(false)

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<TypePretFormState>(() => emptyTypePretForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const natureOptions = useMemo(() => naturePretOptionsFromRows(rows), [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [
        r.libellePret,
        r.cnpLibelle,
        String(r.id),
        formatTypePretMontant(r.montantMax),
        formatTypePretMontant(r.plageDebut),
        formatTypePretMontant(r.plageFin),
      ].some((v) => String(v ?? '').toLowerCase().includes(q)),
    )
  }, [query, rows])
  const tablePg = useTablePagination(filtered)

  const loadPieceLabels = useCallback(async () => {
    try {
      const env = await getTypesPiece()
      const list = extractListFromApiEnvelope(env) as Record<string, unknown>[]
      const map: Record<number, string> = {}
      const options: { value: string; label: string }[] = []
      for (const item of list) {
        const id = Number(item.id)
        if (!Number.isFinite(id)) continue
        const label = String(item.libelleTypePieceAdm ?? item.abbrTypePieceAdm ?? id).trim()
        const display = label || String(id)
        map[id] = display
        options.push({ value: String(id), label: display })
      }
      options.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
      setPieceLabels(map)
      setPieceOptions(options)
    } catch {
      setPieceLabels({})
      setPieceOptions([])
    }
  }, [])

  const loadList = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const env = await getTypesPret()
      const list = Array.isArray(env.data) ? env.data : extractListFromApiEnvelope(env)
      setRows(mapTypePretList(list))
    } catch (err) {
      setRows([])
      setLoadError(err instanceof Error ? err.message : 'Impossible de charger les types de prêt')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPieceLabels()
    void loadList()
  }, [loadList, loadPieceLabels])

  function pieceLabel(id: number): string {
    return pieceLabels[id] ?? `Pièce #${id}`
  }

  function openPieces(row: TypePretRow) {
    setSelected(row)
    setPieceForm(
      emptyTypePretPieceForm({
        typePret: row.id,
        createdBy: getConnectedUserLogin(),
      }),
    )
    setPieceFormError(null)
  }

  async function onAddPiece() {
    if (!selected) return
    if (!pieceForm.typePiece) {
      setPieceFormError('Sélectionnez un type de pièce.')
      return
    }

    setIsPieceSaving(true)
    setPieceFormError(null)
    setSuccess(null)
    try {
      await addPieceToTypePret(
        formToPiecePretDto({
          ...pieceForm,
          typePret: selected.id,
          createdBy: pieceForm.createdBy || getConnectedUserLogin(),
        }),
      )
      setSuccess('Pièce ajoutée au type de prêt.')
      const env = await getTypesPret()
      const list = Array.isArray(env.data) ? env.data : extractListFromApiEnvelope(env)
      const nextRows = mapTypePretList(list)
      setRows(nextRows)
      const updated = nextRows.find((r) => r.id === selected.id) ?? null
      setSelected(updated)
      setPieceForm(
        emptyTypePretPieceForm({
          typePret: selected.id,
          createdBy: getConnectedUserLogin(),
        }),
      )
    } catch (err) {
      setPieceFormError(err instanceof Error ? err.message : 'Ajout de pièce impossible')
    } finally {
      setIsPieceSaving(false)
    }
  }

  function openCreate() {
    setEditingId(null)
    setForm(
      emptyTypePretForm({
        institution: getConnectedUserInstitutionCode(),
      }),
    )
    setFormError(null)
    setIsEditorOpen(true)
  }

  function openEdit(row: TypePretRow) {
    setEditingId(row.id)
    setForm(
      typePretRowToForm(row, {
        institution: row.institution || getConnectedUserInstitutionCode(),
      }),
    )
    setFormError(null)
    setIsEditorOpen(true)
  }

  async function onSave() {
    if (!form.libellePret.trim()) {
      setFormError('Renseignez le libellé du prêt.')
      return
    }
    if (form.montantMax < form.montantMin) {
      setFormError('Le montant max doit être supérieur ou égal au montant min.')
      return
    }

    setIsSaving(true)
    setFormError(null)
    setLoadError(null)
    setSuccess(null)
    try {
      const body = formToTypePretDto(form)
      if (editingId != null) {
        await updateTypePret(editingId, body)
        setSuccess('Type de prêt modifié.')
      } else {
        await createTypePret(body)
        setSuccess('Type de prêt enregistré.')
      }
      setIsEditorOpen(false)
      setEditingId(null)
      await loadList()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <DashboardTablePageLayout
        section="Administration"
        title="Configuration Type Prêt"
        headerActions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
              Retour dashboard
            </Button>
            <Button type="button" onClick={openCreate}>
              Nouveau
            </Button>
          </>
        }
        cardTitle="Types de prêt"
        cardDescription="Liste et enregistrement — /api/administration/type-pret."
        alerts={
          loadError || success ? (
            <>
              {loadError ? (
                <Alert variant="destructive">
                  <AlertDescription>{loadError}</AlertDescription>
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:max-w-sm">
              <Label className="text-xs text-muted-foreground">Recherche locale</Label>
              <Input
                className="mt-1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Libellé, nature, montant…"
              />
            </div>
            <Button type="button" variant="outline" disabled={isLoading} onClick={() => void loadList()}>
              {isLoading ? 'Chargement…' : 'Actualiser'}
            </Button>
          </div>
        }
        pagination={<TablePaginationBar {...tablePg} />}
      >
        <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="min-w-[1100px] w-full border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
              <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th>ID</th>
                <th>LIBELLÉ PRÊT</th>
                <th>NATURE (CNP)</th>
                <th className="text-right">MONTANT MAX</th>
                <th className="text-right">PLAGE DÉBUT</th>
                <th className="text-right">PLAGE FIN</th>
                <th className="text-center">PIÈCES</th>
                <th className="text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? tablePg.pageItems.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-2 py-2 font-mono">{r.id}</td>
                      <td className="px-2 py-2">{r.libellePret || '—'}</td>
                      <td className="px-2 py-2">{r.cnpLibelle || '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatTypePretMontant(r.montantMax)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatTypePretMontant(r.plageDebut)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatTypePretMontant(r.plageFin)}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">{r.pieces.length}</td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEdit(r)}>
                            Modifier
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => openPieces(r)}>
                            Pièces
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
              {!isLoading && !filtered.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    Aucun type de prêt trouvé.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DashboardTablePageLayout>

      <Sheet
        open={isEditorOpen}
        onOpenChange={(open) => {
          setIsEditorOpen(open)
          if (!open) {
            setEditingId(null)
            setFormError(null)
          }
        }}
      >
        <SheetContent side="right" className="w-[92vw] sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingId == null ? 'Enregistrer un type de prêt' : 'Modifier le type de prêt'}
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-6">
            <div className="grid gap-4">
              {editingId != null ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Identifiant type prêt</Label>
                  <Input className="mt-1 font-mono text-xs" readOnly value={String(editingId)} />
                </div>
              ) : null}
              <div>
                <Label className="text-xs text-muted-foreground">Libellé prêt</Label>
                <Input
                  className="mt-1"
                  value={form.libellePret}
                  onChange={(e) => setForm((s) => ({ ...s, libellePret: e.target.value }))}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Nature prêt (id CNP)</Label>
                {natureOptions.length ? (
                  <Select
                    value={form.naturePret ? String(form.naturePret) : undefined}
                    onValueChange={(v) => v && setForm((s) => ({ ...s, naturePret: Number(v) || 0 }))}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder="Choisir une nature" />
                    </SelectTrigger>
                    <SelectContent>
                      {natureOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  type="number"
                  className="mt-1"
                  value={Number.isFinite(form.naturePret) ? form.naturePret : ''}
                  onChange={(e) => setForm((s) => ({ ...s, naturePret: Number(e.target.value) || 0 }))}
                  placeholder="Identifiant nature (cnp.id)"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Institution</Label>
                <Input
                  className="mt-1"
                  value={form.institution}
                  onChange={(e) => setForm((s) => ({ ...s, institution: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {numField('Montant min', form.montantMin, (n) => setForm((s) => ({ ...s, montantMin: n })))}
                {numField('Montant max', form.montantMax, (n) => setForm((s) => ({ ...s, montantMax: n })))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {numField('Taux usure', form.tauxUsure, (n) => setForm((s) => ({ ...s, tauxUsure: n })), '0.01')}
                {numField('Taux intérêt', form.tauxInteret, (n) => setForm((s) => ({ ...s, tauxInteret: n })), '0.01')}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {numField('Taux min', form.tauxMin, (n) => setForm((s) => ({ ...s, tauxMin: n })), '0.01')}
                {numField('Taux assurance', form.tauxAssurance, (n) => setForm((s) => ({ ...s, tauxAssurance: n })), '0.01')}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {numField('Frais mise en place', form.fraisMisePlace, (n) =>
                  setForm((s) => ({ ...s, fraisMisePlace: n })), '0.01')}
                {numField('Frais dossier', form.fraisDossier, (n) => setForm((s) => ({ ...s, fraisDossier: n })), '0.01')}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {numField('Mensualité', form.mensualite, (n) => setForm((s) => ({ ...s, mensualite: n })), '0.01')}
                {numField('Durée max (mois)', form.dureeMax, (n) => setForm((s) => ({ ...s, dureeMax: n })))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {numField('Type crédit', form.typeCredit, (n) => setForm((s) => ({ ...s, typeCredit: n })))}
                {numField('Pénalité retard', form.penaliteRetard, (n) =>
                  setForm((s) => ({ ...s, penaliteRetard: n })))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {numField('Jour présentation', form.jourPresentation, (n) =>
                  setForm((s) => ({ ...s, jourPresentation: n })))}
                {numField('Garantie financière', form.garantieFinanciere, (n) =>
                  setForm((s) => ({ ...s, garantieFinanciere: n })))}
              </div>

              {formError ? <div className="text-sm text-destructive">{formError}</div> : null}
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="secondary" disabled={isSaving} onClick={() => setIsEditorOpen(false)}>
              Fermer
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void onSave()}>
              {isSaving
                ? 'Enregistrement…'
                : editingId != null
                  ? 'Modifier'
                  : 'Enregistrer'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setPieceFormError(null)
          }
        }}
      >
        <SheetContent side="right" className="w-[92vw] sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pièces du type prêt</SheetTitle>
          </SheetHeader>
          {selected ? (
            <div className="px-4 pb-6 space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{selected.libellePret || '—'}</div>
                <div className="mt-1 text-xs text-muted-foreground font-mono">Type prêt id : {selected.id}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Nature : {selected.cnpLibelle || '—'}
                  {selected.cnpId != null ? ` (id ${selected.cnpId})` : ''}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Plage : {formatTypePretMontant(selected.plageDebut)} —{' '}
                  {formatTypePretMontant(selected.plageFin)} · Max{' '}
                  {formatTypePretMontant(selected.montantMax)}
                </div>
              </div>

              <div className="rounded-md border border-border p-3 space-y-3">
                <div className="text-sm font-medium">Ajouter une pièce</div>
                <div>
                  <Label className="text-xs text-muted-foreground">Type pièce</Label>
                  <Select
                    value={pieceForm.typePiece ? String(pieceForm.typePiece) : undefined}
                    onValueChange={(v) => v && setPieceForm((s) => ({ ...s, typePiece: Number(v) || 0 }))}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder="Choisir un type de pièce" />
                    </SelectTrigger>
                    <SelectContent>
                      {pieceOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FilterChoiceField
                    label="Obligatoire"
                    name="piece-obligatoire"
                    value={pieceForm.obligatoire}
                    onValueChange={(v) => setPieceForm((s) => ({ ...s, obligatoire: v }))}
                    options={[
                      { value: 'O', label: 'Oui' },
                      { value: 'N', label: 'Non' },
                    ]}
                    variant="radio"
                  />
                  <FilterChoiceField
                    label="Recto / verso"
                    name="piece-recto-verso"
                    value={pieceForm.rectoVerso}
                    onValueChange={(v) => setPieceForm((s) => ({ ...s, rectoVerso: v }))}
                    options={[
                      { value: 'O', label: 'Oui' },
                      { value: 'N', label: 'Non' },
                    ]}
                    variant="radio"
                  />
                </div>
                {pieceFormError ? <div className="text-sm text-destructive">{pieceFormError}</div> : null}
                <Button type="button" size="sm" disabled={isPieceSaving} onClick={() => void onAddPiece()}>
                  {isPieceSaving ? 'Ajout…' : 'Ajouter la pièce'}
                </Button>
              </div>

              {selected.pieces.length ? (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border [&>th]:px-2 [&>th]:py-2 [&>th]:text-left">
                      <th>PIÈCE</th>
                      <th>OBLIGATOIRE</th>
                      <th>RECTO/VERSO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selected.pieces.map((p) => (
                      <tr key={p.idwTypePieceAdm}>
                        <td className="px-2 py-2">{pieceLabel(p.idwTypePieceAdm)}</td>
                        <td className="px-2 py-2">{formatOuiNonFlag(p.obligatoire)}</td>
                        <td className="px-2 py-2">{formatOuiNonFlag(p.rectoVerso)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune pièce configurée pour ce type.</p>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
