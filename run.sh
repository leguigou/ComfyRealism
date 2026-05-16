#!/bin/bash

# Démarre le backend en arrière-plan (&)
echo "🚀 Lancement du Backend..."
cd backend && npm run dev &
PID_BACKEND=$!

# Démarre le frontend en arrière-plan (&)
echo "🚀 Lancement du Frontend..."
cd frontend && npm run dev &
PID_FRONTEND=$!

# Si tu coupes le script avec Ctrl+C, ça tue proprement les deux serveurs
trap "echo 'Arrêt des serveurs...'; kill $PID_BACKEND $PID_FRONTEND; exit" INT TERM

# Laisse la console ouverte pour afficher tous les logs
wait
