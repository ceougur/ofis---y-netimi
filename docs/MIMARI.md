# DestekOfis — Mimari (v1.4)

## Genel bakış

```
Tarayıcı (Chrome/Edge)                         Sunucu bilgisayarı
┌──────────────────────────────┐   HTTP    ┌────────────────────────────────────┐
│ app-<özet>.js  (React paketi) │ ───────► │ server/app.mjs  (node:http)         │
│ hof-*.js       (eklentiler)   │  /api/*  │  ├─ routes/  auth · admin ·          │
│ admin.html     (yönetim)      │ ◄─────── │  │           workspace · trpc        │
└──────────────────────────────┘   JSON    │  ├─ lib/     auth · izinler · kaynak │
                                            │  │           birleştirme · yedek ·    │
                                            │  │           göç · statik · zip       │
                                            │  └─ data/hukuk-ofisi.sqlite (WAL)     │
                                            └────────────────────────────────────┘
```

- **Sunucu** dış bağımlılık kullanmaz (Node 22+ yerleşik `node:http`, `node:sqlite`, `node:zlib`, `node:crypto`). Bu, kurulumu ve ileride otomatik güncellemeyi basitleştirir.
- **Veritabanına** yalnızca sunucu süreci erişir; istemciler HTTP API kullanır.

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
| `hof-workspace.js` | Operasyon kartı, kullanıcı kartı, dosya işlemleri, işlem geçmişi (canlı yenilenir), görevler, rapor, haciz uyarıları |
| `hof-chat.js` | Sohbet paneli: ofis kanalı + özel yazışmalar, okunmamış rozeti/sekme başlığı, okundu bilgisi, bildirim ve ses, dosya numarası bağlantısı |
| `hof-table.js` | Yüzen düzenle/sil düğmeleri, geri alınabilir silme, yeni kayıt, sayfalama (20 satır; 1…6 penceresi; sekme/arama değişince ilk sayfa) |
| `hof-sections.js` | "Sekme › Bölüm" etiketli kategorileri gruplar: React'in düğmelerini gizleyip sekme + alt tablo şeridi gösterir, tıklamaları gizli React düğmelerine aktarır |
| `hof-sources.js` | Merkezi Excel yükleme (Worker'da ayrıştırma), kaynak kaldırma, yetkiye göre menü gizleme |
| `hof-promises.js`, `hof-search.js` | Ödeme sözleri şeridi, akıllı arama |

**Depo köprüsü:** React paketi ayarlarını `localStorage`'da tutar. `hof-boot.js` açılışta bu anahtarları sunucudaki ofis ayarlarıyla doldurur ve paketin yaptığı yazmaları sunucuya iletir (`hukuk-ofisi-sheet-url`, `-sync-minutes`, `-ai-mapping`, `-notlar`). Böylece derlenmiş pakete dokunmadan ayarlar ve notlar merkezileşir.

**Paket yamaları:** `tools/patch-bundle.mjs`, `tools/vendor/app-bundle.original.js` dosyasına her biri tam bir kez eşleşmek zorunda olan küçük yamalar uygular (varsayılan Sheet'in kaldırılması, satır/detay kimliği, seçimin korunması, marka, Google Fonts'un kaldırılması). Çıktı içerik özetli ad alır (`app-<özet>.js/css`).

## Birleşik görünüm (sunucu tarafı)

`/api/trpc/sheets.getRows` kaynağı (Google Sheets veya sunucudaki Excel anlık görüntüsü) okur ve ofisin verisini uygular:

1. **Dosya kimliği** (`__hofKey`): satırdaki ilk `yyyy/sayı` kalıbı (v1.0.0 kuralıyla uyumlu); yoksa "Dosya No" değeri; o da yoksa satır içeriğinin özeti.
2. **Silinenler** çıkarılır, **düzeltmeler** (override) uygulanır, **yeni kayıtlar** en üste eklenir.
3. Paket `__` ile başlayan alanları kolon saymaz; satırlar `data-hof-key` taşır.

Google Sheets sonuçları 45 sn önbelleklenir; aynı anda gelen istekler birleştirilir. Sekmeler önce `export?format=csv` ile (hücreler ekranda göründüğü gibi) okunur; gviz CSV'si kolon türünü tahmin edip türe uymayan hücreleri boşalttığı ve çok satırlı başlıkları birleştirdiği için yalnızca yedek yoldur.

**Alt tablolar** (`server/lib/sections.mjs`, Google ve Excel için ortak): tek hücreli başlık satırı + tanıdık kelimeli (TR/EN) ve tür karşıtlığı gösteren kolon başlığı satırı yeni bölüm açar; ilk kolonu çoğunlukla veri olan tabloda en az iki grup etiketi satırı bölüm sayılır; tekrarlanan başlık satırı atlanır; başlığı boş ama verisi olan kolon `Kolon N` olur. Emin olunamazsa eski davranış. Tek bölümlü sekmede `__sheet` = sekme adı (eski düzeltmeler bağlı kalır); çok bölümde `Sekme › Bölüm`. Excel yüklemede tarayıcı ham matrisi gönderir, ayrıştırma sunucudadır. Kolon adı değişen düzeltmeler (eski birleşik başlık → yeni başlık) sonek eşleşmesiyle taşınır.

## Veri modeli

`users`, `sessions`, `settings`, `records`, `overrides`, `deleted_records`, `notes`, `phones`, `payments`, `liens`, `tasks`, `messages`, `audit_events` (v1.0.0) + `case_notes`, `source_snapshots` (v1.1.0) + `chat_conversations`, `chat_members` (okunma zamanı), `chat_messages` ve `tasks.assignee_id` (v1.4.0, göç 3: eski `messages` kayıtları sohbete taşınır, eski tablo geri dönüş için silinmez; görevler adları tek bir kullanıcıya denk geliyorsa o kullanıcının kimliğine bağlanır, belirsiz veya serbest adlarda ad eşleşmesi sürer). Görünen adlar benzersizdir (`server/lib/names.mjs`: Türkçe harf kuralı, boşluk ve Unicode yazım farkı yok sayılarak karşılaştırılır).

## Canlı olaylar ve sohbet (v1.4)

- `server/lib/events.mjs`: Server-Sent Events merkezi. `GET /api/events` oturum ister; `hello` (sürüm, çevrimiçi kullanıcılar), `presence`, `chat.message`, `chat.read`, `workspace.changed` ({kind: activity|note|task|records|source, caseKey, actorName}) olayları. 25 sn'de bir `: ping` ve aynı turda oturumu kapanmış bağlantıların düşürülmesi; çıkış, yöneticinin oturumları kapatması, parola sıfırlama ve pasifleştirmede ilgili bağlantılar beklemeden kapatılır (istemci 401 alınca giriş ekranını gösterir). Kullanıcı başına en fazla 12, toplam 100 bağlantı; okumayan istemcinin tamponu 1 MB'ı geçerse bağlantısı kesilir. Olaylar `<sunucu oturumu>.<sıra>` kimliği taşır, son 1000 olay (en çok 15 dk) bellekte tutulur: tarayıcı `Last-Event-ID` başlığıyla (sayfanın kendi açtığı bağlantıda `?last=`) bağlanınca arada kaçanlar yeniden gönderilir ve `hello.resumed` doğru olur; aksi hâlde istemci tek seferlik eşitleme yapar. Her bağlantının ömrü 5 dk + rastgele paydır (`HUKUK_EVENTS_MAX_AGE_MS`); süre dolunca `retry: 500` gönderilip akış kapatılır ve yanıt `Connection: close` taşıdığından soket de kapanır. Bu, kapanışı iletmeyen vekillerin (1.3.x servis yöneticisi güncellemeden sonraki ilk yeniden başlatmaya kadar çalışmaya devam eder; kurumsal vekiller) arkasında kapanmış sekmelerin bağlantılarının birikip soket havuzunu doldurmasını önler. Görev olayları yalnızca görevi görebilenlere (`tasks.viewAll`, atanan, oluşturan) gönderilir.
- Servis yöneticisinin HTTP kapısı akışı olduğu gibi borular; SSE istekleri ortak soket havuzunu tüketmesin diye ayrı bağlantı kullanır, tarayıcı kapanınca uygulama tarafı da kapanır. Güncelleme sırasında akış kopar, istemci bakım bitince yeniden bağlanır ve `hello` içindeki sürümle yenileme şeridi gösterir.
- `server/lib/chat.mjs`: ofis kanalı (`conversation-office`) ve iki kişilik özel yazışmalar (`direct_key` = sıralı kullanıcı kimlikleri). Özel yazışmaya üye olmayan (yönetici dahil) 404 alır; denetim kaydına içerik yazılmaz; dakikada 30 mesaj sınırı; mesajdaki `yyyy/sayı` dosya kimliği olarak bağlanır. Eski `/api/workspace/messages` uçları sohbete bağlıdır ve yalnızca kişinin yazışmalarını döndürür.

**Göçler** (`server/lib/migrations.mjs`): `PRAGMA user_version` ile sürümlenir, her biri tek işlemde uygulanır, öncesinde `VACUUM INTO` ile tam yedek alınır. Kural: göçler yalnızca ekleyicidir; eski sürüm yeni şemayı okuyabilir (güncelleme geri alınabilirliği için).

## Güvenlik

- Parolalar scrypt + tuz; oturum belirteci yalnızca HttpOnly/SameSite=Lax çerezde, veritabanında SHA-256 özeti.
- Rol matrisi `server/lib/permissions.mjs`; her uç yetki denetler, arayüz yalnızca görünürlüğü ayarlar. Görev atama (`tasks.create`), herkesin görevleri (`tasks.viewAll`) ve performans raporu (`reports.view`) yalnızca yönetici ve avukattadır; diğer roller yalnızca kendilerine atanan görevleri görür/tamamlar.
- Giriş deneme sınırı, zorunlu parola değişimi, parola politikası, oturum iptalleri.
- CSRF: değiştirici isteklerde Origin denetimi + yalnızca JSON gövde.
- CSP: `script-src 'self'` (satır içi betik yok), `frame-ancestors 'none'`, güvenlik başlıkları.
- Statik dosyalar: güvenli yol çözümleme, gizli dosya engeli, ETag + sıkıştırma.
- Excel ayrıştırma Worker'da; zip okuyucu zip-slip ve CRC denetimi yapar.

## Yedekleme

`VACUUM INTO` ile tutarlı anlık kopya; açılışta ve 6 saatte bir (son yedek eskiyse), son 30 yedek. Elle: yönetim paneli veya `npm run backup` (salt okunur bağlantı, sunucu çalışırken güvenli).

## Test

- `npm test`: kimlik, yetki, çalışma alanı, kaynak birleştirme, Google Sheets (sahte ağ), göç (gerçek v1.0.0 veritabanı), yedek, statik dosya, zip, servis yöneticisi (vekil, bakım sayfası, çökme sonrası yeniden başlatma, öksüz süreç), UDP keşif, kurulum düzeni (bootstrap, sürüm geri dönüşü, `etkinlestir`) ve Go başlatıcı (keşif, kayıt, Windows derlemesi) testleri.
- Güncelleme: imza/bildirge/uyumluluk birim testleri; sahte GitHub sunucusuyla denetim, indirme, özet uyuşmazlığı, sahte imza, etiket uyuşmazlığı, kanal; gerçek servis yöneticisi ve uygulama süreçleriyle uçtan uca akış (açılışta güncelleme ve bakım sayfası, veri korunumu, bozuk sürümde veritabanı ve sürüm geri dönüşü, yönetici panelinden kurulum, elektrik kesintisi sonrası deneme açılışı, ağ yokken normal açılış).
- Alt tablolar (farklı düzenler, TR/EN başlıklar, tutucu davranış), sohbet (gizlilik, okunmamış, okundu, eski uçlar) ve canlı kanal (iletim, yalnızca ilgililere, oturum kapanınca kopma, kapıdan geçiş) testleri.
- `npm run test:e2e`: Playwright ile iki kullanıcılı uçtan uca senaryo (Excel yükleme, düzeltme, silme/geri alma, yeni kayıt, notlar, yetkiler, yönetim paneli, zorunlu parola değişimi, canlı görev bildirimi, sohbet ve okundu bilgisi, alt tablolu Excel, CSP ihlali denetimi).
- GitHub Actions: `ci.yml` (Ubuntu/Windows × Node 22/24, e2e, paket) ve `windows.yml` (kurulum dosyasını derler; gerçek Windows'ta sessiz kurulum, servis hesabı/başlangıç türü, sağlık, UDP keşif, başlatıcı, servis yeniden başlatma ve yeniden kurulumda veri korunumu, kaldırma).

## Yol haritası

Faz 1 Windows servisi + setup.exe + UDP sunucu keşfi ✓ · Faz 2 GitHub'dan otomatik güncelleme ✓ · Faz 3 lisans motoru · Faz 4 Supabase + Vercel lisans servisi, operatör paneli ve web sitesi.
