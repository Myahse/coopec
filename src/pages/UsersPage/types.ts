export type UserRow = {
  id: string
  matricule: string
  nomPrenoms: string
  telephone: string
  email: string
  agence: string
  direction: string
  niveau: string
  login?: string
  codeAgence?: string
  institutionCode?: string
  adresse?: string
  profil?: number
  libelleProfil?: string
  etat?: number
  codeOperation?: string
}

export type UserCreateForm = {
  matricule: string
  nomPrenom: string
  email: string
  telephone: string
  adresse: string
  codeAgence: string
  codeInstitution: string
  codeBanque: string
  profil: string
  etat: string
}

export type SelectOption = { value: string; label: string }

export const emptyCreateForm = (): UserCreateForm => ({
  matricule: '',
  nomPrenom: '',
  email: '',
  telephone: '',
  adresse: '',
  codeAgence: '',
  codeInstitution: '',
  codeBanque: '',
  profil: '0',
  etat: '0',
})
