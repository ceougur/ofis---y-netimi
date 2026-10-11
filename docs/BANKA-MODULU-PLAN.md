# Banka + POS Modülü: Uygulama Planı (Sürüm 3, Baş Mimar Kararlarıyla, Denetim 2 Sonrası)

> **Kaynaklar:** `docs/BANKA-MODULU-TALIMAT.md` (45 madde, 5 ek ve son paragraf), mimari analiz (`banka-analiz.md`, ELEŞTİRMEN bölümü dahil), ilk taslak plan, iki eleştirinin 43 açığı (Ek C), baş mimar kararları K1–K13 ve plan denetimi 2'nin bulguları (Ek D).
>
> **Sürüm 3'te değişenler.** Denetimde açık kalan 4 madde, 17 yeni sorun ve K9'daki 3 eksik kapatıldı. Her birinin nerede kapandığı Ek D'de. Özetle:
> - Bankaya Tahsile Ver artık `cheque_events`'e yazmıyor; iz yalnız `cheque_collections` ve `fin_events`'te (§3.14).
> - KDV kesintisi `payPay` rolünü "yalnız bağlı" kipte alıyor (§4.3).
> - Ekstre puanlamasına sistem fişleri için bileşen eklendi (§3.13).
> - 13b'de iki yönde de TCMB döviz alış kuru kullanılıyor; ödemede ortalama maliyet ve gerçekleşen kur farkı yazılıyor (§3.12).
> - Toplu fatura kesimi belge başına ayrı işlemde kalıyor (§3.3).
> - Çalışma anı denetimi artık satır düzeyinde yapılıyor (§3.3).
> - Fatura iptalinde POS kuralı tek ve tutarlı (§3.8, §4.6).
> - K8'in işlem türüne göre kapsamı ve `motor.mjs` güncellemesi yazıldı (§3.10, §11.4).
> - Benzer İşlem yalnız hesaba bağlı satırlara uygulanıyor.
> - `dates:future` küçülme kilidi Aşama 0'a alındı (A13).
> - Cari kilit izi borç/alacak satırlarını ve cari türünü kapsıyor.
> - Kabul testinin 30, 34 ve 37. adımları düzeltildi.
>
> **Satır numaraları HEAD `8cbadfd` üzerinde koddan yeniden doğrulandı.** Denetim 2 için ayrıca bakılan yerler:
> - `cheque_events.kind` CHECK: `migrations.mjs:729`
> - `classifyLine`: `invoice-settle.mjs:55-92`; havuz: `:162-200`; bağlı kapama: `:262-266`
> - `taksit-tahsil`: `motor.mjs:845`
> - `payments-exceed`: `routes/plan-transfer.mjs:158`
> - `extra`: `lib/plans.mjs:111`
> - toplu kesim: `invoices.mjs:1918-1950`
> - `DATED` ve `dates:future`: `integrity.mjs:58, 255-262`; imza ve taban: `:273, 314-331`
> - çek tarihi: `cheques.mjs:249`
> - `FINANCIAL`/`WRITE`: `db.mjs:27-28`
> - sıfırlama DELETE'leri: `app.mjs:536-546`
> - `rows()` silinmiş cariyi düşürüyor: `routes/ledger.mjs:18-23`
> - cari tür değişikliği: `accounts.mjs:451`
> - Kasa bugün toplamları: `cash.mjs:63-90`
>
> Önceki sürümden kalan yerler: göç koşucusu `migrations.mjs:1113-1132`, Kasa'nın Silinenler yazımı `cash.mjs:304`, `adoptPayment` `plans.mjs:1295-1302`, Taksite Aktar geri alma `plan-transfer.mjs:440-443`, `queryOf` `report-center.mjs:1388-1396`, `SELECTS` `hof-report-center.js:48-58`, `motor.mjs:131-134`.
>
> **Kod yazılmadı, depo değişmedi.** Tek deneme: A12 (dönem kilidi varken "Tüm Hareketleri Sil") geçici bir test sunucusunda yeniden üretildi; sonuç 409 `ledger-integrity` / `period-lock`.

## Özet: Kesin Kararlar

| # | Karar | Özü | Yer |
|---|---|---|---|
| M1 | Kayıt mimarisi | Para tek yerde tutulur. Modül satırı (cari, fatura peşini, taksit, kayıt tahsilatı, stok, çek, Kasa↔Banka) bugünkü tablosunda kalır; `fin_ref` (hesap / POS / kurumsal kart) ve `event_id` (İşlem No) alır. Bankanın doğurduğu olaylar Banka Fişi'ne yazılır (`fin_events` + `bank_lines`). `fin_events` ayrıca kapının doğruladığı salt okuma kopyalarını taşır; bunlar para kaynağı değil, dizindir. | §3.1 |
| K1 | Para saklama | Yeni tablolar STRICT'tir: tutar INTEGER kuruş, oran INTEGER ppm, kur INTEGER 1e-6; hesap BigInt ile. Mevcut REAL kolonlar bu projede değişmez, kuruş kesinliğini kapı zorunlu tutar. Talimat Ek 1'den bilinçli sapma; ayrı proje olarak Aşama 17. Gölge kolon yok. | §5.1, Aşama 17 |
| K2 | Vergi | Banka masrafı ve banka POS'u komisyonunda BSMV %5 (KDVK 17/4-e). Ödeme kuruluşu ve sanal POS sağlayıcısında KDV %20 (191, masraf faturasıyla). Varsayılanı POS kartındaki "Sağlayıcı Türü" belirler. Her POS'ta ve her masraf formunda BSMV / KDV / Yok seçilir; Dahil/Hariç ayrıca seçilir. Gider hesabı vergi kipine değil masraf türüne bağlıdır. Talimattan bilinçli sapma (yasal doğruluk). | §4.3, §3.7 |
| K3 | Valör | Valör günü gerçek fiş yazılır. Tetikler: sunucu dinlemeye başladıktan sonra kuyruk (açılışta, 15 dakikada bir, gün dönümünde), hub'da günde bir kez açılmamış şirket denetimi, ekstre onayı, "Şimdi Aktar". GET uçları yazmaz. İleri tarihli satır yazılmaz. Kilitli güne düşen geçiş ilk açık güne yazılır. | §4.4 |
| K4 | Yetki göçü | `bank.move` ve `bank.cancel` bugün bankadan çıkış yapabilen her role ve kişiye verilir; `bank.transfer` `cash.manage` sahiplerine. `remove` listesine yalnız `bank.view` ve `bank.reports` yansıtılır. Banka bağlı satırı silmek `bank.cancel`, tutarını/hesabını/yolunu değiştirmek `bank.move` ister (ortak `assertMutable`). | §9 |
| K5 | Tek kaynak | Kasa penceresi, Kasa Dökümü, Banka ve POS Hareketleri, Banka Hareketleri, ANLIK DURUM ve Ana Defter beklenenleri tek SQL kaynak tanımından (`moneyLines`) gelir. `methodOf` geri düşüşü bu yolda kalkar. Kapıya "rapor = özet" denetimi eklenir. "Para satırı" tanımı da buradan gelir (çalışma anı denetimi aynı tanımı kullanır). | §3.4 |
| K6 | Tek sarmalayıcı | Bütün para yazımları `bank.post({ user, scope, requestId, module, op, body, write })` üzerinden geçer; modül yalnız satırını yazan geri çağrıyı verir. Denetim üç katmanlıdır: izinli istisna listeli statik test, satır düzeyinde COMMIT denetimi, `store.raw` kapsamı. | §3.3 |
| K7 | Eksi bakiye | Açılış bakiyesi bilinçli girilene (ya da ilk ekstre eşleşene) kadar denetim "Kontrol Yok"tur ve kartta görünür yazıyla belirtilir. Sonra varsayılan "Uyar". KMH ve kurumsal kart limitine kadar serbest. | §3.9 |
| K8 | Benzer işlem | Anahtarda hedef (taksit, fatura, çek, stok kalemi, kayıt) bulunur; yalnız hesaba bağlı satırlarda çalışır. Taksitte sunucu kuralı: yeni tahsilatta kalan 0 ise 409 `plan-paid`, aşan tutarda 409 `plan-overpay`; bu kural Benzer İşlem'den önce çalışır. Taksite Aktar (yer değiştirme) bugünkü kuralla kalır. Pencere aynı iş günüdür. | §3.10 |
| K9 | Döviz ve çek | İlk teslimde: döviz hesabına cari tahsilatı/ödemesi (13b; kur yoksa iki yönde TCMB döviz alış; ödemede ortalama maliyet ve gerçekleşen kur farkı), çekte "Bankaya Tahsile Ver" (`cheque_collections`, `cheque_events`'e yazılmaz), fatura formunda TCMB kur önerisi. Dönem sonu değerlemesi TCMB döviz alış kuruyla; ters kayıt varsayılan kapalı, açılırsa ertesi gün işle. | §3.12, §3.14 |
| K10 | ANLIK DURUM | Ana değer Gerçek Banka (Σ102, hesaba atanmış). POS Bekleyen (Net), Blokeli POS, Kart ve Kredi Borcu ve Hesabı Atanmamış Eski Hareketler ayrı satırlarda. Bütün ekranlarda (Birleşik Rapor dahil) aynı tanım ve aynı ad. | §8.4, §8.9 |
| K11 | Eski veri | Göç hiçbir satırı değiştirmez. Ölçüt: kapı imzası, mizan ve kilit izi bütün fikstürlerde birebir aynı. Eski satırlar "Hesabı Atanmamış" kovasında kalır; sihirbaz açık dönemdekileri hesaba atar. Yeni kod her para satırına `event_id` yazar. | §10 |
| K12 | Aşama 0 | Göçü bozan mevcut hatalar (A1, A2, A3, A4, A6, A7, A9, B5, B7) banka işinden önce, önce kırmızı test yazılarak düzeltilir. Aynı ölçüte uyan A12 ve A13 de eklenir. | §11.1 |
| K13 | Arayüz | Sol menüde Taksitler'in altında "Banka". Ayarlar Temel ve Gelişmiş bölümlerinden oluşur, "Varsayılanlara Dön" düğmesi vardır. Tek ortak hesap/POS seçici; tek hesap varsa gizli. İlk girişte atlanabilir Kurulum Sihirbazı. | §8 |

---

## 1. Mevcut Mimari Analizi

| Konu | Bugünkü durum | Kanıt |
|---|---|---|
| Çalışma ortamı | Node ve yerleşik `node:sqlite` (senkron). npm bağımlılığı yok. Kurulu program Node 24.21 kullanıyor. | package.json; CLAUDE.md |
| Sunucu | Kendi yönlendiricisi var. Her modül `register<Modül>Routes(router, context)` ile kaydolur. Servisler birbirine geç bağlamayla (`() => context.x`) ulaşır. Özel yollar `:id` kalıbından önce kaydedilir. | app.mjs:275-306 |
| İstemci | Derlenmiş React paketi ve `window.HOF` üzerinde konuşan `defer` betikler. CSP `connect-src 'self'` olduğu için tarayıcı TCMB'ye istek atamaz; kur sunucudan alınır. | client/index.html; http.mjs:26 |
| Veritabanı | Her şirketin ayrı SQLite dosyası var (WAL, synchronous FULL); 001 aynı zamanda ortak katmandır. Şema sürümü 19. Göçler ekleyicidir; her biri ayrı `store.tx` içinde ve öncesinde tam yedekle çalışır. | db.mjs:4-11; migrations.mjs:1113-1132 |
| İşlem ve kapı | `store.tx` en dışta BEGIN IMMEDIATE, içeride SAVEPOINT açar. FINANCIAL tablolara yazan her işlem COMMIT öncesi mutabakat kapısından geçer (bütün yevmiye, beklenenler, kilit izi). Yazım tespiti yalnız tablo adına bakar (`WRITE` regex). İşlem dışındaki tek satırlık para yazımı kendiliğinden işleme alınır. | db.mjs:27-28, 56-63, 74-107; integrity.mjs:77-270 |
| Kapı imzası | Sapma imzası `kod\|fark\|sayı`. Açılıştaki sapma taban sayılır. İmzası değişen her sapma (küçülen dahil) işlemi geri alır; başarılı COMMIT tabanı günceller. | integrity.mjs:273, 314-331 |
| Kimlik ve yetki | Çerez oturumu. 4 yerleşik rol, özel roller, kişiye `add`/`remove`. Salt okunur lisansta yazma yetkileri düşer; `/api/admin/*` salt okunurda da açık. `invoices.manage` ve `invoices.settings` WRITE_PERMISSIONS'ta yok. | permissions.mjs:14-82; license.mjs:46-62 |
| Çoklu şirket | Hub yolları regex ile ayrılır; diğer istekler `?hofCompany=` ile ya da seçili şirkete gider. En çok 2 şirket. Çocuk şirket ilk istekte `createApp` ile açılır; göçü ve `integrity.start()` o istek içinde çalışır. | app.mjs:361-455, 299 |
| Canlı olay | `workspace.changed {kind}`, ANLIK DURUM için `overview.changed`'e çevrilir; yalnız `OVERVIEW_KINDS` için (cash, accounts, plans, stock, cheques; invoices yok). Önbellek parmak izi payments, cash_entries ve modül parmak izlerinden. İstemci `LEDGER_PATHS` ile açık pencereleri yeniler. | overview.mjs:26, 48-76; hof-core.js:259-268 |
| Zamanlanmış iş | Yedek (hub, bütün şirketler), oturum temizliği, gün dönümü uyarı yayını. Para yazan arka plan işi yok. | app.mjs:478-498; backup.mjs:228-234 |
| İstek kimliği | Yalnız fatura oluşturmada, süreç belleğinde (24 saat). | idempotency.mjs:10-66; invoices.mjs:104, 1858-1881 |
| Toplu fatura | Toplu kesim ve toplu iptal belge başına ayrı üst işlemde ve `await issueDraft` ile (e-Belge gönderimi dahil) yürür; en çok 200 belge; sonuç belge belge. | invoices.mjs:1918-1950 |
| Test | node:test, Playwright senaryoları, `test:mutabakat`, `test:guvenilirlik`, sürüm fikstürleri (v2.0.16–2.0.20, `tools/surum-verisi.mjs`). `startTestServer` sahte saat almıyor; `npm run mutabakat` yalnız 001'i okuyor. | test/helpers.mjs:9-41; tools/mutabakat.mjs:24-25 |

---

## 2. Mevcut Finansal Sistem Analizi

### 2.1 Para saklama
- Bütün tutarlar REAL kolonlarda. Girişte `parseAmount` ve `roundMoney`; yarım kuruş sıfırdan uzağa yuvarlanır (money.mjs:4-23).
- Toplamlar kuruş tamsayısıyla: `CAST(ROUND(x*100) AS INTEGER)` (cash.mjs:59), `toCents` (money.mjs:25).
- Kapı her yazımda kuruş küsuratını ve eksi tutarı reddeder (integrity.mjs:146-150).
- Bir uçtan girilebilecek en büyük tutar 1e12 TL (cash.mjs:207; workspace.mjs:50).

### 2.2 Banka bugün yalnız bir yol etiketi
- Yollar `METHODS = {cash, bank, card}` (pay-method.mjs:9); bu kolon altı tabloda var.
- Hesap, POS, valör, komisyon, ekstre ve döviz kavramı yok.
- `card` iki anlam taşıyor: POS tahsilatı (varlık) ve şirket kartıyla ödeme (borç). İkisi de 108'e gidiyor (general-ledger.mjs:38).

### 2.3 Para yolları

| Kaynak | Tablo ve koşul | Ana Defter |
|---|---|---|
| Kayıt tahsilatı | `payments` (cash.mjs:16) | 100/102/108 ↔ 602 (general-ledger.mjs:76) |
| Elle Kasa girişi | `cash_entries`, yalnız nakit (cash.mjs:213-217) | 100 ↔ 649/770 |
| Kasa ↔ Banka | `cash_entries` ikiz satırları, aynı `transfer_id` (cash.mjs:245-268) | Tek fiş 100 ↔ 102 (general-ledger.mjs:79-85) |
| Cari tahsilat/ödeme | `account_entries`, `source=''` (accounts.mjs:1062) | 100/102/108 ↔ 120/320/336 |
| Fatura peşini | `account_entries`, `source='invoice'` (invoices.mjs:2708) | Aynı |
| Taksit | `plan_entries`, `cheque_id=''` ve `opening=0` (plans.mjs:1003) | ↔ 120/127 |
| Stok peşini | `stock_moves`, `pay='cash'` (stock.mjs:541) | ↔ 600/610/153 |
| Çek tahsil/ödeme | `cheque_events` collect/pay (cheques.mjs:582); varsayılan yol bank (:368). `kind` CHECK listesi kapalı: receive, issue, collect, endorse, pay, bounce (migrations.mjs:729). | ↔ 101/103 |

### 2.4 Üç okuma yolu (K5'in gerekçesi)

| Yol | Kod | Kim okuyor | Tanınmayan yol ne olur |
|---|---|---|---|
| SQL özeti | cash.mjs:54-92 (`sources()` → `summary()`) | ANLIK DURUM, nakit akış başlangıcı, eksi bakiye, Ana Defter beklenenleri (ledger.mjs:87-89) | Bakiyeye girer, `byMethod`'a girmez (cash.mjs:59, 70-72) |
| JS satır yolu | cash.mjs:26-50 (`entries()` + modüllerin `cashEntries`) ve `report()` (:136-180) | Kasa penceresi (:187-190), Kasa Dökümü PDF (:193-201), Banka ve POS Hareketleri raporu (report-center.mjs:396-419) | `methodOf` ile nakit sayılır (cash.mjs:148; pay-method.mjs:13) |
| Yevmiye | routes/ledger.mjs:13-73 `rows()` → general-ledger.mjs:65-195 | Mizan, yevmiye, kapı | `cashAccount` ile 100'e gider (general-ledger.mjs:42) |

Kapı yalnız 1 ile 3'ü karşılaştırıyor; 2'nin ayrışması sessiz kalıyor. Bu açık K5 ile kapanır.

### 2.5 Kurallar
- **Tarih:** İleri tarihli hareket girilmez. Kilitli döneme yazılmaz, kilitli dönemdeki kayıt değiştirilmez (period.mjs:21-51).
  - Kayıt tahsilatında ve çekte bu denetim yok (A1, A6).
  - Çek oluşturmada alış/veriliş tarihi `dateOf` ile alınıyor, ileri tarih denetimi yok (cheques.mjs:249).
  - `dates:future` denetimi ileri tarihli satır sayısını imzaya katıyor. Eski veride ileri tarihli satır varsa gün geçtikçe sayı küçülür, imza değişir; bütün para işlemleri yeniden başlatmaya kadar 409 alır (A13).
- **Eksi bakiye:** Yalnız nakit denetleniyor (pay-method.mjs:29-36). Denetim rotada ve satır yazılmadan önce (cash.mjs:112-134; accounts.mjs:560). Fatura düzenlemede "son durum" denetimi var (invoices.mjs:565-574).
- **İstek kimliği:** Yalnız fatura oluşturmada (§1).
- **Yetki:** `payments.create`, `accounts.collect` ve `plans.collect` herkese açık (permissions.mjs:22, 35, 40). Personel kendi girdiği tahsilatı düzeltip silebilir (accounts.mjs:546-551; workspace.mjs:378-383; plans.mjs:695-699).
- **Raporlar:** Parametre izin listesi `queryOf` (report-center.mjs:1388-1396). İstemcideki `SELECTS` sözlüğü aynı commit'te güncellenmeli (Bulgu 4 dersi).
- **ANLIK DURUM:**
  - Banka/POS kutusu `noncash` = bank + card toplamını gösteriyor (overview.mjs:90-92).
  - Nakit akışı başlangıcı nakit + banka + POS toplamı; etiketi "Bugünkü Kasa" (overview.mjs:312, 331).
  - Kasa kutusunun bugün ve bu ay giriş/çıkışı Kasa↔Banka nakit bacağını da sayıyor (cash.mjs:63-90).
- **Taksitte fazla tahsilat** bugün serbest; kartta "extra" olarak görünüyor (lib/plans.mjs:111). Taksite Aktar kalanı aşan aktarıma `payments-exceed` uyarısıyla izin veriyor (routes/plan-transfer.mjs:158).
- **Fatura kapama:** Ödeme havuzuna yalnız ödeme rolü (`recvPay`/`payPay`) taşıyan satır giriyor. Bağlı kapama da yalnız bu havuzdaki satırla yapılıyor (invoice-settle.mjs:162-200, 262-266). `source='bank'` gibi tanınmayan kaynak bugün "account" kökeni sayılıyor ve FIFO'ya giriyor (lib/accounts.mjs:45).
- **Silinmiş cari:** Bütün `account_entries` satırları (borç/alacak dahil) yevmiyeden düşüyor (routes/ledger.mjs:18-23). Kilit izi `accounts`'a bakmıyor.

### 2.6 Mevcut hatalar
§11.1'de.

---

## 3. Banka Modülü Mimarisi

### 3.1 Temel karar ve reddedilen seçenekler

| Seçenek | Karar | Gerekçe |
|---|---|---|
| Modül satırı tek para kaydı + `fin_ref`/`event_id` + Banka Fişi + `fin_events` dizin kopyası | **SEÇİLDİ** | Para tek kayıtta durur, çift sayım yapısal olarak imkânsız. Fatura peşini zaten 102'ye giriyor. Göç veriyi değiştirmez; mevcut testler ve kapı korunur. `fin_events`'teki tutar/yön/hesap kopyası yalnız sayfalama ve süzgeç dizinidir; kapı her dokunulan olayda "kopya = satır" denetler. |
| Ayrı `bank_transactions` + modüllerin kendi yazımı | Reddedildi | Aynı para iki kaynakta olur; talimat 1, 30 ve 31'e aykırı. |
| Her para satırına bacak + tetikleyici + giden kutusu | Reddedildi | Nakit dahil ikinci kayıt tutar; kod tabanında hiç tetikleyici yok; kapı maliyetini büyütür. Yalnız eski sürüm tespiti ve eşleşme özeti alındı. |
| Alt hesabı ana hesap kodu yapmak (`'102.01'`) | Reddedildi | 102 mizanı bölünür, `gl:102` testleri kırılır. İşlem No, Benzer İşlem ve kilit öncesi valör kuralı alındı. |
| Mevcut REAL kolonlara gölge INTEGER (`amount_minor`) | Reddedildi (K1) | Her yazım ikiye katlanır, iki kolon ayrışabilir. Yerine kapıda kuruş kesinliği, özellik testi ve Aşama 17. |
| `cheques.status` / `cheque_events.kind` CHECK'ini genişletmek (tablo yeniden kurma) | Reddedildi | İki tablo yeniden kurulur, kilit izi ve eski sürüm uyumu riske girer. Yerine `cheque_collections` + `fin_events`. |

**Talimat 30'daki örnek tabloların karşılığı:**

| Talimattaki ad | Bu plandaki karşılık |
|---|---|
| `bank_accounts` | `bank_accounts` |
| `bank_transactions` | Yok. Yerine modül satırları + `bank_lines`; liste `moneyLines` + `fin_events` dizininden |
| `bank_transfers` / `bank_fees` | `fin_events` (`transfer` / `fee`) + `bank_lines` |
| `bank_statement_imports` | `bank_statements` + `bank_statement_lines` |
| `bank_reconciliation` | `bank_matches` |
| `pos_terminals` | `pos_terminals` |
| `pos_transactions` | `pos_sales` |
| `pos_installments` / `pos_settlements` | `pos_items` + `fin_events` (`pos_settlement`) |
| `pos_commissions` | `pos_rates` + `pos_sales`'teki anlık oran kopyası |
| `financial_transactions` | `fin_events` |
| `financial_audit_logs` | Mevcut `audit_events` (önceki ve yeni değer zorunlu) |
| — (yeni) | `cheque_collections` (Bankaya Tahsile Ver), `bank_jobs` (ertelenmiş ters kayıt, komisyon taslağı), `request_keys` |

### 3.2 Yeni bileşenler (bağımlılık eklenmez)

| Dosya | Görev |
|---|---|
| `server/lib/minor.mjs` | `parseMinor` (metni kayan noktaya uğratmadan kuruşa çevirir; 2'den çok ondalıkta 400), `mulPpm`, `mulRate`, `divRound`, `splitMinor` (artık son dilime). BigInt; yarım birim sıfırdan uzağa. Para birimi ondalık tablosu: TRY/USD/EUR/GBP = 2 (ISO 4217; eklenebilir). |
| `server/lib/bank/post.mjs` | `bank.post` (K6): istek kimliği, hedef kuralları, `assertMutable`, Benzer İşlem, olay açma/güncelleme/iptal, POS bağlama, son durum eksi bakiye, audit, dokunulan olay kümesi; `store.raw` kapsamı. |
| `server/lib/bank/money-lines.mjs` | Tek kaynak (K5): aynı tanımdan özet SQL'i, satır SELECT'i ve "para satırı" koşulu (çalışma anı denetimi için) üretilir. |
| `server/lib/bank/engine.mjs` | Saf fiş kurucu (açılış, masraf, faiz, transfer, döviz, gerçekleşen kur farkı, valör, değerleme, devir, ters kayıt) ve denge denetimi. Ülke bilgisi yok. |
| `server/lib/bank/settle.mjs` | Valör kuyruğu (K3): tur sınırı, kilit kuralı, hata kaydı, `bank_jobs` işleri. |
| `server/lib/business-days.mjs` + `server/lib/calendars/tr.mjs` | İş günü servisi ve Türkiye takvimi (§4.5). |
| `server/lib/fx/tcmb.mjs` | TCMB XML okuyucu; istek sunucudan `config.fetchImpl` ile (config.mjs:57). |
| `server/lib/bank/statement.mjs`, `match.mjs`, `statement-formats/` | Ekstre normalleştirme, Türk bankası CSV biçimleri, parmak izi, öneri puanı ve anahtar sözcük sözlükleri. |
| `server/lib/bank/adapters.mjs` | Açık bankacılık ve sanal POS bağdaştırıcı kaydı; hepsi kapalı (`einvoice/adapters` kalıbı). |
| `server/routes/bank.mjs` (+ `bank-pos.mjs`, `bank-statements.mjs`, `bank-fx.mjs`) | Uçlar ve `context.bank` servisi. |
| `client/assets/hof-bank.js` | Banka penceresi, `HOF.bank.field` ortak seçici, Kurulum Sihirbazı, `HOF.formatMinor`. |
| `test/bank-post-izinli.json` | K6 statik testinin izinli ham yazım listesi (dosya, işlev, gerekçe). |

**Değişen mevcut dosyalar:** `invoice-settle.mjs` (`pos-fee` kökeni, "yalnız bağlı" havuz öğesi; §4.3), `lib/accounts.mjs:45` (köken eşlemesi), `db.mjs` (işlem başı rowid işareti, `store.raw`), `integrity.mjs` (yeni denetimler, `dates:future` taban kümesi), `general-ledger.mjs` (`moneyAccount`, alt hesap).

### 3.3 Merkezi işlem: `bank.post` (K6; talimat 2, 31)

Bütün para yazımları (nakit dahil, K11) tek sarmalayıcıdan geçer. Modül yalnız kendi satırını yazan geri çağrıyı verir.

```
bank.post({ user, scope, requestId, module, op, body, prev, write })
  op: 'create' | 'update' | 'delete' | 'move' | 'restore' | 'assign'
      move    : Taksite Aktar ve geri alması (satır tablo değiştirir, para aynı)
      restore : Silinenler'den geri yükleme
      assign  : "Bu Hesaba Ata", sihirbaz ve geri alması, komisyon faturasına bağlama (yalnız bağ değişir, tutar değişmez)
store.tx(() => {                                         ← tek BEGIN IMMEDIATE (db.mjs:74-107)
  1  hit = requests.lookup(key, bodyHash(body))          ← request_keys kalıcı, aynı işlem; aynı kimlik + farklı içerik → 409
  2  prep = prepare(body, module, op)                    ← hesap aktif mi, yol ↔ tür, para birimi, POS oranı, belge türü → alan (§4.6)
                                                           + HEDEF KURALLARI: taksit kalanı (K8: plan-paid / plan-overpay / installment-paid),
                                                             çek durumu (cheque-deposited), iade ≤ satış (pos-refund-exceeds)
  3  assertMutable(user, prev, next)                     ← K4 çapraz yetki; eşleşmiş → 409; bankaya geçmiş POS → bank.replan ya da 409
  4  similar(prep)                                       ← K8; yalnız fin_ref dolu satır; 409 bank-similar (similarOk ile geçer)
  5  event = open | revise | cancel                       ← fin_events: İşlem No (sayaç, §5.4), durum, salt okuma kopyası
  6  rows = write(event)                                 ← modül satırı fin_ref + event_id ile
  7  pos.attach | pos.rebuild | pos.void | pos.cancelRefund   ← yalnız POS (§4.6)
  8  guardFinal(prep)                                    ← K7: yazımdan SONRA hesap bazında son durum (invoices.mjs:565-574 kalıbı)
  9  audit(user, `${module}.${op}`, id, { previous, ...next })   ← update/delete/move/restore/assign'de previous zorunlu
 10  requests.remember(key, hash, ref)                   ← aynı işlemde
 11  touched.events.add(event.id)                        ← kapının olay bazındaki denetimleri yalnız bunlara uygulanır
})                                                       ← COMMIT öncesi mutabakat kapısı
events.publish('workspace.changed', { kind: module }) + { kind: 'bank' }   ← COMMIT'ten sonra
```

**Kurallar:**
- İşlem yarıda kesilirse ROLLBACK olur. Olay, para satırı, POS takvimi, istek kaydı ve audit ya birlikte vardır ya da hiçbiri yoktur.
- Sayılar ağdan ya da bekleme (await) arasından geçmez. Hedef kuralları, eksi bakiye ve benzer işlem işlemin içindedir (C12).
- Hedef kuralları (adım 2) Benzer İşlem'den (adım 4) önce çalışır. Ödenmiş taksite ikinci tahsilat bu yüzden her zaman `plan-paid` alır, `bank-similar` almaz.

**Toplu işler iki sınıftır:**
- **Tek dış işlem** (iç içe `bank.post`, kapı bir kez çalışır, öğeler birlikte ya da hiç; ağ çağrısı yok):
  - valör turu (§4.4/3; reddedilen tur gruplarını tek tek dener)
  - Kurulum ve Aktarım Sihirbazı ve geri alması
  - "Güçlü Önerilerin Tümünü Onayla"
  - dönem sonu değerlemesi
- **Belge başına ayrı işlem** (bugünkü düzen korunur, invoices.mjs:1918-1950):
  - toplu fatura kesimi, toplu iptal, toplu silme
  - tekrarlayan fatura üretimi
  - ekstreden birden çok "Hareket Oluştur"
  
  Her belge kendi `bank.post` işleminde yazılır; kapı belge başına çalışır. e-Belge gönderimi (`await issueDraft` içindeki ağ adımı) işlemin dışında kalır. Bir belgedeki sapma yalnız o belgeyi geri alır, sonuç belge belge döner ("Banka hesabı seçilmedi", "Benzer İşlem" gibi). Uzun BEGIN IMMEDIATE yazanları bekletmez.

**Denetim (K6), üç katman:**
- **(a) Statik test.** Para tablolarına (payments, cash_entries, account_entries, plan_entries, stock_moves, cheque_events, bank_lines, fin_events, pos_sales, pos_items, cheque_collections) yazan her SQL çağrı yeri iki yerden birinde olmalıdır:
  - (i) `bank.post`'a verilen `write` geri çağrısının içinde
  - (ii) `test/bank-post-izinli.json` listesinde, dosya, işlev ve gerekçeyle
  
  Başlangıç listesi:
  - göçler (migrations.mjs)
  - `resetData` DELETE'leri (app.mjs:536-546)
  - açılış onarım adımı (§10.6)
  - para dışı satır yazıcıları: cari "Borç Yaz/Alacak Yaz" ve açılışı (`account_entries` debt/credit), fatura cari maddesi (fatura borcu/alacağı), taksit kartı borcu, `plan_entries opening=1` ve çekli satırlar, stok `pay='account'` hareketleri, çek receive/issue/endorse/bounce olayları ve cari etkileri
  
  Listeye ekleme kod incelemesi ister. Liste dışında yeni yazım yeri testi kırar. Listedeki para dışı yazıcılar yazımdan önce `assertNonMoney(table, row)` çağırır; satır "para satırı" koşulunu sağlıyorsa test kipinde hata, üretimde günlük kaydı + yönetici zili.
- **(b) Satır düzeyinde COMMIT denetimi (`money:event`).**
  - "Para satırı" tanımı tek yerdedir: `moneyLines`'ın 9 kaynak koşulu (§3.4).
  - `store.tx` en dış işlemin başında para tablolarının `MAX(rowid)` değerini işaretler (indeksli, ucuz).
  - COMMIT öncesi bu işaretten sonra eklenen ve para satırı koşulunu sağlayan her satırda `event_id <> ''` aranır.
  - Borç Yaz/Alacak Yaz, açılış, `pay='account'` ve çekli taksit satırları koşulu sağlamadığı için yanlış alarm vermez. Gerçek para satırı `bank.post` dışından eklenemez.
  - Sonuç: test kipinde ROLLBACK, üretimde `integrity_log` + zil (işi durdurmaz).
- **(c) Var olan satırın UPDATE/DELETE'i.**
  - `store.raw(reason, fn)` kapsamı (göç, sıfırlama, açılış onarımı) ve `bank.post` bağlamı dışında para tablosuna yapılan UPDATE/DELETE test kipinde hata, üretimde günlük kaydıdır.
  - `raw` kapsamı gerekçesiyle `integrity_log`'a yazılır.
  - Kaçan değişikliği dokunulan olaylarda ve 15 dakikalık tam taramada `bank:event` ("kopya = satır", "etkin olayın satırı var") yakalar.
  - Silinenler geri yüklemesi (`op 'restore'`) ve sihirbaz geri alması (`op 'assign'`) `bank.post`'tan geçer; ham yazım değildir.

### 3.4 Tek kaynak: `moneyLines` (K5)

Tek bir JS tanımından tek bir SQL ifadesi üretilir. Özet sorgusu `SELECT … FROM (moneyLines)`, satır sorgusu aynı ifade + süzgeç + sıralama + imleçtir. Aynı tanımın `WHERE` koşulları "para satırı" yüklemi olarak §3.3/b'de kullanılır.

**Kaynaklar (9):**

| # | Kaynak | Koşul |
|---|---|---|
| 1 | payments | — |
| 2 | cash_entries | elle girişler ve transfer ikizleri |
| 3 | account_entries | `source=''`, in/out |
| 4 | account_entries | `source='invoice'`, in/out |
| 5 | account_entries | `source='bank'` (POS kesintisi, komisyon tahsili, komisyon iadesi) |
| 6 | plan_entries | `cheque_id=''` AND `opening=0` |
| 7 | stock_moves | `pay='cash'` AND `amount>0` |
| 8 | cheque_events | collect/pay |
| 9 | bank_lines | para rolleri (bank, pos, card, loan) |

**Kolonlar:**
- `src`, `id`, `event_id`, `kind` (in/out), `cents` (TL kuruş tamsayısı)
- `fx_cents`, `currency` (döviz hesabı)
- `date`, `value_date`, `ref` (hesap ya da POS kimliği; `''` = Hesabı Atanmamış), `party_id`
- `internal`: 1 = iç hareket (Kasa↔Banka, bankalar arası transfer, valör geçişi, döviz al/sat, kredi)
- Görüntü kolonları yalnız satır sorgusunda (cari adı, kart adı vb.)

**`way` (yol) SQL'de türetilir, hiçbir tabloya yazılmaz (B7 tuzağı kapanır):**

```
CASE
  WHEN method='cash' THEN 'cash'
  WHEN method='bank' AND COALESCE(ba.kind,'') NOT IN ('card','loan') THEN 'bank'
  WHEN method='card' AND ba.kind='card' THEN 'ccard'       -- kurumsal kart (309)
  WHEN method='card' THEN 'card'                            -- POS (108.T) ya da eski (108.00)
  WHEN role='loan' THEN 'loan' ... ELSE 'unknown' END       -- LEFT JOIN bank_accounts ba ON ba.id = ref
```

**Kim okuyor:**

| Okuyan | Neyi okur | Değişiklik |
|---|---|---|
| Kasa penceresi ve Kasa Dökümü PDF | satır, `way='cash'` (SQL'de) | `entries()`/`report()` ve `methodOf` bu yoldan kalkar; görünen sayı aynı kalır |
| Banka ve POS Hareketleri raporu (aynı id, başlık, izin) | satır, `way ∈ {bank, card, ccard, loan}` + Hesap süzgeci | yeni servisin görünümü olur; ikinci kod yolu kalmaz |
| Banka Hareketleri ekranı | satır; sayfa ve süzgeç için `fin_events` dizini (§8.6) | yeni |
| ANLIK DURUM, Genel Bakış, Nakit Akış başlangıcı | özet (K10) | yeni ayrım |
| Eksi bakiye (K7) | özet, `ref` bazında | yol bazından hesap bazına |
| Ana Defter beklenenleri | özet: 100 = cash, 102 = bank, 108 = card, 309 = ccard, 300 = loan | yeni anahtarlar |
| Çalışma anı denetimi (§3.3/b) | yalnız `WHERE` koşulları | yeni |

**Kurallar:**
- `way='unknown'` olan satır listede kırmızı "Tanınmayan Yol" olarak görünür ve kapıda `money:method`'u kırar. Aşama 0'daki B7 düzeltmesinden sonra böyle satır yazılamaz.
- **Bugün ve Bu Ay toplamlarında iç hareket:**
  - **Banka görünümleri** (Banka Genel Bakış, Hesap Detayı, ANLIK DURUM Banka kutusu, Banka raporları): "Bugün Giriş/Çıkış" ve "Bu Ay" yalnız `internal=0` satırları sayar. İç hareketler ayrı "Transfer" satırındadır, iki kez sayılmaz.
  - **Kasa görünümleri** (Kasa penceresi, Kasa Dökümü, ANLIK DURUM Kasa kutusu = `cashOnly.today/month`): bugünkü tanım korunur. Kasa↔Banka transferinin nakit bacağı Kasa'nın giriş/çıkışında sayılır, çünkü fiziki nakit gerçekten girer ya da çıkar (cash.mjs:63-90). Bu sayılar göçten sonra değişmez (§11.4).
  - Geriye uyum için eski `today` (bütün yollar) alanı aynı tanımla kalır.
- **Kapı denetimi `money:report`:** JS satır toplamı, yol ve hesap bazında SQL özetine eşit olmalıdır. Her COMMIT'te dokunulan olaylar için, tam taramada bütün veri için koşulur.

### 3.5 Banka hesap türleri ve hesap seçimi (talimat 3)

| Tür (ekranda) | `kind` | Ana / alt hesap | Modül formlarında seçilir mi |
|---|---|---|---|
| Vadesiz | demand | 102 / 102.NN | Evet: Havale/EFT. KMH Limiti alanı var. |
| Ticari | commercial | 102 / 102.NN | Evet |
| Vadeli | time | 102 / 102.NN | Hayır; yalnız transfer ve faiz |
| Döviz (para birimi TRY değil) | fx | 102 / 102.NN (defter TL'siyle) | Yalnız cari tahsilat/ödeme (13b) ve Banka Fişi. Fatura peşini, taksit, stok ve çekte seçilemez (400 `bank-currency`). |
| Kredi Hesabı | loan | 300 / 300.NN | Hayır; kullanım ve geri ödeme transferle |
| Kurumsal Kredi Kartı | card | 309 / 309.NN | Ödemede ve kurumsal karta gelen iadede |
| Diğer | other | 102 / 102.NN | Evet |

**Hesap kuralları:**
- `gl_sub` alt hesap kodunu sistem verir; değişmez.
- "Hesap Kodu" kullanıcınındır (ör. ZRT-TL); silinmemiş hesaplar arasında tekildir. Aynı bankada aynı adlı iki hesap açılabilir, seçicide kodla ayrılır.
- Para birimi ve tür ilk hareketten sonra değiştirilemez (409).

**Hesap seçimi kuralları (K13; E1.15):**
1. Hiç uygun hesap yoksa eski davranış sürer: satıra `fin_ref=''` (102.00/108.00) yazılır; `event_id` yine yazılır.
2. Seçim zorunluluğu kategori bazında başlar: TRY banka hesabı tanımlanınca Havale/EFT için, POS tanımlanınca POS tahsilatı için, kurumsal kart tanımlanınca Kredi Kartı ödemesi için.
3. Tek uygun hesap varsa kendiliğinden seçilir ve seçici gizlenir. Birden çoksa seçim zorunludur (400 `bank-account-required`, alan düzeyinde).
4. Düzeltmede yolu, tutarı ve tarihi değişmeyen eski bağsız satır bağsız kalabilir; olay da açılmaz. Seçim yalnız yeni para satırında ya da yolu, tutarı veya tarihi değişen satırda istenir.
5. Toplu kesim, tekrarlayan fatura ve gelen e-Fatura taslaklarında hesapsız satır olursa o belge "Banka hesabı seçilmedi" sonucuyla kalır, öbürleri kesilir (§3.3, belge başına işlem). Taslak formunda alan düzeyinde hata gösterilir.
6. Çek tahsilinde varsayılan yol bank (cheques.mjs:368); hesap "Tahsil Edilen Hesap" alanından. Bankada tahsildeki çekte hesap ön seçilidir ve değiştirilemez (§3.14).
7. Taksite Aktar ve Silinenler geri yüklemesinde satır kendi bağını taşır; seçim istenmez.

### 3.6 İşlem türleri ve kayıt yerleri (talimat 6)

| Tür | Kayıt yeri | Yevmiye |
|---|---|---|
| Cari Tahsilat / Cari Ödeme | `account_entries` + `fin_ref` | 102.x ↔ 120/320/336 |
| Fatura Tahsilatı / Ödemesi | `account_entries` (`source='invoice'`) + `fin_ref` | aynı |
| Taksit Tahsilatı / Ödemesi (iade) | `plan_entries` + `fin_ref` | 102.x ↔ 120/127 |
| POS Tahsilatı | modül satırı (`card`, `fin_ref`=POS) + `pos_sales` | 108.T ↔ 120 |
| POS Komisyonu | valör fişi (`pos_settlement`) ya da KDV kipinde kesinti satırı | 653 ya da 320 |
| Komisyon Tahsili (net eksi) | `pos_items` (`fee`) → valör fişi | 653 / 320 ↔ 102.x |
| Kasa Transferi | `cash_entries` ikizi + `fin_ref` | 100 ↔ 102.x |
| Bankalar Arası Transfer | Banka Fişi `transfer` | 102.x ↔ 102.y |
| Banka Masrafı | Banka Fişi `fee` (BSMV ya da Yok) ya da alış faturası (KDV) | **770** ↔ 102.x; KDV 191 faturadan. Hesabı masraf türü belirler, vergi kipi yalnız vergi satırını değiştirir. |
| Faiz | Banka Fişi `interest_in` / `interest_out` | 102 + 193 ↔ 642; 780 ↔ 102 |
| Diğer Gelir / Diğer Gider | Banka Fişi `other_in` / `other_out` | 102 ↔ 649; 659 ↔ 102 |
| Döviz Alım/Satım | Banka Fişi `fx_exchange` | 102.USD ↔ 102.TRY (+ 646.02 / 656.02) |
| Döviz Hesabından Cari Ödemesi (13b) | modül satırı (işlem kuruyla TL) + aynı olayda Banka Fişi kur farkı satırı | 320 ↔ 102.03; 102.03 ↔ 646.02 / 656.02 |
| Açılış Bakiyesi | Banka Fişi `opening` | 102.x ↔ 500 |
| İade | iade satırı + `pos_sales` (`refund`) | §4.6 |
| Bankaya Tahsile Ver / Bankadan Geri Al | `cheque_collections` + `fin_events` (`cheque_deposit` / `cheque_withdraw`). **`cheque_events`'e satır yazılmaz** (`kind` CHECK, migrations.mjs:729); `cheques.status` `portfolio` kalır. | 101.02 ↔ 101.01 |
| Ek türler | Değerleme, Devir Kapanışı, Kart Borcu Ödemesi, Kredi Kullanımı, Ters Kayıt (`reversal`), İptal İadesi (`pos_cancel_refund`) | §3.7, §4.6 |

`fin_events.type` değerleri kodda bir sözlükte tutulur, CHECK kullanılmaz. Neden: `cheques.status` (migrations.mjs:709) ve `cheque_events.kind` (:729) CHECK kısıtları yeni değer eklemeyi tablo yeniden kurmaya zorluyor.

Sözlük: `opening, fee, interest_in, interest_out, other_in, other_out, card_payment, loan_draw, loan_repay, transfer, cash_transfer, fx_exchange, revaluation, carry_close, pos_settlement, pos_sale, pos_refund, pos_cancel_refund, party_in, party_out, invoice_cash, plan_in, plan_out, record_in, stock_cash, cheque_collect, cheque_pay, cheque_deposit, cheque_withdraw, legacy_assign, reversal`.

### 3.7 Kayıt akışları (her satır tek işlem; talimat 43 sayılarıyla)

| # | Senaryo | Tek işlemde yazılanlar | Yevmiye ve sonuç | Yetki |
|---|---|---|---|---|
| 1 | Hesap açma + açılış | `bank_accounts` + `fin_events(opening)` + `bank_lines` | B 102.01 100.000 / A 500. KMH'de eksi açılış ters. Kart: B 500 / A 309.01. Kredi: B 500 / A 300.01. | bank.accounts |
| 2 | Cari tahsilat (havale) | `account_entries(in, bank, fin_ref, event_id, invoice_id?)` + makbuz | B 102.01 20.000 / A 120. Ziraat 100.000 → 120.000 | accounts.collect |
| 3 | Cari ödeme (havale / kurumsal kart) | `account_entries(out, bank\|card, fin_ref)` | B 320 / A 102.01 (ya da A 309.01) | accounts.manage + bank.move |
| 4 | Fatura peşin havale / POS | `writeIssued` (invoices.mjs:1245) içinde her peşin satır `bank.post`'tan geçer. `payment_json.cash[i] = {lineKey, eventId, bankAccountId\|posId, installments}`. | Fatura maddesi + B 102.01 / A 120 (POS'ta B 108.01 / A 120) | invoices.manage (+ ödemede bank.move) |
| 5 | Alış faturası kurumsal kartla | `account_entries(out, card, fin_ref=kart)` | B 320 / A 309.01 (bugün 108'e gidiyor; C4 düzelir) | invoices.manage + bank.move |
| 6 | Taksit tahsilatı | `plan_entries(in, fin_ref, event_id, item_id)` + makbuz; K8 hedef kuralı | B 102.02 / A 120 (carisizde A 127) | plans.collect |
| 7 | Kayıt tahsilatı | `payments(method, fin_ref, event_id)` | B 102.x / A 602 | payments.create |
| 8 | Stok peşin satış / alış / iade | `stock_moves(pay cash, method, fin_ref, event_id)` | B 102 / A 600; B 153 / A 102 | stock.sell / stock.manage (+ çıkışta bank.move) |
| 9 | Çek tahsil / ödeme | `cheque_events(collect\|pay, bank, fin_ref)` | B 102 / A 101.01 (tahsildeyse A 101.02); B 103 / A 102 | cheques.manage (+ ödemede bank.move) |
| 10 | Kasa ↔ Banka | `fin_events(cash_transfer)` + 2 `cash_entries` (aynı `transfer_id`; banka bacağında `fin_ref`) | Bankadan Kasaya 10.000: B 100 / A 102.01. Ziraat 110.000, Kasa 10.000 | cash.manage + bank.transfer |
| 11 | Bankalar arası transfer | `fin_events(transfer)` + `bank_lines` | Ücretsiz: B 102.02 20.000 / A 102.01 20.000 → Ziraat 90.000, Garanti 70.000. Ücretli (EFT 5,00 + BSMV 0,25): B 102.02 20.000 · B 770 5,25 / A 102.01 20.005,25 → Ziraat 89.994,75; Garanti 70.000 | bank.transfer |
| 12 | Banka masrafı (BSMV) | `fin_events(fee)` + gider ve vergi satırı | BSMV Dahil 10,50: B 770 10,00 · B 770 0,50 (rol `tax`) / A 102.01 10,50. BSMV Hariç girilen 10,00'dan 10,50 çıkar. | bank.move |
| 13 | KDV'li banka masrafı (K2; Banka → "+ Masraf") | Tek işlemde: fatura servisiyle sağlayıcı carisine "Hizmet ve Gider Alışı" (gider türü **"Banka Masrafları" → 770**) + peşin havale + `fin_events(fee, invoice_id)` | KDV Dahil 120: B 770 100 · B 191 20 / A 320 120; B 320 / A 102.01 120 → banka −120, cari 0, KDV raporu 191 = 20. Aynı masraf BSMV kipinde de 770'e gider; Banka Masraf Raporu tek kaynaktan (`fin_events type='fee'`) okur. | bank.move + invoices.manage |
| 14 | Faiz geliri (stopajlı) | `fin_events(interest_in)` + `bank_lines` | Brüt 1.000, stopaj %15 (oran kullanıcıdan): B 102.04 850 · B 193 150 / A 642 1.000 | bank.move |
| 15 | Faiz / KMH gideri | aynı | B 780 / A 102.01 (BSMV ve KKDF satırları da 780'e) | bank.move |
| 16 | Kart borcu ödemesi | aynı | B 309.01 / A 102.01 | bank.move |
| 17 | Kredi kullanımı / geri ödeme | aynı | B 102.01 / A 300.01; B 300.01 · B 780 / A 102.01 | bank.transfer |
| 18 | Diğer gelir / gider | aynı | B 102 / A 649; B 659 / A 102 | bank.move |
| 19 | Döviz al/sat, değerleme | §3.12 | | bank.transfer / bank.move |
| 20 | Döviz hesabına cari tahsilatı (13b) | `account_entries(in, bank, fin_ref=USD hesabı, amount=TL, fx_currency, fx_minor, fx_rate_e6, fx_source)`; kur yoksa TCMB döviz alış | 1.000 USD @34,50: B 102.03 34.500 (1.000 USD) / A 120 34.500 | accounts.collect |
| 20b | Döviz hesabından cari ödemesi (13b) | `account_entries(out, …, amount = döviz × işlem kuru)` + aynı olayda `bank_lines` (gerçekleşen kur farkı) | 500 USD XYZ'ye @35,00 (ortalama maliyet 34,50): B 320 17.500 / A 102.03 17.500 (500 USD) + B 102.03 250 (fx 0) / A 646.02 250 → 102.03 net −17.250 = ortalama maliyet; XYZ'ye 17.500 yazılır | accounts.manage + bank.move |
| 21 | Çek: Bankaya Tahsile Ver | `cheque_collections(pending, event_id)` + `fin_events(cheque_deposit)`; `cheque_events` ve `cheques.status` değişmez | B 101.02 / A 101.01 (101 toplamı değişmez) | cheques.manage |
| 22 | POS satışı, valör, iade, iptal | §4 | | |
| 23 | Planlı işlem (talimat 24) | `bank_plans`; deftere girmez. "Gerçekleştir" formu planlı tarihle açılır; tarih bugün ya da öncesi olmalı. | — | bank.move / bank.transfer |

**Banka Fişi kuralı:**
- Fiş 120, 127, 320, 336 cari hesaplarına ve 191'e hiç satır yazmaz. Cari etkisi her zaman `account_entries`'ten, KDV faturadan gelir.
- `bank_lines.gl` rol bazında beyaz listeyle denetlenir (§3.11).

### 3.8 İptal, ters kayıt, düzeltme, silme, geri yükleme (talimat 26, 34)

| Kayıt | Düzelt | Sil / İptal | Engel ve neden (görünür yazıyla) |
|---|---|---|---|
| Banka Fişi | Açıklama ve referans serbest. Tutar, tarih ya da hesap için "Düzelt" = tek işlemde ters fiş (`type='reversal'`, `reversal_of`) + yeni fiş. | Silinmez; "Ters Kaydet". Ters fiş tarihi: asıl fiş açık dönemdeyse aynı tarih, kilitliyse bugün. | Eşleşmişse önce eşleşme kaldırılır (409 `bank-reconciled`). Valör fişi yalnız `bank.replan` ile değişir. |
| Açılış | "Açılışı Düzelt" = ters + yeni. Yeni tarih hesaba bağlı ilk hareketten sonra olamaz (409 `bank-opening-after-first`). Açılışsız hesapta "Açılış Bakiyesi Gir". | — | Kilitli açılış düzeltilmez. |
| Modül satırı, `fin_ref` dolu | Yalnız açıklama: modül yetkisi yeter. Tutar, tarih, yol ya da hesap: modül yetkisi + `bank.move`; hesap bazında etki farkı ve son durum eksi bakiye denetlenir (K4, E2.17). | Modül yetkisi + `bank.cancel`. Satır Silinenler'e gider; olay `cancelled` olur, kopyası kalır (İşlem Kartı tutarı gösterir). POS satırında silme **kayıt hatası düzeltmesidir**: valörden önce void (komisyonsuz, provizyon süresinden bağımsız, audit "kayıt hatası"). | Eşleşmiş satır: 409 `bank-reconciled` ("önce eşleşmeyi kaldırın"). Bankaya geçmiş POS satırı: `bank.replan` (gün fişi eşleşmemiş ve açık dönemde); eşleşmiş ya da kilitliyse 409 `pos-settled` ("Bu POS tahsilatı bankaya geçti; müşteriye iade ise POS İadesi yapın"). |
| Modül satırı, `fin_ref` boş | Bugünkü kural (Aşama 0 düzeltmeleriyle) | Bugünkü kural | — |
| Fatura | Düzenle'de peşin satırlar **lineKey** ile eşlenir. Özeti (tutar, yol, hesap/POS, tarih) aynı kalan satırın olayı korunur; değişen satırda eski olay iptal, yeni olay açılır. POS değişirse `bank.replan`. | **İptal / Sil:** Havale peşini olan satır bugünkü gibi silinir; eşleşmişse 409 `bank-reconciled`. POS peşininde onay penceresi sorar: **"POS İşlemi: Müşteriye İade Edildi (varsayılan) / Kayıt Hatası (POS işlemi hiç olmadı)"**. İade Edildi: provizyon süresi içinde ve valörden önceyse void (komisyon yok); değilse **İptal İadesi** (§4.6). Geçmiş gün fişleri değişmediği için eşleşme ve kilit engeli yok. Kayıt Hatası: modül satırı silme kuralı (valörden önce void; geçmişse `bank.replan` ya da 409 `pos-settled`). | Engel yalnız özeti değişen ya da silinen ve eşleşmiş/kilitli **havale** peşini varsa. Yalnız kalem açıklaması değişen düzenleme serbest. |
| Cari kartı | — | Banka bağlı hareketi varsa silinmez; "Pasife Al" (pasif durum var, migrations.mjs:583). | 409 `account-bank-linked` |
| Taksit kartı | — | Banka bağlı tahsilatı varsa önce o tahsilatlar silinir (`bank.cancel`), sonra kart. Taksitte pasif durum yok (CHECK active/closed, migrations.mjs:455). "Kapat" 689'a yazdığı için bu iş için bir yol değil. | 409 `plan-bank-linked`, nedenli |
| Stok kartı | — | Bugünkü gibi; para satırı kalır (stock.mjs:538-541). | — |
| POS satışı (POS İşlemleri listesi) | §4.6 | "İptal Et": provizyon süresi içinde ve valörden önce void. Değilse düğme pasif, yanında yazı: "Provizyon süresi geçti; POS İadesi yapın". | — |
| Ekstre eşleşmesi | — | "Eşleşmeyi Kaldır": para değişmez, audit yazılır. | — |
| Silinenler'den geri yükleme | — | `op 'restore'`. Kaynak modül yetkisi + `records.delete` + `bank.move` + `assertOpen` gerekir. Olay `active`'e döner (audit). POS satışı ve kalemleri asıl valörleriyle yeniden etkinleşir, ardından valör kuyruğu çalışır. Taksitte K8 kuralı (§3.10/3). Aynı provizyonla etkin satış varsa nedenli 409 `pos-auth-duplicate`. | — |
| Taksite Aktar / geri al | `op 'move'`. Satır tablo değiştirir; `event_id`, `fin_ref` ve yol aynı kalır; olay kopyasındaki kaynak tablo güncellenir. Eşleşme özeti (tutar\|tarih\|`fin_ref`\|yol\|yön) değişmediği için eşleşme korunur. K8 ve Benzer İşlem uygulanmaz. | — | — |

Bütün düzeltme ve silme audit kayıtlarında `previous {amount, date, method, fin_ref, event_id}` zorunludur ve `bank.post` içinde yazılır. Kayıt tahsilatında bugün eksik olan `method` (workspace.mjs:370, 391) böylece kapanır.

### 3.9 Eksi bakiye (K7; 2.0.17 m11)

- **Bakiye:** Denetim hesap bazında, işlemin içinde ve yazımdan **sonraki** son durumla yapılır. Bakiye = min(işlem günündeki bakiye, bütün hareketlerle bakiye) + KMH ya da kart limiti. Kaynak tek kaynaktır (`moneyLines`, `ref` bazında).
- **Politika:** Hesap "Bakiye Doğrulandı" olana kadar "Kontrol Yok". Hesap kartında görünür yazı: "Açılış bakiyesi doğrulanmadı; eksi bakiye denetimi kapalı".
  - Doğrulama yolları: açılış formundaki "Bu tutar bankadaki gerçek bakiyedir" kutusu ya da ilk ekstrenin açılış bakiyesinin defterle eşleşmesi.
  - Sonrası varsayılan "Uyar". Ayarlar'dan Engelle ya da Kontrol Yok; hesap kartında hesap bazında da değiştirilebilir.
- **Uyarıyı geçmek** ("Yine de Kaydet", `cashForce`) `bank.move` ister.
- **Kapsam dışı:** Hesabı atanmamış satırlar ve POS (108.T).
- **Uyumluluk:** `/api/admin/negative-policy` bugünkü biçimini korur (`{cash, bank:'off', card:'off'}`); test/donem-213.test.mjs:195-199 ve test/mutabakat/motor.mjs:131-134 değişmeden geçer.
- Döviz hesabında denetim hesabın kendi para biriminde yapılır.

### 3.10 Mükerrer koruma (K8; talimat 9, 11, 33)

1. **Kalıcı istek kimliği:**
   - `request_keys` yazımla aynı işlemde; anahtar kullanıcı\|kapsam\|kimlik; 30 günden eskiler budanır.
   - Fatura dahil bütün kapsamlar buraya taşınır; invoices.mjs:1875 ve 1881'deki `remember` işlemin içine alınır.
   - İstemci `HOF.requestId()`'yi form açılışında üretir; **başarılı kayıttan sonra** açık kalan formda yeni kimlik üretilir.
   - Sunucu `replayed:true` döndüğünde arayüz yazar: "Bu işlem zaten kaydedildi (BNK-2026-000123); ikinci kez yazılmadı."
2. **Benzer İşlem Uyarısı** (varsayılan Açık; `bank.post` adım 4):
   - **Kapsam:** Yalnız hesaba bağlı (`fin_ref` dolu) banka, POS ve kurumsal kart satırları. Nakit ve hesabı atanmamış satırlar denetlenmez. Carisiz Kasa elle girişinde güvenilir hedef yoktur, aynı gün aynı tutarda iki gerçek nakit hareketi olağandır. Hesap tanımlamayan mevcut testler, senaryolar ve kurulumlar bu yüzden değişmez (§11.4).
   - **Anahtar:** yol, hesap/POS, cari, yön, tutar, tarih ve **hedef**. Pencere aynı iş günüdür; süre sınırı yok.
   - **Hedef:** taksit kalemi (seçilmemişse kart), fatura (Kapatılacak Fatura ya da peşin satırın faturası), çek, stok kalemi + miktar, kayıt tahsilatında kayıt anahtarı (`case_key`).
   - Carisiz stok satışında yalnız provizyon numarasıyla denetlenir (kasiyer art arda aynı ürünü satabilir).
   - **Yanıt:** 409 `bank-similar`, önceki İşlem No ve girenle birlikte. "Yine de Kaydet" `similarOk:true` ile yeniden gönderir (`similarOk` VOLATILE listesine eklenir, idempotency.mjs:17).
3. **Taksit (sunucu kuralı, adım 2'de, itemId'den bağımsız), işlem türüne göre:**
   - `create` (yeni tahsilat) ve `restore` (Silinenler'den geri yükleme):
     - Kartın kalanı BEGIN IMMEDIATE içinde yeniden okunur.
     - Kalan 0 ise 409 `plan-paid`.
     - Tutar kalanı aşarsa 409 `plan-overpay`. "Fazlasını Avans Yaz" (`overpay:true`) yalnız `plans.manage` sahibine açık; fazlası kartta "extra", caride alacak olur.
     - Seçilen taksit ödenmişse 409 `installment-paid`.
   - `update`: yalnız tutar artıyorsa ve kartın ödeneni toplamı aşıyorsa aynı kural.
   - `move` (Taksite Aktar ve geri alması): yeni para değil, alınmış paranın yer değiştirmesi. Bugünkü kural sürer: kalanı aşan aktarım `payments-exceed` uyarısıyla izinli (routes/plan-transfer.mjs:158), fazlası "extra" (lib/plans.mjs:111). K8 uygulanmaz.
   - Mevcut veride zaten bulunan fazla tahsilat okunur ve gösterilir, değiştirilmez.
   - Bu kural `test/mutabakat/motor.mjs`'teki `taksit-tahsil` dalını bilerek değiştirir. O dal bugün kalan 0 iken rastgele tutar gönderip başarı bekliyor (motor.mjs:845). Güncelleme §11.4'te.
4. **Doğal anahtarlar** (yalnız etkin satırda tekil):
   - Valör, değerleme, komisyon taslağı: `origin_key`.
   - POS provizyonu: `pos_id` + `auth_code` + tarih.
   - Ekstre: dosya özeti, `external_id`, satır parmak izi.
5. Kimliksiz API isteğinde de hedef kuralları, Benzer İşlem ve doğal anahtarlar çalışır.

### 3.11 Ana Defter ve mutabakat kapısı

**Hesap planı** (`CHART`, general-ledger.mjs:13-37) şu hesapları alır: 300 Banka Kredileri, 309 Diğer Mali Borçlar (Kurumsal Kredi Kartları), 642 Faiz Gelirleri, 646 Kambiyo Kârları, 653 Komisyon Giderleri, 656 Kambiyo Zararları, 659 Diğer Olağan Gider ve Zararlar, 780 Finansman Giderleri.
- 649'un adı "Diğer Olağan Gelir ve Kârlar" olur; tutar değişmez. (Aşama 2 gözden geçirmesi D3/D6: ad, Banka Fişi 649'a yazmaya başladığında
  **Aşama 4'te** değişir; Aşama 2'de 2.0.26'daki "Diğer Olağan Gelirler (Kasaya Elle)" kalır — arayüz değişmez kuralı.)
- 102 ve 108'in kodu ve adı değişmez; alt hesap adları karttan gelir (102.01 "Ziraat · Ana TL").
- 102.00 ve 108.00 "Hesabı Atanmamış Eski Hareketler" olarak görünür.
- 101.01 "Portföydeki Çekler", 101.02 "Tahsile Verilen Çekler".

**`journal()` (bağımsız ikinci yol olarak kalır; mutabakatın anlamı budur):**
1. `cashAccount(method)` (:42) yerine `moneyAccount(way, ref)` gelir ve `{account, sub}` döner:

   | Yol | Bağ | Hesap |
   |---|---|---|
   | cash | — | 100 |
   | bank | hesap | 102 (alt hesap kartın `gl_sub`'ı) |
   | bank | `''` | 102.00 |
   | card | POS | 108.T |
   | card | kurumsal kart | 309.NN |
   | card | `''` | 108.00 |

2. `post`/`postLines` (:70, :136) satıra `party` kalıbıyla `sub` ekler. Kasa↔Banka banka bacağının hesabı `ledger.rows()`'ta alt sorguyla okunur.
3. Her `bank_lines` grubu `bank:<event>` maddesi olur; kuruş doğrudan aktarılır.
4. `source='bank'` satırı genel in/out dalında yazılır: çıkış B 320 / A 108.T ya da 102.x; giriş (komisyon iadesi) B 108.T / A 320.
5. **101 alt hesabı `cheque_collections`'tan türetilir:**
   - receive → 101.01
   - etkin tahsil kaydı → B 101.02 / A 101.01 (verilme tarihinde)
   - Bankadan Geri Al → B 101.01 / A 101.02 (kapanış tarihinde)
   - kaydın `close_event_id`'si olan collect/bounce → A 101.02; diğerleri A 101.01
6. `trialBalance` değişmez. Yeni `subBalances` ve `subTrial` "Alt Hesap Mizanı" raporunu besler.

**`expected()`** (ledger.mjs:87-133) tek kaynaktan okur: 100 = cash, 102 = bank, 108 = card, 309 = ccard, 300 = loan. 193'e Σ `bank_lines` (gl 193) eklenir. 101, 191, 391 ve 360 değişmez.

**Hesap eşlemesi beyaz listesi (E2.10):**

| Rol | İzinli kod |
|---|---|
| bank | 102 |
| pos | 108 |
| card | 309 |
| loan | 300 |
| opening / closing | 500 |
| expense / tax | 653, 656, 659, 770, 780 |
| income | 642, 646, 649 |
| fx_gain | 646 (alt: .01 değerleme, .02 gerçekleşen) |
| fx_loss | 656 (alt: .01 değerleme, .02 gerçekleşen) |
| stoppage | 193 |

- Hiçbir rolde 100, 101, 103, 120, 127, 191, 320, 336, 360 ve 391 seçilemez.
- 102, 108, 300, 309 ve 500 eşlemesi değiştirilemez. Gelişmiş Ayarlar'da yalnız gider ve gelir kodları (fx_gain/fx_loss dahil, kendi satırlarında) değiştirilir. Değişiklik yalnız yeni kayıtlara uygulanır (`bank_lines.gl` yazım anında saklanır).
- Kurumsal kart ve kredi hesabının ana kodu sabit olduğundan geçmiş, okuma anında yeni koda taşınmaz.

**Yeni denetimler:**

| Kod | Ad (ekranda) | Değişmez | Ne zaman |
|---|---|---|---|
| gl:300, gl:309 | (mevcut kalıp) | Ana hesap = tek kaynak | Her COMMIT |
| bank:sub:\<hesap\> | Alt Hesap Mutabakatı | Yevmiyedeki alt hesap bakiyesi = tek kaynağın `ref` grubu. Döviz hesabında ayrıca Σ fx = döviz bakiyesi (kur farkı satırları fx 0). | Her COMMIT (indeksli GROUP BY) |
| pos:terminal:\<pos\> | POS Bekleyen Mutabakatı | 108.T = Σ bekleyen kalem brütü (satış − iade). Totolojik değil. | Her COMMIT |
| cheque:collections | Tahsildeki Çekler | 101.02 = Σ etkin `cheque_collections`. Her `cheque_deposit`/`cheque_withdraw` olayının kaydı var. Tahsildeki çekin `cheques.status`'u `portfolio`. Çek başına en çok bir etkin kayıt. | Her COMMIT |
| bank:opening:\<hesap\> | Açılış Kuralı | En çok bir etkin açılış (sıfır olabilir); açılıştan önce bağlı satır yok | Her COMMIT |
| bank:event | İşlem Başlığı | `fin_ref` dolu ise olay var. İptal edilmiş olayın etkin satırı yok. Ters kaydedilmiş olayın ters kaydı var. Kopya (tutar, yol, yön, hesap, cari, tarih) = satır. Para satırı olmayan türler (`cheque_deposit`, `cheque_withdraw`, `legacy_assign`, `pos_cancel_refund`) kendi tablolarıyla denetlenir. | Dokunulan olaylar; tam tarama |
| money:event | Olaysız Para Satırı | Bu işlemde eklenen ve para satırı koşulunu sağlayan her satırda `event_id` dolu (§3.3/b) | Her COMMIT (rowid işaretiyle) |
| bank:refs | Banka Bağı Uyumu | bank → TRY hesap (13b'de döviz hesabı + fx kolonları, `typeof(fx_minor)='integer'`). card+in → POS ya da kurumsal kart. card+out → POS iadesi ya da kurumsal kart. `source='bank'` → POS kesintisi/iadesi (card) ya da komisyon tahsili (bank). Kredi hesabı modül satırında yok. Kasa elle girişi ve `opening=1` satırları `''`. | Dokunulan; tam |
| bank:voucher | Banka Fişi Dengesi | Σ B = Σ A (TL kuruş); gl beyaz listede; TRY satırında fx = TL; ters fiş asıl fişin aynası | Dokunulan; tam |
| bank:transfer | Transfer ve Kasa↔Banka İkizi | Tek B ve tek A para satırı; farklı hesap; aynı para birimi; A = B + Σ ücret. Kasa ikizi tam. | Dokunulan; tam |
| pos:source | POS ↔ Tahsilat Satırı | Satış brütü = olayın etkin satırları. Void satışın etkin satırı yok. İptal İadesi (`src='cancel'`) modül satırı taşımaz; asıl satışın olayı `cancelled`, satırı silinmiş. | Dokunulan; tam |
| pos:refund | İade ≤ Satış | Kaynaklı iadelerde (İptal İadesi dahil) Σ iade ≤ satış | Dokunulan; tam |
| pos:schedule | Valör Takvimi | Σ kalem brütü = satış brütü − iade brütü; net = brüt − kom − vergi − ücret ≥ 0 (eksiyse `fee` kalemi); geçmiş kalemin fişi var | Dokunulan; tam |
| bank:party | POS Kesintisi ↔ Sağlayıcı | Tutar ve yön kalemle tutar; cari `pos_sales`'teki **anlık sağlayıcı kopyasıyla** karşılaştırılır | Dokunulan; tam |
| bank:matches:\<hesap\> | Ekstre Eşleşmeleri | Etkin eşleşmenin olayı `active`; şimdiki özet = eşleşme anındaki özet; Σ eşleşen ≤ ekstre satırı | Dokunulan olay; tam |
| money:method / money:report | Tanınmayan Yol; Rapor = Özet | §3.4 | Dokunulan; tam |
| dates:\*:fin_events, dates:\*:cheque_events | (DATED kalıbı) | Tarih geçerli. İleri tarih denetimi **taban kümesine göre**: açılışta bulunan ileri tarihli satırların kimlikleri taban sayılır, sapma sayısı yalnız bu kümede olmayan ileri tarihli satırlardır. Eski satırlar yaşlandıkça imza değişmez (A13). | Her COMMIT |
| period-lock | genişleyen kilit izi (§5.5) | — | Her COMMIT |

- **Varlık bazında kod (E1.16):** Taban sapması yalnız kendi hesabını ya da POS'unu kilitler (B3 imza kuralı); bir POS'taki sapma öbür POS'taki satışı engellemez.
- **Kapı ölçeği (E1.07, E2.14; Aşama 2'de ölç, sonra karar ver):**
  1. **Dokunulan olaylar:** `bank.post` her işlemde `touched.events`'i doldurur; olay bazındaki denetimler yalnız bunlara uygulanır.
     - Tam tarama açılışta, Mutabakat Testi'nde ve 15 dakikada bir arka planda salt okuma olarak koşar.
     - Bulduğu sapma geri alınamaz; zil ve `integrity_log` kaydı yazılır. Testlerde her zaman kırmızıdır.
  2. `bank_matches` FINANCIAL kümesinde değil; eşleşme onayı rotası özeti ve tutarı kendisi denetler.
  3. MINOR denetimi yok; STRICT tablo ve CHECK kısıtları yeter.
  4. **Kilitli dönem anlık görüntüsü:** Kilit konunca `ledger_snapshots` yazılır (kilit tarihi; hesap, alt hesap, cari bakiyeleri). Yevmiye yalnız açık dönem satırlarından kurulur ve anlık görüntüye eklenir. Kilit izi her COMMIT'te sha256 olarak kalır. Ölçüm 100.000 satırda bütçeyi aşarsa her COMMIT'te tablo başına SQL sağlamasına (satır sayısı, Σ kuruş, Σ rowid×kuruş) geçilir; sha256 tam taramaya kalır. **Güvenlik ölçülmeden zayıflatılmaz.**
  5. **Bütçe:** Tek yazmada kapı süresi 100.000 para satırında ≤ 150 ms, 1.000.000'da ≤ 1 sn. Banka ekinin payı ≤ %15. Hareketler sayfası ve arama 1.000.000 satırda < 1 sn.

### 3.12 Döviz, kur ve değerleme (K9; talimat 21; ek 2, 3)

- **Saklama:** Döviz hesabı kendi para biriminde tutulur. Her satırda döviz tutarı, TL karşılığı, kur (`rate_e6`) ve kur kaynağı bulunur. Kur değişince geçmiş tutar yeniden hesaplanmaz.
- **Ortalama maliyet (tek tanım; Döviz Sat ve 13b ödemesinde aynı):**
  - Ortalama maliyet = kayıt anındaki (bugüne kadarki bütün satırlarla) hesabın defter TL'si / döviz bakiyesi.
  - Çıkışta düşülen defter TL'si = round(çıkan döviz × ortalama maliyet).
  - Çıkış döviz bakiyesini sıfırlıyorsa defter TL'sinin **tamamı** düşülür; TL artığı kalmaz.
  - Gerçekleşen kur farkı kayıt anında hesaplanıp `bank_lines`'ta saklanır. Sonradan araya girilen geriye tarihli döviz girişi önceki farkı değiştirmez; kalan farkı dönem sonu değerlemesi kapatır.
- **Döviz Al** (1.000 USD, banka kuru 34,2500): B 102.03 (1.000 USD; 34.250,00 TL) / A 102.01 34.250,00.
- **Döviz Sat** (500 USD @ 35,0000; ortalama maliyet 34,25): B 102.01 17.500 / A 102.03 17.125 · A 646.02 375 (Gerçekleşen). Zararda 656.02. Kambiyo vergisi satırı dekonttaki tutarla girilir.
- **13b, döviz hesabına cari tahsilatı / ödemesi:**
  - **Kur:** Bankanın işlem kuru (dekonttan). Yoksa **her iki yönde TCMB döviz alış kuru** (K9); elle değiştirilebilir. `fx_source` (`bank` \| `tcmb-buy` \| `manual`) saklanır.
  - **Tahsilat:** Modül satırı `amount` = döviz × kur (cariye yazılan TL), `fx_minor` = döviz; 102.03 bu TL ile artar. Ortalama maliyet bir sonraki çıkışta yeni bakiyeyle hesaplanır. Gerçekleşen fark yok.
  - **Ödeme:** Modül satırı `amount` = döviz × işlem kuru (cariye yazılan TL); defterden yine bu TL düşer. Aynı olayda Banka Fişi satırı defter TL'sini ortalama maliyete getirir. Kârda B 102.03 (fx 0) / A 646.02 (fx_gain); zararda B 656.02 (fx_loss) / A 102.03 (fx 0).
    - Örnek: 1.000 USD @34,50 tahsil edilmiş hesaptan XYZ'ye 500 USD @35,00 → XYZ'ye 17.500 · 102.03 net −17.250 · 646.02 = 250.
    - Ödeme bakiyenin tamamıysa fark = kalan defter TL'si − işlem TL'si; 102.03 TL'si 0 olur.
    - Dönem sonu değerlemesi (646.01/656.01) yalnız elde kalan dövizin gerçekleşmemiş farkını kapatır. Gerçekleşen fark yanlışlıkla "gerçekleşmemiş" sınıflanmaz.
  - Dövizli faturayla tahsilat arasındaki kur farkı caride kalır; "Kur Farkı Faturası" önerilir (mevcut Fiyat Farkı Faturası akışı).
- **Fatura formunda TCMB önerisi:** Belge tarihi ve para birimi seçilince kur alanına öneri gelir: satışta TCMB döviz alış, alışta döviz satış (K9; ipucu "TCMB Döviz Alış, 07.10.2026"). Kur elle değiştirilebilir; kaynak `invoices.rate_source`'ta saklanır. Ağ yoksa alan boş kalır ve "Kur alınamadı; elle girin" yazısı çıkar. Alan yazılırken yeniden çizilmez (2.0.23 Bulgu 1 dersi).
- **Kur kaynağı** (`fx/tcmb.mjs`):
  - Adresler: `https://www.tcmb.gov.tr/kurlar/today.xml` ve `…/kurlar/YYYYMM/GGAAYYYY.xml`.
  - İstek işlem dışında atılır; `fx_rates`'e yazım ayrı, küçük bir işlemdir.
  - Zamanlama: iş günü 15:45'ten sonra bir kez, açılışta eksik gün için ve "Kurları Güncelle" düğmesiyle.
  - Tatilde son yayımlanan kur kullanılır. Elle kur her zaman öncelikli; işlem hiçbir zaman kur yüzünden engellenmez.
- **Dönem sonu değerleme:**
  - Kur: TCMB döviz alış (VUK 280). Önizleme: döviz bakiyesi × kur − defter TL'si. Örnek: 500 USD × 35,80 = 17.900 − 17.125 = 775 → B 102.03 775 (fx 0) / A 646.01 775.
  - `origin_key 'reval:<hesap>:<tarih>'` yalnız etkin satırda tekil; ters kaydedilen değerlemeden sonra aynı tarihe yeniden değerleme yapılabilir.
  - Tarih açık dönemde ve bugün ya da öncesi olmalı.
  - Ters kayıt varsayılan Kapalı. Açılırsa `bank_jobs` (`reval-reverse`, vade = tarih + 1) oluşur; kuyruk o gün gelince ters fişi yazar (ileri tarihli satır olmaz, E2.12).
  - Kilit konmadan önce "Bu dönem değerlenmedi" bilgisi gösterilir.
- **Genel Bakış'ta TL Karşılığı** defter TL'sidir (mizanla aynı). "Güncel Kurla" kolonu yalnız bilgidir.

### 3.13 Ekstre ve mutabakat (talimat 22–23)

1. **Okuma (istemcide, salt okuma):**
   - SheetJS işçisi (`hof-excel-worker.js`). CSV'de kodlama algılanır (UTF-8 BOM, UTF-8, Windows-1254 → `TextDecoder`); ayraç `;`, `,` ya da sekme.
   - Türkçe sayı ("1.234,56", "-1.234,56", "1.234,56 B/A"); tarih gg.aa.yyyy, gg/aa/yyyy, yyyy-aa-gg; tutar ayrı Borç/Alacak kolonlarında ya da işaretli tek kolonda.
   - Kolon eşleme `HOF.office.chooseSheet` + `wireGate` kalıbıyla (hof-cheques.js:355-379). Banka şablonu hesaba kaydedilir.
   - 3–4 bankanın anonim örnek biçimi fikstür olarak kullanılır (müşteri verisi değil).
2. **Gönderim:** Uçlar `readJson` limitini 40 MB'a yükseltir (accounts.mjs:729 kalıbı) ya da istemci 5.000 satırlık parçalarla gönderir. En çok 50.000 satır.
3. **Önizleme** (`dryRun`):
   - Dosya özeti aynıysa 409 `statement-duplicate`, "Yalnız Yeni Satırları Al" seçeneğiyle.
   - Satır parmak izi: `sha256(hesap|tarih|yön|kuruş|normal açıklama|referans|bakiye|aynı anahtarın sıra no'su)`.
   - Hesapta zaten olan satır "Mükerrer" işaretlenir, sessizce atılmaz; "Mükerrer Değil" denebilir.
   - Bakiye zinciri kopuksa "Arada eksik dönem" uyarısı.
4. **Aktarım:** Tek işlemde; ekstre tabloları FINANCIAL değil. API'den gelen ekstre `source='api'` ve tekil `external_id` taşır, elle girilenle karışmaz (talimat 37).
5. **Öneri** (deftere yazmaz):
   - **Adaylar:** aynı hesapta etkin ve eşleşmemiş olaylar + açık dönemdeki hesabı atanmamış eski satırlar ("Hesabı Atanmamış" rozetiyle; E1.17). Yön aynı, tutar kuruşu kuruşuna eşit, tarih ±3 gün.
   - POS valör fişi (POS, gün) başına net tek fiştir (§4.4/1). Ayrıca çoğa-bir aday aranır: aynı gün en çok 5 olayın net toplamı.
   - **Puan (en çok 100):**

     | Bileşen | Puan | Ne zaman |
     |---|---|---|
     | Tarih | 0 gün 40 · 1 gün 30 · 2–3 gün 15 | Her aday |
     | Belge bağı | 30 | Açıklamada ya da referansta İşlem No, fatura no, makbuz no ya da olayın referansı geçiyor |
     | Karşı IBAN | 30 | Ekstredeki karşı IBAN carinin IBAN'ı ya da (iç transferde) şirketin karşı hesabının IBAN'ı |
     | Ad / anahtar sözcük (en çok 25) | Cari adayında Türkçe normalleştirilmiş ad benzerliği 0–25. **Sistem fişinde** türün sözlüğünden sözcük ya da kimlik eşleşirse 25: POS gün fişi ↔ POS adı, Üye İşyeri No, Terminal No ya da "POS", "ÜYE İŞYERİ", "UYE ISYERI", "GÜN SONU", "BATCH"; Kasa↔Banka ↔ "NAKİT", "ÇEKİM", "YATIRMA", "ATM", "VEZNE"; bankalar arası transfer ↔ karşı hesabın banka ya da hesap adı, "VİRMAN", "HESAPLAR ARASI"; masraf fişi ↔ "ÜCRET", "MASRAF", "KOMİSYON", "BSMV"; faiz ↔ "FAİZ", "STOPAJ". Sözlük Gelişmiş Ayarlar'da genişletilebilir. |
     | Tekillik | 15 | ±3 gün penceresinde aynı yön ve aynı kuruşta tek aday var **ve** ekstrede o gün o tutarda tek satır var |

   - **Sınıflar:**
     - 80 ve üstü + tek aday → "Önerilen (Güçlü)"
     - 50–79 → "Önerilen"
     - altı → "Eşleşmeyen"
     - Aday yoksa ve açıklama sözlükte bir türe uyuyorsa (ör. "EFT ÜCRETİ" → masraf) satıra "Hareket Oluştur: Masraf" önerisi eklenir.
   - **Aynı adlı iki cari ya da eşit puanlı iki aday** varsa "Güçlü" verilmez (tekillik puanı da düşer); iki aday birlikte gösterilir.
   - Örnek (§12.5 adım 29–30): "ABC LTD EFT" +20.000 = 40 + 25 (ad) + 15 = 80 Güçlü. "POS ÜYE İŞYERİ" +9.750 = 40 + 25 (POS sözlüğü) + 15 = 80 Güçlü. "NAKİT ÇEKİM" −10.000, "VİRMAN GARANTİ" −20.000, "POS İADE" −3.000 de aynı yolla 80. "EFT ÜCRETİ" −10,50 için aday yok → Eşleşmeyen + Masraf önerisi.
6. **Onay:** `bank_matches` + özet yazılır. Eski satır için "Bu Hesaba Ata + Eşleştir" tek işlemdir (açık dönemde; `op 'assign'`). Onaysız eşleşme yapılmaz; "Güçlü Önerileri Otomatik Onayla" varsayılan kapalı.
7. **Kaldırma:** `undone_at` doldurulur, audit yazılır, para değişmez (talimat 23).
8. **Hareket Oluştur:** Programda olmayan satır için masraf, faiz, cari tahsilat ya da transfer formu ekstre bilgisiyle dolu açılır. Kayıt, para satırı + `bank_matches(kind 'created')` olarak tek işlemde yazılır.
9. **Sınıflar** (talimat 22): Eşleşen, Eşleşmeyen, Önerilen Eşleşme, Mükerrer, Manuel Eşleştirildi, Yok Sayıldı.
10. **Banka Mutabakat Cetveli:** Ekstre kapanış bakiyesi ± bankaya yansımamış giriş/çıkışlar ± programda olmayan ekstre satırları = defter (102.x). Açıklanmamış fark 0 olmalı.
11. İlk ekstrenin açılış bakiyesi defterle eşleşirse hesap "Bakiye Doğrulandı" olur (K7).

### 3.14 Çek/senet: Bankaya Tahsile Ver (K9)

- `cheques.status` (migrations.mjs:709) ve `cheque_events.kind` (:729) CHECK kısıtlarına dokunulmaz. **Tahsile verme ve geri alma `cheque_events`'e hiç satır yazmaz.** İz iki yerde tutulur:
  - `cheque_collections` (cheque_id, bank_account_id, given_date, status, closed_date, event_id, close_event_id)
  - `fin_events` (`cheque_deposit` / `cheque_withdraw`; para satırı yok, `cheque_id` dolu)
- **Eylemler** (`POST /cheques/:id/actions`, `action: 'bank-deposit' | 'bank-withdraw'`):
  - **"Bankaya Tahsile Ver":** yalnız portföydeki (`status='portfolio'`) alınan çekte. Hesap (TRY) ve tarih seçilir; tarih için `movementDate` kuralı, tarih alış tarihinden önce olamaz.
    - Yazılanlar: `cheque_collections(pending, event_id)` + `fin_events(cheque_deposit)`.
    - Yevmiye: B 101.02 / A 101.01. 101 toplamı ve beklenen değeri değişmez. `cheques.status` `portfolio` kalır.
  - **"Tahsil Edildi"** (mevcut collect eylemi): yol bank, hesap tahsil kaydının hesabıyla ön seçili; başka hesap 400.
    - Yazılanlar: `cheque_events(collect)` (izinli tür) + kayıt `collected`, `close_event_id` = collect olayının `event_id`'si.
    - Yevmiye: B 102.x / A 101.02.
  - **"Bankadan Geri Al":** kayıt `withdrawn` + `fin_events(cheque_withdraw)`. Yevmiye: B 101.01 / A 101.02. `cheques.status` değişmez.
  - **"Karşılıksız"** (bankadan dönen): mevcut `cheque_events(bounce)` + kayıt `returned`, `close_event_id` dolu. Yevmiye mevcut bounce maddesinde A 101.02.
- **Geçiş kuralları:** Tahsildeki çek ciro edilemez, silinemez, tutarı ve tarihi değiştirilemez (409 `cheque-deposited`, "önce Bankadan Geri Al").
- **Görünüm:** Kartta ve listede sanal durum "Bankada Tahsilde · Ziraat · 12.10.2026" (etkin tahsil kaydından türetilir; `cheques.status` değişmez). Çek listesi süzgecinde "Portföyde" ile "Bankada Tahsilde" ayrı. Nakit akışında ve Vade Takip'te vade + hesabın valörüyle beklenen giriş.
- **Kilit izi:** verilme ve kapanış ayrı girdiler (§5.5). Kilitli ayda tahsile verilen çek açık ayda tahsil edilebilir.

### 3.15 Ülkeye özgü katmanlar ve gelecek hazırlığı (talimat 19, 37, 38, 39)

- **Çekirdek ülke bilmez:** `minor.mjs`, `bank/engine.mjs`, `bank/post.mjs`, `money-lines.mjs`.
- **Türkiye'ye özgü parçalar ayrı dosyalarda:** `calendars/tr.mjs`, `fx/tcmb.mjs`, IBAN doğrulaması (`isValidIban`, tax-id.mjs:72), ekstre biçimleri ve anahtar sözcük sözlükleri, BSMV/KDV vergi profilleri.
- **Kanal alanı:** Havale / EFT / FAST / SWIFT (isteğe bağlı); masraf önerisinde ve eşleştirmede kullanılır.
- **Bağdaştırıcı kaydı** (kapalı): Açık bankacılık, otomatik ekstre, sanal ve fiziki POS. Anahtarlar `secret-box.mjs` ile mühürlenir. Gelen hareket önce **ekstre satırı** olur, deftere doğrudan yazılmaz.

---

## 4. POS Mimarisi

### 4.1 Varlıklar

- **`pos_terminals`** (talimat 12): POS Adı, Banka, Bağlı Hesap (TRY), POS No (Üye İşyeri No), Terminal No, Tür (Fiziki / Sanal / Mobil), Para Birimi, Sabit İşlem Ücreti, Valör Kuralı ve Günü, Bloke Günü, Taksitli Ödeme Biçimi, İadede Komisyon, Geçiş Kipi, Çalışma Durumu, Açıklama. Alt hesap 108.NN. Ayrıca:
  - **Sağlayıcı Türü** (Banka / Ödeme Kuruluşu; K2)
  - **Vergi Türü** (BSMV / KDV / Yok) + **Dahil / Hariç**
  - **Sağlayıcı Carisi** (KDV'de zorunlu)
  - **Provizyon Süresi** (gün): iptal penceresi. Bu süre içinde ve valörden önce yapılan iptal komisyonsuz void sayılır; 0 = aynı gün.
- **`pos_rates`** (talimat 13–14): taksit sayısı (1 = Tek Çekim) × oran (ppm) × isteğe bağlı valör, `valid_from` ile. Kayıt yerinde güncellenmez; yeni oran yeni tarihten geçerli.
- **`pos_sales`:** Satış ya da iade; olaya bağlı (`event_id`). Satış anındaki kopyalarıyla saklanır: oran, vergi, ücret, ödeme biçimi, **bağlı hesap** (`bank_account_id`), **sağlayıcı carisi** (`provider_account_id`). İadede `src`: `module` (iade satırıyla), `cancel` (İptal İadesi, modül satırı yok), `sourceless` (Kaynaksız Eski Satış). Ayrıca `auth_code` (provizyon) ve `card_last4` (CHECK: 4 rakam); kart numarası saklanmaz.
- **`pos_items`:** Valör takvimi. Rol `sale | refund | fee`, durum `pending | settled | void`; `blocked` ve `settle_error` alanları var.

### 4.2 Satış akışı

POS ayrı bir satış ekranı değil, tahsilat yoludur. Cari, fatura peşini, taksit, kayıt ve stok formlarında "POS" seçilince "POS", "POS Taksit Sayısı" ve önizleme alanları açılır. Banka → POS → "+ POS Tahsilatı" cari tahsilat formunu POS seçili açar.

| Durum | Örnek | `pos_items` | Satış anı yevmiyesi |
|---|---|---|---|
| Tek çekim | 10.000 TL, %2,5, valör 2 iş günü, satış 08.10.2026 Perşembe | 1 kalem, valör 12.10.2026 Pazartesi, net 9.750 (BSMV oranın içinde) | B 108.01 10.000 / A 120 → **Banka +0, POS Bekleyen 10.000** |
| Taksitli, taksit taksit ödeme | 12.000 TL, 3 taksit, %3,5 (komisyon 420), satış 08.10.2026 | 3 kalem × 4.000 brüt, 140 komisyon, 3.860 net. Valör: 09.11.2026 (8.11 Pazar → Pazartesi), 08.12.2026, 08.01.2027. Kuruş artığı son kaleme. | B 108.01 12.000 / A 120 |
| Taksitli, tek seferde | Aynı satış | 1 kalem, valör = oran satırındaki gün | Aynı |
| Blokeli (ek 4) | 30 takvim günü | Valör 07.11.2026 Cumartesi → 09.11.2026; `blocked=1`; raporda "Blokeli POS" ayrı kategori | Aynı |

**Doğrulama:**
- POS aktif ve TRY olmalı.
- Taksit sayısının oranı tanımlı olmalı; yoksa 400: "Bu POS'ta 9 taksit oranı tanımlı değil."
- Aynı provizyon numarası ikinci kez → 409 `pos-auth-duplicate`.
- POS yalnız tahsilatta ve iadede kullanılır (§4.6).

### 4.3 Komisyon ve vergi kipleri (K2; ek 2)

Ortak hesap: `kom = round(brüt × oran_ppm / 10^6) + sabit ücret`. Komisyon gideri her kipte 653'e gider (POS komisyonu türü), vergi kipi yalnız vergi satırını değiştirir.

| Kip | Kesinti | 10.000 @ %2,5 | Valör günü yevmiyesi |
|---|---|---|---|
| **BSMV Dahil** (Banka; varsayılan) | kom; BSMV oranın içinde, bilgi için BSMV = kom − round(kom/1,05) | 250 (BSMV 11,90) → **net 9.750** | B 102.01 9.750 · B 653 250 / A 108.01 10.000 |
| BSMV Hariç | kom + round(kom × %5) | 262,50 → 9.737,50 | B 102.01 9.737,50 · B 653 262,50 / A 108.01 10.000 |
| **KDV Hariç** (Ödeme Kuruluşu; varsayılan) | kom + round(kom × %20) | 300 → **net 9.700** | B 102.01 9.700 / A 108.01 9.700 + kesinti satırı `account_entries(source='bank', out, card, fin_ref=POS, sağlayıcı carisi)` 300 → B 320 / A 108.01 300 |
| KDV Dahil | kom; matrah round(kom/1,2) | 250 → 9.750 (matrah 208,33; KDV 41,67) | B 102.01 9.750 / A 108.01 9.750 + kesinti satırı 250 → B 320 / A 108.01 250 |
| Yok | kom | 250 → 9.750 | B 102.01 9.750 · B 653 250 / A 108.01 10.000 |

**KDV kipinin kuralları (E1.10, E2.03, D2.02):**
1. Kesinti satırı tek kayıttır; `journal()` onu genel out dalında B 320 / A 108.T olarak yazar. Banka Fişi aynı tutar için satır yazmaz. Komisyon iadesi giriş satırıdır (B 108.T / A 320).
2. **Ödeme rolü var, FIFO'ya girmez ("yalnız bağlı" kip):**
   - `lib/accounts.mjs:45` origin eşlemesine `source='bank' → 'pos-fee'` eklenir. Bugün bu kaynak "account" sayılıyor ve FIFO'ya giriyor.
   - `classifyLine` (invoice-settle.mjs:55-92) `pos-fee` kökenine **yalnız borç (payable) tarafında ödeme rolü** verir: çıkış (kesinti, komisyon tahsili) `payPay`; giriş (komisyon iadesi) eksi tutarlı `payPay`. Alacak (receivable) tarafında rolü yoktur.
   - `runSide` havuz öğesine `linkedOnly: true` bayrağı eklenir. Bu öğe yalnız 1. adımda (bağlı ödemeler, invoice-settle.mjs:262-266) kendi faturasına kapar. 1b (Mevcut Borç kartı) ve 2. adım (FIFO, en eski yükümlülük) onu atlar; "Taksit kartından artan" havuzuna da girmez.
   - Aynı faturaya bağlı `pos-fee` satırları tek havuz öğesinde netlenir (Σ çıkış − Σ giriş); sonuç ≤ 0 ise kapama yapmaz.
   - Bağlanmamış kesinti hiçbir faturayı kapatmaz. Sağlayıcı carisinde bizim lehimize (ön ödeme) bakiye olarak durur ve "Faturası Beklenen Komisyonlar" raporunda görünür. Sağlayıcının ilgisiz açık alış faturası hayalet "Ödendi" olmaz (2.0.17 m5 sınıfı); komisyon faturası bağlandığı anda "Ödendi" olur.
   - Bu değişiklik yalnız `pos-fee` kökenini etkiler; mevcut kökenlerin kapaması birebir aynı kalır (`fatura-216`, `bulgu-223`, `iade-224` testleri değişmeden geçer).
3. **Aylık taslak:**
   - Tetik: ayın ilk valör kuyruğu turu (önceki ay için) ve POS sekmesindeki "Şimdi Oluştur".
   - `origin_key 'comm-inv:<pos>:<YYYY-AA>'` ile tekil; taslak silinirse yeniden oluşturulabilir.
   - Taslak, sağlayıcı carisine açılan "Hizmet ve Gider Alışı"dır: gider türü **"POS ve Ödeme Kuruluşu Komisyonları" → 653**, **KDV Dahil**, toplam = o ayın bağlanmamış kesintileri − komisyon iadeleri. Net ≤ 0 ise taslak açılmaz; tutar raporda "İade Alacağı" görünür.
   - Toplam kesintilerin kendisi olduğu için kuruş artığı yapısal olarak oluşmaz; 653/191 ayrımını faturanın kendi hesabı yapar.
4. **Kaydet:**
   - Kullanıcı taslağı gelen e-faturayla karşılaştırıp kaydeder. O ayın kesinti ve iade satırları aynı işlemde `invoice_id` ile bu faturaya bağlanır (`bank.post op 'assign'`; Kapatılacak Fatura bağı, 2.0.17).
   - Fatura toplamı kesintilerden farklıysa Kaydet farkı söyler. Fark sağlayıcı carisinde açık kalır; fatura "Kısmen Ödendi · Açık <fark>" olur ve "Faturası Beklenen Komisyonlar" raporunda "Fark" görünür.
5. **Seçenekler:** Ay Sonunda Toplu Taslak (varsayılan) / Her Valörde Taslak / Elle.
6. **`source='bank'` satırı:**
   - Cari kartından düzeltilmez, silinmez (`requireEntryRight` 409 kalıbı, accounts.mjs:546-551); Silinenler'e gitmez.
   - Ekstrede ve WhatsApp ekstresinde "POS Komisyon Kesintisi" ya da "POS Komisyon İadesi" etiketiyle görünür.
   - Bu satırı taşıyan cari silinemez.
7. **Kapı:**
   - `bank:party` cariyi `pos_sales.provider_account_id` kopyasıyla karşılaştırır; POS kartında sağlayıcı değişse de geçmiş sapmaz.
   - `bank:refs` satırı POS kesintisi/iadesi (card) ya da komisyon tahsili (bank) olarak tanır.
8. **191 ve KDV raporu yalnız faturadan gelir.**

**Kabul testi adım 24 iki kiple koşulur:**
- BSMV Dahil kipinde net 9.750; 653 = 250.
- KDV Hariç kipinde net 9.700 + 300 tutarında taslak (KDV Dahil: 250 + 50). Kayıttan sonra 191 = 50 = KDV raporu; taslak fatura "Ödendi".

**Ek test (Aşama 11):** Sağlayıcı carisinde ilgisiz açık alış faturası 1.000 + iki kesinti (300 + 300).
- Taslak kaydedilmeden önce: ilgisiz fatura "Açık 1.000".
- Taslak 600 kaydedilince: komisyon faturası "Ödendi", ilgisiz fatura yine "Açık 1.000"; cari bakiye 1.000 (bizim borcumuz).
- Taslak 610 kaydedilirse: "Kısmen Ödendi · Açık 10".

### 4.4 Valör geçişi (K3; talimat 15)

1. **Ne yazılır:** Gerçek bir Banka Fişi (`pos_settlement`).
   - Gruplama **(POS, valör günü)** başına tek **net** fiştir (E1.09). Satırlar: brüt satış (A 108.T), iade (B 108.T), komisyon ve vergi (B 653 ya da yok), komisyon tahsili. Net 0 ya da artıysa B 102.x, eksiyse A 102.x.
   - Fişin açıklaması "POS Gün Sonu · <POS adı>", referansı Üye İşyeri No'dur; ekstre puanlaması bunları kullanır (§3.13/5).
   - `origin_key 'pos-day:<pos>:<gün>:r<n>'` yalnız etkin satırda tekil; `bank.replan` revizyon numarasını artırır.
   - Koşullu `UPDATE pos_items … WHERE status='pending'` + BEGIN IMMEDIATE sayesinde iki tetik aynı anda çalışsa da tek fiş oluşur.
2. **Tetikler:**
   - (a) Sunucu dinlemeye başladıktan sonra kuyruk. 001'de `listen` sonrası `setImmediate`. Çocuk şirkette `appFor` içinde `createApp` döndükten sonra `setImmediate`; istek içinde değil.
   - (b) 15 dakikada bir (`unref`, `app.close`'ta durur; backup.mjs:228-234 kalıbı).
   - (c) Gün dönümü (alertScheduler, app.mjs:483-484).
   - (d) Hub'da günde bir kez: bu süreçte açılmamış şirket kısa süreliğine salt okunur açılır (app.mjs:478-480 kalıbı). `pos_items` ya da `bank_jobs`'ta vadesi gelmiş kayıt varsa şirket açılır ve kuyruk çalışır.
   - (e) Onay kipinde ekstre eşleşmesi ya da "Bankaya Geçti".
   - (f) "Şimdi Aktar" (`bank.move`).
   - (g) Dönem kilidi konmadan önce (madde 6).
3. **Tur sınırı:**
   - Bir tur en çok 200 grup ya da 1 saniye; kalan gruplar `setImmediate` ile sonraki tura.
   - Bir tur tek işlemdir, kapı bir kez çalışır. Reddedilirse gruplar bütçe içinde tek tek denenir.
   - Başarısız grup `settle_error` ile işaretlenir; zil gider, Mutabakat Testi'nde nedeni görünür, sonraki turda yeniden denenir.
4. **GET yazmaz:** Okuma uçları "Valörü Gelmiş, Aktarılmadı (n kalem, X TL)" bilgisini döndürür. Gerçek banka yalnız yazılmış fişlerden hesaplanır.
5. **İleri tarih:** `value_date` bugünden sonra olan kaleme fiş yazılmaz. `pos_items`, `bank_plans` ve `bank_jobs` DATED listesine girmez; `fin_events` girer (taban kümesi kuralıyla, §3.11).
6. **Kilit:**
   - `value_date` kilit tarihinde ya da öncesindeyse fiş ilk açık güne (kilit + 1) `late=1` ile yazılır, "Gecikmeli Aktarım" etiketi taşır; gerçek valör kalemde kalır.
   - Kilit + 1 bugünden sonraysa kalem "Kilit Nedeniyle Bekliyor" olarak kalır.
   - `PUT /api/admin/period-lock` önce kilitlenecek döneme düşen vadesi gelmiş kalemler için kuyruğu eşzamanlı çalıştırır. Hâlâ bekleyen varsa 409 `bank-pending-before-lock` + liste döner; bu uyarıdır, "Yine de Kilitle" `force` geçer.
   - `pos_items` kilit izine girmez; `pos_sales`'in yalnız değişmeyen alanları girer.
7. **Onay kipi** ("Ekstre ile ya da Elle Onay", Gelişmiş Ayarlar):
   - Valörü gelen kalem "Onay Bekleyen" listesine düşer.
   - Onayda gerçek tarih ve net tutar girilir. Fark BSMV kipinde 653'e, KDV kipinde sağlayıcı carisine "Komisyon Farkı" satırı olarak yazılır.
   - Planlanan ile gerçek arasındaki fark raporlanır.
8. **Aktör:** `system` kullanıcısı ("Sistem (Valör)"); audit `bank.pos.settled`. Sistem aktarımı salt okunur lisansta da yazılır, çünkü geçmiş satışın sonucudur.
9. **Açılış süresi:** Kuyruk açılışı beklemez; 90 saniyelik güncelleme deneme açılışı (update-orchestrator.mjs:32, 139) etkilenmez. 50 POS × 30 gün kesinti sonrası ilk tur süresi Aşama 11'de ölçülür.

### 4.5 İş günü servisi (talimat 16)

- `business-days.mjs` saf, veritabanı kullanmaz. `createCalendar({ weekend:[6,0], holidays, halfDayIsBusiness })` şunları sunar:
  - `isBusinessDay`, `adjust(d, 'following' | 'modified_following' | 'preceding')` (ISDA adları)
  - `addBusinessDays`, `addCalendarDays`, `addMonths` (ay sonu güvenli: 31 → 28/29/30)
  - `valueDate(txn, rule, days)`
  - `explain(d)`: İşlem Kartı'nda valör nedenini gösterir
- `calendars/tr.mjs`:
  - Sabit tatiller: 1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 29 Ekim; 28 Ekim yarım gün.
  - Ramazan ve Kurban bayramları ile arifeleri yıl tablosunda. Tarihler uygulama sırasında Diyanet ve Resmî Gazete ilanından doğrulanıp 2026–2031 için yazılır; bu planda tarih verilmez.
  - Tablonun son yılından önce zil uyarısı.
- `bank_holidays`: şirketin eklediği ya da çıkardığı günler.
- **Varsayılanlar:** Hafta sonu Cumartesi–Pazar; tatile düşen gün → Sonraki İş Günü; yarım gün iş günü sayılır.
- **Örnekler:**
  - 02.10.2026 Cuma + 2 iş günü = 06.10.2026 Salı.
  - 27.10.2026 Salı + 2 iş günü: 28.10 (yarım gün, 1) → 29.10 tatil → 30.10.2026 Cuma.
- Valör tarihi satış anında hesaplanıp saklanır. "Bekleyen Valörleri Yeniden Hesapla" yalnız bekleyen ve gelecekteki kalemlere uygulanır (audit).

### 4.6 İptal, iade, düzeltme ve geri yükleme (talimat 18; ek 5)

**Üç ayrı işlem, tek kural tablosu (§3.8 ile aynı):**

| İşlem | Ne zaman | Sonuç |
|---|---|---|
| **İptal (Void)** | POS İşlemleri → "İptal Et", ya da fatura İptal/Sil + "Müşteriye İade Edildi"; **provizyon süresi içinde ve valörden önce** | Satış ve kalemleri void, olay iptal, modül satırı silinir; komisyon doğmaz |
| **İptal İadesi** (`pos_cancel_refund`) | Fatura İptal/Sil + "Müşteriye İade Edildi"; provizyon süresi geçmiş ya da kalemlerden biri bankaya geçmiş | Modül satırı fatura iptaliyle silinir (bugünkü iptal düzeni; cari net 0). `pos_sales(kind 'refund', src 'cancel', gross = satış brütü)` açılır. Bekleyen kalemlerin brütü sondan başa sıfırlanır. Bankaya geçmiş tutar için iade valörüne `refund` kalemi açılır (o gün B 108.T / A 102.x). Komisyon POS'un İadede Komisyon kuralına göre. Geçmiş gün fişleri değişmez → eşleşme ve kilit engeli yok. |
| **Kayıt Hatası Silme** | Modül satırını silmek ya da fatura İptal/Sil + "Kayıt Hatası" | Valörden önce void (provizyondan bağımsız, audit "kayıt hatası"). Bankaya geçmişse `bank.replan` (gün fişi eşleşmemiş ve açık dönemde) ya da 409 `pos-settled`. |
| **POS İadesi** | Satıştan iade faturası, cari "POS İadesi", stok "Müşteri İadesi → POS'tan", taksit iadesi | İade satırı (`card`, out) + `pos_sales(kind 'refund', src 'module')`; dağıtım aşağıda |

**Alan, yöne göre değil belge türüne göre seçilir (E2.07):**

| Belge / işlem | `card` yolunun anlamı | Açılan alan |
|---|---|---|
| Satış, tahsilat (giriş) | POS tahsilatı | POS + POS Taksit Sayısı |
| Satıştan iade, cari "POS İadesi", stok "Müşteri İadesi → POS'tan", taksit iadesi (çıkış) | POS İadesi | POS + Asıl POS İşlemi (aynı cari ve faturadan öneri) + "Kaynaksız (Eski Satış)" |
| Ödeme, alış (çıkış) | Kurumsal kartla ödeme | Kurumsal Kart |
| Alıştan iade, ödeme iadesi (giriş) | Kurumsal karta iade | Kurumsal Kart (POS satışı oluşmaz; 309 düşer) |

**İade kuralları:**
- Asıl işlem aynı POS'ta, `origin_id` ve iade faturasının `original_id` alanıyla bulunur.
- Σ iade (İptal İadesi dahil) ≤ satış; aşarsa 409 `pos-refund-exceeds`. İade tarihi satış tarihinden önce olamaz.
- "Kaynaksız (Eski Satış)" ile 108.00'daki eski satış iade edilebilir; bu durumda Σ iade ≤ satış denetlenemez (BİLİNEN SINIR).

**Kısmi iadenin kalemlere dağılımı (E1.08, E2.15):**
- İade tutarı önce bekleyen kalemlerden **sondan başa** düşülür; kalem brütü küçülür, komisyon kipine göre yeniden hesaplanır.
- Bekleyen kalem kalmazsa artan tutar iade valörüne yazılan `refund` (çıkış) kalemi olur.
- Komisyon iadesi (Oransal ya da Tam kipinde) kalemlere `splitMinor` ile dağıtılır.
- Doğrulama: bağımsız BigInt modeliyle "3 taksit / 1'i geçmiş / kısmi iade" testi.

| 10.000 satış, kom. 250, iade 3.000 | İade Edilmez (varsayılan) | Oransal |
|---|---|---|
| **Valörden önce** | İade satırı B 120 / A 108.01 3.000. Bekleyen kalem brüt 7.000, kom. 250, net 6.750. Valörde B 102.01 6.750 · B 653 250 / A 108.01 7.000. | Kom. iadesi round(250 × 3.000/10.000) = 75 → kom. 175, net 6.825 |
| **Valörden sonra** | İade satırı A 108.01 3.000. `refund` kalemi iade valörüne yazılır; o gün B 108.01 3.000 / A 102.01 3.000 → banka −3.000 | O gün B 108.01 3.000 / A 102.01 2.925 · A 653 75 |

**Net eksiye düşerse (E1.06):**
- Kalemin neti eksiye düşerse net 0 yapılır ve aynı valör gününe |net| tutarında `fee` kalemi ("Komisyon Tahsili") açılır.
- Valörde BSMV ya da Yok kipinde B 653 / A 102.x. KDV kipinde `account_entries(source='bank', out, bank, fin_ref=bağlı hesap)` → B 320 / A 102.x.
- Örnekler:
  - 10.000 satış + 10.000 iade, valörden önce, İade Edilmez → banka −250, 653 = 250.
  - 10 TL satış + 15 TL sabit ücret → banka −5.
  - 12.000 taksitli satışın İptal İadesi, valörden önce, İade Edilmez → 3 kalemin brütü 0, üç `fee` kalemi 140 (kendi valörlerinde), POS Bekleyen (Net) −420 ("Komisyon Tahsili Bekleyen").

**Düzeltme (E1.08, E2.05):**
- Bekleyen satışta tutar değişirse `pos_sales` yerinde güncellenir ve `pos_items` yeniden bölünür (audit).
- Yol ya da hesap/POS değişirse eski olay iptal, yeni olay açılır; tek işlem. Kısmi tekil indeks yalnız etkin satışa uygulandığından yeni satış yazılabilir.
- Bankaya geçmiş kalem varsa `bank.replan`: ilgili gün fişi eşleşmemiş ve açık dönemdeyse tek işlemde ters kayıt + satır güncellemesi + yeniden planlama + vadesi gelenler için yeni gün fişi (r+1). Fiş eşleşmiş ya da kilitliyse nedenli 409 `pos-settled`.

**Diğer kurallar:**
- **POS kartında bağlı hesap değişirse:** bekleyen kalemler `pos_sales.bank_account_id` kopyasına göre eski hesaba geçer. "Bekleyenleri Yeni Hesaba Taşı" ayrı eylemdir (`bank.pos`, audit).
- **Geri yükleme:** §3.8'deki kural.
- **KDV kipinde komisyon iadesi** sağlayıcı carisine giriş satırıdır (B 108.T / A 320), "yalnız bağlı" kipte (§4.3/2).

### 4.7 POS Ödeme Takvimi ve nakit akışı (talimat 17, 25)

- Takvim bekleyen kalemleri valör gününe göre **net** gösterir; blokeli kalemler ve Komisyon Tahsili kalemleri ayrı satırda. Örnek: 02 Ekim 9.750 · 03 Ekim 12.450 · 04 Ekim 7.200 → Toplam 29.400.
- Nakit akışında "POS" ve "Blokeli POS" kaynakları valör gününde net tutarla girer (§8.9).

### 4.8 Sanal POS hazırlığı (talimat 19)
- `kind='virtual'`, `provider_kind='payment_institution'` ve `integration` alanları; bağdaştırıcı kapalı.
- Sağlayıcı bildirimi ileride bir ekstre satırı olarak gelir ve eşleştirmeyle `pos_sales`'e bağlanır.

---

## 5. Veritabanı Değişiklikleri

### 5.1 Para saklama (K1; ek 1)

- **SQLite'ta DECIMAL tipi yok.** Bu ortamda denendi:
  - `DECIMAL(18,2)` bildirilen kolona yazılan değer `real` saklanıyor.
  - STRICT tablo `NUMERIC`/`DECIMAL`'ı kabul etmiyor.
- **Karşılık: ölçekli tamsayı (yeni tablolarda).**

| Büyüklük | Kolon | Tip | Ölçek |
|---|---|---|---|
| Tutar (hesabın para biriminde) | `*_minor` | `INTEGER` (STRICT: kesir reddedilir) + `CHECK` işaret kuralı | kuruş / sent |
| TL karşılığı | `try_minor` | aynı | kuruş |
| Oran | `*_ppm` | `INTEGER CHECK (0..1.000.000)` | milyonda bir (%2,5 = 25.000) |
| Kur | `rate_e6` | `INTEGER CHECK (> 0)` | ×10^6 |

- **Aralık:** int64 tavanı 9,22×10^18 kuruş; DECIMAL(18,2) tavanı 10^18−1 kuruş, tamamı karşılanır. Uç başına sınır 1e12 TL olduğundan JS `Number` toplamları güvende; daha büyük toplamlar `setReadBigInts(true)` ile okunur.
- **Hesaplama:** Çarpma ve bölme BigInt; yarım birim sıfırdan uzağa (`roundMoney` ile aynı sonuç); bölüştürmede artık son dilime.
- **Girdi:** Banka uçlarında `parseMinor`; 2'den çok ondalık 400, sessizce yuvarlanmaz.
- **Mevcut REAL kolonlar bu projede değişmez (bilinçli sapma, Ek A.2/1).** Gerekçe ve kanıt:
  1. Kapı her yazımda kuruş kesinliğini zorunlu tutar (integrity.mjs:146-150).
  2. Tek kaynakta toplamlar kuruş tamsayısıyla.
  3. **Özellik testi** (Aşama 2):
     - [1 kuruş, 1e12 TL] aralığında sınır değerleri ve 10^6 rastgele değer için `k/100` REAL olarak saklanıp okunur; `toCents` ve `CAST(ROUND(x*100) AS INTEGER)` k'ya eşit olmalı.
     - Σ (SQL kuruş) = Σ (BigInt).
  4. Banka kodunda REAL `SUM(amount)` ve `parseFloat` yasak; statik test tarar.
- Tam göç Aşama 17'de ayrı proje.
- **API:** Banka uçları `*Minor` tamsayısı ve `currency` döner; istemci `HOF.formatMinor(minor, currency)` kullanır (`HOF.formatMoney` TRY'ye sabit, hof-core.js:41). Mevcut modül uçları bugünkü gibi TL döner.

### 5.2 Yeni tablolar (göç 20; hepsi STRICT; yabancı anahtar yok, bağlar kapıda denetlenir)

`+ zaman` = `created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT`.

```sql
-- İşlem başlığı + kapının doğruladığı salt okuma kopyası (para kaynağı DEĞİL; sayfalama ve süzgeç dizini)
CREATE TABLE IF NOT EXISTS fin_events (
  id TEXT PRIMARY KEY, year INTEGER NOT NULL, seq INTEGER NOT NULL, no TEXT NOT NULL,      -- BNK-2026-000123 (sayaç, §5.4)
  type TEXT NOT NULL,                                    -- kod sözlüğü (§3.6); CHECK yok
  date TEXT NOT NULL, value_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',                 -- active | reversed | cancelled
  reversal_of TEXT NOT NULL DEFAULT '', reversed_by TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'manual',                 -- manual | system | statement | api | wizard
  origin_key TEXT NOT NULL DEFAULT '', channel TEXT NOT NULL DEFAULT '',
  src_table TEXT NOT NULL DEFAULT '', src_id TEXT NOT NULL DEFAULT '',          -- modül satırı (Banka Fişinde '')
  bank_ref TEXT NOT NULL DEFAULT '', counter_ref TEXT NOT NULL DEFAULT '', pos_id TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT '',                    -- bank_ref'e göre in | out
  amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),            -- hesabın para biriminde
  try_minor INTEGER NOT NULL DEFAULT 0 CHECK (try_minor >= 0), currency TEXT NOT NULL DEFAULT 'TRY',
  method TEXT NOT NULL DEFAULT '', party_id TEXT NOT NULL DEFAULT '',
  invoice_id TEXT NOT NULL DEFAULT '', plan_id TEXT NOT NULL DEFAULT '', cheque_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '', reference TEXT NOT NULL DEFAULT '', external_id TEXT NOT NULL DEFAULT '',
  counter_name TEXT NOT NULL DEFAULT '', counter_iban TEXT NOT NULL DEFAULT '', request_key TEXT NOT NULL DEFAULT '', + zaman) STRICT;
-- UNIQUE(year, seq); UNIQUE(no); UNIQUE(origin_key) WHERE origin_key <> '' AND status = 'active'
-- INDEX (bank_ref, date, id); (counter_ref, date, id) WHERE counter_ref <> ''; (party_id, date); (status, date);
--       (pos_id, date) WHERE pos_id <> ''; (invoice_id) WHERE invoice_id <> ''; (plan_id) WHERE plan_id <> '';
--       (cheque_id) WHERE cheque_id <> ''; (src_table, src_id); (type, date)

CREATE TABLE IF NOT EXISTS bank_lines (                 -- Banka Fişi satırı; THP kodu yazım anında çözülür ve saklanır
  id TEXT PRIMARY KEY, event_id TEXT NOT NULL, seq INTEGER NOT NULL,
  role TEXT NOT NULL,                                    -- bank|pos|card|loan|expense|income|tax|stoppage|fx_gain|fx_loss|opening|closing
  gl TEXT NOT NULL, sub TEXT NOT NULL DEFAULT '', ref TEXT NOT NULL DEFAULT '',
  side TEXT NOT NULL CHECK (side IN ('D','C')), try_minor INTEGER NOT NULL CHECK (try_minor > 0),
  currency TEXT NOT NULL DEFAULT 'TRY', fx_minor INTEGER NOT NULL DEFAULT 0 CHECK (fx_minor >= 0),
  rate_e6 INTEGER NOT NULL DEFAULT 1000000 CHECK (rate_e6 > 0), rate_source TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '') STRICT;
-- INDEX (event_id); (ref, event_id); (gl, sub)

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY, code TEXT NOT NULL, gl TEXT NOT NULL, gl_sub TEXT NOT NULL,      -- gl_sub sistem verir, değişmez
  kind TEXT NOT NULL, bank_name TEXT NOT NULL, name TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'TRY',
  iban TEXT NOT NULL DEFAULT '', account_no TEXT NOT NULL DEFAULT '', branch_name TEXT NOT NULL DEFAULT '',
  branch_code TEXT NOT NULL DEFAULT '', swift TEXT NOT NULL DEFAULT '', holder TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '', opening_date TEXT NOT NULL,
  balance_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (balance_confirmed IN (0, 1)),     -- K7
  credit_limit_minor INTEGER NOT NULL DEFAULT 0 CHECK (credit_limit_minor >= 0),
  negative_policy TEXT NOT NULL DEFAULT '', statement_day INTEGER NOT NULL DEFAULT 0, due_day INTEGER NOT NULL DEFAULT 0,
  show_on_invoice INTEGER NOT NULL DEFAULT 0, statement_template_json TEXT NOT NULL DEFAULT '{}',
  integration TEXT NOT NULL DEFAULT 'manual', status TEXT NOT NULL DEFAULT 'active', position INTEGER NOT NULL DEFAULT 0,
  + zaman, deleted_by TEXT, deleted_at TEXT) STRICT;
-- UNIQUE(gl_sub); UNIQUE(code) WHERE deleted_at IS NULL; UNIQUE(iban) WHERE iban <> '' AND deleted_at IS NULL

CREATE TABLE IF NOT EXISTS pos_terminals (
  id TEXT PRIMARY KEY, code TEXT NOT NULL, gl_sub TEXT NOT NULL, name TEXT NOT NULL, bank_name TEXT NOT NULL DEFAULT '',
  bank_account_id TEXT NOT NULL, kind TEXT NOT NULL, provider_kind TEXT NOT NULL DEFAULT 'bank',   -- bank | payment_institution
  merchant_no TEXT NOT NULL DEFAULT '', terminal_no TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT 'TRY',
  valor_rule TEXT NOT NULL DEFAULT 'business', valor_days INTEGER NOT NULL DEFAULT 1,
  provision_days INTEGER NOT NULL DEFAULT 0, block_days INTEGER NOT NULL DEFAULT 0, installment_payout TEXT NOT NULL DEFAULT 'monthly',
  tax_kind TEXT NOT NULL DEFAULT 'bsmv', tax_mode TEXT NOT NULL DEFAULT 'included', tax_ppm INTEGER NOT NULL DEFAULT 50000,
  provider_account_id TEXT NOT NULL DEFAULT '', refund_commission TEXT NOT NULL DEFAULT 'none',
  settle_mode TEXT NOT NULL DEFAULT 'inherit', fixed_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fixed_fee_minor >= 0),
  integration TEXT NOT NULL DEFAULT 'manual', status TEXT NOT NULL DEFAULT 'active', description TEXT NOT NULL DEFAULT '',
  + zaman, deleted_by TEXT, deleted_at TEXT) STRICT;                                     -- UNIQUE(gl_sub)

CREATE TABLE IF NOT EXISTS pos_rates (id TEXT PRIMARY KEY, pos_id TEXT NOT NULL,
  installments INTEGER NOT NULL CHECK (installments BETWEEN 1 AND 36),
  rate_ppm INTEGER NOT NULL CHECK (rate_ppm BETWEEN 0 AND 1000000), valor_days INTEGER, valid_from TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;                          -- UNIQUE(pos_id, installments, valid_from)

CREATE TABLE IF NOT EXISTS pos_sales (
  id TEXT PRIMARY KEY, event_id TEXT NOT NULL, pos_id TEXT NOT NULL, kind TEXT NOT NULL,          -- sale | refund
  src TEXT NOT NULL DEFAULT 'module',                    -- module | cancel (İptal İadesi) | sourceless (Kaynaksız Eski Satış)
  origin_id TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL, installments INTEGER NOT NULL DEFAULT 1, rate_ppm INTEGER NOT NULL, tax_kind TEXT NOT NULL,
  tax_mode TEXT NOT NULL, tax_ppm INTEGER NOT NULL, fixed_minor INTEGER NOT NULL DEFAULT 0, refund_commission TEXT NOT NULL,
  payout TEXT NOT NULL, block_days INTEGER NOT NULL DEFAULT 0,
  bank_account_id TEXT NOT NULL, provider_account_id TEXT NOT NULL DEFAULT '',          -- anlık kopyalar
  gross_minor INTEGER NOT NULL CHECK (gross_minor > 0), commission_minor INTEGER NOT NULL DEFAULT 0 CHECK (commission_minor >= 0),
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0), net_minor INTEGER NOT NULL CHECK (net_minor >= 0),
  commission_refund_minor INTEGER NOT NULL DEFAULT 0 CHECK (commission_refund_minor >= 0), blocked INTEGER NOT NULL DEFAULT 0,
  auth_code TEXT NOT NULL DEFAULT '',
  card_last4 TEXT NOT NULL DEFAULT '' CHECK (card_last4 = '' OR (length(card_last4) = 4 AND card_last4 GLOB '[0-9][0-9][0-9][0-9]')),
  status TEXT NOT NULL DEFAULT 'active', + zaman) STRICT;   -- active | void | cancelled
-- UNIQUE(event_id) WHERE kind = 'sale' AND status = 'active'
-- UNIQUE(pos_id, auth_code, date) WHERE auth_code <> '' AND status = 'active'; INDEX (origin_id)

CREATE TABLE IF NOT EXISTS pos_items (
  id TEXT PRIMARY KEY, sale_id TEXT NOT NULL, pos_id TEXT NOT NULL, seq INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sale','refund','fee')), value_date TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0,
  gross_minor INTEGER NOT NULL CHECK (gross_minor >= 0), commission_minor INTEGER NOT NULL DEFAULT 0 CHECK (commission_minor >= 0),
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0), fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  net_minor INTEGER NOT NULL CHECK (net_minor >= 0), planned_net_minor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', event_id TEXT NOT NULL DEFAULT '', settled_on TEXT NOT NULL DEFAULT '',
  late INTEGER NOT NULL DEFAULT 0, settle_error TEXT NOT NULL DEFAULT '', + zaman) STRICT;  -- INDEX (status, value_date); (sale_id)

-- Bankaya Tahsile Ver / Bankadan Geri Al'ın TEK izi (fin_events ile). cheque_events'e satır yazılmaz (kind CHECK, migrations.mjs:729);
-- cheques.status değişmez.
CREATE TABLE IF NOT EXISTS cheque_collections (id TEXT PRIMARY KEY, cheque_id TEXT NOT NULL, bank_account_id TEXT NOT NULL,
  given_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',                    -- pending | collected | withdrawn | returned
  closed_date TEXT NOT NULL DEFAULT '', event_id TEXT NOT NULL, close_event_id TEXT NOT NULL DEFAULT '', + zaman) STRICT;
-- UNIQUE(cheque_id) WHERE status = 'pending'; INDEX (cheque_id)

CREATE TABLE IF NOT EXISTS bank_jobs (id TEXT PRIMARY KEY, kind TEXT NOT NULL,          -- reval-reverse | comm-invoice
  due_date TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', done_ref TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', + zaman) STRICT;
-- UNIQUE(kind, ref) WHERE status = 'pending'; INDEX (status, due_date)

CREATE TABLE IF NOT EXISTS fx_rates (date TEXT NOT NULL, currency TEXT NOT NULL, kind TEXT NOT NULL,   -- buy | sell | banknote_buy …
  rate_e6 INTEGER NOT NULL CHECK (rate_e6 > 0), unit INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL,
  fetched_at TEXT NOT NULL, created_by TEXT NOT NULL DEFAULT '', PRIMARY KEY (date, currency, kind, source)) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS bank_holidays (date TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL, created_at TEXT NOT NULL) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS bank_statements (id TEXT PRIMARY KEY, bank_account_id TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'file',
  file_name TEXT NOT NULL DEFAULT '', file_sha256 TEXT NOT NULL DEFAULT '', format TEXT NOT NULL DEFAULT '',
  period_from TEXT NOT NULL DEFAULT '', period_to TEXT NOT NULL DEFAULT '',
  opening_minor INTEGER, closing_minor INTEGER, line_count INTEGER NOT NULL DEFAULT 0, duplicate_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', + zaman) STRICT;
-- UNIQUE(bank_account_id, file_sha256) WHERE file_sha256 <> '' AND status = 'active'

CREATE TABLE IF NOT EXISTS bank_statement_lines (id TEXT PRIMARY KEY, statement_id TEXT NOT NULL, bank_account_id TEXT NOT NULL,
  line_no INTEGER NOT NULL, date TEXT NOT NULL, value_date TEXT NOT NULL DEFAULT '', direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0), balance_minor INTEGER, description TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '', counter_iban TEXT NOT NULL DEFAULT '', counter_name TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '', fingerprint TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unmatched',
  score INTEGER NOT NULL DEFAULT 0, suggestion_json TEXT NOT NULL DEFAULT '[]', + zaman) STRICT;
-- INDEX (bank_account_id, status, date); (bank_account_id, fingerprint) — tekil değil ("Mükerrer Değil" için)
-- UNIQUE(bank_account_id, external_id) WHERE external_id <> ''

CREATE TABLE IF NOT EXISTS bank_matches (id TEXT PRIMARY KEY, line_id TEXT NOT NULL, bank_account_id TEXT NOT NULL,
  event_id TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK (amount_minor > 0), digest TEXT NOT NULL,
  kind TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
  undone_by TEXT, undone_at TEXT, undo_reason TEXT NOT NULL DEFAULT '') STRICT;
-- INDEX (event_id) WHERE undone_at IS NULL; INDEX (line_id)

CREATE TABLE IF NOT EXISTS bank_plans (id TEXT PRIMARY KEY, kind TEXT NOT NULL, bank_account_id TEXT NOT NULL,
  to_account_id TEXT NOT NULL DEFAULT '', party_id TEXT NOT NULL DEFAULT '', amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'TRY', planned_date TEXT NOT NULL, repeat TEXT NOT NULL DEFAULT 'none',
  description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planned', done_event_id TEXT NOT NULL DEFAULT '', + zaman) STRICT;

CREATE TABLE IF NOT EXISTS request_keys (key TEXT PRIMARY KEY, scope TEXT NOT NULL, user_id TEXT NOT NULL,
  body_hash TEXT NOT NULL, ref_id TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
```

- `ledger_snapshots` yalnız Aşama 2'deki ölçüm kararı gerektirirse eklenir (§3.11).
- Tür ve durum kolonlarında CHECK listesi yok; CHECK yalnız değişmeyecek kurallarda (işaret, yön/taraf, son 4 hane, rol).
- Tekil indeksler **yalnız etkin satıra** uygulanır (E2.01).

### 5.3 Mevcut tablolara eklenenler (yalnız `addColumn`, migrations.mjs:14-17)

| Tablo | Yeni kolonlar | İndeks |
|---|---|---|
| payments, cash_entries, account_entries, plan_entries, stock_moves, cheque_events | `fin_ref TEXT NOT NULL DEFAULT ''`, `event_id TEXT NOT NULL DEFAULT ''` | `(fin_ref, date) WHERE fin_ref <> ''`; `(event_id) WHERE event_id <> ''` |
| account_entries | `fx_currency TEXT NOT NULL DEFAULT ''`, `fx_minor INTEGER NOT NULL DEFAULT 0`, `fx_rate_e6 INTEGER NOT NULL DEFAULT 0`, `fx_source TEXT NOT NULL DEFAULT ''` (13b) | — |
| invoices | `rate_source TEXT NOT NULL DEFAULT ''` | — |

- Bu tablolar STRICT değil; `fx_minor`'ın tamsayı olduğunu `bank:refs` denetler (`typeof = 'integer'`).
- `account_entries.source` serbest metin; `'bank'` değeri şema değişikliği gerektirmez.
- `cheque_events`'e yalnız iki kolon eklenir; `kind` CHECK'i değişmez, yeni tür yazılmaz.
- `invoices.payment_json.cash[]` öğeleri şu alanları alır: `lineKey`, `eventId`, `bankAccountId`, `posId`, `installments`, `posRefundOf`.

### 5.4 Ayar anahtarları
- `bank.settings` (JSON): okumada kod varsayılanlarıyla birleştirilir (invoices.mjs:107-118 kalıbı). İçindeki hesap/POS kimlikleri okunurken doğrulanır; kartı silinmiş kimlik boş sayılır.
- `meta.schema.v20At`: göç zamanı; eski sürüm satırı tespitinde kullanılır.
- `meta.bank.repairStamp`: son onarım taramasının zamanı. (Aşama 2 gözden geçirmesi D7: onarım bu damgayla SINIRLANMAZ — her açılışta bütün
  para satırlarını ve olayları tarar; eski sürüm damgadan önce yazılmış satırı da düzeltebildiği için damga sınırı onu kaçırırdı. Süre
  docs/2.1.0-KANIT.md "Aşama 2 — Bağımsız Gözden Geçirme".)
- **`meta.bank.seq.<yıl>`: İşlem No sayacı (yalnız artar).**
  - Numara işlem içinde `max(sayaç, MAX(seq) of year) + 1` ile verilir; sayaç aynı işlemde güncellenir.
  - Yıl, olayın AÇILDIĞI tarihin yılıdır. İşlem No kalıcı kimliktir: hareketin tarihi sonradan başka yıla alınsa da numara değişmez (basılı
    makbuz, dekont ve eşleşme bu numarayla anılır; Aşama 2 gözden geçirmesi D1). Olayın türü ise satırdan türetilir ve düzeltmede güncellenir.
  - `meta.` öneki KEEP_SETTINGS'te korunduğu için "Tüm Hareketleri Sil" ve "Tümünü Sıfırla" sonrası numara yeniden kullanılmaz; eski yedekteki ve basılı belgelerdeki numaralarla çakışma olmaz.
  - Yedekten geri yüklemede sayaç canlı dosyadaki ile yedekteki değerin BÜYÜĞÜ olur (001 ve 002 aynı kural; Aşama 2 gözden geçirmesi B4):
    geri yüklemeden sonra verilen numara, geri yüklemeden önce verilmiş bir numarayla çakışmaz.

### 5.5 Kapı listeleri (db.mjs, integrity.mjs)

| Liste | Ekleme |
|---|---|
| FINANCIAL (db.mjs:27) | fin_events, bank_lines, bank_accounts, pos_terminals, pos_sales, pos_items, cheque_collections |
| INFO_COLUMNS (db.mjs:34-37) | **fin_events:** description, reference, counter_name, counter_iban, channel, updated_by, updated_at<br>**bank_accounts:** name, bank_name, iban, account_no, branch_name, branch_code, swift, holder, description, position, statement_template_json, statement_day, due_day, show_on_invoice, integration, updated_by, updated_at<br>**pos_terminals:** name, merchant_no, terminal_no, description, updated_by, updated_at |
| FINANCIAL dışında | pos_rates, fx_rates, bank_holidays, bank_statements, bank_statement_lines, **bank_matches**, bank_plans, bank_jobs, request_keys |
| DATED (integrity.mjs:58) | + `cheque_events` (Aşama 0), + `fin_events` (v20). Bütün DATED tablolarında `dates:future` taban kümesi kuralıyla (A13, §3.11). |
| MINOR | Yok (STRICT + CHECK yeterli) |
| LOCK_SQL (integrity.mjs:61-70) | Mevcut 7 girdinin SQL'i ve sırası **değişmez**; yeni girdiler sona eklenir. `lockDigest`'in `has(table)` denetimi anahtar adına baktığı için (integrity.mjs:314-318) yeni girdiler `{ requires, sql }` biçimini alır. |

**Kilit izine eklenenler:**
- **Aşama 0 (2.0.26):**
  - `cheque_events (id, cheque_id, kind, amount, date, method) WHERE date <= ?`
  - `cheques (id, direction, amount, issue_date, deleted_at IS NULL) WHERE issue_date <= ?`. `status` girmez; kilitli ayda alınan çek bugün tahsil edilebilmeli (E2.19).
  - `party_lock`: `SELECT a.id, a.type, a.deleted_at IS NULL FROM accounts a WHERE EXISTS (SELECT 1 FROM account_entries e WHERE e.account_id = a.id AND e.date <= ?) ORDER BY a.id`.
    - Kilitli dönemde **herhangi bir** satırı (in/out ve Borç Yaz/Alacak Yaz, açılış dahil) olan her cari kapsanır. Silinmiş carinin bütün satırları yevmiyeden düştüğü için (routes/ledger.mjs:18-23) silinmesi kilitli mizanı değiştirir; tür değişikliği de 120/320/336 sınıfını kaydırır. İkisini de iz yakalar (A3).
- **v20:**
  - `money_refs`: 6 tablodan (tablo, id, fin_ref, event_id) `WHERE date <= ? AND (fin_ref <> '' OR event_id <> '')`
  - `fx_refs`: account_entries fx kolonları dolu olan satırlar
  - `fin_events (id, type, date, reversal_of, bank_ref, counter_ref, amount_minor, try_minor)`; `status` ve `reversed_by` girmez
  - `bank_lines` (JOIN fin_events date <= ?)
  - `pos_sales` değişmeyen alanlar; `status` ve `updated_at` girmez
  - `cheque_collections_given (id, cheque_id, bank_account_id, given_date) WHERE given_date <= ?` ve `cheque_collections_closed (id, status, closed_date, close_event_id) WHERE closed_date <> '' AND closed_date <= ?`
- **Sonuç:** Eski veride yeni girdiler satır üretmez; kilit izi göç öncesiyle birebir aynıdır (K11). `party_lock` Aşama 0'da eklendiği için v20 karşılaştırmasında 2.0.26 tanımı kullanılır. Kilitli dönemdeki eski satıra "Bu Hesaba Ata" denirse `money_refs` değişir ve işlem 409 alır; sihirbaz zaten atamaz. Bunun kırmızı testi yazılır.

### 5.6 Şirket sıfırlama (app.mjs:519-556)
- `MOVEMENT_TABLES` += fin_events, bank_lines, pos_sales, pos_items, cheque_collections, bank_statements, bank_statement_lines, bank_matches, bank_plans, bank_jobs, request_keys (ve varsa ledger_snapshots).
- `CARD_TABLES` += bank_accounts, pos_terminals, pos_rates.
- `fx_rates` ve `bank_holidays` başvuru verisidir, silinmez.
- `KEEP_SETTINGS` += `'bank.settings'` (yalnız tercihler). `meta.schema.v20At` ve `meta.bank.seq.*` `'meta.'` öneki sayesinde korunur. Eski sürüm tespiti `event_id`'ye dayandığından sıfırlamadan etkilenmez.
- Sıfırlama DELETE'leri `store.raw('company.reset', …)` kapsamında yapılır (§3.3/c).
- **"Tüm Hareketleri Sil":** hesap ve POS kartları kalır. Açılışlar silindiği için `balance_confirmed=0` olur; kartta "Açılış Bakiyesi Gir" düğmesi açılır (`bank:opening` "en çok bir" kuralı sıfır açılışı da kabul eder).
- **A12 (§11.1):** Dönem kilidi varken bu kip bugün 409 veriyor. Düzeltme: bu kipte kilit de kaldırılır; onay penceresinde yazılır, audit `ledger.period.unlocked` + `company.reset`. "Tümünü Sıfırla" kilit ayarını zaten siliyor.
- **Test:** sıfırla → açılışı yeniden gir → mutabakat 0; öbür şirket, lisans ve kullanıcılar aynı; yeni İşlem No sıfırlama öncesinin son numarasından büyük.

---

## 6. Modüller Arası İlişki Şeması

```
                       KULLANICI İŞLEMİ (tek istek, tek x-hof-request)
                                       │
       bank.post({ user, scope, requestId, module, op, body, prev, write })  (K6)
                                       │  store.tx (BEGIN IMMEDIATE; rowid işareti)
 ┌─────────────────────────────────────┼─────────────────────────────────────────────────┐
 │ request_keys → prepare (+ HEDEF KURALLARI, K8) → assertMutable (K4) → similar (K8,     │
 │ yalnız hesaba bağlı) → fin_events (İşlem No, sayaç)                                    │
 │                                     │                                                  │
 │  MODÜL SATIRI (tek para kaydı)      │          BANKA FİŞİ                               │
 │  payments · cash_entries (ikiz) ·   │          bank_lines (THP kodu + sub + ref,        │
 │  account_entries (''/invoice/bank) ·│          TL + döviz): açılış · masraf · faiz ·    │
 │  plan_entries · stock_moves ·       │          transfer · döviz · gerçekleşen kur farkı·│
 │  cheque_events (collect/pay)        │          valör · değerleme · devir · ters kayıt   │
 │        (+ fin_ref, event_id)        │   cheque_collections + fin_events(cheque_deposit/ │
 │        │ POS ise                    │   withdraw)  — cheque_events'e YAZILMAZ           │
 │  pos_sales ─► pos_items ────────────┼──► valör kuyruğu (K3) ─► fin_events(pos_settlement) + bank_lines
 │  son durum eksi bakiye (K7) → audit(previous) → requests.remember → touched.events    │
 │  KAPI: gl:* + bank:* + pos:* + money:* (event, method, report) + cheque:* + period-lock│
 └─────────────────────────────────────┼─────────────────────────────────────────────────┘
                                     COMMIT → workspace.changed {kind: modül} + {kind: 'bank'}
   Toplu fatura kesimi/iptal/sil: belge başına ayrı bank.post işlemi; e-Belge gönderimi işlem dışında
   moneyLines (TEK KAYNAK, K5: 9 kaynak; yol SQL'de türetilir; "para satırı" yüklemi buradan)
     ├─ özet ─► Kasa toplamı · Banka bakiyeleri · ANLIK DURUM (K10) · Nakit Akış · eksi bakiye · ledger.expected
     └─ satır ─► Kasa penceresi/PDF (way=cash) · Banka ve POS Hareketleri · Banka Hareketleri (sayfa: fin_events dizini)
   journal() (bağımsız ikinci yol) ─► Ana Defter: 102.xx · 108.xx · 309.xx · 300.xx · 101.01/101.02 alt hesapları
   ───────────────────────────────────────────────────────────────────────────────────────
   bank_statements → bank_statement_lines ⇄ bank_matches (olay + özet; DEFTER DEĞİŞMEZ)
   bank_plans · pos_items (pending) · bank_jobs · açık fatura/taksit/çek vadesi → YALNIZ PROJEKSİYON
   Fatura (KDV) ─► 191 · KDV kipi: source='bank' kesinti (pos-fee, "yalnız bağlı") ⇄ aylık komisyon faturası
   TCMB (sunucu, işlem dışı) ─► fx_rates ─► döviz işlemleri · 13b · değerleme · fatura formu kur önerisi
```

---

## 7. API Planı

**Ortak kurallar:**
- Bütün uçlar `/api/workspace/bank/*` altında ve şirkete gider; HUB_ONLY'ye girmez (app.mjs:361).
- `/api/admin/*` kullanılmaz, çünkü o yol salt okunur lisansta da yazılabilir (license.mjs:56). Tek istisna mevcut `period-lock` ucu.
- Özel yollar `:id`'den önce kaydedilir. Yanıt `{ok, data}`; hata Türkçe cümle ve `code` taşır.
- Yazan her uç `x-hof-request` alır ve `bank.post`'tan geçer. **GET uçları hiçbir koşulda yazmaz.**

| Yöntem ve yol | Yetki | Not |
|---|---|---|
| GET `/bank/summary?day=` | bank.view | K10 tanımları; banka ve para birimi bazında bakiyeler; bu ayın transfer ve masrafları; `pendingDue` ("Valörü Gelmiş, Aktarılmadı") |
| GET `/bank/choices` | şunlardan biri: bank.view, accounts.collect, plans.collect, payments.create, invoices.manage, stock.sell, stock.manage, cheques.manage, cash.manage | Form seçicileri: kimlik, kod, ad, tür, para birimi, POS taksit oranları, `single` bayrağı. **Bakiye dönmez.** |
| GET `/bank/badge?count=1` | bank.view | Rozet sayısı |
| GET · PUT `/bank/settings`; POST `/bank/settings/reset` | view · settings | "Varsayılanlara Dön"; audit önceki ve yeni değer |
| GET · POST `/bank/accounts`; GET · PUT `/bank/accounts/:id`; POST `…/:id/status`; DELETE `…/:id` | view · accounts | POST açılışı içerir; DELETE yalnız hareketsiz hesapta |
| POST `/bank/accounts/:id/opening` | accounts (düzeltmede + cancel) | Açılış Bakiyesi Gir / Açılışı Düzelt |
| POST `/bank/setup?dryRun=1`; POST `/bank/setup/:id/undo` | accounts | Kurulum ve Aktarım Sihirbazı (§10.3) |
| GET `/bank/legacy`; POST `/bank/legacy/assign`; POST `/bank/legacy/reclass` | view · accounts | Hesabı atanmamış hareketler; "Bu Hesaba Ata"; "Bankaya Geçmiş Say"; "Kart Borcuna Aktar" |
| GET `/bank/movements?account=&bank=&pos=&party=&invoice=&plan=&type=&currency=&from=&to=&vfrom=&vto=&min=&max=&dir=&status=&matched=&q=&cursor=&limit=` | view | Sayfa `fin_events` dizininden `(date, id)` imleciyle; tutar ve yürüyen bakiye tek kaynaktan. Arama: cari adı, açıklama, IBAN, referans, İşlem No |
| GET `/bank/events/:no` | view | İşlem Kartı: başlık, satırlar, bağlı kayıtlar, eşleşme, audit, `explain` |
| POST `/bank/vouchers` | move (KDV'de + invoices.manage) | Masraf, faiz, diğer, kart borcu. `tax`: bsmv_incl \| bsmv_excl \| vat_incl \| vat_excl \| none; `feeType` hesabı belirler (770 / 653). Elle fiş yalnız Gelişmiş'te. |
| PUT `/bank/events/:id/info`; POST `…/:id/reverse`; POST `…/:id/correct` | move · cancel · move+cancel | Açıklama; Ters Kaydet; Düzelt |
| POST `/bank/transfers` | transfer | Bankalar arası, kredi kullanımı/geri ödeme; `fee` isteğe bağlı |
| POST `/bank/fx/exchange`; GET `/bank/fx/rates?date=&currency=`; GET `/bank/fx/suggest?date=&currency=&side=` | transfer · view · (view ∨ invoices.manage ∨ accounts.collect) | Kur önerisi. `side=sale\|purchase` fatura formu (döviz alış / satış); `side=party` 13b (iki yönde döviz alış) |
| POST `/bank/fx/rates/fetch`; PUT `/bank/fx/rates`; POST `/bank/fx/revaluation?dryRun=1` | settings · settings · move+settings | |
| GET · POST `/bank/pos`; GET · PUT `/bank/pos/:id`; GET · POST `/bank/pos/:id/rates`; POST `/bank/pos/:id/move-pending` | view · pos · commission · pos | Oran değişikliği yeni `valid_from` ile; bekleyen valörleri yeni hesaba taşıma |
| GET `/bank/pos/sales`; GET `/bank/pos/calendar?from=&to=` | view | POS Ödeme Takvimi; blokeli ve Komisyon Tahsili ayrı |
| POST `/bank/pos/sales/:id/refund` · `…/void` | modül yetkisi + move · cancel | `void` yalnız provizyon süresi içinde ve valörden önce |
| POST `/bank/settle`; POST `/bank/pos/items/confirm` | move · reconcile | "Şimdi Aktar"; onay kipinde gerçek tarih ve tutar |
| GET · POST `/bank/pos/commission-invoices?month=` | view · commission + invoices.manage | KDV kipi aylık taslak, "Şimdi Oluştur" |
| POST `/bank/statements/preview`; POST `/bank/statements`; GET `/bank/statements`; GET `…/:id/lines?status=`; DELETE `…/:id` | statement | Gövde limiti 40 MB ya da 5.000 satırlık parça; DELETE yalnız eşleşmesiz ekstrede |
| GET `/bank/statement-lines/:id/candidates`; POST `/bank/matches` (toplu); DELETE `/bank/matches/:id`; POST `/bank/statement-lines/:id/create\|ignore\|not-duplicate\|assign-match` | reconcile (`create` için + hedef modül yetkisi; `assign-match` için + accounts) | Aday yanıtında puan bileşenleri ve neden metni |
| GET `/bank/reconciliation?account=&date=` | view | Banka Mutabakat Cetveli |
| GET · POST · PUT · DELETE `/bank/plans`; POST `…/:id/execute` | view · move/transfer | |
| GET · PUT `/bank/holidays`; GET `/bank/calendar/explain?date=` | view · settings | |
| GET `/bank/cashflow?from=&to=` | view | Banka nakit akışı; "Planlanan Transferler" satırı dahil |
| POST `/cheques/:id/actions` (`action: 'bank-deposit' \| 'bank-withdraw'`) | cheques.manage | Mevcut uç genişler (§3.14). **`cheque_events`'e satır yazmaz**; yalnız `cheque_collections` + `fin_events`. |

**Genişleyen mevcut uçlar** (geriye uyumlu; hepsi `bank.post`'a geçer):
- `POST/PUT/DELETE accounts/:id/entries`, `plans/:id/entries`, `cases/:key/payments` ve `payments/:id`, `stock/:id/moves`, `cheques/:id/actions`, `cash` ve `cash/transfer`, `invoices` (`payment.cash[]`), `/issue`, `/edit`, `/cancel` (+ `posOutcome: 'refunded' | 'entry-error'`), iade, fatura kartındaki "+ Tahsilat Ekle", Silinenler geri yüklemesi, Taksite Aktar.
- Toplu uçlar (`bulk-issue`, `bulk-cancel`) belge başına ayrı işlemle kalır (invoices.mjs:1918-1950).
- Yeni alanlar: `bankAccountId`, `posId`, `installments`, `blocked`, `authCode`, `cardLast4`, `posRefundOf`, `lineKey`, `similarOk`, `overpay`, `fx` (13b).
- Rapor Merkezi `queryOf`'a eklenecek parametreler (report-center.mjs:1391): `bankAccount`, `pos`, `currency`, `txType`, `bankStatus`, `valueFrom`, `valueTo`, `channel`. İstemci `SELECTS` (hof-report-center.js:48-58) **aynı commit'te** güncellenir.

**Yeni hata kodları:** bank-account-required, bank-account-invalid, bank-currency, bank-similar, bank-reconciled, bank-gl-forbidden, bank-pending-before-lock, bank-before-opening, bank-opening-exists, bank-opening-after-first, account-bank-linked, plan-bank-linked, plan-paid, plan-overpay, installment-paid, pos-settled, pos-rate-missing, pos-refund-exceeds, pos-auth-duplicate, pos-provision-expired, cheque-deposited, statement-duplicate. Mevcut `cash-negative` ve `cash-blocked` kodlarına `accountId` alanı eklenir.

---

## 8. UI/UX Planı

### 8.1 Menü (K13)
- `SIDE_ITEMS` içinde Taksitler satırının hemen altına eklenir (hof-workspace.js:757): `{ action:'bank', icon:'▣', key:'side.bank', label:()=>'Banka', requires:'bank.view', badge:'warn' }`. Tıklama switch'ine `HOF.bank?.open()` eklenir.
- Rozet sayar: eşleşmeyen ekstre satırı, onay bekleyen ya da aktarılamamış valör, hesabı belirsiz yeni hareket.
- `LABEL_SLOTS`'a `side.bank` eklenir (profile.mjs:23-46); mevcut `side.invoices` ve `side.analytics` açığı da kapatılır (test/insight.test.mjs:510).
- `hof-bank.js`, `hof-invoices.js` ve `hof-cheques.js`'ten sonra, `hof-overview.js`'ten önce yüklenir. `HOF.office` hiçbir zaman `=` ile atanmaz.

### 8.2 Banka penceresi
- `HOF.modal` geniş pencere, `.hof-rep-chip` sekmeleri.
- Sekmeler: **Genel Bakış · Hesaplar · Hareketler · POS · Ekstre ve Mutabakat · Ayarlar**. **Döviz** sekmesi yalnız döviz hesabı varsa görünür.
- Planlı işlemler ayrı sekme değil; Hareketler içinde "Planlı" süzgeci ve "+ Planlı İşlem" düğmesiyle (talimat 35: kart kalabalığı yok).

### 8.3 Kurulum Sihirbazı (K13)
- `bank.accounts` yetkisi olan kişi Banka'yı ilk açtığında gösterilir; her adım atlanabilir.
  1. Hesap ve Açılış: banka, hesap adı, tür, IBAN, açılış tarihi ve bakiyesi, "Bu tutar bankadaki gerçek bakiyedir" kutusu.
  2. Eski Hareketleri Aktar: yalnız Hesabı Atanmamış hareket varsa (§10.3).
  3. POS Tanımla: isteğe bağlı.
- Atlanırsa Genel Bakış'ta "Kurulumu Tamamla" satırı kalır.

### 8.4 Genel Bakış (talimat 5, 35; K10)

| Ad (her ekranda aynı) | Tanım |
|---|---|
| **Gerçek Banka** | Σ 102 alt hesapları (hesaba atanmış), bugüne kadar. Döviz hesabı defter TL'siyle. Hiç hesap yoksa "—" ve "Banka Hesabı Tanımlanmadı". |
| POS Bekleyen (Net) | Blokesiz bekleyen kalemlerin neti (satış − iade − komisyon tahsili); eksi olabilir ("Komisyon Tahsili Bekleyen"). İpucunda brüt ve komisyon. |
| Blokeli POS | Aynı tanım, `blocked=1` kalemler |
| Kart ve Kredi Borcu | Σ 309 + Σ 300 (borç olarak) |
| Hesabı Atanmamış Eski Hareketler | Σ 102.00 + Σ 108.00. Ayrı satır, hiçbir toplama girmez; "Şimdi Düzenle" bağlantısı. |
| Bugün Giriş / Bugün Çıkış | Gerçek hesaplardaki dış hareketler (`internal=0`). İç hareketler (transfer, Kasa↔Banka, valör geçişi, döviz al/sat, kredi) ayrı "Transfer" satırında. Kasa kutusunun bugünkü tanımı değişmez (§3.4). |
| Beklenen Giriş / Çıkış (30 Gün) | Banka yoluyla beklenen açık fatura, taksit, çek vadesi (tahsildeki çekler dahil) ve planlı işlemler |
| Öngörülen Bakiye (30 Gün) | Gerçek Banka + POS Bekleyen (Net, valörü 30 gün içinde) + Beklenen Giriş − Beklenen Çıkış ± Planlanan Transferler |

- Ekranda tek satırlık açık formül: "Öngörülen Bakiye = Gerçek 150.000 + POS Bekleyen 35.000 + Beklenen Giriş 20.000 − Beklenen Çıkış 15.000 = 190.000 TL". Gerçek ve beklenen tutarlar başka hiçbir göstergede toplanmaz.
- **Banka Hesapları tablosu:** banka bazında ara toplamlı. Kolonlar: Banka · Hesap · Para Birimi · Gerçek Bakiye · TL Karşılığı · Güncel Kurla · Bekleyen · Son Hareket · Eşleşmeyen. Para birimi bazında toplam satırları.
- "Bu Ay" satırı: Giriş · Çıkış · Bankalar Arası Transfer · Banka Masrafları.
- Altta: Son Banka Hareketleri (10 satır), POS Ödeme Takvimi (14 gün), Nakit Akışı Özeti (30 gün).

### 8.5 Hesap Detayı (talimat 36)
- Başlıkta IBAN, şube, KMH limiti; "Bakiye Doğrulandı" ya da "Açılış bakiyesi doğrulanmadı; eksi bakiye denetimi kapalı".
- Gerçek Bakiye, Bekleyen ve Öngörülen ayrı.
- Son hareketler işaretli tutar ve açıklamayla: "+25.000 TL ABC Ltd. Tahsilat", "−15.000 TL XYZ Ltd. Ödeme", "−250 TL Banka Masrafı".
- Düğmeler: + Masraf, + Faiz, Transfer, Ekstre Yükle, Açılışı Düzelt (ya da Açılış Bakiyesi Gir), Pasife Al.

### 8.6 Hareketler ve İşlem Kartı (talimat 29, 40, 44)
- **Hareketler:** sunucu tarafında sayfalanan tablo; tarayıcıda süzgeç yapılmaz.
  - Süzgeçler: Banka, Hesap, POS, Cari, Fatura, Taksit, İşlem Türü, Para Birimi, Tarih, Valör, Tutar, Giriş/Çıkış, Durum, Eşleşme.
  - Arama: Cari Adı, Açıklama, IBAN, Referans, İşlem No.
  - "Daha Fazla Göster"; `HOF.listGate` + `HOF.refresher` (hof-core.js:291, 330).
  - Hesabı atanmamış satırlar ayrı "Hesabı Atanmamış" görünümünde.
- **İşlem Kartı:**
  - İşlem No, Tür, Tarih, Valör (`explain` ile nedeni), Durum, Kanal, Referans
  - Kaynak → Hedef ("ABC Ltd. (Cari) → Ziraat · Ana TL (Banka)")
  - Tutar ve Para Birimi (iptal edilmiş olayda da kopyadan); 13b'de işlem kuru, ortalama maliyet ve gerçekleşen kur farkı
  - Bağlı Cari / Fatura / Taksit / POS / Kasa / Çek (her biri açılabilir)
  - Fiş satırları, eşleşme durumu (puan bileşenleriyle), İşlem Geçmişi (önceki ve yeni değer)
- Düğmeler: Ters Kaydet, Düzelt, Eşleşmeyi Kaldır, İade Et. **Pasif düğmenin nedeni yanında görünür yazıyla** (hof-invoices.js `blocksHtml` kalıbı).

### 8.7 POS sekmesi
- POS Kartları (Sağlayıcı Türü ve vergi önizlemesiyle) ve Komisyon Oranları ızgarası (Tek Çekim, 2–12 Taksit, Yeni Oran Geçerlilik Tarihi).
- POS İşlemleri ("İptal Et" yalnız provizyon süresi içinde; dışında nedeni yazılı pasif düğme + "POS İadesi Yap"), POS Ödeme Takvimi, Onay Bekleyen Geçişler, Komisyon Faturaları (KDV kipi; "Şimdi Oluştur").
- "+ POS Tahsilatı", "POS İadesi", "Şimdi Aktar".
- Formda alan adı **"POS Taksit Sayısı"**; faturadaki "Taksitlendir" ile karışmasın.

### 8.8 Ekstre ve Mutabakat
- Akış: Ekstre Yükle → Kolon Eşleme (banka şablonu hatırlanır) → Önizleme (Yeni / Mükerrer / Önerilen / Eşleşmeyen sayılarıyla) → Kaydet.
- İki bölmeli ekran: solda ekstre satırları; sağda öneriler, puan ve neden ("Tutar Aynı · Tarih ±0 · POS Gün Sonu · Tekil Tutar"). Hesabı atanmamış aday rozetli.
- Düğmeler: Onayla, Başka Hareket Seç, Bu Hesaba Ata + Eşleştir, Hareket Oluştur (sözlükten önerilen türle), Yoksay, Mükerrer Değil, Güçlü Önerilerin Tümünü Onayla.
- Altta Banka Mutabakat Cetveli.

### 8.9 Diğer ekranlar
- **Ortak seçici `HOF.bank.field`** (K13): `HOF.methodField`'in (hof-core.js:128) yanında tek bileşen.
  - "Havale/EFT" seçilince Banka Hesabı alanı (tek hesapta gizli; formun altında "Ziraat · Ana TL hesabına" bilgi satırı) ve Kanal alanı açılır. Döviz hesabı seçilirse (yalnız cari formunda) Döviz Tutarı, Kur (önerili) ve TL Karşılığı alanları açılır.
  - "POS" seçilince POS, POS Taksit Sayısı ve önizleme ("Komisyon %3,50 · Bankaya Geçecek 3.860,00 TL × 3 · İlk Valör 09.11.2026").
  - "Kredi Kartı" seçilince Kurumsal Kart. İade formlarında alan §4.6 tablosuna göre.
  - Hiç hesap yoksa bugünkü görünüm sürer.
  - Formlar: hof-accounts.js:738, hof-plans.js:771, hof-invoices.js:884 ve :1695, hof-stock.js:299-306, hof-cheques.js:293, hof-workspace.js:45, 341 ve transfer formu (:407-426).
  - Alanlar `name`/`data-field` ile kurulur (FOCUS_KEYS, hof-core.js:78).
- **Fatura formu:**
  - Ödeme satırında yalnız `refreshRest` çağrılır (hof-invoices.js:1136-1141, 1154-1156); satırlar yeniden çizilmez (2.0.23 Bulgu 1 dersi).
  - Her peşin satıra `lineKey`.
  - Döviz seçilince TCMB kur önerisi (§3.12).
  - İptal/Sil onay penceresinde POS'lu faturada "POS İşlemi: Müşteriye İade Edildi / Kayıt Hatası" seçimi ve sonucu (void, İptal İadesi, komisyon tutarı) önizlemeli.
- **Kasa:** Elle girişe banka seçeneği eklenmez (m9). Aktar/Yatır formuna hesap seçici. Kasa penceresi tek kaynaktan `way='cash'` ile okur; bugün/bu ay toplamları değişmez.
- **Çek:** "Bankaya Tahsile Ver" ve "Bankadan Geri Al"; kartta ve listede "Bankada Tahsilde" sanal durumu (§3.14).
- **ANLIK DURUM** (hof-overview.js:96-109):
  - "Banka" kutusunun ana değeri Gerçek Banka. Alt satırlar: POS Bekleyen (Net) · Blokeli POS · Kart ve Kredi Borcu · Hesabı Atanmamış Eski Hareketler.
  - Tıklayınca Banka açılır; `onCardClick`'e `bank` dalı (:216-221).
  - `ov.cash.bank.balance` artık Gerçek Banka anlamına gelir (bilinçli değişiklik). Yeni alanlar: `posNet`, `posBlocked`, `debt`, `unassigned`.
  - Kasa kutusu değişmez.
- **Canlı yenileme (E1.02):**
  - `OVERVIEW_KINDS`'e `'bank'` eklenir; `'invoices'` açığı da kapatılır (C10).
  - Parmak izine `fin_events`, `bank_lines`, `pos_items` (updated_at), `bank_matches` ve `cheque_collections` için `tableState`.
  - `LEDGER_PATHS`'a `[/^\/api\/workspace\/bank\b/, ['bank','cash','accounts','invoices','plans','cheques']]`; açık pencerelerin `onLedger` listelerine `'bank'`.
  - Valör kuyruğu, sihirbaz ve değerleme bitince `workspace.changed {kind:'bank'}` yayımlanır.
- **Birleşik Rapor** (companies.mjs:168-201): K10 adlarıyla beş ayrı sütun: **"Gerçek Banka", "POS Bekleyen (Net)", "Blokeli POS", "Kart ve Kredi Borcu", "Hesabı Atanmamış Eski Hareketler"**. PDF ve Excel'de aynı adlar. Sütunlar yalnız `bank.view` ya da `overview.view` sahibine dolu döner.
- **Nakit Akış:**
  - Başlangıç = Nakit (100) + Gerçek Banka; etiket "Bugünkü Nakit ve Banka". Hesabı Atanmamış Eski Hareketler ayrı satır, başlangıca girmez.
  - Akış kaynakları: POS (valör gününde net), Blokeli POS, Komisyon Tahsili, Planlı Banka, Planlanan Transferler (iç transfer toplamda 0, banka görünümünde ±), Kart Borcu (son ödeme günü), Tahsildeki Çek.
  - `test/is-akisi.test.mjs:95` bankasız veride eşitliği korur.
- **Vade Takip / Zil / Takvim:** POS valör günleri, planlı ödemeler, kart son ödeme günü ve tahsildeki çekler `bank.view` ile eklenir. İstemci `SOURCE_LABELS`'ındaki eksik `invoice` etiketi kapatılır (hof-overview.js:270).
- **Fatura Ayarları → Banka Hesapları:** Banka modülünde ilk hesap açılana kadar eski `seller.banks` listesi düzenlenebilir (E2.16). Sonra liste Banka hesaplarındaki "Faturada Göster" seçimiyle dolar; eski liste sihirbazda "Hesap Olarak Aç" önerisi olur.
- **Yönetim → Eksi Bakiye Denetimi:** Nakit Kasa ayarı orada kalır. Banka satırında "Banka → Ayarlar ve hesap kartında, hesap bazında" bilgisi yazılır.

### 8.10 Raporlar (talimat 28): Rapor Merkezi, "Banka" grubu (`bank.reports`)

| Rapor | Not |
|---|---|
| Banka Bakiye Raporu | Gerçek, bekleyen ve hesabı atanmamış ayrı |
| Banka Hareket Raporu | Tek kaynak; yürüyen bakiye |
| Günlük Banka Raporu / Aylık Banka Raporu | Dış ve iç hareketler ayrı |
| Banka Bazında Bakiye / Para Birimi Bazında Bakiye | Para birimi toplamları `footerUniform` ile |
| POS Satış Raporu / POS Komisyon Raporu | Kip ve vergi ayrımıyla; İptal İadeleri ayrı satır |
| POS Bekleyen Raporu | Normal, Blokeli ve Komisyon Tahsili ayrı; açık tarih aralığı |
| POS Valör Raporu | Gecikmeli aktarımlar ve aktarılamayanlar dahil |
| Banka Masraf Raporu | Tek kaynak `fin_events type='fee'`; hesap (770/653), BSMV ve KDV ayrı kolonlarda |
| Bankalar Arası Transfer Raporu / Kasa ve Banka Transfer Raporu | |
| Cari ve Banka Hareketleri | |
| Fatura ve Banka Hareketleri | Bağ türü: Peşin · Kapatılacak Fatura · Otomatik (En Eski) · Komisyon Kesintisi (Bağlı) |
| Taksit ve Banka Hareketleri | |
| Banka Mutabakat Raporu | Cetvel + eşleşmeyenler |
| Banka Nakit Akış Raporu | "Planlanan Transferler" ayrı satır |
| Ek: Alt Hesap Mizanı, Faturası Beklenen Komisyonlar (Fark ve İade Alacağı dahil), Kur Değerleme Raporu (gerçekleşen ve gerçekleşmemiş ayrı), Tahsildeki Çekler | |

**Kurallar:**
- Mevcut `banka-pos-hareketleri` raporu aynı kimlik, başlık ve izinle kalır; tek kaynağın görünümü olur. Yol seçenekleri: Banka / POS / Kurumsal Kart / Kredi; ayrıca Hesap süzgeci.
- Yürüyen bakiye, kur ve oran kolonları `NO_SUM`'a eklenir (report-center.mjs:76).
- Ekran, PDF ve Excel aynı TOPLAM satırını verir. Rapor başlıkları `server/routes/` altında; yazım düzeni testi bu klasörü tarar.

### 8.11 Ayarlar (K13; son paragraf)

Her bölümde "Varsayılanlara Dön"; değişiklikler audit'e yazılır.

**Temel** (açık gelir; standartlar seçili):

| Bölüm | Ayar | **Varsayılan** | Seçenekler |
|---|---|---|---|
| Hesap | Banka Hesabı Seçimi | **Tek hesapta otomatik (seçici gizli); birden çokta zorunlu** | — |
| Hesap | Varsayılan Tahsilat Hesabı / Varsayılan POS | **İlk açılan TL vadesiz / ilk POS** | Herhangi biri |
| Eksi Bakiye | Banka hesapları | **Uyar** (bakiye doğrulanana kadar Kontrol Yok; KMH ve kart limitine kadar serbest) | Engelle, Kontrol Yok (hesap kartında ayrıca) |
| Mükerrer | Benzer İşlem Uyarısı | **Açık (aynı iş günü; hesaba bağlı banka, POS ve kurumsal kart hareketlerinde)** | Kapalı |
| POS | Valör | **İş Günü, 1 İş Günü** (POS bazında) | Aynı Gün; 2, 3, 7 İş Günü; Özel Gün; Takvim Günü |
| POS | Komisyon Vergisi | **Sağlayıcı Türüne Göre: Banka → BSMV Dahil; Ödeme Kuruluşu → KDV Hariç (Faturalı)** | Her POS'ta: BSMV Dahil/Hariç, KDV Dahil/Hariç, Yok |
| POS | İadede Komisyon | **İade Edilmez** | Oransal; Tam |
| Masraf | Banka Masrafı Vergisi | **BSMV Dahil** | BSMV Hariç; KDV Dahil/Hariç (Faturalı); Yok (formda da seçilir) |
| Masraf | Masraf Türleri (her türün hesabı sabit, vergi kipinden bağımsız) | **Banka Masrafları (770): EFT, FAST, Havale, SWIFT, Hesap İşletim, Döviz İşlem, Diğer · Komisyonlar (653): POS Komisyonu, Sanal POS Komisyonu** | Tür ekle/çıkar (hesabı 770 ya da 653 seçilerek) |
| Döviz | Kur Kaynağı ve Fatura Önerisi | **TCMB Otomatik + Elle; faturada öneri Açık** | Yalnız Elle |
| Döviz | Ay Sonu Değerleme Hatırlatması | **Açık** | Kapalı |
| Tatil | Takvim | **Türkiye Resmî Tatilleri** | + Tatil Ekle/Çıkar |

**Gelişmiş** (kapalı gelir; "Gelişmiş Ayarları Göster"):

| Bölüm | Ayar | **Varsayılan** | Seçenekler |
|---|---|---|---|
| POS | Bankaya Geçiş | **Otomatik (Valör Gününde)** | Ekstre ile ya da Elle Onay |
| POS | Taksitli Satışta Ödeme | **Taksit Taksit (Her Ay, İlki 1 Ay Sonra)** | Tek Seferde (N Gün); İlki Valör Gününde |
| POS | Bloke Süresi / Provizyon Süresi | **0 / Aynı Gün** | Gün |
| POS | Komisyon Faturası (KDV) | **Ay Sonunda Toplu Taslak** | Her Valörde Taslak; Elle |
| Döviz | Değerleme Kuru / Maliyet Yöntemi / Ters Kayıt | **TCMB Döviz Alış / Ağırlıklı Ortalama / Kapalı** | Ertesi Gün Ters Kaydet |
| Döviz | Döviz Hesabında Cari Kuru (13b) | **İşlem Kuru; yoksa TCMB Döviz Alış (iki yönde)** | Elle |
| Döviz | Kambiyo Vergisi Oranı | **Boş (dekonttan girilir)** | Oran |
| Faiz | Mevduat Stopajı | **Son kullanılan oran önerilir** (koda sabit oran yazılmaz) | — |
| Tatil | Hafta Sonu / Yarım Gün / Tatile Düşen Valör | **Cumartesi–Pazar / İş Günü Sayılır / Sonraki İş Günü** | Sayılmaz; Önceki İş Günü; Ay İçinde Kalacak Biçimde |
| Ekstre | Tarih Toleransı / Güçlü Önerileri Otomatik Onayla / Bakiye Sürekliliği Uyarısı | **±3 Gün / Kapalı / Açık** | 0–10 gün; Açık |
| Ekstre | Anahtar Sözcükler | **POS, Nakit, Virman, Ücret ve Faiz sözlükleri (§3.13/5)** | Sözcük ekle/çıkar |
| Hareket | Kanal Alanı | **İsteğe Bağlı** | Zorunlu |
| Hesap Eşlemeleri | Gider ve gelir kodları | **770 Banka Masrafları · 653 POS ve Ödeme Kuruluşu Komisyonları · 642 Faiz Geliri · 780 Faiz Gideri · 646/656 (.01 Değerleme, .02 Gerçekleşen) · 649 Diğer Gelir · 659 Diğer Gider** | Yalnız gider ve gelir kodları (§3.11 beyaz listesi); 102/108/300/309/500 sabit |
| Diğer | İşlem No Öneki / Elle Banka Fişi / Bağdaştırıcılar | **BNK / Kapalı / Kapalı** | — |

### 8.12 Mobil, yazım düzeni, kılavuz
- **Mobil:** Masaüstünde tablo; 720 ve 640 px kırılımlarında satırlar karta döner; yatay kaydırma yok. Mevcut `--do-*` renk değişkenleri kullanılır.
- **Yazım düzeni:** Bütün adlarda her sözcüğün ilk harfi büyük; kısaltmalar aynen (IBAN, POS, KDV, BSMV, EFT, FAST, SWIFT, TCMB, KMH).
  - `hof-bank.js`'i `test/yazim-duzeni.test.mjs` tarar.
  - Ekran denetimi için `senaryo-211` modül turuna ve `ui-ux-217` ekran listesine Banka eklenir.
- **Kılavuz:** Yalnız kısa "nasıl yapılır" maddeleri: Banka Hesabı Açma ve Açılış · Eski Hareketleri Aktarma · Bankadan Tahsilat ve Ödeme · Kasa ile Banka Arası · Bankalar Arası Transfer · Masraf (BSMV ve KDV) ve Faiz · POS Tanımlama ve POS ile Tahsilat · POS İadesi ve POS'lu Faturayı İptal Etme · Komisyon Faturası · Ekstre Yükleme ve Eşleştirme · Döviz Al/Sat, Döviz Hesabına Tahsilat ve Ödeme, Ay Sonu Değerleme · Çeki Bankaya Tahsile Verme · Banka Ayarları.
  - Mevcut 7. bölüm (Kasa ve Banka) güncellenir.
  - Her sürümde site kılavuz PR'ı açılır.

---

## 9. Güvenlik Planı

### 9.1 Yetkiler (talimat 27; K4)
Yeni grup "Banka ve POS", Taksitler grubunun ardından (permissions.mjs:85+).

| Anahtar | Ad (Yönetim ekranında) | Varsayılan roller | Göç: özel rol ve kişi `add` kaydı | Ne açar |
|---|---|---|---|---|
| bank.view | Banka Görüntüleme | admin, avukat, muhasebe | `cash.view` taşıyan | Banka penceresi, bakiyeler, hareketler, takvim |
| bank.reports | Banka Raporları | admin, avukat, muhasebe | `cash.view` taşıyan | Banka grubu raporları (`standalone`) |
| bank.accounts | Banka Hesabı Tanımlama ve Açılış | admin, muhasebe | — (yeni yetenek) | Hesap, açılış, sihirbaz, eski kayıt araçları |
| bank.move | Banka Hareketi Girme ve Bankadan Çıkış | admin, avukat, muhasebe | accounts.manage ∨ invoices.manage ∨ stock.manage ∨ stock.sell ∨ cheques.manage ∨ plans.manage | Masraf, faiz, diğer; bankadan her çıkış; banka bağlı satırda tutar/tarih/yol/hesap değişimi; eksi bakiye onayı; POS iadesi |
| bank.cancel | Banka Hareketi Silme, İptal ve Ters Kayıt | admin, avukat, muhasebe | `bank.move` ile aynı küme (K4 kabulünün gereği) | Banka bağlı satırı silme, ters kayıt, POS void, açılış düzeltme |
| bank.transfer | Transfer Yapma | admin, avukat, muhasebe | `cash.manage` taşıyan | Bankalar arası, Kasa↔Banka (`cash.manage` ile), döviz al/sat, kredi |
| bank.pos | POS Tanımlama | admin, muhasebe | — | POS kartı, valör, bloke, vergi kipi, bekleyenleri taşıma |
| bank.commission | Komisyon Oranlarını Değiştirme | admin, muhasebe | — | Oran ızgarası, komisyon faturası taslağı |
| bank.statement | Ekstre Aktarma | admin, avukat, muhasebe | `cash.manage` taşıyan | Yükleme; eşleşmesiz ekstreyi silme |
| bank.reconcile | Mutabakat Yapma | admin, avukat, muhasebe | `cash.manage` taşıyan | Eşleştirme, kaldırma, hareket oluşturma (+ hedef yetki), valör onayı |
| bank.settings | Banka Ayarları | admin, muhasebe | — | Ayarlar, elle kur, tatiller, hesap eşlemesi |

- Göç yalnız hub'da ve idempotent. Yerleşik roller yetkiyi matristen kendiliğinden alır.
- (Aşama 2 gözden geçirmesi D5) Göç her özel role ve kişiye "verildi" işareti (`bank.granted`; katalogda yok, yetki vermez, ekranda görünmez)
  yazar. Banka anahtarları Aşama 3'e kadar katalogda olmadığından eski sürümün (ve bugünkü Yönetim ekranının) rol/kişi kaydı onları işaretle
  birlikte siler; işaretsiz rol/kişi ortak katmanın her açılışında ve rol/kişi kaydından hemen sonra bugünkü yetkilerinden YALNIZ EKLEYEREK
  yeniden değerlendirilir. **Aşama 3:** banka yetkilerini elle düzenleyen ekran işareti korumalı (yöneticinin bilinçli kaldırdığı yetki geri
  eklenmesin); bu kural o ekranla birlikte yeniden yazılır.
- `users.grants_json.remove`'da `cash.view` varsa yalnız `bank.view` ve `bank.reports` kaldırılmış sayılır; yazma anahtarlarına yansıtma yok (K4).

### 9.2 Kurallar
1. **Sunucu tek güvenlik katmanıdır** (talimat 41). Her uçta `requirePermission`; modüller arası kural `canUser` ve Türkçe 403 (invoices.mjs:1107 kalıbı). İstemcideki `data-requires` yalnız görünürlük.
2. **Bankaya giriş:** Modülün bugünkü tahsilat yetkisi yeter. Personelin havale ve POS tahsilatı **bozulmaz**.
3. **Bankadan çıkış:** Modülün yönetim yetkisi + `bank.move`. Kasa↔Banka için `cash.manage` + `bank.transfer`.
4. **Banka bağlı satır (`fin_ref` dolu)** (K4, E1.05, E2.17):
   - Silme: modül yetkisi + `bank.cancel`.
   - Tutar, tarih, yol ya da hesap değişimi: modül yetkisi + `bank.move`. Hesap bazında etki(önce) − etki(sonra) hesaplanır; azalan her hesapta son durum eksi bakiye denetlenir.
   - Yalnız açıklama değişimi: modül yetkisi yeter.
   - Kural ortak `assertMutable` ile altı modülün PUT/DELETE yollarına ve Silinenler geri yüklemesine bağlanır.
   - **Bilinçli istisna:** Personel kendi girdiği banka bağlı satırı silemez, parasal alanlarını değiştiremez. Nakit ve hesabı atanmamış satırlarda bugünkü kural sürer.
   - **Kabul ölçütü:** Bu istisna ve K8'in yeni taksit kuralı (ödenmiş karta tahsilat) dışında "dün 200 dönen her para işlemi bugün de 200". Göç testi özel rol ve `add`/`remove` verisiyle koşar.
5. **Lisans:** Bütün banka yazma anahtarları `WRITE_PERMISSIONS`'a eklenir (license.mjs:46-49); `invoices.manage` ve `invoices.settings` açığı da kapatılır. Sistem valör aktarımı salt okunurda da yazılır.
6. **Raporlar:** Banka raporları `bank.reports` ister; mevcut "Banka ve POS Hareketleri" raporunun izni değişmez. Birleşik raporda banka sütunları `bank.view ∨ overview.view` ister. Öbür sütunlardaki mevcut sızıntı (companies.mjs:201) Riskler'de.
7. **Silinenler:** Banka bağlı hareketin geri yüklenmesi `records.delete` + kaynak modül yetkisi + `bank.move` + `assertOpen` ister. Bugün yalnız `records.delete` isteniyor (trash.mjs:183-184).
8. **Audit:**
   - Her banka yazımı aynı işlemde `audit(user, 'bank.<varlık>.<eylem>', id, { previous, ...next })` yazar. Düzeltme, silme, taşıma, geri yükleme ve atamada `previous` zorunlu; statik test tarar.
   - `EVENT_LABELS`'a (client/assets/admin.js:9) `bank.*` etiketleri.
   - Dışa aktarma da audit'e yazılır. `store.raw` kapsamları `integrity_log`'a gerekçesiyle.
9. **Girdi doğrulama:**
   - Tutar `parseMinor`: 0 < tutar ≤ 1e12 TL, en çok 2 ondalık; kur en çok 6 ondalık.
   - Tarih `movementDate`; IBAN `isValidIban`; metinler `limited`.
   - Ekstrede satır ve boyut sınırı. Açıklama metni Excel/PDF'te `=+-@` ile başlıyorsa metin olarak yazılır; ekranda `HOF.esc`.
10. **Hassas veri:** Kart numarası saklanmaz, yalnız son 4 hane (CHECK). Bağdaştırıcı anahtarları `secret-box.mjs` ile mühürlenir. IBAN günlüklere yazılmaz.
11. **Şirket ayrımı:** Her şirketin ayrı veritabanı, banka servisi ve kuyruğu var. `?hofCompany=` ile yetkisiz şirkete erişim 403, başka şirketin hesap kimliği 404.
12. **Eşzamanlılık:** Hedef kuralları (taksit kalanı), eksi bakiye ve benzer işlem BEGIN IMMEDIATE içinde. İstek kimliği PK çakışmasıyla, valör koşullu UPDATE ile korunur. Ağ çağrısı (TCMB, e-Belge) işlemin dışında.

---

## 10. Veri Migrasyonu

### 10.1 Gerekli mi?
- **Şema göçü: evet.** v20 yalnız ekleyici.
- **Mevcut veri: değişmez.** Hiçbir satır güncellenmez (K11).
- Eski hareketlerin gerçek hesaplara dağıtılması kullanıcının başlattığı sihirbazla yapılır, göçte yapılmaz.

### 10.2 v20 adımları
- Göç tek işlem; öncesinde şirketin klasörüne otomatik tam yedek (migrations.mjs:1119-1123). Göç `store.raw('migration.v20', …)` kapsamında çalışır.
  1. §5.2'deki tablolar ve indeksler.
  2. §5.3'teki kolonlar ve kısmi indeksler.
  3. Yalnız hub'da yetki göçü (§9.1).
  4. `meta.schema.v20At` damgası.
  5. Başka ayar yazılmaz; varsayılanlar kodda.

### 10.3 Kurulum ve Aktarım Sihirbazı (eski hareketler)
Kullanıcı başlatır. İlk hesap açılırken hesabı atanmamış eski bakiye sıfır değilse gösterilir; varsayılanlar seçili gelir.
- **Açılış bakiyesinin anlamı:** Açılış tarihi D'nin **gün başındaki** banka bakiyesi S. D'den önceki hareketler bu bakiyenin içinde.
- **Devir Kapanışı** (varsayılan Açık; D açık dönemde olmalı):
  - 102.00'ın D−1'e kadarki bakiyesi X ve 108.00'ınki Y şöyle kapanır: B 500 / A 102.00 X ve B 500 / A 108.00 Y (eksiyse ters yön).
  - Açılış fişi B 102.k S / A 500. Sonuçta 102 toplamı S; kilitli dönem değişmez.
- **Bu Hesaba Bağla** (varsayılan Açık, satır seçilebilir; `op 'assign'`):
  - Yalnız eski **bank** satırları, yalnız açık dönemde, yalnız satır tarihi hedef hesabın açılış tarihinde ya da sonrasındaysa ve yalnız TRY hesaba.
  - Her satıra `fin_ref` ve `event_id` atanır, olay açılır.
  - Faturadan gelen satırlarda `payment_json`'daki `lineKey` ve `eventId` aynı işlemde yazılır (E2.06).
  - Kilitli dönemdeki satırlar "Kilitli Dönem — Atanamaz" sayacında.
- **D'den sonraki eski POS ve kart satırları:** "Bankaya Geçmiş Say" (B 102.k / A 108.00) ya da "Kart Borcuna Aktar" (B 108.00 / A 309.k). İkisi de bugün ya da seçilen açık tarihle.
- Sihirbaz tek işlem, istek kimliği taşır, `bank.setup` audit kaydı yazar.
- **"Sihirbazı Geri Al"** tek işlemde: olaylar ters kaydedilir, bağlar ve `payment_json` alanları geri alınır (`op 'assign'`).
- Sihirbaz yapılmazsa §8.4'teki satır görünür. Eski satırlar 102.00/108.00'da kalır, eksi bakiye denetimine girmez.

### 10.4 Eski satırların kuralları
- Seçim zorunluluğu kategori bazında başlar (§3.5/2). Düzeltmede yolu, tutarı ve tarihi değişmeyen eski satır bağsız kalır, olay açılmaz (§3.5/4).
- Hesap tanımlanana kadar yeni kod satıra `fin_ref=''` ama `event_id` yazar. Bu satırlar da "Hesabı Atanmamış" kovasında görünür; tespit açısından eski sürüm satırından ayrılırlar.

### 10.5 Kabul ölçütü ve fikstürler (K11)
- **Kapı imza kuralı:** Kapı imzası değişen her taban sapmasını geri alır (B3). Bu yüzden:
  - v20 hiçbir satırı değiştirmez.
  - Yeni denetimler eski veride boş geçer. `pos:terminal:*` yalnız gerçek terminalleri denetler, 108.00 kapsam dışı.
  - Kilit izinin eski girdileri değişmez; yeni girdiler eski veride satır üretmez (§5.5).
  - `dates:future` taban kümesi kuralı (A13) eski ileri tarihli satırları sayıdan çıkarır; imza göçte ve gün geçtikçe değişmez.
- **Her fikstürde göç öncesi ve sonrası aynı olmalı:**
  - `run().failures` imza kümesi
  - Hesap kodu bazında mizan tutarları (649'un adı Aşama 2'de değişmez — Aşama 4'te değişir; tutarı değişmez)
  - Kilit izi (2.0.26 tanımıyla)
  - `cash.summary` toplamı ve Kasa'nın bugün/bu ay giriş-çıkışı
  - Cari bakiyeleri ve fatura ödeme durumları (kapama değişmez)
  - ANLIK DURUM'da Gerçek Banka + POS Bekleyen + Hesabı Atanmamış = göç öncesi Banka/POS değeri (eski veride Gerçek Banka 0, Hesabı Atanmamış = eski değer)
  - Kasa penceresinin satır ve toplamları
  - Banka ve POS Hareketleri raporunun satır ve toplamları
- Ayrıca yeni denetimlerin hepsi `ok` olmalı ve `integrity_log`'a yeni baseline yazılmamalı.
- **Fikstürler** (CLAUDE.md test kuralı):
  - Mevcut v2.0.16–2.0.20 zincirleri.
  - Yeni v2.0.21–2.0.26 fikstürleri `tools/surum-verisi.mjs` ile **o sürümün gerçek koduyla** (git etiketi) API'den üretilir. Hacim: binlerce cari ve satır, 12+ ay.
  - İçerik: her modülde bank/card satırı, Kasa↔Banka, silinip geri yüklenmiş tahsilat, iade ve iptal, kilitli dönem, 2 şirket, ileri tarihli çek (2.0.25'te girilebiliyor), yalnız Borç Yaz satırı olan cari. Ayrıca `maxCompanies` ile 3 şirketli bir eski kurulum.
  - Zincir: 2.0.16 → … → 2.0.26 → v20.

### 10.6 Eski sürüme dönüş ve açılış onarımı (E1.16, E2.08)
- **Gerçek durum:** 2.0.25 v20 veritabanını açar ve yazar, çünkü `pending` boşsa göç dönüşü yapar (migrations.mjs:1114-1116). Yalnız yedeğin geri yüklenmesi reddedilir (company-backups.mjs:90). Güncelleme deneme açılışı başarısız olursa yalnız 001 göç öncesi yedeğe döner (update-orchestrator.mjs:160-168).
- **Açılış onarım adımı:**
  - `integrity.start()`'tan önce, `store.raw('repair', …)` kapsamında, kısa sürede çalışır. Yalnız `meta.bank.repairStamp`'tan sonra yazılmış satırları tarar.
    (Uygulamada: bütün satırları tarar — bilinçli sapma, §5.4 notu; eski sürüm satırı rowid işaretiyle YA DA işaretin zamanından
    (`meta.bank.legacyMarksAt`) sonra oluşturulmuş olmasıyla tanınır, Aşama 2 gözden geçirmesi D4.)
  - Kuyruklu iş değildir; yazdıkları küçüktür ve kapıdan önce yapılmaları gerekir.

| # | Durum | İşlem |
|---|---|---|
| a | `event_id=''`, `created_at` > `v20At` olan para satırı (eski sürüm yazmış) | "Hesabı Belirsiz Yeni Hareketler (n)" uyarısı, zil, "Bu Hesaba Ata" |
| b | Eşleşmiş olayın satır özeti değişmiş ya da satır silinmiş | Eşleşme `undone (eski-surum)`; audit ve zil |
| c | Bekleyen POS satışının kaynak satırı silinmiş | Satış iptal (void) |
| d | Bankaya geçmiş POS satışının kaynak satırı silinmiş | "Onarım Bekliyor" + yönetici uyarısı; çözüm İptal İadesi kaydı. Sapma yalnız `pos:terminal:<o POS>`'u etkiler. |
| e | Satırı olmayan etkin olay | `cancelled`; audit ve zil |
| f | Yolu cash olup `fin_ref`'i dolu satır | Açık dönemde `fin_ref` temizlenir, olay kopyası güncellenir; kilitli dönemde yalnız uyarı |
| g | Olay kopyası satırla uyuşmuyor | Açık dönemde ve eşleşmemişse kopya yenilenir; değilse "Onarım Bekliyor" |
| h | Etkin `cheque_collections` kaydı olan çek eski sürümde ciro edilmiş, silinmiş ya da tahsil edilmiş | Kayıt `withdrawn (eski-surum)` ya da (tahsilde) `collected` olarak kapatılır, `fin_events` yazılır; zil |

- **2.0.25 tarafında:** 2.0.25 `source='bank'` satırlarını kendi yevmiyesinde 108'e yazar ama beklenenden dışlar; orada `gl:108` taban sapması ve uyarı oluşur. Ayrıca 2.0.25 `cheque_collections`'ı bilmediği için tahsildeki çek kendi defterinde 101'de görünür (tutar aynı, alt hesap yok). İkisi de BİLİNEN SINIR olarak CHANGELOG'a yazılır.
- Eski sürüm yedeği yeni sürüme yüklenebilir (göç çalışır). 2.0.26+ yedeği 2.0.25'e yüklenemez (mevcut kural).

### 10.7 Doğrulama komutları
- `npm test`
- `npm run test:mutabakat --islem 5000 --tohumlar 2`: bağımsız model (test/mutabakat/motor.mjs) banka türleriyle ve K8 avans dalıyla genişler.
- `npm run test:guvenilirlik` 2×1000: rastgele sıraya banka işlemleri eklenir.
- `npm run mutabakat -- --sirket <kod|tümü>`: araç bütün şirketleri dolaşır (bugün yalnız 001, tools/mutabakat.mjs:24-25).
- Göç zinciri testi; arıza testi (göç, kuyruk, ekstre ve sihirbaz ortasında SIGKILL; disk dolu; kilitli dosya); yedek tatbikatı (yedek → çalış → geri yükle → sayılar → yeniden çalış).

---

## 11. Riskler

### 11.1 Mevcut hatalar (K12: Aşama 0 listesi)

| # | Hata (kanıt) | Aşama 0'da mı? | Düzeltme |
|---|---|---|---|
| A1 | Kayıt tahsilatında tarih, kilit ve eksi bakiye denetimi yok (workspace.mjs:48-54, 385-406). Silinenler yükünde yol yok (:398); geri yükleme `'cash'` yazıyor (trash.mjs:287); silinip geri yüklenen havale nakde dönüyor. | **Evet** | `movementDate`, `assertOpen`, `guardChange`; yük `method` taşır; `trash.add` ve audit işlem içine alınır, audit'e `previous.method`. Kaybolmuş eski yol geri gelmez (BİLİNEN SINIR). |
| A2 | Taksite Aktar ödeme yolunu kaybediyor (plans.mjs:1295-1302; plan-transfer.mjs:346-354, 440-443). | **Evet** | Yol taşınır (v20'de `fin_ref` ve `event_id` de). |
| A3 | Cari silme ve geri yükleme kilitli dönemdeki satırları sessizce düşürüyor. Silinmiş carinin bütün satırları (Borç Yaz/Alacak Yaz dahil) yevmiyeden çıkıyor (routes/ledger.mjs:18-23). Tür değişikliği (accounts.mjs:451) kilitli dönemin 120/320/336 sınıfını kaydırıyor. Kilit izi `accounts`'a bakmıyor (accounts.mjs:466-489, 1130-1143; integrity.mjs:64). | **Evet** | Kilitli dönemde **herhangi bir** `account_entries` satırı olan cari silinemez, geri yüklenmez, türü değiştirilemez (nedenli 409). `guardChange` eklenir. Kilit izine `party_lock` girdisi (id, type, silinmemiş; §5.5). |
| A4 | Taksit kartı silmede eksi bakiye denetimi yok; geri yükleme kilit sormuyor (plans.mjs:580-598; trash.mjs:242-255). | **Evet** | `guardChange` + `assertOpen`. |
| A6 | Çek oluşturma, düzenleme ve silmede dönem kilidi yok; alış/veriliş tarihi ileri tarih olabiliyor (cheques.mjs:249 `dateOf`); kilit izi ve DATED çekleri kapsamıyor (cheques.mjs:304-352, 424-441; integrity.mjs:58-70). | **Evet** | Alış/veriliş tarihi `movementDate` ile (ileri tarih 400, kilitli 409); `assertOpen`; kilit izine `cheque_events` ve `cheques` (status hariç); DATED'e `cheque_events` (A13 kuralıyla, eski ileri tarihli çek olayları taban sapması olmaz). |
| A7 | Geri yükleme eksik bilgiyle yazıyor: `source=''`, `invoice_id` yok, `roundMoney` yok (accounts.mjs:1144-1162). Kasa geri yüklemesi kilit sormuyor (trash.mjs:300-327). | **Evet** | Bütün kolonlar taşınır, `roundMoney`, `assertOpen`. |
| A9 | Mahsupta kullanılan satır silinince `invoice_offsets` temizlenmiyor; kullanıcı genel 409 görüyor (accounts.mjs:597-601; integrity.mjs:213-224). | **Evet** | Nedenli 409: "Önce mahsubu kaldırın". |
| B5 | Silinenler'e yazım işlem dışında (cash.mjs:304; workspace.mjs:401). | **Evet** | İşlem içine alınır. |
| B7 | Tanınmayan yol üç yerde üç farklı davranıyor (cash.mjs:59, 70-72, 148; general-ledger.mjs:42). İç yazıcılar `methodOf` ile sessizce nakde çeviriyor (accounts.mjs:505; cheques.mjs:237; stock.mjs:300). | **Evet** | İç yazıcılarda katı yol (tanınmayan yol hata); kapıya `money:method`. Okuma tarafı v20'de tek kaynağa (K5). |
| **A12 (yeni)** | Dönem kilidi varken "Tüm Hareketleri Sil" 409 `ledger-integrity` / `period-lock` veriyor (app.mjs:525-546; geçici sunucuda yeniden üretildi). | **Evet** (banka sıfırlamasını da bozar; kullanıcıya bildirilir) | Bu kipte kilit de kaldırılır; onay penceresinde yazılır, audit tutulur. |
| **A13 (yeni)** | `dates:future:<tablo>` imzası ileri tarihli satır **sayısını** içeriyor (integrity.mjs:258-261, 273). Eski veride ileri tarihli satır varsa gün geçtikçe sayı küçülür, imza tabanda olmaz; bir sonraki yeniden başlatmaya kadar **bütün para işlemleri 409** alır (taban yalnız başarılı COMMIT'te güncellenir, :325-331). A6 DATED'e `cheque_events` eklerken bunu tetikler; 2.0.24 öncesi ileri tarihli işlemler ve 2.0.25'te ileri tarihli çek alış tarihi bu veriyi üretmiş olabilir. | **Evet** (aynı ölçüt: A6 ve v20 göçünü bozar; kullanıcıya bildirilir) | `start()` her DATED tablosundaki ileri tarihli satırların kimliklerini taban kümesine alır; `dates:future` sayısı yalnız bu kümede olmayan ileri tarihli satırlardır. Eski satırlar yaşlandıkça sayı ve imza değişmez; yeni ileri tarihli satır yine engellenir. Kırmızı test: sahte saatle ileri tarihli eski satır → gün ilerlet → para işlemi 200. |
| A5 | Kart silinince para satırının ne olacağı modüle göre değişiyor. | Hayır, Aşama 5/8 | Banka bağlı cari ve taksit kartı silinmez (§3.8); stok kartı bugünkü gibi. |
| A8 | Açılış hesabını açıklama metni belirliyor (general-ledger.mjs:43). | Hayır | Banka açılışı fiş türüyle tanınır. Cari için davranış değişmez; değişirse eski mizan değişir (BİLİNEN SINIR). |
| A10 | Arka planda para yazan iş yok. | — | K3 (§4.4). |
| A11 | Tablo raporlarının nakit akışı yol ayırmıyor (reports.mjs:88-93). | Hayır, Aşama 14 | Yalnız nakit olarak açıkça tanımlanır. |
| C10 | `OVERVIEW_KINDS`'te `invoices` yok (overview.mjs:26). | Hayır, Aşama 14 | §8.9. |
| — | `LABEL_SLOTS`'ta `side.invoices` ve `side.analytics` yok; `WRITE_PERMISSIONS`'ta `invoices.*` yok. | Hayır, Aşama 3 | §8.1, §9.2/5. |

### 11.2 Banka modülü riskleri

| Risk | Etki | Önlem |
|---|---|---|
| Yeni para yolu tek kaynağa eklenmez (D4) | Her işlem 409 alır ya da ekranlar ayrışır | `moneyLines` tek tanım; `money:event` satır denetimi; `bank:sub` iki ayrı yoldan karşılaştırır; `money:report` |
| Çalışma anı denetimi yanlış alarm verir | Testler gereksiz kırılır ya da denetim kapsamı bütün yazımlara yayılır | Satır düzeyinde "para satırı" yüklemi (§3.3/b); izinli ham yazım listesi; `assertNonMoney`; `store.raw` |
| Göç taban sapması bırakır (B3, A13) | Banka işlemleri kilitlenir | §10.5 ölçütü; varlık bazında kodlar; `dates:future` taban kümesi |
| 191/193 tuzağı | İlk masraf ya da faizde 409 | Beyaz liste (fx_gain/fx_loss dahil) + statik test; 193 beklenen değeri genişler; kırmızı test |
| `card` iki anlam taşıyor | 108 karışır; kurumsal karta iade POS satışı olur | 108 (POS) ve 309 (kart) ayrılır; alan belge türüne göre (§4.6) |
| Yeni değer CHECK'li eski tabloya yazılır | INSERT CHECK hatasıyla düşer | `fin_events.type` sözlükte; Bankaya Tahsile Ver yalnız `cheque_collections` + `fin_events`; `cheque_events`'e yalnız izinli türler. Statik test: `cheque_events.kind` ve `cheques.status`'a yazılan değerler CHECK listesinde. |
| Valör kilitli güne düşer ya da sunucu kapalı kalır | Geçiş yazılamaz | K3: kilit + 1, `late`, kilit öncesi kuyruk, açılış ve hub denetimi |
| Senkron SQLite kuyruğu sunucuyu dondurur | Bütün kullanıcılar bekler; 90 sn deneme açılışı aşılır | Kuyruk `listen`'den sonra; tur başına 200 grup / 1 sn; ölçüm |
| Toplu işlem tek uzun işleme dönüşür | Bir belgedeki sapma hepsini geri alır; yazanlar bekler | Toplu fatura belge başına ayrı işlem (§3.3); tek dış işlem yalnız ağ çağrısız sistem işlerinde |
| Eşleşmiş satır başka yoldan değişir | Mutabakat bozulur | `assertMutable` + dokunulan olaylarda `bank:matches` |
| Fatura Düzenle satır kimliğini değiştiriyor (C1) | Bağ kopar | `lineKey` + olay korunur |
| POS'lu fatura iptali ile POS kuralları çelişir | Beklenmeyen komisyon ya da 409 | Tek kural tablosu (§4.6): provizyon içinde void, sonrası İptal İadesi; Kayıt Hatası ayrı seçenek |
| POS'lu satırları düzeltme yolları kapanır | Kullanıcı nedenini anlamadığı 409'lar görür | `bank.replan`; 409 yalnız eşleşmiş ya da kilitli kayıtta ve nedenli |
| Kapı maliyeti (2.0.22 yük bulgusu) | Yavaşlık | §3.11 ölçek tasarımı; bütçe; Aşama 2 ve 16 ölçümleri |
| TCMB erişilemez ya da biçim değişir | Kur yok | Elle kur; işlem engellenmez; sabit XML fikstürü |
| Bayram tablosu eskir | Valör kayar | Yıl sonu uyarısı; şirket ekleri; `explain` |
| Yanlış otomatik eşleşme | Yanlış "mutabık" | Onaysız eşleşme yok; aynı adlı iki aday ve eşit puan Güçlü sayılmaz; tekillik puanı; geri alınabilir; para değişmez |
| Ekstrede meşru iki aynı satır | Mükerrer sanılır | Parmak izinde sıra numarası; "Mükerrer Değil"; tekillik puanı düşer |
| KDV ↔ BSMV karışması | Vergi riski | Sağlayıcı Türü; açıklama metni; 191 tek kaynak; gider hesabı masraf türüne bağlı; sapma teslimde yazılır |
| KDV kesintisi ilgisiz faturayı kapatır (m5 sınıfı) ya da kendi faturasını hiç kapatmaz | Hayalet "Ödendi" ya da kalıcı "Açık" | `pos-fee` kökeni `payPay` + "yalnız bağlı" (`linkedOnly`); FIFO dışı; Aşama 11 ek testi |
| 13b ödemesinde kur farkı yanlış sınıflanır | 102.03'te TL artığı; değerleme gerçekleşmişi gerçekleşmemiş sayar | Ortalama maliyet + gerçekleşen fark aynı olayda (§3.12); bağımsız BigInt modeli |
| K8 mevcut testleri ve iş akışını kırar | `motor.mjs` kırmızı; Taksite Aktar durur | İşlem türüne göre kapsam (move hariç); `motor.mjs` bilinçli güncelleme (§11.4) |
| Benzer İşlem gereksiz 409 üretir | Kasada günlük iş durur | Yalnız hesaba bağlı satırlar; hedefli anahtar |
| Yetki göçü kesinti yaratır | Dün yapılan iş bugün 403 alır | K4 eşlemesi; özel rol + add/remove göç testi |
| Personel kendi banka satırını silemez | Alışkanlık değişir | Bilinçli; nedeni görünür yazıyla; kılavuzda |
| K10 görünüm değişikliği | Hesap tanımlamamış kurulumda Banka ana değeri "—"; nakit akış başlangıcı eski havaleleri içermez | Teslim notunda ve kılavuzda; Kurulum Sihirbazı çağrısı; eski kova ayrı satırda |
| Birleşik rapor sızıntısı (mevcut, geniş) | Personel toplamları görür | Banka sütunları kapatılır; öbür sütunlar ayrı kullanıcı kararı |
| Sıfırlama listeleri eksik kalır | "Tüm Hareketleri Sil" sonrası bakiye ya da yinelenen İşlem No kalır | §5.6 + A12 + sayaç + şirket testi |
| Rapor parametresi kaybı (Bulgu 4) | Süzgeç sessizce atılır | `queryOf` + `SELECTS` aynı commit'te; raporlar-224 kalıbı |
| Fatura ödeme alanında odak kaybı (Bulgu 1) | Veri kaybı | Yalnız `refreshRest`; senaryo-223 + Tab adımı |
| Döviz yuvarlama | Kuruş farkı | BigInt; bağımsız model testi |
| Kapsam büyüklüğü (`bank.post` bütün para yollarında) | Gerileme | Aşama aşama; her aşamada mevcut bütün senaryolar ve fikstür zinciri |

### 11.3 Bilinen sınırlar (teslimde aynen yazılır)
- Mevcut REAL para kolonları değişmedi (K1). Kesinlik kapı ve özellik testiyle güvencede; tam göç Aşama 17'de.
- 2.0.25'e geri dönülürse orada `gl:108` taban sapması uyarısı görülür ve tahsildeki çek 101 alt hesabı olmadan görünür (§10.6).
- Döviz hesabı yalnız cari tahsilat/ödeme ve Banka Fişi'nde seçilir; fatura peşini, taksit, stok ve çekte seçilemez.
- 13b'de gerçekleşen kur farkı kayıt anındaki ortalama maliyetle sabitlenir; sonradan araya girilen geriye tarihli döviz girişi önceki farkı değiştirmez (kalan farkı dönem sonu değerlemesi kapatır).
- "Kaynaksız (Eski Satış)" POS iadesinde iade ≤ satış denetlenemez.
- Kilitli dönemdeki eski satırlar hesaba atanamaz; 102.00/108.00'da kalır.
- Açılmamış şirkette valör günde bir kez hub denetimiyle yazılır; uyarı bir güne kadar gecikebilir. Sayılar okuma anında "Valörü Gelmiş, Aktarılmadı" satırıyla doğru görünür.
- Eski sürümde silinen ve bankaya geçmiş POS satışı "Onarım Bekliyor" olarak kalır; yalnız kendi POS'unu etkiler.
- Kaybolmuş eski yol (A1, A2) geri getirilemez.
- Benzer İşlem Uyarısı nakit ve hesabı atanmamış hareketlerde çalışmaz (yalnız istek kimliği korur).
- Yedekten geri yüklemede İşlem No sayacı da geri döner; geri yükleme anından sonra verilmiş numaralar yeniden verilebilir (fatura serisiyle aynı).
- Bağlanmamış KDV kesintileri komisyon faturası kaydedilene kadar sağlayıcı carisinde lehimize bakiye olarak görünür.
- Bayram tablosu 2026–2031.
- Ekstre yalnız CSV/Excel; PDF ekstre yok. Bağdaştırıcılar kapalı.
- Canlı yetki yenilemesinin 002'deki açık pencerelere ulaşıp ulaşmadığı (admin.mjs:77) Aşama 15'te doğrulanacak.
- Birleşik raporun banka dışı sütunlarındaki yetki açığı ayrı kullanıcı kararı.

### 11.4 Bilerek güncellenecek testler
Her biri gerekçesiyle ayrı commit'te:
- `test/migrations.test.mjs:26` ([1..19] → [1..20]).
- `test/raporlar-224.test.mjs:646-651` (REPORT_IDS + banka raporları).
- `test/insight.test.mjs:510` (side.bank, side.invoices, side.analytics).
- Yetki katalog ve görünürlük testleri (yeni grup, CSS kuralı).
- Birleşik rapor ve ANLIK DURUM Banka kutusu değer testleri (K10 sütunları); `test/e2e/run.mjs:750` kutu listesi aynı kalır.
- **`test/mutabakat/motor.mjs` `taksit-tahsil` dalı (motor.mjs:845; K8):**
  - Kalan 0 olan aktif karta tahsilat artık 409 `plan-paid` bekler (`expectReject`).
  - Yarı olasılıkla yönetici kullanıcıyla `overpay:true` gönderilir; avans modelde kartın "extra"sına ve cariye yazılır.
  - Kalanı aşan rastgele tutar dalı eklenir (409 `plan-overpay`).
  - Taksite Aktar dalları değişmez.
- K8 kapsamına giren başka mevcut test varsa (ödenmiş karta ikinci tahsilat yapan; `grep "plans/.*/entries"` ile taranır) aynı gerekçeyle güncellenir ve listesi kanıt dosyasına yazılır.

**Değişmemesi beklenenler:**
- `test/donem-213.test.mjs:195-199`, `test/mutabakat/motor.mjs:131-134` ve motor'un taksit dışı dalları.
- `test/is-akisi.test.mjs:95`.
- Kasa'nın bugün ve bu ay sayılarını denetleyen testler (ANLIK DURUM Kasa kutusu, `cash.summary`): §3.4'teki iç hareket ayrımı Kasa'ya uygulanmaz.
- Fatura kapama testleri (`fatura-216`, `bulgu-223`, `iade-224`): `pos-fee` kökeni yalnız yeni satırlarda var.
- Toplu kesim ve iptal testleri: belge başına işlem düzeni korunuyor.
- Mevcut bütün arayüz senaryoları. Benzer İşlem hesaba bağlı olmayan satırlarda çalışmadığı için hesap tanımlamayan senaryolar etkilenmez.

Biri değişirse gerilemedir; iş durur ve kullanıcıya bildirilir.

---

## 12. Geliştirme Aşamaları

### 12.1 Sıra ve teslim grupları

| Sıra | Aşama | Sürüm | Gerekçe |
|---|---|---|---|
| 1 | Aşama 1: Analiz ve bu plan | — | Kullanıcı onayı. **Hiçbir kod değişikliği onaydan önce başlamaz** (talimat 45). |
| 2 | Aşama 0: Ön düzeltmeler | 2.0.26 | Banka kodundan bağımsız; mevcut müşterilere düzeltme; göçün ön şartı. |
| 3 | Aşama 2–9 + 13 (+ 14–16'nın ilgili dilimleri) | 2.1.0 (Banka İlk Teslim) | Hesaplar, hareketler, bütün modül entegrasyonu, transfer, döviz (13b dahil), Bankaya Tahsile Ver, raporlar, yetkiler, kılavuz. Aşama 13 K9 nedeniyle öne alındı; POS'a ve ekstreye bağlı değil. |
| 4 | Aşama 10–11 (+ dilimler) | 2.2.0 | POS, komisyon, valör, iade, iptal, KDV kipi |
| 5 | Aşama 12 (+ dilimler) + 14–16 tam tarama | 2.3.0 | Ekstre ve mutabakat; kabul testinin 37 adımı baştan sona ekrandan |
| 6 | Aşama 17 | Ayrı proje (önerilen 3.0.0) | REAL → INTEGER göçü |

- Her sürüm kendi içinde bütündür; yarım özellik görünmez. POS tanımlanmadan POS yolu eski davranışla çalışır.
- Kullanıcı tek sürüm isterse sıra aynı kalır.

### 12.2 Her aşamada
- Önce "Nasıl Bozarım" listesi ve kırmızı testler, sonra kod. Testler eski kodda kırmızı olmalı.
- `npm test`, `test:mutabakat`, `test:guvenilirlik`, göç zinciri ve ilgili arayüz senaryoları. Mevcut bütün senaryolar değişmeden yeşil (§11.4 dışında).
- İş akışı testi: gerçek kullanıcı senaryosu sıfırdan, arayüzden, uçtan uca; sayılar bağımsız beklenenle karşılaştırılır; ekran görüntüsüyle kanıtlanır.
- Kanıt dosyası `docs/<s>-KANIT.md` (DENENEN / DENENMEYEN / BİLİNEN SINIRLAR). Bağımsız gözden geçirme (ayrı ajan, yalnız hata arar); bulgular önce kırmızı testle düzeltilir.
- Teslim CLAUDE.md düzeninde: 5 dosya zipsiz + arşiv zip. Kullanıcı "birleştir" demeden birleştirilmez.

### 12.3 Aşamalar

**Aşama 1: Analiz ve Plan**

| | |
|---|---|
| Teslim | `banka-analiz.md` + bu plan (`docs/BANKA-MODULU-PLAN.md`) |
| Kabul | Kullanıcı onayı |

**Aşama 0: Ön Düzeltmeler (2.0.26)**

| | |
|---|---|
| Teslim | A1, A2, A3, A4, A6, A7, A9, B5, B7 (K12) + A12 + A13 (§11.1). Banka kodu yok. |
| Çalışıyor Mu | Havale kayıt tahsilatı sil → geri yükle → yine Havale/EFT; Kasa ve banka toplamı aynı. Taksite Aktar → yol aynı; geri al → yol aynı. Bugün tarihli çek 200. Mahsubu kaldırıp satırı silme 200. Kilit varken "Tüm Hareketleri Sil" 200; kilit kalkar; mutabakat 0. İleri tarihli eski satırı olan veride gün ilerledikçe para işlemleri 200 (A13). |
| Nasıl Bozarım | Kilitli döneme kayıt tahsilatı API'den → 409 `period-locked` (`ledger-integrity` değil). İleri tarihli kayıt tahsilatı → 400. İleri tarihli çek alış tarihi → 400. Kilitli dönemde parası olan cariyi sil / geri yükle → 409. **Kilitli dönemde yalnız Borç Yaz satırı olan cariyi sil → 409; türünü Müşteri'den Tedarikçi'ye çevir → 409** (doğrudan SQL ile silinse `party_lock` yakalar). Kilitli dönemdeki çeki sil ya da düzenle → 409 (doğrudan SQL ile silinse kilit izi yakalar). Kilitli taksit kartını geri yükle → 409. Kasa'yı eksiye düşüren silme → Uyar'da 409. Aynı satırı iki kişi aynı anda siler → biri 404. Silinenler yazımı ortasında SIGKILL → yarım kayıt yok. İç yazıcıya "bitcoin" yolu → hata (nakit değil). Sahte saatle ileri tarihli 3 eski satır → 2 gün ilerlet → tahsilat 200; aynı anda yeni ileri tarihli satır → 400/409. |
| Kabul | Her madde 2.0.25'te kırmızı, 2.0.26'da yeşil. Mevcut bütün testler ve senaryolar yeşil. |

**Aşama 2: Finansal İşlem Çekirdeği**

| | |
|---|---|
| Teslim | `minor.mjs` + özellik testi (1e12 TL); iş günü servisi + TR takvimi; `request_keys` (fatura dahil, kalıcı); v20 göçü (tablolar, kolonlar, yetki göçü, damga); `bank.post` iskeleti; K6 denetimi: statik test + `test/bank-post-izinli.json`, rowid işareti + `money:event`, `assertNonMoney`, `store.raw`; `moneyLines` + `cash.entries`/`report`/`summary` geçişi (K5); `moneyAccount`/`sub`; `fin_events` numaralama (sayaç) ve kopyası; kapı altyapısı (dokunulan olaylar, varlık kodları, yeni kilit girdileri); açılış onarım adımı; `config.now` + `startTestServer({ now })` + Playwright `page.clock` eşlemesi; `npm run mutabakat --sirket`; kapı ölçümü (10k / 100k / 1M) ve §3.11 kararı. **Arayüz değişmez.** |
| Çalışıyor Mu | Göç zinciri 2.0.16 → … → 2.0.26 → v20: §10.5 ölçütleri her fikstürde aynı. Kasa penceresi, Kasa PDF ve Banka ve POS raporu göç öncesiyle satır satır aynı; Kasa bugün/bu ay sayıları aynı. Yeniden başlatmadan sonra istek kimliği hatırlanır. İş günü örnekleri (§4.5) tutar. Borç Yaz, Alacak Yaz, cari açılışı, taksit kartı ve stok `pay='account'` yazımları `money:event` uyarısı üretmez. Sıfırlama sonrası ilk İşlem No öncekinden büyük. |
| Nasıl Bozarım | 3 ondalık, "0,005", 1e13 → 400. STRICT kolona kesir → reddedilir. Aynı kimlik farklı gövde → 409. Göç ortasında SIGKILL → yedekten dönüş. 2.0.25 kodu v20 veritabanına yazar (siler, düzeltir, yol değiştirir, tahsildeki çeki ciro eder) → onarım adımları a–h; yalnız ilgili varlık kodu etkilenir. Test yolu `bank.post` dışından para satırı ekler → `money:event` kırmızı. İzinli listedeki yazıcı kind 'in' satır yazar → `assertNonMoney` kırmızı. `store.raw` dışından para tablosuna UPDATE → test kipinde hata. `way='unknown'` → `money:method`. |
| Kabul | §10.5 ölçütü bütün fikstürlerde; kapı ölçüm tablosu ve bütçe kararı yazılı. |

**Aşama 3: Banka Hesapları**

| | |
|---|---|
| Teslim | Hesap CRUD; açılış (Bakiye Doğrulandı); Açılışı Düzelt / Açılış Bakiyesi Gir; Kurulum Sihirbazı + Eski Hareketleri Aktar (geri alınabilir); Hesabı Atanmamış araçları; Alt Hesap Mizanı; yetki grubu + `WRITE_PERMISSIONS` (+ `invoices.*` açığı); menü + `LABEL_SLOTS`; pencere iskeleti; `/choices`; Ayarlar iskeleti (Temel/Gelişmiş, Varsayılanlara Dön). |
| Çalışıyor Mu | Kabul 1–4: Ziraat 100.000 (102.01), Garanti 50.000 (102.02), 500 = −150.000, Gerçek Banka 150.000; iki hesap da Bakiye Doğrulandı. Sihirbaz: 102.00 X → Devir Kapanışı → 102 toplamı S; Geri Al → eski hâl. |
| Nasıl Bozarım | Aynı IBAN → 409. Geçersiz IBAN → 400. Aynı bankada aynı adlı iki hesap → izinli, kod tekil. Açılış ileri tarih → 400, kilitli → 409. Açılış tarihini ilk hareketten sonraya taşı → 409. Açılışı Düzelt iki kez art arda → 200. Kilitli dönem satırını ata → 409 (kilit izi). Personel → 403. Başka şirketin hesap kimliği → 404. Hareketli hesapta para birimi değişimi → 409. Hesap sil → aynı adla yeniden aç. Boş şirkette Banka penceresi ve raporlar. Sıfırla → Açılış Bakiyesi Gir → mutabakat 0. |
| Kabul | Mizanda 102 = Σ102.*; kapı ok; ekrandan senaryo (yazım düzeni dahil). |

**Aşama 4: Banka Hareketleri**

| | |
|---|---|
| Teslim | Banka Fişi motoru: masraf (BSMV Dahil/Hariç, KDV Dahil/Hariç → tek işlemde fatura + havale, Yok; hesap masraf türüne göre), faiz (stopaj), diğer, kart borcu, kredi; Ters Kaydet / Düzelt (`reversal`); Hareketler (dizin + tek kaynak); İşlem Kartı; Benzer İşlem; Planlı İşlemler. |
| Çalışıyor Mu | Masraf 10,50 BSMV dahil → 770 10,00 + 0,50; Ziraat −10,50. KDV dahil 120 (EFT türü) → 770 100, 191 20, banka −120, KDV raporu 191 = 20. Banka Masraf Raporu ikisini aynı tabloda 770 hesabıyla gösterir. Faiz 1.000 / %15 → 102 850, 193 150, 642 1.000 (kapı ok). Ters kayıt net 0. |
| Nasıl Bozarım | Fişle 191/120/320'ye yazma → kapı + statik test. Beyaz liste dışı kod → 400. fx_gain'e 656 → 400. Kilitli fişi düzelt → ters fiş bugün tarihli, kilit izi aynı. Ters kaydı iki kez → 409. Düzelt → Ters Kaydet → aynı tarihe yeni fiş → 200. Eksi tutar ya da 1e13 → 400. HTML veya formüllü açıklama → ekranda kaçışlı, Excel'de metin. 1.000.000 harekette liste ve arama < 1 sn. |
| Kabul | Fiş dengesi ve beklenen değerler eşit; sayfalama doğru; yürüyen bakiye = tek kaynak. |

**Aşama 5: Cari Entegrasyonu**

| | |
|---|---|
| Teslim | Ortak seçici; cari giriş/düzelt/sil `bank.post`'a; kalıcı istek kimliği; son durum eksi bakiye; Benzer İşlem (hesaba bağlı); `assertMutable` (K4); banka bağlı cari silme engeli; `source='bank'` düzeltme/silme engeli. |
| Çalışıyor Mu | Kabul 5, 8–12: 20.000 tahsilat → Ziraat 120.000, ABC 0, fatura "Ödendi". |
| Nasıl Bozarım | Aynı istek iki kez → tek satır, "zaten kaydedildi" görünür. Farklı kimlik, aynı gün, aynı tutar, hesaba bağlı → `bank-similar`. Aynı gün aynı tutarda iki **nakit** tahsilat → ikisi de 200. Aynı hesaptan eşzamanlı iki ödeme (Engelle, farklı cariler) → biri 409. Personel ödeme → 403. Personel kendi havale tahsilatını siler / nakde çevirir / hesabını değiştirir → 403 (cari, kayıt ve taksit ekranlarının üçünde). Pasif hesap → 400. Eşleşmiş satırı düzelt/sil → 409. Banka bağlı cariyi sil → 409 → Pasife Al. Sil → geri yükle → aynı `fin_ref`, olay `active`. İki hesap tanımlıyken hesapsız eski satırın açıklamasını düzelt → 200, bağsız kalır. Aynı adlı iki cari. |
| Kabul | Sayılar ve kapı ok. |

**Aşama 6: Kasa Entegrasyonu**

| | |
|---|---|
| Teslim | Aktar/Yatır formunda hesap; istek kimliği; `bank.transfer`; banka yönünde son durum eksi bakiye; ikiz alt sorgu; Kasa penceresi tek kaynaktan (`way='cash'`). |
| Çalışıyor Mu | Kabul 13–14: Ziraat 110.000, Kasa 10.000; Kasa penceresinde yalnız nakit satırı; Kasa "Bugün Giriş" 10.000 (bugünkü tanım); Banka "Bugün Çıkış" transferi saymaz, "Transfer" satırında 10.000. |
| Nasıl Bozarım | Çift gönderim → tek transfer. USD hesaba → 400. `bank.transfer` yok → 403; `cash.manage` taşıyan özel rol göçle alır → 200. Eşleşmiş transferi sil → 409. Personel transferi silemez. Kasa elle girişinde bank yolu → 400 (mevcut). |
| Kabul | Kasa ve banka sayıları; Kasa penceresi ve ANLIK DURUM Kasa kutusu göç öncesiyle aynı. |

**Aşama 7: Fatura Entegrasyonu**

| | |
|---|---|
| Teslim | `payment.cash[]` alanları (`lineKey`, `eventId`, hesap/POS); Düzenle kuralları (§3.8); iade yolları ve alan seçimi (§4.6); `/issue` ve `/edit` istek kimliği; Fatura Ayarları → Banka Hesapları; gider türleri "Banka Masrafları" (770) ve "POS ve Ödeme Kuruluşu Komisyonları" (653); toplu kesim belge başına ayrı `bank.post` işlemi; "Fatura ve Banka Hareketleri" bağ türleri; fatura formunda TCMB önerisi (Aşama 13 altyapısıyla). |
| Çalışıyor Mu | Kabul 6–7: Ürün A 10 → 9, ABC 20.000. senaryo-215/216/223/224 yeşil. |
| Nasıl Bozarım | Tab ile hesap seçimi → alanlar yeniden çizilmez. Peşin satır sırasını değiştir / ilk satırı sil → olaylar `lineKey` ile doğru. Eşleşmiş peşinli faturada yalnız kalem açıklamasını düzenle → 200. Peşin havaleyi Ziraat'ten Garanti'ye taşı → Garanti için eksi bakiye denetlenir. İki hesap tanımlıyken eski peşinli faturayı düzenle → bağsız kalır. Toplu kesimde 200 belgeden biri hesapsız → yalnız o "Banka hesabı seçilmedi", 199 kesilir; biri kapıda sapma üretirse yalnız o geri alınır. Toplu kesim sürerken başka kullanıcı tahsilat girer → beklemez (belge başına kısa işlem). Alıştan iade kurumsal karta → POS satışı oluşmaz, 309 düşer. Havale peşinli eşleşmiş faturayı iptal → 409 `bank-reconciled`. |
| Kabul | Bütün fatura senaryoları yeşil; kapı ok. |

**Aşama 8: Taksit, Kayıt Tahsilatı, Stok, Çek**

| | |
|---|---|
| Teslim | `fin_ref`/olay; K8 taksit kuralı (işlem türüne göre) ve `motor.mjs` güncellemesi; kayıt tahsilatı; stok peşin ve iade alanı; çek tahsil/ödeme hesabı; **Bankaya Tahsile Ver / Bankadan Geri Al** (§3.14; `cheque_collections` + `fin_events`); Taksite Aktar olayı taşır; banka bağlı taksit kartı silme kuralı. |
| Çalışıyor Mu | Taksit 10.000 Garanti'ye → Ödendi; cari −10.000; Garanti +10.000 (talimat 11). Çek tahsile verilince 101.02, `cheque_events` satır sayısı ve `cheques.status` değişmez; tahsil edilince 102.x. Taksite Aktar kalanı aşan aktarım → bugünkü gibi `payments-exceed` uyarısıyla 200. |
| Nasıl Bozarım | Kapanmış karta itemId'siz tahsilat → 409 `plan-paid`. İki personel son taksidi aynı anda → biri 409 `plan-paid` (bank-similar değil). Kalanı aşan tutar → 409 `plan-overpay` (avans yalnız `plans.manage`). Ödenmiş karttan silinen tahsilatı geri yükle → 409 `plan-paid` / avans seçeneği. Tahsilat tutarını kalanı aşacak biçimde artır → 409. Eşit iki taksit aynı gün → hedef farklı, uyarı yok. Kasiyer art arda aynı ürünü POS'la satar → uyarı yok. Eşleşmiş çek tahsilini geri al → 409. Taksite Aktar → eşleşme korunur → geri al. Tahsildeki çeki ciro et / sil / tutarını değiştir → 409 `cheque-deposited`. Tahsildeki çeki başka hesaba tahsil et → 400. Kilitli ayda tahsile verilen çeki açık ayda tahsil et → 200. Banka bağlı taksit kartını sil → nedenli 409. Statik test: `cheque_events.kind`'e yazılan bütün değerler CHECK listesinde. |
| Kabul | Kapı ok; sayılar; `test:mutabakat` güncel modelle 0 hata. |

**Aşama 9: Bankalar Arası Transfer**

| | |
|---|---|
| Teslim | Ücret, kanal, valör, planlı transfer, ters kayıt, kredi kullanımı/geri ödeme. |
| Çalışıyor Mu | Kabul 15–16: Ziraat 90.000 / Garanti 70.000; toplam değişmez. Ücretli örnek: Ziraat 89.994,75. |
| Nasıl Bozarım | Farklı para birimi → 400 (Döviz Al/Sat önerilir). Kaynak = hedef → 400. Eşzamanlı iki transfer → eksi bakiye denetimi. Ters kayıt. Kredi hesabından cari ödemesi → 400. |
| Kabul | `bank:transfer` ok; sayılar. |

**Aşama 13: Döviz (teslimde 2.1.0'a öne alındı; K9)**

| | |
|---|---|
| Teslim | `fx_rates`, TCMB (sahte `fetchImpl`), elle kur, döviz hesabı, al/sat (ağırlıklı ortalama), değerleme (+ `bank_jobs` ile ertelenmiş ters kayıt), 13b tahsilat ve ödeme (gerçekleşen kur farkıyla), fatura formunda kur önerisi, Kur Değerleme Raporu, Döviz sekmesi. |
| Çalışıyor Mu | 1.000 USD al @34,25 → 102.03 = 34.250. 500 sat @35 → 646.02 = 375. Değerleme @35,80 → 646.01 775. 13b: 1.000 USD @34,50 → ABC'ye TL 34.500. 13b ödeme: 500 USD XYZ'ye @35,00 → XYZ 17.500, 102.03 −17.250, 646.02 250. Kur girilmezse iki yönde TCMB döviz alış önerilir. |
| Nasıl Bozarım | Tatilde kur → son yayımlanan. Ağ yok → elle, işlem engellenmez. Bozuk XML. Aynı gün iki değerleme → 409 → Ters Kaydet → yeniden 200. Kilitli ya da ileri tarihli değerleme → 409 / 400. Ters kayıt açıkken bugün tarihli değerleme → ters fiş yarın kuyrukta. Döviz hesabını fatura peşininde seçme → 400. Bakiyenin tamamını sat ya da cariye öde → 102.03 TL = 0, artık yok; ardından değerleme 0. Ödeme sonrası değerleme gerçekleşmiş farkı yeniden saymaz. 7 ondalıklı kur → 400. |
| Kabul | Bağımsız BigInt modeliyle fark 0; kapı ok (`bank:sub` Σ fx). |

**Aşama 10: POS**

| | |
|---|---|
| Teslim | Terminal (Sağlayıcı Türü, vergi kipi); tarihli oran ızgarası; bütün formlarda POS alanı; `pos_sales`/`pos_items`; provizyon tekilliği; void (provizyon içinde) ve kayıt hatası silme. |
| Çalışıyor Mu | Kabul 17–22: satış anında banka +0, POS Bekleyen 10.000 brüt / 9.750 net. |
| Nasıl Bozarım | Oran değişince geçmiş değişmez. Tanımsız taksit → 400. Aynı provizyon → 409. POS'u ödemede kullanma → 400. Pasif POS → 400. Önce POS / önce fatura sırası. POS sil → aynı adla yeniden aç. POS kartında hesap değiştir → bekleyenler eski hesaba; "Taşı" ile yeni hesaba. Provizyon süresi geçmiş satışta POS İşlemleri → İptal Et → 409 `pos-provision-expired`, düğme yanında neden yazısı. |
| Kabul | `pos:terminal` ok. |

**Aşama 11: Komisyon, Valör, Bloke, İade, İptal**

| | |
|---|---|
| Teslim | Valör kuyruğu (K3: tetikler, tur sınırı, hub denetimi, kilit kuralı); onay kipi; KDV kipi + aylık taslak + `invoice-settle` `pos-fee` "yalnız bağlı" kipi; iadeler ve kısmi iade dağıtımı; İptal İadesi ve fatura iptal penceresi (İade Edildi / Kayıt Hatası); net eksi kuralı; `bank.replan`; takvim; nakit akışı kaynakları. |
| Çalışıyor Mu | Kabul 23–28 (sahte saatle): 12.10 Ziraat 99.750 ve 653 = 250; taksitli takvim 3 × 3.860; 15.10 Ziraat 96.750. KDV kipinde net 9.700 + taslak 300 (250 + 50); kayıttan sonra 191 = 50, taslak fatura "Ödendi". §4.3 ek testi: ilgisiz açık alış faturası "Açık 1.000" kalır. |
| Nasıl Bozarım | Hafta sonu (02.10 → 06.10). Arife ve bayram (27.10 → 30.10). Ay sonu taksiti (31.01 → 28/29.02). Sunucu kapalıyken geçen valör → açılışta her gün kendi tarihiyle. Kilitten sonra geçen valör → `late`. Kilit konarken bekleyen → uyarı. İki tetik aynı anda → tek fiş. İade > satış → 409. Tam iade valörden önce → banka −250. 10 TL satış + 15 TL ücret → banka −5. Taksitli kısmi iade → bağımsız model. Valörden sonra tutar düzelt → replan; eşleşmişse 409. POS'lu satırı sil → valör geçsin → geri yükle. Aynı provizyonla yeni satış → geri yükle → 409. POS'lu faturayı aynı gün iptal → void, komisyon 0. Ertesi gün iptal → İptal İadesi, İade Edilmez'de komisyon tahsili kalemleri. Bankaya geçmiş ve eşleşmiş POS'lu faturayı iptal (İade Edildi) → 200, iade kalemi, eski fiş ve eşleşme değişmez. Aynı faturayı "Kayıt Hatası" ile iptal → 409 `pos-settled`. KDV kipinde sağlayıcıya ait ilgisiz faturalar varken kesinti → FIFO'ya girmez. Komisyon iadesi > kesinti olan ay → taslak açılmaz, "İade Alacağı". 50 POS × 30 gün kesinti sonrası ilk tur süresi. Açılmamış 002'de valör → hub denetimi. |
| Kabul | Sayılar; `pos:*` ok; açılış ve tur süresi bütçede; mevcut kapama testleri değişmeden yeşil. |

**Aşama 12: Ekstre ve Mutabakat**

| | |
|---|---|
| Teslim | Önizleme, Türk banka biçimleri, aktarım, mükerrer, öneri (hesabı atanmamış adaylar, sistem fişi sözlükleri, tekillik puanı dahil), onay / kaldır / oluştur / yoksay / ata + eşleştir, onay kipiyle valör geçişi, Cetvel, Bakiye Doğrulandı. |
| Çalışıyor Mu | Kabul 29–31: 6 satırın 5'i Güçlü (§12.5); "ABC Ltd. tahsilatı ile eşleşiyor"; onay; Cetvel farkı 0. |
| Nasıl Bozarım | Aynı dosya iki kez → 409, "Yalnız Yeni Satırlar". Aynı gün aynı tutarda iki EFT → sıra no, "Mükerrer Değil", tekillik puanı yok → Güçlü değil. Aynı adlı iki cari aynı tutar → Güçlü değil, iki aday. Aynı gün aynı tutarlı iki POS gün fişi (iki POS) → POS adı/Üye İşyeri No ayırır; ayıramıyorsa Güçlü değil. Yanlış eşleşmeyi kaldır → bakiye aynı. Eşleşmişi başka yoldan değiştir → 409. Windows-1254 ve UTF-8 BOM dosyaları. "1.234,56" ve ayrı Borç/Alacak kolonları. 50.000 satır tek işlemde (süre ölçülür). 50.001 satır → 400. 25 MB gövde. `=HYPERLINK` içeren açıklama → Excel çıktısında metin. Bozuk dosya → 400. |
| Kabul | Cetvelde açıklanmamış fark 0; puan tablosu bağımsız testle aynı. |

**Aşama 14: Raporlama**

| | |
|---|---|
| Teslim | 18 + 4 rapor; ANLIK DURUM (K10) + canlı yenileme; Nakit Akış; Vade Takip/Zil; Birleşik Rapor (K10'un beş sütunu); A11; C10; `SOURCE_LABELS`. |
| Çalışıyor Mu | Kabul 32–33: Banka Bakiye Raporu 166.739,50; nakit akış tahmini 188.319,50. |
| Nasıl Bozarım | Her süzgeç × ekran/PDF/Excel (raporlar-224 kalıbı). Boş dönem; tek kayıt; geçmiş ve gelecek tarih; ileri tarihli POS (açık aralık); yetkisiz kullanıcı; `queryOf` parametre kaybı. Valör geçişinden sonra açık ANLIK DURUM ve öbür penceredeki Banka/Kasa yeni sayıyı gösterir. Birleşik Rapor sütun adları ANLIK DURUM'la birebir aynı (yazım testi). |
| Kabul | Bağımsız beklenen hesapla açıklanmamış fark 0; TOPLAM = satırlar. |

**Aşama 15: Yetki ve Audit**

| | |
|---|---|
| Teslim | Bütün uçların yetki matrisi testi; özel rol ve add/remove göçü; salt okunur lisans; `EVENT_LABELS`; Silinenler kuralı; Birleşik Rapor banka sütunları. |
| Çalışıyor Mu | Kabul 36. "Dün 200 dönen her para işlemi bugün de 200" (personel istisnası ve K8 ödenmiş kart kuralı dışında). |
| Nasıl Bozarım | `?hofCompany=` oyunu. Personelle bütün uçlar. Salt okunurda `LICENSE_READ_ONLY`. Başka şirketin kimliği. `previous` alanı olmayan audit (statik test). |
| Kabul | Sızıntı yok. |

**Aşama 16: Performans ve Güvenlik**

| | |
|---|---|
| Teslim | Ölçek: 10/20/30 eşzamanlı kullanıcı; 100.000 ve 1.000.000 para satırı; 2 şirket; yedekleme sırasında yük; sonuçlar sunucu + ekran iki sütunla. Arıza: kuyruk, ekstre, sihirbaz ve göç ortasında kesinti; disk dolu; kilitli dosya. Rastgele sıra testi (banka türleriyle). Kötü niyetli girdi. **Kabul testinin 37 adımı ekrandan** (`test/e2e/senaryo-banka.mjs`; CI ve yayın iş akışında). Yedek tatbikatı. Kılavuz. Bağımsız gözden geçirme. |
| Çalışıyor Mu | Kabul 34–37. |
| Nasıl Bozarım | §12.4 listesinin tamamı. |
| Kabul | Ölçek tablosu; bütçeler; DENENEN / DENENMEYEN / BİLİNEN SINIRLAR. |

**Aşama 17: Mevcut REAL Para Kolonlarının INTEGER Kuruşa Göçü (ayrı proje; K1)**

| | |
|---|---|
| Kapsam | payments, cash_entries, account_entries, plans.total, plan_items, plan_entries, stock_moves (amount, unit_price), cheques, cheque_events, invoices (para kolonları + `rate` → `rate_e6`), invoice_lines, invoice_offsets. Miktar kolonları ayrı karar. |
| Yöntem | Tablo yeniden kurma göçü: yeni STRICT tablo + `CAST(ROUND(x*100) AS INTEGER)` + indeksler + yeniden adlandırma (göç 4 kalıbı; geri dönüş yalnız yedekten). Bütün SQL'ler ve JS çevirileri güncellenir; API TL ondalık biçimini korur. Gölge kolon yok. Aynı göçte `cheque_events.kind` ve `cheques.status` CHECK listeleri yeniden değerlendirilebilir. |
| Risk | Çok geniş yüzey; eski sürüme dönüş imkânsızlaşır (yalnız yedek); kilit izi biçimi değişir (yeniden taban); rapor, PDF ve Excel üretimleri. |
| Test | Göç öncesi ve sonrası bütün raporların ekran/PDF/Excel çıktısı (tarih damgası hariç) aynı. Bütün fikstür zinciri. Özellik testi. Mutabakat, güvenilirlik ve bütün arayüz senaryoları. 1.000.000 satırda göç süresi. Göç ortasında kesinti. |
| Kabul | Kullanıcı kararıyla, banka modülü (2.3.0) sahada oturduktan sonra ayrı büyük sürümde. |

### 12.4 "Nasıl Bozarım" ana listesi (testlerin kaynağı)
- **Sıra değiştir:** önce hesap / önce hareket; önce POS / önce fatura; önce cari / önce kayıt / önce taksit; sihirbazdan önce ve sonra işlem; önce tahsile ver / önce ciro.
- **Ad ve kod değiştir:** hesap kodu, POS adı; sil → aynı adla yeniden aç (hesap, POS, cari); aynı bankada aynı adlı iki hesap; **aynı adlı iki cari + aynı tutarlı ekstre satırı**; aynı gün aynı tutarlı iki POS gün fişi.
- **Aynı anda:** aynı istek iki kez; bağlantı kesilip yeniden gönderim; iki personel aynı hesaptan (farklı carilere); iki personel aynı son taksitte; iki valör tetiği; toplu kesim sürerken tekil tahsilat.
- **Tutar ve metin:** eksi, sıfır, 1e13, 3 ondalık, "0,005"; HTML ya da formüllü açıklama.
- **Bağ:** pasif ya da silinmiş hesap; başka şirketin kimliği; TL formda döviz hesabı; POS'u ödemede kullanmak; kredi hesabından cari ödemesi; kurumsal karta iade; tahsildeki çeki başka hesaba tahsil.
- **Tarih:** kilitli döneme yazım; ileri tarih (çek alış tarihi dahil); ileri tarihli eski satırın yaşlanması (A13); kilitli güne düşen valör; hafta sonu, bayram, arife, ay sonu, 29 Şubat; gün dönümünde (23:59) satış; provizyon süresinin son günü.
- **Değişiklik:** eşleşmiş satırı düzelt ya da sil; bankaya geçmiş POS'lu faturayı iptal et (İade Edildi / Kayıt Hatası); iadeyi satıştan büyük gir; sabit ücret > satış; tam iade valörden önce; ödenmiş karta tahsilatı artır.
- **Silme ve geri yükleme:** cariyi ya da kartı sil (yalnız Borç Yaz satırlı cari dahil); cari türünü değiştir; açılışı değiştir; sil → geri yükle → düzenle; Taksite Aktar → geri al; sıfırla → yeniden açılış → yeni İşlem No.
- **Ekstre:** aynı ekstreyi iki kez yükle; aynı satırı iki harekete eşle; Windows-1254 dosyası; sözlükte olmayan açıklama.
- **Eski sürüm ve arıza:** sunucu kapalıyken valör geçsin; eski sürüme dön, yaz (tahsildeki çeki ciro et), geri gel; 2.0.16–2.0.26 verisinden zincirleme göç; göç, kuyruk, ekstre ya da sihirbaz ortasında kesinti; disk dolu; kilitli dosya.
- **Yetki:** yetkisiz personel; salt okunur lisans; `?hofCompany=`; personelin kendi banka satırını silmesi; personelin avans onayı.
- **Boş veri:** boş şirkette Banka penceresi, raporlar ve sihirbaz.
- **Her testin sonunda denetlenir:** kapı `ok`, mutabakat 0, şirketler ayrı, yetkisiz değişiklik yok, `money:event` uyarısı yok.

### 12.5 Kabul testi (talimat 43): sayılarla

**Ön koşullar:**
- Boş şirket; sahte saat 08.10.2026 Perşembe (sunucu `config.now` + Playwright `page.clock`).
- Stok: Ürün A 10 Adet, Ürün B 25 Adet (parasız giriş). Kasa 0. Dönem kilidi yok.
- Satış fiyatları KDV %20 dahil.
- Adım 34–37'nin her biri adım 33 sonunda alınan yedekten ayrı koşulur.

| Adım | İşlem (ekrandan) | Beklenen | Sürüm |
|---|---|---|---|
| 1–2 | Ziraat Bankası · Ana TL Hesabı (Vadesiz, açılış 01.10.2026, 100.000, "Bakiye Doğrulandı") | 102.01 = 100.000; denetim Uyar | 2.1.0 |
| 3–4 | Garanti BBVA · Ana TL Hesabı (açılış 01.10.2026, 50.000, "Bakiye Doğrulandı") | 102.02 = 50.000; denetim Uyar; Gerçek Banka 150.000; 500 = −150.000 | 2.1.0 |
| 5 | + Yeni Cari: ABC Ltd. (Müşteri, IBAN ile) | — | 2.1.0 |
| 6 | Satış Faturası: Ürün A 1 Adet × 20.000, ödeme açık | Matrah 16.666,67, KDV 3.333,33, Toplam 20.000 | 2.1.0 |
| 7–8 | — | Ürün A 9; ABC borçlu 20.000; Gerçek Banka 150.000 | 2.1.0 |
| 9–12 | Cari kartı → Tahsilat 20.000, Havale/EFT, Ziraat | Ziraat 120.000; ABC 0; fatura "Ödendi" | 2.1.0 |
| 13–14 | Kasa → Bankadan Kasaya Aktar 10.000 (Ziraat) | Ziraat 110.000; Kasa 10.000; Kasa penceresinde yalnız nakit satırı | 2.1.0 |
| 15–16 | Transfer Ziraat → Garanti 20.000, ücret 0 | Ziraat 90.000; Garanti 70.000; Kasa + Banka 170.000 (= 150.000 + 20.000) | 2.1.0 |
| 17–19 | POS: "Ziraat Fiziki POS", Sağlayıcı Türü Banka, BSMV Dahil, Tek Çekim %2,5, 3 Taksit %3,5, valör 2 iş günü, taksitli ödeme her ay, provizyon aynı gün | — | 2.2.0 |
| 20 | Satış Faturası: Ürün B 10 Adet × 1.000 (10.000), peşin POS Tek Çekim | Ürün B 15; ABC 0 | 2.2.0 |
| 21–22 | — | Ziraat 90.000 (değişmedi); POS Bekleyen 10.000 brüt / 9.750 net; valör 12.10.2026 | 2.2.0 |
| 23–24 | Saat 12.10.2026 → kuyruk | Ziraat 99.750; POS Bekleyen 0; 653 = 250 (BSMV 11,90 dahil); İşlem Kartı: "Valör 12.10.2026 (08.10 Perşembe + 2 iş günü)". KDV kipi ayrı şirkette: net 9.700; Ekim taslağı 300 (KDV Dahil: 250 + 50); kayıttan sonra 191 = 50 = KDV raporu, taslak fatura "Ödendi". | 2.2.0 |
| 25–26 | 12.10: Satış Faturası Ürün B 12 Adet × 1.000 (12.000), peşin POS 3 Taksit | Ürün B 3. Takvim: 12.11.2026 3.860 · 14.12.2026 3.860 (12.12 Cumartesi) · 12.01.2027 3.860 → bekleyen net 11.580 (brüt 12.000, komisyon 420) | 2.2.0 |
| 27–28 | 13.10: Satıştan İade (asıl: adım 20), Ürün B 3 Adet = 3.000, POS İadesi, İade Edilmez | Ürün B 6; ABC 0; iade kalemi valörü 15.10; İşlem Kartı asıl satışı, asıl faturayı, iade faturasını ve ABC'yi gösterir; Σ iade 3.000 ≤ 10.000. Saat 15.10 → Ziraat 96.750 | 2.2.0 |
| 29 | Ziraat ekstresi (CSV, Windows-1254, `;`, "1.234,56", gg.aa.yyyy, ayrı Borç/Alacak; karşı IBAN ve İşlem No kolonu yok). Açılış 100.000; satırlar: 08.10 +20.000 "ABC LTD EFT" · 08.10 −10.000 "NAKİT ÇEKİM" · 08.10 −20.000 "VİRMAN GARANTİ" · 09.10 −10,50 "EFT ÜCRETİ" · 12.10 +9.750 "POS ÜYE İŞYERİ" · 15.10 −3.000 "POS İADE" | 6 satır; mükerrer 0 | 2.3.0 |
| 30–31 | Mutabakat → Güçlü Önerilerin Tümünü Onayla; 10,50 satırına Hareket Oluştur → Masraf (EFT, BSMV Dahil, 09.10) | 5 satır Güçlü (puan 80 = tarih 40 + ad/sözlük 25 + tekillik 15; tek aday): +20.000 "ABC Ltd. tahsilatı ile eşleşiyor"; −10.000 Kasa Transferi ("NAKİT"); −20.000 Garanti Transferi ("VİRMAN", "GARANTİ"); +9.750 POS Gün Sonu 12.10 ("POS", "ÜYE İŞYERİ"); −3.000 POS Gün Sonu 15.10 ("POS"). 10,50 Eşleşmeyen, "Hareket Oluştur: Masraf" önerili ("ÜCRET"). Sonra Ziraat 96.739,50. Cetvel: ekstre 96.739,50 = defter 96.739,50; açıklanmamış fark 0; hesap Bakiye Doğrulandı | 2.3.0 |
| 32 | Banka Bakiye Raporu ve Banka Hareket Raporu (Ziraat, 01.10–15.10) | Ziraat 96.739,50 · Garanti 70.000 · Toplam 166.739,50. Ziraat giriş 129.750 (açılış 100.000 dahil), çıkış 33.010,50. POS Komisyon 250; Banka Masrafı 10,50 (770) | 2.3.0 |
| 33 | Nakit Akış (15.10, 90 gün) | Başlangıç 176.739,50 (Nakit 10.000 + Gerçek Banka 166.739,50); POS +3.860 × 3; tahmini 188.319,50; gerçekleşen ve planlanan ayrı kolonlarda | 2.3.0 |
| 34 | İptal senaryoları | (a) Transferi Ters Kaydet → 409 `bank-reconciled` → Eşleşmeyi Kaldır → Ters Kaydet → Ziraat 116.739,50, Garanti 50.000, Gerçek Banka 166.739,50 (aynı). (b) Kasa transferi → Eşleşmeyi Kaldır → Sil (`bank.cancel`) → Kasa 0, Ziraat 106.739,50. (c) 15.10'da taksitli POS'lu faturayı (adım 25) İptal Et → "Müşteriye İade Edildi" → provizyon (aynı gün) geçtiği için İptal İadesi: 3 kalemin brütü 0, İade Edilmez → üç Komisyon Tahsili kalemi 140 (12.11.2026, 14.12.2026, 12.01.2027); 108.01 = 0; POS Bekleyen (Net) −420 ("Komisyon Tahsili Bekleyen 420"); Ürün B 18; ABC 0; banka bugün değişmez. (d) Eşleşmeyi kaldır → bakiye aynı. (e) 15.10'da Ürün B 1 Adet × 1.000 POS Tek Çekim faturası → aynı gün İptal Et ("Müşteriye İade Edildi") → void: komisyon 0, POS Bekleyen (Net) 11.580'e döner, Ürün B 6, ABC 0. Her birinde kapı ok, mutabakat 0. | 2.3.0 |
| 35 | Aynı tahsilatı (Havale, Ziraat) aynı kimlikle iki kez; yeni kimlikle aynı gün aynı tutar | Tek satır, "zaten kaydedildi" görünür; ikincisinde "Benzer İşlem" uyarısı (BNK-… ile); vazgeçilince değişiklik yok | 2.3.0 |
| 36 | Personel | Banka menüsü yok; transfer 403; kendi havale tahsilatını silme 403; tahsilat girişi 200 | 2.3.0 |
| 37 | Eşzamanlı. Hazırlık: Garanti hesap kartında Eksi Bakiye "Engelle"; + Yeni Cari XYZ Ltd. ve KLM Ltd. (Tedarikçi); Taksit penceresinden ABC'ye "Yeni Borç" 2 × 1.000 kart, 1. taksit Nakit tahsil edilmiş. | İki muhasebe kullanıcısı aynı anda XYZ'ye 40.000 ve KLM'ye 40.000 Havale/EFT (Garanti) öder → biri 200, öbürü 409 `cash-blocked` (Garanti 70.000; ikincisi −10.000'e düşürür; carileri farklı olduğu için Benzer İşlem devreye girmez). İki personel aynı anda son taksite 1.000 Havale/EFT (Ziraat) → biri 200, öbürü 409 `plan-paid` (hedef kuralı Benzer İşlem'den önce). Kapı ok, mutabakat 0. | 2.3.0 |

**Adım 33 sonunda mizan (bağımsız modelle karşılaştırılır):**

| Hesap | Borç bakiyesi | Alacak bakiyesi |
|---|---|---|
| 100 Kasa | 10.000,00 | |
| 102.01 Ziraat | 96.739,50 | |
| 102.02 Garanti | 70.000,00 | |
| 108.01 POS | 12.000,00 | |
| 120 ABC Ltd. | 0 | |
| 391 Hesaplanan KDV | | 6.500,00 |
| 500 Açılış | | 150.000,00 |
| 600 Satışlar | | 35.000,00 |
| 610 Satıştan İadeler | 2.500,00 | |
| 653 Komisyon | 250,00 | |
| 770 Banka Masrafı | 10,50 | |
| **Toplam** | **191.500,00** | **191.500,00** |

Ürün A 9, Ürün B 6; POS Bekleyen (Net) 11.580. Kabul testi her sürümde kendi adımlarıyla koşar: 2.1.0'da 1–16, 2.2.0'da 1–28, 2.3.0'da 1–37 baştan sona.

---

## Ek A: Kullanıcıya Sorulmadan Uygulanan Kararlar

### A.1 Kararlar ("en yaygın ve modern" seçenek)

| # | Konu | Seçilen | Gerekçe | Ayardan değişir mi |
|---|---|---|---|---|
| 1 | Kayıt mimarisi | Modül satırı tek kayıt + Banka Fişi + `fin_events` dizini (M1) | Talimat 1/30/31; çift sayım olmaz | Hayır |
| 2 | Alt hesap gösterimi | 102.NN `sub`; ana hesap aynı | Mizan ve testler korunur | Hayır |
| 3 | Para saklama | Yeni tablolarda INTEGER kuruş (K1) | SQLite'ta DECIMAL yok | Hayır |
| 4 | İşlem No | BNK-YYYY-NNNNNN; nakit dahil her para satırına; yalnız artan sayaçla (sıfırlamada yeniden kullanılmaz) | Talimat 6/44; eski sürüm tespiti (K11) | Önek (Gelişmiş) |
| 5 | Açılış | Açılış gününün başındaki bakiye; "Bakiye Doğrulandı" kutusu | Muhasebe programlarında yaygın | Hayır |
| 6 | Eski kayıtlar | Kovada kalır; sihirbazda Devir Kapanışı açık; geri alınabilir | Mizan ve kilit izi değişmez | Sihirbazda |
| 7 | Hesap seçimi | Tek hesapta otomatik ve gizli; birden çokta zorunlu; eski satır düzeltmesinde bağsız kalabilir | Yanlış hesap riski; mevcut akış bozulmaz | Hayır |
| 8 | Eksi bakiye | K7 | m11 şikâyeti geri gelmez | Evet |
| 9 | Mükerrer | Kalıcı istek kimliği + Benzer İşlem (aynı iş günü, hedefli, **yalnız hesaba bağlı banka/POS/kart satırları**) | Talimat 9/33; nakit ve carisiz Kasa girişinde güvenilir hedef yok | Uyarı Açık/Kapalı |
| 10 | Taksit fazla tahsil | Yeni tahsilat, geri yükleme ve artıran düzeltmede kalan 0 → 409, aşan → 409; fazlası yalnız `plans.manage` onayıyla avans. Taksite Aktar bugünkü gibi. | Talimat 11; alınmış paranın yer değiştirmesi engellenmez | Hayır |
| 11 | Banka Fişi düzeltme | Düzelt = ters + yeni; ters kayıt ayrı tür | Modern denetim izi | Hayır |
| 12 | Ters kayıt tarihi | Açık dönemde aynı tarih, kilitliyse bugün | Muhasebe kuralı | Hayır |
| 13 | Banka bağlı cari / taksit kartı | Cari: Pasife Al. Kart: önce banka tahsilatları silinir. | Pasif durum yalnız caride var | Hayır |
| 14 | Valör | İş günü; 1 iş günü; Sonraki İş Günü; arife iş günü sayılır | Türkiye pratiği; ISDA following | Evet |
| 15 | Bayram tarihleri | Resmî ilandan, 2026–2031 | Uydurma tarih yok | Şirket ekleri |
| 16 | Bankaya geçiş | Otomatik; (POS, gün) başına net tek fiş; açıklamada POS adı, referansta Üye İşyeri No | Bankanın toplu yatırımıyla eşleşir | Ekstre ile ya da Elle Onay |
| 17 | POS vergisi | Sağlayıcı Türüne göre: Banka → BSMV Dahil; Ödeme Kuruluşu → KDV Hariç (K2) | Yasal durum; bankalar oranı BSMV dahil, sağlayıcılar "+KDV" verir | Evet (POS bazında) |
| 18 | KDV kipi faturası | Kesinti ödeme rolü taşır ama "yalnız bağlı" (FIFO dışı); ay sonu toplu taslak (toplam = kesintiler); kayıtta `invoice_id` bağı | m5 hayalet ödemesi olmaz; komisyon faturası kalıcı "Açık" kalmaz; kuruş artığı olmaz | Evet |
| 19 | Taksitli POS ödemesi | Taksit taksit, her ay | Bankaların yaygın uygulaması | Evet |
| 20 | İadede komisyon | İade Edilmez; kısmi iade bekleyen kalemlerden sondan başa | Yaygın sözleşme | Evet |
| 21 | Net eksi POS kalemi | Komisyon Tahsili kalemi | Banka hesaptan çeker | Hayır |
| 22 | Provizyon süresi | İptal penceresi (varsayılan aynı gün) | Gün sonu kuralı | Evet |
| 23 | Banka masrafı vergisi | BSMV Dahil (dekont) | Dekont pratiği | Formda ve Ayarlar'da |
| 24 | Masraf hesapları | Hesabı masraf türü belirler, vergi kipinden bağımsız: banka masrafları 770, POS komisyonları 653 | THP pratiği; aynı masraf her kipte aynı hesapta | Gelişmiş (beyaz liste) |
| 25 | Faiz | 642 / 780; stopaj oranı koda gömülmez | Oran sık değişir | Evet |
| 26 | Döviz | TCMB + elle; değerlemede döviz alış; ters kayıt yok; ağırlıklı ortalama; 13b var: kur yoksa **iki yönde TCMB döviz alış** (K9), ödemede ortalama maliyet + gerçekleşen kur farkı (646.02/656.02); faturada öneri (satışta döviz alış, alışta döviz satış) | VUK 280; K9 | Evet |
| 27 | Kurumsal kart | 309 (POS'tan ayrı); alıştan iade karta | C4 düzeltmesi | Hayır |
| 28 | Kredi hesabından cari ödemesi | Yok; önce transfer | Basitlik ve doğruluk | Hayır |
| 29 | Çek tahsile verme | `cheque_collections` + `fin_events`; `cheque_events` ve `cheques.status` değişmez; 101.01 → 101.02 → 102 | İki CHECK kısıtına dokunmamak | Hayır |
| 30 | Ekstre | Onaysız eşleşme yok; ±3 gün; mükerrer işaretlenir; aynı adlı iki aday Güçlü sayılmaz; sistem fişleri için sözlük + tekillik puanı | Talimat 23; bankanın kendi açıklamalarıyla eşleşir | Evet (sözlük, tolerans) |
| 31 | Fatura Ayarları bankaları | İlk hesap açılana kadar eski liste düzenlenebilir | Mevcut işi kesmemek | Hayır |
| 32 | ANLIK DURUM ve nakit akışı | K10 (Birleşik Rapor dahil aynı adlar); başlangıç = Nakit + Gerçek Banka; Kasa kutusunun bugünkü tanımı değişmez | Gerçek ve beklenen ayrımı; Kasa fiziki nakittir | Hayır |
| 33 | Yetkiler | §9.1; `bank.cancel` göçü `bank.move` kümesiyle aynı; personel istisnası | K4 kabulü | Yönetim → Roller |
| 34 | Raporların izni | `bank.reports`; mevcut raporun izni aynı | Erişim kaybı olmaz | Yönetim |
| 35 | Ekran | 6 sekme (+ gerekirse Döviz); Planlı İşlemler Hareketler'de; Kurulum Sihirbazı | Talimat 35; K13 | Hayır |
| 36 | Ayarlar | Temel / Gelişmiş; Varsayılanlara Dön | Kullanıcı kararı | — |
| 37 | Teslim | 2.0.26 + 2.1.0 (13 öne alındı) + 2.2.0 + 2.3.0; 17 ayrı | Risk ve kullanıcı sağlaması; K9 | Kullanıcı kararı |
| 38 | Eski sürüme dönüş | Yedekten; eski yazımlar onarım uyarısıyla | Gerçek davranış (§10.6) | Hayır |
| 39 | Sıfırlama ve kilit (A12) | "Tüm Hareketleri Sil" kilidi de kaldırır (onayda yazılır) | Kilitli verisi silinen dönemin kilidi anlamsız | Hayır |
| 40 | POS'lu faturanın iptali | Onayda "Müşteriye İade Edildi" (varsayılan) / "Kayıt Hatası". İade Edildi: provizyon içinde void, sonrası İptal İadesi. | Bankanın gerçek davranışı; geçmiş fişler ve eşleşmeler değişmez | Hayır |
| 41 | Toplu fatura işlemleri | Belge başına ayrı işlem (bugünkü düzen) | Biri düşerse ötekiler etkilenmez; e-Belge ağ çağrısı işlem dışında | Hayır |
| 42 | Eski ileri tarihli satırlar (A13) | Açılışta taban kümesine alınır; yaşlandıkça işlem engellenmez | Gün geçtikçe kilitlenme olmaz; yeni ileri tarih yine engellenir | Hayır |

### A.2 Talimattan Bilinçli Sapmalar (teslimde ayrı başlıkla yazılır)

| # | Talimat | Talimatın istediği | Uygulanan | Gerekçe |
|---|---|---|---|---|
| 1 | Ek 1 | Bütün tutar ve oranlar DECIMAL(18,2), float yok | Yeni banka/POS/döviz tablolarında INTEGER kuruş/ppm/1e-6 (STRICT). Mevcut modüllerin REAL kolonları **bu projede değişmez**. | SQLite'ta DECIMAL tipi yok; INTEGER kuruş aynı kesinliği verir. Mevcut kolonlarda kuruş kesinliğini kapı zorunlu tutar; 1e12 TL'ye kadar gidiş-dönüş özellik testi kanıttır. Tam göç Aşama 17'de ayrı proje (Ek B'de "kısmi"). |
| 2 | Ek 2 | POS komisyonunun KDV'si (%20) hesaplansın | Banka POS'unda ve banka masrafında varsayılan **BSMV %5**. KDV seçeneği her POS'ta ve her masraf formunda tam destekli (otomatik taslak + elle). Ödeme kuruluşunda varsayılan KDV. | Banka komisyonu ve masrafı KDV'den istisna, BSMV'ye tabi (KDVK 17/4-e). Yanlış KDV 191'i şişirir ve vergi riski doğurur (yasal doğruluk). |
| 3 | 26 | Finansal kayıt fiziksel silinmesin; iptal / ters kayıt | Banka Fişi silinmez, ters kaydedilir. Mevcut modül satırlarında Silinenler'li silme sürer. | Mevcut çalışanı bozmamak. İz kalır: olay `cancelled` (tutar kopyasıyla), audit (önceki değer), Silinenler yükü; eşleşmiş satır silinemez. |
| 4 | 9, 33 | Aynı işlem ikinci kez yapılmaya çalışılırsa engellensin | Aynı istek kesin engellenir. Farklı istekle aynı içerik "Benzer İşlem" **uyarısı** alır (hesaba bağlı satırlarda). Taksitte kalan 0'da kesin engel. | Aynı cariden aynı gün aynı tutarda iki gerçek tahsilat meşru; kesin engel gerçek işi durdururdu. |
| 5 | 42 | Aşamalar 1'den 16'ya sırayla | Aşama aşama geliştirme; Aşama 13 (döviz) teslimde POS ve ekstreden önce; Aşama 0 ve 17 eklendi. | K9: 13b ve Bankaya Tahsile Ver ilk teslimde olmalı; döviz POS'a ve ekstreye bağlı değil. Aşama 0 göçün ön şartı. |

---

## Ek B: Kapsama Tablosu

| Madde | Durum | Karşılandığı yer |
|---|---|---|
| 1 Önce analiz; duplicate tablo/API/kayıt yok | Tam | §1, §2, §3.1, §3.4 (tek okuma yolu), Aşama 1 |
| 2 Merkezi finansal işlem motoru | Tam | §3.3 (`bank.post`), §6 |
| 3 Banka hesabı tanımlama | Tam | §3.5, §5.2, §8.5 |
| 4 Açılış bakiyesi; elle değiştirilemez | Tam | §3.7 #1, §3.8 (Açılışı Düzelt), §10.3 |
| 5 Dashboard; gerçek ve beklenen ayrımı | Tam | §8.4 (K10) |
| 6 Banka hareketleri, alanlar, türler | Tam | §3.6, §7, §8.6 |
| 7 Bankalar arası transfer | Tam | §3.7 #11, Aşama 9 |
| 8 Kasa ↔ Banka | Tam | §3.7 #10, Aşama 6 |
| 9 Cari entegrasyonu ve mükerrer | Tam | §3.7 #2–3, §3.10, Aşama 5 (sapma A.2/4) |
| 10 Fatura entegrasyonu | Tam | §3.7 #4–5, §3.8, Aşama 7 |
| 11 Taksit; ikinci tahsil engeli | Tam | §3.7 #6, §3.10/3, Aşama 8 |
| 12 POS varlığı | Tam | §4.1 |
| 13 POS komisyonu | Tam | §4.3 |
| 14 Taksitli POS komisyonları | Tam | §4.1, §4.2 |
| 15 Provizyon / valör; bekleyen ve bankaya geçen | Tam | §4.4 |
| 16 Valör seçenekleri; iş günü servisi | Tam | §4.5, §8.11 |
| 17 POS tahsilat takvimi | Tam | §4.7, §8.7 |
| 18 POS iadeleri (kısmi, komisyon, bağ) | Tam | §4.6 |
| 19 Sanal POS hazırlığı | Tam | §4.8, §3.15 |
| 20 Banka masrafları | Tam | §3.7 #12–13, §8.11 |
| 21 Döviz hesapları | Tam | §3.12 (13b tahsilat ve ödeme dahil), Aşama 13 |
| 22 Banka ekstresi (CSV/Excel, sınıflar) | Tam | §3.13 |
| 23 Otomatik / yarı otomatik mutabakat | Tam | §3.13 (sistem fişi puanlaması dahil) |
| 24 İleri tarihli işlemler | Tam | §3.7 #23, §4.4/5 |
| 25 Nakit akışı | Tam | §8.9, §8.10 (Planlanan Transferler) |
| 26 İptal, ters kayıt, düzeltme, audit | Tam | §3.8, §4.6, §9.2/8 (sapma A.2/3) |
| 27 Yetkilendirme | Tam | §9.1, §9.2 |
| 28 Raporlama | Tam | §8.10 |
| 29 Arama ve filtreleme | Tam | §7, §8.6, §5.2 dizinleri |
| 30 Veritabanı | Tam | §5 (para kolonları için Ek 1 satırı) |
| 31 Tek merkezi işlem; yarım kayıt yok | Tam | §3.3 |
| 32 Veri tutarlılığı | Tam | §3.4, §3.11 |
| 33 Mükerrer koruması | Tam | §3.10 |
| 34 Hata ve sınır durumları | Tam | §12.3, §12.4 |
| 35 UI/UX | Tam | §8 |
| 36 Banka hesap detay | Tam | §8.5 |
| 37 Open banking; manuel ve API ayrımı | Tam | §3.15, §3.13/4 |
| 38 Türkiye uygunluğu | Tam | §3.13 (TR CSV ve sözlükler), §3.14 (çek), §3.15, §4.3, §4.5 |
| 39 Uluslararası katman | Tam | §3.2, §3.15 |
| 40 Performans | Tam | §3.11 (ölçek ve bütçe), §5.2, Aşama 2/16 |
| 41 Güvenlik | Tam | §9 |
| 42 Aşamalı geliştirme | Tam | §12 (sapma A.2/5) |
| 43 Kabul testi | Tam | §12.5 |
| 44 İzlenebilirlik | Tam | §8.6, `fin_events` |
| 45 12 başlıklı plan | Tam | Bu belge |
| Ek 1 DECIMAL / float yok | **Kısmi** | §5.1, A.2/1, Aşama 17 |
| Ek 2a Komisyon vergisi + masraf faturası | Tam (varsayılan vergi türü A.2/2) | §4.3 |
| Ek 2b Masrafta KDV dahil/hariç | Tam | §3.7 #12–13, §8.9 |
| Ek 2c TCMB kuru (otomatik / elle) | Tam | §3.12, §8.9 |
| Ek 3 Dönem sonu kur farkı değerlemesi | Tam | §3.12 |
| Ek 4 Blokeli / teminatlı POS | Tam | §4.2, §4.7, §8.10 |
| Ek 5 İadede komisyon | Tam | §4.6 |
| Son paragraf: Ayarlar, standartlar seçili, profesyonel seçim | Tam | §8.11 |
| Son paragraf: Soru yerine en yaygın seçenek | Tam | Ek A |
| Son paragraf: Menüde Taksitler'in altında "Banka" | Tam | §8.1 |

---

## Ek C: Eleştiri Açıkları ve Kapanışları

E1 = birinci eleştiri (22 açık), E2 = ikinci eleştiri (21 açık). Denetim 2'de yeniden açılanlar Ek D'de ayrıntılandı.

| Kod | Önem | Açık | Kapanış | Yer | Durum |
|---|---|---|---|---|---|
| E1.01 | Kritik | Tek birleşim yalnız SQL özetini kapsıyor; `entries`/`report` `methodOf` ile ayrışıyor; iki rapor yolu var | K5: `moneyLines` tek tanım; `methodOf` geri düşüşü kalktı; Kasa SQL'de `way='cash'`; mevcut rapor aynı kimlikle görünüm; `money:report` | §3.4, §8.10 | Kapandı |
| E1.02 | Yüksek | ANLIK DURUM önbelleği ve canlı yenileme bankayı görmüyor | `OVERVIEW_KINDS` + `bank`/`invoices`; parmak izi; `LEDGER_PATHS`; kuyruk ve sihirbaz olay yayımlar | §8.9 | Kapandı |
| E1.03 | Yüksek | Ek 1 sapması "tam" gösterilmiş | K1: kısmi; A.2/1; özellik testi; Aşama 17 | §5.1, Ek B | Kapandı (sapma açık yazıldı) |
| E1.04 | Yüksek | İkinci taksit tahsili varsayılan akışta engellenmiyor | K8: kalan 0 → `plan-paid`, aşan → `plan-overpay`; işlem türüne göre kapsam; hedef kuralı Benzer İşlem'den önce | §3.10, §3.3 | Kapandı |
| E1.05 | Yüksek | Modül ekranlarından silme yetkiyi deliyor | K4: `assertMutable`; `bank.cancel`/`bank.move`; previous zorunlu | §9.2/4, §3.8 | Kapandı |
| E1.06 | Yüksek | POS neti eksiye düşebiliyor | Komisyon Tahsili (`fee`) kalemi | §4.6 | Kapandı |
| E1.07 | Yüksek | Okuma modeli ve kapı ölçeği zayıf | `fin_events` kopyaları ve dizinleri; dokunulan olay denetimi; anlık görüntü; bütçe; Aşama 2 ölçümü | §3.11, §5.2 | Kapandı |
| E1.08 | Orta | POS yaşam döngüsü (düzelt, kısmi iade, geri yükle, hesap kopyası) tanımsız | Yerinde güncelleme / olay değişimi / replan; sondan başa dağıtım; geri yükleme kuralı; `bank_account_id` kopyası; İptal İadesi | §4.6, §3.8 | Kapandı |
| E1.09 | Orta | Valör fişi yön başına; banka net yatırıyor | (POS, gün) başına net tek fiş + sistem fişleri için puanlama (POS sözlüğü / Üye İşyeri No, tekillik) | §4.4/1, §3.13/5 | Kapandı (Sürüm 3, D2.01) |
| E1.10 | Orta | KDV kipi: FIFO, tetik, banka POS'unda KDV, `bank:refs` | `pos-fee` kökeni `payPay` + "yalnız bağlı" (`linkedOnly`); ilk kuyruk turu + Şimdi Oluştur; her POS'ta KDV (K2); `bank:refs` | §4.3 | Kapandı (Sürüm 3, D2.02) |
| E1.11 | Orta | Masraf formunda KDV yok | "+ Masraf" formunda BSMV/KDV Dahil/Hariç/Yok; KDV'de tek işlemde fatura + havale; hesap masraf türüne göre | §3.7 #13 | Kapandı |
| E1.12 | Orta | TCMB fatura formunda yok | Fatura formunda öneri, `rate_source` | §3.12 | Kapandı |
| E1.13 | Orta | 13b ve Bankaya Tahsile Ver ertelenmiş | K9: ikisi de ilk teslimde; tahsile verme `cheque_events` CHECK'ine takılmadan `cheque_collections` + `fin_events` ile; 13b ödemesi ortalama maliyet + gerçekleşen farkla | §3.12, §3.14 | Kapandı (Sürüm 3, D2.03) |
| E1.14 | Orta | Ana göstergede gerçek ile beklenen karışıyor | K10 tanımları; POS net; 300/309 ayrı; iç hareketler hariç (yalnız Banka) | §8.4 | Kapandı |
| E1.15 | Orta | `bank-account-required` eski ve toplu yollarla çatışıyor | §3.5'teki 7 kural; "iki hesap tanımlıyken" testleri; toplu kesim belge başına | §3.5, Aşama 5–8 | Kapandı |
| E1.16 | Orta | Dönüş onarımı eksik; toplu denetim kodları her şeyi kilitliyor | Onarım (e)(f)(g)(h); varlık bazında kodlar | §10.6, §3.11 | Kapandı |
| E1.17 | Orta | Ekstre: eski adaylar, TR biçimleri, gövde sınırı | Hesabı atanmamış adaylar + Ata + Eşleştir; kodlama ve TR biçimleri; 40 MB ya da parça | §3.13 | Kapandı |
| E1.18 | Orta | Tek merkezi mantık bir kalıptan ibaret | K6 `bank.post` + izinli listeli statik test + satır düzeyinde `money:event` + `store.raw` | §3.3 | Kapandı |
| E1.19 | Düşük | Sıfırlamada `firstAccountAt` ve açılışsız hesap sorunu | Tespit `event_id`'ye dayanır; "Açılış Bakiyesi Gir"; A12; İşlem No sayacı | §5.6, §5.4, §10.6 | Kapandı |
| E1.20 | Düşük | Örnek hata, planlanan transfer, 649 adı, aşama sırası | 89.994,75 düzeltildi; Planlanan Transferler; 649 adı; Aşama 1 → 0 | §3.7 #11, §8.10, §3.11, §12.1 | Kapandı |
| E1.21 | Düşük | Test kuralı maddeleri eksik | Aynı adlı iki cari/hesap, boş veri, sıralamalar, `page.clock`, `--sirket` | §12.4, §10.7 | Kapandı |
| E1.22 | Düşük | Açılmamış şirkette valör uyarısı gecikiyor | Hub'da günlük denetim (K3) + BİLİNEN SINIR | §4.4/2, §11.3 | Kapandı (sınır yazıldı) |
| E2.01 | Yüksek | Tekil indeksler ters kayıttan sonra yeniden yazmayı engelliyor | `status='active'` kısmi indeksleri; `reversal`; açılış tarihi sınırı | §5.2, §3.8 | Kapandı |
| E2.02 | Yüksek | İki okuma yolu; iç hareketler bugün giriş/çıkışı şişiriyor | K5; `internal` bayrağı Banka görünümlerinde; Kasa tanımı korunur | §3.4 | Kapandı |
| E2.03 | Yüksek | KDV kesintisi: FIFO, kuruş artığı, `bank:refs`, `bank:party` | "Yalnız bağlı" `payPay`; taslak toplamı = kesintiler; `bank:refs`; anlık sağlayıcı kopyası | §4.3 | Kapandı (Sürüm 3, D2.02) |
| E2.04 | Yüksek | Yetki göçü yanlış eşleme yapıyor | K4 eşlemesi + `bank.cancel` + göç testi | §9.1 | Kapandı |
| E2.05 | Yüksek | `pos-settled` ve eşleşmiş 409'ları fazla geniş | `bank.replan`; 409 yalnız eşleşmiş ya da kilitli; fatura iptalinde İptal İadesi | §3.8, §4.6 | Kapandı |
| E2.06 | Orta | Fatura Düzenle'de sıra eşlemesi; yol bazlı eksi bakiye; sihirbaz | `lineKey`; hesap bazında son durum; sihirbaz `payment_json` yazar | §3.8, §3.9, §10.3 | Kapandı |
| E2.07 | Orta | Kurumsal karta iade POS satışına dönüşüyor | Alan belge türüne göre; `bank:refs` | §4.6 | Kapandı |
| E2.08 | Orta | Eski sürüm tespiti yanlış sonuç veriyor | K11: her satıra `event_id`; `v20At`; özet karşılaştırması (g) | §10.4, §10.6 | Kapandı |
| E2.09 | Orta | Silinenler geri yüklemesi kendi kuralıyla çelişiyor | `op 'restore'`; olay `active`'e döner; POS yeniden etkinleşir; nedenli provizyon 409'u | §3.8 | Kapandı |
| E2.10 | Orta | Hesap eşlemeleri kapıyı kilitleyebilir | Rol bazlı beyaz liste (fx_gain/fx_loss dahil); ana kodlar sabit | §3.11, §8.11 | Kapandı |
| E2.11 | Orta | Benzer işlem gereksiz 409; açık formda istek kimliği sessiz kayıp | Hedefli anahtar; yalnız hesaba bağlı satırlar; carisizde provizyon; başarıdan sonra yeni kimlik; `replayed` görünür | §3.10 | Kapandı |
| E2.12 | Orta | "Sonraki Gün Ters Kaydet" ileri tarihli fiş yazıyor | `bank_jobs` ile ertesi gün işi | §3.12 | Kapandı |
| E2.13 | Orta | Kuyruk senkron çalışıp sunucuyu donduruyor | `listen` sonrası kuyruk; tur sınırı; GET yazmaz; ölçüm | §4.4 | Kapandı |
| E2.14 | Orta | Kapı maliyeti büyüyor | Dokunulan olaylar; `bank_matches` FINANCIAL dışı; MINOR yok | §3.11, §5.5 | Kapandı |
| E2.15 | Orta | Kısmi iade dağıtımı tanımsız | Sondan başa; artan çıkış kalemi; `splitMinor` | §4.6 | Kapandı |
| E2.16 | Orta | Taksitte "Pasife Al" yok; `seller.banks` salt okunur olursa iş kesilir | Önce tahsilatları sil yolu; ilk hesaba kadar düzenlenebilir | §3.8, §8.9 | Kapandı |
| E2.17 | Orta | Personel düzelterek bankadan para çıkarabiliyor | K4 + hesap bazında etki farkı ve son durum | §9.2/4 | Kapandı |
| E2.18 | Orta | m11 eksi bakiye uyarısı geri gelir | K7: Bakiye Doğrulandı'ya kadar Kontrol Yok | §3.9 | Kapandı |
| E2.19 | Düşük | Aşama 0 kilit kolonları ve çek kilit izi | Aşama 0 kolonsuz girdiler; `cheques` girdisi (status hariç); `party_lock` | §5.5 | Kapandı |
| E2.20 | Düşük | 2.0.25'te kalıcı `gl:108` sapması | BİLİNEN SINIR + CHANGELOG | §10.6, §11.3 | Kapandı (sınır yazıldı) |
| E2.21 | Düşük | Üç ekran üç farklı banka toplamı gösteriyor | K10 tek tanım; eski kova her ekranda aynı adla ayrı satır; Birleşik Rapor beş sütun | §8.4, §8.9 | Kapandı |

---

## Ek D: Plan Denetimi 2 Bulguları ve Kapanışları (Sürüm 3)

| Kod | Önem | Bulgu | Kapanış | Yer |
|---|---|---|---|---|
| D2.01 | Orta (E1.09) | Net tek fiş var ama puanlamada sistem fişi yalnız tarih (40) alıyor; "Eşleşmeyen" şişiyor; kabul adım 30'daki "Güçlü" tutmuyor (ad en çok 25 → 65) | Sistem fişleri için anahtar sözcük/kimlik bileşeni (POS adı, Üye İşyeri No, "POS", "NAKİT", "VİRMAN", karşı hesap adı; 25) ve tekillik bileşeni (15); karşı IBAN şirketin kendi hesabını da tanır; valör fişinin açıklaması ve referansı tanımlandı. Adım 30: 6 satırın 5'i 80 puanla Güçlü, 10,50 Eşleşmeyen + Masraf önerisi. | §3.13/5, §4.4/1, §12.5 |
| D2.02 | Yüksek/Orta (E1.10, E2.03) | "pos-fee kökenine kapama rolü verilmez; yalnız invoice_id bağıyla kapar" çalışmaz: bağlı kapama yalnız `payPay` ile havuza giren satırla yapılıyor (invoice-settle.mjs:162-185); komisyon faturası kalıcı "Açık" kalır | `pos-fee` borç tarafında `payPay` (iade eksi tutarlı) + havuz öğesinde `linkedOnly`: yalnız 1. adımda (bağlı) kapar, 1b ve FIFO'yu atlar; aynı faturaya bağlılar netlenir. Bağlanmamış kesinti hiçbir faturayı kapatmaz. Mevcut kökenlerin kapaması aynı. Ek test: ilgisiz fatura "Açık", komisyon faturası "Ödendi", fark "Kısmen Ödendi". | §4.3/2, §11.4, Aşama 11 |
| D2.03 | Yüksek (E1.13, K9-1) | Bankaya Tahsile Ver `cheque_events(deposit)` yazıyor; `kind` CHECK'i bunu reddeder (migrations.mjs:729) | `cheque_events`'e hiç satır yazılmaz; iz yalnız `cheque_collections` (event_id, close_event_id) + `fin_events` (`cheque_deposit`/`cheque_withdraw`); `cheques.status` `portfolio` kalır, "Bankada Tahsilde" sanal durum. Collect/bounce izinli türlerle. Statik test CHECK değerlerini tarar. Eylem adları `bank-deposit`/`bank-withdraw`. | §3.6, §3.7 #21, §3.14, §5.2, §7, §10.6 h |
| D2.04 | Orta | Kabul 34(c) §4.6 ile çelişiyor: 12.10 satışı ≥15.10'da iptal = provizyon geçmiş → iade; "POS bekleyen 0