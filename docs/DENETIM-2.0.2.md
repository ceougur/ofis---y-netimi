# DestekOfis 2.0.2 — Denetim raporu

Tarih: 27.09.2026 · Kapsam: 2.0.1 yayınından sonra istenen her düzenleme, zor veri muhakemesi, kod geneli güvenlik/tutarlılık taraması ve yaygın programlarla karşılaştırma. Bu rapor teslim paketiyle birlikte verilir; her madde kod, test ya da uçtan uca adımla kanıtlanır.

## 1. Yöntem

| Katman | Ne yapıldı | Sonuç |
| --- | --- | --- |
| Birim testleri | `npm test` — 38 dosya, Node 22 ve Node 24.21 | **432 / 432** geçti (iki sürümde de) |
| Uçtan uca tarayıcı testi | `npm run test:e2e` — gerçek sunucu + Chromium, 43 adım | **43 / 43** geçti |
| Zor veri deneme seti | 17 zor Excel/Sheets düzeni tam yığından (yükle → kaydet → görünüm → analiz → takvim → son tarihler) geçirildi | hepsi doğru okundu (bkz. §3) |
| Program geneli regresyon | Teslimdeki 9 örnek çalışma kitabı (8 sektör örneği + zor düzenler) Excel işçisinin yoluyla (SheetJS → `sheetMatrix`, birleştirme doldurma dâhil) okunup tam yığından geçirildi | **9 / 9** sorunsuz; sektörler, roller ve takvim korundu |
| Ayrıştırıcı fuzz | `test/fuzz-sections.test.mjs`: 850+ tohumlu rastgele düzen (süslenmiş temiz tablolar, başlıksız, çöp, form, yan çevrilmiş) + 50.000 satır süre | 3 zayıflık bulundu ve kapatıldı; artık hepsi geçiyor |
| Kod taraması | 132 API ucunun yetki denetimi, HTML kaçışları, zamanlayıcılar, önbellek anahtarları, süreç hataları, sınırlar | 1 eksik bulundu ve kapatıldı (§4) |
| Güncelleme provası | 2.0.1, 2.0.0 ve 1.7.0 kurulumlarından 2.0.2'ye güncelleme; şema 6'ya geçiş, yedek | geçti |

## 2. İstek istek doğrulama (2.0.1 sonrası)

"Program geneli" sütunu, düzenlemenin yalnız örnek dosyada değil her veri kaynağında (Excel, Google Sheets, serbest sayfa, elle girilen kayıt) ve her sektörde geçerli olduğunu nerede sağladığımızı söyler.

| # | İstek | Nerede / nasıl | Program geneli | Kanıt |
| --- | --- | --- | --- | --- |
| 27 | Sol menüden *Çalışma alanı, Dinamik görünüm, Tüm kayıtlar, Bu ay, Veri kaynağı* kalksın; menü kaydırılabilir | Paket yaması `sade-menu` (`tools/patch-bundle.mjs`), `hof-ui.css` | Menü tek yerde çizilir; her kullanıcı ve sektörde aynı | e2e "yönetici giriş yapar…" menü denetimi |
| 28 | Tahsilat takvimi: boş şablon satırları ve başlangıç öncesi aylar borç değil; ay kolonlarının yılı sıradan | `server/lib/insight/dues.mjs` (`monthColumns`, `startOf`) | Takvim motoru tüm sekmeler ve sektörler için tektir | `test/dues.test.mjs` (boş satır, başlangıç ayı, yıl sırası) |
| 29 | Kasa'da *Aralık* → *Tarih aralığı*; göstergelerde dönem | `hof-cash.js` | Kasa oturumdan bağımsız, tek modül | e2e okul servisi adımı (kasa PDF) |
| 30 | Silinenler: yönetim panelinden geri yükleme | Göç 6 `deleted_items`, `server/lib/trash.mjs`, `routes/trash.mjs`, `admin.js` | Kayıt, sekme, belge, serbest sayfa/satır/kolon, tahsilat, kasa — her silme yolu `trash.add` çağırır | `test/trash.test.mjs`, `test/migrations.test.mjs` |
| 31 | Test, belge, kılavuz, 2.0.2 paket, kurulum, prova | `tools/release.mjs`, `build:windows`, prova betiği | — | §1 tablosu, §6 |
| 32 | Sekme pilleri kalemle yeniden adlandırılır ve silinir | `hof-tabs.js`, `dataset.tabs.alias/hidden` | Excel ve Sheets sekmeleri; eşitleme asıl adla çalışır | `test/dataset.test.mjs` (alias/hidden), `test/trash.test.mjs` |
| 33 | Belge silme görünür ve kolay | `hof-documents.js` (liste, görüntüleyici, kart) + geri al | Belgeler kayıt düzeyindedir; her sektörde aynı kart | `test/documents.test.mjs`, e2e "belge eklenir ve önizlenir" |
| 34 | Şeritteki *N kayıt · toplam M* kalksın; Operasyon'da sabit *Yeni kayıt* | Paket yamaları `tablo-alt-basligi`, `yeni-kayit-sabit` | Tek şerit bileşeni | e2e "yeni kayıt açık sekmenin kolonlarıyla…" |
| 35 | Tarih anlamı sınıflandırıcısı (tüm program); zilde ✕ | `server/lib/insight/temporal.mjs` → `analyzeColumn` (`meaning`), `dues.mjs` son tarihler, `hof-alerts.js` | Her tarih kolonu analizden geçer; uyarı üretimi tek yerdedir | `test/temporal.test.mjs`, `test/dues.test.mjs` |
| 36 | Kullanıcı kendi sektörünü oluşturabilsin | `server/lib/custom-sectors.mjs`, uçlar `/api/workspace/sectors/custom`, `hof-insight.js` (seçici, analiz ekranı, Ayarlar) | Sınıflandırıcı (`classifySector({extra})`) özel sektörleri yerleşiklerle birlikte değerlendirir; profil parmak izi değişince analiz yenilenir | `test/custom-sectors.test.mjs` (5), e2e "…kendi sektörü oluşturulur" |
| 37 | Sohbet: son 1 gün; *daha eski* gün gün; 1 aydan eskiler diske arşivlenip silinir | `server/lib/chat.mjs` (`messagesByDay`), `chat-archive.mjs`, `app.mjs` zamanlayıcı | Tüm yazışmalar (ofis geneli ve özel) aynı döngüden geçer | `test/chat-archive.test.mjs` (4), `test/chat.test.mjs` |
| 38 | Excel/Sheets açılır listeleri **ve** birleşik giriş kutuları programda açılır liste | `server/lib/choices.mjs` (veri doğrulama, x14, tanımlı ad, Form denetimi, ActiveX, VML), `hof-excel-worker.js`, `hof-choices.js` | Excel: işçi; Sheets: xlsx kopyası; listeler kolona bağlanır ve detay kartı, hücre düzenleme, *Düzenle*, *Yeni kayıt* formlarında aynı `HOF.choiceField` kullanılır | `test/choices.test.mjs` (13), e2e "Excel açılır listeleri tarayıcıda okunur…" |
| 39 | Belgeler: adet sınırı yok; yan yana kart; her biri kendi biçiminde; seçilenler zip; doğrudan yazdırma | `routes/documents.mjs` (`/archive`), `hof-documents.js` (`gallery`, `printDocuments`) | Kayıt düzeyinde; sektörden bağımsız | `test/documents.test.mjs` (31 belge zip), e2e (zip içeriği okunur) |
| 40 | Uyarıda *Gerçekleştirildi*: hücreye yazılır, uyarı tekrarlanmaz; 20 sn; 10 sn ara; üst üste binmez | `hof-alerts.js` (`markDone`, `SHOW_MS`, `GAP_MS`, `--hof-notice-space`), `dues.mjs` (`SETTLED`, `DONE_STATE`) | Kalem türüne göre (son tarih, aylık, tekrarlayan gün, görev) tek işlev; kuyruk tek | `test/dues.test.mjs` "bildirimde Gerçekleştirildi", e2e 20000 ms denetimi |
| 41 | Kullanım kılavuzu sadeleşsin | `docs/kilavuz/…html` → 8 sayfa PDF, 2.0.2 ekran görüntüleri | — | `client/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf` (8 sayfa) |
| 42 | Ana tabloda tüm dolu kolonlar + güzel yatay kaydırma; serbest sayfada kolon sayısı serbest | Paket yamaları `tum-kolonlar-*`, `hof-grid.js` (genişlik, yapışkan ilk kolon, sürüklenebilir çubuk), `free-sheets.mjs` (500 kolon / 250.000 hücre) | React tablosu tek bileşendir; tüm sekmeler ve kaynaklar | e2e "8 kolon" denetimi, `test/free.test.mjs` sınırlar |

Ek olarak bu turda istenen kapsamlı denetim (bkz. §3–§5) yapılmış, bulunan her eksik kapatılmıştır.

## 3. Zor veri denetimi

Excel/Sheets kullanıcılarının gerçekte gönderdiği düzenler tek tek denendi. "Beklenen" sütunu, uzman bir kullanıcının o dosyaya bakınca ne anlayacağıdır.

| Durum | Beklenen | Sonuç |
| --- | --- | --- |
| İki satırlı gruplu başlık (üstte "Kişi bilgileri / Ödeme", altta asıl başlıklar) | Asıl başlıklar alt satırdan; boş alt başlık grup adını alır | ✔ `No · Ad Soyad · Telefon · Tutar · Vade`; takvim Ali Veli gecikmiş, Ayşe Kaya yaklaşan |
| Başlık üstünde açıklama satırları, altta TOPLAM ve dipnot | Açıklamalar başlık değil; toplam ve dipnot kayıt değil | ✔ 2 kayıt; toplam satırı kimlik/KPI/takvime girmez |
| Yan yana iki tablo aynı sayfada | İki ayrı bölüm | ✔ `Sayfa1 › Öğrenci`, `Sayfa1 › Şoför`; Şoför kolonu kişi |
| Kirli başlıklar (NBSP, satır sonu, yinelenen "Tutar", boşluklar) | Temizlenir, yinelenen "(2)" alır | ✔ `Müvekkil Adı`, `Tutar (2)`, `Tarih` |
| Karışık tarih yazımları (`2026-09-29`, `10 Mart 2027`, `Mart 2027`, `5.3.24`, `05/03/2024`, `31.02.2026`, `2024-13-01`) | Geçerliler okunur, geçersizler tarih sayılmaz | ✔ bitiş kolonu son tarih; kayıt tarihi olay |
| Tutar yazımları (`1,500.00`, `1.500,00 TL`, `(250)`, `TL 300`, `#DIV/0!`, `%12,5`) | Hata değerleri boş; karışık ABD/TR yazım kesin sayılmaz | ✔ Ödenen tutar; karışık kolonlar metin kalır (tasarım gereği yanlış toplam vermektense susar) |
| Tablo C5'ten başlıyor (üst ve sol boş) | Aynen okunur | ✔ Plaka, Muayene bitiş (-5 g), Sigorta bitiş |
| Grup satırları ("Şube: Merkez") ve ara toplamlar | Grup satırı kayıt değil; toplamlar kayıt sayılmaz | ✔ `Sıra` sıra numarası, `Cari` kurum, takvim 2 kalem |
| Evet/Hayır, ✓ / X işaretleri, kontrol ve randevu tarihleri | Yapıldı işareti uyarıyı susturur | ✔ Randevu yaklaşan 2 kayıt |
| Ay kolonu yazımları (`Eyl.26`, `Ekim'26`, `2026-11`, `12/2026`) | Ay kolonu olarak takvime girer | ✔ Efe Eylül ödemesi 3.000 |
| Sayfa sonunda yinelenen başlık, kimliği boş satır, yalnız not satırı | Yinelenen başlık atlanır; not kayıt değil | ✔ 3 kayıt |
| 40 kolonluk seyrek sayfa | Boş kolonlar gösterilmez | ✔ 7 dolu kolon |
| İngilizce başlıklar ve ABD tarih/tutar (`Due date 03/25/2027`, `$1,250.00`) | Tanınır | ✔ Client kişi, Due date son tarih, Amount tutar |
| Fatura listesi (Invoice No, Customer, Amount, Due Date, Status, Notes) | Takvim ve durum çalışır | ✔ Acme Ltd gecikmiş 1.250; Paid kapalı |
| Üç satırlı üst yapı (başlık + grup + asıl başlık) ve dikey birleştirilmiş müvekkil | Kayıtlar kişisiz kalmaz | ✔ Ali Veli iki dosya, Ayşe Kaya bir dosya; takvim doğru |
| Aynı kolonda `1.250,00 TL`, `₺980`, `2.300 TL`, `1.100` ve araya giren boş satırlar | Tutar; boş satırlar atlanır | ✔ 4 kayıt, takvim 2 kalem |
| Tek kolonluk liste, tamamen boş sekme, ilk satırda uzak not | Liste kişi; boş sekme yok sayılır; not tabloyu bozmaz | ✔ |
| Başlıksız tablo (ilk satır da kayıt) | Kolon adları içerikten; 3 kayıt | ✔ `Ad Soyad · Telefon · Tarih · Tutar`; 3 kayıt |
| Yan çevrilmiş sayfa (alanlar aşağı, kayıtlar sağa) | Çevrilerek 3 kayıt | ✔ takvim Ayşe Kaya gecikmiş, Ali Veli yaklaşan |
| Form (Ad Soyad: / Telefon: / Dosya No / Vade / Tutar) | Tek kayıt | ✔ takvim 1 kalem |
| İki satıra bölünmüş başlık ("Dosya"+"No", "Ödeme"+"Tarihi") | Birleşik başlık | ✔ `Dosya No · Müvekkil Adı · Ödeme Tarihi · Sözleşme Bitiş` |
| Excel'in sayıya çevirdiği telefon (5.32E+09), yıl başlıkları (2025, 2026) | Telefon rolü + uyarı; yıl kolonları yerinde | ✔ `Veli Telefon:phone`, kolon sırası `Öğrenci · Veli Telefon · 2025. · 2026.` |

İyileştirmelerin tamamı ortak motordadır; Excel yükleme (tarayıcı işçisi), Google Sheets eşitleme, serbest sayfa ve elle girilen kayıtlar aynı ayrıştırıcı, kolon tanıma ve takvim kodundan geçer. Bunu göstermek için teslimdeki dokuz örnek çalışma kitabı da aynı yoldan koşuldu (`4-denetim/ornek-dosyalar-tam-yigin-sonuc.txt`): finans-tahsilat, e-ticaret, emlak, icra (iki sekme), kişi rehberi, klinik, oto galeri ve zor düzenler; sektör önerileri, kolon rolleri ve takvim kalemleri beklendiği gibi.

Fuzz sınamasının bulduğu ve kapatılan zayıflıklar: (1) yalnız ilk hücresi dolu seyrek kayıt ("Can Er") başlık, ardından gelen metin satırı yeni kolon başlığı sanılıyordu — artık yeni başlık en az iki başlık kelimesi ister; (2) "Deniz Ay" gibi bir ad, "ay" kelimesi yüzünden başlık sayılıyordu — şekil tanımada güçlü başlık kelimesi kuralı; (3) iki kolonlu küçük tablo form sanılabiliyordu — form etiketleri veri görünümlü olamaz, toplam satırları sayılmaz.

Bu turda yapılan muhakeme iyileştirmeleri: gruplu başlık, uzak not, dipnot/toplam ayrımı, yan yana tablolar, birleştirilmiş hücreler (Excel `!merges`, Sheets `mergeCells`), hata değerleri, küçük tablolarda tür, ay adı/ABD sırası tarihler, ay kolonu kısaltmaları, tek vadeli tutar, "Şoför/Avukat" tek kelimelik adlar, İngilizce başlık ve ödeme/kapanış sözcükleri, yan yana tabloda formül bağlama. Hepsi birim testine bağlandı (`test/sections.test.mjs`, `columns.test.mjs`, `dues.test.mjs`, `choices.test.mjs`, `excel-format.test.mjs`).

## 4. Kod denetimi

### Bulunan ve düzeltilenler

| Bulgu | Etki | Düzeltme |
| --- | --- | --- |
| Tek hücreli grup satırı "uzak not" kuralına takılıp atılıyordu | Gruplu başlıkta grup adı kayboluyordu ("Kolon 2") | `groupedHeader` uzak nottan önce denenir (`sections.mjs`) |
| Yan yana tablolarda formül bağlayıcı satırdaki ilk kaydı alıyordu | Sağdaki tablonun formülü yanlış kayda bağlanabilirdi | Kolonu taşıyan kayıt seçilir (`formula/bind.mjs`) |
| Toplam satırları kimlik, KPI ve kolon tanımaya giriyordu | "Sıra" kolonu metin oluyor, toplamlar KPI'ya ekleniyordu | `isTotalRow` dışlaması (`dataset-identity`, `kpi`, `analyze`) |
| Excel hata değerleri (`#DIV/0!`) kolon türünü bozuyordu | Tutar kolonu metin olabiliyordu | `isErrorValue` boş sayılır |
| Sunucu sürecinde `unhandledRejection` / `uncaughtException` yakalayıcısı yoktu | Beklenmedik bir hata sunucuyu sessizce düşürebilirdi | Günlüğe yazılır; istisnada düzgün kapanıp servis yöneticisi yeniden başlatır (`server/server.mjs`) |
| Gizli liste sayfası sayımı önbellekteki satırlardan yapılıyordu | Yeni yüklemede gizli sayfa bazen gizlenmiyordu | Sayım yeni girişlerden (`dataset.mjs`) |
| Türkçe harfli dosya adı eski tarayıcılarda "download" oluyordu | İndirme adı bozuluyordu | `ASCII_TR` karşılıkları (`http.mjs`) |

### Doğrulanıp uygun bulunanlar

- **Yetki:** 132 API ucunun tamamı `requireUser` / `requirePermission` ya da yetkiyi içeren yardımcıdan (`editablePayment`, `chat.access`) geçer. Yeni uçlar: belge arşivi (giriş + kayıt), özel sektör (`profile.manage`), sohbet arşivi (yazışmaya erişim; yönetim bilgisi `users.manage`).
- **CSRF / girdi:** değiştiren istekler yalnız JSON kabul eder, `Origin` aynı site olmalı; dosya yükleme özel başlık ister; gövde sınırları (1 MB JSON, 25 MB belge, 1 GB arşiv). Özel sektör alan uzunlukları ve adet sınırları (`CUSTOM_LIMITS`), serbest sayfa (`FREE_LIMITS`), liste (`CHOICE_LIMITS`), birleştirme (50.000 alan) sınırlıdır.
- **HTML kaçışı:** yeni istemci modüllerinde (`hof-choices`, `hof-documents`, `hof-alerts`, `hof-insight`, `hof-chat`, `hof-grid`, `hof-free`, `hof-tabs`, `hof-trash`) kullanıcı verisi taşıyan her `innerHTML` `esc()`'ten geçer; CSP `script-src 'self'`, satır içi betik yok (e2e son adımı konsol ve CSP ihlali olmadığını doğrular).
- **Kaynak sızıntısı:** sunucu zamanlayıcıları (`sessionTimer`, sohbet arşivi, lisans) `unref` ve `close()`'da temizlenir; belge kartındaki `IntersectionObserver` kapanışta `disconnect`; istemci `setInterval`'ları uygulama ömrü boyunca tek örnektir.
- **Önbellek tutarlılığı:** analiz parmak izi (`profile.fingerprint`) veri, düzeltme, silinen sayısı, etiket, gün, serbest sayfa ve özel sektörleri; takvim önbelleği bunlara ek olarak tahsilat, kapatılan kalem ve sekme durumunu içerir. Liste sonuçları oturum ayarında durur; kaynak kaldırılınca silinir.
- **Yarış durumları:** sohbet arşivi önce dosyaya yazar (geçici dosya + yeniden adlandırma), sonra siler; yarıda kalan tur aynı mesajı ikinci kez yazmaz. Analiz aynı parmak iziyle eşzamanlı istenirse tek hesap paylaşılır.
- **Yama güvenliği:** paket yamalarının her biri tam bir kez eşleşmek zorundadır; eşleşmezse derleme durur (`patch-bundle.mjs`).
- **Zip:** okuyucu zip-slip ve CRC denetimi yapar (`test/zip.test.mjs`).

## 5. Excel / Sheets ve yaygın programlarla karşılaştırma

| Program | Ne yapıyor | DestekOfis'te |
| --- | --- | --- |
| Excel — veri doğrulama listeleri, birleşik giriş kutuları | Hücrede açılır liste | Aynı listeler kolona bağlanır; ▾ pil ve formlar (§2 #38) |
| Excel / Sheets — bölmeleri dondur | İlk kolon sabit | Ana tabloda ilk kolon yapışkan; yatay çubuk ekrana yapışık (§2 #42) |
| Power Query — "Fill Down" | Birleştirilmiş hücre boşlukları doldurulur | Dikey birleştirmeler kendiliğinden doldurulur (§3) |
| Excel Tablo — toplam satırı | Toplam satırı veriden ayrıdır | Toplam/ara toplam satırları kayıt sayılmaz, formül toplamları korunur |
| Excel — hata değerleri | `#SAYI/0!` sayı değildir | Boş sayılır, toplama girmez |
| Sheets/Excel — ay başlıklı ödeme çizelgeleri | `Eyl.26`, `2026-11` | Ay kolonu tanınır, takvime girer |
| Airtable / Notion — galeri görünümü | Ekler yan yana | Belge kartı 1–4 sütun, seçip zip, doğrudan yazdırma |
| İşletim sistemi bildirim merkezi | Bildirimler sırayla, üst üste binmez | 20 sn / 10 sn ara kuyruğu; pencere açıkken bekler |
| Slack / WhatsApp — dışa aktarma | Yazışma dosyası | Aylık düz metin arşiv, kişi kendi yazışmasını indirir |
| CRM'ler (HubSpot, Pipedrive) — "İngilizce şablon" içe alma | Başlık eşleştirme | İngilizce başlık eş anlamlıları kendiliğinden tanınır |

Bu turda programa alınanlar (UI): durum/kategori renkleri (Airtable/monday) ve sık/rahat satır görünümü (Excel/Sheets/Airtable) — `client/assets/hof-chips.js`; uçtan uca testte doğrulanır. Ayrıntılı UI/UX değerlendirmesi ve ileriye dönük adımlar `docs/YOL-HARITASI-2.1.md`'dedir.

Bilerek alınmayanlar: pivot tablo ve koşullu biçimlendirme içe alma (görünüm programındır), OCR ile taranmış belge okuma, hesaplanan listeler (`DOLAYLI`) ve kodla doldurulan kutular (Excel dışında da çözülemez).

## 5b. Bu turda eklenen mimari katmanlar (Airtable / Notion / ERP felsefesi)

| İstek | Yapılan | Kanıt |
| --- | --- | --- |
| Derin anlamsal normalizasyon | Kolon kararı başlık + değer karakteristiği + çapraz kolon ilişkisi; her kolon için kanıt listesi ve kesinlik ("Neden?") | `test/columns.test.mjs`, `test/analysis-worker.test.mjs` (Vade → kesin), analiz penceresi |
| Kendi kendini iyileştirme | Bozuk Türkçe karakter, görünmez boşluk, yer tutucu onarımı; kaymış satır tespiti; bilimsel gösterim uyarısı; okuma raporu | `test/heal.test.mjs`, `test/fixes.test.mjs`, harness `bilimsel-telefon` |
| Yerel performans | Analiz ayrı iş parçacığında, zaman aşımı ve çökmede ana iş parçacığına düşüş; takvim parmak izi önbelleği; olay tabanlı yenileme | `test/analysis-worker.test.mjs` (olay döngüsü akar), `test/alerts.test.mjs` |
| Şemaya esnek uyum | Kolon eşleme (ad benzerliği, yazım farkı, değer örtüşmesi); düzeltme/ad/liste/satır taşıma | `test/schema-map.test.mjs`, `test/schema-flex.test.mjs` |
| Veri Sağlık Kontrolü | Kırmızı hücreler, nokta atışı neden; toplu düzeltme ve 15 dk geri alma | `test/fixes.test.mjs`, `test/schema-flex.test.mjs`, e2e veri sağlığı adımı |
| Olay tabanlı uyarı akışı | Gün dönümü olayı, veri değişikliği olayı, görünürlük yenilemesi, 30 dk yedek anket | `test/alerts.test.mjs`, `hof-alerts.js` |
| Ön izleme ve eşleme | Veri yazılmadan önce kolon rolleri + kesinlik + sarı şüpheliler; kullanıcı rol seçer; roller analiz/KPI/takvime uygulanır | `test/columns.test.mjs` (forced), `test/dues.test.mjs` (forced), `test/schema-flex.test.mjs` (ön izleme), e2e ilk yükleme adımları |
| Hata toleransı | Kaymış / çoğu geçersiz satırlar "⚠ İşaretlenen hatalar" sekmesinde; takvim/KPI dışı; "Sorun yok" | `test/schema-flex.test.mjs` (işaretleme, unflag) |
| Veri temizleme | Excel seri tarihleri (45000) tanınır, toplu düzeltmeyle tarihe çevrilir; hata değerleri boş; bozuk Türkçe/boşluk onarımı | `test/fixes.test.mjs`, `test/heal.test.mjs` |
| Ekip çakışma önleme | Aşama anlık görüntüsü (409 STALE_STAGE), değer tabanlı iyimser kilit (409 CONFLICT) + "Üzerine yaz", SQLite WAL, olayla yayılım | `test/schema-flex.test.mjs` (çakışma), `hof-table.js` |

## 6. Bilinen sınırlar

- Aynı kolonda hem `1.500` (bin beş yüz) hem `1,500.00` yazımı varsa kolon **metin** kalır: iki yazım birbirine karşıt olduğu için yanlış toplam vermektense susulur. Kullanıcı kolonu Excel'de tek yazıma çevirdiğinde tutar olur.
- Google Sheets'te birleştirilmiş hücreler ve listeler xlsx kopyasından okunur; Sheet "görüntüleyen" izniyle paylaşılmamışsa değerler yine gelir, bu ikisi gelmez (ekranda uyarı yazar).
- Yatay birleştirilmiş veri hücreleri (aynı satırda birden çok kolona yayılmış değer) ilk kolonda kalır; başlık satırlarında bu istenen davranıştır.

## 7. Teslim

- `destekofis-guncelleme-2.0.2.zip` + `.json` (imzalı, anahtar `destekofis-2026-1`), `DestekOfis-Kurulum-2.0.2.exe`, `SHA256SUMS`, `SURUM-NOTLARI.md`.
- Kaynak: dal `claude/nice-euler-jvajxv` (yerel; GitHub'a yükleme kullanıcı onayıyla).
- Gizli anahtarlar hiçbir pakette yoktur.
