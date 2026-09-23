@echo off
setlocal
set "SERVER_URL=%~1"
if "%SERVER_URL%"=="" set /p SERVER_URL=Server adresini girin (ornek http://192.168.1.50:5123): 
if "%SERVER_URL%"=="" exit /b 1
start "Hukuk Ofisi Merkezi" "%SERVER_URL%"
