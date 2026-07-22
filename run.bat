@echo off
setlocal EnableExtensions
title ComfyRealism Starter
cd /d "%~dp0"

if /I "%~1"=="--cleanup-only" goto cleanup_only

echo =========================================================
echo   ComfyRealism - Nettoyage et Lancement
echo =========================================================
echo.
echo [1/3] Liberation des ports 3001 et 5173...

:: Le nettoyage est execute dans un processus admin distinct. Le backend et
:: le frontend restent ensuite lances normalement par cette fenetre.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$process = Start-Process -FilePath '%~f0' -ArgumentList '--cleanup-only' -Verb RunAs -Wait -PassThru; exit $process.ExitCode"

if errorlevel 1 (
  echo.
  echo [ERREUR] Impossible de liberer les ports 3001 et 5173.
  echo Verifiez la demande d'autorisation Windows puis relancez run.bat.
  pause
  exit /b 1
)

echo [2/3] Ports liberes.
echo [3/3] Demarrage de ComfyRealism...

start "ComfyRealism Backend" cmd /k "cd /d ""%~dp0backend"" && npm run build && npm run start"

echo.
echo Attente du backend...
call :wait_for_port 3001 60
if errorlevel 1 (
  echo [ERREUR] Le backend n'a pas demarre sur le port 3001.
  echo Consultez la fenetre "ComfyRealism Backend" pour voir l'erreur.
  pause
  exit /b 1
)

start "ComfyRealism Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo Attente du frontend...
call :wait_for_port 5173 60
if errorlevel 1 (
  echo [ERREUR] Le frontend n'a pas demarre sur le port 5173.
  echo Consultez la fenetre "ComfyRealism Frontend" pour voir l'erreur.
  pause
  exit /b 1
)

echo Backend et frontend prets.

start "" http://localhost:5173

echo.
echo Les deux serveurs sont en cours de demarrage :
echo - Backend  : http://localhost:3001
echo - Frontend : http://localhost:5173
echo.
echo Assurez-vous que ComfyUI est lance sur http://127.0.0.1:8188
echo.
pause
exit /b 0

:cleanup_only
title ComfyRealism Cleanup
echo Nettoyage des anciens processus ComfyRealism...

call :kill_port 3001 Backend
if errorlevel 1 exit /b 1

call :kill_port 5173 Frontend
if errorlevel 1 exit /b 1

taskkill /f /t /fi "WINDOWTITLE eq ComfyRealism Backend" >nul 2>&1
taskkill /f /t /fi "WINDOWTITLE eq ComfyRealism Frontend" >nul 2>&1
exit /b 0

:kill_port
set "TARGET_PORT=%~1"
set "TARGET_NAME=%~2"
for /f "tokens=5" %%P in ('netstat -aon ^| findstr ":%TARGET_PORT%" ^| findstr "LISTENING"') do (
  echo - Arret de %TARGET_NAME% sur le port %TARGET_PORT% ^(PID %%P^)
  taskkill /f /t /pid %%P
)

timeout /t 1 /nobreak >nul
netstat -aon | findstr ":%TARGET_PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo [ERREUR] Le port %TARGET_PORT% est toujours occupe.
  exit /b 1
)
exit /b 0

:wait_for_port
set "WAIT_PORT=%~1"
set "WAIT_SECONDS=%~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds(%WAIT_SECONDS%); while ((Get-Date) -lt $deadline) { if (Get-NetTCPConnection -State Listen -LocalPort %WAIT_PORT% -ErrorAction SilentlyContinue) { exit 0 }; Start-Sleep -Milliseconds 500 }; exit 1"
exit /b %errorlevel%
