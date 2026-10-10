# DestekOfis — durum ve devam notu

Yeni bir oturum bu belgeyi okuyarak kaldığı yerden devam eder. Son güncelleme: 02.10.2026 (2.0.16 hazırlanıyor — müşteri bildirimleri, bkz. Kalanlar; 2.0.15 yayımlandı — PR #15, `v2.0.15` = 85171ae: Fatura modülü, e-Belge altyapısı kapalı, kılavuzda Fatura; önceki: 2.0.14 yayımlandı — PR #14, `v2.0.14`: odak, Cari Kartı, WhatsApp Otomatik Sıra, damga düzeltmesi; 2.0.13 yayımlandı — PR #13, `v2.0.13`: WhatsApp toplu ekstre/mesaj, ödeme yolu, Ana Defter ve mutabakat kapısı, tarih/dönem kilidi/eksi bakiye kuralları; önceki: 2.0.12 hazırlandı: taksit kartının Kayıt Tarihi carinin tarihinden gelir, form düzeni; önceki: 2.0.11 yayımlandı — PR #11, `v2.0.11`, beş dosya bayt bayt doğrulandı: 8 düzeltme — Taksitler'den cari seçip toplu taksitlendirme, grup süzgecinde cari sayısı, Veri Sağlığı'nda Yok Say, başlıklarda her sözcüğün baş harfi büyük, stok birimleri tek yazım, açık pencereler canlı yenilenir, Ayarlar kullanıcı kartının altında, arama kutusu her yerinden yazar; önceki: 2.0.10 yayımlandı: 17 düzeltme — ayrıntılı yetkiler ve özel roller, kullanıcı silme/ad düzeltme, yönetici parolası kurtarma, "+ Sayfa"ya Excel/Sheets, anlık çek yenilemesi, Borçlu/Alacaklı dili ve renkleri, tek arama kutusu ; 2.0.9 yayımlı; önceki not: sürüm 2.0.2 denetimden geçti — `docs/DENETIM-2.0.2.md`; okuma motoru, analiz iş parçacığı, kanıtlı kolon kararları, kendi kendini onarma, şemaya esnek kolon eşleme, Veri Sağlık Kontrolü ve olay tabanlı uyarılar eklendi — `docs/MIMARI.md` → *2.0.2 eklemeleri*; yayın kullanıcı onayı bekliyor; 2.0.1 yayımlı).

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
- **2.0.11 yayımlandı** (PR ceougur/ofis---y-netimi#11, `v2.0.11`; beş dosya ve latest/DestekOfis-Kurulum.exe bayt bayt doğrulandı): "2.0.11 düzeltmeleri" listesinin 8 maddesinin tamamı (aşağıda, Kalanlar'da maddeler ve kararlar duruyor). Yeni parçalar: `HOF.onLedger` / `ledger:changed` (açık pencerelerin tek yenileme kanalı), `server/lib/text-case.mjs` + `HOF.titleCase` (yazım düzeni; CLAUDE.md → *Yazım düzeni*), `server/lib/units.mjs` + göç 16, toplu taksit `dryRun` ve `plan` süzgeci, `hof-plans.js pickAccounts`, Veri Sağlığı kararları (`insight.quality.ignored`, ofis geneli). Kılavuz sadeleşti (sürüm/altyapı notu yok; CLAUDE.md → *Kullanım kılavuzu*), 22 ekran görüntüsü yeniden çekildi (`node docs/kilavuz/ekran-cek.mjs`: uydurma örnek verilerle — `docs/kilavuz/ornek/` — sıfırdan; sonra `pdf-uret.mjs`). Doğrulama: birim 662, e2e 50 adım, `npm run test:senaryo-211` 57 denetim, senaryo 44, senaryo-rapor 82, senaryo-taslak 30, senaryo-210 57; güncelleme provası gerçek imzalı paketle 2.0.10 / 2.0.9 / 2.0.4 / 1.7.0 → 2.0.11: 102 / 104 / 104 / 94 denetim (şema → 16, eski birimler tek yazımda). Teslim: `DestekOfis-2.0.11-{1-Guncelleme-ve-Belgeler,2-Kurulum,Kaynak-ve-Denetim}.zip` + SHA256SUMS (paket sha256 16a97a54…, kurulum 214ca7d7…). Ayrıntı `CHANGELOG.md`, `docs/MIMARI.md` → *2.0.11 eklemeleri*.
- **2.0.10 yayımlandı** (PR ceougur/ofis---y-netimi#10, `v2.0.10`; beş dosya ve latest/DestekOfis-Kurulum.exe bayt bayt doğrulandı): "2.0.10 için biriken düzeltmeler" listesinin 17 maddesinin tamamı (aşağıda, Kalanlar'da maddeler ve kararlar duruyor). Yeni parçalar: `server/lib/access.mjs` (özel roller, kişiye özel ekle/kaldır, `user.perms`), göç 15 (`roles`, `users.role_key`, yumuşak silme alanları), `server/lib/recovery.mjs` (kurtarma anahtarı + sunucu kodu; `packaging/windows/bin/kurtarma-kodu.cmd`, Başlat menüsü kısayolu), `server/lib/free-import.mjs` ("+ Sayfa" Excel/Sheets). ANLIK DURUM kartı yalnız yönetici (`overview.card`), Yönetim paneli yalnız yönetici; uzman İşlem geçmişini Raporlar → Tüm raporlar'dan görür. Doğrulama: birim 655, e2e 49 adım, `npm run test:senaryo-210` 57 denetim (17 maddenin her biri, ekran görüntüleri `test/e2e/artifacts/senaryo-210/`), senaryo 44, senaryo-rapor 82, senaryo-taslak 30. Ayrıntı `CHANGELOG.md`, `docs/MIMARI.md` → *2.0.10 eklemeleri*.
- **2.0.9 yayımlandı** (PR ceougur/ofis---y-netimi#9, `v2.0.9`): müşteri isteği "soldaki Raporlar cariye bağlı değil, boş geliyor" → sol menü *Raporlar* = *Rapor Al*, tek pencere (Cari ekstre, Vade takip, Nakit akış, Çek / Senet, Tüm raporlar, Tablo raporları); birleşik Vade takip (taksit + çek/senet + ileri tarihli Kasa + tablo takvimi, telefonla arama); Nakit akışta tablo kaynağı ve dönem toplamları; rapor merkezine beş modül raporu (28 rapor); açılış ekranında sektöre uygun taslak Excel (143 sektör); Excel okumada eski "kullanılan alan" etiketi düzeltmesi; destek hattı 0536 771 50 55 (program; site ceougur/destekofis#2 ile birleşti). Doğrulama: birim 630, senaryo-rapor 82, senaryo-taslak 30, e2e, 2.0.8 senaryosu 44. Ayrıntı `CHANGELOG.md`, `docs/MIMARI.md` → *2.0.9 eklemeleri*.
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
  - Drive'a yedek (2.1.0'da KALDIRILDI, kullanıcı kararı 10.10.2026): Yönetim → Yedekler; klasör yolu ya da Drive bağlantısı; `DestekOfis Yedekleri`; bağlantı kipi lisans servisindeki `/v1/yedek/oturum` ucunu bekler (`docs/DRIVE-YEDEK.md`, Vercel işlevi henüz yayımlanmadı).
  - Doğrulama: birim ve uçtan uca testler, 2.0.1 → 2.0.2 ve eski sürümlerden güncelleme provası (ayrıntı `CHANGELOG.md`).

### 2.0.18 — teslim hazır 02.10.2026 (PR/yayın kullanıcı onayıyla)
Müşteri bildirimi: marka/patent tablosunda kayıttan açılan cari adı "Marka / Buluş Adı" kolonundan geliyordu (FURRA).
Kök neden ve program geneli düzeltme (`client/assets/hof-plans.js` personOf → analizin kişi kolonu; öğe adı kolonları
ad sayılmaz; Adı + Soyadı birleşik). Kullanıcı kararı ("çok özellik çok hata doğuruyor"): kayıt ile cari AYRILDI —
Yeni Kayıt'taki "cari kartı da aç", Cari'deki Tablodan Al, Raporlar'daki "Tablodaki Kişileri Cari Yap", detay kartındaki
CARİ kutusu / Cari Kartı pili ve POST cases/:key/account ucu kaldırıldı. Kalanlar: cari formundaki Tablodaki Kayıt alanı,
kayıttan taksit, Taksit → Tablodan Aktar. Şema göçü yok. Kanıt `docs/2.0.18-KANIT.md`, CHANGELOG → 2.0.18, CLAUDE.md
madde 15. Teslim `dist/teslim-2.0.18/` (3 zip + SHA256SUMS; OKU-BENI.txt'de yayın adımları).

## Kalanlar (öncelik sırasıyla)

### 2.0.17 — yapıldı, teslim paketi hazır (02.10.2026; dal `claude/nice-euler-jvajxv`; PR/birleştirme/yayın kullanıcı onayıyla)
Müşteri bildirimleri (CLAUDE.md → Açık iş → "2.0.17 müşteri istekleri", 14 madde): çoklu şirket (001/002… ayrı veri tabanı,
sol üst şirket seçici, Yönetim → Şirketler: yetki, birleşik rapor, Verisini Sıfırla, Sil), çalışma oturumu kalktı → ortada
Sayfalar şeridi (+ Sayfa: Excel/Sheets = veri sayfası, Boş Sayfa; Veri Sekmesine Dönüştür; zil/takvim bütün sayfalar),
fatura Sil, hayalet kısmi ödeme (kapama yöne göre, Mahsup Et, Kapatılacak Fatura, Bu Faturayı Kapatanlar), Kasa yalnız
nakit + Banka/POS raporu + Kasa↔Banka transferi, eksi stok görünür, çek ciro seçici, iade düzenleme + pasif düğme nedeni,
güncelleyici periyodik denetim; madde 14 (Excel doldurma tutamacı) yalnız kılavuz notu (program dosyaya yazmaz).
Kanıt: `CHANGELOG.md` → 2.0.17, `docs/2.0.17-KANIT.md`, `docs/MIMARI.md` → *2.0.17 eklemeleri*, `test/*-217.test.mjs`,
`npm run test:senaryo-217` (62/62). **Göç VAR** (şema 18 → 19: `account_entries.invoice_id`, `invoice_offsets`); çoklu
şirkette mevcut veri dosyası yerinde = 001. Teslim: `dist/teslim-2.0.17/` (3 zip + SHA256SUMS).

### 2.0.16 — yayımlandı 02.10.2026 (PR #16, `v2.0.16` = bd777e9; beş dosya ve latest/ adresleri bayt bayt doğrulandı; güncelleyici 2.0.15/14/13/12/2.0.4/1.7.0 → 2.0.16 "available"; site kılavuz PR'ı ceougur/destekofis#4)
Müşteri bildirimleri (CLAUDE.md → Açık iş → "2.0.16 müşteri hataları", 11 madde): fatura raporları cari seçmeden açılır
(kritik), kaydedilmiş faturayı Düzenle (aynı numara, tek işlemde geri al + yeniden yaz), "Kes" → "Kaydet", KDV dahil iskonto
ve Toplamlar düzeni, Stok Kodu (barkod; tekil; faturada kolon, PDF, rapor), alışta + Yeni Stok Kartı, Tüm Kalemlere KDV, KDV
kutusu, kırpılmayan öneri listesi, tahsilatta POS / ödemede Kredi Kartı, PDF düğmesi adları. Kanıt: `CHANGELOG.md` → 2.0.16,
`docs/MIMARI.md` → *2.0.16 eklemeleri*, `test/fatura-216.test.mjs`, `npm run test:senaryo-216` (42 rapor arayüzden).
Göç yok (şema değişmedi). Teslim: `dist/teslim-2.0.16/` (3 zip + SHA256SUMS; 2-Kurulum 59,7 MB olduğundan .exe ayrıca verildi). Madde madde kanıt: `docs/2.0.16-KANIT.md`.

### 2.0.15 — yayımlandı 02.10.2026 (PR #15, `v2.0.15` = 85171ae; beş dosya ve latest/DestekOfis-Kurulum.exe bayt bayt doğrulandı; güncelleyici 2.0.14/13/12/2.0.4/1.7.0 → 2.0.15 "available")
Kapsam ve kanıt: `CHANGELOG.md` → 2.0.15, `docs/MIMARI.md` → *2.0.15 eklemeleri — Fatura modülü*, `docs/FATURA-ISTEKLER.md`
(her istek kanıtlı, kararlar listesi), `docs/FATURA-QA-RAPORU.md` (64 test, 92/100), `docs/FATURA-KARSILASTIRMA.md`,
proje sahibi kılavuzu `docs/kilavuz/FATURA-SAHIP-KILAVUZU.html` (PDF teslimde). Kullanıcı kararları: e-Belge bağlantısı
KAPALI ("entegre et" diyene kadar; tek anahtar `config.edocEnabled`), entegratör yalnız EDM, "Listeden Sil" etkileri geri
almaz, icra dosyası bağı yapılmaz (cari yeter). Doğrulama (02.10.2026): `npm run check` 281/281, `npm test` 734/734,
`npm run test:e2e` 50/50, `npm run test:senaryo-215` 73/73, `npm run test:mutabakat` tohum 1 (2.000 işlem, 0 sapma),
`test/einvoice-edm.test.mjs` 22/22. Göç 18 (yalnız ekleyici; 2.0.14 yeni şemayla açılabilir). Çalışma zamanı gereksinimi
değişmedi (Node aynı; bootstrap 2) → 1.7.0 ve sonrası bütün kurulumlar kendiliğinden güncellenir.
Teslim: `dist/teslim-2.0.15/` (OKU-BENI.txt'de yayın adımları; `DestekOfis-2.0.15-1-Guncelleme-ve-Belgeler.zip`,
`DestekOfis-2.0.15-Kaynak-ve-Denetim.zip`, SHA256SUMS). İmzalı güncelleme paketi (anahtar destekofis-2026-1, kullanıcının oturuma yüklediği .pem dosyasıyla
`node tools/release.mjs --anahtar …`; sha256 a3c1835c…) ve `DestekOfis-Kurulum-2.0.15.exe` (Wine + Inno Setup; sha256
aa943af8…) teslimde; beş dosya yayına kullanıcı tarafından yüklenir (OKU-BENI.txt). "birleştir" denince PR,
"yayımladım" denince yayındaki dosyalar bayt bayt doğrulanır (önceki sürümlerdeki gibi).

### 2.0.14 — yayımlandı 01.10.2026 (PR #14, `v2.0.14` = 6337029; beş dosya ve latest/ adresleri bayt bayt doğrulandı)
Teslim: `DestekOfis-2.0.14-{1-Guncelleme-ve-Belgeler,2-Kurulum,Kaynak-ve-Denetim}.zip` + SHA256SUMS (güncelleme paketi
sha256 9a6bc908…, kurulum dae7a169…; imza anahtarı destekofis-2026-1; şema 17 değişmedi). Provalar 2.0.13/12/11/10 (107),
2.0.4 (108), 1.7.0 (98) — 0 hata. "birleştir" denince PR, "yayımladım" denince yayındaki dosyalar bayt bayt doğrulanır.
Kullanıcının biriktirdiği liste (`CLAUDE.md` → Açık iş → 2.0.14 listesi): 1 damga düzeltmesi, 2 WhatsApp Otomatik Sıra + PDF,
3 tüm arama kutularında odak, 4 bütün programda odak denetimi, 5 detay panelinde Cari Kartı düğmesi. Kapsam ve kanıt
`CHANGELOG.md` → 2.0.14, `docs/MIMARI.md` → *2.0.14 eklemeleri*. Doğrulama: `npm test`, `npm run test:senaryo-214` (odak),
`npm run test:senaryo-whatsapp` (adım E), `npm run test:senaryo-213` (PDF), diğer senaryolar ve `npm run test:e2e`.

### 2.0.13 — yayımlandı 01.10.2026 (PR #13, `v2.0.13` = 20e110d; beş dosya ve latest/DestekOfis-Kurulum.exe bayt bayt doğrulandı)
Teslim: `DestekOfis-2.0.13-{1-Guncelleme-ve-Belgeler,2-Kurulum,Kaynak-ve-Denetim}.zip` + SHA256SUMS (güncelleme paketi
sha256 840193a1…, kurulum d3fe6f22…; imza anahtarı destekofis-2026-1; göç 17). Yayın adımları teslimdeki OKU-BENI.txt'de;
"birleştir" denince PR, "yayımladım" denince yayındaki dosyalar bayt bayt doğrulanır.
Kapsam ve kanıt `CHANGELOG.md` → 2.0.13 ve `docs/MIMARI.md` → *Ana Defter ve mutabakat kapısı*. Özet:
- Süpermarket simülasyonu bulguları (çift borç, iade, alış/satış fiyatı, eksi kasa, açılış bakiyesi yönü, çift cari).
- WhatsApp tek/toplu ekstre ve mesaj; ödeme/tahsilat yolu (Nakit, Havale/EFT, Kredi Kartı, Çek/Senet, Açık Hesap).
- Ana Defter (türetilmiş, çift yönlü) + işlem anında mutabakat kapısı (COMMIT öncesi; sapmada ROLLBACK + `integrity_log`).
- Kullanıcı kararı (holding stres simülasyonu İPTAL; "4 çekirdeğe odaklan"): Kasa, Stok, Cari, Taksit için tarih kuralları
  (`server/lib/period.mjs`), dönem kilidi (Yönetim → Sistem), yuvarlama, iade sınırı, cari bazında mutabakat,
  `npm run mutabakat` (salt okunur yerel denetim), `npm run test:mutabakat` (model tabanlı uzun koşu),
  `test/mutabakat-cekirdek.test.mjs`, `test/donem-213.test.mjs`.
- Eksi Bakiye Denetimi (kullanıcı onayı 01.10.2026; Logo/Netsis parametresinin karşılığı): Nakit, Banka, Kredi Kartı için
  Uyar / Engelle / Kontrol Yok — Yönetim → Sistem. Cari listesinde hepsini seç + hariç tut (WhatsApp ve toplu taksit).
  WhatsApp ölçek senaryosu: `npm run test:senaryo-whatsapp` (1.000 cari, 40 seçili, 190 kişiye şube mesajı, 997 hariçli).
- Davranış değişikliği: ileri tarihli Kasa hareketi (planlı gider) artık girilemez; eski kurulumlardaki satırlar taban
  sayılır ve raporlarda görünmeye devam eder. Tarih alanı hiç gönderilmezse bugün yazılır; gönderilip boş bırakılırsa ret.

### 2.0.12 düzeltmeleri — yayımlandı 30.09.2026 (PR #12, `v2.0.12`; beş dosya bayt bayt doğrulandı)
1. **Taksit kartının "Kayıt Tarihi" carinin kayıt tarihini taşımıyor** (müşteri, 30.09.2026; ilk bildirim "tahsilat girince
   kayıt tarihi değişiyor"; WhatsApp ekran görüntüsüyle netleşti: *Yeni Taksit Kartı* formu). **Neden (kodda doğrulandı):**
   kartın kendi `registered_on` alanı var ve cari seçilse de **bugün** gelir — form `hof-plans.js:497`
   (`plan?.registeredOn || todayIso()`), toplu taksitlendirme `plans.mjs createForAccount` (`today()`), cari arama
   ucu (`/accounts/search`) carinin `registeredOn`'unu döndürmüyor. Carinin tarihi bozulmuyor; ama aynı kişi için iki farklı
   "Kayıt Tarihi" görünüyor (cari: eski tarih, kart ve Taksit Kartları raporu: bugün). Kayıttan *Tahsilat → Taksit planı
   oluşturun* yolu bu formu açtığı için müşteri "tahsilat girince" dedi. Müşterinin yorumu: "kişinin gruba eklendiği
   tarihi belirtir diyor" — yardım metni "Kişinin kaydedildiği gün; bugün hazır gelir." yanıltıcı.
   **Yapılacak:** cari seçilince (elle, öneriyle ya da kayda bağlı cariyle) kartın Kayıt Tarihi carinin tarihiyle dolsun
   (kullanıcı değiştirmediyse); toplu taksitlendirmede kart carinin tarihini alsın; carisi yoksa tablodaki kaydın "Kayıt
   Tarihi" kolonu, o da yoksa bugün. Yardım metni: "Carinin kayıt tarihi; cari seçilince onunki gelir." Mevcut kartlar için
   (isteğe bağlı) "carinin tarihini kullan" göçü kullanıcıya sorulacak. **Ek (müşteri):** "İlk vade tarihi aşağı tarafta
   kalıyor" — formda İlk Vade, Taksit Sayısı'nın yanına/üstüne alınsın. Test: tarihli cari → Yeni Kart / Cari Seç toplu /
   kayıttan Tahsilat → kartın tarihi = carinin tarihi; raporda aynı.

### 2.0.11 düzeltmeleri — tamamı yapıldı ve yayımlandı (30.09.2026, v2.0.11)
Maddeler ve kararlar kayıt için duruyor; yapılan iş ve kanıtı `CHANGELOG.md` → 2.0.11 ve `test/e2e/senaryo-211.mjs`.
1. **Tablo arama kutusu her yerinden tıklanınca etkinleşmeli** (müşteri, 30.09.2026, ekran görüntüsü "TÜM REHBER"):
   kutunun alt kısmına tıklayınca yazma başlamıyor; ancak tam ortadaki ince şeride tıklanınca etkinleşiyor. Koddan
   ölçülen neden (2.0.10): `.search-field` 44 px yüksek ama içindeki `input` yalnız 18 px; altındaki "Enter · ilk sonuca
   git · Ctrl+K" ipucu (`.smart-search-hint`) ve iç boşluklar tıklamayı yutuyor. Yapılacak: kutunun her noktası
   (büyüteç, ipucu, boşluk, ⌘K) tıklanınca `input` odaklansın (kutu `label` gibi davransın ya da `mousedown` → `focus`),
   `input` kutunun yüksekliğini doldursun, imleç metin imleci olsun; bütün arama kutularında (Cari, Taksitler, Stok,
   Çek/Senet, Raporlar, Mesajlar, sektör seçici) aynı. Test: e2e — kutunun dört köşesine ve ipucuna tıklayınca odak
   `input`'ta.
2. **Veri sağlığı: "Yok say" ile uyarı kalıcı kapansın, puan %100'e çıkabilsin** (müşteri, 30.09.2026, ekran görüntüsü
   "Veri sağlığı: Orta (%90)": "Öğrenci No boş olan 2716 kayıt", "Telefonu kolonunda geçersiz telefon: 31", "Soyadı boş: 1").
   Müşteri: "%90 psikolojimi bozuyor; ilk uyarı versin, yoksay deyince bir daha çıkmasın, sağlık artsın."
   Yapılacak (muhasebe programlarındaki "uyarıyı kabul et / bir daha gösterme" kalıbı): her bulgu grubunda **Yok say**
   (grubun tamamı) ve satır bazında yok say; kalıcı (sunucuda, veri oturumuna ve kolona bağlı; tüm bilgisayarlarda),
   puan hesabından düşülür → kalan sorun yoksa %100 "İyi". Yok sayılanlar ayrı katlanır bölümde ("Yok sayılanlar · N")
   **Geri al** ile döner; yeni yüklemede aynı kolon/aynı kayıt için yok sayma korunur, yeni hatalı satır yine uyarır.
   İşlem geçmişine yazılır; yetki: veri yükleme yetkisi olan (yönetici). Test: API + e2e (yok say → puan artar → yeniden
   yükle → yok sayılan gelmez, yeni hata gelir → geri al).
   **Ek gözlem (ekran görüntüsünden, doğrulanacak):** bu tablo bir personel/akademik **rehber** ("TÜM REHBER"; satırlarda
   Öğr.Gör., Dr., Prof.Dr. unvanları) ama kimlik kolonu "Öğrenci No" sayılmış ve kayıt adı olarak **unvan** gösteriliyor.
   Kimlik kolonu boşsa 2716 kaydın hepsi "sorun" görünüyor. Kolon rolleri (kimlik/kişi/unvan) bu tablo için yeniden
   incelenecek: kimliği boş sekmede kimlik zorunluluğu uyarısı yerine ad+soyad kişi anahtarı; unvan kişi adı sayılmasın.
3. **Taksitler ekranında toplu taksitlendirme** (müşteri, 30.09.2026): "Toplu taksitlendirmeyi ilk başta ben bile zor
   buldum; Cari'den toplu seçim yapınca çıkıyor, bunu Taksitler menüsüne de ekleyelim." Bugün yol yalnız *Cari → soldaki
   kutularla seç → Seçilenlere taksit planı* (sunucu `POST /api/workspace/accounts/bulk-plan`, istemci `hof-accounts.js`).
   Yapılacak: *Taksitler* üst çubuğuna **"+ Toplu taksitlendir"** düğmesi → cari seçme penceresi (arama; tür, grup/alt grup,
   bakiye süzgeçleri; "Tümünü seç"; açık taksit kartı olan cari işaretli ve varsayılan seçilmez, "zaten kartı var" yazar;
   seçili sayısı ve toplam) → aynı taksit formu (tutar herkese aynı ya da karttaki alandan, taksit sayısı, ilk vade,
   aralık, grup) → ön izleme (kaç kart, toplam, atlanacaklar ve neden) → oluştur. Aynı sunucu ucu kullanılır (tek kural,
   çift kart açılmaz). Cari yoksa pencere yol gösterir ("Tablodaki kişileri cari yap" / "Excel'den cari yükle"). Kılavuzda
   Taksitler bölümüne yazılır. Test: e2e — Taksitler'den 3 cari seç → 3 kart, aynı cari ikinci kez seçilince atlanır,
   Cari ekranındaki yol da çalışmaya devam eder; boş veri ve aynı adlı iki cari.
4. **Taksitler › grup süzgeci boş gruplarla dolu** (müşteri, 30.09.2026, ekran görüntüsü): *Tüm gruplar* listesinde
   "42 C 0348 (0)", "42 C 0079 (0)"… hepsi **0 kart**; seçince liste boş. Müşteri: "orada cari seçimi olmadığı için
   gruplarda boş çıkıyor, bu da hata." Neden (doğrulanacak): gruplar carilerden/Excel'den tanımlandı ama bu gruplardaki
   carilerin henüz taksit kartı yok; süzgeç yalnız kartları sayıyor. Yapılacak (3. maddeyle birlikte): grup süzgecinde
   kart sayısının yanında **cari sayısı** ("42 C 0079 · 12 cari · 0 kart"); kartı olmayan grup seçilince boş liste yerine
   "Bu grupta 12 cari var, henüz taksit kartı yok → **Bu gruba toplu taksitlendir**" (seçim penceresi o grupla açılır);
   hiç carisi ve kartı olmayan grup listede sönük/ayrı. Test: e2e — gruplu cariler, kart yok → süzgeçte sayılar doğru,
   düğmeyle toplu taksit → kartlar grupta görünür.
   **Ek (müşteri, 30.09.2026):** "bu karta bu cari seçimi de ekleyeceğiz" — Taksitler penceresine (kullanıcı teyit etti;
   "Tüm gruplar · Alt grup · Sıra No" süzgeç satırına) **cari seçimi** gelir: grup seçilince o gruptaki cariler onay kutulu listede görünür (kartı olan/
   olmayan ayrı işaretli), seçilenler 3. maddedeki toplu taksitlendirmeye gider. Not: tekil "Yeni taksit kartı"
   penceresinde Cari seçici zaten var (hof-plans.js, v2.0.6); eksik olan ekran düzeyinde toplu cari seçimi.
5. **Birimlerin baş harfi büyük; tüm programda seçenek yazımı** (müşteri, 30.09.2026, Stok › Yeni ürün ekran görüntüsü):
   Birim listesi "adet, paket, kutu, çuval, şişe…" küçük harfle. İstek: baş harfleri büyük olsun ("Adet", "Paket",
   "Çuval", "Şişe") ve **tüm programdaki açılır listeler/etiketler** aynı gözle taransın. Kaynak: `hof-stock.js` `UNITS`
   dizisi; kayıtlı birimler de listeye katılıyor (`[...UNITS, ...used]`). Dikkat: (a) büyük harf Türkçe kurala göre
   (`toLocaleUpperCase("tr")`: i→İ); (b) eski kayıtlardaki "adet" ile yeni "Adet" listede iki kez çıkmasın — büyük/küçük
   harf duyarsız tekilleştirme, gösterimde tek biçim (kayıtlar, ekstre, fatura/PDF, Excel dışa aktarım aynı yazar);
   (c) **karar (kullanıcı, 30.09.2026): kısaltmalar dahil hepsinin ilk harfi büyük** — Kg, Gr, Ton, Lt, Ml, Cm, M², M³.
   Test: eski "adet" kayıtlı ürün + yeni ürün → listede tek "Adet"; stok raporu/PDF/Excel'de aynı yazım.
6. **Kasa penceresi bağlı hareket silinince kendini yenilemiyor** (müşteri, 30.09.2026, ekran görüntüsü): Kasa'da
   "Çek ödemesi · …" satırındaki ↗ ile çek/senet kartı açılıp hareket silinince Kasa'ya dönüldüğünde satır ve
   göstergeler eski kalıyor; kapatıp açmak gerekiyor. **Neden (kodda doğrulandı):** `hof-workspace.js` Kasa penceresi
   yalnız `change.kind === "cash"` olayında yeniden yükleniyor; çek/senet işlemleri `kind: "cheques"` yayımlıyor
   (`server/routes/cheques.mjs`); cari, taksit ve stok kaynaklı kasa satırları da aynı riskte. Yapılacak: Kasa'ya yazan
   her kaynak (çek/senet, cari, taksit, stok, detay kartı tahsilatı) değişince açık Kasa penceresi seçili dönemi
   koruyarak yenilensin (sunucuda kasayı etkileyen işlemler ayrıca `cash` olayı da yayımlasın ya da pencere bu
   türleri de dinlesin); aynı denetim ANLIK DURUM, Cari ekstresi ve Raporlar gibi açık kalan diğer pencerelere de.
   Test: e2e — Kasa açık → ↗ çek kartı → ödemeyi geri al/sil → kartı kapat → Kasa satırı ve 4 gösterge yeni değerde;
   ikinci kullanıcının silmesi de aynı şekilde yansır.
7. **Başlıklarda her sözcüğün baş harfi büyük (Title Case), tüm programda** (müşteri, 30.09.2026): "Tüm cari
   hareketleri" → "Tüm Cari Hareketleri", "Personel raporu" → "Personel Raporu"; uzman UI gözüyle programın tamamına.
   Kullanıcının verdiği hedef örnekler (bağlaç kuralını teyit eder): "Cari Listesi ve Bakiyeler", "Tüm Cari Hareketleri",
   "Cari Bazında Tahsilat", "Taksit Kartları".
   Örnek kaynaklar: `server/routes/report-center.mjs` (rapor adları), `server/lib/profile.mjs` ve `hof-workspace.js`
   (sektör/menü etiketleri). **Kapsam (adlar ve başlıklar):** pencere ve bölüm başlıkları, rapor adları, sol menü,
   sekme/pil adları, düğmeler, gösterge (KPI) etiketleri, tablo kolon başlıkları, açılır liste seçenekleri, PDF/Excel
   başlıkları ve sayfa adları. **Kapsam dışı (cümle düzeni kalır):** yardım/açıklama cümleleri, uyarı ve bildirim
   metinleri, onay pencerelerindeki cümleler, kullanıcının yazdığı veri (kişi adı, not, kullanıcının verdiği pil/kolon
   adı). **Kurallar:** Türkçe büyük harf (i→İ, ı→I); bağlaçlar küçük kalır ("ve", "ile", "veya", "ya da", "de/da"),
   ör. "Kasa ve Banka"; kısaltmalar olduğu gibi (PDF, KDV, TC, No). CSS `text-transform` kullanılmaz (Türkçe İ ve
   bağlaç kuralını bozar, PDF/Excel'e yansımaz); metinler kaynakta düzeltilir, 5. maddedeki birimlerle aynı ilke.
   Kullanıcının kalemle yeniden adlandırdığı başlıklara dokunulmaz. Kılavuz (HTML+PDF) ve ekran görüntüleri yeni
   yazımla güncellenir. Test: metin taraması (başlık sözlüğünde küçük harfle başlayan sözcük kalmadı; bağlaç istisnası)
   + e2e/ekran görüntüsünde menü, Raporlar, Kasa, Cari, Taksitler, Stok, Çek/Senet, Yönetim başlıkları.
8. **Sol menüde "Ayarlar" aşağıya taşınsın** (kullanıcı, 30.09.2026, ekran görüntüsü): "Ayarlar" düğmesi şimdi en
   üstte, Çalışma oturumu seçicisinin hemen altında duruyor; kullanıcı kartının (Ofis yöneticisi · Profil / Parola /
   Yönetim / Çıkış) **altına**, "Senkron aktif" kartının üstündeki boşluğa taşınacak. Kaynak: düğme hazır paketin kenar
   çubuğundan geliyor; `hof-sources.js` yalnız tıklamayı yakalayıp Veri penceresini açıyor ve `sources.manage` yetkisi
   yoksa gizliyor — taşıma DOM'da bu düğmeyi yeni yerine almak (paket yeniden çizince yerinde kalmalı). Dikkat: yetki
   gizlemesi ve tıklama yakalaması aynen sürer; dar ekranda/menü kaydırılırken alt blok taşmasın; Ctrl/klavye sırası
   mantıklı olsun. Test: e2e — yönetici: Ayarlar kullanıcı kartının altında, tıklayınca Veri penceresi açılır;
   yetkisiz kullanıcı: görünmez; oturum değiştirince/yenilenince yeri değişmez; ekran görüntüsü.

### 2.0.10 düzeltmeleri — tamamı yapıldı ve yayımlandı (30.09.2026, v2.0.10)
Maddeler ve kararlar kayıt için duruyor; yapılan iş ve kanıtı `CHANGELOG.md` → 2.0.10 ve `test/e2e/senaryo-210.mjs`.
1. **Sol menü › Çalışma oturumu kartı kesiliyor** (29.09.2026, ekran görüntüsü): sol paneldeki *Çalışma oturumu* başlığına tıklayınca açılan *Çalışma oturumları* kartı (oturum listesi, "+ Yeni oturum aç", "Oturumlar" düğmesi, alttaki açıklama) sağdan panelin dışına taşıyor; bir kısmı panelin altında / ana içeriğin arkasında kalıyor. Kart panelin içine sığmalı ya da panelin üstünde (z-index) açılmalı; dar panelde genişlik panele göre. Test: e2e'ye "oturum kartı görünür alanda, taşma yok" adımı.
2. **Görev ata › Atanacak kişi listesi eksik** (29.09.2026, ekran görüntüsü): kayıt kartından *Görev ata* penceresinde "Atanacak kişi" listesinde yalnız "Ofis yöneticisi" var; oysa Yönetim › Kullanıcılar'da aktif personel (mukaddes ulutaş, rol Personel, ANLIK DURUM yetkili) mevcut. Beklenen: tüm aktif kullanıcılar (yönetici, uzman, personel, muhasebe) listede, rolüyle birlikte; pasif hesaplar hariç. Koddan bak: listeyi dolduran uç (`/api/admin/users` mi, ayrı bir "atanabilirler" ucu mu) ve istemcideki süzgeç; olası neden: liste yalnız `plans.manage`/uzman rolleri süzüyor ya da sayfa açılışında bir kez yüklenip yeni kullanıcı gelince yenilenmiyor. Test: API + e2e ("personel eklendi → Görev ata listesinde görünür").
3. **Rapor durum metinlerinde parantezli açıklamalar kalksın** (müşteri isteği, 30.09.2026): *Cari listesi ve bakiyeler* ve *Cari mizanı* raporlarında Durum sütunu "Borçlu (bize borçlu)" / "Alacaklı (biz borçluyuz)" yazıyor; müşteri parantez içindekileri istemiyor → yalnız "Borçlu" / "Alacaklı" / "Kapalı". Yerler: `server/routes/report-center.mjs:43` ve `server/routes/overview.mjs:167` (`sideText`); aynı ifade ekstre alt notlarında da var (`overview.mjs:224`, `report-center.mjs:289`, `hof-overview.js:416` "B: bize borçlu · A: biz borçluyuz") — onlar sütun kısaltmasını açıklıyor, müşteriye sor / sade bırak ("B: borç · A: alacak"). Ekran, PDF ve Excel'de aynı olsun; testlerdeki beklentiler güncellenir.
4. **Bakiye renkleri ters** (müşteri isteği, 30.09.2026, *Cari listesi ve bakiyeler* ekran görüntüsü): muhasebe programlarındaki genel kural — **bizim alacağımız (cari bize borçlu) yeşil, bizim borcumuz (biz cariye borçluyuz) kırmızı**. Şu an tersi: `client/assets/hof-ui.css:7154` `.hof-acc-balance.is-debtor` kırmızı (#b3473a), `.is-creditor` yeşil (#177245); `hof-accounts.js:52` `balanceHtml` bu sınıfları bakiyeye göre veriyor. Aynı kural programın her yerinde tek olsun: Cari listesi, cari kartı bakiyesi, mizan/ekstre (`hof-overview.js`), rapor merkezi hücreleri, ANLIK DURUM "Toplam alacak / Toplam borç" kutuları, PDF'ler (`server/lib/report-pdf.mjs`'de renk varsa). Yön: alacak = yeşil, borç = kırmızı; gecikmiş yine kırmızı. **Müşterinin açıklaması (30.09.2026):** "Borçlu ve Alacaklı diye düzenleme yaparsak, Borçlular yeşil, Alacaklılar kırmızı görünecek" — yani Durum sütununda **Borçlu** (cari bize borçlu = bizim alacağımız) **yeşil**, **Alacaklı** (cari bizden alacaklı = bizim borcumuz) **kırmızı**. Metin ve renk birlikte düşünülür; kelime carinin durumunu anlatır, renk bizim açımızdan iyi/kötüyü. Bu maddeyle birlikte 3. maddedeki metin sadeleşmesi ("Borçlu" / "Alacaklı") da aynı yerlerde yapılır. Test: e2e'de sınıf/renk denetimi (bize borçlu satır `is-debtor` → yeşil).
5. **Bakiye listesine süzgeç seçenekleri** (müşteri isteği, 30.09.2026): *Cari listesi ve bakiyeler* raporunda (ve Cari ekranı listesinde) bakiye süzgeci şu seçeneklerle: **Tümü · Borçlular · Alacaklılar · Sadece bakiyesi olanlar** (bakiyesi sıfır olanlar gizlenir). Rapor merkezinde `side` süzgeci zaten var (`hof-report-center.js:50`: Tümü / Bize borçlu / Biz borçluyuz / Kapalı / Geciken taksiti olan) → etiketleri "Borçlular / Alacaklılar" yap, "Sadece bakiyesi olanlar" ekle (`report-center.mjs` cari-listesi süzgecine `nonzero`), Cari ekranındaki süzgece de aynısı (`hof-accounts.js:21` debtor/creditor). Ön izleme, PDF ve Excel süzgeci uygular; özet satırı süzülen kümeye göre. Test: API (nonzero süzgeci sıfır bakiyeyi dışarıda bırakır) + e2e.
6. **Cari ekstre PDF'i** (müşteri, 30.09.2026, WhatsApp görüntüsü): "Dönem sonu bakiye" kutusunda "3.000,00 TL Borçlu (…" — parantezli açıklama kutuya sığmayıp kesiliyor; 3. maddeyle birlikte yalnız "Borçlu" / "Alacaklı" yazılacak, kesilme kalmayacak. Alt başlıktaki "B: bize borçlu · A: biz borçluyuz" → "B: borçlu · A: alacaklı" (ya da satır sonundaki B/A harflerini "Borçlu/Alacaklı" kelimesiyle değiştir). Yerler: `server/routes/overview.mjs:224`, `server/routes/report-center.mjs:289`, ekran karşılığı `hof-overview.js:416`. PDF'de bakiye rengi de 4. maddeye uyar.
7. **ANLIK DURUM kartı yalnız yöneticide** (kullanıcı, 30.09.2026): ana ekrandaki ANLIK DURUM kartı personel ekranında görünmesin, yalnız yönetici görsün. Bugün kural `overview.view: ["admin"]` (`server/lib/permissions.mjs:42`) ama *Yönetim › Kullanıcılar › Ek yetki › "ANLIK DURUM ve raporlar"* ile personele açılabiliyor (`GRANTABLE`, :64); müşterinin personelinde (mukaddes) bu yetki açık olduğu için kart görünüyor. Yapılacak: kart ek yetkiyle de personelde çıkmasın — ek yetki yalnız Raporlar penceresini açsın (adı "Raporlar" olsun), kart (`hof-overview.js` mount + `hof-can-overview-view` CSS) ve `/api/workspace/overview` yalnız `admin` rolüne; rapor uçları ayrı izin (`reports.view` / yeni `reports.grant`) ile. Var olan grant'lar göçle yeni izne taşınır (kimse rapor yetkisini kaybetmez). **Tüm programda, sektörden bağımsız** (sektör sözlüğü/vocab'a bağlı değil; tek kural). Test: personel + ek yetki → kart yok, Raporlar var; API 403.
8. **Serbest sayfa "Yeni sayfa" kartına Excel / Sheets'ten içe aktarma** (kullanıcı, 30.09.2026): sekme şeridindeki *+ Sayfa* penceresinde (Sayfa adı, Kolon sayısı, Satır sayısı, Kolon başlıkları) iki seçenek daha: **Excel dosyasından aktar** (dosya seç / sürükle; .xlsx/.xls/.csv) ve **Google Sheets bağlantısından aktar**. Seçilen sayfanın başlıkları ve hücreleri serbest sayfaya olduğu gibi yazılır (ilk satır başlık; sayfa adı dosyadan/sekmeden gelir, değiştirilebilir; çok sayfalı dosyada sayfa seçilir); formüller varsa programın formül motoruyla taşınır, olmazsa değer yazılır; satır/kolon sayısı içerikten belirlenir (500 kolon sınırı korunur). Ana veri yüklemesiyle (oturum) karıştırılmaz: ana tabloya değil serbest sayfaya gider, oturum açılmaz. Mevcut parçalar: istemcide `hof-excel-worker.js` (dosya okuma), `hof-sources.js` `importSheet` (Sheets çekme — sunucu `server/lib/sheets.mjs`), serbest sayfa API'si `server/routes/free.mjs` (`PATCH /api/workspace/free/:id`, toplu hücre yazımı). Yapı: `POST /api/workspace/free/import {name, matrix, sheetName}` ya da Sheets için `{url, sheet}`. Yetki: sayfa açabilen herkes (bugünkü kural). Test: API (matris → sayfa; 500+ kolon reddi; Sheets sahte ağ) + e2e (dosya seç → sayfa oluşur → hücreler doğru → Alt toplam çalışır).
9. **Ana ekrandaki tahsilat takvimi çek ödenince kaybolmuyor** (müşteri, 30.09.2026; WhatsApp: "çek ödemesi yaklaştı pili, ödemeyi yaptım, kaybolmuyor; programı kapatıp açınca kayboluyor" → "anlık güncellemiyor"). Müşteri "belli aralıklarla yenileme" öneriyor; doğrusu olay tabanlı anlık yenileme (program zaten canlı olay kanalıyla çalışıyor). **Kök neden (koddan):** çek/senet işlemi sunucuda `workspace.changed {kind: "cheques"}` yayınlıyor (`server/routes/cheques.mjs:38`), ama takvim şeridi `client/assets/hof-promises.js:228` yalnız `["dues","activity","cash","records","source","plans"]` türlerinde yenileniyor; `cheques` listede yok → şerit ve pil eskimiş kalıyor. Aynı boşluk bildirim/zil için `hof-alerts.js:585` (yalnız `task`) ve muhtemelen `hof-cheques.js` kendi ekranında. Yapılacak: (a) `cheques` (ve `accounts`, `stock` gibi takvimi etkileyen her tür) şeridin ve zilin yenileme listesine; en iyisi sunucunun takvim değişince tek bir `alerts.refresh`/`dues.changed` olayı yayması, istemcilerin tür listesi tutmaması. (b) Pilden açılan kartta "Tahsilat gir / Ödendi" yapılınca pil hemen düşsün (iyimser kaldırma + yenileme). (c) Yedek: şerit 5 dk'da bir sessiz yenileme (olay kaçarsa). **Tüm kaynaklar için doğrula:** çek tahsil/ödeme, senet, taksit tahsilatı, Kasa ileri tarihli kayıt, tablodaki ödeme sözü "ödendi say", cari tahsilat — her biri şeridi, zili, ANLIK DURUM'u ve Vade takibi sayfa yenilemeden günceller. Test: e2e — pil var → çek "ödendi" → pil 2 sn içinde yok, zil sayısı düşer; API olay yayınını doğrula.
10. **Kullanıcı silme — "Sil" düğmesi** (müşteri, 30.09.2026; Yönetim › Kullanıcılar). **Düzeltme (kullanıcı, 30.09.2026): ✕ simgesi değil; İşlemler sütununda "Parola sıfırla" ve "Oturumları kapat" düğmelerinin yanına aynı biçimde bir "Sil" düğmesi** (kırmızı yazılı/kenarlı tehlike düğmesi, onay penceresiyle). Kendi satırında ve son yöneticide pasif görünür. Bugün silme ucu yok (`server/routes/admin.mjs`: yalnız POST/PATCH/reset/logout; PATCH `active:false` pasifleştiriyor ama arayüzde düğmesi yok). Muhasebe programı kuralı: kullanıcının geçmişi (işlem geçmişi, tahsilat/makbuzu giren, görevler, notlar) kaybolmaz → **yumuşak silme**: hesap kapatılır, oturumları düşer, listeden kalkar, adı eski kayıtlarda "(silinmiş kullanıcı)" ekiyle kalır; kullanıcı adı yeniden kullanılabilir; *Silinenler*'den geri alınabilir. Kendini ve son yöneticiyi silemez; üzerinde açık görev varsa sorar ("görevler kime devredilsin?"). Onay penceresi. Test: API (sil → giriş 401, geçmişte ad duruyor, son yönetici 400) + e2e.
11. **Kullanıcı adını düzeltme — kalem ikonu** (müşteri yanlış yazmış, düzeltememiş): Ad hücresinin yanında ✎ (sitedeki operatör merkezinde olan mantık: kaleme bas → satır içi kutu → Enter kaydeder, Esc vazgeçer). Görünen ad **ve** kullanıcı adı (giriş adı) düzeltilebilsin; kullanıcı adı değişince çakışma denetimi ve kişiye bildirim. Sunucu görünen adı zaten kabul ediyor (`PATCH /api/admin/users/:id {name}`); kullanıcı adı için `username` alanı eklenir (benzersiz, küçük harf, 3–40). Eski kayıtlardaki ad yeni adla görünür (kimlik `id` ile bağlı). Test: API + e2e.
12. **Ayrıntılı yetkiler ve özel roller** (müşteri): (a) *Yeni kullanıcı* ve satırdaki *Ek yetki* açılır bir pil/pencere olsun; içinde **geniş yetki havuzu**, her birinin yanında onay kutusu (✓). Kaynak: `server/lib/permissions.mjs` `PERMISSIONS` (records.create/edit/delete, notes, phones, payments, liens, documents.upload/manage, cash.view/manage, plans.view/collect/manage, accounts.view/collect/manage, stock.view/move/manage, cheques.view/manage, overview.view, tasks.create/complete, messages, reports.view, audit.view, sources.manage, profile.manage, users.manage, system.manage, license.manage) — Türkçe, gruplu (Kayıtlar, Kasa, Cari, Taksit, Stok, Çek/Senet, Raporlar, Görevler, Yönetim), her birinde kısa açıklama. Bugün yalnız tek ek yetki var (`GRANTABLE`: "ANLIK DURUM ve raporlar"). Rolün verdiği yetkiler işaretli ve kilitli görünür; ek olarak işaretlenenler kişiye özel eklenir; **rolün verdiğini kişiden kaldırma** da (yetki çıkarma) desteklensin. Güvenlik: `users.manage`, `system.manage`, `license.manage` yalnız yöneticiye (havuzda görünür ama personele verilemez ya da açık uyarıyla). (b) **Rol listesine kendi rolünü ekleme**: Rol açılır listesinde "+ Yeni rol" → ad + yetki kutuları → kaydet; roller düzenlenir/silinir (kullanan varsa silinmez). Yerleşik 4 rol (Yönetici, Uzman/sektör adı, Personel, Muhasebe) silinemez. Veri: yeni tablo `roles(id, name, permissions_json, builtin)` + `users.grants_json` genişler (`{add:[], remove:[]}`); `canUser` bunları okur; göç yalnız ekleyici. 7. maddeyle birlikte tasarla (ANLIK DURUM kartı yalnız yönetici — havuzda "ANLIK DURUM kartı" ayrı bir kutu olur, varsayılan yalnız yönetici; müşteri kendi isterse açar). Test: yetki matrisi birim testi (her kutu → ilgili API 200/403), özel rol oluştur → kullanıcıya ver → ekranlar/menüler buna göre, e2e.
13. **Yönetim panelindeki "Dosya takip ekranı" düğmesi → "Ana ekran"** (müşteri, 30.09.2026): Yönetim panelinin üst çubuğundaki geri dönüş düğmesinin adı anlaşılmıyor; sektörden bağımsız **"Ana ekran"** olsun (hukuk dışı ofislerde "dosya" kelimesi de yanlış). Yerler: `client/admin.html:21` (düğme) ve `:166` (yetkisiz sayfasındaki "Dosya takip…" metni). Programın başka yerinde aynı ifade kalmasın (kılavuz ve e2e testlerini de tara; e2e düğmeyi metinle arıyorsa güncelle). İsteğe bağlı: düğmeye ev simgesi.
14. **Ana ekran üst alanı: "Dosya özeti" bilgi bloğu kalksın, ANLIK DURUM kartı ortalansın** (kullanıcı, 30.09.2026, ekran görüntüsü): ANLIK DURUM kartının solundaki başlık + açıklama bloğu ("Dosya özeti / 16 kayıt · 16 kolon · … Arayüz bu tablonun kolonlarına göre yeniden oluşturuldu") kaldırılır — içeriği anlamsız bulunuyor. ANLIK DURUM kartı üst alanda ortalanır (tam genişliğe yakın, dört kutu dengeli). Dikkat: (a) "Dışa aktar" düğmesi bu bloğun altında — kaybolmasın, tablo başlığının araç çubuğuna taşınsın; (b) 7. maddeyle ANLIK DURUM yalnız yöneticide olacak → personel ekranında üst alan boş kalmamalı (üst alan hiç çizilmez, özet kartları yukarı kayar); (c) sektör başlığı ("Dosya özeti"/"Öğrenci özeti" vb.) başka yerde kullanılıyorsa (sayfa başlığı değil) kontrol et; (d) kart küçültülmüş (tek satır şerit) hâlde de ortalı.
15. **Tablo arama kutusu belirgin olsun; üstündeki "N kayıt · N kolon" yazısı kalksın** (kullanıcı, 30.09.2026): ortadaki tablonun arama kutusu ("Esas, karşı taraf veya telefon ara…") zeminle aynı renkte, fark edilmiyor → **dolgulu, hafif pastel yeşil** (sitenin/programın yeşil tonlarından, ör. `--do-accent-soft` zemin, ince yeşil kenar, odakta belirgin halka), yeterli karşıtlık; ⌘K/Ctrl+K ipucu ve "Enter · ilk sonuca git" ipucu okunur kalsın. Tablo başlığının altındaki "16 kayıt · 16 kolon" satırı kaldırılır (kayıt sayısı zaten özet kartında). **Kapsam genişledi (kullanıcı, 30.09.2026): arama kutusu programda var olan HER ekranda aynı tasarımda olsun.** Bugün arama kutuları dağınık: ana tablo (`hof-workspace` / `app-*.js`), Cari (`hof-accounts.js`), Taksitler (`hof-plans.js`), Stok (`hof-stock.js`), Çek/Senet (`hof-cheques.js`), Raporlar (`hof-overview.js` Cari ekstre + Vade takip; `hof-report-center.js` "Rapor ara"; `hof-reports.js` Tablo raporları), Tablodan aktar (`hof-plan-transfer.js`), sektör seçici (`hof-insight.js` `.hof-picker-search`), Mesajlar (`hof-chat.js` `.hof-chat-search`), Yönetim paneli (`admin.html`, varsa). Yapı: tek ortak sınıf (ör. `.hof-search` — dolgulu pastel yeşil zemin, ince yeşil kenar, solda büyüteç simgesi, odak halkası, temizle ✕), her ekran bu sınıfı kullanır; ekran özel stiller kaldırılır. Test: e2e'de her ekranda arama kutusu ekran görüntüsü + hesaplanmış stil (zemin rengi) aynı.
16. **Yönetici parolasını unutursa (kullanıcı isteği, 30.09.2026):** üyeliksiz, ücretsiz, internetsiz çözüm.
    (a) Kurtarma anahtarı: kurulumdan sonra ve Yönetim → Kullanıcılar'da "Kurtarma anahtarını oluştur / yazdır";
    tek seferlik, yalnız özeti (hash) saklanır; giriş ekranında "Yönetici parolamı unuttum" → anahtar + yeni parola;
    kullanılınca yenisi üretilir; 5 hatalı deneme 15 dk kilit, işlem geçmişine yazılır, eski oturumlar kapanır.
    (b) Anahtar da kayıpsa: yalnız sunucu bilgisayarından (localhost) istenir; program veri klasörüne 10 dakika
    geçerli tek seferlik kod yazar (Başlat menüsü kısayolu dosyayı açar); ağdan kullanılamaz. (c) Tavsiye: ikinci
    yönetici hesabı. E-posta/SMS ve destekten uzaktan sıfırlama önerilmedi (üyelik, maliyet, güvenlik).
17. **Yönetim menüsü yalnız yöneticide** (kullanıcı isteği): sol menüdeki "Yönetim" ve /admin paneli yalnız yönetici
    rolüne; işlem geçmişi yetkisi olanlar Raporlar → Tüm raporlar → İşlem geçmişi'nden görür.

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
