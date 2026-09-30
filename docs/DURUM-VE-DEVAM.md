# DestekOfis — durum ve devam notu

Yeni bir oturum bu belgeyi okuyarak kaldığı yerden devam eder. Son güncelleme: 29.09.2026 (2.0.9 sağlama paketi: tek Raporlar penceresi, birleşik Vade takip, modül raporları, taslak Excel, destek hattı 0536 — kullanıcı doğrulaması bekliyor; 2.0.8 yayımlı; önceki not: sürüm 2.0.2 denetimden geçti — `docs/DENETIM-2.0.2.md`; okuma motoru, analiz iş parçacığı, kanıtlı kolon kararları, kendi kendini onarma, şemaya esnek kolon eşleme, Veri Sağlık Kontrolü ve olay tabanlı uyarılar eklendi — `docs/MIMARI.md` → *2.0.2 eklemeleri*; yayın kullanıcı onayı bekliyor; 2.0.1 yayımlı).

## Nerede ne var

| Parça | Yer |
| --- | --- |
| Program (sunucu + arayüz + kurulum) | `ceougur/ofis---y-netimi`, dal `master` |
| Tanıtım sitesi, lisans API'si, operatör merkezi | `ceougur/destekofis` (`web/`), Vercel projesi `destek-ofis`, adres `https://destek-ofis.vercel.app` |
| Lisans veritabanı | Supabase projesi `lvzaeekyovhquljzesye` (eu-central-1), özel `lisans` şeması; şema `destekofis/supabase/lisans.sql` |
| Lisans servisi adresi (programda sabit) | `https://destek-ofis.vercel.app/api/lisans` (`server/lib/license.mjs`, `DEFAULT_LICENSE_SERVICES`) |
| Lisans ayrıntıları | `docs/LISANS.md` |
| Sürüm yayımlama | `docs/SURUM-YAYIMLAMA.md` |
| 2.0.2 denetim raporu (istek doğrulama, zor veri, kod taraması) | `docs/DENETIM-2.0.2.md` |
| İleriye dönük yol haritası (yaygın programlardan öğrenilenler, UI/UX bulguları, P1–P3 mimari adımlar) | `docs/YOL-HARITASI-2.1.md` |
| Operatör merkezi ve API işletimi, sır yenileme | `destekofis/README.md` |

## Tamamlananlar

- Faz 0–2 ve 1.4–1.7 ara sürümleri (bkz. `CHANGELOG.md`).
- **Faz 3 — lisans motoru (2.0.0):**
  - Tek kurulum dosyası; kurulumdan sonra 30 günlük deneme kendiliğinden başlar.
  - Denemenin 3. gününde firma bilgisi sorulur.
  - Süre dolunca veya lisans engellenince program salt okunur olur.
  - Lisanslar imzalıdır (Ed25519). İnternet 7 gün kesik kalabilir; saat geri alma koruması var.
  - İnternetsiz `DOLIS1.` kodu var.
  - 2.0 öncesi kurulumlara 30 günlük geçiş dönemi tanınır.
- **Faz 4 çekirdeği (canlı):**
  - Vercel lisans API'si (`/api/lisans/v1/activate|check|durum`).
  - Supabase şeması ve RPC'ler.
  - Operatör merkezi `/admin` (Özet, Kullananlar, Lisanslar, Hareketler, Ayarlar).
  - Site yalnızca demoyu anlatır; demo ve kullanım kılavuzu indirme, KVKK sayfası, iletişim bilgileri var.
- v2.0.0 GitHub'da yayımlı ("Latest"). Sitedeki demo düğmesi `releases/latest/download/DestekOfis-Kurulum.exe` adresine gider. Kullanıcı imzalı güncelleme paketini (`destekofis-guncelleme.json` + zip, anahtar `destekofis-2026-1`) v2.0.0 yayınına ekledi; imza ve içerik doğrulandı. 1.6/1.7 kurulumlar artık 2.0.0'a kendiliğinden güncellenir.
- **2.0.1 (hazır, dal `claude/nice-euler-jvajxv`):**
  - Veri oturumları: farklı konudaki Excel/Sheet yeni oturumda açılır; kişiye özel oturum seçici; ad değiştirme, silme. Kullanıcılar, görevler, notlar, tahsilatlar ve Kasa oturumdan bağımsızdır (`docs/MIMARI.md` → *Veri oturumları*).
  - Excel/Sheets formülleri programda çalışır (`server/lib/formula/`).
  - Tahsilat düzeltme/silme, Kasa (göç 5), işlem geçmişi eskiden yeniye, Türkçe tutar okuma.
  - Operasyon Merkezi adları kalemle değişir.
  - Serbest sayfalar: sekme şeridinde "+ Sayfa", Excel benzeri ızgara, Türkçe formüller, Σ toplamlar, doldurma, yapıştırma, geri alma; satırlar kayıt olarak detay kartında çalışır (`docs/MIMARI.md` → *Serbest sayfalar*).
  - Tahsilat takvimi: her Excel/Sheets'te ödeme sözü, taksit, ay yazımı, aylık ücret kolonu ve kira günü okunur; kayan piller, pilden tahsilat, ödendi say; sağ alt bildirimler (10 sn, sırayla, 3 saatte bir yinelenir) ve zil listesi; son günler ve belge bitişleri 1 hafta önceden; okul servisi sektörü (143 sektör) (`docs/MIMARI.md` → *Tahsilat takvimi*).
  - Kasa: tarih aralığı ve kasa dökümü PDF'i (bağımlılıksız PDF yazıcı, gömülü Liberation Sans).
  - Kayda belge ekleme, Excel'e aktarma, kolon başlıklarını adlandırma, akıllı denetim (`docs/MIMARI.md` → *Belgeler*, *Akıllı denetim*).
  - Notlar ve belgeler kayıt kimliğine bağlıdır; aynı kimliği taşıyan kayıt farklı oturumlarda aynı notları ve belgeleri görür.
  - Kurulum düzeltmesi: sunucunun üstüne yeniden kurulumda servis yeniden kurulur ve başlar (`setup.iss`, `ExistingServerInstall`).
  - `release.yml`: web arayüzünden açılan yayına da imzalı paket, `DestekOfis-Kurulum.exe` ve kılavuz eklenir (`DESTEKOFIS_RELEASE_KEY` sırrı gerekli).
  - Sitede indirme kartı ve 2.0.1 yenilikleri: serbest sayfalar, Kasa, formüller, akıllı denetim, belgeler, Excel'e aktarma, oturumlar; kılavuz 2.0.1 (`destekofis` deposu, yerel commit `a4f6bab`; gönderilmedi).
  - Doğrulama (27.09.2026, tahsilat takvimi ve Kasa PDF eklendikten sonra yeniden): birim 333/333 ve uçtan uca 42/42 (Node 22.22 ve kurulumdaki Node 24.21), 2.0.0 → 2.0.1 ve 1.7.0 → 2.0.1 gerçek imzalı paketle güncelleme provası (yedek, şema 4 → 5, veriler korunur, yeni özellikler çalışır).
  - Teslim paketi kullanıcıya verildi: imzalı güncelleme paketi + `.json`, `DestekOfis-Kurulum.exe`, kılavuz, kaynak kodu (git bundle), örnek veriler. Yayın kullanıcı onayı bekliyor.

- **2.0.1 yayımlandı** (kullanıcı PR'ı `master`'a birleştirdi, `v2.0.1` yayını dört dosyayla açıldı; özetler doğrulandı).
- **2.0.2 yayımlandı** (PR ceougur/ofis---y-netimi#2 birleşti, `v2.0.2` yayını beş dosyayla; dosyalar indirilip yereldeki derlemeyle bayt bayt doğrulandı).
- **2.0.3 yayımlandı** (PR ceougur/ofis---y-netimi#3, `v2.0.3`).
- **2.0.4 yayımlandı** (PR ceougur/ofis---y-netimi#4, `v2.0.4`; dosyalar bayt bayt doğrulandı).
- **2.0.5 (yayında):** geniş taksit kartı, kart ve liste PDF/Yazdır, süzgeçler; Excel Sıra No (göç 8) ve esnek başlık eşleme; acil görev kırmızı uyarı. Ayrıntı `CHANGELOG.md`.
- **2.0.9 (sağlama paketi hazır, dal `claude/nice-euler-jvajxv`; kullanıcı doğrulayınca birleştirme ve yayın):** müşteri isteği "soldaki Raporlar cariye bağlı değil, boş geliyor" → sol menü *Raporlar* = *Rapor Al*, tek pencere (Cari ekstre, Vade takip, Nakit akış, Çek / Senet, Tüm raporlar, Tablo raporları); birleşik Vade takip (taksit + çek/senet + ileri tarihli Kasa + tablo takvimi, telefonla arama); Nakit akışta tablo kaynağı ve dönem toplamları; rapor merkezine beş modül raporu (28 rapor); açılış ekranında sektöre uygun taslak Excel (143 sektör); Excel okumada eski "kullanılan alan" etiketi düzeltmesi; destek hattı 0536 771 50 55 (program; site ceougur/destekofis#2 ile birleşti). Doğrulama: birim 630, senaryo-rapor 82, senaryo-taslak 30, e2e, 2.0.8 senaryosu 44. Ayrıntı `CHANGELOG.md`, `docs/MIMARI.md` → *2.0.9 eklemeleri*.
- **2.0.8 yayımlandı** (PR ceougur/ofis---y-netimi#8, `v2.0.8`; beş dosya bayt bayt doğrulandı; operatör merkezi PR ceougur/destekofis#1 birleşti): tablodaki ödeme planını Taksitler'e aktarma (`server/lib/insight/schedules.mjs`, `server/routes/plan-transfer.mjs`, `client/assets/hof-plan-transfer.js`; göç 14: `plan_entries.opening`, `plans.import_id`, `plan_imports`), açılış (devir) kaydı (Kasa dışı, makbuzsuz), takvimde çift kalem düzeltmesi (`plans.linkedCases`), Taksitler Excel yüklemesi gerçek vadelerle, stokta birim listesi ve ilk alım ("Kasa'ya yansıt" kutusu; boş kritik seviye/miktar = 0), lisans kalıcı testleri ve kimlik kaynağı. Doğrulama: birim 616, uçtan uca 49 adım, gerçek kullanıcı senaryosu 44 denetim (`npm run test:senaryo`), kılavuz `k14-tablodan-aktar.jpg` ile yenilendi. **Operatör merkezi (`destekofis`, dal `claude/nice-euler-jvajxv`, kullanıcı birleştirince Vercel yayımlar):** lisans verirken girilen müşteri bilgisi kurulum kaydına da yazılır, programdan gelen bilgi lisansın boş alanlarını doldurur (`fill_installation`, `sync_license_from_installation`; canlı Supabase'e uygulandı, mevcut kayıtlar dolduruldu); pencere dışına tıklama kapatmaz, uzun kart kartın içinde kaydırılır; **Altyapı limitleri** (Özet: Vercel fonksiyon çağrısı/veri aktarımı, Supabase veritabanı boyutu/egress; sayım `lisans.usage_daily`'de isteğin kendi işleminde, dış servise ek istek yok; %70 sarı, %90 kırmızı, üst çubukta rozet, `infra.warning` hareketi; Ayarlar › Altyapı kotaları). Ayrıntı `CHANGELOG.md` ve `destekofis/README.md`.
- **2.0.7 (sağlama paketi hazır; kullanıcı doğrulayınca birleştirme ve yayın):** ANLIK DURUM kartı (`routes/overview.mjs`, `hof-overview.js`; canlı `overview.changed`), Rapor Al (mizan/ekstre/nakit akışı `lib/finance-report.mjs`), rapor merkezi (`routes/report-center.mjs`, 23 rapor, `hof-report-center.js`), Çek/Senet (göç 13; `lib/cheques.mjs`, `routes/cheques.mjs`, `hof-cheques.js`; olay tabanlı, geri alınabilir), kişiye özel yetki (`users.grants_json`, `GRANTABLE`), stokta hizmet kalemi, kayıt ↔ cari ↔ taksit bütünlüğü (`POST /cases/:key/account`, ad eşleşmesi önerileri, `hasRecord` records tablosunu da sayar), güncelleyici düzeltmesi (kurulu sürüm dinamik, `stage` korumaları), Kasa toplamları SQL'de, iş akışı testleri (`test/is-akisi.test.mjs`). Sahada 2.0.6 güncelleme hatası: kullanıcıya "kurulum dosyasını üstüne çalıştır" denildi. Ayrıntı `CHANGELOG.md`.
- **2.0.6 yayımlandı** (PR ceougur/ofis---y-netimi#6, `v2.0.6`; beş dosya bayt bayt doğrulandı): Cari ve Stok modülleri (göç 12; taksit kartları cariye bağlı, Excel'den/tablodan toplu cari, toplu taksitlendirme, stok → Kasa/cari); taksit kartı tablodaki kayda bağlı (göç 11 `plans.case_key/case_source/case_title`; kişinin kartında TAKSİT PLANI bölümü, Tahsilat → taksit seçici, tek Kasa kaydı, işlem geçmişinde `plan-entry`); büyük tabloda arama hızı (paket yalnız açık sayfayı çizer, `HOF.tableWindow`); tabloda sütun ekle/sil (`dataset.columns.layout`, Silinenler türü `column`); A5 makbuz (firma adı, program adı yok); taksit kartında kayıt tarihi (göç 9); listede ve PDF'te bilgi notu; kolon adına yazılan tarihin düzeltilmesi ve önlenmesi (göç 10); seyrek belge kolonlarından uyarı; Google Sheets'ten toplu cari/stok, dört aşamalı alım boru hattı ve doğrulama kapısı (`server/lib/import-gate.mjs`), `synchronous=FULL`, 100 bin cari + 100 bin ürün yük kanıtı, tehdit analizi ve çökme senaryosu (`docs/TOPLU-ALIM-TASARIMI.md`, `test/import-crash.test.mjs`). Ayrıntı `CHANGELOG.md`.
- **2.0.4 içeriği:** Taksit modülü (`docs/MIMARI.md` → *2.0.4 eklemeleri*), kurulum dosyasıyla mevcut sunucunun üstüne güncellemede servis düzeltmesi (kök neden: dosyalara yazılan klasör izni), Telefon düğmesi, kolon genişlikleri. Ayrıntı `CHANGELOG.md`.
- **2.0.3 içeriği:** ay hücresindeki tutar aylık ücret kolonu yoksa ödenecek taksittir; kart detayındaki tahsilat (notundaki ay) o ayı kapatır. Ayrıntı `CHANGELOG.md`.
- **2.0.2 içeriği:**
  - Excel/Sheets açılır listeleri ve Excel birleşik giriş kutuları → programda açılır liste (`server/lib/choices.mjs`, `client/assets/hof-choices.js`); gizli liste sayfası programda da gizlenir.
  - Belge kartı: adet sınırı yok, yan yana 1–4 sütun, seçilenleri .zip ile indirme (`/api/workspace/cases/:key/documents/archive`), PDF/resim/metin doğrudan yazdırma.
  - Uyarı kartında "Gerçekleştirildi" (hücreye yazar, tarih korunur; tekrarlayan ödeme gününde yalnız o ay kapanır; görev tamamlanır); 20 sn görünür, aralarında 10 sn, kısa bildirimlerle üst üste binmez.
  - Ana tabloda tüm kolonlar (paket yaması `tum-kolonlar-*`), içeriğe göre genişlik, dondurulmuş ilk kolon, yapışkan yatay kaydırma çubuğu (`hof-grid.js`); serbest sayfada 500 kolon.
  - Kendi sektörü (`server/lib/custom-sectors.mjs`): oluştur/düzenle/sil, tanıtıcı başlıklarla öneri.
  - Sohbet gün gün; 30 günden eskiler `veri/mesaj-arsivi/` altına ay ay metin olarak taşınır (`server/lib/chat-archive.mjs`).
  - Tarih anlamı sınıflandırıcısı (`server/lib/insight/temporal.mjs`), satır bağlamı, tahsilat takvimi düzeltmeleri; Silinenler ve geri yükleme (göç 6); sekme adlandırma/silme; sade sol menü; kısa kılavuz (8 sayfa).
  - Ay matrisi → taksit defteri (`server/lib/insight/installments.mjs`): geçerlilik aralığı dışındaki boş aylar taksit değil; 3 tam boş ay → durgun, raporda listelenir.
  - Raporlar (sol menü): ortak omurga sorgu motoru, oturumlar arası cari eşleme, Cari ekstre / Vade takip / Nakit akış, dinamik kolonlar, Excel/PDF/yazdır (`server/lib/reports.mjs`, `client/assets/hof-reports.js`).
  - Drive'a yedek: Yönetim → Yedekler; klasör yolu ya da Drive bağlantısı; `DestekOfis Yedekleri`; bağlantı kipi lisans servisindeki `/v1/yedek/oturum` ucunu bekler (`docs/DRIVE-YEDEK.md`, Vercel işlevi henüz yayımlanmadı).
  - Doğrulama: birim ve uçtan uca testler, 2.0.1 → 2.0.2 ve eski sürümlerden güncelleme provası (ayrıntı `CHANGELOG.md`).

## Kalanlar (öncelik sırasıyla)

### 2.0.10 için biriken düzeltmeler (kullanıcı: "not al, birlikte yaparsın")
1. **Sol menü › Çalışma oturumu kartı kesiliyor** (29.09.2026, ekran görüntüsü): sol paneldeki *Çalışma oturumu* başlığına tıklayınca açılan *Çalışma oturumları* kartı (oturum listesi, "+ Yeni oturum aç", "Oturumlar" düğmesi, alttaki açıklama) sağdan panelin dışına taşıyor; bir kısmı panelin altında / ana içeriğin arkasında kalıyor. Kart panelin içine sığmalı ya da panelin üstünde (z-index) açılmalı; dar panelde genişlik panele göre. Test: e2e'ye "oturum kartı görünür alanda, taşma yok" adımı.
2. **Görev ata › Atanacak kişi listesi eksik** (29.09.2026, ekran görüntüsü): kayıt kartından *Görev ata* penceresinde "Atanacak kişi" listesinde yalnız "Ofis yöneticisi" var; oysa Yönetim › Kullanıcılar'da aktif personel (mukaddes ulutaş, rol Personel, ANLIK DURUM yetkili) mevcut. Beklenen: tüm aktif kullanıcılar (yönetici, uzman, personel, muhasebe) listede, rolüyle birlikte; pasif hesaplar hariç. Koddan bak: listeyi dolduran uç (`/api/admin/users` mi, ayrı bir "atanabilirler" ucu mu) ve istemcideki süzgeç; olası neden: liste yalnız `plans.manage`/uzman rolleri süzüyor ya da sayfa açılışında bir kez yüklenip yeni kullanıcı gelince yenilenmiyor. Test: API + e2e ("personel eklendi → Görev ata listesinde görünür").
3. **Rapor durum metinlerinde parantezli açıklamalar kalksın** (müşteri isteği, 30.09.2026): *Cari listesi ve bakiyeler* ve *Cari mizanı* raporlarında Durum sütunu "Borçlu (bize borçlu)" / "Alacaklı (biz borçluyuz)" yazıyor; müşteri parantez içindekileri istemiyor → yalnız "Borçlu" / "Alacaklı" / "Kapalı". Yerler: `server/routes/report-center.mjs:43` ve `server/routes/overview.mjs:167` (`sideText`); aynı ifade ekstre alt notlarında da var (`overview.mjs:224`, `report-center.mjs:289`, `hof-overview.js:416` "B: bize borçlu · A: biz borçluyuz") — onlar sütun kısaltmasını açıklıyor, müşteriye sor / sade bırak ("B: borç · A: alacak"). Ekran, PDF ve Excel'de aynı olsun; testlerdeki beklentiler güncellenir.
4. **Bakiye renkleri ters** (müşteri isteği, 30.09.2026, *Cari listesi ve bakiyeler* ekran görüntüsü): muhasebe programlarındaki genel kural — **bizim alacağımız (cari bize borçlu) yeşil, bizim borcumuz (biz cariye borçluyuz) kırmızı**. Şu an tersi: `client/assets/hof-ui.css:7154` `.hof-acc-balance.is-debtor` kırmızı (#b3473a), `.is-creditor` yeşil (#177245); `hof-accounts.js:52` `balanceHtml` bu sınıfları bakiyeye göre veriyor. Aynı kural programın her yerinde tek olsun: Cari listesi, cari kartı bakiyesi, mizan/ekstre (`hof-overview.js`), rapor merkezi hücreleri, ANLIK DURUM "Toplam alacak / Toplam borç" kutuları, PDF'ler (`server/lib/report-pdf.mjs`'de renk varsa). Yön: alacak = yeşil, borç = kırmızı; gecikmiş yine kırmızı. Bu maddeyle birlikte 3. maddedeki metin sadeleşmesi ("Borçlu" / "Alacaklı") da aynı yerlerde yapılır. Test: e2e'de sınıf/renk denetimi (bize borçlu satır `is-debtor` → yeşil).

1. **2.0.2'yi yayımlamak (kullanıcı onayıyla).**
   - Dal `master`'a birleştirilir (PR), ardından *Releases → Draft a new release* → etiket `v2.0.2` (hedef `master`) → *Publish release*. `release.yml` imzalı paketi, kurulum dosyalarını ve kılavuzu ekler; 2.0.1 kurulumlar *Yönetim → Sistem → Güncellemeleri denetle* ile ya da kendiliğinden 2.0.2'ye geçer.
   - Sır yoksa paket yerelde üretilip yayına elle yüklenir (`docs/SURUM-YAYIMLAMA.md` → B). Site deposunda kılavuz PDF'i ve sürüm notları güncellenir.
2. **Pro — uzaktan görüntüleme (kullanıcı 29.09.2026 tarihinde "başla" dedi; çalışılıyor).** Ayrıntılı ve kararlaştırılmış plan: `docs/PRO-UZAKTAN-GORUNTULEME.md` (şifreli özet kopyası Cloudflare R2/Worker/Pages üzerinde, QR ile cihaz eşleme, "Uzaktan bağlanabilir" izni, SMS yok, Pro lisansla açılır, sitede "Pro demo"). Önceki tünel önerisi sunucunun sürekli açık olmasını gerektirdiği için ikinci adıma (telefondan kayıt girme) bırakıldı.
3. **Faz 4 kalanı: alan adı.**
   - `destekofis.net` alınıp Vercel'e bağlanacak.
   - Ardından KVKK veri sorumlusu ve adresi güncellenecek. Şu an "Uğur Çetin, Karatay / Konya / Türkiye".
   - `destek-ofis.vercel.app` açık kalmalı, çünkü program lisans servisine bu adresten bağlanır. Yeni adres bir sonraki sürümde `DEFAULT_LICENSE_SERVICES`'e ikinci adres olarak eklenir.
4. **Faz 4 kalanı: site içerikleri.** Fiyat ve satın alma yolu, video oynatıcı, sürüm notları vb. Kullanıcıyla konuşulacak.
5. **Tanıtım videosu.** Ses kararı bekleniyor.
6. **Ticari hazırlık.**
   - Kod imzalama sertifikası (Windows "tanınmayan uygulama" uyarısı için).
   - Depoyu gizliye alma. Önce demo indirme bağlantısı ve güncelleme kaynağı başka yere taşınmalı.
7. **İsteğe bağlı:** Tabloda uygulamada eklenen yeni kayıtlar şu an sekmenin en üstünde görünür (kullanıcı "alta eklensin" isteğini işlem geçmişi ve kasa için onayladı); istenirse tablo için de değiştirilebilir.

## Kalıcı kurallar

- GitHub'a gönderme ve yayın yalnızca kullanıcının onayıyla yapılır.
- Etiketler zorla taşınmaz.
- Gizli anahtarlar hiçbir depoya, zip'e veya belgeye konmaz. Bu anahtarlar şunlardır:
  - güncelleme imza anahtarı;
  - lisans imza anahtarı;
  - API sırrı;
  - operatör parolası.

  Lisans anahtarı ve API sırrı yalnızca Vercel'in gizli ortam değişkenlerindedir.
- Yeni sürümde kurulum dosyası release'e sürüm numarasız `DestekOfis-Kurulum.exe` adıyla da eklenir.
- Müvekkil verisine erişilmez. Analiz internetsiz yapılır.
- Teslimler: zip ve HTML/PDF rehber; kullanıcıya teknik olmayan dille anlatılır.
