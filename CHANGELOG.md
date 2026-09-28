# Değişiklik günlüğü

Sürümler [anlamsal sürümleme](https://semver.org/lang/tr/) kurallarına uyar.

## 2.0.4 — Kurulum dosyasıyla güncelleme, Telefon düğmesi, kolon genişlikleri

- **Kurulum dosyası mevcut sunucunun üstüne çalıştırılınca servis artık başlıyor.** 2.0.0'dan beri: kurulum betiği klasör izinlerini içindeki dosyalara da yazıyor, bu izin dosyalarda geçersiz kalıp dosyayı herkese kapatıyordu. Servis kendi günlüğünü açamayınca hemen duruyordu, kurulum günlüğü de okunamıyordu. İzin artık yalnızca klasöre verilir, dosyalar klasörden miras alır; yeni kurulum dosyası eski kurulumlardaki bozuk izinleri de onarır. Kurulum programı ayrıca servisin gerçekten yanıt verdiğini denetler; vermiyorsa yeniden başlatır, yine olmazsa hatayı gösterir.
- **Telefon düğmesi kayıttaki numarayı gösterir.** Kart detayındaki *Telefon* penceresi tablodaki telefon numaralarını **Ara** ve **WhatsApp** düğmeleriyle listeler; altında yeni numara ekleme formu durur. Önceden yalnızca numara ekleme formu açılıyor, tabloya yazılan numara görünmüyordu.
- **Kolon genişlikleri elle ayarlanır.** Tabloda başlığın sağ kenarındaki tutamaç sürüklenerek her kolon daraltılıp genişletilir; ayar bu bilgisayarda hatırlanır. Tutamaca çift tıklayınca kolon otomatik genişliğe döner. "Sıra" gibi kısa kolonlar için varsayılan en az genişlik düşürüldü.

## 2.0.3 — Ay sütunundaki taksit, kart detayındaki tahsilatla kapanır

- **Ay hücresindeki tutar artık kendiliğinden "ödendi" sayılmaz.** Tabloda ayrı bir *Aylık ücret / aidat* kolonu yoksa ay hücresine yazılan tutar (ör. *Eylül taksiti 10.000*, *Ekim taksiti 10.000*, *Toplam 20.000*) **ödenecek taksittir**. O ay uyarı verir ve kayan şeritte görünür. Ay şu durumlarda kapanır:
  - kart detayında o aya düşen **tahsilat** girildiğinde,
  - hücreye "ödendi", "✓" yazıldığında ya da uyarıdaki **Gerçekleştirildi** ile,
  - tabloda *Ödenen* ya da *Kalan* kolonu varsa ondan (en eski taksitten başlayarak).

  Önceki sürüm bu tutarı ödenmiş sayıyordu; bu yüzden *Eylül taksiti* uyarısı çıkmıyordu.
- **Tahsilat doğru aya sayılır.** Tahsilat notunda ay yazıyorsa ("eylül taksiti", kayan pilden girilen "Eylül ödemesi · Eylül 2026", "Kasım-Aralık 2026") tahsilat o aya sayılır. 28 Eylül'de "ekim taksiti" diye girilen tahsilat Eylül'ü kapatmaz; Ekim gelince Ekim'e sayılır. Notunda ay olmayan tahsilat eskisi gibi en eski açık taksite sayılır.
- *Aylık ücret* kolonu olan tablolar değişmedi: orada ay hücresine yazılan tutar ödenen miktardır, gelecek aya yazılan tutar peşin ödemedir.
- Planda boş bırakılan ay taksit değildir. Plan bittikten sonraki aylar borç sayılmaz.
- Başlıktaki küçük yazım hataları ay kolonu olarak tanınır ("NİSAN TAKSTİ", "Mayıs taksit").
- Aynı anda eklenen belgeler kart detayında ve toplu indirmede eklenme sırasıyla görünür. Önceden aynı milisaniyede eklenenlerin sırası karışabiliyordu.

## 2.0.2 — Açılır listeler, belge kartı, uyarıda "Gerçekleştirildi", tüm kolonlar, kendi sektörü, tarihlerin anlamı, silinenler

- **Ay sütunları (Ocak–Aralık) artık taksit defterine çevrilir; boş dönemler uyarı üretmez.** Yatay ay hücreleri önce her kayıt için bağımsız taksit satırlarına indirgenir (`installments.mjs`). Defterde yalnızca kaydın geçerlilik aralığındaki aylar bulunur: başlangıç = kayıt/başlangıç tarihi kolonu ya da ilk yazılı ay; bitiş = ayrılış/bitiş tarihi kolonu, yoksa son yazılı aydan sonra üst üste **3 tam boş ay** geçmişse kayıt "durgun" sayılır (ayrılan müşteri) ve o ayda kapanır. Girişten önceki ve çıkıştan sonraki boş hücreler için hiçbir taksit açılmaz; aralığın içindeki boş ay ise ödenmemiş taksittir (Ocak ödendi, Şubat boş, Mart ödendi → Şubat gecikmiş). Uyarı motoru ve raporlar yalnız bu defteri sorgular. Durgun kayıtlar sessizce yutulmaz: *Raporlar → Vade takip* içinde "Ödeme kesilmiş olabilir (son: Mart 2026, 5 boş ay)" satırı ve özet kartı olarak görünür; durum süzgecinde **Durgun** seçilebilir.
- **Raporlar (sol menü): dinamik ve esnek raporlama.** Sabit şablon yok. Program bütün oturumlardaki veriyi ortak omurgaya indirger (cari, tutar, kalan/borç, vade, durum, telefon + dosyaya özgü diğer kolonlar) ve üç raporu tek pencerede sunar:
  - **Cari ekstre:** farklı Excel dosyalarından gelen aynı kişi/firma satırları ad (ya da telefon) ile eşlenir (*cross-match*); borç, tahsilat ve yürüyen bakiye tek dökümde; dosyaya özgü kolonlar ("Ürün", "Dosya No"…) kod değişikliği olmadan rapora sütun olarak gelir.
  - **Vade takip:** gecikmiş / bugün / yaklaşan / kapalı; gün farkı; oturum ve sekme adıyla.
  - **Nakit akış:** gün / hafta / ay dilimleriyle beklenen tahsilat, gerçekleşen tahsilat, kasa giriş-çıkışı, net ve birikimli tahmin.

  Filtreler: tarih aralığı, cari, durum, oturum, sekme, en az tutar, dönem. Her rapor **Excel (.xlsx)** ya da **PDF** olarak indirilir ya da **Yazdır** ile doğrudan yazıcıya gider. Raporu görmek için *reports.view* izni gerekir (yönetici ve çalışan rollerinde açık).
- **Drive'a da yedekle.** *Yönetim → Yedekler → Drive'a da yedekle:* Google Drive klasör bağlantısını ya da bilgisayardaki Drive/OneDrive/Dropbox klasörünün yolunu yapıştırın. Program orada **DestekOfis Yedekleri** klasörünü açar; bundan sonra alınan her yedek (6 saatlik, elle, veri değişikliği öncesi) oraya da kopyalanır. Kopya başarısız olsa bile yerel yedek alınır; son kopya ve hata panelde yazar. **Şimdi dene** ile anında sınanır. Bağlantı kipi lisans servisi üzerinden yüklenir (`docs/DRIVE-YEDEK.md`); servis o ucu vermiyorsa masaüstü klasör yolu kullanılır.
- **Excel/Sheets açılır listeleri programda da açılır liste.** Veri doğrulama listeleri okunur: satır içi liste (`"Aktif,Pasif"`), aynı ya da başka sayfadaki aralık, tanımlı ad, Excel 2010+ biçimi (`x14`). Excel'in **birleşik giriş kutuları** da okunur:
  - Form denetimi kutusu: bağlı hücredeki sıra numarası kutuda görünen metne çevrilir.
  - ActiveX kutusu.
  - Eski VML biçimi.

  Listeler kolonlara bağlanır. Detay kartında değer **▾ pil** olarak görünür; tıklanınca liste açılır ve seçim kaydedilir. Hücre düzenleme, *Düzenle* ve *Yeni kayıt* formlarında aynı liste gelir. Listede olmayan eski değer "(listede yok)" diye korunur. Excel'de listeye bağlı olmayan listelerde *Başka bir değer yaz…* seçeneği vardır. Excel'de gizli olup yalnızca listelere kaynaklık eden sayfa programda da gizlenir; *Silinenler*'den geri getirilebilir. Google Sheets'in açılır listeleri eşitlemede güncellenir. Hesaplanan listeler (DOLAYLI) ve kodla doldurulan kutular okunamaz.
- **Belgeler: adet sınırı yok, belge kartı.**
  - Dosyalar üçer üçer paralel yüklenir; dosya başına sınır 25 MB.
  - Birden çok belgede **Yan yana gör** ile belge kartı açılır. Belgeler 1–4 sütun yan yana görünür (tercih hatırlanır). Önizlemeler göründükçe yüklenir.
  - Her belge kendi biçimiyle indirilir; seçilenler tek **.zip** içinde, aynı adlılar "(2)" ekiyle.
  - PDF, resim ve metin belgeleri yeni sekme açmadan **doğrudan yazdırılır**. Birden çok resim tek yazdırma işinde çıkar, PDF'ler sırayla. Word/Excel/UYAP için nedeni yazılır.
  - Belge kartı ✕ ile kapanır. Kartta 6'dan fazla belge varsa *+N belge daha* bağlantısı görünür.
- **Uyarı kartında "Gerçekleştirildi".** İş yapıldıysa tek tıkla kapatılır ve uyarı tekrarlanmaz. Kalem türüne göre:
  - Son tarih ve tarihli taksit: uyarıya sebep olan hücreye *Gerçekleştirildi · 15.10.2026* yazılır, tarih silinmez.
  - Aylık ödeme hücresi: *Gerçekleştirildi* yazılır.
  - Her ay tekrarlayan ödeme günü: ayar hücresine dokunulmaz, yalnız o ayın kalemi kapanır.
  - Görev: tamamlanır.

  Hepsi *Geri al* ile döner; düğme zil listesinde de vardır. Uyarı kartı **20 saniye** görünür ve iki uyarı arasında **10 saniye** boşluk olur. Bir pencere açıkken uyarı gelmez. Kısa bildirimler açık uyarının gerçek yüksekliği kadar yukarıda durur; hiçbir zaman üst üste binmez.
- **Ana tabloda tüm kolonlar.** Önceden ilk 7 kolon gösteriliyordu; artık Excel/Sheets'teki dolu kolonların hepsi görünür.
  - Kolon genişlikleri içeriğe göre ayarlanır.
  - İlk kolon (kaydın adı/numarası) Excel'deki gibi solda sabit kalır.
  - Tablonun altında ekrana yapışan, sürüklenebilen yatay kaydırma çubuğu vardır; oklar bir ekran kaydırır, tekerlek ve klavye de çalışır. Sağda devam varsa kenar solar.
  - Serbest sayfada kolon sınırı 60'tan **500**'e çıktı; akıcılık için toplam hücre en fazla 250.000.
- **Kendi sektörünüz.** Aranan sektör listede yoksa **Kendi sektörünü oluştur** kartı açılır. Alanlar mevcut sektörlerle aynıdır: ad, kayda ne dendiği (çoğul Türkçe ünlü uyumuyla kendiliğinden), uzman rolü, alt başlık, tahsilat/haciz modülleri. İsteğe bağlı tanıtıcı kolon başlıkları sonraki yüklemelerde bu sektörün önerilmesini sağlar. Kartta canlı önizleme vardır. Kaydedince sektör uygulanır ve veri ekranına dönülür. Seçicide ve analiz ekranında her zaman görünür; aranan bulunamazsa arama metniyle önerilir. *Ayarlar → Sektör ve görünüm*'den düzenlenir ya da silinir.
- **Sohbet gün gün.** Açılışta son 24 saatin mesajları gelir. *Önceki günün mesajlarını yükle* her basışta bir gün daha getirir; boş günler atlanır. **30 günden eski mesajlar** veri klasöründe `mesaj-arsivi/<yazışma>/<yıl-ay ay>.txt` dosyasına yazılır (Not Defteri ile açılır), sonra programdan silinir. Önce dosya yazılır, sonra silinir; yarıda kalan tur aynı mesajı ikinci kez yazmaz. Kişi kendi yazışmasının arşivini sohbet penceresinden indirir; özel yazışmayı yalnız iki taraf indirir. Arşivin yeri *Yönetim → Sistem*'de yazar.
- **Tarihlerin anlamı (tüm program).** Tarih kolonunun başlığı ve değerleri birlikte okunur. Sadece ileriye dönük tarihler uyarı verir:
  - Uyarı veren: bitiş, son gün, yenileme, vade.
  - Yalnız yaklaşınca bildirilen: randevu, duruşma, teslim.
  - Asla uyarı vermeyen: kayıt ve olay tarihleri (muayene tarihi, kayıt tarihi, işlem tarihi).

  Türkçe ekler (*-dığı, -acak*) ve sıra sayıları (*1., 2nci, üçüncü*) tanınır. Satır bağlamına da bakılır: durum *tamamlandı/yenilendi/gerçekleştirildi*, *yapıldı mı? evet* ya da aynı konuda daha yeni bir tarih varsa uyarı verilmez. Tek bir geçmiş tarih ödeme planı ya da taksit sayılmaz.
- **Tahsilat takvimi.**
  - Şablonda duran boş satırlar ve öğrencinin başlamadan önceki boş ayları borç sayılmaz. Başlangıç tarihi kolonu ya da ilk dolu ay esas alınır.
  - Ay kolonlarının yılı sıradan çıkarılır.
  - Kalan borcu açıkça 0 olan satırdan tahsilat beklenmez.
- **Silinenler (Yönetim).** Silinen kayıt, sekme, belge, serbest sayfa/satır/kolon, tahsilat ve kasa hareketleri listelenir. **Geri yükle** eski yerine getirir, o arada eklenenlerin üzerine yazmaz. Ad çakışırsa "(geri yüklendi)" eki alır.
- **Sekmeler kalemle yeniden adlandırılır ve silinir.** Excel dosyası ve eşitleme asıl adla çalışır; silinen sekme *Silinenler*'den döner. Belge silme görünür hâle geldi ve geri alınabilir.
- **Sadeleşen ekran.**
  - Sol menüden *Çalışma alanı, Dinamik görünüm, Tüm kayıtlar, Bu ay* ve *Veri kaynağı* başlığı kalktı; menü kaydırılabilir ve kullanıcı kartı hep görünür.
  - Sekme şeridindeki *N kayıt · toplam M* yazısı kalktı.
  - Operasyon Merkezi'nde **Yeni kayıt** sabittir.
  - Kasa'da *Aralık* → **Tarih aralığı**; göstergeler dönemi yazar.
  - Zil listesinde ✕ ile bildirim kişinin listesinden kaldırılır.
- **Kısa kullanım kılavuzu:** 34 sayfadan 8 sayfaya indi; yalnızca bilmeniz gerekenler ve 2.0.2 ekran görüntüleri.
- **Zor Excel/Sheets düzenleri daha doğru okunur.** Kullanıcıların gerçekte gönderdiği türden dosyalarla (17 zor durumluk deneme seti) sınandı:
  - İki satırlı **gruplu başlık** (üstte birleştirilmiş "Kişi bilgileri / Ödeme", altta asıl başlıklar): asıl başlıklar alt satırdan alınır; boş alt başlık grubun adını alır. Üstteki başlık satırları ve uzak kolondaki notlar ("Güncelleme: 12.09.2026") tabloyu bozmaz.
  - **Yan yana iki tablo** aynı sayfada ayrı bölüm olur ("Sayfa1 › Öğrenci", "Sayfa1 › Şoför").
  - **Toplam / ara toplam / genel toplam** satırları ve alttaki **dipnotlar** kayıt sayılmaz; kimlik, KPI, takvim ve kolon tanımaya girmez (formül toplamları korunur).
  - **Birleştirilmiş hücreler:** dikey birleştirme ("Ali Veli" üç dosya satırına yayılmış) her satıra yazılır; kayıtlar kişisiz kalmaz. Excel'de doğrudan, Google Sheets'te xlsx kopyasından okunur.
  - Excel **hata değerleri** (#SAYI/0!, #DIV/0!, #REF!, #YOK…) boş sayılır; kolonun türünü bozmaz, toplama girmez.
  - Tarihler: *10 Mart 2027*, *Mart 2027*, *Sept 2027*, ABD sırası (*03/25/2027*), *5.3.24*; ay kolonu yazımları *Eyl.26*, *Ekim'26*, *2026-11*, *12/2026*.
  - 1–2 satırlık tablolarda tür başlıkla verilir (iki satırlık "Plaka / Muayene bitiş" de tanınır). "Şoför", "Avukat" gibi başlıklarda tek kelimelik adlar kişi sayılır.
  - **İngilizce başlıklar** (Customer, Amount, Due Date, Status, Notes…) tanınır; *Due Date* takvime, *Paid/Closed* kapanışa girer.
  - Tek vadeli tabloda ("Alacak / Son ödeme") tutar borç kolonundan alınır; takvim tutarsız kalmaz.
- **Kurşun geçirmez içeri alma (hedef: Excel okuryazarlığı düşük ofisler).**
  - *Ön izleme ve eşleme:* Excel bırakıldığında veri doğrudan yazılmaz. Önce **Ön izleme ve eşleme** penceresi açılır: program her kolonu ne saydığını (kimlik, kişi, telefon, tutar, son tarih…) ve ne kadar emin olduğunu (kesin / olası / belirsiz) başlıkta yazar; belirsiz kolonlar ve türe uymayan hücreler **sarı** görünür, üzerine gelince neden yazar. Kullanıcı açılır listeden doğru türü seçer (*Son tarih / Vade* seçilen kolon takvime girer, *Yoksay* seçilen uyarı üretmez); seçim oturuma kaydedilir, analiz ve takvim buna uyar. İlk yüklemede de **Yükle**'ye basılmadan hiçbir şey kaydedilmez.
  - *Hata toleransı:* bozuk satırlar (bir hücre eksik girilince yan kolona kaymış; tarih/telefon/tutar hücrelerinin çoğu okunamayan) sistemi durdurmaz: **“⚠ İşaretlenen hatalar”** sekmesine alınır, tabloda sarı görünür, takvim, son tarih uyarıları ve göstergelere girmez; kalan sağlam veriyle iş sürer. Detay kartında neden yazar; düzeltip **Sorun yok** deyince olağan akışa döner (karar, dosya yeniden yüklense de kalır).
  - *Veri temizleme:* Excel'in tarih yerine sayı olarak sakladığı hücreler (45000) tanınır ve toplu düzeltmeyle gerçek tarihe çevrilir — çevrilene kadar o kolondan uyarı üretilmez (yanlış vade uyarısı yok). Hata değerleri (#SAYI/0!, #REF!, #DEĞER!…) boş sayılır. Görünmez karakterler, bozuk Türkçe ve yer tutucular içeri alınırken onarılır.
  - *Ekip çakışma önleme:* aynı hücreyi iki kişi düzenlerse ikincisi uyarılır ("Bu alan siz bakarken değişti — güncel değer: … Üzerine yaz / Vazgeç"); önizleme hazırlanırken veri değiştiyse kaydetme reddedilir ve yeniden yükleme istenir; toplu düzeltmeler veri parmak iziyle korunur. Sunucu tarafında SQLite WAL + 10 sn bekleme + tek işlemli yazımlar; değişiklikler anında tüm ekranlara olayla yayılır.
- **Şemaya esnek uyum (Airtable mantığı).** Dosyadaki kolon adı değişince ("Müvekkil" → "Müvekkil Adı", "Tel" → "Telefon") program eski kolonla eşler: ad benzerliği, yazım düzeltmesi, değerlerin örtüşmesi. Yükleme penceresi eşlemeyi gösterir; kaydedince düzeltmeler, kalemle verilen kolon adları, açılır listeler ve (devamı olarak eklemede) saklı kayıtlar yeni ada taşınır. Veri iki kolona bölünmez, düzeltme kaybolmaz.
- **Veri Sağlık Kontrolü: kırmızı hücreler ve toplu düzeltme.** Biçimi bozuk hücreler tabloda kırmızı işaretlenir; üzerine gelince neden yazar. Veri sağlığı penceresindeki **Toplu düzeltmeler** aynı türden farklı yazılmış hücreleri tek tıkla düzeltir: telefon (5321112233 → 0532 111 22 33), tarih (5.3.2024 → 05.03.2024), ABD yazımlı tutar (1,500.00 → 1.500,00), durum yazımı (aktif/AKTİF → Aktif), fazla boşluk. Excel'deki asıl hücreye dokunulmaz; **Geri al** 15 dakika içinde hepsini döndürür; kaymış satırlar (telefon tarih kolonunda) nokta atışı listelenir.
- **Olay tabanlı uyarı akışı.** Taksit ve son gün uyarıları artık 5 dakikada bir sormak yerine olayla yenilenir: veri değişince ilgili ekranlara olay gider; gün dönümünde sunucu tüm ekranlara "yenile" gönderir; sekme uzun süre arka planda kaldıysa görünür olunca yenilenir. Yedek anket 30 dakikaya çıktı. Sunucuda takvim parmak izine göre önbelleklidir: yerel kaynak yükü günde bir hesap + gerçek değişiklikler kadar.
- **Analiz ayrı iş parçacığında (yerel-önce).** 200.000 satırlık analiz sunucuyu kilitlemez; istekler akmaya devam eder. İş parçacığı düşer ya da 120 sn'de bitmezse hesap ana iş parçacığında tamamlanır — analiz hiçbir durumda gelmez olmaz.
- **Kanıtlı kolon kararları.** Analiz penceresindeki **Neden?** listesi her kolon için kararı, kesinliğini (kesin / olası / belirsiz) ve kanıtlarını gösterir: başlık kelimesi, geçerli değer oranı, ileri tarih oranı, para birimi, tekrar eden değerler. İki tarih kolonundan biri hep ötekinden sonraysa başlığı belirsiz olsa da bitiş/son tarih sayılır (çapraz kolon çıkarımı).
- **Kendi kendini onaran veri akışı.** Bozuk Türkçe karakterler (Ã§ → ç), görünmez boşluklar ve "boş" anlamına gelen işaretler (—, n/a) içeri alınırken onarılır; ne yapıldığı okuma raporunda yazar.
- **Okuma motoru: sayfa şekilleri ve okuma raporu.** Her Excel/Sheets sayfası "üstte başlık, altta kayıt" değildir; program artık dört şekli tanır:
  - **Form** (solda alan adı, sağda değer): tek kayıt olarak okunur.
  - **Yan çevrilmiş sayfa** (alan adları aşağı, kayıtlar sağa doğru): çevrilerek okunur.
  - **Başlıksız tablo** (ilk satır da kayıt): kolon adları içerikten türetilir (*Tarih, Telefon, Tutar, E-posta, Plaka, T.C. Kimlik No, Sıra, Ad Soyad*); hiçbir satır kaybolmaz.
  - **İki satıra bölünmüş başlık** ("Ödeme" / "Tarihi" → *Ödeme Tarihi*) birleştirilir. Tek kolonlu sayfada başlık doğru satırdan alınır. Yalnız rakamdan oluşan başlıklar ("2025") kolon sırasını bozmaz.

  Yükleme penceresinde **okuma raporu** görünür: hücrelerin yüzde kaçı kayda girdi, hangi satırlar neden kayıt sayılmadı (başlık, not, dipnot, grup etiketi, yinelenen başlık, adsız kolon), sayfa hangi şekilde okundu. Kapsam %90'ın altındaysa uyarır. Program emin olmadığını söyler; sessizce yanlış okumaz.
- **Excel'in sayıya çevirdiği telefon/T.C. numaraları** (5.32E+09) tanınır; veri sağlığında nasıl düzeltileceği yazılır.
- **Ayrıştırıcı dayanıklılık sınaması:** yüzlerce rastgele "saçma" düzen (başlık, boş satır, ara toplam, dipnot, çöp hücre, form, yan çevrilmiş, başlıksız) her sürümde otomatik denenir; bulunan üç zayıflık kapatıldı.
- **Durum ve kategori renkleri.** Analizin durum ya da kategori dediği kolonlarda değerler renkli noktayla görünür (tablo ve detay kartı): *ödendi, aktif, tamamlandı* yeşil; *iptal, pasif, gecikmiş* kırmızı; *bekliyor, kısmen* sarı; diğer değerler (ilçe, sınıf, marka) kendi sabit rengini alır. Airtable/monday.com alışkanlığı.
- **Sık / rahat görünüm.** Tablo başlığındaki düğme satır yüksekliğini daraltır (iki kat daha çok kayıt bir ekrana sığar); tercih bu bilgisayarda hatırlanır.
- İleriye dönük mimari ve ürün yol haritası: `docs/YOL-HARITASI-2.1.md` (yaygın programlardan öğrenilenler, UI/UX bulguları, P1–P3 adımlar).
- Sunucu, sahipsiz söz reddini günlüğe yazıp çalışmayı sürdürür; yakalanmamış hatada düzgün kapanır, servis yöneticisi yeniden başlatır.
- İndirilen dosyaların Türkçe harfli adları eski tarayıcılar için doğru karşılığa çevrilir (*kaydı → kaydi*).
- Veritabanı şeması 6 (silinenler tablosu); güncellemede kendiliğinden geçer, öncesinde yedek alınır.

## 2.0.1 — Tahsilat takvimi, bildirimler, Kasa PDF, serbest sayfalar, akıllı denetim, veri oturumları, formüller, Kasa, belgeler, Excel'e aktarma

- **Tahsilat takvimi: her Excel/Sheets'te kayan ödeme pilleri.** Program yüklenen verinin tüm sekmelerinde ödenmesi beklenen kalemleri kendisi bulur; yalnız "Ödeme sözleri" sayfasında değil. Tanıdığı yazımlar:
  - ödeme sözü, taahhüt, vade, son ödeme tarihi kolonları (tarih ve tutar aynı hücrede de olabilir: `15.09.2026 - 5.000 TL`);
  - `1. Taksit Tarihi` / `1. Taksit Tutarı` gibi taksit çiftleri;
  - ay olarak yazılan vadeler (`Eylül 2026`): ayın ilk gününden itibaren beklenir;
  - aylık ücret kolonları (`Eylül`, `Ekim 2026`, `Kasım ödemesi`): boş, `ödenmedi`, `0` ya da ücretten az yazılmışsa (kısmi ödeme) ödenmemiş sayılır;
  - ayın belli günü ödenen kira/aidat (`Ödeme günü: 5`).

  Durum kolonu *Ödendi / Kapandı / İptal* olan satır ve gelecek ayın ücreti beklenmez. Ekranın üstündeki şeritte gecikenler, bugün/bu ay ödenecekler, 7 gün içinde gelecekler ve 30 gün içindeki açık ödeme sözleri kayar; pilin rengi ve etiketi durumu gösterir (*12 gün gecikti*, *Bu ay*, *Yarın*). Pile tıklanınca kişinin beklenen tutarı, kalan borcu ve sekmesi açılır. Kartta şu düğmeler vardır: *Tahsilat gir* (tutar ve açıklama hazır gelir), *Ödendi say*, *Söz iptal*, *Kayda git*. Programda girilen tahsilatlar kişinin kalemlerine vade sırasıyla sayılır; tutar yetmezse kalan görünür, fazlası sonraki kaleme geçer. Tahsilat girilince ya da *Ödendi say* denince pil kaybolur (*Geri al* ile döner). Programda eklenen yeni satırlar ve serbest sayfalar da aynı kuralla izlenir.
- **Sağ alt bildirimler ve zil.** Ekranın sağ altında sırayla bildirim çıkar; her biri 10 saniye durur, üst üste binmez, üzerine gelince bekler. İki tür bildirim vardır:
  - **Tahsilat alınmadı:** Kim, hangi vade ya da ay için, ne kadar (ör. *Mert Çelik · Ağustos ödemesi · Ağustos 2026 · ₺4.500,00*). Ay olarak yazılanlar ayın 1'inden, tarih olarak yazılanlar o günden itibaren bildirilir.
  - **Son günü yaklaşan işler:** Son gün, bitiş, yenileme, muayene, sigorta, kasko, vize, SRC, psikoteknik, ehliyet gibi tarihler 1 hafta önceden; süresi geçen belgeler 30 gün boyunca bildirilir. Kişiye atanmış görevler de bu listededir.

  Tahsilat girilene ya da iş kapanana kadar bildirim **her 3 saatte bir** yinelenir. Bildirimde *Tahsilat gir* ve *Kayda git* düğmeleri vardır. Üst çubuktaki **zil** tüm uyarıları gruplu listeler ve sayısını gösterir. Bildirimler zil listesinden kapatılabilir.
- **Okul servisi sektörü:** Öğrenci, veli, okul, güzergâh, plaka ve aylık ücret kolonları tanınır; görünüm *öğrenci* diline geçer. Araç belgeleri (muayene, sigorta, kasko, güzergâh izni) plakayla, şoför belgeleri (SRC, psikoteknik, ehliyet) şoför adıyla bildirilir. Toplam 143 sektör.
- **Kasa: tarih aralığı ve PDF.** Kasa penceresinde *Bu ay / Geçen ay / Bu yıl / Tümü* yanında **Aralık** seçilir (ör. 01.09.2026 – 25.09.2026). Göstergeler ve liste o aralığa göre hesaplanır; aralık öncesi *Devreden kasa* olarak yazar. **PDF indir** seçili dönemin kasa dökümünü indirir. Dökümde şunlar bulunur:
  - ofis adı, aralık, oluşturma zamanı ve hazırlayan;
  - devreden kasa, dönem tahsilatı, dönem ödemesi ve dönem sonu kasa;
  - her harekette tarih, açıklama, tahsilat, ödeme ve yürüyen kasa bakiyesi;
  - dönem toplamı ve sayfa numaraları.

  PDF sunucuda hazırlanır, Türkçe harfler gömülü yazı tipiyle (Liberation Sans, SIL OFL) her görüntüleyicide doğru çıkar. Metin seçilip aranabilir. İndirme değişiklik geçmişine yazılır.

- **Serbest sayfalar: Excel gibi doldurulan yeni sekmeler.** Sekme şeridinin sonundaki **+ Sayfa** düğmesi, yüklenen Excel/Sheets'in sekmelerinin yanına istenen adla yeni bir sayfa ekler. Açılırken kolon ve satır sayısı ile istenirse kolon başlıkları yazılır. Tek sekmeli veride de şerit bu düğme için görünür.
  - **Yazın ve geçin:** Sayfa açılınca tablonun yerini Excel benzeri bir ızgara alır: kolon harfleri (A, B, C…), başlık satırı ve numaralı satırlar. Hücreye yazmaya başlamak onu doldurur; **Enter** (aşağı), **Tab** (sağa), yön tuşları ya da fareyle başka hücreye geçince değer kendiliğinden kaydedilir. **F2**, çift tık ya da hücredeki kalem (✎) düzeltmeye açar, **Esc** vazgeçer. Başlıklar da aynı biçimde yazılır ve kalemle düzeltilir. Son satırda Enter alta yeni satır açar.
  - **Silme:** Hücredeki ×, başlıktaki × (kolon) ve satır numarasındaki × (satır) siler; **Delete** seçili hücreleri temizler. Değer içeren satırı/kolonu yönetici ve ikinci rol siler; yanlışlıkla eklenen boş satırı/kolonu ekleme yetkisi olan herkes siler. Her silme *Geri al* ile geri alınır.
  - **Ekleme:** *+ Satır* / *+ Kolon* seçili hücrenin altına/sağına ekler, sondaki *+* kolon, *+ Satır ekle* / *+ 10 satır* sona satır ekler. Sağ tık menüsünde üste/alta satır, sola/sağa kolon ekleme, silme, doldurma ve temizleme vardır.
  - **Formüller:** `=` ile başlar; Türkçe (`=TOPLA(B1:B9)`, `=EĞER(D2>1000;"Yüksek";"Normal")`, `;` ayraç, ondalık virgül) ya da İngilizce yazım. Adres kolon harfi + satır numarasıdır (`B1` ilk satır; başlık satırı numaralanmaz), aralık `B1:B9`, kolonun tamamı `B:B`, sabit adres `$B$1`. Formül yazarken hücreye tıklamak adresini ekler, sürüklemek aralık ekler; başvurulan hücreler renkle vurgulanır, işlev adı yazılırken öneri listesi açılır. Üstte ad kutusu ve formül çubuğu vardır. Sonuç girdinin biçimini alır (`37,50 ₺`); tarih döndüren formüller (`=BUGÜN()+30`) tarih, `=YIL(…)` düz sayı olarak görünür. Hata kodları Türkçedir (`#SAYI/0!`, `#DEĞER!`, `#BAŞV!`, `#AD?`, kendine başvuran formülde `#DÖNGÜ!`). Satır/kolon eklenip silinince formüllerdeki adresler Excel'deki gibi kayar.
  - **Σ Alt toplam** sayısal kolonların altına toplam satırı ekler (tarih kolonları toplanmaz). **Σ Yan toplam** her satırın toplamını gösteren *Toplam* kolonu ekler: seçili kolonları, seçim yoksa para kolonlarını toplar; farklı birimler (₺ ile gün sayısı) karışmaz. **↓ Doldur / → Doldur** seçili hücredeki formülü alttaki satırlara / sağdaki kolonlara uygular; elle yazılmış değerlere ve toplam satırına dokunmaz. Bir kolonun satırları aynı formülü taşıyorsa (ör. `Tutar = Adet × Birim fiyat`) yeni satıra da uygulanır.
  - **Kopyala / yapıştır:** Excel'den kopyalanan tablo **Ctrl+V** ile yapıştırılır; gerekirse satır ve kolon eklenir. Programın içinde kopyalanan formülün adresleri yeni yerine göre kayar. Tek değer seçili aralığın tamamına yapıştırılır.
  - **Geri al:** **Ctrl+Z** ya da *↶ Geri al* bu ekranda yapılan son işlemi geri alır: hücre, başlık, satır/kolon ekleme-silme, toplam, doldurma ve yapıştırma. Başka bir kullanıcının sonradan yaptığı değişikliği silecekse geri alma yapılmaz ve nedeni yazılır.
  - **Diğer sekmeler gibi çalışır:** Değer yazılmış her satır bir kayıttır. Seçilince detay kartı açılır; kartın başlığı satırın adıdır (ör. *Kargo*, üstte *MASRAFLAR · 2. SATIR*). Not, telefon, tahsilat, görev, belge, işlem geçmişi, arama, özet kartları, akıllı denetim ve Excel'e aktarma diğer sekmelerdeki gibidir. Detay kartından yapılan düzeltme doğrudan hücreye yazılır; formüllü alanlar kilitlidir, *Yeni kayıt* formu sayfanın ilk boş satırına yazar. Yalnızca kolondan gelen formül taşıyan boş satırlar kayıt sayılmaz.
  - **Ortak çalışma:** Değişiklikler tüm bilgisayarlara anında yansır; iki kişi aynı sayfada farklı hücrelere yazsa da birbirinin değerini ezmez. Ağ bir an koparsa hücre kaydı yeniden denenir; ekranın üstünde *Tüm değişiklikler kaydedildi* / *Kaydediliyor…* yazar.
  - **Sayfa işlemleri:** Sayfanın adı kalemle değiştirilir; ⋯ menüsünden sayfa Excel olarak indirilir ya da silinir (yönetici, ikinci rol; *Geri al* ile hemen geri alınır). **⤢** ızgarayı genişletip detay kartını alta alır. Serbest sayfalar açıldıkları veri oturumuna aittir. Bir sayfada en fazla 2000 satır ve 60 kolon, bir oturumda en fazla 30 serbest sayfa olur.
  - Telefonda ve tablette ilk dokunuş hücreyi seçer, seçili hücreye yeniden dokunmak klavyeyi açar.
- **Akıllı denetim:** Program verinizden kurallar öğrenir ve kurala uymayan kayıtları arka planda bulur; internete bir şey göndermez. Örneğin tablodaki kayıtların çoğunda `Kalan = Tutar − (Taksit 1 + Taksit 2 + …)` tutuyorsa, tutmayan kayıtta doğru değeri önerir ve tek tıkla uygular. Bunların yanında şunları da bulur:
  - "Ödendi" durumunda olduğu hâlde borcu görünen kayıt;
  - bitiş tarihi başlangıçtan önce olan kayıt;
  - yazım hatası gibi duran yıl (2062);
  - fazladan ya da eksik sıfır (215.000 yerine 21.500): doğru değer de önerilir;
  - hep artı olan kolonda eksi değer;
  - satış fiyatı alıştan düşük kayıt;
  - duruma göre boş kalmaması gereken alan ("Kargoda" ama takip no boş);
  - tahsilat penceresinden girilip tabloya yansımamış ödeme: boş taksit alanına yazmayı önerir;
  - borcu aşan tahsilat.

  Bir kural ancak kayıtların büyük çoğunluğunda tutuyorsa öğrenilir; örnek dosyalarda ve rastgele tablolarda yanlış alarm vermez. Seçilen kayıtta bir şey varsa detay kartının üstünde kısa bir kutu çıkar. Kutuda bulgu, *Neden?* açıklaması, öneri ve *Yoksay* yer alır. Tabloda şüpheli satırın başında küçük bir işaret görünür. *Veri sağlığı* raporunda öğrenilen kurallar ve bulgular listelenir. *Yoksay* bulguyu herkes için kapatır; değer değişirse bulgu yeniden değerlendirilir.
- **Kayda belge ekleme:** Detay kartında *Belge* düğmesi ve *Belgeler* bölümü. Eklenebilen türler:
  - PDF;
  - resim (JPG, PNG, WEBP, GIF, TIFF); ekran görüntüsü *Ctrl+V* ile yapıştırılır;
  - Word, Excel, PowerPoint;
  - UYAP (.udf);
  - metin.

  Dosya başına en fazla 25 MB; birden çok dosya bir arada seçilebilir ya da karta sürüklenip bırakılabilir. PDF ve resimler program içinde önizlenir (önceki/sonraki), tüm belgeler indirilebilir. Kişi kendi eklediği belgeyi siler; başkasınınkini yönetici ve ikinci rol siler. Tür yalnızca uzantıdan değil dosyanın içeriğinden de doğrulanır; HTML, SVG ve çalıştırılabilir dosyalar kabul edilmez. Belgeler sunucunun veri klasöründe (`belgeler/`) saklanır, aynı dosya iki kez yer kaplamaz.
- **Dışa aktar → Excel:** Tablonun üstündeki *Dışa aktar* küçük bir menü açar. Seçenekler: açık sekme, tüm sekmeler (her sekme ayrı sayfada) ya da eski CSV. Excel dosyasında tutarlar, tarihler ve yüzdeler hesap yapılabilir gerçek sayılardır ve görünüşleri korunur (`20.000,00 ₺`, `12.03.2026`). Telefon, T.C. kimlik ve dosya no metin olarak kalır. Başlık satırı kalın, sabit ve süzgeçlidir; düzeltmeler ve formül sonuçları dahildir. Dışa aktarma değişiklik geçmişine yazılır.
- **Kolon başlıklarını adlandırma:** Detay kartındaki her başlığın yanındaki kalemle (yalnızca yönetici) Excel/Sheets'ten gelen başlıklar ofise göre adlandırılır (ör. `TKST_1` → *1. Taksit*). Yalnızca görünen ad değişir; kaynak dosya, Sheet eşitlemesi, formüller ve notlar asıl adla çalışır. Adlar tabloda, formlarda, özet kartlarında, aramada ve Excel çıktısında görünür; her oturumda ayrıdır.
- **Detay kartı başlığı:** Kaydın kimliği (ör. `M-102`, `2024/11710`) yerine kişinin ya da kaydın adı büyük başlıkta görünür, kimlik üst satırda yer alır. Tahsilat ve belgeler de bu adla kaydedilir.
- **Telefon ve tablet:** Satır seçilince ekran detay kartına kayar. Tablodaki telefon hücresine ilk dokunuş satırı seçer; WhatsApp yalnızca seçili satırın telefonuna dokununca açılır.

- **Veri oturumları: farklı konudaki tablolar karışmaz.** Yeni bir Excel dosyası ya da Google Sheets bağlantısı yüklenirken artık üç seçenek vardır: **Yeni oturumda aç**, *devamı olarak ekle*, *yerine koy*. Dosyanın kolonları mevcut veriyle az örtüşüyorsa (ör. hukuk dosyalarının yanına taksit listesi) program bunu fark eder ve yeni oturumu önerir. Yeni oturum sunucuda ayrı bir çalışma alanı olarak saklanır; tabloları, düzeltmeleri, uygulamada eklenen kayıtları, tablo başlıkları ve sektörü diğer oturumlardan ayrıdır. Oturumun adını açan kişi belirler; veri yöneticisi adı sonradan değiştirebilir.
- **Oturum seçici:** Sol menünün üstünde açık oturumun adı görünür. Tıklayınca oturumlar kayıt sayılarıyla listelenir, istenen oturuma tek tıkla geçilir. Seçim kişiye özeldir: bir kullanıcının oturum değiştirmesi başka bilgisayarlardaki ekranları değiştirmez. Veri yöneticisi aynı listeden adı kalemle değiştirir, *Yeni oturum aç* ve *Oturumları yönet* bağlantılarını kullanır. *Ayarlar → Veri → Oturumlar* bölümünde oturumlar listelenir, adları değiştirilir, oturumlar silinir. Silmeden önce tam yedek alınır; silinen oturumda çalışanlar ilk oturuma döner. İlk oturum silinmez.
- **Tüm oturumlarda ortak olanlar:** Kullanıcılar ve personel, yetkiler, görevler, mesajlar, notlar, tahsilatlar ve **Kasa**, ofis adı, Operasyon Merkezi düğme adları, yedekler ve lisans. Oturum değiştirmek ya da silmek bunları etkilemez; Kasa tüm oturumlardaki tahsilatları içeren tek kasadır.
- **Operasyon Merkezi düğme adları değiştirilebilir:** Kartın sağ üst köşesindeki kalemle kartın başlığı ve düğmelerin adları (ör. *Kasa* yerine *Vezne*) tek pencerede değiştirilir. Değişiklik tüm bilgisayarlara anında yansır; *Tümünü varsayılana döndür* ile geri alınır. Kalemi yalnızca yönetici görür.

- **Formüller programda çalışmaya devam eder:** Excel veya Google Sheets'teki formüller (ör. `Kalan = Tutar − Taksit 1 − Taksit 2 − …`) veriyle birlikte alınır. Detay kartında boş bir taksit doldurulunca ya da bir tutar düzeltilince, o alana bağlı formüller (Kalan, Durum, toplam satırı…) kendiliğinden yeniden hesaplanır ve sonuç kolonun görünüşüyle yazılır (`7.000,00 ₺`). Hiçbir değer değişmediyse Excel/Sheets'teki değer aynen gösterilir. Formüllü alanların köşesinde **ƒ** işareti vardır (üzerine gelince formül, alan adlarıyla: `=[Tutar]-SUM([Taksit 1]:[Taksit 3])`); *Düzenle* penceresinde bu alanlar kilitlidir. Programda eklenen yeni kayıtta, o sekmedeki satırların ortak formülü uygulanır. Aynı satırdaki, başka satırdaki ve başka sayfadaki hücrelere başvuran formüller, TODAY/NOW (her gün yeniden hesaplanır) ve Excel'in yaygın 100'e yakın işlevi desteklenir: dört işlem, SUM/AVERAGE/MIN/MAX/COUNT, SUMIF(S)/COUNTIF(S)/AVERAGEIF(S), IF/IFS/IFERROR/AND/OR/SWITCH, ROUND ailesi, metin işlevleri, tarih işlevleri (DATE, EDATE, EOMONTH, DATEDIF, NETWORKDAYS…), VLOOKUP/HLOOKUP/INDEX/MATCH/XLOOKUP, PMT. Desteklenmeyen bir işlev (ör. Sheets'e özgü QUERY, IMPORTRANGE) içeren formül hesaplanmaz; son gelen değer kalır ve **ƒ** işareti bunu söyler. Google Sheets'te formüller belgenin xlsx dışa aktarımından okunur; Sheet'in paylaşım izni yeterlidir.
- **Tahsilat düzeltme ve silme:** Detay kartının işlem geçmişindeki tahsilatların yanında ✎ (düzelt) ve × (sil) düğmeleri. Herkes kendi girdiği tahsilatı; kasa yetkisi olanlar (yönetici, ikinci rol, muhasebe) tüm tahsilatları düzeltip silebilir. Eski ve yeni değerler değişiklik geçmişine yazılır.
- **Kasa:** Operasyon Merkezi'nde yeni **Kasa** düğmesi. Güncel kasa, dönemin tahsilat/ödeme/farkı; *Bu ay / Geçen ay / Bu yıl / Tümü*; hareketler eskiden yeniye, her satırda o ana kadarki kasa ve dönem başında devreden kasa. Detay kartından girilen tahsilatlar kasaya kendiliğinden tahsilat olarak düşer; kayda bağlı olmayan tahsilat ve kasadan çıkan ödemeler (kira, fatura, maaş, masraf) kasadan eklenir, düzeltilir, silinir. Kasayı yönetici, ikinci rol ve muhasebe görür.
- **Yeni kayıtlar eskilerin altına:** Detay kartının işlem geçmişi (not, telefon, tahsilat, haciz, görev) eskiden yeniye sıralanır; yeni eklenen en altta görünür. Kasa hareketleri de öyle.
- **Tutar okuma düzeltmesi:** Tahsilat penceresinde "1.250" yazılınca 1,25 ₺ değil 1.250 ₺ kaydedilir (binlik nokta).
- **Kurulum düzeltmesi:** Kurulu bir sunucunun üstüne aynı ya da yeni kurulum dosyası çalıştırıldığında Windows servisi artık yeniden başlatılır (2.0.0'da sessiz yeniden kurulumda servis durmuş kalabiliyordu). Kurulum günlüğüne kurulum türü ve servis sonucu yazılır.
- **Otomatik imzalı yayın:** GitHub'da web arayüzünden açılan yayına da (DESTEKOFIS_RELEASE_KEY tanımlıysa) testler ve gerçek Windows kurulum testi geçtikten sonra imzalı güncelleme paketi, sitenin indirdiği `DestekOfis-Kurulum.exe` ve kullanım kılavuzu kendiliğinden eklenir.

## 2.0.0 — Lisans motoru: ücretsiz deneme, lisans ve salt okunur mod

- **Deneme ve lisans aynı programda, deneme kendiliğinden başlar:** Ayrı kurulum yoktur. 30 günlük ücretsiz deneme program ilk açıldığında **kendiliğinden** başlar (sunucu internete bağlı olmalı; yoksa bağlantı gelince başlar, ayrıca *Yönetim → Lisans → Denemeyi şimdi başlat*) ve **her bilgisayara bir kez** verilir: program kaldırılıp yeniden kurulsa da deneme yeniden başlamaz. Denemenin **3. gününde** yöneticiye firma adı ve iletişim bilgisi sorulur (*Daha sonra* denebilir); bilgiler lisans servisine ve operatör merkezine gider. Lisans alınınca **lisans anahtarı** (`DO-XXXXX-XXXXX-XXXXX-XXXXX`) *Yönetim → Lisans* ekranından girilir ya da operatör panelden tanımlar; deneme kendiliğinden lisanslıya döner, veriler olduğu gibi kalır.
- **Panelden verilen lisans kendiliğinden gelir:** Operatör, operatör merkezinden (destek-ofis.vercel.app/admin) bir bilgisayara lisans tanımladığında program bir sonraki doğrulamada (12 saatte bir veya *Şimdi doğrula* ile) lisansı kendisi alır; müşterinin anahtar yazması gerekmez.
- **Sektörden bağımsız varsayılanlar:** Arayüz paketinin eksik alanlarda ürettiği hukuka özgü metinler ("Borçlu belirtilmemiş", "İcra bilgisi belirtilmemiş", "Gayrimenkul satış dosyası") nötrleştirildi; "İcra aşamasında / Kapanmış" durum süzgeci yalnızca hukuk profilinde görünür; varsayılan alt başlık "Ofis yönetimi".
- **Resimli kullanım kılavuzu programla gelir:** Kurulum sonunda "Kullanım kılavuzunu aç" seçeneği, Başlat menüsünde *Kullanım kılavuzu* (PDF); programda ilk açılış kartında, Operasyon Merkezi'nde ve Yönetim sayfasında kılavuz bağlantısı (`/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf`). Kaynağı `docs/kilavuz/`.
- **Uyarılarda iletişim bilgisi:** Deneme/lisans bitişi, engel ve taşıma uyarılarında ve lisans penceresinde Destek Ofis iletişim kartı (0532 605 05 87 · destekofis@proton.me) görünür.
- **Süre dolunca program durur, veriler kaybolmaz:** Deneme veya lisans süresi dolunca, lisans engellenince ya da doğrulanamayınca program **salt okunur** çalışır: kayıtlar görüntülenir, aranır, dışa aktarılır ve yedeklenir; yeni kayıt, düzeltme, not, tahsilat, görev, mesaj ve veri yükleme yapılamaz, bağlı Google Sheets eşitlenmez. Yönetim paneli (kullanıcılar, yedekler, güncelleme) ve lisans ekranı çalışmaya devam eder. Lisans girilince her şey kaldığı yerden sürer.
- **Lisans servisi ve imza:** Lisans bilgisi lisans servisinden (Faz 4'te Vercel) **imzalı** gelir ve programa gömülü açık anahtarla doğrulanır; elle değiştirilemez, başka bir bilgisayara kopyalanamaz (lisans sunucu bilgisayarın kimliğine bağlıdır). Personel bilgisayarları için ayrıca lisans gerekmez.
- **İnternet kesintisine tolerans:** Sunucu lisansını düzenli aralıklarla doğrular. İnternet kesilirse **7 gün** sorunsuz çalışır; son 3 günde uyarı çıkar; daha uzun sürerse bağlantı gelene kadar salt okunur olur. *Şimdi doğrula* düğmesi beklemeden dener.
- **Saat geri alma koruması:** Sunucunun görülen en ileri tarihi saklanır; bilgisayarın saati geri alınarak süre uzatılamaz. Saat bir günden fazla geri alınırsa program saat düzeltilene kadar durur. Lisans servisine her başarılı bağlantı ve satıcının ürettiği her yeni etkinleştirme kodu imzalı, güvenilir bir zaman getirir; yanlışlıkla ileri alınıp düzeltilen saat de böylece takılı kalmaz, eski kodlarla zaman geri alınamaz.
- **İnternetsiz etkinleştirme:** İnternete çıkamayan ofisler için ekrandaki **kurulum kodu** satıcıya iletilir; satıcının ürettiği etkinleştirme kodu (`DOLIS1.…`) yapıştırılır. Kod yalnızca o bilgisayarda çalışır.
- **Engellenen lisans:** Satıcı bir lisansı engellerse program bir sonraki doğrulamada salt okunur olur ve satıcının mesajını gösterir; engel kaldırılınca *Şimdi doğrula* ile açılır.
- **Mevcut ofisler için geçiş dönemi:** 2.0.0'a güncellenen ve kullanılmakta olan kurulumlar **30 gün** kesintisiz çalışır; ekranda kalan gün yazar. Bu sürede lisans etkinleştirilmelidir.
- **Ekranlar:** Ana ekranın altında lisans şeridi (deneme kalan günü yalnızca yöneticiye; uyarı ve salt okunur durum herkese), salt okunurken açılışta ve yazma denendiğinde açıklayıcı pencere; yönetim panelinde yeni **Lisans** sekmesi (durum, deneme, anahtar, internetsiz kod, kurulum kodu, doğrulama). Lisans olayları değişiklik geçmişinde *Lisans* türüyle listelenir.
- **Operatör araçları:** `tools/lisans-kodu.mjs` (internetsiz kod), `tools/lisans-servisi.mjs` (başvuru lisans servisi ve lisans oluşturma/engelleme/uzatma/taşıma komutları; Faz 4'te Vercel'e taşınacak), `tools/lisans-anahtar-uret.mjs`. Protokol ve işletim: [docs/LISANS.md](docs/LISANS.md).

## 1.7.0 — Doğru analiz, sekme sekme çalışma, belirgin seçili satır

- **Özet kartları yalnızca doğruysa görünür:** Kartlar artık kolon adına ya da çoğunluğa bakarak değil, sekmedeki her hücre tek tek okunarak hesaplanır. Hücrelerin en az %98'i kesin yorumlanamıyorsa kart gösterilmez. Kesin okunamayan birkaç hücre varsa kartta ve açıklamasında yazar.
  - **Durum/tür dağılımı:** Yalnızca birkaç sabit seçenekten oluşan kolonlardan çıkarılır. Aynı anlamı farklı biçimde taşıyan değerler varsa kart gösterilmez: birbirini içeren ("tebliğ" / "her ikisinde tebliğ"), aynı kökten ("Haciz" / "Hacizli"), yazım farklı ("Derdest" / "Derdset"), kısaltma ("E" / "Evet") ya da eş anlamlı ("Beklemede" / "Bekliyor") değerler, tarih ve not karışmış hücreler. Olumsuzluk bir ayrımdır: "Ödendi" / "Ödenmedi", "Tebliğ edildi" / "Tebliğ edilemedi", "İlamlı" / "İlamsız" ayrı seçenektir.
  - **Tutar toplamı:** Kolon gerçekten para bildirmeli ("Kalan gün", "Toplam dosya", "USD kuru" toplanmaz). Sayı yazımı kolondan çıkarılır (1.500 / 1,500), karışıksa toplam gösterilmez. Farklı para birimleri, başlıkla çelişen para birimi, "Toplam" satırları (etiketli ya da diğer satırların toplamına eşit), yüzdeler ve "1.500 TL + faiz" gibi hücreler toplanmaz. "1.500,-" kuruşsuz yazım olarak okunur.
  - **Tarihler:** "12.03.2025 ertelendi" gibi not eklenmiş ya da iki tarihli hücreler kesin sayılmaz; gün/ay sırası belirsiz yazım (03/15/2026) kart vermez. Tarih yerine not yazılmış hücreler ("belli değil") sayılmaz ama hata da sayılmaz.
  - **Bir kayıt birden çok satırda** tutuluyorsa (taraflar alt alta) kartlar kayıt başına sayar.
- **"Nasıl hesaplandı?":** Her kartın penceresinde hangi kolonun, kaç hücrenin, hangi kurallarla sayıldığı ve neyin neden dışarıda kaldığı yazar. **Toplam** kartı sekmenin kart raporunu açar: doğrulanan kartlar ve gösterilmeyen kartların nedenleri, örnek hücrelerle. Durum kartındaki bir seçeneğe tıklayınca o kayıtlar listelenir.
- **"Tümü" sekmesi kaldırıldı:** Farklı kolonlu sekmeler tek tabloya zorlanmaz, boş kolonlar oluşmaz. Her zaman bir sekme açıktır (ilk sekme; sayfa yenilenince en son açılan). Kartlar, veri sağlığı ve yeni kayıt formu açık sekmenin kolonlarıyla çalışır. Kenar çubuğundaki *Tüm kayıtlar* sayısı tüm veridir.
- **Arama tüm sekmelerde:** Arama kutusu dolunca her sekmenin düğmesinde o sekmedeki eşleşme sayısı yazar, eşleşmesi olmayan sekmeler soluklaşır. Enter, açık sekmede sonuç yoksa sonucu olan sekmeye geçer.
- **Yeni kayıt açık sekmeye eklenir** ve eklenince seçilir. Önceki sürümlerde sekmesiz eklenmiş kayıtlar, alanlarının örtüştüğü sekmede; hiçbir sekmeyle ortak alanı olmayanlar *Uygulamada eklenenler* sekmesinde görünür.
- **Seçili satır belirgin:** Tam satır renk, üst/alt çizgi ve satır başında kalın vurgu çizgisi (tablo yana kaydırılmış olsa da görünür). Arama, kart listeleri, veri sağlığı raporu, sohbet ya da ödeme sözü kartından (*Kayda git*) gidilen kayıt kendi sekmesinde açılır, seçilir ve kısa bir süre altın rengiyle parlar.
- **Veri sağlığı daha doğru:** Not yazılmış tarih/tutar/telefon hücreleri hata sayılmaz; iki numaralı ya da yanında not olan telefon ve "(eşi)" notlu T.C. numarası geçerlidir. Bir kaydı birden çok satırda tutan tablo "tekrar eden kimlik" uyarısı vermez.
- *Dışa aktar* açık sekmenin kayıtlarını indirir; dosya adında sekmenin adı yazar.

## 1.6.0 — Verinizi tanıyan DestekOfis

- **Her sektöre uyum:** DestekOfis artık yalnızca hukuk ofisleri için değil. Yüklenen Excel veya Google Sheets sunucuda çözümlenir; veri internete gönderilmez. Kolonların ne taşıdığı bulunur ve doğrulanır: T.C. kimlik no, vergi no ve IBAN kontrol hanesiyle, telefon, tarih ve tutarlar biçimleriyle denetlenir. Ardından önem sırası çıkarılır ve 22 grupta 142 sektörlük listeden sektör önerilir. Öneri kanıtlarıyla ("“BORÇLU” kolonu", "“İCRA DAİRESİ” kolonunda icra dairesi adları") ve güven düzeyiyle gösterilir, **hiçbir zaman kendiliğinden uygulanmaz**. Veri belirgin bir sektöre işaret etmiyorsa sektör atanmaz, *Genel* görünüm önerilir.
- **Sektör seçici:** Öneri yanlışsa doğru sektör listeden seçilir: kelimeyle aranır (birden çok kelime de olur) ya da gruplara ayrılmış liste kaydırılır; klavyeyle de kullanılır. Sektör *Ayarlar → Sektör ve görünüm*'den istendiği zaman değiştirilir, analiz yeniden gösterilir.
- **Sektörün dili ve araçları:** Onaylanan sektöre göre şunlar değişir: kayıtların adı (dosya, hasta, poliçe, sipariş, öğrenci…), kenar çubuğu alt başlığı ve giriş ekranı, ikinci rolün adı (Avukat, Hekim, Emlak danışmanı…) ve araçlar. *Haciz* yalnızca hukuk sektörlerinde, *Tahsilat* ödeme alınan sektörlerde görünür; ofiste o araçla kaydı olan bir araç her sektörde görünmeye devam eder. Yetkiler değişmez.
- **Kalemle başlık değiştirme:** Yönetici sayfa, tablo ve özet başlıkları, açıklamalar ve menü başlıkları gibi 10 başlığı kalem simgesiyle kalıcı olarak değiştirebilir. Değişiklik tüm bilgisayarlara anında yansır ve *Varsayılana dön* ile geri alınır. Diğer kullanıcılar kalemi görmez.
- **Akıllı özet kartları:** Özet başlığının altındaki kartlar yalnızca türü doğrulanmış kolonlardan, kolonun kendi adıyla hesaplanır: toplam kayıt, tutar toplamı, yaklaşan ve geçmiş tarihler, bu ayın kayıtları, durum ve sorumlu dağılımları. Birim fiyatlar ve farklı para birimleri toplanmaz. Kartlar seçili sekmeye göre değişir. Karta tıklayınca ilgili kayıtlar listelenir, seçilen kayıt tabloda açılır. Kenar çubuğundaki **Bu ay** sayısı da gerçek veriden gelir.
- **Veri sağlığı:** Şu sorunlar bulunur ve kayıt listeleriyle gösterilir: boş kimlik veya ad, aynı sekmede tekrar eden kimlik, kontrol hanesi tutmayan T.C./IBAN/vergi no, biçimi tutmayan telefon, tarih ve tutarlar. Kaynak veri değiştirilmez.
- **Kalıcı kayıt kimliği:** Dosya numarası taşımayan verilerde kimlik kolonu (hasta no, sipariş no, plaka, üye no…) kendiliğinden bulunur. Satırın telefonu veya adresi değişse de notlar, görevler ve düzeltmeler kayda bağlı kalır. Aynı kimlikle ikinci bir kayıt eklenemez. Dosya numaralı veride eski kural aynen geçerlidir.
- **Arama kutusu** verideki gerçek kolon adlarını önerir (ör. "Hasta no, ad soyad veya telefon ara…").
- **Büyük tablolar daha hızlı:** Ödeme sözleri şeridi yalnızca gereken hücreleri okur. 40'tan fazla sözde en yakın 40'ı gösterilir; tamamı özet kartındaki listededir. 20 bin satırlık tablo belirgin biçimde daha hızlı açılır, arama ve düzenleme sırasında takılma azalır.
- **Genel adlandırma:** Yeni kurulumlar `C:\DestekOfis` klasörüne kurulur; veritabanının adı `destekofis.sqlite`, yedeklerinki `destekofis-…` olur. Mevcut kurulumlar olduğu yerde, eski adlarla kalır (`C:\HukukOfisiMerkezi`, `hukuk-ofisi.sqlite`); eski yedekler de listelenir ve geri yüklenebilir.
- **Mevcut ofisler:** Güncellenen ve verisi olan sunucular hukuk ofisi görünümüyle açılır. Başlıklar, rol adları ve araçlar aynı kalır; genel ifadeler "dosya" olur (ör. "Tüm dosyalar", "Yeni dosya"). Özet kartları ve veri sağlığı eklenir. Yöneticiye bir kez "Yeni: DestekOfis verinizi tanıyor" kartı çıkar; *Mevcut görünümü koru* denirse hiçbir şey değişmez.

### 1.3'ten güncellenen kurulumlar: 1.4.0 ve 1.5.0'daki yenilikler de bu sürümdedir

- **Sohbet paneli:** Ofis geneli kanalı ve kişiye özel yazışmalar; mesajlar anında gelir, okundu bilgisi gösterilir. Özel yazışmayı yalnızca iki taraf görür.
- **Anlık güncellemeler:** Başka bilgisayarda eklenen not, görev ve düzeltmeler açık ekranlara kendiliğinden yansır; size görev atanınca bildirim çıkar.
- **Veri sunucuda kalıcı:** Yüklenen Excel veya Google Sheets verisi, yönetici kaldırmadıkça ofisin düzeltmeleriyle birlikte korunur. Yeni dosya *devamı olarak ekle* ya da *yerine koy* önizlemesiyle alınır. Bağlı Google Sheets seçilen sıklıkta eşitlenir; Sheet'ten silinen satırlar yönetici karar verene kadar silinmez. Veri yükleme ve kaldırma yalnızca yönetici hesabındadır.
- **Excel ve Sheets okuma:** Hücreler göründüğü gibi okunur (13.10.2025, 40.000,00 TL); alt alta birden çok tablo içeren sekmeler ayrı bölümler olarak tanınır.
- **Yetkiler ve güvenlik:** Görev atama ve performans raporu yalnızca yönetici ve ikinci rolde. İki hesap aynı adı taşıyamaz. Çıkışta veya hesap kapatılınca oturum anında kesilir.
- Güncellemede veritabanı, öncesinde tam yedek alınarak yeni yapıya taşınır. Notlar, görevler, düzeltmeler ve etkin veri kaynağı korunur. Ayrıntılar bu değişiklik günlüğünün 1.4.0 ve 1.5.0 bölümlerindedir.

## 1.5.0 — Kalıcı çalışma verisi

- **Veri artık sunucuda kalıcı:** Yüklenen Excel veya Google Sheets verisi sunucunun veritabanında saklanır ve yönetici kaldırmadıkça korunur; sonradan yapılan düzeltmeler, silmeler, yeni kayıtlar, notlar ve görevlerle birlikte devam eder. Önceden Google Sheets'e ulaşılamadığında tablo boş kalabiliyor, farklı adla yüklenen Excel'de ofisin düzeltmeleri yeni tabloya bağlanmıyordu; ikisi de giderildi.
- **Devamı mı, yerine mi?** Veri varken yeni Excel veya Sheet bağlantısı verilince önce dosya mevcut veriyle karşılaştırılır; "X yeni, Y güncellenecek, Z aynı, W yeni dosyada yok" önizlemesiyle **devamı olarak ekle** (hiçbir şey silinmez, ofisin düzeltmeleri korunur) ya da **yerine koy** (olmayanlar tablodan kalkar; notlar ve geçmiş kalır) seçilir. Her değişiklikten önce tam yedek alınır.
- **Google Sheets bağlı çalışır:** Sheet'teki yeni ve değişen satırlar seçilen sıklıkta kendiliğinden eklenir; Sheet'ten silinen satırlar DestekOfis'ten silinmez, üstü çizili görünür ve yönetici "tut" ya da "kaldır" der. Sheet'in yapısı toptan değişmiş görünürse eşitleme veri çoğalmasın diye durur ve yönetici kararı bekler. İnternet yokken son veriyle çalışılır.
- **Başlangıç kartı:** Veri yokken panelin ortasında "Excelini yükle ya da Google Sheets linkini yapıştır, başlayalım" kartı çıkar; yükleme ve bağlantı yapıştırma doğrudan buradan yapılır. Diğer bilgisayarlar veri gelince kendiliğinden açılır.
- **Yetki:** Veri yükleme, değiştirme ve kaldırma yalnızca yönetici hesabında (avukattan kaldırıldı). Üstteki "Yeni tablo yükle" düğmesi ve "Tabloyu değiştir" bağlantıları kaldırıldı; veri **Ayarlar → Veri ve eşitleme**'den yönetilir (özet, eşitleme sıklığı, şimdi eşitle, içeri alma geçmişi, bağlantıyı/veriyi kaldırma).
- **Excel hücreleri göründüğü gibi okunur:** Tarih hücreleri 13.10.2025 biçiminde gelir (önceden "45943" gibi seri sayı görünüyordu); tutar ve yüzdeler Excel'deki biçimleriyle, Türkçe düzende okunur (40.000,00 TL, 18,5%). CSV dosyalarında Türkçe karakterler (Excel'in Türkçe CSV kodlaması dahil) ve telefonların baştaki sıfırı korunur.
- 1.4.0'daki etkin kaynak (Excel veya Sheet bağlantısı) güncellemede kendiliğinden kalıcı veriye dönüşür; düzeltmeler, silmeler ve uygulamada eklenen kayıtlar yerinde kalır.

## 1.4.0 — Sohbet paneli, alt tablolar ve anlık güncellemeler

- **Sohbet paneli:** "Mesajlar" artık sağdan açılan bir sohbet paneli. *Ofis geneli* kanalı ve kişiye özel yazışmalar; mesajlar sayfa yenilemeden anında gelir, okunmamış sayısı rozette ve sekme başlığında görünür, köşede bildirim ve (kapatılabilir) ses çıkar, *✓ İletildi / ✓✓ Okundu* bilgisi gösterilir. Mesajdaki dosya numarasına tıklayınca o dosya tabloda açılır.
- **Gizlilik:** Özel yazışmayı yalnızca iki taraf görür; yönetici dahil başka kimse okuyamaz. (Eski "Mesajlar" penceresinde herkes herkesin mesajını görüyordu.) Eski mesajlar sohbete taşındı.
- **Anlık güncellemeler:** Başka bilgisayarda eklenen not, telefon, tahsilat, görev ve düzeltmeler açık ekranlara kendiliğinden yansır; size görev atandığında anında bildirim çıkar. Sunucu güncellendiğinde açık ekranlar bunu hemen fark eder. Bağlantı kısa süre koparsa (Wi-Fi, uyku) arada kaçan mesajlar yeniden bağlanınca gelir.
- **Alt tablolar:** Bir Sheets sekmesinde veya Excel sayfasında alt alta birden çok tablo varsa (başlık satırı + kendi kolon başlıkları, ya da grup satırları) her biri ayrı bir bölüm olarak tanınır ve sekmenin içinde kendi kolonlarıyla seçilir; başlık satırları kayıt gibi görünmez. Kurallar sayfaya özgü değildir; emin olunamazsa eski davranış geçerlidir.
- **Google Sheets okuma:** Hücreler ekranda göründüğü gibi okunur. Eski yöntem bir kolondaki farklı türden değerleri (ör. tarih kolonundaki "RPÇY") boş gösterebiliyordu. Tek sekmesinde yaklaşık 100 binden fazla satır olan tablolar artık hatasız okunur.
- **Yetkiler:** Görev atama, herkesin görev listesi ve performans raporu (KPI) yalnızca avukat ve yönetici hesaplarında. Personel ve muhasebe kendilerine atanan görevleri görür ve tamamlar; kısıtlamayı sunucu da uygular (dosya geçmişi ve anlık bildirimler dahil: başkasına atanan görev personele hiçbir yoldan gönderilmez).
- **Ad çakışması koruması:** İki hesap aynı görünen adı taşıyamaz (büyük/küçük harf ve boşluk farkı sayılmaz); personel kendi adını başka birinin adıyla değiştiremez, böylece sohbette veya kayıtlarda başkası gibi görünemez. Görevler kişiye kullanıcı kimliğiyle bağlanır: kişi adını değiştirse de görev onda kalır, boşalan eski adı alan biri o görevi göremez. Mevcut görevler güncellemede adlarıyla eşleştirilerek bağlanır.
- **Oturum güvenliği:** Çıkış yapıldığında, yönetici bir kullanıcının oturumlarını kapattığında veya hesabı pasifleştirdiğinde o kullanıcının canlı bağlantısı anında kesilir ve ekranı birkaç saniye içinde giriş ekranına döner.
- **Sayfalama:** 1 2 3 4 5 6 … › düzeni; sekme, alt tablo veya arama değişince ilk sayfaya dönülür.

## 1.3.3 — Kurulum düzeltmeleri ve ikinci sunucu koruması

- **Yanlış "servis başlatılamadı" uyarısı giderildi.** Sunucu kurulumunun sonunda, servis aslında sorunsuz açılırken de bu uyarı çıkıyordu: Windows servisi ilk açılışta birkaç saniye "başlatılıyor" durumunda kaldığı için başlatma komutu bunu hata sayıyordu. Artık karar sağlık kontrolüne bırakılır; sağlık kontrolü PowerShell yerine paketteki Node.js ile yapılır. Servis "çalışıyor" bildirimini de daha erken verir.
- Servis gerçekten başlatılamazsa hata penceresi nedenini (ör. antivirüs engeli) ve kurulum günlüğünün son satırlarını gösterir.
- Güvenlik duvarı kuralı eklenemezse (başka bir güvenlik yazılımı güvenlik duvarını yönetiyorsa) kurulum yarıda kalmaz: servis çalışır, kullanıcıya hangi portlara izin vermesi gerektiği söylenir.
- **İkinci sunucu koruması:** Kurulum sihirbazı ağda çalışan bir DestekOfis sunucusu bulursa kurulum türü olarak *Personel bilgisayarı*nı seçili getirir ve bulunan sunucuyu gösterir. Yine de *Sunucu bilgisayar* seçilirse, ikinci bir sunucunun ayrı ve boş bir veritabanıyla çalışacağı söylenerek onay istenir. (Gerçek testte personel bilgisayarına yanlışlıkla sunucu kurulmuştu.) Sunucu bilgisayarında yeniden kurulumda tarama yapılmaz.
- Kurulum klasörü zaten varsa (veriler korunduğu için kaldırmadan sonra da kalır) "klasör zaten var" sorusu sorulmaz.
- Yönetici bir kullanıcının parolasını sıfırladığında, hatalı denemeler yüzünden konan 15 dakikalık giriş kilidi hemen kalkar. Kilit iletisi bu seçeneği de söyler.
- Başlatıcıya kurulum sihirbazının kullandığı `-kesfet-dosya` seçeneği eklendi. Windows otomatik testleri, kurulum programının servis doğrulamasının hatasız bittiğini de denetler.
- 1.3.2'deki düzeltmeyi de içerir: güncelleme bitince yönetim paneli kendiliğinden yenilenir, açık dosya takip ekranlarında "DestekOfis … sürümüne güncellendi" şeridi çıkar.

## 1.3.2 — Güncelleme sonrası ekran yenileme

- Güncelleme çok hızlı bittiğinde yönetim panelindeki sürüm, çalışma süresi ve son yedek kutucukları eski bilgiyi göstermeye devam ediyordu. Artık güncelleme bitince yönetim paneli yeni sürümle kendiliğinden yeniden yüklenir.
- Dosya takip ekranı açık olan bilgisayarlar sunucunun güncellendiğini fark eder ve "DestekOfis … sürümüne güncellendi" şeridiyle sayfayı yenilemeyi önerir (yazılmakta olan bir not kaybolmasın diye kendiliğinden yenilemez).

## 1.3.1 — Otomatik güncelleme denemesi

- Otomatik güncelleme zincirini gerçek bir kurulumda sınamak için yayımlanan sürüm: 1.3.0 kurulu sunucular bu sürüme kendiliğinden geçer. İşlevsel bir değişiklik yoktur.
- Yönetim paneli → Sistem → Güncellemeler kartında "1.3.1 sürümüne güncellendi" yazısı görünür.

## 1.3.0 — GitHub'dan otomatik güncelleme (Faz 2)

### Otomatik güncelleme
- Sunucu her açılışta GitHub Releases'ta yeni sürüm olup olmadığına bakar. Varsa uygulama çalışmaya devam ederken arka planda indirilir ve doğrulanır; ardından kısa bir bakım penceresinde ("Sistem güncelleniyor, lütfen 1 dakika sonra tekrar deneyin.") yeni sürüme geçilir. Açık ekranlar sistem hazır olunca kendiliğinden yenilenir.
- Gün içinde kendiliğinden güncelleme yapılmaz. İnternet açılışta henüz hazır değilse ilk 30 dakika içinde birkaç kez yeniden denenir.
- `data` ve `backups` klasörlerine dokunulmaz; geçişten hemen önce veritabanının tam yedeği alınır (`...-guncelleme-oncesi-<sürüm>.sqlite`).
- Yeni sürüm açılamaz veya sağlık kontrolünden geçemezse önceki sürüme kendiliğinden dönülür (gerekirse veritabanı da güncelleme öncesi hâline alınır) ve o sürüm bir daha kendiliğinden denenmez. Geçiş sırasında elektrik kesilirse sonraki açılışta aynı denetim yapılır.

### Güvenlik
- Güncellemeler Ed25519 ile imzalanır; uygulama yalnızca kendine gömülü anahtarla imzalanmış bildirgeleri kabul eder. Paket boyutu ve SHA-256 özeti birebir denetlenir, eski sürüme düşürme yapılmaz, zip içeriği güvenli yollarla açılır.
- Servis hesabı yalnızca `app` klasörüne yazabildiğinden güncellemeler çalışma zamanına (Node.js) ve servis ayarlarına dokunamaz; bunlar yalnızca kurulum dosyasıyla değişir. Daha yeni bir çalışma zamanı gerektiren sürümler için yönetim paneli kurulum dosyasıyla güncellemeyi önerir.

### Yönetim paneli
- **Sistem → Güncellemeler**: kurulu sürüm, son denetim, bulunan yeni sürüm ve sürüm notları; *Güncellemeleri denetle* ve *Şimdi güncelle* düğmeleri, indirme ilerlemesi, son güncellemenin sonucu.
- Açılışta otomatik güncellemeyi kapatma/açma ve **Deneme (beta)** kanalı: ön sürüm olarak yayımlanan sürümler yalnızca beta kanalındaki kurulumlara gider.

### Kurulum ve yayın
- Eski bir kurulum dosyası, otomatik güncellemeyle gelmiş daha yeni sürümü geri almaz; kurulum yalnızca daha yeni veya aynı sürümü etkinleştirir.
- `npm run release` imzalı güncelleme paketini üretir; `v*` etiketiyle GitHub Actions testleri, gerçek Windows'ta kurulum testini ve yayımlamayı kendiliğinden yapar.

## 1.2.0 — Tek tıkla kurulum ve Windows servisi (Faz 1)

### Kurulum
- **DestekOfis-Kurulum.exe** (Inno Setup, Türkçe): *Sunucu bilgisayar* veya *Personel bilgisayarı* seçilir. Node.js çalışma zamanı pakete gömülü; ayrıca bir şey kurmak gerekmiyor. Varsayılan klasör `C:\HukukOfisiMerkezi`.
- Sunucu **DestekOfis Sunucu** Windows servisi olarak çalışır: bilgisayar açılınca oturum açılmadan ve penceresiz başlar, kapanırsa kendiliğinden yeniden başlar. Servis kısıtlı bir sanal hesapla (`NT SERVICE\DestekOfis`) çalışır ve yalnızca kendi veri/yedek/günlük klasörlerine yazabilir.
- Güvenlik duvarına yalnızca Özel/Etki alanı ağları ve yalnızca DestekOfis çalışma zamanı için TCP/UDP 5123 izni eklenir; istenirse ağ profili Özel yapılır.
- Güncelleme kurulumu ve kaldırma `data` ve `backups` klasörlerine dokunmaz. v1.0/v1.1 elle kurulumdan geçişte eski veritabanı olduğu gibi kullanılır; eski zamanlanmış görev ve güvenlik duvarı kuralı temizlenir.

### Sunucu keşfi ve başlatıcı
- Personel bilgisayarlarındaki **DestekOfis** simgesi sunucuyu ağda UDP yayınıyla (`HukukOfisiServerNerede`) kendiliğinden bulur, adresi hatırlar ve DestekOfis'i Edge/Chrome uygulama penceresinde açar. IP adresi değişse de yeniden bulur.

### Servis yöneticisi
- Açılış, yeniden başlatma ve çökme sırasında kullanıcılar kendiliğinden yenilenen markalı bir bakım sayfası görür; uygulama çökerse birkaç saniye içinde yeniden başlatılır.
- Varsayılan parolayla ilk giriş güvenlik için yalnızca sunucu bilgisayarın kendisinden yapılabilir.
- Eski servis günlükleri otomatik temizlenir (son 10 günlük saklanır).
- SSL denetimi yapan antivirüs/güvenlik duvarı olan ağlarda Google Sheets bağlantısı için Windows sertifika deposuna da güvenilir.

### Yönetim paneli
- **Sistem** sekmesinde ofis adı düzenlenebiliyor (giriş ekranında ve ağ keşfinde görünür); personel bilgisayarlarının bağlanabileceği adresler kopyalanabilir biçimde listeleniyor; servis altında çalışma durumu gösteriliyor.

## 1.1.0 — Sağlamlaştırma (Faz 0)

Ürün adı **DestekOfis** oldu. Veritabanı otomatik olarak yükseltilir; yükseltmeden önce `backups/` altına tam yedek alınır.

### Güvenlik
- Ödeme sözü şeridindeki XSS açığı kapatıldı; tüm eklenti arayüzü kaçışlı (escape) çıktı üretir.
- Rol bazlı yetki matrisi sunucuda uygulanıyor (yönetici, avukat, personel, muhasebe). Kayıt silme yönetici/avukat, raporlar yönetici/avukat/muhasebe, veri kaynağı yönetimi yönetici/avukat ile sınırlı.
- Giriş deneme sınırı: aynı kullanıcı adı ve IP için 15 dakikada 5 hatalı denemeden sonra geçici kilit.
- Varsayılan yönetici parolası (`Ofis2026!`) ve yöneticinin verdiği geçici parolalar ilk girişte zorunlu olarak değiştirilir. Parola politikası: en az 10 karakter, harf ve rakam.
- Parola değişince diğer cihazlardaki oturumlar kapanır; pasifleştirilen kullanıcının oturumu hemen düşer.
- Google Sheets okuma ucu artık oturum gerektiriyor.
- Başka siteden gelen değiştirici istekler (CSRF) ve JSON olmayan gövdeler reddediliyor; güvenlik başlıkları ve sıkı içerik güvenlik politikası (CSP) eklendi.
- Statik dosya sunucusunda klasör dışına çıkma açığı ihtimali kapatıldı.
- Excel ayrıştırma yalıtılmış bir Worker'da çalışıyor (SheetJS 0.18.5'in bilinen açıklarına karşı koruma).

### Merkezileşme
- Excel/CSV artık yalnızca yükleyen tarayıcıda kalmıyor: sunucuya kaydedilip ofisin ortak kaynağı oluyor. Aynı adla yeniden yükleme düzeltmeleri koruyarak tabloyu günceller.
- Veri kaynağı, senkron sıklığı ve kolon eşlemesi ofis genelinde tek ayar; her bilgisayarda ayrı ayrı girilmesi gerekmiyor. v1.0.0'daki tarayıcı ayarı ilk yetkili girişte otomatik taşınır.
- Detaydaki "Notu kaydet" notları sunucuda saklanıyor; tarayıcıdaki eski notlar ilk açılışta otomatik aktarılır.
- Hücre düzeltmeleri, silmeler ve yeni kayıtlar sunucuda birleştirilerek tabloya işleniyor; arama, filtre, dışa aktarma ve sayaçlar artık bunları da görüyor.

### Hata düzeltmeleri
- `npm run backup` yanlış klasörü (proje klasörünün bir üstünü) kullanıyordu.
- Yedekler artık `VACUUM INTO` ile tutarlı alınıyor; sunucu açılışında son yedek eskiyse yedek alınıyor (her akşam kapanan sunucularda yedek hiç alınamıyordu).
- "Yeni kayıt" düğmesi olmayan bir uca gidiyordu.
- Mesaj, haciz ve düzeltme kayıtlarında işlemi yapanın adı "undefined" görünüyordu.
- Tamamlanan görev raporu kullanıcı adını değiştirince bozuluyordu.
- Senkron veya düzenleme sonrası seçili dosya ve yazılmakta olan not kayboluyordu.
- Yeni kurulumlarda geliştiricinin Google Sheet bağlantısı varsayılan kaynak olarak açılıyordu.

### Arayüz
- D harfli DestekOfis logosu, yeni giriş ekranı, bildirimler ve erişilebilir pencereler (klavye, odak yönetimi).
- Dosya detayında **işlem geçmişi** (not, telefon, tahsilat, haciz, görev) ve işlemi yapan kişi.
- **Görevler** penceresi (bana atananlar, tüm açık görevler, tamamlama) ve kenar çubuğunda rozetler.
- Satır silme geri alınabilir; hücre düzeltme ve toplu "Düzenle" penceresi; sürüm çakışması uyarısı.
- Yeni kayıt formu tablonun tüm kolonlarından oluşturuluyor.
- Kullanıcı kartı: profil, parola değiştirme, yönetim paneli ve çıkış.
- Yeni yönetim paneli: kullanıcılar (rol, pasifleştirme, parola sıfırlama, oturum kapatma), yedekler (al, indir), değişiklik geçmişi, sistem durumu.
- Yazı tipleri (DM Sans, Manrope) sunucudan geliyor; internet olmadan da aynı görünüm.
- Kullanılmayan ~360 KB Manus çalışma zamanı ve ölü kod kaldırıldı; tek, toplu DOM izleyici ile daha akıcı arayüz.

### Altyapı
- Sunucu modüllere ayrıldı (`server/lib`, `server/routes`), bağımlılıksız yapı korundu.
- Veritabanı şema sürümleme (migration) altyapısı.
- 60+ otomatik test (`npm test`) ve Playwright ile uçtan uca tarayıcı testi (`npm run test:e2e`).
- `npm run package` ile doğrulanmış dağıtım paketi, GitHub Actions CI iş akışı.

## 1.0.0 — Merkezi server/client ilk sürüm
- Node.js + SQLite merkezi sunucu, cookie oturumu, audit kaydı, 6 saatlik yedek.
