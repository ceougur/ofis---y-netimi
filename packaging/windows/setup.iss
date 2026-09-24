; DestekOfis — Windows kurulum betiği (Inno Setup 6)
; Derleme: node tools/build-windows.mjs  (ISCC /DAppVersion=x.y.z /DStageDir=... setup.iss)
;
; Sunucu kurulumu: C:\HukukOfisiMerkezi altına gömülü Node.js çalışma zamanı + uygulama + nssm kurar,
; "DestekOfis" Windows servisini (otomatik başlatma, oturum açılmadan, penceresiz) oluşturur,
; güvenlik duvarına TCP/UDP 5123 izni ekler ve masaüstüne kısayol koyar.
; İstemci kurulumu: yalnızca sunucuyu kendiliğinden bulan başlatıcıyı ve kısayolu kurar.
; Veriler (data, backups) güncelleme ve kaldırma sırasında asla silinmez.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef StageDir
  #define StageDir "..\..\build\windows\stage"
#endif
#define AppName "DestekOfis"
#define AppPublisher "DestekOfis"
#define AppURL "https://destekofis.vercel.app"
#define ServiceName "DestekOfis"
#define AppExe "DestekOfis.exe"

[Setup]
AppId={{6F3C2B1E-8D4A-4E7B-9C5D-2A1B3C4D5E6F}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
AppContact=bilgi.ugurcetin@gmail.com
DefaultDirName=C:\HukukOfisiMerkezi
UsePreviousAppDir=yes
DisableDirPage=auto
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
UsePreviousSetupType=yes
UsePreviousTasks=yes
OutputBaseFilename=DestekOfis-Kurulum-{#AppVersion}
SetupIconFile=branding\destekofis.ico
UninstallDisplayIcon={app}\launcher\{#AppExe}
UninstallDisplayName={#AppName}
WizardStyle=modern
WizardSizePercent=110
WizardImageFile=branding\wizard-large.bmp,branding\wizard-large-2x.bmp
WizardSmallImageFile=branding\wizard-small.bmp,branding\wizard-small-2x.bmp
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
MinVersion=10.0.17763
CloseApplications=no
RestartApplications=no
SetupLogging=yes
ShowLanguageDialog=no
VersionInfoVersion={#AppVersion}.0
VersionInfoProductName={#AppName}
VersionInfoDescription={#AppName} Kurulum
VersionInfoCompany={#AppPublisher}
VersionInfoCopyright=© 2026 {#AppPublisher}

[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"

[Messages]
turkish.WelcomeLabel2=Bu sihirbaz [name/ver] uygulamasını bilgisayarınıza kuracak.%n%nOfisteki verilerin tutulacağı bilgisayarda "Sunucu", diğer personel bilgisayarlarında "Personel bilgisayarı" kurulumunu seçin.%n%nDevam etmeden önce diğer uygulamaları kapatmanız önerilir.

[Types]
Name: "sunucu"; Description: "Sunucu bilgisayar (ofisin verileri bu bilgisayarda tutulur)"
Name: "istemci"; Description: "Personel bilgisayarı (sunucuya bağlanır)"

[Components]
Name: "sunucu"; Description: "DestekOfis sunucusu ve Windows servisi"; Types: sunucu; Flags: fixed
Name: "istemci"; Description: "DestekOfis başlatıcısı (sunucuyu kendiliğinden bulur)"; Types: sunucu istemci; Flags: fixed

[Tasks]
Name: "masaustu"; Description: "Masaüstüne DestekOfis kısayolu oluştur"; GroupDescription: "Kısayollar:"
Name: "agprofili"; Description: "Ağ profili 'Ortak' ise 'Özel' yap (diğer bilgisayarların bağlanabilmesi için önerilir)"; GroupDescription: "Ağ:"; Components: sunucu

[Dirs]
Name: "{app}\data"; Components: sunucu; Flags: uninsneveruninstall
Name: "{app}\backups"; Components: sunucu; Flags: uninsneveruninstall
Name: "{app}\logs"; Components: sunucu; Flags: uninsneveruninstall
Name: "{app}\config"; Components: sunucu; Flags: uninsneveruninstall

[Files]
Source: "{#StageDir}\launcher\{#AppExe}"; DestDir: "{app}\launcher"; Components: istemci; Flags: ignoreversion
Source: "{#StageDir}\runtime\*"; DestDir: "{app}\runtime"; Components: sunucu; Flags: ignoreversion recursesubdirs
Source: "{#StageDir}\app\*"; DestDir: "{app}\app"; Components: sunucu; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\bootstrap.mjs"; DestDir: "{app}"; Components: sunucu; Flags: ignoreversion
Source: "{#StageDir}\bin\*"; DestDir: "{app}\bin"; Components: sunucu; Flags: ignoreversion
Source: "{#StageDir}\docs\*"; DestDir: "{app}\belgeler"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{autodesktop}\DestekOfis"; Filename: "{app}\launcher\{#AppExe}"; Tasks: masaustu; Comment: "DestekOfis'i aç"
Name: "{group}\DestekOfis"; Filename: "{app}\launcher\{#AppExe}"; Comment: "DestekOfis'i aç"
Name: "{group}\Yedek al"; Filename: "{app}\bin\yedek-al.cmd"; Components: sunucu
Name: "{group}\Kullanım kılavuzu"; Filename: "{app}\belgeler\KURULUM-VE-KULLANIM.html"
Name: "{group}\DestekOfis'i kaldır"; Filename: "{uninstallexe}"

[INI]
Filename: "{group}\DestekOfis yönetim paneli.url"; Section: "InternetShortcut"; Key: "URL"; String: "http://127.0.0.1:5123/admin.html"; Components: sunucu

[Run]
Filename: "{app}\launcher\{#AppExe}"; Description: "DestekOfis'i şimdi aç"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{cmd}"; Parameters: "/C ""{app}\bin\servis-kaldir.cmd"""; Flags: runhidden waituntilterminated; RunOnceId: "DestekOfisServisKaldir"; Components: sunucu

[UninstallDelete]
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\runtime"
Type: filesandordirs; Name: "{app}\bin"
Type: filesandordirs; Name: "{app}\launcher"
Type: filesandordirs; Name: "{app}\belgeler"
Type: files; Name: "{app}\bootstrap.mjs"
Type: files; Name: "{group}\DestekOfis yönetim paneli.url"

[Code]
var
  ServiceFailed: Boolean;

function IsServer: Boolean;
begin
  Result := WizardIsComponentSelected('sunucu');
end;

// Güncelleme kurulumunda dosyalar kilitli kalmasın diye çalışan servis önce durdurulur.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Nssm: String;
  ResultCode: Integer;
begin
  Result := '';
  Nssm := ExpandConstant('{app}\runtime\nssm.exe');
  if FileExists(Nssm) then
    Exec(Nssm, 'stop {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure SetNetworkPrivate;
var
  ResultCode: Integer;
begin
  Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "Get-NetConnectionProfile | Where-Object NetworkCategory -eq ''Public'' | Set-NetConnectionProfile -NetworkCategory Private"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure InstallService;
var
  ResultCode: Integer;
begin
  WizardForm.StatusLabel.Caption := 'Windows servisi kuruluyor ve başlatılıyor (en fazla 1-2 dakika)...';
  WizardForm.ProgressGauge.Style := npbstMarquee;
  try
    if not Exec(ExpandConstant('{cmd}'), '/C ""' + ExpandConstant('{app}\bin\servis-kur.cmd') + '" {#AppVersion}"', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      ResultCode := -1;
  finally
    WizardForm.ProgressGauge.Style := npbstNormal;
  end;
  if ResultCode <> 0 then
  begin
    ServiceFailed := True;
    Log('servis-kur.cmd çıkış kodu: ' + IntToStr(ResultCode));
    if not WizardSilent then
      MsgBox('DestekOfis servisi kuruldu ancak başlatılamadı (kod ' + IntToStr(ResultCode) + ').' + #13#10#13#10 +
        'Ayrıntılar: ' + ExpandConstant('{app}\logs\kurulum.log') + #13#10 +
        'Bilgisayarı yeniden başlatmayı deneyin; sorun sürerse bu dosyayla destek isteyin.', mbError, MB_OK);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and IsServer then
  begin
    if WizardIsTaskSelected('agprofili') then
      SetNetworkPrivate;
    InstallService;
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    if IsServer and not ServiceFailed then
      WizardForm.FinishedLabel.Caption :=
        'DestekOfis sunucusu kuruldu ve Windows servisi olarak çalışıyor. Bilgisayar her açıldığında oturum açılmasa bile kendiliğinden başlar.' + #13#10#13#10 +
        'İlk giriş (bu bilgisayardan): kullanıcı adı "admin", parola "Ofis2026!". İlk girişte yeni parola belirlemeniz istenir.' + #13#10#13#10 +
        'Personel bilgisayarlarına aynı kurulum dosyasıyla "Personel bilgisayarı" kurulumu yapın; sunucu kendiliğinden bulunur.'
    else if not IsServer then
      WizardForm.FinishedLabel.Caption :=
        'DestekOfis başlatıcısı kuruldu. Masaüstündeki DestekOfis kısayolu ofis sunucusunu ağda kendiliğinden bulur ve açar.';
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and DirExists(ExpandConstant('{app}\data')) and not UninstallSilent then
    MsgBox('DestekOfis kaldırıldı.' + #13#10#13#10 + 'Verileriniz ve yedekleriniz korunmuştur:' + #13#10 + ExpandConstant('{app}\data') + #13#10 + ExpandConstant('{app}\backups') + #13#10#13#10 +
      'Yeniden kurduğunuzda kaldığınız yerden devam edebilirsiniz.', mbInformation, MB_OK);
end;
