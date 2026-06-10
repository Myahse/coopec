import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { DashboardPage } from './pages/DashboardPage/DashboardPage'
import { DashboardPlaceholderPage } from './pages/DashboardPage/DashboardPlaceholderPage'
import { UserManagementPage } from './pages/UsersPage/UserManagementPage'
import { ArreteCollectricePage } from './pages/AidePage/ArreteCollectricePage'
import { AttributionCompteLesLcePage } from './pages/AidePage/AttributionCompteLesLcePage'
import { ConsultationOperationsPage } from './pages/AidePage/ConsultationOperationsPage'
import { AgenceManagementPage } from './pages/AgencesPage/AgenceManagementPage'
import { ExtractionTxtPage } from './pages/ExtractionTxtPage/ExtractionTxtPage'
import { ExtractionTxtSuperviseurPage } from './pages/ExtractionTxtPage/ExtractionTxtSuperviseurPage'
import { CartesClientelePage } from './pages/CartesClientelePage/CartesClientelePage'
import { ObjectifsPage } from './pages/ObjectifsPage/ObjectifsPage'
import { ConfigurationTypePretPage } from './pages/TypePretPage/ConfigurationTypePretPage'
import { CollecteursPage } from './pages/CollecteursPage/CollecteursPage'
import { ClientsPage } from './pages/ClientsPage/ClientsPage'
import { CoopecInstitutionsPage } from './pages/CoopecInstitutionsPage/CoopecInstitutionsPage'
import { AbonnementsPage } from './pages/AbonnementsPage/AbonnementsPage'
import { ArretesAnnulationsPage } from './pages/OperationsPage/ArretesAnnulationsPage'
import { ValidationsArretesPage } from './pages/OperationsPage/ValidationsArretesPage'
import { ReversementsCartesPage } from './pages/OperationsPage/ReversementsCartesPage'
import { EtatsCartesReverseesPage } from './pages/OperationsPage/EtatsCartesReverseesPage'
import { EtatAnnulationsPage } from './pages/EtatsPage/EtatAnnulationsPage'
import { EtatMontantsCollectesPage } from './pages/EtatsPage/EtatMontantsCollectesPage'
import { EtatCollectesNonComptabiliseesPage } from './pages/EtatsPage/EtatCollectesNonComptabiliseesPage'
import { JournalRepartitionsCommissionsPage } from './pages/EtatsPage/JournalRepartitionsCommissionsPage'
import { ChargeEpargnePage } from './pages/EtatsPage/ChargeEpargnePage'
import { ValidationMensuelleCollectePage } from './pages/EtatsPage/ValidationMensuelleCollectePage'
import { ComparatifCollectePage } from './pages/EtatsPage/ComparatifCollectePage'
import { EtatCollectePretsPage } from './pages/EtatsPage/EtatCollectePretsPage'
import { EtatPaiementEnLignePage } from './pages/EtatsPage/EtatPaiementEnLignePage'
import { EtatConsolidePage } from './pages/EtatsPage/EtatConsolidePage'
import { EtatDetaillePretPage } from './pages/PretsPage/EtatDetaillePretPage'
import { SuiviClientelePage } from './pages/PretsPage/SuiviClientelePage'
import { EtatCompensationPage } from './pages/PretsPage/EtatCompensationPage'
import { WorkflowPretPage } from './pages/PretsPage/WorkflowPretPage'
import { EnvoiDemandeClientPage } from './pages/PretsPage/EnvoiDemandeClientPage'
import { DeblocagePretsPage } from './pages/PretsPage/DeblocagePretsPage'
import { EtatsPretsPage } from './pages/PretsPage/EtatsPretsPage'
import { ImpayeCollectePage } from './pages/PretsPage/ImpayeCollectePage'
import { ImpayePretPage } from './pages/PretsPage/ImpayePretPage'
import { ExtractionCartesAReverserPage } from './pages/ExtractionCartePage/ExtractionCartesAReverserPage'
import { HistoriqueComptablePage } from './pages/HistoriqueComptablePage/HistoriqueComptablePage'
import { CourbeCollectPage } from './pages/CourbeCollectPage/CourbeCollectPage'
import { DashboardAppLayout } from './layouts/DashboardAppLayout'
import { RequireAuth } from './components/RequireAuth'

export default function App() {
  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground sm:hidden">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center text-card-foreground">
          <div className="text-lg font-semibold">Affichage bureau requis</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Ce site est conçu pour être utilisé uniquement sur ordinateur. Veuillez ouvrir l’application sur une
            vue desktop.
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <Routes>
          <Route index element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardAppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="utilisateurs" element={<UserManagementPage />} />
            <Route path="collecteurs" element={<CollecteursPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="coopec" element={<CoopecInstitutionsPage />} />
            <Route path="abonnements" element={<AbonnementsPage />} />
            <Route path="agences" element={<AgenceManagementPage />} />
            <Route path="extraction-txt" element={<ExtractionTxtPage />} />
            <Route path="extraction-txt-superviseur" element={<ExtractionTxtSuperviseurPage />} />
            <Route path="courbe-collect" element={<CourbeCollectPage />} />
            <Route path="extraction-carte" element={<ExtractionCartesAReverserPage />} />
            <Route path="historique" element={<HistoriqueComptablePage />} />
            <Route path="cartes-clientele" element={<CartesClientelePage />} />
            <Route path="objectifs" element={<ObjectifsPage />} />
            <Route path="configuration-type-pret" element={<ConfigurationTypePretPage />} />
            <Route path="operations/arretes-annulations" element={<ArretesAnnulationsPage />} />
            <Route path="operations/validations-arretes" element={<ValidationsArretesPage />} />
            <Route path="operations/reversements-cartes" element={<ReversementsCartesPage />} />
            <Route path="operations/etats-cartes-reversees" element={<EtatsCartesReverseesPage />} />
            <Route path="etats/annulations" element={<EtatAnnulationsPage />} />
            <Route path="etats/montants-collectes" element={<EtatMontantsCollectesPage />} />
            <Route
              path="etats/collectes-non-comptabilisees"
              element={<EtatCollectesNonComptabiliseesPage />}
            />
            <Route
              path="etats/journal-repartitions-collectes"
              element={<JournalRepartitionsCommissionsPage />}
            />
            <Route
              path="etats/journal-repartitions-commissions"
              element={<Navigate to="/dashboard/etats/journal-repartitions-collectes" replace />}
            />
            <Route path="etats/charge-epargne" element={<ChargeEpargnePage />} />
            <Route
              path="etats/validation-mensuelle-collecte"
              element={<ValidationMensuelleCollectePage />}
            />
            <Route path="etats/comparatif-collecte" element={<ComparatifCollectePage />} />
            <Route path="etats/etat-consolide" element={<EtatConsolidePage />} />
            <Route path="etats/collecte-prets" element={<EtatCollectePretsPage />} />
            <Route path="etats/paiement-en-ligne" element={<EtatPaiementEnLignePage />} />
            <Route path="prets/etat-detaille" element={<EtatDetaillePretPage />} />
            <Route path="prets/suivi-clientele" element={<SuiviClientelePage />} />
            <Route path="prets/compensation" element={<EtatCompensationPage />} />
            <Route path="prets/workflow" element={<WorkflowPretPage />} />
            <Route path="prets/envoi-demande-client" element={<EnvoiDemandeClientPage />} />
            <Route path="prets/deblocage" element={<DeblocagePretsPage />} />
            <Route path="prets/etats-prets" element={<EtatsPretsPage />} />
            <Route path="prets/impaye-collecte" element={<ImpayeCollectePage />} />
            <Route path="prets/impaye-pret" element={<ImpayePretPage />} />
            <Route path="aide/arrete-collectrice" element={<ArreteCollectricePage />} />
            <Route path="aide/attribution-compte-les-lce" element={<AttributionCompteLesLcePage />} />
            <Route path="aide/consultation-operations" element={<ConsultationOperationsPage />} />
            <Route path="*" element={<DashboardPlaceholderPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  )
}
