import { toAgencySelectOption } from '@/utils/organization-filters'
import type { SelectOption } from './types'

export function buildAgencyChoices(rows: unknown[]): SelectOption[] {
  const options = rows
    .map((a) => toAgencySelectOption(a))
    .filter((x): x is SelectOption => Boolean(x))
  const seen = new Set<string>()
  const uniq = options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)))
  uniq.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return uniq
}

export function selectLabelForValue(
  value: string,
  choices: SelectOption[],
  config?: { loadingLabel?: string; isLoading?: boolean },
): string {
  if (config?.isLoading && config.loadingLabel) return config.loadingLabel
  if (!value || value === 'Toutes') return value === 'Toutes' ? 'Toutes' : ''
  return choices.find((o) => o.value === value)?.label ?? value
}
