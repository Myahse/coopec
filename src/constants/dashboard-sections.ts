export const DASHBOARD_SECTIONS = [
  { label: 'Courbe collect', to: '/dashboard/courbe-collect' },
  { label: 'Administration', to: '/dashboard' },
  { label: 'Gestion des utilisateurs', to: '/dashboard/utilisateurs' },
  { label: 'Gestion des collecteurs', to: '/dashboard/collecteurs' },
  { label: 'Gestion des clients', to: '/dashboard/clients' },
  { label: 'Gestion des abonnements', to: '/dashboard/abonnements' },
  { label: 'Gestion des opérations', to: '/dashboard/operations' },
  { label: 'Extraction Carte à reverser', to: '/dashboard/extraction-carte' },
  { label: 'Extraction de fichier TXT', to: '/dashboard/extraction-txt' },
  { label: 'Historique comptable', to: '/dashboard/historique' },
  { label: 'Etats des opérations', to: '/dashboard/etats' },
  { label: 'Prêts', to: '/dashboard/prets' },
  { label: 'Aide ?', to: '/dashboard/aide' },
] as const

export const DRAWER_SECTION_IDS = new Set([
  '/dashboard',
  '/dashboard/operations',
  '/dashboard/etats',
  '/dashboard/prets',
  '/dashboard/aide',
])

/** Sidebar / drawer parent shown above the page title (longest prefix wins). */
const DASHBOARD_PAGE_SECTION_ROUTES: ReadonlyArray<{ prefix: string; section: string }> = [
  { prefix: '/dashboard/extraction-txt-superviseur', section: 'Administration' },
  { prefix: '/dashboard/cartes-clientele', section: 'Administration' },
  { prefix: '/dashboard/objectifs', section: 'Administration' },
  { prefix: '/dashboard/institution', section: 'Administration' },
  { prefix: '/dashboard/coopec', section: 'Administration' },
  { prefix: '/dashboard/agences', section: 'Administration' },
  { prefix: '/dashboard/abonnements', section: 'Administration' },
  { prefix: '/dashboard/utilisateurs', section: 'Dashboard' },
  { prefix: '/dashboard/collecteurs', section: 'Dashboard' },
  { prefix: '/dashboard/clients', section: 'Dashboard' },
  { prefix: '/dashboard/operations', section: 'Gestion des opérations' },
  { prefix: '/dashboard/etats', section: 'Etats des opérations' },
  { prefix: '/dashboard/extraction-carte', section: 'Extraction Carte à reverser' },
  { prefix: '/dashboard/extraction-txt', section: 'Extraction de fichier TXT' },
  { prefix: '/dashboard/historique', section: 'Historique comptable' },
  { prefix: '/dashboard/courbe-collect', section: 'Courbe collect' },
  { prefix: '/dashboard/prets', section: 'Prêts' },
  { prefix: '/dashboard/aide', section: 'Aide' },
].sort((a, b) => b.prefix.length - a.prefix.length)

export function resolveDashboardPageSection(pathname: string): string | undefined {
  const normalized = pathname.replace(/\/$/, '') || '/dashboard'
  for (const { prefix, section } of DASHBOARD_PAGE_SECTION_ROUTES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return section
    }
  }
  return undefined
}
