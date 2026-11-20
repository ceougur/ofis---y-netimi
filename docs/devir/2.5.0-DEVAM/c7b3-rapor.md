Ç7b TUR 3 DEVAM 3 — RAPOR (ajan abcab14e726c6a077)

Taban `c7b3-devam3` (da458f89) olarak doğrulandı. Dal ucu **556f64ae** (worktree-agent-abcab14e726c6a077). PUSH yok. Zamanlanmış görev kurulmadı. Arka plan işim kalmadı; /dev/shm ve eski kod kopyam silindi.
Ortam son okuma: yük 1,29 / 4 çekirdek, boş bellek 11 GB, boş disk 7,9 GB.

Kapsamı daraltan bildirim (20.11 09:00) uygulandı. Programı ya da kullanıcıyı etkilemeyen ayrıntıları kovalamadım; hepsi aşağıda "SONRAKİ SÜRÜME (2.5.1)" başlığında.

Kısaca:
- **S218 = B kodu yazıldı.** `acilis-onarimi-hiz-250` iki saat diliminde yeniden yeşil.
- **Kabul E'de önceki koddan kalan ciddi bir yavaşlama bulundu ve düzeltildi.** Kaynağı devam 2'nin commit'lemediği ölçüm.
- **Fatura iptali ve silmede +~30 ms fark kaldı.** Bu senin kararını bekliyor (aşağıda).

## DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

**1. S218 = B — açılış onarımı yine eski yönde, son taksitten geriye keser.**
- Bu onarım, 2.0.24–2.0.26'da iade geri ödemesiyle yanlış büyümüş kartları küçültür.
- Örnek (FIS2026000000047): kart kalanı 1.300, hedef 1.250; taksitler 19.09 666,66 · 19.10 683,34; kilit 07.10.
  - da458f89: kart onarılmıyordu, "kilitli" listesine düşüyordu; kart 50 TL fazla kalıyordu.
  - Şimdi: 50 TL 19.10'dan kesilip kart onarılıyor (2.1.0'dan beri bütün kurulumların aldığı sonuçla aynı).
  - Cari bakiyesi iki durumda da değişmez.
- İade, iptal / silme ve trimCovers karar (4) yönünde kalıyor (en önce gelen açık taksitten). Kart testi iki saat diliminde 9 / 9.

**2. Hız düzeltmesi — davranış aynı, yalnız okuma azaldı.**
- Fatura kartı, satış yazımının yanıtı ve iptal / silme, faturayı içine almış Mevcut Borç kartını bulmak için artık carinin bütün defterini (kapsam okuması) yalnız gerekince okuyor: faturadan sonra (ya da aynı anda) açılmış etkin bir Mevcut Borç kartı varsa.
- Dayanak: kart yalnız açıldığı ana kadar doğmuş borcu kapsar (`lib/invoice-settle.mjs`, `born <= plan.at`).
- Tarih biçimi ISO-UTC değilse ya da tarihler eşitse yine okuyor (güvenli taraf).
- `trimCovers` defteri artık `withRemaining: false` ile okuyor; okuduğu alanların iki yolda aynı olduğu testle gösterildi.
- İptal penceresi notu, kart kapanma / küçülme sayıları değişmedi (ekran senaryosu ve kâhinlerle doğrulandı).

## DEĞİŞEN DOSYALAR
- `server/routes/plans.mjs`
  - `cutTargets(..., { order: "tail" })` eklendi: eski döngünün birebiri.
  - `cutPlan` / `shrinkPlan` bu `order`'ı geçiriyor; varsayılan "due" = karar (4).
  - `trimCovers` defteri `withRemaining: false` ile okuyor.
- `server/routes/invoices.mjs`
  - `repairOwnCards`: kilit aynası da kesim de `order: "tail"`.
  - Yeni `mayBeCovered`; kullanan yerler: iptalin `coverIds`'i ve `coverCancelText`.
- `test/c7b-tur3-hiz-250.test.mjs` (yeni).
- `docs/erp/C7B-FATURA-TASARIM.md` §16.9 (S218) ve §16.10 (hız).
- Kanıt: `docs/kanit/2026-11-20/c7b3-d4-*`; rapor taslağı `c7b3-rapor-taslak.md` bölüm 8–14.
- Kılavuz değişmedi; bu turun işleri kullanıcıya görünen metni değiştirmiyor, PDF yeniden üretilmedi.

## TESTLER — kırmızı nedeni ve yeşil (iki saat dilimi)
- **S218 (379b07e7):**
  - Yeni kodda: `acilis-onarimi-hiz-250` 3 / 3, `acilis-onarimi-savunma-250` 6 / 6, `c7b-tur3-kart-250` 9 / 9, `c7b-tur3-eski-surum-250` 5 / 5.
  - Önceki uçta (da458f89) `acilis-onarimi-hiz-250` 1 / 3. Nedeni iletide okundu: "ikinci koşu: onarılan 0 (beklenen 0), kilitli 4 (beklenen 3)" ve eşdeğerlik bölümleri eski dökümden ayrı. Eski kodda (c7b3-taban) 3 / 3.
- **Karşı mutantlar (S218):**

| Mutant | acilis-onarimi-hiz-250 | Sonuç |
|---|---|---|
| A: onarımın kesimi ve aynası karar (4) yönünde (iki koşu) | 1 / 3 ("kilitli 4") | YAKALANDI, 4 / 4 koşu |
| B: yalnız kilit aynası karar (4) yönünde | 1 / 3 | YAKALANDI |
| C: yalnız kesim karar (4) yönünde | 2 / 3 (eşdeğerlik: taksitler / fatura durumları / cariler / aday kartlar ayrı) | YAKALANDI |

  Savunma testi ve kart testi üç mutantta da yeşil: onarım yönünün koruyucusu `acilis-onarimi-hiz-250`.
- **`c7b-tur3-hiz-250` (yeni):**
  - Yeni kodda iki saat diliminde 3 / 3.
  - Eski kodda (4b568420, ayrı kopya) 2 / 3, beklenen nedenle: fatura kartı defteri iki kez okuyor; iptal de iki kez okuyor ve biri kuyruklu.
  - Eşdeğerlik sınamaları eski kodda da yeşil (özellik testi).

## KABUL KOŞULLARI — son kodda

| Kabul | Sonuç |
|---|---|
| A — defter kâhini | İki saat diliminde 187 / 187, 0 fark |
| B — cari kâhini | İki saat diliminde 17.580 / 17.582; devam 2'nin bulduğu AYNI iki fark: d50 KI2 / KI3 toplam = S210 = A / S211 = A, cari kâhini bakımı bekliyor; yeni fark yok. Yapım aşaması listesi yeniden üretilmedi (farklar birebir aynı) |
| C — muhasebe sürücüsü (değiştirilmedi) | 7.770 / 7.568 / 62; sınıf dağılımı önceki koşuyla satır satır aynı ("Ç7b-(4)" s57 ve "Ç7b (S15 = A)" kalkık; s58 TK3 = S210 farkı adıyla; "Ç7b-(6)" kalıyor) |
| A / C'nin onarım yolundan etkilenmesi | ETKİLENMEZ: onarım yalnız eski sürüm verisinde, açılışta çalışıyor |
| G2 komşu | 54 dosya (52 + iade-210-onarim + banka-210-altin): iki saat diliminde 727 / 727. Hız düzeltmesinden sonra 55 dosya: iki saat diliminde 730 / 730 |
| G — ekran (`senaryo-c7b-tur3-250`) | Son kodda iki saat diliminde 32 / 32 |

## HIZ (E)
Temiz 100 bin satırlık verinin taze kopyaları; taban → yeni → taban → yeni; 5 tekrar; ÖZEL kilit. Kilitsiz 08:56 (yük 1,05–1,44), kilitli 09:51 (yük 1,08–1,15). Geçersiz blok iki kipte de 0. Değerler ms; da458f89 sütunu düzeltmeden önceki ortanca oranı.

| Yol | Taban en iyi / ortanca (kilitsiz) | da458f89 | Yeni kilitsiz | Yeni kilitli | Hüküm |
|---|---|---|---|---|---|
| Fatura kartı | 126,7 / 131,1 | ×1,58 | 128,1 / 133,2 | ×1,03 | tamam |
| Satış yazımı (taksitli) | 240,5 / 253,5 | ×1,30 | 245,5 / 261,7 | ×1,07 | tamam |
| Satış (kapsayan kartlı cari) | 198,4 / 208,6 | ×1,45 | ×1,06 | ×1,02 | tamam |
| İade (kart küçülmesi) | 740,8 / 773,1 | 0,95 | 524 / 544 | 0,70 | tamam (daha hızlı) |
| Faturasız stok iadesi | 280,6 / 285,2 | 0,96 | 101 / 104 | 0,35 | tamam (daha hızlı) |
| İptal (taksitli, tahsilatsız) | 134,1 / 143,0 | ×3,26 | 163,5 / 176,7 | 170,9 / 174,2 | **KÖTÜLEŞEN** (1,24 / 1,20; +~30 ms) |
| İptal (kapsayan kartlı cari) | 126,6 / 133,8 | ×3,21 | 154,5 / 158,8 | 1,25 | **KÖTÜLEŞEN** (+~30 ms) |
| Silme (kapsayan kartlı cari) | 155,6 / 159,2 | ×2,85 | 181,2 / 188,4 | 1,23 | **KÖTÜLEŞEN** (+~30 ms) |
| Geciken listesi, yazımdan önce | 780 / 892 | — | 0,96 | 1,04 | tamam |
| Geciken listesi, döngünün yazımlarından sonra | — | ×2,40 | ×2,21 | ×2,22 | KARŞILAŞTIRILMAZ |
| Cari kartı, Mizan, Mutabakat Testi, taksit tahsilatı | — | — | 0,89–0,99 | 0,95–1,06 | tamam |
| S15 iptali | 409 | — | 200 | 200 | KARŞILAŞTIRILMAZ |

- Geciken listesinin tanısı (aynı veride iki kod): aradaki fark S15 iptali. Bu iptal tabanda 409 ile reddediliyor ve yazım yapılmıyor; yeni kodda kartı kapatıp yazıyor. Kart kaldıran / kapatan her yazımdan sonra listenin ilk çağrısı tam yeniden kurulum (~2 sn), tabanda da öyle (taban 1.966 / yeni 2.187). Yani aynı işlemin yavaşlaması değil, YENİ bir yazımın bedeli.
- CPU profili ve tanı betikleri `c7b3-d4-hiz-bulgu-*` ve `c7b3-d4-tani3-*` altında.

## BAŞ MİMAR KARARI GEREKİYOR
**Fatura iptali / silmede kalan +~30 ms (×1,18–1,25, iki kipte de).**
- Kaynağı `settleCoverOnCancel` → `trimCovers`'ın carinin bakiyesini ve kart kalanlarını okuması (kuyruksuz okuma, ~25–30 ms).
- Bu, S206 / S211 ailesinin YENİ kuralının ("faturayı içine almamış Mevcut Borç kartı borçtan büyük kalırsa küçülür, borcu kalmayan kapanır") gerektirdiği okuma; taban bu kuralı hiç uygulamıyordu.
- Seçenekler:
  - **A (öneri):** S15 satırı gibi "yeni kuralın bedeli" sayılsın; birleşime engel olmasın. Mutlak artış ~30 ms; yalnız açık Mevcut Borç kartı olan caride. Mutlak süre tabanın düzeltme öncesi ×3'ünden ~165 ms'ye indi.
  - **B:** Ayrı küçük bir hız turu açılsın: bakiye ve kart kalanı ucuz SQL ile ön denetlenir, fazla yoksa defter hiç okunmaz. Eşdeğerlik testi ister; bakiye tanımının defterle birebir aynı olduğunun gösterilmesi gerekir.

## KULLANICIYA SORULMALI
Yok. S218 iş listesindeki karara göre uygulandı; yeni bir para / defter kuralı sorusu çıkmadı.

## DOĞRULANMADI
- Yapım aşaması listesi son kodda yeniden üretilmedi. Cari kâhini farkları devam 2'nin bulduğu iki kayıtla birebir aynı.

## DENENMEYEN
- Bu turda kabul D (eski sürüm verisi) için yalnız `c7b-tur3-eski-surum-250` (v2.4.9 gerçek kodu) koşuldu; iki saat diliminde 5 / 5.
- Rastgele sıra testi (`test:mutabakat`) koşulmadı.
- CI dışı öbür senaryolar ve tam `npm test` koşulmadı (görev metni gereği).
- Kılavuz PDF değişmediği için yeniden üretilmedi.

## SONRAKİ SÜRÜME (2.5.1)
- Kart kapanınca / kaldırılınca Geciken listesinin artımlı yenilenmesi (bugün ilk çağrı tam kurulum, ~2 sn).
- `trimCovers` için ucuz ön denetim (B seçeneği seçilmezse).
- S217 durumunda İptal Et penceresinin reddi önceden söylememesi (devam 2'nin DÜŞÜK gözlemi).

## CI LİSTESİNE EKLENECEK
- `senaryo-c7b-tur3-250` (ci.yml'ye eklemedim).

## COMMIT'LER (c7b3-devam3..556f64ae)
- 379b07e7 S218 = B kodu ve tasarım §16.9
- 41d11469 Kanıt: S218 ve mutantlar
- 4b568420 Kanıt: G2 komşu 727 / 727
- 82c4ca0a Hız düzeltmesi, yeni test ve tasarım §16.10
- 7645fe0d Kanıt: hız bulgusu, test ve komşu 730 / 730
- 6fccbf94 Kanıt: kabul A / B / C ve ekran senaryosu
- 5435488f Kanıt: hız kilitsiz
- 92d60f9a Kanıt: Geciken listesi tanısı
- 556f64ae Kanıt: hız kilitli

## ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR (worktree'de, iki saat dilimi; `HUKUK_LICENSE_URL=http://127.0.0.1:9`)
- `node --test test/acilis-onarimi-hiz-250.test.mjs test/acilis-onarimi-savunma-250.test.mjs test/c7b-tur3-kart-250.test.mjs test/c7b-tur3-eski-surum-250.test.mjs test/c7b-tur3-hiz-250.test.mjs`
- Taban kırmızısı:
  - `c7b-tur3-hiz-250` → 4b568420 kopyasında (beklenen: fatura kartı / iptal iki okuma).
  - `acilis-onarimi-hiz-250` → da458f89 kopyasında ("kilitli 4 (beklenen 3)").
- Mutantlar: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3-d4/mut.sh` (+ `mutant.py`).
- Komşular: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3-d4/komsu.sh <TZ>`; liste `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3-d4/komsu-son.txt` (55 dosya).
- Kâhinler: `npm run test:kahin-defter`, `npm run test:kahin-cari`; sürücü `node test/bagimsiz/muhasebe-surucu/kos.mjs --cikti <klasör>`.
- Hız: `timeout -k 5 5400 bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3-d4/hiz.sh <kilitsiz|kilitli> 5`, tablo için `hiz-tablo.py`. Taban `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3-d2/taban`, yalnız okunur.
- Ekran: `bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b3-d4/kos-e2e.sh <ad> <TZ> hayir senaryo-c7b-tur3-250`.
