@echo off
set NODE_PATH=C:\Program Files\nodejs
set PATH=%NODE_PATH%;%PATH%

echo ========================================
echo   GianAuth - Configuracion Inicial
echo ========================================
echo.

echo [1/4] Instalando dependencias del backend...
cd /d "%~dp0backend"
call npm install
if %errorlevel% neq 0 ( echo ERROR en backend && pause && exit /b 1 )

echo.
echo [2/4] Creando base de datos SQLite...
call npx prisma db push
if %errorlevel% neq 0 ( echo ERROR en Prisma && pause && exit /b 1 )

echo.
echo [3/4] Creando usuario admin...
call node src/seed.js

echo.
echo [4/4] Instalando dependencias del frontend...
cd /d "%~dp0frontend"
call npm install
if %errorlevel% neq 0 ( echo ERROR en frontend && pause && exit /b 1 )

echo.
echo ========================================
echo   LISTO
echo ========================================
echo   Usuario: admin
echo   Contrasena: admin123
echo   Ejecuta start-backend.bat y start-frontend.bat
echo ========================================
pause
