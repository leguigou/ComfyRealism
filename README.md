# ComfyRealism

Une application full-stack moderne pour générer des images réalistes via une interface de chat connectée à un backend ComfyUI.

## Fonctionnalités
- **Interface de Chat** : Une expérience fluide type ChatGPT pour interagir avec l'IA.
- **Paramètres Avancés** : Ajustez la largeur, la hauteur, le CFG et les étapes directement depuis l'interface.
- **Accès Distant** : Support natif pour l'accès via nom de domaine ou IP externe (gestion dynamique des ports).
- **Sécurité** : Protection par mot de passe et cookies signés pour restreindre l'accès.
- **Gestion de l'Historique** : Sauvegarde automatique des sessions et des images générées.
- **Galerie** : Un espace dédié "Mes contenus" pour retrouver toutes vos créations triées par date.

## Installation Rapide

1. **Prérequis** :
   - Node.js installé.
   - ComfyUI installé et en cours d'exécution sur le port 8188.

2. **Configuration** :
   - Créez un fichier `backend/.env` (si non existant) :
     ```env
     AUTH_SECRET=une_cle_secrete_longue_et_aleatoire
     APP_PASSWORD=votre_mot_de_passe
     ```

3. **Lancement** :
   - Exécutez simplement `run.bat` à la racine du projet.

## Accès Externe (Configuration Routeur)

Pour accéder à votre instance depuis l'extérieur (ex: `http://votre-domaine.fr:55200`) :

| Service | Port WAN (Externe) | Port LAN (Interne) |
| :--- | :--- | :--- |
| **Interface Web** | 55200 | 5173 |
| **API Backend** | 55201 | 3001 |

*Note : L'application détecte automatiquement le passage sur le port 55200 pour rediriger les requêtes API vers le port 55201.*

## Structure du Projet
- `frontend/` : Interface React + Vite + TypeScript.
- `backend/` : Serveur Express + Node.js gérant la logique et l'historique.
- `backend/images/` : Stockage local des images générées.
- `backend/data/history.json` : Base de données JSON de l'historique.
