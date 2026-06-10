/** Human-readable profile label from API payloads (e.g. `"Coordonnatrice"`). */
export function pickLibelleProfil(source: unknown): string | undefined {
  if (!source || typeof source !== 'object') return undefined
  const o = source as Record<string, unknown>
  for (const key of [
    'libelleProfil',
    'libelleprofil',
    'LibelleProfil',
    'nomProfil',
    'profilLibelle',
    'libelle_profil',
    'designationProfil',
  ] as const) {
    const v = o[key]
    if (typeof v === 'string') {
      const t = v.trim()
      if (t) return t
    }
  }
  return undefined
}

function pickProfilCode(source: Record<string, unknown>): string | undefined {
  for (const key of ['profil', 'idProfil', 'id_profil'] as const) {
    const v = source[key]
    if (v === 0) return '0'
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    if (typeof v === 'string') {
      const t = v.trim()
      if (t) return t
    }
  }
  return undefined
}

/** Profil tel que renvoyé par l’API : libellé si présent, sinon code `profil` / `idProfil`. */
export function resolveAccountProfileLabel(
  authUser?: Record<string, unknown>,
  storedProfile?: string,
): string {
  if (authUser) {
    const lib = pickLibelleProfil(authUser)
    if (lib) return lib
    const code = pickProfilCode(authUser)
    if (code !== undefined) return code
  }

  const stored = String(storedProfile ?? '').trim()
  if (stored) return stored

  return '—'
}
