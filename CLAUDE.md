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
- Kurulum: `npm run build:windows` (bu ortamda Wine + Inno Setup çalışır).
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
- 2.0.17 müşteri istekleri (02.10.2026'dan; kullanıcı tek tek yazar, "yap" deyince HEPSİ TOPLU yapılır; o ana kadar
  yalnız buraya yazılır; kök neden koddan, uzman UI/UX + baş mimar/mühendis gözüyle; her madde test + kanıt):
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
