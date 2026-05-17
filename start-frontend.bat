@echo off
set PATH=C:\Program Files\nodejs;%PATH%
echo ========================================
echo   GianAuth - Frontend  ^|  puerto 3000
echo ========================================
cd /d "%~dp0frontend"
npm run dev
pause
