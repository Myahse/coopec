import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { TablePaginationBar } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  createInstitution,
  deleteInstitution,
  getInstitutions,
  updateInstitution,
  type InstitutionDto,
} from '@/services/institution'
import { TABLE_WRAPPER_CLASS, tableTheadClass } from '@/constants/table-styles'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { useTablePagination } from '@/hooks/use-table-pagination'

function asRecord(row: unknown): Record<string, unknown> {
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

function norm(v: string): string {
  return String(v ?? '').trim().toLowerCase()
}

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <span className="text-destructive">*</span>
    </Label>
  )
}

function institutionApiCode(row: Record<string, unknown>): string {
  return pickString(row, [
    'identifiant',
    'codeInstitution',
    'codeBanque',
    'code',
    'id',
    'sigle',
  ])
}

function institutionDisplayName(row: Record<string, unknown>): string {
  return pickString(row, [
    'libelle',
    'nomInstitution',
    'libelleInstitution',
    'nom',
    'label',
    'designation',
    'sigle',
  ])
}

function rowToDto(row: Record<string, unknown>): InstitutionDto {
  return {
    identifiant: pickString(row, ['identifiant', 'codeInstitution', 'codeBanque', 'code', 'id']) || undefined,
    libelle: pickString(row, ['libelle', 'nomInstitution', 'libelleInstitution', 'nom', 'label', 'designation']) || undefined,
    sigle: pickString(row, ['sigle']) || undefined,
    telephone: pickString(row, ['telephone']) || undefined,
    adresse: pickString(row, ['adresse']) || undefined,
    email: pickString(row, ['email']) || undefined,
    siteInternet: pickString(row, ['siteInternet']) || undefined,
    codePays: pickString(row, ['codePays']) || undefined,
    senderSms: pickString(row, ['senderSms']) || undefined,
    adresseFtp: pickString(row, ['adresseFtp']) || undefined,
    utilisateurFtp: pickString(row, ['utilisateurFtp']) || undefined,
    motDePasseFtp: pickString(row, ['motDePasseFtp']) || undefined,
    repertoireFtp: pickString(row, ['repertoireFtp']) || undefined,
    adresseMessagerie: pickString(row, ['adresseMessagerie']) || undefined,
    utilisateurMessagerie: pickString(row, ['utilisateurMessagerie']) || undefined,
    motDePasseMessagerie: pickString(row, ['motDePasseMessagerie']) || undefined,
    portMessagerie: pickString(row, ['portMessagerie']) || undefined,
    cptsfd: pickString(row, ['cptsfd']) || undefined,
    etat: pickString(row, ['etat']) || undefined,
    montantMise: row.montantMise != null ? row.montantMise as number | string : undefined,
  }
}

export function CoopecInstitutionsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<unknown[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'edit' | 'create'>('edit')
  const [originalApiCode, setOriginalApiCode] = useState('')
  const [originalLibelle, setOriginalLibelle] = useState('')
  const [form, setForm] = useState<InstitutionDto>(() => ({}))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<{ code: string; label: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((raw) => {
      const row = asRecord(raw)
      const code = institutionApiCode(row).toLowerCase()
      const nom = institutionDisplayName(row).toLowerCase()
      return code.includes(q) || nom.includes(q)
    })
  }, [query, rows])

  const existingCodes = useMemo(
    () => rows.map((r) => institutionApiCode(asRecord(r))).filter(Boolean),
    [rows],
  )
  const existingNames = useMemo(
    () => rows.map((r) => institutionDisplayName(asRecord(r))).filter(Boolean),
    [rows],
  )
  const tablePg = useTablePagination(filtered)

  async function refresh() {
    setIsLoading(true)
    setError(null)
    try {
      const env = await getInstitutions()
      setRows(extractListFromApiEnvelope(env))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger la liste Coopec')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function openEdit(raw: unknown) {
    const row = asRecord(raw)
    const code = institutionApiCode(row)
    if (!code) {
      setSaveError('Cette ligne n’a pas de code exploitable pour l’API.')
      return
    }
    setEditorMode('edit')
    setOriginalApiCode(code)
    setOriginalLibelle(institutionDisplayName(row))
    setForm(rowToDto(row))
    setSaveError(null)
    setIsEditorOpen(true)
  }

  function openCreate() {
    setEditorMode('create')
    setOriginalApiCode('')
    setOriginalLibelle('')
    setForm({
      identifiant: '',
      libelle: '',
      sigle: '',
      telephone: '',
      email: '',
      adresse: '',
      montantMise: '',
    })
    setSaveError(null)
    setIsEditorOpen(true)
  }

  function validateForm(): string | null {
    const identifiant = String(form.identifiant ?? '').trim()
    const libelle = String(form.libelle ?? '').trim()
    const sigle = String(form.sigle ?? '').trim()
    const telephone = String(form.telephone ?? '').trim()
    const email = String(form.email ?? '').trim()
    const adresse = String(form.adresse ?? '').trim()
    const montantRaw = String(form.montantMise ?? '').trim().replace(',', '.')

    if (!identifiant) return 'Le code est obligatoire.'
    if (!/^\d+$/.test(identifiant)) {
      return 'Le code doit être strictement numérique (pas de lettres ni caractères spéciaux).'
    }
    if (identifiant.length > 6) return 'Le code ne doit pas dépasser 6 caractères.'

    const codeTaken = existingCodes.some((c) => norm(c) === norm(identifiant))
    if (editorMode === 'create' && codeTaken) return 'Ce code est déjà attribué.'

    if (!libelle) return 'Le nom de la Coopec est obligatoire.'
    const nameTaken = existingNames.some((n) => norm(n) === norm(libelle))
    if (nameTaken && (editorMode === 'create' || norm(libelle) !== norm(originalLibelle))) {
      return 'Ce nom de Coopec est déjà attribué.'
    }

    if (!sigle) return 'Le sigle est obligatoire.'
    if (!telephone) return 'Le téléphone est obligatoire.'
    if (!email) return "L'email est obligatoire."
    if (!adresse) return "L'adresse est obligatoire."

    if (!montantRaw) return 'Le montant minimum est obligatoire.'
    const montant = Number(montantRaw)
    if (!Number.isFinite(montant)) return 'Le montant minimum doit être numérique.'
    if (montant <= 0) return 'Le montant minimum doit être supérieur à 0.'
    // Multiple de 5, compatible décimal (ex: 15, 20, 25.0).
    if (Math.abs(montant / 5 - Math.round(montant / 5)) > 1e-9) {
      return 'Le montant minimum doit être un multiple de 5.'
    }
    const intDigits = String(Math.trunc(Math.abs(montant))).length
    if (intDigits < 3 || intDigits > 6) {
      return 'Le montant minimum doit contenir entre 3 et 6 chiffres.'
    }
    return null
  }

  async function onSave() {
    const identifiant = String(form.identifiant ?? '').trim()
    const libelle = String(form.libelle ?? '').trim()
    const validationError = validateForm()
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      const payload: InstitutionDto = {
        ...form,
        identifiant,
        libelle,
        sigle: String(form.sigle ?? '').trim(),
        telephone: String(form.telephone ?? '').trim(),
        email: String(form.email ?? '').trim(),
        adresse: String(form.adresse ?? '').trim(),
        montantMise: String(form.montantMise ?? '').trim(),
      }
      if (editorMode === 'create') {
        await createInstitution(payload)
      } else {
        const patchCode = originalApiCode || identifiant
        await updateInstitution(patchCode, payload)
      }
      setIsEditorOpen(false)
      await refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.code) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteInstitution(deleteTarget.code)
      setDeleteTarget(null)
      await refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Suppression impossible'
      setDeleteError(
        /collecte|operation|donn[ée]e/i.test(msg)
          ? "Suppression refusée : cette COOPEC possède déjà des données de collecte."
          : msg,
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <DashboardTablePageLayout
        section="Administration"
        title="Coopec"
        headerActions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
              Retour
            </Button>
            <Button type="button" variant="outline" onClick={() => void refresh()} disabled={isLoading}>
              Actualiser
            </Button>
            <Button type="button" onClick={openCreate}>
              Ajouter
            </Button>
          </>
        }
        cardTitle="Liste Coopec"
        cardDescription="Code, nom, modification et suppression."
        toolbar={
          <div className="w-full sm:max-w-sm">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer par code ou nom…"
            />
          </div>
        }
        pagination={<TablePaginationBar {...tablePg} />}
      >
        {error ? (
          <div className="mb-3 shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className={TABLE_WRAPPER_CLASS}>
          <table className="w-full min-w-[520px] border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
                  <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                    <th>Code</th>
                    <th>Nom de la Coopec</th>
                    <th className="w-[100px]">Modifier</th>
                    <th className="w-[100px]">Supprimer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : null}

                  {!isLoading && !filtered.length ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        Aucune Coopec.
                      </td>
                    </tr>
                  ) : null}

                  {!isLoading
                    ? tablePg.pageItems.map((raw, idx) => {
                        const row = asRecord(raw)
                        const code = institutionApiCode(row) || '—'
                        const nom = institutionDisplayName(row) || '—'
                        const apiCode = institutionApiCode(row)
                        return (
                          <tr key={`${code}_${idx}`} className="hover:bg-muted/30">
                            <td className="px-2 py-2 font-mono text-[11px]">{code}</td>
                            <td className="px-2 py-2">{nom}</td>
                            <td className="px-2 py-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 px-2"
                                onClick={() => openEdit(raw)}
                                disabled={!apiCode}
                              >
                                <Pencil className="size-3.5" />
                                Modifier
                              </Button>
                            </td>
                            <td className="px-2 py-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 px-2 text-destructive hover:text-destructive"
                                onClick={() =>
                                  apiCode &&
                                  setDeleteTarget({ code: apiCode, label: nom !== '—' ? nom : apiCode })
                                }
                                disabled={!apiCode}
                              >
                                <Trash2 className="size-3.5" />
                                Supprimer
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    : null}
                </tbody>
          </table>
        </div>
      </DashboardTablePageLayout>

      <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editorMode === 'create' ? 'Nouvelle Coopec' : 'Modifier la Coopec'}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-2">
            {saveError ? <div className="text-sm text-destructive">{saveError}</div> : null}
            <div className="grid gap-2">
              <RequiredLabel htmlFor="inst-code">Code</RequiredLabel>
              <Input
                id="inst-code"
                value={form.identifiant ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, identifiant: e.target.value }))}
                disabled={editorMode === 'edit'}
                placeholder="Code numérique (max 6)"
              />
              {editorMode === 'edit' ? (
                <p className="text-[11px] text-muted-foreground">Le code ne peut pas être modifié ici.</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <RequiredLabel htmlFor="inst-libelle">Coopec</RequiredLabel>
              <Input
                id="inst-libelle"
                value={form.libelle ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
                placeholder="Nom de la Coopec"
              />
            </div>
            <div className="grid gap-2">
              <RequiredLabel htmlFor="inst-montant-mise">Montant minimum</RequiredLabel>
              <Input
                id="inst-montant-mise"
                type="text"
                value={form.montantMise ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, montantMise: e.target.value }))}
                placeholder="Ex: 1000"
              />
              <p className="text-[11px] text-muted-foreground">
                Numérique, décimal accepté, &gt; 0, multiple de 5, 3 à 6 chiffres.
              </p>
            </div>
            <div className="grid gap-2">
              <RequiredLabel htmlFor="inst-sigle">Sigle</RequiredLabel>
              <Input
                id="inst-sigle"
                value={form.sigle ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, sigle: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <RequiredLabel htmlFor="inst-tel">Téléphone</RequiredLabel>
              <Input
                id="inst-tel"
                value={form.telephone ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <RequiredLabel htmlFor="inst-email">Email</RequiredLabel>
              <Input
                id="inst-email"
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <RequiredLabel htmlFor="inst-adresse">Adresse</RequiredLabel>
              <Input
                id="inst-adresse"
                value={form.adresse ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter className="border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={() => setIsEditorOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void onSave()} disabled={isSaving}>
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Supprimer la Coopec</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-4 text-sm">
            {deleteError ? <div className="mb-3 text-destructive">{deleteError}</div> : null}
            <p>
              Confirmer la suppression de <span className="font-medium">{deleteTarget?.label}</span> (
              <span className="font-mono text-xs">{deleteTarget?.code}</span>) ?
            </p>
          </div>
          <SheetFooter className="border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? 'Suppression…' : 'Supprimer'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
