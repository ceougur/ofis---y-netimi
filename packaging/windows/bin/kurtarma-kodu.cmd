@echo off
rem DestekOfis - yonetici parolasi kurtarma kodunu (v2.0.10) Windows yoneticisi olarak acar.
rem Kod, bu bilgisayarda giris ekranindaki "Parolami unuttum" > "Sunucu kodu olustur" dugmesiyle uretilir;
rem 10 dakika gecerli ve tek kullanimliktir. Dosyayi yalniz Windows yoneticileri okuyabilir.
setlocal
set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "FILE=%ROOT%\data\YONETICI-KURTARMA-KODU.txt"
if not exist "%FILE%" (
  echo Kurtarma kodu henuz olusturulmadi.
  echo Bu bilgisayarda DestekOfis giris ekraninda "Parolami unuttum" ^> "Sunucu kodu olustur" dugmesine basin,
  echo sonra bu kisayolu yeniden acin. Kod 10 dakika gecerlidir.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath notepad.exe -ArgumentList ('\"' + $env:FILE + '\"') -Verb RunAs"
