@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo  KLYAKSA: startup frontend + backend
echo ==========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Install Node.js first.
  pause
  exit /b 1
)

echo Starting project...
echo.
echo Stopping Node.js processes so better-sqlite3 can be rebuilt ^(unlocks .node file^).
echo If you have other Node apps running, save work and close them first.
echo.
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Rebuilding native backend modules for current Node.js...
call npm rebuild better-sqlite3 --prefix backend
if errorlevel 1 (
  echo.
  echo [ERROR] Failed to rebuild better-sqlite3.
  echo.
  echo Try this:
  echo   1. Close this window, Cursor/VS Code terminals, and any "npm run dev" windows.
  echo   2. Open Task Manager ^(Ctrl+Shift+Esc^) - end all "Node.js" tasks.
  echo   3. Pause OneDrive/antivirus scan on this folder if the folder is synced.
  echo   4. Run this script again ^(Run as administrator only if still EPERM^).
  echo.
  pause
  exit /b 1
)

echo.
echo After startup open: http://localhost:5173
echo To stop server: press Ctrl+C in this window.
echo.

call npm run dev

echo.
echo Process stopped.
pause
