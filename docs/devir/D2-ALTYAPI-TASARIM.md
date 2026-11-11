# D2 — Devir altyapısı: arşiv kayıt defteri, salt okunur arşiv, bakım kipi, kalıcı devir yedeği (2.5.0)

Kaynak: `docs/devir/DEVIR-PLANI.md` G bölümü (G1.1, G1.6, G5, G6, G8, G10, G12; çelişkide G geçer), §2.1–§2.3, §7, §8; iş listesi D2 satırı, BS-7 Y5
("arşivi açan yolda kapı, restoreCompanies'e arşiv, test"). D2 DEVRİ YAPMAZ (budama, açılışlar, kapanış fişi, takas, Devri Yenile / Geri Al = D3–D4);
yalnız onların dayanacağı mekanizmaları, uçları ve testleri kurar. Para / kapama / defter kuralı GİRMEDİ. Göç KULLANILMADI (48 ve 49 boş kaldı:
arşiv kaydı sirketler.json'da, işaretler settings anahtarında, bakım kipi bellekte, devir yedeği dosya düzeyinde).

## 1. Dosyalar
| Yer | İş |
|---|---|
| `server/lib/devir/archives.mjs` | Arşiv dosya düzeyi: yol (`<şirket veri klasörü>/arsiv/<yıl>/destekofis.sqlite`), işaretler, akışla SHA-256, diskte tarama, yan dosya, diskten tanıma kuralı |
| `server/lib/devir/archive-open.mjs` | Açılmadan önce hazırlık: bütünlük, arşivin göçü, şema kapısı; liste için durum (özet hesaplamadan) |
| `server/lib/devir/maintenance.mjs` | Bakım kipi kaydı (ortak katman), güncelleme tutması, 001'in bağlantı koruması (geçici tetikleyiciler), yarıda kalan kipin izi |
| `server/lib/devir/devir-backups.mjs` | Kalıcı devir yedeği: oluştur, listele, doğrula |
| `server/lib/companies.mjs` | `update()` arşiv alanını korur; `createArchiveRegistry` (ayrı işlev): archivesOf / archiveOf / addArchive / updateArchive / removeArchive / reconcileArchives / orphanArchives |
| `server/lib/company-backups.mjs` | Ayrı işlevler: `assertDevirConsistent`, `archivesOnDisk`, `commonLayer`; `restoreCompany` + `applyStagedRestore` denetimi; `paused` (otomatik yedek bakımdaki şirketi atlar); `createDevirBackupFor`, `listDevirBackupsFor`. COMMON_SETTINGS satırına DOKUNULMADI |
| `server/app.mjs` | Arşiv örneği (`overrides.archive`), `writeGate` (= şema kapısı ∪ arşiv kapısı), bakım kipi kapısı (şema kapısıyla aynı yerde), `?hofArchive=` dağıtımı, `openArchive` / `closeArchives`, `canWriteInBackground` + `writeLock` sarmalayıcısı, KEEP_SETTINGS'e `devir.` |
| `server/lib/update-orchestrator.mjs` | `update:hold` (süreli tutma); tutma varken kurulum başlamaz (KAPSAM NOTU: görev metninin "yazabileceğin" listesinde yoktu; G1.1'in "güncelleme kurulumu başlamaz" maddesi başka yerde karşılanamaz — §5.3) |
| `server/routes/devir.mjs` | `GET /api/admin/devir/archives`, `POST …/archives/verify`, `GET /api/admin/devir/backups`, `POST …/backups/verify`, `GET /api/admin/maintenance` (ortak katman; system.manage) |
| `client/admin.html` + `client/assets/hof-devir-yedekleri.js` | Yönetim → Yedekler → "Devir Yedekleri" bölümü (admin.js'e dokunulmadı) |

## 2. Arşiv kayıt defteri (G1.6, §2.1)
- Kayıt: `sirketler.json` (+ `sirketler.yedek.json` + ortak katman `company.registry`, var olan `save()` yolu) şirket girdisinde
  `archives: [{ year, cutoff, runId, sha256, size, schemaVersion, createdAt, createdBy, backup, migratedAt, migratedFrom, previousSha256, verifiedAt, recovered }]`.
  Arşiv şirket DEĞİLDİR: `limit()` saymaz, `list()` ayrı satır vermez, otomatik yedek / POS / WhatsApp / kullanım defteri (hepsi `companies.list()` üzerinden) görmez.
- Yol her zaman yıldan hesaplanır (`arsiv/<yıl>/`); kayıttaki `dir` yalnız bilgidir (elle düzenlenmiş kayıt klasör dışına çıkamaz; yıl 4 hane, 2000–2999).
- Dosya kendini tanıtır (D4 yazar, D2 okur): arşivde `devir.archive` = { companyId, year, cutoff, runId, createdAt }; çalışma (yeni yıl) dosyasında
  `devir.years` = [{ year, cutoff, runId, at }]. Kaydın kopyası arşiv klasöründe `arsiv-kaydi.json` (kayıt kaybolunca özet buradan).
- Diskten tanıma (`reconcileArchives`, her açılışta; G10.26): diskte olup kayıtta olmayan arşiv YALNIZ (a) işaret bu şirketin ve bu yılın (kayıt diskten kurtarıldıysa
  kimlik yeni üretilmiş olabilir → işaretteki eski kimlik kabul) VE (b) çalışma dosyasının `devir.years`'ı aynı yılı AYNI devir çalışmasıyla taşıyorsa tanınır
  (`recovered: true`). Tutmazsa (yarım devir: arşiv yazılmış, çalışma dosyası takas edilmemiş) TANINMAZ — tanınsaydı K yılı iki dosyada görünürdü; "sahipsiz"
  listesine girer (günlük + `GET /api/admin/devir/archives` → orphans), dosyaya dokunulmaz. Kayıtta olup diskte olmayan girdi SİLİNMEZ (durum "Dosya Yok").
  Bu kural eski sürümün (alanı bilmeyen 2.4.9) kaydı yeniden yazıp `archives` alanını düşürmesini de onarır.
- D4 İÇİN SIRA ŞARTI: arşiv dosyası `arsiv/<yıl>/`'a ancak çalışma dosyası takas edilirken / edildikten sonra konur; kayıt girdisi takasla aynı adımda
  (001'de: yeniden başlatmadan ÖNCE — §7'deki geri yükleme denetimi hazırlanan dosyanın `devir.years`'ını kayıtla karşılaştırır).

## 3. Arşivin salt okunur açılması (§2.2, G8; BS-7 kapısıyla ilişkisi)
- İstek `?hofArchive=<yıl>` (şirket `?hofCompany=` ya da seçili şirket) → ortak katmanın `openArchive` → şirketin kimliğini taşıyan AYRI örnek (`<şirket>@arsiv-<yıl>`;
  canlı örnekten ayrı tutulur). Oturumsuz istek arşivi açtırmaz (401); yetki şirket yetkisiyle aynı. Ortak katman yolları (HUB_ONLY) arşive hiç gitmez.
- Örnek: veri klasörü ŞİRKETİNKİ (belgeler/, secret.key, mesaj-arsivi/ şirket klasörüne çözülür — G8), veri tabanı arşiv dosyası, bağlantı `readOnly`
  (SQLite her yazımı reddeder). `writeGate = schemaGate || archiveGate`: BS-7'nin atladığı her açılış adımı (göç, kullanıcı aynası, onarımlar, profil, donmuş defter
  koşusu, WhatsApp kuyruğu toparlama / kaydı) arşivde de atlanır; denetim izi / sohbet / mutabakat kapısı yazmaz; `canWriteInBackground` false; tarama, sohbet arşivi,
  uyarı ve POS zamanlayıcıları kurulmaz. `schemaGate` (ekran şeridi) değişmedi — arşiv şeridi D5.
- MERKEZÎ YAZMA YASAĞI: `handle()` içinde lisans kapısından hemen sonra `assertArchiveWritable` → arşiv örneğine giden HER GET dışı istek 403 `archive-read-only`
  (istisna yok). Arşiv kapanırken canlı şirketin WhatsApp kuyruğu işçiden ÇIKARILMAZ (aynı şirket kimliği; `close()`'da korundu). Şirket kapanınca (geri yükleme,
  silme, Ayır) o şirketin arşiv örnekleri de kapanır (`closeCompany` → `closeArchives`).
- Bütünlük: açılmadan önce kayıttaki sha256 ↔ dosya (akışla; sonuç boy + değişme zamanıyla önbellekte, liste ucu özet HESAPLAMAZ — ders 47).
  Değişmiş + son şema → uyarıyla salt okunur açılır (`archive.warning`); değişmiş + eski şema → 409 `archive-changed` (güncel sürüme taşınmaz); dosya yok → 503
  `archive-missing`; kayıt yok → 404 `archive-not-found`. Diskten tanınmış (özetsiz) arşivin özeti ilk doğrulamada kayda yazılır (BİLİNEN SINIR: ilk kullanımda güven).

## 4. Arşivin göçü ve şema kapısı (§2.3, G6, G10.25)
- TEMBEL GÖÇ (BAŞ MİMAR KARARI GEREKİYOR — §11 K1): arşiv ilk açıldığında, şeması programın son göçünden küçükse ve bütünlüğü tutuyorsa: göç öncesi kopya
  (`goc-oncesi-v<eski>.sqlite`, yalnız en sonuncusu) → dosya KISA SÜRE yazılabilir açılır, `runMigrations` → günlük kipi DELETE → kapanır → yeni sha256 kayda
  (önceki `previousSha256`). İki eşzamanlı istek tek hazırlığı paylaşır (`archiveOpening`). Göç verisi aynı dosyanın canlı şirket gibi göçüyle AYNI (test).
- Şema > son göç (daha yeni sürümün arşivi): göç YOK, salt okunur açılır, `archive.schemaAhead` (BS-7 kapısı arşive de).
- Arka plan işleri arşivi açmaz → güncellemenin DENEME açılışında (kullanıcı istekleri bekletilir) arşiv göç etmez → servis yöneticisinin `restoreCompanies`'ine
  arşiv EKLENMEDİ (BS-7 Y5'in ikinci maddesi bu kararla gereksiz; K1 ile birlikte onay ister). Elle dönüş yolu: göç öncesi kopya.
- BİLİNEN SINIR (D4 / sonraki sürüm girdisi): göçün bıraktığı BEKLEYEN İŞ salt okunur arşivde koşmaz (ör. göç 47'nin dondurma koşusu, `ledger_snapshot_runs` pending).
  D4'ün arşivi son şemada üretip kilit + donmayı devirde yapması bunu bugün için kapatır; ileride göç arşive iş bırakırsa iş arşivin hazırlık adımında yürütülmeli.

## 5. Bakım kipi (G1.1, §7.6, G10.10 / G10.17)
### 5.1 Kayıt ve istek kapısı
- Ortak katmanda tek kayıt (`createMaintenance`), şirket örnekleri hub'dan okur. `enter(şirket, { reason, runId, by, label })` / `exit` / `run(…, fn)` (her durumda kapatır).
- Şirket örneğinde (002+): bütün GET dışı istekler 503 `maintenance` (+ `retry-after`). 001'de: ortak katman yolları DIŞINDAKİ bütün GET dışı istekler 503.
  Herhangi bir şirket kipteyken ortak katmanın dosya / kayıt defteri / güncelleme / devir yazmaları da 503 (`MAINTENANCE_HUB_BLOCKED`: companies — select hariç —,
  admin/backups, admin/update, admin/devir). Açık kalanlar: giriş / çıkış / parola, lisans, şirket seçimi, kullanıcı / rol / kurtarma / mobil yönetimi (ortak katman
  tabloları; takasta canlıdan aktarılırlar — stageRootRestore / transplantCommon deseni). Okuma (GET) çalışır.
### 5.2 Veri tabanı düzeyi güvence
- 002+: açık örneğin bağlantısı `PRAGMA query_only = ON` (bakımda açılan örnek açılışta alır); devir yedeği / kopya kısa süreli salt okunur bağlantıdan (`withCompanyDb`).
- 001: bağlantı ortak katmanı da taşıdığı için GEÇİCİ tetikleyiciler (`applyWriteGuard`): `commonLayer()` tabloları (users, roles, sessions, mobile_*) ve ortak ayar
  anahtarları (COMMON_SETTINGS — geri yüklemedeki aktarımla AYNI küme) dışındaki her tabloya INSERT / UPDATE / DELETE `RAISE(ABORT, 'DESTEKOFIS_BAKIM')`. TEMP:
  dosyaya yazılmaz, bağlantı kapanınca (süreç ölünce) kalkar. Sonuç: GET'te yazan yollar (tekrarlayan fatura taslağı, test serisi başlangıcı) ve gözden kaçan bir
  yazıcı da 001'in şirket verisini değiştiremez. Bakımda denetim izi / sohbet / mutabakat kapısı yazmaz (giriş izi tutulmaz; takasla zaten kaybolurdu).
### 5.3 Arka plan yazıcıları ve güncelleme
- `canWriteInBackground` bakımdaki şirkette false: Sheets eşitlemesi, POS valör kuyruğu, belge temizliği, sohbet arşivi, mutabakat taraması, oturum temizliği, donmuş
  defter, WhatsApp durum bildirimi (503, Meta yeniden dener); 001 kipteyken mobil özet yüklemesi. WhatsApp işçisi: `writeLock` sarmalayıcısı şirketin anahtarını kilitli
  gösterir (makine defterinin anahtarı etkilenmez). Otomatik yedek kipteki şirketi atlar (`paused`); POS valörü / süren WhatsApp için şirket açma turu da.
  "e-Belge turları": programda zamanlanmış e-Belge turu YOK (gönderim kullanıcı isteğiyle; bakımda 503) — G1.1'deki madde karşılıksız kaldı, not.
- Güncelleme kurulumu başlamaz: kip açılırken servis yöneticisinden `update:hold` (anahtar = şirket, süre 30 dk, kip sürdükçe 5 dk'da bir yenilenir); orkestratör
  tutma varken kendiliğinden / ertelenmiş kurmaz, "Şimdi Güncelle" `MAINTENANCE` ile reddedilir, indirme sürerken tutma gelirse eski sürüm DURDURULMADAN kurulum
  bırakılır (periyodik denetim yeniden bulur). Güncelleme o an geçiş adımındaysa (`switching`) kip AÇILMAZ (503 `update-switching`). Servis yöneticisine ulaşılamazsa
  kip açılmaz (503); güncelleyici bu kurulumda yoksa (`UPDATES_DISABLED`) kip açılır. Süreç ölürse tutma süresi dolunca düşer.
### 5.4 Yarıda kesilme — KARAR
- Kip BELLEKTEDİR; süreç ölünce kalkar ve AÇILIŞTA YENİDEN AÇILMAZ. Gerekçe (G1): canlı dosya takasa kadar değişmez (kopyada üret, doğrula, takas et), kip açıkken
  veri tabanı koruması yazımı zaten engeller → ölümden sonra canlı veri devir öncesiyle aynıdır; kipi kalıcı tutmak yalnız kullanıcıyı kilitlerdi.
- İz: kip açıkken `<veri>/bakim-kipi.json`; açılışta okunur (`maintenance.status().lastAborted`, `GET /api/admin/maintenance`; günlükte uyarı), dosya silinir.
  D4'ün yarım kopyaları temizlemesi bu ize bakar. 001'in yeniden başlatmalı takası `geri-yukleme.json` hazırlığıyla (stageRootRestore deseni) olur; bakım izi ondan
  bağımsızdır.
### 5.5 Bilinen davranış
- 001 kipteyken `GET /api/workspace/whatsapp/app-webhook` 503 ("hazırlanamadı"): WE ilk GET'te Elle Bağla webhook çiftini 001'in ayarına yazıyor; bu tabanda anahtar
  COMMON_SETTINGS'te değil. WE + BS-7 düzeltmesi (anahtar ortak katmana) birleşince 200 olur. Veri değişmez.

## 6. Kalıcı devir yedeği (G5)
- Ayrı SINIF ve ayrı KUYRUK: `<şirketin yedek klasörü>/devir-yedekleri/<zaman>-<etiket>/`; etiket `devir-oncesi-<yıl>` | `devri-yenile-oncesi-<yıl>` |
  `devri-geri-al-oncesi-<yıl>`. `pruneBackups` yalnız klasörün kendi düzeyindeki yedek dosyalarını görür → HİÇ budanmaz; ad / kod değişince yedek klasörüyle taşınır;
  rutin yedeğin "yarım dosya" temizliği ona dokunmaz.
- İçerik: veri tabanının tutarlı kopyası (`createBackup`: VACUUM INTO + şirket kimliği + kullanım defteri), `arsiv/` (göç öncesi kopyalar hariç), `belgeler/`,
  `mesaj-arsivi/`, `secret.key`, `devir-yedegi.json` (her dosyanın yolu, boyu, SHA-256). Önce `<ad>.yaziliyor/`, bitince asıl adına; dosya kopyaları ve özetler
  async (olay döngüsü tutulmaz). Doğrulama eksik / değişmiş / fazla dosyayı bulur.
- KÖR NOKTA UYARISI: devir yedeği `secret.key`'i taşır (G5 gereği; rutin yedek taşımaz) → yedek klasörüne erişen, yedekteki şifreli entegratör / WhatsApp gizlilerini
  açabilir. Ekranda uyarı yazıldı; kullanıcıya söylenmeli (§11 S1).
- Geri yükleme (Devri Geri Al) D4'ün işi; Yedekler ekranında yalnız liste + "Doğrula".

## 7. "Yedekten Geri Yükle" arşiv kaydını bilir (G5, G10.18)
- `assertDevirConsistent`: yedekteki `devir.years` ↔ şirketin arşiv kaydı (yıl + devir çalışması). Tutmazsa 409:
  `devir-oncesi-yedek` (kayıttaki yıl yedekte devredilmemiş — devirden önce alınmış; ya da aynı yıl başka çalışmayla) → "Devri Geri Al'ı kullanın";
  `devir-sonrasi-yedek` (yedek kayıtta olmayan bir yılın devrinden sonra — devir geri alınmış) → o yılın kesime kadarki kayıtları hiçbir dosyada görünmezdi.
- Nerede: `restoreCompany` (002 hemen, 001 hazırlık) ve `applyStagedRestore` (001, açılışta; hazırlık devirden önce yapılıp devir sonra olmuşsa uygulanmaz, neden
  Yedekler'de). Devri Geri Al'ın kendi yolu `devirCheck: false` verir (D4). Arşivsiz şirkette eski davranış aynen.

## 8. Uçlar
Bkz. §1 (`server/routes/devir.mjs`). Hepsi ortak katmanda (`HUB_ONLY`'e `admin/devir|maintenance` eklendi), system.manage, yalnız görülebilen şirketler.

## 9. Nasıl bozulur? (CLAUDE.md test kuralı + G10; testler buradan)
1. 001 bakımda / 002 bakımda (öbürü çalışmalı); her yazma ucu (kaynak taramasıyla); ortak katmanın şirket / yedek / güncelleme yazmaları; giriş çalışmalı.
2. Bakımda GET'te yazan yol (günü gelmiş tekrarlayan fatura) — ön koşulun gerçekten oluştuğu kip kalkınca kanıtlanır (ders 20).
3. Bakımda açılan şirket örneği (query_only açılışta); gözden kaçan doğrudan yazım (tetikleyici).
4. Arka plan: canWriteInBackground, WhatsApp işçisi (şirket / makine defteri anahtarı), otomatik yedek turu.
5. Güncelleme: tutma varken kendiliğinden / Şimdi Güncelle; indirme sürerken kip; geçiş adımında kip isteği; tutma süresinin dolması; servis yöneticisine ulaşılamaması.
6. Bakım açıkken süreç ölümü (SIGKILL) → açılışta kip yok, iz var, canlı veri aynı, geçici tetikleyici yok.
7. Kayıt defteri: ad / kod değişikliği; tamamen kayıp (diskten kurma, kimlik yeniden üretilir); eski sürümün alanı düşürmesi; yarım devir (tanınmamalı).
8. Arşivde her yazma ucu 403; GET'ler 5xx vermez; dosya bayt bayt aynı (günlük dosyası oluşmaz); canlı şirket sürer; arşiv kapanınca canlı kuyruk işçide kalır.
9. Arşiv dosyası değişmiş (son şema / eski şema), silinmiş, kayıtsız yıl, geçersiz yıl.
10. Eski şemalı arşiv (GERÇEK v2.0.26 koduyla üretilmiş fikstür) ilk açılışta göç; iki eşzamanlı istek tek göç; daha yeni şemalı arşiv.
11. İki şirket: arşivler ayrı; şirket kapanınca yalnız onun arşiv örneği kapanır; arşiv şirket sınırına sayılmaz.
12. Devir yedeği: içerik + özet; 35 rutin + 40 güvenlik yedeği (gerçek budama yolu, sahte zaman damgaları) + zamanlayıcı turu; ad değişikliği; yarım yedek.
13. Geri yükleme: devir öncesi yedek (002 hemen, 001 hazırlık), devir sonrası yedek, devir geri alınmış + sonrası yedek, başka devir çalışması, devirden önce hazırlanıp
    sonra uygulanan 001 geri yüklemesi, bakımdaki şirkete geri yükleme, Devri Geri Al yolu.
14. Eski sürüm verisi (v2.4.9 gerçek koduyla üretilmiş 001 + 002 + yedek): kayıt defteri, arşiv (şema 45 → son), geri yükleme denetimi, bakım kipi
    (`test/devir-d2-eski-surum-250.mjs --eski <kopya>`).

## 10. Testler ve kanıt
- `test/devir-d2-bakim-250.test.mjs` (8), `test/devir-d2-arsiv-250.test.mjs` (7), `test/devir-d2-yedek-250.test.mjs` (5); yardımcı `test/devir-d2-yardimci.mjs`,
  işçi `test/fixtures/devir-d2-bakim-isci.mjs`; eski sürüm betiği `test/devir-d2-eski-surum-250.mjs`; mutasyon `test/devir-d2-250-mutasyon.mjs` (28 mutant; 6 numara
  EŞDEĞER — iki kat koruma, 28 ikisini birlikte kaldırır); hacim `test/devir-d2-hacim-250.mjs`. Kanıt `docs/kanit/2026-11-06/d2-*`.
- HACİM (100.000 Kasa hareketi, programın API'siyle; 5 arşiv; aynı taban kopyası, önce 3064bc41 / sonra 5259bffa): arşiv listesi 5–13 ms, Yedekler listesi 3–5 ms,
  Devir Yedekleri listesi 5–23 ms, bakım kipi aç 9–36 ms, açılış taraması ≤ 1 ms, 5 arşivin bütünlük denetimi ~1 sn / olay döngüsü en çok ≤ 43 ms, devir yedeği
  (823 MB) 2,2–3,3 sn / ≤ 42 ms. ARŞİV ÖRNEĞİ AÇILIŞI önce 3.069 ms / olay döngüsü 2.879 ms (kapının taban ölçümü bütün defteri tarıyordu) → sonra 227–247 ms /
  8–11 ms (arşivde kapı kurulmaz; yazma ulaşmaz). Arşivde Kasa listesi isteği 2,6–3,1 sn / ~400 ms = canlı şirketteki aynı istek (2,6–3,2 sn / ~420–526 ms) —
  arşive özgü yük yok; Kasa listesinin kendisi D2 dışı (BİLİNEN SINIR, canlıyla aynı).
- WINDOWS'TA DOSYAYA DOKUNANLAR (ders 48): yarıda kesilme (SIGKILL + açık dosya), arşivin göçü (kopya + yeniden adlandırma + günlük kipi), devir yedeği (klasör
  yeniden adlandırma, kopya), ad değişikliğinde yedek klasörü taşıma, diskten kurma (bozuk kayıt dosyası), şirket kapanınca arşiv örneği (tutamak bırakma).

## 11. Kararlar
- K1 BAŞ MİMAR KARARI GEREKİYOR: arşiv göçü TEMBEL (ilk açılışta) mı, programın her açılışında EVVELDEN mi? Öneri: tembel (deneme açılışında arşiv göç etmez → servis
  yöneticisinin geri dönüşüne arşiv eklemek gerekmez; açılış süresi arşiv sayısıyla büyümez). Bedeli: yıllar sonra açılan arşivin göçü o anda (ana iş parçacığında,
  şirket açılışı gibi) sürer.
- K2 BAŞ MİMAR KARARI GEREKİYOR: değişmiş (özeti tutmayan) arşiv: son şemadaysa uyarıyla salt okunur açılır, eski şemadaysa açılmaz (göç edilmez). Öneri bu (görüntüleme
  hakkı korunur, değişmiş dosya güncel sürüme taşınıp "doğru" sayılmaz).
- K3 BAŞ MİMAR KARARI GEREKİYOR: bakım kipi açılışta TEMİZLENİR (§5.4). Öneri bu (G1 mekanizması gereği güvenli).
- K4 BAŞ MİMAR KARARI GEREKİYOR: 001 bakımda ortak katmanın kullanıcı / rol / mobil yönetimi açık; şirket / yedek / güncelleme / devir yazmaları herhangi bir şirket
  kipteyken kapalı. Öneri bu (ortak katman tabloları takasta canlıdan aktarılır; dosya / kayıt defteri işleri devrin takasıyla çakışır).
- K5 BAŞ MİMAR KARARI GEREKİYOR: "Şirket Verisini Sıfırla" `devir.` anahtarlarını korur (KEEP_SETTINGS) — arşivler sıfırlamadan sonra da kayıtlı kalır, işaret silinirse
  geri yükleme denetimi ve diskten tanıma çalışma dosyasını devirsiz sanardı. (Arşivli şirkette sıfırlamanın kendisine izin verilip verilmeyeceği D4 / D5'in sorusu.)
- K6 BAŞ MİMAR KARARI GEREKİYOR: devir sonrası yedeğin, devir geri alındıktan sonra geri yüklenmesi ENGELLENİR (`devir-sonrasi-yedek`; G5 yalnız devir öncesini
  söylüyordu). Öneri bu (yoksa K yılı hiçbir dosyada görünmez).
- S1 KULLANICIYA BİLGİ (karar değil; G5 baş mimar kararının sonucu): devir yedeği şifreli ayarların anahtarını (secret.key) içerir — yedek klasörü korunmalı.

## 12. D3–D6 için girdiler (D2'nin bıraktığı sözleşme)
- D4 sırası: şirket ÖNCE açılır (bekleyen göçü koşar), SONRA bakıma alınır — bakımdayken ilk kez açılan ve göç bekleyen şirketin örneği açılmaz (bağlantı query_only;
  göç yazamaz → 503 "açılamadı"). Önerilen akış: `maintenance.run(şirket, { reason: "devir", runId }, async () => { createDevirBackupFor → kopyalar → değişmezler → takas })`.
- D4 takası: 002+ `closeCompany` (arşiv örnekleri de kapanır) → dosya değişimi → `addArchive` (+ `devir.years` yeni yıl dosyasında, `devir.archive` arşivde, arşiv DELETE
  günlük kipinde, son şemada, kilitli + donmuş). 001: hazırlık (`stageRootRestore(..., { devirCheck: false })` deseni ya da ayrı hazırlık) + `addArchive` yeniden başlatmadan
  ÖNCE. Devri Geri Al: `removeArchive` + arşiv klasörünü `arsiv/silinen/`'e taşı + devir yedeğinden dönüş `restoreCompany({ devirCheck: false, allowPaused: true })` (kipi kendisi tutan iş; öbür her yol bakımdaki şirkete 503).
- Devri Yenile (G7) arşivi yazılabilir açacak: D2'nin `openArchive`'ı yalnız salt okunur; D4 yazılabilir arşiv örneğini bakım kipinde ayrıca kurar, bitince `updateArchive`
  (yeni sha256) + `closeArchives`.
- D5: arşiv şeridi / seçici (`?hofArchive=`), Devir Yedekleri'nden geri yükleme yok (Devri Geri Al akışı), yarıda kalan bakımın (`lastAborted`) ekranda gösterilmesi.
- Belge temizliği arşivin başvurularını henüz görmüyor (G8, documents.mjs purge): D2'de arşiv üreten yol olmadığından risk yok; D4'ten önce eklenmeli (yoksa yeni yılda
  silinen belge 30 gün sonra diskten gider, arşivin gösterdiği dosya da).
- Yorum tutarsızlıkları (Ç1 / Ç2 dar kontrollerinden D2'ye bırakılan; DOKUNULMADI — dosyalar başka ajanlarda): `audit_events` D2'de ŞİRKET VERİSİ sayıldı (COMMON_TABLES'ta
  yok, geri yüklemede aktarılmaz, 001 bakımında yazılamaz); `test/sema-kapisi-bs7.test.mjs` test 3'ün 001'de audit_events'i ortak katman gibi atlaması yalnız ölçüm kolaylığı —
  yorum orada düzeltilmeli. `server/routes/ledger.mjs` ~186 "mahsup tablosuna yazım tam kapıya düşer" yorumu (Ç2 bulgusu) yasak dosya — ayrı küçük iş.

## 13. Tur 2 (dar kontrol 06.11 ~16:30 bulguları; BAŞ MİMAR KARARI — DURMA KURALI, yalnız bunlar; taban 6dc3e150)
### 13.1 ORTA-1 — arşiv göçü İKİ AŞAMALI (§4'teki "dosya kısa süre yazılabilir açılır" cümlesinin yerine)
- Sorun: dosya YERİNDE göç ediyor, yeni özet kayda akışla özet (`hashFile`) bittikten SONRA yazılıyordu; arada SIGKILL → dosya son şemada / yeni özet, kayıt eski özet →
  arşiv KALICI "Değişmiş" (uyarı, Doğrula `changed`); sonraki göçlü sürümde K2 (değişmiş + eski şema → 409) ile programdan hiç açılamaz. Doğrula kaydı düzeltmiyordu.
- Çözüm (`server/lib/devir/archive-open.mjs` migrateArchive): göç öncesi kopya (aynen) → çalışma kopyası `goc-calisma.sqlite` (aynı klasör) yazılabilir açılır, göçler, günlük kipi
  DELETE, kapanır → özeti → kayda BEKLEYEN özet (`pendingSha256`, `pendingFrom`, `pendingAt`; `ARCHIVE_FIELDS`, yan dosya da taşır) → çalışma kopyası asıl dosyanın adına
  `rename` (atomik, hedefin yerine; Windows'ta açık tutamak yokken: `hashFile` artık tutamak KAPANINCA döner, olgu okuması ve göç bağlantısı kapalı; geçici EPERM / EBUSY /
  EACCES'te olay döngüsünü tutmadan 6 deneme) → kayıt kesinleşir (yeni özet, son şema, göç bilgisi, önceki özet; bekleyen alanlar silinir).
- Açılışta ve Doğrula'da AYNI kural (`verifyArchive` → `{ state: "ok", pending: true }`, `commitPendingMigration`): dosyanın özeti kayıttakini tutmuyor ama bekleyen özeti
  tutuyorsa değişmiş SAYILMAZ, kayıt kesinleştirilir (önceki özet = kayıttaki, göç bilgisi bekleyen alanlardan); şema hâlâ eskiyse (önceki sürümün ara şemada kalmış göçü) göç sürer.
  Kayıt defteri de kaybolduysa bekleyen özet arşiv klasöründeki kayıt kopyasından gelir (`adoptionOf`). Hem kaydı hem bekleyeni tutmayan dosya değişmiştir: K2 aynen.
- Kesinti tablosu: kopya göç etti / özet alınırken → asıl dosya ve kayıt eski (tutar), sonraki açılış göçü baştan yapar (artık kopya silinir); bekleyen yazıldı / taşımadan ÖNCE →
  aynı (bekleyen yeniden yazılır); taşındı / kesinleşmeden → dosya bekleyeni tutar → kabul. Hiçbir noktada kalıcı "Değişmiş" yok. Yeni kural yok (K1 tembel göç, K2 aynen).
- Çalışma kopyası geçicidir: bir sonraki göç siler; devir yedeğine girmez (`isArchiveTransient`; `devir-backups.mjs` süzgeci göç öncesi kopyalarla birlikte).
### 13.2 ORTA-2 — bakımdaki şirketin arşivi açılmaz
- `server/app.mjs` openArchive: şirket bakımdaysa 503 `maintenance` ("“<kod · ad>” şirketinde <neden>; bu sırada şirketin <yıl> arşivi açılamaz. Birkaç dakika sonra yeniden
  deneyin.", `retry-after` 30) — açık arşiv örneğine de istek gitmez (denetim örnek önbelleğinden ÖNCE). Açılış sürerken kip açılırsa her beklemeden sonra aynı denetim
  (`prepareArchive` guard: arşivin özeti alındıktan sonra, göç kopyasının özeti alındıktan sonra, taşıma yeniden denemesinden önce): iş durur, arşiv dosyası / klasörü / kaydı
  değişmez, çalışma kopyası silinir. `closeCompany` ile kapanan örnek bakım sürerken yeniden açılmaz.
- D4 için (§12'ye ek): kipten ÖNCE açılmış arşiv örneklerini `closeCompany` kapatır — D4 arşive dokunmadan önce kip → `closeCompany` sırasını izler.
### 13.3 DÜŞÜK-1 — DESTEKOFIS_BAKIM → 503
- `server/app.mjs` handle(): 001'in geçici koruma tetikleyicisinin düşürdüğü yazım (`isMaintenanceAbort`: ileti ya da `cause`) 500 yerine 503 `maintenance` (+ `retry-after`) —
  istek kapısının görmediği her yazıcı doğru ileti verir (ör. ortak katmandaki "görevlerini devrederek kullanıcı sil" şirketin `tasks` tablosuna yazar; işlem geri alınır, veri değişmez).
  `maintenanceMessage` şirket adı yoksa da büyük harfle başlar.
### 13.4 DÜŞÜK-2 — yaşayan mutantlar (yalnız test)
- D2 (`db.mjs` READ_SQL — her PRAGMA okuma): `test/db-tx-kayip-pragma-250.test.mjs` (get / all ile PRAGMA ataması kayıptan sonra ERR_TX_LOST, şema değişmez).
- A2 (`adoptionOf` devir çalışması): `test/devir-d2-arsiv-250.test.mjs` "aynı yıl ama FARKLI devir çalışması".
- B1 (001 koruması): `test/devir-d2-bakim-250.test.mjs` "korumanın düşürdüğü yazım" — görev tablosu + ortak katman dışındaki HER tabloya ekleme DESTEKOFIS_BAKIM.
### 13.5 Testler ve mutasyon
- Yeni: `test/devir-d2-arsiv-goc-kesinti-250.test.mjs` (6; işçi `test/fixtures/devir-d2-arsiv-goc-isci.mjs` — göçün kesme noktasında SIGKILL; kesme noktaları `__testArchiveStep`,
  yalnız test oluşturucusundan; kancası olmayan eski kodda aynı pencere yoklamayla), `test/db-tx-kayip-pragma-250.test.mjs` (1); bakım testine 2, arşiv testine 1 hücre;
  yardımcı `placeLegacyArchive`. Mutasyon `test/devir-d2-250-mutasyon.mjs` 39 mutant (29–39 bu tur; 6 yine eşdeğer).
- WINDOWS'TA DOSYAYA DOKUNANLAR (ders 48; CI'de görülecek): çalışma kopyasının asıl dosyanın yerine `rename`'i (hedef var), SIGKILL'den sonra yarım çalışma kopyasının silinmesi,
  bakımda durdurulan göçün kopyasını silmesi, `hashFile`'ın tutamak kapanınca dönmesi.
- BİLİNEN SINIR: taşımanın yeniden denemesi (Windows antivirüs / kısa süreli tutamak) yalnız gerçek Windows'ta oluşur — Linux'ta zorla üretilmedi. Göç sırasında üç kopya
  (asıl, göç öncesi, çalışma) kısa süre birlikte durur (disk); disk dolarsa kopya düşer, asıl dosya değişmez.

## 14. Tur 3 (dar kontrol 10.11 ~12:45 bulgusu ORTA-2 + DÜŞÜK-4; BAŞ MİMAR KARARI 10.11 "D4'e bırakılmaz" — DURMA KURALI, yalnız bunlar; taban ad9f8769 = kod 78855096)
### 14.1 ORTA-2 — iki aşamalı göç arşivin yanındaki işlenmemiş günlüğü yok sayıp siliyordu (veri kaybı ailesi)
- Sorun: `migrateArchive` yalnız ANA dosyayı kopyalıyor (göç öncesi kopya + çalışma kopyası), taşımadan önce asıl dosyanın `-wal` / `-shm`'ini siliyordu; bütünlük özeti de yalnız
  ana dosyanındı → WAL kipinde KESİNLEŞMİŞ ama ana dosyaya işlenmemiş kayıt göçte sessizce kayboluyordu (dar kontrol p5: Kasa 56 → 55; WAL'daki satır yok). Bugün arşiv üreten
  ürün yolu yok (D4) — karar: yine de şimdi.
- Çözüm (`server/lib/devir/archives.mjs` archiveSideFile / clearEmptySideFiles, `archive-open.mjs`): arşivin yanında BOŞ OLMAYAN `-wal` ya da `-journal` varsa arşiv
  "değişmiş"tir — K2 AYNEN: eski şema → 409 `archive-changed` ("… değişmiş görünüyor (yanında işlenmemiş günlük dosyası var: destekofis.sqlite-wal) …"), son şema → uyarıyla
  salt okunur ("… kayıtlar yalnız görüntülenir"). GÖÇ ETMEZ (göç öncesi kopya / çalışma kopyası oluşmaz), yan dosya SİLİNMEZ, kayıt değişmez. Aynı kural açılışta
  (`verifyArchive`), Doğrula'da ("changed") ve Yönetim listesinde (`archiveStatus` "Değişmiş"; yalnız dosya boyu okunur). Boş (0 bayt) `-wal` / `-journal` ve `-shm`
  zararsızdır (DELETE kipli dosyanın yanındaki boş `-wal` salt okunur açılışı bozmaz — denendi). Okunamayan (sıcak `-journal`: salt okunur bağlantı geri alamaz, "attempt to
  write a readonly database") arşiv yan dosyası varsa 409 `archive-changed` (önceden 503 "dosya bozuk olabilir").
- Körü körüne silme kalktı: taşımadan hemen önce `clearEmptySideFiles` — yalnız BOŞ yan dosyaları siler (göçün sonucu yerine geçerken eski boş günlük yeni dosyaya uygulanmasın);
  bu arada boş olmayan günlük belirdiyse taşıma yapılmaz, hiçbir şey silinmez, kayıttaki bekleyen özet geri alınır, 409 `archive-changed`. Çalışma kopyasının kendi
  günlüğü (programın ürettiği, göç bağlantısı DELETE kipine alınıp kapanınca) bu kurala girmez.
- Ölçülen bugünkü davranış (son şema + işlenmemiş `-wal`): arşiv örneğinin salt okunur bağlantısı WAL'daki kesinleşmiş kaydı OKUR (Kasa listesinde görünür), dosyaya işlemez;
  ana dosya ve `-wal` değişmez (yalnız `-shm` okuyucu işareti). Önceden (tur 2) aynı arşiv UYARISIZ açılıyordu.
- D4 SÖZLEŞMESİ (§12'ye ek): arşiv yan dosyasız bırakılır (checkpoint + DELETE günlük kipi + bağlantı kapalı), özet ONDAN SONRA alınır. Yan dosyalı arşiv yukarıdaki kuralla
  "değişmiş" sayılır.
### 14.2 DÜŞÜK-4 — yaşayan mutantlar (yalnız test)
- D13 (devir yedeği süzgeci): ürün yolundan — göç "bekleyen-yazildi" adımında SIGKILL (çalışma kopyası + göç öncesi kopya diskte), `createDevirBackupFor` yedeğinde ikisi de yok.
- D10 (taşımadan önce boş yan dosya temizliği): tur 3 karşılığı — boş `-wal` + `-shm` kalıntısıyla göç eder, sonra yan dosya kalmaz. D9 (`hashFile` "close") yalnız Windows'ta
  fark eder (açık tutamağa taşıma) — Linux'ta EŞDEĞER; CI Windows işlerinde göç testleri yolu koşar.
### 14.3 Testler ve mutasyon
- Yeni: `test/devir-arsiv-wal-250.test.mjs` (6: eski şema + WAL → 409, dosyalar / kayıt / WAL'daki satır aynı; son şema + WAL → uyarı, satır görünür; sıcak `-journal` → 409;
  boş yan dosya (D10); taşıma öncesi beliren WAL (`__testArchiveStep` "bekleyen-yazildi") → 409, bekleyen özet geri alındı; D13 ürün yolundan), işçi
  `test/fixtures/devir-arsiv-wal-isci.mjs` (yazar, bağlantıyı kapatmadan SIGKILL). Mutasyon `test/devir-d2-250-mutasyon.mjs` 40–47 (30 çok noktalı oldu).
- WINDOWS'TA DOSYAYA DOKUNANLAR (ders 48; CI'de görülecek): yan dosyanın boyunu okuma, boş yan dosyaların silinmesi (taşımadan önce), SIGKILL'li işçinin bıraktığı `-wal` /
  `-shm` / `-journal` yanında arşivi açma denemesi. Testte her bağlantı dosyaya dokunulmadan önce kapanır.

## 15. Birleşik tur 6 (dar kontrol 11.11 DK-D2T3; BAŞ MİMAR KARARI 11.11 02:21 + kullanıcı 11.11 03:15 (a); taban dbf635be — yalnız bu turun D2 / Ç5-K ilgili kısmı)
- ORTA-1 (Kasa açılış uyarısının kapının görmediği ARTIŞI; lib/integrity.mjs `noticeGrowth`, lib/cash-opening.mjs `restoringCash` / `cashRestoreMark`): tarama uyarının
  önceki sayısını tutar (açılışta ölçülür — ilk görünüş sessiz; program yeniden açılınca önceki artış yeniden bildirilmez). Silinenler geri yüklemesinin kattığı satırlar
  (önce / sonra ölçülür — görünürlüğü dönen üst kayıt, ör. taksit kartı, dahil) açıklanmış sayılır; açıklanamayan artış `integrity_log` "scan" + zil (`integrity.alert`,
  `notice: true`, `previous`) + sunucu günlüğü: "Kasa açılışından önce tarihli hareket uyarısı arttı (2 → 3 hareket; kapının görmediği yazım)". Azalma sessiz, işaret
  izler. İş parçacığı taraması sürerken geri yükleme kesinleşirse o tarama karşılaştırmaz (işaret değişmez; sonraki tarama yapar). Yedekten geri yükleme ve şirket sıfırlama
  yeni açılıştır (işaret yeniden ölçülür). Sunum (sarı uyarı, Defter Mutabakatı "Tutarlı", ilk yazımın süzgeçli yolu) değişmedi.
  BİLİNEN SINIR: sayı tabanlıdır — iki tarama arasında bir satır silinip başka bir satırın tarihi dışarıdan açılış öncesine alınırsa (azalma + artış) fark görünmez; program
  KAPALIYKEN dış araçla yapılan artış açılışta "ilk görünüş" sayılır (bildirilmez).
- DÜŞÜK-1 (lib/db.mjs `readBefore`): önceki hâli yakalanan satırın rowid'i işlem başındaki en büyük rowid'den (K6'nın BEGIN'deki `money.marks`) büyükse `born` — store
  dışından eklenip düzeltilen açılış öncesi YENİ satır 409. K6 politikası olmayan çıplak store'da işaret yok (yalnız `inserted`).
- Testler: `test/kasa-acilis-uyari-artis-250.test.mjs` (9), `test/kasa-acilis-b6-250.test.mjs` (1), yaşayan mutantlar `test/kasa-acilis-mutant-b6-250.test.mjs` (3: A1, A16, A6),
  `test/devir-arsiv-wal-250.test.mjs` (+1: A4 özetsiz kayıtlı arşiv + `-wal`), `test/yapim-asamasi-kapisi.test.mjs` (+4: C1, C3, liste commit'ten — skip-worktree atlatması).
