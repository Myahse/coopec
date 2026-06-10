import type { WObjectifDto } from '@/services/openapi-components'

export type ObjectifRow = {
  id?: number
  codeClientCollecteur: string
  nomClientCollecteur: string
  codeAgence: string
  codeDirection: string
  mois: string
  annee: string
  dateDebut: string
  dateFin: string
  montantAttendu: number
  commissionAttendu: number
  adhesionSocietaire: number
  adhesionProspect: number
  adhessionLep: number
  login: string
}

export type ObjectifFormState = ObjectifRow

export function parseObjectifId(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw.trim())
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function strField(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

export function monthDateRange(annee: string, mois: string): { dateDebut: string; dateFin: string } {
  const y = Number(annee)
  const m = Number(mois)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const today = new Date().toISOString().slice(0, 10)
    return { dateDebut: today, dateFin: today }
  }
  const mm = String(m).padStart(2, '0')
  const last = new Date(y, m, 0).getDate()
  return {
    dateDebut: `${y}-${mm}-01`,
    dateFin: `${y}-${mm}-${String(last).padStart(2, '0')}`,
  }
}

export function mapObjectifDto(raw: unknown): ObjectifRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const { dateDebut, dateFin } = monthDateRange(
    strField(r, 'annee'),
    strField(r, 'mois'),
  )
  return {
    id: parseObjectifId(r.id),
    codeClientCollecteur: strField(r, 'codeClientCollecteur', 'codeclient', 'codeClient'),
    nomClientCollecteur: strField(
      r,
      'nomClientCollecteur',
      'nomclientcollecteur',
      'nomCollecteur',
      'nomclient',
    ),
    codeAgence: strField(r, 'codeAgence', 'codeagence'),
    codeDirection: strField(r, 'codeDirection', 'codedirection', 'codeDir'),
    mois: strField(r, 'mois').padStart(2, '0'),
    annee: strField(r, 'annee'),
    dateDebut: strField(r, 'dateDebut', 'datedebut') || dateDebut,
    dateFin: strField(r, 'dateFin', 'datefin') || dateFin,
    montantAttendu: parseNumber(r.montantAttendu),
    commissionAttendu: parseNumber(r.commissionAttendu),
    adhesionSocietaire: parseNumber(r.adhesionSocietaire),
    adhesionProspect: parseNumber(r.adhesionProspect),
    adhessionLep: parseNumber(r.adhessionLep ?? r.adhesionLep),
    login: strField(r, 'login'),
  }
}

export function emptyObjectifForm(
  defaults: Partial<ObjectifFormState> = {},
): ObjectifFormState {
  const annee = defaults.annee ?? String(new Date().getFullYear())
  const mois = defaults.mois ?? String(new Date().getMonth() + 1).padStart(2, '0')
  const { dateDebut, dateFin } = monthDateRange(annee, mois)
  return {
    codeClientCollecteur: '',
    nomClientCollecteur: '',
    codeAgence: '',
    codeDirection: '',
    mois,
    annee,
    dateDebut,
    dateFin,
    montantAttendu: 0,
    commissionAttendu: 0,
    adhesionSocietaire: 0,
    adhesionProspect: 0,
    adhessionLep: 0,
    login: '',
    ...defaults,
  }
}

export function formToObjectifDto(
  form: ObjectifFormState,
  login: string,
  options?: { id?: number },
): WObjectifDto {
  const annee = String(form.annee ?? '').trim()
  const mois = String(form.mois ?? '').padStart(2, '0')
  const range = monthDateRange(annee, mois)
  const id = options?.id ?? parseObjectifId(form.id) ?? 0
  return {
    id,
    codeClientCollecteur: form.codeClientCollecteur.trim(),
    nomClientCollecteur: form.nomClientCollecteur.trim(),
    codeAgence: form.codeAgence.trim(),
    codeDirection: form.codeDirection.trim(),
    mois,
    annee,
    dateDebut: form.dateDebut.trim() || range.dateDebut,
    dateFin: form.dateFin.trim() || range.dateFin,
    montantAttendu: parseNumber(form.montantAttendu),
    commissionAttendu: parseNumber(form.commissionAttendu),
    adhesionSocietaire: parseNumber(form.adhesionSocietaire),
    adhesionProspect: parseNumber(form.adhesionProspect),
    adhessionLep: parseNumber(form.adhessionLep),
    login: form.login.trim() || login,
  }
}

export function formatObjectifMontant(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}
