@echo off
title Notification System - Backend + Frontend
setlocal

:: ============================================
:: EDIT THESE if your ports/commands differ
set BACKEND_CMD=npm start
set FRONTEND_CMD=npm run dev
set FRONTEND_URL=http://localhost:5173
:: ============================================

cd /d "%~dp0"

if not exist "backend\node_modules" (
    echo ============================================
    echo Installing backend dependencies...
    echo ============================================
    call npm install --prefix backend
    if errorlevel 1 (
        echo Backend npm install failed. Aborting.
        pause
        exit /b 1
    )
) else (
    echo Backend dependencies already installed. Skipping.
)

if not exist "frontend\node_modules" (
    echo ============================================
    echo Installing frontend dependencies...
    echo ============================================
    call npm install --prefix frontend
    if errorlevel 1 (
        echo Frontend npm install failed. Aborting.
        pause
        exit /b 1
    )
) else (
    echo Frontend dependencies already installed. Skipping.
)

echo ============================================
echo Starting backend...
echo ============================================
start "Backend" /B cmd /c "cd backend && %BACKEND_CMD%"

echo ============================================
echo Starting frontend...
echo ============================================
start "Frontend" /B cmd /c "cd frontend && %FRONTEND_CMD%"

echo.
echo Waiting for servers to boot...
timeout /t 6 /nobreak >nul

echo Opening browser at %FRONTEND_URL% ...
start "" "%FRONTEND_URL%"

echo.
echo ============================================
echo  Both servers are running in this window.
echo  Closing this window will stop both.
echo  Press any key to shut everything down.
echo ============================================
pause >nul

echo Stopping servers...
taskkill /F /FI "WINDOWTITLE eq Backend*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Frontend*" /T >nul 2>&1
:: Fallback: kill any leftover node processes started by this script
:: (uncomment if you want a harder cleanup)
:: taskkill /F /IM node.exe /T >nul 2>&1

endlocal