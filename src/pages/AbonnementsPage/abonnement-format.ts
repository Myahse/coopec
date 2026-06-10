import type { WAbonnement } from '@/services/openapi-components'
import { abonnementNumero } from '@/services/abonnement'

export { abonnementNumero }

export function statusLabel(code: number | string | undefined): string {
  const n = Number(code)
  switch (n) {
    case 1:
      return 'Activé'
    case 2:
      return 'Pleine'
    case 3:
      return 'Reversé'
    case 4:
      return 'Suspendu'
    case 5:
      return 'Suspendu Auto'
    default:
      return String(code ?? '—')
  }
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('fr-FR')
  } catch {
    return iso
  }
}

export function formatMontant(n: number | string | undefined): string {
  if (n === undefined || n === null) return '—'
  const num = typeof n === 'string' ? Number(n.replace(/\s/g, '').replace(',', '.')) : n
  if (!Number.isFinite(num)) return String(n)
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(num)
}

export function canReverseAbonnement(row: WAbonnement): boolean {
  return Number(row.status) === 2
}

export function needsCompteCompletion(row: WAbonnement): boolean {
  return !String(row.compteLce ?? '').trim() || !String(row.compteLes ?? '').trim()
}
