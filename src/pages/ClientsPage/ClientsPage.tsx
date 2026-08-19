import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { TablePaginationBar } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, RefreshCw } from 'lucide-react'
import { DashboardPageTitle } from '@/components/DashboardPageTitle'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/animate-ui/components/radix/hover-card'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAgences } from '@/services/agence'
import { getAgencesByDirection, getDirectionRegionaleOptions } from '@/services/direction-regionale'
import { renvoyerParametreClient, searchClients, updateClient } from '@/services/client'
import type { SearchClientDto } from '@/services/openapi-components'
import {
  DASHBOARD_TABLE_PAGE_BODY_CLASS,
  DASHBOARD_TABLE_PAGE_CLASS,
  DASHBOARD_TABLE_PAGE_HEADER_CLASS,
  TABLE_SCROLL_AREA_CLASS,
  tableTheadClass,
} from '@/constants/table-styles'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { defaultCodeOperationRenvoiParametres } from '@/utils/default-code-operation'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { toAgencySelectOption } from '@/utils/organization-filters'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

function strField(d: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = d[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

type UiClientRow = {
  id: string
  codeClient: string
  nom: string
  telephone: string
  dateCreation: string
  compteLes: string
  compteLce: string
  agenceLabel: string
  login: string
  codeAgence?: string
  codeBanque?: string
  adresse?: string
  etat?: number
  email?: string
  codeOperation?: string
}

function mapApiToUiRow(
  raw: unknown,
  idx: number,
  opts: { agencyChoices: { value: string; label: string }[] },
): UiClientRow {
  const d = raw as Record<string, unknown>
  const login = strField(d, 'loginclient', 'login')
  const codeClient = strField(d, 'codeClient', 'codeclt', 'codecliorig') || login || `c-${idx}`
  const codeAgence = strField(d, 'codeAgence')
  const agenceLabel =
    (codeAgence && opts.agencyChoices.find((a) => a.value === codeAgence)?.label) || codeAgence || '—'
  const codeBanque = strField(d, 'codeBanque')
  const nom = strField(d, 'nomclient') || '—'
  const telephone = strField(d, 'gsmprincipale', 'telephoneFixe') || '—'
  const dateCreation = strField(d, 'datecreation', 'dateCreation') || '—'
  const compteLes = strField(d, 'compteLES', 'compteLes', 'cptLES', 'cptles') || '—'
  const compteLce = strField(d, 'compteLCE', 'compteLce', 'compteLCEN', 'cptLCE') || '—'
  const adresse = typeof d.adresse === 'string' ? d.adresse : undefined
  const etat = typeof d.etat === 'number' && Number.isFinite(d.etat) ? d.etat : undefined
  const email = strField(d, 'email') || undefined
  const coRaw = d.codeOperation
  const codeOperation =
    typeof coRaw === 'string'
      ? coRaw.trim() || undefined
      : typeof coRaw === 'number' && Number.isFinite(coRaw)
        ? String(coRaw)
        : undefined

  return {
    id: `${codeClient}_${idx}`,
    codeClient,
    nom,
    telephone,
    dateCreation,
    compteLes,
    compteLce,
    agenceLabel,
    login,
    codeAgence: codeAgence || undefined,
    codeBanque: codeBanque || undefined,
    adresse,
    etat,
    email,
    codeOperation,
  }
}

export function ClientsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const wantsInactive = params.get('inactive') === '1'

  const initialFilterDirection = params.get('direction') ?? 'Toutes'
  const initialFilterAgence = params.get('agence') ?? 'Toutes'
  const initialDateStart = params.get('dateStart') ?? ''
  const initialDateEnd = params.get('dateEnd') ?? ''

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterAgence, setFilterAgence] = useState<string>(initialFilterAgence)
  const [filterDirection, setFilterDirection] = useState<string>(initialFilterDirection)
  const [directionChoices, setDirectionChoices] = useState<{ value: string; label: string }[]>([])
  const [directionApiError, setDirectionApiError] = useState<string | null>(null)
  const [agencesAllRows, setAgencesAllRows] = useState<unknown[]>([])
  const [agencesByDirectionRows, setAgencesByDirectionRows] = useState<unknown[]>([])
  const [isAgencesByDirectionLoading, setIsAgencesByDirectionLoading] = useState(false)
  const [agencesByDirectionError, setAgencesByDirectionError] = useState<string | null>(null)
  const [agencyApiError, setAgencyApiError] = useState<string | null>(null)

  const [dateStart, setDateStart] = useState(initialDateStart)
  const [dateEnd, setDateEnd] = useState(initialDateEnd)
  const [apiSearch, setApiSearch] = useState('')
  const [apiCollecteur, setApiCollecteur] = useState('')
  const [telephone, setTelephone] = useState('')
  const [compteClient, setCompteClient] = useState('')
  const [compteLce, setCompteLce] = useState('')

  const [rows, setRows] = useState<UiClientRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showInactive] = useState<boolean>(wantsInactive)
  const [lastSearch, setLastSearch] = useState<{
    body: SearchClientDto
    query: { search?: string; collecteur?: string }
  } | null>(null)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UiClientRow | null>(null)
  const [editNom, setEditNom] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editTel, setEditTel] = useState('')
  const [editAdresse, setEditAdresse] = useState('')
  const [editEtat, setEditEtat] = useState('0')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [isSendOpen, setIsSendOpen] = useState(false)
  const [sendTarget, setSendTarget] = useState<UiClientRow | null>(null)
  const [sendCodeOperation, setSendCodeOperation] = useState('')
  const [sendCodeBanque, setSendCodeBanque] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  const agencyChoices = useMemo(() => {
    const source = filterDirection === 'Toutes' ? agencesAllRows : agencesByDirectionRows
    const options = source
      .map((a) => toAgencySelectOption(a))
      .filter((x): x is { value: string; label: string } => Boolean(x))
    const seen = new Set<string>()
    const uniq = options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)))
    uniq.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    return uniq
  }, [agencesAllRows, agencesByDirectionRows, filterDirection])

  const directionSelectLabel = useMemo(() => {
    if (filterDirection === 'Toutes') return 'Toutes'
    return directionChoices.find((d) => d.value === filterDirection)?.label ?? filterDirection
  }, [filterDirection, directionChoices])

  const agencySelectLabel = useMemo(() => {
    if (filterDirection !== 'Toutes' && isAgencesByDirectionLoading) return 'Chargement…'
    if (filterAgence === 'Toutes') return 'Toutes'
    return agencyChoices.find((a) => a.value === filterAgence)?.label ?? filterAgence
  }, [filterAgence, agencyChoices, filterDirection, isAgencesByDirectionLoading])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const opts = await getDirectionRegionaleOptions()
        if (cancelled) return
        setDirectionChoices(opts.map((o) => ({ value: o.value, label: o.label })))
        setDirectionApiError(null)
      } catch (err) {
        if (cancelled) return
        setDirectionChoices([])
        setDirectionApiError(err instanceof Error ? err.message : 'Impossible de charger les directions régionales')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const env = await getAgences()
        if (cancelled) return
        const raw = env.data
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((env as Record<string, unknown>).content)
            ? ((env as Record<string, unknown>).content as unknown[])
            : []
        setAgencesAllRows(list)
        setAgencyApiError(null)
      } catch (err) {
        if (cancelled) return
        setAgencesAllRows([])
        setAgencyApiError(err instanceof Error ? err.message : 'Impossible de charger les agences')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (filterDirection === 'Toutes') {
      setAgencesByDirectionRows([])
      setAgencesByDirectionError(null)
      setIsAgencesByDirectionLoading(false)
      return () => {
        cancelled = true
      }
    }

    setAgencesByDirectionRows([])
    setIsAgencesByDirectionLoading(true)
    setAgencesByDirectionError(null)
    setFilterAgence('Toutes')

    ;(async () => {
      try {
        const env = await getAgencesByDirection(filterDirection)
        if (cancelled) return
        setAgencesByDirectionRows(extractListFromApiEnvelope(env))
      } catch (err) {
        if (cancelled) return
        setAgencesByDirectionRows([])
        setAgencesByDirectionError(
          err instanceof Error ? err.message : 'Impossible de charger les agences pour cette direction',
        )
      } finally {
        if (!cancelled) setIsAgencesByDirectionLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filterDirection])

  useEffect(() => {
    if (filterAgence === 'Toutes') return
    if (!agencyChoices.length) {
      setFilterAgence('Toutes')
      return
    }
    if (!agencyChoices.some((a) => a.value === filterAgence)) {
      setFilterAgence('Toutes')
    }
  }, [agencyChoices, filterAgence])

  async function runSearch(body: SearchClientDto, query: { search?: string; collecteur?: string }) {
    setIsLoading(true)
    setLoadError(null)
    try {
      const payload = await searchClients(body, query)
      const data = Array.isArray(payload.data) ? payload.data : []
      const next = data.map((item, idx) =>
        mapApiToUiRow(item as unknown, idx, { agencyChoices }),
      )
      setRows(next)
      setLastSearch({ body, query })
    } catch (err) {
      setRows([])
      setLoadError(err instanceof Error ? err.message : 'Recherche impossible')
      setLastSearch(null)
    } finally {
      setIsLoading(false)
    }
  }

  const autoLoadedInactiveRef = useRef(false)
  useEffect(() => {
    if (!wantsInactive) return
    if (autoLoadedInactiveRef.current) return
    if (filterAgence === 'Toutes') return
    if (!dateStart.trim() || !dateEnd.trim()) return

    autoLoadedInactiveRef.current = true
    void runSearch(
      {
        codeAgence: filterAgence.trim(),
        dateDebut: dateStart.trim(),
        dateFin: dateEnd.trim(),
      },
      {
        search: apiSearch.trim() || undefined,
        collecteur: apiCollecteur.trim() || undefined,
      },
    )
  }, [apiCollecteur, apiSearch, dateEnd, dateStart, filterAgence, wantsInactive])

  async function refetchIfPossible() {
    if (!lastSearch) return
    await runSearch(lastSearch.body, lastSearch.query)
  }

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault()
    if (filterAgence === 'Toutes') {
      setLoadError('Choisissez une agence (filtres) avant de lancer la recherche.')
      return
    }
    if (!dateStart.trim() || !dateEnd.trim()) {
      setLoadError('Renseignez la période (date début et date fin).')
      return
    }
    setLoadError(null)
    void runSearch(
      {
        codeAgence: filterAgence.trim(),
        dateDebut: dateStart.trim(),
        dateFin: dateEnd.trim(),
      },
      {
        search: apiSearch.trim() || undefined,
        collecteur: apiCollecteur.trim() || undefined,
      },
    )
  }

  const filtered = useMemo(() => {
    let out = rows
    const tel = telephone.trim().toLowerCase()
    const cClient = compteClient.trim().toLowerCase()
    const cLce = compteLce.trim().toLowerCase()
    if (tel) out = out.filter((r) => String(r.telephone ?? '').toLowerCase().includes(tel))
    if (cClient) out = out.filter((r) => String(r.compteLes ?? '').toLowerCase().includes(cClient))
    if (cLce) out = out.filter((r) => String(r.compteLce ?? '').toLowerCase().includes(cLce))
    if (showInactive) {
      // Convention UI: `etat === 1` = actif, tout le reste = inactif.
      out = out.filter((r) => (r.etat ?? 0) !== 1)
    }
    return out
  }, [compteClient, compteLce, rows, showInactive, telephone])
  const tablePg = useTablePagination(filtered)

  function openEdit(row: UiClientRow) {
    const login = row.login.trim()
    setEditError(null)
    setEditSuccess(null)
    if (!login) {
      setEditTarget(row)
      setEditNom('')
      setEditEmail('')
      setEditTel('')
      setEditAdresse('')
      setEditEtat('0')
      setEditError('Identifiant client absent : mise à jour impossible.')
      setIsEditOpen(true)
      return
    }
    setEditTarget(row)
    setEditNom(row.nom === '—' ? '' : row.nom)
    setEditEmail(row.email ?? '')
    setEditTel(row.telephone === '—' ? '' : row.telephone)
    setEditAdresse(row.adresse ?? '')
    setEditEtat(String(row.etat ?? 0))
    setIsEditOpen(true)
  }

  async function submitEdit() {
    const login = (editTarget?.login ?? '').trim()
    setEditError(null)
    setEditSuccess(null)
    if (!login) {
      setEditError('Identifiant client manquant.')
      return
    }
    const etatNum = Number.parseInt(editEtat, 10)
    if (!Number.isFinite(etatNum)) {
      setEditError('État : nombre invalide.')
      return
    }
    setIsSavingEdit(true)
    try {
      await updateClient(login, {
        nomclient: editNom.trim() || undefined,
        email: editEmail.trim() || undefined,
        gsmprincipale: editTel.trim() || undefined,
        adresse: editAdresse.trim() || undefined,
        etat: etatNum,
      })
      setEditSuccess('Client mis à jour.')
      await refetchIfPossible()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Échec de la mise à jour.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  function openSend(row: UiClientRow) {
    setSendTarget(row)
    const fromRow = (row.codeOperation ?? '').trim()
    setSendCodeOperation(fromRow || defaultCodeOperationRenvoiParametres())
    setSendCodeBanque((row.codeBanque ?? '').trim())
    setSendError(null)
    setSendSuccess(null)
    setIsSendOpen(true)
  }

  async function submitSend() {
    const login = (sendTarget?.login ?? '').trim()
    const codeOperation = sendCodeOperation.trim()
    const codeBanque = sendCodeBanque.trim()
    setSendError(null)
    setSendSuccess(null)
    if (!login) {
      setSendError('Identifiant client absent : impossible d’envoyer les paramètres.')
      return
    }
    if (!codeOperation) {
      setSendError('Veuillez renseigner le codeOperation.')
      return
    }
    if (!codeBanque) {
      setSendError('Veuillez renseigner le codeBanque.')
      return
    }
    setIsSending(true)
    try {
      const res = await renvoyerParametreClient({ codeOperation, codeBanque, login })
      setSendSuccess(res.message || 'Paramètres renvoyés.')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Échec du renvoi.')
    } finally {
      setIsSending(false)
    }
  }

  const CLIENT_EXPORT_HEADERS = [
    'Code client',
    'Nom',
    'Téléphone',
    'Date création',
    'COMPTE LES',
    'COMPTE LCE',
    'Agence',
  ] as const

  function exportClientsXls() {
    if (!filtered.length) return
    exportJsonToXlsx(
      'clients',
      'Clients',
      filtered.map((r) => ({
        'Code client': r.codeClient,
        Nom: r.nom,
        Téléphone: r.telephone,
        'Date création': r.dateCreation,
        'COMPTE LES': r.compteLes,
        'COMPTE LCE': r.compteLce,
        Agence: r.agenceLabel,
      })),
    )
  }

  function exportClientsPdf() {
    if (!filtered.length) return
    exportTableToPdf(
      'Gestion des clients',
      'clients',
      [...CLIENT_EXPORT_HEADERS],
      filtered.map((r) => [
        r.codeClient,
        r.nom,
        r.telephone,
        r.dateCreation,
        r.compteLes,
        r.compteLce,
        r.agenceLabel,
      ]),
    )
  }

  return (
    <>
      <div className={DASHBOARD_TABLE_PAGE_CLASS}>
        <div className={DASHBOARD_TABLE_PAGE_HEADER_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardPageTitle title="Gestion des clients" section="Dashboard" />
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
              Retour dashboard
            </Button>
            <Button type="button" disabled>
              Nouveau
            </Button>
          </div>
          </div>
        </div>

        <div className={DASHBOARD_TABLE_PAGE_BODY_CLASS}>
          <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CardHeader className="shrink-0 border-b border-border">
            <CardTitle>Clients</CardTitle>
            <CardDescription>
              Recherche par agence et période, filtres locaux sur le résultat, modification et renvoi des paramètres.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col pt-4">
            <form onSubmit={onSubmitSearch} className="shrink-0 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Button type="button" size="sm" variant="outline" onClick={() => setIsFilterOpen(true)}>
                  Filtre
                </Button>
                <div className="text-xs text-muted-foreground">
                  Agence sélectionnée :{' '}
                  <span className="font-medium text-foreground">{filterAgence === 'Toutes' ? '—' : agencySelectLabel}</span>
                  {showInactive ? (
                    <div className="mt-1 text-sm font-semibold text-destructive">Affichage : clients inactifs</div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Période (début)</Label>
                  <Input className="mt-1" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} required />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Période (fin)</Label>
                  <Input className="mt-1" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} required />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Recherche</Label>
                  <Input
                    className="mt-1"
                    value={apiSearch}
                    onChange={(e) => setApiSearch(e.target.value)}
                    placeholder="Optionnel"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Collecteur</Label>
                  <Input
                    className="mt-1"
                    value={apiCollecteur}
                    onChange={(e) => setApiCollecteur(e.target.value)}
                    placeholder="Optionnel"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Filtrer téléphone (local)</Label>
                  <Input className="mt-1" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+225…" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Filtrer compte LES (local)</Label>
                  <Input className="mt-1" value={compteClient} onChange={(e) => setCompteClient(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Filtrer compte LCE (local)</Label>
                  <Input className="mt-1" value={compteLce} onChange={(e) => setCompteLce(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={exportClientsXls}
                  disabled={!filtered.length}
                >
                  Export XLS
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={exportClientsPdf}
                  disabled={!filtered.length}
                >
                  Export PDF
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setDateStart('')
                    setDateEnd('')
                    setApiSearch('')
                    setApiCollecteur('')
                    setTelephone('')
                    setCompteClient('')
                    setCompteLce('')
                    setRows([])
                    setLastSearch(null)
                    setLoadError(null)
                  }}
                >
                  Réinitialiser
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Recherche…' : 'Rechercher'}
                </Button>
              </div>
            </form>

            <div className={`mt-4 ${TABLE_SCROLL_AREA_CLASS}`}>
              {loadError ? (
                <div className="shrink-0 border-b border-border bg-destructive/5 px-4 py-3 text-sm text-destructive">{loadError}</div>
              ) : null}
              <table className="w-full table-fixed border-collapse text-xs">
                <thead className={tableTheadClass({ sticky: true })}>
                  <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                    <th className="w-[9%]">Code</th>
                    <th className="w-[16%]">Nom</th>
                    <th className="w-[10%]">Téléphone</th>
                    <th className="w-[10%]">Date création</th>
                    <th className="w-[14%]">COMPTE LES</th>
                    <th className="w-[14%]">COMPTE LCE</th>
                    <th className="w-[12%]">Agence</th>
                    <th className="w-[15%] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : null}
                  {!isLoading &&
                    tablePg.pageItems.map((r) => (
                      <tr key={r.id} className="[&>td]:px-2 [&>td]:py-2">
                        <td className="truncate font-medium">{r.codeClient}</td>
                        <td className="truncate" title={r.nom}>
                          {r.nom}
                        </td>
                        <td className="truncate" title={r.telephone}>
                          {r.telephone}
                        </td>
                        <td className="truncate">{r.dateCreation}</td>
                        <td className="truncate" title={r.compteLes}>
                          {r.compteLes}
                        </td>
                        <td className="truncate" title={r.compteLce}>
                          {r.compteLce}
                        </td>
                        <td className="truncate" title={r.agenceLabel}>
                          {r.agenceLabel}
                        </td>
                        <td className="text-center">
                          <div className="inline-flex flex-wrap justify-center gap-1">
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon-xs"
                                  variant="outline"
                                  aria-label="Modifier"
                                  onClick={() => openEdit(r)}
                                >
                                  <Pencil />
                                </Button>
                              </HoverCardTrigger>
                              <HoverCardContent side="top" align="center" className="w-56">
                                <div className="text-sm font-semibold">Modifier</div>
                                <div className="mt-1 text-xs text-muted-foreground">Mettre à jour le client.</div>
                              </HoverCardContent>
                            </HoverCard>
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon-xs"
                                  variant="secondary"
                                  aria-label="Renvoyer paramètres"
                                  onClick={() => openSend(r)}
                                >
                                  <RefreshCw />
                                </Button>
                              </HoverCardTrigger>
                              <HoverCardContent side="top" align="center" className="w-56">
                                <div className="text-sm font-semibold">Renvoyer paramètres</div>
                                <div className="mt-1 text-xs text-muted-foreground">Connexion / paramètres.</div>
                              </HoverCardContent>
                            </HoverCard>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!isLoading && !filtered.length ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                        {rows.length
                          ? 'Aucun résultat après filtrage local.'
                          : lastSearch
                            ? 'Aucun client pour cette recherche.'
                            : 'Lancez une recherche (agence + période).'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <TablePaginationBar {...tablePg} />
          </CardContent>
        </Card>
        </div>
      </div>

      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent side="right" className="w-[92vw] sm:w-[420px]">
          <SheetHeader>
            <SheetTitle>Filtres</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <div className="grid gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Direction régionale</Label>
                <Select value={filterDirection} onValueChange={(v) => v && setFilterDirection(v)}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Choisir">{directionSelectLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Toutes">Toutes</SelectItem>
                    {directionChoices.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {directionApiError ? <div className="mt-2 text-xs text-destructive">{directionApiError}</div> : null}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Agence</Label>
                <Select
                  value={filterAgence}
                  onValueChange={(v) => v && setFilterAgence(v)}
                  disabled={filterDirection !== 'Toutes' && isAgencesByDirectionLoading}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Choisir">{agencySelectLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Toutes">Toutes</SelectItem>
                    {agencyChoices.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filterDirection !== 'Toutes' ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {isAgencesByDirectionLoading
                      ? 'Chargement des agences liées à cette direction…'
                      : 'Seules les agences rattachées à cette direction sont proposées.'}
                  </p>
                ) : null}
                {agencyApiError ? <div className="mt-2 text-xs text-destructive">{agencyApiError}</div> : null}
                {agencesByDirectionError ? (
                  <div className="mt-2 text-xs text-destructive">{agencesByDirectionError}</div>
                ) : null}
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFilterAgence('Toutes')
                setFilterDirection('Toutes')
              }}
            >
              Réinitialiser
            </Button>
            <Button type="button" onClick={() => setIsFilterOpen(false)}>
              Appliquer
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open)
          if (!open) {
            setEditTarget(null)
            setEditError(null)
            setEditSuccess(null)
          }
        }}
      >
        <SheetContent side="right" className="w-[92vw] sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Modifier le client</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-2">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="cli-code" className="text-xs text-muted-foreground">
                  Code client
                </Label>
                <Input id="cli-code" value={editTarget?.codeClient ?? ''} disabled className="mt-1 font-mono" />
              </div>
              <div>
                <Label htmlFor="cli-nom" className="text-xs text-muted-foreground">
                  Nom
                </Label>
                <Input id="cli-nom" value={editNom} onChange={(e) => setEditNom(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cli-email" className="text-xs text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="cli-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cli-tel" className="text-xs text-muted-foreground">
                  Téléphone (GSM)
                </Label>
                <Input id="cli-tel" value={editTel} onChange={(e) => setEditTel(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cli-adr" className="text-xs text-muted-foreground">
                  Adresse
                </Label>
                <Input id="cli-adr" value={editAdresse} onChange={(e) => setEditAdresse(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cli-etat" className="text-xs text-muted-foreground">
                  État
                </Label>
                <Input
                  id="cli-etat"
                  type="number"
                  inputMode="numeric"
                  value={editEtat}
                  onChange={(e) => setEditEtat(e.target.value)}
                  className="mt-1"
                />
              </div>
              {editError ? <div className="text-sm text-destructive">{editError}</div> : null}
              {editSuccess ? <div className="text-sm text-emerald-700">{editSuccess}</div> : null}
            </div>
          </div>
          <SheetFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsEditOpen(false)
                setEditTarget(null)
              }}
              disabled={isSavingEdit}
            >
              Fermer
            </Button>
            <Button type="button" onClick={() => void submitEdit()} disabled={isSavingEdit}>
              {isSavingEdit ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isSendOpen}
        onOpenChange={(open) => {
          setIsSendOpen(open)
          if (!open) {
            setSendTarget(null)
            setSendError(null)
            setSendSuccess(null)
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
                <div className="font-medium text-foreground">{sendTarget?.nom || 'Client'}</div>
              </div>
              <div>
                <Label htmlFor="cli-send-op" className="text-xs text-muted-foreground">
                  codeOperation
                </Label>
                <Input id="cli-send-op" value={sendCodeOperation} onChange={(e) => setSendCodeOperation(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cli-send-bank" className="text-xs text-muted-foreground">
                  codeBanque
                </Label>
                <Input id="cli-send-bank" value={sendCodeBanque} onChange={(e) => setSendCodeBanque(e.target.value)} className="mt-1" />
              </div>
              {sendError ? <div className="text-sm text-destructive">{sendError}</div> : null}
              {sendSuccess ? <div className="text-sm text-primary">{sendSuccess}</div> : null}
            </div>
          </div>
          <SheetFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsSendOpen(false)
                setSendTarget(null)
              }}
              disabled={isSending}
            >
              Fermer
            </Button>
            <Button type="button" onClick={() => void submitSend()} disabled={isSending || !(sendTarget?.login ?? '').trim()}>
              {isSending ? 'Envoi…' : 'Envoyer'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
