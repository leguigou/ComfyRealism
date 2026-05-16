@echo off
echo Preparing ComfyRealism environment...

:: Kill existing processes on ports 3001 and 5173 (if any)
echo Cleaning up existing processes on ports 3001 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo Starting ComfyRealism...

:: Start Backend
start "ComfyRealism Backend" cmd /k "cd backend && npm run dev"

:: Start Frontend
start "ComfyRealism Frontend" cmd /k "cd frontend && npm run dev"

:: Wait for servers to start before opening browser
echo Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

:: Open browser
start http://localhost:5173

echo.
echo Both servers are starting in separate windows.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Make sure ComfyUI is running on http://127.0.0.1:8188
pause