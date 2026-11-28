# KDV Özeti küçük tur 7 — rapor

Taban: `t251-m1k6` (e99b6c95, tur 6'nın dal ucu). Kapsam: tur 6 raporunun BAŞ MİMAR KARARI 28.11 08:49 (1) — 'Zincirle Uyuşmayan Mahsup Fişi' notunun
DEVREDEN FARKI kolunda da onarım ayı kuralı. YALNIZ METİN: mahsup fişi, ön izleme, defter ve KDV Özeti'nin sayıları DEĞİŞMEDİ (aşağıda B).
Ortam (son okuma): yük 2,9–6,2 / 4 çekirdek (başka ajanlar da koşuyordu; yeni yük yalnız ≤ 4'te başlatıldı), bellek kullanılabilir 8 GB, disk boş 5,7 GB.

## Değişen gözlenebilir davranış (önce → sonra)

Raporlar → Tüm Raporlar → **KDV Özeti (Beyanname Hazırlığı)** — ekran, PDF ve Excel özetinde YALNIZ 'Zincirle Uyuşmayan Mahsup Fişi' notunun onarım cümlesi:

1. **Devreden farkı kolu, önceki ayda mahsup fişi güncel olmayan ay VARSA** (tur 6 s5 vakası: Şubat fişi devreden 500 kesilmiş, sonra Şubat'a alış KDV +300 →
   Şubat 'güncel değil', bugünkü devreden 800; Mart fişi 500 devredenle kesilmiş):
   - önce: `Mart 2026 fişi 500,00 TL devredenle kesilmiş, sırayla mahsupta 800,00 TL olmalıydı (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)`
     — o adım (Mart ve sonrası geri al + yeniden) notu KALDIRMIYORDU (Mart yine defterdeki 500'le kesiliyor).
   - sonra: `Mart 2026 fişi 500,00 TL devredenle kesilmiş, sırayla mahsupta 800,00 TL olmalıydı (raporda sırayla mahsup sayıları; mahsup fişi güncel olmayan ilk aydan (Şubat 2026) başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup edin)`.
   - Notun adımları (Nisan → Mart → Şubat geri al; Şubat, Mart, Nisan sırayla) uygulanınca not KALKAR: fişler Şubat 1.000 / 0 / 800, Mart 800 / 1.000 / 0, Nisan 0 / 900 / 0;
     Ocak–Mayıs 2.400 = 391 4.500 − 191 2.100; defterde 360 = 1.900 (Mart 1.000 + Nisan 900).
   - Onarım ayı = uyuşmayan aydan ÖNCEKİ ilk 'güncel değil' / karma / zincirle uyuşmayan fiş (tur 6'nın eksi yön düzeni); iki 'güncel değil' ayda İLKİ; yıl dönümünde yılıyla
     ("Aralık 2026"); aralık dışında kalsa da (Mart tek ay, Nisan tek ay) adıyla.
2. **Önceki ayda güncel olmayan fiş YOKSA** (ör. yalnız mahsupsuz Şubat): cümle AYNEN 'bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin'.
3. **Zincirleme uyuşmazlık** (Mart fişi uyuşmuyor, Nisan fişi Mart'ın uyuşmayan fişinden): listede Mart ve Nisan, onarım 'ilk aydan (Mart 2026)' (Mart tek ayda cümle AYNEN) —
   önceki zincirle uyuşmayan fiş tur 6'nın tanımıyla 'güncel olmayan fiş' sayıldı (aşağıda BAŞ MİMAR KARARI GEREKİYOR (1)'de değerlendirmeye sunuldu).
4. Neden cümleleri ('… devredenle kesilmiş, sırayla mahsupta … olmalıydı', yön cümlesi), eksi yön (tur 6) ve öbür yön (dar kontrol L) metinleri, 'Güncel Olmayan Önceki Fiş',
   'Mahsuptan Sonra Değişen Ay', 'Mahsup Edilmemiş Ay' notları: DEĞİŞMEDİ. Sayılar, mahsup fişi, ön izleme, defter: DEĞİŞMEDİ.

Bundan etkilenen mevcut beklentiler (hepsinde önceki ayda 'güncel değil' / karma fiş vardı): karma (Mart 2026, Aralık 2026), yalnız391 (Mart 2026 ×9, Ocak 2026, Aralık 2026 ×3),
s4-guncel-degil 002 (Şubat 2026), ekran senaryosu C (Ocak 2026), D ve E (Mart 2026).

## Değişen dosyalar
- `server/routes/tax.mjs` — `vatView` / `runChain`: uyuşmazlık kaydında `carryGap` (fişin devredeni ≠ zincirinki) kolunda da `restartMonth` = önceki ilk 'güncel değil' / karma /
  uyuşmayan fiş (yoksa boş); `firstStale` ortak (eksi yönde AYNEN `firstStale || month`).
- `server/routes/report-center.mjs` — `mismatchRepair`: eksi yön süzgeci kalktı, onarım ayı olan HER kalemin en eskisi (yoksa cümle AYNEN).
- `test/kdv-ozeti-devreden-onarim-251.test.mjs` (YENİ, 5 sınama); `test/kdv-ozeti-karma-251.test.mjs`, `test/kdv-ozeti-yalniz391-251.test.mjs`, `test/kdv-ozeti-s4-guncel-degil-251.test.mjs`
  (beklenen cümle); `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (C / D / E cümlesi; D ve E'de notun onarımı EKRANDAN: KDV Mahsup Fişi penceresinde Geri Al + Mahsup Fişini Oluştur,
  fişler veri tabanından, notlar kalkar).

## TARAMA (ders 10 — `git grep restartMonth|mismatchRepair|carryGap|Zincirle Uyuşmayan|bu ayın ve sonraki` server/ client/ test/ + tur 6'nın komşu listesi)
| Komşu | Neden | Sonuç (UTC / İstanbul) |
|---|---|---|
| restartMonth / mismatchRepair çağıranı | yalnız report-center KDV Özeti; istemci notu yalnız gösterir (hof-report-center.js) | tek çağıran |
| tur 6'nın 37 birim dosyası + yeni test (38) | KDV Özeti / mahsup / rapor / yazım | 367 / 367 · 367 / 367 |
| kdv-ozeti-rastgele-251 (300 + 150 tohum) | değişmez kural | 2 / 2 · 2 / 2 |
| `npm run test:kahin-defter` (dokunmadan) | defter | 187 / 0 fark · 187 / 0 |
| e2e: kdv-mahsup-sonrasi-251, kdv-zincir-251, kdv-devreden-251, kdv-donemi-250, c7b-kabul-250, defter-243 | KDV Özeti ekranı | 57 / 12 / 14 / 23 / 39 / 33 geçti, 0 kaldı (iki TZ) |

## Yeni / değişen testler — kırmızı (taban, ayrı kopya `git worktree add --detach /dev/shm/m1k7-eski/eski t251-m1k6`) ve yeşil
| Test | Taban (UTC / İst.) | Kırmızının nedeni (okundu) | Yeni (UTC / İst.) |
|---|---|---|---|
| kdv-ozeti-devreden-onarim-251 (5) + karma / yalnız391 / s4 yeni beklentileri (tabana `m1k7-*-yeni-beklenti.test.mjs` adıyla) | 43 sınama: 20 geçti, 23 kırmızı · aynı | HEPSİ `actual: '… (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)'` — beklenen 'ilk aydan (X) …'; sayı satırları not satırından ÖNCE ve geçti | 43 / 43 · 43 / 43 |
| senaryo-kdv-mahsup-sonrasi-251 (DEPO=taban) | 53 geçti, 4 kaldı · aynı | C, D, iki E satırı: notun eski cümlesi; ekrandan onarım adımları ve sayılar tabanda da GEÇTİ (sayı aynı) | 57 / 0 · 57 / 0 |

## Kabul
- **A** — yukarıdaki tablo: tabanda beklenen nedenle kırmızı, yenide yeşil, iki TZ.
- **B sayılar birebir**: dar kontrolün s2-karisik üreteci (dk-m1k5, değiştirilmeden) taban ↔ yeni: ay 400 tohum UTC + 200 İstanbul, yıl dönümü 200 UTC + 200 İstanbul —
  SAYI FARKI (aylar / aralık / fişler) 0, kural bozulan 0 / 0, hata 0; not farkı YALNIZ devreden kolunun onarım cümlesinde (99 / 57 / 57 / 57 tohum; neden kısmı birebir,
  'beklenmeyen biçim' 0, uyuşmazlık notu dışında 0); yeni kodda UTC ↔ İstanbul sayı ve not farkı 0. Yeni kodda cümleyi AYNEN taşıyan uyuşmazlık notu 18 / 8 / 8 / 8 (önceki
  güncel olmayan fiş yok). Kalıcı testte kararın örnekleri: Ocak–Mayıs 2.400, Mart 800 / 1.000 / 0, Ocak–Mart 700, Bu Yıl 200 / 800 / 0, Ocak–Nisan sonraki 200.
- **C notun onarımı sonuç verir**: kalıcı testte dört düzen (s5 vakası; iki 'güncel değil' — ödenecek yönde Ocak + devreden yönde Şubat → 'Ocak 2026'; yıl dönümü 'Aralık 2026', fiş
  değişiklikten SONRA; zincirleme 'Mart 2026') + öncesiz durumda AYNEN cümlenin adımları — hepsinde not kalkar, rapor = fişler = 391 − 191; ekran senaryosunda D ve E onarımı
  ekrandan. Rastgele üreteçte (tur 6'nın `m1k6-s6-onarim.mjs`'i değiştirilmeden, yeni kodda; 'ilk aydan (X)' onarımı artık devreden kolunda da uygulanıyor): onarım uygulanan
  101 / 58 / 58 / 58 tohumun (devreden kolu içeren 99 / 57 / 57 / 57) HEPSİNDE, X'ten önce mahsupsuz ay YOKSA not kalktı, denge / ay toplamı / rapor = fiş tuttu (bozulan 0).
  Kalkmayan 21 / 10 / 10 / 10 tohumun HEPSİNDE X'ten önce 'Mahsup Edilmemiş Ay' var (üreteç o notu uygulamıyor); iki not BİRLİKTE uygulanınca (s7) 21 + 10 tohumun hepsinde not
  kalktı, bozulan 0. Onarımdan sonra kalan tek not 'bu ayın kayıtları fişten sonra değişti' bilgi notu (azalan ay, S-DKM1-1 = A; okundu).
- **D mutantlar** — 12 / 12 YAKALANDI, iki TZ (aşağıda).
- **E komşular + ekran senaryoları** — yeşil (TARAMA).
- **F hız**: yeni SQL yok (ders 47); onarım ayı zincir adımında bellekteki aylardan (ay sayısı × uyuşmazlık sayısı). Büyük veride ÖLÇÜLMEDİ.

## Mutant tablosu (`m1k7-mutant.py`; kopya `/dev/shm/m1k7-mut/yeni` = 1c97b8e2; 6 test dosyası, 59 sınama; UTC / İstanbul)
| Mutant | Sonuç |
|---|---|
| M1 yön ayrımı kalkar (tur 6) | YAKALANDI 5 / 5 |
| M1b her uyuşmazlık eksi sayılır (tur 6) | YAKALANDI 1 / 1 |
| M2 onarım ayı = SON güncel olmayan ay (tur 6; artık iki kolda) | YAKALANDI 4 / 4 |
| M2b eksi yönde onarım ayı = uyuşmayan ayın kendisi (tur 6) | YAKALANDI 5 / 5 |
| M3 kısa not her zaman (tur 6) | YAKALANDI 4 / 4 |
| M4 kısa not hiç (tur 6) | YAKALANDI 5 / 5 |
| M7a devreden kolu 'bu aydan' (ay adıyla, uyuşmayan ayın kendisi) | YAKALANDI 25 / 25 |
| M7b devreden kolu eski cümle | YAKALANDI 23 / 23 |
| M7c rapor yalnız eksi yönün onarım ayını okur | YAKALANDI 23 / 23 |
| M8 devreden kolunda onarım ayı = SON güncel olmayan ay | YAKALANDI 3 / 3 |
| M9 öncesiz durumda da onarım ayı = bu ay (AYNEN bozulur) | YAKALANDI 3 / 3 |
| M9b önceki uyuşmayan fiş 'güncel olmayan' sayılmaz | YAKALANDI 1 / 1 (zincirleme sınaması) |

## KULLANICIYA SORULMALI
Yok (sayı ayrışması çıkmadı; yalnız metin).

## BAŞ MİMAR KARARI GEREKİYOR
1. **Zincirleme uyuşmazlıkta (önceki güncel olmayan fiş yalnız 'zincirle uyuşmayan fiş') cümle değişti.** Görev metni 'önceki aylarda mahsup fişi güncel olmayan ay varsa …
   (tur 6'nın eksi yön düzeni)' diyor; tur 6'nın düzeni önceki zincirle uyuşmayan fişi de sayıyor, ben de saydım. Sonuç: Mart (mahsupsuz Şubat'tan dolayı uyuşmuyor) + Nisan (Mart'ın
   fişinden) listesinde onarım 'ilk aydan (Mart 2026)'; Mart tek ayda cümle AYNEN. Adımlar (Nisan → Mart geri al; Şubat, Mart, Nisan sırayla — Şubat'ı 'Mahsup Edilmemiş Ay'
   notu söyler) notu kaldırıyor (kalıcı test). Öbür okuma (yalnız 'güncel değil' / karma sayılır): bu durumda cümle AYNEN 'bu ayın ve sonraki …' kalırdı — iki aylık listede 'bu ay'
   belirsiz. ÖNERİ: böyle kalsın (mutant M9b bu okumayı sabitler).
2. **Onarım cümlesi mahsupsuz ayı kapsamaz.** Onarım ayından ÖNCE mahsupsuz ay varsa (rastgele üreteçte 21 / 400 ay, 10 / 200 yıl) yalnız uyuşmazlık notunun adımı notu
   kaldırmaz; aynı raporda duran 'Mahsup Edilmemiş Ay' notu ('ayları sırayla mahsup edin') da uygulanınca kalkıyor (31 / 31). Tabanda da aynı (eski cümle de mahsupsuz ayı
   söylemiyordu); metin karar gereği 'mahsup fişi güncel olmayan' ayı söylüyor. ÖNERİ: kod değişmesin; kılavuz metnine 'Mahsup Edilmemiş Ay notu da varsa önce o aydan başlayın'
   cümlesi eklensin (aşağıda). Uç durum böyle kalsın (BİLİNEN SINIR) da seçilebilir.

## SONRAKİ SÜRÜME (20.11 kuralı)
- Onarım üretecinin (s6) 'Mahsup Edilmemiş Ay' notunu da uygulayan biçimi (s7) kalıcı rastgele teste eklenebilir (tur 6'nın 'eksi yön onarım denetimi' maddesiyle aynı aile).
- Tur 6'nın SONRAKİ SÜRÜME maddeleri AYNEN (PDF özet kartının uzun notu '…' ile kısaltması; iki sonuç aynıyken uyuşmazlık notu).

## DOĞRULANMADI
- Tur 6'dan AYNEN: kısa notun etkilemeyen ayı da adıyla göstermesi (üretilmedi).
- Aynı notta eksi yönlü kalem + devreden farkı kalemi birlikte (NASIL BOZULUR 8): kalıcı testte YOK; kod tek cümlede en eski onarım ayını yazar (mantıkla), s2'de eksi yönlü
  notlu 2 / 1 / 1 / 1 tohumun hepsi s6 onarımında kalktı.

## DENENMEYEN
- Büyük veride hız ölçümü (ana oturumun kabul düzeneği); Windows (CI'de); tam `npm test` (ana oturum).
- Ekran senaryosu C'de (karma, Şubat 'ilk aydan (Ocak 2026)') onarım ekrandan yürünmedi (yalnız cümle); karma onarımı birim testinde (karma-251) var.

## CI listesine eklenecek
- `test/kdv-ozeti-devreden-onarim-251.test.mjs` birim (npm test deseniyle zaten koşar). Yeni ekran senaryosu YOK (D / E adımları mevcut senaryoda).

## Kılavuz metni önerisi (KDV Özeti; tur 6 önerisinin yerine)
"KDV Özeti'nde 'Zincirle Uyuşmayan Mahsup Fişi' notu çıkarsa, notta adı geçen aydan başlayarak mahsupları en yeniden geriye doğru geri alın, sonra ayları sırayla yeniden mahsup
edin; not kalkar. Raporda 'Mahsup Edilmemiş Ay' notu da varsa o aylar da sırayla mahsup edilir; önce adı geçen en eski aydan başlayın. Tek ay seçtiğinizde 'Güncel Olmayan Önceki
Fiş' notu görürseniz, önceki aylardan birinin mahsup fişi kayıtlar değiştiği için güncel değildir; o ayı geri alıp sırayla yeniden mahsup edin."

## Commit listesi / dal ucu
- 2ea42e06 — NASIL BOZULUR listesi (koddan önce)
- 1c97b8e2 — kod + testler
- e652d08a — Kanıt (docs/kanit/2026-11-28/m1k7-*, 93 dosya)
- rapor commit'i (dal ucu)
Taban t251-m1k6 (e99b6c95); PUSH YOK. Not: iş B ilk denemede aracın 30 dk arka plan sınırında kesildi (eski-yil-ist yarıda — BELİRSİZ); yalnız o adım + mutantlar 2 saat
sınırla yeniden koşuldu (m1k7-s2-durum.txt'te iki bölüm).

## Ana oturumun yeniden koşacağı komutlar
```
cd <ağaç> && for tz in UTC Europe/Istanbul; do TZ=$tz HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test --test-concurrency=1 test/kdv-ozeti-devreden-onarim-251.test.mjs test/kdv-ozeti-karma-251.test.mjs test/kdv-ozeti-yalniz391-251.test.mjs test/kdv-ozeti-s4-guncel-degil-251.test.mjs; done
# taban kırmızısı: git worktree add --detach <kopya> t251-m1k6; yalnız yeni test + üç değişen test ayrı adla (m1k7-*-yeni-beklenti.test.mjs) kopyalanır
TZ=Europe/Istanbul DEPO=<ağaç ya da taban> PLAYWRIGHT_BROWSERS_PATH=…/pw-1194 HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs
ROOT=<kod> TZ=UTC node docs/kanit/2026-11-28/m1k6-s5-devreden-onarim.mjs     # tur 6 s5: D0 / D1 notu artık 'ilk aydan (Şubat 2026)'
cd …/dk-m1k5 && ROOT=<kod> TZ=UTC SET=ay SEEDS=1-400 node s2-karisik.mjs > yeni.jsonl ; python3 -I docs/kanit/2026-11-28/m1k7-s2-karsilastir.py yeni.jsonl eski.jsonl
ROOT=<kod> TZ=UTC SET=ay SEEDS=48-48 node docs/kanit/2026-11-28/m1k7-s7-iki-not.mjs   # iki not birlikte onarım (s6'da kalkmayan bir tohum)
```
