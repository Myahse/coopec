import type { WTypeCollect } from '@/services/openapi-components'

export type TypeCollecteSelectOption = {
  /** Valeur envoyée à l’API (`idTypeCollect` ou `codeOper`). */
  value: string
  /** Libellé affiché dans la liste déroulante. */
  label: string
}

function typeCollecteValue(t: WTypeCollect): string {
  return String(t.idTypeCollect ?? t.codeOper ?? '').trim()
}

function typeCollecteLabel(t: WTypeCollect, value: string): string {
  const libelle = String(t.libelle ?? '').trim()
  if (libelle) return libelle
  return value
}

export function mapTypeCollecteSelectOptions(types: WTypeCollect[]): TypeCollecteSelectOption[] {
  const seen = new Set<string>()
  const out: TypeCollecteSelectOption[] = []
  for (const t of types) {
    const value = typeCollecteValue(t)
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push({ value, label: typeCollecteLabel(t, value) })
  }
  return out
}

export function typeCollecteLabelForValue(
  value: string | undefined,
  options: TypeCollecteSelectOption[],
): string {
  const v = String(value ?? '').trim()
  if (!v) return ''
  const hit = options.find((o) => o.value === v)
  return hit?.label ?? v
}
