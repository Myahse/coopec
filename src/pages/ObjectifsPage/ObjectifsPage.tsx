import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DirectionAgenceFilterButton,
  DirectionAgenceFilterSheet,
} from '@/components/DirectionAgenceFilterSheet'
import { TablePaginationBar } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TABLE_SCROLL_AREA_CLASS, tableTheadClass } from '@/constants/table-styles'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { useDirectionAgenceFilters } from '@/hooks/use-direction-agence-filters'
import {
  createObjectif,
  deleteObjectif,
  searchObjectifs,
  updateObjectif,
} from '@/services/administration'
import { listCollecteursParAgence } from '@/services/collecteur'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { getConnectedUserLogin } from '@/utils/connected-user-login'
import {
  emptyObjectifForm,
  formatObjectifMontant,
  formToObjectifDto,
  mapObjectifDto,
  monthDateRange,
  type ObjectifFormState,
  type ObjectifRow,
} from '@/utils/objectif-mappers'
import { useTablePagination } from '@/hooks/use-table-pagination'

type CollecteurOption = { code: string; nom: string; login: string }

export function ObjectifsPage() {
  const navigate = useNavigate()
  const orgFilters = useDirectionAgenceFilters({
    onScopeChange: () => {
      setRows([])
      setLoadError(null)
      setSuccess(null)
    },
  })

  const [query, setQuery] = useState('')
  const [filterAnnee, setFilterAnnee] = useState(String(new Date().getFullYear()))
  const [filterMois, setFilterMois] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))

  const [rows, setRows] = useState<ObjectifRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ObjectifFormState>(() => emptyObjectifForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [collecteurs, setCollecteurs] = useState<CollecteurOption[]>([])
  const [collecteursLoading, setCollecteursLoading] = useState(false)

  const searchAgence = orgFilters.agenceCode
  const searchDirection = orgFilters.codeDir

  const anneeOptions = useMemo(() => {
    const current = new Date().getFullYear()
    const years = Array.from({ length: 6 }, (_, i) => String(current - i))
    for (const r of rows) if (r.annee) years.push(String(r.annee))
    return Array.from(new Set(years)).sort((a, b) => b.localeCompare(a))
  }, [rows])

  const moisOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [
        r.nomClientCollecteur,
        r.codeClientCollecteur,
        r.codeAgence,
        r.codeDirection,
        r.annee,
        r.mois,
        formatObjectifMontant(r.montantAttendu),
        formatObjectifMontant(r.commissionAttendu),
      ].some((v) => String(v ?? '').toLowerCase().includes(q)),
    )
  }, [query, rows])
  const tablePg = useTablePagination(filtered)

  const loadCollecteurs = useCallback(async (codeAgence: string) => {
    if (!codeAgence) {
      setCollecteurs([])
      return
    }
    setCollecteursLoading(true)
    try {
      const env = await listCollecteursParAgence(codeAgence)
      const list = extractListFromApiEnvelope(env) as Record<string, unknown>[]
      setCollecteurs(
        list
          .map((r) => {
            const login = String(r.login ?? r.loginclient ?? '').trim()
            const code = String(r.codeClient ?? r.codeclient ?? login).trim()
            const nom = String(r.nomclient ?? r.nomCollecteur ?? login).trim()
            return { code, nom, login }
          })
          .filter((c) => c.code || c.login),
      )
    } catch {
      setCollecteurs([])
    } finally {
      setCollecteursLoading(false)
    }
  }, [])

  const loadList = useCallback(async () => {
    const scopeError = orgFilters.getScopeError()
    if (scopeError) {
      setLoadError(scopeError)
      setRows([])
      return
    }
    if (!filterAnnee || !filterMois) {
      setLoadError('Sélectionnez une année et un mois pour charger les objectifs.')
      setRows([])
      return
    }

    setIsLoading(true)
    setLoadError(null)
    setSuccess(null)
    try {
      const env = await searchObjectifs({
        codeAgence: searchAgence,
        annee: filterAnnee,
        mois: filterMois,
      })
      const list = Array.isArray(env.data) ? env.data : extractListFromApiEnvelope(env)
      setRows(
        list
          .map((item) => mapObjectifDto(item))
          .filter((x): x is ObjectifRow => Boolean(x)),
      )
    } catch (err) {
      setRows([])
      setLoadError(err instanceof Error ? err.message : 'Impossible de charger les objectifs')
    } finally {
      setIsLoading(false)
    }
  }, [filterAnnee, filterMois, orgFilters.agenceCode, orgFilters.getScopeError, searchAgence])

  useEffect(() => {
    const scopeError = orgFilters.getScopeError()
    if (scopeError) {
      setLoadError(scopeError)
      setRows([])
      return
    }
    void loadList()
  }, [loadList, orgFilters.agenceCode, orgFilters.codeDir])

  useEffect(() => {
    if (!isEditorOpen) return
    void loadCollecteurs(form.codeAgence || searchAgence)
  }, [form.codeAgence, isEditorOpen, loadCollecteurs, searchAgence])

  function defaultFormValues(): ObjectifFormState {
    const login = getConnectedUserLogin()
    const range = monthDateRange(filterAnnee, filterMois)
    return emptyObjectifForm({
      annee: filterAnnee,
      mois: filterMois,
      codeAgence: searchAgence,
      codeDirection: searchDirection,
      dateDebut: range.dateDebut,
      dateFin: range.dateFin,
      login,
    })
  }

  function openCreate() {
    setEditingId(null)
    setForm(defaultFormValues())
    setFormError(null)
    setIsEditorOpen(true)
  }

  function openEdit(row: ObjectifRow) {
    if (row.id === undefined) {
      setLoadError('Cet objectif ne possède pas d’identifiant : modification impossible.')
      return
    }
    setEditingId(row.id)
    setForm({
      ...row,
      id: row.id,
      mois: String(row.mois ?? '').padStart(2, '0'),
      login: row.login || getConnectedUserLogin(),
    })
    setFormError(null)
    setIsEditorOpen(true)
  }

  async function onDelete(row: ObjectifRow) {
    if (row.id === undefined) return
    const ok = window.confirm('Supprimer cet objectif ?')
    if (!ok) return
    setLoadError(null)
    setSuccess(null)
    try {
      await deleteObjectif(row.id)
      setSuccess('Objectif supprimé.')
      await loadList()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  function onCollecteurChange(value: string) {
    const hit = collecteurs.find((c) => c.code === value || c.login === value)
    setForm((s) => ({
      ...s,
      codeClientCollecteur: hit?.code || value,
      nomClientCollecteur: hit?.nom || s.nomClientCollecteur,
    }))
  }

  function syncPeriodDates(annee: string, mois: string) {
    const range = monthDateRange(annee, mois)
    setForm((s) => ({ ...s, annee, mois, dateDebut: range.dateDebut, dateFin: range.dateFin }))
  }

  async function onSave() {
    const login = getConnectedUserLogin()
    if (!form.codeClientCollecteur.trim()) {
      setFormError('Sélectionnez un collecteur.')
      return
    }
    if (!form.codeAgence.trim()) {
      setFormError('Renseignez le code agence.')
      return
    }
    if (!form.annee.trim() || !form.mois.trim()) {
      setFormError('Renseignez l’année et le mois.')
      return
    }

    setIsSaving(true)
    setFormError(null)
    setLoadError(null)
    setSuccess(null)
    try {
      if (editingId != null) {
        const body = formToObjectifDto(form, login, { id: editingId })
        await updateObjectif(editingId, body)
        setSuccess('Objectif modifié.')
      } else {
        const body = formToObjectifDto(form, login)
        await createObjectif(body)
        setSuccess('Objectif enregistré.')
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
        title="Saisie des objectifs"
        headerActions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
              Retour dashboard
            </Button>
            <Button type="button" onClick={openCreate} disabled={!orgFilters.hasScope}>
              Nouveau
            </Button>
          </>
        }
        cardTitle="Tableau"
        cardDescription="Objectifs par collecteur, agence et période — API /api/administration/objectif."
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="w-full sm:max-w-sm md:col-span-2">
              <Label className="text-xs text-muted-foreground">Recherche locale</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Collecteur, agence…" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Année</Label>
              <Select value={filterAnnee} onValueChange={(v) => v && setFilterAnnee(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {anneeOptions.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Mois</Label>
              <Select value={filterMois} onValueChange={(v) => v && setFilterMois(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {moisOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isLoading || !orgFilters.hasScope}
                onClick={() => void loadList()}
              >
                {isLoading ? 'Chargement…' : 'Charger'}
              </Button>
              <DirectionAgenceFilterButton filters={orgFilters} />
            </div>
          </div>
        }
        pagination={<TablePaginationBar {...tablePg} />}
      >
        <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="min-w-[1400px] w-full border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
              <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th>COLLECTEUR</th>
                <th>CODE</th>
                <th className="text-right">MONTANT ATTENDU</th>
                <th className="text-right">COMMISSION</th>
                <th className="text-right">ADH. SOCIÉTAIRE</th>
                <th className="text-right">ADH. PROSPECT</th>
                <th className="text-right">ADH. LEP</th>
                <th>ANNÉE</th>
                <th>MOIS</th>
                <th>AGENCE</th>
                <th>DIRECTION</th>
                <th className="text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : null}
              {!isLoading &&
                tablePg.pageItems.map((r) => (
                  <tr key={r.id ?? `${r.codeClientCollecteur}-${r.annee}-${r.mois}`} className="[&>td]:px-2 [&>td]:py-2">
                    <td className="max-w-[160px] truncate font-medium" title={r.nomClientCollecteur}>
                      {r.nomClientCollecteur || '—'}
                    </td>
                    <td className="truncate font-mono text-[11px]">{r.codeClientCollecteur || '—'}</td>
                    <td className="text-right tabular-nums">{formatObjectifMontant(r.montantAttendu)}</td>
                    <td className="text-right tabular-nums">{formatObjectifMontant(r.commissionAttendu)}</td>
                    <td className="text-right tabular-nums">{r.adhesionSocietaire}</td>
                    <td className="text-right tabular-nums">{r.adhesionProspect}</td>
                    <td className="text-right tabular-nums">{r.adhessionLep}</td>
                    <td>{r.annee}</td>
                    <td>{r.mois}</td>
                    <td className="truncate">{r.codeAgence}</td>
                    <td className="truncate">{r.codeDirection || '—'}</td>
                    <td className="text-center">
                      <div className="inline-flex justify-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={r.id === undefined}
                          onClick={() => openEdit(r)}
                        >
                          Modifier objectif
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={r.id === undefined}
                          onClick={() => void onDelete(r)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!isLoading && !filtered.length ? (
                <tr>
                  <td colSpan={12} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    {orgFilters.hasScope
                      ? 'Aucun objectif pour cette agence et cette période.'
                      : 'Cliquez sur Filtre pour choisir une direction et une agence.'}
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
        <SheetContent side="right" className="w-[92vw] sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId === null ? 'Nouveau objectif' : 'Modifier objectif'}</SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-6">
            <div className="grid gap-4">
              {editingId != null ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Identifiant</Label>
                  <Input className="mt-1 font-mono text-xs" readOnly value={String(editingId)} />
                </div>
              ) : null}
              <div>
                <Label className="text-xs text-muted-foreground">Agence</Label>
                <Input
                  className="mt-1"
                  value={form.codeAgence}
                  onChange={(e) => setForm((s) => ({ ...s, codeAgence: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Direction</Label>
                <Input
                  className="mt-1"
                  value={form.codeDirection}
                  onChange={(e) => setForm((s) => ({ ...s, codeDirection: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Collecteur</Label>
                <Select
                  value={form.codeClientCollecteur || undefined}
                  onValueChange={onCollecteurChange}
                  disabled={collecteursLoading}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue
                      placeholder={
                        collecteursLoading ? 'Chargement…' : 'Choisir un collecteur'
                      }
                    >
                      {form.nomClientCollecteur || form.codeClientCollecteur || 'Choisir un collecteur'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {collecteurs.map((c) => (
                      <SelectItem key={c.code || c.login} value={c.code || c.login}>
                        {c.nom ? `${c.nom} (${c.code || c.login})` : c.code || c.login}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Année</Label>
                  <Input
                    className="mt-1"
                    value={form.annee}
                    onChange={(e) => syncPeriodDates(e.target.value, form.mois)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Mois</Label>
                  <Input
                    className="mt-1"
                    value={form.mois}
                    onChange={(e) => syncPeriodDates(form.annee, e.target.value.padStart(2, '0'))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Date début</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={form.dateDebut}
                    onChange={(e) => setForm((s) => ({ ...s, dateDebut: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date fin</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={form.dateFin}
                    onChange={(e) => setForm((s) => ({ ...s, dateFin: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Montant attendu</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={form.montantAttendu || ''}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, montantAttendu: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Commission attendue</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={form.commissionAttendu || ''}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, commissionAttendu: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Adh. sociétaire</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={form.adhesionSocietaire || ''}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, adhesionSocietaire: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Adh. prospect</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={form.adhesionProspect || ''}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, adhesionProspect: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Adh. LEP</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={form.adhessionLep || ''}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, adhessionLep: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>

              {formError ? <div className="text-sm text-destructive">{formError}</div> : null}
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={() => {
                setIsEditorOpen(false)
                setEditingId(null)
              }}
            >
              Fermer
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void onSave()}>
              {isSaving
                ? 'Enregistrement…'
                : editingId != null
                  ? 'Modifier objectif'
                  : 'Enregistrer'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <DirectionAgenceFilterSheet filters={orgFilters} />
    </>
  )
}
