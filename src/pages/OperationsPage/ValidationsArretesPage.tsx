import { useCallback, useMemo, useState } from 'react'
import { TablePaginationBar } from '@/components/TablePagination'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  getArreteToValidDetails,
  listArretesAValider,
  listArretesValides,
  summariesFromArreteToValidDetails,
  validerArreteCollecteur,
  type ArreteValidationRow,
} from '@/services/operation'
import type { Summary } from '@/services/openapi-components'
import {
  TABLE_EMPTY_CELL_CLASS,
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
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

type ListMode = 'a-valider' | 'valides'

type RowState = ArreteValidationRow & { rowKey: string }

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

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

function formatMontant(n: number | string | undefined): string {
  if (n === undefined || n === null || n === '') return '—'
  const num = typeof n === 'string' ? Number(n.replace(/\s/g, '').replace(',', '.')) : n
  if (!Number.isFinite(num)) return String(n)
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(num)
}

function parseMontantInput(v: string): number | undefined {
  const trimmed = v.replace(/\s/g, '').replace(',', '.')
  if (!trimmed) return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : undefined
}

function rowKeyOf(r: ArreteValidationRow, idx: number): string {
  return [r.loginCollecteur, r.codeCollecteur, r.reference, r.date, idx].filter(Boolean).join('|')
}

function withComputedEcart(row: RowState): RowState {
  const declare = row.montantDeclare
  const constate = row.montantConstate
  const ecart =
    constate !== undefined && declare !== undefined ? constate - declare : row.ecart
  return { ...row, ecart }
}

export function ValidationsArretesPage() {
  const f = useDashboardFilters()

  const [date, setDate] = useState(todayIso)
  const [listMode, setListMode] = useState<ListMode>('a-valider')
  const [rows, setRows] = useState<RowState[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsRows, setDetailsRows] = useState<Summary[]>([])
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const [validateOpen, setValidateOpen] = useState(false)
  const [compteToCredit, setCompteToCredit] = useState('')
  const [montantValidation, setMontantValidation] = useState('')
  const [loginValidation, setLoginValidation] = useState('')
  const [referenceValidation, setReferenceValidation] = useState('')

  const agence = useMemo(() => {
    const a = f.agency !== 'Toutes' ? f.agency.trim() : ''
    return a || getConnectedUserCodeAgence()
  }, [f.agency])

  const selectedRow = useMemo(
    () => rows.find((r) => r.rowKey === selectedKey) ?? null,
    [rows, selectedKey],
  )

  const totals = useMemo(() => {
    let declare = 0
    let constate = 0
    for (const r of rows) {
      if (typeof r.montantDeclare === 'number' && Number.isFinite(r.montantDeclare)) {
        declare += r.montantDeclare
      }
      if (typeof r.montantConstate === 'number' && Number.isFinite(r.montantConstate)) {
        constate += r.montantConstate
      }
    }
    return { declare, constate }
  }, [rows])

  const tablePg = useTablePagination(rows)

  const loadList = useCallback(
    async (mode: ListMode) => {
      if (!agence) {
        setError('Sélectionnez une agence dans les filtres du tableau de bord.')
        return
      }
      setListMode(mode)
      setIsLoading(true)
      setError(null)
      setSuccess(null)
      setSelectedKey(null)
      try {
        const body = { codeAgence: agence, date }
        const env =
          mode === 'valides' ? await listArretesValides(body) : await listArretesAValider(body)
        const list = Array.isArray(env.data) ? env.data : []
        setRows(
          list.map((r, idx) =>
            withComputedEcart({
              ...r,
              montantConstate: r.montantConstate ?? r.montantDeclare,
              rowKey: rowKeyOf(r, idx),
            }),
          ),
        )
      } catch (err) {
        setRows([])
        setError(err instanceof Error ? err.message : 'Impossible de charger la liste')
      } finally {
        setIsLoading(false)
      }
    },
    [agence, date],
  )

  function updateMontantConstate(rowKey: string, value: string) {
    const parsed = parseMontantInput(value)
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowKey !== rowKey) return r
        return withComputedEcart({ ...r, montantConstate: parsed })
      }),
    )
  }

  async function handleDetails() {
    if (!selectedRow?.reference) {
      setError("Sélectionnez une ligne avec une référence pour afficher les détails.")
      return
    }
    setDetailsOpen(true)
    setDetailsLoading(true)
    setDetailsError(null)
    setDetailsRows([])
    try {
      const login = selectedRow.loginCollecteur ?? selectedRow.codeCollecteur
      const env = await getArreteToValidDetails({
        reference: selectedRow.reference,
        codeAgence: agence,
        date,
        loginCollecteur: login,
      })
      setDetailsRows(summariesFromArreteToValidDetails(env))
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Détails indisponibles')
    } finally {
      setDetailsLoading(false)
    }
  }

  function openValidateSheet() {
    if (!selectedRow || !agence) {
      setError('Sélectionnez un collecteur dans le tableau.')
      return
    }
    const login =
      (selectedRow.loginCollecteur ?? selectedRow.codeCollecteur ?? getConnectedUserLogin()).trim()
    const reference = String(selectedRow.reference ?? '').trim()
    const compte = String(selectedRow.compteLce ?? selectedRow.compteLes ?? '').trim()
    const montant =
      selectedRow.montantConstate ?? selectedRow.montantDeclare

    if (!login) {
      setError('Identifiant collecteur (login) manquant sur la ligne sélectionnée.')
      return
    }
    if (!reference) {
      setError('Référence opération manquante sur la ligne sélectionnée.')
      return
    }
    if (!compte) {
      setError('Compte à créditer manquant (Compte LCE / LES).')
      return
    }
    if (montant === undefined || !Number.isFinite(Number(montant))) {
      setError('Montant constaté invalide.')
      return
    }

    setLoginValidation(login)
    setReferenceValidation(reference)
    setCompteToCredit(compte)
    setMontantValidation(String(montant))
    setError(null)
    setSuccess(null)
    setValidateOpen(true)
  }

  async function handleValidate() {
    if (!agence) {
      setError('Sélectionnez une agence dans les filtres du tableau de bord.')
      return
    }
    const compte = compteToCredit.trim()
    const login = loginValidation.trim()
    const referenceOperation = referenceValidation.trim()
    const montant = parseMontantInput(montantValidation)

    if (!compte) {
      setError('compteToCredit est obligatoire.')
      return
    }
    if (montant === undefined) {
      setError('montant est obligatoire.')
      return
    }
    if (!login) {
      setError('login est obligatoire.')
      return
    }
    if (!referenceOperation) {
      setError('referenceOperation est obligatoire.')
      return
    }

    setIsValidating(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await validerArreteCollecteur({
        compteToCredit: compte,
        montant,
        codeAgence: agence,
        login,
        referenceOperation,
      })
      setSuccess(res.message ?? 'Arrêté validé.')
      setValidateOpen(false)
      await loadList('a-valider')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation impossible')
    } finally {
      setIsValidating(false)
    }
  }

  const readOnlyConstate = listMode === 'valides'

  const exportFilenameBase =
    listMode === 'valides' ? 'arretes_valides' : 'validations_arretes'

  function exportValidationXls() {
    if (!rows.length) return
    exportJsonToXlsx(
      exportFilenameBase,
      'Validations',
      rows.map((r) => ({
        Date: formatDateDisplay(r.date ?? date),
        'Code collecteur': r.codeCollecteur ?? '',
        'Nom et prénoms collecteur': r.nomCollecteur ?? '',
        'Compte LES': r.compteLes ?? '',
        'Compte LCE': r.compteLce ?? '',
        'Montant déclaré': r.montantDeclare ?? '',
        Solde: r.solde ?? '',
        Cordonnatrice: r.cordonnateur ?? '',
        'Montant constaté': r.montantConstate ?? '',
        Ecart: r.ecart ?? '',
      })),
    )
  }

  function exportValidationPdf() {
    if (!rows.length) return
    const headers = [
      'Date',
      'Code collecteur',
      'Nom collecteur',
      'Compte LES',
      'Compte LCE',
      'Montant déclaré',
      'Solde',
      'Cordonnatrice',
      'Montant constaté',
      'Ecart',
    ]
    exportTableToPdf(
      listMode === 'valides' ? 'Liste des arrêtés validés' : 'Validation des arrêtés',
      exportFilenameBase,
      headers,
      rows.map((r) => [
        formatDateDisplay(r.date ?? date),
        r.codeCollecteur ?? '',
        r.nomCollecteur ?? '',
        r.compteLes ?? '',
        r.compteLce ?? '',
        formatMontant(r.montantDeclare),
        formatMontant(r.solde),
        r.cordonnateur ?? '',
        formatMontant(r.montantConstate),
        formatMontant(r.ecart),
      ]),
    )
  }

  return (
    <>
      <DashboardTablePageLayout
        title="Validations des arrêtés"
        cardTitle="Arrêtés"
        cardDescription="Validation des arrêtés collecteurs par date et agence."
        alerts={
          error || success ? (
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
          ) : null
        }
        toolbar={
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  className="h-8 w-[150px] text-xs"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-8 border-primary text-primary hover:bg-primary/10"
                disabled={isLoading}
                onClick={() => void loadList('a-valider')}
              >
                Afficher
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 border-primary text-primary hover:bg-primary/10"
                disabled={!selectedRow}
                onClick={() => void handleDetails()}
              >
                Détails des opérations
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 border-primary text-primary hover:bg-primary/10"
                disabled={isValidating || !selectedRow || listMode === 'valides'}
                onClick={openValidateSheet}
              >
                Valider l&apos;arrêté du collecteur
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-8 border-primary text-primary hover:bg-primary/10"
              disabled={isLoading}
              onClick={() => void loadList('valides')}
            >
              Liste des arrêtés validés
            </Button>
          </div>
        }
        footer={
          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!rows.length}
              onClick={exportValidationXls}
            >
              Export Excel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!rows.length}
              onClick={exportValidationPdf}
            >
              Export PDF
            </Button>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap text-muted-foreground">Total déclaré</Label>
              <Input
                readOnly
                className="h-8 w-36 bg-muted text-xs tabular-nums"
                value={formatMontant(totals.declare)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap text-muted-foreground">Total constaté</Label>
              <Input
                readOnly
                className="h-8 w-36 bg-muted text-xs tabular-nums"
                value={formatMontant(totals.constate)}
              />
            </div>
            {listMode === 'valides' ? (
              <span className="text-xs text-muted-foreground">Liste des arrêtés validés</span>
            ) : (
              <span className="text-xs text-muted-foreground">Arrêtés en attente de validation</span>
            )}
          </div>
        }
        pagination={<TablePaginationBar {...tablePg} />}
      >
        <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="min-w-[1200px] w-full border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <th>Date</th>
                <th>Code collecteur</th>
                <th>Nom et prénoms collecteur</th>
                <th>Compte LES</th>
                <th>Compte LCE</th>
                <th className="text-right">Montant déclaré</th>
                <th className="text-right">Solde</th>
                <th>Cordonnatrice</th>
                <th className="text-right">Montant constaté</th>
                <th className="text-right">Écart</th>
              </tr>
            </thead>
            <tbody className={TABLE_TBODY_CLASS}>
              {tablePg.pageItems.map((r) => {
                const active = r.rowKey === selectedKey
                return (
                  <tr
                    key={r.rowKey}
                    className={[TABLE_ROW_SELECTABLE_CLASS, active ? TABLE_ROW_ACTIVE_CLASS : ''].join(' ')}
                    onClick={() => setSelectedKey(r.rowKey)}
                  >
                    <td className={TABLE_TD_CLASS}>{formatDateDisplay(r.date ?? date)}</td>
                    <td className={TABLE_TD_CLASS}>{r.codeCollecteur ?? '—'}</td>
                    <td className={`${TABLE_TD_CLASS} max-w-[220px] truncate`}>{r.nomCollecteur ?? '—'}</td>
                    <td className={TABLE_TD_MONO_CLASS}>{r.compteLes ?? '—'}</td>
                    <td className={TABLE_TD_MONO_CLASS}>{r.compteLce ?? '—'}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.montantDeclare)}</td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.solde)}</td>
                    <td className={`${TABLE_TD_CLASS} max-w-[160px] truncate`}>{r.cordonnateur ?? '—'}</td>
                    <td className={`${TABLE_TD_CLASS} text-right`} onClick={(e) => e.stopPropagation()}>
                      {readOnlyConstate ? (
                        <span className="tabular-nums">{formatMontant(r.montantConstate)}</span>
                      ) : (
                        <Input
                          className="ml-auto h-7 w-28 text-right text-xs tabular-nums"
                          value={
                            r.montantConstate !== undefined ? String(r.montantConstate) : ''
                          }
                          onChange={(e) => updateMontantConstate(r.rowKey, e.target.value)}
                        />
                      )}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-right tabular-nums`}>{formatMontant(r.ecart)}</td>
                  </tr>
                )
              })}
              {!isLoading && !rows.length ? (
                <tr>
                  <td colSpan={10} className={TABLE_EMPTY_CELL_CLASS}>
                    {listMode === 'valides'
                      ? 'Aucun arrêté validé pour cette date.'
                      : 'Cliquez sur Afficher pour charger les arrêtés à valider.'}
                  </td>
                </tr>
              ) : null}
              {isLoading ? (
                <tr>
                  <td colSpan={10} className={TABLE_EMPTY_CELL_CLASS}>
                    Chargement…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DashboardTablePageLayout>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Détails des opérations</SheetTitle>
            <SheetDescription>
              {selectedRow?.nomCollecteur ?? 'Collecteur'}
              {selectedRow?.reference ? ` — ${selectedRow.reference}` : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 max-h-[70vh] overflow-auto">
            {detailsLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : null}
            {detailsError ? (
              <p className="text-sm text-destructive">{detailsError}</p>
            ) : null}
            {!detailsLoading && !detailsError && detailsRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun détail.</p>
            ) : null}
            <ul className="space-y-2 text-sm">
              {detailsRows.map((d, i) => (
                <li key={i} className="rounded-md border border-border px-2 py-1.5">
                  <div className="font-medium">{d.nomClient ?? '—'}</div>
                  <div className="text-muted-foreground">
                    {formatDateDisplay(d.date0peration)} · {formatMontant(d.montant)} ·{' '}
                    {d.reference ?? '—'}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={validateOpen} onOpenChange={setValidateOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Valider l&apos;arrêté</SheetTitle>
            <SheetDescription>
              POST /api/operation/valid-arrete-collect — corps API exact.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-3 px-4 py-3">
            <div className="grid gap-1.5">
              <Label htmlFor="val-compte">compteToCredit</Label>
              <Input
                id="val-compte"
                className="font-mono text-xs"
                value={compteToCredit}
                onChange={(e) => setCompteToCredit(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="val-montant">montant</Label>
              <Input
                id="val-montant"
                type="number"
                className="text-xs tabular-nums"
                value={montantValidation}
                onChange={(e) => setMontantValidation(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="val-agence">codeAgence</Label>
              <Input id="val-agence" className="font-mono text-xs" value={agence} readOnly />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="val-login">login</Label>
              <Input
                id="val-login"
                className="font-mono text-xs"
                value={loginValidation}
                onChange={(e) => setLoginValidation(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="val-ref">referenceOperation</Label>
              <Input
                id="val-ref"
                className="font-mono text-xs"
                value={referenceValidation}
                onChange={(e) => setReferenceValidation(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={() => setValidateOpen(false)} disabled={isValidating}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void handleValidate()} disabled={isValidating}>
              {isValidating ? 'Validation…' : 'Confirmer la validation'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
