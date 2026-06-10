# Coopec Interface (Web v2)

Interface web de gestion **Coopec Collect** — tableau de bord, administration, opérations, états, prêts et extractions. Application **React + TypeScript + Vite**, conçue pour un usage **bureau** (desktop).

## Liens GitLab

| Ressource | URL |
|-----------|-----|
| **Dépôt** | https://gitlab.com/djogana-pay/coopec_web_v2 |
| **Branches** | https://gitlab.com/djogana-pay/coopec_web_v2/-/branches |
| **Pipelines CI/CD** | https://gitlab.com/djogana-pay/coopec_web_v2/-/pipelines |
| **Variables CI/CD** | https://gitlab.com/djogana-pay/coopec_web_v2/-/settings/ci_cd |
| **Merge requests** | https://gitlab.com/djogana-pay/coopec_web_v2/-/merge_requests |

## Ports et URLs

| Contexte | Port / URL | Description |
|----------|------------|-------------|
| **Interface web (Docker)** | Hôte **8010** → conteneur **8010** | Front React/Nginx — déploiement GitLab CI |
| **API Coopec (backend)** | https://coopeccollect.djogana-pay.com:**9091** | API Java — **ne pas réutiliser le port 9091 pour le front** |
| **Dev local (Vite)** | http://localhost:5173 | `npm run dev` — proxy `/api` via `VITE_API_PROXY_TARGET` |
| **Preview build local** | http://localhost:4173 | `npm run preview` après `npm run build` |

> Sur le serveur `peya-pay-test-2`, le port **9091** est déjà occupé par l’API backend. L’interface web est exposée sur le port **8010**.

### Déploiement par branche

| Branche | Job GitLab | Runner tag | Port interface | Déclenchement |
|---------|------------|------------|----------------|---------------|
| `develop` | `deploy-dev` | `build` | **8010** | Push sur `develop` |
| `production` | `deploy-production` | `production` | **8010** | Push sur `production` |

Après déploiement, l’interface est accessible sur :

- **Développement** : `http://<serveur-runner-build>:8010`
- **Production** : `http://<serveur-runner-production>:8010`

Le port hôte est surchargeable via la variable CI `APP_HOST_PORT` (ex. `9080` si 8010 est pris).

### Variables CI/CD recommandées (GitLab → Settings → CI/CD → Variables)

| Variable | Environnement | Exemple | Rôle |
|----------|---------------|---------|------|
| `VITE_API_BASE_DEV` | develop | `https://coopeccollect.djogana-pay.com:9091` | URL API au build Docker (dev) |
| `VITE_API_BASE_PROD` | production | `https://coopeccollect.djogana-pay.com:9091` | URL API au build Docker (prod) |
| `APP_HOST_PORT` | les deux | `8010` | Port hôte de l’interface (défaut : 8010) |
| `VITE_LOGIN_PATH` | les deux | `/api/auth/login-web` | Endpoint de connexion (optionnel) |

## Prérequis

- **Node.js** 20+ (recommandé)
- **npm** 10+
- Accès à l’API Coopec (URL de base et identifiants)

## Installation

```bash
git clone https://gitlab.com/djogana-pay/coopec_web_v2.git
cd coopec_web_v2
git checkout develop
npm install
```

Créez un fichier `.env` à la racine (non versionné) et configurez-le selon votre environnement (voir ci-dessous).

## Démarrage

```bash
# Développement (Vite + proxy API optionnel)
npm run dev

# Build de production
npm run build

# Aperçu du build
npm run preview
```

## Configuration

Variables principales pour `.env` :

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | URL de base de l’API (vide = même origine / proxy) |
| `VITE_LOGIN_PATH` | Endpoint de connexion (défaut : `/api/auth/login-web`) |
| `VITE_API_PROXY_TARGET` | Cible du proxy Vite en local (voir `vite.config.ts`) |
| `VITE_DASHBOARD_STATS_PATH` | Statistiques du tableau de bord |

D’autres chemins optionnels (`VITE_PRET_*`, `VITE_ETAT_*`, etc.) peuvent être ajoutés dans `.env` selon les écrans utilisés.

## Fonctionnalités principales

### Tableau de bord
- Tuiles statistiques (collecteurs, montants, opérations, épargne, cartes…)
- Filtres institution / direction / agence / collecteur

### Gestion
- **Utilisateurs** — CRUD, changement d’agence, renvoi paramètres, consultation workflow
- **Collecteurs** et **clients** — listes, filtres, exports Excel/PDF
- **Abonnements** — consultation, détail, reversement

### Administration
- Institutions Coopec et agences
- **Objectifs** — recherche, création, modification, suppression (API administration)
- **Configuration type prêt** — liste, enregistrement, modification, pièces jointes
- Extraction TXT superviseur, cartes clientèle (partiel)

### Opérations
- Arrêtés / annulations, validations des arrêtés
- Reversements cartes, états des cartes reversées

### États
- Montants collectés, annulations, collectes non comptabilisées
- Journal répartitions, charge épargne, validation mensuelle
- Comparatif, consolidé, collecte prêts, paiement en ligne

### Prêts
- Workflow, envoi demande client, déblocage
- États détaillés, suivi clientèle, compensation, impayés

### Autres
- Courbe de collecte, historique comptable, extractions TXT/carte
- Pages d’aide (documentation intégrée)

## Filtres et exports

- **Filtre Direction / Agence** : tiroir latéral « Filtre » (`DirectionAgenceFilterSheet`) sur les écrans concernés
- **Exports tableaux** : Excel et PDF via `src/utils/table-export.ts`

## Structure du projet

```
src/
  components/     # Composants UI réutilisables
  contexts/       # Filtres dashboard, navigation sections
  hooks/          # Pagination, filtres direction/agence
  layouts/        # Shell dashboard, pages tableaux
  pages/          # Écrans par domaine métier
  services/       # Appels API (auth, user, administration, prêts…)
  utils/          # Mappers, session, exports
docs/             # Documentation d’état des lieux (Word)
scripts/          # Scripts utilitaires (génération doc)
```

## Déploiement Docker (GitLab CI)

Le fichier `.gitlab-ci.yml` construit l’image et lance le conteneur :

```bash
docker build -t coopec_web_v2:<commit> .
docker run --restart always -d -p 8010:8010 --name coopec_web_v2 coopec_web_v2:<commit>
```

- **Dockerfile** : build Vite + Nginx (écoute **8010** dans le conteneur)
- **Mapping** : `-p 8010:8010` (port hôte **8010** — API séparée sur **9091**)
- **Nom du conteneur** : `$CI_PROJECT_NAME` (= `coopec_web_v2`)

Build manuel local :

```bash
docker build --build-arg VITE_API_BASE="https://coopeccollect.djogana-pay.com:9091" -t coopec-interface .
docker run --rm -p 8010:8010 coopec-interface
# → http://localhost:8010
```

## Branches

| Branche | Usage | Déploiement |
|---------|--------|-------------|
| `develop` | Intégration — push sur GitLab | Job `deploy-dev` (runner `build`) |
| `production` | Production | Job `deploy-production` (runner `production`) |
| `main` | Historique / miroir GitHub (si applicable) | — |

## État d’avancement

Un document détaillé **opérationnel / partiel / non prêt** est disponible dans :

`docs/Coopec-Interface-Etat-des-lieux.docx`

Pour le régénérer :

```bash
pip install python-docx
python scripts/generate-status-docx.py
```

## Sécurité

- Ne commitez **jamais** le fichier `.env` (identifiants, URLs internes).
- L’authentification repose sur la session API Coopec (`login-web`).

## Licence

Projet privé — **Djogana Pay** / Coopec. Usage interne sauf accord contraire.
