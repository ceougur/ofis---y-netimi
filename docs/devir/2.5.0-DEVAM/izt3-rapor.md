# İzleyen tur 3: rapor (dal ucu bf9bb709)

İki iş de kodlandı ve sınandı. Push yok, zamanlanmış görev yok, arka planda işim kalmadı. Ortam: yük 2,4 / 4 çekirdek, bellek boş 1 GB (kullanılabilir 7 GB), disk boş 7,6 GB.

## Özet
- **İş 1 (Düzenle'de azaltma hızı):** Bütünlük kapısının kapsam süzgeci bir durumu artık iki ayrı satır sayıyor: rowid'in son hâli bu işlemde store ile EKLENMİŞSE ve önceki hâlin kimliği farklıysa, bu bir "silinen" ve bir "eklenen" satırdır.
  - Temiz 100 bin veride Düzenle ile azaltma 6.393 ms'den 161 ms'ye indi. Olay döngüsünün ~7 sn kilitlenmesi de kalktı.
  - Kapı dışı değişikliği yakalama aynen sürüyor: eski ve yeni kodun 14 senaryoluk dökümü iki kipte birebir aynı.
- **İş 2 (canlı yenileme):** Faturasız stok iadesi düzeltilince, silinince ya da geri yüklenince değişen her kart için öbür ekranlara `plans` olayı (planId'li) gidiyor. Geri yüklemede `accounts` olayı da gidiyor.
  - Tabanda geri yüklemeden sonra gözcünün kart penceresi ve Taksitler listesi ₺900,00'da bayat kalıyordu. Artık ₺300,00 görünüyor.

## Taban, dal, commit'ler
- Taban 3b420085. Dal: worktree-agent-ae8c8568d72566f15.
- 11 commit var; hepsinde `Co-Authored-By: Claude <noreply@anthropic.com>` ve Claude-Session satırı, model adı yok.
- Sıra: tasarım notu ve sınamalar koddan önce yazıldı.
  - 4c86c710: §21
  - b46e08ef → 6d6d4145: İş 1 sınaması → kodu
  - 263f4b61: İş 1 kanıtı
  - 483f8a47 → d4b2a864: İş 2 sınaması → kodu
  - 5ac159f5: ekran senaryosu
  - b68b2f97: §21.4
  - 4b26d213, 2047b2f8, bf9bb709: kanıt

## Değişen yollar (+753 / −5; kanıt hariç)

| Dosya | Değişiklik |
|---|---|
| `server/lib/integrity-scope.mjs` | +12 / −1 — yalnız `derive` içindeki eşleştirme döngüsü; yeni yardımcı yok |
| `server/routes/stock.mjs` | +22 — yalnız iade yolu: `publishCards`; PUT / DELETE / `restoreMove` |
| `test/izt3-kapi-rowid-250.test.mjs` | yeni |
| `test/izt3-stok-iade-canli-250.test.mjs` | yeni |
| `test/e2e/senaryo-izt3-250.mjs` | yeni |
| `package.json` | `test:senaryo-izt3-250` betiği |
| `docs/erp/C7B-FATURA-TASARIM.md` | §21.1–§21.4 |

- Göç yok. ci.yml, release.yml, `test/bagimsiz/**` ve YAPIM-ASAMASI.json'a dokunulmadı. Senaryoyu CI listesine ana oturum ekleyecek.

## İş 1 — kapı süzgecinde rowid yeniden kullanımı (§21.1)

**Kural:**
- Son hâli eklenmiş rowid'de kimlik farklıysa eşleşme iki satıra bölünür: `{pre, post:null}` + `{pre:null, post}`.
- Bu, başka bir rowid'e yazılan DELETE + INSERT ile aynı modeldir:
  - iki kimliğin varlıkları da kapsama girer;
  - `lockRelevant` iki tarafı da değişmiş sayar;
  - görünürlük denetimi iki tarafı da görür.
- Eklenmemiş rowid'de kimlik değişimi (UPDATE SET id, gözden geçirme D8) bugünkü gibi "kimlik değişti" → tam kapı.
- Store dışı yazım süzgece hiç gelmez (sayaçlar, `integrity.mjs`); bugünkü gibi tam kapıya gider.
- **Önceki turun prototipinden farkım:** prototip kimlik farkını her durumda bölüyordu. Güvenlik çekirdeğinde en dar gevşetmeyi seçtim: yalnız `capture.inserted` kesin iziyle. Hız kazancı aynı.

**Sınama: `test/izt3-kapi-rowid-250.test.mjs`, 14 test (iki kip × 6 + bulanıklaştırma 2)**
- Yeni kod: UTC 14/14, Europe/Istanbul 14/14.
- Eski kod: iki TZ 12/14. Kırmızı 2 = P1, üretim ve test kipi. İleti: `hiçbir COMMIT 'kimlik değişti' ile tam kapıya düşmez: [["full(stock_moves: kimlik değişti)"] ×3]`. Beklenen neden.
- Yakalama sınamaları eski kodda da yeşil; bu tasarım gereği (davranış aynı kalmalı):
  - Y1–Y4: açık dönem, store üzerinden; 409 invoice:stock, Y3 kabul + tarama bank:event.
  - K1–K5: kilitli dönem; 409 period-lock, K4 D8 bekçisi.
  - D1–D4: store dışı (db.prepare). Tarama bulguları ve sonraki yazımın 409'u tabanla aynı:
    - aynı rowid'e yeni kimlik, açık dönem;
    - aynı rowid'e yeni kimlik, kilitli dönem;
    - Düzenle'nin yeniden kullandığı rowid'in miktar değişimi;
    - silinip aynı kimlikle geri yazılan kilitli satır.
- Mutantlar:

| Mutant | Kırmızı test | Ayrıntı |
|---|---|---|
| m1 — kimlik değişimini hiç saymaz | 3 | K3/K4; bulanıklaştırma tohum 31'de 4 eşdeğerlik ihlali; tohum 37 (kilitli) 68 ihlal, çoğu period-lock |
| m2 — eklenmemiş rowid de bölünür (prototip) | 1 | K4 D8 bekçisi |

- Bulanıklaştırma (2.0.26 gerçek verisi, 2 tohum × 160 tur): eski ve yeni sayılar aynı.
  - Tohum 31: aynı rowid 135/160, kabul 89, ret 46.
  - Tohum 37 (kilitli): aynı rowid 144/160, kabul 25, ret 119.
  - Eşdeğerlik ihlali 0.

**Eski ↔ yeni dökümü** (`izt3-kos/kapi.mjs` + `karsilastir.py`):
- 14 senaryonun 14'ünde sonuç iki kipte birebir aynı: durum, 409 kodları, tarama bulguları, sayılar.
- Değişen yalnız kapı yolu:
  - Eski: `stock_moves kimlik değişti` ×3, `cash_entries kimlik değişti` ×2.
  - Yeni: scoped ×4, `full(bulgu: bank:event)` ×1, `cash_entries kimlik değişti` ×1 (K4, D8 aynen).

## İş 2 — stok iadesinde canlı yenileme (§21.2)
- Sınama `test/izt3-stok-iade-canli-250.test.mjs`, 5 test: yeni iki TZ 5/5, eski iki TZ 2/5.
- Eski koddaki kırmızılar, ileti ve neden (hepsi beklenen):

| Test | Eski koddaki olaylar |
|---|---|
| S1 düzeltme | `stock cash accounts@A` (plans yok) |
| S2 silme | `stock accounts@A` (plans yok) |
| S3 geri yükleme | `stock cash` (plans ve accounts yok) |

- S4 bekçisi: kartı değiştirmeyen hareket `plans` yayımlamaz.

## Komşular (ders 10)
- G2 taraması: 335 test dosyası. `test/` taramasıyla seçildi: gateVerify, integrity, ledger/integrity, period-lock, kapı, ledger_snapshot, dondur, sema-kapisi, trash/restore, stok hareketi.
  - gateVerify testlerde varsayılan açık; bu yüzden her yazım süzgeç ↔ tam kapı eşdeğerlik denetiminden geçti.
  - UTC 3527/3527 (5ac159f5), Europe/Istanbul 3527/3527 (b68b2f97, yalnız belge farkı). fail / cancelled / skipped 0.
  - Kod en son 5ac159f5'te değişti; G2 ondan sonra koşuldu.
- Komşu ekran senaryoları UTC'de 19/19 çıkış 0:

| Senaryo | Sonuç | Senaryo | Sonuç |
|---|---|---|---|
| izt3-250 | 18/18 | duzeltme-kilidi-250 | 79 |
| izt2-250 | 24 | duzeltme-kilidi-tur3-250 | 110 |
| izt-250 | 20 | iade-246 | 26 |
| dkfix-250 | 21 | cari-243 | 70 |
| 217 | 65/65 | kasa-acilis-uyari-250 | 20/20 |
| 216 | 54/54 | pos-220 | 113 |
| banka-210b | 90 | entegrator-240 | 81 |
| banka-210-eski-satir | 29 | banka-210-kart-onbellek-yaris | 49 |
| fatura-243 | 61 | uiux-b-243 | 58 |
| kdv-donemi-250 | 22 | | |

## Kâhin, iki TZ (5ac159f5)
- Cari kâhini: 103 senaryo, 24.062 denetim, 0 fark.
- Defter kâhini: 187 denetim, 0 fark; yakalanmayan mutasyon 0.
- Yapım listesi kendi kopyamda üretildi: 4 → 4; yeni 0, kapanan 0, değeri değişen 0.
  - Yalnız "paket" etiket metni farklı: Ç7b ↔ Ç5-B tur 2, 3 kayıtta. Bu, bilinen üretici nüansı.

## Hız (özel kilit dışarıda; 3 tur dönüşümlü; taze temiz-100k; Europe/Istanbul; `izt3-hiz/tablo-1.md`)
- Her ölçüm başında yük 1,09–1,44; geçersiz tur yok. KÖTÜ (ortanca ve en iyi ikisi de > +%10) yol yok.

| Yol | Taban ortanca (ms) | Yeni ortanca (ms) | Fark | Olay döngüsü en çok |
|---|---|---|---|---|
| Düzenle azaltma | 6.393 | 161 | −%97,5 | taban ~7 sn → yeni ≤ 181 ms |
| Düzenle büyük azaltma | 6.469 | 146 | | |
| YENİ fatura Düzenle azaltma | 6.613 | 145 | | |

- Kapı yolu: tabanda bu üç yol 3 turda da `full(stock_moves: kimlik değişti)`; yenide hepsi `scoped`.
- Öbür yollarda ortanca farkı:
  - kart penceresi GET +%3,4 (en iyi −%1,1); fatura kartı GET +%0,5; Düzenle aynı içerik −%3,8;
  - iade yazımı −%1,7;
  - stok iadesi yazım / düzeltme / silme / geri yükleme: −%1,7 / −%2,9 / +%4,6 / −%0,7;
  - sıradan stok düzeltme / silme: +%3,8 / +%2,1 (5 ms düzeyinde);
  - bütünlük taraması +%8,1 (en iyi +%5,1). Tam tarama kodu (`run`) değişmedi.
  - Dönem Kilidi kilitle 0, aç +%19,3. Tek ölçüm; en iyi 0, ~23 ms düzeyinde.

## Ekran (`docs/kanit/2026-11-22/izt3-ekran/`; görüntülere baktım)
- Kurulum: iki tarayıcı açıldı. Yönetici Stok penceresinden iadeyi Düzelt'le (Miktar 1 → 2), Sil'le, sonra Yönetim › Silinenler'den Geri Yükle'yle değiştirdi. Gözcünün ekranına dokunulmadı.
- Gözcünün kart penceresindeki Kalan değeri sırasıyla: ₺600 → ₺300 → ₺900 → ₺300.
- İkinci turda Taksitler listesinde: silmede ₺900, geri yüklemede ₺300.
- Yeni kod 18/18. Eski kod 16/18; geri yüklemeden sonra kart ve liste ₺900,00'da bayat kaldı, veri tabanında 300 vardı (`eski-04` görüntüsü).
- İlk koşuda beklentim yanlıştı: 600 yazmıştım. Geri yüklenen hareket Miktar 2'lik hâli olduğu için iadenin kendi tutarından (600) doğru sayı 300'dü; düzelttim.

## KULLANICIYA SORULMALI
Yok.

## BAŞ MİMAR KARARI GEREKEN
1. İş 1'de prototipten daha dar bir kural seçtim: yalnız `capture.inserted` rowid'leri bölünüyor. Gerekçesi: D8'in (UPDATE SET id) kapsamı tam kapıda kalıyor ve hız kazancı aynı. Onay gerekirse bu.
2. Gözlem (kodla karar vermedim):
   - Y3 / K4'te, açık dönemde store üzerinden son Kasa satırına yeni kimlik verilmesi bugün tam kapıda da KABUL ediliyor; tarama bank:event buluyor.
   - Bu tabanın davranışıdır ve aynen korundu. Programın kendi yolundan üretilemiyor (ham SQL).

## SONRAKİ SÜRÜME (2.5.1)
- Hız aracında "olay döngüsü 0,0" okunan satırlar (ölçüm nüansı).
- Yapım listesi üreticisi paket etiketini taşıyor (bilinen).

## DENENMEYEN
- Tam `npm test` (ana oturum yapacak).
- Windows CI.
- Uzun koşular.
- İki şirket.
- Komşu ekran senaryoları yalnız UTC'de koşuldu. izt3-250 iki TZ'de koşuldu.
- Mutantlar yalnız yeni sınama dosyasında koşuldu, G2'de değil.

## BİLİNEN SINIRLAR
- Eklenmemiş rowid'de kimlik değişimi (UPDATE SET id) bilerek tam kapıda kaldı; hız etkisi yok, program yapmaz.
- Savepoint geri alınmış bir INSERT'ün rowid'i `inserted` izinde kalır. Bu durumda aynı rowid'de sonradan yapılan UPDATE SET id süzgeçte bölünür; doğrulanmamış bir uç durum, program yolundan üretilemez.

## Ana oturumun yeniden koşacağı komutlar
Kilit kalıbı: `flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 <sn> …`. Eski kod ağacım kaldırıldı; `git worktree add --detach <yer> 3b420085` ile yeniden kurulur ve yalnız yeni test dosyaları kopyalanır.

- **Yeni sınamalar:** ağacın kökünde `TZ=<tz> HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/izt3-kapi-rowid-250.test.mjs test/izt3-stok-iade-canli-250.test.mjs`
- **Mutant:** `python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt3-ae8/mutant.py <yeni integrity-scope.mjs> m1|m2 <eski kopyanın server/lib/integrity-scope.mjs>`, sonra yeni test.
- **Eski ↔ yeni dökümü:** `node /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt3-ae8/probe/kapi.mjs <kök> prod|test` ve `python3 -I …/probe/karsilastir.py <eski> <yeni>`
- **Canlı olay probu:** `node …/izt3-ae8/probe/olay.mjs <kök>`
- **G2:** `bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt3-ae8/g2-kos.sh <ek>` (liste `g2-liste.txt`)
- **Kâhin:** `bash …/izt3-ae8/kahin.sh <ek>`
- **Ekran:** `bash …/izt3-ae8/e2e-kos.sh <TZ> <senaryolar…>`
- **Hız:** `flock -x -w 5400 …/olcum.lock timeout -k 5 6600 bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt3-ae8/hiz/kos.sh <çıktı>`, sonra `python3 -I …/izt3-ae8/hiz/tablo.py <çıktı>`. kos.sh eski kodu `$D/eski` klasöründe bekler.

Tüm betiklerin kopyası `docs/kanit/2026-11-22/izt3-kos/` ve `izt3-hiz/` altında.

## Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt3-ae8`: `probe/`, `hiz/`, `kahin/`, `e2e/`, g2-*. Rapor taslağı: `docs/kanit/2026-11-22/izt3-rapor-taslak.md`.