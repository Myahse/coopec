import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { useUserManagement } from '../use-user-management'

type Vm = ReturnType<typeof useUserManagement>

export function UserManagementSheets({ vm }: { vm: Vm }) {
  return (
    <>
      <CreateUserSheet vm={vm} />
      <UsersFilterSheet vm={vm} />
      <EditUserSheet vm={vm} />
      <ChangeAgenceSheet vm={vm} />
      <DeleteUserSheet vm={vm} />
      <SendParamsSheet vm={vm} />
      <WorkflowSheet vm={vm} />
    </>
  )
}

function WorkflowSheet({ vm }: { vm: Vm }) {
  const login = vm.workflowTarget ? vm.resolveUserLogin(vm.workflowTarget) : ''

  return (
    <Sheet
      open={vm.isWorkflowOpen}
      onOpenChange={(open) => {
        vm.setIsWorkflowOpen(open)
        if (!open) vm.setWorkflowError(null)
      }}
    >
      <SheetContent side="right" className="w-[92vw] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Gestion des workflow</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-4">
          {vm.workflowTarget ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{vm.workflowTarget.nomPrenoms}</div>
              <div className="mt-1 text-xs text-muted-foreground font-mono">
                Login : {login || '—'}
              </div>
            </div>
          ) : null}

          {vm.isWorkflowLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : null}
          {vm.workflowError ? (
            <p className="text-sm text-destructive">{vm.workflowError}</p>
          ) : null}
          {!vm.isWorkflowLoading && !vm.workflowError && !vm.workflowRows.length ? (
            <p className="text-sm text-muted-foreground">Aucun workflow configuré pour ce login.</p>
          ) : null}
          {vm.workflowRows.map((w, idx) => (
            <div key={idx} className="rounded-md border border-border p-3 text-xs space-y-1">
              <p>
                <span className="text-muted-foreground">SD :</span> {w.loginussd ?? '—'}{' '}
                <span className="text-muted-foreground">(niv. {w.nivsd ?? '—'})</span>
              </p>
              <p>
                <span className="text-muted-foreground">PR :</span> {w.loginuspr ?? '—'}{' '}
                <span className="text-muted-foreground">(niv. {w.nivpr ?? '—'})</span>
              </p>
              {w.nomussd ? (
                <p>
                  <span className="text-muted-foreground">Nom :</span> {w.nomussd}
                </p>
              ) : null}
              {w.etat != null ? (
                <p>
                  <span className="text-muted-foreground">État :</span> {w.etat}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => vm.setIsWorkflowOpen(false)}>
            Fermer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function CreateUserSheet({ vm }: { vm: Vm }) {
  return (
    <Sheet
      open={vm.isCreateUserOpen}
      onOpenChange={(open) => {
        vm.setIsCreateUserOpen(open)
        if (!open) vm.setCreateUserError(null)
      }}
    >
      <SheetContent side="right" className="w-[92vw] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nouvel utilisateur</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-2">
          <div className="grid gap-4">
            <Field id="create-matricule" label="Matricule (obligatoire)">
              <Input
                id="create-matricule"
                value={vm.createForm.matricule}
                onChange={(e) => vm.setCreateForm((s) => ({ ...s, matricule: e.target.value }))}
                placeholder="Ex: MAT001"
                autoComplete="off"
              />
            </Field>
            <Field id="create-nom" label="Nom &amp; prénom (obligatoire)">
              <Input
                id="create-nom"
                value={vm.createForm.nomPrenom}
                onChange={(e) => vm.setCreateForm((s) => ({ ...s, nomPrenom: e.target.value }))}
                placeholder="Nom et prénom"
                autoComplete="name"
              />
            </Field>
            <div>
              <Label className="text-xs text-muted-foreground">Agence (obligatoire)</Label>
              <Select
                value={vm.createForm.codeAgence || undefined}
                onValueChange={(v) => vm.setCreateForm((s) => ({ ...s, codeAgence: v }))}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Choisir une agence">{vm.createAgencySelectLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {vm.createAgencyChoices.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!vm.createAgencyChoices.length ? (
                <p className="mt-1.5 text-xs text-muted-foreground">Chargement des agences…</p>
              ) : null}
            </div>
            <Field id="create-email" label="Email">
              <Input
                id="create-email"
                type="email"
                value={vm.createForm.email}
                onChange={(e) => vm.setCreateForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="email@exemple.com"
              />
            </Field>
            <Field id="create-telephone" label="Téléphone">
              <Input
                id="create-telephone"
                value={vm.createForm.telephone}
                onChange={(e) => vm.setCreateForm((s) => ({ ...s, telephone: e.target.value }))}
                placeholder="Téléphone"
              />
            </Field>
            <Field id="create-adresse" label="Adresse">
              <Input
                id="create-adresse"
                value={vm.createForm.adresse}
                onChange={(e) => vm.setCreateForm((s) => ({ ...s, adresse: e.target.value }))}
                placeholder="Adresse"
              />
            </Field>
            <Field id="create-code-institution" label="Code institution">
              <Input
                id="create-code-institution"
                value={vm.createForm.codeInstitution}
                onChange={(e) => vm.setCreateForm((s) => ({ ...s, codeInstitution: e.target.value }))}
                autoComplete="off"
              />
            </Field>
            <Field id="create-code-banque" label="Code banque">
              <Input
                id="create-code-banque"
                value={vm.createForm.codeBanque}
                onChange={(e) => vm.setCreateForm((s) => ({ ...s, codeBanque: e.target.value }))}
                autoComplete="off"
              />
            </Field>
            <Field id="create-profil" label="Identifiant profil (API)">
              <Input
                id="create-profil"
                type="number"
                inputMode="numeric"
                value={vm.createForm.profil}
                onChange={(e) => vm.setCreateForm((s) => ({ ...s, profil: e.target.value }))}
              />
            </Field>
            <Field id="create-etat" label="État (nombre)">
              <Input
                id="create-etat"
                type="number"
                inputMode="numeric"
                value={vm.createForm.etat}
                onChange={(e) => vm.setCreateForm((s) => ({ ...s, etat: e.target.value }))}
              />
            </Field>
            {vm.createUserError ? <p className="text-sm text-destructive">{vm.createUserError}</p> : null}
          </div>
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => vm.setIsCreateUserOpen(false)} disabled={vm.isCreatingUser}>
            Fermer
          </Button>
          <Button type="button" onClick={() => void vm.submitCreateUser()} disabled={vm.isCreatingUser}>
            {vm.isCreatingUser ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function UsersFilterSheet({ vm }: { vm: Vm }) {
  return (
    <Sheet open={vm.isFilterOpen} onOpenChange={vm.setIsFilterOpen}>
      <SheetContent side="right" className="w-[92vw] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle>Filtres</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <div className="grid gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Direction régionale</Label>
              <Select value={vm.filterDirection} onValueChange={(v) => v && vm.setFilterDirection(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Choisir">{vm.directionSelectLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Toutes">Toutes</SelectItem>
                  {vm.directionChoices.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {vm.directionApiError ? <p className="mt-2 text-xs text-destructive">{vm.directionApiError}</p> : null}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Agence</Label>
              <Select
                value={vm.filterAgence}
                onValueChange={(v) => v && vm.setFilterAgence(v)}
                disabled={vm.filterDirection !== 'Toutes' && vm.isAgencesByDirectionLoading}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Choisir">{vm.agencySelectLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Toutes">Toutes</SelectItem>
                  {vm.agencyChoices.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {vm.filterDirection !== 'Toutes' ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {vm.isAgencesByDirectionLoading
                    ? 'Chargement des agences liées à cette direction…'
                    : 'Seules les agences rattachées à cette direction sont proposées.'}
                </p>
              ) : null}
              {vm.agencyApiError ? <p className="mt-2 text-xs text-destructive">{vm.agencyApiError}</p> : null}
              {vm.agencesByDirectionError ? (
                <p className="mt-2 text-xs text-destructive">{vm.agencesByDirectionError}</p>
              ) : null}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={vm.resetFilters}>
            Réinitialiser
          </Button>
          <Button type="button" onClick={() => vm.setIsFilterOpen(false)}>
            Appliquer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function EditUserSheet({ vm }: { vm: Vm }) {
  return (
    <Sheet
      open={vm.isEditUserOpen}
      onOpenChange={(open) => {
        vm.setIsEditUserOpen(open)
        if (!open) {
          vm.setEditTarget(null)
          vm.setEditUserError(null)
          vm.setEditUserSuccess(null)
        }
      }}
    >
      <SheetContent side="right" className="w-[92vw] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Modifier l’utilisateur</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-2">
          <div className="grid gap-4">
            <Field id="edit-display-nom" label="Nom &amp; prénom">
              <Input id="edit-display-nom" value={vm.editNomPrenom} onChange={(e) => vm.setEditNomPrenom(e.target.value)} placeholder="Nom et prénom" autoComplete="name" />
            </Field>
            <Field id="edit-display-matricule" label="Matricule">
              <Input id="edit-display-matricule" value={vm.editTarget?.matricule === '—' ? '' : (vm.editTarget?.matricule ?? '')} disabled autoComplete="off" />
            </Field>
            <Field id="edit-display-profil" label="Profil">
              <Input id="edit-display-profil" value={vm.editTarget?.libelleProfil?.trim() || '—'} disabled autoComplete="off" />
            </Field>
            <Field id="edit-email" label="Email">
              <Input id="edit-email" type="email" value={vm.editEmail} onChange={(e) => vm.setEditEmail(e.target.value)} placeholder="email@exemple.com" />
            </Field>
            <Field id="edit-telephone" label="Téléphone">
              <Input id="edit-telephone" value={vm.editTelephone} onChange={(e) => vm.setEditTelephone(e.target.value)} placeholder="Téléphone" />
            </Field>
            <Field id="edit-adresse" label="Adresse">
              <Input id="edit-adresse" value={vm.editAdresse} onChange={(e) => vm.setEditAdresse(e.target.value)} placeholder="Adresse" />
            </Field>
            <Field id="edit-profil" label="Identifiant profil (API)">
              <Input id="edit-profil" type="number" inputMode="numeric" value={vm.editProfil} onChange={(e) => vm.setEditProfil(e.target.value)} />
            </Field>
            <Field id="edit-etat" label="État (nombre)">
              <Input id="edit-etat" type="number" inputMode="numeric" value={vm.editEtat} onChange={(e) => vm.setEditEtat(e.target.value)} />
            </Field>
            {vm.editUserError ? <p className="text-sm text-destructive">{vm.editUserError}</p> : null}
            {vm.editUserSuccess ? <p className="text-sm text-emerald-700">{vm.editUserSuccess}</p> : null}
          </div>
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => { vm.setIsEditUserOpen(false); vm.setEditTarget(null) }} disabled={vm.isSavingUser}>
            Fermer
          </Button>
          <Button type="button" onClick={() => void vm.submitEditUser()} disabled={vm.isSavingUser}>
            {vm.isSavingUser ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ChangeAgenceSheet({ vm }: { vm: Vm }) {
  return (
    <Sheet
      open={vm.isChangeAgenceOpen}
      onOpenChange={(open) => {
        vm.setIsChangeAgenceOpen(open)
        if (!open) {
          vm.setChangeAgenceTarget(null)
          vm.setCaError(null)
          vm.setCaNewAgence('')
        }
      }}
    >
      <SheetContent side="right" className="w-[92vw] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Changer d’agence</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-2">
          <div className="grid gap-4">
            <Field id="ca-matricule" label="Matricule">
              <Input id="ca-matricule" value={vm.changeAgenceTarget?.matricule === '—' ? '' : (vm.changeAgenceTarget?.matricule ?? '')} disabled autoComplete="off" />
            </Field>
            <Field id="ca-nom" label="Nom &amp; prénom">
              <Input id="ca-nom" value={vm.caNomPrenom} onChange={(e) => vm.setCaNomPrenom(e.target.value)} placeholder="Nom et prénom" autoComplete="name" />
            </Field>
            <Field id="ca-email" label="Email">
              <Input id="ca-email" type="email" value={vm.caEmail} onChange={(e) => vm.setCaEmail(e.target.value)} placeholder="email@exemple.com" />
            </Field>
            <Field id="ca-tel" label="Téléphone">
              <Input id="ca-tel" value={vm.caTelephone} onChange={(e) => vm.setCaTelephone(e.target.value)} placeholder="Téléphone" />
            </Field>
            <Field id="ca-adresse" label="Adresse">
              <Input id="ca-adresse" value={vm.caAdresse} onChange={(e) => vm.setCaAdresse(e.target.value)} placeholder="Adresse" />
            </Field>
            <Field id="ca-profil" label="Identifiant profil (API)">
              <Input id="ca-profil" type="number" inputMode="numeric" value={vm.caProfil} onChange={(e) => vm.setCaProfil(e.target.value)} />
            </Field>
            <Field id="ca-etat" label="État (nombre)">
              <Input id="ca-etat" type="number" inputMode="numeric" value={vm.caEtat} onChange={(e) => vm.setCaEtat(e.target.value)} />
            </Field>
            <div>
              <Label className="text-xs text-muted-foreground">Nouvelle agence</Label>
              <Select value={vm.caNewAgence || undefined} onValueChange={vm.setCaNewAgence}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Choisir une agence">{vm.caNewAgenceSelectLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {vm.agencyChoices.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {vm.caError ? <p className="text-sm text-destructive">{vm.caError}</p> : null}
          </div>
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => { vm.setIsChangeAgenceOpen(false); vm.setChangeAgenceTarget(null) }} disabled={vm.isSavingChangeAgence}>
            Annuler
          </Button>
          <Button type="button" onClick={() => void vm.submitChangeAgence()} disabled={vm.isSavingChangeAgence || !(vm.changeAgenceTarget?.login ?? '').trim()}>
            {vm.isSavingChangeAgence ? 'Enregistrement…' : 'Enregistrer et changer d’agence'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function DeleteUserSheet({ vm }: { vm: Vm }) {
  return (
    <Sheet
      open={vm.isDeleteUserOpen}
      onOpenChange={(open) => {
        vm.setIsDeleteUserOpen(open)
        if (!open) {
          vm.setDeleteTarget(null)
          vm.setDeleteUserError(null)
        }
      }}
    >
      <SheetContent side="right" className="w-[92vw] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Supprimer l’utilisateur</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">{vm.deleteTarget?.nomPrenoms || 'Utilisateur'}</div>
          </div>
          {vm.deleteUserError ? <p className="mt-3 text-sm text-destructive">{vm.deleteUserError}</p> : null}
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => { vm.setIsDeleteUserOpen(false); vm.setDeleteTarget(null); vm.setDeleteUserError(null) }} disabled={vm.isDeletingUser}>
            Annuler
          </Button>
          <Button type="button" variant="destructive" onClick={() => void vm.submitDeleteUser()} disabled={vm.isDeletingUser || !(vm.deleteTarget?.login ?? '').trim()}>
            {vm.isDeletingUser ? 'Suppression…' : 'Supprimer définitivement'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SendParamsSheet({ vm }: { vm: Vm }) {
  return (
    <Sheet
      open={vm.isSendParamsOpen}
      onOpenChange={(open) => {
        vm.setIsSendParamsOpen(open)
        if (!open) {
          vm.setSendParamsTarget(null)
          vm.setSendParamsError(null)
          vm.setSendParamsSuccess(null)
        }
      }}
    >
      <SheetContent side="right" className="w-[92vw] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle>Renvoyer paramètres</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <div className="grid gap-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="font-medium text-foreground">{vm.sendParamsTarget?.nomPrenoms || 'Utilisateur'}</div>
            </div>
            <Field id="send-code-operation" label="codeOperation">
              <Input id="send-code-operation" value={vm.sendCodeOperation} onChange={(e) => vm.setSendCodeOperation(e.target.value)} placeholder="Code opération" autoComplete="off" />
            </Field>
            <Field id="send-code-banque" label="codeBanque">
              <Input id="send-code-banque" value={vm.sendCodeBanque} onChange={(e) => vm.setSendCodeBanque(e.target.value)} placeholder="Code banque / institution" autoComplete="off" />
            </Field>
            {vm.sendParamsError ? <p className="text-sm text-destructive">{vm.sendParamsError}</p> : null}
            {vm.sendParamsSuccess ? <p className="text-sm text-primary">{vm.sendParamsSuccess}</p> : null}
          </div>
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => { vm.setIsSendParamsOpen(false); vm.setSendParamsTarget(null) }} disabled={vm.isSendingParams}>
            Fermer
          </Button>
          <Button type="button" onClick={() => void vm.submitSendParams()} disabled={vm.isSendingParams || !(vm.sendParamsTarget?.login ?? '').trim()}>
            {vm.isSendingParams ? 'Envoi…' : 'Envoyer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="mt-1">{children}</div>
    </div>
  )
}
