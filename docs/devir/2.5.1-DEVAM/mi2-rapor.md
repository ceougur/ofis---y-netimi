# 2.5.1 Mİ tur 2 — Müşteri İstekleri Kod Ajanı Raporu (taslak, adım adım)

Görev metni: `docs/devir/2.5.1-DEVAM/mi2-istem.txt` (ana ağaçta). Taban: etiket `t251-mi-tur1` = c674b41b (Mİ tur 1'in dal ucu).
İşler: (1) tek borç sırasının girdisine sızan görünen numaranın çıkarılması (hakem testi), (2) TEK NUMARA HER YERDE (S-Mİ1-1 = A), (3) Cari Listesi'nde
"Tahsilat Dönemi:" etiketinin her durumda görünmesi.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)

Her madde için beklenen: kart penceresinde görünen numara (vade sırası, 1..n, boşluksuz) = makbuz = taksit kartı PDF'i = Taksitler listesi (ekran / PDF / Excel)
= cari ekstresi (ekran / PDF / Excel) = WhatsApp metni = Tablo = zil / takvim / Vade Takip = Rapor Merkezi = mobil özet; para / bakiye / gecikmiş / tahsilat sayıları
DEĞİŞMEZ; tek borç sırasının girdisi bayt bayt aynı.

1. **Taksiti silinmiş kart** (saklanan sıra 1, 3 kalır): ekran "1., 2." → makbuz, PDF, Excel, ekstre, WhatsApp da "2. taksit" yazmalı ("3." değil).
2. **Vadesi öne alınmış taksit** (saklanan 3, vadesi en erken): her yerde "1."; öbürleri "2.", "3." (eski "3., 1., 2." görünümü hiçbir çıktıda kalmamalı).
3. **Araya eklenen taksit** ("Taksit Ekle", vadesi mevcutlardan önce; saklanan MAX+1): her yerde vade sırasıyla numaralanır.
4. **Aynı vadeli iki taksit**: sıra saklanan sıraya göre (vade eşitse `seq`); ters çevrilirse numaralar takas olur — bütün çıktılar aynı kuralla (tek yardımcı).
5. **Kapatılmış / yeniden açılmış kart**: numara kartın durumundan bağımsız (kapanış sırayı değiştirmez); yeniden açılınca aynı numara.
6. **"Borçta Kalsın" ile kapanan kart**: kuyruk vadesi kapanış ertesi güne kayar (kuyruğun girdisi) — görünen numara KARTIN taksit sırası (vade değişmiş gibi
   yeniden sıralanmaz); numara kuyruğun girdisine girmez.
7. **Excel'den yüklenen kart** (açılış = önceden ödenen): açılış ilk taksitleri kapatır; numara yine kartın sırası; açılış satırının makbuzu yok.
8. **Kısmen ödenmiş taksit**: makbuz "N. taksit (vade …)" — N görünen numara; kalan / ödenen sayıları değişmez.
9. **İade ile küçülen kart** (iade kesimi son / açık taksitten): kesilen taksit silinmez, numara değişmez; silinirse (1) gibi.
10. **Silinip geri yüklenen kart** (Silinenler'den geri): numara geri yüklemeden önceki ile aynı.
11. **İki kartlı cari**: her kartın numarası KENDİ kartının sırası; ekstre satırı doğru kartın numarasını yazar.
12. **Makbuz tahsilattan SONRA taksit silinirse**: makbuz anlık üretiliyorsa yeniden açılınca YENİ görünen numarayı yazar (önceden basılmış kâğıtla fark —
    teslim notuna); tahsilat silinen taksite bağlıysa bağı en eski açık taksite kayar → makbuz o taksitin numarasını yazar.
13. **İki şirket**: her şirket kendi kartlarının sırası; şirketler arası bellek sızmaz (kuyruk girdisi örnek başına).
14. **Dönem kilidi**: numara gösterimi kilitten etkilenmez; kilitli dönemdeki taksit silinemez (bugünkü kural) — numara kayması da olmaz.
15. **Eski sürümden gelen veri** (saklanan sırası boşluklu / çift kart): göç YOK; görünen numara her açılışta saklanan veriden hesaplanır.
16. **Tek borç sırasının girdisine sızma**: görünen numara alanı kuyruğun girdisine (cari defteri satırları, kart haritası, taksit listesi) GİRMEMELİ; hakem
    dosyası (`test/fixtures/obligation-input-250-hakem.json`) DEĞİŞMEZ.
17. **Saklı metinler**: gönderilmiş WhatsApp iletisinin donmuş içeriği / kayıtlı açıklamalar YENİDEN YAZILMAZ; anlık üretilen çıktılar yeni numarayı yazar.
18. **Cari Listesi dönem seçicisi**: dönem seçilince "Tahsilat Dönemi:" etiketi kaybolmamalı (tarih aralığı alanları açıldığında da görünür).
19. **Para sayıları**: hiçbir senaryoda bakiye / kalan / gecikmiş / tahsilat sayısı değişmemeli (değişirse DUR — hata).
