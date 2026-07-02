# ComfyRealism

[![Build and Publish Docker Images](https://github.com/leguigou/ComfyRealism/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/leguigou/ComfyRealism/actions/workflows/docker-publish.yml)

Une application full-stack moderne et élégante pour générer des images via une interface de chat connectée à un backend ComfyUI.

## ✨ Fonctionnalités

### 👤 Système Multi-Utilisateur
- **Isolément des Données** : Chaque utilisateur dispose de son propre répertoire d'images (`images/<user_id>`) et de miniatures.
- **Sécurité** : Authentification robuste avec mots de passe hachés (Bcrypt).
- **Administration** : Panneau dédié pour gérer les utilisateurs, réinitialiser les mots de passe et surveiller l'utilisation de l'espace disque.

### 💬 Expérience Chat & UI
- **Interface Intuitive** : Une expérience fluide type ChatGPT pour interagir avec vos modèles d'image.
- **Défilement Cinématique** : Animation de défilement ultra-douce (Cubic Easing) qui suit intelligemment l'apparition des nouvelles images.
- **Auto-Nettoyage** : La suppression d'un message ou d'une session dans l'interface efface physiquement les fichiers `.webp` et miniatures du disque.
- **Thèmes & Responsive** : Modes Sombre et Clair avec contrastes optimisés, parfaitement adapté aux mobiles.

### 🎨 Génération & Médias
- **Format Optimisé** : Toutes les images et miniatures sont converties automatiquement au format **WebP** pour un chargement rapide et un gain de place.
- **Miniatures à la volée** : Recréation automatique des miniatures si elles manquent.
- **Génération Dynamique** : Support complet pour ComfyUI avec polling en temps réel et minuteur de génération.
- **Galerie "Mes contenus"** : Parcourez l'historique complet de vos créations avec filtres (Actif/Archivé).

### 🛠️ Paramètres Avancés
- **Contrôle Précis** : Sélection des Checkpoints, Dimensions, Steps, CFG, Seed, Negative Prompt.
- **Workflows Flexibles** : Gestion et sélection de fichiers Workflows JSON personnalisés directement depuis l'interface.
- **🤖 Optimisation IA (LLM)** : Option pour reformuler vos prompts via une API LLM compatible OpenAI/Ollama (le "Prompt Enhancement").

## 🚀 Installation & Lancement

### Méthode 1 : Docker Production (Recommandé)
Utilise les images pré-construites pour un déploiement ultra-rapide.
```bash
cp .env.example .env
# Remplacez APP_PASSWORD et AUTH_SECRET avant le premier lancement.
docker-compose -f docker-compose.production.yml up -d
```

### Méthode 2 : Docker Développement (Local)
Construit les images localement à partir du code source.
```bash
cp .env.example .env
# Remplacez APP_PASSWORD et AUTH_SECRET avant le premier lancement.
docker-compose up --build -d
```

Les URL ComfyUI et LLM personnalisées sont refusées par défaut si leur origine
n'est pas connue du serveur. Ajoutez les origines supplémentaires, séparées par
des virgules, dans `SERVICE_URL_ALLOWLIST`. Si chaque utilisateur doit pouvoir
configurer librement sa propre URL LLM, définissez `ALLOW_USER_LLM_URLS=true`.

### Méthode 3 : Lancement Manuel (Windows)
1. **Prérequis** : Node.js (v22+) et ComfyUI (port 8188).
2. Copiez `backend/.env.example` vers `backend/.env`, puis remplacez les secrets.
3. **Lancement** : Double-cliquez sur `run.bat`.

## 📂 Structure du Projet

- `/frontend` : Interface React + Vite + TypeScript.
- `/backend` : Serveur Express + SQLite (better-sqlite3).
- `/images` : Stockage des générations (isolé par utilisateur).
- `DEVELOPMENT_LOGS.md` : Historique détaillé des versions.

## 📝 Crédits
Développé pour offrir une interface simplifiée et puissante exploitant toute la flexibilité de ComfyUI.
