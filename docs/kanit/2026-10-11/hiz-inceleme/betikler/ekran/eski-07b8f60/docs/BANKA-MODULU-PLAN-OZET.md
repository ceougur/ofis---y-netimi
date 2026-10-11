# Banka ve POS Modülü: Plan Özeti

Plan aşağıdaki 12 başlıkla hazırlandı (tam metin: `docs/BANKA-MODULU-PLAN.md`). Kararınız gereği ("soracağın hususlarda önerdiğin en yaygın ve modern cevabı uygula") sorulacak konularda önerim uygulandı ve iş Aşama 0 ile başladı. Plana itirazınız olursa ilgili aşama başlamadan güncellenir.

### 1. Mevcut Mimari Analizi
- Program ek kütüphane kullanmadan çalışıyor ve her şirketin ayrı bir veri dosyası var. Banka modülü de yeni teknoloji ya da bağımlılık eklemeyecek.
- Her para kaydı kaydedilmeden önce mutabakat kapısından geçiyor. Banka da aynı kapıya bağlanacak ve şirketler birbirinden ayrı kalacak.

### 2. Mevcut Finansal Sistem Analizi
- Bugün "banka" yalnızca bir ödeme yolunun adı. Programda banka hesabı, POS cihazı, valör, komisyon, ekstre ve döviz kavramları yok.
- Para kayıt, Kasa, cari, fatura, taksit, stok ve çek ekranlarından giriyor, üç ayrı yoldan okunuyor. Kapı bunlardan yalnızca ikisini karşılaştırıyor.
- "Kredi Kartı" iki ayrı işi kapsıyor: müşteriden POS ile tahsilat ve şirket kartıyla ödeme. İkisi de aynı hesaba yazılıyor.

### 3. Banka Modülü Mimarisi
- Para tek yerde tutulur. Tahsilat hangi ekrandan girilirse o kayıt tek para kaydı olur, bir banka hesabına ve bir İşlem No'ya bağlanır. Ayrı kopya tutulmadığı için aynı para iki kez sayılamaz.
- Bütün para işlemleri tek bir merkezden geçer ve ya tamamen yazılır ya hiç yazılmaz, yarım kayıt kalmaz. Mükerrer, eksi bakiye, yetki ve kayıt geçmişi denetimleri de bu merkezde yapılır.
- Masraf, faiz, transfer, döviz alım/satımı ve valör geçişi "Banka Fişi" olarak yazılır. Bu fişler silinerek değil ters kayıtla düzeltilir. Her banka hesabı Ana Defter'de kendi alt hesabını alır (örneğin "102.01 Ziraat · Ana TL").

### 4. POS Mimarisi
- POS ayrı bir satış ekranı değil, bir tahsilat yolu. Cari, fatura, taksit veya stok formunda "POS" seçilince POS, taksit sayısı ve "Bankaya Geçecek" önizlemesi açılır.
- Satış yapıldığında banka bakiyesi değişmez, tutar "POS Bekleyen"e yazılır. Valör günü gelince net tutar bankaya, komisyon gidere kendiliğinden geçer. Hesap iş günlerine ve resmî tatil takvimine göre yapılır; blokeli POS ayrı izlenir.
- Komisyon oranları taksit sayısına göre ve geçerlilik tarihiyle tanımlanır. Aynı gün yapılan iptalden komisyon alınmaz. Kısmi iade dahil POS İadesi yapılabilir, ancak iade tutarı satışı aşamaz.

### 5. Veritabanı Değişiklikleri
- Yalnızca yeni tablolar eklenir: hesaplar, banka fişleri, POS, ekstre, kurlar, tatiller ve planlı işlemler. Bu tablolarda tutarlar tam sayı kuruş olarak saklanır.
- Mevcut tablolara yalnızca "hangi hesap" ve "İşlem No" bağı eklenir. Mevcut hiçbir kayıt değişmez.

### 6. Modüller Arası İlişki Şeması
- Örneğin 25.000 TL'lik havale tahsilatı tek bir işlemdir: cari −25.000, Ziraat +25.000 ve makbuz birlikte yazılır. İşlem Kartı'ndan bağlı cari, fatura, taksit, POS, Kasa ve çek açılabilir.
- Kasa yalnızca nakit tutmaya devam eder. Kasa ile banka arasındaki aktarım iki tarafı tek işlemde yazar ve gelir ya da gider sayılmaz. Ekstre eşleştirmesi ve beklenen tutarlar defteri değiştirmez.

### 7. API Planı
- Banka işlemleri şirkete özel yeni bağlantı noktalarından yapılır. Her kayıt isteği bir kimlik taşır; bağlantı kopup istek yeniden gönderilse bile ikinci kez yazılmaz. Sanal POS ve açık bankacılık için bağlantı yerleri hazırlanır ama kapalı kalır.
- Mevcut cari, fatura, taksit, Kasa, stok ve çek bağlantıları eski kullanımı bozmadan hesap ve POS alanlarıyla genişletilir. Okuma istekleri hiçbir koşulda kayıt yazmaz.

### 8. UI/UX Planı
- Sol menüde Taksitler'in altına "Banka" eklenir. Sekmeler: Genel Bakış, Hesaplar, Hareketler, POS, Ekstre ve Mutabakat, Ayarlar. İlk girişte atlanabilir bir Kurulum Sihirbazı açılır.
- Genel Bakış'ta Gerçek Banka, POS Bekleyen ve Kart ve Kredi Borcu ayrı gösterilir; "Öngörülen Bakiye" formülü ekranda açıkça yazar. Ayarlar iki bölümdür: Temel bölüm standartlar seçili gelir, Gelişmiş bölüm kapalı gelir; her ikisinde "Varsayılanlara Dön" düğmesi vardır. Rapor Merkezi'ne talimattaki 18 rapor ve 4 ek rapor eklenir.

### 9. Güvenlik Planı
- 11 ayrı banka yetkisi tanımlanır. Bugünkü roller karşılıklarını kendiliğinden alır; bugün yapılabilen bir işlem güncellemeden sonra da yapılabilir.
- Bankaya para girişi için bugünkü tahsilat yetkisi yeterlidir. Bankadan çıkış ile bankaya bağlı bir kaydı silmek veya değiştirmek ayrıca banka yetkisi ister. Bütün denetimler sunucuda yapılır, her değişiklik önceki ve yeni değeriyle kaydedilir, kart numarasının yalnızca son 4 hanesi saklanır.

### 10. Veri Migrasyonu
- Veri taşıma gerekli ama yalnızca ekleme yapar. Öncesinde otomatik tam yedek alınır. Mizan, Kasa, cari bakiyeleri ve fatura durumları birebir aynı kalmalı; bu, 2.0.16 ile 2.0.26 arasındaki sürümlerin gerçek verisiyle denenecek.
- Eski havale ve POS hareketleri "Hesabı Atanmamış Eski Hareketler" başlığı altında ayrı görünür. Kurulum Sihirbazı ile bir hesaba aktarılabilir ve bu aktarım geri alınabilir. Kilitli dönemdeki hareketler aktarılamaz.

### 11. Riskler
- Kapsam geniş, çünkü bütün para yolları yeni merkeze taşınıyor. Bu yüzden her aşamada mevcut bütün testler ve eski sürüm verileri yeniden çalıştırılır. Beklenmeyen bir değişiklik görülürse iş durur ve size bildirilir.
- Bazı değişiklikler ekranda görünecek. Hesap tanımlanmamış kurulumda ANLIK DURUM'daki Banka değeri "—" görünür. Personel, kendi girdiği havale tahsilatını artık silemez. İkisi de teslim notunda ve kılavuzda yazılacak.

### 12. Geliştirme Aşamaları
- Her aşamada sıra şöyle: önce "nasıl bozarım" listesi, sonra eski kodda hatayı gösteren test, sonra kod. Ardından arayüzden uçtan uca iş akışı testi ve bağımsız gözden geçirme yapılır; teslim notunda DENENEN, DENENMEYEN ve BİLİNEN SINIRLAR yazılır. Siz "birleştir" demeden hiçbir şey birleştirilmez.
- Talimattaki 37 adımlık kabul testinin beklenen sonuçları sayılarla yazıldı: sonunda Ziraat 96.739,50, Garanti 70.000, POS Bekleyen 11.580 olmalı. Son sürümde bu test baştan sona ekrandan çalıştırılacak.

## Sizin Yerinize Verdiğim Kararlar
- **Eksi bakiye:** Açılış bakiyesi "Bakiye Doğrulandı" olana kadar denetim yapılmaz, sonra uyarı verilir. Kredili mevduat ve kart limitine kadar eksiye düşmek serbesttir. Ayardan değişir: Evet (Engelle veya Kontrol Yok; hesap bazında da ayarlanabilir).
- **Mükerrer kayıt:** Aynı istek kesinlikle ikinci kez yazılmaz. Aynı iş gününde aynı cariye ve aynı hedefe aynı tutarda yeni bir banka, POS veya kart işlemi girilirse "Benzer İşlem" uyarısı çıkar. Ayardan değişir: Evet (uyarı açılıp kapatılabilir).
- **Ödenmiş taksit:** Ödenmiş taksite ikinci tahsilat reddedilir. Kalanı aşan tutar yalnızca yönetici onayıyla avans olarak yazılır. Ayardan değişir: Hayır.
- **POS valörü:** Varsayılan 1 iş günü; tatile denk gelirse bir sonraki iş günü. Valör günü para bankaya kendiliğinden geçer. Ayardan değişir: Evet (POS bazında; ekstreyle ya da elle onay da seçilebilir).
- **POS komisyonunun vergisi:** Banka POS'unda BSMV dahil. Ödeme kuruluşunda KDV hariç ve ay sonunda toplu komisyon faturası taslağı hazırlanır. Ayardan değişir: Evet (POS bazında).
- **İade ve taksitli POS:** İadede komisyon geri alınmaz. Taksitli POS'ta para her ay bir taksit olarak bankaya geçer. Ayardan değişir: Evet (Oransal, Tam, Tek Seferde).
- **Banka masrafı:** BSMV dahil kabul edilir. Gider hesabını masraf türü belirler: banka masrafları 770'e, POS komisyonları 653'e gider. Ayardan değişir: Evet (formda ve Ayarlar'da).
- **Döviz:** Kur TCMB'den otomatik alınır, elle de girilebilir. Dönem sonu değerlemesinde TCMB döviz alış kuru ve ağırlıklı ortalama maliyet kullanılır; ertesi gün ters kayıt kapalı. Ayardan değişir: Evet.
- **Ekstre:** Onayınız olmadan hiçbir eşleştirme yapılmaz. Tarih toleransı ±3 gün; güçlü önerileri otomatik onaylama kapalı. Ayardan değişir: Evet.
- **POS'lu fatura iptali:** İptalde "Müşteriye İade Edildi" mi "Kayıt Hatası" mı olduğu sorulur. Aynı gün yapılan iptalden komisyon alınmaz. Ayardan değişir: Hayır.

## Talimattan Bilinçli Sapmalar
- **Ondalık veri tipi (Ek 1):** Kullandığımız veri tabanında bu tip yok. Yeni banka tablolarında tutarlar tam sayı kuruş olarak saklanır; kesinlik aynıdır. Mevcut modüllerin tutar alanları bu projede değişmez. Kuruş kesinliğini mutabakat kapısı ve 1 kuruştan 1 trilyon TL'ye kadar yapılan bir test güvenceye alır. Tam dönüşüm ayrı bir proje olarak yapılacak.
- **POS komisyonunda %20 KDV (Ek 2):** Bankanın komisyonu ve masrafları KDV'den istisna, BSMV'ye tabi (KDV Kanunu 17/4-e). Bu yüzden bankada varsayılan BSMV. KDV seçeneği her POS'ta ve masraf formunda eksiksiz çalışır; ödeme kuruluşlarında varsayılan zaten KDV.
- **Fiziksel silme yasağı (madde 26):** Banka fişleri silinmez, ters kaydedilir. Ancak mevcut modüllerdeki "Silinenler'e gönder" yöntemi çalışan düzeni bozmamak için korunur. İz yine kaybolmaz: önceki değer ve iptal kaydı saklanır, eşleştirilmiş bir kayıt silinemez.
- **Mükerrer işlemin engellenmesi (madde 9 ve 33):** Aynı istek kesinlikle engellenir. Farklı bir istekle aynı içerik girilirse yalnızca uyarı verilir, çünkü aynı müşteriden aynı gün aynı tutarda iki gerçek tahsilat yapılabilir. Ödenmiş taksitte engel kesindir.
- **Aşama sırası (madde 42):** Döviz, POS ve ekstreden önce ilk teslime alındı; döviz bu iki konuya bağlı değil. Başa bir ön düzeltme aşaması, sona da tutar alanlarının dönüşümü eklendi.

## Banka İşinden Önce Düzeltilecek Mevcut Hatalar (2.0.26)
Her hata önce bugünkü sürümde (2.0.25) hatayı gösteren bir testle kanıtlanacak, sonra düzeltilecek.
- Tablo kaydına girilen tahsilatta tarih, dönem kilidi ve eksi bakiye denetimi yok. Silinip geri yüklenen havale tahsilatı nakde dönüşüyor.
- Taksite Aktar tahsilatın ödeme yolunu kaybettiriyor; havale nakit görünüyor.
- Kilitli dönemde hareketi olan bir cari silinip geri yüklenebiliyor ya da türü değiştirilebiliyor. Bu, kapanmış dönemin mizanını sessizce değiştiriyor.
- Taksit kartı silinirken Kasa'nın eksiye düşüp düşmediğine bakılmıyor; geri yüklerken dönem kilidi sorulmuyor.
- Çek işlemlerinde dönem kilidi denetlenmiyor. Çekin alış veya veriliş tarihi ileri bir tarih olarak girilebiliyor.
- Silinenler'den geri yüklenen cari hareketi eksik bilgiyle dönüyor ve fatura bağı kayboluyor. Kasa'dan geri yüklemede dönem kilidi sorulmuyor.
- Mahsupta kullanılmış bir tahsilat silinmek istendiğinde anlaşılmaz bir genel hata çıkıyor. Bunun yerine "Önce mahsubu kaldırın" denecek.
- Silinenler'e yazma işlemi asıl işlemden ayrı yapılıyor. Elektrik ya da bağlantı kesilirse yarım kayıt kalabilir.
- Tanınmayan bir ödeme yolu ekranlarda farklı davranıyor ve bazı yerlerde sessizce nakit sayılıyor.
- Dönem kilidi varken "Tüm Hareketleri Sil" hata verip çalışmıyor. Bu hata yeniden üretilerek doğrulandı. (Bu madde ilk listede yoktu; aynı ölçüte uyduğu için eklendi.)
- Eski veride ileri tarihli bir kayıt varsa günler geçtikçe mutabakat kapısı devreye giriyor ve program yeniden başlatılana kadar bütün para işlemleri reddediliyor. (Bu madde de ilk listede yoktu; aynı gerekçeyle eklendi.)

## Aşamalar ve Teslim Sırası
1. Plan sunuldu (08.10.2026). İtiraz gelirse ilgili aşama başlamadan güncellenir.
2. **2.0.26:** Yukarıdaki 11 hatanın düzeltmesi. Banka kodu içermez; düzeltmeler mevcut müşterilere de gider.
3. **2.1.0 (Banka İlk Teslim):** Hesaplar ve açılış bakiyesi, banka hareketleri, masraf ve faiz; cari, Kasa, fatura, taksit, stok ve çek bağlantısı; bankalar arası transfer, döviz, çeki bankaya tahsile verme, raporlar ve yetkiler. Kabul testinin 1–16. adımları.
4. **2.2.0:** POS: komisyon, valör, blokeli POS, iade, iptal ve KDV'li komisyon faturası. Kabul testinin 1–28. adımları.
5. **2.3.0:** Ekstre yükleme ve mutabakat; ölçek, arıza ve güvenlik testleri. Kabul testinin 37 adımı baştan sona ekrandan.
6. **Ayrı proje (önerilen sürüm 3.0.0):** Mevcut modüllerin tutar alanlarının tam sayı kuruşa dönüştürülmesi. Banka modülü sahada oturduktan sonra ve sizin kararınızla yapılır.