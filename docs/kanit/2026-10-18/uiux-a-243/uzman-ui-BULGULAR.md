# DestekOfis 2.4.3 son aday (5966ac3) — Uzman UI turu bulguları

Ortam: 5966ac3'ün `git archive` kopyası; gerçek eski sürüm verisi (fikstür surum-2.0.26-turler) + API ile 350 cari, 3.200 cari hareketi, 400 kasa
satırı (13 ay); sahte EDM (test/einvoice-mock.mjs; ağa çıkılmadı); `HUKUK_LICENSE_URL=http://127.0.0.1:9`, `startLicenseTimers:false`.
Tarayıcı: Playwright Chromium, tr-TR, insan hızında yazım + Tab/Enter. Ekranlar: 1366×768, 1280×720, 1920×1080, 1366×768 %125.
Betikler: bu klasör (sunucu.mjs, ortak.mjs, k1…k7, pdf-al.mjs, rc2.mjs, yazim-label.mjs). Ekran görüntüleri: ekran/ ve ekran/pdf/.
Kontrast oranları WCAG 2.x formülüyle sayfada ölçüldü (ortak.mjs contrastAudit) ve python ile tekrar hesaplandı.

## Bulgular (çürütülemeyenler)

### UI1 — ORTA — WhatsApp düğmelerinde yazı okunmuyor (kontrast 1,98:1)
- Yer: Cari listesi "Tümüne WhatsApp Ekstre" / "Tümüne WhatsApp Mesaj" (ve `.hof-button.hof-whatsapp` kullanan bütün düğmeler).
- Üretme: Cari'yi aç (k2-moduller.mjs, 1366/1280/1920). Ölçüm: beyaz yazı / #25d366 = **1,98:1**; 12px kalın.
- Beklenen: WCAG 1.4.3 AA ≥ 4,5:1 (büyük yazıda bile ≥ 3:1). Gözlenen 1,98.
- Kanıt: ekran/k2-accounts-1366x768.png, k2-1280.out / k2-1920.out KONTRAST satırı.
- Düzeltme: client/assets/hof-ui.css:9751 `background/border-color: #1e7e45` (5,09:1) ya da WhatsApp'ın koyu yeşili `#008069` (4,89:1).

### UI2 — ORTA — Form hatası bildirimi düzeltilecek alanların ÜSTÜNE oturuyor; aynı ileti üç kez
- Yer: Fatura formu (Stoktan Satış) → "Kaydet ve Gönder" reddedilince.
- Üretme: k4-fatura.mjs (STOKSUZ=1): VKN'siz cariye kalemli fatura → Kaydet ve Gönder. Pencere açıkken bildirim üst-ortada
  (hof-ui.css:438-447) çıkıyor; 1366×768'de kalem satırının Miktar/Birim/Birim Fiyat alanlarını örtüyor, uzun ileti + "Kopyala" ile ~12 sn kalıyor.
  Aynı metin ayrıca Toplamlar kutusunda ve düğmelerin üstünde kırmızı yazı olarak var (3 kopya).
- Kanıt: ekran/k4-fatura-onay-1366.png (bildirim satırı örtüyor), k4b.out "errors" + "BİLDİRİMLER".
- Beklenen: yerinde (inline) hata gösterilen formda ek bildirim düzenlenecek alanı örtmez (yaygın muhasebe programları hatayı alanın yanında verir).
- Düzeltme (en küçük): hof-invoices.js:1962-1965 `fail()` — `[data-form-error]` varsa ve görünürse `HOF.toast` çağrılmasın (ya da hata alanı
  `scrollIntoView` + bildirim yok). Genel çözüm: pencere açıkken bildirimi pencerenin dışına/alt kenarına koymak.

### UI3 — ORTA — Stok kodu / barkod (EAN-13) üç yerde kesiliyor ya da bölünüyor
- (a) Fatura kalem satırı "Kod / Barkod" girişi 100px: 13 haneli `8690123456789` sığmıyor (scrollWidth 113 > clientWidth 100) — okutulan
  barkod ekranda doğrulanamıyor. Kanıt: k4.out KALEM SATIRI, ekran/k4-fatura-dolu-1366.png.
- (b) Fatura/Müşteri Fişi PDF'i Stok Kodu kolonu 62pt: gönderilen e-Faturanın (TEF2026427823464) PDF'inde **"8690123456…"**; fikstür faturasında
  "STK-2.0.26-0…". Kanıt: ekran/pdf/efatura-ean-satir-1.png, ekran/pdf/fatura-mal-1.png; `pdftotext` çıktısı aynı. Kod: server/lib/invoice-pdf.mjs:68 (`w: 62`).
- (c) Stok listesi kod kolonu, taksit kartı "No" kolonunun kuralını (hof-ui.css:6671 `.hof-plans-table .hof-plan-no { width: 56px }`) miras alıyor:
  "STK-2.0.21-001" üç satıra bölünüyor, başlık "Stok Kodu" iki satır; yanında "Kritik Seviye" kolonu boş geniş alan. Kanıt: ekran/k2-stock-1366x768.png.
- Beklenen: kimlik (kod/barkod) kesilmez ya da bölünmez; EAN-13 en yaygın stok kodu biçimi.
- Düzeltme: (a) `.hof-inv-code` genişliği ~13ch+dolgu (≥ 120px) ya da odakta tam genişlik; (b) kod kolonu genişliği en uzun koda göre (en az
  ~80pt) ya da ad gibi satır kaydırma; (c) stok tablosunda `.hof-stock-table .hof-plan-no { width:auto; white-space:nowrap }`.

### UI4 — ORTA — Kod/barkod yazıp Tab ile çıkınca ürün seçilmiyor; kayıtta yanıltıcı "En az bir kalem yazın."
- Üretme: k4-fatura.mjs ilk koşu (k4.out): Stoktan Satış → Kod alanına `8690123456789` (stokta tam eşleşen ürün var) → Tab → Miktar 3 → Tab.
  Ad ve fiyat BOŞ kalıyor; Kaydet ve Gönder → "En az bir kalem yazın." (kod yazılı olduğu hâlde). Enter ile aynı kod ürünü seçiyor (k4b.out "ENTER SONRASI AD").
- Neden: hof-invoices.js:1737-1742 tam eşleşme yalnız Enter'da (`pickByCode`); focusout (≈93-96) listeyi kapatıyor, seçmiyor.
- Beklenen: stok kartının kendi yardım metni "kod yazılınca … ürün kendiliğinden seçilir" diyor; Tab ile veri girişi (ders 12) Enter ile aynı sonucu vermeli.
- Düzeltme: kod alanında `change`/blur'da değer doluysa ve ad boşsa `pickByCode(index, value)`; eşleşme yoksa satır altında "Bu kodla ürün yok" yazısı.

### UI5 — DÜŞÜK — Kaydet ve Gönder sonrası fatura kartı eski kaydırma konumunda açılıyor; belge no/durum başlığı görünmüyor
- Üretme: k7-efatura.mjs (1366×768): form uzun, düğmeye inmek gerekiyor → kayıttan sonra kart aynı scrollTop'ta açılıyor; "Satış Faturası TEF…
  Gönderildi" başlığı ekranın üstünde kalıyor, üst-ortadaki bildirim kalan şeridi de örtüyor. Kanıt: ekran/k7-efatura-detay-1366.png.
- Düzeltme: form → kart geçişinde pencere gövdesi `scrollTop = 0`.

### UI6 — DÜŞÜK — Cari kartında "Mükellefurn:mail:defaultpk@…" bitişik yazılıyor
- Üretme: mükellef cari (Mükellef Sorgula ile PK seçilmiş) kartı. Kanıt: ekran/k6-HATA-mukellef-cari.png ("E-FATURA Mükellefurn:mail:defaultpk@alici.com.tr").
- Neden: hof-accounts.js:377 `Mükellef<small>…</small>`; `.hof-plan-facts dd small` için kural yok (satır içi, boşluksuz).
- Düzeltme: CSS `.hof-plan-facts dd small { display:block; color:var(--do-faint); font-weight:500 }` ya da araya `<br>`.

### UI7 — DÜŞÜK — Yazım düzeni ihlalleri (kural: form alanı / gösterge / rapor-PDF başlığı her sözcük büyük) ve testin kör noktası
Projenin kendi `titleCase` aracıyla doğrulandı (yazim-label.mjs, yazim-app.mjs):
- Yeni Cari formu alan adları: "e-Fatura posta kutusu etiketi", "e-Fatura senaryosu" (hof-accounts.js:587-588) → "…Posta Kutusu Etiketi", "…Senaryosu".
  Test kör noktası: test/yazim-duzeni.test.mjs `eligible()` büyük harfle başlamayan metni hiç denetlemiyor → "e-…" ile başlayan adlar kaçıyor.
- Ana sayfa / Ayarlar paneli başlığı "Sheet sekmeleri / kategoriler" (React paketi app-b419c601a3.js; test bu paketi taramıyor). Ekranda görüldü
  (ekran/k1-ana-1366.png; k6.out AYARLAR ETİKETLER). Aynı paket: "Sheet bağlantısı", "Excel / CSV yükle", "Senkronizasyon sıklığı" (alan etiketleri; ekranda açılmadı).
- Nakit Kasa Dökümü PDF'i: kartlar "Devreden kasa / Dönem tahsilatı / Dönem ödemesi / Dönem sonu kasa", alt satır "Dönem toplamı", altbilgi
  "DestekOfis · Kasa dökümü" (server/lib/cash-report.mjs:83-86, 143); öbür PDF'ler "Borç Toplamı", "TOPLAM", altbilgide şirket adı. Kanıt: ekran/pdf/k80-01.png.

### UI8 — DÜŞÜK — Vade Takip PDF'inde iki ayrı "gecikmiş" kartı (hangisi tahsil, hangisi ödeme belli değil)
- server/routes/overview.mjs:620-622 `["  gecikmiş", …]` girintiyle alt satır amaçlanmış; tablePdf özet kartı girintiyi göstermiyor → yan yana iki "gecikmiş" kartı,
  küçük harfle ve farklı punto. Kanıt: ekran/pdf/vt-kart-1.png. Düzeltme: "Gecikmiş Tahsilat" / "Gecikmiş Ödeme" (ekrandaki ad zaten "Gecikmiş Tahsilat").

### UI9 — DÜŞÜK — Para/sayı biçimi tutarsızlıkları
- Anlık Durum: 10 Mn üstü "22,6 Mn ₺" (simge sonda) — yanındaki kartlar "₺5.183.913,09" (simge başta). Nakit Akış grafiği ekseni "500 B ₺".
  hof-overview.js:24-31 (COMPACT_MONEY). Öneri: `"₺" + COMPACT_NUMBER.format(n)` → "₺22,6 Mn". Kanıt: ekran/k1-ana-1366.png, k5-rapor-NakitAkış-1366.png.
- Fatura kalemi Birim Fiyat ürün seçilince "1249,9" (binlik ayraçsız, tek ondalık); hemen altındaki çip "₺1.249,90". Kanıt: k4b.out KALEM SATIRI, ekran/k4-fatura-onay-1366.png.
- Kasa Dökümü PDF son satırı "1849 hareket" (binlik ayraç yok; öbür yerler toLocaleString).

### UI10 — DÜŞÜK — İkincil metinlerde sistematik AA altı kontrast
- Bütün tablo başlıkları `.hof-table th` #6d8276 / #f4f8f5 = **3,84:1**, 10px büyük harf (hof-ui.css:918); kod/no hücreleri 4,11:1.
- Pencere üst yazısı `.hof-eyebrow` #5f8c74 / beyaz = **3,83:1**, 10px, harf aralıklı (hof-ui.css:409). Tahsilat formunda carinin adı bu stilde
  ("No 552 · Çağdaş Öztürk …", iki satır) — paranın kime yazılacağı en zor okunan yazıda (ekran/k4-tahsilat-form-1366.png).
- Rapor Merkezi kartı "10 bölüm · her biri PDF ve Excel" 2,78:1; "hazır rapor" 3,45:1. Ana sayfa taksit şeridi alt satırı 3,42:1 @9px;
  marka alt yazısı 3,12:1; "Taksitte" rozeti 3,98:1; uyarı kutusu metni #a86b12/#fdf4e3 4,02:1.
- Düzeltme: th rengi #567064 (5,03:1), eyebrow #4e7a62 (4,9:1), uyarı metni #8a5810 (5,52:1); taksit şeridi alt satırı ≥ 11px.

### UI11 — DÜŞÜK — Görsel tutarlılık
- Fatura ve Çek / Senet pencerelerinde başlık iki kez ("Fatura" büyük başlık + altında yine "Fatura"); Cari, Stok, Kasa'da tek (ekran/k2-invoices…, k2-cheques…).
- Dışa aktarım düğmeleri her modülde başka ad ve renk: "Liste - PDF" (kırmızı tonlu) / "Cari Listesi - PDF" (nötr, simgeli) / "PDF" / "PDF İndir" / "Kasa Dökümü - PDF".
- Özel açılır kutular metin glifi "▼" (Banka Kurulum Sihirbazı Banka Adı, fatura kalemi Birim) — yanındaki yerel select okuyla aynı satırda farklı ikon.
- Nakit Akış tablo görünümü seçeneği "Hareket Hareket" (hof-overview.js:550) yazım hatası gibi okunuyor → "Tek Tek Hareketler".
- Stok: 5. özet kartı ("Stok Değeri") tek başına ikinci satıra düşüyor; 1366×768'de listeye 4 satır kalıyor (ekran/k2-stock-1366x768.png).

## Çürütülen adaylar
- Açılışta CLS 0,13–0,22 (3 açılışın 2'si): kaymalar açılış perdesi altında oluyor; perde kalktıktan sonraki karelerde (0–1800 ms film şeridi, ekran/k6-acilis-*)
  yerleşim farkı yok (fark yalnız kayan şerit ve açılır uyarı kartı). Kullanıcıya görünmüyor.
- Form odak halkası görünmez: görünür (kenarlık #6ea487 + 3px hale; ekran/k3-odak-telefon-1366.png). 1.4.11'e göre sınırda (2,9:1), AA 2.4.7 sağlanıyor.
- Tarih alanlarında "mm/dd/yyyy": test tarayıcısının arayüz dili (ders 14); Türkçe Windows/Edge'de gg.aa.yyyy.
- Vade Takip / KDV Özeti / Açık Faturalar / Çek raporlarında alt TOPLAM yok: yönler karışık (alacak+borç, giriş+çıkış); toplamlar özet kartlarında — bilinçli.
- Stok kartında açılış girişinin "Tutar"ı boş: "Yalnız miktar" girişte para hareketi yok; Stok Hareketleri raporu da aynı gösteriyor.
- Kayan Tahsilat Takvimi (WCAG 2.2.2): fare üstünde/odakta duruyor, prefers-reduced-motion'da kapalı.
- Kasa/Rapor penceresinde "×" düğmesinde kalın odak çerçevesi: pencereyi betik `click()` ile açtığı için; gerçek tıklamada focus-visible gösterilmez.
- PDF'te "FIS…35" glif bozukluğu: 75 dpi rasterleme; `pdftotext` metni doğru.
- 768 yükseklikte kenar çubuğunun son iki öğesi kullanıcı kartının altında: çubuk kaydırılıyor, yarım görünen öğe ipucu veriyor.
- "Kalanın Tamamını Tahsil Et" nedeni yazılmadan pasif: kalem yokken Toplamlar kutusu "Kalem girince toplamlar burada hesaplanır" diyor.
- Her açılışta konsolda 401: girişten önceki oturum denetimi, zararsız.
- e-Arşiv/e-Fatura reddi (VKN, il, vergi dairesi yok): doğru doğrulama; cari tamamlanınca e-Fatura sahte EDM'ye gitti (TEF2026427823464, "Durum Sorgula", "Resmî Görüntü", "XML İndir" var).
- Yatay taşma / kesilen başlık: 4 ekran boyutunda ve %125'te hiçbir modülde belge ya da pencere yatay kaydırması yok (k2-*.out TAŞMA/KAYDIRMA).

## DENENEN
- Ekrandan (tıklama, Tab, insan hızında yazım): Yeni Cari (uzun unvan, Tab sırası, odak), aynı adla ikinci kez açma uyarısı, Tahsilat (1.250,50), Kasa, Yeni Ürün
  (EAN-13), Stoktan Satış (cari öneri, barkod+Enter, barkod+Tab, ad araması, Esc ile öneri kapatma), Kaydet ve Gönder reddi ve başarısı (sahte EDM),
  fatura kartı, Satıştan İade formu, Çek / Senet Al formu, Banka Kurulum Sihirbazı, Rapor Merkezi (Cari Ekstre, Vade Takip, Nakit Akış, Çek / Senet,
  Tüm Raporlar araması), zil, Ayarlar paneli, Yönetim → Kullanıcılar.
- 8 modül × 1366×768, 1280×720, 1366×768 %125; 4 modül × 1920×1080; kontrast/taşma/etiket/CLS her birinde.
- Sunucu PDF'leri (21 adet): cari/kasa/mizan/vade/nakit/taksit/çek/stok/fatura listeleri, cari ekstre, 4 fatura türü + e-Fatura, 4 Rapor Merkezi raporu.
- 63 Rapor Merkezi raporunun başlık yazımı ve TOPLAM satırı (API, rc2.mjs).
- Ders 12 (Tab/insan hızı), 14 (test ortamı ≠ kurulum: tarih biçimi çürütüldü), 25 (benzersiz klasör), 30 (lisans adresi kapalı), 15 (paylaşılan kilit).

## DENENMEYEN
- Gerçek Windows + Edge uygulama penceresi, gerçek ekran yakınlaştırması (yalnız deviceScaleFactor benzetimi), ekran okuyucu.
- Karanlık tema: programda yok (yalnız WhatsApp balonu `prefers-color-scheme: dark` alıyor) — denenmedi.
- Tarayıcıdan "Yazdır" önizlemesi ve Excel çıktılarının görünümü; e-Arşiv (TCKN) gönderimi; iade ve çek kaydının tamamlanması (yalnız formlar);
  banka hesabı açma + banka hareketi; personel/muhasebe rolüyle görünüm; Yönetim'in Kullanıcılar dışındaki sekmeleri; React Ayarlar alanları
  ("Sheet bağlantısı" vb.) ekranda açılmadı (yalnız koddan).
- Bildirim süreleri yalnız "Cari açıldı." (3,8 sn) ve hata bildirimi için gözlendi.

## BİLİNEN SINIRLAR
- Kontrast denetimi degrade arka planda en açık rengi alır (yanlış pozitif azaltmak için iyimser); yarı saydam katmanlar yaklaşık birleştirilir.
- Hacim: 553 cari, ~4.700 cari/kasa satırı, 13 ay, tek şirket (fikstürde 4 şirket var, yalnız 001 gezildi).
- Ürün koduna dokunulmadı; commit/push yok. Test sunucusu durduruldu; veri klasörü scratchpad/uzman-ui-243-veri (yeniden üretim için) duruyor, silinebilir.
