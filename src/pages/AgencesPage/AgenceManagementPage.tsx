import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TablePaginationBar } from '@/components/TablePagination'
import { DashboardPageShell } from '@/layouts/DashboardPageShell'
import { DashboardSectionCard } from '@/layouts/DashboardSectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { AgenceDto } from '@/services/agence'
import { createAgence, getAgences } from '@/services/agence'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import {
  TABLE_EMPTY_CELL_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_ROW_CLASS,
  TABLE_TBODY_CLASS,
  TABLE_TD_CLASS,
  TABLE_TD_MONO_CLASS,
  TABLE_THEAD_CLASS,
  TABLE_SCROLL_AREA_CLASS,
} from '@/constants/table-styles'
import { agencyCode, flattenAgenceRow } from '@/utils/organization-filters'
import { useTablePagination } from '@/hooks/use-table-pagination'

function pickCellString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

type AgenceForm = {
  codeAgence: string
  nomAgence: string
  situationGeographique: string
  telephone: string
}

const emptyForm = (): AgenceForm => ({
  codeAgence: '',
  nomAgence: '',
  situationGeographique: '',
  telephone: '',
})

export function AgenceManagementPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<unknown[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [form, setForm] = useState<AgenceForm>(() => emptyForm())
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((raw) => {
      const row = flattenAgenceRow(raw)
      const parts = [
        agencyCode(row),
        pickCellString(row, ['nomAgence', 'libelleAgence', 'designation', 'nomClient', 'nomCollecteur']),
        pickCellString(row, ['telephone', 'telephoneFixe', 'gsm']),
        pickCellString(row, ['situationGeographique', 'adresse']),
        pickCellString(row, ['reference', 'motif', 'numabonnement', 'date0peration']),
        row.montant != null ? String(row.montant) : '',
      ].map((x) => String(x ?? '').toLowerCase())
      return parts.some((p) => p.includes(q))
    })
  }, [query, rows])
  const tablePg = useTablePagination(filtered)

  async function refresh() {
    setIsLoading(true)
    setError(null)
    try {
      const env = await getAgences()
      setRows(extractListFromApiEnvelope(env))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les agences')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function openCreate() {
    setForm(emptyForm())
    setSaveError(null)
    setIsEditorOpen(true)
  }

  async function onSave() {
    const codeAgence = form.codeAgence.trim()
    const nomAgence = form.nomAgence.trim()
    if (!codeAgence) {
      setSaveError('Veuillez renseigner le code agence.')
      return
    }
    if (!nomAgence) {
      setSaveError('Veuillez renseigner le nom de l’agence.')
      return
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      const payload: AgenceDto = {
        codeAgence,
        nomAgence,
        telephone: form.telephone.trim() || undefined,
        situationGeographique: form.situationGeographique.trim() || undefined,
      }
      await createAgence(payload)
      setIsEditorOpen(false)
      await refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <DashboardPageShell
        title="Gestion des agences"
        section="Administration"
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
      >
        <DashboardSectionCard
          title="Liste des agences"
          description="Code agence, nom, situation géographique et téléphone."
          className="min-h-0 flex-1"
        >
          <div className="shrink-0 w-full sm:max-w-sm">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer (code, nom, situation, téléphone…)"
            />
          </div>

          {error ? (
            <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className={TABLE_SCROLL_AREA_CLASS}>
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead className={`sticky top-0 z-10 ${TABLE_THEAD_CLASS}`}>
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th>Code agence</th>
                  <th>Nom de l&apos;agence</th>
                  <th>Situation géographique</th>
                  <th>Téléphone</th>
                </tr>
              </thead>
              <tbody className={TABLE_TBODY_CLASS}>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className={TABLE_EMPTY_CELL_CLASS}>
                      Chargement…
                    </td>
                  </tr>
                ) : null}

                {!isLoading
                  ? tablePg.pageItems.map((raw, idx) => {
                      const row = flattenAgenceRow(raw)
                      const code = agencyCode(row) || pickCellString(row, ['reference']) || '—'
                      const name =
                        pickCellString(row, [
                          'nomAgence',
                          'libelleAgence',
                          'designation',
                          'nomClient',
                          'nomCollecteur',
                        ]) || '—'
                      const situation =
                        pickCellString(row, ['situationGeographique', 'adresse']) || '—'
                      const phone = pickCellString(row, ['telephone', 'telephoneFixe', 'gsm']) || '—'
                      return (
                        <tr key={`${code}_${idx}`} className={TABLE_ROW_CLASS}>
                          <td className={`${TABLE_TD_MONO_CLASS} truncate`}>{code}</td>
                          <td className={`${TABLE_TD_CLASS} truncate`}>{name}</td>
                          <td
                            className={`${TABLE_TD_CLASS} max-w-[280px] truncate`}
                            title={situation}
                          >
                            {situation}
                          </td>
                          <td className={`${TABLE_TD_CLASS} truncate`}>{phone}</td>
                        </tr>
                      )
                    })
                  : null}

                {!isLoading && !filtered.length ? (
                  <tr>
                    <td colSpan={4} className={TABLE_EMPTY_CELL_CLASS}>
                      Aucune agence trouvée.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <TablePaginationBar {...tablePg} />
        </DashboardSectionCard>
      </DashboardPageShell>

      <Sheet
        open={isEditorOpen}
        onOpenChange={(open) => {
          setIsEditorOpen(open)
          if (!open) setSaveError(null)
        }}
      >
        <SheetContent side="right" className="w-[92vw] sm:w-[420px]">
          <SheetHeader>
            <SheetTitle>Nouvelle agence</SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-6">
            <div className="grid gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Code agence (obligatoire)</Label>
                <Input
                  value={form.codeAgence}
                  onChange={(e) => setForm((s) => ({ ...s, codeAgence: e.target.value }))}
                  placeholder="Ex: AG001"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Nom de l’agence (obligatoire)</Label>
                <Input
                  value={form.nomAgence}
                  onChange={(e) => setForm((s) => ({ ...s, nomAgence: e.target.value }))}
                  placeholder="Ex: Agence Plateau"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Situation géographique</Label>
                <Input
                  value={form.situationGeographique}
                  onChange={(e) => setForm((s) => ({ ...s, situationGeographique: e.target.value }))}
                  placeholder="Ex: Plateau, Abidjan"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Téléphone</Label>
                <Input
                  value={form.telephone}
                  onChange={(e) => setForm((s) => ({ ...s, telephone: e.target.value }))}
                  placeholder="+225 …"
                  className="mt-1"
                />
              </div>

              {saveError ? <div className="text-sm text-destructive">{saveError}</div> : null}
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsEditorOpen(false)
              }}
              disabled={isSaving}
            >
              Fermer
            </Button>
            <Button type="button" onClick={() => void onSave()} disabled={isSaving}>
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
