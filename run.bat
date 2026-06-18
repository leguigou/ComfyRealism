@echo off
title ComfyRealism Starter
echo =========================================================
echo   ComfyRealism - Nettoyage et Lancement
echo =========================================================

:: Kill existing processes on ports 3001 and 5173 (if any)
echo [1/3] Nettoyage des processus sur les ports 3001 et 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo    - Arret du processus Backend (PID %%a)
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo    - Arret du processus Frontend (PID %%a)
    taskkill /f /pid %%a >nul 2>&1
)

:: Kill by window titles to catch hanging terminals
echo [2/3] Fermeture des anciennes fenetres ComfyRealism...
taskkill /f /fi "WINDOWTITLE eq ComfyRealism Backend" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq ComfyRealism Frontend" >nul 2>&1

echo [3/3] Demarrage de ComfyRealism...

:: Start Backend
start "ComfyRealism Backend" cmd /k "cd backend && npm run build && npm run start"

:: Start Frontend
start "ComfyRealism Frontend" cmd /k "cd frontend && npm run dev"

:: Wait for servers to start before opening browser
echo.
echo Attente de l'initialisation des serveurs (5s)...
timeout /t 5 /nobreak >nul

:: Open browser
start http://localhost:5173

echo.
echo Les deux serveurs sont en cours de demarrage :
echo - Backend  : http://localhost:3001
echo - Frontend : http://localhost:5173
echo.
echo Assurez-vous que ComfyUI est lance sur http://127.0.0.1:8188
echo.
pause
