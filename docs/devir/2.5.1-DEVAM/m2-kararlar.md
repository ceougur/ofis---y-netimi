# M2 — Değersiz Alacak sınırı: cari kâhini bakımı 30 KARAR GİRDİSİ (2.5.1; ana oturum yazdı, 27.11.2026)

Bu dosya cari kâhini bakımı 30'un TEK yeni karar kaynağıdır (CLAUDE.md ders 5, 40, 43). Önceki kararlar kâhinin kendi KARARLAR.md'sindedir. Burada programın kodu,
dosya adı, alan adı YOKTUR; kural dilinde yazılmıştır. Bir kuralın iki okuması çıkarsa KODLAMA — raporda "KULLANICIYA SORULMALI" (TOPLU KÂHİN BAKIMI: bulduğun bütün
alt durumları BİRLİKTE çıkar; ana oturum hepsini tek iletide sorar).

## 1. KULLANICI KARARLARI (AYNEN; hepsi "önerilerini uygula" kuralıyla uygulanmış öneriler — kullanıcıya gösterildi)

- **S264 = A (26.11.2026):** "Değersiz sınırı aynı günün sırasına uysun — Değersiz o günün bağlı payından önce, tam tutar kabul (kâhin + v2.4.9)." Örnek: aynı gün faturaya
  bağlı tahsilat → Şüpheliye Al 4.421,71 → Değersiz 4.421,71 KABUL.
- **S269 = A (26.11.2026):** "S264 sınırı 'kayıt kapalı' denetiminden ÖNCE de uygulanır (Değersiz Yaz ve Silinenler'den geri yükleme); bu kayıtlarda düğme görünür; ipucu ve
  önerilen tutar sınırı gösterir (S268 A)." Yani kaydın kalanı aynı günün bağlı payıyla 0'a inmiş olsa da (kısmi Değersiz'den sonra ya da bağlı tahsilat şüpheli tutarına
  eşitken) o günün tarihiyle Değersiz yazılabilir.
- **S268 = A (26.11.2026):** "Değersiz Alacak Yaz formu üst sınır ipucu / önerilen tutar S264 sınırını göstersin."
- **S270 = A (26.11.2026):** S269 / S268'in ilk uygulaması FAZLA YAZIMA yol açtığı için geri alındı; "doğru sınır formülü (sonradan gelen bağsız tahsilat ve sonraki Değersiz
  satırlarıyla) kâhinle birlikte 2.5.1'de". Değişmez: **hiçbir sırada bir şüpheli kaydın Değersiz toplamı, o kayda şüpheliye alınan tutardan kayda düşmüş tahsilatlar
  çıkınca kalanı aşamaz; Değersiz yazımı cariyi alacaklıya (eksi bakiyeye) düşürmez.**
- **S-M2-1 = B (KULLANICI KARARI 27.11.2026, AYNEN: "önerini uygula"):** şüpheliye alma gününde, şüpheliye almadan ÖNCE yazılmış faturaya bağlı tahsilat
  aynı günün sırası gereği şüpheli kayıttan düşer (aynı gün sırası kuralı DEĞİŞMEZ — S263 = C ile aynı çizgi). Değersiz **o günün tarihiyle** yazılırsa o günün bağlı payından
  önce değerlendirilir (S264); **sonraki bir tarihle** yazılırsa önceki günlerin bağlı payı düşülmüş kalan kadar yazılabilir. Ekran her tarih için gerçek sınırı gösterir.
  (Reddedilen A: 2.4.9'daki gibi — şüpheliye almadan önce yazılmış aynı günlü bağlı tahsilat kaydı hiç azaltmaz. Reddedilen C: hiçbir şey değişmez.)

- **SK-55 = C (KULLANICI KARARI 27.11.2026, AYNEN: "önerilerini uygula"; cari kâhini bakımı 30'un sorusu):** aynı gün "faturaya bağlı tahsilat → bağsız tahsilat → Şüpheliye Al" yazım sırasında
  şüpheli payın ölçüm anı BİLİNEN SINIR — kâhin bu sayıyı denetlemez (SUS), programın bugünkü davranışı kalır.

## 2. BAŞ MİMAR OKUMASI (kullanıcıya gösterildi; DEĞERLENDİR — karar metinlerine uyuyor mu; uymuyorsa ya da iki okuma çıkıyorsa SORULMALI)

Bir şüpheli kayıt için, D tarihiyle yazılacak Değersiz'in üst sınırı:
1. D gününün faturaya bağlı tahsilat / evrak payı henüz düşülmemiş sayılır (S264); D'den ÖNCEKİ günlerin bağlı payı düşülmüştür (S-M2-1 = B).
2. Bağsız tahsilatların (ve öbür bağsız kapatıcıların) kayda düşen payı — hangi gün gelirse gelsin, Değersiz'den sonra yazılmış olsa da — sınırı küçültür (S270: "sonradan
   gelen bağsız tahsilat").
3. Kayda daha önce yazılmış BÜTÜN Değersiz satırları (D'den sonraki tarihli olanlar da) sınırdan düşer (S270: "sonraki Değersiz satırları").
4. Yeni Değersiz yazıldıktan sonra bütün tarihlerde kayıt yeniden değerlendirildiğinde §1 S270 değişmezi bozuluyorsa yazım REDDEDİLİR (güvenlik denetimi); ipucu ve
   önerilen tutar bu reddi de bilir — ekranın önerdiği tutar ve tarih HER ZAMAN kabul edilir.
5. Ekran D'yi kendiliğinden geriye KURMAZ (kayıp önceki aya / yıla sessizce yazılmasın): ipucu "bugünün tarihiyle en çok X; <şüpheliye alma günü> tarihiyle en çok Y" der.
   (Bu madde görünümdür — kâhin yalnız "tarih → sınır" işlevini modeller.)
6. Şüpheliden Çıkar ve Karşılık Ayır kuralları bu bakımda DEĞİŞMEZ (Karşılık Ayır'daki aynı sınıf ayrı karar bekliyor — KAPSAM DIŞI).

## 3. Senaryo sınıfları (olaylar kural dilinde; beklenenleri SEN elle hesapla — aşağıdaki sayılar 2.4.9 sürümünün ve dar kontrolün ÖLÇÜMÜDÜR, kural kaynağı DEĞİL; senin
hesabın farklı çıkarsa uydurma, raporda farkı ve hangi karardan çıktığını yaz)

Taban T: Fatura 2.900 + Borç Yaz 3.400 (borç 6.300) · 17.09 faturaya bağlı tahsilat 2.876,45 (bakiye 3.423,55) · 17.09, tahsilattan SONRA yazılmış Şüpheliye Al 3.000.
1. T + Değersiz 3.000 @17.09 → kabul; bakiye 423,55 (S264).
2. T + Değersiz 1.000 @17.09, sonra 2.000 @17.09 → ikisi de kabul; bakiye 423,55 (S269). Üç adımlı zincir 1.000 × 3 @17.09 → kabul; dördüncü herhangi bir tutar → ret.
3. Fatura 3.000 + Borç Yaz 3.400 · aynı gün bağlı tahsilat 3.000 → Şüpheliye Al 3.000 → Değersiz 3.000 @aynı gün → kabul; bakiye 400 (S269: bağlı tahsilat şüpheli tutara eşit).
4. T + Değersiz @18.09 (ertesi gün) → sınır 123,55 (S-M2-1 = B); 123,55 yazıldıktan sonra @17.09 tarihiyle kalan yazılabilir mi? (madde 3 ve 4'e göre hesapla — dar kontrol
   bu sırada ekranın 2.876,45 önerip sunucunun reddettiğini ölçtü; doğru sınır senden.)
5. T + Değersiz 100 @25.09, sonra @17.09 ile ne kadar yazılabilir? (aynı aile; dar kontrol "gerçekte yazılabilen 23,55" ölçtü.)
6. T + 01.10 BAĞSIZ tahsilat 1.000 (bakiye 2.423,55), sonra Değersiz: @17.09 ile en çok ne kadar, @01.10 ve sonrası ile en çok ne kadar? (2.4.9 sınırı 2.000, bakiye 423,55.
   Geri alınan uygulama 2.876,45 + 123,55 = 3.000 kabul etti, bakiye −576,45 — YANLIŞ; değişmez bunu yakalamalı.)
7. T + aynı gün ya da ertesi gün bağsız tahsilat 50; bağlı tahsilat, Şüpheliye Al ve bağsız tahsilatın ALTI yazım sırası; önce Değersiz 2.950, sonra 50 → ikincisi RET (toplam 2.950;
   2.4.9'da bakiye 423,55).
8. Aynı gün iki şüpheli kayıt (1.500 + 1.500), bağlı tahsilat varken: birine Değersiz 1.500 → kabul; öbür kayda bugünün tarihiyle Değersiz yazılmışken ilkine @17.09 önerisi.
9. Aynı gün ikinci kayıt Şüpheliden Çıkar'ıldıktan sonra ilk kayda Değersiz 1.500.
10. Değersiz yazıldıktan SONRA bağlı tahsilatın silinmesi / bağının kaldırılması / tarihinin 16.09'a ve 20.09'a alınması / tutarının 3.500 ve 1.000 yapılması — bakiye ve
    değişmez (2.4.9 ile yeni kural aynı ölçüldü: 3.300 / 423,55 × 3 / −200 / 2.300 — tutar 3.500'de cari zaten fazla ödemiş).
11. Silinenler'den Değersiz geri yüklemesi (iki sırayla) — aynı sınır.
12. Dönem Kilidi 17.09'u kapsıyorsa @17.09 yazılamaz; sınır yalnız kilit sonrası tarihler için (T'de 123,55).
13. Rastgele üretici: "her şüpheli kayıt için Σ Değersiz ≤ alınan − kayda düşen tahsilat; Değersiz yazımı bakiyeyi eksiye düşürmez" değişmezi her adımda; aynı gün bağlı
    tahsilat + Şüpheliye Al + (aynı gün / sonraki gün) Değersiz + sonradan bağsız tahsilat sınıfı üreticiye girer.
14. ÖNCEKİ BAKIMDAN KALAN (kâhin eksiği olarak kayıtlı): kâhin Değersiz sınırına ÖNCEKİ günün bağlı tahsilat payını katmıyordu — madde 4 bunu kapatır.

## 4. Kullanıcı kuralları (AYNEN)
- (14.11) "bana sorun varsa önerilerini uygula" — soru öneriyle yazılır.
- (06.11) "bana soru sorduğunda eğer çok uç durumsa konu; seçeneklere uç durum böyle kalmasında sorun yok maddesi de ekle".
- (20.11) "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım" — bu sürümde: kâhinin iç
  düzeni / belge türü husus kovalanmaz, raporun "SONRAYA" başlığına yazılır.
- (12.11) yaygın muhasebe programları referans alınabilir; bir programın davranışı ancak belgesi okunmuşsa dayanak yazılır.
