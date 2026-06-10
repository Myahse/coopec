import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilterChoiceField } from '@/components/FilterChoiceField'
import { TableExportButtons } from '@/components/TableExportButtons'
import { TablePaginationBar } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  searchAbonnementsForPage,
  type Abonnement,
  type AbonnementUiStatusFilter,
} from '@/services/abonnement'
import { listCollecteursParAgence } from '@/services/collecteur'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import {
  collecteurLabelForCode,
  mapCollecteurSelectOptions,
  type CollecteurSelectOption,
} from '@/utils/collecteur-select-options'
import { TABLE_SCROLL_AREA_CLASS, tableTheadClass } from '@/constants/table-styles'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'
import { AbonnementCompteSheet } from './AbonnementCompteSheet'
import { AbonnementDetailSheet } from './AbonnementDetailSheet'
import { AbonnementReversementSheet } from './AbonnementReversementSheet'
import {
  abonnementNumero,
  canReverseAbonnement,
  formatDate,
  formatMontant,
  needsCompteCompletion,
  statusLabel,
} from './abonnement-format'

const STATUS_OPTIONS: { value: AbonnementUiStatusFilter; label: string }[] = [
  { value: 'ACTIVEES', label: 'Activée(s)' },
  { value: 'SUSPENDUES', label: 'Suspendue(s)' },
  { value: 'PLEINES', label: 'Pleine(s)' },
  { value: 'SUSPENDUES_AUTO', label: 'Suspendue(s) Auto' },
  { value: 'REVERSEES', label: 'Reversée(s)' },
  { value: 'TOUS', label: 'Tous' },
]

type AbonnementTypeFilter = 'TOUS' | 'A_COMPLETER'

const ABONNEMENT_TYPE_OPTIONS: { value: AbonnementTypeFilter; label: string }[] = [
  { value: 'TOUS', label: 'Tous les abonnements' },
  { value: 'A_COMPLETER', label: 'Abonnement à compléter' },
]

const EXPORT_COLUMNS = [
  'Date',
  'N° Carte',
  'Code Client',
  'LES',
  'LCE',
  'Le collecteur',
  'Le client',
  'Montant',
  'Téléphone',
  'État',
] as const

function initialAgenceCode(f: ReturnType<typeof useDashboardFilters>): string {
  if (f.agency !== 'Toutes') return f.agency.trim()
  return getConnectedUserCodeAgence()
}

export function AbonnementsPage() {
  const navigate = useNavigate()
  const f = useDashboardFilters()

  const [selectedAgence, setSelectedAgence] = useState(() => initialAgenceCode(f))
  const [statusFilter, setStatusFilter] = useState<AbonnementUiStatusFilter>('ACTIVEES')
  const [abonnementType, setAbonnementType] = useState<AbonnementTypeFilter>('TOUS')
  const [collecteurFilter, setCollecteurFilter] = useState('Tous')
  const [nomClient, setNomClient] = useState('')
  const [lce, setLce] = useState('')
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().slice(0, 10))

  const [rows, setRows] = useState<Abonnement[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [collecteurs, setCollecteurs] = useState<CollecteurSelectOption[]>([])
  const [collecteursLoading, setCollecteursLoading] = useState(false)
  const [collecteursError, setCollecteursError] = useState<string | null>(null)

  const [detailRow, setDetailRow] = useState<Abonnement | null>(null)
  const [compteRow, setCompteRow] = useState<Abonnement | null>(null)
  const [reverseRow, setReverseRow] = useState<Abonnement | null>(null)

  const agencyOptionsSorted = useMemo(() => {
    return [...f.agences]
      .map((a) => {
        const label =
          a.label && a.label !== a.value ? a.label : f.labelForAgencyCode(a.value)
        return { value: a.value, label: label || a.value }
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  }, [f, f.agences])

  const agenceCode = useMemo(() => selectedAgence.trim(), [selectedAgence])

  const dashboardScope = useMemo(
    () => ({
      direction: f.direction,
      agence: f.agency,
      institution: f.institution,
    }),
    [f.direction, f.agency, f.institution],
  )

  useEffect(() => {
    if (f.agency !== 'Toutes') {
      setSelectedAgence(f.agency.trim())
      setCollecteurFilter('Tous')
    }
  }, [f.agency])

  useEffect(() => {
    if (!agenceCode) {
      setCollecteurs([])
      setCollecteursError(null)
      return
    }
    let cancelled = false
    setCollecteursLoading(true)
    setCollecteursError(null)
    ;(async () => {
      try {
        const env = await listCollecteursParAgence(agenceCode)
        if (cancelled) return
        setCollecteurs(mapCollecteurSelectOptions(extractListFromApiEnvelope(env)))
      } catch (err) {
        if (!cancelled) {
          setCollecteurs([])
          setCollecteursError(
            err instanceof Error ? err.message : 'Impossible de charger les collecteurs',
          )
        }
      } finally {
        if (!cancelled) setCollecteursLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agenceCode])

  const handleSearch = useCallback(async () => {
    if (!agenceCode) {
      setError('Veuillez sélectionner une agence.')
      return
    }
    if (!dateDebut || !dateFin) {
      setError('Veuillez renseigner la date de début et la date de fin.')
      return
    }
    if (dateDebut > dateFin) {
      setError('La date de début doit être antérieure ou égale à la date de fin.')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const list = await searchAbonnementsForPage(
        {
          agence: agenceCode,
          dateDebut,
          dateFin,
        },
        statusFilter,
        dashboardScope,
        {
          collecteur: collecteurFilter !== 'Tous' ? collecteurFilter : undefined,
          search: nomClient.trim() || undefined,
          compte: lce.trim() || undefined,
        },
      )
      setRows(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les abonnements')
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [
    agenceCode,
    collecteurFilter,
    dashboardScope,
    dateDebut,
    dateFin,
    lce,
    nomClient,
    statusFilter,
  ])

  const filtered = useMemo(() => {
    if (abonnementType !== 'A_COMPLETER') return rows
    return rows.filter(needsCompteCompletion)
  }, [rows, abonnementType])
  const tablePg = useTablePagination(filtered, { threshold: 25, pageSize: 50 })

  const selectedAgencyLabel = useMemo(() => {
    if (!selectedAgence) return ''
    const hit = agencyOptionsSorted.find((a) => a.value === selectedAgence)
    if (hit?.label && hit.label !== selectedAgence) return hit.label
    return f.labelForAgencyCode(selectedAgence)
  }, [agencyOptionsSorted, f, selectedAgence])

  const collecteurSelectLabel = useMemo(() => {
    if (collecteursLoading) return 'Chargement…'
    if (!agenceCode) return 'Choisir une agence'
    if (collecteurs.length) return `Tous (${collecteurs.length})`
    return 'Tous'
  }, [agenceCode, collecteurs.length, collecteursLoading])

  const collecteurFilterLabel = useMemo(() => {
    if (collecteurFilter === 'Tous') return collecteurSelectLabel
    return collecteurLabelForCode(collecteurFilter, collecteurs)
  }, [collecteurFilter, collecteurs, collecteurSelectLabel])

  function exportXls() {
    exportJsonToXlsx(
      'abonnements',
      'Abonnements',
      filtered.map((row) => ({
        Date: formatDate(row.dateAbonnement),
        'N° Carte': abonnementNumero(row) || '—',
        'Code Client': row.codeClient ?? '—',
        LES: row.compteLes ?? row.compteLesN ?? '—',
        LCE: row.compteLce ?? row.compteLceN ?? '—',
        'Le collecteur': collecteurLabelForCode(row.codeCollect, collecteurs),
        'Le client': row.nomClient ?? '—',
        Montant: row.montantCollect ?? '',
        Téléphone: row.gsmprincipale ?? '—',
        État: statusLabel(row.status),
      })),
    )
  }

  function exportPdf() {
    exportTableToPdf(
      'Gestion des abonnements',
      'abonnements',
      [...EXPORT_COLUMNS],
      filtered.map((row) => [
        formatDate(row.dateAbonnement),
        abonnementNumero(row) || '—',
        row.codeClient ?? '—',
        row.compteLes ?? row.compteLesN ?? '—',
        row.compteLce ?? row.compteLceN ?? '—',
        collecteurLabelForCode(row.codeCollect, collecteurs),
        row.nomClient ?? '—',
        formatMontant(row.montantCollect),
        row.gsmprincipale ?? '—',
        statusLabel(row.status),
      ]),
    )
  }

  return (
    <>
      <DashboardTablePageLayout
        section="Administration"
        title="Gestion des abonnements"
        headerActions={
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
            Retour
          </Button>
        }
        top={
          <Card className="shrink-0">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-base">Filtres</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {f.direction !== 'Toutes' ? (
                <p className="mb-3 text-xs text-muted-foreground">
                  Direction : <span className="font-medium text-foreground">{f.selectedDirectionLabel}</span>
                </p>
              ) : null}

              <FilterChoiceField
                label="Type d'abonnement"
                name="abonnement-type"
                value={abonnementType}
                onValueChange={(v) => setAbonnementType(v as AbonnementTypeFilter)}
                options={ABONNEMENT_TYPE_OPTIONS}
                labelClassName="text-xs text-muted-foreground"
                className="mb-4"
              />

              <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
                <FilterChoiceField
                  label="Statut"
                  name="abonnement-status"
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as AbonnementUiStatusFilter)}
                  options={STATUS_OPTIONS}
                  variant="select"
                  labelClassName="text-xs text-muted-foreground"
                  triggerClassName="h-9 w-[200px]"
                />

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Agence</Label>
                  <Select
                    value={selectedAgence || undefined}
                    onValueChange={(v) => {
                      setSelectedAgence(v)
                      setCollecteurFilter('Tous')
                    }}
                    disabled={f.isAgencesByDirectionLoading && f.direction !== 'Toutes'}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Choisir une agence">{selectedAgencyLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {agencyOptionsSorted.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {f.agencesByDirectionError ? (
                    <p className="text-xs text-destructive">{f.agencesByDirectionError}</p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Les collecteurs</Label>
                  <Select
                    value={collecteurFilter}
                    onValueChange={setCollecteurFilter}
                    disabled={collecteursLoading || !agenceCode}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder={collecteurSelectLabel}>
                        {collecteurFilterLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tous">{collecteurSelectLabel}</SelectItem>
                      {collecteurs.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {collecteursError ? (
                    <p className="max-w-[220px] text-xs text-destructive">{collecteursError}</p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Nom du client</Label>
                  <Input
                    className="w-[160px]"
                    value={nomClient}
                    onChange={(e) => setNomClient(e.target.value)}
                    placeholder="Rechercher…"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">LCE</Label>
                  <Input
                    className="w-[120px]"
                    value={lce}
                    onChange={(e) => setLce(e.target.value)}
                    placeholder="Compte LCE"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Date début</Label>
                  <Input
                    type="date"
                    className="w-[150px]"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Date fin</Label>
                  <Input
                    type="date"
                    className="w-[150px]"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                  />
                </div>

                <Button type="button" onClick={() => void handleSearch()} disabled={isLoading || !agenceCode}>
                  {isLoading ? 'Chargement…' : 'Filtrer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        }
        cardTitle="Liste des abonnements"
        cardDescription="Résultats filtrés — export Excel ou PDF de la liste complète affichée."
        toolbar={
          <div className="flex justify-end">
            <TableExportButtons
              disabled={!filtered.length || isLoading}
              onExportXls={exportXls}
              onExportPdf={exportPdf}
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

        <div className={TABLE_SCROLL_AREA_CLASS}>
          <table className="w-full min-w-[1020px] border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
              <tr className="[&>th]:px-2 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-medium [&>th]:text-xs">
                <th>Date</th>
                <th>N° Carte</th>
                <th>Code Client</th>
                <th>LES</th>
                <th>LCE</th>
                <th>Le collecteur</th>
                <th>Le client</th>
                <th className="text-right">Montant</th>
                <th>Téléphone</th>
                <th>État</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : null}

              {!isLoading && !filtered.length ? (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Aucun abonnement trouvé.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? tablePg.pageItems.map((row, idx) => {
                    const key = `${abonnementNumero(row) || idx}`
                    const incomplete = needsCompteCompletion(row)
                    return (
                      <tr key={key} className="hover:bg-muted/30">
                        <td className="px-2 py-2">{formatDate(row.dateAbonnement)}</td>
                        <td className="px-2 py-2 font-mono text-[11px]">{abonnementNumero(row) || '—'}</td>
                        <td className="px-2 py-2 font-mono text-[11px]">{row.codeClient ?? '—'}</td>
                        <td
                          className={[
                            'px-2 py-2 font-mono text-[11px]',
                            incomplete && !row.compteLes ? 'text-amber-700' : '',
                          ].join(' ')}
                        >
                          {row.compteLes ?? row.compteLesN ?? '—'}
                        </td>
                        <td
                          className={[
                            'px-2 py-2 font-mono text-[11px]',
                            incomplete && !row.compteLce ? 'text-amber-700' : '',
                          ].join(' ')}
                        >
                          {row.compteLce ?? row.compteLceN ?? '—'}
                        </td>
                        <td className="px-2 py-2" title={row.codeCollect ?? ''}>
                          {collecteurLabelForCode(row.codeCollect, collecteurs)}
                        </td>
                        <td className="px-2 py-2">{row.nomClient ?? '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatMontant(row.montantCollect)}</td>
                        <td className="px-2 py-2">{row.gsmprincipale ?? '—'}</td>
                        <td className="px-2 py-2">
                          <span
                            className={[
                              'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
                              row.status === 1
                                ? 'bg-green-100 text-green-800'
                                : row.status === 2
                                  ? 'bg-blue-100 text-blue-800'
                                  : row.status === 3
                                    ? 'bg-violet-100 text-violet-800'
                                    : row.status === 4
                                      ? 'bg-amber-100 text-amber-800'
                                      : row.status === 5
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-muted text-muted-foreground',
                            ].join(' ')}
                          >
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="info"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => setDetailRow(row)}
                            >
                              Détail
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="success"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => setCompteRow(row)}
                            >
                              Comptes
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="warning"
                              className="h-7 px-2 text-[10px] disabled:opacity-40"
                              disabled={!canReverseAbonnement(row)}
                              title={
                                canReverseAbonnement(row)
                                  ? 'Reversement (carte pleine)'
                                  : 'Disponible pour les cartes pleines (statut 2)'
                              }
                              onClick={() => setReverseRow(row)}
                            >
                              Reverser
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>

        {!isLoading && filtered.length > 0 ? (
          <div className="mt-3 shrink-0 text-xs text-muted-foreground">
            {filtered.length} abonnement{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
          </div>
        ) : null}
      </DashboardTablePageLayout>

      <AbonnementDetailSheet
        row={detailRow}
        open={detailRow != null}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null)
        }}
      />
      <AbonnementCompteSheet
        row={compteRow}
        open={compteRow != null}
        onOpenChange={(open) => {
          if (!open) setCompteRow(null)
        }}
        onSaved={() => void handleSearch()}
      />
      <AbonnementReversementSheet
        row={reverseRow}
        open={reverseRow != null}
        onOpenChange={(open) => {
          if (!open) setReverseRow(null)
        }}
        onDone={() => {
          setReverseRow(null)
          void handleSearch()
        }}
      />
    </>
  )
}
