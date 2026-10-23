> YALNIZ PLAN (23.10.2026; kullanıcı YÖN KARARI "piyasadaki muhasebe programları gibi; Excel/Sheets verisini programın analizine bırakarak muhasebesel işleri riske atamayız"). Salt okuma analiz ajanı raporu, 2.4.4 aday 25 kodu üzerinden; kod değişmedi. Kararlar K0–K11 ürün sahibinde. Sürüm: devirden (2.5.0) sonra ayrı sürüm önerisi.

# Tablo ↔ Para Koparma — Salt Okuma Analizi (2.4.4 aday 25 kodu)

Kod: `/home/user/ofis---y-netimi`, dal `claude/youthful-euler-fl8ks4` (HEAD 9d34850). Hiçbir dosya değiştirilmedi, program/e2e koşulmadı.
Satır numaraları bu HEAD'de okundu. "DOĞRULANMADI" yazan yer koddan kesinleştirilemedi.

Ölçü (ürün sahibi, 23.10.2026): "mevcut piyasadaki muhasebe programları gibi; Excel'den/Sheets'ten gelen veriyi programın analizine bırakıp muhasebe işlerini
riske atmayız." → HEDEF KURAL: **hiçbir para kaydı, borç tutarı ya da açılış bakiyesi programın tablo TAHMİNİNDEN (sütun sezgisi) doğmaz.** Excel yalnız
açık eşlemeli, ön izlemeli, kullanıcı onaylı TEK SEFERLİK içe aktarmadır (cari kartı, açılış/devir bakiyesi); tablo eşitlemesi parayı etkilemez; Tablo Raporları /
Takvim / zil yalnız hatırlatmadır ("tablodan, muhasebe kaydı değil").

Not (sürüm adı): kullanıcı "2.5.5" dedi; belgelerde ertelenenler "2.5.0" (devir sürümü) altında. Aşağıda "2.5.0" belgedeki adıdır; koparma için ayrı numara önerisi §3.4'te.

---

## 0. Kısa sonuç

- Bugün **tablodan yeni Kasa parası doğuran ekran yolu kalmadı** (2.4.4 E8: kayıt kartındaki Tahsilat düğmesi CSS ile gizli, zil/takvim "Tahsilat Gir" Cari'ye gider).
  Ama tablo hâlâ paraya **dört biçimde** değiyor: (1) 2.4.3'ten kalan kayıt tahsilatları (`payments`) gerçek para satırıdır — Kasa, Banka, yevmiye (A 602), mutabakat;
  sunucu ucu (POST/PUT/DELETE) açık; (2) **Tablodan Aktar** tablodaki sezgisel borçtan **cari açar, taksit kartı (= cari borcu, yevmiyede B 120 / A 602) ve
  "Excel'de ödenmiş" açılış satırı** yazar, cari/kayıt tahsilatlarını karta taşır — en riskli yol; (3) **ön dolumlar**: "önce cari açın" Açılış Bakiyesi ve zil/takvim
  "Tahsilat Gir" tutarı tablo sezgisinden dolar (kullanıcı değiştirebilir ama önerilen sayı sezgidir); (4) **raporlarda karışım**: Tablodaki Kişiler / Tablodaki
  Nakit Akışı / Tahsilat Takvimi tablo borcundan program tahsilatını düşer, Anlık Durum → Nakit Akış Projeksiyonu ve Vade Takip tablo kalemlerini **varsayılan
  açık** olarak muhasebe kalemleriyle aynı toplama katar.
- İş büyüklüğü: **ayrı bir sürüm**, 8 iş paketi; geliştirme ~7–9 iş günü (paralel worktree ile 4–6 takvim günü) + bağımsız turlar ve tam kapı ~2–3 gün →
  **toplam 6–9 takvim günü, 6–10 aday turu** (2.4.4 ölçüsüyle). İsteğe bağlı "eski tahsilatı cariye göç" seçilirse +1,5–2 gün, +2–3 aday.
- Sıra önerisi: **önce devir (2.5.0)**, sonra koparma (2.6.0 önerilir; kullanıcı "2.5.5" derse o). Gerekçe: devir planı kesime kadarki kayıt tahsilatlarını yeni yıldan
  zaten siler, Kasa açılışı tutarı kapsar (`docs/devir/DEVIR-PLANI.md:103`) → eski tahsilatlar için **para göçü gerekmez**, dondurmak yeter.
- Ertelenen 2.4.4 bulgularının çoğu (tablo başlığı / borç sütunu ailesi) koparmayla **para etkisini tamamen kaybeder**; "tutar sütununu kullanıcı seçer" (Seçenek B,
  §2.2) seçilirse **tamamen** çözülür; yalnız koparmayla **kısmen** (hatırlatma tutarı yanlış görünmeye devam eder). Ayrıntı §4.

---

## 1. ENVANTER — tablo verisinin paraya değdiği her yol

Sınıf: **YAZAR** = para/borç/açılış satırı yazar ya da taşır · **ÖNERİR** = para formunu tablo sayısıyla doldurur · **KARIŞTIRIR** = raporda tablo tahmini ile muhasebe
kaydını aynı sayıda birleştirir · **GÖSTERİR** = yalnız okur, ayrı gösterir.

| # | Yol | Kod (dosya:satır) | Ne yapıyor | Sınıf | Ekran / akış | Bağlı testler (örnek) |
|---|-----|-------------------|------------|-------|--------------|------------------------|
| a1 | Kayıt tahsilatı yaz | `server/routes/workspace.mjs:394-439` (POST `/cases/:key/payments`, `bank.post` module payment) | Kayda (case_key) Kasa/Banka/POS tahsilatı; İşlem No, K7 eksi bakiye | YAZAR | Ekranda yok (düğme gizli `client/assets/hof-ui.css:2143-2148`, HTML `hof-workspace.js:1215` duruyor); API açık | 45 test dosyası / 159 çağrı (liste: not defteri `tablo-kopar/kayit-tahsilat-testleri.txt`); en çok `asama0-226.test.mjs` 32, `inceleme-226-2` 12, `banka-210-gg3-bag` 10, `cash.test` 9; mutabakat motoru `test/mutabakat/motor.mjs:1764-1791`, `test/guvenilirlik/rastgele.mjs:600`, cari kâhini sürücüsü `test/bagimsiz/cari/kos.mjs:253` |
| a2 | Kayıt tahsilatı düzelt / sil | `workspace.mjs:441-472` (PUT), `:473-503` (DELETE → Silinenler) | Eski tahsilatın tutar/tarih/yolunu değiştirir, siler | YAZAR | Kayıt kartı İşlem Geçmişi (`hof-workspace.js:336-381` editPayment) | aynı küme + `trash.test.mjs`, `silinenler-donem-kilidi-244` |
| a3 | Silinenler'den geri yükle | `server/routes/trash.mjs:355-392` | Silinmiş kayıt tahsilatını para satırı olarak geri yazar (bank.post restore) | YAZAR | Yönetim → Silinenler | `trash.test.mjs` |
| a4 | Kayıt tahsilatının para çekirdeğindeki yeri | `server/lib/bank/money-lines.mjs:35-36,94,128`; `integrity.mjs:42,97,118,171`; `integrity-scope.mjs:126,200`; `general-ledger.mjs:192` (**B 100/102/108 / A 602**, carisiz gelir); `routes/ledger.mjs:60`; `bank/pos.mjs:374,525,1372`; Kasa raporu kaynağı `routes/cash.mjs:2,186` | Kasa, Banka, POS, yevmiye/mizan, kapı (K11), dönem kilidi bu satırları sayar | (para satırı) | Kasa, Banka ve POS Hareketleri, Yevmiye, Mizan | `banka-210-*` (K6/K11), `defter-213`, `integrity*` |
| a5 | B1 bağ sürekliliği — tahsilat taşıma | `server/lib/dataset-bonds.mjs:450-464` (BOND_TABLES `payments money:true`), `:580-596` (payments.case_key UPDATE `bank.post` assign içinde) | Tablo yeniden yüklenince/eşitlenince kayıt tahsilatının anahtarını yeni satıra taşır; eşleşmezse onay ister | YAZAR (bağ) | Excel/Sheets yükle, Yerine Koy, Devamı, eşitleme, Veriyi Kaldır, Sayfayı Sil | `kayit-bag-31e.test.mjs`, `e2e/senaryo-kayit-bag-31e.mjs`, `banka-210-post-statik` (K6), `guvenilirlik/kimlik-bag-goc.mjs` |
| b | "Önce cari açın" Açılış Bakiyesi ön dolumu | `client/assets/hof-workspace.js:41-67` (satır 50: `openingBalance = target.debt`, kaynak `debtColumn`); `hof-accounts.js:807` | Kaydın carisi yoksa Yeni Cari formu tablo sezgisinin "Kalan Borç"uyla dolu açılır → kaydedilince cari açılış borcu (yevmiye B 120 / A 500/602 — `general-ledger.mjs:252` DOĞRULANMADI hangi dal) | ÖNERİR | Zil, Ödeme Sözü, Tahsilat Takvimi → Tahsilat Gir | `kalan-borc-ortak-30a`, `kalan-borc-satir-31d`, `tablo-borc-r31e`, 15 dosya `openingBalance` geçiyor |
| f | Zil / Ödeme Sözü / Takvim "Tahsilat Gir" tutar ön dolumu | `hof-workspace.js:249-279` (preset amount/note), `hof-alerts.js:279-287,394`, `hof-promises.js:137-140,166` | Cari tahsilat formu takvim kaleminin (tablo sezgisi) tutarıyla dolu açılır | ÖNERİR | Zil, Ödeme Sözleri, Takvim | `e2e/senaryo-kayit-tahsilat-244.mjs`, `senaryo-225*` |
| c | **Tablodan Aktar** | `server/routes/plan-transfer.mjs` (710 satır): ilkeler `:1-17`, yazım `:387-578`; cari açar `:476` (`createFromPlan`), kart + "Excel'de ödenmiş (açılış)" `:504`, kayıt tahsilatını karta taşır `:515-522`, carinin taksit dışı tahsilatını karta taşır `:524-536`, "Carinin Mevcut Borcu" (5b); geri al `:581-…`; `plans.mjs:1492-1521` (createScheduled, opening=1), `:1528-1547` (adoptPayment/adoptAccountEntry); istemci `client/assets/hof-plan-transfer.js` (366 satır) | Tablodaki SEZGİSEL plan/borç/ödenen sütunlarından cari + taksit kartı (= cari borcu; yevmiye `general-ledger.mjs:267` B 120 / A 602) + açılış (Kasa dışı ödenmiş) yazar; para satırlarını taşır | **YAZAR (en riskli)** | Taksitler → Tablodan Aktar (ön izlemeli, geri alınabilir) | 18 dosya `plans/from-table` (`plan-transfer.test.mjs`, `e2e/senaryo-tablodan-aktar.mjs`, 5a/5b testleri); cari kâhini kararları 1–12 (5a/5b) |
| c2 | Taksitler → Excel'den Yükle | `server/routes/plans.mjs:1012-1200` (açık eşleme `roles`; `linkRecords` `:1092` ile tablodaki kayda ad+telefonla bağ; açılış `:1180`) | Yüklenen dosyadan (dataset DEĞİL) kart + "Excel'de ödenmiş (açılış)" | YAZAR (modül içe alma, eşlemeli) | Taksitler → Excel'den Yükle | `plans*.test.mjs` (DOĞRULANMADI sayı) |
| d | Excel/Sheets'ten Cari Yükle (açılış bakiyesi) | `server/routes/accounts.mjs:1007-1018` (önizleme; roller başlıktan, tanınmazsa değerden `import-gate.mjs` inferRolesByValues), istemci `hof-accounts.js:1398-1503` "Kolonları Eşle" | Yüklenen dosyadan cari + açılış bakiyesi; dataset'e bağ YOK (2.0.18, `accounts.mjs:1004-1005`) | YAZAR (modül içe alma, eşlemeli) | Cari → Excel / Sheets'ten Yükle | `cari*`, `import-gate*` |
| e | API'de kayıt tahsilatı ucu | = a1/a2 | Ekransız; yalnız testler ve mutabakat/güvenilirlik üreticileri kullanıyor | YAZAR | — | a1 ile aynı |
| g | Tahsilat Takvimi / zil kalemi "kalan" | `server/routes/dues.mjs:30-64`; `server/lib/insight/case-collections.mjs:13-37` (payments + bağlı carinin `account_entries in` + kartın `plan_entries in`); `server/lib/insight/dues.mjs:374,490-511` (tahsilatları kalemlere vade sırasıyla dağıtır) | Tablo sezgisi borcundan program parasını düşer, kalemi "ödendi/kısmen" yapar | KARIŞTIRIR | Tahsilat Takvimi, zil, Ödeme Sözleri | `workspace/dues` 44 dosya (çoğu okuma), `dues.test.mjs` |
| h | Tablo Raporları | `server/routes/reports.mjs:21` (Tablodaki Kişiler/Vadeler/Nakit Akışı), `:80-118` (takvim omurgası), `:142` (payments + cari + kart tahsilatı), `:148` (Kasa satırları), `server/lib/reports.mjs:300-360` (cariEkstre: tablo borcu − program tahsilatı = "Bakiye"), `:447-499` (nakitAkis: "Beklenen" tablo + "Gerçekleşen" program + **Kasa giriş/çıkış/Net/Birikimli/Beklenenle Birlikte**) | Tablo tahmini ile Kasa'yı aynı tabloda toplar ("Beklenenle Birlikte" = Kasa birikimi + tablo beklenen) | KARIŞTIRIR | Raporlar → Tablo Raporları | 20 dosya (`rapor-tablodaki-kisiler-244`, `tablo-raporlari-u3-244`, `nakit-akis-kasa-mm6`, `raporlar-209`) |
| i | Anlık Durum → Nakit Akış Projeksiyonu | `server/routes/overview.mjs:361` (`table` varsayılan AÇIK), `:374-376` (tablo kalemleri beklenen GİRİŞ), `:455`, `:518-534` | Tablodaki ödeme günleri/sözleri; taksit, çek, fatura, Kasa ile aynı "Beklenen Giriş" ve "Dönem Sonu Tahmini Nakit ve Banka"ya girer | KARIŞTIRIR | Anlık Durum (yönetici) | `overview/(nakit|vade)` 25 dosya |
| j | Anlık Durum → Vade Takip "Tablo" kaynağı | `overview.mjs:493-505` | Tablo kalemleri muhasebe vadeleriyle tek listede | KARIŞTIRIR | Anlık Durum / Finans Raporları | aynı küme |
| k | Rapor Merkezi "Kayıt Tahsilatları" | `server/routes/report-center.mjs:2577-2604` | payments + kayda bağlı carinin tahsilatları | GÖSTERİR (para satırı) | Raporlar → Kayıtlar | 7 dosya `kayit-tahsilatlari` |
| l | Rapor Merkezi "Cari Bazında Tahsilat" — "Excel'den yüklenen önceden ödenmiş (açılış)" DAHİL | `report-center.mjs:1764-1795` | c/c2'nin açılış satırlarını tahsilat toplamına katar (CLAUDE.md "Raporlar" kararı 03.10.2026) | GÖSTERİR (karar) | Raporlar → Cari | `raporlar-*` |
| m | Kayıt kartı İşlem Geçmişi / Toplam Tahsilat | `workspace.mjs:327-362` (paidTotal = payments + kart + bağlı cari) | Kayıt kartında para toplamı | GÖSTERİR | Kayıt detay kartı | `workspace.test.mjs` |
| n | Personel performans "Tahsilat" | `workspace.mjs:669-705` (COLLECTED: payments ∪ plan ∪ cari) | Kişinin tahsilat toplamı | GÖSTERİR | Personel raporu | `workspace.test.mjs` |
| o | Kayıt bulgusu "tahsilatlar Toplam'ı aşıyor" | `server/lib/profile.mjs:427-445` (paymentChecks) | payments ↔ tablonun Kalan/Toplam ilişkisi | GÖSTERİR (uyarı) | Kayıt kartı bulguları | `reasoning.test.mjs` |
| p | Kayıt ↔ cari / kart bağı | `accounts.case_key/case_source` (`migrations.mjs:583-595`), `plans.case_key` (`:556-559`); bağ kurma `accounts.mjs:366-390`; B1 taşıması (BOND_TABLES accounts/plans) | Para yazmaz; a5/g/h/c'nin "kime sayılır" anahtarı | bilgi bağı | Kayıt kartı ↔ Cari | `kayit-bag-31e`, `cari-243` |
| q | Tablo borcu sezgisi (çekirdek) | `server/lib/insight/debt-column.mjs` (215 satır) → `dues.mjs:14,47,174-187,397`, `lib/reports.mjs:16,96,314`, `routes/reports.mjs:86`; sütun rolleri `insight/columns.mjs` (526), `insight/schedules.mjs` (293; c'nin kaynağı) | b, c, f, g, h, i, j'nin tutarını üretir | (kaynak) | — | `tablo-borc-e1-e2`, `tablo-borc-r31e`, `kalan-borc-*`, cari kâhini (3883 denetim; 70 karardan ~48'i tablo/borç/bağ/aktar/takvim kuralı) |
| r | Kâhin ve güvenilirlik | `test/bagimsiz/cari/model.py` (1497 satır; `kayitTahsilat`, 5a/5b, bağ sürekliliği 38–48), `test/mutabakat/motor.mjs`, `test/guvenilirlik/*` | Kayıt tahsilatını bir para işlem türü olarak üretir/doğrular | (test) | — | yukarıda |

Toplam: **etkilenen test dosyası birleşimi 115** (79 birim/API + 16 e2e + diğer; liste `tablo-kopar/etkilenen-testler.txt`). Bunların çoğu yalnız okur (takvim/rapor); beklentisi
gerçekten değişecek olan tahmini **40–60 dosya**, silinecek **10–15** (Tablodan Aktar, kayıt tahsilatı yazımı), yeni **10–15**.

Ek bulgular (envanter sırasında):
- **Taksit kartının yevmiyesi tablo sezgisinden**: Tablodan Aktar kartı `general-ledger.mjs:267` "Taksitli satış / hizmet" B 120 / A 602 → tablo sütun tahmini doğrudan
  **gelir** yazar (5b "Carinin Mevcut Borcu" hariç). Hedef kuralın en net ihlali.
- **Kayıt tahsilatı carisiz gelirdir** (`general-ledger.mjs:192`, A 602). Cariye taşımak (göç) defteri değiştirir (aşağıda §2.3).
- **Projeksiyon varsayılanı**: `overview.mjs:361` `table !== "0"` → kullanıcı kapatmadıkça tablo kalemleri nakit tahminine girer.
- Kayıt kartındaki Tahsilat düğmesi yalnız CSS ile gizli (`hof-ui.css:2146`); HTML ve sunucu ucu duruyor (2.4.4 bilinçli "koda dokunmadan").

---

## 2. HEDEF TASARIM (piyasa düzeni)

### 2.1 Piyasa nasıl yapıyor (genel bilgi; bu ortamda web'den doğrulanmadı)
Logo / Mikro / Netsis / Wolvox / QuickBooks / Xero: Excel **veri aktarımı** modül başına ayrı bir sihirbazdır — alan eşleme (kullanıcı seçer, program yalnız önerir),
ön izleme + hata listesi, **tek seferlik**; çıktısı kart (cari, stok) ya da **açılış / devir fişi**dir. Aktarım sonrası Excel'le bağ yoktur; sürekli eşitleme (Sheets gibi)
yalnız **CRM / ajanda** tarafında olur ve muhasebe kaydı üretmez. Hatırlatma/tahsilat takibi (vade, söz) muhasebe tarafında **cari ve taksit/vade kayıtlarından**
gelir; harici listeler "not / görev" düzeyindedir.

### 2.2 Tablo borcu sezgisi (debt-column.mjs vb.) — üç seçenek

| Seçenek | Ne olur | Artı | Eksi | Ertelenen başlık bulgularına etkisi |
|---|---|---|---|---|
| **A. Para yollarından çıkar, hatırlatmada sezgi aynen kalır** | b, c, f kalkar; g/h/i/j'de tablo tutarı "Tablodaki tutar (bilgi)" olarak ayrı kolon, muhasebe toplamlarına girmez | En az iş (sezgi kodu ve testleri olduğu gibi) | Hatırlatma tutarı yine yanlış tahmin edilebilir; kâhin/sezgi bakım yükü sürer | Para etkisi tamamen gider; görünüm hataları kalır (KISMEN) |
| **B. Sezgi yerine açık eşleme (ÖNERİ)** | Sekme başına bir kez "Hatırlatma Tutarı Sütunu" (+ isteğe bağlı Tarih / Kişi) kullanıcı seçer; program yalnız ÖNERİR (önceden seçili değil ya da "önerilen" etiketli); seçilmemiş sekmede tutar gösterilmez, yalnız tarih + kişi | Piyasa düzeni (eşlemeli içe alma); "program tahmin ediyor" sorunu kökten biter; debt-column.mjs'in Kalan/Toplam/söz/taahhüt/vergi önceliği zinciri sadeleşir (Kalan boşsa Toplam gibi tek bir kolon-içi kural kalabilir) | Bir kez eşleme ekranı + mevcut kurulumlarda ilk açılışta "sütunu seçin" ipucu; sezgi testlerinin bir kısmı öneri testine döner | Başlık/borç ailesi TAMAMEN çözülür (yanlış öneri kullanıcı onayından geçer) |
| **C. Tutar tamamen kalkar** | Takvim/zil yalnız tarih + kişi + hücrenin ham metni ("Ödeme Sözü: 1.500"); Tablo Raporları'ndan tutar ve toplam kalkar | En sade; sezgi kodu silinir | Kullanıcı tutar toplamını (Tablodaki Kişiler borç toplamı) kaybeder; geri adım gibi görünebilir | TAMAMEN (konu ortadan kalkar) |

Öneri: **B** (ilk adımda A ile aynı sürümde: para yolları kalkar + eşleme gelir). C, kullanıcı tablo toplamlarını hiç kullanmıyorsa daha ucuz.

### 2.3 Yol yol hedef

| # | Yol | Hedef | Not |
|---|-----|-------|-----|
| a1/e | Kayıt tahsilatı yaz (POST) | **KALKAR** (410 + "Tahsilat Cari'den girilir") | Ekranda zaten yok; kayıt kartındaki gizli düğme HTML'den de kalkar |
| a2 | Düzelt / sil | Düzelt **KALKAR**; Sil (→ Silinenler) **KALIR** (hatalı eski satırı kaldırabilmek için) | Karar K4c |
| a3 | Silinenler'den geri yükle | **KALIR** | veri kaybı olmasın |
| a4 | Para çekirdeğinde payments | **KALIR, değişmez** (Kasa, Banka, yevmiye A 602, kapı, kilit) | Para satırı olarak durur; yeni satır gelmez |
| a5 | B1 tahsilat taşıma | **Sadeleşir**: payments BOND_TABLES'tan çıkar, `case_title` anlık görüntüsüyle görünür (Kasa/rapor zaten case_title kullanıyor) → K6'daki `bank.post assign` kalkar. Notlar, telefon, görev, haciz, belge, cari/kart bağı (bilgi) KALIR | İsteğe bağlı; yapılmazsa B1 aynen çalışır (risk yok, yalnız gereksiz karmaşıklık) |
| b | Açılış Bakiyesi ön dolumu | **KALKAR**: alan boş; yanında "Tablodaki tutar: X (bilgi — muhasebe kaydı değil)" yazısı; düğmeyle aktarma YOK | "Tamamen" isteğine uygun; karar K5 |
| f | Tahsilat Gir tutar ön dolumu | **KALKAR**: tutar boş, açıklamaya kalem adı ("Eylül taksiti · tablodan") | Zil/Takvim yalnız Cari'yi açan kısa yol |
| c | Tablodan Aktar | **KALKAR** (yeni aktarım yok); ESKİ aktarımların **Geri Al**'ı KALIR (`plan-transfer.mjs:581-…`) | Yerine Taksitler → Excel'den Yükle (c2) |
| c2 | Taksitler → Excel'den Yükle | **KALIR** (eşlemeli, tek seferlik); tablodaki kayda ad ile bağ (`linkRecords`) bilgi bağı olarak kalır ya da kalkar (K6b) | Piyasa düzeni |
| d | Excel'den Cari Yükle + açılış bakiyesi | **KALIR** (piyasa düzeni). Sıkılaştırma: açılış bakiyesi sütunu yalnız başlık eşleşmesiyle ÖNERİLİR, değerden tahmin edilmez; ön izlemede açılış toplamı | DOĞRULANMADI: değerden tahmin edilen "amount" rolü (`import-gate.mjs` ~81) cari yüklemede bakiyeye dönüşüyor mu |
| g | Takvim / zil kalemi | **Hatırlatmaya indirgenir**: tutar "tablodan" etiketli; program parası kalemden düşülmez; kapanış "Ödendi Say / Tamamlandı" (elle) + bağlı carinin güncel bakiyesi yanında gösterilir (accounts.view ile; ör. "Carisi: 0,00 TL — kapalı") | Karar K1; `case-collections.mjs` dağıtımı kalkar |
| h | Tablo Raporları | Tablodaki Kişiler: "Tablodaki Tutar" + "Bağlı Cari / Cari Bakiyesi (muhasebe)" ayrı kolon, Alacak/Bakiye (tablo − program) kalkar; Tablodaki Vadeler: hatırlatma listesi; **Tablodaki Nakit Akışı KALKAR** (Kasa kolonları Kasa raporunda, beklenen tahsilat Anlık Durum'da modül verisinden) | Karar K2 |
| i/j | Projeksiyon / Vade Takip | Tablo kalemleri **ÇIKAR** (ya da ayrı "Tablodaki Hatırlatmalar (bilgi)" bölümü, toplama girmez) | Karar K3; yalnız muhasebe kaynakları |
| k | Kayıt Tahsilatları raporu | "Eski Kayıt Tahsilatları (2.4.4 ve Öncesi)" adıyla KALIR; cari tahsilatları kısmı Cari raporlarına bırakılır | |
| l | Cari Bazında Tahsilat "açılış dahil" | KALIR (c2'nin açılışı; tablo değil) — ya da kullanıcıya yeniden sorulur | Karar K10 |
| m/n/o | Kayıt kartı toplamı / performans / bulgu | m: kayıt kartı "Bağlı Cari Bakiyesi" (bilgi) + eski tahsilatlar salt okunur; n: payments eski veri olarak sayılmaya devam; o: KALKAR (yeni payments yok) | |
| p | Kayıt ↔ cari / kart bağı | **KALIR** (bilgi bağı: "Cariye Git" / "Kayda Git") | Para yazmaz |

**Yeni değişmez (teslimde kanıt):** "TABLO PARAYA DOKUNMAZ" — (1) statik: `server/lib/dataset*.mjs`, `server/lib/insight/**`, `routes/dataset|dues|reports|insight|workspace(tablo kısmı)`
para tablolarına ve `bank.post`'a yazamaz (K6 kalıbı); (2) çalışma anı: her tablo işlemi (yükle, Yerine Koy, Devamı, Sheets eşitle, Veriyi Kaldır, Sayfayı Sil, Ödendi Say, hücre
düzeltme) öncesi/sonrası para tabloları + cari bakiyeleri + mizan özeti bayt bayt aynı.

### 2.4 Mevcut müşterilerdeki eski kayıt tahsilatları (payments.case_key)

| Yol | Nasıl | Veri kaybı | Bağ bulunamayan | Geri alma | Defter / mutabakat |
|---|---|---|---|---|---|
| **DONDUR (ÖNERİ)** | Satırlar olduğu gibi kalır (Kasa/Banka/yevmiye A 602 aynı); yalnız yeni giriş ve düzeltme kapanır; kayıt kartında ve "Eski Kayıt Tahsilatları" raporunda salt okunur; açılışta bir kez bilgi: "N eski kayıt tahsilatı (X TL) Kasa'da duruyor; yeni tahsilat Cari'den" | Yok | Sorun değil: `case_title` anlık görüntüsüyle görünür (bağ koparsa kayıt kartında görünmez, raporda görünür) | Gerekmez (hiçbir şey taşınmaz) | Değişmez → mutabakat/kâhin sayıları aynı kalmalı (en güçlü kanıt: v2.4.4 gerçek koduyla üretilmiş veride önce/sonra eşitlik) |
| Devirle tasfiye (dondurmanın doğal sonucu) | Devir kesiminde kesime kadarki kayıt tahsilatı yeni yıldan silinir, Kasa açılışı kapsar (`docs/devir/DEVIR-PLANI.md:103`); eski yıl salt okunur arşivde | Yok (eski yıl arşivi) | — | Devirin kendi geri dönüşü | Devir planındaki gibi |
| İsteğe bağlı "Cariye Bağla" göçü | Kullanıcı satır satır ya da kişi kişi cari seçer → payments satırı `bank.post op move` ile cari satırına taşınır (event_id, yol, banka/POS bağı, giren, zaman korunur — `plans.mjs:1528-1547` adoptPayment kalıbı). Cari bakiyesi bozulmasın diye aynı tarih/tutarla **"Borç Yaz" (A 602) + tahsilat** çifti: 602 toplamı ve Kasa aynı, 120'de devir hızı artar (net 0) | Yok (geri alma kaydı) | Bağ bulunamayan / kullanıcının seçmediği → DONDUR kuralı | Tek işlemde geri alma tablosu (plan_imports kalıbı); kilitli dönemdeki satır taşınmaz | Yevmiye madde sayısı ve 120 hareketi DEĞİŞİR (mizan bakiyeleri aynı) → defter kâhini + mali müşavir turu şart |

Öneri: **DONDUR** + devirle tasfiye; "Cariye Bağla" yalnız müşteri isterse (K4b). Gerekçe: piyasa programları geçmiş hareketi yeniden kaydetmez, açılış/devirle taşır; dondurma defteri
ve mutabakatı hiç değiştirmez.

---

## 3. TAHMİN — iş paketleri

Efor sınıfı CLAUDE.md "AJAN EFORU"na göre. Satır sayıları kaba (kod okumasından), ± %40.

| P | Paket | Dosyalar | ~Değişen satır | Testler (yeni / değişen / silinen) | Risk | Efor | Süre |
|---|---|---|---|---|---|---|---|
| P0 | D0 + **KÂHİN ÖNCE**: karar metni (K1–K11), plan belgesi; cari kâhininin tablo/para kurallarının karar metninden yeniden yazımı (kodu görmeyen ajan) | yeni `docs/tablo/…PLAN.md` (BELGE_YOLLARI'na eklenmeli), `test/bagimsiz/cari/model.py` (~70 karardan ~48'i tablo/borç/bağ/aktar/takvim), `KARARLAR.md`, `BILINEN.json` | Python 600–900 | kâhin senaryoları ~10 yeni, 5a/5b ve takvim-düşme senaryoları çıkar | ORTA | [XH] | 0,5–1 gün |
| P1 | Kayıt tahsilatı yazımını kapat (a1/a2/e) | `routes/workspace.mjs` (~80–120), `hof-workspace.js` (~60–100, düğme + editPayment), `hof-ui.css` (gizleme kalkar), `permissions.mjs` (payments.create anlamı), trash/money-lines/GL/integrity DEĞİŞMEZ | 150–250 | **45 dosya / 159 çağrı**: eski tahsilatı "eski sürüm verisi" olarak kuran yardımcı (v2.4.4 gerçek koduyla üretilmiş fikstür ya da test-içi yazıcı) ya da cari tahsilatına çevrilir; mutabakat motoru / rastgele / cari kâhini sürücüsünden işlem türü çıkar; K6 izinli listesi daralır | **YÜKSEK** (para çekirdeği testleri, K6/K11, mutabakat çeşitliliği) | [XH] | 1,5–2 gün |
| P2 | Ön dolumları kaldır (b, f) | `hof-workspace.js:41-67,249-279`, `hof-alerts.js`, `hof-promises.js`, `hof-accounts.js` | 60–120 | e2e `senaryo-kayit-tahsilat-244`, `senaryo-225*`, `run.mjs` adımları; `kalan-borc-*` ön dolum beklentileri | DÜŞÜK-ORTA | [H] | 0,5 gün |
| P3 | Tablodan Aktar kalkar (c), eski aktarımların Geri Al'ı kalır | `routes/plan-transfer.mjs` (710 → ~150), `hof-plan-transfer.js` (366 → ~60), `plans.mjs` (adoptPayment/adoptAccountEntry/coversBalance yalnız geri alma için), menü/Başlarken | silinen 800–1.000 | 18 dosya `plans/from-table` (çoğu silinir), `e2e/senaryo-tablodan-aktar` → yalnız Geri Al; ders 9: geri alma + yedekten dönüş + Silinenler yolları | ORTA | [XH] | 1 gün |
| P4 | Takvim / zil / Tablo Raporları / Projeksiyon hatırlatmaya indirgenir (g, h, i, j) + Seçenek B eşleme | `routes/dues.mjs`, `insight/case-collections.mjs` (kalkar ya da yalnız "bağlı cari bakiyesi"), `insight/dues.mjs` (dağıtım kalkar), `routes/reports.mjs`, `lib/reports.mjs` (nakitAkis kalkar, cariEkstre sadeleşir), `routes/overview.mjs` (tablo kalemleri çıkar), `debt-column.mjs` (B ile sadeleşir), istemci rapor/takvim/zil, eşleme ekranı | 600–1.000 | `workspace/dues` 44, rapor 20, overview 25 dosya → ~25–35'inde beklenti değişir; yeni: eşleme, "toplama girmez", yetki | **YÜKSEK** (en görünür; ders 10 komşular, ders 37 bütün e2e) | [XH] | 2 gün |
| P5 | B1 sadeleşmesi (a5) — isteğe bağlı | `dataset-bonds.mjs` (~60–100), BOND_LABELS, uyarı metni | 60–100 | 4 dosya (`kayit-bag-31e`, K6 statik/çalışma anı) | ORTA | [H] | 0,5 gün |
| P6 | Eski kayıt tahsilatları: dondur + görünürlük (k, m, n, o) | `report-center.mjs:2577-2604`, `workspace.mjs:327-362`, `profile.mjs:427-445`, Başlarken/Anlık Durum bilgi satırı | 80–150 | ~6 dosya | ORTA | [XH] | 0,5 gün |
| P6b | (İSTEĞE BAĞLI) "Cariye Bağla" göçü | yeni modül + bank.post op move + geri alma | 400–700 | ~10 yeni (kırmızı/yeşil, mutasyon, kilitli dönem, geri al, defter kâhini) | **YÜKSEK** | [XH] | +1,5–2 gün |
| P7 | Yeni değişmez "TABLO PARAYA DOKUNMAZ" (statik + çalışma anı) | yeni test(ler) | 200–300 test | 2–3 yeni | DÜŞÜK | [H] | 0,5 gün |
| P8 | Kılavuz, sürüm notu, Başlarken metinleri | `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html` (12 geçiş: Tablodan Aktar, Tahsilat Takvimi, Tablodaki…, Tahsilat Gir), ekran görüntüleri, CHANGELOG, `docs/<s>-DEGISIKLIKLER.md` | — | belge testleri, pdf-denetle | DÜŞÜK | [M] | 0,5 gün |
| P9 | Doğrulama: göç (v2.4.4 gerçek koduyla üretilmiş veri: kayıt tahsilatları + Tablodan Aktar kartları + açılışlar → yeni sürüm; Kasa, Banka, mizan, cari bakiyeleri önce/sonra EŞİT), bağımsız turlar (kâhin, mali müşavir, yargıç, eleştirmen, UI/UX, dar kontrol), tam kapı (~3 sa) + Uzun Doğrulama (~6 sa) + windows.yml ×2 | — | — | — | — | [XH] | 2–3 gün |

**Toplam:** silinen ~1.200–1.800 satır, değişen ~1.000–1.700 (sunucu + istemci), test 40–60 dosya değişir / 10–15 silinir / 10–15 yeni. Geliştirme 7–9 iş günü
(P1 ∥ P3 ∥ P2, sonra P4; P0 önce) → **4–6 takvim günü**; doğrulama 2–3 gün → **toplam 6–9 takvim günü, 6–10 aday turu**. P6b seçilirse +1,5–2 gün, +2–3 aday.

### 3.4 Sürüm ve sıra
- **Ayrı sürüm.** Özellik kaldırıyor (Tablodan Aktar, Tablodaki Nakit Akışı, kayıt tahsilatı düzeltme) → sürüm numarası olarak **2.6.0** önerilir (2.5.x yama gibi
  görünmesin). Kullanıcı "2.5.5" dedi → netleştirilecek.
- **Devir (2.5.0) önce.** Devir Ocak–Şubat'ta kullanılır, Aralık başı yayında olmalı (CLAUDE.md). Devir planı `payments`, `plan_entries.opening`, Tablodan Aktar kartlarını
  sınıflıyor (§3, test 16 "şemadaki her tablo sınıflamada") → koparma devir D0'dan önce girerse sınıflama iki kez değişir. Devir sonrası koparma: dondurulan kayıt tahsilatları
  ilk devirde zaten tasfiye olur (§2.4).
- Çakışma noktaları: devir kâhini (D0) ile cari kâhininin (P0) aynı tablolara bakması — ayrı ajanlar, ayrı karar metinleri; `general-ledger.mjs` (devir açılış fişi ↔ P6b) ;
  `plans.mjs` createScheduled (devirde taksit açılışı ↔ P3).
- Ara çözüm (isteğe bağlı, 2.5.0 içinde, ~0,5 gün [H]): yalnız **Projeksiyon varsayılanı kapalı** (`overview.mjs:361`) ve **Tablodan Aktar'a "tablodan tahmin; muhasebe
  kaydı yazar" uyarısı** — en büyük iki riski hemen küçültür, mimariyi değiştirmez.

---

## 4. ERTELENENLER — koparmayla kendiliğinden çözülür mü?

Kaynak: `docs/2.4.4-IS-LISTESI.md` "SONRAYA (2.5.0 …)", "2.5.0 adayı", DONDURMA, BİLİNEN SINIR, BAŞ MİMAR KARARLARI; `is/teslim-244b:docs/2.4.4-DEGISIKLIKLER.md`
"Sonraki sürüme (2.5.0)" ve "BİLİNEN SINIRLAR". "A" = yalnız koparma (Seçenek A), "B" = koparma + açık eşleme.

### 4.1 Ana tablo — 2.4.4'te bulunup ertelenen bulgular

| # | Bulgu | Kaynak | A ile | B ile | Neden (kod) |
|---|---|---|---|---|---|
| 1 | Yalnız ödenen sütunlu ("Tahsil Edilen") sekmede borç sütunu da not da yok, kişiler notsuz düşer | DONDURMA, iş listesi 427 | KISMEN | TAMAMEN | Borç artık Açılış Bakiyesi'ne/karta gitmez (b, c kalkar); görünümde sezgi sürer (`debt-column.mjs`). B'de tutar sütununu kullanıcı seçer |
| 2 | Söz kolonlu sekmede söz olmayan "Son Ödeme" kalemi tutarını söz tutarından alıyor | 31e tur 13 (1) | KISMEN | TAMAMEN | Zil ön dolumu (f) kalkınca paraya geçmez; takvimde yanlış tutar görünür (`insight/dues.mjs:47,174-187`) |
| 3 | Borç kalıpları ek almış biçimleri ("Bakiyesi", "Alacağı") tanımıyor | 31e tur 13 (2) | KISMEN | TAMAMEN | Aynı sezgi zinciri; B'de kalıp tanıma yalnız öneri |
| 4 | Tek tutar sütunu yalın "Ödeme Sözü" sekmede kalem boş, "borç sütunu yok" notu çıkmıyor | 31e tur 13 (3) | KISMEN | TAMAMEN | Sezgi kararı; para etkisi yok olur |
| 5 | Bilgi sekmeleri (rehber) her raporda "borç sütunu yok" notu alıyor | 31e tur 13 (4) | TAMAMEN | TAMAMEN | Ajanda modelinde tutarsız sekme normaldir; not, borç tahmininin yan ürünü (`routes/reports.mjs:167` tableNotes) → kalkar |
| 6 | "Kalan Taahhüt Süresi" (ay sayısı) seyrek Kalan Borç sayılıyor (Kişiler'de 12 TL) | 31e tur 14, 2.5.0 adayı | KISMEN | TAMAMEN | Kişiler'de bilgi hatası kalır; Açılış Bakiyesi'ne gitmez |
| 7 | "Sözleşme Bitiş" tutarsız Yaklaşan satırı açıyor | aday 22 kararı | HAYIR | HAYIR | Tarih/son tarih motoru (`computeDeadlines`) — ajandanın asıl işi, kalır; [M] ~0,25 gün |
| 8 | "Taahhüt Bakiyesi" Kalan sayılmaz → borç seçilemez, Kişiler'de yok, Açılış Bakiyesi boş, takvim kalemi aylık ücretten (BİLİNEN SINIR, kâhin 11 kayıt) | BİLİNEN SINIR | KISMEN | TAMAMEN | "Açılış Bakiyesi boş" kısmı anlamını yitirir (ön dolum yok); takvim tutarı A'da yanlış kalır. Kâhin `BILINEN.json` 11 kaydı yeniden yazılır (P0) |
| 9 | N7: kişi kolonu olmayan tabloda bağ uyarısındaki "ad" ilk hücre ("eşleşmedi: 1000.") | SONRAYA 2.5.0 DÜŞÜK | HAYIR | HAYIR | B1 uyarı metni (`dataset-bonds.mjs` personName) notlar/cari bağı için sürer; P5 yapılırsa uyarıdan "tahsilatı" türü düşer. [M] ~0,25 gün |
| 10 | Aynı kimlikli farklı yazımlı ad ("A. Can Er" / "Can Er") iki kişi | SONRAYA 2.5.0 DÜŞÜK | KISMEN | KISMEN | Para etkisi (Tablodan Aktar'da iki cari) kalkar; Tablodaki Kişiler gruplaması ve B1 eşleşmesi (bilgi) sürer. [H] ~0,5 gün |
| 11 | B1–N6 sınırları: kişi kolonu olmayan tabloda her eşitlemede onay; 2.4.3'te kopmuş bağlar geri gelmez; aynı adlı kişi kayınca/ad değişince bağ taşınmaz; adı alan başka satıra gider; Dosya No'lular arası taşınmaz; Veriyi Kaldır/Sayfayı Sil iki soru; bekletilen eşitleme kendiliğinden yeniden denenmez | BİLİNEN SINIR | KISMEN | KISMEN | Sınırlar aynen kalır ama ağırlığı düşer: yanlış bağ artık PARAYI başka kişiye yazmaz (P5 ile payments bağ değildir), yalnız not/cari bağı; onay sıklığı aynı. "Kopmuş bağlar geri gelmez" HAYIR |
| 12 | A2: Tablodaki Kişiler Sekme süzgecinde iki sekmede aynı dosya no'nun tahsilatı öbür sekmenin kaydına yazılabilir | BİLİNEN SINIR | TAMAMEN | TAMAMEN | Raporda program tahsilatı olmaz (`lib/reports.mjs:300-360` attached/paid kalkar) |
| 13 | A4: "Taksit Sayısı / İlk Taksit Tarihi" sütunlu tabloda kalan borcun tamamı ilk taksit gününe | BİLİNEN SINIR | KISMEN | KISMEN | Tablodan Aktar kalkınca karta yanlış dağılım riski biter; takvimde hatırlatma günü aynı kalır (`insight/schedules.mjs`) |
| 14 | Zil birden çok sekme notunu göstermez; uyuşmazlık notunda dosya no iki notta | BİLİNEN SINIR (31e rapor) | KISMEN | KISMEN | Notların çoğu borç bölüşümünden (debtSplit) gelir; B'de sadeleşir; zil gösterimi ayrı iş |
| 15 | Ay kolonlu / aylık ödemeli tabloda Açılış Bakiyesi boş gelir | BİLİNEN SINIR | TAMAMEN | TAMAMEN | Ön dolum kalkar (b) |
| 16 | 5a kartı aşan tahsilat bölünmez; faturalı/şüpheli cari eşleştirmeye girmez | BİLİNEN SINIR | TAMAMEN | TAMAMEN | Tablodan Aktar kalkar (c) |
| 17 | Tablodan Aktar 5a/5b'de POS, çek/senet, dövizli tahsilat; bağ bekleyen kayıtlar DENENMEDİ | DENENMEYEN | TAMAMEN | TAMAMEN | Özellik kalkar |
| 18 | Tek tutar sütunu kalem tutarıysa Açılış Bakiyesi ön dolumu boş (31e rapor; kısmen düzeltildi) | BİLİNEN SINIR | TAMAMEN | TAMAMEN | Ön dolum yok |
| 19 | Göç verisinde yok: borç sekmesinde aynı Dosya No'lu satır, Kalan'sız Toplam + Ödenen, Kasa yetkisiz kullanıcı (Nakit Akışı) | DENENMEYEN | KISMEN | KISMEN | Kasa yetkisiz Nakit Akışı kolonları: Tablodaki Nakit Akışı kalkarsa TAMAMEN; öbür ikisi hatırlatma görünümünde kalır |
| 20 | BAŞ MİMAR (1) aynı içerikli satır onaysız; (2) Devamı'nda güvenli eşleşme güncelleme; (3) çok satırlı kişi konumla eşleşmez | GG6 / ders 40 | HAYIR | HAYIR | B1 bağ kuralları (bilgi bağı için) sürer; para riski kalkar → gözden geçirme aciliyeti düşer |
| 21 | BAŞ MİMAR (4) satır borcu belirlenemeyen satırda takvim kalemi dönem tutarı | GG6 | KISMEN | TAMAMEN | Hatırlatma tutarı kuralı; B'de kullanıcı sütunu |
| 22 | BAŞ MİMAR (5) aylık ücret Açılış Bakiyesi sayılmaz | GG6 | TAMAMEN | TAMAMEN | Ön dolum yok |
| 23 | Kâhin yorumları (6)–(10): yalın "Ödeme Sözü"/"Söz" para kolonu değil; "Taahhütlü Ücret" normal; söz tutarlı sekmede not; "Tutar"+"Söz Tutarı" → Tutar borç; söz tarihsiz düz vade | GG6 | KISMEN | TAMAMEN | Hepsi sütun sezgisi yorumu; A'da görünümde sürer, B'de öneriye iner |
| 24 | Kayıt formundaki Banka Hesabı seçici e2e denetimi kalktı; boş geçmiş metni ekranda denenmedi | DENENMEYEN | TAMAMEN | TAMAMEN | Kayıt tahsilatı formu tamamen kalkar (P1) |
| 25 | Tablo yeniden yüklenince kayıt bağları ekrandan + gerçek Sheets eşitlemesiyle denenmedi (elle kabul önerisi) | DENENMEYEN | KISMEN | KISMEN | Para bağı kalkınca kabulün kritikliği düşer; notlar/cari bağı için yine önerilir |

Özet: 25 kalemden **A ile** TAMAMEN 9, KISMEN 12, HAYIR 4; **B ile** TAMAMEN 15, KISMEN 6, HAYIR 4.

Kalanların ayrı tahmini (koparmadan bağımsız, aynı sürüme alınırsa):
- HAYIR olanlar: 7 "Sözleşme Bitiş" [M] 0,25 gün · 9 N7 [M] 0,25 gün · 20 bağ kuralları (karar; kod yok) · 11'in "kopmuş bağ geri gelmez"i (yapılmaz, 2.4.3 verisi) → ~0,5 gün.
- KISMEN kalanlar A seçilirse (başlık ailesi 1–4, 6, 8, 21, 23): tek tek düzeltme [H] ~3 gün + her biri kâhin turu; **B seçilirse bu iş P4'ün içinde (~1 gün ek)** → B daha ucuz.
- 10 "A. Can Er" [H] 0,5 gün; 13 A4 [H] 0,5 gün; 14 zil notu [M] 0,25 gün.

### 4.2 Tablo dışı — koparmadan ETKİLENMEZ (CLAUDE.md "SONRAYA (2.4.5+)" ve 2.5.0 listesinin tablo dışı kısmı)

| Madde | Etkilenir mi | Kaba tahmin |
|---|---|---|
| MM1 cari "Stopaj Yapar" | Hayır | [XH] ~1 gün |
| MM2 KDV mahsubu yapılmış ayda iptal uyarısı | Hayır | [H] ~0,5 gün |
| MM9, MM12 | Hayır (içerik bu okumada bulunamadı — DOĞRULANMADI) | ? |
| 30.000 TL nihai tüketici sınırı | Hayır (mali müşavir kararı bekliyor) | karar sonrası [H] |
| EDM'den numara eşitleme (geri yüklemeden sonra) | Hayır | [XH] ~1–1,5 gün |
| Seçilenleri Gönder'e Silinenler belgesi (API) | Hayır | [H] ~0,5 gün |
| Kalıcı dönem kilidi özeti + invoices / vat_offsets kapıya | Hayır | [XH] ~1,5–2 gün |
| Yapışkan TOPLAM satırları, dar pencereler, ad/yazım, UI11 küçükleri | Hayır (Tablodaki Nakit Akışı kalkarsa onun TOPLAM'ı da gider) | [M] ~1 gün |
| 33 e2e pencere seçicisi (7d sonrası), altın test m6 | Hayır (Tablodan Aktar e2e'si silinirse 1 dosya azalır) | [M] ~1 gün |
| Ölçek koşusu (30 kullanıcı, 1.000.000 satır) | Hayır | koşu ~1 gün |
| Kısmen ödenmiş e-SMM etiketi, 2.4.3 Nihai Tüketici yanlış cari, izsiz "gönderiliyor" belge, G1 eski veri, e-SMM test görüntüsü | Hayır | — (bilinen sınır) |

---

## 5. KÖR NOKTALAR

1. **Bugün tablo tahsilatı kullanan kurulumlar**: kaç müşteride `payments` satırı olduğu BİLİNMİYOR (müşteri verisine erişilmez). Göç yerine dondurma bu yüzden güvenli:
   satırlar Kasa'da ve defterde aynen kalır. Sürüm açılışında sayıyı kullanıcıya söyleyen tek seferlik bilgi (N satır, X TL) önerilir; isterse operatör tarafında lisans
   olaylarıyla (yalnız sayı, içerik değil) ölçülebilir — ayrı karar.
2. **Tablodan Aktar'ı kullanan müşteri** yeni kişiler için "Taksitler → Excel'den Yükle"ye yönlendirilmeli; eski aktarımların Geri Al'ı korunmazsa veri kaybı olur (P3'te şart).
3. **Defter etkisi**: dondurma defteri değiştirmez; "Cariye Bağla" (P6b) seçilirse 120 hareketi ve madde sayısı değişir — mali müşavir onayı ve defter kâhini gerekir.
4. **Kullanıcı alışkanlığı**: zil/takvimden "Tahsilat Gir"de tutarın dolu gelmemesi bir tık fazlalık; piyasa düzeninin bedeli. Açıklamada kalem adı korunursa kayıp küçük.
5. **Hatırlatma ≠ alacak**: Takvimin "kalan"ı artık program tahsilatını düşmezse ödenmiş kişi takvimde "bekliyor" görünür → K1'de "bağlı carinin bakiyesi 0 ise
   Carisi Kapalı" etiketi ya da elle Ödendi Say şart; yoksa yanlış arama/hatırlatma riski (eski şikâyet "ödemiş kişi Takvim'de gecikmiş").
6. **Mutabakat çeşitliliği**: kayıt tahsilatı mutabakat motorunun ve rastgele testin bir para türü; çıkınca kapsam daralmamalı — yerine eski sürüm verisinden gelen dondurulmuş
   satırların değişmezliği (sil/geri yükle/kilit) testleri girer (ders 17).
7. **Sürüm notu** (kısa): "Excel / Sheets tablosu artık yalnız bilgi ve hatırlatma kaynağı: tahsilat, açılış bakiyesi ve taksit kartı Cari ve Taksitler'den girilir. Tablodan
   Aktar kalktı (yeni kişiler için Taksitler → Excel'den Yükle). Eski sürümde kayıt kartından girilmiş tahsilatlar Kasa'da ve raporlarda olduğu gibi duruyor."
   Ayrıntı belgesinde: kaldırılan ekranlar, Nakit Akış Projeksiyonu'nun artık tablo kalemlerini içermemesi (toplam değişebilir — kullanıcı bunu "para kayboldu" sanabilir).
8. **Kılavuz**: `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html` 12 geçiş (Tablodan Aktar, Tahsilat Takvimi, Tablodaki…, "önce cari açın", Tahsilat Gir); yeni hap bölüm
   "Tablo ile Muhasebe Ayrımı" (tablo hatırlatır, para Cari'den) + site kılavuz PR'ı.
9. **Projeksiyon toplamı değişecek**: i kalkınca "Dönem Sonu Tahmini Nakit ve Banka" düşer; sürüm notunda açıkça söylenmeli.
10. **Excel'den Cari Yükle'deki değer tahmini** (d): hedef kurala göre açılış bakiyesi sütunu değerden tahminle seçili gelmemeli — kodda DOĞRULANMADI, P0'da okunmalı.

---

## 6. AÇIK KARARLAR (ürün sahibine)

- K0 Sürüm numarası ve sıra: devirden (2.5.0) sonra ayrı sürüm — "2.6.0" mı "2.5.5" mi? Ara çözüm (Projeksiyon varsayılanı kapalı + Tablodan Aktar uyarısı) 2.5.0'a girsin mi?
- K1 Takvim/zil kalemi nasıl kapanır: (a) yalnız elle "Ödendi Say"; (b) bağlı carinin bakiyesi ≤ 0 ise "Carisi Kapalı" etiketi (öneri: b + a); program tahsilatı kalemden düşülmesin mi (öneri: düşülmesin).
- K2 Tablo Raporları: Tablodaki Nakit Akışı kalksın mı (öneri: evet); Tablodaki Kişiler'de "Cari Bakiyesi" ayrı kolon olarak gösterilsin mi (öneri: evet, yetkiyle).
- K3 Anlık Durum Projeksiyon/Vade Takip'ten tablo kalemleri: tamamen çıksın mı, ayrı "bilgi" bölümü mü (öneri: ayrı bölüm, toplama girmez)?
- K4 Eski kayıt tahsilatları: (a) DONDUR (öneri); (b) isteğe bağlı "Cariye Bağla" aracı da yapılsın mı; (c) eski satır silinebilsin mi (öneri: evet, Silinenler'e), düzeltilebilsin mi (öneri: hayır).
- K5 "Önce cari açın": Açılış Bakiyesi tamamen boş mu (öneri), yoksa "tablodaki tutarı yaz" düğmesi (açık kullanıcı eylemi) mi?
- K6 Tablodan Aktar kalksın mı (öneri: evet, eski aktarımların Geri Al'ı kalır); K6b Taksitler → Excel'den Yükle'nin tablodaki kayda ad ile bağı (`plans.mjs:1092` linkRecords) kalsın mı (bilgi bağı)?
- K7 Tablo borcu sezgisi: Seçenek A / **B (öneri)** / C (§2.2).
- K8 Excel'den Cari Yükle açılış bakiyesi: kalsın (piyasa düzeni) — açılış sütunu yalnız başlıktan önerilsin, değerden tahmin edilmesin (öneri).
- K9 B1'den kayıt tahsilatı bağının çıkarılması (P5) yapılsın mı (öneri: evet; sadeleşme).
- K10 Cari Bazında Tahsilat'ta "Excel'den önceden ödenmiş (açılış)" dahil kararı (03.10.2026) aynen mi?
- K11 Mevcut kullanıcılara açılışta tek seferlik bilgi (eski kayıt tahsilatı sayısı/tutarı) gösterilsin mi?

Ek dosyalar (not defteri): `kayit-tahsilat-testleri.txt` (45 dosya), `etkilenen-testler.txt` (115 dosya), `test-*.txt` (kavram başına test listeleri).
