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
- YENİ OTURUM / SIKIŞTIRMA SONRASI (21.10.2026): önce `docs/DURUM-VE-DEVAM.md` → "DEVİR NOTU (21.10.2026)" (2.4.4 kapsam tablosu, devir 2.5.0, kalan işler,
  anayasa/ders yerleri) ve `docs/2.4.4-IS-LISTESI.md` (36 madde, efor sınıflı, TAM liste) DOSYADAN okunur; özetten anlatılmaz. DAL: bütün güncel belgeler
  `claude/youthful-euler-fl8ks4` dalında (master'da yok); eski `claude/hopeful-goodall-6nmtcj` dalı ESKİ — oradan belge ALINMAZ (yenilerini ezer).
- 2.4.4 BAŞLADI (kullanıcı "başla", 22.10.2026 03:25 UTC); 30 dk rapor işi CronCreate 615db56b (kapsayıcı 04:36'da yeniden başladı, fc078609 silindi; 2.4.4 bitince
  silinir). GÜNCEL DURUM VE NASIL DEVAM: `docs/DURUM-VE-DEVAM.md` → "### 00. 2.4.4 SÜRÜYOR — DEVAM NOTU" (sıkıştırma sonrası ÖNCE o okunur). Çalışma düzeni: her iş
  grubu ayrı git worktree'de (/home/user/wt/<ad>, dal is/<ad>), ajan commit eder, ana oturum youthful-euler dalına birleştirir, testler + push + CI.
  DALGA 1 (22.10 ~03:35 UTC; ajan kuralları not defteri ajan-ortak.md — kapsayıcıyla gider): kucuk [M] 3,25,4 · test-altyapi [H] 6,27 · d2 [XH] 7 · esmm [XH]
  20,21 · sunucu [H] 28,29 · personel [H] 19. SONRAKİLER: kayit [XH] 5 (4'ten sonra) · fatura-ui [M] 9,10,13,14,UX16 · UI11 [H] 8 · UX9/UX10 [H] 11 · UX15 [XH] ·
  UX18 [XH] 15 · KÖ3 [H] 16 · E6 [XH] 17 · E7 [H] 18 · brüt [XH] 26 · esmm-2 [XH] 22,23 · esmm-3 [XH] 24 (gerçek EDM). Biten dalga birleştirilince iş listesinde üstü çizilir.
- GÖZDEN GEÇİRME 6 (kullanıcı, 23.10.2026 ~12:35 UTC: "anayasamızı ve derslerimize göz at"; GG5'ten beri): (1) DERS 5 → YENİ DERS 40: kâhin–program farkında beş kural netleştirmesi program davranışı görüldükten sonra verildi (gerekçeli; iş listesi "BAŞ MİMAR KARARLARI"nda kullanıcının gözden geçirmesine). (2) VERİMLİLİK "bir tur + bir kontrol turu": 31e turları 4–10 (7 tur) — kullanıcı kararı "B" (her bulgu) ve revizyonuyla bilerek aşıldı; döngü riski kullanıcıya soruldu → DURMA KURALI. (3) DERS 19: aday 17'de ci.yml commit'i `node --test … | grep … && git commit` ile denetim testi KIRMIZIYKEN atıldı (&& grep'in kodunu okudu); hemen fark edildi, release.yml eksiği eklendi, test 54/54 (aday dalı, gönderilmedi) → bundan sonra test çıktısı dosyaya, kod `rc=$?` ile ayrı. (4) KANIT/TESLİM: aday 15–20'nin sürüm notu cümleleri yalnız ajan raporlarında ve Açık iş'teydi → iş listesi "Teslim notları"na taşındı; eski bir BİLİNEN SINIR (Açılış Bakiyesi) düzeltildi. (5) KISA TUTULUR: CLAUDE.md 78,5 KB → kapanan 14 Açık iş maddesi (GG5, 31e DAR KONTROL/KONTROL TURU 2, ADAY 13–19, İSTEK, eski KARAR B, KULLANICI EKRANI) `docs/GECMIS-KARARLAR.md` "Arşiv 23.10.2026 (2)"ya AYNEN; özetleri "2.4.4 kararları — son aday turu 2". (6) KÖR NOKTA (kullanıcıya bildirildi): B1 kayıt bağı sürekliliği sürümün sonunda giren BÜYÜK bir değişiklik (yeni modül dataset-bonds.mjs, yükleme/eşitleme çekirdeği) → tam kapı + Uzun Doğrulama + kullanıcının kendi verisiyle kısa elle kabul (Yerine Koy / Devamı / eşitleme) önerilir. (7) TEMİZ: GG5'ten beri 83 commit (bütün dallar) model adsız, Co-Authored-By + Claude-Session tam; uzakta yeni dal yok (yalnız çalışma dalı gönderildi); yalnız kendi temiz worktree'leri kaldırıldı (16, ders 36); ajan eforları kurala uygun (kayıt bağı ve para düzeltmeleri xhigh, küçük UI medium; tablo borcu D1/E1/E2 high — sınırda, sonraki para düzeltmeleri xhigh ajanda); her düzeltmenin kırmızı/yeşil + mutasyon + komşu + göç kanıtı ana oturumca JSON'dan okundu, kâhin her adayda ana oturumca koşuldu (ders 16); disk 16 GB. EDM parolası bu bağlamda yok (sıkıştırmayla gitti) → dosya taraması parola değeriyle yapılamadı; parola hiçbir komuta bu dönemde verilmedi. (8) İSTEK kaydı: "düzeltme ne kadar sürer" (~09:40 UTC) yanıtlandı (tahmin), buraya yazıldı.
- YETKİ (kullanıcı, 22.10.2026 ~18:40 UTC: "bir süre ekran başında olmayacağım, benim kararım gereken bir konu da 5 dk cevap vermezsem soruna; en yaygın kullanılan
  öneriye göre yap"): karar gereken soru iletide sorulur (bekletmeyen; 5 dk sonrasına kendine hatırlatma), 5 dk içinde yanıt yoksa en yaygın / önerilen seçenek
  uygulanır ve burada "5 dk yetkisiyle uygulandı" diye yazılır; kullanıcı dönünce özetlenir. YORUM (baş mimar): anayasanın kullanıcıya bıraktığı adımlar (PR →
  master "birleştir", yayın açma, müşteri/kimlik bilgisi isteme) bu yetkiye girmez, yine kullanıcıyı bekler. İLK UYGULAMA: ders 26 açıklaması (GÖZDEN GEÇİRME 4 (1),
  ~18:00'den beri yanıtsız) önerildiği gibi eklendi.
- KARAR REVİZYONU (kullanıcı, 23.10.2026 ~08:15 UTC: "çıkacak tüm bulguları düzelt kararımı revize ediyorum, yüksek ve orta bulguları düzeltelim, çıkacak küçük bulguları erteleme de sakınca olmazsa devir modülü sürümüne erteleyelim. anayasamıza uygunsa böyle yap") → yukarıdaki "B" kararının YERİNE: YÜKSEK ve ORTA bulgular 2.4.4'te düzeltilir (yeni aday); DÜŞÜK bulgular 2.5.0'a (devir sürümü) ertelenir, iş listesi "SONRAYA (2.5.0)" ve teslimde BİLİNEN SINIRLAR'a yazılır. ANAYASA DENETİMİ (baş mimar): uygun — karar ürün sahibinin; kalite çıtası ve kanıt kuralı aynen. SAKINCA SÜZGECİ (her DÜŞÜK için yazılı gerekçe): yanlış para/borç/bakiye, veri kaybı ya da kopan bağ, e-Belge/GİB/numara, yevmiye/defter, yetki/KVKK, 2.4.4 gerilemesi → "düşük" etiketli olsa da ERTELENMEZ (ORTA sayılır). Zaten yapılmış/sürmekte olan DÜŞÜK düzeltmeler (bildirim tiresi, B3) geri alınmaz.
- DURMA KURALI (kullanıcı, 23.10.2026 ~12:17 UTC; soru "sonsuz bir döngüye girmedik değil mi?" → tur sayıları 1/2/6/3/1 ve öneri verildi; yanıt: "önerin uygun ama yüksek ya da orta bulgu olursa düzeltilsin"): aday 20'den itibaren dar kontrol YALNIZ son düzeltmenin değiştirdiği kod + doğrudan komşuları (yeni alan taraması yok); çıkan YÜKSEK/ORTA her bulgu düzeltilir (v2.4.3'te de olsa); DÜŞÜK 2.5.0'a (sakınca süzgeciyle); her tur kullanıcıya sayılarla bildirilir.
- ADAY 20 (23.10.2026 ~12:25 UTC; /home/user/wt/aday20 c38d549 = aday 19 + is/r31e-f [9550df7 + a97cd52 Z1] + is/kahin-244 0f23768): Z1 kanıtı denetlendi (kırmızı 4/6, kâhin 3574, mutasyon 43/43, komşu 1182, 13 e2e, göç 46/46); birleşim dar 48/48, cari kâhini 3574/3574 (ana oturum), gezinti 124/124. BAŞ MİMAR KARARI (kâhin çatalı): satır borcu belirlenemeyen satırda (Aidat + Gecikme Faizi, Kalan boş) takvim kalemi dönem tutarı, Kişiler/Açılış Bakiyesi'nde not. 31e TUR 10 (durma kuralı: yalnız Z1 farkı + komşuları): Z1 KAPANDI; Z2 ORTA (v2.4.3'te de: eksi Kalan'lı satır dönem tutarıyla gecikmiş) → kalem yok; Z3 ORTA (v2.4.3'te de: taksit sütunlu tabloda söz kalemi taksit tutarı) → söz kalemi söz tutarı. → is/r31e-f (a9e1cd5e8d7dc429d), kâhine karar metinleri. Sonra ADAY 21 (dar kontrol yalnız Z2/Z3 farkı).
- ADAY 21 (23.10.2026 ~13:20 UTC; /home/user/wt/aday21 8def842 = aday 20 + is/r31e-f [7465080 + 007eb2e Z2/Z3] + is/kahin-244 27b2fb8): Z2/Z3 kanıtı denetlendi (kırmızı 4/4, kâhin 3632, mutasyon 46/46, komşu 1186, 13 e2e, göç 46/46). 31e TUR 11 (durma kuralı): Z2/Z3 KAPANDI; YENİ Z4 YÜKSEK (007eb2e gerilemesi: söz kalıbı soz\w* "Sözleşme Tutarı"nı söz tutarı sanıyor — söz kalemi 3.000 → 50.000, Nakit 12.800 → 153.300) → KARAR: söz tutarı yalnız "Söz/Ödeme Sözü/Taahhüt Tutarı", "Sözleşme…" söz değil. → is/r31e-f (a9e1cd5e8d7dc429d), kâhine karar metni. Sonra ADAY 22.
- ADAY 22 (23.10.2026 ~13:40 UTC; /home/user/wt/aday22 e5667af = aday 21 + is/r31e-f [26e6573 + b0ef5eb + e83b7ce Z4] + is/kahin-244 6bc10ff): Z4 kanıtı denetlendi (kırmızı 2/2, kâhin 3701, mutasyon 48/49 → eksik test eklendi, 3/3; komşu 1188, 13 e2e, göç 46/46); birleşim dar 56/56, cari kâhini 3701/3701 (ana oturum), gezinti 124/124. Kararlar: "Sözleşme Tarihi"/"Başlangıç" vade açmaz; "Sözleşme Bitiş" tutarsız Yaklaşan satırı (v2.4.3'te de, para değil) → SONRAYA 2.5.0. 31e TUR 12: Z4 KAPANDI; Z5 (DÜŞÜK etiketli, gerileme + beklenen tahsilat → ORTA: "Taahhütname Tarihi" söz sayılmıyor) → taahhüt ailesi önek; Z6 (v2.4.3'te de, para: "Söz Miktarı" söz tutarı değil) → "tutar" ya da "miktar". → is/r31e-f, kâhine karar metni. Sonra ADAY 23. Z5/Z6 TAMAM (is/r31e-f 96cadc0 + 63b28b4; ana oturum JSON'dan: kırmızı 2/2, tablo-borç 66/66, komşu 1192/1192, mutasyon 12/12, e2e 50/46/90/153, kâhin e5d2cda 3744/3744; kâhin aday 22'de 3736/3744 kırmızı — beklenen). Ajanın açık bulgusu: debt-column söz tutarı başlığı tam sözcük → yalnız "Taahhütname Tutarı" sütunlu sekme Kişiler'de borç 700, Takvim söz sayıyor (aday 22'de de) → SÜZGEÇ: borç tutarı → ORTA, ertelenmez. KARAR (A1 + Z5/Z6 metninden): söz tutarı sütunu tek tanım, iki yol aynı yardımcı, hiçbir yolda borç değil; "Taahhütlü Ücret" borç kalır. → aynı ajan (is/r31e-f) + kâhin senaryosu (is/kahin-244). TUR 13 TAMAM (f8e9ae4 + 40c9d99; JSON: kırmızı 2/2 aday 22 + 2/2 63b28b4, 8/8, komşu 1194, mutasyon 12/12, 9 e2e, göç 46/46, kâhin ee3111e 3789/3789). Ajan yorumu 1 ONAY (BAŞ MİMAR KARARI (9)); yorum 2 RED: yalın "Ödeme Sözü"/"Söz"/"Taahhüt" para kolonu artık borç olabiliyordu (aday 22'de dışlanıyordu) → gerileme + para → ORTA, TUR 14: söz ailesi başlığı tutar/miktarsız ve dönem sözcüksüzse borç adayı değil (A1). Kâhine (a)–(c) senaryoları: e546d4b (b3x) aday 22'de 3817/3845 (JSON okundu; b3x 14 beklenen fark). Kâhin kendi not okumasındaki deliği düzeltti (not artık satırın sekmesini adlandırmalı) → b3n'de YENİ: tutar kolonsuz "Takip" sekmesinin kişileri Kişiler'de yok, kendi sekmesine not yok (Y1 kararı: "satır görünür ya da görünür not") → yeniden üretilirse ORTA → TUR 15 (aynı ajan, tur 14'ten sonra ayrı commit). Sonra ADAY 23.
- DONDURMA (kullanıcı, 23.10.2026 ~14:42 UTC; soru "sürekli başa mı sarıyor bu testler?" → yanıt: başa sarmıyor, tam kapı hiç yeniden koşulmadı; son 4 tur (12–15) aynı alanda — başlık tahmini — her düzeltme yeni uç durum açtı, kâhine son iki turda yeni başlık türleri de denettirildi (durma kuralından sapma, baş mimarın hatası); öneri verildi → "onaylıyorum"): (1) tur 14 + tur 15 SON düzeltmeler; kâhine son düzeltmenin farkı dışında yeni senaryo EKLENMEZ. (2) Aday 23 → dar kontrol YALNIZ tur 13–15 farkı → tam kapı → paket. (3) Bundan sonra tablo başlığı/borç sütunu alanında yalnız GERİLEME (aday 22'de doğru olup bozulan) ve YÜKSEK bulgular düzeltilir. (4) Aday 22'de de var olan ORTA başlık durumları 2.5.0'a ertelenir, teslimde BİLİNEN SINIRLAR (Excel–para YÖN'ü bu alanı küçültür). Durma kuralının "ORTA da düzeltilir" kısmının bu alan için yerine geçer. ADAY 23 (~15:15 UTC; /home/user/wt/aday23 0c42a85 = aday 22 + is/r31e-f affe774 [tur 12–15] + is/kahin-244 e546d4b): tur 14 (2bcaa71, kendi gerilemesi f8e9ae4) ve tur 15 (26bb456, Y1 not eksiği) kanıtı JSON'dan okundu (kırmızı 3/3+3/3 ve 2/2+2/2, tur 8 beklentisi 1/4 eski kodda; yeşil 13/13, 102/102, komşu 1199, mutasyon 17/17 + 8/8, 9 e2e, göç 46/46, kâhin 3845/3845). Birleşim dar + kâhin + gezinti koşuyor; dar kontrol (aacb5253c1e83b520) YALNIZ aday 22 → 23 server/ farkı: gerileme + YÜKSEK. Aday 23 kanıtı (439eb2d): birleşim dar 102/102, kâhin 3845/3845, gezinti 124/124. 31e TUR 13 (dar kontrol): Z5/Z6/söz tutarı/not KAPANDI, YÜKSEK yok; YENİ GERİLEMELER (tur 13–14 farkından): R1 ORTA ("Taahhüt Alacağı"/"Taahhüt Bakiyesi" yalın söz sanılıyor — kalem boş, Nakit 25.900 → 19.000, bakiye 2.100 yok sayılıyor), R2 DÜŞÜK ("Taahhüt Miktarı (Ay)" söz tutarı: 5.000 → 12) → DONDURMA gereği ikisi de düzeltilir: TUR 16 (aynı ajan) + kâhin (7) yorumu aynı eksiği taşıyabilir (ders 5) → muafiyet Y1/N4/K3 metninden. Kâhin 64eead7 (b3y) aday 23'te 3869/3883 (JSON okundu; önceki 3845 denetimde kâhin çıktısı bayt bayt aynı). ÇAKIŞMA: b3y (b) "Taahhüt Bakiyesi" Kalan sayılmalı — ürün v2.4.3'ten beri tanımıyor (2.5.0 adayı 2, DONDURMA) → kâhin beklentisi DEĞİŞMEZ; kâhine BİLİNEN SINIR listesi (tam kontrol adı + karar kaynağı + program değeri; ayrı yazılır, başarısız sayılmaz; kapanan/değişen kayıt BAŞARISIZ) — CI yeşil kalır, fark gizlenmez; teslimde BİLİNEN SINIRLAR (kâhin 83c3bd1 + 4e68411; liste mutantları 5/5). TUR 16 TAMAM (23cf851 + 43224dd; JSON: kırmızı 2/2 aday 23, yeşil 15/15, komşu 1201, mutasyon 9/9, 9 e2e, göç 46/46; kâhin 3873/3883 — kalan 10 fark yalnız b3y "Taahhüt Bakiyesi", aday 22'de de aynı). Tek aday 22 farkı: "Taahhüt Alacağı" tek tutar sütunu → Kişiler'de borç (onaylı tur 13 kuralı / BAŞ MİMAR (9) sonucu). ADAY 24 (/home/user/wt/aday24 550c2b0 = aday 23 + is/r31e-f 43224dd); kâhin BILINEN kayıtlarını aday 24 değerleriyle güncelliyor; dar kontrol tur 14 yalnız aday 23 → 24 server/ farkı. Kâhin d930959 aday 24'te 3883/3883 (11 bilinen; liste dışı 0; eski listeyle deneme "BİLİNEN DEĞİŞTİ" düştü) → aday 24'e birleşti (998bacd). 31e TUR 14 (dar kontrol): R1/R2 KAPANDI, yeni bulgu YOK (gerileme 0, YÜKSEK 0); "Toplam Taahhüt"/"Söz Bakiyesi" Kişiler'de borç (onaylı borç ailesi kuralı). DURMA: açık bulgu yok. Aday 24 kanıtı (3525c25): birleşim dar 104/104, cari kâhini 3883/3883, gezinti 124/124. TAM KAPI BAŞLADI (~16:00 UTC; <nd>/aday24-tam.sh: aday-kos.sh 24 [npm test + ci.yml 65 e2e] → cidisi-kos.sh 24 [14] → defter/tutar/e-Belge kâhinleri; çıktı <nd>/aday24-tam.out). Sonra: kanıt aday24 dalına → çalışma dalına merge → push → kanit.mjs ci --bekle 120. TAM KAPI KIRMIZI (~16:30 UTC): npm test 3438/3439 — banka-210-post-statik K6 "para tablosuna yazan her yer bank.post içinde": dataset-bonds.mjs move() payments.case_key UPDATE'i kapanışta (bank.post op assign çalışma zamanında doğru, sözcüksel değil) — B1 (aday 17) tam kapıdan hiç geçmemişti (aday 15–24 yalnız dar). İzinli liste "bag" denendi → testin 4. denetimi reddetti (payments.case_key para bağı) → test GEVŞETİLMEZ; düzeltme a9e1cd5e8d7dc429d is/r31e-f (sözcüksel bank.post + çalışma zamanı testi) → ADAY 25 (/home/user/wt/aday25 d8aa7f6 = aday 24 + is/r31e-f 6908b5b [cfb1405 K6]; JSON: statik eski kodda 5/6, yenide 6/6; çalışma anı K6 testi; B1 38/38; komşu 1208; mutasyon 3/3; 2 e2e; göç 46/46; birleşim dar 40/40 a38dbb5). 31e TUR 15 (dar kontrol): davranış AYNI (39+39 yol, k-ozel 9/9, k-kaldır 6/6, bank.post izi aynı), yeni bulgu YOK. TAM KAPI 2 BAŞLADI (~16:45 UTC; <nd>/aday25-tam.sh → <nd>/aday25-tam.out). TAM KAPI 2 YEŞİL (~18:30 UTC; kanıt aday25 02c795c; ana oturum çıktıdan okudu): npm test 3440/3440, ci.yml e2e 65/65, CI dışı 14/14, kâhinler defter 176/176, tutar 3559/3559, e-Belge model 114/114 + mutasyon 55/55 + senaryo 27/27 — hepsi çıkış 0. Çalışma dalına birleşti 432beb0 (kod aday 25 ile aynı) ve gönderildi; CI #863 432beb0 YEŞİL (ana oturum kanit.mjs ci: Linux 22/24, Windows 22/24, Uçtan uca, Doğrulama Kapısı, Dağıtım paketi) → iş listesi 30, 30a, 31, 32 çizildi. 32a windows.yml ×2 tetiklendi (~19:32 UTC, c928d15 = kod 432beb0): koşu 40012156441 (#51) + 40012160327 (#52). 33 UZUN DOĞRULAMA tetiklendi aynı anda (40012183423, #586; ~6 saat; plan alt sınırları varsayılan 5000/10000). 34 hazırlık: Wine 9.0 + mingw windres kuruldu; windows #51 YEŞİL; teslim belgeleri is/teslim-244b 48ad251 (DEGISIKLIKLER 3. bölüm aday 15–25 + BİLİNEN SINIRLAR + 2.5.0 + DENENEN/DENENMEYEN + BAŞ MİMAR (1)–(10); CHANGELOG bir cümle; kılavuz "Borç Sütunu Nasıl Tanınır" + "Aynı Tabloyu Yeniden Yüklemek"; belge testleri 106/106, pdf-denetle 39/39 kopyada) — PAKET COMMIT'İYLE birleşir: UD/windows sonuçları DENENEN'e, kılavuz PDF'i yeniden üretilip client/kilavuz'a (ders 26: tek push); paket UD + windows ×2 yeşil olunca (kırmızıda kod değişir → paket yeniden). Sonra 32a windows.yml ×2 → 33 Uzun Doğrulama ∥ 34 paket → 35 teslim.
- AÇIK (24.10.2026 ~04:30 UTC): CI #864 084fa8a (kod = 432beb0 + kılavuz PDF) "Uçtan uca" KIRMIZI — senaryo-banka-210 420/421, adım 15 "İşlem No ile arama" sonrası waitForFunction 10 sn zaman aşımı (Linux ×2 + Windows 24 yeşil). CI çıktısı adım 1–15 yerelle aynı (İşlem No BNK-2026-000011). Ürün okundu: HOF.listGate eski yanıtı yazmaz, keepFocus odaktaki arama metnini korur. Yerel 8 koşu YEŞİL 424/424: normal ×3, ağ gecikmesi 400/1500 ms (adım 15), CPU 6× (15), 6× (14–15), 12× (15) — kırmızı ZORLA ÜRETİLEMEDİ (ders 20). 4f9f909: senaryoya adım bazlı CPU_THROTTLE kancası + waitMoves zaman aşımında ekran durumu (süzgeç değerleri, satırlar, odak, liste metni). Gönderildi → yeni CI; kırmızı yinelenirse neden günlükte okunur ve kök neden düzeltilir; yeşilse #864 kırmızısı teslimde BİLİNEN SINIR/DENENMEYEN olarak açıkça yazılır (yeniden üretilemeyen tek seferlik e2e zaman aşımı), kapanmış sayılmaz.
- İSTEK (kullanıcı, 23.10.2026 ~13:45 UTC: "hazırlık yap, sohbeti sıkıştırma komutu vereyim") → devam notu 00 "GÜNCEL (23.10 ~13:45 UTC)" yazıldı ve gönderildi (ajan kimlikleri, adımlar, komutlar).
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
- YÖN (kullanıcı, 23.10.2026 ~12:45 UTC; "bu sadece içimi dökmekti" — KARAR DEĞİL, 2.4.4'te kod değişmez): "kasaya, cariye excelden / tablodan para giriş çıkış işlerinin olmaması gerekiyor; excel çok esnek, program tahmin ediyor … muhasebe ve para işinde riske atılabilecek bir durum değil … ileride excel tablosu ile para bağını komple koparıp cari üzerinden yapılmasını sağlayalım." BAŞ MİMAR NOTU (yanıtta verildi): bugün Excel'den paraya kalan yollar — (a) 2.4.3'ten kalan kayıt tahsilatları (case_key) ve onları koruyan B1 bağ sürekliliği, (b) "önce cari açın" Açılış Bakiyesi ön dolumu (tablo borcu, kullanıcı değiştirebilir), (c) Tablodan Aktar (tablodan taksit kartı, ön izlemeli), (d) Excel'den cari yükleme açılış bakiyesi (eşleme ekranlı), (e) API'de kayıt tahsilatı ucu (mutabakat/üreticiler). ÖNERİ (2.5.x'te ayrı sürüm, kullanıcı "başla" deyince): tablo yalnız bilgi + hatırlatma kaynağı; para yalnız Cari'den; eski kayıt tahsilatları kullanıcı onaylı göçle cariye; ön dolum ve Tablodan Aktar tutarları kullanıcı onayı olmadan paraya dönüşmez.
- İSTEK (kullanıcı, 23.10.2026 ~20:05 UTC): "excel / tablonun kasadan, paraya dokunan yerlerden tamamen koparılması ve ajanda / rehber gibi kalması ne kadarlık iş; 2.5.5'e kalan işleri de ekle — koparmayla bir kısmı kendiliğinden çözülür" → salt okuma analiz ajanı (koddan envanter + paketler + tahmin + ertelenenlerin çözülür/kısmen/hayır tablosu; not defteri tablo-kopar/RAPOR.md). NETLEŞTİ (kullanıcı: "bu sürümde bulunup ertelenen hatalardan bahsediyorum, 2.5.5'i yanlış yazmış olabilirim"): kapsam = 2.4.4'te bulunup ertelenen bulgular (iş listesi SONRAYA 2.5.0 / 2.5.0 adayı / DONDURMA / BİLİNEN SINIR). Kod değişmez (YÖN maddesi).
- YÖN KARARI (kullanıcı, 23.10.2026 ~20:15 UTC; 12:45'teki "içimi dökmek"in teyidi): "mevcut piyasadaki muhasebe programları gibi olmasını istiyorum, excelden sheetsden gelen verileri programın analizine bırakarak muhasebesel işleri riske atamayız." → HEDEF (2.4.4'ten SONRA ayrı sürüm; 2.4.4 kodu değişmez): para kaydı, borç tutarı, açılış bakiyesi programın tablo sezgisinden doğmaz; Excel/Sheets yalnız açık eşlemeli + ön izlemeli + onaylı tek seferlik içe aktarma (cari kartı, açılış fişi — Logo/Mikro/Wolvox/QuickBooks düzeni); tablo ajanda/rehber + hatırlatma ("tablodan, muhasebe kaydı değil"). Sürüm ve sıra koparma analiz raporundan sonra kullanıcıya önerilir. RAPOR (23.10 ~20:30 UTC): docs/erp/TABLO-PARA-KOPARMA-PLANI.md (envanter dosya:satır; ana oturum workspace.mjs:394 kayıt tahsilatı ucu, overview.mjs:374 Projeksiyon tablo kalemleri, general-ledger.mjs:192/267 A 602 iddialarını koddan doğruladı). Paketler P0–P9, 6–9 gün / 6–10 aday turu; ertelenen 25 bulgudan koparma + eşleme (B) ile 15 tamamen, 6 kısmen, 4 hayır. ÖNERİ verildi: 2.5.0 devir önce (tarih kritik) + küçük ara adım; koparma ayrı sürüm (2.6.0). Kararlar K0–K11 kullanıcıda. KAPI KAPATMA (kullanıcı ~20:50 UTC: "sadece giriş kanalını kapatmak … önce yapıp sonra koddan çıkartsak olmaz mı?" → EVET önerildi: özellik anahtarı — (1) kayıt tahsilatı yeni giriş/düzeltme kapalı (silme/geri yükleme açık), (2) Tablodan Aktar düğme + uç kapalı (Geri Al açık), (3) Açılış Bakiyesi / Tahsilat Gir ön dolumu boş, (4) Projeksiyon tablo kalemleri varsayılan kapalı; uç testler için anahtarla açılır). Kullanıcı: "eski müşteriler lisanslı birkaç kişi, artık yalnız cariyi kullanır; işin çoğu test sanırım" → eski veri dondurulur, uyumluluk yükü küçük. KARAR (kullanıcı ~21:00 UTC): "2.4.4'ten sonra olacak artık. Bu sürümü sabah aksilik olmazsa canlıya alalım. 2.4.5 için düşünüyorum: kapıları kapatalım ve ertelenen işleri de yapalım." → 2.4.4 OLDUĞU GİBİ (UD yeşilse sabah paket + teslim; yayın yine kullanıcının "birleştir"/yayın adımıyla). 2.4.5 KAPSAMI: kapı kapatma (1)–(4) + 2.4.4'te ertelenen bulgular (docs/erp/TABLO-PARA-KOPARMA-PLANI.md §4.1, 25 kalem). AÇIK KARAR (önerildi): başlık ailesi bulguları (1–4, 6, 8, 21, 23) tek tek mi (~3 gün, döngü riski) yoksa SEÇENEK B (sekme başına tutar sütununu kullanıcı bir kez seçer, program önerir) mi (öneri B). 2.4.5 başlamadan önce iş listesi docs/2.4.5-IS-LISTESI.md + kâhin önce (D0 düzeni). Devir 2.5.0 Aralık başına kadar yayında olmalı (hatırlatıcı 29.10). KULLANICI (~21:15 UTC): "uyarılar da tablodan gelmese, taksit ya da cari modülünden gelse; o kapıyı da kapatsak, yeni iş çıkar mı?" → KODDAN (routes/dues.mjs:60–112): zil/takvim bugün tablo kalemleri + tablo tarihleri (computeDeadlines) + taksit (plans.dueItems) + çek + fatura + planlı banka; carinin kendi ödeme sözü / vade hatırlatması YOK. Öneri verildi: tablo PARA hatırlatmaları kapanır; boşluk = "Cari'de Ödeme Sözü" (tarih + tutar + not → zil/takvim/Tahsil Et; yeni iş ~1,5–2 gün); tablonun tutarsız tarih hatırlatmaları (duruşma, sözleşme bitiş) ajanda olarak kalabilir (karar); Tablodaki Kişiler tablo borcu yerine cari bakiyesi. Böylece başlık ailesi bulguları tamamen anlamsızlaşır, B gerekmez. 2.4.5 tahmini ~3–4 gün. KARAR (kullanıcı ~21:25 UTC: "kalacaklarda önerin uygun"): tablonun TUTARSIZ tarih hatırlatmaları (duruşma, sözleşme bitiş, icra son tarihi) ajanda olarak KALIR. SORU: "caride ödeme sözü diye bir şey var mı genel muhasebe programlarında, yoksa borcun vadesi gelince uyarmaz mı?" → yanıt: piyasanın temeli VADE (alacak kaydının kendi vade tarihi + vadesi gelen/geçen uyarısı + yaşlandırma); "söz" ayrı nesne değil, tahsilat takibinde "beklenen ödeme tarihi" (Xero expected date / Sage promise to pay türü) ek alan. KODDAN: account_entries'te vade alanı YOK (migrations.mjs:607); fatura/taksit/çek vadeli. KARAR (kullanıcı ~21:35 UTC: "önerilerin uygun"): 2.4.5 = (0) iş listesi + kâhin önce; (1) kayıt tahsilatı yeni giriş/düzeltme kapalı (test anahtarı); (2) Tablodan Aktar kapalı (Geri Al açık); (3) Açılış Bakiyesi / Tahsilat Gir ön dolumu boş; (4) zil/takvim/Vade Takip/Projeksiyon'da tablo TUTAR kalemleri yok, tablo tarih hatırlatmaları kalır; (5) Tablodaki Kişiler tablo borcu yerine cari bakiyesi, Tablodaki Nakit Akışı kalkar; (6) cari borç kaydına Vade Tarihi + Beklenen Ödeme Tarihi → zil/takvim/Tahsil Et; (7) küçükler (Sözleşme Bitiş, N7, A. Can Er); (8) kılavuz + sürüm notu ("projeksiyon toplamı düşer"); (9) doğrulama. Tahmin ~6 iş günü, paralel ajanlarla 3,5–4,5 takvim günü (+1 gün pay); GitHub ücretsiz. 2.4.4 tesliminden SONRA, kullanıcı "başla" deyince. PLAN HAZIR (kullanıcı ~21:50 UTC: "2.4.5 planlamasını şimdiden yap, başla dediğimde başlayacak hale getir"): docs/erp/2.4.5-IS-LISTESI.md (BELGE_YOLLARI içinde → CI/UD'ye yük yok; "başla"da docs/2.4.5-IS-LISTESI.md'ye taşınır, madde 0a). Kullanıcı "en sade" düzeltmesine yanıt vermeden plan istedi → madde 7 (Tablodaki Kişiler cari bakiyesi, küçükler) İSTEĞE BAĞLI yazıldı. Açık soru S1 FIFO (öneri evet). SAAT NOTU: bu bloktaki "~20:05 … ~21:50 UTC" etiketleri tahmindi; `date -u` 20:39 UTC'de okundu → gerçek aralık ~19:40–20:40 UTC (TR = UTC+3). UD #586 20:39 UTC: 19 iş yeşil, 7 sürüyor, başarısız 0.
- YAPILMAZ (19.10.2026): kontörlü "Tüm Bilgileri Getir" (Mükellef Sorgula yalnız CheckUser); müşteri talebi gelirse yeniden. Ayrıntı arşivde (21.10).
- SON ADAY BAĞIMSIZ TURU (kullanıcı, 22.10.2026: "2.4.4 son aday uzun test koşusuna başlamadan kâhin (uzman mali müşavir), yargıç, eleştirmen testlerinden geçecek mi,
  regresyon testleri yapılıyor mu?" → EVET; "ekle" → uzman UI + uzman UX de): iş listesi madde 30–31 (31a kâhin, 31b mali müşavir, 31c yargıç, 31d eleştirmen, 31e dar kontrol,
  31f uzman UI/UX) Uzun Doğrulama'dan ÖNCE.
- MEVZUAT KARARI (kullanıcı, 20.10.2026): e-Fatura / e-Arşiv kutu metinleri DEĞİŞMEZ, 2.4.4'te değil; geri bildirim gelirse netleştirilir. 509 VUK GT okuma
  notları (IV.2.2, IV.2.4.1, V.1 kayıt yöntemi) arşivde (21.10).
- RAPOR DÜZENİ (kullanıcı, 21.10.2026: "2.4.4'ü yaparken 30 dk'da kısa ara rapor ver, düşen test var mı, durmuş işlem var mı kontrol et; varsa gereğini yap;
  yapılacak işleri maddele, iş bittikçe üstünü çiz ve bana göster"): liste `docs/2.4.4-IS-LISTESI.md` (biten madde üstü çizili, commit ile). Uygulama: "başla"
  deyince oturum içi 30 dk'lık CronCreate işi (yalnız boşta çalışır; 7 günde kendiliğinden biter; 2.4.4 bitince silinir) + uzun turda her denetim noktasında
  30 dk dolduysa rapor. Raporda: ne yapılıyor, düşen test (çıkış kodu + sayılar, CI), duran işlem (arka plan koşuları, ajanlar, CI); varsa önce gereği yapılır.
- HAZIRLIK (21.10.2026, 2.4.4 öncesi denetim): (1) YAPILDI (21.10.2026, ERP yol haritası commit'i): docs/2.4.4-IS-LISTESI.md ve docs/erp/** BELGE_YOLLARI'nda (tools/kanit.mjs
  + ci.yml paths-ignore + test/kanit-araci.test.mjs; yeni iddia eski araçta kırmızı 47/48, yenide 51/51) → iş listesi tek başına gönderilebilir, CI koşmaz. (2) Kapsayıcı: node_modules YOK → `npm ci` (ders 29: bağ yok); depo SIĞ → teslimden önce `git fetch --unshallow`; Wine/mingw YOK →
  paketten önce kurulur; Go, Chromium, disk (30 GB boş) hazır. (3) İmza anahtarı ve EDM test hesabı bu oturuma verildi; yalnız oturumda durur, kapsayıcı
  yenilenirse yeniden istenir; hiçbir dosyaya yazılmaz. YÜKLENENLER `/root/.claude/uploads/456ebc12-8183-520e-989e-af270fef8a58/`: imza anahtarı
  (*imza-anahtari*.pem), EDM e-SMM Web API v4.4.1 + Request-Response (.docx), durum kodları (.xlsx), esmm-ubl-ornek-veri.xml, Ek_bilgi.txt, TesterCurrent.cs
  (içindeki hesap bilgileri hiçbir yere kopyalanmaz), E-MM zip (e-Müstahsil, kapsam dışı). docx metinleri not defterinde (esmm-dok-v4/; kapsayıcıyla gider,
  belgelerden yeniden çıkarılır).
