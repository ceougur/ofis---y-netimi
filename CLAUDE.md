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
  ci.yml push `paths-ignore` = `tools/kanit.mjs` BELGE_YOLLARI (CLAUDE.md, docs/GECMIS-KARARLAR.md, docs/DURUM-VE-DEVAM.md, docs/devir/**,
  docs/fatura/**, docs/pazarlama/**; testlerin okuduğu plan/kanıt/kılavuz belgeleri listede YOK; liste aynılığı test/kanit-araci.test.mjs'te).
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
    push'u CI kuyruğunu 35+ dk tıkadı.)

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

### Verimlilik (kullanıcı, 12.10.2026: "geçmişte yaptığın hatalardan aldığın dersleri göz önüne al; gereksiz zaman ve kullanım limitimi
harcayacak işlemlerden uzak dur!")
- Dersler 1–24 her işte uygulanır; ama kanıt için GEREKEN kadar koşulur, fazlası değil: geliştirme sırasında yalnız değişen alanın testleri;
  tam `npm test` iş başına bir kez (bitişte); uzun koşular (mutabakat 5.000+, güvenilirlik 10.000, ölçek) yalnız son adayda, bir kez, GitHub'da.
- Bağımsız doğrulama tur sayısı sınırlı: bir tur; yalnız yeniden üretilmiş bulgu varsa düzeltme + bir kontrol turu daha. Aynı işi iki ajana
  yaptırma; ajan raporunu ana oturum yalnız ÖZET kanıtla (kırmızı/yeşil sayıları, CI) denetler, işi baştan yapmaz.
- Bekleme için yoklama yok (CI/ajan bildirimini bekle); CI her push'ta bir kez okunur. Gereksiz dosya okuma, uzun çıktı, tekrar eden sorgu yok.

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
  (2.0.18 nihai karar). Kayıttan taksit ve Taksit → Tablodan Aktar durur. Aynı Excel ikinci kez yüklenince telefonsuz/no'suz satır yeni cari
  açar — böyle kalır (2.0.19).
- Eksi stok: program sorar, "izin ver" denince eksiye düşer; böyle kalır (02.10.2026). Eksi üründe "Eksi Stok −15 Adet" gösterimi.
- Şirket = ayrı veri dosyası (`sirketler/<kod>/`), kod 001, 002…; EN FAZLA 2 şirket (Pro dahil; 3+ eski kurulumlar kalır); sınırda
  "+ Yeni Şirket" HİÇ görünmez (05.10.2026). Çalışma oturumu kalktı: solda şirket, ortada sayfalar. Yedekler `backups\<kod> - <ad>\`,
  Geri Yükle var (kalır). Şirket Verisini Sıfırla: önce zorunlu yedek, onay kutusu şirket koduyla dolu gelir.
- Drive yedeği KALDIRILDI (10.10.2026); yalnız yerel yedek. "Google Drive'a Bağlan" ileride, kullanıcı isterse.
- Uyarı ufku bütün sayfalarda son 7 gün (11.10.2026 "A"). Kayda Git başka sayfadaki kaydı açar.
- Raporlar: her raporda alt TOPLAM satırı (ekran/PDF/Excel aynı); ilk açılış "Bu Yıl", son dönem hatırlanır; boş dönemde ipucu. Tahsilat
  raporlarında toplam Excel'den gelen açılışı (önceden ödenen) DAHİL eder; Kasa raporları değişmez (03.10.2026).
- Fatura: "kes" değil "kaydet"; Stok Kodu tekil; icra dosyası bağı YOK; iade belgesi de düzenlenir; pasif düğmenin nedeni görünür yazı;
  fatura kapama yöne göre (hayalet kısmi ödeme yok), "Kapatılacak Fatura" ve "Mahsup Et" var.
- e-Belge (vergi dairesi/entegratör) KAPALI — kullanıcı "entegre et" diyene kadar; belge "Müşteri Fişi"; altyapı `config.edocEnabled` false.
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

## Açık iş (yalnız güncel; kapanan sürümler `docs/GECMIS-KARARLAR.md`)
- Yayın geçmişi özeti: 2.0.12 … 2.0.26 ve 2.1.0 yayımlandı (her biri PR + etiket + 5 dosya bayt bayt + güncelleyici "available" + site
  kılavuz PR'ı); ayrıntı arşivde. Kâhin bilinen sınıfları: KDV-DAHIL-ISKONTO (program doğru), KASA-ACILIS-649 (İz 1.3 ile kapanacak).
- PLANLI TEST (kullanıcı, ertelendi; 16.10.2026'da yine ertelendi: "cuma testini pazara ertele"): Pazar 18.10.2026 09:00 TR (trig_0144BJLRwsZFizXTTYrJVszA): 2.0.24 DENENMEYEN/BİLİNEN SINIRLAR
  (`docs/2.0.24-KANIT.md`) + ölçek/yük (30 kullanıcı, 1.000.000 satır; sunucu + ARAYÜZDEN, tablo iki sütun).
- 2.1.0 kapsam ölçümü (satır/dal/arayüz) — yayından sonra yapılacak iş (kullanıcı 11.10.2026).
- 2.2.0 SÜRÜM NOTU (kullanıcı, 12.10.2026): "bitişte sürüm notunda iyileştirmeler ve POS entegrasyonu yazması yeterli, kılavuza eklerken
  hap bilgi olarak ekle" → CHANGELOG ve GitHub yayın metni yalnız "İyileştirmeler ve POS entegrasyonu"; kılavuza yalnız kısa nasıl-yapılır.
- 2.1.0 YAYIMLANDI (11.10.2026 18:45 UTC; PR ceougur/ofis---y-netimi#27 → `master` = 7c6405f, `v2.1.0`; önceki oturumda bayt bayt
  denetlendi; 12.10.2026 GitHub'dan yeniden okundu: 5 dosya yerinde, kılavuz PDF b326df68…, paket sha256 d341941a…; release.yml ayrıca
  DestekOfis-Kurulum-2.1.0.exe + .sha256 ekledi). Site kılavuz PR'ı ceougur/destekofis#12 BİRLEŞTİ (11.10.2026). 2.1.0 KAPANDI.
  Yeni oturum dalı `claude/hopeful-goodall-6nmtcj` (master'dan). Sırada (kullanıcı seçer): 2.1.0 kapsam ölçümü; 2.1.1 (Rapor Merkezi Excel
  şirket başlığı, K6 Kasa açılışı, iki pencerede "sayfa silindi"); ertelenenler (döviz, Bankaya Tahsile Ver, K8, bankalı iade/iptal,
  kalan banka raporları) → 2.2.0 POS → 2.3.0 ekstre; Cuma 16.10.2026 planlı test.
- MÜŞTERİ SORUSU (12.10.2026, ekran: Banka → Hesaplar, Durum kolonunda "Etkin · Doğrulanmadı"): "doğrulanmadı ne demek?" KODDAN
  (hof-bank.js:392): hesabın açılış bakiyesi bankadan teyit edilip "Bakiye Doğrulandı" işaretlenmemiş; işaretlenmeden o hesapta eksi
  bakiye denetimi çalışmaz (hof-bank.js:788). Yol: hesaba tıkla → Açılışı Düzelt → "Bu tutar bankadaki gerçek bakiyedir" işaretle.
  ÖNERİ (2.1.1, karar kullanıcıda): etiket tek başına anlaşılmıyor → "Açılış Bakiyesi Doğrulanmadı" + üzerine gelince/yanında kısa neden.
- MÜŞTERİ İSTEĞİ (12.10.2026, ekran: Yeni Banka Hesabı, Hesap Türü listesi "Kurumsal Kredi Kartı" seçili): "kredi kartlarını bankaya
  bağlamak gerekiyor; Yapı Kredi tanımında 'kredi kartı kullan' seçeneği olsun, World kartı oraya girelim; ödemede tanımlı kartlar gelsin;
  Yapı Krediyi iki kere mi kaydedeceğiz?" KODDAN (2.1.0): her kurumsal kart AYRI hesap kaydı (accounts.mjs ACCOUNT_KINDS.card, 309.NN); banka
  adı serbest metin, Vadesiz hesapla BAĞ YOK; ödeme yollarında "Kredi Kartı" seçilince kart hesapları gelir (module-ref.mjs:58); kart borcu
  Banka Fişi "Kart Borcu Ödemesi"nde ödeyen hesap her seferinde seçilir. Yani bugün de "Yapı Kredi · World" kart kaydı açılır, Vadesiz'i
  ikinci kez açmak gerekmez; ama ekranda bu anlaşılmıyor. ÖNERİ (karar kullanıcıda): hesap kartında "+ Kredi Kartı Ekle" (banka adı dolu
  gelir, kart adı ör. World, son 4 hane, limit, hesap kesim/son ödeme günü, "Kart Borcunu Ödeyen Hesap" = bu Vadesiz); Hesaplar listesinde
  kartlar bankasının altında girintili; Kart Borcu Ödemesi'nde bağlı hesap öndolu; Yeni Banka Hesabı listesinden "Kurumsal Kredi Kartı"
  kalkar (yalnız bankanın içinden). Şema: bank_accounts.parent_id (göçle boş; eski kartlar ad eşleşmesiyle önerilir, kendiliğinden bağlanmaz).
  NOT (kullanıcı, 12.10.2026): Yapı Kredi/World yalnız ÖRNEK — her banka, her kart, bir bankada birden çok kart; kod bankaya özel olmaz.
- KARAR (kullanıcı, 12.10.2026: "düzeltmelerle birlikte POS'u da yapalım; müşterinin taleplerini halen dinliyorum"): sıradaki sürüm =
  2.1.1 düzeltmeleri ("Doğrulanmadı" etiketi, kredi kartını bankanın içinden ekleme, Rapor Merkezi Excel şirket başlığı, K6 Kasa açılışı,
  iki pencerede "sayfa silindi") + POS MODÜLÜ (plan `docs/BANKA-MODULU-PLAN.md` 2.2.0 aşaması: satış faturası/cari/taksit tahsilatında
  "Kredi Kartı" = POS → POS hesabı seçimi, komisyon + KDV/BSMV, valör, blokeli/teminatlı, POS iadesinde komisyon, raporlar). Sürüm no
  paketlemede (POS yeni modül → 2.2.0 önerilir). BAŞLAMADAN ÖNCE: kullanıcı müşteri taleplerini topluyor → hepsi gelince listeye eklenir,
  sonra iş planı kullanıcıya sunulur. Her yeni talep AYNI ANDA buraya yazılır.
  MÜŞTERİ (aynı gün, madde 6 — POS kararının içinde): müşteriden kartla tahsilatta firmanın HANGİ BANKANIN POS'u ise o seçilir. Uygulama:
  banka hesabı kartında "POS Kullan" işareti (Kredi Kartı/Çek/Senet Kullan gibi) → altına POS cihazı/üye işyeri eklenir (ad, üye işyeri no,
  komisyon oranı, valör günü, parayı yatırdığı hesap = bu hesap, blokeli mi); satış faturası/cari/taksit tahsilatında yol "POS" seçilince
  yalnız tanımlı POS'lar gelir (tekse kendiliğinden, çoksa seçim, yoksa "POS Tanımla"); bakiye/valör o bankanın hesabına yazılır.
  KARAR (kullanıcı, aynı gün): "Tanımla" kuralı POS'ta da aynı — "POS Tanımla" düğmesi bütün tahsilat formlarında (satış faturası, cari
  tahsilatı, taksit tahsilatı), form kapanmadan pencere açılır, kaydedince seçili gelir; yetkisi olmayana düğme yerine "POS tanımlı değil,
  yöneticinize başvurun". Tek kural: Kart / POS / Banka Hesabı / Çek Hesabı seçicisinin hepsinde tanımla düğmesi + yetkisizde yazı.
- İSTEK (kullanıcı, 12.10.2026; sıradaki sürüme): ALIŞ FATURASI ödeme yolu "Kredi Kartı" → tanımlı tek kurumsal kart varsa KENDİLİĞİNDEN
  gelir (bugün de öyle: "… kurumsal kartına yazılır"); birden çoksa kullanıcı SEÇER (bugün de öyle); HİÇ YOKSA formda "Kredi Kartı Tanımla"
  düğmesi → kart tanımlama penceresi (form kapanmadan, girilenler kaybolmadan) → kaydedince yeni kart ödeme satırında seçili gelir, işleme
  devam. KODDAN (hof-invoices.js:946): bugün kart yoksa hücre GİZLİ, hiçbir şey görünmüyor (açık bu). Aynı düğme aynı kalıptaki öbür
  ödeme formlarına da (cari ödemesi, stok alımı; havale için "Banka Hesabı Tanımla") — öneri. Yetki: hesap tanımlama yetkisi yoksa düğme
  yerine "Kart tanımlı değil; yöneticinize başvurun" yazısı. Kart bankanın içinden ekleme maddesiyle aynı pencere (banka seçilir).
- KARAR (kullanıcı, 12.10.2026: "önerilerin uygun") → alış faturası "Kredi Kartı Tanımla" + aynı düğme cari ödemesi/stok alımında, havalede
  "Banka Hesabı Tanımla", yetkisizde düğme yerine yazı: YAPILACAK (sıradaki sürüm).
  İSTEK (kullanıcı, aynı gün): banka hesabı tanımında "Kredi Kartı Kullan" gibi "ÇEK KULLAN" ve "SENET KULLAN" seçenekleri; çek
  işlemlerinde yalnız "Çek Kullan" işaretli bankalar gelir. KODDAN (hof-cheques.js:219): bugün çek/senet formunda "Banka / Şube" SERBEST
  METİN, hesap bağı yok; verilen çek ödenirken yol + hesap ayrıca seçiliyor (hof-cheques.js:318). ÖNERİM: banka hesabı kartında üç işaret
  (Kredi Kartı Kullan → altına kart eklenir; Çek Kullan; Senet Kullan; varsayılan kapalı, eski hesaplarda kapalı). Verilen ÇEK formunda
  "Banka / Şube" metni yerine "Çek Hesabı" seçici (yalnız Çek Kullan işaretli etkin TL hesaplar; tekse kendiliğinden, yoksa "Banka Hesabı
  Tanımla"); çek ödendiğinde para o hesaptan çıkar (hesap öndolu). SENET: kendi senedimiz bankaya bağlı değildir → "Senet Kullan" işaretli
  hesaplar (a) verilen senedin ÖDENECEĞİ hesap önerisi, (b) alınan senedi/çeki BANKAYA TAHSİLE VER (ertelenen iş) için seçilir. Alınan
  (müşteri) çekinde "Banka / Şube" müşterinin bankasıdır, serbest metin KALIR. Eski çeklerin metni korunur. Yapı Kredi vb. yalnız örnek.
- MÜŞTERİ İSTEĞİ (12.10.2026, ekran: Kasa → "Bankadan Kasaya Aktar", Çekilen Banka Hesabı "Yapı Kredi · TL (YAP-TL)"): "banka bakiyesini
  gösterse iyi olur". ÖNERİ: hesap seçicisinde her hesabın yanında güncel bakiye ("Yapı Kredi · TL (YAP-TL) — Bakiye: 18.160,00 ₺"), seçilen
  hesabın altında "Bakiye: … · Aktarımdan sonra: …" (tutar yazıldıkça güncellenir; eksiye düşecekse kırmızı + K7 kuralı); bakiye seçilen
  TARİHTEKİ bakiye (ileri/geri tarih). Aynı gösterim "Kasadan Bankaya Yatır"da Nakit Kasa bakiyesiyle ve öbür banka hesap seçicilerinde
  (cari tahsilat/ödeme, fatura peşini, transfer, çek ödemesi) — öneri. Yetki: banka bakiyesini görme yetkisi olmayana bakiye gösterilmez.
- MÜŞTERİ İSTEĞİ (12.10.2026, ekran: Yeni Alış Faturası · Stoğa Mal Alışı, ÖDEME bölümü "Peşin Ödeme (₺) · Ödeme Yolu Havale/EFT ·
  Banka Hesabı", düğmeler "+ Peşin Ödeme / Tamamı Peşin / + Çek / Senet / Portföyden Ciro Et"): "peşin ödemede herkesin aklına nakit
  gelir; nakit, havale/EFT, kredi kartı gibi değiştirelim". Daha önce listede YOKTU (yeni madde). KODDAN: hof-invoices.js:898 cashWord
  "Peşin Ödeme"/"Peşin Tahsilat", :920 "Tamamı Peşin". ÖNERİ: "+ Peşin Ödeme" yerine yola göre düğmeler "+ Nakit", "+ Havale / EFT",
  "+ Kredi Kartı" (satışta "+ POS"), "+ Çek / Senet", "Portföyden Ciro Et"; her satırın başlığı yolun adı ("Nakit · Tutar", "Havale / EFT ·
  Tutar · Banka Hesabı", "Kredi Kartı · Tutar · Kurumsal Kart"); "Tamamı Peşin" → "Kalanın Tamamını Öde" (satışta "… Tahsil Et"), tıklanınca
  yol sorulur; bölüm başlığı "Ödeme" kalır. İadelerde ("Müşteriye İade Ödemesi" / "Tedarikçiden İade Tahsilatı") aynı düzen. Veri/kayıt
  biçimi DEĞİŞMEZ (yalnız etiket ve düğme); senaryo testleri metne bağlıysa güncellenir; kılavuz Fatura bölümü ve ekran görüntüsü yenilenir.
- BAŞLADI (kullanıcı, 12.10.2026: "bunları yapmaya başla, müşteri başka talepler iletirse eklerim"): iş listesi `docs/2.2.0-IS-LISTESI.md`
  (İz 1 küçük düzeltmeler · İz 2 banka hesabı/kart/çek/seçiciler · İz 3 POS Aşama 10–11 · İz 4 Bankaya Tahsile Ver). Dal
  `claude/hopeful-goodall-6nmtcj`. Ajanlar worktree'de; ana oturum kırmızı/yeşili ayrı kopyada yeniden koşar, CI'yi kendisi okur.
  KARAR (kullanıcı, aynı gün: "konuştuğumuz müşteri taleplerindeki önerilerini de uygula"): bu konuşmadaki BÜTÜN önerilerim uygulanır
  (Doğrulanmadı metni + neden, kart bankanın içinden, Tanımla düğmesi + yetkisiz yazısı bütün seçicilerde, Çek/Senet/POS Kullan, Çek Hesabı,
  seçicilerde bakiye, ödeme düğmeleri yola göre, POS bankaya bağlı + POS Tanımla, BANKAYA TAHSİLE VER bu sürüme alındı — İz 4).
  SORU (kullanıcı: "çekte de bankaya tahsile ver olmalı mı?") → evet (101.01 → 101.02 → 102; senette de). NOT verdim: program senetleri
  çekle birlikte 101/103'te tutuyor, Tekdüzen'de senet 121/321. KARAR (kullanıcı: "muhasebe mantığı gereği ise onu da uygula") → İz 4.2,
  plan eki §3.11a (alınan senet 121.01/121.02, verilen senet 321); 4.1 birleştikten sonra; kâhin plandan güncellenir.
  KARAR (kullanıcı, aynı gün: "şüpheli alacaklar ve çeki tahsile ver de olsun"): çeki tahsile ver zaten İz 4.1; ŞÜPHELİ ALACAKLAR → İz 4.3,
  plan eki §3.11b (yaygın uygulama: karşılıksız evrak cariye döner; "Şüpheli Alacağa Al" 120→128, Karşılık Ayır 654/129, tahsilde 644,
  Değersiz Alacak Yaz; rapor + rozet + mizan). 4.2'den sonra.
  KARAR (kullanıcı, aynı gün: "kart ifadesi 'Kredi Kartı' olsun, programda"): görünen metinde "Kurumsal Kart"/"Kurumsal Kredi Kartı" →
  "Kredi Kartı" (İz 2.9; banka ekranları ajanına iletildi); satışta kartla tahsilat "POS" kalır; kod/API adları değişmez.
  İSTEK (kullanıcı, aynı gün): "yapılacak işlemleri madde madde sırala, bittikçe üzerini çizerek yeniden ver; testlerin doğru yapıldığını,
  düşen test olup olmadığını bildirimden ayrı olarak 30 dk'da bir denetle" → liste `docs/2.2.0-IS-LISTESI.md`; her madde bitince liste
  ~~üstü çizili~~ yeniden verilir; 30 dk denetimi send_later (trig_01AhNXBCD6wK8CVPyWgEDpbA, her seferinde yeniden kurulur), betik
  scratchpad/denetim.sh (worktree commit'leri + kanit ozet çıkış kodu + ana dal CI). Teslim bitince ya da kullanıcı "durdur" deyince durur.
- KARAR (kullanıcı, 12.10.2026 ~15:15 UTC; ekran: haftalık kullanım %80, sıfırlanma Perşembe 02:00): "şüpheli ticari alacaklar işini erteleyelim,
  iz 4.2 bitince bitiş turuna başlayalım; yayından sonra limit kalırsa şüpheli alacakları yaparız" → İz 4.3 ERTELENDİ (yayından sonra, limit
  varsa); 4.2'nin kontrol turu koşulmadı (birinci tur bulguları düşüktü, düzeltildi; bitişteki yargıç + eleştirmen kapsar). Bitiş turu kullanım
  sınırına göre sade: yargıç + eleştirmen birer ajan; uzun koşular GitHub'da (yerel kullanım harcamaz).
- KARAR (kullanıcı, 12.10.2026 ~18:45 UTC): ölçek 20 kullanıcıda Banka → Hareketler ekrandan kaydedilen masrafı 30 sn'de göstermiyor (iki koşu,
  2.1.0'da yoktu; 10 kullanıcıda yok; para doğru) → "Bilinen sınır, yayından sonra". 2.2.0 KANIT'ta BİLİNEN SINIR; yayından sonra İz 4.3 ile
  birlikte kök neden + düzeltme (ölçek aracı tools/olcek-210.mjs, kayıt docs/kanit/2026-10-12/son-aday-220/olcek-*).
- KARAR (kullanıcı, 12.10.2026 ~19:30 UTC, bilgisayar başında değil): "işlemler bitince paketi, GitHub'a yüklenecek dosyaları teslim et,
  birleştirmeyi yap; geldiğimde 'geldim' derim, verdiğin linkten imzalı sürüm dosyalarını GitHub'a yükleriz"; "hata olursa düzelt ve işlemlere
  devam et" → 2.2.0: uzun koşu sonucu → son commit + CI yeşil → imzalı paket + kurulum → 5 dosya + arşiv teslim → PR → CI/kapı yeşil →
  BİRLEŞTİRME (bu sürüm için kullanıcı izni) → yayın bağlantısı hazır. Hata çıkarsa kural aynı: yeniden üret, kırmızı test, en küçük düzeltme,
  ilgili testler + CI yeşil, sonra devam; yapılanlar teslimde ayrıca yazılır. Yayını açmak/yüklemek kullanıcıda.
- 2.2.0 TESLİM + BİRLEŞTİRME (13.10.2026 ~04:3x UTC): son aday c629758 (CI #660 push + #661 PR YEŞİL; Uzun Doğrulama 23/23) → PR
  ceougur/ofis---y-netimi#28 squash → `master` = b24e0c2 (ağaç c629758 ile AYNI). İmzalı paket destekofis-guncelleme-2.2.0.zip 2afaecfb…,
  bildirge json 4d6aa76f… (anahtar destekofis-2026-1; 2.1.0/2.0.26/2.0.19/1.7.0 "uygun", kurcalanmış bildirge reddedildi; zip = HEAD 241/241),
  kılavuz PDF 07435148… (DEĞİŞTİ → yayından sonra site PR'ı), kurulum .exe 7e8424bd… (35,4 MB, simgeli; 30 MiB gönderim sınırını aştığı için
  İKİ PARÇA gönderildi: `copy /b …parca0 + …parca1 DestekOfis-Kurulum.exe`). Arşiv 4 parça (1 belge+kanıt, 2–4 git bundle parçaları; birleştirilip
  klonlandı). SIRADA: kullanıcı "geldim" → yayın açar (tag v2.2.0 → master, başlık "DestekOfis 2.2.0", not "İyileştirmeler ve POS entegrasyonu",
  5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" → site kılavuz PR'ı (ceougur/destekofis web/indir/). Sonra (limit varsa):
  İz 4.3 Şüpheli Alacaklar, ölçek-20 kök neden, 2.1.0/2.2.0 kapsam ölçümü; Cuma 16.10 planlı test.
  YAYIMLANDI (13.10.2026 ~05:29 UTC; `v2.2.0` = b24e0c2; yayımdan önce kullanıcının ekranındaki 5 ad/boyut teslimle karşılaştırıldı): yayındaki
  5 dosya + latest/ (json, zip, pdf, exe) teslimle bayt bayt aynı, exe .sha256 OK; gerçek eski güncelleyiciler (v2.1.0, 2.0.26, 2.0.19, 2.0.17
  API + yedek yol; 2.0.4, 1.7.0 API — yedek yol 2.0.17'den beri) canlı GitHub'da 2.2.0'ı "available" gördü, indirilen paket 2afaecfb… eşleşti;
  2.2.0 → "up-to-date". NOT: deneme betiği `HUKUK_BOOTSTRAP_VERSION=2` (gerçek kurulumun bootstrap.mjs değeri) vermeyince "incompatible" çıkar
  — ürün değil test ortamı (ders 14). Site kılavuz PR'ı ceougur/destekofis#13 BİRLEŞTİ (kullanıcı "birleştir", main 831d903; main PDF 07435148… doğrulandı; canlı site ağ politikasıyla okunamadı). release.yml
  koşu 38351603781 sürümlü exe ekleyecek.
- KUSUR (13.10.2026, baş mimar fark etti): yayımlanan 2.2.0 kılavuz PDF'inin kapağında "Sürüm 2.1.0" yazıyor (kaynak
  docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html:14 elle; içerik 2.2.0 — POS/Tahsile Ver var). pdf-denetle sürüm etiketini denetlemiyor.
  KARAR (kullanıcı, 13.10.2026: "kılavuzda gördüğün sorunları düzelt") → DÜZELTİLDİ: kapak + dip not 2.2.0; test/kilavuz-surum.test.mjs (kaynak
  HTML sürümü = package.json; eski hâlde 2/2 kırmızı) + pdf-denetle "PDF kapağı ve dip notu program sürümü" (eski PDF'te kırmızı, yeni 39/39);
  PDF metin farkı yalnız bu iki satır; yeni PDF sha256 21b262c1…. Yayındaki kılavuz kullanıcı tarafından değiştirildi (v2.2.0 + latest 21b262c1… doğrulandı; öbür 4 dosya bayt bayt aynı); site PR ceougur/destekofis#14 BİRLEŞTİ (de0153e, main PDF doğrulandı);
  programın içindeki kopya (client/kilavuz) bir sonraki sürümle gider (2.2.0 kurulumlarında kapak 2.1.0 kalır).
- İSTEK (kullanıcı, 13.10.2026): satışa yardım eden arkadaş için müşterilere paylaşılacak TANITIM/REKLAM METNİ → `docs/pazarlama/TANITIM-METNI.md`
  (kısa WhatsApp + uzun; iddialar 2.2.0 kılavuzundan doğrulandı; e-Fatura, bulut, 2+ şirket VAAT EDİLMEZ). Site metni (ceougur/destekofis
  web/index.html) eski: "oturum", sektör vurgusu; banka/POS/çek/mizan yok — güncelleme önerisi verildi.
  İSTEK (kullanıcı, aynı gün): kısa metne LOGO → logolu görsel `docs/pazarlama/DestekOfis-Tanitim.png` (1080×1350; marka işareti
  client/assets/brand/destekofis-mark.svg, Manrope/DM Sans); iletişim: 0536 771 50 55 · https://destek-ofis.vercel.app/ (kullanıcı verdi).
- AÇIK (13.10.2026): WINDOWS NODE 22 GÜNCELLEYİCİ ARA SIRA KIRMIZI — iki ayrı test, aynı gün, yalnız Windows Node 22: (a) CI 60ed59d
  test/updater.test.mjs:151 ikinci check() "error" (2316/2317); (b) CI #690 a53a4bc (yalnız kanıt dosyası değişti) test/guncelleme-hazir-geri-cekilen
  (2): 9.0.1 kuruldu, 9.0.2 etkinleşmedi ama geçmişte "prepared-withdrawn" kaydı YOK (2321/2322) — aday: saveState'in writeJsonAtomic'i Windows'ta
  (okuyucu dosyayı açıkken rename EPERM) 12 denemede de yazamayıp yalnız uyarı yazması (updater.mjs:106) → geçmiş olayı sessizce kaybolur.
  Linux'ta üretilemedi (ders 18). İki teste de teşhis eklendi (gelen neden / geçmiş + açılış günlüğü satırları mesaja yazılır). Yeniden görülünce
  günlükle kök neden + zorla üretme (ders 20); saveState yazamazsa olay kaybı ürün hatasıdır (yeniden deneme / kuyruk gerekir). Ürün etkisi: elle
  denetim 3 deneme, otomatik denetim saatte bir; geçmiş kaydı bilgi amaçlı.
  (a) KAPANDI (15.10.2026; üçüncü görülüş CI 037fcc7 Windows Node 22, aynı kodla sonraki koşu yeşil): KÖK NEDEN keep-alive yarışı — sunucu boşta kalan
  bağlantıyı tam istemci yeniden kullanırken kapatıyor (Windows ECONNRESET, Linux undici UND_ERR_SOCKET "other side closed"); Windows'ta stage() yavaş
  olduğu için ikinci denetim 5 sn boşta kalma sınırına denk geliyor. Zorla üretme (ders 20) `test/guncelleme-230-baglanti-sifirlama.test.mjs`
  (mock GitHub `resetOnReuse`: yeniden kullanılan bağlantıdaki ikinci isteği koparır; eski kodda 3/6 denetim "error", yeni 6/6). Düzeltme updater.mjs
  request(): yalnız kopan bağlantı sınıfında istek yeni bağlantıyla bir kez hemen yinelenir. (b) KÖK NEDEN BULUNDU (15.10.2026 ~23:00 UTC; CI #744/#745 cd63cf6 Windows 22+24 üç kez): saveState DEĞİL — test yayın listesini değiştirip servisi
  durdururken periyodik denetim (600 ms) araya giriyor; ürün geri çekilen 9.0.2'yi 9.0.1 ile değiştiriyor ama çalışma anı yolunda "prepared-withdrawn" kaydı
  yoktu. ÜRÜN düzeltmesi update-orchestrator withdrawPreparedIfGone; testler "açılışta" senaryolarında yayını servis durduktan sonra değiştirir; zorla üretme
  (2b) eski kodda 0/1. (d) zipHits 2 de aynı yarış (çalışırken başlayan indirme kesilip açılışta yinelenir). Ders 18: Windows'ta iki yeşil koşu sonra KAPANDI.
  PAKET: ürün kodu değiştiği için 2.3.0 paketi/kurulumu/arşivi son commit'ten YENİDEN üretilip gönderilir (d7e66bd paketi geçersiz).
- KAPANDI (13.10.2026 akşam): CI #684 bc36256 senaryo-pos-220 "Ürün B 15/3/6/5" — KÖK NEDEN testin ürün seçici yarışı (ders 20 ile zorla üretildi:
  son arama yanıtı 1,5 sn gecikince + tuş aralığı 260 ms → ara arama [Ürün A, Ürün B] listeler, test ilk satıra basar → Ürün A satılır; tutar/cari/
  banka doğru, yalnız stok). Düzeltme: pos-220 kimlikle seçer + "Stokta" bağ denetimi + gelen değer mesajda + `POS220_YARIS=1` zorla kipi;
  215/216/217/222 `li[data-item]:has-text(ad)`. ÜRÜN düzeltmesi (küçük): pickItem geç gelen arama yanıtını iptal eder (liste seçimden sonra
  yeniden açılmıyor). Kanıt docs/kanit/2026-10-13/pos220-yaris-*.
- MÜŞTERİ İSTEĞİ (13.10.2026, emlakçı; ekran: kayıt detay kartı → Belgeler, resim satırında Görüntüle/Yazdır/İndir/Sil): "WhatsApp'tan Paylaş"
  simgesi → karttaki resimler + detay kartındaki bilgiler müşteriye gönderilsin. Soru: yapılabilir mi, maliyet, iş yükü, süre. KODDAN: WhatsApp
  bugün wa.me ile YALNIZ METİN açar (hof-whatsapp.js:13; dosya eki resmî yolla ancak Meta Business API — Pro, ileride); personel bilgisayarı
  sunucuya http://<ip>:5123 ile bağlanır (launcher/discovery.go) → güvenli bağlam değil: tarayıcının dosya paylaşımı (navigator.share) ve
  panoya resim kopyalama orada KAPALI; launcher Edge/Chrome uygulama penceresini kendisi açar (platform_windows.go) → bayrakla açılabilir,
  gerçek Windows'ta denenmeli (ders 18). ÖNERİ (karar kullanıcıda): Yol A ücretsiz — "WhatsApp'ta Paylaş" penceresi: alan seçimi + metin
  ön izleme + resim seçimi → Windows Paylaş penceresi (WhatsApp masaüstü) ya da yedek "metni aç + resimleri panoya/indir, sohbete yapıştır";
  Gönder'e kullanıcı basar; bütün sektörlere (Standart). Yol B Meta Business API (tam otomatik; Meta ücreti + işletme doğrulaması; Pro, ayrı iş).
  DÜZELTME (kullanıcı, aynı gün): alıcı numarası karttan GELMEZ (karttaki numara genelde ev sahibinin) → alıcı alanı boş gelir, kullanıcı
  müşteri numarasını yazar (öneri: son alıcılar + Cari'den seç). SORU: metin + resimler sohbete hazır yüklü gelebilir mi (API'siz)? CEVAP: numaraya
  hem metin hem çok resim tek adımda yalnız API ile; API'siz en yakın: (1) Windows Paylaş → WhatsApp: metin + resimler hazır, kişi WhatsApp'ta
  seçilir (yeni numara için önce wa.me ile sohbet açılır); (2) wa.me: numara + metin hazır, resim yapıştırılır; (3) öneri: bilgiler + resimler
  tek "Portföy Sunumu" PDF/görsel → wa.me + tek dosya. Gerçek Windows + WhatsApp masaüstünde denenmeden söz verilmez.
- DEVİR MODÜLÜ (yıl sonu devri; 13.10.2026'da YENİ madde — önceden listede yoktu): BÜTÜN BİLGİ `docs/devir/DEVIR-MODULU.md` (Wolvox ekranlarının
  dökümü, satış arkadaşının anlatımı, diğer programlar, iki kipli öneri, bakiye tipi örneği, görüş soruları, mevcut altyapı, riskler) + tablo
  `docs/devir/DestekOfis-Devir-Plani.png/.pdf`. KARAR BEKLENİYOR (kullanıcı: "arkadaş düşünüp kararı iletecek; bizim yöntem mi Wolvox yöntemi mi
  karar verilince ona göre yaparız"). Hatırlatıcı 22.10.2026 Perşembe 09:00 TR (trig_01NEGfcTp7hAnHG1tgw6mFAv). Kullanım sınırı (13.10 %83):
  para çekirdeğine dokunan iş Perşembe 02:00 sıfırlamasından önce başlatılmaz.
- FATURA / e-BELGE (EDM) (kullanıcı, 13.10.2026): EDM'den API belgeleri + test/canlı adresleri geldi → BÜTÜN BİLGİ `docs/fatura/E-BELGE-EDM.md`
  ("fatura modülünü yap" denince oradan başlanır). Plan: XML uygunluğu (şema/şematron, ağsız) → EDM test ortamı → kullanıcı "entegre et" → açma.
  Test kimlik bilgisi depoya YAZILMAZ. Bu ortam test.edmbilisim.com.tr'ye bağlanamıyor (ağ politikası) → izin ya da GitHub Actions; karar kullanıcıda.
- SIRA (kullanıcı, 13.10.2026): Perşembe (sıfırlamadan sonra) → (1) banka kalan işleri — ŞÜPHELİ ALACAKLAR (İz 4.3, plan §3.11b) DAHİL
  (kullanıcı: "banka kalan işlerine say") + ölçek-20 kök neden ve öbür ertelenen banka maddeleri → (2) fatura/e-Belge (EDM) → (3) devir modülü.
  WhatsApp paylaşımı (emlakçı isteği) ŞİMDİLİK BEKLER (kullanıcı: "şimdilik kalsın").
  2.3.0 BANKA EKSTRESİ (ekstre yükleme + eşleştirme) LİSTEDEN ÇIKTI (kullanıcı, 13.10.2026: "müşteri portföyüm pek ilgilenmez, sonra ihtiyaç
  duyulursa yaparız") — plan bölümü yerinde kalır, ihtiyaç olursa açılır.
- BAŞLADI (kullanıcı, 13.10.2026 ~21:00 TR: "fable'a geçtim, başla"): model Fable 5.1 (ayrı haftalık sınır, %0 → Perşembe beklenmedi). İş listesi
  `docs/2.3.0-IS-LISTESI.md` (İz 0 açık kırmızılar · İz 1 Şüpheli Alacaklar · İz 2 ölçek-20 kök neden · İz 3 K8 taksit, bankalı iade/iptal §4.6, §8.10
  kalan raporlar, fatura ayarları banka · İz 4 döviz §3.12 — kapsam kararı kullanıcıda). Ajanlar worktree'de (İz 1, İz 2, İz 3.1 paralel); ana oturum
  kırmızı/yeşili ayrı kopyada yeniden koşar, CI'yi kendisi okur. Sürüm no paketlemede (2.3.0 önerilir).
  DURUM (13.10 ~22:30 UTC): İz 3.1 K8 birleşti (972daa3) ve ana oturum doğruladı (eski kopya 0/16 kırmızı, yeni 16/16, komşu 71/71, e2e k8-230
  17/17, banka-210 408/408; CI okunacak). İz 2 kök neden: ürün DEĞİL, ölçek aracının soru-bekleme adımı (d0a442a; zorla üretme CI'de) — 20 kullanıcı tam
  koşusu son adayda. İz 1 çekirdek ajan worktree'sinde commit (217410f), ajan sürüyor. İz 3.2+3.4 ve 3.3 ajanları başlatıldı; 3.1b kâhin K8 İz 1.8 ile.
  KARAR (kullanıcı, 13.10.2026 ~23:30 UTC: "1"): DÖVİZ (İz 4, plan §3.12) ERTELENDİ — 2.3.0 dövizsiz çıkar (Şüpheli Alacaklar + K8 + bankalı
  iade/iptal + kalan raporlar + düzeltmeler); döviz isteyen müşteri çıkınca yapılır; `fxEnabled` kapalı sürer. İz 1 çekirdek birleşti (5de225f), ana
  oturum doğruladı (86b061b kanıt); 1.6/1.7 ekran+rapor+e2e ve 1.8 kâhin sürüm 4 (+K8) ajanları başladı.
  DURDURULDU (kullanıcı, 13.10.2026 ~20:00 UTC: "perşembe gününe göre ayarla ve işlemleri durdur"): dört ajan (İz 3.2+3.4, 3.3, 1.6/1.7, kâhin 4)
  erken aşamada durduruldu, yarım işler `docs/2.3.0-WIP-13.10/*.patch` + OKU-BENI; CI beklemeleri kesildi (91bd774, 5de225f, 86b061b CI'si
  PERŞEMBE ilk iş `node tools/kanit.mjs ci <sha>` ile okunur — ders 21; 3.1 K8 ve 1.1–1.5 ancak o zaman üstü çizilir). Hatırlatıcı Perşembe
  15.10.2026 09:00 TR. Devam sırası: CI oku → yamaları uygula/ajanları yeniden başlat (3.2+3.4, 3.3, 1.6/1.7, kâhin 4) → bitiş turu.
- 15.10.2026 "başla": CI dördü yeşil → 3.1 ve 1.1–1.5 kapandı (012c8d3); dört ajan yamalarla yeniden başlatıldı.
- MÜŞTERİ TALEPLERİ TURU (kullanıcı, 15.10.2026: "düzeltme ve ekleme taleplerini tek tek atıyorum; hepsini atınca planlamaya alıp başlarsın") —
  liste tamamlanana kadar YALNIZ KAYDEDİLİR, iş başlatılmaz; hepsi gelince plan sunulur:
  1. (ekran: Banka → Hareketler listesi, süzgeçler + tablo) "buraya PDF koysak iyi olur" → Hareketler listesinin seçili süzgeçlerle PDF (ve Excel) çıktısı.
     KODDAN: hof-bank.js Hareketler sekmesinde PDF/Excel düğmesi YOK; aynı veri Rapor Merkezi "Banka Hareket Raporu" (banka-hareket) ile PDF/Excel
     alınabiliyor ama ekranda bağ yok. Öneri: sekmeye "PDF" + "Excel" düğmeleri (aynı süzgeçlerle, rapor altyapısı; TOPLAM satırı; yetki bank.reports
     yoksa bank.view ile yalnız kendi gördüğü liste).
  2. (ekran: Rapor Merkezi → POS Ödeme Takvimi, Başlangıç 01.10.2026 işaretli) "tüm raporlarda / POS Ödeme Takvimi'nde Başlangıç ilk açılışta 1976
     geliyor; Tüm Zamanları Göster deyince de 1976'ya atıyor ve boş geliyor". KODDAN: `finance-report.mjs:172` presetRange("all") = bugün − 50 yıl
     (→ 1976) — Tüm Zamanlar'da Başlangıç alanı bu tarihi gösteriyor; vade raporları (POS Ödeme Takvimi, çek/senet) ilk açılışta "all" ile açılıyor
     (hof-report-center.js:162). Boşluk: takvim yalnız BANKAYA GEÇMEMİŞ kalemleri gösterir; ekranda bekleyen yoksa boş (14.10 valörü geçmiş 495 TL
     Hareketler'de) — ama kullanıcı boşluğu 1976'ya bağlıyor, ekran anlatmıyor. Öneri: Tüm Zamanlar'da Başlangıç alanı BOŞ ("başlangıç yok") ve
     dönem metni "Tüm Zamanlar"; takvim boşken "Bekleyen POS kalemi yok; geçenler Banka → Hareketler'de" ipucu + bağ; bütün raporlarda 1976 görünmez.
  3. YENİ RAPOR: "POS Komisyon (Provizyon Kesintisi) Raporu" — aylık/yıllık/tarih aralığına göre POS başına kesilen komisyon (brüt, komisyon, BSMV/KDV,
     net; iade komisyonu ayrı; TOPLAM; PDF/Excel; her süzgeç). KODDAN: Rapor Merkezi'nde bugün yalnız banka-pos-hareketleri ve pos-odeme-takvimi var;
     plan §8.10'daki "POS Satış Raporu / POS Komisyon Raporu" (kip ve vergi ayrımıyla; İptal İadeleri ayrı satır) henüz yok → İz 3.3 kapsamına eklenir
     (ajana iletilir).
  4. (ekran: Rapor Merkezi sol liste: Kasa, Ana Defter, Banka, …) "rapor sıralamasını programa uygun yapalım: önce Cari, sonra Kasa, Stok, Fatura,
     Çek/Senet, Taksit, Banka". KODDAN: sıra tanım sırasıyla geliyor (report-center.mjs grupları: Kasa, Ana Defter, Banka, Cari, Fatura, Taksit,
     Çek / Senet, Stok, Kayıtlar, Ofis). YENİ SIRA: Cari · Kasa · Stok · Fatura · Çek / Senet · Taksit · Banka · Ana Defter · Kayıtlar · Ofis (son üçü
     kullanıcı saymadı, sona). Grup sırası tek listede (sunucu) tanımlanır; senaryo-211/rapor e2e beklentileri güncellenir ve koşulur (ders 28).
  5. "Sol sabit menünün üstüne ARAMA penceresi: 'Alış f' yazınca alış faturasıyla ilgili modüller, 'cari h' yazınca Cari Hareket Raporu, 'çek'
     yazınca çekle ilgili şeyler gelsin". KODDAN: bugün genel arama/komut paleti YOK (yalnız sayfa içi aramalar). Öneri: menü üstünde "Ara" kutusu
     (+ Ctrl+K): sayfalar/sekmeler, işlemler ("Yeni Alış Faturası", "Şüpheli Alacağa Al"…), bütün raporlar ve ayar bölümleri tek dizinden; sözcük
     başı eşleşme ("alış f" → Alış Faturaları, Yeni Alış Faturası, Alış Faturası Raporu), Türkçe harf duyarsız (ı/i, ş/s); sonuç yalnız yetkisi
     olanlar; Enter ile açılır; dizin sunucudan değil istemcideki menü/rapor tanımlarından (rapor listesi API'den). Cari/kayıt adı araması bu
     kutuya girmez (ayrı, sonra).
  6. (ekran: kayıt detay kartı → işlem geçmişi "Araç haczi · düşüm 14.10.2027") "işlem geçmişindeki kayıtları düzeltebilmeli ve X ile silebilmeliyiz;
     3'ten fazlaysa 'daha fazla göster'". KODDAN (hof-workspace.js ~1008): geçmiş türleri not / telefon / tahsilat / taksit hareketi / haciz / görev;
     yalnız TAHSİLATTA düzelt/sil var; not, telefon ve haciz için sunucuda yalnız POST (workspace.mjs:346, 359, 486), düzelt/sil ucu YOK; liste
     sınırsız uzuyor. Plan: her satırda Düzelt + X (not/telefon/haciz: yeni PUT/DELETE + audit + Silinenler; taksit hareketi ve görev kendi
     modülünden — satırda "Kayda Git"); ilk 3 satır + "Daha Fazla Göster (n)". Yetki: kayıt düzenleme yetkisi.
  KARAR (kullanıcı, 15.10.2026: "bu son müşteri talebiydi; hepsini pakete ekle, işlem bitince yükleyelim, canlıya alalım") → 1–6 2.3.0 kapsamına
  (İz 5, `docs/2.3.0-IS-LISTESI.md`); 2.3.0 bitince teslim düzeniyle yayın (kullanıcı yükler).
- KARAR (kullanıcı, 15.10.2026 ~19:30 UTC): kılavuzda hap bilgi "Ticari Şüpheli Alacaklar" başlığında (9. Cari altındaki bölüm başlığı
  "Şüpheli Alacak" → "Ticari Şüpheli Alacaklar"; içerik zaten hap bilgi); 2.3.0 SÜRÜM NOTU = "İyileştirmeler ve Ticari Şüpheli Alacaklar
  Eklentisi" (CHANGELOG başlığı + GitHub yayın metni; güncelleyici notu CHANGELOG gövdesinden). Rapor adı "Şüpheli Alacaklar" (program) değişmedi.
- OPERATÖR MERKEZİ "SÜRÜM 9.0.0" (kullanıcı sorusu, 15.10.2026): yayımlanmış 9.0.0 yok; lisans.installations'ta 3 kayıt (30.09 7b44b046…, 12.10 38efc2d5…,
  15.10 07:04 UTC db54a00b…), hepsi Microsoft Azure = GitHub Actions; makeVersion ile 9.0.0 olarak paketlenen GERÇEK program CI'de açılıp kendiliğinden
  deneme başlatmış (ders 30). Etki: yalnız operatör listesinde sahte "Adı yazılmamış ofis" satırları ve servis istekleri; müşteriye etkisi yok. Adsız 2.2.0
  kayıtları (88.225…, 178.233…, 88.241…) Türkiye adresleri = GERÇEK demo kullanıcıları. Düzeltme: testlere ölü adres + tarama testi. Sahte 3 kaydın
  silinmesi (installations + events) kullanıcı kararı; silinmedi. KARAR (kullanıcı, 15.10.2026): "zararsızsa dursun, tekrarı olmasın; basit işler için kod
  tabanına dokunmayalım" → 3 kayıt DURUR (silinmez); önlem yalnız testlerde (210ac8e; ürün kodu değişmedi); operatör verisine dokunulmaz.
- KONTROL TURU 2 (15.10.2026 ~16:45 UTC; kullanıcı "yargıç/eleştirmen geride mi kaldı?"): 469d547 sonrası 12 dosya; K1 YÜKSEK kapsayan kart
  taksiti (düzeltildi), K2 geri yükleme çakışması açık 409, K3 düzeltmede yanlış 409 (düzeltildi) — test supheli-230-kontrol2 0/3 → 3/3; K4–K7
  BİLGİ (KANIT'a). YENİ SON ADAY = 91e6dea; Uzun Doğrulama #225 (6312e8b) iptal, 91e6dea'da yeniden (~16:58 UTC). Ders 32.
- UZUN DOĞRULAMA #230 (91e6dea) 23/23 + kapı YEŞİL (15.10.2026 20:02 UTC; KANIT satırı dolduruldu, B.1 kapandı). Ürün kodu 91e6dea; üstüne yalnız belge/kılavuz/CHANGELOG/pdf-uret (6f0d309) ve kanıt. SIRADA: imzalı paket (release.mjs --anahtar yüklenen pem) + build:windows → 5 dosya + arşiv teslim → PR → kullanıcı "birleştir" → yayın (kullanıcı) → bayt bayt + güncelleyici "available" → site kılavuz PR'ı (yeni PDF: "Ticari Şüpheli Alacaklar").
- TESLİM BİÇİMİ (kullanıcı, 15.10.2026 ~20:20 UTC, 2.3.0 için teyit): GitHub'a yüklenecek İMZALI 5 dosya AYRI AYRI verilir; birleştirmeleri (PR → master) ben yaparım, dosyaları kullanıcı yükler. Kurulum .exe 30 MB'ı aşarsa İKİ PARÇA (parca0 + parca1) + "BIRLESTIR.md" (copy /b komutu + beklenen sha256) verilir.
- 2.3.0 TESLİM (15.10.2026 ~21:20 UTC): paketlenen commit d7e66bd (ürün kodu 91e6dea); imzalı zip 2de92b82…, bildirge cd356847…, kılavuz PDF 879d1df4…, kurulum exe 6f0c61a6… (37,2 MB → iki parça + BIRLESTIR.md); arşiv 4 zip (1 belge+kanıt, 2–4 bundle parçaları; birleştirilip klonlandı). Dosyalar kullanıcıya gönderildi; PR açıldı (ceougur/ofis---y-netimi, master). SIRADA: PR CI + kapı yeşil → squash birleştirme (kullanıcı izni: "sen birleştirmeleri yapınca ben yüklerim") → kullanıcı yayın açar (v2.3.0, 5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" → site kılavuz PR'ı (ceougur/destekofis web/indir/). Sonra: İz 4.3? (yok — bitti), ölçek-30/1M planlı test Cuma 16.10, güncelleyici (b) saveState yarışı, kapsam ölçümü.
- AÇIK (15.10.2026 21:58 UTC): CI #742 aed598e Windows Node 24 guncelleme-gercek S2 kırmızı (PR koşusu #743 aynı commit yeşil). Mekanizma: testin etkinlik pingi bir önceki isteği bekliyordu, takılan tek istek 4 sn boşluk açtı, sunucu haklı olarak kurdu (ürün doğru). Düzeltme test yardımcısında (zamanlayıcılı + zaman aşımlı pingler + istatistik; zorla üretme GUNCELLEME_S2_ZORLA_BOSLUK=1). İsteğin CI'de neden takıldığı (ağ/yük/ürün) yeni tanılamayla bir sonraki görülüşte okunur; ders 18 gereği Windows'ta iki yeşil koşu görülmeden kapanmaz.
- 2.3.0 BİRLEŞTİ (15.10.2026 23:46 UTC): PR ceougur/ofis---y-netimi#29 squash → `master` = ec1ef3f (ağaç 7888371 ile AYNI; CI #746 push + #747 PR yeşil, Windows 22+24 ikisinde de → güncelleyici (b) ve (d) kırmızıları KAPANDI). İmzalı paket 7888371'den: zip 3cf3b956…, bildirge b38ffd12…, kılavuz PDF 879d1df4…, kurulum exe 2aa3d03f… (iki parça + BIRLESTIR.md); arşiv 4 zip. Dosyalar kullanıcıya YENİDEN gönderildi (d7e66bd paketi geçersiz). SIRADA: kullanıcı yayın açar (v2.3.0 → master, "DestekOfis 2.3.0", not "İyileştirmeler ve Ticari Şüpheli Alacaklar Eklentisi", 5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" → site kılavuz PR'ı (ceougur/destekofis web/indir/, PDF 879d1df4…). Sonra: ölçek-30/1M planlı test Cuma 16.10, kapsam ölçümü, K4/K5 2.3.1 adayları, S2 ping tanılamasının CI'de okunması.
- 2.3.0 YAYIMLANDI (16.10.2026 ~00:30 UTC; `v2.3.0` = ec1ef3f; yayımdan önce kullanıcının ekranındaki 5 ad/boyut teslimle karşılaştırıldı): yayındaki 5 dosya + latest/ teslimle bayt bayt aynı, exe .sha256 OK; gerçek eski güncelleyiciler (v2.2.0, v2.1.0 kodu) canlı GitHub'da 2.3.0'ı "available" gördü, 2.3.0 → "up-to-date". Kurulum parçaları için BIRLESTIR.bat (çift tık: copy /b + certutil sha256) verildi — bundan sonra her teslimde parçalarla birlikte. Site kılavuz PR'ı ceougur/destekofis (dal main'den yeniden başlatıldı; PDF 879d1df4…) ceougur/destekofis#15 BİRLEŞTİ (kullanıcı "birleştir", 16.10 ~00:45 UTC; main 462df1c, main PDF 879d1df4… doğrulandı). 2.3.0 KAPANDI; sonra: ölçek-30/1M planlı test Cuma 16.10, kapsam ölçümü, K4/K5 2.3.1 adayları, S2 ping tanılaması.
- SIRADAKİ İŞ (kullanıcı, 16.10.2026: "K4 ve K5 ile birlikte fatura modülü… oradan devam edeceğiz"): `docs/fatura/E-BELGE-EDM.md` + K4/K5 (2.3.1
  adayları, `docs/2.3.0-KANIT.md`). Adım 1 (XML uygunluğu) başladı: GİB paketleri yeniden indirildi (sha256 12901476…/97a6f705… eşleşti), OASIS
  UBL 2.1 XSD (60b80d76…), EDM örnekleri açıldı; GİB şematronu XPath 2.0 (matches) → Saxon gerekir; SchXslt bu ortamdan indirilemiyor (GitHub 403,
  Maven'de yok) → araç seçimi sürüyor (SaxonJS/xmllint-wasm devDependency, lisans test için uygun).
  TASLAK (kullanıcı, aynı gün; ekran görüntüsü, yalnız görsel): Fatura sayfasında "Entegratör Ayarları" düğmesi → "e-Dönüşüm ve Entegrasyon Ayarları"
  kartı (sekmeler Entegrasyon Bilgileri / Firma / Etiket Tanımları / Otomatik Seriler; Entegratör, Ortam, Kullanıcı Adı, Parola, GB, PK, üç
  onay kutusu, Bağlantıyı Test Et, Kaydet, Durum satırı). KODDAN: arka uç hazır (Fatura Ayarları → "e-Belge Bağlantısı", edocEnabled kapalıyken
  gizli; parola secret-box ile şifreli, istemciye dönmez; senderAlias, autoSend, series, seller). Değerlendirme kullanıcıya verildi (GB/PK etiketleri
  taslakta ters; Canlı Ortam "entegre et"e kadar seçilemez; otomatik gönder varsayılan kapalı ve düğme "Kaydet ve Gönder" olur; firma/seri tek
  kaynak; yazım düzeni). ONAYLANDI (kullanıcı, aynı gün: "düzeltilmesi gerekenler uygun, kullanacağın gerekli araçları edin"; test şifresini
  "buraya yazayım" dedi → dosya olarak yüklemesi istendi). İş listesi `docs/2.4.0-IS-LISTESI.md`. İz 1 (XML uygunluğu) BİTTİ: kâhin aracı
  tools/ebelge (xmllint-wasm + SaxonJS + SchXslt, Java yok), test ebelge-uygunluk 53/53, eski kodda 45/52 kırmızı; üç kusur düzeltildi (boş imza
  yuvası, istisna 308 → 304 — GİB'de 13/a = 304, iade referansı DocumentTypeCode IADE + 16 hane ön denetimi).
  İz 3 K4/K5 BİTTİ (8bc680b): iptal penceresi + bildirim + işlem kaydı; çakışma iletisi tarih/tutarla, "TL". İz 2 Entegratör Ayarları kartı
  BİTTİ (b5b45ad): 3 sekme, GB/PK EDM'den, Canlı Ortam kilidi (ekran + sunucu + bağlantı katmanı; yalnız config.edocLive), Durum satırı,
  e2e senaryo-entegrator-240 CI'de. Ayrıca e2e tarih tuzağı (ders 13) düzeltildi (0d83358). İz 4 EDM TEST ORTAMI YAPILDI (16.10.2026; kullanıcı
  test kimliğini dosya olarak yükledi — uploads/…edm-test..txt; depoya/kanıta girmedi, taranarak denetlendi): gerçek serviste e-Arşiv gönder/iptal ve
  e-Fatura alıcıya ulaştı; 4 kusur düzeltildi (CheckUser DOCUMENT_TYPE, "erreceipt", çoklu PK seçimi, işlenirken iptal). Bu ortamda Node fetch için
  NODE_USE_ENV_PROXY=1 + NODE_EXTRA_CA_CERTS gerekir. KARAR (kullanıcı, 16.10.2026: "yap"): VEKİL SUNUCU desteği bu sürüme — program Windows
  makine geneli (WinHTTP) ayarını kendiliğinden kullanır + Entegratör Ayarları'nda elle "Vekil Sunucu" alanı; güncelleme, lisans, E-Tablolar, EDM aynı
  yoldan (server/lib/net-proxy.mjs). Not: hizmet "NT SERVICE\DestekOfis" hesabıyla çalışır, kullanıcının tarayıcı vekil ayarını görmez → WinHTTP. YAPILDI (İz 5, `docs/2.4.0-IS-LISTESI.md`): ayar Yönetim → Sistem → Ağ Bağlantısı'nda (makine geneli; e-Belge kapalıyken de görünür),
  Entegratör kartında yol satırı; testler Linux + Windows (CI'de gerçek netsh winhttp). BİLİNEN SINIR: PAC/WPAD ve NTLM vekil yok; gerçek ofis vekilinde denenmedi.
- KARŞILAŞTIRMA (kullanıcı, 16.10.2026; Wolvox "e-Fatura/e-İrsaliye Ayarları" ekranları — "fikir vermesi için; EDM tek seçenek, ona takılma"): koddan
  değerlendirme verildi, KARAR BEKLENİYOR. Bizde VAR: senaryo varsayılanı, gönderim tipi (ELEKTRONIK/KAGIT), GB/PK, not → Note, yazıyla tutar
  (amountInWords), vade (PaymentDueDate), IBAN (PaymentMeans), sipariş/irsaliye no referansı, stok kodu, otomatik gönder, e-Arşiv e-postası, bağlantı testi.
  EKSİK (öneri sırası): (1) e-Belge görüntü tasarımı (XSLT: logo, banka, alt not — "e-Fatura Script") — bugün EDM'nin varsayılan görüntüsü;
  (2) gönderilen belgenin RESMÎ görüntüsünü (EDM GetInvoice PDF) faturanın Belgeler'ine ekleme — bugün yalnız kendi PDF'imiz; (3) şahıs firmasında
  (TCKN) ticari unvan e-Belgeye girmiyor (ubl-tr.mjs: person → PartyName yazılmıyor) — küçük düzeltme; (4) cari bakiyesini nota ekle (seçenek);
  (5) peşin/kapalı faturada ödeme şekli kodu (nakit 10, kart 48) — bugün banka varsa 42, yoksa 1; (6) EDM portalına taslak yükleme (seçenek);
  (7) opsiyonel alanlar (seri/lot, garanti, kalem açıklaması → AdditionalItemProperty). Kapsam dışı: e-İrsaliye, e-Müstahsil, ÖTV, IMEI/tıbbi cihaz,
  ayrı SMTP (EDM e-Arşiv e-postasını kendisi gönderir), portal kullanıcısı (web servis yeterli).
  KARAR (kullanıcı, 16.10.2026: "önerini yap") → 1, 2, 3 YAPILDI (İz 6, `docs/2.4.0-IS-LISTESI.md`; gerçek EDM test ortamında EDM belgeyi
  bizim şablonla çizdi — kanıt docs/kanit/2026-10-16/edm-gorunum); 4–7 bekler. Resmî PDF veri tabanına değil veri klasörüne (yedek şişmesin).
  CI #761 d133455 YEŞİL (4 platform + e2e + kapı). İSTEK (kullanıcı, aynı gün): kendi şirketinin faturasında kullanmak için DestekOfis logosu →
  `docs/pazarlama/DestekOfis-Logo-Fatura-Yatay.jpg` (1000×300) ve `-Kare.jpg` (600×600); marka işareti + Manrope; program ikisini de kabul etti.
  KARAR (kullanıcı, aynı gün: "kalan 4 madde … isteğe bağlı olarak olsun") → cari bakiyesini nota ekleme, ödeme şekli kodu, EDM portalına taslak
  yükleme, kalemde Seri No / Lot No alanları YAPILDI; dördü de ayardan açılır, varsayılan KAPALI (İz 7, `docs/2.4.0-IS-LISTESI.md`; gerçek EDM test
  ortamında taslak + dört seçenek uçtan uca denendi, docs/kanit/2026-10-16/edm-taslak). Göç v27 (invoice_lines serial_no, lot_no; yalnız ekleyici).
- KARAR (kullanıcı, 16.10.2026: "entegre et ama müşteriler şimdilik sadece test linki girip deneme yapabilsin, ben de öyle yapacağım; sorunsuzca
  'canlıyı da aç' dersem o kısmı da aktif edersin") → 2.4.0'da e-Belge AÇIK (edocEnabled), CANLI ORTAM KİLİTLİ (edocLive kapalı; ekran + sunucu +
  bağlantı katmanı zaten kilitli). "Canlıyı da aç" denince yalnız edocLive açılır (ayrı sürüm). Baş mimar uyarısı verildi (test belgesi gerçek
  deftere yazılır, numara serisi tüketilir, belgede "test" işareti yok). KARAR (kullanıcı: "önerilerin mantıklı, yapalım") → YAPILDI (İz 8):
  test belgeleri TEF/TEA/TES serisi + "Test" rozeti/PDF/görünüm şeridi + kartta test hesabı ve "ikinci şirkette deneyin" notu; gerçek EDM'de doğrulandı.
- İSTEK (kullanıcı, 16.10.2026, örnek FIRAT e-Faturası: "kırmızı maliye logosu, karekod çıkması çok mu zor, yapamaz mıyız?"; sabahki EDM varsayılan görünümünde
  GİB logosu var) → KAREKOD ZORUNLU (GİB Karekod Standardı Kılavuzu V.1.2, Kasım 2023, sha256 0db9831a…: 509 VUK GT "bulunması gereken bilgi", belgenin
  SAĞ ÜST köşesi, JSON içerik). Görünüm şablonumuzda ve EDM varsayılanında karekod YOK → canlıdan önce ŞART; İz 6'daki "karekod bilinen sınır" değerlendirmesi
  yanlıştı. YAPILACAK (İz 9, 2.4.0): sunucuda üretilen karekod (GİB JSON) şablona + programın e-Belge PDF'ine; GİB logosu (GİB örnek şablonundaki resmî görsel)
  "e-FATURA" başlığının üstüne; bağımsız çözücüyle kâhin, gerçek EDM'de resmî PDF. Ayrıca: EDM istemcisinde belge türü (ProfileID) ↔ gönderim kanalı
  uyuşmazlığı reddedilir (sabahki deneme betiği e-Arşiv belgesini e-Fatura kanalından göndermişti → GİB SEND-FAILED; program yolunda olmaz).
  İSTEK (kullanıcının yardımcısı, aynı gün): kaşe üzerine imzanın resmi e-Arşivde GİB logosunun altında çıksın (e-Faturada zorunlu değil) → Fatura
  Ayarları'nda Logo'nun yanında "Kaşe / İmza". İSTEK (kullanıcı): "şirket logosu, GİB logosu, kaşe ortada alt alta"; "e-Faturada da ortada olsa logolar".
  YAPILDI (İz 9, `docs/2.4.0-IS-LISTESI.md`): karekod sağ üstte (şablon + programın PDF'i), ortada firma logosu → GİB logosu → başlık → kaşe; kaşe
  varsayılan yalnız e-Arşivde (Görünüm'den e-Faturada da); EDM kanal güvencesi. Gerçek EDM'de resmî PDF karekodu bağımsız çözücüyle doğrulandı.
- KARAR (kullanıcı, 16.10.2026, "kâhin-yargıç-eleştirmenden geçiyor mu?" sorusuna verdiğim cevaba "önerin uygun"): 2.4.0'ın yargıç + eleştirmen turu bitişe
  bırakılmaz, İz 9 commit'inden HEMEN SONRA koşar (birer ajan; kapsam 7888371..HEAD = 2.3.0 sonrası her şey; öncelik canlı kilidi/test serisi, karekod,
  şablona giren alanlar (logo/kaşe/alt not), gönder/iptal/taslak, K4, göç v27). Bulgu → yeniden üret → kırmızı test → düzelt → dar kontrol turu (ders 32).
  Uzun Doğrulama son adayda GitHub'da bir kez.
  SONUÇ (16.10.2026): yargıç 1 YÜKSEK + 3 ORTA, eleştirmen 2 YÜKSEK + 2 ORTA (+ düşükler); hepsi ana oturumda yeniden üretildi ve DÜZELTİLDİ — canlı
  kilidi Servis Adresi'nden delinebiliyordu (iki ajan ayrı ayrı buldu), portaldan gönderilmiş taslak düzenlenebiliyordu, belirsiz gönderimden sonra
  silme numara çakıştırıyordu, karışık istisnalı belge GİB'den düşüyordu… Ayrıntı `docs/2.4.0-IS-LISTESI.md` "Bitiş turu". DAR KONTROL TURU (2467be8): K1 withdrawn belge, K2 "Hata"dan yeniden gönderimde belirsizlik, K3 tevkifat + istisna karışık → DÜZELTİLDİ (16/16, eski 3 kırmızı). KARAR (kullanıcı: "Yetkiliye onaylı iptal") → YAPILDI: belirsiz / portal taslağı belgede Fatura Ayarları yetkilisine "Yalnız Programda İptal Et" (onay kutusu + işlem kaydı).
- İSTEK (kullanıcı, 16.10.2026): "test faturaları arayüzden de kesilebiliyor mu, sen koddan mı gönderdin?" → API'den (ekranın çağırdığı uçlar) gönderilmişti;
  "kapat" → tarayıcıyla ekrandan gerçek EDM'ye gönderildi; BULGU: sorgusuz mükellefe e-Arşiv → EDM reddi + numara kaybı → DÜZELTİLDİ (mükellef sorgusu
  numaradan önce, posta kutusu denetimi). İSTEK (aynı gün): "fatura, e-Arşiv, kesme ve iptal durumlarını gerçek kullanıcı gibi test edelim, hataya yer
  bırakma" → YAPILDI: arayüzden gerçek EDM'de kesme (5) + iptal (4) matrisi, 25/26; bulunan 2 kusur düzeltildi (Ticari durum "RECEIVE -" eşlemesi; iptal edilmiş kartta "Tahsil Edilecek" başlığı) — `docs/2.4.0-IS-LISTESI.md`.
- İSTEK (kullanıcı, 16.10.2026: "edm test linkinden son haliyle 3-4 çeşit test faturaları kes, ben de portaldan kontrol edeyim") → YAPILDI: son kodla
  (bitiş turu düzeltmeleri dahil) EDM test ortamına 4 belge — TEF2026481687272 Temel (%20+%10, 470,00), TEF2026481687273 Ticari (1.200,00), TEA2026481687272
  e-Arşiv kişiye (900,00), TEF2026481687274 İstisna 301+%20 (740,00); hepsi GİB'den geçti; resmî PDF karekodları jsQR ile çözüldü, tutarlar elle hesapla
  aynı (docs/kanit/2026-10-16/edm-son-hal). PDF'ler kullanıcıya gönderildi; kullanıcı portaldan kontrol ediyor.
- İSTEK (kullanıcı, 16.10.2026: "müşteri DESTEK OFİS şeklinde 5 kullanıcı ile 30 tane e-fatura, e-arşiv karışık kesmeye zorlar mısın") → firma DESTEK OFİS,
  5 kullanıcı (3 Muhasebe + 2 Avukat) ayrı tarayıcı oturumlarında AYNI ANDA ekrandan 30 belge (15 e-Fatura Temel/Ticari + 15 e-Arşiv; Kaydet ve Gönder /
  Sonra Gönder karışık) gerçek EDM test ortamına; denetim: numara benzersiz/boşluksuz, tek gönderim, son durum, bakiye, defter (kanıt docs/kanit/2026-10-16/edm-stres).
  SORU (aynı gün, TEF2026347991651 Ticari, portal "Kabul/Red yanıtı bekleniyor"): kabul/red Giden'den değil Gelen Fatura'dan verilir (kendine gönderim).
- İSTEK (kullanıcı, 16.10.2026: "çok kullanıcılı yüklü testler yap, müşteriler / kesen şirket / kalemler / sektörler farklı olsun"; "sunucunun testler
  sonrası doğru yedeklemeyi aldığını da kontrol et"; "iade temel… deniyor muyuz") → gerçek EDM'de 2 şirket (001 DESTEK OFİS hizmet, 002 ATLAS YAPI stok) ×
  5 kullanıcı, 64 belge (+ Alıştan İade TEMEL/IADE) + yedek tatbikatı (otomatik + elle + geri yükleme). Gerçek EDM birim kodu kusurunu buldu (Çuval SA vb.
  reddedildi) → düzeltildi. KARAR (kullanıcı: "en uygun haliyle yap"): birimler programda KALIR; e-Belgede Adet + kalem notu, formda/stok kartında ipucu,
  kılavuzda hap bilgi. Canlı açılırken birim sorgusu canlı ortamda yinelenir. Ayrıntı docs/2.4.0-IS-LISTESI.md "Dar kontrol turu 4".
- İSTEK (kullanıcı, 16.10.2026, "başla"): EDM test ortamı için 5 senaryo örnek UBL-TR XML/JSON + kontrol listesi + yanıt/UUID doğrulama kodu (1 perakende
  %1/%10/%20 + satır ve genel iskonto, 2 hizmet stopaj/tevkifat e-Arşiv, 3 tevkifatlı e-Fatura 5/10 ve 9/10, 4 USD dövizli, 5 hatalı VKN/eksik alan SOAP
  Fault). Koddan: satışta gelir vergisi STOPAJI YOK (yalnız SMM/alış; e-SMM kapsam dışı) → 2'de KDV tevkifatlı hizmet e-Arşiv; döviz VAR (fxEnabled banka
  modülü içindir — önceki "döviz kapalı" sözüm yanlıştı). Çıktı docs/fatura/ornek. AYRICA: büyük yük/stres testi planı (20 kullanıcı, dakikada 100–1.000,
  oturum düşmesi, 5 MB XML…) için süre/maliyet verildi (~5–6,5 sa + düzeltmeler; 0 TL); karar ("A A A" önerisi) BEKLENİYOR.
- İSTEK (kullanıcı, 16.10.2026 ~17:40 UTC): "kalan işleri ve zaman maliyetini yaz; her 30 dk bir rapor ver" → 30 dk raporu send_later ile (her raporda
  yeniden kurulur); 2.4.0 yayımlanıp site PR'ı birleşince ya da kullanıcı "durdur" deyince durur. 2.4.0 son aday 77ba737 (CI #778 yeşil), Uzun Doğrulama
  34761ca run 38933795436 17:36 UTC başladı. Stres testi (100/500/1000 dk) bitti: tavan ~320/dk, 1.599/1.600, kanıt docs/kanit/2026-10-16/edm-hiz.
- KARAR (kullanıcı, 16.10.2026 ~17:45 UTC: "hem testi hem canlıyı aç, hafta sonu fatura kesecek kimse yok, ben hafta sonu testler yapınca zaten düzeltilecek
  kısım olursa yaparız. buna göre üret zipi") → 2.4.0'da CANLI ORTAM AÇIK: server/server.mjs `edocLive: true` (kilit altyapısı yerinde; testler varsayılan
  kilitli). Baş mimar uyarısı verildi: canlı hiç denenmedi (canlı kimlik yok), canlı belge yasaldır, seri TEF/TEA olamaz, ilk belge küçük tutarla kendi firmasına.
  Ekran notu + kılavuz "Canlıya geçiş" hap bilgisi; sürüm notu "İyileştirmeler ve e-Fatura / e-Arşiv Entegrasyonu"; e2e entegrator-240 §14 canlı kip 69/69.
  Uzun Doğrulama (34761ca) bitince son commit CI yeşil → imzalı paket + kurulum → 5 dosya + arşiv teslim.
- SON ADAY (eski) 6312e8b (15.10.2026 ~16:10 UTC): CI YEŞİL (2464/2464 × 4 platform + e2e + kapı). Uzun Doğrulama #199/#213 kırmızısı (7 tohum)
  iki kök nedenle kapandı: (1) aynı gün değersiz/tahsilat sırası UUID'ye göreydi → sınıf sırası al → karşılık → değersiz → tahsilat → çıkar (4d4da18, ders 31);
  (2) kaydı silme başka kaydın çıkarma başlığını bozunca kapı genel 409 diyordu → açık 409 doubtful-delete-conflict (91bee2f). Motor öngörüleri ürüne
  eşitlendi (615a7b4, 6312e8b; ürün doğruydu). Yerelde tohum 1,3,4,6,7,8,9,10 × 5.000 GEÇTİ. Uzun Doğrulama 6312e8b'de GitHub'da koşuyor (~14:55 UTC
  başladı); yeşil → KANIT satırı doldurulur → imzalı paket → teslim → PR (kullanıcı: "kuralımıza göre bekleyelim").
- DURDURULDU (kullanıcı, 15.10.2026 06:55 UTC: "5 saatlik kullanım limitim %99, 11:10'da yenilenecek, uygun yerde dur"): karar ajanı
  (644 plan metni / tahsilatta "Normal Cari Hesaba İşle" seçimi / yaşlandırma "Vade Gecikme (Gün)") durduruldu; yarım işi worktree dalı
  `worktree-agent-ae29a6d1c9c3d14a0` commit 4c725a7 (WIP, 34 dosya; test KOŞULMADI, birleştirilmedi). Dal HEAD d274311; CI 469d547/6a599ba/
  d274311 SÜRÜYOR (okunmadı — ders 21, devamda ilk iş). Uzun Doğrulama #199 (43322ab) kuyrukta; para çekirdeği sonra değiştiği için son adayda
  yeniden koşulur. DEVAM (11:15 TR hatırlatıcısı): CI oku → ajanı 4c725a7'den sürdür (kalan: model_b, kart tarih, taksit fişi, supheli_turet,
  testler, kılavuz) → birleştir + ayrı kopyada doğrula → KANIT belgesi → son CI + Uzun Doğrulama → imzalı paket → teslim → PR.
- KARAR (kullanıcı, 15.10.2026, bitiş turu — eleştirmen/yargıç soruları; baş mali müşavir denetimiyle UYGUN): (1) 644 kuralı = UYGULANAN KURAL
  (K6: karşılık ≤ kalan; tahsilatta yalnız aşan kısım 644'e; tam tahsil/kapanışta kalan karşılığın tamamı 644) — plan §3.11b/3 metni buna göre
  düzeltilir, kâhin plandan. (2) Tahsilatta KULLANICI SEÇİMİ, varsayılan "Şüpheli Alacaktan Düş"; cari tahsilat formunda "Normal Cari Hesaba İşle"
  kutusu; fatura peşini ve faturaya bağlı (Kapatılacak Fatura) tahsilat KENDİLİĞİNDEN normal (yeni satışın parası) — yargıç #3. (3) Alacak Yaşlandırma
  raporuna "Vade Gecikme (Gün)" (carinin en eski açık kaleminin gecikmesi) ve vade dilimi; "Şüpheli Alacak" kolonu kalır, başlığında "(dilimlere
  dahil)". Uygulama: yargıç düzeltmeleri birleşince aynı dosyalarda (doubtful-gl, hof-accounts, report-center) ayrı ajan; 2.3.0'a girer.
