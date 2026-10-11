# Hız düzeltmesi (2.1.0, 11.10.2026) — özet ve kanıt

Plan: `docs/BANKA-MODULU-PLAN.md` §3.11 madde 5 ("Hareketler sayfası ve arama 1.000.000 satırda < 1 sn" — kabul ölçütü). Sorun (ölçek testi,
`docs/kanit/2026-10-11/olcek`): 001'de 100.000 + 002'de 12.000 para satırında tek kullanıcıda Banka Hareketleri p50 2,7 sn, Cari arama 1,9 sn;
10 kişide p95 9,8–12,1 sn; 20 kişide en çok 87 sn; olay döngüsü 6–16 sn tıkanıyor. Kök neden (CPU profili): banka raporları (money-lines
`classified` bütün satırları JS'e çeviriyordu) ve her cari aramasında bütün carilerin toplamları.

Dal `worktree-agent-abebd705e2a893684` (taban 2824f22). Push yok, PR yok.

## Commit'ler

| Commit | İçerik |
|---|---|
| fdfaf69 | Banka raporları SQL toplamıyla (tek sınıflama tanımı `classColumns`), dönem öncesi devir SQL'de (`keyTotals`), ücret payı GROUP BY ile önceden toplanır, para satırı okuması dizinle (COALESCE kaldırıldı, CROSS JOIN sırası), cari araması yalnız ilk 20 carinin bakiyesini hesaplar (`list` ids kipi), Kasa eksi bakiye denetimi yalnız denetlenen yolun bakiyesi (`wayBalance`); eşdeğerlik testi + dondurulmuş eski kod (kâhin) |
| 214db63 | Banka Bakiye ve Banka Hareket Raporu ayrı iş parçacığında (salt okunur anlık görüntü; `lib/report-worker.mjs`, `lib/report-runner.mjs`) |
| 892b57e | Ölçüm aracı: istek başına olay döngüsü |
| d3992aa | İş parçacığının bağlantısı yanıttan önce kapanır; sunucu kapanışı iş parçacıklarını bekler (Windows'ta geri yükleme EBUSY almasın); ölçüm aracının olay döngüsü ölçümü düzeltildi (monitorEventLoopDelay.reset ilk tutulmayı kaydetmiyordu); iş parçacığı mutasyonları |
| ad9ebc9 | Banka Masraf Raporu da iş parçacığında (100.000'de 0,8 sn ana iş parçacığını tutuyordu; `movements.feeReport` kodu değişmedi) |
| be429b6 | Ölçek aracı: ekrandan kaydedilen masrafın izi TAM eşleşir (aşağıda "araç hatası 1") |
| c5079a9 | Ölçek aracı: Banka penceresi döngüsü Escape yarışıyla pencereyi kapatıyordu (aşağıda "araç hatası 2"); profil aracı |
| e1cde05 | Test İ10 (inceleme-226-2): Kasa bakiyesi sorgu sayacı `wayBalance` sorgusunu da tanır (aşağıda npm test) |
| (bu commit) | Kanıt dosyaları, ekran hatası yeniden üretme betiği, bu özet |

Dokunulan ürün dosyaları: `server/lib/bank/money-lines.mjs`, `server/routes/report-center.mjs`, `server/routes/accounts.mjs`, `server/routes/cash.mjs`,
`server/lib/report-worker.mjs` (yeni), `server/lib/report-runner.mjs` (yeni), `server/app.mjs`, `server/lib/config.mjs` (`reportWorker`, varsayılan
açık). Para çekirdeğine (bank.post, kapı) dokunulmadı; istemci kodu değişmedi.

## 1. Tek istek ÖNCE ↔ SONRA (aynı veri kopyası, boş sunucu, flock)

Komut: `flock /tmp/destekofis-olcum.lock node docs/kanit/2026-10-11/hiz-duzeltme/tek-istek.mjs --kod <kod> --kaynak <olcek klasörü> --etiket once|sonra --json … --tekrar 5`
(ÖNCE kodu = `git archive 2824f22` ayrı kopya — ders 23). Ham: `tek-istek-once.{json,log}`, `tek-istek-sonra.{json,log}`; tablo `tek-istek-tablo.md`
(`karsilastir.mjs`). SONRA kodu ad9ebc9 (sonraki commit'ler yalnız test/araç).

**Çıktı eşdeğerliği (gerçek 100.000 satırlık veride): 44 raporun/listenin TAM çıktı özeti (sha256: bütün satırlar, TOPLAM, özet) iki kodda AYNI, 0 farklı.**

| Uç | ÖNCE HTTP p50 | SONRA HTTP p50 | ÖNCE olay döngüsü en çok | SONRA olay döngüsü en çok |
|---|---|---|---|---|
| Banka Bakiye Raporu (8 süzgeç/dönem) | 1.588–1.772 ms | 408–462 ms | 1.688–1.892 ms | 8–13 ms (iş parçacığı) |
| Banka Hareket Raporu Bu Yıl tüm hesaplar (55.418 satır) | 2.574 ms | 2.052 ms | 2.650 ms | 11 ms |
| Banka Hareket Raporu Hesabı Atanmamış | 2.166–2.286 ms | 189–193 ms | 2.249–2.602 ms | 6 ms |
| Banka Hareket Raporu tek vadesiz hesap | 990–1.184 ms | 942–1.055 ms | 1.123–1.312 ms | 9–42 ms |
| Banka Hareket Raporu kart (17 satır) | 3 ms | 124–138 ms | 7 ms | 7 ms |
| Banka Masraf Raporu | 836 ms | 1.009 ms | 859 ms | 10 ms |
| Alt Hesap Mizanı | 507–526 ms | 213–234 ms | 560–627 ms | 222–256 ms |
| Banka ve POS Hareketleri (yerinde) | 4.564–4.712 ms | 3.065–3.113 ms | 4.822–4.877 ms | 3.192–3.237 ms |
| Kasa Hareketleri (yerinde) | 1.762 ms | 1.052 ms | 1.826 ms | 1.079 ms |
| Banka Hareketleri listesi (50) | 6–26 ms | 6–25 ms | ≤ 28 ms | ≤ 31 ms |
| Cari arama (seçici, 5 arama) | 184–204 ms | 45–57 ms | 199–234 ms | 51–62 ms |
| Cari listesi (300) | 197 ms | 188 ms | 197 ms | 210 ms |
| Cari ödeme (nakit) yazımı | 783 ms | 59 ms | 828 ms | 63 ms |
| Diğer yazımlar (tahsilat, fatura, fiş, transfer) | 11–34 ms | 11–34 ms | ≤ 46 ms | ≤ 52 ms |

İş parçacığına giden raporlarda süre olay döngüsünü tutmaz; küçük raporda iş parçacığı açılışı ~120 ms ekler (kart 3 → 128 ms).

## 2. Yük 1 / 10 / 20 kullanıcı (sunucu + 3 gerçek Chromium penceresi, 180 sn, yedekleme sırasında, flock)

Komut: `KANIT_DIR=docs/kanit/2026-10-11/olcek-sonra flock /tmp/destekofis-olcum.lock node tools/kanit.mjs kos olcek-210-yuk-sonra -- node tools/olcek-210.mjs --asama yuk --klasor <olcek klasörü> --kullanici 1,10,20 --sure 180 --pencere 3 --json docs/kanit/2026-10-11/olcek-sonra/olcek-210-sonuc.json`
— **GEÇTİ, çıkış 0, 87/87 denetim** (commit c5079a9). Ham: `olcek-sonra/olcek-210-yuk-1-10-20.log`, `olcek-sonra/olcek-210-sonuc.json`,
kanıt kaydı `olcek-sonra/2026-10-11/olcek-210-yuk-sonra.{json,log}`. Tablo (ÖNCE = `olcek/olcek-210-alt-sonuc.json` 1 kişi + `olcek/olcek-210-sonuc.json`
10/20 kişi): `yuk-tablo.md` (`yuk-karsilastir.mjs`).

**Doğruluk: her düzeyde Mutabakat Testi 001 ve 002 TAMAM; bağımsız Kasa ve Banka (102, hesap hesap) farkı 0,00; izli kayıt = 200 dönen yazım;
yedekler bütün (integrity ok).**

| | 1 kişi ÖNCE → SONRA | 10 kişi ÖNCE → SONRA | 20 kişi ÖNCE → SONRA |
|---|---|---|---|
| İstek/sn | 0,2 → 0,7 | 1,4 → 5,1 | 1,7 → 6,7 |
| Banka Hareketleri listesi p95 | 4.513 → 492 ms | 12.063 → **953 ms** | 16.919 → 1.390 ms |
| Cari arama p95 | 4.488 → 359 ms | 10.829 → **1.121 ms** | 17.855 → 1.347 ms |
| Yazımlar p95 (tahsilat, ödeme, fatura, fiş, transfer) | 1.882–6.885 → 107–1.133 ms | 9.819–11.951 → 833–1.150 ms | 14.593–21.189 → 1.324–1.558 ms |
| Rapor açma p95 | 7.129 → 2.860 ms | 11.528 → 5.685 ms | 20.562 → 13.115 ms |
| Tüm istekler en çok | 7.129 → 3.005 ms | 21.749 → 7.622 ms | 87.234 → 15.668 ms |
| Olay döngüsü p99 / en çok | 2.502 / 6.157 → 261 / **1.374** ms | 8.452 / 10.234 → 863 / **1.296** ms | 12.952 / 16.131 → 1.070 / **1.429** ms |
| Ekran: Cari araması son tuş → sonuç p95 | 4.609 → 881 ms | 4.580 → 1.365 ms | 154 → 1.547 ms |
| Ekran: Banka Bakiye ön izleme p95 | 6.595 → 1.489 ms | 11.747 → 6.086 ms | 19.665 → 11.485 ms |

Hedef (10 kişide Banka Hareketleri listesi ve Cari arama p95 < 1 sn, olay döngüsü en çok < 1 sn): liste 953 ms KARŞILANDI; Cari arama 1.121 ms ve
olay döngüsü 1.296 ms KARŞILANMADI. Kullanıcı kararı (11.10.2026, koordinatör iletti): bu ölçüm müşteri portföyü için YETERLİ, ek hız işi yapılmaz;
aşağıdaki kalanlar BİLİNEN SINIR yazılır.

Not — önceki iki koşu (ikisi de saklı): `ilk-kosu-arac-hatasi-1-kullanici.{json,log}` (araç hatası 1, yarıda durduruldu) ve
`kosu2-olcek-210-*.{json,log}` (GEÇTİ 87/87; araç hatası 2 yüzünden Banka penceresi ilk turdan sonra kapalı kaldı, açık pencere yükü yoktu:
10 kişide liste p95 694, arama 717, olay döngüsü en çok 1.254 ms). Son koşuda Banka penceresi 21–28 tur açık kaldı (gerçek kullanım; açık
pencere her yazımda arka planda yenilenir) — sayılar bu yüzden kosu2'den bir miktar yüksek.

### Kalan darboğaz (profil: `olcek-sonra/olcek-210-profil-10.{json,log}`, `profil-10-kapsayici.txt`, `profil-10-en-uzun-cagrilar.txt`)

10 kişide ana iş parçacığı meşgul %68,9. En uzun TEK çağrılar (olay döngüsü en çoğunu belirleyen): **yedek alma (VACUUM INTO, ana iş
parçacığında) 846–853 ms** (otomatik ve "Şimdi Yedek Al — Tüm Şirketler"; yük dışı koşuda 0,77–1,33 sn — olay döngüsü en çoğu bununla
örtüşüyor), Mutabakat Testi 649 ms (aracın son denetimi), Banka Fişi kaydında K7 bakiye denetimi `refTotal` → `computeRefTotal` 507 ms (her
yazım saklı toplamı geçersizleştirir; boşta 120 ms, eski kodla aynı — gerileme değil), Cari penceresi listesi (GET /accounts, bütün carilerin
toplamı) 440 ms. Kapsayıcı paylar: Cari listesi %22, `refTotal` %15,6, `bank.post` %15,2. Rapor bekleyişi: iş parçacığı en çok 2 eşzamanlı
(4 çekirdekli makinede ana iş parçacığına yer kalsın) → 20 kişide rapor açma p95 13 sn (sıra), ana iş parçacığını tutmaz.

## 3. Eşdeğerlik testi (kâhin = dondurulmuş eski kod)

`test/banka-210-hiz-esdegerlik.test.mjs` + `test/fixtures/hiz-210-eski/{money-lines,report-center}.mjs` (2824f22'nin AYNI kodu, yalnız import
yolları). Veri: mutabakat motoru (motorNow, tohum 21 ve 22 × 300 işlem) + elle banka işlemleri (ücretli/BSMV'li transfer + ters kaydı, ücretsiz
transfer, Açılışı Düzelt, Devir Kapanışı, eski satır aktarması, kurumsal kart, kredi kullanımı/geri ödemesi, hesapsız eski satırlar, tarihi
gelmemiş hesapsız satırlar, pasif hesap). Son koşu (ad9ebc9 kodu): **16/16 test (eşdeğerlik 10 + iş parçacığı 6), her tohumda 670 rapor
karşılaştırması (111'i iş parçacığı yolu), 5.020 / 5.121 satır; moneyLines denetimi 493; cari arama 189; saat +15 gün: 559 rapor, 5.348 / 5.418
satır** — eski ile yeni birebir (başlıklar, satırlar, özet, TOPLAM; hata durum kodu ve metni). Raporlar: Banka Bakiye (5 grup), Banka Hareket
(her hesap + Hesabı Atanmamış × 3 hareket türü), Banka ve POS Hareketleri (3 yol), Kasa Hareketleri, Kasa Günlüğü, Alt Hesap Mizanı, Banka
Masraf (her hesap + olmayan hesap 404) × 13 dönem (Bu Yıl, Tüm Zamanlar, Bu Ay, Geçen Ay, Son 30 Gün, dönem başı = ilk hareket günü, ertesi gün,
tek gün, geçmiş, yalnız bitiş, boş 2020, gelecek, tanınmayan dönem). İş parçacığı testi `test/banka-210-rapor-is-parcacigi.test.mjs`: ön izleme
= yerinde (ilk 200 satır; toplam ve TOPLAM bütün satırlardan), Excel satırları + TOPLAM, PDF, hatalar (404/400 aynı metin), yetkisiz 403 iş
parçacığına ulaşmaz, yazımdan hemen sonra yeni satır, sahte saat 2027, kapanışta asılı kalmaz ve çalışan iş parçacığı kalmaz.

## 4. Mutasyon kanıtı (testin dişi; her mutasyon AYRI kopyada, commit'e girmez — ders 23)

`node docs/kanit/2026-10-11/hiz-duzeltme/mutasyon.mjs <kopya klasörü> --json mutasyon-sonuc.json` (flock). Ham: `mutasyon.log`, `mutasyon-sonuc.json`.

Son koşu (kod e1cde05 + bu commit'in araçları): **18/18 beklendiği gibi — M0 kontrol yeşil (16/16), 17 mutasyonun 17'si kırmızı**.

| Mutasyon | Çıkış | tests / pass / fail / iptal | Yakalayan |
|---|---|---|---|
| M0 kontrol (mutasyon yok; eşdeğerlik + iş parçacığı testi) | 0 | 16 / 16 / 0 / 0 | — (yeşil) |
| M1 sınıflama: açılış/Devir/aktarma düzeltme sayılmaz | 1 | 10 / 0 / 0 / 10 | veri üretimi (kanca) |
| M2 gider payının yönü ters | 1 | 10 / 1 / 4 / 5 | veri üretimi + Rapor Merkezi/moneyLines karşılaştırması |
| M3 gider payı alıcının bacağına da | 1 | 10 / 6 / 4 / 0 | moneyLines; saat ileri |
| M4 aynı gün başlayan hesapların devir sırası ters | 1 | 10 / 4 / 6 / 0 | Rapor Merkezi; moneyLines |
| M5 bugünkü hesapsız satır "tarihi gelmemiş" sayılır | 1 | 10 / 6 / 4 / 0 | Rapor Merkezi; moneyLines |
| M6 planlayıcı ipucunda yalnız ilk değer (cari 'out' düşer) | 1 | 10 / 0 / 0 / 10 | veri üretimi (kanca) |
| M7 kurumsal kart havale yöntemine eşlenir | 1 | 10 / 6 / 4 / 0 | moneyLines; saat ileri |
| M8 dönem başı günü de devre girer | 1 | 10 / 0 / 0 / 10 | veri üretimi (kanca) |
| M9 Banka Hareket dönem satırları bir gün sonradan | 1 | 10 / 0 / 0 / 10 | veri üretimi (kanca) |
| M10 Banka Bakiye: ileri tarihli grup bakiyeye eklenir | 1 | 10 / 6 / 4 / 0 | Rapor Merkezi; saat ileri |
| M10b Kasa eksi bakiye: gün sonu yerine bütün tarihler | 1 | 10 / 0 / 0 / 10 | veri üretimi (kanca) |
| M11 cari arama: tür önceliği yok | 1 | 10 / 8 / 2 / 0 | cari arama |
| M12 cari arama: Cari No yerine ad sırası | 1 | 10 / 8 / 2 / 0 | cari arama |
| M13 iş parçacığı: ön izleme sınırı TOPLAM'dan önce | 1 | 16 / 13 / 3 / 0 | Rapor Merkezi (iş parçacığı ön izleme); ön izleme JSON'u |
| M14 iş parçacığı: sunucunun sahte saati yerine gerçek saat | 1 | 16 / 2 / 4 / 10 | veri üretimi (kanca) + iş parçacığı testi |
| M15 iş parçacığı: hata durum kodu kaybolur (hep 500) | 1 | 16 / 13 / 3 / 0 | Rapor Merkezi (404); hatalar aynı durum koduyla |
| M16 Kasa eksi bakiye: yolun bakiyesi iki kez okunur | 1 | 27 / 26 / 1 / 0 | İ10 (inceleme-226-2) |

"Kanca" = hatayı veri üretimi sırasında mutabakat motorunun kendi banka raporu / bakiye denetimi buldu (testin `before` kancası düştü, alt testler
iptal = kırmızı; aracın sayacı iptali de kırmızı sayar). O altı mutasyonda (M1, M6, M8, M9, M10b, M14) eşdeğerlik karşılaştırmasının kendisi
koşmadı — yakalanma motorun denetimiyle. Ön deneme yarıda kaldı (M14'ün aranan metni iş parçacığı değişikliğinden sonra eskimişti; araç
"0 kez bulundu" ile durdu, M0–M13 o koşuda da beklendiği gibiydi); metin düzeltilip bütün koşu yinelendi.

## 5. Testler (gerçek çıkış kodu + sayılar; kanıt aracı)

| Koşu | Commit | Sonuç | Kayıt |
|---|---|---|---|
| npm test (1.) | c5079a9 | **BAŞARISIZ, çıkış 1, 2088/2089** — İ10 `inceleme-226-2.test.mjs:444` "düzeltmede Kasa özeti 0 kez hesaplandı" | `2026-10-11/npm-test-ilk-kosu-basarisiz.{json,log}` (json'daki ham_cikti adı npm-test.log idi; dosya yeniden adlandırıldı) |
| npm test (2.) | e1cde05 | **GEÇTİ, çıkış 0, 2089/2089**, 0 iptal, 0 atlanan (1.013 sn) | `2026-10-11/npm-test.{json,log}` |
| senaryo-banka-210 (arayüz) | e1cde05 | **GEÇTİ, çıkış 0, 407/407** | `2026-10-11/senaryo-banka-210.{json,log}` |
| senaryo-banka-210-temel (arayüz) | e1cde05 | **GEÇTİ, çıkış 0, 79/79** | `2026-10-11/senaryo-banka-210-temel.{json,log}` |
| ölçek yükü 1/10/20 | c5079a9 | **GEÇTİ, çıkış 0, 87/87** | `olcek-sonra/2026-10-11/olcek-210-yuk-sonra.{json,log}` |

İ10'un nedeni: eksi bakiye denetimi artık bütün yolların Kasa özetini (`AS cashAll`) değil, yalnız denetlenen yolun bakiyesini TEK sorguyla
(`wayBalance`: `AS allCents, AS atCents`) okuyor; testin sayacı yalnız eski sorguyu tanıyordu. Testin amacı (bakiye bir kez okunur) korundu;
sayaç iki sorguyu da sayar; mutasyon M16 (bakiye iki kez okunur) bu testi kırmızı yapar (tablo). DERS: ilk aşamada yalnız ilgili 322 test
koşulmuştu, tam paket bu sayaç bağımlılığını yakaladı.

## 6. Ekran hataları (yük ölçümü, son koşu) — tam metin ve kaynak

1 kişi (2): `banka süzgeç: page.waitForFunction: Timeout 30000ms exceeded. · {"secici":true,"pasif":false,"secenek":4,"satir":50,"hesap":"","yukleniyor":false,"sekme":"Hareketler"}`
ve aynı metin `"hesap":"bacc-a393fa08-8770-41f3-b4cc-c418a4e27840"` ile. 10 kişi (1): aynı metin `"hesap":"bacc-4aa335ba-6d70-45a3-9a6a-07cc83bd1e17"`.
20 kişi (1): aynı metin `"hesap":""`. (Banka penceresi turu 28 / 24 / 21; yeniden açılış 0.)

Anlamı: Banka → Hareketler'de hesap süzgeci seçildikten (`page.selectOption`) sonra 30 sn içinde listenin `data-account`'u seçilen hesaba
geçmedi; seçici, 4 seçenek ve 50 satır yerindeydi, yükleniyor yoktu. Ölçek aracı adımı: `tools/olcek-210.mjs` bankaLoop "Hesap süzgeci".

Kaynak: **BELİRLENEMEDİ (ürün mü araç mı kesin değil)**. Zorla yeniden üretme (ders 20): `ekran-suzgec-yaris.mjs` — aynı tur sırası (süzgeç →
Daha Fazla → Tüm Hesaplar → ekrandan + Masraf / başka oturumun masrafı), başka oturum 250 ms'de bir banka kaydı girerken (383 arka plan yazımı;
açık pencere en sık 1,5 sn'de bir baştan çizilir) ve kontrol olarak yazımsız: **40 + 40 turda 0 kez** üretildi (`ekran-suzgec-yaris.{log,json}`).
Yük koşusundan farkı: personel rolü (Muhasebe), iki şirket (`?hofCompany=`), sunucu yük altında (yanıtlar yüzlerce ms). İstemci kodu bu işte
DEĞİŞMEDİ; ÖNCE koşularında araç bu adıma ancak 1 tur gelebildiği için (araç hatası 2) görülemiyordu. Olası ürün nedeni (doğrulanmadı): açık
Banka penceresi her arka plan yenilemesinde bütün pencereyi baştan çizer (`hof-bank.js` reload → render, HOF.swap); kullanıcının o anda yaptığı
süzgeç seçimi bu çizimle yarışabilir. Düzeltme YAPILMADI; karar koordinatörde (önerim: yük aracında her süzgeç adımında /bank/movements
isteğinin gönderilip gönderilmediği ve yanıt sırası kaydedilerek yeniden koşmak).

Önceki iki "hata" ARAÇ hatasıydı (ürün değil, düzeltildi): (1) be429b6 — ekrandan kaydedilen masrafın izi alt dize aranıyordu ("…-E1",
"…-E11"in öneki): tek kayıt "5 kez (çift kayıt)" sayıldı, bağımsız deftere yazılmadı → Garanti −7,67 (E1'in tutarı 767 kuruş) ve izli banka olayı
33 ≠ 32; veri tabanında E1 TEK kayıttı. (2) c5079a9 — kayıttan sonra form kendiliğinden kapanınca aracın Escape'i Banka penceresini kapatıyordu;
sonraki turlar "seçici yok" ile düşüyordu (ÖNCE koşularında da aynı: 9 hata).

## DENENEN

Tek istek önce/sonra aynı veride (44 uç, çıktı özeti aynı); yük 1/10/20 kişi + 3 gerçek tarayıcı + yedekleme sırasında (doğruluk: mutabakat,
bağımsız fark 0, izli kayıt, yedek bütünlüğü); 10 kişi CPU profili; eşdeğerlik (2 tohum × 13 dönem × her süzgeç, saat ileri; iş parçacığı yolu);
mutasyon (bölüm 4); tam npm test (2 koşu, ilki kırmızı → nedeni → düzeltme → yeşil); senaryo-banka-210 ve -temel; ekran hatası zorla üretme
denemesi. Dersler: 2 (çıkış kodu + sayı, kanıt aracı), 4, 6 (uyuşmazlık önce hata — araç hatası 1 kök nedeniyle), 7, 15 (her ölçüm flock), 16,
20 (zorla üretme denemesi), 23 (eski kod `git archive` kopyasında).

## DENENMEYEN

1.000.000 satır ve 30 kullanıcı (planlı 16.10 ölçek testine); Windows (GitHub CI — bu dal push edilmedi; iş parçacığı + node:sqlite salt okunur
bağlantı gerçek Windows'ta koşmadı); diğer arayüz senaryoları (yalnız banka 210 ve 210-temel koşuldu); GitHub CI.

## BİLİNEN SINIRLAR

- Yedek alma (VACUUM INTO) ana iş parçacığında: 100.000 satırda tek yedek ~0,8–1,3 sn olay döngüsünü tutar (1M'de ~10 kat). Hız işinin kapsamı
  dışında; ayrı iş (yedeği salt okunur bağlantıyla iş parçacığında almak) önerilir.
- 10 kişide Cari arama p95 1,1 sn, olay döngüsü en çok 1,3 sn (hedef 1 sn); 20 kişide rapor bekleyişi p95 13 sn (iş parçacığı sırası, en çok 2).
- Açık Cari ve Banka pencereleri her yazımdan sonra (en sık 1,5 sn'de bir) yeniden yüklenir; Cari listesi bütün carilerin toplamını, Banka
  penceresi hesap bakiyelerini (`refTotal`, her yazımda geçersiz) yeniden hesaplar.
- Küçük banka raporunda iş parçacığı açılışı ~120 ms ekler. Banka ve POS Hareketleri ile Kasa Hareketleri (Muhasebe rolünde 403; yönetici açar)
  ve Alt Hesap Mizanı yerinde kalır: 100.000'de olay döngüsünü 3,2 / 1,1 / 0,25 sn tutar.
- Ekran hatası (bölüm 6): kaynak belirlenemedi.
