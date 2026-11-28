# M1 KÜÇÜK TUR 5 — KDV Özeti: 'güncel değil' ay S4 birikimine bugünkü İndirilecek KDV'siyle (S-DKM1K-1 = A) — RAPOR

Taban `t251-m1k4` (4850ae2a, küçük tur 4'ün dal ucu) → dal ucu: bu raporun son commit'i (dal `worktree-agent-a925406d24b0912d5`). PUSH YOK. KDV Mahsup Fişi, ön izlemesi ve defter
DEĞİŞMEDİ (kabul D: taban = yeni BİREBİR) — yalnız Rapor Merkezi'nin KDV Özeti görünümü.
Ortam (son okuma): yük 3,2 / 4 çekirdek (koşular sırasında öbür ajanlarla 4–7; her koşudan önce okundu, yük > 4 iken bir kez beklendi), bellek boş 3 GB (kullanılabilir 11 GB), disk boş 7,4 GB. Arka plan işim: SON İLETİDE YOK (hepsi bitti).

## A. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce = taban → sonra; Raporlar → Tüm Raporlar → KDV Özeti (Beyanname Hazırlığı); ekran = PDF = Excel)
1. **Kararın örneği AYNEN** (Ocak alış KDV 1.000 fiş 0 / 0 / 1.000; Şubat satış 2.000 alış 500 fiş 1.000 / 500 / 0; Mart satış 1.000 alış 200 + 100 fiş 0 / 700 / 0; Nisan satış 500
   fişsiz; fişlerden sonra Şubat'a alış KDV +300, Mart'ın 200'lük alışı İptal Et): Ocak–Nisan Ödenecek ÖNCE **1.400** → SONRA **1.600** (= 391 3.500 − 191 1.900); Nisan ÖNCE 500 →
   SONRA **700**; ay satırları Ocak sonraki 1.000 / Şubat önceki 1.000 + ödenecek 200 / Mart 700 / Nisan 500 → **700**. DEĞİŞMEYEN: Şubat 1.000 / 200 / 0 (bugünkü kayıtlar), Mart 700
   (fişten), "Mahsuptan Sonra Değişen Ay: Şubat 2026 (mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin); Mart 2026 (bu ayın kayıtları fişten sonra değişti; ayın sonucu
   kesilmiş mahsup fişinden, İndirilecek KDV'deki azalma sonraki mahsupta düşülür)" (Şubat notu durur — ekranda okundu); Nisan ön izlemesi **500** (DEĞİŞMEDİ) → Nisan raporu (700) ön
   izlemeden ayrılır (karar metni). Görüntü: `docs/kanit/2026-11-28/m1k5-ekran/yeni/m1k5-kdv-ozeti-ocak-nisan.png`, `…/m1k5-kdv-ozeti-nisan.png`.
2. **YAN ETKİ (iş 3 — ölçüldü, ekranda okundu):** Nisan bu ön izlemeyle mahsup edilirse fiş 0 / 500 / 0 (taban ile aynı; programın 'Güncel Değil'i yok). Nisan raporu **700 KALIR** ve
   YENİ not çıkar (tabanda not yok, rapor 500): **"Zincirle Uyuşmayan Mahsup Fişi: Nisan 2026 fişi ödenecek KDV ₺500,00 yazmış, sırayla mahsupta ödenecek KDV ₺700,00 olmalıydı —
   İndirilecek KDV'deki azalma sırayla mahsupta daha önceki bir ayda düşülür (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)"**
   (görüntü `…/m1k5-kdv-ozeti-nisan-fisli.png`). Ocak–Nisan **1.600** = 391 − 191 (taban 1.400). Defter 360 = 1.700 (fişler 500 + 700 + 500; tabanla AYNI). Onarım (Nisan, Mart, Şubat
   geri al; sırayla yeniden mahsup): fişler Şubat 200 / Mart 900 / Nisan 500, rapor = fişler = 1.600, notlar kalkar, defter 360 = 1.600 (taban da aynı). Sayılar karar metnine uygun;
   **NOT METNİNİN NEDEN CÜMLESİ VE ÖNERDİĞİ ONARIM BU YÖNDE YANLIŞ** — §8 (BAŞ MİMAR KARARI GEREKİYOR). Kodlanmadı.
3. **Yıl dönümü** (aynı örnek Kasım 2026 → Şubat 2027; 'güncel değil' Aralık, azalan Ocak 2027): Bu Yıl (2027) 1.200 → **1.400** (= 391 1.500 − 191 100); Şubat 2027 500 → **700**;
   Kasım–Şubat 1.400 → **1.600**; 2026 yılı 200 DEĞİŞMEDİ (Aralık notu durur).
4. **İki ardışık 'güncel değil' ay** (Şubat İ +300, Mart İ +100; ödenecek yönde kalırlar), Nisan azalan ay (−200), Mayıs fişsiz: Ocak–Mayıs 2.100 → **2.300** (= 391 4.500 − 191 2.200);
   Mayıs 500 → **700**; not "Şubat 2026, Mart 2026 (güncel değil); Nisan 2026 (azalan)".
5. **Devreden yönlü 'güncel değil' Şubat** (fiş devreden 500 → bugün 800) + Mart fişi 500 devredenle (zincirle uyuşmaz; not eski kalıpla: "Mart 2026 fişi 500,00 TL devredenle kesilmiş,
   sırayla mahsupta 800,00 TL olmalıydı (…)") + Nisan azalan ay + Mayıs fişsiz: Ocak–Mayıs 2.200 → **2.400** (= 391 4.500 − 191 2.100); Mayıs 500 → **700**.
6. **DEĞİŞMEYENLER** (tabanda da yeşil, sınamalı): yalnız İ artışı (azalma yok) — Nisan 500, Ocak–Nisan 1.400 = 391 − 191 (artış bir kez); azalan ay ÖNCE, 'güncel değil' ay SONRA —
   Mart 700 (azalmayı kendisi düşer), Nisan 500, 1.700; kararların öbür örnekleri (S-DKM1-1, S-M1K-1, S-M1K2-1, S-M1K3-1 (a) / (b)) — tur 1–4'ün 55 sınaması komşu koşusunda yeşil
   (beklentisi değişen eski sınama YOK); yalnız 391'i değişen 'güncel değil' ayda bugünkü İ = saklı İ (sayı değişmez); dar kontrolün A, B, C, E, F, J, L, L2 senaryolarında rapor
   satırlarında fark **0**; KDV Mahsup Fişi penceresi, ön izleme, fiş satırları, defter (360 / 190), not metinleri (yeni metin YOK), A kipi.

## B. DEĞİŞEN DOSYALAR
- `server/routes/tax.mjs` (yalnız `vatView` zincir döngüsü + açıklama; 1 koşul): `done.push({ month, inMinor: kept && settled.offsetState !== "stale" ? Number(offset.inMinor) :
  step.input })` (önce `kept ? …`) — dar kontrolün deneme yamasıyla AYNI satır (başka yol seçilmedi: en küçük düzeltme; doğruluğu §3–§5 ve eşdeğerlik kanıtıyla). Kaynak yorumundaki "İ artışı S4
  taşımasına girmez (min(0, …)) — artış bir kez, devredenle sayılır" savı KALDIRILDI (yanlıştı: saklı İ birikime girdiği için artış sonraki azalmayı götürüyordu) ve yerine küçük tur 5
  paragrafı yazıldı; "S4 fişin saklı İ'siyle (… S4 / 'Güncel Değil' aylarında da)" cümlesi düzeltildi. Yeni sorgu / döngü YOK. `report-center.mjs`, `preview`, `monthPosition`,
  `carriedBefore`, `listOf`, `settle`, fiş yazımı, A kipi DEĞİŞMEDİ.
- YENİ `test/kdv-ozeti-s4-guncel-degil-251.test.mjs` (3 describe / 7 sınama; iki şirket; kâhin elle), YENİ `test/kdv-ozeti-rastgele-251.test.mjs` (2 sınama: 300 + 150 tohum; dar
  kontrolün s2 / s2b üreteci AYNEN; tohum sayısı ortam değişkeniyle yalnız ARTIRILABİLİR), DEĞİŞEN `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (F adımı, dördüncü kurulum; 35 → 45
  denetim; A–E AYNEN).
- Kanıt: `docs/kanit/2026-11-28/m1k5-betik/` (betikler), `m1k5-ham/` (ham çıktılar), `m1k5-ekran/` (görüntüler: yeni / taban).
- DOKUNULMADI: istemci, `report-center.mjs`, defter, fiş / ön izleme yazımı, göçler, `.github/**`, `package.json`, `tools/**`, `test/bagimsiz/**`, kılavuz.

## 0. NASIL BOZULUR (koddan ÖNCE, commit d7d40957) → sınama eşlemesi (G = kdv-ozeti-s4-guncel-degil-251; R = kdv-ozeti-rastgele-251; E = ekran F adımı)
1 → G "001 kararın örneği", E · 2 → G "002 devreden yönlü" · 3 → G "001 yalnız İ artışı" (değişmez) · 4 → tur 3–4 yalniz391 tablosu (komşu, değişmedi) · 5 → tur 4 "İ + 391" (komşu) · 6 →
G "001 iki ardışık" · 7 → G "002 azalan ay önce" (değişmez) · 8 → G "001 yan etki", E (yan etki), betik yan-etki.mjs · 9 → G "002 yıl dönümü", R yıl dönümü · 10 → G yan etki onarımı ·
11 → R (300 + 150) · 12 → her koşu iki TZ; G iki şirket; `sameFiles` (ekran = PDF = Excel) · 13 → komşu (tur 1–4 testleri) · 14 → kabul D.

## TARAMA (ders 10 — `git grep`)
| Değişen | Çağıranlar / okuyanlar | Sınama |
|---|---|---|
| `vatView` zincir döngüsü (tax.mjs) | yalnız `report-center.mjs` KDV Özeti (`tax().vatView()`, tek çağrı — `git grep -n vatView -- server client`) | komşu listesi |
| KDV Özeti özeti / notları (DEĞİŞMEDİ) | ekran, PDF, Excel | `sameFiles`, ekran senaryoları |
| `git grep -l -E "vatView\|offsetState\|kdv-ozeti\|KDV Özeti\|vat-offset\|Mahsuptan Sonra\|Zincirle Uyuşmayan\|Mahsup Edilmemiş\|carryAfterMinor" -- 'test/*.test.mjs'` | 29 dosya = tur 4'ün 27'si (HEPSİ tur 4'ün 51 dosyalık komşu listesinde) + bu turun 2 yeni dosyası | komşu 53 dosya |
| Aynı tarama `test/e2e/*.mjs` | 8 senaryo = kabul F listesi (birebir) | kabul F |

## 3. YENİ / DEĞİŞEN TESTLER — kırmızı nedeni ve yeşil (iki TZ)
KÂHİN ELLE (karar metni + elle hesap; programın kodundan türetilmedi — ders 5; rastgele sınamanın değişmezi karar metninin "aralık toplamı her durumda 391 − 191" sözü). Taban: ayrı kopya
`/dev/shm/m1k5-kdv/eski` (`git worktree add --detach … t251-m1k4`; içine YALNIZ iki yeni test dosyası + değişen ekran senaryosu kopyalandı). Koşu `m1k5-betik/yeni-test.sh`.
| Koşu | Taban | Yeni |
|---|---|---|
| 2 yeni dosya (9 sınama) UTC | 2/9, **7 kırmızı** | **9/9** |
| aynı, Europe/Istanbul | 2/9, **7 kırmızı** | **9/9** |
| `senaryo-kdv-mahsup-sonrasi-251` UTC | 39/45, **6 kırmızı** (yalnız F adımı) | **45/45** |
| aynı, Europe/Istanbul | — (taban İstanbul ekranda koşulmadı — DENENMEYEN) | **45/45** |
Kırmızıların NEDENİ (günlükten okundu — `m1k5-ham/m1k5-yeni-test-taban-utc.log`, ist aynı): kararın örneği Ocak–Nisan 0 / **1.400** / 0 (beklenen 1.600); yıl dönümü Bu Yıl 0 / **1.200** / 0
(1.400); yan etki Nisan **500** (700) ve not yok; iki ardışık 2.100 (2.300); devreden yönlü 2.200 (2.400); rastgele Ocak–Temmuz **300 tohumda 11 sapma** — tohum 115 (−200), 144 (−300),
154 (−100), 158 (−400), 162 (−600), 165 (−100), 166 (−200), 196 (−500), **230 (−300)**, 266 (−200), 273 (−600) — dar kontrolün listesiyle AYNI 11 tohum, hepsi EKSİ yönde (ödenecek eksik
— 'güncel değil' ayın artışı sonraki azalmayı götürüyor); yıl dönümü **150 tohumda 2 sapma** (115, 144). Ay toplamı / zincir sürekliliği kuralları tabanda da bozulmadı (yalnız 391 − 191).
"DEĞİŞMEYENLER" describe'ı tabanda da yeşil — beklenen (sabitleme; dişi T3 / T5'te). Ekran tabanı: F adımında Ocak–Nisan 1.400, ay satırları Nisan 500, Nisan 500, Nisan fişliyken
rapor 500 ve uyuşmazlık notu YOK, Ocak–Nisan 1.400 (fişler, 391 / 191 ve notlar tabanda da doğru — F'nin 4 denetimi tabanda yeşil). Hepsi BEKLENEN neden.

## 4. KABUL KOŞULLARI
- **A** §3: yeni testler tabanda beklenen nedenle kırmızı (7 + ekran 6), yenide yeşil (9/9 iki TZ, ekran 45/45).
- **B** rastgele: Ocak–Temmuz **300 tohumda sapma 0**, yıl dönümü **150 tohumda sapma 0** — iki TZ (yeni); ek kurallar (ayların Ödenecek toplamı = aralık, ay zinciri sürekli, ilk / son ay =
  aralık) de 0 bozulma. Taban 11 / 2 (yukarıda).
- **C** kararların örnekleri AYNEN: S-DKM1-1 (Ocak 500 / Şubat 700 / Mart 400 = 1.600), S-M1K-1 (Ocak 600, 1.300), S-M1K2-1 (Mart–Nisan 300), S-M1K3-1 (a) (Nisan 300 / 0 / 100) ve
  (b) (900 / 100) — tur 1–4'ün sınamaları komşu koşusunda yeşil (beklentisi değişen YOK); S-DKM1K-1 örneği AYNEN (1.600, Nisan 700, Şubat notu durur).
- **D** ön izleme / fiş / defter birebir: `m1k5-betik/onizleme-esit.sh` (tur 3–4'ünkü AYNEN, yollar): UTC ve İstanbul ön izleme / fiş / geri al / iptal / kilit satırları taban 26 = yeni
  26 **BİREBİR EVET**, rapor satırlarında fark **0**; karma yoklaması fiş 3 = 3 **BİREBİR**; `fis-esit-391.sh`: 2 = 2 **BİREBİR** (iki TZ); YENİ `fis-esit-s4.sh` (kararın örneği + yan
  etki + onarım): fiş / ön izleme / defter satırı 14 = 14 **BİREBİR EVET** (iki TZ; fark yalnız rapor satırlarında: Nisan 500 → 700, Ocak–Nisan 1.400 → 1.600, Nisan fişliyken not).
- **E** mutantlar — §5: 46 mutant; **43 ÖLDÜ** iki TZ (istenen iki: T1 7 / 76, T2b 9 / 76); D7, M4 (tur 4'ten) ve **T2 EŞDEĞER** (kanıtlı — §5).
- **F** komşular (`m1k5-betik/komsu.sh`: tur 4'ün 51 dosyası + 2 yeni): UTC **653/653**, İstanbul **653/653** (644 → 653: +9 yeni sınama); 0 başarısız / iptal / atlanan.
  `npm run test:kahin-defter` (dokunmadan): UTC **187/187**, İstanbul **187/187**. Ekran senaryoları (`m1k5-betik/e2e.sh`, iki TZ): §4F-ekran (aşağıda).
- **G** hız: yeni sorgu / döngü YOK (tek satırda koşul; `done` listesine yazılan değer değişti) — **ÖLÇÜLMEDİ** (ana oturum ölçer: `ana-kabul/betik/kabul.sh`).

### 4F-ekran (yeni kod)
| Senaryo | UTC | Europe/Istanbul |
|---|---|---|
| senaryo-kdv-mahsup-sonrasi-251 (F adımı yeni) | **45/45** | **45/45** |
| senaryo-kdv-zincir-251 | 12/12 | 12/12 |
| senaryo-kdv-devreden-251 | 14/14 | 14/14 |
| senaryo-kdv-donemi-250 | 23/23 | 23/23 |
| senaryo-defter-243 | 33/33 | 33/33 |
| senaryo-c7b-kabul-250 | 39/39 | 39/39 |
| senaryo-mobil-247 | 77/77 | 77/77 |
| senaryo-banka-210 | 429/429 | 429/429 |
Beklentisi değişen eski adım YOK (mahsup-sonrasi'ye yalnız F eklendi). Görüntüler (baktım): `m1k5-ekran/yeni/m1k5-kdv-ozeti-ocak-nisan.png` — özet 391 ₺3.500, 191 ₺1.900, Önceki 0,
Ödenecek ₺1.600, Sonraki 0; "KDV Mahsup Fişi: Ocak 2026, Şubat 2026, Mart 2026"; "Mahsuptan Sonra Değişen Ay" kartı Şubat (güncel değil) + Mart (azalan) metniyle tam genişlikte;
`m1k5-kdv-ozeti-nisan.png` — 391 ₺500, 191 0, Ödenecek ₺700 (not yok — §9); `m1k5-kdv-ozeti-nisan-fisli.png` — Ödenecek ₺700 + "Zincirle Uyuşmayan Mahsup Fişi" kartı (§A.2 metni). Taban
karşılıkları `m1k5-ekran/taban/` (Ocak–Nisan ₺1.400, Nisan ₺500, uyuşmazlık kartı YOK).

## 5. MUTANT TABLOSU
Ayrı kopyalar `/dev/shm/m1k5-kdv/mut-utc`, `mut-ist` (archive e380053e: server, test, client, tools, package.json); `m1k5-betik/mutant.py` = tur 4'ün betiği AYNEN (40 mutant; M3 yalnız metin
olarak yeni `done.push` satırına uyarlandı, anlamı aynı) + bu turun T1–T5 (T2b dahil); testler tur 4'ün 8 dosyası + `kdv-ozeti-s4-guncel-degil-251` (**74 sınama**), T*'de ayrıca
`kdv-ozeti-rastgele-251` (**76**); `--test-concurrency=2`. Ham: `m1k5-ham/mutant-{utc,ist}-{a,t}.json`. "Başarısız" = node --test üst düzey `# fail`.

| Mutant | Başarısız UTC / İst | Sonuç |
|---|---|---|
| Tur 1–4'ün 40 mutantı (D1–D10, Z1–Z7, M3, M4, M7, N1–N8, K1–K6, Y1, Y2, Y3b, Y4b, Y5, Y6) | ayrıntı `mutant-{utc,ist}-a.json` (iki TZ'de sayılar aynı; ör. D1 35, M3 5, N1 2, Y6 2, N8 22) | **38 ÖLDÜ**, D7 / M4 EŞDEĞER (tur 4'ün kanıtı; bu tur carryAfter / carryOut'a dokunmadı) |
| **T1 'güncel değil' ay S4 birikimine yine fişin saklı İ'siyle (taban davranışı)** — İSTENEN | 7 / 7 | ÖLDÜ |
| **T2 zincirde azalma birikimi min(0, …) yerine düz toplanır (ön izleme aynı)** — İSTENEN | 0 / 0 | **EŞDEĞER** (aşağıda) |
| **T2b azalma birikimi her yerde düz toplanır (ön izleme dahil)** — isteneni ön izlemeyi de kapsayacak biçimde | 9 / 9 | ÖLDÜ |
| T3 'güncel değil' ay birikime kendi bugünkü İ'siyle (S4 taşıması düşülmeden) | 4 / 4 | ÖLDÜ |
| T4 karma ay da birikime bugünkü İ'yle (S-M1K-1 azalması kaybolur) | 11 / 11 | ÖLDÜ |
| T5 azalan ay (reduced) da birikime bugünkü İ'yle (S-DKM1-1 azalması kaybolur) | 27 / 27 | ÖLDÜ |

**T2 — EŞDEĞER (öldürülemez; eksik test DEĞİL; düzeltmenin kendisinin gösterdiği değişmez).** Sav: S-DKM1K-1 = A ile zincirin S4 birikimi C = carriedBefore(done) hiçbir ayda artı
olamaz. Tümevarım: C₀ = 0; zincirdeki fiş ayında ('kept' / 'reduced' / 'mixed' — 'güncel değil' sayılmadığı için step.input = bugünkü + carried ≤ saklı) katkı bugünkü − saklı ≤ −carried;
'güncel değil' ve zincir dışı ayda katkı tam −carried; carried = min(0, C) → Cₖ ≤ max(0, Cₖ₋₁) = 0. Yani zincirde min(0, C) = C ve T2 aynı sayıyı verir. (Tabanda 'güncel değil' ay saklı
İ'yle girdiği için C artıya çıkabiliyordu — hatanın kendisi buydu.) Kanıt (iddia değil): `m1k5-betik/esdegerlik.py` ayrı kopyada `vatView`'a "C > 0 ise hata" denetimi ekler, 76 sınamayı
(rastgele 450 tohum dahil) koşar → **UTC 76/76, İstanbul 76/76, bozulma 0**; dişi: aynı kopyaya taban satırı (T1) uygulanınca **16 başarısız, 16 rapor yanıtı 500** (denetim fırlattı) —
`m1k5-ham/esdegerlik.txt`. Sonuç: öldürülebilir 43 mutantın **43'ü ÖLDÜ** (iki TZ), 3 eşdeğer (D7, M4, T2).

## 7. KULLANICIYA SORULMALI
YOK — kararın söylemediği yeni bir SAYI ayrışması çıkmadı: yan etki ölçümünde Nisan fişi (500) ≠ rapor (700) kararın "Nisan raporu Nisan ön izlemesinden (500) ayrılır" sözünün doğrudan
sonucu; aralık toplamı her durumda 391 − 191 (fişli ve onarımlı hâlde de). Bilgi (karar metninde B seçeneğinin sayıları olarak geçiyordu): onarımdan (geri al + sırayla mahsup) sonra ay
dağılımı kayar — rapor Mart 700 / Nisan 700 → fişler Mart 900 / Nisan 500; toplam 1.600 değişmez.

## 8. BAŞ MİMAR KARARI GEREKİYOR (değerlendir)
1. **Yan etki notunun metni (görünüm; sayılar doğru; KODLANMADI).** Nisan ön izlemeyle mahsup edilince çıkan not "Nisan 2026 fişi ödenecek KDV 500,00 TL yazmış, sırayla mahsupta ödenecek
   KDV 700,00 TL olmalıydı — **İndirilecek KDV'deki azalma sırayla mahsupta daha önceki bir ayda düşülür** (…; **bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin**)".
   Neden cümlesi dar kontrol L durumu (fiş azalmayı FAZLA düşmüş) için yazılmıştı; bu turda yön TERS (fiş azalmayı EKSİK düşmüş — önceki 'güncel değil' ayın artışı fişin S4'ünde
   azalmayı götürdü). Önerdiği onarım da yetmez: yalnız Nisan geri alınıp yeniden mahsup edilirse ön izleme yine 500 yazar, not kalır; onarım 'güncel değil' aydan (Şubat) başlamalı
   (Şubat'ın kendi notu bunu söylüyor). Seçenekler: **A (ÖNERİ)** `mismatchText`'e yöne göre ikinci cümle (devredeni aynı, zincirin ödeneceği fişten büyükse): "… olmalıydı — fişten
   önceki bir ayın kayıtları mahsuptan sonra değiştiği için fiş İndirilecek KDV'deki azalmayı düşmemiş; değişen aydan ('Mahsuptan Sonra Değişen Ay') başlayarak mahsupları geri alıp ayları
   sırayla mahsup edin" — yalnız metin, sayı değişmez, küçük birleşik tura; **B** 20.11 kuralıyla SONRAKİ SÜRÜME (sayılar doğru, Şubat notu doğru onarımı söylüyor); **C** uç durum böyle
   kalsın (BİLİNEN SINIR). Uç durum: 'güncel değil' + azalan ay + sonraki ayı ön izlemeyle mahsup.
2. Rastgele sınamanın süresi: `kdv-ozeti-rastgele-251` bu makinede ~7–9 dk (450 sunucu açılışı; tam `npm test` eşzamanlılık 1 → tam teste o kadar ekler; Windows'ta daha uzun olabilir).
   Alt sınır görev metninden (300 + 150); ortam değişkeniyle yalnız ARTIRILIR. Ana oturum CI süresini değerlendirsin (düşürmek kullanıcı / baş mimar kararı — plan alt sınırı kuralı).

## 9. SONRAKİ SÜRÜME (20.11 kuralı)
- Tek ay aralığında (ör. yalnız Nisan) azalmanın düşüldüğü ay 391 500 − 191 0 iken Ödenecek 700 gösterir ve aralıkta fiş yoksa NOT YOK (azalmanın nereden geldiği yalnız önceki ayı içeren
  aralıkta görünür) — baş mimarın daha önceki kuşkusuyla aynı görünüm ayrıntısı (dar kontrol: DÜŞÜK, B).
- `carryAfterMinor` alanının gereksizliği (tur 4'ten) AYNEN.

## 10. DOĞRULANMADI
- Windows'ta yeni testler (dosyaya dokunmuyorlar; ana oturum CI ile okur). Rastgele sınamanın Windows süresi.

## 11. DENENMEYEN
- Taban kodda ekran senaryosu İstanbul saatiyle (UTC'de koşuldu; birim testlerin tabanı iki TZ'de koşuldu). Tam `npm test` (ana oturum). Hız ölçümü (ÖLÇÜLMEDİ — G). 3+ şirket.
  Kesinti / disk dolu / kilitli dosya (bu fark yalnız okunan raporu değiştirir; yazım yok).

## 12. BİLİNEN SINIRLAR
- Kararın kabul ettiği: 'güncel değil' aydan sonra azalan ay varsa sonraki ayın raporu ön izlemesinden ayrılır; o ön izlemeyle kesilen fiş zincirle uyuşmaz sayılır (not çıkar); onarımdan
  sonra ay dağılımı kayar (toplam aynı).

## 13. CI LİSTESİNE EKLENECEK
- `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (küçük tur 2'den; bu turda F adımı). Birim testler `npm test` deseniyle koşar (2 yeni dosya — liste değişikliği gerekmez).

## 14. KILAVUZ METNİ ÖNERİSİ (son adayda toplu; küçük turların maddesine ek)
- "Mahsup ettiğiniz bir ayın alış faturaları sonradan artar ve sonraki bir mahsuplu ayın alışı iptal edilirse KDV Özeti azalmayı bir sonraki ayda düşer; bu yüzden o ayın raporu mahsup
  ön izlemesinden farklı olabilir. Doğrusu için 'Mahsuptan Sonra Değişen Ay' satırındaki ilk aydan başlayarak mahsupları geri alın ve ayları sırayla yeniden mahsup edin."

## 15. COMMIT LİSTESİ (t251-m1k4..dal ucu)
- d7d40957 rapor taslağı: nasıl bozulur listesi (koddan önce)
- e380053e KDV Özeti kodu (S-DKM1K-1 = A) + iki yeni test dosyası + yeni-test.sh
- 74911317 ekran senaryosuna F adımı + küçük tur 5 betikleri
- 8500d7a7 rapor taslağı + mutant betiğinde eşzamanlılık 2
- f744e4cd T2 eşdeğerlik betiği; komşu süre sınırı
- 1e4623f3 rapor taslağı (testler, kabul, mutantlar)
- 29ad5bc0 Kanıt: ham çıktılar, ekran görüntüleri
- (son iki) Kanıt: ekran İstanbul + rapor son hâli (bu belge)

## 16. ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
cd <dal ucu ağacı>   # node_modules bağlantısı gerekli
for tz in UTC Europe/Istanbul; do HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=$tz node --test test/kdv-ozeti-s4-guncel-degil-251.test.mjs test/kdv-ozeti-rastgele-251.test.mjs; done   # 9/9 (~8 dk / TZ)
# taban kırmızısı: worktree add --detach <ayrı klasör> t251-m1k4; iki yeni test + test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs kopyala → 2/9 (7 kırmızı; rastgele 11 + 2 sapma), ekran 39/45
bash docs/kanit/2026-11-28/m1k5-betik/yeni-test.sh <taban|yeni> <utc|ist> <dal ucu> <kanıt klasörü>    # taban yolu betikte /dev/shm/m1k5-kdv/eski
bash docs/kanit/2026-11-28/m1k5-betik/komsu.sh utc <kök> <kanıt klasörü>                               # (ve ist) 653/653
npm run test:kahin-defter                                                                                 # 187/187 (iki TZ)
bash docs/kanit/2026-11-28/m1k5-betik/onizleme-esit.sh <çıktı>; bash …/fis-esit-391.sh <çıktı>; bash …/fis-esit-s4.sh <çıktı>   # BİREBİR EVET
bash docs/kanit/2026-11-28/m1k5-betik/e2e.sh "" <ekran> <kanıt> "" yeni <utc|ist>                     # 8 senaryo
python3 -I docs/kanit/2026-11-28/m1k5-betik/mutant.py <ayrı kopya> <çıktı.json> <TZ> [liste]              # 43/46 öldü; D7 / M4 / T2 eşdeğer
python3 -I docs/kanit/2026-11-28/m1k5-betik/esdegerlik.py <ayrı kopya> <TZ> [taban]                       # 76/76; taban satırıyla 16 kırmızı (ana ağaçta KOŞMAYIN — kopyaya yazar, sonra geri alır)
ROOT=<kök> HUKUK_LICENSE_URL=http://127.0.0.1:9 node docs/kanit/2026-11-28/m1k5-betik/yan-etki.mjs        # yan etki dökümü (notların tam metni)
```
Not: mutant kopyaları `/dev/shm/m1k5-kdv/mut-utc`, `mut-ist` (archive kopyaları) KALDIRILDI. `/dev/shm/m1k5-kdv/eski` (worktree --detach t251-m1k4; içine iki yeni test dosyası + değişen
ekran senaryosu kopyalandı + node_modules bağı) DURUYOR — ana oturum taban kırmızısını yinelemek için kullanabilir; işi bitince bağı tam yolla silip kopyalanan üç dosyayı geri alarak
(`git -C /dev/shm/m1k5-kdv/eski checkout -- test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs`, iki yeni dosyayı tam yolla sil) `git worktree remove` ile kaldırır.
