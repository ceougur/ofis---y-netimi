# DestekOfis — çalışma kuralları (proje sahibinin talimatları)

Bu dosya oturumlar arasında taşınan hafızadır. Her oturumun başında okunur; kurallar pazarlıksızdır.

## Kalite çıtası
- Ölçü: uluslararası en yaygın finans/muhasebe programlarının (ör. cari-kayıt-taksit bütünlüğü, mizan, ekstre,
  nakit akışı, çek/senet portföyü) yerleşik çözümleri. "Çalışıyor" yetmez; o programlarda nasıl yapılıyorsa öyle.
- Baş mimar / baş mühendis şapkası: bir özellik bitince kullanıcı gözüyle ekranı aç, günlük iş akışını baştan sona
  yürüt (kişi gir → cari → taksit → tahsilat → kasa → rapor). Mantık boşluğu (bağsız kayıt, çift cari, eşleşmeyen
  isim, boşa düşen kart, eksik yol) yakalanmadan "bitti" denmez.
- Yanıt vermeden önce koddan doğrula; hafızadan anlatma. Ekran görüntüsüyle kanıtla.

## Test kuralı (2.0.7'de eklendi; kullanıcı şikâyeti üzerine)
- Teknik testler (birim, API, ekran açılıyor mu) yeterli değildir. Her sürümde **iş akışı testleri** de koşulur:
  gerçek kullanıcı senaryosu, sıfırdan, arayüzden, uçtan uca; sonuç sayılarla (bakiye, kasa, kart) karşılaştırılır.
- Her yeni modül için "boş veri", "kayıt önce/cari önce/taksit önce" sıralamaları ve "aynı adlı iki kişi" durumu denenir.
- Rapor ekranları için: boş dönem, tek kayıt, geçmiş/gelecek tarih, ileri tarihli hareket, yetkisiz kullanıcı.

## Kullanıcının tekrar eden şikâyetleri (aynı hataya düşme)
1. "Onca test yaptım deyip mantık hatalarını görmüyorsun." → Test sayısı değil senaryo çeşidi; kartları aç, kullan.
2. "Yayın öncesi sağlama" → GitHub'a birleştirme/yayın yok; önce paket, kullanıcı doğrular.
3. "Kişi bir kez girilir" → kayıt ↔ cari ↔ taksit zinciri tek girişle kurulur; isim eşleşmesi önerilir, çift cari açılmaz.
4. "Dediklerimi gerçekten yap" → istenen her madde için yapılan iş ve kanıtı (test adı / ekran görüntüsü) yazılır.

## Yazım düzeni (kullanıcı kararı, 30.09.2026 — bundan sonraki her eklemede)
- Programın ürettiği adlar — pencere başlığı, düğme, sekme, menü, kolon başlığı, gösterge, form alanı, açılır liste
  seçeneği, rapor/PDF/Excel başlığı — **her sözcüğün ilk harfi büyük**: "Cari Listesi ve Bakiyeler", "Tüm Cari Hareketleri".
- Bağlaçlar küçük ("ve", "ile", "veya", "ya da", "de/da", "ki"); parantez içi açıklama olduğu gibi; kısaltmalar aynen (PDF,
  KDV); Türkçe büyük harf (i → İ). Stok birimleri de: Adet, Kg, Lt, M² (`server/lib/units.mjs`).
- Cümleler (yardım, uyarı, bildirim, onay kutusu metni) ve kullanıcının verisi cümle düzeninde kalır.
- Araçlar: `server/lib/text-case.mjs` ve istemcide `HOF.titleCase`. Denetim: `test/yazim-duzeni.test.mjs` (kaynakta) ve
  `test/e2e/senaryo-211.mjs` (ekranda gezinti) kural dışı adda kırılır.

## Kullanım kılavuzu (kullanıcı kararı, 30.09.2026)
- Yalnız kullanıcıyı ilgilendiren kısa, "nasıl yapılır" hap bilgiler. Sürüm notu, iyileştirme anlatımı ("2.0.x'te…"),
  altyapı/teknik bilgi (sunucu, olay, göç, önbellek, dosya yolu ayrıntısı) kılavuza girmez; onlar CHANGELOG ve docs'ta.

## Güvenlik ve süreç (değişmez)
- Operatör parolası, imza/lisans anahtarları ve API gizli anahtarı hiçbir dosyaya, zip'e, belgeye girmez.
- Tag'lere force-push yok. Müvekkil/müşteri verisine erişilmez.
- Commit: `Co-Authored-By` ve `Claude-Session` satırları; model adı kod/commit/belgeye yazılmaz.
- Her yayında site kılavuzu da güncellenir: sitedeki kılavuz GitHub yayınından GELMEZ, `ceougur/destekofis` →
  `web/indir/DestekOfis-Kullanim-Kilavuzu.pdf` (yalnız demo .exe yayından iner). Yayın teslimiyle birlikte site PR'ı
  açılır (ayrıntı `docs/SURUM-YAYIMLAMA.md` → Site). 2.0.3–2.0.14 boyunca sitede eski kılavuz kaldı (02.10.2026 fark edildi).

## Sürüm teslim düzeni (kullanıcı kararı, 02.10.2026 — her sürümde AYNEN; sormadan, eksiksiz)
Bağlam kopsa da bu düzen değişmez. Kullanıcı "zip ver" dediğinde şu üç zip + SHA256SUMS verilir:
1. `DestekOfis-<s>-1-Guncelleme-ve-Belgeler.zip` → içinde **`GitHub-v<s>/`** klasörü: `destekofis-guncelleme-<s>.zip`,
   `destekofis-guncelleme.json` (İMZALI), `DestekOfis-Kullanim-Kilavuzu.pdf`; kökte OKU-BENI, sürüm notları, belgeler.
2. `DestekOfis-<s>-2-Kurulum.zip` → içinde **`GitHub-v<s>/`**: `DestekOfis-Kurulum.exe` + `.sha256`.
   (Zip 50 MB'ı aşarsa dosya gönderiminde sınır var: .exe ve .sha256 ayrıca gönderilir.)
3. `DestekOfis-<s>-Kaynak-ve-Denetim.zip` (git bundle, test çıktıları).
- İmza anahtarı: kullanıcının oturuma YÜKLEDİĞİ dosya (`/root/.claude/uploads/<oturum>/*imza-anahtari*.pem`); ortam
  değişkeninde aranmaz. `node tools/release.mjs --anahtar <o dosya>`. Anahtar hiçbir zip'e, depoya, belgeye girmez.
  Dosya yoksa kullanıcıdan anahtarı oturuma yüklemesi istenir (sohbete yapıştırması değil).
- Kurulum: `npm run build:windows` (bu ortamda Wine + Inno Setup çalışır). Yeni kapsayıcıda önce: `dpkg --add-architecture i386;
  apt-get install wine wine32 binutils-mingw-w64-x86-64` (windres yoksa başlatıcı SİMGESİZ derlenir — 2.0.19'da yakalandı).
- Akış: testler → PR → kullanıcı "birleştir" → CI yeşil → birleştir → kullanıcı yayın açar (tag v<s>, 5 dosya) →
  "yayımladım" → yayındaki dosyalar bayt bayt + güncelleyici "available" denetimi → site PR'ı (kılavuz, aşağıda).
- Site: demo .exe yayından iner; kılavuz İNMEZ (`ceougur/destekofis` → `web/indir/`), her sürümde site PR'ı açılır.

## Standart / Pro (kullanıcı kararı, 29.09.2026)
- Tek program, tek kod, tek güncelleme; Pro lisansla açılır. Düzeltme ve yeni özellik herkese gider; yalnız kullanıcı
  "Pro'ya özel" derse Pro kilidine girer. Ayrıntı: `docs/PRO-UZAKTAN-GORUNTULEME.md` → "Paket kuralları".

## Açık iş
- 2.0.12 yayımlandı (PR ceougur/ofis---y-netimi#12, `v2.0.12`; beş dosya bayt bayt doğrulandı; müşteri: taksit kartının
  Kayıt Tarihi carinin tarihinden gelir).
- 2.0.13 yayımlandı (01.10.2026; PR ceougur/ofis---y-netimi#13, `v2.0.13` = 20e110d; beş dosya bayt bayt doğrulandı, latest/DestekOfis-Kurulum.exe
  2.0.13; dal `master` üzerine sıfırlandı): WhatsApp, ödeme yolu, Ana Defter,
  mutabakat kapısı, dört çekirdek (Kasa, Stok, Cari, Taksit) tarih/kilit/yuvarlama kuralları, Eksi Bakiye Denetimi
  (Nakit/Banka/Kredi Kartı: Uyar/Engelle/Kontrol Yok — kullanıcı onayı 01.10.2026), hepsini seç + hariç tut. Holding stres
  simülasyonu kullanıcı kararıyla iptal. Doğrulama: `npm test`, `npm run test:mutabakat`, `npm run mutabakat`,
  `npm run test:senaryo-whatsapp` (1.000 cari). Senaryolar tarihe bağlı yazılmasın (ayın 1'inde kırılanlar düzeltildi).
- 2.0.14 yayımlandı (01.10.2026; PR ceougur/ofis---y-netimi#14, `v2.0.14` = 6337029; beş dosya ve latest/ adresleri bayt
  bayt doğrulandı; gerçek güncelleyici 2.0.13 ve 2.0.12 olarak canlı GitHub'da 2.0.14'ü "available" gördü, indirme sha256
  eşleşti; dal `master` üzerine sıfırlandı): arama kutularında ve bütün programda odak (`HOF.swap`, `test:senaryo-214`),
  detay panelinde Cari Kartı (#hof-checks ↔ #hof-case-plan yer kavgası), WhatsApp Otomatik Sıra + kendiliğinden inen ekstre
  PDF'i, Tablodan Aktar geri alma damgası. Meta WhatsApp Business API (kendiliğinden gönderim + PDF eki) ayrı Pro özelliği
  olarak ileride tasarlanacak; resmî olmayan otomasyon yapılmaz.
- 2.0.15 yayımlandı (02.10.2026; PR ceougur/ofis---y-netimi#15, `v2.0.15` = 85171ae; beş dosya ve latest/DestekOfis-Kurulum.exe
  bayt bayt doğrulandı; gerçek güncelleyici 2.0.14/13/12/2.0.4/1.7.0 olarak yayındaki bildirgeyle 2.0.15'i "available" gördü;
  imza anahtarı: kullanıcının oturuma yüklediği .pem, `node tools/release.mjs --anahtar …`; kurulum .exe Wine + Inno Setup;
  dal `master` üzerine sıfırlandı). İçerik — 01.10.2026 kullanıcı isteği:
  1. Küçük düzeltme (müşteri): sol menüdeki "Yeni Kayıt" kalkar; ana listede "Dışa Aktar"ın yanına "Yeni Kayıt".
  2. FATURA modülü (sol sabit menüde "Fatura"): GİB e-Fatura/e-Arşiv, UBL-TR, PEPPOL uyumlu mimari. Kurallar: fatura
     kesilince stok (miktar/maliyet), cari (borç/alacak), vadeli/taksitliyse Taksit motoru, peşinse Kasa — hepsi tek
     BEGIN IMMEDIATE işlemde; KDV (%1/%10/%20…), tevkifat, KDV dahil/hariç, roundMoney; e-Fatura/e-Arşiv senaryoları
     (Temel/Ticari) için VKN/TCKN/MERSİS/adres/tüzel-gerçek doğrulaması; Entegratör Adaptör Katmanı (Logo, İzibiz,
     Digital Planet, QNB e-Finans, GİB) + PEPPOL; dönem kilidi ve tarih sızıntısı koruması; iptal/iade sonrası Kasa,
     Stok, Cari, Taksit ↔ Ana Defter mutabakat kapısı. Ayrıntı istekleri: cari kartında "Alış Faturası" ve "Satış
     Faturası" pilleri; panelde Alıştan İade / Satıştan İade (kasa, cari, çek/senet entegre); iade edilecek faturayı
     arama motoru en üstte; faturada Not (altına basılır); fatura tarihi ve saati; kesilen faturaları görüntüleme,
     süzgeç, seçim; fatura kartında 2 pil; cari + ürün girilince bu müşteriye ve başka müşteriye son alış/satış fiyatı.
     Kullanıcı: "sorman gereken yerde önerini yap; bitince seçtiklerini maddeler hâlinde yaz".
     Ek (aynı gün, ikinci mesaj): ÇEK/SENET de zincirde — tahsilat/ödeme türü Çek veya Senet ise fatura anında Çek/Senet
     modülüne portföy girişi (alış faturasında verilen evrak) yazılır ve cari ile mahsuplaşır; tümü aynı tek işlemde.
     Çek/Senet vade/işlem tarihleri de kronolojik kurala bağlı; mutabakat kapısı Çek/Senet alt defterini de kapsar.
     Ek (üçüncü mesaj): fatura modülü tüm diğer bölümlerle ve RAPORLARLA entegre, doğru mantıkla çalışacak (cari ekstre,
     Kasa, stok, taksit, çek/senet, ANLIK DURUM, Vade Takip, Rapor Merkezi, Ana Defter/mizan, WhatsApp ekstre, çöp/geri al).
     QA denetimi (02.10.2026, `docs/FATURA-QA-RAPORU.md`) sonrası kullanıcı kararı: icra dosyası bağı YAPILMAZ ("cariyi
     ekleyerek kesebilir müşteri"); diğer bulgular yapıldı: formda "+ Yeni Cari", toplu kes / toplu iptal, PDF'te logo
     (JPEG, 150 KB) ve kaşe/imza kutuları, kartta E-Posta, fatura kalemli stok kartı silinmez, "Fiyat Farkı Faturası".
     Testler: `test/fatura-215.test.mjs`, `senaryo-215` adım 12–14. Kullanım kılavuzuna "Fatura" bölümü eklendi
     (kullanıcı isteği; k24 ekranı; PDF yeniden üretildi, client/kilavuz'a kopyalandı — siteye yükleme kullanıcıda).
- 2.0.16 yayımlandı (02.10.2026; PR ceougur/ofis---y-netimi#16, `v2.0.16` = bd777e9; beş dosya ve latest/ adresleri
  (Kurulum.exe, guncelleme.json) bayt bayt doğrulandı; gerçek güncelleyici 2.0.15/14/13/12/2.0.4/1.7.0 olarak (Node 24.21,
  bootstrap 2) canlı yayında 2.0.16'yı "available" gördü, indirilen paket sha256 e1f38ccc… eşleşti; site kılavuz PR'ı
  ceougur/destekofis#4). 11 müşteri maddesi madde madde kanıtlı: `docs/2.0.16-KANIT.md`, `CHANGELOG.md` → 2.0.16,
  `test/fatura-216.test.mjs`, `npm run test:senaryo-216` (51 denetim; 42 rapor arayüzden ön izleme+PDF+Excel).
  Kararlar (önerim uygulandı; korunur): Düzenle yalnız satış/alış/SMM (iade belgesi iptal+yeniden); taksitinden tahsilat
  alınmış, iadesi olan, e-Belgesi gönderilmiş, kilitli dönemdeki faturada Düzenle kapalı; Toplamlar: Ara Toplam = matrah
  HER ZAMAN ayrı satır, iskonto varsa Toplam/İskonto KDV hariç (2.000 KDV dahil %10 → 1.666,67 − 166,67 = 1.500), iskontosuz
  KDV dahilde Toplam = girilen tutar (16.500 · 13.750 · 2.750 · 16.500); tahsilatta "POS", ödemede "Kredi Kartı" (kayıtlı
  değer `card`); "kes" yerine "kaydet"; Stok Kodu tekil. Eksi stok (kullanıcı kararı 02.10.2026): program sorar, "izin ver"
  denince eksiye düşer; bazı firmalar gerçek stok tutmaz; BÖYLE KALSIN, değiştirilmez.
  Güncelleyici denetimi notu: Node'un fetch'i vekil sunucuyu `NODE_USE_ENV_PROXY=1` ile kullanır (yoksa GitHub istek
  sınırı); `createUpdater({ nodeVersion: "24.21.0", bootstrapVersion: 2 })` — kurulu programın değerleri.
- 2.0.17 müşteri istekleri (02.10.2026'dan; kullanıcı "yap" dedi 02.10.2026; HEPSİ YAPILDI, dal `claude/nice-euler-jvajxv`,
  kanıt `docs/2.0.17-KANIT.md`, CHANGELOG → 2.0.17; madde 14 yalnız kılavuz notu; PR/paket/yayın kullanıcı onayıyla):
  DURUM: m9+m11 8000a70 · m5 13cc966 · m8 14295cf · m7 4e57d29 · m10 a7b8df2 · m1 481f43a · m4 1a11cee · m2+m3+m6+m12+m13
  çoklu şirket commit'i (hub + `sirketler/<kod>/`, sol üst şirket seçici, ortada sayfa şeridi, Yönetim → Şirketler,
  zil/takvim bütün sayfalar). Mimari: `docs/MIMARI.md` → "2.0.17 eklemeleri".
  1. Fatura listesinde SİLME yok (ekran: 10 belge, hepsi "İptal Edildi", Tümü seçili; seçim çubuğunda yalnız PDF/Excel/
     Temizle). Müşteri: tümünü seçip iptal eder gibi KOMPLE SİL; faturanın içinde (kartta) da "Sil" düğmesi.
     Koddan durum: `DELETE /api/workspace/invoices/:id` yalnız taslağı siler ("Kaydedilmiş fatura silinmez; düzenleyin
     ya da iptal edin."); toplu yalnız "Seçilenleri Kaydet" (taslak) ve "Seçilenleri İptal Et" (kaydedilmiş); iptal edilen
     belgeler listede kalıcı. Program genelinde Silinenler (routes/trash.mjs, Yönetim → geri yükleme) var.
     Öneri (yap'ta uygula): kartta "Sil" (taslak, kaydedilmiş, iptal edilmiş) + seçim çubuğunda "Seçilenleri Sil (n)";
     kaydedilmiş belge silinirken tek işlemde iptaldeki gibi bütün etkiler geri alınır (stok, cari, Kasa, taksit,
     çek/senet; mutabakat kapısı), belge listeden kalkıp Silinenler'e gider (geri yüklenirse etkisiz, "İptal Edildi"
     olarak döner). Engeller iptalle aynı (iadesi olan → önce iade; e-Belgesi gönderilmiş silinmez; kilitli dönem;
     tahsilatı alınmış taksit / işlem görmüş çek). Toplu silmede iade belgeleri önce (yeni tarihli önce); onay penceresinde
     sayı ve tutar; sonuç belge belge (silinen / nedeniyle silinemeyen). Numara: silinen serinin son numarasıysa sayaç
     geri alınır, aradaysa boşluk kalır. İşlem geçmişine yazılır; yetki: fatura yönetimi.
     Not: müşterinin ekranı 2.0.15 ("Kesilen" sekmesi, "Kesilen belgeler…" yazısı); 2.0.16'da "Satış Faturaları"/"Kaydedilen".
  2. ÇOKLU ŞİRKET (kullanıcı: "BUNU ÇOK İYİ ANLA"). Sol üstteki "çalışma oturumu" yerine ŞİRKET SEÇİMİ. Oturum açınca
     cariler kaybolmaz (oturum yalnız tablo verisini ayırır); ŞİRKET açınca her şey SIFIRDAN: cari, Kasa, stok, taksit,
     çek/senet, fatura, Ana Defter, tablolar — hiçbiri öbür şirketten gelmez. Örnek: resmî ve gayri resmî şirket ayrı.
     Koddan durum: tek veri tabanı (`config.dbPath`, `server/app.mjs` openDatabase); "oturum" = `dataset.sessions`
     (server/lib/dataset.mjs) yalnız Excel/tablo kümesini ayırır; cari/Kasa/stok/fatura tabloları oturumdan bağımsız, ortak.
     Öneri (yap'ta uygula; büyük mimari iş): şirket = AYRI veri tabanı dosyası (yaygın muhasebe programlarındaki "firma"
     gibi; veri karışması imkânsız, yedek/geri yükleme şirket bazında). Ortak katman: lisans, kullanıcılar, şirket listesi.
     Şirket içinde: bütün modüller + tablo oturumları + şirket ayarları (unvan, VKN, logo, fatura serisi, dönem kilidi, Kasa
     hesapları). Sol üstte "Şirket: <ad> ▾" (Şirket Değiştir, + Yeni Şirket, Yeniden Adlandır; silme yalnız yönetici, çift
     onay, önce yedek). Mevcut veri ilk şirket olur (göçte hiçbir kayıt kaybolmaz). Kullanıcı yetkisi şirket bazında
     (hangi şirketleri görür). Açık pencereler/olay akışı/bildirimler/önbellek şirket değişince sıfırlanır; her istek
     seçili şirkete gider; raporlar, PDF/Excel başlığı şirket unvanıyla. Güncelleyici, yedek, mutabakat her şirket için.
     Testler: iki şirkette aynı adlı cari, birinde tahsilat → öbüründe Kasa/cari değişmez; geçişte açık pencere eski şirket
     verisi göstermez; yetkisiz kullanıcı şirketi göremez; göç provası (eski veri = ilk şirket, sayılar aynı).
     KARAR (kullanıcı, 02.10.2026): şirket sayısı lisansa BAĞLI DEĞİL (herkese sınırsız). Şirketler arası BİRLEŞİK
     RAPOR İLK SÜRÜMDE OLACAK (seçilen şirketlerin Kasa, cari, stok, fatura, ANLIK DURUM toplamları yan yana + toplam;
     yalnız kullanıcının yetkili olduğu şirketler; her satırda şirket adı; PDF/Excel).
     Müşteri açıklaması (aynı konu): "001 kodlu şirket, 002 kodlu şirket diye datada ayırır, ikisinin datasını ayrı
     tutar" → her şirketin ŞİRKET KODU olur (001, 002, 003… sıradaki kod önerilir, değiştirilebilir, tekil, 3 hane).
     Veri dosyası koda bağlı (ör. `sirketler/001/…`); seçicide, sol üstte, rapor/PDF/Excel başlığında ve birleşik
     raporda "001 · Unvan" biçiminde görünür. Kod değişse de veri aynı şirkette kalır (iç kimlik ayrı).
  3. ÇALIŞMA OTURUMU KALKAR (kullanıcı, 02.10.2026; ekran: sol üstte "Çalışma Oturumu ▾", açılır listede "İcra ve Dava
     Takip Dosyaları · 1.598 kayıt · Sheets'e bağlı", "+ Yeni Oturum Aç", "Oturumları Yönet"): 2. madde (şirket) gelince
     gereksiz, kafa karıştırır → oturum seçicinin yerini ŞİRKET seçici alır; "Oturum" sözcüğü arayüzden, kılavuzdan,
     Yönetim'den kalkar. Kod: `client/assets/hof-sessions.js` (seçici, Yeni Oturum Aç, Oturumları Yönet),
     `server/lib/dataset.mjs` `dataset.sessions`/`dataset.session.user.*` (kullanıcıya göre oturum). Sol alttaki "Senkron
     Aktif" kartı oturum adı yerine şirket ("001 · Unvan") ve tablo bağlantısını gösterir.
     Öneri (yap'ta uygula): her şirketin TEK tablo kümesi olur (sekmeler + Sheets bağlantısı şirkette). Göç: tek oturum
     varsa sessizce 001'in tablosu olur. Birden fazla oturum varsa yöneticiye tek seferlik "Oturumları Taşı" ekranı:
     her oturum için "001'in tablosu" (yalnız biri) / "Yeni Şirket Yap" (o oturumun tablosuyla, cari/Kasa sıfır) /
     "Silinenler'e Al" (geri yüklenebilir). Hiçbir kayıt kendiliğinden silinmez; seçim yapılana kadar 001'in tablosu
     varsayılan oturumdur. Test: tek/çok oturumlu eski veriden göç, Sheets bağı korunur, sayılar aynı.
  4. GÜNCELLEME GEÇ GELİYOR (kullanıcının kendi kurulumu, 02.10.2026 14:28): 2.0.14'te kaldı; 2.0.15 (07:44) ve 2.0.16
     (10:38) yayımlandığı halde gelmedi; "Güncellemeleri Denetle" → "Güncelleme sunucusu zamanında yanıt vermedi."; 2 dk
     sonra yeniden denemede 2.0.16 bulundu ("aldı şimdi"). Kök neden (koddan): (a) otomatik denetim YALNIZ servis
     açılışında (`update-orchestrator.mjs` startup → runCheck) + hata sonrası 4 yeniden deneme; servis 22 saat açık
     kalınca yeni sürüm hiç denetlenmez → periyodik denetim yok. (b) tek istek 10 sn zaman aşımı (`requestTimeoutMs`) ve
     GitHub API'den 30 yayının tamamı (~367 KB, gövdeler dahil) çekiliyor; elle denetimde yeniden deneme yok.
     Öneri (yap'ta uygula): servis açıkken 6 saatte bir (+ rastgele kayma) sessiz denetim; bulunursa "Sunucu açılışında
     kendiliğinden kur" açıksa mesai dışı/boşta kurulum ya da yöneticiye bildirim (zil) "2.0.x hazır — Şimdi Güncelle";
     istek zaman aşımı 30 sn, elle denetimde 3 deneme (artan bekleme); `per_page=10`; API erişilemezse yedek yol
     `releases/latest/download/destekofis-guncelleme.json` (API'siz, istek sınırı yok). Test: sahte sunucuyla gecikme,
     zaman aşımı, periyodik denetim saati (sahte saat), yedek yol.
  5. HAYALET KISMİ ÖDEME (müşteri, 2 kez; ekran: Alış Faturası 89, Mehmet Eren Demir, 6.000, "Kısmen Ödendi", "Peşin
     ödeme yok. Açık: 5.600 · ödenen 400"; müşteri ödeme yapmadı). Kök neden (koddan + yeniden üretildi,
     `settleInvoices` ile): `server/lib/invoice-settle.mjs` otomatik FIFO kapama — alış tarafında carinin BÜTÜN borç
     (debit) satırları "ödeme" sayılır, faturaya bağlı değilse en eski açık alış faturasına dağıtılır. Aynı cari hem
     müşteri hem tedarikçi olunca: aynı kişiye 400'lük SATIŞ faturası, cari kartından başka iş için 400 ödeme, ya da
     400'lük borç/taksit kartı → alış faturası "Kısmen Ödendi · ödenen 400". Tersi de var (alış/alacak satırı satış
     faturasını "ödenmiş" gösterir). Kartta neyin kapattığı da görünmüyor.
     Öneri (yap'ta uygula): (a) kapama YÖNE göre: alış faturasını yalnız ödeme niteliğindeki satırlar kapatır (Kasa/
     banka/POS ödemesi, verilen çek/senet, alıştan iade, carinin alacak açılışı değil borç açılışı); satış faturası,
     taksit kartı borcu, borç kaydı ödeme SAYILMAZ (satış ↔ alış karşılıklı kapama yalnız açık "Mahsup Et" işlemiyle,
     yaygın programlardaki mahsup fişi gibi; cari BAKİYESİ zaten netleşir, değişmez). Satış tarafında simetrik.
     (b) cari kartında ödeme/tahsilat formunda "Kapatılacak Fatura: Otomatik (En Eski) / <fatura seç>"; seçilirse bağlı.
     (c) fatura kartında "Bu Faturayı Kapatanlar" listesi (tarih, tür, tutar, otomatik/bağlı) — her ödenen kuruşun
     kaynağı görünür. (d) mutabakat: fatura ödenen toplamı = bağlı + FIFO dağıtılanlar. Test: hem müşteri hem tedarikçi
     cari (satış 400 + alış 6.000 → alış Açık 6.000), bağsız ödeme FIFO, Mahsup Et, seçilen faturaya ödeme, iptal/silme
     sonrası kapama yeniden hesap, 2.0.15/2.0.16 verisinde durum değişimi raporu.
     Ek (müşteri, aynı gün): "faturayı kaydettin, kopyaladın, kopyayı kaydedince kısmen ödendi yapıyor". Koddan +
     API ile denendi: Kopyala ödeme TAŞIMIYOR (`startForm({ copyOf })` → `pay: payFrom(draft?.payment)`, kopyada boş);
     tek başına kopya "Açık" kalıyor. Görülen, AYNI kök neden (FIFO, madde 5): carideki fazla borç satırı (ör. aynı
     kişiye satış) önce en eski alış faturasını kapatır, artanı en yeni faturaya — yani kopyaya — düşer → kopya
     "Kısmen Ödendi · 400". Denemede aynı cariye 2 satış (6.000) girilince 2 alış faturası da "Ödendi" oldu. Madde 5'in
     düzeltmesiyle kapanır; testine "kopyala → kaydet → Açık" ve "satış + alış + kopya" eklenecek.
  6. ŞİRKET VERİSİNİ SIFIRLA (müşteri Ahmet Alanlı, 02.10.2026 14:40; Şahin de isteyecek): "bulunduğumuz şirket
     üzerindeyken tüm hareketleri sil / datayı sıfırla; varolan datayı komple sıfırlayıp yeniden girmek istiyoruz";
     "datayı silerek çözerim de lisansım gider". Koddan: lisans aynı veri tabanında (`server/lib/license.mjs`
     store.setting: token, makine kimliği, deneme başlangıcı) → veri klasörünü silen lisansı da kaybeder.
     Öneri (yap'ta uygula; 2. maddeyle birlikte): Yönetim → seçili şirket → "Şirket Verisini Sıfırla" (yalnız yönetici).
     İki seçenek: "Tüm Hareketleri Sil" (cari/stok kartları, Kasa hesapları, ayarlar KALIR; bakiyeler sıfır: cari
     hareketleri, Kasa, stok hareketleri, faturalar, taksitler, çek/senet, Ana Defter, işlem geçmişi silinir) ve "Tümünü
     Sıfırla" (şirket ilk açıldığı gibi boş; şirket adı/kodu, unvan/VKN/logo, fatura serisi kalır). Öncesinde ZORUNLU
     yedek (adı "sifirlama-öncesi-<tarih>", Yedekler'den geri yüklenebilir); onay: şirket kodunu/adını yazdırma + parola.
     Lisans, kullanıcılar, öbür şirketler etkilenmez (ortak katman). Numaralar (fatura serisi sayaçları) sıfırlanır mı
     sorulur (varsayılan: sıfırlanır). İşlem geçmişine "veri sıfırlandı" kaydı kalır. Test: sıfırla → lisans aynı,
     kullanıcılar giriş yapar, öbür şirket sayıları aynı, sıfırlanan şirkette her rapor boş, mutabakat 0; yedekten
     geri yükle → sayılar eski hâline döner.
  7. EKSİ STOK KAÇA DÜŞTÜ GÖRÜNMÜYOR (müşteri, 02.10.2026): "stok miktarında eksiye düşenin kaça düştüğünü göstermiyor;
     eksiye düşerek devam edebilmesi lazım −10 −15 −20 gibi". Koddan + 2.0.16'da API ile yeniden denendi: VERİ DOĞRU —
     0'dan 10, 5, 5 satışta (her biri sorulup "Yine de Kaydet") stok kartı/liste/fatura önerisi −10 → −15 → −20 oluyor;
     eksiye düşme kararı (kullanıcı 02.10.2026: sorulur, izinle düşer) çalışıyor. Görünüm açıkları: (a) eksi üründe
     yalnız "Tükendi" rozeti (hof-stock.js stateBadge; Stok Durumu raporu durum kolonu `qty <= 0 ? "Tükendi"`) — 0 ile
     −20 aynı görünüyor; (b) soru metni sonucu söylemiyor ("stokta −10 var; faturadaki 5 eksiye düşürür" → kayıttan
     sonra kaç olacağı yok); (c) Değer `Math.max(0, qty)` ile 0; (d) ANLIK DURUM/Kritik Stok eksi ürünü ayrı saymıyor.
     Müşteri 2.0.15'teydi; hangi ekranda gördüğü sorulacak (ekran görüntüsü). Öneri (yap'ta): eksi üründe rozet "Eksi
     Stok −15 Adet" (kırmızı), 0'da "Tükendi"; soru: "Kayıttan sonra stok: −15 Adet olacak"; stok listesinde "Eksi
     Stoktakiler" süzgeci ve sıralama; Stok Durumu raporunda durum "Eksi (−15)"; ANLIK DURUM'da "Eksi Stok: n ürün";
     fatura kalem satırı "Stokta −15 Adet" kırmızı; Değer eksi miktarda "—" (maliyet bilinmiyor) ya da eksi değer —
     yaygın programlarda eksi miktar × son maliyet gösterilir → öyle. Test: 0→−10→−15→−20 arayüzden; her ekranda sayı.
  8. ÇEK CİRO: CARİ BULUNMUYOR (müşteri, ekran: "Ciro Et · Çek ₺3.000", "Ciro Edilen Cari (tedarikçi)" kutusunda hiçbir
     cari gelmiyor). Kök neden (koddan): `client/assets/hof-cheques.js:279` seçici `type: "supplier"` → sunucu
     `/api/workspace/accounts/search?type=supplier` yalnız türü "Tedarikçi" olan carileri döndürür (`accounts.mjs` list:
     `if (type && row.type !== type) continue`). Carilerin çoğu "Müşteri" (kayıttan/faturadan açılan) → liste boş.
     Program genelinde türe kısıtlı başka seçici yok (yalnız burası). Öneri (yap'ta): ciroda BÜTÜN cariler aranır
     (müşteriye de ciro edilir: borç ödemesi, mal alımı); tedarikçiler listede üstte, tür rozetiyle; etiket "Ciro Edilen
     Cari"; seçicide "+ Yeni Cari" (fatura formundaki gibi); boş sonuçta "Bu adla cari yok — + Yeni Cari". Aynı denetim
     tahsil/ödeme/teminat formlarındaki seçicilere de (tür kısıtı kalmasın). Test: yalnız Müşteri türünde carisi olan
     veride ciro arayüzden; tedarikçi + müşteri aynı adla; ciro sonrası cari bakiyesi, çek durumu "Ciro Edildi", Kasa aynı.
  9. ÖNCELİKLİ — KASA PENCERESİNDE ÖDEME YOLU YALNIZ NAKİT (kullanıcı, 02.10.2026: "dün konuşmuştuk, yapmamışsın,
     müşteriye mahçup oldum"; bu istek hiçbir notta/CLAUDE.md'de/CHANGELOG'da kayıtlı DEĞİLDİ — kaybolmuştu). Kasa
     penceresinin kendi formları "Kasaya Tahsilat Ekle" / "Kasadan Ödeme Ekle" / "Tahsilatı/Ödemeyi Düzelt"
     (`client/assets/hof-workspace.js` editCashEntry → `HOF.methodField(... cashView.method ...)`) Havale/EFT, POS,
     Kredi Kartı seçeneği gösteriyor. İstenen: Kasa'da tahsilat ve ödeme yolu YALNIZ NAKİT — açılır liste yok, sabit
     "Nakit" (sunucu da Kasa formundan gelen nakit dışı yolu reddeder). Banka/POS hareketleri cari, fatura, taksit,
     stok, çek ekranlarından gelir; Kasa penceresindeki Banka / POS sekmeleri yalnız GÖRÜNTÜLEME (o sekmedeyken
     "+ Tahsilat/Ödeme" düğmesi Nakit Kasa'ya yazar ve bunu söyler, ya da sekmede gizlenir). Düzeltmede eski kayıt
     nakit dışıysa yolu değiştirilmez, salt okunur gösterilir. Aynı kontrol: detay kartı Tahsilat (`hof-workspace.js`
     45/355) hangi yolu sunuyor — kullanıcıya sorulmadan değiştirilmez, yap'ta ekranla birlikte gösterilir. Test:
     arayüzden Kasa → Tahsilat Ekle / Ödeme Ekle formunda yalnız Nakit; API'ye bank/card gönderilince 400; Banka
     sekmesindeyken eklenen hareket Nakit Kasa'da.
     Ek (müşteri, aynı gün, ekran: Kasa ve Banka penceresi, "Tümü / Nakit Kasa / Banka (Havale / EFT) / POS / Kredi
     Kartı" sekmeleri işaretli): MANTIK = KASADA YALNIZ NAKİT AKIŞI görünür, başka hiçbir şey. Banka/POS/Kredi Kartı
     sekmeleri ve "Kasa ve Banka Toplamı" Kasa penceresinden KALKAR (pencere adı "Kasa", gösterge "Nakit Kasa"; Kasa
     Dökümü PDF yalnız nakit). Banka modülü henüz yok → havale/EFT, POS, kredi kartı hareketleri (cari, fatura, taksit,
     stok, çek ekranlarından girilenler; veri zaten `method` ile tutuluyor, hiçbir kayıt kaybolmaz) RAPORLARA taşınır:
     Raporlar'da "Banka ve POS Hareketleri" (yol süzgeci: Banka / POS / Kredi Kartı; tarih aralığı; giriş-çıkış-bakiye;
     PDF/Excel) + ANLIK DURUM'da Nakit Kasa ile Banka/POS ayrı kartlar. Kasa ↔ Banka TRANSFERİ: Kasa'da "Banka'dan Kasaya
     Aktar" / "Kasadan Bankaya Yatır" — Kasa'da NAKİT giriş/çıkış olarak görünür, banka raporunda karşı hareket; tek
     işlemde, mutabakat kapısında. Detay kartı/cari/fatura tahsilatlarında Havale/POS seçimi KALIR (Kasa'ya değil banka
     raporuna düşer) — önceki sorum bununla cevaplandı. Eksi Bakiye Denetimi (Nakit/Banka/Kredi Kartı) kalır. Test: Kasa'da
     yalnız nakit; bankaya tahsilat Kasa toplamını değiştirmez, raporda görünür; transfer iki tarafta; eski verideki
     bank/card Kasa kayıtları raporda, Kasa'da yok; mutabakat 0.
  10. İADE FATURASINDA DÜZENLE PASİF (müşteri, ekran: Satıştan İade Faturası IAD2026000000003, Mehmet Eren Demir, 600,
     asıl fatura FIS2026000000009; "Düzenle" gri, tıklanmıyor). Koddan: 2.0.16'da bilinçli karar (benim önerim) —
     `server/routes/invoices.mjs:382` modifyBlock "İade belgesi düzenlenmez; yanlışsa iptal edip yeniden kaydedin.";
     neden yalnız düğmenin üstüne gelince (title) görünüyor, ekranda yazmıyor → müşteri "izin vermiyor" görüyor.
     Öneri (yap'ta): iade faturası da DÜZENLENİR — aynı numara, tek işlemde eski etkiler geri alınıp yenisi yazılır
     (stok, cari, Kasa/banka iadesi, çek; mutabakat kapısı), asıl faturayla bağ korunur; sınırlar: iade miktarı asıl
     faturanın kalan iade edilebilir miktarını aşamaz (bu iade hariç hesap), tarih asıl faturadan önce olamaz, asıl
     fatura/cari değiştirilemez (gerekirse iptal + yeni). Ayrıca GENEL: pasif düğmenin nedeni düğmenin yanında/altında
     görünür yazı olarak çıkar (yalnız title değil) — Düzenle, İptal Et, Sil, İade için. Not: bu iadede ödeme satırı
     "Ödeme (Kredi Kartı) 600" — müşteriye karta iade; satıştan iadede yol adı "POS İadesi" daha doğru, yap'ta kontrol.
     Test: iade düzenle (miktar azalt/artır sınırda, fiyat, ödeme yolu) → stok/cari/Kasa yeni hâl; aşan miktar 409;
     asıl faturanın "iade edilebilir" kalanı doğru; pasif düğme nedeni ekranda.
  11. BANKA MODÜLÜ YOKKEN BANKA EKSİ BAKİYE UYARISI (müşteri, ekran: Satıştan İade, müşteriye iade ödemesi Havale/EFT →
     "Banka Bakiyesi Eksiye Düşecek — Banka hesabında (Havale / EFT) −3.600,00 TL var; 3.600,00 TL çıkış bakiyeyi
     −7.200,00 TL eksiye düşürür"). Koddan: `server/lib/pay-method.mjs` NEGATIVE_DEFAULT { cash, bank, card: "warn" };
     `server/routes/cash.mjs` guardOut banka/POS "bakiyesini" yalnız programa girilmiş havale/POS hareketlerinden
     hesaplar — açılış bakiyesi, banka ekstresi, mevduat yok → sayı anlamsız, uyarı yanıltıcı. Öneri (yap'ta; madde 9
     ile birlikte): Banka modülü gelene kadar Eksi Bakiye Denetimi YALNIZ NAKİT KASA için (Banka ve POS/Kredi Kartı
     denetimi kapalı; Yönetim → Eksi Bakiye Denetimi'nde yalnız "Nakit Kasa" alanı görünür; mevcut kurulumlarda bank/card
     ayarı göçle "off"). Banka modülü gelince (açılış bakiyesi + hesaplar) denetim geri açılır. Madde 9'daki "Eksi Bakiye
     Denetimi (Nakit/Banka/Kredi Kartı) kalır" cümlesi bu maddeyle DEĞİŞTİ. Test: havale ile iade/ödeme → soru çıkmaz;
     nakit iade Kasa'yı eksiye düşürecekse soru çıkar; Yönetim ekranında yalnız Nakit Kasa ayarı.
  12. "+ SAYFA → EXCEL'DEN AKTAR" SERBEST IZGARA OLUYOR, TARİH UYARISI YOK (müşteri, ekran: sekmeler "REHBER 9176" ve
     "AKABE 16"; AKABE "Serbest Sayfa" — A/B/C kolon harfli Excel ızgarası, "sigorta tarihi" kolonunda 03.10.2026 var
     ama yaklaşan tarih uyarısı gelmiyor). İstenen: Excel'den aktarılan sayfa, OTURUM AÇARKEN yüklenen Excel gibi
     alınsın (veri sekmesi: ön izleme + kolon rolleri, tarih kolonu tanınır, takvim/uyarı/detay kartı çalışır). Koddan:
     "+ Sayfa" aktarımı `server/lib/free-import.mjs` → serbest sayfa (`free-sheets.mjs`); `dataset.mjs` yalnız satırlarını
     görünüme ekliyor (freeProvider.viewRows), kolon rolleri/tarih sınıflandırıcısı ve uyarı motoru (`alerts.mjs`)
     serbest sayfayı veri sekmesi gibi işlemiyor (yap'ta kesin doğrulanacak). Öneri (yap'ta): "+ Sayfa" penceresinde
     "Excel / Google Sheets'ten Aktar" = VERİ SEKMESİ (ilk yüklemedeki ön izleme ve eşleme ekranı: kolon rolleri, tarih
     anlamı, %90 otomatik + şüpheliler sarı) → sekme mevcut şirketin tablosuna eklenir, uyarılar/takvim/rapor/detay
     kartı onu da kapsar; "Boş Sayfa" (elle doldurulan ızgara) seçeneği ayrı kalır. Mevcut serbest sayfalar için
     sekme menüsünde "Veri Sekmesine Dönüştür" (veri kaybı yok, geri alınabilir). Test: tarih kolonlu Excel'i + Sayfa
     ile aktar → yarın tarihli satır için zil/sağ alt uyarısı ve tahsilat takviminde görünür; aynı dosya ilk yüklemedeki
     gibi aynı rolleri alır; dönüştürme sonrası satır sayısı aynı.
  13. YENİ DÜZEN — SOLDA ŞİRKET, ORTADA SAYFA = OTURUM (müşteri, aynı gün; madde 2, 3 ve 12'yi birleştirir/günceller):
     "oturumu komple kaldırırsak oturum kısmını buraya (+ Sayfa) taşıyalım; buradan aldığımızı oturumdan almış gibi
     yapsın — ikinci sayfa ikinci oturum, üçüncü sayfa üçüncü oturum"; "sol taraf şirket seçimi ve şirketle ilgili
     modüller (Cari, Kasa, Stok, Fatura, Taksit, Çek/Senet, Raporlar…); orta kısım serbest alan, oturumlarımızın sayfa
     sayfa olacağı alan". Kullanıcı: "değerlendir". DEĞERLENDİRME (önerim; yap'ta uygulanır):
     - Doğru ve yaygın düzen (sol: firma + modüller; orta: çalışma sayfaları). Oturum seçici kalkar; eski "oturum"
       = ortadaki SAYFA. Her sayfa ayrı veri kümesi: kendi kaynağı (Excel / Google Sheets bağı, senkron), kolon rolleri,
       tarih anlamı, veri sağlığı. "+ Sayfa" seçenekleri: "Excel / Google Sheets'ten Aktar" (ilk yüklemedeki ön izleme
       + eşleme ekranı — veri sayfası) ve "Boş Sayfa" (elle doldurulan ızgara, bugünkü serbest sayfa).
     - Fark (oturuma göre KAZANÇ): oturumda yalnız seçili oturum görünüyordu, uyarılar onunla sınırlıydı; sayfa düzeninde
       şirketin BÜTÜN sayfaları aynı anda canlı → tarih uyarıları, tahsilat takvimi, zil, ANLIK DURUM, raporlar ve arama
       hepsini kapsar (müşterinin "tarih uyarısı vermiyor" şikâyeti kökten kapanır); her satırda sayfa adı görünür.
     - Bir Excel dosyasında birden çok sekme varsa: her sekme ayrı sayfa olur, aynı kaynaktan geldiği sayfa pilinde
       görünür ve birlikte senkron olur (bugünkü REHBER/AKABE gibi).
     - Kayıt ↔ cari ↔ taksit bağı sayfadan bağımsız sürer (satır hangi sayfada olursa olsun cariye bağlanır).
     - Göç: mevcut oturumların HER BİRİ 001 şirketinde ayrı sayfa(lar) olur (madde 3'teki "Oturumları Taşı" ekranına
       gerek kalmaz; hiçbir şey silinmez, Sheets bağları korunur). Mevcut serbest sayfalar "Boş Sayfa" olarak kalır,
       menüde "Veri Sayfasına Dönüştür" (madde 12).
     - Dikkat: tüm sayfalar birden yüklenince büyük veride hız (REHBER 9.176 satır + diğerleri) → arama/analiz
       sayfa bazında önbellekli; 20.000+ satırla ölçüm testi. Sayfa bazında yetki (kim hangi sayfayı görür) ilk
       sürümde yok, istenirse eklenir. Sayfa silme yalnız yönetici, Silinenler'e gider.
     Test: iki Excel'i iki sayfa olarak aktar → ikisindeki yaklaşan tarihler zil/takvimde; sayfa adı satırda; birinden
     cari bağla; eski 2 oturumlu veriden göç → 2 sayfa, sayılar ve Sheets bağı aynı; 20.000 satırda arama < 1 sn.
     Ek (kullanıcı, ekran: sol üstte "ÇALIŞMA OTURUMU · TÜM REHBER.xlsx ▾", altında "Operasyon Merkezi" Görevler/Mesajlar/
     Görev Ata/Cari): KESİN — o kutunun yerine ŞİRKET SEÇİMİ gelir (aynı yer, aynı boyut: "ŞİRKET · 001 · Unvan ▾");
     oturum (dosya/sayfa) seçimi ORTAYA, sayfa pillerine taşınır.
  14. "EXCELİM SAPITTI — PROGRAM EXCEL VERİLERİNE MÜDAHALE EDİYOR OLABİLİR Mİ?" (müşteri, 02.10.2026; kullanıcı iletti):
     sıralama için 1-2-3 yazıp sürükle-bırakınca boş atıyor; doldurma tutamacına çift tıklayınca alta kadar
     numaralandırmıyor. KODDAN DURUM: program müşterinin Excel DOSYASINA HİÇ YAZMAZ — dosya tarayıcıda okunur
     (`hof-excel-worker.js`, SheetJS, salt okuma), satırlar programın veri tabanına kopyalanır; Google Sheets de yalnız
     okunur (export). "Dışa Aktar" YENİ bir .xlsx üretir (`server/lib/xlsx-write.mjs`: sayılar sayı hücresi `<v>`,
     metinler inlineStr) — müşterinin kendi dosyasına dokunmaz. Yani Excel'deki bu davranış programdan kaynaklanamaz.
     Müşteriye söylenecek olası nedenler (Excel tarafı): (a) Dosya → Seçenekler → Gelişmiş → "Doldurma tutamacını ve
     hücre sürükleyip bırakmayı etkinleştir" kapanmış (en sık neden; çift tık + sürükleme ikisi birden ölür); (b) 1 ve 2
     yazılı hücreleri BİRLİKTE seçmeden sürüklerse Excel kopyalar/boş atar; sürüklerken Ctrl basılıysa kopyalar;
     (c) hücreler "Metin" biçimindeyse (ör. başka yerden yapıştırılmış, başında kesme işareti) seri üretmez — Veri →
     Metni Sütunlara Dönüştür ya da biçimi Genel yapıp yeniden gir; (d) çift tık yanındaki sütun boşsa durur (Excel
     kuralı); (e) Flash Fill / otomatik tamamlama ayarları ya da bozuk Excel profili — Dosya → Seçenekler → Gelişmiş'te
     "Hücre değerleri için Otomatik Tamamlama'yı etkinleştir"; olmazsa Excel Onarım (Denetim Masası → Programlar → Onar).
     Öneri (yap'ta): kılavuz "17. Bir Sorun mu Var?" bölümüne "Excel'de doldurma tutamacı çalışmıyor" maddesi (program
     dosyaya yazmaz + yukarıdaki adımlar); programın Dışa Aktar'ından inen dosyada sayıların sayı olarak geldiğinin
     testi (`test/xlsx-write` — var mı denetlenir, yoksa eklenir). Müşteriden ekran görüntüsü ve dosyanın programdan mı
     indiği (Dışa Aktar) yoksa kendi dosyası mı olduğu sorulacak.
  15. CARİ ADI YANLIŞ KOLONDAN GELİYOR (kullanıcı, 02.10.2026 19:3x; ekran: "Marka ve Patent Yönetimi" sektörü, kolonlar
     Başvuru No · Başvuru Sahibi · Telefon · Marka / Buluş Adı · Tür · Nice Sınıfı; kayıt GÜLDAL KARE / FURRA → cari adı
     "FURRA", HİMMET ERTAŞ / TENYE → "TENYE"; ilk kayıt NARAN YILDIZ ise doğru ad almış). Kullanıcı: "caride niye isim
     soy isim yerine başka yeri çekiyor?" Beklenen: cari adı kişi/firma kolonundan (Başvuru Sahibi), marka adı değil.
     KÖK NEDEN (koddan): kayıttan cari açan tek-kayıt yolu (Yeni Kayıt → "cari kartı da aç", ad eşleşmesi önerisi,
     kayıttan taksit) istemcideki `hof-plans.js` nameColumn/personOf sezgisini kullanıyordu: "ad/adı" geçen ilk kolonu
     alıyordu ("Marka / Buluş Adı"), sunucu analizinin bulduğu kişi kolonuna (`primary.person` = Başvuru Sahibi) bakmıyordu.
     Sunucu analizi (`insight/columns.mjs`: party > name, "ürün/marka/proje adı" = öğe adı, kişi değil) doğruydu.
     DÜZELTME (program geneli, kullanıcı 02.10.2026 "sadece bu sektör için olmasın"): personOf önce analizdeki kişi
     kolonunu alır; öğe adı kolonları (ürün, marka, buluş, proje, hizmet, model, dosya, araç…) hiçbir zaman ad sayılmaz,
     taraf sözcüğü (müşteri, borçlu, sahibi, başvuran…) olan kolon öncelikli; Adı + Soyadı ayrıysa birleştirilir.
     Test: `npm run test:senaryo-218` (4 tablo biçimi: marka/patent, sipariş Ürün Adı+Müşteri, Adı/Soyadı ayrı, icra Borçlu).
     EK SORU (kullanıcı, aynı gün): "birden fazla isim soy isim ya da ad da olabilir tabloda; Tablodan Çek dediğimizde bu
     hata geniş bir alana yayılır mı?" KODDAN DURUM (7 tablo biçimiyle ölçüldü): toplu yollar ayrı ayrı kural listesi
     kullanıyor — Cari "Tablodan Al"/Excel (`accounts.mjs` mapAccountHeaders), Taksit Excel (`plans.mjs` mapHeaders),
     Çek/Senet (`cheques.mjs` drawer); Taksit "Tablodan Aktar" ve detay kartı sunucu analizini (`primary.person`) kullanır.
     Marka/patent, sipariş (Müşteri + Yetkili Kişi), icra (Borçlu + Alacaklı + Avukat), emlak (Kiracı + Mal Sahibi),
     hastane (Hasta + Doktor) tablolarında dört yol da doğru kişiyi seçti; AÇIKLAR: "Adı" + "Soyadı" + "Eşinin Adı" (dernek)
     tablosunda toplu yollar ad kolonu bulamıyor (kullanıcı elle seçer, soyad birleşmez); "Öğrenci Adı" + "Öğrenci Soyadı"
     ayrı kolonlarsa analiz birleştirmiyor (yalnız "Adı"/"Soyadı" başlıklarını birleştiriyor); Çek/Senet okulda Veli'yi
     seçiyor; iki taraf kolonu eşit ağırlıktaysa (Kiracı/Mal Sahibi) seçim benzersizliğe kalıyor, kullanıcıya gösterilmiyor.
     Kullanıcı: "çözüm önerin nedir?" → "benim önerimi dinle, durdur işlemini" → ÖNERİSİ (02.10.2026, ekran: Cari
     penceresi, NARAN YILDIZ ek alanlı + TENYE/FURRA ek alansız): "Tablodan Al özelliğini kaldırmak en kolay çözüm";
     "cariyi ya Excel'den/Sheets'ten ya da elle oluştursun kullanıcı". Koddan not: ekrandaki TENYE/FURRA "Tablodan Al"dan
     değil, Yeni Kayıt → "cari kartı da aç" yolundan açılmış (ek alanı yok); NARAN YILDIZ Tablodan Al'dan ve doğru.
     Karar kullanıcıda; verilince bu maddeye yazılır. Tek-kayıt yolu düzeltmesi + kayıt başlığında Adı+Soyadı birleşik
     (recordLabel → personOf) dalda commit'li (c32f3b0), PR yok.
     Kullanıcı sorusu (aynı gün): "detay kartında Cari Kartı pili de boşa düşer mi o zaman?" KODDAN: detay kartındaki
     CARİ kutusu yalnız kayda `case_key` ile BAĞLI cariyi gösterir (`GET cases/:key/account`, ad eşleşmesi yok). Bağ
     kuran yollar: Yeni Kayıt "cari kartı da aç", Tablodan Al (caseKeys), Taksit Tablodan Aktar / kayıttan taksit
     (createFromPlan), "+ Yeni Cari" formundaki "Tablodaki Kayıt" alanı (ad yazılınca tek eşleşen satır önerilir).
     "Excel / Sheets'ten Yükle" kayda BAĞLAMAZ (caseKeys yok) → o carilerde pil çıkmaz, kayıttaki "+ Tahsilat" cari
     defterine değil eski kayıt tahsilatına düşer. Bu, Tablodan Al'ın var oluş nedeni.
     Kullanıcının hatayı bulduğu yol (aynı gün, kendi sözleriyle): "Tablodan Al'ı bir kere tıklayınca senkronize oluyor;
     tablodan Yeni Kayıt tıklayıp doldurunca otomatik cariye çekti, çekerken cari ismini saçmaladı." = Yeni Kayıt →
     "cari kartı da aç" yolu (varsayılan işaretli); koddaki kök nedenle birebir, düzeltme c32f3b0 (senaryo-218 ilk tablo
     tam bu akış: marka/patent tablosu → Yeni Kayıt → cari GÜLDAL KARE, FURRA açılmaz).
     Kullanıcı (aynı gün): "Tablodan Al butonu doğru çalışıyor, tamam; program tablodan çekerken cariyi yanlış çektiği
     için bu yolu kapatmak amacıyla kaldırmayı düşünmüştüm." → Kaldırma fikri OTOMATİK çekme yoluna (Yeni Kayıt → cari
     kartı da aç) yönelikti; o yol düzeltildi.
     NİHAİ KARAR (kullanıcı, 02.10.2026, itirazım dinlendikten sonra yinelendi — "çok özellik çok hata doğuruyor"):
     (a) cariyi tablodan alma yolu KAPANIR: Yeni Kayıt formundaki "cari kartı da aç" kutusu ve kayıttan cari açan uç
     kalkar; (b) "Tablodan Al" düğmeleri kalkar (Cari penceresi + Raporlar'daki "Tablodaki kişileri cari yap");
     (c) detay kartındaki CARİ kutusu / "Cari Kartı" pili kalkar. Cari yalnız "+ Yeni Cari" ve "Excel / Sheets'ten Yükle"
     ile açılır. Şikâyet 3'teki "kayıt → cari" otomatik zinciri bu kararla KALKTI; taksit zinciri (kayıttan taksit,
     Taksit → Tablodan Aktar) dokunulmadı. Kullanıcı (aynı gün): "başka düzeltme eklemeyeceğim, bunu yapalım, zipi ver".
     YAPILDI (2.0.18, dal `claude/nice-euler-jvajxv`): (a) `hof-table.js` Yeni Kayıt formundan "cari kartı da aç" kutusu,
     çift kayıt sorusu ve POST cases/:key/account çağrısı kalktı (kayıt yalnız kayıt); sunucuda POST ucu kaldırıldı (yol
     405 döner; GET kaldı — kayıttaki + Tahsilat'ın cari defterine yönlendirmesi için); (b) `hof-accounts.js` Tablodan Al
     düğmesi + importFromTable + fromTable dışa aktarımı, `hof-overview.js` "Tablodaki Kişileri Cari Yap", import ucunda
     caseKeys/caseTitles (yok sayılır, `linked` sayacı yok); (c) `hof-workspace.js` detay kartındaki CARİ kutusu
     (caseAccountHtml, data-open-account) ve CSS'leri. Kalanlar: cari formundaki "Tablodaki Kayıt" alanı + ad eşleşmesi
     önerisi (düzeltilmiş personOf ile), kayıttan taksit, Taksit → Tablodan Aktar. Testler: senaryo-218 yeniden yazıldı
     (kutu yok, cari açılmaz, pil yok, düğme yok, + Yeni Cari'de kayıt önerisi); is-akisi/plan-case-link/plan-transfer/
     accounts-stock/senaryo-214/senaryo-raporlar/e2e run güncellendi. Kılavuz: "Kayıt ve cari ayrıdır", Tablodan Al
     çıkarıldı, k16 ekranı yenilendi, PDF yeniden üretildi. Kanıt: `docs/2.0.18-KANIT.md`; CHANGELOG → 2.0.18.
  KURAL (bu maddeden): kullanıcının her isteği, ne kadar küçük olsa da, AYNI ANDA bu listeye yazılır ve commit edilir;
  "dün konuştuk" denen bir istek listede yoksa kullanıcıya açıkça söylenir.
- 2.0.18 TESLİM (02.10.2026; dal `claude/nice-euler-jvajxv`; madde 15 — cari adı kişi kolonundan + kayıt/cari ayrımı;
  şema göçü YOK, 19 aynı; teslim `dist/teslim-2.0.18/` 3 zip + SHA256SUMS; imzalı paket kullanıcının yüklediği .pem ile;
  kurulum .exe Wine + Inno Setup). Sırada: kullanıcı yükler/"birleştir" → PR → CI → birleştir → yayın (tag v2.0.18, 5 dosya)
  → "yayımladım" → bayt bayt + güncelleyici "available" denetimi → site kılavuz PR'ı.
  TESLİM EDİLDİ (02.10.2026 20:3x): PR ceougur/ofis---y-netimi#18 açık (birleştirme kullanıcı onayıyla; kullanıcı: "zipi ver,
  yükleyelim sonra"). Güncelleme paketi sha256 4c4c07c6…, kurulum .exe sha256 a864b1a7… (29,3 MB); 3 zip + SHA256SUMS
  gönderildi (2-Kurulum zip'inde yalnız GitHub-v2.0.18/ exe + sha256; sürümlü .exe teslim klasöründe, zip'e boyut için konmadı).
- 2.0.19 (03.10.2026; dal `claude/kind-newton-fpmx3f`; 2.0.18 yayımlı = `v2.0.18`): KULLANICI BİLDİRİMİ "cariyi toplu Excel'den /
  Sheets'ten al deyince çekmiyor". Kök neden: 2.0.18'de Tablodan Al kalkarken `hof-accounts.js` mappingForm içinde tanımsız
  `caseKeys` kaldı → Kolonları Eşle penceresi açılmadan ReferenceError (Excel ve Sheets). Düzeltildi; Stok/Taksit/Çek
  yüklemeleri etkilenmemişti. İstemci + sunucu kodu no-undef ile tarandı: başka yok. Kalıcı test `npm run test:senaryo-219`
  (30 denetim, CI e2e işine eklendi). DERS: kod kaldırırken o koda dokunan her arayüz yolu (toplu yükleme dahil) arayüzden
  koşulur; 1.000 carilik WhatsApp senaryosu bu yolu kapsıyordu ama 2.0.18'de koşulmadı.
  Gözlem: aynı Excel ikinci kez "Atla" ile yüklenince TELEFONSUZ ve Cari No'suz satır yeniden cari açar (kural: "emin
  olunamayan satır yeni cari açar"; aynı adlı iki gerçek kişi ayrılsın diye). KARAR (kullanıcı, 03.10.2026: "önerini yap"
  → önerim: kural BÖYLE KALIR; "yalnız ad aynıysa sor" yapılmadı). senaryo-219 adım 2 bu kuralı denetler.
  Kullanıcı (03.10.2026, "müşteri bekliyor"): işlem bitince zip ver, BİRLEŞTİRMEYİ YAP, GitHub'a yükleme linkini ver.
  YAYIMLANDI (03.10.2026 10:13; PR ceougur/ofis---y-netimi#19 CI 12/12 yeşil → birleştirildi, `v2.0.19` = fb032cf; dal
  `master` üzerine sıfırlandı). İmza anahtarı kullanıcının yüklediği .pem (destekofis-2026-1 ile birebir, imzala/doğrula
  sınandı). Güncelleme paketi sha256 349ebb89…, kurulum .exe sha256 029c2acf… (29,32 MB, simgeli). Yayındaki 5 dosya +
  latest/ (exe, json, zip, pdf) bayt bayt aynı; gerçek güncelleyici canlı GitHub'da 2.0.18/17/16/15/2.0.4/1.7.0 olarak
  (Node 24.21, bootstrap 2; GitHub API ve API kapalıyken yedek yol) 2.0.19'u "available" gördü, indirme sha256 eşleşti;
  2.0.19 kurulu → "up-to-date"; kurcalanmış bildirge reddedildi. Kılavuz değişmedi: site `web/indir/` PDF'i yayınla
  bayt bayt aynı (60bcf7ad…) → site PR'ı gerekmedi. 2.0.19 KAPANDI.
- 2.0.20 YAPILACAKLAR (kullanıcı "yapılacaklara not al" dedi, 03.10.2026; "yap" denince başlanır; ayrıntı ve
  kanıt hemen altındaki ADAYI maddesinde):
  [ ] 1. Bütün raporların (43) tablosunun altında kalın TOPLAM satırı — ekran, PDF, Excel aynı; yalnız toplanabilir
         kolonlar (tutar, matrah, KDV, borç, alacak, miktar); birim fiyat, yürüyen bakiye, oran, tarih boş.
  [ ] 2. Cari Listesi ve Bakiyeler özetine "Toplam Borç (Anlaşılan)", "Toplam Tahsilat (Ödenen)", "Kalan".
  [ ] 3. Dönemli raporlar ilk açılışta "Bu Yıl"; sonra kullanıcının son seçtiği dönem hatırlanır.
  [ ] 4. Dönemde kayıt yoksa ipucu: "Bu dönemde kayıt yok — Tüm Zamanlar'ı deneyin".
  [ ] 5. Test: 43 raporda TOPLAM satırı = satırların toplamı (ekran/PDF/Excel); boş dönem; tek kayıt; 10 cari × 10.000,
         ilk taksitler ödenmiş → 100.000 / 10.000 / 90.000 (Taksit Kartları, Cari Mizanı, Cari Listesi); arayüzden senaryo.
  [ ] 6. Kılavuza kısa hap bilgi: "Ciro ve toplam alacak hangi raporda".
  [ ] 7. Sol üstteki ŞİRKET kutusunda şirket sayısını gösteren yeşil rozet ("001 · Şirket 1  (2)") KALKAR — kullanıcı
         (03.10.2026, ekran): "kafa karıştırıyor, o sayı yazmasın". Kod: `client/assets/hof-companies.js:132`
         (`hof-session-count`); açılır listede şirketler zaten görünür. Test: 1 ve 2 şirketle rozet yok.
  [ ] 8. "CARİ BAZINDA TAHSİLAT RAPORU ÇALIŞMIYOR" (kullanıcı, 03.10.2026 — açık sorunun cevabı). Arayüzden yeniden
         üretildi: Taksit Excel'i "Ödenen" kolonuyla (10 kişi × 10.000, her biri 1.000 ödenmiş) yüklenince ödenen tutar
         AÇILIŞ (devir, `plan_entries.opening = 1`, Kasa dışı) yazılır; rapor (`report-center.mjs` cari-tahsilat)
         açılışı bilinçli SAYMIYOR → "Bu Ay" da "Tüm Zamanlar" da "Cari 0 · Toplam 0 · Bu süzgeçte kayıt yok" (Taksit
         Kartları aynı veride Ödenen 10.000 gösteriyor). Programa girilen tahsilatların hepsi doğru sayılıyor (API ile
         9 tür denendi: cari nakit/havale/POS, fatura peşin nakit/POS/havale, taksit, cariden çek, faturayla çek → 4.500).
         Öneri: rapora "Önceden Ödenen (Açılış)" kolonu + özet kutusu (dönem tahsilatı "Toplam"ından AYRI; açılış
         tarihi = yükleme günü); açılışı olan cari de listede görünür; rapor boşsa ve açılış varsa altta açıklama
         ("Excel'den yüklenen n TL ödenmiş tutar açılış olarak yazıldı; Taksit Kartları → Ödenen"). Test: bu senaryo
         arayüzden (Bu Ay / Tüm Zamanlar), açılış + gerçek tahsilat karışık, geçen ayın tahsilatı Bu Ay'da yok.
         KARAR (kullanıcı, 03.10.2026: "taksitleri Excel ile toplu yüklemiştik"; "tamam ama hepsini toplasın raporlar da"):
         tahsilat raporlarında TOPLAM açılış (Excel'de ödenmiş) DAHİL her şeyi toplar — Cari Bazında Tahsilat (Toplam =
         nakit/havale + taksit + çek/senet + Önceden Ödenen), Taksit Tahsilatları (bugün açılış ayrı satır, "Tahsilat"
         toplamı dışında → "Toplam Tahsil Edilen" açılış dahil), Taksit Tahsilat Performansı, Cari Listesi "Toplam Tahsilat
         (Ödenen)". Kırılım kolonları kalır (kaynağı görünsün). KASA raporları DEĞİŞMEZ (açılış Kasa'ya hiç girmedi; Kasa
         fiziki nakit, mutabakat bozulmasın) — kullanıcıya söylendi.
  [ ] 9. YEDEK VE ÇOKLU ŞİRKET (kullanıcı, 03.10.2026: "001 dolu ama yedek klasöründe 002 dolu yedeklemiş"). Ölçüldü
         (API, 001'de 5 cari, 002'de 2 cari): veri KARIŞMIYOR — 002 seçiliyken Yedek Al → `backups/sirket-002/…-manuel.sqlite`
         (yalnız 002), 001 seçiliyken → `backups/…-manuel.sqlite` (yalnız 001). AÇIKLAR: (a) `/api/admin/backups` HUB_ONLY
         değil → Yedek Al ve Yedekler listesi yalnız SEÇİLİ şirket (`app.mjs` dispatch); (b) dosya adında şirket kodu yok
         (001 ve 002 aynı adla, ayrım yalnız klasörde; Drive'da ayırt edilemez); (c) otomatik zamanlayıcı 001'de hep,
         öbür şirketlerde yalnız o şirket bu açılışta açıldıysa (`appFor` tembel) → girilmeyen şirket yedeklenmez;
         (d) supervisor `restoreDatabase` yalnız kök `backupDir` + kök db — şirket yedeği geri yüklemesi denetlenecek.
         Öneri: Yedek Al → "Tüm Şirketler" (varsayılan) / "Yalnız <kod · ad>"; ad `destekofis-<kod>-<zaman>-<etiket>`;
         Yedekler listesi bütün şirketler + Şirket kolonu; otomatik yedek ve Drive kopyası bütün şirketler (açılmamış olsa
         da); yedeğin içine şirket kimliği yazılır, geri yüklemede yanlış şirkete yükleme reddedilir. Test: iki şirket
         farklı veri; tümü/tek; otomatik; geri yükleme; yanlış şirkete yükleme 409. Kullanıcıya soruldu: yedek alınırken
         002 mi seçiliydi / baktığı klasör sirket-002 mi (ekran bekleniyor).
  Açık soru CEVAPLANDI: "getirmiyor" = Cari Bazında Tahsilat (madde 8).
- 2.0.20 ADAYI — RAPORLARDA ALT TOPLAM (kullanıcı, 03.10.2026): "toplam cari alacağı yani ciroyu hangi rapordan
  görürüm?" → yanıt: ciro = Raporlar → Fatura → Satış Faturaları / Cari Bazında Satış ve Alış (Net Satış); toplam
  alacak = Raporlar → Cari → Cari Listesi ve Bakiyeler (Borçlular) / Cari Mizanı. Kullanıcı: "raporları getirmiyor ya da
  alt toplamları getirmiyor gibi, anlamadım". ARAYÜZDEN DENENDİ (3 cari, 3 satış faturası 12.000 + 6.000 (2.000 peşin)
  + 3.300): sayılar DOĞRU (Matrah 18.000, Ödenecek 21.300, Kalan/Borçlular 19.300). Açıklar: (a) toplam yalnız tablonun
  ÜSTÜNDE kart olarak; tablonun altında TOPLAM satırı YOK (ekran, PDF; Excel'de toplam yalnız ayrı "Özet" sayfasında) —
  yaygın programlarda kolon altında toplam satırı olur; (b) dönemli raporlar "Bu Ay" ile açılır — ayın başında (bugün
  3'ü) eski faturalar görünmez, "getirmiyor" sanılır. Öneri (kullanıcı "yap" derse): her rapor tablosunun altında
  kalın TOPLAM satırı (ekran + PDF + Excel aynı satır, Excel'de SUM formülü değil değer), yalnız toplanabilir kolonlarda
  (tutar, matrah, KDV, borç, alacak, miktar); yürüyen bakiye, birim fiyat, oran, tarih kolonları boş; rapor bazında
  kolon listesi tanımlanır; Ciro/fatura/cari raporlarında varsayılan dönem kullanıcının son seçtiği dönem (ilk açılışta
  "Bu Yıl"); boş sonuçta "Bu dönemde kayıt yok — Tüm Zamanlar'ı deneyin" ipucu. Test: 43 raporun her birinde TOPLAM satırı
  = satır toplamı (ekran/PDF/Excel), boş dönem, tek kayıt. Kullanıcıdan: hangi raporda "getirmiyor" gördüğü (ekran).
  EK İSTEK (kullanıcı, aynı gün): "10 müşteride toplam 100 bin alacak, ilk taksitler ödenmiş; raporda 100 bin toplam
  (ilk anlaşılan), ödenen 10 bin, kalan 90 bin görmek istiyorum." API ile kuruldu (10 cari × 10.000, 10 taksit, her
  birinden 1.000 tahsilat): Taksit Kartları raporu ZATEN Toplam 100.000 · Ödenen 10.000 · Kalan 90.000 (satırda da);
  Cari Mizanı (Tüm Zamanlar) Dönem Borç 100.000 · Dönem Alacak 10.000 · Borçlular 90.000. AÇIK: Cari Listesi ve
  Bakiyeler özetinde yalnız Borçlular/Alacaklılar var, toplam Borç (anlaşılan) ve toplam Alacak (ödenen) yok. Öneri:
  Cari Listesi özetine "Toplam Borç (Anlaşılan)", "Toplam Tahsilat (Ödenen)", "Kalan" eklenir + alt TOPLAM satırı.
- 2.0.17 HAZIR (02.10.2026; dal `claude/nice-euler-jvajxv`; 14 madde yapıldı, kanıt `docs/2.0.17-KANIT.md`): şema göçü 19
  (fatura bağı + mahsup); çoklu şirket hub/çocuk mimarisi (`docs/MIMARI.md` → 2.0.17); teslim `dist/teslim-2.0.17/`
  (3 zip + SHA256SUMS; imza anahtarı kullanıcının yüklediği .pem). Sırada: kullanıcı "birleştir" → CI → birleştir →
  yayın (tag v2.0.17, 5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" denetimi → site kılavuz PR'ı.
- 2.0.17 TESLİMLE BİRLİKTE İSTENEN 3 ŞEY (kullanıcı, 02.10.2026; "müşterilerimize mahçup etme"): (1) 14 maddenin başlık
  başlık alt alta kontrol listesi, karşısında yapıldı tiki; (2) uzman mali müşavir gözüyle GERÇEK şirket işlemleri —
  programın bütün özellikleriyle, gerçek ortamda, etkilediği her yere doğru mantık ve tutarla geçtiğinin testi;
  (3) uzman UI + UX gözüyle bütün kartlar/piller tasarım uygunluğu ve kodun uçtan uca doğru çalıştığı; baş mimar/baş
  mühendis şapkasıyla GERÇEK STRES TESTİ. EK (kullanıcı, aynı gün): mali müşavir FATURA modülünü de HER VARYASYONLA
  kullanır — 8 senaryo (stoktan satış, hizmet satışı, fiyat farkı, SMM, satıştan iade, stoğa mal alışı, hizmet/gider
  alışı, alıştan iade), KDV %1/%10/%20, KDV dahil/hariç, iskonto, tevkifat/stopaj, ödeme biçimleri (nakit, havale, POS,
  alınan/verilen çek-senet, ciro, taksit, açık, karma), taslak → kaydet, düzenle, iptal, sil, kopyala, toplu, Mahsup Et,
  Kapatılacak Fatura, PDF/Excel/UBL; (kullanıcı, 3. mesaj) çeşitli ödemelerle alım, satım, iade, iptal ve her birinin
  RAPORLARA etkisi (Kasa, banka/POS, cari ekstre/mizan, stok, taksit, çek/senet, KDV özeti, hesap mizanı, ANLIK DURUM,
  açık faturalar, birleşik şirket raporu) beklenen tutarla karşılaştırılır. Çıktılar: `docs/2.0.17-KONTROL-LISTESI.md`, `docs/2.0.17-MALI-MUSAVIR-TESTI.md`
  (senaryo + beklenen/gerçek sayılar), `docs/2.0.17-UI-UX-DENETIMI.md` (ekran görüntüleri + bulgular + düzeltmeler).
  DURUM (02.10.2026): üçü de yapıldı. Mali müşavir 160/160; UI/UX 316/316 (46 ekran). Denetimde bulunup düzeltilen gerçek
  hatalar: sayfa şeridi ↔ takvim şeridi sonsuz yer kavgası (`hof-sessions.js` place sırası), stres testinde iade iptalinde
  taksit kartı geri büyümüyor (`plans.mjs` growForInvoice satır yoksa açar), kontrast/tıklama hedefi/pasif düğme nedeni/yazım.
  Stres: `test:mutabakat --islem 5000 --tohum 3 --tohumlar 2 --her 1` (sonuç CHANGELOG "Doğrulama"). Kod değiştiği için
  güncelleme paketi ve kurulum .exe YENİDEN üretilir (release.mjs + build:windows), zipler yeniden kapatılır.
  TESLİM EDİLDİ (02.10.2026 18:13): PR ceougur/ofis---y-netimi#17 açık (birleştirme kullanıcı onayıyla); zipler + .exe
  kullanıcıya gönderildi (Kaynak-ve-Denetim 38 MB sınırı aştı → A-kaynak / B-denetim iki parça). Kurulum .exe sha256
  c406cf19…; güncelleme paketi sha256 4702dfee…. Sırada: "birleştir" → CI → birleştir → yayın → "yayımladım" → bayt bayt +
  güncelleyici denetimi → site kılavuz PR'ı.
  YAYIMLANDI (02.10.2026 18:5x; `v2.0.17` = 6b0a811): 5 dosya ve latest/ adresleri (Kurulum.exe, guncelleme.json) bayt
  bayt doğrulandı; gerçek güncelleyici 2.0.16/15/14/2.0.4/1.7.0 olarak (Node 24.21, bootstrap 2) canlı yayında 2.0.17'yi
  "available" gördü (anahtar destekofis-2026-1), indirilen paket sha256 teslimdekiyle eşleşti. Site kılavuz PR'ı
  ceougur/destekofis#5 BİRLEŞTİRİLDİ (main 00dff72; eskimiş #4 kapatıldı). Site metni: kullanıcı yalnız manşet alt cümlesi
  + SSS'ye 2 soru istedi (özellik kartları/yenilik şeridi İSTEMEDİ), PR #6 birleşti (main 4b611ed). "Farklı konular karışmaz"
  kartı hâlâ "oturum" anlatıyor (kullanıcıya söylendi, dokunulmadı). 2.0.17 KAPANDI.
- e-Belge kararı (kullanıcı, 01.10.2026): vergi dairesi/entegratör bağlantısı KAPALI — "sana entegre et diyene kadar".
  Fatura modülü tam çalışır; belge "Müşteri Fişi" (resmî hükmü yok) basılır; e-Fatura/e-Arşiv/XML ekranda görünmez.
  Entegratör altyapısı (müşteri kendi API bilgisini girer, kontörü kendisi alır) hazır tutulur ama `config.edocEnabled`
  false; yalnız testler açar. Açma: kullanıcı açıkça "entegre et" derse.
- Gönderim kararı (kullanıcı, 02.10.2026): kesimde "Kes ve Gönder" ya da "Kes, Sonra Gönder". Sonra gönderde bütün
  etkiler hemen işlenir; belge "Gönderilecekler" sekmesinde bekler, e-Belge numarası gönderim anında verilir. Oradan
  "Listeden Sil" etkileri GERİ ALMAZ (kullanıcı: "tüm etkilerle birlikte geri alınmaz!"); belge Müşteri Fişi olarak kalır.
- Entegratör kararı (kullanıcı, 01.10.2026): şimdilik YALNIZ EDM Bilişim (`server/lib/einvoice/edm.mjs`; WSDL'i
  sunucudan okur, Logout çağırmaz). Firmayla anlaşılamazsa anlaşılan entegratöre göre yapılır (İzibiz istemcisi git
  geçmişinde: 167eefa). Fatura modülü bitince: (1) yalnız proje sahibine özel, deneyimsiz birinin anlayacağı ayrıntılı
  kılavuz (entegrasyona kadar); (2) ana testten ÖNCE güncel resmî/resmî olmayan kaynak araştırması → karşılaştırma →
  düzeltme (`docs/FATURA-KARSILASTIRMA.md`), sonra testler.
- Pro — uzaktan görüntüleme: `docs/PRO-UZAKTAN-GORUNTULEME.md` (önce en alttaki "Oturum devri"); genel durum
  `docs/DURUM-VE-DEVAM.md`.
