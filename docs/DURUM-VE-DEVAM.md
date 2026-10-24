# DestekOfis — durum ve devam notu

## DEVİR NOTU (21.10.2026) — YENİ OTURUM BURADAN BAŞLAR
Önceki oturum: 2.4.3 YAYIMLANDI (v2.4.3, master 163dd5d, PR ceougur/ofis---y-netimi#33; site kılavuzu ceougur/destekofis#19). Kod o günden beri DEĞİŞMEDİ;
yalnız belge eklendi. Aşağıdaki sırayla oku, sonra işe başla.

### 000. 2.4.5 BAŞLANGIÇ — DEVAM NOTU (24.10.2026 ~16:30 UTC; kullanıcının sıkıştırma talimatından ÖNCE yazıldı — ÖNCE BUNU OKU)
- DURUM: 2.4.4 YAYIMLANDI ve KAPANDI (v2.4.4 = master 5187561; PR #34; master CI #867 + Sürüm yayımla #37 yeşil; 5 dosya bayt bayt; eski güncelleyiciler "available"; site
  ceougur/destekofis#20 birleşti). Ayrıntı CLAUDE.md Açık iş "2.4.4 YAYIMLANDI". Kod değişikliği YOK; çalışma dalı `claude/youthful-euler-fl8ks4` = master + yalnız belge commit'leri
  (PR birleştiği için dal master'dan yeniden başlatıldı — merged PR kuralı; bundan sonraki PR yeni PR'dır).
- BEKLENEN: kullanıcı "başla" der (yeni müşteri kurulumu sonrası, akşam). O zamana dek kod yazılmaz.
- "BAŞLA"DA İLK ADIMLAR (sırayla):
  1. `docs/erp/2.4.5-IS-LISTESI.md` → `docs/2.4.5-IS-LISTESI.md` taşı + BELGE_YOLLARI'na ekle (madde 0a: tools/kanit.mjs + ci.yml paths-ignore + test/kanit-araci.test.mjs; eski araçta kırmızı).
  2. 30 dk rapor işi (CronCreate; RAPOR DÜZENİ arşivde 24.10) + iş listesi çizme düzeni.
  3. DALGA 0: 0b kâhin önce [XH] (kodu görmeyen ajan). DALGA 1: 6a pil kartı [XH] · 6b tablo kimlik sütunu [M] · 6c tabela adı [H] · 6d ayrıntılı ekstre [H] · kapi-para (1+2+3) [XH] ·
     kapi-uyari (4+5) [XH] · cari-vade (6) [XH] (dues.mjs çakışması: kapi-uyari önce). Her iş ayrı worktree /home/user/wt/<ad>, dal is/<ad>. Sonra madde 8 (kılavuz/sürüm notu), 9 (doğrulama).
  4. Açık soru S1 (FIFO; öneri evet) — yanıt yoksa öneri.
- 2.4.5 KAPSAMI (tek yer: iş listesi): kapı kapatma (1)–(4), Tablodaki Kişiler/Projeksiyon etiketi (5), cari borç Vade + Beklenen Ödeme Tarihi (6), 6a fatura/banka pili (kullanıcı bulgusu:
  Kayda Git "bulunamadı", Ödendi Say 400, Tahsilat Gir SEÇİLİ kaydın carisine form = PARA RİSKİ; kullanıcı uyarıldı), 6b "Borçlu Telefon" 5.367.715.055,00 (2.4.3 A18 gerilemesi; tablodan WhatsApp
  açılmıyor), 6c Tabela Adı (müşteri M1; seçenek: yalnız tabela / tabela + firma bilgileri; rapor + ekstre PDF/Excel), 6d Ayrıntılı Cari Ekstre (müşteri M2; fatura kalemleri + ödemeler + genel toplam),
  madde 7 isteğe bağlı. Tahmin ~3,5–4,5 takvim günü.
- SONRAKİ SÜRÜM: duşakabin MALİYET HESAP KARTI (müşteri M3; kapsam ve "Excel'deki gibi aynen" kararı CLAUDE.md Açık iş MÜŞTERİ İSTEKLERİ). Excel analizi yalnız not defterinde
  (`<nd>/dusakabin-analiz/RAPOR.md`, kahin-ciftleri.json; MÜŞTERİ VERİSİ — depoya girmez; kapsayıcı yenilenirse uploads'taki şifreli dosyadan yeniden üretilir, şifreyi kullanıcı verir). Ses kaydı
  dökülemedi (huggingface.co ağ izni yok) — kullanıcı izin verirse ya da metni yapıştırırsa.
- SONRA: DEVİR 2.5.0 Aralık'ta (en geç 1 Aralık başla, ~20 Aralık yayın); hatırlatıcı trig_01DE8bFDurzMRT6thbptBrQM 23.11.2026 09:00 TR.
- KAPSAYICI: Wine 9.0 + mingw windres kurulu; depo derin (unshallow); imza anahtarı uploads'ta; EDM test parolası bağlamda YOK (gerekirse kullanıcıdan dosya olarak istenir).
- BEKLEYEN YAMA YOK (7bf3691 uygulandı). Not defterinde 2.4.4 teslim klasörü `<nd>/teslim-2.4.4/` (yayındakiyle aynı; silinebilir).

### 00. 2.4.4 SÜRÜYOR — DEVAM NOTU (22.10.2026 14:40 UTC; kullanıcının /compact talimatından ÖNCE yazıldı — ÖNCE BUNU OKU)
- KAYNAKLAR: durum tablosu `docs/2.4.4-IS-LISTESI.md` (biten üstü çizili + "Teslim notları": her maddenin sınırı, KÂHİN KURALI, koşu sonuçları); kararlar ve kullanıcı
  soruları CLAUDE.md Açık iş (22.10 satırları; YANIT BEKLEYEN SORU YOK). Ajan kimlikleri ve görevleri: <not defteri>/devam-ajanlar.md. Not defteri:
  /tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad (ajan-ortak.md = ajan kuralları; aday-kos.sh / aday-kos-devam.sh = aday kapısı). Ders 19 notu:
  Bash aracında `set -e` ETKİSİZ → `&&` / `|| exit 1`. Ders 38 YENİ (kırmızının nedeni iletiden okunur).
- ÇALIŞMA DÜZENİ: iş grubu = /home/user/wt/<ad> worktree (dal is/<ad>); ajan commit eder; ana oturum BİRLEŞTİRME ADAYINDA (/home/user/wt/aday<n>, dal aday<n>) `--no-ff`
  birleştirir → kapı `<not defteri>/aday-kos.sh <worktree> <etiket>` (tam npm test, geçmezse durur; sonra ci.yml'nin 64 e2e'si flock ile; arka plan görevi 2 sa'te kesilir →
  `<not defteri>/aday-kos-devam.sh <worktree> <etiket>` kanıtı olmayanları sürdürür, GEÇTİ'yi atlar, BAŞARISIZ'ı yeniden koşmaz; bilinen nedenli kırmızının kanıtı
  "-kirmizi-<neden>" diye yeniden adlandırılıp düzeltmeden sonra yeniden koşulur) → kanıt commit (aday dalında) → çalışma dalına `git merge --no-ff aday<n>` + push +
  `node tools/kanit.mjs ci <sha> --bekle 120` (arka planda). Kâhin adımları (kahin-defter/cari/tutar/ebelge-model/mutasyon/senaryo) kapı betiğinde YOK → adayda elle kanit kos.
- ÇALIŞMA DALI (claude/youthful-euler-fl8ks4) kod durumu: aday 4 = 2fb1d33 (CI #859 BÜTÜN İŞLER YEŞİL); aday 5 = 0c1ae0d (kapı npm test 3132/3132 + 64/64 e2e + 6 kâhin
  yeşil) → CI #860 BÜTÜN İŞLER YEŞİL (22.10 ~15:35 UTC okundu; madde 24 çizildi). #860 YEŞİLSE iş listesinde 24 (gerçek EDM uçtan uca: gercek-5 55/55 + düzeltmeler + kılavuz
  + açma) çizilir; 31a "son koşu" son adayın CI'sinde (kâhinler CI'da). KIRMIZIYSA: başarısız testin adı kısa günlükte, kök neden (ders 6/20/38).
- GÜNCEL (23.10 ~13:45 UTC; kullanıcı ikinci /compact öncesi — SIKIŞTIRMADAN SONRA ÖNCE BUNU OKU): SON ADAY = /home/user/wt/aday22 (dal aday22, e5667af; kod 49072ca) = aday 21 + Z4. Zincir aday 15 → 22 (her biri bir önceki + is/r31e-c/-d/-b/-f düzeltmeleri + is/kahin-244); ayrıntı CLAUDE.md Açık iş "ADAY 20/21/22" ve arşiv "Arşiv 23.10.2026 (2)". Aday 22: birleşim dar 56/56, cari kâhini 3701/3701, ekran gezintisi 124/124 (kanıt e5667af). SÜREN (iki ajan, aynı anda): (a) a9e1cd5e8d7dc429d — is/r31e-f (/home/user/wt/r31e-f, son e83b7ce): Z5 (taahhüt ailesi önek: "Taahhütname" söz) + Z6 ("Söz Miktarı" söz tutarı; "tutar" ya da "miktar"); kanıt docs/kanit/2026-10-23/b7-r31e/. (b) a273b1175b2d0e124 — is/kahin-244 (/home/user/wt/kahin-244, son 6bc10ff): aynı kurallar karar metninden, aday 22'de kırmızı beklenir. SIRADAKİ ADIMLAR: 1. Z5/Z6 raporu + kanıt JSON'ları (kırmızı/yeşil/mutasyon/komşu/kâhin/e2e) ana oturumca okunur (ders 16). 2. ADAY 23: `git worktree add -b aday23 /home/user/wt/aday23 aday22 && git merge --no-ff is/r31e-f && git merge --no-ff is/kahin-244` → npm ci → birleşim dar (`git diff --name-only aday22 HEAD -- 'test/*.test.mjs'`) + kâhin (`flock <nd>/kos.lock node tools/kanit.mjs kos 244-kahin/cari-aday23 -- node test/bagimsiz/cari/kos.mjs --cikti <nd>/aday23-kahin/cari`) + gezinti (`bash <nd>/ekran-g/kos.sh /home/user/wt/aday23 aday23`). 3. DAR KONTROL (DURMA KURALI: yalnız son düzeltmenin farkı + doğrudan komşular; ajan aacb5253c1e83b520, worktree /home/user/wt/r31e, `git checkout --detach aday23`). YÜKSEK/ORTA → düzelt (yeni aday); DÜŞÜK → para/veri/bağ/e-Belge/defter/yetki/gerileme değilse 2.5.0. 4. TAM KAPI: `bash <nd>/aday-kos.sh /home/user/wt/aday23 23` (tam npm test + ci.yml'nin 65 e2e'si; senaryo-kayit-bag-31e eklendi) ve `bash <nd>/cidisi-kos.sh /home/user/wt/aday23 23` (CI dışı 14); e-Belge/defter/tutar kâhinleri bir kez. 5. Kanıt aday dalına → çalışma dalına `git merge --no-ff aday23` → push → `node tools/kanit.mjs ci <sha> --bekle 120` (NOT: yalnız-belge ata araması 30 commit sınırlı, 50e3bd0'dan beri 30+ belge commit'i → BELİRSİZ; kod push'u bunu çözer) → iş listesinde 30, 30a, 31, 32 çizilir. 6. 32a windows.yml ×2 → 33 Uzun Doğrulama ∥ 34 paket → 35 teslim (iş listesi "Teslim notları" sonu: aday 15–20 eki, BİLİNEN SINIR, SONRAYA, BAŞ MİMAR KARARLARI) → 36 PR (kullanıcı "birleştir"). <nd> = /tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad. Kullanıcıya teslimde: kendi tablosuyla Yerine Koy / Devamı / eşitleme kısa elle kabulü (GG6 (6)). 30 dk rapor işi 2e260437 (oturum içi).
- ESKİ (23.10 ~06:00 UTC; kullanıcı /compact öncesi): ADAY 14 = /home/user/wt/aday14 9b0f520 (dal aday14): npm test henüz yok (aday 13
  npm test 3329/3329, fark yalnız is/r31e-ad 95ac3d1 + 31cb7a3), cari kâhini 1967/1967, göç tam takım BULGU 0 (kanıt is/goc9 240d952, /home/user/wt/goc9). SÜREN İŞ: is/r31e-c
  (/home/user/wt/r31e-c, taban aday14): 17cc5f4 C1/C2/C3 BİTTİ (kanıt docs/kanit/2026-10-23/c-*); SAYI HÜCRESİ düzeltmesi (parseAmount 3 ondalıklı sayı → 1000 kat) ajan
  a4c6a5adce2fe84a1'de sürüyor. SIRADAKİ ADIMLAR (sırasıyla; "ADAY KAPISI SON DALGADA"):
  1. is/r31e-c bitince raporu + kanıt JSON'ları (kirmizi/yesil/mutasyon/komsu) denetlenir (ders 16).
  2. ADAY 15: `git worktree add -b aday15 /home/user/wt/aday15 aday14 && git merge --no-ff is/r31e-c` (+ is/goc9 göç kanıtı) → npm ci → birleşim dar testi.
  3. Bağımsız turlar (adaydan önce): 31e ajanı aacb5253c1e83b520'e "aday 15'te yalnız C1–C3 + sayı hücresi betiklerini yeniden koş" (worktree /home/user/wt/r31e'yi aday15'e
     al); cari kâhini (`node tools/kanit.mjs kos 244-kahin/cari-aday15 -- node test/bagimsiz/cari/kos.mjs --cikti <not defteri>/aday15-kahin/cari`, flock); göç ajanı
     ae9ec21f91121d745'e kısa olcu → goc → fark (aday 15; goc9'u ff ile al).
  4. Hepsi temizse TAM KAPI: `bash <not defteri>/aday-kos.sh /home/user/wt/aday15 15` (tam npm test + ci.yml'nin 64 e2e'si) ve ardından `bash <not defteri>/cidisi-kos.sh
     /home/user/wt/aday15 15` (CI dışı 14). e-Belge/defter/tutar kâhinleri aday 13'te yeşil (e-Belge kodu o zamandan beri değişmedi; yine de son adayda bir kez koşulur).
  5. Ekran gezintisi (GG5 (5)): birden çok sekme notu (rapor + Takvim şeridi), Nakit Akışı yetkisiz Kasa notu, geri yükleme 409 iletileri, A3 iletisi — ekran görüntüsüyle
     (örnek düzen docs/kanit/2026-10-22/244-gezinti/sunucu.mjs + adim.mjs).
  6. Kanıt aday dalına commit → çalışma dalına `git merge --no-ff aday15` → push → `node tools/kanit.mjs ci <sha> --bekle 120` (ders 21) → iş listesinde 30, 30a, 31, 32 çizilir.
  7. 32a windows.yml elle ×2 (GitHub actions_run_trigger, çalışma dalı) → 33 Uzun Doğrulama ∥ 34 paket (Wine kurulumu, imza anahtarı /root/.claude/uploads/<oturum>/*imza-anahtari*.pem)
     → 35 teslim (iş listesi "Teslim notları" sonundaki "SON ADAY TURU" bölümü + DENENEN/DENENMEYEN/BİLİNEN SINIRLAR) → 36 PR (kullanıcı "birleştir" der).
  AJANLAR (SendMessage ile sürdürülür): a4c6a5adce2fe84a1 tablo/rapor (30a, T4/T1/Y1, A1, gruplama, C1–C3, sayı hücresi) · aacb5253c1e83b520 31e bağımsız dar kontrol (kod yazmaz;
  betikler <not defteri>/r31e/betik, tur3/) · ae9ec21f91121d745 göç (m30; betik <not defteri>/m30-goc/aday9/kos13.sh, taban not defterinde) · a273b1175b2d0e124 bağımsız kâhin (kodu görmez;
  is/kahin-244) · af758d0efa275c16f E6/E7/N1/G1/e-Fatura iptal · aa6d8a7ea376869f6 E1/E4/E1-Y/A3/K45. 30 dk rapor işi: CronCreate 2e260437 (oturum içi).
- ESKİ (23.10 ~05:15 UTC; kapsayıcı 05:05'te yeniden başladı — disk, worktree'ler, not defteri yerinde; arka plan görevleri kesildi, 30 dk rapor işi yeniden kuruldu
  2e260437): ADAY 14 = /home/user/wt/aday14 9b0f520 = aday 13 (f24bc41: aday 12 + is/kahin-244 0dcf7ba + is/r31e-a1 + is/r31e-a3) + is/r31e-ad 31cb7a3 (Tablodaki Kişiler
  gruplama gerilemesi, kök neden 36830cd; kuruş toplamı). Aday 12 npm test 3324/3324, aday 13 npm test 3329/3329 (ikisi de e2e'den önce durduruldu); aday 13 kâhinler e-Belge
  27/27, defter 176, tutar 3559, cari 1953/1967 → aday 14 cari 1967/1967. SÜRENLER: 31e dar kontrol (ders 32; aacb5253c1e83b520, /home/user/wt/r31e), göç tam takım aday 14'te
  (ae9ec21f91121d745, /home/user/wt/goc9; aday 13 olcu/goc/fark 100/100 kanıtı goc9'da). SIRADAKİ (Verimlilik "ADAY KAPISI SON DALGADA"): ikisi temizse aday 14 tam kapı
  (`<not defteri>/aday-kos.sh /home/user/wt/aday14 14` + `<not defteri>/cidisi-kos.sh /home/user/wt/aday14 14`) → ekran gezintisi (GG5 (5)) → çalışma dalı + CI → windows.yml ×2
  → Uzun Doğrulama ∥ paket → teslim → PR. Teslim notu adayları iş listesinin "Teslim notları" sonunda ("SON ADAY TURU").
- ESKİ (23.10 ~00:25 UTC): CI #862 (50e3bd0 = aday 7) YEŞİL. 31 bağımsız turu bitti (31b mali müşavir, 31c yargıç, 31d eleştirmen, 31f UI/UX); bulgular 5 dk
  yetkisiyle karara bağlandı (CLAUDE.md Açık iş 22.10 gecesi). ADAY 8 (/home/user/wt/aday8 54bf0e6) = bütün bulgu düzeltmeleri (is/e5, e1, u1, e67, mm-rapor, mm-smm,
  e23 + daraltma, ui-son); her dalın kırmızı/yeşil/mutasyon kanıtı ana oturumca denetlendi. KAPI SÜRÜYOR (aday-kos.sh aday8 8). Ajan kimlikleri not defteri
  devam-ajanlar.md. SÜRENLER: teslim belgeleri (is/teslim-belge), kâhin güncellemesi (is/kahin-244, kodu görmeden). SIRADAKİ: göç karşılaştırması (Y3) → 31e dar
  kontrol → aday 9 → çalışma dalı → CI → windows.yml ×2 (32a) → Uzun Doğrulama ∥ paket → teslim → PR.
- ESKİ (22.10 ~20:45 UTC): ADAY 7 KAPISI YEŞİL → çalışma dalında (ed37e78 = aday7 846365c: çalışma dalı + is/m30-e2e + is/m30-goc + is/kanit-alt + is/b2-uyari
  (+ acf156f fark testi) + is/ci861 (CI #861 düzeltmesi, test/e2e/pencere-yaris-zorla.mjs, ders 39) + is/gezinti-g (30d G1–G6) + is/b1-kalan (30a, 30e, 30f)). Kapı: tam npm test
  3178/3180 (04d7785; 2 kırmızı fatura-liste-243-fark — 30b'nin restoreNotice yanıt alanı, beklenti eski; test düzeltildi 4/4 489bfb7, ürün kodu aynı), ci.yml 64/64 e2e,
  6 kâhin (defter 147, cari 1364, tutar 3472, e-Belge modeli 82, mutasyon 36, senaryo 20) yeşil. SIRADAKİ: CI (ders 21; yeşilse 7d, 24b, 30, 30a, 30b, 30d, 30e, 30f
  çizilir) → 31b/31c/31d/31f aynı anda (not defteri inceleme-ortak.md; xhigh; kod değiştirmez) → 31e dar kontrol → 32 → 33 ∥ 34 → 35 → 36.
- ESKİ (22.10 ~17:20 UTC): ADAY 6 ÇALIŞMA DALINDA — 9f64a1f (aday6 e579b28: kapı npm test 3150/3150 + 64/64 e2e + 6 kâhin yeşil + gerçek EDM koşu 2/3 + gercek-6
  kanıtı) + 158d9c0 (gezinti kanıtı); CI bekleme arka planda (`kanit ci 158d9c0 --bekle 110`; yeşilse 24b çizilir). MADDE 30 ajanları BİTTİ (m30-e2e 51bae84, m30-goc
  b2949f2; B1/B2 kullanıcı kararı Açık iş'te). SÜRENLER: 30a (is/b1-kalan, high), 30b (is/b2-uyari, high), 30d (is/gezinti-g, medium). Araç düzeltmesi is/kanit-alt
  cf323d9. SONRAKİ: ADAY 7 = çalışma dalı + is/m30-e2e + is/m30-goc + is/kanit-alt + is/b1-kalan + is/b2-uyari + is/gezinti-g → kapı (aday-kos.sh) + kâhinler →
  çalışma dalı + CI → 31 (31b/31c/31d/31f aynı anda, ajanlar kod değiştirmez) → 31e dar kontrol (para çekirdeği + 30a) → 32 → 33 ∥ 34 → 35 → 36.
- ADAY 6 = /home/user/wt/aday6 (dal aday6) e070d42 = aday 5 (5ad1277) + is/edm-eszamanli b4f8709 (24b düzeneği tools/edm-gercek.mjs --eszamanli; N4 tek uçuş EDM girişi
  51c3074; gerçek koşu 1 kanıtı). KAPI SÜRÜYOR: `aday-kos.sh /home/user/wt/aday6 e070d42` (~14:08 UTC başladı; npm test sürüyor; 2 sa sınırında ~16:08 UTC kesilirse
  `aday-kos-devam.sh /home/user/wt/aday6 e070d42`). YEŞİLSE: aday6'da kanıt commit → `git merge --no-ff is/edm-eszamanli` (yalnız kanıt: 9c10448 gerçek koşu 2) → kâhin
  adımları elle (değişen dosya yalnız edm.mjs/araçlar; yine de koşulur) → çalışma dalına birleştir + push + CI → CI yeşilse 24b çizilir.
- 24b GERÇEK EDM (kullanıcı isteği, tamam): koşu 1 (16:41 TR) 19/20 kabul, N4 bulundu; koşu 2 (17:07 TR, düzeltmeli) 136/136, 30/30 kabul (TES2026475826020–049), Login 1;
  kullanıcı portalda gördü (ekran 17:12 TR); OZET.md kullanıcıya verildi. Test şablonunda VKN'li düzenleyen unvanı yok (UBL'de PartyName VAR — doğrulandı) → BİLİNEN SINIR.
- GERÇEK EDM KOŞU 3 — BİTTİ, YEŞİL (eşzamanlı 136/136, Login 1; tam takım gercek-6 52/52; kanıt is/gercek6 cfb4f1d → aday 6 kapısı yeşilse aday6'ya birleştir)
  (GÖZDEN GEÇİRME 3, ders 18: N4 düzeltmesinin gerçek yeşili iki koşuda görülmeli; 22.10 ~14:56 UTC başladı): /home/user/wt/edm-eszamanli,
  dal is/gercek6 (= aday 6 e070d42); arka plan görevi b093nqefl: `kanit kos 244-edm-eszamanli/gercek-3` (--eszamanli, soğuk) ve ardından `kanit kos 244-edm/gercek-6`
  (tam takım: e-Arşiv, e-SMM, iptal, bulunamadı — ders 9/10). Bitince: iki OZET.md okunur (değişmezler yf, Login sayısı, bağımsız okuyucu ye; çıkış kodları), kanıt
  is/gercek6'da commit → aday 6 kapısı yeşilse aday6'ya `git merge --no-ff is/gercek6` (yalnız kanıt) → çalışma dalı + CI → 24b çizilir. Çıkış 2 (giriş reddi) → YENİDEN
  DENENMEZ, kullanıcıya sorulur. Yeni belge numaraları kullanıcıya verilir (portalda görsün).
- MADDE 30 SÜRÜYOR (taban aday6 e070d42; ajanlar KOD DEĞİŞTİRMEZ, ürün bulgusunu raporlar): (a) CI dışı e2e — ajan a570ddc1eeb09d60d, /home/user/wt/m30-e2e (is/m30-e2e),
  13 betik (test:senaryo, -rapor, -taslak, 210–218, whatsapp) + betiksiz senaryolar; eski beklentiyi kararla düzeltir. (b) göç + yedek tatbikatı + zincirleme göç + arıza —
  ajan ae9ec21f91121d745 (xhigh), /home/user/wt/m30-goc (is/m30-goc), veri v2.4.3 gerçek koduyla. RAPOR GELİNCE: özet kanıtı denetle (ders 16), test düzeltmelerini sonraki
  adaya (aday 7 = çalışma dalı + is/m30-e2e + is/m30-goc araçları) al, ürün bulgularını yeniden üret ve karar ver. (c) ANA OTURUM: kullanıcı gözüyle günlük iş akışı (kişi →
  cari → fatura/e-Belge → tahsilat → kasa/banka → rapor, iki şirket, ekran görüntüsü) aday 6 kapısından SONRA.
- SONRA: 31 bağımsız tur (31b mali müşavir, 31c yargıç, 31d eleştirmen, 31f uzman UI/UX aynı anda; ajanlar kod değiştirmez) → bulgu düzeltmeleri + 31e dar kontrol (para
  çekirdeği: 5, 5a, 15, 17, 22, 26 + 11017, F2/F3, kâğıt numarası + v32, UBL-TR, I23, EDM tek uçuş giriş) → 32 CI → 33 Uzun Doğrulama (GitHub) ∥ 34 imzalı paket (Wine kur) →
  35 teslim (5 dosya ayrı + arşiv zip; DENENEN/DENENMEYEN/BİLİNEN SINIRLAR) → 36 PR + kullanıcı (madde 18 Windows + Edge elle kabulü, "birleştir", yayın). Sürüm notu
  cümleleri: UX18/F3 ("karşılıksız dönen evrakla ödenmiş görünen faturalar Açık görünür; cari bakiye değişmez"), e-SMM test görüntüsü canlıdan farklı olabilir (kılavuzda var).
- ZAMAN ÇİZELGESİ (kullanıcıya verildi 22.10 17:35 TR; paralel işler tek süre): F1 ~19:45 (aday 6 kapısı, aday 5 CI, madde 30 ajanları) · F2 ~21:15 (aday 6 → dal + CI ∥ iş akışı)
  · F3 ~23:15 (madde 30 düzeltmeleri + aday kapısı) · F4 ~02:15 (31 dört ajan) · F5 ~05:15 (31 düzeltmeleri + 31e + kapı + 32) · F6 ~10:15 (33 Uzun Doğrulama ∥ 34 paket) ·
  F7 ~11:30 (inceleme + 35 teslim) · F8 kullanıcı. Toplam ~18 sa (bulgusuz ~14 sa).
- MADDE 18: CI yeşil; kullanıcının Windows + Edge elle kabulü bekleniyor (adımlar iş listesinde; teslimde kurulumla). Madde 24/24b gerçek EDM: kimlik YALNIZ ortam değişkeniyle
  o komutta (EDM test hesabı sohbette — dosyaya YAZILMAZ; kaybolduysa kullanıcıdan istenir; giriş başarısızsa YENİDEN DENENMEZ).
- 30 dk RAPOR işi: CronCreate 615db56b ("7,37 * * * *"; oturum içi; kapsayıcı yeniden başlarsa yeniden kur; 2.4.4 bitince silinir).

### 0. İlk 10 dakika
1. `CLAUDE.md` — anayasa + kurallar (oturum başında kendiliğinden yüklenir). Bölüm yerleri:
   - "Proje Anayasası & Rol Dağılımı" (baş mimar sorumluluğu, kör nokta uyarısı) · "Kalite çıtası" · "Test kuralı" · "KANIT KURALI 1–5"
   - "Doğrulama kapısı" (CI kapısı, YALNIZ BELGE yolları — CLAUDE.md, docs/DURUM-VE-DEVAM.md, docs/devir/** push'u CI başlatmaz)
   - "Geçmiş test hatalarından dersler" 1–36 (yasak listesi; teslimde DENENEN/DENENMEYEN hangi maddelerin uygulandığını söyler)
     Bu işlerde en sık gerekenler: 5 (kâhin bağımsız), 7 (eski kodda kırmızı), 13/22 (sahte saat, gece yarısı), 16 (ajan onayı kanıt değil),
     17 (eski sürüm verisi), 18 (Windows gerçek koşu), 20 (ara sıra kırmızı zorla üret), 21 (her push'un CI'si), 23 (eski kod ayrı kopyada),
     24 (disk), 26 (belgeyi tek tek gönderme), 28 (beklentisi değişen e2e koşulur), 30 (test gerçek lisans servisine ulaşmaz), 32 (para çekirdeği → dar kontrol),
     35 (paket tam testi bitmeden birleşmez), 36 (pkill yok).
   - "Verimlilik" (gereken kadar koş; uzun koşular yalnız son adayda, GitHub'da) · "Dil" (her şey Türkçe) · "Yazım düzeni" · "Güvenlik ve süreç"
     (commit satırları, model adı yasak) · "Sürüm teslim düzeni" (5 dosya + arşiv) · "Standart / Pro" · "Kalıcı ürün kararları"
   - "Açık iş" — bütün açık maddeler ve kullanıcı kararları (en sondaki maddeler en günceldir).
2. DAL DURUMU (21.10.2026 akşam): bütün güncel belgeler `claude/youthful-euler-fl8ks4` dalında (master'da yok): CLAUDE.md, bu not, docs/devir/**, docs/erp/**,
   docs/2.4.4-IS-LISTESI.md + araç değişikliği 51cc9d1 (BELGE_YOLLARI; CI #848 yeşil). Eski `claude/hopeful-goodall-6nmtcj` dalı ESKİ — oradan belge ALINMAZ
   (yenilerini ezer). Yeni oturum başka daldaysa `git fetch origin claude/youthful-euler-fl8ks4` ve o daldan devam. Ürün kodu master 163dd5d ile aynı:
   `git diff --stat origin/master origin/claude/youthful-euler-fl8ks4` yalnız belgeler + tools/kanit.mjs, .github/workflows/ci.yml, test/kanit-araci.test.mjs,
   docs/kanit/2026-10-21 göstermeli (21.10 akşam: 14 dosya); başka bir şey görürsen dur, kullanıcıya sor.
3. Kullanım sınırı: 02:00 kısıtı KALKTI (kullanıcı, 21.10.2026: "ben başla dediğimde limit sıfırlanmış demektir"). 2.4.4 kullanıcı "başla" deyince başlar.
4. Kullanıcıdan istenecek dosyalar (sohbete yapıştırılmaz, oturuma YÜKLENİR; hiçbir dosyaya/zip'e/depoya girmez):
   imza anahtarı `*imza-anahtari*.pem` (paket için), EDM test hesabı bilgi dosyası (gerçek EDM denemeleri için).
   DURUM (21.10.2026): imza anahtarı (destekofis-2026-1 ile eşleştiği denetlendi) ve e-SMM belgeleri oturuma YÜKLENDİ; EDM test hesabı sohbette verildi
   (dosyaya yazılmaz). Kapsayıcı yenilenirse uploads ve not defteri gidebilir → kullanıcıdan yeniden istenir.

### 1. SIRADAKİ İŞ: 2.4.4 (kapsam = CLAUDE.md "Açık iş"; tek yerde özet)
TAM VE GÜNCEL LİSTE: `docs/2.4.4-IS-LISTESI.md` (36 madde; efor sınıfı [M]/[H]/[XH]; 25–29 onaylı ek bulgular; 30 dk rapor düzeni). Aşağıdaki tablo özettir.
| # | Madde | Kaynak (ayrıntı) |
|---|---|---|
| 1 | e-SMM (EDM ESmmEDM bağdaştırıcısı, GİB e-SMM XML'i, numara/kopma/iptal kuralları + dar kontrol, test ortamı uçtan uca + kılavuz + açma) | CLAUDE.md "e-SMM YANITI" + "BELGE OKUNDU" (uç noktalar, WSDL işlemleri); programda hazır olanlar aynı maddede; `config.esmmEnabled` |
| 2 | 2.4.3'ten ertelenenler: UI11, UI5, UI9 (fatura), UI3a, UX9, UX10 (fatura), UX15–UX18, UX20, UX25, UX27, KÖ3 "Başlarken" | `docs/kanit/2026-10-18/uiux-a-243/uzman-ui-BULGULAR.md`, `.../uzman-ux-BULGULAR.md`; `docs/2.4.3-IS-LISTESI.md` madde 67f; `docs/2.4.3-DEGISIKLIKLER.md` (BİLİNEN SINIRLAR) |
| 3 | gg243-dar-kontrol-gonderim D2 ön koşulunu belirlenimci yap (ders 20) | CLAUDE.md "SON ADAY (19.10.2026)" SONUÇ satırı (CI #842) |
| 4 | İptal süresi (KARAR 21.10, GİB kılavuzundan): e-Arşiv ve e-SMM 8 gün, İLETİM tarihinden (8. gün dahil); program bugün kesim tarihinden sayıyor → düzeltilir; kâhin K22 ayrı elden | CLAUDE.md "KARARLAR (21.10)" (5) |
| 5 | Entegratör kullanıcı adında http/https/.svc → kaydetmeden uyarı + kırpma; "kayıtlı parola gösterilmez" netliği | CLAUDE.md "KULLANICI SORUNU (19.10.2026)" |
| 6 | Müşteri isteği 1: "Seçilenleri Gönder" (kronoloji kuralı, Tümünü Gönder ile aynı sunucu yolu; para-numara çekirdeği → kırmızı test + dar kontrol) | CLAUDE.md "MÜŞTERİ İSTEKLERİ → 2.4.4" (1) |
| 7 | Müşteri isteği 2: "E-Fatura Portal" düğmesi — ortama göre (Test: https://test.edmbilisim.com.tr/EFaturaUI21ea/, Canlı: https://portal4.edmbilisim.com.tr/EFaturaUI/); başlatıcı ayrı tam ekran KALICI profilli Edge penceresi; Beni Hatırla; Turnstile aşılmaz; gerçek Windows'ta denenir | aynı madde (2) + EK + NETLEŞTİRME + CANLI ADRES |
| 8 | Müşteri isteği 3: kayıt detay kartındaki "Tahsilat" düğmesini CSS ile gizle; 3 e2e tahsilatı API'den girer; "düğme görünmez" testi eski kodda kırmızı | aynı madde (3) |
| 9 | Test izolasyonu kaçağı: Operatör Merkezi'nde yayımlanmamış "2.4.5" Azure kaydı 19.10'a kadar görüldü → hangi test/iş akışı gerçek lisans servisine ulaşıyor, bul ve kapat (ders 30) | CLAUDE.md "SORU (… demo olarak kaç kişi …)" |
| 10 | Personel Özlük (yeni modül): Personel Raporu penceresinde Çalışanlar/Ayrılanlar sekmeleri, arama, yalnız Personel Özeti kartı; ayrılış tarihi yazılınca Ayrılanlar'a; Doğum Tarihi → Yaş; Kullanılan İzinler (gün); iki yetki (görüntüle/düzenle), varsayılan yalnız yönetici; geçmişe değer yazılmaz (KVKK) | CLAUDE.md "İSTEK → 2.4.4 (… Personel Raporu …)" + KARAR + EK |
| 11 | Kayıttan taksit KALKAR; zil ve Ödeme Sözü şeridindeki "Tahsil Et" Cari'ye gider (bağlı cari yoksa "önce cari açın" + dolu "+ Yeni Cari"); Tablodan Aktar kalır | CLAUDE.md "KARARLAR (21.10)" (4) |
| 12 | Kararlar (21.10): UI11 adlandırma, UX18 (çek/senet bu faturayı kapatır + carideki Kapatılacak Fatura korunur), Portal Yol A (ayrı pencere), EDM teyidi gerekmez | CLAUDE.md "KARARLAR (21.10)" (1)–(6) |
KODDAN HARİTA (21.10.2026; 9 okuyucu, salt okuma). AYRINTILI HARİTALAR bu dosyanın SONUNDA: "EK — 2.4.4 KOD HARİTALARI" (EK-0 yapılandırılmış özet, EK-1…EK-9
alan haritaları, EK-10 E9 tarama yardımcıları). Bütünü okunmaz; gereken alan başlığıyla aranır (grep -n "^### EK-").
Kilit bulgular (her biri dosya:satır ile doğrulanacak, uygulamada kırmızı test önce):
- E1: e-SMM'yi yalnız bayrak açmaz — INVOICE_KINDS.smm.send=false (invoice-math.mjs:40) 11 gönderim kapısını kapatıyor (invoices.mjs:654, 992–1000, 1197,
  1842, 1846, 2308, 3258, 3979) → tek yardımcı sendKind(kind, profile); üretim girişi server/server.mjs:8'e esmmEnabled; edm.mjs yalnız EFaturaEDM.svc, ad alanı
  sabiti i2i (gerçek WSDL tempuri.org); e-SMM'de SMM ID/UUID ÇOCUK öğe (e-Fatura'da nitelik; shape nitelik denetlemez); ensureSession argümansız (:3272, :3438)
  → e-SMM'de yanlış servise bakar; ESmmEDM WSDL'i depoda yok (alınıp sha256'lı saklanır); defter kaydı türe bağlı, e-SMM = kâğıt SMM (para çekirdeği değişmez);
  stopaj programda belge düzeyinde, EDM/GİB satır düzeyinde → çok kalemde 1 kuruş ayrışma riski; canlı e-SMM adresi teyitsiz → ayrı canlı kilidi önerisi.
- E3: D2 ürün hatası değil; test ürünün iki doğru yolundan (einvoice-sending→done / already-sent→done) yalnız birini ön koşul sayıyor; 100 ms yoklama yarışı.
- E4: 8 gün kuralını sınayan test YOK; kâhin K22 (≤7) ile ağ-yok dalı (≤8) kendi içinde tutarsız; localOnly iptal yolu API'de 8 günü atlıyor.
- E5: kullanıcı adı kırpma ve "kayıtlı parola gösterilmez" metni ZATEN var; eksik yalnız URL denetimi (değişmeyen eski kayıt ilgisiz ayarları kilitlememeli).
- E6: {ids} yolu var ama parçasız/bütçesiz, eski bekleyeni gönderimden SONRA söylüyor → {all, only, after} + ön denetim (check) önerisi; kâhin koşucusu {ids}'e bağlı.
- E7: başlatıcı kısa ömürlü, yerel ucu/protokolü yok, güncelleme paketine GİRMEZ (yalnız Kurulum.exe) → Yol A window.open (kurulum değişmez; DestekOfis zaten
  varsayılan kalıcı Edge profilinde) önerisi; Yol B (destekofis:// + ayrı profil) her PC'de yönetici kurulumu ister.
- E8: yalnız CSS ile kaybolanlar: "Taksit planı oluşturun" kısa yolu, cariye bağlı kayıtta karttan cari tahsilatı (2.4.3 A2); boş geçmiş metni JS'te (hof-workspace
  .js:1178); izin açıklaması/rapor adı/kılavuz eskir; 6 e2e adımı. EK BULGU: zil/ödeme sözü şeridinden tahsilat taksit/cari yönlendirmesini atlıyor (DOĞRULANMADI).
- E9 KÖK NEDEN (koddan; Operatör Merkezi ile eşleme DOĞRULANMADI): .github/workflows/windows.yml install-test gerçek paketi Windows SERVİSİ olarak kuruyor; servis
  ortamı nssm AppEnvironmentExtra'dan (servis-kur.cmd:58) → HUKUK_LICENSE_URL yok; windows-kurulum.mjs:123–127 kurulu 2.4.3 + 2 = 2.4.5'i W3'te çalıştırıyor. İş her
  master push'unda ve yayında koşuyor → düzeltme (hosts engeli + lisans nöbetçisi + taramanın .github/tools'a genişlemesi) 2.4.4 PR'ının İÇİNDE olmalı.
- E2: UI9 Anlık Durum, UI3b PDF ve Çek çift başlık 2.4.3'te yapılmış; kalan fatura kısımları. UI11 "her yerde tek ad PDF" 2.0.16 müşteri kararıyla ÇELİŞİYOR
  (düğme ne indirdiğini söyler) → karar kullanıcıda. UX18: A (yalnız istemci, FIFO) / B (faturaya bağlı, para çekirdeği + dar kontrol) → karar kullanıcıda.
- Ek bulgular (2.4.4 adayı, karar kullanıcıda): salt okunur lisansta tax.manage WRITE_PERMISSIONS'ta yok (license.mjs:46–53); Netten Brüte kişi alıcıda %20
  stopaj varsayıp brütü fazla yazıyor (hof-invoices.js:2081); cari "+ Tahsilat" Çek/Senet yolunda seçili Kapatılacak Fatura sessizce düşüyor (hof-accounts.js:982);
  defter kâhini hiçbir CI/Uzun Doğrulama işinde değil; vekil sunucu parolası ag-ayari.json'da açık metin; 002 ekranına yetki/lisans olayları canlı ulaşmıyor
  (DOĞRULANMADI); yerel depo sığ + 0 etiket → yerel npm test eski sürüm testlerini atlar (CI eşdeğeri değil).
YAPILMAYACAKLAR (kullanıcı kararı): kontörlü "Tüm Bilgileri Getir"; e-Fatura/e-Arşiv kutu metinlerinin değişmesi (geri bildirim gelirse); WhatsApp paylaşımı (bekler).
Akış ve teslim: CLAUDE.md "Sürüm teslim düzeni" + `docs/SURUM-YAYIMLAMA.md` + 2.4.3 örneği (`docs/2.4.3-KANIT.md`, `docs/2.4.3-IS-LISTESI.md`).
Önerilen sıra: iş listesi `docs/2.4.4-IS-LISTESI.md` (21.10 açıldı; 30 dk rapor düzeni orada; tek başına gönderilir, CI koşmaz) → küçük maddeler (5, 8, 9) → 2.4.3 ertelenenleri → Seçilenleri Gönder →
e-SMM → Portal düğmesi (Windows elle kabul) → tam npm test + bütün e2e → bağımsız gözden geçirme + dar kontrol → CI → Uzun Doğrulama → gerçek EDM → paket → teslim → PR.

### 2. SONRA: DEVİR MODÜLÜ (sürüm 2.5.0)
TEK BAŞINA YETERLİ PLAN: `docs/devir/DEVIR-PLANI.md` (§0 kararlar, §2 mimari "yerinde budama + arşiv kopyası", §3 modül modül kesim tablosu, §4 açılışlar +
kapanış/açılış fişi, §5 ön denetim, §6 Geri Al, §7 teknik ayrıntılar dosya:satır, §8 Nasıl Bozulur, §9 test/kanıt, §10 aşamalar D0–D6, §11 VERİLMİŞ kararlar).
Arka plan: `docs/devir/DEVIR-MODULU.md` (Wolvox ekranları, §10 arkadaşın yanıtı). İlk adım D0: planı 2.4.4 sonrası koda karşı yeniden doğrula.
Hatırlatıcı: eski 22.10 (trig_01NEGfcTp7hAnHG1tgw6mFAv) KAPATILDI (21.10.2026); yenisi 29.10.2026 09:00 TR (trig_01DE8bFDurzMRT6thbptBrQM). Karar zaten verildi (Wolvox yöntemi).
D0 ÖN BİLGİ (21.10 okuması): plan §7 kaymış referanslar — money-lines summary :739 → :505, period setLock :68 → :70, company-separate VACUUM INTO :36 → :57,
assertChronology :1675 → :1678. KÖR NOKTA: cheque_events.kind CHECK kısıtlı (migrations.mjs:731) → "devir olay türü" yalnız ekleyici göçle eklenemez; D0'da yeni kolon / yeni tablo / işaretli receive-issue seçilir (account_entries.kind :604 ve invoices.kind :926 de CHECK'li).

### 3. KALAN / BEKLEYEN (karar ya da dış bilgi bekliyor)
- FİYAT kararı (güncelleme/destek süresi, WhatsApp/uzaktan bağlanma giderleri) — CLAUDE.md "FİYAT".
- ERP YOL HARİTASI (kullanıcı, 21.10.2026; 2.5.0'dan sonra, adım adım): `docs/erp/ERP-YOL-HARITASI.md` — yalnız plan; kararlar belgede.
- Döviz (§3.12, fxEnabled kapalı), WhatsApp paylaşımı (emlakçı), Meta WhatsApp API (Pro), 2.1.0 kapsam ölçümü, ölçek-30/1M planlı testi — CLAUDE.md "Açık iş".
- EDM'ye sorulacak: canlıda portal girişi = web servis kullanıcısı mı (testte aynı).
- Ticari öneri (kullanıcıya iletildi, karar yok): demolar iletişim bırakmıyor (5 aktif demonun hiçbirinde ofis adı yok) → deneme içinde "iletişim bilgisi bırakın".

### 4. Araçlar ve erişim (koddan)
- Kanıt: `node tools/kanit.mjs kos <ad> -- <komut>`, `node tools/kanit.mjs ci <sha> --bekle <dk>`; CI günlüğü `mcp__github__get_job_logs`.
- Operatör Merkezi verisi: Supabase projesi `lvzaeekyovhquljzesye`, şema `lisans` (installations, licenses, license_bindings, events…) — YALNIZ OKUMA; kayıtlar silinmez.
- GİB mevzuatı: ebelge.gib.gov.tr bu ortamdan erişilebilir (509 tebliğ PDF); mevzuat.gov.tr / gib.gov.tr erişilemiyor.
- Paket: `node tools/release.mjs --anahtar <yüklenen pem>`, `npm run build:windows` (yeni kapsayıcıda Wine kurulumu CLAUDE.md "Sürüm teslim düzeni").

---


Yeni bir oturum bu belgeyi okuyarak kaldığı yerden devam eder. Son güncelleme: 02.10.2026 (2.0.16 hazırlanıyor — müşteri bildirimleri, bkz. Kalanlar; 2.0.15 yayımlandı — PR #15, `v2.0.15` = 85171ae: Fatura modülü, e-Belge altyapısı kapalı, kılavuzda Fatura; önceki: 2.0.14 yayımlandı — PR #14, `v2.0.14`: odak, Cari Kartı, WhatsApp Otomatik Sıra, damga düzeltmesi; 2.0.13 yayımlandı — PR #13, `v2.0.13`: WhatsApp toplu ekstre/mesaj, ödeme yolu, Ana Defter ve mutabakat kapısı, tarih/dönem kilidi/eksi bakiye kuralları; önceki: 2.0.12 hazırlandı: taksit kartının Kayıt Tarihi carinin tarihinden gelir, form düzeni; önceki: 2.0.11 yayımlandı — PR #11, `v2.0.11`, beş dosya bayt bayt doğrulandı: 8 düzeltme — Taksitler'den cari seçip toplu taksitlendirme, grup süzgecinde cari sayısı, Veri Sağlığı'nda Yok Say, başlıklarda her sözcüğün baş harfi büyük, stok birimleri tek yazım, açık pencereler canlı yenilenir, Ayarlar kullanıcı kartının altında, arama kutusu her yerinden yazar; önceki: 2.0.10 yayımlandı: 17 düzeltme — ayrıntılı yetkiler ve özel roller, kullanıcı silme/ad düzeltme, yönetici parolası kurtarma, "+ Sayfa"ya Excel/Sheets, anlık çek yenilemesi, Borçlu/Alacaklı dili ve renkleri, tek arama kutusu ; 2.0.9 yayımlı; önceki not: sürüm 2.0.2 denetimden geçti — `docs/DENETIM-2.0.2.md`; okuma motoru, analiz iş parçacığı, kanıtlı kolon kararları, kendi kendini onarma, şemaya esnek kolon eşleme, Veri Sağlık Kontrolü ve olay tabanlı uyarılar eklendi — `docs/MIMARI.md` → *2.0.2 eklemeleri*; yayın kullanıcı onayı bekliyor; 2.0.1 yayımlı).

## Nerede ne var

| Parça | Yer |
| --- | --- |
| Program (sunucu + arayüz + kurulum) | `ceougur/ofis---y-netimi`, dal `master` |
| Tanıtım sitesi, lisans API'si, operatör merkezi | `ceougur/destekofis` (`web/`), Vercel projesi `destek-ofis`, adres `https://destek-ofis.vercel.app` |
| Lisans veritabanı | Supabase projesi `lvzaeekyovhquljzesye` (eu-central-1), özel `lisans` şeması; şema `destekofis/supabase/lisans.sql` |
| Lisans servisi adresi (programda sabit) | `https://destek-ofis.vercel.app/api/lisans` (`server/lib/license.mjs`, `DEFAULT_LICENSE_SERVICES`) |
| Lisans ayrıntıları | `docs/LISANS.md` |
| Sürüm yayımlama | `docs/SURUM-YAYIMLAMA.md` |
| 2.0.2 denetim raporu (istek doğrulama, zor veri, kod taraması) | `docs/DENETIM-2.0.2.md` |
| İleriye dönük yol haritası (yaygın programlardan öğrenilenler, UI/UX bulguları, P1–P3 mimari adımlar) | `docs/YOL-HARITASI-2.1.md` |
| Operatör merkezi ve API işletimi, sır yenileme | `destekofis/README.md` |

## Tamamlananlar

- Faz 0–2 ve 1.4–1.7 ara sürümleri (bkz. `CHANGELOG.md`).
- **Faz 3 — lisans motoru (2.0.0):**
  - Tek kurulum dosyası; kurulumdan sonra 30 günlük deneme kendiliğinden başlar.
  - Denemenin 3. gününde firma bilgisi sorulur.
  - Süre dolunca veya lisans engellenince program salt okunur olur.
  - Lisanslar imzalıdır (Ed25519). İnternet 7 gün kesik kalabilir; saat geri alma koruması var.
  - İnternetsiz `DOLIS1.` kodu var.
  - 2.0 öncesi kurulumlara 30 günlük geçiş dönemi tanınır.
- **Faz 4 çekirdeği (canlı):**
  - Vercel lisans API'si (`/api/lisans/v1/activate|check|durum`).
  - Supabase şeması ve RPC'ler.
  - Operatör merkezi `/admin` (Özet, Kullananlar, Lisanslar, Hareketler, Ayarlar).
  - Site yalnızca demoyu anlatır; demo ve kullanım kılavuzu indirme, KVKK sayfası, iletişim bilgileri var.
- v2.0.0 GitHub'da yayımlı ("Latest"). Sitedeki demo düğmesi `releases/latest/download/DestekOfis-Kurulum.exe` adresine gider. Kullanıcı imzalı güncelleme paketini (`destekofis-guncelleme.json` + zip, anahtar `destekofis-2026-1`) v2.0.0 yayınına ekledi; imza ve içerik doğrulandı. 1.6/1.7 kurulumlar artık 2.0.0'a kendiliğinden güncellenir.
- **2.0.1 (hazır, dal `claude/nice-euler-jvajxv`):**
  - Veri oturumları: farklı konudaki Excel/Sheet yeni oturumda açılır; kişiye özel oturum seçici; ad değiştirme, silme. Kullanıcılar, görevler, notlar, tahsilatlar ve Kasa oturumdan bağımsızdır (`docs/MIMARI.md` → *Veri oturumları*).
  - Excel/Sheets formülleri programda çalışır (`server/lib/formula/`).
  - Tahsilat düzeltme/silme, Kasa (göç 5), işlem geçmişi eskiden yeniye, Türkçe tutar okuma.
  - Operasyon Merkezi adları kalemle değişir.
  - Serbest sayfalar: sekme şeridinde "+ Sayfa", Excel benzeri ızgara, Türkçe formüller, Σ toplamlar, doldurma, yapıştırma, geri alma; satırlar kayıt olarak detay kartında çalışır (`docs/MIMARI.md` → *Serbest sayfalar*).
  - Tahsilat takvimi: her Excel/Sheets'te ödeme sözü, taksit, ay yazımı, aylık ücret kolonu ve kira günü okunur; kayan piller, pilden tahsilat, ödendi say; sağ alt bildirimler (10 sn, sırayla, 3 saatte bir yinelenir) ve zil listesi; son günler ve belge bitişleri 1 hafta önceden; okul servisi sektörü (143 sektör) (`docs/MIMARI.md` → *Tahsilat takvimi*).
  - Kasa: tarih aralığı ve kasa dökümü PDF'i (bağımlılıksız PDF yazıcı, gömülü Liberation Sans).
  - Kayda belge ekleme, Excel'e aktarma, kolon başlıklarını adlandırma, akıllı denetim (`docs/MIMARI.md` → *Belgeler*, *Akıllı denetim*).
  - Notlar ve belgeler kayıt kimliğine bağlıdır; aynı kimliği taşıyan kayıt farklı oturumlarda aynı notları ve belgeleri görür.
  - Kurulum düzeltmesi: sunucunun üstüne yeniden kurulumda servis yeniden kurulur ve başlar (`setup.iss`, `ExistingServerInstall`).
  - `release.yml`: web arayüzünden açılan yayına da imzalı paket, `DestekOfis-Kurulum.exe` ve kılavuz eklenir (`DESTEKOFIS_RELEASE_KEY` sırrı gerekli).
  - Sitede indirme kartı ve 2.0.1 yenilikleri: serbest sayfalar, Kasa, formüller, akıllı denetim, belgeler, Excel'e aktarma, oturumlar; kılavuz 2.0.1 (`destekofis` deposu, yerel commit `a4f6bab`; gönderilmedi).
  - Doğrulama (27.09.2026, tahsilat takvimi ve Kasa PDF eklendikten sonra yeniden): birim 333/333 ve uçtan uca 42/42 (Node 22.22 ve kurulumdaki Node 24.21), 2.0.0 → 2.0.1 ve 1.7.0 → 2.0.1 gerçek imzalı paketle güncelleme provası (yedek, şema 4 → 5, veriler korunur, yeni özellikler çalışır).
  - Teslim paketi kullanıcıya verildi: imzalı güncelleme paketi + `.json`, `DestekOfis-Kurulum.exe`, kılavuz, kaynak kodu (git bundle), örnek veriler. Yayın kullanıcı onayı bekliyor.

- **2.0.1 yayımlandı** (kullanıcı PR'ı `master`'a birleştirdi, `v2.0.1` yayını dört dosyayla açıldı; özetler doğrulandı).
- **2.0.2 yayımlandı** (PR ceougur/ofis---y-netimi#2 birleşti, `v2.0.2` yayını beş dosyayla; dosyalar indirilip yereldeki derlemeyle bayt bayt doğrulandı).
- **2.0.3 yayımlandı** (PR ceougur/ofis---y-netimi#3, `v2.0.3`).
- **2.0.4 yayımlandı** (PR ceougur/ofis---y-netimi#4, `v2.0.4`; dosyalar bayt bayt doğrulandı).
- **2.0.5 (yayında):** geniş taksit kartı, kart ve liste PDF/Yazdır, süzgeçler; Excel Sıra No (göç 8) ve esnek başlık eşleme; acil görev kırmızı uyarı. Ayrıntı `CHANGELOG.md`.
- **2.0.11 yayımlandı** (PR ceougur/ofis---y-netimi#11, `v2.0.11`; beş dosya ve latest/DestekOfis-Kurulum.exe bayt bayt doğrulandı): "2.0.11 düzeltmeleri" listesinin 8 maddesinin tamamı (aşağıda, Kalanlar'da maddeler ve kararlar duruyor). Yeni parçalar: `HOF.onLedger` / `ledger:changed` (açık pencerelerin tek yenileme kanalı), `server/lib/text-case.mjs` + `HOF.titleCase` (yazım düzeni; CLAUDE.md → *Yazım düzeni*), `server/lib/units.mjs` + göç 16, toplu taksit `dryRun` ve `plan` süzgeci, `hof-plans.js pickAccounts`, Veri Sağlığı kararları (`insight.quality.ignored`, ofis geneli). Kılavuz sadeleşti (sürüm/altyapı notu yok; CLAUDE.md → *Kullanım kılavuzu*), 22 ekran görüntüsü yeniden çekildi (`node docs/kilavuz/ekran-cek.mjs`: uydurma örnek verilerle — `docs/kilavuz/ornek/` — sıfırdan; sonra `pdf-uret.mjs`). Doğrulama: birim 662, e2e 50 adım, `npm run test:senaryo-211` 57 denetim, senaryo 44, senaryo-rapor 82, senaryo-taslak 30, senaryo-210 57; güncelleme provası gerçek imzalı paketle 2.0.10 / 2.0.9 / 2.0.4 / 1.7.0 → 2.0.11: 102 / 104 / 104 / 94 denetim (şema → 16, eski birimler tek yazımda). Teslim: `DestekOfis-2.0.11-{1-Guncelleme-ve-Belgeler,2-Kurulum,Kaynak-ve-Denetim}.zip` + SHA256SUMS (paket sha256 16a97a54…, kurulum 214ca7d7…). Ayrıntı `CHANGELOG.md`, `docs/MIMARI.md` → *2.0.11 eklemeleri*.
- **2.0.10 yayımlandı** (PR ceougur/ofis---y-netimi#10, `v2.0.10`; beş dosya ve latest/DestekOfis-Kurulum.exe bayt bayt doğrulandı): "2.0.10 için biriken düzeltmeler" listesinin 17 maddesinin tamamı (aşağıda, Kalanlar'da maddeler ve kararlar duruyor). Yeni parçalar: `server/lib/access.mjs` (özel roller, kişiye özel ekle/kaldır, `user.perms`), göç 15 (`roles`, `users.role_key`, yumuşak silme alanları), `server/lib/recovery.mjs` (kurtarma anahtarı + sunucu kodu; `packaging/windows/bin/kurtarma-kodu.cmd`, Başlat menüsü kısayolu), `server/lib/free-import.mjs` ("+ Sayfa" Excel/Sheets). ANLIK DURUM kartı yalnız yönetici (`overview.card`), Yönetim paneli yalnız yönetici; uzman İşlem geçmişini Raporlar → Tüm raporlar'dan görür. Doğrulama: birim 655, e2e 49 adım, `npm run test:senaryo-210` 57 denetim (17 maddenin her biri, ekran görüntüleri `test/e2e/artifacts/senaryo-210/`), senaryo 44, senaryo-rapor 82, senaryo-taslak 30. Ayrıntı `CHANGELOG.md`, `docs/MIMARI.md` → *2.0.10 eklemeleri*.
- **2.0.9 yayımlandı** (PR ceougur/ofis---y-netimi#9, `v2.0.9`): müşteri isteği "soldaki Raporlar cariye bağlı değil, boş geliyor" → sol menü *Raporlar* = *Rapor Al*, tek pencere (Cari ekstre, Vade takip, Nakit akış, Çek / Senet, Tüm raporlar, Tablo raporları); birleşik Vade takip (taksit + çek/senet + ileri tarihli Kasa + tablo takvimi, telefonla arama); Nakit akışta tablo kaynağı ve dönem toplamları; rapor merkezine beş modül raporu (28 rapor); açılış ekranında sektöre uygun taslak Excel (143 sektör); Excel okumada eski "kullanılan alan" etiketi düzeltmesi; destek hattı 0536 771 50 55 (program; site ceougur/destekofis#2 ile birleşti). Doğrulama: birim 630, senaryo-rapor 82, senaryo-taslak 30, e2e, 2.0.8 senaryosu 44. Ayrıntı `CHANGELOG.md`, `docs/MIMARI.md` → *2.0.9 eklemeleri*.
- **2.0.8 yayımlandı** (PR ceougur/ofis---y-netimi#8, `v2.0.8`; beş dosya bayt bayt doğrulandı; operatör merkezi PR ceougur/destekofis#1 birleşti): tablodaki ödeme planını Taksitler'e aktarma (`server/lib/insight/schedules.mjs`, `server/routes/plan-transfer.mjs`, `client/assets/hof-plan-transfer.js`; göç 14: `plan_entries.opening`, `plans.import_id`, `plan_imports`), açılış (devir) kaydı (Kasa dışı, makbuzsuz), takvimde çift kalem düzeltmesi (`plans.linkedCases`), Taksitler Excel yüklemesi gerçek vadelerle, stokta birim listesi ve ilk alım ("Kasa'ya yansıt" kutusu; boş kritik seviye/miktar = 0), lisans kalıcı testleri ve kimlik kaynağı. Doğrulama: birim 616, uçtan uca 49 adım, gerçek kullanıcı senaryosu 44 denetim (`npm run test:senaryo`), kılavuz `k14-tablodan-aktar.jpg` ile yenilendi. **Operatör merkezi (`destekofis`, dal `claude/nice-euler-jvajxv`, kullanıcı birleştirince Vercel yayımlar):** lisans verirken girilen müşteri bilgisi kurulum kaydına da yazılır, programdan gelen bilgi lisansın boş alanlarını doldurur (`fill_installation`, `sync_license_from_installation`; canlı Supabase'e uygulandı, mevcut kayıtlar dolduruldu); pencere dışına tıklama kapatmaz, uzun kart kartın içinde kaydırılır; **Altyapı limitleri** (Özet: Vercel fonksiyon çağrısı/veri aktarımı, Supabase veritabanı boyutu/egress; sayım `lisans.usage_daily`'de isteğin kendi işleminde, dış servise ek istek yok; %70 sarı, %90 kırmızı, üst çubukta rozet, `infra.warning` hareketi; Ayarlar › Altyapı kotaları). Ayrıntı `CHANGELOG.md` ve `destekofis/README.md`.
- **2.0.7 (sağlama paketi hazır; kullanıcı doğrulayınca birleştirme ve yayın):** ANLIK DURUM kartı (`routes/overview.mjs`, `hof-overview.js`; canlı `overview.changed`), Rapor Al (mizan/ekstre/nakit akışı `lib/finance-report.mjs`), rapor merkezi (`routes/report-center.mjs`, 23 rapor, `hof-report-center.js`), Çek/Senet (göç 13; `lib/cheques.mjs`, `routes/cheques.mjs`, `hof-cheques.js`; olay tabanlı, geri alınabilir), kişiye özel yetki (`users.grants_json`, `GRANTABLE`), stokta hizmet kalemi, kayıt ↔ cari ↔ taksit bütünlüğü (`POST /cases/:key/account`, ad eşleşmesi önerileri, `hasRecord` records tablosunu da sayar), güncelleyici düzeltmesi (kurulu sürüm dinamik, `stage` korumaları), Kasa toplamları SQL'de, iş akışı testleri (`test/is-akisi.test.mjs`). Sahada 2.0.6 güncelleme hatası: kullanıcıya "kurulum dosyasını üstüne çalıştır" denildi. Ayrıntı `CHANGELOG.md`.
- **2.0.6 yayımlandı** (PR ceougur/ofis---y-netimi#6, `v2.0.6`; beş dosya bayt bayt doğrulandı): Cari ve Stok modülleri (göç 12; taksit kartları cariye bağlı, Excel'den/tablodan toplu cari, toplu taksitlendirme, stok → Kasa/cari); taksit kartı tablodaki kayda bağlı (göç 11 `plans.case_key/case_source/case_title`; kişinin kartında TAKSİT PLANI bölümü, Tahsilat → taksit seçici, tek Kasa kaydı, işlem geçmişinde `plan-entry`); büyük tabloda arama hızı (paket yalnız açık sayfayı çizer, `HOF.tableWindow`); tabloda sütun ekle/sil (`dataset.columns.layout`, Silinenler türü `column`); A5 makbuz (firma adı, program adı yok); taksit kartında kayıt tarihi (göç 9); listede ve PDF'te bilgi notu; kolon adına yazılan tarihin düzeltilmesi ve önlenmesi (göç 10); seyrek belge kolonlarından uyarı; Google Sheets'ten toplu cari/stok, dört aşamalı alım boru hattı ve doğrulama kapısı (`server/lib/import-gate.mjs`), `synchronous=FULL`, 100 bin cari + 100 bin ürün yük kanıtı, tehdit analizi ve çökme senaryosu (`docs/TOPLU-ALIM-TASARIMI.md`, `test/import-crash.test.mjs`). Ayrıntı `CHANGELOG.md`.
- **2.0.4 içeriği:** Taksit modülü (`docs/MIMARI.md` → *2.0.4 eklemeleri*), kurulum dosyasıyla mevcut sunucunun üstüne güncellemede servis düzeltmesi (kök neden: dosyalara yazılan klasör izni), Telefon düğmesi, kolon genişlikleri. Ayrıntı `CHANGELOG.md`.
- **2.0.3 içeriği:** ay hücresindeki tutar aylık ücret kolonu yoksa ödenecek taksittir; kart detayındaki tahsilat (notundaki ay) o ayı kapatır. Ayrıntı `CHANGELOG.md`.
- **2.0.2 içeriği:**
  - Excel/Sheets açılır listeleri ve Excel birleşik giriş kutuları → programda açılır liste (`server/lib/choices.mjs`, `client/assets/hof-choices.js`); gizli liste sayfası programda da gizlenir.
  - Belge kartı: adet sınırı yok, yan yana 1–4 sütun, seçilenleri .zip ile indirme (`/api/workspace/cases/:key/documents/archive`), PDF/resim/metin doğrudan yazdırma.
  - Uyarı kartında "Gerçekleştirildi" (hücreye yazar, tarih korunur; tekrarlayan ödeme gününde yalnız o ay kapanır; görev tamamlanır); 20 sn görünür, aralarında 10 sn, kısa bildirimlerle üst üste binmez.
  - Ana tabloda tüm kolonlar (paket yaması `tum-kolonlar-*`), içeriğe göre genişlik, dondurulmuş ilk kolon, yapışkan yatay kaydırma çubuğu (`hof-grid.js`); serbest sayfada 500 kolon.
  - Kendi sektörü (`server/lib/custom-sectors.mjs`): oluştur/düzenle/sil, tanıtıcı başlıklarla öneri.
  - Sohbet gün gün; 30 günden eskiler `veri/mesaj-arsivi/` altına ay ay metin olarak taşınır (`server/lib/chat-archive.mjs`).
  - Tarih anlamı sınıflandırıcısı (`server/lib/insight/temporal.mjs`), satır bağlamı, tahsilat takvimi düzeltmeleri; Silinenler ve geri yükleme (göç 6); sekme adlandırma/silme; sade sol menü; kısa kılavuz (8 sayfa).
  - Ay matrisi → taksit defteri (`server/lib/insight/installments.mjs`): geçerlilik aralığı dışındaki boş aylar taksit değil; 3 tam boş ay → durgun, raporda listelenir.
  - Raporlar (sol menü): ortak omurga sorgu motoru, oturumlar arası cari eşleme, Cari ekstre / Vade takip / Nakit akış, dinamik kolonlar, Excel/PDF/yazdır (`server/lib/reports.mjs`, `client/assets/hof-reports.js`).
  - Drive'a yedek (2.1.0'da KALDIRILDI, kullanıcı kararı 10.10.2026): Yönetim → Yedekler; klasör yolu ya da Drive bağlantısı; `DestekOfis Yedekleri`; bağlantı kipi lisans servisindeki `/v1/yedek/oturum` ucunu bekler (`docs/DRIVE-YEDEK.md`, Vercel işlevi henüz yayımlanmadı).
  - Doğrulama: birim ve uçtan uca testler, 2.0.1 → 2.0.2 ve eski sürümlerden güncelleme provası (ayrıntı `CHANGELOG.md`).

### 2.0.18 — teslim hazır 02.10.2026 (PR/yayın kullanıcı onayıyla)
Müşteri bildirimi: marka/patent tablosunda kayıttan açılan cari adı "Marka / Buluş Adı" kolonundan geliyordu (FURRA).
Kök neden ve program geneli düzeltme (`client/assets/hof-plans.js` personOf → analizin kişi kolonu; öğe adı kolonları
ad sayılmaz; Adı + Soyadı birleşik). Kullanıcı kararı ("çok özellik çok hata doğuruyor"): kayıt ile cari AYRILDI —
Yeni Kayıt'taki "cari kartı da aç", Cari'deki Tablodan Al, Raporlar'daki "Tablodaki Kişileri Cari Yap", detay kartındaki
CARİ kutusu / Cari Kartı pili ve POST cases/:key/account ucu kaldırıldı. Kalanlar: cari formundaki Tablodaki Kayıt alanı,
kayıttan taksit, Taksit → Tablodan Aktar. Şema göçü yok. Kanıt `docs/2.0.18-KANIT.md`, CHANGELOG → 2.0.18, CLAUDE.md
madde 15. Teslim `dist/teslim-2.0.18/` (3 zip + SHA256SUMS; OKU-BENI.txt'de yayın adımları).

## Kalanlar (öncelik sırasıyla)

### 2.0.17 — yapıldı, teslim paketi hazır (02.10.2026; dal `claude/nice-euler-jvajxv`; PR/birleştirme/yayın kullanıcı onayıyla)
Müşteri bildirimleri (CLAUDE.md → Açık iş → "2.0.17 müşteri istekleri", 14 madde): çoklu şirket (001/002… ayrı veri tabanı,
sol üst şirket seçici, Yönetim → Şirketler: yetki, birleşik rapor, Verisini Sıfırla, Sil), çalışma oturumu kalktı → ortada
Sayfalar şeridi (+ Sayfa: Excel/Sheets = veri sayfası, Boş Sayfa; Veri Sekmesine Dönüştür; zil/takvim bütün sayfalar),
fatura Sil, hayalet kısmi ödeme (kapama yöne göre, Mahsup Et, Kapatılacak Fatura, Bu Faturayı Kapatanlar), Kasa yalnız
nakit + Banka/POS raporu + Kasa↔Banka transferi, eksi stok görünür, çek ciro seçici, iade düzenleme + pasif düğme nedeni,
güncelleyici periyodik denetim; madde 14 (Excel doldurma tutamacı) yalnız kılavuz notu (program dosyaya yazmaz).
Kanıt: `CHANGELOG.md` → 2.0.17, `docs/2.0.17-KANIT.md`, `docs/MIMARI.md` → *2.0.17 eklemeleri*, `test/*-217.test.mjs`,
`npm run test:senaryo-217` (62/62). **Göç VAR** (şema 18 → 19: `account_entries.invoice_id`, `invoice_offsets`); çoklu
şirkette mevcut veri dosyası yerinde = 001. Teslim: `dist/teslim-2.0.17/` (3 zip + SHA256SUMS).

### 2.0.16 — yayımlandı 02.10.2026 (PR #16, `v2.0.16` = bd777e9; beş dosya ve latest/ adresleri bayt bayt doğrulandı; güncelleyici 2.0.15/14/13/12/2.0.4/1.7.0 → 2.0.16 "available"; site kılavuz PR'ı ceougur/destekofis#4)
Müşteri bildirimleri (CLAUDE.md → Açık iş → "2.0.16 müşteri hataları", 11 madde): fatura raporları cari seçmeden açılır
(kritik), kaydedilmiş faturayı Düzenle (aynı numara, tek işlemde geri al + yeniden yaz), "Kes" → "Kaydet", KDV dahil iskonto
ve Toplamlar düzeni, Stok Kodu (barkod; tekil; faturada kolon, PDF, rapor), alışta + Yeni Stok Kartı, Tüm Kalemlere KDV, KDV
kutusu, kırpılmayan öneri listesi, tahsilatta POS / ödemede Kredi Kartı, PDF düğmesi adları. Kanıt: `CHANGELOG.md` → 2.0.16,
`docs/MIMARI.md` → *2.0.16 eklemeleri*, `test/fatura-216.test.mjs`, `npm run test:senaryo-216` (42 rapor arayüzden).
Göç yok (şema değişmedi). Teslim: `dist/teslim-2.0.16/` (3 zip + SHA256SUMS; 2-Kurulum 59,7 MB olduğundan .exe ayrıca verildi). Madde madde kanıt: `docs/2.0.16-KANIT.md`.

### 2.0.15 — yayımlandı 02.10.2026 (PR #15, `v2.0.15` = 85171ae; beş dosya ve latest/DestekOfis-Kurulum.exe bayt bayt doğrulandı; güncelleyici 2.0.14/13/12/2.0.4/1.7.0 → 2.0.15 "available")
Kapsam ve kanıt: `CHANGELOG.md` → 2.0.15, `docs/MIMARI.md` → *2.0.15 eklemeleri — Fatura modülü*, `docs/FATURA-ISTEKLER.md`
(her istek kanıtlı, kararlar listesi), `docs/FATURA-QA-RAPORU.md` (64 test, 92/100), `docs/FATURA-KARSILASTIRMA.md`,
proje sahibi kılavuzu `docs/kilavuz/FATURA-SAHIP-KILAVUZU.html` (PDF teslimde). Kullanıcı kararları: e-Belge bağlantısı
KAPALI ("entegre et" diyene kadar; tek anahtar `config.edocEnabled`), entegratör yalnız EDM, "Listeden Sil" etkileri geri
almaz, icra dosyası bağı yapılmaz (cari yeter). Doğrulama (02.10.2026): `npm run check` 281/281, `npm test` 734/734,
`npm run test:e2e` 50/50, `npm run test:senaryo-215` 73/73, `npm run test:mutabakat` tohum 1 (2.000 işlem, 0 sapma),
`test/einvoice-edm.test.mjs` 22/22. Göç 18 (yalnız ekleyici; 2.0.14 yeni şemayla açılabilir). Çalışma zamanı gereksinimi
değişmedi (Node aynı; bootstrap 2) → 1.7.0 ve sonrası bütün kurulumlar kendiliğinden güncellenir.
Teslim: `dist/teslim-2.0.15/` (OKU-BENI.txt'de yayın adımları; `DestekOfis-2.0.15-1-Guncelleme-ve-Belgeler.zip`,
`DestekOfis-2.0.15-Kaynak-ve-Denetim.zip`, SHA256SUMS). İmzalı güncelleme paketi (anahtar destekofis-2026-1, kullanıcının oturuma yüklediği .pem dosyasıyla
`node tools/release.mjs --anahtar …`; sha256 a3c1835c…) ve `DestekOfis-Kurulum-2.0.15.exe` (Wine + Inno Setup; sha256
aa943af8…) teslimde; beş dosya yayına kullanıcı tarafından yüklenir (OKU-BENI.txt). "birleştir" denince PR,
"yayımladım" denince yayındaki dosyalar bayt bayt doğrulanır (önceki sürümlerdeki gibi).

### 2.0.14 — yayımlandı 01.10.2026 (PR #14, `v2.0.14` = 6337029; beş dosya ve latest/ adresleri bayt bayt doğrulandı)
Teslim: `DestekOfis-2.0.14-{1-Guncelleme-ve-Belgeler,2-Kurulum,Kaynak-ve-Denetim}.zip` + SHA256SUMS (güncelleme paketi
sha256 9a6bc908…, kurulum dae7a169…; imza anahtarı destekofis-2026-1; şema 17 değişmedi). Provalar 2.0.13/12/11/10 (107),
2.0.4 (108), 1.7.0 (98) — 0 hata. "birleştir" denince PR, "yayımladım" denince yayındaki dosyalar bayt bayt doğrulanır.
Kullanıcının biriktirdiği liste (`CLAUDE.md` → Açık iş → 2.0.14 listesi): 1 damga düzeltmesi, 2 WhatsApp Otomatik Sıra + PDF,
3 tüm arama kutularında odak, 4 bütün programda odak denetimi, 5 detay panelinde Cari Kartı düğmesi. Kapsam ve kanıt
`CHANGELOG.md` → 2.0.14, `docs/MIMARI.md` → *2.0.14 eklemeleri*. Doğrulama: `npm test`, `npm run test:senaryo-214` (odak),
`npm run test:senaryo-whatsapp` (adım E), `npm run test:senaryo-213` (PDF), diğer senaryolar ve `npm run test:e2e`.

### 2.0.13 — yayımlandı 01.10.2026 (PR #13, `v2.0.13` = 20e110d; beş dosya ve latest/DestekOfis-Kurulum.exe bayt bayt doğrulandı)
Teslim: `DestekOfis-2.0.13-{1-Guncelleme-ve-Belgeler,2-Kurulum,Kaynak-ve-Denetim}.zip` + SHA256SUMS (güncelleme paketi
sha256 840193a1…, kurulum d3fe6f22…; imza anahtarı destekofis-2026-1; göç 17). Yayın adımları teslimdeki OKU-BENI.txt'de;
"birleştir" denince PR, "yayımladım" denince yayındaki dosyalar bayt bayt doğrulanır.
Kapsam ve kanıt `CHANGELOG.md` → 2.0.13 ve `docs/MIMARI.md` → *Ana Defter ve mutabakat kapısı*. Özet:
- Süpermarket simülasyonu bulguları (çift borç, iade, alış/satış fiyatı, eksi kasa, açılış bakiyesi yönü, çift cari).
- WhatsApp tek/toplu ekstre ve mesaj; ödeme/tahsilat yolu (Nakit, Havale/EFT, Kredi Kartı, Çek/Senet, Açık Hesap).
- Ana Defter (türetilmiş, çift yönlü) + işlem anında mutabakat kapısı (COMMIT öncesi; sapmada ROLLBACK + `integrity_log`).
- Kullanıcı kararı (holding stres simülasyonu İPTAL; "4 çekirdeğe odaklan"): Kasa, Stok, Cari, Taksit için tarih kuralları
  (`server/lib/period.mjs`), dönem kilidi (Yönetim → Sistem), yuvarlama, iade sınırı, cari bazında mutabakat,
  `npm run mutabakat` (salt okunur yerel denetim), `npm run test:mutabakat` (model tabanlı uzun koşu),
  `test/mutabakat-cekirdek.test.mjs`, `test/donem-213.test.mjs`.
- Eksi Bakiye Denetimi (kullanıcı onayı 01.10.2026; Logo/Netsis parametresinin karşılığı): Nakit, Banka, Kredi Kartı için
  Uyar / Engelle / Kontrol Yok — Yönetim → Sistem. Cari listesinde hepsini seç + hariç tut (WhatsApp ve toplu taksit).
  WhatsApp ölçek senaryosu: `npm run test:senaryo-whatsapp` (1.000 cari, 40 seçili, 190 kişiye şube mesajı, 997 hariçli).
- Davranış değişikliği: ileri tarihli Kasa hareketi (planlı gider) artık girilemez; eski kurulumlardaki satırlar taban
  sayılır ve raporlarda görünmeye devam eder. Tarih alanı hiç gönderilmezse bugün yazılır; gönderilip boş bırakılırsa ret.

### 2.0.12 düzeltmeleri — yayımlandı 30.09.2026 (PR #12, `v2.0.12`; beş dosya bayt bayt doğrulandı)
1. **Taksit kartının "Kayıt Tarihi" carinin kayıt tarihini taşımıyor** (müşteri, 30.09.2026; ilk bildirim "tahsilat girince
   kayıt tarihi değişiyor"; WhatsApp ekran görüntüsüyle netleşti: *Yeni Taksit Kartı* formu). **Neden (kodda doğrulandı):**
   kartın kendi `registered_on` alanı var ve cari seçilse de **bugün** gelir — form `hof-plans.js:497`
   (`plan?.registeredOn || todayIso()`), toplu taksitlendirme `plans.mjs createForAccount` (`today()`), cari arama
   ucu (`/accounts/search`) carinin `registeredOn`'unu döndürmüyor. Carinin tarihi bozulmuyor; ama aynı kişi için iki farklı
   "Kayıt Tarihi" görünüyor (cari: eski tarih, kart ve Taksit Kartları raporu: bugün). Kayıttan *Tahsilat → Taksit planı
   oluşturun* yolu bu formu açtığı için müşteri "tahsilat girince" dedi. Müşterinin yorumu: "kişinin gruba eklendiği
   tarihi belirtir diyor" — yardım metni "Kişinin kaydedildiği gün; bugün hazır gelir." yanıltıcı.
   **Yapılacak:** cari seçilince (elle, öneriyle ya da kayda bağlı cariyle) kartın Kayıt Tarihi carinin tarihiyle dolsun
   (kullanıcı değiştirmediyse); toplu taksitlendirmede kart carinin tarihini alsın; carisi yoksa tablodaki kaydın "Kayıt
   Tarihi" kolonu, o da yoksa bugün. Yardım metni: "Carinin kayıt tarihi; cari seçilince onunki gelir." Mevcut kartlar için
   (isteğe bağlı) "carinin tarihini kullan" göçü kullanıcıya sorulacak. **Ek (müşteri):** "İlk vade tarihi aşağı tarafta
   kalıyor" — formda İlk Vade, Taksit Sayısı'nın yanına/üstüne alınsın. Test: tarihli cari → Yeni Kart / Cari Seç toplu /
   kayıttan Tahsilat → kartın tarihi = carinin tarihi; raporda aynı.

### 2.0.11 düzeltmeleri — tamamı yapıldı ve yayımlandı (30.09.2026, v2.0.11)
Maddeler ve kararlar kayıt için duruyor; yapılan iş ve kanıtı `CHANGELOG.md` → 2.0.11 ve `test/e2e/senaryo-211.mjs`.
1. **Tablo arama kutusu her yerinden tıklanınca etkinleşmeli** (müşteri, 30.09.2026, ekran görüntüsü "TÜM REHBER"):
   kutunun alt kısmına tıklayınca yazma başlamıyor; ancak tam ortadaki ince şeride tıklanınca etkinleşiyor. Koddan
   ölçülen neden (2.0.10): `.search-field` 44 px yüksek ama içindeki `input` yalnız 18 px; altındaki "Enter · ilk sonuca
   git · Ctrl+K" ipucu (`.smart-search-hint`) ve iç boşluklar tıklamayı yutuyor. Yapılacak: kutunun her noktası
   (büyüteç, ipucu, boşluk, ⌘K) tıklanınca `input` odaklansın (kutu `label` gibi davransın ya da `mousedown` → `focus`),
   `input` kutunun yüksekliğini doldursun, imleç metin imleci olsun; bütün arama kutularında (Cari, Taksitler, Stok,
   Çek/Senet, Raporlar, Mesajlar, sektör seçici) aynı. Test: e2e — kutunun dört köşesine ve ipucuna tıklayınca odak
   `input`'ta.
2. **Veri sağlığı: "Yok say" ile uyarı kalıcı kapansın, puan %100'e çıkabilsin** (müşteri, 30.09.2026, ekran görüntüsü
   "Veri sağlığı: Orta (%90)": "Öğrenci No boş olan 2716 kayıt", "Telefonu kolonunda geçersiz telefon: 31", "Soyadı boş: 1").
   Müşteri: "%90 psikolojimi bozuyor; ilk uyarı versin, yoksay deyince bir daha çıkmasın, sağlık artsın."
   Yapılacak (muhasebe programlarındaki "uyarıyı kabul et / bir daha gösterme" kalıbı): her bulgu grubunda **Yok say**
   (grubun tamamı) ve satır bazında yok say; kalıcı (sunucuda, veri oturumuna ve kolona bağlı; tüm bilgisayarlarda),
   puan hesabından düşülür → kalan sorun yoksa %100 "İyi". Yok sayılanlar ayrı katlanır bölümde ("Yok sayılanlar · N")
   **Geri al** ile döner; yeni yüklemede aynı kolon/aynı kayıt için yok sayma korunur, yeni hatalı satır yine uyarır.
   İşlem geçmişine yazılır; yetki: veri yükleme yetkisi olan (yönetici). Test: API + e2e (yok say → puan artar → yeniden
   yükle → yok sayılan gelmez, yeni hata gelir → geri al).
   **Ek gözlem (ekran görüntüsünden, doğrulanacak):** bu tablo bir personel/akademik **rehber** ("TÜM REHBER"; satırlarda
   Öğr.Gör., Dr., Prof.Dr. unvanları) ama kimlik kolonu "Öğrenci No" sayılmış ve kayıt adı olarak **unvan** gösteriliyor.
   Kimlik kolonu boşsa 2716 kaydın hepsi "sorun" görünüyor. Kolon rolleri (kimlik/kişi/unvan) bu tablo için yeniden
   incelenecek: kimliği boş sekmede kimlik zorunluluğu uyarısı yerine ad+soyad kişi anahtarı; unvan kişi adı sayılmasın.
3. **Taksitler ekranında toplu taksitlendirme** (müşteri, 30.09.2026): "Toplu taksitlendirmeyi ilk başta ben bile zor
   buldum; Cari'den toplu seçim yapınca çıkıyor, bunu Taksitler menüsüne de ekleyelim." Bugün yol yalnız *Cari → soldaki
   kutularla seç → Seçilenlere taksit planı* (sunucu `POST /api/workspace/accounts/bulk-plan`, istemci `hof-accounts.js`).
   Yapılacak: *Taksitler* üst çubuğuna **"+ Toplu taksitlendir"** düğmesi → cari seçme penceresi (arama; tür, grup/alt grup,
   bakiye süzgeçleri; "Tümünü seç"; açık taksit kartı olan cari işaretli ve varsayılan seçilmez, "zaten kartı var" yazar;
   seçili sayısı ve toplam) → aynı taksit formu (tutar herkese aynı ya da karttaki alandan, taksit sayısı, ilk vade,
   aralık, grup) → ön izleme (kaç kart, toplam, atlanacaklar ve neden) → oluştur. Aynı sunucu ucu kullanılır (tek kural,
   çift kart açılmaz). Cari yoksa pencere yol gösterir ("Tablodaki kişileri cari yap" / "Excel'den cari yükle"). Kılavuzda
   Taksitler bölümüne yazılır. Test: e2e — Taksitler'den 3 cari seç → 3 kart, aynı cari ikinci kez seçilince atlanır,
   Cari ekranındaki yol da çalışmaya devam eder; boş veri ve aynı adlı iki cari.
4. **Taksitler › grup süzgeci boş gruplarla dolu** (müşteri, 30.09.2026, ekran görüntüsü): *Tüm gruplar* listesinde
   "42 C 0348 (0)", "42 C 0079 (0)"… hepsi **0 kart**; seçince liste boş. Müşteri: "orada cari seçimi olmadığı için
   gruplarda boş çıkıyor, bu da hata." Neden (doğrulanacak): gruplar carilerden/Excel'den tanımlandı ama bu gruplardaki
   carilerin henüz taksit kartı yok; süzgeç yalnız kartları sayıyor. Yapılacak (3. maddeyle birlikte): grup süzgecinde
   kart sayısının yanında **cari sayısı** ("42 C 0079 · 12 cari · 0 kart"); kartı olmayan grup seçilince boş liste yerine
   "Bu grupta 12 cari var, henüz taksit kartı yok → **Bu gruba toplu taksitlendir**" (seçim penceresi o grupla açılır);
   hiç carisi ve kartı olmayan grup listede sönük/ayrı. Test: e2e — gruplu cariler, kart yok → süzgeçte sayılar doğru,
   düğmeyle toplu taksit → kartlar grupta görünür.
   **Ek (müşteri, 30.09.2026):** "bu karta bu cari seçimi de ekleyeceğiz" — Taksitler penceresine (kullanıcı teyit etti;
   "Tüm gruplar · Alt grup · Sıra No" süzgeç satırına) **cari seçimi** gelir: grup seçilince o gruptaki cariler onay kutulu listede görünür (kartı olan/
   olmayan ayrı işaretli), seçilenler 3. maddedeki toplu taksitlendirmeye gider. Not: tekil "Yeni taksit kartı"
   penceresinde Cari seçici zaten var (hof-plans.js, v2.0.6); eksik olan ekran düzeyinde toplu cari seçimi.
5. **Birimlerin baş harfi büyük; tüm programda seçenek yazımı** (müşteri, 30.09.2026, Stok › Yeni ürün ekran görüntüsü):
   Birim listesi "adet, paket, kutu, çuval, şişe…" küçük harfle. İstek: baş harfleri büyük olsun ("Adet", "Paket",
   "Çuval", "Şişe") ve **tüm programdaki açılır listeler/etiketler** aynı gözle taransın. Kaynak: `hof-stock.js` `UNITS`
   dizisi; kayıtlı birimler de listeye katılıyor (`[...UNITS, ...used]`). Dikkat: (a) büyük harf Türkçe kurala göre
   (`toLocaleUpperCase("tr")`: i→İ); (b) eski kayıtlardaki "adet" ile yeni "Adet" listede iki kez çıkmasın — büyük/küçük
   harf duyarsız tekilleştirme, gösterimde tek biçim (kayıtlar, ekstre, fatura/PDF, Excel dışa aktarım aynı yazar);
   (c) **karar (kullanıcı, 30.09.2026): kısaltmalar dahil hepsinin ilk harfi büyük** — Kg, Gr, Ton, Lt, Ml, Cm, M², M³.
   Test: eski "adet" kayıtlı ürün + yeni ürün → listede tek "Adet"; stok raporu/PDF/Excel'de aynı yazım.
6. **Kasa penceresi bağlı hareket silinince kendini yenilemiyor** (müşteri, 30.09.2026, ekran görüntüsü): Kasa'da
   "Çek ödemesi · …" satırındaki ↗ ile çek/senet kartı açılıp hareket silinince Kasa'ya dönüldüğünde satır ve
   göstergeler eski kalıyor; kapatıp açmak gerekiyor. **Neden (kodda doğrulandı):** `hof-workspace.js` Kasa penceresi
   yalnız `change.kind === "cash"` olayında yeniden yükleniyor; çek/senet işlemleri `kind: "cheques"` yayımlıyor
   (`server/routes/cheques.mjs`); cari, taksit ve stok kaynaklı kasa satırları da aynı riskte. Yapılacak: Kasa'ya yazan
   her kaynak (çek/senet, cari, taksit, stok, detay kartı tahsilatı) değişince açık Kasa penceresi seçili dönemi
   koruyarak yenilensin (sunucuda kasayı etkileyen işlemler ayrıca `cash` olayı da yayımlasın ya da pencere bu
   türleri de dinlesin); aynı denetim ANLIK DURUM, Cari ekstresi ve Raporlar gibi açık kalan diğer pencerelere de.
   Test: e2e — Kasa açık → ↗ çek kartı → ödemeyi geri al/sil → kartı kapat → Kasa satırı ve 4 gösterge yeni değerde;
   ikinci kullanıcının silmesi de aynı şekilde yansır.
7. **Başlıklarda her sözcüğün baş harfi büyük (Title Case), tüm programda** (müşteri, 30.09.2026): "Tüm cari
   hareketleri" → "Tüm Cari Hareketleri", "Personel raporu" → "Personel Raporu"; uzman UI gözüyle programın tamamına.
   Kullanıcının verdiği hedef örnekler (bağlaç kuralını teyit eder): "Cari Listesi ve Bakiyeler", "Tüm Cari Hareketleri",
   "Cari Bazında Tahsilat", "Taksit Kartları".
   Örnek kaynaklar: `server/routes/report-center.mjs` (rapor adları), `server/lib/profile.mjs` ve `hof-workspace.js`
   (sektör/menü etiketleri). **Kapsam (adlar ve başlıklar):** pencere ve bölüm başlıkları, rapor adları, sol menü,
   sekme/pil adları, düğmeler, gösterge (KPI) etiketleri, tablo kolon başlıkları, açılır liste seçenekleri, PDF/Excel
   başlıkları ve sayfa adları. **Kapsam dışı (cümle düzeni kalır):** yardım/açıklama cümleleri, uyarı ve bildirim
   metinleri, onay pencerelerindeki cümleler, kullanıcının yazdığı veri (kişi adı, not, kullanıcının verdiği pil/kolon
   adı). **Kurallar:** Türkçe büyük harf (i→İ, ı→I); bağlaçlar küçük kalır ("ve", "ile", "veya", "ya da", "de/da"),
   ör. "Kasa ve Banka"; kısaltmalar olduğu gibi (PDF, KDV, TC, No). CSS `text-transform` kullanılmaz (Türkçe İ ve
   bağlaç kuralını bozar, PDF/Excel'e yansımaz); metinler kaynakta düzeltilir, 5. maddedeki birimlerle aynı ilke.
   Kullanıcının kalemle yeniden adlandırdığı başlıklara dokunulmaz. Kılavuz (HTML+PDF) ve ekran görüntüleri yeni
   yazımla güncellenir. Test: metin taraması (başlık sözlüğünde küçük harfle başlayan sözcük kalmadı; bağlaç istisnası)
   + e2e/ekran görüntüsünde menü, Raporlar, Kasa, Cari, Taksitler, Stok, Çek/Senet, Yönetim başlıkları.
8. **Sol menüde "Ayarlar" aşağıya taşınsın** (kullanıcı, 30.09.2026, ekran görüntüsü): "Ayarlar" düğmesi şimdi en
   üstte, Çalışma oturumu seçicisinin hemen altında duruyor; kullanıcı kartının (Ofis yöneticisi · Profil / Parola /
   Yönetim / Çıkış) **altına**, "Senkron aktif" kartının üstündeki boşluğa taşınacak. Kaynak: düğme hazır paketin kenar
   çubuğundan geliyor; `hof-sources.js` yalnız tıklamayı yakalayıp Veri penceresini açıyor ve `sources.manage` yetkisi
   yoksa gizliyor — taşıma DOM'da bu düğmeyi yeni yerine almak (paket yeniden çizince yerinde kalmalı). Dikkat: yetki
   gizlemesi ve tıklama yakalaması aynen sürer; dar ekranda/menü kaydırılırken alt blok taşmasın; Ctrl/klavye sırası
   mantıklı olsun. Test: e2e — yönetici: Ayarlar kullanıcı kartının altında, tıklayınca Veri penceresi açılır;
   yetkisiz kullanıcı: görünmez; oturum değiştirince/yenilenince yeri değişmez; ekran görüntüsü.

### 2.0.10 düzeltmeleri — tamamı yapıldı ve yayımlandı (30.09.2026, v2.0.10)
Maddeler ve kararlar kayıt için duruyor; yapılan iş ve kanıtı `CHANGELOG.md` → 2.0.10 ve `test/e2e/senaryo-210.mjs`.
1. **Sol menü › Çalışma oturumu kartı kesiliyor** (29.09.2026, ekran görüntüsü): sol paneldeki *Çalışma oturumu* başlığına tıklayınca açılan *Çalışma oturumları* kartı (oturum listesi, "+ Yeni oturum aç", "Oturumlar" düğmesi, alttaki açıklama) sağdan panelin dışına taşıyor; bir kısmı panelin altında / ana içeriğin arkasında kalıyor. Kart panelin içine sığmalı ya da panelin üstünde (z-index) açılmalı; dar panelde genişlik panele göre. Test: e2e'ye "oturum kartı görünür alanda, taşma yok" adımı.
2. **Görev ata › Atanacak kişi listesi eksik** (29.09.2026, ekran görüntüsü): kayıt kartından *Görev ata* penceresinde "Atanacak kişi" listesinde yalnız "Ofis yöneticisi" var; oysa Yönetim › Kullanıcılar'da aktif personel (mukaddes ulutaş, rol Personel, ANLIK DURUM yetkili) mevcut. Beklenen: tüm aktif kullanıcılar (yönetici, uzman, personel, muhasebe) listede, rolüyle birlikte; pasif hesaplar hariç. Koddan bak: listeyi dolduran uç (`/api/admin/users` mi, ayrı bir "atanabilirler" ucu mu) ve istemcideki süzgeç; olası neden: liste yalnız `plans.manage`/uzman rolleri süzüyor ya da sayfa açılışında bir kez yüklenip yeni kullanıcı gelince yenilenmiyor. Test: API + e2e ("personel eklendi → Görev ata listesinde görünür").
3. **Rapor durum metinlerinde parantezli açıklamalar kalksın** (müşteri isteği, 30.09.2026): *Cari listesi ve bakiyeler* ve *Cari mizanı* raporlarında Durum sütunu "Borçlu (bize borçlu)" / "Alacaklı (biz borçluyuz)" yazıyor; müşteri parantez içindekileri istemiyor → yalnız "Borçlu" / "Alacaklı" / "Kapalı". Yerler: `server/routes/report-center.mjs:43` ve `server/routes/overview.mjs:167` (`sideText`); aynı ifade ekstre alt notlarında da var (`overview.mjs:224`, `report-center.mjs:289`, `hof-overview.js:416` "B: bize borçlu · A: biz borçluyuz") — onlar sütun kısaltmasını açıklıyor, müşteriye sor / sade bırak ("B: borç · A: alacak"). Ekran, PDF ve Excel'de aynı olsun; testlerdeki beklentiler güncellenir.
4. **Bakiye renkleri ters** (müşteri isteği, 30.09.2026, *Cari listesi ve bakiyeler* ekran görüntüsü): muhasebe programlarındaki genel kural — **bizim alacağımız (cari bize borçlu) yeşil, bizim borcumuz (biz cariye borçluyuz) kırmızı**. Şu an tersi: `client/assets/hof-ui.css:7154` `.hof-acc-balance.is-debtor` kırmızı (#b3473a), `.is-creditor` yeşil (#177245); `hof-accounts.js:52` `balanceHtml` bu sınıfları bakiyeye göre veriyor. Aynı kural programın her yerinde tek olsun: Cari listesi, cari kartı bakiyesi, mizan/ekstre (`hof-overview.js`), rapor merkezi hücreleri, ANLIK DURUM "Toplam alacak / Toplam borç" kutuları, PDF'ler (`server/lib/report-pdf.mjs`'de renk varsa). Yön: alacak = yeşil, borç = kırmızı; gecikmiş yine kırmızı. **Müşterinin açıklaması (30.09.2026):** "Borçlu ve Alacaklı diye düzenleme yaparsak, Borçlular yeşil, Alacaklılar kırmızı görünecek" — yani Durum sütununda **Borçlu** (cari bize borçlu = bizim alacağımız) **yeşil**, **Alacaklı** (cari bizden alacaklı = bizim borcumuz) **kırmızı**. Metin ve renk birlikte düşünülür; kelime carinin durumunu anlatır, renk bizim açımızdan iyi/kötüyü. Bu maddeyle birlikte 3. maddedeki metin sadeleşmesi ("Borçlu" / "Alacaklı") da aynı yerlerde yapılır. Test: e2e'de sınıf/renk denetimi (bize borçlu satır `is-debtor` → yeşil).
5. **Bakiye listesine süzgeç seçenekleri** (müşteri isteği, 30.09.2026): *Cari listesi ve bakiyeler* raporunda (ve Cari ekranı listesinde) bakiye süzgeci şu seçeneklerle: **Tümü · Borçlular · Alacaklılar · Sadece bakiyesi olanlar** (bakiyesi sıfır olanlar gizlenir). Rapor merkezinde `side` süzgeci zaten var (`hof-report-center.js:50`: Tümü / Bize borçlu / Biz borçluyuz / Kapalı / Geciken taksiti olan) → etiketleri "Borçlular / Alacaklılar" yap, "Sadece bakiyesi olanlar" ekle (`report-center.mjs` cari-listesi süzgecine `nonzero`), Cari ekranındaki süzgece de aynısı (`hof-accounts.js:21` debtor/creditor). Ön izleme, PDF ve Excel süzgeci uygular; özet satırı süzülen kümeye göre. Test: API (nonzero süzgeci sıfır bakiyeyi dışarıda bırakır) + e2e.
6. **Cari ekstre PDF'i** (müşteri, 30.09.2026, WhatsApp görüntüsü): "Dönem sonu bakiye" kutusunda "3.000,00 TL Borçlu (…" — parantezli açıklama kutuya sığmayıp kesiliyor; 3. maddeyle birlikte yalnız "Borçlu" / "Alacaklı" yazılacak, kesilme kalmayacak. Alt başlıktaki "B: bize borçlu · A: biz borçluyuz" → "B: borçlu · A: alacaklı" (ya da satır sonundaki B/A harflerini "Borçlu/Alacaklı" kelimesiyle değiştir). Yerler: `server/routes/overview.mjs:224`, `server/routes/report-center.mjs:289`, ekran karşılığı `hof-overview.js:416`. PDF'de bakiye rengi de 4. maddeye uyar.
7. **ANLIK DURUM kartı yalnız yöneticide** (kullanıcı, 30.09.2026): ana ekrandaki ANLIK DURUM kartı personel ekranında görünmesin, yalnız yönetici görsün. Bugün kural `overview.view: ["admin"]` (`server/lib/permissions.mjs:42`) ama *Yönetim › Kullanıcılar › Ek yetki › "ANLIK DURUM ve raporlar"* ile personele açılabiliyor (`GRANTABLE`, :64); müşterinin personelinde (mukaddes) bu yetki açık olduğu için kart görünüyor. Yapılacak: kart ek yetkiyle de personelde çıkmasın — ek yetki yalnız Raporlar penceresini açsın (adı "Raporlar" olsun), kart (`hof-overview.js` mount + `hof-can-overview-view` CSS) ve `/api/workspace/overview` yalnız `admin` rolüne; rapor uçları ayrı izin (`reports.view` / yeni `reports.grant`) ile. Var olan grant'lar göçle yeni izne taşınır (kimse rapor yetkisini kaybetmez). **Tüm programda, sektörden bağımsız** (sektör sözlüğü/vocab'a bağlı değil; tek kural). Test: personel + ek yetki → kart yok, Raporlar var; API 403.
8. **Serbest sayfa "Yeni sayfa" kartına Excel / Sheets'ten içe aktarma** (kullanıcı, 30.09.2026): sekme şeridindeki *+ Sayfa* penceresinde (Sayfa adı, Kolon sayısı, Satır sayısı, Kolon başlıkları) iki seçenek daha: **Excel dosyasından aktar** (dosya seç / sürükle; .xlsx/.xls/.csv) ve **Google Sheets bağlantısından aktar**. Seçilen sayfanın başlıkları ve hücreleri serbest sayfaya olduğu gibi yazılır (ilk satır başlık; sayfa adı dosyadan/sekmeden gelir, değiştirilebilir; çok sayfalı dosyada sayfa seçilir); formüller varsa programın formül motoruyla taşınır, olmazsa değer yazılır; satır/kolon sayısı içerikten belirlenir (500 kolon sınırı korunur). Ana veri yüklemesiyle (oturum) karıştırılmaz: ana tabloya değil serbest sayfaya gider, oturum açılmaz. Mevcut parçalar: istemcide `hof-excel-worker.js` (dosya okuma), `hof-sources.js` `importSheet` (Sheets çekme — sunucu `server/lib/sheets.mjs`), serbest sayfa API'si `server/routes/free.mjs` (`PATCH /api/workspace/free/:id`, toplu hücre yazımı). Yapı: `POST /api/workspace/free/import {name, matrix, sheetName}` ya da Sheets için `{url, sheet}`. Yetki: sayfa açabilen herkes (bugünkü kural). Test: API (matris → sayfa; 500+ kolon reddi; Sheets sahte ağ) + e2e (dosya seç → sayfa oluşur → hücreler doğru → Alt toplam çalışır).
9. **Ana ekrandaki tahsilat takvimi çek ödenince kaybolmuyor** (müşteri, 30.09.2026; WhatsApp: "çek ödemesi yaklaştı pili, ödemeyi yaptım, kaybolmuyor; programı kapatıp açınca kayboluyor" → "anlık güncellemiyor"). Müşteri "belli aralıklarla yenileme" öneriyor; doğrusu olay tabanlı anlık yenileme (program zaten canlı olay kanalıyla çalışıyor). **Kök neden (koddan):** çek/senet işlemi sunucuda `workspace.changed {kind: "cheques"}` yayınlıyor (`server/routes/cheques.mjs:38`), ama takvim şeridi `client/assets/hof-promises.js:228` yalnız `["dues","activity","cash","records","source","plans"]` türlerinde yenileniyor; `cheques` listede yok → şerit ve pil eskimiş kalıyor. Aynı boşluk bildirim/zil için `hof-alerts.js:585` (yalnız `task`) ve muhtemelen `hof-cheques.js` kendi ekranında. Yapılacak: (a) `cheques` (ve `accounts`, `stock` gibi takvimi etkileyen her tür) şeridin ve zilin yenileme listesine; en iyisi sunucunun takvim değişince tek bir `alerts.refresh`/`dues.changed` olayı yayması, istemcilerin tür listesi tutmaması. (b) Pilden açılan kartta "Tahsilat gir / Ödendi" yapılınca pil hemen düşsün (iyimser kaldırma + yenileme). (c) Yedek: şerit 5 dk'da bir sessiz yenileme (olay kaçarsa). **Tüm kaynaklar için doğrula:** çek tahsil/ödeme, senet, taksit tahsilatı, Kasa ileri tarihli kayıt, tablodaki ödeme sözü "ödendi say", cari tahsilat — her biri şeridi, zili, ANLIK DURUM'u ve Vade takibi sayfa yenilemeden günceller. Test: e2e — pil var → çek "ödendi" → pil 2 sn içinde yok, zil sayısı düşer; API olay yayınını doğrula.
10. **Kullanıcı silme — "Sil" düğmesi** (müşteri, 30.09.2026; Yönetim › Kullanıcılar). **Düzeltme (kullanıcı, 30.09.2026): ✕ simgesi değil; İşlemler sütununda "Parola sıfırla" ve "Oturumları kapat" düğmelerinin yanına aynı biçimde bir "Sil" düğmesi** (kırmızı yazılı/kenarlı tehlike düğmesi, onay penceresiyle). Kendi satırında ve son yöneticide pasif görünür. Bugün silme ucu yok (`server/routes/admin.mjs`: yalnız POST/PATCH/reset/logout; PATCH `active:false` pasifleştiriyor ama arayüzde düğmesi yok). Muhasebe programı kuralı: kullanıcının geçmişi (işlem geçmişi, tahsilat/makbuzu giren, görevler, notlar) kaybolmaz → **yumuşak silme**: hesap kapatılır, oturumları düşer, listeden kalkar, adı eski kayıtlarda "(silinmiş kullanıcı)" ekiyle kalır; kullanıcı adı yeniden kullanılabilir; *Silinenler*'den geri alınabilir. Kendini ve son yöneticiyi silemez; üzerinde açık görev varsa sorar ("görevler kime devredilsin?"). Onay penceresi. Test: API (sil → giriş 401, geçmişte ad duruyor, son yönetici 400) + e2e.
11. **Kullanıcı adını düzeltme — kalem ikonu** (müşteri yanlış yazmış, düzeltememiş): Ad hücresinin yanında ✎ (sitedeki operatör merkezinde olan mantık: kaleme bas → satır içi kutu → Enter kaydeder, Esc vazgeçer). Görünen ad **ve** kullanıcı adı (giriş adı) düzeltilebilsin; kullanıcı adı değişince çakışma denetimi ve kişiye bildirim. Sunucu görünen adı zaten kabul ediyor (`PATCH /api/admin/users/:id {name}`); kullanıcı adı için `username` alanı eklenir (benzersiz, küçük harf, 3–40). Eski kayıtlardaki ad yeni adla görünür (kimlik `id` ile bağlı). Test: API + e2e.
12. **Ayrıntılı yetkiler ve özel roller** (müşteri): (a) *Yeni kullanıcı* ve satırdaki *Ek yetki* açılır bir pil/pencere olsun; içinde **geniş yetki havuzu**, her birinin yanında onay kutusu (✓). Kaynak: `server/lib/permissions.mjs` `PERMISSIONS` (records.create/edit/delete, notes, phones, payments, liens, documents.upload/manage, cash.view/manage, plans.view/collect/manage, accounts.view/collect/manage, stock.view/move/manage, cheques.view/manage, overview.view, tasks.create/complete, messages, reports.view, audit.view, sources.manage, profile.manage, users.manage, system.manage, license.manage) — Türkçe, gruplu (Kayıtlar, Kasa, Cari, Taksit, Stok, Çek/Senet, Raporlar, Görevler, Yönetim), her birinde kısa açıklama. Bugün yalnız tek ek yetki var (`GRANTABLE`: "ANLIK DURUM ve raporlar"). Rolün verdiği yetkiler işaretli ve kilitli görünür; ek olarak işaretlenenler kişiye özel eklenir; **rolün verdiğini kişiden kaldırma** da (yetki çıkarma) desteklensin. Güvenlik: `users.manage`, `system.manage`, `license.manage` yalnız yöneticiye (havuzda görünür ama personele verilemez ya da açık uyarıyla). (b) **Rol listesine kendi rolünü ekleme**: Rol açılır listesinde "+ Yeni rol" → ad + yetki kutuları → kaydet; roller düzenlenir/silinir (kullanan varsa silinmez). Yerleşik 4 rol (Yönetici, Uzman/sektör adı, Personel, Muhasebe) silinemez. Veri: yeni tablo `roles(id, name, permissions_json, builtin)` + `users.grants_json` genişler (`{add:[], remove:[]}`); `canUser` bunları okur; göç yalnız ekleyici. 7. maddeyle birlikte tasarla (ANLIK DURUM kartı yalnız yönetici — havuzda "ANLIK DURUM kartı" ayrı bir kutu olur, varsayılan yalnız yönetici; müşteri kendi isterse açar). Test: yetki matrisi birim testi (her kutu → ilgili API 200/403), özel rol oluştur → kullanıcıya ver → ekranlar/menüler buna göre, e2e.
13. **Yönetim panelindeki "Dosya takip ekranı" düğmesi → "Ana ekran"** (müşteri, 30.09.2026): Yönetim panelinin üst çubuğundaki geri dönüş düğmesinin adı anlaşılmıyor; sektörden bağımsız **"Ana ekran"** olsun (hukuk dışı ofislerde "dosya" kelimesi de yanlış). Yerler: `client/admin.html:21` (düğme) ve `:166` (yetkisiz sayfasındaki "Dosya takip…" metni). Programın başka yerinde aynı ifade kalmasın (kılavuz ve e2e testlerini de tara; e2e düğmeyi metinle arıyorsa güncelle). İsteğe bağlı: düğmeye ev simgesi.
14. **Ana ekran üst alanı: "Dosya özeti" bilgi bloğu kalksın, ANLIK DURUM kartı ortalansın** (kullanıcı, 30.09.2026, ekran görüntüsü): ANLIK DURUM kartının solundaki başlık + açıklama bloğu ("Dosya özeti / 16 kayıt · 16 kolon · … Arayüz bu tablonun kolonlarına göre yeniden oluşturuldu") kaldırılır — içeriği anlamsız bulunuyor. ANLIK DURUM kartı üst alanda ortalanır (tam genişliğe yakın, dört kutu dengeli). Dikkat: (a) "Dışa aktar" düğmesi bu bloğun altında — kaybolmasın, tablo başlığının araç çubuğuna taşınsın; (b) 7. maddeyle ANLIK DURUM yalnız yöneticide olacak → personel ekranında üst alan boş kalmamalı (üst alan hiç çizilmez, özet kartları yukarı kayar); (c) sektör başlığı ("Dosya özeti"/"Öğrenci özeti" vb.) başka yerde kullanılıyorsa (sayfa başlığı değil) kontrol et; (d) kart küçültülmüş (tek satır şerit) hâlde de ortalı.
15. **Tablo arama kutusu belirgin olsun; üstündeki "N kayıt · N kolon" yazısı kalksın** (kullanıcı, 30.09.2026): ortadaki tablonun arama kutusu ("Esas, karşı taraf veya telefon ara…") zeminle aynı renkte, fark edilmiyor → **dolgulu, hafif pastel yeşil** (sitenin/programın yeşil tonlarından, ör. `--do-accent-soft` zemin, ince yeşil kenar, odakta belirgin halka), yeterli karşıtlık; ⌘K/Ctrl+K ipucu ve "Enter · ilk sonuca git" ipucu okunur kalsın. Tablo başlığının altındaki "16 kayıt · 16 kolon" satırı kaldırılır (kayıt sayısı zaten özet kartında). **Kapsam genişledi (kullanıcı, 30.09.2026): arama kutusu programda var olan HER ekranda aynı tasarımda olsun.** Bugün arama kutuları dağınık: ana tablo (`hof-workspace` / `app-*.js`), Cari (`hof-accounts.js`), Taksitler (`hof-plans.js`), Stok (`hof-stock.js`), Çek/Senet (`hof-cheques.js`), Raporlar (`hof-overview.js` Cari ekstre + Vade takip; `hof-report-center.js` "Rapor ara"; `hof-reports.js` Tablo raporları), Tablodan aktar (`hof-plan-transfer.js`), sektör seçici (`hof-insight.js` `.hof-picker-search`), Mesajlar (`hof-chat.js` `.hof-chat-search`), Yönetim paneli (`admin.html`, varsa). Yapı: tek ortak sınıf (ör. `.hof-search` — dolgulu pastel yeşil zemin, ince yeşil kenar, solda büyüteç simgesi, odak halkası, temizle ✕), her ekran bu sınıfı kullanır; ekran özel stiller kaldırılır. Test: e2e'de her ekranda arama kutusu ekran görüntüsü + hesaplanmış stil (zemin rengi) aynı.
16. **Yönetici parolasını unutursa (kullanıcı isteği, 30.09.2026):** üyeliksiz, ücretsiz, internetsiz çözüm.
    (a) Kurtarma anahtarı: kurulumdan sonra ve Yönetim → Kullanıcılar'da "Kurtarma anahtarını oluştur / yazdır";
    tek seferlik, yalnız özeti (hash) saklanır; giriş ekranında "Yönetici parolamı unuttum" → anahtar + yeni parola;
    kullanılınca yenisi üretilir; 5 hatalı deneme 15 dk kilit, işlem geçmişine yazılır, eski oturumlar kapanır.
    (b) Anahtar da kayıpsa: yalnız sunucu bilgisayarından (localhost) istenir; program veri klasörüne 10 dakika
    geçerli tek seferlik kod yazar (Başlat menüsü kısayolu dosyayı açar); ağdan kullanılamaz. (c) Tavsiye: ikinci
    yönetici hesabı. E-posta/SMS ve destekten uzaktan sıfırlama önerilmedi (üyelik, maliyet, güvenlik).
17. **Yönetim menüsü yalnız yöneticide** (kullanıcı isteği): sol menüdeki "Yönetim" ve /admin paneli yalnız yönetici
    rolüne; işlem geçmişi yetkisi olanlar Raporlar → Tüm raporlar → İşlem geçmişi'nden görür.

1. **2.0.2'yi yayımlamak (kullanıcı onayıyla).**
   - Dal `master`'a birleştirilir (PR), ardından *Releases → Draft a new release* → etiket `v2.0.2` (hedef `master`) → *Publish release*. `release.yml` imzalı paketi, kurulum dosyalarını ve kılavuzu ekler; 2.0.1 kurulumlar *Yönetim → Sistem → Güncellemeleri denetle* ile ya da kendiliğinden 2.0.2'ye geçer.
   - Sır yoksa paket yerelde üretilip yayına elle yüklenir (`docs/SURUM-YAYIMLAMA.md` → B). Site deposunda kılavuz PDF'i ve sürüm notları güncellenir.
2. **Pro — uzaktan görüntüleme (kullanıcı 29.09.2026 tarihinde "başla" dedi; çalışılıyor).** Ayrıntılı ve kararlaştırılmış plan: `docs/PRO-UZAKTAN-GORUNTULEME.md` (şifreli özet kopyası Cloudflare R2/Worker/Pages üzerinde, QR ile cihaz eşleme, "Uzaktan bağlanabilir" izni, SMS yok, Pro lisansla açılır, sitede "Pro demo"). Önceki tünel önerisi sunucunun sürekli açık olmasını gerektirdiği için ikinci adıma (telefondan kayıt girme) bırakıldı.
3. **Faz 4 kalanı: alan adı.**
   - `destekofis.net` alınıp Vercel'e bağlanacak.
   - Ardından KVKK veri sorumlusu ve adresi güncellenecek. Şu an "Uğur Çetin, Karatay / Konya / Türkiye".
   - `destek-ofis.vercel.app` açık kalmalı, çünkü program lisans servisine bu adresten bağlanır. Yeni adres bir sonraki sürümde `DEFAULT_LICENSE_SERVICES`'e ikinci adres olarak eklenir.
4. **Faz 4 kalanı: site içerikleri.** Fiyat ve satın alma yolu, video oynatıcı, sürüm notları vb. Kullanıcıyla konuşulacak.
5. **Tanıtım videosu.** Ses kararı bekleniyor.
6. **Ticari hazırlık.**
   - Kod imzalama sertifikası (Windows "tanınmayan uygulama" uyarısı için).
   - Depoyu gizliye alma. Önce demo indirme bağlantısı ve güncelleme kaynağı başka yere taşınmalı.
7. **İsteğe bağlı:** Tabloda uygulamada eklenen yeni kayıtlar şu an sekmenin en üstünde görünür (kullanıcı "alta eklensin" isteğini işlem geçmişi ve kasa için onayladı); istenirse tablo için de değiştirilebilir.

## Kalıcı kurallar

- GitHub'a gönderme ve yayın yalnızca kullanıcının onayıyla yapılır.
- Etiketler zorla taşınmaz.
- Gizli anahtarlar hiçbir depoya, zip'e veya belgeye konmaz. Bu anahtarlar şunlardır:
  - güncelleme imza anahtarı;
  - lisans imza anahtarı;
  - API sırrı;
  - operatör parolası.

  Lisans anahtarı ve API sırrı yalnızca Vercel'in gizli ortam değişkenlerindedir.
- Yeni sürümde kurulum dosyası release'e sürüm numarasız `DestekOfis-Kurulum.exe` adıyla da eklenir.
- Müvekkil verisine erişilmez. Analiz internetsiz yapılır.
- Teslimler: zip ve HTML/PDF rehber; kullanıcıya teknik olmayan dille anlatılır.

---

## EK — 2.4.4 KOD HARİTALARI (21.10.2026; 9 salt okuma ajanı, ~3,6 M token; dosya:satır 21.10 kodu = master 163dd5d)
Kaynak: oturum not defteri hakimiyet-244/ (AYNEN taşındı; başlıklar 3 düzey indirildi). Kod değiştikçe satır numaraları kayar — kullanmadan önce koddan doğrula.

### EK-0 Yapılandırılmış özet (bütün alanlar: mimari, değişmezler, maddeler, sürprizler, sorular)

```text
######## ebelge-sunucu
MİMARİ: e-Belge çekirdeği üç katmanlı. En üstte iş kuralları routes/invoices.mjs'te: numara, kronoloji, Gönderilecekler, belirsiz gönderim ve iptal. Ortada tek arayüzlü bağdaştırıcı var: lib/einvoice/adapters.mjs connect() (adapters.mjs:52-96). En altta yalnız EFaturaEDM.svc'ye bağlanan EDM istemcisi duruyor: createEdmClient (edm.mjs:127-476). İstemci WSDL'i soap-contract.mjs ile okuyor (readWsdl :20, shape :154). Sözleşmede olmayan zorunlu alan varsa istek hiç gönderilmiyor (edm.mjs:215). Hatalar iki sınıfa ayrılıyor: 'integrator-unreachable' bağlantının hiç kurulamadığı, isteğin kesin ulaşmadığı durum; 'integrator-uncertain' isteğin EDM'ye ulaşmış olabileceği durum (edm.mjs:134-167). Yan etkisiz işlemler bir kez yineleniyor (SAFE_OPERATIONS edm.mjs:35). Oturum base|kullanıcı|parola-özeti anahtarıyla bellekte tutuluyor ve hiç Logout yapılmıyor (edm.mjs:132, 256-316). Numara her zaman işlem içinde veriliyor: kayıtta writeIssued (invoices.mjs:1838-1896; assertChronology :1678, olderPending :3242), gönderimde numberForSend (:3284-3313). Seri kilidi bank.post/store.tx BEGIN IMMEDIATE ile sağlanıyor. Giriş ve erişim numaradan önce deneniyor (sendLoginBlock :3262, sendInvoiceOnce :3421-3445). Kesin ulaşmayan istekte numara geri bırakılıyor (releaseNumber :3117). Ulaşmış olabilecek istekte belge 'Sonucu Belirsiz' oluyor (uncertainSend :68, :3489-3521). Tümünü Gönder (/send-pending :3637-3831) Gönderilecekler'i (unsentSql :1196) tarih, saat, kayıt anı ve rowid sırasıyla 20'lik parçalar ve 10 sn bütçeyle imleçle gönderiyor. Kalıcı engelliler (sendBlockOf :3145, buyerBlockOf :3227) diğer belgeleri bekletmiyor, geçici nedenle kalan eski belge aynı serinin yenilerini bekletiyor (held :3814). e-Arşiv iptali önce durum soruyor, sonra 8 gün kuralını uyguluyor (cancelInvoiceOnce :2868-2940, :2893). UBL'yi saf fonksiyon buildUbl üretiyor (ubl-tr.mjs:130-255); stopaj bugün yalnız not olarak yazılıyor (:157). Karekod e-SMM'ye basılmıyor (karekod.mjs:20). Bayraklar config.mjs:73-88'de, üretim girişi server/server.mjs:9 (edocEnabled + edocLive açık, esmmEnabled kapalı). Kilit bulgu: INVOICE_KINDS.smm.send=false (invoice-math.mjs:40). Bu yüzden e-SMM, gönderim akışının hiçbir kapısından geçemiyor (invoices.mjs:654, 992-1000, 1197, 1842, 1846, 2308, 3258, 3979).
DEĞİŞMEZLER:
- Numara yalnız işlem içinde verilir (bank.post/store.tx, BEGIN IMMEDIATE); aynı seri+yılda numara sırası tarih sırasıdır: assertChronology invoices.mjs:1678, numberForSend :3290-3299, sendBlockOf :3153; aynı gün sırayı bozmaz (katı <).
- Ağ yokken numara verilmez: EDM girişi ve erişimi numaradan ÖNCE denenir (invoices.mjs:3262-3277, :3435-3443); numara verildikten sonra istek kesin ulaşmadıysa ve numara serinin sonuysa geri bırakılır (releaseNumber :3117-3141).
- İsteği EDM'ye ulaşmış olabilecek hata 'belirsiz'dir (e_status none + e_adapter); belirsiz belge silinmez, düzenlenmez, iptal edilmez, yeniden gönderilmez; önce Durum Sorgula (invoices.mjs:68, :757, :2712, :2885, :3465-3473).
- Yan etkili EDM çağrıları (SendInvoice/LoadInvoice/CancelInvoice) yinelenmez; yalnız SAFE_OPERATIONS kopan bağlantıda bir kez yinelenir (edm.mjs:33-35, :144-147).
- Tümünü Gönder eskiden yeniye gider (sendOrder: tarih, saat, kayıt anı, rowid; invoices.mjs:3628). Geçici nedenle gönderilemeyen eski belge aynı serinin yenilerini bekletir (held :3814). Kalıcı engelli belge bekletmez (PERMANENT_SEND_CODES :3172). Bağlantı/hesap hatası turu durdurur, kalanlara numara verilmez (TURN_STOP_CODES :3174, :3816-3819).
- Belge başına tek entegratör işlemi: gönderim/iptal/düzenle/sil aynı bellek içi kilide bakar (busy, holdInvoice invoices.mjs:2842-2859).
- Canlı kilit: canlı açılmadan ya da Servis Adresi test dışıyken ağa çıkılmaz; ortam ile adres uyuşmalıdır (invoices.mjs:303-310, :474-478; adapters.mjs testOnlyUrl :44).
- Entegratör parolası istemciye ve günlüğe hiç çıkmaz (publicSettings invoices.mjs:449-454 hasPassword; audit :2349).
- Sözleşmede (WSDL) bulunmayan zorunlu alan gönderilmez; uyuşmazlıkta istek hiç yapılmaz (soap-contract.mjs shape :154, edm.mjs:215).
- Test ortamına giden e-Belge TEF/TEA/TES serisinden numara alır; firma bu serileri seçemez; test serili belge canlıda gönderilmez (invoices.mjs:80, :244-245, :656, :3427-3428, :3452).

[E1] para=True 14sa
  DOKUNMA: server/lib/invoice-math.mjs:40 (INVOICE_KINDS.smm.send=false) | server/routes/invoices.mjs:654,992,995,997,1000,1197,1842,1846,2308,3258,3979 (kind.send kapıları) | server/lib/einvoice/edm.mjs:26-31 (EDM_URLS, EDM_DEFAULT_NS=i2i, EDM_OPERATIONS), :35 SAFE_OPERATIONS, :65-101 EDM_STATES/mapEdmStatus, :105 assertChannel, :212-240 call (defaultNs sabit :214), :311 ensureSession, :353-466 işlemler | server/lib/einvoice/adapters.mjs:40 integratorUrl, :52-96 connect (tek istemci, earchive :69, cancel :88-91, ensureSession :76) | server/lib/einvoice/ubl-tr.mjs:130-255 buildUbl (stopaj yalnız Not :157; TaxTotal :206; LegalMonetaryTotal :215-216; satırlar :217-240; Signature :190) | server/routes/invoices.mjs:430-435 ublFor (XSLT/karekod), :1231-1262 allowedProfiles/profileFor, :1640-1646 seriesFor, :2878 remoteEligible, :2893 8 gün, :3272 ve :3438 ensureSession argümansız, :3317-3330 preflight, :3886 integrator/test, :72 remoteMissing 11017 | server/lib/config.mjs:85 esmmEnabled; server/server.mjs:9 createApp bayrakları | server/lib/einvoice/karekod.mjs:20 OTHER_PROFILES (ESMM'ye karekod yok)
  ÖNERİ: 1) Tek yardımcı: sendKind(kind) = INVOICE_KINDS[kind].send || (kind==='smm' && esmmEnabled). On bir kapının hepsi buna geçer; INVOICE_KINDS değişmez, yoksa bayrak kapalıyken 2.4.0'dan kalan ESMM makbuzları Gönderilecekler'e düşer. 2) edm.mjs ortak parçaları (http sınıflaması, loadContract, call, header, login, withSession, ensureSession) servisle parametrelenir; e-SMM için defaultNs http://tempuri.org/ olur. e-SMM'ye özgü: EDM_SMM_URLS test …/ESmmEDM.svc, live boş; işlemler SendSMMPrepared (UBL yolu; SMM.ID/UUID nitelik değil ÇOCUK öğe, CONTENT base64, HEADER SENDER/RECEIVER/FROM=GB/TO=e-posta), GetSMMStatus (yanıt SMM_STATUS), GetSMM PDF, CancelSMM; SAFE_OPERATIONS'a GetSMMStatus/GetSMM/MarkSMM eklenir. 3) mapEdmStatus e-SMM metinleri: LOAD-FAIL→error; PACKAGE-FAIL→error + 'iptal edip yeniden gönderin' (xlsx); SEND-SUCCEED→sent son durum; accepted/rejected yok. 4) adapters.connect iki istemci tutar; send/status/cancel/officialPdf/ensureSession profile==='ESMM' ile yönlenir; ensureSession belge/profil alır (invoices.mjs:3272, :3438). 5) buildUbl'a ESMM dalı (EDM örneği + Ek_bilgi): TaxSubtotal 0003 stopaj + 0015 KDV; LineExtension=brüt, TaxExclusive=brüt−stopaj, TaxInclusive=KDV tutarı, Payable=net alınan; satır stopajı kuruşu kuruşuna dağıtılır. ublFor ESMM'de kendi XSLT'mizi gömmez. 6) Numarayı PROGRAM verir (TES test / ESM canlı; mevcut kronoloji, releaseNumber ve 11048 güvenceleri). 7) remoteEligible ESMM'yi kapsar; e-SMM portal taslağı 2.4.4'te kapalı (canDraft false). integrator/test e-SMM girişini de dener. 8) Açma: server.mjs'e esmmEnabled:true, canlı e-SMM adresi EDM'den gelene dek ayrı kilit (esmmLive).
  TEST: Yeni: tools/ebelge/sema/edm/ESmmEDM-test-singleWsdl.xml (KAYNAK.md sha256) + test/esmm-gercek-sozlesme.test.mjs (işlem adları, tempuri ad alanı, SMM ID/UUID öğe mi, GetSMMStatusRequest biçimi) — kâhin gerçek WSDL | Güncelle: test/esmm-gizli-241.test.mjs (bayrak açıkken gönderilebilir), test/kontrol-241.test.mjs (2.4.0 ESMM verisi), test/edoc-uretim.test.mjs (server.mjs düzenli ifadesi kırılır), test/einvoice-mock.mjs (SMM işlemleri), test/einvoice-edm.test.mjs | Yeni uçtan uca sahte EDM: kaydet → Gönderilecekler → gönder (numara gönderimde) → durum → resmî PDF → iptal; kronoloji; belirsiz gönderim; ulaşılamaz + releaseNumber; 11048; ensureSession doğru servise; ders 30 lisans adresi | UBL ESMM: satır stopaj dağıtımı Σ satır = belge (kuruş), XSD (test/ebelge-uygunluk), GİB e-SMM kâhini (kılavuz depoda yok) | Mutasyon: sendKind kapısı, stopaj dağıtımı, ensureSession yönlendirmesi; bağımsız kâhin test/bagimsiz/ebelge/model.py'ye esmm türü AYRI elden (ders 5); dar kontrol (ders 32) | Gerçek EDM test hesabında: TES numarası kabulü, durum geçişleri, PDF, iptal, 'bulunamadı' kodu
  RİSK: Canlı ESmmEDM adresi belgelerde yok (DOĞRULANMADI); üretimde edocLive açık → bayrak açılınca canlı firma teyitsiz adrese yasal makbuz gönderebilir | ESmmEDM WSDL depoda yok: SMM ID/UUID ve GetSMMStatusRequest nitelik/öğe biçimi yanlış olursa shape yakalamaz (nitelikler denetlenmez) → sessizce 'bulunamadı' | e-SMM 'bulunamadı' kodu 11017 değilse belirsiz e-SMM e-refresh/iptalde hiç temizlenemez (invoices.mjs:72, :2917, :3855) | ensureSession yönlendirilmezse e-SMM'de 'giriş başarılı olmadan numara verilmez' güvencesi kırılır | Satır stopaj dağıtımı ve EDM'nin alışılmadık LegalMonetaryTotal anlamı (TaxInclusive=KDV) yanlış kurulursa EDM/GİB reddi ve numara kaybı | 2.4.0'dan kalan numaralı ESMM makbuzları bayrak açılınca Gönderilecekler'e düşer | Kâğıt SMM ↔ e-SMM 'Müşteri Fişi Olarak Bırak' (withdraw FIS serisi :3536) yasal açıdan e-Arşivle aynı soru | EDM'nin programın verdiği numarayı kabulü DOĞRULANMADI (seri tanımı isteyebilir)

[E4] para=True 2sa
  DOKUNMA: server/routes/invoices.mjs:2893 (daysBetween(issueDate, today()) > 8 → 409 einvoice-cancel-late) | server/routes/invoices.mjs:2287 daysBetween (UTC gece yarısı farkı), :155 today() (yerel) | server/routes/invoices.mjs:2878 remoteEligible, :2880-2887 localOnly bypass | test/bagimsiz/ebelge/model.py:464-482, test/bagimsiz/ebelge/KARARLAR.md K22/K23
  ÖNERİ: Kod değişmeden önce mali müşavir kararı (açık soru). Bugün kesim günü 0 sayılıyor ve 0..8. günde EDM iptali yapılıyor, 9. gün red veriliyor; ileti 'kesildikten 8 gün sonra iptal edilemez' diyor ama 8. gün iptal edilebiliyor, metin bu yüzden muğlak. Kâhinle fark: K22 yalnız yaş ≤ 7'yi kesin kabul sayıyor, 8. gün çatala (red ya da iptal) düşüyor; bu yüzden fark görünmüyor. Aynı modelin ağ-yok dalı ise yaş ≤ 8'i sınırın içi sayıyor (:476); kâhin kendi içinde 7/8 belirsiz. Karar gelince: kural tek sabitte toplanır, ileti sınır günüyle yazılır, e-SMM için ayrı karar verilir (EDM kılavuzunda süre yok).
  TEST: YENİ (bugün hiç yok): sahte saatle (config.now) 7/8/9. gün sınırı + ay sonu/yıl dönümü; gönderilmiş e-Arşiv; eski kodda kırmızı kanıt | localOnly ile 8 günden eski gönderilmiş e-Arşivin API'den yalnız programda iptali — davranış kararı netleşince sabitlenir | Kâhin K22/K23 7–8 tutarlılığı ayrı elden düzeltilir (ders 5)
  RİSK: Sınır günü yanlış yorumlanırsa GİB'de geçerli belge programda iptal ya da tersi | localOnly yolu remoteEligible belgede 8 gün denetimini atlıyor (remote false); ekran göstermese de API izin veriyor

[E5] para=False 2sa
  DOKUNMA: server/routes/invoices.mjs:296-326 settingsInput integrator (username :311 limited→trim, parola :313-317 kırpılmaz) | server/lib/http.mjs:192 text() trim, :194 limited | server/routes/invoices.mjs:469-483 integrator() (eski kayıt için ağ öncesi denetim yeri) | server/routes/invoices.mjs:3174 TURN_STOP_CODES, :3262-3278 sendLoginBlock (integrator() hatasını yutar :3267-3270) | server/lib/einvoice/edm.mjs:130 integrator-credentials, :255-264 LOGIN_HINT
  ÖNERİ: Kullanıcı adı zaten baştan ve sondan kırpılıyor; parola kırpılmamalı (boşluk geçerli olabilir; EDM kuralı DOĞRULANMADI). (a) settingsInput'ta username /:\/\/|^www\.|\.svc(\b|$)/i ise 400 'integrator-username-url', field 'integrator.username', kayıt yok. (b) Eski kayıtta kalmış değer için integrator() ağa çıkmadan 409 aynı kod; ardışık hatalı giriş EDM hesabını kilitleyebilir. (c) Kod TURN_STOP_CODES'a eklenir, böylece toplu tur ilk belgede durur. (d) İsteğe bağlı: sendLoginBlock bu kodu numarasız beklemeye (integrator-login hold) çevirir; bugün not-configured gibi belge kayıtta numara alıp gönderilmemiş kalıyor. Bu madde para-numara çekirdeğidir, dar kontrol ister. 'Kayıtlı parola gösterilmez' metni istemci işi; sunucu hasPassword (:453) yeterli.
  TEST: PUT /invoices/settings URL'li kullanıcı adı → 400, ayar değişmez (eski kodda kırmızı) | Eski kayıtta URL'li kullanıcı adı: /send, /integrator/test, /send-pending → 409; sahte EDM'ye Login gitmez (mock calls) | Tümünü Gönder ilk belgede durur, kalanlara numara verilmez | Kırpma: '  kullanici  ' → 'kullanici' (var olan davranış sabitlenir)
  RİSK: Meşru 'http' içeren kullanıcı adı yanlış reddedilmesin (desen yalnız ://, www., .svc) | sendLoginBlock değişirse kayıtta numara verme yolu değişir (ders 32)

[E6] para=True 5sa
  DOKUNMA: server/routes/invoices.mjs:3637-3831 POST /send-pending (all dalı :3658-3688, ids dalı :3689-3697, outside :3701-3709, outside atlama :3767-3770, SEND_TURN/SEND_CHUNK :3626-3627, bütçe :3746) | server/routes/invoices.mjs:1196-1204 unsentSql, :3628 sendOrder, :3145 sendBlockOf, :3227 buyerBlockOf, :3284-3313 numberForSend (olderPending :3298 asıl güvence), :2842 busy | client/assets/hof-invoices.js:2777-2796 sendPending (SEND_PENDING_TIMEOUT_MS 150 sn; all+after döngüsü) | test/bagimsiz/ebelge/kosucu.mjs:275 ({ids} 'secili' kâhin)
  ÖNERİ: Sunucuda seçili kimlik yolu ({ids}) ZATEN var ama üç eksiği var: parçalanmıyor ve süre bütçesi yok (200 belge 150 sn'yi aşabilir); kimlikleri unsentSql ile süzmüyor (gönderilmiş seçili belgeye 'başka oturumda gönderildi' diyor); seçilmemiş daha eski bekleyeni gönderim SIRASINDA 'outside' diye atlıyor, yani yarım tur dönüyor. Öneri: yeni gövde { all:true, only:[…], after? } Tümünü Gönder'in AYNI dalına girer (SQL :3661'e AND i.id IN json_each). Böylece sıra, imleç, held, parça/bütçe, durdurma, belirsiz-önce-sor ve seri kilidi birebir aynı olur. İlk istekte (after yokken), hiçbir şey göndermeden ön denetim yapılır: seçilileri bekletecek, kalıcı engelsiz, seçilmemiş waiting belgeler (aynı seri|yıl, tarih < o serideki seçili en yeni) varsa ve onay yoksa 409 'einvoice-selection-older' döner {count, older:[id, displayNo, issueDate, accountName, series]}. İstemci 'Onları da Ekle / Vazgeç' sorar. Gönderilecekler dışı kimlikler ayrı 'notPending' listesinde döner. Eski {ids} biçimi testler ve kâhin için kalır.
  TEST: Kırmızı: seçilmemiş eski bekleyen varken yeni seçili belge → 409 ön denetim, EDM'ye istek yok, numara yok (eski kodda skipped/outside) | 'Onları da ekle' → numaralar tarih sırasıyla; aynı gün sırayı bozmaz; kalıcı engelli eski belge engel sayılmaz | >20 seçim: parça + imleç + remaining; ağ yok → tur durur, numara yok; iki oturum aynı anda (busy/done) | Seçimde gönderilmiş belge → notPending (done değil) | Var olan: test/ebelge-243-gonderim.test.mjs, test/gg243-gonderim.test.mjs (S2 komşu), test/gg243-dar-kontrol-gonderim.test.mjs yeşil kalmalı | Mutasyon (ön denetim kaldırılınca kırmızı) + kâhin K10'a ön denetim AYRI elden + dar kontrol (ders 32)
  RİSK: Ön denetim ile gönderim arası yarış: başka oturum araya eski tarihli belge koyabilir; güvence yine numberForSend/olderPending (einvoice-order) — kalmalı | only listesi çok büyükse json_each sorgusu; 5000 sınırı | Eski {ids} davranışını değiştirmek kâhin koşucusunu (kosucu.mjs:275) bozar — değiştirilmemeli

[UX15] para=False 2sa
  DOKUNMA: server/routes/invoices.mjs:2463-2498 POST /calc (nextNumber :2490, blockers :2492, aliasBlock :2496) | server/routes/invoices.mjs:1678-1681 assertChronology, :1878-1884 'later' dalı aynı koşul, :1889 olderPending/orderHeld, :788-802 düzenleme kuralı (önceki/sonraki) | client/assets/hof-invoices.js:1614 (existingId yalnız iadede), :2154-2157 (blockers + 'X numarasıyla' onayı)
  ÖNERİ: Tek fonksiyon numberingChronology(doc) yazılır (seri seriesFor ya da iç seri; last = seq>0 ORDER BY seq DESC; last.issueDate > doc.date → ileti). assertChronology, later dalı ve /calc AYNI fonksiyonu kullanır. /calc yanıtına chronology:'<ileti>' eklenir (doluysa nextNumber boş döner); istemci bunu blockers'a ekler. İsteğe bağlı: olderPending>0 ise orderHold:{count,text}; onay numara göstermez, 'numarasız Gönderilecekler'e eklenecek' der. /calc düzenleme kipini bilmediği için düzenlemede istemci bu alanı yok sayar ya da existingId her düzenlemede gönderilip edit kuralı aynı yerden verilir. Asıl güvence işlem içindeki denetim olarak kalır.
  TEST: Geriye tarihli yeni belge: calc.chronology dolu, nextNumber boş; kayıt 400 chronology aynı ileti (eski kodda calc'ta alan yok → kırmızı) | Aynı gün → boş; FIS, SMM ve iç seri; 'Kes, Sonra Gönder' aynı kural | orderHold: daha eski numarasız bekleyen varken calc sayısı ile kayıttaki orderHeld aynı | Düzenleme formu calc'ı yanlış engel üretmez
  RİSK: Kural kopyalanırsa (calc ↔ writeIssued) ayrışma; tek fonksiyon şart | Düzenleme kipinde yanlış engel

[UX20] para=False 1sa
  DOKUNMA: server/routes/invoices.mjs:2536-2546 POST /invoices (loginHold → loginHoldResult) | server/routes/invoices.mjs:3279-3282 loginHoldResult {ok:false,pending:true,held:true,code:'integrator-unreachable',number:''} | server/routes/invoices.mjs:508 displayNo (numarasız beklemede 'Gönderilecek') | server/routes/invoices.mjs:3598-3604 unsentResult (numaralı + kopma yolu) | client/assets/hof-invoices.js:2184 (başarı 'X Gönderilecek kaydedildi.'), :2190-2192 (held hata bildirimi)
  ÖNERİ: Sunucu değişikliği GEREKMEZ: autoSend.held/pending/code iki durumu ayırt etmeye yetiyor. Çift bildirim istemcide oluşuyor: önce displayNo='Gönderilecek' ile başarı bildirimi, sonra held hatası. Düzeltme istemcide: held ise tek bildirim, numara yoksa displayNo basılmaz. Numara verildikten sonra kopma (unsentResult) ayrı yol; orada iki bilgi (kaydedildi + gönderilemedi) anlamlı.
  TEST: e2e: EDM ulaşılamaz + Kaydet ve Gönder → tek bildirim, 'Gönderilecek' sözcüğü numara yerinde yok (b33 senaryosu) | Birim: POST /invoices yanıtında autoSend.held=true, number=''
  RİSK: displayNo'yu sunucuda değiştirmek listede/PDF'te 'Gönderilecek' gösterimini bozar — sunucuya dokunulmamalı
SÜRPRİZ:
- e-SMM bayrak açık olsa da gönderilemez: INVOICE_KINDS.smm.send=false (invoice-math.mjs:40) ve on bir e-Belge kapısı (invoices.mjs:654, 992, 995, 997, 1000, 1197, 1842, 1846, 2308, 3258, 3979) bu bayrağa bakıyor; esmm-gizli-241 testi 'TES numarası kayıtta verilir, gönderilmez' davranışını sabitliyor.
- EDM_DEFAULT_NS = i2i (edm.mjs:30) gerçek EDM ad alanıyla (tempuri.org; tools/ebelge/sema/edm WSDL'i ve e-SMM örnekleri) uyuşmuyor: WSDL okunamazsa varsayılan sözleşmeyle giden istek büyük olasılıkla reddedilir — e-Fatura için de.
- e-SMM'de SMM.ID/UUID ÇOCUK öğe (Request-Response örneği); e-Fatura'da INVOICE ID/UUID nitelik (edm.mjs:357). soap-contract shape nitelikleri denetlemiyor; yanlış biçim yakalanmaz.
- ensureSession argümansız çağrılıyor (invoices.mjs:3272, :3438); e-SMM eklenince yönlendirilmezse 'giriş başarılı olmadan numara verilmez' güvencesi e-SMM için yanlış servise bakar.
- e-Arşiv 8 gün kuralını (invoices.mjs:2893) sınayan hiçbir test yok (einvoice-cancel-late depoda hiçbir testte geçmiyor).
- Kâhin K22 'yaş ≤ 7' kesin kabul ediyor, ağ-yok dalı 'yaş ≤ 8'i sınır içi sayıyor (model.py:465, :476): kâhin 7/8. gün konusunda kendi içinde tutarsız; program 8. günü kabul ediyor, fark çatal yüzünden görünmüyor.
- localOnly iptal yolu gönderilmiş e-Arşivde de 8 gün denetimini atlıyor (invoices.mjs:2880-2890); ekran bu yolu yalnız belirsiz/taslakta gösteriyor ama API izin veriyor.
- Seçili kimlikli /send-pending yolu zaten var ({ids}, invoices.mjs:3689-3697) ama parçalanmıyor ve süre bütçesi yok (200 belge 150 sn istemci zaman aşımını aşabilir); kimlikleri Gönderilecekler'e göre süzmüyor (gönderilmiş seçili belgeye 'başka oturumda gönderildi' diyor :3794-3797).
- UX20'nin kaynağı sunucu değil: numarasız bekleyen belgede displayNo 'Gönderilecek' dönüyor (invoices.mjs:508), istemci bunu numara yerine basıyor (hof-invoices.js:2184).
- e-SMM 'PACKAGE - FAIL' için EDM 'iptal edip yeniden gönder' diyor; e-Fatura eşlemesi (edm.mjs:67-68) 'aynı numarayla yeniden gönderin' diyor.
- EDM'nin C# NESNE örneği sayısal olarak tutarsız (net > brüt); UBL örneği ve Request-Response SMM_LINE_ITEMS örneği ise kendi içinde tutarlı (KDV ve stopaj brütten).
- GİB e-Fatura paketi şematronu ESMM profilini tanımıyor (UBL-TR_Codelist.xml:5-6); e-SMM kâhini için GİB e-SMM kılavuzu/paketi depoda yok.
- Kullanıcı adı sunucuda zaten kırpılıyor (limited → text().trim, http.mjs:192); E5'in 'kırpma' kısmı sunucu için yapılmış, yalnız URL denetimi eksik.
SORU:
- Canlı e-SMM uç noktası adresi nedir (EDM teyidi)? O gelene kadar e-SMM canlıyı ayrı bayrakla (esmmLive) kilitli tutalım mı?
- EDM test hesabı programın verdiği TES numarasını (ID) kabul ediyor mu, yoksa e-SMM serisi EDM portalında tanımlanmalı mı?
- e-SMM'de 'belge bulunamadı' hata kodu 11017 ile aynı mı? Numara mükerrer kodu 11048 karşılığı ne?
- e-SMM iptal süresi var mı (e-Arşiv 8 gün kuralı e-SMM'ye uygulanacak mı)? Mali müşavir kararı.
- e-Arşiv iptal sınırı: 8. gün dahil mi (bugün dahil), yoksa 7. gün mü (kâhin K22)? İleti metni sınır günüyle yazılsın mı?
- API'deki localOnly yolu 8 günden eski gönderilmiş e-Arşivi yalnız programda iptal edebiliyor: bilinçli mi, yalnız belirsiz/taslak/ulaşılamaz durumla sınırlansın mı?
- 2.4.0'dan kalan numaralı ESMM makbuzları (TES/ESM, gönderilmemiş) e-SMM açılınca Gönderilecekler'de görünsün ve gönderilsin mi?
- e-SMM UBL'de cac:Signature ve SendingType yazılsın mı (EDM örneğinde yok)? EDM, gömülü XSLT olmadan kendi e-SMM şablonunu uyguluyor mu?
- e-SMM'de KDV tevkifatı nasıl yazılıyor (WithholdingTaxTotal mı, NESNE'deki WITHHOLDING_TAX_*'ın UBL karşılığı mı)? Fatura tipi TEVKIFAT mı SATIS mı?
- e-SMM alıcısına e-posta (HEADER.TO) zorunlu mu? E-postasız makbuz KAGIT gibi teslim mi edilir?
- Seçilenleri Gönder ön denetimi: 409 + 'Onları da Ekle' akışı mı, yoksa ayrı salt-okuma denetim ucu mu tercih edilsin?

######## fatura-istemci
MİMARİ: Fatura istemcisi tek dosyada, tek IIFE olarak yazılmış: client/assets/hof-invoices.js (3528 satır). Dışarıya açtığı nesne HOF.invoices (3475). Bütün durum tek bir view nesnesinde tutuluyor (21); mod list, pick, form, card, settings, inbox ya da inbox-item olabilir. meta, /api/workspace/invoices/meta ucundan bir kez yükleniyor (72–77; sunucu invoices.mjs:2303–2332). Pencere HOF.modal ile açılıyor; başlık "Fatura" çekirdekte <h2> olarak çiziliyor (hof-core.js:920). Kaydırılan öğe pencerenin kendisi (.hof-modal overflow:auto, hof-ui.css:366–371). Liste görünümünü renderList (258–314) çiziyor. Üst satırda Liste - PDF/Excel (293), Tümünü Gönder (291) ve Entegratör Ayarları (292) var. Seçim çubuğu 306'da: PDF, Excel, XML, Kaydet, İptal ve Sil düğmeleri var, gönder düğmesi yok. Form startForm (525) ile açılıp renderForm (627–699) ile çiziliyor. Toplamlar yalnız sunucunun /calc ucundan geliyor (calcOnce 1591–1638, sunucu invoices.mjs:2463–2498). Düğmeleri formActions/sendable (2096–2097) belirliyor. Kayıt submitForm (2098–2212) ile yapılıyor: önce blockers denetleniyor (2154), sonra onay soruluyor, istek kimliğiyle gönderiliyor ve autoSend bildirimleri gösteriliyor (2183–2192). Kartı renderCard (2299–2389) çiziyor; Düzenle, İptal, Sil, Tahsilat Ekle (payForm 2427) ve e-Belge araçları burada. Tümünü Gönder (sendPending 2774–2856) sunucuya { all, after: cursor } ile istek atıyor. Sırayı istemci değil sunucu belirliyor (sendOrder invoices.mjs:3628). Uçuşta tek istek olabiliyor (view.sendProgress), zaman aşımı 150 sn. Entegratör Ayarları ayrı bir pencere (showIntegrator 3126–3342). Parola istemciye hiç gelmiyor; yalnız hasPassword geliyor (invoices.mjs:449–454). Göster düğmesi yalnız yazılan değeri gösteriyor (HOF.toggleSecret, hof-core.js:1261). Fatura CSS'i hof-ui.css:9788–10002 aralığında; kalem Kod hücresi 118px (9856).
DEĞİŞMEZLER:
- Toplamlar istemcide hesaplanmaz; form.calc sunucunun /calc'ından gelir (hof-invoices.js:1614). İstemci yalnız 'Kalan' gösterimini hesaplar (1101–1104).
- Kayıt ekranda görünenle yapılır: önce payPending ve flushCalc biter (2115–2124).
- Her form tek requestId taşır (537, 2142, 2182); yinelenen Kaydet ikinci belge açmaz.
- Ödeme satırları hesap dönünce yeniden çizilmez; yalnız renderRest çalışır (1470–1488, 2.0.23 Bulgu 1).
- Blocker (kesin red nedeni) varken numaralı onay penceresi açılmaz (2154–2155; sunucu issueBlockers invoices.mjs:1832–1835).
- Kâğıt belgede 'Kaydet ve Gönder' yok; düğmeler yalnız gönderilebilirlik değişince yeniden çizilir (1649, 2096).
- e-Belge numarasını ve sırasını sunucu verir. İstemci yalnız {all,after} imlecini taşır (2796; invoices.mjs:3628).
- Tümünü Gönder'de uçuşta tek istek olur, ikinci tur açılmaz (view.sendProgress 2775/2779). İstemci zaman aşımı hata sayılmaz (2816–2817).
- Parola istemciye hiç gelmez (invoices.mjs:449–454); parola alanı boş durur ve 'Kayıtlı' yazar (3157).
- Canlı yenileme kullanıcıyı yerinden etmez (loadDoc quiet 2250/2254).
- Ekranda görünen adlar yazım düzenine uyar (server/lib/text-case.mjs; test/yazim-duzeni.test.mjs client/assets/*.js'yi tarar).
- edoc() false iken e-Belge düğmesi ve sekmesi görünmez (28, 265, 292, 302).
- Esc önce açık öneri listesini kapatır (1858–1861).

[E5] para=False 2.5sa
  DOKUNMA: client/assets/hof-invoices.js:3156 (kullanıcı adı girişi) | client/assets/hof-invoices.js:3157 (parola + Göster + 'kayıtlı parola gösterilmez' metni zaten var) | client/assets/hof-invoices.js:3271-3276 (Göster işleyicisi → HOF.toggleSecret hof-core.js:1261-1272) | client/assets/hof-invoices.js:3284-3303 (Kaydet) | client/assets/hof-invoices.js:3102-3108 (integratorStatus) | server/routes/invoices.mjs:311 (username limited → trim zaten var: server/lib/http.mjs:192-198)
  ÖNERİ: Sunucuda tek kaynak bir kural: URL kalıbı (^https?://, .svc, //) görülünce fail400 code 'integrator-username-url', alan 'integrator.username'. İstemci Kaydet'te aynı denetimi istek göndermeden yapar, iletiyi form satırına yazar ve odağı kullanıcı adına verir. Kayıtlı kullanıcı adı URL'yse integratorStatus uyarı gösterir (bu, kullanıcının kendi kurulumundaki eski veri için). Alan boşken ve parola kayıtlıyken Göster yazıyı açmaz, 'Kayıtlı parola güvenlik için gösterilmez; Göster yalnız şimdi yazdığınızı gösterir' notunu öne çıkarır. Kırpma kullanıcı adında zaten sunucuda yapılıyor; parola kırpılmaz.
  TEST: Birim (yeni, sunucu): URL'li kullanıcı adı 400 integrator-username-url döner; '  edm  ' 'edm' olarak kaydedilir; eski kodda kırmızı | e2e senaryo-entegrator-240'a adım: URL yaz → Kaydet → settings PUT isteği yok, ileti var, odak kullanıcı adında; kayıttan sonra boş alanda Göster'e basılır → not görünür, tip değişmez | Var olan adım 2 (113-133) değişmeden koşulur
  RİSK: İleti istemci ve sunucuda iki kopya olursa ayrışır; metin sunucudan gelsin | Kaydet hatası bugün iki yerde görünüyor (3297-3298: form satırı + toastError) | Parola kırpmak meşru boşluklu parolayı bozar; yalnız uyarı önerilir

[E6] para=True 8sa
  DOKUNMA: client/assets/hof-invoices.js:306 (seçim çubuğu) | client/assets/hof-invoices.js:316 (selectedBy), 427-440 (onCheck) | client/assets/hof-invoices.js:2754-2856 (pendingTotal, sendPendingButton, showSendProgress, SEND_PENDING_TIMEOUT_MS, sendPending döngüsü ve özet) | client/assets/hof-invoices.js:398-426 (eylem dağıtımı; yeni data-act) | server/routes/invoices.mjs:3624-3716 (send-pending: {ids} yolu ve 'outside' kuralı var ama parçalamıyor, eski belgeyi gönderimden sonra söylüyor) | server/routes/invoices.mjs:698-704 (satırda eStatus/eUnsent: bekleyen satırı tanımak için)
  ÖNERİ: Sunucuda Tümünü Gönder ile aynı yol: { all:true, only:[ids], after } kipi açılır; aynı imleç, aynı 20 belge / 10 sn bütçesi, 'outside' denetimi bu kipte de çalışır. Yanına bir kuru denetim kipi eklenir: { only, check:true } numara vermez, EDM'ye gitmez, seri başına 'daha eski seçilmemiş bekleyen' sayısını ve en eski belgeyi döner. İstemcide selectedPending (issued ve waiting|eUnsent) sayılır; 'Seçilenleri Gönder (N)' düğmesi görünür. Basınca önce kuru denetim yapılır; eski belge varsa HOF.confirm sorulur: 'Onları da Ekle ve Gönder' / 'Vazgeç'. Sessiz atlama olmaz. Döngü ve özet sendPending'den ortak runSend({only}) işlevine taşınır. view.sendProgress ile iki düğme birbirini kilitler. Gönderilemeyenler seçili kalır.
  TEST: Birim: kuru denetim numara ve EDM çağrısı üretmez; seçilmemiş daha eski bekleyen 'older' alanında döner; only turu 20'lik parçalarla ilerler, numara sırası tarih sırasına uyar; eski kodda kırmızı | Dar kontrol turu (ders 32, numara çekirdeği) | e2e gg244-secilenleri-gonder (şablon gg243-tumunu-gonder): Vazgeç → EDM'ye 0 istek; Ekle → hepsi bir kez gider, sıra doğru; eski belge yoksa soru çıkmaz; Tümünü Gönder ile aynı anda basılamaz. ci.yml'de hem adıma hem --beklenen listesine eklenir | gg243-dar-kontrol-gonderim D2 'ids' kipi (311-340) koşulur (E3 yarış yardımcısıyla)
  RİSK: İstemcide en çok 200 satır var (227); eski belge denetimi istemcide yapılamaz, sunucuda olmalı | Kuru denetimden sonra başka oturum eski tarihli belge kaydederse sunucu belgeyi bekletir; özet iletisi bunu söylemeli (2850-2851) | İleti 'aynı seride' demeli: e-Arşiv ve e-Fatura ayrı seri | Birim testlerdeki döngü kopyası eski (gg243-dar-kontrol-gonderim.test.mjs:80 '!sent'; istemci 2812 '!moved')

[E7] para=False 4sa
  DOKUNMA: client/assets/hof-invoices.js:289-294 (üst satır; 293 'Liste - Excel' span'inin hemen yanı) | client/assets/hof-invoices.js:398-426 (yeni data-act) | server/routes/invoices.mjs:455 (integratorSummary: env/configured meta'da var), 2323 (meta.adapters) | server/lib/einvoice/adapters.mjs:21-33 (portal adresleri ADAPTERS.edm'ye eklenecek yer) | launcher/main.go:69-140 ve platform_windows.go:63-74 (başlatıcı tek seferlik çalışır; --app ile açar ve çıkar)
  ÖNERİ: Düğme yalnız edoc açık, yetki var ve entegratör kuruluyken görünür. Adres sunucuda tek yerde tutulur: test https://test.edmbilisim.com.tr/EFaturaUI21ea/, canlı https://portal4.edmbilisim.com.tr/EFaturaUI/. İstemci meta.settings.integrator.env'e göre birini seçer. İki yol var: Yol A, window.open ile ekranı kaplayan ayrı pencere (kullanıcının kalıcı Edge profili; Beni Hatırla ve Edge parola kaydı çalışır; kurulum değişmez; her istemci makinede açılır). Yol B, kurulumda URL şeması kaydı ve başlatıcıya -portal bayrağı (msedge --app --start-fullscreen --user-data-dir). Bunun bedeli Inno Setup değişikliği ve Windows'ta gerçek koşu. Hiçbir yolda iframe yok, parola istemciye gitmez, Turnstile'a dokunulmaz.
  TEST: e2e: düğme görünürlüğü (e-Belge, yetki, bağlantı); Test'te test adresiyle, canlı açık sürümde canlı adresle açılır (popup route ile kesilir, ağa çıkılmaz) | Yazım düzeni testi düğme adını tarar | Gerçek Windows + Edge elle kabul: ilk girişte Beni Hatırla, ikinci açılışta doğrudan sayfa (ders 18)
  RİSK: Program çok kullanıcılı: Edge'i sunucu açarsa tıklayanın değil sunucunun makinesinde açılır | Başlatıcı dinlemiyor; 'başlatıcı açar' isteği kurulum değişikliği gerektirir | Canlıda portal girişi web servis kullanıcısıyla aynı mı, EDM teyit etmedi; Beni Hatırla kalıcılığı DOĞRULANMADI | JS'ten gerçek F11 tam ekran zorlanamaz

[UI5] para=False 0.5sa
  DOKUNMA: client/assets/hof-invoices.js:2260-2265 (showDoc) | client/assets/hof-invoices.js:133-140 (setMode) | client/assets/hof-ui.css:366-371 (.hof-modal overflow:auto — kaydırılan öğe pencere) | client/assets/hof-core.js:133,156,165 (HOF.swap yalnız root'un kaydırmasını korur)
  ÖNERİ: showDoc'ta önceki mod card değilse ya da view.id değiştiyse modal.dialog.scrollTop = 0 yapılır. Arka plan yenilemesi aynı kartı yerinden oynatmaz.
  TEST: e2e 1366×768: uzun formun dibinden Kaydet ve Gönder → kartta dialog.scrollTop 0, başlık görünür; eski kodda kırmızı | fatura-243-duzen-kaymasi koşulur
  RİSK: Sıfırlama koşulsuz yapılırsa arka plan yenilemesinde kart yukarı zıplar

[UI3a] para=False 0.75sa
  DOKUNMA: client/assets/hof-invoices.js:910 (Kod / Barkod girişi) | client/assets/hof-ui.css:9856 (td.hof-inv-code 118px), 9851 (min-width 980px), 9853 (girdi dolgusu)
  ÖNERİ: Hücre yaklaşık 140px yapılır, ya da girdi dolgusu 6px + tabular-nums ile 132px'e sığdırılır. Tablo min-width'i ~1000px'e çıkar. EAN-13 ve 'STK-2.0.26-001' kesilmemeli.
  TEST: e2e: scrollWidth ≤ clientWidth (13 haneli EAN ve 14 karakterli kod); 1366 genişlikte yatay kaydırma durumu yazılır
  RİSK: Ad kolonu daralır (min-width 240px, 9866)

[UI9] para=False 1.5sa
  DOKUNMA: client/assets/hof-invoices.js:65 (amountText) | client/assets/hof-invoices.js:1065 (ürün seçimi), 1937 (fiyat ipucu), 482 (Düzenle/Kopya), 2084 (Netten Brüte) | server/lib/money.mjs:4-11 (parseAmount '1.249,90'ı okur), server/routes/invoices.mjs:1213-1218/1495
  ÖNERİ: Yalnız birim fiyat için priceText kullanılır: tr-TR, en az 2, en çok 4 ondalık, binlik ayraçlı ('1.249,90'). Miktar alanına dokunulmaz. Okuyucular (parseTl, sunucu parseAmount) bu biçimle uyumlu.
  TEST: uiux-b-243.mjs:204 zaten '20' ya da '20,00' kabul ediyor | Yeni: 1249,9 fiyatlı ürün girdide '1.249,90' görünür, DB'de unit_price 1249.9; Tab ile çıkıp yeniden yazınca bozulmaz (ders 3/12)
  RİSK: 4 ondalıklı fiyat kırpılmamalı | NUMERIC_LINE_FIELDS süzgeci (1685-1696) nokta ve virgülü bırakmalı

[UI11] para=False 2sa
  DOKUNMA: client/assets/hof-invoices.js:288 (liste <h3>Fatura</h3> + pencere <h2>, hof-core.js:920) | client/assets/hof-invoices.js:293 (Liste - PDF/Excel .hof-rep-out), 306 (Seçilenleri PDF/Excel, e-Belge XML), 2355 (kart outputButtons '<Tür> - PDF'), 2335 (XML İndir) | client/assets/hof-plans.js:360-362 (outputButtons; 2.0.16 müşteri kararı 'ne indirdiğini söyler') | client/assets/hof-ui.css:8030-8055 (.hof-rep-out renkleri)
  ÖNERİ: Çift başlık için 288'deki h3 kaldırılır, small açıklama kalır (Çek/Senet'te 2.4.3'te böyle yapıldı, hof-cheques.js:157-158). Dışa aktarım düğmelerinde biçim tek olsun (ghost + simge + Yazdır, outputButtons). Adın nasıl olacağına kullanıcı karar vermeli: 'PDF' mi, yoksa 2.0.16 kararına uygun '<Ne> - PDF' mi (ör. 'Fatura Listesi - PDF').
  TEST: e2e: görünür h2/h3 'Fatura' sayısı 1 (şablon uiux-a-243.mjs:385-386) | senaryo-216.mjs:232 ('Alış Faturası - PDF') CI'de yok; ad değişirse elle koşulur (ders 8/28) | senaryo-cari-243.mjs:244 boyut denetimi koşulur
  RİSK: Görevdeki 'tek ad PDF' ile 2.0.16 müşteri kararı çelişiyor | Bütün modüllere dokunan iş; diğer alan ajanlarıyla birlikte yapılmalı

[UX9] para=False 3sa
  DOKUNMA: client/assets/hof-invoices.js:1491-1516 (renderTotals; problems 1503) | client/assets/hof-invoices.js:758-768 (applyPickedAccount), 700-757 (mountAccountPicker) | client/assets/hof-accounts.js:1648-1663 (HOF.accounts'ta editFor yok), 744 (editAccount), 897-899 (onSaved)
  ÖNERİ: partyProblems varsa ve accounts.manage yetkisi varsa Toplamlar'daki sorun listesinin altına 'Cariyi Düzenle' düğmesi gelir. Bu, HOF.accounts.editFor(id,{onSaved}) çağırır; cari alanına küçük bir ekleme gerekir. Kaydedince applyPickedAccount ile hesap yenilenir, form kapanmaz. Cari formunda il zorunluluğu cari alanının işi.
  TEST: e2e: ili boş cari + e-Arşiv → Cariyi Düzenle → il yazılır → sorun kalkar → Kaydet ve Gönder geçer; carinin ili DB'den okunur
  RİSK: UX1 sürüm denetimi (aynı anda cari düzenleme) korunmalı | İş iki alana dokunuyor (fatura + cari)

[UX10] para=False 3sa
  DOKUNMA: client/assets/hof-invoices.js:331-350 (showPick) | client/assets/hof-invoices.js:525-581/627-699 (startForm/renderForm) | client/assets/hof-invoices.js:744-756 (+ Yeni Cari onSaved) | client/assets/hof-invoices.js:2104-2111 (fail), 2125-2135, 2197-2206 (catch; failure.data.field kullanılmıyor) | server/routes/invoices.mjs:1495-1496 (kalem hatalarında satır sırası extra'da yok)
  ÖNERİ: Senaryo ekranında odak varsayılan karta, yoksa ilk karta gider. Formun ilk çiziminde (bayrakla) odak şöyle olur: cari boşsa [data-acc-query], iadede asıl fatura seçilmemişse [data-return-q], cari doluysa ilk kalemin kodu. Yeni cari kaydedilince odak ilk kalem adına gider. fail(message, target) ile odak hatalı alana gider. Sunucu data.field dönerse ilgili alana odaklanılır; kalem hataları için sunucuya line:index eklenir.
  TEST: e2e: her açılışta document.activeElement denetlenir; doğrulama hatasında odak alanda | gg243-odak-* ve uiux-b-243 odak denetimleri koşulur
  RİSK: Cari seçici focus olunca arama listesini açıyor (hof-accounts.js focus→search) | renderForm başka yerlerden de çağrılıyor (2051-2057, 614); odak yalnız ilk açılışta verilmeli

[UX15] para=False 3sa
  DOKUNMA: client/assets/hof-invoices.js:1503 (renderTotals c.blockers'ı çizmiyor), 2154-2155 | server/routes/invoices.mjs:1678-1681 (assertChronology), 794/1884 (e-Belge numarası sonradan verilen yol), 2487-2496 (calc yanıtı)
  ÖNERİ: calc'a assertChronology ile aynı sorguyu kullanan ama hata fırlatmayan bir chronologyProblem eklenir; sonuç blockers'a ve görünmesi için warnings'e yazılır. İstemci renderTotals blockers'ı da (problems'ta olmayanları) çizer. Numaralama kuralı değişmez.
  TEST: Birim calc: seride son belgeden eski tarih blockers'ta çıkar | e2e: tarih geri alınınca formda ileti görünür, numaralı onay açılmaz; eski kodda kırmızı
  RİSK: Ön gösterim ile kayıt ayrı fonksiyon kullanırsa ikisi ayrışır

[UX16] para=False 0.5sa
  DOKUNMA: client/assets/hof-invoices.js:744-756 | client/assets/hof-accounts.js:516-518 (genel seçici adı taşıyor)
  ÖNERİ: Tıklamada seçicinin [data-acc-query] değeri okunur; cari seçili değilse name olarak newFor'a geçilir.
  TEST: e2e: ad yazılır → + Yeni Cari → formda ad dolu gelir
  RİSK: Cari seçiliyken kutuda seçili carinin adı yazıyor; o durumda taşınmamalı

[UX17] para=False 1sa
  DOKUNMA: client/assets/hof-invoices.js:2342 (.hof-chq-amount etiketi) | client/assets/hof-invoices.js:2321 (Toplamlar 'Tahsil Edilecek' mali terim, dokunulmaz)
  ÖNERİ: Belge kesilmiş ve kapalıysa (open ≤ 0) etiket 'Belge Tutarı' olur. Açıkken etiket kalır, altına small 'Kalan ₺X' eklenir. Taslakta 'Tutar (Taslak)'. İptal etiketi aynı kalır.
  TEST: senaryo-entegrator-240.mjs:385-388 (iptal etiketi) koşulur | Yeni: tamamen ödenmiş kartta 'Tahsil Edilecek' yok
  RİSK: Etiket metni kullanıcıya sorulmalı

[UX18] para=False 2sa
  DOKUNMA: client/assets/hof-invoices.js:2427-2465 (payForm; HOF.methodField hof-core.js:288) | client/assets/hof-accounts.js:939, 982-986 (cari Çek/Senet → HOF.cheques.newFor) | client/assets/hof-cheques.js:654 (newFor) | server/routes/cheques.mjs:124,135,485,630 (invoice_id 'fatura ile birlikte kaydedildi' anlamında; çekirdeği kilitliyor)
  ÖNERİ: A: fatura formuna cari'deki gibi 'Çek / Senet' seçeneği eklenir ve aynı devirle çek formuna geçilir. Yardım metni dürüst olur: evrak carinin en eski açık faturasından kapanır. B: evrakı bu faturaya bağlamak; bu sunucunun para çekirdeğinde değişiklik ve dar kontrol ister. Önerim A.
  TEST: e2e: faturadan Çek/Senet → evrak formu tutarı dolu açılır; kayıttan sonra açık tutar DB'den okunur
  RİSK: 'Bu faturaya bağlı kapatılır' sözü çekte doğru olmaz | B seçilirse para çekirdeği değişir

[UX20] para=False 1sa
  DOKUNMA: client/assets/hof-invoices.js:2183-2192 (başarı ve autoSend bildirimleri ayrı ayrı çıkıyor) | server/routes/invoices.mjs:508 (displayNo numarasız belgede 'Gönderilecek') | client/assets/hof-invoices.js:257 (docTitle aynı kökten)
  ÖNERİ: autoSend başarısızsa tek bildirim çıkar: kaydedildi + neden + nerede beklediği; süre 12 sn. Numara yalnız saved.number varsa yazılır. Komşu sorun: kart başlığı ve docTitle'da 'Gönderilecek' numara gibi yazılmamalı.
  TEST: senaryo-fatura-243 adım 7: bildirim sayısı 1, 'Gönderilecek kaydedildi' yok | senaryo-ebelge-242 adım 4: bildirim düğmeleri örtmez
  RİSK: Uzun bildirim pencere düğmelerini örtebilir (ebelge-242 adım 4 geçmişi)

[UX25] para=False 0.5sa
  DOKUNMA: client/assets/hof-invoices.js:302 (Belge Türü süzgeci) | server/routes/invoices.mjs:2310 (meta profiles: PROFILES), 52-58 (ESMM dahil)
  ÖNERİ: Sunucu meta'da ESMM'i yalnız esmmEnabled açıkken döner (tek kaynak). E1 2.4.4'te e-SMM'yi açarsa seçenek meşru olur; madde 'kapalıyken gizle'ye iner.
  TEST: Birim meta: esmmEnabled false iken ESMM yok, true iken var | e2e: süzgecin her seçeneği açılır, toplam = satırlar (ders 11)
  RİSK: E1 kararına bağlı

[UX27] para=False 0.5sa
  DOKUNMA: client/assets/hof-invoices.js:2357 (Düzenle dolu düğme + disabled) | client/assets/hof-ui.css:311-314 (.hof-button:disabled), 10402-10405 (.hof-chq-actions .hof-button[disabled])
  ÖNERİ: Yalnız CSS: .hof-chq-actions içindeki ghost olmayan pasif düğme gri zemin + soluk yazı alır. Bu kural çek ve banka kartlarını da etkiler; bilerek genel kural yapılır ya da .hof-invoices ile sınırlanır.
  TEST: e2e: pasif Düzenle'nin rengi pasif Sil'inkine yakın; blocksHtml nedeni görünür | [data-act=modify]:not([disabled]) seçicileri (banka-210-kart-onbellek-yaris:209, senaryo-216:284) etkilenmez
  RİSK: Paylaşılan sınıf üç modülü etkiler

[E1-istemci] para=True 3sa
  DOKUNMA: client/assets/hof-invoices.js:3174, 3205 (esmmAvailable ile gizli parçalar) | client/assets/hof-invoices.js:2096-2097 (sendable; server/lib/invoice-math.mjs:40 smm send:false) | client/assets/hof-invoices.js:2537-2565 (cancelForm'da ESMM dalı yok) | client/assets/hof-invoices.js:1653 (renderProfile notunda ESMM yok) | client/assets/hof-invoices.js:3167, 3206 (test serisi notu TES'i sızdırıyor; sunucu testSeries süzgeçsiz invoices.mjs:2339/2353) | client/assets/hof-invoices.js:3160 (tek Servis Adresi alanı; ESmmEDM.svc ayrı)
  ÖNERİ: Sunucu e-SMM'de smm türünün send bayrağını açmalı; açmazsa form, Gönderilecekler ve kart araçları e-SMM'yi hiç görmez. İstemcide yapılacaklar: cancelForm'a ESMM dalı ('önce entegratörde iptal'), renderProfile'a e-SMM notu, test serisi notunun esmm'e göre süzülmesi, UX25. Servis adresi alanı için sunucu kararı gerekir.
  TEST: esmm-gizli-241.test.mjs:57-74 açık bayrak beklentisi bilerek değişir (ders 28) | senaryo-entegrator-240.mjs:333 'TEF, TEA, TES' beklentisi gözden geçirilir | e2e e-SMM açık: SMM formunda Kaydet ve Gönder, iptal penceresi metni, süzgeç ve seri ekranı (sahte e-SMM servisi)
  RİSK: smm.send'i değiştirmek sunucunun gönderim, Gönderilecekler ve kart kurallarının hepsine dokunur | İptal süresi kılavuzda yok (mali müşavire sorulacak)
SÜRPRİZ:
- Görevdeki 'UI9 Anlık Durum' ve 'UI11 Çek çift başlık' 2.4.3 A paketinde zaten yapıldı (hof-overview.js:25-30; hof-cheques.js:157-158; uiux-a-243.mjs:385-386); kalan yalnız fatura kısımları.
- UI11'deki 'tek ad PDF/Excel' isteği 2.0.16 müşteri kararıyla çelişiyor: o karara göre düğme ne indirdiğini söyler (hof-plans.js:360).
- senaryo-216.mjs:232 'Alış Faturası - PDF' bekliyor ama senaryo-210…218 CI'de yok (ci.yml). Düğme adı değişirse test sessizce kırılır (ders 8).
- E5'in kırpma kısmı kullanıcı adında zaten sunucuda yapılıyor (http.mjs:192-198 text().trim; invoices.mjs:311). 'Kayıtlı parola gösterilmez' metni de zaten var (hof-invoices.js:3157). Asıl boşluklar: alan boşken Göster'in hiçbir şey yapmaması ve URL'yi zaten kaydetmiş kurulumlarda uyarı olmaması.
- E6: sunucunun {ids} yolu 'seçilmemiş daha eski bekleyen' kuralını zaten uyguluyor (invoices.mjs:3702-3716, 3767-3771). Ama bunu gönderimden SONRA söylüyor ve parçalara bölmüyor (SEND_TURN 200, imleç yok).
- INVOICE_KINDS.smm.send false (invoice-math.mjs:40): esmmEnabled açılsa bile makbuz kayıtta numaralanıyor ama gönderilemiyor; istemci SMM'de gönder düğmesi göstermiyor.
- e-SMM gizliyken Entegratör test notu 'TEF, TEA, TES' yazıyor (hof-invoices.js:3167/3206; sunucu testSeries süzgeçsiz) ve senaryo-entegrator-240.mjs:333 bu sızıntıyı bekliyor.
- cancelForm'da ESMM dalı yok (2537-2565).
- Numarasız bekleyen belgede displayNo 'Gönderilecek' (invoices.mjs:508); başarı bildiriminde ve kart başlığında numara yerine bu yazıyor (2184, 257).
- Birim testler istemcinin gönderim döngüsünü kopyalıyor ve kopya eski: '!result.data.sent' (gg243-dar-kontrol-gonderim.test.mjs:80). İstemci '!moved' kullanıyor (2812); ikisi ayrışmış.
- Başlatıcı tek seferlik çalışıyor (launcher/main.go); sunucu başka makinedeyse 'başlatıcı Edge açar' çözümü kurulum değişikliği ve URL şeması ister.
- Cari'nin Çek/Senet tahsilatı faturaya bağlanmıyor (cheques.invoice_id başka anlamda kullanılıyor). Faturadaki Tahsilat Ekle'ye eklenirse 'bu faturaya bağlı kapatılır' sözü yanlış olur.
- renderTotals c.blockers'ı çizmiyor; returnProblems ve mixProblems ancak Kaydet'e basınca görünüyor (1503 ↔ invoices.mjs:1834).
- Fatura formu sunucunun data.field bilgisini odak için kullanmıyor; kalem hatalarında satır sırası extra'da yok.
- setMode'un eklediği is-form sınıfının CSS kuralı yok; yalnız e2e işareti olarak kullanılıyor.
- Entegratör Ayarları'nda kaydetme hatası iki yerde görünüyor: form satırı ve bildirim (3297-3298).
SORU:
- UI11: düğme adı 'PDF'/'Excel' mi olacak, 2.0.16 kararına uygun '<Ne> - PDF' mi? Biçim renkli .hof-rep-out mu, ghost + simge + Yazdır mı?
- E7: düğmenin adı 'E-Fatura Portal' (kullanıcının sözü) mu, 'e-Fatura Portalı' mı? Kim görecek: invoices.manage mı, invoices.settings mi? Yalnız entegratör bağlantısı kuruluyken mi görünsün?
- E7: Yol A mı (window.open, kullanıcının Edge profili, her makinede çalışır), Yol B mi (URL şeması + başlatıcı, ayrı kalıcı profil, gerçek tam ekran, kurulum değişikliği)?
- E6: düğme yalnız Gönderilecekler sekmesinde mi görünsün, her sekmede seçili bekleyen belge varken mi? Sunucuya { all, only, after } ve { check } kiplerinin eklenmesi onaylı mı (para-numara çekirdeği, dar kontrol gerekir)?
- UX18: A mı (çek formuna devir, en eski açık faturadan kapanır, metin buna göre), B mi (evrakı faturaya bağlayan sunucu değişikliği)?
- E5: parolanın başında/sonunda boşluk varsa yalnız uyarı mı verilsin (önerim), kırpılsın mı?
- UX17: ödenmiş faturada 'Belge Tutarı', açıkta altına 'Kalan' yazılması uygun mu?
- UX25 E1'e bağlı: e-SMM 2.4.4'te açılırsa süzgeç seçeneği kalır, yalnız kapalı kurulumda gizlenir. Doğru mu?

######## fatura-para
MİMARİ: Fatura hesabı tek bir saf motorda yapılıyor: server/lib/invoice-math.mjs. Tutarlar kuruş tamsayısıyla tutuluyor, her kalem ayrı yuvarlanıyor (yarım kuruş sıfırdan uzağa, mulDiv :156). Kalem hesabı computeLine'da (:185), belge toplamı computeInvoice'ta (:246). Stopaj belge düzeyinde tek kez yuvarlanıyor (:278); ödenecek tutar Σ kalem − stopaj (:293). TL karşılığı toTry'de (:309) hesaplanıyor. Belge türleri INVOICE_KINDS'te; smm türü send:false taşıyor (:40) ve bu bayrak bütün e-Belge gönderim kapılarını kapatıyor. Rota tarafında (server/routes/invoices.mjs) akış şöyle: documentInput (:1346) → linesInput (:1443) → computeInvoice + toTry (:1397–1403) → paymentInput (:1540) → writeIssued (:1838). writeIssued fatura, kalem, stok, cari, peşin, çek/senet ve taksit kartını tek bir bank.post işleminde yazıyor (:1861–2045). editInvoice (:766) eski etkileri reverseEffects (:2140) ile geri alıp yeniden yazıyor; iptal cancel (:2165) ile yapılıyor. SMM'de stopaj oranı verilmezse yalnız tüzel alıcıya %20 uygulanıyor (:1389–1394). Kapama server/lib/invoice-settle.mjs settleInvoices'ta (:128) yöne göre çalışıyor: önce iade geri ödemesi, sonra mahsup, bağlı ödemeler ve Mevcut Borç kartı, en son FIFO (:290–362). Bağlar üç yerden geliyor: peşin satırlar, account_entries.invoice_id (taksitli faturaya kurulan bağ sayılmıyor, :567/:629) ve cheque_events.invoice_id (:591/:638). Ana Defter'de SMM maddesi B 120 ödenecek · B 193 stopaj / A 600 brüt · A 391 (KDV − tevkifat) (general-ledger.mjs:319–325). Kapı fatura bölümünde (integrity-scope.mjs:598–617, invoiceChecks :708–776) 191/391/360/193 hesaplarını, başlık = kalemler eşitliğini ve try formülünü denetliyor; cheque_events.invoice_id'yi denetlemiyor. tax.mjs balances (:57) 360 bakiyesine yalnız alış tarafı stopajını katıyor; SMM'nin 193'ü hiçbir işlemle kapanmıyor. invoice-pdf.mjs'te Stok Kodu kolonu 2.4.3'ten beri ölçülüyor (62–120 pt, :65–68). Bağımsız kâhinlerin durumu: fatura-model.mjs programla aynı elden yazılmış (npm test), defter kâhini yalnız elle koşuluyor ve SMM'yi içermiyor, e-Belge kâhini yalnız numara/gönderim modelliyor (Uzun Doğrulama kahin_ebelge).
DEĞİŞMEZLER:
- payable = net + vat − withheld − stoppage; hem belge para biriminde (invoice-math.mjs:293) hem TL'de (toTry :324) geçerli; kapı invoice:try (integrity-scope.mjs:724) denetler
- Başlık = kalemler: Σ kalem net/KDV/tevkifat = başlık, Σ kalem payable − stopaj = başlık payable (integrity-scope.mjs:711–715). Kalemde stopaj kolonu yok (invoice_lines INSERT invoices.mjs:1997–2002)
- SMM yevmiyesi dengede: B (payable + stopaj) = A (net + KDV − tevkifat) (general-ledger.mjs:319–325)
- Faturanın tek cari borç/alacak satırı = try_payable (integrity-scope.mjs:727–737)
- Kapama yöne göre: taksitli fatura yalnız bağlı ödemeyle kapanır; iade için K1 formülü mahsup = iade − geri ödenen (invoice-settle.mjs:33–40)
- Kendi serisinde numara sırası = tarih sırası (assertChronology invoices.mjs:1678; düzenlemede :785–802)
- Peşin + çek + ciro toplamı ödenecek tutarı aşamaz (paymentInput invoices.mjs:1606–1607)
- Faturayla kesilen evrak (cheques.invoice_id) faturanın kendi etkisidir: Düzenle/İptal'de voidFor siler ve yeniden açar; tutarı, carisi ve tarihi kilitlidir (cheques.mjs:485, :630, :943–971)

[E1-para] para=True 6sa
  DOKUNMA: server/lib/invoice-math.mjs:40 smm.send:false (gönderim kapıları) | server/routes/invoices.mjs:654 unsentNumbered, :992–1000 canSend/canRefresh/canDraft/canOfficial, :1196–1205 unsentSql, :1842/:1846 later/deferable, :3242 olderPending, :3258 sendWouldContact, :3979 toplu XML, :2308 meta.kinds | server/routes/invoices.mjs:1389–1394 SMM varsayılan stopajı; :1640–1646 seriesFor (ESMM → TES/ESM) | server/lib/invoice-math.mjs:278 belge düzeyinde stopaj; :327 grossFromNet | server/lib/einvoice/ubl-tr.mjs:157 stopaj yalnız Not, :216 LegalMonetaryTotal e-Fatura anlamında (yeni ESMM dalı gerekir) | server/lib/invoice-pdf.mjs:225–236 SMM toplam adları | client/assets/hof-invoices.js:2072–2090 Netten Brüte (:2081 oran hatası) | test/bagimsiz/defter/kahin.py + kos.mjs:120/:234 + senaryo.json (SMM olayı ve mutasyonlar) | test/bagimsiz/ebelge/KARARLAR.md K4 (TES serisi)
  ÖNERİ: Para hesabı yeniden yazılmayacak; tek kaynak invoice-math kalacak. ESMM kurucusu detail() alanlarını eşleyecek: LineExtension = netTotal (brüt), TaxExclusive = netTotal − stoppageTotal (net ücret), TaxInclusive = Tahsil Edilen KDV (vatTotal ya da vatTotal − withheldTotal, DOĞRULANMADI), Payable = payableTotal, TaxTotal = yalnız KDV, ayrıca 0003 stopaj alt toplamı. Gönderim kapıları için INVOICE_KINDS sabiti değiştirilmeyecek; tek bir yardımcı yazılacak: sendable(row) = kind.send || (smm && profile === ESMM && esmmEnabled). Çok kalemli makbuzda stopaj yuvarlaması için iki yol var: (a) e-SMM'de tek kalem zorunlu tutulur, ya da (b) belge stopajı kalemlere en büyük kalan yöntemiyle dağıtılır ve test hesabında denenir. Kalem bazında stopaj (para çekirdeği değişikliği) ancak EDM satırdan yeniden hesaplıyorsa yapılır. Netten Brüte, oranı form.calc.stoppageRate'ten almalı ve KDV dahil işaretini hesaba katmalı. PDF ve ekranda SMM toplamları GİB adlarıyla gösterilmeli: Brüt Ücret, Gelir Vergisi Stopajı, Net Ücret, KDV, Net Tahsil Edilen.
  TEST: Defter kâhinine SMM olayı: B 120 · B 193 / A 600 · A 391; 3 senaryo (tüzel alıcı %20, kişi alıcı 0, 602 tevkifatlı); yeni mutasyonlar 'SMM stopajı 193 yerine 360' ve 'stopaj ödenecekten düşülmez'. Kâhin bir CI/Uzun Doğrulama işine bağlanmalı | Yeni temiz oda e-SMM belge kâhini (Python, test/bagimsiz/esmm/): dip toplamlar GİB kuralından hesaplanıp program ubl.xml çıktısıyla karşılaştırılır | Kırmızı test: kişi alıcıda Netten Brüte → kayıttan sonra DB'deki net ücret istenen nete eşit (eski kodda kırmızı) | Özellik testi: grossFromNet + computeInvoice; her net ve oran {10,15,17,20} için payable = net + KDV | 2 kalem × 100,03 TL %20 makbuzu: stopajın 40,01 ya da 40,02 olması seçilen yola göre sabitlenir; EDM test hesabında resmî PDF ile karşılaştırılır | esmm-gizli-241 (bayrak açık yol) ve ebelge kâhini K4'e TES eklenerek genişletilir | fatura-model.test.mjs ve mutabakat motoru stopaj kuralı değişirse birlikte güncellenir
  RİSK: Çok kalemli e-SMM'de satır ve belge stopaj yuvarlaması 1 kuruş ayrışabilir; resmî belge ile defter/cari tutmaz | TaxExclusiveAmount ve TaxInclusiveAmount e-SMM'de e-Faturadan farklı anlam taşıyor; ubl-tr kurucusu yeniden kullanılırsa sessizce yanlış XML gider | EDM örnekleri tutarsız (TaxableAmount 0, PayableAmount 1 kuruş farklı, KDV %18, WITHHOLDING alanında 0003); kâhine kaynak olamaz (ders 5) | send bayrağı açılınca O1 bekletmesi, Gönderilecekler, toplu XML ve iptal yolları SMM'ye de açılır; komşu senaryolar koşulmalı (ders 10) | 2.4.0'da ESMM numarası almış eski makbuzlar yeni kurucudan geçmeli | Repoda GİB e-SMM şematronu yok; XML uygunluğu bağımsız denetlenemiyor

[UX17] para=False 1sa
  DOKUNMA: client/assets/hof-invoices.js:2342 kart başlığı .hof-chq-amount (etiket + payableTotal) | client/assets/hof-invoices.js:2321 ve :1511 toplamlardaki 'Tahsil Edilecek' satırı (ayrı kavram: tevkifat/stopaj sonrası tutar) | server/routes/invoices.mjs:705–708 shape open/paid/payStateLabel (sunucu değişmez) | test/e2e/senaryo-entegrator-240.mjs:385–388 (iptal etiketi değişmemeli)
  ÖNERİ: Yalnız istemcide değişir. Kaydedilmiş, iade olmayan belgede başlık duruma göre yazılır: açık ≤ 0,004 ise 'Fatura Tutarı' (SMM'de 'Makbuz Tutarı'); kısmi ödemede 'Kalan' + money(doc.open), altında küçük 'Toplam …'; hiç ödenmemişse bugünkü 'Tahsil Edilecek' / 'Ödenecek'. open TL olduğu için curMoney(cur) kullanılmaz. İptal etiketi aynen kalır. Toplamlardaki 'Tahsil Edilecek' satırının PDF'teki gibi 'Ödenecek Tutar' olması ayrı karar.
  TEST: Yeni e2e: tam peşinli → 'Fatura Tutarı'; kısmi → 'Kalan ₺X'; açık → 'Tahsil Edilecek'. Ödenmiş ve kısmi durumlar eski kodda kırmızı görülmeli | senaryo-entegrator-240 iptal etiketi koşulur (ders 28)
  RİSK: Döviz faturasında belge para birimi ile TL karıştırılırsa yanlış tutar görünür | Taslakta open anlamsız; durum yalnız issued iken hesaplanır (detail :923)

[UX18] para=False 2sa
  DOKUNMA: client/assets/hof-invoices.js:2427–2468 payForm (yol alanı :2441, açıklama sarmalayıcı :2449, gönderim :2459–2465) | client/assets/hof-accounts.js:937–939, :982–986 cari formundaki Çek / Senet seçeneği (HOF.cheques.newFor) | client/assets/hof-cheques.js:654 newFor; ~:300–310 HOF.emit('cheques-changed') | server/routes/cheques.mjs:460 POST /cheques → insertCheque :433 (invoice_id ''), :921 invoiceCheques.create (fatura sahipli; sonradan tahsilatta KULLANILMAZ) | server/routes/accounts.mjs:671–686 invoiceLink (B için örnek doğrulama) | B seçeneğinde ek: server/routes/invoices.mjs:733–741 ownPaymentLines, :591/:638 çek bağı taksit süzgeci, :2210 iptalde bağ temizleme; server/lib/bank/event-copy.mjs:26; test/bagimsiz/SENARYO-DILI.md E3/BELİRSİZ-27
  ÖNERİ: A (önerilen; para çekirdeğine dokunmaz): payForm yol listesine cari formuyla aynı koşulla (HOF.cheques?.newFor && HOF.can('cheques.manage')) 'Çek / Senet (portföye alınır / verilir)' eklenir. Seçilince form kapanır ve newFor({direction, account: {id: doc.accountId, name: doc.accountName}, amount}) çağrılır. cheques-changed olayında kart loadDoc ile yenilenir. Açıklama dürüst yazılmalı: 'Evrak carinin en eski açık borcunu kapatır (bu faturaya bağlanmaz)'; bugünkü yol bağsız evrakı FIFO ile kapatıyor. B (bağlı kapama) seçeneğinde POST /cheques'e yalnız cheque_events.invoice_id yazan bir kapama bağı eklenir. Bu yolda ownPaymentLines, taksitli fatura reddi, iptalde bağ temizleme, kâhin dili, kırmızı test ve dar kontrol gerekir. Karar kullanıcıda.
  TEST: A için e2e: fatura kartı → + Tahsilat Ekle listesinde Çek / Senet var (eski kodda yok, kırmızı); evrak formu cari ve tutar dolu açılır; Portföye Al sonrası DB'de evrak account_id = cari, invoice_id = ''; kart yenilenir; tek açık faturada fatura kapanır | Yetkisiz kullanıcıda (cheques.manage yok) seçenek görünmez | Komşu senaryolar (ders 10): banka-210-ekran-aciklama-yetki.mjs:118–133 (m4 metni) ve senaryo-216 yol listeleri
  RİSK: invoiceCheques.create sonradan tahsilatta kullanılırsa evrak fatura sahipli olur; fatura Düzenle/İptal edilince evrak silinir ve geri gelmez | A'da metin 'bu faturaya bağlı' derse yanlış söz verilmiş olur (FIFO başka faturayı kapatabilir) | B'de cheque_events.invoice_id iki anlam taşır; kapı bu kolonu denetlemiyor; çek bağı taksitli fatura süzgecinden geçmiyor

[UI9-fatura] para=False 1sa
  DOKUNMA: client/assets/hof-invoices.js:65 amountText (değişmeyecek) | client/assets/hof-invoices.js:1065 ürün seçimi, :1937 son fiyat çipi, :2084 Netten Brüte, :482 düzenleme/kopya (birim fiyat doldurma yerleri) | client/assets/hof-invoices.js:2313 kart kalem tablosu (curMoney 2 ondalık; PDF 4 ondalık invoice-pdf.mjs:16) | server/lib/money.mjs:4–11 parseAmount (virgüllü biçimi doğru okur)
  ÖNERİ: Yalnız birim fiyat için ayrı bir biçimleyici yazılır: tr-TR, binlik ayraç, en az 2 en çok 4 ondalık ('1.249,90', '0,1235'). Dört doldurma noktasında amountText yerine o kullanılır; amountText'in 20 kullanım yeri değişmez. Her zaman virgül üretilir, çünkü virgülsüz '1.249' binlik sanılır. İsteğe bağlı: kart tablosunda birim fiyatı 4 ondalıkla göstermek (PDF ile aynı). Anlık Durum kısmı 2.4.3'te yapıldı (hof-overview.js:24–31).
  TEST: e2e: 1.249,90 fiyatlı ürün seçilince giriş '1.249,90'; kayıttan sonra DB unit_price = 1249.9 (ders 12) | uiux-b-243.mjs:202–203 ('20' ya da '20,00' kabul) ve senaryo-213:303 koşulur | 4 ondalıklı fiyat (0,1235) gidiş-dönüşte kaybolmaz
  RİSK: amountText global değiştirilirse miktar, oran, kur ve ödeme alanları etkilenir | Virgülsüz noktalı metin binlik okunur (parseAmount :9)

[UI3a-pdf] para=False 1sa
  DOKUNMA: server/lib/invoice-pdf.mjs:65–68 codeWidth 62–120 pt (2.4.3 UI3b'de yapıldı), :215 doc.fit ile kesme | test/uiux-a-243.test.mjs:111–123 (UI3b testi) | client/assets/hof-ui.css:9856 td.hof-inv-code 118px + :9852 input padding (UI3a asıl istemci tarafı) | client/assets/hof-invoices.js:910 kod girişi, :2313 .hof-inv-doc-code
  ÖNERİ: PDF tarafı 2.4.3'te kapandı; 2.4.4'te yalnız 120 pt'yi aşan çok uzun kod (60 karaktere kadar, invoices.mjs:1508) için isteğe bağlı satır kaydırma (doc.wrap) yapılabilir. UI3a'nın asıl işi istemcide: kod hücresi ≥ 140px ya da odakta genişleme (tablo min-width 980px). İş listesinde madde 'istemci + PDF uzun kod' diye daraltılmalı.
  TEST: e2e: 13 haneli barkodda kod girişinin scrollWidth ≤ clientWidth olması (eski CSS'te kırmızı) | uiux-a-243 UI3b testi yeşil kalmalı; 30 karakterlik kod için PDF'te kesme ya da kaydırma beklentisi yazılmalı
  RİSK: Kod kolonu genişleyince 1366 px'te kalem satırı taşabilir; uiux-a ve form e2e'leri koşulmalı | PDF'te kod kaydırılırsa satır yüksekliği hesabı (height, invoice-pdf.mjs:193) da güncellenmeli
SÜRPRİZ:
- UI3a'nın PDF tarafı (UI3b) 2.4.3'te zaten yapılmış: invoice-pdf.mjs:65–68 ve test/uiux-a-243.test.mjs:111. UI9'un Anlık Durum kısmı da yapılmış (hof-overview.js:24–31). Bu iki maddenin 2.4.4'te kalan işi yalnız istemci/fatura kısmı
- Netten Brüte (hof-invoices.js:2081) stopaj kutusu boşken ayar oranını (%20) kullanıyor, sunucu ise kişi alıcıda 0 uyguluyor (invoices.mjs:1393). Sonuç: brüt %25 fazla yazılıyor. Fiyatlar KDV Dahil işaretliyse brüt KDV dahil fiyat sanılıyor. Gerçek mantık hatası, koddan okundu, çalıştırılmadı
- Program stopajı belge düzeyinde tek kez yuvarlıyor (invoice-math.mjs:278) ve kalemde saklamıyor. EDM/GİB e-SMM ise satır düzeyinde stopaj taşıyor (UBL kalem 0003; NESNE'de satır STOPPAGE_RATE/NET_AMOUNT). Örnek: 2 kalem × 100,03 TL %20'de satır satır 40,02, belge düzeyinde 40,01
- Defter kâhini (test/bagimsiz/defter) hiçbir CI ya da Uzun Doğrulama işinde koşmuyor, yalnız elle (package.json:14); SMM/193'ü de hiç kapsamıyor. Tek otomatik fatura hesap modeli fatura-model.mjs programla aynı elden yazılmış (ders 5)
- cheque_events.invoice_id kapamada bağ sayılıyor ama kapı (invoice:cheque) yalnız cheques.invoice_id'yi denetliyor. Çek olay bağı taksitli fatura süzgecinden de geçmiyor (invoices.mjs:591/:638; account_entries için süzgeç var :567/:629). Bugün zararsız; UX18-B açılırsa önemli
- Faturanın kendi evrakı fatura Düzenle'de voidFor ile silinip yeniden açılıyor (cheques.mjs:943–971). Sonradan alınan çek invoiceCheques.create ile açılırsa düzenlemede kaybolur
- SMM'de müşterinin kestiği stopaj 193'e yazılıyor ama hiçbir işlemle kapanmıyor; Vergi Ödemesi ve 360 bakiyesi yalnız alış tarafını görüyor (tax.mjs:57–95)
- EDM e-SMM örnekleri tutarsız: TaxableAmount 0, PayableAmount 230 ile 187,75 + 42,24 = 229,99 arasında 1 kuruş fark, KDV %18. NESNE örneğinde WITHHOLDING_TAX_CODE alanında stopaj kodu 0003 var
- Repodaki GİB şematron paketinde (tools/ebelge/sema/gib) yalnız e-Fatura/e-Arşiv kuralları var; e-SMM kuralı yok
- SMM kaleminde iskonto, KDV dahil fiyat ve KDV tevkifatı sunucuda serbest (invoices.mjs:1381–1382, linesInput). Bunların e-SMM'deki anlamı ve geçerliliği doğrulanmadı
SORU:
- EDM: e-SMM'de satır stopajı yeniden mi hesaplanıyor? 2 kalem × 100,03 TL %20 makbuzu test hesabında kabul ediliyor mu, resmî PDF'te stopaj 40,01 mi 40,02 mi?
- EDM/GİB: KDV tevkifatlı makbuzda TaxInclusiveAmount ('Tahsil Edilen KDV') KDV − tevkifat mı? NESNE'deki WITHHOLDING_TAX_CODE stopaj kodu (0003) mı, KDV tevkifat kodu (6xx) mı?
- EDM/GİB: iskontolu e-SMM'de Brüt Ücret iskonto öncesi mi sonrası mı? e-SMM'de iskonto ve KDV dahil fiyat reddedilsin mi?
- Kullanıcı: UX18 için A yeterli mi (cari ile aynı; evrak en eski borcu kapatır), yoksa B mi isteniyor (çek bu faturaya bağlı kapanır; para çekirdeği + dar kontrol)?
- Kullanıcı: UX17 etiketleri ('Fatura Tutarı' / 'Kalan' / 'Tahsil Edilecek'; taslakta 'Proforma Tutarı') ve toplamlardaki 'Tahsil Edilecek' satırının PDF'teki gibi 'Ödenecek Tutar' olması
- Mali müşavir: VKN'li gerçek kişi (tacir) alıcıda SMM varsayılan stopajı %20 olmalı mı (bugün 0)?
- Ana oturum: GİB e-SMM kılavuzu/paketi kâhin kaynağı olarak depoya alınacak mı (ağ politikası, KAYNAK.md düzeni)?

######## ortak-istemci
MİMARİ: client/index.html:16-55 sayfaya 40 betik yükler. Hepsi defer ve sıraları önemli: önce hof-core, sonra auth, boot ve öbürleri. HOF.office hof-plans.js:1414'te kurulur; accounts, stock ve invoices onu office() ile tembel okur. Kaynak kodu olmayan React paketi, oturum doğrulandıktan sonra hof-boot.js:310 loadApp ile dinamik import edilir. hof-* betikleri React DOM'unu tek bir MutationObserver (HOF.onDom, hof-core.js:1375-1411) ile süsler. Kendi eklediği öğe data-hof-ui taşır, yoksa izleyiciyi tetikler (:1393). hof-core.js ortak API'yi verir: şirket ve sayfa yönlendirmesi HOF.apiUrl (:20), HOF.api (:307, 30 sn zaman aşımı + requestId), titleCase (:421), formatMoney (:64), modal/confirm/formModal (:907/:1212/:1322), focusStart (:1081), toast (:756), defter bildirimi LEDGER_PATHS/onLedger (:457/:624). Açılış hof-boot.js:337 ile olur: /api/auth/me, ardından html.hof-can-<yetki> sınıfları (:249), fetch sarmalı (:256) ve bağlantılara şirket parametresi ekleme (:281-299). Yetkiye göre gizleme CSS'tedir (hof-ui.css:1108+; test/yetki-gorunurluk.test.mjs). Detay kartı hof-workspace.js'dedir. Düğme çubuğu installDetailActions (:1206-1219, düğmeler :1212); Düzenle (hof-table.js:479) ve Belge (hof-documents.js:655) dışarıdan eklenir. actions.payment (:255) sırayla taksit kartına (openPlanCollect), bağlı cariye (accounts.collect) ya da paymentForm'a (:35, POST /cases/:key/payments) gider. Taksit kutusu renderCasePlan (:136) ile çizilir; içinde + Tahsilat ve ₺ düğmeleri var (:127/:133). HOF.workspace.payment (:1374) zil (hof-alerts.js:285) ve takvim şeridi (hof-promises.js:138) tarafından kullanılır. Veri yokken hof-sources.js:397 #hof-start kartını çizer; hasData yalnız sheetUrl'e bakar (:18). Dışa aktarım iki ayrı görsel ailede: .hof-rep-out is-pdf/is-xlsx (hof-ui.css:8030-8055) ve HOF.office.outputButtons'ın nötr hof-button-ghost'u (hof-plans.js:361).
DEĞİŞMEZLER:
- Kendi eklenen DOM öğesi data-hof-ui taşır; yoksa tek DOM izleyici döngüye girebilir (hof-core.js:1393-1396; ders hof-export.js:160-162).
- Kaynakta kullanılan her data-requires yetkisinin hof-ui.css:1108+ altında gizleme kuralı vardır (test/yetki-gorunurluk.test.mjs:14-24).
- API ve indirme istekleri sayfanın şirketine gider: HOF.api, HOF.apiUrl ve <a href> yeniden yazımı (hof-core.js:20-40, hof-boot.js:281-299). Dış adresler değişmez.
- Kayıt tahsilatının sunucu yolu tektir: POST /api/workspace/cases/:key/payments (server/routes/workspace.mjs:392), düzeltme ve silme PUT/DELETE /api/workspace/payments/:id (:439/:471), yetki payments.create.
- Programın ürettiği adlar titleCase yazılır (hof-core.js:421 ile server/lib/text-case.mjs aynı kural). Denetim: test/yazim-duzeni.test.mjs ve test/e2e/senaryo-211.mjs.
- #hof-start DOM'u ve h2 metni 23 e2e dosyasının dayanağıdır; run.mjs:164-171 h2 metnini, birçok test #hof-start .hof-drop input'unu bekler.
- .hof-plan-output, a[data-pdf], button[data-print], data-xlsx, data-mv-export, data-export ve .is-pdf/.is-xlsx kod tarafından okunur (hof-invoices.js:393, hof-accounts.js:1525, hof-stock.js:569, hof-report-center.js:373) ve e2e seçicileridir.
- index.html betik sırası korunur: HOF.office (hof-plans.js:1414), onu kullanan modüllerden önce yüklenir.
- Para gösterimi HOF.formatMoney (tr-TR, TRY, simge başta) ile yapılır; kısaltılmış tutarda da simge başta durur (hof-overview.js:28-31).

[E8] para=False 2.5sa
  DOKUNMA: client/assets/hof-workspace.js:1212 (düğme data-case-action=payment data-requires=payments.create) | client/assets/hof-ui.css:2121-2125 (mevcut kural, yalnız html.hof-no-tahsilat iken; sınıf hof-insight.js:114, modül server/lib/profile.mjs:194 tahsilat varsa açılır) | client/assets/hof-ui.css sonu 11050-11114 (2.4.x ek kural geleneği) | client/assets/hof-workspace.js:1178-1179, 1200 (boş geçmiş metni: not, telefon, tahsilat veya haciz) | client/assets/hof-workspace.js:127,133,183-196 (taksit kutusundaki ₺ ve + Tahsilat yerinde; koşul plans.view + plans.collect) | server/lib/permissions.mjs:140 (yetki açıklaması 'Kişi kartından tahsilat girer') | docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html:117 ve :288 (kartın Tahsilat düğmesi anlatılıyor) | test/e2e/run.mjs:488, 622, 645; test/e2e/senaryo-banka-210b.mjs:214; test/e2e/senaryo-cari-243.mjs:173, 206
  ÖNERİ: hof-ui.css SONUNA tek bir koşulsuz kural eklenir: '.hof-case-actions [data-case-action="payment"] { display: none !important; }' ve '2.4.4 (müşteri isteği 20.10.2026)' yorumu. hof-ui.css:2123'teki eski kural zararsızdır, kalabilir. JS'e dokunulmaz; tek istisna boş geçmiş metnidir: hof-workspace.js:1178 dizisinden 'tahsilat' çıkarılır. Bu bir satırlık metin değişikliğidir, kullanıcı 'koda dokunma' dediği için ayrıca sorulmalı. permissions.mjs:140 açıklaması ve kılavuzun 117 ile 288. satırları güncellenir. HOF.workspace.payment, zil ve takvim yolları çalışmaya devam eder; sunucu değişmez.
  TEST: YENİ (eski kodda kırmızı): run.mjs'de kayıt seçiliyken getComputedStyle('.hof-case-actions [data-case-action="payment"]').display === 'none' ve Not/Telefon görünür (kalıp run.mjs:1216 lienAction). | run.mjs:488: tahsilat page.evaluate(() => HOF.workspace.payment({key,title})) ile açılır (takvim yolunun aynısı, form arayüzden kalır) ya da API + HOF.workspace.refreshActivity(). Düzelt/sil adımı (:495-517) aynen kalır. | run.mjs:622: 'Taksit planı oluşturun' kısa yolu yalnız paymentForm'da olduğu için HOF.workspace.payment({key,title}) ile açılır. | run.mjs:645: ekrandaki gerçek yol #hof-case-plan tbody tr:first-child [data-case-collect] (₺) ile seçilir. HOF.plans.collect formunda 1.000,00 beklentisi DOĞRULANMADI. | senaryo-banka-210b.mjs:214 ile senaryo-cari-243.mjs:173 ve :206: HOF.workspace.payment({key,title}) kullanılır; banka seçici ve cari yönlendirmesi aynı kodda kalır. | Ders 28 gereği bütün e2e koşulur; değişen üç dosya mutlaka.
  RİSK: Kayda bağlı cari varken detay kartından cari tahsilatı kısa yolu (hof-workspace.js:268-275) ekrandan kalkar. Taksit kartı yoksa karttan tahsilat yolu hiç kalmaz (2.0.18 Cari kutusu kararıyla birlikte). | Plansız kayıtta 'Taksit planı oluşturun' kısa yolu (hof-workspace.js:48) pratikte ulaşılmaz olur. | Sektör ayarındaki 'Tahsilat ve Kasa Takibi' kutusunun (hof-insight.js:876) görünür etkisi neredeyse kalmaz. | Gizli düğmeye tıklayan 6 e2e adımı 30 sn zaman aşımıyla kırmızı olur; hepsi birlikte değiştirilmezse CI kırılır. | 'Kayıt Kartından Tahsilatlar' raporunun adı yanıltıcı kalabilir (kayit-tahsilatlari).

[UI11] para=False 4sa
  DOKUNMA: hof-plans.js:361-362 outputButtons (ortak yardımcı); :421 'Liste - PDF'; :483 'Taksit Ekstresi - PDF' | hof-accounts.js:322 'Cari Listesi - PDF' + :305 'Excel' (data-xlsx); :361 'Cari Ekstre - PDF' | hof-stock.js:181 'PDF' + 'Excel' (data-xlsx YOK); :208 'Stok Kartı - PDF' | hof-invoices.js:293 'Liste - PDF/Liste - Excel' (.hof-rep-out); :306 'Seçilenleri PDF/Excel/e-Belge XML (ZIP)'; :2355 '<Tür> - PDF'; :288 liste görünümünde çift başlık <h3>moduleName</h3> (pencere başlığı :83-84) | hof-cheques.js:161 'Liste - PDF/Liste - Excel' (çift başlık 2.4.3'te düzeldi, :158) | hof-overview.js:364-368 exportButtons 'PDF İndir/Excel İndir' (kullanım :481, :521, :555, :685) | hof-report-center.js:329-330 'PDF İndir/Excel İndir' (:373 href güncellemesi sınıfa bakar) | hof-bank.js:1679-1682 movesExportHtml 'PDF İndir/Excel İndir' | hof-workspace.js:628 'Kasa Dökümü - PDF' (button data-pdf) | hof-reports.js:178 'Excel'/'PDF'/'Yazdır' | client/admin.html:110 'PDF'/'Excel' | hof-whatsapp.js:155 'Ekstre PDF' | hof-export.js:59-66,168 Dışa Aktar menüsü | hof-ui.css:6644-6669 (.hof-plan-output, 36 px) ve :8023-8055 (.hof-rep-export/.hof-rep-out renkleri)
  ÖNERİ: Kullanıcı kararı gerekir: 2.0.16 müşteri isteği 'düğme ne indirdiğini söyler' (CHANGELOG.md:289; hof-plans.js:360). Varsayılan öneri: LİSTE ve RAPOR düğmeleri tek ad 'PDF'/'Excel' olur (#1, #3, #8, #10, #11, #12, #13; neyin indirildiği title/aria-label'a yazılır). KART/BELGE düğmeleri (Cari Ekstre, Taksit Ekstresi, Stok Kartı, Fatura, Kasa Dökümü) 2.0.16 adıyla kalır ama aynı aileye geçer. Renk tek aileye CSS ile getirilir: .hof-plan-output a[data-pdf] is-pdf renklerini, a[data-xlsx] is-xlsx renklerini alır; stok Excel bağlantısına data-xlsx eklenir. 36 px kuralı korunur. Bütün data-* öznitelikleri ve sınıflar korunur. Fatura listesindeki çift başlık için hof-invoices.js:288'deki h3 yalnız liste görünümünde kaldırılır, <small> kalır (Çek / Senet ile aynı). Kart, form ve ayar görünümlerindeki h3 kalır.
  TEST: senaryo-banka-210.mjs:2577-2578 tam metin 'PDF İndir'/'Excel İndir' güncellenir. | senaryo-216.mjs:232 (/Alış Faturası - PDF/) ve :309 (/Cari Ekstre - PDF/) yalnız kart adları değişirse güncellenir. | senaryo-cari-243.mjs:240-244 PDF düğmesi yüksekliği ≤ seçici + 1 kalmalı. | Kılavuz adları güncellenir (metin-denetle.mjs adların ekranda birebir olmasını denetler): DestekOfis-Kullanim-Kilavuzu.html:136, 226-227, 335, 340, 363. | YENİ (eski kodda kırmızı): client/assets'teki .pdf/.xlsx dışa aktarım bağlantılarının görünen adını izinli kümeye ve tek sınıf ailesine karşı tarayan kaynak testi (CRLF-güvenli, ders 27). Ayrıca senaryo-211 gezintisinde ekran denetimi. | Fatura çift başlık: liste görünümünde .hof-invoices h3 sayısı 0 olmalı. uiux-b-243.mjs:319-335, senaryo-215/216/217 ve excel-denetim koşulur (kart h3'ü okuyorlar). | yazim-duzeni.test.mjs tek sözcüklü adları denetlemez (:99), kırılmaz.
  RİSK: 2.0.16 müşteri kararıyla çelişki; sormadan 'her yerde PDF' yapılırsa müşterinin istediği bilgi kaybolur. | Kılavuz ve ekran görüntüleri eskir; metin-denetle bölüm 7-8'i varsayılan denetler, öbür bölümler elle kontrol edilir. | hof-rep-out ailesine geçişte süzgeç satırı yüksekliği değişirse senaryo-cari-243 A12 kırılır. | Fatura liste h3'ünü kaldırırken kart/form h3'ü yanlışlıkla kaldırılırsa en az 8 e2e kırılır.

[UI9] para=False 1.5sa
  DOKUNMA: hof-overview.js:24-41 (COMPACT_NUMBER, compactMoney, moneyHtml ≥10 Mn) ve :628 (grafik ekseni): 2.4.3'te YAPILDI | server/lib/cash-report.mjs:138-139 ('1.849 hareket'): YAPILDI | hof-invoices.js:65 amountText = String(v).replace('.', ',') ile :1065 ürün seçilince birim fiyat; ayrıca :482, :1937, :2084 (toplam 20 çağrı); parseTl :54-60 | hof-plans.js:18 HOF.office.amountText (AMOUNT_FORMAT, 2 ondalık)
  ÖNERİ: Anlık Durum tarafında iş kalmadı; e2e uiux-a-243.mjs J bölümü (:396-406) koruyor. Kalan iş fatura alanında: yalnız fiyat atamalarında (:1065, :1937, :2084) tr-TR biçim kullanılır, en az 2 ve en çok 4 ondalık (Intl.NumberFormat tr-TR {minimumFractionDigits:2, maximumFractionDigits:4}). parseTl '1.249,90'ı zaten doğru çözer. HOF.office.amountText 2 ondalığa yuvarladığı için 4 ondalıklı birim fiyatta kullanılmaz.
  TEST: Fatura e2e: ürün seçince Birim Fiyat '1.249,90'. Kaydet → DB unit_price 1249.9 (ders 3/12). Tab ile çıkışta değer bozulmaz. | Komşular (ders 10): KDV dahil fiyat dönüşümü :1065, Satış Fiyatı düğmesi :1937, hesap sonucu :2084; 4 ondalıklı fiyat kaybolmaz.
  RİSK: amountText'in 20 çağrısının hepsini değiştirmek miktar alanını da biçimler; yalnız fiyat atamalarıyla sınırlı kalınmalı. | 4 ondalık birim fiyat 2 ondalığa yuvarlanırsa fatura toplamı değişir (para çekirdeği komşusu).

[KÖ3] para=False 5sa
  DOKUNMA: hof-sources.js:397-430 renderStart (#hof-start; h2 :410, yükleme :412-414, kılavuz :415); hasData :18 (sheetUrl) | hof-workspace.js:897-906 (Hızlı Arama kaydı, grup 'Ayar'), :965-969 (kullanıcı menüsü), :1322-1340 (kurtarma anahtarı hatırlatması kalıbı) | hof-insight.js:1244-1260 (#hof-intro tanıtımıyla yarışmamalı) | Durum kaynakları: HOF.user.company (hof-boot.js:352) / GET /api/companies (routes/companies.mjs:44); GET /api/workspace/invoices/meta settings.sellerReady/sellerName (routes/invoices.mjs:2303-2326); GET /api/workspace/bank/accounts?status=all (hof-bank.js:206); GET /api/admin/recovery (hof-workspace.js:1335); server/lib/companies.mjs:106/:158 varsayılan 'Şirket 1' | HOF.invoices (hof-invoices.js:3475): ayar penceresini doğrudan açan işlev YOK (ayar [data-act=settings] :292) | HOF.bank.open/openWizard (hof-bank.js:3231-3236), HOF.accounts.open
  ÖNERİ: Otomatik pencere açılmaz (e2e tıklamalarını keser). İki giriş olur. (1) #hof-start kartının içine, h2'ye ve .hof-drop'a dokunmadan, data-hof-ui taşıyan ve yalnız yöneticiye görünen #hof-getting-started bölümü. (2) Kullanıcı menüsünde ya da Hızlı Arama'da 'Başlarken' girişi; aynı listeyi HOF.modal'da açar. Maddeler: Şirket Adını Yazın, Firma Bilgilerini ve Fatura Ayarlarını Girin, İlk Banka Hesabını Açın, Carileri Yükleyin, Kullanıcıları Ekleyin, Kurtarma Anahtarı Oluşturun, isteğe bağlı Excel Tablosu. Her madde yetkiye bağlıdır (HOF.can). Okunamayan durum 'Bilinmiyor' yazılır (ders 4). Daha temiz yol tek okuma ucudur: GET /api/workspace/getting-started; yetkiye göre boolean döner, birim test yazılır, para çekirdeğine dokunmaz. Gereken ek: HOF.invoices.openSettings. Kapatma tercihi kişi+şirket başına; localStorage mı sunucu mu, karar gerekir.
  TEST: YENİ e2e: boş kurulumda yönetici listeyi görür, maddeler 'yapılmadı'. API ile firma bilgisi ve banka hesabı girilir, liste yenilenir, maddeler 'tamam'. Muhasebe/personel rolünde yetkisiz madde yok. Durum ucu 500 dönerse 'Bilinmiyor'. | Uç yazılırsa birim test: her yetki bileşimi ve 'Şirket 1' varsayılanı. | #hof-start'a bağlı e2e'ler koşulur: en az run.mjs:164-171, e2e-not-yaris.mjs:72, senaryo-form-izolasyon-243.mjs:846-859 (tıklama örtmesi ölçümü). | Yeni adlar yazim-duzeni.test.mjs'ten geçer; yeni data-requires kullanılırsa yetki-gorunurluk.test.mjs kuralı eklenir.
  RİSK: #hof-start h2 metni ya da yapısı değişirse 23 e2e kırılır. | hasData yalnız sheetUrl'e bakar: Excel'siz muhasebe kurulumunda kart hep durur ve ilk cümle 'Excelini yükle' kalır; başlık değişikliği kullanıcı kararıdır. | Bölüm data-hof-ui taşımazsa tek DOM izleyici döngüye girebilir. | Açılışta 4-5 ek istek yükü; tek uç bunu bire indirir.

[YAZIM-ARACLARI] para=False 0.5sa
  DOKUNMA: client/assets/hof-core.js:421-455 HOF.titleCase | server/lib/text-case.mjs (33 satır) | test/yazim-duzeni.test.mjs: SENTENCES :14-91, eligible :93-107 (2-7 sözcük, büyük harf ya da 'e-X'), violations :109-135, istemci taraması :138-142, hareket türü adları :146-166, React paketi :170-184, sunucu başlıkları :185+ | test/e2e/senaryo-211.mjs G adımları :342, :421-516
  ÖNERİ: 2.4.4'te eklenen her ad (Başlarken maddeleri, Seçilenleri Gönder, E-Fatura Portal, dışa aktarım adları) titleCase ile yazılır. Tek sözcüklü adlar test dışıdır, elle kontrol edilir. Cümle olarak kalacak kısa metinler SENTENCES listesine gerekçesiyle eklenir.
  TEST: npm test içinde yazim-duzeni.test.mjs koşar. | senaryo-211 ekran gezintisi: yeni pencereler (Başlarken, e-SMM) gezinti listesine eklenir.
  RİSK: 'e-SMM …' gibi küçük harfle başlayan adlar 2.4.3'ten beri denetleniyor (:96); kuraldaki 'e-' istisnasına uyulmazsa test kırılır.
SÜRPRİZ:
- UI11 'tek ad PDF/Excel', 2.0.16'daki müşteri kararını geri alıyor: 'PDF düğmeleri ne indirdiğini söyler' (CHANGELOG.md:289; kod yorumu hof-plans.js:360). 2.4.3-DEGISIKLIKLER.md:170 ise yalnız 'birleşme' diyor; tek kelime şart değil.
- UI11'in Çek / Senet çift başlık, 'Hareket Hareket' ve stok 5. kart alt maddeleri ile UI9'un Anlık Durum ve Kasa PDF alt maddeleri 2.4.3'te yapılmış (hof-cheques.js:158, hof-overview.js:28-31 ve :556, hof-ui.css:11106, cash-report.mjs:138). Kalanlar: fatura listesi çift başlığı (hof-invoices.js:288) ve fatura Birim Fiyat biçimi (hof-invoices.js:65/:1065).
- E8 tek başına CSS değil: boş geçmiş metni (hof-workspace.js:1178), yetki açıklaması (permissions.mjs:140) ve kılavuzun iki satırı (Kullanim-Kilavuzu.html:117 ve :288) da düğmeyi anlatıyor.
- E8'den sonra cariye bağlı kayıtta detay kartından tahsilat yolu hiç kalmaz (hof-workspace.js:268-275; 2.0.18 Cari kutusu da kaldırılmıştı). Plansız kayıtta 'Taksit planı oluşturun' kısa yolu (:48) pratikte ulaşılmaz olur.
- Gizli düğmeye tıklayan e2e adımı 6 tane (run.mjs:488/622/645, banka-210b:214, cari-243:173/206). En doğru yerine koyma API değil, aynı formu açan HOF.workspace.payment({key,title}) çağrısı; bu yol üretimde takvim ve zilden zaten kullanılıyor ve form/Tab kapsamını korur.
- hasData yalnız sheetUrl ayarına bakar (hof-sources.js:18); Excel'siz muhasebe kurulumunda 'Excelini yükle' kartı hiç kalkmaz. KÖ3'ün asıl şikâyeti bu.
- #hof-start 23 e2e dosyasının dayanağı; KÖ3 onun h2 metnine ya da drop alanına dokunursa geniş kırmızı çıkar.
- Fatura API'sinde ayar penceresini doğrudan açan işlev yok (HOF.invoices hof-invoices.js:3475); Başlarken'den Fatura Ayarları'na gitmek için küçük bir dışa açılım gerekir.
- Stok listesinin Excel bağlantısında data-xlsx yok (hof-stock.js:181); Cari'de var (hof-accounts.js:305). CSS ile renk birleştirmede bu fark yakalanmalı.
- Fatura kalemi ve Banka Sihirbazı'ndaki '▼' glifi istemci kodunda yok; büyük olasılıkla tarayıcının datalist oku (hof-core.js:1307). DOĞRULANMADI.
SORU:
- UI11: Kart ve belge düğmeleri ('Cari Ekstre - PDF', 'Taksit Ekstresi - PDF', 'Stok Kartı - PDF', '<Belge Türü> - PDF', 'Kasa Dökümü - PDF') 2.0.16 müşteri kararıyla adlı mı kalsın (öneri), yoksa her yerde yalnız 'PDF'/'Excel' mi olsun?
- UI11: Tek görsel aile hangisi olsun: kırmızı/yeşil tonlu .hof-rep-out (8 yer) mi, nötr hof-button-ghost (outputButtons, 7 yer) mi? Öneri: .hof-rep-out renkleri, 36 px korunarak.
- E8: Boş geçmiş metninden 'tahsilat' sözcüğünü çıkarmak tek satır JS değişikliği; 'koda dokunma' kararının istisnası olarak onaylanıyor mu? 'Görev' de metne eklensin mi?
- E8: payments.create yetkisinin Yönetim'deki açıklaması ('Kişi kartından tahsilat girer') güncellensin mi? Yetki adı aynı kalır, takvim ve zil yolu sürer.
- KÖ3: Kapatma tercihi bilgisayar başına (localStorage) mı, kullanıcı+şirket başına sunucuda mı tutulsun?
- KÖ3: Tek okuma ucu (GET /api/workspace/getting-started) mı yazılsın, yoksa yalnız var olan uçlarla mı (4-5 istek) yetinilsin?
- KÖ3: #hof-start başlığı ('Excelini yükle…') muhasebe kullanıcısı için değişsin mi? Değişirse run.mjs:165 beklentisi de değişir.

######## test-kapi
MİMARİ: Birim/API testleri `npm test` ile koşuyor (package.json:13: node --test --test-concurrency=1 "test/**/*.test.mjs"). Sunucu süreç içinde startTestServer ile açılıyor: lisans kilidi kapalı (enforce:false, test/helpers.mjs:23), lisans zamanlayıcısı kapalı (:24), sahte saat options.now ile (:46-48). Yerelde ~2.700 test 17-26 dakikada bitiyor. Uçtan uca testlerde 65 npm betiği var, 52'si CI'de (ci.yml:70-121). Her biri createApp + Playwright Chromium ile koşuyor (run.mjs:52-55). Sonuç satırlarını tools/kanit.mjs parseSummary okuyor (kanit.mjs:53-85). Kanıt aracındaki `kos` komutu testi kabuksuz koşturuyor ve hükmü veriyor (verdict kanit.mjs:162-171): GEÇTİ yalnız çıkış 0 + tanınan özet + 0 başarısız/iptal + en az 1 test olunca; başarısız test adları çıktının sonuna yazılıyor (91-160). `ci` komutu yalnız ci.yml koşularını okuyor; YEŞİL demesi için bütün işlerin success olması ve "Doğrulama Kapısı" işinin bulunması gerekiyor (332-358). Yalnız belge değişen commit'te hüküm koşusu olan en yakın ata commit'ten alınıyor (311-330). ci.yml'de 4 iş var: test (ubuntu/windows × Node 22/24), e2e, kapi (Doğrulama Kapısı; --beklenen 56 kayıt, --ayni-sayi ve --atlanan-yok npm-test-; ci.yml:139-161) ve package. gateVerdict (384-409) eksik kaydı, başka commit'i, kirli ağacı, platformlar arası sayı farkını ve atlanan testi kırmızı sayıyor. İmzalı paket releaseGate'e bağlı (kanit.mjs:492-501, release.mjs:27-28); release.yml yayımdan önce `ci --bekle 90` koşuyor (114-117). Stop/SubagentStop kancası durum yeşil değilse yanıtı bir kez durduruyor (.claude/settings.json; hookDecision 478-488). Uzun Doğrulama yalnız commit iletisinde [uzun-dogrulama] varsa ya da elle tetiklenince koşuyor: mutabakat 10+1, tek sıralı uzun mutabakat 10.000, güvenilirlik 10+1, kâhin e-Belge (önce test_model.py ve mutasyon.py, sonra 5 tohum × 300 işlem) ve 24 kayıtlık kapı (uzun-dogrulama.yml:31-169). Kaynağı tarayan denetimler: ci-kapi-listesi.test.mjs (ci adımları ↔ --beklenen iki yönlü; release.yml her CI e2e'sini koşmalı; Uzun Doğrulama matrisi ↔ kapı) ve kanit-araci.test.mjs:220-226 (paths-ignore == BELGE_YOLLARI, sıra dahil). Bu yüzden yeni bir e2e dört yere eklenmeli: package.json, ci.yml adımı, ci.yml --beklenen listesi, release.yml.
DEĞİŞMEZLER:
- "Geçti" yalnız şu durumda: çıkış 0 + tanınan özet + 0 başarısız + 0 iptal + en az 1 test. Özet yoksa BELİRSİZ, çıkış ile özet çelişirse ÇELİŞKİ (tools/kanit.mjs:162-171).
- Doğrulama Kapısı: 4 platform + bütün e2e aynı commit'te GEÇTİ; Linux ve Windows aynı test sayısı; npm-test'te atlanan yok; needs işleri success (ci.yml:158-161, kanit.mjs:384-409). Platforma özgü skip kapıyı kırmızıya çevirir.
- CI YEŞİL ancak şu durumda: ci.yml koşuları bitmiş, bütün işler success, kapı işi var. Atlanan iş KIRMIZI, başka iş akışı hükme girmez (kanit.mjs:332-358).
- Yalnız belge commit'i hükmü atadan alır; kod commit'inin koşusu yoksa BELİRSİZ kalır, asla YEŞİL olmaz (kanit.mjs:311-330).
- İmzalı paket yalnız temiz ağaçtan ve CI'si YEŞİL commit'ten üretilir; atlatma seçeneği yok (kanit.mjs:492-501, release.mjs:27-28, release.yml:114-117).
- ci.yml'deki her `kanit kos` adı kapının --beklenen listesinde olmalı, fazlası da olmamalı; release.yml CI'nin her e2e betiğini koşmalı (test/ci-kapi-listesi.test.mjs:38-56).
- ci.yml push paths-ignore girdileri çift tırnaklı ve sırası BELGE_YOLLARI ile aynı olmalı (test/kanit-araci.test.mjs:220-226). yalnizBelge yalnız tam eşleşme ve /** destekler (kanit.mjs:297-298).
- Gerçek programı ayrı süreçte açan test HUKUK_LICENSE_URL=http://127.0.0.1:9 vermeli. Denetim test/lisans-servisi-izolasyonu.test.mjs:25-45 yalnız test/ altındaki .mjs dosyalarını tarıyor.
- Uzun Doğrulama: her matriste max-parallel ≤6, işler yalnız herkese açık depoda, varsayılanlar 5000/10000, tek sıralı uzun mutabakat 10000 işlem (ci-kapi-listesi.test.mjs:95-111).

[E3] para=False 2.5sa
  DOKUNMA: test/gg243-dar-kontrol-gonderim.test.mjs:29-42 (setup, fetchImpl gecikmeleri) | test/gg243-dar-kontrol-gonderim.test.mjs:311-337 (D2 all/ids; ön koşul :323-324, slowTaxNo :313, sleep(100) :321) | server/routes/invoices.mjs:3385-3392 sendInvoice→holdInvoice, :3401 einvoice-already-sent ön denetimi | server/routes/invoices.mjs:3732-3739 releasedWithin (100 ms yoklama), :3783-3790 einvoice-sending→done, :3794-3797 already-sent→done, :138 SEND_BUDGET_MS
  ÖNERİ: Kök neden (koddan çıkarım, CI günlüğünde DOĞRULANMADI): B oturumu A'nın arkasından 100 ms'lik yoklamayla ilerliyor. A'nın belge başı süresi ≥~100 ms olunca B her belgede A'yı gönderimin ortasında yakalıyor. O zaman sonuç kodu hep einvoice-sending çıkıyor, test ise yalnız einvoice-already-sent'i ön koşul sayıyor. Ürünün iki yolu da doğru. Önce zorla kırmızı (ders 20): D2 setup'ına GG243_D2_ZORLA_YAVAS_MS ortam değişkeni eklenir (sendDelayMs olarak). 150 ms ile mevcut test her seferinde kırmızı vermeli. Sonra yalnız testte belirlenimci tasarım: fetchImpl'de SendInvoice sayacı. 2. SendInvoice geldiğinde (doc0 bitmiş ve veri tabanına yazılmış) firstDone sözü çözülür ve A doc1'de bir kapı sözünde bekletilir. B ancak firstDone'dan sonra başlar; kapı setTimeout(300) ile açılır (finally'de de açılır). Ön koşul `raced.some(x => x.id === docs[0].id)` olarak güçlenir; slowTaxNo ve sleep(100) kalkar; diğer iddialar aynen kalır. Ürün koduna dokunulmaz.
  TEST: GG243_D2_ZORLA_YAVAS_MS=150 node --test --test-name-pattern "D2" test/gg243-dar-kontrol-gonderim.test.mjs → mevcut testte ön koşul kırmızı (kanıt: kanit kos d2-zorla-kirmizi) | Yeni D2: 0/150/400 ms zorlamalarıyla yeşil (ön koşulun oluştuğu her denemede) | Yeni D2, D2 düzeltmesinden önceki kodda kırmızı: commit origin/claude/hopeful-goodall-6nmtcj geçmişinde aranır, ayrı worktree/archive kopyasında koşulur (ders 7, 23, 25) | Bitişte tam npm test; CI'de Linux ve Windows
  RİSK: Kapı sözü açılmazsa A asılı kalır → finally ile açılmalı ve test zaman aşımı konmalı | Kapı 10 sn'yi (releasedWithin) aşarsa busy sonucu çıkar ve failed sayısı iddiası (:328) bozulur; 300 ms geniş pay bırakıyor | CI #842'de hangi işin düştüğü okunamadı (ders 4); mekanizma bir çıkarım | D2 düzeltmesinden önceki commit sığ depoda yok (git fetch --unshallow gerekli)

[E8-test] para=False 3sa
  DOKUNMA: test/e2e/run.mjs:487-489 (tahsilat işle/düzelt/sil adımı) | test/e2e/run.mjs:621-623 (Plan yokken Tahsilat + 'Taksit planı oluşturun' kısa yolu) | test/e2e/run.mjs:644-650 (taksit seçici → Tahsil Et 1.000,00) | test/e2e/senaryo-banka-210b.mjs:213-238 (Havale/EFT banka hesabı seçicisi) | test/e2e/senaryo-cari-243.mjs:170-185 (kayıttan tahsilat kaydın defterine, 321) | test/e2e/senaryo-cari-243.mjs:187-219 (bağlı cariye tahsilat 500, İşlem Geçmişi, rapor) | client/assets/hof-workspace.js:1212 düğme, :255-279 üç dal, :35-73 paymentForm POST /api/workspace/cases/:key/payments; server/routes/workspace.mjs:392-430 | client/assets/hof-ui.css:2121-2125 (mevcut koşullu gizleme), hof-insight.js:114 | test/e2e/run.mjs:1216 (emsal: getComputedStyle display denetimi)
  ÖNERİ: Bu düğmeye tıklayan e2e'ler yalnız bu 6 yer (grep; başka seçici yok). (1) run.mjs:488: page fetch ile POST cases/<seçili>/payments {amount:'1.250', note:'Elden', method:'cash'} → durum 200 + veri tabanı → HOF.workspace.refreshActivity() → kalan adım aynen. (2) run.mjs:622: kısa yol karttan kayboluyor; kart formu aynı işlevle açılır: HOF.plans.openNew({caseKey:'2026/101', …}) (hof-workspace.js:58). (3) run.mjs:645: API gerekmiyor; #hof-case-plan'daki ₺ düğmesi [data-case-collect] aynı HOF.plans.collect'i çağırıyor. (4) banka-210b: seçici denetimi yaşayan şerit yoluyla korunur (HOF.workspace.payment({key, title, amount:1500})) ya da tümüyle API (seçenek listesi iddiası düşer). (5) cari-243:173: api.post cases/2026%2F100/payments {amount:'321'}. (6) cari-243:206: Cari Kartı → [data-entry="in"] + Tahsilat 500; rapor bağlı carinin bütün 'in' hareketlerini aldığı için (report-center.mjs:2560-2570) yeşil kalmalı (DOĞRULANMADI). Yeni denetim: tahsilat modülü açıkken düğmenin display değeri 'none' olmalı ve düğme DOM'da durmalı; eski kodda kırmızı görülür.
  TEST: run.mjs: yeni 'düğme görünmez' denetimi (eski kopyada kırmızı, ders 7/23) | run.mjs, senaryo-banka-210b, senaryo-cari-243 değişen adımlarla koşulup yeşil görülür (ders 28) | Bütün CI e2e + CI dışı 13 betik + ui-ux-217 (ders 8/35) | Her API adımında yanıt kodu, gövde ve veri tabanı sayısı okunur (ders 3)
  RİSK: 'Taksit planı oluşturun' kısa yolu ve kayda bağlı cariye kayıttan tahsilat dalı karttan ulaşılamaz olur (ürün kaybı) | Canlı olay kendi oturumuna geliyor mu DOĞRULANMADI → refreshActivity açıkça çağrılmalı | 'Kayıt Kartından Tahsilatlar' raporunun adı/açıklaması ve kılavuzdaki iki cümle eskir | Boş geçmiş metni JS'te (hof-workspace.js:1178-1179); yalnız CSS ile düzelmez

[H] para=False 0.3sa — YAPILDI 21.10.2026 (docs/erp/** ile birlikte; eski araçta 47/48, yenide 51/51)
  DOKUNMA: tools/kanit.mjs:297 BELGE_YOLLARI dizisi | .github/workflows/ci.yml:8-16 paths-ignore (yeni satır :13'ten sonra) | test/kanit-araci.test.mjs:214-226 (aynılık testi; isteğe bağlı yeni iddia :218) | CLAUDE.md 'Doğrulama kapısı → YALNIZ BELGE' paragrafı (belge)
  ÖNERİ: Aynı sırayla "docs/2.4.3-IS-LISTESI.md"den sonra "docs/2.4.4-IS-LISTESI.md" eklenir. kanit.mjs dizisine dizi öğesi olarak; ci.yml'e `      - "docs/2.4.4-IS-LISTESI.md"` olarak (çift tırnak, 6 boşluk). kanit-araci aynılığı zaten denetliyor; testin dişi için `assert.equal(yalnizBelge(["docs/2.4.4-IS-LISTESI.md"]), true)` eklenir. İlk kod push'uyla birlikte gönderilir (ders 26). Joker desteği istenirse yalnizBelge'ye ve paths-ignore'a birlikte eklenmeli.
  TEST: node --test test/kanit-araci.test.mjs test/ci-kapi-listesi.test.mjs | Yeni iddia eski araçta kırmızı | Push sonrası kanit.mjs ci <sha> --bekle
  RİSK: Sıra ya da tırnak farkı → kanit-araci deepEqual kırmızı | İş listesini testler okursa (bugün okumuyor) yalnız belge sayılmamalı

[YEREL-RECETE] para=False 0.5sa
  DOKUNMA: package.json:13-88 betikler | test/helpers.mjs:9-69 | PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers (chromium-1194) | tools/check-syntax.mjs | tools/kanit.mjs kos/ozet/ci
  ÖNERİ: Sıra: df -h / → git fetch --unshallow --tags origin (yerelde 0 etiket var; etiket isteyen testler ATLANIR, senaryo-banka-210-temel v2.0.23 ister) → npm ci (bağ kurulmaz, ders 29) → npm run check → değişen alanın testi `node --test test/X.test.mjs` → bitişte bir kez `node tools/kanit.mjs kos npm-test-244 -- npm test` (~17-26 dk) → e2e `kanit kos e2e-<ad> -- npm run test:<ad>`. Süreler: run.mjs ~145 sn, CI e2e toplamı ~55 dk, ui-ux-217 ~180 sn. Yavaş makine benzetimi: HOF_CPU_YAVASLAT=4 + --import ./test/e2e/cpu-yavaslat.mjs. Ölçümler tek tek (ders 15), pkill yok (ders 36).
  TEST: kanit ozet docs/kanit/<gün> çıkışı 0
  RİSK: Depodaki playwright 1.56.0 ile /opt/pw-browsers'taki chromium-1194'ün uyumu DOĞRULANMADI | --unshallow ve etiket çekme ağ ister (koşulmadı)

[UZUN-KAHIN] para=True 4sa
  DOKUNMA: .github/workflows/uzun-dogrulama.yml:123-147 kahin_ebelge | test/bagimsiz/ebelge/fark.py:11-19 değişmezler I0-I19 (I15 = D2) | test/bagimsiz/ebelge/uretici.py:9, 69, 87-94 (tümü/seçili/eşzamanlı Tümünü Gönder) | tools/kanit.mjs:411-431 readRecords (kâhin çıktı JSON'ları kayıt sayılmaz)
  ÖNERİ: Kâhin e-Belge tek iş: önce modelin birim testi ve mutasyon testi, sonra 5 tohum × 300 işlem ve küçültme. E6 Seçilenleri Gönder ids yolunu kullanırsa kâhin kapsamında. Ancak 'gönderimden önce söyle' ön denetimi ve e-SMM (ESM serisi) için model/üretici/koşucu genişletilmeli; bunu ürün kodunu görmeyen el yazmalı (ders 5). Defter kâhini Uzun Doğrulama'da yok, elle koşulur. Uzun koşu yalnız son adayda, [uzun-dogrulama] ile.
  TEST: python3 test/bagimsiz/ebelge/test_model.py && python3 test/bagimsiz/ebelge/mutasyon.py | npm run test:kahin-ebelge -- --tohumlar 1-5 --islem 300 --kucult
  RİSK: Kâhin dilinde e-SMM yok → E1 için bağımsız beklenen değer eksik | Modeli ürünle aynı el genişletirse kâhin sayılmaz
SÜRPRİZ:
- E9 için güçlü iz (DOĞRULANMADI). windows.yml install-test gerçek kurulumu Windows servisi olarak açıyor (windows.yml:55-68). Servis ortamında HUKUK_LICENSE_URL yok (packaging/windows/bin/servis-kur.cmd:58 yalnız INSTALL_ROOT/NODE_ENV/NODE_OPTIONS veriyor). Bu yüzden program gerçek https://destek-ofis.vercel.app/api/lisans adresine gidip 3 sn sonra deneme başlatıyor (license.mjs:33, 229-230). test/guncelleme-gercek/windows-kurulum.mjs:123-127 sınama sürümünü kurulu sürüm 2.4.3'ten türetiyor: next2 = 2.4.5, servis W3'te bu sürümle çalışıyor. Master birleşmesi 163dd5d 19.10 14:24 TR; Operatör Merkezi'ndeki son kayıt 19.10 15:30 TR ile uyumlu. lisans-servisi-izolasyonu testi iş akışlarını ve Inno kurulumunu taramıyor (:25).
- D2'nin aralıklı kırmızısı ürün hatası değil, testin dar ön koşulu: ürünün iki doğru yolundan (einvoice-sending→done ve einvoice-already-sent→done) yalnız birini kabul ediyor; yavaş koşucuda o yol hiç oluşmuyor.
- E8 yalnız CSS ile yapılırsa kullanıcı yolu kaybı var: 'Taksit planı oluşturun' kısa yolu (run.mjs:622 bunu sınıyor) ve kayda bağlı cariye kayıttan tahsilat dalı karttan ulaşılamaz olur. Ayrıca 'Kayıt Kartından Tahsilatlar' raporunun adı (report-center.mjs:2552-2555) ve kılavuzdaki 'Kartın düğmeleriyle Not, Telefon, Tahsilat…' ile 'kişinin kartındaki Tahsilat taksitlerini gösterir' cümleleri eskir. Boş geçmiş metni JS'te (hof-workspace.js:1178-1179); yalnız CSS ile düzelmez.
- Yerel depo sığ ve etiketsiz (0 etiket). Yerel npm test eski sürüm testlerini sessizce atlıyor (tagsAvailable), bu yüzden CI eşdeğeri sayılmaz.
- release.yml test işi testleri kanıt aracı olmadan koşuyor (release.yml:39-92); hüküm yalnız çıkış koduyla veriliyor, kapı yayın aşamasında ci.yml'den okunuyor.
- Windows'a özgü yeni testler (E7 Edge/başlatıcı) skip ile yazılırsa --atlanan-yok ve --ayni-sayi yüzünden Doğrulama Kapısı kırmızı olur; koşullu doğrulama gerekir.
- yalnizBelge joker desteklemiyor (kanit.mjs:298); her sürümün iş listesi BELGE_YOLLARI'na elle ekleniyor. 18.10 önlemi 2.4.4 için uygulanmamıştı → YAPILDI 21.10.2026 (+ docs/erp/**).
SORU:
- CI #842 b68aafe'de kırmızı olan iş hangisi (Linux mu Windows mu, hangi Node, D2 all mı ids mi)? Günlük okunmadı; mcp__github__get_job_logs ile okunmalı.
- D2 düzeltmesinden önceki commit hangisi? Kırmızı kanıt için gerekli; origin/claude/hopeful-goodall-6nmtcj geçmişinde aranmalı (önce --unshallow).
- E8: 'Taksit planı oluşturun' kısa yolunun ve kayıttan cari tahsilatı yolunun karttan kalkması kullanıcıya söylenip kabul edilecek mi? Rapor adı ve kılavuz cümleleri değişecek mi?
- E8: senaryo-banka-210b adım 1'deki banka hesabı seçici denetimi şerit yoluyla (HOF.workspace.payment) korunsun mu, yoksa tümüyle API'ye mi geçilsin?
- E9: windows.yml install-test'te lisans adresi nasıl kapatılacak — hosts dosyası mı, güvenlik duvarı mı, nssm AppEnvironmentExtra mı? Servisin makine ortam değişkenini yeniden başlatmadan görüp görmediği DOĞRULANMADI.

######## lisans-sizinti (E9 — testlerin gerçek lisans servisine sızması)
MİMARİ: Varsayılan lisans adresi server/lib/license.mjs:33 (https://destek-ofis.vercel.app/api/lisans). Asıl adres server/lib/config.mjs:60'ta seçilir: önce overrides.licenseServices, sonra env.HUKUK_LICENSE_URL, en son varsayılan; env, :24'te process.env ile overrides.env birleştirilerek kurulur. app.mjs:216–231 hizmeti config.licenseServices ve config.fetchImpl ile kurar; overrides.license en sonda yayılır (bu satırlar test/vekil-sunucu-uygulama.test.mjs:210 ile sabitlenmiş). app.mjs:561 startLicenseTimers false değilse license.start() çağırır; :740 kapanışta ilk await'ten önce eşzamanlı license.stop() çağırır. Kendiliğinden deneme license.mjs:536'daki koşula bağlıdır (enforce && autoTrial && belirteç yok && geçiş dönemi yok); :538–559 ilk denemeyi 3 sn sonra /v1/activate ile yapar, belirteç varsa :588–605 ilk denetimi 30 sn sonra /v1/check ile yapar. Gövde :368–373'te product, version, machine ve instanceId taşır. Bilgisayar kimliği machine.mjs:16–20'de Windows MachineGuid'in SHA-256 özetidir; lisans servisi denemeyi bilgisayara bağlar (docs/LISANS.md:116–117 "varsa aynı deneme döner"). Servis yöneticisi supervisor.mjs:105 ve :147–160'ta ortamı olduğu gibi server.mjs'e geçirir. Windows'ta ise bootstrap.mjs:72–94 ortamı nssm'den alır, nssm de servis-kur.cmd:58 AppEnvironmentExtra'da yalnız HUKUK_INSTALL_ROOT, NODE_ENV ve NODE_OPTIONS verir; yani HUKUK_LICENSE_URL kurulu servise hiç ulaşmaz. Sızıntı .github/workflows/windows.yml install-test işinde: iş gerçek kurulum paketini kuruyor (:55–68) ve test/guncelleme-gercek/windows-kurulum.mjs (:150) servisi Restart-Service ile yeniden başlatıp :123–127'de kurulu sürüm +1/+2/+3 test sürümleri üretiyor; 2.4.3 + 2 = 2.4.5 W3'te kuruluyor ve W4 boyunca dakikalarca çalışıyor. release.yml:94–97 her v* etiketinde windows.yml'i çağırıyor. Yönetici özeti GET /api/license (routes/license.mjs:11) autoTrial.lastError ve state döndürüyor; nöbetçi adımı bunu kullanabilir. Testlerde helpers.mjs:23–24 varsayılan olarak enforce:false verir ve zamanlayıcıyı kapatır; tarama testi test/lisans-servisi-izolasyonu.test.mjs:13–34 yalnız test/*.mjs altındaki Node süreç başlatıcılarını dosya düzeyinde arar.
DEĞİŞMEZLER:
- Üretim varsayılanı gerçek adres kalır (license.mjs:33); test yalıtımı için ürün kodu değişmez (kullanıcı kararı 15.10: önlem yalnız testlerde/iş akışında)
- Adres önceliği config.mjs:60 (overrides.licenseServices → env.HUKUK_LICENSE_URL → varsayılan); app.mjs:226–227 metni vekil-sunucu-uygulama.test.mjs:210 ile sabit
- Operatör Merkezi kayıtları silinmez; Supabase yalnız okunur (15.10 kararı, DURUM-VE-DEVAM.md:59)
- Kendiliğinden deneme yalnız enforce && autoTrial && !token && geçiş dönemi yokken (license.mjs:536); enforce:false tek başına yeterli koruma
- helpers.mjs:23–24 varsayılanı enforce:false + startLicenseTimers false kalır
- Lisans yanıtları imzalı; adres değişikliği güveni zayıflatmaz (license.mjs:31–32)
- windows.yml adımları yalnız salt okunurda izinli yolları kullanır (/api/auth, /api/admin, GET — license.mjs:57–66), yani lisans 'none' durumunda da çalışmalı

[E9a] para=False 1sa
  DOKUNMA: .github/workflows/windows.yml:50-55 (download-artifact ile 'Sessiz sunucu kurulumu' arasına yeni adım) | server/lib/license.mjs:33 (adlar buradan türetilir) | packaging/windows/bin/servis-kur.cmd:58 (neden: servis ortamı) | .github/workflows/release.yml:94-97 (windows.yml'i çağırır, kendiliğinden kapsanır)
  ÖNERİ: Ürün koduna dokunmadan, kurulumdan ÖNCE lisans servisi adlarını makine düzeyinde ölü adrese yönlendir. Adlar node -e ile DEFAULT_LICENSE_SERVICES'ten türetilir (içe aktarma zinciri yalnız node yerleşikleri, npm ci gerekmez). Her ad için hosts dosyasına 127.0.0.1 ve ::1 satırı yazılır, ardından Clear-DnsClientCache. [System.Net.Dns]::GetHostAddresses ile her adın yalnız loopback'e çözüldüğü doğrulanır; değilse adım kırmızı olur. Sonuçta program +3 sn'de ECONNREFUSED alır, belirteç oluşmaz, lisans 'none' kalır. Bu değişiklik 2.4.4'ün master'a girdiği PR'ın içinde olmalı: windows.yml master push'ta tetiklenir; fix olmadan 2.4.4 yayını 2.4.5/2.4.6 ile yeniden sızdırır.
  TEST: test/lisans-servisi-izolasyonu.test.mjs yeni test: Windows paketini kuran ya da servisi başlatan her iş akışında (DestekOfis-Kurulum, Start-Process $setup, nssm, Restart-/Start-Service DestekOfis, windows-kurulum.mjs) engel adımı İLK kurulumdan önce yer alır ve DEFAULT_LICENSE_SERVICES'i okur; satır bölme /\r?\n/ (ders 27). Bugünkü ağaçta kırmızı olur | windows.yml workflow_dispatch ile çalışma dalında iki yeşil koşu (ders 18) | Bağımsız kâhin: düzeltilmiş koşuların saatlerinde Operatör Merkezi'nde o makine için yeni olay yok (yalnız okuma, kullanıcı onayıyla)
  RİSK: hosts yazımı yönetici ister; GitHub Windows koşucusu yöneticidir ama bu imajda DOĞRULANMADI (adım kendini doğrular) | Program artık salt okunur 'none' durumunda koşar; koddan yalnız izinli yollar kullanılıyor (windows-kurulum.mjs:110,116,266,319), ilk koşuda DOĞRULANMADI | 127.0.0.1:443'te bir şey dinliyorsa sonuç ECONNREFUSED değil TLS hatası olur; engel yine tutar

[E9b] para=False 0.5sa
  DOKUNMA: .github/workflows/windows.yml:101-112 sonrası (yeni nöbetçi adımı) | server/routes/license.mjs:11-14 GET /api/license | server/lib/license.mjs:619-656 (autoTrial.lastError/attempts, state) | .github/workflows/windows.yml:208-212 Günlükler (isteğe bağlı Select-String 'deneme|Lisans durumu')
  ÖNERİ: Admin (Windows-Testi-2026) ile giriş yapılır ve en çok 30 sn boyunca GET /api/license, autoTrial.attempts >= 1 olana dek sorulur. state 'none' değilse kırmızı ('lisans servisine ULAŞTI'). lastError 'ulaşılamadı|çözülemedi|Güvenli bağlantı|zamanında yanıt' desenine uymuyorsa da kırmızı.
  TEST: lisans-servisi-izolasyonu.test.mjs: windows.yml'de kurulumdan sonra /api/license + state 'none' iddiası var | Güvenli mutasyon (isteğe bağlı): hosts adı 127.0.0.1'de 200 + JSON olmayan yanıt veren yerel sunucuya yönlendirilince ikinci iddia kırmızı olur; dışarı çıkılmaz | ESKİ windows.yml kırmızı görmek için KOŞULMAZ (yeniden gerçek kayıt düşer); bu DENENMEYEN'e yazılır
  RİSK: Deneme ilk 3 sn'de olur; adım yavaşsa döngü bekler | ConvertFrom-Json -AsHashtable gerekebilir (giriş yanıtındaki gibi)

[E9c] para=False 1.5sa
  DOKUNMA: test/lisans-servisi-izolasyonu.test.mjs:13 (STARTERS), :15-25 (yalnız test/ yürür), :28 (spawn deseni), :33 (dosya düzeyi includes)
  ÖNERİ: Taramayı genişlet: (1) tools/ da taranır; tools/build-windows.mjs gerekçeli istisna olur (15.10 kırmızısındaki yanlış pozitif). (2) .github/workflows/*.yml için E9a ve E9b testleri. (3) HUKUK_LICENSE_URL denetimi mümkünse çağrı düzeyine iner (her spawn/fork/execFile/startSupervisor env'i). (4) Aynı süreçteki createApp( çağrılarının seçeneği enforce:false, startLicenseTimers:false, services/licenseServices ya da bilinen güvenli değişkenlerden birini içermeli: helpers, baseOptions(, appOptions(, run.mjs:47-49 unlicensed/licenseOptions. Çağrı sınırı paren eşleştirmeyle bulunur.
  TEST: Yeni taramanın eski ağaçta kırmızısı (windows.yml engelsiz; update-flow.test.mjs:49 ve tools/mutabakat.mjs:63), benzersiz klasörde git archive ile (ders 23/25), kanit.mjs kos ile kayıt | Yenide yeşil; Windows CI'de de yeşil (CRLF, ders 27)
  RİSK: Desenler fazla geniş olursa yanlış pozitif çıkar; istisnalar gerekçeli liste olarak tutulur | Çağrı düzeyi env çözümlemesi statik analizde kırılgan; dosya düzeyi yedek olarak kalabilir

[E9d] para=False 0.25sa
  DOKUNMA: test/update-flow.test.mjs:49 (tohum createApp) | tools/mutabakat.mjs:63
  ÖNERİ: İki gizli korumasız createApp çağrısına startLicenseTimers: false eklenir. Bugün pratikte sızmazlar (3 sn dolmadan app.close() → license.stop()), ama tarama testi bunları yakalamalı ve davranış değişmez.
  TEST: E9c(4) taraması yeşil | update-flow.test.mjs aynen geçer; npm run mutabakat çıktısı aynı
  RİSK: Yok denecek kadar az; init yine çalışır, yalnız zamanlayıcı kurulmaz

[E9e] para=False 0.75sa
  DOKUNMA: .github/workflows/ci.yml test (Linux+Windows) ve e2e işleri | .github/workflows/release.yml test işi | .github/workflows/uzun-dogrulama.yml işleri | test/ci-kapi-listesi.test.mjs:12-13,62 (bu dosyaları okur)
  ÖNERİ: Önerilen, ucuz ikinci kat: program kodu koşan her CI işinin ilk adımı koşucu düzeyinde engel olur (Windows hosts; Linux 'sudo tee -a /etc/hosts'), ya da en az iş düzeyinde env HUKUK_LICENSE_URL=http://127.0.0.1:9 verilir. Böylece testlerin tek tek env disiplinine bağımlılık kalkar. Tarama testi her işte bu adımı arar.
  TEST: ci-kapi-listesi.test.mjs ve kanit-araci.test.mjs yeşil kalır (ders 28: koşulup görülür) | 4 platform + e2e CI yeşil
  RİSK: ci.yml metin denetimleri yeni adımla bozulabilir | Kullanıcı kararı gerekir (kapsam: zorunlu değil, katmanlı savunma)

[E9f] para=False 0.5sa
  DOKUNMA: Supabase lvzaeekyovhquljzesye şema lisans (installations/events) — YALNIZ OKUMA | gh run list --workflow windows.yml / mcp__github__get_job_logs | CLAUDE.md ders 30 metni
  ÖNERİ: Ana oturum, kullanıcı onayıyla salt okuma sorgusu yapar: db54a00b… kaydının olaylarındaki sürüm/zaman geçmişi. Beklenen sıra: 9.0.0 (15.10 07:04 UTC), sonra windows.yml koşu saatlerinde 2.3.x/2.4.x, en son 2.4.5 (~19.10 12:30 UTC). Bu saatler windows.yml koşu saatleriyle eşlenir. Ders 30'a ek cümle: Windows kurulum paketi/servisi adım ortamını almaz; windows.yml hosts engeli + nöbetçi; tarama .github ve tools'u da kapsar. Kayıtlar silinmez.
  TEST: Düzeltme sonrası windows.yml koşu saatlerinde yeni olay yok (bağımsız kâhin, ders 5)
  RİSK: Sütun adları bilinmiyor (önce list_tables) | Ağ isteği; yalnız ana oturum ve kullanıcı onayıyla
SÜRPRİZ:
- Sızıntı bir test dosyasında değil: GERÇEK kurulum paketiyle kurulan Windows servisinde (windows.yml install-test). Servisin ortamı servis-kur.cmd:58 nssm AppEnvironmentExtra'dan gelir ve adım env'i servise geçmez. Bu iş her master push'unda ve her yayında (release.yml:97) koşuyor
- '2.4.5' dizesi depoda yok. Onu çalıştırabilen tek kod windows-kurulum.mjs:126 next2 = kurulu sürüm (2.4.3) + 2; W3'te kurulup W4 boyunca dakikalarca çalışıyor, 30 sn'de bir /v1/check ile sürümünü bildiriyor
- Sızıntının yaşı: kendiliğinden deneme 25.09 17:54 UTC'de (171ba63) eklendi, windows.yml CI düzeltmeleri aynı gün 19:12–19:39 UTC. Operatör Merkezi'ndeki diğer Azure kaydı '2.0.12 (25–30.09)' de bu sınıfta
- '2.4.5' kaydının ilk görülmesi (15.10 10:04 TR = 07:04 UTC), GECMIS-KARARLAR.md:1780–1781'deki 9.0.0 kaydı db54a00b ile aynı dakika. Büyük olasılıkla aynı kayıt: GitHub Windows VM'leri aynı imajdan MachineGuid'i paylaşıyorsa ci.yml npm testi ve windows.yml aynı kaydı günceller; 210ac8e npm-test raporlarını kesince sürümü yalnız windows.yml çevirdi. DOĞRULANMADI
- Benzetim ile gerçek ayrışıyor (ders 14/18): Linux kuru koşusu windows-kuru.mjs:63 sahte servise HUKUK_LICENSE_URL veriyor (yalıtılmış), gerçek Windows servisi vermiyor
- 210ac8e'nin kırmızı kanıtı test/ + tools/ taramasıyla 8 dosya listeliyordu (tools/build-windows.mjs yanlış pozitif). İşlenen test yalnız test/*.mjs yürüyor (:25); .github/workflows, packaging ve tools kör. İşlenen hâlin kendi kırmızısı ayrıca görülmedi
- Tarama HUKUK_LICENSE_URL'ü dosya düzeyinde includes ile arıyor (:33). Aynı dosyada korumasız ikinci bir başlatıcı gözden kaçar; ör. update-flow.test.mjs:49 tohum createApp'ı zamanlayıcıyı kapatmıyor
- 210ac8e yerelde yok (sığ klon + squash); içerik ec1ef3f diff'inden okundu
- Düzeltme sonrası windows.yml'deki program paylaşılan deneme yerine 'none' (salt okunur) durumunda koşacak. Koddan kırılma beklenmiyor ama ilk koşuda DOĞRULANMADI
- Ajan kapsayıcısında elle 'npm start' / 'start:service' (package.json:11,87) de gerçek servise gider; ders 30 kapsamında değil
- 2.4.4'ün kendi yayını (master push + etiket) düzeltme girmeden koşarsa 2.4.5/2.4.6 ile yeniden sızar; E9a aynı PR'da olmalı
SORU:
- Operatör Merkezi'nde db54a00b… kaydının olay/sürüm geçmişi salt okunur olarak sorgulanacak mı (kullanıcı onayı; ağ isteği yalnız ana oturumdan)?
- windows.yml çalışma dalında workflow_dispatch ile iki kez koşturulacak mı (ders 18; kamuya açık depo, ücretsiz, koşu başına yaklaşık 1 saat)?
- E9e ikinci kat (bütün CI işlerinde koşucu düzeyinde hosts engeli ya da iş düzeyi HUKUK_LICENSE_URL) 2.4.4'e alınacak mı?
- Nöbetçinin gerçek Windows kırmızısı, eski windows.yml koşturulup bir kez daha gerçek kayıt düşürülerek mi alınacak, yoksa (önerilen) DENENMEYEN'e yazılıp geçmiş Operatör Merkezi kayıtları ve güvenli mutasyonla mı kanıtlanacak?
- Ajan kapsayıcısında elle 'npm start' de gerçek servise gidiyor; ders 30 metni ajanlar için 'HUKUK_LICENSE_URL=http://127.0.0.1:9 ile başlat' diye genişletilecek mi?

######## baslatici-portal
MİMARİ: Go başlatıcı kısa ömürlü bir istemcidir. Masaüstü kısayolu onu çalıştırır, o da sunucuyu sırayla arar: önce kayıtlı adres, sonra 127.0.0.1, sonra UDP keşif, en son bilgisayar adı (launcher/main.go:39-67, discovery.go:88). Sunucuyu /api/health ile doğrular (health.go:13-35), DestekOfis'i açar ve kapanır (main.go:139-142). Yerel dinleyicisi, kalıcı süreci ve özel protokolü yoktur. Pencereyi tam olarak `msedge.exe --app=<url> --new-window` komutuyla açar (platform_windows.go:69). Komutta --user-data-dir, --start-maximized ve --no-first-run yoktur. Bu yüzden DestekOfis kullanıcının VARSAYILAN Edge profilinde (kalıcı, normal Edge ile ortak) açılır. Edge/Chrome bulunamazsa ya da ayar browser=default ise rundll32 ile varsayılan tarayıcı kullanılır (platform_windows.go:75). Ayar dosyası %APPDATA%\DestekOfis\istemci.json'dır (config.go:16-31). Kurulum Inno Setup ile yapılır, yönetici yetkisi ister (setup.iss:56). Başlatıcı hem sunucuya hem personel bilgisayarına kurulur (setup.iss:80,93). setup.iss'te [Registry] bölümü yoktur. Sunucu, nssm servisi olarak 'NT SERVICE\DestekOfis' hesabıyla oturum 0'da çalışır (servis-kur.cmd:11,55,58); bu yüzden kullanıcının ekranına pencere açamaz. Güncelleme paketi yalnız APP_ITEMS'tır (tools/lib/app-files.mjs:6, update-package.mjs:50): server, client, docs/KURULUM-VE-KULLANIM.md, package.json, CHANGELOG.md, README.md, tools/backup.mjs, tools/mutabakat.mjs. Başlatıcı, setup.iss, bootstrap.mjs ve bin/*.cmd pakete GİRMEZ (bootstrap.mjs:5-6); güncelleyici yalnız sunucunun app\ klasörüne yazar (updater.mjs:8). Dolayısıyla başlatıcıya eklenen her şey ancak her bilgisayarda Kurulum.exe yeniden çalıştırılınca gelir. İstemci tarafında sunucu ortamı (env) meta.settings.integrator içinde herkese döner (invoices.mjs:455, 2326). EDM parolası istemciye hiç çıkmaz (invoices.mjs:451,480). Sunucu başlıkları X-Frame-Options DENY ve COOP same-origin'dir (http.mjs:10-16). 2.4.2'nin kaydetme önerisi düzeltmesi yalnız DestekOfis sayfasının kendi formlarında çalışır (hof-core.js:1233-1258); profil ya da bayrak değişmedi.
DEĞİŞMEZLER:
- Başlatıcı yalnız /api/health ile doğrulanmış DestekOfis sunucusunu açar (health.go:35); açtığı adres keşiften ya da ayardan gelir, kullanıcı girdisinden gelmez.
- Başlatıcı penceresiz (-H=windowsgui, build-windows.mjs:81) ve kısa ömürlüdür (main.go:142); kalıcı süreç ya da port açmaz.
- Güncelleme paketi = APP_ITEMS (app-files.mjs:6); başlatıcı, kurulum betiği ve bootstrap yalnız Kurulum.exe ile değişir (bootstrap.mjs:5-6).
- EDM parolası sunucudan istemciye çıkmaz (invoices.mjs:451-453, 480).
- Veriler (data, backups) kurulumda ve kaldırmada silinmez (setup.iss:86-90, 480-485).
- Ders 30: gerçek programı açan her test lisans servisini 127.0.0.1:9'a yönlendirir (test/lisans-servisi-izolasyonu.test.mjs).
- Ders 18: Edge bayrağı, protokol ve profil davranışı gerçek Windows + Edge'de görülmeden 'çalışıyor' sayılmaz.
- Turnstile aşılmaz; EDM giriş formu betikle doldurulmaz.

[E7] para=False 4sa
  DOKUNMA: server/lib/einvoice/edm.mjs:26-29 (EDM_URLS'in yanına EDM_PORTAL_URLS test/live) | server/routes/invoices.mjs:455 integratorSummary ya da :2326 meta settings (portalUrl alanı; yalnız edocEnabled ve entegratör edm iken) | client/assets/hof-invoices.js:288-293 (araç çubuğu, Liste - Excel'in yanına düğme) | client/assets/hof-invoices.js:403 (eylem dağıtıcısına act==='portal' → openPortal) | client/assets/hof-invoices.js:28 edoc() görünürlük koşulu | docs/KURULUM-VE-KULLANIM.md ve kılavuz PDF (yalnız 'nasıl yapılır') | (Yol B olursa) launcher/platform_windows.go:65-76, launcher/main.go:70-78, packaging/windows/setup.iss ([Registry] yok, eklenir), .github/workflows/windows.yml
  ÖNERİ: En küçük güvenli yol A: kurulum değişikliği yok. Sunucu ortama göre sabit beyaz listeden portalUrl verir (test: https://test.edmbilisim.com.tr/EFaturaUI21ea/, canlı: https://portal4.edmbilisim.com.tr/EFaturaUI/). İstemci tıklamada window.open(portalUrl, '_blank', 'noopener,noreferrer,popup,left=0,top=0,width=screen.availWidth,height=screen.availHeight') çağırır. Pencere başlatıcının açtığı varsayılan Edge profilinde açılır; bu profil zaten kalıcıdır: Beni Hatırla çerezi ve Edge'in kaydettiği EDM parolası kalır. Parola istemciye çıkmaz, Turnstile'a dokunulmaz. Eski başlatıcılı ve başlatıcısız bütün bilgisayarlarda çalışır. Yol B (özel protokol destekofis:// + ayrı --user-data-dir + --start-maximized) yalnız gerçek tam ekran ya da ayrı profil istenirse yapılır. Bedeli: her PC'de Kurulum.exe yeniden çalışmalı (yönetici), çünkü güncelleme başlatıcıyı getirmez. Adres her zaman sabit listeden gelir, protokol dizesinden alınmaz. Tarayıcı her seferinde onay sorar; düğme Yol A'ya düşmelidir. Yol C (yerel uç) ve Yol D (CDP ile parola doldurma) önerilmez. Sunucunun Edge açması da olmaz: servis oturum 0'da çalışır.
  TEST: Sunucu birim testi: env test/live → doğru portalUrl; edocEnabled=false → alan yok; integratorSummary'de kullanıcı adı ve parola YOK; eski kodda kırmızı (ders 7). | e2e (Playwright Chromium): context.route ile iki EDM adresi yerelde karşılanır (ağa çıkılmaz). Düğme görünür; tıklayınca context.waitForEvent('page') yeni sayfası test portalı adresidir; canlı ortamda canlı adres; yalnız invoices.view yetkili kullanıcı; edoc kapalıyken düğme yok; eski kodda kırmızı. | test/yazim-duzeni.test.mjs ad kuralı ('E-Fatura Portal' titleCase'te değişmez). | Fatura ekranına bakan e2e'ler koşulur (ders 28): senaryo-fatura-243, senaryo-ebelge-242/243, senaryo-entegrator-240, senaryo-211. | Gerçek Windows + Edge elle kabul (ders 18 / KANIT 5): başlatıcı penceresinden ayrı pencere, ekran boyu, doğru adres; giriş + Beni Hatırla + Edge parola kaydı; kapat-aç sonrası doğrudan sayfa; portal girişinden sonra programdan bir gönderim (web servis oturumu düşüyor mu). | (Yol B olursa) başlatıcıda saf portalArgs(env, browser) işlevi Linux'ta Go birim testiyle; windows.yml'de protokol kaydı ve kaldırmada silinme denetimi.
  RİSK: Edge --app penceresinden window.open'ın davranışı (normal sekme mi ayrı açılır pencere mi, boyut) DOĞRULANMADI; gerçek tam ekran betikle verilemez. | Varsayılan profil normal Edge ile ortaktır: EDM oturumu normal Edge'de de açık görünür; eşitleme açıksa parola Microsoft hesabına gider. | Portal girişinin web servis oturumunu düşürüp düşürmediği DOĞRULANMADI. Portalda Çıkış'a basmak programın oturumunu da kapatır (edm.mjs:16-18); withSession yeniden giriş yapar (edm.mjs:270-281). | Canlı portal adresi ve canlıda portal kullanıcısının web servis kullanıcısıyla aynı olduğu EDM'den teyit edilmedi. | 2.4.2'nin açık önerisi ('kaydet önerisi kalkmazsa ayrı profil, öneriler kapalı') ile çelişir: o profilde açılan EDM portalı parolayı kaydedemez. | noopener ile adlı pencerenin yeniden kullanılması belirsiz; her tıklama yeni pencere açabilir. | Yol B: kayıtsız bilgisayarda Edge sessiz kalır; argüman enjeksiyonu sınıfı riski; yönetici kurulumu ister; 'her zaman izin ver' kutusunun http kaynağında çıkıp çıkmadığı DOĞRULANMADI.

[E9-ipucu (alan dışı; alanımda bulundu)] para=False 2sa
  DOKUNMA: .github/workflows/windows.yml:3-8, 55-58, 144-150 | packaging/windows/bin/servis-kur.cmd:58 (servis ortamında HUKUK_LICENSE_URL yok) | test/guncelleme-gercek/windows-kurulum.mjs:123-127 (next2 = patch+2 → kurulu 2.4.3'te 2.4.5), :292-302 (W3 next2'yi çalıştırır) | server/lib/license.mjs:33 (varsayılan https://destek-ofis.vercel.app/api/lisans), :230 ve :604 (3 sn sonra kendiliğinden deneme) | test/lisans-servisi-izolasyonu.test.mjs:15-28 (yalnız test/**/*.mjs taranır)
  ÖNERİ: windows.yml gerçek koşucuda gerçek servisi lisans adresi yönlendirilmeden kurar. Güncelleme sınaması 2.4.3 kurulumunda 2.4.5'i çalıştırır; bu, Operatör Merkezi'ndeki '2.4.5 · son 19.10' kaydıyla örtüşüyor. Öneri: kurulumdan ÖNCE hosts dosyasına '127.0.0.1 destek-ofis.vercel.app' yazılır (ürün kodu değişmez); izolasyon testi .github/workflows/*.yml'deki kurulum adımlarını da tarar. Karar E9 sahibinde.
  TEST: Genişletilmiş izolasyon testi workflow'da önlem yoksa kırmızı (eski hâlde kırmızı). | windows.yml'de servis açıldıktan sonra lisans durumunun 'deneme başlatılamadı/servise ulaşılamadı' olduğunu okuyan adım.
  RİSK: Makine ortam değişkeni servise SCM yeniden başlamadan geçmeyebilir (DOĞRULANMADI); hosts yolu daha güvenli. | Koşucu imajlarının MachineGuid'i paylaştığı DOĞRULANMADI.
SÜRPRİZ:
- Başlatıcı --user-data-dir vermiyor (platform_windows.go:69). DestekOfis zaten kullanıcının varsayılan Edge profilinde açılıyor; 'kalıcı profil' bugün var ama 'ayrı' değil. 2.4.2'nin 'ayrı profil' önerisi hiç uygulanmadı (docs/GECMIS-KARARLAR.md:1985-1988, 2001).
- Güncelleme paketi başlatıcıyı, setup.iss'i ve bootstrap.mjs'i taşımıyor (app-files.mjs:6, bootstrap.mjs:5-6). E7 için başlatıcıya dayanan her çözüm her PC'de yönetici olarak Kurulum.exe ister. Otomatik güncellemeyle 2.4.4'e geçen ofislerde personel PC'leri eski başlatıcıyla kalır. DEVİR NOTU'ndaki 'başlatıcı açar' önerisinin bu bedeli belgelerde yazmıyor.
- Kurulumda özel protokol ya da kayıt defteri girdisi yok (setup.iss'te [Registry] yok); başlatıcıda yerel uç yok.
- Personel DestekOfis'i başlatıcısız (tarayıcıya http://<ip>:5123 yazarak) da açabilir; başlatıcıya bağlı bir yol bu kullanıcılarda hiç çalışmaz.
- 2.4.2'nin açık 'ayrı profil, öneriler kapalı' fikri ile E7'nin 'Edge EDM parolasını kaydetsin' isteği aynı profilde çelişir.
- E9 ipucu: .github/workflows/windows.yml gerçek servisi HUKUK_LICENSE_URL olmadan kuruyor (servis-kur.cmd:58). Güncelleme sınaması 2.4.3 kurulumunda 2.4.5'i çalıştırıyor (windows-kurulum.mjs:123-127); bu, yayımlanmamış '2.4.5' Azure kaydıyla örtüşüyor. lisans-servisi-izolasyonu testi yalnız test/**/*.mjs'yi tarıyor.
- openURL'ün argüman listesi hiçbir testte denetlenmiyor (yalnız Windows derlemesi 'MZ' bakılıyor, test/launcher.test.mjs:99-105); setup.iss içeriğini denetleyen test yok.
SORU:
- Düğme adı: kullanıcının yazdığı 'E-Fatura Portal' mı, programın 'e-Fatura' yazımına uyan 'e-Fatura Portalı' mı (text-case.mjs:24)?
- Yol A'nın 'ekran boyunda ayrı pencere'si yeterli mi, yoksa gerçek tam ekran + ayrı profil (Yol B; her PC'ye yönetici kurulumu) mi isteniyor?
- Düğme kimde görünsün: yalnız Fatura Ayarları yetkisi olanda mı, Fatura'yı görüntüleyen herkeste mi? (Portal erişimini EDM parolası korur.)
- EDM teyidi: canlı portal adresi portal4.edmbilisim.com.tr/EFaturaUI/ mi; canlıda portal kullanıcısı web servis kullanıcısıyla aynı mı; portal girişi web servis oturumunu düşürüyor mu?

######## para-cekirdegi
MİMARİ: Bağlantı: openDatabase WAL, synchronous FULL ve foreign_keys açık (server/lib/db.mjs:4-11). store.tx en dışta BEGIN IMMEDIATE, içeride SAVEPOINT kullanır (db.mjs:319-382). Para tablolarına (FINANCIAL, db.mjs:29-32) yapılan her yazım bir işleme alınır; COMMIT'ten önce mutabakat kapıları çalışır ve biri hata verirse ROLLBACK olur (db.mjs:338-380). Yalnız bilgi kolonlarına yazan UPDATE kapıya girmez (INFO_COLUMNS, db.mjs:39-56). K6 denetimi iki kural uygular: para satırının işlem başlığı olmalı (db.mjs:227-241) ve bank.post ile store.raw dışında para tablosuna ham UPDATE/DELETE yapılamaz (db.mjs:135-160). Para alanı olmayan serbest kolonlar bank/money-lines.mjs:127-137'de; cheque_events.invoice_id bunlardan biri değil. Para satırının 9 kaynağı MONEY_SOURCES'ta (money-lines.mjs:33-90); Kasa/Banka bakiyesi tek kaynaktan, createMoneyLines ile hesaplanır (:220; summary :505). Ana Defter saklanmaz, her seferinde türetilir: routes/ledger.mjs rows() alt defterleri okur (:27-184), general-ledger.mjs journal() yevmiyeyi kurar (:157-401), trialBalance (:441) ve reconcile (:478) çalışır, beklenen bakiyeler expected()'tadır (routes/ledger.mjs:204-301). Tek istisna Banka Fişi'dir; bank_lines hesap kodunu yazım anında saklar. Hesap kuralı moneyAccount'ta: nakit 100, havale 102.xx, POS 108.xx, kurumsal kart 309, kredi 300 (general-ledger.mjs:120-131). Evrak hesapları cheque-gl.mjs'te: çek 101/103, senet 121/321, portföy .01, tahsilde .02. Mutabakat kapısında önce dokunulan varlıklar süzgeci çalışır (integrity-scope.mjs:115); temiz değilse tam kapı run() karar verir (integrity.mjs:305, commit kapısı :782-890). Eski sapmalar taban sayılır; kilitli dönemin izi LOCK_SQL'dedir (:116-214, lockDigestOf :224). Göçler yalnız ekleyicidir; son göç 30 (migrations.mjs:1578) ve göçten önce yedek alınır (:1599-1621). Şirket başına ayrı sqlite dosyası vardır, en fazla 2 şirket (companies.mjs:30). Yedek VACUUM INTO ile alınır ve içine şirket kimliği yazılır (backup.mjs:130). Kuruş/ppm/kur kuralları minor.mjs'te. Fatura kapama saf bir motordur (invoice-settle.mjs:128); bağ olarak account_entries.invoice_id ve cheque_events.invoice_id'yi okur (routes/invoices.mjs:555-655).
DEĞİŞMEZLER:
- D1 Her yevmiye maddesinde borç = alacak; mizan dengede (general-ledger.mjs:441-472, integrity.mjs:333).
- D2 Ana defter bakiyesi = alt defter. Hesaplar: 100/102/108/309/300, 120/320/336, 101/103/121/321, 127, 191/391/360/193/190, 128/129. Fark kuruşu kuruşuna aranır (general-ledger.mjs:478-486; routes/ledger.mjs:204-301).
- D3 Alt hesapların toplamı = ana hesap (bank:sub, integrity.mjs:355).
- D4 Her carinin kontrol hesabı = cari kartının bakiyesi (party:accounts integrity.mjs:372; SQL ikizi partyTotals routes/ledger.mjs:348-375).
- D5 Fatura başlığı = kalemlerin toplamı; try_payable = net + KDV − tevkifat − stopaj; gl_json toplamı = matrah (integrity.mjs:489-512).
- D6 Kesilmiş faturanın tam bir cari satırı vardır, taslak/iptal faturanın yoktur (integrity.mjs:514-525).
- D7 account_entries.invoice_id aynı carinin kesilmiş faturasını gösterir; mahsup toplamı faturayı aşmaz (integrity.mjs:528-539; integrity-scope.mjs:742-751).
- D8 cheques.invoice_id doluysa evrak kesilmiş faturada yaşar (integrity.mjs:552-555; integrity-scope.mjs:764).
- D9 Çekten gelen her cari satırı var olan bir evraka bağlıdır ve tutarı aynıdır (integrity.mjs:481-486).
- D10 Para satırının İşlem No'lu başlığı vardır; para tablolarına yazım yalnız bank.post ya da store.raw ile yapılır (db.mjs:135-241; bank/post.mjs:1-30).
- D11 Kilitli dönemin izi değişmez (integrity.mjs:116-243, :844); fatura iptali period.assertOpen ile durur (routes/invoices.mjs:2190).
- D12 Göç yalnız ekleyicidir; eski sürüm aynı dosyayı açabilir (migrations.mjs:1-4, :1186-1189).
- D13 Fatura kapama yöne göre yapılır, hayalet kısmi ödeme olmaz (invoice-settle.mjs:10-16, classifyLine :65-120).
- D14 Tam kapıya eklenen her denetim süzgece de eklenir; gateVerify açıkken eşdeğerlik denetlenir (integrity.mjs:67-71, 848-851).

[UX18-para] para=True 6sa
  DOKUNMA: client/assets/hof-invoices.js:2356 (+ Tahsilat Ekle düğmesi), :2427-2465 payForm; yollar yalnız HOF.methodField (hof-core.js:288) | client/assets/hof-accounts.js:937-940 (cari formunda Çek/Senet seçeneği), :982-985 (newFor'a geçiş; Kapatılacak Fatura seçimi düşer) | client/assets/hof-cheques.js:654-657 newFor({direction, account, amount}); invoiceId almıyor | server/routes/cheques.mjs:460-472 POST /api/workspace/cheques; :433-449 insertCheque; :328-338 writeEvent(invoiceId); :920-972 invoiceCheques create/endorse/voidFor | server/lib/cheques.mjs:74-79 plannedEffects receive → account-entry credit (para satırı değil) | server/lib/general-ledger.mjs:222-229 (B 101.01/121.01 / A 120), :370 tahsil | server/routes/invoices.mjs:573-593 ve :632-639 (cheque_events.invoice_id kapama bağı), :733-740 ownPaymentLines, :774-782 invoice-paid-elsewhere, :2143-2148 voidFor çağrısı, :2210 iptalde bağ temizliği | server/routes/accounts.mjs:665-680 invoiceLink kuralları (B seçeneğinde örnek alınacak) | server/lib/integrity.mjs:528-539 ve server/lib/integrity-scope.mjs:742-751 (yeni evrak bağı denetimi buraya, ikisine birden)
  ÖNERİ: Yevmiye/mizan her iki yolda da DEĞİŞMEZ: çek fatura ekranından da cari ekranından da girilse madde B 101 / A 120'dir; journal fatura bağını okumaz. Önerilen B (bağlı) seçeneği: POST /cheques isteğe bağlı invoiceId alır ve invoiceLink ile aynı kuralı uygular (aynı cari, issued, doğru yön, plan_id boş). Bağ YALNIZ receive/issue olayının cheque_events.invoice_id alanına yazılır; cheques.invoice_id boş kalır, böylece fatura iptalinde evrak silinmez. İptalde (invoices.mjs:2210 yanında, bank.post içinde) olay bağı temizlenir. ownPaymentLines yalnız cheques.invoice_id'si o fatura olan evrakı 'kendi ödemesi' sayar. İstemcide payForm'a 'Çek / Senet' seçeneği eklenir (taksitsiz faturada, cheques.manage yetkisiyle) ve newFor({invoiceId}) çağrılır; cari formu da seçili Kapatılacak Fatura'yı iletir. integrity ile integrity-scope'a aynı evrak bağı denetimi eklenir. Kapama motoru (settleInvoices) olay bağını zaten okuduğu için değişmez. En küçük alternatif A (yalnız istemci): payForm'da Çek/Senet → newFor bağsız; evrak FIFO ile en eski açık faturayı kapatır, açıklama metni bunu söyler. Ama X'ten girilen çek Y'yi kapatabilir; bu bir mantık boşluğu.
  TEST: Yeni birim (B): bağlı çek bu faturayı kapatır, en eski faturayı kapatmaz; iptalde bağ düşer, evrak portföyde kalır, cari bakiyesi ve mizan aynı kalır | Taksitli faturaya evrak bağı 409; başka carinin ya da ters yönün faturası 409/404; verilen çek alış faturasını kapatır; senet de denenir | Bağlı çek karşılıksız dönünce fatura yeniden açılır (classifyLine bounce) | Kırmızı kanıt eski kodda ayrı kopyada (ders 7, 23); mutasyon: bağı cheques.invoice_id'ye yazmak (iptal evrakı siler), iptalde bağı temizlememek | Mevcut testlere bakılacak: test/fatura-217.test.mjs, test/bulgu-223.test.mjs, test/cek-ciro-217.test.mjs, test/banka-220-cek-hesabi.test.mjs, test/supheli-230-*.test.mjs, test/banka-210-gg-kapi.test.mjs (gateVerify eşdeğerlik) | e2e: test/e2e/banka-210-ekran-aciklama-yetki.mjs:118-121 (m4) ve senaryo-216.mjs:381; beklenti değişirse koşulur (ders 28)
  RİSK: Şüpheli alacak: doubtfulSkipOf yalnız kind 'in' satırına bakar (doubtful-gl.mjs:30-31; SQL ikizi bank/doubtful.mjs:86). Faturaya bağlı çek yine şüpheliden düşer, faturaya bağlı nakit düşmez. Kural değişirse kâhin dili de değişir; öneri BİLİNEN SINIR | ownPaymentLines (invoices.mjs:733-740) bugün her cheque_events.invoice_id etkisini fatura ödemesi sayıyor; sonradan bağlanan çek invoice-paid-elsewhere korumasını atlatır | Toplu kapama yolu taksitli fatura bağını yalnız account_entries için yok sayıyor (invoices.mjs:564-570, :629), olay bağı için yok saymıyor (:591, :638); yeni bağ taksitli faturada reddedilmezse 2.0.23 Bulgu 2 geri gelir | cheque_events.invoice_id FREE_COLUMNS'ta değil (money-lines.mjs:133); bank.post dışından güncelleme test kipinde money-guard 500 verir | Tam kapıya eklenen denetim süzgece eklenmezse eşdeğerlik açığı kalır (para çekirdeği → dar kontrol, ders 32)

[E1-defter] para=False 2sa
  DOKUNMA: server/lib/general-ledger.mjs:319-325 (kind 'smm': B 120 + B 193 / A 600 + A 391; profile okunmaz), :318 etiket | server/routes/ledger.mjs:107-113 (fatura satırları profilsiz okunur), :262-275 (391/193 beklenenleri türe göre) | server/lib/invoice-math.mjs:40 (smm party 'debt', send:false), :90-95 lineAccount smm → 600 | server/routes/invoices.mjs:139-140, :230, :450, :1233, :1243-1244 (esmmEnabled kapı noktaları), :1391-1393 stopaj, :1642 seri (ESM/SMM), :80 TES | server/routes/invoices.mjs:2165-2219 cancel(); :2878-2930 e-Arşiv iptal sırası (dryRun → EDM → yerel), :2893 8 gün | server/routes/invoices.mjs:654 unsentNumbered (INVOICE_KINDS[kind].send şartı)
  ÖNERİ: e-SMM kâğıt SMM ile AYNI defter kaydını üretir: yevmiye, beklenenler, cari satırı ve kapı türe (kind 'smm') bakar, profile bakmaz. Profil yalnız seriyi, izinli profili ve e_status'u belirler. e-SMM'yi açmak para çekirdeğinde değişiklik GEREKTİRMEZ. Yapılması gerekenler: (1) e-SMM iptali e-Arşiv'deki sırayı izler: önce programda dryRun, sonra EDM CancelSMM, sonra yerel cancel(); remoteEligible ESMM profilini de kapsamalı. (2) Defter = belge eşitliği için UBL yolu (SendSMMPrepared) seçilir ya da EDM'nin döndürdüğü toplamlar try_* alanlarıyla kuruşu kuruşuna karşılaştırılır. (3) send:false yüzünden e-SMM Gönderilecekler'e düşmez; profile bağlanması E1/E6 işidir, defter etkisi yoktur.
  TEST: Fark testi: aynı girdiyle kâğıt SMM ve ESMM profilli makbuz → journal maddeleri, trialBalance ve partyTotals birebir aynı | e-SMM iptal: dryRun başarısız (kilitli dönem, K7) ise EDM'ye gidilmez; EDM iptali başarılı + yerel iptal sonrası mizan = belge hiç yokmuş gibi | Stopajlı ve KDV tevkifatlı SMM: invoice:try ve invoice:lines kapıları yeşil; 193 ve 391 beklenenleri tutar | test/defter-243-*.test.mjs ve test/bagimsiz/ebelge (test:kahin-ebelge) kâhini SMM/ESMM için gözden geçirilir
  RİSK: EDM nesne yolunda (SendSMM) dip toplamları EDM üretir; bizim try_* değerlerimizden kuruş farkı olursa resmî belge ile defter ayrışır ve hiçbir kapı görmez (DOĞRULANMADI: EDM yanıt alanları görülmedi) | EDM iptali başarılı olup yerel iptal düşerse belge EDM'de iptal, programda kesilmiş kalır; dryRun şart | Numarasız bekleyen belge Yevmiye'de 'Taslak' etiketiyle görünür (general-ledger.mjs:318); tutar etkilenmez, DOĞRULANMADI (ekranda görülmedi) | e-SMM iptal süresi kılavuzda yok; mali müşavire sorulacak (e-Arşiv'deki 8 gün sorusuyla aynı)

[DEVIR-7-referans] para=True 0.5sa
  DOKUNMA: docs/devir/DEVIR-PLANI.md:203-230 (§7) | server/lib/bank/money-lines.mjs:505 summary (plan :739 diyor) | server/lib/period.mjs:70 setLock (plan :68 diyor) | server/lib/company-separate.mjs:57 VACUUM INTO (plan §2 :36 diyor) | server/routes/invoices.mjs:1678 assertChronology (plan §4.4 :1675 diyor) | server/lib/migrations.mjs:731 cheque_events.kind CHECK kısıtı
  ÖNERİ: Plan §7'deki referansların çoğu doğru: migrations:1578, accounts.mjs:42/148, routes/accounts:178, money-lines:220, cash:42, bank/accounts:764, plans:467/472, cheques:106, overview:135, GL:404/434, integrity:116/224, app:135/409, finance-report:164, report-center:203. Düzeltilecekler: summary :739 → :505; setLock :68 → :70; §7 dışında company-separate :36 → :57 ve assertChronology :1675 → :1678. Kör nokta: 'cheque_events devir türü' eklenemez, çünkü kind kolonunda CHECK kısıtı var (migrations.mjs:731). Genişletmek tabloyu yeniden kurmak ister; bu, yalnız ekleyici göç kuralına ve eski sürümün aynı dosyayı açmasına (K11) dokunur. D0'da yeni kolon, yeni tablo ya da işaretli receive/issue olayı seçilmeli.
  TEST: D0'da referanslar yeniden okunur; 2.4.4 göç eklerse sıradaki göç numarası güncellenir | Devir göçü için migrations.test.mjs + goc-zinciri: eski sürüm (2.4.4) devirli dosyayı açabilmeli (K11)
  RİSK: CHECK kısıtı yüzünden yeni olay türü için tablo yeniden kurmak gerekir; eski sürüm geri dönüşünde yeni türü yazamaz ve okuyamaz | account_entries.kind (migrations.mjs:604) ve invoices.kind (:926) de CHECK'li; plan yeni kolon önerdiği için sorun yok, ama yeni tür değeri eklenirse aynı engel çıkar
SÜRPRİZ:
- Cari '+ Tahsilat'ta yol Çek/Senet seçilince 'Kapatılacak Fatura' seçimi SESSİZCE düşer: hof-accounts.js:982-985 newFor'a invoiceId geçirmiyor ve newFor (hof-cheques.js:654) bunu almıyor. Kullanıcı faturayı seçer ama evrak FIFO ile başka faturayı kapatabilir.
- ownPaymentLines (routes/invoices.mjs:733-740) her cheque_events.invoice_id etkisini 'faturanın kendi ödemesi' sayıyor; fatura dışı bir olay bağı kurulursa invoice-paid-elsewhere koruması (:774-782) atlanır.
- Toplu ve cari kapama yolları taksitli fatura bağını yalnız account_entries için yok sayıyor (:564-570, :629), cheque_events bağı için yok saymıyor (:591, :638).
- Şüpheli alacakta faturaya bağlı nakit tahsilat 120'de kalır (doubtfulSkipOf, doubtful-gl.mjs:30-31), faturayla alınan çek ise (kind credit) her zaman 128'den düşer (bank/doubtful.mjs:86). İki ödeme yolu arasında kural tutarsızlığı var.
- INVOICE_KINDS.smm.send = false (invoice-math.mjs:40): e-SMM açılsa da unsentNumbered (routes/invoices.mjs:654) SMM'yi Gönderilecekler'e almaz; e-SMM için profile bağlanmalı.
- Yevmiye etiketi `row.number || 'Taslak'` (general-ledger.mjs:318): 'Kes, Sonra Gönder' ile kesilmiş ama numarasız belge Yevmiye Defteri'nde 'Taslak' görünür (DOĞRULANMADI, ekranda görülmedi).
- cheque_events.invoice_id K6 serbest kolonlarında değil (money-lines.mjs:133): bu kolona bank.post dışından yapılan UPDATE test kipinde money-guard 500 verir.
- DEVİR planı 'cheque_events devir türü' öngörüyor, ama kind CHECK kısıtı (migrations.mjs:731) yalnız ekleyici göçle buna izin vermiyor.
- DEVİR planında kaymış referanslar: money-lines summary :739 → :505, period setLock :68 → :70, company-separate VACUUM INTO :36 → :57, assertChronology :1675 → :1678.
SORU:
- UX18: Fatura ekranından alınan çek/senet BU faturayı mı kapatsın (B: sunucu, kapı ve dar kontrol), yoksa cari ekranındaki gibi en eski açık faturayı mı (A: yalnız istemci)?
- UX18: Faturaya bağlı çek şüpheli alacaktan düşmeye devam etsin mi (bugünkü kural)? Öneri: 2.4.4'te kural değişmesin, BİLİNEN SINIR yazılsın.
- Cari '+ Tahsilat' Çek/Senet yolunda seçili 'Kapatılacak Fatura' evrak bağına taşınsın mı, yoksa alan gizlensin mi?
- E1: e-SMM gönderimi UBL (SendSMMPrepared) ile mi yapılacak, nesne (SendSMM) ile mi? Defter = belge eşitliği için UBL ya da dönen toplamların karşılaştırılması gerekir.
- E1: e-SMM iptal süresi var mı (mali müşavir/EDM teyidi)?
- DEVİR D0: açık evrak açılışı CHECK kısıtı nedeniyle yeni olay türü yerine hangi yolla yazılacak (yeni kolon, yeni tablo ya da işaretli receive/issue)?

######## sunucu-genel
MİMARİ: Üretim girişi server/server.mjs:8 createApp({edocEnabled:true, edocLive:true}) çağırıyor; esmmEnabled verilmediği için config.esmmEnabled false kalıyor (server/lib/config.mjs:85). E1'de e-SMM bu satırdan açılacak. createApp (server/app.mjs:89) sırasıyla göçleri, auth/access/lisansı (yalnız hub'da, :173-232), context'i (:243-252) kuruyor. Rotalar bağımlılık sırasıyla ve tembel () => context.x erişimiyle kaydediliyor (:265-353). Yönlendirici ilk eşleşeni seçiyor (server/lib/router.mjs:26-43). Her istek dispatch'ten (server/app.mjs:456-503) geçiyor: HUB_ONLY yolları (:405; auth, license, companies, admin/users|roles|recovery|update|backups) 001'de kalıyor, öbürleri ?hofCompany ile sayfanın şirketine gidiyor ve hata olursa asla 001'e düşmüyor (:488-501). Kapsam runScoped ile kuruluyor (:396-399). handle (:355-384) değiştirici her /api isteğinde rota çalışmadan önce assertSameOrigin (server/lib/http.mjs:179-190) ve license.assertWritable (server/lib/license.mjs:659-664) çağırıyor. Kimlik hof_session çerezinde, belirtecin sha256'sı sessions tablosunda tutuluyor (server/lib/auth.mjs:89-111). Yetki access.attach ile istek başına Set olarak kuruluyor (server/lib/access.mjs:43-46): rol + kişiye eklenen − kaldırılan; yönetici bütün yetkilere sahip (server/lib/permissions.mjs:277-286). Salt okunur lisansta ekrana giden yetkiler WRITE_PERMISSIONS ile süzülüyor (server/lib/license.mjs:46-53,658; server/routes/auth.mjs:11). Her şirket örneğinin kendi olay hub'ı var (server/app.mjs:182). workspace.changed işlemi yapanı dışarıda bırakıyor (server/routes/workspace.mjs:27-33). Para veya stok değişince overview.changed 250 ms birleştirilip herkese gidiyor (server/routes/overview.mjs:30,54-68); ledger:changed adında bir olay yok. Modüller veriye bağlı: tahsilat = sektör modülü || payments>0 (server/lib/profile.mjs:178-194); sections.mjs modül değil, Excel bölüm ayırıcısı (server/lib/sections.mjs:1-15). Rapor merkezi 63 kayıtlı rapordan oluşuyor (server/routes/report-center.mjs:507, REGISTRY :2696). Yetki allowed ile denetleniyor (:2759); run banka raporlarını iş parçacığına aktarıyor (:2777-2793). Ekran, PDF ve Excel aynı modelden üretiliyor (:2795-2848; server/lib/report-files.mjs:22,41). Entegratör ayarları invoice.settings JSON'unda duruyor (server/routes/invoices.mjs:51,117). Parola AES-256-GCM ile mühürleniyor (server/lib/secret-box.mjs) ve istemciye hiç çıkmıyor (server/routes/invoices.mjs:450-455,480).
DEĞİŞMEZLER:
- Değiştirici her /api isteği rota çalışmadan önce aynı köken ve lisans yazılabilirlik denetiminden geçer (server/app.mjs:360-363).
- Yetkinin tek otoritesi sunucudur; CSS veya JS ile gizleme güvenlik sınırı değildir (server/lib/permissions.mjs:1).
- Yönetici her yetkiye sahiptir; ADMIN_ONLY yetkileri (overview.card, users/system/license.manage) role ya da kişiye verilmez (server/lib/permissions.mjs:103,254,280).
- Şirket dağıtımı hata verince istek başka şirkete (001'e) düşmez; 409, 403 ya da 503 döner (server/app.mjs:479-501).
- Entegratör parolası mühürlü saklanır; istemciye yalnız hasPassword/configured gider, günlüğe yalnız passwordChanged yazılır, parola yalnız bağlantı kurulurken sunucuda açılır (server/routes/invoices.mjs:450-455,480,2349; server/lib/secret-box.mjs:31-53).
- Modüller veriye bağlıdır: sektör istemese de verisi olan modül gizlenmez (server/lib/profile.mjs:178-194); sunucudaki profile.modules şekli test/insight.test.mjs:381'de kilitli.
- Raporun ekran, PDF ve Excel çıktısı aynı modelden gelir ve alt TOPLAM satırı taşır (server/routes/report-center.mjs:5-7,2789-2791).
- Program adları her sözcüğü büyük harfle yazar; test/yazim-duzeni.test.mjs:197 server/routes/* altındaki rapor, PDF ve Excel başlıklarını kendiliğinden tarar.
- Şirket sıfırlamada KEEP_SETTINGS önekleri (office., client., invoice, einvoice, license., company., auth. …) silinmez (server/app.mjs:612).
- Kayıt tahsilatı API'si (POST /api/workspace/cases/:key/payments, PUT/DELETE /api/workspace/payments/:id) yaklaşık 25 test dosyasında kullanılıyor; E8'de değişmemeli (server/routes/workspace.mjs:392-500).

[E8-sunucu] para=False 3sa
  DOKUNMA: client/assets/hof-ui.css:2121-2125 (mevcut koşullu gizleme html.hof-no-tahsilat; buraya koşulsuz kural eklenecek) | client/assets/hof-workspace.js:1212 (düğme data-case-action=payment data-requires=payments.create) | server/lib/permissions.mjs:22,140 (payments.create 'Kayda Tahsilat Girme — Kişi kartından tahsilat girer') | server/routes/workspace.mjs:392-426 (POST cases/:key/payments), :430-436 editablePayment, :439-470 PUT, :471-500 DELETE | server/routes/cash.mjs:183-186, server/routes/trash.mjs:356, server/routes/bank.mjs:46, server/lib/license.mjs:47 (payments.create'in öbür kullanımları) | server/lib/profile.mjs:194 (modules.tahsilat: sektör || payments>0) — DEĞİŞMEZ | client/assets/hof-alerts.js:277,285 ve client/assets/hof-promises.js:137-152 (HOF.workspace.payment, düğme dışındaki kalan yollar) | client/assets/hof-workspace.js:1178-1179 (boş geçmiş metni 'not, telefon, tahsilat veya haciz') | server/routes/report-center.mjs:2550-2580 (Kayıt Kartından Tahsilatlar raporu) | test/e2e/run.mjs:488,622,645; test/e2e/senaryo-banka-210b.mjs:214; test/e2e/senaryo-cari-243.mjs:173,206
  ÖNERİ: Sunucuya dokunulmaz. hof-ui.css'e koşulsuz '.hof-case-actions [data-case-action="payment"]{display:none!important}' kuralı eklenir. Statik dosyalar no-cache sunulduğu için değişiklik istemciye ulaşır (server/lib/static.mjs:69). payments.create anlamını korur: API, eski tahsilatı düzeltme/silme, Silinenler'den geri yükleme, Kasa düzeltme bayrağı, zil/ödeme sözü şeridi. Boş geçmiş metnindeki 'tahsilat' için hof-workspace.js:1178'de tek satır JS değişikliği gerekir; kullanıcı 'yalnız CSS' dediği için ayrıca onay istenmeli. E2E'lerde tahsilat API'den girilir. Kayıt tahsilatı: POST /api/workspace/cases/:key/payments. Cariye bağlı kayıt: POST /api/workspace/accounts/:id/entries {kind:'in'} (server/routes/accounts.mjs:771). Taksitli kayıtta taksit kutusundaki '+ Tahsilat' ekrandan kullanılmaya devam eder.
  TEST: Yeni birim test: hof-ui.css içinde html. öneki olmadan [data-case-action="payment"]'ı display:none yapan bir kural var mı (eski kodda kırmızı, CRLF'ye dayanıklı — ders 7, 27). | Yeni e2e adımı: kayıt seçiliyken Tahsilat düğmesi görünmez, Not/Telefon/Görev görünür (eski kodda kırmızı). | run.mjs:488/622/645, senaryo-banka-210b:214, senaryo-cari-243:173/206 tahsilatı API'den ya da taksit kutusundan girecek biçimde güncellenir, hepsi koşulur (ders 28). | Sunucu testleri değişmez; test/yetki-gorunurluk.test.mjs ve test/insight.test.mjs:381 yeşil kalmalı.
  RİSK: Düğmeyle birlikte planı olmayan kayıtta 'Taksit planı oluşturun' kısa yolu da kaybolur (yalnız tahsilat penceresinde var: hof-workspace.js:50-55); run.mjs:622 bu yolu sınıyor. | Cariye bağlı kayıtta karttan cari tahsilatı (2.4.3 A2) kaybolur (hof-workspace.js:268-275); senaryo-cari-243 A2 adımı yeniden tasarlanmalı. | Kayıt tahsilatının tek arayüz yolu zil/ödeme sözü şeridi kalır. Bu yol tutarla geldiği için (fromStrip) taksit/cari yönlendirmesini atlıyor ve doğrudan Kasa'ya yazıyor (hof-workspace.js:258-276); cariye bağlı kayıtta cari borçlu kalır (DOĞRULANMADI, e2e kapsamı yok). | Katalog açıklaması 'Kişi kartından tahsilat girer', özel sektör formundaki 'Tahsilat ve Kasa Takibi' kutusu (hof-insight.js:876,1079) ve rapor adı 'Kayıt Kartından Tahsilatlar' yanıltıcı olur.

[KO3-baslarken-kaynaklar] para=False 5sa
  DOKUNMA: server/lib/companies.mjs:106,158 (varsayılan şirket adı 'Şirket 1'); server/app.mjs:244 context.company(); GET /api/companies (server/routes/companies.mjs:44-48); /api/auth/me companyInfo (server/routes/auth.mjs:7,33) | GET /api/admin/office (server/routes/admin.mjs:446-449; system.manage; şirket kapsamlı) | GET /api/workspace/invoices/meta → settings.sellerReady/sellerName/integrator.configured (server/routes/invoices.mjs:2303,2326); GET /api/workspace/invoices/settings → problems.* (:2336-2340); sellerProblems (:361); integratorSummary (:455) | GET /api/workspace/accounts (server/routes/accounts.mjs:317); GET /api/workspace/invoices?limit=1 total (server/routes/invoices.mjs:2355-2362) | GET /api/workspace/bank/summary (server/routes/bank.mjs:44,70); cashOpenings (server/lib/cash-opening.mjs:28) | GET /api/workspace/client-state sheetUrlSet (server/routes/workspace.mjs:706; dataset.info server/lib/dataset.mjs:1362) | GET /api/admin/system lastBackup (server/routes/admin.mjs:557-571); profile.usedBefore (server/lib/profile.mjs:155-157) | Yeni: server/routes/getting-started.mjs + kayıt satırı server/app.mjs (invoices/bank/cash kaydından sonra); invoices servis dönüşü server/routes/invoices.mjs:4320 | İstemcideki ilk ekran: client/assets/hof-sources.js:410
  ÖNERİ: Tek bir salt okuma ucu eklenir: GET /api/workspace/getting-started. HUB_ONLY olmadığı için şirket kapsamlı çalışır. Yalnız boole ve sayı döner; her madde kullanıcının o modülde yetkisi varsa görünür; entegratör için yalnız configured döner (kullanıcı adı, parola, adres hiç dönmez). Firma bilgisi için invoices servis dönüşüne sellerReady(profile) eklenir (tek satır, para dışı). Kapatma kişi başına 'client.gettingStarted.<userId>' ayarında tutulur; KEEP_SETTINGS 'client.' önekini koruduğu için sıfırlamada da kalır. Gösterim koşulu: system.manage + kapatılmamış + en az bir eksik madde. Başlıklar yazım testiyle kendiliğinden denetlenir.
  TEST: Boş kurulumda bütün maddeler eksik görünür; maddeler adım adım tamamlanırken her adımda yanıttaki boole ve sayılar okunur (ders 3). | İki şirket: 002'nin listesi 001'den bağımsız (ders 17). | Personel yalnız yetkili olduğu maddeleri görür; yanıtta password/passwordSealed/username anahtarı yoktur. | Salt okunur lisansta GET çalışır; kapatma işlemi (POST) lisans kuralına uyar. | test/yazim-duzeni.test.mjs yeni rota dosyasını tarar.
  RİSK: invoices.mjs'e dokunuluyor (fatura alanının sahibiyle eşgüdüm gerekir; para yolu değil). | Hangi maddelerin gösterileceği ve kimlere gösterileceği ürün kararı; karar verilmeden kodlanmamalı. | Şirket adı ile office.name ayrışabilir (companies kaydı ve settings ayrı); 'Şirket 1' denetimi kayıt defterinden yapılmalı.

[UI11-sunucu-basliklari] para=False 0.5sa
  DOKUNMA: server/routes/report-center.mjs:2792 (title), server/lib/report-files.mjs:16 (dosya adı '<Başlık> <tarih>') | server/lib/cash-report.mjs:44,77,139,145 (Kasa Dökümü başlık/altbilgi; 2.4.3'te düzeltilmiş) | server/routes/overview.mjs:288,300,327,351,452,487,635-639,651 | server/routes/stock.mjs:274,285,295,297,551; server/routes/companies.mjs:228,238 | Bulgu: docs/kanit/2026-10-18/uiux-a-243/uzman-ui-BULGULAR.md:83-89
  ÖNERİ: Sunucuda değişiklik gerekmiyor. UI11'deki düğme adı/rengi ve Fatura/Çek pencerelerindeki çift başlık tamamen istemci işi; sunucu düğme adı üretmiyor. İstemci düğme adlarını değiştirirken çağrılan .pdf/.xlsx URL'leri değişmemeli (tam liste harita §4'te). İsteğe bağlı ayrı küçük iş: dosya adlarını reportFileBase kalıbına çekmek ('Stok-durumu', 'Sirketler Birlesik Raporu.pdf'); önce e2e indirme adı beklentileri taranmalı (DOĞRULANMADI).
  TEST: Sunucuda değişiklik olmadığı için ek test yok; dosya adı değişirse indirme adını okuyan e2e ve birim testleri aranır ve koşulur.
  RİSK: UI11 kapsamının dosya adlarını içerip içermediği belirsiz; kapsam kayarsa e2e indirme beklentileri kırılabilir.

[E5-entegrator-kullanici-adi] para=False 1.5sa
  DOKUNMA: server/routes/invoices.mjs:51 (SETTINGS_KEY invoice.settings), :117 (integrator varsayılanları), :152-153 (secret box; şirketin veri klasöründe secret.key) | server/routes/invoices.mjs:296-326 settingsInput integrator dalı; :311 username = limited(...) → text() zaten kırpıyor (server/lib/http.mjs:192-198) | server/routes/invoices.mjs:2341-2353 PUT settings (invoices.settings), :2336-2340 GET, :450-455 publicSettings, :478-482 bağlantı (parola yalnız burada açılır) | client/assets/hof-invoices.js:3156-3157 (alan + 'kayıtlı parola ekranda gösterilmez' metni zaten var), :3242-3245 kart yükü, :3024-3058 genel Fatura Ayarları yükü (integrator taşıyabiliyor :3049-3052)
  ÖNERİ: Baş/son boşluk kırpma sunucuda zaten yapılıyor (limited → text().trim()); parola bilerek kırpılmıyor. Sunucuda kâhin kural: kullanıcı adı http(s):// ile başlıyorsa ya da .svc/EFaturaEDM içeriyorsa 400 dönsün (code: integrator-username-url, field: integrator.username). Bu kural yalnız ad DEĞİŞTİĞİNDE sert uygulanmalı. Kayıtlı hatalı ad değişmeden geliyorsa kayıt geçsin, yanıtta uyarı dönsün; böylece Fatura Ayarları'nın ilgisiz kayıtları kilitlenmez. Bağlantı denemesinde (:478) aynı kural açık bir 409 iletisi versin; EDM'nin 11010 yanıtı beklenmesin. İstemci aynı kuralla kaydetmeden önce uyarır. 'Kayıtlı parola gösterilmez' metni zaten var; en çok küçük bir netleştirme gerekir.
  TEST: PUT settings integrator.username='https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc' → 400 integrator-username-url; DB'deki ad değişmedi (eski kodda kırmızı — ders 3, 7). | '  kullanici  ' → 'kullanici' olarak saklanır (mevcut davranışın kilidi). | Kayıtlı hatalı ad varken yalnız seri değiştirilince kayıt geçer ve uyarı döner. | Parola boş gelirse hasPassword korunur; yanıtta passwordSealed/parola yok.
  RİSK: Kural her kayıtta sert uygulanırsa, eski hatalı adı olan kurulum Fatura Ayarları'nı hiç kaydedemez. | invoices.mjs fatura/e-belge alanının sahibiyle eşgüdüm gerektirir. | EDM kullanıcı adının biçimi bilinmediği için kural gerçek kullanıcı adlarını yanlışlıkla reddetmeyecek kadar dar tutulmalı.

[EK-salt-okunur-tax-manage] para=False 0.5sa
  DOKUNMA: server/lib/license.mjs:46-53 (WRITE_PERMISSIONS; tax.manage yok) | server/lib/permissions.mjs:78 (tax.manage, 2.4.3 MM3) | client/assets/hof-bank.js:499,1650; client/assets/hof-workspace.js:628 (Vergi Ödemesi düğmeleri) | test/banka-210-yetki-katalog.test.mjs:41-42; test/license.test.mjs:599-601
  ÖNERİ: WRITE_PERMISSIONS listesine 'tax.manage' eklenir. Kalıcı çözüm için kural testi yazılır: PERMISSIONS'taki her yazma yetkisi WRITE_PERMISSIONS'ta olmalı; okuma yetkileri açık bir listeyle hariç tutulur. Sunucu zaten LICENSE_READ_ONLY ile reddettiği için değişiklik yalnız görünürlüğü etkiler.
  TEST: Yeni katalog kuralı testi eski kodda kırmızı (tax.manage eksik). | Salt okunur lisansta /api/auth/me permissions içinde tax.manage yok.
  RİSK: Düşük; yalnız ekran görünürlüğü değişir.

[EK-E9-ipucu] para=False 2sa
  DOKUNMA: .github/workflows/windows.yml:3-7 (master push + release.yml çağrısı), :36-60 (gerçek kurulumun sessiz kurulumu, servis açılıyor), :150 (windows-kurulum.mjs) | packaging/windows/bin/servis-kur.cmd:58 (nssm AppEnvironmentExtra; HUKUK_LICENSE_URL yok) | test/guncelleme-gercek/windows-kurulum.mjs:124-127,231,292 (next=patch+1, next2=patch+2 → paket 2.4.3 iken 2.4.5) | server/lib/license.mjs:33,230,537-559,596-605 (varsayılan servis + 3 sn sonra kendiliğinden deneme) | test/lisans-servisi-izolasyonu.test.mjs:13,25-29 (yalnız test/ altında spawn/fork eden dosyaları tarıyor)
  ÖNERİ: Bu madde E9 sahibine (lisans-sizinti) aittir; burada yalnız kanıt yeri veriliyor. Windows iş akışındaki gerçek kurulum, servisi lisans adresi yönlendirilmeden çalıştırıyor. Ardından test, kurulu servisi patch+2 sürümüne güncelliyor: 2.4.3 + 2 = yayımlanmamış 2.4.5. Son görülme 19.10 15:30 TR, 163dd5d birleştirmesi 19.10 14:24 TR. Çözüm yönü: iş akışında servis kurulumundan sonra (ya da kurulum parametresiyle) nssm AppEnvironmentExtra'ya HUKUK_LICENSE_URL=http://127.0.0.1:9 eklenip servis yeniden başlatılmalı; izolasyon taraması .github/workflows ve tools/ dizinlerini de kapsamalı.
  TEST: İzolasyon testi genişletilir: workflow'da gerçek kurulumu başlatan her iş HUKUK_LICENSE_URL'yi servis ortamına vermeli (eski hâlde kırmızı). | Windows CI'de servis ortamı okunarak doğrulanır (sc qc / nssm get AppEnvironmentExtra).
  RİSK: Kayıtla birebir eşleşme DOĞRULANMADI (Operatör Merkezi sorgulanmadı; koşucular arasında makine kimliğinin sabit olup olmadığı bilinmiyor). | Kurulumun kendisine test bayrağı eklemek üretim paketine sızmamalı.
SÜRPRİZ:
- E9 için güçlü ipucu: .github/workflows/windows.yml:36-60 gerçek kurulum dosyasını GitHub Windows koşucusuna kurup servisi HUKUK_LICENSE_URL olmadan çalıştırıyor (packaging/windows/bin/servis-kur.cmd:58). Aynı işte test/guncelleme-gercek/windows-kurulum.mjs:124-127 servisi patch+2 sürümüne güncelliyor: 2.4.3 → 2.4.5, Operatör Merkezi'ndeki yayımlanmamış sürüm. İzolasyon testi bu yolu taramıyor (test/lisans-servisi-izolasyonu.test.mjs:13,25-29). Kayıtla birebir eşleşme DOĞRULANMADI.
- Salt okunur lisansta 'tax.manage' WRITE_PERMISSIONS'ta yok (server/lib/license.mjs:46-53): Vergi Ödemesi düğmeleri görünüyor, sunucu 403 ile reddediyor; katalog testleri bu açığı yakalamıyor.
- E8: kayıt kartındaki Tahsilat düğmesi kalkınca kayıt tahsilatının tek arayüz yolu zil/ödeme sözü şeridi kalıyor. Bu yol tutarla geldiği için taksit/cari yönlendirmesini atlayıp doğrudan Kasa'ya yazıyor (client/assets/hof-workspace.js:258-276; hof-alerts.js:285; hof-promises.js:138); cariye bağlı kayıtta cari borçlu kalır (DOĞRULANMADI, e2e yok).
- E8: düğmeyle birlikte 'Taksit planı oluşturun' kısa yolu (hof-workspace.js:50-55) ve 2.4.3 A2'nin karttan cari tahsilatı da kayboluyor; test/e2e/run.mjs:622 ve senaryo-cari-243:173,206 tam bunları sınıyor.
- E8 sonrası yanıltıcı kalacak metinler: payments.create açıklaması 'Kişi kartından tahsilat girer' (server/lib/permissions.mjs:140), özel sektördeki 'Tahsilat ve Kasa Takibi' kutusu (client/assets/hof-insight.js:876,1079), 'Kayıt Kartından Tahsilatlar' raporu (server/routes/report-center.mjs:2550-2556).
- E5: kullanıcı adının baş/son boşluğu sunucuda ZATEN kırpılıyor (server/routes/invoices.mjs:311 → server/lib/http.mjs:192); 'kayıtlı parola gösterilmez, değiştirmek için yenisini yazın' metni de zaten var (client/assets/hof-invoices.js:3157). Asıl eksik yalnız URL denetimi. Fatura Ayarları'nın genel kaydı da integrator taşıyabildiği için (hof-invoices.js:3049-3052) sert denetim ilgisiz kayıtları kilitleyebilir.
- Yetki değişikliği (workspace.changed kind=permissions; server/routes/admin.mjs:85) ve license.changed hub'ın olay hub'ında yayınlanıyor; 002'yi gösteren pencere 002'nin hub'ına bağlı (server/routes/chat.mjs:6; client/assets/hof-live.js:35) ve köprü yok. Bu olaylar 002 ekranına canlı ulaşmıyor (DOĞRULANMADI, test yok).
- Görevdeki 'ledger:changed' adlı bir olay kodda yok; para değişikliğinin canlı olayı overview.changed (server/routes/overview.mjs:54-68).
- server/server.mjs:8 esmmEnabled vermiyor; e-SMM'yi açmak için config bayrağı tek başına yetmiyor, üretim girişine de eklenmeli.
- Vekil sunucu parolası ag-ayari.json'da açık metin (URL içinde) saklanıyor (server/lib/net-proxy.mjs:121-125,289-296); ekrana dönmüyor ama entegratör parolasının aksine mühürlü değil.
- docs/DURUM-VE-DEVAM.md:44'teki devir hatırlatıcısı (22.10, trig_01NEGfcTp7hAnHG1tgw6mFAv) CLAUDE.md'ye göre KAPATILDI, yenisi 29.10 — devir notu eskimiş.
- UI9'un Anlık Durum ve Kasa Dökümü PDF kısmı 2.4.3'te kapanmış (client/assets/hof-overview.js:24-30; server/lib/cash-report.mjs:139); 2.4.4'e kalan UI9 yalnız fatura kalemindeki Birim Fiyat (istemci).
SORU:
- E8: boş geçmiş metnindeki 'tahsilat' sözcüğü için tek satır JS değişikliği (hof-workspace.js:1178) kabul mü, yoksa yalnız CSS + BİLİNEN SINIR mı?
- E8: payments.create katalog açıklaması ve 'Kayıt Kartından Tahsilatlar' rapor adı/açıklaması güncellensin mi?
- E8: kaybolan 'Taksit planı oluşturun' kısa yolu ve cariye bağlı kayıtta karttan cari tahsilatı (2.4.3 A2) kabul mü, başka yere mi taşınsın? run.mjs:622 adımı buna göre yazılır.
- E8: zil/ödeme sözü şeridinden girilen tahsilatın cari/taksit yönlendirmesini atlaması 2.4.4'te düzeltilsin mi (para yolu → dar kontrol), yoksa ayrı madde mi olsun?
- KÖ3: hangi maddeler gösterilecek (şirket adı, firma bilgisi, entegratör, ilk cari, ilk fatura, banka hesabı, Kasa açılışı, kullanıcı, yedek)? Kimlere gösterilecek (yalnız yönetici mi, muhasebe de mi)? Kapatma kişi başına mı, şirket başına mı?
- E5: değişmemiş eski hatalı kullanıcı adı varken kayıt uyarıyla geçsin mi, sert 400 mü versin?
- 002'de yetki ve lisans olaylarının canlı ulaşmaması bilinen sınır mı, düzeltilsin mi?
- Salt okunur lisansta tax.manage eksikliği 2.4.4'e küçük madde olarak eklensin mi?
```

### EK-1 ebelge-sunucu

#### Alan haritası: ebelge-sunucu (e-Belge sunucu çekirdeği) — 2.4.4 hazırlığı

Salt okuma, 21.10.2026. Her iddia koddan; emin olunmayan yerler **DOĞRULANMADI**. Satır numaraları bugünkü çalışma ağacındaki dosyalardır.
Kapsam: `server/lib/einvoice/*.mjs`, `server/routes/invoices.mjs` e-Belge bölümleri, `server/lib/config.mjs`, EDM e-SMM belgeleri
(scratchpad `esmm-dok-v4/*.txt`, yüklenen xlsx/xml/txt/cs). Maddeler: E1, E4, E5, E6, UX15, UX20.

---

##### 1. Mimari (katmanlar)

```
routes/invoices.mjs  (iş kuralları: numara, seri kilidi, kronoloji, Gönderilecekler, belirsiz gönderim, iptal, durum)
   │ integrator(s)  invoices.mjs:469-483  (canlı kilidi, adres↔ortam, parola aç → connect)
   ▼
lib/einvoice/adapters.mjs  connect()  adapters.mjs:52-96  (tek arayüz: test/checkUser/ensureSession/send/loadDraft/sendDraft/status/cancel/officialPdf/inbox/markRead;
   │                        IntegratorError → HttpError, adapters.mjs:35-38)
   ▼
lib/einvoice/edm.mjs  createEdmClient()  edm.mjs:127-476  (yalnız EFaturaEDM.svc; http/WSDL/oturum/çağrı)
   │
   ▼
lib/einvoice/soap-contract.mjs  readWsdl/shape/renderTree/soapRequest  (WSDL'den işlem→SOAPAction, ad alanı, alan sırası; sözleşmede olmayan zorunlu alan → istek YOK)
lib/einvoice/ubl-tr.mjs  buildUbl()  (UBL-TR 2.1 XML; saf fonksiyon)        lib/einvoice/karekod.mjs (GİB karekodu, e-Fatura/e-Arşiv)
lib/einvoice/gorunum.mjs viewXslt/viewReference (gömülü XSLT görünüm)     lib/einvoice/ubl-read.mjs (gelen e-Fatura okuma)   integrator-error.mjs (hata sınıfı)
```

###### 1.1 Bayraklar (config.mjs)
- `edocEnabled` config.mjs:73 — yalnız program içinden (overrides); üretim girişi açık: `server/server.mjs:9 createApp({ edocEnabled: true, edocLive: true })`.
- `edocLive` config.mjs:76; `edocStatusPollMs` config.mjs:81 (iptal öncesi "işleniyor" yeniden sorma; üretimde [1000,2000] invoices.mjs:136);
  `edocSendBudgetMs` config.mjs:82 (Tümünü Gönder istek başı süre bütçesi, üretimde 10 sn; invoices.mjs:138).
- `esmmEnabled` config.mjs:85 (`overrides.esmmEnabled === true`, ortam değişkeni yok). invoices.mjs:140 `esmmEnabled = edocEnabled && config.esmmEnabled === true`.
- `testSeriesStart` config.mjs:88 → invoices.mjs:143 (test serisi rastgele büyük başlangıç; EDM test hesabı ORTAK).
- Testler: `test/helpers.mjs:26-28` bayrakları geçirir; üretim girişi denetimi `test/edoc-uretim.test.mjs` (server.mjs'i düzenli ifadeyle tarar:
  `/createApp\(\{\s*edocEnabled:\s*true,\s*edocLive:\s*true\s*\}\)/` — esmmEnabled eklenince bu ifade KIRILIR, güncellenmeli).

###### 1.2 EDM istemcisi (edm.mjs)
- Adresler `EDM_URLS` edm.mjs:26-29 (yalnız EFaturaEDM.svc test/canlı). Varsayılan ad alanı `EDM_DEFAULT_NS = i2i` edm.mjs:30 (WSDL okunamazsa).
- `http()` edm.mjs:134-167: zaman aşımı; YAN ETKİSİZ işlemler (`SAFE_OPERATIONS` edm.mjs:35: Login, CheckUser, GetInvoiceStatus, GetInvoice, MarkInvoice) kopan
  keep-alive bağlantıda bir kez yinelenir (edm.mjs:146-147). Hata sınıfı: bağlantı HİÇ kurulamadı (`NOT_CONNECTED` edm.mjs:41, vekil `PROXY_NOT_CONNECTED` :46)
  ya da yan etkisiz işlem yinelemede de düştü → `integrator-unreachable` (edm.mjs:155,162); aksi → `integrator-uncertain` (edm.mjs:163). Hata `contacts`'ı siler (:151).
- `loadContract()` edm.mjs:170-202: `?singleWsdl` → `?wsdl` (+aynı kökenden xsd importları); başarı 12 sa, okunamayan WSDL 1 dk (:195), ağ yoksa önbelleğe yazılmaz (:198).
  Önbellek `contracts` taban adres (base) anahtarlı (:172) → ayrı servis (ESmmEDM.svc) kendi sözleşmesini tutar.
- `call()` edm.mjs:212-240: `shape(contract, op, payload, { defaultNs: EDM_DEFAULT_NS })` (:214) — **ad alanı sabit; e-SMM için parametre olmalı**;
  sözleşme uyuşmazlığı 409 `integrator-contract`, istek gönderilmez (:215). SOAP Fault / RequestFault / REQUEST_ERROR / ERROR_TYPE → `integrator-rejected`
  (EDM kodu `integratorCode`) (:227-233); oturum hatası (10011) `sessionExpired` (:232); RETURN_CODE < 0 → reddedildi (:238).
- Oturum: `sessionKey = base|kullanıcı|sha256(parola)[0..16]` edm.mjs:132; `login()` :256-270 (hata `stage:"login"`, ortam ipucu LOGIN_HINT :255);
  `withSession()` :271-282 (oturum düşerse bir kez yeniden giriş); `ensureSession()` :311-316 (geçerli oturum + son 5 dk yanıt → ağa çıkmaz; değilse giriş).
  Logout HİÇ çağrılmaz (EDM Logout başka oturumları da kapatır, edm.mjs:16-18).
- Durum eşlemesi `EDM_STATES` edm.mjs:65-81 + `mapEdmStatus()` :82-101 (boşluklar atılır: "SEND - SUCCEED" → "SEND-SUCCEED"; RECEIVE-* gönderen karşılığı;
  bilinmeyen: CANCEL→cancelled, FAIL|ERROR→error, SUCCEED→sent, diğer→processing; e-Arşiv SEND-SUCCEED metni `earchive` ile :99).
- Kanal denetimi `assertChannel()` :105-109 (ProfileID EARSIVFATURA ↔ earchive bayrağı).
- İşlemler: checkUser :327-350, send :353-369 (SendInvoice; INVOICE ID/UUID **nitelik**), loadDraft :373-389, sendDraft :390-404, status :405-413 (`INVOICE_STATUS`),
  cancelEArchive :416-422, inbox :424-451, officialPdf :454-466 (GetInvoice DIRECTION=OUT, PDF; ZIP içinden), markRead :467-474. `resetEdmCaches` :479.

###### 1.3 Bağdaştırıcı (adapters.mjs)
- `integratorUrl` adapters.mjs:40 (Servis Adresi boşsa ortamın adresi). `testOnlyUrl` :44-47 (canlı kilitliyken izin listesi: boş, EDM test adresi, 127.0.0.1/localhost).
- `connect()` :52-96: TEK istemci (EFaturaEDM). `earchive = profile === "EARSIVFATURA"` :69; `cancel` e-Arşiv değilse 409 `einvoice-cancel-unsupported` :88-91.

###### 1.4 UBL (ubl-tr.mjs) ve karekod
- `buildUbl(doc, { variant, earchiveEmail, xslt, notes, paymentMeans })` ubl-tr.mjs:130-255. Stopaj UBL'de YALNIZ NOT: ubl-tr.mjs:157
  (`Gelir Vergisi Stopajı %…`). KDV `TaxTotal` 0015 (:206-208, taxCategory :101-104); KDV tevkifatı `WithholdingTaxTotal` (:209-214); `LegalMonetaryTotal` (:215-216:
  LineExtension = net, TaxExclusive = net, TaxInclusive = net+KDV, Payable = doc.payableTotal). İmza bloğu `cac:Signature` (:190-192), e-Arşiv SendingType (:186), görünüm (:187).
- `karekodData` karekod.mjs:24-62: `OTHER_PROFILES = ESMM, EMM, EMUSTAHSIL` (:20) → e-SMM'ye karekod BASILMAZ (kılavuz §2.4 ayrı alanlar ister: brutucret, tahsilkdv…).
- `ublFor()` invoices.mjs:430-435: görünüm açık ve satıcı bizsek önce şablonsuz XML → karekod → XSLT gömülür.

###### 1.5 Sunucu yolu: belge yaşam döngüsü (invoices.mjs)
- Durumlar `E_STATES` :61; gönderilebilir `E_SENDABLE` :64 (`"", none, exported, error, waiting, withdrawn, draft`); izlenen `E_TRACKED` :65;
  **Sonucu belirsiz** `uncertainSend = eStatus none && eAdapter dolu` :68 (UNCERTAIN_TEXT :69); EDM "bulunamadı" `remoteMissing = integratorCode 11017` :72.
- Test serileri `TEST_SERIES = TEF/TEA/TES` :80; `seriesFor` :1640-1646 (canlı değilse test serisi; smm+ESMM → esmm serisi); `nextNumber` :1657-1663 (MAX(seq)+1, başlangıç
  ayarı; `ensureTestStart` :1647-1656); numara biçimi `SERİ+YIL+9 hane` (16 karakter).
- Kayıtta numara: `writeIssued` :1838-… — "Kes, Sonra Gönder" `later` (:1842, numarasız `waiting`, seri sonu kronolojisi :1883-1884); `deferable` + `olderPending`
  (O1: serinin daha eski bekleyeni varsa numara VERİLMEZ, `orderHeld`, :1846,1889-1891); aksi `assertChronology` (:1678-1681) + `nextNumber`. Hepsi `bank.post` işlemi içinde
  (BEGIN IMMEDIATE → seri kilidi; iki kişi aynı anda kesse sıraya girer, :1867).
- Kayıttan önce ağ: `assertAliasBeforeNumber` :1287, `assertArchiveBuyerBeforeNumber` :3337-3351 (e-Arşiv mükellefiyet), `sendLoginBlock` :3262-3278 (giriş reddi / ulaşılamaz →
  `loginHold` → belge numarasız Gönderilecekler'e, :2538-2545). `integrator()` hatasını YUTAR (:3267-3270).
- Gönderilecekler: `unsentSql` :1196-1204 (`waiting` YA DA numaralı `""/none/error` + profil ≠ KAGIT + `kind IN sendKinds`; canlıda test serisi hariç); sekme `pending` :1026;
  `unsentNumbered` :654; liste şekli `eUnsent/eTestLive/eTest/eStatusLabel` :698-706.
- Kalıcı engeller: `sendBlockOf` :3145-3165 (seride daha yeni tarihli numara → `chronology`), `buyerBlockOf` :3227-3237 (mükellefe e-Arşiv → `buyer-is-efatura`);
  `PERMANENT_SEND_CODES` :3172; tur durduran kodlar `TURN_STOP_CODES` :3174 (`integrator-unreachable/url/credentials/login`); `loginRejected` :3179-3186.
- Gönderimde numara: `numberForSend` :3284-3313 (store.tx; withdrawn/sendBlock/buyerBlock/`olderPending` → 409 `einvoice-order`; `nextNumber`; açıklamalarda
  "(gönderilecek)" → numara `renumberNotes` :3104-3113). Kesin ulaşmadıysa numara geri: `releaseNumber` :3117-3141 (yalnız serinin SON numarasıysa).
- Tek belge gönderimi: `sendInvoice` (kilit `holdInvoice(id,"sending")`) :3385-3392 → `sendInvoiceOnce` :3394-3528: ağsız ön denetimler (:3399-3414) → bağlantı + preflight +
  mükellef + `ensureSession` NUMARADAN ÖNCE (:3421-3445) → `numberForSend` (:3447) → belirsizse önce `status` (:3465-3473) → taslak kontrolü → `ublFor` → send/loadDraft →
  hata sınıfı: reddedildi → `error`; kesin ulaşmadı + bu istekte numara → `releaseNumber`; isteği hiç gitmemiş kodlar (channel/url/credentials/login/session) durum değişmez;
  aksi → `none` + eAdapter yazılır = **belirsiz** (:3489-3521). 11048 (numara EDM'de kullanılmış) iletisi :3508-3513.
- Belge kilidi: `busy` Map + `holdInvoice/assertNotBusy` :2842-2859 (sending / cancelling / editing; aynı süreçte, bellek içi).
- Toplu gönderim `POST /send-pending` :3637-3831 (ayrıntı §4 E6). Tek gönderim `POST /:id/send` :3832; taslak `/:id/e-draft` :3839; durum `/:id/e-refresh` :3845-3862
  (belirsiz/taslakta 11017 → `clearE` :3092); resmî PDF `/:id/resmi.pdf` :3866-3885 (son durumda veri klasöründe önbellek).
- İptal `cancelInvoice` → `cancelInvoiceOnce` :2860-2940 (§4 E4). Müşteri Fişi Olarak Bırak `withdraw` :3531-3551 (FIS serisi, kronolojili) + `/:id/withdraw` :3605.
- Bağlantı testi `/integrator/test` :3886-3900 (lastTest :3902); kendi etiketler `/integrator/aliases` :3908; mükellef `/check-user` :3933-3945.

###### 1.6 Değişmezler (koddan)
1. Numara yalnız işlem içinde verilir (bank.post / store.tx); kronoloji: aynı seri+yılda numara sırası = tarih sırası (`assertChronology` :1678, `numberForSend` :3290-3299,
   `sendBlockOf` :3153). Aynı gün sırayı bozmaz (katı `<`).
2. Ağ yokken numara verilmez: giriş/erişim numaradan ÖNCE (:3435-3443, :3262-3277); numara verilip istek kesin ulaşmadıysa geri bırakılır (`releaseNumber` :3117).
3. İsteği gitmiş olabilecek hata → "belirsiz" (`none`+eAdapter); belirsiz belge silinmez/düzenlenmez/iptal edilmez/yeniden gönderilmez, önce Durum Sorgula (:68, :757, :2712, :2885, :3465).
4. Tümünü Gönder eskiden yeniye (`sendOrder` tarih→saat→kayıt anı→rowid, :3628; ders 31); geçici nedenle gönderilemeyen eski belge aynı serinin yenilerini bekletir (`held` :3814);
   kalıcı engelli belge bekletmez (:3807); bağlantı/hesap hatası turu durdurur, kalanlara numara verilmez (:3816-3819).
5. Yan etkili EDM çağrıları (Send/Load/Cancel) YİNELENMEZ (edm.mjs:33-35, 144-147).
6. Canlı kilit: env live ve Servis Adresi test dışı iken ağa çıkılmaz (:474-478; settingsInput :303-310).
7. Parola istemciye hiç çıkmaz (publicSettings :449-454 `hasPassword`); günlüğe yazılmaz (:2349).
8. Belge başına tek entegratör işlemi (gönderim ↔ iptal ↔ düzenle ↔ sil; `busy` :2842).

---

##### 2. Önemli bulgu: e-SMM bugün "gönderilmez tür"

`INVOICE_KINDS.smm.send = false` (server/lib/invoice-math.mjs:40). e-Belge akışının HER kapısı `kind.send`'e bakar:
invoices.mjs:654 (`unsentNumbered`), :992 `canSend`, :995 `canRefresh`, :997 `canDraft`, :1000 `canOfficial`, :1197 (`unsentSql` sendKinds), :1842/:1846 (`later`/`deferable`),
:2308 (`/meta` kinds.send istemciye), :3258 (`sendWouldContact`), :3979 (ubl.zip). Bu yüzden bayrak açık kurulumda bile makbuz kayıtta TES numarası alıp hiçbir listede
gönderilemiyor (test/esmm-gizli-241.test.mjs:63-75 bunu "eski davranış" olarak sabitliyor). INVOICE_KINDS'i doğrudan `send:true` yapmak, `esmmEnabled` kapalı kurulumda
2.4.0'dan kalan `profile=ESMM` numaralı makbuzları (test/kontrol-241.test.mjs:37-45) Gönderilecekler'e sokar → yanlış. **Öneri:** invoices.mjs içinde tek yardımcı
`sendKind(kind) = INVOICE_KINDS[kind]?.send || (kind === "smm" && esmmEnabled)` ve yukarıdaki 10 yerin hepsi buna geçer (SQL'de `sendKinds` dizisi de).

---

##### 3. E1 — e-SMM (EDM ESmmEDM.svc)

###### 3.1 Belgeden okunanlar (EDM e-SMM Web API v4.4.1 + Request-Response + xlsx + örnek UBL + TesterCurrent.cs)
- Test uç noktası: `https://test.edmbilisim.com.tr/EFaturaEDM21ea/ESmmEDM.svc` (kılavuz §1.2). **Canlı adres kılavuzda YOK → DOĞRULANMADI** (CLAUDE.md 19.10 notundaki
  `portal2…/EFaturaEDM/ESmmEDM.svc` 21.10 notunda "bugünkü belgelerde yok, EDM'den teyit" diye geri çekilmiş).
- WCF, SOAP 1.1/1.2; örnek isteklerde kök `tem:` = `http://tempuri.org/`, çocuklar niteliksiz (`REQUEST_HEADER xmlns=""`). Gerçek e-Fatura WSDL'i de tempuri.org
  (tools/ebelge/sema/edm/EFaturaEDM-test-singleWsdl.xml; test/edm-gercek-sozlesme.test.mjs:16,32). **ESmmEDM WSDL'i depoda YOK** (19.10'da 200 döndüğü not edilmiş).
- İşlemler (C# istemci): Login, Logout, SendSMM, LoadSMM, SendSMMPrepared, LoadSMMPrepared, GetSMM, GetSMMStatus, MarkSMM, GetUserList(Binary), CheckUser, CancelSMM, CheckCounter.
- Gönderim yolları: NESNE (SendSMM: SMM_LINE_ITEMS FEE_REASON/GROSS_AMOUNT/STOPPAGE_RATE/NET_AMOUNT/TAX_RATE/WITHHOLDING_TAX_*/NET_REVENUE + SUPPLIER_* alıcı alanları;
  `SMM_CONTENT_TYPE` zorunlu, EXCEL/XLSX şablonu) ve UBL (SendSMMPrepared: SMM{CONTENT base64 contentType="application/xml", HEADER{SENDER,RECEIVER,TO=e-posta,FROM=GB}}, RECEIVER{vkn,alias}).
- SMM nesnesinde `ID` ve `UUID` **ÇOCUK ÖĞE** (örnek XML), e-Fatura'daki gibi nitelik DEĞİL (edm.mjs:357 `INVOICE` ID/UUID niteliktir). GetSMMStatusRequest `SMM` (kılavuz tipini
  "INVOICE" yazıyor) → nitelik mi öğe mi **DOĞRULANMADI** (WSDL'den okunmalı; soap-contract `shape` niteliği denetlemez, yanlış biçim sessizce "bulunamadı" verir).
- Numara: "16 haneli SMM No" (ABC2009123456789 = bizim biçimimiz 3+4+9). EDM numarayı kendisi de üretir (makbuzNo'ya özel değer; tarih sıralı). GetSMMStatus yanıtı `SMM_STATUS`
  (STATUS, STATUS_DESCRIPTION, CDATE, EARCHIVE_REPORT_*), HEADER içinde GIB_STATUS_CODE.
- Durumlar (xlsx): LOAD-SUCCEED, LOAD-FAIL, SEND-PROCESSING, SEND-WAIT_GIB_RESPONSE, SEND-WAIT_SYSTEM_RESPONSE, UNKNOWN-UNKNOWN, SEND-FAILED ("aynı no ile tekrar gönder"),
  SEND-SUCCEED (son durum), CANCELLED-SUCCEED, PACKAGE-PROCESSING, PACKAGE-FAIL (**"SMM iptal edilir ve tekrar gönderilir"** — e-Fatura metniyle FARKLI, edm.mjs:67-68).
- İptal: CancelSMM SMM[] (ID/UUID). "E-Arşiv Fatura senaryosundaki gibi… başarısız ve taslak SMM'ler de iptale çekilebilir". **Süre sınırı yazmıyor.**
- UBL örneği (esmm-ubl-ornek-veri.xml) + Ek_bilgi.txt: ProfileID `ESMM`, InvoiceTypeCode `SATIS`; TaxTotal'da iki TaxSubtotal: `0003` (stopaj, CalculationSequenceNumeric 1,
  Percent 20) ve `0015` (KDV, sıra 2); TaxTotal/TaxAmount = yalnız KDV; LegalMonetaryTotal: LineExtension = **Brüt Ücret**, TaxExclusive = **Net Ücret** (brüt − stopaj),
  TaxInclusive = **Tahsil Edilen KDV** (!), Payable = **Net Alınan Toplam**. Satır: InvoicedQuantity(unitCode NIU) = Net Ücret, LineExtension = Brüt, Price = Net Tahsilat.
  Örnek sayılar kendi içinde TUTARLI (234,69 × %20 = 46,938 → 187,75; KDV %18 brütten 42,2442; 187,75 + 42,24 ≈ 230). TUTARSIZ olan C# NESNE örneği (NET_AMOUNT 225,92 >
  GROSS 195,50). Örnekte imza (cac:Signature) ve SendingType YOK; görünüm `<?xml-stylesheet href="general-esmm.xslt"?>` (gömülü değil).
- GİB e-Fatura paketi şematronu ESMM profilini tanımıyor (tools/ebelge/sema/gib/UBL-TR_Codelist.xml:5-6 ProfileIDType/Earchive listelerinde yok; 0003 TaxType listede var :15)
  → kâhin olarak GİB e-SMM teknik kılavuzu/paketi gerekir (**DOĞRULANMADI, depoda yok**).

###### 3.2 Programın SMM hesabı ↔ EDM alanları (invoice-math.mjs:246-295, :320-323)
| Program (kuruş) | Anlam | UBL (EDM örneği) | NESNE alanı |
|---|---|---|---|
| `net_total` (= Σ satır net) | Brüt ücret (KDV hariç, iskonto sonrası) | LegalMonetaryTotal/LineExtensionAmount; satır LineExtensionAmount | GROSS_AMOUNT |
| `stoppage_total` = mulDiv(net, oran) (:278, belge toplamından TEK hesap) | Gelir vergisi stopajı | TaxSubtotal 0003 TaxAmount, Percent=stoppage_rate | STOPPAGE_RATE |
| `net − stoppage` | Net ücret | TaxExclusiveAmount; satır InvoicedQuantity | NET_AMOUNT |
| `vat_total` | KDV | TaxSubtotal 0015 + TaxTotal/TaxAmount + **TaxInclusiveAmount** | TAX_RATE |
| `withheld_total` | KDV tevkifatı | WithholdingTaxTotal (bugünkü yapı) — e-SMM'de biçimi **DOĞRULANMADI** | WITHHOLDING_TAX_CODE/RATE |
| `payable_total` = net+KDV−tevkifat−stopaj (:293) | Net alınan | PayableAmount; satır Price | NET_REVENUE |
Satır düzeyi stopaj programda YOK (belge toplamından) → UBL satırlarına kuruşu kuruşuna dağıtım gerekir (en büyük kalan; Σ satır = belge). Kâhin bu kuraldan
programın kodunu görmeden yazılmalı (ders 5).

###### 3.3 Önerilen en küçük güvenli uygulama
1. **İstemci (edm.mjs):** `createEdmClient`'ı servis tanımıyla parametrele (`service: "efatura" | "esmm"` ya da ayrı `createEdmSmmClient` aynı iç parçalarla):
   ortak: `http` (B2/B3 sınıflaması), `loadContract` (base anahtarlı), `call` (yalnız `defaultNs` parametresi; e-SMM `http://tempuri.org/`), `header`, `login`, `withSession`,
   `ensureSession`, `contacts`. e-SMM'ye özgü: `SAFE_OPERATIONS` += GetSMMStatus, GetSMM, MarkSMM, CheckCounter (SendSMM*/LoadSMM*/CancelSMM YOK); `EDM_SMM_OPERATIONS`
   (Login, SendSMMPrepared, GetSMMStatus, GetSMM, CancelSMM) sözleşme raporu için; `EDM_SMM_URLS = { test: …/ESmmEDM.svc, live: "" }` (canlı boş → açık hata).
   İşlemler: `sendSmm({ xml, number, uuid, senderVkn, senderAlias, receiverVkn, receiverEmail })` → `SendSMMPrepared` (SMM öğeleri: ID, UUID, CONTENT, HEADER{SENDER,RECEIVER,FROM,TO};
   SMM_CONTENT_TYPE "XML" `optional`), `smmStatus({ uuid, number })` → `SMM_STATUS` okunur, `cancelSmm`, `smmPdf` (GetSMM; SMM_SEARCH_KEY UUID + LIMIT 1, HEADER_ONLY N,
   SMM_CONTENT_TYPE PDF; `%PDF-` denetimi edm.mjs:463 kalıbı). `assertChannel` karşılığı: ProfileID === "ESMM".
   `mapEdmStatus` e-SMM metinleri (`kind: "esmm"`): LOAD-FAIL → error; PACKAGE-FAIL → error + "iptal edip yeniden gönderin"; SEND-SUCCEED → sent ("e-SMM oluşturuldu…");
   e-SMM'de accepted/rejected YOK.
   Numara: **program verir** (mevcut kronoloji/kopma/releaseNumber/11048 güvenceleri tek yerde; EDM'ye ID gider). EDM'nin test hesabında programın verdiği TES numarasını
   kabul ettiği **DOĞRULANMADI** (e-Fatura'da TEF/TEA kabul edildi).
2. **Bağdaştırıcı (adapters.mjs):** `connect()` iki istemci (fatura + e-SMM; e-SMM adresi: Servis Adresi `…/EFaturaEDM.svc` ise aynı yolda `ESmmEDM.svc`, boşsa ortamın e-SMM adresi —
   canlı adres teyitsizse `integrator-url` hatası). `send/status/cancel/officialPdf/ensureSession` belgenin `profile === "ESMM"` olup olmamasına göre yönlenir;
   **`ensureSession` imzası belge/profil almalı** (bugün argümansız: invoices.mjs:3272, :3438) — yoksa e-SMM gönderiminden önce yanlış servise giriş denenir ve "numara
   giriş başarılıysa verilir" güvencesi e-SMM için boşa çıkar.
3. **UBL (ubl-tr.mjs):** `buildUbl` içinde `doc.profile === "ESMM"` dalı: TaxTotal = [0003 stopaj, 0015 KDV] (CalculationSequenceNumeric), LegalMonetaryTotal EDM anlamıyla,
   satırlar stopaj dağıtımlı; stopaj Note'u (:157) bu dalda kaldırılabilir/korunabilir (karar). İmza ve SendingType bu dalda yazılsın mı **DOĞRULANMADI** (örnekte yok).
   `ublFor` (invoices.mjs:430-435): ESMM'de kendi XSLT'mizi gömme (gorunum.mjs fatura için; e-SMM alanları yok) → EDM varsayılan şablonu; karekod zaten basılmaz (karekod.mjs:20).
4. **Rota (invoices.mjs):** §2'deki `sendKind`; `preflight` (:3317-3330) ESMM'de alıcıyı EARSIV kuralıyla zaten denetler (:3320); `remoteEligible` (:2878) ESMM'yi de
   kapsasın (draft hariç, e-SMM taslak 2.4.4'te kapalı tutulmalı: `canDraft` ESMM için false); `integrator/test` (:3886) e-SMM işaretliyse ESmmEDM girişini de denesin;
   `remoteMissing` (:72) e-SMM "bulunamadı" kodu **DOĞRULANMADI** (11017 değilse belirsiz e-SMM hiç temizlenemez — `e-refresh` :3855 ve iptal :2917 bu koda dayanır).
5. **Açma:** `server/server.mjs:9` → `createApp({ edocEnabled: true, edocLive: true, esmmEnabled: true })` + `test/edoc-uretim.test.mjs` düzenli ifadesi. Canlı e-SMM adresi EDM'den
   gelene dek **ayrı kilit** önerilir (ör. config `esmmLive`, yalnız program içinden): üretimde `edocLive: true` olduğu için e-SMM bayrağı açılınca canlı ortam seçili firma
   doğrudan teyitsiz adrese yasal makbuz gönderebilir.
6. 2.4.0'dan kalan numaralı ESMM makbuzları (TES/ESM, e_status none) bayrak açılınca Gönderilecekler'de "Gönderilmedi" görünecek (unsentSql :1201). Karar: gönderilsin mi, ayrı
   işaretlensin mi (açık soru).

###### 3.4 Testler
- Var olan, güncellenecek: `test/esmm-gizli-241.test.mjs` (bayrak açıkken beklenti: TES numarası + Gönderilecekler + gönderilebilir), `test/kontrol-241.test.mjs` (eski ESMM verisi),
  `test/edoc-uretim.test.mjs` (server.mjs), `test/einvoice-mock.mjs` (SMM işlemleri; kök öğe adına göre — sunucu yolu ayırt etmiyor, :93-123), `test/einvoice-edm.test.mjs`
  (istemci birim), `test/ebelge-uygunluk.test.mjs` (XSD; ESMM için GİB e-SMM kâhini gerekli).
- Yeni: `tools/ebelge/sema/edm/ESmmEDM-test-singleWsdl.xml` (herkese açık WSDL, KAYNAK.md'ye sha256) + `test/esmm-gercek-sozlesme.test.mjs` (işlem adları, ad alanı, SMM ID/UUID öğe mi,
  GetSMMStatusRequest biçimi); e-SMM uçtan uca (sahte EDM): kaydet → Gönderilecekler → gönder (numara gönderimde) → durum → resmî PDF → iptal; kronoloji; belirsiz gönderim;
  ulaşılamaz + releaseNumber; 11048; ESMM UBL satır stopaj dağıtımı (kuruş toplamı); ders 30 lisans adresi. Para-numara çekirdeği → **mutasyon** (stopaj dağıtımı, sendKind kapısı,
  ensureSession yönlendirmesi) + **dar kontrol** (ders 32). Bağımsız kâhin `test/bagimsiz/ebelge/model.py`'ye "esmm" türü AYRI elden (ders 5).
- Gerçek EDM test hesabında uçtan uca (ders 14/18): numara kabulü, durum geçişleri, PDF, iptal, iptal süresi, "bulunamadı" kodu.

---

##### 4. E4 — e-Arşiv iptal "8. gün"

- Yer: invoices.mjs:2893 `if (remote && eStatus !== "draft" && eStatus !== "error" && daysBetween(existing.issueDate, today()) > 8) → 409 einvoice-cancel-late`.
  `daysBetween` :2287 (UTC gece yarıları farkı, tam gün), `today()` :155 (`period.today()` ya da yerel `isoDay(clock())`, plans.mjs:20 yerel).
  `remote = remoteEligible(existing) && !localOnly` (:2878, :2890) → yalnız EARSIVFATURA + [draft, processing, sent, accepted, error].
- Anlamı: kesim günü 0 → 0..8. gün iptal EDM'ye gider; 9. günden itibaren red. İleti "kesildikten 8 gün sonra iptal edilemez" 8. gün iptale izin verildiği için muğlak.
- Kâhinle fark: `test/bagimsiz/ebelge/model.py:464-482` ve KARARLAR.md K22/K23: kesin kabul YALNIZ `yas <= 7` ("7 gün içinde (8 günlük sınırın içinde)"); 8. gün çatala düşer
  (red 4xx YA DA programda iptal 2xx) → programın 8. gündeki EDM iptali çatalın "iptal edildi" dalına uyduğu için **fark görünmez**; ama aynı modelin ağ-yok dalı `yas <= 8`'i
  "sınırın içi" sayıyor (:476) → kâhin kendi içinde 7/8 belirsiz.
- **Test yok:** depoda `einvoice-cancel-late` kodunu ya da 8/9. gün sınırını sınayan test bulunamadı (grep). 2.4.4'te sahte saatle (config.now; ders 13) 7/8/9. gün + ay sonu/yıl
  dönümü sınır testi ve kırmızı kanıt gerekir. Kural kararı mali müşavirde (açık soru).
- Kör nokta: `localOnly` yolu (:2880-2887) `remoteEligible` belgede de (gönderilmiş e-Arşiv dahil) kabul edilir ve 8 gün denetimini atlar (`remote` false); ekran bu yolu yalnız
  belirsiz/taslakta gösterir (`canLocalCancel` :983) ama API'den 30 günlük gönderilmiş e-Arşiv "yalnız programda" iptal edilebilir (Fatura Ayarları yetkisi + onay). Kâhin K23 bunu
  çatal olarak kabul ediyor; bilinçli mi, sınırlansın mı → açık soru.
- e-SMM için süre: EDM kılavuzunda yok; aynı kural uygulanacaksa `remoteEligible`/8 gün koşulu ESMM'yi de kapsayacak şekilde ayrıştırılmalı (karar mali müşavirde).

---

##### 5. E5 — Entegratör Ayarları (sunucu doğrulaması)

- Kayıt: `settingsInput` integrator bölümü invoices.mjs:296-326. Kullanıcı adı `limited(input.username, 120)` :311 → `text()` http.mjs:192 **zaten baştan/sondan kırpar**.
  Parola (:313-317) kırpılmaz (boşluk geçerli karakter olabilir; EDM parola kuralı DOĞRULANMADI → kırpma önerilmez). Servis Adresi ayrı alan, biçim + canlı kilit (:304-310).
- Bugün kullanıcı adında URL denetimi YOK → kullanıcının durumu (19.10): EDM 11010 "Kullanıcı Bulunamadı" (edm.mjs:255 LOGIN_HINT ortam ipucu verir, nedeni değil).
- Öneri (en küçük): (a) `settingsInput`'ta `username` için `/:\/\/|^www\.|\.svc(\b|$)/i` → `fail400("Kullanıcı Adı alanına servis adresi yazılmış; Kullanıcı Adı'na EDM'nin verdiği
  web servis kullanıcı adını yazın (adres Servis Adresi alanına girer).", "integrator.username", { code: "integrator-username-url" })` — kayıt yapılmaz. (b) Eski kayıtta kalmış değer
  için `integrator()` (:469-483) ağa çıkmadan aynı 409 kodu — ardışık hatalı girişte EDM hesabının kilitlenme riskine karşı (invoices.mjs:2559-2560 notu). (c) Bu kod
  `TURN_STOP_CODES`'a (:3174) eklenmeli; yoksa Tümünü Gönder her belgede yeniden dener. (d) `sendLoginBlock` (:3267-3270) `integrator()` hatasını yutup kayıtta numarayı
  verdiriyor (bugün "not-configured" için de böyle) — URL'li kullanıcı adında da belge numaralı-gönderilmemiş kalır; numarasız bekletmek istenirse burada `integrator-login`
  hold'una çevrilir (para-numara çekirdeği → dar kontrol).
- "Kayıtlı parola gösterilmez" netliği istemci metnidir; sunucu `hasPassword` (:453) yeterli, değişiklik gerekmez.
- Testler: settings PUT 400 (yeni), eski kayıtla gönderim/test 409 ve EDM'ye istek gitmediği (mock `calls`), Tümünü Gönder durur. Eski kodda kırmızı.

---

##### 6. E6 — "Seçilenleri Gönder" (sunucu yolu)

###### 6.1 Bugünkü `/send-pending` (invoices.mjs:3637-3831)
- `{ all: true, after? }` (Tümünü Gönder; istemci hof-invoices.js:2796): sunucu `unsentSql` ile Gönderilecekler'in TAMAMINI seçer (:3659-3661), `sendOrder` ile sıralar, kalıcı
  engellileri listeler (:3664-3667), imleçten öncekileri "geçti" sayar ve `held`'e koyar (:3668, :3678-3685), istek başına `SEND_CHUNK=20` deneme ya da `SEND_BUDGET_MS`
  (:3626-3627, :3746), `remaining` + `cursor` döner (:3824-3830).
- `{ ids }` (seçili kimlik yolu, ZATEN VAR; testler: test/ebelge-243-gonderim.test.mjs:78,99,113; test/gg243-gonderim.test.mjs:127,157; kâhin koşucusu
  test/bagimsiz/ebelge/kosucu.mjs:275): en çok `SEND_TURN=200` (:3690), sunucuda tarih sırasına dizilir (:3694-3695), **parçalanmaz, süre bütçesi yok** (:3625, :3746 yalnız `all`),
  kimlikler `unsentSql` ile SÜZÜLMEZ (gönderilmiş belge seçilirse `einvoice-already-sent` → ok:true done:true "başka oturumda gönderildi" :3794-3797 — yanıltıcı),
  seçime dahil olmayan daha eski numarasız bekleyen (`outside`, :3701-3709) varsa aynı serinin daha yeni seçilileri gönderim SIRASINDA `skipped reason:"outside"` olur (:3767-3770) —
  yani bugün **yarım tur + sonradan bildirme**.
- Asıl güvence her iki yolda `numberForSend` içindeki `olderPending` (:3298) — istemci atlatırsa da `einvoice-order` 409.

###### 6.2 Önerilen en küçük güvenli uygulama
1. Yeni gövde biçimi Tümünü Gönder'in AYNI dalına girsin: `{ all: true, only: [ids…], after? }` → `all` dalında SQL'e `AND i.id IN (SELECT value FROM json_each(?))` (:3661);
   böylece sıralama, kalıcı engel, imleç, `held`, parça/süre bütçesi, durdurma, belirsiz-önce-sor, seri kilidi BİREBİR aynı. Eski `{ ids }` biçimi testler ve kâhin için kalır.
2. `only` ilk isteğinde (after yokken) ÖN DENETİM, hiçbir belge gönderilmeden: `outside` hesabı (:3703-3709 kalıbı, `!all` koşulu yerine `!all || only`) seçili olmayan, kalıcı
   engelsiz, `waiting` belgelerden; seçilenlerden en az birini bekletecek olanlar (aynı `seri|yıl`, `issueDate <` o serideki seçili en yeni tarih). Varsa ve gövdede onay yoksa
   409 `{ code: "einvoice-selection-older", count, older: [{ id, displayNo, issueDate, accountName, series }] (ilk 50) }`. İstemci: "Önce şu tarihli N belge gönderilmeli —
   Onları da Ekle / Vazgeç"; "Ekle" → `only = seçili ∪ older`. (Sessiz atlama ya da yarım tur yok.)
3. Seçimdeki Gönderilecekler dışı kimlikler `unsentSql` süzgecinden düşer → yanıtta ayrı `notPending` listesi ("Gönderilecekler'de değil") — "başka oturumda gönderildi" denmez.
4. Düğme sayısı istemcide (liste satırı `eUnsent`/`eStatus` :698-704); kalıcı engelliler yanıtta `permanent` olarak gelir.
- Testler: kırmızı (eski kodda: ön denetim yok → yeni belge "outside" ile atlanır ya da sırayla numaralanır), "onları da ekle" sonrası numaralar tarih sırası; aynı gün sırayı
  bozmaz; kalıcı engelli eski belge engel sayılmaz; iki oturum aynı anda (busy); ağ yok (tur durur, numara yok); >20 seçimde parça + imleç; kâhin K10'a "seçili" ön denetimi
  AYRI elden (ders 5); mutasyon (ön denetim kaldırılınca test kırmızı); dar kontrol (ders 32).

---

##### 7. UX15 — kronoloji çakışmasının forma erken bildirimi (sunucu ucu)

- Bugün `/calc` (invoices.mjs:2463-2498) `nextNumber` (:2490), `blockers = issueBlockers(doc)` (:2492, :1832-1835: satıcı/alıcı/iade/tür karışımı), `aliasBlock` (:2496),
  `warnings = docWarnings` (:2288-2295: yalnız VUK 7 gün) döner; **kronoloji yok**. İstemci onayı `c.nextNumber` ile "X numarasıyla kaydedilecek" der (hof-invoices.js:2157),
  sonra `assertChronology` (:1678) ya da `later` dalındaki aynı denetim (:1883-1884) 400 `chronology` verir.
- Öneri: tek fonksiyon `numberingChronology(doc)` (seri = `seriesFor` ya da iç seri; `last = seq>0 ORDER BY seq DESC`; `last.issueDate > doc.date` → ileti) — `assertChronology`,
  `later` dalı ve `/calc` AYNI fonksiyonu kullansın (kopya kural yok). `/calc` yanıtına `chronology: "<ileti>"` (doluysa `nextNumber: ""`); istemci blockers'a ekler.
  İsteğe bağlı: `olderPending > 0` ise `orderHold: { count, text: orderText(...) }` → onay "numarasız Gönderilecekler'e eklenecek" desin (numara göstermesin).
- Sınır: `/calc` düzenleme kipini bilmiyor (existingId yalnız iadede, hof-invoices.js:1614); kayıtlı belgenin tarih düzenlemesinin kuralı farklı (önceki/sonraki belge :795-802,
  numarasız bekleyen :788-794). İstemci düzenlemede bu alanı yok saymalı ya da existingId her düzenlemede gönderilip edit kuralı da aynı fonksiyondan verilmeli.
- Asıl güvence işlem içindeki denetimdir (yarış); `/calc` yalnız bilgi. Testler: geriye tarihli kayıt formu → calc.chronology dolu, nextNumber boş; kayıt 400 aynı ileti; aynı gün
  boş; FIS/SMM/iç seri; "Kes, Sonra Gönder" aynı kural.

##### 8. UX20 — EDM'ye ulaşılamayınca yanıt

- Sunucu: kayıtta `sendLoginBlock` erişimsizliği görürse belge numarasız `waiting` yazılır ve yanıt `autoSend = loginHoldResult({code:"integrator-unreachable"})` =
  `{ ok:false, pending:true, held:true, code, number:"", message:"EDM'ye ulaşılamadı; belge numarasız Gönderilecekler'e eklendi…" }` (invoices.mjs:3279-3282, :2538-2546);
  `displayNo` numarasız beklemede **"Gönderilecek"** döner (:508).
- İstemci önce başarı (`${kindLabel} ${saved.displayNo} kaydedildi.` → "Satış Faturası Gönderilecek kaydedildi.", hof-invoices.js:2184) SONRA `held` hata bildirimi (:2191) gösterir
  → bulgudaki çift bildirim. Sunucuda değişiklik GEREKMEZ: `autoSend.held/pending/code` ayırt etmeye yeter. Düzeltme istemcide (held ise tek bildirim; numara yoksa displayNo
  basılmaz). İsteğe bağlı sunucu kolaylığı yok önerisi: alan eklemek yerine istemci mevcut alanları kullansın.
- Numara verildikten sonra kopma (`integrator-uncertain`) ayrı yol: `unsentResult` (:3598-3604) — numara + "Sonucu belirsiz" iletisi; iki bildirim burada anlamlı (kaydedildi + gönderilemedi).

---

##### 9. Riskler (özet)
- e-SMM: canlı adres teyitsiz + üretimde edocLive açık; ESmmEDM WSDL'i depoda yok (SMM ID/UUID biçimi, GetSMMStatus biçimi okunmadan istek sessizce "bulunamadı" alabilir);
  "bulunamadı" kodu ve 11048 karşılığı bilinmiyor (belirsiz e-SMM temizlenemez); EDM'nin program numarasını kabulü; PACKAGE-FAIL davranışı farklı; satır stopaj dağıtımı;
  `ensureSession` yönlendirmesi unutulursa e-SMM'de "ağ yokken numara verilmez" güvencesi kırılır; 2.4.0'dan kalan ESMM makbuzları Gönderilecekler'e düşer; gorunum.mjs e-SMM'ye uymaz.
- E6: `{ ids }` yolu parçasız (200 belge × gerçek EDM hızı > istemci 150 sn) — yeni `only` yolu bunu da çözer; eski yolu kullanan kâhin/testler bozulmamalı.
- E4: sınır testi yok; localOnly 8 gün kuralını atlar.
- E5: URL'li kullanıcı adı TURN_STOP_CODES'ta değilse toplu turda tekrar tekrar giriş denemesi (hesap kilidi).
- Genel: `EDM_DEFAULT_NS` (i2i) gerçek EDM ad alanıyla (tempuri.org) uyuşmuyor; WSDL okunamazsa varsayılan sözleşmeyle giden istek büyük olasılıkla reddedilir (e-Fatura için de).

### EK-2 fatura-istemci

#### Harita: fatura-istemci (2.4.4 hazırlığı, 21.10.2026)

Kaynak: `client/assets/hof-invoices.js` (3528 satır, TAMAMI okundu), `client/assets/hof-ui.css` `.hof-inv-*` (9788–10002, 10931–10958),
ilgili sunucu uçları (`server/routes/invoices.mjs`), fatura e2e'leri ve uzman bulgu dosyaları. Kod 2.4.3 (163dd5d) ile aynı; HEAD cbcedb0 yalnız belge.
Satır numaraları bugünkü ağaçtandır; bulgu dosyalarındaki satır numaraları 5966ac3'e aittir, KAYMIŞTIR (ör. UX16 "hof-invoices.js:696" bugün 744–756).

---

##### 1. Mimari (dosya:satır)

- Tek IIFE, `HOF.invoices = { open, newFor, openDoc, forAccount, sendPendingTimeoutMs, eUnitAsAdet, edocEnabled, autoCheckUser }` (hof-invoices.js:3475).
- Durum tek nesnede: `view` (21) — mode `list|pick|form|card|settings|inbox|inbox-item`, tab, süzgeçler, `selected` (Set), `list`, `doc`, `form`,
  `sendProgress` (Tümünü Gönder sürerken). `meta` = `GET /api/workspace/invoices/meta` (72–77; sunucu invoices.mjs:2303–2332).
- Pencere: `HOF.modal({ title: moduleName(), eyebrow: "OPERASYON" })` (83–94) → çekirdek `<h2 class="hof-modal-title">` (hof-core.js:907–922).
  Kaydırma kabı pencerenin kendisi: `.hof-modal { overflow:auto }` (hof-ui.css:366–371), `.hof-invoices-modal { height: calc(100vh - 36px) }` (9788).
- Olaylar pencerede tek dinleyiciyle: click → `onClick` (353–426), change → `onChange` (441–450), input → `onInput` (451–453), keydown → `onKey` (454–462);
  form modunda `formClick` (1925–2070), `formChange` (1755–1852), `formInput` (1665–1750), `formKey` (1853–1885).
- `setMode` (133–140): `is-form` sınıfı (CSS'te kuralı YOK; yalnız e2e işareti, senaryo-form-izolasyon-243.mjs:544–559) ve form kapsamı `data-hof-form` (kaydedilmemiş soru).
- Liste: `renderList` (258–314) — üst satır `.hof-plan-head` (287–294; "+ Yeni Fatura", "Tümünü Gönder", "Fatura Ayarları", "Entegratör Ayarları", "Liste - PDF"/"Liste - Excel"),
  sekmeler (265; e-Belge açıkken "Gönderilecekler" ve "Gelen e-Faturalar"), özet kutuları (296), süzgeçler (297–305; "Belge Türü" 302), seçim çubuğu (306), tablo (309).
  Yükleme `loadList`/`loadListOnce` (198–246; HOF.listGate + "Daha Fazla" yarışı H5 korunur).
- Form: `startForm` (525–581) → `renderForm` (627–699) → `renderLines` (891–926), `renderPay` (1106–1147), `renderTotals` (1491–1516), `scheduleCalc`→`calcOnce` (1560–1638;
  toplamlar YALNIZ sunucunun `/calc`'ından, invoices.mjs:2463–2498). Düğmeler `formActions`/`sendable` (2096–2097), kayıt `submitForm` (2098–2212).
- Kart: `loadDoc`/`showDoc`/`renderCard` (2246–2389), eylemler `cardAction` (2390–2424): payForm (2427), offsetForm (2467), cancelForm (2537), localCancelForm (2568),
  deleteForm (2666), withdrawDoc (2621), eAction (2866).
- Toplu: bulkIssue (2637), bulkDelete (2686), bulkCancel (2708), bulkWithNegative (2730), bulkOutcome (2745 — başarısızlar seçili kalır).
- Gönderilecekler: `pendingTotal` (2754), `sendPendingButton` (2758–2762), `showSendProgress` (2763–2770), `SEND_PENDING_TIMEOUT_MS = 150000` (2773),
  `sendPending` (2774–2856) — imleçli döngü + özet bildirim.
- Fatura Ayarları: showSettings/renderSettings/settingsPayload/settingsAction (2880–3085). Entegratör Ayarları ayrı pencere: `showIntegrator` (3126–3342).
- Gelen kutusu: loadInbox/renderInbox/inboxAction (3351–3464).
- Canlı yenileme: `HOF.refresher` + `live:workspace.changed` + `onLedger` (3498–3527).

##### 2. Değişmezler (bozulmayacaklar)

1. Toplamlar istemcide hesaplanmaz: `form.calc` sunucudan (1614); istemci yalnız "Kalan" gösterimi için `paidSum/restOf` (1101–1104).
2. Kayıt ekranda görünenle yapılır: Kaydet önce bekleyen "Kalanın Tamamını…" işini ve hesabı bitirir (2115–2124, 1569–1577).
3. Form başına istek kimliği (537; 2142, 2182) — yinelenen Kaydet ikinci belge açmaz.
4. Ödeme satırları hesap dönünce yeniden çizilmez (2.0.23 Bulgu 1): yalnız `renderRest` (1470–1488, 1588–1590).
5. Kesin red nedeni (blockers) varken numaralı onay açılmaz (2154–2155; sunucu `issueBlockers` invoices.mjs:1832–1835).
6. Kâğıt belgede "Kaydet ve Gönder" yok; düğmeler yalnız gönderilebilirlik değişince yeniden çizilir (1649, 2096 `drawnSendable`).
7. e-Belge numarası tarih sırasıyla SUNUCUDA verilir; istemci sırayı belirlemez, `{ all: true, after: cursor }` gönderir (2796; sunucu `sendOrder` invoices.mjs:3628).
8. Tümünü Gönder'de aynı anda tek istek, ikinci tur açılmaz (`view.sendProgress` 2775, 2779; e2e gg243-tumunu-gonder A).
9. İstemci zaman aşımı hata değildir ("sunucuda sürüyor olabilir", 2816–2817); sonucu belirsiz belge sunucuda önce sorulur (invoices.mjs:67–69 `uncertainSend`).
10. Parola istemciye hiç gelmez: sunucu `passwordSealed`'ı düşürür, yalnız `hasPassword` (invoices.mjs:449–454); alan boş + "Kayıtlı" placeholder (3157).
11. Kart/liste canlı yenilemesi kullanıcıyı yerinden etmez (2250, 2254).
12. Yazım düzeni: bütün adlar her sözcük büyük ("e-" önekleri olduğu gibi; server/lib/text-case.mjs:7–33); denetim test/yazim-duzeni.test.mjs (client/assets/*.js tarar).
13. e-Belge kapalıyken (edoc() false, 28) hiçbir e-Belge düğmesi/sekme görünmez.
14. Esc önce öneri listesini kapatır (1858–1861; çekirdek hof-core.js Esc → `data-esc-back`).

##### 3. Testler (bu alan)

CI'de (ci.yml:94–121, kapı listesi ci.yml:159): senaryo-entegrator-240, senaryo-ebelge-242, senaryo-ebelge-243, senaryo-form-izolasyon-243, senaryo-fatura-243,
fatura-243-daha-fazla-yaris, fatura-243-duzen-kaymasi, gg243-* (odak-dugme, kopyala, odak-kalem-sil, tumunu-gonder, odak-silme-diger, banka-kart-aciklama, dar2-ekran,
arka-plan-yazma), uiux-a-243, uiux-b-243. CI'de OLMAYAN (ders 8 → elle koşulur): senaryo-210…218 (fatura: 215, 216, 217), esc-kapat, qa/qa-fatura.
Yeni e2e eklenirse ci.yml'e iki yere yazılır: adım (`node tools/kanit.mjs kos e2e-<ad> npm run test:<ad>`) VE kapının `--beklenen` listesi (ci.yml:159); package.json betiği.
Birim (sunucu) gönderim testleri: gg243-gonderim, gg243-dar-kontrol-gonderim (D2 "all"/"ids" eşzamanlı, 311–340), gg243-dar2-gonderim, ebelge-243-gonderim; esmm-gizli-241.test.mjs.
Kaynak tarayan: form-izolasyon.test.mjs:224–227 (dosya seçimi işleyicisi), ebelge-240-bitis-turu.test.mjs:416 (Görünüm metni).

---

##### 4. 2.4.4 maddeleri — dokunma noktaları ve öneri

###### E5 — Entegratör Ayarları: kullanıcı adında URL uyarısı + kırpma + "kayıtlı parola" netliği
- Alanlar: kullanıcı adı `[data-i="username"]` (3156), parola `[data-i="password"]` + `[data-integ-eye]` "Göster" + yardım `<small>` (3157), Kaydet (3284–3303),
  taslak toplama `collect`/`payload` (3220–3257), durum satırı `integratorStatus` (3102–3108), Göster işleyicisi (3271–3276) → `HOF.toggleSecret` (hof-core.js:1261–1272).
- KODDAN: kırpma kullanıcı adı için ZATEN sunucuda: `limited()` → `text()` = `value.trim()` (server/lib/http.mjs:192–198; invoices.mjs:311). Parola kırpılmaz (invoices.mjs:313).
  "kayıtlı parola ekranda gösterilmez. Değiştirmek için yenisini yazın." metni ZATEN var (3157). Gerçek boşluk: (a) URL yazılan kullanıcı adı kabul ediliyor;
  (b) alan boşken Göster'e basınca hiçbir şey olmuyor (kullanıcı "parola yok" sanıyor); (c) URL'yi ZATEN kaydetmiş kurulumda (kullanıcının kendi kurulumu, 19.10) hiç uyarı yok.
- Öneri (en küçük güvenli):
  1. Sunucu (tek kaynak): invoices.mjs:311 sonrasına `if (/^https?:\/\/|\.svc\b|\/\//i.test(username)) fail400("Web Servis Kullanıcı Adı alanına servis adresi yazılmış; buraya EDM'nin verdiği kullanıcı adını yazın (adres Servis Adresi alanına).", "integrator.username", { code: "integrator-username-url" })`.
  2. İstemci: Kaydet'te (3284) `collect()` sonrası aynı denetim → `[data-form-error]`a ileti + odak kullanıcı adına, istek GİTMEZ (ağa gitmeden uyarı).
  3. `integratorStatus` (3102): kayıtlı kullanıcı adı URL gibiyse durum "Kullanıcı adı alanında servis adresi var; düzeltin" (eski veriye uyarı).
  4. Göster (3271): `!input.value && integ.hasPassword` ise geçiş yapma; yardım satırını vurgula/aria-live ile "Kayıtlı parola güvenlik için gösterilmez; Göster yalnız şimdi yazdığınızı gösterir."
- Testler: birim (yeni, sunucu) — URL'li kullanıcı adı 400 `integrator-username-url`, "  edm  " → "edm" kaydı; eski kodda kırmızı (ders 7). e2e senaryo-entegrator-240'a adım:
  kullanıcı adına `https://test.edmbilisim.com.tr/...svc` yaz → Kaydet → istek yok (route sayacı), ileti + odak; kayıttan sonra boş alanda Göster → not görünür, tip değişmez.
  Var olan adım 2 (yazılmış parola Göster) DEĞİŞMEZ (113–133).
- Riskler: istemci ve sunucu metni iki yerde → ileti sunucudan gelsin, istemci ön-denetimi aynı metni kullanmazsa ayrışır; kaydet hatası bugün iki yerde görünür
  (`error.textContent` + `HOF.toastError`, 3297–3298; UI2'nin fatura formu dışındaki kopyası). Parolayı kırpmak YAPILMAZ (boşluklu parola meşru) — yalnız uyarı (açık soru).

###### E6 — Gönderilecekler seçim çubuğuna "Seçilenleri Gönder"
- Yer: seçim çubuğu (306) — bugün PDF/Excel/XML (ZIP)/Kaydet/İptal/Sil/Temizle; gönder YOK (müşteri ekranı). Seçim `view.selected` (onCheck 427–440, `selectedBy` 316).
  Tümünü Gönder istemci döngüsü `sendPending` (2774–2856): onay (2778) → `view.sendProgress` (2791) → tur `for` (2794–2813): `POST send-pending { all, after }`,
  `timeoutMs` (2795, test kancası `HOF.invoices.sendPendingTimeoutMs`), sonuçların tekilleştirilmesi `seen` (2805–2809), ilerleme (2810–2811), durma `stopped|!remaining|!moved` (2812);
  hata/zaman aşımı (2814–2821); özet ileti (2823–2855: failed/stopped/done/busy/withdrawn/held/rerun/remaining).
- Satırın Gönderilecekler'de olduğu istemcide bilinir: `doc.status === "issued" && (doc.eStatus === "waiting" || doc.eUnsent)` (sunucu satırı invoices.mjs:698–704; `unsentSql` 1196–1204).
- KODDAN: sunucu seçili kimlikle gönderimi ZATEN destekliyor (`{ ids }`, invoices.mjs:3693–3716): aynı seride seçilmemiş daha eski numarasız bekleyen varsa yenisini
  numaralandırmaz, `skipped/reason:"outside"` döner (3767–3771) — AMA bunu gönderimden SONRA söyler, parça/süre bütçesi yok (SEND_TURN 200, imleç yok; 3624–3626).
- Öneri: (1) Sunucu: "Tümünü Gönder ile aynı yol" = `{ all: true, only: [ids], after }` (aynı imleçli, 20'lik/10 sn'lik döngü; `outside` denetimi bu kipte de) + kuru denetim
  `{ only: [ids], check: true }` → `{ older: [{ series, count, oldest: { issueDate, accountName } }] }` (gönderim YOK, numara YOK; `unnumberedSeries`/`sendOrder`/
  `sendBlockOf`/`buyerBlockOf` aynı fonksiyonlarla). (2) İstemci: `selectedPending()`; düğme `Seçilenleri Gönder (N)` (edoc && canManage && N>0); basınca önce kuru denetim;
  `older` varsa `HOF.confirm` "Aynı seride daha eski tarihli N belge Gönderilecekler'de (en eskisi: <cari>, <tarih>); önce onlar gönderilmeli. Onları da ekleyip gönderelim mi?"
  → "Onları da Ekle ve Gönder" / "Vazgeç" (sessiz atlama yok). (3) Döngü ve özet `sendPending`'den ortak işleve ayrılır (tek kod: `runSend({ only })`); ilerleme aynı `view.sendProgress`
  (iki düğme birbirini kilitler). (4) Bittiğinde gönderilemeyenler seçili kalır (bulkOutcome kuralı, 2749).
- Testler: birim (sunucu): kuru denetim numara/EDM çağrısı üretmez; seçili + daha eski seçilmemiş → `older` dolu; `only` turu 20'lik parçalarla, numara sırası = tarih sırası; eşzamanlı ikinci oturum
  (E3'ün belirlenimci yarış yardımcısıyla). Eski kodda kırmızı (ders 7) + dar kontrol (ders 32, para-numara çekirdeği). e2e yeni `gg244-secilenleri-gonder` (gg243-tumunu-gonder.mjs şablon:
  sahte EDM, `SEND_MS`, istek sayacı): A) 3 seçili, daha eski 2 seçilmemiş → soru çıkar, Vazgeç → EDM'ye 0 istek; Ekle → 5 gönderilir, numara=tarih sırası; B) daha eski yokken soru yok;
  C) Tümünü Gönder ile aynı anda basılamaz. CI'ye ve kapı listesine eklenir.
- Riskler: istemcinin listesi ≤200 satır (227) — denetim istemcide YAPILAMAZ (görünmeyen eski belgeler), sunucuda olmalı; kuru denetim ile gönderim arasında başka oturum eski belge
  kaydederse sunucu yine `outside/queued` ile bekletir → özet bunu söylemeli (2850–2851 mevcut); `outside` yalnız `e_status='waiting'` satırlarına bakar (3707) — numaralı-gönderilmemiş
  eski belge numara gerektirmediği için doğru (DOĞRULANMADI: e-Arşiv ↔ e-Fatura seri ayrımı iletide "aynı seride" denmeli). gg243-dar-kontrol-gonderim D2 "ids" kipi
  (311–340) bu yolun eşzamanlılık güvencesi; ön koşulu `sleep(100)` ile zamanlamaya bağlı (E3).

###### E7 — "E-Fatura Portal" düğmesi
- Yer: `.hof-plan-actions` (289–294), `<span class="hof-rep-export">…Liste - Excel</a></span>` (293) hemen sonrası. Görünme: `edoc() && canManage()` (ya da canSettings — açık soru)
  `&& meta.settings.integrator?.configured`. Ortam bilgisi istemcide VAR: `meta.settings.integrator` = `integratorSummary` (invoices.mjs:455: id, label, env, configured…).
- Adres kaynağı önerisi: sunucuda tek yer `ADAPTERS.edm.portalUrls = { test: "https://test.edmbilisim.com.tr/EFaturaUI21ea/", live: "https://portal4.edmbilisim.com.tr/EFaturaUI/" }`
  (server/lib/einvoice/adapters.mjs:21–33; `adapterInfo` meta.adapters ile zaten istemciye gidiyor, invoices.mjs:2323) → istemci `env === "live" ? live : test`.
- Ne çağrılmalı (KODDAN): başlatıcı TEK SEFERLİK bir programdır — sunucuyu bulur, `msedge --app=<url> --new-window` açar, çıkar (launcher/main.go:69–140, platform_windows.go:63–74);
  dinleyen süreç yok. Program çok kullanıcılıdır (http://<ip>:5123); sunucu Edge açarsa SUNUCU makinesinde açılır, tıklayanın değil. Bu yüzden:
  - Yol A (her istemcide çalışır, kurulum değişmez): `window.open(url, "destekofis-edm-portal", "popup=yes,left=0,top=0,width=screen.availWidth,height=screen.availHeight")`
    — kullanıcının Edge profilinde (kalıcı; "Beni Hatırla" çerezi + Edge parola kaydı) ekranı kaplayan ayrı pencere. Gerçek F11 tam ekran JS'ten zorlanamaz.
  - Yol B ("başlatıcı ayrı tam ekran KALICI profilli Edge"): kurulumda özel URL şeması (ör. `destekofis-portal:`) kaydı + başlatıcıya `-portal <url>` bayrağı →
    `msedge --app=<url> --start-fullscreen --user-data-dir=%LOCALAPPDATA%\DestekOfis\EdmPortal`; istemci `location.href = "destekofis-portal:test"`. Bedeli: Inno Setup
    değişikliği, Edge'in "bu site uygulama açmak istiyor" sorusu, yalnız başlatıcı kurulu makinede çalışır; gerçek Windows'ta iki koşu (ders 18).
  - İkisinde de iframe YOK (X-Frame-Options SAMEORIGIN), parola istemciye çıkmaz, Turnstile'a dokunulmaz.
- Testler: e2e (sahte): düğme yalnız e-Belge açık + yetki + bağlantı kuruluyken; Test ortamında `window.open` test adresiyle, canlı açık sürümde (senaryo-entegrator-240 adım 14 kurgusu)
  canlı adresle çağrılır (`page.on("popup")` ya da `window.open` taklidi; AĞA ÇIKILMAZ — popup isteği route ile kesilir). Yazım düzeni testi düğme adını tarar.
  Gerçek Windows + Edge elle kabul: ilk girişte Beni Hatırla, ikinci açılışta doğrudan sayfa (DOĞRULANMADI).
- Riskler: canlıda portal girişi = web servis kullanıcısı mı (EDM teyidi bekliyor); "Beni Hatırla" kalıcılığı DOĞRULANMADI; ad "E-Fatura Portal" (kullanıcı) ↔ GİB yazımı
  "e-Fatura Portalı" (açık soru; titleCase ikisini de geçirir).

###### UI5 — Kayıttan sonra kart eski kaydırma konumunda açılıyor
- `showDoc` (2260–2265) / `setMode` (133–140). Kaydırma kabı `modal.dialog` (`.hof-modal { overflow:auto }`, hof-ui.css:366–371); `HOF.swap` yalnız `root`un (data-invoices) scrollTop'unu
  korur (hof-core.js:133, 156, 165) — pencere kendi konumunda kalıyor.
- Öneri: `showDoc` içinde önceki mod `card` değilse ya da `view.id` değiştiyse `modal.dialog.scrollTop = 0` (arka plan yenilemesi aynı kartı yerinden oynatmasın: `loadDoc(quiet)` 2246–2251).
- Test: uiux-b'ye ya da yeni e2e'ye: uzun form (1366×768) → en alta in → Kaydet ve Gönder → kartta `dialog.scrollTop === 0` ve başlık görünür (eski kodda kırmızı).
- Risk: fatura-243-duzen-kaymasi (pencere köşesi ±1px) etkilenmez (kaydırma düzen kayması değil) — koşulup görülür.

###### UI3a — Kalem "Kod / Barkod" genişliği
- Girdi hof-invoices.js:910; CSS `.hof-inv-lines td.hof-inv-code { width: 118px }` (hof-ui.css:9856), tablo `min-width: 980px` (9851), girdi dolgusu 0 8px (9853), hücre dolgusu 8px (914–917).
  Bulgu (1366×768): clientWidth 100 < scrollWidth 113 (13 haneli EAN).
- Öneri: `td.hof-inv-code { width: 140px }` (ya da `.hof-inv-code input { padding: 0 6px; font-variant-numeric: tabular-nums }` ile 132px) + `min-width` ~1000px; "STK-2.0.26-001" (14 karakter) de sığmalı.
- Test: e2e ölçüm `scrollWidth <= clientWidth` (EAN-13 ve 14 karakterli kod), 1366 genişlikte yatay kaydırma çubuğu durumu yazılır. Risk: ad kolonu (`min-width:240px`, 9866) daralır.

###### UI9 — Kalem Birim Fiyat biçimi ("1249,9")
- `amountText` (65) = `String(value).replace(".", ",")`: ürün seçilince (1065), fiyat ipucundan (1937), Düzenle/Kopya (482), Netten Brüte (2084).
- Öneri: yalnız birim fiyat için `priceText = n => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n)` → "1.249,90".
  Okuma tarafı uyumlu: istemci `parseTl` (54–60), sunucu `parseAmount` "1.249,90"yı okur (server/lib/money.mjs:4–11; invoices.mjs:1213–1218, 1495). Miktar (`qty`) DOKUNULMAZ (parseQty ayrı).
- Test: uiux-b-243.mjs:204 zaten "20" ya da "20,00" kabul ediyor (geçer). Yeni denetim: 1249,9 fiyatlı ürün → girdi "1.249,90", kaydedilen `unit_price` 1249.9 (veri tabanı, ders 3/12);
  Tab ile ayrılıp yeniden yazınca bozulmaz. Risk: 4 ondalıklı fiyat ("0,1235") kırpılmamalı; `NUMERIC_LINE_FIELDS` süzgeci "." ve ","yi bırakır (1657, 1685–1696).

###### UI11 — Çift başlık + dışa aktarım düğme adları (fatura kısmı)
- Çift başlık: pencere `<h2>Fatura</h2>` (hof-core.js:920) + liste `<h3>${moduleName()}</h3>` (hof-invoices.js:288). Form/kart/ayarlar başlıkları farklı metin (sorun yok).
  Öneri: 288'deki `<h3>` kaldırılır, `<small>` açıklama kalır (Çek / Senet'te 2.4.3'te yapılan: hof-cheques.js:157–158). Test şablonu uiux-a-243.mjs:385–386 (görünür h2/h3 "Fatura" sayısı 1).
  e2e'lerin `.hof-plan-title h3` okumaları kart/form başlığıdır (senaryo-215/216/217, uiux-b-243.mjs:308/319) — liste h3'üne dayanan yok (18 yer tarandı).
- Düğmeler (fatura): "Liste - PDF"/"Liste - Excel" renkli `.hof-rep-out` (293; CSS hof-ui.css:8030–8055), "Seçilenleri PDF/Excel", "e-Belge XML (ZIP)" (306), kartta
  `office().outputButtons(pdfUrl, "card", "<Belge Türü> - PDF")` + Yazdır (2355; kurucu hof-plans.js:361–362), "XML İndir" (2335). Öbür modüller: Cari "Cari Listesi - PDF" (hof-accounts.js:322),
  Stok "PDF"+"Excel" (hof-stock.js:181), Taksit "Liste - PDF" (hof-plans.js:421), Çek "Liste - PDF/Excel" renkli (hof-cheques.js:161).
- ÇELİŞKİ: görev "tek ad PDF/Excel" diyor; 2.0.16 MÜŞTERİ kararı "düğme ne indirdiğini söyler" (hof-plans.js:360). Karar gerekir (açık soru). Önerim: biçim tek (ghost + simge, outputButtons),
  ad "<Ne> - PDF" kalır (ör. "Fatura Listesi - PDF", "Fatura Listesi - Excel").
- Testler: senaryo-216.mjs:232 "Alış Faturası - PDF" bekliyor ve CI'de YOK (ders 8, 28: değiştirilirse elle koşulur); senaryo-cari-243.mjs:244 "Cari Listesi - PDF" ölçüsü.

###### UX9 — e-Belge zorunlu alanları (il / vergi dairesi) faturada çıkıyor; formdan düzeltme yolu yok
- Sorunlar Toplamlar'da: `problems = partyProblems + sellerProblems + warnings` (1503, 1515). Cari değişince `applyPickedAccount` (758–768) hesap yeniler.
- Öneri: `c.partyProblems.length && HOF.can("accounts.manage")` ise listenin altına "Cariyi Düzenle" (data-act="edit-account") → `formClick`'te `HOF.accounts.editFor(form.account.id, { onSaved })`
  → `applyPickedAccount` + `mountAccountPicker` (form kapanmaz). `HOF.accounts`'ta `editFor` YOK (hof-accounts.js:1648–1663; `editAccount(account, preset, options)` 744, `options.onSaved` 897–899) → cari alanına
  küçük ekleme. "e-Belge açıksa cari formunda il zorunlu" kısmı cari formu işi (hof-accounts.js editAccount).
- Test: e2e: ili boş cari + e-Arşiv → Toplamlar'da "Cariyi Düzenle" → il yaz → kaydet → sorun kalkar, Kaydet ve Gönder geçer; DB'de carinin ili (ders 3). Risk: UX1 sürüm denetimi (cari aynı anda düzenlenirse) korunur.

###### UX10 — Fatura formlarında odak
- Senaryo ekranı `showPick` (331–350) → odak body. Form `renderForm` (627–699) yeni açılışta odak vermiyor; iade arama `[data-return-q]` (829). "+ Yeni Cari" kaydı (749–754) → seçici yeniden kurulur.
  Hata: `fail()` (2104–2111) yalnız ileti + scrollIntoView; "cariyi seçin" (2127), "kalem yazın" (2128), sunucu hatası `failure.data.field` (2199) kullanılmıyor.
- Öneri: showPick sonunda `.hof-inv-scenario.is-default` yoksa ilk kart; startForm'dan gelen ilk çizimde (bayrak) `!ret && !form.account` → seçicinin `[data-acc-query]`, ret && !original → `[data-return-q]`,
  cari dolu → `[data-l="0"][data-f="code"]`; yeni cari kaydında → ilk kalem adı; fail(message, target) ile alan odağı; sunucu `field` (issueDate, number, unitPrice, qty …) → `[data-f=field]`
  (kalem alanlarında sunucu satır sırasını `extra`'ya koymuyor — invoices.mjs:1495–1496 ileti "N. kalem" metninde; satır için sunucuya `line: index` eklemek gerekir).
- Riskler: seçici `focus`'ta aramayı açar (hof-accounts.js: `input.addEventListener("focus", search)`) → açılışta öneri listesi görünür; e2e'ler odağı varsayıp yazıyorsa etkilenir
  (gg243-odak-* ve uiux-b "focused" denetimleri koşulur). renderForm başka yerlerden de çağrılır (change-original 2051–2057, attachOriginal 614) → odak yalnız bayrakla.

###### UX15 (istemci) — Geriye tarihli belgede numara/tarih sırası çakışması onaydan SONRA çıkıyor
- Kural sunucuda `assertChronology` (invoices.mjs:1678–1681; e-Belge sonradan numara 794, 1884). `/calc` bunu ne `warnings` ne `blockers`a koyuyor (2487–2496); istemci `renderTotals`
  `c.blockers`'ı HİÇ çizmiyor (1503) — blockers yalnız Kaydet'te (2154).
- Öneri: sunucu calc'a atmayan eş fonksiyon (`chronologyProblem`) aynı sorguyla → `blockers` (+ görünmesi için `warnings`); istemci `renderTotals` blockers'ı da (problems'ta olmayanları) çizer.
  Numara kuralı DEĞİŞMEZ (yalnız ön gösterim) — aynı fonksiyon kullanılmazsa kâhin ayrışır.
- Test: birim calc: seride son belgeden eski tarih → blockers'ta; e2e: tarih geri alınınca formda ileti, Kaydet onayı açılmaz (eski kodda kırmızı).

###### UX16 — Faturadan "+ Yeni Cari" yazılan adı taşımıyor
- hof-invoices.js:744–754 `HOF.accounts.newFor({ type }, { onSaved })` — `name` yok. Genel seçici taşıyor (hof-accounts.js:516–518 `preset.name = input.value.trim()`).
- Öneri: tıklamada `picker.querySelector("[data-acc-query]")?.value.trim()`; `!form.account` (seçili cari yoksa) `name` olarak ver. Test: e2e "Yeni Müşteri A" yaz → + Yeni Cari → ad dolu gelir.

###### UX17 — Ödenmiş faturanın başlığında "Tahsil Edilecek"
- hof-invoices.js:2342 (`.hof-chq-amount`): iptal → "Belge Tutarı (İptal Edildi)", iade → "İade Tutarı", yoksa "Tahsil Edilecek"/"Ödenecek" + `doc.payableTotal` (durumdan bağımsız).
- Öneri: `doc.status === "issued" && !(doc.open > 0.004)` → "Belge Tutarı" (ödeme durumu rozetle zaten görünür, 250); açıkken etiket kalır, altına `<small>Kalan …</small>`. Taslakta "Tutar (Taslak)".
  Toplamlar'daki "Tahsil Edilecek" (2321) tevkifat/stopaj sonrası mali terimdir, DOKUNULMAZ.
- Test: senaryo-entegrator-240.mjs:385–388 iptal etiketini okur (değişmez); yeni: tam ödenmiş kartta "Tahsil Edilecek" yok.

###### UX18 — Fatura "Tahsilat Ekle" yolları ↔ cari "+ Tahsilat"
- Fatura: `payForm` (2427–2465) `HOF.methodField("cash", { incoming })` (hof-core.js:288) → Nakit/Havale/POS; gövde `invoiceId: doc.id` ile cari hareketi (2458–2459).
- Cari: "Çek / Senet (portföye alınır)" seçeneği (hof-accounts.js:939) → `HOF.cheques.newFor({ direction, account, amount })` (982–986; hof-cheques.js:654) — evrak faturaya BAĞLANMAZ.
- Öneri A (küçük): fatura formuna aynı seçenek + aynı devir; yardım metni "evrak carinin en eski açık faturasından kapanır" (dürüst; "bu faturaya bağlı" sözü çekte geçerli değil).
  Öneri B: evrakı bu faturayı kapatacak şekilde bağlamak → cheques/invoice-settle sunucu değişikliği (para çekirdeği, dar kontrol). `cheques.invoice_id` bugün "fatura ile birlikte kaydedildi"
  anlamında ve çekirdeği kilitliyor (routes/cheques.mjs:124, 135, 485, 630) — yeniden kullanılamaz.
- Test: e2e: faturadan Çek/Senet seçilir → evrak formu tutar dolu açılır; kayıttan sonra faturanın açığı (FIFO kuralına göre) DB'den okunur.

###### UX20 — Ağ hatasında aynı anda başarı + hata bildirimi; "Satış Faturası Gönderilecek kaydedildi."
- hof-invoices.js:2183–2192: önce başarı bildirimi `${kindLabel} ${saved.displayNo} kaydedildi.` — numarasız bekleyende `displayNo = "Gönderilecek"` (invoices.mjs:508) — sonra `autoSend` bildirimi.
- Öneri: `saved.autoSend && !saved.autoSend.ok` ise tek bildirim (kaydedildi + neden + nerede beklediği; tür info/error, süre 12 sn); numara yalnız `saved.number` varsa. Komşu: `docTitle` (257) kart
  başlığında da "Satış Faturası Gönderilecek" yazar (aynı kök).
- Test: senaryo-fatura-243 adım 7 (H1, EDM'ye ulaşılamaz) bildirim sayısı = 1, metinde "Gönderilecek kaydedildi" yok; senaryo-ebelge-242 adım 4 (bildirim düğmeleri örtmesin) koşulur.

###### UX25 — "Belge Türü" süzgecinde kapalı e-SMM
- İstemci 302 `Object.entries(meta.profiles)`; sunucu meta `profiles: PROFILES` (invoices.mjs:2310; PROFILES 52–58, ESMM dahil, esmmEnabled'dan bağımsız).
- Öneri (tek kaynak): meta'da `ESMM` yalnız `esmmEnabled` iken. E1 2.4.4'te e-SMM'yi açarsa seçenek meşrulaşır; madde yalnız "kapalıyken gizle" olur.
- Test: birim meta (esmmEnabled false → ESMM yok; true → var) + e2e süzgeç seçenekleri (ders 11: her seçenek açılır, toplam = satırlar).

###### UX27 — Pasif "Düzenle" dolu/vurgulu görünüyor
- Kart 2357: "Düzenle" `hof-button hof-button-small` (dolu) + `disabled`; "Sil" `hof-button-danger-ghost`. CSS `.hof-button:disabled { opacity:.6 }` (hof-ui.css:311–314),
  `.hof-chq-actions .hof-button[disabled] { opacity:.5 }` (10402–10405).
- Öneri (yalnız CSS): `.hof-chq-actions .hof-button:not(.hof-button-ghost):not(.hof-button-danger-ghost)[disabled] { background: var(--do-surface-soft); color: var(--do-faint); border-color: var(--do-border); box-shadow:none }`.
  `.hof-chq-actions` çek ve banka kartlarında da var (hof-cheques.js, hof-bank.js) — bilinçli genel kural ya da `.hof-invoices` ile sınırlanır.
- Test: e2e hesaplanan arka plan rengi pasif Düzenle ≈ pasif Sil tonu; nedeni `blocksHtml` (2270–2280) görünür kalır. `[data-act="modify"]:not([disabled])` seçicileri etkilenmez (banka-210-kart-onbellek-yaris.mjs:209, senaryo-216.mjs:284).

###### E1 (istemci) — e-SMM'nin istemcide gizli/eksik parçaları
- Görünür olacaklar (sunucu `esmmAvailable` açınca kendiliğinden): "e-SMM kullanıcısıyım" (3174), "e-SMM Serisi" + test serisi (3205), Fatura Ayarları seri satırı (`nextNumbers` sunucu süzgeci invoices.mjs:1667).
- Kendiliğinden OLMAYACAKLAR:
  1. `INVOICE_KINDS.smm.send = false` (server/lib/invoice-math.mjs:40) → istemcide SMM formunda "Kaydet ve Gönder"/"Kaydet, Sonra Gönder" hiç çıkmaz (`sendable` 2097, `formActions` 2096),
     Gönderilecekler'e girmez (`unsentSql` sendKinds invoices.mjs:1197), kartta `canSend/canDraft/canRefresh/canOfficial` kapalı (992–1000). e-SMM için sunucuda `send` e-SMM'ye göre açılmalı; istemci bu bayrağı izler.
     esmm-gizli-241.test.mjs:57–74 bugünkü "açık bayrak" davranışını (kayıtta TES numarası, gönderim yok) koruyor → beklenti BİLEREK değişir (ders 28).
  2. `cancelForm` (2537–2565): e-Arşiv için "önce entegratörde (EDM) iptal" metni/koşulu var (2541, 2545), ESMM dalı YOK.
  3. `renderProfile` notu (1653) yalnız e-Arşiv/e-Fatura; ESMM notu yok.
  4. Test serisi notu e-SMM gizliyken de "TEF, TEA, TES" yazıyor (3167, 3206; sunucu `testSeries: TEST_SERIES` süzgeçsiz invoices.mjs:2339, 2353); senaryo-entegrator-240.mjs:333 bunu bekliyor.
  5. UX25 süzgeç seçeneği (yukarıda). 6. Entegratör Ayarları'nda tek "Servis Adresi" (3160) EFaturaEDM.svc içindir; e-SMM ayrı servis (ESmmEDM.svc) — adres türetme/ayrı alan sunucu kararı (DOĞRULANMADI).
- Testler: e-SMM açık kurulumda e2e: SMM formu → Kaydet ve Gönder → sahte e-SMM servisi; iptal penceresi ESMM metni; süzgeç ve seri ekranı.

###### KÖ3 — "Başlarken" (yalnız fatura tarafındaki bağlantılar)
- Ana ekran işi (bu alanın dışı). Fatura verisi hazır: `meta.settings.sellerReady` (invoices.mjs:2326; istemcide HİÇ kullanılmıyor), `/settings` → `problems.KAGIT` (2339), `bankAccounts.active`.
  Kontrol listesi bu alanları okuyup "Fatura Ayarları"nı (`HOF.invoices.open` + settings) açabilir; yeni uç gerekmez.

---

##### 5. Sürprizler / kör noktalar
1. Görev metnindeki "UI9 Anlık Durum" ve "UI11 Çek çift başlık" 2.4.3 A paketinde YAPILDI (hof-overview.js:25–30; hof-cheques.js:157–158; uiux-a-243.mjs:385–386). Kalan yalnız fatura kısımları.
2. UI11 "tek ad PDF" ↔ 2.0.16 müşteri kararı "düğme ne indirdiğini söyler" (hof-plans.js:360) çelişiyor.
3. senaryo-216.mjs:232 "Alış Faturası - PDF" bekliyor; senaryo-210…218 CI'de YOK (ci.yml) → düğme adı değişirse sessizce kırılır (ders 8).
4. E5: kullanıcı adı kırpma zaten sunucuda (http.mjs:192–198), "kayıtlı parola gösterilmez" metni zaten 3157'de; asıl boşluk boş alanda Göster'in sessizliği ve URL'yi zaten kaydetmiş kurulum.
5. E6: sunucunun `{ ids }` yolu "daha eski seçilmemiş" kuralını zaten uyguluyor ama SONRADAN söylüyor ve parçalamıyor (invoices.mjs:3624–3626, 3702–3716).
6. SMM `send:false` (invoice-math.mjs:40): esmmEnabled açılsa da makbuz kayıtta numaralanır, gönderilemez — E1 tür anlamını değiştirmeli.
7. e-SMM gizliyken test serisi notu "TES" sızdırıyor ve bir e2e bunu bekliyor (3167/3206; senaryo-entegrator-240.mjs:333).
8. cancelForm'da ESMM dalı yok (2537–2565).
9. Numarasız bekleyende `displayNo` "Gönderilecek" (invoices.mjs:508) → başarı bildirimi ve kart başlığı durum adını numara gibi yazıyor (2184, 257).
10. Birim testler istemci döngüsünü kopyalıyor ve kopya eski: `!result.data.sent` (gg243-dar-kontrol-gonderim.test.mjs:80) ↔ istemci `!moved` (2812).
11. Başlatıcı tek seferlik, çok makineli kurulumda sunucu tarafı Edge açamaz → "başlatıcı açar" kurulum değişikliği + URL şeması ister.
12. Cari'nin Çek/Senet tahsilatı faturaya bağlanmaz; faturaya eklenirse "bu faturaya bağlı kapatılır" sözü yanlış olur.
13. renderTotals `c.blockers`'ı çizmiyor; returnProblems/mixProblems ancak Kaydet'te görünür (1503 ↔ invoices.mjs:1834).
14. Fatura formunda sunucunun `data.field`'ı odak için kullanılmıyor; kalem hatalarında satır sırası `extra`da yok.
15. `is-form` sınıfının CSS'i yok (yalnız test işareti).
16. Entegratör kaydet hatası iki yerde (form satırı + bildirim, 3297–3298) — UI2 kuralının bu penceredeki karşılığı yok.

##### 6. Açık sorular
1. UI11: ad standardı "PDF"/"Excel" mi, "<Ne> - PDF" mi (2.0.16 kararı)? Biçim: renkli `.hof-rep-out` mı, ghost + simge + Yazdır mı?
2. E7 adı: "E-Fatura Portal" (kullanıcının sözü) mi, "e-Fatura Portalı" mı? Kim görür: invoices.manage / invoices.settings? Yalnız bağlantı kuruluyken mi?
3. E7 yolu: A (window.open, kullanıcının Edge profili, her makinede) mı, B (URL şeması + başlatıcı, ayrı kalıcı profil, gerçek tam ekran) mı?
4. E6: düğme yalnız Gönderilecekler sekmesinde mi, her sekmede seçili bekleyen varsa mı? Sunucuda `{ all, only, after }` + `{ check }` eklemesi onaylı mı (para-numara çekirdeği → dar kontrol)?
5. UX18: A (çek formuna devir, FIFO, dürüst metin) mi, B (evrakı faturaya bağlayan sunucu değişikliği) mi?
6. E5: parolada baş/son boşluk — yalnız uyarı mı (önerim), kırpma mı?
7. UX17 etiketi: "Belge Tutarı" + "Kalan" uygun mu?
8. UX25 E1'e bağlı: e-SMM 2.4.4'te açılıyorsa seçenek kalır; yalnız kapalı kurulumda gizlenir — doğru mu?

### EK-3 fatura-para

#### Hakimiyet haritası — Fatura para çekirdeği (e-Belge dışı) · 2.4.4 hazırlığı

Hazırlayan: alt ajan (salt okuma, 21.10.2026). Her iddia koddan okundu; çalıştırılmadı (npm/test/ağ yok). Emin olunmayan yer **DOĞRULANMADI**.
Kapsam: `server/routes/invoices.mjs` (e-Belge dışı), `server/lib/invoice-math.mjs`, `invoice-settle.mjs`, `invoice-pdf.mjs`, `general-ledger.mjs`
(fatura/SMM/stopaj/KDV), `integrity-scope.mjs` fatura kısmı, `server/routes/tax.mjs`, bağımsız kâhinler (`test/bagimsiz/**`, `test/mutabakat/fatura-model.mjs`).
Maddeler: E1'in para kısmı, UX17, UX18, UI9 (fatura), UI3a (PDF tarafı).

---

##### 1. Mimari (kısa)

1. **Saf hesap motoru** `server/lib/invoice-math.mjs`: kuruş tamsayısı, kalem bazında yuvarlama, yarım kuruş sıfırdan uzağa (`mulDiv`, :156).
   `computeLine` (:185) → matrah/KDV/tevkifat; `computeInvoice` (:246) → belge toplamları; **stopaj BELGE düzeyinde tek yuvarlama**
   (`stoppageTotal = mulDiv(net, round(oran×100), 10000)`, :278); `payable = Σ kalem.payable − stopaj` (:293); `payable ≤ 0` reddedilir (:300).
   `toTry` (:309) matrahı hesap bazında, KDV/tevkifat/stopajı ayrı çevirir, ödenecek bunlardan türetilir. `grossFromNet` (:327) brüt = net ÷ (1 − stopaj)
   (KDV hariç "net ücret"ten). `typeCode` (:337) IADE/TEVKIFAT/ISTISNA/SATIS. `lineAccount` (:90): satış ve SMM → 600.
2. **Belge türleri** `INVOICE_KINDS` (:34–41): `smm` = { party: "debt", stock: "", own: true, **send: false**, side: "sale" } (:40). `send:false`
   bütün e-Belge gönderim kapılarını kapatır (aşağıda E1).
3. **Rota** `server/routes/invoices.mjs` → `registerInvoiceRoutes` (:130). Girdi: `documentInput` (:1346) → `linesInput` (:1443) → `computeInvoice` + `toTry`
   (:1397–1403); ödeme `paymentInput` (:1540); yazım `writeIssued` (:1838; tek `bank.post` işlemi: fatura + kalemler + stok + cari + peşin + çek/senet
   + taksit kartı, :1861–2045); düzenleme `editInvoice` (:766; eski etkiler `reverseEffects` :2140 ile geri alınıp yeniden yazılır); iptal `cancel` (:2165).
4. **Kapama** `server/lib/invoice-settle.mjs` `settleInvoices` (:128): yöne göre rol (`classifyLine` :65), adımlar R (iade geri ödemesi) → 0 (mahsup)
   → 1 (bağlı ödemeler) → 1b (Mevcut Borç kartı) → 2 (FIFO en eski) (:290–362); iade belgesi açığı (:404–448); durum etiketleri `PAY_STATES` (:47).
   Rota tarafı: tek cari `paymentStates` (:602), toplu `allPaymentStates` (:539, önbellek anahtarı total_changes|data_version|gün).
   Bağlar (`links`): `account_entries.source='invoice'` peşin satırları, `account_entries.invoice_id` ("Kapatılacak Fatura"; taksitli faturaya bağ yok
   sayılır :567/:629), **`cheque_events.invoice_id`** (olayın etkilerindeki cari satırları faturaya bağlanır :573–592, :632–639).
5. **Ana Defter** `server/lib/general-ledger.mjs` `journal` (:157); fatura maddesi (:304–346):
   - satış / SMM: **B 120 ödenecek · B 193 stopaj / A 600 matrah · A 391 (KDV − tevkifat)** (:319–325)
   - satıştan iade: B 610 · B 391 (KDV − tevkifat) / A 120 (:326–331)
   - alış: B 153/770/… · B 191 KDV / A 360 (tevkifat + stopaj) · A 320 (:332–338); alıştan iade ters (:339–345).
   Faturanın cari borç satırı (source 'invoice', debt/credit) yevmiyeye ayrıca girmez (:231–232).
6. **Kapı** `server/lib/integrity-scope.mjs`: fatura bölümü (:598–617) 191/391/360/193 = faturalardan SQL toplamı; `invoiceChecks` (:708–776):
   başlık = kalemler (`hpayable = lpayable − hstoppage`), `invoice:try` (payable = net + vat − withheld − stoppage; gl_json toplamı = net), cari bağı,
   yetim satır, Kapatılacak Fatura bağı/mahsup, stok, `cheques.invoice_id` (yalnız evrak tablosundaki kolon; `cheque_events.invoice_id` DENETLENMEZ), taksit, iade ≤ satış.
7. **Vergi** `server/routes/tax.mjs`: `balances` (:57) 360 bakiyesi yalnız ALIŞ tarafı tevkifat/stopaj; KDV mahsubu (:157+) ayın 391/191'ini Ana Defter'den okur
   (SMM'nin 391'i otomatik girer). **193 (SMM'de müşterinin kestiği stopaj) hiçbir işlemle kapanmaz** (yıllık beyanname mahsubu yok — BİLİNEN SINIR).
8. **PDF** `server/lib/invoice-pdf.mjs` `drawInvoice` (:51): kolonlar (:69–79), Stok Kodu genişliği ölçülerek 62–120 pt (:65–68, 2.4.3 UI3b), toplamlar (:225–236),
   SMM başlığı "e-SERBEST MESLEK MAKBUZU" / "MÜŞTERİ FİŞİ (SERBEST MESLEK)" (:30–38).

##### 2. Değişmezler (koddan)

- D1 Kuruş: `payable = net + vat − withheld − stoppage` hem belge para biriminde (invoice-math :293) hem TL'de (toTry :324); kapı `invoice:try` (integrity-scope :724).
- D2 Başlık = kalemler: Σ kalem net/KDV/tevkifat = başlık; Σ kalem payable − stopaj = başlık payable (integrity-scope :711–715). **Kalemde stopaj kolonu YOK**
  (invoice_lines INSERT :1997–2002 — stopaj yalnız başlıkta).
- D3 Yevmiye denge: SMM B (payable + stopaj) = A (net + vat − withheld) (general-ledger :319–325).
- D4 Cari: faturanın tek borç/alacak satırı = try_payable (integrity-scope :727–737).
- D5 Kapama: Σ açık = cari bakiyesi kuralı yöne göre; taksitli fatura yalnız bağlı ödemeyle kapanır; iade K1 formülü (invoice-settle :33–40).
- D6 Numara: kendi serisinde sıra-tarih (assertChronology :1678; düzenlemede :785–802).
- D7 Peşin ≤ ödenecek (paymentInput :1606–1607).

##### 3. Testler / kâhinler (alan)

| Ne | Dosya | Nerede koşar |
|---|---|---|
| invoice-math ↔ bağımsız tamsayı modeli, 30.000 fatura (stopaj 10/20 dahil) | `test/fatura-model.test.mjs` ↔ `test/mutabakat/fatura-model.mjs` | `npm test` (CI 4 platform). **Model aynı elden** (ders 5: tek başına kâhin sayılmaz) |
| Mutabakat motoru (SMM %15 olasılıkla, stopaj 0/20; `motor.mjs:1494–1502`) | `test/mutabakat/motor.mjs` | Uzun Doğrulama `mutabakat` (5.000 × 10 tohum + uzun 10.000) |
| Defter kâhini (temiz oda, TDHP) — alış stopajı 360 var, **SMM/193 YOK** | `test/bagimsiz/defter/kahin.py`, `kos.mjs`, `senaryo.json` | YALNIZ elle (`npm run test:kahin-defter`); CI'de ve Uzun Doğrulama'da **YOK** |
| Genel kâhin dili (fatura satış/alış, iade, kapama) — SMM, stopaj, tevkifat **YOK** | `test/bagimsiz/SENARYO-DILI.md` §4.13, §7 | elle |
| e-Belge kâhini (numara/gönderim durum makinesi; seriler TEF/TEA/FIS — **TES yok**, tutar yok) | `test/bagimsiz/ebelge/*` (KARARLAR.md K4) | Uzun Doğrulama `kahin_ebelge` (`uzun-dogrulama.yml:123–150`) |
| e-SMM gizli | `test/esmm-gizli-241.test.mjs` | `npm test` |
| PDF stok kodu (UI3b) | `test/uiux-a-243.test.mjs:111` | `npm test` |
| GİB şematron / XSD (e-Fatura paketi) — **e-SMM kuralı yok** | `test/ebelge-uygunluk.test.mjs`, `tools/ebelge/sema/gib/*` | `npm test` |
| Kapama | `test/iade-kapama-k1.test.mjs`, `test/kapama-rastgele-223.test.mjs`, `test/bulgu-223.test.mjs`, `test/fatura-217.test.mjs` | `npm test` |

---

##### 4. E1 — e-SMM'nin PARA kısmı

###### 4.1 Programda SMM bugün nasıl hesaplanıyor
- Tür: `scenario: "smm"` → `kind: "smm"` (invoice-math :63). Kalem stoklu olamaz (invoices.mjs :1490). Tevkifat kodu SMM kaleminde **serbest** (engel yok, linesInput :1499–1516).
  KDV dahil fiyat ve iskonto SMM'de **serbest** (documentInput :1381–1382).
- Stopaj oranı (documentInput :1389–1394): gövdede verilmişse o (0–40); yoksa alıcı `partyKind !== "person"` VE vergi no TCKN değilse ayar (varsayılan %20), değilse 0.
- Hesap: brüt ücret = `totals.net` (iskonto sonrası, KDV hariç); KDV = Σ kalem KDV (kalem bazında yuvarlı); tevkifat = Σ kalem; **stopaj = belge toplamından tek yuvarlama**;
  `payable` = brüt − stopaj + KDV − tevkifat.
- Yevmiye: B 120 payable · B 193 stopaj / A 600 brüt · A 391 (KDV − tevkifat).
- PDF toplam satırları (invoice-pdf :225–236): "Mal / Hizmet Toplamı", "Matrah (KDV Hariç)", "KDV %…", "Vergiler Dahil Toplam", "KDV Tevkifatı", "Gelir Vergisi Stopajı %…", "Ödenecek Tutar".

###### 4.2 GİB e-SMM dip toplamları ↔ program alanları (EDM örnekleri, `/root/.claude/uploads/456ebc12-…/`)
`Ek_bilgi.txt` + `esmm-ubl-ornek-veri.xml`:

| UBL (LegalMonetaryTotal) | GİB/EDM anlamı | Program karşılığı | Not |
|---|---|---|---|
| LineExtensionAmount | Brüt Ücret | `netTotal` (KDV hariç, iskonto sonrası) | örnek 234,69 |
| TaxExclusiveAmount | **Net Ücret** (brüt − stopaj) | `netTotal − stoppageTotal` | e-Faturada bu alan matrahtır — ANLAM FARKLI |
| TaxInclusiveAmount | **Tahsil Edilen KDV** | `vatTotal − withheldTotal` (tevkifatsızda `vatTotal`) | tevkifatlı durumda hangisi: **DOĞRULANMADI** |
| AllowanceTotalAmount | iskonto | 0 / `discountTotal` | iskontolu e-SMM'de brütün anlamı **DOĞRULANMADI** |
| PayableAmount | Toplam Net Alınan | `payableTotal` | örnek 230 (187,75 + 42,24 = 229,99 — EDM örneği 1 kuruş tutarsız; hedef netten geri hesaplanmış, KDV %18) |
| TaxTotal/TaxAmount | yalnız KDV | `vatTotal` | stopaj TaxTotal toplamına GİRMİYOR (örnekte 42,24) |
| TaxSubtotal 0003 (STPJ) | stopaj, Percent = oran | `stoppageTotal`, `stoppageRate` | örnekte TaxableAmount 0 — **DOĞRULANMADI** (brüt mü 0 mı) |
| TaxSubtotal 0015 | KDV | kalem/oran bazında KDV | |
| InvoiceLine InvoicedQuantity / PriceAmount | örnekte "Net Ücret" / "Net Tahsilat" (garip) | — | e-Faturadaki miktar×fiyat anlamı yok — **DOĞRULANMADI** |

NESNE yolu (`EDM_E-SMM_Web_API_v4.4.1.docx` §4.3 SMM_LINE_ITEMS; Request-Response örneği): `GROSS_AMOUNT` (brüt), `STOPPAGE_RATE`, `NET_AMOUNT` (net ücret),
`TAX_RATE`, `WITHHOLDING_TAX_CODE`/`WITHHOLDING_TAX_RATE`, `NET_REVENUE` (net tahsilat); başlıkta `TOTAL_NET_REVENUE`. Örnek: 1,00 / 20 / 0,80 / 20 / **0003** / 20 / 1,00
→ örnekte WITHHOLDING alanı **stopaj kodu 0003** taşıyor; KDV tevkifatı (6xx) bu alana mı yazılır: **DOĞRULANMADI**.

###### 4.3 Kör noktalar (para)
- **K-E1a (YÜKSEK, çok kalemli e-SMM)**: GİB/EDM satır düzeyinde stopaj taşır (UBL kalem TaxSubtotal 0003; NESNE'de satır `STOPPAGE_RATE`/`NET_AMOUNT`); program stopajı
  belge düzeyinde tek kez yuvarlar (invoice-math :278) ve kalemde saklamaz. Somut örnek: 2 kalem × 100,03 TL, %20 → satır satır 20,01 + 20,01 = **40,02**; belge düzeyi
  200,06 × 0,2 = **40,01**. EDM satırdan yeniden hesaplarsa resmî belge (40,02) ile program defteri/cari (40,01) 1 kuruş ayrışır. Seçenekler: (a) e-SMM'de tek kalem zorunlu
  (en küçük, para çekirdeğine dokunmaz); (b) UBL/NESNE'de belge stopajı kalemlere en büyük kalan yöntemiyle dağıtılır (Σ = belge) — EDM'nin satırı yeniden hesaplayıp reddedip
  reddetmediği test hesabında denenir; (c) ESMM profilinde stopaj kalem bazında hesaplanır — para çekirdeği değişir (invoice-math + fatura-model.mjs + kapı formülü + kâhin), kırmızı test
  + mutasyon + dar kontrol (ders 32). Öneri: önce (a)/(b) test hesabında; (c) yalnız EDM satırdan hesaplıyorsa.
- **K-E1b (ORTA, istemci)**: "Netten Brüte" (client/assets/hof-invoices.js:2072–2090) stopaj kutusu boşken (`otomatik`) **ayar oranını** (%20) kullanır
  (`form.stoppageRate === "" ? meta.settings.defaults.stoppageRate`, :2081); sunucu kişi alıcıda 0 uygular (invoices.mjs :1393) → brüt %25 fazla yazılır, makbuz yanlış tutarla kaydedilir.
  Ayrıca "Fiyatlar KDV Dahil" işaretliyse (varsayılan ayar olabilir, :559) brüt KDV dahil fiyat sanılır → matrah = brüt ÷ 1,2. Düzeltme: son hesabın `form.calc.stoppageRate`'i
  (calc yanıtı invoices.mjs:2480) ve `pricesIncludeVat` false zorlaması / KDV ile çarpma. Kırmızı: kişi alıcıda Netten Brüte → net ücret ≠ yazılan.
- **K-E1c (DÜŞÜK, mevzuat)**: varsayılan stopaj kişi (`partyKind: person`) alıcıda 0 — VKN'li gerçek kişi tacir de GVK 94 vergi sorumlusudur; program 0 önerir (kullanıcı değiştirebilir).
  Değişiklik önerilmez; kılavuza "alıcı tacir ise oranı yazın" notu. **DOĞRULANMADI** (mali müşavir).
- **K-E1d (BİLGİ)**: `grossFromNet` (invoice-math :327) kayan noktayla böler; %20'de brüt − stopaj(brüt) = net her kuruşta tutar (×1,25 tam), başka oranlarda (ör. %17) 1 kuruş sapma
  olabilir — **DOĞRULANMADI**; özellik testi: her net ∈ [0,01; 10.000] ve oran ∈ {10, 15, 17, 20}: `computeInvoice(brüt).payable` = net + KDV.
- **K-E1e**: tevkifatlı SMM (`typeCode` → TEVKIFAT) e-SMM'de geçerli mi, InvoiceTypeCode ne olmalı: **DOĞRULANMADI** (örnek SATIS).
- **K-E1f**: 2.4.0'da ESMM profilinden numara almış eski makbuzlar (`legacyEsmm`, invoices.mjs :1374) bugünkü `buildUbl` ile e-Fatura yapısında (stopaj yalnız not,
  ubl-tr.mjs:157; TaxExclusiveAmount = matrah :216) XML üretir — e-SMM açılınca bunların gönderimi yeni ESMM kurucusundan geçmeli.

###### 4.4 E1 dokunma noktaları (para + numara kapıları; e-Belge bağdaştırıcısı ayrı haritada)
1. `server/lib/invoice-math.mjs:40` `smm.send: false` → e-SMM açılınca gönderim kapıları: `unsentNumbered` (invoices.mjs:654), `canSend`/`canRefresh`/`canDraft`/`canOfficial` (:992–1000),
   `unsentSql` (:1196–1205), `writeIssued` `later`/`deferable` (:1842, :1846; O1 bekletmesi `olderPending` :3242), `sendWouldContact` (:3258), toplu XML (:3979), istemci `meta.kinds` (:2308).
   EN KÜÇÜK GÜVENLİ: `send` bayrağını kind yerine "kind.send || (kind === 'smm' && profile === 'ESMM' && esmmEnabled)" yardımcısına bağlamak (tek fonksiyon; KAGIT SMM
   etkilenmez). `INVOICE_KINDS` sabitini değiştirmek mutabakat motorunu ve istemciyi de etkiler — tercih edilmez.
2. Seri: `seriesFor` (:1640–1646) SMM için `profile === "ESMM" ? own.esmm : s.series.smm` (test: TES, canlı: ESM). Kronoloji `assertChronology` (:1678) aynı.
3. Para alanları UBL'ye: yeni ESMM kurucusu (ubl-tr.mjs) programın `detail()` alanlarından (`netTotal`, `stoppageTotal`, `stoppageRate`, `vatTotal`, `withheldTotal`, `payableTotal`,
   `byRate`, kalem `net/vat`) — hesap YENİDEN yapılmaz (tek kaynak invoice-math).
4. PDF (yerel görüntü; resmî PDF EDM GetSMM): `invoice-pdf.mjs:225–236` SMM'de GİB adları önerisi — "Brüt Ücret", "Gelir Vergisi Stopajı %20", "Net Ücret", "KDV %20",
   "Tahsil Edilen KDV" (tevkifatta), "Net Tahsil Edilen" (yazım düzeni: her sözcük büyük). Sayılar değişmez; yalnız etiket + sıra.
5. Ekran toplamları aynı adlarla: `client/assets/hof-invoices.js:1506–1511` (form), `:2316–2322` (kart).

###### 4.5 e-SMM kâhini nasıl genişletilir (ders 5 — temiz oda, ayrı dil)
- **Defter kâhini** (`test/bagimsiz/defter/kahin.py`): yeni olay `fatura: "smm"` kuralı TDHP + GVK 94'ten (kodu görmeden): B 120 net tahsilat · B 193 stopaj / A 600 brüt · A 391 (KDV − tevkifat);
  aylık KDV özetine 391 girer. `kos.mjs:120` gövde `scenario: "smm"` + `stoppageRate`; `senaryo.json`'a 3 olay (tüzel alıcı %20, kişi 0, tevkifatlı 602). Yeni mutasyon
  (`kos.mjs:234` MUTASYONLAR): "SMM stopajı 193 yerine 360", "SMM'de stopaj ödenecekten düşülmez". **Bu kâhin bugün hiçbir CI/Uzun Doğrulama işinde yok** →
  `uzun-dogrulama.yml`'e iş ya da `npm test`'e sarmalayıcı önerilir (yoksa ders 7/8: koşulmayan kâhin kanıt değil).
- **e-SMM belge kâhini** (yeni, Python, `test/bagimsiz/esmm/`): girdi (kalemler, oran, stopaj, tevkifat) → GİB e-SMM dip toplamları (4.2 tablosu) bağımsız hesaplanır, programın
  `/api/workspace/invoices/:id/ubl.xml` çıktısı (ESMM) ile karşılaştırılır; kaynak GİB e-SMM kılavuzu/paketi (depoda YOK; `tools/ebelge/sema/KAYNAK.md` düzeninde eklenmeli —
  ağ politikası ana oturumda) + EDM belgeleri. EDM örneğinin 1 kuruş tutarsızlığı kâhine kural olarak alınmaz.
- **e-Belge kâhini** (`test/bagimsiz/ebelge/KARARLAR.md` K4): TES serisi + SMM'nin O1/kronoloji davranışı eklenir (K8/K9 e-SMM için de geçerli mi — e-SMM serisi e-Fatura/e-Arşiv'den bağımsız).
- **fatura-model.test.mjs**: çok kalemli SMM'de stopaj yuvarlama değişirse (K-E1a c) model ve test birlikte değişir; aynı elden olduğu için kâhin sayılmaz.

---

##### 5. UX17 — Ödenmiş faturada "Tahsil Edilecek"

- **Yer**: `client/assets/hof-invoices.js:2342` kart başlığı `.hof-chq-amount`: iptal → "Belge Tutarı (İptal Edildi)", satış → "Tahsil Edilecek" (iadede "İade Tutarı"),
  alış → "Ödenecek"; değer her zaman `doc.payableTotal`. Ödeme durumu `doc.open`/`doc.paid`/`doc.payStateLabel` sunucudan gelir (shape invoices.mjs:705–708; detail :921).
- **Öneri (yalnız istemci, para yolu değişmez)**: kaydedilmiş, iade olmayan belgede
  - `open ≤ 0,004` → etiket "Fatura Tutarı" (SMM'de "Makbuz Tutarı"), değer `payableTotal`, durum hapı zaten başlıkta (`statusPill`);
  - `0 < open < payable` → etiket "Kalan" değer `money(doc.open)` (TL; `open` TL'dir — `try_payable` üzerinden), altında `<small>Toplam …</small>`;
  - `open = payable` → bugünkü "Tahsil Edilecek" / "Ödenecek". Taslak: "Proforma Tutarı" (öneri; karar kullanıcıda).
  Toplamlar tablosundaki "Tahsil Edilecek" satırı (`:2321`, form `:1511`) belgenin tevkifat/stopaj sonrası ödenecek tutarıdır — ayrı kavram; PDF'te "Ödenecek Tutar" (invoice-pdf :234).
  İstenirse ekran ile PDF aynı ada çekilir (öneri, kapsam kararı kullanıcıda).
- **Testler**: yeni e2e adımı (uiux-b-243 düzeninde): peşin tam → "Fatura Tutarı"; kısmi → "Kalan ₺X"; açık → "Tahsil Edilecek"; eski kodda ilk ikisi kırmızı (ders 7).
  `test/e2e/senaryo-entegrator-240.mjs:385–388` (iptal etiketi) aynen kalmalı. Döviz faturası (fxEnabled kapalı ama eski veri) `open` TL'dir — `curMoney(…, cur)` kullanılmaz.
- **Risk**: düşük; yalnız etiket. `doc.open` yalnız `status === "issued"` iken anlamlı (detail :923 `state` null ise 0).

##### 6. UX18 — Fatura "Tahsilat Ekle"ye Çek / Senet

- **Bugün**: `payForm` (client/assets/hof-invoices.js:2427–2468) yol listesi `HOF.methodField` (hof-core.js:288) = Nakit/Havale/POS (Ödeme Yap'ta Kredi Kartı); gönderim
  `POST /api/workspace/accounts/:id/entries` `{ kind, amount, method, invoiceId }` → `account_entries.invoice_id` bağı (accounts.mjs `invoiceLink` :671–686: aynı cari, kaydedilmiş,
  **taksitsiz**, yön uyumlu). Taksitli satışta form taksit kartını açar (:2431–2434).
- **Cari "+ Tahsilat"** (`client/assets/hof-accounts.js:937–939`, :982–986): "Çek / Senet (portföye alınır / verilir)" seçilince form kapanır, `HOF.cheques.newFor({ direction, account, amount })`
  (hof-cheques.js:654) evrak formunu açar → `POST /api/workspace/cheques` (cheques.mjs:460) → `insertCheque` (:433) `invoice_id = ''` → **evrak hiçbir faturaya bağlanmaz**, kapamada
  FIFO (invoice-settle adım 2) en eski açık borcu kapatır.
- **Para yolu farkı**: faturayla kesilen çek (`writeIssued` :2019–2022 → `invoiceCheques.create`, cheques.mjs:921) `cheques.invoice_id` + olay `invoice_id` taşır: faturanın kendi
  etkisidir — fatura Düzenle/İptal'de `voidFor` (cheques.mjs:943–971) evrağı **siler ve yeniden açar**, evrakın tutar/cari/tarihi kilitlidir (:485, :630). Bu yüzden sonradan
  "Tahsilat Ekle"den alınan çek `invoiceCheques.create` ile AÇILMAMALI (fatura düzenlenince evrak kaybolur, payment_json'da olmadığı için geri gelmez).
- **Seçenek A (önerilen; para çekirdeğine dokunmaz)**: payForm yol listesine cari formuyla AYNI koşulla (`HOF.cheques?.newFor && HOF.can("cheques.manage")`) "Çek / Senet (portföye alınır)"
  / "(verilir)" eklenir; seçilince form kapanır, `HOF.cheques.newFor({ direction: sale ? "in" : "out", account: { id: doc.accountId, name: doc.accountName }, amount })`; evrak kaydı
  `cheques-changed` olayında (hof-cheques.js ~:300–311 `HOF.emit("cheques-changed")`) fatura kartı `loadDoc(doc.id)` ile yenilenir (canlı olay kişinin kendisine gelmez,
  `publish … except: user.id` invoices.mjs:162). Açıklama METNİ dürüst olmalı: syncEntryHelp sarmalayıcısı (:2449) çekte "Bu faturaya bağlı kapatılır" DEMEMELİ →
  "Evrak carinin en eski açık borcunu kapatır (bu faturaya bağlanmaz)". Sunucu, kapı, kâhin değişmez; aynı iş iki ekranda aynı (UX18'in şikâyeti).
- **Seçenek B (bağlı kapama; para çekirdeği)**: `POST /api/workspace/cheques` gövdesine `invoiceId` (yalnız kapama bağı) → doğrulama accounts `invoiceLink` ile aynı → yalnız
  `cheque_events.invoice_id` yazılır (`cheques.invoice_id` boş kalır; `insertCheque`'e ayrı parametre). Dokunulacaklar: `ownPaymentLines` (invoices.mjs:733–741) yalnız `cheques.invoice_id = fatura`
  olanları saymalı (yoksa sonradan taksitlendirme denetimi :774–781 yabancı ödemeyi görmez); fatura iptal/silmede bu bağ temizlenmeli (account_entries için :2210 gibi);
  taksitli faturada çek bağı **reddedilmeli** (çek olay bağları `planned` süzgecinden geçmiyor :591, :638); `event-copy.mjs:26` fin_events.invoice_id kopyası (Benzer İşlem anahtarı) değişir;
  kâhin dili `SENARYO-DILI.md` E3/BELİRSİZ-27 "evrakın fatura açığına etkisi planda yok" — dil genişletilmeden bağımsız doğrulama yok. Kırmızı test + mutasyon + dar kontrol (ders 32).
  Karar kullanıcıda; 2.4.4 kapsamı için A yeterli.
- **Testler (A)**: e2e: fatura kartı → + Tahsilat Ekle → yol listesinde "Çek / Senet (portföye alınır)" (eski kodda yok → kırmızı) → seçince evrak formu cari ve tutar dolu açılır →
  Portföye Al → veri tabanında evrak `account_id = cari`, `invoice_id = ''`; fatura kartı yenilenir, açık tutar FIFO kuralına göre (tek açık faturada o fatura kapanır). Yetkisiz
  (cheques.manage yok) kullanıcıda seçenek görünmez. Komşu (ders 10): `test/e2e/banka-210-ekran-aciklama-yetki.mjs:118–133` (m4 açıklama metni) ve `senaryo-216.mjs` yol listeleri koşulur.

##### 7. UI9 — Fatura para biçimi

- **Bulgu**: ürün seçilince Birim Fiyat "1249,9" (binlik ayraçsız, tek ondalık). Kaynak `amountText` (hof-invoices.js:65) = `String(value).replace(".", ",")`; doldurma noktaları:
  ürün seçimi :1065, son fiyat çipi :1937, Netten Brüte :2084, düzenleme/kopya :482.
- **Öneri**: yalnız birim fiyat için ayrı biçimleyici (tr-TR, min 2 / maks 4 ondalık, binlik ayraç: "1.249,90", "0,1235") — `amountText`'in kendisi DEĞİŞMEZ (miktar, oran, kur, ödeme
  tutarları ve 20 kullanım yeri etkilenmesin). Sunucu `parseAmount` (money.mjs:4–11) "1.249,90"ı doğru okur; istemci `num`/`parseTl` (:45–64) virgüllü metinde noktaları siler — güvenli.
  Tehlikeli biçim: virgülsüz "1.249" (binlik sanılır) — biçimleyici her zaman virgül üretmeli (min 2 ondalık).
- **Ek kör nokta**: kart kalem tablosunda birim fiyat `curMoney` ile 2 ondalığa yuvarlanır (:2313) — PDF 4 ondalık basar (invoice-pdf :16, :204). 4 ondalıklı fiyatta ekran ≠ PDF.
- **Anlık Durum kısmı 2.4.3'te yapıldı** (hof-overview.js:24–31 `compactMoney` "₺22,6 Mn"; 2.4.3-DEGISIKLIKLER :147). 2.4.4'te kalan yalnız fatura kısmı.
- **Testler**: `test/e2e/uiux-b-243.mjs:202–203` "20" ya da "20,00" kabul eder (yeni biçimde "20,00" — geçer); `senaryo-213.mjs:303` başka form (400,00). Yeni denetim: 1.249,90 fiyatlı
  ürün seçilince giriş "1.249,90", kayıttan sonra DB `unit_price = 1249.9` (ders 12: kayıttan sonra veri tabanı okunur).

##### 8. UI3a — PDF tarafı (Stok Kodu kolonu)

- **PDF tarafı 2.4.3'te KAPANDI (UI3b)**: `invoice-pdf.mjs:65–68` kod kolonu en uzun koda göre 62–120 pt; test `test/uiux-a-243.test.mjs:111–123` (EAN-13 ve "STK-2.0.26-001" tam).
  Kalan sınır: 120 pt'yi aşan kod (≈ 22+ karakter; kod alanı 60 karaktere kadar, invoices.mjs:1508) yine "…" ile kesilir (`doc.fit`, :215). İstenirse kod da ad gibi satır kaydırır (`doc.wrap`).
- **UI3a asıl olarak İSTEMCİ**: fatura kalem "Kod / Barkod" girişi; `.hof-inv-lines td.hof-inv-code { width: 118px; }` (hof-ui.css:9856, 2.0.16'dan beri) — td dolgusu ve girişin
  `padding: 0 8px` (:9852) yüzünden giriş ~100 px, 13 hane sığmıyor. En küçük düzeltme: td ≥ 140 px (tablo `min-width: 980px` :9850) ya da odakta genişleme; kart tablosunda
  `.hof-inv-doc-code` (hof-invoices.js:2313) da denetlenir. Test: e2e'de girişin `scrollWidth <= clientWidth` (13 hane) — eski CSS'te kırmızı.

---

##### 9. Bulunan sürprizler / kör noktalar (özet)
1. Defter kâhini (`test/bagimsiz/defter/`) hiçbir CI/Uzun Doğrulama işinde yok; yalnız elle (package.json:14). SMM/193 hiç kapsanmıyor.
2. `fatura-model.mjs` (tek otomatik fatura hesap "kâhini") programla aynı elden — ders 5'e göre tek başına kâhin sayılmaz; SMM stopajı da aynı formülle.
3. Netten Brüte (istemci) boş stopajda ayar oranını kullanıyor; sunucu kişi alıcıda 0 uyguluyor → yanlış brüt (K-E1b). KDV dahil işaretiyle de bozulur.
4. Çok kalemli e-SMM'de satır/belge stopaj yuvarlaması 1 kuruş ayrışabilir (K-E1a); kalemde stopaj saklanmıyor.
5. `cheque_events.invoice_id` kapamada bağ sayılır ama kapı (`invoice:cheque`) yalnız `cheques.invoice_id`'yi denetler; ayrıca çek olay bağı taksitli fatura süzgecinden geçmez
   (invoices.mjs:591, :638 — account_entries için süzgeç var :567, :629). Bugün yalnız faturanın kendi evrakı bu bağı yazdığı için zararsız; UX18-B açılırsa önemli.
6. 193 (SMM'de kesilen stopaj) hiçbir işlemle kapanmaz; Vergi Ödemesi/360 bakiyesi yalnız alış tarafı (tax.mjs:57–95). BİLİNEN SINIR (yıllık beyanname mahsubu kapsam dışı).
7. EDM e-SMM örneklerinde TaxableAmount 0, PayableAmount 1 kuruş tutarsız, KDV %18, WITHHOLDING alanında stopaj kodu 0003 — örnekler kâhin kaynağı olamaz.
8. UI3a'nın PDF tarafı (UI3b) zaten 2.4.3'te yapılmış; UI9'un Anlık Durum kısmı da — 2.4.4 iş listesi bunu "fatura kısmı" diye daraltmalı.
9. GİB şematron paketi depoda yalnız e-Fatura/e-Arşiv; e-SMM için GİB kuralı yok → e-SMM XML uygunluğu bağımsız denetlenemez (kaynak eklenmeli).

##### 10. Açık sorular (EDM / mali müşavir / kullanıcı)
1. EDM: e-SMM'de satır stopajını EDM yeniden mi hesaplıyor (NESNE/UBL)? 2 kalem × 100,03 TL %20 makbuzu test hesabında kabul ediliyor mu, resmî PDF'te stopaj 40,01 mi 40,02 mi?
2. EDM/GİB: `TaxInclusiveAmount` ("Tahsil Edilen KDV") KDV tevkifatlı makbuzda KDV − tevkifat mı? `WITHHOLDING_TAX_CODE` stopaj (0003) mı KDV tevkifatı (6xx) mı?
3. EDM/GİB: iskontolu e-SMM'de Brüt Ücret iskonto öncesi mi sonrası mı? (Öneri: e-SMM'de iskontoyu reddetmek.) KDV dahil fiyatla e-SMM serbest mi?
4. Kullanıcı: UX18 için A (cari ile aynı, FIFO) yeterli mi, yoksa B (çek faturaya bağlı kapanır; para çekirdeği + dar kontrol) isteniyor mu?
5. Kullanıcı: UX17 etiketleri ("Fatura Tutarı" / "Kalan" / "Tahsil Edilecek"; taslakta "Proforma Tutarı") ve toplam tablosundaki "Tahsil Edilecek"in PDF ile aynı "Ödenecek Tutar"a çekilmesi.
6. Mali müşavir: SMM varsayılan stopajı VKN'li gerçek kişi (tacir) alıcıda %20 mi olmalı (bugün 0)?

### EK-4 ortak-istemci

#### Alan haritası: ortak istemci çekirdeği ve modüller arası arayüz (2.4.4 hazırlığı, 21.10.2026)

Kaynak: /home/user/ofis---y-netimi çalışma ağacı (son commit cbcedb0, sürüm package.json:3 "2.4.3"). Salt okuma; hiçbir dosya değişmedi,
test koşulmadı. Her iddia dosya:satır ile; emin olunmayan "DOĞRULANMADI" diye işaretli.

---------------------------------------------------------------------------------------------------------------------------------
##### 1. Mimari (koddan)

###### 1.1 Sayfalar ve yükleme sırası
- `client/index.html:16-55` — 40 betik `defer` ile, SIRASI ÖNEMLİ: hof-core → hof-auth → hof-boot → hof-live → hof-palette → hof-workspace →
  hof-plans → … → hof-license. `HOF.office` (ortak PDF/Yazdır düğmesi, Excel ayrıştırma, amountText, todayIso) `hof-plans.js:1414`'te kurulur;
  hof-accounts / hof-stock / hof-invoices onu `office()` ile tembel okur (ör. `hof-accounts.js:322`, `hof-stock.js:181`, `hof-invoices.js:2355`).
- React arayüz paketi (kaynak kodu yok; `tools/patch-bundle.mjs:1-2` "derlenmiş paket, yalnız doğrulanmış yamalar") `index.html:7` meta
  `hof-app-bundle` → `hof-boot.js:310-328 loadApp()` dinamik `import()` ile, oturum doğrulandıktan SONRA yüklenir.
- `client/admin.html:11-13` yalnız hof-core + hof-auth + admin.js yükler (hof-ui.css + admin.css); modül betikleri admin sayfasında YOK.

###### 1.2 Çekirdek (client/assets/hof-core.js, 1500 satır) — bütün hof-*.js'nin ortak API'si
- Şirket/sayfa yönlendirme: `HOF.apiUrl` (:20-40) her `/api/` isteğine `?hofCompany=` ve `?hofPage=` ekler; `/api/(auth|public|health|license|companies)` hariç (:19).
- Metin: `esc` (:43), `normalize` (:44), `roleLabels`/`vocab` (:47-48, sektöre göre hof-insight değiştirir), `HOF.modules = { tahsilat: true, haciz: false }` (:49 varsayılan).
- Biçim: `formatDate/DateTime` (:62-63, gün-yalnız tarih YEREL gün — :56-61), `formatMoney` (:53, :64 → "₺1.249,90").
- Olay yolu: `HOF.on/emit/whenReady` (:78-88).
- Odak koruma: `keepFocus`/`swap` (:94-168; FOCUS_KEYS :94 `data-case-action` dahil).
- Taslak/kirli form izi: `isDraftField`, `markClean`, `isTouched` (:178-230).
- Yazma kökeni / kullanıcı-arka plan ayrımı: commit penceresi 15 sn (:241-272).
- Ödeme yolu adları: `PAY_METHODS`, `methodName` (:278-288; card → girişte "POS", çıkışta "Kredi Kartı").
- Yetki: `HOF.can(permission)` (:289).
- API: `HOF.api` (:307), arka plan kuyruğu 2 yuva (:335-347), `sendApi` 30 sn zaman aşımı + `requestId` (:361).
- Başlık yazımı: `HOF.titleCase` (:421-455) — sunucudaki `server/lib/text-case.mjs` ile aynı kural (bağlaç küçük, parantez içi aynen, "e-" küçük, tireli parça büyük).
- Defter değişti bildirimi: `LEDGER_PATHS` (:457-472) yazma adresinden etkilenen türleri çıkarır; `READ_ONLY_POSTS` (:473); `HOF.onLedger` (:624).
- Liste kapısı/yenileyici: `listGate`, `listRetry`, `listPending`, `refresher` (:505-623).
- DOM: `HOF.el` (:653), bildirim `HOF.toast` (:756) + `toastDuration` (:722, 15 karakter/sn) + `copyText` (:728); `toastError` (:876).
- Pencere: `HOF.modal` (:907; başlık `h2.hof-modal-title` + `p.hof-eyebrow` :919-920), `closeQuestion` (:903 "Kaydetmeden Kapat"), başlangıç odağı
  `HOF.focusStart` (:1081-1089), geri tuşu koruması (:1102-1144), `HOF.confirm` (:1212; yıkıcı ad kalıbı :1211), `fieldHtml` (:1287), `formModal` (:1322).
- TEK DOM izleyici: `HOF.onDom` (:1375-1411) — MutationObserver, kare başına bir kez; `[data-hof-ui]` içindeki değişimler YOK SAYILIR (:1393-1396).
- Veri: `HOF.data` (:1437/:1443 rows/tabs/choices), `refreshData` (:1471), `rowKey` (:1480), `detailPanel` (:1486), `selectedCase` (:1487).

###### 1.3 Açılış (client/assets/hof-boot.js, 387 satır)
- `boot()` (:337-383): `/api/auth/me` → `HOF.user`, `HOF.companyId` (:351-352) → `applyRoleClasses` (:249-253; `html.hof-can-<yetki>` sınıfları) →
  zorunlu parola → `loadClientState` (:84) → depolama köprüsü (:162) → `wrapFetch` (:256; 401 → giriş, 503 bakım, 403 LICENSE_READ_ONLY) →
  `bindCompanyLinks` (:281-299; `<a href>` tıklamada/orta tık/sağ tık/sürüklemede şirket parametresi eklenir, `window.open` sarılı) →
  `HOF.isReady=true`, `emit("ready")` (:366-367) → `loadApp()` → 60 sn `poll` (:179, :375).
- Yetki görünürlüğü CSS ile: `hof-ui.css:1108-1135` `html:not(.hof-can-…) [data-requires="…"] { display:none !important }`;
  denetim `test/yetki-gorunurluk.test.mjs:14-24` (kaynakta kullanılan her `data-requires` için kural olmalı).

###### 1.4 Operasyon merkezi ve detay kartı (client/assets/hof-workspace.js, 1375 satır)
- Plansız tahsilat penceresi `paymentForm` (:35-72) → `POST /api/workspace/cases/:key/payments` (:65; sunucu `server/routes/workspace.mjs:392-393`,
  yetki `payments.create`); "Taksit planı oluşturun" kısa yolu `offerPlan` (:38, :48, :52-57).
- Taksit seçici `openPlanCollect` (:79-117); detay kartının TAKSİT PLANI bölümü `casePlanHtml` (:121-134; satırda ₺ `data-case-collect="<taksit>"`,
  altta `+ Tahsilat` `data-case-collect=""` :133) ve `renderCasePlan` (:136-180; yeri `#hof-checks` ya da `.hof-case-actions` sonrası :146),
  tıklama yakalama aşamasında `onCasePlanClick` (:183-196 → `HOF.plans.collect`).
- Kayıt işlemleri `actions` (:205-…): `note` (:206), `phone`, `payment(target)` (:255-280; sıra: (1) kayda bağlı aktif taksit kartı → `openPlanCollect`,
  (2) kayda bağlı cari → `HOF.accounts.collect`, (3) `paymentForm`), `lien`, `task`.
- Sol menü: `SIDE_ITEMS` (:856-…), Hızlı Arama kaydı (:897-906), kullanıcı menüsü `renderUser` (:965-969: Profil, Parola, Yönetim, Çıkış),
  `installSidebar` (:971-1010; `data-action="guide"` kılavuz PDF :1003).
- İşlem geçmişi `renderActivity` (:1151-1204; boş metin :1178-1179, :1200; ilk 3 satır `ACTIVITY_SHOWN` :1073).
- Detay kartı düğme çubuğu `installDetailActions` (:1206-1219; düğmeler :1212). Başka modüller bu çubuğa düğme ekler: "Düzenle" `hof-table.js:479-481`,
  "Belge" `hof-documents.js:655-659`; denetim bölümü `hof-checks.js:36`.
- Dışa açılan API `HOF.workspace` (:1374) — `payment: target => actions.payment(target)`; kullananlar `hof-alerts.js:277,285` (zil/takvim "Tahsil Et")
  ve `hof-promises.js:137-144` (kayan Tahsilat Takvimi şeridi).

###### 1.5 Diğer ortak dosyalar
- `hof-table.js` (517): hücre düzeltme, satır silme, yeni kayıt, sayfalama (PAGE_SIZE 20 :6); `HOF.table` (:516).
- `hof-overview.js` (854): ANLIK DURUM kartı + Raporlar penceresi; para biçimi :21-41 (`compactMoney` :28-31, `moneyHtml` :32-41), `exportButtons` :364-368,
  `HOF.overview` (:813).
- `hof-alerts.js` (675): sağ alt bildirim kuyruğu; ödeme yolu yönlendirmesi `canPay/pay` (:277-285); `HOF.alerts` (:674).
- `hof-palette.js` (263): Hızlı Arama (Ctrl+K); sağlayıcı kaydı `HOF.search.register` (:248-252), girdi şekli `{group,label,path,keywords,requires,run}` (:37-45),
  gruplar "Sayfa/İşlem/Rapor/Ayar" (:11).
- `hof-export.js` (211): ana tablo "Dışa Aktar" menüsü (Excel · Bu Sekme / Tüm Sekmeler / CSV) — :59-79; düğme :160-170; indirme `HOF.nativeFetch(HOF.apiUrl(...))` :131.
- `hof-sources.js` (762): veri yokken başlangıç kartı `renderStart` (:397-430); `hasData = Boolean(HOF.settings.sheetUrl)` (:18 — satır sayısına değil ayar varlığına bakar).
- `hof-insight.js`: sektör profili `applyProfile` (:105-121) → `html.hof-no-haciz` / `html.hof-no-tahsilat` (:113-114); sunucuda modül `tahsilat` sektör ya da
  `payments > 0` ise açık (`server/lib/profile.mjs:194`).

###### 1.6 hof-ui.css (11.114 satır) — bölüm haritası (başlık yorumu satırı)
72 Açılış ekranı · 105 Giriş kartı · 168 Form öğeleri · 280 Düğmeler · 349 Pencereler · 430 Bildirimler · 574 Kenar çubuğu operasyon kartı ·
705 Dosya işlemleri ve geçmiş (`.hof-case-actions` 706-731) · 806 Listeler · 1108 Yetkiye göre görünürlük · 1658 Kalıcı çalışma verisi: başlangıç kartı
(`.hof-start` 1662-1700) · 2120 Modüller verinin sektörüne göre (2121-2125) · 2997 Tahsilat düzelt/sil ve Kasa · 3591 Dışa aktar menüsü · 4849 Tahsilat
takvimi şeridi · 4882 Sağ alt bildirimler · 6385 Taksitler (`.hof-plan-output` 6644-6669) · 7323 Cari ve Stok · 7890 Rapor Al penceresi (`.hof-rep-export`
8023-8055) · 8315 Rapor merkezi · 8633 Çek / Senet · 9785 Fatura · 10219 Banka · 10982 Hızlı Arama · 11050-11114 2.4.2/2.4.3 ekleri (gelenek: yeni kural
dosya SONUNA "2.4.x (madde): …" yorumuyla).

---------------------------------------------------------------------------------------------------------------------------------
##### 2. Değişmezler (bozulursa gerileme)
1. Kendi eklenen DOM öğesi `data-hof-ui` taşır; yoksa her değişim tek izleyiciyi tetikler (hof-core.js:1393-1396). Sonsuz DOM döngüsü dersi: hof-export.js:160-162.
2. Her `data-requires` yetkisinin CSS gizleme kuralı vardır (hof-ui.css:1108+; test/yetki-gorunurluk.test.mjs).
3. Bütün API/indirme istekleri sayfanın şirketine gider: `HOF.api`, `HOF.apiUrl`, `<a href>` yeniden yazımı (hof-boot.js:281-299); dış adres (EDM portalı vb.) değişmez.
4. Kayıt tahsilatının sunucu yolu TEK: `POST /api/workspace/cases/:key/payments` (workspace.mjs:392), düzelt/sil `PUT/DELETE /api/workspace/payments/:id`
   (workspace.mjs:439, :471; `editablePayment` :430-433 yetki `payments.create`).
5. Programın ürettiği adlar titleCase (CLAUDE.md "Yazım düzeni"); kaynak denetimi test/yazim-duzeni.test.mjs, ekran denetimi test/e2e/senaryo-211.mjs.
6. `#hof-start` DOM'u ve h2 metni 23 e2e dosyasının dayanağı (`grep -rln "#hof-start" test/e2e | wc -l` = 23; run.mjs:164-171 h2 metnini bekler).
7. Para gösterimi `HOF.formatMoney` (tr-TR, TRY, simge başta).
8. `HOF.office.outputButtons` kapsayıcısı `.hof-plan-output` + `a[data-pdf]` + `button[data-print]` KOD tarafından okunur: hof-invoices.js:393,
   hof-accounts.js:1525, hof-stock.js:569; e2e run.mjs:560,585, senaryo-cari-243.mjs:240.

---------------------------------------------------------------------------------------------------------------------------------
##### 3. E8 — Kayıt detay kartındaki "Tahsilat" düğmesini YALNIZ CSS ile gizle

###### 3.1 Bugünkü durum
- Düğme: `client/assets/hof-workspace.js:1212` `<button type="button" data-case-action="payment" data-requires="payments.create">Tahsilat</button>`
  (çubuk: WhatsApp, Not, Telefon, Tahsilat, Görev, Haciz). Tıklama → `actions.payment()` (:1213-1216 → :255).
- Mevcut gizleme: `client/assets/hof-ui.css:2121-2125` — `html.hof-no-tahsilat [data-case-action="payment"] { display:none !important }` YALNIZ tahsilat
  modülü kapalıyken; sınıf `hof-insight.js:114` `!HOF.modules.tahsilat`. Modül sunucuda sektör ya da `payments > 0` ile açılır (`server/lib/profile.mjs:194`)
  → bir kez tahsilat girilmiş her kurulumda düğme görünür.
- Yetki: `payments.create` "Kayda Tahsilat Girme" — "Kişi kartından tahsilat girer; tutar Kasa'ya düşer." (`server/lib/permissions.mjs:140`), bütün roller
  (`permissions.mjs:22`). CSS gizleme `hof-ui.css:1120`.
- Boş geçmiş metni: `hof-workspace.js:1178` `tools = ["not", "telefon", tahsilat?, haciz?]` → :1200 "Bu kayıtta henüz işlem yok. Yukarıdaki düğmelerle not, telefon
  veya tahsilat ekleyebilirsiniz." ("Görev" düğmesi listede hiç yok — ayrı küçük tutarsızlık.)
- Kayda bağlı TAKSİT kutusundaki doğru yol YERİNDE: `hof-workspace.js:133` `+ Tahsilat` (`data-case-collect=""`) ve :127 satır ₺ düğmesi; koşul
  `HOF.can("plans.view")` (:140) + `data.canCollect && HOF.can("plans.collect")` (:126). Tıklama `onCasePlanClick` (:183-196) → `HOF.plans.collect`.
- Düğme dışındaki girişler (JS DEĞİŞMEDİĞİ için çalışmaya devam eder): zil/bildirim "Tahsil Et" `hof-alerts.js:285` ve kayan takvim `hof-promises.js:137-144`
  → `HOF.workspace.payment(target)` → `paymentForm`.

###### 3.2 En küçük güvenli uygulama
- hof-ui.css SONUNA (gelenek 11050-11114):
  `/* 2.4.4 (müşteri isteği 20.10.2026): kayıt detay kartında "Tahsilat" düğmesi yok; tahsilat taksit kutusundan (+ Tahsilat / ₺), Cari'den ve Tahsilat
  Takviminden girilir. Sunucu yolu, eski tahsilatların İşlem Geçmişi'nde düzeltilip silinmesi değişmez. */`
  `.hof-case-actions [data-case-action="payment"] { display: none !important; }`
  (`data-case-action="payment"` istemcide yalnız hof-workspace.js:1212'de; seçici `.hof-case-actions` ile sınırlandırılır. `hof-ui.css:2123`'teki eski kural
  zararsızdır, kalabilir.)
- Boş geçmiş metni (JS'de TEK satır, kullanıcı "koda dokunmadan" dediği için ayrı onay noktası): `hof-workspace.js:1178` dizisinden
  `HOF.modules.tahsilat ? "tahsilat" : ""` çıkarılır → "not veya telefon" (haciz açıksa "not, telefon veya haciz"). İstenirse "görev" de eklenir.
- `server/lib/permissions.mjs:140` açıklaması ("Kişi kartından tahsilat girer") artık yanlış → "Tahsilat Takviminden kayda tahsilat girer; girdiği tahsilatı düzeltir" gibi.
  Yönetim → Roller ekranında görünür (DOĞRULANMADI: hangi ekranda gösterildiği; admin.js'de okunmadı).

###### 3.3 Etkilenen testler (hepsi gizli düğmeye `page.click` → Playwright görünürlük bekler → 30 sn zaman aşımı)
| Dosya:satır | Bugünkü adım | Öneri |
|---|---|---|
| test/e2e/run.mjs:488 | plansız tahsilat → düzelt → sil → Kasa | `page.evaluate(() => HOF.workspace.payment({ key: "2026/100", title: "…" }))` (takvim yolunun aynısı; form, Tab, kayıt arayüzden kalır) ya da API `POST …/cases/:key/payments` + `HOF.workspace.refreshActivity()` (:1374). Düzelt/sil adımı (:495-517) değişmez. |
| test/e2e/run.mjs:622 | plan yokken Tahsilat → "Taksit planı oluşturun" (`[data-new-plan]`) | Kısa yol yalnız `paymentForm` içinde (:48); düğme gidince EKRANDAN yalnız tutarsız takvim kalemiyle açılır. `HOF.workspace.payment({key,title})` ile aynı pencere; ya da kart formunu doğrudan `HOF.plans.openNew({caseKey…})`. |
| test/e2e/run.mjs:645 | planlı kayıtta Tahsilat → `.hof-plan-collect-modal` → 1. taksit | Ekrandaki gerçek yol: `#hof-case-plan tbody tr:first-child [data-case-collect]` (₺, :127). Beklenen "tutar 1.000,00" `HOF.plans.collect` formunda DOĞRULANMADI (hof-plans.js collect formu okunmadı). |
| test/e2e/senaryo-banka-210b.mjs:214 | kayıt tahsilatı Havale/EFT + Banka Hesabı seçici | `HOF.workspace.payment({ key: "2026/501", title })` — banka seçici (`HOF.bank.attachPicker` :52) aynı formda kalır. |
| test/e2e/senaryo-cari-243.mjs:173 | kayıttan tahsilat kaydın defterine (cari bağsız) | aynı `HOF.workspace.payment`; DB denetimi (:179-183) aynen. |
| test/e2e/senaryo-cari-243.mjs:206 | cariye bağlı kayıttan tahsilat cariye | `HOF.workspace.payment({key:"2026/101",title})` → `actions.payment` yönlendirmesi (:268-275) aynı. |
- YENİ denetim (eski kodda kırmızı): run.mjs'de kayıt seçiliyken
  `getComputedStyle(document.querySelector('.hof-case-actions [data-case-action="payment"]')).display === "none"` + Not/Telefon görünür
  (örnek kalıp run.mjs:1216 `lienAction`). İsteğe bağlı ucuz birim denetim: hof-ui.css'te koşulsuz kural var (kaynak taraması, CRLF-güvenli ders 27).
- Kılavuz: `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html:117` ("Kartın düğmeleriyle Not, Telefon, **Tahsilat**, Görev ve Belge") ve :288 ("kişinin kartındaki
  **Tahsilat** taksitlerini gösterir; **Tahsil Et**") güncellenir; ekran görüntüleri (docs/kilavuz/ekran/) düğmeyi gösteriyorsa yenilenir (DOĞRULANMADI).
- Bütün e2e koşulur (ders 28); değişen 3 dosya (run.mjs, senaryo-banka-210b, senaryo-cari-243) mutlaka.

###### 3.4 Riskler / kör noktalar
- Kayda bağlı CARİ varken detay kartından cari tahsilatı kısa yolu (:268-275) EKRANDAN kalkar; kullanıcı Cari penceresine gider. 2.0.18 "detay kartında Cari kutusu
  yok" kararıyla birlikte, cariye bağlı kayıtta karttan tahsilat yolu hiç kalmaz (taksit kartı yoksa).
- Plansız kayıtta "Taksit planı oluşturun" kısa yolu (:48) pratikte ulaşılmaz olur; kart Taksitler → + Yeni Kart'tan açılır.
- Sektör ayarındaki "Tahsilat ve Kasa Takibi" kutusu (`hof-insight.js:876`) görünür etkisini büyük ölçüde yitirir (yalnız :1079 metni ve :1178 boş metin).
- "Kayıt Kartından Tahsilatlar" raporu (senaryo-cari-243.mjs:217 `kayit-tahsilatlari`) eski ve takvimden gelen tahsilatları göstermeye devam eder — adı yanıltıcı olabilir.
- Para çekirdeği: sunucu değişmez; JS'de yalnız metin. Gizleme CSS'te kaldığı için düğme DOM'da durur (erişilebilirlik ağacında yok, Tab'a girmez).

---------------------------------------------------------------------------------------------------------------------------------
##### 4. UI11 — dışa aktarım düğmelerinin tam envanteri ve birleştirme

###### 4.1 Envanter (bugünkü ad / sınıf-renk)
Aile A = `.hof-rep-out is-pdf` (kırmızı ton: #fff6f4 zemin, #a4392c yazı) / `is-xlsx` (yeşil ton: #f1faf4, #1c6b48) — hof-ui.css:8030-8055.
Aile B = `hof-button hof-button-small hof-button-ghost` (nötr; outputButtons'ta PDF simgeli + Yazdır) — hof-plans.js:361-362, süzgeç satırında 36 px hof-ui.css:6653-6658.

| # | Yer (dosya:satır) | Ekran | Bugünkü ad | Aile |
|---|---|---|---|---|
| 1 | hof-plans.js:421 (outputButtons) | Taksitler listesi | "Liste - PDF" + "Yazdır" | B (simgeli) |
| 2 | hof-plans.js:483 | Taksit kartı | "Taksit Ekstresi - PDF" + "Yazdır" | B |
| 3 | hof-accounts.js:322 + :305 (`outputs(... data-xlsx)`) | Cari listesi | "Cari Listesi - PDF" + "Yazdır" + "Excel" | B |
| 4 | hof-accounts.js:361 | Cari kartı | "Cari Ekstre - PDF" + "Yazdır" | B |
| 5 | hof-stock.js:181 | Stok listesi | "PDF" (varsayılan etiket) + "Yazdır" + "Excel" (data-xlsx YOK) | B |
| 6 | hof-stock.js:208 | Stok kartı | "Stok Kartı - PDF" + "Yazdır" | B |
| 7 | hof-invoices.js:2355 | Fatura kartı | "<Belge Türü> - PDF" / "Proforma - PDF" + "Yazdır" | B |
| 8 | hof-invoices.js:293 | Fatura listesi | "Liste - PDF" / "Liste - Excel" | A (simgesiz) |
| 9 | hof-invoices.js:306 | Fatura seçim çubuğu | "Seçilenleri PDF" / "Seçilenleri Excel" / "e-Belge XML (ZIP)" | B (simgesiz) |
| 10 | hof-cheques.js:161 | Çek / Senet listesi | "Liste - PDF" / "Liste - Excel" | A |
| 11 | hof-overview.js:364-368 `exportButtons` (kullanım :481 Cari Ekstre/Mizan, :521 Vade Takip, :555 Nakit Akış, :685 Çek/Senet raporu) | Raporlar penceresi | "PDF İndir" / "Excel İndir" (simgeli) | A |
| 12 | hof-report-center.js:329-330 (href güncelleme :373 sınıfa bakar) | Rapor Merkezi | "PDF İndir" / "Excel İndir" (simgesiz) | A |
| 13 | hof-bank.js:1679-1682 `movesExportHtml` (`data-mv-export`) | Banka → Hareketler | "PDF İndir" / "Excel İndir" | A |
| 14 | hof-workspace.js:628 (`button data-pdf`, indirme :584-600) | Kasa | "Kasa Dökümü - PDF" (Excel yok) | B (simgesiz) |
| 15 | hof-reports.js:178 (`data-export="xlsx"/"pdf"`, `data-print`) | Tablo raporları | "Excel" / "PDF" / "Yazdır" (Yazdır birincil) | B |
| 16 | client/admin.html:110 (`#adm-company-report-pdf/-xlsx`, href admin.js:1519-1520) | Yönetim → Şirketler → Birleşik Rapor | "PDF" / "Excel" | B |
| 17 | hof-whatsapp.js:155 | WhatsApp ekstre gönderimi | "Ekstre PDF" | `hof-button-ghost` (küçük değil) |
| 18 | hof-export.js:168 + menü :59-66 | Ana tablo | "Dışa Aktar" → "Excel Dosyası (.xlsx)" / "Excel · Bu Sekme" / "Excel · Tüm Sekmeler" / "CSV (düz metin)" | ayrı (menü) |
Dışa aktarım olmayan PDF/indir düğmeleri (belge görüntüleyici "Yeni Sekmede Aç"/"Yazdır"/"İndir" hof-documents.js:344, :492-493; kurtarma anahtarı "Yazdır"
hof-auth.js:181) kapsam dışı sayıldı.

###### 4.2 KÖR NOKTA — önceki müşteri kararıyla çelişki
- 2.0.16 (CHANGELOG.md:289; kod yorumu hof-plans.js:360 "v2.0.16 (müşteri): düğme ne indirdiğini söyler"): "*Cari Ekstre - PDF, Taksit Ekstresi - PDF, Stok Kartı - PDF,
  Satış Faturası - PDF* (belge türüyle), *Cari Listesi - PDF, Liste - PDF / Excel, Kasa Dökümü - PDF*". Görevdeki "tek ad PDF/Excel" bu müşteri isteğini geri alır.
  2.4.3-DEGISIKLIKLER.md:170 ertelemenin adı "dışa aktarım düğme adlarının bütün modüllerde BİRLEŞMESİ" — "PDF" tek kelimesi şart değil.
- Kullanıcıya sorulacak (önerilen varsayılan): (a) LİSTE ve RAPOR düğmeleri tek biçim "PDF" / "Excel" (aynı pencerede tek liste var; ne indirildiği `title`/`aria-label`'da:
  "Cari Listesi - PDF olarak aç"); (b) KART/BELGE düğmeleri 2.0.16 kararı gereği adlı kalır ("Cari Ekstre - PDF" …) ama aynı aile/renkte. Kullanıcı "her yerde yalnız PDF"
  derse 2, 4, 6, 7, 14 de değişir.

###### 4.3 En küçük değişiklik (öneri; seçenek a)
- Etiket: #1 hof-plans.js:421 "Liste - PDF"→"PDF"; #3 hof-accounts.js:322 "Cari Listesi - PDF"→"PDF"; #8 hof-invoices.js:293 ve #10 hof-cheques.js:161 "Liste - PDF/Excel"→"PDF"/"Excel";
  #11 hof-overview.js:366-367, #12 hof-report-center.js:329-330, #13 hof-bank.js:1681-1682 "PDF İndir/Excel İndir"→"PDF"/"Excel"; #9 "Seçilenleri PDF/Excel" seçim çubuğunda
  kalabilir (seçim bağlamı) ya da "PDF"/"Excel".
- Renk/aile: tek CSS ailesi. En az dokunuşlu yol markup'a dokunmadan CSS: Aile B'deki dışa aktarım bağlantılarını Aile A görünümüne getirmek
  (`.hof-plan-output a[data-pdf]` → is-pdf renkleri; `.hof-plan-output a[data-xlsx]` → is-xlsx). Stok Excel bağlantısına `data-xlsx` eklenmeli (hof-stock.js:181'de yok).
  36 px yükseklik kuralı (hof-ui.css:6653-6658) korunur — senaryo-cari-243.mjs:240-244 PDF düğmesi ≤ seçici yüksekliği + 1 bekler.
  Alternatif (daha temiz): `HOF.exportLinks({ pdf, xlsx, what, print })` tek yardımcı (hof-core.js) ve 8 yer onu çağırır — daha çok satır değişir.
- Korunacak öznitelikler: `data-pdf`, `data-print`, `data-xlsx`, `data-mv-export`, `data-export`, `.is-pdf/.is-xlsx`, `.hof-plan-output` (kod ve testler okuyor, bkz. §2.8).
- Çift başlık: Çek / Senet 2.4.3'te düzeltildi (hof-cheques.js:158 yalnız `<small>`; test/e2e/uiux-a-243.mjs:383-387). KALAN: Fatura listesi `hof-invoices.js:288`
  `<h3>${esc(moduleName())}</h3>` (pencere başlığı da `moduleName()` hof-invoices.js:83-84). Öneri: liste görünümünde h3 kaldırılır, `<small>` kalır (Çek ile aynı).
  Kart/form/ayar görünümlerindeki `.hof-plan-title h3` KALMALI: senaryo-215.mjs:115,122,411; senaryo-216.mjs:116,123,287; senaryo-217.mjs:119,126; uiux-b-243.mjs:308,319,
  322,325,335 (Esc sonrası h3 boş olursa :322-323 yine geçer: `!/Fatura Ayarları/.test("")`); excel-denetim/*.mjs; esc-kapat.mjs:51.

###### 4.4 Etiketlere bağlı testler/belgeler
- test/e2e/senaryo-banka-210.mjs:2577-2578 TAM METİN `"PDF İndir"` / `"Excel İndir"` bekler → güncellenir.
- test/e2e/senaryo-216.mjs:232 `/Alış Faturası - PDF/`, :309 `/Cari Ekstre - PDF/` (yalnız kart etiketleri değişirse).
- test/e2e/senaryo-cari-243.mjs:244 (yalnız ileti metni; seçici `[data-pdf="list"]`).
- Seçici (etiketten bağımsız, öznitelik korunursa sorun yok): run.mjs:560, 585, 812, 1320, 1523, 1583; senaryo-216.mjs:353; senaryo-banka-210.mjs:2365, 2561;
  senaryo-pos-220.mjs:634; senaryo-raporlar.mjs:342; senaryo-210.mjs:127; senaryo-form-izolasyon-243.mjs:846-859.
- Kılavuz (metin-denetle.mjs kalın adların ekranda birebir olmasını denetler, docs/kilavuz/metin-denetle.mjs:1-4): DestekOfis-Kullanim-Kilavuzu.html:136 "Kasa Dökümü - PDF",
  :226-227 ve :363 "PDF İndir"/"Excel İndir", :335 "Satış Faturası - PDF", :340 "Seçilenleri PDF / Excel".
- yazim-duzeni.test.mjs: tek sözcüklü "PDF"/"Excel" denetlenmez (`eligible` en az 2 sözcük, :99) → kırılmaz.
- YENİ test önerisi (eski kodda kırmızı): kaynak taraması — client/assets'te `.pdf`/`/pdf?`/`.xlsx`/`/xlsx?` hedefli dışa aktarım bağlantılarının görünen adı izinli kümede
  ("PDF","Excel" + kart istisnaları) ve sınıf ailesi tek; + senaryo-211 gezintisine "dışa aktarım düğmeleri tek ad" ekran denetimi.

###### 4.5 UI11'in öbür alt maddeleri (koddan durum)
- "Hareket Hareket" → "Tek Tek Hareketler" YAPILDI (hof-overview.js:556; uiux-a-243.mjs:396-401).
- Stok 5. özet kartı tek sıra YAPILDI (hof-ui.css:11106; uiux-a-243.mjs:375).
- Özel açılır kutularda "▼" glifi (Banka Kurulum Sihirbazı Banka Adı, fatura kalem Birim): istemcide "▼" karakteri yok; büyük olasılıkla tarayıcının `<input list>`
  (datalist) oku (hof-core.js:1307 `list=` + `<datalist>`). DOĞRULANMADI (ekranda bakılmadı).

---------------------------------------------------------------------------------------------------------------------------------
##### 5. UI9 — para/sayı biçimi
- Anlık Durum / Nakit Akış kısaltılmış tutar "₺22,6 Mn" 2.4.3'te YAPILDI: hof-overview.js:26-31 `compactMoney` (simge başta), :34 ≥10 Mn eşiği, eksen :628;
  e2e uiux-a-243.mjs:396-406 (J bölümü).
- Kasa Dökümü PDF "1.849 hareket" YAPILDI: server/lib/cash-report.mjs:138-139.
- KALAN (fatura alanı — fatura-istemci haritasında ayrıntı): Birim Fiyat ürün seçilince "1249,9" — hof-invoices.js:65 `amountText = String(value).replace(".", ",")`,
  atama :1065 (ve :482, :1937, :2084; toplam 20 çağrı). Geri okuma `parseTl` (:54-60) "1.249,90"yı doğru çözer. En küçük düzeltme: yalnız fiyat atamalarında
  `HOF.office.amountText` benzeri tr-TR biçim (en az 2, en çok 4 ondalık; hof-plans.js:18 AMOUNT_FORMAT 2 ondalık — 4 ondalıklı birim fiyatı yuvarlar, DİKKAT).
- Ortak çekirdek için öneri: tek biçimleyici `HOF.formatMoney` (hof-core.js:64) zaten var; düzenlenebilir alan değeri için çekirdekte `HOF.amountInput(n, {max:4})` yok —
  yeni yardımcı eklenirse fatura, cari, stok, banka aynı kuralı paylaşır (ayrı karar).

---------------------------------------------------------------------------------------------------------------------------------
##### 6. KÖ3 — "Başlarken" kontrol listesi (yeni özellik)

###### 6.1 Bugün ilk açılışta ne var
- Veri yokken ortada `#hof-start` (hof-sources.js:397-430): h2 "Excelini yükle ya da Google Sheets linkini yapıştır, başlayalım" (:410), yükleme alanı (yalnız
  `sources.manage` :412-414), taslak Excel (:375), kılavuz bağlantısı + destek telefonu (:415). `html.hof-no-data` sınıfı (:401). Koşul `hasData()` = sheetUrl ayarı (:18).
- Excel yüklendikten sonra sektör analizi tanıtımı `#hof-intro` (hof-insight.js:1244-1260; `profile.introPending` sunucuda).
- Yönetici kurtarma anahtarı hatırlatması (hof-workspace.js:1322-1340 `nudgeRecovery`, 3 günde bir, `/api/admin/recovery`).
- Şirket adı kurulumda "Şirket 1" (server/lib/companies.mjs:106, :158).
- Bulgu (uzman-ux-BULGULAR.md:140): muhasebe kullanıcısına ilk ekran "Excelini yükle" diyor; firma bilgisi / Fatura Ayarları / ilk banka hesabı için yol yok.

###### 6.2 Durum kaynakları (var olan uçlar; yetkiye bağlı)
| Madde | Kaynak | Yetki | Tamam ölçütü |
|---|---|---|---|
| Şirket adı | `HOF.user.company` (hof-boot.js:352) / `GET /api/companies` (routes/companies.mjs:44-47) | oturum | ad ≠ "Şirket 1" |
| Firma bilgileri + Fatura Ayarları | `GET /api/workspace/invoices/meta` → `settings.sellerReady`, `settings.sellerName` (routes/invoices.mjs:2303-2326) | invoices.view | sellerReady && sellerName |
| İlk banka hesabı | `GET /api/workspace/bank/accounts?status=all` (hof-bank.js:206 aynı çağrı) | bank.view | ≥1 hesap |
| Cariler | `GET /api/workspace/accounts?limit=1` → total (DOĞRULANMADI: yanıt alanı adı) | accounts.view | total > 0 |
| Kullanıcılar | yönetim kullanıcı listesi (DOĞRULANMADI: uç adı) | users.manage | >1 etkin kullanıcı (isteğe bağlı) |
| Kurtarma anahtarı | `GET /api/admin/recovery` → exists (hof-workspace.js:1335) | users.manage | exists |
| Excel tablosu (isteğe bağlı) | `HOF.settings.sheetUrl` (hof-sources.js:18) | — | dolu |
- Eylemler: Yönetim sayfaları `location.assign("/admin.html#companies|users|backups")` (kalıp hof-workspace.js:904); Fatura Ayarları için `HOF.invoices` dışa
  açılan API'de doğrudan ayar açan işlev YOK (hof-invoices.js:3475; ayar `[data-act="settings"]` :292) → `HOF.invoices.openSettings` eklemek gerekir;
  banka `HOF.bank.open()` / `HOF.bank.openWizard` (hof-bank.js:3231-3236); cari `HOF.accounts.open()`.

###### 6.3 Önerilen en küçük güvenli yer ve biçim
- OTOMATİK pencere AÇILMAZ (açılan modal e2e'lerin tıklamalarını keser). İki giriş:
  (1) `#hof-start` kartının İÇİNE, h2 ve `.hof-drop` DEĞİŞMEDEN, `data-hof-ui` taşıyan ayrı bir bölüm (`#hof-getting-started`, yalnız yönetici) — veri yokken görünür;
  (2) kullanıcı menüsüne (hof-workspace.js:968) ya da Hızlı Arama'ya (hof-workspace.js:897-906, grup "Ayar", ad "Başlarken") giriş → aynı listeyi `HOF.modal`'da açar
  (veri yüklendikten sonra da ulaşılır).
- Durum okunamazsa madde "Bilinmiyor" yazar, "tamam" değil (ders 4); yetkisiz madde listelenmez (HOF.can).
- Kapatma tercihi: kişi+şirket başına; mevcut kalıp localStorage (hof-overview.js:57-71 `hof.pulse.collapsed.<id>`) — bilgisayar başınadır; sunucu tarafı istenirse
  client-state (hof-boot.js:84) ya da ayar. KARAR GEREKİR.
- Daha temiz alternatif: tek okuma ucu `GET /api/workspace/getting-started` (sunucu yetkiye göre boolean döner; birim test yazılır; tek istek) — para çekirdeğine dokunmaz.
- Yeni metinler titleCase: madde adları ("Firma Bilgilerini Girin", "İlk Banka Hesabını Açın") yazim-duzeni.test.mjs'e girer (2-7 sözcük, :99-100); açıklamalar cümle.
- Yeni `data-requires` kullanılırsa hof-ui.css:1108+ kuralı eklenmeli (yetki-gorunurluk.test.mjs).

###### 6.4 Testler ve riskler
- Yeni e2e: boş kurulum (yönetici) → liste görünür, maddeler "yapılmadı"; firma bilgisi + banka hesabı API'den → yenile → "tamam"; muhasebe/personel rolü → yetkisiz maddeler yok;
  durum ucu 500 → "Bilinmiyor". `#hof-start`a bağlı 23 e2e'den en az run.mjs (164-171) ve bir yükleme e2e'si (e2e-not-yaris.mjs:72) koşulur (yer kayması, tıklama örtmesi —
  senaryo-form-izolasyon-243.mjs:846-859 "centerCovered" ölçer).
- Risk: hasData yalnız sheetUrl'e bakar (hof-sources.js:18) — Excel'siz çalışan muhasebe kurulumunda `#hof-start` hep durur; liste orada yaşarsa iyi, ama "Excelini yükle"
  başlığı yine ilk cümle kalır (h2 değişirse run.mjs:165 kırılır; değişiklik kullanıcı kararı).

---------------------------------------------------------------------------------------------------------------------------------
##### 7. Yazım düzeni araçları (her yeni ad için)
- İstemci `HOF.titleCase` (hof-core.js:421-455), sunucu `server/lib/text-case.mjs` (33 satır, aynı kural).
- Kaynak denetimi `test/yazim-duzeni.test.mjs`: istisna cümleler `SENTENCES` (:14-91), uygunluk `eligible` (:93-107: 2-7 sözcük, büyük harf ya da "e-X" başlangıç,
  virgül/nokta/fiil sonlu cümleler hariç), tarama `violations` (:109-135: etiketler, simgeli etiket, title/label/submitLabel…, seçenek dizileri, `TITLES/LABELS` sabitleri;
  sunucuda kolon dizileri, Excel sayfa adı, şablon başlık). Testler: arayüz dosyaları (:138-142, client/assets/hof-*.js + admin.js + admin.html), hareket türü adları
  (:146-166), React paketi (:170-184), sunucu rapor başlıkları (:185+).
- Ekran denetimi `test/e2e/senaryo-211.mjs` G adımları (:342, :421-516): bütün modüller, formlar, rapor sekmeleri, Yönetim gezilir. DİKKAT (E9 için not): bu dosya
  createApp'e HUKUK_LICENSE_URL vermiyor (:32) ama `license.enforce:false` → autoTrial çalışmaz (server/lib/license.mjs:536 `shouldAutoTrial` enforce ister); sızıntı kaynağı değil.

---------------------------------------------------------------------------------------------------------------------------------
##### 8. Diğer 2.4.4 maddelerine ortak çekirdekten dokunma noktaları (bilgi)
- UX10 (fatura odak): ortak araç `HOF.focusStart` (hof-core.js:1081-1088) — `[autofocus]` > ilk yazılabilir alan > × dışı ilk öğe. Faturada doğru alana `autofocus` vermek yeterli.
- E7 (E-Fatura Portal): `window.open` hof-boot.js:296-298'de sarılı; dış kaynak adresi değişmez. Tarayıcıdan `window.open` aynı Edge profilinde açar — KALICI AYRI profil
  ancak başlatıcıdan (launcher) olur (DOĞRULANMADI: başlatıcı kodu okunmadı).
- E6 (Seçilenleri Gönder): seçim çubuğu hof-invoices.js:306 (`.hof-acc-selbar`) — UI11 #9 ile aynı satır.

### EK-5 test-kapi

#### Alan haritası: TEST ALTYAPISI VE DOĞRULAMA KAPISI (test-kapi) — 2.4.4 hazırlığı

Kaynak: depo `/home/user/ofis---y-netimi`, dal `claude/youthful-euler-fl8ks4` (yerelde etiket YOK, depo SIĞ — `git rev-parse --is-shallow-repository` = true,
`git tag | wc -l` = 0). Bu belge SALT OKUMA ile yazıldı; hiçbir test koşulmadı, ağa istek atılmadı. Her iddia dosya:satır; emin olunmayan "DOĞRULANMADI".

---

##### 1. Mimari özet

###### 1.1 Koşucular
- **Birim/API testleri**: `npm test` = `node --test --test-concurrency=1 "test/**/*.test.mjs"` (package.json:13). Yalnız `*.test.mjs` koşar; `test/` altındaki
  diğer `.mjs` (yarış/zorlama betikleri, ör. `test/mutabakat-gece-yarisi.mjs`, `test/e2e/senaryo-222-yaris.mjs`) npm test'e GİRMEZ (elle koşulur).
  Sunucu süreç içinde `startTestServer` ile açılır (test/helpers.mjs:9): lisans varsayılanı `{ enforce: false }` (helpers.mjs:23), lisans zamanlayıcısı kapalı
  (helpers.mjs:24), sahte saat `options.now` (helpers.mjs:46-48), HTTP istemcisi `createClient` (helpers.mjs:94), `loginAdmin` (134), `installPageClock` (152).
  Yerel kayıtlı süre: ~17–26 dk, ~2.700 test (docs/kanit/2026-10-1[6-8]/*npm-test*.json: 1001–1588 sn).
- **Uçtan uca (e2e)**: her senaryo kendi `.mjs` betiği; `createApp` süreç içinde + Playwright Chromium `chromium.launch()` (test/e2e/run.mjs:52-55).
  65 e2e npm betiği; 52'si CI'de (ci.yml:70-121); CI DIŞI 13: test:senaryo, -rapor, -taslak, -210…-218, -whatsapp + betiksiz `ui-ux-217.mjs` (ders 8: elle koşulur).
  Sonuç biçimleri `tools/kanit.mjs` parseSummary'de tanınır (kanit.mjs:53-85): run.mjs "N adım başarılı." (run.mjs:1776; ilk kırmızı adım tüm koşuyu durdurur,
  run.mjs:60-75, 1777-1779), senaryolar "N geçti, M kaldı" (ör. senaryo-cari-243.mjs:436, senaryo-banka-210b.mjs:766), "N/M denetim geçti".
- **Yardımcılar**: `test/e2e/esc-kapat.mjs` (ders 34): Esc → "Kaydedilmemiş Değişiklik" çıkarsa "Kaydetmeden Kapat" (esc-kapat.mjs:32-78); `ESC_KAPAT_GUNLUK=<dosya>`
  ile her soru JSON satırı (36-71), `{ expect: "soru-yok"|"soru-var" }` beklentisi (76-77); özet `test/e2e/esc-kapat-ozet.mjs`. `test/e2e/cpu-yavaslat.mjs`
  (HOF_CPU_YAVASLAT=4 ile Chromium CPU yavaşlatma, ders 20). `test/fixtures/goreli-tarih.mjs` (ders 13), `surum-2.0.x-zincir` fikstürleri (ders 17).
- **Kâhinler** (temiz oda): `test/bagimsiz/ebelge/` (model.py, fark.py, kosucu.mjs, uretici.py, mutasyon.py, test_model.py; değişmezler I0–I19 fark.py:11-19;
  I15 = "eşzamanlı turda gönderilen belge için hata yanıtı yok" = D2'nin kâhin karşılığı), `test/bagimsiz/defter/` (kahin.py, kos.mjs — `npm run test:kahin-defter`,
  package.json:14; Uzun Doğrulama'da YOK), banka kâhini `test/bagimsiz/fark.py` + model_a/model_b.
- **Uzun koşular**: `test/mutabakat/kos.mjs` (`test:mutabakat`), `test/guvenilirlik/kos.mjs` (`test:guvenilirlik`), `test:kahin-ebelge` = `python3 test/bagimsiz/ebelge/fark.py` (package.json:87).

###### 1.2 Kanıt aracı `tools/kanit.mjs`
- `kos <ad> [--sure dk] [--] <komut>`: komutu KABUKSUZ koşar (Windows'ta npm/npx → npm-cli.js; resolveCommand kanit.mjs:192-209), ham çıktı + JSON kaydı
  `docs/kanit/<gün>/` ya da `KANIT_DIR` (kanit.mjs:44, 211-271). Hüküm (verdict kanit.mjs:162-171): GEÇTİ yalnız çıkış 0 + tanınan özet + 0 başarısız + 0 iptal + ≥1 test;
  özet yok → BELİRSİZ/BAŞARISIZ; çıkış↔özet çelişkisi → ÇELİŞKİ; zaman aşımı/sinyal → YARIDA. Başarısız test adları çıktının SONUNA (failedTests 91-160; 264-267).
- `ci [sha] [--bekle dk]`: yalnız `.github/workflows/ci.yml` koşuları (CI_WORKFLOW 293; filtre 337). YEŞİL ⇔ bütün koşular bitmiş + bütün işler `success` + "Doğrulama Kapısı"
  işi var (ciStateOf 332-358). Atlanan iş = KIRMIZI. Koşusu olmayan commit yalnız belge ise hüküm en yakın koşulu atadan (ciState 311-330, en çok 30 adım; aradaki her commit yalnız belge).
- `kapi <klasör> --commit --beklenen a,b,… --ayni-sayi önek --atlanan-yok önek` (gateVerdict 384-409): beklenen her kayıt var, tek kayıt, GEÇTİ, aynı commit, kirli ağaç yok,
  aynı önekli kayıtlar aynı test sayısı, atlanan yok, `NEEDS_JSON` işleri success. Kayıt = `ad`+`hukum` alanlı JSON (readRecords 411-431; 19.10 kâhin JSON düzeltmesi b68aafe).
- `durum [--hook]` (machineState 461-476, hookDecision 478-488): `.claude/settings.json` Stop + SubagentStop kancası — durum yeşil değilse yanıtı BİR KEZ durdurur.
- `releaseGate` (492-501): `tools/release.mjs:27-29` imzalı paketi yalnız temiz ağaç + CI YEŞİL commit'ten üretir (atlatma yok).
- `BELGE_YOLLARI` (kanit.mjs:297) + `yalnizBelge` (298; yalnız tam eşleşme ve `/**` öneki desteklenir — `*` joker YOK).

###### 1.3 GitHub iş akışları
| İş akışı | Tetik | İşler |
|---|---|---|
| `ci.yml` "CI" | push her dal (paths-ignore ci.yml:8-16), pull_request (süzgeçsiz, ci.yml:17) | `test` matris ubuntu/windows × Node 22/24 (ci.yml:20-51: npm ci → check → `kanit kos npm-test-<os>-node<n> npm test` → artifact `kanit-<os>-node<n>`); `e2e` Chromium ubuntu Node 24 (53-133: playwright install --with-deps chromium, 52 `kanit kos e2e-*`); `kapi` "Doğrulama Kapısı" (139-161, needs test+e2e, if: always(); `--beklenen` 56 ad, `--ayni-sayi npm-test-`, `--atlanan-yok npm-test-`); `package` "Dağıtım paketi" (163-176, needs kapi) |
| `uzun-dogrulama.yml` | push her dal + workflow_dispatch; işler YALNIZ commit iletisinde `[uzun-dogrulama]` ya da elle (32, 65, 89, 127, 150) ve depo herkese açıkken | `mutabakat` 10 ubuntu tohum + 1 windows (31-62, max-parallel 6, 5.000 işlem); `mutabakat_uzun` 10.000 işlem tohum 11 (64-86); `guvenilirlik` 2 taban × 5 tohum + 1 windows (88-121, 10.000 işlem); `kahin_ebelge` (123-147: test_model.py + mutasyon.py, sonra `kanit kos kahin-ebelge-tohum1-5-islem300 … --tohumlar 1-5 --islem 300 --kucult --butce 25`); `kapi` "Uzun Doğrulama Kapısı" (149-169, 24 beklenen ad) |
| `release.yml` "Sürüm yayımla" | tag `v*` | `test` (17-92: etiket = package.json sürümü, npm ci, playwright, check, npm test, bütün CI e2e betikleri — kanit OLMADAN); `windows` (94-97, windows.yml'yi çağırır); `publish` (99-158: `kanit.mjs ci "$GITHUB_SHA" --bekle 90` → release.mjs → gh release) |
| `windows.yml` | push master, dispatch, workflow_call | `build` (Wine/windres/osslsigncode, build-windows.mjs), `install-test` (gerçek Windows'ta sessiz kurulum, servis, UDP keşif, giriş, yedek, `kanit kos windows-guncelleme-gercek -- node test/guncelleme-gercek/windows-kurulum.mjs`, yeniden kurulum, kaldırma) |

Kaynak tarayan denetimler (değişiklikte kırılırlar):
- `test/ci-kapi-listesi.test.mjs:38-49` ci.yml'deki her `kanit.mjs kos <ad>` ↔ kapının `--beklenen` listesi İKİ YÖNLÜ aynı; `:51-56` release.yml CI'nin her e2e betiğini koşar;
  `:95-111` Uzun Doğrulama matris adları ↔ kapı listesi, max-parallel ≤6, `if: (!github.event.repository.private)`, varsayılan 5000/10000.
- `test/kanit-araci.test.mjs:187-227` yalnız-belge kuralları ve `ci.yml paths-ignore == BELGE_YOLLARI` (220-226).
- `test/lisans-servisi-izolasyonu.test.mjs` (yalnız `test/**/*.mjs` tarar, 25-35) ; `test/platform-tasinabilirlik.test.mjs` (ders 27/33).
**Yeni e2e eklemenin 4 yeri**: package.json betiği + ci.yml `kanit kos e2e-<ad>` adımı + ci.yml:159 `--beklenen` + release.yml `npm run test:<ad>` (yoksa ci-kapi-listesi kırmızı).

---

##### 2. Değişmezler (koddan)
1. "Geçti" yalnız çıkış 0 + tanınan özet + 0 fail/cancel + ≥1 test (kanit.mjs:162-171).
2. Kapı: 4 platform + bütün e2e aynı commit'te GEÇTİ, Linux/Windows aynı test sayısı, Windows/Linux'ta ATLANAN YOK (ci.yml:158-161; gateVerdict 397-404). → Platforma özgü
   test `{ skip: process.platform … }` KULLANAMAZ (kapı kırmızı); koşullu doğrulama yazılmalı.
3. CI YEŞİL ⇔ ci.yml koşusu tamam + her iş success + kapı işi var (kanit.mjs:343-356); başka iş akışları hükme girmez (kanit-araci.test.mjs testi).
4. Yalnız belge commit'i atanın hükmünü alır; kod commit'inin koşusu yoksa BELİRSİZ (kanit.mjs:311-330).
5. İmzalı paket yalnız temiz ağaç + YEŞİL CI (kanit.mjs:492-501; release.mjs:27-28; release.yml:114-117).
6. Gerçek programı AYRI süreçte açan test `HUKUK_LICENSE_URL=http://127.0.0.1:9` verir (lisans-servisi-izolasyonu.test.mjs:31-45).
7. `ci.yml` paths-ignore girdileri ÇİFT TIRNAKLI ve sırası BELGE_YOLLARI ile aynı (kanit-araci.test.mjs:222-224 `deepEqual`, `- "([^"]+)"` kalıbı).

---

##### 3. 2.4.4 maddeleri — dokunma noktaları

###### 3.1 E3 — gg243-dar-kontrol-gonderim D2 ön koşulu (CI #842)
**Yer**: `test/gg243-dar-kontrol-gonderim.test.mjs:311-337` (iki test: mode "all" ve "ids"). setup imzası :29 (`sendDelayMs, checkDelayMs, slowTaxNo, slowMs`),
sahte gecikme fetchImpl'de :40-42. D2 çağrısı: `setup({ sendDelayMs: 0, checkDelayMs: 0, slowTaxNo: "10000000146", slowMs: 800 })` (:313) — yalnız docs[0]'ın
(Ayşe Kaya) CheckUser'ı 800 ms; 6 belge aynı tarih (:315-316); B oturumu A'dan 100 ms sonra (:321). Ön koşul (:323-324):
`raced = items.filter(item => item.code === "einvoice-already-sent")` boş olmamalı.

**Ürün yolu** (`server/routes/invoices.mjs`): `sendInvoice` önce `holdInvoice(id,"sending")` (3385-3392; kilit 2842-2859; `sendInvoiceOnce` 3394) sonra `sendInvoiceOnce` ilk denetimi
"gönderilmiş → einvoice-already-sent" (3401). send-pending döngüsü (3755-3820): kilit tutuluysa `einvoice-sending` → `releasedWithin` 100 ms'lik yoklamayla bekler
(3732-3739; en çok max(2000, SEND_BUDGET_MS=10.000) ms, :138) → `sentElsewhere` → sonuç `{ ok, done, code: "einvoice-sending", message: ALREADY_SENT_TEXT }` (3783-3790);
kilit boş ve belge gönderilmişse `code: "einvoice-already-sent"` done (3794-3797).

**Neden ara sıra kurulamıyor (mekanizma — koddan çıkarım, CI günlüğünde DOĞRULANMADI)**: B, A'nın ARKASINDA yürür. B doc0'da kilide çarpar (`einvoice-sending`),
A doc0'ı bırakınca B en geç 100 ms sonra uyanır ve doc1'e geçer. A'nın belge başı süresi T ise: B uyandığında A doc1'i BİTİRDİYSE B "already-sent" (ön koşul ✓);
A hâlâ doc1'deyse B yine kilide çarpar ve sonuç kodu "einvoice-sending" olur (ön koşul sayılmaz). T ≥ ~100 ms (yük altındaki/yavaş koşucu) olduğunda B her belgede
A'yı gönderim ORTASINDA yakalar → `raced` hep boş → test kırmızı; ürün davranışı her iki yolda da doğru (ok + done + aynı ileti). Yani kırmızı TESTİN dar ön koşulu,
ürün değil (ders 20'deki senaryo-222 örüntüsü). CI #842'de hangi işin (Linux/Windows, all/ids) düştüğü yerelde okunamadı → "okunamadı" (ders 4);
ana oturum `mcp__github__get_job_logs` ile okuyabilir. Ek 7 testi (:518-535) her iki kodu kabul ettiği (`item.done`) için bu kırılganlıkta değil.

**Zorla kırmızı (ders 20, önce)**: D2'nin setup'ına ortam değişkeni: `sendDelayMs: Number(process.env.GG243_D2_ZORLA_YAVAS_MS || 0)` (T > 100 ms poll) →
`GG243_D2_ZORLA_YAVAS_MS=150 node --disable-warning=ExperimentalWarning --test --test-name-pattern "D2" test/gg243-dar-kontrol-gonderim.test.mjs` mevcut testte
ön koşulu HER SEFER kırmızı vermeli (beklenen; DOĞRULANMADI — koşulmadı). Kayıt: `node tools/kanit.mjs kos d2-zorla-kirmizi -- …`. (Emsal: CLAUDE.md "AÇIK 15.10"
`GUNCELLEME_S2_ZORLA_BOSLUK=1`.)

**Belirlenimci yapma (önerilen en küçük, yalnız test)**: zamanlamaya değil OLAY sırasına bağla:
1. setup'a isteğe bağlı kapı: fetchImpl `SendInvoiceRequest` sayacı; **2. SendInvoice çağrısı** geldiğinde (A doc0'ı bitirmiş, doc0 veri tabanında gönderilmiş —
   döngü sıralı, 3777 `await` bitmeden sonraki belgeye geçmez) bir `firstDone` sözünü çözer ve A'yı bir `gate` sözünde bekletir (A doc1'i kilitli tutar).
2. Test: `const pa = ctx.api.post(...A...)`; `await firstDone`; `const pb = other.post(...B...)`; `setTimeout(gate.release, 300)` (değer kritik değil:
   B doc0'da KESİN already-sent görür; doc1'de bekler ya da bitmiş bulur — her iki sonuç geçerli; 300 ms ≪ releasedWithin 10 s, bu yüzden "busy" sonucu oluşmaz).
3. Ön koşul güçlenir: `assert.ok(raced.some(x => x.id === docs[0].id))` (B'nin doc0 sonucu already-sent). slowTaxNo/sleep(100) kalkar. Diğer iddialar aynen
   (:325-336; "her belge EDM'ye bir kez" = 6, ileti ezilmez).
4. Ön koşulun GERÇEKTEN oluştuğu, `GG243_D2_ZORLA_YAVAS_MS` = 0 / 150 / 400 ile yeşil görülür (ders 20: yeşil yalnız ön koşul oluşan denemede sayılır).
5. Testin dişi (ders 7, 23): yeni test D2 düzeltmesinden ÖNCEKİ kodda kırmızı — o commit sığ depoda yok (master 163dd5d squash); `origin/claude/hopeful-goodall-6nmtcj`
   squash öncesi geçmişi taşır (docs/DURUM-VE-DEVAM.md "DAL DURUMU"). `git fetch --unshallow` + `git log -S "Dar kontrol 2.4.3 (D2)" -- server/routes/invoices.mjs`
   ile düzeltme commit'i bulunur; ebeveyni `git worktree add <benzersiz-klasör>` ya da `git archive | tar -x` ile ayrı kopyada koşulur (ders 23, 25). DOĞRULANMADI.
Risk: kapı sözü serbest bırakılmazsa A sonsuza dek bekler → `finally { gate.release() }` + test zaman aşımı. Para-numara çekirdeğine (ürün) dokunulmaz → ders 32 kapsamı dışı (yalnız test).

###### 3.2 E8 — detay kartı "Tahsilat" düğmesi (test tarafı)
Ürün: düğme `client/assets/hof-workspace.js:1212` (`data-case-action="payment" data-requires="payments.create"`); tıklama `actions.payment` (:255-279) ÜÇ dala gider:
(1) etkin taksit kartı → `openPlanCollect` taksit seçici (:79-114, :262-264); (2) kayda bağlı cari → `HOF.accounts.collect` (:268-275); (3) `paymentForm` → `POST
/api/workspace/cases/:key/payments` (:35-73, :65; sunucu server/routes/workspace.mjs:392-430, yetki payments.create, tutar `parseAmount`, tarih boşsa bugün).
CSS: `html.hof-no-tahsilat [data-case-action="payment"] { display:none !important }` (hof-ui.css:2121-2125; sınıf hof-insight.js:114). Düğme DOM'da kalırsa
yetki-gorunurluk.test.mjs etkilenmez. Şerit/bildirimden açılan aynı form (`HOF.workspace.payment`, hof-workspace.js:1374; çağıranlar hof-alerts.js:285, hof-promises.js:138)
ve kartın TAKSİT PLANI kutusundaki "+ Tahsilat" / "₺" (`data-case-collect`, hof-workspace.js:126, 132, 178-190 → `HOF.plans.collect`) ETKİLENMEZ.

Düğmeye tıklayan e2e'ler (grep `hof-case-actions [data-case-action="payment"]`; başka seçici/yol YOK — `has-text("Tahsilat")`, genel `.hof-case-actions button` aranıp bulunmadı):

| # | Yer | Adım / neyi sınıyor | Önerilen yol (en küçük güvenli) |
|---|---|---|---|
| 1 | test/e2e/run.mjs:487-489 | "tahsilat işlenir (en altta), düzeltilir ve silinir; kasaya düşer…" — plansız/carisiz kayıt → paymentForm 1.250 "Elden" | API: `admin.evaluate` içinde `fetch('/api/workspace/cases/'+encodeURIComponent(HOF.selectedCase().key)+'/payments', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({amount:'1.250', note:'Elden', method:'cash', caseTitle: HOF.selectedCase().title})})` → durum 200 + `app.store` ile payments satırı (ders 3) → `HOF.workspace.refreshActivity()` (hof-workspace.js:1246, 1374; canlı olay 1266 kendi oturumuna geliyor mu DOĞRULANMADI) → adımın kalanı (düzelt/sil, Kasa) aynen. |
| 2 | test/e2e/run.mjs:621-623 | "Plan yokken Tahsilat: eski pencere + **Taksit planı oluşturun** kısa yolu" (paymentForm offerPlan, hof-workspace.js:37, 50, 55-59) | Bu kullanıcı yolu kartta KAYBOLUR (şerit tutarla açar → offerPlan false). Kart formunu aynı çağrıyla aç: `HOF.plans.openNew({ caseKey: "2026/101", caseTitle, name, phone, registeredOn })` (kısa yolun çağırdığı işlev, :58) ya da Taksitler penceresinden kayıt seçerek (UI yolu DOĞRULANMADI). Kalan iddialar (caseKey, ad, is-linked) aynen. |
| 3 | test/e2e/run.mjs:644-650 | "Tahsilat → taksit seçici → 1. taksite Tahsil et → 1.000,00" | API'ye GEREK YOK: aynı işlev kartın TAKSİT PLANI kutusunda — `#hof-case-plan tbody tr:first-child [data-case-collect]` (₺) tıklanır → `HOF.plans.collect(plan,item)` (seçicideki "Tahsil Et" de aynısını çağırır, :113 ↔ :189) → `input[name="amount"]` "1.000,00" beklenir (aynı form; değer DOĞRULANMADI). |
| 4 | test/e2e/senaryo-banka-210b.mjs:213-238 | adım 1 "Kayıt tahsilatı 1.500 Havale/EFT → Banka Hesabı seçicisi (2 vadesiz + Hesapsız), seçilmeden kaydedilmez → Ziraat +1.500, Kasa aynı" | Seçici denetimini korumak için formu YAŞAYAN şerit yoluyla aç: `page.evaluate(() => HOF.workspace.payment({ key: "2026/501", title: "Ayşe Kaya", amount: 1500 }))` (fromStrip → doğrudan paymentForm) + iddialar aynen; ya da tümüyle API (`api.post("/api/workspace/cases/2026%2F501/payments", { amount:"1.500", method:"bank" })` hesapsız → 200 DEĞİL + bakiye aynı; `bankAccountId: ACC.z.id` → 200; sunucu hata metni DOĞRULANMADI) — seçenek listesi iddiası (:224-226) o zaman kalkar. |
| 5 | test/e2e/senaryo-cari-243.mjs:170-185 | "Kayıttan tahsilat: yeni (boş) cariye değil kaydın kendi defterine" 321 | API: `must("tahsilat", api.post("/api/workspace/cases/2026%2F100/payments", { amount: "321", method: "cash" }))` + iddialar aynen (yeni cari 0, payments 321, No 1 değişmedi). Not: istemci dallanması (accounts.forCase) artık karttan ulaşılamaz; iddia sunucu tarafını sınar. |
| 6 | test/e2e/senaryo-cari-243.mjs:187-216 | "A1 + A2: öneriden bağlanır; kayıttan tahsilat cariye, İşlem Geçmişi'nde ve raporda" 500 | Kullanıcının kalan yolu Cari Kartı: `page.evaluate(id => HOF.accounts.open(id), mehmet.id)` → `${accWin} [data-entry="in"]` (+ Tahsilat, hof-accounts.js:360, 1531) → 500 → Enter. "formda hangi cari" iddiası (:207-209) cari penceresinde anlamını yitirir → kaldır/uyarla. Defter 500 (:213), kayıt 2026/101 seçilip İşlem Geçmişi "500,00 cari tahsilatı" (:214-216), rapor "Kayıt Kartından Tahsilatlar" (:217-219) — rapor bağlı carinin TÜM `in` hareketlerini alır (report-center.mjs:2560-2570), bu yüzden yeşil kalmalı (DOĞRULANMADI). |

Yeni denetim (eski kodda kırmızı — ders 7): run.mjs'de tahsilat modülü AÇIKKEN (`HOF.modules.tahsilat === true`)
`getComputedStyle(document.querySelector('.hof-case-actions [data-case-action="payment"]')).display === "none"` + düğme DOM'da var (CSS-only kanıtı) — emsal run.mjs:1216
(klinikte Haciz). Eski kopyada (ders 23) kırmızı görülür. Beklentisi değişen her e2e koşulur (ders 28): run.mjs, senaryo-banka-210b, senaryo-cari-243 + bütün e2e (ders 35).
Etkilenmeyen: senaryo-iz5-230, form-izolasyon-243, e2e-not-yaris (yalnız note/phone/task).

###### 3.3 H — docs/2.4.4-IS-LISTESI.md'yi BELGE_YOLLARI'na ekleme (üç yer, aynı sıra) — YAPILDI 21.10.2026 (docs/erp/** ile birlikte)
1. `tools/kanit.mjs:297` → `"docs/2.4.3-IS-LISTESI.md",` ardına `"docs/2.4.4-IS-LISTESI.md",`.
2. `.github/workflows/ci.yml:13` ardına `      - "docs/2.4.4-IS-LISTESI.md"` (6 boşluk, ÇİFT tırnak; sıra = BELGE_YOLLARI; ci.yml:6-7 yorum).
3. `test/kanit-araci.test.mjs:220-226` liste aynılığını zaten denetler (değişiklik ZORUNLU değil); önerilen ek iddia :218 yanına
   `assert.equal(yalnizBelge(["docs/2.4.4-IS-LISTESI.md"]), true);` (eski araçta kırmızı → testin dişi).
Ayrıca CLAUDE.md "Doğrulama kapısı → YALNIZ BELGE" paragrafındaki liste metni (belge). Kontrol: `npm test` içinde kanit-araci + ci-kapi-listesi (koşu ~20 dk; yalnız
`node --test test/kanit-araci.test.mjs test/ci-kapi-listesi.test.mjs` geliştirmede yeter). Not: `yalnizBelge` `docs/*-IS-LISTESI.md` jokerini DESTEKLEMEZ (298) —
her sürümde elle eklenir; istenirse joker desteği + GitHub `paths-ignore` jokeri birlikte (aynılık testi metin karşılaştırdığı için uyumlu kalır).

###### 3.4 Uzun Doğrulama'daki kâhin işleri
- `kahin_ebelge` (uzun-dogrulama.yml:123-147): önce `python3 test/bagimsiz/ebelge/test_model.py && python3 test/bagimsiz/ebelge/mutasyon.py` (kâhinin dişi), sonra
  5 tohum × 300 işlem, `--kucult --butce 25`, çıktı `kanit-cikti/kahin-ebelge` (bu JSON'lar kayıt sayılmaz: readRecords 418-421). Tek iş (matris değil).
  Kâhin dili "Tümünü Gönder (hepsi / seçili)" + eşzamanlı tur içerir (uretici.py:9, 69, 87-94) → E6 "Seçilenleri Gönder" ids yolunu kullanırsa kapsamda; "gönderimden ÖNCE söyle"
  ön denetimi yeni işlem türü ister (model.py + uretici + kosucu; temiz oda kuralı: modeli ürün kodunu görmeyen el yazar — ders 5).
  e-SMM (E1) kâhin dilinde YOK → ESM serisi için model/değişmez genişletmesi gerekir (I1/I2/I6/I13 seri bazlı).
- Defter kâhini (`test:kahin-defter`) Uzun Doğrulama'da YOK; elle koşulur.
- Mutabakat/güvenilirlik e-Belge'ye dokunmaz (para çekirdeği: kasa/banka/cari).
- Tetik: commit iletisinde `[uzun-dogrulama]` (yalnız son adayda, CLAUDE.md Verimlilik). 24 iş + kapı; ~6 saatlik iş sınırı (timeout 345 dk, `--sure 330`).

---

##### 4. Yerelde test koşma reçetesi (bu kapsayıcı; komutlar KOŞULMADI)
Ön durum (okundu): Node v22.22.0 (engines ≥22.13), 4 CPU, 15 GB bellek, `/` 30 GB boş (ders 24 eşiği ~5 GB ✓), `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`
(`chromium-1194`, `chromium_headless_shell-1194`); genel playwright 1.56.1 `/opt/node22/lib/node_modules`; depo playwright 1.56.0 (package-lock.json:436-450)
— aynı tarayıcı sürümünü kullanması beklenir, DOĞRULANMADI; `node_modules` YOK.
1. `cd /home/user/ofis---y-netimi && df -h /` (ders 24).
2. Etiketler + tam geçmiş: `git fetch --unshallow --tags origin` (yerelde 0 etiket: `tagsAvailable` olan testler ATLANIR — banka-210-dun-bugun.test.mjs:32, banka-210-gg-*.test.mjs,
   banka-220-senet-121.test.mjs:371 …; senaryo-banka-210-temel adım 10 GERÇEK v2.0.23 ister). Atlanan > 0 iken yerel koşu "GEÇTİ" sayılsa da CI eşdeğeri değildir.
3. `npm ci` — node_modules'ü genel klasöre BAĞLAMA (ders 29). Tarayıcı kurulu değilse `npx playwright install chromium` (ağ; DOĞRULANMADI gerekip gerekmediği).
4. `npm run check` (tools/check-syntax.mjs; "N/N dosya sözdizimi denetiminden geçti").
5. Geliştirmede yalnız değişen alan: `node --disable-warning=ExperimentalWarning --test test/<dosya>.test.mjs` (ör. `--test-name-pattern "D2"`).
6. Bitişte bir kez: `node tools/kanit.mjs kos npm-test-244 -- npm test` (~17–26 dk).
7. e2e: `node tools/kanit.mjs kos e2e-<ad> -- npm run test:<ad>`; run.mjs ~145 sn, senaryo-banka-210 ~280–410 sn, CI'deki tüm e2e sırayla ~55 dk (docs/kanit/2026-10-18/cekirdek-243
   49 kayıt toplamı); CI DIŞI 13 betik + ui-ux-217 (~180 sn) ders 8 gereği elle. Yavaş makine: `HOF_CPU_YAVASLAT=4 node --import ./test/e2e/cpu-yavaslat.mjs test/e2e/<s>.mjs`.
   Soru günlüğü: `ESC_KAPAT_GUNLUK=/…/esc.jsonl`. Ölçümler tek tek (ders 15); başkasının sürecini öldürme (ders 36).
8. Toplu özet: `node tools/kanit.mjs ozet docs/kanit/<gün>` (biri geçmediyse çıkış 1). CI: `node tools/kanit.mjs ci <sha> --bekle <dk>` (gh gerekir).

---

##### 5. Sürprizler / kör noktalar
1. **E9 için güçlü iz (DOĞRULANMADI)**: `windows.yml` install-test GERÇEK kurulumu servis olarak açar (windows.yml:55-68); servis ortamına yalnız
   `HUKUK_INSTALL_ROOT, NODE_ENV, NODE_OPTIONS` verilir (packaging/windows/bin/servis-kur.cmd:58) → `HUKUK_LICENSE_URL` YOK → program varsayılan
   `https://destek-ofis.vercel.app/api/lisans` (server/lib/license.mjs:33) ile 3 sn sonra kendiliğinden deneme (license.mjs:229-230, 536-604) dener.
   `test/guncelleme-gercek/windows-kurulum.mjs:123-127` sınama sürümlerini kurulu sürümden türetir: 2.4.3 → next 2.4.4, **next2 2.4.5** (W3'te servis 2.4.5 ile çalışır),
   next3 2.4.6. 2.4.3 master birleşmesi 163dd5d 19.10.2026 14:24 TR → windows.yml (push master) → "SON 19.10 15:30 TR" ile uyumlu; makine kimliği Windows
   MachineGuid (license.mjs:37) — koşucu imajında aynı olabilir (tek kayıt). `lisans-servisi-izolasyonu.test.mjs` yalnız `test/` .mjs tarar (:25), iş akışlarını ve
   Inno kurulumunu görmez. Kapatma önerisi: kurulumdan ÖNCE hosts dosyasına `127.0.0.1 destek-ofis.vercel.app` (servis SCM ortamı makine ortam değişkenini yeniden
   başlatmadan görmez — Windows davranışı, DOĞRULANMADI) + iş akışlarını tarayan izolasyon denetimi. Bu madde başka ajanın (lisans) alanında; yalnız bulgu.
2. D2 testi ürünün iki doğru yolundan yalnız birini ön koşul sayıyor (3.1) — zamanlamaya bağlı kırmızının kökü bu.
3. E8 yalnız CSS ile yapılırsa: (a) "Taksit planı oluşturun" kısa yolu ve kayda bağlı cariye "kayıttan tahsilat" dalı karttan ulaşılamaz olur (ürün kaybı — kullanıcıya
   söylenmeli); (b) "Kayıt Kartından Tahsilatlar" raporunun adı/açıklaması (report-center.mjs:2552-2555) anlamını yitirir; (c) kılavuz `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html`
   "Kartın düğmeleriyle Not, Telefon, Tahsilat…" ve "kişinin kartındaki Tahsilat taksitlerini gösterir" cümleleri değişmeli (PDF + site PR'ı); (d) boş geçmiş metni
   `tools` listesi JS'te (hof-workspace.js:1178-1179, 1200) — "yalnız CSS" ile düzelmez; tek satır JS (tahsilat'ı listeden çıkar) gerekir.
4. release.yml `test` işi testleri kanıt aracı OLMADAN koşar (release.yml:39-92) — sonuç yalnız çıkış koduyla; kapı publish'te ci.yml'den okunur (114-117).
5. Yerel depo sığ + etiketsiz → yerel npm test eski-sürüm testlerini atlar; teslim kaynağı paketi için de `--unshallow` şart (CLAUDE.md).
6. Yeni Windows'a özgü test (E7 Edge/başlatıcı) `skip` ile yazılırsa kapı `--atlanan-yok`/`--ayni-sayi` yüzünden KIRMIZI olur (ci.yml:160-161).

##### 6. Açık sorular
- CI #842 b68aafe'de kırmızı olan iş hangisi (Linux/Windows, Node, D2 all/ids)? Günlük okunmadı.
- D2 düzeltmesinden önceki commit (kırmızı kanıt için) hangisi? `origin/claude/hopeful-goodall-6nmtcj` geçmişinde aranmalı.
- E8: run.mjs:622 "Taksit planı oluşturun" kısa yolunun kaybı kullanıcıya kabul ettirildi mi; rapor adı/kılavuz değişsin mi?
- E8: banka-210b adım 1 için seçici denetimi şerit yoluyla korunsun mu, yoksa tümüyle API mi?

### EK-6 lisans-sizinti

#### Alan haritası: lisans-sizinti (E9 — testlerin gerçek lisans servisine sızması)

Hazırlayan: alt ajan, SALT OKUMA (21.10.2026). Depo: /home/user/ofis---y-netimi, dal claude/youthful-euler-fl8ks4, HEAD cbcedb0 (ürün kodu = 2.4.3, master 163dd5d).
Hiçbir depo dosyası değişmedi; ağa istek atılmadı; test koşulmadı. Yardımcı salt-okuma tarama betikleri:
`/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/hakimiyet-244/lisans-araclar/tarama.mjs` (bugünkü taramayla geniş taramanın farkı) ve
`/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/hakimiyet-244/lisans-araclar/createapp-cagri.mjs` (aynı süreçte createApp çağrılarının lisans güvencesi).

---

##### 0. SONUÇ (kısa)

**"2.4.5" + Azure kaydını üreten: `.github/workflows/windows.yml` → `install-test` işi (GitHub Windows koşucusu).** Bu iş GERÇEK kurulum paketini
(`DestekOfis-Kurulum-*.exe`) sessiz kurar; kurulum `nssm` ile Windows servisi açar. Servisin ortamı yalnız
`packaging/windows/bin/servis-kur.cmd:58` `AppEnvironmentExtra "HUKUK_INSTALL_ROOT=…" "NODE_ENV=production" "NODE_OPTIONS=--use-system-ca"`
ile kurulur → **HUKUK_LICENSE_URL servise HİÇ ulaşmaz** (adımın `env:`'i Windows servisine geçmez; servisler SCM ortamıyla açılır).
Program `server/lib/config.mjs:60` varsayılanına düşer: `server/lib/license.mjs:33` `https://destek-ofis.vercel.app/api/lisans`;
açılıştan 3 sn sonra kendiliğinden deneme (`license.mjs:536–559, 604`) → gerçek Operatör Merkezi'ne Azure (GitHub Actions) adresli kurulum.

**"2.4.5" dizesi depoda YOKTUR** (grep: yalnız CLAUDE.md:413 ve docs/DURUM-VE-DEVAM.md:39). Çalışan bir "2.4.5" programını üretebilen TEK kod:
`test/guncelleme-gercek/windows-kurulum.mjs:123–127`:
```js
const installed = current.version;                       // kurulu sürüm (19.10: 2.4.3)
const [major, minor, patch] = installed.split("-")[0].split(".").map(Number);
const next = `${major}.${minor}.${patch + 1}`;           // 2.4.4  (W2'de kurulur)
const next2 = `${major}.${minor}.${patch + 2}`;          // 2.4.5  (W3'te kurulur, W4 boyunca dakikalarca ÇALIŞIR)
const next3 = `${major}.${minor}.${patch + 3}`;          // 2.4.6  (W4'te geri çekilir, hiç çalışmaz)
```
Bu betik yalnız windows.yml:150'den çağrılır (`node tools/kanit.mjs kos windows-guncelleme-gercek -- node test/guncelleme-gercek/windows-kurulum.mjs C:\DestekOfis …`).
windows.yml tetikleyicileri: master'a push, workflow_dispatch, workflow_call (windows.yml:3–8); release.yml:94–97 her `v*` etiketinde onu çağırır.
19.10: 2.4.3 master'a 14:24 TR (163dd5d) + v2.4.3 etiketi → windows.yml en az iki kez; "SON 19.10 15:30 TR" bu koşuların W4 süresine uyar.

Neden kayıttaki son sürüm 2.4.5 (2.4.3 değil): belirteç varken program her açılışta 30 sn sonra `/v1/check` atar
(`license.mjs:226 firstCheckDelayMs = 30_000`, `:596–605 start()`, `:413 callService("/v1/check")`, gövdede `version` `:371`).
W3/W4'te 2.4.5 dakikalarca yaşar (W3 6 dk'ya kadar bekleme `windows-kurulum.mjs:273–277`, W4 `:325–345`) → 2.4.5 ile check gider. Sonra eski hâle dönüş
(`:385–392`) ve sonraki adımlardaki 2.4.3 açılışları (yeniden kurulum, kaldırma — setup.iss:309–317 PrepareToInstall servisi hemen durdurur) büyük olasılıkla
30 sn dolmadan kapanır → kayıt 2.4.5'te kalır. (Zamanlama çıkarımı; günlükle DOĞRULANMADI.)

Sızıntının yaşı: kendiliğinden deneme 25.09.2026 17:54 UTC (171ba63) eklendi; windows.yml'deki "CI (Windows)" düzeltmeleri aynı gün 19:12–19:39 UTC
(6ae5dd8, bbcfa1e, 40aed5f, d6e715f). Operatör Merkezi'ndeki diğer Azure kaydı "2.0.12 (25–30.09)" bununla örtüşür (kurulu sürüm; windows-kurulum.mjs o
tarihte yoktu — 2.1.0/7c6405f'de eklendi). Yani **windows.yml install-test, kendiliğinden deneme geldiğinden beri her koşuda sızıyor**; 210ac8e (15.10) bu yolu
hiç görmedi.

---

##### 1. Mimari (dosya:satır)

1. Varsayılan servis adresi: `server/lib/license.mjs:33` `DEFAULT_LICENSE_SERVICES = ["https://destek-ofis.vercel.app/api/lisans"]` (yorum :31–32: yanıtlar imzalı,
   adres değişikliği güveni zayıflatmaz).
2. Adres seçimi: `server/lib/config.mjs:24` `env = { ...process.env, ...overrides.env }`; `:60` `licenseServices: overrides.licenseServices ?? env.HUKUK_LICENSE_URL ??
   DEFAULT…`. Boş dize "" ise `??` düşmez → `endpoints()` boş → `NO_SERVICE` (güvenli).
3. Hizmetin kurulumu: `server/app.mjs:216–231` `createLicenseService({ …, services: config.licenseServices, fetchImpl: config.fetchImpl, …licenseOptions })` —
   `overrides.license` en sonda yayılır (services/fetchImpl/enforce/machineId testlerden ezilebilir). Bu iki satırın metni
   `test/vekil-sunucu-uygulama.test.mjs:210` ile sabitlenmiş (değiştirilmez).
4. Zamanlayıcılar: `server/app.mjs:561` `if (overrides.startLicenseTimers !== false && !hub) license.start();`; kapanış `:740` `license.stop()` (close içinde ilk
   `await`'ten önce, eşzamanlı). Çocuk şirketler `:436` `startLicenseTimers: false` + hub lisansı.
5. Kendiliğinden deneme: `license.mjs:229–230` `autoTrial = true`, `autoTrialDelaysMs = [3_000, 2 dk, 10 dk]` sonra `retryMs` 30 dk; `:536`
   `shouldAutoTrial = enforce && autoTrial && !token && local.transitionStart == null`; `:538–559` zamanlayıcı → `startTrial({}, null)` (`:445–468`) →
   `callService("/v1/activate", { kind: "trial", office })`.
6. Doğrulama: `:588–595` `scheduleCheck(firstCheckDelayMs=30 sn)`; belirteç varsa `/v1/check` (`:404–443`), sonra 12 sa'de bir (`:224`).
7. İstek gövdesi: `:368–373` POST `{ product, version, machine, instanceId, …body }`, `user-agent: DestekOfis-Lisans/<sürüm>`, 15 sn zaman aşımı.
   Ağ hatası metni `:190–196` (ECONNREFUSED → "Lisans servisine ulaşılamadı (ECONNREFUSED).").
8. Bilgisayar kimliği: `server/lib/machine.mjs:16–20` Windows'ta `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` → `:14` SHA-256 özeti; Linux `/etc/machine-id`.
   Lisans servisi denemeyi BİLGİSAYARA bağlar (docs/LISANS.md:116–117 "Varsa aynı deneme döner … bilgisayar başına bir deneme"; başvuru servisi
   `tools/lib/license-service.mjs:90–101` `trials[machine]`).
9. Yönetici özeti: `server/routes/license.mjs:11–14` `GET /api/license`; `license.mjs:619–656` yöneticiye `autoTrial: { attempts, lastError, lastAt }` (yalnız
   belirteç yokken), `state`, `licenseId`, `lastCheck` döner → NÖBETÇİ için kullanılabilir.
10. Salt okunur modda izinli yollar: `license.mjs:57–66` (`/api/auth/`, `/api/license`, `/api/admin/`, …); kapı `app.mjs:362` `license.assertWritable`.
11. Üretim girişi: `server/server.mjs:8` `createApp({ edocEnabled: true, edocLive: true })` — lisansa dokunmaz.
12. Servis yöneticisi: `server/supervisor.mjs:105` `env = { ...process.env, ...options.env }`; `:147–160` `spawn(node, server.mjs, { env: { ...env, PORT, HOST,
    HUKUK_DATA_DIR, … } })` — ortam olduğu gibi geçer (HUKUK_LICENSE_URL varsa korunur).
13. Windows kurulum kökü: `packaging/windows/bootstrap.mjs:72–77` `dataEnv()` (yalnız INSTALL_ROOT/BOOTSTRAP_VERSION/DATA/BACKUP), `:94` `startSupervisor({ installRoot,
    appDir })` — ortam = nssm'in verdiği. Dosyadan ortam okuma mekanizması YOK.
14. Windows servisi: `packaging/windows/bin/servis-kur.cmd:58` AppEnvironmentExtra (3 değişken); `setup.iss:309–317` PrepareToInstall `nssm stop`; `:398–411`
    servis-kur.cmd çağrısı + sağlık.
15. Başlatıcı (Go) sunucu açmaz: `launcher/platform_windows.go:69,75` yalnız tarayıcı/Edge `--app` açar.
16. Sunucuda başka alt süreç yok: `server/` içinde `spawn(` yalnız `supervisor.mjs:147`; diğerleri Worker (rapor, mutabakat taraması, analiz).

##### 2. Veri akışı (sızıntı yolu)

windows.yml install-test (windows-latest, Azure) → `Start-Process DestekOfis-Kurulum-*.exe /VERYSILENT /TYPE=sunucu` (windows.yml:55–68) → Inno Setup →
`servis-kur.cmd` (AppEnvironmentExtra :58, `nssm start` :104) → `bootstrap.mjs servis` → `startSupervisor` → `server.mjs` (env'de HUKUK_LICENSE_URL YOK) →
`config.licenseServices` = gerçek adres → +3 sn `/v1/activate` (version = kurulu sürüm, machine = MachineGuid özeti) → lisans servisi bu bilgisayar için
denemeyi oluşturur / aynısını döner → belirteç veri tabanına (`license.mjs:300–304`) → sonraki her servis açılışında +30 sn `/v1/check` (version = o an çalışan
sürüm). windows-kurulum.mjs W2 (2.4.4), W3–W4 (2.4.5) sürümleri aynı veri tabanını ve belirteci kullanır.

##### 3. 9.0.0 kaçağı ve 210ac8e (15.10) neyi kapattı

- 210ac8e YERELDE YOK (sığ klon; çalışma dalları squash ile master'a girdi; `git cat-file -t 210ac8e` → "Not a valid object name"). İçerik 2.3.0 squash'ında
  (ec1ef3f) okundu (`git show ec1ef3f -- <dosyalar>`): HUKUK_LICENSE_URL=http://127.0.0.1:9 eklendi →
  `test/update-flow.test.mjs:67` (supervise env), `test/supervisor.test.mjs:39,146`, `test/yedek-220.test.mjs:567`, `test/packaging.test.mjs:94,122,328`,
  `test/guncelleme-gercek/hizmet.mjs:37`, `test/guncelleme-gercek/ortak.mjs:192` (+ S2 ping tanılaması aynı commit'te); yeni `test/lisans-servisi-izolasyonu.test.mjs`
  (45 satır). Kanıt `docs/kanit/2026-10-15/lisans-izolasyon-{kirmizi,yesil,komsu,hizmet}.*`. Karar: GECMIS-KARARLAR.md:1780–1785 ("3 kayıt DURUR; önlem yalnız
  testlerde; ürün kodu değişmedi").
- 9.0.0 kayıtları: GECMIS-KARARLAR.md:1780–1781 — 30.09 7b44b046…, 12.10 38efc2d5…, **15.10 07:04 UTC db54a00b…**. 9.0.0'ı makeVersion ile paketleyen testler
  (update-flow, guncelleme-gercek, packaging) ci.yml'in Windows `npm test`'inde gerçek programı açıyordu.
- **"2.4.5" kaydının ilk görülmesi "15.10 10:04 TR" = 07:04 UTC = db54a00b ile AYNI DAKİKA.** Güçlü çıkarım: aynı kayıt. Lisans servisi kaydı bilgisayar
  kimliğine bağlıyor; GitHub'ın aynı imaj sürümünden açılan Windows VM'leri aynı MachineGuid'i taşıyorsa (sysprep MachineGuid'i yenilemez — DOĞRULANMADI) ci.yml
  Windows npm testi (9.0.0) ve windows.yml install-test aynı kaydı günceller. 210ac8e npm-test raporlarını kesince kaydın sürümünü yalnız windows.yml çevirmeye
  devam etti → 16–19.10 sürümleri (2.3.x, 2.4.x) → son 2.4.5. DOĞRULANMADI: events tablosunda sürüm geçmişi okunmalı (aşağıda §7).
- 210ac8e'nin kör noktaları (koddan):
  1. Tarama yalnız `test/` altında ve yalnız `.mjs` (lisans-servisi-izolasyonu.test.mjs:15–25). `.github/workflows/*.yml`, `packaging/`, `tools/` taranmaz.
     Kırmızı kanıt (kirmizi.log) 8 dosya listeliyordu — `tools/build-windows.mjs` dahil (yanlış pozitif: "bootstrap.mjs" dizesi + windres/go execFileSync);
     işlenen test `test/`'e daraltıldı (KANIT 2.3.0:31 "7 dosya"). Yani işlenen hâlinin kırmızısı ayrıca görülmedi.
  2. Desen yalnız Node süreç başlatmayı arar (:13 STARTERS + :28 spawn/fork/execFile). Windows SERVİSİNİ kurulum paketiyle başlatan yol (Start-Process exe,
     nssm, Restart-Service) desende yok. windows-kurulum.mjs `Restart-Service DestekOfis`'i `execFileSync("powershell", …)` ile yapar ama STARTERS'a uymaz →
     taranmaz.
  3. HUKUK_LICENSE_URL denetimi DOSYA düzeyinde `includes` (:33): aynı dosyada bir korunmuş, bir korunmamış başlatıcı varsa geçer.
  4. Aynı süreçte `createApp` (enforce varsayılan true, zamanlayıcı açık) taranmaz.
  5. Ders 30 metni "supervisor, bootstrap.mjs, server.mjs; sahte sürüm paketleri" diyor; "kurulum paketi + Windows servisi" yok.
- BENZETİM ↔ GERÇEK ASİMETRİSİ (ders 14/18): Linux kuru koşusu `test/guncelleme-gercek/windows-kuru.mjs:63` sahte servis denetimi servisi
  `HUKUK_LICENSE_URL=http://127.0.0.1:9` ile başlatır → benzetim yalıtılmış; gerçek Windows servisi (servis-kur.cmd:58) yalıtılmamış.

##### 4. Gerçek programı açan BÜTÜN yollar — envanter (koddan)

Ayrı süreç (HUKUK_LICENSE_URL var — güvenli): `test/supervisor.test.mjs:39,146`, `test/update-flow.test.mjs:67`, `test/yedek-220.test.mjs:567`,
`test/packaging.test.mjs:94,122,328`, `test/guncelleme-gercek/hizmet.mjs:37` (fork eden `ortak.mjs:192`; kullanan `test/guncelleme-gercek.test.mjs`,
`test/e2e/guncelleme-gercek.mjs:84`), `test/guvenilirlik/surumler.mjs:100` (1.x süreç), `test/yedek-hizmet-yaris.mjs:55`, `test/guncelleme-gercek/windows-kuru.mjs:63`.
Python kâhinler: `test/bagimsiz/ebelge/fark.py:79` → `kosucu.mjs:127–134` (startTestServer + URL); `test/bagimsiz/fark.py:69` yalnız Python modelleri.
Aynı süreç createApp (enforce false ya da sahte servis — güvenli): `test/helpers.mjs:23–24` (varsayılan enforce:false + zamanlayıcı kapalı) ve onu kullanan her
test/e2e; `test/e2e/run.mjs:47` (sahte servis `https://lisans.test` + fetchImpl), `:49` unlicensed; `test/guvenilirlik/surumler.mjs:16,72`; tools/olcek-210.mjs:76–88,
kapi-olcum.mjs:75–76, banka-hareket-olcum.mjs:71–72. Birim: `test/license.test.mjs:190` sahte fetch.
Gizli (korunmasız ama pratikte zamanlayıcı ateşlenmeden kapanan) — createapp-cagri.mjs çıktısı:
- `test/update-flow.test.mjs:49` tohum createApp: lisans seçeneği yok, `startLicenseTimers` yok; `await import(passwords)` sonra `app.close()` (3 sn'den kısa).
- `tools/mutabakat.mjs:63` (`npm run mutabakat`, package.json:83): seçenek yok; arada yalnız eşzamanlı iş (integrity.run, ledger.check), close'da license.stop.
Korunmasız (GERÇEK SIZINTI): **`.github/workflows/windows.yml` install-test** (+ release.yml:94–97 üzerinden). windows-kurulum.mjs bu servisin yeniden başlatıcısıdır.
Elle/ajan yolları (taranmaz; CI'de yok): `package.json:11` `npm start`, `:12 start:local`, `:87 start:service`, `start-server.cmd`, `test-central.sh` (BASE'e bağlanır,
sunucu açmaz). Bir ajan kapsayıcıda `npm start` koşarsa gerçek servise gider (Azure değil, kapsayıcı adresi) — ders 30 kapsamı dışında, BİLİNEN SINIR.
Uzun Doğrulama (uzun-dogrulama.yml:37,61,96,120–122): test:mutabakat → startTestServer; test:guvenilirlik → surumler (güvenli); kahin-ebelge → kosucu (güvenli).
ci.yml e2e/test işleri: hepsi yukarıdaki güvenli yollar.

##### 5. Değişmezler

- Üretim varsayılanı gerçek adres kalır (license.mjs:33); test yalıtımı için ÜRÜN KODU değişmez (kullanıcı kararı 15.10: "basit işler için kod tabanına dokunmayalım";
  önlem testlerde/iş akışında).
- HUKUK_LICENSE_URL önceliği config.mjs:60; app.mjs:226–227 metni (vekil-sunucu-uygulama.test.mjs:210).
- Operatör Merkezi kayıtları SİLİNMEZ (15.10 kararı; DURUM-VE-DEVAM.md:59 "YALNIZ OKUMA").
- Kendiliğinden deneme yalnız enforce && autoTrial && belirteç yok && geçiş dönemi yok (license.mjs:536).
- helpers.mjs varsayılanı enforce:false + zamanlayıcı kapalı (testler lisanslı gibi).
- windows.yml'deki adımlar yalnız salt-okunurda izinli yolları kullanır (/api/auth, /api/admin, GET) → lisans "none" (salt okunur) durumda da çalışmalı.

##### 6. 2.4.4 dokunma noktaları ve önerilen en küçük güvenli uygulama

###### E9a (ZORUNLU) — windows.yml: kurulumdan ÖNCE lisans servisi adlarını makine düzeyinde ölü adrese yönlendir
Yer: `.github/workflows/windows.yml` install-test, `download-artifact` (:50–53) ile "Sessiz sunucu kurulumu" (:55) ARASINA yeni adım. Ürün kodu değişmez.
Ad listesi kaynaktan türetilir (kayma olmasın): checkout + setup-node bu işte zaten var (:46–49); license.mjs'in içe aktarma zinciri yalnız node yerleşikleri
(http.mjs, license-keys.mjs içe aktarma içermez; license-token.mjs node:crypto; machine.mjs node:*) → `npm ci` gerekmez.
Taslak (PowerShell):
```yaml
      # Ders 30 (2.4.4 E9): kurulan Windows servisi (nssm) bu adımların ortamını ALMAZ (servis-kur.cmd:58); HUKUK_LICENSE_URL verilemez.
      # Lisans servisinin adları kurulumdan ÖNCE yerel ölü adrese yönlendirilir; engelin tuttuğu burada doğrulanır.
      - name: Lisans servisi bu koşucudan erişilemez (ders 30)
        run: |
          $names = node --input-type=module -e "const m = await import('./server/lib/license.mjs'); console.log(m.DEFAULT_LICENSE_SERVICES.map(u => new URL(u).hostname).join(' '))"
          if (-not $names) { throw 'lisans servisi adları okunamadı' }
          $hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
          foreach ($n in $names.Split(' ')) { Add-Content -Path $hosts -Value "127.0.0.1 $n"; Add-Content -Path $hosts -Value "::1 $n" }
          Clear-DnsClientCache
          foreach ($n in $names.Split(' ')) {
            $ips = [System.Net.Dns]::GetHostAddresses($n) | ForEach-Object { $_.ToString() }
            if ($ips | Where-Object { $_ -ne '127.0.0.1' -and $_ -ne '::1' }) { throw "$n engellenemedi: $($ips -join ', ')" }
            "$n -> $($ips -join ', ')"
          }
```
Etki: program +3 sn'de ECONNREFUSED alır, `autoTrial.lastError` "Lisans servisine ulaşılamadı (ECONNREFUSED)." olur, belirteç yok → lisans "none" (salt okunur).
release.yml:97 windows.yml'i çağırdığı için yayın koşuları da kapanır.

###### E9b — windows.yml NÖBETÇİ: kurulu program lisans servisine ULAŞAMADI mı?
Yer: "İlk giriş yalnızca yerelden; parola değişimi ve veri kaydı" (:101–112) adımından SONRA (parola artık Windows-Testi-2026).
```yaml
      - name: Kurulu program lisans servisine ulaşmadı (ders 30 nöbetçisi)
        run: |
          $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
          Invoke-WebRequest -Method Post -Uri http://127.0.0.1:5123/api/auth/login -ContentType 'application/json' -Body '{"username":"admin","password":"Windows-Testi-2026"}' -WebSession $s | Out-Null
          for ($i = 0; $i -lt 30; $i++) { $lic = ((Invoke-WebRequest -Uri http://127.0.0.1:5123/api/license -WebSession $s).Content | ConvertFrom-Json -AsHashtable).data; if ($lic.autoTrial.attempts -ge 1) { break }; Start-Sleep 1 }
          $lic | ConvertTo-Json -Depth 4
          if ($lic.state -ne 'none') { throw "Kurulu program lisans servisine ULAŞTI (durum $($lic.state)); gerçek Operatör Merkezi'ne kayıt düştü" }
          if (-not ($lic.autoTrial.lastError -match 'ulaşılamadı|çözülemedi|Güvenli bağlantı|zamanında yanıt')) { throw "Beklenen ağ hatası yok: $($lic.autoTrial.lastError)" }
```
İsteğe bağlı: "Günlükler" adımında (:208–212) `Select-String servis.log 'deneme|Lisans durumu'` satırları da yazılsın (kısa günlükte görünür kanıt).

###### E9c — tarama testini genişlet (test/lisans-servisi-izolasyonu.test.mjs)
1. Yeni test: `.github/workflows/*.yml` içinde Windows kurulum paketini kuran ya da servisi başlatan iş (desen: `DestekOfis-Kurulum`, `Start-Process $setup`, `nssm`,
   `Restart-Service DestekOfis`, `Start-Service DestekOfis`, `windows-kurulum.mjs`) varsa aynı dosyada "Lisans servisi bu koşucudan erişilemez" adımı bulunmalı,
   `DEFAULT_LICENSE_SERVICES`'i okumalı (ya da her ad açıkça yazılmalı) ve İLK kurulum çağrısından ÖNCE gelmeli (metin konumu). `uses: ./.github/workflows/windows.yml`
   çağıranlar (release.yml:97) windows.yml'in geçmesine bağlanır. Satır bölme `/\r?\n/` (ders 27).
2. Yeni test: windows.yml'de nöbetçi (`/api/license` + `state -ne 'none'`) kurulumdan sonra var.
3. Mevcut test 1: tarama `tools/`'u da kapsasın; `tools/build-windows.mjs` gerekçeli istisna (paketi derler, programı açmaz — 15.10 kırmızısındaki yanlış pozitif).
   HUKUK_LICENSE_URL denetimini dosya düzeyinden ÇAĞRI düzeyine indir (her spawn/fork/execFile/startSupervisor çağrısının `env`'inde) — olmazsa en azından dosya düzeyi kalır.
4. Yeni test (aynı süreç): test/ ve tools/ altındaki her `createApp(` çağrısının seçeneği `enforce: false` | `startLicenseTimers: false` | `services:`/`licenseServices` |
   bilinen güvenli değişken (helpers, `baseOptions(`, `appOptions(`, `unlicensed`, `licenseOptions` — run.mjs:47–49) içermeli. Bugün kırmızı: update-flow.test.mjs:49,
   tools/mutabakat.mjs:63 (E9d ile yeşil). Sözdizim paren eşleştirmeyle (createapp-cagri.mjs'teki yaklaşım).
Kırmızı kanıt (ders 7): yeni testler BUGÜNKÜ ağaçta kırmızı (windows.yml'de engel yok; iki createApp) — eski ağaç `git archive` ile benzersiz klasörde (ders 23/25).

###### E9d — iki gizli korumasız createApp
- `test/update-flow.test.mjs:49`: seçeneklere `startLicenseTimers: false` (davranış değişmez: tohum yalnız kullanıcı ekler, init yine çalışır).
- `tools/mutabakat.mjs:63`: `startLicenseTimers: false` (mutabakat sonucu lisanstan bağımsız).

###### E9e (önerilen, ucuz ikinci kat) — bütün CI işlerinde koşucu düzeyinde engel
ci.yml `test` (Linux+Windows) ve `e2e`, release.yml `test`, uzun-dogrulama.yml işleri: ilk adım hosts engeli (Windows: yukarıdaki; Linux: `sudo tee -a /etc/hosts`) ya da
en azından iş düzeyi `env: HUKUK_LICENSE_URL: http://127.0.0.1:9`. Testlerin tek tek env disiplinine bağımlılığı kalkar. Tarama testi her işte adımı arar.
Not: `test/ci-kapi-listesi.test.mjs:12–13,62` ci.yml/release.yml/uzun-dogrulama.yml'i okur (e2e adım listesi) → yeni adım bu denetimleri bozmamalı; koşulup görülmeli.

###### E9f — doğrulama ve belge (ana oturum)
- Operatör Merkezi (YALNIZ OKUMA, kullanıcı onayıyla; Supabase `lvzaeekyovhquljzesye`, şema `lisans`): db54a00b… kaydının/olaylarının zamana göre sürüm geçmişi —
  beklenen: 9.0.0 (15.10 07:04 UTC) → 16–19.10 windows.yml koşu saatlerinde 2.3.x/2.4.x → son 2.4.5 (~19.10 12:30 UTC). Sütun adları önce `list_tables` ile okunur.
- GitHub: `gh run list --workflow windows.yml` (createdAt/headSha/event) — 19.10 koşularının saatleri kayıtla eşleşmeli; istenirse `mcp__github__get_job_logs` ile eski
  install-test günlüğünde "Lisans durumu: none → trial" satırı (servis.log kuyruğu "Günlükler" adımında basılıyor).
- Düzeltmeden SONRA bağımsız kâhin: windows.yml koşu saatlerinde o makine için YENİ olay olmamalı (gerçek servis = programdan bağımsız kâhin, ders 5).
- CLAUDE.md ders 30'a ek cümle önerisi: "Windows kurulum paketi/servisi (nssm) adım ortamını almaz → windows.yml kurulumdan önce lisans adlarını hosts ile ölü adrese
  yönlendirir + nöbetçi; tarama .github/workflows ve tools'u da kapsar (2.4.4; '2.4.5' = windows-kurulum.mjs next2)."
- Kayıtlar silinmez.

##### 7. Testler (eklenecek/güncellenecek) ve kanıt planı

- Güncellenecek: `test/lisans-servisi-izolasyonu.test.mjs` (E9c 1–4). Değişecek kaynaklar: windows.yml, update-flow.test.mjs:49, tools/mutabakat.mjs:63 (+ E9e seçilirse ci.yml,
  release.yml, uzun-dogrulama.yml).
- Kırmızı → yeşil: tarama testi eski ağaçta kırmızı (benzersiz klasör `lisans-sizinti-eski-cbcedb0`), yenide yeşil; `node tools/kanit.mjs kos …` ile docs/kanit/<gün>/.
- Gerçek platform (ders 18): windows.yml `workflow_dispatch` ile çalışma dalında İKİ yeşil koşu (engel adımı + nöbetçi + bütün eski adımlar). Kamuya açık depo → ücretsiz.
- ESKİ windows.yml'i kırmızı görmek için koşmak YAPILMAMALI: koşu bir kez daha gerçek servise kayıt düşürür (kullanıcı 15.10: "tekrarı olmasın"). Nöbetçinin gerçek
  Windows kırmızısı bu yüzden DENENMEYEN'e yazılır; yerine (a) Operatör Merkezi'nin geçmiş kayıtları (gerçek servis tarafından üretilmiş kâhin) ve (b) isteğe bağlı güvenli
  mutasyon: hosts adı 127.0.0.1'de 443'ü dinleyen ve 200 + JSON olmayan yanıt veren yerel sunucuya yönlendirilirse `lastError` "beklenmeyen bir yanıt" olur ve nöbetçinin
  ikinci iddiası kırmızı verir (dışarı çıkmaz).
- Komşular (ders 10): `npm test` içindeki packaging, supervisor, update-flow, yedek-220, guncelleme-gercek, license.test, vekil-sunucu-uygulama, ci-kapi-listesi, kanit-araci.

##### 8. Riskler

- hosts dosyası yazımı yönetici ister — GitHub Windows koşucusu yöneticidir (yaygın kullanım; bu imajda DOĞRULANMADI). Adım engeli kendisi doğrular (GetHostAddresses).
- IPv6/DNS önbelleği: hem 127.0.0.1 hem ::1 + Clear-DnsClientCache. Node (undici) dns.lookup → getaddrinfo → hosts'a uyar.
- 127.0.0.1:443'te bir şey dinliyorsa TLS hatası olur — yine engel; nöbetçi deseni "Güvenli bağlantı"yı da kabul eder.
- Program artık "none" (salt okunur) durumda koşar (eskiden paylaşılan deneme ile yazılabilirdi). windows.yml ve windows-kurulum.mjs yalnız /api/auth, /api/admin ve GET kullanır
  (koddan: windows.yml:101–112, windows-kurulum.mjs:110,116,266,319; license.mjs:57–66) → kırılma beklenmez; ilk koşuda DOĞRULANMADI.
- DEFAULT_LICENSE_SERVICES'e yeni ad eklenirse adım kendiliğinden kapsar (kaynaktan türetilir); vekil sunucu ayarı (config\ag-ayari.json) CI'de yok.
- E9e ci.yml'e adım eklemek ci-kapi-listesi.test.mjs'in metin denetimlerini etkileyebilir → koşulmadan teslim edilmez (ders 28).
- Kök neden kanıtının bir kısmı çıkarım: aynı MachineGuid paylaşımı ve 30 sn check zamanlaması DOĞRULANMADI; "2.4.5 yalnız windows-kurulum.mjs'den gelebilir" ise koddan kesin.
- 2.4.4 yayın akışı kendisi (master push + v2.4.4 etiketi) düzeltme girmeden koşarsa 2.4.5/2.4.6 (2.4.4+1/+2) ile YİNE sızar → E9a, 2.4.4'ün master'a girişiyle AYNI
  PR'da olmalı (windows.yml master push'ta tetiklenir).

### EK-7 baslatici-portal

#### Alan haritası: baslatici-portal (Go başlatıcı, kurulum, güncelleyici; 2.4.4 E7 tasarımı)

Salt okuma, 21.10.2026. Her iddia dosya:satır; emin olunmayan "DOĞRULANMADI". Hiçbir dosya değiştirilmedi, test/ağ koşulmadı.

##### 1. Mimari (koddan)

###### 1.1 Go başlatıcı (`launcher/`, modül `destekofis/launcher`, go 1.22 — launcher/go.mod)
- Görev: masaüstü kısayolu çalıştırır; sunucuyu bulur, DestekOfis'i Edge/Chrome UYGULAMA PENCERESİNDE açar ve ÇIKAR (launcher/main.go:1-3, 139-142).
  Arka planda kalan süreç, yerel dinleyici, özel protokol YOK.
- Sunucu bulma sırası `locate` (launcher/main.go:39-67): kayıtlı adres (1,2 sn sağlık) → `http://127.0.0.1:<port>` (0,6 sn) → UDP keşif
  (`discover`, launcher/discovery.go:88; sihirli metinler `HukukOfisiServerNerede/Burada`, discovery.go:13-14; yanıt gelen IP tercih edilir
  `ServerURL`, discovery.go:33-38; kayıtlı kurulum kimliği önce `choose`, discovery.go:140) → bilgisayar adı (main.go:60-65).
- Sağlık: `GET /api/health`; 503 + "MAINTENANCE" de bulundu sayılır; 200'de `data.service` "destekofis" ile başlamalı (launcher/health.go:13-35).
- Bayraklar (launcher/main.go:70-78): `-kesfet`, `-kesfet-dosya` (kurulum sihirbazı kullanır), `-sunucu`, `-sifirla`, `-port` (5123), `-hedef`,
  `-acma` (tarayıcı açmadan JSON yazar; testler kullanır), `-surum`. Bulunamazsa Windows ileti kutusu "Yeniden Dene" döngüsü (main.go:144-151).
- Ayar dosyası `%APPDATA%\DestekOfis\istemci.json` (`os.UserConfigDir` + "DestekOfis", launcher/config.go:20-31; testte `DESTEKOFIS_CONFIG_DIR`,
  config.go:21). Alanlar: server, instanceId, host, name, **browser** (`auto|edge|chrome|default`, config.go:16; boşsa auto, config.go:39-40).
  Günlük `%APPDATA%\DestekOfis\istemci.log`, 256 KB'ta sıfırlanır (launcher/logfile.go).
- Tarayıcı açma (Windows) `openURL` (launcher/platform_windows.go:65-76): adaylar `ProgramFiles(x86)`, `ProgramFiles`, `LocalAppData` altında
  `Microsoft\Edge\Application\msedge.exe` sonra `Google\Chrome\Application\chrome.exe` (platform_windows.go:43-62); komut TAM OLARAK
  `msedge.exe --app=<url> --new-window` (platform_windows.go:69). **`--user-data-dir` YOK, `--start-maximized/--start-fullscreen` YOK,
  `--no-first-run` YOK.** Bulunamazsa ya da `browser=default` ise `rundll32 url.dll,FileProtocolHandler <url>` (varsayılan tarayıcıda sekme,
  platform_windows.go:75). Windows dışı derleme yalnız geliştirme: `xdg-open` (launcher/platform_other.go).
- Sonuç: DestekOfis penceresi kullanıcının **VARSAYILAN Edge profilinde** (`%LOCALAPPDATA%\Microsoft\Edge\User Data\Default`) açılır; çerezler,
  kayıtlı parolalar, Edge parola yöneticisi, (açıksa) Microsoft hesabı eşitlemesi normal Edge ile ORTAKTIR. Profil zaten KALICIDIR; ayrı değildir.
- Derleme: `tools/build-windows.mjs:36-89` — windres ile simge + sürüm + manifest (asInvoker, PerMonitorV2; launcher/winres/destekofis.manifest.template),
  `go build -trimpath -ldflags "-H=windowsgui -s -w -X main.version=<sürüm>"`, GOOS=windows GOARCH=amd64 CGO_ENABLED=0 (build-windows.mjs:80-85).
  windres yoksa SİMGESİZ derlenir (build-windows.mjs:76-78).

###### 1.2 Kurulum (`packaging/windows/setup.iss`, Inno Setup 6)
- Yönetici ister (`PrivilegesRequired=admin`, setup.iss:56); türler "Sunucu" ve "Personel Bilgisayarı" (setup.iss:74-76).
- Bileşen `istemci` (başlatıcı) İKİ türde de kurulur (`Types: sunucu istemci`, setup.iss:80) → başlatıcı hem sunucu PC'de hem her personel PC'de
  `{app}\launcher\DestekOfis.exe` (setup.iss:93); kısayollar masaüstü + Başlat (setup.iss:102-104); kurulum sonu "şimdi aç" (setup.iss:116).
- Sihirbaz ağ taramasını geçici `DestekOfisKesif.exe -kesfet-dosya` ile yapar (setup.iss:95, 215-237).
- `[Registry]` bölümü YOK; `destekofis://` gibi özel protokol KAYITLI DEĞİL (setup.iss tamamı okundu; `grep Registry|URLProtocol|HKCR` boş).
- Sunucu türünde `bin\servis-kur.cmd` (nssm): servis hesabı `NT SERVICE\DestekOfis` (servis-kur.cmd:11, 55), ortam
  `HUKUK_INSTALL_ROOT, NODE_ENV=production, NODE_OPTIONS=--use-system-ca` (servis-kur.cmd:58) — **HUKUK_LICENSE_URL yok** (bkz. §5 E9 ipucu).
  Servis oturum 0'da çalışır → kullanıcının masaüstünde pencere AÇAMAZ.
- `bootstrap.mjs` kurulum kökünde sabittir; "yalnızca kurulum dosyasıyla değişir; otomatik güncellemeler yalnızca app\<sürüm> klasörlerini ekler"
  (packaging/windows/bootstrap.mjs:5-6); alt komutlar servis/yedek/surum/etkinlestir/saglik (bootstrap.mjs:8-13, 186-190).

###### 1.3 Güncelleyici (sunucuda)
- Paket içeriği `APP_ITEMS = server, client, docs/KURULUM-VE-KULLANIM.md, package.json, CHANGELOG.md, README.md, tools/backup.mjs, tools/mutabakat.mjs`
  (tools/lib/app-files.mjs:6); güncelleme paketi bunu kullanır (tools/lib/update-package.mjs:50). **launcher/DestekOfis.exe, setup.iss, bootstrap.mjs,
  bin/*.cmd güncelleme paketine GİRMEZ.**
- Güncelleyici yalnız sunucunun `app\` klasörüne yazar (server/lib/updater.mjs:8); imzalı bildirge + SHA-256 + sürüm denetimi (updater.mjs:3-7);
  hazır paket akışı (updater.mjs:10-13). Akış/zamanlama `update-orchestrator.mjs:1-20` (açılış + saatte bir, mesai dışı/15 dk boşta kur, deneme kipi + geri dönüş);
  `createUpdateOrchestrator` update-orchestrator.mjs:46.
- Personel bilgisayarına güncelleme ile HİÇBİR ŞEY gitmez: personel yalnız sunucunun yeni istemci dosyalarını (client/) tarayıcıda görür.
  Başlatıcıyı değiştiren her iş (yeni bayrak, protokol, profil klasörü) ancak **her bilgisayarda Kurulum.exe yeniden çalıştırılınca** (yönetici
  yetkisiyle) gelir.

###### 1.4 İstemci (tarayıcı) tarafı ilgili noktalar
- Sunucu yanıt başlıkları: `x-frame-options: DENY`, `cross-origin-opener-policy: same-origin`, `referrer-policy: same-origin` (server/lib/http.mjs:10-16);
  CSP'de gezinme kısıtı yok (http.mjs:19-30). Personel `http://<ip>:5123` ile bağlanır → güvenli bağlam DEĞİL; COOP güvenli olmayan kaynakta
  tarayıcıca yok sayılır (Chromium davranışı; bu kurulumda DOĞRULANMADI), 127.0.0.1'de uygulanır.
- Dış adres açma emsalleri: `window.open(url, "_blank", "noopener")` (client/assets/hof-sources.js:649 Google Sheet, hof-workspace.js:32 wa.me),
  adlı pencere yeniden kullanımı `window.open(url, "hof-whatsapp")` (client/assets/hof-whatsapp.js:58).
- 2.4.2 "kaydet önerisi" çözümü YALNIZ DestekOfis sayfası içinde: giriş dışı formlarda `autocomplete=off` + `type=password` → `type=text` + `.hof-secret`
  (client/assets/hof-core.js:1233-1258). Tarayıcı profili/bayrağı DEĞİŞMEDİ; "dinlemezse başlatıcı ayrı profil (öneriler kapalı)" yalnız öneri olarak
  kaldı (docs/GECMIS-KARARLAR.md:1985-1988, 2001). Bu ayar EDM portalının (başka kaynak) parola alanına ETKİ ETMEZ.
- Fatura üst satırı: `hof-plan-actions` araç çubuğu (client/assets/hof-invoices.js:288-293; "Liste - PDF / Liste - Excel" :293), eylem dağıtıcı
  `if (act === "integrator")` (hof-invoices.js:403), `edoc()` = `meta.edocEnabled` (hof-invoices.js:28).
- Sunucu ortam bilgisini herkese verir: `/api/workspace/invoices/meta` → `settings.integrator = integratorSummary(s)` (id, env, configured…;
  server/routes/invoices.mjs:2303, 2326, 455); `/settings` yetkisiz kullanıcıya da `integrator.env` döner (invoices.mjs:452, 2336-2339). Parola
  istemciye HİÇ çıkmaz (`passwordSealed` ayıklanır, invoices.mjs:451; açılış yalnız sunucuda `secrets().open`, invoices.mjs:480).
- EDM servis adresleri `EDM_URLS` (server/lib/einvoice/edm.mjs:26-29); portal adresi kodda YOK (grep: EFaturaUI/portal4 yalnız belgelerde).
- EDM oturumu: "Logout aynı kullanıcının başka yerlerdeki (EDM portalı, başka kurulum) oturumlarını da kapatır" (edm.mjs:16-18); oturum düşerse
  (10011) yeniden giriş + işi bir kez yineleme `withSession` (edm.mjs:270-281, sessionError edm.mjs:122, 232).

##### 2. Değişmezler (bu alanda korunacak)
1. Başlatıcı yalnız DOĞRULANMIŞ DestekOfis sunucusunu açar (health.go:35 `service` öneki); açtığı adresi kullanıcı girdisinden değil keşif/ayardan alır.
2. Başlatıcı penceresiz (GUI alt sistemi `-H=windowsgui`, build-windows.mjs:81) ve kısa ömürlüdür (main.go:142); kalıcı süreç/port açmaz.
3. Güncelleme paketi = APP_ITEMS (app-files.mjs:6); kurulum ve güncelleme aynı uygulama içeriğini taşır (app-files.mjs:1-2). Başlatıcı/kurulum betiği
   yalnız Kurulum.exe ile değişir.
4. Parola (EDM) sunucudan istemciye çıkmaz (invoices.mjs:451-453); tasarım kararı (CLAUDE.md "KULLANICI SORUNU 19.10" — kayıtlı parola gösterilmez).
5. Veriler (data, backups) kurulum/kaldırmada silinmez (setup.iss:86-90, 480-485).
6. Ders 30: gerçek programı açan her test lisans servisini 127.0.0.1:9'a yönlendirir (test/lisans-servisi-izolasyonu.test.mjs:1-4, 31-35).
7. Ders 18: Windows'a özgü davranış (Edge bayrağı, protokol, profil) gerçek Windows + Edge'de görülmeden "çalışıyor" denmez.

##### 3. Testler (alanın mevcut testleri)
- `launcher/launcher_test.go` (Go birim: parseReply, choose, normalizeURL, broadcastTargets) — `test/launcher.test.mjs:36` içinden `go test ./...` koşar.
- `test/launcher.test.mjs` (Go yoksa atlanır, :25): -kesfet, -kesfet-dosya, yerel kısa yol, kayıtlı adres, sunucu yok (çıkış 2), Windows derlemesi "MZ"
  (:99-105). `openURL`'ün argüman listesi HİÇ test edilmiyor (Windows'a özgü dosyada, yalnız derleniyor).
- `test/packaging.test.mjs` — bootstrap.mjs alt komutları/etkinleştirme/geri dönüş/sağlık (:160-353); setup.iss içeriğini denetleyen test YOK (grep).
- `.github/workflows/windows.yml` — gerçek Windows'ta sessiz sunucu kurulumu, servis, UDP keşif, `DestekOfis.exe -kesfet` (:94-99), gerçek güncelleme
  sınaması (`test/guncelleme-gercek/windows-kurulum.mjs`, :144-150), yeniden kurulum, kaldırma; master push + workflow_call (release.yml) (:3-8).
  Tarayıcı/Edge penceresi hiçbir CI'de açılmıyor.
- Updater: test/updater.test.mjs, guncelleme-*.test.mjs, guncelleme-gercek/.

##### 4. E7 — "E-Fatura Portal" düğmesi: yollar, güvenlik/kurulum etkisi, öneri

###### 4.1 Sorulara koddan yanıt
(c) Başlatıcı nerede çalışıyor? Her personel PC'de VE sunucu PC'de kurulu (setup.iss:80, 93); yalnız kısayola tıklanınca çalışır, tarayıcıyı açıp çıkar
    (main.go:139-142). Personel DestekOfis'i başlatıcısız, tarayıcıya `http://<ip>:5123` yazarak da açabilir (zorunluluk yok) → başlatıcıya bağlı bir
    yol bu kullanıcılarda çalışmaz.
(d) Güncelleme başlatıcıyı değiştirebilir mi? HAYIR. Paket APP_ITEMS'tır (app-files.mjs:6, update-package.mjs:50); bootstrap.mjs:5-6 açıkça söyler.
    Başlatıcıya eklenen her şey 2.4.4 Kurulum.exe'nin HER bilgisayarda (yönetici olarak, setup.iss:56) yeniden çalıştırılmasını ister. Otomatik
    güncellemeyle 2.4.4'e geçen sunucunun personel PC'leri eski başlatıcıyla kalır.
(b) Özel protokol/yerel uç kayıtlı mı? HAYIR: setup.iss'te [Registry] yok; başlatıcıda yerel dinleyici yok (main.go yalnız istemci HTTP + UDP gönderir).
Sunucu tarafında Edge açmak: OLMAZ — servis `NT SERVICE\DestekOfis` ile oturum 0'da (servis-kur.cmd:11, 55), çoğu ofiste başka makinede; tıklayanın
    ekranına pencere açamaz.

###### 4.2 Yol A — istemcide `window.open` (kurulum değişikliği YOK)
- Nasıl: düğme tıklamasında (kullanıcı hareketi → açılır pencere engelleyicisine takılmaz) ortamın portal adresi açılır:
  `window.open(portalUrl, "_blank", "noopener,noreferrer,popup,left=0,top=0,width=<screen.availWidth>,height=<screen.availHeight>")`.
- Edge `--app` penceresi içinde ne olur (Chromium davranışı; BU KURULUMDA DOĞRULANMADI, gerçek Windows + Edge'de denenmeli):
  özellik dizesi YOKSA uygulama penceresi sekme tutamadığından adres aynı profilin NORMAL (sekmeli) Edge penceresinde yeni sekmede açılır;
  `popup` + boyut verilirse aynı profilde ayrı, sekmesiz, salt okunur adres çubuklu bir açılır pencere olur, ekran boyutunda açılır. Gerçek "tam ekran"
  (F11/kiosk) betikle verilemez (Fullscreen API başka kaynağın belgesinde ve kullanıcı hareketiyle olur); kullanıcı F11/Ekranı Kapla ile yapar.
- Kalıcılık: pencere başlatıcının açtığı profilde, yani VARSAYILAN Edge profilinde (platform_windows.go:69, --user-data-dir yok) → çerezler, "Beni Hatırla",
  Edge'in kaydettiği EDM parolası kalıcıdır. DestekOfis'in 2.4.2 susturması (hof-core.js:1233-1258) EDM sayfasına etki etmez → Edge EDM parolasını
  kaydetmeyi önerir (istenen). Edge eşitleme açıksa parola Microsoft hesabına da eşitlenir (kullanıcının kendi tarayıcı ayarı).
- Güvenlik: yeni saldırı yüzeyi yok; adres istemcide/sunucuda sabit beyaz listeden (iki EDM adresi) seçilir, kullanıcı girdisi değil; `noopener,noreferrer`
  ile EDM sayfası DestekOfis penceresine (`window.opener`) erişemez, Referer gitmez (zaten referrer-policy same-origin, http.mjs:12). Parola istemciye çıkmaz;
  Turnstile'a dokunulmaz (kullanıcı kendisi tıklar). Başlatıcısız (doğrudan tarayıcı) kullanıcılarda ve eski başlatıcılı bütün PC'lerde aynı çalışır.
- Bedel: tam ekran değil, "ekran boyunda ayrı pencere"; profil kullanıcının normal Edge'iyle ortak (EDM oturumu normal Edge'de de açık görünür).
- `noopener` ile adlı pencere yeniden kullanımı (tek pencere) belirsiz (DOĞRULANMADI); her tıklama yeni pencere açabilir. Tek pencere istenirse
  `const w = window.open("", "hof-edm-portal", features); if (w) { w.opener = null; w.location.href = url; }` kalıbı (about:blank aynı kaynakken opener kesilir).

###### 4.3 Yol B — kurulumun kaydettiği özel protokol `destekofis://portal?ortam=test|canli`
- Gerekenler: setup.iss `[Registry]` (HKA/HKLM `Software\Classes\destekofis`: `URL Protocol`, `shell\open\command` =
  `"{app}\launcher\DestekOfis.exe" --protokol "%1"`; kaldırmada `uninsdeletekey`); başlatıcıda yeni kip: yalnız `--protokol <url>` kabul, başka bayrak YOK,
  ortam → SABİT iki adres (protokol dizesinden ADRES ALINMAZ), sonra
  `msedge.exe --user-data-dir=%LOCALAPPDATA%\DestekOfis\EdmPortal --no-first-run --no-default-browser-check --start-maximized --app=<portal>`
  (Chrome için aynı bayraklar). `cfg.Browser` (config.go:16) yine uyulur.
- Neden ayrı `--user-data-dir`: Edge çoğu zaman zaten açık (Başlangıç Hızlandırma/arka plan); aynı profilde ikinci komut çalışan sürece iletilir ve açılış
  bayraklarının (--start-maximized/--start-fullscreen) bir kısmı YOK SAYILIR (Chromium tekil süreç davranışı; DOĞRULANMADI). Ayrı klasör ayrı süreç demek;
  bayraklar uygulanır, EDM oturumu/parolası normal Edge'den yalıtılır, kalıcıdır (Windows kullanıcısı başına). İlk açılışta Edge karşılama/oturum açma
  ekranları çıkabilir (--no-first-run azaltır; DOĞRULANMADI).
- Tarayıcı her tıklamada "Bu site DestekOfis'i açmak istiyor" onayı sorar; "her zaman izin ver" kutusunun http kaynağında çıkıp çıkmadığı DOĞRULANMADI
  (kurumsal ilke AutoLaunchProtocolsFromOrigins ile susturulabilir).
- Güvenlik: herhangi bir web sitesi `destekofis://` bağlantısını tetikleyebilir → başlatıcı yalnız iki sabit EDM adresini açtığı sürece zarar yok; protokol
  dizesinden komut satırı bayrağı/adres alınmamalı (argüman enjeksiyonu sınıfı), fazla argüman varsa red. Yeni kod Windows'ta yönetici kurulumu ister.
- Kurulum etkisi: BÜYÜK — her PC'de 2.4.4 Kurulum.exe yeniden çalışmalı (yönetici); otomatik güncelleme getirmez (§4.1 d). Kayıtlı olmayan PC'de
  Edge sessizce hiçbir şey yapmayabilir; tarayıcıdan "protokol kayıtlı mı" güvenilir biçimde anlaşılamaz → düğmede Yol A'ya düşen "açılmadıysa
  tarayıcıda aç" bağlantısı şart. Personel PC'lerde kurulum tekrarı müşteride elle iş.

###### 4.4 Yol C — başlatıcıda yerel uç (127.0.0.1:<port>)
- Bugün yok; eklemek = sürekli çalışan süreç + otomatik başlatma kaydı + port + CSRF/DNS yeniden bağlama korumaları; Chromium'un yerel ağ erişimi
  kısıtları (özel ağdaki sayfadan geri döngü adresine istek; izin istemi/ön uçuş) DOĞRULANMADI. Yol B'nin kurulum bedeli + daha büyük saldırı yüzeyi.
  ÖNERİLMEZ.

###### 4.5 Yol D — Edge otomasyonuyla parolayı doldurma (CDP/--remote-debugging-port)
- Parola sunucudan istemciye çıkar (değişmez 4'e aykırı), uzaktan hata ayıklama portu açık bir tarayıcı yerel saldırı yüzeyidir, Turnstile otomasyonu
  daha sık sınar; EDM sayfası değişince sessizce bozulur. YAPILMAZ (CLAUDE.md "Turnstile aşılmaz").

###### 4.6 ÖNERİ (en küçük güvenli)
1. 2.4.4'te Yol A: sunucu tek kaynak — `server/lib/einvoice/edm.mjs`'e `EDM_PORTAL_URLS = { test: "https://test.edmbilisim.com.tr/EFaturaUI21ea/",
   live: "https://portal4.edmbilisim.com.tr/EFaturaUI/" }` (EDM_URLS'in yanı, edm.mjs:26-29); `integratorSummary` (invoices.mjs:455) ya da meta
   `settings` (invoices.mjs:2326) `portalUrl` taşır (yalnız edocEnabled ve entegratör "edm" iken; env "live" ise canlı, değilse test — `edocLive`
   kilidinden bağımsız, adres açmak zararsız). İstemci: `hof-invoices.js:293` Liste - Excel'in yanına `<button data-act="portal">E-Fatura Portal</button>`
   (görünürlük: `edoc() && meta.settings.integrator?.portalUrl`), dağıtıcıya `if (act === "portal") return openPortal();` (hof-invoices.js:403 yanında).
   `openPortal` = Yol A özellik dizesi. Parola/kullanıcı adı istemciye ÇIKMAZ.
2. Kılavuza (yalnız nasıl yapılır): "Fatura → E-Fatura Portal: EDM portalı ayrı pencerede açılır; ilk girişte Entegratör Ayarları'ndaki kullanıcı adı ve
   parolayla girin, Beni Hatırla'yı işaretleyin; Edge kaydetmeyi önerirse Kaydet."
3. Gerçek Windows + Edge elle kabul (ders 18; KANIT 5): başlatıcı penceresinden tıkla → ayrı pencere, ekran boyu, adres doğru (test ortamında test portalı),
   giriş + Beni Hatırla + Edge parola kaydı → pencereyi kapat, DestekOfis'i kapat-aç → düğme → doğrudan portal sayfası (çerez kalıcı mı) → bir e-Arşiv
   gönderimi programdan (portal oturumu web servis oturumunu düşürüyor mu; düşürürse withSession yeniden giriş yapar, edm.mjs:270-281).
4. Yol A kabulde yetmezse (kullanıcı gerçek tam ekran/ayrı profil isterse) Yol B ayrı iş: başlatıcıda saf işlev `portalArgs(env, browser)` (Linux'ta test
   edilebilir dosyada) + `--protokol` kipi + setup.iss [Registry] + windows.yml'de kayıt denetimi; düğme Yol A'ya düşer. Müşteride her PC'ye kurulum.

###### 4.7 Testler (Yol A)
- Sunucu birim (test/einvoice-edm.test.mjs ya da yeni test): env test/live → `portalUrl` doğru; edocEnabled=false → yok; parola/kullanıcı adı
  `integratorSummary`'de YOK (değişmez 4 için koruyucu). Eski kodda kırmızı (alan yok) — ders 7.
- e2e (Playwright Chromium; ağ YOK — `context.route("https://test.edmbilisim.com.tr/**")` ve `https://portal4.edmbilisim.com.tr/**` yerel yanıtla
  karşılanır, EDM'ye istek gitmez): düğme görünür (edoc + yapılandırılmış entegratör), tıkla → `context.waitForEvent("page")` yeni sayfa adresi test portalı;
  ortam canlı → canlı adres; yetkisiz (yalnız invoices.view) kullanıcıda da ortamın adresi; edoc kapalıyken düğme yok. Eski kodda kırmızı.
- test/yazim-duzeni.test.mjs: "E-Fatura Portal" başlık düzenine uyar (titleCase değiştirmez; text-case.mjs:24-29). Program dilinde "e-Fatura" küçük e
  ile yazılır → ad kararı açık soru.
- Değişen e2e'ler koşulur (ders 28); düğme Fatura üst satırına girdiği için Fatura ekranına bakan senaryolar (senaryo-fatura-243, senaryo-ebelge-242/243,
  senaryo-entegrator-240, senaryo-211 gezinti) koşulur.

###### 4.8 Riskler (E7)
- Edge `--app` penceresinden `window.open` davranışı (sekme mi açılır pencere mi, boyut) DOĞRULANMADI → elle kabul şart.
- Kalıcı çerez/Beni Hatırla süresi EDM'ye bağlı (DOĞRULANMADI); Edge kullanıcı "çıkışta çerezleri temizle" ayarlıysa her seferinde giriş.
- Portal girişi aynı kullanıcıyla web servis oturumunu düşürebilir (edm.mjs:16-18 yalnız Logout için söylüyor; giriş için DOĞRULANMADI) → gönderim
  sırasında 10011 → yeniden giriş yolu var; sonucu belirsiz gönderim sınıfına girmemeli (SendInvoice 10011 = işlenmedi). Kabulde denenecek.
- Kullanıcı portalda Çıkış'a basarsa programın oturumu da düşer (edm.mjs:16-18) — yeniden giriş otomatik; yalnız bir istek gecikir.
- Canlı portal adresi + canlıda portal kullanıcısı = web servis kullanıcısı EDM'den teyit edilmedi (docs/DURUM-VE-DEVAM.md:54).
- 2.4.2 açık maddesi "kaydet önerisi kalkmazsa ayrı profil (öneriler kapalı)" ile ÇELİŞKİ: o öneri DestekOfis'in kendi profilinde parola yöneticisini
  kapatırsa, aynı profilde açılan EDM portalı parolayı da KAYDEDEMEZ. İkisi birlikte yapılacaksa portal başka profilde açılmalı (Yol B) ya da DestekOfis
  profili değişmemeli.

##### 5. Alan dışı ama alanda bulundu — E9 (lisans sızıntısı) güçlü ipucu
- `.github/workflows/windows.yml` gerçek Windows koşucusunda (Azure) GERÇEK kurulum + servis kurar (:55-58); servis ortamında HUKUK_LICENSE_URL YOK
  (servis-kur.cmd:58); program açılıştan 3 sn sonra kendiliğinden deneme başlatır (server/lib/license.mjs:230, 604) ve varsayılan lisans adresi
  `https://destek-ofis.vercel.app/api/lisans` (license.mjs:33, config.mjs:60).
- Aynı iş akışındaki güncelleme sınaması kurulu sürümden `next=patch+1, next2=patch+2, next3=patch+3` üretip servisi bunlarla AÇAR
  (test/guncelleme-gercek/windows-kurulum.mjs:123-127; W3 next2'yi kurar ve çalıştırır :292-302). Kurulu 2.4.3 → next2 = **2.4.5**. 2.4.3 master'a
  19.10'da birleşti (windows.yml master push'ta koşar :3-5) → Operatör Merkezi'ndeki "2.4.5 · son 19.10 15:30 TR" ile örtüşüyor. Kimlik Windows
  MachineGuid'den (server/lib/machine.mjs:3, 16-18); koşucu imajları aynı MachineGuid'i taşıyorsa kayıtlar tek kuruluma birikir (DOĞRULANMADI).
- `test/lisans-servisi-izolasyonu.test.mjs` yalnız `test/**/*.mjs`'yi tarar (:15-28); iş akışlarını ve nssm'in başlattığı GERÇEK servisi görmez.
- Öneri (karar E9 sahibinde): windows.yml'de kurulumdan ÖNCE hosts dosyasına `127.0.0.1 destek-ofis.vercel.app` (ürün kodu değişmez; servis ilk 3 sn'de
  ölü adrese gider) + adım sonunda doğrulama; izolasyon testine `.github/workflows/*.yml` içinde kurulum/servis başlatan adımların bu önlemi taşıdığı
  denetimi. Not: makine ortam değişkeni servise ancak SCM yeniden başlayınca geçer (DOĞRULANMADI) → hosts yolu daha güvenli.

##### 6. Açık sorular
1. Düğme adı: kullanıcı "E-Fatura Portal" dedi; program dili "e-Fatura" (text-case.mjs:24). "E-Fatura Portal" mı "e-Fatura Portalı" mı?
2. Yol A'nın "ekran boyunda ayrı pencere"si yeterli mi, yoksa gerçek tam ekran + ayrı profil (Yol B, her PC'ye kurulum) mi isteniyor?
3. Düğme kimde görünsün: yalnız Fatura Ayarları yetkisi mi, Fatura görüntüleyen herkes mi? (Portal erişimini EDM parolası korur, düğme yalnız adres açar.)
4. EDM teyidi: canlı portal adresi ve canlıda portal kullanıcısı = web servis kullanıcısı; portal girişi web servis oturumunu düşürüyor mu.

### EK-8 para-cekirdegi

#### Para çekirdeği ve veri katmanı — 2.4.4 hakimiyet haritası

Alan: `para-cekirdegi`. Kaynak: depo `/home/user/ofis---y-netimi`, okunma tarihi 21.10.2026. Bu belge SALT OKUMAYLA hazırlandı:
hiçbir test koşulmadı, hiçbir dosya değişmedi. Her iddianın yanında dosya:satır var; emin olunamayan yerlerde "DOĞRULANMADI" yazıyor.

---

##### 1. Mimari (kısa)

1. **Bağlantı ve işlem (db.mjs).** `openDatabase` WAL + `synchronous=FULL` + `foreign_keys=ON` + `busy_timeout=10000` açar (server/lib/db.mjs:4-11).
   `createStore` hazır sorguları önbellekte tutar. İç içe `tx()` kullanılabilir: en dışta `BEGIN IMMEDIATE`, içeride SAVEPOINT (db.mjs:319-382).
2. **Para tabloları (FINANCIAL).** payments, cash_entries, accounts, account_entries, plans, plan_items, plan_entries, stock_items, stock_moves, cheques,
   cheque_events, fin_events, bank_lines, bank_accounts, pos_terminals, pos_sales, pos_items, cheque_collections, doubtful_receivables, doubtful_provisions
   (db.mjs:29-32). Bu tablolara yazan her `store.run` bir işlemin içine alınır (db.mjs:248-250). Commit'ten hemen önce kayıtlı kapılar çalışır,
   biri hata atarsa ROLLBACK olur (db.mjs:338-346, 367-380).
   - Yalnız bilgi kolonlarına yazan UPDATE kapıya girmez (INFO_COLUMNS, db.mjs:39-56). Ancak SET ifadesinin tam olarak `kolon = ?` biçiminde
     olması gerekir. `REPLACE(note, …)` gibi ifadeler finansal yazım sayılır.
3. **K6 para yazımı denetimi (db.mjs:65-160, 227-241; bank/post.mjs:1-30, 71-105).**
   - (b) money:event: bu işlemde yazılan bir para satırının işlem başlığı (`event_id`) olmalı. Başlık `fin_events`'te kayıtlı olmalı ve bu
     işlemde `bank.post`'tan geçmiş olmalı (db.mjs:227-241).
   - (c) money:raw: `bank.post` bağlamı ve `store.raw` dışında para tablosuna UPDATE/DELETE/UPSERT yapılamaz. Tek istisna para alanı
     olmayan kolonlar (FREE_COLUMNS, bank/money-lines.mjs:127-137). `cheque_events` için serbest kolonlar yalnız `note`, `updated_*` ve
     `effects_json`; `invoice_id` serbest DEĞİL (money-lines.mjs:133).
   - Test kipinde (`config.moneyStrict`) ihlal 500 + ROLLBACK verir. Üretimde yalnız günlüğe ve `meta.bank.integrity` ayarına yazılır.
4. **Para satırının 9 kaynağı (MONEY_SOURCES, bank/money-lines.mjs:33-90).** payments, cash_entries, cari tahsilat/ödeme (source ''), fatura
   peşini (source 'invoice', in/out), POS kesintisi (source 'bank'), taksit tahsilatı (çeksiz, açılış olmayan), peşin stok, çek tahsil/ödeme
   olayı ve Banka Fişi para rolleri. Kasa/Banka bakiyesi tek kaynaktan, `createMoneyLines` ile hesaplanır (money-lines.mjs:220; özet
   `summary` :505, `balances` :493).
5. **Ana Defter saklanmaz, türetilir (general-ledger.mjs:1-8).** `routes/ledger.mjs rows()` alt defterleri okur (routes/ledger.mjs:27-184).
   `journal()` her kaynak satırdan bir yevmiye maddesi üretir (general-ledger.mjs:157-401). `trialBalance` mizanı (:441), `reconcile` ise
   ana defter ile alt defterin karşılaştırmasını (:478) yapar. Beklenen bakiyeler `expected()`'ta (routes/ledger.mjs:204-301). Tek istisna
   Banka Fişi'dir: hesap kodu yazım anında `bank_lines`'ta saklanır (general-ledger.mjs:373-386).
6. **Hesap kuralı (moneyAccount, general-ledger.mjs:120-131).** nakit → 100; havale → 102.xx (bağsız 102.00); POS → 108.xx; kurumsal kart → 309.xx;
   kredi → 300.xx; tanınmayan yol → 100. Evrak hesapları cheque-gl.mjs'te: çek 101/103, senet 121/321, portföy .01, tahsilde .02
   (cheque-gl.mjs:1-38).
7. **Mutabakat kapısı (integrity.mjs).**
   - Önce "dokunulan varlıklar" süzgeci çalışır (integrity-scope.mjs:115). Temizse tam kapı çalışmaz. Temiz değilse karar tam kapınındır
     (`run`, integrity.mjs:305; commit kapısı `start()` içinde :782-890).
   - `config.gateVerify` açıkken iki yol da çalışır. Süzgeç "temiz" der ama tam kapı reddederse 500 `gate-equivalence` döner
     (integrity.mjs:67-71, 848-851).
   - Taban kuralı: açılışta bulunan eski sapma `baseline` olarak kaydedilir. Yeni işlem bu sapmayı büyütemez (integrity.mjs:783-801).
   - Kilitli dönemin parmak izi LOCK_SQL'dedir (integrity.mjs:116-214). Hesabı `lockDigestOf` yapar (:224-243). Kilit aynıyken iz
     değişirse 409 `period-lock` döner (:844).
   - Tam tarama açılışta, Mutabakat Testi'nde ve 15 dakikada bir koşar (integrity.mjs:891-935; `scan` :929). Kullanıcı ucu
     `GET /api/workspace/ledger/integrity` (routes/ledger.mjs:327-334).
8. **Şema ve göç (migrations.mjs).** Göçler "yalnız ekleyici" kuralına uyar ve `PRAGMA user_version` ile sayılır (migrations.mjs:1-4).
   Göçten önce tam yedek alınır (:1607-1612). Göçler sırayla, tek tek işlem içinde uygulanır (:1613-1619). Son göç **30**
   (`LATEST_VERSION` :1578). v20 ve sonrası `store.raw("migration.vNN")` kapsamında çalışır (:1117, :1187 …). v20 banka şeması STRICT ve
   kuruş tamsayıdır (:1365-1576).
9. **Şirket ve yedek.**
   - Her şirket ayrı bir sqlite dosyasıdır, en fazla 2 şirket olabilir (companies.mjs:1-13, `MAX_COMPANIES` :30).
   - Yedek `VACUUM INTO` ile alınır (backup.mjs:130-180). Yedeğin içine şirket kimliği (`backup_meta`) yazılır (backup.mjs:15, :95).
   - Geri yükleme kimliği denetler; 001 için yeniden başlatmada uygulanır (company-backups.mjs:1-28, `restoreCompany` :643,
     `stageRootRestore` :612).
10. **Kuruş (minor.mjs).** Yeni tablolarda tutar tamsayı kuruştur, oran ppm, kur ×10^6. Yarım kuruş sıfırdan uzağa yuvarlanır
    (minor.mjs:1-11). Eski REAL kolonlar korunur; okunurken `toMinor` (:124) ile kuruşa çevrilir. Yevmiyede `cents()` = round(×100)
    kullanılır (general-ledger.mjs:71).

##### 2. Para akışı: modülden yevmiyeye

| Modül / satır | Kaynak tablo | Yevmiye (journal) | Beklenen (expected) |
|---|---|---|---|
| Kayıt tahsilatı | payments | B para / A 602 (general-ledger.mjs:188) | 100/102/108 tek kaynaktan (routes/ledger.mjs:212) |
| Kasa elle giriş/çıkış | cash_entries | giriş 649, çıkış 770; açılış B 100 / A 500 (`is_opening`); vergi ödemesi B 360 · B 689 / A 100 (`tax_json`); transfer 100↔102 (:189-217) | aynı |
| Cari borç/alacak yaz | account_entries source '' debt/credit | 120/320/336 ↔ 602/770; not "Açılış…" ile başlıyorsa 500 (:77, :246-247) | cari listesi bakiyesi (routes/ledger.mjs:217-221) |
| Cari tahsilat/ödeme | account_entries source '' in/out | B para / A kontrol hesabı (`doubtful.skip` işaretli) ve tersi (:248-254) | aynı |
| Çek alındı / verildi | account_entries source 'cheque' (credit/debt; para satırı DEĞİL) | B 101.01/121.01 / A 120 ya da B 320 / A 103/321 (:222-229) | 101/121 = portföy, 103/321 = ödenecek (routes/ledger.mjs:226-245) |
| Çek tahsil / ödeme | cheque_events kind collect/pay (para satırı) | B para / A 101(.02) ya da B 103/321 / A para (:368-372) | — |
| Bankaya Tahsile Ver | cheque_collections | 101.01 → 101.02 ve geri (:358-367) | `cheque:collections` (integrity.mjs:663) |
| Taksit kartı | plans | B kontrol / A 602 (mevcut borcu kapsayan kart hariç); kapanış B 689 / A kontrol (:256-268) | 127 carisiz kart (routes/ledger.mjs:249-261) |
| Taksit tahsilatı | plan_entries | B para (açılışta 500, çekle 101/121) / A kontrol (:269-285) | — |
| Peşin stok / açılış stoku | stock_moves pay 'cash' / is_opening | 600/610/153 ↔ para; açılış B 153 / A 500 (:287-295) | `stock:opening` (integrity.mjs:458) |
| Fatura (satış/SMM/iade/alış) | invoices (yalnız issued) + account_entries source 'invoice' debt/credit atlanır (:232) | satış/SMM: B 120 ödenecek, B 193 stopaj / A gl_json matrah (600), A 391 (KDV − tevkifat) (:319-325) | 191/391/360/193 kendi toplamından (routes/ledger.mjs:262-275) |
| Banka Fişi | bank_lines + fin_events | saklı hesap kodu, kuruş (:373-386) | 300/309 kullanıldıysa (routes/ledger.mjs:213-214) |
| KDV Mahsup | vat_offsets | 391/191/190/360 (:93-107, :389-395) | (routes/ledger.mjs:286-291) |
| Şüpheli alacak | doubtful_* + account_entries source 'doubtful' | B 128 / A 120 al; 654/129 karşılık; alacak satırları önce 128'den düşer (doubtful-gl.mjs:9-22; general-ledger.mjs:396-398) | 128/129 (routes/ledger.mjs:296-300) |

Carisiz evrak (cari etkisi yok) `rows()` içinde serbest satır olarak eklenir. Karşı hesabı `build()` 602/770'e çevirir (routes/ledger.mjs:144-194).

##### 3. Değişmezler (koddan)

- D1: Her yevmiye maddesinde borç = alacak; mizan dengede (general-ledger.mjs:441-472; kapı denetim kodu `balance`, integrity.mjs:333).
- D2: Ana defter bakiyesi = alt defter (100/102/108/309/300, 120/320/336, 101/103/121/321, 127, 191/391/360/193/190, 128/129). Fark
  kuruşu kuruşuna aranır (general-ledger.mjs:478-486; routes/ledger.mjs:204-301).
- D3: Alt hesapların toplamı = ana hesap, `bank:sub` denetimi (integrity.mjs:355).
- D4: Her carinin kontrol hesabı bakiyesi = cari kartının bakiyesi, `party:accounts` denetimi (integrity.mjs:372; SQL ikizi `partyTotals`
  routes/ledger.mjs:348-375).
- D5: Fatura başlığı = kalemlerin toplamı; `try_payable = net + KDV − tevkifat − stopaj`; `gl_json` toplamı = matrah
  (integrity.mjs:489-512).
- D6: Kesilmiş faturanın tek bir cari satırı vardır ve tutarı ödenecek kadardır; taslak ya da iptal faturanın cari satırı olmaz
  (integrity.mjs:514-525).
- D7: Fatura kapama bağı (`account_entries.invoice_id`) aynı carinin kesilmiş faturasını gösterir; mahsup toplamı faturayı aşmaz
  (integrity.mjs:528-539; scoped ikizi integrity-scope.mjs:742-751).
- D8: `cheques.invoice_id` doluysa evrak kesilmiş faturada yaşar (integrity.mjs:552-555; integrity-scope.mjs:764).
- D9: Çekten gelen her cari satırı var olan bir evraka bağlıdır ve tutarı aynıdır (integrity.mjs:481-486).
- D10: Para satırının işlem başlığı vardır (K6; db.mjs:227-241). Para tablolarına yazım `bank.post` ya da `store.raw` ile yapılır.
- D11: Kilitli dönemin parmak izi değişmez (integrity.mjs:116-243, :844). Fatura iptali kilitli dönemde `period.assertOpen` ile durur
  (routes/invoices.mjs:2190).
- D12: Göç yalnız ekleyicidir; eski sürüm aynı dosyayı açabilir (migrations.mjs:1-4, örnek :1186-1189).
- D13: Kapama yöne göre yapılır, hayalet kısmi ödeme olmaz (invoice-settle.mjs:10-16, `classifyLine` :65-120).

##### 4. Bütünlük denetimleri (Mutabakat / Veri Sağlığı)

- Tam kapı `run()`: çift yönlü kayıt, defter mutabakatı, alt hesap, cari bazında mutabakat, carisiz kart, şüpheli (`doubtful:*`), taksit
  toplamları, stok, çek ↔ cari, faturanın 6 bağ denetimi, kuruş/tarih, `money:method`, `bank:*` (olay, açılış, fiş, transfer, devir, hesap
  bağı), `cheque:collections`, `money:report`, `money:event` (integrity.mjs:305-690).
- Süzgeç: integrity-scope.mjs:1-30 aynı kodları yalnız dokunulan varlıklara uygular. Tam kapıya eklenen her yeni denetim süzgece de
  eklenmelidir. Eklenmezse `gateVerify` açık testlerde eşdeğerlik hatası çıkmaz, yalnız tam kapı yakalar. Aksi yönde, süzgeç bulup tam
  kapı geçirirse `distrust` devreye girer (integrity.mjs:860-866).
- Bağımsız kâhin: test/bagimsiz/ (SENARYO-DILI.md; evrak sürüm 3 §4.30–4.38). `npm run test:kahin-defter` (package.json:14).
  Uzun koşular: `test:mutabakat`, `test:guvenilirlik` (package.json:80-81).

##### 5. 2.4.4 maddeleri — dokunma noktaları

###### 5.1 UX18 para tarafı: faturaya Çek/Senet ile tahsilat

**Bugün.**
- Fatura "+ Tahsilat Ekle" (client/assets/hof-invoices.js:2356 düğme, `payForm` :2427-2465) yalnız `HOF.methodField` yollarını sunar:
  Nakit, Havale, POS ya da Kredi Kartı (hof-core.js:288). Form `POST /api/workspace/accounts/:id/entries` ucuna `{ kind, method,
  invoiceId }` gönderir (hof-invoices.js:2457-2460). Sunucuda bu `addEntry` olur (routes/accounts.mjs:617-638, uç :771-809). Fatura bağı
  `invoiceLink` ile kurulur (:665-680) ve satır source '' bir para satırıdır (3. kaynak).
- Taksitli faturada form açılmaz, taksit kartı açılır (hof-invoices.js:2430-2433).
- Cari "+ Tahsilat": yol listesinde "Çek / Senet (portföye alınır)" vardır (hof-accounts.js:937-940). Seçilince form kapanır ve
  `HOF.cheques.newFor({ direction, account, amount })` açılır (hof-accounts.js:982-985; hof-cheques.js:654-657). **"Kapatılacak Fatura"
  seçimi bu yolda SESSİZCE DÜŞER**, çünkü `newFor` fatura almaz (kör nokta, aşağıda).
- Evrak formu `POST /api/workspace/cheques` ucuna gider (routes/cheques.mjs:460-472). `insertCheque` (:433-449) şunları yapar:
  - `cheques` satırını yazar (`invoice_id` boş),
  - `receive` olayının etkisi olarak bir cari satırı yazar: source 'cheque', kind 'credit' (lib/cheques.mjs:74-79; routes/cheques.mjs:253-262),
  - olay satırını `cheque_events` tablosuna yazar (routes/cheques.mjs:328-338).

  `receive` para satırı DEĞİLDİR; para çek tahsil olunca `collect` olayıyla el değiştirir (lib/cheques.mjs:1-14).
- Fatura kesilirken alınan evrak (`payment.cheques`) ise `invoiceCheques.create(... { invoiceId })` ile yazılır
  (routes/invoices.mjs:2019-2026; routes/cheques.mjs:920-927). Bu yol hem `cheques.invoice_id`'yi hem `receive` olayının `invoice_id`'sini
  doldurur. Fatura iptal edilirse `voidFor` evrakı birebir geri alır ve evrakı siler; evrak işlem görmüşse 409 `cheque-moved` verir
  (routes/cheques.mjs:943-972; çağrı routes/invoices.mjs:2143-2148).

**Yevmiye.** Çek fatura sayfasından girilse de cari sayfasından girilse de madde aynıdır: B 101.01 (senette 121.01) / A 120
(general-ledger.mjs:222-229). Fatura bağı yevmiyeyi DEĞİŞTİRMEZ; journal bağ okumaz. Tahsil anında B para / A 101 yazılır (:370).
UX18 mizanı etkilemez.

**Fatura kapama.** `settleInvoices` (invoice-settle.mjs:128) olay bağını zaten okur. Toplu yol `cheque_events.invoice_id`'yi bağ sayar
(routes/invoices.mjs:573-593), cari yolu da öyle (:632-639). Çek satırı alacak yazdığı için ödeme rolündedir (`classifyLine`,
invoice-settle.mjs:89-98). Bağsız çek FIFO ile en eski açık faturayı kapatır.

**Önerilen en küçük güvenli uygulama.**

- **A (sunucuya dokunmaz).**
  - `payForm`'a, fatura taksitli değilse ve kullanıcının `cheques.manage` yetkisi varsa (`!doc.plan && HOF.can("cheques.manage")`),
    "Çek / Senet" seçeneği eklenir. Gönderim cari formundaki gibi `HOF.cheques.newFor({ direction: sale ? "in" : "out", account: { id:
    doc.accountId, name }, amount })` olur.
  - Açıklama metni dürüst yazılır: "evrak portföye girer; carinin en eski açık faturasından kapanır".
  - Cari formunda yol Çek/Senet iken "Kapatılacak Fatura" alanı gizlenir ya da "çekte fatura seçilmez" denir.
  - Sorun: kullanıcı X faturasından tahsilat girer ama evrak daha eski Y faturasını kapatabilir. Bu bir mantık boşluğudur (anayasa:
    "eşleşmeyen …").
- **B (önerilen; bağlı, para çekirdeği → dar kontrol).** Evrak, olay bağıyla faturayı kapatır; `cheques.invoice_id` boş kalır. Böylece
  fatura iptal edilince evrak silinmez, yalnız bağ düşer. Bu, nakitteki "Kapatılacak Fatura" anlamının aynısıdır.
  1. routes/cheques.mjs:460-472 `POST /api/workspace/cheques`: isteğe bağlı `invoiceId` alınır. `invoiceLink` ile aynı kural uygulanır:
     fatura aynı caride ve `issued` olmalı, yönü doğru olmalı (alınan evrak satış/SMM faturasını, verilen evrak alış faturasını kapatır),
     `plan_id` boş olmalı (taksitliyse 409). Evrak taksite sayılıyorsa (`planId`) fatura bağı reddedilir.
  2. routes/cheques.mjs:433-449 `insertCheque`: ayrı bir parametre (ör. `eventInvoiceId`) eklenir. Bu yalnız `writeEvent`'e
     (`invoice_id`) gider; `cheques.invoice_id`'ye YAZILMAZ. Böylece `voidFor` (:943) ve `forInvoice` (:973) bu evrakı faturanın
     kendi evrakı saymaz.
  3. routes/invoices.mjs:2210 iptal: `UPDATE account_entries SET invoice_id = ''` satırının yanına şu eklenir:
     `UPDATE cheque_events SET invoice_id = '' WHERE invoice_id = ? AND kind IN ('receive','issue') AND cheque_id NOT IN (SELECT id FROM
     cheques WHERE invoice_id = ?)`. Bu yazım `bank.post` içinde çalışır (cancel :2183). `invoice_id` FREE_COLUMNS'ta olmadığı için
     bank.post dışında money:raw ihlali sayılırdı (money-lines.mjs:133). DOĞRULANMADI: koşulmadı.
  4. routes/invoices.mjs:733-740 `ownPaymentLines`: yalnız `cheques.invoice_id = faturaId` olan evrakın olayları "kendi ödemesi"
     sayılmalı. Sayılmazsa sonradan bağlanan çek, :774-782'deki `invoice-paid-elsewhere` korumasını atlatır (aşağıda risk R2).
  5. İstemci:
     - hof-cheques.js:654 `newFor` `{ invoiceId }` alıp gövdeye koyar.
     - hof-invoices.js:2427 `payForm` "Çek / Senet" seçince `newFor({ …, invoiceId: doc.id })` çağırır.
     - hof-accounts.js:982-985 cari formu seçili "Kapatılacak Fatura"yı aynı biçimde iletir (sessiz düşme kapanır).
  6. Bütünlük (tam kapı + süzgeç birlikte): `invoice:offset`'e "evrak bağı" alt denetimi eklenir. Kural: `cheque_events.invoice_id`
     boş değil VE `cheques.invoice_id` boş ise fatura issued olmalı ve evrakın carisine ait olmalı. Yerler integrity.mjs:528-539 ve
     integrity-scope.mjs:742-751; ikisine aynı anda eklenir (eşdeğerlik).
  7. Yevmiye, kâhin dili, expected ve LOCK_SQL değişmez. `cheque_events` kilit izinde yalnız `id, cheque_id, kind, amount, date, method`
     okunur (integrity.mjs:141); bağ kilitli izi değiştirmez.

**Testler (eklenecek veya güncellenecek).**
- Birim: fatura → bağlı çek → `paymentStates` faturayı kapatır, en eski faturayı kapatmaz. İptal → bağ düşer, evrak portföyde kalır,
  cari bakiyesi değişmez. Taksitli faturaya bağ 409 döner. Alış faturasına verilen çek de denenir. Senet de denenir. Bağlı çek
  karşılıksız dönünce fatura yeniden açılır (`classifyLine` bounce, invoice-settle.mjs:89-93). Mizan öncesi ve sonrası aynı kalmalı.
- Kırmızı kanıt: eski kodda bağ yok, en eski fatura kapanır (ders 7, 23). Mutasyon örnekleri: bağı `cheques.invoice_id`'ye yazmak
  (iptal evrakı siler); iptalde bağı temizlememek.
- Mevcut testlere bakılacak yerler: test/fatura-217.test.mjs ve test/bulgu-223.test.mjs (settleInvoices), test/cek-ciro-217.test.mjs,
  test/banka-220-cek-hesabi.test.mjs (verilen çekte hesap zorunluluğu), test/supheli-230-*.test.mjs.
- e2e: test/e2e/banka-210-ekran-aciklama-yetki.mjs:118-121 (m4 Fatura Tahsilat Ekle açıklaması yola göre) ve senaryo-216.mjs:381
  (`data-act="pay"`). Beklenti değişirse ilgili senaryo koşulur (ders 28).

**Riskler.**
- R1: Şüpheli alacak kuralı. `doubtfulSkipOf` yalnız `kind 'in'` satırına bakar (doubtful-gl.mjs:30-31; SQL ikizi
  bank/doubtful.mjs:86). Faturaya bağlı çek (kind 'credit') yine şüpheliden düşer, oysa faturaya bağlı nakit düşmez. Kuralı değiştirmek
  kâhin dilini de değiştirir; 2.4.4'te DEĞİŞTİRİLMEMESİ ve BİLİNEN SINIR yazılması önerilir.
- R2: `ownPaymentLines` (routes/invoices.mjs:733-740) şu an her `cheque_events.invoice_id` etkisini fatura ödemesi sayıyor. Sonradan
  bağlanan çek olunca "taksitlendirme" düzeltmesi fatura ile kartı ayrıştırabilir (:774-782).
- R3: Toplu kapama yolu "taksitli fatura bağını yok say" kuralını `account_entries` bağına uygular (routes/invoices.mjs:564-570, :629)
  ama olay bağına uygulamaz (:591, :638). Yeni bağ kurulurken taksitli fatura reddedilmezse 2.0.23 Bulgu 2'deki sorun geri gelir.
- R4: Verilen çekte, birden çok "Çek Kullan" hesabı varsa hesap seçimi zorunludur (routes/cheques.mjs:401-422). `newFor` tam evrak
  formunu açtığı için bu zaten karşılanır.

###### 5.2 E1 defter tarafı: e-SMM ile kâğıt SMM aynı kaydı mı üretir?

**Evet; defter belge profiline değil türe (`kind = 'smm'`) bakar.**
- Yevmiye: `kind === 'smm'` için B 120 ödenecek, B 193 stopaj / A matrah (gl_json), A 391 (KDV − tevkifat); kaynak adı "Serbest meslek
  makbuzu" (general-ledger.mjs:319-325). `rows()` fatura satırını profil okumadan yükler (routes/ledger.mjs:107-113).
- Beklenenler: 391 ve 193 (sale + smm) türe göre hesaplanır (routes/ledger.mjs:262-275). Carinin bakiyesi de türe göredir
  (`partyTotals` :364).
- Kalem hesabı: `lineAccount('smm')` = 600 (invoice-math.mjs:90-95). SMM'de stoklu kalem yasaktır (routes/invoices.mjs:1490).
- Cari satırı: `INVOICE_KINDS.smm.party = 'debt'` (invoice-math.mjs:40). Yazım `invoiceEntry.add`, source 'invoice' (routes/invoices.mjs:2007;
  routes/accounts.mjs:1404-1411).
- Stopaj oranı: tüzel kişi ya da VKN'li müşteride varsayılan stopaj oranı kullanılır (routes/invoices.mjs:1391-1393).
- Profil yalnız şunları belirler: seri (kâğıt `SMM`, e-SMM `ESM`, test `TES`; routes/invoices.mjs:80, :96, :1642), izinli profil
  (`esmmEnabled && s.esmm` ise yalnız ESMM; :1233) ve e-Belge durumu (`e_status`).
- `config.esmmEnabled` kapı noktaları: routes/invoices.mjs:139-140, :230, :450, :1243-1244.
- **Sonuç:** e-SMM'yi açmak defter, mizan, kapı ve kilit kuralında değişiklik GEREKTİRMEZ. İptal aynı `cancel()` yolundan yapılır
  (routes/invoices.mjs:2165-2219); belge `cancelled` olunca deftere girmez.

**E1 için defter/kapı uyarıları.**
- U1 (defter = belge): EDM'nin "nesne" yolunda (SendSMM, XML'i EDM üretir) EDM'nin dip toplamları bizimkinden kuruş kadar farklı
  çıkabilir. Defter `try_*` alanlarımızdan yazılır (D5). Resmî belge ile defter ayrışırsa bunu hiçbir kapı görmez. Öneri: UBL yolu
  (SendSMMPrepared; toplamlar bizden), ya da gönderimden dönen toplamların bizimkilerle kuruşu kuruşuna karşılaştırılması.
  DOĞRULANMADI: EDM yanıt alanları bu ortamda görülmedi.
- U2 (iptal): e-Arşiv iptali önce programda kuru deneme (`dryRun`) yapar, sonra EDM'ye, sonra yerel iptale gider (routes/invoices.mjs:2890-2930;
  `remoteEligible` yalnız EARSIVFATURA, :2878). e-SMM de aynı sırayı kullanmalı. Sıra bozulursa EDM'de iptal edilmiş ama programda
  (kilitli dönem, K7 ya da tahsil edilmiş çek yüzünden) iptal edilememiş belge kalır. 8 gün sınırı :2893'tedir; e-SMM'nin süresi kılavuzda YOK.
- U3: `INVOICE_KINDS.smm.send = false` (invoice-math.mjs:40). Bu yüzden `unsentNumbered` (routes/invoices.mjs:654) SMM'yi hiç
  "gönderilecek" saymaz. e-SMM için `send`'in profile bağlanması gerekir (E1/E6 alanı; defter etkisi yok).
- U4 (görünüm): gönderimde numara alacak, numarasız ama kesilmiş belge Yevmiye Defteri'nde "Taslak" etiketiyle görünür
  (general-ledger.mjs:318 `row.number || "Taslak"`). Numara ataması notlardaki geçici etiketi sonradan değiştirir (routes/invoices.mjs:3105-3112).
  Tutar etkilenmez. DOĞRULANMADI: ekranda görülmedi.

###### 5.3 DEVİR (2.5.0) §7 "Teknik ayrıntılar" referans denetimi (D0 değil; ön bilgi)

Doğru olanlar: migrations.mjs:1578 `LATEST_VERSION` (son göç 30), lib/accounts.mjs:42 `accountLedger`, routes/accounts.mjs:178 `list()`,
bank/money-lines.mjs:220 `createMoneyLines`, routes/cash.mjs:42 `balanceAt`, bank/accounts.mjs:764 `totalsOf`, lib/accounts.mjs:148
`stockLevel`, routes/plans.mjs:467/472 `leftOf`/`signedLeftOf`, lib/cheques.mjs:106 `portfolioSummary`, routes/overview.mjs:135 `compute()`,
general-ledger.mjs:404 `subBalances`, :434 `partyBalances`, integrity.mjs:116 `LOCK_SQL`, :224 `lockDigestOf`, app.mjs:135 ve :409
`busyCompanies` / 503, finance-report.mjs:164 `presetRange`, report-center.mjs:203 `rangeOf`. Satır verilmeyenler: `expected()`
routes/ledger.mjs:204, `openItems` routes/invoices.mjs:4238, `paymentStates` :602, `balances` money-lines.mjs:493.

Kaymış / yanlış olanlar:
- `summary(day) :739` (money-lines) → tanım **:505**. :739 yalnız `return {…}` dışa aktarım satırı.
- `setLock period.mjs:68` → tanım **:70**. :68 `return date;`.

§7 dışında hızlı bakılan referanslar:
- `company-separate.mjs:36` "VACUUM INTO düzeni" (§2 madde 2) → VACUUM INTO **:57**. :36 `busy.set`.
- `assertChronology :1675` (§4.4) → **routes/invoices.mjs:1678**.
- `cash-opening.mjs:16` → :16 açıklama satırı, `isCashOpening` **:17**.
- Kalan §2–§6 referanslarının hepsi tuttu: backup.mjs:130, db-path.mjs:12, companies.mjs:26/30/327/332/435, app.mjs:127/362/406,
  report-worker.mjs:22, routes/companies.mjs:73, license.mjs:659, bank/accounts.mjs:464/687/1175, module-ref.mjs:80, post.mjs:360,
  general-ledger.mjs:77/109/157/203/246/274/295/375/441/478, routes/accounts.mjs:491/1187, routes/plans.mjs:783/919, routes/stock.mjs:340,
  routes/cheques.mjs:697, routes/ledger.mjs:27/186-195, routes/invoices.mjs:602/622-645/703/1196/1657/3297/4238, invoice-settle.mjs:128,
  routes/admin.mjs:373, company-backups.mjs:612/643.

**Kör nokta (planın göç maddesi, §7.1 ve §4.1):**
- `cheque_events "devir" türü` eklenemez, çünkü `cheque_events.kind` için bir CHECK kısıtı var: `('receive','issue','collect','endorse',
  'pay','bounce')` (migrations.mjs:731). SQLite'ta CHECK'i genişletmek tabloyu yeniden kurmayı gerektirir. Bu, göçlerin "yalnız
  ekleyici" kuralına ve eski sürümün aynı dosyayı açabilmesine (K11) dokunur. `integrity_log` örneği (migrations.mjs:1344-1363) yeniden
  kurmanın nasıl yapıldığını gösteriyor, ama orada eski sürümün yazdığı değerler yeni CHECK'i de geçiyordu.
- Seçenekler: `cheque_events`'te yeni bir kolon (ör. `is_opening`), CHECK'siz yeni bir tablo, ya da açılışı `receive`/`issue`
  olayıyla yazıp işaretlemek. D0'da karar verilmeli.
- `account_entries.kind` (migrations.mjs:604) ve `invoices.kind` (:926) de CHECK'li. Plan bunlara yeni değer eklemiyor; yeni kolon
  eklemek sorun değil.
- 2.4.4 kendi göçlerini eklerse (e-SMM için alan gerekirse) §7.1'deki "sıradaki numara" değişir. Plan bunu "sıradaki" diye yazdığı
  için tutarlı.

##### 6. Riskler (alan geneli)

- Tam kapıya eklenen her denetim süzgece de eklenmelidir (integrity-scope.mjs). Eklenmezse eşdeğerlik `gateVerify` testlerinde yalnız
  bir yönde görünür.
- `cheque_events.invoice_id` FREE_COLUMNS'ta değil. Bu kolona bank.post dışından yapılan güncelleme test kipinde 500 `money-guard`
  verir (money-lines.mjs:127-137; db.mjs:144-145).
- Para çekirdeğine dokunan her değişiklik için: kırmızı test, mutasyon ve dar kontrol turu (ders 7, 32). UX18'in B seçeneği bu
  sınıftadır; A seçeneği yalnız istemcide kalır.

##### 7. Açık sorular (kullanıcıya)

1. UX18: Fatura ekranından alınan çek BU faturayı mı kapatsın (B; sunucu ve kapı değişir, dar kontrol gerekir), yoksa cari ekranındaki
   gibi en eski açık faturayı mı (A; yalnız istemci)?
2. Faturaya bağlı çek şüpheli alacaktan düşsün mü (bugün düşer, faturaya bağlı nakit düşmez)? Öneri: 2.4.4'te kural değişmesin, BİLİNEN
   SINIR yazılsın.
3. e-SMM gönderim yolu nesne mi (SendSMM) UBL mi (SendSMMPrepared)? Defter = belge eşitliği için UBL ya da dönen toplamların karşılaştırılması.

### EK-9 sunucu-genel

#### Sunucu-genel haritası (2.4.4 hazırlığı, 21.10.2026)

Kapsam: `server/server.mjs`, `server/app.mjs`, `server/supervisor.mjs` (yapı), `server/lib/{http,auth,permissions,access,profile,sections,config,net-proxy,dataset,sheets,free-sheets,reports,finance-report,pdf-write,xlsx-write,text-case,units,choices,license,secret-box,events,router,session-scope,client-state}.mjs`,
`server/routes/{report-center,overview,workspace,stock,companies,admin,documents,whatsapp,chat,auth,license}.mjs`.
Yöntem: yalnız okuma; her iddia dosya:satır. Koşulan test yok (görev salt okuma). "DOĞRULANMADI" = koddan çıkarım, çalıştırılarak görülmedi.

---

##### 1. Mimari özet

###### 1.1 Süreç ve açılış
- Üretim girişi `server/server.mjs:8` → `createApp({ edocEnabled: true, edocLive: true })`. **esmmEnabled verilmiyor** → `config.esmmEnabled` false (`server/lib/config.mjs:85`). E1'de e-SMM açılınca bu satıra `esmmEnabled: true` eklenmesi gerekir (ortam değişkeniyle açılmaz, bilinçli).
- IPC: servis yöneticisi altında `process.send({type:"ready"})`, kapat/yeniden başlat (`server/server.mjs:43-55`). Servis yöneticisi `server/supervisor.mjs` (HTTP kapısı :5123 → iç port, bakım sayfası, keşif, güncelleme orkestrası; `server/supervisor.mjs:1-10`).
- `createApp` (`server/app.mjs:89`): config → logger → dataDir/backupDir → (hub ise) bekleyen 001 geri yüklemesi (`:101`) → DB aç (`:103`) → şirket kayıt defteri (yalnız hub; `:108`) → göçler (`:144`) → ilk yönetici (`:157`) / kullanıcı aynası (`:158`) → banka yetki göçü (`:161-167`) → audit, bank.post, access, auth, recovery (`:169-176`) → olay hub'ı (`:182`) → dataset, free, profile (`:192-215`) → lisans (yalnız hub; `:216-232`) → `context` (`:243-252`) → rotalar (`:265-353`) → `handle` (`:355-384`) → çoklu şirket dağıtımı (`:405-503`) → zamanlayıcılar (`:556-579`) → `app` nesnesi (`:675-752`).
- Rota kayıt SIRASI önemlidir: yönlendirici ilk eşleşeni seçer (`server/lib/router.mjs:26-43`); servisler birbirine `() => context.x` tembel erişimle bağlanır (`server/app.mjs:275-353`).

###### 1.2 İstek yaşam döngüsü
1. `http.createServer` → `dispatch` (`server/app.mjs:516-521`, `:456-503`).
2. Şirket seçimi: `HUB_ONLY = /^\/api\/(auth|public|license|companies|health|admin\/(users|roles|recovery|update|backups))(\/|$)/` (`server/app.mjs:405`) ortak katmanda (001 örneği) kalır; öbür her `/api/` isteği `?hofCompany=` ile sayfanın şirketine (`:470-486`), yoksa kullanıcının seçili şirketine (`:487`) gider. Şirket yok → 409 `company-missing` (`:479-482`), yetkisiz → 403 `company-forbidden` (`:483-486`), açılamıyor → 503 `company-unavailable`, ASLA 001'e düşmez (`:488-501`).
   - Dikkat: `/api/admin/office`, `/api/admin/system`, `/api/admin/network`, `/api/admin/audit` HUB_ONLY DEĞİL → seçili şirketin örneğinde çalışır (`server/routes/admin.mjs:434-580`).
3. Kapsam: `runScoped({ user: tembel, page: ?hofPage })` (`server/app.mjs:389-399`; `server/lib/session-scope.mjs:9-10`). Veri oturumu ve profil kapsamı buradan okur.
4. `handle` (`server/app.mjs:355-384`): `/api/` + GET/HEAD dışı → `assertSameOrigin` (CSRF; `server/lib/http.mjs:179-190`) + `license.assertWritable(method, pathname)` (salt okunur lisans; `server/lib/license.mjs:659-664`) — rota eşleşmeden ÖNCE. Eşleşme yok → 404; yöntem yanlış → 405. `HttpError` → `{ok:false,error,...extra}` (+retry-after); diğer hata → 500 "Sunucu işlemi tamamlayamadı." (`:374-383`). `/api/` dışı → statik (`server/lib/static.mjs`; JS/CSS `cache-control: no-cache`, HTML `no-store` — `server/lib/static.mjs:69`).
5. Kimlik: `hof_session` çerezi (HttpOnly, SameSite=Lax; `server/lib/auth.mjs:10,89`); belirteç sha256 ile `sessions` tablosunda (`:96-103`, `:105-111`). `requireUser` must_change_password'da 403 `PASSWORD_CHANGE_REQUIRED` (`:201-206`); `requirePermission` → `canUser` (`:208-212`). Çocuk şirket kimliği hub'dan alır (`server/app.mjs:173-176`, `:441`); kullanıcı tablosu ad/rol gösterimi için çocuğa aynalanır (`:158`, `:448-452`).
6. Yetki: `access.attach` istek başına `user.perms: Set` kurar (`server/lib/access.mjs:43-46`); etkin yetki = rol + kişiye eklenen − kaldırılan (`server/lib/permissions.mjs:277-286`); yönetici her zaman bütün yetkiler (`:280`); `ADMIN_ONLY` (overview.card, users/system/license.manage) verilemez (`:103`, `:254`). Sunucu tek otorite, arayüz yalnız görünürlük (`:1`).
7. Gövde: yalnız JSON (`readJson`, 415/413/400; `server/lib/http.mjs:71-113`); dosya yükleme `x-hof-upload: 1` başlığı ister (`:117-152`). `text()` metni KIRPAR (`:192`), `limited()` onu kullanır (`:194-198`).

###### 1.3 Salt okunur lisans kipi
- Yazılabilir durumlar `transition, trial, licensed` (`server/lib/license.mjs:35`). Salt okunurda da izinli değiştirici istekler: `/api/auth/`, `/api/license`, `/api/admin/`, sohbet okundu, tanıtım kartı, oturum seçimi (`:57-66`).
- Ekrana giden yetkiler `license.permissionsFor` ile süzülür (`server/routes/auth.mjs:11`; `server/lib/license.mjs:658`) — süzülen liste `WRITE_PERMISSIONS` (`server/lib/license.mjs:46-53`).
- KÖR NOKTA: `tax.manage` (2.4.3 MM3, `server/lib/permissions.mjs:78`) `WRITE_PERMISSIONS`'ta YOK → salt okunur lisansta "Vergi Ödemesi" düğmeleri görünür, sunucu `LICENSE_READ_ONLY` 403 ile reddeder (`client/assets/hof-bank.js:499,1650`, `client/assets/hof-workspace.js:628`; çoğu yerde `cash.manage`/`bank.move` koşulu da olduğundan kısmen maskeli — `hof-bank.js:499` maskesiz görünüyor, DOĞRULANMADI ekranda). Katalog testleri yalnız sabit anahtar listesi sınıyor (`test/banka-210-yetki-katalog.test.mjs:41-42`, `test/license.test.mjs:599-601`).
- Lisans servisi adresi: `DEFAULT_LICENSE_SERVICES = ["https://destek-ofis.vercel.app/api/lisans"]` (`server/lib/license.mjs:33`), `HUKUK_LICENSE_URL` ile değişir (`server/lib/config.mjs:60`). Kendiliğinden deneme `enforce && autoTrial && !token && transitionStart == null` iken açılıştan 3 sn sonra (`server/lib/license.mjs:230,537-559,596-605`); `license.start()` yalnız hub'da ve `startLicenseTimers !== false` iken (`server/app.mjs:561`). Test yardımcısı `enforce:false` + `startLicenseTimers:false` verir (`test/helpers.mjs:23-24`).

###### 1.4 Olay yayını (canlı kanal)
- Her `createApp` örneğinin KENDİ olay hub'ı var (`server/app.mjs:182`; `server/lib/events.mjs:16`). `/api/events` HUB_ONLY değil → istemci sayfanın şirketinin hub'ına bağlanır (`server/routes/chat.mjs:6-11`; `client/assets/hof-live.js:35`).
- Yayınlar: `workspace.changed` (kind: records/source/activity/cash/bank/invoices/permissions/profile/sessions/reset/ledger…; işlemi yapan hariç — `server/routes/workspace.mjs:27-33`), `overview.changed` (para/stok kind'larından 250 ms birleştirilmiş, HERKESE; `server/routes/overview.mjs:30,54-68`), `license.changed` (`server/lib/license.mjs:331`, `server/routes/license.mjs:9`), `alerts.refresh` (gün dönümü; `server/lib/alerts.mjs:38`), `chat.*`.
- "ledger:changed" adlı bir olay YOK (DOĞRULANDI: `grep publish(` sonucu). Para değişince `overview.changed` tek kaynaktır; KDV Mahsup Fişi `kind:"ledger"` yayınlar (`server/routes/tax.mjs:245,262`), OVERVIEW_KINDS'ta yok (Kasa/Banka'yı değiştirmediği için doğru).
- KÖR NOKTA (DOĞRULANMADI, çalıştırılmadı): `license.changed` ve yetki değişikliği `workspace.changed{kind:"permissions"}` (`server/routes/admin.mjs:85`) HUB'ın olay hub'ında yayınlanır; 002'yi gösteren pencere 002'nin hub'ına bağlı olduğundan bu olayları almaz (köprü yok: `grep hub.events` boş). Etki: 002 ekranında yetki/lisans değişikliği sayfa yenilenene kadar görünmez. Test yok.

###### 1.5 Modül açma/kapama (profile)
- `profile().modules = { tahsilat: sector.modules.tahsilat || payments>0, haciz: sector.modules.haciz || liens>0 }` (`server/lib/profile.mjs:178-194`). Varsayılan sektör modülü `tahsilat: true, haciz: false` (`server/lib/insight/sectors.mjs:230,278`); bazı sektörler `tahsilat:false` (`:110-203`). Özel sektör `modules.tahsilat !== false` (`server/lib/custom-sectors.mjs:61`).
- İstemci `HOF.modules` → `html.hof-no-tahsilat` sınıfı (`client/assets/hof-insight.js:110-114`) → CSS gizleme (`client/assets/hof-ui.css:2121-2125`). Profil `/api/auth/me` (hub'ın profili; `server/routes/auth.mjs:33`) ve şirket kapsamlı `/api/workspace/insight/*` (`server/routes/insight.mjs:105-137`) uçlarından gelir.
- `server/lib/sections.mjs` modül değil: sekmedeki alt alta tabloları (bölümleri) ayıran Excel/Sheets okuyucu (`server/lib/sections.mjs:1-15`, `matrixToRecords :211`).
- Test: `test/insight.test.mjs:381` (`profile.modules` şekli), `test/custom-sectors.test.mjs:37`.

###### 1.6 Rapor merkezi
- Mimari: `REPORTS` dizisi (63 rapor; `server/routes/report-center.mjs:507-~2695`), `REGISTRY` (`:2696`), grup sırası (`:468-469`). Her rapor `build(query,user)` → `{title, subtitle, headers, types, rows, summary, footer...}`; ekran/PDF/Excel aynı modelden (`:5-7`).
- Yetki: `allowed` = `anyOf` | `standalone` (kendi izni) | `overview.view` + rapor izni (`:2759-2760`); giriş `enter` (`:2761-2765`).
- `run` (`:2777-2793`): banka raporları `worker:true` ise salt okunur anlık görüntüde iş parçacığında (`offload`; `server/app.mjs:339-341`, `server/lib/report-runner.mjs`); TOPLAM satırları `footerRows` (`:2789-2791`).
- Uçlar: liste `GET /api/workspace/report-center` (`:2795-2826`), ön izleme `/:id` (200 satır; `:2827-2831`), `/:id/pdf` (`:2834-2840`), `/:id/xlsx` (`:2842-2848`); dosyalar `server/lib/report-files.mjs:22,41` → `tablePdf` (`server/lib/report-pdf.mjs:25`) / `buildXlsx` (`server/lib/xlsx-write.mjs:114`).
- ANLIK DURUM kartı `GET /api/workspace/overview` (`overview.card`, yalnız yönetici; `server/routes/overview.mjs:214-215`), finans raporları mizan/ekstre/nakit akış/vade takip `.pdf/.xlsx` (`:259-680`; `overview.view`).

###### 1.7 Stok, yönetim, belgeler, WhatsApp, sohbet (yapı)
- Stok: `server/routes/stock.mjs` — liste/uyarı/kart/hareket/Excel alımı; para yazan hareket `bank.post` (`:239,420,480,514,772`); yetkiler `stock.view/move/sell/manage` (`:158-569`); PDF/Excel `liste.pdf` (`:265`), `export.xlsx` (`:287`), `:id/hareketler.pdf` (`:535`).
- Yönetim: kullanıcı/rol (hub; `server/routes/admin.mjs:87-310`), yedekler (hub; `:320-430`), işlem geçmişi (`:434`), ofis adı (`:446-459`; `system.manage`), güncelleme (`:479-512`), ağ/vekil (`:517-543`), sistem bilgisi (`:545-580`).
- Şirketler (hub): `server/routes/companies.mjs:44-248` (liste, Ayır, seç, oluştur, düzenle, sil, erişim, sıfırla, birleşik rapor). Sıfırlama gövdesi `server/app.mjs:603-672` (KEEP_SETTINGS `:612` — "client.", "invoice", "einvoice", "license." vb. korunur).
- Belgeler `server/routes/documents.mjs:40-145`; WhatsApp `server/routes/whatsapp.mjs:89-169` (`accounts.view`); sohbet + olay kanalı `server/routes/chat.mjs:6-55`; lisans `server/routes/license.mjs:11-54` (`license.manage`).
- Yardımcılar: `titleCase` (`server/lib/text-case.mjs:7-33`), birimler (`server/lib/units.mjs:4-17`), Excel liste/doğrulama okuma (`server/lib/choices.mjs`), Sheets okuyucu (`server/lib/sheets.mjs:185`), serbest sayfalar (`server/lib/free-sheets.mjs:40`), kalıcı tablo verisi + oturumlar (`server/lib/dataset.mjs:69`), tablo raporları (`server/lib/reports.mjs:23-318`), finans hesapları (`server/lib/finance-report.mjs:28-272`).

---

##### 2. Değişmezler (bu alanda bozulmaması gerekenler)
1. Değiştirici her `/api/` isteği rota çalışmadan önce aynı köken + lisans yazılabilirlik denetiminden geçer (`server/app.mjs:360-363`).
2. Yetkinin tek otoritesi sunucu; CSS/JS gizleme güvenlik sınırı değildir (`server/lib/permissions.mjs:1`).
3. Yönetici her yetkiye sahip; ADMIN_ONLY yetkiler role/kişiye verilmez (`server/lib/permissions.mjs:103,254,280`).
4. Şirket dağıtımı başarısızlıkta başka şirkete (001'e) düşmez (`server/app.mjs:488-501`).
5. Gizli değerler istemciye çıkmaz: entegratör parolası AES-256-GCM ile mühürlü (`server/lib/secret-box.mjs:31-53`), ekrana yalnız `hasPassword`/`configured` (`server/routes/invoices.mjs:450-455`), günlüğe yalnız `passwordChanged` (`:2349`); açılması yalnız bağlantı kurulurken sunucuda (`:480`). Vekil parolası da ekrana dönmez (`server/lib/net-proxy.mjs:299-305`).
6. Modüller veriye bağlı: verisi olan modül sektör istemese de gizlenmez (`server/lib/profile.mjs:178-194`).
7. Rapor: ekran/PDF/Excel aynı model + alt TOPLAM (`server/routes/report-center.mjs:5-7,2789-2791`).
8. Program adları her sözcük büyük; `test/yazim-duzeni.test.mjs:197-` `server/routes/*` içindeki rapor/PDF/Excel başlıklarını tarar → yeni rota dosyası da otomatik denetlenir.
9. Şirket sıfırlamada KEEP_SETTINGS önekleri silinmez (`server/app.mjs:612`).

---

##### 3. 2.4.4 maddeleri — dokunma noktaları ve öneriler

###### E8 (sunucu tarafı) — Kayıt kartındaki "Tahsilat" düğmesi CSS ile gizlenir
**Düğme:** `client/assets/hof-workspace.js:1212` `<button data-case-action="payment" data-requires="payments.create">Tahsilat</button>`; mevcut koşullu gizleme `client/assets/hof-ui.css:2121-2125` (`html.hof-no-tahsilat [data-case-action="payment"]`).

**Sunucuda payments.create'in anlamı (gizlemeden SONRA da geçerli kalanlar):**
- Katalog: "Kayda Tahsilat Girme — Kişi kartından tahsilat girer; tutar Kasa'ya düşer." (`server/lib/permissions.mjs:22,140`) — açıklama artık tam doğru değil (aşağıda açık soru).
- API: `POST /api/workspace/cases/:key/payments` (`server/routes/workspace.mjs:392-426`; bank.post, K7, dönem kilidi `:52-64`).
- Düzeltme/silme: `editablePayment` payments.create ister; başkasınınki için cash.manage (`server/routes/workspace.mjs:430-436`), PUT `:439-470`, DELETE `:471-500` → eski tahsilatlar İşlem Geçmişi'nde düzeltilir/silinir (`client/assets/hof-workspace.js:337,741,747,1187`).
- Kasa listesinde kayıt tahsilatının "düzeltilebilir" bayrağı (`server/routes/cash.mjs:183-186`).
- Silinenler'den geri yükleme izni (`server/routes/trash.mjs:356`).
- Banka hesap seçici izin listesi (`server/routes/bank.mjs:46`).
- Salt okunur lisansta gizlenen yazma yetkisi (`server/lib/license.mjs:47`).
- **Düğme dışında kalan arayüz yolları (KÖR NOKTA):** Zil/uyarı listesi "Tahsilat" (`client/assets/hof-alerts.js:277,285`) ve ödeme sözü şeridi (`client/assets/hof-promises.js:137-152`) `HOF.workspace.payment` (`client/assets/hof-workspace.js:1374`) → `actions.payment` (`:255-276`) çağırır. Tutarla gelen (`fromStrip`) istek taksit/cari yönlendirmesini ATLAR, doğrudan `payments`'a (Kasa) yazar (`:258,259,268-275`). 2.4.3 A2'nin "kayıt cariye bağlıysa tahsilat cariye" kuralı (`:268-275`; sunucuda `server/routes/workspace.mjs:330-333`) bu yolda uygulanmıyor → cariye bağlı kayıtta şeritten girilen tahsilat Kasa'ya düşer, cari borçlu kalır (DOĞRULANMADI, çalıştırılmadı; e2e kapsamı yok — `grep workspace.payment test/e2e` boş). Bu E8'den bağımsız, ama düğme kalkınca kayıt tahsilatının TEK arayüz yolu bu şeritler olur.
- **Düğmeyle birlikte kaybolan yollar (KÖR NOKTA):** (a) planı olmayan kayıtta "Taksit planı oluşturun" kısa yolu yalnız tahsilat penceresinde (`client/assets/hof-workspace.js:50-55`); `test/e2e/run.mjs:622-640` bunu sınıyor. (b) cariye bağlı kayıtta karttan cari tahsilatı (2.4.3 A2; `test/e2e/senaryo-cari-243.mjs:173-183,206-221`). Kayda bağlı taksit varsa doğru yol `#hof-case-plan` "+ Tahsilat" (`client/assets/hof-workspace.js:132`) kalır; cari için Cari penceresi.
- Profil modülü `modules.tahsilat` sunucuda değişmemeli (`server/lib/profile.mjs:194`; `test/insight.test.mjs:381`). Gizleme koşulsuz olunca bu bayrağın kalan etkileri: boş geçmiş metni (`client/assets/hof-workspace.js:1178-1179` "not, telefon, tahsilat veya haciz"), özel sektör formundaki "Tahsilat ve Kasa Takibi" kutusu (`client/assets/hof-insight.js:876`) ve önizleme metni "Tahsilat araçları açık olur" (`:1079`) — ikisi artık yanıltıcı.
- Rapor "Kayıt Kartından Tahsilatlar" (`server/routes/report-center.mjs:2550-2580`) payments + kayda bağlı carinin tahsilatlarını okumaya devam eder; ad/açıklama ("kartından girilen") yeni veride yanıltıcı olabilir (açık soru).

**Önerilen en küçük güvenli uygulama:** SUNUCUYA DOKUNMA. `client/assets/hof-ui.css:2121-2125` yanına koşulsuz kural: `.hof-case-actions [data-case-action="payment"] { display: none !important; }` (CSS no-cache ile istemciye ulaşır — `server/lib/static.mjs:69`). Boş geçmiş metni için `hof-workspace.js:1178`'de "tahsilat"ı listeden çıkarmak tek satırlık JS'dir; kullanıcı "yalnız CSS" dediği için ayrı onay iste (alternatif: metni olduğu gibi bırak, BİLİNEN SINIR).
**Testler:** (1) yeni birim test: `hof-ui.css` içinde `html.` önekli olmayan, `[data-case-action="payment"]`'ı `display:none` yapan kural var (eski kodda kırmızı — ders 7; CRLF'ye dayanıklı — ders 27). (2) e2e: kayıt seçiliyken `.hof-case-actions [data-case-action="payment"]` görünmez (`isVisible()===false`), Not/Telefon/Görev görünür. (3) `test/e2e/run.mjs:488,622,645`, `test/e2e/senaryo-banka-210b.mjs:214`, `test/e2e/senaryo-cari-243.mjs:173,206` → tahsilat API'den: kayıt tahsilatı `POST /api/workspace/cases/:key/payments {amount,date,method,note,caseTitle}`; cariye bağlı kayıt için `POST /api/workspace/accounts/:id/entries {kind:"in",...}` (`server/routes/accounts.mjs:771`); taksitli kayıt için taksit kutusunun "+ Tahsilat"ı (ekrandan, hâlâ var). `run.mjs:622` "Taksit planı oluşturun" adımı ya Taksitler → Yeni Kart'a taşınır ya da kaldırılır (kararı ana oturum verir). Hepsi koşulur (ders 28), sunucu testleri değişmez.
**Para çekirdeği:** hayır (sunucu ve para yolu değişmiyor).

###### KÖ3 "Başlarken" — durum kaynakları
Bugün böyle bir uç YOK (`grep -i başlarken|onboarding|checklist server client` boş). İlk ekran metni istemcide: `client/assets/hof-sources.js:410` "Excelini yükle…".

| Madde | Kaynak (sunucu) | Uç (bugün) | Yetki |
|---|---|---|---|
| Şirket adı varsayılanda mı ("Şirket 1") | şirket kayıt defteri `server/lib/companies.mjs:106,158`; `context.company()` `server/app.mjs:244` | `GET /api/companies` (hub; `server/routes/companies.mjs:44-48`), `/api/auth/me` `companyInfo` (`server/routes/auth.mjs:7,33`) | oturum |
| Ofis adı | `settings.office.name` (şirket başına) | `GET /api/admin/office` (`server/routes/admin.mjs:446-449`) | system.manage |
| Firma (satıcı) bilgisi tam mı | `invoice.settings.seller`; `sellerProblems(profil)` (`server/routes/invoices.mjs:361`) | `GET /api/workspace/invoices/meta` → `settings.sellerReady`, `sellerName` (`:2303,2326`); `GET /api/workspace/invoices/settings` → `problems.KAGIT/EARSIVFATURA/TEMELFATURA` (`:2336-2340`) | invoices.view |
| Entegratör bağlı mı | `integratorSummary` (`:455`), `lastTest` (`:3904`) | meta `settings.integrator.configured` (yalnız edocEnabled); tam ayrıntı settings (`:450-454`) | invoices.view / invoices.settings |
| İlk cari | `accounts` tablosu | `GET /api/workspace/accounts` (`server/routes/accounts.mjs:317`) | accounts.view |
| İlk fatura | `invoices` tablosu | `GET /api/workspace/invoices?limit=1` → `total` (`server/routes/invoices.mjs:2355-2362`) | invoices.view |
| İlk banka hesabı | `bank_accounts` | `GET /api/workspace/bank/summary` (`server/routes/bank.mjs:44,70`) | bank.view |
| Kasa açılış bakiyesi | `cashOpenings(store)` (`server/lib/cash-opening.mjs:28`) | Kasa listesi (`server/routes/cash.mjs:148-177`) | cash.view |
| Tablo verisi (Excel/Sheets) | `dataset.info().hasData` (`server/lib/dataset.mjs:403,1362`) | `GET /api/workspace/client-state` (`server/routes/workspace.mjs:706`) | oturum |
| Kullanıcılar | users | `GET /api/admin/users` (hub) | users.manage |
| Son yedek | `backups.latestFor` | `GET /api/admin/system` → `lastBackup` (`server/routes/admin.mjs:557-571`) | system.manage |
| "Kullanılmış kurulum" | `profile.usedBefore()` (`server/lib/profile.mjs:155-157`) | — | — |

**Önerilen en küçük güvenli uygulama:** tek salt okuma ucu `GET /api/workspace/getting-started` (yeni `server/routes/getting-started.mjs`, `server/app.mjs`'te invoices/bank/cash'ten SONRA kaydedilir; HUB_ONLY değil → şirket kapsamlı). Yalnız boole + sayı döner, her madde kullanıcının o modül yetkisi varsa listede; entegratörde yalnız `configured` (kullanıcı adı/parola/adres ASLA). Firma bilgisi için invoices servisinin dönüşüne `sellerReady(profile)` eklenir (`server/routes/invoices.mjs:4320` return listesi; tek satır, para dışı). Kapatma durumu kişi başına `client.gettingStarted.<userId>` ayarı (KEEP_SETTINGS "client." önekiyle sıfırlamada da kalır — `server/app.mjs:612`; istenmiyorsa "meta." değil başka önek seç). Gösterim koşulu: yönetici (system.manage) + kapatılmamış + en az bir eksik.
**Testler:** boş kurulum (hepsi eksik) / adım adım tamamlama (her adımda sayı) / iki şirket (002'nin listesi 001'den bağımsız — ders 17) / yetkisiz personel (yalnız yetkili maddeler, entegratör alanı hiç yok) / salt okunur lisans (GET çalışır) / yanıtta `password|passwordSealed|username` anahtarı yok (güvenlik). Başlık metinleri `titleCase` (`test/yazim-duzeni.test.mjs:197` otomatik tarar).
**Para çekirdeği:** hayır (salt okuma).

###### UI11 (sunucu üretimli PDF/Excel başlıkları)
- Bulgu metni (`docs/kanit/2026-10-18/uiux-a-243/uzman-ui-BULGULAR.md:83-89`): dışa aktarım DÜĞME adları ve renkleri ("Liste - PDF", "Cari Listesi - PDF", "PDF İndir", "Kasa Dökümü - PDF") + Fatura/Çek pencerelerinde çift başlık. İkisi de İSTEMCİ; sunucu düğme adı üretmiyor (`grep "PDF İndir|- PDF|label: \"PDF" server` boş).
- Sunucunun ürettiği belge başlıkları kurala uygun ve tutarlı: rapor merkezi `result.title || report.title` (`server/routes/report-center.mjs:2792`), dosya adı `reportFileBase` "<Başlık> <gg.aa.yyyy>" (`server/lib/report-files.mjs:16`); Kasa Dökümü "<Kasa> Dökümü · aralık" + altbilgi "DestekOfis · Kasa Dökümü" (`server/lib/cash-report.mjs:44,77,145`; 2.4.3 UI7 düzeltilmiş), "1.849 hareket" binlik ayraçlı (`:139`; UI9'un PDF kısmı 2.4.3'te kapanmış); Vade Takip "Gecikmiş Tahsilat/Ödeme" (`server/routes/overview.mjs:635-639`; UI8 kapalı); Cari Mizanı/Ekstre/Nakit Akış (`:288,300,327,351,452,487`); Stok "<Ad> Durumu" (`server/routes/stock.mjs:274,295`).
- Dosya adı tutarsızlığı (bilgi; UI11 kapsamı DOĞRULANMADI): `"${title}-durumu <tarih>.pdf"` (küçük harf, tireli; `server/routes/stock.mjs:285,297`), `Stok <ad>.pdf` (`:551`), `Sirketler Birlesik Raporu.pdf` (ASCII; `server/routes/companies.mjs:238`), rapor merkezi `<Başlık> <tarih>`. İstemci düğme adları değişince çağrılan URL'ler değişmez (tam liste: `server/routes/*` `.pdf/.xlsx` uçları — bkz. §4).
- **Öneri:** sunucuda değişiklik yok. İsteğe bağlı: dosya adlarını `reportFileBase` kalıbına çekmek (yalnız ad; içerik aynı) — ayrı küçük madde, e2e indirme adı beklentisi var mı önce bakılmalı (DOĞRULANMADI).

###### E5 — Entegratör kullanıcı adı denetimi (ayar kaydı yolu)
- Saklama: `settings` tablosunda `invoice.settings` JSON (`server/routes/invoices.mjs:51`), alt nesne `integrator {id, env, baseUrl, username, passwordSealed, senderAlias, mailboxAlias, autoSend, earchiveEmail, autoCheckUser, lastTest}` (`:117`). Şirket başına (her şirketin kendi DB'si); parola anahtarı şirketin veri klasöründe `secret.key` (`server/routes/invoices.mjs:152-153`; `server/lib/secret-box.mjs:11-30`) — yedek başka bilgisayara taşınınca parola açılmaz, yeniden girilir (`:1-4`, `server/routes/invoices.mjs:481`).
- Kayıt: `PUT /api/workspace/invoices/settings` (`invoices.settings`; `server/routes/invoices.mjs:2341-2353`) → `settingsInput` integrator dalı (`:296-326`). Kullanıcı adı `limited(input.username, 120, "Kullanıcı Adı")` (`:311`) → `text()` ile ZATEN baş/son boşluk kırpılıyor (`server/lib/http.mjs:192-198`). Parola kırpılmaz (doğru; parolada boşluk olabilir), boş gelirse kayıtlı korunur, `clearPassword` siler (`:312-317`).
- Okuma: `GET /api/workspace/invoices/settings` (`:2336-2340`) → `publicSettings` `passwordSealed`'ı atar, `hasPassword` verir; Fatura Ayarları yetkisi yoksa yalnız `configured` (`:450-454`). Parola yalnız bağlantı kurulurken sunucuda açılır (`:478-482`).
- İstemci (bağlam): alan `client/assets/hof-invoices.js:3156`; parola alanı zaten "Şifreli saklanır; kayıtlı parola ekranda gösterilmez. Değiştirmek için yenisini yazın." ve Göster ipucu "Yazılan parolayı göster" taşıyor (`:3157`); kayıt yükü `:3242-3245`, PUT `:3288`.
- **Önerilen en küçük güvenli uygulama:** sunucu (kâhin): `:311`'den sonra `if (/^\s*https?:\/\/|\.svc\b|\/EFaturaEDM/i.test(username)) fail400("Kullanıcı Adı alanına servis adresi yazılmış. EDM'nin verdiği web servis kullanıcı adını yazın; adres Servis Adresi alanına yazılır (boş bırakılırsa ortamın adresi kullanılır).", "integrator.username", { code: "integrator-username-url" })`. İstemci aynı kuralla kaydetmeden önce alan altında uyarır (sunucu yine reddeder). Kayıtlı eski hatalı ad: entegratör kartı her kayıtta `username`'i gönderir (`client/assets/hof-invoices.js:3243`); Fatura Ayarları'nın genel kaydı da `payload.integrator` taşıyabiliyor (`settingsPayload` `:3024-3058`, integrator dalı `:3049-3052`). Denetim her kayıtta uygulanırsa, kayıtlı hatalı adı olan kurulumda Fatura Ayarları'nın İLGİSİZ değişiklikleri (seri, varsayılanlar) de 400 alır. Öneri: denetimi yalnız ad değiştiğinde (`username !== prev.username`) sert uygula; değişmemiş hatalı ad için kayıt geçsin ama yanıtta uyarı (`warnings: [{field:"integrator.username"}]`) dönsün ve kartta gösterilsin; bağlantı denemesinde (`server/routes/invoices.mjs:478`) aynı kural açık 409 iletisi versin (EDM 11010'u beklemeden). Netlik metni zaten var; yalnız "Göster" yanında kısa ipucu istenirse istemci metni.
- **Testler:** (1) `PUT …/settings {integrator:{username:"https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc"}}` → 400 `integrator-username-url`, DB'de ad değişmedi (ders 3); (2) `"  kullanici  "` → kayıtta `"kullanici"` (zaten geçmeli — kırmızı değil, mevcut davranışın kilidi); (3) normal ad + parola boş → `hasPassword` korunur; (4) yanıtta parola/mühür yok. (1) eski kodda kırmızı (ders 7).
- **Para çekirdeği:** hayır.

###### EK — salt okunur lisansta `tax.manage`
- Dokunma: `server/lib/license.mjs:46-53` listesine `"tax.manage"`. Test: `test/banka-210-yetki-katalog.test.mjs:41`'e eklemek ya da genel kural testi "PERMISSIONS'taki her yazma yetkisi WRITE_PERMISSIONS'ta" (okuma yetkileri açık listeyle hariç). Eski kodda kırmızı. Para çekirdeği değil (yalnız ekran görünürlüğü; sunucu zaten reddediyor).

###### EK — E9 için güçlü ipucu (alan sahibi lisans-sizinti; burada yalnız kanıt yeri)
- `.github/workflows/windows.yml:36-60` master'a her push'ta (`:3-7`; release.yml de çağırır) GERÇEK kurulum dosyasını GitHub Windows koşucusuna (Azure) sessiz kurar; servis nssm ile açılır ve ortamı yalnız `HUKUK_INSTALL_ROOT, NODE_ENV, NODE_OPTIONS` (`packaging/windows/bin/servis-kur.cmd:58`) → `HUKUK_LICENSE_URL` YOK → `DEFAULT_LICENSE_SERVICES` (`server/lib/license.mjs:33`) + 3 sn sonra kendiliğinden deneme (`:230,604`).
- `:150` aynı işte `test/guncelleme-gercek/windows-kurulum.mjs` kurulu servisi `next = patch+1`, `next2 = patch+2` sürümlerine günceller (`test/guncelleme-gercek/windows-kurulum.mjs:124-127,231,292`) → paket 2.4.3 iken son çalışan sürüm **2.4.5** = Operatör Merkezi'ndeki yayımlanmamış sürüm. 2.4.3 birleştirmesi 19.10 14:24 TR (`git log package.json`: 163dd5d) ↔ kaydın son görülmesi 19.10 15:30 TR. Eşleşme güçlü, kayıtla birebir DOĞRULANMADI (Operatör Merkezi sorgulanmadı).
- İzolasyon testi yalnız `test/` altında `spawn/fork/execFile` ile program başlatan dosyaları tarar (`test/lisans-servisi-izolasyonu.test.mjs:13,25-29`); kurulum programının açtığı servis ve `.github/workflows/*`, `tools/*` taranmıyor.

---

##### 4. Dışa aktarım uçları (istemci adları değişirken URL'ler sabit kalmalı)
accounts `:883,904,919,942`; bank `movements.pdf/.xlsx` `server/routes/bank.mjs:351,357`; cash `server/routes/cash.mjs:220`; cheques `:654,678`; companies `:223,240`; invoices `:3042,3071,3866,3963,3971,3986,4022,4137`; overview `:283,292,322,341,447,467,645,664`; plans `:341,968,975`; report-center `:2834,2842`; stock `:265,287,535`; templates `:19`; workspace `export.xlsx :760`. Sıra denetimi: `.pdf/.xlsx` uçlarının hepsi `/:id` GET kalıplarından önce kayıtlı (ör. invoices `/:id` `:4221`, plans `/:id` `:590`) — çakışma yok.

##### 5. Bu alanın testleri (seçme)
`test/auth.test.mjs`, `test/permissions.test.mjs`, `test/license.test.mjs`, `test/lisans-servisi-izolasyonu.test.mjs`, `test/kullanici-yetki-210.test.mjs`, `test/yetki-gorunurluk.test.mjs` (her `data-requires` için CSS kuralı var mı; `:15-23`), `test/yetki-243-muhasebe-finans.test.mjs`, `test/banka-210-yetki-katalog.test.mjs`, `test/insight.test.mjs`, `test/custom-sectors.test.mjs`, `test/events.test.mjs`, `test/workspace.test.mjs`, `test/reports.test.mjs`, `test/raporlar-*.test.mjs`, `test/rapor-*.test.mjs`, `test/sirket*-*.test.mjs`, `test/documents.test.mjs`, `test/chat*.test.mjs`, `test/whatsapp-213.test.mjs`, `test/yazim-duzeni.test.mjs`; kayıt tahsilatı API'si ~25 dosyada kullanılıyor (ör. `test/cash.test.mjs`, `test/trash.test.mjs`, `test/banka-210-post.test.mjs`) → E8'de sunucu yolu değişmemeli.

##### 6. Açık sorular
1. E8: boş geçmiş metnindeki "tahsilat" sözcüğü için tek satır JS (`hof-workspace.js:1178`) kabul mü, yoksa yalnız CSS kuralı + BİLİNEN SINIR mı?
2. E8: `payments.create` katalog açıklaması ("Kişi kartından tahsilat girer") ve "Kayıt Kartından Tahsilatlar" rapor adı/açıklaması güncellensin mi? Değişirse `test/banka-210-yetki-katalog.test.mjs` ve yazım testleri etkilenir.
3. E8: kaybolan "Taksit planı oluşturun" kısa yolu ve cariye bağlı kayıtta karttan cari tahsilatı (2.4.3 A2) — kabul mü, başka yere mi taşınsın? `run.mjs:622` adımı buna göre yazılır.
4. E8: şerit/zil tahsilatının cari/taksit yönlendirmesini atlaması (`hof-workspace.js:258-276`) 2.4.4'te düzeltilsin mi (para yolu → dar kontrol), yoksa ayrı madde mi?
5. KÖ3: hangi maddeler (şirket adı, firma bilgisi, entegratör, ilk cari, ilk fatura, banka hesabı, Kasa açılışı, kullanıcı, yedek) ve kimlere (yalnız yönetici mi, muhasebe de mi); kapatma kişi başına mı şirket başına mı?
6. 002'de yetki/lisans olaylarının canlı ulaşmaması (§1.4) — bilinen sınır mı, düzeltilsin mi?

### EK-10 E9 tarama yardımcıları (lisans-araclar; ajanın yazdığı, ürün kodu değil)

`createapp-cagri.mjs`

```js
// Salt okuma: test/ ve tools/ altındaki her createApp( çağrısının seçeneklerinde lisans zamanlayıcısı/uygulaması kapalı mı?
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
const ROOT = process.argv[2];
function walk(dir, out = []) { for (const n of readdirSync(dir)) { if (n === "node_modules" || n === "artifacts" || n.startsWith(".")) continue; const f = path.join(dir, n); if (statSync(f).isDirectory()) walk(f, out); else if (n.endsWith(".mjs")) out.push(f); } return out; }
for (const file of [...walk(path.join(ROOT, "test")), ...walk(path.join(ROOT, "tools"))]) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const text = lines.map(l => (l.trim().startsWith("//") ? "" : l)).join("\n");
  let i = -1;
  while ((i = text.indexOf("createApp(", i + 1)) >= 0) {
    if (/function\s+$|import\s*\{[^}]*$/.test(text.slice(Math.max(0, i - 30), i))) continue;
    let depth = 0, j = i + "createApp".length;
    for (; j < text.length; j++) { if (text[j] === "(") depth++; else if (text[j] === ")" && --depth === 0) break; }
    const call = text.slice(i, j + 1);
    const line = text.slice(0, i).split("\n").length;
    const safe = /enforce:\s*false|startLicenseTimers:\s*false|HUKUK_LICENSE_URL|licenseServices|baseOptions\(|\.\.\.overrides|\.\.\.options/.test(call);
    if (!safe) console.log(`${path.relative(ROOT, file)}:${line}: ${call.replace(/\s+/g, " ").slice(0, 160)}`);
  }
}
```

`tarama.mjs`

```js
// Salt okuma: lisans-servisi-izolasyonu.test.mjs taramasının aynısını test/ + tools/ + packaging/ + .github üzerinde koşar, farkı yazar.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
const ROOT = process.argv[2];
const STARTERS = /startSupervisor\s*\(|["'`]bootstrap\.mjs["'`]|"server",\s*"server\.mjs"|"server",\s*"supervisor\.mjs"|supervisor\.mjs"\)\]/;
const SPAWN = /spawn\(|fork\(|execFile\(|execFileSync\(|startSupervisor\s*\(/;
const BROAD = /server[\\/]+server\.mjs|server[\\/]+supervisor\.mjs|bootstrap\.mjs|startSupervisor|Restart-Service|Start-Service|Start-Process|DestekOfis-Kurulum|servis-kur|nssm/i;
function walk(dir, out = [], exts = [".mjs", ".js", ".cjs", ".yml", ".cmd", ".ps1", ".iss", ".sh", ".py", ".go"]) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "artifacts" || (name.startsWith(".") && name !== ".github")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out, exts);
    else if (exts.some(e => name.endsWith(e))) out.push(full);
  }
  return out;
}
const rel = f => path.relative(ROOT, f);
const strip = t => t.split(/\r?\n/).filter(l => !l.trim().startsWith("//")).join("\n");
const current = walk(path.join(ROOT, "test"), [], [".mjs"]).filter(f => !f.endsWith("lisans-servisi-izolasyonu.test.mjs"));
const caught = current.filter(f => { const t = strip(readFileSync(f, "utf8")); return STARTERS.test(t) && SPAWN.test(t); });
console.log("BUGUNKU TARAMA YAKALAR (" + caught.length + "):"); for (const f of caught) console.log("  " + rel(f) + (readFileSync(f, "utf8").includes("HUKUK_LICENSE_URL") ? "" : "   <-- HUKUK_LICENSE_URL YOK"));
const all = [...walk(path.join(ROOT, "test")), ...walk(path.join(ROOT, "tools")), ...walk(path.join(ROOT, "packaging")), ...walk(path.join(ROOT, ".github")), ...walk(path.join(ROOT, "launcher"))].filter(f => !f.endsWith("lisans-servisi-izolasyonu.test.mjs"));
const broad = all.filter(f => { const t = strip(readFileSync(f, "utf8")); return BROAD.test(t) && (/\.(yml|cmd|ps1|iss|go|sh)$/.test(f) || SPAWN.test(t) || /powershell|execSync|exec\(/.test(t)); });
console.log("\nGENIS TARAMA (surec/servis baslatan aday) - bugunku taramanin KACIRDIKLARI:");
for (const f of broad) if (!caught.includes(f)) console.log("  " + rel(f) + (readFileSync(f, "utf8").includes("HUKUK_LICENSE_URL") ? "   [HUKUK_LICENSE_URL var]" : "   [HUKUK_LICENSE_URL YOK]"));
```

