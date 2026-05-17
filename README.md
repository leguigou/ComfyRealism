# ComfyRealism

Une application full-stack moderne et élégante pour générer des images via une interface de chat connectée à un backend ComfyUI.

## ✨ Fonctionnalités

- **💬 Interface de Chat Intuitive** : Une expérience fluide type ChatGPT pour interagir avec vos modèles d'image.
- **🎨 Génération Dynamique** : Support complet pour ComfyUI avec polling en temps réel.
- **🖼️ Gestion Intelligente des Médias** :
  - Stockage centralisé à la racine du projet.
  - **Miniatures à la volée** : Recréation automatique des miniatures si elles manquent.
  - Galerie "Mes contenus" pour parcourir vos créations.
- **🛠️ Paramètres Avancés** :
  - Sélection des Checkpoints via l'API ComfyUI (plus besoin de configurer les chemins locaux).
  - Contrôle précis : Dimensions, Steps, CFG, Seed, Negative Prompt.
  - Gestion des Workflows JSON personnalisés.
- **🤖 Optimisation IA (LLM)** : Option pour reformuler vos prompts via une API LLM compatible OpenAI/Ollama.
- **🌍 Multi-langue** : Support complet **Français** et **Anglais**.
- **🌙 Thèmes** : Modes Sombre et Clair disponibles.
- **🛡️ Sécurité & Robustesse** :
  - Protection par mot de passe et cookies signés.
  - Base de données **SQLite** performante via `better-sqlite3`.
  - Gestion d'erreurs détaillée (VRAM, modèles manquants, timeouts).
- **📝 Journal de Développement** : Suivi des versions et améliorations directement dans l'interface.

## 🚀 Installation & Lancement

### Méthode 1 : Docker (Recommandé)
Assurez-vous que Docker et Docker Compose sont installés.
```bash
docker-compose up --build -d
```
*L'interface sera accessible sur `http://localhost:5173`.*

### Méthode 2 : Lancement Local (Windows)
1. **Prérequis** : Node.js (v18+) et ComfyUI (port 8188).
2. **Configuration** : Créez un fichier `backend/.env` :
   ```env
   AUTH_SECRET=votre_secret_aleatoire
   APP_PASSWORD=votre_mot_de_passe
   ```
3. **Lancement** : Double-cliquez sur `run.bat` à la racine.

### Méthode 3 : Lancement Local (Linux/Raspberry Pi)
```bash
chmod +x run.sh
./run.sh
```

## 📂 Structure du Projet

- `/frontend` : Interface React + Vite + TypeScript.
- `/backend` : Serveur Express + Node.js (API & Gestion de file d'attente).
- `/images` : Stockage des générations (exclu des sauvegardes).
- `DEVELOPMENT_LOGS.md` : Historique détaillé des modifications techniques.

## 🛠️ Accès Externe

| Service | Port Interne | Port Externe (Suggéré) |
| :--- | :--- | :--- |
| **Interface Web** | 5173 | 55200 |
| **API Backend** | 3001 | 55201 |

## 📝 Crédits
Développé pour offrir une interface simplifiée et puissante à la puissance de ComfyUI.
