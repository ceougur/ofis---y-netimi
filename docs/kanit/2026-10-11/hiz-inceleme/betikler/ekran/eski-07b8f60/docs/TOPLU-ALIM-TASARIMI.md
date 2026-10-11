# Toplu alım (Cari · Stok · Taksit) — tehdit analizi, mimari ve çökme senaryosu

Sürüm 2.0.6. Bu belge, Excel / Google Sheets / açık tablodan yapılan toplu alımın (cari, stok, taksit kartı) üç aşamalı
denetim döngüsünü kayda geçirir: hangi uç durumlarda patlar, akış bunları nasıl yutar, çökme anında veri nasıl korunur.
Kod: `server/lib/import-gate.mjs`, `server/routes/accounts.mjs`, `server/routes/stock.mjs`, `server/routes/plans.mjs`,
`server/lib/sheets.mjs` (`readSheetMatrices`), `server/lib/db.mjs`. Kanıt: `test/accounts-stock.test.mjs`,
`test/import-crash.test.mjs`, `denetim/yuk-testi-100bin-cari-stok.txt`.

## Aşama 1 — Tehdit ve hata analizi (uç durumlar)

| # | Uç durum / veri kirliliği | Sonuç engellenmezse | Karşılığı |
|---|---|---|---|
| 1 | Başlık satırı ilk satırda değil (üstte başlık/boş satırlar) | Kolonlar kayar, adlar telefon olur | `findHeaderRow`: ilk 30 satırda tanınan başlık rolü (ad, telefon, birim…) en çok olan satır başlık; "Servis Listesi \| 01.09.2026" gibi üst satırlar rol taşımadığı için elenir; tek kolonlu liste de yüklenir; kullanıcı eşlemeyi görür |
| 2 | Başlıklar bozuk/İngilizce/kısaltma ("Tel.", "GSM", "Kişi") | Kolon tanınmaz, veri ek alana düşer | Başlık kuralları + **değere göre eşleme** (telefon/e-posta/tarih/birim deseni ≥ %70) |
| 3 | Görünmez karakter (sıfır genişlik, NBSP, BOM), `#N/A`, `#YOK` | "Ali Veli" ile "Ali Veli​" iki cari; `#YOK` adres | `sanitizeCell` her hücreyi temizler; Excel hata değeri boş sayılır |
| 4 | Excel seri tarihi (45000), "15/9/2026", "Eylül 2026", Date nesnesi | Kayıt tarihi bozuk ya da bugün | `parseDay` hepsini ISO'ya çevirir; okunamazsa **uyarı** + bugün |
| 5 | Tutar "1.250,50", "1250.5", "₺ 3.000", "40.000 TL", "çok" | Yanlış bakiye / çökme | `parseAmount`; okunamayan → uyarı, bakiye yazılmaz (sıfır uydurulmaz) |
| 6 | Miktar "12,5", "3 kg", "1.250" | Stok yanlış | `parseQty`; okunamayan → uyarı, açılış stoku yazılmaz |
| 7 | CSV'de virgüllü tutar tırnaksız (kolon kayması) | Fiyat kritik seviyeye kayar | Sheets export CSV'si böyle alanları tırnaklar; kapı raporu kaymayı "okunamadı" uyarısıyla görünür kılar |
| 8 | Adı boş satır, tamamen boş satır, "TOPLAM" satırı | Boş cari / sahte cari | Boş satır sayılır ve atlanır; ad boş → **hata**, alınmaz |
| 9 | Aynı kişi dosyada iki kez | Çift cari | Dosya içi tekrar (ad+telefon ≥7 hane / kod+ad+birim) → uyarı, ikinci satır atlanır; telefonsuz aynı ad "ayrı cari açılır" diye uyarılır (sunucu kuralıyla bire bir) |
| 10 | Aynı kişi veritabanında zaten var (ikinci yükleme, güncel liste) | Çift cari, bakiye ikiye katlanır | Kesin eşleşme: aynı tablodaki kayıt → aynı Cari No **ve** ad → aynı ad + telefon (≥7 hane, tekil); `mode: skip` (varsayılan) ya da `update` (bakiye yeniden yazılmaz) |
| 11 | Farklı iki kişi aynı ad (telefonsuz) | Birleşirse başkasının borcu | Telefonsuz aynı ad **birleşmez**; yeni cari açılır (şüphede ayır) |
| 12 | Cari No çakışması (Excel'deki S.N 1..N, mevcut cariler 1..M) | Numara başkasına gider / UNIQUE hatası | `freeRef`: numara doluysa sıradaki boş numara (`autoRef` sayacı, tarama yok); `renumbered` raporlanır |
| 13 | 100 bin+ satır | Bellek, zaman aşımı, tarayıcı donması | Gövde 40 MB, `MAX_IMPORT` 250 bin (`truncated` raporu), tek işlem; atlanan satır listesi 500 ile sınırlı (`skippedTotal` tam); liste sunucuda sayfalanır |
| 14 | Google Sheet paylaşılmamış / silinmiş / yanlış bağlantı | Belirsiz hata | `readSheetMatrices`: 401/403/404 → "Paylaş → Bağlantıya sahip herkes"; zaman aşımı → açık mesaj; başka alan adına istek atılmaz (SSRF yok) |
| 15 | Yükleme ortasında elektrik kesilmesi / kapatma | Yarım liste, bozuk dosya | Tek `BEGIN IMMEDIATE … COMMIT`; WAL + `synchronous=FULL`; yarım işlem yeniden açılışta geri alınır (test: `import-crash`) |
| 16 | İki kullanıcı aynı anda yükler | Kilit, çift kayıt | SQLite yazma kilidi + `busy_timeout` 10 sn; işlemler sıralanır; eşleşme her işlemde veritabanından okunur |
| 17 | Personel rolü toplu yükleme yapar | Yetkisiz veri | `accounts.manage` / `stock.manage` / `plans.manage`; Sheets okuma da aynı yetkilerle |
| 18 | Salt okunur mod (lisans süresi doldu) | Veri yazılır | `license.assertWritable` her POST'u keser |
| 19 | Toplu taksitlendirmede açık kartı olan cari | Çift plan, çift borç | `skipExisting` varsayılan açık; atlananlar raporlanır |
| 20 | Toplu taksitte tutar alanı boş / "yok" | Sıfırlık kart | Alanı boş cari atlanır ve raporda yazılır |
| 21 | Ay sütunlu matris (Ocak–Aralık) | Boş aylar satır olarak saklanır | Saklanmaz: vade `computeDues` ile istek anında hesaplanır; taksit modülü satır bazlı defter (yalnız tanımlı taksitler) |
| 23 | Excel'deki "S.No" stok koduna düşer; mevcut ürünün kodu 1 | Başka ürünün kartı ezilir | Kod tek başına kimlik değil: aynı kod **ve** aynı ad → aynı ürün; değilse yeni ürün |
| 24 | Silinen carinin numarası bu arada başka cariye verildi; cari Silinenler'den geri geldi | İki carinin aynı numarası | Geri yüklemede numara doluysa sıradaki boş numara verilir (`renumbered` işlem geçmişine yazılır) |
| 25 | Kayıt kartından "Tahsilat", kayıt cariye bağlı ama taksit kartı yok | Kasa'ya girer, cari borçlu kalır; caride ikinci kez alınırsa Kasa'da çift | Kayıt cariye bağlıysa tahsilat cari defterine yazılır (Taksite yaz / Taksit dışı seçici) |
| 26 | Personel yalnız miktar girerken birim fiyat gönderir | Ürün fiyatı ve stok değeri yetkisiz değişir | Ürünün son birim fiyatı yalnız `stock.manage` yetkisiyle güncellenir |
| 27 | Kartta gecikmiş yanıt (A'nın ✕ yanıtı B açıkken gelir) | B'nin kartında "+ Tahsilat" A'ya yazar | İstek bileti + kimlik denetimi: yalnız açık kartın yanıtı uygulanır; listeye dönüldüyse eski kart geri gelmez |
| 22 | Saat dilimi / yaz saati | Yanlış "vadesi geçti" alarmı | Gün farkı `Date.UTC(y,m,d)` tam sayı aritmetiği; "bugün" ofisin yerel takvim günü; test `TZ=Europe/Istanbul` |

## Aşama 2 — Akış (mimari)

```
[Excel dosyası] ─ tarayıcı işçisi (hof-excel-worker) ─┐
[Google Sheets] ─ sunucu readSheetMatrices ───────────┼─► hücre matrisi (Ingestion, bellek sınırlı)
[Açık tablo]    ─ HOF.data.rows (+ kayıt kimlikleri) ─┘
        │
        ▼  POST …/import/preview { matrix [, roles] }
   Sanitization ── sanitizeCell (görünmez karakter, NBSP, Excel hatası, Date→ISO)
        │
   Semantic mapping ── mapAccountHeaders / mapStockHeaders (başlık) → inferRolesByValues (değer)
        │
   Validation gate ── validateRows: satır × kolon → error | warning; ready/errors/warnings/empty; 500 örnek
        │              (kullanıcı eşlemeyi değiştirir → kapı yeniden hesaplanır; hata varken de yükleyebilir, hatalı satırlar alınmaz)
        ▼  POST …/import { matrix, headerAt, roles, mode, … }
   Load ── store.tx(() => { her satır: temizle → eşle → doğrula → eşleşme ara (indeks) → INSERT/UPDATE })  ── tek işlem
        │        hata/çökme → ROLLBACK (hiçbir satır kalmaz)          başarı → COMMIT (fsync, synchronous=FULL)
        ▼
   Rapor { created, updated, skipped[≤500], skippedTotal, balances, linked, renumbered, truncated } → SSE ile açık ekranlar tazelenir
```

Cari defteri satır bazlıdır: `account_entries` (borç/alacak/tahsilat/ödeme), `plans` + `plan_items` + `plan_entries`
(yalnız tanımlı taksit ve gerçek hareket). Kasa bu kaynakları okur, ayrıca yazmaz (çift kayıt yok).

## Aşama 3 — Çökme anında veri (kod ve kanıt)

`server/lib/db.mjs`: `PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;` — her COMMIT diske işlenir; WAL dosyası
yarım kalırsa SQLite yeniden açılışta tamamlanmamış işlemi atar. `store.tx(fn)`: `BEGIN IMMEDIATE` → `fn()` → `COMMIT`;
`fn` fırlatırsa `ROLLBACK`; iç içe çağrıda `SAVEPOINT`. Yükleme yolu (`routes/accounts.mjs` `import`): tüm satırlar tek
`store.tx` içinde; doğrulama hatası `HttpError` fırlatır → geri alınır; süreç öldürülürse işlem hiç COMMIT görmez.

Kanıt (`test/import-crash.test.mjs`): ayrı süreç 200 bin satırlık işleme başlar, 20 bininci satırda `SIGKILL` ile
öldürülür; yeniden açılışta `PRAGMA integrity_check = ok`, yarım işlemden 0 satır, önceki veri yerinde, program aynı
veritabanıyla açılır ve yükleme baştan yapılır. Göç öncesi tam yedek (`runMigrations`) ayrıca durur.
