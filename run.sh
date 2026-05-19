#!/bin/bash

echo "========================================================="
echo "  ComfyRealism - Nettoyage et Lancement"
echo "========================================================="

# Nettoyage des ports existants
echo "🧹 Nettoyage des ports 3001 et 5173..."
fuser -k 3001/tcp 2>/dev/null
fuser -k 5173/tcp 2>/dev/null

# Démarre le backend en arrière-plan (&)
echo "🚀 Lancement du Backend (Port 3001)..."
cd backend && npm run dev &
PID_BACKEND=$!

# Démarre le frontend en arrière-plan (&)
echo "🚀 Lancement du Frontend (Port 5173)..."
cd frontend && npm run dev &
PID_FRONTEND=$!

# Si tu coupes le script avec Ctrl+C, ça tue proprement les deux serveurs
trap "echo 'Arrêt des serveurs...'; kill $PID_BACKEND $PID_FRONTEND; exit" INT TERM

# Laisse la console ouverte pour afficher tous les logs
echo "✨ Prêt ! Le navigateur va s'ouvrir sur http://localhost:5173"
sleep 3
# Tentative d'ouverture du navigateur selon l'OS
if command -v xdg-open > /dev/null; then
  xdg-open http://localhost:5173
elif command -v open > /dev/null; then
  open http://localhost:5173
fi

wait
