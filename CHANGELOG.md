# Değişiklik günlüğü

Sürümler [anlamsal sürümleme](https://semver.org/lang/tr/) kurallarına uyar.

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
- **Mevcut ofisler:** Güncellenen ve verisi olan sunucular hukuk ofisi görünümüyle açılır: başlıklar, adlar ve araçlar güncellemeden önceki gibi kalır; yalnızca özet kartları ve veri sağlığı eklenir. Yöneticiye bir kez "Yeni: DestekOfis verinizi tanıyor" kartı çıkar; *Mevcut görünümü koru* denirse hiçbir şey değişmez.

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
