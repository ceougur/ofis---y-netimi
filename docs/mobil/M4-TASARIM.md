# M4 — Canlı Bağlantı: Programın Kendiliğinden Açtığı Ofis Tüneli (2.4.7)

Kaynak: CLAUDE.md Açık iş "KARAR (kullanıcı, 26.10.2026, mobil)" (Eylül yolu + sunucu açıkken canlı bağlantı; "tünel program tarafından kapıcı üzerinden
kendiliğinden açılır"; müşteri başına elle iş yok; Cloudflare Access YOK; cloudflared kuruluma KONMAZ, ilk kullanımda indirilir + özet denetlenir);
`docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` §3.1, §4; `docs/mobil/M2-TASARIM.md` §2 (`app.listenRemote`, `mobileRemote.setPublicUrl`); `docs/mobil/M3-TASARIM.md`
§1, §5, §7 (ofis adresi `<ofis>.destekofis.net`, kapıcı önde, `x-do-kapi` işareti, ofis kaydı ve imzası); `docs/2.4.7-IS-LISTESI.md` M4 satırı, "Nasıl bozulur"
(tünel kopar), "Mobil dalga 2 riskleri".
Kod: `server/lib/tunnel/` (release, download, process, config, gate-client, manager, attach), `server/routes/mobile-tunnel.mjs`,
`client/assets/hof-mobile-tunnel.js`, kapıcı bölümü `bulut/kapi/tunel.mjs`. M3'ün `server/lib/kapi-protokol.mjs` ve `server/lib/mobile-ozet.mjs` dosyaları
bu dalda M3'teki hâlleriyle BAYT BAYT AYNI kopyadır (birleşimde M3'ünkiler kalır; sha256 raporda).

## 1. Bütün resim (M3 ile)

```
Telefon ──https──► <ofis>.destekofis.net ── Worker rotası *.destekofis.net/* (M3 kapıcı: cihaz → lisans P9 → yol → x-do-kapi işareti)
                                              └─ fetch(request) = rota kökeni ══ Cloudflare Tunnel ══► cloudflared (ofis sunucusu)
                                                                                                        └─► 127.0.0.1:<uzak port> = app.listenRemote (M2 + M3 işaret)
Program ── POST kapi.destekofis.net/v1/ofis/<ofis>/tunel (M3 ofis imzası) ──► Worker (bulut/kapi/tunel.mjs) ──► Cloudflare API (tünel + DNS)
```

- Telefon tüneli DOĞRUDAN göremez: `<ofis>` adının DNS kaydı proxied CNAME → tünel, ve Worker rotası `*.destekofis.net/*` o adın ÖNÜNDE durur (M3 BAŞ MİMAR
  KARARI 1). Program kapıcı açıkken işaretsiz uzak isteği reddeder (M3 `remote-kapi`). Ofis ağının ana portu tünele HİÇ açılmaz.
- Ücretsiz katman: tünel başvurusu ofis başına açılışta ve ihtiyaçta birkaç Worker isteği; Cloudflare Tunnel ücretsiz.

## 2. Tünel kimliği nasıl alınır (kapıcı) — M3'ün kimlik düzeni, yeni yol YOK

1. Program `POST <kapıcı>/v1/ofis/<ofis>/tunel`, gövde `{ v: 1, ofis }`; imza M3 ile aynı: ofisin ECDSA P-256 anahtarı (`mobile-ozet.mjs ofisKaydi`,
   ayar `meta.mobile.office`), `mesaj.ofis("POST", yol, ms, sha256(gövde))`, başlıklar `x-do-zaman` / `x-do-imza`.
2. Kapıcı (`tunelIstegi`): ofis kimliği biçimi → M3 kaydı (`ofis/<ofis>/meta.json`; yoksa **404 kapi-ofis-yok** — program M3 kaydını bir kez tetikleyip yeniden
   dener) → zaman ±5 dk (**kapi-zaman**) → ofis anahtarıyla imza (**kapi-imza**; başka ofisin anahtarı, başka yol, değişmiş gövde geçmez) → gövde ofisi = yol
   ofisi = kayıt ofisi → M3'ün P9 lisans görünümü (`lisansGorunumu`; engelli/bitmiş **403 kapi-lisans**, 1 saatten eski **503 kapi-lisans-dogrulanamadi**).
   Lisans belirteci (Ed25519) ve ofis anahtarının ilk kayıtta bağlanması (TOFU) M3 kayıt ucunda.
3. Cloudflare (yalnız Worker gizlisindeki hesap belirteciyle): tünel adı `destekofis-<ofis>` yoksa oluşturulur (`config_src: "local"`), varsa yeniden
   kullanılır (eşzamanlı ilk başvuruda "ad var" → yeniden aranır); DNS `<ofis>.destekofis.net` CNAME → `<tünel>.cfargotunnel.com` (proxied) yoksa eklenir,
   farklıysa düzeltilir; tünel çalıştırma belirteci alınır. Kapıcı tünel kimliğini SAKLAMAZ (ad ofis kimliğinden türer; R2'ye yazmaz — M3'ün meta.json
   koşullu yazımıyla yarış yok).
4. Yanıt `{ ok, data: { tunnelId, hostname, publicUrl, token } }`. Hesap belirteci yanıta girmez. Çalıştırma belirteci programda YALNIZ bellekte (diske,
   yapılandırma dosyasına, komut satırına yazılmaz; cloudflared'e ortam değişkeni `TUNNEL_TOKEN` ile).

## 3. cloudflared'in indirilmesi (`release.mjs`, `download.mjs`)

- Sürüm SABİT (`CLOUDFLARED_VERSION`), dosya Windows amd64 (`cloudflared-windows-amd64.exe`) ve Linux amd64; adres Cloudflare'in kendi GitHub yayını.
  SHA-256 kodda sabit; indirilen/diskteki dosyanın özeti uymazsa dosya silinir ve ÇALIŞTIRILMAZ. `--no-autoupdate`: sürüm yalnız program güncellemesiyle
  yükselir. Güven kökü imzalı program güncellemesidir.
- Yer: `<veri>/bilesenler/cloudflared/<sürüm>/cloudflared(.exe)`. Kuruluma girmez (~20–60 MB).
- İndirme `.part`'a akar, akarken özetlenir; tamamlanıp özet tutunca tek adımda yeniden adlandırılır. Yarım indirme / bağlantı kopması → `.part` silinir,
  sonraki deneme baştan. Diskte değiştirilmiş dosya her açılışta yakalanır. Boyut sınırı 150 MB. Disk dolu (ENOSPC) → "Diskte yer kalmadı", 15 dk sonra.
  Yanlış özet → 1 saat sonra (CDN geçici bozukluğu); ağ / kapıcı → 30 sn, 1, 2, 5, 10 dk.
- Eski sürüm klasörleri (ad yalnız `yıl.ay.yama`) yeni sürüm doğrulanınca silinir; başka dosyaya dokunulmaz.
- **ÖZETLER DOLDURULMADAN TÜNEL AÇILMAZ** (durum: "Bağlantı bileşeni bu sürümde tanımlı değil"). Bu ortamdan github.com/cloudflare erişimi yoktu (403);
  özet uydurulmadı. Doldurma §8.

## 4. Yönlendirme yalnız uzak dinleyiciye (`config.mjs`)

- Tünel YEREL yönetimli: giriş kuralları programın yazdığı `tunel.yml`'de (JSON ⊂ YAML). Tek kural: `<ofis>.destekofis.net` → `http://127.0.0.1:<uzak port>`;
  sonra `http_status:404`. Uzak port `app.listenRemote(0, "127.0.0.1")` (her açılışta yeni; yerel yönetim bu yüzden).
- `buildIngress` + `assertSafeIngress`: hizmet tam olarak `http://127.0.0.1:<uzak port>`; uzak port ofis ağı portlarına (ana port, servis yöneticisi kapısı
  `publicPort`, ana dinleyicinin gerçek portu) eşitse yapılandırma KURULMAZ; ek kural, başka hizmet, 0.0.0.0/ağ adresi, 404 olmayan son kural reddedilir.
- `originRequest.httpHostHeader = ofis adı`: uzak dinleyiciye giden Host her zaman ofis adı → M2 çerezleri **Secure** alır (Host yerel döngü değil) ve
  aynı köken denetimi (Origin `https://<ofis adı>`) tutar. M2'nin "Secure için açık ayar"ı budur; mobile-remote.mjs değişmedi.
- Komut satırı: `tunnel --no-autoupdate --config <dosya> --loglevel info --metrics 127.0.0.1:0 --grace-period 3s run` (belirteç yok).

## 5. Süreç yönetimi (`process.mjs`)

- Başlat; çökerse geri çekilmeli yeniden başlat (1, 2, 4, 8, 16, 32 sn, 1, 2, 5 dk; 60 sn ayakta kalırsa sıfırlanır). Bağlanmadan üç kez düşerse
  (belirteç geçersiz, tünel silinmiş) süreç durdurulup kapıcıya yeniden başvurulur.
- Durdur: süreç AĞACI. Windows `taskkill /PID <pid> /T /F`; Linux/macOS ayrı süreç grubu (detached) → gruba SIGTERM, 5 sn sonra SIGKILL.
- Yetim yok: başlatılan pid + ikili yolu `cloudflared.pid`'e yazılır. Program sert öldürülürse (servis yöneticisi taskkill /F, elektrik) sonraki açılışta
  `reapOrphan`: o pid hâlâ AYNI ikiliyi çalıştırıyorsa (Linux `/proc/<pid>/cmdline`, Windows `Win32_Process.CommandLine`) kapatılır; pid başka programa
  geçmişse dokunulmaz (iki bağlayıcı aynı tünelde eski porta 502 verirdi).
- `app.close()` önce tüneli durdurur (servis kapatma, 001 geri yükleme yeniden başlatması, güncelleme); süren tur (indirme, kapıcı) en çok 3 sn beklenir.

## 6. Ne zaman açık — BAŞ MİMAR KARARI (öneri, kullanıcıya gösterilir)

- Tünel YALNIZ: kapıcı adresi tanımlı (M3 ile aynı anahtar: `config.mobileKapiUrl`; server.mjs `mobileKapi: true`; lisans servisi ortam değişkeniyle
  değiştirilmiş test kurulumunda `HUKUK_KAPI_URL` açıkça verilmedikçe boş — ders 30) VE lisans yazılabilir VE (en az bir eşli cihaz VAR **ya da** süresi
  dolmamış bir karekod BEKLİYOR). Eşli cihaz ve bekleyen karekod yoksa cloudflared çalışmaz; cihaz silinince/karekod süresi dolunca 60 sn içinde kapanır.
  Gerekçe: internete açık kapı yalnız kullanılan yerde (en az ayrıcalık); eşli cihaz yokken saldırı yüzeyi sıfır; ücretsiz katman yükü yok. Karekod bekleme
  durumu dahil, çünkü karekodu okutan telefonun eşleme isteği tünelden gelir.
- Adres: M3 ofis adresini kalıptan zaten verir (`setPublicUrl`); tünel başvurusu aynı adı doğrular. "Uzaktan Bağlanabilir" işaretli kullanıcı varsa kapıcıya
  bir kez başvurulur (tünel ve DNS önceden hazır), süreç başlamaz.
- Lisans salt okunur → tünel hemen kapanır; lisans dönünce kendiliğinden açılır. `HUKUK_TUNNEL=0` tüneli her durumda kapatır.
- Göç YOK (çakışma kuralı 1): durum bellekte, ad ortak katman `settings`'te (`mobile.tunnel.info`, gizli değil).

## 7. Yönetim → Mobil Cihazlar → "Uzaktan Bağlantı"

- Durum kartının altında ayrı kart (`#adm-mobile-tunnel`, `hof-mobile-tunnel.js`): **Bağlı** / **Bağlanıyor — <neden>** / **Kapalı — <neden>**;
  "N dk içinde yeniden denenecek."; "Ofis adresi: https://<ofis>.destekofis.net". Kart açıkken 5 sn'de bir yenilenir.
- Nedenler (cümle düzeni): "Eşli cihaz yok; karekod oluşturulunca bağlantı kendiliğinden açılır.", "Lisans geçerli değil; uzaktan bağlantı kapalı.",
  "Bağlantı bileşeni indiriliyor (ilk kullanımda bir kez).", "Kapıcıya başvuruluyor.", "Bağlantı kuruluyor.", "Bağlantı koptu; yeniden kuruluyor.",
  "İndirilen bağlantı bileşeninin özeti beklenenle aynı değil; dosya silindi ve çalıştırılmadı.", "Diskte yer kalmadı; …", "Kapıcıya ulaşılamadı …",
  "Lisans kapıcı tarafından geçerli görülmedi …", "Bu bilgisayarın saati yanlış görünüyor …", "Uzaktan bağlantı bu kurulumda kapalı.",
  "Bağlantı bileşeni bu sürümde tanımlı değil; program güncellemesiyle gelecek.", "Bu işletim sisteminde uzaktan bağlantı bileşeni yok."
- Uç `GET /api/admin/mobile/tunnel` (yalnız `users.manage`); belirteç, yerel port, anahtar dönmez.

## 8. Gerçek kurulum (ana oturum, KULLANICI ONAYIYLA; bu işte hiçbiri yapılmadı)

1. **cloudflared özetleri** (`server/lib/tunnel/release.mjs`): sürüm seç (en az 2 hafta eski kararlı yayın); yayının kendi sayfasındaki SHA-256 listesi ile
   indirilen `cloudflared-windows-amd64.exe` ve `cloudflared-linux-amd64` dosyalarının `sha256sum` çıktısı AYNIYSA iki özet ve sürüm yazılır; gerçek tünel
   AÇMADAN `node -e` ile `ensureBinary` bir kez (Linux) + windows.yml'de bir kez (Windows).
2. **Cloudflare API belirteci (Worker gizlisi `CF_API_TOKEN`)** izinleri: Account → **Cloudflare Tunnel: Edit**; Zone `destekofis.net` → **DNS: Edit**.
   (Worker yükleme için ayrı belirteç: Account → **Workers Scripts: Edit**, **Workers R2 Storage: Edit**, Zone → **Workers Routes: Edit**.) Bugünkü ortam
   belirtecinde Tunnel yazma izni belirsiz → gerekirse kullanıcı panelden ekler.
3. **wrangler.toml** (M3'ün dosyası; birleşimde) `[vars]`'a `CF_ACCOUNT_ID`, `CF_ZONE_ID = "a4521bf58a43349c69a0fdafb985bc83"`; gizli: `wrangler secret put CF_API_TOKEN`.
4. Dağıtım M3 ile tek Worker (`wrangler deploy`). Doğrulama: `curl -X POST https://kapi.destekofis.net/v1/ofis/oaaaaaaaaaaaaaaaa/tunel -d '{}'` → 404
   `kapi-ofis-yok` (kayıtsız) — Cloudflare'e çağrı olmadan.
5. İlk gerçek tünel kullanıcının KENDİ kurulumunda (gerçek lisans): "Uzaktan Bağlanabilir" → karekod → telefonda eşleme; Cloudflare panelinde
   `destekofis-<ofis>` tüneli 1–4 bağlantılı, DNS `<ofis>` proxied (turuncu bulut), Worker rotası önde.

## 9. M3 kapıcısına bağlama (birleştirmeyi ana oturum yapar)

`bulut/kapi/kapi.mjs` içinde iki ekleme:
```js
import { TUNEL_YOLU, tunelIstegi } from "./tunel.mjs";
// fetchHandler içinde, `const program = /^\/v1\/ofis\/…(kayit|ozet)$/…` satırından ÖNCE:
      if (TUNEL_YOLU.test(url.pathname)) return await tunelIstegi(request, env, { now, lisansGorunumu });
```
`now` ve `lisansGorunumu` createKapi kapanışındaki aynı adlı işlevlerdir (P9 ve önbellek M3'ünkü).

## 10. BİLİNEN SINIRLAR

- cloudflared kenara 7844 (QUIC/UDP, yoksa HTTP/2 TCP) ile çıkar; yalnız HTTP vekil sunucusuyla internete çıkan ofislerde tünel kurulamaz (indirme ve
  kapıcı başvurusu vekilden geçer, tünel bağlantısı geçmez). Telefon M3'ün son özetiyle çalışır.
- Ad/tünel temizliği (lisansı biten ofisin tüneli) yok; Cloudflare'de birikir (ücretsiz). Operatör işi, sonraki sürüm.
- Windows'ta yetim denetimi PowerShell `Get-CimInstance` (~1 sn, yalnız açılışta).
- Bu dalda gerçek `kapi.mjs` YOK: kapıcı testleri M3 kaydının biçimini ve P9 görünümünü test içinde kurar; M3 + M4 birleşiminde gerçek `createKapi` ile uçtan
  uca bir test (kayıt → tünel başvurusu → vekil işaretiyle istek) eklenmeli.
