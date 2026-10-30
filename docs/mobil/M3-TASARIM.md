# M3 — Şifreli Özet, Kapıcı (Worker) ve Sunucu Kapalıyken Telefon (2.4.7)

Kaynak: CLAUDE.md Açık iş "MOBİL" ve "KARAR (kullanıcı, 26.10.2026, mobil)" ×3 (Eylül yolu: şifreli özet R2 + Worker kapıcı + karekodlu eşleme; müşteri
başına elle iş YOK; kota dolmaz; Cloudflare Access YOK; mobil herkese, Pro kilidi YOK; 3 cihaz sınırı programda VE kapıcıda); `docs/PRO-UZAKTAN-GORUNTULEME.md`
(mimari ve şifreleme geçerli; Pro maddeleri geçersiz); `docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` §3.1, §4; `docs/2.4.7-IS-LISTESI.md` "KARARLAR — M2" P1–P14
(özellikle P9, P10); `docs/mobil/M2-TASARIM.md`; bağımsız kâhin `test/bagimsiz/mobil-erisim/`. Para kuralı YOK.

Kod: `server/lib/kapi-protokol.mjs` (ortak, saf WebCrypto), `server/lib/mobile-ozet.mjs` (şifreleme, ofis anahtarı, kapıcı istemcisi),
`server/lib/mobile-sync.mjs` (özet üretici, tetikler, yükleyici, M2 kapısına bağlantı), `bulut/kapi/kapi.mjs` + `wrangler.toml` (Worker),
`client/mobil/ozet.js` + `ozet.css` (telefon; çevrimdışı katman — `app.js`'te yalnız bağlantı satırları), göç v39 (`mobile_devices.enc_key`). Testler:
`test/kapi-247.test.mjs`, `test/mobil-ozet-247.test.mjs`, `test/e2e/senaryo-mobil-ozet-247.mjs`, `test/kapi-247-mutasyon.py`, kâhin sürücüsü eki
`test/bagimsiz/mobil-erisim/m3-surucu.mjs`.

## 1. Adresler

| Ad | Ne | Kim çağırır |
|---|---|---|
| `kapi.destekofis.net` | Kapıcının program uçları: `POST /v1/ofis/<ofis>/kayit`, `PUT/DELETE /v1/ofis/<ofis>/ozet` | Ofis sunucusu (program) |
| `<ofis>.destekofis.net` | Ofisin telefon adresi. Kapıcı önde: `/kapi/ozet` kapıcının kendisi; geri kalan her yol (`/mobil/`, `/api/mobil/`) kapıdan sonra ofisin tüneline (M4) | Telefon / tablet / uzak tarayıcı |
| `m.destekofis.net` | Genel karşılama sayfası ("karekodu okutun") | Herkes |

Ofis kimliği `o` + 16 base32 harf (80 bit rastgele; programda `meta.mobile.office` ayarı, geri yüklemede canlıdan kalır). Karekod artık
`https://<ofis>.destekofis.net/mobil/#eslesme=<kod>` taşır (M2 `setPublicUrl`; kapıcı açıkken program kalıptan kendisi kurar).

**BAŞ MİMAR KARARI 1 — telefon sayfası ofis başına alt adda, `m.` karşılama.** Görevde "telefon sayfası `m.destekofis.net`" yazıyordu; devir belgesi ayrıca
"tünel ofis başına alt ad" diyor. İkisini tek adreste (`m.…/o/<ofis>/…`) birleştirmek çerez yolu yeniden yazımı, Origin yeniden yazımı ve tek kökende iki
ofisin tarayıcı deposunu (anahtarlar!) paylaşması demekti. Ofis başına köken (OWASP ASVS 4.0.3 V3.4 çerez kapsamı, V14 güvenli yapılandırma; "kiracı başına
köken" yaygın uygulama): her ofisin çerezi, IndexedDB'si (cihaz anahtarları) ve service worker'ı ayrı; Worker o alt adın ÖNÜNDE durduğu için tünele
kapıcıyı atlatan yol yoktur (rota tüm alt adı kapsar); program M2'deki yol düzenini (`/mobil/`, `/api/mobil/`) hiç değiştirmeden kullanır. Cloudflare
evrensel sertifikası `*.destekofis.net`'i kapsar (ek ücret yok). `m.` kalır: karşılama + ileride ofis seçimi. Kullanıcı `m.` üzerinde tek adres isterse
`app.js` yalnız `API` tabanını değiştirerek taşınabilir (açık soru 1).

## 2. Özetin içeriği (kullanıcıya göre süzülür)

- Eşli ve şifreleme anahtarı olan cihazı bulunan HER KULLANICI için ayrı hazırlanır; içerik programın KENDİ uçlarından, o kullanıcının uzak oturumuyla (iç
  istek) alınır. Şirket erişimi (`companies.canAccess`), rol yetkisi ve lisans kuralı o uçlarda; burada tekrar edilmez (tek kaynak) → yetkisiz şirket ya da
  bölüm o kullanıcının özetine HİÇ girmez (kâhin K23).
- Bölümler (M1 ekranları = Eylül listesi): oturum (görebildiği şirketler), Nakit Kasa, Banka (özet + hesaplar), Cari Hesaplar (en çok 500 satır + ilk 50
  carinin ayrıntısı), Stok (500 + ilk 30 ayrıntı), Taksit özeti, Anlık Durum (yalnız yönetici). Yanıtlar M1 uçlarının biçiminde saklanır; telefon aynı
  ekranları aynı koddan çizer, liste aramasını özetin içinde yapar.
- Raporlar (parametreli), PDF/Excel çevrimdışı YOK (BAŞ MİMAR KARARI 2: her parametre birleşimini önceden üretmek boyutu ve süreyi patlatır; Eylül listesinde
  yok). Ekranda "Raporlar ofis sunucusu açıkken alınır" yazar.
- Boyut: ofis başına tek nesne; 6 MB'ı aşarsa ayrıntılar kırpılır (liste ve bakiyeler kalır); kapıcının üst sınırı 8 MB.

## 3. Şifreleme (MASVS-CRYPTO-1/2, ASVS V6.2.1–6.2.5: yalnız standart, WebCrypto'da hazır algoritmalar)

- Her yüklemede, her kullanıcı için YENİ 256 bit veri anahtarı: AES-256-GCM, 96 bit rastgele IV, ek veri `veri|ofis|sıra|kullanıcı`; içerik gzip'li JSON.
- Sarma: yüklemeye özgü geçici ECDH P-256 × cihazın şifreleme anahtarı → HKDF-SHA-256 (tuz `DestekOfis-ozet-v1|ofis|sıra`, bilgi `sarma|cihaz`) →
  AES-256-GCM (ek veri `sarma|ofis|sıra|cihaz|kullanıcı`). Bir cihaz yalnız kendi kullanıcısının veri anahtarını açar.
- **BAŞ MİMAR KARARI 3 — cihazda AYRI şifreleme anahtarı.** M2'nin ECDSA anahtarı imza içindir (aynı anahtarı iki amaçla kullanmak NIST SP 800-57 §5.2'ye
  aykırı). Eşlemede telefon ikinci, dışa aktarılamaz (`extractable: false`) ECDH P-256 anahtarı üretir (IndexedDB, ofis kökeninde); açık kısmı eşleme
  isteğiyle programa gider (`mobile_devices.enc_key`, göç v39). M2 ile eşlenmiş (anahtarsız) cihaz özeti açamaz → yeniden eşlenir (2.4.7 henüz yayında değil).
- Bütünlük: gövde metni ofisin ECDSA P-256 imza anahtarıyla imzalanır. Telefon eşlemede programdan aldığı ofis anahtarını saklar ve imza doğrulanmadan hiçbir
  alanı kullanmaz; sıranın gerilemesini (eski özetin yeniden oynatılması) reddeder.
- **Anahtar yenileme:** her yükleme yeni veri anahtarı ve yeni geçici anahtar kullanır; silinen / izni kalkan cihaza bir sonraki özette sarılmış anahtar
  yoktur → yeni özeti açamaz (Eylül: "cihaz silinince veri anahtarı yenilenir"; daha güçlüsü: her yüklemede). Cihaz silme, izin, kullanıcı/rol/şirket
  erişimi değişikliği hemen yükleme tetikler (§4). Silinen cihazın önceden açtığı içerik ekranında kalabilir (kâhin V21); çözülen içerik yalnız bellekte.
- Kapıcı ve Cloudflare içeriği okuyamaz (anahtar yalnız ofiste ve eşli cihazlarda).

## 4. Yükleme tetikleri ve sınırlar (Eylül planı)

- Veri değişikliği (her başarılı yazma isteği): en çok 15 dakikada bir; 10 dakika hareketsizlikte; değişiklik yoksa hiç (gece/hafta sonu sıfır); günde en
  çok 40 veri yüklemesi (İstanbul günü; 29.10.2026 Q3 — Eylül planında 20).
- Güvenlik değişikliği (eşleme, cihaz silme, Uzaktan Bağlanabilir, kullanıcı/rol, şirket erişimi, lisans): HEMEN (veri sınırını beklemez).
- Program kapanırken bekleyen değişiklik varsa son hâl yüklenir (en çok 5 sn).
- Açılışta ve lisans belirteci yenilenince kapıcıya yalnız KAYIT (ofis anahtarı, lisans belirteci, cihaz listesi, işaret sırrı).
- Lisans yazılabilir değilse özet yüklenmez (K14); kapıcıya lisansın son hâli bildirilir. Hiç eşli (anahtarlı) cihaz yoksa buluttaki özet silinir.
- Kapıcı tarafı: ofis başına günde ≤ 200 yükleme, dakikada ≤ 30; özet ≤ 8 MB; kayıt ≤ 64 KB; sıra kesin artar (yeniden oynatma reddi).

## 5. Kapıcının görevleri (bulut/kapi/kapi.mjs)

- **Ofisin yazma yetkisi:** lisans servisinin imzaladığı lisans belirteci (Ed25519; programın mevcut zarfı ve `license-keys.mjs` açık anahtarı — env
  `LISANS_ANAHTARLARI`) + ofisin ECDSA imza anahtarı. Ofis anahtarı ilk kayıtta bağlanır (TOFU); sonra her istek o anahtarla imzalı (yöntem, yol, zaman,
  gövde özeti; ±5 dk); kayıt zamanı kesin artar (silinmiş cihazı geri getiren eski kayıt yeniden oynatılamaz). Başka anahtarla aynı kimlik reddedilir.
- **Cihazın okuma yetkisi:** programın yüklediği cihaz listesi (M2 `gatekeeperSnapshot`) + cihazın M2 imza anahtarıyla imzalı istek
  (`DestekOfis-kapi-cihaz\nGET\n/kapi/ozet\n<cihaz>\n<ms>`, ±5 dk; saat kaymışsa kapıcı kendi saatini döner, telefon bir kez düzeltir).
- **3 cihaz sınırı kapıcıda da (K13):** kayıtta EKLENEN cihaz varsa toplam lisanstaki `mobileDevices`'ı (yoksa 3) aşamaz; P5: sayı düşerse mevcutlar sürer.
  Cihaz SİLME her durumda uygulanır. Program atlatılıp kapıcıya doğrudan kayıt yapılsa da sınır aşılamaz.
- **P9 lisans tazeliği:** kapıcı en yeni imzalı belirteci (kayıttaki, önbellekteki, gerekirse lisans servisinden yeni) kullanır; `issuedAt` 30 dk'dan
  eskiyse servisten yeniler; 60 dk'dan eskiyse "lisans doğrulanamadı" (fail-closed). Engelli / süresi bitmiş belirteç "lisans geçerli değil".
- **Canlı bağlantı kapısı (M4'ün kapıcı tarafı):** `<ofis>.destekofis.net` üzerindeki her istek: cihaz (programın HttpOnly cihaz çerezinin kimlik bölümü
  kapıcının listesinde; sırrı program doğrular) → lisans (P9) → yol (M2 ile TEK kural, `yolSorunu`) → hız → tünele iletim + `x-do-kapi` işareti
  (`<ms>.<cihaz>.<HMAC-SHA-256(ofis sırrı)>`). Program kapıcı açıkken işaretsiz ya da çerezle uyuşmayan uzak isteği reddeder (`remote-kapi`). Tünel
  kapalıysa `kapi-ofis-kapali` (503) → telefon son özete geçer.
- **BAŞ MİMAR KARARI 4 — ret sırası kâhinle aynı:** cihaz → lisans → (sınır aşımı: P5 gereği yok) → yol → sunucu (kâhin V16). Cihazsız yalnız eşleme ucu
  ve `/mobil/` sayfa dosyaları geçer (M2 BAŞ MİMAR KARARI 9).
- **BAŞ MİMAR KARARI 5 — kapıcı durumu R2'de, lisans önbelleği Cache API'de.** Ofis başına iki nesne: `ofis/<ofis>/meta.json` (anahtar, cihazlar, sır, son
  kayıt, sıra; yalnız kayıtta yazılır) ve `ofis/<ofis>/ozet.json` (tek özet; sayaçlar nesnenin kendi üst verisinde). Lisans yenilemesi R2'ye yazmaz
  (Cache API ücretsiz) — aylık R2 yazımı ≈ ofis × yükleme. (Bağımsız gözden geçirme B3'ten sonra kayıt ve tünel uçları ayrıca `makine/<makine>.json`'a
  makine → ofis eşlemesini ve hız sayaçlarını, `sayac/yeni-ofis/<gün>.json`'a günlük yeni ofis sayısını yazar — `bulut/kapi/makine.mjs`.) Eşzamanlı yazım R2 koşullu yazımıyla (etag) korunur.
- Hız sınırı: Cloudflare Rate Limiting bağlaması (`HIZ`) varsa o; yoksa isolate içi sayaç (canlı 300/dk, özet 30/dk, cihaz başına).

## 6. Telefon (client/mobil — M1 arayüzünün AYNISI)

- Ayrı kopya ve derleme YOK: sayfa dosyaları programdan (`client/mobil/`), tünel üzerinden gelir; service worker kabuğu önbelleğe alır (kapıcı 503
  verince de önbellekten açar). Böylece telefon sayfası programla aynı güncellemeyle değişir; Cloudflare'e sayfa yüklenmez (yalnız Worker).
- Oturum sürerken sunucuya ulaşılamazsa sayfa kendiliğinden son özete geçer; açılışta sunucu yoksa giriş ekranında "Son Özeti Göster". Üstte şerit:
  "Ofis sunucusuna ulaşılamıyor. Son güncelleme: … — bilgiler salt okunurdur"; üst çubukta "Son Güncelleme …". Yenile (↻) önce canlıyı dener.
- Kayıt yok (mobil zaten salt okunur; M5'e kadar). Raporlar ve PDF/Excel çevrimdışı kapalı (gerekçeli ileti).
- **BAŞ MİMAR KARARI 6 — çevrimdışı görünümde parola sorulmaz.** Sunucu kapalıyken parola doğrulanamaz; özet yalnız bu tarayıcıdaki dışa aktarılamaz
  anahtarla açılır (cihaz bağlama; MASVS-AUTH-2 "cihaza bağlı" ). Kâhin `ozet_oku` olayı da yalnız cihaz ister. Koruma telefonun ekran kilidi; Eylül'deki
  PIN / parmak izi yerel kilidi sonraki adım (BİLİNEN SINIR, açık soru 2).
- P10: özette yaş sınırı yok; "Son güncelleme" görünür.

## 7. M4'e bırakılan arayüz

- Kapıcı tarafı hazır: `<ofis>.destekofis.net` rotasında kapı + iletim (`createKapi({ fetchOrigin })`; üretimde `fetch(request)` rota kökenine = tünel).
- M4'ün işi: cloudflared'ı ilk kullanımda indirip doğrulamak, tüneli (kapıcı üzerinden, ofis başına) açıp `<ofis>.destekofis.net` adını tünele bağlamak,
  tüneli YALNIZ `app.listenRemote` dinleyicisine yönlendirmek. Program tarafında `mobileRemote.setPublicUrl` (adres) ve `x-do-kapi` doğrulaması hazır.
- Lisans servisi (site deposu) gereksinimleri `docs/mobil/M3-TASARIM.md` §8.

## 8. Lisans servisinde gerekenler (site deposu — bu işte DOKUNULMADI)

1. (M2'den) Lisans belirtecine isteğe bağlı `mobileDevices` (0–100 tam sayı; varsayılan 3): `lisans.licenses` sütunu, Operatör Merkezi alanı, check/activate
   iddialara yazar.
2. (M3, ZORUNLU) `POST /api/lisans/v1/kapi/durum` — gövde `{ licenseId, machine }`, başlık `authorization: Bearer <KAPI_LISANS_ANAHTARI>` (Vercel ortam
   değişkeni = Worker gizli değeri; sabit zamanlı karşılaştırma). Yanıt: `/v1/check` ile AYNI imzalı belirteç zarfı `{ ok: true, token }` (o makinenin güncel
   lisansı; engelliyse status blocked). Kurulum kaydını (son görülme, kullanım) DEĞİŞTİRMEZ (ofis kapalıyken "çevrimiçi" görünmesin). Yoksa: ofis
   kapalıyken telefon özeti en çok 1 saat görür, sonra "lisans doğrulanamadı" (P9 fail-closed).
3. Hız sınırı (ofis başına dakikada birkaç istek yeter; kapıcı 30 dk'da bir sorar).
