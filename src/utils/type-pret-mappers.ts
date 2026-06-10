import type { WPiecePretDto, WTypePretDto, WTypePretListItem } from '@/services/openapi-components'

export type TypePretPieceRow = {
  idwTypePieceAdm: number
  obligatoire: string
  rectoVerso: string
}

export type TypePretRow = {
  id: number
  libellePret: string
  montantMin: number
  montantMax: number
  naturePret: number
  tauxUsure: number
  tauxInteret: number
  dureeMax: number
  tauxMin: number
  tauxAssurance: number
  fraisMisePlace: number
  fraisDossier: number
  typeCredit: number
  mensualite: number
  institution: string
  penaliteRetard: number
  jourPresentation: number
  garantieFinanciere: number
  plageDebut: number
  plageFin: number
  cnpLibelle: string
  cnpId: number | undefined
  pieces: TypePretPieceRow[]
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function parseId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.trim())
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function strField(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

function mapPiece(raw: unknown): TypePretPieceRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = parseId(r.idwTypePieceAdm)
  if (id === undefined) return null
  return {
    idwTypePieceAdm: id,
    obligatoire: strField(r, 'wppOblig', 'obligatoire'),
    rectoVerso: strField(r, 'wppRectoVerso', 'rectoVerso'),
  }
}

export function mapTypePretListItem(raw: unknown): TypePretRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = parseId(r.id)
  if (id === undefined) return null

  const cnp =
    r.cnp && typeof r.cnp === 'object' ? (r.cnp as Record<string, unknown>) : null
  const piecesRaw = r.WPiecesPret ?? r.wPiecesPret ?? r.piecesPret
  const pieces = Array.isArray(piecesRaw)
    ? piecesRaw.map(mapPiece).filter((x): x is TypePretPieceRow => Boolean(x))
    : []

  const cnpId = cnp ? parseId(cnp.id) : undefined
  const plageDebut = parseNumber(r.plageDebut)
  const plageFin = parseNumber(r.plageFin)
  const montantMax = parseNumber(r.montantMax ?? plageFin)

  return {
    id,
    libellePret: strField(r, 'libellePret'),
    montantMin: parseNumber(r.montantMin ?? plageDebut),
    montantMax,
    naturePret: parseNumber(r.naturePret ?? cnpId),
    tauxUsure: parseNumber(r.tauxUsure ?? 0.1),
    tauxInteret: parseNumber(r.tauxInteret ?? 0.1),
    dureeMax: parseNumber(r.dureeMax),
    tauxMin: parseNumber(r.tauxMin ?? 0.1),
    tauxAssurance: parseNumber(r.tauxAssurance ?? 0.1),
    fraisMisePlace: parseNumber(r.fraisMisePlace ?? 0.1),
    fraisDossier: parseNumber(r.fraisDossier ?? 0.1),
    typeCredit: parseNumber(r.typeCredit),
    mensualite: parseNumber(r.mensualite ?? 0.1),
    institution: strField(r, 'institution'),
    penaliteRetard: parseNumber(r.penaliteRetard),
    jourPresentation: parseNumber(r.jourPresentation),
    garantieFinanciere: parseNumber(r.garantieFinanciere),
    plageDebut,
    plageFin,
    cnpLibelle: cnp ? strField(cnp, 'cnpLibelle') : '',
    cnpId,
    pieces,
  }
}

export function mapTypePretList(items: WTypePretListItem[] | unknown[]): TypePretRow[] {
  return items.map(mapTypePretListItem).filter((x): x is TypePretRow => Boolean(x))
}

export function formatTypePretMontant(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}

export function formatOuiNonFlag(value: string | undefined): string {
  const v = String(value ?? '').trim().toUpperCase()
  if (v === 'O') return 'Oui'
  if (v === 'N') return 'Non'
  return v || '—'
}

export type TypePretFormState = {
  libellePret: string
  montantMin: number
  naturePret: number
  montantMax: number
  tauxUsure: number
  tauxInteret: number
  dureeMax: number
  tauxMin: number
  tauxAssurance: number
  fraisMisePlace: number
  fraisDossier: number
  typeCredit: number
  mensualite: number
  institution: string
  penaliteRetard: number
  jourPresentation: number
  garantieFinanciere: number
}

export function emptyTypePretForm(defaults: Partial<TypePretFormState> = {}): TypePretFormState {
  return {
    libellePret: '',
    montantMin: 0,
    naturePret: 0,
    montantMax: 0,
    tauxUsure: 0.1,
    tauxInteret: 0.1,
    dureeMax: 0,
    tauxMin: 0.1,
    tauxAssurance: 0.1,
    fraisMisePlace: 0.1,
    fraisDossier: 0.1,
    typeCredit: 0,
    mensualite: 0.1,
    institution: '',
    penaliteRetard: 0,
    jourPresentation: 0,
    garantieFinanciere: 0,
    ...defaults,
  }
}

export function formToTypePretDto(form: TypePretFormState): WTypePretDto {
  return {
    libellePret: form.libellePret.trim(),
    montantMin: parseNumber(form.montantMin),
    naturePret: parseNumber(form.naturePret),
    montantMax: parseNumber(form.montantMax),
    tauxUsure: parseNumber(form.tauxUsure),
    tauxInteret: parseNumber(form.tauxInteret),
    dureeMax: parseNumber(form.dureeMax),
    tauxMin: parseNumber(form.tauxMin),
    tauxAssurance: parseNumber(form.tauxAssurance),
    fraisMisePlace: parseNumber(form.fraisMisePlace),
    fraisDossier: parseNumber(form.fraisDossier),
    typeCredit: parseNumber(form.typeCredit),
    mensualite: parseNumber(form.mensualite),
    institution: form.institution.trim(),
    penaliteRetard: parseNumber(form.penaliteRetard),
    jourPresentation: parseNumber(form.jourPresentation),
    garantieFinanciere: parseNumber(form.garantieFinanciere),
  }
}

export function typePretRowToForm(row: TypePretRow, defaults?: Partial<TypePretFormState>): TypePretFormState {
  return emptyTypePretForm({
    libellePret: row.libellePret,
    montantMin: row.montantMin,
    naturePret: row.naturePret || row.cnpId || 0,
    montantMax: row.montantMax,
    tauxUsure: row.tauxUsure,
    tauxInteret: row.tauxInteret,
    dureeMax: row.dureeMax,
    tauxMin: row.tauxMin,
    tauxAssurance: row.tauxAssurance,
    fraisMisePlace: row.fraisMisePlace,
    fraisDossier: row.fraisDossier,
    typeCredit: row.typeCredit,
    mensualite: row.mensualite,
    institution: row.institution || defaults?.institution || '',
    penaliteRetard: row.penaliteRetard,
    jourPresentation: row.jourPresentation,
    garantieFinanciere: row.garantieFinanciere,
    ...defaults,
  })
}

export type TypePretPieceFormState = {
  typePret: number
  typePiece: number
  obligatoire: 'O' | 'N'
  rectoVerso: 'O' | 'N'
  createdBy: string
}

export function normalizePiecePretFlag(value: string | undefined): 'O' | 'N' {
  const v = String(value ?? '').trim().toUpperCase()
  return v === 'O' ? 'O' : 'N'
}

export function emptyTypePretPieceForm(
  defaults: Partial<TypePretPieceFormState> = {},
): TypePretPieceFormState {
  return {
    typePret: 0,
    typePiece: 0,
    obligatoire: 'N',
    rectoVerso: 'N',
    createdBy: '',
    ...defaults,
  }
}

export function formToPiecePretDto(form: TypePretPieceFormState): WPiecePretDto {
  return {
    typePret: parseNumber(form.typePret),
    typePiece: parseNumber(form.typePiece),
    obligatoire: normalizePiecePretFlag(form.obligatoire),
    rectoVerso: normalizePiecePretFlag(form.rectoVerso),
    createdBy: form.createdBy.trim() || undefined,
  }
}

export function naturePretOptionsFromRows(rows: TypePretRow[]): { value: string; label: string }[] {
  const seen = new Set<number>()
  const out: { value: string; label: string }[] = []
  for (const row of rows) {
    if (row.cnpId == null || seen.has(row.cnpId)) continue
    seen.add(row.cnpId)
    out.push({
      value: String(row.cnpId),
      label: row.cnpLibelle ? `${row.cnpLibelle} (${row.cnpId})` : String(row.cnpId),
    })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}
