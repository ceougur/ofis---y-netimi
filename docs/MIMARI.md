# DestekOfis — Mimari (v2.0)

## Genel bakış

```
Tarayıcı (Chrome/Edge)                         Sunucu bilgisayarı
┌──────────────────────────────┐   HTTP    ┌────────────────────────────────────┐
│ app-<özet>.js  (React paketi) │ ───────► │ server/app.mjs  (node:http)         │
│ hof-*.js       (eklentiler)   │  /api/*  │  ├─ routes/  auth · admin · insight · │
│ admin.html     (yönetim)      │ ◄─────── │  │           workspace · trpc        │
└──────────────────────────────┘   JSON    │  ├─ lib/     auth · izinler · kaynak │
                                            │  │           birleştirme · yedek ·    │
                                            │  │           göç · profil · insight/ │
                                            │  └─ data/destekofis.sqlite (WAL)      │
                                            └────────────────────────────────────┘
```

- **Sunucu** dış bağımlılık kullanmaz (Node 22+ yerleşik `node:http`, `node:sqlite`, `node:zlib`, `node:crypto`). Bu, kurulumu ve ileride otomatik güncellemeyi basitleştirir.
- **Veritabanına** yalnızca sunucu süreci erişir; istemciler HTTP API kullanır.
- **Adlandırma (v1.6):** ürün sektörden bağımsızdır. Yeni kurulumlar `C:\DestekOfis` klasörüne, veritabanı `data\destekofis.sqlite` adıyla kurulur. Eski kurulumlar yerinde kalır: Inno Setup `UsePreviousAppDir` ile önceki klasörü (`C:\HukukOfisiMerkezi`) kullanır, `server/lib/db-path.mjs` (`resolveDbPath`) yeni ad yoksa eski `hukuk-ofisi.sqlite`'ı seçer (uygulama, servis yöneticisi ve yedek aracı her kullanımda aynı çözümlemeyi yapar; dosya taşınmaz). Uyumluluk için değişmeyenler: keşif iletisi `HukukOfisiServerNerede`, `HUKUK_*` ortam değişkenleri, tarayıcıdaki `hukuk-ofisi-*` anahtarları ve `packaging/windows/bootstrap.mjs`.

## Windows dağıtımı (v1.2)

```
nssm (Windows servisi "DestekOfis", NT SERVICE\DestekOfis, otomatik başlatma)
 └─ runtime\node.exe bootstrap.mjs            ← kurulum kökünde sabit; app\current.json'daki sürümü seçer
     └─ app\<sürüm>\server\supervisor.mjs      ← servis yöneticisi (aynı süreç)
         ├─ HTTP kapısı :5123 ──proxy──► 127.0.0.1:<boş port>  app\<sürüm>\server\server.mjs (alt süreç, IPC)
         ├─ UDP keşif   :5123  "HukukOfisiServerNerede" → JSON {address, port, url, name, instanceId, version, state}
         └─ bakım sayfası (503 + Retry-After): başlatılıyor · yeniden başlatılıyor · güncelleniyor · başlatılamadı
```

- **Servis yöneticisi** uygulamayı alt süreç olarak çalıştırır. Uygulama hazır olana kadar (ve çökme/yeniden başlatma sırasında) istemcilere kendiliğinden yenilenen markalı bir bakım sayfası, `/api/*` isteklerine `503 MAINTENANCE` JSON'u döner; arayüz bunu görünce bakım katmanını gösterip sağlık ucunu yoklar. Çökmeler artan beklemeyle (1–30 sn) yeniden başlatılır; 5 dakikada 5 çökmede "başlatılamadı" durumuna geçilir. Alt süreç IPC kanalı koparsa kendini kapatır (öksüz süreç kalmaz).
- Uygulama yalnızca `127.0.0.1`'i dinler; gerçek istemci IP'si `x-forwarded-for` ile iletilir ve yalnızca servis yöneticisi altında (`HUKUK_TRUST_PROXY=1`) dikkate alınır. Varsayılan parolayla ilk giriş yalnızca sunucunun kendisinden yapılabilir.
- **Keşif protokolü:** istemci UDP 5123'e yayın (broadcast) olarak `HukukOfisiServerNerede` gönderir; sunucu, isteğin geldiği alt ağdaki kendi IP'siyle yanıt verir. Saniyede en fazla 5 yanıt, 512 bayttan büyük veya tanınmayan paketler yok sayılır.
- **Başlatıcı** (`launcher/`, Go, yalnızca standart kütüphane, `-H=windowsgui`): kayıtlı adres → bu bilgisayar → UDP keşif (kayıtlı kurulum kimliği öncelikli) → bilgisayar adı sırasıyla sunucuyu bulur, `%APPDATA%\DestekOfis\istemci.json`'a kaydeder ve Edge/Chrome'u `--app` penceresinde açar.
- **Kurulum** (`packaging/windows/setup.iss`, Inno Setup 6): sunucu/personel türleri (sihirbaz, başlatıcıyı geçici klasöre çıkarıp `-kesfet-dosya` ile ağda sunucu arar; bulursa *Personel bilgisayarı*nı önceden seçer, *Sunucu* seçilirse onay ister; bu bilgisayarda zaten sunucu kuruluysa tarama yapmaz); gömülü Node.js (Authenticode/özet doğrulamalı) ve nssm; `bin\servis-kur.cmd` servisi kurar, eski v1.0 zamanlanmış görevini ve eski güvenlik duvarı kuralını temizler, izinleri SID ile ayarlar (kök: yöneticiler; `data/backups/logs/config`: yalnızca SYSTEM, yöneticiler ve servis hesabı; `app`: servis hesabına yazma — Faz 2 güncellemeleri için), güvenlik duvarına yalnızca `node.exe` ve Özel/Etki alanı profilleri için izin verir ve sağlık kontrolüyle bitirir. Kaldırma veriyi korur.
- **Sürümlü uygulama klasörleri** (`app\<sürüm>`): bootstrap etkin sürüm açılamazsa kurulu diğer sürümlere döner ve `current.json`'ı düzeltir. Faz 2'deki otomatik güncelleme bu düzen üzerine kuruludur.
- `NODE_OPTIONS=--use-system-ca`: SSL denetimi yapan antivirüs/güvenlik duvarı olan ağlarda Windows sertifika deposuna güvenilir.

## Otomatik güncelleme (v1.3)

```
servis açılışı ─► uygulama hemen başlar (eski sürüm)
             └─► GitHub Releases: /repos/ceougur/ofis---y-netimi/releases (ağ yoksa 1, 3, 10, 20. dakikada yeniden)
                   en yeni uygun etiket ─► destekofis-guncelleme.json ─► Ed25519 imza + etiket/sürüm + uyumluluk
                   ─► paket indirilir (uygulama çalışırken; boyut + SHA-256) ─► app\.<sürüm>-xxxx.tmp ─► app\<sürüm>
bakım penceresi ("Sistem güncelleniyor…"):
   eski sürüm durdurulur ─► VACUUM INTO yedek ─► current.json {version: yeni, previous, pending: true}
   ─► yeni sürüm deneme kipinde (çökerse yeniden başlatılmaz, "hazır" olsa da bakım sayfası kalır)
   ─► /api/health (sürüm eşleşmeli) + arayüz ─► onay: pending kaldırılır, eski sürümler temizlenir (etkin + önceki kalır)
                                             └► başarısız: şema değiştiyse yedeğe dön, current.json = önceki, sürüm "başarısız" listesine
```

- Modüller: `server/lib/updater.mjs` (kaynak, denetim, indirme, paket açma, durum dosyası), `update-envelope.mjs` (bildirge biçimi, imza, uyumluluk), `update-orchestrator.mjs` (akış, deneme/onay/geri dönüş, yeniden denemeler), `app-layout.mjs` (`current.json`, sürüm klasörleri), `supervisor-link.mjs` (uygulama → servis yöneticisi IPC istekleri).
- **Kaynak:** varsayılan `github:ceougur/ofis---y-netimi`; `config\guncelleme.json` içindeki `feed` alanı imzalı bir bildirge adresine (ör. ileride destekofis.net) yönlendirilebilir. İmza zorunlu olduğundan kaynak değişikliği güveni zayıflatmaz. `enabled` ve `channel` (stable/beta) aynı dosyadadır; yönetim paneli değiştirir.
- **Durum:** `app\update-state.json` (son denetim, başarısız sürümler, son 30 olay). Servis hesabı yalnızca `app` (ve veri) klasörlerine yazabildiğinden güncelleme `runtime\node.exe`, `bootstrap.mjs` ve servis ayarlarına dokunamaz.
- **Gereksinimler:** bildirgedeki `requires.node`, `requires.bootstrap` (bootstrap.mjs `BOOTSTRAP_VERSION`, ortamda `HUKUK_BOOTSTRAP_VERSION`) ve `requires.minVersion` karşılanmıyorsa sürüm otomatik kurulmaz, panel kurulum dosyasını önerir.
- **Servis yöneticisi sürümü:** yeni sürümün uygulama süreci hemen çalışır; yeni servis yöneticisi kodu bir sonraki servis açılışında devreye girer (IPC protokolü geriye uyumlu tutulur). Bootstrap, açılamayan bir sürümden önceki sürüme dönerse `current.json`'a `fallbackFrom` yazar; o sürüm başarısız sayılır.
- **Kurulum dosyası ile birlikte:** kurulum sonunda `bootstrap.mjs etkinlestir <sürüm>` çalışır; yalnızca kurulan sürüm etkin sürümden yeni veya aynıysa etkinleştirir.
- **Yayın:** `tools/release.mjs` (imzalı paket), `.github/workflows/release.yml` (etiket → test → Windows kurulum testi → yayın). Ayrıntılar: [SURUM-YAYIMLAMA.md](SURUM-YAYIMLAMA.md).

## İstemci katmanları

Arayüzün ana gövdesi Manus/Vite çıkışı derlenmiş bir React paketidir (kaynak kodu yok). Üzerine eklenen katmanlar:

| Dosya | Görev |
|---|---|
| `hof-core.js` | API, bildirim, erişilebilir pencere, form, tek toplu DOM izleyici, dosya kimliği çözümleme |
| `hof-auth.js` | Giriş ekranı, parola değişimi, çıkış (uygulama + yönetim) |
| `hof-boot.js` | Açılış sırası: oturum → ofis ayarları + merkezi notlar → depo köprüsü → React paketini yükleme; 60 sn'de bir eşitleme |
| `hof-live.js` | Canlı bağlantı (`EventSource /api/events`): olayları `live:*` HOF olaylarına çevirir; bakım/oturum sonu sonrası artan beklemeyle yeniden bağlanır; sayfa 1 dk'dan uzun arka plandaysa bağlantıyı kapatır, dönünce eşitler |
| `hof-workspace.js` | Operasyon kartı (v2.0.1: köşedeki kalemle başlık ve düğme adları, `PUT /api/workspace/labels/batch`), kullanıcı kartı, dosya işlemleri, işlem geçmişi (eskiden yeniye; tahsilat düzelt/sil; canlı yenilenir), görevler, rapor, haciz uyarıları, **Kasa** penceresi |
| `hof-chat.js` | Sohbet paneli: ofis kanalı + özel yazışmalar, okunmamış rozeti/sekme başlığı, okundu bilgisi, bildirim ve ses, dosya numarası bağlantısı |
| `hof-table.js` | Yüzen düzenle/sil düğmeleri, geri alınabilir silme, yeni kayıt, sayfalama (20 satır; 1…6 penceresi; sekme/arama değişince ilk sayfa) |
| `hof-sections.js` | "Sekme › Bölüm" etiketli kategorileri gruplar: React'in düğmelerini gizleyip sekme + alt tablo şeridi gösterir, tıklamaları gizli React düğmelerine aktarır |
| `hof-sources.js` | Veri yokken "başlayalım" kartı, Ayarlar → Veri penceresi (Excel/Sheets içeri alma, yeni oturum/devamı/yerine seçimi, eşitleme, geçmiş, Sheet'te olmayanlar, kaldırma), paketin yükleme girişlerini yönlendirme, yetkiye göre menü gizleme |
| `hof-sessions.js` | Veri oturumları (v2.0.1): kenar çubuğundaki oturum seçici (liste, geçiş, kalemle ad değiştirme, yeni oturum), Ayarlar → Veri → Oturumlar (ad, silme), `workspace.changed {kind: "sessions"}` ile tazeleme; çalışılan oturum silinirse sayfayı ilk oturumla yeniden açar |
| `hof-insight.js` | Ofis profili (sektörün kelime dağarcığı, rol adları, modüller), "Verinizi tanıyoruz" analiz ekranı, aranabilir sektör seçici, akıllı özet kartları, veri sağlığı raporu, "Bu ay", kalemle başlık düzenleme (metin düğümü üzerinden, React yeniden çizince yeniden uygulanır), Ayarlar → Sektör ve görünüm |
| `hof-license.js` | Lisans şeridi (deneme kalan günü yalnızca yöneticiye; uyarı ve salt okunur durum herkese), salt okunur açıklama penceresi (açılışta ve 403 `LICENSE_READ_ONLY` yanıtında), `live:license.changed` ile tazeleme |
| `hof-free.js` | Serbest sayfalar (v2.0.1): sekme şeridindeki "+ Sayfa", serbest sekmede tablonun yerine Excel benzeri ızgara (klavye, geçince kaydetme, formül çubuğu ve öneriler, tıklayarak başvuru, aralık seçimi, kopyala/yapıştır, sağ tık menüsü, Σ toplamlar, doldurma, oturum içi geri alma yığını); satır seçimi gizli React satırını tıklayarak detay kartını açar (`HOF.quietSelect`) |
| `hof-checks.js` | Akıllı denetim (v2.0.1): seçili kaydın bulguları detay kartında, şüpheli satırın başında işaret, öneriyi uygulama ve yoksayma |
| `hof-columns.js` | Kolon başlıklarını adlandırma (v2.0.1): `HOF.columnLabel`, detay kartındaki kalem, tablo ve kart başlıklarına ofisin verdiği ad (serbest sayfada uygulanmaz) |
| `hof-documents.js` | Kayda belge ekleme (v2.0.1): detay kartında *Belgeler*, yükleme ilerlemesi, yapıştırma/sürükle-bırak, PDF/resim önizleme |
| `hof-export.js` | *Dışa aktar* menüsü (v2.0.1): açık sekme ya da tüm sekmeler Excel (.xlsx), eski CSV |
| `hof-promises.js`, `hof-search.js` | Tahsilat takvimi şeridi (`GET /api/workspace/dues`; `HOF.dues` ve `dues` olayı; pil kartı: tahsilat gir, ödendi say, söz iptal, kayda git; en çok 40 pil), akıllı arama (ipucu verideki kolon adlarından) |
| `hof-alerts.js` | Sağ alt bildirim kuyruğu (tek tek, 10 sn, üzerine gelince bekler, 450 ms ara; ilk 5'ten sonra özet) ve üst çubuktaki zil (gruplu liste, rozet). Görülme zamanı kişi başına `localStorage hof-notices:<kullanıcı>`; kapanmayan uyarı 3 saatte bir yeniden sıraya girer (5 dakikada bir denetlenir). Kaynaklar: takvimdeki ödenmemiş ve 7 gün içindeki kalemler, son günler, kişinin açık görevleri |

**Depo köprüsü:** React paketi ayarlarını `localStorage`'da tutar. `hof-boot.js` açılışta bu anahtarları sunucudaki ofis ayarlarıyla doldurur ve paketin yaptığı yazmaları sunucuya iletir (`hukuk-ofisi-sheet-url`, `-sync-minutes`, `-ai-mapping`, `-notlar`). Böylece derlenmiş pakete dokunmadan ayarlar ve notlar merkezileşir.

**Paket yamaları:** `tools/patch-bundle.mjs`, `tools/vendor/app-bundle.original.js` dosyasına her biri tam bir kez eşleşmek zorunda olan küçük yamalar uygular (varsayılan Sheet'in kaldırılması, satır/detay kimliği, seçimin korunması, marka, Google Fonts'un kaldırılması). Çıktı içerik özetli ad alır (`app-<özet>.js/css`).

## Birleşik görünüm (sunucu tarafı)

**Kalıcı çalışma verisi (v1.5, `server/lib/dataset.mjs`).** Ofisin tek verisi `dataset://ofis` anahtarıyla sunucuda saklanır (`dataset_rows`); `/api/trpc/sheets.getRows` arayüz hangi adresi gönderirse göndersin bu veriyi döndürür. Düzeltmeler, silmeler ve yeni kayıtlar da bu anahtara bağlıdır (dosya adından/bağlantıdan bağımsız):

1. **Dosya kimliği** (`__hofKey`, notların ve düzeltmelerin anahtarı): satırdaki ilk `yyyy/sayı` kalıbı (v1.0.0 kuralı); yoksa "Dosya No" değeri; o da yoksa satır içeriğinin özeti. İçeri alma anında hesaplanıp satırla saklanır. **v1.6 kimlik kolonu:** dosya numarası taşımayan veride `detectIdentity` kesin bir kimlik kolonu arar (satırların ≥%90'ında kolon var, ≥%95'inde dolu, aynı sekmede tekrar ≤%2, en uzun değer ≤60 karakter, rolü kimlik/plaka/T.C./VKN/IBAN/e-posta; başlığı "no/kod/numara" diyen önce). Bulunursa `{mode: "column", column}` `dataset.identity` ayarına yazılır ve kimlik o kolondan gelir (telefon veya adres değişse de notlar bağlı kalır). Satırların yarısından çoğunda eski kural kimlik buluyorsa ve bu kimlikler büyük ölçüde tekrarsızsa ya da başlığı dosya/esas/takip/icra/dava diyen bir dosya numarası kolonundan geliyorsa (bir dosyası birden çok satır olan hukuk tablosu) `legacy` kipi aynen sürer. **1.6.0 öncesinden gelen ve kullanılmış kurulumlar** açılışta `legacy` kipine sabitlenir (`profile.init` → `dataset.pinLegacyIdentity`); kural kayıtlı değilse satırlar ya da göç 4'ün bıraktığı ilk Sheet eşitlemesi (`dataset.needsInitialSync`) de `legacy` sayılır. *merge* ve eşitleme mevcut kuralı korur, kural otomatik eşitlemede asla değişmez; *replace* mevcut kural `legacy` ise yeni dosya da çoğunlukla dosya numaralıyken `legacy` kalır, kolon kipinde kolon hâlâ varsa korunur, aksi hâlde yeniden belirlenir. Uygulamada eklenen kayıt kimlik kolonunun değerini anahtar alır, aynı kimlik ikinci kez verilemez (409).
2. **Satır kimliği** (`dataset-identity.mjs`, içeri almada eşleşme için): kimlikli satırda `sekme + dosya kimliği + o sekmedeki kaçıncı tekrar`, kimliksiz satırda `sekme + kimliksiz satırlar arasındaki sıra`. Satır içeriğinin özeti (`row_hash`) değişmeyen satırın yeniden yazılmasını önler.
3. Görünüm: **yeni kayıtlar** en üstte, sonra içeri alınan satırlar kaynak sırasıyla; **silinenler** çıkarılır, **düzeltmeler** uygulanır; bağlı Sheet'te artık olmayan satır `__hofMissing` taşır. Paket `__` ile başlayan alanları kolon saymaz; satırlar `data-hof-key` taşır.

İçeri alma iki adımlıdır: `POST /api/workspace/dataset/stage` dosyayı/bağlantıyı okuyup mevcut veriyle karşılaştırır (hiçbir şey yazılmaz; önizleme 30 dk bellekte), `POST …/commit {mode: merge|replace, link}` yöneticinin seçimini uygular. Her değişiklikten önce `VACUUM INTO` yedeği alınır. Modlar: **merge** (yeni eklenir, değişen güncellenir, olmayan korunur), **replace** (olmayan kalkar), **sync** (bağlı Sheet eşitlemesi: olmayan silinmez, `origin = sheets` ise `missing_since` işaretlenir; yönetici "tut" derse `origin = local` olur). Zamanlayıcı dakikada bir bakar, `client.syncMinutes` dolunca eşitler. Emniyet: Sheet boş dönerse ya da (≥20 satırda) satırların %30'undan fazlası birden hem "yeni" hem "kayıp" görünürse eşitleme uygulanmaz, `dataset.syncHold` ile yönetici kararı beklenir. Google'a ulaşılamazsa son kaydedilen veri kullanılır. Veri yükleme/kaldırma yalnızca `sources.manage` (yönetici). Göç 4, 1.4.0'daki etkin kaynağı (Excel anlık görüntüsü veya Sheet bağlantısı) bu modele taşır ve düzeltmeleri/silmeleri/yeni kayıtları `dataset://ofis`'e yeniden anahtarlar; Sheet satırları ilk açılışta okunup kaydedilir.

Google Sheets istekleri 45 sn önbelleklenir; aynı anda gelen istekler birleştirilir. Sekmeler önce `export?format=csv` ile (hücreler ekranda göründüğü gibi) okunur; gviz CSV'si kolon türünü tahmin edip türe uymayan hücreleri boşalttığı ve çok satırlı başlıkları birleştirdiği için yalnızca yedek yoldur. Belgenin adı (`<title>`) verinin adı olur.

**Alt tablolar** (`server/lib/sections.mjs`, Google ve Excel için ortak): tek hücreli başlık satırı + tanıdık kelimeli (TR/EN) ve tür karşıtlığı gösteren kolon başlığı satırı yeni bölüm açar; ilk kolonu çoğunlukla veri olan tabloda en az iki grup etiketi satırı bölüm sayılır; tekrarlanan başlık satırı atlanır; başlığı boş ama verisi olan kolon `Kolon N` olur. Emin olunamazsa eski davranış. Tek bölümlü sekmede `__sheet` = sekme adı (eski düzeltmeler bağlı kalır); çok bölümde `Sekme › Bölüm`. Excel yüklemede tarayıcı ham matrisi gönderir, ayrıştırma sunucudadır. Kolon adı değişen düzeltmeler (eski birleşik başlık → yeni başlık) sonek eşleşmesiyle taşınır.

## Veri oturumları, formüller ve Kasa (v2.0.1)

**Veri oturumları.** İlk oturum eski anahtarla `dataset://ofis` olarak kalır; yeni oturumlar `dataset://oturum-<12 hane>` anahtarı alır ve `settings.dataset.sessions` listesinde `{key, name, createdAt, createdBy}` olarak tutulur (şema göçü yok). Satırlar (`dataset_rows.dataset_key`), içeri alma geçmişi, düzeltmeler/silinenler/uygulamada eklenen kayıtlar (`source_name`) zaten anahtarlıydı. Oturuma özgü ayarlar (`dataset.label`, `dataset.linkedUrl`, eşitleme durumu, kimlik kuralı, sektör, tanıtım, tablo başlıkları) ilk oturumda eski adlarıyla, diğerlerinde `@<kimlik>` ekiyle saklanır. Her HTTP isteği `server/lib/session-scope.mjs` (AsyncLocalStorage) içinde çalışır: `dataset.currentKey()` isteği yapan kullanıcının seçimi (`dataset.session.user.<id>`), yoksa ofisin varsayılanıdır (`dataset.defaultSession`, en son açılan oturum). Böylece rotalar değişmeden kişiye özel oturumda çalışır; zamanlayıcı her oturumu `withKey` ile ayrı eşitler. Yeni oturum açılırken seçimi olmayan mevcut kullanıcılar önceki oturuma sabitlenir (ekranları değişmez), açan kişi yeni oturuma geçer. Stage yanıtı `differentTopic` (kolon benzerliği < 0,5) ve `similarity` taşır; commit `{mode: "session", name}` ile yeni oturum açar. Uçlar: `GET /api/workspace/sessions`, `POST …/sessions/select` (herkes, salt okunur lisansta da), `POST …/sessions/rename|delete` (`sources.manage`; silmeden önce yedek, ilk oturum silinmez). Oturumdan bağımsız, ofis genelinde tek olanlar: kullanıcılar, yetkiler, görevler, sohbet, notlar, telefonlar, tahsilatlar, **Kasa**, ofis adı, Operasyon Merkezi adları, yedekler, lisans. Tablo olayları (`workspace.changed` kind `records|source`) `datasetKey` taşır; istemci başka oturumun olayını yok sayar.

**Formüller** (`server/lib/formula/`). Excel'de tarayıcı SheetJS ile formülleri, Google Sheets'te sunucu `export?format=xlsx` zip'ini (`xlsx.mjs`, paylaşılan formüller açılır) okur. `parse.mjs` İngilizce formülü sözdizim ağacına çevirir; `bind.mjs` A1 başvurularını içeri alma anında kayıt alanlarına bağlar (aynı satır `{t:"f"}`, başka satır `__hofAt` anahtarıyla `{t:"x"}`, kayıt dışı hücre sabit değer) ve sonucu gizli `__hofF` alanında saklar. `compute.mjs` görünümde yalnızca girdisi değişen formülleri (düzeltme, silinen satır, uygulamada eklenen kayıt, TODAY/NOW) yeniden hesaplar ve kolonun örnek biçimiyle yazar (`values.mjs`); hiçbir girdi değişmediyse kaynaktaki değer aynen kalır. `evaluate.mjs` ~100 işlevi destekler; desteklenmeyen formül `unsupported` durumunda son değeri korur. İstemciye `__hofFx` (durum ve alan adlı formül) gider.

**Serbest sayfalar** (`server/lib/free-sheets.mjs`, `server/routes/free.mjs`, `server/lib/formula/sheet.mjs`, göç 5). Sayfa veri oturumuna aittir (`free_sheets.dataset_key`); kolonlar sıralı ve kalıcı kimlikli olarak `columns_json`'da, satırlar `free_rows` (konum), hücreler `free_cells` (satır+kolon anahtarlı; iki kişinin farklı hücreye yazması birbirini ezmez), yapı işlemlerinin anlık görüntüleri `free_history`'de (en çok 30) tutulur. Hücrede kullanıcının yazdığı ham metin saklanır, görünen değer her okumada `computeSheet` ile hesaplanır: Türkçe işlev adları/`;`/ondalık virgül `translateFormula` ile motorun İngilizce yazımına çevrilir, adresler sayfanın ızgarasıdır (`B1` ilk veri satırı), döngü `#DÖNGÜ!`, uzun başvuru zincirleri yığın yerine açık listeyle (derinlik 120'de kesilip önce zincirin ucu) hesaplanır. Sonuç biçimi kolonun örneğinden, yoksa başvurulan hücreden (para birimi öncelikli) gelir; tarih döndüren işlevler tarih, `GÜNSAY/YIL/BAĞ_DEĞ_SAY` gibi işlevler düz sayı, iki tarihin farkı gün sayısıdır; biçimsiz sayı binlik ayraçsızdır (Excel "Genel"). Kolon/satır ekleme-silmede `rewriteReferences` tüm formülleri Excel'deki gibi kaydırır (silinen hücreye başvuru `#REF!`/`#BAŞV!`), doldurma ve iç yapıştırma `shiftReferences` kullanır. Hesaplanan kolon: hedef satırın üstündeki son beş dolu hücrenin en az ikisi ve çoğunluğu aynı kayan formülse yeni satıra (satır ekleme, yapıştırma, *Yeni kayıt* formu) uygulanır. Toplamlarda kolon türü (para/sayı/tarih/metin) hücrelerden çıkarılır; yan toplam seçilen aralığı ya da para kolonlarını toplar. Doldurma elle yazılmış değere, boş satıra ve toplam satırına (kendi kolonunu aralıkla toplayan hücre) dokunmaz. Geri alma `snapshot` kimliğiyle yapılır; o işlemden sonra başka yapı değişikliği ya da başka kullanıcının hücre yazması varsa 409.
Görünüme (`dataset.view`) yalnızca elle değer yazılmış satırlar `serbest:<satır>` kimliği, `__hofFree`, `__hofRow` ve `__hofFx` ile girer; sekme listesinde serbest sekme `free: <sayfa>` taşır (boşken de görünür). Böylece detay kartı, notlar, tahsilat, görev, belge, arama, kartlar, akıllı denetim ve Excel'e aktarma değişmeden çalışır. Detay kartındaki düzeltme (`POST /overrides`) ve *Yeni kayıt* (`POST /records`) serbest satırda hücreye yazar; `GET /overrides?caseKey=serbest:…` hücrelerin ham değerini (formül dahil) döndürür. Uçlar: `GET/POST /api/workspace/free`, `GET/PATCH/DELETE …/free/:id`, `POST …/:id/restore`, `PUT …/:id/cells` (`grow`, `shift`), `PUT|DELETE …/:id/columns/:col`, `POST …/:id/columns`, `POST …/:id/rows`, `DELETE …/:id/rows/:row`, `POST …/:id/fill {axis}`, `POST …/:id/totals {kind, from, to}`, `POST …/:id/undo {snapshot}`. Yetkiler: hücre ve başlık `records.edit`; sayfa/satır/kolon ekleme, toplam `records.create`; dolu satır/kolon ve sayfa silme `records.delete` (boş satır/kolon `records.create`). Her değişiklik `workspace.changed {kind: "records", free}` yayımlar ve analiz önbelleğini (`free.fingerprint`) geçersiz kılar. Oturum silinince sayfaları da silinir. Paket yaması `tek-sekmede-serit-yok`, sayfa ekleyebilen kullanıcıda (`window.hofAlwaysTabs`) şeridi tek sekmede de gösterir.

**Belgeler** (`server/lib/documents.mjs`, `server/routes/documents.mjs`, göç 5 `case_documents`). Dosyalar içerik özetiyle `veri/belgeler/` altında saklanır (aynı dosya iki kez yer kaplamaz), tür uzantı ve sihirli baytlarla doğrulanır; yükleme ham gövde + `x-hof-upload: 1` başlığıyla (çapraz site form gönderimine karşı), en çok 25 MB. PDF `x-frame-options SAMEORIGIN`, resimler kısıtlı CSP ile sunulur. Kişi kendi belgesini, yönetici ve ikinci rol tümünü siler (`documents.manage`); silinenlerin dosyası sahipsiz kalınca temizlenir.

**Akıllı denetim** (`server/lib/insight/reasoning.mjs`). Sekme başına verinin kurallarını öğrenir (tutar ilişkisi `Kalan = Tutar − Σ taksit`, durum-borç tutarlılığı, tarih sırası, kolonun işareti, satış ≥ alış, duruma göre zorunlu alan, aykırı değer / fazladan-eksik sıfır) ve kurala uymayan kayıtları bulur; kural ancak kayıtların büyük çoğunluğunda tutuyorsa öğrenilir. Sonuç analiz önbelleğinde (`ANALYSIS_VERSION = 3`) tutulur; `GET /api/workspace/cases/:key/checks` seçili kaydın bulgularını (tahsilat penceresinden girilip tabloya yansımamış ödeme ve borcu aşan tahsilat dahil), `POST /api/workspace/insight/dismiss` yoksaymayı yazar.

**Excel'e aktarma** (`server/lib/xlsx-write.mjs`, `GET /api/workspace/export.xlsx?tab|all=1`). Görünen birleşik veri (düzeltmeler, formül sonuçları, serbest sayfalar) satır içi metin ve türlü hücrelerle yazılır: tutar, tarih ve yüzde gerçek sayı + görünüş biçimi; telefon, T.C. ve dosya no metin. Kolon başlıkları ofisin verdiği adlardır; dışa aktarma değişiklik geçmişine yazılır.

**Kolon adları** (`PUT /api/workspace/columns`): oturuma özgü `ui.columns` eşlemesi (asıl ad → görünen ad); başka kolonun asıl adıyla ya da başka görünen adla çakışan ad reddedilir.

**Tahsilat takvimi** (`server/lib/insight/dues.mjs`, `server/routes/dues.mjs`). Kolon analizinden (`analyzeColumns`) vade kolonları sınıflanır. Güçlü başlıklar (söz, taahhüt, vade, son ödeme, taksit tarihi) her zaman kullanılır. Zayıf başlıklar (ödeme tarihi, taksit) ancak değerlerin ≥%15'i yakın tarihse kullanılır; geçmiş ödeme listeleri böylece plan sayılmaz. Ek olarak ayın günü (kira/aidat: geçen ay ve bu ay), ay başlıklı kolonlar (en az 2; boş/`ödenmedi`/ücretten az = ödenmemiş) ve `N. Taksit Tarihi`–`N. Taksit Tutarı` eşleşmesi okunur. Durum kolonu ödendi/kapandı/iptal olan satır atlanır. Programdaki tahsilatlar (`payments.case_key`) kaydın kalemlerine vade sırasıyla, vadeden en çok 20 gün önce yapılmışsa sayılır; artan tutar sonrakine geçer. Pencere: 90 gün önce – bu ayın sonu ya da 7 gün sonrası (ödeme sözünde 30 gün). Kalem kimliği `due|sekme|kayıt|kolon|tarih`. *Ödendi say / iptal* oturum ayarı `dues.settled` içinde tutulur (en çok 5000). Denetim türleri `dues.settled|cancelled|reopened`, canlı olay `workspace.changed {kind: "dues"}`. `computeDeadlines` son gün ve belge bitiş tarihlerini (muayene, sigorta, kasko, vize, SRC, psikoteknik, ehliyet…) 7 gün önceden, süresi geçen belgeyi 30 gün boyunca döndürür. Plaka kolonu kişi kolonundan önce geliyorsa başlık plakadır. Yanıt, oturum başına profil parmak izi + tahsilat durumu + kapatılanlar + gün anahtarıyla önbelleklenir. "Bugün" sunucunun yerel günüdür.

**Kasa** (`server/routes/cash.mjs`, göç 5). `payments` (detay kartından; `case_title`, `updated_by/at` eklendi) + `cash_entries` (elle giriş/ödeme). `GET /api/workspace/cash?from&to`: eskiden yeniye hareketler ve her birinde o ana kadarki kasa, dönem başı devreden, dönem ve genel toplamlar. Yazma `cash.manage` (yönetici, ikinci rol, muhasebe); tahsilatı giren kişi kendi tahsilatını düzeltip silebilir. Tutarlar Türkçe okunur (`money.mjs`: "1.250" = bin iki yüz elli). `GET /api/workspace/cash.pdf?from&to[&download=1]` (`cash.view`) aynı hesabı kasa dökümü PDF'i olarak verir (`server/lib/cash-report.mjs`). Denetim türü `cash.exported`. PDF yazıcı (`server/lib/pdf-write.mjs`) bağımlılıksızdır. TrueType yazı tipini Type0/CIDFontType2 (Identity-H) olarak gömer. Alt küme glif numaralarını korur: kullanılmayan gliflerin çizimi boşaltılır, bileşik glifler dahil edilir. ToUnicode eşlemesi metnin seçilip aranmasını sağlar; içerik akışları sıkıştırılır. Yazı tipi `server/assets/fonts/` (Liberation Sans 2.1.5, SIL OFL; ₺ glifi olmadığından tutarlar "TL" ile yazılır). İndirme adı ASCII'dir (bazı tarayıcılar `download` adındaki Türkçe harfleri reddediyor).

## 2.0.2 eklemeleri

**Açılır listeler** (`server/lib/choices.mjs`, `client/assets/hof-choices.js`).
- *Excel yolu:* tarayıcı işçisi (`hof-excel-worker.js`, SheetJS `bookFiles`) sayfa XML'lerinden yalnız `<dataValidations>` ve `<controls>`/`<legacyDrawing>` parçalarını, kutuların `ctrlProps`/VML dosyalarını ve tanımlı adları gönderir. Liste varsa tüm sayfalar boş satırlarıyla ve başlangıç adresiyle gelir; satır ve kolon adresleri tutar.
- *Google yolu:* formüller için zaten indirilen `export?format=xlsx` aynı okuyucuyla (`readXlsxLists`) okunur.
- *Çözüm:* `resolveChoices` seçenekleri sayfa matrisinden okur (hücrenin programda görünen metni). Kaynaklar: satır içi liste, aralık, tanımlı ad, x14.
- *Kolona bağlama:* kurallar `matrixToRecords`'un kayıt bloklarıyla (`blocks`: etiket, satır aralığı, kolon adları) eşleşir. Bir kural bloktaki kayıtların en az yarısını kapsıyorsa kolonun listesi olur.
- *Form denetimi kutusu:* bağlı hücredeki sıra numarası kayıtlar oluşturulmadan önce metne çevrilir (`applyIndexedCombos`).
- *Saklama ve görünüm:* sonuç oturum ayarında durur (`dataset.choices`, sekme → kolon → `{options, strict}`). Yerine koymada değişir; eklemede ve eşitlemede kaynaktaki sekmeler için yenilenir. `view()` görünen sekme adlarıyla `choices` döndürür.
- *Gizli liste sayfası:* yalnızca liste kaynağı olan gizli sayfa içeri almada `dataset.tabs.hidden`'a `reason: "list"` ile yazılır.

**Belge kartı** (`hof-documents.js`).
- `GET /api/workspace/cases/:key/documents/archive?ids=` seçilenleri özgün adlarıyla .zip yapar (sınır 1 GB, adet sınırı yok).
- Yazdırma gizli bir çerçevede yapılır. PDF tarayıcının görüntüleyicisiyle yazdırılır. Resim ve metin tek `srcdoc` belgesinde, her biri ayrı sayfa olarak basılır; PDF'ler sıra çubuğuyla birer birer.

**Uyarılarda "Gerçekleştirildi"** (`hof-alerts.js`).
- Kalem türüne göre işlem:
  - Tarih ve aylık kalem: ilgili hücreye düzeltme olarak "Gerçekleştirildi · <eski değer>" yazılır (`/api/workspace/overrides`, `action: alert.done`).
  - Tekrarlayan ödeme günü: `dues/settle` ile yalnız o ay kapanır.
  - Görev: `tasks/:id/complete`.
- `dues.mjs` "gerçekleştirildi"yi kapanmış kalem, `DONE_STATE`'i yapılmış iş sayar.
- Kuyruk: bildirim 20 sn görünür, sonrakiyle arası 10 sn; pencere açıkken bekler. Toast'lar `--hof-notice-space` kadar yukarıda durur.

**Ana tablo** (`hof-grid.js`).
- Paket yamaları `tum-kolonlar-basliklar/hucreler` 7 kolon sınırını kaldırır.
- Genişlik: `<th>`'lere başlık ve hücrelerin %90'lık dilimine göre (canvas ölçümü) verilir; tablo `table-layout: fixed`'dır.
- İlk kolon `position: sticky`. `.cases-panel` `overflow: clip` olur (`hidden` kaydırma kabı oluşturup yapışkanlığı bozuyordu).
- Kaydırma çubuğu: özel, yapışkan, sürüklenebilir; yerel çubuk bazı sistemlerde gizlendiği için kullanılır.

**Kendi sektörü** (`server/lib/custom-sectors.mjs`).
- Ofis geneli `sectors.custom` ayarında durur. `customSector()` yerleşik biçime çevirir; kimlikler `ozel-` ile başlar.
- `classifySector({ extra })` tanıtıcı başlıkları `!` sinyali olarak kullanır; özgüllük ağırlığıyla yerleşiklerle yarışır.
- Uçlar: `POST/PUT/DELETE /api/workspace/sectors/custom`. Silinen sektörü kullanan oturum Genel'e döner. Profil parmak izi özel sektör değişince analizi yeniler.

**Sohbet arşivi** (`server/lib/chat-archive.mjs`).
- `GET …/messages?window=day`: açılışta son 24 saat. `before` verilince daha eski en yeni mesajdan geriye 24 saat getirir (boş günler atlanır). Gün başına en çok 500 mesaj.
- Açılıştan 20 sn sonra ve 6 saatte bir 30 günden eski mesajlar `<veri>/mesaj-arsivi/<yazışma>/<yyyy-aa Ay>.txt` dosyasına yazılır, sonra silinir.
- Klasör adı: özel yazışmada iki ad + değişmeyen 4 haneli etiket.
- Dosyanın ilk satırı son arşivlenen zamanı taşır. Yazım geçici dosya + yeniden adlandırma ile yapılır; yarıda kalan tur tekrar yazmaz.
- `GET …/archive` kişinin kendi yazışmasının arşivini verir (sohbet erişim kuralıyla).

**Tarih anlamı** (`server/lib/insight/temporal.mjs`).
- `dateMeaning(kolon, ileri tarih oranı)` şu sınıflardan birini döndürür: expiry, schedule, record, birth, other.
- Kaynaklar: kelime listeleri, Türkçe ekler, sıra sayıları (`ordinalOf`).
- Uyarı yalnız expiry (öncesi ve sonrası) ve schedule (yalnız yaklaşınca) için verilir. Satır bağlamı (durum, evet/hayır kolonu, aynı konuda daha yeni tarih) uyarıyı susturur.

**Zor veri düzenleri** (`server/lib/sections.mjs`, `server/lib/insight/columns.mjs`, `validators.mjs`, `dues.mjs`, `choices.mjs`).
- *Gruplu başlık:* `groupedHeader(üst, alt)` — iki satır da veri taşımıyor, alt satır üsttekinden belirgin dolu ve en az onun kadar başlık kelimesi taşıyorsa asıl başlık alttır; boş alt başlık grubun adını alır (`columnNames`). Uzak not satırı (`strayNote`) grup satırıyla karışmasın diye önce gruplu başlık denenir.
- *Yan yana tablolar:* `splitSideBySide` boş ayırıcı kolonlarla bölünen, her biri ≥2 başlıklı ve doluluk deseni farklı blokları ayrı bölüm yapar; etiketi ilk başlıktır. Formül bağlama aynı satırdaki birden çok kayıttan kolonu taşıyanı seçer.
- *Toplam ve dipnot:* `isTotalRow` (toplam, ara toplam, genel toplam…) satırları kayıt olarak kalır (formül toplamları) ama kimlik (`dataset-identity`), KPI, takvim ve kolon tanıma (`analyzeDataset` gövde satırlarını kullanır) dışında tutulur. Bölüm sonundaki tek hücreli notlar (`isFootnote`) atılır.
- *Birleştirilmiş hücreler:* Excel işçisinde `mergedFills` (`sheet["!merges"]`) dikey birleştirmeyi birleşen her satırın ilk kolonuna yazar; Google Sheets'te `readXlsxLists` sayfa XML'inden `<mergeCell>` alanlarını (`merges`) verir ve `fillMerges` CSV matrisine uygular. Yatay birleştirme (gruplu başlık) dokunulmaz.
- *Değerler:* Excel hata değerleri (`isErrorValue`) boş sayılır. Küçük tablolarda (1–2 değer) tür ancak tüm değerler uyuyor ve başlık o türü söylüyorsa verilir (`pass`). Tarihler: ay adı/kısaltması, "Mart 2027" (ayın 1'i), ABD sırası (ay > 12 ise). Ay kolonları: `monthHeader` kısaltma, `yyyy-mm`, `mm/yyyy`.
- *Takvim:* tek vadeli tabloda (`single`) tutar borç ya da tek para kolonundan alınır. İngilizce başlıklar `LEXICON`, `STRONG/WEAK/SETTLED` listelerinde eş anlamlılarıyla vardır.
- *Sayfa şekilleri:* `matrixToRecords` önce sayfanın şeklini belirler — **form** (solda alan adı, sağda değer → tek kayıt), **yan çevrilmiş** (alan adları aşağı, kayıtlar sağa → matris çevrilip olağan yoldan okunur), **başlıksız** (ilk satır da kayıt → kolon adları `guessColumnName` ile içerikten: Tarih, Telefon, Tutar, E-posta, Plaka, T.C., Sıra, Ad Soyad, yoksa "Kolon N"), yoksa olağan **tablo**. İki satıra bölünmüş başlık ("Ödeme" / "Tarihi") birleştirilir (`splitHeader`, ek kelimeleri `SUFFIX_WORDS`). Tek kolonlu sayfada başlık, veri dizisinden önceki son metin satırıdır. Yalnız rakamdan oluşan başlık ("2025") "2025." olur; JavaScript sayısal anahtarları öne dizip kolon sırasını bozmasın.
- *Okuma raporu:* her sonuç `report` taşır: `shape`, `coverage` (kayda giren hücre oranı), `skipped` (satır, tür: title/note/footnote/group/repeat-header/unnamed, metin), `notes`. `dataset.stage` ve `sheets.read` bunları `reading` olarak birleştirir; yükleme penceresi kapsamı ve atlanan satırları gösterir, kapsam %90'ın altındaysa uyarır (`hof-sources.js` → `readingHtml`). İlke: program emin olmadığını saklamaz, söyler.
- *Dayanıklılık:* `test/fuzz-sections.test.mjs` tohumlu rastgele düzenler (başlık, boş satır, ara toplam, dipnot, çöp hücreler, form, yan çevrilmiş, başlıksız) üretir ve değişmezleri denetler: istisna yok, kayıt sayısı korunur, kapsam 0–1, 50.000 satır < 2 sn. Fuzz'ın bulduğu üç zayıflık (seyrek kayıt satırının başlık sanılması, soyadı "Ay"ın başlık kelimesi sayılması, iki kolonlu tablonun form sanılması) 2.0.2'de kapatıldı.
- *Deneme seti:* 23 zor düzen tam yığından (stage → commit → görünüm → analiz → takvim) geçirilir; sonuçlar `docs/DENETIM-2.0.2.md`'de.

**Şemaya esnek uyum** (`server/lib/schema-map.mjs`).
- `matchColumns(eski, yeni, {prevValues, nextValues})`: katlanmış ad eşitliği 1, kapsama 0.85, tek harflik yazım farkı 0.8, kelime Jaccard'ı, değer örtüşmesi (yeni kolonun ayrık değerlerinin eskisinde bulunma oranı × 0.9), aynı konum +0.05; eşik 0.6; açgözlü bire bir. Sonuç: `renamed / added / removed / same`.
- `dataset.stage` eşlemeyi hesaplayıp `schema` olarak döndürür (yükleme penceresi gösterir) ve aşamada saklar. `commitInto` → `migrateSchema`: `overrides.field` (hedefte düzeltme yoksa), `ui.columns` takma adları, `dataset.choices`, devamı olarak eklemede `dataset_rows.values_json` anahtarları yeni ada taşınır; denetim kaydı `dataset.schema.migrated`.

**Veri Sağlık Kontrolü** (`server/lib/insight/fixes.mjs`, `routes/insight.mjs`, `hof-chips.js`).
- `proposeFixes({rows, analyses})`: tek doğru karşılığı olan yazım farkları — telefon, tarih, ABD tutar, durum/kategori/il yazımı, boşluk. Değişiklik listesi sunucuda (oturum + parmak izi), istemciye özet.
- `POST /insight/fixes/apply` tek işlemde override yazar, `source.cells.bulk_fixed` denetim kaydı; `POST …/undo` 15 dk içinde eski değerleri döndürür. `hof-chips.js` biçim bulgularının kayıtlarını tabloda `data-bad` ile kırmızı işaretler.
- Kaymış satır (`quality.mjs`): ≥ 2 biçimli kolonda uyumsuz değer ve bir kolon kaydırınca ≥ 2'si yerine oturuyorsa.

**Olay tabanlı uyarılar** (`server/lib/alerts.mjs`).
- Veri değişikliği zaten `workspace.changed` olayıyla yayılır; `createAlertScheduler` yerel gece yarısı + 2 sn'de `alerts.refresh {reason:"day", today}` yayımlar ve kendini yeniden kurar. İstemci (`hof-alerts.js`, `hof-promises.js`) `live:alerts.refresh` ile takvimi yeniler, sekme görünür olunca 10 dk'dan eskiyse yeniler; yedek anket 30 dk. Takvim sonucu sunucuda parmak izi (veri, tahsilat, kapatılanlar, sekmeler, gün) ile önbelleklidir.

**Analiz iş parçacığı** (`server/lib/insight/worker.mjs`, `worker-entry.mjs`).
- Tek kalıcı worker (`unref`), işler sırayla; 120 sn zaman aşımı ya da çökmede ana iş parçacığında hesap; `app.close` sonlandırır. `profile.analysis` sonucu parmak izi hâlâ aynıysa önbelleğe alır (worker sürerken veri değiştiyse almaz).

**Kanıtlı kolon kararları** (`columns.mjs → analyzeColumns`).
- `inferAcrossColumns`: iki tarih kolonundan biri ötekinden ≥ %95 satırda sonra ise (≥ 5 satır) belirsiz olanın anlamı bitiş (expiry) / kayıt (record) olur. `explain` her kolon için kanıt satırları, `certaintyOf` kesin / olası / belirsiz; analiz penceresinde "Neden?".

**Kendi kendini onarma** (`server/lib/heal.mjs`): `repairMojibake` (Windows-1254 ters tablosu + katı UTF-8 çözme), görünmez karakter/NBSP temizliği, yer tutucu → boş; `healRows` özet, `healNote` okuma raporu notu.

**Hata toleransı — işaretlenen hatalar** (`dataset.mjs → flagBrokenRows`, `quality.mjs → brokenRowReason`, `cells.mjs → isFlaggedRow`).
- Aşamada (stage) kolon türleri öğrenilir; "shifted" (≥ 2 biçimli hücre uyumsuz ve kaydırınca yerine oturuyor) ya da "invalid" (≥ 2 dolu biçimli hücrenin ≥ %60'ı geçersiz) satırlara `__hofFlag` yazılır. Kayıt saklanır; takvim/son tarih/KPI `isFlaggedRow` ile dışlar. Paket yaması sanal sekme "⚠ İşaretlenen hatalar" ve `hof-row-flagged` sınıfı ekler. `POST /records/:key/unflag` → `dataset.unflagged` ayarı; `view()` bu anahtarlarda işareti kaldırır.

**Veri temizleme** (`validators.mjs → isSerialDate/serialToDate`, `columns.mjs` seri tarih kolonu, `fixes.mjs → serialToText`, `heal.mjs` hata değerleri).

**Eşzamanlılık** (`db.mjs`, `routes/workspace.mjs`, `dataset.mjs`, `routes/insight.mjs`).
- SQLite WAL + `busy_timeout 10 s`; her yazım `store.tx` içinde; tek sunucu süreci.
- Düzeltme (override): sürüm (`expectedVersion`) ve değer tabanlı iyimser kilit (`previous`): eşleşmezse 409 `CONFLICT {currentValue, by, at}`; istemci "Üzerine yaz" ile `force` gönderir.
- Aşama anlık görüntüsü: `stage` satır sayısı + `changedAt` damgasını saklar; aynı oturumda `commit` damga değiştiyse 409 `STALE_STAGE`.
- Toplu düzeltme önerileri oturum + parmak iziyle; parmak izi değiştiyse 409.
- Olaylar: her değişiklik `workspace.changed` ile diğer ekranlara; takvim önbelleği parmak iziyle; gün dönümü `alerts.refresh`.

**Silinenler** (göç 6, `server/lib/trash.mjs`, `server/routes/trash.mjs`).
- Kaynaklar: silinen kayıt, gizlenen sekme, belge, serbest sayfa/satır/kolon, tahsilat ve kasa hareketi.
- Geri yükleme eski konuma araya ekler; ad çakışırsa "(geri yüklendi)" eki alır.
- Sekme adları ve gizleme oturum ayarındadır (`dataset.tabs.alias/hidden`). Satırlar asıl adı `__hofSheet`'te taşır; takvim kimlikleri asıl adla kalır.

## Akıllı veri motoru ve ofis profili (v1.6)

`server/lib/insight/` saf fonksiyonlardan oluşur: internete çıkmaz, veritabanına yazmaz, aynı girdiye aynı çıktıyı verir. Sonuç, verinin parmak izine (satır/düzeltme/kayıt sayıları ve son değişiklik zamanları, verinin adı, yerel gün) göre bellekte önbelleklenir. Veri değişince (`dataset.onChange`) önbellek düşer. 200 bin satır yaklaşık 1,5 sn'de çözümlenir.

| Modül | Görev |
|---|---|
| `validators.mjs` | T.C. kimlik no ve VKN (kontrol haneleri), IBAN (mod 97), Türkiye telefonu, e-posta, URL, plaka, 81 il, Türkçe tarih ve tutar ayrıştırma |
| `columns.mjs` | Kolon rolü: başlık sözlüğü + değer istatistikleri + doğrulayıcılar. Roller: kimlik (dosya/sayısal/kod), kişi, kurum, sorumlu, tutar (tutar/birim fiyat; para birimi, karışık birim), tarih (son tarih/olay/doğum; ileri tarih oranı), durum, kategori, telefon, e-posta, adres, not, T.C., VKN, IBAN, il, plaka, URL, sıra no. Her rol `verified` ve `validRate` taşır; önem puanı ve ana kolonlar (`primaryColumns`) buradan gelir |
| `sectors.mjs` | 22 grup, 143 sektör: her sektörün kelime dağarcığı (kayıt/kayıtlar/uzman/alt başlık), modülleri (tahsilat, haciz) ve sinyalleri. Başlık sinyali ağırlığı (güçlü 3, normal 2, zayıf 1) o ifadeyi paylaşan sektör sayısının kareköküne bölünür; değer kalıbı (oran ≥%10 → 1,5, ≥%30 → 3), rol ve dosya/sekme adı sinyalleri eklenir. Güven: **yüksek** = puan ≥7, ≥3 kolon, ≥1 güçlü sinyal, başka gruptaki en yakın sektöre oran ≥1,8; **orta** = puan ≥4, ≥2 kolon, oran ≥1,4; aynı grupta yakın rakip varsa (≥%80) grubun genel sektörü önerilir. Aksi hâlde öneri *Genel*'dir |
| `quality.mjs` | Veri sağlığı: kontrol edilen hücrelerin sorunsuz oranı (≥%95 iyi, ≥%80 orta). Bulgular: boş kimlik/kişi, aynı sekmede tekrar eden kimlik, doğrulanamayan T.C./VKN/IBAN, biçimi tutmayan değerler, karışık para birimi. Her bulgu en çok 50 örnek kayıtla döner |
| `kpi.mjs` | Göstergeler tüm veri ve her sekme için: toplam, tutar toplamı (tek para birimi), son tarih (bugün/7/30 gün/geçmiş), olay (bu ay), "Bu ay" (son tarih yoksa olay tarihi), durum ve sorumlu dağılımları; tıklanınca açılan kayıt listeleri |
| `analyze.mjs` | Hepsini tek geçişte birleştirir (`ANALYSIS_VERSION`), arama ipucu kolonlarını seçer |

**Ofis profili** (`server/lib/profile.mjs`) ayarlarda tutulur (şema göçü yok): `insight.sector` {id, source: confirmed|manual|legacy, at, by}, `ui.labels` (kalemle değiştirilen başlıklar, yuva başına uzunluk sınırı), `insight.intro` (pending|done), `insight.initialized`. İlk açılışta kullanılmış kurulum (verisi veya kaydı, notu, görevi, haczi, tahsilatı olan) `hukuk-buro` + `legacy` + tanıtım bekliyor olarak işaretlenir: 1.6 öncesi ürün yalnızca hukuk ofisleri içindi, görünüm değişmez. Boş yeni kurulum *Genel* ile açılır. `profile()` sektörü, kelime dağarcığını, rol adlarını (`avukat` rolünün görünen adı = sektörün uzmanı), modülleri (sektör istemese de ofiste o modülde kayıt varsa açık) ve başlıkları döndürür; giriş, `/api/auth/me` ve `/api/public/info` (`tagline`) ile istemciye gider. Değişiklikler `workspace.changed {kind: "profile"}` ile açık ekranlara yansır ve denetim kaydına yazılır (`profile.sector`, `profile.label`, `profile.labels.reset`).

Uçlar (`server/routes/insight.mjs`): `GET /api/workspace/profile`, `GET /api/workspace/sectors` (katalog), `GET /api/workspace/insight` (analiz + profil; sektör önerisi ve kanıtları yalnızca `profile.manage` yetkisine), `GET …/insight/records?list=upcoming|passed|topAmount|month&tab=&limit=` (kart penceresi: kartla aynı kapsam ve kural, `total` listenin tamamı, en çok 500 kayıt), `POST …/insight/sector`, `POST …/insight/intro`, `PUT|DELETE /api/workspace/labels`. Analiz önbelleği parmak izine ek olarak tabloyu değiştiren her işlemde (`workspace.changed` kind `records|source`, içeri alma, eşitleme) açıkça geçersizleştirilir. Biçim denetimleri 300 karakterden uzun değerlere uygulanmaz ve düzenli ifadeler doğrusaldır (uzun hücreler analizi kilitleyemez). Değiştirici uçlar `profile.manage` (yalnızca yönetici) ister. **Öneri hiçbir zaman kendiliğinden uygulanmaz**; sektör yalnızca yöneticinin onayı veya seçimiyle değişir.

## Lisans motoru (v2.0)

Ayrıntı ve servis protokolü: [LISANS.md](LISANS.md).

```
Yönetim → Lisans ─► /api/license/{trial,activate,code,check} ─► license.mjs ─► lisans servisi (Vercel, Faz 4)
                                                                     │           /v1/activate · /v1/check
                                                                     │           ◄── imzalı belirteç (Ed25519)
            her değiştirici /api isteği ─► assertWritable ◄──────────┤  evaluateLicense(belirteç, yerel durum, saat)
            /api/auth/me ─► yetkiler (salt okunurken yazma yetkileri çıkarılır) + lisans özeti
```

- Belirteç sunucu bilgisayarın kimliğine (Windows `MachineGuid` özeti, "kurulum kodu") bağlıdır; `license-keys.mjs`'deki açık anahtarla doğrulanır. İnternetsiz etkinleştirme kodu aynı belirtecin tek satırlık hâlidir.
- Durumlar: `none`, `transition` (2.0 öncesinden gelen kullanılmış kurulum, 30 gün), `trial`, `licensed`, `expired`, `blocked`, `verify` (7 günden uzun doğrulanamadı), `clock` (saat 24 saatten fazla geri). Yalnızca `transition`, `trial`, `licensed` yazılabilir.
- Salt okunurken izinli değiştirici istekler: `/api/auth/*`, `/api/license/*`, `/api/admin/*`, sohbette okundu, tanıtım kartını kapatma; diğerleri 403 `LICENSE_READ_ONLY`. Bağlı Sheet'in zamanlanmış eşitlemesi durur (`dataset` `canWrite`).
- Etkin zaman = max(saat, görülen en ileri zaman); servisin `issuedAt`'ı güvenilir zamandır. Yerel durum `settings.license.local`'da kurulum kimliğine bağlı HMAC ile saklanır.
- Testler bağımsızdır: `createApp({ license: { trustedKeys, services, fetchImpl, machineId, now, enforce } })`. Test yardımcısı varsayılan olarak kilidi kapatır (`enforce: false`); `test/license.test.mjs` ve e2e kilidi başvuru lisans servisiyle (`tools/lib/license-service.mjs`) gerçek hâliyle sınar. Üretimde bu seçenekler ortam değişkeniyle verilemez.

## Veri modeli

`users`, `sessions`, `settings` (v1.6 ofis profili ve `dataset.identity` burada), `records`, `overrides`, `deleted_records`, `notes`, `phones`, `payments`, `liens`, `tasks`, `messages`, `audit_events` (v1.0.0) + `case_notes`, `source_snapshots` (v1.1.0) + `dataset_rows`, `dataset_imports` (v1.5.0, göç 4: kalıcı çalışma verisi ve içeri alma geçmişi; `source_snapshots` artık yalnızca geçmiştir) + `cash_entries`, `case_documents`, `free_sheets`, `free_rows`, `free_cells`, `free_history` ve `payments.case_title`, `updated_by`, `updated_at` (v2.0.1, göç 5) + `chat_conversations`, `chat_members` (okunma zamanı), `chat_messages` ve `tasks.assignee_id` (v1.4.0, göç 3: eski `messages` kayıtları sohbete taşınır, eski tablo geri dönüş için silinmez; görevler adları tek bir kullanıcıya denk geliyorsa o kullanıcının kimliğine bağlanır, belirsiz veya serbest adlarda ad eşleşmesi sürer). Görünen adlar benzersizdir (`server/lib/names.mjs`: Türkçe harf kuralı, boşluk ve Unicode yazım farkı yok sayılarak karşılaştırılır).

## Canlı olaylar ve sohbet (v1.4)

- `server/lib/events.mjs`: Server-Sent Events merkezi. `GET /api/events` oturum ister; `hello` (sürüm, çevrimiçi kullanıcılar), `presence`, `chat.message`, `chat.read`, `workspace.changed` ({kind: activity|note|task|records|source|profile|cash|sessions, caseKey, actorName, datasetKey}) olayları. 25 sn'de bir `: ping` ve aynı turda oturumu kapanmış bağlantıların düşürülmesi; çıkış, yöneticinin oturumları kapatması, parola sıfırlama ve pasifleştirmede ilgili bağlantılar beklemeden kapatılır (istemci 401 alınca giriş ekranını gösterir). Kullanıcı başına en fazla 12, toplam 100 bağlantı; okumayan istemcinin tamponu 1 MB'ı geçerse bağlantısı kesilir. Olaylar `<sunucu oturumu>.<sıra>` kimliği taşır, son 1000 olay (en çok 15 dk) bellekte tutulur: tarayıcı `Last-Event-ID` başlığıyla (sayfanın kendi açtığı bağlantıda `?last=`) bağlanınca arada kaçanlar yeniden gönderilir ve `hello.resumed` doğru olur; aksi hâlde istemci tek seferlik eşitleme yapar. Her bağlantının ömrü 5 dk + rastgele paydır (`HUKUK_EVENTS_MAX_AGE_MS`); süre dolunca `retry: 500` gönderilip akış kapatılır ve yanıt `Connection: close` taşıdığından soket de kapanır. Bu, kapanışı iletmeyen vekillerin (1.3.x servis yöneticisi güncellemeden sonraki ilk yeniden başlatmaya kadar çalışmaya devam eder; kurumsal vekiller) arkasında kapanmış sekmelerin bağlantılarının birikip soket havuzunu doldurmasını önler. Görev olayları yalnızca görevi görebilenlere (`tasks.viewAll`, atanan, oluşturan) gönderilir.
- Servis yöneticisinin HTTP kapısı akışı olduğu gibi borular; SSE istekleri ortak soket havuzunu tüketmesin diye ayrı bağlantı kullanır, tarayıcı kapanınca uygulama tarafı da kapanır. Güncelleme sırasında akış kopar, istemci bakım bitince yeniden bağlanır ve `hello` içindeki sürümle yenileme şeridi gösterir.
- `server/lib/chat.mjs`: ofis kanalı (`conversation-office`) ve iki kişilik özel yazışmalar (`direct_key` = sıralı kullanıcı kimlikleri). Özel yazışmaya üye olmayan (yönetici dahil) 404 alır; denetim kaydına içerik yazılmaz; dakikada 30 mesaj sınırı; mesajdaki `yyyy/sayı` dosya kimliği olarak bağlanır. Eski `/api/workspace/messages` uçları sohbete bağlıdır ve yalnızca kişinin yazışmalarını döndürür.

**Göçler** (`server/lib/migrations.mjs`): `PRAGMA user_version` ile sürümlenir, her biri tek işlemde uygulanır, öncesinde `VACUUM INTO` ile tam yedek alınır. Kural: göçler mümkün olduğunca ekleyicidir. Kayıtları yeniden anahtarlayan göçlerde (göç 4) geri dönüş, güncelleme düzeninin yeni sürüm açılamazsa şema sürümü değiştiği için veritabanını güncelleme öncesi yedeğe döndürmesiyle sağlanır.

## Güvenlik

- Parolalar scrypt + tuz; oturum belirteci yalnızca HttpOnly/SameSite=Lax çerezde, veritabanında SHA-256 özeti.
- Rol matrisi `server/lib/permissions.mjs`; her uç yetki denetler, arayüz yalnızca görünürlüğü ayarlar. Görev atama (`tasks.create`), herkesin görevleri (`tasks.viewAll`) ve performans raporu (`reports.view`) yalnızca yönetici ve ikinci roldedir (iç adı `avukat`; ekranda sektörün uzman adıyla görünür). Diğer roller yalnızca kendilerine atanan görevleri görür/tamamlar. Sektör ve başlık değişikliği (`profile.manage`) ile veri yükleme (`sources.manage`) yalnızca yöneticidedir.
- Giriş deneme sınırı, zorunlu parola değişimi, parola politikası, oturum iptalleri.
- CSRF: değiştirici isteklerde Origin denetimi + yalnızca JSON gövde.
- CSP: `script-src 'self'` (satır içi betik yok), `frame-ancestors 'none'`, güvenlik başlıkları.
- Statik dosyalar: güvenli yol çözümleme, gizli dosya engeli, ETag + sıkıştırma.
- Excel ayrıştırma Worker'da; zip okuyucu zip-slip ve CRC denetimi yapar.

## Yedekleme

`VACUUM INTO` ile tutarlı anlık kopya; açılışta ve 6 saatte bir (son yedek eskiyse), son 30 yedek. Elle: yönetim paneli veya `npm run backup` (salt okunur bağlantı, sunucu çalışırken güvenli). Yedek adları `destekofis-<zaman>[-<neden>].sqlite`. 1.6 öncesinden kalan `hukuk-ofisi-…` yedekler de listelenir, geri yüklenir ve adına göre değil zaman damgasına göre sıralanıp temizlenir.

## Test

- `npm test`: kimlik, yetki, çalışma alanı, kaynak birleştirme, Google Sheets (sahte ağ), göç (gerçek v1.0.0 veritabanı), yedek, statik dosya, zip, servis yöneticisi (vekil, bakım sayfası, çökme sonrası yeniden başlatma, öksüz süreç), UDP keşif, kurulum düzeni (bootstrap, sürüm geri dönüşü, `etkinlestir`) ve Go başlatıcı (keşif, kayıt, Windows derlemesi) testleri.
- Güncelleme: imza/bildirge/uyumluluk birim testleri; sahte GitHub sunucusuyla denetim, indirme, özet uyuşmazlığı, sahte imza, etiket uyuşmazlığı, kanal; gerçek servis yöneticisi ve uygulama süreçleriyle uçtan uca akış (açılışta güncelleme ve bakım sayfası, veri korunumu, bozuk sürümde veritabanı ve sürüm geri dönüşü, yönetici panelinden kurulum, elektrik kesintisi sonrası deneme açılışı, ağ yokken normal açılış).
- Alt tablolar (farklı düzenler, TR/EN başlıklar, tutucu davranış), sohbet (gizlilik, okunmamış, okundu, eski uçlar) ve canlı kanal (iletim, yalnızca ilgililere, oturum kapanınca kopma, kapıdan geçiş) testleri.
- Akıllı veri motoru (`test/insight.test.mjs`): doğrulayıcılar, kolon rolleri (gerçek hukuk tablosunda kolon kolon beklenen harita), 63 sektörlük örnek derlem (her biri beklenen sektör veya grup ve en az orta güven), gerçek hukuk tablosu (yüksek güvenle icra), yanıltıcı tablolar (kişi listesi, karışık kolonlar: yanlış sektör önerilmez), belirlenebilirlik, veri sağlığı ve göstergeler, 200 bin satır süre sınırı, kimlik kolonu belirleme ve klinik verisiyle notların kimliğe bağlı kalması, profil uçları ve yetkiler, v1.0.0 veritabanından gelen kurulumun hukuk profiliyle açılması.
- v2.0.1: tahsilat takvimi, son günler, PDF yazıcı ve kasa dökümü (`test/dues.test.mjs`: icra/söz/taksit/kira ve okul servisi örnekleri sabit günle, vade sırasıyla tahsilat, kısmi ödeme, ödendi say/geri al, yetki ve tarih denetimi, yazı tipi alt kümesi, xref ve ToUnicode), formüller (`test/formula.test.mjs`: ayrıştırma, işlevler, bağlama, yalnızca değişenin hesaplanması, Excel ve Google Sheets paylaşılan formülleri), Kasa ve tahsilat düzeltme (`test/cash.test.mjs`), veri oturumları (`test/sessions.test.mjs`: farklı konu önerisi, kişiye özel seçim, oturumların ayrı düzeltmeleri/sektörü, ad değiştirme ve silme, kullanıcıların/görevlerin/Kasa'nın oturumdan bağımsız kalması), serbest sayfalar (`test/free.test.mjs`: Türkçe formül çevirisi, başvuru kaydırma, biçim ve tarih sonuçları, 2000 satırlık zincir ve döngü, hücre/başlık, detay kartı ve *Yeni kayıt* yönlendirmesi, hesaplanan kolon, toplamlar ve kolon türleri, doldurma, yapıştırma, geri alma çatışması, yetkiler, oturuma özgülük), belgeler, Excel'e aktarma, kolon adları, akıllı denetim (`documents`, `export`, `columns`, `reasoning` testleri).
- `npm run test:e2e`: Playwright ile iki kullanıcılı uçtan uca senaryo (okul servisi: sektör, şerit, sağ alt bildirim, pilden tahsilat, zil, Kasa aralığı ve PDF indirme; serbest sayfa: "+ Sayfa", klavyeyle yazma, tıklayarak formül, alt toplam, detay kartı, temizle ve Ctrl+Z; akıllı denetim, belge, kolon adı, Excel'e aktarma; Excel yükleme, yeni oturumda açma ve oturum seçici, formüllü Excel, tahsilat/Kasa, Operasyon Merkezi adları, analiz ekranı ve sektör seçici, özet kartları, kalemle başlık değiştirme ve varsayılana dönüş, personelin kalemi görmemesi, düzeltme, silme/geri alma, yeni kayıt, notlar, yetkiler, yönetim paneli, zorunlu parola değişimi, canlı görev bildirimi, sohbet ve okundu bilgisi, alt tablolu Excel, klinik verisiyle ikinci kurulum, CSP ihlali denetimi).
- GitHub Actions: `ci.yml` (Ubuntu/Windows × Node 22/24, e2e, paket) ve `windows.yml` (kurulum dosyasını derler; gerçek Windows'ta sessiz kurulum, servis hesabı/başlangıç türü, sağlık, UDP keşif, başlatıcı, servis yeniden başlatma ve yeniden kurulumda veri korunumu, kaldırma).

## Yol haritası

Faz 1 Windows servisi + setup.exe + UDP sunucu keşfi ✓ · Faz 2 GitHub'dan otomatik güncelleme ✓ · Ara sürümler 1.4 (sohbet, canlı olaylar), 1.5 (kalıcı veri), 1.6 (akıllı veri motoru, sektörden bağımsız ürün), 1.7 (doğrulanmış kartlar) ✓ · Faz 3 lisans motoru (2.0.0) ✓ · 2.0.1 (tahsilat takvimi, bildirimler, Kasa PDF, veri oturumları, formüller, Kasa, belgeler, Excel'e aktarma, kolon adları, akıllı denetim, serbest sayfalar) ✓ · 2.1.0 (planlanan) ofis dışından erişim · Faz 4 Supabase + Vercel lisans servisi (protokol: LISANS.md), operatör paneli, web sitesi ve yapay zekâ seslendirmeli tanıtım videosu.
