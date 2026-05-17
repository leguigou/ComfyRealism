# ComfyRealism

[![Build and Publish Docker Images](https://github.com/leguigou/ComfyRealism/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/leguigou/ComfyRealism/actions/workflows/docker-publish.yml)

Une application full-stack moderne et élégante pour générer des images via une interface de chat connectée à un backend ComfyUI.

## ✨ Fonctionnalités

- **💬 Interface de Chat Intuitive** : Une expérience fluide type ChatGPT pour interagir avec vos modèles d'image.
- **🎨 Génération Dynamique** : Support complet pour ComfyUI avec polling en temps réel.
- **🖼️ Gestion Intelligente des Médias** :
  - Stockage centralisé à la racine du projet.
  - **Miniatures à la volée** : Recréation automatique des miniatures si elles manquent.
  - Galerie "Mes contenus" pour parcourir vos créations.
- **🛠️ Paramètres Avancés** :
  - Sélection des Checkpoints via l'API ComfyUI.
  - Contrôle précis : Dimensions, Steps, CFG, Seed, Negative Prompt.
  - Gestion des Workflows JSON personnalisés.
- **🤖 Optimisation IA (LLM)** : Option pour reformuler vos prompts via une API LLM compatible OpenAI/Ollama.
- **🌍 Multi-langue** : Support complet **Français** et **Anglais**.
- **🌙 Thèmes** : Modes Sombre et Clair avec contrastes optimisés.
- **🛡️ Sécurité & Robustesse** :
  - Protection par mot de passe et cookies signés.
  - Base de données **SQLite** performante via `better-sqlite3`.
  - Gestion d'erreurs détaillée (VRAM, modèles manquants, timeouts).
- **⚙️ CI/CD & Docker** : Builds automatiques sur GitHub Actions et stockage sur GHCR.

## 🚀 Installation & Lancement

### Méthode 1 : Docker Production (Recommandé / Dokploy)
Utilise les images pré-construites sur GitHub pour un déploiement ultra-rapide.
```bash
docker-compose -f docker-compose.production.yml up -d
```
*L'interface sera accessible sur `http://localhost:5173`.*

### Méthode 2 : Docker Développement (Local)
Construit les images localement à partir du code source.
```bash
docker-compose up --build -d
```

### Méthode 3 : Lancement Sans Docker (Windows)
1. **Prérequis** : Node.js (v22+) et ComfyUI (port 8188).
2. **Configuration** : Créez un fichier `backend/.env`.
3. **Lancement** : Double-cliquez sur `run.bat`.

### Méthode 4 : Lancement Sans Docker (Linux/Raspberry Pi)
```bash
chmod +x run.sh
./run.sh
```

## 📂 Structure du Projet

- `/frontend` : Interface React + Vite + TypeScript.
- `/backend` : Serveur Express + Node.js 22.
- `/images` : Stockage des générations (exclu des sauvegardes).
- `DEVELOPMENT_LOGS.md` : Historique détaillé des modifications.

## 🛠️ Accès Externe

| Service | Port Interne | Port Externe (Suggéré) |
| :--- | :--- | :--- |
| **Interface Web** | 80 (Docker) / 5173 | 55200 |
| **API Backend** | 3001 | 55201 |

## 📝 Crédits
Développé pour offrir une interface simplifiée et puissante à la puissance de ComfyUI.
