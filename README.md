# ComfyRealism

[![Build and Publish Docker Images](https://github.com/leguigou/ComfyRealism/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/leguigou/ComfyRealism/actions/workflows/docker-publish.yml)

Interface web multi-utilisateur pour générer, organiser et consulter des images avec ComfyUI. Le projet associe un frontend React à une API Express, une base SQLite et un suivi en temps réel par WebSocket.

## Fonctionnalités

- interface de chat responsive en français et en anglais ;
- génération ComfyUI avec suivi de la file, annulation et reprise par polling ;
- workflows JSON personnalisables, checkpoints, dimensions, seed, steps, CFG, sampler et scheduler ;
- amélioration facultative des prompts via OpenAI/ChatGPT, Anthropic Claude, Google Gemini, DeepSeek, xAI/Grok, Mistral, Groq, OpenRouter, Together, Ollama ou toute API compatible OpenAI ;
- historique, galerie, favoris, archives et visionneuse mobile ;
- conversion automatique des images et miniatures en WebP ;
- comptes isolés, administration des utilisateurs et mots de passe hachés ;
- thèmes clair et sombre, installation PWA et contrôle des mises à jour.

## Installation recommandée avec Docker

Prérequis : Docker, Docker Compose et une instance ComfyUI accessible.

```bash
git clone https://github.com/leguigou/ComfyRealism.git
cd ComfyRealism
cp .env.example .env
docker compose -f docker-compose.production.yml up -d
```

Avant le premier démarrage, remplacez impérativement dans `.env` :

```dotenv
APP_PASSWORD=un-mot-de-passe-administrateur-fort
AUTH_SECRET=une-cle-aleatoire-d-au-moins-32-caracteres
COMFY_URL=http://host.docker.internal:8188
```

L’application est ensuite disponible sur <http://localhost:5173>. L’API écoute sur <http://localhost:3001>.

Pour construire les images depuis le code local :

```bash
docker compose up --build -d
```

## Configuration

| Variable | Rôle | Valeur par défaut |
| --- | --- | --- |
| `APP_PASSWORD` | Mot de passe du premier administrateur | obligatoire |
| `AUTH_SECRET` | Signature des cookies, 32 caractères minimum | obligatoire |
| `COMFY_URL` | URL de ComfyUI vue depuis le backend | `http://host.docker.internal:8188` |
| `CORS_ORIGINS` | Origines frontend supplémentaires, séparées par des virgules | vide |
| `SERVICE_URL_ALLOWLIST` | Origines ComfyUI/LLM supplémentaires autorisées | vide |
| `ALLOW_PRIVATE_SERVICE_URLS` | Autorise les IP littérales de boucle locale et des réseaux privés, quel que soit le port | `false` |
| `ALLOW_USER_LLM_URLS` | Autorise chaque utilisateur à définir librement son URL LLM | `false` |
| `PORT` | Port de l’API | `3001` |

Les URL de services personnalisées sont refusées si leur origine n’est pas connue du serveur. Ajoutez les origines nécessaires dans `SERVICE_URL_ALLOWLIST`, activez `ALLOW_PRIVATE_SERVICE_URLS` pour les adresses IP locales/privées, ou activez `ALLOW_USER_LLM_URLS` si ce comportement est volontaire.

### Providers IA

Dans **Réglages → IA (LLM)**, ajoutez un ou plusieurs providers, renseignez leur clé API et choisissez le provider actif. Les modèles peuvent être récupérés depuis le service ou saisis manuellement. Les clés sont chiffrées dans SQLite avec une clé dérivée de `AUTH_SECRET` et ne sont jamais renvoyées au navigateur. Une modification de `AUTH_SECRET` impose donc de ressaisir les clés API.

Pour un serveur personnalisé, ajoutez son origine à `SERVICE_URL_ALLOWLIST`. Les providers cloud prédéfinis utilisent exclusivement leur URL officielle intégrée à l’application.

## Développement local

Prérequis : Node.js 22 ou plus récent, npm et ComfyUI.

Installez les dépendances :

```bash
cd backend
npm ci
cd ../frontend
npm ci
```

Lancez ensuite le backend et le frontend dans deux terminaux :

```bash
# Terminal 1
cd backend
npm run dev
```

```bash
# Terminal 2
cd frontend
npm run dev
```

Sous Windows, `run.bat` compile et lance automatiquement les deux services. Le script `run.sh` fournit le même raccourci sous Linux et macOS.

## Vérifications

```bash
cd backend
npm test
npm run build

cd ../frontend
npm test
npm run lint
npm run build
```

## Structure et données

- `frontend/` : application React, Vite et TypeScript ;
- `backend/` : API Express, WebSocket et SQLite ;
- `backend/workflows/` : workflows ComfyUI et leurs configurations ;
- `backend/data/history.db` : base de données persistante ;
- `images/` : images et miniatures, isolées par utilisateur.

Avec Docker, ces trois derniers emplacements sont montés depuis l’hôte. Sauvegardez régulièrement `backend/data`, `backend/workflows` et `images`.

## Maintenance Docker

```bash
# Afficher les journaux
docker compose -f docker-compose.production.yml logs -f

# Télécharger et redémarrer la dernière version
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d

# Arrêter les services sans supprimer les données
docker compose -f docker-compose.production.yml down
```

## Licence

Le backend est déclaré sous licence ISC. Vérifiez les licences propres à ComfyUI, aux modèles et aux workflows utilisés.
