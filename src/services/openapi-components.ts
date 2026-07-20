

export type ApiResponseString = {
  message?: string
  data?: string
  success?: boolean
}

export type ApiResponseListSummary = {
  message?: string
  data?: Summary[]
  success?: boolean
}

export type ApiResponseListOperationNA = {
  message?: string
  data?: OperationNA[]
  success?: boolean
}

export type ApiResponseInstitutionDto = {
  message?: string
  data?: InstitutionDto
  success?: boolean
}

export type ApiResponseListInstitutionDto = {
  message?: string
  data?: InstitutionDto[]
  success?: boolean
}

export type ApiResponseWDirectionRegionalDto = {
  message?: string
  data?: WDirectionRegionalDto
  success?: boolean
}

export type ApiResponseAgenceDto = {
  message?: string
  data?: AgenceDto
  success?: boolean
}

export type ApiResponseListAgence = {
  message?: string
  data?: Agence[]
  success?: boolean
}

export type ApiResponseAccountInfoDto = {
  message?: string
  data?: AccountInfoDto
  success?: boolean
}

export type ApiResponseListWClient = {
  message?: string
  data?: WClient[]
  success?: boolean
}

export type ApiResponseListWAbonnement = {
  message?: string
  data?: WAbonnement[]
  success?: boolean
}

export type ApiResponseWAbonnement = {
  message?: string
  data?: WAbonnement
  success?: boolean
}

export type ApiResponseCompte = {
  message?: string
  data?: Compte
  success?: boolean
}

export type ApiResponseListWObjectifDto = {
  message?: string
  data?: WObjectifDto[]
  success?: boolean
}

export type ApiResponseListWTypePret = {
  message?: string
  data?: WTypePretListItem[]
  success?: boolean
}

export type ApiResponseListWorkFlow = {
  message?: string
  data?: WorkFlow[]
  success?: boolean
}

export type ApiResponseListUtilisateurWithOtherInfo = {
  message?: string
  data?: UtilisateurWithOtherInfo[]
  success?: boolean
}

export type ApiResponseListWTypePieceAdm = {
  message?: string
  data?: WTypePieceAdm[]
  success?: boolean
}

export type ApiResponseListWTypeCollect = {
  message?: string
  data?: WTypeCollect[]
  success?: boolean
}

export type ApiResponseListWTypeClient = {
  message?: string
  data?: WTypeClient[]
  success?: boolean
}

export type ApiResponseListWSituationMatrimonial = {
  message?: string
  data?: WSituationMatrimonial[]
  success?: boolean
}

export type ApiResponseListWSecteuractivite = {
  message?: string
  data?: WSecteuractivite[]
  success?: boolean
}

export type ApiResponseListWPeriode = {
  message?: string
  data?: WPeriode[]
  success?: boolean
}

export type ApiResponseListWPays = {
  message?: string
  data?: WPays[]
  success?: boolean
}

export type ApiResponseListWCivilite = {
  message?: string
  data?: WCivilite[]
  success?: boolean
}

export type ApiResponseListWClientDatas = {
  message?: string
  data?: WClientDatas[]
  success?: boolean
}

export type ApiResponseListWClientSolde = {
  message?: string
  data?: WClientSolde[]
  success?: boolean
}

export type ApiResponseListVValidPretCoopec = {
  message?: string
  data?: VValidPretCoopec[]
  success?: boolean
}

export type ApiResponseListVImpayePret = {
  message?: string
  data?: VImpayePret[]
  success?: boolean
}

export type ApiResponseListHistorique = {
  message?: string
  data?: Historique[]
  success?: boolean
}

export type ApiResponseWClientCollecteur = {
  message?: string
  data?: WClientCollecteur
  success?: boolean
}

export type ApiResponseListTransaction = {
  message?: string
  data?: Transaction[]
  success?: boolean
}

// --- Summary & operation ---

export type Summary = {
  date0peration?: string
  numabonnement?: string
  motif?: string
  montant?: number
  nomClient?: string
  nomCollecteur?: string
  reference?: string
  compteLes?: string
  compteLce?: string
  numGuichet?: string
  numgichet?: string
}

export type SearchClientDto = {
  codeAgence: string
  dateDebut: string
  dateFin: string
}

export type SearchCollecteurOperationDto = {
  login: string
  statDate: string
  endDate: string
}

export type OperationNA = {
  compteLES?: string
  compteLCE?: string
  numAbonnemnt?: string
  compteLCEN?: string
  compteLESN?: string
  codeClient?: string
  heureoperation?: string
  montant?: number
  nomClient?: string
  reference?: string
}

export type ArreteCollecteDto = {
  montant?: number
  codeAgence?: string
  login?: string
  codeClientCollecteur?: string
  nomCollecteur?: string
  /** Compte à créditer  */
  compteToCredit?: string
  compteCollecteur?: string
  loginCollecteur?: string
  codeDirection?: string
  dateDebut?: string
  dateFin?: string
}

/** GET `/api/operation/list-arrete-to-valid` — une ligne par collecteur / date. */
export type ArreteToValidListItem = {
  codecltcoll?: string
  dateenreg?: string
  nomcoll?: string
  mntcoll?: number
  loginpoint?: string
  mntpoint?: number
  x3?: string
  x6?: string
}

/** GET `/api/operation/arrete-to-valid-details` — détail d’un arrêté. */
export type ArreteToValidDetailsDto = {
  compteLCEN?: string
  numAbonnemnt?: string
  compteLESN?: string
  compteLCE?: string
  compteLES?: string
  heureoperation?: string
  montant?: number
  nomClient?: string
  codeClient?: string
  reference?: string
}

export type ApiResponseArreteToValidDetails = {
  message?: string
  data?: ArreteToValidDetailsDto
  success?: boolean
}

export type ApiResponseListArreteToValidListItem = {
  message?: string
  data?: ArreteToValidListItem[]
  success?: boolean
}

export type SearchArreteValidationDto = {
  codeAgence: string
  date: string
}

export type ArreteValidationDto = {
  date?: string
  codeCollecteur?: string
  nomCollecteur?: string
  compteLes?: string
  compteLce?: string
  montantDeclare?: number
  solde?: number
  cordonnateur?: string
  montantConstate?: number
  ecart?: number
  reference?: string
  loginCollecteur?: string
}

export type ValiderArreteCollecteurDto = {
  compteToCredit: string
  montant: number
  codeAgence: string
  login: string
  referenceOperation: string
}

export type ApiResponseListArreteValidationDto = {
  message?: string
  data?: ArreteValidationDto[]
  success?: boolean
}

// --- User / workflow ---

export type WUtilisateurDto = {
  codeInstitution?: string
  codeBanque?: string
  matricule?: string
  nomPrenom?: string
  email?: string
  telephone?: string
  adresse?: string
  profil?: number
  etat?: number
  codeAgence?: string
}

export type WorkFlowRegisterDto = {
  direction?: string
  agence?: string
  loginUserSD: string
  niveauUserSD?: number
  loginUSerPR: string
  niveauUserPR?: number
}

/** SMS / renvoi paramètres (schéma partagé côté OpenAPI). Pour `POST /api/user/renvoyer-parametre`, le client envoie les trois champs renseignés — voir `RenvoyerParametreUserBody` dans `user.ts`. */
export type CodeSmsRequest = {
  codeOperation?: string
  codeBanque?: string
  login: string
}

export type WUtilisateurUpdateAgenceDto = {
  login: string
  oldCodeAgence: string
  newCodeAgence: string
}

export type WUtilisateurUpdateDto = {
  nomPrenom?: string
  email?: string
  telephone?: string
  adresse?: string
  profil?: number
  etat?: number
}

export type WorkFlow = {
  nomussd?: string
  nivpr?: number
  nivsd?: number
  loginuspr?: string
  loginussd?: string
  etat?: number
}

export type UtilisateurWithOtherInfo = {
  matricule?: string
  nomDirection?: string
  idProfil?: number
  institutionCode?: string
  niveau?: number
  /** Ex. `"Coordonnatrice"` — afficher à la place du code `idProfil` quand présent. */
  libelleProfil?: string
  nomAgence?: string
  reinitialisercompte?: number
  nomUtilisateur?: string
  superviseur?: number
  typeUtilisateur?: number
  habilitation?: number
  telephone?: string
  email?: string
  etat?: number
  login?: string
  codeAgence?: string
  codeDirection?: string
  /** Si l’API liste le renvoie — préremplissage « Renvoyer paramètres ». */
  codeOperation?: string
}

// --- Institution / DR / agence ---

export type InstitutionDto = {
  identifiant?: string
  libelle?: string
  sigle?: string
  telephone?: string
  adresse?: string
  email?: string
  siteInternet?: string
  codePays?: string
  senderSms?: string
  adresseFtp?: string
  utilisateurFtp?: string
  motDePasseFtp?: string
  repertoireFtp?: string
  adresseMessagerie?: string
  utilisateurMessagerie?: string
  motDePasseMessagerie?: string
  portMessagerie?: string
  cptsfd?: string
  etat?: string
  montantMise?: number | string
  /** Champs UI legacy (souvent présents côté API même hors OpenAPI minimal). */
  objetMailChangementPassword?: string
  objetMailConnexion?: string
  adresseSmtpServeurMail?: string
  adresseMailEnvoi?: string
  motDePasseMailEnvoi?: string
  nombreJoursExpirationMotDePasse?: number | string
  nombreJoursDesactivationClient?: number | string
  longueurLoginMotDePasse?: number | string
  natureMotDePasse?: string
  messageParametresConnexion?: string
  messageChangementParametresConnexion?: string
  messageCreationAbonnement?: string
  tempsLatenceCollectrices?: number | string
  natureDonnees?: string
  /** Base64 data URL or absolute URL returned by API */
  logo?: string
}

export type WDirectionRegionalDto = {
  codeDirection?: string
  libelleDirection?: string
  montantMinimumCollect?: number
  institution?: string
}

export type AgenceDto = {
  id?: number
  adresse?: string
  altitude?: string
  codeAgence: string
  codeAgenceN?: string
  codeBanque?: string
  codeBanquecodeAgence?: string
  connecte?: number
  cptagence?: string
  datesaisie?: string
  idwTypeAgence?: number
  latitude?: string
  longitude?: string
  nomAgence: string
  situationGeographique?: string
  telephone?: string
  typeNotif?: number
}

export type Agence = {
  nomAgence?: string
  codeAgence?: string
  codeBanque?: string
}

// --- Client / collecteur ---

export type WClientDto = {
  loginclient?: string
  codeClient?: string
  codecliorig?: string
  codeorigsys?: string
  codeclt?: string
  idwTypeClient?: number
  idwTypePieceAdm?: number
  idwSituationmat?: number
  idwCivilite?: number
  codeAgence?: string
  codeBanque?: string
  adresse?: string
  telephoneFixe?: string
  fax?: string
  email?: string
  gsmprincipale?: string
  password?: string
  dateconnexion?: string
  nomclient?: string
  etat?: number
  datecreation?: string
  datenaissance?: string
  numPiece?: string
  gsmsecondaire?: string
  changerpassword?: number
  profession?: string
  datevaliditepiece?: string
  indicatif?: string
  login?: string
  idcategorie?: number
  codePaysOrigine?: string
  codePaysResidence?: string
  lieunaiss?: string
  codeactivite?: string
  nompere?: string
  nommere?: string
  taillecleint?: string
  nombreenfant?: string
  datenaissancepere?: string
  datenaissancemere?: string
  dateetablissementpiece?: string
  lieunaisspere?: string
  lieunaissmere?: string
  nbtentative?: number
  codePackp?: string
  numniv?: string
  adhLep?: string
}

export type WClient = {
  id?: number
  loginclient: string
  codeClient: string
  codecliorig: string
  codeorigsys: string
  codeclt: string
  idwTypeClient: number
  idwTypePieceAdm: number
  idwSituationmat: number
  idwCivilite: number
  codeAgence: string
  codeBanque: string
  adresse?: string
  telephoneFixe?: string
  fax?: string
  email?: string
  gsmprincipale?: string
  password?: string
  dateconnexion?: string
  nomclient?: string
  etat?: number
  datecreation?: string
  datenaissance?: string
  numPiece?: string
  gsmsecondaire?: string
  changerpassword?: number
  profession?: string
  datevaliditepiece?: string
  indicatif?: string
  login?: string
  idcategorie?: number
  codePaysOrigine?: string
  codePaysResidence?: string
  lieunaiss?: string
  codeactivite?: string
  nompere?: string
  nommere?: string
  taillecleint?: string
  nombreenfant?: string
  datenaissancepere?: string
  datenaissancemere?: string
  dateetablissementpiece?: string
  lieunaisspere?: string
  lieunaissmere?: string
  nbtentative?: number
  codePackp?: string
  numniv?: string
  adhLep?: string
  /** Recherche / liste : préremplissage « Renvoyer paramètres » si présent. */
  codeOperation?: string
}

export type WClientDatas = {
  dateconnexion?: string
  nomclient?: string
  datecreation?: string
  changerpassword?: number
  idcategorie?: number
  adresse?: string
  etat?: number
  loginclient?: string
  login?: string
  codeClient?: string
  codeAgence?: string
  codeBanque?: string
  email?: string
  gsmprincipale?: string
  id?: number
  /** Liste API : préremplissage « Renvoyer paramètres » si présent. */
  codeOperation?: string
}

export type WClientSolde = {
  solde?: number
  nomclient?: string
}

export type WClientCollecteur = {
  telephoneCollecteur?: string
  loginCollecteur?: string
  nomCollecteur?: string
}

export type ClientDto = {
  codeClient: string
  nomClient: string
}

export type RemplacementCollecteurRequestDto = {
  clients: ClientDto[]
  codeCollecteurRemplacant: string
  codeCollecteurRemplacer: string
  etat?: number
}

export type ChangementAgenceCollecteurRequestDto = {
  loginUtilisaateur: string
  loginCollecteur: string
  newAgence: string
}

export type ValidPretRequest = {
  idDemande?: number
  login?: string
  motif?: string
}

export type AccountPlafondUpdateRequest = {
  compteComplet?: string
  increase: boolean
  amount: number
}

export type SearchCollecteurAbonnementDto = {
  codeClientCollecteur?: string
  startDate?: string
  endDate?: string
}

// --- Collecte (MOBILE) request bodies mirrored for completeness ---

export type TransactionRequest = {
  num_abonnement?: string
}

export type AbonnementRequest = {
  idAbonnement?: string
  typePeriode?: number
  codeClient?: string
  montantCommission?: number
  nombreMise?: number
  montantCollect?: number
  login?: string
  codeAgence?: string
  typeCollect?: number
  x1?: number
  x2?: number
  periodeCarte?: number
}

export type EnrolementRequest = Record<string, unknown>

export type DepotRequest = {
  abonnementId: string
  codeClient: string
  nombreDeMise?: number
  montant?: number
  login: string
  codeAgence: string
}

export type AccountInfoRequestDto = {
  login?: string
  compteComplet?: string
}

export type AccountInfoDto = {
  soldeDuCompte?: number
  montantCollectJour?: number
  plafond?: number
}

// --- Abonnement / admin ---

export type SearchAbonnementDto = {
  agence: string
  status: string
  dateDebut: string
  dateFin: string
}

export type WAbonnement = {
  idwAbonnement?: string
  idwPeriode?: number
  numeroCompte?: string
  codeCollect?: string
  montantCollect?: number
  compteLce?: string
  compteLes?: string
  status?: number
  codeClient?: string
  nomClient?: string
  codeBanque?: string
  codeAgence?: string
  dateAbonnement?: string
  gsmprincipale?: string
  dateDebut?: string
  dateFin?: string
  codetypcol?: number
  motifarret?: string
  datearret?: string
  datepassage?: string
  codeClientInst?: string
  numabonnemntTemp?: string
  x1?: string
  x2?: string
  x3?: number
  x4?: string
  x5?: string
  x6?: string
  x7?: string
  pcId?: number
  spId?: number
  longitude?: string
  altitude?: string
  latitude?: string
  codeAgenceN?: string
  compteLceN?: string
  compteLesN?: string
  codeClientInstN?: string
}

export type Compte = {
  idwAbonnement?: string
  compteLce?: string
  compteLes?: string
  compteLceN?: string
  compteLesN?: string
  typeClient?: string
  codeClient?: string
  status?: number
}

export type AbonnementUpdateCompteRequestDto = {
  compteLES?: string
  compteLCE?: string
  compteLESnouveau?: string
  compteLCEnouveau?: string
  codeClient?: string
  statut?: number
  typeClient?: string
  numAbonnement?: string
}

export type AbonnementReversementRequestDto = {
  numeroAbonnement: string
  motif: string
  login: string
}

export type AnnulerCollecteRequestDto = {
  refCollecte: string
  login: string
  motif?: string
}

// --- Administration prêt / objectif ---

export type WTypePretCnp = {
  cnpLibelle?: string
  id?: number
}

export type WTypePretPieceItem = {
  idwTypePieceAdm?: number
  wppOblig?: string
  wppRectoVerso?: string
}

/** GET /api/administration/type-pret list item */
export type WTypePretListItem = {
  id?: number
  libellePret?: string
  montantMax?: number
  plageDebut?: number
  plageFin?: number
  cnp?: WTypePretCnp
  WPiecesPret?: WTypePretPieceItem[]
}

export type WTypePretDto = {
  libellePret: string
  montantMin: number
  naturePret: number
  montantMax: number
  tauxUsure: number
  tauxInteret: number
  dureeMax: number
  tauxMin?: number
  tauxAssurance?: number
  fraisMisePlace?: number
  fraisDossier?: number
  typeCredit?: number
  mensualite?: number
  institution?: string
  penaliteRetard?: number
  jourPresentation?: number
  garantieFinanciere?: number
}

export type WPiecePretDto = {
  typePret: number
  typePiece: number
  obligatoire: string
  rectoVerso: string
  createdBy?: string
}

export type WObjectifDto = {
  id?: number
  codeClientCollecteur: string
  nomClientCollecteur: string
  codeAgence: string
  codeDirection: string
  mois: string
  annee: string
  dateDebut: string
  dateFin: string
  montantAttendu: number
  commissionAttendu: number
  adhesionSocietaire: number
  adhesionProspect: number
  adhessionLep: number
  login: string
}

export type SearchObjectifDto = {
  codeAgence: string
  annee: string
  mois: string
}

// --- Param ---

export type WTypePieceAdm = {
  id?: number
  abbrTypePieceAdm?: string
  libelleTypePieceAdm?: string
}

export type WTypeCollect = {
  idTypeCollect?: number
  libelle?: string
  codeOper?: string
  codeoperationbq?: string
  codebq?: string
  etat?: number
}

export type WTypeClient = {
  id?: number
  codeLibclt?: string
}

export type WSituationMatrimonial = {
  id?: number
  abbrSitMat: string
  situationmatrimoniale: string
}

export type WSecteuractivite = {
  codeactivite: string
  idwSecteuractivite?: number
  libelle?: string
  libelleacteco?: string
}

export type WPeriode = {
  id?: number
  libellePer?: string
  codeBanque?: string
  autreLibelle?: string
  statut?: number
}

export type WPays = {
  id?: number
  codePays?: string
  libellePays?: string
  codedevise?: string
  codeiso?: string
  indicatif?: string
  indicatifSms?: string
}

export type WCivilite = {
  idwCivilite?: number
  abbrCivi?: string
  libelleCivi?: string
}

// --- Pret mobile views (listed in spec) ---

export type VValidPretCoopec = {
  idwDemandePret?: number
  status?: number
  montantPret?: number
  codeClient?: string
  nomClient?: string
  dateDemande?: string
  motif?: string
  login?: string
  institution?: string
  codeAgence?: string
  idtypePret?: number
  cppId?: number
  codeDir?: string
  wnvId?: number
  loginValid?: string
}

export type VImpayePret = {
  refCredit?: string
  dateEcheance?: string
  montantEcheance?: number
  nomClient?: string
  codeAgence?: string
  codeCollectrice: string
  nomCollectrice?: string
}

export type Historique = {
  ancienNumeroDeCompte?: string
  nouveauNumeroDeCompte?: string
  ancienneAgence?: string
  nouvelleAgence?: string
  typeClient?: string
  codeClient?: string
  createdBy?: string
  id?: number
}

export type Transaction = {
  numgichet?: string
  montantCommision?: number
  heureoperation?: string
  montant?: number
  libelleTaxe?: string
  numabonnemnt?: string
}

// --- Auth ---

export type AuthenticationRequest = {
  username: string
  password: string
}

export type UpdatePasswordRequest = {
  username?: string
  codeSms?: string
  newPassword?: string
}

// --- Personne ressource ---

export type WPersonneReferenceDto = {
  codeclient?: string
  nomprenoms?: string
  numcell1?: string
  numcell2?: string
  adresse?: string
  lieuactivite?: string
  lienparent?: number
}
