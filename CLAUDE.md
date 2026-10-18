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
- Yayın geçmişi özeti: 2.0.12 … 2.0.26, 2.1.0, 2.2.0, 2.3.0, 2.4.0, 2.4.1, 2.4.2 yayımlandı (her biri PR + etiket + 5 dosya bayt bayt + güncelleyici "available" + site
  kılavuz PR'ı); ayrıntı arşivde. Kâhin bilinen sınıfları: KDV-DAHIL-ISKONTO (program doğru), KASA-ACILIS-649 (İz 1.3 ile kapanacak).
- PLANLI TEST (kullanıcı, ertelendi; 16.10.2026'da yine ertelendi: "cuma testini pazara ertele"): Pazar 18.10.2026 09:00 TR (trig_0144BJLRwsZFizXTTYrJVszA): 2.0.24 DENENMEYEN/BİLİNEN SINIRLAR
  (`docs/2.0.24-KANIT.md`) + ölçek/yük (30 kullanıcı, 1.000.000 satır; sunucu + ARAYÜZDEN, tablo iki sütun).
- 2.1.0 kapsam ölçümü (satır/dal/arayüz) — yayından sonra yapılacak iş (kullanıcı 11.10.2026).
- ARŞİV (17.10.2026, anayasa "kısa tutulur" gözden geçirmesi): 2.1.0–2.4.2 kapanan maddeleri ve eski kararlar `docs/GECMIS-KARARLAR.md`
  "Arşiv 17.10.2026" bölümüne AYNEN taşındı. O maddelerden AÇIK kalanlar: e-SMM gönderimi (kullanıcı EDM'den servis adresi/belge/test yetkisi
  ister; şimdilik gizli, config.esmmEnabled); Edge'in kaydetme önerisi (2.4.2) kullanıcının makinesinde doğrulanacak; canlı açılırken EDM birim
  kodu kabulü canlıda yinelenir; döviz (§3.12) ertelendi, fxEnabled kapalı; release.yml sürümlü exe koşuları (2.4.1 run 39010296441) okunacak.
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
- SIRA (kullanıcı, 13.10.2026): Perşembe (sıfırlamadan sonra) → (1) banka kalan işleri — ŞÜPHELİ ALACAKLAR (İz 4.3, plan §3.11b) DAHİL
  (kullanıcı: "banka kalan işlerine say") + ölçek-20 kök neden ve öbür ertelenen banka maddeleri → (2) fatura/e-Belge (EDM) → (3) devir modülü.
  WhatsApp paylaşımı (emlakçı isteği) ŞİMDİLİK BEKLER (kullanıcı: "şimdilik kalsın").
  2.3.0 BANKA EKSTRESİ (ekstre yükleme + eşleştirme) LİSTEDEN ÇIKTI (kullanıcı, 13.10.2026: "müşteri portföyüm pek ilgilenmez, sonra ihtiyaç
  duyulursa yaparız") — plan bölümü yerinde kalır, ihtiyaç olursa açılır.
- TESLİM BİÇİMİ (kullanıcı, 15.10.2026 ~20:20 UTC, 2.3.0 için teyit): GitHub'a yüklenecek İMZALI 5 dosya AYRI AYRI verilir; birleştirmeleri (PR → master) ben yaparım, dosyaları kullanıcı yükler. Kurulum .exe 30 MB'ı aşarsa İKİ PARÇA (parca0 + parca1) + "BIRLESTIR.md" (copy /b komutu + beklenen sha256) verilir.
- AÇIK (15.10.2026 21:58 UTC): CI #742 aed598e Windows Node 24 guncelleme-gercek S2 kırmızı (PR koşusu #743 aynı commit yeşil). Mekanizma: testin etkinlik pingi bir önceki isteği bekliyordu, takılan tek istek 4 sn boşluk açtı, sunucu haklı olarak kurdu (ürün doğru). Düzeltme test yardımcısında (zamanlayıcılı + zaman aşımlı pingler + istatistik; zorla üretme GUNCELLEME_S2_ZORLA_BOSLUK=1). İsteğin CI'de neden takıldığı (ağ/yük/ürün) yeni tanılamayla bir sonraki görülüşte okunur; ders 18 gereği Windows'ta iki yeşil koşu görülmeden kapanmaz.
- FİYAT (kullanıcı, 16.10.2026; soru "yıllık 15 bin öder mi?" → değerlendirme verildi; Wolvox Standart 50 bin TL tek seferlik): KARAR "SINIRSIZ 40 bin TL";
  devir, döviz, mobilden uzaktan bağlanma ve WhatsApp otomatik toplu gönderim yapıldıkça dahil. Baş mimar uyarıları verildi: "sınırsız"ın sözleşmede tanımı
  (süre / kullanıcı / güncelleme); tek seferlikte sürekli giderler (mevzuat güncellemesi, destek, uzaktan bağlanma sunucusu, WhatsApp Meta mesaj ücreti, EDM
  kontörü müşteride); gelecek özellik vaadi yazılı taahhüt olmaz. Lisans altyapısı süresiz lisansı destekliyor (license-token expiresAt null). KARAR BEKLENİYOR:
  güncelleme/destek süresi ve WhatsApp/uzaktan bağlanma giderlerinin kime ait olduğu.
  FİKİR (kullanıcı, aynı gün; "bunlar sadece fikir şimdilik"): Pro yerine TEK PAKET (bütün özellikler); WhatsApp kontörünü müşteri öder; uzaktan bağlanma için
  Tailscale benzeri çözüm (net değil); ömür boyu kullanım, güncelleme yalnız ZORUNLU hallerde ve 2 YILLA sınırlı. Karar değil — uygulanmaz, kod değişmez.
- KUSUR (kullanıcı denemesi, 17.10.2026; ekran: TEF2026358238234 TESTER, TCKN 12345678950, Belge Türü e-Fatura (Temel), gönderimde "posta kutusu" uyarısı):
  TCKN EDM'de mükellef DEĞİL (CheckUser false) ama cari kartında "e-Fatura mükellefi" işaretli → belge TEF ile e-Fatura oldu, PK yok → 409 buyer-alias. Sahte
  EDM'de yeniden üretildi (scratchpad/tester-repro): (a) işaret kaldırılınca Düzenle 400 profile-not-allowed — çıkmaz yol; (b) Düzenle'de belge türü e-Arşiv
  seçilirse 200 ve belge TEF numarasıyla EARSIVFATURA olur (e-Fatura serisi numarası e-Arşiv belgesinde) — KUSUR. Kullanıcıya yol: İptal Et (EDM'ye gitmedi)
  → cari Mükellef Sorgula (işaret kalkar) → Kopyala → TEA e-Arşiv olarak Kaydet ve Gönder. 2.4.3 ADAYI (karar kullanıcıda): numaralı belgede Düzenle belge
  türünü (profil/seri) değiştiremez, ileti "iptal edip yeniden kesin"; formda cari seçilince e-Fatura mükellefi ama PK seçilmemişse kaydetmeden uyarı
  ("Mükellef Sorgula"); buyer-alias iletisi carinin mükellef olmadığı durumda doğru yolu söylesin. TEF2026358238233 (TEST BILISIM) EDM'de SEND - SUCCEED (17:21 TR).
  TEA2026732297197 (TESTER e-Arşiv) EDM'de SEND - SUCCEED (17:29 TR); iki belgenin resmî PDF karekodu çözüldü (senaryo/tutar programla aynı). GÖRÜNÜM: nakit
  ödenen belgede "Ödeme Şekli: Havale / EFT" — Ek Seçenekler "Ödeme şeklini yaz" kapalıyken IBAN varsa 42 yazılıyor; kullanıcı seçeneği açtı.
  KARAR (kullanıcı, 17.10.2026: "önerilerin mantıklı") → 2.4.3 BAŞLADI: (1) numaralı belgede Düzenle belge türünü değiştiremez ("iptal edip yeniden
  kesin"); (2) e-Fatura carisinde posta kutusu seçilmemişse formda kaydetmeden uyarı + "Kaydet ve Gönder" numara harcamadan durur; buyer-alias
  iletisi mükellef olmayan cari yolunu da söyler; (3) "Ödeme şeklini yaz" varsayılan AÇIK.
  KARAR (kullanıcı, aynı gün: "anayasamıza göre sen karar ver", cari kartı "e-Fatura mükellefi (bu cariye e-Fatura kesilir)" kafa karıştırıyor) → (4) işareti
  yalnız Mükellef Sorgula koyar/kaldırır, metin "işaretliyse e-Fatura, değilse e-Arşiv kesilir". YAPILDI (kod + test, docs/2.4.3-DEGISIKLIKLER.md): ebelge-243
  9/9 (eski b340bf6 kopyasında 7/9 kırmızı), e2e senaryo-ebelge-243 17/17 (eskide 8 kırmızı, TESTER aynen), komşu e-Belge/fatura 233/233.
  DURAKLATILDI (kullanıcı, 17.10.2026 ~14:55 UTC: "akşam yardımcımla test edeceğiz, iki iş olmasın; planlayarak durdur, devam ya da düzeltilecekler
  olursa söylerim"): tam npm test yarıda durduruldu (sonuç YOK), 30 dk raporu silindi. DEVAMDA: yardımcının bulguları eklenir → tam npm test +
  e2e entegrator-240/ebelge-242/243 → sürüm 2.4.3 (package.json/lock, kılavuz kapak/dip + hap bilgi: kutu Mükellef Sorgula ile, PK uyarısı, ödeme
  şekli) → CHANGELOG "İyileştirmeler" → KANIT → CI → bağımsız gözden geçirme → Uzun Doğrulama → imzalı paket → teslim → PR.
  DEVAM (kullanıcı, 17.10.2026: "yardımcımın işi çıkmış, kalan adımlara devam"): sürüm 2.4.3 + kılavuz (3021d00); bağımsız gözden geçirme B1–B7 → B1–B4,
  B6 düzeltildi (0352efd); tam npm test 2685/2685; gerçek EDM kanıtı; son aday 3e65842 [uzun-dogrulama] CI #819 YEŞİL. Uzun Doğrulama run 39045380135: 22/24
  yeşil; "Mutabakat (windows, tohum 1)" 5.000 işlem TUTARLI ama test yardımcısının temizliği EPERM → kırmızı (+ kapı). Düzeltme yalnız test yardımcısında
  (4d546e9, test-temizlik-243; CI #820 YEŞİL); imzalı paket 4d546e9'dan (zip f4fe08b3…, kurulum 59069744…; denetim 4/4). KARAR (kullanıcı, 17.10.2026 ~18:45 UTC:
  "hatasız doğru düzgün olsun, gerektiği kadar bekleyelim") → Uzun Doğrulama PAKETLENEN commit 4d546e9'da baştan (run 39059370080, workflow_dispatch);
  yeşil → teslim + PR. (3e65842'deki kırmızı işin yeniden koşusu da sürüyor; yalnız ek bilgi.)
- İSTEK (kullanıcı, 17.10.2026 ~18:50 UTC: "maliyetsiz olarak benim bugün karşılaştığım gibi UI sorunları ve mantık hatalarını, iyileştirmeleri gerçek kullanıcı
  gibi test et: sayfa yapısı, tıklamada ekran yanıp sönmesi, veri giriş satırları hizalı mı, uyarılar makul sürede gidiyor mu, kullanımda sürtünme, genel program
  testlerinde bakılan şeyler") → BAŞLADI: yerelde 2.4.3 (4d546e9) gerçek verili, tarayıcıyla (Playwright) keşif testi — alanlara bölünmüş ajanlar (yalnız bulgu;
  ürün kodu DEĞİŞMEZ, 2.4.3 paketine dokunulmaz); ana oturum bulguları yeniden üretip kullanıcıya rapor eder; düzeltme kullanıcı kararıyla ayrı sürüm (2.4.4).
- İSTEK (kullanıcı, 17.10.2026 ~19:00 UTC: "fatura modülünde bir de yükte hız testi yaptır, maliyetsiz") → PLAN: yerelde 2.4.3 (4d546e9), sahte EDM (ağa
  çıkmaz, 0 TL): 5/10/20 eşzamanlı kullanıcı fatura kes + gönder + iptal + liste/arama/rapor; 10.000+ faturalı veriyle; ölçüm p50/p95/p99, saniyede işlem, hata,
  numara benzersiz/boşluksuz, bakiye/stok/defter tutarlılığı, ekranda fatura listesi/form açılış süresi. Ders 15 gereği keşif testleri (A/B/C) BİTİNCE tek
  başına koşulur. Önceki ölçüm: gerçek EDM gönderim tavanı ~320/dk (docs/kanit/2026-10-16/edm-hiz) — bu kez programın kendi hızı.
- KARAR (kullanıcı, 17.10.2026 ~19:50 UTC: "diğer testler de bitince yeni bulgular çıkarsa, şu an bulunan ve bulunacak tüm bulguları düzelterek zipi
  kusursuz olarak teslim et") → keşif bulgularının (docs/2.4.4-ADAY-BULGULAR.md; 50 bulgu) ve fatura hız testi bulgularının HEPSİ 2.4.3'e girer (2.4.3 henüz
  teslim edilmedi; ayrı 2.4.4 yok). Sıra: hız testi biter (ders 15: ölçüm sürerken bu makinede test koşulmaz) → alan başına düzeltme ajanları (worktree; her
  bulgu için kırmızı test → düzeltme → komşular) → ana oturum birleştirir, ayrı kopyada kırmızı/yeşil yeniden koşar → tam npm test + BÜTÜN e2e (ortak arayüz
  değişir) → keşif senaryolarının yeniden koşusu (bulgular kapandı mı) → bağımsız gözden geçirme + dar kontrol → son aday CI → Uzun Doğrulama → paket → teslim.
- KARAR (kullanıcı, 17.10.2026 ~19:55 UTC; baş mimar da uygun buldu): "Form state yönetimini izole hale getir; dosya/resim yükleme formun genel state'ini
  re-render etmesin ve kaydedilmemiş verileri ezmesin; sonra tüm formlar için regresyon testi yaz ve çalıştığından emin ol" (kaynak: kullanıcının D1 bulgusu,
  Fatura Ayarları logo/kaşe seçimi kaydedilmemiş alanları siliyor). Uygulama (ortak çekirdek paketinin 1. maddesi): hof-core merkezî taslak koruma (yeniden
  çizimde dokunulmuş alanlar korunur), dosya/resim seçimi yalnız kendi bölümünü günceller, kayıtlı veri yalnız Kaydet sonrası ekrana basar; REGRESYON: bütün
  formlar e2e (doldur → her iç yeniden çizim tetikleyicisi → değerler yerinde) + kaynak tarama testi (dosya seçiminden tüm form yeniden çizimi yasak);
  eski kodda kırmızı, CI Linux+Windows yeşil.
- KARAR (kullanıcı, 17.10.2026 ~20:10 UTC; baş mimar 2.4.3'ü bugünkü hâliyle teslim + bulgular 2.4.4 önerdi): "gerileme olacaksa zaten 2.4.4 ayrı versende
  olacak. gerileme olmayacak şekilde yap herşeyi" → BÜTÜN bulgular + form izolasyonu 2.4.3'te KALIR. GERİLEME GÜVENCESİ: (1) değişiklikten ÖNCE taban:
  4d546e9'da bütün e2e (CI dışı dahil) + keşif senaryoları + tam npm test sonuçları kayda alınır; (2) her bulgu eski kodda kırmızı test → en küçük düzeltme →
  komşu testler; (3) ortak çekirdek (form izolasyonu, kapatma onayı, bildirim, klavye) ÖNCE ve TEK BAŞINA birleşir, bütün e2e + CI yeşil olmadan alan
  düzeltmeleri birleşmez; (4) alan paketleri sırayla birleşir, her birleşmede değişen alan + bütün e2e; (5) numara/iade/toplu gönderim para-numara
  çekirdeği → mutasyon + dar kontrol turu (ders 32); (6) bitişte tabanla fark: önceden yeşil olan her test ve senaryo yine yeşil, keşif bulguları kapalı,
  bağımsız gözden geçirme yalnız gerileme arar; (7) son aday CI + Uzun Doğrulama + gerçek EDM test ortamında e-Belge akışı yeniden.
- KARAR (kullanıcı, 18.10.2026 ~06:25 UTC, H9 sorusuna "a) evet görsün"): Muhasebe rolü Finans Raporları'nı (mizan, ekstre, Rapor Merkezi, Vade
  Takip) VARSAYILAN olarak görür (permissions.mjs overview.view += muhasebe); yönetici kişiden kaldırabilir (kişiye özel "remove"); özel roller kendi
  listesiyle kalır; ANLIK DURUM kartı yine yalnız yönetici. Güncellemeyle mevcut muhasebe kullanıcılarına da açılır (kaldırılmışlar kapalı kalır).
  Dal h9-243 127ab3c (test yetki-243-muhasebe-finans eski 0/2 → 2/2; finans kapısını sınayan 4 test kişiden kaldırarak sınamayı sürdürür).
- KARAR (kullanıcı, 18.10.2026 ~08:00 UTC: "evet kopyala düğmesi ekle"): 2.4.3 çekirdeğinde bildirim tıklamayı geçirdiği için metni seçilemiyor → hata
  ve uyarı bildirimlerine "Kopyala" düğmesi (tam metin panoya; güvenli olmayan http bağlamında yedek yol). Düzeltme ajanına (duzeltme-gg243) eklendi.
- İSTEK (kullanıcı, 18.10.2026 ~08:25 UTC, ikinci kez: "anayasamızı ve derslerimizi gözden geçir yeniden") → SONUÇ: (1) ders 26 yine ihlal — iş listesi
  (docs/2.4.3-IS-LISTESI.md) BELGE_YOLLARI dışında, her güncellemesi tam CI başlattı (f6c032a, 8811afb, 5f50a2e) → önlem: iş listesi kodla birlikte
  gönderilir; kalıcı çözüm olarak docs/*-IS-LISTESI.md BELGE_YOLLARI'na eklenecek (kanit.mjs + ci.yml + kanit-araci testi; sonraki kod push'unda).
  (2) ders 34 eklendi: esc-kapat.mjs soruyu sessizce geçiyordu (yanlış soruları gizler) → düzeltme ajanına günlük + sınıflama + beklenti verildi.
  (3) KANIT 4: yeni e2e'lerin eski kodda kırmızısı yalnız ajan raporundan → form-izolasyon-243 ana oturumca eski/yeni kodda yeniden koşuluyor.
  (4) ders 9: çekirdek 134 form çağrısının 115'i ekrandan ayrıca açılmadı (ortak çekirdekle korunuyor) → DENENMEYEN'e adıyla yazılacak; keşif
  yeniden koşusu bu formlardan Excel eşleme, geri yükleme, toplu işlem, POS, çek işlemlerini kapsayacak. (5) ders 14/18: Geri tuşu, F5 sorusu, Navigation
  API, Kopyala (http) gerçek Windows + Edge uygulama penceresinde denenmedi → teslimde kısa elle kabul listesi (KANIT 5) verilecek.
  (6) çekirdeğin ana dal CI'si (37b64e8) kırmızı (form-izolasyon E1 ön koşulu CI yerleşiminde kurulamadı) — birleşim (birlesim2-243) bu düzelip CI
  yeşil olmadan ana dala alınmaz.
- DAR KONTROL TURU (18.10.2026, d64ebf8; ders 32): numara/gönderim düzeltmelerinde YÜKSEK Y1 (Tümünü Gönder istemcide 30 sn zaman aşımı; gerçek EDM
  hızında GG1 turları işlemez — ana oturum yeniden üretti: 30 sn'de hata, sunucu arkada 170/170), ORTA O1 (Kaydet ve Gönder / Kaydet / kartta Gönder eski
  numarasız bekleyeni kalıcı kronoloji engeline düşürür — ana oturum yeniden üretti, 3 yolun 3'ü), O2 (tur sürerken Listeden Silinen belge e-Belge gider),
  O3 (buyer-is-efatura seriyi bekletir), DÜŞÜK D1–D4 + ağ yokken turun numara vermesi. O1–O3/D4 2.4.3 ÖNCESİNDEN de var. Hepsi 2.4.3'te düzeltiliyor
  (dal duzeltme2-243); bitince ayrı kopyada kırmızı/yeşil + yeni dar kontrol.
- İSTEK (kullanıcı, 18.10.2026 ~12:20 UTC: "son uzun koşu başlamadan son adayı, bağımsız kahin, yargıç, eleştirmenden geçir (uzman ui, uzman ux ve uzman mali
  müşavir gözüyle sadece koddan değil gerçek kullanıcı olarak da yapılsın bağımsız bu işlem) anayasamız ve derslerimize göz at") → PLAN: duzeltme2 birleşip CI
  yeşil olunca SON ADAY → Uzun Doğrulama'dan ÖNCE bağımsız tur: (a) KÂHİN: plandan/mevzuattan, kodu görmeden yazılmış Python temiz oda modeli (mevcut kâhin
  sürümü + 2.4.3 değişen kurallar: numara/kronoloji, iade, KDV) programla kara kutu karşılaştırma (ders 5); (b) YARGIÇ + ELEŞTİRMEN, üç uzman gözü — UZMAN UI
  (görsel düzen, hizalama, yanıp sönme, dar ekran), UZMAN UX (iş akışı sürtünmesi, klavye, ileti açıklığı, geri alma), UZMAN MALİ MÜŞAVİR (TDHP/VUK/GİB
  e-Belge kuralları, mizan/ekstre/KDV/iade/çek-senet doğruluğu); her biri hem KODDAN hem GERÇEK KULLANICI olarak tarayıcıda sıfırdan iş akışı (kişi → cari →
  fatura → tahsilat → kasa/banka → rapor) yürütür; birbirinin ve düzeltme ajanlarının raporunu GÖRMEZ (ders 16); bulgu ancak ana oturum yeniden üretince
  sayılır (ders 6); düzeltme → dar kontrol (ders 32) → sonra Uzun Doğrulama.
  KARAR (kullanıcı, 18.10.2026 ~12:40 UTC: "önerini yap"): tek tur, DÖRT bağımsız ajan — kâhin modelini yazan (koşuları GitHub'da, ücretsiz) + UZMAN UI +
  UZMAN UX + UZMAN MALİ MÜŞAVİR (bu oturumda, para yok, kullanım limitinden); yargıç/eleştirmen rolü her uzmanda (önce hata ara, sonra kendi bulgusunu
  çürütmeye çalış); ayrı yargıç ajanı yok, süzgeç ana oturumun yeniden üretmesi (ders 6); ikinci tur yalnız yeniden üretilmiş bulgu varsa, dar kapsamlı.
- KÂHİN (18.10.2026, dal kahin-243; kodu görmeden, GİB + ürün kararlarından): model 44/44, mutasyon 20/20; d64ebf8'de dar kontrol bulgularının HEPSİNİ
  kendiliğinden yakaladı + 3 yeni (BASKA-ESZ: eşzamanlı turda einvoice-sending hata sayılıyor; BASKA-FIS-SIRA: Listeden Sil eski tarihli belgeye sıradaki FIS
  numarasını veriyor; düzenle-ileri-tarih = D4). Düzeltilmiş 2849a87'de 9 senaryonun 5'i yeşil; kalan 4 (ağ yokken Kaydet ve Gönder numarası, BASKA-ESZ,
  FIS sırası, PK'sız eski belge sonucunda kod boş) düzeltme ajanında. BAŞ MİMAR KARARI: posta kutusu seçilmemiş belge GEÇİCİ engeldir (kullanıcı tek adımla
  düzeltir) → daha eski PK'sız belge seriyi BEKLETİR, sonucu dolu kod + nedenle döner; kalıcı yalnız chronology ve buyer-is-efatura. Kâhin K9 buna göre
  güncellenir (kaynak gösterilerek). Uzun Doğrulama'ya kâhin işi eklendi (tohum 1–5 × 300, GitHub, ücretsiz).
- SON ADAY BAĞIMSIZ TURU (18.10.2026, 5966ac3): DAR KONTROL 2 → bu turun düzeltmelerinin gerilemeleri B1 (reddedilen belgeler Tümünü Gönder'i kilitliyor),
  B2 (tek bağlantı kopması turu durduruyor), B3 (her gönderimde fazladan EDM girişi, ~%80 yavaş), B4 (büyük veride Kaydet ve Gönder 144 → 2.621 ms) — ana
  oturum B1–B3'ü yeniden üretti — + öncesinden B5 (Kes, Sonra Gönder eski tarihle), B6 (WSDL yedeği 12 saat önbellek), B7 (ileti). MALİ MÜŞAVİR (kâhin mizanı
  22/24 hesap kuruşu kuruşuna) → MM1 kâğıt asıllı iade çıkmazı, MM2 Ticari profilde IADE (GİB reddeder), MM3 360/KDV kapatılamıyor, MM4 stok açılışı Ana
  Defter'de yok (153/500 −5.000), MM5 yaşlandırma faturasız borcu görmüyor (840 vs 7.840) — ana oturum beşini yeniden üretti — + MM6–MM9 düşük + görüşler G1–G5.
  e-Belge çekirdeği (B1–B7 + MM2) düzeltme ajanında (dal duzeltme3-243). UI ve UX uzmanlarının raporu bekleniyor.
  KARAR (kullanıcı, 18.10.2026 ~16:30 UTC): MM3 → 2.4.3'e EKLE: "Vergi Ödemesi" (B 360 / A 102|100) + ay sonu "KDV Mahsup" fişi (391/191 → 360 ya da 190);
  para çekirdeği: kâhin + mutasyon + dar kontrol. MM1 → "İade Edilen Belge No (e-Belge Referansı)" alanı + 16 karaktere tamamlanmış değer önerisi, kullanıcı
  onaylar; asıl kayda dokunulmaz; uyarı form açılırken; teslimden önce gerçek EDM test ortamında kabulü denenir (reddedilirse yalnız ileti düzeltilir).
