"""Generate Word status document for Coopec Interface webapp."""
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Coopec-Interface-Etat-des-lieux.docx"


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    doc.add_heading(text, level=level)


def add_para(doc: Document, text: str, bold: bool = False) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold


def add_bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        doc.add_paragraph(item, style="List Bullet")


def add_table(doc: Document, headers: list[str], rows: list[list[str]]) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for p in hdr[i].paragraphs:
            for r in p.runs:
                r.bold = True
    for row in rows:
        cells = table.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = val


def build() -> Document:
    doc = Document()
    title = doc.add_heading("Coopec Interface — État des lieux", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = sub.add_run(f"Application web de gestion Coopec Collect\nDocument généré le {date.today().strftime('%d/%m/%Y')}")
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

    doc.add_paragraph()

    add_heading(doc, "1. Vue d'ensemble", 1)
    add_bullets(
        doc,
        [
            "Stack : React + TypeScript + Vite, interface shadcn/ui, routage React Router.",
            "Authentification : POST /api/auth/login-web (session stockée côté navigateur).",
            "Protection des routes dashboard via RequireAuth et déconnexion automatique après inactivité.",
            "Filtres globaux (institution, direction, agence) disponibles dans la barre latérale du dashboard.",
            "Application optimisée pour affichage bureau (message bloquant sur mobile).",
            "API backend configurable via variables d'environnement (VITE_API_BASE_URL, chemins personnalisés prêts, etc.).",
        ],
    )

    add_heading(doc, "2. Fonctionnalités transverses", 1)
    add_table(
        doc,
        ["Fonctionnalité", "Statut", "Détail"],
        [
            ["Filtre Direction / Agence (tiroir « Filtre »)", "En place", "Composant partagé DirectionAgenceFilterSheet + hook useDirectionAgenceFilters"],
            ["Exports Excel / PDF tableaux", "En place", "Utilitaire table-export.ts (colonnes, en-têtes, métadonnées)"],
            ["Pagination tableaux", "En place", "TablePaginationBar + useTablePagination"],
            ["Types OpenAPI", "En place", "openapi-components.ts aligné sur la doc API Coopec"],
            ["Enveloppes API", "En place", "Parsing success / message / data via api-envelope.ts"],
        ],
    )

    add_heading(doc, "3. Sections et écrans", 1)

    sections = [
        (
            "Connexion",
            "/login",
            "Opérationnel",
            [
                "Écran de connexion avec identifiants.",
                "Appel login-web et persistance de session.",
            ],
        ),
        (
            "Dashboard principal",
            "/dashboard",
            "Opérationnel",
            [
                "Tuiles statistiques (collecteurs en ligne, montants, opérations, charges épargne, cartes, annulations, etc.).",
                "Filtre collecteur par agence.",
                "Filtres institution / direction / agence (contexte global).",
                "Carte informations administrateur connecté.",
            ],
        ),
        (
            "Gestion des utilisateurs",
            "/dashboard/utilisateurs",
            "Opérationnel",
            [
                "Liste paginée : GET /api/user/find, /api/user/search.",
                "Création : POST /api/user.",
                "Modification : PATCH /api/user/{login}.",
                "Suppression : DELETE /api/user/{login}.",
                "Changement d'agence : POST /api/user/changer-agence.",
                "Renvoi paramètres connexion : POST /api/user/renvoyer-parametre.",
                "Workflow utilisateur : GET /api/user/workflow-list?login=… (tiroir Gestion des workflow).",
                "Filtre direction / agence (tiroir).",
                "Import / export Excel et PDF.",
            ],
        ),
        (
            "Gestion des collecteurs",
            "/dashboard/collecteurs",
            "Opérationnel",
            [
                "Liste par agence (filtre dashboard obligatoire).",
                "Filtre via tiroir « Filtre ».",
                "Export Excel / PDF.",
            ],
        ),
        (
            "Gestion des clients",
            "/dashboard/clients",
            "Opérationnel",
            [
                "Liste clients avec filtres dashboard.",
                "Filtre via tiroir « Filtre ».",
                "Export Excel / PDF.",
            ],
        ),
        (
            "Gestion des abonnements",
            "/dashboard/abonnements",
            "Opérationnel",
            [
                "Liste abonnements administration.",
                "Fiches détail et reversement (sheets).",
                "Filtre agence (sélecteur inline — pas encore le tiroir partagé).",
            ],
        ),
        (
            "Courbe collect",
            "/dashboard/courbe-collect",
            "Opérationnel",
            [
                "Graphique courbe de collecte.",
                "Export graphique (PNG / PDF selon implémentation chart-export).",
            ],
        ),
        (
            "Historique comptable",
            "/dashboard/historique",
            "Opérationnel",
            [
                "Consultation historique avec filtres période et agence.",
            ],
        ),
        (
            "Extraction fichier TXT",
            "/dashboard/extraction-txt",
            "Opérationnel",
            [
                "Génération et téléchargement fichiers TXT.",
            ],
        ),
        (
            "Extraction Carte à reverser",
            "/dashboard/extraction-carte",
            "Opérationnel",
            [
                "Extraction cartes à reverser avec filtres organisation.",
            ],
        ),
    ]

    admin_sections = [
        (
            "Gestion Coopec / Institutions",
            "/dashboard/coopec",
            "Opérationnel",
            ["CRUD institutions Coopec."],
        ),
        (
            "Gestion des agences",
            "/dashboard/agences",
            "Opérationnel",
            ["Liste et création agences via API agence."],
        ),
        (
            "Extraction TXT Superviseur",
            "/dashboard/extraction-txt-superviseur",
            "Opérationnel",
            ["Extraction TXT niveau superviseur."],
        ),
        (
            "Saisie des objectifs",
            "/dashboard/objectifs",
            "Opérationnel",
            [
                "Recherche : POST /api/administration/objectif/search { codeAgence, annee, mois }.",
                "Création : POST /api/administration/objectif (corps WObjectifDto complet).",
                "Modification : PATCH /api/administration/objectif/{id} (corps complet + id).",
                "Suppression : DELETE /api/administration/objectif { id } uniquement.",
                "Filtre direction + agence obligatoire (tiroir « Filtre »).",
            ],
        ),
        (
            "Configuration Type Prêt",
            "/dashboard/configuration-type-pret",
            "Opérationnel",
            [
                "Liste : GET /api/administration/type-pret.",
                "Création : POST /api/administration/type-pret (WTypePretDto).",
                "Modification : PATCH /api/administration/type-pret/{id}.",
                "Ajout pièce : POST /api/administration/type-pret/piece { typePret, typePiece, obligatoire, rectoVerso, createdBy }.",
                "Consultation pièces par type (tiroir).",
            ],
        ),
    ]

    ops_sections = [
        (
            "Arrêté / annulations",
            "/dashboard/operations/arretes-annulations",
            "Opérationnel",
            ["Filtre direction/agence (tiroir).", "Annulation collecte via API opérations."],
        ),
        (
            "Validations des arrêtés",
            "/dashboard/operations/validations-arretes",
            "Opérationnel",
            ["Validation arrêtés avec filtres organisation."],
        ),
        (
            "Reversements cartes",
            "/dashboard/operations/reversements-cartes",
            "Opérationnel",
            ["Filtre direction/agence (tiroir).", "Export Excel / PDF."],
        ),
        (
            "États cartes reversées",
            "/dashboard/operations/etats-cartes-reversees",
            "Opérationnel",
            ["État des cartes reversées."],
        ),
    ]

    etats_sections = [
        ("État annulations", "/dashboard/etats/annulations", "Opérationnel", []),
        (
            "État montants collectés",
            "/dashboard/etats/montants-collectes",
            "Opérationnel",
            ["Filtre direction/agence (tiroir).", "Export Excel / PDF."],
        ),
        ("Collectes non comptabilisées", "/dashboard/etats/collectes-non-comptabilisees", "Opérationnel", []),
        (
            "Journal répartitions collectes",
            "/dashboard/etats/journal-repartitions-collectes",
            "Opérationnel",
            ["Filtre direction/agence (tiroir, option toutes agences)."],
        ),
        ("Charge épargne", "/dashboard/etats/charge-epargne", "Opérationnel", []),
        ("Validation mensuelle collecte", "/dashboard/etats/validation-mensuelle-collecte", "Opérationnel", []),
        ("Comparatif collecte", "/dashboard/etats/comparatif-collecte", "Opérationnel", []),
        ("État consolidé", "/dashboard/etats/etat-consolide", "Opérationnel", []),
        ("État collecte prêts", "/dashboard/etats/collecte-prets", "Opérationnel", []),
        (
            "État paiement en ligne",
            "/dashboard/etats/paiement-en-ligne",
            "Opérationnel",
            ["Filtre direction/agence (tiroir).", "Export Excel / PDF."],
        ),
    ]

    prets_sections = [
        ("État détaillé prêt", "/dashboard/prets/etat-detaille", "Opérationnel", []),
        ("Suivi clientèle", "/dashboard/prets/suivi-clientele", "Opérationnel", []),
        ("État compensation", "/dashboard/prets/compensation", "Opérationnel", []),
        (
            "Workflow prêt",
            "/dashboard/prets/workflow",
            "Opérationnel",
            [
                "Liste demandes à valider (multi-chemins API avec repli).",
                "Accepter / rejeter demande.",
                "Pièces jointes, upload, consultations régularité et cumul carte.",
                "Niveau validation : GET /api/user/workflow-list?login=… (utilisateur connecté).",
            ],
        ),
        ("Envoi demande client", "/dashboard/prets/envoi-demande-client", "Opérationnel", ["Soumission offre prêt."]),
        (
            "Déblocage des prêts",
            "/dashboard/prets/deblocage",
            "Opérationnel",
            ["Déblocage et impression contrat PDF."],
        ),
        ("États prêts", "/dashboard/prets/etats-prets", "Opérationnel", ["Export Excel / PDF."]),
        ("Impayé collecte", "/dashboard/prets/impaye-collecte", "Opérationnel", []),
        ("Impayé prêt", "/dashboard/prets/impaye-pret", "Opérationnel", []),
    ]

    aide_sections = [
        ("Arrêté collectrice", "/dashboard/aide/arrete-collectrice", "Opérationnel", ["Aide / documentation interactive (accordéon)."]),
        ("Attribution compte LES/LCE", "/dashboard/aide/attribution-compte-les-lce", "Opérationnel", []),
        ("Consultation opérations", "/dashboard/aide/consultation-operations", "Opérationnel", []),
    ]

    def render_group(title: str, items: list) -> None:
        add_heading(doc, title, 2)
        for name, route, status, details in items:
            add_heading(doc, f"{name} — {status}", 3)
            add_para(doc, f"Route : {route}")
            if details:
                add_bullets(doc, details)
            doc.add_paragraph()

    render_group("3.1 Navigation principale", sections)
    render_group("3.2 Administration (menu Administration)", admin_sections)
    render_group("3.3 Gestion des opérations", ops_sections)
    render_group("3.4 États des opérations", etats_sections)
    render_group("3.5 Prêts", prets_sections)
    render_group("3.6 Aide", aide_sections)

    add_heading(doc, "4. Écrans et fonctionnalités NON PRÊTS", 1)
    add_para(
        doc,
        "Liste des éléments dont l'interface existe mais qui ne sont pas finalisés, "
        "ou dont les actions principales restent désactivées / non branchées à l'API.",
    )
    add_table(
        doc,
        ["Élément", "Route / emplacement", "Ce qui manque"],
        [
            [
                "Gestion des cartes clientèle",
                "/dashboard/cartes-clientele",
                "API non branchée (TODO dans le code). Tableau vide. Bouton « Extraire » désactivé. "
                "Actions Détail / Supprimer carte / Extraire non fonctionnelles.",
            ],
            [
                "Création d'un nouveau client",
                "/dashboard/clients — bouton « Nouveau »",
                "Bouton désactivé : écran de création client non implémenté.",
            ],
            [
                "Enregistrement association workflow",
                "Gestion des utilisateurs — Gestion des workflow",
                "Consultation seule (GET /api/user/workflow-list). "
                "POST /api/user/workflow-save (saveWorkflowAssociation) non exposé dans l'UI.",
            ],
            [
                "Suppression type de prêt",
                "/dashboard/configuration-type-pret",
                "Création, modification et ajout de pièces OK. Pas de suppression type prêt.",
            ],
            [
                "Suppression pièce d'un type prêt",
                "/dashboard/configuration-type-pret — tiroir Pièces",
                "Ajout de pièce OK (POST /api/administration/type-pret/piece). Pas de retrait pièce.",
            ],
            [
                "Export objectifs",
                "/dashboard/objectifs",
                "CRUD et recherche OK. Pas d'export Excel / PDF du tableau.",
            ],
            [
                "Version mobile",
                "Toute l'application",
                "Écran bloquant « Affichage bureau requis » — usage desktop uniquement.",
            ],
            [
                "Routes non définies",
                "Toute URL dashboard sans route",
                "Page placeholder « À venir » (DashboardPlaceholderPage).",
            ],
            [
                "Tests automatisés E2E",
                "Projet global",
                "Pas de suite de tests bout-en-bout documentée dans le dépôt.",
            ],
        ],
    )

    add_heading(doc, "5. Fonctionnalités PARTIELLES (en cours d'harmonisation)", 1)
    add_para(
        doc,
        "Ces écrans sont utilisables mais incomplets ou pas encore alignés sur les standards récents du projet.",
    )
    add_table(
        doc,
        ["Élément", "Route / emplacement", "Limitation actuelle"],
        [
            [
                "Gestion des abonnements — filtre agence",
                "/dashboard/abonnements",
                "Sélecteur agence inline dans la page, pas le tiroir « Filtre » Direction/Agence partagé.",
            ],
            [
                "Gestion des clients — filtre",
                "/dashboard/clients",
                "Tiroir filtres propre à la page (dashboard filters), pas DirectionAgenceFilterSheet.",
            ],
            [
                "Gestion des collecteurs — filtre",
                "/dashboard/collecteurs",
                "Idem : filtres dashboard, pas le composant Filtre unifié des écrans états/opérations.",
            ],
            [
                "États des cartes reversées — recherche client",
                "/dashboard/operations/etats-cartes-reversees",
                "Bouton loupe (picker client) désactivé ; saisie texte seule.",
            ],
            [
                "Arrêtés / annulations — export PDF",
                "/dashboard/operations/arretes-annulations",
                "Bouton export PDF désactivé sur le sous-tableau des opérations collecteur.",
            ],
            [
                "Module Prêts (workflow, envoi, déblocage)",
                "/dashboard/prets/*",
                "Services avec chemins API multiples et repli automatique ; "
                "variables VITE_PRET_* à configurer selon l'environnement. Validation production requise.",
            ],
            [
                "Tuiles dashboard",
                "/dashboard",
                "Dépendent des APIs stats ; certaines tuiles peuvent afficher « — » si l'API ne répond pas.",
            ],
            [
                "Import utilisateurs Excel",
                "/dashboard/utilisateurs",
                "Import charge des lignes en mémoire locale ; pas de persistance API automatique.",
            ],
        ],
    )

    add_heading(doc, "6. Synthèse des statuts", 1)
    add_table(
        doc,
        ["Statut", "Signification", "Nombre indicatif"],
        [
            ["Opérationnel", "Écran routé, API branchée, actions principales utilisables", "~45 écrans"],
            ["Partiel", "Écran utilisable avec limitations ou harmonisation en cours", "~8 points"],
            ["Non prêt", "UI présente mais fonctionnalité clé absente ou désactivée", "~9 points"],
        ],
    )

    add_heading(doc, "7. Services API principaux", 1)
    add_table(
        doc,
        ["Module", "Fichier service", "Domaine"],
        [
            ["Auth / session", "auth.ts, session.ts", "Connexion"],
            ["Utilisateurs", "user.ts", "CRUD, workflow-list, renvoyer-parametre"],
            ["Administration", "administration.ts", "Objectifs, types prêt, abonnements admin"],
            ["Clients / collecteurs", "client.ts, collecteur.ts", "Référentiels"],
            ["Abonnements", "abonnement.ts", "Abonnements"],
            ["Opérations", "operation.ts", "Arrêtés, reversements"],
            ["États", "etat-*.ts, journal-*.ts, etc.", "Rapports et états"],
            ["Prêts", "pret-*.ts", "Workflow, déblocage, impayés"],
            ["Extraction", "extraction-*.ts", "TXT, cartes"],
            ["Dashboard", "dashboard*.ts", "Tuiles et statistiques"],
            ["Paramètres", "param.ts", "Types pièce, référentiels"],
        ],
    )

    add_heading(doc, "8. Accès et navigation", 1)
    add_para(
        doc,
        "Depuis le dashboard, les sections avec sous-menus (Administration, Opérations, États, Prêts, Aide) "
        "s'ouvrent via le panneau latéral de sections. Les entrées directes du menu principal mènent "
        "immédiatement à leur écran (utilisateurs, collecteurs, clients, abonnements, courbe collect, etc.).",
    )

    return doc


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = build()
    doc.save(OUT)
    print(f"Document créé : {OUT}")


if __name__ == "__main__":
    main()
