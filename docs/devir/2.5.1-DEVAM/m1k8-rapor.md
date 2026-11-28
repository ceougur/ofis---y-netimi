# KDV Özeti küçük tur 8 — rapor (ajan; taban t251-aday-taban = 4c94030c)

Kapsam: mali müşavir S ORTA-1 (mahsuptan sonra İndirilecek KDV azalışı; sonraki aylar zaten mahsuplu → azalma raporun hiçbir ayında düşülmüyordu; kayıtsız ay
zincirde yoktu) + aynı sınıf: dar kontrol tur 6 + 7 DOĞRULANMADI (fişsiz hareketsiz ayın tek ay raporu ön izlemeden ayrılıyordu, tohum 86) + 27.11 B maddesi
(hareketsiz sonraki ay tek başına seçilince not yok). Mahsup fişi, ön izleme ve defter DEĞİŞMEDİ (fark betiği 600 / 600); istemci görünümüne dokunulmadı.

## 1. Değişen gözlenebilir davranış (KDV Özeti (Beyanname Hazırlığı) raporu — ekran, PDF, Excel)

Örnek: ana oturumun orta1 vakası (bugün 03.08.2026; Ocak–Haziran mahsuplu, sonra Şubat'ın 500 KDV'li alışı İptal Et):

| Görünüm | Önce (taban) | Sonra |
|---|---|---|
| Bu Yıl — Ödenecek KDV | 1.500 (391 3.900 − 191 1.900 = 2.000; 500 KAYIP) | **2.000** = 391 − 191 |
| Bu Yıl — tabloda Temmuz | satır yok | "Temmuz 2026 · Önceki Dönem İndirilecek KDV Azalışı (Şubat 2026) · 500,00 TL" + "Temmuz 2026 · Ödenecek KDV · 500,00 TL" |
| Bu Yıl — not | yalnız "Şubat … azalma sonraki mahsupta düşülür" | ayrıca **İndirilecek KDV Azalışı Düşülen Ay**: "Temmuz 2026: 500,00 TL (Şubat 2026) (önceki ayların mahsubundan sonra girilen, İndirilecek KDV'yi azaltan kayıtlar bu ayın İndirilecek KDV'sinden düşüldü; ödenecek ya da devreden KDV bununla hesaplandı)" |
| Temmuz (kayıtsız) tek ay / Geçen Ay | 0 / 0 / 0 (ön izleme 0 / 500 / 0) | **0 / 500 / 0 = ön izleme**; özette tutar kartı "Önceki Dönem İndirilecek KDV Azalışı (Şubat 2026) 500,00 TL" + not |
| Temmuz'a satış KDV 100 | 0 / 600 / 0, açıklayan satır / not YOK (600 ≠ 100) | 0 / 600 / 0 + özet satırı 500 → 100 + 500 = 600 |
| Ağustos (Bu Ay, kayıtsız, Temmuz mahsupsuz) | 0 / 0 / 0, not yok (ön izleme 500) | 0 / 0 / 0 + "Mahsup Edilmemiş Ay: Temmuz 2026 (…)" — ön izlemeden farkı söyler |
| Ocak–Haziran | 1.500 | 1.500 (AYNEN — S-DKM1-1 = A: azalma yalnız sonraki ayda; not "sonraki mahsupta düşülür") |

Genel kural (kodda): KDV Özeti zinciri ilk KDV ayından **bugünkü aya kadar (bugünü aşmadan)** takvim aylarını dolaşır; 391 / 191 satırı ve fişi olmayan (kayıtsız) ay
yalnız S4 birikimi (önceki fişlerden sonra girilen, İndirilecek KDV'yi azaltan kayıt) varsa adımdır ve azalma orada düşülür (mahsup ön izlemesinin yazacağı sayı);
birikim yoksa eskisi gibi adımsız (sayılar aynı). Her adım düştüğü azalışı ve geldiği ayları taşır:
- **Çok aylı tabloda** (tam aylar): ayın "Önceki Dönemden Devreden KDV" satırından sonra "Önceki Dönem İndirilecek KDV Azalışı (<ay(lar)>)" satırı (fiş azalışı düşmüş
  zincirdeki ayda da — S4'ün normal akışı: ör. Ocak azalışı Şubat'ın fişinde düşüldüyse Şubat satırı).
- **Özette tutar satırı** yalnız azalış aralığın BAŞINDAN önceki aylardan geliyorsa (aralık içindeki azalış 191 toplamında zaten var — iki kez görünmez); böylece
  Ödenecek − Sonraki + Önceki = 391 − 191 + bu satır.
- **Not** "İndirilecek KDV Azalışı Düşülen Ay": aralıkta azalış düşülen her ay, tutarı ve geldiği ay(lar) (en çok 6 ay, sonra "ve N ay daha").
- Azalışın düşüldüğü mahsupsuz kayıtsız ay, sonraki ayların "Mahsup Edilmemiş Ay" notuna girer.

Örnek tablolar (testte elle yazılı): 002 fişsiz hareketsiz Mart (tohum 86 sınıfı): Şubat alışı (KDV 300) İptal Et → Mart 0 / 300 / 0 = ön izleme (taban 0 / 0 / 0),
Nisan 500 + "Mahsup Edilmemiş Ay: Mart 2026" (ön izleme 800), Ocak–Nisan 2.500 = 391 3.500 − 191 1.000; yıl dönümü: Aralık azalışı (200) Ocak 2027'de, satır
"(Aralık 2026)"; iki azalış ayı: "(Ekim 2026, Kasım 2026)" 400, Kasım–Ocak aralığında özet satırı yalnız "(Ekim 2026) 200,00 TL"; devreden yönde: Temmuz 1.200 devredenle
−200 → 1.000 = ön izleme (taban 1.200 / 0 / 1.200), Ağustos 1.000.

Varolan raporlarda **sayı değişmedi** (eski beklentili 74 testin hepsi, satır / not eklemesi çıkarılmış kopyada 74 / 74 yeşil); değişen yalnız yeni satır / not ve
kayıtsız ayın sayıları.

## 2. Değişen dosyalar
- `server/routes/tax.mjs` — `vatView`: `nextMonth`; `span` (KDV'li aylar + ilk KDV ayından bugünkü aya kadar kayıtsız aylar); `runChain` kayıtsız ayı S4 birikimi varsa
  adım yapar; `absorb` (S4 birikimine giren azalışlar, eski olandan başlayarak düşülür → `reducedMinor`, `reducedFrom`, `reducedParts`); `positionIn` önceki ADIMDAN
  devreden alır; `resultMonths` (sonucu olan aylar) — `pending`, `staleBefore` bununla; görünüme `resultMonths` eklendi. Ön izleme, fiş yazımı, `listOf`, `monthPosition`
  DEĞİŞMEDİ.
- `server/routes/report-center.mjs` — KDV Özeti: pozisyonlar `view.resultMonths`'tan; tablo satırı, özet tutar satırı, not.
- Testler: yeni `test/kdv-ozeti-kayitsiz-ay-251.test.mjs` (8); `test/kdv-ozeti-rastgele-251.test.mjs` (değişmez + ikinci evre); beklentisi değişen (ders 28, yalnız yeni ay
  satırı): `kdv-ozeti-karma-251`, `kdv-ozeti-mahsup-sonrasi-251`, `kdv-ozeti-s4-guncel-degil-251`, `kdv-ozeti-yalniz391-251`.
- Kanıt `docs/kanit/2026-11-28/m1k8/`.

## 3. TARAMA (değişen işlevlerin çağıranları — `git grep`)
| İşlev / alan | Çağıran | Durum |
|---|---|---|
| `vatView()` | yalnız `server/routes/report-center.mjs` (KDV Özeti) | denendi |
| `resultMonths` (yeni) | report-center KDV Özeti; `vatView.pending` / `staleBefore` | denendi |
| `positionIn`, `runChain`, `absorb` | `vatView` içi (`position`, `staleBefore`'un ikinci zinciri) | denendi (K4–K7 mutantları) |
| `monthPosition`, `preview`, `listOf`, `offsetList`, POST / reverse | DEĞİŞMEDİ | fark betiği: ön izleme / fiş / defter 150 / 150 × 4 |
| KDV Özeti'ni okuyan testler | `git grep -l "vat-offset\|vatView\|kdv-ozeti" test/*.test.mjs` → 33 dosya + yazım düzeni | 346 / 346 iki TZ |
| Ekran senaryoları | senaryo-kdv-mahsup-sonrasi-251, -kdv-zincir-251, -kdv-devreden-251, -kdv-donemi-250, -c7b-kabul-250, -defter-243 | 12 / 12 koşu yeşil |
| İstemci | `client/assets/hof-report-center.js` özet satırını değerine göre kart / not ayırır (tutarlı → kart) — DOKUNULMADI | ekran senaryoları |

## 4. Yeni / değişen testler — kırmızı nedeni (taban) ve yeşil (yeni), iki TZ
| Test | Taban UTC / İst | Yeni UTC / İst | Taban kırmızı NEDENİ (ileti okundu) |
|---|---|---|---|
| kdv-ozeti-kayitsiz-ay-251 (8) | 2 / 8 geçti (6 kırmızı) · aynı | 8 / 8 · 8 / 8 | "Bu Yıl Ödenecek 2.000 (taban 1.500)", "Temmuz raporu = ön izleme (taban 0 / 0 / 0)", "açıklayan özet satırı (taban: yok)", "Mart raporu = ön izleme (taban 0 / 0 / 0)", "Ocak 2027 raporu = ön izleme", "002 Temmuz raporu = ön izleme (taban 1.200 / 0 / 1.200)" |
| — yeşil kalan 2 | ilk it (iptalden önceki taban sayıları — ön koşul) ve 27.11 B'nin 001 kısmı | | 27.11 B tabanda ZATEN kapalı (tur 6'nın "Güncel Olmayan Önceki Fiş" notu çıkıyor); aynı it'e eklenen 002 devreden kısmı tabanda kırmızı |
| kdv-ozeti-rastgele-251 (300 + 150 tohum) | 0 / 2: 231 / 300 ve 119 / 150 tohum sapma (UTC ve İstanbul aynı) | 2 / 2 · 2 / 2 | "2. evre kayıtsız 2026-08: rapor 0 / 0 / 0 ≠ ön izleme 0 / 90000 / 0 (açıklayan not yok)", "2. evre … Ödenecek − Sonraki + Önceki 320000 ≠ 391 − 191 410000"; 1. evrede 39 kayıtsız ay sapması (tohum 86 sınıfı) |
| beklentisi değişen 4 dosya | — | yeşil (8 dosya 74 + kayıtsız 8 = 82, iki TZ — mutant koşularının orijinali) | yalnız yeni ay satırı; satırsız kopyada eski beklentiler 74 / 74 |

## 5. Kabul koşulları
- **A** yeni testler tabanda beklenen nedenle kırmızı, yenide yeşil iki TZ — yukarıda.
- **B** aralık özdeşliği ve "kayıtsız ay = ön izleme" rastgelede: yeni kodda 300 + 150 tohum × iki TZ sapma 0; tabanda 231 + 119 (iki TZ'de aynı). Fark betiğinde (ayrı üreteç,
  150 tohum × 2 set × 2 TZ) ikinci evrede aralık (bugünkü ayın sonuna kadar) 391 − 191 bozuk: yeni 0, taban 148 (her set); bugünkü ay rapor ≠ ön izleme 40 durumun 40'ı
  son ayın fişi reddedilmiş (kayıtsız → azalış onda, bugünkü ay "Mahsup Edilmemiş Ay" notlu — açıklamalı, rastgele testin değişmezi bunu ayrıca denetler).
- **C** ön izleme / fiş / defter (190, 191, 391, 360) tabanla BİREBİR: 150 / 150 × 4 (UTC / İstanbul × ay / yıl dönümü); kâhin defter 187 denetim, 0 fark, iki TZ.
- **D** mutantlar: 17'nin 14'ü iki TZ'de yakalandı (N7 ilk koşuda yaşadı → test eklendi → yakalandı); yaşayan K7, K8, K9 tur 6 + 7 dar kontrolünde de yaşamıştı (K7 eksik
  test, K8 / K9 davranışı değiştirmeyen — iş listesi B'de).
- **E** komşular 346 / 346 iki TZ; ekran senaryoları 6 × 2 yeşil (57, 12, 14, 23, 39, 33).
- **F** hız kötüleşmedi (aşağıda).

## 6. Mutant tablosu (birim: 9 KDV Özeti dosyası, 82 test)
| Mutant | UTC | İstanbul |
|---|---|---|
| K1 absorbShort hep yok | YAKALANDI (5) | YAKALANDI |
| K2 ilk ay uyuşmayan fiş sayılmaz | YAKALANDI (1) | YAKALANDI |
| K3 devreden farkı onarım ayı boş | YAKALANDI (23) | YAKALANDI |
| K4 kısa not etki denetimi yok | YAKALANDI (4) | YAKALANDI |
| K5 kısa not yalnız ilk ay (satırı küçük tur 8'e uyarlandı: `resultMonths`) | YAKALANDI (3) | YAKALANDI |
| K6 dondurulan ay bugünkü İ (satırı uyarlandı: `absorb(…)`) | YAKALANDI (4) | YAKALANDI |
| K7 kısa not karma hariç | YAŞADI (tur 6 + 7'de de) | YAŞADI |
| K8 eksi yön kendi ayı yok | YAŞADI (tur 6 + 7'de de) | YAŞADI |
| K9 onarım en geç ay | YAŞADI (tur 6 + 7'de de) | YAŞADI |
| N1 kayıtsız ay zincire girmez | YAKALANDI (5) | YAKALANDI |
| N2 azalış ay satırı yok | YAKALANDI (15) | YAKALANDI |
| N3 azalış özet satırı yok | YAKALANDI (5) | YAKALANDI |
| N4 azalış notu yok | YAKALANDI (3) | YAKALANDI |
| N5 azalış kaynağı son giren önce | YAKALANDI (1) | YAKALANDI |
| N6 özet satırı aralığın ilk ayını da sayar | YAKALANDI (1) | YAKALANDI |
| N7 hareketsiz ay devredeni KDV'li son aydan | ilk koşu YAŞADI → test eklendi (f4408ec6) → YAKALANDI (1) | aynı |
| N8 kayıtsız ay 'Mahsup Edilmemiş Ay' sayılmaz | YAKALANDI (3) | YAKALANDI |

## 7. Hız (temiz-100k kopyası, aynı veri, eski → yeni → yeni → eski; özel kilit; yük başta 0,60–1,08 / 4 çekirdek; ortanca ms)
| Yol | eski 1 | yeni 1 | yeni 2 | eski 2 |
|---|---|---|---|---|
| Bu Yıl (2026) | 2.199 | 2.096 | 2.237 | 2.267 |
| Tüm Zamanlar | 2.437 | 2.188 | 2.294 | 2.293 |
| Tek ay (Nisan) | 2.170 | 2.123 | 2.360 | 2.143 |
| Nisan–Aralık | 2.078 | 2.155 | 2.201 | 2.284 |
| Tek ay (Temmuz) | 2.072 | 2.107 | 2.230 | 2.214 |
Kötüleşen yok (farklar eski ↔ eski oynaklığı içinde, en çok ~%10; yeni ↔ eski en çok +190 ms Tek ay Nisan'da yeni 2'de, eski 1 ↔ eski 2 arası da 230 ms oynuyor).
Yeni sorgu yok; ek iş bellekte, ay başına bir `monthPosition` (kayıtsız ay sayısı kadar).

## 8. KULLANICIYA SORULMALI
Yok. Kararların söylemediği yeni bir sayı ayrışması çıkmadı: azalışın düştüğü ay S4 kuralının (ön izlemenin) ayı; "kayıtsız ay = ön izleme" ve "aralık 391 − 191"
kararların (S-DKM1-1 = A, S-M1K3-1 = A) doğrudan sonucu.

## 9. BAŞ MİMAR KARARI GEREKİYOR (yorumlar — değerlendir)
1. **Satırın yeri ve özet satırının kapsamı**: ay satırı her azalış düşülen ayda (fiş azalışı zaten düşmüşse de); özet tutar satırı YALNIZ azalış aralığın başından önceki
   aydan geliyorsa (aralık içi azalış 191'de var — ikinci kez gösterilirse 391 − 191 + satır ≠ Ödenecek görünür). Karar metni "satır + not" diyor, kapsamı söylemiyor.
2. **Tablo altı (TOPLAM satırları)** değişmedi — azalış satırı tablo altına eklenmedi (tek ay raporunda tablo satırı yoksa tablo altı da yok; özet hepsini taşır).
3. **Not adı** "İndirilecek KDV Azalışı Düşülen Ay" (yazım düzeni) — karar metninde ad yok.
4. **Azalışın kaynak ayı** birden çok azalış birikince eski olandan başlayarak düşülür (ön izlemenin S4 toplamı ayları ayırmıyor; ad yalnız açıklama). Uç durum: fiş azalışı
   düştükten sonra aynı ayın kendi İndirilecek KDV'si de azalırsa (sayılar doğru) kalan azalış ilk ayın adıyla görünebilir.
5. Paralel UI turu özet kartlarının yerleşimini değiştiriyorsa yeni tutarlı özet satırı (tutar kartı) o turun düzenine girmeli — istemci kodu bu turda okunup DOKUNULMADI;
   kart / not ayrımı değerine göre (tutar → kart).

## 10. SONRAKİ SÜRÜME (20.11 kuralı)
- K7 / K8 / K9 yaşayan mutantlar (tur 6 + 7'den — B'de); bu turda değişmedi.
- "Mahsuptan Sonra Değişen Ay" notunun "azalma sonraki mahsupta düşülür" cümlesine düşüldüğü ayın adı eklenebilir (Ocak–Haziran gibi azalışın düştüğü ayı içermeyen
  aralıkta) — sayılar doğru, görünüm ayrıntısı.
- D-1 (tur 6 + 7: "Güncel Olmayan Önceki Fiş" notunun sayılar eşitken çıkması) bu turda değişmedi.

## 11. DOĞRULANMADI
- Ekran görüntüsüne BAKILMADI (ekran senaryoları yeşil, yeni satır / kart ekranda gözle görülmedi) — ana oturumun ekran yürüyüşünde (Temmuz kayıtsız, Bu Yıl tablosu).

## 12. DENENMEYEN
- Tam `npm test` (görev gereği ana oturumda); Windows (CI'de).
- Dönem kilidi (Dönem Kilidi) altında kayıtsız ay; mahsup fişi tablosu olmayan eski şema (kod yolu: `busy` boşsa `span` boş — değişmedi).
- Fişsiz hareketsiz ayın DEVREDEN taşıması (S4'süz) — davranış değişmedi (adımsız).
- 1.000.000 satırda hız.

## 13. CI listesine eklenecek
Yeni ekran senaryosu yok. Yeni birim testi `test/kdv-ozeti-kayitsiz-ay-251.test.mjs` `npm test` deseniyle (test/*.test.mjs) zaten koşar.

## 14. Kılavuz metni önerisi (KDV Özeti)
"Bir ayın mahsubundan sonra o aya ait bir alış faturasını iptal ederseniz İndirilecek KDV'deki azalma, mahsubu henüz yapılmamış ilk ayda düşülür. KDV Özeti'nde o ayın
altında 'Önceki Dönem İndirilecek KDV Azalışı' satırını ve azalmanın hangi aydan geldiğini görürsünüz; o ayı mahsup ettiğinizde fiş de aynı tutarı yazar."

## 15. Commit listesi (dal ucu aşağıda)
- de97f8a3 NASIL BOZULUR listesi (koddan önce)
- 03fcb70a kod: zincir kayıtsız ayları dolaşır, azalış satırı ve not
- 06701f39 testler: kayıtsız ay testleri + azalış satırı beklentileri
- ce0f5a26 rastgele testte kayıtsız ay değişmezi + ikinci evre
- f4408ec6 devreden yönde kayıtsız ay testi (N7)
- d80a371f Kanıt
- (bu rapor commit'i)

## 16. Ana oturumun yeniden koşacağı komutlar
```
cd <dal>; for tz in UTC Europe/Istanbul; do TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/kdv-ozeti-kayitsiz-ay-251.test.mjs test/kdv-ozeti-karma-251.test.mjs test/kdv-ozeti-mahsup-sonrasi-251.test.mjs test/kdv-ozeti-s4-guncel-degil-251.test.mjs test/kdv-ozeti-yalniz391-251.test.mjs test/kdv-ozeti-zincir-251.test.mjs test/kdv-ozeti-devreden-251.test.mjs test/kdv-ozeti-devreden-onarim-251.test.mjs test/kdv-ozeti-uyusmazlik-yonu-251.test.mjs; done
TZ=UTC node --test test/kdv-ozeti-rastgele-251.test.mjs          # ~6 dk; taban kopyasında kırmızı (kayıtsız ay ≠ ön izleme)
eski kopya: git worktree add --detach <yer> t251-aday-taban; yalnız test/kdv-ozeti-kayitsiz-ay-251.test.mjs ve test/kdv-ozeti-rastgele-251.test.mjs kopyalanır
ROOT=<kod> node /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ms251rk/orta1.mjs   # Bu Yıl 2.000, Temmuz 0 / 500 / 0
npm run test:kahin-defter ; ekran: npm run test:senaryo-kdv-mahsup-sonrasi-251 (ve beş komşu)
```
