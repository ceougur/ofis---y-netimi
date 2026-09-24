# DestekOfis — Mimari (v1.1)

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

## İstemci katmanları

Arayüzün ana gövdesi Manus/Vite çıkışı derlenmiş bir React paketidir (kaynak kodu yok). Üzerine eklenen katmanlar:

| Dosya | Görev |
|---|---|
| `hof-core.js` | API, bildirim, erişilebilir pencere, form, tek toplu DOM izleyici, dosya kimliği çözümleme |
| `hof-auth.js` | Giriş ekranı, parola değişimi, çıkış (uygulama + yönetim) |
| `hof-boot.js` | Açılış sırası: oturum → ofis ayarları + merkezi notlar → depo köprüsü → React paketini yükleme; 60 sn'de bir eşitleme |
| `hof-workspace.js` | Operasyon kartı, kullanıcı kartı, dosya işlemleri, işlem geçmişi, görevler, mesajlar, rapor, haciz uyarıları |
| `hof-table.js` | Yüzen düzenle/sil düğmeleri, geri alınabilir silme, yeni kayıt, sayfalama |
| `hof-sources.js` | Merkezi Excel yükleme (Worker'da ayrıştırma), kaynak kaldırma, yetkiye göre menü gizleme |
| `hof-promises.js`, `hof-search.js` | Ödeme sözleri şeridi, akıllı arama |

**Depo köprüsü:** React paketi ayarlarını `localStorage`'da tutar. `hof-boot.js` açılışta bu anahtarları sunucudaki ofis ayarlarıyla doldurur ve paketin yaptığı yazmaları sunucuya iletir (`hukuk-ofisi-sheet-url`, `-sync-minutes`, `-ai-mapping`, `-notlar`). Böylece derlenmiş pakete dokunmadan ayarlar ve notlar merkezileşir.

**Paket yamaları:** `tools/patch-bundle.mjs`, `tools/vendor/app-bundle.original.js` dosyasına her biri tam bir kez eşleşmek zorunda olan küçük yamalar uygular (varsayılan Sheet'in kaldırılması, satır/detay kimliği, seçimin korunması, marka, Google Fonts'un kaldırılması). Çıktı içerik özetli ad alır (`app-<özet>.js/css`).

## Birleşik görünüm (sunucu tarafı)

`/api/trpc/sheets.getRows` kaynağı (Google Sheets veya sunucudaki Excel anlık görüntüsü) okur ve ofisin verisini uygular:

1. **Dosya kimliği** (`__hofKey`): satırdaki ilk `yyyy/sayı` kalıbı (v1.0.0 kuralıyla uyumlu); yoksa "Dosya No" değeri; o da yoksa satır içeriğinin özeti.
2. **Silinenler** çıkarılır, **düzeltmeler** (override) uygulanır, **yeni kayıtlar** en üste eklenir.
3. Paket `__` ile başlayan alanları kolon saymaz; satırlar `data-hof-key` taşır.

Google Sheets sonuçları 45 sn önbelleklenir; aynı anda gelen istekler birleştirilir.

## Veri modeli

`users`, `sessions`, `settings`, `records`, `overrides`, `deleted_records`, `notes`, `phones`, `payments`, `liens`, `tasks`, `messages`, `audit_events` (v1.0.0) + `case_notes`, `source_snapshots` (v1.1.0).

**Göçler** (`server/lib/migrations.mjs`): `PRAGMA user_version` ile sürümlenir, her biri tek işlemde uygulanır, öncesinde `VACUUM INTO` ile tam yedek alınır. Kural: göçler yalnızca ekleyicidir; eski sürüm yeni şemayı okuyabilir (güncelleme geri alınabilirliği için).

## Güvenlik

- Parolalar scrypt + tuz; oturum belirteci yalnızca HttpOnly/SameSite=Lax çerezde, veritabanında SHA-256 özeti.
- Rol matrisi `server/lib/permissions.mjs`; her uç yetki denetler, arayüz yalnızca görünürlüğü ayarlar.
- Giriş deneme sınırı, zorunlu parola değişimi, parola politikası, oturum iptalleri.
- CSRF: değiştirici isteklerde Origin denetimi + yalnızca JSON gövde.
- CSP: `script-src 'self'` (satır içi betik yok), `frame-ancestors 'none'`, güvenlik başlıkları.
- Statik dosyalar: güvenli yol çözümleme, gizli dosya engeli, ETag + sıkıştırma.
- Excel ayrıştırma Worker'da; zip okuyucu zip-slip ve CRC denetimi yapar.

## Yedekleme

`VACUUM INTO` ile tutarlı anlık kopya; açılışta ve 6 saatte bir (son yedek eskiyse), son 30 yedek. Elle: yönetim paneli veya `npm run backup` (salt okunur bağlantı, sunucu çalışırken güvenli).

## Test

- `npm test`: kimlik, yetki, çalışma alanı, kaynak birleştirme, Google Sheets (sahte ağ), göç (gerçek v1.0.0 veritabanı), yedek, statik dosya ve zip testleri.
- `npm run test:e2e`: Playwright ile iki kullanıcılı uçtan uca senaryo (Excel yükleme, düzeltme, silme/geri alma, yeni kayıt, notlar, yetkiler, yönetim paneli, zorunlu parola değişimi, CSP ihlali denetimi).

## Yol haritası

Faz 1 Windows servisi + setup.exe + UDP sunucu keşfi · Faz 2 GitHub'dan otomatik güncelleme · Faz 3 lisans motoru · Faz 4 Supabase + Vercel lisans servisi, operatör paneli ve web sitesi.
