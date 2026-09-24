@echo off
rem DestekOfis - Windows servisini kurar/gunceller ve baslatir (kurulum programi tarafindan calistirilir).
rem Elle calistirmak icin: yonetici komut isteminde  C:\HukukOfisiMerkezi\bin\servis-kur.cmd
setlocal EnableExtensions
set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "NSSM=%ROOT%\runtime\nssm.exe"
set "NODE=%ROOT%\runtime\node.exe"
set "SVC=DestekOfis"
set "ACCOUNT=NT SERVICE\DestekOfis"
set "LOG=%ROOT%\logs\kurulum.log"
if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"
call :main >> "%LOG%" 2>&1
exit /b %ERRORLEVEL%

:main
echo ==== %DATE% %TIME% DestekOfis servis kurulumu ====
if not exist "%NSSM%" (echo nssm bulunamadi: %NSSM% & exit /b 2)
if not exist "%NODE%" (echo node bulunamadi: %NODE% & exit /b 3)

rem 1) Eski kurulumlarin izlerini temizle (v1.0 zamanlanmis gorev, portu tutan eski surec).
schtasks /Delete /TN "Hukuk Ofisi Merkezi Server" /F >nul 2>&1
"%NSSM%" stop %SVC% >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 5123 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

rem 2) Servisi kur veya guncelle.
"%NSSM%" status %SVC% >nul 2>&1
if errorlevel 1 (
  "%NSSM%" install %SVC% "%NODE%" || exit /b 10
)
"%NSSM%" set %SVC% Application "%NODE%"
"%NSSM%" set %SVC% AppParameters "--disable-warning=ExperimentalWarning ""%ROOT%\bootstrap.mjs"""
"%NSSM%" set %SVC% AppDirectory "%ROOT%"
"%NSSM%" set %SVC% DisplayName "DestekOfis Sunucu"
"%NSSM%" set %SVC% Description "DestekOfis hukuk ofisi merkezi sunucusu (HTTP ve UDP 5123). Bilgisayar acildiginda oturum acilmadan calisir."
"%NSSM%" set %SVC% Start SERVICE_AUTO_START
"%NSSM%" set %SVC% ObjectName "%ACCOUNT%"
rem --use-system-ca: Windows sertifika deposuna da guvenilir (SSL denetimi yapan antivirus/guvenlik duvari olan aglarda
rem Google Sheets ve guncelleme baglantilari icin gerekli).
"%NSSM%" set %SVC% AppEnvironmentExtra "HUKUK_INSTALL_ROOT=%ROOT%" "NODE_ENV=production" "NODE_OPTIONS=--use-system-ca"
"%NSSM%" set %SVC% AppStdout "%ROOT%\logs\servis.log"
"%NSSM%" set %SVC% AppStderr "%ROOT%\logs\servis.log"
"%NSSM%" set %SVC% AppRotateFiles 1
"%NSSM%" set %SVC% AppRotateOnline 0
"%NSSM%" set %SVC% AppRotateBytes 1048576
"%NSSM%" set %SVC% AppExit Default Restart
"%NSSM%" set %SVC% AppRestartDelay 3000
"%NSSM%" set %SVC% AppThrottle 15000
"%NSSM%" set %SVC% AppStopMethodConsole 10000
"%NSSM%" set %SVC% AppStopMethodWindow 5000
"%NSSM%" set %SVC% AppKillProcessTree 1

rem 3) Dosya izinleri: program klasoru yalnizca yoneticiler tarafindan degistirilebilir; veri klasorlerine
rem    yalnizca SYSTEM, Yoneticiler ve servis hesabi erisir (SID'ler Turkce Windows'ta da gecerlidir).
for %%D in (data backups logs config app) do (
  if not exist "%ROOT%\%%D" mkdir "%ROOT%\%%D"
)
icacls "%ROOT%" /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-32-545:(OI)(CI)RX" "%ACCOUNT%:(OI)(CI)RX" /Q >nul || exit /b 20
icacls "%ROOT%\*" /reset /T /C /Q >nul
for %%D in (data backups logs config) do (
  icacls "%ROOT%\%%D" /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "%ACCOUNT%:(OI)(CI)M" /T /Q >nul || exit /b 21
)
icacls "%ROOT%\app" /grant "%ACCOUNT%:(OI)(CI)M" /T /Q >nul || exit /b 22

rem 4) Guvenlik duvari: yalnizca Ozel ve Etki alani aglarinda, yalnizca DestekOfis calisma zamanina izin.
netsh advfirewall firewall delete rule name="DestekOfis HTTP (TCP 5123)" >nul 2>&1
netsh advfirewall firewall delete rule name="DestekOfis Kesif (UDP 5123)" >nul 2>&1
netsh advfirewall firewall delete rule name="Hukuk Ofisi Merkezi" >nul 2>&1
netsh advfirewall firewall add rule name="DestekOfis HTTP (TCP 5123)" dir=in action=allow protocol=TCP localport=5123 profile=private,domain program="%NODE%" enable=yes || exit /b 30
netsh advfirewall firewall add rule name="DestekOfis Kesif (UDP 5123)" dir=in action=allow protocol=UDP localport=5123 profile=private,domain program="%NODE%" enable=yes || exit /b 31

rem 5) Baslat ve saglik kontrolu (en fazla 120 sn). Servis ilk acilista guncelleme indiriyorsa bakim yaniti (503)
rem    verir; bu da servisin calistigini gosterir. Yalnizca "baslatilamadi" durumu hata sayilir.
"%NSSM%" start %SVC% || exit /b 40
powershell -NoProfile -ExecutionPolicy Bypass -Command "$last=''; $sw=[Diagnostics.Stopwatch]::StartNew(); while ($sw.Elapsed.TotalSeconds -lt 120) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5123/api/health' -TimeoutSec 3; if ($r.StatusCode -eq 200) { Write-Output 'Saglik kontrolu basarili'; exit 0 } } catch { $resp = $_.Exception.Response; if ($resp -and [int]$resp.StatusCode -eq 503) { $body = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd(); if ($body -match 'failed') { $last='hata' } else { $last='bakim' } } }; Start-Sleep -Seconds 1 }; if ($last -eq 'bakim') { Write-Output 'Servis calisiyor; acilis veya guncelleme suruyor.'; exit 0 }; exit 1"
if errorlevel 1 (echo Servis 120 sn icinde hazir olmadi. & "%NSSM%" status %SVC% & exit /b 50)
echo Kurulum tamamlandi.
exit /b 0
