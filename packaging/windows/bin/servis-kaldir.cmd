@echo off
rem DestekOfis - Windows servisini ve guvenlik duvari kurallarini kaldirir. Veriler (data, backups) silinmez.
setlocal EnableExtensions
set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "NSSM=%ROOT%\runtime\nssm.exe"
set "SVC=DestekOfis"
if exist "%NSSM%" (
  "%NSSM%" stop %SVC% >nul 2>&1
  "%NSSM%" remove %SVC% confirm >nul 2>&1
) else (
  sc stop %SVC% >nul 2>&1
  sc delete %SVC% >nul 2>&1
)
netsh advfirewall firewall delete rule name="DestekOfis HTTP (TCP 5123)" >nul 2>&1
netsh advfirewall firewall delete rule name="DestekOfis Kesif (UDP 5123)" >nul 2>&1
exit /b 0
