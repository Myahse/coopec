import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardPageTitle } from '@/components/DashboardPageTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DASHBOARD_TABLE_PAGE_CLASS,
  DASHBOARD_TABLE_PAGE_HEADER_CLASS,
} from '@/constants/table-styles'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import {
  getInstitutionByCode,
  updateInstitution,
  type InstitutionDto,
} from '@/services/institution'
import { getPays } from '@/services/param'
import { extractDataFromApiEnvelope, extractListFromApiEnvelope } from '@/utils/api-envelope'
import { getConnectedUserInstitutionCode } from '@/utils/connected-user-login'
import { cn } from '@/lib/utils'

function isEtatActive(etat?: string): boolean {
  const e = (etat ?? '').trim().toLowerCase()
  if (!e) return true
  return ['1', 'a', 'actif', 'activé', 'active', 'true', 'oui', 'o'].includes(e)
}

function etatToApiValue(active: boolean, previous?: string): string {
  const p = (previous ?? '').trim()
  if (p === '0' || p === '1') return active ? '1' : '0'
  if (/^a/i.test(p) || /^i/i.test(p)) return active ? 'A' : 'I'
  return active ? '1' : '0'
}

function natureMotDePasseValue(v?: string): 'texte' | 'numerique' | 'alphanumerique' {
  const s = (v ?? '').trim().toLowerCase()
  if (s.startsWith('t') || s === '1') return 'texte'
  if (s.startsWith('n') || s === '2') return 'numerique'
  return 'alphanumerique'
}

function natureDonneesValue(v?: string): 'centralise' | 'agence' {
  const s = (v ?? '').trim().toLowerCase()
  if (s.startsWith('c') || s === '1' || s.includes('central')) return 'centralise'
  return 'agence'
}

/** Label left + control right — compact labels, vertically aligned with controls. */
function FormRow({
  id,
  label,
  children,
  stretch = false,
  multiline = false,
}: {
  id: string
  label: string
  children: ReactNode
  stretch?: boolean
  /** Align label to top of tall controls (textarea) */
  multiline?: boolean
}) {
  return (
    <div
      className={cn(
        'grid min-h-0 grid-cols-[7.5rem_minmax(0,1fr)] gap-x-2',
        multiline ? 'items-start' : 'items-center',
        stretch && 'flex-1',
      )}
    >
      <Label
        htmlFor={id}
        title={label}
        className={cn(
          'truncate text-[11px] font-normal leading-none text-muted-foreground',
          multiline && 'pt-2',
        )}
      >
        {label}
      </Label>
      <div className={cn('min-w-0', stretch && 'flex h-full min-h-0 items-stretch')}>{children}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="shrink-0 border-b border-border pb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
      {children}
    </h3>
  )
}

const fieldClass = 'h-7 w-full min-w-0 px-2 text-xs'
const textareaClass =
  'h-full min-h-[2.75rem] w-full flex-1 resize-none rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50 disabled:opacity-50'

const LOGO_ACCEPT = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml'
const LOGO_MAX_BYTES = 2 * 1024 * 1024

function logoPreviewSrc(logo?: string): string {
  const v = (logo ?? '').trim()
  if (!v) return ''
  if (v.startsWith('data:') || v.startsWith('http://') || v.startsWith('https://') || v.startsWith('blob:'))
    return v
  if (v.startsWith('/')) return v
  // bare base64
  if (/^[A-Za-z0-9+/=]+$/.test(v.slice(0, 80))) return `data:image/png;base64,${v}`
  return v
}

export function InstitutionPage() {
  const navigate = useNavigate()
  const filters = useDashboardFilters()

  const [form, setForm] = useState<InstitutionDto>({})
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [paysOptions, setPaysOptions] = useState<{ value: string; label: string }[]>([])
  const [logoFileName, setLogoFileName] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  const institutionCode = useMemo(() => {
    const fromFilter = filters.institution?.trim()
    if (fromFilter && fromFilter !== 'Toutes') return fromFilter
    return getConnectedUserInstitutionCode()
  }, [filters.institution])

  useEffect(() => {
    void getPays()
      .then((env) => {
        const rows = extractListFromApiEnvelope(env) as Array<Record<string, unknown>>
        setPaysOptions(
          rows
            .map((row) => {
              const value = String(row.codePays ?? row.code ?? '').trim()
              const label = String(row.libellePays ?? row.libelle ?? value).trim()
              return value ? { value, label: label || value } : null
            })
            .filter((o): o is { value: string; label: string } => Boolean(o)),
        )
      })
      .catch(() => setPaysOptions([]))
  }, [])

  const loadInstitution = useCallback(async (code: string) => {
    const c = code.trim()
    if (!c) {
      setForm({})
      setLoadError('Code institution introuvable pour l’utilisateur connecté.')
      return
    }

    setIsLoading(true)
    setLoadError(null)
    setSuccess(null)
    try {
      const env = await getInstitutionByCode(c)
      const data = extractDataFromApiEnvelope<InstitutionDto>(env)
      if (!data) throw new Error('Réponse institution vide')
      const raw = data as InstitutionDto & Record<string, unknown>
      const logoFromApi =
        (typeof raw.logo === 'string' && raw.logo) ||
        (typeof raw.logoInstitution === 'string' && raw.logoInstitution) ||
        (typeof raw.urlLogo === 'string' && raw.urlLogo) ||
        ''
      setForm({ ...data, logo: logoFromApi || data.logo })
      setLogoFileName(null)
    } catch (err) {
      setForm({})
      setLoadError(err instanceof Error ? err.message : 'Impossible de charger l’institution')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInstitution(institutionCode)
  }, [institutionCode, loadInstitution])

  function patchForm(patch: Partial<InstitutionDto>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function onPickLogo() {
    logoInputRef.current?.click()
  }

  function onLogoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setSaveError('Le logo doit être une image (PNG, JPG, GIF, WEBP…).')
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setSaveError('Le logo ne doit pas dépasser 2 Mo.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        setSaveError('Impossible de lire le fichier logo.')
        return
      }
      setSaveError(null)
      setLogoFileName(file.name)
      patchForm({ logo: result })
    }
    reader.onerror = () => setSaveError('Lecture du logo impossible.')
    reader.readAsDataURL(file)
  }

  function clearLogo() {
    setLogoFileName(null)
    patchForm({ logo: '' })
  }

  async function onValidate() {
    const code = String(form.identifiant ?? institutionCode).trim()
    const libelle = String(form.libelle ?? '').trim()
    if (!code) {
      setSaveError('Identifiant institution manquant.')
      return
    }
    if (!libelle) {
      setSaveError('La raison sociale est obligatoire.')
      return
    }

    setIsSaving(true)
    setSaveError(null)
    setSuccess(null)
    try {
      await updateInstitution(code, { ...form, identifiant: code, libelle })
      setSuccess('Institution enregistrée.')
      await loadInstitution(code)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setIsSaving(false)
    }
  }

  const etatActive = isEtatActive(form.etat)
  const mdpNature = natureMotDePasseValue(form.natureMotDePasse)
  const donneesNature = natureDonneesValue(form.natureDonnees)
  const alertMsg = loadError || saveError || success
  const logoSrc = logoPreviewSrc(form.logo)

  return (
    <div className={DASHBOARD_TABLE_PAGE_CLASS}>
      <div className={cn(DASHBOARD_TABLE_PAGE_HEADER_CLASS, 'pb-1 pt-2')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DashboardPageTitle title="Institution" section="Administration" />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/dashboard')}>
              Retour
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadInstitution(institutionCode)}
              disabled={isLoading || !institutionCode}
            >
              Actualiser
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-2 lg:px-4">
        {alertMsg ? (
          <Alert
            variant={success && !loadError && !saveError ? 'default' : 'destructive'}
            className={cn(
              'shrink-0 py-1.5',
              success && !loadError && !saveError && 'border-emerald-500/40 bg-emerald-500/5',
            )}
          >
            <AlertDescription className="text-xs">{alertMsg}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto rounded-lg border border-border bg-card p-3 text-card-foreground lg:grid-cols-12 lg:overflow-hidden">
          {/* Gauche */}
          <section className="flex min-h-0 flex-col gap-1.5 overflow-y-auto lg:col-span-3 lg:h-full">
            <SectionTitle>Informations générales</SectionTitle>
            <div className="flex min-h-0 flex-1 flex-col gap-1">
              <FormRow stretch id="identifiant" label="Identifiant">
                <Input id="identifiant" value={form.identifiant ?? ''} readOnly className={cn(fieldClass, 'bg-muted/40')} />
              </FormRow>
              <FormRow stretch id="libelle" label="Raison sociale">
                <Input
                  id="libelle"
                  value={form.libelle ?? ''}
                  onChange={(e) => patchForm({ libelle: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="sigle" label="Sigle">
                <Input
                  id="sigle"
                  value={form.sigle ?? ''}
                  onChange={(e) => patchForm({ sigle: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="telephone" label="Téléphone">
                <Input
                  id="telephone"
                  value={form.telephone ?? ''}
                  onChange={(e) => patchForm({ telephone: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="adresse" label="Adresse">
                <Input
                  id="adresse"
                  value={form.adresse ?? ''}
                  onChange={(e) => patchForm({ adresse: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="email" label="Email">
                <Input
                  id="email"
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => patchForm({ email: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="siteInternet" label="Site">
                <Input
                  id="siteInternet"
                  value={form.siteInternet ?? ''}
                  onChange={(e) => patchForm({ siteInternet: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="codePays" label="Pays">
                {paysOptions.length ? (
                  <Select
                    value={form.codePays ?? undefined}
                    onValueChange={(v) => patchForm({ codePays: v })}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="codePays" className={fieldClass}>
                      <SelectValue placeholder="Pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {paysOptions.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="codePays"
                    value={form.codePays ?? ''}
                    onChange={(e) => patchForm({ codePays: e.target.value })}
                    disabled={isLoading}
                    className={fieldClass}
                  />
                )}
              </FormRow>
              <FormRow stretch id="senderSms" label="Sender (Expéditeur de sms)">
                <Input
                  id="senderSms"
                  value={form.senderSms ?? ''}
                  onChange={(e) => patchForm({ senderSms: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
            </div>
          </section>

          {/* Centre */}
          <section className="flex min-h-0 flex-col gap-2 overflow-y-auto lg:col-span-5 lg:h-full">
            <div className="flex min-h-0 flex-[0.9] flex-col gap-1 overflow-y-auto">
              <SectionTitle>Paramètres de messagerie</SectionTitle>
              <FormRow stretch id="adresseMessagerie" label="Adresse messagerie">
                <Input
                  id="adresseMessagerie"
                  value={form.adresseMessagerie ?? ''}
                  onChange={(e) => patchForm({ adresseMessagerie: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="utilisateurMessagerie" label="Utilisateur messagerie">
                <Input
                  id="utilisateurMessagerie"
                  value={form.utilisateurMessagerie ?? ''}
                  onChange={(e) => patchForm({ utilisateurMessagerie: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="motDePasseMessagerie" label="Mot de passe messagerie">
                <Input
                  id="motDePasseMessagerie"
                  type="password"
                  value={form.motDePasseMessagerie ?? ''}
                  onChange={(e) => patchForm({ motDePasseMessagerie: e.target.value })}
                  disabled={isLoading}
                  autoComplete="off"
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="portMessagerie" label="Port messagerie">
                <Input
                  id="portMessagerie"
                  value={form.portMessagerie ?? ''}
                  onChange={(e) => patchForm({ portMessagerie: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
            </div>

            <div className="flex min-h-0 flex-[0.9] flex-col gap-1">
              <SectionTitle>Paramètres FTP</SectionTitle>
              <FormRow stretch id="adresseFtp" label="Adresse FTP">
                <Input
                  id="adresseFtp"
                  value={form.adresseFtp ?? ''}
                  onChange={(e) => patchForm({ adresseFtp: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="utilisateurFtp" label="User FTP">
                <Input
                  id="utilisateurFtp"
                  value={form.utilisateurFtp ?? ''}
                  onChange={(e) => patchForm({ utilisateurFtp: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="motDePasseFtp" label="Password FTP">
                <Input
                  id="motDePasseFtp"
                  type="password"
                  value={form.motDePasseFtp ?? ''}
                  onChange={(e) => patchForm({ motDePasseFtp: e.target.value })}
                  disabled={isLoading}
                  autoComplete="off"
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="repertoireFtp" label="Repertoire Ftp">
                <Input
                  id="repertoireFtp"
                  value={form.repertoireFtp ?? ''}
                  onChange={(e) => patchForm({ repertoireFtp: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
            </div>

            <div className="flex min-h-0 flex-[1.4] flex-col gap-1 overflow-y-auto">
              <SectionTitle>Autres paramétrages</SectionTitle>
              <FormRow stretch id="objetMailChangementPassword" label="Objet mail de changement password">
                <Input
                  id="objetMailChangementPassword"
                  value={form.objetMailChangementPassword ?? ''}
                  onChange={(e) => patchForm({ objetMailChangementPassword: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="objetMailConnexion" label="Objet du mail de connexion">
                <Input
                  id="objetMailConnexion"
                  value={form.objetMailConnexion ?? ''}
                  onChange={(e) => patchForm({ objetMailConnexion: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="adresseSmtpServeurMail" label="Adresse smtp serveur mail">
                <Input
                  id="adresseSmtpServeurMail"
                  value={form.adresseSmtpServeurMail ?? ''}
                  onChange={(e) => patchForm({ adresseSmtpServeurMail: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="adresseMailEnvoi" label="Adresse mail d'envoi de mail">
                <Input
                  id="adresseMailEnvoi"
                  value={form.adresseMailEnvoi ?? ''}
                  onChange={(e) => patchForm({ adresseMailEnvoi: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="motDePasseMailEnvoi" label="Mot de passe du mail d'envoi">
                <Input
                  id="motDePasseMailEnvoi"
                  type="password"
                  value={form.motDePasseMailEnvoi ?? ''}
                  onChange={(e) => patchForm({ motDePasseMailEnvoi: e.target.value })}
                  disabled={isLoading}
                  autoComplete="off"
                  className={fieldClass}
                />
              </FormRow>
              <FormRow
                stretch
                id="nombreJoursExpirationMotDePasse"
                label="Nombre de jours pour l'expiration des mots de passe"
               
              >
                <Input
                  id="nombreJoursExpirationMotDePasse"
                  type="number"
                  value={form.nombreJoursExpirationMotDePasse ?? ''}
                  onChange={(e) => patchForm({ nombreJoursExpirationMotDePasse: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow
                stretch
                id="nombreJoursDesactivationClient"
                label="Le nombre de jours pour désactiver un client"
               
              >
                <Input
                  id="nombreJoursDesactivationClient"
                  type="number"
                  value={form.nombreJoursDesactivationClient ?? ''}
                  onChange={(e) => patchForm({ nombreJoursDesactivationClient: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <FormRow stretch id="longueurLoginMotDePasse" label="Longueur des logins et mots de passe">
                <Input
                  id="longueurLoginMotDePasse"
                  type="number"
                  value={form.longueurLoginMotDePasse ?? ''}
                  onChange={(e) => patchForm({ longueurLoginMotDePasse: e.target.value })}
                  disabled={isLoading}
                  className={fieldClass}
                />
              </FormRow>
              <div className="grid shrink-0 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-2 pt-0.5">
                <span className="truncate text-[11px] font-normal leading-none text-muted-foreground" title="Nature des mots de passe">
                  Nature des mots de passe
                </span>
                <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {(
                    [
                      ['texte', 'Texte uniquement'],
                      ['numerique', 'Numérique uniquement'],
                      ['alphanumerique', 'Alphanumérique'],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex cursor-pointer items-center gap-1">
                      <input
                        type="radio"
                        name="natureMotDePasse"
                        checked={mdpNature === value}
                        onChange={() => patchForm({ natureMotDePasse: value })}
                        disabled={isLoading}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Droite */}
          <section className="flex min-h-0 flex-col gap-1.5 overflow-y-auto lg:col-span-4 lg:h-full">
            <input
              ref={logoInputRef}
              type="file"
              accept={LOGO_ACCEPT}
              className="sr-only"
              onChange={onLogoFileChange}
            />
            <div className="grid shrink-0 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-2">
              <span className="truncate text-[11px] font-normal leading-none text-muted-foreground">Logo</span>
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-xs"
                  disabled={isLoading}
                  onClick={onPickLogo}
                >
                  Charger le logo
                </Button>
                {logoSrc ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
                    disabled={isLoading}
                    onClick={clearLogo}
                  >
                    Retirer
                  </Button>
                ) : null}
                {logoFileName ? (
                  <span className="truncate text-[10px] text-muted-foreground" title={logoFileName}>
                    {logoFileName}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-x-2">
              <span className="pt-1 text-[11px] font-normal leading-none text-muted-foreground">Aperçu</span>
              <div className="flex h-20 min-w-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/20">
                {logoSrc ? (
                  <img src={logoSrc} alt="Logo institution" className="max-h-full max-w-full object-contain p-1" />
                ) : (
                  <span className="text-[11px] text-muted-foreground">Aucun logo</span>
                )}
              </div>
            </div>

            <FormRow stretch multiline id="messageParametresConnexion" label="Message de paramètres de connexion">
              <textarea
                id="messageParametresConnexion"
                value={form.messageParametresConnexion ?? ''}
                onChange={(e) => patchForm({ messageParametresConnexion: e.target.value })}
                disabled={isLoading}
                className={textareaClass}
              />
            </FormRow>
            <FormRow
              stretch
              multiline
              id="messageChangementParametresConnexion"
              label="Message de changement de paramètres de connexion"
            >
              <textarea
                id="messageChangementParametresConnexion"
                value={form.messageChangementParametresConnexion ?? ''}
                onChange={(e) => patchForm({ messageChangementParametresConnexion: e.target.value })}
                disabled={isLoading}
                className={textareaClass}
              />
            </FormRow>
            <FormRow stretch multiline id="messageCreationAbonnement" label="Message de création d'abonnement">
              <textarea
                id="messageCreationAbonnement"
                value={form.messageCreationAbonnement ?? ''}
                onChange={(e) => patchForm({ messageCreationAbonnement: e.target.value })}
                disabled={isLoading}
                className={textareaClass}
              />
            </FormRow>

            <FormRow stretch id="tempsLatenceCollectrices" label="Temps de latence des collectrices en min">
              <Input
                id="tempsLatenceCollectrices"
                type="number"
                value={form.tempsLatenceCollectrices ?? ''}
                onChange={(e) => patchForm({ tempsLatenceCollectrices: e.target.value })}
                disabled={isLoading}
                className={fieldClass}
              />
            </FormRow>

            <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-border pt-2">
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-2">
                <span className="text-[11px] text-muted-foreground">Etat</span>
                <div className="flex gap-3 text-xs">
                  <label className="flex cursor-pointer items-center gap-1">
                    <input
                      type="radio"
                      name="etat"
                      checked={etatActive}
                      onChange={() => patchForm({ etat: etatToApiValue(true, form.etat) })}
                      disabled={isLoading}
                    />
                    Activé
                  </label>
                  <label className="flex cursor-pointer items-center gap-1">
                    <input
                      type="radio"
                      name="etat"
                      checked={!etatActive}
                      onChange={() => patchForm({ etat: etatToApiValue(false, form.etat) })}
                      disabled={isLoading}
                    />
                    Désactivé
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-2">
                <span className="truncate text-[11px] text-muted-foreground" title="Nature des données">
                  Nature des données
                </span>
                <div className="flex gap-3 text-xs">
                  <label className="flex cursor-pointer items-center gap-1">
                    <input
                      type="radio"
                      name="natureDonnees"
                      checked={donneesNature === 'centralise'}
                      onChange={() => patchForm({ natureDonnees: 'centralise' })}
                      disabled={isLoading}
                    />
                    Centralisé
                  </label>
                  <label className="flex cursor-pointer items-center gap-1">
                    <input
                      type="radio"
                      name="natureDonnees"
                      checked={donneesNature === 'agence'}
                      onChange={() => patchForm({ natureDonnees: 'agence' })}
                      disabled={isLoading}
                    />
                    Par agence
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="min-w-[120px] border-2 border-emerald-600 bg-transparent text-emerald-700 hover:bg-emerald-50"
                  onClick={() => void onValidate()}
                  disabled={isSaving || isLoading || !institutionCode}
                >
                  {isSaving ? 'Enregistrement…' : 'Valider'}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
