import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDashboardFilters } from '@/contexts/DashboardFiltersContext'
import { getAgencesByDirection, getDirectionRegionaleOptions } from '@/services/direction-regionale'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { getConnectedUserCodeAgence } from '@/utils/connected-user-login'
import { toAgencySelectOption } from '@/utils/organization-filters'

export const TOUTES_AGENCES_VALUE = '__toutes__'

export type DirectionAgenceSelectOption = { value: string; label: string }

export type UseDirectionAgenceFiltersOptions = {
  /** Ajoute « Toutes les agences » et permet les requêtes multi-agences */
  allowAllAgencies?: boolean
  /** Réinitialise données de la page quand direction/agence change */
  onScopeChange?: () => void
}

export function useDirectionAgenceFilters(options: UseDirectionAgenceFiltersOptions = {}) {
  const { allowAllAgencies = false, onScopeChange } = options
  const f = useDashboardFilters()
  const onScopeChangeRef = useRef(onScopeChange)
  onScopeChangeRef.current = onScopeChange

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterDirection, setFilterDirectionState] = useState('')
  const [filterAgence, setFilterAgenceState] = useState('')
  const [directionChoices, setDirectionChoices] = useState<DirectionAgenceSelectOption[]>([])
  const [agencyChoices, setAgencyChoices] = useState<DirectionAgenceSelectOption[]>([])
  const [isLoadingAgencies, setIsLoadingAgencies] = useState(false)

  const codeDir = filterDirection.trim()
  const allAgenciesSelected = allowAllAgencies && filterAgence === TOUTES_AGENCES_VALUE
  const agenceCode = allAgenciesSelected ? '' : filterAgence.trim()

  const agenceSelectOptions = useMemo(() => {
    if (!allowAllAgencies) return agencyChoices
    return [{ value: TOUTES_AGENCES_VALUE, label: 'Toutes les agences' }, ...agencyChoices]
  }, [agencyChoices, allowAllAgencies])

  const selectedDirectionLabel = useMemo(() => {
    if (!codeDir) return '—'
    const hit = directionChoices.find((d) => d.value === codeDir)
    return hit?.label || f.labelForDirectionCode(codeDir)
  }, [codeDir, directionChoices, f.labelForDirectionCode])

  const selectedAgencyLabel = useMemo(() => {
    if (!filterAgence) return '—'
    if (allAgenciesSelected) return 'Toutes les agences'
    const hit = agencyChoices.find((a) => a.value === filterAgence)
    return hit?.label || f.labelForAgencyCode(filterAgence)
  }, [agencyChoices, allAgenciesSelected, f.labelForAgencyCode, filterAgence])

  const agencyCodesForQuery = useMemo(() => {
    if (allAgenciesSelected) return agencyChoices.map((a) => a.value)
    if (agenceCode) return [agenceCode]
    return []
  }, [agencyChoices, agenceCode, allAgenciesSelected])

  const agencyLabels = useMemo(() => {
    const map: Record<string, { direction: string; agence: string }> = {}
    for (const a of agencyChoices) {
      map[a.value] = {
        direction: selectedDirectionLabel,
        agence: a.label || f.labelForAgencyCode(a.value),
      }
    }
    return map
  }, [agencyChoices, f.labelForAgencyCode, selectedDirectionLabel])

  const hasScope = Boolean(codeDir && filterAgence)

  const setFilterDirection = useCallback((value: string) => {
    setFilterDirectionState(value)
    setFilterAgenceState('')
    onScopeChangeRef.current?.()
  }, [])

  const setFilterAgence = useCallback((value: string) => {
    setFilterAgenceState(value)
    onScopeChangeRef.current?.()
  }, [])

  const resetFilters = useCallback(() => {
    setFilterDirectionState('')
    setFilterAgenceState('')
    onScopeChangeRef.current?.()
  }, [])

  const getScopeError = useCallback((): string | null => {
    if (!codeDir) return 'Sélectionnez une direction régionale.'
    if (!filterAgence) {
      return allowAllAgencies
        ? 'Sélectionnez une agence ou « Toutes les agences ».'
        : 'Sélectionnez une agence.'
    }
    if (allAgenciesSelected && !agencyChoices.length) {
      return 'Aucune agence pour cette direction.'
    }
    return null
  }, [agencyChoices.length, allAgenciesSelected, allowAllAgencies, codeDir, filterAgence])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const opts = await getDirectionRegionaleOptions()
        if (cancelled) return
        setDirectionChoices(opts.map((o) => ({ value: o.value, label: o.label })))
      } catch {
        if (!cancelled) setDirectionChoices([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const dashDir = f.direction !== 'Toutes' ? f.direction.trim() : ''
    if (dashDir && !filterDirection && directionChoices.some((d) => d.value === dashDir)) {
      setFilterDirectionState(dashDir)
    }
  }, [f.direction, filterDirection, directionChoices])

  useEffect(() => {
    let cancelled = false
    if (!filterDirection) {
      setAgencyChoices([])
      setFilterAgenceState('')
      setIsLoadingAgencies(false)
      return () => {
        cancelled = true
      }
    }

    setIsLoadingAgencies(true)
    void (async () => {
      try {
        const env = await getAgencesByDirection(filterDirection)
        if (cancelled) return
        const list = extractListFromApiEnvelope(env)
        const options = list
          .map((row) => toAgencySelectOption(row))
          .filter((x): x is DirectionAgenceSelectOption => Boolean(x))
        const seen = new Set<string>()
        const uniq = options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)))
        uniq.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
        setAgencyChoices(uniq)
      } catch {
        if (!cancelled) setAgencyChoices([])
      } finally {
        if (!cancelled) setIsLoadingAgencies(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filterDirection])

  useEffect(() => {
    if (f.agency === 'Toutes' && filterDirection && !filterAgence && agencyChoices.length && allowAllAgencies) {
      setFilterAgenceState(TOUTES_AGENCES_VALUE)
      return
    }
    const dashAgence = f.agency !== 'Toutes' ? f.agency.trim() : ''
    if (dashAgence && !filterAgence && agencyChoices.some((a) => a.value === dashAgence)) {
      setFilterAgenceState(dashAgence)
      return
    }
    if (
      filterAgence &&
      filterAgence !== TOUTES_AGENCES_VALUE &&
      agencyChoices.length &&
      !agencyChoices.some((a) => a.value === filterAgence)
    ) {
      setFilterAgenceState('')
    }
  }, [allowAllAgencies, agencyChoices, f.agency, filterAgence, filterDirection])

  useEffect(() => {
    if (!filterDirection || f.agency === 'Toutes') return
    const sessionAgence = getConnectedUserCodeAgence()
    if (!filterAgence && sessionAgence && agencyChoices.some((a) => a.value === sessionAgence)) {
      setFilterAgenceState(sessionAgence)
    }
  }, [agencyChoices, f.agency, filterAgence, filterDirection])

  return useMemo(
    () => ({
      isFilterOpen,
      setIsFilterOpen,
      filterDirection,
      filterAgence,
      setFilterDirection,
      setFilterAgence,
      directionChoices,
      agencyChoices,
      agenceSelectOptions,
      isLoadingAgencies,
      selectedDirectionLabel,
      selectedAgencyLabel,
      codeDir,
      agenceCode,
      allAgenciesSelected,
      agencyCodesForQuery,
      agencyLabels,
      hasScope,
      resetFilters,
      getScopeError,
    }),
    [
      isFilterOpen,
      filterDirection,
      filterAgence,
      setFilterDirection,
      setFilterAgence,
      directionChoices,
      agencyChoices,
      agenceSelectOptions,
      isLoadingAgencies,
      selectedDirectionLabel,
      selectedAgencyLabel,
      codeDir,
      agenceCode,
      allAgenciesSelected,
      agencyCodesForQuery,
      agencyLabels,
      hasScope,
      resetFilters,
      getScopeError,
    ],
  )
}

export type DirectionAgenceFiltersState = ReturnType<typeof useDirectionAgenceFilters>
