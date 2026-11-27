@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title DestekOfis 2.5.0 Arşiv Kaynak Paketini Birleştir
set "BEKLENEN=f6e6a34364d75928cd5286ca1a26531870c1a216c422e5619b5e2d97f5212628"
set "CIKTI=DestekOfis-2.5.0-Arsiv-Kaynak.bundle"

echo DestekOfis 2.5.0 - arşiv kaynak paketi (git bundle) 7 parçadan birleştiriliyor...
echo.
if not exist "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca0" (
  echo HATA: "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca0" bu klasörde bulunamadı. Yedi parçayı ve bu dosyayı aynı klasöre koyun.
  goto son
)
if not exist "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca1" (
  echo HATA: "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca1" bu klasörde bulunamadı. Yedi parçayı ve bu dosyayı aynı klasöre koyun.
  goto son
)
if not exist "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca2" (
  echo HATA: "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca2" bu klasörde bulunamadı. Yedi parçayı ve bu dosyayı aynı klasöre koyun.
  goto son
)
if not exist "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca3" (
  echo HATA: "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca3" bu klasörde bulunamadı. Yedi parçayı ve bu dosyayı aynı klasöre koyun.
  goto son
)
if not exist "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca4" (
  echo HATA: "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca4" bu klasörde bulunamadı. Yedi parçayı ve bu dosyayı aynı klasöre koyun.
  goto son
)
if not exist "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca5" (
  echo HATA: "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca5" bu klasörde bulunamadı. Yedi parçayı ve bu dosyayı aynı klasöre koyun.
  goto son
)
if not exist "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca6" (
  echo HATA: "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca6" bu klasörde bulunamadı. Yedi parçayı ve bu dosyayı aynı klasöre koyun.
  goto son
)
if exist "%CIKTI%" del /f /q "%CIKTI%"
copy /b "DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca0"+"DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca1"+"DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca2"+"DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca3"+"DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca4"+"DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca5"+"DestekOfis-2.5.0-Arsiv-Kaynak.bundle.parca6" "%CIKTI%" >nul
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
  echo TAMAM: Özet eşleşti. "%CIKTI%" arşivde saklanabilir; açmak için: git clone "%CIKTI%" destekofis
) else (
  echo HATA: Özet TUTMUYOR. Bu dosyayı KULLANMAYIN; parçaları yeniden indirip tekrar deneyin.
)

:son
echo.
pause
endlocal
