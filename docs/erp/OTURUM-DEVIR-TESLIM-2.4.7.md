# DestekOfis — OTURUM DEVİR TESLİM BELGESİ (2.4.7 için yeni oturum)

> Yazıldı: 26.10.2026, önceki oturum `session_01JyhFmK2mfqMV3KTwvTZdhs`. Kullanıcının kararı: "2.4.7'yi yeni oturumda yapmaya karar verdim."
> Bu belge yeni oturumun TEK giriş noktasıdır. Burada "devir teslim" OTURUM DEVRİ demektir. Yıl sonu **Devir Modülü** (sürüm 2.5.0)
> ayrı bir iştir (§6.1).
> Belge `docs/erp/` altındadır. Bu klasör `tools/kanit.mjs` BELGE_YOLLARI içinde olduğu için bu dosyanın gönderimi CI başlatmaz.

---

## 0. YENİ OTURUM İLK 15 DAKİKA (sırayla)

1. **Kuralları oku.** `CLAUDE.md` (oturum açılınca kendiliğinden yüklenir): anayasa, kalite çıtası, test kuralı, KANIT KURALI, test
   dersleri 1–43, Verimlilik, Güvenlik, Teslim düzeni. Kurallar pazarlıksızdır (§2'de özeti var, kaynak CLAUDE.md).
2. **Dal (KARAR, eski oturum 26.10.2026; yeni oturum sordu).**
   - Yeni oturum KENDİ SİSTEM TALİMATINDA ATANAN dalda çalışır ve yalnız oraya gönderir (iki depoda da). Eski oturumun dalı
     `claude/youthful-euler-fl8ks4` yalnız KAYNAKTIR, ona gönderilmez. Eski `claude/hopeful-goodall-6nmtcj` dalından belge ALINMAZ.
   - Atanan dal `origin/master`'dan (site: `origin/main`) başlatılır: `git checkout -B <atanan-dal> origin/master`.
     Gerekçe: 2.4.6 PR #36 squash ile birleşti (master d31b486). Eski dalın master'dan farkı YALNIZ BELGE (kod farkı yok, 26.10'da
     `git diff --stat origin/master origin/claude/youthful-euler-fl8ks4` ile doğrulandı).
   - Farkın taşınması, tek commit:
     ```
     git fetch origin claude/youthful-euler-fl8ks4
     git checkout origin/claude/youthful-euler-fl8ks4 -- CLAUDE.md docs/2.4.6-IS-LISTESI.md docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md \
       docs/kanit/2026-10-25/246-paket docs/pazarlama/DestekOfis-Tanitim.png
     ```
     Sonra `git diff --stat origin/master origin/claude/youthful-euler-fl8ks4` ile `git diff --stat origin/master HEAD`'in AYNI olduğunu gör.
     `docs/kanit/` BELGE_YOLLARI dışında: bu commit ilk kod commit'iyle birlikte gönderilir (ders 26). Acil değilse beklet.
   - Site deposu (`ceougur/destekofis`): eski dalın `main`'den farkı YOK; atanan dal doğrudan `origin/main`'den başlar.
   - Belgede geçen "dal claude/youthful-euler-fl8ks4" ifadelerini "atanan dal" diye oku.
3. **Kullanıcının "başla"sını bekle.** 2.4.7 kodu kullanıcı "başla" deyince başlar. Kullanıcı Claude haftalık kullanım sınırının
   29.10.2026 Per 02:00 TR'de sıfırlanmasını bekliyordu. "Başla"dan önce kod yazma, ajan başlatma. Kullanıcı bir kez "şimdi değil
   2.4.7'ye" deyip başlatılan işi durdurttu.
4. **Ön koşulları kullanıcıdan iste.** Yeni kapsayıcıda önceki oturumun dosyaları YOK (§8), yeniden yüklenmeleri gerekir:
   mobil v0.3 zip'i, demo zip'i, sunum PDF'i, doğrulama notu; teslimde imza anahtarı `.pem`. Sohbete yapıştırma değil, oturuma yükleme.
5. **Devir hatırlatıcısını taşı (§7).** Eski hatırlatıcı eski oturuma bağlı.

---

## 1. ÜRÜN VE ROLLER (kısa)

- **DestekOfis:** ön muhasebe + ofis yönetimi.
  - Kapsam: cari, kasa, banka, POS, çek/senet, fatura + e-Belge (EDM), stok, taksit, raporlar, personel özlük, duşakabin maliyet kartı.
  - Teknik: Windows'ta ofis sunucusunda çalışan Node uygulaması; tarayıcıdan kullanılır; veriler ofiste.
  - Şirket = ayrı veri dosyası `sirketler/<kod>/`, en çok 2 şirket.
- **Ürün sahibi:** Uğur Çetin (kullanıcı). Tüm nihai kararlar onun.
- **Claude:** baş mimar ve baş mühendis. Görevi: mimari bütünlük, kör nokta uyarısı, ticari odak, en yüksek kalite.
- **Lisans servisi + Operatör Merkezi:** site deposunda.
  - Vercel'de çalışır: `web/api/*`, `web/assets/admin.js`.
  - Arka ucu Supabase: `supabase/lisans.sql`, `lisans` şeması.
  - Programdaki lisans adresi `https://destek-ofis.vercel.app/api/lisans` kodda SABİT ve DEĞİŞMEZ (kullanıcı kararı).
- **Yayın geçmişi:** 2.0.12 … 2.4.6 yayımlandı. Son: **2.4.6** (26.10.2026; duşakabin Maliyet Hesap Kartı + 2.4.5 kalanları).
  Ayrıntı `docs/2.4.6-IS-LISTESI.md` ve `docs/GECMIS-KARARLAR.md`.

---

## 2. ÇALIŞMA PRENSİPLERİMİZ (özet; tam metin CLAUDE.md, çelişkide CLAUDE.md geçer)

**Dil ve iletişim**
- Kullanıcıya giden HER şey Türkçe.
- KISA yaz. Kullanıcı bu oturumda "kısa cevapla yoruldum" dedi. Uzun anlatım, tablo yığını, tekrar istemiyor.
- Konuşulmuş bir şeyi yeniden iş olarak yükleme. Örnek: "portaldan görebiliyoruz" denmişken "Alper Bey'e sor"u ilk adım yazmak
  kullanıcıyı endişelendirdi. Önce kendi yapabileceğini, sonra gerekiyorsa kullanıcıya düşeni yaz.
- Belirsiz ifade kullanma. Olmayan bir "lisans sözleşmesi"nden söz etmek kafa karıştırdı; doğru ad "sitedeki KVKK Aydınlatma Metni".

**İstek kaydı (KURAL).** Kullanıcının her isteği, ne kadar küçük olsa da, AYNI ANDA CLAUDE.md "Açık iş"e yazılır, commit edilip
gönderilir. Kararlar kullanıcının sözü tırnak içinde ve tarihle yazılır.

**Yanıt vermeden önce koddan doğrula.** Hafızadan anlatma; sıkıştırma/devirden sonra karar gerektiren her şeyi belgeden ve koddan
yeniden doğrula.

**Kör nokta uyarısı.** Kullanıcının göremediği riski proaktif söyle, daha iyi alternatif öner. Öneri + gerekçe kısa olsun; kararı
kullanıcı verir.

**Kararı kullanıcıya bırakılan adımlar:**
- PR → master birleştirme: kullanıcının "birleştir"i.
- GitHub yayınını açma.
- Canlı veritabanı (Supabase) değişikliği.
- DNS değişikliği: kullanıcının açık onayı, ör. "sen yap".
- Müşteri/kimlik bilgisi istemek.
- 5 dk yetkisi ("yanıt yoksa en yaygın öneriyi uygula") bunlara GİRMEZ. Para kuralı netleştirmesine de girmez (ders 43).

**Sürüm akışı (her sürümde aynı):**
1. "başla".
2. İş listesi `docs/<s>-IS-LISTESI.md`. Madde 0a: dosya BELGE_YOLLARI'na eklenir (`tools/kanit.mjs` + ci.yml `paths-ignore` +
   `test/kanit-araci.test.mjs`; eski araçta kırmızı görülür). Maddeler efor sınıflı: [M] / [H] / [XH]. Biten madde kanıtla çizilir.
3. "Nasıl bozulur?" listesi önce yazılır.
4. KÂHİN ÖNCE: kodu görmeyen ayrı ajan, plan/karar metninden, ayrı dilde (Python) "temiz oda" modeli.
5. 30 dk ara rapor: kalıcı zamanlanmış görev (kullanıcı isteği; sürüm bitince silinir).
6. Kod dalgaları: ajanlarla, `effort` her zaman verilir (aşağıda).
7. Bağımsız gözden geçirme (bir tur, yalnız hata arar).
8. KARAR REVİZYONU: YÜKSEK/ORTA düzeltilir, DÜŞÜK sonraya, sakınca süzgeci.
9. DURMA KURALI: düzeltmeden sonraki dar kontrol yalnız o farkı görür.
10. Son dalgada tam kapı: tam `npm test` + ci.yml'nin bütün e2e'leri + CI dışı senaryolar.
11. Uzun Doğrulama (GitHub) bir kez.
12. Paket (`tools/release.mjs --anahtar <yüklenen .pem>`, `npm run build:windows`).
13. PR → kullanıcı "birleştir" → CI yeşil → birleştir.
14. Kullanıcı yayın açar.
15. Yayındaki 5 dosya bayt bayt + gerçek eski güncelleyiciler "available" (`NODE_USE_ENV_PROXY=1`).
16. Site kılavuz PR'ı (`ceougur/destekofis` → `web/indir/`).
17. Ders 42: kılavuz HTML'i değişirse PDF aynı adayda yeniden üretilir: `docs/kilavuz/pdf-uret.mjs` + `pdf-denetle.mjs`.

**Kanıt kuralı.** Bir iş ancak şunlarla "bitti" sayılır:
- GitHub CI'nin 4 platform + e2e'si o commit'te yeşil, ana oturum kendisi okur: `node tools/kanit.mjs ci <sha> --bekle <dk>`.
- Bağımsız kâhin.
- Testin dişi: eski kodda kırmızı, kırmızının NEDENİ okunur, eski kod AYRI KOPYADA (`git archive`) koşulur. Para çekirdeğinde mutasyon.
- Tekrarlanabilir ham çıktı `docs/kanit/<gün>/`; komutlar `node tools/kanit.mjs kos <ad> -- <komut>` ile.
- Ajan "geçti" demesi kanıt değil. Teslimde üç başlık: DENENEN / DENENMEYEN / BİLİNEN SINIRLAR.

**Verimlilik:**
- Geliştirmede yalnız değişen alanın testleri. Tam `npm test` iş başına bir kez, bitişte; yapısal değişiklikte adayda bir kez (ders 41).
- Uzun koşular yalnız son adayda, GitHub'da.
- Yoklama yok: CI/ajan bildirimini bekle.
- BELGE_YOLLARI dışındaki belge tek başına gönderilmez, kodla birlikte gider (ders 26).

**Ajan eforu:**

| İş türü | Efor |
|---|---|
| Basit arayüz, küçük düzeltme | medium |
| Birden çok modül | high |
| e-SMM, EDM entegrasyonu, kritik muhasebe | xhigh |
| Bağımsız doğrulama, kâhin, para çekirdeği incelemesi, UD incelemesi | xhigh |

Efor gereken işte fork ajan kullanılmaz (efor yok sayılır).

**Güvenlik (değişmez):**
- Operatör parolası, imza/lisans anahtarları, API gizli anahtarları ve EDM parolaları hiçbir dosyaya, zip'e, belgeye girmez. Kullanıcıdan
  sohbete gizli değer yapıştırması İSTENMEZ.
- Tag'lere force-push yok. Müşteri verisine erişilmez.
- `pkill`/`killall` yok. Joker desenle `rm` yok; yalnız kendi oluşturduğun tam yol.
- Programı ayrı süreçte açan her test/araç `HUKUK_LICENSE_URL=http://127.0.0.1:9` verir (ders 30).
- TLS kapatılmaz.
- Commit son satırları TAM olarak (model adı hiçbir yere yazılmaz):
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  Claude-Session: <yeni oturumun bağlantısı>
  ```
- Push yalnız `claude/youthful-euler-fl8ks4`'e. PR yalnız kullanıcı isteyince.
- Bash aracında `set -e` etkisiz: zincirde `&&` kullan (ders 19).

**Yazım düzeni.** Programın ürettiği adlarda her sözcüğün ilk harfi büyük ("Cari Listesi ve Bakiyeler"); bağlaçlar küçük; cümleler
cümle düzeninde. Denetim: `test/yazim-duzeni.test.mjs`.

**Kılavuz.** Yalnız kullanıcıyı ilgilendiren kısa "nasıl yapılır". Teknik/sürüm anlatımı CHANGELOG ve docs'ta.

**Teslim biçimi:**
- A) GitHub'a yüklenecek 5 dosya zipsiz, tek tek:
  - `destekofis-guncelleme-<s>.zip`
  - `destekofis-guncelleme.json` (imzalı)
  - `DestekOfis-Kullanim-Kilavuzu.pdf`
  - `DestekOfis-Kurulum.exe` (30 MB'ı aşarsa parca0 + parca1 + `BIRLESTIR.bat`)
  - `DestekOfis-Kurulum.exe.sha256`
- B) Tek arşiv zip: belgeler, kanıt, git bundle (önce `git fetch --unshallow`).
- Sürüm notu KISA; ayrıntı `docs/<s>-DEGISIKLIKLER.md`.

---

## 3. 2.4.7 KAPSAMI (kararların hepsi CLAUDE.md Açık iş'te tarihli; burada iş olarak)

### 3.1 MOBİL (ana iş)

**Kararlar (kullanıcı, 26.10.2026):**
- ÖNCELİK MOBİL: "müşteriler hep mobil özelliğini soruyor". Devir 2.5.0 sonra.
- YÖNTEM, Eylül planı (`docs/PRO-UZAKTAN-GORUNTULEME.md` mimarisi):
  - Ofis sunucusu, değişiklikten sonra şifreli bir özet üretir ve Cloudflare R2'ye yükler.
  - **Worker kapıcı** (`kapi.` alt adı) cihaz yetkisini denetler.
  - Telefon sayfası (`m.` alt adı, Pages) özeti indirip **kendi içinde çözer**.
  - Sunucu kapalıyken telefonda son hâl görünür; yalnız tahsilat girilemez.
  - Sunucu AÇIKKEN canlı bağlantı: tahsilat, canlı PDF/Excel. Tüneli program, kapıcı üzerinden kendiliğinden açar; ofis başına alt ad.
  - Müşteri başına satıcıya elle iş YOK. Kota dolmaz.
- EŞLEME: Yönetim'de bir kart, karekod okut → eşleş (PIN/passkey). Cloudflare Access KULLANILMAZ (kullanıcı sınırı var). Giriş:
  DestekOfis kullanıcı adı/parolası.
- EKRANLAR: kullanıcının kendi yazdığı **DestekOfis Mobil v0.3** arayüzü (`public/`) AYNEN kullanılır. Telefonda masaüstü ekranı GELMEZ.
- PRO YOK: "pro sürüm olmayacak şimdilik. hepsi aynı sürümde çıkılacak". Mobil HERKESE. Görüntüleme + canlı + tahsilat TEK SÜRÜM 2.4.7.
  `PRO-UZAKTAN-GORUNTULEME.md`'deki Pro kilidi / Standart-Pro maddeleri bu kararla GEÇERSİZ; mimari geçerli.
- CİHAZ SINIRI: "tablet de mobil sayılsın, 3 tane uzaktan bağlantı cihazı olsun".
  - Program başına (iki şirket birlikte) en çok 3 EŞLİ UZAKTAN CİHAZ: telefon, tablet, uzak tarayıcı hepsi sayılır.
  - Kullanıcı sayısı ayrıca sınırlanmaz. Cihaz silinince yer açılır.
  - Sınır programda VE kapıcıda (Worker) uygulanır. Lisansta sayı alanı (varsayılan 3).
- MOBİL YAZMA: tahsilat/ödeme/stok girişi mevcut API üzerinden; para çekirdeği kurallarıyla, kâhin + mutasyon testi zorunlu.

**v0.3 paketi (kullanıcının; önceki oturumda incelendi):**
- Bağımsız Node ağ geçidi:
  - `src/gateway.mjs`: API beyaz listesi, oturum, CSRF, loopback upstream, `MOBILE_REPORT_IDS` rapor beyaz listesi.
  - `src/edge.mjs`: Cloudflare Access JWT; bizim mimaride kullanılmayacak.
- PWA `public/` (`app.js`, `index.html`, `sw.js`, `manifest.webmanifest`, `styles.css`, `icons`); `ENABLE_WRITES`, `ENABLE_REMOTE` bayrakları.
- Testler `test/` + `integration/`: önceki oturumda 12/12 yeşil.
- Paketteki `CLAUDE-ENTEGRASYON.md` ve `DOGRULAMA-SONUCLARI.md`: kullanıcının bize notu, OKU.
- Kullandığı API uçları 2.4.6'da var: `/api/auth/login`, `auth/me`, `/api/companies`, `hofCompany`, `report-center`, `bank/summary`,
  `bank/accounts`, `bank/choices`, `ekstre.pdf`, `makbuz.pdf`, stok hareketleri; başlıklar `x-hof-request`, `hof_session`.
- Ayrı kurulum DEĞİL: program içine, aynı kurulum ve güncellemeyle girer.

**Kör noktalar (kullanıcıya verildi):**
- `cloudflared` ~20–60 MB: kuruluma konmaz; ilk kullanımda indirilir, imza/özet denetlenir.
- Worker ücretsiz katman 100 bin istek/gün (~650 ofise kadar); üstü ~5 $/ay. R2 ücretsiz katmanda.
- Cloudflare API belirtecinde Tunnel YAZMA izni olmayabilir (tünel listesi okunuyor, 0 tünel). Tünel adımında gerekirse kullanıcıya
  izin ekletilir: tek adım, ekran görüntüsüyle yönlendir.

**Tahmin (kullanıcıya verildi 26.10):**
- Takvim 5–6,5 gün, iş 7–9 gün.
- Claude kullanımı API karşılığı ~635–1.015 $ (2.4.6 ölçülen ~430 $; testler ~%45–50).
- GitHub ~2.800–3.200 dk, 0 TL (depo açık kalmalı).

### 3.2 GÖRÜNEN E-POSTA ve SİTE ADRESİ

**Kararlar:**
- E-posta: "bu yeni maili, sitemizden, kılavuzdan, admin mesajından, vs düzeltelim".
- Site adı: "site ismimize artık yeni alan adımızla değiştirelim".
- Lisans adresi: "vercel adreside açık kalsın kapatmayalım. mevcut durum devam etsin". Lisans ve güncelleme adresi DEĞİŞMEZ.

**Değişecekler:**
- Görünen destek e-postası: `destekofis@proton.me` → **`destek@destekofis.net`**.
- Görünen site adresi: `destek-ofis.vercel.app` → **`destekofis.net`**.

**Programda yerler (envanter 26.10):**
- `server/lib/license.mjs`: `SUPPORT_CONTACT`. `DEFAULT_LICENSE_SERVICES` AYNEN kalır.
- `client/assets/hof-license.js`: metin; KVKK bağlantısı da şu an vercel.app gösteriyor.
- `client/admin.html`.
- `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html`: PDF yeniden üretilir.
- `packaging/windows/setup.iss`, `tools/build-windows.mjs`.
- `docs/pazarlama/TANITIM-METNI.md`.
- `server/lib/updater.mjs`: kullanıcı aracısındaki site metni; güncelleme ADRESİ değişmez.
- CHANGELOG yeni girdi.

**Değişmeyecekler:**
- Geçmiş CHANGELOG girdileri.
- Kanıt belgeleri.
- `docs/fatura/E-BELGE-EDM.md`: yalnız gözden geçir.
- `test/lisans-servisi-izolasyonu.test.mjs` ve `windows.yml` lisans düzeni: dokunulmaz.

**Site (`ceougur/destekofis`, sürümün site PR'ında):** sayfalar, `web/kvkk.html` (e-posta hâlâ proton.me), Operatör Merkezi metinleri.

**Kör nokta.** `destekofis@proton.me` HESAP olarak kapanmaz: Cloudflare, Vercel, GitHub ve EDM girişleri bu hesapta. Eski kurulumlar onu
göstermeye devam eder.

**Tanıtım görseli.** `docs/pazarlama/DestekOfis-Tanitim.png` zaten güncellendi (26.10; destekofis.net + destek@destekofis.net).

### 3.3 EDM İŞ ORTAKLIĞI [XH] (~1 gün)

**EDM yanıtı (26.10):**
- Müşteri kontörü EDM'den son kullanıcı fiyatıyla alır.
- Kullanılan her kontör için ay sonunda %30 hak ediş.
- Hesap YALNIZ istekteki `APPLICATION_NAME` ile, yani KULLANIM BAZLI: değer **`destekofis30`**.

**Maddeler:**
- **A1.** `server/lib/einvoice/edm.mjs:48` `APP = "DestekOfis"` ve `header()` (~satır 311).
  - Login, CheckUser, Send/Load/GetStatus/Cancel/Get/Mark Invoice ve Send/Status/Cancel/Get SMM hepsi aynı başlığı kullanır.
  - Değişiklik: `APPLICATION_NAME` her istekte `destekofis30` (adlı sabit, yorumlu). `CHANNEL_NAME` "DestekOfis" kalır.
  - `edmTransport`'un `appName` seçeneği bugün ikisini birden değiştiriyor: düzenle.
  - `tools/edm-gercek.mjs` test aracı; kararı gerekçelendir.
- **A2.** Her işlem türünde `destekofis30` denetleyen test (`test/einvoice-mock.mjs` düzeni); eski kodda kırmızı (ayrı kopya).
- **A3. Kullanıcıyla test faturası.**
  - EDM yeni bir test hesabı verdi: kullanıcı adı `destekofis`. Parola kullanıcıda, HİÇBİR dosyaya yazılmaz; programa kullanıcı girer.
  - Adresler programdakiyle AYNI: test servis `…/EFaturaEDM21ea/EFaturaEDM.svc`, test portal `…/EFaturaUI21ea`.
  - ÖNCE EDM portalına bakılır; `destekofis30` ya da uygulama adı görünüyorsa tamam.
  - Görünmüyorsa İş Geliştirme Uzmanı Alper Demir'e BİR KEZ sorulur. Kullanıcı uyarısı: "portaldan görebiliyoruz dedik"; sormak ilk
    adım DEĞİL.
- **B1. Sayaç.**
  - EDM'nin KABUL ETTİĞİ gönderimler ay × tür sayılır: e-Fatura (TEMEL/TİCARİ), e-Arşiv, e-SMM.
  - Append-only kayıt. Aynı ETTN + ortam BİR kez sayılır; yeniden deneme, 11048 "zaten gönderilmiş", durum sorgusu ve iptal sayıyı artırmaz.
  - Önce 2.4.4'teki "gönderim/iptal izi" incelenir: `server/routes/invoices.mjs`, `invoices.e_status/e_at/e_profile/e_adapter`,
    `server/lib/einvoice/*`. Sonucu belirsiz gönderimin sonradan kesinleşmesi düşünülür.
  - Test ve canlı ayrı tutulur.
  - Geriye dönük doldurma YOK: eski sürümler "DestekOfis" gönderdiği için hak ediş 2.4.7 ile başlar.
  - Şirketler toplanır.
- **B2.** `server/lib/license.mjs` `callService` → `/v1/check` gövdesine `usage`: son 3 ayın TOPLAM sayıları (delta değil).
  - Belge içeriği, alıcı, tutar, VKN/TCKN, belge no ve ETTN GİTMEZ.
  - Eski sunucunun bilinmeyen alanı yok saydığı doğrulanır. Ders 30 izolasyonu korunur.
- **C1.** Site `supabase/lisans.sql`: `lisans.edoc_usage` (makine + ay + ortam).
  - check işlevinde doğrulamalı üzerine yazma: ay YYYY-MM, negatif olmayan tam sayı, üst sınır, satır sınırı.
  - Geçersiz veri lisans yanıtını ASLA bozmaz. SQL eklemeli ve tekrar çalıştırılabilir.
- **C2.** Operatör Merkezi'nde **e-Belge Kullanımı**:
  - Ofis × ay tablosu; e-Fatura / e-Arşiv / e-SMM / Toplam sütunları; alt TOPLAM; ay ve ortam seçimi (varsayılan Canlı).
  - Kullanıcı ay sonunda EDM raporuyla karşılaştırır.
- **C3.** Canlı Supabase'e SQL YALNIZ kullanıcı onayıyla, yayın günü.
- **D1.** Site `web/kvkk.html` (KVKK Aydınlatma Metni; ayrı "lisans sözleşmesi" YOK). Lisans doğrulaması satırına şu eklenir:
  "gönderilen e-Belge adetleri (ay ve tür bazında sayı; içerik gönderilmez)". Metni Claude yazar, kullanıcı onaylar.

**Kullanıcının işi (kod dışı; hatırlat, üstlenme):**
- EDM'ye yazılı sorular: aylık müşteri bazında rapor/panel var mı; kontör nasıl sayılır (belge başına mı, reddedilen/iptal sayılır mı).
- Yazılı iş ortaklığı sözleşmesi; münhasırlık şartına dikkat.
- Hak ediş faturası kullanıcının KENDİ canlı e-Fatura hesabından kesilir (test hesabından değil); nasıl kesileceği mali müşavire sorulur.

**Kör noktalar (verildi):**
- Eski sürümler güncellenene dek hak ediş yok.
- EDM portalından kesilen belgeler (programdaki "e-Fatura Portalı" düğmesiyle açılan portal dahil) sayılmaz.

### 3.4 "başla"da İLK İŞLER (sırayla)

1. `docs/2.4.7-IS-LISTESI.md`: §3.1–3.3'ün bütün maddeleri, efor sınıflı. Madde 0a: dosya BELGE_YOLLARI'na eklenir.
2. "Nasıl bozulur?" listesi:
   - eşleme;
   - 4. cihaz;
   - cihaz silme → erişim kesilir;
   - lisans biter → durur;
   - sunucu kapalı → son hâl görünür, tahsilat kapalı;
   - tünel kopar;
   - iki cihaz aynı anda tahsilat;
   - eski sürüm verisi;
   - saat/gün sınırı;
   - EDM yeniden deneme/11048.
3. Kâhinler, kod yazılmadan:
   - eşleme/güvenlik kâhini;
   - mevcut cari kâhinine (`npm run test:kahin-cari`) mobil yazma senaryoları;
   - sayaç kâhini.
4. 30 dk ara rapor görevi (kalıcı zamanlanmış görev; iş listesi çizilerek).
5. Kod dalgaları.

---

## 4. ALTYAPI DURUMU (26.10.2026'da hepsi doğrulandı)

**Alan adı.** `destekofis.net` Cloudflare Registrar'da (hesap destekofis@proton.me). Zon `a4521bf58a43349c69a0fdafb985bc83`, aktif,
NS `mallory` / `nick`.

**DNS (hepsi DNS only / gri bulut):**

| Kayıt | Değer |
|---|---|
| A `@` | 76.76.21.21 |
| CNAME `www` | `cname.vercel-dns.com` |
| MX ×3 | `route1/2/3.mx.cloudflare.net` |
| DKIM | `cf2024-1._domainkey` |
| SPF | `v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all` |
| DMARC `_dmarc` | `v=DMARC1; p=none` |
| `google-site-verification` TXT | SİLİNMEZ |

- Vercel'in önerdiği CNAME değişikliği isteğe bağlı, uygulanmadı.
- Ayrılan alt adlar: `m.` (telefon), `kapi.` (kapıcı), ofis tünelleri.
- DNS değişikliği kullanıcının açık onayıyla.

**Site.**
- https://destekofis.net → 200 (Vercel, HSTS). `www` 308 ile ana adrese.
- `destek-ofis.vercel.app` KALICI açık, YÖNLENDİRİLMEZ (lisans adresi).
- `/api/lisans/v1/check` iki adda da canlı: boş gövdeye 400.

**Google Search Console.** Alan adı mülkü doğrulandı.

**E-posta.**
- Email Routing: `destek@destekofis.net` → `bilgi.ugurcetin@gmail.com`; hedef Verified, Catch-all kapalı.
- Gmail "Farklı gönder" destek@ (smtp.gmail.com:587 TLS; uygulama şifresi hiçbir yere yazılmadı).
- Test postası spam'a düşmedi.

**Cloudflare API.** Ortamın ağ gizli anahtarı ayarlı: api.cloudflare.com, tür Bearer, başlık Authorization, ön ek "Bearer", değer çıplak
belirteç.
- `tokens/verify` → active.
- Okunabilenler: DNS, Workers, R2, Tunnel listesi.
- Email Routing izni YOK (10000).
- Tunnel yazma izni belirsiz (§3.1).
- Cloudflare Developer Platform bağlayıcısı (OAuth) çalışıyor ama kullanımdan kalkıyor; DNS aracı yok.

**Vercel bağlayıcısı.** Proje alan adı uçlarında 404 verdi. Vercel'de yazma işi gerekirse kullanıcı yapar; söz vermeden önce dene.

**Ağ izni.** `destekofis.net` ortam iznine eklendi. `www.destekofis.net` ve `rdap.org` bu ortamda kapalı.

**GitHub.**
- `gh` CLI yok, GitHub MCP araçları kullanılır.
- Depolar herkese açık: CI ücretsiz.
- Master kural seti "Doğrulama Kapısı" (PR zorunlu).

---

## 5. ARAÇLAR (koddan; ayrıntı CLAUDE.md "Doğrulama kapısı")

- `node tools/kanit.mjs kos <ad> -- <komut>`: test koşusu + kanıt dosyası.
- `node tools/kanit.mjs ci <sha> --bekle <dk>`: CI hükmü.
- `node tools/kanit.mjs ozet`.
- `node tools/release.mjs --anahtar <yüklenen .pem>`: imzalı paket. Temiz ağaç + yeşil CI ister.
- `npm run build:windows`: yeni kapsayıcıda önce `dpkg --add-architecture i386; apt-get install wine wine32 binutils-mingw-w64-x86-64`.
- `npm run test:kahin-cari`, `npm run test:guvenilirlik`, `npm run test:mutabakat`; Uzun Doğrulama iş akışı (GitHub).
- Kılavuz PDF: `docs/kilavuz/pdf-uret.mjs` → `client/kilavuz/`, sonra `docs/kilavuz/pdf-denetle.mjs`.
- `tools/patch-bundle.mjs`: KULLANMA. İstemci paketi `client/assets/app-*.js`'in kaynağı depoda yok, değişiklikler doğrudan pakete
  yazılıyor; araç yeniden üretirse sonraki düzeltmeleri düşürür (bakım riski, §6.3).
- Playwright ve Chromium kurulu; `npm ci` playwright'ı getirir. `node_modules` genel klasöre bağlanmaz (ders 29).

---

## 6. İLERİDE YAPILACAKLAR (sıra ve kararlar)

### 6.1 Devir Modülü — sürüm 2.5.0 (TARİH KRİTİK)
- 1 Ocak'ta yayında olmalı; en geç ~10 Aralık'ta başla (doğrulama + pay dahil). Mobil uzarsa öncelik değişikliğini kullanıcıya öner.
- Plan: `docs/devir/DEVIR-PLANI.md` (§11 kararları verildi 20.10.2026; ~4–6 iş günü). Arka plan: `docs/devir/DEVIR-MODULU.md`.
- Yöntem: Wolvox düzeni (kesim tarihinde ikiye ayır, eski yıl salt okunur arşiv).
- İlk adım D0: planı koda karşı yeniden doğrula + devir KÂHİNİ kod yazılmadan (kullanıcı "önerin uygun", 23.10).
- 2.5.0'da ayrıca ölçek koşusu: 30 kullanıcı, 1.000.000 satır (2.4.4'ten ertelendi).

### 6.2 Tablo–para koparma ve ERP
- `docs/erp/TABLO-PARA-KOPARMA-PLANI.md`. Kapı kapatma 2.4.5'te YAPILDI. Kalan paketler ve kararlar K0–K11 ayrı sürüm (öneri 2.6.0).
- Yön kararı: "mevcut piyasadaki muhasebe programları gibi"; Excel yalnız açık eşlemeli, onaylı tek seferlik içe aktarma; tablo ajanda/rehber.
- `docs/erp/ERP-YOL-HARITASI.md`: E1–E7, yalnız plan. 2.5.0'dan sonra, her adım ayrı sürüm, "başla" ile. Hedef müşteri herkes; şirket sınırı 2.

### 6.3 Ertelenenler (2.5.x; hepsi DÜŞÜK, para/veri/yetki değil)

**2.4.6'dan:**
- B4: silinmiş stok iadesine bağlı Ödeme Düzelt'te 404 ("fatura" iletisi).
- B5: 2.4.6 verisi 2.4.5 ile açılınca Alış İadesi / açılış işareti.
- hof-core odak bekçisi yorumu koda yansımıyor (yeni pencerede ilk 1,5 sn).
- Uç durum hızı.
- Patch-bundle aracı (güncelle ya da kaldır; paket kaynağını yeniden kurma).

**2.4.5'ten:**
- B3, B4 (Ayrıntılı Ekstre 15 kolon 1366'da kesik / PDF Belge No kırılması), B5, B6, B7, B8 (kapıyla çelişen eski metinler), B9.
- Zilde alış faturası / verilen çek başlığı "TAHSİLAT ALINMADI".
- hof-alerts `hide()`/`schedule()`.
- Sağlam açılış işareti (kolon).
- DB1 iade geri ödemesi bağı (BİLİNEN SINIR).
- `pdf-denetle` CI'ye.

**2.4.4 SONRAYA (CLAUDE.md "2.4.4 kararları — son aday turu"):**
- MM1/MM2/MM9/MM12, 30.000 TL (mali müşavire sorulur).
- EDM'den numara eşitleme.
- Kalıcı dönem kilidi özeti.
- Yapışkan TOPLAM satırları.
- Dar pencereler / ad-yazım.
- 33 e2e seçici.
- Seçilenleri Gönder'e Silinenler belgesi.

**AÇIK CI notu (15.10).** `guncelleme-gercek` S2 Windows (test yardımcısı düzeltildi): Windows'ta iki yeşil koşu görülmeden kapanmaz.

### 6.4 Bekleyen kullanıcı kararları / dış bilgi
- **FİYAT:** "SINIRSIZ 40 bin TL" kararı var. Güncelleme/destek süresi ve uzaktan bağlanma/WhatsApp giderlerinin kime ait olduğu
  bekleniyor. "Tek paket, 2 yıl zorunlu güncelleme" yalnız FİKİR.
- **WhatsApp'tan Paylaş** (emlakçı isteği): "şimdilik kalsın". Meta API ileride.
- **Planlı test** (2.0.24 DENENMEYEN + ölçek): yeni tarih kullanıcıda.
- **Döviz** ertelendi (`fxEnabled` kapalı). Drive'a bağlan: yalnız kullanıcı isterse.
- **Duşakabin:** müşteri ses kaydı dökülemedi (huggingface ağ izni yok). Müşteriye 13 soru `dusakabin-analiz` raporundaydı (eski
  oturumun not defteri; gerekirse kullanıcıdan).
- **EDM'ye yazılı sorular ve sözleşme** (§3.3): kullanıcıda.

---

## 7. ZAMANLANMIŞ GÖREVLER

- `trig_01DE8bFDurzMRT6thbptBrQM` "Devir modülü hatırlatması (2.5.0, Aralık)":
  - Tek seferlik, **23.11.2026 09:00 TR**, ESKİ oturuma (`session_01JyhFmK2mfqMV3KTwvTZdhs`) bağlı.
  - Yeni oturum aynı istemle (önce mobil durumu söyle, plan `docs/devir/DEVIR-PLANI.md`, ~10 Aralık uyarısı) KENDİNE bağlı yeni bir
    hatırlatıcı kurar, sonra eskisini `enabled=false` yapar. Kullanıcıya tek satırla söylenir.
- Diğer eski görevler zaten kapalı. 30 dk rapor görevi yok; 2.4.7 "başla"da kurulur.

---

## 8. YENİ KAPSAYICIDA OLMAYANLAR → kullanıcıdan YÜKLEME iste (sohbete yapıştırma değil)

| Dosya | Ne zaman |
|---|---|
| `DestekOfis-Mobil-v0.3-Musteri-Raporlari-Claude-Teslim.zip` (zorunlu) | "başla"da |
| `DestekOfis-Mobil-Demo-Acilabilir.zip`, `DestekOfis_Mobil_v0.3_Teknik_Sunum_Durum_Entegrasyon_Roadmap_2026.pdf`, `DOGRULAMA-SONUCLARI.md` | "başla"da |
| İmza anahtarı `destekofis-imza-anahtari-GIZLI.pem` | Paket aşamasında; yalnız `--anahtar` ile kullanılır, KOPYALANMAZ |
| EDM e-SMM belgeleri (`E-MM_Teknik_Doküman.zip`, Web API docx'leri) | Yalnız gerekirse |

Önceki oturumda yüklenen hiçbir dosya yeni oturumda yoktur. Kopyaların açıldığı not defteri klasörleri (`mobil-inceleme/`,
`dusakabin-analiz/`) de yoktur.

---

## 9. KAYNAK HARİTASI (nerede ne var)

| Konu | Dosya |
|---|---|
| Kurallar, kararlar, Açık iş | `CLAUDE.md` |
| Kapanan sürümler / eski kararlar (aynen) | `docs/GECMIS-KARARLAR.md` |
| Eski devam notları + 2.4.4 kod haritaları | `docs/DURUM-VE-DEVAM.md` (uzun; gerekmedikçe okuma) |
| Mobil mimari (Pro kısmı geçersiz) | `docs/PRO-UZAKTAN-GORUNTULEME.md` |
| Lisans protokolü | `docs/LISANS.md` |
| Mimari | `docs/MIMARI.md` |
| Yayın | `docs/SURUM-YAYIMLAMA.md` |
| EDM / e-Belge | `docs/fatura/E-BELGE-EDM.md`, `server/lib/einvoice/` |
| Son sürüm iş listesi (düzen örneği) | `docs/2.4.6-IS-LISTESI.md` |
| Devir modülü | `docs/devir/` |
| ERP / koparma | `docs/erp/` |
| Pazarlama | `docs/pazarlama/` (tanıtım görseli + metni) |
| Site / lisans / Operatör Merkezi | `ceougur/destekofis`: `web/`, `web/api/`, `web/assets/admin.js`, `supabase/lisans.sql`, `web/kvkk.html` |
