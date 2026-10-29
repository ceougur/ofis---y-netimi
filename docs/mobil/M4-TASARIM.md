# M4 — Canlı Bağlantı: Programın Kendiliğinden Açtığı Ofis Tüneli (2.4.7)

Kaynak: CLAUDE.md Açık iş "KARAR (kullanıcı, 26.10.2026, mobil)" (Eylül yolu + sunucu açıkken canlı bağlantı; "tünel program tarafından kapıcı üzerinden
kendiliğinden açılır"; müşteri başına elle iş yok; Cloudflare Access YOK; cloudflared kuruluma KONMAZ, ilk kullanımda indirilir + özet denetlenir);
`docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` §3.1, §4; `docs/mobil/M2-TASARIM.md` §2 (M4'e bırakılan arayüz: `app.listenRemote`, `mobileRemote.setPublicUrl`);
`docs/2.4.7-IS-LISTESI.md` M4 satırı, "Nasıl bozulur" (tünel kopar), "Mobil dalga 2 riskleri".
Kod: `server/lib/tunnel/` (release, download, process, config, gate-client, manager, attach), `server/routes/mobile-tunnel.mjs`,
`client/assets/hof-mobile-tunnel.js`, kapıcı bölümü `bulut/kapi/tunel.mjs`.

## 1. Bütün resim

```
Telefon ──https──► Cloudflare kenarı (ofis-<etiket>.destekofis.net) ══tünel══► cloudflared (ofis sunucusu)
                                                                               └─► 127.0.0.1:<uzak port>  = app.listenRemote (M2 kapısı)
Program ──(açılışta / ihtiyaç olunca)── POST kapi.destekofis.net/v1/tunel ──► Worker (bulut/kapi/tunel.mjs) ──► Cloudflare API (tünel + DNS)
```

- Tünel trafiği Worker'dan GEÇMEZ (Cloudflare kenarı doğrudan cloudflared'e verir); Worker yalnız tüneli kurar/yeniden kullanır. Her uzak isteğin kapısı
  programın uzak dinleyicisidir (M2: cihaz çerezi, lisans, yol beyaz listesi, uzak oturum). Ofis ağının ana portu tünele HİÇ açılmaz.
- Ücretsiz katman: Worker isteği yalnız tünel başvurusunda (ofis başına açılışta ve ihtiyaçta birkaç istek/gün); Cloudflare Tunnel ücretsiz.

## 2. Tünel kimliği nasıl alınır (kapıcı)

1. Program `POST <kapıcı>/v1/tunel` gönderir: `{ v: 1, license, machine, publicKey, ts, nonce, sig }`.
   - `license`: programın kayıtlı imzalı lisans zarfı (ayar `license.token`), olduğu gibi.
   - `publicKey`: programın kendi Ed25519 anahtarının açık kısmı (ilk kullanımda üretilir; özel kısım ortak katman ayarında `mobile.tunnel.key`, veri
     klasöründeki kasa anahtarıyla — secret-box — mühürlü; diske açık yazılmaz, istekte gitmez).
   - `sig` = Ed25519 imzası, metin: `DestekOfis-tunel-v1\n<machine>\n<publicKey>\n<ts>\n<nonce>\n<sha256(license.payload)>`.
2. Kapıcı: lisans zarfını güvenilen lisans anahtarıyla doğrular (WebCrypto Ed25519; ürün/tür; durum active; başlangıç ≤ şimdi < bitiş; düzenlenme ≤ 8 gün
   önce — programın 7 günlük internetsiz toleransı + 12 saatlik denetim aralığı payı); `machine` = lisansın bilgisayarı; `ts` ±5 dk; imza.
3. İLK KULLANIMDA GÜVEN: KV `tunel:<machine>` yoksa açık anahtar ofise bağlanır; varsa aynı anahtar istenir (değilse **409 tunnel-key**). Gerekçe: lisans
   zarfı tek başına gizli değildir (internetsiz etkinleştirme kodu e-postayla dolaşabilir — zarfın kendisidir); sızan kod başka anahtarla tüneli alamaz.
4. Cloudflare (yalnız Worker gizlisindeki hesap belirteciyle): tünel adı `destekofis-<etiket>` yoksa oluşturulur (`config_src: "local"`), varsa yeniden
   kullanılır (eşzamanlı ilk başvuruda oluşturma "ad var" düşerse yeniden aranır); DNS `ofis-<etiket>.destekofis.net` CNAME → `<tünel>.cfargotunnel.com`
   (proxied) yoksa eklenir, farklıysa düzeltilir; tünel çalıştırma belirteci alınır.
5. Yanıt `{ ok, tunnelId, hostname, publicUrl, token }`. Hesap belirteci yanıta, KV'ye, günlüğe girmez. Çalıştırma belirteci programda YALNIZ bellekte
   (diske, yapılandırma dosyasına, komut satırına yazılmaz; cloudflared'e ortam değişkeni `TUNNEL_TOKEN` ile).

Etiket = `sha256("DestekOfis-ofis-v1|<machine>")` ilk 16 onaltılık (64 bit): bilgisayar kimliği DNS'te görünmez.

## 3. cloudflared'in indirilmesi (`release.mjs`, `download.mjs`)

- Sürüm SABİT (`CLOUDFLARED_VERSION`), dosya Windows amd64 (`cloudflared-windows-amd64.exe`) ve Linux amd64; adres Cloudflare'in kendi GitHub yayını.
  SHA-256 kodda sabit; indirilen/diskteki dosyanın özeti uymazsa dosya silinir ve ÇALIŞTIRILMAZ. `--no-autoupdate`: sürüm yalnız program güncellemesiyle
  (bu dosya değişerek) yükselir. Güven kökü imzalı program güncellemesidir.
- Yer: `<veri>/bilesenler/cloudflared/<sürüm>/cloudflared(.exe)`. Kuruluma girmez (~20–60 MB).
- İndirme `.part`'a akar, akarken özetlenir; tamamlanıp özet tutunca tek adımda yeniden adlandırılır. Yarım indirme / bağlantı kopması / program kapanması →
  `.part` silinir, sonraki deneme baştan. Diskte değiştirilmiş dosya her açılışta yakalanır (özet yeniden). Boyut sınırı 150 MB. Disk dolu (ENOSPC) → durum
  "Diskte yer kalmadı", 15 dk sonra yeniden. Yanlış özet → 1 saat sonra yeniden (CDN geçici bozukluğu); ağ → 30 sn, 1, 2, 5, 10 dk.
- Eski sürüm klasörleri (ad yalnız `yıl.ay.yama`) yeni sürüm doğrulanınca silinir; klasördeki başka dosyaya dokunulmaz.
- **ÖZETLER DOLDURULMADAN TÜNEL AÇILMAZ** (durum: "Bağlantı bileşeni bu sürümde tanımlı değil"). Bu ortamdan github.com/cloudflare erişimi yoktu (403);
  özet uydurulmadı. Doldurma adımları §8.

## 4. Yönlendirme yalnız uzak dinleyiciye (`config.mjs`)

- Tünel YEREL yönetimli: giriş kuralları programın yazdığı `tunel.yml`'de (JSON ⊂ YAML). Tek kural: `ofis-<etiket>.destekofis.net` →
  `http://127.0.0.1:<uzak port>`; sonra `http_status:404`. Uzak port `app.listenRemote(0, "127.0.0.1")` (her açılışta yeni; yerel yönetim bu yüzden).
- `buildIngress` + `assertSafeIngress`: hizmet tam olarak `http://127.0.0.1:<uzak port>`; uzak port ofis ağı portlarına (ana port, servis yöneticisi kapısı
  `publicPort`, ana dinleyicinin gerçek portu) eşitse yapılandırma KURULMAZ; ek kural, başka hizmet, 0.0.0.0/ağ adresi, 404 olmayan son kural reddedilir.
- `originRequest.httpHostHeader = ofis adı`: uzak dinleyiciye giden Host her zaman ofis adı → M2 çerezleri **Secure** alır (Host yerel döngü değil) ve
  aynı köken denetimi (Origin `https://<ofis adı>`) tutar. Bu, M2'nin "Secure için açık ayar" maddesinin karşılığı; mobile-remote.mjs değişmedi.
- Komut satırı: `tunnel --no-autoupdate --config <dosya> --loglevel info --metrics 127.0.0.1:0 --grace-period 3s run` (belirteç yok).

## 5. Süreç yönetimi (`process.mjs`)

- Başlat; çökerse geri çekilmeli yeniden başlat (1, 2, 4, 8, 16, 32 sn, 1, 2, 5 dk; 60 sn ayakta kalırsa sıfırlanır). Bağlanmadan üç kez düşerse
  (belirteç geçersiz, tünel silinmiş) süreç durdurulup kapıcıya yeniden başvurulur.
- Durdur: süreç AĞACI. Windows `taskkill /PID <pid> /T /F`; Linux/macOS ayrı süreç grubu (detached) → gruba SIGTERM, 5 sn sonra SIGKILL.
- Yetim yok: başlatılan pid + ikili yolu `cloudflared.pid`'e yazılır. Program sert öldürülürse (servis yöneticisi taskkill /F, elektrik) sonraki açılışta
  `reapOrphan`: o pid hâlâ AYNI ikiliyi çalıştırıyorsa (Linux `/proc/<pid>/cmdline`, Windows `Win32_Process.CommandLine`) kapatılır; pid başka programa
  geçmişse dokunulmaz. Böylece güncelleme / servis yeniden başlatması iki bağlayıcı bırakmaz (iki bağlayıcı aynı tünelde eski porta 502 verirdi).
- `app.close()` önce tüneli durdurur (servis kapatma, 001 geri yükleme yeniden başlatması, güncelleme).

## 6. Ne zaman açık — BAŞ MİMAR KARARI (öneri, kullanıcıya gösterilir)

- Tünel (cloudflared) YALNIZ: lisans yazılabilir VE (en az bir eşli cihaz VAR **ya da** süresi dolmamış bir karekod BEKLİYOR). Eşli cihaz ve bekleyen
  karekod yoksa çalışmaz; cihaz silinince/karekod süresi dolunca kapanır (`stopGraceMs` 60 sn — titreşmesin).
  Gerekçe: internete açık kapı yalnız kullanılan yerde (en az ayrıcalık); ücretsiz katman yükü yok; eşli cihaz yokken saldırı yüzeyi sıfır. Karekod
  bekleme durumu dahil, çünkü karekodu okutan telefonun eşleme isteği tünelden gelir.
- Adres önceden hazır: "Uzaktan Bağlanabilir" işaretli kullanıcı varsa kapıcıya bir kez başvurulur, ad saklanır (`mobile.tunnel.info`, gizli değil) ve
  karekoda verilir (`setPublicUrl`); süreç başlamaz. Böylece "Karekod Oluştur" ilk kez basıldığında karekod boş adresle çıkmaz.
- Lisans salt okunur → tünel hemen kapanır (M2 zaten her uzak isteği reddeder; kapı açık kalmasın). Lisans dönünce kendiliğinden açılır.
- Test kurulumu (lisans adresi yalnız yerel döngü — ders 30 düzeni) ve kapıcı adresi açıkça verilmemişse gerçek kapıcıya HİÇ gidilmez ("bu kurulumda
  kapalı"). `HUKUK_TUNNEL=0` tüneli her durumda kapatır; `HUKUK_KAPI_URL` kapıcı adresini değiştirir (varsayılan `https://kapi.destekofis.net`).
- Göç YOK (çakışma kuralı 1): durum bellekte, ad ve anahtar ortak katman `settings` tablosunda.

## 7. Yönetim → Mobil Cihazlar → "Uzaktan Bağlantı"

- Durum kartının altında ayrı kart (`#adm-mobile-tunnel`, `hof-mobile-tunnel.js`): **Bağlı** / **Bağlanıyor — <neden>** / **Kapalı — <neden>**;
  "N dk içinde yeniden denenecek."; "Ofis adresi: https://ofis-….destekofis.net". Kart açıkken 5 sn'de bir yenilenir.
- Nedenler (cümle düzeni): "Eşli cihaz yok; karekod oluşturulunca bağlantı kendiliğinden açılır.", "Lisans geçerli değil; uzaktan bağlantı kapalı.",
  "Bağlantı bileşeni indiriliyor (ilk kullanımda bir kez).", "Kapıcıya başvuruluyor.", "Bağlantı kuruluyor.", "Bağlantı koptu; yeniden kuruluyor.",
  "İndirilen bağlantı bileşeninin özeti beklenenle aynı değil; dosya silindi ve çalıştırılmadı.", "Diskte yer kalmadı; …", "Kapıcıya ulaşılamadı …",
  "Bu ofisin uzaktan bağlantısı başka bir kurulumla eşli. Destek ile iletişime geçin.", "Uzaktan bağlantı bu kurulumda kapalı.",
  "Bağlantı bileşeni bu sürümde tanımlı değil; program güncellemesiyle gelecek.", "Bu işletim sisteminde uzaktan bağlantı bileşeni yok."
- Uç `GET /api/admin/mobile/tunnel` (yalnız `users.manage`); belirteç, yerel port, anahtar dönmez.

## 8. Gerçek kurulum (ana oturum, KULLANICI ONAYIYLA; bu işte hiçbiri yapılmadı)

1. **cloudflared özetleri** (`server/lib/tunnel/release.mjs`): sürüm seç (en az 2 hafta eski kararlı yayın); yayının kendi sayfasındaki SHA-256 listesi ile
   indirilen `cloudflared-windows-amd64.exe` ve `cloudflared-linux-amd64` dosyalarının `sha256sum` çıktısı AYNIYSA iki özet ve sürüm yazılır;
   `npm test` (tunel-indirici) + Windows'ta bir kez gerçek indirme (windows.yml) — gerçek tünel AÇMADAN.
2. **Cloudflare API belirteci (Worker gizlisi `CF_API_TOKEN`)** izinleri: Account → **Cloudflare Tunnel: Edit**; Zone `destekofis.net` → **DNS: Edit**;
   (Worker yükleme için ayrı belirteç: Account → **Workers Scripts: Edit**, **Workers KV Storage: Edit**). Bugünkü ortam belirtecinde Tunnel yazma izni
   belirsiz (yalnız liste okunuyor) → gerekirse kullanıcı panelden ekler.
3. **KV ad alanı** `DESTEKOFIS_KAPI` (ya da M3'ün KV'si; anahtar öneki `tunel:`), Worker'a bağlanır.
4. **Worker gizlileri / değişkenleri**: `CF_API_TOKEN` (gizli), `CF_ACCOUNT_ID`, `CF_ZONE_ID` (= `a4521bf58a43349c69a0fdafb985bc83`), `DOMAIN=destekofis.net`,
   lisans açık anahtarları (`server/lib/license-keys.mjs` ile aynı).
5. **Worker yolu** `kapi.destekofis.net/*` (M3 kapıcısıyla aynı Worker). DNS'te `kapi` kaydı Worker özel alan adı olarak.
6. Komutlar (örnek, Wrangler; onaydan sonra): `wrangler kv namespace create DESTEKOFIS_KAPI`; `wrangler secret put CF_API_TOKEN`; `wrangler deploy`.
   Doğrulama: `curl -X POST https://kapi.destekofis.net/v1/tunel -d '{}'` → 400 `tunnel-request`.
7. İlk gerçek tünel: kullanıcının KENDİ test kurulumunda (gerçek lisans), "Uzaktan Bağlanabilir" → karekod → telefonda eşleme; Cloudflare panelinde
   `destekofis-<etiket>` tüneli 1–4 bağlantılı, DNS `ofis-<etiket>` proxied.

## 9. M3 kapıcısına bağlama (birleştirmeyi ana oturum yapar)

```js
// bulut/kapi/<M3'ün giriş dosyası>.mjs içinde:
import { TUNNEL_GATE_PATH, createCloudflareTunnels, createTunnelGate } from "./tunel.mjs";
const tunnelGate = env => createTunnelGate({
  cloudflare: createCloudflareTunnels({ accountId: env.CF_ACCOUNT_ID, zoneId: env.CF_ZONE_ID, apiToken: env.CF_API_TOKEN }),
  kv: env.DESTEKOFIS_KAPI,                 // Workers KV: get(key) → string|null, put(key, value)
  trustedKeys: LICENSE_KEYS,               // { keyId: SPKI DER base64 } — license-keys.mjs ile aynı
  domain: env.DOMAIN || "destekofis.net",
  // isteğe bağlı: licenseStatus: async claims => <M3'ün lisans servisi engel sorgusu>,
});
// fetch işleyicisinde, M3'ün yönlendirmesinden ÖNCE:
if (new URL(request.url).pathname === TUNNEL_GATE_PATH) return tunnelGate(env).handleTunnelRequest(request);
```
- `verifyLicenseEnvelope` (WebCrypto) M3'ün lisans denetiminde de kullanılabilir (aynı kural; P9 1 saat tazeliği M3'te `maxAgeMs` ile).
- Operatör işi: `resetBinding(machine)` (aynı bilgisayara temiz kurulum, anahtar kaybı) — Operatör Merkezi'ne bağlanması M3/site işi.

## 10. BİLİNEN SINIRLAR

- cloudflared kenara 7844 (QUIC/UDP, yoksa HTTP/2 TCP) ile çıkar; yalnız HTTP vekil sunucusuyla internete çıkan ofislerde tünel kurulamaz (indirme ve
  kapıcı başvurusu vekilden geçer, tünel bağlantısı geçmez). Durum "Bağlantı koptu; yeniden kuruluyor." olarak kalır.
- Sızan etkinleştirme kodu, ofis hiç mobil açmamışken İLK başvuruyu yaparsa o ofis adını kendi anahtarına bağlar (ad ofisin programına verilmez; ofis 409
  görür → destek `resetBinding`). Ofis adı altında başka içerik yayınlanma riski bu dar pencereyle sınırlı.
- Aynı bilgisayara veri klasörü silinerek temiz kurulum → yeni anahtar → 409 → destek işi (otomatik yeniden bağlama ele geçirme penceresi açardı).
- Ad/tünel temizliği (lisansı biten ofisin tüneli) yok; Cloudflare'de birikir (ücretsiz). Operatör işi, sonraki sürüm.
- Windows'ta yetim denetimi PowerShell `Get-CimInstance` (~1 sn, yalnız açılışta).
