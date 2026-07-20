import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TablePaginationBar } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Building2, Pencil, RefreshCw } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/animate-ui/components/radix/hover-card'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  changementAgenceCollecteur,
  listCollecteursParAgence,
  renvoyerParametreCollecteur,
  updateCollecteur,
} from '@/services/collecteur'
import { TABLE_SCROLL_AREA_CLASS, tableTheadClass } from '@/constants/table-styles'
import { DashboardTablePageLayout } from '@/layouts/DashboardTablePageLayout'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import { getConnectedUserLogin } from '@/utils/connected-user-login'
import { defaultCodeOperationRenvoiParametres } from '@/utils/default-code-operation'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { exportJsonToXlsx, exportTableToPdf } from '@/utils/table-export'

function normalizeCollecteurLogin(row: Record<string, unknown>): string {
  const lc = row.loginclient
  if (typeof lc === 'string' && lc.trim()) return lc.trim()
  const l = row.login
  if (typeof l === 'string' && l.trim()) return l.trim()
  if (typeof l === 'number' && Number.isFinite(l)) return String(l)
  return ''
}

type CollecteurRow = {
  id: string
  codeClient: string
  nom: string
  directionLabel: string
  agenceLabel: string
  compteAffiche: string
  telephone: string
  login: string
  codeAgence?: string
  codeBanque?: string
  adresse?: string
  etat?: number
  codeOperation?: string
  email?: string
}

export function CollecteursPage() {
  const navigate = useNavigate()
  const f = useDashboardFilters()
  const [filterText, setFilterText] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [rows, setRows] = useState<CollecteurRow[]>([])

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CollecteurRow | null>(null)
  const [editNom, setEditNom] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editTel, setEditTel] = useState('')
  const [editAdresse, setEditAdresse] = useState('')
  const [editEtat, setEditEtat] = useState('0')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [isChangeAgenceOpen, setIsChangeAgenceOpen] = useState(false)
  const [changeTarget, setChangeTarget] = useState<CollecteurRow | null>(null)
  const [caNom, setCaNom] = useState('')
  const [caEmail, setCaEmail] = useState('')
  const [caTel, setCaTel] = useState('')
  const [caAdresse, setCaAdresse] = useState('')
  const [caEtat, setCaEtat] = useState('0')
  const [caNewAgence, setCaNewAgence] = useState('')
  const [caError, setCaError] = useState<string | null>(null)
  const [isSavingChangeAgence, setIsSavingChangeAgence] = useState(false)

  const [isSendParamsOpen, setIsSendParamsOpen] = useState(false)
  const [sendTarget, setSendTarget] = useState<CollecteurRow | null>(null)
  const [sendCodeOperation, setSendCodeOperation] = useState('')
  const [sendCodeBanque, setSendCodeBanque] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [isSendingParams, setIsSendingParams] = useState(false)

  const agencyOptionsSorted = useMemo(() => {
    return [...f.agences].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  }, [f.agences])

  useEffect(() => {
    let cancelled = false
    const code = f.agency === 'Toutes' ? '' : f.agency.trim()
    if (!code) {
      setRows([])
      setLoadError(null)
      setIsLoading(false)
      return () => {
        cancelled = true
      }
    }

    const dirLabel = f.direction === 'Toutes' ? '—' : f.selectedDirectionLabel

    ;(async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const payload = await listCollecteursParAgence(code)
        if (cancelled) return
        const data = Array.isArray(payload.data) ? payload.data : []

        const next: CollecteurRow[] = data.map((item, idx) => {
          const d = item as Record<string, unknown>
          const login = normalizeCollecteurLogin(d)
          const codeClient =
            typeof d.codeClient === 'string'
              ? d.codeClient.trim()
              : typeof d.codeClient === 'number' && Number.isFinite(d.codeClient)
                ? String(d.codeClient)
                : login || `—${idx}`
          const codeAgenceRaw = d.codeAgence
          const codeAgence =
            typeof codeAgenceRaw === 'string'
              ? codeAgenceRaw.trim()
              : typeof codeAgenceRaw === 'number' && Number.isFinite(codeAgenceRaw)
                ? String(codeAgenceRaw)
                : undefined
          const agenceLabel =
            (codeAgence && f.agences.find((a) => a.value === codeAgence)?.label) || codeAgence || code || '—'
          const codeBanqueRaw = d.codeBanque
          const codeBanque =
            typeof codeBanqueRaw === 'string'
              ? codeBanqueRaw.trim()
              : typeof codeBanqueRaw === 'number' && Number.isFinite(codeBanqueRaw)
                ? String(codeBanqueRaw)
                : undefined
          const gsm = d.gsmprincipale
          const telephone =
            typeof gsm === 'string' ? gsm : typeof gsm === 'number' && Number.isFinite(gsm) ? String(gsm) : '—'
          const nom = typeof d.nomclient === 'string' && d.nomclient.trim() ? d.nomclient.trim() : '—'
          const email = typeof d.email === 'string' && d.email.trim() ? d.email.trim() : undefined
          const adresse = typeof d.adresse === 'string' ? d.adresse : undefined
          const etat = typeof d.etat === 'number' && Number.isFinite(d.etat) ? d.etat : undefined
          const coRaw = d.codeOperation
          const codeOperation =
            typeof coRaw === 'string'
              ? coRaw.trim() || undefined
              : typeof coRaw === 'number' && Number.isFinite(coRaw)
                ? String(coRaw)
                : undefined

          return {
            id: `${code}_${codeClient}_${idx}`,
            codeClient,
            nom,
            directionLabel: dirLabel,
            agenceLabel,
            compteAffiche: codeClient,
            telephone,
            login,
            codeAgence,
            codeBanque,
            adresse,
            etat,
            codeOperation,
            email,
          }
        })
        setRows(next)
      } catch (err) {
        if (cancelled) return
        setRows([])
        setLoadError(err instanceof Error ? err.message : 'Impossible de charger les collecteurs')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [f.agency])

  const displayedRows = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.codeClient, r.nom, r.login, r.telephone, r.agenceLabel, r.compteAffiche].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(q),
      ),
    )
  }, [rows, filterText])
  const tablePg = useTablePagination(displayedRows)

  function resolveOldCodeAgence(row: CollecteurRow): string {
    const from = (row.codeAgence ?? '').trim()
    if (from) return from
    const ag = (row.agenceLabel ?? '').trim()
    if (ag && ag !== '—') {
      const hit = f.agences.find((a) => a.label === ag || a.value === ag)
      if (hit?.value) return hit.value.trim()
    }
    return ''
  }

  function openEdit(row: CollecteurRow) {
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
      setEditError('Identifiant collecteur absent : mise à jour impossible.')
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
      setEditError('Identifiant collecteur manquant.')
      return
    }
    const etatNum = Number.parseInt(editEtat, 10)
    if (!Number.isFinite(etatNum)) {
      setEditError('État : nombre invalide.')
      return
    }
    setIsSavingEdit(true)
    try {
      await updateCollecteur(login, {
        nomclient: editNom.trim() || undefined,
        email: editEmail.trim() || undefined,
        gsmprincipale: editTel.trim() || undefined,
        adresse: editAdresse.trim() || undefined,
        etat: etatNum,
      })
      setEditSuccess('Collecteur mis à jour.')
      if (f.agency !== 'Toutes') {
        const code = f.agency.trim()
        const payload = await listCollecteursParAgence(code)
        const data = Array.isArray(payload.data) ? payload.data : []
        const dirLabel = f.direction === 'Toutes' ? '—' : f.selectedDirectionLabel
        setRows(
          data.map((item, idx) => {
            const d = item as Record<string, unknown>
            const lg = normalizeCollecteurLogin(d)
            const cc =
              typeof d.codeClient === 'string'
                ? d.codeClient.trim()
                : typeof d.codeClient === 'number' && Number.isFinite(d.codeClient)
                  ? String(d.codeClient)
                  : lg || `—${idx}`
            const codeAgenceRaw = d.codeAgence
            const codeAgence =
              typeof codeAgenceRaw === 'string'
                ? codeAgenceRaw.trim()
                : typeof codeAgenceRaw === 'number' && Number.isFinite(codeAgenceRaw)
                  ? String(codeAgenceRaw)
                  : undefined
            const agenceLabel =
              (codeAgence && f.agences.find((a) => a.value === codeAgence)?.label) || codeAgence || code || '—'
            const codeBanqueRaw = d.codeBanque
            const codeBanque =
              typeof codeBanqueRaw === 'string'
                ? codeBanqueRaw.trim()
                : typeof codeBanqueRaw === 'number' && Number.isFinite(codeBanqueRaw)
                  ? String(codeBanqueRaw)
                  : undefined
            const gsm = d.gsmprincipale
            const telephone =
              typeof gsm === 'string' ? gsm : typeof gsm === 'number' && Number.isFinite(gsm) ? String(gsm) : '—'
            const nom = typeof d.nomclient === 'string' && d.nomclient.trim() ? d.nomclient.trim() : '—'
            const email = typeof d.email === 'string' && d.email.trim() ? d.email.trim() : undefined
            const adresse = typeof d.adresse === 'string' ? d.adresse : undefined
            const etat = typeof d.etat === 'number' && Number.isFinite(d.etat) ? d.etat : undefined
            const coRaw = d.codeOperation
            const codeOperation =
              typeof coRaw === 'string'
                ? coRaw.trim() || undefined
                : typeof coRaw === 'number' && Number.isFinite(coRaw)
                  ? String(coRaw)
                  : undefined
            return {
              id: `${code}_${cc}_${idx}`,
              codeClient: cc,
              nom,
              directionLabel: dirLabel,
              agenceLabel,
              compteAffiche: cc,
              telephone,
              login: lg,
              codeAgence,
              codeBanque,
              adresse,
              etat,
              codeOperation,
              email,
            }
          }),
        )
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Échec de la mise à jour.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  function openChangeAgence(row: CollecteurRow) {
    setChangeTarget(row)
    setCaNom(row.nom === '—' ? '' : row.nom)
    setCaEmail(row.email ?? '')
    setCaTel(row.telephone === '—' ? '' : row.telephone)
    setCaAdresse(row.adresse ?? '')
    setCaEtat(String(row.etat ?? 0))
    setCaNewAgence('')
    setCaError(
      row.login.trim() ? null : 'Identifiant collecteur manquant : opération impossible une fois le formulaire validé.',
    )
    setIsChangeAgenceOpen(true)
  }

  async function submitChangeAgence() {
    const row = changeTarget
    const loginCollecteur = (row?.login ?? '').trim()
    const loginUtilisaateur = getConnectedUserLogin()
    setCaError(null)
    if (!loginCollecteur) {
      setCaError('Identifiant collecteur manquant.')
      return
    }
    if (!loginUtilisaateur) {
      setCaError('Session : identifiant de l’utilisateur connecté introuvable (reconnexion nécessaire).')
      return
    }
    const oldCode = row ? resolveOldCodeAgence(row) : ''
    if (!oldCode) {
      setCaError('Ancienne agence inconnue pour ce collecteur.')
      return
    }
    const newCode = caNewAgence.trim()
    if (!newCode) {
      setCaError('Veuillez choisir la nouvelle agence.')
      return
    }
    if (newCode === oldCode) {
      setCaError('La nouvelle agence doit être différente de l’actuelle.')
      return
    }
    const etatNum = Number.parseInt(caEtat, 10)
    if (!Number.isFinite(etatNum)) {
      setCaError('État : nombre invalide.')
      return
    }
    setIsSavingChangeAgence(true)
    try {
      await updateCollecteur(loginCollecteur, {
        nomclient: caNom.trim() || undefined,
        email: caEmail.trim() || undefined,
        gsmprincipale: caTel.trim() || undefined,
        adresse: caAdresse.trim() || undefined,
        etat: etatNum,
      })
      await changementAgenceCollecteur({
        loginUtilisaateur,
        loginCollecteur,
        newAgence: newCode,
      })
      setIsChangeAgenceOpen(false)
      setChangeTarget(null)
      if (f.agency !== 'Toutes') {
        const payload = await listCollecteursParAgence(f.agency.trim())
        const data = Array.isArray(payload.data) ? payload.data : []
        const dirLabel = f.direction === 'Toutes' ? '—' : f.selectedDirectionLabel
        setRows(
          data.map((item, idx) => {
            const d = item as Record<string, unknown>
            const lg = normalizeCollecteurLogin(d)
            const cc =
              typeof d.codeClient === 'string'
                ? d.codeClient.trim()
                : typeof d.codeClient === 'number' && Number.isFinite(d.codeClient)
                  ? String(d.codeClient)
                  : lg || `—${idx}`
            const codeAgenceRaw = d.codeAgence
            const codeAgence =
              typeof codeAgenceRaw === 'string'
                ? codeAgenceRaw.trim()
                : typeof codeAgenceRaw === 'number' && Number.isFinite(codeAgenceRaw)
                  ? String(codeAgenceRaw)
                  : undefined
            const ag = f.agency.trim()
            const agenceLabel =
              (codeAgence && f.agences.find((a) => a.value === codeAgence)?.label) || codeAgence || ag || '—'
            const codeBanqueRaw = d.codeBanque
            const codeBanque =
              typeof codeBanqueRaw === 'string'
                ? codeBanqueRaw.trim()
                : typeof codeBanqueRaw === 'number' && Number.isFinite(codeBanqueRaw)
                  ? String(codeBanqueRaw)
                  : undefined
            const gsm = d.gsmprincipale
            const telephone =
              typeof gsm === 'string' ? gsm : typeof gsm === 'number' && Number.isFinite(gsm) ? String(gsm) : '—'
            const nom = typeof d.nomclient === 'string' && d.nomclient.trim() ? d.nomclient.trim() : '—'
            const email = typeof d.email === 'string' && d.email.trim() ? d.email.trim() : undefined
            const adresse = typeof d.adresse === 'string' ? d.adresse : undefined
            const etat = typeof d.etat === 'number' && Number.isFinite(d.etat) ? d.etat : undefined
            const coRaw = d.codeOperation
            const codeOperation =
              typeof coRaw === 'string'
                ? coRaw.trim() || undefined
                : typeof coRaw === 'number' && Number.isFinite(coRaw)
                  ? String(coRaw)
                  : undefined
            return {
              id: `${ag}_${cc}_${idx}`,
              codeClient: cc,
              nom,
              directionLabel: dirLabel,
              agenceLabel,
              compteAffiche: cc,
              telephone,
              login: lg,
              codeAgence,
              codeBanque,
              adresse,
              etat,
              codeOperation,
              email,
            }
          }),
        )
      }
    } catch (err) {
      setCaError(err instanceof Error ? err.message : 'Échec de l’opération.')
    } finally {
      setIsSavingChangeAgence(false)
    }
  }

  function openSendParams(row: CollecteurRow) {
    setSendTarget(row)
    const fromRow = (row.codeOperation ?? '').trim()
    setSendCodeOperation(fromRow || defaultCodeOperationRenvoiParametres())
    setSendCodeBanque((row.codeBanque ?? '').trim())
    setSendError(null)
    setSendSuccess(null)
    setIsSendParamsOpen(true)
  }

  async function submitSendParams() {
    const login = (sendTarget?.login ?? '').trim()
    const codeOperation = sendCodeOperation.trim()
    const codeBanque = sendCodeBanque.trim()
    setSendError(null)
    setSendSuccess(null)
    if (!login) {
      setSendError('Identifiant collecteur absent : impossible d’envoyer les paramètres.')
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
    setIsSendingParams(true)
    try {
      const res = await renvoyerParametreCollecteur({
        codeOperation,
        codeBanque,
        login,
      })
      setSendSuccess(res.message || 'Paramètres renvoyés.')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Échec du renvoi.')
    } finally {
      setIsSendingParams(false)
    }
  }

  const COLLECTEUR_EXPORT_HEADERS = [
    'Code client',
    'Nom',
    'Direction',
    'Agence',
    'Compte',
    'Téléphone',
    'État',
  ] as const

  function exportCollecteursXls() {
    if (!displayedRows.length) return
    exportJsonToXlsx(
      'collecteurs',
      'Collecteurs',
      displayedRows.map((r) => ({
        'Code client': r.codeClient,
        Nom: r.nom,
        Direction: r.directionLabel,
        Agence: r.agenceLabel,
        Compte: r.compteAffiche,
        Téléphone: r.telephone,
        État: r.etat === 0 || r.etat ? String(r.etat) : '—',
      })),
    )
  }

  function exportCollecteursPdf() {
    if (!displayedRows.length) return
    exportTableToPdf(
      'Gestion des collecteurs',
      'collecteurs',
      [...COLLECTEUR_EXPORT_HEADERS],
      displayedRows.map((r) => [
        r.codeClient,
        r.nom,
        r.directionLabel,
        r.agenceLabel,
        r.compteAffiche,
        r.telephone,
        r.etat === 0 || r.etat ? String(r.etat) : '—',
      ]),
    )
  }

  return (
    <>
      <DashboardTablePageLayout
        section="Dashboard"
        title="Gestion des collecteurs"
        headerActions={
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
            Retour dashboard
          </Button>
        }
        cardTitle="Collecteurs"
        cardDescription="Liste par agence — modifier, changer d’agence ou renvoyer les paramètres."
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="w-full sm:max-w-sm">
                <Input
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filtrer dans la liste chargée…"
                />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setIsFilterOpen(true)}>
                Filtre
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={exportCollecteursXls}
                disabled={!displayedRows.length}
              >
                Export XLS
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={exportCollecteursPdf}
                disabled={!displayedRows.length}
              >
                Export PDF
              </Button>
          </div>
        }
        pagination={<TablePaginationBar {...tablePg} />}
      >
        <div className={TABLE_SCROLL_AREA_CLASS}>
          {loadError ? (
            <div className="shrink-0 border-b border-border bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          ) : null}
          <table className="w-full table-fixed border-collapse text-xs">
            <thead className={tableTheadClass({ sticky: true })}>
                  <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                    <th className="w-[10%]">Code client</th>
                    <th className="w-[16%]">Nom</th>
                    <th className="w-[12%]">Direction</th>
                    <th className="w-[14%]">Agence</th>
                    <th className="w-[12%]">Compte</th>
                    <th className="w-[10%]">Téléphone</th>
                    <th className="w-[6%]">État</th>
                    <th className="w-[20%] text-center">Actions</th>
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
                  {!isLoading && f.agency === 'Toutes' ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        Choisissez une agence dans les filtres pour charger les collecteurs.
                      </td>
                    </tr>
                  ) : null}
                  {!isLoading && f.agency !== 'Toutes'
                    ? tablePg.pageItems.map((r) => (
                        <tr key={r.id} className="[&>td]:px-2 [&>td]:py-2">
                          <td className="truncate font-medium">{r.codeClient}</td>
                          <td className="truncate" title={r.nom}>
                            {r.nom}
                          </td>
                          <td className="truncate" title={r.directionLabel}>
                            {r.directionLabel}
                          </td>
                          <td className="truncate" title={r.agenceLabel}>
                            {r.agenceLabel}
                          </td>
                          <td className="truncate" title={r.compteAffiche}>
                            {r.compteAffiche}
                          </td>
                          <td className="truncate" title={r.telephone}>
                            {r.telephone}
                          </td>
                          <td className="truncate">{r.etat === 0 || r.etat ? String(r.etat) : '—'}</td>
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
                                  <div className="mt-1 text-xs text-muted-foreground">Mettre à jour le collecteur.</div>
                                </HoverCardContent>
                              </HoverCard>
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon-xs"
                                    variant="secondary"
                                    aria-label="Changer d’agence"
                                    onClick={() => openChangeAgence(r)}
                                  >
                                    <Building2 />
                                  </Button>
                                </HoverCardTrigger>
                                <HoverCardContent side="top" align="center" className="w-56">
                                  <div className="text-sm font-semibold">Changer d’agence</div>
                                  <div className="mt-1 text-xs text-muted-foreground">Réaffecter à une autre agence.</div>
                                </HoverCardContent>
                              </HoverCard>
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon-xs"
                                    variant="secondary"
                                    aria-label="Renvoyer paramètres"
                                    onClick={() => openSendParams(r)}
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
                      ))
                    : null}
                  {!isLoading && f.agency !== 'Toutes' && !displayedRows.length ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        Aucun collecteur pour cette agence.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
          </table>
        </div>
      </DashboardTablePageLayout>

      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent side="right" className="w-[92vw] sm:w-[420px]">
          <SheetHeader>
            <SheetTitle>Filtres</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <div className="grid gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Direction régionale</Label>
                <Select value={f.direction} onValueChange={(v) => v && f.setDirection(v)}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Choisir">{f.selectedDirectionLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {f.directionOptions.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {f.directionLoadError ? (
                  <div className="mt-2 text-xs text-destructive">{f.directionLoadError}</div>
                ) : null}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Agence</Label>
                <Select
                  value={f.agency}
                  onValueChange={(v) => v && f.setAgency(v)}
                  disabled={f.direction !== 'Toutes' && f.isAgencesByDirectionLoading}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Choisir">{f.selectedAgencyLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Toutes">Toutes</SelectItem>
                    {agencyOptionsSorted.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {f.direction !== 'Toutes' ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {f.isAgencesByDirectionLoading
                      ? 'Chargement des agences liées à cette direction…'
                      : 'Seules les agences rattachées à cette direction sont proposées.'}
                  </p>
                ) : null}
                {f.agencesByDirectionError ? (
                  <div className="mt-2 text-xs text-destructive">{f.agencesByDirectionError}</div>
                ) : null}
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                f.setAgency('Toutes')
                f.setDirection('Toutes')
                f.setInstitution('Toutes')
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
            <SheetTitle>Modifier le collecteur</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-2">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="col-edit-code" className="text-xs text-muted-foreground">
                  Code client
                </Label>
                <Input id="col-edit-code" value={editTarget?.codeClient ?? ''} disabled className="mt-1 font-mono" />
              </div>
              <div>
                <Label htmlFor="col-edit-nom" className="text-xs text-muted-foreground">
                  Nom
                </Label>
                <Input
                  id="col-edit-nom"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className="mt-1"
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="col-edit-email" className="text-xs text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="col-edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1"
                  placeholder="email@exemple.com"
                />
              </div>
              <div>
                <Label htmlFor="col-edit-tel" className="text-xs text-muted-foreground">
                  Téléphone (GSM)
                </Label>
                <Input id="col-edit-tel" value={editTel} onChange={(e) => setEditTel(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="col-edit-adresse" className="text-xs text-muted-foreground">
                  Adresse
                </Label>
                <Input
                  id="col-edit-adresse"
                  value={editAdresse}
                  onChange={(e) => setEditAdresse(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="col-edit-etat" className="text-xs text-muted-foreground">
                  État
                </Label>
                <Input
                  id="col-edit-etat"
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
        open={isChangeAgenceOpen}
        onOpenChange={(open) => {
          setIsChangeAgenceOpen(open)
          if (!open) {
            setChangeTarget(null)
            setCaError(null)
            setCaNewAgence('')
          }
        }}
      >
        <SheetContent side="right" className="w-[92vw] sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Changer d’agence (collecteur)</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-2">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="ca-col-code" className="text-xs text-muted-foreground">
                  Code client
                </Label>
                <Input id="ca-col-code" value={changeTarget?.codeClient ?? ''} disabled className="mt-1 font-mono" />
              </div>
              <div>
                <Label htmlFor="ca-col-nom" className="text-xs text-muted-foreground">
                  Nom
                </Label>
                <Input id="ca-col-nom" value={caNom} onChange={(e) => setCaNom(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ca-col-email" className="text-xs text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="ca-col-email"
                  type="email"
                  value={caEmail}
                  onChange={(e) => setCaEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ca-col-tel" className="text-xs text-muted-foreground">
                  Téléphone
                </Label>
                <Input id="ca-col-tel" value={caTel} onChange={(e) => setCaTel(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ca-col-adresse" className="text-xs text-muted-foreground">
                  Adresse
                </Label>
                <Input
                  id="ca-col-adresse"
                  value={caAdresse}
                  onChange={(e) => setCaAdresse(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ca-col-etat" className="text-xs text-muted-foreground">
                  État
                </Label>
                <Input
                  id="ca-col-etat"
                  type="number"
                  inputMode="numeric"
                  value={caEtat}
                  onChange={(e) => setCaEtat(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nouvelle agence</Label>
                <Select value={caNewAgence || undefined} onValueChange={setCaNewAgence}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Choisir une agence" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencyOptionsSorted.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {caError ? <div className="text-sm text-destructive">{caError}</div> : null}
            </div>
          </div>
          <SheetFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsChangeAgenceOpen(false)
                setChangeTarget(null)
              }}
              disabled={isSavingChangeAgence}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => void submitChangeAgence()}
              disabled={isSavingChangeAgence || !(changeTarget?.login ?? '').trim()}
            >
              {isSavingChangeAgence ? 'Enregistrement…' : 'Enregistrer et changer d’agence'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isSendParamsOpen}
        onOpenChange={(open) => {
          setIsSendParamsOpen(open)
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
                <div className="font-medium text-foreground">{sendTarget?.nom || 'Collecteur'}</div>
              </div>
              <div>
                <Label htmlFor="col-send-op" className="text-xs text-muted-foreground">
                  codeOperation
                </Label>
                <Input
                  id="col-send-op"
                  value={sendCodeOperation}
                  onChange={(e) => setSendCodeOperation(e.target.value)}
                  className="mt-1"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="col-send-bank" className="text-xs text-muted-foreground">
                  codeBanque
                </Label>
                <Input
                  id="col-send-bank"
                  value={sendCodeBanque}
                  onChange={(e) => setSendCodeBanque(e.target.value)}
                  className="mt-1"
                  autoComplete="off"
                />
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
                setIsSendParamsOpen(false)
                setSendTarget(null)
              }}
              disabled={isSendingParams}
            >
              Fermer
            </Button>
            <Button
              type="button"
              onClick={() => void submitSendParams()}
              disabled={isSendingParams || !(sendTarget?.login ?? '').trim()}
            >
              {isSendingParams ? 'Envoi…' : 'Envoyer'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
