# Ç2 — Saklanan Fiş Defteri: Tasarım Notu (2.5.0)

Durum: KOD AJANI TASARIMI (05.11.2026). Kaynak: `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §3 (aynen), §4, §6, §9; kural kitabı G-4, G-6, G-7, R-03, M-11; EK-1 M4 (Önceki Yıl
Sonucu Fişi), M7 (Kural Farkı Düzeltme Fişi); `docs/devir/DEVIR-PLANI.md` G1, G3, G6, G7; iş listesi D ve E (BS-7 TASARIM GİRDİSİ). Kod: `server/lib/ledger-vouchers.mjs`,
göç 46 (`server/lib/migrations.mjs`), `journal()` (`server/lib/general-ledger.mjs`), `rows()` + uçlar (`server/routes/ledger.mjs`).

## 1. İlke
Türetilmiş defter korunur (ERP E1): bu tablo ikinci bir para motoru değildir. Yalnız TÜRETİLEMEYEN maddeleri (kapanış, devir açılışı, açılış eşleştirmesi, önceki yıl sonucu,
kural farkı düzeltmesi ve ters kayıtları) satır satır saklar; `journal()` onları `bank_lines` gibi AYNEN alır. Fiş yokken yevmiye, mizan ve Defter Mutabakatı 2.4.9 ile
birebir aynıdır (kanıt: §9 N12).

## 2. Şema (göç 46, yalnız ekleyici)
- `ledger_vouchers`: `id` · `year` + `no` (TEKİL çift) · `date` · `type` (closing | opening | opening-match | reversal | prior-year-result | rule-diff-correction | manual) ·
  `journal_class` (opening | ordinary | period-end | closing) · `description` · `source` (ör. devir çalışma kimliği) · `request_key` (TEKİL) · `reversal_of` (yabancı anahtar;
  kısmi TEKİL indeks: bir fiş bir kez ters kaydedilir; CHECK: yalnız ve her zaman type = reversal'da dolu) · `line_count` (≥ 2) · `total_minor` (> 0) · `created_by` / `created_at`.
- `ledger_voucher_lines`: (`voucher_id`, `seq`) birincil anahtar · `account` (3 hane) · `sub` · `party` · `debit_minor` / `credit_minor` (CHECK: tam olarak biri > 0) · `note`.
- Tetikleyiciler (edoc_usage deseni): başlık ve satırda UPDATE ve DELETE → RAISE(ABORT). INSERT OR REPLACE çakışan satırı silme tetikleyicisi çalışmadan değiştirdiği için
  (recursive_triggers kapalı) ekleme de denetlenir: aynı kimlik / istek kimliği / (yıl, no) ile başlık eklenemez; başlığın `line_count`'u dolunca satır eklenemez ("kapanmış
  fişe satır eklenmez"; fiş yoksa da). Tetikleyiciler dosyanın parçasıdır: eski sürüm (2.4.9) de onlara tabidir.
- Tetikleyicileri YALNIZ iki yol, aynı işlemde kaldırıp yeniden kurar (`withTriggersLifted`; DDL işlemsel — işlem düşerse tetikleyiciler geri gelir): Şirket Verisini Sıfırla
  (`clearVouchers`) ve eski sürüm sıfırlamasının açılış onarımı (`repairLegacyReset`).

## 3. Sayaç
`no` = o yılın (fiş tarihinin yılı) en büyük sırası + 1, ekleme ile aynı eşzamanlı adımda, `BEGIN IMMEDIATE` işleminin içinde; `UNIQUE (year, no)` ve ekleme tetikleyicisi
yedek. Ayarda ayrı sayaç YOK (İşlem No `meta.bank.seq.<yıl>`'dan farkı: §10 K3). Yazılış "Fiş 2026-000003".

## 4. İç API ve uçlar
- `context.ledger.vouchers` (routes/ledger.mjs kurar): `post(user, input)`, `postAll(user, inputs, { lockThrough })`, `reverse(user, id, { date, requestKey, description })`,
  `get(id)`, `list({ from, to, type })`. input = { type, cls?, date, description?, source?, requestKey, lines: [{ account, sub?, party?, debit, credit, note? }] } (kuruş).
- Denetim (`assertVoucherLines`, bank/voucher.mjs assertLines deseni): en az iki satır, her satır tek taraflı ve > 0 kuruş tam sayı, Σ borç = Σ alacak > 0, hesap ACCOUNT_PLAN'da,
  alt hesap `<hesap>.<2–4 hane>`, cari yalnız cari hesaplarında (120, 127, 128, 320, 336). Tür ↔ sınıf: closing → closing | period-end (N-01 stok değerlemesi dönem sonu
  sınıfıdır); opening, opening-match → opening; prior-year-result → closing; rule-diff-correction, manual → ordinary; reversal → asıl fişin sınıfı.
- İstek kimliği zorunlu, kalıcı (request_keys'in 30 günü yok): aynı kimlik + aynı içerik → ilk fiş (`replayed: true`); farklı içerik → 409 request-id-reused. Kimlik denetimi
  kilit ve tarih denetiminden ÖNCE (kilit sonradan konduysa yinelenen istek yine aynı fişi alır).
- Bütün yol eşzamanlı (denetim → numara → ekleme → iz tek `store.tx`; ders 47 son cümle). Her fiş aynı işlemde `audit_events`'e "ledger.voucher.created" izini kendisi yazar
  (bağlamın audit işlevinden bağımsız; §8 BS-7).
- Ters kayıt (R-03): satırlar asıl fişin aynası (borç ↔ alacak), aynı toplam ve sınıf; tarih verilmezse asıl fişin tarihi; asıl tarihten önce olamaz (400), kilitli döneme düşemez (409);
  ters kaydın ters kaydı yok (409 voucher-reversal-of-reversal), bir fiş bir kez (409 voucher-reversed; kısmi TEKİL indeks yedek).
- HTTP (yetki: dönem kilidini koyabilen = `system.manage`; Muhasebe 403): `GET /api/admin/ledger/vouchers?from&to&type`, `POST /api/admin/ledger/vouchers/:id/reverse`
  ({ date?, description?, requestId } ya da `x-hof-request`; fişin kimliği `api:<requestId>`). Serbest fiş girişi ucu YOK (2.5.1). Ekran yok; fişler Yevmiye Defteri ve Hesap
  Planı Mizanı'nda görünür ("İşlem" kolonu tür adı: Kapanış Fişi …; "Açıklama": "Fiş 2026-000003 · açıklama").

## 5. Kilit ilişkisi
- Tarihi kilitli (≤ ledger.lockedUntil) fiş 409 period-locked; ileri tarihli fiş 400 date-future (programın genel kuralı).
- `postAll(..., { lockThrough: K })`: yalnız closing / prior-year-result; her fiş ≤ K ve AÇIK dönemde; fişler yazılır, kilit aynı işlemde K'ye konur (yalnız ileri gider), iz
  "ledger.period.locked" (reason ledger.voucher.closing). Biri düşerse hiçbiri ve kilit yazılmaz. Kapı: kilit aynı işlemde değiştiği için "Kapanmış dönem değişemez" vermez
  (bugünkü kilit uç kuralıyla aynı). Kilit önceden K'de ise kapanış fişi yazılamaz (409) — kilitli döneme fiş, kilit değişmeden, kapıda da reddedilir; D4 için §11.
- LOCK_SQL `ledger_vouchers_lock` (since 2.5.0): kilitli dönemdeki her fiş satırı + tür / sınıf / ters bağ. Fişsiz veride satır üretmez (iz 2.4.9 ile birebir).
- Kapı (db.mjs FINANCIAL += iki tablo; integrity-scope FULL_TABLES += iki tablo): fiş yazımı her zaman tam kapıdan geçer (denge, bütün beklenenler, kilit izi). Tam taramaya
  "ledger:vouchers" denetimi (yalnız fiş varsa görünür; fişsiz veride Defter Mutabakatı satırları aynı): başlık = satırlar, borç = alacak, hesap planda, ters kayıt aynası.

## 6. Deftere giriş
`rows()` fişleri yalnız süzgeçsiz kurulumda tek toplu sorguyla okur (`voucherJournalRows`; KDV mahsubu gibi; ders 47). `journal()` fişleri şüpheli alacak ayırmasından
SONRA ekler (saklanan satır yeniden sınıflanmaz). Madde kimliği öneki sınıftır: `voucher-open` (JOURNAL_CLASS 1, günün en başı), `voucher` (45, olağan: Banka Fişi'nden sonra),
`voucher-end` (75, KDV mahsubundan sonra), `voucher-close` (99, günün en sonu); sınıf içinde yazım sırası (fişin rowid'i; ders 31).

## 7. invoices / vat_offsets FINANCIAL'da değil — araştırma sonucu (plan §3 "DOĞRULANACAK")
BİLİNÇLİ TASARIM DEĞİL, KAYITLI BİLİNEN SINIR: `docs/2.1.0-KANIT.md` "Yalnız fatura tablosuna yazan işlem kapıyı tetiklemez (2.0.15'ten beri; invoices FINANCIAL'da değil)
… tam tarama ve Mutabakat Testi bulur (banka-210-kapi-kapsam BİLİNEN SINIR testi)"; `docs/2.4.4-IS-LISTESI.md` "SONRAYA [XH] (G1 ikincil): invoices ve vat_offsets kapının
izlediği tablolara (e-Belge durum alanları istisna)"; `docs/erp/TABLO-PARA-KOPARMA-PLANI.md` §4.2 aynı iş ([XH] ~1,5–2 gün). Koddan: fatura yazımlarının çoğu aynı işlemde
cari / stok / Kasa tablosuna da yazar (kapı o yüzden koşar); yalnız-fatura yazımı (ör. gl_json / durum düzeltmesi) ve KDV mahsubu (routes/tax.mjs INSERT / UPDATE status)
kapıyı tetiklemez. `routes/ledger.mjs`'teki "mahsup tablosuna yazım tam kapıya düşer" yorumu bu yüzden YANLIŞ (vat_offsets touched kümesine girmez). Kilit koruması: KDV mahsubu
rotası `period.assertOpen`; kilit izinde `vat_offsets_lock` ve `invoices` girdisi var → kapının görmediği değişiklik tam taramada görünür. Ç2'de DEĞİŞTİRİLMEDİ (görev);
BULGU olarak raporlandı.

## 8. Yaşam döngüsü
| Yol | Ne olur |
|---|---|
| Şirket Verisini Sıfırla (iki kip) | `clearVouchers`: tetikleyiciler aynı işlemde kaldırılır, fişler ve satırlar silinir, tetikleyiciler yeniden kurulur; sayılar sıfırlama raporunda; numara 1'den |
| Yedekten geri yükleme | VACUUM INTO tabloları ve tetikleyicileri taşır; yedek eskiyse (≤ 45) geri yüklemede göç 46 koşar (boş tablo). Numara yedeğin devamı (§10 K3) |
| Şirket silme | Klasör gider; ayrı iş yok |
| Silinenler | Fiş silinmez → Silinenler'e girmez; cari silinirse fiş satırının cari boyutu durur (kontrol hesabına fiş zaten kapıda reddedilir, §11) |
| Göç | Yalnız ekleyici; eski sürüm fikstürleri ve v2.4.9 verisi 46'ya çıkar, kilit izi ve yevmiye aynı (§9 N12, N19) |
| Devri Geri Al | D4: dosya takası (G1, G7) — fiş tablosuna silme gitmez |
| Eski sürüm (BS-7, 2.4.9 göç etmiş 46 dosyayı yazılabilir açar) | Fişlere UPDATE / DELETE yapamaz (tetikleyici). Kendi Şirket Verisini Sıfırla'sı hareketleri ve işlem geçmişini siler, fişlere dokunamaz → fişler sıfırlanmış verinin üstünde artakalır. 2.5.0 açılışında `repairLegacyReset`: izi ("ledger.voucher.created") olmayan fiş + işlem geçmişinde BU ŞİRKETİN "company.reset" izi (tur 1, §11a) ve fiş o sıfırlamadan ÖNCE yazılmış — YAZIM SIRASIYLA, duvar saatiyle değil (tur 2, §11b) → asıl fiş ve ters kaydı birlikte, aynı işlemde kaldırılır, Mutabakat Günlüğü'ne "repair" ve işlem geçmişine yazılır (eski sürümün sıfırlama öncesi yedeği fişleri taşır). Kuşkuda (sıfırlama izi yok ya da başka şirketin; iz işlem geçmişini silmemiş; fiş izi duran bir fişten sonra yazılmış; çiftin öbürü kalıyor) dokunulmaz; Mutabakat Günlüğü'nde görünür "repair" kaydı (aynı küme için bir kez) + sunucu günlüğü (`kept`, `doubts`) |
| Eski sürüm kilidi açıp kapanış fişinin altındaki veriyi değiştirirse | BİLİNEN SINIR (2.5.0'ın kendisinde de kilit açılınca aynı): kapanış fişi bayatlar; Ç3 (donmuş defter ↔ güncel türetme farkı, "Kural Değişikliği Farkı") görünür kılar |

## 9. Nasıl bozulur? (önce yazıldı; testler bu listeden — test/fis-defteri-250.test.mjs, test/fis-defteri-yasam-250.test.mjs)
N1 dengesiz fiş · N2 sıfır / iki taraflı / eksi / kesirli satır · N3 planda olmayan hesap, yabancı alt hesap, cari kontrol dışı · N4 aynı istek kimliği (aynı içerik → aynı fiş;
farklı → 409) · N5 eşzamanlı iki süreç aynı kimlik → tek fiş · N6 kilitli tarihe fiş / ters kayıt 409 · N7 ileri tarih 400 · N8 UPDATE / DELETE / INSERT OR REPLACE / kapanmış
fişe satır → tetikleyici · N9 ters kaydın ters kaydı, aynı fişin iki ters kaydı (eşzamanlı HTTP dahil), asıl tarihten önce ters kayıt · N10 ters kayıt sonrası mizan sıfır,
iki madde de yevmiyede · N11 süreç öldürme ve disk dolu → yarım fiş yok · N12 fişsiz yevmiye / mizan / Defter Mutabakatı birebir (eşdeğerlik) · N13 aynı gün sırası (açılış başta,
kapanış sonda, ters kayıt asıl sınıfta) · N14 kapanış + kilit aynı işlemde (biri düşerse ikisi de yok) · N15 iki şirket karışmaz · N16 yedek → geri yükle · N17 Sıfırla (iki kip;
tetikleyiciler geri kurulu) · N18 eski sürüm sıfırlaması → açılış onarımı · N19 göç (fikstür + v2.4.9) · N20 31.12 / 01.01 (numara yılı, sıra, devir kolonu) · N21 kontrol
hesabına fiş → kapı 409 · N22 store dışı silme → tam tarama "Kapanmış dönem" · N23 yetki (system.manage; Muhasebe 403).

## 9a. Kanıt (docs/kanit/2026-11-05/c2-*; her koşu tools/kanit.mjs kos)
- Kırmızı (eski kod 204f58bf, ayrı kopya): yeni iki test dosyası 0/23 — nedenler "fiş defteri yok", yevmiyede fiş maddesi yok, tetikleyici yok, "no such table: ledger_vouchers",
  modül yok (iptal 0). Yeşil: 23/23 (dar listede iki saat diliminde).
- Mutasyon 16/16 beklenen nedenle (denklik, sıfır satır, ters kayıt yönü, istek kimliği, kilit 409, UPDATE / DELETE tetikleyicisi, journal() sınıf sırası ×2, kapanış + kilit,
  ikinci ters kayıt, sıfırlama ×2, eski sürüm onarımı, kilit izi, FINANCIAL).
- Eşdeğerlik (fişsiz): mutabakat motoru verisi (taban kodla üretildi; tohum 7, 3.000 işlem, 2.216 madde / 5.004 satır) 14/14; 2.0.26 zincir fikstürü (4 şirket) 51/51; GERÇEK
  v2.4.9 koduyla üretilmiş veri (tohum 11, 1.500 işlem; 46'ya göç ederek) 14/14 (tek fark Ç1'in 770 adı).
- Eski sürüm (2.4.9 gerçek kodu) senaryosu 17/17 (§8 son iki satır).
- Hız (motor verisi, 15 tur, medyan): GET ledger tüm zaman 41,1 → 39,3 ms; bu yıl 39,8 → 40,5; Hesap Planı Mizanı 40,1 → 41,0; Yevmiye 45,5 → 42,8 (fişsiz: fark gürültü düzeyinde);
  200 fiş × 40 satır (+8.000 satır) eklenince 67,6 / 70,9 / 71,2 / 108,4 ms, olay döngüsü en çok 95–186 ms (satır sayısıyla doğrusal; makine yükü 2,1–3,0 — başka ajanlar).
- Dar liste (169 dosya: Ç1 listesi + göç / yedek / sıfırlama / kapı / kilit / yevmiye / kaynak tarayan genel testler): UTC 1807/1810 (3 atlanan etiketli, Ç1 ile aynı);
  İstanbul 1806/1810 — tek kırmızı test/cheques-overview.test.mjs "adım 50: Kasa (bugüne kadar)": koşu 23:55 İstanbul'da başladı, dosya yerel gece yarısından sonra koştu;
  testin beklentisi UTC günüyle (`new Date().toISOString().slice(0, 10)`, satır ~406), program yerel günle hesaplar → İstanbul'da 00:00–03:00 arası her koşuda kırmızı. TABAN
  KOD 204f58bf aynı anda aynı sayılarla kırmızı (c2-cheques-overview-ist-taban-204f58bf), yeni kod UTC'de yeşil — Ç2 ile ilgisiz, BİLİNEN TEST HATASI, ana oturumun çalışma dalında
  25effbe7'de düzeldi (bu dalda dokunulmadı; aynı kalıbı taşıyan öbür test dosyaları ayrı süpürme işinde).
- Kâhin defter 176/176, kâhin cari 8698/8698.
- e2e: senaryo-defter-243 24/24, senaryo-banka-210 424/424, sema-kapisi-bs7 12/12 (LATEST + 1 = 47), senaryo-220-yedek 37/37.
- WINDOWS (ders 48): test/fis-defteri-yasam-250.test.mjs süreç öldürür (SIGKILL → Windows'ta TerminateProcess) ve öldürülen sürecin dosyasını yeniden açar; yedek geri yükleme
  dosya takası yapar — ilk gönderimde CI'nin Windows işlerinde görülmeli.

## 10. BAŞ MİMAR KARARI ÖNERİLERİ (ders 40; kullanıcıya gösterilecek)
- K1 Sınıf ayrı kolonda (`journal_class`), türden türetilir ama closing türü `period-end` de alabilir: kural kitabı N-01 (stok değerlemesi) "dönem sonu sınıfı" ve Gelir Tablosu'na
  GİRER; N-02…N-07 kapanış sınıfı ve GİRMEZ (§4) — tek "closing" türü ikisini ayıramazdı. Ters kayıt asıl fişin sınıfını alır (kapanışın tersi de Gelir Tablosu dışında kalır).
- K2 Ters kaydın ters kaydı yapılmaz; asıl fiş yeniden yazılır (zincir yok; yaygın uygulama).
- K3 Numara yıl içinde müteselsil ve boşluksuz, verinin kendisinden: sıfırlamadan sonra 1'den, geri yüklemede yedeğin devamı (yaygın muhasebe programlarında fiş numarası
  veriyle döner). İşlem No'dan (dışarıya basılan, hiç yeniden kullanılmayan) bilerek farklı.
- K4 İleri tarihli fiş yok (programın genel hareket kuralı). Ters kayıt tarihi verilmezse asıl fişin tarihi (KDV mahsubu Geri Al ile aynı gün kuralı).
- K5 Eski sürüm sıfırlamasından artakalan fiş açılışta kaldırılır (kullanıcının sıfırlama iradesinin tamamlanması; iz + Mutabakat Günlüğü; sıfırlama izi yoksa dokunulmaz).
  TUR 1'DE DARALDI (§11a): yalnız aynı şirketin sıfırlama izinden önce yazılmış fiş. TUR 2'DE (§11b): "önce" yazım sırasıyla (duvar saati değil); asıl fiş ve ters kaydı
  birlikte kalır ya da gider, kuşkuda ikisi de kalır; kalan kuşkulu fiş Mutabakat Günlüğü'nde görünür.
- K6 Cari boyutlu fiş satırı yalnız cari hesaplarında; kontrol / alt defter hesaplarına (100, 101, 102, 103, 108, 120, 121, 127, 128, 129, 190, 191, 193, 300, 309, 320, 321, 336,
  360, 391) yazan fiş Defter Mutabakatı farkı verir ve kapıda geri alınır — beklenen bakiyeler (expected) fişleri OKUMAZ (alt defter değiştirmeyen fiş o hesaba yazılmaz).
  TUR 1'DE DEĞİŞTİ (dar kontrol ORTA-1: "kapıda geri alınır" iddiası 121 / 128 / 129 / 190 / 321 için yanlıştı; §11): bu hesaplar fiş denetiminde, modül kullanılmış olsun
  olmasın 400 ile reddedilir; liste expected()'den türetilir; kapı ikinci katman.
- K7 Fiş yazımı tam kapıdan geçer (seyrek iş; 2.1.0 ölçümüyle 100.000 satırda ~3 sn olay döngüsü — kilit koyma ile aynı sınıf).
- K8 Fiş numarası yazılışı "Fiş 2026-000003"; tür adları: Kapanış Fişi, Açılış Fişi, Açılış Eşleştirme Fişi, Ters Kayıt Fişi, Önceki Yıl Sonucu Fişi, Kural Farkı Düzeltme Fişi,
  Mahsup Fişi (yazım düzeni).

## 11. Ç3, Ç5, D4'e notlar
- Ç3: kilit artık iki yoldan değişir — `PUT /api/admin/period-lock` ve `vouchers.postAll(..., { lockThrough })`; dondurma ikisinden de tetiklenmeli (ortak bir "kilit değişti"
  kancası önerilir). Donmuş satırlar fiş maddelerini de içerir (madde kimliği `voucher-*:<id>`). Kilitli dönemde fiş değişmez (tetikleyici + kilit izi), ama kural sürümüyle
  türetilmiş satırlar değişebilir — fark denetimi fişleri "saklanan" sayar (yeniden türetilmez). `ledger_snapshots` sıfırlama listesinde zaten var (app.mjs MOVEMENT_TABLES).
- Ç5: Açılış Eşleştirme Fişi = `post({ type: "opening-match", … })`; M-11'in "yalnız geçici hesabı kapatan satırlar" ve "519'u ters bakiyeye geçiremez" kuralları Ç5'in
  denetimidir (Ç2 genel denetim yapar). Kural Farkı Düzeltme Fişi tarihi = kilit + 1: kilit bugünse o tarih YARIN → bugün 400 date-future; Ç5 bu durumu kullanıcıya söylemeli
  (ya da kilit bugünken düğme pasif + neden). Ters kayıt ucu hazır (HTTP); ekran 2.5.1 ya da Ç5.
- D4: Kapanış fişleri `postAll(user, [Önceki Yıl Sonucu Fişleri…, N-01 (cls period-end), N-02…N-07], { lockThrough: K })` — aynı gün sırası: dönem sonu sınıfı (N-01) kapanış
  sınıfından ÖNCE görünür; EK-1 M4'ün "Önceki Yıl Sonucu Fişleri → N-01 → N-02" sırası ile kural kitabı G-4'ün sınıf sırası çelişir (N-01 Gelir Tablosu'na girer, kapanış sınıfı
  girmez — sıra bakiyeyi değiştirmez, yalnız gösterim): mali müşavir A'ya sorulacak gösterim sorusu. Kilit önceden K'deyse kapanış yazılamaz: önce ayrı işlemde (iz + gerekçe)
  kilit geri alınmalı (bakım kipinde). N-13 / açık kalemler: cari açılışı account_entries'te (G2) — fişte cari kontrol hesabı satırı kapıda reddedilir (K6); 190 / 360 gibi
  beklenenli vergi hesabının açılışı fişle yazılacaksa expected()'e fiş satırları eklenmeli (bank_lines 360/193 deseni); ayrıca KDV Mahsup Fişi'nin ay tutarları
  (routes/tax.mjs monthFigures) yevmiyeden okunur — 01.01 açılış fişindeki 191 / 391 satırı Ocak'ın KDV hareketi sayılır (açılış fişi orada dışlanmalı ya da KDV 190 ile
  devredilmeli). Devri Yenile (N-14 "önceki devir maddesi kalmaz") ile
  G-6 "silinemez, düzeltme ters kayıtla" ÇELİŞİR: (a) önceki devir fişleri ters kaydedilip yenileri yazılır (iz kalır, mizan sütun toplamları büyür) ya da (b) yalnız devir
  kaynaklı fişleri silen dar bir yol (tetikleyici kaldırma, aynı işlem, iz). KARAR (KULLANICI 05.11 21:30, (7) A, aynen): "Devri Yenile'de yalnız devrin ürettiği kapanış /
  açılış fişleri silinip yeniden yazılır (dar yol: bakım kipi, aynı işlem, iz Değişiklik Geçmişi'nde); yevmiyede tek açılış fişi." → (7) A = (b). Yolu D4 kurar (Ç2 ve tur 1
  KURMADI); D4'ün dört kısıtı aşağıda (tur 1). Devri Geri Al dosya takasıyla: fiş numaraları devir öncesi dosyanınkinden sürer (K3).
- D2 / D4 (G3 tablo sınıflaması): `ledger_vouchers` / `ledger_voucher_lines` G3 listesine girer (öneri: "≤K SİLİNİR, yeni yılda AÇILIŞ" — ≤K fişler arşivde kalır, yeni yıl
  dosyasında N-13 açılışıyla çift sayılmasın diye budanır). Tetikleyiciler DELETE'i reddeder → budama yalnız Ç2'nin tetikleyici kaldırma yoluyla (`withTriggersLifted`, şimdi
  modül içi) ve yalnız bakım kipindeki KOPYADA yapılmalı; D4 bunun için dar, dışa açık bir işlev ekler (ör. `pruneVouchersThrough(store, K)`, aynı işlem, iz). D4 fişleri iç API
  dışından yazmamalı: her fişin izi (`ledger.voucher.created`) eski sürüm onarımının dayanağıdır (izsiz fiş + "company.reset" = artakalan fiş).
- D4 KISITI (tur 2, §11b — onarım YAZIM SIRASINA dayanır): (1) kalan fişlerin izleri (`ledger.voucher.created`) budanmaz; işlem geçmişi kopyaya taşınırken fişlerle birlikte
  taşınır; (2) fiş tabloları kopyaya ya da yeni yıl dosyasına aktarılırken rowid sırası korunur (`INSERT … SELECT … ORDER BY rowid`; açık rowid vermeden) — sıra bozulursa
  onarım kuşkuya düşer (ikisi de kalır, görünür kayıt; §11b); (3) devrin kendi "company.reset" benzeri bir izi YOKTUR (yazılırsa izsiz fişler için sıfırlama sayılır).

## 11a. Ç2 TUR 1 (06.11.2026; dar kontrol 05.11 22:00 bulguları — DURMA KURALI + SAKINCA SÜZGECİ; kanıt docs/kanit/2026-11-06/c2t1-*)
- K6 YENİ KURALI (ORTA-1): alt defterin sahip olduğu hesaplara (Kasa, Banka, Cari, Çek / Senet, carisiz Taksit, KDV ve vergi, Şüpheli Alacak) yazan fiş, modül kullanılmış olsun
  olmasın fiş denetiminde 400 `voucher-subledger-account` ile reddedilir (önce kabul edilen 121 / 128 / 129 / 190 / 321 dahil; alt hesap ve cari boyutu da). Liste koddan
  TÜRETİLİR: `routes/ledger.mjs` `subledgerAccounts()` = Defter Mutabakatı'nın beklenen bakiyelerinin (`expected()`) anahtarları, `every` kipinde (yalnız kullanılınca açılan
  309 / 300 / 121 / 321 / 190 / 128 / 129 satırları da açık); elle yazılmış ikinci liste yok — expected()'e yeni alt defter satırı eklenince koruma onu da kapsar. Bugün 20 hesap
  (§10 K6 listesiyle birebir). `createLedgerVouchers` `ownedAccounts` verilmeden KURULMAZ (sessiz atlama yok; sunucusuz test araçları açıkça boş küme verir). Kapı ikinci
  katman (N21). Ters kayıt bu denetimden geçmez (asıl fiş geçtiyse aynası da geçer; asılsız düzeltme yolu kapanmasın).
  BAŞ MİMAR KARARI önerisi: 153 (Ticari Mallar) kapsam DIŞI — dönemsel envanterde stokun beklenen bakiyesi yok (Mutabakat'ta satırı yok, kalıcı fark doğmaz) ve kural kitabı
  N-01 (dönem sonu stok değerlemesi) 153'e fişle yazar.
- D4 KISITI (K6'dan): devir açılış fişi (N-13) alt defter hesaplarına (ör. EK-1 "190, 191, 391, 360 K bakiyeleri AYNEN") fişle yazamaz. D4 ya (a) o hesabın açılışını kendi alt
  defterinde yazar (Kasa / banka / cari / evrak açılışı) ya da (b) expected()'e o hesabın fiş satırlarını ekler (bank_lines 360 / 193 deseni) VE yalnız o tür + hesap için
  koruma istisnası kurar (ownedAccounts'tan türetilmiş; elle liste değil). Bu turda devir izni KURULMADI. AYNI KISIT Ç5'e: Kural Farkı Düzeltme Fişi (KG-15) farkı bir alt defter
  hesabında çıkarsa (ör. senet 101 → 121 / 321 türü bir kural değişikliği) fişle yazamaz; Ç5 farkın hesaplarını tasarım notunda yazar, alt defter hesabıysa (b) yolunu kurar.
- D4'ün DÖRT KISITI ((7) A = (b) yolu; dar kontrol E kaydı): (1) silme yolu modül içinde kalır — `withTriggersLifted` dışa açılmaz, D4 dar ve dışa açık tek işlev ekler (ör.
  devir fişlerini kaynağıyla silip yeniden yazan; aynı işlem, iz Değişiklik Geçmişi'nde); (2) canlı dosyada "kilit '' → sil → postAll(K)" kapıda 409 (Kapanmış dönem değişemez;
  dar kontrol p10) → kopyada üret + doğrula + takas ya da kapıya açık, izli devir izni; (3) yeniden yazılan fiş o yılın en büyük + 1 numarasını alır (silinen numaralar boşluk
  bırakır ya da yeniden verilir — numara politikası D4'te yazılı karara bağlanır); (4) `withTriggersLifted` yalnız göç 46 tetikleyicilerini adlarıyla kaldırıp yeniden kurar
  (Ç3'ün donmuş defter tetikleyicileri ayrı adlıdır, etkilenmez).
- postAll lockThrough (madde 6, yeniden üretildi: Elle Onay kipinde PUT 409 bank-pending-before-lock verirken postAll 200 + kalem kilit + 1'e Gecikmeli Aktarım; Otomatik kipte PUT
  kalemi 12.10'a aktarırken postAll aktarmıyordu): kilit İLERLEYECEKSE PUT period-lock ile AYNI ön adım (`routes/ledger.mjs` `beforeLock` → `pos.beforeLock`; 409
  bank-pending-before-lock, `force` geçer) fiş işleminin DIŞINDA, ÖNCE çağrılır. Ön adımın yazımları (vadesi gelmiş POS kalemlerinin aktarımı) kendi işlemlerindedir; fiş işlemi
  sonra düşerse onlar kalır (PUT'ta da öyle). Kilit ilerlemiyorsa (yinelenen kapanış) çağrılmaz. Ç3'ün ortak kilit kancası (`lockChanged`, eşzamanlı kip) korundu.
- K3 SONUCU → 2.5.1 BİLİNEN SINIR: geri yüklemeden sonra, yedekten sonra verilmiş fiş numarası başka fişe yeniden verilir (numara verinin kendisinden; İşlem No kuralıyla
  tutarsız). Fiş numarası ekrana / çıktıya girince (2.5.1) geri yükleme numara kuralı + uyarı; numara politikası mali müşavir + kullanıcı.
- K5 DARALDI (DÜŞÜK-1, sakınca süzgeciyle ORTA — defter kaydı kaybı): açılış onarımı yalnız BU ŞİRKETİN (companyId) "company.reset" izini sayar (001'in dosyası ortak katmandır,
  başka şirketin sıfırlaması oraya da iz yazar) ve yalnız o izden ÖNCE ya da aynı anda yazılmış izsiz fişi kaldırır (an karşılaştırması; saat dilimi ekinden bağımsız); sonra
  yazılmış izsiz fiş, zamanı okunamayan fiş ve kalan bir ters kaydın asıl fişi KALIR (günlükte uyarı, `kept`). Aynı an: yalnız sabit sahte saatte (N18 ve 2.4.9 gerçek kod betiği).
  → TUR 2'DE DEĞİŞTİ (§11b): şirket kuralı aynen kaldı; "önce / sonra" artık an karşılaştırması DEĞİL, yazım sırası (dar kontrol B1: saat geri / ileri alınınca an karşılaştırması
  sıfırlamadan artakalan fişi bırakıyordu).
- Metin alanları (madde 5, yeniden üretildi: ters kayıt ucunda nesne açıklama "[object Object]", dizi "a,b" olarak saklanıyordu): açıklama / kaynak / satır notu yalnız metin ya da
  sayı; aksi 400 `voucher-text` (fiş değişmez → yanlış metin kalıcı olurdu).
- Göç 46 YERİNDE değişti (DÜŞÜK-2, ders 47; 2.5.0 yayımlanmadı): `ledger_voucher_lines_closed` her satırda fişin bütün satırlarını saymıyor (COUNT(*)), iki birincil anahtar araması
  yapıyor (sıra ≤ başlığın satır sayısı; aynı (fiş, sıra) yok). Tam fişte sonuç eski kuralla aynı (dar kontrolün 12 atlatma denemesi + yarım fişin eksik sırası). Fikstürlerde eski
  tetikleyiciyle üretilmiş dosya YOK (104 SQLite fikstürü, en yüksek şema 30; whatsapp-pdf-v248 44). Geliştirme sırasında 46'ya çıkmış dosyalar (yalnız geliştirme / test
  makineleri) eski metni taşır; Şirket Verisini Sıfırla ve onarım tetikleyicileri yeni metinle kurar.
- KANIT (docs/kanit/2026-11-06/c2t1-*): yeniden üretim (ders 6; taban 2ba5ac0b) — K6 6 / 21 kabul (121, 128, 129, 153, 190, 321), K5 p5 001'in fişi kaldırıldı, "[object Object]" saklandı, postAll
  POS ön adımını atladı (c2t1-betik r5 / r6 / p1 / p5). Kırmızı (eski kod ayrı kopyada, yeni testlerle): 12 / 31 beklenen nedenle (K6 iddiası listesi, 400 ≠ 409, nesne 200, O(n²)
  7,3 sn, K5 ×4, POS ×2); MA / MB / MC / MG testleri eski kodda yeşil (davranış doğruydu; dişleri mutasyonla). Yeşil 40 / 40 (fis-defteri-250 + yaşam + koruma) TZ=UTC ve
  TZ=Europe/Istanbul. Mutasyon 30 / 30 beklenen nedenle (Ç2'nin 16'sı + yeni 14: MA, MB, MC, MG, K6 ×2, K5 ×3, tetikleyici ×2, metin, POS ×2). Dar kontrolün 12 atlatma denemesi yeni
  ve eski kodda 12 / 12 engelli. G6: v2.4.9 GERÇEK koduyla üretilen veri (tohum 11, 1.500 işlem) eski ↔ yeni kodla yevmiye / mizan / Defter Mutabakatı 14 / 14 aynı; yeni kodla
  açılış 8 / 8 (göç 46 + 47, yeni tetikleyici metni, kilit izi 2.4.9 = güncel, 121 fişi 400, 8.000 satırlık fiş, Mutabakat). 2.4.9 gerçek kodu eski sürüm betiği 17 / 17
  (şema beklentisi 46 → LATEST_VERSION, G3; taban kodda da 2 / 17 kırmızıydı), Ç3'ün eski sürüm betiği 20 / 20. G2 komşular (203 dosya: değişen dosyaları / API yollarını anan
  testler + kaynak tarayan testler; Ç3'ün donmus-defter-250 / -yasam-250 / -bellek-250, fis-defteri-*, sema-kapisi-bs7 dahil) 2.177 / 2.177 TZ=UTC ve TZ=Europe/Istanbul. e2e 8 / 8
  (sema-kapisi-bs7 12, senaryo-defter-243 24, gg243-banka-kart-aciklama 11, gg244-numara-tarih-onay 40, senaryo-224 69, senaryo-226 22, CI dışı senaryo-213 64, senaryo-banka-210
  424). Kâhin defter 176 / 176, kâhin cari 8.698 / 8.698.
  ÖLÇÜM (aynı girdi, flock; makine yükü 4,5 — başka ajanlar): program yolu (denetim + tam kapı + yazım; eşzamanlı) 16.000 satır 3.669 → 314 ms (olay döngüsü en çok 3.672 → 315 ms),
  8.000 satır 964 → 166 ms, 100.000 satır (yalnız yeni) 1.853 ms (kapı 742 ms; olay döngüsü 1.858 ms); yalnız tetikleyiciler 16.000 satır 3.174 → 57 ms, 100.000 satır 428 ms.
  BİLİNEN SINIR: MAX_LINES (100.000) satırlık tek fiş ~1,9 sn olay döngüsünü tutar (yazım bilerek eşzamanlı — ders 47 son cümle; K7 "kilit koyma ile aynı sınıf").

## 11b. Ç2 TUR 2 (06.11.2026; dar kontrol 06.11 04:58 B1 + B2 — DURMA KURALI; ana oturum KARARI: çift kuralı iki yönlü, kuşkuda ikisi de kalır, zaman karşılaştırması duvar saatinden bağımsız)
- SORUN (B1, sakınca süzgeciyle ORTA; 2.4.9 gerçek koduyla yeniden üretildi, eski kod a7118763): onarımın "fiş sıfırlamadan önce mi" kararı fişin ve sıfırlama izinin `created_at` anını
  karşılaştırıyordu. Saat geri alınınca (asıl fiş 10:00, ters kaydı saat geri alınıp 08:00'de, eski sürüm 09:00'da sıfırlıyor) ters kayıt kaldırılıp asıl fiş KALIYOR ve yeniden etkin
  oluyordu (mizan 590 = 456, Mutabakat Testi ok = true — sessiz); 002'de sıfırlamanın saati fişlerden önce görünürse 3 artakalan fiş kalıyordu (taban 1e68ad05 üçünü de kaldırıyordu).
  Çift kuralı tek yönlüydü (yalnız "kalan ters kaydın asıl fişi kalır").
- KURAL (yazım sırası; `server/lib/ledger-vouchers.mjs` `repairLegacyReset`): yazım sırası aynı tablodaki rowid'dir (satır silinmedikçe sonraki eklemenin rowid'i büyüktür; journal()
  da aynı günü bununla sıralar — ders 31). Eski sürümün sıfırlaması işlem geçmişini BÜTÜNÜYLE siler, sonra izini yazar; programda işlem geçmişinden tek satır silen yol yoktur. Buna göre:
  1. Bu şirketin EN SON (rowid'i en büyük) "company.reset" izi kalan her fiş izinden ÖNCE yazılmış olmalı; değilse iz işlem geçmişini silmemiştir → hiçbir izsiz fiş kaldırılmaz
     (`reset-without-wipe`).
  2. İzi duran ilk fiş (fiş tablosunda rowid'i en küçük izli fiş) sıfırlamadan SONRA yazılmıştır. Ondan ÖNCE yazılmış izsiz fiş sıfırlamada izini yitirmiştir → kaldırılır; ondan SONRA
     yazılmış izsiz fiş sıfırlamanın konusu değildir → kalır (`after-traced`). İzli fiş yoksa her izsiz fiş sıfırlamadan öncedir (taban davranışı).
  3. ÇİFT KURALI İKİ YÖNLÜ: asıl fiş ve ters kaydı birlikte kalır ya da birlikte kaldırılır; biri kalıyorsa (kuşkulu ya da izli) öbürü de kalır (`pair`; zincir varsa her halkası, sabit
     noktaya kadar). Yazım sırası doğruyken (ters kayıt asıl fişten sonra) 2. kural iki yönü zaten tutarlı verir; iki yönlü kapanış, sıra bozuk dosyada (elle rowid) ikinci emniyettir.
  4. Şirket kuralı (tur 1) aynen: yalnız bu dosyanın şirketinin (companyId) sıfırlama izi sayılır; yoksa hiçbir fiş kaldırılmaz (`no-reset`).
- KUŞKU DURUMU — sessiz değil: kaldırılmayan her izsiz fiş Mutabakat Günlüğü'ne "repair" kaydı (ledger_vouchers; "Fiş defteri: işlem geçmişinde izi olmayan N fiş kaldırılmadı;
  … kesinleşmedi (neden). Kuşkuda fiş kalır: Fiş 2027-000002."; ayrıntıda kimlikler ve nedenler) olarak düşer; içerik belirlenimci olduğundan aynı küme için ikinci kez yazılmaz (her
  açılışta yinelenmez). Kayıt Mutabakat Testi yanıtının günlüğünde ve Mutabakat Günlüğü raporunda ("Açılış Onarımı") görünür. Mutabakat Testi'nin ok'u değişmez (kalan fiş kullanıcının
  silebileceği bir şey değildir; ters kayıtla etkisizleştirilir — kalıcı kırmızı çıkmaz olurdu).
- SAAT BAĞIMSIZLIĞI: kararda hiçbir zaman damgası okunmaz (`instantOf` kalktı); saat geri / ileri, saat dilimi eki ve TZ kararı değiştirmez. Zaman yalnız kayıt metninde (sıfırlama anı) görünür.
- BAŞ MİMAR KARARI önerisi (ders 40; kullanıcıya gösterilecek): tur 1'in duvar saatiyle verdiği "sıfırlamadan sonra yazılmış, izi BAŞKA nedenle düşmüş fiş kalır" ayrımı, yazım
  sırasında dayanağı yoksa (izi duran önceki fiş yok) korunamaz: bütün izleri DIŞARIDAN (programın yolu olmadan) silinmiş fiş, eski sürüm sıfırlamasından artakalan fişten ayırt
  edilemez → kaldırılır (taban davranışı). Gerekçe: programda işlem geçmişinden tek satır silen yol yok; gerçek ürün yolunda (2.4.9 sıfırlaması) duvar saati ayrımı artakalan fişi
  bırakıyordu (B1). Ayrımın tek dayanağı duvar saati olduğundan KARAR (saatten bağımsız) bunu dışarıda bırakır. G3: tur 1'in "zaman" ve "saat dilimi eki" testleri bu yüzden kalktı
  (ikisinde de sıfırlama izi yazım sırasıyla fişlerden SONRA eklenmişti; yalnız created_at aralarına konmuştu); aynı iddianın yazım sırasıyla kurulan karşılıkları tur 2 testlerinde.
- BİLİNEN SINIR: (a) yukarıdaki dışarıdan iz silme senaryosu; (b) fiş tablosunun rowid sırası dışarıdan bozulursa (elle rowid) karar kuşkuya düşer — fiş kalır, görünür kayıt (veri
  kaybı yok); (c) VACUUM rowid'leri sırayı koruyarak yeniden numaralayabilir (açık INTEGER PRIMARY KEY yok) — sıra korunduğundan karar değişmez.

## 11c. Ç2 TUR 2 KANITI (docs/kanit/2026-11-06/c2t2-*; her koşu tools/kanit.mjs kos; betikler c2t2-betik/)
- YENİDEN ÜRETİM (ders 6; eski kod a7118763 ayrı kopyada, 2.4.9'un GERÇEK kodu `git archive v2.4.9`; dar kontrolün betikleri k5-saat-ters.mjs, k5-002-v249.mjs; TZ=UTC ve
  TZ=Europe/Istanbul): saat-ters removed 1 / kept 1 (asıl fiş), mizan 590 = 456 / 519 = −456, Mutabakat Testi ok = true (sessiz); 002 saat geri kept 3 / removed 0; 002 saat ileri
  removed 3. YENİ KODDA aynı betikler: saat-ters removed 2 / kept 0, mizan boş; 002 geri removed 3; 002 ileri removed 3 (taban 1e68ad05 ile aynı sayılar) — iki TZ.
- KIRMIZI (ders 7, 38; eski kod a7118763 ayrı kopyada, yeni test dosyası): fis-defteri-koruma-250 16 / 23 — 7 yeni test beklenen nedenle kırmızı, iki TZ: saat geri (removed 1,
  kept [asıl fiş]); 002 saat geri (kept 3); yazım sırası "sonra yazılan kalır" (eski kod duvar saatiyle kaldırdı); işlem geçmişini silmeyen iz (eski kod kaldırdı); çift iki yönlü
  (eski kod ters kaydı kaldırıp asıl fişi bıraktı); geri yükleme + saat geri (kept 3); baş mimar kararı 5 yönü (çekirdek iddia eski kodda da doğru — yön tur 1'de vardı — kırmızı
  yalnız tur 2'nin nedeni / görünür kaydı; dişi mutasyon 31). 002 saat ileri (koruma örneği) ve tur 1'in iki K5 testi eski kodda da yeşil.
- YEŞİL: fis-defteri-250 + fis-defteri-yasam-250 + fis-defteri-koruma-250 46 / 46 TZ=UTC ve TZ=Europe/Istanbul (tur 1: 40; −2 kalkan duvar saati testi, +8 tur 2 testi).
- MUTASYON (test/fis-defteri-250-mutasyon.mjs, `git archive 9ed4b0d6` kopyası): 35 / 35 beklenen nedenle (UTC); yeni ve değişen 9'u (14, 23, 24, 25, 31–35) TZ=Europe/Istanbul'da da
  9 / 9. B2: 31 = baş mimar kararı 5'in çift kuralı (dar kontrolün mut-k5cift.mjs'inin karşılığı; o betiğin sildiği satır tur 2'de yok — kural iki yönlü döngüye taşındı); B1: 32 çift
  tek yöne döner, 25 duvar saati geri gelir, 24 yazım sırası denetimi yok, 33 işlem geçmişini silmeyen iz, 34 görünür kayıt yok, 35 kayıt yinelenir.
- G6 (2.4.9 gerçek kodu): fis-defteri-eski-surum-250 17 / 17 ve donmus-defter-eski-surum-250 20 / 20, iki TZ.
- G2 KOMŞULAR: 128 test dosyası (test/ taranarak: ledger-vouchers / fiş uçları / voucherRepair, şirket sıfırlama / geri yükleme / company.reset, integrity_log / Mutabakat Günlüğü / ledger/integrity anan testler + kaynak tarayan genel testler + fis-defteri-*, donmus-defter-*, sema-kapisi-bs7): TZ=UTC 1.454 / 1.454; TZ=Europe/Istanbul 1.453 / 1.454 — tek kırmızı banka-210-rapor-is-parcacigi-kapanis H2 ("sorgusu süren iş parçacığı yuvada: 0"; rapor iş parçacığının zamanlama testi, fiş defterine dokunmaz; makine yükü 8–11): dosya tek başına yeni kodda ve eski kodda (a7118763) iki TZ 5 / 5 yeşil (c2t2-rapor-is-parcacigi-*) — ilgisiz zamanlama kırmızısı, zorla üretilmedi (DOĞRULANMADI).
- e2e: sema-kapisi-bs7 12 / 12.
- WINDOWS (ders 48): yeni K5 testleri kapalı sunucunun dosyasını ayrı bağlantıyla değiştirir (işlem geçmişi silme, elle fiş / iz ekleme, açık rowid) ve 001'i yedekten geri yükler
  (dosya takası) — ilk gönderimde CI'nin Windows işlerinde görülmeli.
- YAN BULGU (kapsam dışı, DEĞİŞTİRİLMEDİ — c2t2-yan-onarim-detay-kesik): onarımın "kaldırıldı" kaydının ayrıntısı `JSON.stringify(...).slice(0, 20000)` ile kesiliyor; ~470'ten çok
  fiş birlikte kaldırılınca (600 ile üretildi) geçersiz JSON kalır ve Mutabakat Testi HTTP 500 verir (routes/ledger.mjs günlüğü JSON.parse eder; kayıt son 50 günlük satırı arasında
  kaldıkça). Satır Ç2'den (9569ff76) beri aynı; tur 2'nin yeni "kaldırılmadı" kaydı listeyi 50 kimlikle sınırlar (geçerli JSON).
