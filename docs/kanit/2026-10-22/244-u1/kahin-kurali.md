# U1 — kâhin için KURAL (kodu yazan ajan kâhin yazmaz; ders 5)

Kaynak: kullanıcı kararı (5 dk yetkisiyle, 22.10.2026; 31f U1) + GİB e-Arşiv: kimliği bilinmeyen nihai tüketici TCKN'si 11111111111.

Faturadaki "Nihai Tüketici" düğmesi hangi cariyi seçer (şirket başına; her şirketin kendi verisi):
1. Program kendi "Nihai Tüketici" carisini kalıcı bir işaretle tanır. İşaretli cari, şu üçü birlikte doğruysa seçilir: silinmemiş; VKN/TCKN'si 11111111111;
   adı "Nihai Tüketici" (büyük/küçük harf ve fazla boşluk farkı önemsiz). Pasif cari yine seçilir.
2. Böyle işaretli cari yoksa: silinmemiş, TCKN'si 11111111111 ve adı "Nihai Tüketici" olan carilerin EN ESKİSİ (açılış zamanı; eşitse önce yazılan) seçilir
   ve işaretlenir. Yeni cari açılmaz.
3. O da yoksa yeni "Nihai Tüketici" carisi açılır (müşteri, gerçek kişi, TCKN 11111111111, il/ilçe firmanın adresinden) ve işaretlenir.
4. Adı "Nihai Tüketici" olmayan cari (11111111111 yazılmış olsa da: "Ayşe Şahin", "Perakende Müşteri") HİÇBİR adımda seçilmez.
5. Aynı anda kaç basış olursa olsun en çok bir cari açılır.
6. Tutar sınırı (e-Arşiv'de 30.000 TL üstü 11111111111 yazılamaz) ve e-Arşiv kuralları değişmez.

Cari formu: adı "Nihai Tüketici" olmayan cariye 11111111111 yazılıp kaydedilirken soru çıkar ("Yine de kaydedilsin mi?"); Vazgeç → kaydedilmez, form açık;
onay → kaydedilir (engel değil). Düzenlemede ad ve kimlik değişmediyse sorulmaz.

Örnek girdiler (beklenen seçim):
- A) Boş şirket → "Ayşe Şahin" (11111111111) aç → düğme: YENİ "Nihai Tüketici"; 1.000 TL + %20 KDV satış → NT borcu 1.200, Ayşe 0.
- B) Aynı anda saniyede "Perakende Müşteri", "Nihai Tüketici"(a), "Nihai Tüketici"(b) (11111111111) → düğme: a; sonra b'nin açılış zamanı geriye alınsa da a.
- C) İşaretli NT → adı "Ayşe Şahin" yapılır → düğme: yeni NT. Adı " nihai  TÜKETİCİ " yapılırsa aynı cari. TCKN'si gerçek numara yapılırsa yeni NT.
- D) İşaretli NT silinir → yeni NT; eskisi Silinenler'den geri gelir → yine yeni NT (işaret değişmez).
- E) 2.4.3 verisi: Ayşe (önce, sonradan 11111111111) + 2.4.3 düğmesinin NT'si + sonradan elle açılmış NT → düğme: 2.4.3 düğmesinin NT'si, yeni cari yok.
- F) İki şirket: her şirkette ayrı NT; 002'de basmak 001'i değiştirmez. Tümünü Sıfırla'dan sonra basınca yeni NT.
