import { useEffect, useMemo, useRef, useState } from 'react'
import { getAgences } from '@/services/agence'
import { getAgencesByDirection, getDirectionRegionaleOptions } from '@/services/direction-regionale'
import type { WUtilisateurDto } from '@/services/openapi-components'
import type { WorkFlow } from '@/services/openapi-components'
import {
  changerAgence,
  createUser,
  deleteUser,
  findUsers,
  getWorkflowList,
  renvoyerParametre,
  searchUsers,
  updateUser,
} from '@/services/user'
import { extractListFromApiEnvelope } from '@/utils/api-envelope'
import { defaultCodeOperationRenvoiParametres } from '@/utils/default-code-operation'
import { buildAgencyChoices, selectLabelForValue } from './agency-options'
import { emptyCreateForm } from './types'
import type { UserCreateForm, UserRow } from './types'
import {
  exportUsersToPdf,
  exportUsersToXlsx,
  fetchAllUserRowsForExport,
  importUsersFromXls,
} from './user-export-import'
import { mapApiUserToUserRow } from './user-mappers'

function directionQueryParam(value: string) {
  return value === 'Toutes' ? '' : value
}

function agenceQueryParam(value: string) {
  return value === 'Toutes' ? '' : value
}

export function useUserManagement() {
  const [queryDraft, setQueryDraft] = useState('')
  const [queryApplied, setQueryApplied] = useState('')
  const [searchTick, setSearchTick] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterAgence, setFilterAgence] = useState('Toutes')
  const [filterDirection, setFilterDirection] = useState('Toutes')
  const [directionChoices, setDirectionChoices] = useState<{ value: string; label: string }[]>([])
  const [directionApiError, setDirectionApiError] = useState<string | null>(null)
  const [agencesAllRows, setAgencesAllRows] = useState<unknown[]>([])
  const [agencesByDirectionRows, setAgencesByDirectionRows] = useState<unknown[]>([])
  const [isAgencesByDirectionLoading, setIsAgencesByDirectionLoading] = useState(false)
  const [agencesByDirectionError, setAgencesByDirectionError] = useState<string | null>(null)
  const [agencyApiError, setAgencyApiError] = useState<string | null>(null)
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null)
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [rows, setRows] = useState<UserRow[]>([])

  const [isSendParamsOpen, setIsSendParamsOpen] = useState(false)
  const [sendParamsTarget, setSendParamsTarget] = useState<UserRow | null>(null)
  const [sendCodeOperation, setSendCodeOperation] = useState('')
  const [sendCodeBanque, setSendCodeBanque] = useState('')
  const [sendParamsError, setSendParamsError] = useState<string | null>(null)
  const [sendParamsSuccess, setSendParamsSuccess] = useState<string | null>(null)
  const [isSendingParams, setIsSendingParams] = useState(false)

  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [editNomPrenom, setEditNomPrenom] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editTelephone, setEditTelephone] = useState('')
  const [editAdresse, setEditAdresse] = useState('')
  const [editProfil, setEditProfil] = useState('0')
  const [editEtat, setEditEtat] = useState('0')
  const [editUserError, setEditUserError] = useState<string | null>(null)
  const [editUserSuccess, setEditUserSuccess] = useState<string | null>(null)
  const [isSavingUser, setIsSavingUser] = useState(false)

  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null)
  const [isDeletingUser, setIsDeletingUser] = useState(false)

  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [createForm, setCreateForm] = useState<UserCreateForm>(() => emptyCreateForm())
  const [createUserError, setCreateUserError] = useState<string | null>(null)
  const [isCreatingUser, setIsCreatingUser] = useState(false)

  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false)
  const [workflowTarget, setWorkflowTarget] = useState<UserRow | null>(null)
  const [workflowRows, setWorkflowRows] = useState<WorkFlow[]>([])
  const [workflowError, setWorkflowError] = useState<string | null>(null)
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false)

  const [isChangeAgenceOpen, setIsChangeAgenceOpen] = useState(false)
  const [changeAgenceTarget, setChangeAgenceTarget] = useState<UserRow | null>(null)
  const [caNomPrenom, setCaNomPrenom] = useState('')
  const [caEmail, setCaEmail] = useState('')
  const [caTelephone, setCaTelephone] = useState('')
  const [caAdresse, setCaAdresse] = useState('')
  const [caProfil, setCaProfil] = useState('0')
  const [caEtat, setCaEtat] = useState('0')
  const [caNewAgence, setCaNewAgence] = useState('')
  const [caError, setCaError] = useState<string | null>(null)
  const [isSavingChangeAgence, setIsSavingChangeAgence] = useState(false)

  const agencyChoices = useMemo(
    () => buildAgencyChoices(filterDirection === 'Toutes' ? agencesAllRows : agencesByDirectionRows),
    [agencesAllRows, agencesByDirectionRows, filterDirection],
  )

  const createAgencyChoices = useMemo(() => buildAgencyChoices(agencesAllRows), [agencesAllRows])

  const createAgencySelectLabel = useMemo(
    () => selectLabelForValue(createForm.codeAgence, createAgencyChoices),
    [createForm.codeAgence, createAgencyChoices],
  )

  const caNewAgenceSelectLabel = useMemo(
    () => selectLabelForValue(caNewAgence, agencyChoices),
    [caNewAgence, agencyChoices],
  )

  const directionSelectLabel = useMemo(
    () => selectLabelForValue(filterDirection, directionChoices),
    [filterDirection, directionChoices],
  )

  const agencySelectLabel = useMemo(
    () =>
      selectLabelForValue(filterAgence, agencyChoices, {
        isLoading: filterDirection !== 'Toutes' && isAgencesByDirectionLoading,
        loadingLabel: 'Chargement…',
      }),
    [filterAgence, agencyChoices, filterDirection, isAgencesByDirectionLoading],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const opts = await getDirectionRegionaleOptions()
        if (cancelled) return
        setDirectionChoices(opts.map((o) => ({ value: o.value, label: o.label })))
        setDirectionApiError(null)
      } catch (err) {
        if (cancelled) return
        setDirectionChoices([])
        setDirectionApiError(
          err instanceof Error ? err.message : 'Impossible de charger les directions régionales',
        )
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
        const env = await getAgences()
        if (cancelled) return
        const raw = env.data
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((env as Record<string, unknown>).content)
            ? ((env as Record<string, unknown>).content as unknown[])
            : []
        setAgencesAllRows(list)
        setAgencyApiError(null)
      } catch (err) {
        if (cancelled) return
        setAgencesAllRows([])
        setAgencyApiError(err instanceof Error ? err.message : 'Impossible de charger les agences')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (filterDirection === 'Toutes') {
      setAgencesByDirectionRows([])
      setAgencesByDirectionError(null)
      setIsAgencesByDirectionLoading(false)
      return () => {
        cancelled = true
      }
    }

    setAgencesByDirectionRows([])
    setIsAgencesByDirectionLoading(true)
    setAgencesByDirectionError(null)
    setFilterAgence('Toutes')

    ;(async () => {
      try {
        const env = await getAgencesByDirection(filterDirection)
        if (cancelled) return
        setAgencesByDirectionRows(extractListFromApiEnvelope(env))
      } catch (err) {
        if (cancelled) return
        setAgencesByDirectionRows([])
        setAgencesByDirectionError(
          err instanceof Error ? err.message : 'Impossible de charger les agences pour cette direction',
        )
      } finally {
        if (!cancelled) setIsAgencesByDirectionLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filterDirection])

  useEffect(() => {
    if (filterAgence === 'Toutes') return
    if (!agencyChoices.length) {
      setFilterAgence('Toutes')
      return
    }
    if (!agencyChoices.some((a) => a.value === filterAgence)) {
      setFilterAgence('Toutes')
    }
  }, [agencyChoices, filterAgence])

  useEffect(() => {
    setPage(0)
  }, [filterAgence, filterDirection, pageSize, queryApplied])

  useEffect(() => {
    let cancelled = false
    const q = queryApplied.trim()

    ;(async () => {
      setIsUsersLoading(true)
      setUsersLoadError(null)
      try {
        const payload = q
          ? await searchUsers({ search: q, page, size: pageSize })
          : await findUsers({
              direction: directionQueryParam(filterDirection),
              agence: agenceQueryParam(filterAgence),
              page,
              size: pageSize,
            })

        if (cancelled) return

        const data = Array.isArray(payload.data) ? payload.data : []
        setRows(data.map((u, idx) => mapApiUserToUserRow(u, page, idx)))
      } catch (err) {
        if (cancelled) return
        setRows([])
        setUsersLoadError(err instanceof Error ? err.message : 'Impossible de charger les utilisateurs')
      } finally {
        if (!cancelled) setIsUsersLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filterAgence, filterDirection, page, pageSize, queryApplied, searchTick])

  function applySearch() {
    setPage(0)
    setQueryApplied(queryDraft.trim())
    setSearchTick((t) => t + 1)
  }

  function openCreateUser() {
    setCreateForm(emptyCreateForm())
    setCreateUserError(null)
    setIsCreateUserOpen(true)
  }

  async function submitCreateUser() {
    const matricule = createForm.matricule.trim()
    const nomPrenom = createForm.nomPrenom.trim()
    const codeAgence = createForm.codeAgence.trim()
    setCreateUserError(null)

    if (!matricule) {
      setCreateUserError('Veuillez renseigner le matricule.')
      return
    }
    if (!nomPrenom) {
      setCreateUserError('Veuillez renseigner le nom et prénom.')
      return
    }
    if (!codeAgence) {
      setCreateUserError('Veuillez choisir une agence.')
      return
    }

    const profilNum = Number.parseInt(createForm.profil, 10)
    const etatNum = Number.parseInt(createForm.etat, 10)
    if (!Number.isFinite(profilNum)) {
      setCreateUserError('Profil : veuillez saisir un nombre entier valide.')
      return
    }
    if (!Number.isFinite(etatNum)) {
      setCreateUserError('État : veuillez saisir un nombre entier valide.')
      return
    }

    const payload: WUtilisateurDto = {
      matricule,
      nomPrenom,
      codeAgence,
      profil: profilNum,
      etat: etatNum,
      email: createForm.email.trim() || undefined,
      telephone: createForm.telephone.trim() || undefined,
      adresse: createForm.adresse.trim() || undefined,
      codeInstitution: createForm.codeInstitution.trim() || undefined,
      codeBanque: createForm.codeBanque.trim() || undefined,
    }

    setIsCreatingUser(true)
    try {
      await createUser(payload)
      setSearchTick((t) => t + 1)
      setIsCreateUserOpen(false)
      setCreateForm(emptyCreateForm())
    } catch (err) {
      setCreateUserError(err instanceof Error ? err.message : 'Création impossible.')
    } finally {
      setIsCreatingUser(false)
    }
  }

  function openEditUser(row: UserRow) {
    const login = (row.login ?? '').trim()
    setEditUserError(null)
    setEditUserSuccess(null)
    setEditTarget(row)
    if (!login) {
      setEditNomPrenom('')
      setEditEmail('')
      setEditTelephone('')
      setEditAdresse('')
      setEditProfil('0')
      setEditEtat('0')
      setEditUserError("Impossible de modifier : identifiant utilisateur absent pour cet enregistrement.")
      setIsEditUserOpen(true)
      return
    }
    setEditNomPrenom(row.nomPrenoms === '—' ? '' : row.nomPrenoms)
    setEditEmail(row.email === '—' ? '' : row.email)
    setEditTelephone(row.telephone === '—' ? '' : row.telephone)
    setEditAdresse(row.adresse ?? '')
    setEditProfil(String(row.profil ?? 0))
    setEditEtat(String(row.etat ?? 0))
    setIsEditUserOpen(true)
  }

  async function submitEditUser() {
    const login = (editTarget?.login ?? '').trim()
    setEditUserError(null)
    setEditUserSuccess(null)
    if (!login) {
      setEditUserError("Identifiant utilisateur manquant : impossible d'appeler l'API de mise à jour.")
      return
    }

    const profilNum = Number.parseInt(editProfil, 10)
    const etatNum = Number.parseInt(editEtat, 10)
    if (!Number.isFinite(profilNum)) {
      setEditUserError('Profil : veuillez saisir un nombre entier valide.')
      return
    }
    if (!Number.isFinite(etatNum)) {
      setEditUserError('État : veuillez saisir un nombre entier valide.')
      return
    }

    setIsSavingUser(true)
    try {
      const res = await updateUser(login, {
        nomPrenom: editNomPrenom.trim() || undefined,
        email: editEmail.trim() || undefined,
        telephone: editTelephone.trim() || undefined,
        adresse: editAdresse.trim() || undefined,
        profil: profilNum,
        etat: etatNum,
      })
      setEditUserSuccess(res.message || 'Utilisateur mis à jour.')
      setSearchTick((t) => t + 1)
    } catch (err) {
      setEditUserError(err instanceof Error ? err.message : 'Échec de la mise à jour.')
    } finally {
      setIsSavingUser(false)
    }
  }

  function resolveOldCodeAgence(row: UserRow): string {
    const fromApi = (row.codeAgence ?? '').trim()
    if (fromApi) return fromApi
    const ag = (row.agence ?? '').trim()
    if (ag && ag !== '—') {
      const hit = agencyChoices.find((a) => a.label === ag || a.value === ag)
      if (hit?.value) return hit.value.trim()
    }
    return ''
  }

  function openChangeAgence(row: UserRow) {
    const login = (row.login ?? '').trim()
    setChangeAgenceTarget(row)
    setCaNomPrenom(row.nomPrenoms === '—' ? '' : row.nomPrenoms)
    setCaEmail(row.email === '—' ? '' : row.email)
    setCaTelephone(row.telephone === '—' ? '' : row.telephone)
    setCaAdresse(row.adresse ?? '')
    setCaProfil(String(row.profil ?? 0))
    setCaEtat(String(row.etat ?? 0))
    setCaNewAgence('')
    setCaError(
      login ? null : 'Identifiant utilisateur manquant : opération impossible une fois le formulaire validé.',
    )
    setIsChangeAgenceOpen(true)
  }

  async function submitChangeAgence() {
    const row = changeAgenceTarget
    const login = (row?.login ?? '').trim()
    setCaError(null)
    if (!login) {
      setCaError('Identifiant utilisateur manquant : opération impossible.')
      return
    }
    const oldCode = row ? resolveOldCodeAgence(row) : ''
    if (!oldCode) {
      setCaError(
        'Ancienne agence inconnue : vérifiez que l’API renvoie codeAgence, ou ajustez les filtres direction/agence pour résoudre le code.',
      )
      return
    }
    const newCode = caNewAgence.trim()
    if (!newCode) {
      setCaError('Veuillez choisir la nouvelle agence.')
      return
    }
    if (newCode === oldCode) {
      setCaError('La nouvelle agence doit être différente de l’actuelle.')
      return
    }
    const profilNum = Number.parseInt(caProfil, 10)
    const etatNum = Number.parseInt(caEtat, 10)
    if (!Number.isFinite(profilNum) || !Number.isFinite(etatNum)) {
      setCaError('Profil et état doivent être des nombres valides.')
      return
    }
    setIsSavingChangeAgence(true)
    try {
      await updateUser(login, {
        nomPrenom: caNomPrenom.trim() || undefined,
        email: caEmail.trim() || undefined,
        telephone: caTelephone.trim() || undefined,
        adresse: caAdresse.trim() || undefined,
        profil: profilNum,
        etat: etatNum,
      })
      await changerAgence({ login, oldCodeAgence: oldCode, newCodeAgence: newCode })
      setSearchTick((t) => t + 1)
      setIsChangeAgenceOpen(false)
      setChangeAgenceTarget(null)
    } catch (err) {
      setCaError(err instanceof Error ? err.message : 'Échec de l’opération.')
    } finally {
      setIsSavingChangeAgence(false)
    }
  }

  function openDeleteUser(row: UserRow) {
    setDeleteTarget(row)
    setDeleteUserError(null)
    setIsDeleteUserOpen(true)
  }

  async function submitDeleteUser() {
    const login = (deleteTarget?.login ?? '').trim()
    setDeleteUserError(null)
    if (!login) {
      setDeleteUserError('Cet enregistrement n’a pas d’identifiant : suppression impossible.')
      return
    }
    setIsDeletingUser(true)
    try {
      await deleteUser(login)
      setSearchTick((t) => t + 1)
      setIsDeleteUserOpen(false)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteUserError(err instanceof Error ? err.message : 'Échec de la suppression.')
    } finally {
      setIsDeletingUser(false)
    }
  }

  function resolveUserLogin(row: UserRow): string {
    const login = (row.login ?? '').trim()
    if (login) return login
    const matricule = (row.matricule ?? '').trim()
    if (matricule && matricule !== '—') return matricule
    return ''
  }

  async function openWorkflow(row: UserRow) {
    const login = resolveUserLogin(row)
    setWorkflowTarget(row)
    setWorkflowRows([])
    setWorkflowError(null)
    setIsWorkflowOpen(true)

    if (!login) {
      setWorkflowError('Identifiant utilisateur (login) manquant.')
      return
    }

    setIsWorkflowLoading(true)
    try {
      const res = await getWorkflowList(login)
      const list = Array.isArray(res.data) ? res.data : extractListFromApiEnvelope(res)
      setWorkflowRows(list as WorkFlow[])
    } catch (err) {
      setWorkflowRows([])
      setWorkflowError(err instanceof Error ? err.message : 'Impossible de charger le workflow')
    } finally {
      setIsWorkflowLoading(false)
    }
  }

  function openSendParams(row: UserRow) {
    setSendParamsTarget(row)
    setSendCodeOperation((row.codeOperation ?? '').trim() || defaultCodeOperationRenvoiParametres())
    setSendCodeBanque(row.institutionCode ?? '')
    setSendParamsError(null)
    setSendParamsSuccess(null)
    setIsSendParamsOpen(true)
  }

  async function submitSendParams() {
    const login = (sendParamsTarget?.login ?? '').trim()
    const codeOperation = sendCodeOperation.trim()
    const codeBanque = sendCodeBanque.trim()
    setSendParamsError(null)
    setSendParamsSuccess(null)

    if (!login) {
      setSendParamsError('Identifiant utilisateur absent : impossible d’envoyer les paramètres.')
      return
    }
    if (!codeOperation) {
      setSendParamsError('Veuillez renseigner le codeOperation.')
      return
    }
    if (!codeBanque) {
      setSendParamsError('Veuillez renseigner le codeBanque.')
      return
    }

    setIsSendingParams(true)
    try {
      const res = await renvoyerParametre({ codeOperation, codeBanque, login })
      setSendParamsSuccess(res.message || 'Paramètres renvoyés.')
    } catch (err) {
      setSendParamsError(err instanceof Error ? err.message : 'Échec de renvoi des paramètres.')
    } finally {
      setIsSendingParams(false)
    }
  }

  async function exportXls() {
    setIsExporting(true)
    try {
      const allRows = await fetchAllUserRowsForExport({
        queryApplied,
        filterDirection,
        filterAgence,
        pageSize,
        directionQueryParam,
        agenceQueryParam,
      })
      if (!allRows.length) return
      exportUsersToXlsx(allRows)
    } finally {
      setIsExporting(false)
    }
  }

  async function exportPdf() {
    setIsExporting(true)
    try {
      const allRows = await fetchAllUserRowsForExport({
        queryApplied,
        filterDirection,
        filterAgence,
        pageSize,
        directionQueryParam,
        agenceQueryParam,
      })
      if (!allRows.length) return
      exportUsersToPdf(allRows)
    } finally {
      setIsExporting(false)
    }
  }

  async function importXls(file: File) {
    const next = await importUsersFromXls(file)
    setRows(next)
  }

  function resetFilters() {
    setFilterAgence('Toutes')
    setFilterDirection('Toutes')
  }

  return {
    fileInputRef,
    queryDraft,
    setQueryDraft,
    applySearch,
    isExporting,
    isUsersLoading,
    exportXls,
    exportPdf,
    importXls,
    openCreateUser,
    setIsFilterOpen,
    isFilterOpen,
    rows,
    usersLoadError,
    page,
    setPage,
    pageSize,
    setPageSize,
    openEditUser,
    openDeleteUser,
    openChangeAgence,
    openWorkflow,
    openSendParams,
    isCreateUserOpen,
    setIsCreateUserOpen,
    createForm,
    setCreateForm,
    createUserError,
    setCreateUserError,
    isCreatingUser,
    submitCreateUser,
    createAgencyChoices,
    createAgencySelectLabel,
    filterDirection,
    setFilterDirection,
    filterAgence,
    setFilterAgence,
    directionChoices,
    directionApiError,
    agencyChoices,
    agencyApiError,
    agencesByDirectionError,
    isAgencesByDirectionLoading,
    directionSelectLabel,
    agencySelectLabel,
    resetFilters,
    isEditUserOpen,
    setIsEditUserOpen,
    editTarget,
    setEditTarget,
    editNomPrenom,
    setEditNomPrenom,
    editEmail,
    setEditEmail,
    editTelephone,
    setEditTelephone,
    editAdresse,
    setEditAdresse,
    editProfil,
    setEditProfil,
    editEtat,
    setEditEtat,
    editUserError,
    setEditUserError,
    editUserSuccess,
    setEditUserSuccess,
    isSavingUser,
    submitEditUser,
    isChangeAgenceOpen,
    setIsChangeAgenceOpen,
    changeAgenceTarget,
    setChangeAgenceTarget,
    caNomPrenom,
    setCaNomPrenom,
    caEmail,
    setCaEmail,
    caTelephone,
    setCaTelephone,
    caAdresse,
    setCaAdresse,
    caProfil,
    setCaProfil,
    caEtat,
    setCaEtat,
    caNewAgence,
    setCaNewAgence,
    caNewAgenceSelectLabel,
    caError,
    setCaError,
    isSavingChangeAgence,
    submitChangeAgence,
    isDeleteUserOpen,
    setIsDeleteUserOpen,
    deleteTarget,
    setDeleteTarget,
    deleteUserError,
    setDeleteUserError,
    isDeletingUser,
    submitDeleteUser,
    isSendParamsOpen,
    setIsSendParamsOpen,
    sendParamsTarget,
    setSendParamsTarget,
    sendCodeOperation,
    setSendCodeOperation,
    sendCodeBanque,
    setSendCodeBanque,
    sendParamsError,
    setSendParamsError,
    sendParamsSuccess,
    setSendParamsSuccess,
    isSendingParams,
    submitSendParams,
    isWorkflowOpen,
    setIsWorkflowOpen,
    workflowTarget,
    workflowRows,
    workflowError,
    setWorkflowError,
    isWorkflowLoading,
    resolveUserLogin,
  }
}
