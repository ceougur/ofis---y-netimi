# M2 — Karekodlu Cihaz Eşleme ve Uzaktan Erişimin Program Tarafı (2.4.7)

Kaynak: CLAUDE.md Açık iş "MOBİL" ve "KARAR (kullanıcı, 26.10.2026, mobil)" ×3; `docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` §3.1;
`docs/PRO-UZAKTAN-GORUNTULEME.md` (mimari geçerli, Pro kilidi YOK — mobil herkese); `docs/2.4.7-IS-LISTESI.md` "KARARLAR — M2" (P1–P13, kullanıcı
kararı, aynen); bağımsız kâhin `test/bagimsiz/mobil-erisim/`. Kod: `server/lib/mobile-remote.mjs` (çekirdek), `server/routes/mobile-admin.mjs`,
göç v38, `client/assets/hof-mobile-devices.js` (Yönetim → Mobil Cihazlar), `client/mobil/app.js` (eşleme + imzalı giriş).

## 1. Akış

1. **Yönetim → Mobil Cihazlar** (yalnız yönetici, `users.manage`): kullanıcı listesi + her satırda **Uzaktan Bağlanabilir** kutusu ve
   **Karekod Oluştur**; altında eşli cihazlar (Cihaz, Kullanıcı, Eşleme Tarihi, Son Erişim, Sil). Sınır doluyken (P4) karekod düğmesi pasif,
   nedeni görünür yazıyla ("3 cihazın hepsi eşli; önce birini silin").
2. **Karekod** (P1 5 dk, P2 kişinin önceki kodu iptal): 128 bit rastgele kod; veri tabanında yalnız SHA-256 karması. Karekodun içeriği
   `<uzak adres>/mobil/#eslesme=<kod>` — kod adresin **#** kısmında: tarayıcı onu sunucuya, vekile, günlüğe göndermez.
   **P14 (kullanıcı kararı 29.10.2026):** karekodun altında AYNI kodu taşıyan **Eşleme Bağlantısı** + **Kopyala** — karekod okuyamayan uzak bilgisayar
   için; bağlantı o bilgisayarın tarayıcısında açılınca cihaz anahtarı orada üretilir, o bilgisayar "Uzak Tarayıcı" olarak eşlenir (sonra mobil arayüzün
   geniş ekran düzeni). Kurallar karekodla birebir aynı (P1–P4: tek kod, tek uç). BAŞ MİMAR KARARI: kod bağlantıda da `#` kısmında (sunucu günlüğüne,
   vekile, Referer'a düşmez); bağlantı yalnız o kişiyle paylaşılmalı (5 dk; ele geçse de parolasız giriş olmaz).
3. **Telefon** karekodu okur, sayfa açılır; WebCrypto ile **dışa aktarılamaz** ECDSA P-256 anahtar çifti üretir (IndexedDB'de saklanır),
   `POST /api/mobil/eslesme` { kod, cihaz adı, tür, açık anahtar (JWK) }. Sunucu tek işlemde (SQLite, eşzamanlı son yer tek kazanır):
   lisans → kod (var, etkin, süresi dolmamış) → kullanıcının uzak izni → sınır (P3 doluysa REDDET, kod harcanmaz) → cihaz kaydı + kodu
   kullanıldı yapar; telefona HttpOnly **cihaz çerezi** (`__Host-hof_device` = cihaz kimliği + 256 bit sır; veri tabanında karması; ad, Secure + Path=/ + Domain yok ve okuma kuralı kapıcıyla ortak — lib/mobil-cerez.mjs, bağımsız gözden geçirme B4) verir.
4. **Giriş**: telefon `GET /api/mobil/session/challenge` ile tek kullanımlık meydan okuma alır, cihaz anahtarıyla imzalar, kullanıcı adı +
   parolayla `POST /api/mobil/session/login`. Sıra: cihaz çerezi → lisans → imza → P6 (yalnız eşlendiği kullanıcı) → kilit (P11–P13) →
   parola → uzak izin. Başarıda cihaza bağlı **uzak oturum** (`__Host-hof_mobil` çerezi; P7 boşta 15 dk, P8 en çok 12 saat).
5. Sonraki her uzak istek: cihaz → lisans → yol beyaz listesi → (sayfa dosyası) → uzak oturum → mevcut mobil uç (M1 `lib/mobile.mjs`) →
   programın kendi ucu (şirket erişimi `companies.canAccess`, yetki, lisans o uçta; tekrar edilmez).

## 2. Uzak isteğin tanınması (M3/M4 arayüzü)

- **Ayrı yerel dinleyici**: `app.listenRemote(port, "127.0.0.1")`. O dinleyiciye gelen HER istek uzaktır (istek nesnesine `REMOTE_REQUEST`
  işareti); ofis ağının ana dinleyicisine gelen istek hiçbir zaman uzak sayılmaz. Başlık ya da adres bakılmaz: `X-Forwarded-For`,
  `X-Real-IP`, `Forwarded` silinir; `clientIp()` uzak istekte `"uzak"` döner → 127.0.0.1'den gelse de **yerel sayılmaz** (yerel kurtarma kodu,
  ilk kurulum girişi, yerel deneme sayacı uzaktan kullanılamaz). M4'te `cloudflared` yalnız bu porta bağlanır.
- **Yol beyaz listesi** ham istek satırında, URL çözülmeden ÖNCE: yalnız `/mobil/` ve `/api/mobil/` (önek bölüm sınırında, büyük/küçük harf
  duyarlı); `..`/`.` bölümü (kodlanmışı dahil), ters bölü, çift bölü, NUL, ikinci kat kodlama reddedilir (WHATWG URL `%2e%2e`'yi çözüp yolu
  yükseltir — bu yüzden ham satır).
- M3 kapıcı için: `mobileRemote.gatekeeperSnapshot()` = { sınır, cihazlar [kimlik, kullanıcı, açık anahtar, eşleme anı] } (kapıcı sınırı
  ve cihazı programdan bağımsız denetler — K13); `mobileRemote.setPublicUrl(url)` (M4 tünel adresini karekoda verir);
  `deviceFromRequest(req)` tek giriş noktası (M3 kapıcının imzalı işaretini buraya ekler).

## 3. Kayıt yeri ve sınır

- Cihazlar program başına sayıldığı için **ortak katmanda** (001'in veri tabanı = kullanıcıların, oturumların olduğu yer): `mobile_access`,
  `mobile_codes`, `mobile_devices`, `mobile_sessions` (göç v38, yalnız ekleyici). Şirket dosyasında DEĞİL. Yedekten Geri Yükle'de ortak katman
  tabloları (`COMMON_TABLES`) canlıdan kalır: silinmiş cihaz eski yedekle **geri gelmez**; "Tümünü Sıfırla" dokunmaz.
- Sınır = lisans belirtecinin `mobileDevices` alanı (yoksa 3). Sayılan: silinmemiş cihaz (telefon, tablet, uzak tarayıcı aynı). Kullanıcı
  sayısı sınırsız. Cihaz silinince yer açılır, açık uzak oturumları **aynı işlemde** silinir. Uzak izin kalkınca kullanıcının bütün cihazları,
  oturumları ve bekleyen karekodları düşer. Kullanıcı silinince cihazları silinir. P5: sayı düşerse eşli cihazlar sürer, yalnız yeni eşleme
  ve karekod engellenir.

## 4. Lisans ve saat

- Uzak erişim lisans **yazılabilir** durumdayken açık (deneme, lisanslı, geçiş); salt okunur her durumda (bitti, engellendi, 7 günden uzun
  doğrulanamadı, saat geri) her uzak istek — sayfa dosyası ve eşleme dahil — reddedilir; eşlemeler silinmez (lisans yenilenince döner).
- Uzak güvenlik süreleri (karekod, oturum, kilit) `config.remoteNow` saatiyle (üretimde gerçek saat; testte sahte saat — ders 13, 22).

## 5. Güvenlik gerekçeleri (OWASP ASVS 4.0.3 / MASVS)

- Cihaz bağlama: oturum yalnız cihaz çerezi + o cihazın dışa aktarılamaz anahtarıyla imzalı meydan okumayla açılır (MASVS-AUTH-2; ASVS 3.5).
  Çerez çalınsa da anahtar olmadan yeni oturum açılmaz; oturum çerezi başka cihaz çereziyle geçmez.
- Çerezler HttpOnly, SameSite=Strict, Path=/, Secure (yerel döngü adresi dışında) (ASVS 3.4.1–3.4.3). Sırlar ve kodlar veri tabanında karma
  (ASVS 2.10.x). Oturum süreleri ASVS 3.3.2 (L3 boşta 15 dk, mutlak 12 saat). Deneme sınırı hesap başına (ASVS 2.2.1; P12).
- Uzak oturum ayrı tabloda: yerel dinleyici uzak oturumu, uzak dinleyici yerel `hof_session`'ı tanımaz (güven sınırı — ASVS 1.4).

## 6. BAŞ MİMAR KARARLARI (para kuralı değil; kâhinin "ikisi de olur" bıraktığı ya da metnin sustuğu noktalar)

1. Uzak istek ayrı yerel dinleyiciyle tanınır (başlık/adres değil) — yaygın ters vekil düzeni; başlık taklidi imkânsız.
2. Cihaz kimliği = HttpOnly çerez (her istek) + girişte WebCrypto imzası (cihaz bağlama). Gerekçe: tarayıcıda her isteği imzalamak sayfa
   dosyalarında mümkün değil; kapıcının (M3) yapacağı cihaz denetimi de istek başına çerezle aynı.
3. Sınır dolu reddinde karekod **harcanmaz** (V7 iki seçenekten); yönetici bir cihazı silince aynı kodla 5 dk içinde yeniden denenir.
4. Aynı cihazda yeni giriş o cihazın eski uzak oturumunu kapatır (V14) — cihaz başına tek oturum.
5. Sunucu yeniden açılınca uzak oturumlar sürer (V13), süreleri işlemeye devam eder.
6. Parola değiştirmesi gereken hesap uzaktan giriş yapamaz (önce ofisteki bilgisayardan) — mevcut "ilk giriş yerelden" kuralının genişlemesi.
7. Karekod üretiminde lisans da denetlenir (V11): salt okunur lisansta karekod üretilmez.
8. Pasif (silinmemiş) kullanıcının cihazı yer tutar ama girişi reddedilir; kullanıcı silinince cihazı silinir.
9. `/mobil/` sayfa dosyaları cihaz çerezi HİÇ yokken de verilir (karekoddan açılan eşleme sayfası; dosyalar kurulumdaki açık koddur, veri
   içermez); çerez var ama geçersizse (silinmiş cihaz) reddedilir. M3'te sayfa `m.` adresinden geleceği için tünelde bu istisna kalkabilir.
10. Mobil beyaz listeye iki salt okunur uç eklendi: `/api/mobil/plans` (taksit özeti, `plans.view`) ve `/api/mobil/overview` (ANLIK DURUM,
   yalnız yönetici `overview.card`) — Eylül özetinin bölümleri; yetki o uçların kendisinde.

## 7. Lisans sunucusunda gereken (site deposu — bu işte DOKUNULMADI)

Lisans belirtecinin iddialarına isteğe bağlı `mobileDevices` (0–100 tam sayı; yoksa program 3 sayar) eklenir: Operatör Merkezi → lisans
kaydında "Mobil Cihaz Sınırı" alanı (varsayılan 3), `lisans.licenses` tablosuna kolon, belirteci imzalayan işlev (check/activate) alanı
iddialara yazar. Eski program alanı yok sayar (bilinmeyen iddia düşer); yeni program alanı yoksa 3 kullanır. M3 kapıcı aynı alanı lisans
servisinden okur.
