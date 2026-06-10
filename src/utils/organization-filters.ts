/** Normalize for loose equality (trim + lowercase). */
export function normKey(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** Code-like fields are sometimes numbers in JSON */
function pickCodeScalar(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

const DIRECTION_CODE_KEYS = [
  'codedir',
  'codeDirectionRegionale',
  'codeDirection',
  'code_direction',
] as const

const DIRECTION_NAME_KEYS = [
  'nomDirectionRegionale',
  'libelledir',
  'libelleDirectionRegionale',
  'nomDirection',
  'libelleDirection',
  'direction',
  'directionRegionale',
  'nom_direction',
  'libelle_direction',
  'libelleDir',
] as const

function collectDirectionFieldSignals(row: Record<string, unknown>, keys: readonly string[]): string[] {
  const out = new Set<string>()
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) out.add(v.trim())
    if (typeof v === 'number' && Number.isFinite(v)) out.add(String(v))
  }
  return Array.from(out)
}

export function directionCodeSignals(row: Record<string, unknown>): string[] {
  return collectDirectionFieldSignals(row, DIRECTION_CODE_KEYS)
}

export function directionNameSignals(row: Record<string, unknown>): string[] {
  return collectDirectionFieldSignals(row, DIRECTION_NAME_KEYS)
}


export function directionSignals(row: Record<string, unknown>): string[] {
  const keys = [
    ...DIRECTION_CODE_KEYS,
    ...DIRECTION_NAME_KEYS,
    'reference',
    'nomClient',
    'nomCollecteur',
  ]
  return collectDirectionFieldSignals(row, keys)
}


export function rowMatchesDirection(
  row: Record<string, unknown>,
  dirValue: string,
  dirLabel: string,
): boolean {
  if (!dirValue || dirValue === 'Toutes') return true
  const targets = new Set([normKey(dirValue), normKey(dirLabel)].filter((x) => x.length > 0))
  return directionSignals(row).some((s) => targets.has(normKey(s)))
}

export function agencyCode(row: Record<string, unknown>): string {
  return pickCodeScalar(row, ['codeAgence', 'code_agence', 'code', 'agenceCode', 'reference'])
}


export function flattenAgenceRow(rowIn: unknown): Record<string, unknown> {
  if (!rowIn || typeof rowIn !== 'object') return {}
  const row = rowIn as Record<string, unknown>
  const nested = row.agence
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...(nested as Record<string, unknown>), ...row }
  }
  return row
}


export function toAgencySelectOption(rowIn: unknown): { value: string; label: string } | null {
  const row = flattenAgenceRow(rowIn)
  const code = agencyCode(row)
  const name = String(
    row.nomAgence ?? row.libelleAgence ?? row.designation ?? row.nomClient ?? row.nomCollecteur ?? '',
  ).trim()
  const label = name || code
  const value = (code || label).trim()
  const displayLabel = (label || '—').trim() || '—'
  if (!value || !displayLabel) return null
  return { value, label: displayLabel }
}

export function agencyLabelSignals(row: Record<string, unknown>): string[] {
  const code = agencyCode(row)
  const name = pickString(row, [
    'nomAgence',
    'libelleAgence',
    'designation',
    'libelle',
    'nom',
    'nomClient',
    'nomCollecteur',
  ])
  const out = new Set<string>()
  if (code) out.add(code)
  if (name) out.add(name)
  return Array.from(out)
}

export function rowMatchesAgency(row: Record<string, unknown>, agencyValue: string, agencyLabel: string): boolean {
  if (!agencyValue || agencyValue === 'Toutes') return true
  const targets = new Set([normKey(agencyValue), normKey(agencyLabel)].filter((x) => x.length > 0))
  return agencyLabelSignals(row).some((s) => targets.has(normKey(s)))
}


export function institutionAgencySignals(row: Record<string, unknown>): string[] {
  const keys = ['codeAgence', 'code_agence', 'agenceCode', 'codeBanqueAgence']
  const out = new Set<string>()
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) out.add(v.trim())
  }
  const nested = row.agence
  if (nested && typeof nested === 'object') {
    for (const s of agencyLabelSignals(nested as Record<string, unknown>)) out.add(s)
  }
  return Array.from(out)
}

export function institutionMatchesAgency(
  row: Record<string, unknown>,
  agencyValue: string,
  agencyLabel: string,
): boolean {
  if (!agencyValue || agencyValue === 'Toutes') return true
  const targets = new Set([normKey(agencyValue), normKey(agencyLabel)].filter((x) => x.length > 0))
  const signals = institutionAgencySignals(row)
  if (!signals.length) {
 
    return true
  }
  return signals.some((s) => targets.has(normKey(s)))
}


export function institutionPassesDirectionFilter(
  row: Record<string, unknown>,
  dirValue: string,
  dirLabel: string,
  filteredAgencyCodesNorm: Set<string>,
): boolean {
  if (!dirValue || dirValue === 'Toutes') return true
  if (rowMatchesDirection(row, dirValue, dirLabel)) return true
  const codes = [...institutionAgencySignals(row), agencyCode(row)].map(normKey).filter(Boolean)
  return codes.some((c) => filteredAgencyCodesNorm.has(c))
}


export function agencyLabelForCode(
  code: string,
  options: { value: string; label: string }[],
  rows: unknown[],
): string {
  const c = String(code ?? '').trim()
  if (!c || c === '—') return '—'

  const fromOpt = options.find((a) => normKey(a.value) === normKey(c))
  if (fromOpt?.label && normKey(fromOpt.label) !== normKey(c)) return fromOpt.label

  for (const raw of rows) {
    const opt = toAgencySelectOption(raw)
    if (opt && normKey(opt.value) === normKey(c)) return opt.label
  }

  for (const raw of rows) {
    const row = flattenAgenceRow(raw)
    if (normKey(agencyCode(row)) !== normKey(c)) continue
    const name = pickString(row, ['nomAgence', 'libelleAgence', 'designation', 'libelle', 'nom'])
    if (name) return name
  }

  if (fromOpt?.label) return fromOpt.label
  if (/^[A-Z0-9_-]+$/i.test(c) && c.length <= 16) return '—'
  return c
}

/** Libellé direction à partir du code direction */
export function directionLabelForCode(
  code: string,
  directionChoices: { value: string; label: string }[],
): string {
  const c = String(code ?? '').trim()
  if (!c || c === '—' || c === 'Toutes') return '—'
  const hit = directionChoices.find((d) => normKey(d.value) === normKey(c))
  if (hit?.label && normKey(hit.label) !== normKey(c)) return hit.label
  if (hit?.label) return hit.label
  if (/^\d+$/.test(c) || /^[A-Z0-9_-]+$/i.test(c)) return '—'
  return c
}

/** Libellé direction régionale déduit de l'agence (référentiel directions uniquement). */
export function directionLabelForAgenceCode(
  agenceCode: string,
  agencesRows: unknown[],
  directionChoices: { value: string; label: string }[],
): string {
  const code = String(agenceCode ?? '').trim()
  if (!code || code === '—') return '—'

  for (const raw of agencesRows) {
    const row = flattenAgenceRow(raw)
    if (normKey(agencyCode(row)) !== normKey(code)) continue

    for (const sig of directionCodeSignals(row)) {
      const hit = directionChoices.find((d) => normKey(d.value) === normKey(sig))
      if (hit) return hit.label
    }

    for (const sig of directionNameSignals(row)) {
      const hit = directionChoices.find(
        (d) => normKey(d.label) === normKey(sig) || normKey(d.value) === normKey(sig),
      )
      if (hit) return hit.label
    }
  }
  return '—'
}
