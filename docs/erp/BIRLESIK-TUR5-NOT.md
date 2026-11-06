# 2.5.0 BİRLEŞİK TUR 5 — kısa tasarım notu

Taban 578c12d4 (WhatsApp tur 1 birleşimi). Kaynak: üç dar kontrolün bulguları (birleşik tur 4, AH + BS-6, WE + BS-7) + CI #1036 test yarışı + WhatsApp tur 1 yan ölçümü.
DURMA KURALI: yalnız aşağıdaki yedi iş. Ürün kodu yalnız 1, 4, 5, 7'de değişti; 2, 3, 6 yalnız test.

## 1. BS-6 kapsamı: store.exec ve yazım yapan store.get / store.all (AH dk ORTA-1)
- `server/lib/db.mjs`: `exec` önce `assertLive()`; `get` / `all` yeni `query()` üzerinden — derinlik > 0 iken deyim "açıkça okuma" değilse (SELECT / VALUES / EXPLAIN ile
  başlayan ya da atamasız PRAGMA DIŞINDA her şey: INSERT / UPDATE / DELETE … RETURNING, DDL, PRAGMA atama, WITH …) önce `assertLive()`. Okuma serbest kalır (kayıptan sonra
  okuma engellenmez; yazım değildir). `query`, `exec` ve `setting` hata yakalayınca `noteLost()`: işlemi kendiliğinden geri aldıran ilk hata bir OKUMA ya da exec ise
  ERR_TX_LOST iletisi onu söyler.
- "İlk hata okuma hatasında da" (dar kontrol DOĞRULANMADI) YENİDEN ÜRETİLDİ: GERÇEK SQLite, işlem içinde kirli sayfalar + 8 sayfalık önbellek + RLIMIT_FSIZE → büyük
  SELECT önbelleği WAL'a taşırırken `disk I/O error`, SQLite işlemi geri aldı (`db.isTransaction` false); tabanda sonraki ERR_TX_LOST iletisi ilk hatasız.
- Programdaki yollar (komşu): göçün `store.exec("PRAGMA user_version = N")` adımı (migrations.mjs runMigrations), Sıfırla'nın tetikleyici DROP / CREATE'i
  (ledger-vouchers.mjs withTriggersLifted, ledger-snapshots.mjs clearSnapshots). Kayıp yoksa davranış aynen (meşru yollar k6 + dar kontrolün bs6-mesru betiği).
- Bilerek DIŞARIDA: `changeCounters`, K6 işaretleri (`prepare(...).get()` iç okumaları) — ürünün kendi denetim okumaları, BS-6 kararına girmez.

## 2. Açılış onarımının savunma kuralları (AH dk DÜŞÜK-1; yalnız test)
- `test/acilis-onarimi-savunma-250.test.mjs` (güncel kodun API'siyle veri + kart elle eski kuralın tutarına büyütülür; bayat toplu durum `accounts.allLedgers` sarılarak):
  (a) üst sınır — iki yol (toplu eleme; toplu okuma düştü → her aday cari başına yoldan); (b) yazmadan önce cari başına yeniden okuma — toplu "onar" / cari başına "onarma"
  ve toplu hedef ≠ cari başına hedef; (c) kirli işareti — aynı cari, kart sonraki adayın carisine taşınmış, kart üçüncü cariye taşınmış (iki fatura aynı caride).
- Ürünün aday sırası (sorguda ORDER BY yok) testte kuru koşuyla okunur (kart küçültme yazmaz; `leftOf` çağrı sırası).
- M6b EŞDEĞER: ilk denetimden geçmek `target < left ≤ before = max(geri ödenen, imzalı açık)` ister → `left ≤ geri ödenen`; yeniden okumadan sonraki `before` da
  ≥ geri ödenen (aynı açılışın aynı tutarı) → `left > before` hiçbir veride doğru olamaz. M6'nın deseni yalnız ilk denetimi değiştirir; toplu elemede ikinci denetim aynı
  kuralı yine uygular → M6 yalnız cari başına yolda ölür. Kirli işaretinin iki satırı bugünkü programda aynı cariyi işaretler (kartın carisi faturadan gelir, PUT 409) →
  M5 / M5c yalnız kartı başka cariye taşınmış (eski veri, elle kurulur) hücrede ölür.

## 3. "Değişiklik yok" kısa yolu: alan alan (BT4 dk ORTA-1; yalnız test)
- `test/birlesik-tur4-degisiklik-yok-250.test.mjs` yeni describe: taksit kartı 15 + durum, taksit 6, stok kartı 15 hücre; her hücre taze form + TEK alan → 200 + veri
  tabanında yeni değer + Değişiklik Geçmişi +1. Tür hücresi kritik seviyesi 0 olan üründe; kayıt bağında yalnız caseKey (ayrıca yalnız caseSource, yalnız caseTitle).
  Ek: yalnız büyük / küçük harf (kart adı, taksit açıklaması, Stok Kodu, ürün adı, ürün notu), 1 kuruş (kart toplamı, taksit tutarı, Satış Fiyatı), Alış Fiyatı 0,0001.

## 4. Kapalı kartın "Kart kapatıldı" satırı: cari ekstre = genel defter (BT4 dk YB-1)
- `server/lib/accounts.mjs` accountLedger: satır günü genel defterle (routes/ledger.mjs + lib/general-ledger.mjs "plan-close", 689) AYNI kural — `closed_at`, yoksa son
  güncelleme günü, Kayıt Tarihi'nden önce değil. `server/routes/plans.mjs`: PLAN_SQL (cari başına yol: cari kartı, Cari Ekstre, WhatsApp ekstresi) ve ledgerPlansByAccount
  (toplu yol: Tüm Cari Hareketleri, mizan, fatura kapama) `closed_at AS closedAt` seçer. Kartın API yanıtına `closedAt` alanı eklendi (yalnız okuma).
- Eski veri: 2.0.13 öncesi kapatılmış kartta `closed_at` boş → iki yer de son güncelleme günü (bugünkü ekstreyle aynı); ilk düzeltmede FREEZE_CLOSE o günü dondurur, iki
  yer o günde kalır (önceden ekstre düzeltme gününe kayıyordu). Tutar DEĞİŞMEZ; yalnız ekstre satırının günü ve o carinin dönem ekstresindeki yeri.
- Karar (6) okuması ("önceden kapatılmış kartlar olduğu gibi kalır", 05.11, Ç7b'ye atanmış): kararın konusu Kartı Kapat'ın KALANI (689'la düşme ↔ borçta kalma); eski
  kartların kapama tutarı / işlemi değişmez demektir. Satırın günü kararın konusu değil; günü zaten genel defterin 2.0.26 G1 kuralı belirliyor, ekstre ona hizalandı. Bu okumayı
  tek anlamlı buldum; ana oturum farklı okursa soru: "Kapanmış eski kartın ekstre satırı (A) genel defterle aynı güne (kapanış) — öneri; (B) bugünkü gibi son düzeltme gününde
  kalsın (ekstre ↔ defter ayrışması BİLİNEN SINIR)".
- Gözlem (kapsam dışı, kod değişmedi): routes/plans.mjs growForInvoice (`UPDATE plans SET total, updated_at` FREEZE_CLOSE'suz) — closed_at'i boş eski kapalı kartta
  güncelleme gününü dondurmadan ilerletebilir; açık kartlar için yazıldığından pratikte etkisi yok (DOĞRULANMADI).

## 5. 001 geri yüklemesinde webhook çifti (WE + BS-7 dk ORTA-1)
- `server/lib/company-backups.mjs:144` transplantCommon DELETE'i: `whatsapp.appWebhook` canlıda YOKSA geri yüklenen dosyadakine dokunulmaz (BAŞ MİMAR KARARI: canlıda varsa
  canlınınki, yoksa yedeğinki). Yalnız o satır (D2 aynı dosyada çalışıyor).
- BİLİNEN SINIR (karar metninden; kodlanmadı): canlı çift başka anahtarla mühürlü (açılamıyor), yedekteki bu bilgisayarda açılıyor → canlınınki kalır, Webhook Bilgileri
  yeni çift üretir (Meta'da yeniden girilir).

## 6. banka-230-hareket-yaris ön koşul yarışı (CI #1036; yalnız test)
- Zorla üretme: `test/e2e/banka-230-onkosul-zorla.mjs` (`--import` ön yüklemesi; `HOF_ZORLA_B230=sira:<n>` sayfanın n'inci POST /bank/vouchers yanıtını tutar, `cpu:<kat>`
  CDP ile yavaşlatır; her zorlama "[b230-zorla]" satırı). `sira:5` (C1'in ilk gönderimi) eski testte "31 geçti, 1 kaldı" — CI #1036 imzası.
- Düzeltme: ön koşulu oluşmayan deneme yeniden denenir (yeni tutar, yeni iz; en çok `ONKOSUL_DENEME`, varsayılan 3); denetimler yalnız ön koşulu oluşan denemede; hiçbir
  denemede oluşmazsa varyant kırmızı. Özet satırı: oluşan / oluşmayan (yeniden denenen) deneme, hiç oluşmayan varyant.

## 7. Salt okunur lisansta Webhook Bilgileri (WhatsApp tur 1 yan ölçümü)
- `server/lib/whatsapp/app-webhook.mjs` reveal(publicUrl, { writable }): `writable === false` iken çift YOKSA / açılamıyorsa üretilmez — ready false + "Lisans salt okunur;
  Webhook Bilgileri lisans etkinleşince gösterilir."; var olan çift okunur ve gösterilir. İkinci değişken verilmezse davranış aynen.
- BAŞ MİMAR KARARI GEREKİYOR: lisans durumu app-webhook.mjs'e ULAŞMIYOR (createAppWebhook hub.mjs'te lisanstan önce kurulur; lisans app.mjs'te sonra; reveal'i yalnız
  routes/whatsapp.mjs:281 çağırır). Kararın etkin olması için tek satır gerekir: routes/whatsapp.mjs:281
  `whatsapp.appWebhook.reveal(mobileRemote?.publicUrl?.() || "", { writable: writable() })` — bu dosya görev kapsamımda değil ve W-3 ajanı aynı dosyada çalışıyor.
  Bağlanınca API düzeyi hücre (WE-13'ün GET karşılığı: lisans enforce + belirteçsiz → 200 ready false, 001'de satır yok) eklenmeli.
