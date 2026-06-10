import { Building2, Pencil, RefreshCw, Trash2, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/animate-ui/components/radix/hover-card'
import { TABLE_SCROLL_AREA_CLASS, tableTheadClass } from '@/constants/table-styles'
import type { UserRow } from '../types'

type UsersTableProps = {
  rows: UserRow[]
  isLoading: boolean
  loadError: string | null
  onEdit: (row: UserRow) => void
  onDelete: (row: UserRow) => void
  onChangeAgence: (row: UserRow) => void
  onWorkflow: (row: UserRow) => void
  onSendParams: (row: UserRow) => void
}

export function UsersTable({
  rows,
  isLoading,
  loadError,
  onEdit,
  onDelete,
  onChangeAgence,
  onWorkflow,
  onSendParams,
}: UsersTableProps) {
  return (
    <div className={TABLE_SCROLL_AREA_CLASS}>
      {loadError ? (
        <div className="shrink-0 border-b border-border bg-destructive/5 px-4 py-3 text-sm text-destructive">{loadError}</div>
      ) : null}
      <table className="w-full table-fixed border-collapse text-xs">
        <thead className={tableTheadClass({ sticky: true })}>
          <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
            <th className="w-[7%]">Matricule</th>
            <th className="w-[14%]">Nom &amp; prénoms</th>
            <th className="w-[9%]">Téléphone</th>
            <th className="w-[14%]">Email</th>
            <th className="w-[9%]">Agence</th>
            <th className="w-[12%]">Direction</th>
            <th className="w-[10%]">Profil</th>
            <th className="w-[5%]">Niveau</th>
            <th className="w-[20%] text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {isLoading ? (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">
                Chargement…
              </td>
            </tr>
          ) : null}
          {!isLoading
            ? rows.map((r) => (
                <tr key={r.id} className="[&>td]:px-2 [&>td]:py-2">
                  <td className="truncate font-medium">{r.matricule}</td>
                  <td className="truncate" title={r.nomPrenoms}>
                    {r.nomPrenoms}
                  </td>
                  <td className="truncate" title={r.telephone}>
                    {r.telephone}
                  </td>
                  <td className="truncate" title={r.email}>
                    {r.email}
                  </td>
                  <td className="truncate" title={r.agence}>
                    {r.agence}
                  </td>
                  <td className="truncate" title={r.direction}>
                    {r.direction}
                  </td>
                  <td className="truncate" title={r.libelleProfil ?? ''}>
                    {r.libelleProfil?.trim() || '—'}
                  </td>
                  <td className="truncate">{r.niveau}</td>
                  <td className="text-center">
                    <div className="inline-flex justify-center gap-1 whitespace-nowrap">
                      <ActionButton label="Modifier" hint="Mettre à jour les informations." onClick={() => onEdit(r)}>
                        <Pencil />
                      </ActionButton>
                      <ActionButton
                        label="Supprimer"
                        hint="Retirer cet utilisateur."
                        variant="destructive"
                        onClick={() => onDelete(r)}
                      >
                        <Trash2 />
                      </ActionButton>
                      <ActionButton
                        label="Gestion des workflow"
                        hint="Consulter le workflow associé à l’utilisateur."
                        onClick={() => onWorkflow(r)}
                      >
                        <Workflow />
                      </ActionButton>
                      <ActionButton
                        label="Changer d’agence"
                        hint="Affecter à une autre agence."
                        onClick={() => onChangeAgence(r)}
                      >
                        <Building2 />
                      </ActionButton>
                      <ActionButton
                        label="Renvoyer paramètres"
                        hint="Relancer l’envoi des paramètres."
                        onClick={() => onSendParams(r)}
                      >
                        <RefreshCw />
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))
            : null}
          {!isLoading && !rows.length ? (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">
                Aucun utilisateur trouvé.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

function ActionButton({
  label,
  hint,
  onClick,
  variant = 'outline',
  disabled,
  children,
}: {
  label: string
  hint: string
  onClick?: () => void
  variant?: 'outline' | 'destructive' | 'secondary'
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button
          type="button"
          size="icon-xs"
          variant={variant}
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="center" className="w-56">
        <div className="text-sm font-semibold">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </HoverCardContent>
    </HoverCard>
  )
}
