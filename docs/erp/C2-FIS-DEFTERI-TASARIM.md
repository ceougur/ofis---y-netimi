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
| Eski sürüm (BS-7, 2.4.9 göç etmiş 46 dosyayı yazılabilir açar) | Fişlere UPDATE / DELETE yapamaz (tetikleyici). Kendi Şirket Verisini Sıfırla'sı hareketleri ve işlem geçmişini siler, fişlere dokunamaz → fişler sıfırlanmış verinin üstünde artakalır. 2.5.0 açılışında `repairLegacyReset`: izi ("ledger.voucher.created") olmayan fiş + işlem geçmişinde "company.reset" → aynı işlemde kaldırılır, Mutabakat Günlüğü'ne "repair" ve işlem geçmişine yazılır (eski sürümün sıfırlama öncesi yedeği fişleri taşır). Sıfırlama izi yoksa dokunulmaz, yalnız günlükte uyarı |
| Eski sürüm kilidi açıp kapanış fişinin altındaki veriyi değiştirirse | BİLİNEN SINIR (2.5.0'ın kendisinde de kilit açılınca aynı): kapanış fişi bayatlar; Ç3 (donmuş defter ↔ güncel türetme farkı, "Kural Değişikliği Farkı") görünür kılar |

## 9. Nasıl bozulur? (önce yazıldı; testler bu listeden — test/fis-defteri-250.test.mjs, test/fis-defteri-yasam-250.test.mjs)
N1 dengesiz fiş · N2 sıfır / iki taraflı / eksi / kesirli satır · N3 planda olmayan hesap, yabancı alt hesap, cari kontrol dışı · N4 aynı istek kimliği (aynı içerik → aynı fiş;
farklı → 409) · N5 eşzamanlı iki süreç aynı kimlik → tek fiş · N6 kilitli tarihe fiş / ters kayıt 409 · N7 ileri tarih 400 · N8 UPDATE / DELETE / INSERT OR REPLACE / kapanmış
fişe satır → tetikleyici · N9 ters kaydın ters kaydı, aynı fişin iki ters kaydı (eşzamanlı HTTP dahil), asıl tarihten önce ters kayıt · N10 ters kayıt sonrası mizan sıfır,
iki madde de yevmiyede · N11 süreç öldürme ve disk dolu → yarım fiş yok · N12 fişsiz yevmiye / mizan / Defter Mutabakatı birebir (eşdeğerlik) · N13 aynı gün sırası (açılış başta,
kapanış sonda, ters kayıt asıl sınıfta) · N14 kapanış + kilit aynı işlemde (biri düşerse ikisi de yok) · N15 iki şirket karışmaz · N16 yedek → geri yükle · N17 Sıfırla (iki kip;
tetikleyiciler geri kurulu) · N18 eski sürüm sıfırlaması → açılış onarımı · N19 göç (fikstür + v2.4.9) · N20 31.12 / 01.01 (numara yılı, sıra, devir kolonu) · N21 kontrol
hesabına fiş → kapı 409 · N22 store dışı silme → tam tarama "Kapanmış dönem" · N23 yetki (system.manage; Muhasebe 403).

## 10. BAŞ MİMAR KARARI ÖNERİLERİ (ders 40; kullanıcıya gösterilecek)
- K1 Sınıf ayrı kolonda (`journal_class`), türden türetilir ama closing türü `period-end` de alabilir: kural kitabı N-01 (stok değerlemesi) "dönem sonu sınıfı" ve Gelir Tablosu'na
  GİRER; N-02…N-07 kapanış sınıfı ve GİRMEZ (§4) — tek "closing" türü ikisini ayıramazdı. Ters kayıt asıl fişin sınıfını alır (kapanışın tersi de Gelir Tablosu dışında kalır).
- K2 Ters kaydın ters kaydı yapılmaz; asıl fiş yeniden yazılır (zincir yok; yaygın uygulama).
- K3 Numara yıl içinde müteselsil ve boşluksuz, verinin kendisinden: sıfırlamadan sonra 1'den, geri yüklemede yedeğin devamı (yaygın muhasebe programlarında fiş numarası
  veriyle döner). İşlem No'dan (dışarıya basılan, hiç yeniden kullanılmayan) bilerek farklı.
- K4 İleri tarihli fiş yok (programın genel hareket kuralı). Ters kayıt tarihi verilmezse asıl fişin tarihi (KDV mahsubu Geri Al ile aynı gün kuralı).
- K5 Eski sürüm sıfırlamasından artakalan fiş açılışta kaldırılır (kullanıcının sıfırlama iradesinin tamamlanması; iz + Mutabakat Günlüğü; sıfırlama izi yoksa dokunulmaz).
- K6 Cari boyutlu fiş satırı yalnız cari hesaplarında; kontrol / alt defter hesaplarına (100, 101, 102, 103, 108, 120, 121, 127, 128, 129, 190, 191, 193, 300, 309, 320, 321, 336,
  360, 391) yazan fiş Defter Mutabakatı farkı verir ve kapıda geri alınır — beklenen bakiyeler (expected) fişleri OKUMAZ (alt defter değiştirmeyen fiş o hesaba yazılmaz).
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
  kaynaklı fişleri silen dar bir yol (tetikleyici kaldırma, aynı işlem, iz) — Ç2 (b)'yi KURMADI; karar D4'ten önce (öneri a; KULLANICIYA SORULMALI listesinde). Devri Geri Al
  dosya takasıyla: fiş numaraları devir öncesi dosyanınkinden sürer (K3).
