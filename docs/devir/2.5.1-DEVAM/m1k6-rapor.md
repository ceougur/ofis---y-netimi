# KDV Özeti küçük tur 6 — rapor

Taban: `t251-m1k6-taban` (d3f22e6c). Kapsam: tur 5 dar kontrolünün ORTA-1'i (YALNIZ METİN) — baş mimar kararı 28.11 07:40 (1)(a)–(d).
Mahsup fişi, ön izleme, defter ve KDV Özeti'nin SAYILARI DEĞİŞMEDİ (aşağıda B).
Ortam (son okuma): yük 2,4 / 4 çekirdek, bellek kullanılabilir 10 GB (boş 0–3 GB, önbellek 13 GB), disk boş 6,7 GB.

## Değişen gözlenebilir davranış (önce → sonra)

Raporlar → Tüm Raporlar → **KDV Özeti (Beyanname Hazırlığı)** — ekran, PDF ve Excel özetinde (yalnız not satırları):

1. **"Zincirle Uyuşmayan Mahsup Fişi" notu, eksi yönde** (zincirin S4 emilimi fişinkinden eksi — önceki 'güncel değil' ay; kararın örneği:
   Nisan ön izlemeyle 500 mahsup edilmiş, rapor 700):
   - önce: `Nisan 2026 fişi ödenecek KDV 500,00 TL yazmış, sırayla mahsupta ödenecek KDV 700,00 TL olmalıydı — İndirilecek KDV'deki azalma
     sırayla mahsupta daha önceki bir ayda düşülür (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)`
     (ters neden; önerdiği onarım — yalnız Nisan'ı geri alıp yeniden kesmek — notu kaldırmıyordu).
   - sonra: `Nisan 2026 fişi ödenecek KDV 500,00 TL yazmış, sırayla mahsupta ödenecek KDV 700,00 TL olmalıydı — fiş İndirilecek KDV'deki azalmayı
     düşmemiş (raporda sırayla mahsup sayıları; mahsup fişi güncel olmayan ilk aydan (Şubat 2026) başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup edin)`.
   - Notun adımları uygulanınca (Nisan → Mart → Şubat geri al; Şubat 200, Mart 900, Nisan 500 yeniden) not KALKAR; Ocak–Nisan 1.600 = fişler = 391 3.500 − 191 1.900; defterde 360 = 1.600.
   - Öbür yön (dar kontrol L — araya giren mahsupsuz ay azalmayı zincirde zaten düştü) ve devreden farkı kolu: metin AYNEN.
   - Onarım ayı = uyuşmayan aydan ÖNCEKİ ilk 'güncel değil' / karma / zincirle uyuşmayan fiş; yıl dönümünde yıl adıyla ("Aralık 2026"); iki 'güncel değil' ayda İLKİ.
2. **Yeni not "Güncel Olmayan Önceki Fiş"** (tek ay / kısmi aralık): aralığın sayısını aralık DIŞINDAKİ (önceki) 'güncel değil' / karma fiş etkiliyorsa:
   - önce: not yok (Nisan tek ay Ödenecek 700, 391 500 / 191 0, açıklama yok — ön izleme 500).
   - sonra: `Önceki aylarda güncel olmayan mahsup fişi var (Şubat 2026); bu ayın sayıları mahsup ön izlemesinden ayrılır` (çok aylı aralıkta "bu aralığın").
   - Etkilemiyorsa YOK: Mart tek ay (sonucu fişten), 'güncel değil' ayı içeren aralık (Şubat–Nisan, Ocak–Nisan; ayın kendi notu var), Tüm Zamanlar, araya
     zincirdeki fiş giren ay (B örneğinde Mayıs), ödenecek yönde yalnız 391 ya da yalnız İ artışı olan 'güncel değil' ay (Mart tek ay = ön izleme).
   - Karar: karşı hesap — o fişler olduğu gibi alınsaydı (ön izlemenin okuduğu) aralığın Önceki / Ödenecek / Sonraki'si aynı mı (bellekte ikinci zincir; yeni sorgu yok).
3. Sayılar, mahsup fişi, ön izleme, defter: DEĞİŞMEDİ.

## Değişen dosyalar
- `server/routes/tax.mjs` — `vatView`: zincir `runChain(freeze)` işlevine alındı (davranış aynı); uyuşmazlık kaydına `absorbShort`, `restartMonth`, `restartLabel`;
  `positionIn` (eski `position` + `carryAt` gövdesi); yeni `staleBefore(first, last)`.
- `server/routes/report-center.mjs` — KDV Özeti: eksi yönlü neden cümlesi, `mismatchRepair` (eksi yönlü fiş varsa onarım ayı; yoksa metin AYNEN), "Güncel Olmayan Önceki Fiş" notu.
- `test/kdv-ozeti-uyusmazlik-yonu-251.test.mjs` (YENİ, 7 sınama), `test/kdv-ozeti-s4-guncel-degil-251.test.mjs` (yan etki notu tam cümle),
  `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (F adımı: kısa not + tam cümle + onarım), `test/kdv-ozeti-rastgele-251.test.mjs` (yıl dönümü seti ayrı tohum formülü).

## TARAMA (ders 10 — `git grep vatView|mismatchesUntil|kdv-ozeti|vat-offset` test/ + server/)
| Komşu | Neden | Sonuç (UTC / İstanbul) |
|---|---|---|
| vatView çağıranı | yalnız report-center KDV Özeti | tek çağıran |
| 37 birim dosya (kdv-ozeti-* 8, c7b-* 9, banka-210-fis, banka-220-pos-kdv, defter-243-*, defter-hiz-esdegerlik-250, defter-kaynak-iz-250, devir-d3-damga-kaynak, ekstre-ayrinti-245, fis-defteri-250, license, mobil-247, raporlar-210-banka, raporlar-224, stopaj-tevkifat-iade-244, yazim-duzeni) | KDV Özeti / mahsup / rapor / yazım | 362/362 · 362/362 |
| kdv-ozeti-rastgele-251 (300 + 150 tohum) | değişmez kural | 2/2 · 2/2 |
| `npm run test:kahin-defter` (dokunmadan) | defter | 187 denetim 0 fark · 187 / 0 |
| e2e: kdv-mahsup-sonrasi-251, kdv-zincir-251, kdv-devreden-251, kdv-donemi-250, c7b-kabul-250, defter-243 | KDV Özeti ekranı | 51/12/14/23/39/33 geçti, 0 kaldı (iki TZ) |

## Yeni / değişen testler — kırmızı (taban, ayrı kopya `git worktree add --detach /dev/shm/m1k6-eski/eski t251-m1k6-taban`) ve yeşil
| Test | Taban (UTC / İst.) | Kırmızının nedeni (okundu) | Yeni (UTC / İst.) |
|---|---|---|---|
| kdv-ozeti-uyusmazlik-yonu-251 (7) | 1/7 geçti, 6 kırmızı · aynı | kısa not YOK (`Nisan tek ay kısa not` — özet yalnız tutarlar; sayılar 700 = aynı); uyuşmazlık notu eski ters cümle | 7/7 · 7/7 |
| kdv-ozeti-s4-guncel-degil-251 'yan etki' (yeni beklenti; tabana `m1k6-s4-yeni-beklenti.test.mjs` adıyla kopyalandı) | 6/7, 'yan etki' kırmızı · aynı | `Nisan uyuşmazlık notu: … daha önceki bir ayda düşülür … bu ayın ve sonraki …` | 7/7 · 7/7 (komşu koşusunda) |
| senaryo-kdv-mahsup-sonrasi-251 F (DEPO=taban) | 48 geçti, 3 kaldı | `tur 6 (b) … undefined`; iki `tam cümle` eski metin | 51/0 · 51/0 |
| kdv-ozeti-rastgele-251 yıl dönümü (yeni formül) — t251-m1k4'te (tur 5'in düzelttiği hata) | 150 tohumda 5 sapma (tohum 24, 40, 52, 53, 71; hepsi eksi) — eski formülle 2 idi | S-DKM1K-1 sınıfı | t251-m1k6 ve yeni: 0 sapma |
Taban kırmızılarında sayı satırları (700, 1.600, 2.100, 1.400) GEÇTİ — yalnız not satırları kırmızı (sayılar birebir).

## Kabul
- **A** — yukarıdaki tablo: tabanda beklenen nedenle kırmızı, yenide yeşil, iki TZ.
- **B sayılar birebir**: dar kontrolün s2-karisik üreteci taban ↔ yeni (aylar, aralık, fişler): Ocak–Temmuz 400 tohum UTC fark 0, yıl dönümü 200 tohum UTC fark 0;
  İstanbul: Ocak–Temmuz 200 + yıl dönümü 200 tohum fark 0; yeni kodda UTC ↔ İstanbul sayı ve not farkı 0. Kural bozulan 0 / 0. Not farkı YALNIZ uyuşmazlık notunda (ay: 2 tohum, yıl: 1). Kararların örnekleri: Ocak–Nisan 1.600, Nisan 700, B 2.100, iki
  'güncel değil' 2.300, yıl dönümü 1.400 — hepsi tabanla aynı (taban kırmızılarında sayı satırları geçti).
- **C notun onarımı sonuç verir**: kalıcı testte dört düzen (A, B, iki 'güncel değil', yıl dönümü) + rastgele üreteçte eksi yönlü notu olan 3 tohumun HEPSİ (ay 22, 249;
  yıl 22) iki TZ: notun söylediği aydan geri al + sırayla yeniden mahsup → uyuşmazlık notu kalkar, denge = 391 − 191, ay toplamı = aralık, rapor = fişler
  (betik `s6-onarim.mjs`; tohum 22'de kalan tek not Ocak 2026'nın 'azalan ay' bilgi notu — fişten sonra alış iptali, S-DKM1-1 = A; okundu).
  Tabanın önerdiği onarımın (yalnız bu ay) sonuç VERMEDİĞİ kalıcı testte (A2) sabit.
- **D mutantlar** — hepsi YAKALANDI (aşağıda).
- **E komşular + ekran senaryoları** — yeşil (TARAMA).
- **F hız**: yeni SQL yok (ders 47); ikinci zincir yalnız aralığın başından önce 'güncel değil' / karma fiş varken, bellekte (ay sayısı kadar adım). Büyük veride ÖLÇÜLMEDİ.

## Mutant tablosu (`mutant.py`; kopya `/dev/shm/m1k6-mut/yeni`; uyusmazlik-yonu + s4-guncel-degil + mahsup-sonrasi, UTC)
| Mutant | Sonuç |
|---|---|
| M1 yön ayrımı kalkar (eski metin) | YAKALANDI (5 kırmızı) |
| M1b her uyuşmazlık eksi sayılır (öbür yön bozulur) | YAKALANDI (dar kontrol L, 1) |
| M2 onarım ayı = SON 'güncel değil' ay | YAKALANDI (iki 'güncel değil' ay, 1) |
| M2b onarım ayı = uyuşmayan ayın kendisi | YAKALANDI (5) |
| M3 kısa not her zaman (etkilemese de) | YAKALANDI (4) |
| M4 kısa not hiç | YAKALANDI (5) |

## KULLANICIYA SORULMALI
Yok (sayı ayrışması çıkmadı).

## BAŞ MİMAR KARARI GEREKİYOR
- **Devreden farkı kolunun onarımı da sonuç vermiyor (tabanda da; bu turun kapsamı dışında, metin AYNEN bırakıldı).** Önceki 'güncel değil' ay devreden yönde
  (S-M1K2-1 / S-M1K3-1: bugünkü devredeni taşınır) ve sonraki ayın fişi eski devredenle kesilmişse not `Mart 2026 fişi 500,00 TL devredenle kesilmiş, sırayla
  mahsupta 800,00 TL olmalıydı (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)` diyor; yalnız Mart ve sonrası
  geri alınıp yeniden kesilince ön izleme yine defterdeki 500'ü okur, not AYNEN kalır (D1); Şubat'tan başlayınca kalkar (D2: Şubat 1.000 / 0 / 800, Mart 800 / 1.000 / 0,
  Nisan 900; Ocak–Mayıs 2.400 = 391 − 191). Betik `s5-devreden-onarim.mjs`, çıktı `m1k6-s5-devreden-onarim-utc.txt`. Ayın kendi 'güncel değil' notu (Şubat) aynı
  raporda durduğu için kullanıcı yolu bulur, ama uyuşmazlık notunun önerdiği adım yanlış. ÖNERİ: aynı tek satırlık kural bu kola da — önceki ayda güncel olmayan
  fiş varsa onarım cümlesi o aydan (bu turun `mismatchRepair`'i `absorbShort` yerine "önceki güncel olmayan fiş var" koşuluna genişletilir; dört test dosyasının
  beklenen metni değişir: karma, yalnız391, s4-guncel-degil, e2e D/E adımları). Yalnız metin; sayı değişmez.

## SONRAKİ SÜRÜME (20.11 kuralı)
- PDF'in özet kartları uzun not metnini kart genişliğinde "…" ile kısaltıyor (tabanda da, bütün notlarda; ekran ve Excel tam). Yeni testin PDF denetimi bu yüzden
  not başlığını arar, tam metni Excel'de denetler.
- Tabanda da var: uyuşmazlık notu iki sonuç aynıyken de çıkabiliyor (s2 tohum 249: "ödenecek KDV 400,00 TL yazmış, sırayla mahsupta ödenecek KDV 400,00 TL
  olmalıydı" — fiş farklı kayıtlarla kesilmiş, sonuç tesadüfen aynı). Görünüm ayrıntısı.
- Rastgele üreteçte eksi yönlü uyuşmazlık nadir (600 tohumda 3); onarım denetimi kalıcı rastgele teste eklenebilir.

## DOĞRULANMADI
- Kısa not, aralık başından önceki 'güncel değil' fişleri HEPSİYLE birlikte listeler (birlikte etki ediyorsa); yalnız birinin etkilediği, öbürünün etkilemediği
  karışık durumda etkilemeyen ay da adıyla görünür — üretilmedi.

## DENENMEYEN
- Büyük veride hız ölçümü (ana oturumun kabul düzeneği); Windows (CI'de okunacak); tam `npm test` (ana oturum); uyuşmazlıkta eksi yön + önceki mahsupsuz ay
  (Mahsup Edilmemiş Ay notu da çıkar; onarım o ayı kapsamaz — mahsupsuz ay notunun kendi talimatı geçerli) kalıcı testte yok.

## CI listesine eklenecek
- `test/kdv-ozeti-uyusmazlik-yonu-251.test.mjs` birim (npm test deseniyle zaten koşar). Yeni ekran senaryosu YOK (F adımı mevcut senaryoda).

## Kılavuz metni önerisi (KDV Özeti)
"KDV Özeti'nde 'Zincirle Uyuşmayan Mahsup Fişi' notu çıkarsa, notta adı geçen aydan başlayarak mahsupları en yeniden geriye doğru geri alın, sonra ayları sırayla
yeniden mahsup edin; not kalkar. Tek ay seçtiğinizde 'Güncel Olmayan Önceki Fiş' notu görürseniz, önceki aylardan birinin mahsup fişi kayıtlar değiştiği için güncel
değildir; o ayı geri alıp sırayla yeniden mahsup edin."

## Commit listesi / dal ucu
- 9901a20e — NASIL BOZULUR listesi (koddan önce)
- 235409ec — kod + testler
- d317cb55 — Kanıt (docs/kanit/2026-11-28/m1k6-*, 65 dosya)
- rapor commit'i (dal ucu)
Taban t251-m1k6-taban (d3f22e6c); PUSH YOK.

## Ana oturumun yeniden koşacağı komutlar
```
cd <ağaç> && for tz in UTC Europe/Istanbul; do TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/kdv-ozeti-uyusmazlik-yonu-251.test.mjs test/kdv-ozeti-s4-guncel-degil-251.test.mjs test/kdv-ozeti-mahsup-sonrasi-251.test.mjs; done
# taban kırmızısı: git worktree add --detach <kopya> t251-m1k6-taban; yalnız test/kdv-ozeti-uyusmazlik-yonu-251.test.mjs kopyalanır (+ s4 yeni beklentisi ayrı adla)
TZ=Europe/Istanbul DEPO=<ağaç ya da taban> PLAYWRIGHT_BROWSERS_PATH=…/pw-1194 HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs
ROOT=<kod> TZ=UTC SET=ay SEEDS=22-22 node docs/kanit/2026-11-28/m1k6-s6-onarim.mjs   # onarım; 249 ve SET=yil 22 de (dk-m1k5/ortak.mjs'i mutlak yoldan içe aktarır)
ROOT=<kod> node /tmp/…/dk-m1k5/s1-ornek.mjs ; s3-nisan-tek.mjs (dar kontrolün betikleri)
```
