import type { DashboardSidebarUser } from '@/utils/dashboard-sidebar-user'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-foreground" title={value}>
        {value}
      </span>
    </div>
  )
}

const DEFAULT_USER: DashboardSidebarUser = {
  name: 'Utilisateur',
  direction: '—',
  agency: '—',
  profile: '—',
  login: '—',
  email: '—',
  telephone: '—',
}

type DashboardAdminInfoCardProps = {
  user?: Partial<DashboardSidebarUser>
  className?: string
}

export function DashboardAdminInfoCard({ user, className }: DashboardAdminInfoCardProps) {
  const resolved: DashboardSidebarUser = { ...DEFAULT_USER, ...(user ?? {}) }

  return (
    <div
      className={[
        'min-w-0 w-full max-w-md rounded-2xl bg-card/90 px-4 py-3 text-card-foreground shadow-sm ring-1 ring-border backdrop-blur-md',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mon compte</div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">{resolved.name}</div>
      <div className="mt-2.5 space-y-1.5 rounded-lg bg-background/50 px-2.5 py-2">
        <InfoRow label="Profil" value={resolved.profile} />
        <InfoRow label="Direction" value={resolved.direction} />
        <InfoRow label="Agence" value={resolved.agency} />
        <InfoRow label="Login" value={resolved.login} />
        <InfoRow label="Email" value={resolved.email} />
        <InfoRow label="Téléphone" value={resolved.telephone} />
      </div>
    </div>
  )
}
