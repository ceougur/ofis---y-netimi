# Cari kâhini bakımı 15 — GİRDİLER (ana oturumun yazdığı özet dosya; ders 5 koruması)

Bu dosya kâhine bakım 14'ün çıkardığı TOPLU soruların ve ardından gelen küçük soruların kullanıcı yanıtlarını verir (TOPLU KÂHİN BAKIMI: kod paketi başına bir bakım). Kullanıcıya gösterilen soru metinleri AYNEN aktarılmıştır; soruların içindeki örnek sayılar ve "program bugün" notları kullanıcıya gösterilip yanıtlanan metnin parçasıdır — KURAL KAYNAĞI yalnız KARAR satırlarıdır, soru metnindeki "program bugün" sözü tek başına beklenti kaynağı DEĞİLDİR. Bunun dışında programın hesap / görünüm davranışı hakkında bilgi içermez.

## 1. YENİ KURALLAR (kâhin bugün bu alanlarda susuyor / değer yazmıyor → değer yazar)
### S136
Kullanıcıya gösterilen soru (AYNEN):
şüpheliye alınan tutar TAKSİT kalemlerinden (ve verilen avans kaleminden) de düşer mi? ÖRNEK: Borç 400 → taksit kartı 400 (2 × 200) → fatura F 600 → Şüpheli Alacağa Al 300; bakiye 1.000. A (ÖNERİ; program bugün): türüne bakmadan kuyruk sırasıyla düşer → takvimde 1. taksit yok, F 500, 2. taksit 200 (gecikmiş 700; kart penceresinin göstergeleri değişmez). B: taksitler kendi tutarıyla kalır → F 300, taksitler 200 + 200. Bakiye iki seçenekte 1.000.

KARAR (kullanıcı 12.11.2026 23:44 UTC, AYNEN: "önerimi yap" — altı soruda da öneri seçildi): S136 = A — şüpheliye alınan tutar türüne bakmadan kuyruk sırasıyla düşer; TAKSİT kalemlerinden ve verilen avans kaleminden de (kart penceresinin göstergeleri değişmez).

### S139
Kullanıcıya gösterilen soru (AYNEN):
şüpheli kaydı olan caride GECİKMİŞ tutar hangi hesaptan? ÖRNEK (S130'un kendi örneği biçiminde): fatura 200 + Borç 1.000 + Borç 500 (hepsi vadesi geçmiş) → Şüpheli 900; bakiye 1.700. A (ÖNERİ; program bugün — cari kartı, Cari Listesi, Vade Takip, zil hepsi): görünen kalemlerden → gecikmiş 800. B: şüpheli dahil → gecikmiş 1.700. Bakiye iki seçenekte 1.700.

KARAR (kullanıcı 12.11.2026 23:44 UTC, AYNEN: "önerimi yap" — altı soruda da öneri seçildi): S139 = A — şüpheli kaydı olan caride GECİKMİŞ tutar görünen kalemlerden (cari kartı = Cari Listesi = Vade Takip = zil aynı sayı).

### S140
Kullanıcıya gösterilen soru (AYNEN):
stoktan taksitli satışla açılan kart İADEYLE küçülünce kart neyi taşır? ÖRNEK: elle Borç 500 (vadesi ileride) + stoktan taksitli satış 1.000 (taksitler 500 vadesi geçmiş + 500 ileride) → faturasız stok iadesi 800; bakiye 700. A (ÖNERİ; düzeltme turundan sonraki kod; S110 = A'nın sonucu — kart KENDİ satışını taşır): satıştan kalan 200 kartta → taksit kalanları [0, 200], gecikmiş 0, elle Borç 500 kendi vadesinde ayrı. B (2.4.9 ve düzeltme turundan önceki kod): kart elle borcu da içine alır → taksit kalanları [500, 200], gecikmiş 500. Bakiye iki seçenekte 700 (ana oturum iki kodda koştu).

KARAR (kullanıcı 12.11.2026 23:44 UTC, AYNEN: "önerimi yap" — altı soruda da öneri seçildi): S140 = A — stoktan taksitli satışla açılan kart iadeyle küçülünce KENDİ satışını taşır (S110 = A'nın devamı): örnekte taksit kalanları [0, 200], gecikmiş 0, elle borç kendi vadesinde ayrı.

### S145
Kullanıcıya gösterilen soru (AYNEN):
Şüpheli Alacağa alma tarihinden ÖNCEKİ bir tarihe tahsilat girilirse? PROGRAM BUGÜN (ana oturum koştu): REDDEDİYOR — ama mutabakat kapısının genel iletisiyle ('İşlem geri alındı: kayıt defterler arasında sapma oluşturacaktı … yöneticinize bildirin'); bugün tarihli tahsilat SORUNSUZ (borç 1.000, şüpheli 900 → tahsilat 300: bakiye 700, açık şüpheli 900 → 600). Örnek: borç 1.000 → 30 gün önce şüpheli 900 → 40 gün önceye tahsilat 300. A (ÖNERİ): ret KALSIN (o tarihte borç 700 olurdu, 900 şüpheliye alınamazdı), ileti anlaşılır olsun ('Şüpheliye alınan tutar o tarihte carinin borcunu aşar; tahsilatı şüpheli tarihinden sonraya girin ya da şüpheli kaydını düzeltin') — küçük iş, sıradaki birleşik turda. B: kabul edilsin (şüpheli tutar borcu aşabilir; defter kuralı değişir). C: Uç durum böyle kalsın (ileti de kalır) — BİLİNEN SINIR.

KARAR (kullanıcı 13.11.2026 03:44 UTC, AYNEN: "öenerilerini uygula" — her soruda öneri seçildi): S145 = A — şüpheliye alma tarihinden ÖNCEKİ tarihe tahsilat REDDEDİLİR (o tarihte şüpheliye alınan tutar carinin borcunu aşardı); bugün tarihli / şüpheli tarihinden sonraki tahsilat kabul edilir (soru metnindeki örnek: borç 1.000, şüpheli 900 → tahsilat 300: bakiye 700, açık şüpheli 900 → 600).

### S142
Kullanıcıya gösterilen soru (AYNEN):
Cari kartındaki Taksit Kartları satırında sayılar yeni hesapta ('Ödenen 500 · Kalan 400'), ama durum etiketi ('2 taksit gecikti') ve 'sıradaki 10.09.2026' kartın eski hesabında; aynı ekranda 'Gecikmiş Borç 100 · 1 kalem', kart penceresinde 'Geciken 100 · 1 taksit' ve 1. taksit 'Ödendi'. A (ÖNERİ): düzeltilsin — etiket ve sıradaki taksit de aynı hesaptan ('1 taksit gecikti', sıradaki 10.10); aynı küçük işte kart penceresindeki 'Hareketler: henüz hareket yok' satırına 'cari hesabına girilen tahsilat taksitleri kapatır' açıklaması; sıradaki birleşik turda, kendi dar kontrolüyle — Ç5-B'nin birleşmesini BEKLETMEZ. B: 2.5.1'e bırakılsın. Bakiye değişmez (400).

KARAR (kullanıcı 13.11.2026 03:44 UTC, AYNEN: "öenerilerini uygula" — her soruda öneri seçildi): S142 = A — cari kartındaki taksit kartı satırında durum etiketi ve 'sıradaki taksit' de aynı (tek) hesaptan (S129 = A'nın devamı).

NOT (ana oturum): (1) S136 ve S139'un örnek sayıları elle senaryo olarak AYNEN eklenir (S136: takvimde 1. taksit yok, F 500, 2. taksit 200, gecikmiş 700, bakiye 1.000; S139: gecikmiş 800, bakiye 1.700). "Kuyruk sırası"nın ne olduğu bakım 14'te S130 için yazdığın okumayla AYNI olmalı; S136'nın örneği o okumayla bağdaşmıyorsa UYDURMA — iki okumayı sayılarıyla yaz, yalnız ayrışan alanlarda SUS, "KULLANICIYA SORULMALI"ya koy. (2) S140: S110'un kâhindeki karşılığının iadeyle küçülen karttaki sonucu; örneğin sayıları AYNEN elle senaryo. (3) S145: bugün bu adımı 'kabul' bekliyorsan 'ret'e çevir (kural kullanıcı kararıdır); reddin KOŞULU karar metninden: o tarihte şüpheli tutar borcu aşıyorsa. Koşulun sınırı (tam eşitlik; aynı gün; kısmi) karar metninden TEK biçimde çıkmıyorsa o sınırda SUS ve sor. (4) S142: bu alanlarda zaten tek hesabın değerini bekliyorsan beklentin DEĞİŞMEZ — yalnız KARARLAR.md'ye onay notu; modelinde bu iki alan yoksa ekleme ZORUNLU değil, yoksa "alan yok" diye yaz.

## 2. BİLİNEN SINIRLAR — kâhin bu alt durumlarda SUSAR (kural YOK; kod da değişmez)
### S137 = C (kullanıcı 12.11.2026 23:44 UTC, AYNEN: "önerimi yap" — altı soruda da öneri seçildi)
Soru (AYNEN):
şüpheliye aldıktan SONRA doğan ama vadesi daha önce olan borç varken şüpheli tutar hangi kalemlerden düşer? ÖRNEK: Borç X 600 (vadesi ileride) → Şüpheli 400 → sonra fatura F 300 (vadesi X'ten önce); bakiye 900. A: bakılan andaki kalemlerden en eskiden → F görünmez, X 500. B (program bugün): şüpheliye alındığı gündeki kalemlerden → X 200, F 300. C (ÖNERİ; Ç5-B SARMAL KURALI (2)): Uç durum böyle kalsın — BİLİNEN SINIR (program B'de kalır, kâhin susar). Görünen toplam (500) ve bakiye üç seçenekte aynı.

### S138 = C (kullanıcı 12.11.2026 23:44 UTC, AYNEN: "önerimi yap" — altı soruda da öneri seçildi)
Soru (AYNEN):
şüpheliye alınmış faturaya sonradan o faturaya BAĞLI tahsilat (çek / iade faturası / bağlı ödeme) gelirse şüpheli tutarın düşüşü değişir mi? ÖRNEK: fatura F 800 + Borç X 500 → Şüpheli 900 → F'ye bağlı tahsilat 300; bakiye 1.000. A: kalan şüpheli 600 en eskiden düşer → X 400 görünür. B (program bugün): bağlı tahsilat yalnız kendi faturasını kapatır, şüpheliye alınan 900'ün düşüşü değişmez → X 100 görünür (gecikmiş 100). C (ÖNERİ): Uç durum böyle kalsın — BİLİNEN SINIR (program B'de kalır, kâhin susar). Bakiye üç seçenekte 1.000.

### S141 = C (kullanıcı 12.11.2026 23:44 UTC, AYNEN: "önerimi yap" — altı soruda da öneri seçildi)
Soru (AYNEN):
kart fazlası ('Taksit kartından artan ödeme') fatura listesinde faturaları, takvimde (kuyrukta) ise vadesi en eski kalemi kapatıyor → fatura listesi 'açık 0' derken takvimde aynı faturanın taksitleri (783,88) ve başka bir fatura (1.811,98) açık görünüyor; bakiye iki görünümde aynı (30.168,83; ana oturum taban kodda yeniden üretti; düzeltme turundan önce de vardı). A: düzeltilsin — fatura durumu bu durumda da kuyrukla aynı kalemi kapatsın (S99 = A'nın harfi; Ç5-B'ye yeni bir küçük tur + dar kontrol). C (ÖNERİ; Ç5-B SARMAL KURALI (2)): Uç durum böyle kalsın — BİLİNEN SINIR (2.5.1'e iş olarak yazılır).

### S143 = C (kullanıcı 13.11.2026 03:44 UTC, AYNEN: "öenerilerini uygula" — her soruda öneri seçildi)
Soru (AYNEN):
kartın 'Kalan'ı cari bakiyesinden BÜYÜK görünebiliyor. (a) Alacak Yaz ile netleşme: borç 900 → kart 900 (3 × 300) → Alacak Yaz 200 ⇒ kart 'Tahsil Edilen 0 · Kalan 900', cari kartı 'Taksitten Kalan 900', bakiye 700. (b) taksitlere bölünmemiş kısmı olan kart: borç 1.000 → kart 1.000 (taksit 300 + 300, 400 bölünmemiş) → bağsız tahsilat 200 ⇒ kart 'Kalan 1.000', bakiye 800. A: düzeltilsin (kartın Kalan'ı da tek hesaptan; netleşme için yeni bir gösterge — 'Mahsup Edilen' — gerekir: tasarım işi). C (ÖNERİ; Ç5-B SARMAL KURALI (2)): böyle kalsın — BİLİNEN SINIR; düzeltmesi 2.5.1'e iş. Bakiye iki seçenekte aynı (700 / 800 — ana oturumun koştuğu testte doğrulandı).

### S144 = C (kullanıcı 13.11.2026 03:44 UTC, AYNEN: "öenerilerini uygula" — her soruda öneri seçildi)
Soru (AYNEN):
üç gösterim bugünkü hâlinde kalsın mı? (c) kartın KENDİ fazla tahsilatı: 'Tahsil Edilen 1.100 · Kalan 0 · fazla 100' (bakiye −100); (d) kapatılmış kart kendi hesabıyla: 'Tahsil Edilen 300 · Kalan 600'; (e) çok geriye tarihli kayıtlarla 'güvenli kapanış'a düşen caride kart tahsilatının bir kısmı 'Taksit kartından artan ödeme' diye görünür. C (ÖNERİ): böyle kalsın (üçü de kendi içinde tutarlı; BİLİNEN SINIR). A: hepsi tek hesaptan (yeni tur).

### S147 = C (kullanıcı 13.11.2026 03:44 UTC, AYNEN: "öenerilerini uygula" — her soruda öneri seçildi)
Soru (AYNEN):
carinin Açılış Bakiyesi satırı silinip Silinenler'den geri alınıyor; carinin ayrıca ONAYLI bir 'Açılış Olabilir' satırı var. Bugün geri alınan satır açılış işaretiyle döner — carinin iki açılışı olur, geri alınan satır listeye girmez (Ç5-A öncesi kodda da böyle). A: onaylı satır da 'başka açılış' sayılsın → geri alınan satır 'Açılış Olabilir' adayı olsun. B: yalnız Açılış Bakiyesi satırı 'başka açılış' sayılsın (bugünkü davranış). C (ÖNERİ): Uç durum böyle kalsın — BİLİNEN SINIR. Mizan üç seçenekte aynı (ikisi de geçici açılış hesabında; fark ancak aday sonradan reddedilirse çıkar).

NOT (ana oturum): bu altı alt durumda kâhinin bugün bir DEĞER verip vermediğine bak. Değer veriyorsa ve o değer sorularda yazan okumalardan birine dayanıyorsa, o alt durumda (yalnız ayrışan alanlarda — bakiye okumalar arasında aynıysa bakiye beklenir) SUS'a çevir ve KARARLAR.md'ye "BİLİNEN SINIR" diye yaz. S147 açılış satırlarıyla ilgilidir; cari kâhininde karşılığı yoksa "alan yok" diye yaz, defter kâhinine DOKUNMA. Kararların kapsadığı ana durumlar (önceki bakımların kendi örnekleri) AYNEN değer vermeye devam eder.
