@echo off
setlocal
cd /d "%~dp0"
if "%PORT%"=="" set PORT=5123
if "%HOST%"=="" set HOST=0.0.0.0
if "%HUKUK_ADMIN_USERNAME%"=="" set HUKUK_ADMIN_USERNAME=admin
if "%HUKUK_ADMIN_PASSWORD%"=="" set HUKUK_ADMIN_PASSWORD=Ofis2026!
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 veya daha yeni bir surum bulunamadi.
  echo Kullanim kilavuzundaki Node.js kurulum adimini uygulayin.
  pause
  exit /b 1
)
node server\server.mjs
pause
