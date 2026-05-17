@echo off
echo ========================================
echo   GianAuth - Deteniendo todo...
echo ========================================
echo.

:: Cerrar ventanas por titulo
taskkill /FI "WINDOWTITLE eq GianAuth Backend"  /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq GianAuth Frontend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq GianAuth Bot"      /F >nul 2>&1

:: Matar procesos node.js en los puertos usados por el proyecto
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo   Backend   -> detenido
echo   Frontend  -> detenido
echo   Bot       -> detenido
echo.
echo ========================================
echo   Todos los procesos fueron terminados.
echo ========================================
echo.
pause
