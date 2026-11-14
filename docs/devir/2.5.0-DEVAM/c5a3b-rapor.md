# Ç5-A TUR 3b — RAPOR (yalnız taşıma; davranış aynı)

Dal `worktree-agent-a076afd863444806e`, uç `06dde4aa`. Taban `c5a3b-taban` (bac4b267). PUSH YAPILMADI. Ağaç temiz; izlenmeyen tek şey node_modules bağlantısı.
Ortam (rapor anı): yük 0,37 / 4 çekirdek, boş bellek 10 GB, boş disk 6,3 GB.

## Davranışın değişmediğinin kanıtı (kabul A)
Döküm betiği `c5a3b-betik/dok.mjs`, tur 3a'nın betiğinin genişletilmiş hâli. Dökülenler:
- dışa açık yüzün hepsi: obligationsFor / obligationsOf (soğuk ve ılık) / allObligations / entryStates / allEntryStates / paymentStates / repairScreen / cardLedgerState;
- ayrıca cari kartının defteri (`detail().ledger`), allLedgers satırları, `plans.forAccount` ve `ledgerPlansByAccount`.

Taban ve yeni kod, aynı verinin iki taze kopyasında, durağan saatle koştu.

| Veri | Kapsam | Döküm | SHA-256 | Fark |
|---|---|---|---|---|
| Temiz 100 bin satır | 2 şirket, 1.890 cari | 1.892 satır, 499.731.234 bayt | 50e217fd…4298, iki tarafta aynı | 0 (`cmp`) |
| v2.4.9 fikstürü | 50 cari | 51 satır | e08707ec…7732, iki tarafta aynı | 0 |
| Kendi sınıf verim | kalıcı testin yeni hakemi, 24 cari-durum | — | UTC ve İstanbul üretimi bayt bayt aynı | 0 |

Yeni kodda modülün kendi kurduğu yolu (yalnız store, ayrı salt okunur bağlantı) servisle bütün carilerde karşılaştırdım:
- temiz 100 bin: 1.484 + 406 cari; v2.4.9: 50 cari;
- cari kümesi aynı; satır farkı 0, tek cari farkı 0, toplu farkı 0.

## Taşınanlar
Yeni dosya `server/lib/account-lines.mjs`, işlev `createAccountLines({ store })`. Gövdelerin 131 satırı betikle bayt bayt taşındı (her blok yeni dosyada ardışık ve tek kez).

| Eski yer (taban satırı) | Yeni yer |
|---|---|
| routes/accounts.mjs 44–45 `STOCK_REASON_SQL` | account-lines modül düzeyi |
| routes/accounts.mjs 138–145 `entriesOf` | account-lines (kapanış içi) |
| routes/accounts.mjs 1748–1753 (allLedgers'ın satır okuma döngüsü) | `entriesByAccount(scope, args)` |
| routes/accounts.mjs 1755–1756 (accountLedger döngüsü) | `ledgerLinesOf(rows, entries, planMap)` |
| routes/plans.mjs 1638–1750: cutsCache / returnCuts / scanReturnCuts, saleSourceCache / SALE_SOURCE_SQL / parsePayload / saleSourceOfEvent / saleSources, ledgerPlansByAccount | account-lines |

- **Gövdede değişen satır yok.** Eklenenler: allLedgers'tan çıkan iki parçanın işlev başlığı ve `return` satırı (4 satır), dosya başı yorumu, iki içe aktarım, dönüş nesnesi.
- **İkinci dosyanın gerekçesi:** iade kesimi ve satış kaynağı bellekleri taksit servisinin örneğinde kalmalı, servis bunun için kuyruğun girdi kurucusunu kurmak zorunda kalmamalı. Zincirin okuyucuları da kuyruktan geniş. Dosya döngü üretmiyor: yalnız lib/accounts.mjs ve lib/money.mjs'i içe aktarıyor, lib/bank/doubtful.mjs'i aktarmıyor.

**Kaynakta değişenler:**
- plans.mjs: taşınan bloğun yerinde tek satır `const { returnCuts, saleSources, ledgerPlansByAccount } = createAccountLines({ store });` + bir içe aktarım.
- accounts.mjs: `const { entriesOf, entriesByAccount, ledgerLinesOf } = createAccountLines({ store });` + bir içe aktarım; allLedgers'ta iki çağrı satırı. `planMap` satırı iki çağrının arasında kaldı, sorgu sırası aynı.
- obligation-input.mjs: üç yeni işlev (aşağıda), bir içe aktarım, başlık yorumunun bir cümlesi. Tur 3a'nın taşıdığı gövdeler değişmedi.

**Bellek ömrü aynı:** taksit servisi kayıt anında tek örnek kuruyor; anahtarlar ve işlem içi dallar aynen. accounts servisinin örneği yalnız belleksiz işlevleri çağırıyor. Bellekler modül düzeyinde değil, örnekte.

## Modülün yeni dışa açık yüzü (obligation-input.mjs)
- `ledgerLines({ ids, plans } = {})` → silinmemiş carilerin satırları; allLedgers'ın kuralı.
- `accountInput(accountId, day, ledger = null)` → tek carinin kuyruk girdisi; satır verilmezse kendisi kurar.
- `batchInputs(day, { ledgers, ids } = {})` → allSettled'in kurgusu.
- Eski "satırlar parametreyle" yolu aynen çalışıyor (testte ayrıca karşılaştırıldı).

## Çağıranlar (tarama)
- Üretim: routes/plans.mjs (`forAccount` ve dönüş nesnesindeki `ledgerPlansByAccount`), routes/accounts.mjs (detail 188, waFacts 248, düzeltme sınırı 863, allLedgers).
- allLedgers'ın okuyucuları değişmedi: invoices.mjs 707 ve 2154, overview.mjs 257, report-center.mjs 1789 ve 1821. `plans().ledgerPlansByAccount` okuyucuları da değişmedi: accounts allLedgers, invoices 2150.
- Testler adları yalnız servis yüzünden okuyor. Mutasyon desenleri dosya yoluyla güncellendi (aşağıda).

## Kabul B–F
**B — kalıcı test.** `test/obligation-input-250.test.mjs`'e ikinci vaka eklendi; tur 3a'nın vakası ve hakemi değişmedi.
- Ayrı sunucu, ayrı hakem: `test/fixtures/obligation-input-250-zincir-hakem.json`, c5a3b-taban'da `HAKEM_YAZ_ZINCIR` ile üretildi.
- Sınıflar: bağlı tahsilat + aynı gün iki bağsız tahsilat, şüpheli kaydı, çek bağı, iadeli Mevcut Borç kartı (iade sonrası ikinci durum), stoktan taksitli satış, silinen kart ve Silinenler'den geri gelişi, silinen cari, kilit, iki şirket, işlem içi okuma.
- Yeni kodda iki TZ 2/2 yeşil, çıkış 0.
- Tabanda iki TZ 1/2 KIRMIZI. İleti: "modül carinin satırlarını kendisi kuramıyor (ledgerLines yok — zincir taşınmadı)".
- B7 kipleri: ön koşul gerçekleşmedi, çünkü bu testte açılışta bekleyen dondurma yok. 'gozlem' kipi 240 sn'de asılıyor; değişmemiş tur 3a vakasında da aynısı oluyor.

**Mutasyon: 26/26 değerle yakalandı** (tur 3a'nın 14'ü + 12 yeni).
- Yeni mutantlar: kart atla, silinmiş kart haritaya girer, iade kesimi kayar, satış kaynağı boş, cari kartı okuyucusunda bağ düşer, toplu okuyucuda bağ düşer, kart haritasız satır, silinmiş cari kümeye girer, süreç düzeyi kart haritası belleği (iki şirket karışır), iade kesimi belleği bayat, satış kaynağı belleğe boş yazılır, tek cari yolu satırsız.
- İlk taramada 5 mutant değer iletisiyle yakalanmadı. Düzeltme: hakem karşılaştırması modül ↔ servis karşılaştırmasından önceye alındı; hakeme cari kartının defteri ve kart listesi eklendi.
- "Modül düzeyi tekil örnek" mutantı ikinci şirketi açamadı, yani program çöktü (değer iletisi değil). Yerine değerle yakalanan bellek mutantı kondu. Ayrı commit, a4b53e9f.

**C — kâhinler (taban = yeni):**
- defter: 187 denetim, 0 fark;
- cari: 16.459/16.459 (+31 yapım aşaması); çıktılar yalnız geçici klasör adında farklı;
- yapım aşaması listesi kendi kopyamda yeniden üretildi: FARKSIZ.

**D — komşular ve desenler:**
- 343 dosya (adla anan 27 + accounts/plans API'sini anan 337), iki TZ 3.827/3.827, çıkış 0.
- r2-249 M1–M7: 7/7 öldü. tyk-mutasyon KD1-c/d/e/f/i: 5/5 öldü. İkisinde de desenler yeni yolda tek eşleşme veriyor.
- Öbür mutasyon dosyalarının hiçbir dizgisi taşınan metne uymuyor.
- Mutabakat / Defter testleri iki TZ 63/63.

**E — hız** (temiz 100 bin, 5 tekrar, `flock -x`; tablolar `c5a3b-ham/hiz-tablo.md` ve `hiz2-tablo.md`):
- Geçerli üç çiftte sekiz yol ölçütü geçti.
- Vade Takip sınırda:

| Ölçüm | Başta yük | Vade Takip ortanca / en iyi | Hüküm |
|---|---|---|---|
| 1. ölçüm, 1. çift | 0,82–1,34 | −2,2 % / −3,7 % | geçti |
| 1. ölçüm, 2. çift | 0,82–1,34 | +10,4 % / +21,0 % (tabanın o koşudaki en iyisi alışılmadık düşük: 1.080 ms) | eşik üstü |
| 2. ölçüm (yineleme), 1. çift | 0,93–1,40 | +4,8 % / +2,7 % | geçti |
| 2. ölçüm, 2. çift | 2,25 | — | GEÇERSİZ (yük > 2) |

  Taşıma iş miktarını değiştirmiyor (aynı SQL, aynı sıra). Aday ölçümünüzde Vade Takip'e ayrıca bakmanızı öneririm.

**F — ekran:** 37 senaryo yeşil, çıkış 0. Seçim: ci.yml'deki e2e adlarından cari ve taksit/iade yoluna dokunanlar (tarama) 33 + senaryo-kart-iade-gecmis-250, senaryo-iade-246, senaryo-tahsile-ver-220, senaryo-kayit-bag-31e. Örnekler: tyk-tur2a 51/51, pos-kart-249 383/383, banka-210 428/428. Tam liste `c5a3b-ham/e2e-1.log` ve `e2e-2.log`'da. Yeni senaryo eklenmedi; CI listesine eklenecek bir şey yok.

## Tur 3c için bıraktıklarım
- **Kurulum:** `const input = createObligationInput({ store: createStore(openDatabase(dbPath, { readOnly: true })) })`.
  - Tek cari: `buildObligations(input.accountInput(id, gün))`.
  - Toplu: `input.batchInputs(gün)`.
- **Uyarı (ders 47):** satırsız `accountInput` kart haritasını her çağrıda baştan kuruyor. Temiz 100 bin satırda 1.484 cari tek tek 589 sn sürdü (cari başına yaklaşık 0,4 sn). Çok carili yükleyici haritayı bir kez almalı: `ledgerLines({ ids, plans })`, ardından `accountInput(id, gün, satırlar)` ya da `batchInputs(gün, { ledgers })`.
- **Döngü (§18.2 madde 3):** account-lines doubtful'u içe aktarmıyor; lib/bank/doubtful.mjs satırları buradan döngüsüz kurabilir. Kuyruk girdisindeki `doubtfulRecordsOf` döngüsü için tur 3a'nın önerisi duruyor: `obligationExtras` şüpheli kalanlarını dışarıdan alan bir parametre kazanır.

## Kapsam dışı bulgu
- B7 zorlama betiğinin 'gozlem' kipi, açılışta bekleyen dondurması olmayan bir testte 240 sn asılıyor (tabandaki tur 3a vakasında da). Bu betiğin kendi davranışı; ürün kusuru görmedim.

## Doğrulanmadı / denenmedi / koşulmadı
- Tam `npm test` koşmadım (görev gereği).
- Hız ikinci ölçümün ikinci çifti geçersiz kaldı (yük 2,25); Vade Takip kesin hükmü ana oturumda.
- Windows'ta koşmadım.
- Sınıf verisi eşdeğerliği yalnız kalıcı testin hakemiyle yapıldı; dok.mjs dökümü sınıf verisinde koşulmadı.
- Geri yükleme sonrası bellek ömrü testte sınanmadı (yeniden açılışta servisler yeniden kuruluyor; koddan okundu).
- Hakem kimlik normalleştirmesine kullanıcı kimliği eklendi ("[kullanıcı]"); tur 3a'nın etiketleyicisine dokunmadım.

## Windows'ta izlenecek
- test/obligation-input-250.test.mjs (iki sunucu, ayrı salt okunur bağlantı).
- r2-249 ve tyk-mutasyon desen yolları CI dışında; Windows'ta koşulmuyorlar.

## Yeniden koşu için komutlar ve beklenen sayılar
| Ne | Komut | Beklenen |
|---|---|---|
| Kalıcı test | `TZ=UTC` ve `TZ=Europe/Istanbul` ile `node --test test/obligation-input-250.test.mjs` | 2/2 |
| Taban kırmızısı | `git archive c5a3b-taban` kopyasına yeni test + `test/fixtures/obligation-input-250-zincir-hakem.json` | 1/2, ileti "ledgerLines yok — zincir taşınmadı" |
| Mutasyon | `node test/obligation-input-250-mutasyon.mjs --kopya <HEAD archive kopyası>` | "SONUÇ: 26 geçti, 0 kaldı" |
| r2-249 | `node test/r2-249/mutasyon.mjs <kopya>` | 7/7 |
| tyk-mutasyon | `node test/tyk-mutasyon-250.mjs --klasor <boş klasör> --yalniz KD1-c,KD1-d,KD1-e,KD1-f,KD1-i` | 5 ÖLDÜ |
| Eşdeğerlik | `bash docs/kanit/2026-11-14/c5a3b-betik/esd.sh temiz100k <temiz-100k>` (betikteki taban kopyası yolu `…/c5a3b-z4/taban` silindi, yeniden açılmalı) | "BAYT BAYT AYNI", sha256 50e217fd… |
| Kâhinler | `npm run test:kahin-defter`, `npm run test:kahin-cari` | 187/0 fark, 16.459/16.459 |
| Komşular | liste `c5a3b-ham/komsu.txt` | 3.827/3.827 |

## Commit listesi
| Commit | İçerik |
|---|---|
| bcf0745c | §18.11, koddan önce |
| 8727f23c | taşıma + modülün üç işlevi + r2-249 / tyk-mutasyon desen yolları |
| caf22edd | kalıcı test vakası + hakem + 12 mutant |
| a4b53e9f | test düzeltmesi (hakem önce, defter ve kart listesi hakemde, M23) + hakemin yeniden üretimi |
| 93622fb8 | §18.12 sonuçlar |
| 06dde4aa | Kanıt (docs/kanit/2026-11-14/c5a3b-*) |

## Not defteri
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3b-z4` (5,5 MB: betikler ve çıktılar; taban kopyası ve veri kopyaları silindi).
- /dev/shm temiz.
