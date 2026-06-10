import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Institution } from '@/services/institution'
import type { Summary } from '@/services/openapi-components'
import { getAgences } from '@/services/agence'
import { getInstitutions } from '@/services/institution'
import {
  getAgencesByDirection,
  getDirectionRegionaleOptions,
  type DirectionRegionaleOption,
} from '@/services/direction-regionale'
import {
  agencyCode,
  agencyLabelForCode,
  directionLabelForAgenceCode,
  directionLabelForCode,
  institutionAgencySignals,
  normKey,
  rowMatchesDirection,
} from '@/utils/organization-filters'
import { getConnectedUserInstitutionCode } from '@/utils/connected-user-login'

function uniqueOptions<T extends { value: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    if (!item.value) continue
    if (seen.has(item.value)) continue
    seen.add(item.value)
    out.push(item)
  }
  return out
}

export type DashboardFiltersContextValue = {
  institution: string
  direction: string
  agency: string
  setInstitution: (v: string) => void
  setDirection: (v: string) => void
  setAgency: (v: string) => void
  setInstitutionSafe: (v: string | null) => void
  setDirectionSafe: (v: string | null) => void
  setAgencySafe: (v: string | null) => void
  institutionOptionsAll: { value: string; label: string }[]
  agences: { value: string; label: string }[]
  directionOptions: { value: string; label: string }[]
  selectedInstitutionLabel: string
  selectedDirectionLabel: string
  selectedAgencyLabel: string
  isInstitutionsLoading: boolean
  isAgencesByDirectionLoading: boolean
  isFiltersDrawerOpen: boolean
  filtersTarget: 'direction' | 'agency' | 'institution' | null
  setIsFiltersDrawerOpen: (o: boolean) => void
  setFiltersTarget: (t: 'direction' | 'agency' | 'institution' | null) => void
  openFiltersDrawer: (target: 'direction' | 'agency' | 'institution') => void
  directionLoadError: string | null
  agencesByDirectionError: string | null
  filterDirectionRef: React.RefObject<HTMLDivElement | null>
  filterAgencyRef: React.RefObject<HTMLDivElement | null>
  filterInstitutionRef: React.RefObject<HTMLDivElement | null>
  /** Institution imposée par la réponse de login */
  institutionLocked: boolean
  labelForAgencyCode: (code: string) => string
  labelForDirectionCode: (code: string) => string
  labelForDirectionFromAgenceCode: (agenceCode: string) => string
  agencesAllRows: Summary[]
  directionChoicesAll: DirectionRegionaleOption[]
}

const DashboardFiltersContext = createContext<DashboardFiltersContextValue | null>(null)

export function useDashboardFilters(): DashboardFiltersContextValue {
  const v = useContext(DashboardFiltersContext)
  if (!v) throw new Error('useDashboardFilters must be used within DashboardFiltersProvider')
  return v
}

type Props = { children: ReactNode }

export function DashboardFiltersProvider({ children }: Props) {
  const lockedInstitutionCode = useMemo(() => getConnectedUserInstitutionCode(), [])
  const institutionLocked = true

  const [direction, setDirection] = useState('Toutes')
  const [agency, setAgency] = useState('Toutes')
  const [institution, setInstitutionState] = useState(() => lockedInstitutionCode || 'Toutes')
  const defaultInstitutionAppliedRef = useRef(false)
  const [agencesAllRows, setAgencesAllRows] = useState<Summary[]>([])
  const [institutionsAllRows, setInstitutionsAllRows] = useState<Institution[]>([])
  const [directionChoices, setDirectionChoices] = useState<DirectionRegionaleOption[]>([])
  const [directionLoadError, setDirectionLoadError] = useState<string | null>(null)
  const [isInstitutionsLoading, setIsInstitutionsLoading] = useState(true)
  const [isAgencesByDirectionLoading, setIsAgencesByDirectionLoading] = useState(false)
  const [agencesByDirectionRows, setAgencesByDirectionRows] = useState<Summary[]>([])
  const [agencesByDirectionError, setAgencesByDirectionError] = useState<string | null>(null)
  const prevInstitutionRef = useRef<string | null>(null)
  const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false)
  const [filtersTarget, setFiltersTarget] = useState<'direction' | 'agency' | 'institution' | null>(null)

  const filterDirectionRef = useRef<HTMLDivElement | null>(null)
  const filterAgencyRef = useRef<HTMLDivElement | null>(null)
  const filterInstitutionRef = useRef<HTMLDivElement | null>(null)

  const institutionOptionsAll = useMemo(() => {
    const options = institutionsAllRows
      .map((i) => {
        const row = i as Record<string, unknown>
        const code = String(
          row.codeInstitution ?? row.codeBanque ?? row.identifiant ?? row.code ?? row.id ?? '',
        ).trim()
        const name = String(
          row.nomInstitution ??
            row.libelleInstitution ??
            row.nom ??
            row.libelle ??
            row.label ??
            row.designation ??
            '',
        ).trim()
        const label = name || code
        return { value: code || label, label: label || '—' }
      })
      .filter((o) => o.value && o.label)
    return uniqueOptions(options)
  }, [institutionsAllRows])

  const selectedInstitutionPickerLabel = useMemo(() => {
    if (institution === 'Toutes') return ''
    return institutionOptionsAll.find((i) => i.value === institution)?.label ?? ''
  }, [institution, institutionOptionsAll])

  const institutionAgencyCodesNorm = useMemo(() => {
    if (institution === 'Toutes') return new Set<string>()
    const label = selectedInstitutionPickerLabel
    const targets = new Set([normKey(institution), normKey(label)].filter(Boolean))
    const codes = new Set<string>()
    for (const raw of institutionsAllRows) {
      const row = raw as Record<string, unknown>
      const code = String(row.codeInstitution ?? row.codeBanque ?? row.identifiant ?? row.code ?? row.id ?? '').trim()
      const name = String(
        row.nomInstitution ?? row.libelleInstitution ?? row.nom ?? row.libelle ?? row.label ?? row.designation ?? '',
      ).trim()
      const combined = name && code ? `${code} — ${name}` : ''
      const rowKeys = [normKey(code), normKey(name), normKey(combined)].filter(Boolean)
      if (!rowKeys.some((k) => targets.has(k))) continue
      for (const s of institutionAgencySignals(row)) codes.add(normKey(s))
      const ac = agencyCode(row)
      if (ac) codes.add(normKey(ac))
    }
    return codes
  }, [institution, selectedInstitutionPickerLabel, institutionsAllRows])

  const directionChoicesScoped = useMemo(() => {
    if (institution === 'Toutes') return directionChoices
    if (!institutionAgencyCodesNorm.size) return directionChoices
    return directionChoices.filter((d) =>
      agencesAllRows.some((a) => {
        const ar = a as Record<string, unknown>
        if (!rowMatchesDirection(ar, d.value, d.label)) return false
        const ac = normKey(agencyCode(ar))
        return Boolean(ac && institutionAgencyCodesNorm.has(ac))
      }),
    )
  }, [institution, institutionAgencyCodesNorm, directionChoices, agencesAllRows])

  const directionOptions = useMemo(
    () => [
      { value: 'Toutes', label: 'Toutes' },
      ...directionChoicesScoped.map((d) => ({ value: d.value, label: d.label })),
    ],
    [directionChoicesScoped],
  )

  const selectedDirectionMeta = useMemo(() => {
    if (direction === 'Toutes') return { value: 'Toutes' as const, label: 'Toutes' as const }
    const hit =
      directionChoicesScoped.find((d) => d.value === direction) ??
      directionChoices.find((d) => d.value === direction)
    return hit ?? { value: direction, label: direction }
  }, [direction, directionChoicesScoped, directionChoices])

  const selectedDirectionLabel = useMemo(() => {
    if (direction === 'Toutes') return 'Toutes'
    return selectedDirectionMeta.label
  }, [direction, selectedDirectionMeta])

  const agencesBaseRows = useMemo(() => {
    if (direction === 'Toutes') return agencesAllRows
    if (agencesByDirectionRows.length) return agencesByDirectionRows
    const { value: dv, label: dl } = selectedDirectionMeta
    if (!dv || dv === 'Toutes') return agencesAllRows
    return agencesAllRows.filter((r) => rowMatchesDirection(r as Record<string, unknown>, dv, dl))
  }, [direction, agencesByDirectionRows, agencesAllRows, selectedDirectionMeta])

  const agencesScopedRows = useMemo(() => {
    if (institution === 'Toutes') return agencesBaseRows
    if (!institutionAgencyCodesNorm.size) return agencesBaseRows
    return agencesBaseRows.filter((a) => {
      const ac = normKey(agencyCode(a as Record<string, unknown>))
      return Boolean(ac && institutionAgencyCodesNorm.has(ac))
    })
  }, [institution, institutionAgencyCodesNorm, agencesBaseRows])

  const agences = useMemo(() => {
    const options = agencesScopedRows
      .map((a) => {
        const row = a as Record<string, unknown>
        const code = agencyCode(row)
        const name = String(
          row.nomAgence ?? row.libelleAgence ?? row.designation ?? row.nomClient ?? row.nomCollecteur ?? '',
        ).trim()
        const label = name || code
        return { value: code || label, label: label || '—' }
      })
      .filter((o) => o.value && o.label)
    return uniqueOptions(options)
  }, [agencesScopedRows])

  const selectedAgencyLabel = useMemo(() => {
    if (direction !== 'Toutes' && isAgencesByDirectionLoading) return 'Chargement…'
    if (agency === 'Toutes') return 'Toutes'
    return agences.find((a) => a.value === agency)?.label ?? agency
  }, [direction, isAgencesByDirectionLoading, agency, agences])

  const selectedInstitutionLabel = useMemo(() => {
    if (isInstitutionsLoading) return 'Chargement…'
    if (institution === 'Toutes') return 'Toutes'
    return institutionOptionsAll.find((i) => i.value === institution)?.label ?? institution
  }, [isInstitutionsLoading, institution, institutionOptionsAll])

  function setDirectionSafe(value: string | null) {
    if (value) setDirection(value)
  }

  function setAgencySafe(value: string | null) {
    if (value) setAgency(value)
  }

  const setInstitution = useCallback(
    (v: string) => {
      if (institutionLocked && v !== lockedInstitutionCode) return
      setInstitutionState(v)
    },
    [institutionLocked, lockedInstitutionCode],
  )

  function setInstitutionSafe(value: string | null) {
    if (!value) return
    setInstitution(value)
  }

  const openFiltersDrawer = useCallback(
    (target: 'direction' | 'agency' | 'institution') => {
      if (target === 'institution' && institutionLocked) return
      setFiltersTarget(target)
      setIsFiltersDrawerOpen(true)
    },
    [institutionLocked],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const env = await getAgences()
        if (!cancelled) setAgencesAllRows(env.data ?? [])
      } catch {
        if (!cancelled) setAgencesAllRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsInstitutionsLoading(true)
    ;(async () => {
      try {
        const env = await getInstitutions()
        if (!cancelled) setInstitutionsAllRows((env.data ?? []) as Institution[])
      } catch {
        if (!cancelled) setInstitutionsAllRows([])
      } finally {
        if (!cancelled) setIsInstitutionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const opts = await getDirectionRegionaleOptions()
        if (cancelled) return
        setDirectionChoices(opts)
        setDirectionLoadError(null)
      } catch (err) {
        if (cancelled) return
        setDirectionChoices([])
        setDirectionLoadError(err instanceof Error ? err.message : 'Impossible de charger les directions')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const prev = prevInstitutionRef.current
    prevInstitutionRef.current = institution
    if (prev === null) return
    if (prev === institution) return
    setDirection('Toutes')
    setAgency('Toutes')
    setAgencesByDirectionRows([])
    setAgencesByDirectionError(null)
  }, [institution])

  useEffect(() => {
    let cancelled = false
    if (direction === 'Toutes') {
      setAgencesByDirectionRows([])
      setIsAgencesByDirectionLoading(false)
      setAgencesByDirectionError(null)
      return () => {
        cancelled = true
      }
    }

    setIsAgencesByDirectionLoading(true)
    setAgencesByDirectionRows([])
    setAgencesByDirectionError(null)
    ;(async () => {
      try {
        const env = await getAgencesByDirection(direction)
        if (cancelled) return
        const raw = env.data
        const list = Array.isArray(raw) ? (raw as Summary[]) : []
        setAgencesByDirectionRows(list)
      } catch (err) {
        if (!cancelled) {
          setAgencesByDirectionRows([])
          setAgencesByDirectionError(err instanceof Error ? err.message : 'Impossible de charger les agences')
        }
      } finally {
        if (!cancelled) setIsAgencesByDirectionLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [direction])

  useEffect(() => {
    if (direction === 'Toutes') return
    if (!directionChoicesScoped.some((d) => d.value === direction)) {
      setDirection('Toutes')
      setAgency('Toutes')
    }
  }, [direction, directionChoicesScoped])

  useEffect(() => {
    if (!agencesAllRows.length) return
    if (agency !== 'Toutes' && !agences.some((a) => a.value === agency)) {
      setAgency('Toutes')
    }
  }, [agency, agences, agencesAllRows.length])

  useEffect(() => {
    if (!institutionsAllRows.length) return
    if (institutionLocked) return
    if (institution !== 'Toutes' && !institutionOptionsAll.some((i) => i.value === institution)) {
      setInstitutionState('Toutes')
    }
  }, [institution, institutionOptionsAll, institutionsAllRows.length, institutionLocked])

  useEffect(() => {
    if (!institutionLocked || !lockedInstitutionCode) return
    setInstitutionState((prev) => (prev === lockedInstitutionCode ? prev : lockedInstitutionCode))
  }, [institutionLocked, lockedInstitutionCode])

  useEffect(() => {
    if (defaultInstitutionAppliedRef.current) return
    if (lockedInstitutionCode) return
    if (!institutionOptionsAll.length) return
    const DEFAULT_LIBELLE = 'UNION DES COOPERATIONS'
    const needle = DEFAULT_LIBELLE.toLowerCase()
    const match = institutionOptionsAll.find((opt) => {
      const lbl = opt.label.toLowerCase()
      return lbl === needle || lbl.includes(needle)
    })
    if (match) {
      defaultInstitutionAppliedRef.current = true
      setInstitutionState(match.value)
    }
  }, [institutionOptionsAll, lockedInstitutionCode])

  useEffect(() => {
    if (!isFiltersDrawerOpen || !filtersTarget) return
    const map: Record<typeof filtersTarget, React.RefObject<HTMLDivElement | null>> = {
      direction: filterDirectionRef,
      agency: filterAgencyRef,
      institution: filterInstitutionRef,
    }
    const el = map[filtersTarget]?.current
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [filtersTarget, isFiltersDrawerOpen])

  const labelForAgencyCode = useCallback(
    (code: string) => agencyLabelForCode(code, agences, agencesAllRows),
    [agences, agencesAllRows],
  )

  const labelForDirectionCode = useCallback(
    (code: string) => directionLabelForCode(code, directionChoices),
    [directionChoices],
  )

  const labelForDirectionFromAgenceCode = useCallback(
    (agenceCode: string) => directionLabelForAgenceCode(agenceCode, agencesAllRows, directionChoices),
    [agencesAllRows, directionChoices],
  )

  const value = useMemo<DashboardFiltersContextValue>(
    () => ({
      institution,
      direction,
      agency,
      setInstitution,
      setDirection,
      setAgency,
      setInstitutionSafe,
      setDirectionSafe,
      setAgencySafe,
      institutionOptionsAll,
      agences,
      directionOptions,
      selectedInstitutionLabel,
      selectedDirectionLabel,
      selectedAgencyLabel,
      isInstitutionsLoading,
      isAgencesByDirectionLoading,
      isFiltersDrawerOpen,
      filtersTarget,
      setIsFiltersDrawerOpen,
      setFiltersTarget,
      openFiltersDrawer,
      directionLoadError,
      agencesByDirectionError,
      filterDirectionRef,
      filterAgencyRef,
      filterInstitutionRef,
      institutionLocked,
      labelForAgencyCode,
      labelForDirectionCode,
      labelForDirectionFromAgenceCode,
      agencesAllRows,
      directionChoicesAll: directionChoices,
    }),
    [
      institution,
      direction,
      agency,
      setInstitution,
      institutionOptionsAll,
      agences,
      directionOptions,
      selectedInstitutionLabel,
      selectedDirectionLabel,
      selectedAgencyLabel,
      isInstitutionsLoading,
      isAgencesByDirectionLoading,
      isFiltersDrawerOpen,
      filtersTarget,
      openFiltersDrawer,
      directionLoadError,
      agencesByDirectionError,
      institutionLocked,
      labelForAgencyCode,
      labelForDirectionCode,
      labelForDirectionFromAgenceCode,
      agencesAllRows,
      directionChoices,
    ],
  )

  return <DashboardFiltersContext.Provider value={value}>{children}</DashboardFiltersContext.Provider>
}
