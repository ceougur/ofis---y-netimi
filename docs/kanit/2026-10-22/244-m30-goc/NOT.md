# 2.4.4 madde 30 — v2.4.3 → 2.4.4 göçü gerçek kodla, yedek tatbikatı, zincirleme göç ve arıza (ders 17)

Aday: `aday6` = e070d42 (dal is/m30-goc). Eski kod: git etiketi v2.4.3 (ve zincir için v2.3.0 / v2.0.26 fikstürü), ayrı kopyada
(`test/guvenilirlik/surumler.mjs` önbelleği, TMPDIR = not defteri `m30-goc/tmp`; ders 23, 25). Veri o sürümün GERÇEK koduyla, kendi API'sinden
girildi (`test/guvenilirlik/m30-uretici.mjs`); sahte EDM (`test/einvoice-mock.mjs`), sahte saat (ders 13), `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30).

## Nasıl bozulur? (işe başlamadan yazıldı; testler bu listeden)
1. Göç yarıda kesilir (süreç göç sırasında ölür: göç öncesi yedek yazılırken, v31 ile v32 arasında, v32 işleminin içinde) → yeniden açılınca
   yarım şema / yarım taban kalır, ya da göç ikinci kez koşup tabanı/numarayı değiştirir.
2. Aynı veri dosyasını iki sürüm açar: 2.4.4 göçünden sonra 2.4.3 yeniden açılır (geri dönüş) → eski sürüm yeni şemayı bozar ya da yeni sürüm
   eski sürümün yazdığını yanlış okur; sonra yeniden 2.4.4.
3. Eski (2.4.3) yedek yeni sürüme geri yüklenir → geri yüklemede göç koşmaz (v31 tablosu yok, v32 taban taraması yapılmaz) ya da yanlış şirkete gider.
4. 002 geri yüklenince 001 etkilenir (veri, numara tabanı, seçili şirket, yedek klasörü).
5. Göçten sonra numara yeniden verilir: 2.4.3'te "Müşteri Fişi Olarak Bırak"ılıp sonra gönderilen belgenin FIS numarası, kâğıt fatura/fiş
   serisinde, SMM'de; geri yüklemeden sonra (yedek → çalış → geri yükle → çalış) aynı numara ikinci kez.
6. Bakiye / mizan / Kasa / banka / çek durumları / taksit kartları göçle değişir (göç para tablosuna dokunur; okuma kuralı değişikliği yanlış yere taşar).
7. Belgeli karar dışında rapor toplamı değişir (Tablodaki Kişiler, Nakit Akışı, Vade Takip, Açık Faturalar, Cari Listesi, Kasa/Banka raporları).
8. e-Belge durumu / numarası / ETTN / iptal edilebilirliği değişir; Gönderilecekler listesi değişir; bırakılmış belge yeniden gönderilebilir hâle gelir.
9. Gece yarısı (ders 22): "bugün"e bağlı olgular (gecikme, vade, iptal süresi) önce/sonra farklı günde okunur → sahte fark. Önlem: önce ve sonra
   AYNI sahte günde, sabit saatle okunur; gerçek süreçli adımlarda gün değişirse koşu GEÇERSİZ.
10. Kilitli dönem: göç kapanmış dönemin satırına dokunursa kilit izi kayar.
11. Yetkiler: göç yeni yetkileri (Personel Özlük) yetkisiz kullanıcıya açar; özel rollü kullanıcının yetkileri değişir.
12. Disk dolu / kilitli dosya: göç öncesi yedek yazılamazsa göç yine koşar (yedeksiz göç) ya da yarım dosya bırakır.

## Yöntem ve yeniden koşma (araç commit'leri dbb5921 → a2f2134 → 4b88c8c, yalnız araç düzeltmeleri; tohum 7; TMPDIR = not defteri `m30-goc/tmp`)
```
K="node tools/kanit.mjs kos"; N="node --disable-warning=ExperimentalWarning"; R=<kök>
$K 244-m30-goc/uret-v243-buyuk      -- $N tools/m30-goc.mjs uret --kok $R --hacim buyuk --tohum 7      # v2.4.3 GERÇEK kodu, API'den
$N tools/m30-goc.mjs olcu --kok $R --surum v2.4.3 --veri taban --ad v2.4.3-taban                     # ÖNCE: 2.4.3'ün gösterdiği (kopyada)
$K 244-m30-goc/goc-v243-244-buyuk   -- $N tools/m30-goc.mjs goc --kok $R                            # 2.4.4 aynı klasörde (göç) + SONRA
$K 244-m30-goc/fark-v243-244-buyuk  -- $N tools/m30-goc.mjs fark --kok $R                           # fark + sınıflama
$K 244-m30-goc/tatbikat-buyuk       -- $N tools/m30-goc.mjs tatbikat --kok $R
$K 244-m30-goc/donus-buyuk          -- $N tools/m30-goc.mjs donus --kok $R
$K 244-m30-goc/kesinti-buyuk        -- $N tools/m30-goc.mjs kesinti --kok $R
$K 244-m30-goc/uret-v230-kucuk      -- $N tools/m30-goc.mjs uret --kok $R --surum v2.3.0 --hedef zb-taban --hacim kucuk --tohum 11
$K 244-m30-goc/zincir-v2026-fikstur -- $N tools/m30-goc.mjs zincir --kok $R --ad za --kaynak fikstur:surum-2.0.26-turler --yol v2.1.0,v2.2.0,v2.3.0,v2.4.3
$K 244-m30-goc/zincir-v230-uretilen -- $N tools/m30-goc.mjs zincir --kok $R --ad zb --kaynak zb-taban --yol v2.4.0,v2.4.1,v2.4.2,v2.4.3
$K 244-m30-goc/yeniden-uret-b1-b2   -- $N test/guvenilirlik/m30-yeniden-uret.mjs hepsi
```
Ağır adımlar `flock …/scratchpad/kos.lock` altında koştu. Önce ve sonra AYNI sabit sahte saatte (üretimin son günü 17:00) okundu (ders 13, 22); gerçek süreçli
kesinti denemeleri gerçek saatle, sonra yine sahte saatle ölçüldü. Bütün ölçümler verinin KOPYASINDA (taban dokunulmaz). İlk deneme koşuları (commit'siz araç,
14:59–15:37) bu kayıtların yerine geçmedi; araç hataları (silinmiş evrak, Tümünü Gönder gövdesi `{}` — 2.4.3 istemcisi `{ all: true }` gönderir) düzeltilip
bütün zincir commit'li araçla yeniden koşuldu. Kâhin değil, fark testi: beklenen = eski sürümün kendi gösterdiği; belgeli kararın KURALI eski verinin kendi
kayıtlarından denetlenir (ders 5 — 2.4.4 kodundan türetilmez). Ham olgular (2 × ~30 MB JSON) not defterinde; depoda fark/denetim çıktıları.

## Veri (v2.4.3 GERÇEK kodu 163dd5d, API'den; 6.128 istek, hepsi 200; 201 sn; sahte EDM: 517 gönderim, 14 iptal, sözleşme ihlali 0)
Çizelge 22.09.2025 → 22.10.2026 (13 ay, iş günleri, sahte saat). 7. aydan sonra e-Belge; 10. ayda 001'de dönem kilidi (22.04.2026'ya kadar).

| | 001 Merkez Ticaret ve Danışmanlık A.Ş. | 002 Yıldız Mali Müşavirlik ve Danışmanlık Ltd. Şti. |
|---|---|---|
| Cari | 3.211 (3.000 Excel'den, %2 aynı ad soyad; 60 e-Belge'ye hazır kişi; e-Fatura mükellefi; 12 tedarikçi; 25 kayda bağlı) | 926 |
| Tablo (Excel) | 10.040 satır, 3 sekme (Borçlular 9.200 · aynı dosya no'lu Ödeme Sözleri 600 · aylık Taksitler 240) | 1.710 satır |
| Fatura | 1.220: satış 818, alış 254, SMM 106 (kâğıt), satıştan iade 32, alıştan iade 10; kâğıt 844, e-Arşiv 308, e-Fatura 68; e-Belge durumu gönderildi 358, Müşteri Fişi Olarak Bırakıldı 36, iptal 11, bekleyen 7; iptal edilmiş belge 21 | 621: satış 374, alış 106, SMM 114, iade 27; kâğıt 469, e-Arşiv 126, e-Fatura 26 |
| Çek / senet | 413: portföy 33, tahsil 151, ciro 91, ödendi 54, karşılıksız 84 | 159: tahsil 54, ciro 44, karşılıksız 28 |
| (iki şirket, işlem) | Bankaya Tahsile Ver 157 → bankadan tahsil 139; nakit tahsil 66; ciro 107 + faturayla ciro 48; karşılıksız: faturanın kendi evrakı 34, bağsız 40, tahsildeyken 18, cirodan 20; verilen evrak 73 → ödendi 72 | |
| Taksit / Kasa / banka | 225 taksit kartı (carisinden açılan + Tablodan Aktar; iki şirkette 143 kart Tablodan Aktar, 39 kayıt tahsilatı karta taşındı); Kasa 2.045 satır; 2 banka hesabı + Ziraat POS; aylık Banka Fişi ve bankalar arası transfer | 101 kart; Kasa 886 satır |
| Diğer | 162 kayıt tahsilatı, 40 stok kartı, 13 KDV Mahsup Fişi + KDV ödemesi (banka) + Muhtasar (Kasa), özel rollü 3 kullanıcı, 5 yedek (o sürümün Yedekle ucu) | aynı düzen |
| Veri dosyası | 19,9 MB | 8,0 MB |

## Göç (2.4.4 adayı aynı klasörde açılır — güncelleyicinin yaptığı gibi; kayıt goc-v243-244-buyuk)
- 001 açılışta: göç öncesi yedek ~97 ms (VACUUM INTO, 19,9 MB) + v31 4 ms + v32 6 ms; açılış toplamı 681 ms (2.4.3'ün aynı veride açılışı 767 ms).
- 002 ilk erişimde: göç öncesi yedek ~52 ms + v31 3 ms + v32 3 ms; ilk istek 224 ms. Göç günlüğü (INFO) kanıt kaydının ham çıktısında.
- Her şirket: şema 30 → 32, `PRAGMA integrity_check` ok, şirket klasöründe bir `…-pre-migration-v32.sqlite`. Numara tabanı: 001 FIS2026 sıra 253, 002 sıra 125.
- Eski veride 2.4.3 hatasının izi: 001'de 16, 002'de 6 fiş numarası İKİ belgede (bırakılıp gönderilen belgenin Kâğıt Fatura No'su + sonra seride aynı numarayı
  alan belge). v32 geçmişi düzeltmez (belgeli: yalnız bundan sonra yeniden verilmesini önler).

## Önce (v2.4.3) / sonra (2.4.4) — 91 olgu: EŞİT 57 · BELGELİ 30 · BULGU 4 (hepsi B1) — `fark-v243-244-buyuk.json`, tam döküm `fark-v2.4.3-taban-guncel-goc.json`
EŞİT (iki şirkette, tek tek): her carinin bakiyesi (001: 3.211 cari, Σ 11.442.909,96 TL; 002: 926), mizanın her hesabı (borç = alacak, fark 0), defter
mutabakatı (16 denetim), Mutabakat Testi (0 sapma, 87 denetim tamam, yeni sapma yok), dönem kilidi (001: 22.04.2026) aynı, Kasa (toplam, yol başına, 2.045 / 886
satırın özeti), her banka hesabı ve Banka özeti, her çek/senet (durum, tutar, cari, fatura), her taksit kartı ve toplamları, stok, KDV Mahsup Fişleri, tablo,
şüpheli alacaklar, Gönderilecekler listesi, faturaların türü/durumu/numarası/ETTN/tarihi/carisi/profili/e-Belge durumu/tutarı (1.220 + 621), seri adları, sıradaki
numaralar (paper, earsiv, efatura, smm, internal — eski veride VERİLMİŞ en büyükten bir sonraki), rapor merkezinin öbür 57 raporu (satır, TOPLAM, özet), şirket
listesi, roller, ayşe/mehmet/zeynep yetkileri.

| Olgu | 001 | 002 | Sınıf — karar |
|---|---|---|---|
| Faturaların ödeme durumu (ödenen/açık) | 72 fatura, 57 cari, +604.696,89 TL açık (sale 56, alış 14, SMM 2; Ödendi→Açık 13) | 25 fatura, 19 cari, +212.674,17 TL | BELGELİ K-UX18/F2/F3 — kural tuttu: değişen her fatura taksitsiz, carisinde eski veride karşılıksız evrak var, cari Σ açık artışı ≤ karşılıksız toplamı, ödenen + açık = ödenecek, Σ açık ≤ \|bakiye\|; cari bakiye ve mizan DEĞİŞMEDİ |
| ANLIK DURUM açık fatura | satış 6.482.295,68 → 7.032.569,44; alış 1.183.531,79 → 1.237.954,92 | satış 4.137.931,25 → 4.336.605,42 | BELGELİ K-UX18 — fark = faturaların farkı (kuruşu kuruşuna) |
| Açık Faturalar / Satış / Alış Faturaları / Alacak Yaşlandırma | satır 782 → 795; Kalan farkı = faturaların farkı; yaşlandırmada carinin Toplam'ı aynı, Faturasız Alacak −550.273,76 | aynı kural | BELGELİ K-UX18 |
| e-Belge kartı İptal Et | 277 e-Arşiv'de kapandı ("iptal süresi doldu"), süre içindeki 2'si açık | 113 kapandı, 2 açık | BELGELİ K-23 — iletim günü 2.4.3'ün işlem geçmişinden (invoice.e.sent); son gün = iletim + 8; geçen ⇔ kapalı |
| Sıradaki numara · e-SMM | yeni ESM2026000000001 | aynı | BELGELİ K-24 (e-SMM açık) |
| Kayıt Kartından Tahsilatlar | rapor adı "Kayıt Tahsilatları" | aynı | BELGELİ K-5 metin |
| Tablodaki Kişiler (kayıt başına borç/alacak) | 834 kayıt: iki sekmede aynı anahtar 579, ilk sekme dışı 240, kayda bağlı cari 131, kart 114; aynı ad + farklı telefon artık ayrı kişi (grup 1.200 → 9.914) | 202 kayıt | BELGELİ K-5 / K-31a F1-F4-F5 / K-5c |
| Tahsilat Takvimi (vadeli fatura kalemi) | 72 kalem | 25 kalem | BELGELİ K-UX18 (fatura yeniden açıldı) |
| Vade Takip / Takvim (kayda bağlı cari, iki sekme) | 0 | Vade Takip 3, Takvim 3 kayıt | BELGELİ K-5 / K-5c |
| Nakit Akışı | Beklenen 58.727.000 → 53.134.000 TL (−5.593.000; B1 payı −5.593.000); Gerçekleşen 245.900 → 358.663,40; Kasa giriş/çıkış/net aynı | Beklenen 10.163.300 → 9.317.854,25 (B1 −830.900, K-5 −14.545,75); Gerçekleşen 91.300 → 121.755,27 | BELGELİ K-5/F5 (Gerçekleşen) + B1 (Beklenen) — sınıflayıcı toplamı belgeli saydı, B1 payı Vade Takip satırında BULGU |
| **Vade Takip — söz tutarı Toplam Borç → Kalan Borç** | **1.101 kayıt, 22.289.700 → 16.696.700 TL** | **167 kayıt, 3.385.700 → 2.554.800 TL** | **BULGU B1** |
| **Tahsilat Takvimi / ödeme sözü — aynı** | **965 kayıt, 19.634.400 → 14.700.500 TL** | **143 kayıt, 2.891.300 → 2.156.200 TL** | **BULGU B1** |
| Yöneticinin yetkileri | + staff.view, staff.manage (öbür kullanıcılara açılmadı) | — | BELGELİ K-19 |
| Veri dosyası | şema 30 → 32, staff_members (boş), ayar +2 (invoice.numberFloor, client.gettingStarted.baseline) | aynı | BELGELİ göç v31/v32, K-16 |
(Önce/sonra okuma ANLIK DURUM'un öbür kutuları, banka/POS ve rapor merkezinin bütün raporlarını da kapsar — fark yok.)

## BULGU
### B1 — Tahsilat Takvimi / Vade Takip / Nakit Akışı "Beklenen": söz kaleminin tutarı Toplam Borç yerine Kalan Borç (belgesiz yan etki)
- Ne: tabloda hem "Toplam Borç" hem "Kalan Borç" kolonu olan kayıtların ödeme sözü / vade kalemi 2.4.3'te Toplam Borç'tan, 2.4.4'te Kalan Borç'tan hesaplanıyor
  (programda girilen kayıt tahsilatı iki sürümde de düşülür). Zil, Ödeme Sözü şeridi, Tahsilat Takvimi, Vade Takip ve Nakit Akışı "Beklenen" aynı kaynaktan.
- Kök neden: 7d51d60 (madde 5b) `server/lib/insight/dues.mjs:183` borç kolonu seçimi — `AMOUNT_REMAINING` ("kalan|bakiye") önce; önceden ilk eşleşen
  (`AMOUNT_DEBT`, "Toplam Borç"). Amaç "önce cari açın" formunun Açılış Bakiyesi'ydi; takvim tutarları aynı `context.debt`i kullandığı için değişti.
- Neden belgesiz: iş listesi 5b ve CLAUDE.md kararı yalnız Açılış Bakiyesi'nden söz eder; madde 5 teslim notundaki takvim değişikliği (kayda bağlı carinin
  tahsilatı) başka bir kuraldır. Sürüm notunda yok.
- Ek tutarsızlık (2.4.4 içinde): Tablodaki Kişiler borcu hâlâ Toplam Borç'tan (`server/lib/reports.mjs:64` DEBT_HEADER, ilk eşleşen) → aynı kayıt (2026/01369:
  Toplam 39.000, Ödenen 10.500, Kalan 28.500) Tablodaki Kişiler'de 39.000, Tahsilat Takvimi'nde 28.500. 2.4.3'te ikisi de 39.000'di.
- Yön: Kalan Borç büyük olasılıkla doğru beklenen tahsilattır (tablodaki Ödenen düşülmüş) — ama karar kullanıcıda. Öneri: (a) davranışı kalıcı karar yap +
  sürüm notuna cümle + Tablodaki Kişiler'i de aynı kurala al, ya da (b) takvimde eski kolonu koru.
- En kısa yeniden üretme (`yeniden-uret-b1-b2`): tek satırlık tablo [Dosya No, Ad Soyad, Telefon, Toplam Borç 11500, Ödenen 3900, Kalan Borç 7600, Ödeme Sözü
  bugün+5] → `/api/workspace/dues` söz tutarı v2.4.3 (163dd5d) 11.500, 2.4.4 adayı 7.600 (`debtColumn: "Kalan Borç"`); Vade Takip ve Nakit Akışı Beklenen aynı.

## Göçten sonra çalışma + yedek tatbikatı (`tatbikat-buyuk`: 28/28) — programın kendi Yedekle / Geri Yükle uçları
- C3: 2.4.3'ten kalan bekleyen e-Belge'ler (001: 3, 002: 2) 2.4.4'ten Tümünü Gönder ({ all: true }, imleçli tur) ile gitti; numara sırası = tarih sırası.
- C1: e-Arşiv Kes, Sonra Gönder → Müşteri Fişi Olarak Bırak → gönder → ikinci bırakma: 001 FIS2026000000254 / 255, 002 …130 / 131 = 1 + eski veride VERİLMİŞ
  en büyük (253 / 129); gönderilen belgenin fişi Kâğıt Fatura No'da. C2: e-SMM Kes, Sonra Gönder → Kâğıt Makbuz Olarak Bırak → SMM2026000000074 / …090 (1 + verilmiş
  en büyük). C4: 2.4.4'te verilen hiçbir fiş/SMM numarası eski veride verilmiş biriyle aynı değil.
- C3: e-Arşiv Kes ve Gönder (TEA…), e-SMM Kes ve Gönder (ESMM, TES…, sahte ESmmEDM), e-Fatura (TEF…) gönderildi; EDM ihlali 0.
- C5: Kapatılacak Fatura'lı 100 TL tahsilat UX18 ile yeniden açılmış faturanın açığını tam 100 TL azalttı; Kasa, personel kartı; Mutabakat Testi'nde yeni sapma yok,
  mizan dengede.
- C6: 002 yedek → ara çalışma (e-Arşiv gönder, bırak, Kasa) → geri yükle (hemen) → olgular yedek anıyla aynı; 001 aynısı (geri yükleme yeniden açılışta uygulandı).
  C7: bir şirketin geri yüklenmesi öbürünün olgularını değiştirmedi (İşlem Geçmişi ortak katmandadır: geri yükleme kaydı +1 — karşılaştırma dışı, beklenen).
- C8: geri yüklemeden sonra numaralar yedek anının sırasından sürer, veride tekrar yok (001 FIS…256, 002 FIS…132). GÖZLEM → B2 (aşağıda).
- C9: 2.4.3'ün kendi Yedekle ucuyla aldığı son yedek (`destekofis-00x-…-manuel.sqlite`) 2.4.4'e geri yüklendi: göç geri yüklemede koştu (şema 32, staff_members,
  numara tabanı göçtekiyle aynı) ve olgular göç ölçüsüyle (aynı veri, göç açılışta) birebir aynı; 002'yi geri yüklemek 001'i, 001'i geri yüklemek 002'yi değiştirmedi.

### B2 (GÖZLEM / BİLİNEN SINIR — gerileme değil) — geri yüklemeden sonra yedekten sonra verilmiş e-Belge ve fiş numarası yeniden verilir
- Yedek → e-Arşiv gönder (TEA…910, EDM'de) + Müşteri Fişi Olarak Bırak (FIS…256) → geri yükle → yeniden kes: aynı TEA…910 verilir, EDM 11048 ile reddeder (belge
  "Hata", ileti İptal Et + yeniden kes der; test serisinde ileti "test hesabı ortaktır, başka firma" diye yönlendirir — geri yükleme nedenini söylemez); aynı FIS…256
  yeni fişe verilir. v2.4.3'te de birebir aynı (`yeniden-uret-b1-b2` B2: iki sürümde de) → gerileme değil. Numara tabanı (v32 / invoice.numberFloor) veri dosyasında
  durduğu için geri yüklenen yedekle birlikte geri gider. Karar önerisi (kullanıcı): geri yüklemeden sonra "yedekten sonra kesilmiş belge numaraları yeniden
  verilebilir" uyarısı / EDM'den son numarayı sorma; ya da BİLİNEN SINIR olarak kılavuza.

## Aynı dosyayı iki sürüm açar (`donus-buyuk`: 6/6)
Göçten sonra v2.4.3 yeniden açıldı: iki şirkette de gösterdiği göçten önce gösterdiğiyle birebir (2.4.4'ün eklediği tablo/ayar 2.4.3'ü bozmaz), şemayı geri almaz
(32 kalır); ardından yeniden 2.4.4: göç ölçüsüyle birebir. (BİLİNEN SINIR: geri dönülen 2.4.3 numara tabanını okumaz — 2.4.3 davranışı.)

## Göç sırasında kesinti ve arıza (`kesinti-buyuk`; taban verisinin kopyasında, her denemeden sonra 2.4.4 yeniden açılıp İKİ şirketin olguları göç ölçüsüyle karşılaştırıldı)
Zorla (ders 20; `test/guvenilirlik/m30-goc-kesinti.mjs`, 2.4.4'ün gerçek `runMigrations`'ı ayrı süreçte, 001'in dosyasında):
| Nokta | Ölen sürecin bıraktığı | Yeniden açılış |
|---|---|---|
| göç öncesi yedek yazıldı, adı değişmeden (SIGKILL) | şema 30, bütünlük ok; yarım yedek `…pre-migration-v32.sqlite.yaziliyor` (geçerli yedek sayılmaz) | göç tamam, yeni yedek, olgular aynı |
| v31 işleminin içinde (SIGKILL) | şema 30 (işlem geri alındı), göç öncesi yedek tamam (şema 30) | göç tamam, olgular aynı |
| v31 ile v32 arasında (SIGKILL) | şema 31, numara tabanı yok | v32 koştu, taban göçtekiyle aynı, olgular aynı |
| v32 işleminin içinde, taban yazıldıktan sonra (SIGKILL) | şema 31, numara tabanı YOK (işlem geri alındı) | v32 bir kez koştu, taban aynı, olgular aynı |
| disk dolu (VACUUM INTO yarım yazıp "database or disk is full") | göç YAPILMADI (şema 30), yarım yedek silindi, hata bildirildi | yer açılınca göç tamam, olgular aynı |
Gerçek süreç (2.4.4 `server/server.mjs`, üretim girişi, açılıştan d ms sonra kendi pid'imize SIGKILL): 60/120/200/300 ms göç başlamadan; 450 ms göç öncesi
yedek YAZILIRKEN (`.yaziliyor` + `-journal` kaldı, şema 30); 700/1.000/1.500 ms göç bitmişti — her durumda dosya tutarlı, yeniden açılışta şema 32 ve iki şirketin
olguları göç ölçüsüyle aynı. Kilitli dosya: başka süreç 001'in dosyasında 15 sn yazma kilidi (BEGIN EXCLUSIVE) tutarken 2.4.4 ~10 sn bekleyip "database is
locked" ile AÇILMADI, dosya şema 30 (yarım göç yok); kilit kalkınca açılış göçü tamamladı, olgular aynı.
(Kayıt `kesinti-buyuk`: 79/79, commit 4b88c8c. İlk koşu aynı 79/79'u verdi ama "kilitli dosya" denemesinde açılamayan sürümün sahte EDM'si kapanmadığı için süreç
çıkmadı — araç hatası, 4b88c8c ile düzeltilip yeniden koşuldu; ürün kodu değişmedi.)

## Zincirleme göç (adım adım ara sürümlerle ↔ doğrudan 2.4.4; yol bağımsızlığı)
- `zincir-v2026-fikstur` (165/165): depodaki `test/fixtures/surum-2.0.26-turler` (GERÇEK v2.0.16 → … → v2.0.26 koduyla üretilmiş; 4 şirket 001/002/007/004 —
  2 şirket sınırından eski kurulum, hepsi açıldı) → v2.1.0 (şema 20) → v2.2.0 (22) → v2.3.0 (26) → v2.4.3 (30) → 2.4.4 (32). 2.4.3'ün gösterdiği → 2.4.4:
  157 olgu, EŞİT 140, BELGELİ 17 (K-24 e-SMM numarası, K-5 rapor adı, şema/ayar), BULGU 0. Aynı veri DOĞRUDAN 2.0.26 → 2.4.4: dört şirketin olguları adım adım
  güncellenenle birebir.
- `zincir-v230-uretilen` (90/94): v2.3.0'ın GERÇEK koduyla üretilen veri (`uret-v230-kucuk`: 2.611 istek; e-Belge ve vergi o sürümde yok) → v2.4.0 → v2.4.1 →
  v2.4.2 (27) → v2.4.3 (30) → 2.4.4 (32). 90 olgu: EŞİT 59, BELGELİ 27 (K-UX18, K-5, K-31a, K-24, şema), BULGU 4 = yalnız B1 (Vade Takip 43 + 17 kayıt, Takvim 38 + 15
  kayıt). Doğrudan v2.3.0 → 2.4.4 = adım adım: iki şirkette birebir.

## Kanıt kayıtları (bu klasör; `tools/kanit.mjs kos`)
| Kayıt | Hüküm | Commit |
|---|---|---|
| kaynak-taramalari | GEÇTİ 66/66 | 4b88c8c |
| uret-v243-buyuk | GEÇTİ 6.129/6.129 (6.128 API isteği 200 + EDM ihlali 0) | dbb5921 |
| goc-v243-244-buyuk | GEÇTİ 2/2 (iki şirket şema 32 + göç öncesi yedek) | dbb5921 |
| fark-v243-244-buyuk | BAŞARISIZ 87/91 — 4 BULGU = B1 (beklenen; bulgu kaydı) | a2f2134 |
| tatbikat-buyuk | GEÇTİ 28/28 | a2f2134 |
| donus-buyuk | GEÇTİ 6/6 | a2f2134 |
| kesinti-buyuk | GEÇTİ 79/79 | 4b88c8c |
| uret-v230-kucuk | GEÇTİ 2.612/2.612 | 4b88c8c |
| zincir-v2026-fikstur | GEÇTİ 165/165 | 4b88c8c |
| zincir-v230-uretilen | BAŞARISIZ 90/94 — 4 BULGU = B1 | 4b88c8c |
| yeniden-uret-b1-b2 | GEÇTİ 2/2 (B1 ve B2 eski/yeni kodla yeniden üretildi) | 4b88c8c |
`cikti/`: fark dökümleri (`fark-*.json`, okunur tablo `fark-tablo.md`), `tatbikat.json`, `donus.json`, `kesinti.json`, `za.json`, `zb.json`, üretim manifestleri.
Ham olgular depoda değil (not defteri `m30-goc/buyuk2/cikti/`): `v2.4.3-taban.json` sha256 ce3f4e888c4977a7e244f02dc186f40bf9725c2daebcba892d3462b03b6ef953,
`guncel-goc.json` sha256 3359c57a4d9d8bf83dab530547b52b71a0ca3d49c0edf482dc5e06e8b9c325fc (aynı komut + tohumla yeniden üretilir). Veri kopyaları (sqlite) silindi (ders 24).

## DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
DENENEN (ders): 17 (eski sürümlerin GERÇEK verisi, durumlu işler: yedek/geri yükleme/geri dönüş/zincir), 23 + 25 (eski kod `git archive` önbelleği benzersiz
not defteri klasöründe; çalışma ağacına eski dosya girmedi), 13 + 22 (sahte saat; önce/sonra aynı sabit an; gerçek süreç denemesinden sonra sahte saatle ölçüm),
30 (her açılışta HUKUK_LICENSE_URL=http://127.0.0.1:9; kaynak taramaları `kaynak-taramalari` 66/66: lisans-servisi-izolasyonu, platform-tasinabilirlik, kanit-araci, drive-kaldirildi), 20 (kesinti ön koşulu zorla; gerçek süreçte "yedek yazılırken"
ön koşulunun GERÇEKTEN oluştuğu deneme kayıtta), 3 (her istek 200 + veri tabanı/rapor okuması), 5 (beklenen = eski sürümün kendi sayısı + kararın metni; 2.4.4
kodundan türetilmedi), 6 (B1/B2 en kısa yeniden üretme, v2.4.3 ile karşılaştırma, kök neden), 24 (disk ≥ 19 GB; sqlite kopyaları silindi), 36 (yalnız kendi
pid'lerim), 33/27 (Windows SIGKILL kolu, fileURLToPath; dosya adlarında yasak karakter yok). Test kuralı: aynı adlı iki kişi (cari %2, tabloda isim tekrarı yüksek),
Kapatılacak Fatura'lı / bağsız / faturanın kendi evrakı, 002 ayrı, yetkili/yetkisiz kullanıcı yetkileri, geçmiş + bugün tarihli kayıt.
DENENMEYEN: arayüzden (ekran) göç sonrası gezinti — yalnız API (ders 8 kapsamı madde 30'un e2e kısmında, başka ajan); güncelleyicinin kendisi (indir → doğrula →
kur → servis yeniden başlat) — 2.4.4 yalnız aynı veri klasöründe açıldı; gerçek Windows; şüpheli alacak, döviz, POS iadesi/iptali, kurumsal kredi kartı, gelen
e-Fatura kutusu, e-SMM'nin 2.4.0'dan kalan numaralı ESMM makbuzu (kullanıcı kararı: yok), cari silme + aynı adla yeniden açma, eşzamanlı iki kullanıcı göç anında,
3+ şirketli kurulumda yeni şirket açma; disk dolu yalnız göç öncesi yedekte (göç işleminin kendisinde değil); "kilitli dosya"da programın kullanıcıya gösterdiği
ileti ve servis yöneticisinin yeniden başlatması (yalnız açılışın "database is locked" ile düştüğü görüldü); hacim 1 tohum (7) — ölçek/uzun koşular madde 33'te.
Kilit izi (lockDigestOf) ayrıca hesaplanmadı — kilitli dönemin tek tek olguları (cari, Kasa, mizan, fatura, çek) aynı olduğundan dolaylı.
BİLİNEN SINIRLAR: (1) B2 — geri yüklemeden sonra yedekten sonra verilmiş e-Belge ve fiş numarası yeniden verilir (EDM 11048; 2.4.3'te de). (2) yarım kalan göç öncesi
yedek `.yaziliyor` (ve `-journal`) dosyası yedek klasöründe bir saat kalır, sonraki yedekte silinir (tasarım). (3) Eski veride iki belgeye verilmiş 16 + 6 fiş numarası
göçle düzelmez (v32 yalnız yeniden vermeyi önler). (4) 2.4.3'e geri dönülürse 2.4.3 numara tabanını okumaz. (5) Tatbikat karşılaştırması İşlem Geçmişi'ni (ortak katman)
dışarıda tutar; yedek/geri yükleme kendi kaydını yazar (göç farkında İşlem Geçmişi raporu da aynı çıktı). (6) Sınıflayıcı kararın kuralını eski veriden denetler; kuralın kendisinin doğruluğu (K-UX18,
K-23, K-5…) madde 31'in bağımsız kâhinindedir.
