/** Options pour listes déroulantes collecteur (`GET /api/collecteur/liste/{agence}`). */
export type CollecteurSelectOption = {
  /** Login envoyé à l’API (`collecteur` query). */
  value: string
  /** Libellé affiché (nom du collecteur). */
  label: string
  /** Code client collecteur (ex. `codeCollect` abonnement). */
  codeClient?: string
}

function collecteurLogin(row: Record<string, unknown>): string {
  const loginclient = row.loginclient
  if (typeof loginclient === 'string' && loginclient.trim()) return loginclient.trim()
  const loginCollecteur = row.loginCollecteur
  if (typeof loginCollecteur === 'string' && loginCollecteur.trim()) return loginCollecteur.trim()
  const login = row.login
  if (typeof login === 'string' && login.trim()) return login.trim()
  if (typeof login === 'number' && Number.isFinite(login)) return String(login)
  return ''
}

function collecteurCodeClient(row: Record<string, unknown>): string {
  return String(row.codeClient ?? row.codeCollect ?? row.codeclient ?? '').trim()
}

function collecteurDisplayName(row: Record<string, unknown>): string {
  const fields = [
    row.nomclient,
    row.nomClient,
    row.nomCollecteur,
    row.nomClientCollecteur,
    row.libelle,
    row.libelleCollecteur,
    row.raisonSociale,
    row.nom,
    row.label,
  ]
  for (const raw of fields) {
    const s = String(raw ?? '').trim()
    if (s) return s
  }
  const prenom = String(row.prenom ?? row.prenomclient ?? row.prenomClient ?? '').trim()
  const nom = String(row.nom ?? '').trim()
  if (prenom && nom) return `${prenom} ${nom}`.trim()
  if (prenom) return prenom
  return ''
}

export function mapCollecteurSelectOptions(rows: unknown[]): CollecteurSelectOption[] {
  const seen = new Set<string>()
  const out: CollecteurSelectOption[] = []
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const value = collecteurLogin(row)
    if (!value || seen.has(value)) continue
    seen.add(value)
    const label = collecteurDisplayName(row) || value
    const codeClient = collecteurCodeClient(row)
    out.push({
      value,
      label,
      ...(codeClient ? { codeClient } : {}),
    })
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return out
}

export function collecteurLabelForCode(
  code: string | undefined,
  options: CollecteurSelectOption[],
): string {
  const c = String(code ?? '').trim()
  if (!c) return '—'
  const hit = options.find(
    (o) => o.value === c || (o.codeClient !== undefined && o.codeClient === c),
  )
  return hit?.label ?? c
}
