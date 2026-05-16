# Fonctionnalités de ComfyRealism

Ce document récapitule les fonctionnalités implémentées dans l'application ComfyRealism.

## 🎨 Interface & UX (Chat)
- **Chat en Temps Réel** : Interface fluide pour discuter avec l'IA et générer des images via ComfyUI.
- **Animation "Bounced"** : Indicateur de chargement moderne avec des billes rebondissantes pour patienter pendant la génération.
- **Indicateur de File d'Attente** : Affiche si l'image est en attente ou en cours de traitement.
- **Annulation Contextuelle** : Bouton "Annuler" directement dans la bulle de chargement pour stopper une génération.
- **Nettoyage des Textes Redondants** : Le prompt n'est pas répété s'il est identique au message précédent, pour un chat plus aéré.
- **Raccourcis Clavier** : 
    - `Echap` pour fermer la visionneuse.
    - `Flèches Gauche/Droite` pour naviguer entre les images.

## 🖼️ Galerie & Visionneuse
- **Gestion "Mes Contenus"** : Galerie dédiée regroupant toutes vos créations.
- **Navigation Segmentée** : Onglets distincts pour le contenu "Actif" et les "Archives".
- **Visionneuse Premium (Lightbox)** :
    - Ouverture des images en grand format avec effet de zoom.
    - Bouton **"Voir dans le chat"** 💬 pour retrouver le contexte d'origine.
    - Bouton **"Enregistrer"** 💾 direct depuis la vue plein écran.
    - Support du **Balayage Tactile (Swipe)** sur mobile.

## 📱 Optimisation Mobile (Mobile-First)
- **Viewport Dynamique** : Utilisation de `100dvh` pour éviter que l'interface ne soit mangée par les barres de navigation des smartphones.
- **Safe Area Support** : Padding automatique pour les boutons système (iPhone/Android).
- **Responsive Settings** : Les paramètres s'empilent verticalement sur mobile pour une manipulation aisée.
- **Sidebar Intelligente** : Boutons d'édition contextuels (icônes uniquement sur mobile) et maintien de l'ouverture lors de la navigation dans l'historique.

## ⚙️ Technique & Backend
- **WebSocket Résilient** : Reconnexion automatique toutes les 3s et synchronisation forcée au "réveil" du téléphone (via `visibilitychange`).
- **Polling de Secours** : Système hybride qui vérifie l'état de l'image toutes les 3s si le WebSocket échoue.
- **Optimisation Image (WebP)** : Conversion automatique en WebP et génération de miniatures pour une vitesse de chargement optimale.
- **Base de Données SQLite** : Historique complet avec persistance de la **Seed**, du modèle, du workflow et des dimensions.
- **Internationalisation (i18n)** : Support complet Français/Anglais de l'intégralité de l'interface et des réglages techniques.
- **Proxy ComfyUI** : Tunnel sécurisé gérant les requêtes et le flux WebSocket vers l'instance ComfyUI locale.

## 🤖 Intelligence Artificielle (LLM)
- **Optimisation de Prompt** : Intégration avec des LLM (Ollama/OpenAI) pour transformer des idées simples en prompts détaillés.
- **Gestion des Modèles** : Scan automatique du répertoire des Checkpoints ComfyUI.
