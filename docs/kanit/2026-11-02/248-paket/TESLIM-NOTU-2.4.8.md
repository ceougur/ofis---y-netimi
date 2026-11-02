# DestekOfis 2.4.8 — Teslim Notu

> DURUM: UZUN DOĞRULAMA #1089 YEŞİL (ana oturum okudu, 02.11.2026 06:56 UTC) — T1–T15 yeşil; birleştirme T1–T15 koşuluyla önceden onaylı.

Paketlenen ağaç: **18378e77** (dal `claude/compassionate-galileo-f9kghg`; son ürün kodu **e2380d7e** — 3bd0b1ac ve 18378e77 yalnız belge: CLAUDE.md ders 48 + iş listesi).
Paket ayrı temiz worktree'de (`git worktree add --detach /home/user/wt-paket-248 18378e77`, kendi `npm ci`) üretildi; `tools/release.mjs` kapısı: "18378e7 CI YEŞİL, çalışma ağacı temiz".

## Yayın açma bağlantısı

https://github.com/ceougur/ofis---y-netimi/releases/new?tag=v2.4.8&target=master&title=DestekOfis%202.4.8

(Etiket v2.4.8 yayını açarken GitHub'da oluşur; hedef **master** — PR birleştirildikten SONRA açılır.)

## GitHub yayınına yüklenecek 5 dosya

| Dosya | Boyut | SHA-256 |
|---|---|---|
| destekofis-guncelleme-2.4.8.zip | 7.732.220 B (328 dosya) | cd330c97cbc0246ca707f08a9a3e657f0d610360d94fadee9e5831fbb4c63557 |
| destekofis-guncelleme.json (imzalı, anahtar destekofis-2026-1) | 1.470 B | 6e2da4563e6cbaa4c0b2c5639213acd41fbd0c8fcb0ae3d1606a92b0c8625044 |
| DestekOfis-Kullanim-Kilavuzu.pdf ("Sürüm 2.4.8") | 5.099.120 B | 52d9ba928b2ea7fc610afaecaff96b3ba9b224a8cc1dcb25d3a3123dceaa5de6 |
| DestekOfis-Kurulum.exe (sürüm 2.4.8.0, simgeli) | 37.531.256 B | 092c0b5c6151d8f0ddc0a94174d61890c0b731795b9cfef6ad94fbc4bd6e4954 |
| DestekOfis-Kurulum.exe.sha256 | 89 B | 3641e85948a6c1f028ded232bbe9f54bb9c5da8ce9d27ac0b697df7252f22a91 |

Kurulum 30 MB'ı aştığı için ayrıca iki parça + birleştirme dosyası verilir (bunlar yayına YÜKLENMEZ):
`DestekOfis-Kurulum.exe.parca0` (18.765.628 B, b4fc822e…), `DestekOfis-Kurulum.exe.parca1` (18.765.628 B, c775c8b6…), `BIRLESTIR.bat` (282196d0…).
Üçünü (isterseniz .sha256 ile birlikte) aynı klasöre koyup BIRLESTIR.bat'a çift tıklayın; "TAMAM: Özet eşleşti" yazarsa oluşan DestekOfis-Kurulum.exe yayına yüklenir.

## Arşiv (GitHub'a YÜKLENMEZ)

- `DestekOfis-2.4.8-Arsiv-Belgeler-Kaynak-Denetim.zip` (~24 MB): bu teslim notu, sürüm notları, iş listesi, kanıtlar (2026-10-30 … 2026-11-02), paket kanıtı, OKU-BENI, SHA256SUMS.
- Kaynak paketi (git bundle, 190 MB) zip'in dışında 5 parça: `DestekOfis-2.4.8-Arsiv-Kaynak.bundle.parca0 … parca4`; birleştirme ve beklenen özet OKU-BENI'de
  (bundle sha256 12412974…; klonda HEAD 18378e77, fsck çıkış 0).

## Sürüm notu (GitHub yayın metni)

**2.4.8 — WhatsApp Otomatik Gönderim ve İyileştirmeler**
- Yeni: WhatsApp ile otomatik gönderim — Yönetim → WhatsApp'ta işletmenizin Meta (WhatsApp Business API) bağlantısı; carilere toplu ekstre (PDF ile) ve ödeme hatırlatması; aynı dönemin ekstresi aynı kişiye ikinci kez gitmez; WhatsApp Gönderimleri ekranında durum izleme; caride "WhatsApp Mesajı İstemiyor".
- İyileştirmeler: iPhone'da eşleme ana ekran simgesinden, ücretli lisans bitince telefondan 30 gün salt okunur kullanım, Excel / Sheets yüklemesinde bağlantı koparsa çift kayıt açılmaz.

(CHANGELOG.md 2.4.8 bölümüyle aynı; ayrıntı docs/2.4.8-DEGISIKLIKLER.md.)

## (a) Kısa özet

2.4.8 ile carilere WhatsApp'tan ekstre (PDF ile) ve ödeme hatırlatması programdan kendiliğinden, toplu gider — işletmenin kendi Meta hesabıyla ("Elle Bağla"), aynı kişiye
aynı dönemin ekstresi ikinci kez gitmeden ("kime kaç kez" ilkesi, kullanıcı 31.10 12:40). Mobil tarafta iPhone eşlemesi ana ekran simgesinden ve ücretli lisans bitince 30 gün
salt okunur telefon; Excel / Sheets yüklemelerinde istek kimliği (bağlantı koparsa çift kayıt yok). Son gün iki ek düzeltme: büyük şirkette WhatsApp önizleme/başlatma 23–26 sn →
~1 sn (İş Z) ve bozuk şirket dosyası açılamayınca bağlantının kapanması (openDatabase; Windows'ta dosya kilitli kalıyordu, 1.x'ten beri). "WhatsApp'ı Bağla" (Yol 2) düğmesi
görünür ama vergi kaydı + Meta Tech Provider onayından sonra çalışır.

## (b) DENENEN

- **T1 kâhin (temiz oda, kodu görmeyen ajan; Python):** 284 senaryo, kâhin kendi testi 307/307 × 2 TZ, mutasyon 163/163. Resmî koşu d693451f (iki uç aynı, GEÇERSİZ 0);
  İş Z sonrası yeniden (Aday 2 589558bd, imzalı / Europe/Istanbul / hızlı uç — kullanıcı kararı "284 senaryo, tek koşul"): **25 tam / 193 gösterim / 66 ayrışık = f822e733 ek
  koşusuyla BİREBİR; hiçbir senaryoda davranış farkı ya da fark listesi değişmedi** (kanıt docs/kanit/2026-11-01/248-t1z/). Ayrışıkların hepsi ana oturumca sınıflandı (bilinen sınıf,
  KÂHİN-YORUMU, ORTAM; ICERIK-09 kullanıcıya soruldu → "Gittiği anki içerik"). Kâhin programa uydurulmadı (ders 5, 40). L1 kâhini (kapıcı/lisans) 150/150, mutasyon 71/71.
- **T2 bağımsız gözden geçirme + dar kontrol 1–20** (her düzeltmeden sonra yalnız o farka, xhigh; docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md). DK19 gerilemesi → İş Y geri alındı
  (kullanıcı kararı); DK20 (İş Z) YÜKSEK/ORTA yok; openDatabase dar kontrolü YÜKSEK yok, gerileme yok (ORTA-1 önceden var → BİLİNEN SINIR, kullanıcı "a").
- **T3 UI/UX** (49395f77; yeni/değişen ekranlar, Tab + insan hızı, yazım düzeni, pasif düğme nedeni): YÜKSEK yok; 3 ORTA düzeltildi.
- **T5 göç** (v2.4.7 gerçek kodu, 6.108 istek, 13 ay, 2 şirket → v44): 29/29; mizan 001 51.451.736,50 / 002 36.400.282,81 borç = alacak; Mutabakat sapma 0; WhatsApp 46/46;
  yedek geri yükleme 14/14; geri dönüş 6/6; zincir v2.4.4 → v2.4.7 → aday 6/6; ara şemalar v42/v43 → v44 30/30.
- **T6 arıza:** gerçek SIGKILL 10 tohum × 12 kişi 120/120 (çift 0, kayıp 0); gerçek tmpfs disk dolu 3/3; kilitli dosya 2/2; Meta 5xx/429/zaman aşımı/internet 4/4; yedek/geri yükle/
  sıfırla 3/3; göç ortasında SIGKILL v40–v43 → v44 20/20 × 4.
- **T9 ölçek** (programın kendi API'siyle üretilen veri; kullanıcı kararıyla 40 gönderim × 2.000 kişi): 2.000 kişilik gönderim 17/17 — 2.000/2.000 teslim, çift 0; gönderim sürerken
  Cari Listesi p95 254 ms, Kasa p95 859 ms; olay döngüsü en çok 1.878 ms; 24 saat 250 sınırı 16/16; geçmişle büyüme küçük (Gönderimler ilk 30 p50 2 → 7 ms); mobil özet gerilemesi yok.
- **İş Z (önizleme/başlatma hızı; davranış aynen):** eşitlik testi fark 0 (3 veri × 72–98 adım 271/271, 295.948 kişi satırı; cari kartı 3.631/3.631; defter SQL 504 parametre × 2);
  kalıcı test eski kodda 0/3 beklenen nedenle, yenide 3/3; mutasyon 5/5. Süre (aynı veri kopyası, flock — ders 15): 2.000 cari önizleme 26,0–30,8 → 0,68–1,07 sn; 3.014 cari
  40,0–40,6 → 1,12–1,33 sn; başlatma 2.000 28,3 → 0,8 sn. Ana oturum ayrı kopyada yeniden ölçtü: 0,76–1,04 sn; başka kullanıcının beklemesi 0,55–1,30 sn.
- **T10 tam kapı** (Aday 2 589558bd kodu): tam npm test **4.468/4.468** (başarısız 0, iptal 0, atlanan 0); ci.yml kâhinleri 8 koşu 52.697/52.697; ci.yml e2e 82 satırın tamamı
  (iz1-kasa-acilis ayın 1'i TEST hatası, ders 13 → cdb06535, 21/21); CI dışı senaryolar 16/16 (1.318/1.318); CI dışı kâhin farkları önceki koşularla BİREBİR (mobil-erişim 31/42,
  mobil-yazma 52/54, sayaç 47/50 — bilinen).
- **Windows (bağımsız koşucu, ders 1, 18, 21, 48):** CI #943/#944'te Windows'a özgü 7 hücre görüldü (5'i testte beklenmeyen async closeCompany, 2'si üründe openDatabase tutamak
  sızıntısı) → düzeltildi; **CI #945 (e2380d7e) YEŞİL** — Linux Node 22/24 + Windows Node 22/24 + Chromium e2e + Doğrulama Kapısı + Dağıtım paketi; düzeltilen 7 hücre Windows'ta iki
  koşuda yeşil. **windows.yml #69 + #70 (e2380d7e) YEŞİL** (gerçek Windows'ta kurulum/servis/güncelleme/kaldırma, kurulum sürümü 2.4.8).
- **Uzun Doğrulama #1089 (e2380d7e):** YEŞİL — 27/27 iş başarılı (Uzun Doğrulama Kapısı dahil): mutabakat 5.000 işlem × 10 tohum (Linux) + Windows tohum 1; tek sıralı uzun
  mutabakat 10.000 işlem (her işlemde doğrulama; 03:14 → 06:53 UTC, 3 sa 39 dk); güvenilirlik 10.000 işlem × 5 tohum × iki taban (boş + 2.0.19 zinciri) + Windows
  (boş, tohum 1); kâhin cari/evrak (30 tohum × 120), kâhin tutar (20 × 200), kâhin e-Belge (5 × 300). Ana oturum GitHub API'sinden okudu, 02.11.2026 06:56 UTC. (UD #1081 33359883 yalnız ara kanıt: ürün kodu e2380d7e'de değiştiği için 2.4.7 kuralıyla yeniden koşuldu.)
- **Paket (T15, bu teslim):** `release.mjs` kapısı yeşil; imza programın kendi `verifyEnvelope` + `TRUSTED_UPDATE_KEYS` ile ok (anahtar destekofis-2026-1, sürüm 2.4.8), zip özeti/
  boyutu bildirgeyle aynı; `assessManifest` 2.4.7 / 2.4.6 / 2.4.5 / 2.1.0 ok, 2.4.8 NOT_NEWER; payload tahrifi ve imza baytı bozulması reddedildi. Eski sürümlerin GERÇEK
  güncelleyicisi (git archive v2.4.7, v2.4.6) yerel sahte yayın sunucusuna karşı, GitHub API ve API 403 → yedek yol: dördü de "available 2.4.8", paket indirildi + özet doğrulandı;
  2.4.8'in kendisi up-to-date ("SONUÇ: hepsi beklendiği gibi"; gerçek GitHub'a istek yok, HUKUK_LICENSE_URL=127.0.0.1:9). Kılavuz PDF pdf-denetle **39/39** (sunucunun verdiği kopya
  sha256 52d9ba92…). Güncelleme zip'i: 328 dosya (server 234, client 88, CHANGELOG, README, package.json 2.4.8, docs/KURULUM-VE-KULLANIM.md, tools/backup.mjs, tools/mutabakat.mjs);
  .env / .pem / sqlite / test / kanıt dosyası YOK; içerikte "PRIVATE KEY" ve `BEGIN … KEY` YOK; EAA ile başlayan iki eşleşme gib-logo.mjs içindeki JPEG base64'ü (belirteç değil);
  uzun onaltılık iki sabit cloudflared sürüm özetleri. Kurulum: Inno Setup + mingw windres; kurulum ve DestekOfis.exe başlatıcısında simge kaynağı var ("simgesiz" uyarısı yok),
  FileVersion 2.4.8.0. Parçalar: `cat parca0 parca1` = 092c0b5c…; BIRLESTIR.bat (CRLF 67/67) Wine'da certutil taklidiyle sınandı: sağlam parçalar "TAMAM: Özet eşleşti", parca1'de
  1 bayt bozuk → "HATA: Özet TUTMUYOR". Kaynak paketi (git bundle) klonlandı: HEAD 18378e77, ağaç birebir, fsck çıkış 0.
- **Uygulanan ders maddeleri:** 1, 2 (çıkış kodu + sayılar), 5 ve 40 (kâhin temiz oda, BAŞ MİMAR kararları aşağıda), 6 (her ayrışma yeniden üretildi), 7 ve 38 (kırmızı kanıt
  beklenen nedenle), 8 (CI dışı senaryolar koşuldu), 10 (İş Z bütün çağıranlar), 12 (Tab/insan hızı), 13 (iz1-kasa-acilis), 15 (ölçümler flock ile tek tek), 16 (ana oturum
  yeniden koştu), 18 ve 48 (Windows iki koşu), 21 (her push'un CI'si), 23 ve 25 (eski kod ayrı kopyada, benzersiz klasör), 24 (disk ≥ 5 GB okundu), 29, 30, 35, 37, 41, 42 (PDF
  yeniden üretildi + denetlendi), 43 (para / kime kaç kez soruları kullanıcıya), 44, 45, 46, 47.

## (c) DENENMEYEN

- T9'da 100 gönderimlik geçmiş (kullanıcı kararı: 40 gönderim; 100 → 2.4.9'da GitHub'da); 20'lik ara nokta; iki şirket aynı anda; 1.000.000 satır; Windows/müşteri makinesinde ölçüm.
- T1'in öbür 5 değişkesi (UTC, yol1, yol2, yavaş uç vb.; kullanıcı kararı "284 senaryo, tek koşul"; dayanak İş Z eşitlik testi, davranış aynen).
- Windows'ta yerel tam kapı (yerel kapı yalnız Linux; Windows yalnız CI + windows.yml).
- Gerçek Meta (WhatsApp Cloud API) gönderimi, gerçek Cloudflare tüneli ve gerçek telefon (iPhone ana ekran eşlemesi dahil) — kapsayıcıdan yapılamaz; yayından sonra sizin
  kurulumunuzda D0 (aşağıdaki elle kabul listesi). Gerçek Meta'nın yeniden deneme adresi (H2-02) ve META_D0 varsayımları (Resumable Upload/App ID, şablon açma yanıtı, kanca imzası,
  sınır hata kodu) gerçek Meta'da görülmedi.
- Kılavuz Banka/Kasa ad denetimi (docs/kilavuz/metin-denetle.mjs 168/200): girdi betiği ekran-banka.mjs v2.4.7'de de AYNI 7 adımda düşüyor (betik eskimiş, 2.4.8 gerilemesi değil) →
  2.4.9 (docs/kanit/2026-11-02/248-surum/metin-denetle-NOT.md). Zorunlu pdf-denetle 39/39 yeşil.
- Kurulumun Wine'da sessiz kurulumu/açılışı (x64 kurulum; kapsayıcıda yalnız wine32 — 2.4.5–2.4.7'de de yok); gerçek Windows'ta windows.yml #69/#70 koştu.
- WhatsApp kâhini senaryolar.py'nin CI dışı ek senaryoları ve CI dışı 14 yardımcı e2e (T10 NOT'u); Safari relatedTarget; 'reset' + Meta Bekletti birleşimi; Node 24 SQLite EXPLAIN metni.
- Mobil (S3) mobile-sync 2 sn zamanlayıcısı DOĞRULANMADI (İş S).

## (d) BİLİNEN SINIRLAR

DURUM 11 listesi (docs/GECMIS-KARARLAR.md "Arşiv 02.11.2026", AYNEN):
- Dosya kilidi kalkınca ~60 sn gecikme; kullanıcının yazımı kilitte 10 sn bekler.
- 503 penceresinde (5 dk) aynı WhatsApp numarasını başka araçla kullananda o aracın bildirimleri de 503 alır (Meta 7 güne kadar yeniden dener).
- 7 günü aşan şirket dosyası bozukluğunda "failed" bildirimi kaybolabilir (Meta 7 gün dener).
- 131049 (Meta Bekletti) sonrası iki teslim → kişiye 2 ileti (Bu Ay 2; önlenemez).
- Yine de Gönder iletisi gittikten SONRA kaynağın teslimi gelirse → 2 ileti (W7).
- n3: kuyruktaki ikinci iş, birincinin geç teslimiyle 2 ileti → 2.5.0.
- Defter kilitliyken önizlemede onarılamamış kişi "gönderilecek" görünür ama gönderim başlatılamaz (düğme nedeni yazar).
- Veri dosyası geri gelince satır ~3 gün "Meta Kabul Etti" görünebilir.
- accepted_at / U5 eski satır sınırları yalnız 2.4.8 geliştirme verisini etkiler (müşteride yok).
- Veri dosyası kayıpken Birleşik Rapor 500.
- Yol 1'de (Elle Bağla) S9-1 pratikte devreye girmez (imzasız kanca).
- Yerel duraklatma metni (ulaşılmaz yol).
- Ödeme Hatırlatma gönderim anında okunur (BAŞ MİMAR).

DURUM 12 ekleri:
- dk18 bulguları (İş Y geri alındı; 2.4.9): ertesi gün Başarısızları Yeniden Dene'de hatırlatma dünkü teslimle elenir (güvenli yön; yeni hatırlatma gönderimi açık); şirket geçici
  açılamazken fiyatsız "read" Bu Ay ücretli sayısını +1 yapabilir; Yol 2'de (bugün kapalı) imzasız bildirim 503 yolunda deftere yazılır.
- T1: H2-02 başka bilgisayara taşımadan sonra Meta'nın yeniden denemesi eski kanca yoluna giderse 404 → Sonucu Belirsiz (güvenli yön, çift ileti yok); J10-03 Devam Et'te atlanacak
  yeniden deneme için PDF boşuna yüklenip silinir (ileti gitmez); Tüm Hareketler PDF başlığında başlangıç tarihi yok ("… tarihine kadar"; iletideki {3} aralığı doğru) — 2.4.9 önerisi.
- T9: bakım turu (60 sn'de bir) geçmişle 1–2 → ~200 ms; şirket dosyası 40 gönderimde 185 → 434 MB (boşaltılan pdf_blob boşluğu; yedek VACUUM INTO ile sıkışık); kapıcı ofis başına
  600 kanca/dk — uzun kesinti sonrası birikmiş bildirimler gecikir.
- İş Z: geçmişli 3.014 caride Tümünü Seç bir koşuda 3,37 sn (bütçe 3 sn); önizleme/başlatma hâlâ eşzamanlı (~0,5–1,5 sn öbür kullanıcılar bekler), defter sorguları geçmişle doğrusal;
  davranış notu (c): bir carinin ekran eki hata verirse kişi önizlemede "gidecek" sayılır, gönderim anında tam kartla "Cari Silinmiş" elenir (olağan veride fark yok); cari kartı
  açılışı ~12–15 ms (openingEntryOf dizin seçimi, 2.4.6'dan beri) → 2.4.9; elle toplu gönderim (WhatsApp Web ile Gönder) alıcı listesi 2.000 caride ~20 sn ve bu sürede olay döngüsü
  kilitli (2.4.7'den beri; kullanıcı "2.4.9'a bırak"); çok iade faturalı şirkette returnCuts taraması ölçülmedi.
- 02.11 ORTA-1 (kullanıcı "a"): createApp'ta openDatabase başarılı olup sonraki adım (göç / kullanıcı aynalama; kilitli dosya ya da derin bozulma) düşerse bağlantı kapanmıyor (1.x'ten
  beri; çöp toplama / yeniden başlatma çözer; Windows'ta bu arada Yedekten Geri Yükle "Veri dosyası değiştirilemedi" 500 verebilir — koddan, DOĞRULANMADI) → 2.4.9
  (docs/kanit/2026-11-02/db-bozuk-dk/NOT.md). Ayrıca önceden var olan: 001 bozuksa bekleyen geri yükleme NOTADB'de düşer.
- Önceki turlardan: İş R öncesi çözülmüş 2. denemelerde accepted_at 1. denemede kalır (göç yok); Süresi Doldu kişi 24 saat sayacından da düşer (Teslim Süresi < ~22 sa iken etkili);
  E2-03 günlük sınırda B6 sırayı değiştirebilir; SINIR-05 24 sa sınırının anı istek süresi kadar kayabilir; ICERIK-04 PDF dosya adında art arda boşluk (2.5.0); A7 dosya satırı ilk
  bildirime kadar Sonucu Belirsiz; pencere dışı sonuçsuz istek toparlamada Sonucu Belirsiz.
- BİLİNEN RİSK (kullanıcıya hatırlatıldı): Meta "yalnız izin vermiş (opt-in) kişiye gönder" der; ürün kararı opt-out (bir kez onay + "WhatsApp Mesajı İstemiyor").
- Test altyapısı (2.4.7'den): mutabakat testleri her yıl 1 Ocak–30 Nisan arası yanlış kırmızı verebilir (motor modeli yıl bilmiyor; ürün doğru) — devir sürümünden önce.

## (e) KARARLAR

### KULLANICI KARARLARI (kaynak: CLAUDE.md Açık iş ve docs/2.4.8-IS-LISTESI.md satır no)
- 30.10 12:27 (5 dk yetkisiyle) S1–S4 A: durum kancası kapıcıdan geçer, saklanmaz; utility TTL 3 gün; teslimden sonra PDF Meta'dan silinir; bağlama sayfası kapi.destekofis.net/wa/bagla (İL 39).
- 30.10 ~14:30 "önerilerin uygun": §7a K1 A (sabit hat/yurt dışı elenmez), K2 A (aynı telefon iki cari → iki ileti), K3 A (ekstre şablonu "Dönem sonu bakiyesi: {{4}}. İyi günler dileriz."); §7a'nın öbür 29 baş mimar kararı kabul (İL 47).
- 30.10 15:18 (5 dk yetkisiyle): R1 internet yokken "Bağlantı Bekleniyor", R2 kategori her 100 iletide / en geç 10 dk, R3 "Daha Önce Gönderildi" uyarısı varsayılan Bunları Çıkar (İL 49).
- 30.10 ~16:15 Aydınlatma metni en yaygın kullanımla, NOTICE_VERSION 2.4.8-1 (İL 57); ~16:25 D0 (gerçek Meta) yayından SONRA kullanıcının kurulumunda (İL 59).
- 30.10 ~18:05 wa.me / WhatsApp Web yolu KAPANMAZ (İL 78).
- 30.10 20:38 / 21:30 (5 dk yetkisiyle) S-L1a A (servisin tanımadığı ofis 60 gün sonra silinir), P14–P17 A (30 gün = bitiş + 30×24 sa; hoşgörüde yeni cihaz eşlenmez; …) (İL 96, 100).
- 30.10 23:21 (5 dk) S-PC A — iki yol da eler (İL 108); 31.10 00:05 (5 dk) P1 A, P2 A (başlatma iletisi "Meta'ya ulaşılamıyor; gönderim başlatılmadı…"), P5 A (Elle Bağla App Secret 2.5.0) (İL 114).
- 30.10 ~20:05 YETKİ + TESLİM TALİMATI: 5 dk yetkisi; PR → master birleştirme T1–T15 yeşilse önceden onaylı; teslimde 5 dosya + yükle bağlantısı (CLAUDE.md).
- 31.10 ~03:15 T16 canlı kapıcı dağıtımı ONAYLI (birleştirmeden sonra, yayından önce) (CLAUDE.md, İL 203).
- 31.10 ~03:20 "önerilerini yap": T2-1 A (dönem eşliği), P3 Süresi Doldu "Daha Önce Gönderildi" sayılmaz, B1 B (gecikmiş = taksit kartı vadesi; açılış vadesi 2.5.0) (İL 132).
- 31.10 ~05:25 "a": Bu Ay / Geçen Ay aynı takvim ayıysa aynı dönem (BAŞ MİMAR KARARI (1) geri alındı) (İL 136).
- 31.10 ~06:45 "a": Son 3 Ay / Tüm'de kuyrukta aynı seçimle bekleyen iş varsa yaşına bakılmadan "Zaten Kuyrukta" (İL 141).
- 31.10 ~06:55 Bağımsız doğrulama prensibi kalıcı belge (docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md).
- 31.10 ~07:05 "a şıkkı": asıl işin Yine de Gönder kararı Başarısızları Yeniden Dene'ye ve işteki Yine de Gönder'e taşınır; yalnız asıl işin açılışından önceki kabuller yok sayılır (İL 147).
- 31.10 ~08:00 "A": önceki yeniden denemesi Sonucu Belirsiz kalan kişi Başarısızları Yeniden Dene'de elenir; yol işteki Yine de Gönder (İL 153).
- 31.10 ~08:20 "şimdi yap": Gönderimler ekranına Daha Fazla Göster (30'ar) + Başlangıç/Bitiş süzgeci (İL 155).
- 31.10 ~09:35 "A": asıl işin Yine de Gönder sınırı Sonucu Belirsiz elemesine uygulanmaz (İL 159).
- 31.10 ~10:10 "a": iptal edilen Meta Bekletti (teslim yok) sayılmaz, geç teslim gelirse sayılır (İL 161); ~11:00 "A": geri yükleme / taşıma ile duran Meta Bekletti de sayılmaz (İL 165).
- 31.10 ~10:50 "B": ★ 8 madde tek tek soruldu; ★ olmayan 7 madde 2.5.0 / BİLİNEN SINIR (İL 222).
- ★ 1/8 "b": Sonucu Belirsiz kişi yeni toplu işte de elenir (İL 225). ★ 2/8 "a": hatırlatma aynı yerel gün ikinci kez "Daha Önce Gönderildi", süren iş varken "Zaten Kuyrukta" (İL 229).
- ★ 3/8 "a": Son 3 Ay / Tüm'de 7 gün yeni gönderim anından (İL 232). ★ 4/8 "b": özel aralık o günün hazır seçimiyle birebir aynıysa aynı dönem (İL 234).
- ★ 5/8 "a": asıl işte Başarısız + sonraki denemesi teslim edilmiş kişi yeniden denemede elenir (İL 237). ★ 6/8 "a": Yine de Gönder ile aşılmış eski belirsiz de eler (İL 240).
- ★ 7/8 "a": geri yüklemeden sonra yalnız defterde kalan KABUL R3'te sayılır (İL 243). ★ 8/8 "a": taşınan veride dosyadaki kabul/teslim R3'te sayılır (İL 245).
- ★ Ek 1/4 "a": yalnız defterde kalan belirsiz yeni toplu işte elemez (İL 272); Ek 2/4 "a": tek eleme nedeni, sıra Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi (İL 274);
  Ek 3/4 "a": hatırlatmada belirsiz eşliği aynı yerel gün (İL 277); Ek 4/4 "a": Son 3 Ay yeniden denemede 7 gün kuralı üstün (İL 279).
- ★ Son 1/2 "a": işteki Yine de Gönder başka denemenin belirsiziyle elenmez (İL 287); Son 2/2 "a": hatırlatma yeniden denemesinde "aynı gün" yeniden denemenin günü (İL 289).
- 31.10 ~11:45 "A": Sonucu Belirsiz iş dosyada dururken ileti yalnız işteki Yine de Gönder'i önerir; iş yoksa "yeni gönderim başlatın" (İL 169, CLAUDE.md).
- 31.10 ~12:00 "a": DONDURMA (dar kontrol 9'dan sonra yeni kural yok) (İL 171). 12:38 DK9 S1c "a": yeniden denemede özel aralığın "o gün"ü asıl işin günü (İL 319).
- 31.10 12:40 "a": WHATSAPP "KİME KAÇ KEZ" GENEL İLKESİ (1)–(5) (CLAUDE.md; İL 321).
- 31.10 18:09 / 18:14 / 18:18: kilit ailesi ve dk10+ DÜŞÜK'ler de 2.4.8'de çözülür; DÜŞÜK-2 A (inherit iş teslim edilince kaynak belirsiz o kişi için sayılmaz) (İL 403, CLAUDE.md).
- 01.11 05:58 "Şimdi durdur" + "Bilinen sınır": İş V + son dar kontrol 17; sonra yalnız YÜKSEK/ORTA + gerilemeler; n3 → 2.5.0 (İL 521).
- 01.11 06:28 "Hepsini onaylıyorum": İş R–V'nin 8 WhatsApp davranışı onaylı (teslim her durumda sayılır; Meta Bekletti teslim edilirse 2. deneme gitmez; geç "teslim edilemedi" her durumda
  geçerli; Süresi Doldu son kabul edilen denemeden; Bu Ay her teslimi sayar; 503 "sonra tekrar dene" kuralları; onarım bekleyen kabul varken yeni gönderim başlamaz; dönem eşliği) (İL 526).
- 01.11 07:07 S9-1 "Gitmesin", S9-2 "İlk hareket – gönderim günü"; 07:11 S9-1 kapsamı "yalnız belirsizlik onayları", S9-2 "ekstrenin hazırlandığı gün" (İL 536, 539).
- 01.11 09:09 ders 46 + DURDURMA KURALI (DK19 son tur) (İL 567); ~10:15 "İş Y'yi geri al" (İL 578); ~10:40 ICERIK-09 "Gittiği anki içerik" (CLAUDE.md).
- 01.11 ~15:45 T9 "40 gönderimde ölç" (İL 601); ~16:30 "bu sürümde düzelt" → İş Z (İL 605); ~16:40 elle yol alıcı listesi "2.4.9'a bırak" (İL 610);
  ~18:50 kılavuzda WhatsApp toplu gönderim hap bilgisi; ~19:55 T1 "284 senaryo, tek koşul" (İL 628).
- 02.11 ~03:15 "a": createApp ORTA-1 BİLİNEN SINIR + 2.4.9 (İL 669).

### BAŞ MİMAR KARARLARI (ders 40; kullanıcıya gösterilir — kaynak İL = docs/2.4.8-IS-LISTESI.md satırı)
- W1: belirteç GET'te hiç görünmez (yalnız "Kayıtlı"); bağlantı tek ayar satırı `whatsapp.meta` (Tümünü Sıfırla'da korunur); Kaydet ve Sına başarısız sınamada da kaydeder; deneme iletisi yalnız hello_world (İL 41).
- M1–M3: tünel sayacı connIndex kümesiyle; cloudflared günlüğü 512 KB × 2, `bilesenler/cloudflared`; kapıcı Türkçe HTML sayfası yalnız tarayıcı gezintisinde (İL 44).
- W5/W6: şablonlar sınamadan sonra kendiliğinden açılır; Meta'da içeriği değişmiş şablon "gönderime hazır değil"; KVKK alt satırı yalnız ekstrede; aydınlatma metni yalnız yöneticiye (İL 53).
- Grup 5 ★1–★5 (§7a; 30.10 14:30 kullanıcı kabulü): wa.me yolunda da İstemiyor cari seçilemez; Sonucu Belirsiz ne Zaten Kuyrukta ne Daha Önce Gönderildi (sonradan ★ kararlarıyla
  güncellendi); pasif cari açılışta ve gönderim anında elenir; Tüm Hareketler = bugüne kadar; hatırlatmanın dönemi gönderim günü (İL 64).
- W4: önizleme onaysız; yol adları "Otomatik Gönder" / "WhatsApp Web ile Gönder"; onay metni "Aydınlatma metnimi okudum, carilerime ulaştıracağım."; pasif neden sırası bağlantı → lisans
  → yetki → sınama → şablon → onay → firma adı; tahmini ücret × 0,0009 USD (İL 84).
- M4: iOS'ta karekod yalnız yönlendirir; simgede "Cihazı Eşleştir" formu; kamera izni yalnız /mobil/index.html (İL 86). I1: istek kimliği ilk raporu taşır, 30 gün budama (İL 88).
- Kapıcı (L1/K1/W7): engelin başlangıcı kapıcının ilk gördüğü an; silme yalnız taze doğrulanmış lisansla, ofis başına günde bir sorgu; lisansı geçersiz yeni ofis yazılmaz; hoşgörüde
  özet yüklenmez; F2 son bilgi silme anından önceyse silinmez (müşteri lehine) (İL 96, 102); F4/F5 ileti metni kararları (İL 100).
- T2 düzeltmeleri: Duraklat/Devam aynı PDF, "Gönderime Hazır" tek kural, firma adı silinince iş durur, içerik ilk hazırlıkta donar / uygunluk her denemede güncel (İL 116);
  ileti isteği her seferinde yeni bağlantı (İL 124); makine defterinde yalnız eklenen batch_log, wamid gönderime geçerken boşaltılır, Meta Bekletti iş sınır beklemesinde ileri alınır (İL 128).
- T2-1 okunuşu (2) Son 3 Ay / Tüm'de bekleyen işe 7 gün penceresi yok (sonra kullanıcı 06:45 "a" ile kesinleşti); (1) Bu Ay ≠ Geçen Ay → kullanıcı A ile GERİ ALINDI (İL 134–141).
- Süresi Doldu kişi 24 saat sayacından da düşer (İL 140). send_again sütunu = asıl işin açılış anı, sınır kesin "sonra" (İL 151).
- Son denemenin sonucu failed ve teslim yoksa kişi sayılmaz (P3'ten; İL 161). İptal edilmiş Meta Bekletti'nin geç teslimi "Teslim Edildi" + Bu Ay; eleme iletisine "(ileti iki kez gidebilir)" (İL 165).
- DK8 (1)–(4): 'stop:moved' sayılmaz; eski denemenin geç teslimi Bu Ay'ı artırır (iş "Başarısız" görünür kalır); Daha Fazla Göster yenileme bitince; yarım tarih bir sonraki çıkışta (İL 255).
- İş G/H/I (5)–(8): "o gün" = özel aralığın kullanıldığı gün; İş I "Gönderildi" sayılır; dosyadan gelen kayda 7 gün + sınır aynen (sonra İLKEYLE); yalnız defterdeki belirsiz yeni işte elemez (İL 297).
- T1 test altyapısı: kabul kaynağı telin bağımsız kaydı (İL 307, 331); B6 belirsiz istek 24 sa penceresinde sayılır (güvenli yön), SINIR-05 kesin sınır kalır, ICERIK-04 2.5.0 (İL 335).
- Kâhin K1/K5/K7/K8 okumaları (hatırlatma aynı gün, programın saati, 2. deneme reddi, en yeni önce / yerel gün / iki uç dahil / ters aralık ret) — kâhinde `kaynak_turu` işaretli (İL 219).
- Kâhin 7: "Son 3 Ay" o günkü tarihleri dört okumanın birleşimi; "Tüm Hareketler" = ilk hareket – o gün (İL 344).
- İş O/P/Q (1)–(8): P2 notu yalnız Sürüyor işte; kilit işareti "Dosya Kullanımda"; Q5 pencereler son kabul anından; Q4 imzalı failed dosyada olmayan işte "teslim edilemedi"; Q2 zincir geçişli; Q1 ileri tarihli hareketli cari kişiye özel eşlik almaz (İL 423).
- İş R: kapalı bağlantıda sınama yazılmaz; yeniden deneme zamanlayıcıları kapanışta silinir; iki kilit → şirket cümlesi; accepted_at = son kabul edilen deneme; KARAR 8 GERİ ALINDI (hareketsiz cari = iletideki dönem) (İL 446, 453).
- İş S: imzasız bildirim de "satır o denemede" kolunu ilerletir; "Meta Kabul Etti" yazımı yalnız iş hâlâ o denemede (İL 464, 469).
- İş T/U: bildirim yazımı defter → dosya, yazılamazsa 503; tanınmayan bildirime 5 dk 503 penceresi; tek karar fonksiyonu resolveStatus (İL 480, 486) — 01.11 06:28 kullanıcı onayıyla kesinleşti.
- İş V: kalıcı = yalnız silinmiş şirket + veri dosyası yok, öbür açılış hataları geçici (503); teslimi olan işe talep açılmaz (İL 516).
- Y9c-4: S9-1'de atlanan yeni ileti "Atlandı — Daha Önce Gönderildi", Bu Ay'a girmez (İL 543); Ödeme Hatırlatma (PDF'siz) gönderim anında okunur (İL 546).
- T1 sınıflama: Tüm Hareketler PDF başlığı KÂHİN-YORUMU (07:11 "kod değişmez"; PDF'e başlangıç 2.4.9 önerisi) (İL 586).
- İş Z (c) ekran eki hata davranış notu; (e) openingEntryOf dizin düzeltmesi bu sürümde yok → 2.4.9 (İL 624).
- UD #1081 sürüm commit'i için geçerli sayıldı (sürüm/belge/PDF ürün mantığını değiştirmez) — sonra ürün kodu e2380d7e'de değişince UD #1089 yeniden (İL 661, 663, 668).
- openDatabase bozuk dosya tutamak sızıntısı ORTA sayıldı, bu sürümde düzeltildi (PRAGMA try/catch + db.close + yeniden fırlat) (İL 668).

### İLKEYLE UYGULANANLAR (31.10 12:40 genel ilke; İL = iş listesi satırı)
- DK9 kalan 6 soru: S1a hazır seçim gönderiminin o günkü tarihleri de özel aralık anahtarı; S1b kendi günlerinde Bu Ay'a eşit iki özel aralık aynı dönem; Q-I1 dosyadan gelen kabule 7 gün +
  Yine de Gönder sınırı; S2 taşınan veride dosyadaki Sonucu Belirsiz iş eler (yol işteki Yine de Gönder); S3 'stop:reset' ile duran Meta Bekletti sayılmaz; S4 Bekletti sonrası 2. deneme
  belirsizse neden "Sonucu Belirsiz" (İL 321).
- Kâhin 6: asıl işte Başarısız + sonraki denemesi teslimsiz durmuş kişi asıl işten yeniden denenince gönderilir; işteki Yine de Gönder asıl işte belirsiz kalmış denemede de çalışır;
  Son 3 Ay / Tüm'de tam 7. gün aynı dönem, açılışla aynı an "sonra" (İL 327).
- R3 yalnız son denemesi kabul/teslim edilmiş işi sayar; teslim edilmiş iş belirsiz elemesine girmez; L3 dosyada olmayan işin geç teslimi yalnız 131049 ile bırakılmış denemede (İL 341).
- L5 (ilke 3): Son 3 Ay / Tüm gönderiminin o günkü tarihleri özel aralıkla birebir aynıysa aynı dönem (İL 342). (SAPMA kaydı: dondurmadan sonra eklendi, dk10 DÜŞÜK-1'i doğurdu — İL 362.)
- H2–H4 (kâhin 8; İL 413); B6 belirsiz istek 24 sa penceresinde sayılır — ilke (2) güvenli yön (İL 335).
- İş R: R5 özel aralık anahtar kuralı tek yardımcı, Tüm'e iki yönde (ilke 3); R6 (ilke 3); R7 dosyada olmayan işte kabul edilmiş son denemeye teslimden önce failed → teslim edilemedi (ilke 1) (İL 441–447).
- İş S: S1 DÜŞÜK-1 ilke 1 tek okuma (İL 461). J8 iki okuma birlikte (G0 (3)) (İL 534).

## (f) ELLE KABUL LİSTESİ (KANIT KURALI 5 — yayından sonra sizin kurulumunuzda, D0; ekran adları koddan doğrulandı: client/assets/hof-whatsapp-ayar.js, hof-whatsapp-api.js, hof-whatsapp.js, hof-accounts.js)

1. 2.4.8'e güncelleyin (ya da kurun) → program açılır, sürüm 2.4.8; Cari Listesi bakiyeleri önceki gibi.
2. **Yönetim → WhatsApp** (yalnız yönetici) → **Elle Bağla** → Telefon Numarası Kimliği (Phone Number ID), WhatsApp Business Hesap Kimliği (WABA ID), Uygulama Kimliği (App ID; isteğe
   bağlı) ve Kalıcı Erişim Belirteci (System User) → **Kaydet ve Sına** → durum **Bağlı**; numara, görünen ad ve gönderim sınırı görünür. Belirteç ekranda görünmez ("Kayıtlı").
3. **Bağlantıyı Sına** → yine **Bağlı**; **Bildirim Yolu** satırı teslim bilgisinin geldiğini söyler (çakışma varsa nedeni yazar).
4. **Kendime Deneme Gönder** → kendi cep numaranızı yazın → telefonunuza Meta'nın hazır deneme iletisi BİR kez gelir.
5. **Bilgilendirme Şablonları**: Ekstre ve Ödeme Hatırlatma satırları Meta'ya gönderilmiş görünür; Meta onaylayınca (dakikalar–saatler) **Onaylı**; gerekirse **Şablonları Denetle ve Oluştur**.
   Bir şablon Pazarlama'ya alınırsa satırda kırmızı uyarı çıkar (o şablonla gönderim yapılmaz).
6. **Aydınlatma Metni Hazırla** → firma bilgileriyle metin; **Aydınlatma Metni - PDF** iner. **Gönderim Onayı** kutusu ("Aydınlatma metnimi okudum, carilerime ulaştıracağım.")
   işaretlenmeden otomatik gönderim başlamaz — işaretlemeden önce bir cari için önizlemede **Gönder** düğmesinin pasif olduğunu ve nedenini görün, sonra işaretleyin.
7. **Tek cariye ekstre:** Cari Listesi'nde kendi numaranızın yazılı olduğu bir deneme carisini seçin → **WhatsApp Ekstre** → **Otomatik Gönder** sekmesi → Ekstre Dönemi **Bu Ay** →
   önizlemede 1 kişi "gidecek", **Gönderim Özeti**'nde tahmini ücret ~0,0009 USD → **Gönder (1 Kişi)** → onay → telefonunuza ekstre iletisi + PDF gelir; iletideki "Dönem sonu bakiyesi"
   cari kartındaki bakiyeyle aynı.
8. **Gönderimler** → bu gönderim: durum **Teslim Edildi** (okuyunca **Okundu**); Yönetim → WhatsApp'ta **Bu Ay Gönderilen İleti Sayısı** 1 artar.
9. **Kime kaç kez:** aynı cariye aynı gün yeniden **WhatsApp Ekstre** → **Bu Ay** → kişi **Daha Önce Gönderildi** (son gönderim tarihiyle) görünür, **Bunları Çıkar** seçili gelir →
   gönderilecek 0. **Yine de Gönder** seçerseniz bilerek ikinci kopya gider (denemek isteğe bağlı).
10. **Toplu gönderim + onay kutusu:** 3–5 deneme carisi seçin (biri "WhatsApp Mesajı İstemiyor" işaretli, biri telefonsuz) → **WhatsApp Ekstre** → önizlemede **Elenenler ve Nedenleri**:
    "WhatsApp Mesajı İstemiyor" ve telefon nedeni görünür; Gönder → yalnız uygun kişiler gönderilir; Gönderim Onayı kutusunu kaldırınca süren gönderim durur, **Devam Et** göndermez.
11. **WhatsApp Web ile Gönder** sekmesi eskisi gibi açılır (kendi WhatsApp'ınızla tek tek).
12. Edge'de Aydınlatma Metni ve ekstre PDF adının doğru indiğini, ilk gerçek tünel kopuşunda cloudflared günlüğünün (bilesenler/cloudflared) oluştuğunu ve kapıcı Türkçe hata sayfasının
    telefonda açıldığını görün (iş listesi T15 satırındaki ek kabul maddeleri).
Bir adım beklenenden farklıysa bana yazın (gerçek Meta'da görülmemiş varsayımlar — kanca imzası, şablon açma yanıtı, sınır hata kodu — burada ilk kez görülür).

## (g) T16 — Cloudflare Worker dağıtımı ve Meta gizlileri

ŞİMDİ (birleştirmeden SONRA, yayını açmadan ÖNCE; kullanıcı onayı 31.10 ~03:15):
1. `bulut/kapi` klasöründen `wrangler deploy` (Worker `destekofis-kapi`; rotalar kapi.destekofis.net, m.destekofis.net, *.destekofis.net/*; R2 `destekofis-ozet`; saatlik cron "23 * * * *"
   — L1 mobil kayıt temizliği). Yeni: WhatsApp kanca aktarımı (/wa/kanca, W9), bağlama sayfası /wa/bagla (W7; şimdilik "kapalı" der), lisans hoşgörüsü (L1/K1).
2. Var olan gizliler değişmez (KAPI_LISANS_ANAHTARI, CF_API_TOKEN — Cloudflare panelinde / `wrangler secret put`; değerleri hiçbir yere yazılmaz).
3. Dağıtımdan sonra 2.4.7 programıyla geriye uyum denetimi (mobil eşleme, son özet, tünel) + Worker istek sayısı ölçümü (GraphQL). Workers Paid kararı (~10 aktif WhatsApp müşterisinde) sizde.

VERGİ KAYDINDAN SONRA (yalnız "WhatsApp'ı Bağla" — Yol 2, Embedded Signup → Tech Provider → işletme doğrulaması; şimdi GİRİLMEZ):
1. Cloudflare Worker gizlileri: `wrangler secret put WA_UYGULAMA_SIRRI` (DestekOfis Meta uygulamasının App Secret'ı; Yol 2 kanca imzası ve kod → belirteç değişimi) ve
   `wrangler secret put WA_META_DOGRULAMA` (Meta kanca doğrulama belirteci).
2. `bulut/kapi/wrangler.toml` [vars]'a (gizli DEĞİL): `WA_UYGULAMA_KIMLIGI` (DestekOfis Meta App ID) ve `WA_KURULUM_KIMLIGI` (Embedded Signup config_id) → yeniden `wrangler deploy`.
3. Meta uygulama panelinde: "Allowed domains" ve "Valid OAuth redirect URIs" listesine https://kapi.destekofis.net/wa/bagla; kanca (webhook) adresi kapıcının /wa/kanca yolu,
   doğrulama belirteci = WA_META_DOGRULAMA.
O güne kadar program "Bu bağlantı DestekOfis'in Meta onayından sonra çalışır; şimdilik Elle Bağla." der; Elle Bağla tam çalışır.

## (h) Sonraki adımlar (ana oturum)

UD #1089 yeşil → PR (master) → PR CI yeşil → squash birleştirme (önceden onaylı) → master CI → T16 → kullanıcıya 5 dosya (+ parca0/parca1/BIRLESTIR.bat) + yayın bağlantısı + sürüm notu →
yayından sonra yayındaki dosyalar bayt bayt + eski güncelleyiciler "available" → site PR'ı (ceougur/destekofis web/indir/DestekOfis-Kullanim-Kilavuzu.pdf = 52d9ba92…) → CLAUDE.md kısaltma.
