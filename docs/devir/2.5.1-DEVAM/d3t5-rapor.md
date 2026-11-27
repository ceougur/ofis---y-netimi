# D3 TUR 5 raporu — tur 4'ün DOĞRULANMADI maddeleri, S-T4-1 = A'nın devir tarafı, kâhin okumaları (a) / (b), test düzeni (2.5.1)

Ajan: D3 TUR 5 KOD ajanı (high), 27.11.2026. Taban `t251-d3-tur4` (8d9c87c0). D3 hâlâ HİÇBİR ŞEY YAZMAZ (plan + ön izleme + ön denetim + Devir Raporu).
TASLAK — adım adım doldurulur; son hâl en sonda işaretlenir.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı; testler buradan)

Her satır: "ne ters giderse devir yanlış geçer / yanlış durur / kullanıcı yanlış yönlenir". Yanlış DURDURMA da hatadır. Sütunlar: bozulma → beklenen → test.

### İş 1 — Borç Yaz karşısıyla Mahsup Et (DOĞRULANMADI-1; S-T2-1 = B'nin öbür yönü)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| b-1 | ≤K Borç Yaz (müşteri borcu) ↔ K sonrası alış faturası Mahsup Et: Borç Yaz ayrılmaz, K'de bağsız avans / alacakla netleşir | Borç Yaz'ın mahsuba giden payı K'de AYRILIR, yeni yıla Borç Yaz'ın AÇIK KALEMİ (borç yönü, vade = satırın Vade Tarihi; yoksa satırın günü) olarak devreder; bağ listesinde mahsup satırın devir kalemine (`line:`); devirli = devirsiz | devir-d3-mahsup-borc |
| b-2 | Sıra değişir: K sonrası alış önce, Borç Yaz sonra (Borç Yaz ≤K tarihli ama mahsuptan SONRA girilmiş — kilit yokken geriye tarihli giriş) | aynı ayırım (ayırım tarih / sıra değil mahsubun kendisine bağlı) | devir-d3-mahsup-borc |
| b-3 | Kısmi mahsup (Borç Yaz 300, mahsup 120) | 120 ayrılır, 180 K'de olağan sırayla kapanır / açık kalır; devirli = devirsiz | devir-d3-mahsup-borc |
| b-4 | İki belge de ≤K (Aralık alış ↔ Aralık Borç Yaz), mahsup Ocak'ta | "k-de-kapandi": iki belge K'de o mahsupla kapanır (yeni yılda yeniden uygulanmaz); devirli = devirsiz | devir-d3-mahsup-borc |
| b-5 | Ana belge ≤K alış, karşı belge K SONRASI Borç Yaz (Ocak) | ≤K alışın payı ayrılır (alacak yönü açık kalem); Borç Yaz yeni yılda kendi yerinde | devir-d3-mahsup-borc |
| b-6 | Mahsup sonradan silinir | hiçbir şey ayrılmaz | devir-d3-mahsup-borc |
| b-7 | Vade Tarihi'li Borç Yaz: ayrılan kalemin vadesi satır günüyle yazılır (vade kaybolur → gecikmiş ayrışır) | açık kalemin vadesi Borç Yaz'ın Vade Tarihi | devir-d3-mahsup-borc |
| b-8 | K günü (31.12) mahsup → ayırım YAPILIR (yanlış: K sonrası sayılır) | ≤K mahsup — ayırım YOK, olağan 0. adım | devir-d3-mahsup-borc |
| b-9 | İki seçenek (Borç ve Alacakları Aktar / Sadece Bakiyeyi Aktar) ayrışır | açık kalemler ve ayırım AYNI | devir-d3-mahsup-borc |
| b-10 | 002'deki Borç Yaz mahsubu 001'in planına girer | girmez | devir-d3-mahsup-borc |

### İş 2 — K öncesi belge KİLİTLİ dönemdeyken K sonrası bağ / mahsup (DOĞRULANMADI-2; S-T4-1 = A)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| k-1 | Tur 4 tohum 11 "Müşteri 108" sınıfı: fatura kilitli dönemde iade + bağsız havaleyle kapanmış, kilitten sonra bu faturaya BAĞLI 128,00 tahsilat → plan bağsız kapanışı kaydırır | S-T4-1 = A: bağ kilitli bağsız kapanışı KAYDIRMAZ → bağ arşiv başvurusu, 128,00 bağsız gibi vadesi en önce gelen borca; açık kalemler (devirli görünüm) 280,00 (22.12.2026) + 1.245,40 (19.01.2027), 19.01'e kadar gecikmiş 280,00, bakiye 1.525,40 — sayılar AYNEN | devir-d3-kilit-bag (elle kurulmuş eşdeğer) |
| k-2 | Aynı sınıf iadesiz (yalnız bağsız havale kilitli dönemde kapatmış) | plan aynı kural (A); devirsiz programın sonucu ölçülür, fark S-T4-1 sınıfına ayrılır | devir-d3-kilit-bag |
| k-3 | Kilit K'den ÖNCE (30.06), belge kilitli dönemde (01.05) KISMEN bağsız kapanmış; K sonrası Mahsup Et o belgeyle | ayrılan pay = devirsiz kuyruğun mahsuba verdiği pay (kilit sınırı dahil); devirli = devirsiz | devir-d3-kilit-bag |
| k-4 | Kilit K'de, belge K'de kısmen bağsız kapanmış; Ocak'ta Mahsup Et kalan tutarla | aynı | devir-d3-kilit-bag |
| k-5 | Devirsiz eşdeğerde S-T4-1 farkı "her fark BAŞARISIZ" sayılır ya da tersine HER fark S-T4-1 diye yutulur | yalnız S-T4-1 imzası (kilitten sonra kurulmuş bağ, hedefi K'de kapanmış ≤K fatura, devirsiz kuyrukta bu bağ faturayı kapatıyor, fark yalnız iki kalem arasında o tutarın yer değiştirmesi, bakiye aynı) ayrı sayaçta "BEKLENEN FARK (S-T4-1)"; öbür her fark BAŞARISIZ | devir-d3-kilit-bag + gerçek veri |
| k-6 | Kilit paketi girince (program A'ya geçince) test kırmızıya döner | devirli sayıları elle sabit; devirsiz ya S-T4-1 öncesi sayılar ya A sayıları (ikisi dışı BAŞARISIZ) — kilit paketi girince yalnız A kalır | devir-d3-kilit-bag |
| k-7 | Gerçek veri (v2.5.0 GERÇEK kodu) tohum 11'deki fark yine "fark 12" diye kırmızı / ya da yeni bir fark S-T4-1 sayacına kaçar | S-T4-1 sayacı ayrı satır; sınıf dışı fark 0 | devir-d3-gercek-veri |

### İş 3a — K kuyruğunda payı SIFIRA inmiş belgeye ≤K bağlı tahsilat (DOĞRULANMADI-3)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| z-1 | Aralık satış 400 bütünüyle Ocak mahsubuna ayrılır (K kuyruğunda payı 0); ≤K tahsilat bu faturaya BAĞLI (geriye tarihli giriş, kilitsiz) → bağ kuyrukta hedefsiz kalıp hata / çift kapama / kayıp | devirsiz ile aynı: bağ kapatamadığı tutarı bağsız gibi dağıtır (karar (2)); açık kalemler, net, gecikmiş devirli = devirsiz | devir-d3-sifir-pay |
| z-2 | Aynı, fatura kısmen ayrılmış (pay 0'a inmemiş) | bağ kalan payı kapatır, fazlası bağsız; devirli = devirsiz | devir-d3-sifir-pay |
| z-3 | Ayrılan pay K kuyruğundaki faturanın tutarını değil yalnız satırı küçültür (fatura kaydı eski tutarla kalır → kuyruk iki tutar görür) | kuyruğun gördüğü tutar ayrılmış pay düşülmüş tutar | devir-d3-sifir-pay |

### İş 3b — Arka plan yazıcılarının veri damgasına etkisi (DOĞRULANMADI-4; BM-T4-2)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| v-1 | Zamanlanmış / elle yedek, bütünlük taraması, analiz işçisi, defter dondurma, giriş / oturum izi damgayı değiştirir (devir sebepsiz durur) | değiştirmez | devir-d3-damga |
| v-2 | Para tablosuna yazan arka plan / kullanıcı yolu (tekrarlayan fatura taslağı, taksit tahsilatı düzeltmesi, kayıt tahsilatı düzeltmesi) damgayı değiştirmez (bayat ön izlemeyle devir sürer) | değiştirir | devir-d3-damga |
| v-3 | Kaynakta YENİ bir iz türü (yeni para yazıcısı) veri damgasının listesine girmeden eklenir | kaynak tarayan test kırılır: her iz türü ya veri damgasında ya gerekçeli "veri dışı" listede | devir-d3-damga-kaynak |
| v-4 | Kaynak taraması CRLF'li dosyada satırı yanlış böler (ders 27) | `/\r?\n/` | devir-d3-damga-kaynak |
| v-5 | Damganın saydığı tablo listesi bir B / A tablosunu kaçırır ve o tablonun yazımı iz bırakmaz | B / A tablosu ya damga listesinde ya iz türüyle karşılanmış ya gerekçeli dışarıda | devir-d3-damga-kaynak |

### İş 4 — Kâhin okumaları
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| a-1 | (a) Kararın örneği (Aralık satış 400 + alış 150; 16.01 Ocak satış 300 vade 30.01; 17.01 Mahsup Et 150): devir o gün yapılırsa plan, devirsiz programın O GÜNKÜ sayısından ayrışır | 01.01, 16.01, 17.01, 29.01, 01.02'de: devirsiz program (sahte saat o gün; o güne kadar girilmiş veri; API'den okunan gecikmiş) = o gün hazırlanan ön izlemenin devirli eşdeğeri; beklenen (elle): 250 / 250 / 400 / 400 / 550 | devir-d3-tarih |
| a-2 | (a) Bütün veri girildikten SONRA geriye dönük gün görünümü (programın tek borç sırası Mahsup Et'i tarihten bağımsız 0. adımda uygular — karar (2) = A) | devirli = devirsiz o görünümde de (400 / 400 / 400 / 400 / 550); kâhinin "kendi gününden itibaren" okumasıyla bu görünümün ayrışması raporda (programın geriye dönük gecikmiş görünümü var mı — ölçülür) | devir-d3-tarih |
| a-3 | (b) Bakiyesi 0 cari (Kasım satış 400, Aralık tahsilat 400; Ocak alış 150 ↔ Kasım satışı Mahsup Et): M12 "bakiye 0 → satır yok" kuralı iki yönlü açık kalemi yutar | iki yönlü kalem yeni yıla taşınır (satış 150 borç kalemi + 150 avans); bakiye 0; devirli = devirsiz; iki seçenek | devir-d3-tarih |
| a-4 | (b) Avans kalemi ayrı açık kalem mi net satır mı (M2 A "net açılış satırı … K'de açık ALACAK") — iki seçenekte biçim ayrışır | ölçülür ve raporda yazılır; para (bakiye, gecikmiş) aynı | devir-d3-tarih |

### İş 5 — Test düzeni
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| t-1 | Mutasyon tabanı `devir-d3-uc` / `devir-d3-zaman` olmadan koşar (o testlerin kırmızısı mutasyonda görülmez) | taban 20+ dosya; ikisi tabanda yeşil | devir-d3-mutasyon |
| t-2 | Katalog üreticisi her neden için "ilk örneği" kayıt dosyasının yazım sırasından seçer; testler başka sırayla koşunca katalog değişir | örnek ve sıra koşu sırasından bağımsız (iki farklı sırayla üretilen iki katalog bayt bayt aynı) | katalog iki kez üretilir |
| t-3 | "Bu Yıl Zaten Devredildi" iletisindeki gün gerçek saatten (koşu günü) gelir → katalog her gün değişir | gün testin sahte saatinden | devir-d3-ikinci |

### İş 6 — Windows (ders 48)
| # | Bozulma | Beklenen | Test |
|---|---|---|---|
| w-1 | `devir-d3-ikinci` arşiv klasörünü silerken programda / iş parçacığında arşiv dosyasına açık tutamaç var (Windows'ta EBUSY) | silmeden ÖNCE açık tutamaç 0 (Linux /proc/self/fd ile ölçülür, rapora yazılır) | devir-d3-ikinci |
| w-2 | "Açmayı denedi → sonra dosya değişti" sırası: ön izleme arşiv dosyasının VARLIĞINA bakarken dosya silinir | ön izleme yalnız varlığa bakar (açmaz); silmeden sonra yeni ön izleme "dosyası yok" der | devir-d3-ikinci |

### Ortak (her iş)
| # | Bozulma | Beklenen |
|---|---|---|
| o-1 | Saat dilimi: UTC ↔ İstanbul'da gün sınırı (K / K+1; 01.01 03:30) | iki TZ aynı sayılar |
| o-2 | Yarıda kesilme: ön izleme iş parçacığı kesilirse | veri aynı (D3 yazmaz); sonraki ön izleme baştan |
| o-3 | İleti: yeni neden eklenirse iç kod / İngilizce / tablo adı sızar | bu turda yeni ileti yok; eklenirse aynı yardımcı + iletiDenetimi |
