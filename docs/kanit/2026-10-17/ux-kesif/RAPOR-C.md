# Keşif C — Banka, POS, Rapor Merkezi, Şüpheli Alacak, Yönetim, Kabuk (gerçek kullanıcı gibi)

- Kod: depo `/home/user/ofis---y-netimi`, dal `claude/hopeful-goodall-6nmtcj`, HEAD 274b7ad (sürüm 2.4.3). Ürün koduna, testlere ve git'e dokunulmadı.
- Sunucu: gerçek kod (`bootVersion(CURRENT)`), `HUKUK_LICENSE_URL=http://127.0.0.1:9`, vekil boş; ağa çıkılmadı.
- Tarayıcı: Playwright Chromium (başsız), `locale tr-TR`; 1366×768 (ana), 1280×720 ve 1920×1080 (düzen).
- Veri (programın kendi API'siyle, `seed.mjs`): 3 banka hesabı (biri uzun adlı, açılışı doğrulanmamış), bankaların içinden 2 kredi kartı,
  2 POS (Ziraat Fiziki %2,5 / 3 Taksit %3,5, valör 1 iş günü; Garanti Sanal %1,8), 41 müşteri (aynı adlı iki cari dahil), 10 tedarikçi,
  2 stok; 365 güne yayılmış 655 işlem: 209 fatura (havale/POS/açık), 124 havale tahsilatı, 82 POS tahsilatı, 64 havale ödemesi, 43 kartla ödeme,
  49 masraf, 40 transfer, 18 kasa↔banka, 26 çek; 1 Şüpheli Alacak (İcra, 3.000); 3 sınırlı kullanıcı (personel, muhasebe, avukat); ikinci şirket.
  Kurulum sonunda Mutabakat Testi tamam (başarısız denetim yok). Kasa'dan bankaya 4 aktarım "kasa eksiye düşer" 409 ile reddedildi (beklenen).
- Bütün betikler, ham ölçümler (JSON/OUT) ve 182 ekran görüntüsü bu klasörde; ekran görüntüleri `shots/`. Veri kopyaları silindi.

## Bulgular

Önem: YÜKSEK = veri/para yanlışı ya da akışı durduran; ORTA = belirgin sürtünme / yanlış ileti; DÜŞÜK = görsel / küçük sürtünme.
Bu turda YÜKSEK bulgu yok: para tutarları her karşılaştırmada tuttu (aşağıda "Denenen akışlar").

### C1 — ORTA — Banka Masrafı ve Bankalar Arası Transfer formu, dolu iken Esc ile SORMADAN kapanıyor; girilenler kayboluyor
- Ekran: Banka → Hareketler → "+ Masraf" / "Transfer".
- Adımlar: 1) Banka → Hareketler. 2) "+ Masraf" → Tutar alanına `17,50` yaz, Açıklama'ya `Deneme açıklaması` yaz. 3) Esc.
  Aynısını "Transfer" ile tekrarla.
- Beklenen: kaydedilmemiş değişiklik varken "Kaydetmeden çıkılsın mı?" sorusu (ya da Esc'in yok sayılması).
- Gözlenen: pencere soru sormadan kapanıyor, girilen tutar ve açıklama kayboluyor. 3 kez yeniden üretildi (ui-banka2 masraf; ui-kabuk2 masraf + transfer):
  `{"v-fee":{"hasAnswer":false,"formStill":false},"v-transfer":{"hasAnswer":false,"formStill":false}}`.
- Not: fatura formu için senaryolardaki kapatma yardımcısı "Kaydetmeden Çık" sorusunu bekliyor; fatura formu bu turda Esc ile denenmedi (karşılaştırma koddan değil, ölçülmedi).
- Ekran görüntüsü: `shots/masraf-formu.png` (dolu hâl), `shots/k2-esc-v-fee.png`, `shots/k2-esc-v-transfer.png` (Esc sonrası — form yok).

### C2 — ORTA — Cari POS tahsilatı formunun açıklama metni yanlış: "Banka → Hesabı Atanmamış Eski Hareketler'de POS / Kart olarak görünür" diyor
- Ekran: Cari → müşteri kartı → "+ Tahsilat" → Tahsilat Yolu "POS".
- Adımlar: 1) Cari → Akın Ticaret Ltd. Şti. 1 → "+ Tahsilat". 2) Tutar `2.000`, Tahsilat Yolu POS, POS "Ziraat Fiziki POS". 3) Formun üstündeki açıklamayı oku. 4) Kaydet.
- Beklenen: tanımlı POS seçiliyken metin "POS'a yazılır, valör gününde (19.10.2026) seçilen POS'un banka hesabına geçer" gibi olmalı.
- Gözlenen: üstte "Cariden POS ile tahsil edildi: bakiyeden düşer; Kasa'ya girmez, Banka → Hesabı Atanmamış Eski Hareketler'de POS / Kart olarak görünür; makbuzu alınır."
  Aynı formun altındaki önizleme ise doğru: "Komisyon %2,50 (₺50,00) · Bankaya Geçecek ₺1.950,00 · Valör 19.10.2026". Kayıt da doğru yere gitti
  (POS işlemi oluştu: brüt 2.000, net 1.950; Hesabı Atanmamış Eski Hareketler 0). Yani yalnız ileti yanlış ve formun kendi önizlemesiyle çelişiyor.
- Kaynak: `client/assets/hof-accounts.js:53` — `in.card` metni POS seçilse de seçilmese de aynı (yalnız `refund` dalı hesaba bakıyor).
- Ekran görüntüsü: `shots/k2-pos-tahsilat.png`.

### C3 — ORTA — Banka Transfer ve Masraf formlarında hesabın bakiyesi / "İşlemden Sonra" satırı yok
- Ekran: Banka → Hareketler → "Transfer" ve "+ Masraf".
- Adımlar: Transfer'de Gönderen Ziraat, Alıcı Garanti, Tutar `1.234,56`; Masraf'ta Vakıf hesabı, `17,50`.
- Beklenen (müşteri isteği 12.10.2026, CLAUDE.md "seçicilerde bakiye": "… transfer, çek ödemesi — öneri", sonra "bütün önerilerim uygulanır"): seçilen hesabın
  altında "Bakiye (…): … · İşlemden Sonra: …" (cari tahsilatı/fatura/çek formlarında `HOF.bank.balanceLine` ile var).
- Gözlenen: iki formda da hesap bakiyesi hiç görünmüyor; yalnız "Alıcıya Giren ₺1.234,56 · Gönderenden Çıkan ₺1.234,56" ve masrafın vergi dökümü var.
- Ekran görüntüsü: `shots/transfer-dolu.png`, `shots/masraf-formu.png`.

### C4 — ORTA — Rapor Merkezi her süzgeç / dönem / rapor değişiminde tabloyu kaldırıp "Rapor hazırlanıyor…" koyuyor: yanıp sönme + düzen kayması
- Ekran: Raporlar → Tüm Raporlar (63 rapor).
- Adımlar: Banka Hareket Raporu → "Banka Hesabı" seçicisinden sırayla hesap seç (ya da dönem düğmelerine bas).
- Gözlenen (ölçüm, MutationObserver + layout-shift): her değişimde içerik alanı `tablo h=904 → HAZIRLANIYOR h=492 (≈15 ms) → tablo h=904 (≈130–185 ms)`;
  her değişimde iki layout-shift 0,0226 + 0,0226 = 0,045 (tek tek 0,05 altında ama her tıklamada tekrarlanıyor; pencere 400 px çöküp geri açılıyor, kaydırma
  konumu üstte değilse kullanıcı yerini kaybediyor). 63 raporun hepsinde ve bütün süzgeçlerde aynı (`ui-rapor-1366.json` "states").
- Karşılaştırma: Banka → Hareketler'de süzgeç değişince liste yerinde kalıyor, yenisi 13–41 ms'de değişiyor (boşalma yok) — iyi örnek aynı programda var.
- Kaynak: `client/assets/hof-report-center.js` `run()` — `quiet` değilse `center.preview = null; renderMain()`.

### C5 — ORTA — 1366×768'de Rapor Merkezi'nde ilk bakışta veri satırı ve TOPLAM görünmüyor
- Ekran: Raporlar → Tüm Raporlar → Banka Hareket Raporu (1366×768, yaygın dizüstü).
- Gözlenen: başlık + açıklama + kapsam + PDF/Excel + süzgeç kutusu + 7 özet kartı ekranı dolduruyor; tablo başlığı y≈660'ta, hiçbir veri satırı ve TOPLAM
  görünmüyor, pencereyi kaydırmak gerekiyor. 1366'da 26 raporda TOPLAM ilk görünümde ekranda değil. 1920×1080'de TOPLAM yapışkan ve görünür (iyi).
  Kod bunu bilerek yapıyor (`fitTable`: tabloya 280 px'ten az yer kalırsa kutu küçültülmez) — sonuç yine de bu çözünürlükte "rapor boş mu?" izlenimi.
- Ekran görüntüsü: `shots/r1366-rapor-banka-hareket.png` (karşılaştırma `shots/r1920-rapor-banka-hareket.png`).

### C6 — ORTA — Banka raporları 1920×1080'de bile yatay kaydırma istiyor; Bakiye kolonu görünür alanın dışında, Hesap kolonu 4 satıra kırılıyor
- Ekran: Rapor Merkezi → Banka Hareket Raporu (Gerçek Banka, Bu Yıl).
- Gözlenen: tablo kutusunda yatay kaydırma; "Transfer Çıkış" yarım, "Bakiye" görünmüyor; "Hesap" hücresi "Ziraat / Bankası · / Ana TL / Hesabı" diye 4 satır,
  satır yüksekliği ~100 px (ekranda 3 satır sığıyor). Yatay kaydırma olan raporlar (1280, 1366 ve 1920'nin üçünde de): Banka Hareket, Banka Bakiye, Banka
  Masraf, POS Satış, Günlük Banka, Aylık Banka, Cari ve Banka Hareketleri, Fatura ve Banka Hareketleri, Satış Faturaları, Alacak Yaşlandırma, Stok Hareketleri.
- Ekran görüntüsü: `shots/r1920-rapor-banka-hareket.png`, `shots/r1366-rapor-banka-bakiye.png`, `shots/r1280-rapor-banka-hareket.png`.

### C7 — DÜŞÜK — Hareketler'de tarih alanına klavyeyle yıl yazılırken her hanede sunucuya istek gidiyor; ikisi 400 dönüyor
- Ekran: Banka → Hareketler → Başlangıç.
- Adımlar: Hesap Ziraat seç → Başlangıç alanına tıkla → tarihi tuşlarla yaz (gün, ay, yıl `2026`) → Enter.
- Gözlenen: 4 istek: `from=0002-…`, `from=0020-…` (ikisi **400 Bad Request**, konsolda kırmızı hata), `from=0202-…`, `from=2026-…`. Ekranda ileti yok, son liste doğru
  (3 satır). Kod yorumu "tutar ve tarih alanları Enter'da ya da alandan çıkınca" diyor; tarih kutusu her geçerli değerde `change` verdiği için her hanede süzüyor.
  3 koşuda aynı. (Başsız Chromium'da alan biçimi aa/gg/yyyy göründü; gerçek Edge'de gg.aa.yyyy — yıl hanelerindeki ara değerler iki biçimde de oluşur.)
- Ham: `son.json` → `tarih.reqs`, `tarih.http`. Ekran görüntüsü: `shots/son-tarih-yazimi.png`.

### C8 — DÜŞÜK — Hata bildirimi fare üstündeyken de kapanıyor; rapor tarihi uyarısı hata rengiyle ama kısa sürede
- Ölçüm: `HOF.toast(…, {type:"error", timeout:5200})` üstüne fare getirildi → 5.407 ms'de kapandı (bekletme yok). Başarı bildirimi 3.849 ms.
  Rapor Merkezi "Başlangıç tarihi bitiş tarihinden sonra olamaz." hata renginde ama 3.851 ms (toastError'ın 5,2 sn'si değil). 6 bildirim art arda → yalnız son 4 görünür (tasarım).
- Etki: uzun hata iletileri (ör. eksi bakiye kuralları) okunmadan kaybolabiliyor.

### C9 — DÜŞÜK — Para biçimi iki ekranda iki türlü
- Banka penceresi, bildirimler, formlar: `₺320.890,12`, `+₺1.788,75` (simge önde). Rapor Merkezi tablo/özet, PDF/Excel: `320.890,12 TL` (sonda). Hata iletileri: `0,00 TL`.
  Aynı hesap bakiyesi Banka → Hesaplar'da `₺320.890,12`, Banka Bakiye Raporu'nda `320.890,12 TL`.

### C10 — DÜŞÜK — Tarayıcı Geri tuşu pencereyi kapatmıyor, programdan çıkıyor; F5 açık pencereyi ve süzgeçleri kapatıyor
- Adımlar: Banka → Hareketler → bir satır → İşlem Kartı açıkken tarayıcı Geri (ya da fare geri düğmesi).
- Gözlenen: pencereler geçmişe girdi yazmıyor; testte geçmiş [about:blank, program] olduğundan Geri programdan çıkıp `about:blank`'e gitti.
  Personel bilgisayarından normal tarayıcı sekmesiyle bağlanan kullanıcıda bir önceki siteye gider. Gerçek başlatıcı (uygulama penceresi) koşulunda denenmedi.
  F5: 309 ms'de ana ekrana dönüyor, açık Banka penceresi ve süzgeç kayboluyor (konsol hatası yok).
- Ekran görüntüsü: `shots/islem-karti.png`, `shots/geri-tusu-sonrasi.png`, `shots/yenileme-sonrasi.png`.

### C11 — DÜŞÜK — Banka penceresi kapatılıp açılınca Hareketler süzgeci ve sekme sıfırlanıyor
- Adımlar: Hareketler'de Hesap = Ziraat seç → Esc → Banka'yı yeniden aç.
- Gözlenen: "Genel Bakış" sekmesi açılıyor, Hareketler'e geçince süzgeç "Tüm Hesaplar". Rapor Merkezi ise son dönemi hatırlıyor (tutarsız davranış).

### C12 — DÜŞÜK — Uzun adlar seçicilerde kesiliyor, kısa kodlar kırılıyor
- Masraf formunda hesap seçicisi "Türkiye Vakıflar Bankası T.A.O. · Kurumsal Ticari Me…" (hangi hesap olduğu okunmuyor); POS seçicisi "Ziraat Fiziki POS · Ziraat Bankas…".
- 1280×720 Hesaplar listesinde Kod hücresi "GAR-" / "KART" iki satıra, Tür "Kredi / Kartı" iki satıra kırılıyor.
- Ekran görüntüsü: `shots/masraf-formu.png`, `shots/k2-pos-tahsilat.png`, `shots/1280-banka-sekme-accounts.png`.

### C13 — DÜŞÜK — Müşteri carisinin tahsilat formunda tedarikçi seçeneği: "Kredi Kartına İade (tedarikçi parayı firmanın kredi kartına iade etti…)"
- Ekran: müşteri (Tür: Müşteri) → "+ Tahsilat" → Yol POS. Kutu görünüyor; müşteri tahsilatında anlamı yok, yanlışlıkla işaretlenirse POS satışı yerine kart iadesi olur.
- Kaynak: `client/assets/hof-accounts.js:823` (yalnız `type === "in"` koşulu; cari türüne bakmıyor). Ekran görüntüsü: `shots/k2-pos-tahsilat.png`.

### C14 — DÜŞÜK — "Banka ve POS Hareketleri" raporu Kasa grubunda
- Rapor Merkezi'nde Kasa başlığı altında; hızlı aramada "Banka ve POS Hareketleri · Kasa" yoluyla çıkıyor. Banka raporlarını Banka grubunda arayan bulamaz.

### C15 — DÜŞÜK — Banka Nakit Akış Raporu ileriye dönük ama geçmiş dönem düğmeleri sunuluyor
- "Geçen Ay" seçilince alt başlık "17.10.2026 itibarıyla · 01.09.2026 – 30.09.2026", tek satır (Başlangıç). Geçmiş dönem bu raporda anlamsız; düğmeler
  (Bu Ay/Geçen Ay/Son 30 Gün) yanıltıcı. (API: `banka-nakit-akis?from=2026-09-01&to=2026-09-30`.)

### Bir kez / yalnız bu ortamda görüldü (bulgu sayılmadı)
- Excel indirme dosya adı: adı Türkçe harfli raporlarda (Cari Mizanı, Tüm Cari Hareketleri) başsız Chromium "download" (uzantısız) önerdi; ASCII adlılarda
  (Banka Hareket Raporu) doğru. Sunucu başlığı doğru: `attachment; filename="Cari Mizani 17.10.2026.xlsx"; filename*=UTF-8''Cari%20Mizan%C4%B1…`. Ayrı bir yerel
  sunucuyla yalnız `filename*` verildiğinde de aynı sonuç → başsız Chromium'un davranışı olabilir. Gerçek Edge'de elle denenmeli (`dl.mjs`, `dl2.mjs`).

## Denenen akışlar ve sonuçları (sorunsuz olanlar)
- Rapor Merkezi API: 63 rapor × (6 dönem: Bu Yıl, Bu Ay, Geçen Ay, Son 30 Gün, Tüm Zamanlar, boş dönem 2019-01) + her süzgecin her seçeneği + cari süzgeci = 485 çağrı:
  hepsi 200 (Cari Ekstre carisiz 400 "Ekstresi alınacak cariyi seçin." — beklenen), en yavaşı 186 ms; ≤200 satırda TOPLAM = satırlar toplamı, sapma 0;
  NaN/undefined hücre 0; "1976" hiçbir alt başlıkta yok. (Cari Mizanı Bakiye TOPLAM'ı net bakiye — belgelenmiş kural.)
- Büyük raporlar (553–2.193 satır; Banka Hareket, Tüm Cari Hareketleri, Günlük Banka, Cari/Fatura ve Banka Hareketleri, Yevmiye, Satış Faturaları, Banka ve POS):
  Excel satır sayısı = rapor toplamı, Excel TOPLAM = ekran TOPLAM = Excel satırlarının toplamı (8/8).
- TOPLAM satırı olmayan para kolonlu raporlar: Kasa Hareketleri, Banka ve POS Hareketleri (yürüyen bakiyeli), Stok Hareketleri ve Banka Bakiye "Tümü" (yönü karışık,
  `footerUniform`), Banka Nakit Akış, Defter Mutabakatı — kodda bilerek kapalı; özet kartları toplamı veriyor (BİLGİ).
- Rapor Merkezi ekrandan (1366/1280/1920): 63 raporun her biri açıldı (199–523 ms); para hücreleri sağa yaslı (hizasız 0), başlık/etiket yazım düzeni ihlali 0;
  boş dönemde "Bu dönemde kayıt yok. Tüm Zamanları Göster"; POS Ödeme Takvimi boşken "Bekleyen POS kalemi yok; bankaya geçenler Banka → Hareketler'de." + bağ;
  Tüm Zamanlar'da Başlangıç alanı boş, alt başlık "Tüm Zamanlar · 17.10.2026 tarihine kadar"; tek gün (16.10–16.10) yalnız 16.10 satırları (sınır dahil);
  Excel indirme 106–316 ms. Grup sırası Cari · Kasa · Stok · Fatura · Çek / Senet · Taksit · Banka · Ana Defter · Kayıtlar · Ofis (müşteri isteğiyle aynı).
- Bakiye tutarlılığı: Banka → Hesaplar ↔ Banka Bakiye Raporu ↔ Alt Hesap Mizanı ↔ Banka Hareket Raporu "Dönem Sonu" ↔ Excel son yürüyen bakiye: 5 hesapta
  aynı (Ziraat 320.890,12 · Garanti 411.615,10 · Vakıf 268.416,12 · kartlar 12.590,51 / 20.413,08 borç). Gerçek Banka 1.000.921,34 = özet = rapor.
- Transfer ekrandan Ziraat → Garanti 1.234,56: Ziraat −1.234,56, Garanti +1.234,56 (sunucudan okundu), bildirim "Kaydedildi: BNK-2026-000553 …".
- POS: önizleme %2,50 → 50,00 komisyon, 1.950,00 net, Cumartesi + 1 iş günü → 19.10.2026; kayıt sonrası POS işlemi brüt 2.000 / net 1.950.
  POS Ödeme Takvimi (9 kalem): Garanti %1,8 (2.937,01 → 2.884,14), Ziraat 3 Taksit %3,5 (3.000 → 2.895); TOPLAM 24.993,32 / 24.390,44 = satırlar.
  Masraf BSMV ayrımı 17,50 → 16,67 + 0,83.
- Banka Hareketler süzgeçleri (Hesap 6, İşlem Türü 16, Giriş ve Çıkış 3, Durum 5, POS 3 seçenek): liste boşalmadan 13–41 ms'de değişiyor; boş sonuçta
  "Bu süzgeçte hareket yok."; "Daha Fazla Göster" 50 → 100 satır 134 ms. Sekme geçişleri 90–250 ms (Hareketler ve POS'ta ~130–190 ms kısa boş/Yükleniyor görünüyor).
- Şüpheli Alacak: cari listesinde "Şüpheli" rozeti; cari kartında Şüpheli Alacağa Al / Karşılık Ayır / Değersiz Alacak Yaz / Şüpheliden Çıkar; raporda Durum
  (Açık/Kapanan/Tümü) ve Neden (6 seçenek) süzgeçleri doğru sayıyı veriyor (İcra 1 kayıt 3.000; öbür nedenler 0).
- Hızlı Arama (Ctrl+K): "alış f", "cari h", "çek", "banka har", "pos", "yedek", "supheli" (ş'siz) doğru sonuçlar; "xyzq" 0; Enter ilgili pencereyi açıyor (Banka Hareketler).
- Şirket değiştirme: şirket menüsünden 002'ye geçiş 55 ms, bildirim "… şirketine geçtiniz. Bu seçim yalnızca sizin ekranınızı değiştirir."; 002'de Banka Kurulum
  Sihirbazı açılıyor; 002 Banka Bakiye Raporu 0 satır (veri karışmıyor); 001'e dönüş.
- Yönetim → Yedekler: "Şimdi Yedek Al" (Tüm Şirketler) 126 ms, iki şirketin yedeği kendi klasörüne; Geri Yükle penceresi şirket kodu + parola istiyor (onaylanmadı).
- Yetki: personel — Banka/Raporlar menüde yok, aramada yok, bütün banka/rapor uçları 403. Muhasebe — Banka var, Cari Mizanı listede yok ve uç 403; ekranda 403'e
  düşen düğme görülmedi. Avukat — Banka ve banka raporları açık (rol varsayılanı; şüpheli alacak ucu 403). Sınırlı kullanıcıların oturumunda pageerror 0.
- Genel: oturum açma 332 ms; bütün koşularda pageerror 0; konsol hatası yalnız açılıştaki beklenen `/api/auth/me` 401 ve C7'nin 400'leri. Sayfa yatay kaydırması
  (gövde) hiçbir ölçüde yok.

## Denenmeyenler
- Gerçek Windows / Edge (başlatıcının uygulama penceresi): Geri tuşu (C10), tarih alanı biçimi gg.aa.yyyy (C7), Excel dosya adı.
- Geri yüklemenin onaylanması ve yeniden açılış (yalnız pencere açıldı); şirket verisini sıfırlama; yeni şirket açma (2 şirket sınırında "+ Yeni Şirket" görünürlüğü ayrıca bakılmadı).
- Kart Borcu Ödemesi, Faiz / Diğer İşlem, Planlı İşlem, kredi hesabı, POS iptal/iade, "Şimdi Aktar" ekrandan, Onay Bekleyen geçiş, komisyon faturası.
- POS Tanımla (form içinden) ve yetkisiz kullanıcıda "POS tanımlı değil" yazısı.
- PDF içeriği ekrandan (yeni sekmede açılan PDF başsız tarayıcıda yakalanamadı; sunucu yanıtı 200, `inline; filename=…pdf`, 16–36 ms).
- Yönetim → Sistem Ayarları sekmesinde değer değiştirme; Ağ Bağlantısı (vekil) ayarı.
- Ekran okuyucu ile erişilebilirlik; yalnız Tab sırası (Kredi Kartı Ekle formu: mantıklı sıra, tarih alanının takvim düğmesinde odak çerçevesi görünmüyor) bakıldı.
- 2.000+ satırlık listelerin ekranda kaydırma akıcılığı; eşzamanlı iki kullanıcı.
