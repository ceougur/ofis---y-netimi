# M1 KÜÇÜK TUR — KDV Özeti: S-DKM1-1 = A, S-M1-3 notu, S-M1-2 yön notu, tablo altı ve not kartları (2.5.1) — RAPOR

Taban `t251-m1k-taban` (837f515b) → dal ucu: bu raporun son commit'i (`worktree-agent-af4f8faccec231727`). PUSH YOK. KDV Mahsup Fişi, ön izlemesi ve defter
DEĞİŞMEDİ (kabul D: taban = yeni, birebir) — yalnız Rapor Merkezi'nin KDV Özeti görünümü.
Ortam (son okuma 16:07 UTC): yük 4,45 / 4 çekirdek, bellek boş 5 GB (kullanılabilir 14 GB), disk boş 11 GB. Arka plan işim YOK (hepsi bitti).

## A. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce = taban → sonra; Raporlar → Tüm Raporlar → KDV Özeti (Beyanname Hazırlığı); ekran = PDF = Excel)
1. **Mahsup fişi kesilmiş ayın İndirilecek KDV'si sonradan AZALIRSA (S-DKM1-1 = A)** — kararın örneği: Ocak satış KDV 1.000, alış KDV 500 → Ocak fişi 500; Ocak alışı
   İptal Et; Şubat satış 200 → Şubat fişi 700; Mart 400 → fiş 400.
   - Ocak: ÖNCE 0 / **1.000** / 0 → SONRA 0 / **500** / 0 (kesilmiş fişten). Ocak–Mart Ödenecek ÖNCE **2.100** → SONRA **1.600** (= fişler 500 + 700 + 400 = 391 1.600 − 191 0).
     Ay satırları Ocak 500 / Şubat 700 / Mart 400. Ocak–Şubat ÖNCE 1.700 → SONRA 1.200.
   - Yeni not (özetin "Mahsuptan Sonra Değişen Ay" satırında): "Ocak 2026 (bu ayın kayıtları fişten sonra değişti; ayın sonucu kesilmiş mahsup fişinden, İndirilecek
     KDV'deki azalma sonraki mahsupta düşülür)". Not YALNIZ ayın KENDİ İ'si fişin saklı İ'sinden küçükse çıkar (önceki ayın azalması sonraki fişli aya yazılmaz — test
     "002 azalma sonraki ayın fişinden SONRA": Şubat 200, notsuz).
   - Aynı kural "devreden" yönde: 002 Mart fişi (önceki 800 / sonraki 1.000) sonra Mart'ın tevkifatlı alışı İptal Et → Mart ÖNCE 800 / 0 / **600** → SONRA 800 / 0 / **1.000**
     (Nisan'ın önceki devredeniyle artık aynı; ekranda "Mart sonraki 600 ↔ Nisan önceki 1.000" kopukluğu kalktı) + not.
   - Yıl dönümü: Aralık 2026 fişi 400, Aralık alışı Ocak 2027'de iptal → Aralık 400 (taban 600) + not; Ocak 2027 400 (200 + S4 200); 2026 yılı 1.200; Aralık–Ocak 800 = 391.
2. **Kopuk fiş — S4 emilimiyle (dar kontrol L, DÜŞÜK-1; bu düzeltmeyle kendiliğinden kapandı — gerekli koşul aynı)**: Ocak fişi 500 + Ocak alışı iptal, Şubat MAHSUPSUZ (zincir
   azalmayı Şubat'ta düşer: 700), Mart fişi defter sırasıyla azalmayı İKİNCİ KEZ düşüp 900 kesilmiş. ÖNCE Ocak–Mart **2.100**, not yok → SONRA **1.600** + "Zincirle
   Uyuşmayan Mahsup Fişi: Mart 2026 fişi ödenecek KDV 900,00 TL yazmış, sırayla mahsupta ödenecek KDV 400,00 TL olmalıydı — İndirilecek KDV'deki azalma sırayla mahsupta daha
   önceki bir ayda düşülür (raporda sırayla mahsup sayıları; …)". NEDEN aynı düzeltmenin parçası: S-DKM1-1 = A "fişe güven" der; fiş zincirde sayılırken yalnız devreden
   karşılaştırılsaydı L'de Mart'ın 900'ü de fişten alınır, toplam yine 2.100 olurdu. Fiş artık devredeni VE S4 emilimi zincirinkine eşitse zincirde sayılır.
3. **Yön notu (S-M1-2, baş mimar B)**: kopuk zincirde fiş "sonraki döneme devreden 1.000", zincir "ödenecek 800" → sayılar aynı (zincir 200 / 800 / 0); not ÖNCE "Mart 2026
   fişi 2.000,00 TL devredenle kesilmiş, sırayla mahsupta 200,00 TL olmalıydı (…)" → SONRA aynı cümle + "; fiş sonraki döneme devreden KDV 1.000,00 TL yazmış, sırayla
   mahsupta ödenecek KDV 800,00 TL çıkar". Yön aynıysa cümle DEĞİŞMEDİ (tur 2 testi ve ekran senaryosu aynı metni bekliyor, yeşil).
4. **"Güncel değil" notu (S-M1-3 = C)**: "Mahsuptan Sonra Değişen Ay: Haziran 2026 (mahsubu geri alıp yeniden yapın)" → "Haziran 2026 (mahsup fişi güncel değil — mahsubu
   geri alıp yeniden mahsup edin)". Sayılar DEĞİŞMEDİ (bugünkü kayıtlardan; BİLİNEN SINIR).
5. **Ekran — tablo altı (baş mimarın yürüyüşü)**: KDV Özeti'nin tablo altı (TOPLAM … + Önceki Dönemden Devreden / Ödenecek / Sonraki Döneme Devreden) hücreleri tek tek
   "altta yapışık" olduğundan tablo kutusu kayınca ÜST ÜSTE biniyordu (taban görüntüsü `m1k-ekran/taban/m1k-kdv-ozeti-ocak-mart-dar.png`: yalnız "Sonraki Döneme Devreden" görünüyor;
   senaryo ölçümü: üç satır üst üste). SONRA tablo altı bir bütün olarak altta sabit, satırlar alt alta (`m1k-ekran/yeni/m1k-kdv-ozeti-ocak-mart-dar.png`: dört satır
   okunur). Kutuda başlık + iki belge satırına yer kalmayacak kadar alçak pencerede (1024 × 560) tablo altı sabitlenmez, tablonun sonunda durur (üst üste binmez; görmek için
   tablo kaydırılır — §BİLİNEN SINIR).
6. **Ekran — not kartları**: tutar olmayan özet satırları ("KDV Mahsup Fişi", "Mahsuptan Sonra Değişen Ay", "Mahsup Edilmemiş Ay", "Zincirle Uyuşmayan Mahsup Fişi", "Not")
   tutar kartlarının ALTINDA ayrı blokta, alt alta, tam genişlikte; cümle normal ağırlıkta 13 px (önce 15 px, 800 kalınlık, tutar kartlarının arasında yana kayıyordu).
   Tutar kartları değişmedi. YALNIZ KDV Özeti (öbür raporların görünümü aynı).
7. **DEĞİŞMEYENLER**: KDV Mahsup Fişi penceresi, ön izleme, fiş satırları, defter (dar kontrolün A, B, C, E, F, J, L, L2 senaryolarında ön izleme / fiş satırları taban = yeni
   BİREBİR, iki TZ); kâhin-defter 187/187 taban = yeni; bütün aylar sırayla mahsuplu ve kaydı değişmemiş şirkette her sayı aynı.

## B. DEĞİŞEN DOSYALAR
- `server/routes/tax.mjs` (yalnız `vatView` — rapor görünümü): `settle` (fişin ayı: güncel değilse bugünkü hesap, değilse fişin sayıları; `offsetState` kept / reduced / stale);
  fiş zincirde sayılma koşuluna S4 emilim eşitliği (`Math.min(0, carriedBefore(table, active, month)) === step.carried`); A kipinde (VAT_CARRY_MODE = "ledger") aynı kural.
  `preview`, `monthPosition`, `listOf`, fiş yazımı DEĞİŞMEDİ.
- `server/routes/report-center.mjs` (yalnız KDV Özeti): azalan ay notu, güncel değil notunun metni, uyuşmazlık cümlesi (`mismatchText`: yön farkı, emilim farkı); eski yorum
  (satır 67: "Önceki ay yardımcısı … vatView.pending'e geçti") → yardımcıların yeri (`routes/tax.mjs`: previousMonth, vatView).
- `client/assets/hof-report-center.js` (yalnız `report.id === "kdv-ozeti"`): notlar ayrı blokta (`hof-rc-summary is-kdv-notes`, span `is-note`); tablo kutusu `is-kdv`;
  `fitTable` alçak pencerede `is-foot-free`. `client/assets/hof-ui.css`: yalnız `.hof-rc-table.is-kdv` / `.hof-rc-summary.is-kdv-notes` kuralları.
- Testler: YENİ `test/kdv-ozeti-mahsup-sonrasi-251.test.mjs` (9 sınama, iki boot, iki şirket), YENİ `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (13 denetim);
  değişen `test/kdv-ozeti-devreden-251.test.mjs` (it 8: Mart fişten + not + ön izleme değişmedi), `test/kdv-ozeti-zincir-251.test.mjs` (it 5: güncel değil notunun tam metni);
  `test/excel-denetim/ekran-hafta.mjs` (CI dışı; §6).
- Kanıt: `docs/kanit/2026-11-27/m1k-*` (ham çıktılar), `m1k-betik/` (betikler), `m1k-ekran/` (görüntüler, deviceScaleFactor 1), bu rapor.
- DOKUNULMADI: defter türetmesi, fiş / ön izleme yazımı, göçler, `.github/**`, `package.json`, `tools/**`, `test/bagimsiz/**`, kılavuz.

## 0. NASIL BOZULUR (koddan önce, fd051b72) → sınama eşlemesi (yeni dosya = mahsup-sonrasi; d1 / d2 = birinci / ikinci describe)
1 azaltan ↔ artıran → d1 it 1 (azaltan), zincir it 5 (artıran, sayılar bugünkü), karma ay → §KULLANICIYA SORULMALI · 2 zincirde / kopuk (devreden + emilim) → d1 it 4 (L), d2 it 1
(S-M1-2) · 3 sonraki fişten sonra gelen azalma → d2 it 3 · 4 aralık başı / ortası / sonu, Tüm Zamanlar → d1 it 2 · 5 yıl dönümü → d2 it 2 · 6 geri alınan ay → d1 it 5 (Mart, Şubat,
Ocak sırayla; her adımda 1.600) · 7 devreden yönünde azalma → devreden it 8 · 8 ekran = PDF = Excel → `sameFiles` (d1 it 1 / it 4, d2 it 1 / it 2), dar pencere → ekran senaryosu
· 9 eksik testler → d1 it 3 (M3), d2 it 4 (M7) · 10 not metinleri → d1 it 4, d2 it 1 · 11 iki şirket / yetki / kilit → komşular (devreden it 4 / 9 / 10).

## 3. YENİ / DEĞİŞEN TESTLER — kırmızı nedeni ve yeşil (iki TZ)
Kâhin ELLE (kararların örnekleri + elle hesap; programın kodundan türetilmedi). Sayılar yanıt gövdesinden / veri tabanından (`vat_offsets`, mizan 360 / 190). Taban: ayrı kopya
`/dev/shm/m1k-kdv/eski` (`git archive t251-m1k-taban`; içine YALNIZ yeni / değişen test dosyaları + yeni ekran senaryosu kopyalandı).
| Koşu | Taban | Yeni |
|---|---|---|
| mahsup-sonrasi + zincir + devreden (24) UTC | 15/24, **9 kırmızı** | 24/24 |
| aynı, Europe/Istanbul | 15/24, **9 kırmızı** | 24/24 |
| `senaryo-kdv-mahsup-sonrasi-251` | 5/13, **8 kırmızı** | 13/13 |
Kırmızıların NEDENİ (günlükten okundu — `m1k-yeni-test-taban-utc.log`): d1 it 1 "Ocak sonucu kesilmiş fişten — actual 100000, expected 50000"; d1 it 2 "Ocak–Şubat actual 170000 /
expected 120000"; d1 it 4 "Mart notu (taban: not yok) — actual undefined"; d1 it 5 "Mart geri alındı actual 210000 / expected 160000"; d2 it 1 yön notu: taban cümlesi yön ekini
taşımıyor; d2 it 3 "Ocak fişten actual 100000"; devreden it 8 "Mart fişten [80000, 0, 60000] ≠ [80000, 0, 100000]"; zincir it 5 "Haziran 2026 (mahsubu geri alıp yeniden
yapın)". ARDIL kırmızı (beklenen neden değil): d2 it 2 "Aralık fişi [100000, 0, 60000]" — tabanda d2 it 1 yön notunda düşünce onarım (Mart geri al, sırayla mahsup) koşmadı,
defterde 190 = 1.000 kaldı, Aralık fişi o devredenle kesildi. Ekran tabanı: Ocak–Mart 2.100, Ocak 1.000, not yok, not kartı yok, tablo altında üç satır üst üste (ölçüm:
overlap = Önceki / Ödenecek / Sonraki).
Mutant için yazılan iki sınama (d1 it 3 S4 emilimi, d2 it 4 "Mahsup Edilmemiş Ay" 6 ay) TABANDA YEŞİL — tabanın davranışı doğru; dişleri M3 ve M7 mutantlarında (§5) kırmızı.

## 4. KABUL KOŞULLARI
- **A** §3 (iki TZ).
- **B** komşular (`m1k-betik/komsu.sh`: tur 2'nin 41 dosyası + yeni test + istemci komşuları `git grep "hof-report-center|hof-ui.css|hof-rc-"` 8 dosya; dar grep "kdv-ozeti |
  vat-offset | KDV Özeti | Mahsup Edilmemiş | vatView | monthPosition | Mahsuptan Sonra | Zincirle Uyuşmayan" 24 dosyanın hepsi listede; 49 dosya): UTC **613/613**, İstanbul
  **613/613**, 0 başarısız / iptal / atlanan.
- **C** `npm run test:kahin-defter`: taban UTC / İst 187/187, 0 fark · yeni UTC / İst 187/187, 0 fark — AYNI.
- **D** ön izleme / fiş (`m1k-betik/onizleme-esit.sh` + dar kontrolün betiği DEĞİŞTİRİLMEDEN kopyası): A, B, C, E, F, J, L, L2 — ön izleme / fiş / geri al / iptal / kilit
  satırları taban 26 = yeni 26, **BİREBİR** (UTC ve İst). Rapor satırlarında fark 4 (bu turun işi): L.mart-rapor (yeni uyuşmazlık notu), L.ocak-mart (2.100 → 1.600 + notlar),
  L2.aylar (Ocak 1.000 → 500), L2.ocak-mart (2.100 → 1.600 + not).
- **E** ekran senaryoları (yeni kod, `m1k-betik/e2e.sh`): senaryo-kdv-mahsup-sonrasi-251 13/13, senaryo-kdv-zincir-251 12/12, senaryo-kdv-devreden-251 14/14,
  senaryo-kdv-donemi-250 23/23, senaryo-defter-243 33/33, senaryo-c7b-kabul-250 39/39, senaryo-mobil-247 77/77, senaryo-banka-210 429/429. Beklentisi değişen eski senaryo YOK.
- **F** mutantlar — §5.

## 5. MUTANT TABLOSU
Ayrı kopya `/dev/shm/m1k-kdv/mut` (git archive ef0ccf16); testler: mahsup-sonrasi, zincir, devreden, defter-243-ux24-toplam, c7b-kdv-ozeti-donem-250, c7b-kdv-s4-250 (tek `node --test`); `m1k-ham/mutant-utc.json`, `mutant-ist.json`. Paketin 17'si (D1–D10, Z1–Z7, yeni koda uyarlandı) + dar kontrolün M3, M4, M7'si + bu turun N1–N8'i: **28/28 ÖLDÜ, iki TZ**; dar kontrolün yaşayan iki mutantı (M3, M7) artık yeni sınamalarda kırmızı (M3: d1 it 3 + it 4; M7: d2 it 4). "Başarısız" sütunu node --test özetinin üst düzey `# fail` sayısı.
| Mutant | Başarısız UTC / İst | Sonuç |
|---|---|---|
| D1 devredeni sıfır al (rapor görünümü) | 13 / 13 (iptal 0 / 0) | ÖLDÜ |
| D2 devredeni iki kez düş | 13 / 13 (iptal 0 / 0) | ÖLDÜ |
| D3 çok aylı aralıkta ilk ay yerine son ayın devredeni 'önceki dönem' | 8 / 8 (iptal 0 / 0) | ÖLDÜ |
| D4 mahsup formülü yerine eski dönem farkı (391 − 191) | 16 / 16 (iptal 0 / 0) | ÖLDÜ |
| D5 ödenecek ile devredeni ters yaz | 24 / 24 (iptal 0 / 0) | ÖLDÜ |
| D6 ödenecek yalnız son hareketli ay (toplam yerine) | 13 / 13 (iptal 0 / 0) | ÖLDÜ |
| D7 sonraki döneme devreden = aralığın son ayının görünümü (hareketli ay yerine) | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| D8 'Mahsup Edilmemiş Ay' notu hiç yazılmaz | 9 / 9 (iptal 0 / 0) | ÖLDÜ |
| D9 ay satırlarında kullanılan devreden satırı yok | 7 / 7 (iptal 0 / 0) | ÖLDÜ |
| D10 S4 taşıması zincirde unutulur (carried yok) | 8 / 8 (iptal 0 / 0) | ÖLDÜ |
| Z1 mahsupsuz ayı zincirden atla (devredeni değiştirmez) | 11 / 11 (iptal 0 / 0) | ÖLDÜ |
| Z2 ödenecek aydan sonra devredeni taşı | 4 / 4 (iptal 0 / 0) | ÖLDÜ |
| Z3 zinciri aralığın ilk ayından başlat (öncesini unut) | 15 / 15 (iptal 0 / 0) | ÖLDÜ |
| Z4 kopuk zincir notunu yazma | 4 / 4 (iptal 0 / 0) | ÖLDÜ |
| Z5 A ↔ B anahtarını ters çevir | 16 / 16 (iptal 0 / 0) | ÖLDÜ |
| Z6 fişin devredeni zincirle karşılaştırılmaz (her fiş geçerli) | 5 / 5 (iptal 0 / 0) | ÖLDÜ |
| Z7 geçerli fişte fişin devredeni yerine hesaplanan taşınır | 2 / 2 (iptal 0 / 0) | ÖLDÜ |
| M3 zincirde S4 emilimi yok (mahsupsuz ayın saklı İ'si = bugünkü İ) | 3 / 3 (iptal 0 / 0) | ÖLDÜ |
| M4 aralığın sonraki devredeni = fişin devredeni (carryAfter) | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| M7 Mahsup Edilmemiş Ay 6 sınırı 5 | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N1 fiş zincirde sayılırken S4 emilimi karşılaştırılmaz (yalnız devreden) | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N2 S-DKM1-1 yok: zincirdeki fişin ayı bugünkü kayıtlardan | 7 / 7 (iptal 0 / 0) | ÖLDÜ |
| N3 S-M1-3 yok: güncel olmayan fişte de sonuç fişten | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N4 'reduced' notu ayın kendi İ'si yerine düzeltilmiş İ'den (önceki ayın azalması bu aya yazılır) | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N5 azalan ay notu yazılmaz | 6 / 6 (iptal 0 / 0) | ÖLDÜ |
| N6 yön farkı notta yazılmaz (S-M1-2) | 2 / 2 (iptal 0 / 0) | ÖLDÜ |
| N7 devredeni aynı uyuşmazlıkta da devreden cümlesi | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N8 güncel değil notunun eski metni | 1 / 1 (iptal 0 / 0) | ÖLDÜ |

## 6. EXCEL DENETİM BETİĞİ (`test/excel-denetim/ekran-hafta.mjs`, CI dışı)
Kart adları "(İadeler Düşülmüş)"; eski tek "Ödenecek / Devreden KDV" kartı yerine üç sonuç kartı. 391 / 191 bağımsız modelden (`model-hafta.py`, yalnız haftayı hesaplar).
Üç sonuç kartı ayın tamamından ve önceki aylardan (zincir) gelir; model bunu hesaplamaz → beklenen yalnız rapor "Not" (ayın belgelerinin bir kısmı aralık dışında) ve "Mahsup
Edilmemiş Ay" (önceki KDV'li ay var) notu YOKKEN yazılır (önceki 0; fark artıysa Ödenecek, eksiyse Sonraki); not varsa satır "beklenen hesaplanamadı" diye yazılır, ✗ sayılmaz.
Betiğin başlangıç verisi (haftadaki taksit tahsilatlarının bağlı olduğu, hafta öncesindeki satışlar) KDV'li belge doğuruyorsa notlar çıkar ve üç kart "beklenen
hesaplanamadı" olur; doğuruyor mu — koşulmadığı için BİLİNMİYOR.
KOŞULMADI: betik iki şirkete 51 + ek işlemi ekrandan girer, `test/excel-denetim/cikti/` altındaki İZLENEN çıktı dosyalarının üzerine yazar ve süresi ölçülmedi (eski kayıt
tek koşu); yükü ve izlenen dosyaları bozma riski yüzünden bu turda koşulmadı → DENENMEYEN; sözdizimi `node --check` geçti.

## 7. HIZ
Ölçülmedi (DOĞRULANMADI). Gerekçe: değişen yol yalnız ETKİN MAHSUP FİŞİ olan aylarda ek iş yapar (`carriedBefore` — fiş sayısı × 190 satırı; 60 fiş × 60 × ~120 ≈ 0,4 milyon
işlem); ana oturumun 100 bin verisinde mahsup fişi yok (tur 2 raporu §6) → orada yol değişmedi. Ana oturum isterse `ana-kabul/betik/kabul.sh` ile KDV Özeti'ni ölçer.

## 8. KULLANICIYA SORULMALI
**S-M1K-1 — Karma ay: mahsup fişinden sonra aynı ayda hem İndirilecek KDV AZALDI hem 391 değişti (ya da İ başka kayıtla arttı)** (uç durum). Kararlar ayrı ayrı söylüyor: A
(azalan → fişten), C (güncel değil → sayılar bugünkü kayıtlardan). Bu turda KODLANMADI: ay "güncel değil" sayıldığı için C uygulanıyor (taban davranışı). Yoklama
(`m1k-betik/karma-yoklama.mjs`, yeni = taban): Ocak satış 1.000 / alış 500 → Ocak fişi 500; sonra Ocak alışı İptal Et VE Ocak'a satış KDV 100; Şubat satış 200 → Şubat fişi 700
(S4 500'ü taşıdı). Rapor Ocak **1.100**, Şubat 700, Ocak–Şubat **1.800**; gerçek 391 1.300 − 191 0 = **1.300** (azalan 500 iki kez sayılıyor; fiş "Güncel Değil" notu var).
- **A)** İki karar birlikte: İndirilecek KDV fişten (azalma sonraki mahsupta), 391 ve artıran kısım bugünkü kayıtlardan → Ocak 600, Ocak–Şubat 1.300 (= 391; not yine "güncel değil").
- **B)** Ayın sonucu tümüyle fişten (A'nın harfi): Ocak 500, Ocak–Şubat 1.200 (artıran 100, mahsup yenilenene kadar görünmez; not "güncel değil").
- **C)** Uç durum böyle kalsın (BİLİNEN SINIR): Ocak 1.100, Ocak–Şubat 1.800 (bugünkü; not "güncel değil — geri alıp yeniden mahsup edin"; kullanıcı notu izlerse düzelir).
- **ÖNERİ: A** (her değişiklik bir kez sayılır; ayrı ayrı onaylı iki kuralın birleşimi). Yaygın programlarda nasıl: belgesi / ekranı bu turda okunmadı — dayanak yazılmadı.

## 9. BAŞ MİMAR KARARI GEREKİYOR
1. "Fiş zincirde" koşuluna S4 emilim eşitliğinin eklenmesi (A.2) S-DKM1-1 = A'yı doğru uygulamak için gerekli (yoksa L'de 2.100) — baş mimar onayı / dar kontrol değerlendirmesi.
   Fişin kesildiği andaki S4 taşıması saklanmadığı için "bugünkü etkin fişlere göre" taşıma ölçü alınıyor; fişten SONRA daha önceki bir ayın kaydı değişirse (azalma) her iki
   hesap da onu görür → fiş zincirde kalır, azalma sonraki ayda düşülür (d2 it 3 bu durumu sınar).
2. "Bu ayın kayıtları fişten sonra değişti" notu yalnız KESİN olduğunda (ayın kendi İ'si < fişin saklı İ'si) çıkar; ayın kendi İ'si, fişte düşülen S4 taşımasından AZ azalırsa
   ayın sonucu yine fişten ama NOT ÇIKMAZ (seyrek; DOĞRULANMADI — sınaması yok). Daha geniş koşul (düzeltilmiş İ < saklı İ) d2 it 3'te önceki ayın azalmasını Şubat'a yazıyordu.
3. Tablo altı sabitlenmeyen eşik (kutu − 96 px) ve notların ayrı blokta durması YALNIZ KDV Özeti'nde; öbür çok satırlı tablo altlı raporlarda (UX24 "TOPLAM Satış / Alış …")
   aynı üst üste binme beklenir — görev metni dosya sınırı nedeniyle genelleştirilmedi. Genelleştirme (bütün Rapor Merkezi) baş mimar kararı.

## 10. SONRAKİ SÜRÜME
- §9.3 (öbür raporların tablo altı). Alçak ekranda tutar kartları satırı yana kayıyor (2.4.3 C5 düzeni) — KDV Özeti'nde 6 tutar kartıyla "Ödenecek KDV" kartı 1280 px'te
  kaydırınca görünüyor (tablo altında aynı sayı görünür).
- Ekran senaryosu dar pencere ölçümünü tek veriyle yapıyor; uzun yıl tablosu (12 ay) ile ayrıca bakılabilir.
- `ekran-hafta.mjs` (§6) koşusu.

## 11. DOĞRULANMADI
- Hız (§7). Windows (CI) — yeni testler dosyaya dokunmuyor; ana oturum CI'de okur.
- §9.2 not koşulunun eksik kaldığı seyrek durum.

## 12. DENENMEYEN
- Tam `npm test` (görev gereği ana oturum); `ekran-hafta.mjs` (§6); `test:kahin-cari` (cari dokunulmadı); `test:guvenilirlik`; eski sürüm verisiyle göç; 1366 × 768'den
  başka ekran boyutları için ayrı görüntü (1280 × 620 ve 1024 × 560 alındı).

## 13. BİLİNEN SINIRLAR
- S-M1-3 = C: fişten sonra artıran değişiklikte sayılar bugünkü kayıtlardan + not (karar). Karma ay §8.
- Çok alçak pencerede (kutuda başlık + iki belge satırına yer kalmıyorsa) tablo altı sabitlenmez; satırlar üst üste binmez, tablo kaydırılınca görünür.

## 14. CI LİSTESİNE EKLENECEK
- `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (yeni). Birim test `npm test` deseniyle koşar.

## 15. KILAVUZ METNİ ÖNERİSİ (son adayda toplu)
- KDV Özeti maddesine: "Bir ayı mahsup ettikten sonra o ayın alış faturasını iptal eder ya da İndirilecek KDV'yi azaltan bir kayıt girerseniz ayın sonucu kesilmiş mahsup
  fişinde kalır; azalan tutar sonraki ayın mahsubunda düşülür. Özetteki 'Mahsuptan Sonra Değişen Ay' satırı bu ayları söyler. Satırda 'mahsup fişi güncel değil' yazıyorsa
  o ayın (ve sonraki ayların) mahsubunu geri alıp ayları sırayla yeniden mahsup edin."

## 16. COMMIT LİSTESİ (t251-m1k-taban..dal ucu)
- fd051b72 M1 küçük tur rapor taslağı: nasıl bozulur listesi (koddan önce)
- fc6a9446 M1 küçük tur: KDV Özeti — fişten sonra azalan İndirilecek KDV'de ayın sonucu fişten (S-DKM1-1 = A); S4 emilimiyle kopuk fiş zincirde sayılmaz; güncel değil notu (S-M1-3 = C); yön notu (S-M1-2); eski yorum; eksik testler
- 9913294f M1 küçük tur: KDV Özeti ekranı — tablo altı satırları üst üste binmez (tfoot bütün olarak sabit), notlar tutar kartlarının altında normal yazıyla; yeni ekran senaryosu
- ef0ccf16 M1 küçük tur: Excel denetim betiği (ekran-hafta) KDV Özeti'nin yeni kart adları ve üç sonuç kartı
- 3248c7e2 M1 küçük tur: ekran senaryosu tablo altını hücre kutusundan ölçer (eski düzende hücreler tek tek yapışkandı)
- 17999831 Kanıt: M1 küçük tur — ham çıktılar, betikler, ekran görüntüleri; rapor
- (son) rapor son hâli (bu belge)

## 17. ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
cd <dal ucu ağacı>   # node_modules bağlantısı gerekli
for tz in UTC Europe/Istanbul; do HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=$tz node --test test/kdv-ozeti-mahsup-sonrasi-251.test.mjs test/kdv-ozeti-zincir-251.test.mjs test/kdv-ozeti-devreden-251.test.mjs; done   # 24/24
# taban kırmızısı: git archive t251-m1k-taban | tar -x -C <ayrı klasör>; üç test dosyasını + test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs kopyala → 15/24 (9 kırmızı), ekran 5/13
bash docs/kanit/2026-11-27/m1k-betik/komsu.sh utc <kök> <kanıt klasörü>       # 613/613 (ve ist)
npm run test:kahin-defter                                                       # 187/187, 0 fark
bash docs/kanit/2026-11-27/m1k-betik/onizleme-esit.sh <çıktı klasörü>           # BİREBİR EVET (taban kopyası /dev/shm/m1k-kdv/eski yolunu bekler)
PLAYWRIGHT_BROWSERS_PATH=<pw-1194> HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs   # 13/13
python3 -I docs/kanit/2026-11-27/m1k-betik/mutant.py <ayrı kopya> <çıktı.json> UTC   # (ve Europe/Istanbul)
node docs/kanit/2026-11-27/m1k-betik/karma-yoklama.mjs <kök>                    # §8 sayıları
```
Not: `/dev/shm/m1k-kdv/eski` ve `/dev/shm/m1k-kdv/mut` (git archive kopyaları) duruyor; ana oturum işi bitince tam yolla silebilir.
