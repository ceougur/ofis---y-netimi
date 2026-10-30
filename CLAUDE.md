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
    paralı iadede kartı küçültmeye başladı; Canlı Hata 2 de G1 düzeltmesinin gerilemesiydi). (22.10.2026: madde 5b "Kalan" önceliğini ORTAK sütun
    seçicisinde (dues.mjs classifyColumns) yaptı; ödeme sözü/vade/nakit akışı tutarları da Toplam Borç'tan Kalan Borç'a geçti, Tablodaki Kişiler eski
    kuralda kaldı — komşular denenmemişti; v2.4.3 verisiyle göç karşılaştırması (madde 30) yakaladı. Ortak yardımcı değişince onu kullanan HER yol.)
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
    DİKKAT (22.10.2026, denendi): Claude Code Bash aracında `set -e` ETKİSİZ (`set -euo pipefail; false | tail -1; echo x` → x yazar); zincirde `&&` ya da her
    adımdan sonra `|| exit 1` kullanılır. (Aday 3'te tam npm test kırmızıyken e2e döngüsü sürdü.)
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
    AÇIKLAMA (22.10.2026, kullanıcının 5 dk yetkisiyle önerilen uygulandı — GÖZDEN GEÇİRME 4 (1)): BELGE_YOLLARI içindeki belge (CLAUDE.md, iş listesi, devam notu…) tek
    başına gönderilebilir, CI başlatmaz (13.10 kararı); dışındaki (docs/kanit, testin okuduğu plan/kılavuz belgesi) kodla birlikte gönderilir.

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
    Dosya için de aynı: joker desenle silme yok, yalnız kendi oluşturduğu tam yol silinir. (22.10: f1-rapor ajanı `rm -rf /tmp/kahin-cari-*` ile başka ajanların geçici kâhin
    çıktılarını sildi; o anda koşan kâhin yoktu, kalıcı kanıt depodaydı — zarar yok.)

37. ADAYIN E2E LİSTESİ TAHMİNLE SEÇİLMEZ. Birleştirme adayında (ders 35) "dokunulan" e2e'ler tahminle seçilirse genel davranışı ölçen senaryolar (yenileme/istek
    sayısı, odak, bildirim) dışarıda kalır; adayda ci.yml'nin BÜTÜN e2e listesi koşulur (CI dışı senaryolar madde 30'da). (22.10.2026: aday 2'de 9 e2e seçildi, senaryo-222
    "toplam istek ≤ 50" seçilmedi → CI #858 f6e265b e2e KIRMIZI 55/50; aday 2'deki bir paket arka plan yenilemesini artırmıştı.)
38. KIRMIZININ NEDENİ OKUNUR. Kırmızı kanıt (ders 7) ancak başarısız denetimin iletisinde beklenen neden (iddia edilen davranışın yokluğu) görülünce sayılır;
    test yanlış öğeyi okuyorsa eski kodda da kırmızıdır ama kanıt değildir; yeni kodda yeşil görülmeden kırmızı tek başına sayılmaz. (22.10: Fatura Ayarları kaşe
    açıklaması e2e'si `[data-stamp-field] small` ile önizleme kutusundaki "Kaşe / imza yok" yazısını okudu; eski kodda "kırmızı", yeni kodda da kırmızı çıkınca görüldü.)
39. PENCERE SEÇİCİSİ KONUMA VE KAREYE BAĞLANMAZ. En üstteki pencere `:last-of-type` ile seçilmez: pencereden sonra body'ye eklenen bir div (bildirim kabı, Hızlı
    Arama paneli, açılır menü) onu boşa düşürür → `${MODAL}:nth-last-child(1 of ${MODAL})`. Pencere açılınca okuma, `is-visible`'ı içeren bir beklemeden sonra yapılır
    (sınıf bir kare sonra gelir, içerik ondan önce hazırdır); beklenen soru `if (varsa)` ile atlanmaz, beklenir (ders 34). Zorla üretme: test/e2e/pencere-yaris-zorla.mjs.
    (22.10: CI #861 senaryo-personel-244 12/23, yerelde 64/64; iki ön koşul da aynı imzayı verdi; öbür 33 e2e dosyasında aynı kalıp — iş listesi 7d.)
40. KÂHİN PROGRAMA UYDURULMAZ. Kâhin ile program ayrışınca kâhinin kuralı, programın davranışı görüldükten SONRA "netleştirilirse" bu aynı el riskidir (ders 5): her netleştirme yalnız
    ürün sahibinin kararından ya da önceden yazılmış karar metninden türetilir; baş mimarın verdiği netleştirme "BAŞ MİMAR KARARI" diye iş listesinde ve teslim notunda listelenir, kullanıcıya
    gösterilir; programın davranışı "doğru" diye kabul edilen her netleştirmenin gerekçesi (yaygın uygulama, veri kaybı yok) yazılır. (23.10: aday 17–20'de beş netleştirme — aynı içerikli satır,
    Devamı güncellemesi, çok satırlı kişi, takvim kalemi çatalı, aylık ücret — programın davranışına bakılarak verildi; gerekçeleri yazıldı, GÖZDEN GEÇİRME 6'da listelendi.)
41. BÜYÜK YAPISAL DEĞİŞİKLİK TAM KAPIYI BEKLEMEZ. Yeni bir çekirdek modül ya da para/yükleme yoluna giren yapısal değişiklik adaya girince, son dalga kuralına (GÖZDEN GEÇİRME 5) rağmen o adayda BİR KEZ tam `npm test` (yalnız birim/API, ~30 dk; e2e son dalgada) koşulur; dar testler yalnız değişen alanın dosyalarını seçer, kaynak tarayan genel kuralları (K6 statik, yazım, platform) görmez. (23.10: B1 dataset-bonds.mjs aday 17'de girdi, aday 15–24 yalnız dar koştu; K6 statik "para tablosuna yazan her yer bank.post içinde" testi ancak aday 24 tam kapısında kırmızı — 3438/3439 — bir tam kapı boşa gitti; düzeltme aday 25.)
42. KILAVUZ PDF'İ KAYNAKLA BİRLİKTE ÜRETİLİR. Kılavuz HTML'i değişen sürümde PDF (`docs/kilavuz/pdf-uret.mjs` → `client/kilavuz/`) aynı adayda yeniden üretilir ve `docs/kilavuz/pdf-denetle.mjs`
    ile denetlenir; güncelleme zip'i ve kurulum `client/` klasörünü taşır, CI yalnız HTML'i denetler. (25.10.2026: 2.4.5'te HTML 2.4.5'e güncellendi, PDF "Sürüm 2.4.4" kaldı; tam kapı ve
    CI #871 yeşildi — paket ajanı imzalamadan önce yakaladı; yeniden üretildi, pdf-denetle 39/39.)
43. FARK GÖRÜLDÜKTEN SONRA PARA KURALI KULLANICIYA SORULUR. Kâhin ile program ayrıştıktan sonra para / kapama sırasını belirleyen bir netleştirme gerekiyorsa baş mimar karar vermez;
    soruyu kullanıcıya iki seçenekli (öneriyle) yazar, yanıt gelene kadar o kural ne kâhinde ne kodda kesinleşir; 5 dk yetkisi bu sorulara uygulanmaz. (25.10.2026: K-c yanlış okunup
    kâhinin beklentisi iki kez değiştirildi — KS8.3 üretildi, geri alındı; kullanıcı "anayasamızı ve derslerimize göz at" deyince öz denetimde görüldü, kullanıcı "önerini uygula".)
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
- 2.4.4 kararları (19–22.10.2026; tam metin ve kaynakları `docs/GECMIS-KARARLAR.md` "Arşiv 22.10.2026"): e-SMM EDM ESmmEDM.svc (test …/EFaturaEDM21ea/ESmmEDM.svc,
  canlı portal2.edmbilisim.com.tr/EFaturaEDM/ESmmEDM.svc; adres Entegratör Ayarları'nın servis adresinden türetilir); numarayı program verir; canlıda müşteri EDM'den ayrıca
  e-SMM siparişi verir (kılavuzda); EDM'nin canlı şablonuna güvenilir, kendi e-SMM şablonu yok; VKN'li düzenleyende unvan yalnız PartyName; karekod EDM'nin (EDM 22.10:
  GİB'e uygun, canlıda da); test ortamının görüntüsü canlıdan farklı (BİLİNEN SINIR; ilk canlı makbuzda karekod ve unvan okunur); logo/kaşe e-SMM'de yalnız programın
  PDF'inde. Bırakılan e-SMM "Kâğıt Makbuz Olarak Bırak" (SMM serisi); verilmiş kâğıt/fiş numarası bir daha kullanılmaz (v32 tek seferlik tarama); e-Belge XML'i testlerde
  ve tools/ebelge/dogrula.mjs'te GİB UBL-TR 1.2.1 XSD'siyle de denetlenir; kronoloji iletisi düğmeye bakmaz (I23). İPTAL: e-Arşiv ve e-SMM 8 gün, İLETİM tarihinden
  (başlangıç günü sayılmaz, 8. gün dahil); sonucu belirsiz gönderimde 8 gün geçtiyse yalnız-programda iptalden önce EDM durum sorgusu (bulunamadı → serbest, var →
  reddedilir). Seçilenleri Gönder: seçilmemiş daha eski bekleyen belge gönderimden ÖNCE söylenir (Tümünü Gönder ile aynı sunucu yolu). e-Fatura Portalı: ayrı ekran
  boyu pencere (window.open), ortama göre adres (Test EFaturaUI21ea, Canlı portal4.edmbilisim.com.tr/EFaturaUI/), Turnstile'a dokunulmaz, parola istemciye çıkmaz,
  Beni Hatırla; e-SMM'ye portalda "SMMM Portalı Girişi"; gerçek Windows + Edge elle kabulü kullanıcıda. KAYITTAN TAKSİT KALKTI (taksit yalnız Cari'den / Taksitler'den;
  eski kartlar ve tahsilatlar durur); kayıt kartında "Tahsilat" düğmesi CSS ile gizli; zil ve Ödeme Sözü "Tahsil Et" Cari'ye gider (cari yoksa "önce cari açın" + dolu
  Yeni Cari, Açılış Bakiyesi kayıttaki Kalan Borç); Tablodan Aktar kalır, carinin taksit dışı tahsilatlarını en eski açık taksitten eşleştirir (kartı aşan bölünmez;
  carinin borcu tablodakinden azsa aktarılmaz; faturalı cari dışarıda); Tablodaki Kişiler'de iki sekmedeki aynı dosya no tahsilatı bir kez yazar. UX18: faturadan
  Çek/Senet tahsilatı o faturayı kapatır (bağ cheque_events.invoice_id; taksitli / başka cari / ters yön bağ yok); karşılıksız dönünce kapattığı faturalar yeniden açılır
  — bağlı evrak, faturanın kendi evrakı, ciro ve bağsız evrak dahil (F3; QuickBooks/Xero/Sage), taksitli hariç; cari bakiye ve yevmiye değişmez; carideki "+ Tahsilat"
  Çek/Senet yolunda Kapatılacak Fatura korunur; sürüm notu: "karşılıksız dönen evrakla ödenmiş görünen faturalar artık Açık görünür; cari bakiye değişmez". UI11:
  liste/rapor düğmeleri "PDF" / "Excel" (ne indirdiği başlık ve ipucunda), kart/belge çıktıları adlı, tek görünüm. Entegratör kullanıcı adında http/https/.svc →
  kaydetmeden uyarı. Personel Özlük: iki yetki (görüntüleme / düzenleme; varsayılan yalnız yönetici), yalnız Personel Özeti kartı, Doğum Tarihi → Yaş, Kullanılan
  İzinler (gün), ileri tarihli ayrılış o güne kadar Çalışanlar'da "Ayrılacak", Değişiklik Geçmişi'ne değer yazılmaz (KVKK). 22a İPTAL (kullanıcı: 2.4.0'da e-SMM kesen
  yok; BİLİNEN SINIR). Ek bulgular 25–29 yapıldı.
- 2.4.4 kararları — son aday turu (22.10 18:00 → 23.10.2026; çoğu kullanıcının 5 dk yetkisiyle; tam metin `docs/GECMIS-KARARLAR.md` "Arşiv 23.10.2026"): TABLO BORCU tek
  yardımcıda (server/lib/insight/debt-column.mjs) ve bütün raporlar + Tahsilat Takvimi / zil / ödeme sözü / Tablodan Aktar aynı: Kalan Borç önceliği, Kalan hücresi boşsa
  Toplam; Kalan sütunu YOKSA toplam − ödenen (negatifse 0 + not); gün/adet sütunu tutar değil; tek tutar sütunu borç; Ödeme Sözü tutarı borç değil (beklenen tahsilat); aynı
  sekmede aynı Dosya No ayrı borç/kalem; FARKLI sekmede aynı Dosya No da ayrı borç/kalem + "N dosya no birden çok sekmede; ayrı sayıldı" notu (A1, 23.10 — 03:12'deki "bir kez"
  kararının yerine); iki sekmedeki tahsilat bir kez (5c). Nakit Akışı: Sekme süzgeci uygulanır, Kişi/Durum/En Az Tutar gizli, Kasa sütunları = Kasa raporu ve yalnız Kasa yetkisiyle.
  e-BELGE: gönderim/iptal izi (kesintide Sonucu Belirsiz); 11048'de belge yalnız EDM yanıtındaki KENDİ ETTN'iyle gönderilmiş sayılır (ETTN'siz → Sonucu Belirsiz); Durum Sorgula
  geç sonucu yeni gönderimi ezmez; iptal izi kesin yanıtla kapanır; Yalnız Programda İptal yalnız belirsiz / portal taslağında, 8 gün geçtiyse önce EDM sorgusu (e-Arşiv, e-SMM,
  e-FATURA). NUMARA: silinen kâğıt/fiş/SMM/iç numara kullanılmış sayılır, tarihi sıra-tarih denetimini bağlamaz; Silinenler'den geri yükleme ret sırası numara → dönem kilidi
  (G1: kilitli tarihli belge geri yüklenmez) → sıra-tarih; geri yüklemeden sonra Fatura'da tek seferlik numara uyarısı + 11048 iletisi (B2; EDM'den eşitleme sonraya).
  MAKBUZ (31b): bırakılan kâğıt makbuz "Serbest Meslek Makbuzu" basılır, V.7 onayı, e-SMM'e gönderilmez; GİB e-SMM adları; MM10 GERİ ALINDI (KDV kalem, stopaj belge düzeyinde,
  ≤ 1 kuruş fark); iade asıl belgenin tarafında; yevmiye aynı gün önce belge. ARAYÜZ: Nihai Tüketici kendi işaretli carisi; Başlarken'de yalnız ilk eksik adım koyu, "Şirket Adını
  Yaz"; "Tahsilat Makbuzu Numaraları da Sıfırlansın"; Verisini Sıfırla / Şirketi Sil kırmızı. SÜREÇ: 2.4.4 yama sürümü (ölçek koşusu 2.5.0'da); windows.yml PR'dan önce iki koşu.
  SONRAYA (2.4.5+): MM1 cari "Stopaj Yapar", MM2, MM9, MM12, 30.000 TL (mali müşavire sorulur), EDM'den numara eşitleme, kalıcı dönem kilidi özeti + invoices/vat_offsets
  kapıya, yapışkan TOPLAM satırları, dar pencereler / ad-yazım / UI11 küçükleri, 7d sonrası 33 e2e seçici, altın test m6 gevşekliği, Seçilenleri Gönder'e Silinenler belgesi (API).

- 2.4.4 kararları — son aday turu 2 (23.10.2026 05:00 → 13:00 UTC, aday 15–20; tam metin `docs/GECMIS-KARARLAR.md` "Arşiv 23.10.2026 (2)"; sürüm notu cümleleri iş listesi "Teslim notları"): İÇE ALMA: sayı türündeki hücre sayıdır, Türkçe binlik tahmini yalnız dizgede; "1,234.56" iki çözümleyicide aynı. KİŞİ: kimlik yalnız AYNI adı ayırır, sağlamasız TCKN/VKN kimlik değildir, aynı ad + telefon/kimlik tekse aynı kişi. KOLON: kimlik/numara başlıklı sütun tutar ve kayıt kimliği değildir; borç yalnız para kolonu (telefon/TC/"Borçlu …" asla); vergi kolonu yalnız başka tutar varken borç dışı; Tutar + Genel Toplam → Genel Toplam (5 dk yetkisiyle A); Kalan doluysa Kalan, boşsa ana tutar, belirlenemezse not. TAKVİM KALEMİ = min(dönem/taksit tutarı, Kalan), Kalan boşsa dönem tutarı, Kalan ≤ 0 ise kalem yok, söz kalemi söz tutarı; Kişiler ve Açılış Bakiyesi satır borcu (aylık ücret açılış borcu değil). KAYIT BAĞI (B1, v2.4.3'te de kopuyordu): yükleme/eşitleme bağlı veriyi sessizce koparmaz — güvenli eşleşmede taşınır, yoksa adlı uyarı + onay, Sheets eşitlemesi bekler, eşleşmeyen silinmez; Dosya No'lu kayıtlar arasında bağ taşınmaz (N1, kullanıcı A); Devamı Olarak Ekle farklı kişiyi mevcut satırın yerine koymaz; kayıt kaldıran her yol bağları adıyla sorar; bayat anahtara yazım 409. SÜREÇ: "B" (her bulgu) → revizyon (YÜKSEK/ORTA düzeltilir, DÜŞÜK 2.5.0) → durma kuralı (dar kontrol yalnız son düzeltmenin farkı). Kâhin netleştirmeleri (baş mimar) iş listesi "BAŞ MİMAR KARARLARI".

## Açık iş (yalnız güncel; kapanan sürümler `docs/GECMIS-KARARLAR.md`)
- YENİ OTURUM (kullanıcı, 26.10.2026: "2.4.7'yi yeni oturumda yapmaya karar verdim"): ÖNCE `docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` (tam devir teslim belgesi: ilk 15 dk, çalışma prensipleri, 2.4.7 kapsamı, altyapı, ileride yapılacaklar, hatırlatıcı taşıma, yeniden yüklenecek dosyalar).
- (Arşiv 29.10) 2.4.7 oturumu 26.10 açıldı (session_01YPtTa36rhoDHXGQsPrhcJ8); dal iki depoda claude/compassionate-galileo-f9kghg; devir hatırlatıcısı trig_0144yLFe3Mqtv8rS1mQ3iGur (23.11.2026 09:00 TR, bu oturuma bağlı; eski trig_01DE8bFDurzMRT6thbptBrQM kapalı); paketteki CLAUDE-ENTEGRASYON.md eski hâl, geçerli olan devir belgesi §3.1.
- (Arşiv 29.10) 2.4.7 KAPSAMI DARALMAZ (kullanıcı 27.10): M2 eşleme + 3 cihaz, M3 R2 özet + kapıcı + m. sayfası, M4 tünel, M5 mobilden tahsilat/ödeme/stok HEPSİ 2.4.7. İmza anahtarı bu kapsayıcıda /root/.claude/uploads/2a941a30-cea4-5380-a679-f28a541c21a1/2d5a0de8-destekofis-imza-anahtari-GIZLI_1.pem (yalnız release.mjs --anahtar).
- (Arşiv 29.10) Maliyet Hesap Kartı müşteri istekleri (1)–(4) ve Ayrıntılı Cari Ekstre (5)+(6) 2.4.7'de YAPILDI (iş listesi; kararlar: KDV/Maliyet/Masraf kutuları boş, "Toplam" etiketi, Enter = Tab, ekstrede "Satış" kısa adı, sütun seçimi kişi başına hatırlanır, kalem açıklaması = invoice_lines.description). Tam metin arşivde.
- SIKIŞTIRMA ÖNCESİ DURUM 3 (29.10.2026 ~19:00 UTC; kullanıcı: "sohbet sıkıştırması için hazırlık yap") — ayrıntı ve kanıt docs/2.4.7-IS-LISTESI.md (BAĞIMSIZ GÖZDEN GEÇİRME altındaki DÜZELTMELER BİRLEŞTİ, BAŞ MİMAR KARARLARI, DAR KONTROL, DAR KONTROL 2, SON ADAY GEZİNTİSİ, KAPICI CANLIYA GÜNCELLENDİ, SON ADAY CI + UD + WINDOWS, SON ADAY TAM KAPI; SONRAKİ SÜRÜME). PROGRAM dalı = 5cd00d29 (yerel = origin, temiz). ÜRÜN KODU SON ADAY = fbeb8134 (sonrası yalnız belge/kanıt + sürüm paketi 044028d0 → 5cd00d29: package.json 2.4.7, CHANGELOG, docs/2.4.7-DEGISIKLIKLER.md, kılavuz 2.4.7 + PDF 39/39, pdf-denetle "Kasa ve Banka" mobil ekran istisnası; Maliyet Hesap Kartı sürüm notuna GİRMEZ — 2.4.6 düzeni). BİTENLER: B1–B5 + K1 (son kaydolan kazanır) + dönen ofis + tünel saat telafisi; gezinti 37 adım (B1/B2 ORTA + D1–D9 kullanıcı kararıyla düzeltildi, D7 "Tahsilat Yeri boş gelir"); CI #916 fbeb8134 YEŞİL 7/7; windows.yml #60 + #61 YEŞİL; TAM KAPI fbeb8134 (npm test 3906/3906, ci.yml 85/85, CI dışı 14/14, kâhinler — yalnız belgeli E02 + sayaç U44/U47/U48); kapıcı CANLI sürüm 5eaae21d (kullanıcı "çalıştır"; m. ve kapi. destekofis.net bu ortamdan doğrulandı — kullanıcı ağ iznine ekledi); tanıtım görseli docs/pazarlama/DestekOfis-Tanitim-Mobil.png; SİTE dalı claude/compassionate-galileo-f9kghg = 3704d4d (mobil kartı + üstte rozet + #mobil bölümü; YAYIN GÜNÜ kılavuz PDF'iyle aynı PR'da). SÜRÜYOR: Uzun Doğrulama #827 (run 40916441140, 5af83ffd = kod fbeb8134; 16:56 UTC başladı, ~20:30 biter; kâhin e-Belge/tutar/cari yeşil) ve CI 5cd00d29 (arka plan bl5aqne1b; ci-5cd00d29.txt not defterinde). KAPSAYICIDA HAZIR: Wine + windres (apt ile kuruldu), imza anahtarı /root/.claude/uploads/2a941a30-cea4-5380-a679-f28a541c21a1/2d5a0de8-destekofis-imza-anahtari-GIZLI_1.pem, wrangler not defteri wrangler-247; disk ~11 GB boş (birleşmiş 15 ajan kopyası silindi; kilitli kopyalar duruyor). SIRADAKİ: (1) UD #827 bütün işleri + CI 5cd00d29 7/7 ana oturumca okunur (ders 1, 21); (2) `node tools/release.mjs --anahtar <yukarıdaki pem>` + `npm run build:windows` (temiz ağaç + CI yeşil şart); (3) teslim TESLİM BİÇİMİ: 5 dosya ayrı (destekofis-guncelleme-2.4.7.zip, destekofis-guncelleme.json imzalı, DestekOfis-Kullanim-Kilavuzu.pdf, DestekOfis-Kurulum.exe [30 MB üstüyse parca0 + parca1 + BIRLESTIR.bat], .sha256) + arşiv zip (git fetch --unshallow → git bundle → klondan doğrula) + sürüm notu metni + DENENEN/DENENMEYEN/BİLİNEN SINIRLAR + kısa elle kabul listesi (mobil: gerçek telefon + gerçek tünel kullanıcının kendi 2.4.7 kurulumunda); (4) PR (claude/compassionate-galileo-f9kghg → master) aç, PR CI 7/7 → squash birleştir (TESLİM YETKİSİ), master CI oku; (5) kullanıcı yayını açar: https://github.com/ceougur/ofis---y-netimi/releases/new?tag=v2.4.7&target=master&title=DestekOfis%202.4.7 ; "yayımladım" → 5 dosya bayt bayt + eski güncelleyiciler "available"; (6) site PR'ı (kart + #mobil + kılavuz PDF web/indir/) aç, kullanıcının "birleştir"iyle; (7) tanıtım görseli yayından sonra paylaşılır. BİLİNEN SINIR adayları (teslim notu): D1 ~12 milyon TL üstü faturada 1366 px'te ekstre taşması (kutu içi kaydırma); D9 lisans elle denetlendikten sonraki ≤30 sn içinde açılan telefon "ofis kapalı" görebilir; günlük 50 yeni ofis tavanı küresel; kapıcı temizlik yarışı ve devralma sonrası boş özet (sonraki sürüm). 30 dk RAPOR görevi bu oturumda kurulu (sıkıştırmadan sonra da gelir).
- İSTEK (kullanıcı, 29.10.2026 ~18:55 UTC: "hız testi falan yaptık mı?" → yanıt: tam npm test + hiz-243-arka-plan e2e 13/13 koştu; büyük ölçek koşusu 2.5.0'a bırakılmıştı; MOBİLE ÖZEL hız ölçümü YOK (kör nokta) → öneri; kullanıcı: "uzun doğrulama bitene kadar yapalım, önerini uygula"): MOBİL ÖZET ÖLÇÜMÜ — tools/olcek-210.mjs veri aşaması (3.000 cari, ~112.000 para satırı, 2 şirket; programın kendi API'si) üzerinde: özetin hazırlanma süresi + boyutu (1–3 kullanıcı), özet hazırlanırken masaüstü istek süreleri (özetsiz hâlle karşılaştırmalı) + olay döngüsü gecikmesi. Kabul edilebilirse rakamlar teslim notuna; değilse kullanıcıya getirilir (kendiliğinden düzeltme yok). Ürün kodu değişmez; kanıt paketlemeden sonra depoya.
- YETKİ (kullanıcı, 29.10.2026 ~20:57 UTC: "ben yatıyorum, 6 saat sonra gelirim. pr birleşmiş ve paket teslim edilmiş olursa linki verirsin yüklerim. aksi durumlarda 5 dk soruna cevap vermezsem eğer; piyasada uygulanan en modern ve yaygın önerini uygula. her yarım saatte bir testleri kontrol et"): CI #920 + UD #840 + windows.yml #62/#63 (03e0f55a) YEŞİL okununca ana oturum kendiliğinden: release.mjs --anahtar + build:windows → 5 dosya + arşiv zip (TESLİM BİÇİMİ) → PR → PR CI 7/7 → squash (TESLİM YETKİSİ) → master CI → yayın bağlantısı. Kırmızı/soru çıkarsa soru öneriyle sorulur, 5 dk yanıtsızsa en yaygın/modern öneri uygulanır ve "5 dk yetkisiyle" iş listesine yazılır; SINIRLAR aynen (yayını kullanıcı açar; canlı Supabase/DNS/kapıcı dağıtımı, müşteri/kimlik bilgisi, ders 43 para kuralı yetkiye girmez). Yarım saatte bir kontrol (30 dk RAPOR görevi).
- KARAR (kullanıcı, 29.10.2026 ~20:40 UTC, iki seçenekli soruya: "2.4.7'de düzelt, UD yeniden (Önerilen)"): mobil özet ölçümünün M-H1 (/api/mobil/cash bütün kasa hareketleri → 3 kullanıcıda özet > 8 MB, 413) ve M-H2 (özet iç istekleri arasında olay döngüsüne sıra yok → masaüstü ~10 sn bekler) bulguları 2.4.7'de düzeltilir: mobil Kasa yanıtından entries atılır + icIstek her çağrıda setImmediate; kırmızı/yeşil kalıcı testler, CI 7/7, mobil e2e'ler, tam npm test; ürün kodu değiştiği için Uzun Doğrulama yeni commit'te YENİDEN (29.10 KOŞUL kuralı); ölçüm yeniden koşulup teslim notuna. Ayrıntı docs/2.4.7-IS-LISTESI.md "MOBİL ÖZET ÖLÇÜMÜ".
- SORU/İSTEK (kullanıcı, 29.10.2026 ~14:20 UTC: "uzun koşuya başlamadan önce son adayı kendin windowsta çalıştırıp gerçek kullanıcı gibi kullanacaksın değil mi derslerimiz gereği?") → EVET, UD'den ÖNCE ve şu sırayla: (1) son aday tam kapı — tam npm test + ci.yml'nin bütün e2e'leri + CI dışı senaryolar (gerçek Chromium programı kullanıcı gibi sürer; ders 8/37) + günlük iş akışı baştan sona (kişi → cari → taksit → tahsilat → kasa → rapor) + MOBİL akış telefon boyutunda (eşleme karekodu, giriş, telefondan tahsilat, sunucu kapalıyken son özet, cihaz silme) yerel kapıcıyla, ekran görüntüleriyle; (2) GERÇEK WINDOWS: CI Windows Node 22/24 bütün testler (tünel süreç yönetimi sahte cloudflared ile dahil) + windows.yml ×2 (gerçek kurulum .exe: sessiz kurulum, servis, ilk giriş, veri kaydı, yedek, yeniden başlatma, otomatik güncelleme, yeniden kurulum, kaldırma; ders 18); (3) ancak sonra UD. SINIR (kullanıcıya söylendi): bu kapsayıcı Linux; Windows masaüstünde fareyle tıklama ve gerçek telefon + gerçek tünel buradan yapılamaz → teslimde kısa ELLE KABUL LİSTESİ (KANIT 5; mobil adımlar + beklenen sonuç), yayın açılmadan önce kullanıcının kendi Windows kurulumunda.
- KARAR (kullanıcı, 29.10.2026 ~14:25 UTC: "windows kurulum denemesi iki koşu ile uzun doğrulama github'da aynı anda ücretsiz yapılabilir mi? windows koşularında hata çıkarsa uzun koşu tekrar başlatılır, zamandan tasarruf") → EVET (derslere aykırı değil; 2.4.6'da UD #698 tam kapıyla paralel başlatılmıştı): depo açık → standart koşucular ücretsiz; aynı anda iş sınırı (~20) yalnız kuyruk yapar. KOŞUL: aynı son aday kodu (UD + windows.yml ×2 aynı commit), gezinti temiz + o commit'in CI'si 7/7 görülünce üçü BİRLİKTE başlatılır; yerel tam kapı paralel sürer. Windows ya da tam kapı ürün kodu değiştirirse UD yeni commit'te yeniden (bedeli yalnız süre). Ders 18: iki Windows koşusu ayrı ayrı yeşil okunur; ders 21: her koşu ayrı okunur.
- KARAR (kullanıcı, 29.10.2026 ~15:15 UTC: "ajanın düşük bulgularını inceledim, bence bunlar da düzeltilmeli") → 2.4.7 son aday gezintisinin DÜŞÜK bulguları D1–D9 BU SÜRÜMDE düzeltilir (27.10 "DÜŞÜK sonraki sürüme" kuralının bu liste için istisnası; baş mimar katıldı: çoğu metin/görünüm, ~1–2 saat, tam kapı henüz koşmadı). D7 (ders 43 sorusu, kullanıcı yanıtı "Boş gelsin, seçtirsin (Önerilen)"): telefondan Tahsilat Gir'de carinin AÇIK taksit kartı varsa Tahsilat Yeri BOŞ gelir, seçilmeden Kaydet çalışmaz (masaüstündeki "Taksite Yaz / Taksit Dışı" sorusuyla aynı düzen); taksit kartı yoksa bugünkü gibi. Ayrıntı docs/2.4.7-IS-LISTESI.md "SON ADAY GEZİNTİSİ".
- İSTEK (kullanıcı, 29.10.2026 ~17:05 UTC, tanıtım görseliyle: "buna artık cebinizde, mobil sürüm yayında gibi bir cümleyi ön plana çıkartarak hazırlar mısın") → YAPILDI: docs/pazarlama/DestekOfis-Tanitim-Mobil.png (1080×1350; aynı tasarım dili, Manrope + DM Sans, özgün logo; "YENİ · Mobil sürüm yayında" + "Artık cebinizde." + telefon çizimi; özellik listesi 5 madde; "Mobil dahil tüm özellikleriyle"), kaynak …-kaynak.html + çizim betiği. UYARI (kullanıcıya söylendi): "yayında" cümlesi 2.4.7 yayımlanınca paylaşılır.
- İSTEK (kullanıcı, 29.10.2026 ~17:10 UTC: "destekofis.net sitenin üst kısmına da bu mobil resmini, mobil içeriğini ekleyelim") → YAPILDI site dalında (claude/compassionate-galileo-f9kghg): hero rozeti "YENİ · Mobil sürüm yayında · Artık cebinizde" (#mobil), menüde "Mobil", hero altında #mobil bölümü (başlık "Artık cebinizde.", 4 madde, tanıtım görseli web/assets/destekofis-mobil.webp 720×900 69 KB); masaüstü/telefon/koyu tema ekran görüntüsüyle denetlendi (taşma yok, hata yok). YAYIN GÜNÜ kılavuz PDF'iyle aynı site PR'ında birleşir (önce değil).
- İSTEK (kullanıcı, 29.10.2026 ~12:20 UTC: "web sitesine yeni özelliği yazdın mı, kullanım kılavuzuna mobil hap bilgiyi ekledin mi?") → İKİSİ DE YAPILMAMIŞTI (kontrol edildi: kılavuzda mobil bölüm yok, sitede mobil kartı yok). 2.4.7'ye: (a) kılavuza "Telefondan Kullanım" hap bilgisi (eşleme karekodu, ana ekrana ekle, giriş, sunucu kapalıyken son özet, telefondan tahsilat/ödeme/stok, 3 cihaz, cihaz silme) — ekran adları koddan; PDF ve sürüm satırı paket adımında (ders 42); (b) site index.html özellikler bölümüne mobil kartı — site PR'ı yayın günü kılavuz PDF'iyle birlikte birleşir (yayından önce canlıya çıkmaz). EK (kullanıcı, 29.10.2026 ~12:25 UTC: "kılavuzun başında excel ve sheets konusu çok uzun geçiyorsa oraları da kısalt") → kılavuzun baştaki Excel / Google Sheets bölümleri kısaltılır (yalnız gereken adımlar; para sınırlaması cümleleri kalır).
- ERTELENDİ → SONRAKİ SÜRÜM (kullanıcı, 29.10.2026 ~13:05 UTC: "lisans hoşgörüsünü de sonraki sürüme bırak uygunsa?" — baş mimar: uygun; 2.4.7'de bugünkü güvenli davranış: ücretli lisans da bitişte mobili HEMEN kapatır, mesaj "Lisans geçerli değil; uzaktan erişim kapalı…") aşağıdaki karar ve uyarılar 2.4.7 kapsamından ÇIKTI; sonraki sürümde temizlik işiyle birlikte. — ESKİ: KARAR → 2.4.7 (kullanıcı, 29.10.2026 ~13:00 UTC: "lisanslı kullanıcının da lisansı bitince 1 ay boyunca lisansını yenilemezse kullanımı kapatılsın. mobil kullanım hakkının da sona erdiğini program uyarsın"; iki seçenekli soruya yanıt: "30 gün mobil hoşgörü" + "bitişten 7 gün önce + bitince"): ÜCRETLİ LİSANS (kind license, status active) bitince masaüstü bugünkü gibi salt okunur; MOBİL 30 GÜN daha çalışır — salt okunur görüntüleme (canlı + son özet; yazma programın salt okunur kuralıyla kapalı), her girişte uyarı; 30. günün sonunda kapanır (program + kapıcı + tünel aynı kuralla). Engellenen lisans ve DENEME hoşgörü ALMAZ (deneme bitişte hemen kapanır — önceki karar). UYARI: bitişe 7 gün kala Yönetim → Mobil Cihazlar + telefonda "lisans X gün sonra bitiyor" notu; hoşgörüde "Lisansınız bitti; mobil kullanım hakkınız N gün sonra sona erecek"; sonra "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin". Uygulama: kapıcı/B düzeltmeleri birleşince tek ajan (xhigh; lisans kapısı). Hoşgörü bitiminden 30 gün sonra mobil kaydın silinmesi → sonraki sürüm temizliğine (deneme kararıyla birlikte).
- KARAR (kullanıcı, 29.10.2026 ~12:55 UTC: "demosu biten kullanıcı mobili de kullanamasın lisans alana kadar") → ZATEN BÖYLE (koddan: program mobile-remote.mjs licenseOk = lisans yazılabilir; deneme dolunca salt okunur → bütün uzak istekler + karekod 403 remote-license; kapıcı belirteç bitiş anında kapanır, kapi-247 testi). Kalıcı test eklendi: test/mobil-deneme-bitis-247.test.mjs (deneme bitince oturum/sayfa/giriş/karekod 403, eşleme silinmez, lisans alınınca aynı telefon döner) — mutasyonla (licenseOk hep true) KIRMIZI "deneme bitince eşli telefonun oturumu kapanmalı · actual 401", yeni kodda yeşil.
- TESLİM YETKİSİ (kullanıcı, 29.10.2026 ~12:10 UTC: "paket ve teslimde exe dosyası 30 mb üzerine çıkar muhtemelen, iki parça verip birleştir bat veriyordun eski oturumda, ayrıca uzun cl koşusu bitince birleştirme işini de yap. bana paketi yükleyeceğim github linkini ver"): 2.4.7 teslimi TESLİM BİÇİMİ düzeninde (5 dosya ayrı; exe 30 MB üstüyse parca0 + parca1 + BIRLESTIR.bat). PR → master BİRLEŞTİRME YETKİSİ VERİLDİ: Uzun Doğrulama (+ son aday tam kapı, PR CI 7/7, windows.yml ×2) YEŞİL görülünce ana oturum PR'ı kendisi birleştirir (squash), master CI'sini okur; yayını (etiket v2.4.7 + 5 dosya) kullanıcı açar: https://github.com/ceougur/ofis---y-netimi/releases/new?tag=v2.4.7&target=master&title=DestekOfis%202.4.7 .
- İSTEK → SONRAKİ SÜRÜM (kullanıcı, 29.10.2026 ~12:05 UTC): Operatör Merkezi Altyapı limitlerine Cloudflare mobil limitleri kartı (Worker istek/gün, R2 depolama + işlem, tünel sayısı); ayrıntı docs/2.4.7-IS-LISTESI.md "SONRAKİ SÜRÜME". AYRICA 29.10: Cloudflare (R2 destekofis-ozet, Worker destekofis-kapi, kapi./m./*.destekofis.net, iki gizli), C3 canlı SQL ve site PR ceougur/destekofis#23 kullanıcı onayıyla CANLIDA (iş listesi "CLOUDFLARE KURULUMU").
- YETKİ YENİLENDİ (kullanıcı, 29.10.2026 ~03:10 UTC: "bana yönelttiğin bir soruya 5 dk içinde cevap vermezsem piyasada en yaygın şekilde uygulanan önerini yap"): 22.10 YETKİ maddesiyle aynı düzen — soru iletide öneriyle sorulur, 5 dk sonrasına kendine hatırlatma, yanıt yoksa en yaygın uygulama/öneri uygulanır ve "5 dk yetkisiyle uygulandı" diye iş listesine yazılır, kullanıcı dönünce özetlenir. SINIRLAR (değişmez): anayasanın kullanıcıya bıraktığı adımlar (PR → master "birleştir", yayın, canlı Supabase/DNS, müşteri/kimlik bilgisi) ve ders 43 (kâhin–program farkından SONRA para/kapama kuralı) bu yetkiye girmez, yanıt beklenir.
- 2.4.7 BAŞLADI (kullanıcı, 27.10.2026 ~06:15 UTC: "edm için yapılacak düzenlemeyi medium, mobil arayüz işi için hıgh eforlu ajanlar görevlendirerek başla"): iş listesi docs/erp/2.4.7-IS-LISTESI.md (madde 0a ile docs/2.4.7-IS-LISTESI.md); EDM ajanı (A1/A2/B1/B2) MEDIUM — kullanıcının açık kararı, CLAUDE.md e-Belge xhigh kuralının yerine bu iş için; bağımsız sayaç kâhini xhigh (kâhin kuralı); mobil arayüz dalga 1 (salt okunur, program içinde) HIGH. Ajanlar ayrı git worktree dallarında (is/edm-247, is/mobil-arayuz-247, is/kahin-sayac-247); birleştirmeyi ana oturum yapar. 30 dk ara rapor görevi kuruldu. KARAR (kullanıcı, 27.10.2026: "önerilerin uygun"): EDM sayacı S1–S5 önerildiği gibi (gönderim ayı; şirket başına ayrı; kendi ETTN'li 11048 kesinleşme; geri yükleme/sıfırlama sayacı etkilemez → sayaç şirket dosyası dışında; son 3 ay = bu ay + önceki 2, ay başına satır) — ayrıntı docs/2.4.7-IS-LISTESI.md "KARARLAR". Üç dal çalışma dalında birleşti (27.10). KARAR (kullanıcı, 27.10.2026: "sorularına önerini uygula, kör nokta için en yaygın ve basit çözümü yap"): kâhin farkı F1 ikinci gönderimin ayı, F2 sayılır (ilk açık iz ayı); sayaç defteri her şirket yedeğine kopyalanır, geri yüklemede yalnız birleştirilir (azalmaz). KARAR (kullanıcı, 27.10.2026: "işi büyütme, genişletme"): 2.4.7 kapsamı iş listesindeki maddelerle sınırlı; yeni madde, ek senaryo turu, ek kâhin turu AÇILMAZ. Sayaç kâhini için son tur: devam eden iki iş (kâhine Y1/Y2/Y5, programda Y3) bitince BİR karşılaştırma; kalan fark müşteriye/paraya sorun değilse BİLİNEN SINIR ya da sonraki sürüm. KARAR (kullanıcı, 27.10.2026: "çıkacak küçük bulgular eğer programın çalışmasına, müşteri için soruna yol açmayacaksa bir sonraki sürümde düzeltilsin"): 2.4.7'de bulunan küçük bulgu (DÜŞÜK; programın çalışmasını, müşteri verisini/parasını, e-Belgeyi, güvenliği ve yetkiyi etkilemeyen) bu sürümde düzeltilmez, iş listesi "SONRAKİ SÜRÜME" bölümüne yazılır; YÜKSEK/ORTA ve müşteriye sorun çıkaran her şey bu sürümde düzeltilir (KARAR REVİZYONU ile aynı). Kuşkuda sınıf "müşteriye sorun çıkarır" sayılır.
- (Arşiv 29.10) 26.10 sıkıştırma notu (2.4.6 kapandı, 2.4.7 tahmini 5–6,5 gün, kör noktalar: cloudflared kuruluma konmaz, Worker ücretsiz ~100k istek/gün, Cloudflare Access kullanılmaz) arşivde.
- ARŞİV (24.10.2026, 2.4.5 öncesi "kısa tutulur" + sıkıştırma hazırlığı): 2.4.4'te kapanan 14 madde (2.4.4 BAŞLADI, GÖZDEN GEÇİRME 6, KARAR REVİZYONU, DURMA KURALI, ADAY 20–22, DONDURMA [aday 23–25 + tam kapı], AÇIK CI #864, birleştirme KARARI, İSTEK 23.10, SON ADAY BAĞIMSIZ TURU, RAPOR DÜZENİ, HAZIRLIK 21.10) `docs/GECMIS-KARARLAR.md` "Arşiv 24.10.2026"ya AYNEN taşındı. Bunlardan süren KURALLAR: KARAR REVİZYONU (YÜKSEK/ORTA düzeltilir, DÜŞÜK sonraya + SAKINCA SÜZGECİ), DURMA KURALI, YETKİ (5 dk), RAPOR DÜZENİ (yeni sürümde "başla"da 30 dk rapor işi + iş listesi çizilir) — yeni sürümde de geçerli; ayrıntı arşivde. Uploads klasöründe imza anahtarı + EDM belgeleri durur (kapsayıcı yenilenince yeniden istenir).
- (Arşiv 29.10) 2.4.4 (24.10, PR #34), 2.4.5 (25.10, PR #35), 2.4.6 (26.10, PR #36) YAYIMLANDI ve KAPANDI — her biri 5 dosya bayt bayt, eski güncelleyiciler canlıda "available", site kılavuz PR'ı (#20, #21, #22), Sürüm yayımla yeşil. Tam metin arşivde.
- MOBİL (kullanıcı, 26.10.2026: "ben büyük ölçüde kodlama işini bitirdim, programımıza ve sistemimize uygunsa kalan kısmını yapabiliriz"): kullanıcı DestekOfis Mobil v0.3 paketini yükledi (ayrı Node ağ geçidi + PWA; Cloudflare Tunnel + Access ile CANLI erişim, yazma kapalı, raporlar salt okunur; uploads klasöründe zip + sunum PDF + doğrulama notu). İnceleme (salt okuma): kullandığı API uçları 2.4.6'da var; testleri burada 12/12 yeniden koşuldu. ÇELİŞKİ: `docs/PRO-UZAKTAN-GORUNTULEME.md` kararı şifreli özet + R2 idi, Tunnel "şimdilik reddedildi" (sunucu açık olmalı) → yön kararı kullanıcıda. Kör noktalar yanıtta verildi (ayrı kurulum yerine programın içinde, Access kullanıcı sınırı, alan adı, lisans Pro kilidi bizde, yazma para çekirdeği kurallarıyla sonra). Bu oturumda Cloudflare API belirteci çalışmıyor (6111), bağlayıcı çalışıyor (kova/Worker 0). Sıra kararı (devirden önce/sonra) kullanıcıda.
- KARAR (kullanıcı, 26.10.2026: "devir modülünü 1 ocağa kadar yapabiliriz, müşteriler hep mobil özelliğini soruyor … önceliği mobil yapalım. 2 önerilerin makul"): ÖNCELİK MOBİL (sürüm 2.4.7), devir 2.5.0 sonra (1 Ocak'ta yayında; en geç ~10 Aralık başla; hatırlatıcı trig_01DE8bFDurzMRT6thbptBrQM 23.11 istemi güncellendi). Yöntem DOĞRUDAN BAĞLANTI (Cloudflare Tunnel; Eylül'deki şifreli özet kararının yerine) + öneriler: programın içinde (aynı kurulum/güncelleme), Access yerine programın kendi karekodlu cihaz eşlemesi + DestekOfis girişi, alan adı, Pro kilidi, ilk sürüm salt okunur (yazma sonra, para çekirdeği kurallarıyla). Kullanıcının mobil arayüzü (v0.3 public/) AYNEN kullanılır; telefonda masaüstü ekranı gelmez. "başla" bekleniyor.
- KARAR (kullanıcı, 26.10.2026, mobil): kullanıcı Eylül planını hatırlattı ("yönetim paneline bir kart yapıp telefonunu oradaki karekoda okutup eşleştirme … bana her müşteri için ayrı bir iş oluşmuyordu … kota dolmuyordu … sunucu kapalıysa programın son hali mobilde görünüyordu, sadece tahsilat giremeyecekti") → YÖNTEM: Eylül yolu (şifreli özet R2 + Worker kapıcı + Yönetim'de karekodlu cihaz eşleme, müşteri başına elle iş yok) + sunucu açıkken canlı bağlantı (tahsilat, canlı PDF/Excel; tünel program tarafından kapıcı üzerinden kendiliğinden açılır). Ekranlar kullanıcının v0.3 arayüzü. "pro sürüm olmayacak şimdilik. hepsi aynı sürümde çıkılacak" → mobil HERKESE (Pro kilidi yok), görüntüleme + canlı + tahsilat TEK SÜRÜM 2.4.7. Ön koşullar: alan adı (tünel için), Cloudflare API belirtecinin yenilenmesi. "başla" bekleniyor.
- KARAR (kullanıcı, 26.10.2026, mobil): "3 mobil kullanıcı sınırı getirelim. program başına" → kurulum/lisans başına (iki şirket birlikte) en çok 3 kullanıcı "Uzaktan Bağlanabilir"; sınır programda VE kapıcıda (Worker, lisansa göre) uygulanır; lisansta sayı alanı (varsayılan 3; operatör ileride değiştirebilir). Kullanıcı başına cihaz sayısı AÇIK (öneri: 2 — telefon + tablet; yanıta göre). NETLEŞTİ (kullanıcı, 26.10.2026: "tablet de mobil sayılsın, 3 tane uzaktan bağlantı cihazı olsun") → SINIR CİHAZ BAŞINA: program başına (iki şirket birlikte) en çok 3 EŞLİ UZAKTAN CİHAZ (telefon, tablet, uzaktaki bilgisayar tarayıcısı hepsi sayılır); kullanıcı sayısı ayrıca sınırlanmaz (3 cihaz aynı ya da farklı kullanıcıların olabilir); cihaz silinince yer açılır; programda + kapıcıda uygulanır; lisansta sayı alanı (varsayılan 3).
- (Arşiv 29.10) ALTYAPI (26.10, TAMAM): destekofis.net Cloudflare'de (zon a4521bf58a43349c69a0fdafb985bc83); Vercel destek-ofis: destekofis.net Production + www 308; destek-ofis.vercel.app DOKUNULMAZ (lisans adresi); Search Console doğrulandı (TXT silinmez); Email Routing destek@destekofis.net → bilgi.ugurcetin@gmail.com, SPF + DMARC p=none. Cloudflare belirteci: Ağ gizli anahtarı, Ön ek "Bearer", değer yalnız belirteç. Tam metin arşivde.
- İSTEK → 2.4.7 KAPSAMI (kullanıcı, 26.10.2026: "bu yeni maili, sitemizden, kılavuzdan, admin mesajından, vs düzeltelim. yaptığımız sürüme ekleyelim"): görünen destek e-postası destekofis@proton.me → destek@destekofis.net (Cloudflare Email Routing → bilgi.ugurcetin@gmail.com; kural kullanıcıca kuruldu, Catch-all kapalı). Programda (envanter 26.10): server/lib/license.mjs SUPPORT_CONTACT, client/assets/hof-license.js, client/admin.html, docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html (+ PDF yeniden üretilir, ders 42), packaging/windows/setup.iss, tools/build-windows.mjs (build/ stage çıktıları üretimle değişir), CHANGELOG yeni girdi; GEÇMİŞ CHANGELOG girdileri ve docs/fatura/E-BELGE-EDM.md (EDM hesabının e-postası olabilir) DEĞİŞMEZ, gözden geçirilir. Site ceougur/destekofis (sayfalar + Operatör Merkezi metinleri) aynı sürümün site PR'ına. KÖR NOKTA: proton.me HESAP olarak (Cloudflare/Vercel/GitHub/EDM girişleri) DEĞİŞMEZ ve kapatılmaz — kurulu eski sürümler onu göstermeye devam eder.
- İSTEK → 2.4.7 KAPSAMI (kullanıcı, 26.10.2026: "site ismimize artık yeni alan adımızla değiştirelim aynı yerlerde"): görünen site adresi destek-ofis.vercel.app → destekofis.net (hof-license.js metni, updater.mjs kullanıcı aracısı, kılavuz, kurulum metni, tanıtım metni, site + Operatör Merkezi bağlantıları). LİSANS ADRESİ: DEFAULT_LICENSE_SERVICES = [destekofis.net/api/lisans, destek-ofis.vercel.app/api/lisans] (yeni önce, eski YEDEK; liste birden çok adresi destekliyor); destek-ofis.vercel.app KALICI açık kalır (kurulu sürümler onu kullanır); lisans-servisi-izolasyonu testi + windows.yml hosts/HUKUK_LICENSE_URL düzeni İKİ adı da kapsayacak şekilde güncellenir (ders 30). Geçmiş CHANGELOG / kanıt belgeleri değişmez. TÜNEL (soru "tünel işi yapıldı mı?"): YAPILMADI — 2.4.7 kodunun parçası (program kapıcı üzerinden ofis başına tüneli kendiliğinden açar); ön koşullar HAZIR: alan adı etkin, belirteç cfd_tunnel listesini okuyor (0 tünel). KARAR (kullanıcı, 26.10.2026: "vercel adreside açık kalsın kapatmayalım. mevcut durum devam etsin olmazmı?"): LİSANS ADRESİ DEĞİŞMEZ — DEFAULT_LICENSE_SERVICES ve güncelleyici aynen destek-ofis.vercel.app; izolasyon testi/windows.yml dokunulmaz; yalnız kullanıcıya GÖRÜNEN site adresi/bağlantı metinleri destekofis.net olur. İki adres de kalıcı açık. CANLI DENETİM (26.10.2026, kullanıcı ağ iznine destekofis.net ekledi): https://destekofis.net 200 (Vercel, geçerli sertifika, HSTS, başlık "Destek Ofis — Verinizi yükleyin, ofisiniz hazır"); destekofis.net/api/lisans/v1/check boş gövdeye 400 BAD_REQUEST (servis canlı); www bu ortamın izninde yok (denetlenemedi; Vercel 308 → ana adres).
- 2.4.7 KAPSAMI — EDM İŞ ORTAKLIĞI (kullanıcı, 26.10.2026; toparlandı: "tamam konuyu toparlayalım ve 2.4.7 işine ekleyelim"; önce "şimdi değil 2.4.7 ye" — başlatılan ajan durduruldu, değişiklik yok). EDM yanıtı: müşteri kontörü EDM'den son kullanıcı fiyatıyla alır; kullanılan her kontör için ay sonunda %30 hak ediş; hesap YALNIZ istekteki APPLICATION_NAME ile (KULLANIM BAZLI) → 'destekofis30'. MADDELER [XH]: (A1) server/lib/einvoice/edm.mjs:48 APP + header() (~311; Login, CheckUser, Send/Load/Status/Cancel/Get/Mark Invoice, Send/Status/Cancel/Get SMM hepsi aynı başlık) → APPLICATION_NAME her istekte 'destekofis30' (adlı sabit), CHANNEL_NAME 'DestekOfis' kalır; (A2) her işlem türünde destekofis30 denetleyen test, eski kodda kırmızı (ayrı kopya); (A3) kullanıcıyla test faturası (EDM'nin verdiği test hesabı 'destekofis'; adresler programdakiyle AYNI, parola hiçbir dosyaya yazılmaz) → ÖNCE EDM portalına bakılır; destekofis30/uygulama adı görünüyorsa tamam, görünmüyorsa Alper Demir'e BİR KEZ sorulur (kullanıcı uyarısı: portal konuşuldu, Alper'e sormak ilk adım değil). (B1) sayaç: EDM'nin kabul ettiği gönderimler ay × tür (e-Fatura, e-Arşiv, e-SMM), append-only kayıt, aynı ETTN + ortam bir kez (yeniden deneme/11048/durum/iptal saymaz; 2.4.4 gönderim izi önce incelenir), test/canlı ayrı, geriye dönük doldurma YOK (hak ediş 2.4.7 ile başlar), şirketler toplanır; (B2) license.mjs /v1/check gövdesine `usage`: son 3 ayın TOPLAM sayıları — belge içeriği/alıcı/tutar/VKN/ETTN GİTMEZ; ders 30 izolasyonu korunur. (C1) site deposu supabase/lisans.sql: lisans.edoc_usage (makine+ay+ortam), check işlevinde doğrulamalı üzerine yazma, geçersiz veri lisans yanıtını bozmaz; (C2) Operatör Merkezi 'e-Belge Kullanımı' (ofis × ay; e-Fatura / e-Arşiv / e-SMM / Toplam; alt TOPLAM; varsayılan Canlı) → ay sonu EDM raporuyla karşılaştırma; (C3) canlı Supabase'e SQL yalnız kullanıcı onayıyla, yayın günü. (D1) site web/kvkk.html (KVKK Aydınlatma Metni; ayrı lisans sözleşmesi YOK) lisans doğrulaması satırına 'gönderilen e-Belge adetleri (ay ve tür bazında sayı; içerik gönderilmez)' — metni Claude yazar, kullanıcı onaylar; aynı sayfadaki destekofis@proton.me → destek@destekofis.net (e-posta kapsamı). Tahmin ~1 gün. KULLANICININ İŞİ (kod dışı): EDM'ye yazılı sorular (aylık müşteri bazında rapor/panel var mı, kontör nasıl sayılır — belge başına mı, reddedilen/iptal sayılır mı), yazılı iş ortaklığı sözleşmesi (münhasırlık şartına dikkat), hak ediş faturası kullanıcının KENDİ canlı e-Fatura hesabından (test hesabı değil; mali müşavire sorulur). KÖR NOKTALAR (verildi): eski sürümler 'DestekOfis' gönderir → güncellemeye dek hak ediş yok; EDM portalından (e-Fatura Portalı düğmesi dahil) kesilen belge sayılmaz.
- (Arşiv 29.10) 30 dk ara rapor + UD başlayınca yarım saatte bir kontrol (24.10 isteği) her sürümde geçerli (RAPOR DÜZENİ).
- (Arşiv 29.10) 2.4.5'te kapananlar: FIFO bilgi notu (24.10 "a"), H1 pil kartı / H2 telefon hücresi, M1 Tabela Adı, M2 Ayrıntılı Cari Ekstre; M3 Maliyet Hesap Kartı 2.4.6'da (yalnız Duşakabin Üretimi sektöründe; Excel'deki gibi AYNEN). Tam metin arşivde.
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
- ARŞİV (22.10.2026, GÖZDEN GEÇİRME 3 "kısa tutulur"): 2.4.4 sürerken kapanan 22 madde (BAŞLA kontrol listesi; e-SMM YANITI / BELGELERİ; 2.4.3 YAYIMLANDI; 19.10
  kapsam KARARI ve 21.10 KARARLAR (1)–(6); KULLANICI SORUNU; MÜŞTERİ İSTEKLERİ 1–3; demo sorusu; Personel Özlük isteği ve kararları; 22.10 SORU/KARAR'ları — ileri tarihli
  ayrılış, belirsiz gönderimde iptal, 5a–5c, 22a, UX18, e-SMM numaraları, EDM portalı/karekod + EDM yanıtı, F3, kâğıt makbuz / fiş numarası / XSD, kaşe-logo, kurum
  e-SMM'si; EK BULGULAR 25–29) `docs/GECMIS-KARARLAR.md` "Arşiv 22.10.2026"ya AYNEN taşındı; özetleri "Kalıcı ürün kararları" → "2.4.4 kararları".
- MÜŞTERİ İSTEĞİ (13.10.2026, emlakçı): kayıt detay kartından "WhatsApp'tan Paylaş" (resimler + bilgiler) — BEKLER (kullanıcı: "şimdilik kalsın"). Alıcı
  numarası karttan GELMEZ; API'siz yollar (Windows Paylaş / wa.me / tek "Portföy Sunumu" dosyası) ve Yol B (Meta API, Pro) ayrıntısı arşivde (21.10).
- DEVİR MODÜLÜ (sürüm 2.5.0, 2.4.4'ten SONRA): YÖNTEM KARARI Wolvox (kesim tarihinde ikiye ayır; eski yıl salt okunur arşiv); TEK BAŞINA YETERLİ plan
  `docs/devir/DEVIR-PLANI.md` (§11 kararları verildi, 20.10.2026); arka plan `docs/devir/DEVIR-MODULU.md`; ilk adım D0 (planı koda karşı yeniden doğrula). KÂHİN ÖNCE (kullanıcı, 23.10.2026 ~13:10 UTC: "önerin uygun" — cari kâhininin başarısı üzerine): devir kâhini D0'da, kod yazılmadan, planın kendisinden (kodu görmeyen ayrı ajan) kurulur; her D adımı ona karşı geliştirilir (plan D0 satırı).
  SIRA (kullanıcı, 24.10.2026: "devir modülünü bu işlerden sonra aralık ayında yaparız"): 2.4.5 → Maliyet Hesap Kartı sürümü → devir 2.5.0 Aralık'ta. Baş mimar uyarısı verildi: plan ~4–6 iş günü; en geç 1 Aralık'ta başla, ~20 Aralık'ta yayında. Hatırlatıcı trig_01DE8bFDurzMRT6thbptBrQM 23.11.2026 09:00 TR'ye alındı (istem güncellendi).
  HATIRLATICI (kullanıcı, 21.10.2026: "kapat ama ileride bana hatırlat"): eski 22.10 hatırlatıcısı (trig_01NEGfcTp7hAnHG1tgw6mFAv, eski oturuma bağlı, istemi
  eskimişti) KAPATILDI; yenisi 29.10.2026 09:00 TR (trig_01DE8bFDurzMRT6thbptBrQM, oturum session_01JyhFmK2mfqMV3KTwvTZdhs). O oturum kapanmışsa: 2.4.4
  bitince kullanıcıya devri hatırlat (devir Ocak–Şubat'ta kullanılır → 2.5.0 Aralık başına kadar yayında olmalı).
- ERP YOL HARİTASI (kullanıcı, 21.10.2026: "ilerleyen dönemlerde kademeli olarak bunları yapalım, ERP yol haritası olarak bir dosya yap, adım adım gideriz"):
  `docs/erp/ERP-YOL-HARITASI.md` — YALNIZ PLAN, kod değişmez; 2.5.0'dan SONRA, her adım ayrı sürüm, kullanıcı "başla" deyince, D0 ile. Açık kararlar belgenin
  "Kullanıcı kararları" bölümünde (sıra, Pro'ya özel mi, resmî defter kapsamı, döviz). KARARLAR (kullanıcı, 21.10.2026): hedef müşteri HERKES (ERP
  modülleri şirket bazında açılıp kapanır); şirket sınırı şimdilik 2 kalır, müşteri geri dönüşüne göre yeniden karar verilir.
- TESLİM BİÇİMİ (kullanıcı, 15.10.2026 ~20:20 UTC, 2.3.0 için teyit): GitHub'a yüklenecek İMZALI 5 dosya AYRI AYRI verilir; birleştirmeleri (PR → master) ben yaparım, dosyaları kullanıcı yükler. Kurulum .exe 30 MB'ı aşarsa İKİ PARÇA (parca0 + parca1) + BİRLEŞTİRME KOMUT DOSYASI `BIRLESTIR.bat` verilir (kullanıcı, 24.10.2026: "2 parça halinde veriyordun ve birleştir.bat komut dosyası ile beraber ver"; çift tıkla: copy /b ile birleştirir, certutil ile sha256'yı beklenenle karşılaştırır, sonucu Türkçe yazar; parçalarla aynı klasörde çalışır; eski BIRLESTIR.md düzeninin yerine).
- AÇIK (15.10.2026 21:58 UTC): CI #742 aed598e Windows Node 24 guncelleme-gercek S2 kırmızı (PR koşusu #743 aynı commit yeşil). Mekanizma: testin etkinlik pingi bir önceki isteği bekliyordu, takılan tek istek 4 sn boşluk açtı, sunucu haklı olarak kurdu (ürün doğru). Düzeltme test yardımcısında (zamanlayıcılı + zaman aşımlı pingler + istatistik; zorla üretme GUNCELLEME_S2_ZORLA_BOSLUK=1). İsteğin CI'de neden takıldığı (ağ/yük/ürün) yeni tanılamayla bir sonraki görülüşte okunur; ders 18 gereği Windows'ta iki yeşil koşu görülmeden kapanmaz.
- FİYAT (kullanıcı, 16.10.2026; soru "yıllık 15 bin öder mi?" → değerlendirme verildi; Wolvox Standart 50 bin TL tek seferlik): KARAR "SINIRSIZ 40 bin TL";
  devir, döviz, mobilden uzaktan bağlanma ve WhatsApp otomatik toplu gönderim yapıldıkça dahil. Baş mimar uyarıları verildi: "sınırsız"ın sözleşmede tanımı
  (süre / kullanıcı / güncelleme); tek seferlikte sürekli giderler (mevzuat güncellemesi, destek, uzaktan bağlanma sunucusu, WhatsApp Meta mesaj ücreti, EDM
  kontörü müşteride); gelecek özellik vaadi yazılı taahhüt olmaz. Lisans altyapısı süresiz lisansı destekliyor (license-token expiresAt null). KARAR BEKLENİYOR:
  güncelleme/destek süresi ve WhatsApp/uzaktan bağlanma giderlerinin kime ait olduğu.
  FİKİR (kullanıcı, aynı gün; "bunlar sadece fikir şimdilik"): Pro yerine TEK PAKET (bütün özellikler); WhatsApp kontörünü müşteri öder; uzaktan bağlanma için
  Tailscale benzeri çözüm (net değil); ömür boyu kullanım, güncelleme yalnız ZORUNLU hallerde ve 2 YILLA sınırlı. Karar değil — uygulanmaz, kod değişmez.
- YÖN KARARI (23.10.2026; tam metin Arşiv 29.10): para kaydı/borç/açılış bakiyesi tablo sezgisinden doğmaz; Excel/Sheets yalnız açık eşlemeli + onaylı tek seferlik içe aktarma, tablo ajanda/rehber. Kapı kapatma 2.4.5'te YAPILDI; tam koparma ayrı sürüm (2.6.0 önerisi) — plan docs/erp/TABLO-PARA-KOPARMA-PLANI.md.
- YAPILMAZ (19.10.2026): kontörlü "Tüm Bilgileri Getir" (Mükellef Sorgula yalnız CheckUser); müşteri talebi gelirse yeniden. Ayrıntı arşivde (21.10).
- MEVZUAT KARARI (kullanıcı, 20.10.2026): e-Fatura / e-Arşiv kutu metinleri DEĞİŞMEZ, 2.4.4'te değil; geri bildirim gelirse netleştirilir. 509 VUK GT okuma
  notları (IV.2.2, IV.2.4.1, V.1 kayıt yöntemi) arşivde (21.10).