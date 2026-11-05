# Muhasebe Çekirdeği — kullanıcı talimatı (AYNEN)

Kaynak: kullanıcı, 05.11.2026 (2.5.0 oturumu), yüklenen .docx "muhasebe çekirdeği — anayasamıza/derslerimize uygun olmalı"; iletisi: "ANAYASAMIZA VE
PROJEMİZE, ÇALIŞMA SİSTEMATİĞİMİZE UYGUNSA BÖYLE BİR PLAN VAR. ZATEN FİNANS ÇEKİRDEĞİ VE YAKLAŞIK 60 RAPOR PROGRAMDA MEVCUT".
Aşağıdaki metin .docx'ten düz metne çevrildi, içerik değiştirilmedi. Bu bir TALİMAT kaynağıdır; uygulama planı ayrı belgede yazılır ve kullanıcı onayından
geçer (anayasa: plan → onay → kâhin → kod). İlgili: docs/erp/ERP-YOL-HARITASI.md (E1, E3, E4), docs/devir/DEVIR-PLANI.md.

---

DESTEKOFİS — TAM GENEL MUHASEBE, MALİ TABLOLAR VE FİNANSAL RAPORLAMA SİSTEMİ

1. GÖREV VE ANA HEDEF

DestekOfis muhasebe/ERP yazılımını, mevcut çalışan finansal mimarisini koruyarak, Türkiye'deki genel muhasebe ihtiyaçlarını karşılayabilecek profesyonel bir mali muhasebe ve raporlama sistemine yükselt.

Bu görev sıfırdan bir muhasebe yazılımı veya yeni bir finans çekirdeği geliştirme görevi değildir.

DestekOfis'te hâlihazırda:

-   Banka modülü ve merkezi finans çekirdeği,

-   Kasa, cari, taksit, fatura, stok ve çek/senet modülleri,

-   POS, banka transferleri, kredi kartı ve kredi işlemleri,

-   Merkezi para hareketleri yönetimi,

-   İşlem numaraları ve ters kayıt mekanizmaları,

-   Yevmiye Defteri, Hesap Planı Mizanı ve Defter Mutabakatı,

-   KDV mahsup işlemleri ve mevcut finansal raporlar

bulunmaktadır.

Bu özelliklerin gerçek kapsamını kaynak koddan doğrula. Kullanım kılavuzu mevcut davranışı anlamak içindir; kodun yerini alan kesin kanıt değildir.

Asıl hedef: Mevcut muhasebe altyapısındaki eksikleri gidererek özellikle bilanço, gelir tablosu, büyük defter, mali analizler ve dönem sonu işlemlerini tamamlamak.

Program yeni özellikler kazandığında eski finansal işlemlerin sonuçları değişmemeli, aynı ticari olay ikinci kez muhasebeleştirilmemeli ve mevcut çalışan sistem yeniden inşa edilmemelidir.

2. ÖNCE MEVCUT MİMARİYİ İNCELE

Kod yazmadan önce bütün ilgili modülleri incele.

Özellikle şunları tespit et:

1.  Merkezi finans çekirdeğinin veri modeli ve kayıt akışı.

2.  Para hareketlerinin hangi ortak noktada kaydedildiği.

3.  Muhasebe fişlerinin mevcut oluşturulma mekanizması.

4.  Yevmiye, mizan, hesap planı ve defter mutabakatının gerçek kapsamı.

5.  Mevcut hesap kodları ve otomatik hesap eşleştirmeleri.

6.  Kasa, banka, cari, fatura, stok, taksit ve çek/senet işlemlerinin muhasebe kayıtlarını nasıl etkilediği.

7.  Finansal işlem numaraları, benzersizlik, idempotency ve ters kayıt altyapısı.

8.  Şirket bazlı veri ayrımı, mali yıl ve dönem/devir altyapısı.

9.  Mevcut rapor altyapısı, PDF/Excel çıktıları ve kullanıcı yetkileri.

10. Mevcut testler, CI sorunları ve veri geçiş riskleri.

Her bileşeni şu sınıflardan birine ayır:

-   Mevcut ve testlerle doğrulanmış.

-   Mevcut fakat eksik veya hatalı.

-   Mevcut fakat doğrulanmamış.

-   Hiç mevcut değil.

Çalışan bir fonksiyonu sırf yeni mimariye uydurmak için yeniden yazma.

İnceleme sonunda kısa bir mimari ve eksik analizi oluştur. Kritik bir engel yoksa güvenli uygulama planıyla işe devam et.

3. DEĞİŞTİRİLMEYECEK TEMEL İLKELER

Merkezi finans çekirdeği korunacak

Yeni genel muhasebe yetenekleri mevcut finansal işlem altyapısıyla bütünleşecek.

İkinci bir banka/kasa motoru, paralel finans hareketleri sistemi veya bağımsız bakiye kaynağı kurulmayacak.

Finans çekirdeğinde gerçekleşmiş para hareketleri ve bunlarla ilişkili mali olaylar, gerektiğinde muhasebe fişlerine dönüşecek.

Ancak bütün muhasebe olayları para hareketi değildir. Vadeli fatura, amortisman, tahakkuk, karşılık ve dönem sonu işlemleri gibi nakit dışı olaylar da muhasebeleştirilmelidir.

Bunlar için mevcut finans çekirdeğini bozmayan, ortak muhasebe defterine güvenli ve izlenebilir kayıt yapan bir mekanizma oluştur veya mevcut olanı genişlet.

Tek ticari olay = tek muhasebesel etki.

Bir fatura, taksit tahsilatı, cari hareketi ve banka işlemi aynı işlemin farklı yansımalarıysa, aynı gelir veya alacak ikinci kez muhasebeleştirilmemelidir.

Finansal güvenlik

-   Para hesaplamalarında kayan nokta kaynaklı yuvarlama hatası oluşmayacak.

-   Mevcut tam sayı kuruş yaklaşımı korunacak.

-   Çok satırlı muhasebe fişleri atomik kaydedilecek.

-   Borç ve alacak toplamı eşit olmayan fiş kesinlikle muhasebeleştirilmeyecek.

-   Hatalı işlemde yarım kayıt bırakılmayacak.

-   Eşzamanlı işlemler ve yeniden denemeler mükerrer fiş oluşturmayacak.

-   Kaydedilmiş muhasebe fişleri iz bırakmadan silinmeyecek veya değiştirilmeyecek.

-   Düzeltmelerde uygun ters kayıt ve yeni fiş mekanizması kullanılacak.

-   Şirketler arasında kayıt, hesap planı ve rapor verileri kesinlikle karışmayacak.

Mevcut işleyen kayıt ve denetim mekanizmalarını kullan; gerekmedikçe yeni bağımlılık, servis veya teknoloji ekleme.

4. TÜRKİYE TEK DÜZEN HESAP PLANI

Mevcut Hesap Planı altyapısını incele ve eksik işlevleri tamamla.

Hedef özellikler:

-   Türkiye Tek Düzen Hesap Planı temeli.

-   Ana hesaplar ve alt hesaplar.

-   Şirket bazlı özelleştirilebilir hesaplar.

-   Aktif/pasif hesap yönetimi.

-   Hesap türleri ve mali tablo sınıflandırmaları.

-   Kasa, banka, POS, cari, stok, vergi ve diğer modüllerle hesap eşleştirmeleri.

-   Hesap bakiyeleri ve hareketlerinin incelenmesi.

-   Hesap açılış bakiyeleri.

-   Hesap kullanımını ve silinmesini güvenli şekilde yönetme.

-   Yetkili kullanıcıların hesap planı düzenleyebilmesi.

Uygulanacak hesap planı ve raporlama sınıflandırmalarını güncel resmî kaynaklar ve mükellef türleri açısından doğrula.

Mevcut hesap kodlarını körü körüne değiştirme. Özellikle geçmişte kullanılan açılış ve karşılık hesaplarının muhasebe açısından doğruluğunu denetle; gerekli düzeltmeleri kontrollü ve izlenebilir şekilde tasarla.

Şüpheli alacaklar, KDV, kredi kartları, krediler, POS komisyonları ve stok maliyetleri gibi işlemler için uygun hesap eşleştirmelerini incele.

Hesap eşleştirmesi kesin olmayan işlemleri rastgele bir hesaba atama. Kullanıcıya açık şekilde bildir ve gerektiğinde muhasebeci onayı iste.

5. YEVMİYE, KEBİR, MİZAN VE MUHASEBE FİŞLERİ

Mevcut yevmiye ve mizan altyapısını tekrar oluşturmak yerine tamamla.

Yevmiye Defteri

Her muhasebe fişinde uygun şekilde:

-   Fiş/yevmiye numarası,

-   Belge ve muhasebe tarihi,

-   Hesap kodları,

-   Borç/alacak tutarları,

-   Açıklama,

-   Kaynak işlem ve belge ilişkisi,

-   Kullanıcı ve işlem geçmişi

bulunsun.

Mevcut belge/işlem numaralarıyla muhasebe fiş numaralarını karıştırma. İlgili numaralandırma ve dönem kurallarını doğrula.

Büyük Defter (Defter-i Kebir)

Her hesap için tarih sıralı hareketler, borç, alacak, dönem açılışı, dönem hareketleri, bakiye ve genel toplamlar gösterilsin.

Ana hesaptan alt hesaplara ve uygun olduğu durumlarda kaynak işlem kartına gidilebilsin.

Mizan

-   Genel mizan.

-   Aylık mizan.

-   Dönemsel mizan.

-   Hesap kırılımlı mizan.

-   Açılış ve kapanış etkilerini dikkate alan raporlar.

Borç ve alacak toplamlarının doğruluğu kontrol edilsin.

Muhasebe Fişleri

Mevcut otomatik fişlerin yanında, yetkili muhasebe kullanıcıları için manuel mahsup ve düzeltme fişleri desteklensin.

Manuel fişler kasa, banka veya cari hareketlerini kendiliğinden değiştirmesin. Operasyonel alt defterlere etkisi gereken işlemler kontrollü iş akışından geçsin.

6. BİLANÇO RAPORU — ANA ÖNCELİK

DestekOfis'e profesyonel bilanço raporu kazandır.

Bilanço mevcut muhasebe defterindeki geçerli ve muhasebeleştirilmiş kayıtlardan üretilecek.

Başlıca gruplar:

AKTİF

-   Dönen varlıklar.

-   Duran varlıklar.

-   İlgili alt hesaplar ve düzeltici hesaplar.

PASİF

-   Kısa vadeli yabancı kaynaklar.

-   Uzun vadeli yabancı kaynaklar.

-   Özkaynaklar.

Rapor şunları desteklesin:

1.  Seçilen tarih itibarıyla bilanço.

2.  Önceki dönemle karşılaştırmalı bilanço.

3.  Ana hesap ve alt hesap detayları.

4.  Hesap hareketlerine kadar izlenebilirlik.

5.  Hesap toplamları ve genel toplamlar.

6.  Aktif/pasif eşitliği kontrolü.

7.  Önceki dönemden devir.

8.  PDF, Excel ve yazdırma.

9.  Yetkilendirme ve şirket bazlı filtreleme.

10. Eksik veya hatalı muhasebe kayıtlarının görünür şekilde raporlanması.

Zorunlu kural:

Toplam Aktif = Toplam Pasif

Ancak yalnızca bu eşitliğin sağlanması bilançonun doğru olduğu anlamına gelmez. Hesap sınıflandırmaları, dönem kârı/zararı, açılış kayıtları ve değerleme işlemleri de doğrulanmalıdır.

Eşitliği sağlamak için hayali denkleştirme kayıtları oluşturma.

Eksik veri varsa geçerli tutarları göster, tamamlanmamış işlemleri açıkça belirt ve raporun kesin/final olup olmadığını kullanıcıya bildir.

7. GELİR TABLOSU — ANA ÖNCELİK

DestekOfis'e dönemsel gelir tablosu ekle.

Raporda uygun işletme ve hesap planı sınıflandırmasına göre:

-   Brüt satışlar.

-   Satış indirimleri ve iadeler.

-   Net satışlar.

-   Satışların maliyeti.

-   Brüt satış kârı/zararı.

-   Faaliyet giderleri.

-   Faaliyet kârı/zararı.

-   Diğer faaliyet gelir ve giderleri.

-   Finansman gelir ve giderleri.

-   Vergi öncesi kâr/zarar.

-   Dönem vergisi ve ilgili karşılıklar.

-   Dönem net kârı/zararı.

yer alsın.

Satış tutarı ile tahsilat tutarını birbirine karıştırma. Vadeli satış, tahsilat yapılmasa da doğru dönemde muhasebeleştirilmeli; tahsilat tekrar gelir yazılmamalıdır.

Stoklu ürünlerin maliyetlerini, stok değerleme ve maliyet hesaplama yöntemleriyle tutarlı biçimde ele al.

Gelir tablosu aylık, üç aylık, yıllık, özel tarih aralıklı ve karşılaştırmalı hazırlanabilsin.

Gerçekleşmemiş gelirler ve giderler tahmini verilerle kesinleşmiş sonuç gibi sunulmasın.

8. DİĞER MALİ RAPORLAR

Mevcut raporlardan yararlanarak uygun olanları genişlet ve eksik olanları ekle:

-   Finansal durum ve mali analiz özeti.

-   Nakit akış tablosu.

-   Özkaynak değişim tablosu.

-   Hesap bazlı ayrıntılı hareket raporu.

-   Gelir-gider karşılaştırma raporu.

-   Dönemler arası karşılaştırmalı mali tablolar.

-   Finansal oran ve analizler.

-   Borç, alacak ve likidite göstergeleri.

Mevcut operasyonel Nakit Akış raporuyla muhasebe esaslı nakit akış tablosunu aynı şey kabul etme.

Resmî mali tablo formatlarına ilişkin gereklilikleri güncel mevzuat ve işletmenin tabi olduğu raporlama çerçevesine göre değerlendir.

Gereksiz veya mevcut verilerle güvenilir üretilemeyecek raporları sahte hesaplamalarla doldurma.

9. MEVCUT MODÜLLERLE MUHASEBE ENTEGRASYONU

Aşağıdaki modüllerin oluşturduğu mali olayları uçtan uca denetle:

-   Kasa ve banka.

-   Cari hesaplar.

-   Alış, satış ve iade faturaları.

-   Stok ve stok maliyetleri.

-   Taksitler.

-   Çek ve senetler.

-   POS tahsilatları, komisyonlar ve valör.

-   Şirket kredi kartları.

-   Banka kredileri ve geri ödemeleri.

-   KDV, stopaj ve diğer vergi işlemleri.

-   Şüpheli alacaklar ve karşılık işlemleri.

-   Açılış bakiyeleri ve yıl sonu devir işlemleri.

Her olay için:

1.  Olayın operasyonel kaynağını belirle.

2.  Muhasebeleştirme zamanını tespit et.

3.  Uygun borç/alacak hesaplarını belirle.

4.  Daha önce muhasebeleştirilip muhasebeleştirilmediğini denetle.

5.  Tek ve tutarlı bir muhasebe fişi üret.

6.  İptal/iade/düzeltmede doğru ters kayıt zincirini uygula.

7.  Ana defter, mizan ve mali tablolardaki etkiyi doğrula.

Banka transferi gelir değildir; müşteriden alınan avans her zaman satış geliri değildir; kredi kullanımı kâr değildir; kredi anapara ödemesi gider değildir; kart borcu ödemesi ikinci kez gider yazılmaz.

Bu ayrımları sistematik muhasebe kurallarıyla güvence altına al.

10. DÖNEM SONU, KAPANIŞ VE DEVİR

Mevcut yıl sonu devir mimarisini incele; varsa onunla bütünleş.

En azından aşağıdaki kabiliyetleri değerlendir:

-   Muhasebe dönemi tanımları.

-   Açılış fişleri.

-   Dönemsel mutabakat.

-   KDV mahsup ilişkileri.

-   Tahakkuk ve karşılık işlemleri.

-   Amortisman ve duran varlık kayıtları.

-   Stok değerleme ve satışların maliyeti.

-   Kur değerlemesi gereken işlemler.

-   Dönem kâr/zarar hesaplaması.

-   Kapanış fişleri.

-   Yeni döneme devir.

-   Kilitlenmiş dönemlerin korunması.

Mevcut dönemselleştirme ve devir altyapısıyla çakışan ikinci bir sistem oluşturma.

Duran varlık, amortisman veya değerleme için yeterli veri yoksa varsayımsal rakam üretme. Gerekli kayıt ekranlarını veya kontrollü manuel muhasebe iş akışını oluştur.

Kapanış, tekrar çalıştırıldığında aynı fişleri ikinci kez oluşturmamalıdır.

Geçmiş döneme düzeltme gerekiyorsa etkileri, yetkileri ve denetim izi açıkça yönetilmelidir.

11. KULLANICI ARAYÜZÜ

Mevcut DestekOfis tasarım dilini koru.

Muhasebe kullanıcılarının kolayca kullanabileceği açık bir Genel Muhasebe alanı oluştur veya mevcut Ana Defter alanını genişlet.

Önerilen erişimler:

-   Hesap Planı.

-   Muhasebe Fişleri.

-   Yevmiye Defteri.

-   Büyük Defter.

-   Mizan.

-   Bilanço.

-   Gelir Tablosu.

-   Mali Analizler.

-   Dönem Sonu İşlemleri.

-   Defter Mutabakatı.

Mevcut ekranları ve rapor menüsünü gereksiz yere kopyalama.

Tüm ekranlarda uygun tarih/dönem seçimi, arama, filtreleme, detay inceleme, PDF ve Excel çıktıları olsun.

Bilançodaki bir hesap kalemine tıklandığında, mümkünse ilgili büyük defter hesap hareketleri gösterilsin. Oradan yetki dâhilinde kaynak fatura, cari veya banka işlemine ulaşılabilsin.

Bu işlevleri yalnızca arayüzde görünüyor diye tamamlanmış kabul etme.

12. ESKİ VERİLERİN KORUNMASI

Eski şirket verileri bozulmayacak.

Geçiş öncesinde ayrı test kopyasında:

-   Eski ve yeni kasa bakiyelerini.

-   Banka hesap bakiyelerini.

-   Cari borç/alacak bakiyelerini.

-   Taksit bakiyelerini.

-   Fatura toplamlarını.

-   Stok miktar ve değerlerini.

-   Mevcut yevmiye ve mizan sonuçlarını.

karşılaştır.

Yeni muhasebe tabloları veya alanları gerekiyorsa güvenli ve sürümlü veri geçişi oluştur.

Geçmiş olayları muhasebeleştirme ihtiyacını ayrıca ele al. Tarihsel verilerde eksik karşı hesaplar varsa bunları tahmin ederek sessizce fiş oluşturma.

Eski verilerden oluşturulacak fişler için kaynak kimlikleriyle mükerrerlik kontrolü, ön izleme, tutarlılık raporu ve güvenli geri alma tasarla.

Gerçek şirket verilerinde geri dönüşsüz toplu değişiklik yapma.

13. PROFESYONEL MUHASEBE TESTLERİ

Her yeni özellik için otomatik ve tekrarlanabilir testler oluştur.

Özellikle şu senaryoları kapsa:

-   Peşin ve vadeli satış.

-   Alış ve satış iadesi.

-   Kısmi tahsilat.

-   Banka transferi.

-   Kasa-banka transferi.

-   POS komisyonu ve valör.

-   Kredi kullanımı ve anapara/faiz ödemesi.

-   Vergi tahakkuku ve ödemesi.

-   KDV mahsup fişi.

-   Stok maliyetleri.

-   Şüpheli alacak karşılıkları.

-   Amortisman ve tahakkuk.

-   Yevmiye ters kayıtları.

-   Muhasebe dönemi kapanışı.

-   Eski verilerin taşınması.

-   Birden fazla şirketin veri izolasyonu.

-   Aynı işleme eşzamanlı iki kaydetme talebi.

-   Programın ve sunucunun beklenmedik kapanması.

Sıfır, negatif, küsuratlı ve yüksek tutarları test et.

Bütün başarılı muhasebe fişlerinde:

Toplam Borç = Toplam Alacak

olduğunu doğrula.

Bilanço, gelir tablosu, yevmiye, kebir ve mizanın aynı muhasebe kayıtlarından üretildiğini kontrol et.

Bağımsız, önceden hesaplanmış beklenen sonuçlarla karşılaştırmalı testler yap. Yalnızca iki raporun kendi aralarında tutarlı olmasını yeterli sayma.

Ayrıca gerçek Windows ortamında, program arayüzünden kullanıcı gibi uçtan uca işlemler gerçekleştir ve sonuçları raporlarda doğrula.

Test verisi gerçek kullanıcı verisinden izole olsun. Gerçek lisans, GİB veya entegratör servislerine test çağrısı yapma.

Windows'taki mevcut test sorunlarını gizleme veya test atlayarak başarı sağlama.

14. GÜVENLİ GELİŞTİRME VE AJAN YÖNETİMİ

İşi uygun alt paketlere böl.

Bağımsız yapılabilecek işleri paralel ajanlarla yürüt; fakat aynı dosyalarda eşzamanlı düzenlemelerden doğacak çakışmaları engelle.

Mimari ve muhasebe kuralları bütün ajanlar için ortak olsun.

Tek ana oturum koordinasyonu sağlasın.

Her alt pakette:

1.  Önce mevcut davranışı ve testleri tespit et.

2.  Gerekli değişikliği minimum kapsamla uygula.

3.  Bağımsız testleri çalıştır.

4.  Kaynak modüllere regresyon testi uygula.

5.  Sonuçları kanıtlarla kaydet.

6.  Entegrasyondan sonra bütünleşik testleri tekrarla.

Ajanların birbirini onaylaması bağımsız test yerine geçmez.

Testleri çalıştırmadan "tamamlandı" deme.

Mevcut Git akışına uy, ilgisiz değişiklikleri silme, zorla üzerine yazma ve temiz olmayan çalışma ağacında kayıp yaratma.

Canlı veriyi etkileyen kritik veri geçişi veya geri dönüşü zor bir işlem gerekiyorsa uygulamadan önce riski ve geri dönüş planını açıkla.

15. TAMAMLANMA KRİTERLERİ

Görev ancak aşağıdaki koşullar doğrulandığında tamamlanmış sayılabilir:

-   Mevcut banka ve finans çekirdeği çalışmaya devam ediyor.

-   Mevcut muhasebe kayıtlarında gereksiz mükerrerlik yok.

-   Otomatik muhasebeleştirme denetlenmiş.

-   Yevmiye, kebir ve mizan tutarlı.

-   Bilanço gerçek hesaplardan üretiliyor.

-   Gelir tablosu gerçek hesaplardan üretiliyor.

-   Finansal dönem ve hesap sınıflandırmaları doğru.

-   Kaynak işlemlere kadar izleme çalışıyor.

-   PDF ve Excel çıktıları ekrandaki sonuçlarla eşleşiyor.

-   Şirket verileri birbirinden bağımsız.

-   Eski verilerin bütünlüğü korunmuş.

-   Windows uygulamasında kritik kullanıcı senaryoları test edilmiş.

-   Test ve CI sonuçları belgelenmiş.

-   Eksik veri, muhasebesel belirsizlik ve henüz uygulanmamış özellikler açıkça belirtilmiş.

Kritik bir doğruluk hatası varsa rapor üretimini hatalı kesin sonuç göstermek yerine güvenli şekilde sınırla.

16. TESLİMAT

Çalışma sonunda aşağıdakileri içeren kanıtlı bir rapor sun:

1.  Önceden mevcut olan ve korunan özellikler.

2.  Geliştirilen yeni özellikler.

3.  Tamamlanan bilanço ve gelir tablosu örnekleri.

4.  Muhasebe fişlerinin örnek kayıt zinciri.

5.  Banka/kasa/cari ve genel muhasebe mutabakat sonuçları.

6.  Testlerin komutları, sonuçları ve geçme/kalma durumu.

7.  Veri geçişlerinin durumu.

8.  Eksik kalan veya muhasebeci doğrulaması gereken hususlar.

9.  Değiştirilen önemli dosyalar ve commit bilgileri.

10. Kullanıcıya yönelik kısa kullanım açıklaması.

Hiçbir özelliği yalnızca kodu yazıldığı için tamamlandı olarak işaretleme.

Son talimat: DestekOfis'i yeniden kurma. Mevcut finans çekirdeğini ve çalışan genel muhasebe altyapısını güçlendir. Öncelikle doğru ve izlenebilir bilanço ile gelir tablosunu çalışır hâle getir; bunların doğruluğu için gereken diğer muhasebe işlevlerini tamamla. Gösterişli fakat muhasebesel olarak hatalı raporlar yerine doğrulanabilir, güvenilir sonuçlar üret.

NOT: DEVİR MODÜLÜ YAPMA PLANIMIZ ZATEN VAR. MUHASEBE ÇEKİRDEĞİ İŞİ İLE BİRLİKTE YÜRÜTEREK YAPMAK DAHA SAĞLIKLI BİR İŞ MODELİ OLACAĞI KANATİNDEYİM.
