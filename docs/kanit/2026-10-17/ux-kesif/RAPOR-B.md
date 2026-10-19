# Keşif Testi B — Fatura / e-Belge / Stok / Çek-Senet (gerçek kullanıcı gibi)

- Kod: depo `/home/user/ofis---y-netimi`, dal `claude/hopeful-goodall-6nmtcj`, HEAD 274b7ad (2.4.3). Ürün koduna, testlere ve git'e dokunulmadı.
- Ortam: güncel kod süreç içinde (`bootVersion(CURRENT)`; moneyStrict + gateVerify açık), `edocEnabled` ve `edocLive` açık, `HUKUK_LICENSE_URL=http://127.0.0.1:9`,
  vekil değişkenleri boş, sahte EDM (`test/einvoice-mock.mjs`). Gerçek EDM'ye ya da ağa çıkılmadı. Chromium (Playwright) 1366×768 (ayrıca 1280×720 ve 1920×1080), tr-TR.
- Tohum veri (API): 34 cari (2 mükellef firma: biri PK'li işaretli, biri işaretsiz ve 2 PK'li; 12 firma VKN'li; 10 şahıs TCKN'li; 8 perakende kimliksiz), 4 tedarikçi,
  55 stok kartı (12 farklı birim, 5 hizmet, 1 çok uzun adlı), 19 geçmiş satış (bekleyen e-Belge, 150 gün geriye yayılmış), 6 geçmiş alış, Kasa açılışı, 1 banka hesabı, portföyde 1 müşteri çeki.
- Ekrandan insan hızı: tuş aralığı 40–80 ms, gerçek tıklama, Tab, Enter, Esc. Betikler: `ux-kesif-B/p*.mjs` (ortak: `common.mjs`, `lib-form.mjs`, sunucu: `boot.mjs`).
  Bütün gözlemlerin ham günlüğü: `ux-kesif-B/gozlem.log`. Ekran görüntüleri: `ux-kesif-B/ekran/`.
- Ölçüm araçları: `PerformanceObserver('layout-shift')` (CLS), `document.activeElement` takibi, bildirim görünme→kaybolma süresi (MutationObserver), 4xx/5xx ve konsol hataları.

Kısaltma: `EK = /tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/ux-kesif-B/ekran`

---

## Bulgular

### B1 — YÜKSEK — "Tümünü Gönder" belgeleri yeniden eskiye gönderiyor; en yeni belge numarayı alınca eski tarihli bütün bekleyenler e-Belge olamıyor
- Ekran: Fatura → Gönderilecekler → "Tümünü Gönder (n)".
- Yeniden üretim (kontrollü, temiz kurulum — `r1-toplu-sira.mjs`):
  1. e-Arşiv kullanıcısı firmada şahıs cariye 3 satış, tarihleri 14.10, 15.10, 16.10, "Kaydet, Sonra Gönder" (Gönderilecekler'de bekler).
  2. Fatura → Gönderilecekler: liste yeniden eskiye (16.10, 15.10, 14.10).
  3. "Tümünü Gönder (3)" → onay "Tümünü Gönder".
- Beklenen: belgeler tarih sırasıyla (eski önce) numaralanıp gönderilir; 3/3 gönderilir.
- Gözlenen: "1 belge gönderildi; 2 belge gönderilemedi: TEA serisinde son gönderilen belge TEA2026518768660 16.10.2026 tarihli; bu belge (15.10.2026) daha eski tarihli
  olduğu için e-Belge olarak gönderilemez…". EDM'ye yalnız 16.10 tarihli belge gitti; 14.10 ve 15.10 artık hiçbir zaman e-Belge olamaz (yalnız Müşteri Fişi ya da iptal + bugünle yeniden kesim).
- Keşif akışında aynısı 20 belgede: 1 gönderildi, 19 kaldı (`EK/p4d-gonderim-sonrasi.png`).
- Neden (koddan): istemci `sendPending()` kimlikleri liste sırasıyla yollar (`client/assets/hof-invoices.js` ~2483), sunucu `send-pending` sıralamadan döner
  (`server/routes/invoices.mjs:3201`). Toplu taslak kesimi (`bulk-issue`, :2471) ise "Tarih sırası: eski tarihli taslak önce" diye sıralıyor — iki yol tutarsız.
- Ekran görüntüsü: `EK/r1-toplu-gonder.png`, `EK/p4d-gonderilecekler.png`.

### B2 — YÜKSEK — Çok kalemli faturada kısmi iade ekrandan yapılamıyor (yalnız bir ürünü iade etmek)
- Ekran: Satış Faturası kartı → "Bu Faturadan İade Oluştur".
- Yeniden üretim: 2 kalemli satış (Ürün Kablo 3 × 7, Hizmet Danışmanlık × 3) → İade Oluştur → yalnız kabloyu iade etmek için 2. kalemin miktarını 0 yap (ya da sil) → "İadeyi Kaydet".
- Beklenen: yalnız 1. kalem iade edilir (iade satırını çıkarma yolu olur).
- Gözlenen: iade satırlarında Sil (×) düğmesi yok (bilerek gizli: `ret ? ""`); miktar 0 ya da boş → "2. kalem: miktar sıfırdan büyük olmalı." Kayıt yazılmaz. Kullanıcı ya bütün
  kalemleri iade eder ya da hiç edemez. Hata bildirimi iki kez üst üste çıkıyor.
- Sunucu tek kalemli kısmi iadeyi kabul ediyor (API ile `lines:[{originLineId, qty:2}]` → IAD2026000000001, 148,73 + 29,75 KDV = 178,48 doğru) → engel yalnız ekranda.
- Ekran görüntüsü: `EK/p6-iade-sifir.png`, `EK/p6-iade-bos.png`, `EK/p5b-iade-form.png`.

### B3 — YÜKSEK (numara/seri) — Toplu kesilen e-Arşiv taslağı numara alıyor ama gönderilmiyor ve Gönderilecekler'de görünmüyor
- Ekran: Fatura → Taslaklar → satır seç → "Seçilenleri Kaydet".
- Yeniden üretim: e-Arşiv carisine (Fatma Şahin) "Taslak Olarak Kaydet" → Taslaklar → seç → Seçilenleri Kaydet → onay.
- Beklenen (Entegratör Ayarları'ndaki metin: "Toplu kaydedilen faturalar entegratöre hemen gönderilsin (kapalıyken Gönderilecekler'de bekler…)"): ayar kapalı → belge
  Gönderilecekler'de, numarasız bekler (tek formdaki "Kaydet, Sonra Gönder" gibi).
- Gözlenen: belge TEA2026464308982 numarasını aldı, `e_status = none`; EDM'ye gitmedi; Gönderilecekler sekmesinde YOK (sekme `eStatus = waiting` süzer). Yalnız kart açılırsa
  "e-Belge Gönder" düğmesi görünür. Onay penceresi e-Belgeden hiç söz etmiyor. Aynı serinin sonraki tarihli belgeleri gönderilince bu numara B1'deki kuralla gönderilemez hâle gelir → seride
  boşluk riski.
- Bir kez ekrandan üretildi; neden koddan doğrulandı: istemci `bulk-issue` gövdesinde `eSend` yok (`hof-invoices.js:2379`), sunucu `defer` yalnız `eSend === "later"`'da (`invoices.mjs:2412`).
- Ekran görüntüsü: `EK/p12c-toplu.png`, `EK/p13-toplu-kart.png`.

### B4 — ORTA (veri kaybı) — Fatura formu Esc / × / pencere dışına tıklama ile SORUSUZ kapanıyor; Esc açılır listeyi kapatmak isterken bütün formu kapatıyor
- Ekran: Yeni Alış / Satış Faturası formu (yeni, Kopya, Düzenle hâli dahil); ayrıca cari düzenleme penceresi.
- Yeniden üretim (her biri ayrı ayrı denendi, 5/5 tekrarlandı):
  1. Yeni Alış Faturası → Tedarikçi kutusuna "Topt" yaz → öneri listesi açıkken **Esc** → bütün fatura penceresi kapanır (`EK/p1-esc-kapandi.png`).
  2. Kalem adına "Çimen" yaz → stok listesi açıkken **Esc** → form kapanır, kalemler kaybolur.
  3. Tedarikçi + kalem girilmiş formda sağ üst **×** → sorusuz kapanır.
  4. Aynı formda pencere dışına (koyu alana) tek tıklama → sorusuz kapanır (`EK/p2-disari-tiklama.png`).
  5. Kopyala ile açılan form ve "Düzenleme: Alış Faturası AND2026000777" formunda Esc → sorusuz kapanır.
- Beklenen: "Vazgeç" düğmesindeki "Form Kapatılsın mı? … Kaydetmeden Kapat" sorusu bu yollarda da sorulur; listedeki Esc yalnız listeyi kapatır.
- Neden (koddan): fatura penceresi `HOF.modal`'a `beforeClose` vermiyor (`hof-invoices.js:69`; Banka ayarları veriyor: `hof-bank.js:144`); pencerenin Esc dinleyicisi
  belge düzeyinde YAKALAMA evresinde (`hof-core.js` `addEventListener("keydown", onKey, true)`), listenin `stopPropagation`'ı (`hof-invoices.js:1648`) ona ulaşamadan kapanıyor.
- Cari düzenleme penceresinde Mükellef Sorgula sonrası (alias + işaret değişmiş) Esc de sorusuz kapandı.

### B5 — ORTA — Uzun e-Belge hata iletileri 3,6 sn'de kendiliğinden kayboluyor
- Ekran: fatura formu, "Kaydet ve Gönder" reddi.
- Yeniden üretim: (a) carisinde işaret olmayan ama EDM'de mükellef olan Çok Kutulu Holding'e Hizmet Satışı → Kaydet ve Gönder → onay. (b) Kimliksiz "Perakende Müşteri 2"ye satış → Kaydet ve Gönder.
- Gözlenen (ölçüm): (a) 330 karakterlik "Alıcı (2223334447) e-Fatura mükellefi; … Fatura kaydedilmedi, numara harcanmadı; yeniden kaydedin: e-Fatura olarak kesilir." bildirimi
  **3.600 ms** ekranda kaldı; (b) 170 karakterlik "Cari (alıcı): e-Arşiv için VKN ya da TCKN zorunludur …" **3.600 ms**. Üzerine gelince durmuyor. `HOF.toastError`'ın 5.200 ms'i bile kullanılmıyor;
  toplu gönderimdekiler 10–12 sn. Okuma hızıyla (~15 karakter/sn) (a) ~22 sn ister. Kullanıcı ne yapması gerektiğini (Mükellef Sorgula, PK seçimi) okuyamadan kaybediyor.
- Ekran görüntüsü: `EK/p4c-mukellef-isaretsiz.png`, `EK/p4b-perakende-hata.png`.

### B6 — ORTA — Posta Kutusu Seçin penceresinde "Vazgeç/Esc" yine de bir PK yazıyor ve "Posta kutusu etiketi yazıldı" diyor
- Ekran: Cari → Düzenle → Mükellef Sorgula (2 PK'li mükellef).
- Yeniden üretim: Çok Kutulu Holding → Düzenle → Mükellef Sorgula → "Posta Kutusu Seçin" (muhasebepk / defaultpk) → **Esc**.
- Beklenen: seçim yapılmadı → PK alanı boş kalır ya da önceki değer korunur; ileti "PK seçilmedi".
- Gözlenen: alan `urn:mail:defaultpk@coklu.com.tr` ile doldu, işaret konuldu, bildirim "e-Fatura mükellefi: ÇOKLU A.Ş.. Posta kutusu etiketi yazıldı." (kod: `onClose: () => resolve(chosen || preferred)`,
  `hof-accounts.js` ~640; yorum "ilki sessizce yazılmaz, kullanıcı seçer" ile çelişiyor). Yanlış PK → e-Fatura alıcının yanlış birimine gider. Ayrıca iletide çift nokta ("A.Ş..").
- Ekran görüntüsü: `EK/p11a-pk-sec.png`, `EK/p11a-esc-sonrasi.png`.

### B7 — ORTA — Onay penceresi engelli belgede de "TEA… numarasıyla kaydedilecek" diyor; sonra reddediliyor
- Ekran: fatura formu → Kaydet ve Gönder.
- Yeniden üretim: Perakende Müşteri 2 (VKN/TCKN ve il yok) seçili; form uyarı kutusunda zaten "Cari (alıcı): e-Arşiv için VKN ya da TCKN zorunludur…" yazıyor → Kaydet ve Gönder.
- Gözlenen: önce "… TEA2026464308980 numarasıyla satış faturası kaydedilecek … entegratöre gönderilir" onayı soruluyor; onaylayınca 400 ve 3,6 sn'lik hata (B5). Çok Kutulu (B5a) için de aynı:
  kullanıcıya numara vaat edilip ardından ret. Engelleyici sorun formda görünürken onay sorulmamalı / düğme nedeni yazılı pasif olmalı (fatura için konulan "pasif düğmenin nedeni görünür yazı" kuralı).
- Ekran görüntüsü: `EK/p4b-perakende-form.png`.

### B8 — DÜŞÜK — Eksi stok sorusu iki onaydan ikincisi; formda önceden uyarı yok
- Yeniden üretim: Ayşe Kaya'ya "Ürün Lastik 10" (stok 29 Kutu) × 44 → satır altında yalnız "Stokta 29 Kutu" (uyarı yok) → Kaydet ve Gönder → 1. onay "Faturayı Kaydet" → 2. onay "Stok eksiye düşecek … Yine de Kaydet".
- Gözlenen: kayıt doğru (stok −15, EDM'ye 1 gönderim). Sürtünme: miktar stoku aşınca satır notu kırmızıya dönmüyor; iki ayrı soru. Ardından her oturum açılışında kırmızı "Kritik stok: Ürün Lastik 10 (-15 Kutu)" bildirimi
  çıkıyor ve ≥8 sn kalıyor (her yeni oturumda tekrarladı, 6 kez görüldü).
- Ekran görüntüsü: `EK/p8a-eksi-soru.png`, `EK/p8a-eksi-sonra.png`.

### B9 — DÜŞÜK — Stok ekranında eksi ürün üç göstergede birden sayılıyor ve stok değerini düşürüyor
- Ekran: Stok listesi. Lastik 10 (−15) aynı anda "1 Kritik Seviyede", "1 Tükenen", "1 Eksi Stokta"; Değer kolonu −555,00 TL ve "Stok Değeri" toplamından düşülüyor (Stok Durumu raporunda da −555,00).
  Muhasebe programlarında eksi miktar genelde değerlemeye sıfır ya da ayrı uyarıyla girer; karar kullanıcıda.
- Ekran görüntüsü: `EK/p16-stok-liste.png`, `EK/p16-eksi.png`.

### B10 — DÜŞÜK — Açılır listelerde ok tuşu yok (cari ve stok önerileri)
- Tedarikçi/cari ve kalem öneri listesinde ↓ odağı ve seçimi değiştirmiyor (ölçüm: ↓ sonrası odak yine ad kutusunda, hiçbir satır işaretli değil); Enter hep ilk (ya da tam eşleşen) satırı seçer.
  İkinci öneriyi klavyeyle seçmenin yolu yok (ör. "Vida 4" yazınca "Vida 4" ve "Vida 48"). Koddan: `hof-invoices.js` ve `hof-accounts.js` picker'ında ArrowDown/ArrowUp işleyicisi yok.

### B11 — DÜŞÜK — Uzun ürün adı kalem kutusunda kesiliyor, tam ad görünmüyor
- "Çok Uzun Adlı Paslanmaz Çelik Endüstriyel Mutfak Tezgâhı 180x70 cm Raflı ve Ayaklı Model": kutu 372–398 px, içerik 554 px; `title` yok; her üç çözünürlükte aynı.
- Ekran görüntüsü: `EK/p10-form-1280x720.png`.

### B12 — DÜŞÜK — Boş kalemde her hesaplamada konsolda kırmızı 400
- Yeni formda (fiyat girilmeden) her `POST /invoices/calc` 400 "Faturanın ödenecek tutarı sıfırdan büyük olmalı." döner; tarayıcı konsoluna "Failed to load resource: 400" düşer (her akışta 1–8 kez).
  Kullanıcıya görünmüyor; destek/tanılama günlüğünü kirletir.

### B13 — DÜŞÜK — Yeni stok kartı açılan kalemde odak Miktar'ı atlıyor
- Alış formunda listede olmayan ad + Enter ("+ Yeni Stok Kartı") → odak doğrudan Birim'e gider; stoktan seçilen kalemde Miktar'a gider. Hızlı yazan kullanıcı miktarı Birim kutusuna,
  birimi iskontoya yazdı (keşif sırasında aynen oldu: iskonto "Çuval" → "2. kalem iskontosu geçerli bir sayı olmalı."). Sayı alanları harf kabul ediyor (yalnız `inputmode=decimal`).

### Bilgi (hata sayılmadı)
- I1: Karşılıksız çıkan, faturaya bağlı olmayan çek sonrası Deniz Gıda'nın 408 TL'lik faturası "Ödendi" kalıyor (cari bakiye 408 borç doğru; açık kalem FIFO kuralıyla karşılıksız çek borcu). Tutarlı bir kural, ama kullanıcı
  "ödeyen çek karşılıksız çıktı, fatura hâlâ ödendi" görebilir. Karar kullanıcıda.
- I2: Durum Sorgula iletisi "GİB yanıtı bekleniyor. BASARIYLA TAMAMLANDI" — iki durum yan yana; sahte EDM'nin durum kuyruğuna bağlı olabilir, gerçek EDM'de görülmedi (doğrulanamadı).
- I3: Ekran görüntülerinde tarih kutuları "mm/dd/yyyy": başsız Chromium'un yerel ayarı; gerçek Türkçe Edge'de denenmeli (ders 14 — bulgu sayılmadı).

---

## Doğru çıkanlar (sayılarla)
- Alış (P2): 10 × 40 + 2,5 × 199,90 %10 isk. + 1 × 40 → satırlar 400,00 / 449,77 / 40,00; İskonto −49,98; Ara 889,77; KDV 177,95; Genel 1.067,72 (elle hesapla aynı). Stok Vida 33→44, Boya 25→27,5;
  tedarikçi alacak +1.067,72, borç +500 (nakit). Çift tıklamada tek belge.
- Satış e-Fatura karma ödeme (P3): 7 × 84,99 %12,5 isk. + 3 × 1.500 (602 tevkifat 9/10) → Ara 5.020,56; KDV 1.004,11; Tevkifat −810,00; Tahsil 5.214,67 (elle aynı). Nakit 1.000 Kasa'ya, çek 1.500 portföye,
  kalan 2.714,67 vadeli; stok 30→23; cari borç +5.214,67 / alacak +2.500; EDM'ye 1 gönderim, alıcı PK doğru; Düzenle/Sil kapalı ve nedeni yazılı.
- Çift tık + çift Enter "Kaydet ve Gönder": 1 belge, 1 EDM gönderimi.
- e-Arşiv iptal (P5c): Fayans 46→50, cari borç −1.200, nakit tahsilat geri alındı, EDM'de iptal; ilk denemede "EDM'de henüz işleniyor" ile reddedildi (pencere açık kaldı, yeniden denemede geçti).
- Ciro + karşılıksız (P9): tedarikçi −1.248 → −2.348 (ciro) → −4.848 (karşılıksız); çeki veren −2.092 → +408. Doğru.
- Satış Faturaları raporu dip toplamı = veri tabanı (Matrah 18.867,56; KDV 3.171,71; Tevkifat 810,00; Ödenecek 21.229,27).
- Hesaplama: sunucu `calc` 3–5 ms; son tuştan toplamın güncellenmesine 271–284 ms (>500 ms yok).
- Kalem girişi, tevkifat seçimi, ödeme satırı ekleme sırasında CLS = 0 (bütün akışlarda); hızlı yazımda (5 ms/tuş) karakter kaybı yok; satır içi kutular aynı üst/yükseklikte (fark 0 px);
  başlık–hücre kolon kayması 0 px; sayılar sağa yaslı; yatay kaydırma yok (1280/1366/1920).
- Tab sırası kalem satırında mantıklı; odak çerçevesi her öğede görünüyor (3 px; KDV seçicide 1 px).
- Yazım düzeni taraması (fatura formu düğme/başlık/etiket, Entegratör Ayarları kartı): kural dışı ad bulunmadı.
- PDF: 200, application/pdf, 44 KB, dosya adı Türkçe karakterli.

## Denenen akışlar
Alış faturası (stoktan, yeni stok kartı, aynı ürün iki satır, nakit + vadeli), satış e-Fatura (mükellef, PK'li) karma ödeme (nakit + çek + vadeli, iskonto, tevkifat),
e-Arşiv şahıs "Kaydet, Sonra Gönder", Gönderilecekler "Tümünü Gönder", kimliksiz perakende, işaretsiz mükellef, Durum Sorgula, Satıştan İade (tam/kısmi, ekrandan + API),
e-Arşiv İptal Et, eksi stok sorusu, Kopyala, Tekrarla penceresi, PDF, taslak + toplu kesim, Düzenle (alış), çift tık/çift Enter, Esc/×/dışarı tıklama, Vazgeç sorusu,
cari Mükellef Sorgula + PK seçimi, Entegratör Ayarları (5 sekme, Bağlantıyı Test Et 2,6 sn), Çek kartı (Tahsil Et / Ciro Et / Karşılıksız / Bankaya Tahsile Ver görünür),
alışta Portföyden Ciro Et, ciro edilmiş çek karşılıksız, Stok listesi + Eksi Stoktakiler süzgeci + Yeni Ürün formu, Rapor Merkezi (fatura/stok/çek raporları, Satış Faturaları dip toplamı),
3 çözünürlükte hiza/taşma ölçümü, klavye Tab/↓/Enter.

## Denenmeyenler
- POS ve kredi kartı ödeme satırları (POS tanımı kurulmadı), havale satırı yalnız görsel olarak eklendi (kaydedilmedi).
- Bankaya Tahsile Ver işleminin kendisi (düğme görüldü, gönderilmedi), çek Tahsil Et.
- Alıştan İade, iade e-Fatura (TEMEL/IADE) gönderimi, Mahsup Et, Ödeme Yap/Tahsilat Ekle formu.
- Gerçek EDM, Canlı Ortam, portal taslağı, Gelen e-Faturalar, e-Posta/WhatsApp gönderimi.
- Yetkisiz kullanıcı, iki kullanıcı aynı anda, dövizli fatura, toplu iptal/silme, Excel yükleme.
- Rapor Merkezi süzgeçlerinin tek tek denenmesi (yalnız "Tüm Zamanlar"); Cari Ekstre ekranı.
- Gerçek Windows/Edge (tarih biçimi, kaydetme önerileri).

## Notlar
- B4 (Esc/×) ve B10 (ok tuşu) her denemede tekrarlandı; B1 hem keşif verisinde (20 belge) hem temiz kurulumda (3 belge) üretildi; B2 ekranda iki kez + API karşılaştırması;
  B3 ekranda bir kez + kod yolu; B5 ölçümü iki ayrı iletide.
- Veri kopyaları (`ux-kesif-B/veri`, `r1-*`) silindi; ekran görüntüleri ve betikler kaldı. Başlangıçta disk: 13 GB boş (%69).
