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
    (06.11.2026: WhatsApp WE ortak katmana (001 ayarı) yazdı, yeniden koşunun komşu listesi yalnız WhatsApp dosyalarından seçildi → şema kapısı testi (sema-kapisi-bs7) seçilmedi, BS-7 gerilemesi ana dala girdi.
    Ortak katmana / ayara / yedeğe yazan her değişiklikte şema kapısı ve geri yükleme testleri komşudur.)
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
    (05.11.2026, YİNE: iş listesi betiği (python heredoc) AssertionError ile düştü, sonraki satırdaki commit + push çalıştı, ileti yazılmamış kaydı "yazıldı" dedi — 2ecf62cb. Heredoc'lu
    betikte ilk satıra `|| exit 1`; commit / push ondan sonraki satırda değil, aynı zincirde.)
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
    (31.10.2026: CI #941 df238b99 Windows Node 24 banka-210-altin 23:58 UTC'de başladı — test TODAY'i dosya yüklenirken bir kez okuyor, config.now'suz v2.0.26 açılıyor, gün dönünce
    fatura kronoloji 400; tarama asama0-226 ve rapor-220'de aynı kalıbı buldu. Düzeltme: test/fixtures/surec-saati-sabah.mjs İLK içe aktarım; zorla: test/gece-yarisi-zorla.mjs <dosya> <sn>.)
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
44. ORTAK AĞAÇTA COMMIT YALNIZ KENDİ YOLLARINLA. Başka ajanın çalıştığı ağaçta `git add -u` / `git add -A` / `commit -a` kullanılmaz; commit'e yalnız adı verilen
    yollar girer (`git add <yol>`), önce `git status -s` okunur. (30.10.2026: ana oturumun iki belge commit'i 4a3aba3b, 98cd83f1 K0 kâhin ajanının yarım dosyalarını alıp
    gönderdi; son içerik aynı çıktı, zarar yok — ders 23'ün commit karışması ailesi.)
45. "KİME KAÇ KEZ" İLKESİ PLANDA YAZILIR. Dış servise bağlı ve durum tutan her özellikte (WhatsApp, e-Belge gönderimi, ödeme, bildirim…) "kime kaç kez" ve "çift işlem" ilkesi
    (kesin almadıysa sayılmaz / almış olabilirse elenir + onaylı tek yol / aldıysa aynı dönemde elenir, şüphede aynı / çıkmaz yok / taşınan-geri yüklenen veride aynı kural) PLAN aşamasında
    yazılır ve kullanıcıya onaylatılır; kâhin bu ilkeyle kurulur. Son aday aşamasında yeni kural GİRMEZ (ilkeyle de olsa); çok seyrek çift işlem yolları BİLİNEN SINIR olarak sonraki sürüme.
    (31.10.2026, kullanıcı "ekle": 2.4.8'de kurallar son adayda tek tek verildi — 15 soru, dar kontrol 3→10 = 8 tur; baş mimarın dondurmadan sonra İLKEYLE eklediği L5 dk10 DÜŞÜK-1'i doğurdu.)
46. DÜZELTME AJANI TUR BAŞINA YENİ BAŞLAR. Aynı düzeltme ajanı art arda turlarda sürdürülmez (bağlam şişer, sıkıştırılır, önceki turun nedenleri kaybolur, her yama komşusunu bozar); her düzeltme turu temiz bağlamlı yeni ajanla, tasarım notu + önceki turların karar/kanıt özetiyle başlar. Dış servise bağlı ve durum tutan çekirdekte (WhatsApp gönderim/bildirim, e-Belge gönderimi, ödeme) düzeltme ajanının eforu xhigh. Aynı aileden iki dar kontrol üst üste gerileme verirse kullanıcıya hemen sorulur. (01.11.2026, kullanıcı "modeli mi düşük tutuyoruz, bu kadar gerileme olmazdı" → "böyle yapalım ve kısır döngüye girmeyelim": 2.4.8'de tek düzeltme ajanı İş J–Y'yi ~760 bin tokenle yürüttü; dk17 4, dk18 3 gerileme.)
47. TOPLU İŞTE ÖĞE BAŞINA AĞIR OKUMA YOK; YENİ TOPLU YOL BÜYÜK VERİDE ERKEN ÖLÇÜLÜR. Liste, rapor, önizleme ya da toplu iş hazırlayan kod öğe başına ağır okuma yapmaz (tam cari kartı,
    bütün hareketlerin JS nesnesine çevrilmesi, öğe başına alt sorgu); yalnız gereken alanlar toplu SQL ile okunur, toplam/devir SQL'de hesaplanır. SQLite eşzamanlı çalışır: tek ağır istek
    olay döngüsünü kilitler, ofisteki BÜTÜN kullanıcılar bekler → ölçümde yanıt süresinin yanında "olay döngüsü en çok" süresi de okunur. Yeni toplu/rapor yolu planda hacim bütçesiyle yazılır
    (ör. 2.000 cari ≤ 2 sn) ve son adayı beklemeden, geliştirme sırasında bir kez programın kendi ürettiği büyük veride ölçülür; dar kontrol ve gözden geçirme bu deseni ayrıca arar. Hız
    düzeltmesi: davranış aynen — eşdeğerlik testi (eski ↔ yeni çıktı birebir) + aynı veri kopyasıyla önce/sonra ölçüm (ders 15); atomik yazma yolunda (ör. "Zaten Kuyrukta" denetimi + iş
    açma) olay döngüsüne sıra verilmez (eşzamanlı iki istek denetimi birlikte geçer). (01.11.2026, kullanıcı "daha önceki sürümde de böyle bir kod değişikliği ile süreyi kısaltmıştık; bu
    konuyu da derslere taşıyalım": 2.1.0'da (11.10) banka raporları her açılışta bütün para satırlarını JS'e çeviriyordu — 100.000 satırda 10 kişide p95 12 sn, olay döngüsü 6 sn; SQL toplamla
    düzeltildi. 2.4.8'de (01.11) WhatsApp önizleme/başlatma her cari için tam kart okuyordu — 2.000 caride 23–26 sn, olay döngüsü kilitli (İş Z); elle toplu gönderim alıcı listesi 2.4.7'den beri
    aynı desen (2.4.9). İkisi de ancak son adayın ölçek testinde görüldü.)
48. DOSYAYA DOKUNAN TEST WINDOWS'TA ERKEN KOŞAR. Dosyayı silen / yeniden adlandıran / kilitleyen / bozan yeni test (ve bunu yapan ürün yolu) son adayı beklemeden, yazıldığı
    gün çalışma dalına itilip GitHub CI'nin Windows işlerinde görülür; ayrı iş dallarında CI yok, yerel kapı yalnız Linux — Linux açık dosyanın silinmesine/adının değişmesine
    izin verir, Windows vermez. "Program açmayı denedi → sonra dosya değiştirildi" sırası (bozuk/kilitli dosyadan kurtarma) ayrıca denenir; açılış hata verince bağlantı kapanıyor mu
    Linux'ta /proc/self/fd ile ölçülür. (02.11.2026, kullanıcı "bu hatalar en başından beri varsa neden daha önce çıkmadı": CI #943/#944 Windows'ta İş V/X'in 01.11'de eklenen 7 hücresi —
    5'i testte beklenmeyen async closeCompany, 2'si 1.x'ten beri üründe openDatabase'in bozuk dosyada bağlantıyı kapatmaması; 31.10 08:31'den beri çalışma dalında CI koşmamıştı.)
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
- SIKIŞTIRMA ÖNCESİ DURUM 27 (06.11.2026 10:29 UTC; kullanıcı "önerilerini uygula" — token tasarrufu, Verimlilik TOKEN TASARRUFU). DURUM 26, 2.5.0 PLANLAMA, 2.4.8 KARARLARI ve DURUM 17 → GECMIS-KARARLAR "Arşiv 06.11.2026 (2)" AYNEN.
  KAYNAK: docs/2.5.0-IS-LISTESI.md (A kapsam + KESME ÇİZGİSİ, B 2.5.1, C sorular, D kararlar + G1–G7) + docs/2.5.0-IS-LISTESI-KAYIT.md (eski E: zaman sıralı kayıt) + tasarım notları (docs/erp/C2-FIS-DEFTERI-TASARIM, C3-DONDURMA-TASARIM, W3 / D2 / WA-TUR1 / C5 notları ajanlarla geliyor) + kâhin README'leri. Sıkıştırmadan sonra kararlar bu belgelerden okunur.
  ZİNCİR: Ç5 ‖ Ç7a → Ç7b → Ç6-HESAP → MA → D3 → D4 → D5 → D6 (D2 BAŞLADI; Ç6-EKRAN D'ye paralel, kesilebilir). Ç5 / Ç7 KODU Ç3 tur 3 kapanınca (defter kuralı değişir; aynı dosyalar) — Ç5 tasarım notu şimdiden yazılıyor.
  ANA DALDA (06.11; ana oturum yeniden koştu + gönderdi): WhatsApp küçük işler, WK 16 / 17 / 18, kâhin bakımı 5 / 6, birleşik tur 4, BS-5, AH + BS-6 (2a128ff0), WE + BS-7 (86eed89; BS-7 gerilemesi kapandı), Ç2 tur 3 (uç 18c65d44).
  SINAMADA (ana dala GİRMEDİ): Ç3 tur 2 — scratchpad/c3t2-birlesim-ag (834cd0ad); yeniden koşu GEÇTİ (46/46 iki TZ, eski 1/9: 4 beklenen + 4 ön koşul, mutasyon 55/55, e2e 22 + 60, komşu 1901/1904 = BS-7 (WE) + 2 yük zaman aşımı → tek başına 149/149); dar kontrol YÜKSEK-1 → Ç3 TUR 3 ile birlikte birleşir (bekleyen kanıt c3t2-*).
  ÇALIŞAN KOD AJANLARI (en çok 4): W-3 (scratchpad/w3-istem.txt), D2 (d2-istem.txt; göç 48–49), Ç3 tur 3 (c3t3-istem.txt; S46 = A iletildi), WhatsApp tur 1 (wa-tur1-istem.txt). KOD DIŞI: kâhin bakımı 7 (kahin7-istem.txt; S44 / S45), Ç5 tasarım notu (c5-tasarim-istem.txt), Ç2 tur 3 dar kontrol (dk-c2t3-istem.txt).
  SIRADA: BİRLEŞİK TUR 5 (bt5-istem.txt; 5 madde: BS-6 store.exec, AH savunma testleri, tur 4 alan alan testleri, kapalı kart closed_at, WE geri yüklemede çift) ilk boş kod yerine; W-3 / D2 / WhatsApp tur 1 / Ç3 tur 3 dar kontrolleri; kâhin 7 bitince kâhin README'lerini bölme (TOKEN TASARRUFU 6); H2 (dal worktree-agent-af3cb227184197f2d, ağaç duruyor) yüklü zorla koşu makine sakinken (scratchpad/h2-tani/h2-zorla.sh) → birleştir.
  CI: #1018–#1030 YEŞİL; #1031 / #1032 okundu — yalnız sema-kapisi-bs7 (WE) KIRMIZI, e2e yeşil; #1033–#1039+ OKUNACAK (ders 21; #1039 3fe5a92d'den sonra BS-7 yeşil beklenir; Windows'ta ilk kez koşanlar commit iletilerinde).
  AKIŞ (her ajan): rapor → ana oturum KENDİSİ koşar (iki TZ, eski kod kırmızısı kendi ayrı kopyasında + nedeni okunur, G2 komşu = ajan listesi ∪ test/ grep; ortak katman / ayar / yedek yazan değişiklikte sema-kapisi-bs7 + geri yükleme testleri) → ayrı sınama ağacı (scratchpad/<ad>-birlesim-ag) → birleştir → kod sınananla birebir mi diff → kanıtla gönder → DAR KONTROL (xhigh, yeni ajan; küçük düzeltmeler birleşik turda toplanır) → YÜKSEK / ORTA + süzgeçten geçemeyen DÜŞÜK yeni ajanla; kodu görmeyende önce bağımsızlık denetimi (scratchpad/denetim-wk250/arac-kaydi.py); bitince ağaç / kopya HEMEN silinir.
  ORTAM (06.11): 30 dk rapor görevi CronCreate da3eb3f2 ("7,37 * * * *"; istem aşağıda 2.5.0 ESASLAR ORTAM'da), ortam alarmı trig_01RE5MRmDjVDFH2SZEuo24ok (3 saatte bir :18); disk ajan başına ~600 MB (< 5 GB UYARI); ölçüm kilidi scratchpad/olcum.lock, tam npm test kilidi scratchpad/tam-npm-test.lock; docs/kilavuz/*.pdf .gitignore'da → client/kilavuz'dan kopyala; kayıt betikleri scratchpad/kayit-*.py (SAAT KURALI `T=$(date -u +%H:%M)`, heredoc tırnaklı: <<'EOF').
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