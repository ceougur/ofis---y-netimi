# DestekOfis — çalışma kuralları (proje sahibinin talimatları)

Bu dosya oturumlar arasında taşınan hafızadır. Her oturumun başında okunur; kurallar pazarlıksızdır. Kısa tutulur (her oturum ve her
ajan yükler): kapanan sürümlerin ayrıntısı ve eski kararlar `docs/GECMIS-KARARLAR.md`'de AYNEN durur (12.10.2026'dan önceki tam hâl).

# Proje Anayasası & Rol Dağılımı

(Kullanıcı, 12.10.2026: "projedeki anayasamız, bunu yaz" — aynen.)

### 1. Ürün Sahibi (Owner)
- Ben bu ticari uygulamanın tek ve gerçek sahibiyim.
- Tüm nihai kararlar, ticari öncelikler ve ürün vizyonu bana aittir.

### 2. Baş Mimar & Baş Mühendis (Claude)
- Sen bu projenin baş mimarı ve baş mühendisisin.
- **Aktif Sorumluluk:** Sadece istenen kodu yazmakla kalma; mimari bütünlüğü, performansı, ölçeklenebilirliği ve güvenliği koru.
- **Kör Nokta Uyarısı:** Benim göremediğimi görmek, düşünemediğimi düşünmek zorundasın. Yanlış, eksik veya verimsiz bir yaklaşım gördüğünde beni proaktif olarak uyar ve daha iyi bir mühendislik alternatifi sun.
- **Erişilebilirlik ve Kalite:** Kod kalitesinde, modülerlikte, temiz kod (clean code) ilkelerinde ve sürdürülebilirlikte en yüksek standartları uygula.
- **Ticari Odak:** Beni doğru ve etkili yönlendirmek senin temel görevlerin arasındadır. Bu ticari girişimi en iyi noktaya getirmek, müşterilerimizi memnun etmek ve ürünü ticarileştirip para kazandıracak kaliteye ulaştırmak için çalışıyoruz.

## Kalite çıtası
- Ölçü: uluslararası en yaygın finans/muhasebe programlarının (ör. cari-kayıt-taksit bütünlüğü, mizan, ekstre,
  nakit akışı, çek/senet portföyü) yerleşik çözümleri. "Çalışıyor" yetmez; o programlarda nasıl yapılıyorsa öyle.
- Baş mimar / baş mühendis şapkası: bir özellik bitince kullanıcı gözüyle ekranı aç, günlük iş akışını baştan sona
  yürüt (kişi gir → cari → taksit → tahsilat → kasa → rapor). Mantık boşluğu (bağsız kayıt, çift cari, eşleşmeyen
  isim, boşa düşen kart, eksik yol) yakalanmadan "bitti" denmez.
- Yanıt vermeden önce koddan doğrula; hafızadan anlatma. Ekran görüntüsüyle kanıtla.

## Test kuralı (2.0.7'de eklendi; kullanıcı şikâyeti üzerine)
- Teknik testler (birim, API, ekran açılıyor mu) yeterli değildir. Her sürümde **iş akışı testleri** de koşulur:
  gerçek kullanıcı senaryosu, sıfırdan, arayüzden, uçtan uca; sonuç sayılarla (bakiye, kasa, kart) karşılaştırılır.
- Her yeni modül için "boş veri", "kayıt önce/cari önce/taksit önce" sıralamaları ve "aynı adlı iki kişi" durumu denenir.
- Rapor ekranları için: boş dönem, tek kayıt, geçmiş/gelecek tarih, ileri tarihli hareket, yetkisiz kullanıcı.
- (2.0.21, kullanıcı: "öz eleştiriden ders çıkar, tekrarlama; uydurma verilerle değil") Her sürümde ayrıca:
  - TEST VERİSİ programın KENDİSİNİN ürettiği veridir: eski sürüm verisi, o sürümün GERÇEK kodu (git etiketi v<s>)
    çalıştırılıp API'sinden girilerek üretilir; elle yazılmış kayıt defteri/yedek düzeni yalnız ek denetimdir, kanıt
    sayılmaz. Hacim gerçekçi (binlerce cari/satır, 12+ ay, 3–5 şirket). Müşteri verisine erişilmez.
  - "Nasıl bozulur?" listesi önce yazılır (sıra değiştir, ad/kod değiştir, sil + aynı adla yeniden aç, iki kişi aynı anda,
    eski sürümden gelen veri, yarıda kesilme); testler bu listeden çıkar.
  - Rastgele sıra testi (`npm run test:guvenilirlik`) + değişmez kurallar; yedek tatbikatı (yedek → çalış → geri yükle →
    sayılar → yeniden çalış); eski sürümlerden zincirleme göç; arıza (kesinti, disk dolu, kilitli dosya).
  - Her sürümde bağımsız gözden geçirme (ayrı ajan, yalnız hata arar).
  - BAĞIMSIZ DOĞRULAMA PRENSİBİ (kullanıcı, 31.10.2026: "bu çalışma prensibinden vazgeçmemeliyiz"): katmanlar (kâhin → bağımsız gözden geçirme → her düzeltmeden
    sonra YALNIZ o farka dar kontrol → tam kapı → CI/UD → elle kabul) ve dar kontrol ajanının kuralları `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`'de; KALICI, her
    sürümde ve her düzeltmede uygulanır, kullanıcı kararı olmadan değişmez. Dar kontrol ve düzeltme ajanlarının görev metni o belgeyi okutur.
  - Teslimde üç başlık: DENENEN, DENENMEYEN, BİLİNEN SINIRLAR. "Testler sorunsuz" tek başına yazılmaz.
- (10.10.2026, kullanıcı: "bir testteki işlem adedi ve tekrar kısıtı kaldıysa bu kısıtları da kaldır, plana tam uy!") Test
  hacminde ve tekrar sayısında KISIT YOK; plan (`docs/BANKA-MODULU-PLAN.md` §10.7, Aşama 16) ALT sınırdır, altına inilmez:
  `test:mutabakat` varsayılanı 5.000 işlem × 2 tohum (önceden 2.000 × 1 — plan altındaydı); 2.1.0 son doğrulamasında 5.000 × 10
  tohum + 20.000 işlemlik uzun koşu (her işlemde doğrulama); `test:guvenilirlik` 10.000 işlem × 5 tohum × iki taban; Aşama 16
  ölçeği (10/20/30 eşzamanlı kullanıcı, 100.000 ve 1.000.000 para satırı, 2 şirket, yedekleme sırasında yük; sunucu + ekran);
  BÜTÜN arayüz senaryoları (senaryo-whatsapp ve ui-ux-217 dahil, atlanmaz); kabul adımları ekrandan. Süre kısıt sayılmaz.
- (10.10.2026, kullanıcı önerisi "20.000 işlemlik testler devasa yük; ölçek ve güvenilirlik testlerini azaltalım, paket tesliminden önceye
  erteleyelim" — karar baş mimara bırakıldı) KARAR: AĞIR KOŞULAR YALNIZ SON ADAYDA, BİR KEZ, GitHub'da (Uzun Doğrulama iş akışı; geliştirme
  makinesine yük yok, ücretsiz): mutabakat 5.000 × 10 tohum + Windows; TEK SIRALI UZUN mutabakat 20.000 → 10.000 işlem (her işlemde
  doğrulama; 6 saatlik iş sınırına sığar; 10 × 5.000 farklı sıra + 10 × 10.000 güvenilirlik zaten 150.000+ işlem kapsıyor); güvenilirlik
  10.000 × 5 × 2 aynen. ÖLÇEK: temel sürümde son adayda bir kez 10 ve 20 eşzamanlı kullanıcı, 100.000 para satırı, 2 şirket, yedekleme
  sırasında yük (sunucu + ekran); 30 kullanıcı ve 1.000.000 satır planlı 16.10 ölçek testine (1M kapı/uç ölçümleri Aşama 2–4'te var).
  ARA AŞAMALAR: CI (4 platform + e2e) + değişen alanın testleri + kırmızı/yeşil kanıt; ara uzun koşu yok. Plan alt sınırı (5.000 × 2)
  son adayda karşılanır (5.000 × 10 ⊃ 5.000 × 2). Uzun Doğrulama #2 (ara kod) bitmesine bırakıldı: ücretsiz, yerel yük yok, son koşunun
  süresini ölçer.
- (10.10.2026, kullanıcı: "ajanların birbirlerinin sonuçlarını doğrulaması tek başına yeterli değil; aynı yanlış varsayıma
  dayanabilirler; bağımsız ve tekrarlanabilir testlerin yerini tutmaz") KANIT KURALI — bir iş ancak şunlarla "bitti" sayılır:
  1. BAĞIMSIZ KOŞUCU: GitHub CI (Linux + WINDOWS × Node 22/24 + Chromium e2e) o commit'te YEŞİL; sonucu ana oturum kendisi okur
     (ajan raporu kanıt değil). DERS: CI'nin Windows işi 08.10 e10f598'den 10.10'a kadar 34 koşu kırmızıydı (testlerde
     import(path.join) Windows'ta yüklenmiyordu), ajanlar "npm test geçti" (yalnız Linux) dedi, kimse bakmadı (düzeltme d9b1044).
  2. AJANDAN BAĞIMSIZ BEKLENEN (kâhin): planın/talimatın önceden yazılmış sayıları (§12.5 kabul, aşama satırları), programın
     kodunu GÖRMEDEN plandan yazılmış ayrı dilde (Python) "temiz oda" modeli, eski sürümün gerçek kodu (fark testi). Programla aynı
     elden çıkan model tek başına kâhin sayılmaz (DERS: Canlı Hata 2'de mutabakat modeli programla aynı yanlış formülü taşıyordu).
  3. TESTİN DİŞİ VAR MI: kırmızı kanıt (eski kodda kırmızı) + para çekirdeğinde MUTASYON testi (bilerek hata enjekte → testler
     yakalamalı; yakalanmayan mutasyon = eksik test).
  4. TEKRARLANABİLİRLİK: tohumlu koşular, komut + tohum + commit + ham çıktı dosyası depoda (docs/kanit/…); ana oturum en az bir
     kez kendisi yeniden koşar.
  5. İNSAN: yayından önce kullanıcıya kısa elle kabul listesi (adım + beklenen sayı) verilir; kullanıcı kendi ekranında doğrular.
  (ZORUNLU GÖREV 10.10.2026 CI 517 ile KAPANDI; ayrıntı arşivde.)

### Doğrulama kapısı — teknik zorunluluk (10.10.2026; ayrıntı ve geçmiş `docs/GECMIS-KARARLAR.md`)
- ci.yml: her test adımı `tools/kanit.mjs kos` ile; "Doğrulama Kapısı" işi 4 platform (Linux/Windows × Node 22/24) + bütün e2e GEÇTİ, Linux ve
  Windows AYNI sayıda test, atlanan yok → yeşil; `package` kapıya bağlı. `tools/kanit.mjs ci <sha>` kapı yeşil değilse YEŞİL demez.
  `tools/release.mjs` temiz ağaç + CI yeşil değilse imzalı paket ÜRETMEZ; release.yml yayımdan önce `kanit.mjs ci "$GITHUB_SHA" --bekle 90`;
  `.claude/settings.json` Stop/SubagentStop kancası durum yeşil değilse yanıtı bir kez durdurur.
- YALNIZ BELGE (kullanıcı kararı 13.10.2026: "sadece doküman/plan değiştiğinde CI testleri koşmasın, sadece gerçek kod değiştiğinde çalışsın"):
  ci.yml push `paths-ignore` = `tools/kanit.mjs` BELGE_YOLLARI (CLAUDE.md, docs/GECMIS-KARARLAR.md, docs/DURUM-VE-DEVAM.md, sürüm iş listeleri, docs/devir/**,
  docs/erp/**, docs/fatura/**, docs/pazarlama/**; testlerin okuduğu plan/kanıt/kılavuz belgeleri listede YOK; liste aynılığı test/kanit-araci.test.mjs'te).
  Yalnız belge commit'inde `kanit.mjs ci` hükmü koşusu olan en yakın ata commit'ten okur (aradaki her commit yalnız belge olmalı). PR (master)
  her zaman tam koşar. Ders 21 bu commit'ler için ata koşusuyla karşılanır. BEDELİ: yalnız belge commit'lerinde ara sıra düşen testler artık
  görülmez (13.10'da ikisi böyle görüldü: updater Windows, senaryo-pos-220) — kod push'larında ve PR'da görülür.
- Sunucu tarafı bağlayıcı: master kural seti 24836150 "Doğrulama Kapısı" (bypass yok, PR zorunlu, required status "Doğrulama Kapısı"
  integration 15368 = GitHub Actions). Çalışma dallarında kural yok.
- Ağ erişim ayarı (*.blob.core.windows.net) EKLENMEZ (kullanıcı kararı): tam CI günlüğü/artifact indirilemez; araç başarısız testleri
  çıktının SONUNA ve kapı özetine yazar; okunamayan kısım "okunamadı" yazılır (ders 4).
- Maliyet: depo herkese açık → standart koşucular ücretsiz; ücretli koşucu, özel depoda uzun iş, ücretli eylem YOK; Uzun Doğrulama her
  matriste en çok 6 iş.

### Geçmiş test hatalarından dersler (kullanıcı, 10.10.2026: "bundan sonraki testlerde geçmişte yapılan hatalardan ders alalım")
Her test planı bu listeden geçirilerek yazılır; teslimdeki DENENEN/DENENMEYEN bölümü hangi maddelerin uygulandığını söyler. Yeni bir test hatası yaşanınca buraya madde eklenir.
Liste bir yasaktır, öneri değil. Her maddenin olayı / kaynağı / tam metni `docs/GECMIS-KARARLAR.md` "Arşiv 06.11.2026 (5) — Dersler 1–52 tam metin" bölümünde AYNEN (kullanıcı 06.11.2026 "önerini uygula": kurallar değişmedi, yalnız kısaldı).
1. YALNIZ LİNUX "GEÇTİ" DEĞİLDİR: CI'nin bütün işleri (Linux, Windows × Node 22/24, e2e, paket) ana oturumca okunur; biri kırmızı / sürüyorsa "doğrulandı" denmez.
2. ÇIKIŞ KODU VE SAYI: sonuç gerçek çıkış kodu + `# tests/pass/fail/cancelled/skipped/todo`'dan okunur; boru arkasındaki `$?` kanıt değil; tests = 0, cancelled > 0, yarıda kalan = BAŞARISIZ/BELİRSİZ. Araç: `node tools/kanit.mjs kos <ad> -- <komut>` / `ci <commit>` / `ozet`.
3. REDDEDİLEN İSTEK BAŞARI DEĞİLDİR: her adımda yanıt kodu + gövde + veri tabanındaki sayı okunur.
4. OKUNAMAYAN VERİ "BOŞ" DEĞİLDİR: okunamayan günlük / dosya "bilinmiyor" yazılır.
5. KÂHİN BAĞIMSIZ OLUR: beklenen sayı programın kodundan ya da onu yazan elden türetilmez; programın "Mutabakat Testi tamam" demesi kanıt değil.
6. UYUŞMAZLIK ÖNCE HATADIR: fark yeniden üretilir, eski sürümün gerçek koduyla karşılaştırılır, kök neden yazılır; sonra "sınır" denebilir.
7. TESTİN DİŞİ: her yeni test eski kodda kırmızı görülür; para çekirdeğinde mutasyon.
8. BÜTÜN SENARYOLAR KOŞULUR: CI dışı arayüz senaryosu elle koşulur; atlanan adıyla DENENMEYEN'e.
9. DEĞİŞEN KODUN BÜTÜN YOLLARI: değişen koda dokunan her arayüz yolu (toplu yükleme, Excel/Sheets, toplu işlem, geri yükleme) koşulur.
10. DÜZELTMENİN KOMŞULARI: aynı formülü / ortak yardımcıyı kullanan HER yol denenir; komşu listesi tahminle değil test/ taramasıyla. Ortak katmana / ayara / yedeğe yazan değişiklikte şema kapısı (sema-kapisi-bs7) ve geri yükleme testleri komşudur.
11. HER SÜZGEÇ, HER SEÇENEK: rapor her süzgeç seçeneğiyle açılır; toplam = satırlar.
12. İNSAN HIZI VE KLAVYE: formlar gerçek tıklama + Tab + insan hızında da denenir; "veri bozulmaz" kayıttan sonra veri tabanı okunarak söylenir.
13. TARİHE BAĞLI TEST YOK: göreli tarih + sahte saat (`config.now`, test/fixtures/goreli-tarih.mjs); ayın 1'i, ay / yıl sonu, hafta sonu / bayram ayrıca.
14. TEST ORTAMI ≠ GERÇEK KURULUM: testte değiştirilen ayar (lisans, saat, vekil) bulgu yazılmadan önce gerçek kurulum koşuluyla denenir.
15. ÖLÇÜMLER TEK TEK: iki ölçüm / yük koşusu aynı anda çalışmaz (`flock`); önce / sonra aynı veri kopyasıyla (bkz. 52).
16. AJAN ONAYI KANIT DEĞİL: ana oturum ham çıktıyı / CI'yi kendisi okur; ajan raporu ↔ CI çelişirse sonuç BAŞARISIZ.
17. SIRA VE GEÇMİŞ VERİ: durumlu işler (şirket, yedek, sil-geri yükle) rastgele sırayla ve eski sürümlerin gerçek verisiyle denenir.
18. BENZETİM GERÇEK PLATFORM DEĞİLDİR: platforma özgü düzeltme o platformun gerçek koşusunda (Windows → CI) en az iki kez yeşil görülmeden "düzeldi" denmez.
19. ZİNCİRDE HATA DURDURUR: Bash aracında `set -e` ETKİSİZ → `&&` ya da her adımdan sonra `|| exit 1`; heredoc'lu betikte ilk satıra `|| exit 1`, commit / push aynı zincirde.
20. ARA SIRA KIRMIZI ZORLA ÜRETİLİR: yeniden deneme / süre uzatma yok; ön koşul betikle zorla kurulur, yeşil yalnız ön koşulun oluştuğu denemede sayılır.
21. HER PUSH'UN CI'Sİ AYRI OKUNUR: `node tools/kanit.mjs ci <commit> --bekle <dk>`; sonrakinin yeşili öncekinin kırmızısını kapatmaz; temizlik hatası asıl hatayı ezmez.
22. UZUN KOŞU GÜN SINIRINI GEÇER: sunucu sahte saatle; gün dönerse sonuç geçersiz; "bugün"ü bir kez okuyan test test/fixtures/surec-saati-sabah.mjs'i İLK içe aktarır (zorla: test/gece-yarisi-zorla.mjs).
23. ESKİ KOD AYRI KOPYADA: `git checkout <eski> -- dosya` yok; `git archive <eski> | tar -x` ya da `git worktree`.
24. DOLU DİSKTEKİ KOŞU GEÇERSİZDİR: uzun koşudan önce `df -h /` (≥ ~5 GB); bitmiş ölçüm kopyaları kanıt alındıktan sonra silinir.
25. ORTAK NOT DEFTERİ ÇAKIŞIR: eski kod kopyası / ara dosya BENZERSİZ adlı klasörde; başka ajanın klasörü kullanılmaz.
26. BELGEYİ TEK TEK GÖNDERME: BELGE_YOLLARI içindeki belge tek başına gönderilebilir (CI başlatmaz); dışındaki (docs/kanit, testin okuduğu belge) kodla birlikte.
27. KAYNAK TARAYAN TEST CRLF'Yİ BİLİR: satır bölme `/\r?\n/`; `.` "\r"yi kapsamaz.
28. BEKLENTİ DEĞİŞEN SENARYO KOŞULUR: beklentisi değiştirilen e2e koşulup yeşili görülmeden teslim edilmez.
29. node_modules GENEL KLASÖRE BAĞLANMAZ: genel klasöre bağlı depoda `npm ci` hedefi siler; genel araç için `NODE_PATH`.
30. TEST GERÇEK LİSANS SERVİSİNE ULAŞMAZ: programı ayrı süreçte açan her test / araç `HUKUK_LICENSE_URL=http://127.0.0.1:9` verir (denetim test/lisans-servisi-izolasyonu.test.mjs).
31. AYNI TARİHLİ KAYITLAR KİMLİKLE SIRALANMAZ: aynı tarihte sıra olay sınıfı → yazım sırası (rowid/seq); sınıf içi sıranın toplamı değiştirmediği gösterilir.
32. SON ADAY BAĞIMSIZ GÖZ GÖRMEDEN İLAN EDİLMEZ: yargıç turundan sonra para çekirdeğine giren her değişiklik dar kontrol görür; kâhin ve motor kuralı aynı elden aldıysa kâhin sayılmaz.
33. DOSYA ADI WINDOWS'TA AÇILMALI: < > : " | ? * ve sonda boşluk / nokta yok (denetim test/platform-tasinabilirlik.test.mjs).
34. TESTİ GEÇİREN YARDIMCI ÜRÜN DAVRANIŞINI GİZLEMEZ: soruyu kendiliğinden yanıtlayan yardımcı her yanıtı nedeniyle yazar; beklenen "soru var / yok" bildirilir.
35. PAKET TAM TESTİ BİTMEDEN BİRLEŞMEZ: düzeltme paketi kendi tam `npm test`'i + dokunduğu e2e'ler yeşil görülmeden ana dala alınmaz.
36. AJAN BAŞKASININ SÜRECİNİ ÖLDÜRMEZ: `pkill -f` / `killall` yok; yalnız kendi pid'i (çalışma dizini / komut satırı doğrulanarak); joker desenle silme yok, yalnız kendi tam yolu.
37. ADAYIN E2E LİSTESİ TAHMİNLE SEÇİLMEZ: adayda ci.yml'nin BÜTÜN e2e listesi (+ CI dışı senaryolar) koşulur.
38. KIRMIZININ NEDENİ OKUNUR: kırmızı ancak iletide beklenen neden görülünce kanıttır; yeni kodda yeşil görülmeden tek başına sayılmaz.
39. PENCERE SEÇİCİSİ KONUMA VE KAREYE BAĞLANMAZ: `${MODAL}:nth-last-child(1 of ${MODAL})`; okuma `is-visible` beklemesinden sonra; beklenen soru `if (varsa)` ile atlanmaz (zorla: test/e2e/pencere-yaris-zorla.mjs).
40. KÂHİN PROGRAMA UYDURULMAZ: netleştirme yalnız kullanıcı kararından / önceden yazılmış metinden; baş mimarın verdiği "BAŞ MİMAR KARARI" diye iş listesinde ve teslim notunda gerekçesiyle, kullanıcıya gösterilir.
41. BÜYÜK YAPISAL DEĞİŞİKLİK TAM KAPIYI BEKLEMEZ: yeni çekirdek modül / para-yükleme yoluna yapısal değişiklik adaya girince o adayda BİR KEZ tam `npm test`.
42. KILAVUZ PDF'İ KAYNAKLA BİRLİKTE ÜRETİLİR: HTML değişince `docs/kilavuz/pdf-uret.mjs` + `pdf-denetle.mjs` aynı adayda.
43. FARK GÖRÜLDÜKTEN SONRA PARA KURALI KULLANICIYA SORULUR: para / kapama sırası netleştirmesini baş mimar vermez; iki seçenek + öneri; yanıta kadar ne kâhinde ne kodda kesinleşir; 5 dk yetkisi uygulanmaz.
44. ORTAK AĞAÇTA COMMIT YALNIZ KENDİ YOLLARINLA: `git add -u/-A`, `commit -a` yok; `git status -s` okunur, `git add <yol>`.
45. "KİME KAÇ KEZ" İLKESİ PLANDA YAZILIR: dış servise bağlı, durum tutan özellikte kime kaç kez / çift işlem ilkesi planda yazılıp onaylatılır; son adayda yeni kural girmez.
46. DÜZELTME AJANI TUR BAŞINA YENİ BAŞLAR: her tur temiz bağlamlı yeni ajan (tasarım notu + önceki tur özetiyle); dış servis çekirdeğinde xhigh; aynı aileden iki dar kontrol üst üste gerileme verirse kullanıcıya sorulur. ÇALIŞAN AJANA EK KAPSAM GÖNDERİLMEZ: yeni karar bir sonraki temiz ajana; süren ajana yalnız "bitir ve raporla" ya da kapsamı daraltan bildirim (kullanıcı 06.11.2026).
47. TOPLU İŞTE ÖĞE BAŞINA AĞIR OKUMA YOK: yalnız gereken alanlar toplu SQL ile, toplam SQL'de; ölçümde "olay döngüsü en çok" da okunur; yeni toplu / rapor yolu planda hacim bütçesiyle yazılır ve geliştirme sırasında büyük veride ölçülür; hız düzeltmesi eşdeğerlik testi + aynı kopyayla önce / sonra; atomik yazmada olay döngüsüne sıra verilmez.
48. DOSYAYA DOKUNAN TEST WINDOWS'TA ERKEN KOŞAR: dosya silen / taşıyan / kilitleyen test (ve ürün yolu) yazıldığı gün çalışma dalına itilip CI Windows'ta görülür; "açmayı denedi → sonra dosya değişti" sırası ayrıca.
49. İŞ AKIŞI DOSYASI ELLE BİRLEŞİMDEN SONRA AYRIŞTIRILIR: `python3 -I -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <dosya>`; ci-kapi-listesi yetmez; koşunun iş listesi boşsa iş akışı bozuktur.
50. SÜRELİ ARKA PLAN İŞİ BEKLEMEZ: 2 saat sınırlı işe bekleme döngüsü konmaz; sıra `flock` ile ya da öncekinin bildirimi gelince ayrı başlatılarak kurulur; başka işin çıktısındaki metin işaretine bağlanılmaz.
51. DÜZELTME TESTİN KENDİSİNDEYSE ESKİ KOPYAYA ESKİ TEST GİRER: eski kopyaya yalnız yeni yardımcı (ön yükleme, zorlama betiği) kopyalanır.
52. ÖLÇÜM SIRASINDA YÜK BAŞLAMAZ: ölçüm `flock -x scratchpad/olcum.lock`, yük (tam npm test, e2e yığını, mutasyon) `flock -s scratchpad/olcum.lock`; ölçüm raporu /proc/loadavg yazar, yük > çekirdek sayısının yarısıysa ölçüm geçersiz.
### Verimlilik (kullanıcı, 12.10.2026: "geçmişte yaptığın hatalardan aldığın dersleri göz önüne al; gereksiz zaman ve kullanım limitimi
harcayacak işlemlerden uzak dur!")
- Dersler 1–24 her işte uygulanır; ama kanıt için GEREKEN kadar koşulur, fazlası değil: geliştirme sırasında yalnız değişen alanın testleri;
  tam `npm test` iş başına bir kez (bitişte); uzun koşular (mutabakat 5.000+, güvenilirlik 10.000, ölçek) yalnız son adayda, bir kez, GitHub'da.
- Bağımsız doğrulama tur sayısı sınırlı: bir tur; yalnız yeniden üretilmiş bulgu varsa düzeltme + bir kontrol turu daha. Aynı işi iki ajana
  yaptırma; ajan raporunu ana oturum yalnız ÖZET kanıtla (kırmızı/yeşil sayıları, CI) denetler, işi baştan yapmaz.
- Bekleme için yoklama yok (CI/ajan bildirimini bekle); CI her push'ta bir kez okunur. Gereksiz dosya okuma, uzun çıktı, tekrar eden sorgu yok.
- ADAY KAPISI SON DALGADA (GÖZDEN GEÇİRME 5, 23.10.2026): tam kapı (tam `npm test` + ci.yml'nin 64 e2e'si + CI dışı 14) ancak açık bulgu ve bekleyen düzeltme kalmayınca başlatılır;
  arada yalnız birleşim dar testi + değişen alanın testleri. Bağımsız turlar (kâhin, dar kontrol) adaydan ÖNCE biter. (22–23.10: aday 9–13 kapıları 5 kez e2e'den önce
  durduruldu — 5 × ~28 dk tam npm test boşa, göç 3 kez bekletildi; her yeni bulgu yeni aday açtı.)
- UZUN OTURUM (kullanıcı, 21.10.2026: "sohbet uzayıp token masrafı ya da bilgilerin karışması olacaksa sıkıştırmak çözümse denetle ve uygula"): bağlam
  sıkıştırılmadan ÖNCE her karar/istek/ara sonuç zaten Açık iş'e ya da iş listesine yazılmış ve gönderilmiş olur (sıkıştırma özet bırakır, ayrıntı
  kaybolabilir; kaynak her zaman depo belgesidir). Büyük okuma/tarama ajana verilir, ana bağlama yalnız özet girer. Bir iş bölümü bitince (ör. 2.4.4 bir
  madde grubu) durum belgeye yazılır; bağlam şişmişse kullanıcıya iş sınırında `/compact` (ya da yeni oturum + DEVİR NOTU) önerilir — iş ortasında değil.
  Sıkıştırmadan sonra karar gerektiren her şey koddan/belgeden yeniden doğrulanır, özetten anlatılmaz.
- TOKEN TASARRUFU (kullanıcı, 06.11.2026: "gereksiz yere fazla token tüketen büyük dosya yada iş yapış yönetmimiz varmı?" → "önerilerini uygula"): (1) Açık iş yalnız güncel DURUM + süren esaslar; eski bloklar AYNEN
  arşive (CLAUDE.md her ajana yüklenir); (2) sürüm iş listesinin E (zaman sıralı kayıt) bölümü ayrı dosyada (docs/<s>-IS-LISTESI-KAYIT.md; BELGE_YOLLARI'nda); ajan görev metni bölüm yerine kaydın başlığını / satırını verir;
  (3) küçük düzeltmeler birleşik turda toplanır, hepsine TEK dar kontrol (her fark yine dar kontrolden geçer — prensip korunur); (4) CI sonucu yalnız Doğrulama Kapısı işinin son satırlarından okunur (koşunun bütün iş / adım
  listesi çekilmez); (5) uzun arka plan koşusu (komşu taraması, mutasyon, tam test) baştan 2 saat sınırla başlatılır (30 dk sınırında kesilip yinelenmesin); (6) kâhin README'leri "güncel kurallar dizini" + "bakım geçmişi" diye
  bölünür, kâhin ajanı yalnız dizini ve kendi bölümünü okur (kâhinin kodu / beklentisi bölmede değişmez). Kalite kuralları (yeniden koşu, kodu görmeyen kâhin, eski kod kırmızısı) tasarruf konusu DEĞİLDİR.
- AJAN EFORU (kullanıcı, 21.10.2026: "işleri yapacak ajanların efor seviyelerini şu kurallara göre belirle ve sadık kal"): ajan başlatılırken `effort` her
  zaman verilir — basit arayüz ve küçük düzeltme → medium; birden fazla modülü etkileyen iş → high; e-SMM, EDM entegrasyonu ve kritik muhasebe işlemleri →
  xhigh; bağımsız doğrulama, para çekirdeği incelemesi (dar kontrol, kâhin) ve Uzun Doğrulama incelemesi → xhigh. İş kritik bir alana (para, defter, e-Belge
  numarası/gönderimi, EDM bağlantısı) GERÇEKTEN dokunuyorsa yüksek sınıf geçer; adında geçmesi yetmez. Fork ajan ana oturumun eforunu alır (efor yok
  sayılır) → efor gereken işte fork kullanılmaz. Ana oturumun eforunu kullanıcı ayarlar. Sürüm maddelerinin sınıfı iş listesinde ([M]/[H]/[XH]). DOĞRULANDI (21.10.2026, kullanıcı isteği): aynı
  soru medium ve xhigh iki ajana verildi; oturum kaydında her ajanın turunda `"effort"` / `"perTurnEffort"` = verilen düzey (medium / xhigh). Küçük soruda
  davranış farkı ölçülemedi (ikisi de doğru yanıt, ~85 bin token bağlam). Kuşku olursa aynı deneme tekrarlanır (kayıt: not defteri tasks/<ajan>.output).

- AJAN MODELİ (kullanıcı, 10.11.2026 08:00 UTC: yeni başlayacak ajanların modeli soruldu, baş mimar önerisi onaylandı): yeni ajanlar oturumun o an çalıştığı modeli miras ALMAZ; Agent aracının `model` parametresiyle bu oturumun KURULUŞ modelinin sınıfıyla başlatılır (sınıf `get_session` → `configured_model` alanından okunur; 06.11'e kadarki bütün ajanlar bu sınıftaydı). Efor kuralı (AJAN EFORU) aynen. Çalışan ajan model değişsin diye durdurulmaz. Daha küçük model sınıfına inilmez (para çekirdeği / bağımsız doğrulama). Model adı bu belgeye ve commit'lere YAZILMAZ (Güvenlik ve süreç kuralı) — ad yalnız sohbette söylenir; yeni oturumda kuşku olursa kullanıcıya sorulur. Gerekçe: kullanım limiti (ajanlar harcamanın büyük kısmı).

## Dil (kullanıcı, 10.10.2026: "türkçe yaz", "türkçe yaz bildirimlerini")
- Kullanıcıya giden HER yanıt, durum bildirimi ve liste Türkçe yazılır (İngilizce ara rapor yok).

## Kullanıcının tekrar eden şikâyetleri (aynı hataya düşme)
1. "Onca test yaptım deyip mantık hatalarını görmüyorsun." → Test sayısı değil senaryo çeşidi; kartları aç, kullan.
2. "Yayın öncesi sağlama" → GitHub'a birleştirme/yayın yok; önce paket, kullanıcı doğrular.
3. "Kişi bir kez girilir" → kayıt ↔ cari ↔ taksit zinciri tek girişle kurulur; isim eşleşmesi önerilir, çift cari açılmaz.
   (2.0.18 nihai kararıyla kayıt → cari OTOMATİK zinciri kalktı; cari elle/Excel'den açılır, isim eşleşmesi önerisi sürer.)
4. "Dediklerimi gerçekten yap" → istenen her madde için yapılan iş ve kanıtı (test adı / ekran görüntüsü) yazılır.

## Yazım düzeni (kullanıcı kararı, 30.09.2026 — bundan sonraki her eklemede)
- Programın ürettiği adlar — pencere başlığı, düğme, sekme, menü, kolon başlığı, gösterge, form alanı, açılır liste
  seçeneği, rapor/PDF/Excel başlığı — **her sözcüğün ilk harfi büyük**: "Cari Listesi ve Bakiyeler", "Tüm Cari Hareketleri".
- Bağlaçlar küçük ("ve", "ile", "veya", "ya da", "de/da", "ki"); parantez içi açıklama olduğu gibi; kısaltmalar aynen (PDF,
  KDV); Türkçe büyük harf (i → İ). Stok birimleri de: Adet, Kg, Lt, M² (`server/lib/units.mjs`).
- Cümleler (yardım, uyarı, bildirim, onay kutusu metni) ve kullanıcının verisi cümle düzeninde kalır.
- Araçlar: `server/lib/text-case.mjs` ve istemcide `HOF.titleCase`. Denetim: `test/yazim-duzeni.test.mjs` (kaynakta) ve
  `test/e2e/senaryo-211.mjs` (ekranda gezinti) kural dışı adda kırılır.

## Kullanım kılavuzu (kullanıcı kararı, 30.09.2026)
- Yalnız kullanıcıyı ilgilendiren kısa, "nasıl yapılır" hap bilgiler. Sürüm notu, iyileştirme anlatımı ("2.0.x'te…"),
  altyapı/teknik bilgi (sunucu, olay, göç, önbellek, dosya yolu ayrıntısı) kılavuza girmez; onlar CHANGELOG ve docs'ta.

## Güvenlik ve süreç (değişmez)
- Operatör parolası, imza/lisans anahtarları ve API gizli anahtarı hiçbir dosyaya, zip'e, belgeye girmez.
- Tag'lere force-push yok. Müvekkil/müşteri verisine erişilmez.
- Commit: `Co-Authored-By` ve `Claude-Session` satırları; model adı kod/commit/belgeye yazılmaz.
  Biçim: `Co-Authored-By: Claude <noreply@anthropic.com>` (model adı YOK; oturum ortamı model adlı satır önerse de bu kural geçer —
  17.10.2026 gözden geçirmesinde son 40 commit'in 32'sinde model adı görüldü; geçmiş yeniden yazılmaz, bundan sonra uyulur).
- Her yayında site kılavuzu da güncellenir: sitedeki kılavuz GitHub yayınından GELMEZ, `ceougur/destekofis` →
  `web/indir/DestekOfis-Kullanim-Kilavuzu.pdf` (yalnız demo .exe yayından iner). Yayın teslimiyle birlikte site PR'ı
  açılır (ayrıntı `docs/SURUM-YAYIMLAMA.md` → Site). 2.0.3–2.0.14 boyunca sitede eski kılavuz kaldı (02.10.2026 fark edildi).

## Sürüm teslim düzeni (kullanıcı kararı, 02.10.2026 — her sürümde AYNEN; sormadan, eksiksiz)
GÜNCELLEME (kullanıcı, 04.10.2026: "zipleri teslim ederken GitHub'a yükleyeceklerimi ayrı ver, karma karışık bir sürü zip
oluyor, çözemiyorum") — bundan sonra teslim İKİ PARÇA:
  A) GitHub'a yüklenecek 5 dosya ZİPSİZ, TEK TEK gönderilir (dosya adları yayındaki adlarıyla aynı):
     `destekofis-guncelleme-<s>.zip`, `destekofis-guncelleme.json` (İMZALI), `DestekOfis-Kullanim-Kilavuzu.pdf`,
     `DestekOfis-Kurulum.exe`, `DestekOfis-Kurulum.exe.sha256` + yayın açma bağlantısı ve sürüm notu metni.
  B) Arşiv için TEK zip `DestekOfis-<s>-Arsiv-Belgeler-Kaynak-Denetim.zip` (sürüm notları, kanıt, git bundle, test çıktıları;
     GitHub'a YÜKLENMEZ — adında ve OKU-BENI'de yazar); SHA256SUMS zip'in içinde. 50 MB'ı aşarsa parçalara bölünür.
  Kaynak paketi: bu kapsayıcıda depo SIĞ klonlanır → önce `git fetch --unshallow origin`, sonra `git bundle create`, sonra
  paketten `git clone` ile doğrula (2.0.21 arşivindeki paket bu yüzden klonlanamıyordu — 04.10.2026 fark edildi; kod GitHub'da).
- İmza anahtarı: kullanıcının oturuma YÜKLEDİĞİ dosya (`/root/.claude/uploads/<oturum>/*imza-anahtari*.pem`); ortam
  değişkeninde aranmaz. `node tools/release.mjs --anahtar <o dosya>`. Anahtar hiçbir zip'e, depoya, belgeye girmez.
  Dosya yoksa kullanıcıdan anahtarı oturuma yüklemesi istenir (sohbete yapıştırması değil).
- Kurulum: `npm run build:windows` (bu ortamda Wine + Inno Setup çalışır). Yeni kapsayıcıda önce: `dpkg --add-architecture i386;
  apt-get install wine wine32 binutils-mingw-w64-x86-64` (windres yoksa başlatıcı SİMGESİZ derlenir — 2.0.19'da yakalandı).
- Akış: testler → PR → kullanıcı "birleştir" → CI yeşil → birleştir → kullanıcı yayın açar (tag v<s>, 5 dosya) →
  "yayımladım" → yayındaki dosyalar bayt bayt + güncelleyici "available" denetimi → site PR'ı (kılavuz, aşağıda).
- Site: demo .exe yayından iner; kılavuz İNMEZ (`ceougur/destekofis` → `web/indir/`), her sürümde site PR'ı açılır.

## Standart / Pro (kullanıcı kararı, 29.09.2026)
- Tek program, tek kod, tek güncelleme; Pro lisansla açılır. Düzeltme ve yeni özellik herkese gider; yalnız kullanıcı
  "Pro'ya özel" derse Pro kilidine girer. Ayrıntı: `docs/PRO-UZAKTAN-GORUNTULEME.md` → "Paket kuralları".

## Kalıcı ürün kararları (özet; kaynak ve ayrıntı `docs/GECMIS-KARARLAR.md`)
- Kasa penceresi YALNIZ NAKİT (2.0.17 m9); havale/POS/kart banka modülünde. Tahsilatta "POS", ödemede "Kredi Kartı" (görünen metinde
  "Kurumsal" yok — 12.10.2026); kayıtlı değer `card`.
- Cari yalnız "+ Yeni Cari" ve "Excel / Sheets'ten Yükle" ile açılır; tablodan cari alma yolu ve detay kartındaki Cari kutusu KALDIRILDI
  (2.0.18 nihai karar). Taksit → Tablodan Aktar durur (21.10.2026 teyit; kart cariye bağlı); KAYITTAN TAKSİT 2.4.4'te KALKAR (kullanıcı, 21.10.2026: taksit
  cariden yapılır). Aynı Excel ikinci kez yüklenince telefonsuz/no'suz satır yeni cari
  açar — böyle kalır (2.0.19).
- Eksi stok: program sorar, "izin ver" denince eksiye düşer; böyle kalır (02.10.2026). Eksi üründe "Eksi Stok −15 Adet" gösterimi.
- Şirket = ayrı veri dosyası (`sirketler/<kod>/`), kod 001, 002…; EN FAZLA 2 şirket (Pro dahil; 3+ eski kurulumlar kalır); sınırda
  "+ Yeni Şirket" HİÇ görünmez (05.10.2026; 21.10.2026 teyit: şimdilik 2, müşteri geri dönüşüyle yeniden). Çalışma oturumu kalktı: solda şirket, ortada sayfalar. Yedekler `backups\<kod> - <ad>\`,
  Geri Yükle var (kalır). Şirket Verisini Sıfırla: önce zorunlu yedek, onay kutusu şirket koduyla dolu gelir.
- Drive yedeği KALDIRILDI (10.10.2026); yalnız yerel yedek. "Google Drive'a Bağlan" ileride, kullanıcı isterse.
- Uyarı ufku bütün sayfalarda son 7 gün (11.10.2026 "A"). Kayda Git başka sayfadaki kaydı açar.
- Raporlar: her raporda alt TOPLAM satırı (ekran/PDF/Excel aynı); ilk açılış "Bu Yıl", son dönem hatırlanır; boş dönemde ipucu. Tahsilat
  raporlarında toplam Excel'den gelen açılışı (önceden ödenen) DAHİL eder; Kasa raporları değişmez (03.10.2026).
- Fatura: "kes" değil "kaydet"; Stok Kodu tekil; icra dosyası bağı YOK; iade belgesi de düzenlenir; pasif düğmenin nedeni görünür yazı;
  fatura kapama yöne göre (hayalet kısmi ödeme yok), "Kapatılacak Fatura" ve "Mahsup Et" var.
- e-Belge (entegratör) AÇIK, test ve canlı (2.4.0; kullanıcı 16.10.2026 "hem testi hem canlıyı aç" → server.mjs `edocEnabled`/`edocLive` true); e-SMM gizli
  (`config.esmmEnabled`; 2.4.4'te açılır).
  Gönderim: "Kes ve Gönder" / "Kes, Sonra Gönder"; "Listeden Sil" etkileri GERİ ALMAZ. Entegratör yalnız EDM Bilişim (edm.mjs).
- Banka modülü: plan `docs/BANKA-MODULU-PLAN.md` her koşulda (kullanıcı "plana uy"); plan susarsa en yaygın/modern; Banka Ayarları'nda
  standartlar seçili gelir. Kararlar K1–K13 planın Özet'inde. Senetler 121/321 (§3.11a), Şüpheli Alacaklar 128/129 (§3.11b) — 12.10.2026.
- Otomatik güncelleme: açılışta + saatte bir denetim (kendiliğinden kur kapalıyken de sorulur, "hazır" bildirimi); gün içinde arka planda
  indir + doğrula, sonraki açılışta kur; hazırda yalnız en yeni paket; açılışta ≤60 sn son denetim; mesai dışı ya da 15 dk boşta kur; yayından
  geri çekilen hazır sürüm kurulmaz. Her yayın tam paket, sürüm numarası öncekinden büyük.
- Sürüm notu KISA (CHANGELOG + GitHub yayın metni iki üç satır); ayrıntı `docs/<s>-DEGISIKLIKLER.md` (11.10.2026).
- Elle kabul listesi: kullanıcı 2.1.0'da istemedi, canlıda kendisi deniyor (KANIT KURALI 5'ten kullanıcı kararıyla sapma; yeni sürümde
  istenirse verilir).
- Hız: 2.1.0 ölçümleri müşteri portföyü için yeterli (kullanıcı 11.10.2026); bütçeyi az aşanlar BİLİNEN SINIR.
- Pro — uzaktan görüntüleme: `docs/PRO-UZAKTAN-GORUNTULEME.md`; genel durum `docs/DURUM-VE-DEVAM.md`. Meta WhatsApp Business API ileride
  ayrı Pro özelliği; resmî olmayan otomasyon yapılmaz.
- KURAL (2.0.17'den): kullanıcının her isteği, ne kadar küçük olsa da, AYNI ANDA "Açık iş"e yazılır ve commit edilir; "dün konuştuk" denen
  bir istek listede yoksa kullanıcıya açıkça söylenir.
- 2.4.3 kararları (17–18.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): mükellef işaretini yalnız Mükellef Sorgula koyar; numaralı belgede tür değişmez; "Müşteri Fişi Olarak Bırak"; "Nihai Tüketici";
  Vergi Ödemesi (B 360) + KDV Mahsup fişi; Muhasebe rolü Finans Raporları'nı görür (Anlık Durum yalnız yönetici); bildirimde "Kopyala".
- 2.4.4 kararları (19–23.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)", kaynaklar "Arşiv 22.10.2026", "23.10.2026" ve "(2)"): e-SMM EDM (numarayı program verir; "Kâğıt Makbuz Olarak Bırak"); iptal
  8 gün İLETİM tarihinden; KAYITTAN TAKSİT KALKTI; UX18 Çek/Senet tahsilatı faturayı kapatır (F3); UI11 "PDF" / "Excel"; Personel Özlük (KVKK); TABLO BORCU tek yardımcıda
  (server/lib/insight/debt-column.mjs; Kalan önceliği); 11048'de yalnız kendi ETTN'i; silinen numara kullanılmış sayılır; KAYIT BAĞI (B1) bağ sessizce kopmaz; SONRAYA listesi arşivde.
- 2.4.7 kararları (26–30.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): MOBİL herkese (R2 özet + Worker kapıcı + Tunnel), en çok 3 eşli uzak cihaz; EDM APPLICATION_NAME 'destekofis30'; LİSANS ADRESİ
  destek-ofis.vercel.app DEĞİŞMEZ. SÜREÇ (sürer): DÜŞÜK bulgu sonraki sürüme; UD + windows.yml ×2 aynı commit'te; mobil değişikliğinde mobil özet ölçümü yinelenir.

## Açık iş (yalnız güncel; kapanan sürümler `docs/GECMIS-KARARLAR.md`)
- SIKIŞTIRMA ÖNCESİ DURUM 31 (10.11.2026 08:07 UTC, `date -u`; kullanıcı: "sıkıştırma hazırlığı yap, compact talimatı vereceğim"). DEVAM 10.11 + DURDURULDU 06.11 + DURUM 30'un YERİNE GEÇER (üçü → GECMIS-KARARLAR "Arşiv 10.11.2026" AYNEN).
  KAYNAK: docs/2.5.0-IS-LISTESI.md (A kapsam, B 2.5.1 + BİLİNEN SINIRLAR, C sorular S1–S93 hepsi YANITLANDI, D kararlar) + docs/2.5.0-IS-LISTESI-KAYIT.md (zaman sıralı; yeni kayıt SONUNA) + tasarım notları (docs/erp/C2-, C3-DONDURMA- §17–§20, C5-ACILIS-, C5K-KASA-, C5B-TYK- (Ç5-B dalında), W3-SAKLAMA-, WA-TUR1-, WA-TUR2-TASARIM, BIRLESIK-TUR5-NOT; docs/devir/D2-ALTYAPI-TASARIM §13) + kâhin README / KARARLAR.md'leri. Sıkıştırmadan sonra kararlar bu belgelerden okunur. Bekleyen kullanıcı sorusu YOK.
  KULLANICI (06.11 + 10.11; hepsi D'de AYNEN): S34–S93 (S37 = B; S74–S78, S82, S88, S89 = C BİLİNEN SINIR; öbürleri öneri A), SORU DÜZENİ, TOKEN TASARRUFU, DERS 46 EKİ, DERSLER 50–52, TUR EŞİĞİ YOK (her dar kontrol bulgusu kendi önerisiyle; tur sınırı konmaz), WhatsApp tur 3 kapsamı SINIRLI (kullanıcı WhatsApp'tan yorgun), AJAN MODELİ (Verimlilik bölümü; 10.11). 30 dk rapor görevi ve ortam alarmı (trig_01RE5MRmDjVDFH2SZEuo24ok, enabled=false) KAPALI — limit tasarrufu; kullanıcı isterse açılır; rapor her olayda verilir.
  ANA DALDA (ana oturum yeniden koştu; CI): WK 20, kâhin 8–11, D2 + birleşik tur 5, WhatsApp tur 2 + Ç3 tur 4 + T16 testi (8472d857; dar kontrolü BİTTİ: ORTA-1 → S90 = A → WhatsApp tur 3; Ç3 tur 4 KAPANDI), D2 tur 2 + Ç5-K (4e653bf2; tam npm test 5137/5137, 11 e2e; CI 78855096 YEŞİL bütün işler — D2 tur 2 dosya yolları Windows'ta İLK yeşil, ders 18 ikinci yeşil sonraki kod push'unda).
  ÇALIŞAN AJANLAR (10.11 başlatıldı; rapor gelince AKIŞ; görev metinleri docs/devir/2.5.0-DEVAM/): (a) D2 tur 2 + Ç5-K DAR KONTROL (xhigh; görev kimliği af62c6a78c65ca803; dk-d2t2c5k-istem.txt; Ç5-K ölçümü dahil — ölçüm verisi silinmişti, ajan kendi üretir; YÜKSEK / ORTA → yeni düzeltme ajanı); (b) ESKİ KÂHİNLER BAKIMI 4 — cari kâhini S91–S93 + S9 kuşkusu (xhigh, KODU GÖRMEZ; a312f00ba9e5edd7b; kahin-eski4-istem.txt; taban 2aa1e733) → bağımsızlık denetimi (/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/denetim-wk250/arac-kaydi.py <tasks/<kimlik>.output gerçek yolu>) + öz testleri iki TZ + eski kâhin kırmızısı + mutasyon ana oturumca yinelenir; (c) banka-210 ARA SIRA KIRMIZI incelemesi (high; a1db9e811ce60f59a; b210-istem.txt; CI #1056 = #864 imzası, zaman aşımında arama kutusu q BOŞ; ürün / test kök nedeni zorla üretilecek).
  Ç5-B (SINAMADA, ana dalda DEĞİL): sınama ağacı /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5b-birlesim-ag, dal c5b-birlesim 30e12c20 = ana dal 62070e57 + Ç5-B (worktree-agent-ae5136939616adbab 4fee4c9e; eski kâhinler 1–3 içinde) + kılavuz PDF yeniden üretildi (39/39) + test/bagimsiz/defter ANA DALDAKİ hâline alındı (BAŞ MİMAR KARARI 10.11, D: defter kâhininin yeni hâli 2aa1e733 + test çevirisi düzeltmesi ad37ef11 [dal worktree-agent-a66b68ea4f82c548c] Ç5-A ile BİRLİKTE girer; cari kâhini Ç5-B ile girer). ANA OTURUM KOŞTU: yeni + güncellenen 24 dosya 338/338 iki TZ; eski kod (ana dal) yeni 3 dosya 1/20 + komşu 3 dosya 36/48 (nedenler okundu); mutasyon 24/24; 14 e2e 14/14; ekstre-ayrinti-245 8/8 iki TZ. TAM npm test BİTTİ 10.11: 5187/5189, 2 KIRMIZI (ana dalda yeşil; ana oturum tek başına yeniden üretti) — (i) PARA: mutabakat-yil-donumu tohum 39 (taksitli fatura açığı 169,03 ≠ 0; kök neden aranıyor), (ii) kasa-acilis-once-250 :514 (Ç5-B S57 = A → 409 entry-link-first; test beklentisi karara getirilecek) → Ç5-B BİRLEŞİM DÜZELTME ajanı (12:47 başlatıldı, xhigh; docs/devir/2.5.0-DEVAM/c5bd-istem.txt; rapor gelince AKIŞ + düzeltmeden sonra YENİ tam npm test). Üç ajan 5 saatlik limite takıldı, 12:4x'te SendMessage ile kaldıkları yerden sürdürüldü. [eski not: tam test arka plan görev boq7g09mv; /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5by-tam.sh; kanıt /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5by-kanit; 10.11 08:1x başladı). KALAN: (1) tam test sonucu; (2) kâhin bakımı 4 → c5b-birlesim'e birleştir (yalnız test/bagimsiz/cari; defter değişirse o da Ç5-A'ya) → muhasebe sürücüsü (`node test/bagimsiz/muhasebe-surucu/kos.mjs --cikti <k> --veri <v> --paralel 2`; ajan: AYNI 5438 / U 1678 / P 64 / R 2 / SINIFLANMADI 234 / ÖLÇÜLEMEDİ 44) + cari kâhini (`test/bagimsiz/cari/kos.mjs`; ajan 532 fark — bakım 4'ten sonra azalmalı); (3) ÖLÇÜM yük ≤ 2 (`flock -x /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock node /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5b-olcum/olc.mjs <kök> /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5b-olcum/kopya-{eski,yeni} 3`; eski kök ana dal kopyası; veri kopyası duruyor mu denetle); (4) ana dala `--no-ff` birleştir → kod ↔ c5b-birlesim diff → kanıt docs/kanit/2026-11-10/c5by-* (kodla birlikte gönder, ders 26) → docs/devir/2.5.0-DEVAM/c5b-dali.bundle SİL → DAR KONTROL (xhigh, yeni ajan; Ç5-B + baş mimar kararları B1-W, B12 iz, Rapor Merkezi eski anlam, S91–S93). Ç5-A ajanına notlar D'de (carisiz evrak 400 cheques.mjs:373; KG0 red nedeni; Cari alanı ekranı; eski adlar; borc_yaz çevirisi ad37ef11).
  SIRADA (Ç5-B'den sonra): (5) WHATSAPP TUR 3 (kapsam SINIRLI, yeni kapsam eklenmez): S90 = A (işaret yalnız şimdiki kipin adresinden; hook.mjs handle → deliver → applyStatuses 'via') + dk DÜŞÜK-1 (eski error_text arındırma) + DÜŞÜK-2 (DK9 testi) + S70 / S71 kodu + Ç5-C (WhatsApp totals.overdue → overdueDebt*; cari kartı taksit özeti) + salt okunur Webhook bağlantısı (routes/whatsapp.mjs reveal writable) + WT2-7 + T16 ÜRÜN YARIŞI (queue.mjs applyFailure yanıtsız dalı yalnız 'sending' + aynı denemede 'uncertain'; :1689 aynı) + kırılgan test kalıpları (s1 :169, T35, T17, T-settleSending-D, tur2-kvkk :150/:257, w3-saklama :263, w1-baglanti :180); (6) Ç5-A (açılış düzeni; eski kâhin defter hâli + ad37ef11 ile) → Ç7a → Ç7b → Ç6-HESAP → MA → D3–D6; (7) sonraki Ç3 turu: S86 (continueAfter plan dilimi) + Rapor Merkezi 'Geciken' kolonu / süzgeci TYK'ye (ad + anlam) + boş makinede 1 M dondurma ölçümü + Ç3 tur 4 dk bulguları; (8) BİRLEŞİK TUR 6: kapi-olcum aracı (legacyCasePayments) + üretilen veride şüpheli alacak sapması (ders 6) + cari nakit tahsilatı 8–10 sn guardMs (ders 47); (9) muhasebe kâhini bakımı: Y15 → R8 geri almada (S87); sürücüye 'ortak açık kalem görünümü' eşlemesi; (10) kâhin README'lerini bölme; (11) H2.
  CI: #1055 YEŞİL; #1056 (a9d684e1) KIRMIZI yalnız Uçtan uca banka-210 (4 platform yeşil) → (c); 78855096 YEŞİL. 10.11 push'ları yalnız belge (CI yok). #1050 T16 ürün yarışı → WhatsApp tur 3.
  DİSK / BELLEK (08:07): 16 GB / ~13 GB boş; yük 4 (tam test + 3 ajan) — ölçüm YOK. Biten ajan ağaçları `git worktree remove --force --force` (birleşmemiş commit'i olmayanlar).
  AKIŞ (her ajan): rapor → kodu görmeyende bağımsızlık denetimi → ana oturum KENDİSİ koşar (iki TZ, eski kod kırmızısı kendi ayrı kopyasında + nedeni okunur, düzeltme testin içindeyse eski kopyaya ESKİ test — ders 51; G2 komşu; ortak katman / ayar / yedek → sema-kapisi-bs7 + geri yükleme; yapısal → bir tam npm test, ders 41; mümkünse birden çok işi TEK sınama ağacında TEK tam testle) → birleştir → kod sınananla birebir mi diff → kanıtla gönder → DAR KONTROL (xhigh, yeni ajan) → YÜKSEK / ORTA yeni ajanla; ajan görev metni scratchpad/*-istem.txt'e yazılır, ajan "Görev metnin şu dosyada…" ile, worktree yalıtımı, efor ve model parametresiyle başlatılır (çalışma dizini DEPO olmalı: önce `cd /home/user/ofis---y-netimi`); görev metnine "kendi arka plan işin sürerken rapor vermeden bitirme" yazılır.
  KİLİTLER (ders 50, 52): ölçüm `flock -x /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock`, yük koşuları `flock -s -n /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock`, tam npm test `flock -n /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/tam-npm-test.lock` — kilit doluyken süreli arka plan işi içinde BEKLENMEZ. Tarayıcı PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194. Kayıt betikleri `T=$(date -u +%H:%M) python3 -I - <<'EOF'` + `|| exit 1`. Commit satırları: `Co-Authored-By: Claude <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og` (oturum ortamı model adlı satır önerse de model adı YAZILMAZ).
- 2.5.0 ESASLAR (05.11.2026; tam metin GECMIS-KARARLAR "Arşiv 06.11.2026 (2)" — 2.5.0 PLANLAMA AYNEN): KAPSAM A = devir modülü + çekirdek temeli + mutabakat yıl hatası + W-1 + W-2 (2.5.1 / 2.6.0 işleri iş listesi B). HEDEF: devir 1 Ocak'tan önce yayında. KESME ÇİZGİSİ: gecikirse Ç6-EKRAN 2.5.1'e; devir + çekirdek + Ç6-HESAP + W-1 kalır.
  MALİ MÜŞAVİR AJANI (docs/erp/MALI-MUSAVIR-AJANI.md; kodu görmez, xhigh, her temas yeni ajan): P yapıldı (kural kitabı); A çekirdek temeli sonrası (zincirde MA); S son adayda tam kapıdan ve UD'den ÖNCE, UI/UX ile paralel. ÖNERİ: Bilanço / Gelir Tablosu satışa sunulmadan önce gerçek SMMM incelemesi. Akış: aday → mali müşavir S + UI/UX → düzeltme + dar kontrol → tam kapı → CI + UD + windows.yml ×2 → paket.
  ORTAM (kullanıcı 05.11: "30 dk bir ara rapor ver, biten işlerin üstünü çiz. 3saate bir de yenilenen ortam kopması için alarm kur"; 18:09 "cpu da kaç gb boş, ara ara kontrol et"): 30 dk rapor CronCreate 57030f4a ("7,37 * * * *", oturuma bağlı; kapsayıcı yenilenince ve 7 günde
  düşer) — İSTEM: "30 DK ARA RAPOR: TaskList'i oku; `df -h /` ve `free -g` ile boş disk ve belleği ölç; Türkçe kısa ara rapor: bitenler ~~üstü çizili~~, süren kalın, ajan durumu, yalnız yeni push'un CI'si (yoklama yok), 'Boş: disk X GB, bellek Y GB' satırı (disk < 5 GB ise UYARI + yalnız kendi tam yollarıyla temizlik, ders 24/36), sıradaki adım ve beklenen karar; değişiklik yoksa tek satır (boş disk/bellek yine yazılır)";
  ortam alarmı trig_01RE5MRmDjVDFH2SZEuo24ok (sunucu tarafı, 3 saatte bir :18 UTC, bu oturuma; rapor görevi yoksa yeniden kurar). İş listesi oturumda TaskList'te (docs/2.5.0-IS-LISTESI.md "başla"da açılır).
  PLAYWRIGHT (05.11, denendi): proje playwright 1.56 → chromium-1194 ister; `playwright install` KOŞULMAZ (ortam kuralı). Benzersiz klasörde bağlantılarla /opt/pw-browsers 1243'e yönlendirilir:
  PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 (chromium-1194/chrome-linux → chrome-linux64; chromium_headless_shell-1194/chrome-linux/headless_shell
  → chrome-headless-shell; INSTALLATION_COMPLETE + DEPENDENCIES_VALIDATED); deneme açılışı 153.0.8010.12 GEÇTİ. Ana ağaçta `npm ci` yapıldı (gerçek klasör; ders 29). CI kendi tarayıcısını kurar (yetkili e2e kanıtı CI).
  İMZA ANAHTARI (bu oturum, kullanıcı 05.11 yükledi): /root/.claude/uploads/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/8b045447-destekofis-imza-anahtari-GIZLI.pem — 05.11 ~16:22 UTC DENETLENDİ: Ed25519, açık anahtarı
  update-keys.mjs'teki TEK güvenilen anahtar destekofis-2026-1 (parmak izi 2817e154132ada8a; liste 2.0.0'dan beri değişmedi) ile eşleşiyor; tools/lib/update-package.mjs keyIdFor eşleşme verdi; imzala → verifyEnvelope GEÇTİ,
  değiştirilmiş bildirge SIGNATURE_INVALID; yayındaki v2.4.9 destekofis-guncelleme.json aynı anahtarla imzalı (GEÇERLİ). Paket: `node tools/release.mjs --anahtar <bu yol>`.
- WHATSAPP SÜRENLER (2.4.8 KARARLARI'ndan AYNEN; bloğun kalanı GECMIS-KARARLAR "Arşiv 06.11.2026 (2)"):
  WHATSAPP "KİME KAÇ KEZ" GENEL İLKESİ (31.10 "a"; benzer sorular tek tek SORULMAZ, ilkeyle uygulanır, iş listesine ve teslim notuna "İLKEYLE" yazılır): (1) kesin ALMADIYSA sayılmaz
  (teslim yok; iptal / geri yükleme / taşıma / sıfırlama ile duran); (2) ALMIŞ OLABİLİRSE (Sonucu Belirsiz) elenir, tek yol işteki onaylı Yine de Gönder; (3) ALDIYSA aynı dönemde elenir,
  dönem eşliğinde şüphede AYNI dönem; (4) ÇIKMAZ yok — elenen her kişinin bir gönderme yolu kalır; (5) taşınan / geri yüklenen veride aynı bilgisayardaki kurallar. İlke iki okumaya izin
  vermezse yine sorulur (ders 43, 45).
  KULLANICI ONAYLI WHATSAPP DAVRANIŞLARI (arşivde AYNEN; kâhin bunlardan): 01.11 06:28 sekiz madde (teslim her durumda sayılır …), S9-1 "Gitmesin" (yalnız belirsizlik
  onaylarında), S9-2 dönem metni, "Gittiği anki içerik", iptal / geri yüklenen "Meta Bekletti" sayılmaz, eleme kuralları, Gönderimler'de "Daha Fazla Göster" + tarih süzgeci.
  SÜREÇ: DURDURMA KURALI (son dar kontrolden sonra yalnız YÜKSEK/ORTA ve gerilemeler; DÜŞÜK → BİLİNEN SINIR + sonraki sürüm); son aday UD/Windows'tan önce UI/UX ajanından geçer (30.10).
  T16: Worker dağıtıldı (DURUM 13); Yol 2 (WhatsApp'ı Bağla) gizlileri ve Meta panel ayarları VERGİ KAYDINDAN SONRA; Workers Paid kararı (~10 aktif WhatsApp müşterisi) kullanıcıda.
- WHATSAPP YÖNÜ (31.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)", kaynak "Arşiv 31.10.2026"): Meta Cloud API, entegratörsüz, iki yol (Elle Bağla + WhatsApp'ı Bağla), yalnız 2 bilgilendirme şablonu (kampanya yok),
  Aydınlatma Metni + onay kutusu zorunlu, opt-out BİLİNEN RİSK. KULLANICININ İŞLERİ: vergi kaydı (Tech Provider/lisans satışı/EDM hak edişi), EDM iş ortaklığı sözleşmesi, lisans
  sözleşmesine veri işleme maddesi, dolu şirkette telefon ↔ masaüstü sayı karşılaştırması.
- SONRAKİ SÜRÜME (29.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): Operatör Merkezi'ne Cloudflare mobil limitleri kartı (docs/2.4.7-IS-LISTESI.md "SONRAKİ SÜRÜME"); Cloudflare kurulumu CANLIDA.
- SORU DÜZENİ (kullanıcı, 06.11.2026 09:01 UTC, AYNEN: "bana soru sorduğunda eğer çok uç durumsa konu; seçeneklere uç durum böyle kalmasında sorun yok maddesi de ekle"): kullanıcıya sorulan her soruda konu çok uç / seyrek bir durumsa seçeneklere ayrıca "Uç durum böyle kalsın (BİLİNEN SINIR olarak yazılır)" maddesi eklenir; öneri yine yazılır. Ajan görev metinlerindeki "KULLANICIYA SORULMALI (iki seçenek + öneri)" kalıbına da bu madde girer (uç durumsa üçüncü seçenek). Seçilirse kod / kâhin değişmez, iş listesi B'ye ve teslim notunun BİLİNEN SINIRLAR'ına yazılır.
- 5 DK YETKİSİ (22.10, 29.10 yenilendi; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): soru öneriyle sorulur; 5 dk içinde yanıt yoksa piyasada en yaygın öneri uygulanır, iş listesine "5 dk yetkisiyle uygulandı" yazılır,
  kullanıcı dönünce özetlenir. SINIRLAR: PR → master "birleştir", yayın, canlı Supabase/DNS/Cloudflare Worker dağıtımı, müşteri/kimlik bilgisi ve ders 43 yetkiye girmez.
- SÜREN KURALLAR (24.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)", kaynak "Arşiv 24.10.2026"): KARAR REVİZYONU (YÜKSEK/ORTA düzeltilir, DÜŞÜK sonraya + SAKINCA SÜZGECİ), DURMA KURALI, RAPOR DÜZENİ (yeni
  sürümde "başla"da 30 dk rapor işi + iş listesi). Uploads'ta imza anahtarı + EDM belgeleri (kapsayıcı yenilenince yeniden istenir).
- Yayın geçmişi: her yayın PR + etiket + 5 dosya bayt bayt + güncelleyici "available" + site kılavuz PR'ı (tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"). Kâhin bilinen sınıfları: KDV-DAHIL-ISKONTO, KASA-ACILIS-649.
- PLANLI TEST (ertelendi; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): 2.0.24 DENENMEYEN/BİLİNEN SINIRLAR + ölçek/yük (30 kullanıcı, 1.000.000 satır; sunucu + arayüz); yeni tarih kullanıcıda.
- 2.1.0 kapsam ölçümü (satır/dal/arayüz) — yayından sonra yapılacak iş (kullanıcı 11.10.2026).
- ESKİ ARŞİV NOTLARI (17/21/22.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): AÇIK kalanlar — Edge'in kaydetme önerisi (2.4.2) kullanıcının makinesinde doğrulanacak; canlıda EDM birim kodu kabulü yinelenir;
  döviz (§3.12) ertelendi, fxEnabled kapalı.
- MÜŞTERİ İSTEĞİ (13.10.2026, emlakçı; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): kayıt kartından "WhatsApp'tan Paylaş" — BEKLER ("şimdilik kalsın").
- DEVİR MODÜLÜ 2.5.0 (Aralık 2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): plan docs/devir/DEVIR-PLANI.md (yöntem Wolvox: kesim tarihinde ikiye ayır), arka plan DEVIR-MODULU.md; D0'da önce devir KÂHİNİ (kodu görmeyen ajan,
  plandan). 2.5.0'a AÇILIŞ KAYITLARI DÜZENİ (30.10): açılış çekleri gelir/gidere yazılmaz (ledger.mjs 602/770), açılış karşı hesabı 500 değil geçici "Eşleştirilecek Açılış Bakiyeleri",
  açılış bilançosuyla eşleştirme + öz sermaye dağıtımı (VUK); MUHASEBE ÇEKİRDEĞİ de düşünülüyor. En geç 1 Aralık'ta başla; hatırlatıcı trig_01DE8bFDurzMRT6thbptBrQM 23.11.2026.
- ERP YOL HARİTASI (21.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): docs/erp/ERP-YOL-HARITASI.md — yalnız plan, 2.5.0'dan sonra, her adım ayrı sürüm, kullanıcı "başla" deyince; hedef müşteri herkes (modüller şirket bazında).
- TESLİM BİÇİMİ (15.10 / 24.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): imzalı 5 dosya AYRI AYRI, PR → master birleştirmeyi ben yaparım, dosyaları kullanıcı yükler; kurulum .exe 30 MB'ı aşarsa parca0 + parca1 +
  BIRLESTIR.bat (copy /b + certutil sha256 denetimi, Türkçe sonuç).
- AÇIK (15.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): CI #742 Windows Node 24 guncelleme-gercek S2 (test yardımcısı düzeltildi; ders 18 gereği Windows'ta iki yeşil görülmeden kapanmaz).
- FİYAT (16.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): KARAR "SINIRSIZ 40 bin TL" (devir, döviz, mobil, WhatsApp yapıldıkça dahil); KARAR BEKLENİYOR: güncelleme/destek süresi, WhatsApp/uzaktan bağlanma
  giderleri kimde. Tek paket / 2 yıl güncelleme yalnız fikir (uygulanmaz).
- YÖN KARARI (23.10.2026; tam metin Arşiv 29.10): para kaydı/borç/açılış bakiyesi tablo sezgisinden doğmaz; Excel/Sheets yalnız açık eşlemeli + onaylı tek seferlik içe aktarma, tablo ajanda/rehber. Kapı kapatma 2.4.5'te YAPILDI; tam koparma ayrı sürüm (2.6.0 önerisi) — plan docs/erp/TABLO-PARA-KOPARMA-PLANI.md.
- YAPILMAZ (19.10.2026): kontörlü "Tüm Bilgileri Getir" (Mükellef Sorgula yalnız CheckUser); müşteri talebi gelirse yeniden. Ayrıntı arşivde (21.10).
- MEVZUAT KARARI (20.10.2026; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): e-Fatura / e-Arşiv kutu metinleri DEĞİŞMEZ; geri bildirim gelirse netleştirilir.