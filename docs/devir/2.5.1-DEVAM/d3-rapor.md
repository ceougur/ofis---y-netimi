# D3 raporu — devir saf hesabı + Devir Raporu + ön denetim (2.5.1)

Ajan: D3 KOD ajanı (high), 27.11.2026. Taban `t251-taban` (64396478). Tasarım: `docs/devir/D3-D4-TASARIM.md` §3 (ana ağaçtan okundu; bu ağaca KOPYALANMADI).
Son hâl (27.11.2026). D3 HİÇBİR ŞEY YAZMAZ: plan + ön denetim + Devir Raporu + yalnız okuyan ön izleme uçları.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı; testler buradan)

Kaynak: DEVIR-PLANI §8 (1–16), G10 (17–28), tasarım notu §3.11 (29–42). D3 HİÇBİR ŞEY YAZMAZ: yazım / takas / arşiv / ekran maddeleri D4 / D5'in testidir; D3'te
karşılığı "planın o durumda doğru sayı / doğru madde / doğru ön denetim maddesi vermesi"dir. Test adları koddan önce planlanan adlardır; son hâli §4: "devir-d3-onden" maddeleri `test/devir-d3-plan.test.mjs`'in "D3 ön denetim" bölümünde, "sınıflama" aynı dosyanın son bölümünde, "kesinti / iki şirket / 001" `test/devir-d3-uc.test.mjs`'te, "gerçek veri" `test/devir-d3-gercek-veri.mjs`'te.

| # | Bozulma | D3'te karşılığı | Test (planlanan) |
|---|---|---|---|
| 1 | Aralık faturası Ocak'ta tahsil edilmiş (bağlı ödeme K sonrası) | ≤K kuyrukta fatura AÇIK kalem; K sonrası bağ `links[]`'de açık kalemin devir kimliğine yönelir | devir-d3-plan (bağ yönlendirme) |
| 2 | Kısmi ödenmiş fatura + FIFO serbest tahsilat | açık kalem = kuyruğun kalanı; net satır = K bakiyesi − Σ açık kalem (çift sayım yok) | devir-d3-plan (elle) + devir-d3-esdeger |
| 3 | Taksit kartına bağlı fatura, kısmi taksit, avans, Kasa Dışı açılışlı kart | kartın tükettiği kalem açık kalem DEĞİL; kart `plans[]`'de (≤K tahsilat tek açılış); avans net satırda | devir-d3-plan (kart) |
| 4 | Çek: portföy / tahsilde / ciro / karşılıksız; K sonrası tahsil | K'deki durum ≤K olaylardan; durum bazında adet + tutar; karşılıksızın cari borcu açık kalem | devir-d3-plan (çek) |
| 5 | POS valörü K sonrası; kredi kartı borcu; Devir Kapanışı yapılmış hesap | 108.NN / 309.NN / 300.NN K bakiyesi alt hesap boyutunda; 102.00 / 108.00 dahil | devir-d3-plan (banka) |
| 6 | Eksi stok, sıfır stok, silinmiş ürün | açılış miktarı = K miktarı (eksi dahil), değer 0; sıfır / silinmiş üründe açılış YOK (S207 = A; §8.6'nın "153'te kalır"ı ESKİDİ — sınanmaz) | devir-d3-plan (stok) |
| 7 | Aynı adlı iki cari; pasif cari; bakiyesi 0 ama açık kalemli (+/−) cari | kimlikle ayrılır; bakiyesi 0 + açık kalemsiz → satır YOK; bakiyesi 0 + ters yönlü kalemler → kalemler + toplam satırları | devir-d3-plan (M12) |
| 8 | İade faturası, mahsup, KDV Mahsup, Vergi Ödemesi, şüpheli | 191 / 391 dönem boyutu, 360, 128 / 129 (M13: aynı tutar iki kez taşınmaz) | devir-d3-plan (KDV, şüpheli) |
| 9 | K'de (31.12 23:59) / K+1'de (01.01 00:00) kayıt; sahte saat; Şubat'ta devir | sınır günü kuyruk ve sayımda doğru tarafta; iki TZ | devir-d3-zaman |
| 10 | İki kullanıcı yazıyor; yarıda kesilme | ön izleme salt okuma; iş parçacığı öldürülünce veri aynı | devir-d3-uc (kesinti) |
| 11 | Geri Al → yeniden devir; güncelleme → arşiv | D4 | DENENMEYEN (D4b) |
| 12 | İki şirket; yalnız seçilen | 002'nin planı 001'in verisini saymaz; 001'de ortak katman budama sayısına girmez | devir-d3-uc (iki şirket) |
| 13 | Eski sürüm verisi | v2.5.0 GERÇEK koduyla üretilmiş veride plan + değişmezler | devir-d3-gercek-veri |
| 14 | e-Belge bekleyen gönderim | ön denetim DURDURUR | devir-d3-onden (e-Belge) |
| 15 | Arşivde yazma ucu | D4 / D2 | DENENMEYEN (D4b) |
| 16 | Şemadaki her tablo sınıflamada | planın budama listesi tasarım §2 sınıflamasıyla; şemada olup listede olmayan tablo testte kırılır | devir-d3-plan (sınıflama) |
| 17 | 001'de devir, güncelleme denemesi, mobil 503 | D4 | DENENMEYEN (D4b) |
| 18 | Devir öncesi yedeğin geri yüklenmesi | D4 | DENENMEYEN (D4b) |
| 19 | ≤K Listeden Sil'inmiş e-Belge | ön denetim DURDURUR | devir-d3-onden |
| 20 | Aralık KDV mahsubu devirden sonra | ön denetim UYARIR (Aralık mahsubu yapılmamış); dönemi ≤ Aralık 191 / 391 planda dönem etiketiyle | devir-d3-onden + devir-d3-plan (KDV) |
| 21 | Gelen kutusu Aralık belgesi | D4 (einvoice_inbox DOKUNULMAZ — sınıflamada) | DENENMEYEN (D4b) |
| 22 | Aktif tekrarlayan faturanın ≤K şablonu | planın `repeats[]` listesi + UYARIR | devir-d3-onden |
| 23 | Ocak'ta Aralık iadesi | D4 / D5 | DENENMEYEN |
| 24 | Devri Yenile | D4c | DENENMEYEN |
| 25 | Eski sürüme dönüş | D4 | DENENMEYEN |
| 26 | Arşiv klasörü silinmiş | D2 / D4 | DENENMEYEN |
| 27 | edoc_usage / inbox / audit / integrity_log korunur; trash seçici | budama listesinde DOKUNULMAZ; trash yalnız para kalemi | devir-d3-plan (sınıflama) |
| 28 | Bekleyen POS kalemi; tahsildeki çek; açık şüpheli | plan satırları (108.NN, 101.02 / 121.02, 128 / 129) | devir-d3-plan |
| 29 | İki satırlı seçenekte Alacak Toplamı gecikmiş kalemi kapatır | planda iki satır + `kuyrugaGiren` net (BAŞ MİMAR KARARI); devirsiz eşdeğer: iki seçenek × gecikmiş kalem | devir-d3-esdeger |
| 30 | Vadesiz açık kalem K+1'de vadesini kaybeder | açık kalemin vadesi = asıl vade, vadesizde asıl belge günü | devir-d3-plan + devir-d3-esdeger |
| 31 | Ödeme Sözü taşınmaz | açık kalemde `beklenenTarih` | devir-d3-plan |
| 32 | Kapalı / Borçta Kalsın kart; KG-5 Excel kartı; fatura kartı | kapalı kart da tek açılış; Borçta Kalsın kalanı açık kalem; kart taşıdığı kalemi açık kaleme koymaz | devir-d3-plan (kart) |
| 33 | Açık şüpheli kendi ≤K tarihinde madde üretir | D4a (≤K türetme kapalı); D3'te 128 / 129 N-12 açılışı + CH açık kalemlerinden şüpheli payı düşülmüş | devir-d3-plan (şüpheli) |
| 34 | Dönemi Ocak olan Aralık alışı | 191 açılışı dönem etiketiyle (Ocak) | devir-d3-plan (KDV) |
| 35 | 102.00 / 108.00 ve Devir Kapanışı yapılmış hesap | alt hesap K bakiyesi taşınır (değişmez 2) | devir-d3-plan (banka) |
| 36 | KG-16 "Açılış Olabilir" onay bekleyen aday | ön denetim DURDURUR (S-2 = A) | devir-d3-onden |
| 37 | Kural Değişikliği Farkı düzeltilmemiş | ön denetim DURDURUR (S-3 = A) | devir-d3-onden |
| 38 | Ön izlemeden sonra kayıt girilir | sonuçta `dataVersion`; kayıt girilince değişir | devir-d3-uc |
| 39 | Aynı veride iki ön izleme; sürerken sıfırla / geri yükle | aynı şirkette tek iş (ikinci istek sürenin kimliği); belirlenimli (iki koşu bayt bayt) | devir-d3-uc |
| 40 | Ön izleme sürerken bakım kipi | sonuç "bayat" işaretli | devir-d3-uc |
| 41 | Silinmiş ürünün K miktarı | açılış yok (S207 = A) | devir-d3-plan (stok) |
| 42 | 001'de ön izleme | budama sayıları users / roles / sessions / mobile_* saymaz | devir-d3-uc |

## 1. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

Ekran YOK (D5). Var olan HİÇBİR yolun yanıtı değişmedi (kabul A: kâhin defter / cari tabanda ve sonda aynı — §6); yeni olan yalnız yönetim uçları:

| Uç (yalnız `system.manage`; ortak katman — HUB_ONLY `admin/devir`) | Önce | Sonra |
|---|---|---|
| `POST /api/admin/devir/preview` `{ company, cutoff, option }` | 404 | 200 `{ id, state: "running", … }` (iş parçacığında başlar; aynı şirkette süren iş varsa aynı kimlik + `joined: true`); K 31.12 değil → 400 `DEVIR_K_31_ARALIK`; geçmiş yıl değil → 400 `DEVIR_K_GELECEK`; seçenek → 400 `DEVIR_SECENEK`; Muhasebe / Personel 403, oturumsuz 401 |
| `GET /api/admin/devir/preview/:id` | 404 | `{ state: running / done / failed, asama, stale, result: { plan, onDenetim, rapor, zamanlama } }` |
| `GET …/preview/:id/report.pdf`, `report.xlsx` | 404 | Devir Raporu (ekran = PDF = Excel: aynı 6 kolon, aynı satırlar; bölümler Hesaplar · Kapanış · Modüller · Hareketler · Listeler; her bölümde TOPLAM satırları) |

Örnek sayılar (test ÖRNEK A, K = 31.12.2026, 2025 kapanmamış): Önceki Yıl Sonucu Fişi (2025) B 600 1.000,00 / A 770.90 50,00 · A 153 300,00 · A 570.2025 650,00; N-01 B 621 / A 153 100,00;
N-04 → 690 50,00 (691 hariç); N-06 B 690 / A 692 50,00 + B 692 / A 691 10,00; N-07 B 692 / A 590 40,00; N-13 A 570.2025 650,00 · A 590 40,00 / B 519 690,00. Cari C1 (K bakiyesi 700,00):
"Devir — Borç Toplamı" 500,00 · "Devir — Alacak Toplamı" 500,00 · açık kalem "Devir: SAT-1 (01.05.2025)" 700,00 vade 01.05.2025 (kuyruğa giren net 0).
`server/app.mjs`: YALNIZ bağlama satırı (`registerDevirRoutes(..., appFor: company => appFor(company))`).

## 2. DEĞİŞEN DOSYALAR

YENİ: `server/lib/devir/plan.mjs` (saf plan, `DEVIR_DECISIONS`, `checkCutoff`), `plan-reader.mjs` (tek okuma işleminde olgular; `DEVIR_TABLE_CLASSES` — 86 tablo), `preflight.mjs`, `report.mjs`,
`plan-worker.mjs`; `test/devir-d3-plan.test.mjs`, `devir-d3-esdeger.test.mjs`, `devir-d3-uc.test.mjs`, `devir-d3-zaman.test.mjs`, `test/fixtures/devir-d3-esdeger.mjs`,
`test/devir-d3-gercek-veri.mjs`, `test/devir-d3-mutasyon.mjs`, `test/devir-d3-hacim.mjs` (CI dışı betikler). DEĞİŞEN: `server/routes/devir.mjs` (yalnız EK ön izleme uçları),
`server/app.mjs` (bağlama satırı). OKUNAN, DEĞİŞTİRİLMEYEN (dışa açılan işlev YOK): `obligation-queue.mjs` (buildObligations), `obligation-input.mjs` (ledgerLines / settleTables /
obligationExtras / batchSettleInput / withExtras), `financial-statements.mjs` (balanceSheet, incomeStatement, closingDayOf), `stock-valuation.mjs`, `general-ledger.mjs`
(reconcile, trialBalance), `routes/ledger.mjs` (build / book / expected / snapshots), `doubtful-gl.mjs` (allocateDoubtful — zaten dışa açık), `bank/doubtful.mjs`
(doubtfulRows / doubtfulCredits — zaten dışa açık), `ledger-opening.mjs` (ruleDiffCorrectionPlan / Year, postedRuleDiffCorrections — zaten dışa açık).

## 3. TARAMA tablosu (ders 10 — komşular `git grep` ile; kaynak tarayan testler)

Değişen kod yalnız YENİ modüller + `routes/devir.mjs` ekleri + `app.mjs` bağlama satırı. Komşu listesi: `git grep -l "obligation-queue|financial-statements|stock-valuation|routes/devir|lib/devir/|ledger-snapshots|registerDevirRoutes" -- 'test/*.test.mjs'`
(33 dosya: c6h-* 13, tyk-* 9, donmus-defter-* 4, devir-d2-* / devir-arsiv-wal 5, obligation-input-250, supheli-kuyruk-defter-250, db-tx-kayip-250) + kaynak tarayan / statik 8 dosya
(yazim-duzeni, lisans-servisi-izolasyonu, platform-tasinabilirlik, banka-210-post-statik, banka-210-statik, banka-210-yetki-matrisi, banka-210-rapor-is-parcacigi-kapanis, sema-kapisi-bs7)
+ D3'ün 4 test dosyası. Taramanın kaçırdığı `test/devir-d2-arsiv-250.test.mjs` (bütün yazma uçlarını tarar — yeni POST ucu girer) ayrıca koşuldu (§6).

| Koşu | TZ | Sonuç |
|---|---|---|
| d3-komsu-utc | UTC | GEÇTİ 485/485, 0 iptal, 0 atlanan (commit 57e482e) |
| d3-komsu-ist | Europe/Istanbul | GEÇTİ 485/485, 0 iptal, 0 atlanan (commit 57e482e) |
| d3-komsu-arsiv-utc / -ist (`test/devir-d2-arsiv-250.test.mjs`) | iki TZ | GEÇTİ 8/8 × 2 |

## 4. Yeni testler — kırmızı nedeni + yeşil (iki TZ)

| Test | Ne sınar | Eski kod (t251-taban kopyası) | Yeni kod |
|---|---|---|---|
| `test/devir-d3-plan.test.mjs` (21) | ELLE hesaplanmış örnekler A / B (kapanış sırası 570.Y → N-01 → N-02 / N-03 → N-04 → N-06 (691 → 692) → N-07, zarar → 591, N-13 yalnız alt defteri olmayan hesaplar, cari satırları M12, iki seçenek, şüpheli M13, kartlar, eksi / silinmiş / sıfır stok, KDV dönem boyutu, carisiz 336.90, modül farkı → DURDURUR), ön denetimin her maddesi (S-2 / S-3 dahil, karar tek yerden B / C), tablo sınıflaması (86 tablo), belirlenimlilik | kırmızı — neden "D3 devir planı modülü yok (eski kod)" / "D3 okuyucu modülü yok (eski kod)" | yeşil (UTC + İstanbul) |
| `test/devir-d3-esdeger.test.mjs` (6) | DEVİRSİZ EŞDEĞER (API verisi): iki seçenek × K'de gecikmiş kalem, vadesiz kalem, Ödeme Sözü, avans, tedarikçi, ödeme rolündeki kalem (tedarikçiye avans, müşteriye iade); elle gecikmiş (01.01 = 500,00 · 11.01 = 500,00 · 01.02 = 1.100,00; C3 300,00); TEHLİKE dişi (toplam satırları kuyruğa ayrı girerse fark VAR); ROL dişi (ödeme kalemi yükümlülük yazılırsa fark VAR); bakiye | kırmızı — "D3 devir planı modülü yok (eski kod)" | yeşil (iki TZ) |
| `test/devir-d3-uc.test.mjs` (10) | yetki 403 / 401, ret 400 kodları, aynı adlı iki cari, K günü / K+1 kaydı, ortak katman sayılmaz, belirlenimli + iş parçacığı = iş parçacığısız (bayt bayt), veri damgası, tek iş (eşzamanlı iki istek), iki şirket, rapor ekran = PDF = Excel + yazım düzeni, bakım kipi → bayat, iş parçacığı öldürülünce veri aynı | kırmızı — "D3 ön izleme yok (eski kod)" | yeşil (iki TZ) |
| `test/devir-d3-zaman.test.mjs` (5) | sahte saat 31.12 23:59 / 01.01 00:00 / 01.01 03:00 (+03:00; beklenen sürecin yerel gününden), Şubat'ta devir, 29.02.2028 (iki yıl geride K dahil) | kırmızı — "D3 devir planı modülü yok (eski kod)" | yeşil (UTC'de 01.01 00:00 → 400 DEVIR_K_GELECEK, İstanbul'da kabul — iki dal da koştu) |
| `test/devir-d3-gercek-veri.mjs` (CI dışı) | v2.5.0 GERÇEK koduyla API'den 14 ay (Ara 2025 – Oca 2027) 001 (300 müşteri + 40 tedarikçi, 3.808 işlem) + 002 (1.288 işlem): sorun yok, 12 değişmez, bayt bayt, DURDURUR yok, iki seçenek aynı, ≤K + >K = toplam, 002 ayrı, devirsiz eşdeğer 4.080 karşılaştırma | — (eski sürüm verisi üretir) | 3 tohum × TZ (7 İstanbul, 11 UTC, 23 İstanbul): 16/16 |

D (görev metni): yeni modülde "eski kodda modül yok" kırmızısı kanıt SAYILMAZ. Dişi taşıyanlar: (b) devirsiz eşdeğer (programın KENDİ tek borç sırasına karşı; iki diş testi
ayrıştığını gösteriyor), (a) elle yazılmış sayılar, mutasyon (§5). Eski kod koşuları: `d3-eski-kod-utc` / `-ist` (ilk hâl, 0/40) ve `d3-eski-kod-son-utc` / `-ist` (son test dosyaları: 0/42 her TZ'de; 84 alt testin HEPSİ beklenen nedenle — 62 "D3 devir planı modülü yok", 20 "D3 ön izleme yok", 2 "D3 okuyucu modülü yok").

## 5. Mutant tablosu (`test/devir-d3-mutasyon.mjs`, `git archive HEAD` kopyasında, UTC)

| # | Mutant | Sonuç | Kırmızı test (örnek) |
|---|---|---|---|
| 1 | açık kalem vadesi K+1 (vadesizde belge günü yerine) | YAKALANDI | cari satırları (M12); devirsiz eşdeğer (gecikmiş) |
| 2 | net formülünde alacak kalemleri ters işaret | YAKALANDI (ilk taramada YAŞIYORDU → Sadece Bakiye sayıları eklendi) | Sadece Bakiyeyi Aktar |
| 3 | toplam satırları netleşmeden kuyruğa (Borç Toplamı tek başına) | YAKALANDI | cari satırları; devirsiz eşdeğer |
| 4 | şüpheli pay açık kalemden düşülmez (M13) | YAKALANDI | şüpheli (M13) |
| 5 | N-01 tutarı SMM yerine DSS | YAKALANDI | kapanış (ÖRNEK B) |
| 6 | 691 → 690 (692 yerine) | YAKALANDI | kapanış fişleri (EK-2 S40 iletisi) |
| 7 | kapanış sırası (önceki yıl fişleri sona) | YAKALANDI | kapanış fişleri |
| 8 | KDV dönem etiketi yok sayılır | YAKALANDI | KDV dönem boyutu (M8) |
| 9 | kartın tükettiği kalem açık kaleme girer | YAKALANDI | kartlar |
| 10 | bakiyesi 0 / sıfır tutarlı satır yazılır | YAKALANDI | cari satırları |
| 11 | S-2: Açılış Olabilir DURDURMAZ | YAKALANDI | her DURDURUR maddesi |
| 12 | S-3: Kural Farkı DURDURMAZ | YAKALANDI | her DURDURUR maddesi |
| 13 | N-13 alt defter hesabına da yazar | YAKALANDI | N-13; değişmezler |
| 14 | eksi stoklu ürüne değer | YAKALANDI | stok; kapanış |
| 15 | kalemin kuyruk rolü kaybolur | YAKALANDI | devirsiz eşdeğer (ROL) |

Son tarama: `d3-mutasyon-son` GEÇTİ 15/15 (commit 57e482e7; taban 25 / 25 yeşil).

## 6. Kabul koşullarının sayıları

- **A** kâhin ↔ program (var olan yolların yanıtı değişmedi): `test:kahin-defter` 187/187 ve `test:kahin-cari` 25.298/25.298 — TABANDA (t251-taban arşiv kopyası) UTC + İstanbul ve SONDA (57e482e7) UTC + İstanbul: 8 koşunun hepsi GEÇTİ, sayılar AYNI.
- **B** komşular iki TZ: §3 (485/485 × 2) + `devir-d2-arsiv-250` 8/8 × 2.
- **C** mutantlar: 15 / 15 yakalandı (§5).
- **D** dişin yeri: §4 son paragraf.
- Gerçek veri (c): 3 / 3 tohum GEÇTİ (§4).

## 7. HIZ tablosu (100 bin; bileşen bileşen) ve B-9

ÖZEL kilit (`flock -x -w 1800 olcum.lock`) 30 dk'da ALINAMADI (ana oturumun tam `npm test` / e2e zinciri ve başka ajanların ölçümleri kilidi tuttu) → **ÖLÇÜLEMEDİ** (görev metni kuralı).
Aşağıdakiler GÖSTERGE: paylaşımlı kilitle, yük 5,5–6 / 4 çekirdek altında (ders 52: yük > 2 → GEÇERSİZ). Veri: `ana-kabul/temiz-100k` kendi kopyam (/dev/shm; 001: 261.326 para satırı —
account_entries 102.295, invoices 34.026, stock_moves 80.136, cash_entries 11.554, cheque_events 20.352, plan_entries 8.162, payments 3.710, fin_events 1.091; 1.484 cari),
K = 31.12.2025, şimdi 08.10.2026 (2022–2024 kapanmamış: 3 önceki yıl fişi).

| Bileşen (iş parçacığı) | tur 1 ms | tur 2 ms |
|---|---|---|
| okuma (toplu SQL) | 1.041 | 945 |
| yevmiye (canlı türetme + karma yevmiye, ≤K) | 3.960 | 4.215 |
| **tek borç sırası (K'de, 1.484 cari)** | **19.201** | **21.893** |
| değerleme | 825 | 698 |
| ön denetim (Defter Mutabakatı + Kural Farkı + sayımlar) | 2.620 | 3.323 |
| plan (kapanış + açılışlar + değişmezler) | 3.182 | 2.647 |
| rapor (14.244 satır) | 390 | 463 |
| **toplam** | **31.219** | **34.184** |
| uç baştan sona | 33.812 | 36.310 |
| olay döngüsü en çok (ana iş parçacığı) | 248 | 436 |

B-9 (aynı veri, ana iş parçacığında, ölçüm penceresi dışında): tam Bilanço (`balanceSheet`) **1.038 ms**, hesap bazında mizan (`trialBalance`) 91 ms, K yılının Gelir Tablosu 133 ms,
plan 2.365 ms (122.663 madde).
**B-9 ÖLÇÜLMÜŞ ÖNERİ:** kapanış için tam Bilanço KALSIN (tek kaynak; ~1 sn, toplamın %3'ü) — mizana geçmek ~0,9 sn kazandırır, bütçeyi kurtarmaz. Bütçeyi aşan bileşen **tek borç sırası**
(~13–15 ms / cari; programın KENDİ `buildObligations`'ı — D3 dokunamaz). Bütçe (≤ 10 sn) gösterge ölçümlerde ~1,8–3,4 kat AŞILIYOR → KULLANICIYA SAYIYLA SORULMALI (S224 deseni; hız — ders 43
değil), §8'de. Olay döngüsü 248–436 ms (yük altında): ilk tur iletisi rapor nesne ağacını taşıyordu; düzeltme (57e482e7: sonuç ve rapor iş parçacığında JSON metni) SONRASI ölçüm (gösterge-2, yük ~4,9–5,0): uç 18.547 / 19.067 ms; okuma 671 / 803 · yevmiye 2.522 / 2.638 · tek borç sırası 10.786 / 10.835 · değerleme 409 / 432 · ön denetim 1.597 / 1.596 ·
plan 1.433 / 1.405 · rapor 206 / 218 · toplam 17.624 / 17.929 ms; olay döngüsü en çok 125 / 142 ms (istemcinin 21,1 MB yanıtı aynı süreçte çözmesi dahil — BM-7); B-9 aynı turda: tam Bilanço
449 ms, mizan 63 ms, Gelir Tablosu 65 ms, plan 1.720 ms. İki göstergede de bileşenlerin oranı aynı: tek borç sırası toplamın %58–62'si.
1 M ölçüm: betik `test/devir-d3-hacim.mjs <kod> <1M kopyası> [K] [şimdi]` (ana oturum; `D3_ADMIN_PASSWORD` gerekiyorsa).

## 8. KULLANICIYA SORULMALI

**Yeni para / kapama / defter kuralı sorusu ÇIKMADI** (kodlanan her kural karar metinlerinden ya da BAŞ MİMAR KARARI 27.11 (2)'den; S-1 / S-2 / S-3 öneri A ile — §11).

**H-1 (HIZ — S224 deseni, sayıyla; ders 43 değil): ön izleme 100 bin satırda bütçeyi (≤ 10 sn) aşıyor.** Gösterge ölçüm (yük ~5 / 4 çekirdek; GEÇERSİZ — kesin sayıyı ana oturum
ÖZEL kilitle ölçmeli): uç baştan sona 18,5–19,1 sn; bunun 10,8 sn'si TEK BORÇ SIRASI (1.484 carinin K'deki kuyruğu, programın kendi `buildObligations`'ı — D3 dokunamaz), yevmiye 2,5 sn,
ön denetim 1,6 sn, plan 1,4 sn. Bilanço (kapanış) ~0,45 sn — darboğaz değil (B-9 §7).
- **A (öneri):** ön izleme arka planda ilerleme çubuğuyla kalsın (kullanıcı bekler, program kilitlenmez — iş parçacığı); hız 2.5.1'in "H yapısal hız (TYK kirli küme)" işiyle birlikte
  iyileştirilsin, ölçüm o işten sonra yinelensin. Bugünkü süre BİLİNEN SINIR olarak teslim notuna.
- **B:** D3'e ek tur: tek borç sırasının devir için yalnız ≤K girdiyle ve "side" görünümü olmadan koşan dar kipi (TYK modülünde — dosya sınırı dışı, ayrı paket ve dar kontrol gerektirir).
- Yaygın programlarda nasıl: belgesi okunmadı — DOĞRULANMADI.

## 9. BAŞ MİMAR KARARI GEREKİYOR
- **BM-1 Şüpheli alacaklı caride "Alacak Toplamı" satırının içeriği.** M12 formülü "≤K bütün alacak hareketleri − devreden açık alacak kalemleri" CH muavini üstünden uygulandı
  (M3 "CH muavini", M13 "CH açılışı + Σ CH açık kalemleri = CH bakiyesi (128 hariç)"): şüpheliye aktarma (B 128 / A 120) CH'yi alacaklandırdığı için Alacak Toplamı'na girer.
  Örnek (test ÖRNEK B, C5): fatura 1.000, şüpheliye 400 → ekstrede Borç Toplamı 400,00 / Alacak Toplamı 400,00 / açık kalem 600,00; carinin yeni yıl CH'si 600, 128'i 400 (N-12).
  Net ve bakiyeler iki okumada AYNI; yalnız iki satırın görünen tutarı farklı olabilir (öbür okuma: şüpheliye aktarma ekstre hareketi sayılmaz → Borç Toplamı 0, Alacak Toplamı 0, ama
  o zaman satırların toplamı CH'yi vermez ve 128 ayrı gösterilmek zorunda). Öneri: bugünkü (CH muavini) — kâhin karşılaştırmasında doğrulansın.
- **BM-2 Alt defter yeri belirsiz hücreler** (D4a'nın yazacağı açılış; D3 bunları planda AYRI listeler, değişmezlerde karşılanmış sayar): 193 Peşin Ödenen Vergiler (vergi listesinde; B-4'e
  193 eklenmeli), carisiz cari kontrol hücreleri (336.90 kayıt tahsilatları — cari boyutu yok; planda `newYear.digerAltDefter` listesinde, b096bcdd; alt defteri `payments` ≤K budanır → yeni yılda nereye yazılacağı belirsiz), hesabı atanmamış 102.00 / 108.00
  (banka listesinde `atanmamis: true`). Öneri: B-4 kararı 190 / 191 / 193 / 360 / 391'i birlikte kapsasın; 336.90 ve 102.00 / 108.00 için D4a'da alt defter satırı.
- **BM-3 Ön denetimdeki "Mutabakat Testi kırmızı" maddesi.** Ön izleme (salt okuma, ≤ 10 sn bütçe) tam Mutabakat Testi'ni koşmaz; yerine Defter Mutabakatı (Ana Defter ↔ alt defterler,
  `ledger.expected` + `reconcile` — routes/ledger.mjs check() ile aynı tanım) DURDURUR. Tam Mutabakat D4'te kopyada koşar (tasarım §4.1 adım 7). Öneri: böyle kalsın.
- **BM-4 Ön izleme işi ve şirket kapanışı** (geri yükleme / ayırma / sıfırlama). Ön izleme iş parçacığı salt okunur bağlantı tutar; Windows'ta şirket dosyası takası (`swapInRestoredFile`)
  o sırada EPERM alabilir (ders 48). `closeCompany` iş parçacığını durduramıyor (app.mjs'te bağlama satırı dışı değişiklik bu pakette yasak). Bugün aynı risk Ç6 mali tablo iş parçacığında
  da var. Öneri: D4-ÖK / D5'te `closeCompany` → `devirPreviews.cancelFor(şirket)` (route tarafı hazır: işin `terminate` tutamacı saklı).
- **BM-5 Kart taksitlerinin kuyruk vadesi (Borçta Kalsın kartı K'den SONRA kapandıysa).** `keptDueSql` kartın BUGÜNKÜ kapalı durumundan okunur; K'de açık olan ama Ocak'ta Borçta Kalsın ile
  kapanan kartın taksit vadeleri K kuyruğunda kapanış gününe kaymış görünebilir (kart taksitleri zaten açık kalem DEĞİL — yalnız `kartlar[].taksitler[].vade` etkilenir). DOĞRULANMADI.
- **BM-6 Açık kalemin kuyruk ROLÜ (D4a ŞARTI — gerçek veride bulundu, plan düzeltildi).** v2.5.0 verisinde (UTC, tohum 11) devirsiz eşdeğer 12 karşılaştırmada ayrıştı: tedarikçiye
  faturasız ödeme (avans) K'de borç tarafında ÖDEME rolünde açık kalemdir; yeni yılda Borç Yaz (yükümlülük) gibi yazılırsa sonraki alış faturalarıyla netleşme sırası değişir (devirsiz:
  15.01 ödemesi avans kalır; rolsüz devirli: eylül avansı açık kalır). Plan artık her açık kalemde `rol` taşır ("yukumluluk" | "odeme"). D4a: ödeme rolündeki kalemi ÖDEME satırı
  (`out` / `in`) olarak yazmalı VE kuyruk bu satırın vadesini asıl tarihten (planın `vade`) almalı — bugün ödeme satırının vadesi satır tarihidir (K+1); asıl tarih korunmazsa
  "netleşmemiş borç yönlü ödeme" gecikmişe bir gün geç girer (EK-1 §1 adım 5). Benzetim `test/fixtures/devir-d3-esdeger.mjs`'te; diş testi + mutant 15.
- **BM-7 Ön izleme sonucunun boyu.** 100 bin satırda sonuç 21,1 MB (14.244 rapor satırı + 1.484 carinin satırları). Ana iş parçacığı artık büyük nesne taşımıyor (sonuç ve rapor iş
  parçacığında JSON metni — d410732e, 57e482e7); gösterge ölçümde olay döngüsü en çok 125–142 ms, ama bu ölçüm istemcinin 21 MB yanıtı AYNI süreçte çözmesini de içeriyor (sunucunun
  payı ayrıştırılmadı — DOĞRULANMADI). Öneri: D5'te GET sonucu bölümlenir (özet + sayılar ayrı; cari satırları / rapor sayfa sayfa) — ekran 21 MB indirmesin.

## 10. SONRAKİ SÜRÜME / SONRAYA (20.11 kuralı — programı etkilemeyen)
- Sürücü (`test/bagimsiz/**`) kâhin ↔ plan karşılaştırması: bu turda YOK (BAŞ MİMAR 27.11 (5)); ayrı ajan planın biçiminden (§12) kurar.
- `test/devir-d3-gercek-veri.mjs` her koşuda veriyi baştan üretiyor (~7 dk); `--veri` ile hazır kopya yeniden kullanılabilir (test aracı).
- Ölçüm betiği istemciyi ayrı süreçte koşmuyor (olay döngüsü ölçümüne istemcinin yanıt çözmesi karışıyor — BM-7).

## 11. S-1 / S-2 / S-3 yanıtı değişirse dokunulacak TEK yer
`server/lib/devir/plan.mjs` → `DEVIR_DECISIONS` (`{ S1: "A", S2: "A", S3: "A" }`). S1 → aynı dosyada `openingTargetOf` (B: 590 → 570.<yıl>, 591 → 580.<yıl>); S2 / S3 →
`server/lib/devir/preflight.mjs` `devirPreflight` (`decisions.S2` / `.S3`: A DURDURUR, B UYARIR, C söylenmez; testte B / C dalları da sınanıyor). Kâhinin aynı kararı ayrıca güncellenir.

## 12. DEVİR PLANI nesnesinin biçimi
Bütün tutarlar KURUŞ tamsayı (işaretli alanlarda borç artı, alacak eksi); tarihler `YYYY-MM-DD`; diziler sıralı (belirlenimli — aynı olgu → bayt bayt aynı JSON). Kimlik deseni
`devir-<K yılı>-<varlık>-<kaynak kimliği>` (G7).

```
plan = {
  surum: 1,
  meta: { sirket: { id, code, name, label } | null, K, acilisGunu (K+1), yil (K yılı), secenek ("borc-alacak" | "sadece-bakiye"), secenekAd,
          calismaKimligi ("devir-<yıl>"), veriSurumu (okuma anının veri damgası, 24 hex), defterTuru ("balance" | "operating" | "professional" | "unset"),
          kuralSurumu (LEDGER_RULE_VERSION), kararlar: { S1, S2, S3 } },
  archive: {                                   // ARŞİV (≤K) — D4: postAll(..., { lockThrough: K })
    lockThrough: K,
    kapanisFisleri: [ { id ("devir-<yıl>-fis-<kod>"), kod ("onceki-yil-<Y>" | "N-01" | "N-02" | "N-03" | "N-04" | "N-06" | "N-07"),
                        type ("prior-year-result" | "closing"), journalClass ("closing" | "period-end"), date: K, description, yil? (önceki yıl fişinde),
                        lines: [ { account (3 hane), sub ("" | "570.2025" | "770.90" …), party (""), debit, credit, note } ] } ],   // sıra = yazım sırası; ≥ 2 satır, dengede
    kapanisBakiyeleri: [ { hesap, alt, cari, minor } ],     // kapanıştan SONRA her bilanço hücresi (1–5; alt hesap + cari boyutu; 0 olan yok) — kitap §6.2'nin "arşiv K"si
    kapanisEtkisi: [ { hesap, alt, onceMinor, sonraMinor } ], // fişlerin dokunduğu her hesap + alt hesap (rapor 2. bölüm)
    donemSonucuMinor,                                        // K yılının Dönem Net Kârı (Zararı) = −(692 bakiyesi); yıl kapanmışsa null
    oncekiYillar: [ { yil, tutarMinor (R_Y), smmMinor } ],
  },
  newYear: {                                   // YENİ YIL (K+1 açılışları; karşı hesap 519)
    kasa: { kimlik, tarih, minor },
    banka: [ { kimlik, hesap ("102" | "108" | "300" | "309"), alt, ad, bankaHesabi (bank_accounts.id | ""), tur, tarih, minor, atanmamis (102.00 / 108.00) } ],
    cariler: [ { cari, ad, tur, silinmis, hesap (CH: "120" | "320" | "336"), kBakiyeMinor (CH; 128 hariç), borcMinor / alacakMinor (≤K CH borç / alacak toplamı),
                 acikBorcMinor, acikAlacakMinor, netMinor (= kBakiye − açık borç + açık alacak), acikKalemSayisi, supheliMinor (128), karsilikMinor (129),
                 satirlar: [                                                      // account_entries'e yazılacak satırlar, ekstre sırasıyla (EK-1 M12)
                   { kimlik ("devir-<yıl>-cari-<cari>-borc-toplami" | …-alacak-toplami | …-devir-bakiyesi), tur, tarih: K+1, yon ("debt" | "credit"), tutarMinor (> 0),
                     aciklama, kaynak: "devir", acilis: true (is_opening), vade: "" (vadesiz — EK-2 S27), kuyrugaGirenMinor },  // Σ kuyrugaGirenMinor = net (BAŞ MİMAR 27.11 (2))
                   { kimlik ("devir-<yıl>-kalem-<TYK anahtarı>": inv:<fatura> | line:<satır> | plan:<kart>:<taksit>), tur: "acik-kalem", tarih: K+1, yon, tutarMinor (kalan − şüpheli pay),
                     aciklama ("Devir: <belge no / tür> (<belge tarihi>)"), kaynak: "devir", kaynakKimlik (TYK anahtarı), acilis: false,
                     vade (asıl vade; vadesizde asıl belge günü — hiç boş değil), beklenenTarih (Ödeme Sözü | ""), kalemSinifi ("fatura" | "elle" | "karsiliksiz" | "kart-kalani" | "diger"),
                     belge: { tarih, faturaId?, no?, satirId?, kartId? } } ] } ],
    kartlar: [ { kimlik, kart, cari ("" = carisiz → 127 plan:<kart>), tarih, toplamMinor, odenenMinor (≤K net tahsilat = plan_entries.opening), kalanMinor, durum ("acik" | "kapali"),
                 kapanisKurali ("waive" | "keep"), mevcutBorc, faturaId, taksitler: [ { taksit, sira, vade, kalanMinor } ] } ],   // kapalı kart da tek açılış alır
    evraklar: [ { kimlik, evrak, yon ("in" | "out"), tur ("cek" | "senet"), durum ("portfolio" | "bank" | "endorsed" | "bounced" | "pending"), cari, tarih, minor,
                  hesap ("101" | "121" | "103" | "321" | "" — ciro / karşılıksızda defter bakiyesi yok), alt ("101.01" | "101.02" | "121.01" | "121.02" | ""), seriNo, vade } ],
    stok: [ { kimlik, urun, kod, ad, birim, tarih, miktar (eksi dahil), birimMaliyet, degerMinor (eksi miktarda 0), dayanak ("ortalama" | "kart" | "yok"), eksi } ],  // silinmiş / 0 miktar YOK
    supheli: [ { kimlik, kayit, cari, tarih, kayitTarihi, kalanMinor (128), karsilikMinor (129) } ],
    vergi: [ { kimlik, hesap ("190" | "191" | "193" | "360" | "391"), donem ("YYYY-MM" — 191: KDV İndirim Dönemi, boşsa belge ayı; 391: belge ayı; öbürleri ""), tarih, minor, oncekiYil
               (dönem ≤ K yılının Aralık'ı → yeni yılın HİÇBİR mahsubuna girmez — M8 (4)) } ],
    acilisFisi: { id ("devir-<yıl>-fis-N-13"), kod: "N-13", type: "opening", journalClass: "opening", date: K+1, description, lines: [ … , { account: "519", … } ] } | null,
                                                  // yalnız alt defteri OLMAYAN bilanço hesapları (MODULE_ACCOUNTS dışı); S-1 = A: 590 / 591 aynen
    baglar: [ { tablo, satir, alan, tarih (>K), eskiHedef (fatura), yeniHedef ("devir-<yıl>-kalem-inv:<fatura>" | ""), tur ("acik-kalem" | "arsiv-basvurusu"),
                arsiv?: { yil, no, tarih } } ],
    sablonlar: [ { tekrar, sablon, sablonNo, sonrakiTarih, taslakKimlik } ],
    budama: [ { table, sinif ("D" | "B" | "A"), toplam, kOncesi, kSonrasi } ],   // ortak katman (O) yok
  },
  degismezler: [ { kod, ad, ok, beklenenMinor, bulunanMinor } ],  // donem-sonucu, onceki-yillar, stok-dss, stok-acilis, sonuc-sifir, gecici-hesap, vergi-190 … vergi-391, denge
  sorunlar: [ { kod (yil-kapanmis | donem-sonucu-farki | onceki-yil-dengesiz | sonuc-hesabi-kaldi | yedi-sinifi-kaldi | modul-farki | cari-satir-farki | supheli-farki |
               siniflandirilmamis-tablo), … } ],                // her biri ön denetimde DURDURUR
  sayilar: { cariKarti, cariAcilis, cariBorcluMinor, cariAlacakliMinor, acikFatura { satis, satisMinor, alis, alisMinor }, acikKalem { borc, borcMinor, alacak, alacakMinor },
             taksitKarti { acik, kalanMinor, kapali }, evrak { <durum>: { adet, minor } }, banka { hesap, minor, kart, kredi, posBekleyenMinor }, stok { urun, degerMinor, eksi },
             kasaMinor, supheli { kayit, kalanMinor, karsilikMinor }, hareket { budanacak, tasinacak } },
}
```
Ön izleme ucunun sonucu: `{ plan, onDenetim: { durdurur[], uyarir[], gecebilir }, rapor: { title, subtitle, headers (6), types, rows, footers, summary, sections }, zamanlama }`;
ön denetim maddesi `{ kod, seviye ("durdurur" | "uyarir"), baslik, metin, adet?, git: { ekran, hedef }, ornek?, belirgin?, ayrinti? }`.


## 13. D4a'nın beklediği türler + kılavuz önerisi
## D4a'nın D3'ten beklediği türler (plan → yazım eşlemesi)

| Plan alanı | D4'te yazılacak yer (öneri; D4a / D4b kesinleştirir) | Not |
|---|---|---|
| `archive.kapanisFisleri[]` | arşiv kopyasında `vouchers.postAll(user, fişler, { lockThrough: K })` — satırlar `assertVoucherLines` biçiminde (kuruş, tek taraflı) | sıra = dizi sırası (EK-2 S25); `type` / `journalClass` VOUCHER_TYPES'ta izinli |
| `archive.kapanisBakiyeleri[]` | yazılmaz — D4'ün DEĞİŞMEZ kaynağı (arşiv kopyasının ölçülmüş mizanı bununla aynı olmalı) | D4 `devirReport(plan, onDenetim, { measured })` ile plan ↔ ölçüm |
| `newYear.kasa` | `cash_entries` (is_opening = 1, K+1, giriş; eksi bakiye → D4a kuralı) | 100 |
| `newYear.banka[]` | `fin_events` açılış (banka hesabının `opening_date` = K+1); `atanmamis` (102.00 / 108.00) → BM-2 | alt hesap boyutu |
| `newYear.cariler[].satirlar[]` | `account_entries` (source 'devir', source_id = kaynakKimlik, is_opening (toplam / bakiye satırında 1), due_date = vade, expected_date = beklenenTarih, tarih K+1) | kuyruğa giren yalnız Σ `kuyrugaGirenMinor` (BAŞ MİMAR 27.11 (2)); defterde cari başına TEK net madde (M3) |
| `newYear.digerAltDefter[]` | BM-2 (336.90 kayıt tahsilatları vb.) | alt defter yeri yok |
| `newYear.kartlar[]` | `plan_entries` (opening = odenenMinor, K+1); kart ve taksitleri kalır | kapalı kart da tek açılış; carisiz 127 |
| `newYear.evraklar[]` | `cheque_events` "devir" olayı (GÖÇ G-1) — durum ve hesap (`hesap` / `alt`) korunur | ciro / karşılıksız: defter bakiyesi yok |
| `newYear.stok[]` | `stock_moves` (is_opening, miktar eksi dahil, birim = birimMaliyet, eksi → değer 0) | silinmiş / 0 miktar yok |
| `newYear.supheli[]` | N-12 (128 / 129 K+1; kayıt kalır; ≤K maddesi bastırılır — §4.4) | GÖÇ G-5 |
| `newYear.vergi[]` | B-4 alt defteri (190, 191@dönem, 193, 360, 391@dönem) | `oncekiYil` → hiçbir mahsuba girmez |
| `newYear.acilisFisi` | yeni yıl kopyasında `vouchers.post` (opening; K+1) | yalnız MODULE_ACCOUNTS dışı hesaplar |
| `newYear.baglar[]` | K sonrası satırın bağı: `yeniHedef` (devir kalemi) ya da arşiv başvurusu (GÖÇ G-4) | 28 = A: arşiv başvurusu bağsız gibi dağılır |
| `newYear.sablonlar[]` | aktif tekrarın ≤K şablonunun TASLAK kopyası (`taslakKimlik`) | |
| `newYear.budama[]` | budama ölçütü (tablo sınıfı + tarih sütunu — `DEVIR_TABLE_CLASSES`) | sayılar ön izlemenin; D4 kopyada yeniden sayar |
| `meta.veriSurumu` | D4 başlarken kopyada plan yeniden hesaplanır; farklıysa "ön izlemeden sonra kayıt girilmiş" | tasarım §3.9 |
| `meta.kararlar` | S-1 / S-2 / S-3'ün planı üreten yanıtı (D4 aynı kararla yazar) | |

## Kılavuz için önerilen kısa "nasıl yapılır" metni (D5'te kılavuza; ders 42 — bu pakette kılavuza DOKUNULMADI)

**Yıl Sonu Devri — Ön İzleme**
1. Ayarlar › Yıl Sonu Devri'ni açın (yalnız yönetici).
2. Devir İçin Son İşlem Tarihi'ni seçin (yalnız geçmiş bir yılın 31 Aralık'ı).
3. Ön Denetim listesinde kırmızı madde varsa yanındaki bağlantıyla gidip düzeltin; sarı maddeler bilgi içindir (ör. "Önce Aralık Mahsubunu Yapın").
4. Cari Bakiye Tipi'ni seçin: Borç ve Alacakları Aktar (önerilen) ya da Sadece Bakiyeyi Aktar. İkisinde de bakiyeler ve gecikmiş tutarlar aynıdır; yalnız ekstredeki satırlar farklıdır.
5. Ön İzleme'de aktarılacak cari, açık fatura, taksit kartı, çek / senet, banka ve stok sayılarını görün; Devir Raporu'nu PDF ya da Excel olarak alın. Ön izleme hiçbir kaydı değiştirmez.


## 14. DOĞRULANMADI
- Hız ve olay döngüsü KESİN ölçümü (ÖZEL kilit alınamadı; gösterge yük > 2). 1 M satır ölçülmedi (betik hazır).
- Şüpheli kaydın K'deki ayırımı: ≤K kayıt / karşılık / alacak satırlarıyla `allocateDoubtful`; `linked` geri çağrısı (bağlı tahsilat payı) BUGÜNKÜ kuyruktan — K sonrası bağlı tahsilatı
  olan şüpheli caride K payı DOĞRULANMADI (plan 128 hücresiyle karşılaştırır; tutmazsa `supheli-farki` DURDURUR — yanlış geçiş değil, olası yanlış durdurma).
- K'den SONRA "Borçta Kalsın" ile kapanan kartın taksit vadeleri (BM-5).
- Defter Mutabakatı ↔ tam Mutabakat Testi (BM-3): ön izleme tam testi koşmaz.
- Evrakın K'deki durumu son olayın varış durumundan + tahsile verilme kaydından; karşılıksız / iade evrak sınıfları gerçek veride DENENMEDİ (üreteçte çek yok) — plan modül farkıyla
  yakalar (çek hücreleri evrak listesiyle karşılaştırılır).
- Kilit geçmişine K eklenmedi: K'deki kuyruğun bütün satırları devirden ÖNCE yazıldığından devirsiz eşi (kilit devir anında konur) ile aynı sonuç (karar 28 = A) — ayrı test yok.
- Alacak Toplamı'nın şüpheli caride içeriği (BM-1) kâhinle karşılaştırılmadı.

## 15. DENENMEYEN
- Plan §8 / G10 / §3.11'de D4 / D5 işi olanlar (§0 tablosu: 11, 15, 17, 18, 21, 23–26; 33'ün yeni yıl tarafı) — D3 yazmaz.
- Ekran senaryosu (D5). Windows: D3 dosya silmez / taşımaz (ders 48 kapsamı dışı); salt okunur iş parçacığı bağlantısı açıkken şirket takası BM-4 (Windows CI'de görülmedi).
- Kâhin ↔ plan karşılaştırması (sürücü yok — BAŞ MİMAR 27.11 (5)).
- Gerçek veride kart, çek, şüpheli, KDV mahsubu, banka (üreteç bunları içermiyor; kart / şüpheli / KDV elle testlerde var).
- §0'da "devir-d3-plan" diye planlanıp TESTİ YAZILMAYANLAR (açıkça): madde 1 K sonrası bağın yönlendirilmesi (`newYear.baglar` — okuyucu SQL'i ve açık kalem / arşiv başvurusu ayrımı
  sınanmadı), madde 4 / 28 evrakın K'deki durumu (`newYear.evraklar` — çek testi yok; plan modül farkıyla yakalardı), madde 5 / 35'in 108 / 309 / 300 alt hesapları (yalnız 102.01 elle),
  madde 22 tekrarlayan şablonun okuyucu SQL'i, madde 14 / 19'un e-Belge olgularının okuyucu SQL'i (ön denetim maddeleri OLGU düzeyinde sınandı — `test/devir-d3-plan.test.mjs`; okuyucunun
  bu sayıları API verisinden doğru sayması sınanmadı). Sonraki turda API verisiyle bir test dosyası önerilir.
- Tam `npm test` (ana oturum koşar).

## 16. CI listesine eklenecek
- `test/devir-d3-*.test.mjs` (4 dosya) npm test deseniyle (`test/**/*.test.mjs`) kendiliğinden girer — ci.yml'ye ekleme GEREKMEZ.
- CI DIŞI (elle / Uzun Doğrulama adayı): `node test/devir-d3-gercek-veri.mjs --eski <v2.5.0 kopyası> --tohum <n>`, `node test/devir-d3-mutasyon.mjs --kopya <git archive HEAD>`,
  `node test/devir-d3-hacim.mjs <kod> <veri kopyası> [K] [şimdi]`.

## 17. Commit listesi (dal `worktree-agent-a1207a9fb3d4d1b0f`, taban 64396478 `t251-taban`)
- 4c36c5ab Kanıt: D3 koşuları (eski kod, testler, gerçek veri 3 tohum, komşular, kâhin taban / son, mutasyon, hacim göstergesi)
- 57e482e7 D3: rapor satırları da iş parçacığında JSON metni (ana iş parçacığına nesne ağacı gelmez); hacim betiğinde ölçüm verisinin parolası ve sonuç boyu
- 6c7a5194 D3: açık kalemin kuyruk rolü (ödeme / yükümlülük) planda — gerçek veride (UTC tohum 11) görülen devirsiz eşdeğer farkı
- d410732e D3: ön izleme sonucu iş parçacığında JSON'a çevrilir; ana iş parçacığı büyük nesne taşımaz (olay döngüsü)
- 343f9a46 D3: ön izlemenin hareket sayısı dokunulmaz tabloları saymaz
- b096bcdd D3: carisiz cari kontrol hücresi (336.90 kayıt tahsilatları) ayrı listede; hacim ölçüm betiği
- 56bfd632 D3: yaşayan mutant (net formülü) için sadece-bakiye sayıları; M3 metni
- ee7773c5 D3: gerçek veri (v2.5.0 kodu) ve mutasyon tarama betikleri
- bf8b0159 D3: ön izleme ve zaman testi (31.12 23:59 / 01.01 00:00, Şubat, 29 Şubat; iki TZ)
- 88310a6f D3: ön izleme uçlarının testleri (yetki, ret, tek iş, iki şirket, rapor ekran = PDF = Excel, bayat, kesinti)
- f0eb6ca4 D3: elle hesaplanmış plan testleri, ön denetim maddeleri, tablo sınıflaması ve devirsiz eşdeğer testi
- c10036a7 D3: devir planı (saf hesap), okuyucu, ön denetim, Devir Raporu, ön izleme iş parçacığı ve uçları
- dacab9dc D3: nasıl bozulur listesi (koddan önce)
- (bu rapor commit'i — dal ucu SubagentHandback iletisinde)

## 18. Ana oturumun yeniden koşacağı komutlar
```
cd <bu dal>; export HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do TZ=$tz node tools/kanit.mjs kos d3-$tz -- node --test --test-concurrency=1 test/devir-d3-plan.test.mjs test/devir-d3-esdeger.test.mjs test/devir-d3-uc.test.mjs test/devir-d3-zaman.test.mjs; done
# eski kod kırmızısı (ders 23 / 51): git archive t251-taban server test tools package.json | tar -x -C <kopya>; yalnız test/devir-d3-*.test.mjs + test/fixtures/devir-d3-esdeger.mjs kopyalanır
# gerçek veri: git worktree add --detach <yer>/v250 v2.5.0 && ln -s <node_modules> <yer>/v250/node_modules; node test/devir-d3-gercek-veri.mjs --eski <yer>/v250 --tohum 11
# mutasyon: git archive HEAD server test package.json | tar -x -C <kopya>; node test/devir-d3-mutasyon.mjs --kopya <kopya>
# hız (ÖZEL kilit): flock -x -w 1800 scratchpad/olcum.lock node test/devir-d3-hacim.mjs $PWD <temiz-100k kopyası> 2025-12-31 2026-10-08T12:00:00+03:00 2
npm run test:kahin-defter; npm run test:kahin-cari
```
Ortam (bitişte): yük ~5 / 4 çekirdek (başka işlerin yükü dahil), bellek boş ~5 GB (kullanılabilir ~9 GB), disk boş ~11 GB.
