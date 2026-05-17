@echo off
set PATH=C:\Program Files\nodejs;%PATH%
echo ========================================
echo   GianAuth - Backend  ^|  puerto 4000
echo ========================================
cd /d "%~dp0backend"
npm run dev
pause
