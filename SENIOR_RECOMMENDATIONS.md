# Recommandations Senior - ComfyRealism

Ce document récapitule les pistes d'amélioration pour faire passer l'application d'un prototype propre à un produit robuste de niveau professionnel.

## 1. Centralisation de l'État (Context API / Zustand) 🏗️
- **Complexité :** Modérée.
- **Objectif :** Éviter de passer des dizaines de "props" à travers tous les composants.
- **Action :** Créer un store central pour les réglages (`params`) et l'authentification.

## 2. Validation des données (Zod) 🛡️
- **Complexité :** Faible.
- **Objectif :** Garantir que les données envoyées/reçues sont au bon format.
- **Action :** Définir des schémas de validation pour les requêtes de génération et les réponses API.

## 3. Virtualisation de la liste de messages ⚡
- **Complexité :** Modérée à Élevée.
- **Détails :** Actuellement, chaque message est rendu dans le DOM. Avec des centaines d'images, le navigateur ralentit.
- **Difficulté :** La principale difficulté est le défilement automatique (auto-scroll) et la gestion des hauteurs variables des images. L'intégration de `react-virtuoso` est recommandée.
- **Bénéfice :** Navigation instantanée même avec des milliers de messages.

## 4. Tests automatisés 🧪
- **Complexité :** Modérée.
- **Objectif :** Sécuriser les futures modifications.
- **Action :** Ajouter des tests unitaires pour les hooks et des tests E2E avec Playwright.

## 5. Architecture Backend en Services 🏛️
- **Complexité :** Modérée.
- **Objectif :** Séparer la logique métier de la logique de routage Express.
- **Action :** Isoler les appels SQL et les appels ComfyUI dans des classes de services dédiées.

## 6. Gestion des erreurs (Error Boundaries) 🚧
- **Complexité :** Faible.
- **Détails :** Empêcher qu'un plantage d'un composant (ex: Galerie) ne fasse disparaître tout le site.
- **Mise en place :** Très simple techniquement via une classe React standard. La réflexion porte surtout sur le design visuel du message d'erreur de remplacement.
- **Bénéfice :** Application beaucoup plus résiliente.

---
*Document généré le 20 mai 2026 suite à la refactorisation majeure.*
