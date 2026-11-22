# MALİ MÜŞAVİR ARA KABULÜ (MA), temas noktası A — 2.5.0, commit 612f4e99

## ÖZET
- **YÜKSEK yok.**
- **ORTA bulgu bir tane:** KDV Özeti (Beyanname Hazırlığı) raporunun "Ödenecek KDV / Devreden KDV" satırı önceki aydan devreden KDV'yi hesaba katmıyor. Rapordaki "Hesaplanan KDV (391)" ve "İndirilecek KDV (191)" satırları da defterdeki 391 ve 191 ile aynı sayı değil. Bu konu karar dosyasındaki MA listesinde yer alıyor (19.11 04:35 kararı: "rapor bugünkü düzeninde kalır, MA inceler"). Bu yüzden ORTA sınıfıyla ve "KULLANICIYA SORULMALI" başlığı altında yazdım.
- **Defter ve mali tablo sayıları doğru.** 57 yevmiye maddesinin hepsi kendi elle hesapladığım beklenen maddelerle birebir tuttu.
  - Mizan toplamı 291.105,00 = 291.105,00; her ana hesabın bakiyesi benim hesabımla aynı.
  - Gelir Tablosu dönem kârı −2.285,87, Bilanço'daki hesaplanmış dönem kârı da −2.285,87; ikisi aynı.
  - Bilanço: aktif 87.984,13 = pasif 87.984,13 (sonradan eklenen iki olaydan sonra 88.658,04 = 88.658,04).
  - Satışların maliyeti 14.860,87, dönem sonu stok 5.739,13; ikisi de benim hesabımla aynı.
- **Dönem kilidi doğru çalışıyor.** Kilitten önce ve sonra alınan 8 okuma JSON olarak birebir aynı. Kilitli döneme yapılan bütün yazma denemeleri 409 ile reddedildi.
- **DÜŞÜK / GÖRÜŞ** maddeleri aşağıda, "SONRAKİ SÜRÜME (2.5.1)" başlığında.

## Ortam (ders 14 notu — ana oturum bilmeli)
- Görev metnindeki `npm start` (HUKUK_LICENSE_URL=127.0.0.1:9) yeni veri klasöründe lisansı `none` durumunda açıyor; program **salt okunur** çalışıyor, hiçbir veri yazılamıyor.
- Bu yüzden programı ana oturumun yürüyüş düzeneğindeki gibi açtım: `server/app.mjs` içindeki `createApp`, yalnız içe aktarıldı, kod okunmadı (MIMARI.md'de belgelenen test girişi), `license.enforce:false`, saat gerçek (22.11.2026), port 47811.
- Ana düzenekten yalnız `ana-kabul/betik/yuruyus.mjs` dosyasının açılış satırlarını okudum. `test/`, `server/` ve öbür yasak klasörlere dokunmadım. Git yalnız `git reset --hard 612f4e99` ve `git log -1` ile kullanıldı.
- Veri girişi: bir kısmı ekrandan, klavye ve insan hızıyla; kalanı ekranda yakalanan istek gövdeleriyle kullanıcıya açık API'den. Raporlar hem ekrandan hem API'den okundu.
- İş bitince kendi sürecimi (pid 6125, `timeout … sunucu.mjs`) kapattım; veri, yedek ve çerez dosyalarını tam yollarıyla sildim.
- Ortam: yük 0,10 / 4 çekirdek, disk boş 8,4 GB.

## Senaryo ve kendi beklenen mizanım
Kendi beklenen maddelerim `beklenen.py` dosyasında. Tek şirket, 2026, Defter Türü Bilanço Esası. Olaylar:

**Açılışlar (01.01)**
- Kasa 10.000
- Ürün A stoğu 100×50 = 5.000 (153/519)
- Banka 50.000 (102.01)
- Kart borcu 1.500 (519/309.01)
- Epsilon borçlu 5.000, Zeta alacaklı 3.000 (karşı hesap hep 519)

**Alış, satış, iade, KDV**
- Alış 200×60 + KDV 2.400
- Vadeli satış 150×100 + KDV 3.000
- Satıştan iade (610 + 191, KG-8 A)
- Alıştan iade (153 + 391)
- Gider alışı (770 + 191)
- Gelen serbest meslek makbuzu: 10.000 + KDV 2.000, stopaj %20 → 770 / 191 / 360 / 320 (F-11)
- Ağustos alışı, KDV İndirim Dönemi Eylül seçili
- Eylül satışı
- Kasım satışı (şüpheliye almadan sonra)
- KDV mahsubu Ocak (ekrandan), Şubat–Eylül
- Vergi ödemesi 600 + gecikme zammı 15 (689)

**Tahsilat, ödeme, banka**
- Nakit tahsilat
- Havale ödemesi
- POS tahsilatı 3.000: komisyon 60 satış günü 653'e (KG-6 A), valörde net 2.940
- Kredi kartıyla ödeme (320/309.01) ve kart borcu ödemesi
- Banka masrafı, BSMV dahil (770)

**Çek, senet, şüpheli alacak**
- Çek al → tahsile ver → tahsil
- Çek ciro
- Senet karşılıksız (120 yeniden borçlanır)
- Şüpheli alacağa alma 1.300 + karşılık 1.300
- Sonraki tahsilat önce 128'den düştü; karşılık fazlası 129/644 (J-04)

**Taksit, stok, cari düzeltme**
- Mevcut borcu taksitlendirme (madde yok — doğru) ve taksit tahsilatı
- Yeni Borç taksit kartı (120/600.90, KG-2 A)
- Faturasız stok girişi nakit (153/100), faturasız çıkış satış (100/600.90)
- Hareketli Ürün B kartını silme (S207)
- Kasa + carisiz (649.90), Kasa − carisiz (770.90)
- Borç Yaz (602.90), Alacak Yaz (770.90)
- "Açılış…" açıklamalı yeni Borç Yaz → 602.90 (KG-16, işaretten tanınıyor — doğru)

**Kilit, eşleştirme, defter türü**
- Açılış Eşleştirme: 60.000 → 500, 5.500 → 570; fazlası (6.000) 409 ile reddedildi
- Dönem kilidi 30.06
- Defter Türü dört seçenekle denendi

| Hesap | Bakiye | Hesap | Bakiye |
|---|---|---|---|
| 100 | 20.400 B | 360 | 2.060 A |
| 102 | 48.725 B | 391 | 200 A (Kasım, mahsupsuz) |
| 120 | 11.160 B | 500 / 570 | 60.000 A / 5.500 A |
| 128 / 129 | 800 B / 800 A | 519 | 0 |
| 153 | 20.600 B | 600 (600.90 dahil) | 28.000 A |
| 190 | 1.960 B | 602.90 / 610 | 2.000 A / 1.000 B |
| 191 | 0 | 644 / 649.90 | 500 A / 300 A |
| 320 | 22.510 A | 653 / 654 / 689 / 770 | 60 / 1.300 / 15 / 15.850 B |

Program mizanı (ekran = PDF = Excel, TOPLAM 291.105) bu tabloyla birebir.

## Bulgular

**ORTA-1 — KDV Özeti (Beyanname Hazırlığı): "Ödenecek KDV" devreden KDV'yi görmüyor; 391 / 191 etiketleri defterle aynı değil**
- **Adımlar:** Şubat mahsubunda 1.140 devreden KDV oluştu, Mart ve Nisan'da taşındı. Mayıs'ta satış KDV'si 1.200 var. Raporlar → Tüm Raporlar → KDV Özeti → Mayıs. Aynısını Eylül için yaptım: Temmuz'dan 2.000 devreden var, Eylül'de hesaplanan 660, indirilecek 620.
- **Beklenen (KDV mahsup fişi ve defter de bunu gösteriyor):**
  - Mayıs ödenecek KDV 60 (1.200 − devreden 1.140).
  - Eylül ödenecek 0, sonraki aya devreden 1.960.
- **Görülen:**
  - Mayıs "Ödenecek KDV ₺1.200,00".
  - Eylül "Net KDV (Ödenecek) ₺40,00".
  - Yıllık görünüm "Devreden KDV 1.100"; defterdeki 190 ise 1.960.
  - Özet kartlarındaki "Hesaplanan KDV (391)" 4.860, mizandaki 391 alacak hareketi 5.120. "İndirilecek KDV (191)" 5.960, mizandaki 191 borç hareketi 6.220.
  - Fark kaynağı: rapor satıştan iadenin KDV'sini (200) 391'den, alıştan iadenin KDV'sini (60) 191'den netliyor. Defter (doğru olarak) bu ikisini karşı hesaplarda tutuyor. Net sonuç iki tarafta da aynı.
- **Dayanak:**
  - KDV aylık beyan edilir. Önceki dönemden devreden KDV beyannamede ayrı satırdır.
  - Satıştan iadenin KDV'si satıcıda indirim olarak düzeltilir (KDVK 35; KDV Genel Uygulama Tebliği). İkincil kaynaklar: https://www.muhasebenews.com/?p=19729 , https://www.lexpera.com.tr/mevzuat/ozelgeler/b-07-1-gib-4-35-18-02-1741-114-sayili-ozelge-1 (erişim 22.11.2026).
  - Birincil metin **DOĞRULANMADI**: mevzuat.gov.tr ve gib.gov.tr bu oturumun ağ ayarlarında çözülmüyor. Bu iki adresin ağ ayarlarına eklenmesi gerekir.
- **Etkisi:** Defter ve mahsup fişi doğru. Ama raporun adı "Beyanname Hazırlığı" ve kullanıcı ekranda yanlış "Ödenecek KDV" görüyor (Mayıs'ta 1.140 fazla). Bu sayıyla beyanname hazırlanırsa fazla ödeme ya da yanlış beyan riski var.
- **En küçük öneri:** Özete "Önceki Dönemden Devreden KDV" satırını eklemek ve ödenecek/devreden tutarını mahsup fişindeki formülle hesaplamak; ya da en azından etiketi "Dönem KDV Farkı (Devreden Hariç)" yapmak. 391 / 191 etiketlerine "(iadeler netlenmiş)" eklemek ya da iadeleri beyannamedeki yerinde göstermek.

## MA LİSTESİ — madde madde değerlendirme
- **S184 / S215 (açılıştan önceki hesapsız POS → 108.00; hesapsız kart çıkışı → 519):**
  - Deneyemedim. Açılıştan önceki hareket önceki yıl tarihi istiyor; kilit ve tek mali yıl kapsamı yüzünden girilemedi (409). Ayrıntı DENENMEYEN'de.
  - Görüşüm: girişte (108.00) ve çıkışta (519) farklı davranış bilançoda "Hesabı Atanmamış" büyük bir aktif bırakır. Mali müşavir bunu sorar. A kararının sürmesine itirazım yok, ama güncelleme notu şart.
  - 2.5.1 önerisi: Bilanço'da 108.00 için "Kesin Değil — Hesabı Atanmamış POS" nedeni ve iki yönün aynı kuralla (Bankaya Geçmiş Say dahil) kapanması. GÖRÜŞ.
- **S203 (şüpheliye almadan sonra kesilen fatura):**
  - Program sonradan kesilen faturayı 128'e katmadı: 120 Alfa = 1.200, 128 = 800.
  - Bağsız tahsilat önce 128'den düştü. Bu, en eski ve muaccel borca mahsup kuralıyla uyumlu (TBK 102; VUK 323'teki şüpheli alacak dava/icra safhasındaki eski alacaktır). C kararı (kâhin susar) uygun.
- **S207 (silinmiş ürün kartı):**
  - Hareketli kart (20 adet, 800 TL) silinebildi. 12.06 tarihli 153/100 maddesi duruyor; değerleme silindiği günden (22.11) itibaren 0, satışların maliyeti 800 arttı. Bilanço ve stok değerlemesinde "silinmis-urun" uyarısı var. 21.11 ve 30.06 değerlemeleri 800'ü hâlâ sayıyor (tutarlı).
  - Mevzuat açısından bir sorun: mal fiziken duruyorsa envanterden çıkması VUK envanter ve değerleme hükümlerine aykırı (birincil metin DOĞRULANMADI).
  - Önerim (2.5.1): hareketli kart silinmesin, pasife alınsın. Silme mutlaka sürecekse fire / zayi ve belge uyarısı verilsin. DÜŞÜK.
- **S215:** Yukarıda S184 ile birlikte değerlendirdim; görünür güncelleme notu şart.
- **B-f (alacaklı 127 → 340):**
  - Deneyemedim. Carisiz taksit kartı açıldığında program kendiliğinden bir cari açıyor (No 8), dolayısıyla 127'ye düşmüyor; durum yalnız eski veride oluşur.
  - Sınıflama (Pasif III.D 340) ters bakiye brütleştirmesiyle tutarlı; KABUL. Aynı mantığın 120 → 340 (1.200) ve 320 → 159 (460) için çalıştığını gördüm.
- **B-b (stok hareketi ↔ 153 ayrışması uyarı):**
  - "Yalnız Miktar" ile yıl ortasında bedelsiz giriş (05.08, 10 adet) madde üretmedi.
  - Değerleme bu adetleri ortalama maliyetle saydı: dönem sonu stok +573,91, satışların maliyeti −573,91. Hiçbir uyarı çıkmadı (`differenceMinor` 0).
  - Kural kitabı S-06'ya (sayım farkı ayrı madde değil, değerlemeye girer) uygun. Mevzuat açısından sayım fazlası gelir niteliğindedir; aralıklı envanterde bu yolla kâra girmesi kabul edilebilir. GÖRÜŞ.
  - Ama aynı form seçeneği ürünün ilk hareketinde (01.01) "Stok açılışı 153/519" yazdı, sonraki hareketlerde hiçbir şey yazmıyor. Formda bu ayrım görünmüyor → DÜŞÜK (form metni).
- **Ü4 / Ü5 / Ü6 / Ü8 / Ü11 / Ü13 / Ü17 / Ü18 / Ü20, M7 671/681, Kural Farkı:**
  - Eski sürüm verisi gerektiriyor; bu temasta kapsam dışı.
  - Yeni kurulumda Kural Farkı Düzeltme ekranı "Düzeltilecek kural farkı yok" diyor; fiş tarihi ilk açık gün 01.07.2026; 671 / 681 metni var. Doğru.
  - Ü8 (indirim dönemi sınır dışı → red): denenmedi.
- **Güncelleme notu (carisiz Kasa / Borç Yaz / Alacak Yaz → Kural Değişikliği Farkı):** Eski veri gerektiriyor; DENENMEYEN.
- **Mutabakat testi yetim mahsup:** Yetim mahsup üretmedim. Defter Mutabakatı'nın bütün denetimleri "Tutarlı". DENENMEYEN.
- **B-11 (KDV Özeti alış satırlarını indirim dönemine göre gruplar):**
  - Doğru: Ağustos tarihli, dönemi Eylül seçilen alış Eylül satırında göründü ve Eylül mahsubuna girdi (B 391 660, A 191 620, 190 devreden 1.960).
  - KDVK 29/3'e uygun (birincil metin DOĞRULANMADI).
- **19.11 04:35 KDV Özeti ↔ defter kalemleri:** ORTA-1 olarak yazdım.
- **19.11 05:07 (kilitli önceki yıl sınıflama farkı → 671 / 681 brüt çifti):** Eski veri gerektiriyor; DENENMEYEN. Görüş: net 0 olan brüt çift Gelir Tablosu'nda iki tarafta da görünür; dipnot şart.
- **06.11 07:55 (3) (MA mali tabloları devirden önce denetler):** Yapıldı. Bilanço, Gelir Tablosu ve stok değerlemesi kendi mizanımdan hesapladığım sayılarla kuruşu kuruşuna aynı:
  - Kesin Değil nedenleri doğru: 519 ≠ 0 iken "Tamamlanmamış Açılış", eşleştirmeden sonra kalkıyor; "Satışların Maliyeti Tahminidir"; bilanço esası dışındaki defter türlerinde "Bilgi Amaçlı".
  - Serbest meslek dipnotu var.
  - Ters bakiye brütleştirmesi doğru.
  - Gelir Tablosu (1 Ocak → t) dönem kârı = Bilanço hesaplanmış dönem kârı, iki ayrı tarihte denendi.
- **Gelir Tablosu BULGU-1:** Bilinen; bulgu yazmadım. Denediğim kilit senaryosunda fiş yılı geri çekme durumu oluşmadı; sayılar tutarlı.

## KULLANICIYA SORULMALI
- **KDV Özeti (ORTA-1) — rapor düzeni, para kuralı değil:**
  - A) 2.5.0'da yalnız etiket değişsin: "Dönem KDV Farkı (Devreden Hariç)" ve "iadeler netlenmiş" notu.
  - B) 2.5.0'da özete "Önceki Dönemden Devreden KDV" satırı eklensin; ödenecek/devreden mahsup fişindeki formülle hesaplansın.
  - Önerim: kısa vadede A, 2.5.1'de B.

## SONRAKİ SÜRÜME (2.5.1) — DÜŞÜK / GÖRÜŞ
- **KDV mahsup fişleri:**
  - KDV hareketsiz ayda (Mart, Nisan, Ağustos) "B 190 / A 190" maddesi yazılıyor.
  - Eylül'de 190 iki tarafta brüt (B 1.960 / A 2.000); kural kitabının V-01'inde net A 40.
  - Bakiye doğru, ama mizandaki 190 hareket toplamları şişiyor.
- **Dönem kilidi ve KDV mahsubu:** Kilit 31.07'ye ilerletilince Temmuz'un KDV'si mahsupsuz kaldı, kilit ekranı uyarmadı. Bilanço uyarıları da boş; kural kitabı §7.3'teki "biten ay mahsupsuz" bilgi uyarısı yok.
- **Dönem kilidi metni:** "Kasa, Cari, Stok ve Taksit hareketi eklenemez" diyor. Oysa fatura, banka, çek ve KDV mahsubu da engelleniyor (doğru); metin eksik.
- **Açılış Eşleştirme ve kilit:**
  - Kilitli dönemde 01.01 tarihi yazılamıyor (en erken 01.07). Kılavuza not önerilir: "Açılış Eşleştirme'yi dönem kilidinden önce yapın".
  - Geçersiz tarihte ekran "519: ₺0,00" gösteriyor (yanıltıcı).
- **Gelir Tablosu / Bilanço dipnotu:** "Kasa ve banka 'Diğer Gider' çıkışları (750,00 TL)" yazıyor; bunun 250'si Alacak Yaz. Gerçek kasa/banka çıkışı 500. Dipnot ya Alacak Yaz'ı ayırmalı ya da adı değişmeli. 2.5.0'da ekran yok, kullanıcıya görünmüyor.
- **Hesap Planı Mizanı:**
  - Yalnız ana hesap gösteriyor; 600.90, 602.90, 649.90, 770.90, 102.01, 108.01 yalnız yevmiyede görünüyor. Alt hesap ve cari kırılımlı mizan önerilir.
  - Devir sütunu işaretli (−3.500), bakiye işaretsiz + Yön; düzen tutarsız.
  - Hesap adlarındaki parantez açıklamaları yanıltıcı: 602 "(Hizmet, Taksitli Satış, Kayıt Tahsilatları)" ama taksitli satış artık 600.90'da; 108 "Kredi Kartı Tahsilatları (POS)" (Tek Düzen adı "Diğer Hazır Değerler"); 360 "(Tevkifat, Stopaj)" ama KDV de orada.
- **Yevmiye Defteri:**
  - Madde numarası yok, hesap adı yok (yalnız kod).
  - Cari açılışının "İşlem" sütununda "Cari (borç yaz)" yazıyor.
  - POS gün sonu maddesinde alacak satırı borçtan önce.
  - Masrafta aynı hesap (770) iki satır.
  - Çek tahsilinde açıklama boş.
- **Büyük Defter (hesap ekstresi) ekranı ve Yevmiye'de hesap süzgeci yok:** Ç6-EKRAN ile 2.5.1'e kaldığını varsayıyorum. Bilanço esasında defter-i kebir zorunlu defterdir (VUK 182 — birincil metin DOĞRULANMADI).
- **Hesap Planı'nın kendi ekranı yok;** yalnız mizan raporu var.
- **Bilanço:** 102.01 alt satırının adı boş.
- **Kılavuz 15. bölüm (Ana Defter paragrafı):** "Ürünlerin açılış stoku 153'te (karşılığı açılış hesabı 500)" yazıyor. Program 519 yazıyor. Kılavuzun bir başka yerinde Açılış Eşleştirme 519 olarak doğru anlatılıyor. Çekirdek planı §13'te bu cümle "2.5.0'da güncellenir" denmişti.
- **Vergi Ödemesi (Banka) formu:** "Diğer Vergi (Ödenecek ₺600,00)" KDV tutarını da gösteriyor.
- **Karşılık:** Aynı yıl içinde ayrılan karşılığın çözülmesi 644'e gidiyor (kural kitabı önerisi). Bazı uygulamada 654 azaltılır. Net aynı. GÖRÜŞ.
- **POS komisyonu:** 653'e gidiyor; 760 önerisi zaten 2.5.1 listesinde.

## DOĞRULANMADI
- Mevzuat maddelerinin birincil metni (KDVK 29/3, 35; VUK 182, 183, 186, 274, 322, 323). mevzuat.gov.tr ve gib.gov.tr bu oturumda çözülmüyor; ağ ayarlarına eklenmeleri gerekir.
- "Yaygın programlarda hareketli stok kartı silinmez" iddiası (belge okunamadı).

## DENENMEYEN
- Önceki yıl ve açılıştan önceki hesapsız POS / kart hareketi (S184, S215): kilit ve tek yıl kapsamı.
- Eski sürüm verisiyle ilgili maddeler: Kural Farkı, 671 / 681, Ü4–Ü20, carisiz kart 127, Açılış Olabilir onay/red (ekran açıldı, kayıt yok).
- Devir, yıl sonu kapanışı, iki şirket, Ödeme Hatırlatma (kapsam dışı).
- e-Belge gönderimi.
- Muhasebe rolüyle yetki denemesi.
- Bilanço / Gelir Tablosu PDF ve Excel (ekran yok).
- KDV Özeti ekranında Kasım satırı tabloda kaydırma altında kaldı; satır sayısı "10 satır", PDF ve Excel toplamlarıyla aynı.
- Lisans kilidi açıkken gerçek kurulum koşulu (ders 14): yeni kurulum lisans servisi olmadan salt okunur açılıyor; denemeler `enforce:false` ile yapıldı.

## Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ma-a22`:
- `rapor-taslak.md`: ara notlar
- `beklenen.py`: kendi beklenen maddelerim
- `kilit-once.json`, `kilit-sonra.json`: kilit öncesi/sonrası okumalar
- `gt-yil.json`, `bil-yil.json`: mali tablo çıktıları
- `ekran/`: ekran görüntüleri
- `indir/`: mizan, yevmiye ve KDV Özeti PDF / Excel
- `js/`: düzenek betikleri; programı açan betik `js/sunucu.mjs`

Veri klasörü silindi; senaryo `js/` altındaki adımlarla yeniden kurulabilir.

Sınır: Lisanslı bir SMMM değilim; bu görüş SMMM incelemesinin yerini tutmaz. Bilanço ve Gelir Tablosu satışa sunulmadan önce gerçek bir SMMM incelemesi önerilir (2.5.1 ekranlarıyla birlikte).