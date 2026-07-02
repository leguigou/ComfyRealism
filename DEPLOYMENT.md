# Guide de Déploiement - ComfyRealism

Ce document explique comment installer et faire fonctionner ComfyRealism sur un serveur distant ou une machine dédiée.

## 📋 Prérequis

Avant de commencer, assurez-vous que les éléments suivants sont installés sur votre serveur :

1. **Node.js** (v22 ou supérieur) & **npm**.
2. **ComfyUI** : L'instance doit être accessible via une URL (ex: `http://127.0.0.1:8188`).
3. **Ollama** (Optionnel) : Si vous souhaitez utiliser l'optimisation de prompt par IA en local.
4. **PM2** (Recommandé) : Pour maintenir l'application active en arrière-plan.
   ```bash
   npm install -g pm2
   ```

---

## 🚀 Étapes d'Installation

### 1. Clonage et Préparation
Copiez les fichiers du projet sur votre serveur, puis accédez au répertoire racine.

### 2. Installation des Dépendances

**Pour le Backend :**
```bash
cd backend
npm ci
```

**Pour le Frontend :**
```bash
cd ../frontend
npm ci
```

### 3. Configuration de l'Environnement

Créez un fichier `.env` dans le dossier `backend/` :
```bash
# backend/.env
PORT=3001
APP_PASSWORD=votre_mot_de_passe_securise
AUTH_SECRET=une_cle_aleatoire_d_au_moins_32_caracteres
COMFY_URL=http://127.0.0.1:8188
# Origines de services additionnelles, séparées par des virgules :
SERVICE_URL_ALLOWLIST=http://127.0.0.1:11434
# Autoriser chaque utilisateur authentifié à saisir sa propre URL LLM :
ALLOW_USER_LLM_URLS=false
```

### 4. Build du Frontend
Pour des performances optimales sur un serveur, il est conseillé de compiler le frontend :
```bash
cd frontend
npm run build
```
*Pour Docker, le fichier `frontend/nginx.conf` sert le frontend et relaie `/api` vers le backend.*

---

## 🛠️ Lancement de l'Application

La méthode la plus robuste consiste à utiliser **PM2**.

### Démarrage du Backend
Depuis le dossier `backend/` :
```bash
pm2 start ts-node -- -P tsconfig.json index.ts --name "comfy-backend"
```

### Démarrage du Frontend (Mode Dev)
Depuis le dossier `frontend/` :
```bash
pm2 start npm --name "comfy-frontend" -- run dev -- --host
```

---

## 🌐 Accès à distance

1. **Pare-feu** : Ouvrez les ports `3000` (Frontend) et `3001` (Backend) sur votre serveur.
2. **Configuration ComfyUI** : Dans les paramètres de l'application (une fois lancée), assurez-vous de renseigner l'IP réelle de votre instance ComfyUI si elle n'est pas sur le même serveur.
3. **Configuration Backend** : Pour un frontend réellement séparé du backend, définissez `VITE_API_URL` au moment du build et ajoutez son origine à `CORS_ORIGINS`.

---

## 🔄 Maintenance

- **Logs** : `pm2 logs`
- **Redémarrage** : `pm2 restart all`
- **Sauvegarde base de données** : Le fichier `backend/data/history.db` contient tout votre historique. Pensez à le copier régulièrement.
