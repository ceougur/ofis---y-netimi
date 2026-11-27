# Muhasebeleştirme Kural Kitabı — DestekOfis 2.5.0 (kâhinin kaynağı)

> **Bu kitap programın kodu görülmeden planlardan, kılavuzdan ve mevzuattan yazıldı.**

Durum: TASLAK — mali müşavir ajanı, temas noktası P (05.11.2026). Kodu görmeyen başka bir ajan Python kâhinini bu kitaptan kurar; program onunla karşılaştırılır.
Kitap programın bugün ne yaptığını TAHMİN ETMEZ; ne YAPMASI GEREKTİĞİNİ yazar. Programla ayrışma önce hatadır (ders 6); kural netleştirmesi yalnız kullanıcı
kararından ya da önceden yazılmış karar metninden gelir (ders 40, 43). "KARAR GEREKİYOR" (KG-n) satırları §9'da; karar verilene kadar kâhin o satırı İKİ DALLI kurar
(her seçenek ayrı beklenen sonuç), seçilmeyen dal kanıt sayılmaz.

Kaynaklar: `docs/erp/MUHASEBE-CEKIRDEGI-TALIMATI.md`, `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md`, `docs/devir/DEVIR-PLANI.md` (G bölümü geçerli), `docs/2.5.0-IS-LISTESI.md`,
`docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html` (2.4.9), `docs/kilavuz/FATURA-SAHIP-KILAVUZU.html`; mevzuat ve program belgeleri §10.

---

## 1. Gösterim ve genel kurallar

**Simgeler.** M = matrah (KDV hariç, belgede gösterilen iskonto düşülmüş net; KDVK 25/a); K = belgedeki KDV; T = KDV tevkifatı (tevkif edilen KDV); S = gelir / kurumlar
vergisi stopajı; BS = BSMV; Kom = komisyon; CH = carinin hesabı; ÖY = ödeme yolu hesabı; G = geçici açılış hesabı "Eşleştirilecek Açılış Bakiyeleri" (kod KG-1, öneri 519).

**G-1 Tutar.** Kuruş tamsayı. Belgeye dayanan maddede (fatura, makbuz, banka fişi) defter BELGENİN KENDİ toplamlarını kullanır (M, K, T, S belgede ne yazıyorsa); fatura satır
matematiği (yuvarlama, KDV dahil fiyat, iskonto dağıtımı) bu kitabın konusu değildir. Bu kitabın kendisinin hesapladığı tutarlarda (stok değeri, satışların maliyeti, KDV mahsubu,
kapanış) yuvarlama: ürün / satır başına kuruşa, yarım yukarı (0,5 kuruş → 1 kuruş, eksi tutarda mutlak değere uygulanır); toplam = yuvarlanmış satırların toplamı.

**G-2 Cari hesabı (CH).** Her cari tek hesapta izlenir (muavin boyutu = cari kimliği): Müşteri → 120 Alıcılar, Tedarikçi → 320 Satıcılar, Diğer → 336 Diğer Çeşitli Borçlar
(tür ↔ hesap eşlemesi Ç1'de yazılır; "Diğer" türünün adı kılavuzda yok → DOĞRULANMADI). Bir caride satış da alış da olabilir; hesap değişmez, ters bakiye mali tabloda
brütleştirilir (§7.3). Kilitli dönemde tür değişmez (kılavuz); açık dönemde tür değişince o carinin açık dönem maddeleri yeni hesapla yeniden türetilir.

**G-3 Ödeme yolu hesabı (ÖY).**

| Yol | Tahsilatta (borç) | Ödemede (alacak) | Alt hesap |
|---|---|---|---|
| Nakit | 100 Kasa | 100 Kasa | — (yalnız Nakit Kasa) |
| Havale / EFT | 102 Bankalar | 102 Bankalar | 102.NN = banka hesabı |
| POS | 108 Diğer Hazır Değerler (brüt) | — | 108.NN = POS |
| Kredi Kartı (şirket kartı) | — | 309 Diğer Mali Borçlar | 309.NN = kart |
| Çek (alınan / verilen) | 101 Alınan Çekler .01 Portföy | 103 Verilen Çekler ve Ödeme Emirleri (−) | 101.01 / 101.02 Bankada Tahsilde |
| Senet (alınan / verilen) | 121 Alacak Senetleri .01 Portföy | 321 Borç Senetleri | 121.01 / 121.02 Bankada Tahsilde |
| Portföyden Ciro | — | 101.01 ya da 121.01 | evrak |
| Açık Hesap / Taksit | (madde yok — alacak / borç CH'de kalır) | — | — |

**G-4 Tarih.** Madde tarihi = belgenin / işlemin tarihi (fatura: belge tarihi; tahsilat / ödeme: işlem tarihi; banka: işlem tarihi, valörlü kalemde §3-D). İleri tarih yoktur (kılavuz).
Aynı gün sırası (ders 31): (1) açılış sınıfı (günün başı) → (2) olağan maddeler, yazım sırasıyla → (3) dönem sonu sınıfı (KDV mahsubu, stok değerleme) → (4) kapanış sınıfı (günün sonu).
Sınıf içi sıra hiçbir bakiye ya da toplamı değiştirmez.

**G-5 Tek olay = tek etki** (talimat §3, §9). Fatura gelir / gider olayıdır; ödemesi ayrı bir tahsilat / ödeme olayıdır ve ikinci kez gelir / gider yazmaz. Taksit kartı, vade tarihi,
Beklenen Ödeme Tarihi, Kapatılacak Fatura bağı, planlı banka işlemi defter olayı DEĞİLDİR. Banka transferi gelir değildir; kredi kullanımı gelir, anapara ödemesi gider değildir;
kart borcu ödemesi ikinci kez gider yazılmaz; müşteriden alınan avans satış değildir (CH'de alacaklı bakiye, §7.3).

**G-6 Denklik ve bütünlük.** Her madde Σ borç = Σ alacak > 0; sıfır tutarlı satır yazılmaz. Saklanan fiş (Ç2) tek işlemde yazılır, değiştirilemez / silinemez, düzeltmesi ters kayıtla.

**G-7 Türetilmiş maddelerde düzeltme.** Açık dönemde kaynak kayıt düzenlenir / silinir / iptal edilirse türetilmiş madde de yeniden türetilir (ters kayıt gerekmez; madde yok olur ya da
değişir). Kilitli dönemde kaynak değişmez (409) ve kilitli dönemin maddeleri donmuştur (Ç3). Silinen kayıt Silinenler'den geri yüklenirse maddesi aynen geri gelir.

**G-8 Belgesiz / sınıflandırılmamış olaylar.** Hesap eşlemesi kesin olmayan olay rastgele hesaba atanmaz (talimat §4); bu kitapta bunlar "SINIFLANDIRILMAMIŞ" alt hesabıyla
(ör. 602.90, 770.90) ya da KG kararıyla yazılır ve mali tablolarda ayrı satır / dipnotla görünür.

---

## 2. Hesap planı (bu kitabın kullandığı hesaplar)

Tür: A aktif, P pasif, Ö özkaynak, (−) düzenleyici / eksi; GE gelir, Gİ gider / indirim, MAL 7/A maliyet, KP kapanış. Kalem: MSUGT bilanço / gelir tablosu kalemi.
"EKLENECEK" = çekirdek planına göre bugünkü planda yok.

| Kod | Ad (Tek Düzen) | Tür | MSUGT kalemi | Ters bakiyede (§7.3) | Not |
|---|---|---|---|---|---|
| 100 | Kasa | A | Dönen I.A Hazır Değerler | Kesin Değil (eksi kasa olamaz) | |
| 101 | Alınan Çekler (.01 Portföy, .02 Bankada Tahsilde) | A | I.A Hazır Değerler | Kesin Değil | |
| 102 | Bankalar (.NN) | A | I.A Hazır Değerler | Pasif III.A 300 Banka Kredileri (KMH) | hesap bazında |
| 103 | Verilen Çekler ve Ödeme Emirleri (−) | A(−) | I.A Hazır Değerler içinde eksi | Kesin Değil | |
| 108 | Diğer Hazır Değerler (.NN POS; .90 Yoldaki Transferler KG-19) | A | I.A Hazır Değerler | Kesin Değil | |
| 120 | Alıcılar (cari) | A | I.C Ticari Alacaklar | Pasif III.D 340 Alınan Sipariş Avansları | cari bazında |
| 121 | Alacak Senetleri (.01, .02) | A | I.C Ticari Alacaklar | Kesin Değil | |
| 128 | Şüpheli Ticari Alacaklar (cari) | A | I.C Ticari Alacaklar | Kesin Değil | |
| 129 | Şüpheli Ticari Alacaklar Karşılığı (−) (cari) | A(−) | I.C içinde eksi | Kesin Değil | |
| 136 | Diğer Çeşitli Alacaklar | A | I.D Diğer Alacaklar | — | yalnız sunum (336, 309 ters) |
| 153 | Ticari Mallar | A | I.E Stoklar | Kesin Değil | dönem sonu değerleme §5 |
| 159 | Verilen Sipariş Avansları | A | I.E Stoklar | — | yalnız sunum (320 ters) |
| 190 | Devreden KDV | A | I.H Diğer Dönen Varlıklar | — | |
| 191 | İndirilecek KDV | A | I.H Diğer Dönen Varlıklar | — | |
| 193 | Peşin Ödenen Vergiler ve Fonlar | A | I.H Diğer Dönen Varlıklar | — | stopaj |
| 198 | Diğer Çeşitli Dönen Varlıklar | A | I.H Diğer Dönen Varlıklar | — | yalnız sunum (360 ters, KG-14) |
| 255 | Demirbaşlar | A | II.D Maddi Duran Varlıklar | — | amortisman yok → dipnot |
| 300 | Banka Kredileri (.NN) | P | III.A Mali Borçlar | Kesin Değil | vade ayrımı yok → dipnot |
| 309 | Diğer Mali Borçlar (.NN şirket kartı) | P | III.A Mali Borçlar | Dönen I.D 136 | |
| 320 | Satıcılar (cari) | P | III.B Ticari Borçlar | Dönen I.E 159 | cari bazında |
| 321 | Borç Senetleri | P | III.B Ticari Borçlar | Kesin Değil | |
| 336 | Diğer Çeşitli Borçlar (cari) | P | III.C Diğer Borçlar | Dönen I.D 136 | cari bazında |
| 340 | Alınan Sipariş Avansları | P | III.D Alınan Avanslar | — | yalnız sunum (120 ters) |
| 360 | Ödenecek Vergi ve Fonlar | P | III.F Ödenecek Vergi ve Diğer Yükümlülükler | KG-14 | |
| 370 | Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları | P | III.G Borç ve Gider Karşılıkları | — | EKLENECEK yalnız KG-13 B'de |
| 391 | Hesaplanan KDV | P | III.I Diğer Kısa Vadeli Yabancı Kaynaklar | — | |
| 500 | Sermaye | Ö | V.A Ödenmiş Sermaye | — | yalnız eşleştirme fişiyle (§3-M) |
| 519 | Eşleştirilecek Açılış Bakiyeleri (Geçici) | Ö | V. sonunda ayrı satır "Eşleştirilecek Açılış Bakiyeleri (Geçici)" | aynı satır, eksi | EKLENECEK; kod KG-1 |
| 570 | Geçmiş Yıllar Kârları | Ö | V.D | — | EKLENECEK |
| 580 | Geçmiş Yıllar Zararları (−) | Ö(−) | V.E | — | EKLENECEK |
| 590 | Dönem Net Kârı | Ö | V.F | — | EKLENECEK |
| 591 | Dönem Net Zararı (−) | Ö(−) | V.F | — | EKLENECEK |
| 600 | Yurt İçi Satışlar | GE | GT A Brüt Satışlar | | |
| 601 | Yurt Dışı Satışlar | GE | GT A | | KG-24 |
| 602 | Diğer Gelirler (.90 Sınıflandırılmamış) | GE | GT A | | |
| 610 | Satıştan İadeler (−) | Gİ | GT B Satış İndirimleri | | |
| 621 | Satılan Ticari Mallar Maliyeti (−) | Gİ | GT D Satışların Maliyeti | | EKLENECEK |
| 631 | Pazarlama Satış ve Dağıtım Giderleri (−) | Gİ | GT E Faaliyet Giderleri | | EKLENECEK (yansıtma) |
| 632 | Genel Yönetim Giderleri (−) | Gİ | GT E | | EKLENECEK (yansıtma) |
| 642 | Faiz Gelirleri | GE | GT F Diğer Faaliyetlerden Olağan Gelir ve Kârlar | | |
| 644 | Konusu Kalmayan Karşılıklar | GE | GT F | | |
| 649 | Diğer Olağan Gelir ve Kârlar (.90 Sınıflandırılmamış) | GE | GT F | | |
| 653 | Komisyon Giderleri (−) | Gİ | GT G Diğer Faaliyetlerden Olağan Gider ve Zararlar | | POS — KG-6 |
| 654 | Karşılık Giderleri (−) | Gİ | GT G | | |
| 659 | Diğer Olağan Gider ve Zararlar (−) | Gİ | GT G | | |
| 660 | Kısa Vadeli Borçlanma Giderleri (−) | Gİ | GT H Finansman Giderleri | | EKLENECEK (yansıtma) |
| 689 | Diğer Olağandışı Gider ve Zararlar (−) | Gİ | GT J Olağandışı Gider ve Zararlar | | gecikme zammı (KKEG) |
| 690 | Dönem Kârı veya Zararı | KP | — | | EKLENECEK |
| 691 | Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları (−) | KP | GT K | | EKLENECEK (KG-13) |
| 692 | Dönem Net Kârı veya Zararı | KP | — | | EKLENECEK |
| 760 / 761 | Pazarlama Satış ve Dağıtım Giderleri / Yansıtma | MAL | (raporda 631 olarak) | | 761 EKLENECEK |
| 770 / 771 | Genel Yönetim Giderleri (.90 Sınıflandırılmamış) / Yansıtma | MAL | (raporda 632 olarak) | | ad Tek Düzen adıyla; 771 EKLENECEK |
| 780 / 781 | Finansman Giderleri / Yansıtma | MAL | (raporda 660 olarak) | | 781 EKLENECEK |

7/A seçilir (§9 KG yok; gerekçe rapor (B) Q1): giderler 760 / 770 / 780'e yazılır, raporda ve kapanışta 761 / 771 / 781 aracılığıyla 631 / 632 / 660'a yansıtılır.

---

## 3. Olay → madde tabloları

Sütunlar: # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Alt hesap / cari | Mali tablo kalemi | Not.

### 3-F. Fatura ve makbuz

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Alt hesap / cari | Kalem | Not |
|---|---|---|---|---|---|---|---|---|
| F-01 | Satış faturası (Stoktan Satış, Hizmet Satışı, Fiyat Farkı; e-Fatura, e-Arşiv, Müşteri Fişi aynı) | belge tarihi | CH | 600; 391 | CH = M + K − T; 600 = M; 391 = K − T | cari | GT A; Bilanço I.C / III.I | Stoklu satışta maliyet maddesi YOK (aralıklı envanter, §5). Peşin kısım ayrı olay (T-01…). Taksit / vadeli kalan: madde yok |
| F-02 | Satış faturası, KDV istisnalı / %0 | belge tarihi | CH | 600 (ihracatta 601, KG-24) | CH = M; 391 = 0 | cari | GT A | |
| F-03 | Satış faturasında KDV tevkifatı (alıcı tevkifat sorumlusu) | belge tarihi | CH | 600; 391 | 391 = K − T; T alıcının 2 No.lu beyanıdır, satıcıda 391'e girmez | cari | | DOĞRULANMADI (KDV GUT birincil metin açılamadı) |
| F-04 | Vadeli satış | belge tarihi | CH | 600; 391 | F-01 | cari | | Gelir tahsilat beklenmeden belge döneminde; sonraki tahsilat gelir yazmaz (talimat §7) |
| F-05 | Alış faturası — Stoğa Mal Alışı | belge tarihi | 153; 191 | CH; 360 (T varsa) | 153 = M; 191 = K (tevkifatlıda da TAMAMI); CH = M + K − T; 360 = T | cari | Bilanço I.E / I.H / III.B / III.F | 191'in indirim dönemi KG-7 |
| F-06 | Alış faturası — Hizmet ve Gider Alışı | belge tarihi | gider türü hesabı (varsayılan 770; satış / dağıtım türü 760; finansman türü 780; demirbaş 255); 191 | CH; 360 (T + S varsa) | gider = M; 191 = K; CH = M + K − T − S; 360 = T + S | cari | GT E (yansıtma) / Bilanço II.D | Gider türü → hesap eşlemesi Ç1'de yazılır (DOĞRULANMADI); kira stopajı burada S |
| F-07 | Satıştan iade faturası | belge tarihi (iade) | 610; 191 | CH | 610 = M; 191 = K | cari; asıl fatura bağı | GT B | KDVK 35: iade KDV'si iade döneminde indirim; 391 borcu alternatifi KG-8. Stok miktarı girer, maliyet maddesi yok |
| F-08 | Alıştan iade faturası | belge tarihi | CH | 153 (gider alışında ilgili gider hesabı); 391 | CH = M + K; 153 = M; 391 = K | cari | | |
| F-09 | Ocak'ta önceki yılın (arşiv) faturasının iadesi | iade tarihi (yeni yıl) | F-07 / F-08 | F-07 / F-08 | asıl faturanın kalem fiyatları ve oranları arşivden | cari; arşiv başvurusu (yıl + belge no + tarih) | | Açık kalem (N-08) varsa önce onu kapatır. G13.1 |
| F-10 | e-SMM / SMM — kullanıcı serbest meslek erbabı (makbuz düzenler) | makbuz tarihi | CH; 193 | 600; 391 | 600 = brüt; 193 = S; 391 = K − T; CH = brüt − S + K − T | cari | GT A / I.H | VUK 236: makbuz tahsilatta düzenlenir; tahsil esası notu §7.5 |
| F-11 | Gelen SMM (avukat, müşavir ücreti — gider) | belge tarihi | 770; 191 | CH; 360 | 770 = brüt; 191 = K; 360 = S + T; CH = brüt + K − S − T | cari | | |
| F-12 | Faturanın peşin / sonradan ödemesi | ödeme satırının tarihi | T-01…T-08 | | | | | Ayrı olay; gelir / gider yazmaz |
| F-13 | Taslak, Proforma, Tekrarla'nın taslağı | — | — | — | madde yok | | | Kaydedilince F-01 / F-05 |
| F-14 | Faturayı Düzenle (açık dönem) | — | — | — | maddeler yeni hâliyle yeniden türetilir (G-7) | | | |
| F-15 | İptal Et (açık dönem) | — | — | — | faturanın ve bağlı ödemelerinin maddeleri hiç yok sayılır (G-7) | | | Kilitli dönemde yapılamaz; e-Arşiv iptalinde beyan edilmiş ay ihtimali §9 KG-7 notu |
| F-16 | Mahsup Et / Kapatılacak Fatura (aynı cari) | — | — | — | madde yok (aynı CH içinde kapama) | | | Farklı hesaplı iki cari arasında mahsup yoktur (kılavuz cari içi) |
| F-17 | Müşteri Fişi Olarak Bırak / Kâğıt Makbuz Olarak Bırak | — | — | — | defter etkisi değişmez | | | |

### 3-T. Tahsilat ve ödeme (cari, fatura, taksit, stok, mobil)

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Alt hesap / cari | Kalem | Not |
|---|---|---|---|---|---|---|---|---|
| T-01 | Tahsilat — Nakit | işlem tarihi | 100 | CH | tutar | cari | | Fatura / taksit bağı defteri değiştirmez |
| T-02 | Tahsilat — Havale / EFT | işlem tarihi | 102.NN | CH | tutar | hesap; cari | | |
| T-03 | Tahsilat — POS | satış (çekim) tarihi | 108.NN | CH | brüt tutar | POS; cari | | Komisyon ve valör §3-D |
| T-04 | Tahsilat — Çek / Senet alma (Taksite Say, Kapatılacak Fatura dahil) | evrak alış tarihi | 101.01 / 121.01 | CH | evrak tutarı | evrak; cari | | |
| T-05 | Ödeme — Nakit / Havale | işlem tarihi | CH | 100 / 102.NN | tutar | cari | | |
| T-06 | Ödeme — Kredi Kartı (cari, alış faturası) | işlem tarihi | CH | 309.NN | tutar | kart; cari | | Banka bakiyesi değişmez |
| T-07 | Ödeme — Çek / Senet verme | evrak tarihi | CH | 103 / 321 | evrak tutarı | evrak; cari | | |
| T-08 | Ödeme — Portföyden Ciro | ciro tarihi | CH | 101.01 / 121.01 | evrak tutarı | evrak; cari | | |
| T-09 | Müşteriye para iadesi (− Ödeme; iade bedeli, fazla tahsilat) | işlem tarihi | CH | ÖY | tutar | cari | | Gelir / gider değildir |
| T-10 | Tedarikçiden para iadesi (+ Tahsilat) | işlem tarihi | ÖY | CH | tutar | cari | | |
| T-11 | Kredi Kartına İade (tedarikçi / müşteri parayı şirket kartına iade etti) | işlem tarihi | 309.NN | CH | tutar | kart; cari | | POS satışı oluşmaz |
| T-12 | Avans tahsilatı (faturasız peşin) | işlem tarihi | ÖY | CH | tutar | cari | Bilanço 340 (ters bakiye sunumu) | Satış değildir |
| T-13 | Şüpheli kaydı açık caride tahsilat | işlem tarihi | ÖY | 128 (şüpheliden) ya da CH ("Normal Cari Hesaba İşle" / fatura peşini / Kapatılacak Fatura bağı) | tutar; şüpheliden düşen ≤ kalan şüpheli | cari | | Karşılık çözülmesi J-04 |
| T-14 | Eski kayıt (tablo) tahsilatı — cariye bağlı değil | işlem tarihi | 100 | KG-3 | tutar | — | | Müvekkil / icra emaneti riski |

### 3-K. Kasa ve banka

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Alt hesap | Kalem | Not |
|---|---|---|---|---|---|---|---|---|
| K-01 | Kasa + Tahsilat (carisiz diğer nakit gelir) | işlem tarihi | 100 | KG-3 (öneri 649.90) | tutar | — | | |
| K-02 | Kasa − Ödeme (carisiz nakit gider) | işlem tarihi | 770.90 | 100 | tutar | — | GT E (632) "Sınıflandırılmamış Kasa / Banka Giderleri" | Hesap seçimi 2.5.1; dipnot §7.5 |
| K-03 | Bankadan Kasaya Aktar | işlem tarihi | 100 | 102.NN | tutar | hesap | | |
| K-04 | Kasadan Bankaya Yatır | işlem tarihi | 102.NN | 100 | tutar | hesap | | |
| K-05 | Bankalar arası transfer (valörsüz) | işlem tarihi | 102.alıcı | 102.gönderen | alıcıya giren tutar | iki hesap | | Gelir / gider değildir |
| K-06 | Transfer ücreti + ücret vergisi | işlem tarihi | 770 (KG-22) | 102.gönderen | ücret + BS | gönderen | | BSMV giderin parçası |
| K-07 | Valörlü transfer | çıkış: işlem tarihi; giriş: valör | çıkışta 108.90, valörde 102.alıcı | çıkışta 102.gönderen, valörde 108.90 | tutar | | | KG-19 |
| K-08 | Banka masrafı (+ Masraf) — BSMV dahil / hariç | işlem tarihi | 770 (KG-22) | 102.NN | masraf + BS | hesap | | |
| K-09 | Banka masrafı — faturalı (KDV dahil / hariç) | işlem tarihi | 770; 191 | 102.NN | 770 = M; 191 = K | hesap | | |
| K-10 | Faiz geliri (mevduat) | işlem tarihi | 102.NN; 193 | 642 | 642 = brüt; 193 = stopaj; 102 = net | hesap | GT F | |
| K-11 | Faiz gideri | işlem tarihi | 780 | 102.NN | tutar (+ BS) | hesap | GT H (660) | |
| K-12 | Diğer Gelir / Diğer Gider (banka) | işlem tarihi | 102.NN / 659 | 649 / 102.NN | tutar | hesap | GT F / G | KG-22 |
| K-13 | Planlı İşlem | — | — | — | madde yok; Gerçekleştir'de ilgili olay | | | |
| K-14 | Hesapsız (Açılıştan Önce) hareket / Devir Kapanışı / Bankaya Geçmiş Say | hareketin tarihi | banka tarafı yerine G | CH (tahsilatta); ödemede ters yön | tutar | cari | | Para zaten banka açılış bakiyesinin içinde → çift sayım olmaz |
| K-15 | Kart Borcuna Aktar (eski kart hareketi) | hareketin tarihi | CH | 309.NN | tutar | kart | | Açılıştan önceyse 309 yerine G (K-14 mantığı) |

### 3-D. POS, şirket kartı, kredi

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Alt hesap | Kalem | Not |
|---|---|---|---|---|---|---|---|---|
| D-01 | POS satışının bankaya geçmesi (valör / Şimdi Aktar) | valör ya da aktarım tarihi | 102.NN; komisyon hesabı | 108.NN | 108 = brüt; komisyon = Kom + BS; 102 = net | POS; hesap | GT G (653) ya da E (760→631) | Komisyon tarihi ve hesabı KG-6 |
| D-02 | Faturası beklenen KDV'li komisyon (ödeme kuruluşu) — fatura gelince | komisyon faturası tarihi | 191 | komisyon hesabı ya da CH | K | | | KG-6; KDV'si gider değildir |
| D-03 | POS İptal Et (aynı gün, bankaya geçmeden) | — | — | — | T-03 ve bağlı satış hiç yok sayılır (G-7) | | | Komisyonsuz |
| D-04 | POS İadesi (sonradan) | iade tarihi | CH (iade faturasıyla F-07) | 108.NN (geçmemiş) / 102.NN (geçmiş) | iade tutarı | | | Komisyon iadesi KG-20 |
| D-05 | Şirket kartıyla harcama / alış | işlem tarihi | CH ya da 153 (stok, faturasız) | 309.NN | tutar | kart | | Banka değişmez |
| D-06 | Kart Borcu Ödemesi | işlem tarihi | 309.NN | 102.NN | tutar | kart; hesap | | Gider değildir |
| D-07 | Kart faizi / gecikme bedeli | işlem tarihi | 780 | 309.NN | tutar (+ BS) | kart | GT H | |
| D-08 | Kredi Kullanımı | işlem tarihi | 102.NN | 300.NN | kullanılan tutar | kredi | | Gelir değildir |
| D-09 | Kredi Geri Ödemesi — anapara | işlem tarihi | 300.NN | 102.NN | anapara | kredi | | Gider değildir |
| D-10 | Kredi Geri Ödemesi — faiz, BSMV, KKDF, dosya masrafı | işlem tarihi | 780 | 102.NN | toplam | kredi | GT H | |

### 3-Ç. Çek ve senet

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Alt hesap | Not |
|---|---|---|---|---|---|---|---|
| Ç-01 | Çek / Senet Al | alış tarihi | 101.01 / 121.01 | CH | evrak | evrak; cari | = T-04 |
| Ç-02 | Bankaya Tahsile Ver | işlem tarihi | 101.02 / 121.02 | 101.01 / 121.01 | evrak | evrak; banka hesabı | Banka bakiyesi değişmez |
| Ç-03 | Bankadan Geri Al | işlem tarihi | 101.01 / 121.01 | 101.02 / 121.02 | evrak | | |
| Ç-04 | Tahsil Et — portföyden | tahsil tarihi | 100 / 102.NN | 101.01 / 121.01 | evrak | | |
| Ç-05 | Tahsil Et — bankadan | tahsil tarihi | 102.NN (evrakın verildiği) | 101.02 / 121.02 | evrak | | Banka tahsil masrafı K-08 |
| Ç-06 | Ciro Et | ciro tarihi | CH (tedarikçi) | 101.01 / 121.01 | evrak | | = T-08 |
| Ç-07 | Karşılıksız / İade (alınan evrak) | işlem tarihi | CH (müşteri) | 101.0x / 121.0x | evrak | | Müşteri yeniden borçlanır; şüpheliye alma J-01 |
| Ç-08 | Ciro edilen evrakın geri gelmesi (karşılıksız / iade) | işlem tarihi | CH (müşteri) | CH (tedarikçi) | evrak | iki cari | Net etki; iki adımda (101 üzerinden) de yazılabilir, bakiye aynı |
| Ç-09 | Çek / Senet Ver | evrak tarihi | CH | 103 / 321 | evrak | | = T-07 |
| Ç-10 | Verilen evrakın Ödeme Yap'ı | ödeme tarihi | 103 / 321 | 102.NN (çekte çek hesabı) / 100 | evrak | | |
| Ç-11 | Verilen evrakın ödenmeden geri alınması | işlem tarihi | 103 / 321 | CH | evrak | | |
| Ç-12 | İşlemini Geri Al | — | — | — | son işlemin maddesi yok sayılır (G-7) | | |

### 3-H. Taksit

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Not |
|---|---|---|---|---|---|---|
| H-01 | Taksit kartı — kaynağı fatura (fatura ödemesi Taksit) | — | — | — | madde yok (F-01 yazıldı) | Vade planıdır |
| H-02 | Taksit kartı — Carinin Mevcut Borcu / Bu Satışı Taksitlendir | — | — | — | madde yok | Borç ikinci kez yazılmaz (kılavuz) |
| H-03 | Taksit kartı — Yeni Borç (faturasız hizmet / satış) | kart (kayıt) tarihi | CH | KG-2 (öneri 600.90, KDV ayrılmamış) | kart toplamı | Belgesiz gelir |
| H-04 | Taksit tahsilatı | işlem tarihi | ÖY | CH | tutar | = T-01…T-04 |
| H-05 | Taksit − Ödeme / İade | işlem tarihi | CH | ÖY | tutar | = T-09 |
| H-06 | Excel'den yüklenen kart; "Ödenen" (Önceden Ödenen, Açılış) | yükleme açılış tarihi | KG-5 | KG-5 | KG-5 | Açılış kuralı |
| H-07 | Kartı Kapat (kalan varken) | — | — | — | madde yok; alacak CH'de kalır | KG-23 |

### 3-V. KDV ve vergi

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Not |
|---|---|---|---|---|---|---|
| V-01 | KDV Mahsup Fişi (ay için) | ayın son günü, dönem sonu sınıfı | 391 (H); net ≥ 0 ise 190 (İ − H, eksiyse alacağa) | 191 (İ); net < 0 ise 190 (D) ve 360 (H − İ − D) | H = ayın 391 alacak hareketi; İ = ayın (indirim dönemi KG-7) 191 borç hareketi; D = 190 bakiyesi (önceki devreden); net = İ + D − H | Saklanan fiş (Ç2). Bir ay bir kez; Geri Al = ters fiş (R-03) |
| V-02 | Vergi Ödemesi (KDV, muhtasar, stopaj, diğer) | ödeme tarihi | 360 | 100 / 102.NN | tutar | Gider değildir. Fazlası KG-14 |
| V-03 | Gecikme zammı / faizi | ödeme tarihi | 689 | 100 / 102.NN | tutar | KKEG; GT J |
| V-04 | Yıllık gelir / kurumlar vergisi ödemesi | ödeme tarihi | KG-13 | 100 / 102.NN | tutar | |
| V-05 | Stopaj tahakkuku (alış, kira, gelen SMM) | belge tarihi | — | 360 | F-06 / F-11 içinde | |
| V-06 | Stopaj (kesilen; satış SMM, faiz) | belge tarihi | 193 | — | F-10 / K-10 içinde | |

### 3-Ş. Ticari şüpheli alacak (VUK 323, 322)

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Not |
|---|---|---|---|---|---|---|
| J-01 | Şüpheli Alacağa Al (cari ya da karşılıksız evrak kartından) | işlem tarihi | 128 | CH | ≤ carinin borç bakiyesi | Cari bakiyesi (120 + 128 muavini) değişmez |
| J-02 | Karşılık Ayır | işlem tarihi | 654 | 129 | ≤ kalan şüpheli − mevcut karşılık | GT G |
| J-03 | Şüpheliden tahsilat | işlem tarihi | ÖY | 128 | tutar | = T-13 |
| J-04 | Karşılığın fazlasının çözülmesi (karşılık > kalan şüpheli) | tahsilat tarihi | 129 | 644 | karşılık − kalan şüpheli | Aynı yıl ayrılmış karşılıkta 654'ün alacağı da kabul görür (GÖRÜŞ); öneri 644 |
| J-05 | Değersiz Alacak Yaz | işlem tarihi | 129 (karşılık kadar); kalan için 659 (KG-21) | 128 | kalan şüpheli | KDV düzeltmesi program dışı (DOĞRULANMADI) |
| J-06 | Şüpheliden Çıkar | işlem tarihi | CH; karşılık varsa 129 | 128; karşılık varsa 644 | kalan şüpheli; karşılık kadar | |

### 3-S. Stok (aralıklı envanter: satışta maliyet maddesi YOK; maliyet dönem sonu §5)

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Not |
|---|---|---|---|---|---|---|
| S-01 | Stok alışı (fatura) | belge tarihi | F-05 | F-05 | | |
| S-02 | + Giriş (stok modülü, faturasız; "Kasa'ya yansıt" dahil) | işlem tarihi | 153 | ÖY ya da CH | tutar tamamı (KDV ayrılmaz; belgesiz KDV indirilemez → maliyet) | |
| S-03 | − Çıkış satış (stok modülü, faturasız) | işlem tarihi | ÖY ya da CH | KG-2 | KG-2 | Belgesiz satış |
| S-04 | Müşteri İadesi (stok modülü) | işlem tarihi | 610 (KG-2 ile aynı KDV kuralı) | ÖY ya da CH | tutar | Borçtan düşülürse taksit kartı küçülür (madde değişmez) |
| S-05 | Tedarikçiye İade (stok modülü) | işlem tarihi | ÖY ya da CH | 153 | tutar | |
| S-06 | Miktar düzeltmesi / sayım farkı | — | — | — | ayrı madde YOK; fark dönem sonu değerlemesine (§5) girer | 197 / 397 sürekli envanterle 2.5.1 |
| S-07 | Hizmet kalemi | — | — | — | stok maddesi yok | |
| S-08 | Aynı mal için stok girişi + alış faturası | — | — | — | yalnız biri madde üretir | Çift girişte iki madde = hata (tek olay) |

### 3-C. Cari düzeltme

| # | Olay | Tarih | Borç | Alacak | Tutar | Not |
|---|---|---|---|---|---|---|
| C-01 | Borç Yaz (açılış değil) | işlem tarihi | CH | KG-4 (öneri 602.90) | tutar | |
| C-02 | Alacak Yaz (açılış değil) | işlem tarihi | KG-4 (öneri 770.90) | CH | tutar | |
| C-03 | Hareketin Yön'ünü değiştirme (açık dönem) | — | — | — | yeniden türetilir (G-7) | |

### 3-M. Açılışlar (karşı hesap HEP G; gelir / gider / 500 DEĞİL — 30.10 açılış düzeni)

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Not |
|---|---|---|---|---|---|---|
| M-01 | Kasa açılışı | açılış tarihi, açılış sınıfı | 100 | G | tutar (≥ 0) | Bir kez, ilk hareketten önce |
| M-02 | Cari açılışı (Açılış Bakiyesi; is_opening) — borçlu | açılış tarihi | CH | G | tutar | Açıklamadan değil, açılış işaretinden tanınır; KG-16 |
| M-03 | Cari açılışı — alacaklı | açılış tarihi | G | CH | tutar | |
| M-04 | Banka hesabı açılışı (vadesiz / ticari / vadeli) | hesabın açılış tarihi | 102.NN | G | tutar; eksi bakiyede (KMH) yön ters | |
| M-05 | Şirket kartı açılış borcu | açılış tarihi | G | 309.NN | tutar | |
| M-06 | Kredi hesabı açılış borcu | açılış tarihi | G | 300.NN | tutar | |
| M-07 | Stok açılışı (ürün kartı açılış miktarı; Excel toplu) | açılış tarihi | 153 | G | Σ ürün (miktar × açılış birim maliyeti), G-1 yuvarlama | Kasa'ya yansıt işaretliyse S-02 (açılış değil) |
| M-08 | Çek / senet açılış portföyü (cariye işlenmemiş) — alınan | açılış tarihi | 101.01 / 101.02 / 121.01 / 121.02 (durumuna göre) | G | evrak | 602 / 770'e YAZILMAZ |
| M-09 | Çek / senet açılışı — verilen, ödenmemiş | açılış tarihi | G | 103 / 321 | evrak | |
| M-10 | Taksit açılışı | KG-5 | KG-5 | KG-5 | KG-5 | |
| M-11 | Açılış Eşleştirme Fişi (Ç2, tür opening-match) | kullanıcının seçtiği tarih ≥ eşleştirilen açılışların tarihi; açılış sınıfı | G alacak bakiyesi kadar G (ya da hedef) | hedef hesaplar: 500–503, 520–549, 570, 580, 590, 591 ve gerekirse öteki bilanço hesapları | Σ satır = G'nin o tarihteki bakiyesi ya da bir kısmı; G'yi ters bakiyeye geçiremez | Birden çok kez yapılabilir (sonradan açılan hesap); G ≠ 0 iken Bilanço "Kesin Değil" |

### 3-N. Dönem sonu, kapanış, devir (saklanan fiş; arşivde K tarihli, yeni yılda K+1 tarihli)

| # | Olay | Tarih | Borç | Alacak | Tutar kuralı | Not |
|---|---|---|---|---|---|---|
| N-01 | Dönem sonu stok değerleme | K, dönem sonu sınıfı | 621 (fark > 0) / 153 (fark < 0) | 153 / 621 | fark = 153 bakiyesi − DSS (§5.2) | Sonrasında 153 = DSS |
| N-02 | 7/A yansıtma | K, kapanış sınıfı | 631 / 632 / 660 | 761 / 771 / 781 | 760 / 770 / 780 borç bakiyeleri | |
| N-03 | 7/A hesaplarının karşılıklı kapanması | K | 761 / 771 / 781 | 760 / 770 / 780 | aynı tutarlar | Sonrasında 7 sınıfı = 0 |
| N-04 | Sonuç hesaplarının 690'a devri | K | gelir hesapları (60x, 64x, 67x — alacak bakiyeli) ve 690 | 690 ve gider / indirim hesapları (61x, 62x, 63x, 65x, 66x, 68x — borç bakiyeli) | her hesabın bakiyesi; ters bakiyeli sonuç hesabı ters yönde kapanır | Sonrasında 6 sınıfı (690 hariç) = 0 |
| N-05 | Vergi karşılığı | K | 691 | 370 | KG-13 (varsayılan 0, satır yazılmaz) | |
| N-06 | 690 → 692 (691 varsa o da) | K | kâr: 690 / zarar: 692 | kâr: 692 / zarar: 690 | 690 bakiyesi; 691 varsa B 692 / A 691 | |
| N-07 | 692 → 590 / 591 | K | kâr: 692 / zarar: 591 | kâr: 590 / zarar: 692 | 692 bakiyesi | |
| N-08 | Önceki yılların kapanmamış sonucu | K | KG-12 | KG-12 | KG-12 | YÜKSEK-2 |
| N-09 | Devir açılış — modül açılışları (yeni yılda) | K+1, açılış sınıfı | M-01…M-09 (kasa, cari, banka, kart, kredi, stok, çek / senet, taksit) | G | arşivin K bakiyeleri (stok = DSS) | |
| N-10 | Devir açık kalemi (açık fatura kalanı, G2) | K+1 | satışta CH / alışta G | satışta G / alışta CH | K'deki kalan (yön işaretli) | GELİR / GİDER DEĞİLDİR; vade = faturanın vadesi |
| N-11 | Devir — bekleyen POS kalemi | K+1 | 108.NN | G | valörü K'den sonraya kalan brüt (KG-6'ya göre net) | |
| N-12 | Devir — açık şüpheli alacak | K+1 | 128 / G | G / 129 | K bakiyeleri | |
| N-13 | Devir açılış fişi (tamamlayıcı) | K+1 | her bilanço hesabı (1–5 sınıfı, alt hesap ve cari boyutuyla) için arşiv K bakiyesi − N-09…N-12'nin karşıladığı tutar | karşı taraf G | fark kadar | Sonrasında yeni yıl G = arşiv G; 590 / 591 AYNEN açılır |
| N-14 | Devri Yenile | yeniden üretim anı; maddeler K / K+1 tarihli | — | — | arşivin kapanış maddeleri ve yeni yılın devir maddeleri devir çalışma kimliğiyle yerinde yeniden üretilir; önceki devir maddesi kalmaz | Devir Raporu önceki ↔ yeni farkı |
| N-15 | Devri Geri Al | — | — | — | devir maddeleri yok olur (devir öncesi yedek) | |
| N-16 | Kural Değişikliği Farkı düzeltmesi | ilk açık gün | KG-15 | KG-15 | KG-15 | ORTA-1 |

### 3-R. Ters kayıt ve saklanan fiş düzeltmesi

| # | Olay | Tarih | Borç | Alacak | Tutar | Not |
|---|---|---|---|---|---|---|
| R-01 | Banka İşlem Kartı → Ters Kaydet | KG-18 | asıl maddenin alacak hesapları | asıl maddenin borç hesapları | asıl tutarlar | Asıl ve ters madde ikisi de kalır |
| R-02 | Banka → Düzelt | KG-18 | R-01 + doğru işlemin maddesi | | | |
| R-03 | Saklanan fişin ters kaydı (Ç2: kapanış, açılış eşleştirme, KDV mahsubu Geri Al) | ters fişin tarihi (kilitli döneme düşemez) | asıl fişin alacakları | asıl fişin borçları | aynı | reversal_of bağı; aynı fiş iki kez ters kaydedilemez |
| R-04 | Silme → Silinenler'den geri yükleme | — | — | — | G-7 | |

---

## 4. Rapor dönemi ve "hesaplanmış" (kayıt olmayan) satırlar

- Mali yıl = takvim yılı (özel hesap dönemi desteklenmez → BİLİNEN SINIR).
- Gelir Tablosu dönemi [a, b]: 6 ve 7 sınıfı HAREKETLERİ (kapanış sınıfı maddeleri hariç; N-01 dahil). 7/A bakiyeleri raporda 631 / 632 / 660 satırlarında gösterilir.
- Bilanço (asOf = t): 1–5 sınıfı bakiyeleri t günü sonunda (kapanış sınıfı dahil). Kapanış yapılmamışsa iki HESAPLANMIŞ satır (kayıt değil):
  - "Dönem Net Kârı (Zararı)" = t'nin yılının 1 Ocak'ı – t arası 6 / 7 hareketlerinin net sonucu (+ KG-11 A'da tahmini değerleme farkı);
  - "Geçmiş Yıllar Kârları (Zararları) — Kapanmamış" = t'nin yılından ÖNCEKİ, kapanış fişi görmemiş 6 / 7 hareketlerinin net sonucu (KG-12).
- Aktif = Pasif bu iki satırla sağlanmalıdır; sağlanmazsa fark satırı + "Kesin Değil" (denkleştirme kaydı YOK).

## 5. Dönem sonu stok değerlemesi ve satışların maliyeti

**5.1 Birim maliyet (ağırlıklı ortalama alış fiyatı, VUK 274 maliyet bedeli; DEVIR-PLANI §11.4).** Ürün başına, dönem = mali yıl (1 Ocak – K):
birim maliyet = (DBS değeri + Σ dönem alış M'si − Σ dönem alış iadesi M'si) ÷ (DBS miktarı + Σ alış miktarı − Σ alış iadesi miktarı).
DBS = önceki yılın DSS'si (devir varsa açılış stoku; yoksa önceki yıl sonunda bu kuralla hesaplanan değer; ilk yıl: stok açılışı M-07). Alış M'si KDV hariç, iskonto düşülmüş
(F-05; faturasız S-02'de tutarın tamamı). Satış / müşteri iadesi birim maliyeti değiştirmez. Dönemde alışı ve DBS'si olmayan ürün: KG-10.

**5.2 DSS ve fark.** DSS = Σ ürün max(0, K'deki miktar) × birim maliyet (G-1 yuvarlama, ürün başına). Eksi miktarlı ürün: KG-9. Hizmet kalemi stok değildir.
Fark (N-01) = 153'ün K bakiyesi − DSS. Satışların maliyeti (dönem) = DBS + Σ alışlar − Σ alış iadeleri − DSS = 621'in dönem toplamı (N-01 sonrasında).

**5.3 Raporlarda (kapanış öncesi).** KG-11 A seçilirse aynı fark Gelir Tablosu'nda "Satışların Maliyeti (Tahmini)", Bilanço'da 153 "Ticari Mallar (Tahmini Değerleme)"
ve hesaplanmış dönem sonucu içinde birlikte uygulanır (ikisi ayrışmaz); rapor başında "Kesin Değil — Satışların Maliyeti Tahminidir".

## 6. Devir değişmezleri (kâhinin ana denetimi)

1. Arşivde kapanıştan sonra: 6 sınıfı (690 dahil, 691 / 692) ve 7 sınıfı bakiyeleri = 0; 153 = DSS.
2. Her bilanço hesabı, alt hesap ve cari boyutuyla: arşiv K kapanış bakiyesi = yeni yıl K+1 açılış bakiyesi (kuruşu kuruşuna, tolerans yok).
3. Yeni yılda G bakiyesi (K+1 açılış sonrası) = arşivde G'nin K bakiyesi.
4. Modül bakiyeleri K'de iki dosyada eşit: kasa = 100; banka hesabı = 102.NN; kart = 309.NN; kredi = 300.NN; POS bekleyen = 108.NN; portföy = 101 / 121 duruma göre; carinin
   bakiyesi = CH + 128 muavini; stok değeri = 153.
5. Devir açık kalemleri ve açılışlar yeni yılın 6 / 7 sınıfına HİÇ dokunmaz (yeni yılın gelir tablosu devir anında 0).
6. Arşiv ≤K + yeni yıl >K hareket sayısı = devir öncesi.

## 7. Mali tablolar

**7.1 Gelir Tablosu (MSUGT, 7/A):** A Brüt Satışlar (600, 601, 602) · B Satış İndirimleri (−) (610, 611, 612) · C Net Satışlar · D Satışların Maliyeti (−) (620–623; 621) ·
Brüt Satış Kârı · E Faaliyet Giderleri (−) (630, 631 ← 760, 632 ← 770) · Faaliyet Kârı · F Diğer Faaliyetlerden Olağan Gelir ve Kârlar (640–649) · G Diğer Faaliyetlerden Olağan
Gider ve Zararlar (−) (653–659) · H Finansman Giderleri (−) (660, 661 ← 780) · Olağan Kâr · I Olağandışı Gelir ve Kârlar (671–679) · J Olağandışı Gider ve Zararlar (−) (680–689) ·
Dönem Kârı · K Dönem Kârı Vergi ve Diğer Yasal Yükümlülük Karşılıkları (−) (691; program ayırmaz → KG-13) · Dönem Net Kârı. ".90 Sınıflandırılmamış" alt hesaplar ayrı alt satır.

**7.2 Bilanço (MSUGT):** Aktif I Dönen (A Hazır Değerler, C Ticari Alacaklar, D Diğer Alacaklar, E Stoklar, H Diğer Dönen Varlıklar), II Duran (D Maddi Duran Varlıklar);
Pasif III Kısa Vadeli Yabancı Kaynaklar (A Mali Borçlar, B Ticari Borçlar, C Diğer Borçlar, D Alınan Avanslar, F Ödenecek Vergi, G Karşılıklar, I Diğer), IV Uzun Vadeli
(kullanılmaz), V Özkaynaklar (A 500–503, B 52x, C 54x, D 570, E 580, F 590 / 591 ya da hesaplanmış satır, "Geçmiş Yıllar — Kapanmamış" hesaplanmış satır, G "Eşleştirilecek Açılış
Bakiyeleri (Geçici)"). Düzenleyici hesaplar (103, 129, 580, 591) kendi kaleminde eksi.

**7.3 Ters bakiye (cari / hesap bazında BRÜTLEŞTİRME; netleştirme yok):**
alacaklı 120 cari → Pasif III.D 340 Alınan Sipariş Avansları; borçlu 320 cari → Aktif I.E 159 Verilen Sipariş Avansları; borçlu 336 cari → Aktif I.D 136; alacaklı 102.NN (KMH) →
Pasif III.A 300; borçlu 309.NN → Aktif I.D 136; borçlu 360 → KG-14; eksi 100, 101, 103, 108, 121, 128, 153 (ürün), 300, 321 → değer olduğu kalemde eksi + "Kesin Değil"
(fiziksel olarak imkânsız ya da kayıt eksik). 191 ve 391 mahsupsuz aylarda netleştirilmez (191 Aktif I.H, 391 Pasif III.I); biten ay mahsupsuzsa bilgi uyarısı.

**7.4 "Kesin Değil" nedenleri (rapor başında madde madde):** G ≠ 0 (Tamamlanmamış Açılış); satışların maliyeti tahmini (KG-11); defter mutabakatı farkı ya da dengesiz madde; Kural
Değişikliği Farkı (Ç3); eksi kasa / eksi stok / §7.3'teki imkânsız ters bakiyeler; borçlu 360 (KG-14); kapanmamış önceki yıl sonucu (KG-12); Defter Türü bilanço esası değil ("Bilgi Amaçlı").

**7.5 Kalıcı dipnotlar (Kesin Değil'den ayrı; her raporda):** (1) "Bu tablolar DestekOfis kayıtlarından üretilmiştir; yasal defter (e-Defter) ve beyannameye esas mali tablo, KÜMİ FRS /
BOBİ FRS finansal tablosu değildir." (2) "Amortisman, reeskont, gider / gelir tahakkuku, kur değerlemesi ve dönem kârı vergi karşılığı programda yapılmaz." (3) "Kasa ve banka 'Diğer Gider'
çıkışları (… TL) Genel Yönetim Giderleri'ne yazılmıştır; içinde demirbaş, ortak / sahip çekişi, müvekkil masraf avansı ya da borç ödemesi bulunabilir." (4) Krediler vadeye bakılmaksızın
Kısa Vadeli Mali Borçlar'da. (5) Serbest Meslek Kazanç Defteri'nde: "Bu tablo tahakkuk esasına göredir; serbest meslek kazancı tahsil esasına göre hesaplanır; müvekkilden harcanmak üzere
alınan paralar kazanç sayılmaz." (6) Faturasız / sınıflandırılmamış gelir-gider (.90 alt hesaplar) varsa tutarı.

## 8. Genel değişmezler

Her madde Σ B = Σ A > 0 · Mizan Σ B = Σ A · Aktif = Pasif (hesaplanmış satırlarla) · Gelir Tablosu (1 Ocak → t) Dönem Kârı = Bilanço hesaplanmış Dönem Net Kârı (aynı t; KG-11 A'da
tahmini değerleme ikisinde birden) · Yevmiye, Büyük Defter, Mizan, Gelir Tablosu, Bilanço aynı maddelerden · Cari muavin toplamı = CH + 128 · Kilitli dönemin maddeleri kural sürümü
değişince değişmez · İki şirket maddeleri karışmaz · Aynı istek kimliğiyle iki fiş yazılmaz.

---

## 9. KARAR GEREKİYOR (KG) — kâhin bu satırlarda iki dallıdır

"K" işaretli olanlar para / kapama / açılış kuralıdır → KULLANICIYA SORULMALI (ders 43); öbürleri sınıflamadır (net kârı ve bilanço toplamını değiştirmez) → baş mimar + mali müşavir A.

| KG | Konu | Seçenek A | Seçenek B | Öneri |
|---|---|---|---|---|
| KG-1 | Geçici hesap kodu | 519 (Tek Düzen'de boş "51" grubu; 50 / 59 gruplarıyla karışmaz) | 599 | A (GÖRÜŞ) |
| KG-2 K | Belgesiz gelir: stok modülü satışı / müşteri iadesi, taksit Yeni Borç | 600.90 / 610.90'a TAMAMI, KDV ayrılmaz, raporda ayrı satır + dipnot | Stok kartında KDV oranı varsa iç yüzde KDV ayrılır (391), yoksa A | A (program belgeyi bilmez; ÖKC fişli perakendeci için B istenirse şirket ayarı 2.5.1) |
| KG-3 K | Carisiz tahsilat (Kasa + Tahsilat; eski kayıt tahsilatı) | 649.90 Sınıflandırılmamış Gelir | Gelir DEĞİL: 336.90 "Sınıflandırılmamış Tahsilatlar" (pasif) + Kesin Değil | Kayıt tahsilatı B (icra / müvekkil emaneti olabilir, GİB SM rehberi); Kasa + Tahsilat A |
| KG-4 K | Borç Yaz / Alacak Yaz karşı hesabı | Borç Yaz 602.90, Alacak Yaz 770.90 (gelir / gider) | Müşteride Alacak Yaz 611 Satış İskontoları, tedarikçide 770.90; Borç Yaz 602.90 | A (2.5.1 hesap seçimi) |
| KG-5 K | Excel'den yüklenen taksit kartı (T toplam, P önceden ödenen) | AÇILIŞ alacağı: B CH (T − P) / A G; P maddesiz | Yeni satış: B CH T / A 600.90 T; B G P / A CH P | A (programdan önceki satış bu yılın geliri değildir) |
| KG-6 K | POS komisyonu tarihi ve hesabı | Tarih: satış (çekim) günü (B komisyon hesabı / A 108; valörde net) — dönemsellik | Tarih: valör günü (D-01) | Tarih A; hesap 760 (MSUGT 653 "esas faaliyet dışı" tanımı) — sınıflama |
| KG-7 K | Alış KDV'sinin indirim dönemi (geç gelen Aralık faturası) | Alanla: varsayılan belge ayı, kullanıcı kayıt ayına alabilir (KDVK 29/3: izleyen yıl sonuna kadar, kayıt dönemi) | Hep belge ayı; Aralık mahsubu Devri Yenile ile yeniden | A |
| KG-8 | Satıştan iade KDV'si | B 191 (KDVK 35, indirim) | B 391 (hesaplananı azaltır) | A; mahsup sonucu iki dalda aynı |
| KG-9 K | Eksi miktarlı ürün değerlemesi | 0 değer + Kesin Değil | Eksi değer (miktar × birim maliyet) | A |
| KG-10 | Alışı ve DBS'si olmayan ürünün birim maliyeti | Kartın ALIŞ fiyatı (satış fiyatı ASLA) | 0 + uyarı | A, alış fiyatı da yoksa 0 + uyarı |
| KG-11 K | Satışların maliyeti (kapanış öncesi raporlar) | "Tahmini" — Gelir Tablosu VE Bilanço (153, dönem sonucu) birlikte, Kesin Değil | "Hesaplanmadı" — GT'de satır boş, Bilanço'da 153 alış toplamı, Kesin Değil | A |
| KG-12 K | Önceki yılların kapanmamış 6 / 7 sonucu (devir yapılmamış yıllar) | Yıl yıl ayrılır: önceki yılların sonucu 570 / 580'e (kapanışta ve Bilanço'da hesaplanmış satırda); önceki yıl sonları için de §5 değerlemesi | Hepsi 590 / 591'e + Devir Raporu uyarısı | A |
| KG-13 K | Dönem kârı vergi karşılığı ve yıllık vergi ödemesi | 691 / 370 yok; 590 "vergi öncesi" yazılır; kurumlar vergisi ödemesi 360'a (ters bakiye KG-14) | Devir sihirbazında / Devri Yenile'de isteğe bağlı tutar: B 691 / A 370; ödeme B 370. Şahıs işletmesinde sahibin gelir vergisi B 500 (şahsi çekiş) | 2.5.0'da A + Devri Yenile'de B'nin tutar alanı (beyanname Mart / Nisan'da) |
| KG-14 | Borçlu 360 (tahakkuku programda olmayan vergi ödemesi) | Aktif I.H 198 + Kesin Değil | 360 eksi olarak pasifte + Kesin Değil | A |
| KG-15 K | Donmuş (2.4.9 kuralı) kilitli dönemdeki eski açılış sınıflaması (500, açılış evrakı 602 / 770) | İlk açık güne "Kural Farkı Düzeltme Fişi" (ön izleme + onay; ör. B 602 / A G, B G / A 770, B 500 / A G) | Yalnız "Kural Değişikliği Farkı" gösterilir, düzeltilmez (plan) | A |
| KG-16 K | "Açılış…" açıklamalı ama açılış işaretsiz eski Borç / Alacak Yaz | Göçte "Açılış Olabilir" listesi; kullanıcı onaylarsa M-02 / M-03 (G), onaylamazsa C-01 / C-02 | Sessizce C-01 / C-02 (602 / 770) | A |
| KG-17 | "Borç ve Alacakları Aktar"ın defter karşılığı | Ekstrede iki satır; defterde cari başına NET tek açılış maddesi | Defterde de iki satır (mizan borç / alacak toplamı önceki yıl cirosuyla büyür) | A |
| KG-18 | Banka ters kaydının tarihi | Ters kaydın girildiği gün | Asıl işlemin tarihi (kilitli değilse) | Banka modülü planı esas (bu turda okunmadı — DOĞRULANMADI) |
| KG-19 | Valörlü transferde aradaki para | 108.90 Yoldaki Transferler | Çıkış günü doğrudan alıcı hesaba | A (banka ekstresiyle eşleşir) |
| KG-20 | POS iadesinde komisyon iadesi | Yalnız banka iade ederse (B 108 / A komisyon hesabı) | Hiç | A |
| KG-21 | Değersiz alacağın karşılıksız kısmı | 659 | 689 | A (GÖRÜŞ) |
| KG-22 | Banka masrafı ve transfer ücreti / banka Diğer Gelir-Gider | 770 / 649, 659 | 780 / 602, 770 | A (GÖRÜŞ; programlar arasında birlik yok) |
| KG-23 | Kalan varken Kartı Kapat | Alacak CH'de kalır (madde yok) | Kalan değersiz sayılır | A |
| KG-24 | İhracat istisna kodlu satış | 601 Yurt Dışı Satışlar | 600 | A |
| KG-25 | Hesap planındaki "Diğer" cari türünün hesabı | 336 | 120 | Ç1'de yazılır |

## 10. Dayanaklar (erişim 05.11.2026)

Birincil metin: `www.mevzuat.gov.tr` ve `www.resmigazete.gov.tr` bu oturumun ağ ayarlarında izinli değil (WebFetch adres çözemedi) → madde metinleri birincil kaynaktan OKUNAMADI;
aşağıdaki maddeler arama sonuçları ve ikincil kaynaklarla doğrulandı ya da DOĞRULANMADI diye işaretlendi.
- VUK geçici 37 (7571 sayılı Kanun, RG 25.12.2025 / 33118): 2025, 2026, 2027 hesap dönemlerinde (geçici vergi dönemleri dahil) enflasyon düzeltmesi yapılmaz; Cumhurbaşkanı üç döneme
  kadar uzatabilir; altın / gümüş işleyenler istisna; mük. 298/Ç yeniden değerleme yapılabilir — https://kpmgvergi.com/yayinlar/mali-bultenler/vergi/enflasyon-duzeltmesinin-sartlari-olussa-dahi-2025-2026-ve-2027-yillarinda-uygulanmayacagina-iliskin-yasal-duzenleme-resmi-gazete-de-yayimlandi/3343 ,
  https://www.pwc.com.tr/tr/hizmetlerimiz/vergi/bultenler/2025/enflasyon-duzeltmesi-uygulamasini-erteleyen-7571-sayili-kanun.html , VUK GT 587: https://www.resmigazete.gov.tr/eskiler/2025/12/20251224-8.htm (açılamadı).
- Kurumlar vergisi beyanı 1–30 Nisan 2026 (GİB duyurusu): https://www.gib.gov.tr/duyuru-arsivi/guncel/17490_kurumlar_vergisi_beyan_donemi_icin_son_gun_30_nisan_2026 ; yıllık gelir vergisi
  1–31 Mart (GİB 2026 Serbest Meslek Kazancı Rehberi): https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Ffileadmin%2Fbeyannamerehberi%2F2026%2F2026_Serbest_Meslek_Kazanci.pdf
- Serbest meslek kazancı tahsil esası; "harcanmak üzere müşteri veya müvekkilden alınan ve tamamen bu hususlara harcanan para ve ayınlar serbest meslek kazancı sayılmaz" (GİB SM rehberi 2012)
  — https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Fonceki-dokumanlar%2F2012serbestmeslek.pdf (arama özeti; sayfa açılamadı).
- KDVK 29/3 (7104 s. K., 01.01.2019'dan): indirim, vergiyi doğuran olayın takvim yılını izleyen yıl aşılmamak şartıyla belgelerin kanuni defterlere kaydedildiği dönemde — ikincil
  (muhasebetr, KPMG blog); birincil metin DOĞRULANMADI.
- MSUGT Sıra No 1 (RG 26.12.1992 / 21447 mükerrer): hesap planı, hesap açıklamaları, bilanço ve gelir tablosu biçimleri; 7/A zorunluluğu yalnız hadleri aşan üretim ve hizmet işletmeleri,
  ticaret işletmeleri serbest (https://www.alomaliye.com/2021/01/15/2021-yili-7-a-ve-7-b-hadleri/); 2026 hadleri DOĞRULANMADI; tebliğ metni birincil kaynaktan açılamadı.
- KGK: KÜMİ FRS 01.01.2023 ve sonrası dönemler, bağımsız denetime tabi olmayan bilanço esası tacirler (TFRS / BOBİ FRS tercih edilebilir); BOBİ FRS bağımsız denetime tabi, TFRS
  uygulamayanlar — https://kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/KUMI/KU%CC%88MI%CC%87%20FRS%20(Web%20Kurul%20Karar%C4%B1%20enf%20adj).pdf (açılamadı; ikincil kaynaklarla).
- Program belgesi: Netsis (Logo) Sene Sonu Devir SSS — "stok, cari, senet-çek, banka, maliyet muhasebesi devirleri tekrarlanabilir"; vadesi devir tarihinden sonraki kayıtlar yeni yıla aynen
  aktarılır — https://docs.logo.com.tr/download/attachments/50684716/Netsis%20S%C4%B1k%C3%A7a%20Sorulan%20Sorular-SeneSonuDevir.pdf?api=v2 (arama özeti). Wolvox 2026 devir:
  https://bilgibankasi.akinsoft.net/tr/home/makale/3718-wolvox-8-erp-programi-2025-yili-devir-islemleri (arama özeti). Mikro, ETA, Luca, Zirve belgelerine ulaşılamadı.
- POS komisyonu hesabında uygulama birliği yok (653 / 760 / 770 / 780; muhasebetr yazıları) — GÖRÜŞ.
- DOĞRULANMADI (birincil metin açılamadı, bilinen hükümler): VUK 177, 178, 210, 219, 236, 274, 322, 323; GVK 65–68; KDVK 25, 30, 35; KDV GUT tevkifat (satıcıda 391 = K − T);
  değersiz alacakta KDV düzeltmesi; e-Defter Aralık beratı yükleme süresi.
