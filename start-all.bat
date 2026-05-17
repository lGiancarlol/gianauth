@echo off
setlocal

set "ROOT=%~dp0"
set "NODE_PATH=C:\Program Files\nodejs"

echo ========================================
echo   GianAuth - Arrancando todo...
echo ========================================
echo.

:: Backend
start "GianAuth Backend" cmd /k "set PATH=%NODE_PATH%;%PATH% && cd /d "%ROOT%backend" && set NODE_ENV=development && npm run dev"

echo   [1/3] Backend arrancando...
timeout /t 5 /nobreak >nul

:: Frontend
start "GianAuth Frontend" cmd /k "set PATH=%NODE_PATH%;%PATH% && cd /d "%ROOT%frontend" && set NODE_ENV=development && npm run dev"

echo   [2/3] Frontend arrancando...
timeout /t 3 /nobreak >nul

:: Bot
start "GianAuth Bot" cmd /k "set PATH=%NODE_PATH%;%PATH% && cd /d "%ROOT%discord-bot" && set NODE_ENV=development && npm start"

echo   [3/3] Bot arrancando...
echo.
echo ========================================
echo   Backend   ->  http://localhost:4000
echo   Frontend  ->  http://localhost:3000
echo   Bot       ->  corriendo en Discord
echo ========================================
echo.
echo   Usa stop-all.bat para detener todo.
echo.

endlocal
