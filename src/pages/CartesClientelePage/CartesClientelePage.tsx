import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TablePaginationBar } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TABLE_SCROLL_AREA_CLASS, tableTheadClass } from '@/constants/table-styles'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { useTablePagination } from '@/hooks/use-table-pagination'

type CarteRow = {
  numeroCarte: string
  date: string
  numeroCompte: string
  codeCollect: string
  montant: string
  compteLce: string
  compteLes: string
  nomClient: string
}

export function CartesClientelePage() {
  const navigate = useNavigate()

  const [dateStart, setDateStart] = useState<string>('')
  const [dateEnd, setDateEnd] = useState<string>('')
  const [action, setAction] = useState<string>('DETAIL_CARTE')
  const [cardNumberQuery, setCardNumberQuery] = useState<string>('')

  // TODO: brancher sur l’API quand endpoint prêt
  const rows: CarteRow[] = useMemo(() => [], [])

  const filtered = useMemo(() => {
    const q = cardNumberQuery.trim().toLowerCase()
    let out = rows

    if (q) {
      out = out.filter((r) => String(r.numeroCarte ?? '').toLowerCase().includes(q))
    }

    // Filtre période (si la colonne `date` est au format ISO `YYYY-MM-DD`).
    if (dateStart) out = out.filter((r) => String(r.date ?? '') >= dateStart)
    if (dateEnd) out = out.filter((r) => String(r.date ?? '') <= dateEnd)

    return out
  }, [cardNumberQuery, dateEnd, dateStart, rows])
  const tablePg = useTablePagination(filtered)

  return (
    <DashboardTablePageLayout
      section="Administration"
      title="Gestion des cartes clientèle"
      headerActions={
        <>
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
            Retour dashboard
          </Button>
          <Button type="button" variant="outline" disabled>
            Extraire
          </Button>
        </>
      }
      cardTitle="Tableau"
      cardDescription="Filtrer par période et rechercher par numéro de carte."
      toolbar={
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs text-muted-foreground">Période (début)</Label>
                <Input className="mt-1" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Période (fin)</Label>
                <Input className="mt-1" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Filtre</Label>
                <Select value={action} onValueChange={(v) => v && setAction(v)}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DETAIL_CARTE">Détail carte</SelectItem>
                    <SelectItem value="SUPPRIMER_CARTE">Supprimer carte</SelectItem>
                    <SelectItem value="SUPPRIMER_CARTE_CLIENT">Supprimer carte client</SelectItem>
                    <SelectItem value="EXTRAIRE_SUPPRIMER_CARTE">Extraire supprimer carte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Rechercher numéro carte</Label>
                <Input
                  className="mt-1"
                  value={cardNumberQuery}
                  onChange={(e) => setCardNumberQuery(e.target.value)}
                  placeholder="Ex: 123456…"
                />
              </div>
            </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" disabled={!filtered.length}>
              {action === 'DETAIL_CARTE'
                ? 'Détail carte'
                : action === 'SUPPRIMER_CARTE'
                  ? 'Supprimer carte'
                  : action === 'SUPPRIMER_CARTE_CLIENT'
                    ? 'Supprimer carte client'
                    : 'Extraire supprimer carte'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDateStart('')
                setDateEnd('')
                setCardNumberQuery('')
                setAction('DETAIL_CARTE')
              }}
            >
              Réinitialiser
            </Button>
          </div>
        </>
      }
      pagination={<TablePaginationBar {...tablePg} />}
    >
      <div className={TABLE_SCROLL_AREA_CLASS}>
        <table className="min-w-[1100px] w-full border-collapse text-xs">
                <thead className={tableTheadClass({ sticky: true })}>
                  <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                    <th>NUMERO CARTE</th>
                    <th>DATE</th>
                    <th>NUMERO COMPTE</th>
                    <th>CODE COLLECT</th>
                    <th>MONTANT</th>
                    <th>COMPTE LCE</th>
                    <th>COMPTE LES</th>
                    <th>NOM CLIENT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tablePg.pageItems.map((r, idx) => (
                    <tr key={`${r.numeroCarte}_${idx}`} className="[&>td]:px-2 [&>td]:py-2">
                      <td className="truncate font-medium">{r.numeroCarte}</td>
                      <td className="truncate">{r.date}</td>
                      <td className="truncate">{r.numeroCompte}</td>
                      <td className="truncate">{r.codeCollect}</td>
                      <td className="truncate">{r.montant}</td>
                      <td className="truncate">{r.compteLce}</td>
                      <td className="truncate">{r.compteLes}</td>
                      <td className="truncate" title={r.nomClient}>
                        {r.nomClient}
                      </td>
                    </tr>
                  ))}
                  {!filtered.length ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                        Aucun résultat.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
        </table>
      </div>
    </DashboardTablePageLayout>
  )
}

