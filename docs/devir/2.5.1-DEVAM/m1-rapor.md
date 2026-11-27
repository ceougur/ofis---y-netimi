# M1 — KDV Özeti: Önceki Dönemden Devreden KDV (2.5.1; S261) — RAPOR

Taban `t251-taban` (64396478) → dal ucu: bu raporun son commit'i (`worktree-agent-a372b20f2d341697a`). PUSH YOK. Ortam (son okuma): yük 1,52 / 4 çekirdek, bellek boş 2 GB (kullanılabilir 9 GB), disk boş 13 GB.

## A. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra; Raporlar → Tüm Raporlar → KDV Özeti (Beyanname Hazırlığı))
1. **Tek ay, önceki aydan devreden var** (S261: Ocak alış KDV 2.000 + Ocak mahsubu; Şubat satış KDV 1.200 → Geçen Ay = Şubat):
   - ÖNCE: özet "Ödenecek KDV ₺1.200,00"; tablo altı tek "TOPLAM".
   - SONRA: özet ve tablo altı "Önceki Dönemden Devreden KDV ₺2.000,00 · Ödenecek KDV ₺0,00 · Sonraki Döneme Devreden KDV ₺800,00" — KDV Mahsup Fişi ön izlemesiyle (2.000 / 800 / 0) aynı. Ekran görüntüsü `docs/kanit/2026-11-27/m1-ekran/m1-kdv-ozeti-subat.png` (taban: `taban-m1-kdv-ozeti-subat.png`).
2. **Mali müşavirin örnekleri** (ma-rapor ORTA-1): Mayıs ÖNCE "Ödenecek KDV 1.200" → SONRA önceki 1.140 / ödenecek 60 / sonraki 0. Eylül ÖNCE "Net KDV (Ödenecek) 40" → SONRA önceki 2.000 / ödenecek 0 / sonraki 1.960. Yıl 2026 (bizim senaryomuzda) ÖNCE "Devreden KDV 1.900" → SONRA önceki 0 / ödenecek 60 / sonraki 1.960 (= defterdeki 190).
3. **Adlar:** "Hesaplanan KDV (391)" → "Hesaplanan KDV (391) (İadeler Düşülmüş)"; "İndirilecek KDV (191)" → "İndirilecek KDV (191) (İadeler Düşülmüş)" (değerler aynen). Eski özet satırı "Ödenecek KDV" / "Devreden KDV" (391 − 191) ve tablo altı "Net KDV (Ödenecek)" / "Net KDV (Devreden)" KALKTI; yerlerine üç satır HER ZAMAN (sıfırsa 0,00): Önceki Dönemden Devreden KDV, Ödenecek KDV, Sonraki Döneme Devreden KDV. Ekran = PDF = Excel (Excel özet sayfası dahil).
4. **Çok aylı aralık** (Bu Yıl, Tüm Zamanlar, elle aralık): tabloda her TAM ayın belgelerinin hemen altında ayın sonuç satırları ("Önceki Dönemden Devreden KDV" — kullanılan devreden varsa; ardından "Ödenecek KDV" ya da "Sonraki Döneme Devreden KDV"). Belge TOPLAM'ları (TOPLAM Satış / Satıştan İade / Alış / Alıştan İade) yalnız belge satırlarından, değişmedi. Örnek ekran: `m1-ekran/m1-kdv-ozeti-ocak-subat.png` (Ocak "Sonraki Döneme Devreden KDV 2.000", Şubat "Önceki Dönemden Devreden KDV 2.000" + "Sonraki Döneme Devreden KDV 800"). Tek ayda tabloya satır eklenmez.
5. **Yeni özet notları:** "Mahsup Edilmemiş Ay" (aralıktan önceki ay ya da aralıkta son hareketli aydan önceki ay mahsupsuzsa: "Ekim 2026 (devreden KDV mahsup fişinden gelir; sonraki ayların devredeni ve ödeneceği aylar sırayla mahsup edilince kesinleşir)"); "Not" (aralık ay ortasında başlayıp / bitiyor ve dışarıda belge kalıyorsa: "Devreden ve ödenecek KDV ayın tamamından hesaplanır; …").
6. **Mahsup Fişi penceresi, defter, mizan, yevmiye, KDV mahsup fişi: DEĞİŞMEDİ** (kâhin-defter taban = yeni, 187/187; mahsup testleri yeşil).
7. **Hız:** KDV Özeti yıllık açılışı temiz 100 bin kopyada taban 2.542 ms → yeni 2.327 ms (ılık ortanca); tek ay 2.346 → 2.358 ms (+%0,5). §F.

## B. DEĞİŞEN DOSYALAR
- `server/routes/tax.mjs` — ön izleme hesabı `monthPosition()`'a ayrıldı (davranış AYNEN); `vatView()` (Ana Defter tek kuruluş; `position`, `months`, `mahsup`, `offsets`) dışa açıldı; `offsetList` → `listOf` ortak.
- `server/routes/report-center.mjs` — yalnız KDV Özeti `build` + iki ay yardımcısı (`previousMonthOf`, `monthEndOf`).
- Testler: YENİ `test/kdv-ozeti-devreden-251.test.mjs` (10 sınama), YENİ `test/e2e/senaryo-kdv-devreden-251.mjs` (ekran, 14 denetim); beklentisi değişen: `test/defter-243-ux24-toplam.test.mjs`, `test/c7b-kdv-ozeti-donem-250.test.mjs`, `test/raporlar-224.test.mjs`, `test/raporlar-210-banka.test.mjs`, `test/banka-210-fis.test.mjs`, `test/mali-musavir-217.mjs` (yalnız etiket), `test/e2e/senaryo-defter-243.mjs`, `test/e2e/senaryo-kdv-donemi-250.mjs`, `test/e2e/senaryo-c7b-kabul-250.mjs`.
- Belge / kanıt: `docs/devir/2.5.1-DEVAM/m1-rapor.md`, `docs/kanit/2026-11-27/m1-*` (+ `m1-ekran/`, `m1-betik/`).
- İstemci DEĞİŞMEDİ (özet kartları ve tfoot genel çizim). `test/bagimsiz/**`, kılavuz, `.github`, `package.json`, `tools`, göçler DOKUNULMADI.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı, a0d9f50c)
1. Devreden hiç yok (ilk ay, mahsup hiç kullanılmamış şirket) → "Önceki Dönemden Devreden KDV" 0, ödenecek = hesaplanan − indirilecek (artıysa).
2. Devreden birkaç ay taşınır (MA: Şubat 1.140 → Mart, Nisan mahsupla taşınır → Mayıs 1.200 − 1.140 = 60).
3. Ödenecek aydan sonra yeniden devreden (ödenecek ay devredeni sıfırlar; sonraki ay alışı fazla → yeni devreden).
4. Mahsup fişi kesilmemiş ay (önceki ay mahsup edilmemiş → ön izleme 190'ı defterden okur; zincir kopar) — rapor ön izlemeyle aynı sayı + not.
5. Mahsup fişi silinmiş (geri alınmış) / yeniden kesilmiş → 190 ters kayıtla sıfırlanır; rapor yeni duruma uyar.
6. Aralık yıl başını aşıyor (Aralık'tan devreden Ocak'a; önceki yıldan devreden).
7. Tek ay / çeyrek / yıl / Tüm Zamanlar / boş dönem / gelecek dönem / ay ortasında başlayan ya da biten aralık.
8. İadeler (satıştan iade 191'de, alıştan iade 391'de — defter; rapor 391 / 191 satırları iadeleri düşülmüş) — net aynı.
9. Tevkifat (alıcı olarak kesilen 2 No.lu: 191 tam KDV, 360 ayrı; satışta kesilen: 391 KDV − tevkifat).
10. KDV İndirim Dönemi başka aya atılmış alış faturası (2.5.0 kuralı) — rapor ve mahsup ay ay aynı.
11. Kilitli dönem (mahsup yazılamaz ama ön izleme sayıları gösterilir) — rapor sayıları değişmez.
12. Defter Türü bilanço dışı (işletme / serbest meslek) — KDV hesabı defter türünden bağımsız.
13. Yetkisiz rol (raporu göremeyen 403; raporu görüp mahsup yetkisi olmayan aynı sayıları görür, düğme yok).
14. İki şirket (her şirketin kendi 190'ı; öbür şirketin mahsubu karışmaz).
15. Sonradan girilen, indirilecek KDV'yi azaltan kayıt (S4: önceki mahsuptan sonra) — ön izleme bunu sonraki aya taşır; rapor aynı.
16. Ekran = PDF = Excel; alt TOPLAM satırları; yön karışık raporda her yön ayrı TOPLAM.

## 1. TARAMA (koddan ÖNCE; taban t251-taban)
| Yer | Ne üretiyor / gösteriyor | M1'de |
|---|---|---|
| `server/routes/report-center.mjs` kdv-ozeti `build` — özet | "Hesaplanan KDV (391)", "İndirilecek KDV (191)" (fatura başlıklarından; iadeler düşülmüş), tevkifat, `[result ≥ 0 ? "Ödenecek KDV" : "Devreden KDV"]` = 391 − 191 (devreden YOK) | DEĞİŞTİ |
| aynı — tablo altı (`footerGroups.net`) | "Net KDV (Ödenecek)" / "Net KDV (Devreden)" = satırların işaretli KDV toplamı (devreden YOK) | DEĞİŞTİ (rapor `footers` verir) |
| aynı — özet "KDV Mahsup Fişi" / "Mahsuptan Sonra Değişen Ay" | `tax().offsetList()` (Ana Defter bir kez kurulur) | aynı liste, aynı kuruluştan (vatView.offsets) |
| `footerRows` (report-center.mjs, ortak) | yönü karışık raporda TOPLAM + Net | DEĞİŞMEDİ (KDV Özeti belge TOPLAM'larını yine bundan alır) |
| `run()` → `reportPdf` / `reportXlsx` (`server/lib/report-files.mjs`, `report-pdf.mjs`) | ekran = PDF = Excel aynı `rows` / `footers` / `summary` | DEĞİŞMEDİ (genel) |
| `client/assets/hof-report-center.js` | özet kartları ve tfoot genel çizim | DEĞİŞMEDİ |
| `client/assets/hof-tax.js` (KDV Mahsup Fişi penceresi) | ön izleme "Ödenecek KDV (360)" / "Sonraki Aya Devreden KDV (190)" · "kullanılan devreden" | DEĞİŞMEDİ |
| `server/routes/tax.mjs` `preview()` | devreden = `figureTable.of(ay).carry` = ay başından ÖNCEKİ bütün 190 satırlarının neti (max 0), S4 taşıması, fark o − i − p | hesap `monthPosition`'a ayrıldı (davranış AYNEN), `vatView()` ile rapora açıldı |
| `server/lib/general-ledger.mjs` `vatOffsetLines` | mahsup fişinin satırları | DEĞİŞMEDİ |
| `server/lib/report-worker.mjs` | KDV Özeti iş parçacığında koşmaz (`worker` bayrağı yok; orada `tax` yok) | DEĞİŞMEDİ |
| Mobil (`/api/mobil/reports/kdv-ozeti`) | 404 (mobilde fatura / vergi raporu yok) | DEĞİŞMEDİ |
| ANLIK DURUM / zil / Vade Takip | KDV göstermez (`git grep "Ödenecek KDV\|Devreden KDV\|Net KDV"`) | — |
| Kılavuz (HTML 371, 391) | "Net KDV" anlatımı | DOKUNULMADI (öneri §13) |

AÇIK NOKTA (koddan okundu): ön izlemenin "önceki aydan devreden"i **defterdeki 190 bakiyesidir** — ay ay hesap değil. 190'a yalnız KDV Mahsup Fişi yazar (`general-ledger.mjs` 786–794; geri alınan fiş aynı gün ters kayıtla sıfırlanır). Önceki ay mahsup edilmemişse zincir kopar: ön izleme o ayın sonucunu görmez, yalnız bir önceki ay için uyarı yazar ("… mahsup edilmedi; devreden KDV o ayın mahsubundan gelir"). İki okuma çıktı → §7 KULLANICIYA SORULMALI. Kodlanan: rapor ön izlemeyle AYNI sayı (görev metni: "Rapor mahsup ön izlemesiyle AYNI sayıyı göstermeli") + özette "Mahsup Edilmemiş Ay" notu.

## 2. KOD (kararlar nasıl uygulandı)
- Karar (1) TEK FORMÜL: `server/routes/tax.mjs` — ön izlemenin satır içi hesabı `monthPosition(table, active, ay)` işlevine ayrıldı (kullanılan devreden = defterdeki 190, S4 taşıması, fark o − i − p, ödenecek = max(0, fark), devreden = max(0, −fark)); `preview()` bunu çağırır (davranış AYNEN — komşu mahsup testleri yeşil). `vatView()` yeni: Ana Defter'i TEK kez kurar, `position(ay)` (aynı işlev), `months` (391 / 191 satırı olan aylar), `mahsup` (etkin mahsup fişi olan aylar), `offsets` (= `offsetList()`; `listOf` ortak). Rapor ikinci formül yazmaz.
- Karar (2) ADLAR: özet ve tablo altında "Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV" (üçü HER ZAMAN; sıfırsa 0,00); "Hesaplanan KDV (391) (İadeler Düşülmüş)", "İndirilecek KDV (191) (İadeler Düşülmüş)" (değerler aynen). Eski "Devreden KDV" özet satırı ve "Net KDV (Ödenecek / Devreden)" tablo altı satırı kalktı.
- Karar (3) ARALIK: Önceki Dönemden Devreden = aralığın İLK ayının ön izlemesindeki kullanılan devreden (ay başına kadar 190); Ödenecek = aralıktaki HAREKETLİ ayların (391 / 191 satırı ya da etkin mahsup fişi olan ay) ödeneceklerinin toplamı; Sonraki Döneme Devreden = aralığın SON HAREKETLİ ayının devredeni (hareketli ay yoksa önceki devreden aynen). Çok aylı aralıkta TAM aylar için tabloda ayın belgelerinin altında ayın sonuç satırları (kullanılan devreden > 0 ise "Önceki Dönemden Devreden KDV", sonra "Ödenecek KDV" ya da "Sonraki Döneme Devreden KDV"); tek ayda tabloya satır eklenmez (sonuç tablo altında ve özette). Ay ortasında başlayan / biten aylar tabloya sonuç satırı almaz; özete girer ve dışarıda belge kalmışsa "Not" satırı yazılır.
- Karar (4) TABLO ALTI: belge yönü TOPLAM'ları aynen (yalnız belge satırlarından), altında üç sonuç satırı (özetle aynı sayılar).
- Mahsubu kesilmemiş ay notu (AÇIK NOKTA önerisi, ÖNERİYİ UYGULA ile kodlandı; ana oturum kaldırabilir): özette "Mahsup Edilmemiş Ay" = aralıktan önceki ay (hareketli ve mahsupsuzsa — ön izlemenin uyarısıyla aynı) + aralıkta son hareketli aydan ÖNCEKİ mahsupsuz hareketli aylar; en çok 6 ay adı + "ve N ay daha"; metin: "(devreden KDV mahsup fişinden gelir; sonraki ayların devredeni ve ödeneceği aylar sırayla mahsup edilince kesinleşir)".
- Hız: eski kod da her açılışta `offsetList()` ile Ana Defter'i bir kez kuruyordu; yeni kod da bir kez (vatView). Ay ortası notu için yalnız aralık ay ortasındaysa tek COUNT sorgusu.
- Dosya sınırı: yalnız `server/routes/report-center.mjs` (KDV Özeti + iki küçük ay yardımcısı) ve `server/routes/tax.mjs` (hesabı dışa açma); istemci kodu genel olduğundan DEĞİŞMEDİ. Defter / fiş / dondurma / devir / göç / Cari ekranı DOKUNULMADI.

## 3. YENİ / DEĞİŞEN TESTLER — kırmızı nedeni ve yeşil (iki TZ)
Kâhin: S261 metni ve mali müşavirin ma-rapor ORTA-1 sayıları ELLE yazılı (programın kodundan türetilmedi); veri programın API'sinden (iki şirket: 002 = S261, 001 = MA senaryosu); sahte saat 20.01.2027.
| Test | Taban (t251-taban, ayrı kopya `/dev/shm/m1-kdv/eski`) | Yeni |
|---|---|---|
| `test/kdv-ozeti-devreden-251.test.mjs` (10) | UTC 1/10, İstanbul 1/10 geçti — 9 KIRMIZI, BEKLENEN NEDEN: "Şubat Ödenecek KDV … ["Ödenecek KDV","1.200,00 TL"]", "yıl (taban: Devreden KDV 1.900)", "2026-05: rapor = mahsup ön izlemesi", "Önceki Dönemden Devreden" yok. Tabanda geçen 1: yetki sınaması (değişmez davranış — bilerek) | UTC 10/10, İstanbul 10/10 |
| `test/e2e/senaryo-kdv-devreden-251.mjs` (14) | 7/14 — ✗ "özet kartları … {"Ödenecek KDV":"₺1.200,00"}", ✗ "tablo altı = özet ([["TOPLAM",…]])", ✗ "(İadeler Düşülmüş)" | 14/14 |
| Beklentisi değişen e2e: senaryo-kdv-donemi-250 / senaryo-defter-243 / senaryo-c7b-kabul-250 | (eski beklentiler tabanda yeşildi) | 23/23 · 33/33 · 39/39 (ders 28) |
Yeni testin `it`'leri (nasıl bozulur §0 eşlemesi): S261 Şubat (1, 16) · MA Mart/Nisan/Mayıs/Ağustos/Eylül (2) · MA yıl + çeyrek + ay satırları + TOPLAM'lar + defter 190 (2, 7, 16) · boş / gelecek / veri öncesi dönem + iki şirket (7, 14) · mahsup kesilmemiş ay, geri al, yeniden kes (4, 5) · ödenecek sonrası yeniden devreden, Aralık→Ocak, Bu Yıl, Tüm Zamanlar (3, 6, 7) · iadeler + 2 No.lu tevkifat + KDV İndirim Dönemi başka aya (8, 9, 10) · S4 azaltan kayıt taşıması (15) · kilit + Defter Türü işletme + ay ortası notu (11, 12, 7) · yetki personel 403, muhasebe = yönetici (13). Her ayda rapor = ön izleme (aynı istek, aynı veri), ekran = PDF = Excel (özet sayfası dahil).

## 4. KABUL KOŞULLARI
- **A. `npm run test:kahin-defter`** taban UTC / İstanbul: 187/187, 0 fark · yeni UTC / İstanbul: 187/187, 0 fark; kanıt günlükleri taban ↔ yeni (süre ve geçici yol ayıklanınca) AYNI (`m1-kahin-defter-*`).
- **B. Muhasebe sürücüsü** (`test/bagimsiz/muhasebe-surucu/program.mjs`): KDV Özeti'ni OKUMUYOR (rapor okumaları: mizan, yevmiye, stok-durumu, acik-faturalar; `kdv_mahsup` olayı mahsup ucunu çağırır, davranışı aynen) → taban ↔ son farkı beklenmez; sürücü koşulmadı (DENENMEYEN).
- **C. KOMŞULAR** (`git grep` ile: kdv-ozeti, vat-offset, /tax/, footerRows, registerTaxRoutes, vatOffsetLines, report-center → 38 dosya + yazim-duzeni + yeni test = 40 dosya): UTC 523/523, İstanbul 523/523, 0 başarısız / iptal / atlanan (`m1-komsu-utc`, `m1-komsu-ist`).
- **D. MUTANTLAR** — §5.
- **E. Beklentisi değişen testler** koşuldu: birim olanlar komşu koşusunda (iki TZ), üç e2e yeşil (§3).
- **F. Hız** — §6.

## 5. MUTANT TABLOSU (ayrı kopya `/dev/shm/m1-kdv/mut` @19af3660; TZ=UTC; kanıt `m1-mutant.json` + `m1-mutant-2.json`)
| Mutant | Öldüren (yeni test başarısız sınama sayısı) | Sonuç |
|---|---|---|
| D1 devredeni sıfır al (rapor görünümü) | 9 (+ ilk turda ux24 / c7b 0) | ÖLDÜ |
| D2 devredeni iki kez düş | 8 | ÖLDÜ |
| D3 çok aylı aralıkta ilk ay yerine son ayın devredeni 'önceki dönem' | 3 | ÖLDÜ |
| D4 mahsup formülü yerine eski dönem farkı (391 − 191) | 9 | ÖLDÜ |
| D5 ödenecek ile devredeni ters yaz | 9 (+ ux24 1, c7b 1) | ÖLDÜ |
| D6 ödenecek yalnız son hareketli ay (toplam yerine) | 2 | ÖLDÜ |
| D7 sonraki = aralığın son ayının ön izlemesi (hareketli ay yerine) | 2 | ÖLDÜ |
| D8 'Mahsup Edilmemiş Ay' notu yazılmaz | 4 | ÖLDÜ |
| D9 ay satırlarında kullanılan devreden satırı yok | 1 | ÖLDÜ |
| D10 S4 taşıması rapor görünümünde unutulur | ilk tur YAŞADI → S4 sınaması eklendi → 1 | ÖLDÜ |

## 6. HIZ (temiz 100 bin kopyası, `/dev/shm` taze kopya her taraf için; `flock -x` tek seferlik; yük başta 0,77 / 1,47 — GEÇERLİ; `m1-hiz.txt`)
Veri: 34.026 fatura, 61.162 kalem, 102.295 cari satırı. 5 ılık ölçüm ortancası:
| İstek | Taban | Yeni | Fark |
|---|---|---|---|
| KDV Özeti yıllık 01.01–31.12.2026 | 2.542 ms (olay döngüsü en çok 2.942) | 2.327 ms (2.510) | −%8 |
| KDV Özeti Bu Yıl | 2.611 ms | 2.348 ms | −%10 |
| KDV Özeti tek ay (Eylül) | 2.346 ms | 2.358 ms | +%0,5 |
| KDV Mahsup ön izlemesi (Eylül) — değişmeyen yol | 4.626 ms | 4.617 ms | aynı |
Kabul (%10'dan kötü değil): GEÇTİ. Not: raporun ~2,3 sn'si Ana Defter'in kurulmasıdır ve TABANDA da vardır (`offsetList`) — BİLİNEN SINIR, M1 artırmadı.

## 7. KULLANICIYA SORULMALI
**S-M1-1 — Mahsup fişi kesilmemiş aylarda "Önceki Dönemden Devreden" nereden gelsin?** (para gösterimi; defter / mahsup değişmez — ders 43 gereği kodda kesinleştirilmedi, görev metninin "rapor ön izlemeyle AYNI sayı" kararı kodlandı)
- Durum: ön izleme devredeni defterdeki 190'dan alır; 190'ı yalnız KDV Mahsup Fişi yazar. Ay mahsup edilmeden sonraki ay açılırsa zincir kopar.
- Örnek (testte): Ekim satış KDV 400 (mahsupsuz), Kasım satış KDV 1.000, Eylül sonu devreden 1.960. **A (kodlanan):** Kasım önceki 1.960 / ödenecek 0 / sonraki 960 + "Mahsup Edilmemiş Ay: Ekim 2026" notu (ön izlemeyle aynı). **B (zincirli):** Kasım önceki 1.560 / ödenecek 0 / sonraki 560 (Ekim sırayla mahsup edilseydi olacak sayı; Ekim mahsup edilince A da bu sayıya iner).
- Büyük veride etkisi (100 bin kopya; mahsup fişi HİÇ kesilmemiş şirket): yıllık rapor A'da "Önceki 0 · Ödenecek 0 · Sonraki Döneme Devreden 7.978,23" (yalnız Aralık'ın kendi farkı) + uzun "Mahsup Edilmemiş Ay" notu; B'de yıl boyu birikmiş devreden (≈ 3.309.780,96 — tabanın "Devreden KDV"si de buydu).
- Seçenekler: **A)** böyle kalsın (rapor = ön izleme = defter; mahsupsuz aylar notla söylenir). **B)** aralığın ilk ayında defterdeki 190'dan başla, aralıktaki mahsupsuz ayların sonucunu (aynı `monthPosition` formülüyle) sonraki aya devret; mahsuplu aylarda defter / ön izleme ile aynı, mahsupsuz aylarda rapor ön izlemeden ayrılır (not yine yazılır).
- **ÖNERİ: B.** Gerekçe: rapor "Beyanname Hazırlığı"dır; beyannamedeki "önceki dönemden devreden" bir önceki beyannamenin "sonraki döneme devreden"idir, programın iç mahsup fişinin kesilip kesilmemesine bağlı değildir. Mahsup fişini kullanmayan müşteride A, yıllık görünümde devredeni yanlış (çok küçük) gösterir. Yaygın programlarda nasıl: belgesi / ekranı bu oturumda okunmadı — dayanak olarak YAZILMADI.
- Uç durum DEĞİL (mahsup fişini kullanmayan şirket yaygın olabilir) → üçüncü seçenek yok.

## 8. BAŞ MİMAR KARARI GEREKİYOR (uygulandı; ana oturum değerlendirir)
1. "Sonraki Döneme Devreden" = aralığın SON HAREKETLİ ayının devredeni (karar (3) "son ayın devredeni" yazıyor). Gerekçe: hareketsiz / gelecek ayların ön izlemesi S4 taşımasını ve mahsupsuz ayları her ay yeniden sayabiliyor (D7 mutantı bu farkı gösterir). Tüm aylar sırayla mahsuplu olduğunda iki okuma AYNI sayı (190 bakiyesi).
2. "Ödenecek KDV" (aralık) = hareketli ayların ödeneceklerinin TOPLAMI (karar metni aralık ödenecekini tanımlamıyor).
3. Ay satırları yalnız çok aylı aralıkta ve yalnız TAM aylarda; ay ortası aylar yalnız özete / tablo altına girer + "Not".
4. Üç sonuç satırı her zaman (sıfırsa 0,00) — beyanname düzeninde üç satır ayrı.
5. Tek ayda belgesi olmayan (yalnız devreden taşıyan) ay: tablo boş → Rapor Merkezi kuralı gereği TOPLAM satırı yok; sayılar özette.
6. "Mahsup Edilmemiş Ay" notu (AÇIK NOKTA önerisi; ÖNERİYİ UYGULA ile kodlandı) — kaldırılması tek satır.

## 9. SONRAKİ SÜRÜME
- Raporun ~2,3 sn'lik Ana Defter kuruluşu (tabanda da var) — yalnız 190 / 391 / 191 satırlarını okuyan dar sorgu hızlandırır (yapısal hız işine).
- `test/defter-243-ux24-toplam.test.mjs` baş yorumundaki kâhin satırı hâlâ "Net KDV (Ödenecek)" diyor (yalnız yorum; beklenti güncellendi).
- `test/fixtures/hiz-210-eski/report-center.mjs` eski kopya eski adları taşır (bilerek; fixture).

## 10. DOĞRULANMADI
- Windows (CI) koşusu — yeni test dosyaya dokunmuyor; ana oturum CI'de okur.
- Kılavuzdaki "Net KDV" anlatımının PDF'e etkisi (kılavuza dokunulmadı).

## 11. DENENMEYEN
- Tam `npm test` (görev gereği ana oturum), muhasebe sürücüsü (KDV Özeti'ni okumuyor), `test:kahin-cari` (cari dokunulmadı), mutantlar yalnız UTC'de, hız yalnız bir tekrar ölçümü (5 ılık istek × 4 yol), mobil (KDV Özeti mobilde 404 — değişmedi), eski sürüm verisiyle (v2.4.x) göç sonrası rapor.

## 12. CI LİSTESİNE EKLENECEK
- `test/e2e/senaryo-kdv-devreden-251.mjs` (ci.yml e2e listesine; ders 37). Birim test `test/kdv-ozeti-devreden-251.test.mjs` `npm test` deseniyle zaten koşar.

## 13. KILAVUZ METNİ ÖNERİSİ (son adayda toplu; HTML 391 ve 371)
- 391'deki "… altta Net: KDV Özeti'nde Satış, Satıştan İade, Alış, Alıştan İade ve Net KDV" yerine: "… KDV Özeti'nde Satış, Satıştan İade, Alış ve Alıştan İade TOPLAM'larının altında Önceki Dönemden Devreden KDV, Ödenecek KDV ve Sonraki Döneme Devreden KDV".
- 371'e (KDV Mahsup Fişi maddesine) ek: "KDV Özeti, ödenecek ve devreden KDV'yi mahsup fişindeki hesapla gösterir; önceki ay mahsup edilmemişse özette 'Mahsup Edilmemiş Ay' yazar — ayları sırayla mahsup edin."

## 14. COMMIT LİSTESİ (t251-taban..dal ucu)
- a0d9f50c M1 rapor taslağı: nasıl bozulur listesi (koddan önce)
- 19af3660 M1: KDV Özeti — Önceki Dönemden Devreden KDV; Ödenecek / Sonraki Döneme Devreden KDV mahsup ön izlemesinin hesabıyla (S261)
- 3a05b0ec M1 rapor taslağı: tarama tablosu ve açık nokta
- 3b6ab56f M1: S4 taşıması testi; KDV Özeti ekran senaryosu ve beklentisi değişen üç ekran senaryosu
- c8195d8c Kanıt: M1 … (komşular, kâhin-defter, kırmızı / yeşil, mutantlar, ekran, hız)
- (son) M1 rapor (bu belge)

## 15. ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
cd <dal ucu ağacı>
for tz in UTC Europe/Istanbul; do HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=$tz node --test test/kdv-ozeti-devreden-251.test.mjs; done   # 10/10
# taban kırmızısı (ayrı kopya): git worktree add --detach /dev/shm/<ad>/eski t251-taban; cp test/kdv-ozeti-devreden-251.test.mjs oraya → 9 başarısız, ilk neden "Ödenecek KDV 1.200,00"
bash docs/kanit/2026-11-27/m1-betik/komsu.sh utc <kök> <kanıt klasörü>   # 523/523 (ve ist)
npm run test:kahin-defter                                                   # 187/187, 0 fark
PLAYWRIGHT_BROWSERS_PATH=<pw-1194> HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/e2e/senaryo-kdv-devreden-251.mjs   # 14/14
python3 -I docs/kanit/2026-11-27/m1-betik/mutant.py <ayrı kopya> <çıktı.json>   # 10/10 ÖLDÜ
flock -x <olcum.lock> bash docs/kanit/2026-11-27/m1-betik/olc-kdv.sh <çıktı>     # betikteki taban / yeni kopya yollarını uyarlayın
```
Not: `/dev/shm/m1-kdv/eski` ve `/dev/shm/m1-kdv/mut` git worktree kopyalarım duruyor (ana oturum yeniden koşusu için); işi bitince `git worktree remove /dev/shm/m1-kdv/eski` ve `.../mut` ile kaldırılabilir.
