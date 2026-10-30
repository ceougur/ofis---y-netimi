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

- 2.4.7 kararları (26–30.10.2026; tam metin `docs/GECMIS-KARARLAR.md` "Arşiv 30.10.2026"): MOBİL herkese (Pro kilidi yok), aynı program/kurulum/güncelleme; yöntem Eylül yolu (şifreli özet R2 + Worker kapıcı + Yönetim → Mobil Cihazlar'da karekodlu eşleme, müşteri başına elle iş yok) + sunucu açıkken canlı bağlantı (Cloudflare Tunnel, program kapıcı üzerinden kendiliğinden açar; cloudflared kuruluma konmaz, Cloudflare Access yok); program başına (iki şirket birlikte) en çok 3 EŞLİ UZAK CİHAZ (telefon/tablet/uzak tarayıcı; programda + kapıcıda, lisansta sayı alanı, varsayılan 3); kapıcıda makine → tek ofis, "son kaydolan kazanır"; deneme/lisans bitince mobil HEMEN kapanır (30 gün hoşgörü sonraki sürüm); telefondan tahsilatta carinin açık taksit kartı varsa Tahsilat Yeri BOŞ gelir (D7); mobil Kasa yanıtı yalnız bakiye/toplamlar; özet en çok 15 dk'da bir, günde 40, güvenlik değişikliği hemen. EDM: her istekte APPLICATION_NAME 'destekofis30' (CHANNEL_NAME 'DestekOfis'); e-Belge sayacı S1–S5 (gönderim ayı, şirket başına, kendi ETTN'li 11048 kesinleşme, sayaç şirket dosyası dışında, son 3 ay lisans kontrolüne yalnız sayı). Görünen destek e-postası destek@destekofis.net, görünen site destekofis.net; LİSANS ADRESİ destek-ofis.vercel.app DEĞİŞMEZ (iki adres kalıcı açık). SÜREÇ (2.4.7'de konuldu, sürer): DÜŞÜK bulgu sonraki sürüme (kuşkuda "müşteriye sorun" sayılır; kullanıcı isterse istisna), kapsam büyütülmez; UD + windows.yml ×2 aynı commit'te paralel, ürün kodu değişirse UD yeniden; büyük veride mobil özet ölçümü (docs/kanit/2026-10-29/mobil-ozet-olcum) her mobil değişikliğinde yinelenir.

## Açık iş (yalnız güncel; kapanan sürümler `docs/GECMIS-KARARLAR.md`)
- 2.4.8 BAŞLADI (kullanıcı, 30.10.2026 ~12:00 UTC: "hazırsak başlayalım"): iş listesi `docs/2.4.8-IS-LISTESI.md` (0a yapıldı; P0 plan yeniden yazımı ajan high, MZ ajan xhigh paralel); 30 dk rapor oturum görevi c13458ff ("7,37 * * * *"; 7 günde biter, 2.4.8 bitince silinir). Devreden 2.4.7 "SONRAKİ SÜRÜME" maddeleri bu sürümde DEĞİL (iş listesi "Kapsam dışı").
  P0+0b YAPILDI (6151d4e3, plan Meta'ya göre). DÜZELTME (Meta fiyat sayfası, ana oturum okudu): 01.10.2026'dan beri müşteri hizmeti penceresindeki utility de ÜCRETLİ (yalnız reklamdan gelen sohbetin FEP penceresi ve service ücretsiz) — aşağıdaki "son 24 saatte yazdıysa utility ÜCRETSİZ" notu ESKİDİ. KÖR NOKTA: Meta "yalnız izin vermiş (opt-in) kişiye gönder" der; ürün kararı opt-out (bir kez onay + "WhatsApp Mesajı İstemiyor") → BİLİNEN RİSK, kullanıcıya hatırlatıldı. SORULDU (plan §11, 30.10 ~12:15 UTC, 5 dk yetkisi): S1 durum kancası kapıcıdan geçsin mi (öneri A), S2 teslim süresi 3 gün (öneri A), S3 PDF teslimden sonra Meta'dan silinsin (öneri A), S4 bağlama sayfası kapıcıda (öneri A).
- SIKIŞTIRMA ÖNCESİ DURUM 6 (30.10.2026 ~15:00 UTC; kullanıcı: "sohbet sıkıştırma için hazırlık yap"). WHATSAPP KONUSUNUN SON HÂLİ (ayrıntı aşağıdaki "KARAR → 2.4.8" maddesinde):
  VERİMOR BIRAKILDI (her müşteriye telekom aboneliği/imza sirküleri; satış iş ortaklığına yanıt vermedi). YÖN: Meta WhatsApp Cloud API, ENTEGRATÖRSÜZ. 2.4.8'de İKİ BAĞLANMA YOLU, ikisi de AÇIK,
  gönderim çekirdeği tek: (1) "Elle Bağla" = müşterinin kendi Meta uygulaması + kalıcı System User belirteci + Phone Number ID + WABA ID (vergi kaydı/Meta onayı gerekmez; şart: telefonda
  WhatsApp'ta KAYITLI OLMAYAN numara, ör. sabit hat; 24 saatte 250 kişi); (2) "WhatsApp'ı Bağla" = Embedded Signup + birlikte kullanım (müşterinin telefondaki WA Business numarası) —
  yalnız DestekOfis TECH PROVIDER olunca çalışır (vergi kaydı → Meta işletme doğrulaması → App Review); kodu 2.4.8'de yazılır, çalışmayana dek düğme yine görünür (kullanıcı kararı).
  KESİN BİLGİLER: TR utility 0,0009 USD/teslim ileti (Meta tarife 01.10.2026), marketing 0,0109; 250 → doğrulamayla 2.000 → otomatik; uygulama adında "WhatsApp" yasak; Chrome çevirisi Meta
  panelini bozuyor (İngilizce kullan); sanal numara doğrulanmamış portföyde #2494070 ile reddedildi; birlikte kullanım yalnız Tech Provider/Solution Partner; durum web kancası yalnız
  yayımlanmış uygulamada; direct developer'da "No requirements" (App Review yok). KULLANICININ META HESABI: portföy "Destekofis", uygulama "DestekOfis Mesaj" (App ID 1505264761663625),
  Step 1 test numarası +1 555 209 3765 ile telefona mesaj GELDİ; gerçek numara/kart/System User DENENMEDİ. SADECE BİLGİLENDİRME ŞABLONLARI (kampanya yok), Aydınlatma Metni Hazırla,
  onay kutusu zorunlu, ekstre şablonuna KVKK alt satırı kararları SÜRER (Verimor'dan bağımsız). BELGELER: araştırma docs/erp/WHATSAPP-ENTEGRATOR-ARASTIRMA.md (tarife + birlikte kullanım ekleri);
  eski Verimor planı docs/erp/WHATSAPP-API-PLANI-2.4.8.md (başında "YERİNE GEÇTİ" notu; Meta'ya göre YENİDEN YAZILACAK); kullanıcıya Claude Docs: "Meta WhatsApp Kurulum Rehberi"
  (adım listesi) + "DestekOfis WhatsApp Gönderimi — Kullanıcı Bilgilendirmesi" (Verimor ifadeleri Meta'ya göre güncellenecek). 2.4.8 KAPSAMI: MZ yıl düzeltmesi (İLK, Aralık'tan önce) + WhatsApp
  (iki yol) + mobil adaylar (tünel durum göstergesi sınaması, cloudflared günlük dosyası, kapıcı Türkçe hata sayfası). "BAŞLA" BEKLENİYOR → 0a iş listesi + plan yeniden yazımı + 30 dk rapor.
  KULLANICININ İŞLERİ: vergi kaydı (lisans satışı/EDM hak edişi/Tech Provider için; kayıt türü mali müşavirle, meslek etkisi kullanıcıda); EDM iş ortaklığı sözleşmesi; lisans sözleşmesine
  veri işleme maddesi (kapıcıdan geçen PDF/durum verisi); dolu şirkette telefon ↔ masaüstü sayı karşılaştırması.
- SIKIŞTIRMA ÖNCESİ DURUM 5 (30.10.2026 ~07:10 UTC; kullanıcı: "sohbeti sıkıştırma hazırlığı yap konular karışmasın"). KONULAR AYRI:
  (A) 2.4.7 KAPANDI (yayın + site + release.yml #40 4/4 + CI #924 7/7; ayrıntı aşağıda DURUM 4). CANLI: gerçek telefon + tünel eşleme uçtan uca ÇALIŞTI (aşağıda KULLANICI BULGUSU);
      Cloudflare'a joker `*.destekofis.net` AAAA 100:: proxied eklendi (kullanıcı onayı). AÇIK: dolu şirkette telefon ↔ masaüstü sayı karşılaştırması kullanıcıda.
  (B) EDM İŞ ORTAKLIĞI DOĞRULANDI (30.10.2026 10:07 TR, EDM İş Geliştirme Alper Demir, e-posta "APPLICATION_NAME"): "Belgenin test ortamında 'destekofis30' olarak gittiği
      görünmektedir. Herhangi bir sorun bulunmamaktadır." → 2.4.7 E1/E2 (her istekte APPLICATION_NAME destekofis30) EDM tarafında teyitli; KULLANICININ İŞİ kalan: iş ortaklığı
      sözleşmesi / hak ediş.
  (C) 2.4.8 = WhatsApp otomatik gönderim (Verimor API) + mutabakat motoru yıl düzeltmesi (MZ) + 2.4.7 canlı bulgularından 2.4.8 ADAYLARI (tünel durum göstergesi sınaması,
      cloudflared günlük dosyası, kapıcı Türkçe hata sayfası). Plan `docs/erp/WHATSAPP-API-PLANI-2.4.8.md` (kararlar §11 sonu: herkese, sıfır sürtünme, 2 sabit şablon
      Verimor'a e-postayla, programda kopyala yok, müşteri yalnız API anahtarı → seç → gönder). Verimor: satış ilk yanıtta SMS müşterisi sandı; kullanıcı iş ortaklığı/entegrasyon
      ekibine netleştirme e-postası gönderiyor; sonra "Ücretsiz Başla" ile kendi Verimor hesabı DEĞERLENDİRİLECEK. "başla" BEKLENİYOR.
  (D) Ağ: docs.verimor.com.tr + verimor.com.tr izinli (www./wapi. değil). Cloudflare API belirteci DNS okuma/yazma yapabiliyor, tünel okuyamıyor (1001).
- KARAR → 2.4.8 (kullanıcı, 30.10.2026 ~10:30 UTC: "kampanya mesajı göndermesini engelleyip sadece ekstre mesajı ile ekstre pdf göndermesini sağlayalım mı? … bana bir
  dökümanda verir misin, kullanıcılara iletebileyim"; baş mimar: UYGUN): WhatsApp API yolu YALNIZ 2 sabit bilgilendirme şablonu (ekstre + PDF, ödeme hatırlatma); kampanya/serbest
  metin YOK. Uyarı: İYS izni kalkar, KVKK (aydınlatma, md. 9 yurt dışı aktarım) kalkmaz. S4 onay metni "izin aldım" → "aydınlatma metnime ekledim". Plan §11 sonu. Kullanıcıya
  bilgilendirme belgesi verildi (Claude Docs "DestekOfis WhatsApp Gönderimi — Kullanıcı Bilgilendirmesi"). Verimor OİM abonelik başvurusu kullanıcıda sürüyor (Yetkili Bilgileri adımı).
  KARAR (~10:45 UTC, "1"): programda "Aydınlatma Metni Hazırla" (firma bilgileriyle hazır KVKK metni, PDF/metin; taslak baş mimar, son onay kullanıcı); GÜNCELLEME ("hepsine evet"): onay
  kutusu işaretlenmeden toplu gönderim BAŞLAMAZ + ekstre şablonuna alt satır "KVKK aydınlatma metni için firmamıza başvurabilirsiniz." (Verimor'a giden şablon metnine eklenir). Kullanıcı netleştirme e-postasını şablonlarla ZATEN göndermişti → alt satır için Verimor'a kısa düzeltme e-postası hazırlandı (kullanıcı gönderir). VERİMOR 2. YANIT (30.10 11:05 TR, Nilgün Gönül, netleştirme + şablon düzeltmesinden sonra): yine yalnız "0850/coğrafi numarayla oim.verimor.com.tr/abonelik-basvurusu'ndan şirket yetkilisi + şirket bilgileriyle online abonelik" — iş ortaklığı/şablon sorularına yanıt YOK; kullanıcı: "bu firma saçmalıyor", "proje içime sinmedi, yasal mevzuat / e-imza işlerini ben de müşteri de sevmez". BAŞ MİMAR ÖNERİSİ (karar BEKLİYOR): 2.4.8'i böl — API'siz hızlandırma (toplu ekstre PDF + hızlandırılmış wa.me akışı + MZ + tünel adayları) şimdi; Verimor/BSP otomatik gönderim yalnız bir sağlayıcı kurulumu yazılı üstlenirse, seçmeli. PDF'i kapıcı R2 yerine müşterinin kendi tüneli üzerinden verme seçeneği (DestekOfis veri saklamaz) plana not. DÜZELTME (kullanıcı ~11:35 UTC: "tek tıkla toplu pdf'i ve hızlandırılmış whatsapp akışını apisiz nasıl yapacaksın, önce yapamıyorduk bu yola girdik"): HAKLI — "Otomatik Sıra" + kişi adıyla PDF indirme zaten var (client/assets/hof-whatsapp.js); API'siz üst sınır bu (+ PDF'i bağlantı olarak mesajda), bölme önerisi GERİ ÇEKİLDİ. İSTEK (kullanıcı ~11:40 UTC: "farklı bir entegratörle beraber araştır"): Meta Embedded Signup / Tech Provider + Verimor dışı entegratörler (BSP) araştırılıyor (ajan, high); rapor docs/erp/'ye. ARAŞTIRMA BİTTİ (30.10 ~12:30 UTC; kullanıcı alan adlarını izne ekledi; rapor docs/erp/WHATSAPP-ENTEGRATOR-ARASTIRMA.md, ham sayfalar not defterinde): ÖNERİ Meta'ya doğrudan Tech Provider + Embedded Signup + Cloud API — müşteri telekom aboneliği/imza sirküleri YOK (numara SMS/ses kodu, Coexistence var), aylık sabit/ek ücret YOK (yalnız Meta ücreti, müşterinin kartı; TRY yok), PDF Meta'ya yüklenir (kapıcıda saklama gereği kalkabilir), durum webhook'u VAR; DestekOfis'in bir kerelik işi: işletme doğrulaması + App Review + destekofis.net bağlanma sayfası + kapıcıda kod→token ucu; başlangıçta 7 günde 10 yeni müşteri (doğrulamalarla 200). Entegratör yolu Tech Provider'ı kaldırmıyor (Infobip: 30.06.2025'ten beri zorunlu). 360dialog numara başına 49 EUR/ay, Twilio ileti başına +0,005 USD, Netgsm yalnız OTP, Connexease 179–999 USD/ay. Ana oturum ham sayfadan doğruladı: Infobip Tech Provider tarihi, Meta 200/7 gün, belge mesajında medya kimliği, Twilio 0,005. KARAR BEKLİYOR. META BELGELERİ (kullanıcı sordu; Meta yardım sayfalarından okundu 30.10): işletme doğrulaması (resmî ad, adres, telefon, e-posta, site; bağ doğrulaması e-posta/telefon/alan adı DNS) + gerekirse belge (kuruluş/ticaret sicil/faaliyet belgesi, devlet vergi belgesi = vergi levhası, işletme banka dökümü; fatura yalnız adres/telefon); App Review (simge, gizlilik politikası, kategori, 2 video). KULLANICI (30.10 ~12:50 UTC): "vergi kaydımız henüz yok" → Tech Provider ve müşteri bağlama İŞLETME DOĞRULAMASINDAN SONRA; BAŞ MİMAR UYARISI verildi: vergi kaydı yalnız WhatsApp için değil, lisans satışı/fatura ve EDM iş ortaklığı hak edişi için de gerekli; kayıt türü (şahıs / Ltd.) mali müşavirle; kullanıcının mesleği (sekmelerde UYAP Avukat) kayıt türünü etkileyebilir — kullanıcı değerlendirir. Meta deneme ortamında (doğrulamasız, test numarası) geliştirme mümkün — Meta belgesinden doğrulanacak. 2.4.8 kapsam kararı BEKLİYOR. SORU (kullanıcı ~13:00 UTC: "müşteriler kendi vergi kaydı ile kullanamaz mı? ben programa apiyi bağlamak için vergi kaydı açtırmak zorunda mıyım?") → YANIT: ZORUNLU DEĞİL — Meta "direct developer" modeli (meta-tokens.md: "only you or your business accesses your own data" → System User token): her müşteri KENDİ Meta uygulaması + WABA + kalıcı System User belirteci, programa belirteç + WABA kimliği girilir; şablonları program API ile kendisi açar; durum webhook'u müşterinin uygulamasında müşterinin tüneline; Tech Provider/App Review YOK; kurulum ~20–30 dk, DestekOfis bir kez uzaktan destek. RİSK: Meta'nın ISV'lere Tech Provider şartı bu modeli kapsar mı belirsiz (DestekOfis müşteri verisine erişmiyor — direct developer tanımına uyuyor); büyüyünce Tech Provider'a geçiş yolu açık. Vergi kaydı lisans satışı/EDM için yine gerekli. KARAR BEKLİYOR. FİYAT SORUSU (kullanıcı ~13:20 UTC: "her gönderi fiyatını netleştirmemiz lazım, müşteri ilk bunu sorar"): Meta belgesi (meta-pricing.md, 01.10.2026 tarifesi): ileti başına, kategori × pazar; Türkiye ADLI pazar; utility 01.04.2026'da DÜŞÜRÜLDÜ; utility'de hacim kademesi var; müşteri son 24 saatte yazdıysa (müşteri hizmeti penceresi) utility ÜCRETSİZ; para birimi hesap açılışında seçilir, sonra değişmez, TRY yok. Rakam: Twilio sayfası (Eylül 2026) TR utility 0,000900 USD — Meta'nın kendi tarife CSV'si bu ortamdan alınamadı (developers.facebook.com HTML/CSV WebFetch'te çözülmüyor; tarayıcı kimliği taklidi izinle reddedildi — yapılmadı). Kullanıcıdan business.whatsapp.com/products/platform-pricing Türkiye utility satırının ekranı istendi. Uyarılar: kart kur/komisyon farkı; yurt dışı hizmette sorumlu sıfatıyla KDV (mali müşavir). Öneri: programda "bu ay gönderilen ileti sayısı" göstergesi (Meta faturasıyla karşılaştırma). FİYAT KESİNLEŞTİ (kullanıcı Meta'nın resmî tarife dosyalarını yükledi, 30.10 ~13:35 UTC; "Cost per message in USD … effective October 1, 2026"): TÜRKİYE — Utility 0,0009 USD/ileti, Marketing 0,0109, Authentication 0,0009, Service 0,0009; utility hacim kademesi AYLIK: 0–100.000 liste fiyatı, 100.001–1M −%5, 1M–4,5M −%10 … (KOBİ'de hep liste fiyatı). Ücret yalnız TESLİM edilen iletide. Twilio rakamı doğrulandı. Kaynak dosyalar not defteri meta-tarife/ (depoya alınmadı). GÜNLÜK SINIR (kullanıcı sordu): Meta kuralı, sağlayıcıdan bağımsız — portföy başına 24 saatte 250 FARKLI kişi (müşteri hizmeti penceresindekiler hariç); işletme doğrulaması YA DA 30 günde 2.000 kaliteli teslim → 2.000; sonra kendiliğinden 10K/100K/sınırsız (6 saatte). Program fazlasını ertesi güne kuyruklar (plan). KULLANICI (~13:50 UTC: "ben kendime vergi kayıtsız bir api alayım, kayıt olup hadi, hem öğrenmiş olurum"): kendi Facebook hesabıyla direct developer olarak Meta uygulaması açıyor (önce Meta'nın TEST numarası; belirteç sohbete/dosyaya YAZILMAZ). Adımlar ekran ekran yönlendiriliyor. İLERLEME (30.10 ~13:55 UTC): developers.facebook.com geliştirici kaydı → uygulama "DestekOfis Mesaj" (ad "WhatsApp" içeremez — Meta reddi; müşteri rehberi: "<Firma> Mesaj") → kullanım alanı yalnız "WhatsApp üzerinden müşterilerinizle bağlantı kurun" → portföy Destekofis → GEREKSİNİM EKRANI "Belirlenmiş herhangi bir gereksinim yok" (direct developer'da App Review/işletme doğrulaması İSTENMİYOR — doğrulandı) → Meta yolu: Adım 1 Deneyin / Adım 2 Üretim kurulumu (numara, ücretli hesap, ödeme yöntemi, Sistem Kullanıcısı, web kancası) / Adım 3 İşletme doğrulaması (isteğe bağlı) → Adım 1 test numarası + geçici belirteç + alıcı → "Order Confirmation" mesajı kullanıcının telefonuna GELDİ (uçtan uca ilk gönderim). Not: Chrome Türkçe çevirisi Meta panelinde düğmeleri bozuyor → rehberde "sayfayı İngilizce kullanın"; belirteç sağdaki curl kutusunda da görünüyor (rehberde ikisini de karart uyarısı; bu seferki 24 saatlik deneme belirteci kısmen göründü, risk düşük). Sıra: Adım 2, numara seçimi kullanıcıda. KULLANICI "b" (WhatsApp Business uygulamasındaki numarayla birlikte kullanım) → ENGEL BULUNDU (meta-coex.md "Requirements": birlikte kullanım YALNIZ Embedded Signup ile ve "You must already be a Solution Partner or Tech Provider"; WA Business ≥2.24.17; 20 mps): DIRECT DEVELOPER modelinde birlikte kullanım YOK → müşteri ya WhatsApp'ta kullanılmayan ayrı numara (yeni hat/sabit hat, sesli kod) ya da mevcut numarasını uygulamadan silip API'ye taşır (uygulamada kullanamaz). Baş mimarın önceki "müşterilerin çoğu birlikte kullanımı seçer" sözü bu modelde YANLIŞ — kullanıcıya düzeltildi. STRATEJİK SONUÇ: birlikte kullanım için DestekOfis'in Tech Provider olması (vergi kaydı + işletme doğrulaması + App Review) gerekir. KULLANICI (~14:10 UTC: "yok böyle boşta bir numara, müşteride de olmaz belki. bu yol olmaz"): DIRECT DEVELOPER YOLU REDDEDİLDİ (ayrı numara şartı). BAŞ MİMAR ÖNERİSİ (karar BEKLİYOR): doğru ürün = Tech Provider + Embedded Signup + birlikte kullanım (müşteri mevcut WA Business numarası, Facebook girişiyle birkaç tık) → ön koşul VERGİ KAYDI (lisans satışı/EDM için de gerekli); sıra: 2.4.8 WhatsApp'sız (MZ yıl düzeltmesi Aralık'tan önce + tünel adayları) → vergi kaydı → Meta işletme doğrulaması + Tech Provider + App Review (mevcut "DestekOfis Mesaj" uygulaması kullanılır, boşa gitmedi) → WhatsApp 2.4.9; gönderim kodu bu arada test numarasıyla geliştirilebilir (Cloud API çağrıları aynı). SANAL NUMARA DENEMESİ (30.10 ~14:13 UTC; Adım 2 "Bunun yerine sanal numara içeren bir görünen ad kullanın"): Meta "işletme adı + görünen ad incelemesi, 5 iş gününe kadar" dedi; yeni WABA formunda WEB SİTESİ ZORUNLU alan; destekofis.net girilince HATA #2494070 "Hesap Kurulumu tamamlanamıyor: İşletmeniz WhatsApp'ın ilke gerekliliklerini karşılamadığı için…" → doğrulanmamış (vergi kaydı yok) portföyde sanal numara AÇILMADI (kesin neden Meta'dan okunamadı; olası: işletme doğrulaması yok). Kullanıcı: "müşterinin illa web sitesi mi olacak? duvara tosladık". SONUÇ: bütün yollar işletme doğrulamasına (vergi kaydı) çıkıyor. YÖN KARARI (kullanıcı ~14:30 UTC: "vergi kaydım olsa yapmaya çalıştığımız bu yol programımız ve müşteriler için en doğru yol sanırım (direkt Meta'dan, entegratörsüz)"; baş mimar: KATILIYOR): WhatsApp = DestekOfis Tech Provider + Embedded Signup + birlikte kullanım + Cloud API, entegratör YOK; vergi kaydını BEKLER. Baş mimar uyarıları: web kancası adresi uygulama düzeyinde TEK → durumlar kapıcıdan (Cloudflare) geçip müşterinin programına iletilir (DestekOfis kısa süreli veri işleyen → lisans sözleşmesine madde); uygulama gizli anahtarı yalnız kapıcıda; Meta sürüm takibi (Embedded Signup v2/v3 15.10.2026'da kalktı → v4/v5); ilk hafta 10 müşteri sınırı. Verimor planı (WHATSAPP-API-PLANI-2.4.8.md) bu yöne göre yeniden yazılacak. KARAR (kullanıcı ~14:40 UTC: "vergi kaydımı açmamı beklemeyelim. biz yapalım 2.4.8'i, vergi kaydını açınca ben yarım kalan işi tamamlarım. müşterilere de bu yolla api üretir bağlarız programa"; baş mimar: DOĞRU): 2.4.8'de WhatsApp Meta Cloud API ile YAPILIR, vergi kaydı beklenmez. ÖNERİLEN TASARIM (onay bekliyor): programda İKİ BAĞLANMA YOLU, gönderim çekirdeği tek — (1) "Elle Bağla": müşterinin kendi Meta uygulamasındaki kalıcı belirteç + numara kimliği (bugün çalışır; WhatsApp'ta kullanılmayan numara/sabit hat şartı; kurulumda DestekOfis desteği), (2) "WhatsApp'ı Bağla" (Embedded Signup, birlikte kullanım): kod + kapıcı uçları yazılır, Tech Provider onayına dek GİZLİ bayrak (esmmEnabled düzeni); vergi kaydı → Meta doğrulama + App Review → bayrak açılır (güncelleme). Geliştirme/test: kullanıcının "DestekOfis Mesaj" uygulaması + test numarası + sahte Meta sunucusu (testler gerçek Meta'ya gitmez). MZ (yıl düzeltmesi) 2.4.8'in İLK maddesi, WhatsApp'a bağlanmaz. KARAR (kullanıcı ~14:50 UTC: "sonradan iş çıkmasın 2 yol da açık kalsın. zaten 2. maddeyi istese de kullanamaz müşteri, ayrıca biz teknik destek vereceğiz"): İKİ YOL DA AÇIK (gizli bayrak YOK). Baş mimar uyarısı + öneri (onay bekliyor): çalışmayan görünür düğme destek araması üretir → "WhatsApp'ı Bağla" görünür, durumu KAPICIDAN okunur (Tech Provider hazır değilse "Bu bağlantı yakında; şimdilik Elle Bağla" der; hazır olunca kapıcıda açılır — program güncellemesi GEREKMEZ, "sonradan iş çıkmaz"). KARAR (kullanıcı ~15:00 UTC: "onu tıklayacak müşterim yok henüz, rahat ol. açık kalsın, iki iş olmasın"): kapıcı anahtarı/"yakında" yazısı YAPILMAZ; iki yol da düz açık. İSTEK: kullanıcıya Meta adımları hap rehberi → Claude Docs "Meta WhatsApp Kurulum Rehberi" verildi (Yol 1 adımları denendi/denenmedi işaretli, programa girilecek 3 bilgi, Yol 2 Tech Provider adımları, ücret/sınır tablosu). AÇIK (kullanıcının işi): kapıcıdaki 3 günlük şifreli PDF → DestekOfis veri işleyen + Cloudflare yurt dışı → lisans sözleşmesine veri işleme maddesi.
- İSTEK → 2.4.8 PLANI (kullanıcı, 30.10.2026 ~03:40 UTC: "sürekli ertelediğim ama müşterilerin talep ettiği whatsapp toplu gönderim işini planlayalım 2.4.8 için. mevcutta toplu gönderimde hep mesajı sırayla gönder gönder yapıyordu müşteri, ayrıca extre pdf ini hem tekli hem toplu olarak tekde gönderemiyordu. verimor sitesini kaydettim ortama. belge ve dökümanlarını incele apilerini vs kontrol et. planlamanı yap, 2.4.7 kontrolleri bitince ben başla dediğimde başlarsın."; ekte "EDM Modeli WhatsApp Entegrasyon Sunumu"): PLAN YAZILDI `docs/erp/WHATSAPP-API-PLANI-2.4.8.md` — EDM modeli (müşterinin kendi Verimor hesabı + API anahtarı) UYGUN; Verimor resmî belgesi (docs.verimor.com.tr, OpenAPI "Verimor WhatsApp API 1.0.0") ile sunum karşılaştırıldı: X-API-Key (Bearer değil), POST /v1/messages/utility + header_media {link, filename}, IP başına dakikada 60 istek (sorgular dahil), medya yükleme yok (herkese açık bağlantı), tekrar anahtarı yok, WhatsApp durum webhook'u yok (yoklama), pazarlama şablonu 403, Coexistence var. Kullanıcı 30.10: Verimor satışa e-posta attı (29.10 22:16; test ortamı/belge/webhook/SDK), docs.verimor.com.tr ortama eklendi; "meta business üyesi olmadan facebookla numara eşleştirince günlük 250" (Meta: doğrulanmamış işletme 24 saatte 250 farklı kişi — plana işlendi). KARAR (kullanıcı, 30.10.2026 ~04:05 UTC: "önerilerin uygun") S1–S5 önerildiği gibi (plan §11: herkese, PDF kapıcıda şifreli en çok 3 gün, mutabakat motoru düzeltmesi 2.4.8'e (MZ), "WhatsApp Mesajı İstemiyor" + bir kez izin onayı, PDF seçilen döneme uyar; toplu PDF + kısa ekstre metni EVET, hareket listesi PDF'te) + Verimor'a ek sorular (plan §10). KARAR (kullanıcı ~04:20 UTC): müşteri sürtünmesi SIFIR — Verimor şablonları kendiliğinden açmazsa DestekOfis BİR KEZ kurulum desteği verir; kurulumdan sonra seç → gönder, PDF/mesaj toplu kendiliğinden (plan §11 sonu). KARAR (~04:30 UTC): programda kopyala/şablon rehberi YOK; 2 sabit adlı şablon DestekOfis'ten Verimor'a e-postayla tanıtılır, Verimor her müşteri hesabında açar; müşteri yalnız API anahtarını girer, sonra seç → gönder (plan §11). VERİMOR YANITI (30.10 09:39 TR, satış uzmanı Nilgün Gönül): standart SMS abonelik bilgisi gönderildi, teknik/iş ortaklığı sorularına yanıt YOK (kullanıcıyı SMS müşterisi sanmışlar); kullanıcı iş ortaklığı/entegrasyon ekibine yönlendirme isteyen netleştirme e-postasını (hazırlanan şablon + soru metni ekli) gönderiyor; SONRA "Ücretsiz Başla" ile kendi Verimor hesabı açılması değerlendirilecek (ilk müşteri gözüyle kurulum + 2.4.8 gerçek gönderim denemesi). "başla" BEKLENİYOR (2.4.7 kontrolleri bitince); başlayınca 0a `docs/2.4.8-IS-LISTESI.md` + 30 dk rapor (RAPOR DÜZENİ).
- KULLANICI BULGUSU 2.4.7 CANLI (30.10.2026 ~05:57 UTC, video + ekran: "ben mi bir hata yapıyorum?"): telefonda karekod → Safari "sunucuyu bulamadığı için sayfayı açamıyor" (o5rxbrt4ejchw464e.destekofis.net, 08:53 TR, 4G); 08:57 TR masaüstü tarayıcıda aynı adres AÇILDI (Cihazı Eşleştir). KÖK NEDEN (Cloudflare DNS salt okuma): ofisin CNAME kaydı (→ tünel, proxied) 05:52 UTC açılmış; telefon ~1 dk sonra okuttu → operatör çözücüsü kayıt yokken sorup "yok" yanıtını önbelleğe almış olabilir (olumsuz önbellek); kullanıcı hatası DEĞİL. ÖNERİ (kullanıcı onayı bekler, canlı DNS): proxied joker `*.destekofis.net` AAAA 100:: — Worker rotası *.destekofis.net/* zaten var; ofis adı kayıttan önce de çözülür (özel CNAME jokerin önüne geçer), ilk okutmada ve tünel yokken de sayfa açılır. Program kodu değişmez. YAPILDI (kullanıcı ~06:05 UTC: "yap"): Cloudflare API ile `*.destekofis.net` AAAA 100:: proxied eklendi; öbür kayıtlar (kök A, www, kapi, m, ofis CNAME, MX/TXT) değişmedi. Bu ortamdan alt adlar ağ izninde yok → doğrulama kullanıcının tarayıcısında. DEVAM (09:04 TR, ekran): telefonda adres artık çözülüyor, kapıcı JSON "kapi-ofis-kapali" (503) döndü — kapıcı ofisin tüneline ulaşamadı (bulut/kapi/kapi.mjs vekil → fetchOrigin hata/530/502); masaüstünde sayfa "hâlâ açılıyor" (önbellek olabilir). Tünel durumu Cloudflare API'den okunamadı (belirteçte tünel okuma izni yok, 1001). Kullanıcıdan program Mobil Cihazlar canlı bağlantı durumu + masaüstünde Ctrl+F5 istendi. YAN BULGU (2.4.8 adayı): tarayıcıyla açılan sayfa yolunda kapıcı hata durumunda ham JSON gösteriyor; Türkçe HTML sayfa olmalı. DEVAM (09:14 TR, ekran): masaüstünde Ctrl+F5 ile ofis adresi ÇALIŞIYOR, aynı anda program Mobil Cihazlar "Uzaktan Bağlantı: Bağlanıyor — Bağlantı koptu; yeniden kuruluyor" diyor → DURUM GÖSTERGESİ YANLIŞ (koddan, server/lib/tunnel/manager.mjs onLine): bağlantı sayısı cloudflared çıktı satırlarından sayılıyor; tek kopuşta "Lost connection" + "Unregistered tunnel connection" + "Retrying connection" gibi birden çok satır her biri −1 sayılıyor → 4 bağlantıdan biri gidince sayaç 0 olabilir, tünel ayaktayken "koptu" görünür (yeni "Registered" satırına dek). 09:04 telefon kapi-ofis-kapali muhtemelen gerçek kısa kopuş. Ayrıca cloudflared çıktısı dosyaya yazılmıyor → müşteri makinesinde tanı yok. 2.4.8 ADAYI (ORTA): durum cloudflared metrik ucundan (/ready, readyConnections) okunsun; son N satır günlük dosyasına; kapıcı hata sayfası Türkçe HTML. SONUÇ (09:29–09:30 TR, ekranlar): yeni karekodla telefon (iPhone, 4G) EŞLENDİ ve Genel Bakış açıldı — Nakit Kasa 0, Banka 0, Cari 0, Stok 0; masaüstünde aynı şirket (002 deneme) Anlık Durum Kasa/Alacak/Borç 0 → tutarlı. Gerçek telefon + gerçek tünel uçtan uca İLK KEZ doğrulandı (2.4.7 DENENMEYEN maddesi kapandı; sayılı veriyle karşılaştırma dolu şirkette yapılmalı). 09:37 TR ekran: Uzaktan Bağlantı "Bağlı", 1/3 eşli cihaz (iPhone, son erişim 09:31), Bulut Özeti 09:29. Kullanıcı: "benim ortamımdaki internette sorun vardı biraz önce sanırım" → 09:04 kopukluğu ve "koptu" yazısı GERÇEK ağ kesintisiyle de açıklanır; sayaç kayması kuşkusu (manager.mjs onLine) DOĞRULANMADI, 2.4.8'de önce zorla üretilerek (ders 20) sınanır, sonra düzeltilir; günlük dosyası ve Türkçe hata sayfası her durumda yapılır.
- SIKIŞTIRMA ÖNCESİ DURUM 4 (30.10.2026 ~03:45 UTC; kullanıcı: "sohbeti sıkıştırma talimatı vereceğim, hazırlık yap"): 2.4.7 YAYIMLANDI ve SİTE CANLIDA. Yayın v2.4.7 (master 151b7119, PR #37 squash; kullanıcı 03:25 yayımladı): 5 dosya bayt bayt aynı, eski güncelleyiciler (2.4.6/2.4.5/2.4.4 gerçek kodu) canlıda available 2.4.7 + indirme + özet (docs/kanit/2026-10-30/247-yayin). Site PR ceougur/destekofis#24 kullanıcının "birleştir"iyle squash a053691e; destekofis.net'te rozet + #mobil + kılavuz PDF 36942a0d + webp 200 doğrulandı. 2.4.7 KAPANDI (30.10.2026 05:30 UTC): "Sürüm yayımla" release.yml #40 (run 40997263441, v2.4.7) 4/4 YEŞİL — Testler (npm test + 86 adım e2e/senaryo), Windows kurulum paketi derleme, Windows'ta kurulum/servis/güncelleme/kaldırma testi, Yayımla (04:54); kanıt commit'i b9da74d8 CI #924 7/7 YEŞİL. Çalışma dalı claude/compassionate-galileo-f9kghg master + belge/kanıt (master 6f6cc334 ile birleştirildi; force push otomatik izinde reddedildi). Teslim dosyaları not defterinde teslim-2.4.7/ + arsiv-2.4.7/ (kullanıcıya gönderildi). Tanıtım görseli docs/pazarlama/DestekOfis-Tanitim-Mobil.png artık paylaşılabilir. 2.4.7'nin bütün kapanan maddeleri docs/GECMIS-KARARLAR.md "Arşiv 30.10.2026"; kalıcı kararlar "Kalıcı ürün kararları" → "2.4.7 kararları". SONRAKİ SÜRÜM işleri: docs/2.4.7-IS-LISTESI.md "SONRAKİ SÜRÜME" + BİLİNEN SINIRLAR (teslim notu docs/kanit/2026-10-29/247-paket/TESLIM-NOTU-2.4.7.md) — özellikle mutabakat motoru yıl dönümü düzeltmesi Aralık başından önce (1 Ocak–30 Nisan yanlış kırmızı), lisans hoşgörüsü (aşağıda), Cloudflare limit kartı (aşağıda), içe aktarma istek kimliği, kapıcı temizlik yarışı. DEVİR 2.5.0 (aşağıda; hatırlatıcı trig_0144yLFe3Mqtv8rS1mQ3iGur 23.11.2026 09:00 TR). KULLANICININ İŞİ: EDM'ye yazılı sorular + iş ortaklığı sözleşmesi (destekofis30 hak edişi), elle kabul listesi (teslim notu).
- ERTELENDİ → SONRAKİ SÜRÜM (kullanıcı, 29.10.2026 ~13:05 UTC: "lisans hoşgörüsünü de sonraki sürüme bırak uygunsa?" — baş mimar: uygun; 2.4.7'de bugünkü güvenli davranış: ücretli lisans da bitişte mobili HEMEN kapatır, mesaj "Lisans geçerli değil; uzaktan erişim kapalı…") aşağıdaki karar ve uyarılar 2.4.7 kapsamından ÇIKTI; sonraki sürümde temizlik işiyle birlikte. — ESKİ: KARAR → 2.4.7 (kullanıcı, 29.10.2026 ~13:00 UTC: "lisanslı kullanıcının da lisansı bitince 1 ay boyunca lisansını yenilemezse kullanımı kapatılsın. mobil kullanım hakkının da sona erdiğini program uyarsın"; iki seçenekli soruya yanıt: "30 gün mobil hoşgörü" + "bitişten 7 gün önce + bitince"): ÜCRETLİ LİSANS (kind license, status active) bitince masaüstü bugünkü gibi salt okunur; MOBİL 30 GÜN daha çalışır — salt okunur görüntüleme (canlı + son özet; yazma programın salt okunur kuralıyla kapalı), her girişte uyarı; 30. günün sonunda kapanır (program + kapıcı + tünel aynı kuralla). Engellenen lisans ve DENEME hoşgörü ALMAZ (deneme bitişte hemen kapanır — önceki karar). UYARI: bitişe 7 gün kala Yönetim → Mobil Cihazlar + telefonda "lisans X gün sonra bitiyor" notu; hoşgörüde "Lisansınız bitti; mobil kullanım hakkınız N gün sonra sona erecek"; sonra "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin". Uygulama: kapıcı/B düzeltmeleri birleşince tek ajan (xhigh; lisans kapısı). Hoşgörü bitiminden 30 gün sonra mobil kaydın silinmesi → sonraki sürüm temizliğine (deneme kararıyla birlikte).
- İSTEK → SONRAKİ SÜRÜM (kullanıcı, 29.10.2026 ~12:05 UTC): Operatör Merkezi Altyapı limitlerine Cloudflare mobil limitleri kartı (Worker istek/gün, R2 depolama + işlem, tünel sayısı); ayrıntı docs/2.4.7-IS-LISTESI.md "SONRAKİ SÜRÜME". AYRICA 29.10: Cloudflare (R2 destekofis-ozet, Worker destekofis-kapi, kapi./m./*.destekofis.net, iki gizli), C3 canlı SQL ve site PR ceougur/destekofis#23 kullanıcı onayıyla CANLIDA (iş listesi "CLOUDFLARE KURULUMU").
- YETKİ YENİLENDİ (kullanıcı, 29.10.2026 ~03:10 UTC: "bana yönelttiğin bir soruya 5 dk içinde cevap vermezsem piyasada en yaygın şekilde uygulanan önerini yap"): 22.10 YETKİ maddesiyle aynı düzen — soru iletide öneriyle sorulur, 5 dk sonrasına kendine hatırlatma, yanıt yoksa en yaygın uygulama/öneri uygulanır ve "5 dk yetkisiyle uygulandı" diye iş listesine yazılır, kullanıcı dönünce özetlenir. SINIRLAR (değişmez): anayasanın kullanıcıya bıraktığı adımlar (PR → master "birleştir", yayın, canlı Supabase/DNS, müşteri/kimlik bilgisi) ve ders 43 (kâhin–program farkından SONRA para/kapama kuralı) bu yetkiye girmez, yanıt beklenir.
- ARŞİV (24.10.2026, 2.4.5 öncesi "kısa tutulur" + sıkıştırma hazırlığı): 2.4.4'te kapanan 14 madde (2.4.4 BAŞLADI, GÖZDEN GEÇİRME 6, KARAR REVİZYONU, DURMA KURALI, ADAY 20–22, DONDURMA [aday 23–25 + tam kapı], AÇIK CI #864, birleştirme KARARI, İSTEK 23.10, SON ADAY BAĞIMSIZ TURU, RAPOR DÜZENİ, HAZIRLIK 21.10) `docs/GECMIS-KARARLAR.md` "Arşiv 24.10.2026"ya AYNEN taşındı. Bunlardan süren KURALLAR: KARAR REVİZYONU (YÜKSEK/ORTA düzeltilir, DÜŞÜK sonraya + SAKINCA SÜZGECİ), DURMA KURALI, YETKİ (5 dk), RAPOR DÜZENİ (yeni sürümde "başla"da 30 dk rapor işi + iş listesi çizilir) — yeni sürümde de geçerli; ayrıntı arşivde. Uploads klasöründe imza anahtarı + EDM belgeleri durur (kapsayıcı yenilenince yeniden istenir).
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