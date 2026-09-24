; DestekOfis — Windows kurulum betiği (Inno Setup 6)
; Derleme: node tools/build-windows.mjs  (ISCC /DAppVersion=x.y.z /DStageDir=... setup.iss)
;
; Sunucu kurulumu: C:\DestekOfis altına (1.6.0 öncesi kurulumlar kendi klasöründe, ör. C:\HukukOfisiMerkezi, kalır)
; gömülü Node.js çalışma zamanı + uygulama + nssm kurar,
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
; Yeni kurulumlar sektörden bağımsız klasöre; mevcut kurulumlar (aynı AppId) önceki klasörlerinde güncellenir.
; Önceki kayıt yoksa (kaldırılıp yeniden kurulan sunucu, eski elle kurulum) verisi olan klasör seçilir: DefaultAppDir.
DefaultDirName={code:DefaultAppDir}
UsePreviousAppDir=yes
; Klasör kaldırmadan sonra da (veriler korunduğu için) kalır; "klasör zaten var" sorusu gereksiz kafa karıştırır.
DirExistsWarning=no
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
; Sihirbazın ağda çalışan bir DestekOfis sunucusu olup olmadığını anlaması için geçici klasöre çıkarılır (kurulmaz).
Source: "{#StageDir}\launcher\{#AppExe}"; DestDir: "{tmp}"; DestName: "DestekOfisKesif.exe"; Flags: dontcopy
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
  NetworkChecked: Boolean;
  NetworkServers: String; // Ağda bulunan sunucular, ör. "HUKUK10 (192.168.10.198)"; boşsa bulunamadı.
  NetworkNote: TNewStaticText;
  OldTypesChange: TNotifyEvent;

function IsServer: Boolean;
begin
  Result := WizardIsComponentSelected('sunucu');
end;

// Varsayılan kurulum klasörü. Kaldırma verileri (data, backups) silmez ve Windows'taki önceki kurulum kaydını siler;
// böyle bir sunucu yeniden kurulurken ya da eski elle kurulumdan (v1.0/v1.1) geçilirken verinin olduğu klasör
// seçilmezse sunucu boş bir veritabanıyla açılırdı. Sıra: yeni klasörde veri varsa o, yoksa 1.6.0 öncesi klasörde
// veri varsa o, hiçbiri yoksa yeni klasör.
function DefaultAppDir(Param: String): String;
begin
  if DirExists('C:\DestekOfis\data') then
    Result := 'C:\DestekOfis'
  else if DirExists('C:\HukukOfisiMerkezi\data') then
    Result := 'C:\HukukOfisiMerkezi'
  else
    Result := 'C:\DestekOfis';
end;

// Bu bilgisayarda kurulu bir DestekOfis sunucusu (Windows servisi) var mı? Varsa bu bir güncelleme kurulumudur.
// Yalnızca servise bakılır: kaldırılmış bir sunucudan kalan "data" klasörü, bilgisayarı sunucu saymaya yetmez
// (yanlışlıkla sunucu kurulup kaldırılan personel bilgisayarı yeniden kurulurken ağ taraması yine yapılır).
function ExistingServerInstall: Boolean;
begin
  Result := RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\{#ServiceName}');
end;

// Başlatıcının keşif çıktısındaki bir sonraki  "anahtar": "değer"  alanını okur ve metni ilerletir.
function NextJsonValue(var Rest: String; const Key: String): String;
var
  Tag: String;
  P: Integer;
begin
  Result := '';
  Tag := '"' + Key + '": "';
  P := Pos(Tag, Rest);
  if P = 0 then
  begin
    Rest := '';
    Exit;
  end;
  Rest := Copy(Rest, P + Length(Tag), MaxInt);
  P := Pos('"', Rest);
  if P = 0 then
  begin
    Rest := '';
    Exit;
  end;
  Result := Copy(Rest, 1, P - 1);
  Rest := Copy(Rest, P + 1, MaxInt);
end;

function DescribeServers(const Json: String): String;
var
  Rest, Host, From: String;
begin
  Result := '';
  Rest := Json;
  while Pos('"host": "', Rest) > 0 do
  begin
    Host := NextJsonValue(Rest, 'host');
    From := NextJsonValue(Rest, 'from');
    if Host = '' then
      Host := From;
    if Host <> '' then
    begin
      if Result <> '' then
        Result := Result + ', ';
      Result := Result + Host;
      if (From <> '') and (From <> Host) then
        Result := Result + ' (' + From + ')';
    end;
  end;
end;

// Ağda çalışan DestekOfis sunucularını başlatıcının UDP keşfiyle arar (yaklaşık 2 saniye).
procedure CheckNetworkForServers;
var
  Launcher, OutFile: String;
  Json: AnsiString;
  ResultCode: Integer;
begin
  NetworkChecked := True;
  NetworkServers := '';
  if ExistingServerInstall then
    Exit;
  try
    ExtractTemporaryFile('DestekOfisKesif.exe');
    Launcher := ExpandConstant('{tmp}\DestekOfisKesif.exe');
    OutFile := ExpandConstant('{tmp}\kesif.json');
    if Exec(Launcher, '-kesfet-dosya "' + OutFile + '"', ExpandConstant('{tmp}'), SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) and LoadStringFromFile(OutFile, Json) then
      NetworkServers := DescribeServers(String(Json))
    else
      Log('Ağ taraması sonuç vermedi (çıkış kodu ' + IntToStr(ResultCode) + ').');
  except
    Log('Ağ taraması yapılamadı: ' + GetExceptionMessage);
  end;
  Log('Ağdaki DestekOfis sunucuları: ' + NetworkServers);
end;

// Kurulum türü sayfasındaki not, ağ taramasının sonucunu ve seçilen türün ne anlama geldiğini söyler.
procedure UpdateNetworkNote;
begin
  if not NetworkChecked then
    NetworkNote.Caption := ''
  else if ExistingServerInstall then
    NetworkNote.Caption := 'Bu bilgisayardaki DestekOfis sunucusu güncellenecek; verileriniz ve yedekleriniz korunur.'
  else if (NetworkServers <> '') and IsServer then
    NetworkNote.Caption := 'Dikkat: ağda zaten çalışan bir DestekOfis sunucusu var: ' + NetworkServers + '. Bu bilgisayar da sunucu yapılırsa ayrı ve boş bir veritabanıyla çalışır. Personel bilgisayarları için "Personel bilgisayarı"nı seçin.'
  else if NetworkServers <> '' then
    NetworkNote.Caption := 'Ağda DestekOfis sunucusu bulundu: ' + NetworkServers + '. Bu bilgisayar ona bağlanacak.'
  else if IsServer then
    NetworkNote.Caption := 'Ağda çalışan bir DestekOfis sunucusu bulunamadı; bu bilgisayar ofisin sunucusu olacak. Sunucu başka bir bilgisayarda zaten kuruluysa onun açık ve aynı ağda olduğundan emin olup "Personel bilgisayarı"nı seçin.'
  else
    NetworkNote.Caption := 'Ağda çalışan bir DestekOfis sunucusu şu an bulunamadı. Sorun değil: masaüstündeki DestekOfis simgesi, sunucu açıldığında onu kendiliğinden bulur.';
end;

procedure TypesComboChange(Sender: TObject);
begin
  OldTypesChange(Sender);
  UpdateNetworkNote;
end;

procedure InitializeWizard;
begin
  // Kurulum türü sayfasına ağ taramasının sonucunu yazan not.
  NetworkNote := TNewStaticText.Create(WizardForm);
  NetworkNote.Parent := WizardForm.SelectComponentsPage;
  NetworkNote.AutoSize := False;
  NetworkNote.WordWrap := True;
  NetworkNote.Left := WizardForm.TypesCombo.Left;
  NetworkNote.Width := WizardForm.TypesCombo.Width;
  NetworkNote.Height := ScaleY(64);
  NetworkNote.Font.Style := [fsBold];
  NetworkNote.Caption := '';
  OldTypesChange := WizardForm.TypesCombo.OnChange;
  WizardForm.TypesCombo.OnChange := @TypesComboChange;
end;

// Ağda zaten bir sunucu varsa, yanlışlıkla ikinci bir sunucu kurulmasın diye "Personel bilgisayarı" önceden seçilir.
procedure PrepareSetupTypePage;
begin
  // Bileşen listesi yalnızca özel kurulum türünde görünür; görünmüyorsa not doğrudan tür seçiminin altına yerleşir.
  if WizardForm.ComponentsList.Visible then
  begin
    WizardForm.ComponentsList.Height := WizardForm.ComponentsList.Height - NetworkNote.Height - ScaleY(6);
    NetworkNote.Top := WizardForm.ComponentsList.Top + WizardForm.ComponentsList.Height + ScaleY(6);
  end
  else
    NetworkNote.Top := WizardForm.TypesCombo.Top + WizardForm.TypesCombo.Height + ScaleY(18);
  CheckNetworkForServers;
  if (NetworkServers <> '') and (WizardForm.TypesCombo.ItemIndex = 0) then
  begin
    WizardForm.TypesCombo.ItemIndex := 1;
    TypesComboChange(WizardForm.TypesCombo);
  end
  else
    UpdateNetworkNote;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = wpSelectComponents) and IsServer and (NetworkServers <> '') and not WizardSilent then
    Result := MsgBox('Ağda zaten çalışan bir DestekOfis sunucusu var: ' + NetworkServers + '.' + #13#10#13#10 +
      'Bir ofiste tek sunucu olmalıdır; diğer bilgisayarlara "Personel bilgisayarı" kurulur. İkinci bir sunucu ayrı ve boş bir veritabanıyla çalışır; bu bilgisayardaki DestekOfis simgesi ofisin asıl verilerini değil bu boş sunucuyu açar.' + #13#10#13#10 +
      'Yine de bu bilgisayarı ikinci bir sunucu olarak kurmak istiyor musunuz?', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
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

// Günlük dosyasının son satırları (hata penceresinde nedenini göstermek için).
function LogTail(const FileName: String; Count: Integer): String;
var
  Lines: TArrayOfString;
  I, First: Integer;
begin
  Result := '';
  if not LoadStringsFromFile(FileName, Lines) then
    Exit;
  First := GetArrayLength(Lines) - Count;
  if First < 0 then
    First := 0;
  for I := First to GetArrayLength(Lines) - 1 do
    if Trim(Lines[I]) <> '' then
      Result := Result + Trim(Lines[I]) + #13#10;
end;

// servis-kur.cmd çıkış kodlarının anlaşılır karşılıkları.
function ServiceErrorText(Code: Integer): String;
begin
  case Code of
    2: Result := 'Servis yöneticisi (nssm.exe) bulunamadı. Bir antivirüs programı dosyayı karantinaya almış olabilir.';
    3: Result := 'Node.js çalışma zamanı (node.exe) bulunamadı. Bir antivirüs programı dosyayı karantinaya almış olabilir.';
    5: Result := 'Kurulan uygulama sürümü etkinleştirilemedi.';
    10: Result := 'Windows servisi oluşturulamadı. Bir güvenlik yazılımı servis oluşturmayı engelliyor olabilir.';
    20, 21, 22: Result := 'Program klasörünün izinleri ayarlanamadı.';
    40: Result := 'Windows servisi başlatılamadı. Bir antivirüs programı nssm.exe veya node.exe dosyasını engelliyor olabilir.';
    50: Result := 'Servis 2 dakika içinde hazır olmadı. Aşağıdaki son kayıtlar nedenini gösterir; bir antivirüs programı node.exe veya nssm.exe dosyasını engelliyor olabilir.';
  else
    Result := 'Servis kurulumu tamamlanamadı.';
  end;
end;

procedure InstallService;
var
  ResultCode: Integer;
  LogFile: String;
begin
  WizardForm.StatusLabel.Caption := 'Windows servisi kuruluyor ve başlatılıyor (en fazla 1-2 dakika)...';
  WizardForm.ProgressGauge.Style := npbstMarquee;
  try
    if not Exec(ExpandConstant('{cmd}'), '/C ""' + ExpandConstant('{app}\bin\servis-kur.cmd') + '" {#AppVersion}"', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      ResultCode := -1;
  finally
    WizardForm.ProgressGauge.Style := npbstNormal;
  end;
  LogFile := ExpandConstant('{app}\logs\kurulum.log');
  if ResultCode = 60 then
  begin
    // Servis çalışıyor; yalnızca güvenlik duvarı kuralı eklenemedi.
    Log('SERVIS-GUVENLIK-DUVARI-UYARISI: servis-kur.cmd güvenlik duvarı kuralı ekleyemedi (kod 60).');
    if not WizardSilent then
      MsgBox('DestekOfis sunucusu kuruldu ve çalışıyor, ancak Windows Güvenlik Duvarı''na izin kuralı eklenemedi.' + #13#10#13#10 +
        'Bu bilgisayarda güvenlik duvarını başka bir güvenlik yazılımı yönetiyor olabilir. Personel bilgisayarları sunucuyu bulamazsa o yazılımda TCP ve UDP 5123 portlarına izin verin.', mbInformation, MB_OK);
  end
  else if ResultCode <> 0 then
  begin
    ServiceFailed := True;
    Log('SERVIS-KURULUM-HATASI: servis-kur.cmd çıkış kodu ' + IntToStr(ResultCode));
    if not WizardSilent then
      MsgBox('DestekOfis servisi kuruldu ancak başlatılamadı (kod ' + IntToStr(ResultCode) + ').' + #13#10#13#10 +
        ServiceErrorText(ResultCode) + #13#10#13#10 +
        'Son kayıtlar:' + #13#10 + LogTail(LogFile, 8) + #13#10 +
        'Ayrıntılar: ' + LogFile + #13#10 +
        'Bilgisayarı yeniden başlatmayı deneyin; sorun sürerse bu pencerenin ekran görüntüsüyle destek isteyin.', mbError, MB_OK);
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
  if (CurPageID = wpSelectComponents) and not NetworkChecked and not WizardSilent then
    PrepareSetupTypePage;
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
