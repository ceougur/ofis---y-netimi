@echo off
rem DestekOfis - elle veritabani yedegi alir (sunucu calisirken de guvenlidir). Yonetici olarak calistirin.
setlocal
set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
"%ROOT%\runtime\node.exe" --disable-warning=ExperimentalWarning "%ROOT%\bootstrap.mjs" yedek
if errorlevel 2 (echo Ilk sirketin yedegi alindi; bazi sirketlerin yedegi alinamadi - yukaridaki satirlara bakin. & echo Yedekler: %ROOT%\backups & pause & exit /b 2)
if errorlevel 1 (echo Yedek alinamadi. & pause & exit /b 1)
echo Yedek alindi: %ROOT%\backups
pause
