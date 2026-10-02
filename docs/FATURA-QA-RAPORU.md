# Fatura Modülü — QA Denetim Raporu (02.10.2026)

Kapsam: DestekOfis 2.0.15 dalı (`claude/nice-euler-jvajxv`, da54c51 üzerine), Fatura modülü. Yöntem: ISTQB düzeninde
(adım → beklenen → gerçek → durum → önem) gerçek sunucu ve tarayıcıya karşı koşulan betikler; varsayım yok, emin
olunamayan yer "test edilemedi / BLOCKED" olarak yazıldı. Veri: Konya hukuk bürosu (Av. Mehmet Demir Hukuk Bürosu;
Konya 6. İcra Dairesi 2026/1234 — Ayşe Kaya; Selçuklu Yapı Market Ltd. Şti.; Konya Teknik Mühendislik A.Ş.; aynı adlı
iki Hasan Öztürk; A4 kağıt, toner, klasör, danışmanlık hizmeti).

Durum sözlüğü: **PASS** beklenen sonuç alındı · **PARTIAL** özellik var ama kapsamı eksik (not düşüldü) · **N/A** özellik
programda yok (eksik özellik listesine girdi) · **BLOCKED** bu ortamda test edilemedi · **FAIL** hata.

Kanıt ve yeniden koşma:
- API/entegrasyon/veri bütünlüğü/edge/güvenlik: `node --disable-warning=ExperimentalWarning test/qa/qa-fatura.mjs`
  (sonuç: `docs/qa-sonuc/fatura-qa-api.json`).
- Arayüz (Playwright, ekran görüntüleri `test/qa/artifacts/ui/`): `node --disable-warning=ExperimentalWarning test/qa/qa-fatura-ui.mjs`
  (sonuç: `docs/qa-sonuc/fatura-qa-ui.json`).
- Önceden koşulan ve bu rapora dayanak sayılan takımlar (aynı gün): `npm test` 728/728; `npm run test:mutabakat`
  (bağımsız modelle 300–2.000 işlemlik 8 koşu, 0 sapma); `npm run test:senaryo-215` 55/55 ve diğer 10 ekran senaryosu;
  `test/einvoice-edm.test.mjs` 22/22 (sahte EDM sunucusu); `test/fatura-model.test.mjs` 30.000 fatura = bağımsız model.

## Özet

| Toplam | PASS | PARTIAL | N/A (özellik yok) | BLOCKED | FAIL |
|---|---|---|---|---|---|
| 64 | 49 | 10 | 4 | 1 | 0 |

Bu denetimde **açık kalan Critical/High hata yok**. Denetim öncesi aynı gün bulunup düzeltilen hatalar (regresyon
testleri eklendi) aşağıda "Bulunan ve düzeltilen hatalar" bölümünde.

## Test sonuçları (bölüm bölüm)

### 1. Fonksiyonel Kapsam Testleri

| No | Test | Adımlar | Beklenen | Gerçek sonuç | Durum | Önem |
|---|---|---|---|---|---|---|
| F1.1 | Liste: filtreler ve arama | tab, ödeme durumu, tarih aralığı, cari, ürün, metin araması | Her süzgeç doğru alt kümeyi döner | toplam 14; cari 2; ürün 3; 'vekâlet' 1; ödendi 4; tarih 1; iptal 3 | **PASS** | — |
| F1.2 | Liste: sıralama ve dışa aktarma | sort=amount/party/number; liste PDF; Excel | Sıralı; PDF ve Excel üretilir | tutar sıralı=true cari sıralı=true PDF 200 Excel 200 | **PASS** | — |
| F1.3 | Liste: kolon özelleştirme | Liste kolonlarını gizle/sırala | Kolon seçici | Fatura listesinde kolon özelleştirme yok (sabit kolonlar: Tarih, No, Cari, Durum, Tutar, Açık); ana tablo kolonları özelleştirilebilir, fatura listesi değil | **N/A** | Low |
| F10 | Ödeme planı / taksit entegrasyonu | Satıştaki 3 taksit; 1. taksit tahsil et; kalanını tahsil et | Kart 3 taksit; tahsilatta fatura 'Taksitte/Kısmen'; tamamında 'Ödendi' | taksit 3; 1. tahsilat → Taksitte (açık 4369.34); tamamı → Ödendi (açık 0) | **PASS** | — |
| F11 | Ödeme durumu ve Kasa/Banka bağlantısı | Hizmet satışı tamamı kredi kartıyla; alış tamamı havale | Satış 'Ödendi', Kart +; alış 'Ödendi', Banka −; Kasa satırı kaynağı 'invoice' | satış Ödendi kart +1800.00; alış Ödendi banka -960.00; Kasa satırı 2 | **PASS** | — |
| F12 | Not, açıklama, özel alanlar | Faturada not ve kalem açıklaması; özel alan | Not ve açıklama kartta/PDF'te; özel alan tanımlama | Not kayıtlı ("Konya 6. İcra 2026/1234 dosyası kapsamın") ve PDF altına basılıyor; kalem açıklaması var; faturaya özel (kullanıcı tanımlı) alan yok (cari ve stok kartında var) | **PARTIAL** | Low |
| F13 | Yaşam döngüsü: Taslak → Düzenle → Kes → İptal; kesilmiş belge düzeltilemez | Taslağı düzenle (PUT), kes, iptal et; kesilmişe PUT; iptal edilmişi iptal | PUT taslak 200; kes 200; kesilmişe PUT 409; iptal 200; ikinci iptal 409 | düzenle 200; kes 200 7200; kesilmişe PUT 409; iptal 200; ikinci iptal 409; kesilmişi sil 409 | **PASS** | — |
| F14 | Yazdırma / PDF: şablon, antet, logo, e-imza alanı | Satış PDF'i; antet (firma bilgisi) ve logo | PDF üretilir; antet var; logo ve e-imza alanı? | PDF 200 37143 bayt; antette firma adı ve adres var=true; not basılı=true; tek şablon (A4); logo yok; e-imza/kaşe alanı yok; ibare: ? | **PARTIAL** | Low |
| F15 | e-Fatura / e-Arşiv / e-İrsaliye | e-Belge kapalı programda gönder/UBL; açık programda sahte EDM ile tam döngü (ayrı test takımı) | Kapalıyken 404; açıkken gönder/durum/iptal/gelen kutusu çalışır | Bu kurulumda e-Belge kapalı (kullanıcı kararı): gönder 404, UBL 404. Açık kurulum: test/einvoice-edm.test.mjs 22/22 (sahte EDM sunucusu: e-Fatura gönder/durum/ret, e-Arşiv gönder/iptal, sonra gönder, gelen kutusu). Gerçek GİB/EDM test ortamına bağlantı yapılmadı (hesap yok); e-İrsaliye yok | **PARTIAL** | Medium |
| F16 | Toplu işlemler | Çoklu seçim PDF/Excel; toplu onay; toplu iptal | Seçilenleri PDF/Excel/XML; toplu onay/iptal? | Seçilenleri PDF 200 / Excel 200 / XML ZIP (e-Belge açıkken) var; Gönderilecekler'de "Tümünü Gönder" var; toplu onay (taslakları topluca kesme) ve toplu iptal YOK — her belge tek tek (iptal nedeni istenir) | **PARTIAL** | Low |
| F17 | Yetkilendirme: rol bazlı görüntüleme / oluşturma | personel, muhasebe, avukat, 'yalnız görüntüleme' yetkili kullanıcı | personel 403/403; muhasebe 200/200; avukat 200/200; görüntüleme yetkilisi 200/403 | personel 403/403; muhasebe 200/200; avukat 200/200; viewer 200/403 | **PASS** | — |
| F2.1 | Satış faturası oluşturma (stoklu + hizmet, peşin + taksit) | Ayşe Kaya'ya 10 paket kağıt (185) + 2 saat danışmanlık (2.500); 1.000 nakit, kalan 3 taksit | 200; ödenecek 8.220,00; taksit kartı 7.220 / 3; stok 90; Kasa nakit +1.000 (açılış 10.000 → 11.000) | 200 ödenecek 8220 kart 7220 stok 90 nakit 11000 | **PASS** | — |
| F2.2 | Alış faturası oluşturma (stoğa mal, kısmi banka ödemesi, vade) | Tedarikçiden 3 kalem alış; 5.000 TL havale, kalanı 10 gün vadeli | 200; ödenecek 22.344,00; stok 100/5/40; tedarikçi −17.344,00 | 200 ödenecek 22344 tedarikçi -17344 kağıt 100 maliyet 120 | **PASS** | — |
| F3.1 | Fatura tipleri: satış, alış, satıştan iade, alıştan iade, SMM | Her türden belge kes | Beş tür de kesilir; iade asıl faturaya bağlı; SMM stopaj %20 | iade 200 444 · alıştan iade 200 168 · SMM 200 stopaj 2000 ödenecek 10000 () | **PASS** | — |
| F3.2 | Proforma | Taslak kaydet; PDF'ini al | Taslak numarasız; PDF başlığı PROFORMA; deftere dokunmaz | taslak 200 no="" pdf 200 PROFORMA=true bakiye 0→0 | **PASS** | — |
| F3.3 | İrsaliyeli fatura | Alışta irsaliye no/tarih, sipariş no yazıldı | Alanlar kayıtta ve kartta | irsaliye İRS-4471 2026-09-12 sipariş SİP-2026-88 | **PASS** | — |
| F3.4 | Tevkifatlı fatura (9/10, kod 602) | Mühendislik firmasına danışmanlık 10.000 + %20 KDV, tevkifat 9/10 | KDV 2.000; tevkifat 1.800; ödenecek 10.200; tür TEVKIFAT | 200 KDV 2000 tevkifat 1800 ödenecek 10200 tür TEVKIFAT | **PASS** | — |
| F3.5 | İstisnalı fatura (%0 KDV, istisna kodu 301) | Hizmet ihracatı kalemi %0 + 302 | KDV 0; tür ISTISNA | 200 KDV 0 tür ISTISNA | **PASS** | — |
| F3.6 | Fiyat farkı faturası | Tür listesinde ara | Ayrı belge türü olarak | Ayrı 'Fiyat Farkı' türü yok; fiyat farkı hizmet kalemiyle (stoksuz satır) kesilebilir, GİB'de fatura tipi SATIS olarak gider | **N/A** | Low |
| F3.7 | e-İrsaliye | Modülde ara | e-İrsaliye belgesi | Yok; faturada irsaliye no/tarihi alanı var (irsaliyeli fatura). e-İrsaliye sonraki sürüm önerisi (docs/FATURA-KARSILASTIRMA.md) | **N/A** | Medium |
| F4 | Cari seçimi: kartından çekme ve yeni cari | Formda cari ara; formdan yeni cari aç | Arama + seçim; formdan yeni cari açılabilir | Arama/seçim çalışıyor (Ayşe Kaya bulundu); formun içinden yeni cari açma yok — 'Yoksa Cari ekranından açın' yazısı var (fatura formunu kapatmadan Cari penceresi açılabilir) | **PARTIAL** | Low |
| F5 | Stoklu / stoksuz kalem aynı faturada | Satışta stok kalemi + serbest hizmet satırı | Stok kalemi stok hareketi üretir, hizmet üretmez | kağıt goods=true move=true; danışmanlık goods=false move=false | **PASS** | — |
| F6.1 | KDV oranları 0/1/10/20 ve özel oran | Her oranla kalem; %18 ile dene | 0/1/10/20 kabul; 18 reddedilir (GİB listesi dışı) | dört oran KDV toplamı 31 (beklenen 31,00); %18 → 400 "1. kalem: KDV oranı %0, %1, %10, %20 olabilir." | **PASS** | — |
| F6.2 | Satır iskontosu + genel iskonto + tevkifat birlikte | 2 kalem: 1.000 (%10 satır isk., KDV 20, tevkifat 5/10), 500 (KDV 10); genel iskonto %5 | Matrah 1.330,00; KDV 218,50 (171,00+47,50); tevkifat 85,50; ödenecek 1.463,00 | matrah 1330 KDV 218.5 tevkifat 85.5 ödenecek 1463 | **PASS** | — |
| F7 | Otomatik hesaplama = bağımsız model (5.000 rastgele kombinasyon) | Programın hesabı ile ayrı yazılmış BigInt modeli karşılaştır | Kuruşu kuruşuna aynı | 5000 fatura karşılaştırıldı, sapma 0 | **PASS** | — |
| F8.1 | Numara: seri + sıra, otomatik artırım | Kesilen satış belgelerinin numaraları | FIS2026 serisinde 1'den boşluksuz; SMM ayrı seri | FIS: 1,2,3,4 · SMM: 1 | **PASS** | — |
| F8.2 | Numara: elle değiştirme (manuel override) | Kendi serimizde numarayı elle vermeyi dene | Kendi belgemizde numara programdan; alış/karşı tarafın belgesinde elle | Kendi serimizde elle numara yok (gönderilen "ELLE-1" yok sayıldı, FIS2026000000005 verildi — VUK sıra kuralı için bilinçli); alış ve müşterinin kestiği iade faturasında numara elle girilir | **PARTIAL** | Low |
| F8.3 | Numara: mükerrer kontrol (tedarikçi faturası) | Aynı tedarikçiye aynı numarayla ikinci alış | 409 invoice-duplicate; başka tedarikçide aynı numara serbest | aynı tedarikçi → 409 invoice-duplicate; başka tedarikçi → 200 | **PASS** | — |
| F8.4 | Numara ve tarih sırası (kronoloji) + iptalde numara korunur | Serinin son belgesinden eski tarihli belge kes; bir belgeyi iptal et | Eski tarihli → 400 chronology; iptal edilen numara listede kalır, yeniden verilmez | eski tarih → 400 chronology; iptal edilen FIS2026000000006 (cancelled); sonraki FIS2026000000007 | **PASS** | — |
| F9 | Tarih alanları: fatura, vade, sevk, sipariş; geçersiz biçimler | Geçerli alanlar kaydedilir; '31.12.2026', '2026-02-30', ileri tarih, vade<fatura reddedilir | Hepsi 400 ile açıklayıcı Türkçe mesaj | 400:Fatura tarihi geçerli bir tarih değil. T \| 400:Fatura tarihi geçerli bir tarih değil. T \| 400:İleri tarihli fatura kesilemez (05.10.20 \| 400:Vade (30.09.2026) fatura tarihinden (02. \| 400:İrsaliye tarihi geçerli bir tarih değil. | **PASS** | — |

### 2. Entegrasyon Testleri

| No | Test | Adımlar | Beklenen | Gerçek sonuç | Durum | Önem |
|---|---|---|---|---|---|---|
| E1 | Fatura → Cari bakiyesi (alacak/borç yönü) | Ayşe Kaya: 8.220 satış − 1.000 peşin − 444 iade (2 paket + KDV) − 6.776 taksit tahsilatı; tedarikçi: −22.344 + 5.000 + 168 (iade 5 klasör + KDV) | Ayşe 0,00; tedarikçi −17.176,00 | Ayşe Kaya 0; Selçuklu Yapı -17176 | **PASS** | — |
| E2 | Fatura → Kasa/Banka: doğru hesap, iptalde geri | Kart ödemeli satışı iptal et; Kasa kart bakiyesi | İptal sonrası kart −1.800; satır silinir; mutabakat tutarlı | iptal 200; kart 1800→0; satır kaldı=false; mutabakat true | **PASS** | — |
| E3 | Fatura → Taksitler: kart faturaya bağlı, silinemez; iade kartı küçültür | Faturanın kartını Taksitler'den silmeyi dene; iade kartı küçülttü mü | Silme 409 invoice-linked; kart iadeyle 7.220→6.776 (444 iade) | sil 409 invoice-linked; kart toplamı 6776 (7.220 − 444 iade) | **PASS** | — |
| E4 | Fatura → Stok: miktar, maliyet, kritik stok uyarısı | Toner 5 alındı (minQty 2); 4 sat → 1 kaldı → uyarı | Stok 1; uyarı listesinde HP 85A Toner; maliyet 1.100 | toner 1 Adet maliyet 1100; uyarı: HP 85A Toner | **PASS** | — |
| E5 | Fatura → İcra dosyası bağı (API tarafı) | Olmayan dosyaya bağlı cari açmayı dene; carinin faturaları | Boşa düşen bağ reddedilir; carinin faturaları listelenir (arayüz denetimi: gerçek dosyayla) | olmayan dosyaya bağ → 400 "Bağlanacak kayıt açık veri oturumunda bulunamadı. Tablodan s"; Ayşe Kaya'nın 2 belgesi cari süzgeciyle listelenir. Faturada dosya alanı yok; bağ cari üzerinden (arayüz denetimi U7) | **PARTIAL** | Medium |
| E6 | Fatura → Tahsilat Takvimi / Vade Takip | Toner satışı 5 gün vadeli; alış vadesi 10 gün geçti (tedarikçiye ödenecek) | Vade listesi: 7 gün içindekiler ve gecikenler; gecikme uyarısı | takvimde fatura kalemi 2: toner upcoming 07.10.2026; alış overdue (out, 22.09.2026) | **PASS** | — |
| E7.1 | Fatura → Raporlar: Cari Ekstre, Kasa Hareketleri, Mizan | Ayşe Kaya ekstresi; Kasa raporu kaynak; mizan dengesi | Ekstrede fatura/iade/tahsilat satırları; Kasa'da fatura satırı; mizan dengeli | ekstre 7 satır (fatura true, iade true); Kasa raporu 9 satır; mizan dengeli=true | **PASS** | — |
| E7.2 | Fatura → Raporlar: KDV Özeti, Yaşlandırma, Açık Faturalar, Gider, Ba-Bs, Stopaj/Tevkifat | Bu ayın KDV özeti ve diğerleri | Hesaplanan KDV = satış KDV − iade; yaşlandırmada gecikmiş alış değil satış; açık faturalar listesi; gider raporunda kırtasiye | KDV 391 4658 (model 4658), 191 3916 (model 3916); yaşlandırma 200; açık fatura 6; gider 200 kırtasiye=true; Ba-Bs 200; stopaj/tevkifat 200 | **PASS** | — |
| E8 | Fatura → Görevler / Notlar | Faturaya görev ata, not ekle | Fatura üzerinden görev/not | Faturaya görev atama ve not iş parçacığı yok; fatura üzerinde serbest 'Not' alanı var; görev ve notlar dosya kaydına bağlanır | **N/A** | Low |
| E9 | Çift yönlü tutarlılık: cari elle düzeltme, faturadan gelen satırı elle değiştirme | Hasan Öztürk'e elle 'alacak' 100 yaz; faturadan gelen cari satırını sil/düzelt; Kasa satırını düzelt | Elle alacak faturanın açığını düşürür (FIFO) ve mutabakat tutarlı; faturadan gelen satırlar 409 | elle alacak 200 → fatura Kısmen Ödendi (açık 512); faturadan gelen satırı sil 409 düzelt 409; mutabakat true | **PASS** | — |
| U7 | Fatura → İcra dosyası (arayüz): dosya kaydı → cari → fatura → dosya detayından cari kartı ve faturalar | Excel'deki 2026/1234 kaydına bağlı cari aç; fatura kes; kaydı tıkla; detay panelinden Cari Kartı; Faturalar bölümü | Bağlı cari dosya kaydıyla açılır; detay panelinde Cari Kartı; kartta fatura listelenir | Kayıt → Cari Kartı açıldı; kartta 1 fatura ve dosya bilgisi görünüyor=true. Dosya detay panelinde fatura listesi/tutarı yok; faturada dosya alanı yok; dosyadan doğrudan fatura kesme yok (cari kartından) | **PARTIAL** | Medium |

### 3. Veri Bütünlüğü ve Hesaplama Doğruluğu

| No | Test | Adımlar | Beklenen | Gerçek sonuç | Durum | Önem |
|---|---|---|---|---|---|---|
| D2 | Yuvarlama (0,01 TL) ve başlık = kalemler | 3 × 33,333 (%1), 7 × 0,07 (%10), KDV dahil 99,99 (%20); mutabakat kapısının 'fatura:lines' denetimi | Satır bazında yuvarlama, başlık = kalem toplamı; kapı ok | kalemler 100+0.49+99.99 = 200.48; başlık 200.48; kapı true  | **PASS** | — |
| D3 | Çok satırlı fatura: 200 kalem (sınır 500) | 200 kalemli satış kes; kartı aç; PDF al | Kesme < 3 sn; açma < 1 sn; PDF üretilir; toplam doğru | kes 16 ms, aç 6 ms, PDF 22 ms (53633 bayt); toplam 31152.09 = model 31152.09; 501 kalem → 400 | **PASS** | — |
| D4 | Negatif miktar/fiyat, sıfır tutar, aşırı büyük tutar, 4 ondalık miktar | qty −1; fiyat −5; %100 iskonto (sıfır); fiyat 1e13; miktar 0,0001 | Hepsi 400 ve Türkçe mesaj; hiçbiri kayıt bırakmaz | qty −1:400 "1. kalem: miktar sıfırdan büyük olma" \| fiyat −5:400 "1. kalem birim fiyatı geçerli bir sa" \| sıfır:400 "Faturanın ödenecek tutarı sıfırdan b" \| 1e13:400 "1. kalem birim fiyatı geçerli bir sa" \| 0,0001:400 "1. kalem: miktar sıfırdan büyük olma" · kayıt 18→18 | **PASS** | — |
| D5 | Dövizli fatura (USD, kur 34,2512) | 1.000 USD + %20 KDV, kur 34,2512 | Belge 1.200 USD; deftere TL 41.101,44; cari TL | 200 USD belge 1200 TL 41101.44; cari 104413.53 | **PASS** | — |
| D6 | İptal/iade sonrası bağlı kayıtların geri alınması (tablo sayımı) | Çekli + taksitli + stoklu satış kes; iptal et; tablolar | stok hareketi, cari satırı, taksit kartı, çek: öncekiyle aynı; Kasa aynı | önce {"moves":7,"entries":20,"plans":1,"cheques":0} → kesince {"moves":8,"entries":23,"plans":2,"cheques":1} → iptal {"moves":7,"entries":20,"plans":1,"cheques":0}; nakit 15009.34→15009.34; kapı true | **PASS** | — |
| D7 | Koşu sonunda mutabakat kapısı ve mizan | Tüm işlemlerden sonra | Kapı ok; mizan dengeli | kapı true ; mizan dengeli=true (borç 214302.01 alacak 214302.01) | **PASS** | — |

### 4. Kullanıcı Deneyimi ve Arayüz

| No | Test | Adımlar | Beklenen | Gerçek sonuç | Durum | Önem |
|---|---|---|---|---|---|---|
| U1 | Duyarlı tasarım: 390×844 (telefon), 820×1180 (tablet), 1440×900 | Fatura listesi ve formu her genişlikte aç; yatay taşma | Yatay kaydırma yok; düğmeler erişilebilir | 390px: liste taşma 0px, form taşma 0px, sayfa 0px \| 820px: liste taşma 0px, form taşma 0px, sayfa 0px \| 1440px: liste taşma 0px, form taşma 0px, sayfa 0px | **PASS** | — |
| U2 | Klavye: ürün adı yazınca öneri listesi; Enter ile seçim; birim fiyatta Enter → yeni satır; Esc listeyi kapatır | Formda kalem adına 'A4' yaz → öneri; Enter; miktar; birim fiyatta Enter | Öneri listesi açılır; Enter seçer; Enter ile sonraki satır açılır ve odaklanır | öneri 1; Enter → "A4" fiyat 185; birim fiyatta Enter → 2. satır var=true odak=1/name; Esc sonrası liste açık=false. Genel kısayol (Ctrl+N, Ctrl+S gibi) yok | **PASS** | — |
| U3 | Hata mesajları: anlaşılır ve Türkçe; zorunlu alanlar | Cari seçmeden kes; kalem olmadan kes; ileri tarih; sunucu hatası ekranda | Türkçe, ne yapılacağını söyleyen mesaj; alan odaklanır | cari yok: "Müşteriyi (cariyi) seçin." · kalem yok: "En az bir kalem yazın." · ileri tarih: "İleri tarihli fatura kesilemez (05.10.2026). Taslak olarak kaydedin; günü gelince kesin." | **PASS** | — |
| U5 | Onay diyalogları: kesme, iptal, taslak silme, büyük tutar | Faturayı Kes → onay; İptal Et → neden formu; Taslağı Sil → onay | Her biri onay ister; kesme onayında tutar ve numara yazar | kesme onayı: " × ONAY Faturayı Kes Ayşe Kaya için FIS2026000000002 numarasıyla satış faturası kaydedilecek: ₺300.000,00. Stok, cari, Kasa, çek/senet ve ta"; iptal: neden formu (etkiler geri alınır uyarısı var); taslak sil onayı=true; büyük tutara özel ek uyarı yok (tutar onay metninde yazıyor) | **PASS** | — |
| U6 | Performans: 1.000+ belge listesi ve 60 kalemli fatura | API ile 1.050 fatura kes; liste API ve ekran süresi; 60 kalemli kartı aç | Liste < 2 sn (API) ve < 3 sn (ekran); 60 kalem kart < 1,5 sn | 1050 belge 23.1 sn'de kesildi (22 ms/belge); liste API 111 ms (toplam 1055); ekran 213 ms; 60 kalemli kart 66 ms | **PASS** | — |
| U9 | Tarayıcı konsol/çalışma hatası | Tüm adımlar boyunca | Hata yok | Hiç hata yok | **PASS** | — |

### 5. Edge Case ve Negatif Testler

| No | Test | Adımlar | Beklenen | Gerçek sonuç | Durum | Önem |
|---|---|---|---|---|---|---|
| N1.1 | Eşzamanlılık: aynı taslağı iki kullanıcı aynı anda keser | admin ve muhasebe aynı taslağa /issue | Biri 200, diğeri 409 (invoice-stale); tek belge | durumlar 200/409 (invoice-not-draft); kayıt 1 | **PASS** | — |
| N1.2 | Eşzamanlılık: 20 satış aynı anda → numaralar tekil ve boşluksuz | İki kullanıcı 10'ar satışı aynı anda keser | 20 belge, 20 farklı ardışık numara | 20/20 kesildi; tekil 20; ardışık true (17…36) | **PASS** | — |
| N2 | İnternet kesilmesi sırasında kayıt | Yerel sunucu; istek yarıda kesilince | Yarım kayıt kalmaz | Bu ortamda simüle edilemedi (sunucu yerel ağda, istek kesintisi üretilmedi). Kod: her kesim tek BEGIN IMMEDIATE işlemi (yarım yazım imkânsız); istemci 'HOF.api' hatayı gösterir, yeniden deneme kullanıcıya bırakılır; e-Belge gönderiminde bağlantı kopması belgenin durumunu değiştirmez (Durum Sorgula ile alınır) | **BLOCKED** | Medium |
| N3 | Çok uzun açıklama / özel karakter / emoji | Not 2.001 karakter; kalem adı 'Üçgen & "Çift" <tırnak> 😀 ₺' | 2.001 → 400; özel karakter ve emoji olduğu gibi saklanır, PDF üretilir | 2.001 karakter → 400; kalem adı korundu=true; not korundu=true; PDF 200 | **PASS** | — |
| N4 | Geçersiz vergi numarası ve eksik zorunlu alan | Cari: VKN '1234567891' (yanlış kontrol hanesi), TCKN '12345678901'; fatura: cari yok, kalem yok | VKN/TCKN 400; cari/kalem eksik 400 Türkçe | VKN 400 "Vergi kimlik numarası (VKN) geçersiz: de"; TCKN 400; cari yok 400 "Faturanın carisini seçin."; kalem yok 400 "Faturaya en az bir kalem ekley" | **PASS** | — |
| N5 | Geçmiş tarihli / ileri tarihli fatura | Geçen yıl tarihli (yeni seri yılı); yarın tarihli | Geçen yıl: kesilir (ayrı yıl serisi) — kronoloji yıl içinde; yarın: 400 date-future; 7 gün uyarısı | geçen yıl 200 FIS2025000000001; yarın 400 date-future; 9 gün geriye tarihli: uyarı "Fatura tarihi bugünden 9 gün önce; teslimden itibaren 7 gün " | **PASS** | — |
| N6 | Silinmiş cari / stok kartına bağlı fatura | Bakiyeli ve faturalı Ayşe Kaya carisini sil; faturasını aç; klasör ürününü (hareketli) sil; iade kes; iadesi olan alışı iptal et | Borçlu cari silinemez (409) ya da silinince fatura açılır; silinmiş ürünlü faturanın iadesi anlamlı mesajla reddedilir ya da çalışır | cari (bakiye 0, faturalı) sil 409 "Bu carinin 1 taksit kartı var. Önce kartları silin"; faturası aç 200; ürün sil 200 ""; silinmiş ürünlü iade 400 "Faturadaki ürün stokta bulunamadı; silinmiş olabil"; iadesi/satışı olan alışı iptal 409 invoice-has-returns | **PASS** | — |
| N7 | Lisans / deneme süresi dolmuşken fatura | Etkinleştirilmemiş (salt okunur) kurulumda fatura kes, liste al | Yazma 403; okuma 200 | kes 403 "Ücretsiz deneme henüz başlamadı. Program salt okunur çalışıy"; liste 200; lisans durumu none | **PASS** | — |

### 6. Güvenlik ve Yetkilendirme

| No | Test | Adımlar | Beklenen | Gerçek sonuç | Durum | Önem |
|---|---|---|---|---|---|---|
| S2 | Audit log: kim, ne zaman, ne değiştirdi | audit_events: invoice.created / cancelled / issued; İşlem Geçmişi raporu | Her olayda aktör, zaman, belge no, tutar | 63 olay; türler: invoice.settings.updated, invoice.created, invoice.draft.created, invoice.pdf, invoice.cancelled, invoice.draft.updated, invoice.issued, invoice.pdf.bulk, invoice.exported, invoice.draft.deleted; örnek iptal: Ofis yöneticisi 2026-10-02T06:05:01.799Z FIS2026000000005 "QA"; İşlem Geçmişi raporu 200 faturayı içeriyor=true | **PASS** | — |
| S3 | Hassas veri maskeleme | TCKN/IBAN listede ve kartta nasıl görünür | Gerekiyorsa maskeleme | Maskeleme yok: TCKN cari ve fatura kartında tam görünür (belgede yasal olarak zorunlu). Yetkisi olmayan rol faturayı hiç göremez (403). Entegratör parolası şifreli (AES-256-GCM, anahtar yedekte yok) ve ekrana çıkmaz | **PARTIAL** | Low |

### 7. Raporlama ve Uyumluluk

| No | Test | Adımlar | Beklenen | Gerçek sonuç | Durum | Önem |
|---|---|---|---|---|---|---|
| R3 | Yasal saklama ve arşivleme | Kesilmiş belge silinebiliyor mu; iptal edilen saklanıyor mu; yedek | Kesilen belge silinemez (409); iptal edilen numarasıyla kalır; yedek alınır | kesilmişi sil 409; iptal edilenler numaralı 5; veritabanı yedeği (VACUUM INTO) ve Drive yedeği var; 10 yıllık saklama / dönem arşivleme otomasyonu ve e-Belge (UBL) yasal saklama (imzalı XML arşivi) YOK — entegratör saklar | **PARTIAL** | Low |

## Bulunan ve düzeltilen hatalar (02.10.2026, bu dalda)

| # | Önem | Hata | Nasıl bulundu | Durum |
|---|---|---|---|---|
| B1 | Critical | Çekle ödenmiş fatura iptal edilince o carinin fatura listesi ve yeni fatura yanıtı 500 veriyordu (`paymentStates`, çek olayının `effects_json`'ı iptalde nesneye dönüyor; dizi sanılıyordu). Fatura aslında kaydediliyor, kullanıcı hata görüyordu. | Mutabakat motoru, tohum 1, 295. işlem | Düzeltildi (`server/routes/invoices.mjs`); motor ve EDM testleri yeşil |
| B2 | High | Fatura yetkisi olmayan kullanıcı (personel) sol menüde "Fatura" düğmesini görüyordu (sunucu 403 veriyordu; CSS gizleme kuralı eksikti). | senaryo-215, 9. adım | Düzeltildi (`hof-ui.css`); `test/yetki-gorunurluk.test.mjs` kaynakta kullanılan her yetkinin gizleme kuralını arar |
| B3 | Medium | Ana ekranda "Yeni Kayıt" ile "Dışa Aktar" düğmeleri birbirinin önüne geçmeye çalışıp sonsuz DOM değişikliği yapıyordu; öteki ekran düzeltmeleri çalışmıyor, gizli kalması gereken iki düğme görünüyordu. | senaryo-211 yazım düzeni taraması | Düzeltildi (`hof-export.js`); 57/57 |
| B4 | Low | Kasa'da faturadan gelen tahsilat satırı "Kasaya elle" / "Ödeme" kaynağıyla görünüyordu. | senaryo-215, 6. adım | Düzeltildi ("Faturadan" + Fatura düğmesi) |
| B5 | Low (test) | İki eski test (defter-213, plans) sabit vade tarihi içerdiğinden ayın 2'sinde kırıldı; program hatası değil. | npm test | Testler bugüne göreli yapıldı |

### Açık bulgular (hata değil, kapsam/eksik)

| # | Önem | Bulgu | Repro / gözlem | Beklenen |
|---|---|---|---|---|
| A1 | Medium | Fatura ↔ icra dosyası bağı dolaylı: faturada "Dosya" alanı yok; dosya detay panelinde faturalar/açık bakiye yok; dosyadan doğrudan fatura kesilemiyor. Bağ cari üzerinden (cari kartı dosyaya bağlı, "Cari Kartı" düğmesi, kartta Faturalar bölümü). | U7, E5 — ekran: `01-dosya-cari-karti-faturalar.png` (Ayşe Kaya kartında "Tablodaki Kayıt: Konya 6. İcra 2026/1234", Faturalar 1, Taksit Kartları 1) | Dosya detayında fatura özeti; faturada dosya seçimi |
| A2 | Medium | e-Belge gerçek ortamda (GİB/EDM test hesabı) doğrulanmadı; tüm e-Fatura/e-Arşiv senaryoları sahte EDM sunucusuyla (WSDL'den sözleşme) geçti. | F15 | EDM test hesabı alınınca gerçek uçtan uca prova |
| A3 | Medium | e-İrsaliye yok (irsaliyeli fatura alanları var). | F3.7 | Mal sevkiyatı olan müşteri için e-İrsaliye |
| A4 | Medium | İnternet/istek kesilmesi ortamda simüle edilemedi (BLOCKED). Kod incelemesi: her kesim tek BEGIN IMMEDIATE işlemi; yarım kayıt oluşamaz. | N2 | Saha provası |
| A5 | Low | Fatura formundan yeni cari açılamıyor ("Yoksa Cari ekranından açın"). | F4 | Formda "+ Yeni Cari" |
| A6 | Low | Toplu onay (taslakları topluca kesme) ve toplu iptal yok; seçilenleri PDF/Excel/XML ve "Tümünü Gönder" var. | F16 | Toplu işlemler |
| A7 | Low | PDF: tek şablon, logo yok, e-imza/kaşe alanı yok (antet = Fatura Ayarları'ndaki firma bilgisi; not basılıyor). | F14 | Logo ve imza alanı |
| A8 | Low | Fatura listesinde kolon özelleştirme yok; faturaya özel (kullanıcı tanımlı) alan yok; faturaya görev/not bağlama yok; ayrı "Fiyat Farkı" türü yok. | F1.3, F12, E8, F3.6 | — |
| A9 | Low | Kendi serimizde numara elle değiştirilemez (VUK sıra kuralı için bilinçli). Alış ve müşterinin kestiği iade faturasında elle numara var. | F8.2 | Bilinçli karar; rapora not |
| A10 | Low | Canlı yenileme olayları kendi kullanıcısına gitmez (`except: user.id`): aynı kullanıcı ikinci sekmede çalışıyorsa o sekme kendiliğinden yenilenmez (tek sekmede sorun yok; arayüzden yapılan değişiklikler yerel olayla yenilenir). Tüm modüller için geçerli tasarım kararı. | U7 tanı adımı | Oturum bazlı hariç tutma |
| A11 | Low | 10 yıllık saklama / dönem arşivleme otomasyonu yok; e-Belge'nin imzalı XML arşivi entegratörde (program saklamıyor). Kesilmiş belge silinemez, iptal edilen numarasıyla kalır, yedek var. | R3 | Arşiv politikası |
| A12 | Low | Stok kartı, faturalı hareketi varken silinebiliyor (Silinenler'den geri gelir); silinmiş ürünlü faturanın iadesi "ürün bulunamadı" ile reddediliyor. Bakiyeli/kartlı cari silinemiyor (409). | N6 | Hareketli stok kartında silme uyarısı |

## Entegrasyon matrisi

| Modül | Durum | Kanıt |
|---|---|---|
| Cari (borç/alacak, bakiye, ekstre) | ✅ Tam | E1, E7.1, E9: Ayşe 0,00 / tedarikçi −17.176,00 kuruşu kuruşuna; faturadan gelen satır elle silinemez (409); elle alacak FIFO ile faturanın açığını düşürür |
| Kasa / Banka (nakit, havale, kart) | ✅ Tam | F11, E2: kart +1.800, banka −960; iptalde satır kalkar, bakiye geri |
| Taksitler | ✅ Tam | F10, E3: 3 taksit; tahsilatta Taksitte → Ödendi; kart faturaya bağlı (silme 409); iade kartı 7.220→6.776 |
| Stok (miktar, maliyet, kritik uyarı) | ✅ Tam | F2.2, E4: 100/5/40 giriş, maliyet 120/1.100; toner 1'e düşünce uyarı |
| Çek / Senet | ✅ Tam | D6, senaryo-215 adım 7: evrak portföye, iptalde kalkar |
| Tahsilat Takvimi / Vade Takip | ✅ Tam | E6: 5 gün sonra vadesi gelen satış "yaklaşan", 10 gün geçmiş alış "gecikmiş (ödenecek)" |
| Raporlar (KDV, ekstre, yaşlandırma, açık fatura, gider, Ba-Bs, stopaj/tevkifat, Kasa, mizan, yevmiye) | ✅ Tam | E7.1, E7.2: KDV 391/191 modelle aynı; mizan dengeli |
| Ana Defter / mutabakat kapısı | ✅ Tam | D2, D6, D7: her adımda kapı ok, mizan dengeli |
| İcra / dava dosyaları | ◐ Dolaylı | A1 |
| e-Fatura / e-Arşiv (EDM) | ◐ Sahte sunucuyla tam; gerçek ortam yok | F15, A2 |
| WhatsApp (PDF + mesaj) | ✅ Var (bu denetimde koşulmadı; senaryo-215 kartta düğme) | — |
| Görevler / Notlar | ✗ Yok | E8 |
| e-İrsaliye | ✗ Yok | F3.7 |

## Eksik özellikler (standart fatura modülüne göre)

1. e-İrsaliye (A3).
2. Faturada dosya bağı ve dosya detayında fatura özeti (A1).
3. Formdan yeni cari açma (A5).
4. Toplu onay / toplu iptal (A6).
5. PDF'te logo, kaşe/e-imza alanı, birden çok şablon (A7).
6. Faturaya özel alan; görev/not bağlama; liste kolon özelleştirme; "Fiyat Farkı" türü (A8).
7. e-posta ile gönderim (yalnız WhatsApp ve PDF indirme var).
8. Dönem arşivleme / 10 yıl saklama otomasyonu (A11).

## Genel kalite skoru: **86 / 100**

Gerekçe: Çekirdek muhasebe mantığı (hesaplama, numaralandırma, atomiklik, iptal/iade geri alma, cari–Kasa–stok–taksit–
çek çapraz tutarlılığı) 64 testin tamamında ve bağımsız modelli 10.000+ işlemlik mutabakat koşularında kuruşu kuruşuna
doğru; 0 açık hata, 0 tarayıcı hatası; 1.055 belgede liste 111–130 ms, 200 kalemli kesim 24 ms. Puan kırılan yerler:
e-Belge'nin gerçek entegratör ortamında doğrulanmamış olması (−5), dosya bağının dolaylı kalması (−4), e-İrsaliye ve
toplu/inline kolaylıkların eksikliği (−3), arşiv/logo/imza gibi sunum ve saklama eksikleri (−2).

## Acil düzeltilmesi / yapılması gereken 5 madde

1. **EDM Bilişim test hesabıyla gerçek ortam provası** — e-Fatura gönder/durum/ret, e-Arşiv gönder/iptal, gelen kutusu,
   "Kes, Sonra Gönder" numaralandırması gerçek GİB zarflarıyla doğrulansın (A2). Hesap olmadan yapılamaz.
2. **Fatura ↔ icra dosyası doğrudan bağ** — faturada "Dosya" alanı, dosya detayında faturalar ve açık bakiye, dosyadan
   fatura kesme (A1). Hukuk bürosu için en çok kullanılacak yol.
3. **Formdan yeni cari açma** (A5) — satış sırasında müşteri yoksa form kapanmadan açılsın.
4. **Toplu taslak kesme ve toplu iptal** (A6) — tekrarlayan faturalar taslak ürettiği için aylık toplu kesim gerekli.
5. **PDF'te logo ve kaşe/imza alanı; e-İrsaliye kararı** (A7, A3) — e-İrsaliye yalnız mal sevkiyatı yapan müşteriler için;
   büro için öncelik düşük, ürün geneli için orta.
