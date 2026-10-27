@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title DestekOfis Kurulum Dosyasını Birleştir
set "BEKLENEN=c1f9f9bcb38a73d173b01cf13833b586766d5651937e637e8b5ba2df70da8c51"
set "P0=DestekOfis-Kurulum.exe.parca0"
set "P1=DestekOfis-Kurulum.exe.parca1"
set "CIKTI=DestekOfis-Kurulum.exe"
set "OZET=DestekOfis-Kurulum.exe.sha256"

echo DestekOfis 2.4.6 - kurulum dosyası parçalardan birleştiriliyor...
echo.
if not exist "%P0%" (
  echo HATA: "%P0%" bu klasörde bulunamadı. İki parçayı ve bu dosyayı aynı klasöre koyun.
  goto son
)
if not exist "%P1%" (
  echo HATA: "%P1%" bu klasörde bulunamadı. İki parçayı ve bu dosyayı aynı klasöre koyun.
  goto son
)
rem Klasörde .sha256 dosyası varsa onun özeti de bu sürümün özetiyle aynı olmalı.
if exist "%OZET%" (
  set "DOSYADAKI="
  for /f "usebackq tokens=1" %%A in ("%OZET%") do if not defined DOSYADAKI set "DOSYADAKI=%%A"
  if /i not "!DOSYADAKI!"=="%BEKLENEN%" (
    echo HATA: "%OZET%" dosyasındaki özet bu birleştirme dosyasının beklediğiyle aynı değil.
    echo   Dosyadaki: !DOSYADAKI!
    echo   Beklenen : %BEKLENEN%
    echo Dosyalar farklı sürümlerden olabilir; hepsini aynı yerden yeniden indirin.
    goto son
  )
)
if exist "%CIKTI%" del /f /q "%CIKTI%"
copy /b "%P0%"+"%P1%" "%CIKTI%" >nul
if errorlevel 1 (
  echo HATA: Parçalar birleştirilemedi. Klasöre yazma izni ve boş disk alanı olduğundan emin olun.
  goto son
)

echo Birleştirildi: %CIKTI%
echo SHA-256 özeti denetleniyor...
set "GERCEK="
for /f "skip=1 delims=" %%H in ('certutil -hashfile "%CIKTI%" SHA256') do (
  if not defined GERCEK set "GERCEK=%%H"
)
if not defined GERCEK (
  echo HATA: Özet hesaplanamadı ^(certutil çalışmadı^). Dosyayı kullanmadan önce özeti elle denetleyin:
  echo   certutil -hashfile "%CIKTI%" SHA256
  echo Beklenen: %BEKLENEN%
  goto son
)
set "GERCEK=!GERCEK: =!"
echo.
echo Beklenen : %BEKLENEN%
echo Bulunan  : !GERCEK!
echo.
if /i "!GERCEK!"=="%BEKLENEN%" (
  echo TAMAM: Özet eşleşti. "%CIKTI%" GitHub yayınına yüklenebilir.
) else (
  echo HATA: Özet TUTMUYOR. Bu dosyayı KULLANMAYIN; parçaları yeniden indirip tekrar deneyin.
)

:son
echo.
pause
endlocal
