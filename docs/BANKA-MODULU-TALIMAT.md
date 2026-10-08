# BANKA + POS MODÜLÜ — PROFESYONEL FİNANSAL SİSTEM GELİŞTİRME TALİMATI

Mevcut ön muhasebe / işletme yönetim programıma, profesyonel ticari yazılımlarda kullanılabilecek seviyede kapsamlı bir **BANKA + POS + FİNANSAL HAREKET YÖNETİM MODÜLÜ** geliştir.

Bu görev yalnızca bir "Banka" sayfası veya birkaç CRUD ekranı oluşturmak değildir.

Amaç; **Banka, POS, Cari, Fatura, Stok, Kasa, Taksit, Tahsilat, Ödeme ve Raporlama sistemlerini birbirine doğru finansal kurallarla bağlayan merkezi ve tutarlı bir finansal işlem altyapısı** oluşturmaktır.

Sistem hem Türkiye'deki ticari kullanım alışkanlıklarını hem de modern uluslararası ERP/finans yazılımlarındaki genel prensipleri dikkate almalıdır.

---

# 1. EN ÖNEMLİ KURAL: ÖNCE MEVCUT SİSTEMİ ANALİZ ET

Kodlamaya hemen başlama.

Önce mevcut projeyi ayrıntılı olarak incele.

Şunları tespit et:

- Framework
- Frontend mimarisi
- Backend/API yapısı
- Veritabanı yapısı
- Authentication
- Authorization
- Kullanıcı sistemi
- Cari sistemi
- Fatura sistemi
- Stok sistemi
- Kasa sistemi
- Taksit sistemi
- Tahsilat sistemi
- Ödeme sistemi
- Raporlama sistemi
- Mevcut finansal hareket yapısı
- Mevcut bakiye hesaplama yöntemi
- Mevcut component yapısı
- Mevcut servisler
- Mevcut API'ler
- Güvenlik yapısı

Mevcut çalışan hiçbir sistemi gereksiz yere silme veya yeniden yazma.

Mevcut mimaride aynı işlevi yapan bir yapı varsa onu kullan veya güvenli şekilde genişlet.

Gereksiz duplicate tablo, duplicate API veya duplicate finansal kayıt sistemi oluşturma.

Önce mevcut sistem ile yeni banka modülünün nasıl birleşeceğini belirle.

---

# 2. ANA MİMARİ PRENSİP

Banka modülü diğer modüllerden bağımsız çalışan ayrı bir sistem olmamalıdır.

Aşağıdaki yapı birbirine bağlı çalışmalıdır:

```text
                  FİNANSAL İŞLEM MOTORU
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
       CARİ             FATURA             KASA
        │                 │                  │
        └────────────┬────┴───────┬──────────┘
                     │             │
                  TAHSİLAT       ÖDEME
                     │             │
                     └──────┬──────┘
                            │
                    BANKA + POS
                            │
                    TAKSİT / DÖVİZ
                            │
                        RAPORLAR
```

Bir işlem birden fazla modülü etkiliyorsa tek bir merkezi işlem mantığı kullanılmalıdır.

Örneğin 25.000 TL banka tahsilatı:

- Cari hareketi
- Tahsilat kaydı
- Banka hareketi

oluşturabilir.

Fakat bunlar birbirinden bağımsız üç farklı işlem gibi kaydedilmemelidir.

Aralarında ilişki bulunmalıdır.

---

# 3. BANKA HESABI TANIMLAMA

Kullanıcı birden fazla banka hesabı tanımlayabilmelidir.

Banka hesabı tanımlama ekranında en az:

- Banka adı
- Hesap adı
- Hesap türü
- Para birimi
- IBAN
- Hesap numarası
- Şube adı
- Şube kodu
- Açılış bakiyesi
- Açılış tarihi
- Hesap açıklaması
- Aktif/Pasif
- Hesap sahibi
- Hesap kodu

alanları bulunmalıdır.

Hesap türleri örneğin:

- Vadesiz
- Vadeli
- Ticari
- Döviz
- Kredi hesabı
- Diğer

olabilir.

Aynı bankada birden fazla hesap tanımlanabilmelidir.

Örneğin:

Ziraat Bankası
- Ana TL Hesabı
- USD Hesabı
- EUR Hesabı

---

# 4. AÇILIŞ BAKİYESİ

Banka hesabı oluşturulurken kullanıcı mevcut banka bakiyesini girebilmelidir.

Örneğin:

Ziraat Bankası
Ana TL Hesabı

Açılış tarihi:
01.01.2026

Açılış bakiyesi:
250.000 TL

Bu tutar başlangıç finansal hareketi olarak sistemde izlenmelidir.

Sonraki bakiye hesaplamaları manuel olarak değil, finansal hareketlerden oluşturulmalıdır.

Kullanıcı normal işlemler sırasında banka bakiyesini elle değiştirememelidir.

---

# 5. BANKA ANA DASHBOARD

Modern ve profesyonel bir banka dashboard'u oluştur.

Göster:

- Toplam banka bakiyesi
- Banka bazında bakiyeler
- Para birimi bazında bakiyeler
- Bugünkü giriş
- Bugünkü çıkış
- Bu ay giriş
- Bu ay çıkış
- Bekleyen POS tutarı
- Beklenen banka girişleri
- Beklenen banka çıkışları
- Son banka hareketleri
- Bankalar arası transferler
- Banka masrafları
- Nakit akış özeti

Ayrıca:

### GERÇEK BAKİYE

ve

### BEKLENEN / PROJEKSİYON BAKİYE

birbirinden kesinlikle ayrılmalıdır.

Örneğin:

Gerçek banka bakiyesi:
150.000 TL

POS'tan bekleyen:
35.000 TL

Beklenen diğer girişler:
20.000 TL

Beklenen çıkışlar:
15.000 TL

Öngörülen bakiye:
190.000 TL

Bu değerler birbirine karıştırılmamalıdır.

---

# 6. BANKA HAREKETLERİ

Her banka hesabının ayrıntılı hareket ekranı olmalıdır.

Hareketlerde:

- Tarih
- Valör tarihi
- İşlem türü
- Açıklama
- Tutar
- Giriş/Çıkış
- Para birimi
- Banka hesabı
- Cari
- Fatura
- Taksit
- POS
- Kasa
- Referans numarası
- İşlem numarası
- Kullanıcı
- Oluşturulma tarihi
- Durum

alanları desteklenmelidir.

İşlem türleri:

- Para girişi
- Para çıkışı
- Cari tahsilat
- Cari ödeme
- Fatura tahsilatı
- Fatura ödemesi
- Taksit tahsilatı
- Taksit ödemesi
- Bankalar arası transfer
- Kasa transferi
- POS tahsilatı
- POS komisyonu
- Banka masrafı
- Faiz
- İade
- Diğer gelir
- Diğer gider
- Döviz alım/satım
- Açılış bakiyesi

---

# 7. BANKALAR ARASI TRANSFER

Tam kapsamlı banka transfer sistemi oluştur.

Örneğin:

Ziraat → Garanti

20.000 TL

Transfer:

- Kaynak hesap
- Hedef hesap
- Tutar
- Para birimi
- Tarih
- Valör tarihi
- Transfer ücreti
- Açıklama
- Referans
- Durum

alanlarını içermelidir.

Sonuç:

Ziraat:
-20.000 TL

Garanti:
+20.000 TL

Toplam işletme parası değişmemelidir.

Transfer ücreti varsa ayrıca banka gideri olarak işlenmelidir.

Transfer işlemleri tek bir ilişkilendirilmiş finansal işlem olarak tutulmalıdır.

---

# 8. KASA ↔ BANKA TRANSFERİ

Kasa ile banka arasında para transferi yapılabilmelidir.

Kasa → Banka:

Kasa:
-50.000 TL

Banka:
+50.000 TL

Banka → Kasa:

Banka:
-20.000 TL

Kasa:
+20.000 TL

Bu işlemler gelir veya gider olarak değerlendirilmemelidir.

---

# 9. CARİ İLE TAM ENTEGRASYON

Cari tahsilat ve ödemeleri banka hesabına bağla.

Örneğin:

ABC Ltd.
25.000 TL tahsilat

Ödeme yöntemi:
Banka

Banka:
Ziraat

Sonuç:

Cari:
-25.000 TL

Banka:
+25.000 TL

Tahsilat:
+25.000 TL

tek bir ilişkili işlem olarak oluşturulmalıdır.

Aynı işlem ikinci kez yapılmaya çalışılırsa duplicate işlem engellenmelidir.

---

# 10. FATURA İLE ENTEGRASYON

Satış faturası:

20.000 TL

Stok:
-ürün

Cari:
+20.000 TL alacak

Ödeme yapılmadıysa:

Banka:
değişmez.

Ödeme yapıldığında:

Cari:
-20.000 TL

Banka:
+20.000 TL

Fatura ile banka hareketi ilişkilendirilmelidir.

Alış faturasında bunun tersi çalışmalıdır.

---

# 11. TAKSİT ENTEGRASYONU

Taksitli işlemler banka/kasa ile bağlantılı olmalıdır.

Taksit:

10.000 TL

Ödeme yöntemi:
Banka

Banka:
Garanti

Ödeme gerçekleştiğinde:

Taksit:
Ödendi

Cari:
-10.000 TL

Banka:
+10.000 TL

Aynı taksidin ikinci kez tahsil edilmesini engelle.

---

# 12. POS SİSTEMİ

Banka modülünün içinde kapsamlı POS yönetimi oluştur.

POS cihazları banka hesaplarından ayrı ama ilişkili varlıklar olarak modellenmelidir.

Her POS için:

- POS adı
- Banka
- Bağlı banka hesabı
- POS numarası
- Terminal numarası
- POS türü
- Fiziki POS / Sanal POS
- Para birimi
- Komisyon oranı
- Sabit işlem ücreti
- Valör süresi
- Provizyon süresi
- Çalışma durumu
- Açıklama

alanları bulunmalıdır.

---

# 13. POS KOMİSYONLARI

POS tanımlarken komisyon oranı girilebilmelidir.

Örneğin:

Satış:
10.000 TL

Komisyon:
%2,5

Komisyon:
250 TL

Bankaya geçecek net:
9.750 TL

Komisyon oranı POS bazında değişebilmelidir.

---

# 14. TAKSİTLİ POS KOMİSYONLARI

Taksit sayısına göre farklı komisyon oranları tanımlanabilmelidir.

Örneğin:

Tek çekim:
%2

2 taksit:
%3

3 taksit:
%3,5

6 taksit:
%6

9 taksit:
%8

12 taksit:
%10

Bu oranlar örnek amaçlıdır.

Kullanıcı kendi banka/POS koşullarını tanımlayabilmelidir.

---

# 15. POS PROVİZYON / VALÖR SİSTEMİ

POS işlemlerinde para satış yapıldığı anda banka bakiyesine doğrudan eklenmemelidir.

Sistem:

### POS BEKLEYEN

ve

### BANKAYA GEÇEN

tutarları ayırmalıdır.

Örneğin:

POS satış:
10.000 TL

Komisyon:
250 TL

Valör:
2 iş günü

İşlem anında:

Banka:
+0 TL

POS bekleyen:
10.000 TL

2 iş günü sonra:

POS bekleyen:
-10.000 TL

Banka:
+9.750 TL

POS komisyonu:
250 TL

şeklinde çalışmalıdır.

---

# 16. VALÖR / PROVİZYON AYARLARI

POS tanımlarken:

- Aynı gün
- 1 iş günü
- 2 iş günü
- 3 iş günü
- 7 iş günü
- Özel gün

gibi valör seçenekleri desteklenmelidir.

Hafta sonu ve resmi tatil gibi durumlarda ödeme tarihinin nasıl hesaplanacağı mimaride düşünülmelidir.

İş günü hesaplama mantığını ayrı ve genişletilebilir bir servis olarak tasarla.

---

# 17. POS TAHSİLAT TAKVİMİ

Kullanıcı gelecekte bankaya geçmesi beklenen POS tutarlarını görebilmelidir.

Örneğin:

02 Ekim:
9.750 TL

03 Ekim:
12.450 TL

04 Ekim:
7.200 TL

Toplam bekleyen:
29.400 TL

Bu ekran banka nakit akışına bağlanmalıdır.

---

# 18. POS İADELERİ

POS işlem iadesi desteklenmelidir.

İade:

- İlgili POS işlemini bulmalı
- İade tutarını belirtmeli
- İade tarihini kaydetmeli
- Banka etkisini doğru hesaplamalı
- Komisyonun iade edilip edilmediğini desteklemeli
- Cari/fatura ilişkisini korumalı

Kısmi iade de mümkünse desteklenmelidir.

---

# 19. SANAL POS

Mimari ileride sanal POS entegrasyonuna uygun olmalıdır.

Şimdilik gerçek banka API entegrasyonu zorunlu değildir.

Ancak:

- Sanal POS
- Fiziki POS
- Online ödeme
- Ödeme sağlayıcıları
- Banka API'leri

sonradan eklenebilecek şekilde tasarla.

---

# 20. BANKA MASRAFLARI

Banka masraflarını ayrı olarak yönet.

Destekle:

- EFT ücreti
- FAST ücreti
- Havale ücreti
- SWIFT ücreti
- Hesap işletim ücreti
- POS komisyonu
- Sanal POS komisyonu
- Döviz işlem masrafı
- Diğer banka masrafları

Masraf banka bakiyesini ve ilgili gider kayıtlarını doğru şekilde etkilemelidir.

---

# 21. DÖVİZ HESAPLARI

Çoklu para birimini destekle.

En az:

- TRY
- USD
- EUR
- GBP

desteklenmelidir.

Her hesap kendi para biriminde tutulmalıdır.

Döviz işlemlerinde:

- İşlem kuru
- İşlem tutarı
- Karşı para
- Komisyon
- Kur farkı
- Tarih

saklanmalıdır.

Geçmiş işlemlerin tutarlarını güncel kur değişti diye değiştirme.

---

# 22. BANKA EKSTRESİ

Banka ekstresi içe aktarılabilmelidir.

İlk aşamada:

- CSV
- Excel

desteği oluştur.

Gelecekte API entegrasyonuna uygun yapı bırak.

Ekstre hareketleri:

- Eşleşen
- Eşleşmeyen
- Önerilen eşleşme
- Mükerrer
- Manuel eşleştirildi

olarak sınıflandırılabilmelidir.

---

# 23. OTOMATİK / YARI OTOMATİK MUTABAKAT

Banka ekstresindeki:

- Tutar
- Tarih
- Açıklama
- IBAN
- Cari adı
- Referans

bilgilerini kullanarak programdaki hareketlerle eşleşme öner.

Örneğin:

12.500 TL
ABC LTD.

hareketi bulunduğunda:

"ABC Ltd. tahsilatı ile eşleşiyor."

şeklinde öner.

Kullanıcı onayladığında ilişkilendir.

Otomatik eşleştirmeyi güvenli yap.

Yanlış eşleştirmelerde finansal veri bozulmamalıdır.

---

# 24. İLERİ TARİHLİ İŞLEMLER

Sistem ileri tarihli finansal hareketleri desteklemelidir.

Örneğin:

- Planlanan ödeme
- Planlanan tahsilat
- Beklenen POS ödemesi
- Vadeli ödeme
- Banka transferi
- Taksit

gelecek tarihli olabilir.

Ancak gerçekleşmiş bakiye ile planlanan bakiye birbirinden kesinlikle ayrılmalıdır.

---

# 25. NAKİT AKIŞI

Banka modülü nakit akış raporuna veri sağlamalıdır.

Göster:

Mevcut banka:
150.000 TL

Beklenen POS:
35.000 TL

Beklenen tahsilat:
50.000 TL

Beklenen ödeme:
25.000 TL

Planlanan banka transferleri:
10.000 TL

Tahmini nakit:
200.000 TL

Gerçekleşmiş ve planlanan tutarları açıkça ayır.

---

# 26. BANKA HAREKETİ İPTALİ VE DÜZELTME

Finansal kayıtları fiziksel olarak silmek yerine mümkün olduğunca:

- İptal
- Ters kayıt
- Düzeltme
- İade

mantığını kullan.

Geçmiş işlemlerin izini kaybetme.

Audit log tut.

Kim yaptı?

Ne zaman yaptı?

Önceki değer neydi?

Yeni değer ne oldu?

gibi bilgiler mümkün olduğunca kaydedilmelidir.

---

# 27. YETKİLENDİRME

Kullanıcıların finansal yetkileri ayrılabilmelidir.

Örneğin:

- Banka görüntüleme
- Banka hesabı oluşturma
- Banka hareketi oluşturma
- Banka hareketi silme/iptal
- Transfer yapma
- POS ayarlarını değiştirme
- Komisyon değiştirme
- Banka ekstresi aktarma
- Mutabakat yapma
- Rapor görüntüleme

gibi yetkiler ayrı ayrı düşünülebilir.

---

# 28. RAPORLAMA

Banka modülü kapsamlı raporlama sağlamalıdır.

En az:

- Banka bakiye raporu
- Banka hareket raporu
- Günlük banka raporu
- Aylık banka raporu
- Banka bazlı bakiye
- Para birimi bazlı bakiye
- POS satış raporu
- POS komisyon raporu
- POS bekleyen raporu
- POS valör raporu
- Banka masraf raporu
- Bankalar arası transfer raporu
- Kasa-banka transfer raporu
- Cari-banka hareket raporu
- Fatura-banka hareket raporu
- Taksit-banka hareket raporu
- Banka mutabakat raporu
- Nakit akış raporu

oluşturulabilecek yapıda olmalıdır.

---

# 29. ARAMA VE FİLTRELEME

Büyük veri miktarında hızlı çalışmalıdır.

Filtreler:

- Banka
- Hesap
- POS
- Cari
- Fatura
- Taksit
- İşlem türü
- Para birimi
- Tarih
- Valör tarihi
- Tutar
- Giriş/çıkış
- Durum

Arama:

- Cari adı
- Açıklama
- IBAN
- Referans
- İşlem numarası

üzerinden yapılabilmelidir.

---

# 30. VERİTABANI

Mevcut veritabanını incele.

Gerekli yapıları mevcut sistemle uyumlu şekilde oluştur.

Örneğin ihtiyaç halinde:

bank_accounts

bank_transactions

bank_transfers

bank_statement_imports

bank_reconciliation

bank_fees

pos_terminals

pos_transactions

pos_installments

pos_commissions

pos_settlements

financial_transactions

financial_audit_logs

gibi yapılar düşünülebilir.

Ancak bunları körü körüne oluşturma.

Önce mevcut veritabanını incele.

Aynı işi yapan mevcut tablolar varsa yeniden oluşturma.

Finansal hareketlerde veri bütünlüğünü koru.

Gerekli yerlerde database transaction kullan.

---

# 31. TEK MERKEZİ FİNANSAL İŞLEM

En kritik mimari kurallardan biri:

Aynı finansal olay farklı modüllerde bağımsız kayıtlar olarak tutulmamalıdır.

Örneğin:

"25.000 TL banka tahsilatı"

tek finansal olaydır.

Bu olayın:

- Cari hareketi
- Tahsilat kaydı
- Banka hareketi

ilişkili kayıtları olabilir.

Ancak kullanıcı bir işlem yaptığında sistem bunların hepsini kontrollü şekilde oluşturmalıdır.

Bir işlem yarıda kalırsa sistem yarım finansal kayıt bırakmamalıdır.

---

# 32. VERİ TUTARLILIĞI

Aşağıdaki değerler her zaman mantıksal olarak tutarlı olmalıdır:

- Banka bakiyesi
- Kasa bakiyesi
- Cari bakiyesi
- Fatura bakiyesi
- Taksit bakiyesi
- POS bekleyen tutarı
- Gerçekleşmiş tahsilatlar
- Gerçekleşmiş ödemeler
- Planlanan hareketler

Örneğin POS satışı banka hesabına geçmediyse banka bakiyesine eklenmemelidir.

---

# 33. MÜKERRER İŞLEM KORUMASI

Aşağıdaki işlemlerde duplicate kontrolü yap:

- Tahsilat
- Ödeme
- POS satışı
- POS iadesi
- Banka transferi
- Kasa transferi
- Ekstre aktarımı
- Taksit tahsilatı

Aynı finansal işlemin yanlışlıkla iki kez kaydedilmesini engelle.

---

# 34. HATA VE SINIR DURUMLARI

En az aşağıdaki senaryoları test et:

- Yetersiz banka bakiyesi
- Aynı anda iki işlem
- Aynı tahsilatın iki kez yapılması
- Aynı ödemenin iki kez yapılması
- POS işleminin iptali
- POS kısmi iade
- POS valör tarihinin hafta sonuna gelmesi
- Banka tatili
- Yanlış banka hesabı
- Yanlış para birimi
- Bankalar arası transfer iptali
- Kasa transferi iptali
- Fatura iptali
- Cari silme
- Taksit iptali
- Ekstrede mükerrer kayıt
- Yanlış mutabakat
- İnternet bağlantısının işlem sırasında kesilmesi
- Aynı anda birden fazla kullanıcının işlem yapması

Her durumda finansal veri tutarlılığını koru.

---

# 35. UI / UX

Arayüz programımızla uyumlu, modern, sade ve profesyonel olmalı.

Banka ana ekranı:

```text
TOPLAM BANKA BAKİYESİ

BUGÜN GİRİŞ
BUGÜN ÇIKIŞ
POS BEKLEYEN
BEKLENEN GİRİŞ
BEKLENEN ÇIKIŞ

BANKA HESAPLARI

SON BANKA HAREKETLERİ

POS ÖDEME TAKVİMİ

NAKİT AKIŞI
```

gibi bölümler içerebilir.

Ancak gereksiz kart kalabalığı oluşturma.

Kullanıcının önemli finansal bilgiyi hızlı görebileceği bir tasarım oluştur.

Masaüstünde tablo kullan.

Mobilde uygun responsive yapı kullan.

Yatay kaydırmayı mümkün olduğunca önle.

---

# 36. BANKA HESAP DETAY SAYFASI

Örneğin:

Ziraat Bankası
Ana TL Hesabı

Gerçek bakiye:
125.450 TL

Bekleyen:
35.000 TL

Son hareketler:

+25.000 TL
ABC Ltd. Tahsilat

-15.000 TL
XYZ Ltd. Ödeme

-250 TL
Banka Masrafı

gibi göster.

---

# 37. BANKA API / OPEN BANKING HAZIRLIĞI

Şimdilik gerçek banka API bağlantısı kurmak zorunda değilsin.

Ancak mimari gelecekte:

- Open Banking
- Banka API
- Otomatik ekstre
- Otomatik işlem çekme
- Otomatik mutabakat
- Sanal POS
- Fiziki POS entegrasyonu

eklenebilecek şekilde tasarlanmalıdır.

Manuel banka hareketleri ile API'den gelen hareketleri birbirine karıştırma.

---

# 38. TÜRKİYE'YE UYGUNLUK

Türkiye'deki kullanım senaryolarını dikkate al.

Özellikle:

- IBAN
- TL
- FAST
- EFT
- Havale
- POS
- Taksitli POS
- Valör
- Banka komisyonu
- Banka masrafları
- Cari
- Fatura
- KDV ile ilişkili finansal akışlar
- Çek/senet sistemine gelecekte bağlanabilecek yapı

düşünülmelidir.

Çek/senet şu an mevcut değilse sistemi zorla ekleme; ancak ileride entegre edilebilecek mimari bırak.

---

# 39. ULUSLARARASI KULLANIMA UYGUN MİMARİ

Sistem yalnızca tek bir Türk bankasına özel tasarlanmamalıdır.

Bankalar:

- Türkiye
- Avrupa
- ABD
- Diğer ülkeler

gibi farklı yapılara ileride adapte edilebilecek şekilde tasarlanmalıdır.

Ülkeye özgü özellikleri core finans motoruna gömmek yerine mümkün olduğunca ayrı katmanlarda tut.

---

# 40. PERFORMANS

Banka hareketleri zamanla binlerce veya milyonlarca kayda ulaşabilir.

Bu nedenle:

- Pagination
- Server-side filtering
- Server-side sorting
- Uygun database indexleri
- Gereksiz sorguların önlenmesi
- N+1 sorgu probleminin önlenmesi
- Cache gereken yerlerde kontrollü cache
- Ağır raporların optimize edilmesi

düşünülmelidir.

Her banka hareketini frontend'e getirip browser üzerinde filtreleme yapma.

---

# 41. GÜVENLİK

Finansal veriler kritik olduğundan:

- Server-side validation
- Authorization
- Kullanıcı bazlı yetkilendirme
- Database güvenliği
- Audit log
- Transaction kullanımı
- Duplicate protection
- Input validation
- Hassas verilerin korunması

uygulanmalıdır.

Frontend'deki kontroller güvenlik olarak kabul edilmemelidir.

---

# 42. GELİŞTİRME SÜRECİ

Bu projeyi tek seferde kontrolsüz şekilde değiştirme.

Aşamalı geliştir:

### Aşama 1
Mevcut mimari analizi.

### Aşama 2
Finansal işlem mimarisi.

### Aşama 3
Banka hesapları.

### Aşama 4
Banka hareketleri.

### Aşama 5
Cari entegrasyonu.

### Aşama 6
Kasa entegrasyonu.

### Aşama 7
Fatura entegrasyonu.

### Aşama 8
Taksit entegrasyonu.

### Aşama 9
Bankalar arası transfer.

### Aşama 10
POS sistemi.

### Aşama 11
POS komisyon/valör/provizyon sistemi.

### Aşama 12
Banka ekstresi ve mutabakat.

### Aşama 13
Döviz sistemi.

### Aşama 14
Raporlama.

### Aşama 15
Yetkilendirme ve audit.

### Aşama 16
Performans ve güvenlik optimizasyonu.

Her aşamada mevcut sistemi test et.

---

# 43. KABUL TESTİ

Modül tamamlandığında aşağıdaki senaryoyu baştan sona çalıştır:

1. Ziraat TL hesabı oluştur.
2. Açılış bakiyesi 100.000 TL gir.
3. Garanti TL hesabı oluştur.
4. Açılış bakiyesi 50.000 TL gir.
5. ABC Ltd. cari oluştur.
6. 20.000 TL satış faturası oluştur.
7. Stok miktarının değiştiğini doğrula.
8. Cari bakiyesini doğrula.
9. 20.000 TL tahsilat yap.
10. Ziraat bankasını seç.
11. Banka bakiyesinin 120.000 TL olduğunu doğrula.
12. Cari bakiyesini doğrula.
13. 10.000 TL bankadan kasaya aktar.
14. Banka ve kasa bakiyelerini doğrula.
15. Ziraat'ten Garanti'ye 20.000 TL transfer yap.
16. İki banka bakiyesini doğrula.
17. Bir POS tanımla.
18. Komisyon oranı belirle.
19. Valör süresi belirle.
20. 10.000 TL POS satışı oluştur.
21. Banka bakiyesinin satış anında artmadığını doğrula.
22. POS bekleyen tutarını doğrula.
23. Valör tarihi geldiğinde net tutarın bankaya geçtiğini doğrula.
24. Komisyonun doğru hesaplandığını doğrula.
25. Taksitli POS işlemi oluştur.
26. Taksit bazında beklenen tahsilatları doğrula.
27. POS iadesi oluştur.
28. Banka/POS/cari/fatura ilişkisini doğrula.
29. Banka ekstresi aktar.
30. Mutabakat ekranında eşleşme önerisini doğrula.
31. Eşleştirmeyi onayla.
32. Banka raporunu oluştur.
33. Nakit akış raporunu kontrol et.
34. İşlem iptal senaryolarını test et.
35. Aynı işlemin iki kez oluşturulmasını dene.
36. Yetkisiz kullanıcının finansal işlem yapmasını dene.
37. Aynı anda iki işlem yaparak veri tutarlılığını test et.

Tüm testlerde:

**Banka + POS + Cari + Fatura + Stok + Kasa + Taksit + Tahsilat + Raporlama**

arasında tutarsızlık oluşmamalıdır.

---

# 44. TASARIM İLKESİ

Sadece güzel görünen bir UI üretme.

Sadece CRUD ekranları oluşturma.

Sadece banka tablosu oluşturup işlemleri oraya yazma.

**Gerçek bir finansal işlem sistemi tasarla.**

Her işlemin:

- Kaynağı
- Hedefi
- Tutarı
- Para birimi
- Tarihi
- Valör tarihi
- Durumu
- İlişkili cari
- İlişkili fatura
- İlişkili taksit
- İlişkili banka
- İlişkili POS
- İlişkili kasa
- İşlem numarası
- Audit bilgisi

gerektiğinde izlenebilir olmalıdır.

---

# 45. SON VE EN ÖNEMLİ TALİMAT

Kodlamaya başlamadan önce mevcut projeyi analiz et ve bana:

1. Mevcut mimari analizi
2. Mevcut finansal sistem analizi
3. Banka modülü mimarisi
4. POS mimarisi
5. Veritabanı değişiklikleri
6. Modüller arası ilişki şeması
7. API planı
8. UI/UX planı
9. Güvenlik planı
10. Veri migrasyonu gerekip gerekmediği
11. Riskler
12. Geliştirme aşamaları

şeklinde bir plan sun.

Planı oluşturmadan büyük çaplı kod değişikliklerine başlama.

Mevcut çalışan özellikleri bozma.

Gereksiz teknoloji ekleme.

Gereksiz bağımlılık ekleme.

Mevcut teknoloji yığını yeterliyse onu kullan.

Her finansal işlemde veri tutarlılığını önceliklendir.

Kod yazarken gelecekteki büyümeyi düşün ancak ilk sürümü gereksiz karmaşık hale getirme.

**Bu modülün amacı yalnızca "banka hesabı tutmak" değildir.**

Amaç:

**Banka + POS + Cari + Fatura + Stok + Kasa + Taksit + Tahsilat + Ödeme + Döviz + Mutabakat + Nakit Akışı + Raporlama**

sistemlerinin aynı finansal gerçeklik üzerinden çalışmasını sağlamaktır.

Bu prensibi tüm geliştirme boyunca koru.

ayrıca bunlara da dikkat et: 1- Eklenecek Madde: Tüm finansal tutarlar, bakiyeler ve oranlar float veya double olarak saklanmamalıdır. Yuvarlama hatalarının (floating-point errors) önüne geçmek için veritabanında kesinlikle DECIMAL(18,2) (veya uygun yüksek hassasiyetli sayısal veri tipi) kullanılmalı, hesaplamalar buna göre yapılmalıdır.
2-POS komisyon kesintileri yapılırken, bu komisyon tutarına ait KDV (%20 veya yürürlükteki oran) hesaplanmalı ve ilgili masraf/hizmet faturası otomatik veya manuel olarak muhasebeleştirilebilmelidir.

Banka masraflarında (EFT, havale vb.) KDV dahil/hariç durumu finansal hareketlere ve gider yazılarına doğru yansıtılmalıdır.
Eklenecek Madde:

2-Dövizli işlemler sırasında kurlar TCMB (Merkez Bankası) API/XML servisinden otomatik veya kullanıcı girişine bağlı olarak esnek şekilde çekilebilmelidir.

3-Dönem sonlarında (ay sonu / yıl sonu) yabancı para birimindeki banka bakiyeleri için Kur Farkı Değerlemesi (Gerçekleşmemiş Kur Farkı Geliri/Gideri) muhasebe kayıt altyapısı düşünülmelidir.
4- Standart valör süresinin yanı sıra bazı özel sektör anlaşmalarında veya yüksek tutarlı çekimlerde görülebilen Blokeli / Teminatlı POS işlemleri (Örn: 30 gün veya özel blokaj süreli satışlar) nakit akış projeksiyonunda ve bekleyen POS raporlarında ayrı bir kategoride izlenebilmelidir.
5-Eklenecek Madde: Bir POS işlemi iade edildiğinde veya kısmi iade yapıldığında, bankanın daha önce kestiği komisyonun tamamının veya bir kısmının iade edilip edilmediği (veya masraf olarak şirkete kalıp kalmadığı) iade senaryosuna dahil edilmelidir.
kullanıcının içinden çıkılmaz bir arayüz olmasını istemiyorum. banka modlüne girip ayarlar kısmından kendi özellikleri seçip uygulayabilir müşteri. seçili olarak gelecekler standartlar olmalı. kullanıcı profosyenel ise kendisi istediğini seçip uygulamalı. Doğru anla söylemek istediğimi. bana soracağın hususlarda önerdiğin en yagın ve modern cevabı uygula. banka modülü sabit menüde taksitler modülünün altında yer alsın.  
