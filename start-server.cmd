@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title DestekOfis Merkezi Sunucu
if "%PORT%"=="" set PORT=5123
if "%HOST%"=="" set HOST=0.0.0.0
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 veya daha yeni bir surum bulunamadi.
  echo Kullanim kilavuzundaki Node.js kurulum adimini uygulayin.
  pause
  exit /b 1
)
echo DestekOfis baslatiliyor... Tarayicidan http://127.0.0.1:%PORT% adresini acin.
node --disable-warning=ExperimentalWarning server\server.mjs
pause
