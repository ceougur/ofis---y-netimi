# DestekOfis — Lisans motoru ve lisans servisi protokolü (v2.0.0)

Bu belge Faz 3'te programa eklenen lisans motorunu ve Faz 4'te Vercel + Supabase üzerine kurulacak lisans servisinin
uyması gereken protokolü anlatır. Başvuru (referans) uygulaması `tools/lib/license-service.mjs` dosyasındadır; Faz 4
aynı davranışı Vercel işlevleri ve Supabase tablolarıyla kurar.

## 1. Kararlar (Faz planı)

| Konu | Karar |
|---|---|
| Demo ve lisans | Aynı kurulum dosyası; lisans girilince deneme kendiliğinden lisanslıya döner. |
| Deneme süresi | İlk etkinleştirmede başlar; bilgisayar başına bir kez; süre servistedir (şu an 30 gün). |
| Süre dolunca | Salt okunur mod: görüntüleme, arama, dışa aktarma, yedek, yönetim paneli ve lisans ekranı çalışır; yazma istekleri 403 `LICENSE_READ_ONLY`. |
| Engellenen lisans | Salt okunur (süresi dolmuş lisans gibi), satıcının mesajı gösterilir. |
| Lisans servisi | Vercel; yanıtlar Ed25519 ile imzalı. |
| İnternet kesintisi | 7 gün tolerans; son 3 günde uyarı; sonra doğrulanana kadar salt okunur. |
| Saat | Geri alma koruması; bir günden fazla geri alınırsa salt okunur. |
| Mevcut ofisler | 2.0.0'a güncellenen ve kullanılmış kurulum 30 gün geçiş dönemiyle kesintisiz çalışır. |

## 2. Programdaki lisans motoru

- `server/lib/license-token.mjs` — belirteç biçimi, imza, internetsiz kod (`DOLIS1.` + base64url zarf).
- `server/lib/license-keys.mjs` — güvenilen **açık** lisans anahtarları (`destekofis-lisans-2026-1`, parmak izi `49cc9e7174dda649`). Güncelleme anahtarından ayrıdır.
- `server/lib/machine.mjs` — bilgisayar kimliği: Windows `MachineGuid` (Linux `/etc/machine-id`) ürün adıyla SHA-256'lanır, ilk 32 karakter. Ekranda 4'lü gruplar hâlinde **kurulum kodu** olarak görünür. Okunamazsa kayıtlı değer, o da yoksa veri klasöründeki rastgele kimlik kullanılır.
- `server/lib/license.mjs` — durum hesabı (`evaluateLicense`, saf işlev), yerel durum, lisans servisi istemcisi, zamanlayıcılar, yazma kilidi.
- `server/routes/license.mjs` — `GET /api/license`, `POST /api/license/{trial,activate,code,check}`.

### Durumlar

| Durum | Yazılabilir | Ne zaman |
|---|---|---|
| `none` | hayır | Hiç etkinleştirilmemiş yeni kurulum; geçiş dönemi dolmuş kurulum (`reason: transition-ended`); başka bilgisayarın lisansı (`reason: machine`). |
| `transition` | evet | 2.0.0 öncesinden gelen, kullanılmış kurulum; ilk 2.0 açılışından itibaren 30 gün. |
| `trial` | evet | Geçerli deneme belirteci. |
| `licensed` | evet | Geçerli lisans belirteci (süreli veya süresiz). |
| `expired` | hayır | Belirtecin `expiresAt` zamanı geçti. |
| `blocked` | hayır | Belirteç `status: "blocked"`. |
| `verify` | hayır | İnternetli belirteç 7 günden uzun süredir doğrulanamadı. |
| `clock` | hayır | Bilgisayar saati görülen en ileri zamandan 24 saatten fazla geride. |

**Etkin zaman** = max(bilgisayar saati, görülen en ileri zaman). Süre ve tolerans hesabı etkin zamanla yapılır; saat geri
alınsa bile süre geri gelmez. Lisans servisinden gelen her belirtecin `issuedAt` alanı güvenilir zamandır: görülen en ileri
zaman ona çekilir ve son başarılı doğrulama olarak kaydedilir. İnternetsiz koddaki `issuedAt` de imzalı güvenilir zamandır:
şimdiye kadar kabul edilen en yeni imzalı zamandan (`trustedAt`) yeniyse görülen en ileri zaman ona çekilir. Böylece
yanlışlıkla ileri alınıp düzeltilen bir saat, satıcının ürettiği yeni kodla (ya da servisle bir bağlantıyla) düzelir; eski
kodlar yeniden uygulanarak zaman geri alınamaz.

**Yerel durum** (`settings.license.local`): görülen en ileri zaman, son başarılı doğrulama, geçiş başlangıcı, son deneme
sonucu. Kurulum kimliğine bağlı HMAC özetiyle saklanır; özet tutmazsa (elle değiştirilmiş) görülen en ileri zaman "şimdi",
son doğrulama "yok" sayılır ve değişiklik geçmişine `license.tamper` yazılır. Bu yerel önlemler caydırıcıdır; asıl koruma
imzalı belirteç ve düzenli doğrulamadır.

**Salt okunur modda izinli değiştirici istekler:** `/api/auth/*`, `/api/license/*`, `/api/admin/*` (kullanıcılar, yedek, ofis
adı, güncelleme), sohbette okundu bilgisi, tanıtım kartını kapatma. Diğer tüm `POST/PUT/PATCH/DELETE` istekleri
`403 { code: "LICENSE_READ_ONLY", license }` döner. Oturum bilgisindeki (`/api/auth/me`, giriş) yetkilerden yazma yetkileri
çıkarılır; böylece ekranlardaki yazma düğmeleri de gizlenir. Zamanlanmış Google Sheets eşitlemesi durur.

**Zamanlayıcılar:** açılıştan 30 sn sonra ve 12 saatte bir doğrulama (belirteç varsa); başarısızsa 30 dakikada bir yeniden;
10 dakikada bir durum hesabı ve görülen en ileri zamanın kaydı. Durum değişince `license.changed` canlı olayı yayımlanır
ve değişiklik geçmişine `license.state_changed` yazılır.

**Servis adresi:** varsayılan `https://destek-ofis.vercel.app/api/lisans`; ortamda `HUKUK_LICENSE_URL` (virgülle birden
çok adres) ile değiştirilir. Yanıtlar imzalı olduğundan adres değişikliği güveni zayıflatmaz. Bilgisayar kimliği ortamdan
değiştirilemez (lisansın başka bilgisayara kopyalanmasını önler).

## 3. Belirteç biçimi

Zarf (güncelleme bildirgesiyle aynı yapı):

```json
{ "schema": 1, "payload": "<base64(JSON iddialar)>", "signatures": [{ "keyId": "destekofis-lisans-2026-1", "sig": "<base64 Ed25519>" }] }
```

İddialar:

| Alan | Tür | Açıklama |
|---|---|---|
| `schema` | 1 | |
| `product` | `"DestekOfis"` | |
| `type` | `"license-token"` | |
| `kind` | `"trial"` \| `"license"` | Denemede `expiresAt` zorunlu. |
| `status` | `"active"` \| `"blocked"` | |
| `licenseId` | metin | `DEN-…` (deneme), `LIS-…` (lisans). 3–64 karakter, `[A-Za-z0-9._-]`. |
| `customer` | metin | Lisans sahibi (ekranda görünür), en çok 120. |
| `machine` | 32 hex | Kurulum kodu. Belirteç yalnızca bu bilgisayarda geçerlidir. |
| `issuedAt` | ISO zaman | Servisin saati (güvenilir zaman). |
| `startsAt` | ISO zaman | Deneme/lisans başlangıcı. |
| `expiresAt` | ISO zaman \| `null` | `null` = süresiz. |
| `offline` | mantıksal | `true`: internetsiz lisans (doğrulama gerekmez, uzaktan engellenemez). Servis yanıtlarında `false`. |
| `message` | metin | Ekranda gösterilecek not (ör. engelleme nedeni, satıcının telefonu), en çok 300. |

## 4. Servis protokolü (Faz 4 Vercel API)

Tüm istekler `POST`, gövde JSON. Program her isteğe `product`, `version`, `machine`, `instanceId` ekler. Başarılı yanıt
`200 { "ok": true, "token": <zarf> }`; ret `4xx { "ok": false, "code": "<KOD>", "error": "<açıklama>" }`. Program yalnızca imzası
geçerli, kendi bilgisayarına ait ve beklenen lisans numaralı belirteci kabul eder; imzasız ret yanıtları durumu değiştirmez
(yalnızca doğrulama yapılamamış sayılır ve 7 günlük tolerans işler).

### `POST {servis}/v1/activate`

```json
{ "product": "DestekOfis", "version": "2.0.0", "machine": "<32 hex>", "instanceId": "…",
  "kind": "trial", "office": { "name": "…", "contact": "…", "email": "…", "phone": "…" } }
{ "product": "DestekOfis", "version": "2.0.0", "machine": "<32 hex>", "instanceId": "…",
  "kind": "license", "licenseKey": "DO-XXXXX-XXXXX-XXXXX-XXXXX" }
```

- **Deneme:** bu `machine` için deneme yoksa oluşturulur (`startsAt` = şimdi, `expiresAt` = şimdi + deneme süresi). Varsa
  **aynı** deneme döner (süresi dolmuşsa dolmuş olarak): bilgisayar başına bir deneme.
- **Lisans:** anahtar yoksa `LICENSE_NOT_FOUND`; engelliyse `LICENSE_BLOCKED`; başka bilgisayara bağlıysa `LICENSE_IN_USE`;
  bağlı değilse bu bilgisayara bağlanır. Belirteç döner.

### `POST {servis}/v1/check`

```json
{ "product": "DestekOfis", "version": "2.0.0", "machine": "<32 hex>", "instanceId": "…", "licenseId": "LIS-…", "kind": "license" }
```

Güncel belirteç döner (yeni `issuedAt`; `status` ve `expiresAt` servisteki son hâl). Lisans bulunamaz ya da başka bilgisayara
bağlıysa `LICENSE_NOT_FOUND`.

### Hata kodları

`BAD_REQUEST`, `TRIAL_USED`, `LICENSE_NOT_FOUND`, `LICENSE_IN_USE`, `LICENSE_BLOCKED`, `LICENSE_EXPIRED`, `RATE_LIMITED`.
Program bunları Türkçe açıklamaya çevirir; bilinmeyen kodlarda servisin `error` metnini gösterir.

### Faz 4 için veri modeli önerisi (Supabase)

- `trials(machine PK, license_id, starts_at, expires_at, status, message, office jsonb, instance_id, version, created_at)`
- `licenses(key PK, license_id unique, customer, expires_at, status, message, machine, activated_at, instance_id, created_at)`
- `license_events(id, at, type, license_id, machine, details jsonb)` — operatör paneli geçmişi.
- Gizli anahtar Vercel ortam değişkeni `DESTEKOFIS_LICENSE_KEY` (PEM), anahtar kimliği `DESTEKOFIS_LICENSE_KEY_ID`.
- Hız sınırı: IP ve bilgisayar başına dakikada 10 istek (`RATE_LIMITED`).

## 5. Operatör işlemleri (Faz 4'e kadar)

Gizli lisans anahtarı (`destekofis-lisans-2026-1-GIZLI.pem`) depoda ve teslim paketinde **yoktur**; ayrı dosya olarak
verilir. Parola yöneticisinde veya şifreli USB'de saklayın. Kaybolursa yeni anahtar üretip (`tools/lisans-anahtar-uret.mjs`)
açık kısmını `license-keys.mjs`'e ekleyen bir sürüm yayımlamak gerekir; ele geçirilirse başkaları lisans üretebilir.

```bash
# İnternetsiz etkinleştirme kodu (müşteri Yönetim → Lisans'taki kurulum kodunu iletir)
node tools/lisans-kodu.mjs --anahtar destekofis-lisans-2026-1-GIZLI.pem --kurulum 7F3A-91C2-… --musteri "Çetin Hukuk" --suresiz
node tools/lisans-kodu.mjs --anahtar … --kurulum … --musteri "…" --bitis 2027-09-25
node tools/lisans-kodu.mjs --anahtar … --kurulum … --deneme --gun 30

# Başvuru lisans servisi (yerel ağda deneme; program HUKUK_LICENSE_URL=http://<adres>:5130 ile yönlendirilir)
node tools/lisans-servisi.mjs baslat --anahtar … --veri lisans-veri.json
node tools/lisans-servisi.mjs lisans-olustur --veri lisans-veri.json --musteri "Çetin Hukuk" --suresiz
node tools/lisans-servisi.mjs engelle LIS-… --veri lisans-veri.json --mesaj "Ödeme bekleniyor: 0XXX XXX XX XX"
node tools/lisans-servisi.mjs etkinlestir LIS-… --veri lisans-veri.json
node tools/lisans-servisi.mjs uzat LIS-… --veri lisans-veri.json --bitis 2028-09-25
node tools/lisans-servisi.mjs serbest-birak LIS-… --veri lisans-veri.json     # lisansı başka bilgisayara taşımak için
node tools/lisans-servisi.mjs listele --veri lisans-veri.json
```

## 6. Yayın uyarısı

2.0.0 kurulumlarda deneme ve lisans anahtarı için lisans servisine bağlanır. **Faz 4 lisans servisi yayında olmadan 2.0.0
GitHub'da yayımlanırsa** yeni kurulumlar denemeyi başlatamaz (yalnızca internetsiz kodla açılır); güncellenen ofisler 30 günlük
geçiş dönemiyle çalışır. Önerilen sıra: Faz 4 lisans API'si → 2.0.0 yayını; ya da 2.0.0 yayını öncesi mevcut ofislere
internetsiz kod verilmesi.

GitHub yayınları herkese açık olduğu sürece 2.0 öncesi sürümler lisanssız indirilebilir; bu, planın E maddesindeki (depoyu
gizliye alma, güncelleme kaynağını Vercel'e taşıma) kararla kapanır.
