# 2.4.4 bağımsız kâhin — tur 2 kural kaynağı (madde 31a; 23.10.2026)

Ana oturumun kâhin ajanına verdiği kural metinleri AYNEN (kodu yazan ajanların kural metinleri; ana oturum kanıtla doğruladı; kaynakları CLAUDE.md "Açık iş"
22.10 gecesi SORU/KARAR kayıtları). Kâhin ürün kodunu (server/**, client/**) OKUMADI. Etiketlerin dağılımı her kâhinin KARARLAR.md'sinde.

- E7 (e-Belge kâhini K35 "çatal"ı karara bağla): Yalnız Programda İptal yalnız sonucu belirsiz gönderimde ya da portalda taslak belgede yapılır; Fatura Ayarları
  yetkisi ve onay gerekir. Öbür her durumda (EDM'de İşleniyor / Gönderildi / Kabul / Hata, e-Fatura, Müşteri Fişi, numarasız bekleyen) 409, belge değişmez, EDM'ye
  iptal gitmez. Süre dolmuşsa önce süre iletisi; 8 günü geçmiş belirsiz gönderimde önce EDM durum sorgusu.
- E6: Programın e-Belge dışı serilerinde (FIS, SMM, IAD) verilmiş numara silmeyle serbest kalmaz. Sıradaki numara, silinmişler dahil en büyük verilmiş numaradan
  sonra gelir. Yeni belge, silinen son belgeden eski tarihli olamaz. Silinenler'den geri yüklenen belge kendi numarasıyla döner. Numara başka canlı belgedeyse
  geri yükleme 409, belge Silinenler'de kalır. Taslak ya da numarasız belgeyi silmek tabanı değiştirmez. e-Belge serisinin eski kuralı aynı.
- Kâğıt Makbuz Olarak Bırak (MM4 alt kararı): bırakılan serbest meslek makbuzu SMM serisinden numara alır ve sonradan e-SMM olarak GÖNDERİLEMEZ (kalıcı engel).
  Müşteri Fişi Olarak Bırak (fatura) değişmedi: FIS numarası alır, sonradan e-Belge gönderilebilir, verilmiş FIS numarası bir daha kullanılmaz.
- E1/E4: e-Belge gönderimi ağa çıkmadan önce iz alır. Yanıt gelmeden kesilirse belge "Sonucu Belirsiz" sayılır; Sil, Düzenle ve İptal Et 409; yeniden Gönder
  önce EDM'ye sorar, ikinci kez göndermez. EDM'de yoksa aynı numarayla yeniden gönderilir. İstek hiç gitmediyse belge önceki durumuna döner. İptal izi de aynı
  mantıkla.
- U1: Faturadaki "Nihai Tüketici" yalnız programın işaretli carisini kullanır. Bu cari silinmemiş olur, TCKN'si 11111111111 olur, adı "Nihai Tüketici" olur.
  İşaretli cari yoksa bu koşulları taşıyan en eski cari benimsenir, o da yoksa yeni açılır. Adı belli bir 11111111111'li cari ASLA seçilmez.
- U2 (daraltılmış) + E2/E3 + MM6 (tablo raporları): Borç sütunu önceliği: Kalan/Bakiye → borç/alacak başlıklı sütun → sekmenin tek tutar sütunu. Tek tutar
  sütunundan yalnız ödeme sözü tutarı borç dışıdır: başlıkta "söz", "sözü", "taahhüt". Başlığı gün, adet, sayı, ay, yıl, oran, yüzde ya da % olan sütun tutar
  değildir. Kalan 0 ise borç 0; Kalan boşsa Toplam Borç. Aynı dosya no birden çok sekmede borç bir kez sayılır; aynı öncelikte ilk sekme. "Ödendi" söz hiçbir
  yerde görünmez. Nakit Akış'ın Kasa giriş/çıkışı Kasa raporuyla aynı toplam: yalnız nakit, bütün kaynaklar.
- MM3: Stopaj ve Tevkifat Özeti'nde iade, asıl belgenin tarafında eksi yazılır. Satıştan iade "Bizden kesilen (193)" tarafında; alıştan iade "Bizim kestiğimiz
  (360)" tarafında. Kaynak: Tekdüzen Hesap Planı, KDV GUT I/C-2.1.3, KDVK 35.
- MM8: Yevmiye'de aynı günün maddeleri tarih → olay sınıfı (belge önce, sonra para/cari hareketleri) → yazım sırası.
- MM10: KDV kalem başına, stopaj makbuz toplamı üzerinden. Çok kalemli makbuzda ≤ 1 kuruş fark beklenir. Mevcut mutabakat modeli böyle; değişmedi.
- AYRICA İNCELE: test:kahin-ebelge --tohumlar 1-3 --islem 120'de tohum 2 fark 4 / ihlal 2 (taban ad865f0'da da): "Kâğıt kaydet sırasında chronology"; "Müşteri
  Fişi'ne bırakılan belgeye FIS numarası verilmesi". Hüküm yalnız karar metinlerinden.
