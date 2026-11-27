# D3 TUR 5 raporu — tur 4'ün DOĞRULANMADI maddeleri, S-T4-1 = A'nın devir tarafı, kâhin okumaları (a) / (b), test düzeni (2.5.1)

Ajan: D3 TUR 5 KOD ajanı (high), 27.11.2026. Taban `t251-d3-tur4` (8d9c87c0). D3 hâlâ HİÇBİR ŞEY YAZMAZ (plan + ön izleme + ön denetim + Devir Raporu).
TASLAK — adım adım doldurulur; son hâl en sonda işaretlenir.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı; testler buradan)

Her satır: "ne ters giderse devir yanlış geçer / yanlış durur / kullanıcı yanlış yönlenir". Yanlış DURDURMA da hatadır. Sütunlar: bozulma → beklenen → test.

### İş 1 — Borç Yaz karşısıyla Mahsup Et (DOĞRULANMADI-1; S-T2-1 = B'nin öbür yönü)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| b-1 | ≤K Borç Yaz (müşteri borcu) ↔ K sonrası alış faturası Mahsup Et: Borç Yaz ayrılmaz, K'de bağsız avans / alacakla netleşir | Borç Yaz'ın mahsuba giden payı K'de AYRILIR, yeni yıla Borç Yaz'ın AÇIK KALEMİ (borç yönü, vade = satırın Vade Tarihi; yoksa satırın günü) olarak devreder; bağ listesinde mahsup satırın devir kalemine (`line:`); devirli = devirsiz | devir-d3-mahsup-borc |
| b-2 | Sıra değişir: K sonrası alış önce, Borç Yaz sonra (Borç Yaz ≤K tarihli ama mahsuptan SONRA girilmiş — kilit yokken geriye tarihli giriş) | aynı ayırım (ayırım tarih / sıra değil mahsubun kendisine bağlı) | devir-d3-mahsup-borc |
| b-3 | Kısmi mahsup (Borç Yaz 300, mahsup 120) | 120 ayrılır, 180 K'de olağan sırayla kapanır / açık kalır; devirli = devirsiz | devir-d3-mahsup-borc |
| b-4 | İki belge de ≤K (Aralık alış ↔ Aralık Borç Yaz), mahsup Ocak'ta | "k-de-kapandi": iki belge K'de o mahsupla kapanır (yeni yılda yeniden uygulanmaz); devirli = devirsiz | devir-d3-mahsup-borc |
| b-5 | Ana belge ≤K alış, karşı belge K SONRASI Borç Yaz (Ocak) | ≤K alışın payı ayrılır (alacak yönü açık kalem); Borç Yaz yeni yılda kendi yerinde | devir-d3-mahsup-borc |
| b-6 | Mahsup sonradan silinir | hiçbir şey ayrılmaz | devir-d3-mahsup-borc |
| b-7 | Vade Tarihi'li Borç Yaz: ayrılan kalemin vadesi satır günüyle yazılır (vade kaybolur → gecikmiş ayrışır) | açık kalemin vadesi Borç Yaz'ın Vade Tarihi | devir-d3-mahsup-borc |
| b-8 | K günü (31.12) mahsup → ayırım YAPILIR (yanlış: K sonrası sayılır) | ≤K mahsup — ayırım YOK, olağan 0. adım | devir-d3-mahsup-borc |
| b-9 | İki seçenek (Borç ve Alacakları Aktar / Sadece Bakiyeyi Aktar) ayrışır | açık kalemler ve ayırım AYNI | devir-d3-mahsup-borc |
| b-10 | 002'deki Borç Yaz mahsubu 001'in planına girer | girmez | devir-d3-mahsup-borc |

### İş 2 — K öncesi belge KİLİTLİ dönemdeyken K sonrası bağ / mahsup (DOĞRULANMADI-2; S-T4-1 = A)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| k-1 | Tur 4 tohum 11 "Müşteri 108" sınıfı: fatura kilitli dönemde iade + bağsız havaleyle kapanmış, kilitten sonra bu faturaya BAĞLI 128,00 tahsilat → plan bağsız kapanışı kaydırır | S-T4-1 = A: bağ kilitli bağsız kapanışı KAYDIRMAZ → bağ arşiv başvurusu, 128,00 bağsız gibi vadesi en önce gelen borca; açık kalemler (devirli görünüm) 280,00 (22.12.2026) + 1.245,40 (19.01.2027), 19.01'e kadar gecikmiş 280,00, bakiye 1.525,40 — sayılar AYNEN | devir-d3-kilit-bag (elle kurulmuş eşdeğer) |
| k-2 | Aynı sınıf iadesiz (yalnız bağsız havale kilitli dönemde kapatmış) | plan aynı kural (A); devirsiz programın sonucu ölçülür, fark S-T4-1 sınıfına ayrılır | devir-d3-kilit-bag |
| k-3 | Kilit K'den ÖNCE (30.06), belge kilitli dönemde (01.05) KISMEN bağsız kapanmış; K sonrası Mahsup Et o belgeyle | ayrılan pay = devirsiz kuyruğun mahsuba verdiği pay (kilit sınırı dahil); devirli = devirsiz | devir-d3-kilit-bag |
| k-4 | Kilit K'de, belge K'de kısmen bağsız kapanmış; Ocak'ta Mahsup Et kalan tutarla | aynı | devir-d3-kilit-bag |
| k-5 | Devirsiz eşdeğerde S-T4-1 farkı "her fark BAŞARISIZ" sayılır ya da tersine HER fark S-T4-1 diye yutulur | yalnız S-T4-1 imzası (kilitten sonra kurulmuş bağ, hedefi K'de kapanmış ≤K fatura, devirsiz kuyrukta bu bağ faturayı kapatıyor, fark yalnız iki kalem arasında o tutarın yer değiştirmesi, bakiye aynı) ayrı sayaçta "BEKLENEN FARK (S-T4-1)"; öbür her fark BAŞARISIZ | devir-d3-kilit-bag + gerçek veri |
| k-6 | Kilit paketi girince (program A'ya geçince) test kırmızıya döner | devirli sayıları elle sabit; devirsiz ya S-T4-1 öncesi sayılar ya A sayıları (ikisi dışı BAŞARISIZ) — kilit paketi girince yalnız A kalır | devir-d3-kilit-bag |
| k-7 | Gerçek veri (v2.5.0 GERÇEK kodu) tohum 11'deki fark yine "fark 12" diye kırmızı / ya da yeni bir fark S-T4-1 sayacına kaçar | S-T4-1 sayacı ayrı satır; sınıf dışı fark 0 | devir-d3-gercek-veri |

### İş 3a — K kuyruğunda payı SIFIRA inmiş belgeye ≤K bağlı tahsilat (DOĞRULANMADI-3)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| z-1 | Aralık satış 400 bütünüyle Ocak mahsubuna ayrılır (K kuyruğunda payı 0); ≤K tahsilat bu faturaya BAĞLI (geriye tarihli giriş, kilitsiz) → bağ kuyrukta hedefsiz kalıp hata / çift kapama / kayıp | devirsiz ile aynı: bağ kapatamadığı tutarı bağsız gibi dağıtır (karar (2)); açık kalemler, net, gecikmiş devirli = devirsiz | devir-d3-sifir-pay |
| z-2 | Aynı, fatura kısmen ayrılmış (pay 0'a inmemiş) | bağ kalan payı kapatır, fazlası bağsız; devirli = devirsiz | devir-d3-sifir-pay |
| z-3 | Ayrılan pay K kuyruğundaki faturanın tutarını değil yalnız satırı küçültür (fatura kaydı eski tutarla kalır → kuyruk iki tutar görür) | kuyruğun gördüğü tutar ayrılmış pay düşülmüş tutar | devir-d3-sifir-pay |

### İş 3b — Arka plan yazıcılarının veri damgasına etkisi (DOĞRULANMADI-4; BM-T4-2)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| v-1 | Zamanlanmış / elle yedek, bütünlük taraması, analiz işçisi, defter dondurma, giriş / oturum izi damgayı değiştirir (devir sebepsiz durur) | değiştirmez | devir-d3-damga |
| v-2 | Para tablosuna yazan arka plan / kullanıcı yolu (tekrarlayan fatura taslağı, taksit tahsilatı düzeltmesi, kayıt tahsilatı düzeltmesi) damgayı değiştirmez (bayat ön izlemeyle devir sürer) | değiştirir | devir-d3-damga |
| v-3 | Kaynakta YENİ bir iz türü (yeni para yazıcısı) veri damgasının listesine girmeden eklenir | kaynak tarayan test kırılır: her iz türü ya veri damgasında ya gerekçeli "veri dışı" listede | devir-d3-damga-kaynak |
| v-4 | Kaynak taraması CRLF'li dosyada satırı yanlış böler (ders 27) | `/\r?\n/` | devir-d3-damga-kaynak |
| v-5 | Damganın saydığı tablo listesi bir B / A tablosunu kaçırır ve o tablonun yazımı iz bırakmaz | B / A tablosu ya damga listesinde ya iz türüyle karşılanmış ya gerekçeli dışarıda | devir-d3-damga-kaynak |

### İş 4 — Kâhin okumaları
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| a-1 | (a) Kararın örneği (Aralık satış 400 + alış 150; 16.01 Ocak satış 300 vade 30.01; 17.01 Mahsup Et 150): devir o gün yapılırsa plan, devirsiz programın O GÜNKÜ sayısından ayrışır | 01.01, 16.01, 17.01, 29.01, 01.02'de: devirsiz program (sahte saat o gün; o güne kadar girilmiş veri; API'den okunan gecikmiş) = o gün hazırlanan ön izlemenin devirli eşdeğeri; beklenen (elle): 250 / 250 / 400 / 400 / 550 | devir-d3-tarih |
| a-2 | (a) Bütün veri girildikten SONRA geriye dönük gün görünümü (programın tek borç sırası Mahsup Et'i tarihten bağımsız 0. adımda uygular — karar (2) = A) | devirli = devirsiz o görünümde de (400 / 400 / 400 / 400 / 550); kâhinin "kendi gününden itibaren" okumasıyla bu görünümün ayrışması raporda (programın geriye dönük gecikmiş görünümü var mı — ölçülür) | devir-d3-tarih |
| a-3 | (b) Bakiyesi 0 cari (Kasım satış 400, Aralık tahsilat 400; Ocak alış 150 ↔ Kasım satışı Mahsup Et): M12 "bakiye 0 → satır yok" kuralı iki yönlü açık kalemi yutar | iki yönlü kalem yeni yıla taşınır (satış 150 borç kalemi + 150 avans); bakiye 0; devirli = devirsiz; iki seçenek | devir-d3-tarih |
| a-4 | (b) Avans kalemi ayrı açık kalem mi net satır mı (M2 A "net açılış satırı … K'de açık ALACAK") — iki seçenekte biçim ayrışır | ölçülür ve raporda yazılır; para (bakiye, gecikmiş) aynı | devir-d3-tarih |

### İş 5 — Test düzeni
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| t-1 | Mutasyon tabanı `devir-d3-uc` / `devir-d3-zaman` olmadan koşar (o testlerin kırmızısı mutasyonda görülmez) | taban 20+ dosya; ikisi tabanda yeşil | devir-d3-mutasyon |
| t-2 | Katalog üreticisi her neden için "ilk örneği" kayıt dosyasının yazım sırasından seçer; testler başka sırayla koşunca katalog değişir | örnek ve sıra koşu sırasından bağımsız (iki farklı sırayla üretilen iki katalog bayt bayt aynı) | katalog iki kez üretilir |
| t-3 | "Bu Yıl Zaten Devredildi" iletisindeki gün gerçek saatten (koşu günü) gelir → katalog her gün değişir | gün testin sahte saatinden | devir-d3-ikinci |

### İş 6 — Windows (ders 48)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| w-1 | `devir-d3-ikinci` arşiv klasörünü silerken programda / iş parçacığında arşiv dosyasına açık tutamaç var (Windows'ta EBUSY) | silmeden ÖNCE açık tutamaç 0 (Linux /proc/self/fd ile ölçülür, rapora yazılır) | devir-d3-ikinci |
| w-2 | "Açmayı denedi → sonra dosya değişti" sırası: ön izleme arşiv dosyasının VARLIĞINA bakarken dosya silinir | ön izleme yalnız varlığa bakar (açmaz); silmeden sonra yeni ön izleme "dosyası yok" der | devir-d3-ikinci |

### Ortak (her iş)
| # | Bozulma | Beklenen |
|---|---|---|
| o-1 | Saat dilimi: UTC ↔ İstanbul'da gün sınırı (K / K+1; 01.01 03:30) | iki TZ aynı sayılar |
| o-2 | Yarıda kesilme: ön izleme iş parçacığı kesilirse | veri aynı (D3 yazmaz); sonraki ön izleme baştan |
| o-3 | İleti: yeni neden eklenirse iç kod / İngilizce / tablo adı sızar | bu turda yeni ileti yok; eklenirse aynı yardımcı + iletiDenetimi |

## 1. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

Ekran YOK (D5). Planın / ön izlemenin SAYILARI (açık kalemler, net, bağlar, ayırımlar, ön denetim, Devir Raporu) bu turda DEĞİŞMEDİ — iş 1 / 2 / 3a / 4 tur 4 kodunun bugünkü davranışını sabitledi
(hepsi eski kodda da yeşil; §4). Değişen TEK ürün davranışı veri damgası (plan `meta.veriSurumu` ve `onIzlemedenSonraDegisti` — kullanımı devri UYGULAYAN pakette; bugün hiçbir uç bu sonuçla durmaz):

| # | Ne | Önce (tur 4) | Sonra (tur 5) | Örnek (test) |
|---|---|---|---|---|
| H1 | Ön izlemeden sonra **fatura PDF'ini açmak** (Fatura › PDF; iz `invoice.pdf`), cari ekstresi / listelerin PDF / Excel'i (`*.exported`), toplu PDF / UBL, entegratör bağlantı denemesi, geri yükleme bildirimini kapatmak, içe aktarmanın ön okuması | "veri değişti" (tur 4 önekleri `invoice.%` / `account.%` / … bu izleri de sayıyordu) — devri uygulayan paket devri SEBEPSİZ durdururdu | "değişmedi" | devir-d3-damga v-1 KULLANICI (fatura PDF'i, ekstre) |
| H2 | **Şirket seçimi** (002'ye geçip 001'e dönmek; iz `company.selected` 001'in dosyasına yazılır), şirket erişimi, öbür şirketin açılması / silinmesi | "değişti" | "değişmedi" | devir-d3-damga v-1 (eski kodda İLK kırmızı adım) |
| H3 | Ekran durumu (`settings.client.updated` — ör. senkron sıklığı), Tabela Adı (`settings.office.updated`) | "değişti" | "değişmedi" | devir-d3-damga v-1 |
| H4 | **Kayıt tahsilatı tutar düzeltmesi** (`case.payment.updated`; `payments` para tablosu, satır sayısı değişmez) ve kayıt eşleştirmesinin tahsilatı başka kayda taşıması (`dataset.bonds.moved`) | "değişmedi" (bayat ön izlemeyle devir sürerdi) | "değişti" | devir-d3-damga v-2 (250 → 240) — gerçek kurulumda kayıt tahsilatı yolu KAPALI (410; ders 14) — zararsız ama eksiksiz |
| H5 | `meta.veriSurumu` değeri | tur 4'ün özeti | aynı veride FARKLI özet (iz sorgusunun kümesi değişti) — iki koşu bayt bayt aynı (gerçek veri "iki koşu bayt bayt aynı plan" 22/22) | — |

Değişmeyen (ölçüldü, sabitlendi): zamanlanmış yedeğin turu (`app.runDueBackups`), elle yedek, bütünlük taraması (`app.integrity.scanInBackground`), analiz işçisi, defter dondurmasının boş turu,
ikinci giriş / çıkış → "değişmedi"; cari kartı düzeltmesi, taksit tahsilatı düzeltmesi (300 → 280), tekrarlayan faturanın günü gelen taslağı → "değişti" (tur 4 kodunda da).

## 2. DEĞİŞEN DOSYALAR
- Ürün (D3): `server/lib/devir/plan-reader.mjs` — veri damgasının iz kümesi: `DATA_AUDIT_TYPES` (+ `case.payment.%`, `dataset.bonds.moved`), yeni `NON_DATA_AUDIT_TYPES` (görüntüleme / dışa aktarma /
  şirket seçimi / ekran durumu — SQL'de `AND NOT (…)`), damga tablo listesi `DEVIR_DAMGA_TABLES` (aynı liste, dışa açık). Başka ürün dosyası YOK (tek borç sırası, mahsup yolu, plan.mjs, ön denetim,
  rapor, rota DOKUNULMADI).
- Testler (YENİ): `test/devir-d3-mahsup-borc.test.mjs` (iş 1), `test/devir-d3-kilit-bag.test.mjs` (iş 2), `test/devir-d3-sifir-pay.test.mjs` (iş 3a), `test/devir-d3-damga.test.mjs` +
  `test/devir-d3-damga-kaynak.test.mjs` (iş 3b), `test/devir-d3-tarih.test.mjs` (iş 4).
- Testler (DEĞİŞEN — beklenti değişmedi): `test/devir-d3-ikinci.test.mjs` (iş 6 tutamaç ölçümü + ölçümün dişi; iletideki devir günü sahte saatten — y-1 beklentisi
  `\d{2}.\d{2}.\d{4}` deseninden TAM metne "2026 yılı 10.02.2027 tarihinde zaten devredilmiş; …" daraldı).
- Yardımcı: `test/fixtures/devir-d3-esdeger.mjs` (+ `kilitBagImzasi` — S-T4-1 sınıfının imzası). CI dışı: `test/devir-d3-gercek-veri.mjs` (S-T4-1 ayrı sayaç), `test/devir-d3-mutasyon.mjs`
  (taban D3'ün 26 dosyası + 8 mutant + M52 çapası), `test/devir-d3-ileti-katalog.mjs` (koşu sırasından bağımsız).
- Belge: bu rapor, `docs/devir/2.5.1-DEVAM/d3t5-iletiler.md` (katalog). Kanıt: `docs/kanit/2026-11-27/d3t5-*`.

## 3. TARAMA

### 3a. Tur 4'ün DOĞRULANMADI maddeleri ve kararların programdaki karşılığı
| Madde | Ne ölçüldü | Sonuç | Test |
|---|---|---|---|
| DOĞRULANMADI-1 (Borç Yaz karşısı) | ≤K Borç Yaz ↔ Ocak alış (Vade Tarihi'yle), geriye tarihli sıra, kısmi, iki belge ≤K, ana belge ≤K alış ↔ Ocak Borç Yaz, silinen, K günü, 002, iki seçenek | tur 4 kodu DOĞRU (kod iki yönde aynı yol): ayrılan pay Borç Yaz'ın açık kaleminde, vade = Vade Tarihi (25.12), bağ `line:` devir kalemine; devirli = devirsiz 10 gün × 7 cari | devir-d3-mahsup-borc 7/7 |
| DOĞRULANMADI-2 (kilitli belge) | S-T4-1 sınıfının küçük eşdeğeri (sayılar AYNEN), iadesiz aynı sınıf, kilit K'de kısmi bağsız kapanmış belgeye Ocak mahsubu, kilit 30.06 + K | plan A'yı veriyor (280,00 / 1.245,40, gecikmiş 280,00, bakiye 1.525,40); devirsiz program bugün 408,00 / 1.117,40 — fark YALNIZ S-T4-1 imzasıyla "BEKLENEN FARK"; mahsuplarda ayrılan = devirsiz kuyruğun payı (kilit sınırı dahil), devirli = devirsiz | devir-d3-kilit-bag 7/7 |
| — S-T4-1'in koşulu (yeni ölçüm) | aynı biçim iadesiz (yalnız bağsız tahsilat kilitli dönemde kapatmış) | program bağsız kapanışı KAYDIRMIYOR (172,00 / 800,00 = plan) → S-T4-1 yalnız kilitli kapanışta BAĞLI bir kapatıcı (iade) da varken oluşuyor (tur 4'ün kök neden okumasıyla uyumlu: ölçüm geçişinde bağ, bağsız ödemeden önce kapatıyor) — kilit paketinin girdisi | devir-d3-kilit-bag K2 |
| DOĞRULANMADI-3 (payı 0 belge) | Aralık satışının tamamı Ocak mahsubuna ayrılır, ≤K bağlı tahsilat geriye tarihli; kısmi; başka açık borç | tur 4 kodu DOĞRU: bağın kapatamadığı kısım bağsız (avans net satırda ya da Kasım satışını 200'e indirir); devirsizde de satış yalnız mahsupla kapalı (bağın payı 0); devirli = devirsiz | devir-d3-sifir-pay 3/3 |
| DOĞRULANMADI-4 (arka plan yazıcıları) | §1 | yedek / tarama / analiz / dondurma / giriş damgayı değiştirmiyor; fatura PDF'i, ekstre, şirket seçimi DEĞİŞTİRİYORDU (düzeltildi); kayıt tahsilatı düzeltmesi DEĞİŞTİRMİYORDU (düzeltildi) | devir-d3-damga 4/4, devir-d3-damga-kaynak 5/5 |
| Kâhin (a) | gerçek zaman çizgisi (sahte saat o gün, kayıt o gün): devirsiz programın cari kartı ↔ o gün hazırlanan ön izlemenin devirli eşdeğeri, 01.01 / 16.01 / 17.01 / 29.01 / 01.02 | ikisi de 250 · 250 · 400 · 400 · 550 = kâhinin okuması → plan zaten "mahsup kendi gününden itibaren" veriyor; KODLANMADI (gerek yok) | devir-d3-tarih (a) |
| Kâhin (a) — geriye dönük görünüm | bütün veri girildikten sonra geçmiş günün gecikmişi (tek borç sırasının görünüm günü parametresi; programın EKRANINDA böyle görünüm yok, ileri tarihli Mahsup Et 400 date-future) | devirsiz = devirli = 400 · 400 · 400 · 400 · 550 (Mahsup Et tarihten bağımsız 0. adım — karar (2) = A; kuyruk görünüm gününden bağımsız bütün satırlarla kurulur) — kâhinin "250"si bu görünümde ayrışır → §9 BM-T5-1 | devir-d3-tarih (a) |
| Kâhin (b) | bakiyesi 0 cari, iki seçenek | açık kalem (satış 150) taşınıyor, satırlar yazılıyor (M12 açık kalem varken uygulanmıyor), devirli = devirsiz; avans 150 EK-1 M2 A gereği NET satırda (Borç ve Alacakları Aktar: Borç Toplamı 250 + Alacak Toplamı 400; Sadece Bakiyeyi Aktar: Devir Bakiyesi alacak 150) — kâhinin "iki kalem devir satırı olmadan" biçimiyle ayrışır → §9 BM-T5-2; doğal sırada program bu mahsubu 409 ile reddediyor | devir-d3-tarih (b) |
| S-KD2-3 = A | ön denetimin dört Kural Farkı iletisi OKUNDU (değiştirilmedi; katalog §"Kural Farkı …") | `kural-farki` (fişi yaz), `kural-farki-kilit` (kilidi 30.12'ye al → fişi yaz → yeniden kilitle — etkin fiş yokken), `kural-farki-fis-yeni-yilda` (ÖNCE Ters Kaydet, sonra kilit — S-KD2-3 = A ile UYUMLU sıra), `kural-farki-alt-defter` (1. adım "Kilidi Aç"). Alt defter farkıyla AYNI ANDA etkin bir düzeltme fişi varsa bu iletinin 1. adımı kilit paketinden sonra reddedilir → §9 BM-T5-3 (kilit paketinin şartı); devir tarafında bu turda değişiklik YOK | katalog |

### 3b. Komşular (ders 10; değişen işlevlerin ADLARI + çağıranları `git grep`)
`git grep -l -E "devirVeriSurumu|onIzlemedenSonraDegisti|DATA_AUDIT_TYPES|NON_DATA_AUDIT_TYPES|DEVIR_DAMGA_TABLES|dataVersionOf|veriSurumu|kilitBagImzasi|createEquivalence|devir-d3-esdeger" -- server test tools`
→ yalnız `server/lib/devir/{plan-reader,plan,report,iletiler}.mjs` ve `test/devir-d3-*` (+ fixture, gerçek veri, mutasyon). Değişen işlevin çağıranlarının testleri D3'ün tamamında; tur 4'ün komşu
kümesi (D2 arşiv / yedek / bakım + yazım / taşınabilirlik / lisans / kanıt aracı) ayrıca:
| Koşu | TZ | Sonuç |
|---|---|---|
| `d3t5-yeni-utc` / `-ist` — D3 tur 1–5 testlerinin TAMAMI (26 dosya; İstanbul koşusu TERS dosya sırasıyla) | UTC / İstanbul | **164/164** / **164/164** |
| `d3t5-komsu-utc` / `-ist` | UTC / İstanbul | **103/103** / **103/103** |

## 4. Yeni / değişen testler — eski kod (t251-d3-tur4; AYRI kopya `git worktree add --detach /dev/shm/d3t5-k5/eski t251-d3-tur4`; YALNIZ 6 yeni test + yeni yardımcı `test/fixtures/devir-d3-esdeger.mjs` — ders 51) ↔ yeni kod
`d3t5-eski-utc` / `d3t5-eski-ist`: **27/32 geçti, 5 KIRMIZI** (iki TZ'de AYNI 5 test, aynı nedenler); `d3t5-yeni-utc` / `-ist`: **164/164** (D3'ün tamamı; yeni 32 dahil).

**E-1 — eski kodda KIRMIZI (neden iletiden okundu — ders 38):**
| Test | Eski kodda kırmızı nedeni | Neyin kanıtı |
|---|---|---|
| damga: v-1 KULLANICI | "şirket seçimi (company.selected izi bu dosyada) — true !== false" (ilk kırmızı adım; fatura PDF'i ve ekstre adımları sonradır — tek başına dişleri M62'de) | tur 4 damgası görüntüleme / seçim izini "veri değişti" sayıyordu (devir sebepsiz durur) |
| damga: v-2 PARA TABLOSUNA YAZAN | "kayıt tahsilatı düzeltmesi (250 → 240): damga değişmeli (satır sayıları 1/1/1/1 → 1/1/1/1) — false !== true" | tur 4 iz listesinde kayıt tahsilatı yoktu |
| damga-kaynak: her iz türü sınıflandırılmış | "Cannot read properties of undefined (reading 'some')" — iz listeleri dışa açık değildi | YAPISAL (liste yok) — kırmızı kanıt diye SAYILMAZ; dişi M60 / M61 mutantlarında |
| damga-kaynak: çakışma yok | aynı (liste yok) | YAPISAL — dişi mutantta |
| damga-kaynak: v-5 B / A tabloları | "B / A tablosu damgada sayılmıyor ve gerekçesi yok" (`DEVIR_DAMGA_TABLES` dışa açık değildi → bütün B / A tabloları "sayılmıyor") | YAPISAL — dişi mutantta |

**E-2 — eski kodda da YEŞİL (SABİTLEME testleri; tur 4 kodu bu sınıflarda zaten doğruydu — kırmızı kanıt diye YAZILMAZ, dişi mutasyonda — ders 7 / 38):**
| Test | Gerekçe |
|---|---|
| devir-d3-mahsup-borc (7) | S-T2-1 ayırımı Alacak / Borç Yaz için tek yol (`docKeyOf` debt / credit) — tur 4 Borç Yaz'ı denemedi ama kod doğruydu; dişi M57 |
| devir-d3-kilit-bag (7) | devir planı S-T4-1 = A'yı tur 4'te de veriyordu (görev metni: "DEVİR PLANI BUGÜN ZATEN A'YI VERİYOR — bu turda plan DEĞİŞMEZ"); dişi M58 (kilitli bağsız kapanış kayar) |
| devir-d3-sifir-pay (3) | sıfır paylı belgeye bağ tur 4 kodunda bağsız dağılıyordu (doğru); dişi M59 |
| devir-d3-tarih (6) | (a) plan kendi gününden itibaren veriyordu; (b) açık kalem taşınıyordu; dişi M63 / M64 |
| damga: ön izlemenin damgası; v-1 ARKA PLAN | arka plan yazıcıları tur 4 damgasını da değiştirmiyordu (ölçüldü) |
| damga-kaynak: tarama boş değil; CRLF | tarayıcının kendi denetimi |

**Beklentisi değişen test:** yok (devir-d3-ikinci'nin y-1 beklentisi desenden tam metne DARALDI — gün sahte saatten; eski kodda da aynı sayılar, yeni kodda iki TZ yeşil).

## 5. Kabul koşullarının sayıları
- **A** `test:kahin-defter` UTC **187/187** + İstanbul **187/187**; `test:kahin-cari` UTC **25.298/25.298** + İstanbul **25.298/25.298** — tur 4 ile (187 / 25.298) AYNI; kâhin dosyalarına dokunulmadı.
- **B** yeni testler eski kodda beklenen nedenle kırmızı (§4 E-1: 2 davranış testi + 3 yapısal; iki TZ aynı) ve sabitleme listesi gerekçesiyle (E-2); yeni kodda iki TZ **164/164**.
- **C** mutantlar **64/64 YAKALANDI** UTC (`d3t5-mutasyon-utc`) + **64/64** İstanbul (`d3t5-mutasyon-ist`); taban **164/164** (D3'ün 26 dosyası) iki TZ. Tur 1–4'ün 56'sı AYNEN (M52 çapası taşındı) + bu turun 8'i; her mutantta beklenen neden çıktıda görüldü.
- **D** gerçek veri (v2.5.0 GERÇEK kodu → yeni kod) 3 tohum × 2 TZ ⏳ (t11 iki TZ **22/22**, sınıf dışı fark 0, S-T4-1 sınıfı 12 karşılaştırma — §7).
- **E** katalog 56 neden (durdurur 46, uyarı 10), 176 ileti; iç kod / İngilizce / alan adı / tablo adı **0**; koşu sırasından bağımsız (§8).
- **F** komşular iki TZ **103/103** + D3'ün tamamı **164/164** (§3b).

## 6. Mutant tablosu
Tur 1–4'ün 56'sı AYNEN (M52'nin çapa metni bu turun listesine taşındı — `"settings.%", "staff.%"];` → `"case.payment.%", "dataset.bonds.moved"]);`; amacı aynen: giriş izi damgaya girerse uzman (2) kırılmalı).
Taban artık D3'ün 26 test dosyasının TAMAMI (tur 1'den eksik `devir-d3-uc` ve `devir-d3-zaman` dahil); `test/` altında tabanda olmayan bir `devir-d3-*.test.mjs` varsa tarama DURUR (yeni test unutulamaz).
| # | Mutant (bu turun 8'i) | Kırmızı test |
|---|---|---|
| 57 | S-T2-1: Borç Yaz karşısı ayrılmaz (yalnız Alacak Yaz satırı belge sayılır) | mahsup-borc: açık kalemler, ayırım, bağ, 002 (4 kırmızı) |
| 58 | S-T4-1: kilitli bağsız kapanış kayar (K sonrası bağlı tahsilat K kuyruğuna girer — programın bugünkü sınırını taklit) | kilit-bag: K1 plan, K1 devirli görünüm, K2 / K4 (3) |
| 59 | sıfır paylı belgeye ≤K bağ yanlış yönlenir (payın tamamı ayrılan belge K'de küçülmez; bağ belgeyi kapatır) | sifir-pay: plan (elle), devirsiz eşdeğer (2) |
| 60 | veri damgası: iz türü listesinden para yazıcısı düşer (taksit kartı `plan.%`) | damga-kaynak ×2 + damga v-2 (3) |
| 61 | veri damgası: bu turun eklediği para yazıcısı (kayıt tahsilatı) düşer | damga-kaynak ×2 + damga v-2 (3) |
| 62 | veri damgası: görüntüleme izi (fatura PDF'i) yine damgaya girer (tur 4 hâli) | damga v-1 KULLANICI (1) |
| 63 | mahsup geriye dönük (K'de) uygulanmış sayılır — ayrılan pay yeni yıla taşınmaz | mahsup-borc + tarih (8) |
| 64 | bakiyesi 0 caride açık kalem varken de satır yazılmaz (iki yönlü kalem yutulur) | tarih (b) plan (1) |

## 7. GERÇEK VERİ (ders 17) — v2.5.0'ın GERÇEK kodu (`git worktree add --detach /dev/shm/d3t5-k5/v250 v2.5.0`), üç tohum × iki TZ
Üreteç tur 4'ünkü AYNEN; değişen yalnız devirsiz eşdeğerin farkı SINIFLAMASI: imzası (`kilitBagImzasi`: K sonrası bağ ARŞİV BAŞVURUSU + devirsiz kuyrukta o bağ aynı faturayı "Bağlı" kapatıyor
(T > 0) + fark T ile sınırlı: her gün |gecikmiş farkı| ≤ T, açık kalem toplamı aynı, kalem kalem mutlak fark ≤ 2T) tutan fark "BEKLENEN FARK (S-T4-1 = A; program düzeltmesi kilit paketinde)"
sayacına, öbür her fark denetimi KIRMIZI yapar (ders 53 (b)). İmzanın başka farkı yutmadığı kalıcı testte sınandı (devir-d3-kilit-bag "imza başka farkları yutmaz").
| Koşu | Sonuç | Devirsiz eşdeğer (karşılaştırma / sınıf dışı fark) | BEKLENEN FARK (S-T4-1) | S-T2-1 ayırımı (yeni yıla / K'de) | Süre |
|---|---|---|---|---|---|
| utc t11 | **22/22** | 3684 / **0** | 1 cari, 12 karşılaştırma (2 seçenek × 6 gün), kayan 128,00 — devirsiz 408,00 / 1.117,40, devirli 280,00 / 1.245,40 (tur 4'ün "Müşteri 108"i AYNEN) | 8 (6 / 2) | 896 sn |
| ist t11 | **22/22** | 3684 / **0** | aynı (1 cari, 12; 128,00) | 8 (6 / 2) | 897 sn |
| utc t7 | **22/22** | 3684 / **0** | 0 | 8 (6 / 2) | 822 sn |
| ist t7 | **22/22** | 3684 / **0** | 0 | 8 (6 / 2) | 827 sn |
| utc t23 | ⏳ | | | | |
| ist t23 | ⏳ | | | | |
Tur 4'te t11 "21/22 — KIRMIZI 1 (fark 12)" idi; şimdi aynı 12 karşılaştırma S-T4-1 sayacında, denetim yeşil. Kilit paketi girince bu sayaç 0'a inmeli (kabul ölçütü — iş listesi D 18:16 kararı (3)).

## 8. İLETİ KATALOĞU (iş 5)
`docs/devir/2.5.1-DEVAM/d3t5-iletiler.md`: **56 neden** (durdurur 46, uyarı 10), kayıtlı **176** ileti; tarama (iç kod / İngilizce / alan adı / tablo adı / ISO tarih / nokta ondalık) **0 ihlal**;
neden kümesi tur 4 ile AYNI (56 başlık birebir — bu turda yeni ileti yok). BELİRLENİMCİLİK: üretici her nedenin örneğini bütün kayıtlarından (test, senaryo, kaynak, metin) sırasıyla en küçüğü
olarak seçer, nedenleri seviye + iç kod sırasıyla dizer. Kanıt: (A) UTC, testler alfabetik sırayla → katalog A; (B) A'nın kayıtları her dosyada TERS satır sırasıyla → katalog B: **A = B bayt bayt**;
(C) İstanbul, testler TERS dosya sırasıyla → katalog C: A ile farkı YALNIZ bir satır — "Ön İzlemeden Sonra Kayıt Girildi" iletisindeki yerel saat (10:15 UTC ↔ 13:15 İstanbul; tur 4 H8 davranışı,
doğru). "Bu Yıl Zaten Devredildi" iletisindeki gün artık testin sahte saatinden ("10.02.2027"; tur 4'te koşu günü "27.11.2026" idi).

## 9. BAŞ MİMAR KARARI GEREKİYOR
- **BM-T5-1 (kâhin okuması (a) — sürücünün görünümü):** program "kendi gününden itibaren" sonucunu GERÇEK zaman çizgisinde veriyor (o güne kadar girilmiş veriyle cari kartı = o gün hazırlanan
  ön izlemenin devirli eşdeğeri = 250 · 250 · 400 · 400 · 550; devir-d3-tarih). Programın EKRANINDA geriye dönük gecikmiş görünümü YOK (gecikmiş hep "bugün"e göre; ileri tarihli Mahsup Et
  `date-future` ile reddediliyor). Ama tek borç sırası "görünüm günü" parametresiyle bütün veriden geçmiş günü sorulursa Mahsup Et'i tarihten bağımsız 0. adımda uygular (karar (2) = A) →
  400 · 400 · 400 · 400 · 550 (devirli de aynı). Kâhin sürücüsü karşılaştırmayı bu ikinci görünümle (bütün olaylar + geçmiş gün) yaparsa 01.01–16.01'de 250 ↔ 400 farkı çıkar. Öneri: sürücü
  gecikmişi gerçek zaman çizgisiyle (o güne kadar yazılmış olaylar) karşılaştırsın — programın kullanıcıya gösterdiği tek görünüm o; fark yine çıkarsa iş listesi D'deki karar gereği "para
  gösterimi" sorusu (ders 43).
- **BM-T5-2 (kâhin okuması (b) — bakiyesi 0 caride avansın biçimi):** para aynı (bakiye 0, açık kalem 150 taşınıyor, gecikmiş 0, devirli = devirsiz), ama satır biçimi kâhinin metninden ayrışıyor:
  plan avansı EK-1 M2 A ("Net açılış satırı … K'de açık ALACAK") gereği NET satıra koyar — Borç ve Alacakları Aktar: "Devir — Borç Toplamı" 250 + "Devir — Alacak Toplamı" 400 + açık kalem 150;
  Sadece Bakiyeyi Aktar: "Devir Bakiyesi" alacak 150 + açık kalem 150. Kâhinin "iki kalem devir satırı olmadan" okuması avansı ayrı kalem sayıyor. Öneri: M2 A AYNEN (bütün carilerde avans net
  satırda; ayrı kalem yapmak her avanslı caride satır yapısını değiştirir), sürücü karşılaştırmayı satır biçiminde değil "açık kalemler + net" düzeyinde yapsın. Baş mimar bunu defter / ekstre
  satırı kuralı sayarsa kullanıcıya sorulmalı: A (öneri) avans net satırda (bugünkü plan); B avans da ayrı açık kalem, bakiyesi 0 caride devir satırı yazılmaz; C uç durum böyle kalsın (BİLİNEN
  SINIR — örnek ancak geriye tarihli girişle oluşur: doğal sırada program bu mahsubu 409 "faturanın açık tutarını (0,00 TL) aşamaz" ile reddediyor).
- **BM-T5-3 (S-KD2-3 = A ↔ devir iletisi; kilit paketinin şartı):** ön denetimin "Kilidi Açıp Yeniden Kilitleyin" (`kural-farki-alt-defter`) iletisinin 1. adımı "Dönem Kilidi'nde Kilidi Aç".
  Alt defter farkıyla AYNI ANDA etkin bir Kural Farkı Düzeltme Fişi varsa kilit paketinden sonra bu adım reddedilecek. Öneri: kilit paketi bu iletiye (fiş etkinse) "önce Kural Farkı Düzeltme'de
  fişi Ters Kaydet" adımını eklesin ya da iki nedeni birlikte versin (DEVİR NEDEN DURDU (d)); `kural-farki-fis-yeni-yilda` iletisi zaten önce Ters Kaydet diyor (uyumlu).
- **BM-T5-4 (veri damgası — dondurma izi):** defter dondurmasının izi (`ledger.snapshot.frozen` / `extended` / `thawed`) `ledger.%` önekiyle damgaya giriyor. Dondurma yalnız kilit değişince
  (kilit zaten damgada) ya da kural sürümü değişince koşuyor ve dondurma sürerken ön denetim DURDURUYOR (`dondurma-suruyor`) → yanlış durdurma üretmiyor (boş turun damgayı değiştirmediği
  ölçüldü). Öneri: böyle kalsın (güvenli taraf); D4b'nin "kopyada yeniden hesaplanan planın karşılaştırması" asıl güvence (BM-T4-2) aynen.

## 10. KULLANICIYA SORULMALI
- **Devir kuralında yeni para / kapama / defter sorusu ÇIKMADI.** S-T4-1 = A devir tarafında sabitlendi (plan değişmedi); kâhin okumaları (a) / (b) programın bugünkü davranışıyla para
  düzeyinde AYNI — biçim / görünüm farkları §9'da baş mimara (BM-T5-2 baş mimar defter kuralı sayarsa üç seçenekli soru hazır).
- S-SUR-1 / S-SUR-2 / S-UZ-1 / H-1 DOKUNULMADI; bu turun testleri bu davranışları SABİTLEMEZ (senaryolarda POS iadesi, Borçta Kalsın kalanı, rapor yok).

## 11. HIZ
Hız yoluna yapısal değişiklik YOK (kullanıcı 18:3x: ön izleme hızı sonraki sürüme). Değişen tek sorgu veri damgasının iz sayımı: tur 4'te de bütün `audit_events` taranıyordu; şimdi aynı
taramada 13 `NOT LIKE` koşulu daha — öğe başına okuma YOK (ders 47). Ölçülmedi: yük 6–7 / 4 çekirdek (ders 52 — ölçüm geçersiz olurdu; özel kilit diğer işler sürerken alınmadı). Ana oturumun
ölçüm penceresinde (temiz-100k KOPYASIYLA): `flock -x …/olcum.lock node /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/d3t5/olcum-damga.mjs <t251-d3-tur4 kopyası> <bu dal> <destekofis.sqlite kopyası>`
(eski ↔ yeni `devirVeriSurumu` ortanca / en çok ms, aynı veri, iki kez sırayla).

## 12. SONRAKİ SÜRÜME (20.11 kuralı)
- Kaynak taraması iz türünü yalnız yazılı biçimlerden bulur (`audit(…, "tür")`, şablonun durağan öneki, koşullu iki tür, `audit: { type }`, `*_TRACE`, `INSERT INTO audit_events … VALUES (?, 'tür'`);
  değişkenle geçen tür (ör. `routes/dues.mjs`'in iç içe koşullusu "dues.reopened") görünmez — öneki VERİ DIŞI listede olduğu için bugün zararsız.
- Devir Raporu'nun Hareketler / Listeler bölümündeki şema tablo adları → D5 ŞARTI (BM-T4 (6); bu turun işi değil).
- Kâhin aracı ham çıktısını `/tmp/kahin-defter-*` / `/tmp/kahin-cari-*` altına bırakıyor (aracın kendi düzeni; dokunulmadı).

## 13. DOĞRULANMADI
- **Devirden SONRA yeni yılda eski yıl belgesiyle Mahsup Et** (gerçek zaman çizgisinde en olası sıra: devir 05.01'de, Ocak satışı ↔ Aralık alışı mahsubu 17.01'de): devir 05.01'de yapılınca
  plan alışı K'de Aralık satışıyla netler (ayırım yok — mahsup henüz yok); yeni yıl dosyasında Aralık alışı YOK → 17.01'de o mahsup yapılamaz. Devirsiz program 17.01–29.01'de 400 gösterirken
  devirli dosya 250 gösterir (01.02'de ikisi 550). D4 (devirli dosya) olmadan üretilemez — devirli dosyanın kuralları adımının / D5'in şartı (Devri Yenile ile eski yıla mahsup ya da yeni yılda
  açık kalemle mahsup yolu); para etkisi görülürse ders 43.
- Gerçek veride (v2.5.0 GERÇEK kodu) Borç Yaz karşısı ve sıfır paylı belge olayı üretilmedi (üreteç tur 4'ünkü AYNEN); sınıflar kalıcı testlerde (elle kurulmuş, programın API'siyle).
- Arka plan yazıcılarından e-Belge durum turu, gelen kutusu çekmesi ve POS valör kuyruğu ayrı senaryoyla koşulmadı (sahte EDM / POS kurulumu gerekir): üçü de veri ad alanında (`invoice.%`,
  `bank.%`) → damgayı değiştirir (güvenli taraf); kaynak taraması onları sınıflandırılmış buluyor.

## 14. DENENMEYEN
- Ekran (D5) ve ana oturumun ekran yürüyüşü (cümlelerin okunması) — katalog hazır; bu turda yeni ileti yok.
- D4 yolları (bayat ön izlemenin kullanımı — `onIzlemedenSonraDegisti`'nin çağrılacağı yer; takas öncesi denetimler); devirden sonra yeni yılda Mahsup Et (§13).
- Windows: `devir-d3-ikinci` arşiv klasörünü siler (kendi geçici klasöründe, tam yolla); Linux'ta silmeden önce açık tutamaç her ölçümde **0** (iki TZ × 6 silme; ölçümün dişi: bilerek açılan
  bağlantı görünüyor). Windows'ta gerçek koşu CI'de ana oturumca okunur (ders 18 / 48 — iki yeşil).
- Hız ölçümü (§11 — yük yüzünden geçersiz olurdu; komut hazır). Tam `npm test` (ana oturum).
- Kayıt tahsilatı düzeltmesinin damgası gerçek kurulum koşuluyla (`legacyCasePayments` kapalı) — yol 410 ile kapalı olduğundan o koşulda olay yok (ders 14).

## 15. CI listesine eklenecek
- Yeni 6 `test/devir-d3-*.test.mjs` npm test deseniyle kendiliğinden girer; ci.yml değişmez. Yeni ekran senaryosu YOK.
- CI DIŞI (aynen): `node test/devir-d3-gercek-veri.mjs --eski <v2.5.0> --tohum N`, `node test/devir-d3-mutasyon.mjs --kopya <kopya>` (taban artık D3'ün bütün testleri; eksik dosya taramayı
  durdurur), `D3T3_KATALOG_DIR=<k> node --test …; node test/devir-d3-ileti-katalog.mjs <k> <md>`.

## 16. Kılavuz metni önerisi (D5'te; kılavuza DOKUNULMADI)
"**Ön izlemeden sonra fatura PDF'ini açmak, ekstre ya da liste indirmek veya şirket değiştirmek devri durdurmaz;** yalnız kayıt girmek ya da bir kaydı düzeltmek durdurur — o zaman Ön İzleme'yi yeniden başlatın."
"**Ocak'ta eski yıla ait bir Borç Yaz kaydıyla mahsup** yaptıysanız devir bu mahsubu korur: kayıt yeni yıla açık kalemiyle (vade tarihiyle) geçer, mahsup ona bağlı kalır."

## 17. Ana oturumun yeniden koşacağı komutlar
```
cd <bu dal>; export HUKUK_LICENSE_URL=http://127.0.0.1:9
T=$(ls test/devir-d3-*.test.mjs)        # 26 dosya
for tz in UTC Europe/Istanbul; do TZ=$tz node tools/kanit.mjs kos d3t5-$tz -- node --test --test-concurrency=1 $T; done      # 164/164
# eski kod kırmızısı: git worktree add --detach <yer>/eski t251-d3-tur4; yalnız 6 yeni test + test/fixtures/devir-d3-esdeger.mjs → 27/32, 5 kırmızı (§4)
# komşular: node --test --test-concurrency=1 test/devir-arsiv-wal-250.test.mjs test/devir-d2-arsiv-250.test.mjs test/devir-d2-arsiv-goc-kesinti-250.test.mjs test/devir-d2-yedek-250.test.mjs test/devir-d2-bakim-250.test.mjs test/yazim-duzeni.test.mjs test/platform-tasinabilirlik.test.mjs test/lisans-servisi-izolasyonu.test.mjs test/kanit-araci.test.mjs   # 103/103
# mutasyon: git archive HEAD server test package.json | tar -x -C <kopya>; ln -s <node_modules> <kopya>/node_modules; node test/devir-d3-mutasyon.mjs --kopya <kopya>   # 64/64 (~5 dk)
# gerçek veri: git worktree add --detach <yer>/v250 v2.5.0; node test/devir-d3-gercek-veri.mjs --eski <yer>/v250 --tohum 11   # 22/22, "BEKLENEN FARK (S-T4-1)": 1 cari, 12 karşılaştırma
# katalog: D3T3_KATALOG_DIR=<k> node --test $T; node test/devir-d3-ileti-katalog.mjs <k> docs/devir/2.5.1-DEVAM/d3t5-iletiler.md   # bayt bayt aynı (UTC)
npm run test:kahin-defter; npm run test:kahin-cari    # 187 / 25.298
```
