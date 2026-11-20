# Ç6-HESAP Tasarım Notu — mali tabloların HESABI (2.5.0 muhasebe çekirdeği)

Durum: TASARIM (19.11.2026, Ç6-HESAP tur 1 kod ajanı; koddan ÖNCE yazıldı; tur 2 — Bilanço, B-a, S209 — 20.11.2026). Kaynaklar (AYNEN okunur, burada özetlenir): çekirdek planı
`docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §0 / §7 / §8 / §9 / §13; kural kitabı `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` §1 (G-1, G-4, G-8), §2, §3-S, §3-N, §4, §5, §7, §8, §9
(KG-9 A, KG-10 A, KG-11 A, KG-12 A, KG-13 A, KG-14 A — kullanıcı kararı 05.11 "hepsi A"); EK-1 M4, M5, M6, E3 / E4; EK-2 S. 25 (E13), S. 37 (E16), S. 38; devir planı §11.4;
iş listesi Ç6 satırı ve BAŞ MİMAR KARARI 06.11 07:55 (Ç6 İKİYE). Kodun karşılaştırıldığı kâhin bu notu GÖRMEZ (ders 5); kâhin eşlemesi ayrı sürücü bakımında.

## 1. Kapsam ve turlar
- Ç6-HESAP = mali tabloların HESABI (JSON); Ç6-EKRAN = rapor ekranları, PDF / Excel, karşılaştırmalı dönem, Rapor Merkezi kaydı (ayrı iş, D'ye paralel).
- Tur 1 (bu tur): bu not + dönem sonu stok değerlemesi (kitap §5) + Gelir Tablosu hesabı (§4, §7.1) + okuma ucu. Tur 2: Bilanço (ters bakiye brütleştirmesi §7.3, hesaplanmış
  "Dönem Net Kârı" / "Geçmiş Yıllar — Kapanmamış" satırları §4, Aktif = Pasif, Bilanço'nun Kesin Değil nedenleri). Tur 3: kabul (kâhin karşılaştırması ayrı sürücü bakımı 4).
- D3 (ön izleme, Devir Raporu) ve D4 (kapanış / açılış fişi) dönem sonucunu, N-01 tutarını ve kapanış bilançosunu YALNIZ bu modülün işlevlerinden alır (BAŞ MİMAR 06.11 (2); tek kaynak).

## 2. Modül sınırı ve dosyalar (yeni dosyalar; türetme dosyalarına DOKUNULMAZ)
| Dosya | Görev |
|---|---|
| `server/lib/stock-valuation.mjs` | Dönemsel ağırlıklı ortalama değerleme — TEK işlev (`loadValuationInput`, `createStockValuation` → `at(t)`, `yearEnd(Y)`). Saf; veri tabanını tek toplu sorguyla okur. |
| `server/lib/financial-statements.mjs` | Ortak çekirdek: Gelir Tablosu hesabı (`incomeStatement`), satışların maliyeti tahmini (`estimatedCost`), TEK "Kesin Değil" toplayıcısı (`notFinalReasons`), dipnotlar (`footnotes`). Tur 2 Bilanço'yu buraya ekler. |
| `server/lib/financial-statements-worker.mjs` | Rapor iş parçacığı: salt okunur bağlantı, tek okuma işlemi; Ana Defter servisini (`registerLedgerRoutes`, freeze-worker deseni) kurar, `book()` + değerleme + hesap. Bilanço işinde (tur 2) cari / taksit / stok / tek kaynak servisleriyle (integrity-scan-worker deseni: `check()`'in mutabakatı). |
| `server/routes/financial-statements.mjs` | Okuma ucu (JSON). `server/app.mjs` yalnız kaydı. |

Okunanlar (yalnız okuma): `general-ledger.mjs` (ACCOUNT_PLAN, PLAN_SUBS, incomeStatementItemOf, entryClass, JOURNAL_CLASS, stockOpeningValue), `routes/ledger.mjs` servis nesnesi
(`book`, `build`, `snapshots`), `book-type.mjs`. Ayrı türetme / ikinci para motoru YOK (plan §0): Gelir Tablosu'nun HER tutarı `book()` maddelerinden; değerleme yalnız MİKTAR ve
BİRİM MALİYET için stok hareketlerini okur (defterde ürün boyutu yoktur).

## 3. Değerleme işlevi (kitap §5.1, §5.2; EK-1 M5, M6; KG-9 A, KG-10 A)
- Girdi (toplu SQL, ürün başına sorgu YOK — ders 47): `stock_items` (kimlik, kod, ad, birim, tür, kart alış fiyatı `unit_price`, `deleted_at`) + `stock_moves` (ürün, yön, miktar,
  tutar, birim fiyat, tarih, `pay`, `reason`, fatura bağı, `is_opening`; tarih + rowid sırasıyla). Hizmet kalemi (`kind = service`) stok değildir (S-07) — girdiye alınmaz.
- Hareket sınıfı (defterin 153 maddeleriyle AYNI ayrım; general-ledger journal()):
  - AÇILIŞ (M-07): `is_opening = 1`, giriş, `pay = none` → değer = `stockOpeningValue` (miktar × birim fiyat, kuruşa) — dönem başı stokuna (DBS) eklenir ("ilk yıl: M-07"; sonradan açılan ürünün
    kendi ilk yılı da aynı kural).
  - ALIŞ (F-05 / S-02): giriş, `reason = ''`, açılış değil, ve (fatura bağlı ya da `pay ∈ {cash, account}`) → değer = hareketin tutarı (faturada KDV hariç, iskonto düşülmüş net; faturasızda tamamı).
  - ALIŞ İADESİ (F-12 / S-05): çıkış, `reason = preturn`, ve (fatura bağlı ya da `pay ∈ {cash, account}`) → değer = tutar.
  - YALNIZ MİKTAR: satış, müşteri iadesi (`reason = return`; S-04 birim maliyeti değiştirmez), parasız giriş / çıkış (S-06 sayım farkı — "fark dönem sonu değerlemesine girer").
- Yıl Y, tarih t ∈ Y için ürün başına (tamsayı: kuruş, miktar 1/1000): q₀ = max(0, DSS miktarı_(Y−1)) (M5: eksi dönem başı miktar 0), v₀ = DSS değeri_(Y−1) + Σ açılış değeri [1 Ocak, t],
  pay = v₀ + Σ alış − Σ alış iadesi, payda = q₀ + Σ açılış miktarı + Σ alış miktarı − Σ alış iadesi miktarı ([1 Ocak, t] — M6 / E3: tahmini t'de aralık [1 Ocak, t]; yıl sonunda [1 Ocak, 31 Aralık]).
  Birim maliyet = pay ÷ payda (payda > 0); payda ≤ 0 → KG-10 A: kartın ALIŞ fiyatı (satış fiyatı ASLA), o da yoksa 0 + uyarı. Ürün değeri = max(0, q_t) × birim maliyet, G-1: ürün başına kuruşa yarım
  yukarı (eksi tutarda mutlak değere), toplam = yuvarlanmış satırların toplamı. q_t < 0 → değer 0 + "Kesin Değil — Eksi Stok" (KG-9 A); miktar devri eksi dahil (M5).
- DBS_Y = DSS_(Y−1) (ilk yıl 0 + M-07); önceki yıl sonları da AYNI kuralla değerlenir (KG-12 A "önceki yıl sonları için de §5 değerlemesi"). Yıl sonu sonuçları tek koşuda saklanır (yeniden hesap yok).
- Çıktı: ürün bazında { miktar, birim maliyet, değer, dayanak: ortalama | kart | yok, uyarılar } + yıl bazında { DBS, açılış, alış, alış iadesi, DSS, SMM_stok = DBS + açılış + alış − iade − DSS } + uyarılar
  (KG-9 eksi stok, KG-10 kart fiyatı / fiyat yok, silinmiş ürün) + `clipped` (S209 = B: eksi birim maliyet 0'a kırpılan ürünler ve kırpılan tutar — §7).
- TEK işlev devre: D3 / D4 `createStockValuation(loadValuationInput(store)).yearEnd(K)` ile DSS_K'yi ve ürün bazında açılış (miktar = K miktarı eksi dahil, değer = ürün değeri → birim fiyat) alır;
  Gelir Tablosu / Bilanço `at(t)` ile. Devir dosyasında önceki yıl yoktur → DBS = açılış hareketleri (aynı kod yolu).
- Silinmiş ürün kartı (yumuşak silme, hareketler durur): silindiği günden itibaren envantere girmez (değer 0; programın envanter raporları da silinmiş kartı göstermez) — alışları SMM'ye
  düşer. İKİ OKUMAYA AÇIK → §10 S-a (kullanıcıya); kod bu okumayla, uyarıyla.

## 4. Satışların maliyeti (tahmini) — KG-11 A, EK-1 M6, §5.2, N-01
- Defter biçimi (kitap §5.2 "Fark (N-01) = 153'ün K bakiyesi − DSS"; EK-1 M4 "N-01 tutarı = SMM_K = DSS_(K−1) + alış − iade − DSS_K"): T_Y(t) = DSS_(Y−1) + (153'ün [1 Ocak Y, t] defter hareketi,
  dönem sonu ve kapanış sınıfı maddeleri — N-01, kapanış, önceki yıl sonucu — HARİÇ) − DSS_t. t = 31 Aralık'ta T = N-01 (aynı işlev, M6). Böylece Bilanço (tur 2) 153'ü DSS_t ile, hesaplanmış
  dönem sonucunu −T ile gösterince Aktif = Pasif kendiliğinden tutar (YÜKSEK-1: Gelir Tablosu dönem kârı = Bilanço dönem kârı).
- Stok biçimi (SMM_stok, §3) ile defter biçimi arasındaki fark = 153 defter hareketi − (açılış + alış − iade) stok tutarları. Programın kendi yollarında 0'dır (her 153 maddesi bir stok hareketinin
  tutarıdır); ≠ 0 ise uyarı "Stok Hareketleri ile 153 Ticari Mallar Ayrışıyor" + tutar (§10 B-b).
- Gelir Tablosu [a, b] (a, b aynı mali yıl): Satışların Maliyeti (Tahmini) = T(b) − T(a − 1); a = 1 Ocak ise T(a − 1) = 0 → aylar toplamı = çeyrek = yıl (M6).
- Yılda 621 hareketi (N-01 yazılmış — D4 kapanışı) varsa YALNIZ 31.12'yi içeren parça defterdeki 621'i kullanır (yıllık [1 Ocak, 31.12] kesin; a > 1 Ocak ise − T(a − 1) tahmini); 31.12'yi içermeyen
  parça her zaman T(b) − T(a − 1) (tur 2, B-a — §7). Tahmin varsa "Kesin Değil — Satışların Maliyeti Tahminidir".
- ÇAPRAZ YIL özel aralık (a ve b farklı yıllar): kitapta TANIMSIZ (T yıla bağlı; M6 formülü tek yıl) → KODLANMADI: uç 400 `gelir-tablosu-tek-yil`; §10 S-b (kullanıcıya).

## 5. Gelir Tablosu (kitap §4, §7.1)
- Kaynak: `ledger.book({ from: yılın 1 Ocak'ı, to: b })` — kilitli dönem donmuş defterden, açık dönem canlı türetmeden (Ç3); [a, b] dışındaki maddeler sayılmaz. Kapanış sınıfı maddeleri
  (`entryClass = JOURNAL_CLASS["voucher-close"]`: N-02…N-07 ve önceki yıl sonucu fişleri, EK-2 E13) HARİÇ; dönem sonu sınıfı (N-01, 621) DAHİL.
- Kalem → hesap → alt hesap; sınıflama HESAP ÖNEKİNDEN (Ç7b'nin getireceği 601 ve .90 alt hesapları baştan karşılanır; sabit hesap listesi yok): A 600–602 · B 610–612 · D 620–623 · E 630–632
  (760 → 631, 770 → 632) · F 640–649 · G 653–659 · H 660–661 (780 → 660) · I 671–679 · J 680–689 · K 691. 7/A gideri yansıtıldığı hesabın satırında, kaynak hesabı alt satırda (761 / 771 / 781
  olağan maddede görünürse hedef satırına). Planla tutarlılık testi: planda gelir tablosu kalemi olan her hesap önek sınıflamasıyla aynı kaleme düşer (`incomeStatementItemOf`).
- ".90" alt hesaplar (600.90, 602.90, 610.90, 649.90, 770.90 …) kendi alt satırında; ad PLAN_SUBS'tan, GT satır adı kitapta verilmişse o: 770.90 "Sınıflandırılmamış Kasa / Banka Giderleri"
  (çekirdek §13), 649.90 "Sınıflandırılmamış Kasa Gelirleri" (EK-2 S. 37). Öbür alt hesaplar ana hesabında toplanır.
- İşaret: gelir kalemi (A, F, I) = alacak − borç; indirim / gider kalemi (B, D, E, G, H, J, K) = borç − alacak (ters bakiyede eksi görünür, netleştirilmez).
- Ara toplamlar: Net Satışlar = A − B; Brüt Satış Kârı = Net − D; Faaliyet Kârı = BSK − E; Olağan Kâr = FK + F − G − H; Dönem Kârı = OK + I − J; Dönem Net Kârı = DK − K.
- K satırı (KG-13 A): program vergi karşılığı ayırmaz; satır 0 ve açıklamalı ("vergi öncesi"); 691 hareketi varsa tutarı (programın kendi yolunda yok).
- Önekle sınıflanamayan 6 / 7 hesabı (690, 692 olağan maddede, plan dışı kod): tutar hiçbir kaleme katılmaz → "Kesin Değil — Sınıflandırılmamış Hesap" + liste.
- İç tutarlılık: kalem satırlarının hesap tutarları aynı dönemin Hesap Planı Mizanı 6 / 7 hareketlerine birebir (kapanış sınıfı maddesi yokken; varsa fark yalnız o maddeler).

## 6. Bilanço (tur 2 — KESİNLEŞTİ 20.11.2026, tur 2 kod ajanı; koddan ÖNCE yazıldı)
Kaynak: kitap §4, §7.2, §7.3, §7.4, §8; KG-11 A, KG-12 A, KG-14 A; EK-1 M4; EK-2 S. 36; çekirdek §13. İşlevler `server/lib/financial-statements.mjs` içinde (yeni dosya yok): `balanceSheet` (saf),
`balanceSheetOf` (okuma ucu / iş parçacığı ortak hesabı).
- asOf = t (varsayılan bugün). Maddeler: `ledger.check()` BİR kez (Defter Mutabakatı'nın / Mutabakat Testi'nin AYNI işlevi: canlı türetme + `reconcile(trialBalance, expected)`); onun
  canlı türetmesi `live` olarak `ledger.book({ to: t, live })`'a verilir → kilitli dönem DONMUŞ, açık dönem canlı, ikinci tam türetme YOK. Kural Değişikliği Farkı (kilit varsa) aynı `live` ile
  `periodRuleDiff` (bütün hesaplar, [başlangıç, min(t, kapsam)]).
- Bakiye: 1–5 sınıfı satırları, t günü sonu, KAPANIŞ SINIFI DAHİL (kitap §4). Tek geçiş (madde başına sorgu yok — ders 47): (hesap, boyut anahtarı) → borç − alacak. Boyut (planın `ters.boyut`,
  `reverseBalanceOf`): cari → satırın `party`'si (127'de kart: `plan:<id>`), alt hesap → `sub`, hesap → hesabın tamamı; kuralı "kesinDegil" olan hesapta denetim anahtarı `sub || party || ''`.
- Kalem → hesap → alt hesap / cari: kalem `balanceSheetItemOf` (BALANCE_SHEET_ITEMS sırası; boş kalem de 0 ile döner), hesap satırı ana hesap, `altlar` alt hesaplar (102.NN, 108.NN, 101.01 …),
  cari boyutunda yalnız sayı (`cariSayisi`; cari listesi Büyük Defter'in işi). Tutar yönü: aktif kalemde borç − alacak, pasif kalemde alacak − borç → düzenleyici hesaplar (103, 129, 501, 503, 580,
  591) kendi kaleminde EKSİ görünür (kitap §7.2).
- BRÜTLEŞTİRME (§7.3; netleştirme YOK): boyut grubunun bakiyesi hesabın ters tarafındaysa grup hedef kaleme hedef hesabın adıyla gider: alacaklı 120 cari → III.D 340; borçlu 320 cari → I.E 159;
  borçlu 336 cari → I.D 136; alacaklı 102 alt hesap (KMH) → III.A 300; borçlu 309 alt hesap → I.D 136; borçlu 360 (hesap) → I.H 198 + Kesin Değil (KG-14 A); alacaklı 127 kart → III.D 340
  (EK-2 S. 36 önerisi — planda "karar"; BAŞ MİMAR KARARI GEREKİYOR, raporda). Hedef satırda `kaynaklar` [{ hesap, adet, tutarMinor }]; hedef hesabın kendi defter bakiyesi (olursa) aynı satıra.
  Brütleştirme yalnız KALEM değiştirir: her hesabın `defterMinor`'ı (t bakiyesi) korunur → hesap toplamları Hesap Planı Mizanı'yla birebir (iç tutarlılık testi).
- İmkânsız ters bakiye (§7.3 "kesinDegil" kuralı: 100, 101, 103, 108, 121, 128, 129, 153, 300, 321): değer kendi kaleminde (eksi) kalır + Kesin Değil "İmkânsız Ters Bakiye" (hesap / alt hesap / cari sayısı
  ve tutar). Normal yön: aktif borç, düzenleyici aktif (103, 129) alacak, pasif alacak.
- 153 = DSS_t (tur 1'in değerleme işlevi `at(t)`; "Ticari Mallar (Tahmini Değerleme)") — t'nin yılının satışların maliyeti tahminiyse; kesinse (yılda N-01 / 621 yazılmış, t = 31.12) defter bakiyesi.
  Defter bakiyesi ayrıca `defterMinor` alanında.
- KAPANMIŞ YIL: t'ye kadar tarihli, ters kaydı yazılmamış kapanış sınıfı fişlerinin (Kapanış Fişi, Önceki Yıl Sonucu Fişi — `ledger_vouchers`, tek sorgu) en geç tarihi d; d = 31.12.K ise K ve
  önceki bütün yıllar kapanmıştır (EK-1 M4: devir kapanışı K'yi ve kapanmamış bütün önceki yılları aynı gün kapatır), değilse K − 1. Fiş tablosu yoksa maddelerin kapanış sınıfından.
- HESAPLANMIŞ İKİ SATIR (kayıt değil; kitap §4): "Dönem Net Kârı (Zararı)" (V.F) = `incomeStatement({ from: 1 Ocak, to: t })`'nin `subtotals.donemNetKari`'si — Gelir Tablosu'nun KENDİSİ (iki formül
  YOK; YÜKSEK-1 ve §8 değişmezi); t'nin yılı kapanmışsa satır yok. "Geçmiş Yıllar Kârları (Zararları) — Kapanmamış" (V.D / V.E arası) = kapanmamış her önceki yıl Y için
  `incomeStatement({ from: Y-01-01, to: Y-12-31 })` dönem net kârı (o yılın satışların maliyeti tahmini, §5 değerlemesiyle — KG-12 A); YIL YIL, kârlı yıllar 570 kısmında, zararlı yıllar 580
  kısmında (EK-1 M4: brüt, mahsup yok). Yalnız 6 / 7 hareketi ya da stok etkisi olan yıllar listelenir.
- Aktif = Pasif: aktif toplamı ile pasif toplamı (hesaplanmış satırlar dahil) eşit olmalı; değilse `fark` = aktif − pasif ayrı FARK SATIRI (kayıt değil, denkleştirme kaydı YOK) + Kesin Değil
  "Aktif ile Pasif Eşit Değil". Kapanmış yılın 6 / 7 artığı (eksik kapanış) ve tanınmayan 1–5 hesabı (planda yok — Kesin Değil "Sınıflandırılmamış Hesap", tutar tabloya girmez) farkta görünür.
- 191 / 391 brüt (netleşmez — ayrı hesaplar). "Biten ay mahsupsuzsa bilgi uyarısı" ve EK-2 S. 34 "Önceki Yıl KDV Mahsubu Yapılmamış" KDV DÖNEMİ boyutuna bağlıdır (EK-1 M8, KG-7) — dönem alanı
  Ç7b'nin (türetme dosyaları) işi; bu turda KODLANMADI (§10 B-e).

## 7. "Kesin Değil" ve dipnotlar
- TEK toplayıcı `notFinalReasons(facts)` (kitap §7.4 sırası): rapor kendi bilgisini (facts) verir, toplayıcı kod + Türkçe metin + ayrıntı listesi döndürür; Gelir Tablosu ve Bilanço AYNI işlevi çağırır.
  Sıra: Tamamlanmamış Açılış (519 ≠ 0) · Satışların Maliyeti Tahminidir (KG-11) · Defter Mutabakatı Farkı ya da Dengesiz Madde (B-d: `ledger.check()`'in mutabakatı — başarısız denetimler ayrıntıda;
  dengesiz madde sayısı) · Aktif ile Pasif Eşit Değil (kitap §4) · Kural Değişikliği Farkı (Ç3) · Eksi Stok (KG-9) · Eksi Birim Maliyet (S209 = B) · İmkânsız Ters Bakiye (eksi kasa dahil, §7.3) ·
  Borçlu Ödenecek Vergi (KG-14) · Kapanmamış Önceki Yıl (KG-12; yıllar) · Önceki Yıl KDV Mahsubu (toplayıcıda; besleyen yok — §10 B-e) · Sınıflandırılmamış Hesap · Bilgi Amaçlı (Defter Türü).
  Gelir Tablosu'nun nedenleri: satışların maliyeti tahmini; eksi stok (t = b ve a − 1); eksi birim maliyet; dengesiz madde (dönemin maddelerinde Σ B ≠ Σ A); Kural Değişikliği Farkı (kapsam
  dönemin yılına değiyorsa: dönemin KİLİTLİ kısmında donmuş ↔ güncel türetmenin 6 / 7 ve 153 yıl × hesap toplamı — `periodRuleDiff`; bütün kilitli geçmişi madde madde karşılaştıran
  `snapshots.ruleDiff` 100 bin satırda ~2,7 sn sürdüğü için kullanılmadı, o iş Mutabakat Testi'nin "ledger:rule-diff" denetimidir); sınıflandırılmamış hesap; Bilgi Amaçlı. Bilanço'nunkiler §6'da.
- B-a (BAŞ MİMAR KARARI 19.11 22:45, tur 2): kapanmış yılın (N-01 / 621 yazılmış) 31.12'yi İÇERMEYEN parçasında satışların maliyeti tahminidir, T(b) − T(a − 1); N-01'in 621'i yalnız 31.12'yi
  içeren parçada, o parçada a > 1 Ocak ise T(a − 1) tahmini satırla düşülür ("Önceki Dönemlere Dağıtılan Maliyet (Tahmini)", eksi) → aylar toplamı = çeyrek = yıl = 621; o parça da tahmin taşıdığı
  için Kesin Değil "Satışların Maliyeti Tahminidir". Yıllık [1 Ocak, 31.12] kesin (tahmin yok).
- S209 = B (kullanıcı kuralıyla öneri uygulandı 19.11 22:45): alış iadesinin değeri alışlardan büyükse (pay < 0, payda > 0) birim maliyet 0'a KIRPILIR, ürün değeri 0; kırpılan tutar (formülün
  verdiği eksi değer) ürün ayrıntısında `kirpilanMinor` ve Kesin Değil "Eksi Birim Maliyet" ayrıntısında GÖRÜNÜR. Değerleme tek işlev → Gelir Tablosu ve Bilanço aynı değeri okur.
- Dipnotlar `footnotes(facts)` (§7.5): (1) yasal tablo değildir, (2) dönem sonu işlemleri yapılmaz, (3) "Kasa ve banka 'Diğer Gider' çıkışları (… TL)" = dönemin 770.90 tutarı, (5) Serbest Meslek
  Kazanç Defteri'nde, (6) .90 alt hesapların gelir ve gider tutarları (varsa). (4) krediler — Bilanço'nun. Metinler kitaptan AYNEN.

## 8. Okuma ucu, yetki, hacim
- `GET /api/workspace/financial-statements/income-statement?from=YYYY-MM-DD&to=YYYY-MM-DD` (varsayılan Bu Yıl) → { from, to, bookType, bilgiAmacli, items, subtotals, smm, kesinDegil, footnotes,
  warnings }; `GET /api/workspace/financial-statements/balance-sheet?date=YYYY-MM-DD` (varsayılan bugün; tur 2) → { date, year, bookType, bilgiAmacli, aktif, pasif, hesaplanmis,
  toplamlar: { aktifMinor, pasifMinor, farkMinor }, fark, accounts, smm, reconciliation, kesinDegil, footnotes, warnings } (aktif / pasif: gruplar → kalemler → hesaplar → altlar / kaynaklar;
  accounts: hesap başına t defter bakiyesi ve bilançoda gösterilen tutar — sürücü ve iç tutarlılık için); `GET /api/workspace/financial-statements/stock-valuation?date=YYYY-MM-DD` → değerleme (D3 / D4 / sürücü). Yetki Ana Defter raporlarıyla AYNI: `overview.view` (Yönetici + Muhasebe
  görür; Personel ve Avukat görmez).
- Hacim (plan §8; ders 47): 100.000 satırda ≤ 3 sn, olay döngüsü en çok ≤ 50 ms → hesap rapor iş parçacığında (salt okunur bağlantı, TEK okuma işlemi — WAL anlık görüntüsü; integrity-scan-worker /
  freeze-worker deseni); ana iş parçacığında yalnız ileti. Veri değişmedikçe önbellek (`store.changeCounters()` + bugün + kilit + parametreler; en çok 8 sonuç). İş parçacığı açılamazsa (veri
  tabanı yolu yok, açık işlem içinde) aynı işlev iş parçacığısız (sonuç aynı; test iki yolu karşılaştırır). Değerleme: iki toplu sorgu, ürün başına O(hareket).
- ÖLÇÜLDÜ (19.11, temiz 100 bin satır, yük < 2; kanıt docs/kanit/2026-11-19/c6h1-hiz-*): Gelir Tablosu kilitsiz ortanca 2,84–3,03 sn, kilitli (30.06.2026) 2,97–3,47 sn; değerleme ~0,7 sn; önbellekten
  ~5 ms; ana iş parçacığının olay döngüsü istek başına en çok ~10–14 ms (95 örnekte 5 kez 59–118 ms sıçrama — nedeni DOĞRULANMADI). Sürenin ~2,1–2,5 sn'si Ana Defter'in canlı türetmesi (build;
  Hesap Planı Mizanı ile aynı maliyet) → bütçe sınırda; türetmenin hızlanması Ç6-HESAP'ın dışında (BAŞ MİMAR KARARI GEREKİYOR B-c).
- Bilanço (tur 2): TEK canlı türetme (`check()`'in) + karma yevmiye + mutabakatın beklenenleri (cari listesi + SQL toplamları) + değerleme (`at(t)` bir kez, önbellekli) + Gelir Tablosu çağrıları
  (t'nin yılı + kapanmamış her önceki yıl; madde dizisi üzerinde, sorgusuz). İş parçacığı Ana Defter'i cari / taksit / stok / tek kaynak servisleriyle kurar (integrity-scan-worker deseni) — mutabakat
  ana iş parçacığındakiyle aynı sonucu verir (test iki yolu karşılaştırır). Bütçe plan §8 (100 bin satırda ≤ 3 sn, olay döngüsü ≤ 50 ms); ölçüm kanıtı docs/kanit/2026-11-20/c6h2-hiz-*.
- ÖLÇÜLDÜ (20.11, temiz 100 bin satır; geçerli koşu yükü 0,5–1,4): Bilanço kilitsiz ortanca 4,66–4,75 sn (en iyi 4,41–4,64), kilitli (30.06.2026) 6,22–6,81 sn — BÜTÇE AŞILDI (B-g); olay döngüsü
  istek başına en çok 10,9–27 ms; önbellekten 3,6 / 7,9 ms; Aktif = Pasif (fark 0) ve hesaplanmış Dönem Net Kârı = Gelir Tablosu (yıl 2026: 51.248.200,44 TL) büyük veride de. Parça (iş parçacığısız):
  canlı türetme 2,0–2,6 sn (Gelir Tablosu ile ortak) · mutabakatın beklenenleri (cari listesi 0,7–1,0 + SQL 0,3–0,4 sn; B-d) · kilitli kipte donmuş dönemin TAMAMININ madde madde okunması 1,75–1,92 sn
  (karma yevmiye; Gelir Tablosu yalnız yılını okur) · değerleme girdisi ~0,4 sn · Bilanço hesabı 0,8–1,2 sn (yıl başına Gelir Tablosu çağrısı fe693f47'den beri yalnız kendi yılının maddeleri).
  Gelir Tablosu önce (c6h2-taban) / sonra (tur 2) AYNI kopyada: kilitsiz yıl en iyi 2.835 → 2.959 ms (+%4,4), ortanca 2.956 → 3.051 (+%3,2); Ç2 2.844 → 2.885 / 2.986 → 3.089; kilitli yıl 3.362 → 3.196 /
  3.462 → 3.255; Ç2 3.195 → 3.064 / 3.230 → 3.366 (+%4,2) — %10 ölçütünün altında, KÖTÜLEŞEN YOK.

- B-g (b) TASARIMI (tur 3, 20.11.2026; BAŞ MİMAR KARARI 20.11 11:37 — koddan ÖNCE yazıldı; DAVRANIŞ AYNEN, yalnız hız): kilitli kipte donmuş dönem madde madde okunmaz, `ledger_snapshots`'tan
  TEK okuyucu `frozenSums(store, { from, through, split })` (lib/ledger-snapshots.mjs'in sonunda; var olan işlevler değişmez) iki toplu SQL ile okunur: (1) satır toplamı GROUP BY yıl × kısım
  (tarih ≥ split) × kimlik öneki × 'voucher' öneki × hesap × alt hesap × cari → Σ(borç − alacak), satır sayısı, en geç tarih; (2) madde toplamı GROUP BY run, entry_id, date (frozenTrial'ın
  "dengesiz madde" tanımı) → yıl × kısım başına madde sayısı ve dengesiz madde sayısı. Kimlik öneki SQL'de `classOf`'un AYNI kuralıyla (ilk ':' öncesi; ':' yoksa son karakter hariç) — donmuş
  madde `entryClass`'ını kimlik önekinden alır (frozenEntries `cls` vermez), toplam da öyle. Seyrek ek okuma `firstSeen(hesaplar)`: sınıflandırılmamış hesapların (1–5'te planda olmayan,
  6 / 7'de önekle sınıflanamayan) İLK görünüş sırası (Kesin Değil ayrıntısının sırası eski okumayla aynı kalsın; çoğu veride hiç çağrılmaz).
  - Boyut: hesap / alt hesap / cari Bilanço'nun hücre anahtarıyla (`hesap|alt|cari`) AYNI; Gelir Tablosu (hesap, alt) ve 153 / 621 / 6–7 yıl bilgileri aynı satırlardan JS'te (ikinci tarama yok).
  - Birleşme: donmuş dönem = [başlangıç, min(t, kapsam)] toplamları; kapsamın sonrası `ledger.book({ from: kapsam + 1 gün, to: t, live })` (karma yevmiyenin AYNI kuyruğu — bekleyen eski kurallı
    koşunun ara dilimi dahil; donmuş satır okumaz) madde madde. t ≤ kapsam ise kuyruk boş. Kilitsiz dönemde (kapsam yok ya da t'nin yılından önce biter — Gelir Tablosu) okuma AYNEN eski yol.
  - Ortak: `incomeStatement` / `estimatedCost` / `balanceSheet` / `periodRuleDiff` isteğe bağlı `frozen` girdisi alır (verilmezse kod ve sonuç eskisi). Gelir Tablosu ucu da AYNI okuyucuyu
    kullanır (kısım = a: [1 Ocak, a − 1] yalnız 153 akışı; [a, min(b, kapsam)] tablo) — Bilanço'nun hesaplanmış satırları zaten `incomeStatement`'ın kendisi (iki formül yok).
  - Kural Değişikliği Farkı: donmuş tarafın yıl × hesap toplamı (kimliği 'voucher' ile başlamayanlar) aynı okumadan; güncel taraf `live` (değişmedi).
  - Nasıl bozulur → test: kilit t'nin içinde / dışında (t < kapsam, t = kapsam, t > kapsam; Gelir Tablosu a ≤ kapsam < b, kapsam < a); kilit açıldı → yeniden kilitlendi (yeni koşu, eski satırlar
    silinir); kural değişikliği farkı olan kilitli yıl (test kancası `__testLedgerRule`); iki şirket; yedek → geri yükleme; boş donmuş dönem (kilit var, satır yok); aynı gün sırası (ders 31).
    Eşdeğerlik: yeni okuma ↔ eski okuma (aynı süreçte eski bileşim: `book()` maddeleri + aynı saf işlevler) ve c6h2-uc kodu ↔ yeni kod (aynı veri kopyası, uçların tam JSON'u) BİREBİR.
  - ÖLÇÜLDÜ (20.11, tur 3; temiz 100 bin, AYNI kaynak kopya, yük başta 1,0–1,8; kanıt docs/kanit/2026-11-20/c6h3-hiz100k-*): yanıtların sha256 özeti eski ↔ yeni 13 istekte AYNI (iki kip,
    iki şirket). KİLİTLİ (30.06.2026) Bilanço ortanca eski 7,10–7,99 sn → yeni 5,53–6,15 sn (en iyi 6,51–7,42 → 5,15–5,27); Gelir Tablosu ortanca eski 4,11–4,20 → yeni 3,45–3,68 sn.
    KİLİTSİZ yol aynı kod (frozen yok): ilk koşuda Bilanço ortanca eski 5,18–5,49 ↔ yeni 5,45–6,05 (en iyi 4,82–4,97 ↔ 4,89–5,33), Gelir Tablosu 3,23–3,57 ↔ 3,29–3,59 — yeni önce
    koşmuştu; sıra ters çevrilerek YİNELENDİ (aşağıda). Olay döngüsü istek başına en çok 9,5–56,7 ms (bir ilk istekte 225 ms).
    Bütçe (≤ 3 sn) HÂLÂ aşılıyor. Parça (yeni kod, kilitli, iş parçacığısız): check() 3,45–4,05 sn (canlı türetme 2,26–2,68 + beklenenler) · donmuş toplam SQL 1,16–1,62 sn · biçimlendirme
    11–22 ms · kuyruk 15 ms · kural farkı 0,10–0,13 · değerleme girdisi 0,44–0,48 · Bilanço hesabı 0,12–0,17 sn. Kilitsiz: check() 3,48–4,18 · değerleme 0,42–0,55 · Bilanço hesabı 0,81–0,86 sn.

## 9. Nasıl bozulur? (testler buradan; plan §9 madde 6, 8, 9, 10)
1. 7/A yansıtma (760 → 631, 770 → 632, 780 → 660); iade 610 ve .90; POS komisyonu 653; kredi faizi 780 → H; vergi ödemesi gecikme zammı 689 → J; boş dönem; tek kayıt; çeyrek sınırı (31.03 / 01.04).
2. Değerleme: elle hesaplanmış örnekler — iki yıl (DBS = önceki yıl DSS), alış iadesi birim maliyeti düşürür / yükseltir, müşteri iadesi değiştirmez, eksi stok (KG-9) ve eksi dönem başı (M5),
   alışsız ürün (KG-10 kart fiyatı / fiyat yok), açılış (M-07) sonradan, hizmet kalemi, G-1 yarım yukarı, 29 Şubat, yıl ortası tahmini ve aylar toplamı = yıl.
3. Tarih: ay / çeyrek / yıl sonu, 29 Şubat, sahte saat (ders 13, 22); TZ=UTC ve TZ=Europe/Istanbul.
4. Kilitli dönem: donmuş defterden okunur (kural değişikliği benzetiminde kilitli dönemin Gelir Tablosu değişmez; Kural Değişikliği Farkı nedeni görünür); kilitsiz dönem canlı.
5. Yetki: Muhasebe görür, Personel / Avukat 403. İki şirket: biri öbürünün sayılarını görmez. Yedek → geri yükle → aynı sayılar.
6. Hacim: temiz 100 bin satırda yıllık + çeyrek Gelir Tablosu ve değerleme süresi + olay döngüsü.
7. İş parçacığı ↔ iş parçacığısız sonuç birebir; önbellek veri değişince düşer.
8. Bilanço (tur 2): brütleştirme ↔ netleştirme (aynı hesapta borçlu ve alacaklı iki cari); düzenleyici hesabın işareti; 153 = DSS_t (defterden değil); hesaplanmış Dönem Net Kârı = aynı t'nin Gelir
   Tablosu (bir gün kaydırma yakalanır); Geçmiş Yıllar — Kapanmamış'ta kapanmış yıl sayılmaz; ters kaydı yazılmış kapanış fişi yılı kapatmaz; Aktif = Pasif (boş veri, tek kayıt, tam veri, kilitli ve
   kilitsiz t, kapanmamış önceki yıl); fark satırı (dengesiz madde); hesap toplamları = Hesap Planı Mizanı 1–5 (brütleştirme yalnız kalem değiştirir); aynı gün kayıtlarının sırası (ders 31) sonucu
   değiştirmez; iki şirket karışmaz; yedek → geri yükleme → aynı Bilanço; t = ay / çeyrek / yıl sonu, 29 Şubat, gelecek tarih.
9. B-a: kapanmış yılın ay / çeyrek parçalarının toplamı = 621 (yıllık); S209: kırpılan tutar ayrıntıda, Gelir Tablosu ve Bilanço aynı değerleme.

## 10. Açık sorular (koddan ÖNCE yazıldı; yanıta kadar kod en geri alınabilir davranışta)
- S-a KULLANICIYA SORULMALI (para — ders 43): silinmiş ürün kartının kalan miktarı dönem sonu stokuna girsin mi? A (kodlanan): girmez — silindiği günden itibaren değeri 0, alışları satışların
  maliyetine (programın envanter raporlarıyla aynı). B: girer — miktar × birim maliyet (defterde 153 alışları duruyor). Yaygın programlarda: hareketli stok kartı silinmez (DOĞRULANMADI).
- S-b KULLANICIYA SORULMALI (para): iki mali yıla taşan özel aralıkta satışların maliyeti. A (öneri): yıl yıl parçalara bölünür (her parça T(b) − T(a − 1); toplanabilirlik korunur). B: özel aralık tek mali
  yıl içinde olmak zorunda (bugünkü kod: 400). C (uç durum): böyle kalsın (BİLİNEN SINIR).
- ~~S-c~~ → S209 = B (kullanıcı kuralıyla öneri uygulandı 19.11 22:45): 0'a kırpılır + Kesin Değil (tur 2 kodladı — §7).
- ~~B-a~~ → BAŞ MİMAR KARARI 19.11 22:45: öneri KABUL, tur 2 kodladı (§4, §7). Eski metin: (D4 zamanı) kapanmış yılın (N-01 yazılmış) ara dönemi — ay / çeyrek Gelir Tablosu tahmin mi, 621 mi; bu turda "yılda 621 varsa o yıl kesin, tahmin yok" (aylar toplamı
  o yılda yalnız Aralık'ta SMM gösterir). Öneri: kapanmış yılın [a, b] < 31.12 parçasında da T(b) − T(a − 1) ve N-01'in 621'i yalnız 31.12'yi içeren parçada T(31.12) − T(a − 1) ile değiştirilir.
- B-b BAŞ MİMAR KARARI GEREKİYOR: stok ↔ 153 ayrışması uyarı mı Kesin Değil nedeni mi (kod: uyarı; tutar gösterilir).
- B-c BAŞ MİMAR KARARI GEREKİYOR (hacim): 100 bin satırda süre bütçenin (≤ 3 sn) sınırında / az üstünde (kilitli kipte ortanca en çok 3,47 sn). Seçenekler: (a) BİLİNEN SINIR (2.1.0 "bütçeyi az aşanlar
  BİLİNEN SINIR" kararı; önbellek yinelenen açılışı ~5 ms yapar); (b) kilitli dönemin yıllarında donmuş defter toplamını SQL ile okuyup canlı türetmeyi yalnız açık döneme kısmak (ledger.mjs / ledger-snapshots
  değişikliği — bu turun dosya sınırı dışında). Öneri (a) şimdi, (b) Ç6-EKRAN ile birlikte ölçülerek.
- ~~B-d~~ → BAŞ MİMAR KARARI 19.11 22:45: "Defter mutabakatı farkı" Bilanço'nun Kesin Değil nedeni — tur 2 kodladı (§6, §7; `ledger.check()`'in mutabakatı).
- B-e BAŞ MİMAR KARARI GEREKİYOR (tur 2): kitap §7.3 "biten ay mahsupsuzsa bilgi uyarısı" ve EK-2 S. 34 "Önceki Yıl KDV Mahsubu Yapılmamış" (Kesin Değil) 191 / 391'in KDV DÖNEMİ boyutuna bağlı
  (EK-1 M8; KG-7 A alanı) — defter satırı bugün dönem taşımıyor, alan Ç7b'nin türetme dosyalarında (dosya sınırı dışı). Öneri: Ç7b birleşince Ç6-EKRAN ile birlikte (toplayıcıda kod hazır); o
  zamana kadar Bilanço bu nedeni YAZMAZ (verilmeyen bulgu denetlenmemiştir) — kullanıcının gördüğünü etkiler, 2.5.0'da kalır.
- B-f BAŞ MİMAR KARARI GEREKİYOR (sınıflama — kitap §9: baş mimar + mali müşavir): alacaklı 127 (carisiz taksit kartı) planda "karar"; EK-2 S. 36 önerisi Pasif III.D 340, kart bazında brüt — tur 2
  bu öneriyle KODLADI (sessiz varsayım değil: burada ve raporda). Seçenek: 127 kendi kaleminde eksi + Kesin Değil. Net kâr ve özkaynak iki seçenekte aynı; MA'da mali müşavir A onaylar.
- B-g BAŞ MİMAR KARARI GEREKİYOR (hacim, tur 2): Bilanço 100 bin satırda kilitsiz ~4,7 sn, kilitli ~6,6 sn (bütçe ≤ 3 sn; olay döngüsü bütçe içinde). Payı bu turun dosyalarında olmayan üç kalem: canlı
  türetme (B-c ile aynı), mutabakatın cari listesi (B-d'nin bedeli ~1,0–1,4 sn), kilitli kipte donmuş dönemin bütününün madde madde okunması (~1,8 sn). Seçenekler: (a) BİLİNEN SINIR (önbellek
  tekrarı 4–11 ms; "az aşan" değil — kullanıcı ilk açılışta ~5–7 sn bekler); (b) donmuş dönemin (hesap, alt hesap, cari) ve yıl × 6 / 7 toplamlarını SQL ile okuyan bir `ledger-snapshots` işlevi (trial()
  deseni) — kilitli kipte ~−1,8 sn; (c) mutabakat sonucunu Mutabakat Testi'nin son tam taramasından okumak (integrity.mjs'e okuyucu; sonuç en çok 15 dk eski) — ~−1,2 sn; (d) B-c (b) ile canlı türetmeyi
  açık döneme kısmak. Öneri: (b) + (c) Ç6-EKRAN'dan önce dosya izniyle (kilitli ~3,6 sn, kilitsiz ~3,5 sn bekleniyor — ÖLÇÜLMEDİ), kalan aşım (d) ile; o zamana kadar (a). → BAŞ MİMAR KARARI 20.11 11:37: (b) tur 3'te (tasarım §8 'B-g (b) TASARIMI'); (c) REDDEDİLDİ; tur 3'ten sonra süre hâlâ bütçeyi aşıyorsa kullanıcıya sayıyla sorulur.
