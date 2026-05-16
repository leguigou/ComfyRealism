# Guide de Déploiement - ComfyRealism

Ce document explique comment installer et faire fonctionner ComfyRealism sur un serveur distant ou une machine dédiée.

## 📋 Prérequis

Avant de commencer, assurez-vous que les éléments suivants sont installés sur votre serveur :

1. **Node.js** (v18 ou supérieur) & **npm**.
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
npm install
```

**Pour le Frontend :**
```bash
cd ../frontend
npm install
```

### 3. Configuration de l'Environnement

Créez un fichier `.env` dans le dossier `backend/` :
```bash
# backend/.env
PORT=3001
APP_PASSWORD=votre_mot_de_passe_securise
SESSION_SECRET=une_cle_aleatoire_tres_longue
```

### 4. Build du Frontend
Pour des performances optimales sur un serveur, il est conseillé de compiler le frontend :
```bash
cd frontend
npm run build
```
*Note : Pour l'instant, le backend sert les fichiers de développement. Pour une production stricte, il faudrait configurer Nginx ou adapter Express pour servir le dossier `frontend/dist`.*

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
3. **Configuration Backend** : Dans le frontend, si le backend n'est pas sur `localhost`, modifiez la variable `API_BASE` dans `App.tsx` pour pointer vers l'IP de votre serveur.

---

## 🔄 Maintenance

- **Logs** : `pm2 logs`
- **Redémarrage** : `pm2 restart all`
- **Sauvegarde base de données** : Le fichier `backend/data/history.db` contient tout votre historique. Pensez à le copier régulièrement.
