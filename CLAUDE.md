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
46. DÜZELTME AJANI TUR BAŞINA YENİ BAŞLAR: her tur temiz bağlamlı yeni ajan (tasarım notu + önceki tur özetiyle); dış servis çekirdeğinde en yüksek efor (11.11.2026 EFOR TAVANI'ndan beri high; önce xhigh idi); aynı aileden iki dar kontrol üst üste gerileme verirse kullanıcıya sorulur. ÇALIŞAN AJANA EK KAPSAM GÖNDERİLMEZ: yeni karar bir sonraki temiz ajana; süren ajana yalnız "bitir ve raporla" ya da kapsamı daraltan bildirim (kullanıcı 06.11.2026).
47. TOPLU İŞTE ÖĞE BAŞINA AĞIR OKUMA YOK: yalnız gereken alanlar toplu SQL ile, toplam SQL'de; ölçümde "olay döngüsü en çok" da okunur; yeni toplu / rapor yolu planda hacim bütçesiyle yazılır ve geliştirme sırasında büyük veride ölçülür; hız düzeltmesi eşdeğerlik testi + aynı kopyayla önce / sonra; atomik yazmada olay döngüsüne sıra verilmez.
48. DOSYAYA DOKUNAN TEST WINDOWS'TA ERKEN KOŞAR: dosya silen / taşıyan / kilitleyen test (ve ürün yolu) yazıldığı gün çalışma dalına itilip CI Windows'ta görülür; "açmayı denedi → sonra dosya değişti" sırası ayrıca.
49. İŞ AKIŞI DOSYASI ELLE BİRLEŞİMDEN SONRA AYRIŞTIRILIR: `python3 -I -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <dosya>`; ci-kapi-listesi yetmez; koşunun iş listesi boşsa iş akışı bozuktur.
50. SÜRELİ ARKA PLAN İŞİ BEKLEMEZ: 2 saat sınırlı işe bekleme döngüsü konmaz; sıra `flock` ile ya da öncekinin bildirimi gelince ayrı başlatılarak kurulur; başka işin çıktısındaki metin işaretine bağlanılmaz.
51. DÜZELTME TESTİN KENDİSİNDEYSE ESKİ KOPYAYA ESKİ TEST GİRER: eski kopyaya yalnız yeni yardımcı (ön yükleme, zorlama betiği) kopyalanır.
52. ÖLÇÜM SIRASINDA YÜK BAŞLAMAZ: ölçüm `flock -x scratchpad/olcum.lock`, yük (tam npm test, e2e yığını, mutasyon) `flock -s scratchpad/olcum.lock`; ölçüm raporu /proc/loadavg yazar, yük > çekirdek sayısının yarısıysa ölçüm geçersiz.
53. DEĞİŞEN YOL BÜYÜK VERİDE, YENİ ÇEKİRDEK ESKİ SÜRÜMLE SINIF SINIF ÖLÇÜLÜR: bir düzeltme bir isteğin yanıtını / okuduğu hesabı değiştiriyorsa o isteğin süresi temiz büyük veride önce / sonra ölçülür (kabul ölçümü yalnız 'hız işi'nin yollarını değil DEĞİŞEN her yolu kapsar); yeni çekirdek modülde eski sürümün gerçek koduyla karşılaştırma sınıf listesiyle (her kayıt türü × boş / eksik / tam) KALICI testte tutulur, karar numarasıyla açıklanmamış fark birleşmez. Dar kontrol üst üste gerileme verince sorulan 'nasıl ilerleyelim' sorusu BEKLENİR (5 dk yetkisi uygulanmaz).
54. TESTE ANA DEPONUN GIT DEĞİŞKENİ VERİLMEZ: test / araç koşusuna `GIT_DIR` / `GIT_WORK_TREE` verilmez — geçici klasörde `git init` / `commit` yapan test ana deponun dalına yazar; eski sürüm etiketi isteyen test `git worktree add --detach` kopyasında koşulur; her yeniden koşudan / ajan raporundan sonra `git status -sb` + son commit okunur.
55. SÜRE SINIRI TOPLAMDAN HESAPLANIR: zincirli arka plan koşusunda dış sınır her adımın ölçülmüş süresinin toplamı × 1,5'ten küçük olmaz; ağır tohumlar zincirin sonuna değil ayrı ve paralel, her biri kendi sınırıyla; sınıra takılan adım BELİRSİZ (ders 2), yalnız o adım yeniden koşulur (kullanıcı 26.11.2026: "tohumlar bugün 2. kez süre sınırına takıldı").
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
  EFOR TAVANI (kullanıcı, 11.11.2026 04:46 UTC, AYNEN: "bundan sonra hıgh eforun üzerinde ajan başlatma çünkü sen zaten daha üst model olarak koordine ediyorsun herşeyi"): bundan sonra BAŞLATILAN hiçbir ajanın eforu `high`ın üzerinde olmaz — yukarıdaki sınıflamada, ders 46'da, bağımsız doğrulama prensibinde, mali müşavir ajanı tanımında ve görev metinlerinde 'xhigh' yazan her yer `high` okunur (dar kontrol, kâhin, mali müşavir, para çekirdeği, düzeltme turları dahil — İSTİSNA YOK: kullanıcı 11.11 S116 = B, AYNEN "tavan efor hıgh kalsın"); medium / high ayrımı aynen. Çalışmakta olan ajan bu yüzden durdurulmaz (baş mimar yorumu; kullanıcıya söylendi). DURDURULMUŞ xhigh ajan SÜRDÜRÜLMEZ — iş yeni `high` ajanla baştan verilir. Derinlik açığını ana oturum kapatır: yeniden koşu, eski kod kırmızısı, eski sürüm fark testi, hız kabul ölçümü ve dar kontrol bulgularının yeniden üretimi AYNEN (kalite kuralları değişmedi).

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
  Ubuntu Wine 9: `/run/user/0` yoksa wineserver açılışta çöker ("free(): invalid pointer", ISCC iletisiz düşer) → önce
  `mkdir -p /run/user/0 && chmod 700 /run/user/0` (27.11.2026, 2.5.0 paketinde yakalandı).
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
- DURUM 45 + SIKIŞTIRMA HAZIRLIĞI (27.11.2026 18:54 UTC; kullanıcı AYNEN: "sıkıştırma hazırlığı yap"): 2.5.0 YAYIMLANDI ve kapandı (etiket v2.5.0). 2.5.1 SÜRÜYOR. KAYNAKLAR: iş listesi docs/2.5.1-IS-LISTESI.md (A durum tablosu, B sonraki sürüme, C sorular, D kararlar — BÜTÜN kullanıcı ve baş mimar kararları AYNEN orada), KAYIT docs/2.5.1-IS-LISTESI-KAYIT.md (zaman sırası, ajan kimlikleri, dal uçları, etiketler, koşu sayıları — SON kaydı sıkıştırma anlık görüntüsüdür), kapsam docs/devir/2.5.1-PLAN-TASLAK.md, görev metinleri + karar girdileri + raporlar docs/devir/2.5.1-DEVAM/ (üretici istem-uret.py; yeni görev metinleri kendi küçük üreticileriyle — <ad>-uret.py, ortak yardımcıları istem-uret.py'den alır), devir tasarımı docs/devir/D3-D4-TASARIM.md, Ödeme Hatırlatma ilke taslağı docs/devir/C5C-ILKE-TASLAK.md (ONAYLI). KULLANICI KARARLARI (27.11; iş listesi D'de AYNEN): kapsam = plan taslağı §1–§5'in TAMAMI; yeni muhasebe modülleri ayrı sürümde; devir S-1 / S-2 / S-3 = A; KDV Özeti devreden = B (zincirli); Değersiz sınırı S-M2-1 = B; müşteriye giden çıktılarda tek taksit numarası (S-Mİ1-1 = A); S-M1-3 = C ve SK-55 = C (BİLİNEN SINIR); DEVİR YERİ ve DEVİR NEDEN DURDU (aşağıdaki iki satır); S-KD-1 = A, S-KD-2 = A, S-KD-3 = B; Ödeme Hatırlatma ilke taslağı ONAYLI, on sorusu = A; S-T2-1 = B; S-DKM1-1 = A ve S-M1K-1 = A; S-UZ-1 = A; S-SUR-1 = B; S-SUR-2 = A; S-W21-1/2/3 ve SK-56/57/58 = A; YENİ (akşam): S-T4-1 = A (Dönem Kilidi'nden sonra kurulan bağ kilitli dönemin bağsız kapanışını KAYDIRMAZ — programın bugünkü tek borç sırası kaydırıyor, v2.5.0'dan beri; program düzeltilir), S-KD2-3 = A (Kural Değişikliği Farkı Düzeltme Fişi etkinken Dönem Kilidi'nin Kilidi Aç'ı reddedilir, Türkçe iletiyle 'önce düzeltme fişini ters kaydedin'), HIZ (AYNEN: "taksit tahsilat raporu, tüm cari hareket raporu ve devir ön izlemesi hız yavaşlamalarını düzeltmeyi sonraki sürüme bırak. bu haliyle geçsin" — iki rapor yavaşlaması ve devir ön izlemesinin süresi SONRAKİ SÜRÜME, BİLİNEN SINIR; baş mimar okuması: yapısal hız işinin öbür kalemleri kapsamda). BAŞ MİMAR KARARLARI (kullanıcıya gösterildi): aynı yılın ikinci kez devri DURDURULUR; uzmanın devir kabul ölçütleri devir paketlerinin şartı; ticari e-fatura yanıtı devirden sonra gelirse AÇIK KONU (devirli dosyanın kuralları adımında ölçülür); devir tur 4'ün dört 'baş mimar kararı gerekiyor' maddesi ilgili paketlerin şartı; muhasebe kâhini bakımı 2'nin iki sorusu önceki kararlardan yanıtlandı (mahsup kendi gününden etkili; bakiyesi sıfır caride iki açık kalem taşınır); DEVİR YERİ ↔ ÖLÇÜM PENCERESİ (devir tur 5 ölçümden sonra başladı). HEDEF: aday Ocak ortası, yayın 1 Şubat'tan önce. AÇIK SORU YOK. HIZ KABULÜ TAMAM (ölçüm penceresi 18:12–18:46, geçerli yük): Değersiz sınırı, KDV Özeti küçük tur, devir yedeği KABUL; müşteri istekleri kullanıcı kararıyla geçti. PAKETLERİN DURUMU (sayılar / etiketler KAYIT ve iş listesi D'de): (1) DEVİR ÖN KOŞULLARI — tur 1 ana dalda (GitHub'da iki Windows işi kırmızı — Windows yol uzunluğu); tur 2 yeniden koşusu AJANLA BİREBİR, hız KABUL; TEK SINAMA AĞACINDA; kalan: ekran senaryoları (koşuyor) → birleşim → Windows'ta İKİ yeşil (ders 18) → dar kontrol. (2) MÜŞTERİ İSTEKLERİ tur 1 + tur 2 — yeniden koşu AJANLA BİREBİR; hız kullanıcı kararıyla geçti; sınama ağacında; kalan: ekran yürüyüşü (tur 2'nin taksit numarası çıktıları) → birleşim (iki ekran senaryosu CI / yayın listelerine) → CI → dar kontrol (iki tura tek). (3) KDV ÖZETİ — ana dalda (gerileme ile); küçük tur rapor verdi, hız KABUL; KÜÇÜK TUR 2 AJANI ÇALIŞIYOR; iki tur TEK yeniden koşu + TEK dar kontrol + yeni ekran senaryosu CI / yayın listelerine. (4) DEĞERSİZ SINIRI — kod turu sınama ağacında, yapım aşaması listesi orada yeniden üretilip COMMIT'LENDİ (boş), hız KABUL; kalan: ana oturum yeniden koşusu (iki TZ, eski kod kırmızısı, mutant) → ekran yürüyüşü → birleşim (liste + ekran senaryosu CI / yayın listelerine). (5) DEVİR — saf hesap tur 1–4 rapor verdi (birleşmedi); TUR 5 AJANI ÇALIŞIYOR (devir yeri: tur 4'ün doğrulanmamış dört maddesi, S-T4-1'in devir tarafı, kâhinin iki okuması, test düzeni); ana oturum yeniden koşusu tur 1–4 (+5) birlikte SIRADA; kâhin ↔ devir planı karşılaştırması rapor verdi (yeniden koşu SIRADA; birleşimi saf hesap ana dala girince); muhasebe kâhini devir bakımı 2 RAPOR VERDİ (bağımsızlık temiz; yeniden koşu SIRADA); SONRAKİ muhasebe kâhini bakımının (3) girdileri iş listesi D'de (karşılaştırmanın yedi maddesi, S-SUR-1 / S-SUR-2, S-UZ-1, uzman ölçütleri, S-KD2-3, bakım 2'nin SONRAYA / DENENMEYEN listesi). (6) ÖDEME HATIRLATMA — WhatsApp kâhini 21 rapor verdi (yeniden koşu SIRADA); cari kâhini bakımı 31 YARIM (dört koşu ana oturumda; birleşimi Değersiz sınırı ana dala girince); WhatsApp kâhini 22 + cari kâhini 32 görev metinleri YAZILACAK (cari 32'ye S-T4-1 de girer); tek kod turu görev metni YAZILACAK (müşteri istekleri ana dala girdikten sonra; önizleme hızı kod turundan önce / sonra ölçülür). (7) KİLİT PAKETİ (YENİ; S-T4-1 + S-KD2-3) — tek kod turu; kâhin tarafı ÖNCE (cari kâhini 32 ve muhasebe kâhini bakımı 3); kabul: devir gerçek veri karşılaştırmasındaki tohum 11 farkı kapanır. TEK SINAMA AĞACI 2: not defteri sinama2/ (dal t251-sinama-2; çalışma dalı + devir ön koşulları tur 2 + müşteri istekleri tur 1–2 + Değersiz sınırı kod turu + liste commit'i); tam test tek kırmızı dışında yeşil — o kırmızının nedeni okundu (liste commit'lenmemişti; commit'ten sonra o test yeşil); beş ekran senaryosundan dördü yeşil, beşincisi (banka) koşuyor. ÖLÇÜM KOPYALARI not defteri olc251/ (dört seyrek kod kopyası + betikler + ham çıktılar; birleşimde ham çıktılar docs/kanit'e, sonra kopyalar zorlamasız kaldırılır). AJAN SIRASI (en çok 4; yük ≤ 4 ve boş bellek ≥ 2 GB iken): ÇALIŞAN 3 — cari kâhini 32 ve WhatsApp kâhini 22 (27.11 19:4x başladı), devir tur 5 (devir yeri); KDV Özeti küçük tur 2 RAPOR VERDİ (etiket t251-m1k2; S-M1K2-1 kullanıcıda); önceki sıra: cari kâhini 32 (İLK boşalan yere — kullanıcı sorusu 27.11 19:08, baş mimar UYGUN; görev metni kc32-istem.txt hazır) → WhatsApp kâhini 22 (wk22-istem.txt hazır) → Ödeme Hatırlatma kod turu + muhasebe kâhini bakımı 3 → KİLİT PAKETİ kod turu → WhatsApp küçükleri / mali tablo öncesi iş. SIRADAKİ ANA OTURUM İŞLERİ: (a) banka ekran senaryosunun sonucu; (b) Değersiz sınırı yeniden koşusu + müşteri istekleri ve Değersiz sınırı ekran yürüyüşü; (c) sınama ağacı 2'nin birleşimi (yapım aşaması listesi + üç ekran senaryosu CI / yayın listelerine; iş akışı dosyaları ayrıştırılır — ders 49) + gönderim + CI (Windows iki yeşil) + dar kontroller; (d) yeniden koşular: devir saf hesap tur 1–4, karşılaştırma, muhasebe kâhini bakımı 2, WhatsApp kâhini 21, cari kâhini 31'in dört koşusu, KDV Özeti küçük turlar; (e) görev metinleri: WhatsApp kâhini 22, cari kâhini 32 (S-T4-1 dahil), Ödeme Hatırlatma kod turu, muhasebe kâhini bakımı 3, kilit paketi; (f) GitHub'da banka senaryosu düzeltmesinin uçtan uca işi (banka senaryosu orada YEŞİL; işin tamamı sürüyordu) — bir kez oku; (g) devir planı belgesinin eskiyen satırları (devirli dosyanın kuralları adımından önce). DÜZEN: aynı anda en çok 4 ajan; yük > 4 ya da boş bellek < 2 GB iken yeni yük yok ('kullanılabilir' de yazılır); disk ≥ 5 GB, biten ajan ağaçları zorlamasız kaldırılır (ağaçtaki node_modules bağı önce tam yolla silinir; kilitliyse önce kilit açılır; rm hedefi her zaman "${X:?}" biçiminde ya da tam yol); ana oturumun yeniden koşu kopyaları kanıt klasörsüz seyrek ağaç (eski kopyaya yalnız yeni test dosyaları — yenide izlenen dosya SİLİNMEZ); kilit doluyken süreli arka plan işi içinde BEKLENMEZ (kilidin boşalmasını yalnız bekleyen ayrı iş kurulur, ölçüm sonra ayrı başlatılır); 30 dk ara rapor işi OTURUM İÇİ (sıkıştırmadan sonra CronList ile bak, yoksa CronCreate: saatin 17 ve 47'si); her komut `cd /home/user/ofis---y-netimi` ile başlar; GitHub okuma aracı ilk kırmızıda döner — sürmekte olan işler sonraki ara raporda BİR KEZ yeniden okunur (yoklama yok); kırmızı işin düşen adımı her seferinde iş günlüğünün son satırlarından. (a) SIKIŞTIRMADAN SONRA İLK ADIMLAR: `cd /home/user/ofis---y-netimi`; ortam (nproc, loadavg, free -g, df -h /); bu dosya + docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md + derslerin tam metni (GECMIS-KARARLAR 'Arşiv 06.11.2026 (5)'); docs/2.5.1-IS-LISTESI.md (A, B, C ve D'nin TAMAMI — uzun satırlar python ile, kısaltmadan) + KAYIT'ın son altı kaydı (tamamı); `git status -sb` + son commit + `git worktree list` + `git tag -l 't251-*'`; çalışan ajan / arka plan işi listesi (KAYIT'ın son anlık görüntüsünde); 30 dk ara rapor işi duruyor mu. Okunmayan bir parça varsa kullanıcıya AÇIKÇA söylenir. DURUM 44 GECMIS-KARARLAR 'Arşiv 27.11.2026 (8)'de AYNEN.
- DEVİR YERİ — 2.5.1 (kullanıcı 27.11 10:26 UTC (AYNEN: "1 ajan sürekli devir zincirinin işini yapsın, maş mimar olarak senin içinde uygunsa"); baş mimar değerlendirmesi UYGUN — iş listesi D'de AYNEN): dört ajan yerinden BİRİ sürekli devir zincirine ayrılır ve boş bırakılmaz; her adım / tur temiz bağlamlı YENİ ajandır (ders 46), bir adımın raporu gelince sıradaki devir adımı aynı turda başlatılır (öncekinin dal ucundan; ana oturumun yeniden koşusu ve dar kontrol AYNEN sürer, bulgusu sonraki tura girer). Devir kâhini bakımı, kâhin karşılaştırması ve dar kontroller bu yere sayılmaz (ayrı ajanlar). Yük / disk sınırları ve ön koşullar AYNEN; hiç devir işi kalmazsa kullanıcıya söylenir. Ana oturum devir zincirini bekleten birleşimleri öne alır.
- DEVİR NEDEN DURDU — 2.5.1 (kullanıcı 27.11.2026 11:39 UTC, AYNEN: "devir yapılırken bir sebeple duruyorya, nedenini kullanıcıya açıkça türkçe yazsın program, önerilerine ek olarak bunuda uygula."; iş listesi D'de AYNEN + baş mimar okuması): devri durduran HER neden (ön denetim, hesap tutarsızlığı, uygulama hatası, geri alma / yenileme reddi) kullanıcıya açık Türkçe cümleyle yazılır — ne oldu (kayıt / cari / tutar / tarih), devir neden duruyor, ne yapmalı, nereye gidilecek; iç kod / İngilizce ileti gösterilmez; birden çok neden birlikte listelenir; Devir Raporu'nda da yer alır. Devirle ilgili HER görev metnine ve dar kontrol metnine girer; ana oturum ekran yürüyüşünde cümleleri OKUR. Aynı iletiyle üç devir sorusu öneriyle yanıtlandı (iş listesi C / D).
- AJAN MODELİ VE EFORU — 2.5.1 (kullanıcı 27.11.2026 06:07 UTC; model adı sohbette verildi, kural gereği buraya YAZILMAZ; kalanı AYNEN: "işleri yapacak ajanlar [model adı] high efor olsun"): 2.5.1'de işleri yapacak BÜTÜN ajanlar oturumun KURULUŞ modelinin sınıfıyla (get_session → configured_model; 27.11'de okundu, kullanıcının adını verdiği sınıfla AYNI) ve efor `high` ile başlatılır. BAŞ MİMAR YORUMU (kullanıcıya gösterildi; değiştirebilir): AJAN EFORU sınıflamasındaki `medium` bu sürümde kullanılmaz — küçük işler dahil her ajan `high` (tavan zaten high); kâhin, dar kontrol, mali müşavir aynı. Ana oturumun o an çalıştığı model ajanlara miras verilmez (AJAN MODELİ kuralı aynen).
- SÜREN ESASLAR (2.5.0 sürecinden süren kurallar; 27.11.2026 05:42 UTC token tasarrufu — kullanıcı AYNEN: "token ekonomisi için, claude md dosyasında boyut ne, gereksiz olan dosylalar varsa temizleyelim". DURUM 36 ve 2.5.0 ESASLAR'ın TAM metni GECMIS-KARARLAR 'Arşiv 27.11.2026 (1)'de AYNEN; aşağıdaki satırlar oradan AYNEN alındı, yalnız 2.5.0'a özgü durum / dal / ajan / Ç5 satırları çıktı).
  DERS 5 KORUMASI: bu dosya kodu GÖRMEYEN kâhin ajanlarına da yüklenir → Açık iş'e programın dosya / alan adı, kod davranışı, sınama SAYISI yazılmaz; onlar KAYIT'ta, iş listesi D'de ve arşivde.
  SÜREN KURAL: sıkıştırmadan / yeni oturumdan sonra bu üç belge ve 'SIKIŞTIRMA HAZIRLIĞI'nın (a) adımı (tam metni GECMIS-KARARLAR 'Arşiv 27.11.2026 (1)' — 26.11 03:10 SIKIŞTIRMA HAZIRLIĞI satırı) okunmadan iş sürdürülmez; okunmadıysa kullanıcıya açıkça söylenir.
  ORTAM DENETİMİ (kullanıcı 10.11, AYNEN: "cpu bellek ve yük durumunu arada kontrol et"): her olayda `nproc`, /proc/loadavg, `free -g`, `df -h /` okunur, rapora 'Yük X / 4 çekirdek, bellek boş Y GB, disk boş Z GB' yazılır; yük > 4 ya da boş bellek < 2 GB ise yeni yük başlatılmaz, kullanıcıya söylenir; disk 5 GB'ın altına düşürülmez. LİMİT: kullanıcı "kodlamayı durduralım" / "kod yazmayı durdur" derse ajanlar TaskStop ile durdurulur, test koşuları sürer, ana oturum da birleştirme yapmaz; verilen saatte (send_later; saat Türkiye saati sayılır) ya da "devam"da sürdürülür. SORU SIRASI (prensip §4): belgeye önce 'SORULACAK', yanıt kullanıcıya gösterildikten sonra 'SORULDU'. Soru turun SON iletisinde yazılır — tur ortasındaki metin kullanıcıya ulaşmayabiliyor (11.11: kullanıcı "s120 yi görmedim"), 'gösterildi' sayılmaz. FREN SORUSU (ders 46 / 53 (c)) beklenir, 5 dk yetkisi uygulanmaz.
  YAPIM AŞAMASI LİSTESİ KURALI (sürer): her kâhin bakımı / Ç5 paketi birleşiminde liste AYNI commit'te yeniden üretilir (`--yapim-asamasi-yaz`; elle verilen paket etiketi korunur — üretici değer değişse de etiketi uyarısız taşır, birleşik tur 6 düzeltiyor; o zamana kadar fark dökümü ana oturumun betiğiyle), ESKİ listeyle farkı dökülür (yeni / kapanan / değeri değişen), her yeni kayıt paketine ayrılır — adım REDDİ varsa iletisi ayrıca okunur, Ç5 öncesi kodla karşılaştırılır (ders 6); 'AYRIŞTIRILMADI' bırakılmaz. Yayın adayında liste BOŞ olmak zorunda.
  2.5.1'E BIRAK (kullanıcı 20.11 09:00 UTC, AYNEN: "yapılan işlerde döngüye girmeyelim detaylara boğulup, programı yada kullanıcıyı etkileyemem hususları 2.5.1 sürümüne bırakalım"; D'de AYNEN): programın davranışını, sayılarını, hızını ya da kullanıcının gördüğünü / yaptığını DEĞİŞTİRMEYEN her husus — yalnız test düzeni, test aracı, kâhin ya da sürücü iç bakımı, belge, ölçüm nüansı, yaşayan mutantın gösterdiği eksik test, doğrulanmamış kuşku, sayıları doğru olan görünüm ayrıntısı — bu sürümde KOVALANMAZ, yeni tur ya da yeni koşu AÇMAZ; iş listesi B'ye '2.5.1'E (20.11 kuralı)' diye yazılır, teslim notunun DENENMEYEN / BİLİNEN SINIRLAR'ına gider. BAŞ MİMAR YORUMU (kullanıcıya gösterildi; değiştirebilir): kalite kapıları AYNEN (her düzeltmeye dar kontrol, ana oturum yeniden koşusu, eski kod kırmızısı, kâhin karşılaştırması, hız kabulü, ekran yürüyüşü, CI) — ama bunlarda yeni tur YALNIZ programı ya da kullanıcıyı etkileyen, yeniden üretilmiş bulgu için açılır; para / defter kuralı soruları (ders 43) programı etkilediği için sorulmaya devam eder; yayın kapısını etkileyen iç iş (CI'nin kırmızısı, yayın adayında boş olması gereken liste) 2.5.0'da kalır. Kural ajan ve dar kontrol görev metinlerine AYNEN girer (raporlarda 'SONRAKİ SÜRÜME (2.5.1)' başlığı); çalışan ajana kapsamı DARALTAN bildirim olarak gönderilir (ders 46 izin verir).
  DEVİR D3–D6 2.5.1'E (kullanıcı 21.11 21:32 UTC, AYNEN: "haftalık limit devir için kalan adımlara yetmeyecek. D3 den D6 ya kadar olan kısmı 2.5.1 sürümüne bırakalım."; D'de AYNEN + baş mimar uyarısı): 2.5.0'da devir işlemi (sihirbaz) YOK, yalnız altyapısı (D0–D2); müşterilerin 1 Şubat sınırı 2.5.1'in hedefi. Aşağıdaki DURMA NOKTASI ve ESASLAR satırlarındaki 'D3 → D6' ve 'devir 1 Şubat'tan önce yayında' bu karar ışığında okunur (2.5.1 için). Ç6-EKRAN da 2.5.1'E (kullanıcı 21.11 21:35 UTC, AYNEN: "Ç6 ekran da 2.5.1 e kalsın" — KESME ÇİZGİSİ uygulandı; Ç6-HESAP ekransız kalır, Dönem Kilidi dondurmasında çalışır; Gelir Tablosu hız bulgusu BİLİNEN SINIR). Ç5-C de 2.5.1'E (kullanıcı 22.11 06:32 UTC, AYNEN: "Ç5-C yide 2.5.1 e bırakalım, haftalık limit onu bitirmeyede yetmez. kalan işi izole edelim" — program değişmez: Ödeme Hatırlatma eski gecikmiş anlamında kalır, fark teslim notunun BİLİNEN SINIRLAR'ına; muhasebe sürücüsünün Ç5-C satırları yayın kapısını tutmaz; D'de AYNEN).
  ÖNERİYİ UYGULA (kullanıcı 14.11 06:31 UTC, AYNEN: "bana sorun varsa önerilerini uygula"): S175–S179 öneriyle yanıtlandı (D'de AYNEN). BAŞ MİMAR YORUMU (kullanıcıya gösterildi; değiştirebilir): bundan sonra soru yine turun SON iletisinde öneriyle yazılır ve öneri BEKLEMEDEN uygulanır (iş listesinde 'kullanıcı kararıyla öneri uygulandı'); kapsam ve DAHİL OLMAYANLAR aşağıdaki uzakta çalışma yetkisiyle aynı; DÖNÜŞ LİSTESİ geçerli kalır.
  TOPLU KÂHİN BAKIMI (kullanıcı 11.11 14:00 UTC, AYNEN: "uygun" — baş mimar önerisi; D'de AYNEN): kâhin bakımı soru başına DEĞİL, kod paketi başına BİR KEZ yapılır; kâhin bir bakımda bulduğu bütün alt durumları birlikte çıkarır, ana oturum hepsini TEK iletide sorar, yanıtlar TEK bakımda işlenir. Para kuralı soruları kullanıcıya sorulmaya DEVAM eder (genel ilke önerisi geri çekildi — karar hakkı kullanıcıda). Kalite düzeni değişmez: kâhin kodu görmez, kod ana dala girmeden ÖNCE kâhinle karşılaştırılır. Cari kâhini bakımı 12 (S128) bu ailenin son AYRI bakımıdır.
  KÂHİN AJANLARI İÇİN (ders 5): karar metinleri YALNIZ ana oturumun yazdığı özet / girdi dosyasından (örnek: docs/devir/2.5.0-DEVAM/kahin-eski7-kararlar.md); iş listesinin hiçbir sürümü ve yapım aşaması listesi izinli değil; önceki kararlar kâhinin kendi KARARLAR.md'sinden.
  ORTAM: kapsayıcı yenilenirse dosya sistemi kalır, arka plan işleri ve ajanlar kesilir; çalışma dizini depo DIŞINA düşer → Agent aracından ÖNCE `cd /home/user/ofis---y-netimi`. Sınama ağacı /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/d2t3-ya-ag (`git checkout -B <yeni dal> claude/epic-thompson-w0lc2l` ile yeniden kullanılır). ANA OTURUMUN ÖLÇÜM / YÜRÜYÜŞ DÜZENEĞİ /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul (temiz-100k verisi — ajanlara OKUNUR diye buradan verilir; betik/kabul.sh hız kabul ölçümü; betik/yuruyus.mjs ekran yürüyüşü: `ROOT=<kod> OUT=<klasör>`). Silme yalnız TAM yolla. CI'de düşen adımın adı gerekirse GitHub iş günlüğünün son satırlarından; `gh` yalnız ARAMA için. Uzun satırlı belgelerde düzenli ifadeli grep TAKILIR (11.11) — python ile satır satır okunur.
  AKIŞ (her ajan): rapor → kodu görmeyende bağımsızlık denetimi → ana oturum KENDİSİ koşar (iki TZ; eski kod kırmızısı kendi ayrı kopyasında + NEDENİ okunur; düzeltme testin içindeyse eski kopyaya ESKİ test — ders 51; G2 komşu; ortak katman / ayar / yedek → şema kapısı + geri yükleme; yapısal → bir tam npm test, ders 41; mümkünse birden çok işi TEK sınama ağacında TEK tam testle) → HIZ KABUL ÖLÇÜMÜ (ders 53 (a): değişen her yol; kötüleşen birleşmez) → EKRAN YÜRÜYÜŞÜ (anayasa 'kalite çıtası' + şikâyet 1: ekranların okuduğu hesabı değiştiren pakette ana oturum günlük iş akışını ekrandan kullanıcı gibi yürür, ekran görüntüsüne BAKAR; test sayısı bunun yerini tutmaz) → BİRLEŞTİRMEDEN ÖNCE CI'nin kâhin ↔ program adımları yerelde (`npm run test:kahin-cari`, `npm run test:kahin-defter`) → birleştir (commit'siz birleşim BEKLERKEN ana ağaçta başka commit YAPILMAZ — 11.11: bir belge commit'i birleşimi yanlış iletiyle kapattı, gönderilmeden düzeltildi) → kod sınananla birebir mi diff → kanıtla gönder → CI'yi oku (KIRMIZI İŞ VARSAYILMAZ — kullanıcı 11.11 12:52 UTC, AYNEN: "varsayma doğrula": kırmızı işte düşen adımın ADI her push'ta CI'den okunur, NEDENİ aynı commit'te yerelde koşularak okunur; 'bilinen kırmızı' ancak ad da neden de öncekiyle aynıysa ve atlanan adımların yerel koşusu o koda aitse denir; okunmadıysa 'okunmadı' yazılır, tahmin yazılmaz — ders 4, 38) → DAR KONTROL (high, yeni ajan; görev metni prensip §9 iskeletiyle: fark + karar metinleri AYNEN + ilgili D satırı + baş mimar yorumu 'değerlendir' — düzeltme ajanının raporu / KAYIT'taki kaydı ve düzeltmenin görev metni VERİLMEZ) → YÜKSEK / ORTA yeni ajanla. Ajan görev metni scratchpad/*-istem.txt + docs/devir/2.5.0-DEVAM/; "Görev metnin şu dosyada…" ile, worktree yalıtımı, efor (en çok high) ve model parametresiyle; metne "kendi arka plan işin sürerken rapor vermeden bitirme" yazılır.
  KİLİTLER (ders 50, 52): ölçüm `flock -x /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock`, yük koşuları `flock -s -n` aynı kilit, tam npm test `flock -n /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/tam-npm-test.lock` — kilit doluyken süreli arka plan işi içinde BEKLENMEZ. Tarayıcı PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194. Kayıt betikleri `T=$(date -u +%H:%M) python3 -I - <<'EOF'` + `|| exit 1`, commit / push aynı zincirde. Commit satırları: `Co-Authored-By: Claude <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og` (model adı YAZILMAZ).
  HEDEF (kullanıcı 10.11.2026, AYNEN: "müşterilerle konuştum devir işleri 1 şubata kadar esnetiyorlar, süre ksıtımız yok"): devir 1 Şubat'tan önce yayında (eski hedef 1 Ocak'tı); süre kısıtı yok.
  MALİ MÜŞAVİR AJANI (docs/erp/MALI-MUSAVIR-AJANI.md; kodu görmez, high (efor tavanı 11.11), her temas yeni ajan): P yapıldı (kural kitabı); A çekirdek temeli sonrası (zincirde MA); S son adayda tam kapıdan ve UD'den ÖNCE, UI/UX ile paralel. ÖNERİ: Bilanço / Gelir Tablosu satışa sunulmadan önce gerçek SMMM incelemesi. Akış: aday → mali müşavir S + UI/UX → düzeltme + dar kontrol → tam kapı → CI + UD + windows.yml ×2 → paket.
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
- REFERANS PROGRAMLAR (kullanıcı, 12.11.2026 13:26 UTC, AYNEN: "önerilerini uygula, mikro, netsis, logo, akınsoft gibi piyasada yaygın muhasebe programlarınıda referans alabilirsin"): öneri ve karar hazırlarken Mikro, Netsis, Logo, AKINSOFT gibi piyasada yaygın muhasebe programları da referans alınabilir (anayasadaki kalite çıtasının adlarıyla yinelenmesi). Baş mimar yorumu (kullanıcıya gösterildi): para / kapama kuralında karar hakkı yine kullanıcıda (ders 43 aynen) — sorularda öneriye 'yaygın programlarda nasıl' satırı eklenir; bir programın davranışı ancak doğrulanmışsa (belgesi / ekranı okunmuşsa) dayanak diye yazılır, hafızadan 'şu program böyle yapar' denmez.
- SORU DÜZENİ (kullanıcı, 06.11.2026 09:01 UTC, AYNEN: "bana soru sorduğunda eğer çok uç durumsa konu; seçeneklere uç durum böyle kalmasında sorun yok maddesi de ekle"): kullanıcıya sorulan her soruda konu çok uç / seyrek bir durumsa seçeneklere ayrıca "Uç durum böyle kalsın (BİLİNEN SINIR olarak yazılır)" maddesi eklenir; öneri yine yazılır. Ajan görev metinlerindeki "KULLANICIYA SORULMALI (iki seçenek + öneri)" kalıbına da bu madde girer (uç durumsa üçüncü seçenek). Seçilirse kod / kâhin değişmez, iş listesi B'ye ve teslim notunun BİLİNEN SINIRLAR'ına yazılır.
- 5 DK YETKİSİ (22.10, 29.10 yenilendi; tam metin GECMIS-KARARLAR "Arşiv 02.11.2026 (3)"): soru öneriyle sorulur; 5 dk içinde yanıt yoksa piyasada en yaygın öneri uygulanır, iş listesine "5 dk yetkisiyle uygulandı" yazılır,
  kullanıcı dönünce özetlenir. SINIRLAR: PR → master "birleştir", yayın, canlı Supabase/DNS/Cloudflare Worker dağıtımı, müşteri/kimlik bilgisi, ders 43 ve DERS 46 SORUSU (iki dar kontrol üst üste gerileme → 'nasıl ilerleyelim'; baş mimar eki 11.11.2026 öz denetim — fren sorusu sessizlikle geçilmez) yetkiye girmez.
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