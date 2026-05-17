@echo off
set PATH=C:\Program Files\nodejs;%PATH%
echo ========================================
echo   GianAuth - Discord Bot
echo ========================================
cd /d "%~dp0discord-bot"
npm start
pause
