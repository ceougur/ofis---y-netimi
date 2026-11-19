# Ç6-HESAP Tasarım Notu — mali tabloların HESABI (2.5.0 muhasebe çekirdeği)

Durum: TASARIM (19.11.2026, Ç6-HESAP tur 1 kod ajanı; koddan ÖNCE yazıldı). Kaynaklar (AYNEN okunur, burada özetlenir): çekirdek planı
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
| `server/lib/financial-statements-worker.mjs` | Rapor iş parçacığı: salt okunur bağlantı, tek okuma işlemi; Ana Defter servisini (`registerLedgerRoutes`, freeze-worker deseni) kurar, `book()` + değerleme + hesap. |
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
  (KG-9 eksi stok, KG-10 kart fiyatı / fiyat yok, eksi birim maliyet, silinmiş ürün).
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
- Yılda 621 hareketi (N-01 yazılmış — D4 kapanışı) varsa o yılın satışların maliyeti defterdeki 621'dir (kesin; tahmin eklenmez); yoksa tahmini + "Kesin Değil — Satışların Maliyeti Tahminidir".
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

## 6. Bilanço (tur 2 — anahat; bu turda KOD YOK)
asOf = t; 1–5 sınıfı t sonu bakiyeleri (kapanış sınıfı dahil) `book({ to: t })`; ters bakiye brütleştirmesi `reverseBalanceOf` (cari / alt hesap / hesap boyutu, §7.3); 153 = DSS_t (tahmini, KG-11 A);
hesaplanmış "Dönem Net Kârı" = t yılının 1 Ocak–t Gelir Tablosu Dönem Kârı (aynı `incomeStatement` çağrısı — iki formül YOK) ve "Geçmiş Yıllar — Kapanmamış" = önceki kapanmamış yılların
6 / 7 sonucu − T_Y (yıl yıl 570 / 580, KG-12 A); Aktif = Pasif; tutmazsa fark satırı + Kesin Değil (denkleştirme kaydı yok).

## 7. "Kesin Değil" ve dipnotlar
- TEK toplayıcı `notFinalReasons(facts)` (kitap §7.4 sırası): rapor kendi bilgisini (facts) verir, toplayıcı kod + Türkçe metin + ayrıntı listesi döndürür; Gelir Tablosu ve Bilanço AYNI işlevi çağırır.
  Tur 1'de Gelir Tablosu'nun nedenleri: satışların maliyeti tahmini (KG-11); eksi stok (KG-9; t = b ve a − 1); dengesiz madde (dönemin maddelerinde Σ B ≠ Σ A); Kural Değişikliği Farkı (kapsam
  dönemin yıllarına değiyorsa `snapshots.ruleDiff`, 6 / 7 ya da 153 hesabında yıl satırı varsa); sınıflandırılmamış hesap; Defter Türü bilanço esası değil ("Bilgi Amaçlı"). Bilanço'nun
  nedenleri (519 ≠ 0, eksi kasa / imkânsız ters bakiye, borçlu 360, kapanmamış önceki yıl, önceki yıl KDV mahsubu, defter mutabakatı farkı — alt defter ↔ bilanço hesapları) tur 2'de AYNI toplayıcıya.
- Dipnotlar `footnotes(facts)` (§7.5): (1) yasal tablo değildir, (2) dönem sonu işlemleri yapılmaz, (3) "Kasa ve banka 'Diğer Gider' çıkışları (… TL)" = dönemin 770.90 tutarı, (5) Serbest Meslek
  Kazanç Defteri'nde, (6) .90 alt hesapların gelir ve gider tutarları (varsa). (4) krediler — Bilanço'nun. Metinler kitaptan AYNEN.

## 8. Okuma ucu, yetki, hacim
- `GET /api/workspace/financial-statements/income-statement?from=YYYY-MM-DD&to=YYYY-MM-DD` (varsayılan Bu Yıl) → { from, to, bookType, bilgiAmacli, items, subtotals, smm, kesinDegil, footnotes,
  warnings }; `GET /api/workspace/financial-statements/stock-valuation?date=YYYY-MM-DD` → değerleme (D3 / D4 / sürücü). Yetki Ana Defter raporlarıyla AYNI: `overview.view` (Yönetici + Muhasebe
  görür; Personel ve Avukat görmez).
- Hacim (plan §8; ders 47): 100.000 satırda ≤ 3 sn, olay döngüsü en çok ≤ 50 ms → hesap rapor iş parçacığında (salt okunur bağlantı, TEK okuma işlemi — WAL anlık görüntüsü; integrity-scan-worker /
  freeze-worker deseni); ana iş parçacığında yalnız ileti. Veri değişmedikçe önbellek (`store.changeCounters()` + bugün + kilit + parametreler; en çok 8 sonuç). İş parçacığı açılamazsa (veri
  tabanı yolu yok, açık işlem içinde) aynı işlev iş parçacığısız (sonuç aynı; test iki yolu karşılaştırır). Değerleme: iki toplu sorgu, ürün başına O(hareket).

## 9. Nasıl bozulur? (testler buradan; plan §9 madde 6, 8, 9, 10)
1. 7/A yansıtma (760 → 631, 770 → 632, 780 → 660); iade 610 ve .90; POS komisyonu 653; kredi faizi 780 → H; vergi ödemesi gecikme zammı 689 → J; boş dönem; tek kayıt; çeyrek sınırı (31.03 / 01.04).
2. Değerleme: elle hesaplanmış örnekler — iki yıl (DBS = önceki yıl DSS), alış iadesi birim maliyeti düşürür / yükseltir, müşteri iadesi değiştirmez, eksi stok (KG-9) ve eksi dönem başı (M5),
   alışsız ürün (KG-10 kart fiyatı / fiyat yok), açılış (M-07) sonradan, hizmet kalemi, G-1 yarım yukarı, 29 Şubat, yıl ortası tahmini ve aylar toplamı = yıl.
3. Tarih: ay / çeyrek / yıl sonu, 29 Şubat, sahte saat (ders 13, 22); TZ=UTC ve TZ=Europe/Istanbul.
4. Kilitli dönem: donmuş defterden okunur (kural değişikliği benzetiminde kilitli dönemin Gelir Tablosu değişmez; Kural Değişikliği Farkı nedeni görünür); kilitsiz dönem canlı.
5. Yetki: Muhasebe görür, Personel / Avukat 403. İki şirket: biri öbürünün sayılarını görmez. Yedek → geri yükle → aynı sayılar.
6. Hacim: temiz 100 bin satırda yıllık + çeyrek Gelir Tablosu ve değerleme süresi + olay döngüsü.
7. İş parçacığı ↔ iş parçacığısız sonuç birebir; önbellek veri değişince düşer.

## 10. Açık sorular (koddan ÖNCE yazıldı; yanıta kadar kod en geri alınabilir davranışta)
- S-a KULLANICIYA SORULMALI (para — ders 43): silinmiş ürün kartının kalan miktarı dönem sonu stokuna girsin mi? A (kodlanan): girmez — silindiği günden itibaren değeri 0, alışları satışların
  maliyetine (programın envanter raporlarıyla aynı). B: girer — miktar × birim maliyet (defterde 153 alışları duruyor). Yaygın programlarda: hareketli stok kartı silinmez (DOĞRULANMADI).
- S-b KULLANICIYA SORULMALI (para): iki mali yıla taşan özel aralıkta satışların maliyeti. A (öneri): yıl yıl parçalara bölünür (her parça T(b) − T(a − 1); toplanabilirlik korunur). B: özel aralık tek mali
  yıl içinde olmak zorunda (bugünkü kod: 400). C (uç durum): böyle kalsın (BİLİNEN SINIR).
- S-c KULLANICIYA SORULMALI (uç): alış iadesinin değeri alışlardan büyükse birim maliyet eksi çıkar (formül harfiyen). A: eksi değer + uyarı (kodlanan). B: 0'a kırpılır + Kesin Değil. C: uç durum böyle kalsın.
- B-a BAŞ MİMAR KARARI GEREKİYOR (D4 zamanı): kapanmış yılın (N-01 yazılmış) ara dönemi — ay / çeyrek Gelir Tablosu tahmin mi, 621 mi; bu turda "yılda 621 varsa o yıl kesin, tahmin yok" (aylar toplamı
  o yılda yalnız Aralık'ta SMM gösterir). Öneri: kapanmış yılın [a, b] < 31.12 parçasında da T(b) − T(a − 1) ve N-01'in 621'i yalnız 31.12'yi içeren parçada T(31.12) − T(a − 1) ile değiştirilir.
- B-b BAŞ MİMAR KARARI GEREKİYOR: stok ↔ 153 ayrışması uyarı mı Kesin Değil nedeni mi (kod: uyarı; tutar gösterilir).
