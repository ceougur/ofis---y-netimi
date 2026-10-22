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
Her test planı bu listeden geçirilerek yazılır; teslimdeki DENENEN/DENENMEYEN bölümü hangi maddelerin uygulandığını söyler.
Yeni bir test hatası yaşanınca buraya madde eklenir (kaynağıyla). Liste bir yasaktır, öneri değil.
1. YALNIZ LİNUX "GEÇTİ" DEĞİLDİR. CI'nin BÜTÜN işleri (Linux, Windows × Node 22/24, e2e, paket) ana oturumca okunur; biri kırmızı
   ya da sürüyorsa "doğrulandı" denmez. (Windows 34 koşu kırmızı kaldı, 08–10.10; `test/platform-tasinabilirlik.test.mjs`.)
2. ÇIKIŞ KODU VE SAYI. Sonuç, komutun gerçek çıkış kodu + `# tests/pass/fail/cancelled/skipped/todo` satırlarından okunur; boru
   (`| tail`) arkasındaki `$?` kuyruğun kodudur, kanıt değil (çıktı dosyaya yazılır, kod ayrıca alınır). tests = 0, cancelled > 0,
   yarıda kalan koşu = BAŞARISIZ/BELİRSİZ, "geçti" yazılmaz. ARAÇ: `node tools/kanit.mjs kos <ad> -- <komut>` (çıkış kodu + sayılar +
   ham çıktı + commit/platform → `docs/kanit/<gün>/`; çıkış ile özet çelişirse ÇELİŞKİ), `node tools/kanit.mjs ci <commit>` (CI'nin
   bütün işleri; biri sürüyor/atlanmış/kırmızıysa yeşil DEĞİL), `node tools/kanit.mjs ozet` (biri geçmediyse çıkış 1).
3. REDDEDİLEN İSTEK BAŞARI DEĞİLDİR. Her adımda yanıt kodu + gövdesi + veri tabanındaki sayı okunur. (Excel denetimi 04.10: salt
   okunur lisansla hiçbir kayıt girilmedi, test "✅" saydı, uydurma mali rapor teslim edildi.)
4. OKUNAMAYAN VERİ "BOŞ" DEĞİLDİR. Günlük/dosya okunamadıysa tablo "bilinmiyor" der; boş sonuç başarı sayılmaz. (10.10: CI günlüğü
   403 → boş başarısızlık tablosu üretildi.)
5. KÂHİN BAĞIMSIZ OLUR. Beklenen sayı programın kodundan ya da onu yazan elden türetilmez (Canlı Hata 2: mutabakat modeli programla
   aynı yanlış formülü taşıyıp hatayı 3 sürüm gizledi). Programın kendi "Mutabakat Testi tamam" demesi de kanıt değildir
   (Taksite Aktar → sil → geri al → geri yükle: Kasa çift, Mutabakat Testi "tamam").
6. UYUŞMAZLIK ÖNCE HATADIR. Fark çıkınca "bilinen sınır/kural farkı" demeden önce yeniden üretilir, eski sürümün gerçek koduyla
   karşılaştırılır, kök neden yazılır. (Mutabakat tohum 1 önce "K8 sınırı" sanıldı; Canlı Hata 2 çıktı, 2.0.24–26'da canlı.)
7. TESTİN DİŞİ. Her yeni test eski kodda kırmızı görülür; kırmızısı görülmeyen test kanıt sayılmaz. Para çekirdeğinde mutasyon.
8. BÜTÜN SENARYOLAR KOŞULUR. CI'de olmayan arayüz senaryosu elle koşulur, sonucu yazılır; atlanan senaryo adıyla DENENMEYEN'e
   yazılır. (senaryo-213 CI'de olmadığı için 2.0.21'den beri kırıktı; 2.0.26'da senaryo-whatsapp/ui-ux-217 koşulmadı.)
9. DEĞİŞEN KODUN BÜTÜN YOLLARI. Kod kaldırılınca/değişince o koda dokunan her arayüz yolu (toplu yükleme, Excel/Sheets, toplu
   işlem, geri yükleme) koşulur. (2.0.18 Tablodan Al kalkınca Excel cari yükleme ReferenceError → 2.0.19.)
10. DÜZELTMENİN KOMŞULARI. Düzeltmeden sonra aynı formülü kullanan komşu senaryolar da denenir (2.0.24 G1: iade düzeltmesi
    paralı iadede kartı küçültmeye başladı; Canlı Hata 2 de G1 düzeltmesinin gerilemesiydi).
11. HER SÜZGEÇ, HER SEÇENEK. Rapor yalnız varsayılan süzgeçle açılmaz; her süzgeç seçeneği ve toplam = satırlar. (Banka ve POS
    "Yol" süzgeci 2.0.17'den 2.0.23'e hiç çalışmadı; senaryo yalnız varsayılanı açıyordu.)
12. İNSAN HIZI VE KLAVYE. Form testleri gerçek tıklama + Tab + insan hızında yazımla da koşulur; "veri bozulmaz" iddiası kayıttan
    sonra veri tabanı okunarak verilir. (Fatura ödeme alanı: Tab ile girilen senet sessizce kayboluyordu; ilk raporda "veri
    bozulmaz" yanlış yazıldı.)
13. TARİHE BAĞLI TEST YOK. Göreli tarih + sahte saat (`config.now`); ayın 1'i, ay sonu, yıl dönümü, hafta sonu/bayram ayrıca.
    (2.0.13: ayın 1'inde kırılan senaryolar. 16.10.2026: e2e örnek Excel'i "Ödeme Sözü"nü sabit 15.10.2026 taşıyordu; o gün geçince ana e2e
    kırmızı — CI #751; 2.3.0 kodunda da. Örnek dosyadaki tarih artık koşu gününe göre: test/fixtures/goreli-tarih.mjs.)
14. TEST ORTAMI ≠ GERÇEK KURULUM. Testte kapatılan/değiştirilen ayar (lisans, saat, vekil sunucu) bulgu yazılmadan önce gerçek
    kurulum koşuluyla denenir. (Excel denetimi Bulgu 6 "salt okunur uyarı" testin kendi lisans ayarıydı.)
15. ÖLÇÜMLER TEK TEK. Aynı makinede iki ölçüm/yük koşusu aynı anda çalışmaz (`flock`); önce/sonra aynı veri kopyasıyla.
    (2.0.22: iki ölçüm üst üste koştu, sayılar atıldı.)
16. AJAN ONAYI KANIT DEĞİL. Ajan "geçti" derse ana oturum ham çıktıyı/CI'yi kendisi okur; ajanlar arası onay bağımsız doğrulama
    sayılmaz; ajan raporu ↔ CI çelişirse sonuç BAŞARISIZ'dır, çelişki giderilene kadar.
17. SIRA VE GEÇMİŞ VERİ. Şirket/yedek/sil-geri yükle gibi durumlu işler rastgele sırayla ve eski sürümlerin gerçek verisiyle
    denenir. (2.0.20 gözden geçirmesi 2.0.17'den kalan "iki şirket aynı veri dosyası" hatasını buldu; tek sıralı testler görmedi.)
18. BENZETİM GERÇEK PLATFORM DEĞİLDİR. Platforma özgü bir hatanın düzeltmesi, o platformun gerçek koşusunda (Windows → GitHub
    CI) en az iki koşuda yeşil görülmeden "düzeldi" diye yazılmaz. (10.10: launcher EACCES'i Linux'ta EADDRINUSE benzetimiyle
    "düzeldi" dendi — 12ade2d; gerçek Windows'ta koşu 488'de tekrarladı: Windows TCP portlarını SIRAYLA verir, yeniden deneme
    UDP'de dışlanmış aynı blokta dolaştı. Kök neden ancak gerçek günlükle bulundu.)
19. ZİNCİRDE HATA DURDURUR. Birden çok adımı tek komutta zincirlerken `set -euo pipefail`; bir adım düşerse commit/push/rapor
    yapılmaz. (10.10: belge betiği düştü, commit yine çalıştı ve iletisi yapılmamış işi "yapıldı" diye yazdı — d2f9ddc.)
20. ARA SIRA KIRMIZI ZORLA ÜRETİLİR. "Ara sıra" kırmızı adım yeniden deneme ya da bekleme süresi uzatmayla geçiştirilmez: yarışın
    ön koşulu zorla oluşturulan bir betikle (ör. olayı gecikmenin içine denk getir, CPU yavaşlat) önce kırmızı üretilir; düzeltmenin
    yeşili yalnız ön koşulun GERÇEKTEN oluştuğu denemelerde sayılır; düşen isteğin kimin olduğu (kullanıcı/arka plan) kayıttan okunur.
    (10.10: senaryo-222 CI'de 2/~12 kırmızı; ürün sanıldı, testin kendi yarışıydı — `test/e2e/senaryo-222-yaris.mjs`.)
21. HER PUSH'UN CI'Sİ AYRI OKUNUR. Sonraki commit'in yeşili öncekinin kırmızısını kapatmaz; kod değişmese de (yalnız belge) aynı testler
    başka sonuç verebilir. Push edilen her commit için `node tools/kanit.mjs ci <commit> --bekle <dk>` (koşu henüz oluşmadıysa da bekler)
    ve sonuç okunmadan "yeşil" denmez. Başarısız testin adı kısa günlükte okunur: araç başarısız testleri çıktının SONUNA ve kapı
    özetine yazar (tam günlük bu ortamda ağ politikasıyla indirilemiyor). Temizlik (finally) hatası asıl hatayı ezmez.
    (10.10: CI 514 85a7b50 yalnız CLAUDE.md değişmişken Windows Node 22 kırmızı — supervisor.test.mjs EBUSY, asıl hata gizli —
    yarım saat okunmadı; sonraki push'ların CI'si izlendi.)
22. UZUN KOŞU GÜN SINIRINI GEÇER. "Bugün"ü başta bir kez okuyan model/test, koşu gece yarısını geçince programla ayrışır; sunucu sahte saatle
    (motorNow(): yerel bugün 06:00'dan akar) başlatılır ve motor koşu sonunda gün değiştiyse sonucu GEÇERSİZ sayar. (11.10: CI 565 c8d596b
    mutabakat-cekirdek tohum 2 23:59:56 UTC'de başlayıp 00:00:00'da kırmızı; program doğruydu — ters kaydı yeni günle yazdı; zorla
    `test/mutabakat-gece-yarisi.mjs` ile üretildi.)
23. ESKİ KOD AYRI KOPYADA. Kırmızı kanıt için eski kod çalışma ağacında `git checkout <eski> -- dosya` ile denenmez: dosya hazırlık
    alanına girer, sonraki commit'e karışır ve aynı ağaçta koşan öbür testler eski kodu görür. Eski kod `git archive <eski> | tar -x` ya da
    `git worktree` kopyasında koşulur. (11.10: e372a00 kanıt commit'ine eski hof-workspace.js girdi ve gönderildi — ca966fb ile geri alındı;
    o arada başlatılan arka plan koşuları durduruldu, kanıtları silinip ayrı kopyada yeniden koşuldu.)
24. DOLU DİSKTEKİ KOŞU GEÇERSİZDİR. Uzun koşu/e2e başlatmadan önce `df -h /` okunur (en az ~5 GB boş); bitmiş ölçümlerin veri kopyaları
    (sqlite, profil) kanıtı depoya alındıktan sonra silinir. Dolu diskte kırmızı → önce disk, sonra ürün; yeşil de geçersiz (yarım yazılmış dosya).
    (11.10: / %100, 261 MB — /tmp/kapi-olcum 5,2 GB, scratchpad 4,7 GB; senaryo-210 "Page crashed", 211 "Failed to fetch dynamically imported
    module"; kayıtlar docs/kanit/2026-10-11/son-aday-e2e-2/gecersiz-disk-dolu, yer açılıp yeniden koşuldu.)

25. ORTAK NOT DEFTERİ ÇAKIŞIR. Paralel ajanlar aynı scratchpad'i paylaşır; eski kod kopyası ve ara dosyalar BENZERSİZ adlı klasörde
    (ör. `<iz>-eski-<commit>`) açılır, başka ajanın klasörü kullanılmaz. (12.10: İz 1 ajanının eski kod kopyasının üzerine başka ajan yazdı;
    kırmızı kanıtlar benzersiz klasörde yeniden alındı.)
26. BELGEYİ TEK TEK GÖNDERME. Her push 6 işlik CI başlatır; belge değişiklikleri biriktirilip kodla birlikte gönderilir. (12.10: 14 belge
    push'u CI kuyruğunu 35+ dk tıkadı.) (17.10: yine ihlal — 25 dk'da 6 belge push'u; BELGE_YOLLARI dışındaki iş listesi / aday bulgu / kanıt
    belgeleri tam CI başlattı (#821–#823, 18 iş) ve Uzun Doğrulama'yla kuyruk paylaştı. Yalnız belge değişikliği kodla birlikte gönderilir.)

27. KAYNAK TARAYAN TEST CRLF'Yİ BİLİR. Windows'ta git dosyaları CRLF ile çıkarır; satır bölme `/\r?\n/`, `.` "\r"yi kapsamaz. (12.10: e908e38
    "Kurumsal Kart" metin denetimi Linux'ta yeşil, Windows'ta yorumları ayıklayamayıp kırmızı; yerel koşu görmedi.)
28. BEKLENTİ DEĞİŞEN SENARYO KOŞULUR. Bir arayüz senaryosunun beklentisini "bilerek güncellendi" diye değiştiren, o senaryoyu koşup yeşilini görür;
    koşulmayan beklenti değişikliği teslim edilmez. (12.10: Tahsile Ver T4 düzeltmesi senaryo-banka-210 adım 45'i "5 satır" yaptı, koşmadı; o şirkette çek
    yoktu → CI 12b82c2 e2e kırmızı. İş akışı ajanlarına "değiştirdiğin e2e'yi koş" yazılır.)
29. node_modules GENEL KLASÖRE BAĞLANMAZ. Depoda `node_modules` → `/opt/node22/lib/node_modules` sembolik bağı kurulup `npm ci` koşulursa npm
    bağın HEDEFİNİ siler (genel npm + playwright gitti). Playwright depoya `npm ci` ile gelir; genel araç gerekirse `NODE_PATH` kullanılır.
    (12–13.10: npm tarball'dan, playwright `npm install -g --force` ile geri kuruldu; paket `node tools/build-windows.mjs` ile doğrudan derlendi.)
30. TEST GERÇEK LİSANS SERVİSİNE ULAŞMAZ. Gerçek programı ayrı süreçte açan her test/araç (supervisor, bootstrap.mjs, server.mjs; sahte sürüm paketleri
    dahil) `HUKUK_LICENSE_URL=http://127.0.0.1:9` verir; program açılıştan 3 sn sonra kendiliğinden deneme başlatır ve GitHub koşucusundan GERÇEK Operatör
    Merkezi'ne sahte "ofis" düşer. Denetim `test/lisans-servisi-izolasyonu.test.mjs` (kaynak tarar). (15.10: Operatör Merkezi'nde "Sürüm 9.0.0 · Denemede"
    kayıtları — 30.09, 12.10, 15.10; hepsi Azure/GitHub Actions adresi; lisans.installations/events'ten doğrulandı; update-flow/supervisor/yedek/packaging
    testleri adresi vermiyordu.)

31. AYNI TARİHLİ KAYITLAR KİMLİKLE SIRALANMAZ. Rastgele UUID'ye göre sıralama rastgele sıradır; iki yükleyici farklı anahtar kullanınca (kapı
    'account:<id>', yevmiye '<id>#<satır>') aynı veriden farklı sonuç çıkar ve kapı "sapma" der. Aynı tarihte sıra: olay sınıfı (plan/kâhin dili
    kuralı) → yazım sırası (rowid/seq); sınıf içi sıranın toplamları değiştirmediği gösterilir. (15.10: be53818 kayıt sırası, 4d4da18 değersiz/tahsilat
    sırası — Uzun Doğrulama #199/#213 7 tohum kırmızı; birim test anahtarları ters çevirerek üretir.)

32. SON ADAY, PARA ÇEKİRDEĞİNE SON DOKUNUŞTAN SONRA BAĞIMSIZ GÖZ GÖRMEDEN İLAN EDİLMEZ. Yargıç/eleştirmen turu bir commit'te koşar; ondan sonra
    para çekirdeğine giren her değişiklik (düzeltme dahil) dar kapsamlı bir kontrol turu görür; kâhin ve motor yeni kuralı aynı elden aldıysa
    kâhin sayılmaz (ders 5). (15.10: 469d547 turundan sonra dört değişiklik girdi; kullanıcı sorunca başlatılan kontrol turu K1 YÜKSEK buldu —
    "mevcut borcu taksitlendir" kartı yeni satış sayılıp taksiti 128'den düşmüyordu; kâhin dili ve motor aynı eksik kuralı taşıyordu.)

33. DOSYA ADI WINDOWS'TA AÇILMALI. Depoya giren dosya adında < > : " | ? * ya da sonda boşluk/nokta olmaz (npm betik adı "test:…" dosya adına
    konmaz, "_" ile). Windows'ta git checkout düşer, CI'nin Windows işleri hiç başlamaz. Denetim test/platform-tasinabilirlik.test.mjs (5. kalıp).
    (17.10: taban kanıtı "ilk-test:banka-210-….txt" → CI #825 221482c Windows 22+24 kırmızı; Linux'ta görünmedi.)

34. TESTİ GEÇİREN YARDIMCI ÜRÜN DAVRANIŞINI GİZLEMEZ. Soru/onay penceresini kendiliğinden yanıtlayan test yardımcısı (ör. esc-kapat.mjs "Kaydetmeden
    Kapat") her yanıtı nedeniyle günlüğe yazar ve beklenen "soru var/yok" bildirilir; yanıtlanan her soru meşru mu yanlış mı sınıflanır. (18.10: 2.4.3
    çekirdeğinde escClose 46 e2e'de soruyu sessizce geçiyordu; kaydedilmiş/temiz formda çıkan yanlış soru yeşil testlerin arkasında kalırdı.)

35. PAKET TAM TESTİ BİTMEDEN BİRLEŞMEZ. Düzeltme paketi ana dala ancak kendi tam `npm test`'i (+ değiştirdiği davranışa dokunan bütün e2e'ler) yeşil
    görüldükten sonra alınır; "CI zaten koşar" denip birleştirilmez. (18.10: UI/UX A paketi tam test koşmadan birleşti → CI #834 4 kırmızı (cari-243,
    banka-210-altin), #835 e2e form-izolasyon D2 kırmızı — hepsi UX1/UI7/UI9'un bilinçli değişikliğine uymayan eski beklentiler; ürün hatası değil.)
36. AJAN BAŞKASININ SÜRECİNİ ÖLDÜRMEZ. Paylaşılan makinede `pkill -f <desen>` / `killall` kullanılmaz; yalnız kendi başlattığı pid'ler (çalışma dizini ile
    doğrulanarak) durdurulur. (18.10: A paketi ajanı `pkill -f "test/e2e/"` ile kendi kabuğunu ve olası başka ajan koşularını kesti.)

37. ADAYIN E2E LİSTESİ TAHMİNLE SEÇİLMEZ. Birleştirme adayında (ders 35) "dokunulan" e2e'ler tahminle seçilirse genel davranışı ölçen senaryolar (yenileme/istek
    sayısı, odak, bildirim) dışarıda kalır; adayda ci.yml'nin BÜTÜN e2e listesi koşulur (CI dışı senaryolar madde 30'da). (22.10.2026: aday 2'de 9 e2e seçildi, senaryo-222
    "toplam istek ≤ 50" seçilmedi → CI #858 f6e265b e2e KIRMIZI 55/50; aday 2'deki bir paket arka plan yenilemesini artırmıştı.)
### Verimlilik (kullanıcı, 12.10.2026: "geçmişte yaptığın hatalardan aldığın dersleri göz önüne al; gereksiz zaman ve kullanım limitimi
harcayacak işlemlerden uzak dur!")
- Dersler 1–24 her işte uygulanır; ama kanıt için GEREKEN kadar koşulur, fazlası değil: geliştirme sırasında yalnız değişen alanın testleri;
  tam `npm test` iş başına bir kez (bitişte); uzun koşular (mutabakat 5.000+, güvenilirlik 10.000, ölçek) yalnız son adayda, bir kez, GitHub'da.
- Bağımsız doğrulama tur sayısı sınırlı: bir tur; yalnız yeniden üretilmiş bulgu varsa düzeltme + bir kontrol turu daha. Aynı işi iki ajana
  yaptırma; ajan raporunu ana oturum yalnız ÖZET kanıtla (kırmızı/yeşil sayıları, CI) denetler, işi baştan yapmaz.
- Bekleme için yoklama yok (CI/ajan bildirimini bekle); CI her push'ta bir kez okunur. Gereksiz dosya okuma, uzun çıktı, tekrar eden sorgu yok.
- UZUN OTURUM (kullanıcı, 21.10.2026: "sohbet uzayıp token masrafı ya da bilgilerin karışması olacaksa sıkıştırmak çözümse denetle ve uygula"): bağlam
  sıkıştırılmadan ÖNCE her karar/istek/ara sonuç zaten Açık iş'e ya da iş listesine yazılmış ve gönderilmiş olur (sıkıştırma özet bırakır, ayrıntı
  kaybolabilir; kaynak her zaman depo belgesidir). Büyük okuma/tarama ajana verilir, ana bağlama yalnız özet girer. Bir iş bölümü bitince (ör. 2.4.4 bir
  madde grubu) durum belgeye yazılır; bağlam şişmişse kullanıcıya iş sınırında `/compact` (ya da yeni oturum + DEVİR NOTU) önerilir — iş ortasında değil.
  Sıkıştırmadan sonra karar gerektiren her şey koddan/belgeden yeniden doğrulanır, özetten anlatılmaz.
- AJAN EFORU (kullanıcı, 21.10.2026: "işleri yapacak ajanların efor seviyelerini şu kurallara göre belirle ve sadık kal"): ajan başlatılırken `effort` her
  zaman verilir — basit arayüz ve küçük düzeltme → medium; birden fazla modülü etkileyen iş → high; e-SMM, EDM entegrasyonu ve kritik muhasebe işlemleri →
  xhigh; bağımsız doğrulama, para çekirdeği incelemesi (dar kontrol, kâhin) ve Uzun Doğrulama incelemesi → xhigh. İş kritik bir alana (para, defter, e-Belge
  numarası/gönderimi, EDM bağlantısı) GERÇEKTEN dokunuyorsa yüksek sınıf geçer; adında geçmesi yetmez. Fork ajan ana oturumun eforunu alır (efor yok
  sayılır) → efor gereken işte fork kullanılmaz. Ana oturumun eforunu kullanıcı ayarlar. Sürüm maddelerinin sınıfı iş listesinde ([M]/[H]/[XH]). DOĞRULANDI (21.10.2026, kullanıcı isteği): aynı
  soru medium ve xhigh iki ajana verildi; oturum kaydında her ajanın turunda `"effort"` / `"perTurnEffort"` = verilen düzey (medium / xhigh). Küçük soruda
  davranış farkı ölçülemedi (ikisi de doğru yanıt, ~85 bin token bağlam). Kuşku olursa aynı deneme tekrarlanır (kayıt: not defteri tasks/<ajan>.output).

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
- 2.4.3 kararları (17–18.10.2026; ayrıntı arşiv 21.10): e-Fatura mükellefi işaretini yalnız Mükellef Sorgula koyar/kaldırır; numaralı belgede Düzenle belge
  türünü değiştiremez ("iptal edip yeniden kesin"); posta kutusu seçilmemiş belge GEÇİCİ engel (seriyi bekletir), kalıcı yalnız chronology/buyer-is-efatura;
  "Ödeme şeklini yaz" varsayılan açık; "Listeden Sil" → "Müşteri Fişi Olarak Bırak"; "Nihai Tüketici" hızlı seçeneği; Vergi Ödemesi (B 360) + ay sonu KDV
  Mahsup fişi; iadede "İade Edilen Belge No (e-Belge Referansı)"; Muhasebe rolü Finans Raporları'nı varsayılan görür (kişiden kaldırılabilir, Anlık Durum
  yalnız yönetici); hata/uyarı bildiriminde "Kopyala".

## Açık iş (yalnız güncel; kapanan sürümler `docs/GECMIS-KARARLAR.md`)
- YENİ OTURUM / SIKIŞTIRMA SONRASI (21.10.2026): önce `docs/DURUM-VE-DEVAM.md` → "DEVİR NOTU (21.10.2026)" (2.4.4 kapsam tablosu, devir 2.5.0, kalan işler,
  anayasa/ders yerleri) ve `docs/2.4.4-IS-LISTESI.md` (36 madde, efor sınıflı, TAM liste) DOSYADAN okunur; özetten anlatılmaz. DAL: bütün güncel belgeler
  `claude/youthful-euler-fl8ks4` dalında (master'da yok); eski `claude/hopeful-goodall-6nmtcj` dalı ESKİ — oradan belge ALINMAZ (yenilerini ezer).
- 2.4.4 BAŞLADI (kullanıcı "başla", 22.10.2026 03:25 UTC); 30 dk rapor işi CronCreate fc078609 (oturum içi; 2.4.4 bitince silinir). Çalışma düzeni: her iş
  grubu ayrı git worktree'de (/home/user/wt/<ad>, dal is/<ad>), ajan commit eder, ana oturum youthful-euler dalına birleştirir, testler + push + CI.
  DALGA 1 (22.10 ~03:35 UTC; ajan kuralları not defteri ajan-ortak.md — kapsayıcıyla gider): kucuk [M] 3,25,4 · test-altyapi [H] 6,27 · d2 [XH] 7 · esmm [XH]
  20,21 · sunucu [H] 28,29 · personel [H] 19. SONRAKİLER: kayit [XH] 5 (4'ten sonra) · fatura-ui [M] 9,10,13,14,UX16 · UI11 [H] 8 · UX9/UX10 [H] 11 · UX15 [XH] ·
  UX18 [XH] 15 · KÖ3 [H] 16 · E6 [XH] 17 · E7 [H] 18 · brüt [XH] 26 · esmm-2 [XH] 22,23 · esmm-3 [XH] 24 (gerçek EDM). Biten dalga birleştirilince iş listesinde üstü çizilir.
- GÖZDEN GEÇİRME (kullanıcı, 22.10.2026 ~05:20 UTC: "anayasamızı ve derslerimizi gözden geçir") — 2.4.4 çalışmasında bulunan sapmalar ve düzeltmeleri:
  (1) DERS 35: ajan paketleri tam `npm test` görmeden çalışma dalına birleştirildi (ajanlara "tam npm test koşma" denmişti) → bundan sonra birleştirme ADAYI ayrı
  worktree'de (/home/user/wt/aday) birleştirilir, tam `npm test` + paketin e2e'leri orada yeşil görülür, sonra çalışma dalına alınır; birleşmiş paketler için kanıt
  CI #849–#853 (4 platform tam test, yeşil). (2) DERS 5: brief'lerde kodu yazan ajandan kâhini "ayrı elden" düzeltmesi istendi (iptal K22, secilen, brut) — aynı el;
  geri alındı: kodu yazan ajan kâhine dokunmaz, kuralı raporlar, kâhini kodu görmeyen ayrı ajan yazar (madde 31 ile; e-SMM UBL tutarları da — esmm ajanı beklenen
  sayıları kendi test dosyasında yazdı, bağımsız kâhin sayılmaz). (3) DERS 21/26: üç yalnız-kanıt commit'i `[skip ci]` ile gönderildi (kurallarda yok; testler kanıt
  dosyalarını okuyabilir) → BIRAKILDI; ana oturum kanıtı birleştirme adayında üretir, kodla birlikte gönderir (Stop kancası ana ağaçta izlenmeyen dosya görmez).
  (4) TEST KURALI "Nasıl bozulur? listesi önce yazılır" brief'lerde yoktu → eklendi. (5) DERS 19: birleştirme + push zincirinde `;` kullanıldı → `set -euo pipefail`.
  (6) Bir birleştirme commit'i (6ee24d3, sunucu ajanı) Co-Authored-By/Claude-Session satırsız (geçmiş yeniden yazılmaz). (7) KALİTE ÇITASI: ana oturum kullanıcı
  gözüyle günlük iş akışını baştan sona henüz yürütmedi → madde 30'da (kişi → cari → fatura/e-Belge → tahsilat → kasa/banka → rapor, iki şirket) ekran görüntüsüyle.
- 2.4.4 "BAŞLA" KONTROL LİSTESİ (atlanmaz, sırayla): (1) yukarıdaki iki belge + bu Açık iş dosyadan okunur; (2) RAPOR DÜZENİ için CronCreate 30 dk işi
  kurulur ("7,37 * * * *"; 2.4.4 bitince silinir); (3) iş listesi madde 1 (npm ci — bağ yok; git fetch --unshallow --tags; master CI 163dd5d + "Sürüm yayımla"
  okunur); (4) yüklenen dosyalar yerinde mi (HAZIRLIK 3) — yoksa kullanıcıdan istenir; EDM test hesabı sohbette verildi, dosyaya YAZILMAZ, kaybolduysa
  kullanıcıdan istenir; (5) her ajan AJAN EFORU kuralıyla (effort verilir, fork yok); (6) biten madde iş listesinde üstü çizilir + commit (yalnız belge, CI
  koşmaz) ve 30 dk raporda gösterilir; (7) para çekirdeği maddelerinde kırmızı test + mutasyon + dar kontrol; her push'un CI'si ayrı okunur.
- Yayın geçmişi özeti: 2.0.12 … 2.0.26, 2.1.0, 2.2.0, 2.3.0, 2.4.0, 2.4.1, 2.4.2, 2.4.3 yayımlandı (her biri PR + etiket + 5 dosya bayt bayt + güncelleyici "available" + site
  kılavuz PR'ı); ayrıntı arşivde. Kâhin bilinen sınıfları: KDV-DAHIL-ISKONTO (program doğru), KASA-ACILIS-649 (İz 1.3 ile kapanacak).
- PLANLI TEST (kullanıcı, ertelendi; 16.10.2026'da yine ertelendi: "cuma testini pazara ertele"): Pazar 18.10.2026 09:00 TR (trig_0144BJLRwsZFizXTTYrJVszA): 2.0.24 DENENMEYEN/BİLİNEN SINIRLAR
  (`docs/2.0.24-KANIT.md`) + ölçek/yük (30 kullanıcı, 1.000.000 satır; sunucu + ARAYÜZDEN, tablo iki sütun).
  (18.10 hatırlatıcısı geçti; yeni tarih kullanıcıda.)
- 2.1.0 kapsam ölçümü (satır/dal/arayüz) — yayından sonra yapılacak iş (kullanıcı 11.10.2026).
- ARŞİV (17.10.2026, anayasa "kısa tutulur" gözden geçirmesi): 2.1.0–2.4.2 kapanan maddeleri ve eski kararlar `docs/GECMIS-KARARLAR.md`
  "Arşiv 17.10.2026" bölümüne AYNEN taşındı. O maddelerden AÇIK kalanlar: e-SMM gönderimi (kullanıcı EDM'den servis adresi/belge/test yetkisi
  ister; şimdilik gizli, config.esmmEnabled); Edge'in kaydetme önerisi (2.4.2) kullanıcının makinesinde doğrulanacak; canlı açılırken EDM birim
  kodu kabulü canlıda yinelenir; döviz (§3.12) ertelendi, fxEnabled kapalı; release.yml sürümlü exe koşuları okundu (22.10.2026: 2.4.1 #34, 2.4.3 #36 yeşil).
- ARŞİV (21.10.2026, anayasa "kısa tutulur" + Verimlilik gözden geçirmesi; her oturum ve her ajan bu dosyayı yükler): kapanan 2.4.3 maddeleri (KUSUR 17.10 …
  SON ADAY 19.10), 2.3.0'da kapanan SIRA (13.10), WhatsApp ve Devir maddelerinin uzun hâli, kontör ve mevzuat kararlarının ayrıntısı `docs/GECMIS-KARARLAR.md`
  "Arşiv 21.10.2026" bölümüne AYNEN taşındı. Kalıcı 2.4.3 ürün kararları "Kalıcı ürün kararları"nda tek satır özet.
- MÜŞTERİ İSTEĞİ (13.10.2026, emlakçı): kayıt detay kartından "WhatsApp'tan Paylaş" (resimler + bilgiler) — BEKLER (kullanıcı: "şimdilik kalsın"). Alıcı
  numarası karttan GELMEZ; API'siz yollar (Windows Paylaş / wa.me / tek "Portföy Sunumu" dosyası) ve Yol B (Meta API, Pro) ayrıntısı arşivde (21.10).
- DEVİR MODÜLÜ (sürüm 2.5.0, 2.4.4'ten SONRA): YÖNTEM KARARI Wolvox (kesim tarihinde ikiye ayır; eski yıl salt okunur arşiv); TEK BAŞINA YETERLİ plan
  `docs/devir/DEVIR-PLANI.md` (§11 kararları verildi, 20.10.2026); arka plan `docs/devir/DEVIR-MODULU.md`; ilk adım D0 (planı koda karşı yeniden doğrula).
  HATIRLATICI (kullanıcı, 21.10.2026: "kapat ama ileride bana hatırlat"): eski 22.10 hatırlatıcısı (trig_01NEGfcTp7hAnHG1tgw6mFAv, eski oturuma bağlı, istemi
  eskimişti) KAPATILDI; yenisi 29.10.2026 09:00 TR (trig_01DE8bFDurzMRT6thbptBrQM, oturum session_01JyhFmK2mfqMV3KTwvTZdhs). O oturum kapanmışsa: 2.4.4
  bitince kullanıcıya devri hatırlat (devir Ocak–Şubat'ta kullanılır → 2.5.0 Aralık başına kadar yayında olmalı).
- ERP YOL HARİTASI (kullanıcı, 21.10.2026: "ilerleyen dönemlerde kademeli olarak bunları yapalım, ERP yol haritası olarak bir dosya yap, adım adım gideriz"):
  `docs/erp/ERP-YOL-HARITASI.md` — YALNIZ PLAN, kod değişmez; 2.5.0'dan SONRA, her adım ayrı sürüm, kullanıcı "başla" deyince, D0 ile. Açık kararlar belgenin
  "Kullanıcı kararları" bölümünde (sıra, Pro'ya özel mi, resmî defter kapsamı, döviz). KARARLAR (kullanıcı, 21.10.2026): hedef müşteri HERKES (ERP
  modülleri şirket bazında açılıp kapanır); şirket sınırı şimdilik 2 kalır, müşteri geri dönüşüne göre yeniden karar verilir.
- TESLİM BİÇİMİ (kullanıcı, 15.10.2026 ~20:20 UTC, 2.3.0 için teyit): GitHub'a yüklenecek İMZALI 5 dosya AYRI AYRI verilir; birleştirmeleri (PR → master) ben yaparım, dosyaları kullanıcı yükler. Kurulum .exe 30 MB'ı aşarsa İKİ PARÇA (parca0 + parca1) + "BIRLESTIR.md" (copy /b komutu + beklenen sha256) verilir.
- AÇIK (15.10.2026 21:58 UTC): CI #742 aed598e Windows Node 24 guncelleme-gercek S2 kırmızı (PR koşusu #743 aynı commit yeşil). Mekanizma: testin etkinlik pingi bir önceki isteği bekliyordu, takılan tek istek 4 sn boşluk açtı, sunucu haklı olarak kurdu (ürün doğru). Düzeltme test yardımcısında (zamanlayıcılı + zaman aşımlı pingler + istatistik; zorla üretme GUNCELLEME_S2_ZORLA_BOSLUK=1). İsteğin CI'de neden takıldığı (ağ/yük/ürün) yeni tanılamayla bir sonraki görülüşte okunur; ders 18 gereği Windows'ta iki yeşil koşu görülmeden kapanmaz.
- FİYAT (kullanıcı, 16.10.2026; soru "yıllık 15 bin öder mi?" → değerlendirme verildi; Wolvox Standart 50 bin TL tek seferlik): KARAR "SINIRSIZ 40 bin TL";
  devir, döviz, mobilden uzaktan bağlanma ve WhatsApp otomatik toplu gönderim yapıldıkça dahil. Baş mimar uyarıları verildi: "sınırsız"ın sözleşmede tanımı
  (süre / kullanıcı / güncelleme); tek seferlikte sürekli giderler (mevzuat güncellemesi, destek, uzaktan bağlanma sunucusu, WhatsApp Meta mesaj ücreti, EDM
  kontörü müşteride); gelecek özellik vaadi yazılı taahhüt olmaz. Lisans altyapısı süresiz lisansı destekliyor (license-token expiresAt null). KARAR BEKLENİYOR:
  güncelleme/destek süresi ve WhatsApp/uzaktan bağlanma giderlerinin kime ait olduğu.
  FİKİR (kullanıcı, aynı gün; "bunlar sadece fikir şimdilik"): Pro yerine TEK PAKET (bütün özellikler); WhatsApp kontörünü müşteri öder; uzaktan bağlanma için
  Tailscale benzeri çözüm (net değil); ömür boyu kullanım, güncelleme yalnız ZORUNLU hallerde ve 2 YILLA sınırlı. Karar değil — uygulanmaz, kod değişmez.
- e-SMM YANITI (EDM, kullanıcının iletisi 19.10.2026): e-SMM uç noktaları e-Fatura/e-Arşiv'den FARKLI; AYNI test hesabıyla e-SMM uç noktalarında denenebilir.
  Canlıda müşteri için ayrıca e-SMM siparişi + açılış işlemleri gerekir (ticari@edmbilisim.com.tr). Uç nokta adresleri EDM'nin Word belgesinde (e-postanın eki;
  genel belge bağlantısı dosya.edmbilisim.com.tr owncloud). SIRADAKİ: kullanıcı Word belgesini oturuma YÜKLER → uç noktalar + şema okunur → e-SMM (config.esmmEnabled,
  şimdilik gizli) test ortamında uçtan uca plan + kapsam/maliyet önerisi kullanıcıya; karar kullanıcıda (2.4.4 ya da ayrı sürüm). Kod henüz değişmedi.
  BELGE OKUNDU (19.10.2026): e-SMM TEST https://test.edmbilisim.com.tr/EFaturaEDM21ea/ESmmEDM.svc, CANLI https://portal2.edmbilisim.com.tr/EFaturaEDM/ESmmEDM.svc;
  test WSDL erişilebilir (200): Login, SendSMM, LoadSMM, GetSMMStatus, GetSMM, CancelSMM, ArchiveSMM, EmailSMM, MarkSMM, GetSMMSerial, CheckUser, CheckCounter…
  (ad alanı/yapı e-Fatura servisiyle aynı aile; soap-contract.mjs yeniden kullanılır). Programda hazır: SMM kâğıt makbuz, ESMM profili, TES/ESM serileri, esmm
  ayarı (gizli). EKSİK: ESmmEDM bağdaştırıcısı + e-SMM belge XML'i (GİB e-SMM biçimi doğrulanacak) + gönderim/durum/iptal/resmî PDF akışı + test ortamında
  uçtan uca. Plan + karar kullanıcıda.
- e-SMM BELGELERİ (kullanıcı, 21.10.2026; oturuma yüklendi, depoya GİRMEZ): EDM e-SMM Web API v4.4.1 + Request-Response (docx), durum kodları (xlsx),
  esmm-ubl-ornek-veri.xml, Ek_bilgi.txt (dip toplam anlamları), TesterCurrent.cs (EDM C# örnek istemci). İlk gelen "E-MM_Teknik_Doküman.zip" e-MÜSTAHSİL
  (EmmEDM.svc, EFaturaEDM21mm) — e-SMM DEĞİL, kapsam dışı. KILAVUZDAN: iki gönderim yolu — NESNE (SendSMM: alanlar, XML'i EDM üretir; kılavuz "EXCEL
  şablonu" anıyor) ve UBL (SendSMMPrepared: XML bizden); EDM numarayı kendisi de üretebilir ("seri üretimi talebi") → ÖNERİ numarayı program verir
  (kronoloji/belirsiz gönderim güvenceleri tek yerde), test hesabında doğrulanır; resmî PDF GetSMM (SMM_CONTENT_TYPE PDF); iptal SÜRESİ kılavuzda YOK (e-Arşiv
  8. gün sorusuyla aynı → mali müşavir); CANLI ADRES bugünkü belgelerde YOK (19.10 notu) → açmadan önce EDM'den teyit. EDM ÖRNEK SAYILARI TUTARSIZ (net >
  brüt, KDV %18) → kâhin GİB kuralından (ders 5). Kodda: kâğıt SMM + defter (B 120, B 193 stopaj / A 600, A 391), ESMM profili, ESM/TES serileri, Entegratör
  Ayarları → Firma "e-SMM kullanıcısıyım" (gizli) VAR; ESmmEDM.svc bağlantısı, SendSMM/GetSMMStatus/CancelSMM, UBL stopaj vergi satırı (0003) YOK
  (edm.mjs yalnız EFaturaEDM.svc; ubl-tr.mjs:157 stopaj yalnız not). Canlıda müşteri EDM'den ayrıca e-SMM siparişi + açılış ister → kılavuza yazılır.
- 2.4.3 YAYIMLANDI (19.10.2026): PR ceougur/ofis---y-netimi#33 → master 163dd5d; 5 dosya bayt bayt, güncelleyici "available", site PR ceougur/destekofis#19 (ayrıntı
  arşivde). OKUNDU (22.10.2026): master CI #847 163dd5d yeşil; "Sürüm yayımla" #36 (2.4.3) ve #34 (2.4.1, run 39010296441) yeşil.
- KARAR (kullanıcı, 19.10.2026 ~11:45 UTC: "perşembe yapalım, 2.4.4'ün kalan işleri ile beraber"; haftalık kullanım %91): 2.4.4 = e-SMM (4 madde: EDM ESmmEDM
  bağdaştırıcısı, GİB e-SMM XML'i, numara/kopma/iptal kuralları + dar kontrol, test ortamı uçtan uca + kılavuz + açma) + 2.4.3'ten ertelenenler (UI11, UI5, UI9,
  UI3a, UX9, UX10, UX15–UX18, UX20, UX25, UX27, KÖ3) + gg243-dar-kontrol-gonderim D2 ön koşulunu belirlenimci yap (ders 20) + e-Arşiv iptal 8. gün teyidi.
  BAŞLANGIÇ: kullanıcı "başla" deyince (ilk karar Perşembe 22.10.2026 02:00 idi; kısıt 21.10.2026'da KALKTI). Tahmin ~1,5–2 gün (e-SMM), ~1,5–3 M token.
  BÖLME YOK (kullanıcı, 21.10.2026: "bölme kararımız yoktu; e-SMM programda hazır, yalnız gösterilmiyordu") → e-SMM 2.4.4'te. 2.4.4 BAŞLANGICI: kullanıcı
  "başla" deyince (21.10.2026: "yarın ben başla dediğimde başlarsın").
  02:00 KISITI KALKTI (kullanıcı, 21.10.2026: "02.00 kısıtına takılma, ben başla dediğimde limit sıfırlanmış demektir").
  KARARLAR (kullanıcı, 21.10.2026: "ilk 5 maddeyi en yaygın ve doğru kullanılan bilgi ile yapalım"; baş mimar seçti):
  (1) UI11 dışa aktarım: liste/rapor düğmeleri tek ad "PDF" / "Excel" (ne indirdiği pencere başlığında + düğme ipucunda); kart/belge çıktıları (Cari Ekstre,
  Taksit Ekstresi, Stok Kartı, <Belge Türü>, Kasa Dökümü) 2.0.16 kararıyla adlı kalır; hepsi TEK görünüm (aynı simge/renk ailesi/yükseklik); fatura listesi çift
  başlık kalkar. (2) UX18: faturadan Çek/Senet ile tahsilat BU faturayı kapatır (fatura bazlı kapama; bağ yalnız cheque_events.invoice_id, cheques.invoice_id boş
  → fatura iptalinde evrak portföyde kalır, bağ düşer); taksitli faturaya ve başka cariye/ters yöne bağ yok (invoiceLink kuralı); karşılıksız dönünce fatura yeniden
  açılır; carideki "+ Tahsilat" Çek/Senet yolunda seçili Kapatılacak Fatura artık KORUNUR (bugün sessizce düşüyor); yevmiye değişmez (B 101/121 / A 120);
  şüpheli alacak kuralı değişmez (BİLİNEN SINIR); para çekirdeği → kırmızı test + mutasyon + dar kontrol. (3) E7: Yol A — ayrı, ekran boyunda pencere
  (window.open), kullanıcının kalıcı Edge profili (Beni Hatırla + Edge parola kaydı); kurulum değişmez; adres sunucunun sabit listesinden ortama göre; Turnstile'a
  dokunulmaz, parola istemciye çıkmaz; ad yazım düzeniyle "e-Fatura Portalı"; e-SMM'ye portaldaki sarı "SMMM Portalı Girişi" ile geçilir. (4) E8: Tahsilat düğmesi
  CSS ile gizlenir. DÜZELTME (kullanıcı, 21.10.2026: "orta tablodaki Excel'deki kayıttan taksit olmasın, cariye kaydedip oradan yapsın; kasa hareketlerini,
  fatura, rapor gibi kısımları bozar, muhasebe mantığını kaybeder") → KAYITTAN TAKSİT KALKAR (2.0.18 kalıcı kararı bu ölçüde değişti): "Taksit planı oluşturun"
  kısa yolu karta TAŞINMAZ; taksit yalnız Cari'den / Taksitler'den (kart cariye bağlı; createFromPlan routes/accounts.mjs:1289). Eski kayda bağlı kartlar ve eski
  kayıt tahsilatları olduğu gibi kalır (veri bozulmaz). Boş geçmiş metni, yetki açıklaması, rapor adı, kılavuz uyarlanır. KÖR NOKTA (kullanıcıya soruldu): zil ve
  Ödeme Sözü şeridindeki "Tahsil Et" (hof-alerts.js:285, hof-promises.js:138 → HOF.workspace.payment) kayıttan tahsilatı cari dışı doğrudan Kasa'ya yazmayı
  sürdürür — aynı muhasebe sorunu; öneri: bu iki yol da Cari'ye gider (kayıt cariye bağlıysa cari tahsilat formu; değilse "önce cari açın" + ad/telefonu dolu
  "+ Yeni Cari"). "Taksit → Tablodan Aktar" (tablodaki ödeme planı → cariye bağlı kart) aynı ilkeye girer mi: soruldu.
  KARAR (kullanıcı, 21.10.2026: "önerilerin uygun"): zil ve Ödeme Sözü şeridindeki "Tahsil Et" CARİ'ye gider (bağlı cari varsa cari tahsilat formu; yoksa
  "önce cari açın" + ad/telefonu dolu "+ Yeni Cari"); kayıttan Kasa'ya doğrudan tahsilat ekrandan kalkar (sunucu ucu ve eski kayıtlar durur); para yoluna
  dokunur → kırmızı test + komşu senaryolar + dar kontrol. "Taksit → Tablodan Aktar" KALIR (kart cariye bağlı). (5) İPTAL SÜRESİ (GİB kaynağı: ebelge.gib.gov.tr/dosyalar/kilavuzlar/
  e-Arsiv_Uygulamalari_Iptal_Ihtar_Itiraz_Bildirim_Kilavuzu_V.1.1.pdf §3: "e-Arşiv Fatura ve e-SMM belgelerinin iptal işlemlerinde 8 günlük sürenin tespiti e-belgenin
  alıcıya iletilme tarihinden itibaren başlar. İptal işlemi her durumda 8 günlük süre içinde yapılmalıdır"; dayanak TTK 21/2): e-Arşiv VE e-SMM 8 gün, İLETİM
  (gönderim) tarihinden; başlangıç günü sayılmaz, 8. gün dahil (TBK 92). Program bugün KESİM tarihinden sayıyor (invoices.mjs:2893; daha katı) → iletimden
  sayacak; ileti sınır günüyle; kılavuz kâhin kaynağı olarak depoya (sha256); kâhin K22 (≤7) GİB kaynağıyla ayrı elden düzeltilir (ders 5); localOnly yolu
  gönderilmiş belgede süreyi atlamaz.
  (6) EDM TEYİDİ GEREKMEZ (kullanıcı, 21.10.2026: "test ortamından kurup test edeceğiz; kullanıcı canlı için EDM'den üyelik alıp canlıdan önce deneme yapıp sonra
  kullanacak"): canlı e-SMM adresi 19.10'da EDM Word belgesinden okunmuştu (portal2.edmbilisim.com.tr/EFaturaEDM/ESmmEDM.svc) ve e-Fatura adresiyle aynı
  düzende → program e-SMM adresini Entegratör Ayarları'ndaki servis adresinden türetir; kılavuza "canlıda e-SMM için EDM'den ayrıca e-SMM siparişi" yazılır.
- YAPILMAZ (19.10.2026): kontörlü "Tüm Bilgileri Getir" (Mükellef Sorgula yalnız CheckUser); müşteri talebi gelirse yeniden. Ayrıntı arşivde (21.10).
- KULLANICI SORUNU (19.10.2026, ekran): Mükellef Sorgula "Kullanıcı Bulunamadı (11010)" — neden: Entegratör Ayarları'nda Web Servis KULLANICI ADI alanına servis
  ADRESİ (https://test.edmbilisim…) yazılmış. Parola "Kayıtlı": kayıtlı parola tasarım gereği gösterilmez (Göster yalnız o an yazılanı gösterir). 2.4.4 ADAYI
  (küçük, kullanıcıya önerildi): kullanıcı adında http/https/“.svc” varsa kaydetmeden uyarı + baş/son boşluk kırpma; "Göster" yanında "kayıtlı parola gösterilmez,
  değiştirmek için yenisini yazın" netliği.

- MÜŞTERİ İSTEKLERİ → 2.4.4 (kullanıcı, 19.10.2026 ~23:05 TR: "müşterinin istekleri var sırayla yazacağım, bunları da 2.4.4 güncellemesine ekle"; ekran:
  Fatura → Gönderilecekler, 2 belge seçili, seçim çubuğunda PDF/Excel/XML/İptal/Sil var, gönder YOK):
  (1) "Seçilenleri Gönder" — seçim çubuğuna, seçilenlerden gönderilebilir (Gönderilecekler) olanların sayısıyla. KURAL (baş mimar): e-Belge numarası tarih
  sırasıyla verilir (kronoloji); seçilmemiş DAHA ESKİ tarihli bekleyen belge varsa seçilen yenisi numara alamaz → düğme bunu gönderimden ÖNCE söyler
  ("önce şu tarihli N belge gönderilmeli; onları da ekle / iptal") — sessiz atlama ya da yarım tur yok; Tümünü Gönder ile aynı sunucu yolu (seri kilidi,
  sonucu belirsiz önce sorulur). Para-numara çekirdeği → kırmızı test + dar kontrol (ders 32).
  (2) "E-Fatura Portal" düğmesi (Fatura üst satırı, Liste - Excel'in yanında): tıklayınca EDM portalı program içinde TAM EKRAN açılsın; kullanıcı adı/parola
  Entegratör Ayarları'ndan alınıp şifre sormadan kullanıcının portal sayfası açılsın. KODDAN/AĞDAN (20.10.2026): EDM e-Fatura WSDL'inde (60 işlem) portala
  oturumlu giriş/SSO/bağlantı üreten işlem YOK (Login yalnız web servis oturumu); canlı portal portal2.edmbilisim.com.tr → portal4.edmfatura.com/EFaturaUI/
  (bu ortamdan erişilemedi; çerçeveye izin verip vermediği DOĞRULANMADI). BAŞ MİMAR UYARILARI: (a) portal girişi web servis kullanıcısıyla aynı mı — EDM'ye
  sorulacak (çoğu entegratörde portal kullanıcısı ayrı); (b) program içinde çerçeve (iframe) çoğu portalda X-Frame-Options/çerez kuralıyla engellenir ve
  program http://<ip>:5123'te çalışır → gerçekçi yol: başlatıcının ayrı tam ekran uygulama penceresi (Edge --app) portal adresiyle; (c) şifresiz giriş
  ancak EDM'nin belirteçli (token/SSO) giriş bağlantısı varsa güvenli; yoksa parolayı EDM'nin giriş formuna betikle doldurmak gerekir → parola sunucudan
  istemciye çıkar (bugün tasarım gereği hiç çıkmaz) ve EDM sayfası değişince sessizce bozulur. ÖNERİ: EDM'ye "portala belirteçli giriş bağlantısı var mı,
  portal kullanıcısı web servis kullanıcısıyla aynı mı, test/canlı portal adresleri ve çerçeveye izin" sorulur; yanıta göre ya tam şifresiz giriş ya da
  "portalı tam ekran aç + kullanıcı adı dolu" (parola tarayıcının kendi kaydıyla). Gerçek Windows + Edge'de denenir (ders 18).
  EK (kullanıcı, 20.10.2026: test portalı https://test.edmbilisim.com.tr/EFaturaUI21ea/ giriş bilgisi web servisle AYNI; "program kullanıcı adı/şifre alanını
  doldurup giriş yapacak; beni hatırla açıksa doğrudan sayfa gelecek?"). SAYFADAN OKUNDU: X-Frame-Options SAMEORIGIN → program içine gömülemez (ayrı tam ekran
  pencere şart); giriş formunda Cloudflare Turnstile (hfTurnstileToken) + "Giriş Yap" düğmesi doğrulama bitene kadar pasif → otomatik doldur + otomatik
  tıkla insan doğrulamasına takılır, EDM'nin bot korumasını aşmaya çalışmak YAPILMAZ; "Beni Hatırla" kutusu var (rememberMe), kalıcı çerez davranışı
  DOĞRULANMADI. ÖNERİ: başlatıcı portalı KALICI profilli ayrı tam ekran Edge uygulama penceresinde açar; ilk girişte kullanıcı adı/parola bir kez girilir
  (Edge kaydeder) + Beni Hatırla; sonraki açılışlarda doğrudan sayfa gelmesi beklenir — gerçek Windows + Edge'de denenir; giriş alanlarını doldurma ayrı
  karar (Turnstile yüzünden yine tek tıklama ister, parola istemciye çıkar).
  NETLEŞTİRME (kullanıcı, 20.10.2026: "test linki vermiştim, karışıklık olmasın; entegrasyon ayarına girilen canlı hesap linki + aynı kullanıcı adı/şifre ile
  EDM giriş arayüzüne bağlanacak kullanıcılar, doğru mu? beni hatırla kullanılacak?") → EVET: düğme Entegratör Ayarları'ndaki ORTAMA göre açar (Test → test portalı
  EFaturaUI21ea, Canlı → canlı portal); giriş Entegratör Ayarları'ndaki kullanıcı adı/şifre ile; Beni Hatırla kullanılır (ilk girişte bir kez). Canlı portal adresi
  (portal2.edmbilisim.com.tr → portal4.edmfatura.com/EFaturaUI/) ve canlıda portal girişi = web servis kullanıcısı olduğu EDM'den teyit edilecek.
  CANLI ADRES (kullanıcı ekranı, 20.10.2026: edmbilisim.com.tr → Müşteri Girişi → "E-Fatura Portal Girişi"): https://portal4.edmbilisim.com.tr/EFaturaUI/
  ("e-Fatura / e-Arşiv v2.1" — tek giriş iki belge türünü kapsar; Beni Hatırla var). e-Arşiv'in GELEN kutusu YOKTUR (alıcı mükellef değildir; e-posta/PDF
  ile gelir); gelen kutusu yalnız e-Fatura. GİB e-Arşiv Portalı ayrı ve ücretsiz; EDM ile kesen müşteri onu kullanmaz.
  (3) Kayıt detay kartındaki "Tahsilat" düğmesi KALDIRILSIN (kullanıcı, 20.10.2026: "regresyon olma ihtimali varsa koda dokunmadan yalnız CSS ile").
  KODDAN: düğme hof-workspace.js:1212 data-case-action="payment" (yetki payments.create "Kayda Tahsilat Girme", tutar Kasa'ya düşer); CSS'te gizleme kuralı zaten
  var (hof-ui.css:2123, yalnız tahsilat modülü kapalıyken; modül, kayıtlarda tahsilat varsa profile.mjs kendiliğinden açar). PLAN: CSS'e koşulsuz gizleme;
  sunucu yolu, eski tahsilatların İşlem Geçmişi'nde görünmesi/düzeltilmesi/silinmesi ve kayda bağlı TAKSİT kutusundaki "+ Tahsilat" (doğru yol) DEĞİŞMEZ;
  boş geçmiş metni ("not, telefon, tahsilat veya haciz") düğmeye uygun düzeltilir. Bu düğmeye tıklayan e2e'ler (run.mjs 488/622/645, senaryo-banka-210b:214,
  senaryo-cari-243:173/206) ekrandan girilemeyeceği için tahsilatı API'den girer + yeni denetim "düğme görünmez" (eski kodda kırmızı); bütün e2e koşulur (ders 28).
  Standart/Pro kuralı gereği bütün kurulumlara gider.
- SORU (kullanıcı, 20.10.2026: "demo olarak kaç kişi kullanıyor, operatör merkezinden bak") → Supabase lisans.installations SALT OKUNUR sorgu (veriye dokunulmadı):
  9.0.0 hariç 13 kurulum; 4 lisanslı (ŞAHİN TURİZM, OFİS, AHMET ALANLI, UĞUR ÇETİN); lisanssız Türkiye adresli GERÇEK demo 5'i son 24 saatte etkin (hepsi 2.4.3;
  178.233, 46.221, 88.225, 193.255, 88.241), 2'si Eylül'den beri görünmüyor (2.0.9, 2.0.0). Azure (GitHub Actions) adresli 2 kayıt: 2.0.12 (25–30.09) ve
  YAYIMLANMAMIŞ "2.4.5" (ilk 15.10 10:04, SON 19.10 15:30 TR — ders 30 önlemi 210ac8e'den SONRA da görülüyor) → 2.4.4 ADAYI: hangi test/iş akışı gerçek
  lisans servisine ulaşıyor, bulunup kapatılır (lisans-servisi-izolasyonu taraması genişletilir; release.yml/Uzun Doğrulama dahil). Kayıtlar silinmez (15.10 kararı).
- İSTEK → 2.4.4 (kullanıcı, 21.10.2026; ekran: kendi tasarımı "Personel Raporu" kartı — Toplam Maaş / Kayıtlı Personel / Aktif Çalışan / Ayrılan Personel;
  alanlar Ad Soyad, Yaş, TC No, Adres, Görevi, Maaş, Banka Adı, IBAN, İşe Giriş, İşten Ayrılış (iki kez), Kişisel E-Posta, Telefon, Öğrenim Durumu, Uzmanlık
  Alanı, fotoğraf; sekmeler Personel Özeti / Evrak Listesi / Maaş Bordrosu / CV / İletişim): Personel Raporu penceresine ÇALIŞAN ÖZLÜK tablosu; "Çalışanlar" ve
  "Ayrılanlar" sekmeleri; tablolarda arama (yazınca ilgili çalışan); kartlar görseldeki gibi; İşten Ayrılış Tarihi yazılınca kart KENDİLİĞİNDEN Ayrılanlar'a geçer;
  ikinci "İşten Ayrılış Tarihi" alanı "Kullanılan İzinler" olur. KODDAN: bugünkü "Personel Raporu" (hof-workspace.js:879, :808 openReports) yalnız kullanıcıların
  görev performansı ("Personel Performans Özeti"); personel/özlük verisi programda YOK → yeni modül (tablo + göç + rota + ekran), para çekirdeğine dokunmaz
  (maaş yalnız bilgi; Kasa/Banka/defterde etkisi yok). BAŞ MİMAR UYARILARI: TC No, IBAN, maaş, adres KVKK kişisel verisi → yeni yetki (varsayılan yalnız
  yönetici), yedekte kalır, günlüğe/değişiklik geçmişine değer yazılmaz; Yaş elle yazılırsa eskir → Doğum Tarihi girilir, yaş hesaplanır; "Maaş Bordrosu"
  (SGK/vergi hesabı) kapsam dışı.
  KARAR (kullanıcı, 21.10.2026: "önerilerin uygun, sadece personel özeti olan görünüm kart olsun, diğer sekmeler olmasın"): yalnız yönetici görür (yeni yetki;
  yönetici başkasına verebilir); kartta YALNIZ Personel Özeti görünümü — Evrak Listesi, Maaş Bordrosu, CV, İletişim sekmeleri YOK; Doğum Tarihi girilir, Yaş
  hesaplanır; "Kullanılan İzinler" gün sayısı.
  EK (kullanıcı, 21.10.2026): IBAN, maaş, adres gibi bütün alanlar istenildiği zaman düzeltilebilir/değiştirilebilir — yönetici ve yetki verdiği kullanıcı. Uygulama:
  iki yetki (Personel Özlük Görüntüleme / Personel Özlük Düzenleme), varsayılan yalnız yönetici; Değişiklik Geçmişi'ne kim / ne zaman / hangi alan yazılır,
  DEĞER yazılmaz (KVKK).
- SORU (22.10.2026, Personel Özlük yapılırken; kullanıcıya soruldu): ileri tarihli İşten Ayrılış Tarihi (ihbar süresindeki çalışan) bugün "yazılınca geçer" kararı gereği
  hemen Ayrılanlar'a geçiyor ve Toplam Maaş'tan düşüyor. ÖNERİ: ayrılış günü gelene kadar Çalışanlar'da kalsın, yanında "Ayrılacak" notu.
  KARAR (kullanıcı, 22.10.2026: "önerini uygula işten ayrılış tarihi ile alakalı olarak"): ileri tarihli ayrılış → ayrılış gününe kadar Çalışanlar'da + "Ayrılacak" notu,
  Toplam Maaş'ta sayılır; ayrılış günü gelince (bugün ≥ tarih) kendiliğinden Ayrılanlar'a geçer.
- SORU (22.10.2026, madde 23 iptal süresi; kullanıcıya soruldu): sonucu BELİRSİZ gönderimde (EDM'ye ulaştı mı bilinmiyor) "Yalnız Programda İptal" bugün süreye
  bakmıyor (2.4.3 çıkış yolu). ÖNERİ: 8 gün geçtiyse yalnız-programda iptalden önce EDM durum sorgusu zorunlu; EDM "bulunamadı" derse (iletilmemiş) iptal serbest,
  "var" derse süre dolmuş sayılır ve iptal reddedilir (GİB'de geçerli belge programda iptal görünmesin).
  KARAR (kullanıcı, 22.10.2026: "önerin uygun"): öneri AYNEN uygulanır.
- SORULAR (22.10.2026, madde 5 yapılırken; kullanıcıya soruldu): (a) carisi olmayan kayıtta Tablodan Aktar'dan ÖNCE şeritten girilen tahsilat caride taksit dışı kalıyor,
  karta taşınmıyor (kart o ayı ödenmemiş gösteriyor; ön izleme söylüyor). ÖNERİ: Tablodan Aktar kayda bağlı carinin taksit dışı tahsilatlarını ön izlemede göstererek en eski
  açık taksitten başlayarak karta eşleştirsin (kullanıcı kapatabilir); para çekirdeği → kırmızı test + mutasyon + dar kontrol. (b) "Önce cari açın" formunda Açılış Bakiyesi
  boş geliyor → borç girilmezse tahsilat avans görünür. ÖNERİ: kayıttaki Kalan Borç ile dolu gelsin (değiştirilebilir) + Tablodan Aktar'ın aynı borcu ikinci kez
  yazmadığı testle güvenceye alınır. (c) önceden var olan hata: Tablodaki Kişiler raporunda aynı dosya no iki sekmede varsa tahsilat iki kez yazılıyor (2.4.3'te de) →
  ÖNERİ 2.4.4'te düzeltilsin.
  KARAR (kullanıcı, 22.10.2026: "3 önerinde uygun"): (a), (b), (c) öneriler AYNEN 2.4.4'te (iş listesi 5a–5c).
- SORULAR (22.10.2026, 5a/5b yapılırken; kullanıcıya baş mimar önerisiyle soruldu, iş bu önerilerle sürüyor): (1) kartı aşan tahsilat BÖLÜNMESİN (K11 bir olay = bir
  para hareketi; bölmek para modelini değiştirir; fazlası taksit dışı kalır); (2) carinin borcu tablodaki kalandan AZSA kayıt aktarılmasın, ne yapılacağı söylensin ("tablodakini
  yaz" çift borç riski); (3) faturalı cari 5a/5b DIŞINDA kalsın (fatura kapamayla çakışır; müşteri isterse ayrı iş).
  KARAR (kullanıcı, 22.10.2026: "3 önerin uygun"): üç öneri AYNEN (uygulanmış hâliyle) kalır.
- SORU (22.10.2026, madde 22 e-SMM gönderim kapıları; kullanıcıya soruldu): 2.4.0'da e-SMM bir gün görünürdü (2.4.1'de gizlendi); o arada kesilmiş NUMARALI ESMM
  makbuzları e-SMM açılınca Gönderilecekler'de "Gönderilmedi" görünüyor ve ESKİ tarih + kendi numarasıyla gönderilebiliyor (geriye dönük e-belge riski). ÖNERİ: bu makbuzlar
  kalıcı engel ("e-SMM gönderimi açılmadan önce kesildi; İptal Et ile iptal edip bugünün tarihiyle yeniden kesin"); Tümünü/Seçilenleri Gönder onları atlar.
  KARAR (kullanıcı, 22.10.2026: "evet"): öneri AYNEN uygulanır (iş listesi 22a).
- SON ADAY BAĞIMSIZ TURU (kullanıcı, 22.10.2026: "2.4.4 son aday uzun test koşusuna başlamadan kâhin (uzman mali müşavir), yargıç, eleştirmen testlerinden geçecek mi,
  regresyon testleri yapılıyor mu?" → EVET; "ekle" → uzman UI + uzman UX de): iş listesi madde 30–31 (31a kâhin, 31b mali müşavir, 31c yargıç, 31d eleştirmen, 31e dar kontrol,
  31f uzman UI/UX) Uzun Doğrulama'dan ÖNCE.
- MEVZUAT KARARI (kullanıcı, 20.10.2026): e-Fatura / e-Arşiv kutu metinleri DEĞİŞMEZ, 2.4.4'te değil; geri bildirim gelirse netleştirilir. 509 VUK GT okuma
  notları (IV.2.2, IV.2.4.1, V.1 kayıt yöntemi) arşivde (21.10).
- RAPOR DÜZENİ (kullanıcı, 21.10.2026: "2.4.4'ü yaparken 30 dk'da kısa ara rapor ver, düşen test var mı, durmuş işlem var mı kontrol et; varsa gereğini yap;
  yapılacak işleri maddele, iş bittikçe üstünü çiz ve bana göster"): liste `docs/2.4.4-IS-LISTESI.md` (biten madde üstü çizili, commit ile). Uygulama: "başla"
  deyince oturum içi 30 dk'lık CronCreate işi (yalnız boşta çalışır; 7 günde kendiliğinden biter; 2.4.4 bitince silinir) + uzun turda her denetim noktasında
  30 dk dolduysa rapor. Raporda: ne yapılıyor, düşen test (çıkış kodu + sayılar, CI), duran işlem (arka plan koşuları, ajanlar, CI); varsa önce gereği yapılır.
- EK BULGULAR → 2.4.4 (kullanıcı, 21.10.2026: "önerin uygun"; e için "küçük bir işse önce doğrula, sorun varsa 2.4.4'e girsin"): iş listesi 25–29 —
  a) salt okunur lisansta tax.manage, b) Brütü Hesapla kişi alıcı, c) defter kâhini CI'da, d) vekil sunucu parolası açık metin, e) 002'ye yetki/lisans olayı canlı
  ulaşmıyor: KODDAN DOĞRULANDI (app.mjs:182 şirket başına kanal, :441 çocuğa kanal verilmez, license.mjs:331) → 2.4.4'te kırmızı testle.
- HAZIRLIK (21.10.2026, 2.4.4 öncesi denetim): (1) YAPILDI (21.10.2026, ERP yol haritası commit'i): docs/2.4.4-IS-LISTESI.md ve docs/erp/** BELGE_YOLLARI'nda (tools/kanit.mjs
  + ci.yml paths-ignore + test/kanit-araci.test.mjs; yeni iddia eski araçta kırmızı 47/48, yenide 51/51) → iş listesi tek başına gönderilebilir, CI koşmaz. (2) Kapsayıcı: node_modules YOK → `npm ci` (ders 29: bağ yok); depo SIĞ → teslimden önce `git fetch --unshallow`; Wine/mingw YOK →
  paketten önce kurulur; Go, Chromium, disk (30 GB boş) hazır. (3) İmza anahtarı ve EDM test hesabı bu oturuma verildi; yalnız oturumda durur, kapsayıcı
  yenilenirse yeniden istenir; hiçbir dosyaya yazılmaz. YÜKLENENLER `/root/.claude/uploads/456ebc12-8183-520e-989e-af270fef8a58/`: imza anahtarı
  (*imza-anahtari*.pem), EDM e-SMM Web API v4.4.1 + Request-Response (.docx), durum kodları (.xlsx), esmm-ubl-ornek-veri.xml, Ek_bilgi.txt, TesterCurrent.cs
  (içindeki hesap bilgileri hiçbir yere kopyalanmaz), E-MM zip (e-Müstahsil, kapsam dışı). docx metinleri not defterinde (esmm-dok-v4/; kapsayıcıyla gider,
  belgelerden yeniden çıkarılır).
