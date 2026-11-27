# TEK DAR KONTROL RAPORU (2.5.0 — 85f70cda, be634617, a2cab6c3, 8a93bcac, 6a1d19d1; incelenen uç 6a1d19d1)

Çalışma ağacı `6a1d19d1`'e sıfırlandı (`git log --oneline -1` doğrulandı). Kod değiştirmedim, commit yapmadım. Ağaçta yalnız izlenmeyen `node_modules` bağı var. Her koşu `flock -s` altında yapıldı; yük hep 1'in altındaydı, disk sonunda 6,3 GB boştu. Eski kodun kopyaları (`8a93bcac^1`, `85f70cda^1`, `v2.4.9`) sırayla tek tek açıldı ve işi bitince tam yoluyla silindi.

## GERİLEMELER
**YOK.**
- **Büyük veri:** temiz-100k'nın taze kopyası, iki saat dilimi (UTC ve Europe/Istanbul), `85f70cda^1` ile `6a1d19d1` karşılaştırıldı (dok.mjs + karsi.py). Şirket 001'de 34.026 fatura var.
  - Fark yalnız Mevcut Borç kartının bir kısmını aldığı 424 faturada çıktı. Bunların hepsi kartlı caride ve 424'ünde de `ownOpen` eski `open` ile aynı.
  - Kartsız caride fatura farkı 0.
  - 1.484 cari (bakiye, gecikmiş, adet, planRemaining) ve 11.448 kartta fark 0.
  - Alacak Yaşlandırma, Vade Takip, Nakit Akışı ve zil birebir aynı.
  - Açık Faturalar ile Anlık Durum'daki openSale / overdueSale farkı S229 / S230'dan geliyor: 52.466.649,34 → 50.360.217,34.
  - Yeni kodda UTC ile İstanbul arasındaki tek fark zaman damgaları.
- Şirket 002 seçilemedi, dökümü yok (DENENMEYEN'de).

## İLK MADDELER

**1. Kapı (K9) — kapi-sp.mjs, `8a93bcac^1` ↔ yeni, üretim ve test kipi.**
Denenen senaryolar:
- G1: savepoint'te geri alınmış INSERT'ün rowid'i, sonra UPDATE SET id (Kasa, açık dönem).
- G2: aynısı, kilitli dönemde.
- G3 / G3b: aynısı stok hareketinde, açık dönemde (G3b'de miktar da +1).
- G4: aynısı stok hareketinde, kilitli dönemde.
- G5: aynı işlemde doğan satırın rowid'inin yeniden kullanılması.

Sonuçlar iki kodda ve iki kipte aynı:
- G1 kabul, tarama bank:event.
- G2 409 period-lock.
- G3 / G3b 409 invoice:stock.
- G4 409 invoice:stock,period-lock.
- G5 kabul, tarama bank:event.

Eşdeğerlik ihlali yok. Tek fark kapının yolunun nedeni: yeni kodda "bulgu: bank:event", eski kodda "kimlik değişti". Savepoint geri alınınca `capture.inserted` temizlenmiyor; bu yüzden bölme tetikleniyor ama karar yine aynı çıkıyor.

**2. `open` alanını okuyan yollar — hepsi gösterim. Sınır ve kapama kendi açıktan okunuyor.**

Sunucu:
- `server/routes/invoices.mjs:975` (shape) ve `:1400` (leanRow): liste, süzgeç (`:1485`), toplamlar (`:1502–1513`), PDF / Excel (`:5172`, `:5198`) — gösterim.
- `:3933–3944` Mahsup adayları: `open` kendi açık (SINIR), `shownOpen` / `suggest` gösterim. Sınır denetimi `:3959–3961` kendi açıkla yapılıyor.
- `:5443` openItems: net kalan değişmedi; net istemeyen yol (Açık Faturalar `report-center.mjs:2303`, Anlık Durum `overview.mjs:206`) gösterilen açığı okuyor. `:5464` dueItems net.
- Yazma yolları (`:2168`, `:2186`, `:2279` — coverState / ownTarget) ham `state.open` okuyor.
- `report-center.mjs:2932` satış / alış fatura raporundaki Kalan gösterim.

İstemci:
- `client/assets/hof-invoices.js`: `:353`, `:2673–2675`, `:2684` (Mahsup Et düğmesi), `:2691`, `:2705`, `:2842` (Tahsilat Ekle düğmesi), `:2861–2883`, `:2905–2916`, `:3029`, `:3047`, `:4075` — hepsi gösterim ya da öneri.
- `client/assets/hof-accounts.js`: `:424` ve `:1014–1015` (Kapatılacak Fatura seçenekleri; K3 kabulü).

Mobil özet ile fatura PDF / UBL `open` okumuyor.

Betikle (SC5): F 900, karta giren 600.
- Fatura kartı: açık 300 · kendi 900 · inPlan 600. Mahsup sınırı 900, önerisi 300.
- Faturadan 300 / 900 / 1.200 tahsilatın üçü de iki kodda kabul ediliyor; bakiye ve kapama iki kodda aynı (veri tabanından okundu).

**3. Kart kapsamı tek yardımcıda.** Kuyruk ile kapama defteri her senaryoda aynı faturayı seçiyor.
- SC1 (A 600 01.09 / B 600 02.09 / elle kart 600 03.09): kart A'yı alıyor (A 'Taksitte', kapsam{K:600}).
  - B'ye iade kartı değiştirmiyor; A'ya iade kartı 300'e küçültüyor (11-05:100, 12-05:200).
  - A'nın iptali kartı kapatıyor.
  - Pencere = cari özeti = Taksitler = kendi hesap.
  - Eski kod B'yi alıyordu; bu K7 (2) ile beklenen düzeltme.
- SC2 (vade farkı: A'nın vadesi 30.09, B'nin 05.09): kart B'yi alıyor. Bu, kuyruğun s2 sırası (önce vade) ile tutarlı.
- SC8 (aynı caride iki kart): F1 iadesi K1'i kesiyor. Gecikmiş 0 doğru; eski kodda 300 (yanlış) idi.

**4. Küçülme / büyüme sıraları** — her adımda pencere = cari = liste = kendi hesap, Mutabakat Testi ok:
- SC3 (kapalı kart): 900 / T300 → Kartı Kapat → iade 300 → 600 T300/K300 (11-05 kesildi), gecikmiş 300 → iade iptali → 11-05 geri geldi, 900/K600, gecikmiş 600. S234, S237 ve S238 ile uyumlu.
- SC3a (açık kart): 20.11 gecikmişi 300 (S238 örneği).
- SC4 (faturasız stok iadesi): 300 → düzelt 600 → düzelt 900 → sil → geri yükle. Kart 600 → 300 → 300 → 900 → 300; bakiye 300 → 0 → −300 → 600 → −300. Eski kodda düzelt / sil sonrası kart ile kendi hesabı ayrışıyordu; bu düzeldi.
- SC6 (S241 / S242): T600 iken Düzenle 900→300 → kart 600 T600/K0, avans 300. Sonra 300→900 → kart 600, F'nin 300'ü kendi vadesiyle açık.
- SC9 (kapalı kartta Düzenle — S234-c): 900→600 → kart 600 T300/K300, gecikmiş 300. Sonra 600→300 → kart 300/K0, bakiye 0.
- SC9b (kart sil → Silinenler'den geri yükle → iade iptali): 10-05 taksiti geri geliyor.
- Yedek / geri yükleme: yalnız statik bakıldı. Yedek `VACUUM INTO` ile alınıyor; `payment_json` (editCuts, coverCuts) ve `audit_events` ('stock.return.cuts') ortak tablo değil, yani yedekle taşınıyor. Koşulmadı.

**5. Canlı yenileme ve önbellek.**
- Her işlemden hemen sonra kart GET'i taze sayıyı döndü (SC1–SC9). Önbellek anahtarı (`settleKey` = total_changes + data_version + gün) ile ilgili okumalar (`accountPrints`) bu yollarda doğru anda boşalıyor.
- İstemcide fatura ekranı 'plans' olayıyla yenileniyor (`hof-invoices.js:4130` onLedger).
- İki tarayıcılı gerçek ekran denemesi yapılmadı (DENENMEYEN).

**6. Beklentisi değişen testler.** Beş birleşimdeki bütün `--diff-filter=M` beklentileri karar metniyle geliyor (S229, S230, S238, S241, S243 / K7 (2), S223). Kendi açık beklentileri korunmuş; bir gerilemeyi örten beklenti bulmadım.

**7. Testin dişi.** Yeni testleri eski kodda (`85f70cda^1`) koştum:
- `s229-acik-fatura-kart-payi-250`: 13 testin 11'i kırmızı. Neden: "Açık Faturalar F1 50.000 (20.000 beklendi)".
- `dkfix-s234-kapali-kart-250`: 9 testin 6'sı kırmızı. Neden: "kart 900→600; tabanda 900".
- İkisi de beklenen nedenle kırmızı.

**8. S223 + S231 (adlar.mjs, `6a1d19d1^1` ↔ yeni).**
- T1: 'Elif Su' / 'ELİF SU' / ' elif  su ', grup 'Işık Servisi' / 'IŞIK SERVİSİ' / ' ışık   servisi ' → yeni kodda 1 cari, 1 kart, 1 grup (eski kodda 3 / 3 / 3).
- T2: aynı dosyada iki yazım → tek kart.
- T3: var olan çift cariler → S228 = A sırası; iki kodda aynı.
- T4: cari Excel'de iki yazım → 1 cari, grup katlanarak bulundu.
- T5: çekte 'ahmet yılmaz' → yeni kodda 'Ahmet Yılmaz'. Eski kodda önbellek anahtarı hatası yüzünden 'AHMET YILMAZ' idi.
- `foldName` değişmedi (rol ve kullanıcı adı yolları). Tablodan Aktar Geri Al yalnız gerçekten açılan grubu siliyor (`plan-transfer.mjs`, created geri çağrısı).

## BULGULAR

**ORTA-1 — önceden var, beş farkın getirdiği değil.** Faturaya BAĞLI tahsilat, Mevcut Borç kartının aldığı kısmı da kapatınca kart 'Kalan 600' kalıyor, carinin bakiyesi 0.
- Betik: `senaryo.mjs` SC5 / SC7. F 900, elle kart 600 (F'nin 600'ünü alıyor).
- F'ye bağlı tahsilat 900:
  - Bakiye 0, Gecikmiş Borç 0.
  - Kart penceresi, Taksitler listesi ve cari özeti 'Tahsil Edilen 0 · Kalan 600'; planRemaining 600.
  - Eski anlamdaki taksit gecikmişi 200 (Ödeme Hatırlatma; bu kısmı Ç5-C'nin bilinen sınırı).
- F'ye bağlı 600: bakiye 300, ama kart Kalan 600.
- Bağsız 900: kart T600/K0 — doğru.
- `85f70cda^1` ve `v2.4.9` kodlarında da aynı (v2.4.9'da bağsız ödemede de K600 kalıyor).
- Yol açık, çünkü S230 = A sınırı değiştirmedi:
  - Fatura kartında Tahsilat Ekle'ye öneri yerine elle tutar yazmak.
  - Cari tahsilatında 'Kapatılacak Fatura = F' seçip faturanın gösterilen açığından fazla tutar girmek.
- Kök neden doğrulanmadı. Olası yer `server/lib/obligation-queue.mjs` invoiceLinks: bağlı ödeme faturanın karta tüketilmiş kısmını kapatıyor, kartın taksitleri açık kalıyor (açık kalemlerin toplamı ≠ bakiye).
- Formdaki kural metni ("fazlası carinin vadesi en önce gelen açık borcuna gider") zaten kartın taksitlerini gösteriyor. Bu yüzden yeni karar gerekmediğini düşünüyorum.
- En küçük düzeltme önerisi: kuyrukta bağlı ödemenin faturayı aşan / kartça tutulan kısmı kartın taksitlerine dağılsın (bağsız 900'deki sonuçla aynı olsun).

**DÜŞÜK yazmadım** — 2.5.1 başlığına bakın.

## K1–K13 DEĞERLENDİRMESİ
Hepsi karar metnine uyuyor; betikle gösterildi.
- **K1:** Açık Faturalar / Anlık Durum yalnız kart payını düşüyor. Alış faturası, iade belgesi ve şüpheli fatura kendi kuralında kalıyor.
- **K2:** `open` gösterim, `ownOpen` kendi açık — 424 / 424 uyumlu.
- **K3:** tamamı kartta olan fatura Mahsup ve Kapatılacak Fatura seçeneklerinde görünmüyor, sunucu sınırı 900.
- **K4:** tamamı alınan fatura 'Taksitte' (SC1, SC3).
- **K5–K8:** S234 / S237 / S238 / S241 / S242 / S243 sıraları doğru.
- **K9:** bölme yalnız eklenmiş rowid'de; G1–G5 kararları iki kodda aynı.
- **K10–K13:** T1–T5 doğru; tek kart formu değişmedi.

## KULLANICIYA SORULMALI (ders 43 — iş listesi C / D'de aranmadı ya da benzeri yok; S169 farklı bir durum)
**S-1 (uç durum):** aynı caride İKİ Mevcut Borç kartı varken faturasız stok iadesi hangi kartı küçültür?
- Bugün (v2.0.24'ten beri ve v2.4.9'da da) en YENİ kartı kesiyor (`server/routes/plans.mjs:811`).
- SC8 örneği: K1 (05.10'dan başlıyor) ve K2 (05.11'den başlıyor), 600'er; iade 300 → K2 küçülüyor; 20.10'da gecikmiş 200 (K1'in 05.10 taksiti).
- Seçenekler:
  - **A:** bugünkü gibi en yeni kart.
  - **B:** karar (4)'ün "vadesi en önce gelen açık taksit" sözü carinin bütün kartlarına uygulanır → K1'in 05.10 taksiti kesilir, gecikmiş 0.
  - **C:** uç durum böyle kalsın (BİLİNEN SINIR).
- Bakiye iki okumada da 900; değişen yalnız gecikmiş (200 / 0).
- Öneri: **C** (önceden var; kural yazılmamış).

## SONRAKİ SÜRÜME (2.5.1)
- Kapı: savepoint geri alınınca `capture.inserted` bayat kalıyor ve kimlik farkı bölmesini tetikliyor. Kapının kararı değişmiyor (G1–G5 aynı), yalnız iç düzen.
- Satış / alış fatura raporunda (`report-center.mjs:2932`) kartın içine aldığı faturada 'Ödenen + Kalan ≠ Ödenecek' görünüyor. Durum 'Taksitte' yazıyor ve kural Faturalar listesiyle aynı; görünüm ayrıntısı.
- SC6: art arda Düzenle'den sonra kapama defterinde kapsam{K:300} kalıyor, kuyrukta inPlan yok (S245 = C alanı; bakiye doğru).

## DOĞRULANMADI
- Fatura kartındaki 'Taksit Kartında' satırı kartın adını taksit görme yetkisi olmayan role de gösteriyor olabilir: avukat rolü fatura kartında `inPlans` [Yetki Kartı 600] gördü. Rolün yetki listesi okunmadı; faturanın kendi kartı (`doc.plan`) da önceden aynı biçimde gösteriliyordu.
- Testte saat geriye alınınca test kipinde 'gate-equivalence' (dates:future:stock_moves) çıktı. Bu bir test düzeneği etkisi; gerçek kurulumda saat geri gitmez.

## DENENMEYEN
- İki tarayıcılı ekranda canlı yenileme (yalnız sunucu ve dinleyici statik bakıldı).
- Hız ölçümü (`flock -x` ile ölçmedim; yalnız statik bakıldı — değişen yollarda kart başına ağır okuma görmedim).
- v2.4.9 verisinin yeni koda göçü (yalnız v2.4.9 kodunda senaryo koştum).
- İki şirket: dökümde şirket 002 seçilemedi, nedenini okumadım.
- Yedek → geri yükleme koşusu (yalnız statik).
- Kilitli dönem: yalnız kapı senaryolarında denendi.
- Gün / ay dönümü, mutasyon, Sheets kaynağı, Tablodan Aktar ekranı, 100 bin caride S223 hızı.
- Yetki: personel 5 uçta 403 aldı ve veri değişmedi; muhasebe ile avukatın stok iadesi kartı kesmedi (bakiye yetiyordu).

## Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-tek-a835` — betikler, ham çıktılar ve `rapor-taslak.md` burada.

**YÜKSEK YOK.** ORTA tek: ORTA-1 (önceden var, gerileme değil).
