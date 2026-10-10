# DestekOfis — çalışma kuralları (proje sahibinin talimatları)

Bu dosya oturumlar arasında taşınan hafızadır. Her oturumun başında okunur; kurallar pazarlıksızdır.

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
  ZORUNLU GÖREV (kullanıcı, 10.10.2026, "CI başarısızlıklarını gider, Windows uyumluluğunu doğrula ve denetim sistemini düzelt";
  8 başlık): CI'yi gerçekten yeşile getir (Windows ayrı doğrulanır; gerçek Windows erişimi yalnız GitHub CI — yerelde yok, Wine
  sayılmaz); 08.10'dan beri kırmızı koşuları commit commit incele; ajan raporlarını CI ile karşılaştır; kalıcı önlem (gerçek çıkış
  kodu + sayılar, belirsiz/yarıda kalan açıkça, ajan onayı bağımsız değil, CI kırmızıyken "doğrulandı" yok, çelişki = başarısız);
  muhasebe bütünlüğünü yeniden doğrula (Kasa/cari/taksit/fatura/stok/banka bağı, silme/iptal/düzeltme, kuruş/sıfır/eksi/büyük
  tutar, çift işlem, eşzamanlılık, mutabakat, yedek/geri yükleme, gerileme); her hata: üret → kök neden → en küçük düzeltme →
  ilgili + gerileme + tam paket → gerçek sonuç kaydı; son rapor 8 başlık (Linux ve Windows AYRI; başarısız/atlanan/doğrulanmayan).

### Doğrulama kapısı — teknik zorunluluk (kullanıcı, 10.10.2026: "ajanların başarılı rapor vermesini engelleyen, gerçek test
sonuçlarına dayalı teknik bir zorunluluk var mı, yoksa yalnız talimatlara mı güveniyoruz? kod ve CI yapılandırmasıyla kanıtla, eksik
mekanizmayı uygula, Windows'taki gerçek CI sonucuyla doğrula")
- Durum (10.10.2026 öncesi, koddan): YOKTU. ci.yml hiçbir şeyi durdurmuyordu (yalnız `package` needs test+e2e); release.yml testleri
  yalnız ubuntu'da koşuyordu (Windows npm test yayını durdurmuyordu); tools/release.mjs hiç denetim yapmıyordu; master'da kural seti
  yok (API `rulesets` → []), klasik dal koruması bu oturumun yetkisiyle okunamıyor (403); depoda Claude Code kancası yoktu.
- Kurulan: (1) ci.yml → her test adımı `tools/kanit.mjs kos` ile (çıkış kodu + sayılar; çelişki/özetsiz/0 test = kırmızı), kayıtlar
  yüklenir; "Doğrulama Kapısı" işi needs sonuçlarını + kayıtları okur: 4 platform (Linux/Windows × Node 22/24) + bütün e2e bu commit'te
  GEÇTİ, Linux ve Windows AYNI sayıda test, atlanan test yok; `package` kapıya bağlı. (2) `tools/kanit.mjs ci <sha>` → yalnız ci.yml,
  kapı işi yeşil değilse YEŞİL demez. (3) tools/release.mjs → temiz ağaç + CI YEŞİL değilse imzalı paket ÜRETMEZ (atlatma yok).
  (4) release.yml → yayımdan önce `kanit.mjs ci "$GITHUB_SHA" --bekle 90`. (5) `.claude/settings.json` Stop + SubagentStop kancası → durum
  yeşil değilse yanıtı bir kez durdurur, makine durumunu (CI işleri, gönderilmemiş commit, değişmiş dosya; ajanda kendi worktree'si)
  modele dayatır.
- Sınır (dürüst): kanca ve yerel araç, kodu değiştirebilen biri tarafından değiştirilebilir (değişiklik git geçmişinde görünür).
  Sunucu tarafında bağlayıcı olan tek şey master için "Doğrulama Kapısı" zorunlu durum denetimi (GitHub → Settings → Rules) —
  bunu yalnız depo sahibi açabilir (bu oturumun belirteci yönetim yetkisine sahip değil, 403).
  Kullanıcı (10.10.2026: "link ver yapmaya çalışayım") → kural seti bağlantısı + adımlar verildi (ad "Doğrulama Kapısı", hedef
  varsayılan dal, atlatma listesi BOŞ, PR zorunlu, durum denetimi "Doğrulama Kapısı" kaynağı GitHub Actions). Kullanıcı "yaptım"
  deyince `gh api repos/ceougur/ofis---y-netimi/rulesets` ve `…/rules/branches/master` ile okunup doğrulanır.
  AÇILDI (kullanıcı, 10.10.2026 09:34 UTC; API'den okundu): kural seti 24836150 "Doğrulama Kapısı", enforcement active, hedef
  ~DEFAULT_BRANCH (yalnız master), bypass_actors [] ve bu oturum için current_user_can_bypass "never"; kurallar: deletion,
  non_fast_forward, pull_request (0 onay), required_status_checks [Doğrulama Kapısı] strict. Çalışma dalında kural 0 (push sürer).
  KAYNAK (kullanıcı, 10.10.2026 09:42 UTC; API'den okundu): required_status_checks [{context "Doğrulama Kapısı", integration_id
  15368 = GitHub Actions}] — başka uygulama aynı adla durum gönderip kapıyı geçemez. İlk kapı koşusu (CI 474, 180a8a5) gerçek
  Windows hatasında GEÇMEDİ dedi (Linux 1763/1763, Windows 1760/1763).
  KARAR (kullanıcı, 10.10.2026): ağ erişim ayarı (*.blob.core.windows.net) EKLENMEZ — tam CI günlüğü ve kanıt dosyaları (artifact)
  indirilemez; alternatif yol: kanıt aracı başarısız testlerin adını/yerini/hatasını çıktının SONUNA ve kapı özetine yazar, GitHub
  aracından son 5.000 satır + kapı tablosu okunur; ilk 5.000 satırın dışında kalan bilgi "okunamadı" diye yazılır (ders 4).

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
    (2.0.13: ayın 1'inde kırılan senaryolar.)
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

## Dil (kullanıcı, 10.10.2026: "türkçe yaz", "türkçe yaz bildirimlerini")
- Kullanıcıya giden HER yanıt, durum bildirimi ve liste Türkçe yazılır (İngilizce ara rapor yok).

## Kullanıcının tekrar eden şikâyetleri (aynı hataya düşme)
1. "Onca test yaptım deyip mantık hatalarını görmüyorsun." → Test sayısı değil senaryo çeşidi; kartları aç, kullan.
2. "Yayın öncesi sağlama" → GitHub'a birleştirme/yayın yok; önce paket, kullanıcı doğrular.
3. "Kişi bir kez girilir" → kayıt ↔ cari ↔ taksit zinciri tek girişle kurulur; isim eşleşmesi önerilir, çift cari açılmaz.
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
Aşağıdaki üç zip düzeni (1/2/3) bu tarihten önceki teslimler içindir; yerini yukarıdaki iki parça aldı.
Eski düzen — kullanıcı "zip ver" dediğinde şu üç zip + SHA256SUMS verilirdi:
1. `DestekOfis-<s>-1-Guncelleme-ve-Belgeler.zip` → içinde **`GitHub-v<s>/`** klasörü: `destekofis-guncelleme-<s>.zip`,
   `destekofis-guncelleme.json` (İMZALI), `DestekOfis-Kullanim-Kilavuzu.pdf`; kökte OKU-BENI, sürüm notları, belgeler.
2. `DestekOfis-<s>-2-Kurulum.zip` → içinde **`GitHub-v<s>/`**: `DestekOfis-Kurulum.exe` + `.sha256`.
   (Zip 50 MB'ı aşarsa dosya gönderiminde sınır var: .exe ve .sha256 ayrıca gönderilir.)
3. `DestekOfis-<s>-Kaynak-ve-Denetim.zip` (git bundle, test çıktıları).
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

## Açık iş
- 2.0.12 yayımlandı (PR ceougur/ofis---y-netimi#12, `v2.0.12`; beş dosya bayt bayt doğrulandı; müşteri: taksit kartının
  Kayıt Tarihi carinin tarihinden gelir).
- 2.0.13 yayımlandı (01.10.2026; PR ceougur/ofis---y-netimi#13, `v2.0.13` = 20e110d; beş dosya bayt bayt doğrulandı, latest/DestekOfis-Kurulum.exe
  2.0.13; dal `master` üzerine sıfırlandı): WhatsApp, ödeme yolu, Ana Defter,
  mutabakat kapısı, dört çekirdek (Kasa, Stok, Cari, Taksit) tarih/kilit/yuvarlama kuralları, Eksi Bakiye Denetimi
  (Nakit/Banka/Kredi Kartı: Uyar/Engelle/Kontrol Yok — kullanıcı onayı 01.10.2026), hepsini seç + hariç tut. Holding stres
  simülasyonu kullanıcı kararıyla iptal. Doğrulama: `npm test`, `npm run test:mutabakat`, `npm run mutabakat`,
  `npm run test:senaryo-whatsapp` (1.000 cari). Senaryolar tarihe bağlı yazılmasın (ayın 1'inde kırılanlar düzeltildi).
- 2.0.14 yayımlandı (01.10.2026; PR ceougur/ofis---y-netimi#14, `v2.0.14` = 6337029; beş dosya ve latest/ adresleri bayt
  bayt doğrulandı; gerçek güncelleyici 2.0.13 ve 2.0.12 olarak canlı GitHub'da 2.0.14'ü "available" gördü, indirme sha256
  eşleşti; dal `master` üzerine sıfırlandı): arama kutularında ve bütün programda odak (`HOF.swap`, `test:senaryo-214`),
  detay panelinde Cari Kartı (#hof-checks ↔ #hof-case-plan yer kavgası), WhatsApp Otomatik Sıra + kendiliğinden inen ekstre
  PDF'i, Tablodan Aktar geri alma damgası. Meta WhatsApp Business API (kendiliğinden gönderim + PDF eki) ayrı Pro özelliği
  olarak ileride tasarlanacak; resmî olmayan otomasyon yapılmaz.
- 2.0.15 yayımlandı (02.10.2026; PR ceougur/ofis---y-netimi#15, `v2.0.15` = 85171ae; beş dosya ve latest/DestekOfis-Kurulum.exe
  bayt bayt doğrulandı; gerçek güncelleyici 2.0.14/13/12/2.0.4/1.7.0 olarak yayındaki bildirgeyle 2.0.15'i "available" gördü;
  imza anahtarı: kullanıcının oturuma yüklediği .pem, `node tools/release.mjs --anahtar …`; kurulum .exe Wine + Inno Setup;
  dal `master` üzerine sıfırlandı). İçerik — 01.10.2026 kullanıcı isteği:
  1. Küçük düzeltme (müşteri): sol menüdeki "Yeni Kayıt" kalkar; ana listede "Dışa Aktar"ın yanına "Yeni Kayıt".
  2. FATURA modülü (sol sabit menüde "Fatura"): GİB e-Fatura/e-Arşiv, UBL-TR, PEPPOL uyumlu mimari. Kurallar: fatura
     kesilince stok (miktar/maliyet), cari (borç/alacak), vadeli/taksitliyse Taksit motoru, peşinse Kasa — hepsi tek
     BEGIN IMMEDIATE işlemde; KDV (%1/%10/%20…), tevkifat, KDV dahil/hariç, roundMoney; e-Fatura/e-Arşiv senaryoları
     (Temel/Ticari) için VKN/TCKN/MERSİS/adres/tüzel-gerçek doğrulaması; Entegratör Adaptör Katmanı (Logo, İzibiz,
     Digital Planet, QNB e-Finans, GİB) + PEPPOL; dönem kilidi ve tarih sızıntısı koruması; iptal/iade sonrası Kasa,
     Stok, Cari, Taksit ↔ Ana Defter mutabakat kapısı. Ayrıntı istekleri: cari kartında "Alış Faturası" ve "Satış
     Faturası" pilleri; panelde Alıştan İade / Satıştan İade (kasa, cari, çek/senet entegre); iade edilecek faturayı
     arama motoru en üstte; faturada Not (altına basılır); fatura tarihi ve saati; kesilen faturaları görüntüleme,
     süzgeç, seçim; fatura kartında 2 pil; cari + ürün girilince bu müşteriye ve başka müşteriye son alış/satış fiyatı.
     Kullanıcı: "sorman gereken yerde önerini yap; bitince seçtiklerini maddeler hâlinde yaz".
     Ek (aynı gün, ikinci mesaj): ÇEK/SENET de zincirde — tahsilat/ödeme türü Çek veya Senet ise fatura anında Çek/Senet
     modülüne portföy girişi (alış faturasında verilen evrak) yazılır ve cari ile mahsuplaşır; tümü aynı tek işlemde.
     Çek/Senet vade/işlem tarihleri de kronolojik kurala bağlı; mutabakat kapısı Çek/Senet alt defterini de kapsar.
     Ek (üçüncü mesaj): fatura modülü tüm diğer bölümlerle ve RAPORLARLA entegre, doğru mantıkla çalışacak (cari ekstre,
     Kasa, stok, taksit, çek/senet, ANLIK DURUM, Vade Takip, Rapor Merkezi, Ana Defter/mizan, WhatsApp ekstre, çöp/geri al).
     QA denetimi (02.10.2026, `docs/FATURA-QA-RAPORU.md`) sonrası kullanıcı kararı: icra dosyası bağı YAPILMAZ ("cariyi
     ekleyerek kesebilir müşteri"); diğer bulgular yapıldı: formda "+ Yeni Cari", toplu kes / toplu iptal, PDF'te logo
     (JPEG, 150 KB) ve kaşe/imza kutuları, kartta E-Posta, fatura kalemli stok kartı silinmez, "Fiyat Farkı Faturası".
     Testler: `test/fatura-215.test.mjs`, `senaryo-215` adım 12–14. Kullanım kılavuzuna "Fatura" bölümü eklendi
     (kullanıcı isteği; k24 ekranı; PDF yeniden üretildi, client/kilavuz'a kopyalandı — siteye yükleme kullanıcıda).
- 2.0.16 yayımlandı (02.10.2026; PR ceougur/ofis---y-netimi#16, `v2.0.16` = bd777e9; beş dosya ve latest/ adresleri
  (Kurulum.exe, guncelleme.json) bayt bayt doğrulandı; gerçek güncelleyici 2.0.15/14/13/12/2.0.4/1.7.0 olarak (Node 24.21,
  bootstrap 2) canlı yayında 2.0.16'yı "available" gördü, indirilen paket sha256 e1f38ccc… eşleşti; site kılavuz PR'ı
  ceougur/destekofis#4). 11 müşteri maddesi madde madde kanıtlı: `docs/2.0.16-KANIT.md`, `CHANGELOG.md` → 2.0.16,
  `test/fatura-216.test.mjs`, `npm run test:senaryo-216` (51 denetim; 42 rapor arayüzden ön izleme+PDF+Excel).
  Kararlar (önerim uygulandı; korunur): Düzenle yalnız satış/alış/SMM (iade belgesi iptal+yeniden); taksitinden tahsilat
  alınmış, iadesi olan, e-Belgesi gönderilmiş, kilitli dönemdeki faturada Düzenle kapalı; Toplamlar: Ara Toplam = matrah
  HER ZAMAN ayrı satır, iskonto varsa Toplam/İskonto KDV hariç (2.000 KDV dahil %10 → 1.666,67 − 166,67 = 1.500), iskontosuz
  KDV dahilde Toplam = girilen tutar (16.500 · 13.750 · 2.750 · 16.500); tahsilatta "POS", ödemede "Kredi Kartı" (kayıtlı
  değer `card`); "kes" yerine "kaydet"; Stok Kodu tekil. Eksi stok (kullanıcı kararı 02.10.2026): program sorar, "izin ver"
  denince eksiye düşer; bazı firmalar gerçek stok tutmaz; BÖYLE KALSIN, değiştirilmez.
  Güncelleyici denetimi notu: Node'un fetch'i vekil sunucuyu `NODE_USE_ENV_PROXY=1` ile kullanır (yoksa GitHub istek
  sınırı); `createUpdater({ nodeVersion: "24.21.0", bootstrapVersion: 2 })` — kurulu programın değerleri.
- 2.0.17 müşteri istekleri (02.10.2026'dan; kullanıcı "yap" dedi 02.10.2026; HEPSİ YAPILDI, dal `claude/nice-euler-jvajxv`,
  kanıt `docs/2.0.17-KANIT.md`, CHANGELOG → 2.0.17; madde 14 yalnız kılavuz notu; PR/paket/yayın kullanıcı onayıyla):
  DURUM: m9+m11 8000a70 · m5 13cc966 · m8 14295cf · m7 4e57d29 · m10 a7b8df2 · m1 481f43a · m4 1a11cee · m2+m3+m6+m12+m13
  çoklu şirket commit'i (hub + `sirketler/<kod>/`, sol üst şirket seçici, ortada sayfa şeridi, Yönetim → Şirketler,
  zil/takvim bütün sayfalar). Mimari: `docs/MIMARI.md` → "2.0.17 eklemeleri".
  1. Fatura listesinde SİLME yok (ekran: 10 belge, hepsi "İptal Edildi", Tümü seçili; seçim çubuğunda yalnız PDF/Excel/
     Temizle). Müşteri: tümünü seçip iptal eder gibi KOMPLE SİL; faturanın içinde (kartta) da "Sil" düğmesi.
     Koddan durum: `DELETE /api/workspace/invoices/:id` yalnız taslağı siler ("Kaydedilmiş fatura silinmez; düzenleyin
     ya da iptal edin."); toplu yalnız "Seçilenleri Kaydet" (taslak) ve "Seçilenleri İptal Et" (kaydedilmiş); iptal edilen
     belgeler listede kalıcı. Program genelinde Silinenler (routes/trash.mjs, Yönetim → geri yükleme) var.
     Öneri (yap'ta uygula): kartta "Sil" (taslak, kaydedilmiş, iptal edilmiş) + seçim çubuğunda "Seçilenleri Sil (n)";
     kaydedilmiş belge silinirken tek işlemde iptaldeki gibi bütün etkiler geri alınır (stok, cari, Kasa, taksit,
     çek/senet; mutabakat kapısı), belge listeden kalkıp Silinenler'e gider (geri yüklenirse etkisiz, "İptal Edildi"
     olarak döner). Engeller iptalle aynı (iadesi olan → önce iade; e-Belgesi gönderilmiş silinmez; kilitli dönem;
     tahsilatı alınmış taksit / işlem görmüş çek). Toplu silmede iade belgeleri önce (yeni tarihli önce); onay penceresinde
     sayı ve tutar; sonuç belge belge (silinen / nedeniyle silinemeyen). Numara: silinen serinin son numarasıysa sayaç
     geri alınır, aradaysa boşluk kalır. İşlem geçmişine yazılır; yetki: fatura yönetimi.
     Not: müşterinin ekranı 2.0.15 ("Kesilen" sekmesi, "Kesilen belgeler…" yazısı); 2.0.16'da "Satış Faturaları"/"Kaydedilen".
  2. ÇOKLU ŞİRKET (kullanıcı: "BUNU ÇOK İYİ ANLA"). Sol üstteki "çalışma oturumu" yerine ŞİRKET SEÇİMİ. Oturum açınca
     cariler kaybolmaz (oturum yalnız tablo verisini ayırır); ŞİRKET açınca her şey SIFIRDAN: cari, Kasa, stok, taksit,
     çek/senet, fatura, Ana Defter, tablolar — hiçbiri öbür şirketten gelmez. Örnek: resmî ve gayri resmî şirket ayrı.
     Koddan durum: tek veri tabanı (`config.dbPath`, `server/app.mjs` openDatabase); "oturum" = `dataset.sessions`
     (server/lib/dataset.mjs) yalnız Excel/tablo kümesini ayırır; cari/Kasa/stok/fatura tabloları oturumdan bağımsız, ortak.
     Öneri (yap'ta uygula; büyük mimari iş): şirket = AYRI veri tabanı dosyası (yaygın muhasebe programlarındaki "firma"
     gibi; veri karışması imkânsız, yedek/geri yükleme şirket bazında). Ortak katman: lisans, kullanıcılar, şirket listesi.
     Şirket içinde: bütün modüller + tablo oturumları + şirket ayarları (unvan, VKN, logo, fatura serisi, dönem kilidi, Kasa
     hesapları). Sol üstte "Şirket: <ad> ▾" (Şirket Değiştir, + Yeni Şirket, Yeniden Adlandır; silme yalnız yönetici, çift
     onay, önce yedek). Mevcut veri ilk şirket olur (göçte hiçbir kayıt kaybolmaz). Kullanıcı yetkisi şirket bazında
     (hangi şirketleri görür). Açık pencereler/olay akışı/bildirimler/önbellek şirket değişince sıfırlanır; her istek
     seçili şirkete gider; raporlar, PDF/Excel başlığı şirket unvanıyla. Güncelleyici, yedek, mutabakat her şirket için.
     Testler: iki şirkette aynı adlı cari, birinde tahsilat → öbüründe Kasa/cari değişmez; geçişte açık pencere eski şirket
     verisi göstermez; yetkisiz kullanıcı şirketi göremez; göç provası (eski veri = ilk şirket, sayılar aynı).
     KARAR (kullanıcı, 02.10.2026): şirket sayısı lisansa BAĞLI DEĞİL (herkese sınırsız). Şirketler arası BİRLEŞİK
     RAPOR İLK SÜRÜMDE OLACAK (seçilen şirketlerin Kasa, cari, stok, fatura, ANLIK DURUM toplamları yan yana + toplam;
     yalnız kullanıcının yetkili olduğu şirketler; her satırda şirket adı; PDF/Excel).
     Müşteri açıklaması (aynı konu): "001 kodlu şirket, 002 kodlu şirket diye datada ayırır, ikisinin datasını ayrı
     tutar" → her şirketin ŞİRKET KODU olur (001, 002, 003… sıradaki kod önerilir, değiştirilebilir, tekil, 3 hane).
     Veri dosyası koda bağlı (ör. `sirketler/001/…`); seçicide, sol üstte, rapor/PDF/Excel başlığında ve birleşik
     raporda "001 · Unvan" biçiminde görünür. Kod değişse de veri aynı şirkette kalır (iç kimlik ayrı).
  3. ÇALIŞMA OTURUMU KALKAR (kullanıcı, 02.10.2026; ekran: sol üstte "Çalışma Oturumu ▾", açılır listede "İcra ve Dava
     Takip Dosyaları · 1.598 kayıt · Sheets'e bağlı", "+ Yeni Oturum Aç", "Oturumları Yönet"): 2. madde (şirket) gelince
     gereksiz, kafa karıştırır → oturum seçicinin yerini ŞİRKET seçici alır; "Oturum" sözcüğü arayüzden, kılavuzdan,
     Yönetim'den kalkar. Kod: `client/assets/hof-sessions.js` (seçici, Yeni Oturum Aç, Oturumları Yönet),
     `server/lib/dataset.mjs` `dataset.sessions`/`dataset.session.user.*` (kullanıcıya göre oturum). Sol alttaki "Senkron
     Aktif" kartı oturum adı yerine şirket ("001 · Unvan") ve tablo bağlantısını gösterir.
     Öneri (yap'ta uygula): her şirketin TEK tablo kümesi olur (sekmeler + Sheets bağlantısı şirkette). Göç: tek oturum
     varsa sessizce 001'in tablosu olur. Birden fazla oturum varsa yöneticiye tek seferlik "Oturumları Taşı" ekranı:
     her oturum için "001'in tablosu" (yalnız biri) / "Yeni Şirket Yap" (o oturumun tablosuyla, cari/Kasa sıfır) /
     "Silinenler'e Al" (geri yüklenebilir). Hiçbir kayıt kendiliğinden silinmez; seçim yapılana kadar 001'in tablosu
     varsayılan oturumdur. Test: tek/çok oturumlu eski veriden göç, Sheets bağı korunur, sayılar aynı.
  4. GÜNCELLEME GEÇ GELİYOR (kullanıcının kendi kurulumu, 02.10.2026 14:28): 2.0.14'te kaldı; 2.0.15 (07:44) ve 2.0.16
     (10:38) yayımlandığı halde gelmedi; "Güncellemeleri Denetle" → "Güncelleme sunucusu zamanında yanıt vermedi."; 2 dk
     sonra yeniden denemede 2.0.16 bulundu ("aldı şimdi"). Kök neden (koddan): (a) otomatik denetim YALNIZ servis
     açılışında (`update-orchestrator.mjs` startup → runCheck) + hata sonrası 4 yeniden deneme; servis 22 saat açık
     kalınca yeni sürüm hiç denetlenmez → periyodik denetim yok. (b) tek istek 10 sn zaman aşımı (`requestTimeoutMs`) ve
     GitHub API'den 30 yayının tamamı (~367 KB, gövdeler dahil) çekiliyor; elle denetimde yeniden deneme yok.
     Öneri (yap'ta uygula): servis açıkken 6 saatte bir (+ rastgele kayma) sessiz denetim; bulunursa "Sunucu açılışında
     kendiliğinden kur" açıksa mesai dışı/boşta kurulum ya da yöneticiye bildirim (zil) "2.0.x hazır — Şimdi Güncelle";
     istek zaman aşımı 30 sn, elle denetimde 3 deneme (artan bekleme); `per_page=10`; API erişilemezse yedek yol
     `releases/latest/download/destekofis-guncelleme.json` (API'siz, istek sınırı yok). Test: sahte sunucuyla gecikme,
     zaman aşımı, periyodik denetim saati (sahte saat), yedek yol.
  5. HAYALET KISMİ ÖDEME (müşteri, 2 kez; ekran: Alış Faturası 89, Mehmet Eren Demir, 6.000, "Kısmen Ödendi", "Peşin
     ödeme yok. Açık: 5.600 · ödenen 400"; müşteri ödeme yapmadı). Kök neden (koddan + yeniden üretildi,
     `settleInvoices` ile): `server/lib/invoice-settle.mjs` otomatik FIFO kapama — alış tarafında carinin BÜTÜN borç
     (debit) satırları "ödeme" sayılır, faturaya bağlı değilse en eski açık alış faturasına dağıtılır. Aynı cari hem
     müşteri hem tedarikçi olunca: aynı kişiye 400'lük SATIŞ faturası, cari kartından başka iş için 400 ödeme, ya da
     400'lük borç/taksit kartı → alış faturası "Kısmen Ödendi · ödenen 400". Tersi de var (alış/alacak satırı satış
     faturasını "ödenmiş" gösterir). Kartta neyin kapattığı da görünmüyor.
     Öneri (yap'ta uygula): (a) kapama YÖNE göre: alış faturasını yalnız ödeme niteliğindeki satırlar kapatır (Kasa/
     banka/POS ödemesi, verilen çek/senet, alıştan iade, carinin alacak açılışı değil borç açılışı); satış faturası,
     taksit kartı borcu, borç kaydı ödeme SAYILMAZ (satış ↔ alış karşılıklı kapama yalnız açık "Mahsup Et" işlemiyle,
     yaygın programlardaki mahsup fişi gibi; cari BAKİYESİ zaten netleşir, değişmez). Satış tarafında simetrik.
     (b) cari kartında ödeme/tahsilat formunda "Kapatılacak Fatura: Otomatik (En Eski) / <fatura seç>"; seçilirse bağlı.
     (c) fatura kartında "Bu Faturayı Kapatanlar" listesi (tarih, tür, tutar, otomatik/bağlı) — her ödenen kuruşun
     kaynağı görünür. (d) mutabakat: fatura ödenen toplamı = bağlı + FIFO dağıtılanlar. Test: hem müşteri hem tedarikçi
     cari (satış 400 + alış 6.000 → alış Açık 6.000), bağsız ödeme FIFO, Mahsup Et, seçilen faturaya ödeme, iptal/silme
     sonrası kapama yeniden hesap, 2.0.15/2.0.16 verisinde durum değişimi raporu.
     Ek (müşteri, aynı gün): "faturayı kaydettin, kopyaladın, kopyayı kaydedince kısmen ödendi yapıyor". Koddan +
     API ile denendi: Kopyala ödeme TAŞIMIYOR (`startForm({ copyOf })` → `pay: payFrom(draft?.payment)`, kopyada boş);
     tek başına kopya "Açık" kalıyor. Görülen, AYNI kök neden (FIFO, madde 5): carideki fazla borç satırı (ör. aynı
     kişiye satış) önce en eski alış faturasını kapatır, artanı en yeni faturaya — yani kopyaya — düşer → kopya
     "Kısmen Ödendi · 400". Denemede aynı cariye 2 satış (6.000) girilince 2 alış faturası da "Ödendi" oldu. Madde 5'in
     düzeltmesiyle kapanır; testine "kopyala → kaydet → Açık" ve "satış + alış + kopya" eklenecek.
  6. ŞİRKET VERİSİNİ SIFIRLA (müşteri Ahmet Alanlı, 02.10.2026 14:40; Şahin de isteyecek): "bulunduğumuz şirket
     üzerindeyken tüm hareketleri sil / datayı sıfırla; varolan datayı komple sıfırlayıp yeniden girmek istiyoruz";
     "datayı silerek çözerim de lisansım gider". Koddan: lisans aynı veri tabanında (`server/lib/license.mjs`
     store.setting: token, makine kimliği, deneme başlangıcı) → veri klasörünü silen lisansı da kaybeder.
     Öneri (yap'ta uygula; 2. maddeyle birlikte): Yönetim → seçili şirket → "Şirket Verisini Sıfırla" (yalnız yönetici).
     İki seçenek: "Tüm Hareketleri Sil" (cari/stok kartları, Kasa hesapları, ayarlar KALIR; bakiyeler sıfır: cari
     hareketleri, Kasa, stok hareketleri, faturalar, taksitler, çek/senet, Ana Defter, işlem geçmişi silinir) ve "Tümünü
     Sıfırla" (şirket ilk açıldığı gibi boş; şirket adı/kodu, unvan/VKN/logo, fatura serisi kalır). Öncesinde ZORUNLU
     yedek (adı "sifirlama-öncesi-<tarih>", Yedekler'den geri yüklenebilir); onay: şirket kodunu/adını yazdırma + parola.
     Lisans, kullanıcılar, öbür şirketler etkilenmez (ortak katman). Numaralar (fatura serisi sayaçları) sıfırlanır mı
     sorulur (varsayılan: sıfırlanır). İşlem geçmişine "veri sıfırlandı" kaydı kalır. Test: sıfırla → lisans aynı,
     kullanıcılar giriş yapar, öbür şirket sayıları aynı, sıfırlanan şirkette her rapor boş, mutabakat 0; yedekten
     geri yükle → sayılar eski hâline döner.
  7. EKSİ STOK KAÇA DÜŞTÜ GÖRÜNMÜYOR (müşteri, 02.10.2026): "stok miktarında eksiye düşenin kaça düştüğünü göstermiyor;
     eksiye düşerek devam edebilmesi lazım −10 −15 −20 gibi". Koddan + 2.0.16'da API ile yeniden denendi: VERİ DOĞRU —
     0'dan 10, 5, 5 satışta (her biri sorulup "Yine de Kaydet") stok kartı/liste/fatura önerisi −10 → −15 → −20 oluyor;
     eksiye düşme kararı (kullanıcı 02.10.2026: sorulur, izinle düşer) çalışıyor. Görünüm açıkları: (a) eksi üründe
     yalnız "Tükendi" rozeti (hof-stock.js stateBadge; Stok Durumu raporu durum kolonu `qty <= 0 ? "Tükendi"`) — 0 ile
     −20 aynı görünüyor; (b) soru metni sonucu söylemiyor ("stokta −10 var; faturadaki 5 eksiye düşürür" → kayıttan
     sonra kaç olacağı yok); (c) Değer `Math.max(0, qty)` ile 0; (d) ANLIK DURUM/Kritik Stok eksi ürünü ayrı saymıyor.
     Müşteri 2.0.15'teydi; hangi ekranda gördüğü sorulacak (ekran görüntüsü). Öneri (yap'ta): eksi üründe rozet "Eksi
     Stok −15 Adet" (kırmızı), 0'da "Tükendi"; soru: "Kayıttan sonra stok: −15 Adet olacak"; stok listesinde "Eksi
     Stoktakiler" süzgeci ve sıralama; Stok Durumu raporunda durum "Eksi (−15)"; ANLIK DURUM'da "Eksi Stok: n ürün";
     fatura kalem satırı "Stokta −15 Adet" kırmızı; Değer eksi miktarda "—" (maliyet bilinmiyor) ya da eksi değer —
     yaygın programlarda eksi miktar × son maliyet gösterilir → öyle. Test: 0→−10→−15→−20 arayüzden; her ekranda sayı.
  8. ÇEK CİRO: CARİ BULUNMUYOR (müşteri, ekran: "Ciro Et · Çek ₺3.000", "Ciro Edilen Cari (tedarikçi)" kutusunda hiçbir
     cari gelmiyor). Kök neden (koddan): `client/assets/hof-cheques.js:279` seçici `type: "supplier"` → sunucu
     `/api/workspace/accounts/search?type=supplier` yalnız türü "Tedarikçi" olan carileri döndürür (`accounts.mjs` list:
     `if (type && row.type !== type) continue`). Carilerin çoğu "Müşteri" (kayıttan/faturadan açılan) → liste boş.
     Program genelinde türe kısıtlı başka seçici yok (yalnız burası). Öneri (yap'ta): ciroda BÜTÜN cariler aranır
     (müşteriye de ciro edilir: borç ödemesi, mal alımı); tedarikçiler listede üstte, tür rozetiyle; etiket "Ciro Edilen
     Cari"; seçicide "+ Yeni Cari" (fatura formundaki gibi); boş sonuçta "Bu adla cari yok — + Yeni Cari". Aynı denetim
     tahsil/ödeme/teminat formlarındaki seçicilere de (tür kısıtı kalmasın). Test: yalnız Müşteri türünde carisi olan
     veride ciro arayüzden; tedarikçi + müşteri aynı adla; ciro sonrası cari bakiyesi, çek durumu "Ciro Edildi", Kasa aynı.
  9. ÖNCELİKLİ — KASA PENCERESİNDE ÖDEME YOLU YALNIZ NAKİT (kullanıcı, 02.10.2026: "dün konuşmuştuk, yapmamışsın,
     müşteriye mahçup oldum"; bu istek hiçbir notta/CLAUDE.md'de/CHANGELOG'da kayıtlı DEĞİLDİ — kaybolmuştu). Kasa
     penceresinin kendi formları "Kasaya Tahsilat Ekle" / "Kasadan Ödeme Ekle" / "Tahsilatı/Ödemeyi Düzelt"
     (`client/assets/hof-workspace.js` editCashEntry → `HOF.methodField(... cashView.method ...)`) Havale/EFT, POS,
     Kredi Kartı seçeneği gösteriyor. İstenen: Kasa'da tahsilat ve ödeme yolu YALNIZ NAKİT — açılır liste yok, sabit
     "Nakit" (sunucu da Kasa formundan gelen nakit dışı yolu reddeder). Banka/POS hareketleri cari, fatura, taksit,
     stok, çek ekranlarından gelir; Kasa penceresindeki Banka / POS sekmeleri yalnız GÖRÜNTÜLEME (o sekmedeyken
     "+ Tahsilat/Ödeme" düğmesi Nakit Kasa'ya yazar ve bunu söyler, ya da sekmede gizlenir). Düzeltmede eski kayıt
     nakit dışıysa yolu değiştirilmez, salt okunur gösterilir. Aynı kontrol: detay kartı Tahsilat (`hof-workspace.js`
     45/355) hangi yolu sunuyor — kullanıcıya sorulmadan değiştirilmez, yap'ta ekranla birlikte gösterilir. Test:
     arayüzden Kasa → Tahsilat Ekle / Ödeme Ekle formunda yalnız Nakit; API'ye bank/card gönderilince 400; Banka
     sekmesindeyken eklenen hareket Nakit Kasa'da.
     Ek (müşteri, aynı gün, ekran: Kasa ve Banka penceresi, "Tümü / Nakit Kasa / Banka (Havale / EFT) / POS / Kredi
     Kartı" sekmeleri işaretli): MANTIK = KASADA YALNIZ NAKİT AKIŞI görünür, başka hiçbir şey. Banka/POS/Kredi Kartı
     sekmeleri ve "Kasa ve Banka Toplamı" Kasa penceresinden KALKAR (pencere adı "Kasa", gösterge "Nakit Kasa"; Kasa
     Dökümü PDF yalnız nakit). Banka modülü henüz yok → havale/EFT, POS, kredi kartı hareketleri (cari, fatura, taksit,
     stok, çek ekranlarından girilenler; veri zaten `method` ile tutuluyor, hiçbir kayıt kaybolmaz) RAPORLARA taşınır:
     Raporlar'da "Banka ve POS Hareketleri" (yol süzgeci: Banka / POS / Kredi Kartı; tarih aralığı; giriş-çıkış-bakiye;
     PDF/Excel) + ANLIK DURUM'da Nakit Kasa ile Banka/POS ayrı kartlar. Kasa ↔ Banka TRANSFERİ: Kasa'da "Banka'dan Kasaya
     Aktar" / "Kasadan Bankaya Yatır" — Kasa'da NAKİT giriş/çıkış olarak görünür, banka raporunda karşı hareket; tek
     işlemde, mutabakat kapısında. Detay kartı/cari/fatura tahsilatlarında Havale/POS seçimi KALIR (Kasa'ya değil banka
     raporuna düşer) — önceki sorum bununla cevaplandı. Eksi Bakiye Denetimi (Nakit/Banka/Kredi Kartı) kalır. Test: Kasa'da
     yalnız nakit; bankaya tahsilat Kasa toplamını değiştirmez, raporda görünür; transfer iki tarafta; eski verideki
     bank/card Kasa kayıtları raporda, Kasa'da yok; mutabakat 0.
  10. İADE FATURASINDA DÜZENLE PASİF (müşteri, ekran: Satıştan İade Faturası IAD2026000000003, Mehmet Eren Demir, 600,
     asıl fatura FIS2026000000009; "Düzenle" gri, tıklanmıyor). Koddan: 2.0.16'da bilinçli karar (benim önerim) —
     `server/routes/invoices.mjs:382` modifyBlock "İade belgesi düzenlenmez; yanlışsa iptal edip yeniden kaydedin.";
     neden yalnız düğmenin üstüne gelince (title) görünüyor, ekranda yazmıyor → müşteri "izin vermiyor" görüyor.
     Öneri (yap'ta): iade faturası da DÜZENLENİR — aynı numara, tek işlemde eski etkiler geri alınıp yenisi yazılır
     (stok, cari, Kasa/banka iadesi, çek; mutabakat kapısı), asıl faturayla bağ korunur; sınırlar: iade miktarı asıl
     faturanın kalan iade edilebilir miktarını aşamaz (bu iade hariç hesap), tarih asıl faturadan önce olamaz, asıl
     fatura/cari değiştirilemez (gerekirse iptal + yeni). Ayrıca GENEL: pasif düğmenin nedeni düğmenin yanında/altında
     görünür yazı olarak çıkar (yalnız title değil) — Düzenle, İptal Et, Sil, İade için. Not: bu iadede ödeme satırı
     "Ödeme (Kredi Kartı) 600" — müşteriye karta iade; satıştan iadede yol adı "POS İadesi" daha doğru, yap'ta kontrol.
     Test: iade düzenle (miktar azalt/artır sınırda, fiyat, ödeme yolu) → stok/cari/Kasa yeni hâl; aşan miktar 409;
     asıl faturanın "iade edilebilir" kalanı doğru; pasif düğme nedeni ekranda.
  11. BANKA MODÜLÜ YOKKEN BANKA EKSİ BAKİYE UYARISI (müşteri, ekran: Satıştan İade, müşteriye iade ödemesi Havale/EFT →
     "Banka Bakiyesi Eksiye Düşecek — Banka hesabında (Havale / EFT) −3.600,00 TL var; 3.600,00 TL çıkış bakiyeyi
     −7.200,00 TL eksiye düşürür"). Koddan: `server/lib/pay-method.mjs` NEGATIVE_DEFAULT { cash, bank, card: "warn" };
     `server/routes/cash.mjs` guardOut banka/POS "bakiyesini" yalnız programa girilmiş havale/POS hareketlerinden
     hesaplar — açılış bakiyesi, banka ekstresi, mevduat yok → sayı anlamsız, uyarı yanıltıcı. Öneri (yap'ta; madde 9
     ile birlikte): Banka modülü gelene kadar Eksi Bakiye Denetimi YALNIZ NAKİT KASA için (Banka ve POS/Kredi Kartı
     denetimi kapalı; Yönetim → Eksi Bakiye Denetimi'nde yalnız "Nakit Kasa" alanı görünür; mevcut kurulumlarda bank/card
     ayarı göçle "off"). Banka modülü gelince (açılış bakiyesi + hesaplar) denetim geri açılır. Madde 9'daki "Eksi Bakiye
     Denetimi (Nakit/Banka/Kredi Kartı) kalır" cümlesi bu maddeyle DEĞİŞTİ. Test: havale ile iade/ödeme → soru çıkmaz;
     nakit iade Kasa'yı eksiye düşürecekse soru çıkar; Yönetim ekranında yalnız Nakit Kasa ayarı.
  12. "+ SAYFA → EXCEL'DEN AKTAR" SERBEST IZGARA OLUYOR, TARİH UYARISI YOK (müşteri, ekran: sekmeler "REHBER 9176" ve
     "AKABE 16"; AKABE "Serbest Sayfa" — A/B/C kolon harfli Excel ızgarası, "sigorta tarihi" kolonunda 03.10.2026 var
     ama yaklaşan tarih uyarısı gelmiyor). İstenen: Excel'den aktarılan sayfa, OTURUM AÇARKEN yüklenen Excel gibi
     alınsın (veri sekmesi: ön izleme + kolon rolleri, tarih kolonu tanınır, takvim/uyarı/detay kartı çalışır). Koddan:
     "+ Sayfa" aktarımı `server/lib/free-import.mjs` → serbest sayfa (`free-sheets.mjs`); `dataset.mjs` yalnız satırlarını
     görünüme ekliyor (freeProvider.viewRows), kolon rolleri/tarih sınıflandırıcısı ve uyarı motoru (`alerts.mjs`)
     serbest sayfayı veri sekmesi gibi işlemiyor (yap'ta kesin doğrulanacak). Öneri (yap'ta): "+ Sayfa" penceresinde
     "Excel / Google Sheets'ten Aktar" = VERİ SEKMESİ (ilk yüklemedeki ön izleme ve eşleme ekranı: kolon rolleri, tarih
     anlamı, %90 otomatik + şüpheliler sarı) → sekme mevcut şirketin tablosuna eklenir, uyarılar/takvim/rapor/detay
     kartı onu da kapsar; "Boş Sayfa" (elle doldurulan ızgara) seçeneği ayrı kalır. Mevcut serbest sayfalar için
     sekme menüsünde "Veri Sekmesine Dönüştür" (veri kaybı yok, geri alınabilir). Test: tarih kolonlu Excel'i + Sayfa
     ile aktar → yarın tarihli satır için zil/sağ alt uyarısı ve tahsilat takviminde görünür; aynı dosya ilk yüklemedeki
     gibi aynı rolleri alır; dönüştürme sonrası satır sayısı aynı.
  13. YENİ DÜZEN — SOLDA ŞİRKET, ORTADA SAYFA = OTURUM (müşteri, aynı gün; madde 2, 3 ve 12'yi birleştirir/günceller):
     "oturumu komple kaldırırsak oturum kısmını buraya (+ Sayfa) taşıyalım; buradan aldığımızı oturumdan almış gibi
     yapsın — ikinci sayfa ikinci oturum, üçüncü sayfa üçüncü oturum"; "sol taraf şirket seçimi ve şirketle ilgili
     modüller (Cari, Kasa, Stok, Fatura, Taksit, Çek/Senet, Raporlar…); orta kısım serbest alan, oturumlarımızın sayfa
     sayfa olacağı alan". Kullanıcı: "değerlendir". DEĞERLENDİRME (önerim; yap'ta uygulanır):
     - Doğru ve yaygın düzen (sol: firma + modüller; orta: çalışma sayfaları). Oturum seçici kalkar; eski "oturum"
       = ortadaki SAYFA. Her sayfa ayrı veri kümesi: kendi kaynağı (Excel / Google Sheets bağı, senkron), kolon rolleri,
       tarih anlamı, veri sağlığı. "+ Sayfa" seçenekleri: "Excel / Google Sheets'ten Aktar" (ilk yüklemedeki ön izleme
       + eşleme ekranı — veri sayfası) ve "Boş Sayfa" (elle doldurulan ızgara, bugünkü serbest sayfa).
     - Fark (oturuma göre KAZANÇ): oturumda yalnız seçili oturum görünüyordu, uyarılar onunla sınırlıydı; sayfa düzeninde
       şirketin BÜTÜN sayfaları aynı anda canlı → tarih uyarıları, tahsilat takvimi, zil, ANLIK DURUM, raporlar ve arama
       hepsini kapsar (müşterinin "tarih uyarısı vermiyor" şikâyeti kökten kapanır); her satırda sayfa adı görünür.
     - Bir Excel dosyasında birden çok sekme varsa: her sekme ayrı sayfa olur, aynı kaynaktan geldiği sayfa pilinde
       görünür ve birlikte senkron olur (bugünkü REHBER/AKABE gibi).
     - Kayıt ↔ cari ↔ taksit bağı sayfadan bağımsız sürer (satır hangi sayfada olursa olsun cariye bağlanır).
     - Göç: mevcut oturumların HER BİRİ 001 şirketinde ayrı sayfa(lar) olur (madde 3'teki "Oturumları Taşı" ekranına
       gerek kalmaz; hiçbir şey silinmez, Sheets bağları korunur). Mevcut serbest sayfalar "Boş Sayfa" olarak kalır,
       menüde "Veri Sayfasına Dönüştür" (madde 12).
     - Dikkat: tüm sayfalar birden yüklenince büyük veride hız (REHBER 9.176 satır + diğerleri) → arama/analiz
       sayfa bazında önbellekli; 20.000+ satırla ölçüm testi. Sayfa bazında yetki (kim hangi sayfayı görür) ilk
       sürümde yok, istenirse eklenir. Sayfa silme yalnız yönetici, Silinenler'e gider.
     Test: iki Excel'i iki sayfa olarak aktar → ikisindeki yaklaşan tarihler zil/takvimde; sayfa adı satırda; birinden
     cari bağla; eski 2 oturumlu veriden göç → 2 sayfa, sayılar ve Sheets bağı aynı; 20.000 satırda arama < 1 sn.
     Ek (kullanıcı, ekran: sol üstte "ÇALIŞMA OTURUMU · TÜM REHBER.xlsx ▾", altında "Operasyon Merkezi" Görevler/Mesajlar/
     Görev Ata/Cari): KESİN — o kutunun yerine ŞİRKET SEÇİMİ gelir (aynı yer, aynı boyut: "ŞİRKET · 001 · Unvan ▾");
     oturum (dosya/sayfa) seçimi ORTAYA, sayfa pillerine taşınır.
  14. "EXCELİM SAPITTI — PROGRAM EXCEL VERİLERİNE MÜDAHALE EDİYOR OLABİLİR Mİ?" (müşteri, 02.10.2026; kullanıcı iletti):
     sıralama için 1-2-3 yazıp sürükle-bırakınca boş atıyor; doldurma tutamacına çift tıklayınca alta kadar
     numaralandırmıyor. KODDAN DURUM: program müşterinin Excel DOSYASINA HİÇ YAZMAZ — dosya tarayıcıda okunur
     (`hof-excel-worker.js`, SheetJS, salt okuma), satırlar programın veri tabanına kopyalanır; Google Sheets de yalnız
     okunur (export). "Dışa Aktar" YENİ bir .xlsx üretir (`server/lib/xlsx-write.mjs`: sayılar sayı hücresi `<v>`,
     metinler inlineStr) — müşterinin kendi dosyasına dokunmaz. Yani Excel'deki bu davranış programdan kaynaklanamaz.
     Müşteriye söylenecek olası nedenler (Excel tarafı): (a) Dosya → Seçenekler → Gelişmiş → "Doldurma tutamacını ve
     hücre sürükleyip bırakmayı etkinleştir" kapanmış (en sık neden; çift tık + sürükleme ikisi birden ölür); (b) 1 ve 2
     yazılı hücreleri BİRLİKTE seçmeden sürüklerse Excel kopyalar/boş atar; sürüklerken Ctrl basılıysa kopyalar;
     (c) hücreler "Metin" biçimindeyse (ör. başka yerden yapıştırılmış, başında kesme işareti) seri üretmez — Veri →
     Metni Sütunlara Dönüştür ya da biçimi Genel yapıp yeniden gir; (d) çift tık yanındaki sütun boşsa durur (Excel
     kuralı); (e) Flash Fill / otomatik tamamlama ayarları ya da bozuk Excel profili — Dosya → Seçenekler → Gelişmiş'te
     "Hücre değerleri için Otomatik Tamamlama'yı etkinleştir"; olmazsa Excel Onarım (Denetim Masası → Programlar → Onar).
     Öneri (yap'ta): kılavuz "17. Bir Sorun mu Var?" bölümüne "Excel'de doldurma tutamacı çalışmıyor" maddesi (program
     dosyaya yazmaz + yukarıdaki adımlar); programın Dışa Aktar'ından inen dosyada sayıların sayı olarak geldiğinin
     testi (`test/xlsx-write` — var mı denetlenir, yoksa eklenir). Müşteriden ekran görüntüsü ve dosyanın programdan mı
     indiği (Dışa Aktar) yoksa kendi dosyası mı olduğu sorulacak.
  15. CARİ ADI YANLIŞ KOLONDAN GELİYOR (kullanıcı, 02.10.2026 19:3x; ekran: "Marka ve Patent Yönetimi" sektörü, kolonlar
     Başvuru No · Başvuru Sahibi · Telefon · Marka / Buluş Adı · Tür · Nice Sınıfı; kayıt GÜLDAL KARE / FURRA → cari adı
     "FURRA", HİMMET ERTAŞ / TENYE → "TENYE"; ilk kayıt NARAN YILDIZ ise doğru ad almış). Kullanıcı: "caride niye isim
     soy isim yerine başka yeri çekiyor?" Beklenen: cari adı kişi/firma kolonundan (Başvuru Sahibi), marka adı değil.
     KÖK NEDEN (koddan): kayıttan cari açan tek-kayıt yolu (Yeni Kayıt → "cari kartı da aç", ad eşleşmesi önerisi,
     kayıttan taksit) istemcideki `hof-plans.js` nameColumn/personOf sezgisini kullanıyordu: "ad/adı" geçen ilk kolonu
     alıyordu ("Marka / Buluş Adı"), sunucu analizinin bulduğu kişi kolonuna (`primary.person` = Başvuru Sahibi) bakmıyordu.
     Sunucu analizi (`insight/columns.mjs`: party > name, "ürün/marka/proje adı" = öğe adı, kişi değil) doğruydu.
     DÜZELTME (program geneli, kullanıcı 02.10.2026 "sadece bu sektör için olmasın"): personOf önce analizdeki kişi
     kolonunu alır; öğe adı kolonları (ürün, marka, buluş, proje, hizmet, model, dosya, araç…) hiçbir zaman ad sayılmaz,
     taraf sözcüğü (müşteri, borçlu, sahibi, başvuran…) olan kolon öncelikli; Adı + Soyadı ayrıysa birleştirilir.
     Test: `npm run test:senaryo-218` (4 tablo biçimi: marka/patent, sipariş Ürün Adı+Müşteri, Adı/Soyadı ayrı, icra Borçlu).
     EK SORU (kullanıcı, aynı gün): "birden fazla isim soy isim ya da ad da olabilir tabloda; Tablodan Çek dediğimizde bu
     hata geniş bir alana yayılır mı?" KODDAN DURUM (7 tablo biçimiyle ölçüldü): toplu yollar ayrı ayrı kural listesi
     kullanıyor — Cari "Tablodan Al"/Excel (`accounts.mjs` mapAccountHeaders), Taksit Excel (`plans.mjs` mapHeaders),
     Çek/Senet (`cheques.mjs` drawer); Taksit "Tablodan Aktar" ve detay kartı sunucu analizini (`primary.person`) kullanır.
     Marka/patent, sipariş (Müşteri + Yetkili Kişi), icra (Borçlu + Alacaklı + Avukat), emlak (Kiracı + Mal Sahibi),
     hastane (Hasta + Doktor) tablolarında dört yol da doğru kişiyi seçti; AÇIKLAR: "Adı" + "Soyadı" + "Eşinin Adı" (dernek)
     tablosunda toplu yollar ad kolonu bulamıyor (kullanıcı elle seçer, soyad birleşmez); "Öğrenci Adı" + "Öğrenci Soyadı"
     ayrı kolonlarsa analiz birleştirmiyor (yalnız "Adı"/"Soyadı" başlıklarını birleştiriyor); Çek/Senet okulda Veli'yi
     seçiyor; iki taraf kolonu eşit ağırlıktaysa (Kiracı/Mal Sahibi) seçim benzersizliğe kalıyor, kullanıcıya gösterilmiyor.
     Kullanıcı: "çözüm önerin nedir?" → "benim önerimi dinle, durdur işlemini" → ÖNERİSİ (02.10.2026, ekran: Cari
     penceresi, NARAN YILDIZ ek alanlı + TENYE/FURRA ek alansız): "Tablodan Al özelliğini kaldırmak en kolay çözüm";
     "cariyi ya Excel'den/Sheets'ten ya da elle oluştursun kullanıcı". Koddan not: ekrandaki TENYE/FURRA "Tablodan Al"dan
     değil, Yeni Kayıt → "cari kartı da aç" yolundan açılmış (ek alanı yok); NARAN YILDIZ Tablodan Al'dan ve doğru.
     Karar kullanıcıda; verilince bu maddeye yazılır. Tek-kayıt yolu düzeltmesi + kayıt başlığında Adı+Soyadı birleşik
     (recordLabel → personOf) dalda commit'li (c32f3b0), PR yok.
     Kullanıcı sorusu (aynı gün): "detay kartında Cari Kartı pili de boşa düşer mi o zaman?" KODDAN: detay kartındaki
     CARİ kutusu yalnız kayda `case_key` ile BAĞLI cariyi gösterir (`GET cases/:key/account`, ad eşleşmesi yok). Bağ
     kuran yollar: Yeni Kayıt "cari kartı da aç", Tablodan Al (caseKeys), Taksit Tablodan Aktar / kayıttan taksit
     (createFromPlan), "+ Yeni Cari" formundaki "Tablodaki Kayıt" alanı (ad yazılınca tek eşleşen satır önerilir).
     "Excel / Sheets'ten Yükle" kayda BAĞLAMAZ (caseKeys yok) → o carilerde pil çıkmaz, kayıttaki "+ Tahsilat" cari
     defterine değil eski kayıt tahsilatına düşer. Bu, Tablodan Al'ın var oluş nedeni.
     Kullanıcının hatayı bulduğu yol (aynı gün, kendi sözleriyle): "Tablodan Al'ı bir kere tıklayınca senkronize oluyor;
     tablodan Yeni Kayıt tıklayıp doldurunca otomatik cariye çekti, çekerken cari ismini saçmaladı." = Yeni Kayıt →
     "cari kartı da aç" yolu (varsayılan işaretli); koddaki kök nedenle birebir, düzeltme c32f3b0 (senaryo-218 ilk tablo
     tam bu akış: marka/patent tablosu → Yeni Kayıt → cari GÜLDAL KARE, FURRA açılmaz).
     Kullanıcı (aynı gün): "Tablodan Al butonu doğru çalışıyor, tamam; program tablodan çekerken cariyi yanlış çektiği
     için bu yolu kapatmak amacıyla kaldırmayı düşünmüştüm." → Kaldırma fikri OTOMATİK çekme yoluna (Yeni Kayıt → cari
     kartı da aç) yönelikti; o yol düzeltildi.
     NİHAİ KARAR (kullanıcı, 02.10.2026, itirazım dinlendikten sonra yinelendi — "çok özellik çok hata doğuruyor"):
     (a) cariyi tablodan alma yolu KAPANIR: Yeni Kayıt formundaki "cari kartı da aç" kutusu ve kayıttan cari açan uç
     kalkar; (b) "Tablodan Al" düğmeleri kalkar (Cari penceresi + Raporlar'daki "Tablodaki kişileri cari yap");
     (c) detay kartındaki CARİ kutusu / "Cari Kartı" pili kalkar. Cari yalnız "+ Yeni Cari" ve "Excel / Sheets'ten Yükle"
     ile açılır. Şikâyet 3'teki "kayıt → cari" otomatik zinciri bu kararla KALKTI; taksit zinciri (kayıttan taksit,
     Taksit → Tablodan Aktar) dokunulmadı. Kullanıcı (aynı gün): "başka düzeltme eklemeyeceğim, bunu yapalım, zipi ver".
     YAPILDI (2.0.18, dal `claude/nice-euler-jvajxv`): (a) `hof-table.js` Yeni Kayıt formundan "cari kartı da aç" kutusu,
     çift kayıt sorusu ve POST cases/:key/account çağrısı kalktı (kayıt yalnız kayıt); sunucuda POST ucu kaldırıldı (yol
     405 döner; GET kaldı — kayıttaki + Tahsilat'ın cari defterine yönlendirmesi için); (b) `hof-accounts.js` Tablodan Al
     düğmesi + importFromTable + fromTable dışa aktarımı, `hof-overview.js` "Tablodaki Kişileri Cari Yap", import ucunda
     caseKeys/caseTitles (yok sayılır, `linked` sayacı yok); (c) `hof-workspace.js` detay kartındaki CARİ kutusu
     (caseAccountHtml, data-open-account) ve CSS'leri. Kalanlar: cari formundaki "Tablodaki Kayıt" alanı + ad eşleşmesi
     önerisi (düzeltilmiş personOf ile), kayıttan taksit, Taksit → Tablodan Aktar. Testler: senaryo-218 yeniden yazıldı
     (kutu yok, cari açılmaz, pil yok, düğme yok, + Yeni Cari'de kayıt önerisi); is-akisi/plan-case-link/plan-transfer/
     accounts-stock/senaryo-214/senaryo-raporlar/e2e run güncellendi. Kılavuz: "Kayıt ve cari ayrıdır", Tablodan Al
     çıkarıldı, k16 ekranı yenilendi, PDF yeniden üretildi. Kanıt: `docs/2.0.18-KANIT.md`; CHANGELOG → 2.0.18.
  KURAL (bu maddeden): kullanıcının her isteği, ne kadar küçük olsa da, AYNI ANDA bu listeye yazılır ve commit edilir;
  "dün konuştuk" denen bir istek listede yoksa kullanıcıya açıkça söylenir.
- 2.0.18 TESLİM (02.10.2026; dal `claude/nice-euler-jvajxv`; madde 15 — cari adı kişi kolonundan + kayıt/cari ayrımı;
  şema göçü YOK, 19 aynı; teslim `dist/teslim-2.0.18/` 3 zip + SHA256SUMS; imzalı paket kullanıcının yüklediği .pem ile;
  kurulum .exe Wine + Inno Setup). Sırada: kullanıcı yükler/"birleştir" → PR → CI → birleştir → yayın (tag v2.0.18, 5 dosya)
  → "yayımladım" → bayt bayt + güncelleyici "available" denetimi → site kılavuz PR'ı.
  TESLİM EDİLDİ (02.10.2026 20:3x): PR ceougur/ofis---y-netimi#18 açık (birleştirme kullanıcı onayıyla; kullanıcı: "zipi ver,
  yükleyelim sonra"). Güncelleme paketi sha256 4c4c07c6…, kurulum .exe sha256 a864b1a7… (29,3 MB); 3 zip + SHA256SUMS
  gönderildi (2-Kurulum zip'inde yalnız GitHub-v2.0.18/ exe + sha256; sürümlü .exe teslim klasöründe, zip'e boyut için konmadı).
- 2.0.19 (03.10.2026; dal `claude/kind-newton-fpmx3f`; 2.0.18 yayımlı = `v2.0.18`): KULLANICI BİLDİRİMİ "cariyi toplu Excel'den /
  Sheets'ten al deyince çekmiyor". Kök neden: 2.0.18'de Tablodan Al kalkarken `hof-accounts.js` mappingForm içinde tanımsız
  `caseKeys` kaldı → Kolonları Eşle penceresi açılmadan ReferenceError (Excel ve Sheets). Düzeltildi; Stok/Taksit/Çek
  yüklemeleri etkilenmemişti. İstemci + sunucu kodu no-undef ile tarandı: başka yok. Kalıcı test `npm run test:senaryo-219`
  (30 denetim, CI e2e işine eklendi). DERS: kod kaldırırken o koda dokunan her arayüz yolu (toplu yükleme dahil) arayüzden
  koşulur; 1.000 carilik WhatsApp senaryosu bu yolu kapsıyordu ama 2.0.18'de koşulmadı.
  Gözlem: aynı Excel ikinci kez "Atla" ile yüklenince TELEFONSUZ ve Cari No'suz satır yeniden cari açar (kural: "emin
  olunamayan satır yeni cari açar"; aynı adlı iki gerçek kişi ayrılsın diye). KARAR (kullanıcı, 03.10.2026: "önerini yap"
  → önerim: kural BÖYLE KALIR; "yalnız ad aynıysa sor" yapılmadı). senaryo-219 adım 2 bu kuralı denetler.
  Kullanıcı (03.10.2026, "müşteri bekliyor"): işlem bitince zip ver, BİRLEŞTİRMEYİ YAP, GitHub'a yükleme linkini ver.
  YAYIMLANDI (03.10.2026 10:13; PR ceougur/ofis---y-netimi#19 CI 12/12 yeşil → birleştirildi, `v2.0.19` = fb032cf; dal
  `master` üzerine sıfırlandı). İmza anahtarı kullanıcının yüklediği .pem (destekofis-2026-1 ile birebir, imzala/doğrula
  sınandı). Güncelleme paketi sha256 349ebb89…, kurulum .exe sha256 029c2acf… (29,32 MB, simgeli). Yayındaki 5 dosya +
  latest/ (exe, json, zip, pdf) bayt bayt aynı; gerçek güncelleyici canlı GitHub'da 2.0.18/17/16/15/2.0.4/1.7.0 olarak
  (Node 24.21, bootstrap 2; GitHub API ve API kapalıyken yedek yol) 2.0.19'u "available" gördü, indirme sha256 eşleşti;
  2.0.19 kurulu → "up-to-date"; kurcalanmış bildirge reddedildi. Kılavuz değişmedi: site `web/indir/` PDF'i yayınla
  bayt bayt aynı (60bcf7ad…) → site PR'ı gerekmedi. 2.0.19 KAPANDI.
- 2.0.20 BAŞLADI (kullanıcı, 03.10.2026: "uzman UI, uzman UX, baş mimar ve baş mühendis şapkanla başka sorunlara yol
  açmayacak şekilde düzeltmeleri yap" = 9 maddenin hepsi; dal `claude/kind-newton-fpmx3f`).
  DURUM: 9 MADDE YAPILDI (kanıt `docs/2.0.20-KANIT.md`, CHANGELOG → 2.0.20). Madde 9 bir yardımcı ajanla ayrı kopyada yapıldı
  (`server/lib/company-backups.mjs`; GERİ YÜKLE özelliği de eklendi: 002+ hemen, 001 yeniden açılışta, ortak katman korunur),
  sonra BAĞIMSIZ gözden geçirme ajanı → bulgular düzeltildi (`test/yedek-220-inceleme.test.mjs`, önce 9/9 kırmızı). Gözden
  geçirmede 2.0.17'den kalan iki ciddi hata bulundu ve düzeltildi: kodu değişen şirketin `sirketler/<kod>` klasörü yeni şirkete
  veriliyordu (İKİ ŞİRKET AYNI VERİ TABANI); açılamayan şirketin istekleri 001'e düşüyordu. Kalan bilinen sınırlar (CHANGELOG'a
  yazılmadı, düşük): Drive "bağlantı" kipinde şirketler aynı Drive klasörü; 001 geri yüklemesinde servis yöneticisi yeniden
  açılışı çökme sayar (5 dk'da 5 kez olursa bekler); silinmiş şirketin yedekleri listede görünmez (klasörü durur).
  Yedek klasörü: `backups\<kod> - <ad>\` (çakışırsa kayıtta `backupFolder` "… (2)"); veri klasörü yeni şirkette boş ve
  kullanılmayan (`sirketler\002-2` gibi). Budama: rutin (otomatik/manuel/drive-deneme) son 30, güvenlik etiketlileri ayrıca 20.
  TESLİM (03.10.2026 14:3x): PR ceougur/ofis---y-netimi#20 açık (birleştirme kullanıcının "birleştir"iyle). Teslim öncesi ekran
  denetiminde bulunup düzeltildi: Cari Bazında Tahsilat'ta TOPLAM pencerenin altında kalıyordu (tablo kutusu pencereye göre
  boyutlanır, `hof-report-center.js` fitTable; alçak ekranda 50vh kalır), Cari Listesi'nde telefon ikiye bölünüyordu.
  Testler: npm test 831/831; senaryo-220 23, 220-yedek 26, rapor 82, 216 53, 211 57, 217 62, 219 30, e2e 50 adım.
  Güncelleme paketi sha256 c3d16dc8… (207 dosya, HEAD ile bayt bayt), kurulum .exe sha256 b4eaafd3… (29,4 MB, simgeli);
  güncelleyici 2.0.19/18/17/16/2.0.4/1.7.0 olarak (API ve yedek yol) "available". Kılavuz DEĞİŞTİ (PDF 84c256d7…) →
  yayından sonra site PR'ı (`ceougur/destekofis` → `web/indir/`). Sırada: "birleştir" → CI → birleştir → yayın (v2.0.20,
  5 dosya) → "yayımladım" → bayt bayt + güncelleyici denetimi → site PR'ı.
  Kullanıcı (03.10.2026, Geri Yükle penceresi ekranıyla): "yedekten geri yükle yap dememiştim ama güzel olmuş" → KALIR.
  Kaynağı: madde 9 önerimdeki "geri yüklemede yanlış şirkete yükleme reddedilir" (2.0.19'a kadar geri yükleme yalnız
  güncelleme geri dönüşünde, ekransız). DERS: istenenin dışına çıkan özellik teslimde AYRICA söylenir.
  YAYIMLANDI (03.10.2026 ~15:0x; PR #20 CI yeşil → kullanıcının "birleştir"iyle squash, `master` = d795151, `v2.0.20`; dal
  `master` üzerine sıfırlandı). Yayındaki 5 dosya + latest/ (exe, json, zip, pdf) teslimdekiyle bayt bayt aynı; gerçek
  güncelleyici canlı GitHub'da 2.0.19/18/17/16/15/2.0.4/1.7.0 olarak (API ve API kapalıyken yedek yol) 2.0.20'yi
  "available" gördü, indirme sha256 c3d16dc8… eşleşti; 2.0.20 kurulu → "up-to-date". Site kılavuz PR'ı
  ceougur/destekofis#8 açık (PDF yayındakiyle aynı, 84c256d7…); birleştirme kullanıcı onayıyla.
- 2.0.21 GÜVENİLİRLİK (kullanıcı, 03.10.2026: "bir şirketin yedeğinin başka şirkete yazılması tam bir fiyasko, çok endişeleniyorum;
  test çeşitliliğini bilişim sektörünce bilinen testlerle mi söylemem lazım?" → önerim → "yap"). YENİ ÖZELLİK YOK, yalnız:
  [x] 1. Açılışta "iki şirket aynı veri dosyasını mı gösteriyor?" denetimi (2.0.17–2.0.19'da kod değiştir + eski kodla yeni
         şirket aç sırasını yaşamış kurulumlar; 2.0.20 yalnız yenisini önlüyor). Varsa yöneticiye açık uyarı + ayırma yolu;
         hiçbir kayıt silinmez, önce yedek. YAPILDI d636b8f (`company-separate.mjs`, sirket-ayir-221, senaryo-221).
  [x] 2. Şirket ve yedek işlemleri için RASTGELE SIRA testi (binlerce işlem: aç, kod/ad değiştir, sil, yedek al, geri yükle,
         cari gir) + değişmez kurallar: bir şirketin verisi öbüründe görünmez; iki şirket aynı dosyayı kullanmaz; yedek
         yalnız kendi şirketinin klasöründe ve kimliğiyle; geri yükleme sayıları yedek anındakine döner.
  [x] 3. YEDEK TATBİKATI: veri gir → yedek → çalışmaya devam → geri yükle → sayılar → geri yüklenen veride yeniden çalış
         (001 ve 002; eski sürüm yedeğiyle de).
  [x] 4. GÖÇ testi: 2.0.17'den bu yana her sürümün veri düzeninden güncelleme; hiçbir kayıt kaybolmaz.
  [x] 5. ARIZA testi: yedek/geri yükleme ortasında kesinti, disk dolu, kilitli dosya → veri bozulmaz.
  [x] 7. (kullanıcı, aynı gün: "her şirketin yedeğini sunucuda kendi adıyla yedek açıp yedeklediğini de kontrol et; baş mimar
         baş mühendis olarak programına sahip çık, özümse") Gerçek sunucu düzeninde (Windows hizmeti gibi: data + backups
         klasörleri) otomatik zamanlayıcı, Şimdi Yedek Al (Tüm/Yalnız), ad/kod değişimi, silme, Ayır, göç sonrası her
         şirketin yedeği `backups\\<kod> - <ad>\\` klasöründe, adında kodu, içinde kimliği; başka klasöre düşen yok.
  [x] 8. (bulgu, 03.10.2026) AYNI HESAP İKİ PENCEREDE/BİLGİSAYARDA: şirket seçimi kullanıcı başına sunucuda; birinde şirket
         değişince öbür pencerenin (001'i gösteren) kaydı 002'ye yazılıyordu. Düzeltme: istek sayfanın şirketine gider
         (?hofCompany=, `HOF.apiUrl`); seçim yalnız yeni açılan sayfanın şirketini belirler.
  DURUM (03.10.2026): 8 madde YAPILDI; kanıt `docs/2.0.21-KANIT.md` (DENENEN / DENENMEYEN / BİLİNEN SINIRLAR). Testler yardımcı
  ajanla (gerçek eski sürümlerden veri üreteci `tools/surum-verisi.mjs`, fikstürler `test/fixtures/surum-*`), sonra BAĞIMSIZ
  gözden geçirme (12 bulgu; 1 KRİTİK, 1 YÜKSEK — hepsi düzeltildi, `test/inceleme-221.test.mjs` önce 5/5 kırmızı). Yeni kural:
  veri dosyası paylaşan şirkette Geri Yükle/Sil/Sıfırla Ayır'a kadar 409; pencere şirketi ?hofCompany= (Yönetim ?sirket=).
  TESLİM (03.10.2026): PR ceougur/ofis---y-netimi#21 açık (birleştirme kullanıcının "birleştir"iyle). npm test 891/891, 12 arayüz
  senaryosu, rastgele uzun koşular 0 hata. Güncelleme paketi sha256 985056b5… (209 dosya, HEAD ile bayt bayt), kurulum .exe
  71bca999… (simgeli); güncelleyici 2.0.20/19/18/17/2.0.4/1.7.0 "available". Kılavuz DEĞİŞTİ (802d42a4…) → yayından sonra site
  PR'ı ceougur/destekofis#8 güncellenir. Kullanıcıya söylendi: bulunan hatalar 2.0.20'de de var (iki pencere, 001 Tümünü Sıfırla).
  YAYIMLANDI (03.10.2026; PR #21 CI yeşil → kullanıcının "birleştir"iyle squash, `master` = 863c35a, `v2.0.21`; dal `master`
  üzerine sıfırlandı). Yayındaki 5 dosya + latest/ (exe, json, zip, pdf) teslimdekiyle bayt bayt aynı, exe .sha256 OK; gerçek
  güncelleyici canlı GitHub'da 2.0.20/19/18/17/16/2.0.4/1.7.0 olarak (API ve API kapalıyken yedek yol) 2.0.21'i "available"
  gördü, indirme sha256 985056b5… eşleşti; 2.0.21 kurulu → "up-to-date". Site kılavuz PR'ı ceougur/destekofis#8 2.0.21 PDF'iyle
  (802d42a4…) güncellendi ve kullanıcının isteğiyle BİRLEŞTİRİLDİ (main 6b0cc85). Canlı sitenin PDF'i bu ortamdan denetlenemedi
  (destekofis.com ağ politikasıyla kapalı). 2.0.21 KAPANDI.
- TEST KAPSAMI SORUSU (kullanıcı, 03.10.2026: "dünyadaki tüm hata testleri yapıldı, her işlevi kusursuzdur diyebilir miyim?").
  Cevap: HAYIR. Ölçüldü (`docs/TEST-KAPSAMI-2.0.21.md`): sunucu satır %95,2 / karar kolu %79,9; arayüz satır %79,8 (19 senaryo,
  tarayıcı kapsaması); bağımsız denetimde 52 yüksek + 116 orta riskli testsiz yer doğrulandı (5 iddia çürütüldü). CI 19 arayüz
  senaryosunun yalnız 5'ini koşuyor; senaryo-213 2.0.21'den beri bu yüzden fark edilmeden kırıktı (test eskimişti, düzeltildi
  c93ab9c). Kapsama, mutasyon, lint, bağımlılık taraması, yük/dayanıklılık, beta, sahadan hata bildirimi YOK.
  ÖNERİ (kullanıcı "yap" derse): 52 yüksek riskli açığa hata testi (önce para/dönem kilidi/yetki/şirket); 19 senaryonun hepsi
  CI'de; kapsama ölçümü CI'de ve düşerse kırmızı.
  EK (kullanıcı, 04.10.2026): iki test türü de listeye: (a) YÜK/EŞZAMANLILIK — birden çok personel aynı anda farklı
  şirketlerde (001'de fatura, 002'de tahsilat…) ve aynı şirkette yoğun yazar; sonuç: veri karışmaz, kayıp/çift kayıt yok,
  mutabakat 0, yanıt süreleri ölçülür. (b) KÖTÜ NİYETLİ (güvenlik) — yetkisiz personel başka şirketin/işlemin verisine
  ulaşmaya, ?hofCompany= ile şirket değiştirmeye, yetki dışı uçları çağırmaya, bozuk/aşırı büyük girdi göndermeye çalışır;
  bağımlılık taraması. Hepsi reddedilmeli, veri bozulmamalı.
  KARAR (kullanıcı, 04.10.2026): "her yapılmayan testi hacker yani kötü niyetli olarak programı bozmak için yapalım; planını
  böyle yap"; DÜZELTME (aynı gün): "hem çalışıyor mu diye test et hem de bunu nasıl bozarım diye test et, plan bu!".
  PLAN: raporda (docs/TEST-KAPSAMI-2.0.21.md) doğrulanmış her testsiz yer (52 yüksek + 116 orta) için İKİ test yazılır:
  (1) ÇALIŞIYOR MU — doğru kullanımda beklenen sonuç sayılarla (bakiye, Kasa, stok, kart) doğrulanır; (2) NASIL BOZARIM —
  saldırgan bakışla. Saldırgan soruları: yetkim yokken yapabilir miyim
  (başka personel, başka şirket, ?hofCompany= oyunu, doğrudan API)? kilitli döneme/ileri tarihe yazdırabilir miyim? tutarı
  eksi/sıfır/devasa/kuruş artığı, metni bozuk/çok uzun/zararlı (HTML, formül, yol) verebilir miyim? çift tıklama ve aynı
  anda iki istekle çift kayıt ya da eksi bakiye yaratabilir miyim? işlemi yarıda kesip (bağlantı kopması, disk dolu) veriyi
  yarım bırakabilir miyim? sil → geri yükle → düzenle sırasıyla bağları koparabilir miyim? Her test sonunda değişmezler
  denetlenir (mutabakat 0, şirketler ayrı, yetkisiz değişiklik yok). Sıra: para ve dönem kilidi → yetki ve şirket ayrımı →
  eşzamanlılık/yük → girdi bozma → arayüz düğmeleri. Bulunan her açık: önce kırmızı test, sonra düzeltme, kanıt dosyası.
  [x] 6. Bu test türleri aşağıdaki "Test kuralı"na her sürümde koşulacak kural olarak yazılır; teslimde "denenen /
         denenmeyen / bilinen sınırlar" açıkça yazılır; her sürümde bağımsız gözden geçirme.
- EXCEL DENETİMİ (kullanıcı, 04.10.2026; yüklenen `Sirket_Is_Listesi_Stoklu.xlsx`, 4.220 iş, 350 cari, 50 ürün): "programı
  gerçek bilgisayarda çalıştır, uzman muhasebeci olarak iki şirket kur, Excel'deki işleri gir — kod üzerinden değil insan
  gibi; birden çok çalışan iki şirkette aynı anda tahsilat, mal satışı, taksit tahsilatı; mali müşavir olarak denetle; iki
  şirketin yedeğini denetle"; ek: "hatalı ve yetkisiz işlemleri de dene; bulduğun sorunları KOD DEĞİŞTİRMEDEN madde madde
  bildir"; "mali raporları teslim et" (zip). DERS (ağır): ilk deneme (başka model) programı salt okunur lisansla çalıştırdı,
  HİÇBİR kayıt girilmedi, istekler reddedildi ama test "✅" saydı ve uydurma "mali rapor" + zip teslim edildi
  (`docs/MALI-RAPOR-2.0.21-TEST.md`, kök `test-*.mjs`, `test-raporlar-2.0.21.zip` — YANLIŞ). Kullanıcı: "yapmış gibi yapma,
  yap!". Kural: bir testin "✓" demesi için yanıt gövdesi ve veri tabanı sayısı okunur; reddedilen istek başarı sayılmaz.
  Yapılan iş: `test/excel-denetim/` (model.py bağımsız beklenen; kos.mjs kur/yukle; denetim.mjs; saldiri.mjs; yedek.mjs;
  arayuz.mjs; rapor-al.mjs). Kod değiştirilmez; bulgular `test/excel-denetim/cikti/` ve teslim zip'inde.
  SONUÇ (04.10.2026; rapor `docs/EXCEL-DENETIMI-2026-10-04.md`, zip `dist/teslim-excel-denetimi/`): 4.220 iş × 2 şirket
  eksiksiz (veri dosyasından sayıldı; SIGKILL kesinti + devam sonrası eksik/çift 0); mali denetim 70/70; programın Mutabakat
  Testi 59/59 ×2; saldırı 63 (2 bulgu); yedek tatbikatı 30/30 + otomatik yedek; arayüzden bugünün işleri 14/14. Hacim API'den
  girildi (ekrandan: şirket açma, cari/stok Excel yükleme, örnek satış/tahsilat, bugünün işleri) — kullanıcıya açıkça söylendi.
  BULGULAR (düzeltme kullanıcı "yap" derse): (1) yük altında sunucu yavaş, boşta açık her pencere yavaşlığı katlıyor
  (cari not düzeltme 0 pencere ~1 sn/4,1 kayıt-sn → 5 pencere 8,9 sn/0,5 kayıt-sn); (2) başka personel saniyede 1 kayıt
  girerken Cari aramasında her harf ~3 sn gecikiyor; (3) Excel cari yüklemede "Müşteri/Tedarikçi" sessizce Tedarikçi;
  (4) API'de tanımsız ödeme yolu nakit sayılıyor; (5) API'de aynı fatura iki kez → iki fatura (ekranda çift tıklama
  korumalı); (6) lisans kapalıyken bile "salt okunur" uyarı kutusu. Excel'in kendi sorunları raporda (Kasa açılışı yok,
  1.613 işlem cari açılışından önce, kısmi ödeme tutarı yok, 165 "Tamamlandı" taksitlinin tahsilatı yok, Özet sayfası yanlış).
  Kullanıcı sorusu (aynı gün): "gerçek muhasebeci gibi değil de koddan mı yapıyorsun?" → evet, hacim API'den; önerildi:
  bir ayın tamamı (Ocak 2024) ekrandan ayrı şirkete girilip API ile girilenle sayı sayı karşılaştırılsın (karar kullanıcıda).
  KARAR (kullanıcı, 04.10.2026, 2.0.22 yayınından sonra; haftalık kullanım limitini sordu → önerim: limit dar olabilir, BİR
  HAFTA + TEK ŞİRKET, kısa karşılaştırma tablosu; fark çıkmazsa genişletilmez) → "önerini yap". Kod değiştirilmez; fark
  çıkarsa önce kullanıcıya bildirilir.
  SONUÇ (04.10.2026 18:0x; `test/excel-denetim/ekran-hafta.mjs`, sonuç `cikti/ekran-hafta-sonuc.json`): 20–26 Ocak 2025 haftası
  (51 işlem, 30 türün 25'i) aynı başlangıçlı iki şirkete — 001 API, 002 EKRANDAN (fatura formu, cari kartı, Çek/Senet penceresi,
  taksit) — girildi: 51/51 ekrandan (ort. 7 sn/işlem, 6 dk); 373 cari borç/alacak/bakiye, 50 ürün stoğu + stok değeri, faturalar,
  çek/senet, taksit kartları, Kasa/banka/POS, mutabakat 59/59 ×2 → FARK YOK. BULGU (gerçek ekran hatası, 2.0.21'de de var,
  KOD DEĞİŞTİRİLMEDİ, karar kullanıcıda): fatura formunda ödeme tutarı faturayı tamamen karşılayınca ödeme alanları ~0,6 sn
  sonra yeniden çiziliyor (`hof-invoices.js` refreshRest → renderPayLater); bu sürede seçilen Vade tarihi ya da yazılan
  Banka/Şube siliniyor ("No yaz → Tab → Banka yaz" normal hızda Banka boş kalıyor). Kaydet "1. evrakın vade tarihini seçin"
  der, veri bozulmaz. Yeniden üretim: `test/excel-denetim/form-insan.mjs` (TARIH=100 → vade boş; TARIH=2000 → dolu).
  KULLANICI SORUSU (04.10.2026): "maaş, fatura, kira ödemeleri, cari açma, taksit yapma, stok ekleme, tahsilat yapıldı mı;
  raporlarda doğru sonuca ulaşıldığı doğrulandı mı?" → dürüst cevap: maaş/fatura/gider/tahsilat ekrandan EVET; kira o hafta
  yok; cari ve stok Excel'den toplu (form değil); taksit yalnız taksitli faturadan; Rapor Merkezi AÇILMADI, bağımsız beklenen
  hesapla karşılaştırılmadı. KARAR (kullanıcı): "testin eksiğini tamamla, düzeltmeyi ondan sonra değerlendirelim" → aynı
  haftaya ekrandan: + Yeni Cari, stok kartı + stok giriş/çıkış, Taksit formundan taksit kartı + tahsilatı, kira gideri;
  sonra Rapor Merkezi raporları EKRANDAN açılıp programdan bağımsız beklenen hesapla (ve PDF/Excel ekranla) karşılaştırılır.
  Kod değiştirilmez; ödeme alanı hatasının düzeltmesi bu testten sonra konuşulur.
  SONUÇ (04.10.2026 19:0x; `docs/EKRAN-HAFTA-TESTI-2026-10-04.md`, commit 93974d1): 51 Excel işi + 16 ek işlem her biri kendi
  gününde; ekrandan 67/67 (7,8 dk), API şirketiyle FARK YOK, mutabakat 59/59 ×2, sayfa hatası yok. Rapor Merkezi'nden 14 rapor
  (16 görünüm) + ANLIK DURUM iki şirkette ekrandan ↔ bağımsız beklenen (`model-hafta.py`): 57 kalemin 51'i tuttu, 6'sı bilinen
  bulgulardan (Bulgu 2: Satış Kalan 3.290,60 / Açık Alacak 3.000; Bulgu 4: Yol = Banka/POS), açıklanmamış 0; stok 51/51;
  PDF/Excel 64/64 ekranla aynı ve şirketli. Düzeltme kararı kullanıcıda (öneriler belgenin 6. bölümünde).
  BAĞIMSIZ GÖZDEN GEÇİRME (04.10.2026; hepsi tarafımdan yeniden üretildi, belgenin 7. bölümü): (1) BULGU 1 CİDDİ — "veri
  bozulmaz" YANLIŞTI: fatura formunda çek/senet satırında alan değişince ödeme bölümü anında yeniden çiziliyor
  (hof-invoices.js:1171-1174 → :901), odak sayfaya düşüyor; klavyeyle (Tab) girilen senet tutarın üstüne yazılıyor, Kaydet
  UYARISIZ "Açık 240", senet YOK (`test/excel-denetim/odeme-alani-kaydet.mjs`, tam ve kısmi); fareyle girişte vade/banka
  kayboluyor, kayıt "vade seçin" ile duruyor. Önem YÜKSEK. (2) Bulgu 2'ye F (Kapatılacak Fatura ile bağlı tahsilat da taksitli
  faturanın kartını kapatmıyor) ve G (kart kapatma — kalanın silinmesi — ödenmemiş faturayı kapatıyor; kod yorumu tersini
  söylüyor) eklendi; yaşlandırma cari başına yanlış, toplamda sıfırlanabiliyor (57.160 = 57.160). C0122'nin 290,60'ı KURAL
  FARKI (cari alacaklı; fatura FIFO ile kapanabilir, yanlış olan kart); "başka iş için" bilgisi veride yoktu. (3) Bulgu 3: tek
  dönem tıklaması 6 istek. (4) Bulgu 4 doğru, başka düşen parametre yok. Test betiği işaretli karşılaştırmaya geçti.
  KULLANICI SORUSU (aynı gün): "denenmeyenleri (iade/iptal/düzenleme/silme, çek tahsil/ciro, Kasa↔Banka, dönem kilidi, yetkisiz
  kullanıcı, 29 rapor) de ayrıca teste tabi tutman gerekecek mi?" → cevap: evet, kanıt yok; ÖNERİM: düzeltmeden ÖNCE aynı hafta
  testine ekleyip ekrandan koşmak (iade/iptal/düzenleme Bulgu 2'nin koduyla iç içe; bütün hatalar görülünce düzeltme tek
  tasarımla), 29 rapor her süzgeç seçeneğiyle; düzeltmelerden sonra hepsi bir kez daha. Kullanıcının "yap"ı bekleniyor.
  KARAR (kullanıcı, 04.10.2026): "kullanım limitimden dolayı test yarım kalabilir; önce tespit ettiğin hataları düzelt ve
  GitHub'a yüklenecek imzalı 5 dosyayı ver, diğer testleri bundan sonra değerlendirelim" → 2.0.23 = Bulgu 1, 2 (A–G), 3, 4 +
  PDF özet başlığı. Her hata: önce kırmızı test → düzeltme → kanıt; hafta testi yeniden (beklenen: açıklanmamış fark 0, Bulgu 4
  satırları da tutar); bağımsız gözden geçirme; teslim A (5 dosya) + B (arşiv zip). Denenmeyen 6 alan sonra konuşulacak.
  [x] 1. çek/senet satırı   [x] 2. taksit ↔ fatura   [x] 3. dönem düğmesi   [x] 4. Yol süzgeci   [x] 5. PDF başlık
  DURUM (04.10.2026 20:xx): 5 düzeltme yapıldı. Kırmızı → yeşil: `test/bulgu-223.test.mjs` (2.0.22'de 13'ün 11'i kırmızı,
  dalda 13/13), `npm run test:senaryo-223` (arayüz; 2.0.22'de 21'in 19'u kırmızı, dalda 21/21; CI ve yayın iş akışına eklendi).
  Bulgu 1'de ikinci yol bulundu ve kapandı: peşin tutar yazılıp fareyle doğrudan Kalan → Vade Tarihi'ne tıklanınca yazılan
  vade kayboluyor, fatura SESSİZCE bugünün vadesiyle kaydediliyordu (2.0.22'de de var). Sırada: npm test + diğer arayüz
  senaryoları + hafta testi yeniden, bağımsız gözden geçirme, sürüm 2.0.23, imzalı paket + kurulum, teslim A + B.
  DURUM (04/05.10.2026): ÜÇ bağımsız gözden geçirme (11 + 12 + 4 bulgu), hepsi yeniden üretildi, önce kırmızı test. Kapama
  modeli son hali: "Carinin Mevcut Borcu" kartı açıldığı anda AÇIK olan borcu kapsar (kartın açılış anına kadar kayıtlı
  satırlarla kapama yapılır; açık borçlar en son kaydedilenden; kapasite = min(tutar, taksitler)); birleşik listelerde kartın
  payı kalanını aşmaz; Mevcut Borç kartı BÜYÜTÜLEMEZ (409, yeni kart; 3. tur kararı — büyütmeyi destekleyen ara çözüm ilgisiz
  satışı "Ödendi" gösteriyordu); borcu azalmış kart geri yüklenmez; Otomatik Dağıt Düzenle'nin denetimleriyle; mahsup ve
  "Kapatılacak Fatura" taksitli faturaya 409; Kaydet bekleyen hesap + Tamamı Peşin bitince kurulur. ERTELENEN (bilinen sınır,
  kullanıcıya söylenecek): taksitli faturadan / iki kartlı caride İADE kartı yanlış küçültüyor (trimCovers, 2.0.22'de daha
  kötü) → iade/iptal/düzenleme testleriyle sıradaki sürüm. Son kodla: npm test 959/959, 21 arayüz senaryosu (211 bir kez
  zamanlama, tek başına 57/57), mutabakat 3.000, güvenilirlik 2×1.000, hafta testi 67/67 + 57/57 rapor kalemi, hız tablosu
  `docs/2.0.23-KANIT.md`. Kırmızı kanıt 2.0.22'de: bulgu-223+rastgele 43'ün 32'si, senaryo-223 29'un 25'i. Kılavuz değişti.
  TESLİM (04.10.2026 23:3x): PR ceougur/ofis---y-netimi#23 açık (birleştirme kullanıcının "birleştir"iyle). Güncelleme paketi
  sha256 5e598bfd… (210 dosya, HEAD ile bayt bayt), kurulum .exe 692a1bb0… (29,4 MB), kılavuz PDF 2f16c0a3… (değişti → yayından
  sonra site PR'ı); güncelleyici 2.0.22/21/20/19/2.0.4/1.7.0 (API ve yedek yol) "available", kurcalanmış bildirge reddedildi.
  5 dosya zipsiz + arşiv zip (29 MB) gönderildi.
  YAYIMLANDI (05.10.2026; PR #23 CI 12/12 yeşil → kullanıcının "birleştir"iyle squash, `master` = 58798e9 (ağaç teslimdeki
  c2f7e9a ile aynı), `v2.0.23`; dal master'a sıfırlandı). Yayında yükleme sırasında indirilen güncelleme paketinin adı
  kullanıcının bilgisayarında "DestekOfis-2.0.22-Arsiv-…zip" olarak inmişti (boyut 4.632.079 = paket); yayımlamadan önce
  yakalandı, doğru adla yeniden yüklendi. DERS: yayımdan önce kullanıcının ekranındaki 5 dosya adı + boyutu teslimle
  karşılaştırılır. Yayındaki 5 dosya + latest/ (exe, json, zip, pdf) bayt bayt aynı, exe .sha256 OK, etiket 58798e9; gerçek
  güncelleyici canlı GitHub'da 2.0.22/21/20/19/18/17/2.0.4/1.7.0 olarak (API ve yedek yol) 2.0.23'ü "available" gördü,
  indirme sha256 5e598bfd… eşleşti; 2.0.23 kurulu → "up-to-date". Site kılavuz PR'ı ceougur/destekofis#10 açık (PDF
  2f16c0a3…) kullanıcının "birleştir"iyle BİRLEŞTİRİLDİ (main 0e280bd). 2.0.23 KAPANDI.
- 2.0.24 (kullanıcı, 05.10.2026: "yap"): (1) ERTELENEN TESTLER ekrandan, aynı hafta verisiyle, bağımsız beklenenle:
  iade, iptal, düzenleme, silme; çek tahsil/ciro; Kasa↔Banka; dönem kilidi; yetkisiz kullanıcı; 29 rapor (her süzgeç).
  Her alan için "çalışıyor mu" + "nasıl bozarım". (2) İADE kartı küçültme hatası (trimCovers) düzeltmesi. Kural: önce
  kırmızı test, sonra düzeltme; bulunan her hata önce kullanıcıya listelenir; DENENEN/DENENMEYEN/BİLİNEN SINIRLAR.
  DURUM (05.10.2026): iade düzeltmesi yapıldı (987a6b9 + 0a3bb0f; `test/iade-224` 2.0.23'te 7'nin 5'i kırmızı; iadede genel
  bakiye kırpması kaldırıldı — avans faturanın kartını küçültüyordu). Ertelenen testler API'den (`test/ertelenen-224` 34,
  `test/raporlar-224` 51; 43 rapor × 1.187 süzgeç × ekran/PDF/Excel). BULGULAR → KARAR (kullanıcı, 05.10.2026: "önerdiğin
  gibi yap"): [x] 1. çek/senet işlemi + geri alma dönem kilidine bakmıyor (Yüksek) [x] 2. çek/senet işlemi ileri tarihle
  (Orta) [x] 3. Cari Mizanı "Geciken Taksiti Olan" süzgeci yok sayılıyor [x] 4. Ürün Satış Kârlılığı özet Brüt Kâr ≠ TOPLAM
  (özet yalnız maliyeti bilinen kalemlerden) [x] 5. taksit tahsilatı silinince kart ≠ fatura açığı (kart faturaya göre).
  YAPILDI 8f012e3 (1–4; 2.0.23'te 5 test kırmızı) + 6b14b74 (5; iade-224 #8). Sırada: npm test/mutabakat/güvenilirlik,
  arayüz senaryosu senaryo-224 (yardımcı ajan), bağımsız gözden geçirme, sonra sürüm 2.0.24 + teslim A/B.
  DURUM (05.10.2026): bağımsız gözden geçirme 4 bulgu (G1 paralı iade kartı küçültüyordu — bu sürümün gerilemesi, G2
  yeni faturadan iadede çift sayım, G3 avans iadesi Mevcut Borç kartını kırpmıyordu, G4 çek yolları kartı eşitlemiyordu) →
  hepsi önce kırmızı test, düzeltildi; G5 (geri büyüyen kartta taksit vadesi bugün) ve G6 (uç veride hız) Bilinen Sınırlar.
  senaryo-224 53/53 (pencere içi bildirim okunmuyordu → düzeltildi, CI'ye eklendi). npm test 1.059/1.059, mutabakat 2 tohum,
  güvenilirlik 1.000. Sürüm 2.0.24, kanıt `docs/2.0.24-KANIT.md`, kılavuz iade cümleleri değişti (PDF 3206709e…).
  TESLİM (05.10.2026 ~05:5x; kullanıcı: "limit %2 kaldı, zipi teslim et"): 5 dosya zipsiz + arşiv zip (26,7 MB) gönderildi;
  paket sha256 a926aed5… (210 dosya), kurulum .exe 115d04b8… (29,4 MB); güncelleyici 2.0.23/22/21/20/19/2.0.4/1.7.0 (API ve
  yedek yol) "available". PR ceougur/ofis---y-netimi#24 açık. Sırada: CI → kullanıcının "birleştir"i → yayın (v2.0.24, 5 dosya;
  yükleme ekranında adlar/boyutlar teslimle karşılaştırılır) → "yayımladım" → bayt bayt + güncelleyici → site kılavuz PR'ı.
  YAYIMLANDI (05.10.2026 ~06:1x): kullanıcı önce yanlışlıkla dosyasız yayımladı (etiket 2.0.23 koduna) → yayın + etiket
  kullanıcı tarafından silindi, latest yeniden 2.0.23 doğrulandı; PR #24 CI 12/12 → kullanıcının "birleştir"iyle squash,
  `master` = 9c09f3c (ağaç teslimle aynı), `v2.0.24`. Yayındaki 5 dosya + latest/ bayt bayt aynı, exe .sha256 OK; gerçek
  güncelleyici canlı GitHub'da 2.0.23/22/21/20/19/18/17/2.0.4/1.7.0 (API ve yedek yol) "available", sha256 a926aed5…;
  2.0.24 → "up-to-date". Site kılavuz PR'ı ceougur/destekofis#11 kullanıcının "birleştir"iyle BİRLEŞTİRİLDİ (main 514d29b, PDF 3206709e…). 2.0.24 KAPANDI.
  KARAR (kullanıcı, 05.10.2026): 2.0.24'ün DENENMEYEN ve BİLİNEN SINIRLAR listesi Cuma 09.10.2026 planlı teste eklendi
  (hatırlatma trig_0144BJLRwsZFizXTTYrJVszA, 06:00 UTC; içerik docs/2.0.24-KANIT.md). ERTELENDİ (kullanıcı, 08.10.2026: "cuma
  günü için planladığımız testleri pazar gününe ertele") → Pazar 11.10.2026 09:00 TR (06:00 UTC), aynı hatırlatma.
  YİNE ERTELENDİ (kullanıcı, 09.10.2026: "pazar günkü testi ertele cumaya"; haftalık limit) → Cuma 16.10.2026 09:00 TR.
  ÖLÇEK SORUSU (kullanıcı, 05.10.2026: "ne ölçekte firma rahat kullanır?") → cevap (ölçülenle): 5–10 eşzamanlı kullanıcı,
  birkaç şirket, şirket başına birkaç bin cari, yılda birkaç bin–on bin fatura; üstü ÖLÇÜLMEDİ. KARAR ("ekle"): ölçek/yük testi
  (10/20/30 eşzamanlı kullanıcı, 10.000–50.000 cari + 100.000+ fatura, 10 şirket + yedekleme sırasında yük) aynı Cuma planına
  eklendi; çıktı "şu ölçeğe kadar rahat, şurada darboğaz" tablosu + düzeltme önerisi.
  EK (kullanıcı, 05.10.2026: "bu ölçümü sadece koddan yapma, arayüz kaldırıyor mu ona da bak"): ölçek testi ARAYÜZDEN de
  yapılır — aynı anda açık gerçek tarayıcı pencereleri (her biri bir personel), aynı büyük veride: pencere açılışı, Cari
  aramasında harf gecikmesi, uzun listelerde kaydırma/donma, rapor ön izleme + PDF/Excel, Kaydet → listede görünme, başka
  personel yazarken açık pencere donuyor mu, tarayıcı belleği. Sonuç tablosu her ölçümde sunucu + ekran iki sütun. DERS: yayın bağlantısı birleştirmeden
  ÖNCE verilmez; verildiyse "Publish'e basmayın" en başta yazılır. Sırada (kullanıcıyla): ertelenen testler (iade/iptal/düzenleme/silme,
  çek tahsil/ciro, Kasa↔Banka, dönem kilidi, yetkisiz kullanıcı, 29 rapor) ve iade kartı küçültme düzeltmesi.
  BULGU 2 (04.10.2026, ek işlemlerde bulundu; KOD DEĞİŞTİRİLMEDİ, karar kullanıcıda): aynı caride açık satış faturası +
  Taksit penceresinden "Yeni Borç" ile AYRI taksit kartı varsa fatura kapama (`server/lib/invoice-settle.mjs`) kartın
  tahsilatını (plan-in) ve kartın borcunu genel FIFO'ya katıyor; taksit modülü ise kartın ödenenini ayrı sayıyor → iki hesap
  çelişiyor. `test/excel-denetim/taksit-fatura-kapama.mjs`: A (önce fatura) kart tahsilatı 3.000 faturayı da kapatıyor (çift
  sayım); B (önce kart) cari kartından 5.000 tahsilat hiçbir yerde görünmüyor; C fatura hiç ödenmedi, kart tamamen ödendi →
  fatura "Ödendi" (hayalet ödeme, 2.0.17 m5'in akrabası). Değişmez: açık fatura + kart kalanı = cari bakiye; A/B/C'de bozuk;
  Alacak Yaşlandırma 29.440, gerçek 33.440. Düzeltme önerisi (karar kullanıcıda): faturasız ve "Yeni Borç" kartın borcu ve
  tahsilatı kendi içinde kapanır (FIFO'ya girmez); "Carinin Mevcut Borcu" kartında tahsilat faturaları FIFO kapatmaya devam eder.
  Ek (D senaryosu, aynı gün): "Carinin Mevcut Borcu" ile açılan kartta fatura ve kart kendi aralarında tutarlı (fatura açığı
  9.000 = kart kalanı 9.000 = bakiye 9.000) ama Alacak Yaşlandırma AYNI borcu iki kez sayıyor (fatura + kart; 47.440 ↔ gerçek
  42.440). Koddan: Nakit Akış (overview.mjs:299-302), Vade Takip (452-455), takvim/bildirim (dues.mjs:68-72) de iki listeyi
  birleştiriyor → aynı borç iki kez (ölçülmedi, koddan).
  Ek (E senaryosu, Excel haftasında GERÇEKTEN oldu: C0122, ISL-01905 290,60 taksitli + ISL-03375 senet): taksitli faturada
  cari kartından bağsız tahsilat FIFO ile faturayı "Ödendi" yapıyor, faturanın KENDİ taksit kartı ödenmemiş kalıyor
  (fatura 3.000 Ödendi ↔ kart kalan 3.000; müşteri −2.000 alacaklı ama yaşlandırma/hatırlatma 3.000 bekliyor).
  BULGU 3 (04.10.2026, rapor denetiminde; KOD DEĞİŞTİRİLMEDİ): Raporlar → Tüm Raporlar'da cari seçildikten sonra dönem düğmesi
  ("Tüm Zamanlar", "Bu Yıl", "Bu Ay"…) cari seçimini SİLİYOR: Cari Ekstre "Önce cariyi seçin"e düşüyor; fatura raporlarındaki
  isteğe bağlı cari süzgeci sessizce kalkıp rapor BÜTÜN carileri gösteriyor (Deniz süzülü 1 fatura/1.000 → "Bu Yıl" → 2 fatura/
  6.000). Tarih yazıp "Ön İzle" seçimi korur. Kök neden: `client/assets/hof-overview.js:715` onReportClick Raporlar penceresinin
  her [data-preset] tıklamasını da işliyor ve sekmeyi yeniden kuruyor (hof-report-center'ın kendi işleyicisiyle çakışma).
  Yeniden üretim: `test/excel-denetim/rapor-ekstre-secim.mjs` (gerçek tıklamalarla).
  BULGU 4 (04.10.2026, rapor denetiminde; KOD DEĞİŞTİRİLMEDİ): Raporlar → Banka ve POS Hareketleri'nde "Yol" kutusu (Banka /
  POS) HİÇ ÇALIŞMIYOR — kutu "Banka" gösterir, rapor (ekran, PDF, Excel) hep Banka + POS birleşik. Kök neden:
  `server/routes/report-center.mjs:1382` queryOf izin listesinde `payMethod` yok → parametre atılıyor (2.0.17'den beri; müşteri
  isteği "yol süzgeci" hiç çalışmadı; senaryo-216 raporları yalnız varsayılan süzgeçle açtığı için yakalanmadı). Birleşik toplam
  doğru (giriş 139.997,01 = banka 126.647,20 + POS 13.349,81). Yeniden üretim: `rapor-ekstre-secim.mjs` adım 8–10.
  KULLANICI ÖNERİSİ (04.10.2026, "baş mimar olarak onaylarsan"): öncelik 1 = güvenlik/veri bütünlüğü (3 cari türü, 4 tanımsız
  ödeme yolu, 5 API çift fatura); öncelik 2 = performans/UX (1–2 gecikmeler, 6 lisans uyarısı). DEĞERLENDİRMEM: 3/4/5 katılıyorum;
  İTİRAZ (a) 1–2 yalnız "frontend" değil ve ikinci sıra değil: 0 pencerede bile cari not düzeltmesi ~1 sn (sunucu); her açık
  pencere her değişiklikte yeniden sorgu → önce ÖLÇÜM (nereye gidiyor), sonra düzeltme; çok personelli ofiste her gün
  hissedilecek tek bulgu bu. (b) 6 BULGU DEĞİL: testte lisans denetimini ben kapattım; gerçek kurulumda deneme başlamamışsa
  program gerçekten salt okunurdur, uyarı doğru → rapordan düşülecek. Önerilen sıra: 4 → 3 → 1/2 ölçüm → 5 → (6 yok).
  Not: 5'te içerik aynı diye reddetmek YANLIŞ (aynı cariye aynı ürünü iki kez satmak meşru) → istek kimliği (idempotency
  anahtarı) gerekir. 3'te ikili tür eklemek ayrı karar; asgari: yüklemede uyarı + kullanıcı seçimi. Kullanıcının "yap"ı bekleniyor.
  KARAR (kullanıcı, 04.10.2026): "baş mimar ve baş mühendis şapkanla önerdiğin şekilde yap" → 2.0.22 adayı, sıra 4 → 3
  (YALNIZ uyarı + eşleme seçimi, yeni tür YOK) → 1/2 (ölç, sonra düzelt) → 5 (istek kimliği). Her madde: kırmızı test →
  düzeltme → kanıt; sonunda bağımsız gözden geçirme; DENENEN/DENENMEYEN/BİLİNEN SINIRLAR. 6 rapordan düşülür.
  [x] 4. tanımsız ödeme yolu 400   [x] 3. Müşteri/Tedarikçi uyarı + eşleme   [x] 1/2. ölçüm + düzeltme   [x] 5. idempotency
  EK (kullanıcı, aynı gün): "UI'deki donmalar, gecikmeler, çoklu kullanımda arayüzün yetişememesi, cari arama pilindeki
  sorunlar canımı çok acıttı, EN İYİ HALİYLE yap!" → 1/2 ÖNE ALINDI (4'ten hemen sonra). Hedef: çok personelli ofiste
  (aynı şirkette saniyede 1–5 başka kayıt, 5+ açık pencere) arama kutusu anında, açık pencere kapanmaz/sıfırlanmaz,
  sunucu yanıtı pencere sayısıyla katlanmaz; önce/sonra aynı A/B + tuş gecikmesi ölçümüyle kanıt.
  DURUM (04.10.2026, dal `claude/kind-newton-fpmx3f`): 4 commit fec9d40; 1/2 sunucu kısmı (S1 fatura ödeme durumu toplu +
  saklanır, S2 cari bilgi düzeltmesi kapısız + "info" olayı) commit b0498a7 (testler cari-bilgi-222, fatura-durum-222: eski
  kodda kırmızı); istemci kısmı (HOF.refresher: tek yükleme + en sık aralık + gizli sekmede yok + arka plan istekleri en çok
  2 bağlantı; Cari listesi aramayı ezmez, "Daha Fazla"/Tümünü Seç korunur, değişmeyen liste çizilmez), kapıda cari listesi
  bir kez, takvimin tablo kısmı ayrı önbellek, rozet sayı-yalnız (plans count=1) commit edilmedi — ölçüm sürüyor
  (`test/excel-denetim/yuk-olcum.mjs`: AYNI veri kopyası, önce=v2.0.21 kodu, sonra=bu dal). 3 yapıldı (test cari-tur-222 eski
  kodda kırmızı; senaryo-219 adım 3b). 5: kütüphane `server/lib/idempotency.mjs` + test istek-kimligi-222; uca/forma bağlama
  ölçümden sonra (yama hazır). Arayüz senaryosu `test/e2e/senaryo-222.mjs` (CI'ye eklendi). DERS (04.10.2026): ölçüm
  zincirini (önce; sonra) elle yeniden başlatırken eskisini durdurmadım → iki ölçüm aynı anda koştu, sayılar atıldı; artık
  `flock` kilidiyle tek ölçüm.
  KULLANICI (04.10.2026, 2.0.22 sırasında): "işlem bitince GitHub'a yüklenecek doğrulanmış imzalı zipi ve linki ver; sende
  birleştirmeyi yap" → iş bitince: testler + bağımsız gözden geçirme düzeltmeleri → son ölçüm → sürüm 2.0.22 → imzalı paket
  (kullanıcının yüklediği .pem) + kurulum .exe → 3 zip + SHA256SUMS → PR → CI yeşil → BİRLEŞTİRMEYİ BEN YAPARIM (kullanıcı
  izni) → yayın açma bağlantısı (tag v2.0.22) → kullanıcı "yayımladım" → bayt bayt + güncelleyici "available" → site PR'ı.
  DURUM (04.10.2026 16:xx): 4 madde yapıldı; bağımsız gözden geçirme 10 bulgu → hepsi düzeltildi (24fe61a; `test/inceleme-222`
  önce 6/7 kırmızı, senaryo-222 ve 219 adımları eski istemcide kırmızı) + testte bulunan 11. (kart yenilemesi sürerken listeye
  dönen kullanıcıya eski kart geri geliyordu, d6e14bd). Düzeltme commit'leri ikinci bağımsız gözden geçirmede. Kanıt
  `docs/2.0.22-KANIT.md`, CHANGELOG → 2.0.22. Çok carili ölçüm `test/excel-denetim/olcum-cok-cari.mjs` (60.000 caride fatura
  listesi v2.0.21 102–122 ms → 30–33 ms); gerçek denetim verisinde toplu = kart 5.914/5.914 fatura.
  İkinci bağımsız gözden geçirme (düzeltmelerin kendisi) 7 bulgu → hepsi düzeltildi 081dce6 (`HOF.listGate`; eski kodda 7 kırmızı).
  Son kodla: npm test 916/916; 19 arayüz senaryosu 0 hata (222: 56/56); rastgele sıra 2×1.000 işlem 0 hata; mutabakat 3.000
  işlem tutarlı. Son ölçüm (aynı veri/yük): Cari aramasında harf 1,5–7,9 sn → 3–12 ms; 5 pencerede tahsilat 1 → 3,2 kayıt/sn.
  TESLİM (04.10.2026 17:2x; yeni düzen: GitHub'a 5 dosya zipsiz + tek arşiv zip): güncelleme paketi sha256 437ac249… (210
  dosya, HEAD ile bayt bayt), kurulum .exe e0751bd9… (29,4 MB, simgeli), kılavuz PDF 91ffc51d… (değişti → yayından sonra site
  PR'ı); güncelleyici 2.0.21/20/19/18/2.0.4/1.7.0 olarak (API ve yedek yol) "available", kurcalanmış bildirge reddedildi.
  PR ceougur/ofis---y-netimi#22 → CI yeşil olunca birleştirmeyi ben yaparım (kullanıcı izni) → yayın bağlantısı.
  YAYIMLANDI (04.10.2026 ~17:3x; kullanıcı bağlantı isteyince son commit'in CI'si bitmeden squash birleştirildi — kod içeren son
  commit 00d5fc3 CI'de yeşildi, sonrası yalnız belge; `master` = e0d9ec7, `v2.0.22`; dal master'a sıfırlandı). Yayındaki 5 dosya +
  latest/ (exe, json, zip, pdf) teslimdekiyle bayt bayt aynı, exe .sha256 OK; gerçek güncelleyici canlı GitHub'da
  2.0.21/20/19/18/17/2.0.4/1.7.0 olarak (API ve yedek yol) 2.0.22'yi "available" gördü, indirme sha256 437ac249… eşleşti; 2.0.22
  kurulu → "up-to-date". Site kılavuz PR'ı ceougur/destekofis#9 kullanıcının "birleştir"iyle BİRLEŞTİRİLDİ (main 513ebe8, PDF 91ffc51d…). 2.0.22 KAPANDI.
- ŞİRKET SAYISI EN FAZLA 2 (kullanıcı, 05.10.2026: "en fazla 2 şirket kurulabilsin; şu an sürekli yeni şirket açılabiliyor").
  Bu karar 2.0.17'deki "şirket sayısı lisansa bağlı değil, herkese sınırsız" kararını DEĞİŞTİRİR. KARAR (kullanıcı, aynı gün:
  "3 olanlar kalsın, Pro'da da olmasın, en fazla 2 şirket açılabilsin"): (a) bugün 3+ şirketi olan kurulumlarda mevcutlar
  KALIR, hiçbir veri silinmez, yalnız yenisi açılmaz; (b) Pro'da da istisna YOK, herkese 2. Silinen şirket sayılmaz (silince
  yenisi açılabilir). "Ayır" (2.0.21) yeni şirket açmaz, sınırdan etkilenmez.
  YAPILDI (dal `claude/kind-newton-fpmx3f`, yayımlanmadı — sıradaki sürüme girer): `server/lib/companies.mjs` MAX_COMPANIES = 2,
  create() sınırda 409 "En fazla 2 şirket kurulabilir. Yeni şirket açmak için önce bir şirketi silin."; /api/companies `limit`
  ({ max, count, canCreate, reason }); sol üst seçicide ve Yönetim → Şirketler'de "+ Yeni Şirket" pasif + nedeni görünür yazı.
  Test `test/sirket-siniri-225.test.mjs` (çalışıyor mu + nasıl bozarım: başka kod, aynı anda iki istek, personel; 3 şirketli
  eski kurulum). 2'den çok şirket açan eski testler `startTestServer({ maxCompanies })` ile (eski kurulumu canlandırır).
  2.0.25 HAZIRLANDI, YAYIMLANMADI (05.10.2026): PR ceougur/ofis---y-netimi#25 açık, CI 12/12 yeşil, BİRLEŞTİRİLMEDİ; paket
  `dist/teslim-2.0.25/` (bu kod; düzeltmeden sonra YENİDEN üretilecek). Bağımsız gözden geçirme bulguları: (1) Orta — `limit`
  (şirket sayısı) yetkisiz personele de dönüyor, gizli şirketin varlığı sızıyor → yalnız yöneticiye; (2) Düşük — 3+ şirketli
  kurulumda "önce bir şirketi silin" yanıltıcı; (3) Düşük — sınırda bozuk girdi 409 alıyor (dokunulmaz); (4) test aracı
  `test/excel-denetim/saldiri.mjs:108` 3. şirket açmaya çalışıp çöküyor (Cuma testinde kullanılacak); (5) test eksikleri:
  rastgele testin bir turu gerçek sınırla, sirket-siniri-225 "ikisi silinince yenisi açılır" adımı, senaryo-217 silince düğme
  geri gelir; (6) pasif düğme rengi.
  KARAR (kullanıcı, 05.10.2026: "bu haliyle yüklemeyelim, düzeltelim; haftalık limitim %99, Perşembe Türkiye saatiyle 09:00'a
  kur"; "hem Dashboard'da hem Yönetim bölümünde 2. şirket varsa Yeni Şirket ve yanındaki + işareti GELMESİN, çözümü böyle
  olsun"): sınırdayken "+ Yeni Şirket" PASİF DEĞİL, HİÇ GÖRÜNMEZ (sol üst seçici + Yönetim → Şirketler); 6. bulgu bununla
  kalkar. Neden yazısı gerekirse yalnız Yönetim'de kısa bilgi satırı olarak (öneri; düğme yok). 1, 2, 4, 5 de yapılır. Sonra:
  testler → paket/kurulum/PDF yeniden → CI → birleştir → 5 dosya + bağlantı. Hatırlatma: 08.10.2026 06:00 UTC (send_later).
  EK (müşteri, 06.10.2026; kullanıcı "Perşembe yapılacaklara ekle"; ekran: SAYFALAR "TÜM REHBER.xlsx 9.176" seçili +
  "Müşteriler Yeni 109"; sağ altta "SON GÜNE 42 GÜN · Envar Turizm Tarım Taşımacılık İnşaa… · 202092758 · Lisans Bitiş Tarihi ·
  17.11.2026" uyarısı, "Gerçekleştirildi" / "Kayda Git"): "birden fazla sayfa olduğunda birinci sayfadayken ikinci sayfadan
  bir gecikme uyarısı verdiğinde Kayda Git deyince sadece ikinci sayfayı açıyor, o kayda gitmiyor". İSTENEN: Kayda Git =
  uyarının sayfasına geç + o kaydı listede seç, görünür yere kaydır ve sağdaki detay kartında aç (aynı sayfadaki uyarıda
  olduğu gibi). Kök neden Perşembe koddan bulunacak (sayfa değişince liste yeniden yüklenirken kayıt seçimi kayboluyor
  olabilir). Test: iki sayfa, 2. sayfadaki kaydın uyarısı 1. sayfadayken → Kayda Git → 2. sayfa açık, kayıt seçili ve
  detay kartında; zil/takvimdeki "Kayda Git" yolları da aynı; çok sayfada kayıt listenin derininde (kaydırma) de.
  EK 2 (müşteri, 06.10.2026; Perşembe işlerine; ekran: SAYFALAR 2 · "Müşteriler Yeni 109 kayıt" seçili, altında liste boş
  "Aramanızla eşleşen kayıt bulunamadı", "Gösterilen 0 / 0 kayıt", Kaynak: Müşteriler Yeni.xlsx): "ikinci sayfanın altındaki
  sekmeyi komple sildim, yukarıda hâlâ sayfada 109 kayıt diyor; aslında yukarıdan sayfayı komple sil koymamız lazım".
  İKİ İŞ: (a) HATA — sekme silinince üstteki sayfa pilindeki kayıt sayısı güncellenmiyor (109 kalıyor; gerçek 0); boş
  kalan sayfa da "kayıt bulunamadı" ile duruyor. Kök neden Perşembe koddan. (b) İSTEK — sayfa pilinin menüsünde (kalem
  işaretinin yanında/içinde) "Sayfayı Sil": sayfanın tamamı (bütün sekmeleri, kaynak bağı) tek seferde silinir; yalnız
  yönetici; onay penceresinde sayfa adı + kayıt sayısı; Silinenler'e gider (geri yüklenebilir); son kalan sayfa silinirse
  başlangıç ekranına döner; silinen sayfanın uyarıları zil/takvimden kalkar. Önceki not (13. madde): "Sayfa silme yalnız
  yönetici, Silinenler'e gider" — varsa yeri görünür değil, yoksa eklenir; Perşembe koddan doğrulanır. Test: 2 sayfa → 2.'nin
  sekmesini sil → pil 0; Sayfayı Sil → pil kalkar, 1. sayfa açılır, uyarılar kalkar; Silinenler'den geri yükle → 109 geri.
  EK 3 (müşteri, 06.10.2026; Perşembe işlerine; ekran: Yönetim → Şirketler → "Şirket Verisini Sıfırla · 001 · Şirket 1";
  "Onay: şirket kodunu (001) ya da adını yazın" kutusunda "admin" yazılı, altında Parolanız dolu): "isim kısmına direkt admin
  atmasın; yapabilirsen üzerinde bulunduğumuz şirketin kodunu atsın, direkt 001". Olası kök neden (Perşembe koddan doğrulanır):
  tarayıcının kayıtlı giriş bilgisini doldurması — parola alanının hemen üstündeki metin kutusunu kullanıcı adı sanıp
  "admin" yazıyor. YAPILACAK: onay kutusu açılışta şirketin KODUYLA dolu gelir (001), tarayıcı otomatik doldurması kapatılır
  (autocomplete="off" / alan adı kullanıcı adı gibi görünmez; parola alanı "current-password"). Aynı düzeltme aynı kalıptaki
  öbür onay pencerelerine de: Şirketi Sil, Ayır, Geri Yükle. Not: onay kutusu yanlışlıkla sıfırlamaya karşı korumaydı;
  parola sorusu kaldığı için kod önceden dolu gelse de koruma sürer (kullanıcıya söylenecek). Test (arayüz): pencere
  açılınca kutu "001", parola boş; tarayıcının kayıtlı girişi olsa da "admin" gelmez; 002'de "002".
  PERŞEMBE İŞLERİ YAPILDI (kullanıcı 08.10.2026 sabah "şimdi başla"; hatırlatma kapatıldı; commit 480068f, kanıt
  `docs/2.0.25-KANIT.md`): A düğme gizli · B1 limit yalnız yöneticiye · B2 3+ mesaj · B4 saldiri.mjs (sınır 3) · B5 rastgele
  testte gerçek sınır turu (sınırda geçersiz kodla açma 400 değil 409 — test düzeltildi) · C Kayda Git (kök neden: sayfa geçişi
  yeniden yükleme, kayıt taşınmıyordu → sessionStorage "hof-reveal") · YENİ BULGU (kullanıcıya bildirildi): başka sayfanın
  uyarısında "Gerçekleştirildi" açık sayfaya yazıyordu → başka sayfa uyarısında düğme yok · D-a gizli sekme sayılmaz
  (`visibleRowCount`, `totalRowCount`) · D-b "Sayfayı Sil" şeritte (mevcut silme: önce tam yedek, Silinenler'e GİTMEZ — notumdaki
  "Silinenler'e gider" yapılmadı, kullanıcıya söylenecek) · E onay kutusu kodla dolu + görünmeyen kullanıcı adı alanı. Testler:
  sayfa-225, sirket-siniri-225, senaryo-225 (eski kodda 19/37 kırmızı; CI'de).
  İKİNCİ BAĞIMSIZ GÖZDEN GEÇİRME (08.10.2026): 7 bulgu (G1–G7, `docs/2.0.25-KANIT.md` 1b), kullanıcıya listelendi, hepsi düzeltildi:
  kendi silmesinde yanlış bildirim/yedek adı yok, "ilk sayfa" metni, öbür pencerede eski şerit sayısı, Kaydı Sil sayılıyor,
  gizli sekmeli sayım önbelleksiz, silinmiş sayfanın uyarısında yanlış hata, kayıtlı parola kendiliğinden dolabiliyor
  (parola alanı `one-time-code`; gerçek kayıtlı parolayla DENENMEDİ). Eski kodda 7 denetim kırmızı; senaryo-225 45/45; npm test 1.066/1.066.
  TESLİM + BİRLEŞTİRME (08.10.2026 ~06:5x): PR ceougur/ofis---y-netimi#25 CI 12/12 yeşil → squash, `master` = c2206bc (ağaç
  paketlenen fc21059 ile aynı); dal master'a sıfırlandı. Güncelleme paketi sha256 02597e7d… (210 dosya, HEAD ile bayt bayt),
  kurulum .exe c5f644c6… (29,4 MB, simgeli), kılavuz PDF f02e7bc5… (DEĞİŞTİ → yayından sonra site PR'ı); güncelleyici
  2.0.24/23/22/21/20/2.0.4/1.7.0 (API ve yedek yol) "available", kurcalanmış bildirge reddedildi. 5 dosya zipsiz + arşiv zip
  (34,8 MB) gönderildi. Sırada: kullanıcı yayın açar (v2.0.25, 5 dosya; adlar/boyutlar teslimle karşılaştırılır) →
  "yayımladım" → bayt bayt + güncelleyici "available" → site kılavuz PR'ı.
  YAYIMLANDI (08.10.2026 ~06:5x; `v2.0.25` = c2206bc): yayındaki 5 dosya + latest/ (exe, json, zip, pdf) teslimle bayt bayt
  aynı, exe .sha256 OK; gerçek güncelleyici canlı GitHub'da 2.0.24/23/22/21/20/19/18/17/2.0.4/1.7.0 olarak (API ve yedek yol)
  2.0.25'i "available" gördü, indirme sha256 02597e7d… eşleşti; 2.0.25 → "up-to-date". Arşiv 30 MiB gönderim sınırını aştı →
  2 parça (kaynak paketi bölündü, birleştirip klonlandı). Site kılavuz PR'ı ceougur/destekofis#12 açık (PDF f02e7bc5…);
  birleştirme kullanıcının "birleştir"iyle.
- BANKA + POS MODÜLÜ (kullanıcı, 08.10.2026; talimat aynen `docs/BANKA-MODULU-TALIMAT.md`, 45 madde + ekler): "muhasebe programına
  banka modülü yapıp entegre edeceğiz; baş mimar ve baş mühendis şapkanla yap". Ekler: tutarlar float DEĞİL (kesin ondalık);
  POS komisyonunun KDV'si + masraf faturası; banka masraflarında KDV dahil/hariç; TCMB kuru (otomatik ya da elle); dönem sonu
  kur farkı değerlemesi altyapısı; blokeli/teminatlı POS ayrı kategori; POS iadesinde komisyon iadesi/şirkete kalması.
  KULLANICI KARARLARI: arayüz içinden çıkılmaz olmasın — Banka modülünde AYARLAR: standartlar seçili gelir, profesyonel kullanıcı
  istediğini açar; sorulacak hususlarda "en yaygın ve modern" önerim uygulanır (sorulmaz); sol sabit menüde TAKSİTLER'İN
  ALTINDA "Banka". Süreç (talimat 42/45): önce mevcut mimari analizi + 12 başlıklı plan (`docs/BANKA-MODULU-PLAN.md`), sonra
  aşama aşama; mevcut çalışanı bozma, gereksiz bağımlılık yok. Önceki kararlarla bağ: 2.0.17 m9 (Kasa yalnız nakit; banka/POS
  hareketleri `method` ile tutuluyor, Raporlar → Banka ve POS Hareketleri; Kasa ↔ Banka transferi) ve m11 (eksi bakiye denetimi
  banka modülü gelince banka için geri açılır).
  PLAN HAZIR (08.10.2026): `docs/BANKA-MODULU-PLAN.md` (Sürüm 3: 10 alt sistem analizi → 3 mimari öneri + 3 yargıç → sentez →
  2 eleştiri (43 açık) → revizyon → denetim 2 → sürüm 3; açık madde yok) + kullanıcı özeti `docs/BANKA-MODULU-PLAN-OZET.md`.
  Baş mimar kararları K1–K13 (planın Özet'i): yeni tablolar INTEGER kuruş, mevcut REAL kolonlar bu projede değişmez (talimat
  Ek 1'den BİLİNÇLİ SAPMA, ayrı proje Aşama 17); banka POS'u ve masrafında varsayılan BSMV (KDVK 17/4-e), ödeme kuruluşunda
  KDV %20 (talimat Ek 2'den BİLİNÇLİ SAPMA, KDV seçeneği tam); valör gerçek satırla, GET yazmaz; yetki göçünde bugün yapılan
  hiçbir para işlemi kesilmez; tek kaynak (`moneyLines`) ve tek sarmalayıcı (`bank.post`). Teslim sırası: 2.0.26 = Aşama 0
  (mevcut hatalar A1, A2, A3, A4, A6, A7, A9, B5, B7, A12, A13 — kullanıcıya listelendi) → 2.1.0 banka ilk teslim (kabul
  1–16) → 2.2.0 POS → 2.3.0 ekstre/mutabakat + ölçek → 3.0.0 REAL→INTEGER (ayrı karar). Kullanıcının "sorma, önerini uygula"
  kararı gereği plan sunuldu ve Aşama 0'a başlandı; itiraz gelirse ilgili aşama başlamadan plan güncellenir.
  KARAR (kullanıcı, 08.10.2026): "2.0.26 paketini bitirip teslim ettiğinde birlikte yükleyip canlıya alalım; 2.1.0 banka
  kodlamasına öyle başla" → sıra: 2.0.26 paket + PR + CI → birleştir → 5 dosya + bağlantı → kullanıcı yayımlar → bayt bayt +
  güncelleyici → ANCAK SONRA 2.1.0 (Aşama 2+) kodlaması.
  DURUM — AŞAMA 0 (2.0.26) YAPILDI (08.10.2026; dal `claude/kind-newton-fpmx3f`, commit'ler 77dc3ad … a25751f; sürüm no paketlemede):
  11 madde (A1, A2, A3, A4, A6, A7, A9, B5, B7, A12, A13), kanıt `docs/2.0.26-KANIT.md`, CHANGELOG → 2.0.26. Testler
  `test/asama0-226*.test.mjs` 61 (2.0.25'te 42'si kırmızı); npm test 1.127/1.127, mutabakat 2.000 işlem, güvenilirlik 2×1.000,
  21 arayüz senaryosu 0 hata (`senaryo-whatsapp`, `ui-ux-217` koşulmadı). Bilinen sınırlar KANIT'ta.
  BAĞIMSIZ GÖZDEN GEÇİRME (08.10.2026): 4 doğrulanmış hata (G1 yüksek: kilitli günde kapatılmış kart açılıyor/siliniyor/geri
  yükleniyor, kilitli 689 sessizce değişiyordu; G2 yüksek: kilitli tahsilatlı kartın carisi değişiyordu; G3 orta: kilitli kuruşlu
  çekte arayüzden vade düzeltilemiyordu — gerileme; G4 orta: eski satır Mutabakat Testi'nde gizleniyordu — gerileme) + 5 düşük
  (G5 ileri tarihli eski hareketin geri yüklenmesi, G6 Taksite Aktar/Excel taksit kilitte nedensiz 409, G7 silme sorusu metni,
  G8 mahsup/geri yükleme mesajı, G9 bu satır). HEPSİ yeniden üretildi ve düzeltildi (c4a19a7 … 762bb54, 8104c55); kırmızı kanıt
  `test/inceleme-226.test.mjs` a25751f'de 35'in 27'si, `senaryo-226` (CI'de) 12'nin 9'u. Kanıt `docs/2.0.26-KANIT.md` 3. bölüm.
  İKİNCİ BAĞIMSIZ GÖZDEN GEÇİRME (08.10.2026; düzeltmelerin kendisi): 8 doğrulanmış hata (İ1 orta: Taksite Aktar kilitli günde
  kapatılmış karta tahsilat taşırken bütün aktarım nedensiz 409; İ2 Excel taksitte boş grup; İ3 çek formu yanlış yol + kilitli Sil;
  İ5 düzeltme sorusu "çıkış" metni; İ6 silmede Vazgeç kırmızı "Kaydedilmedi"; İ7 mahsuplu satırda değişmeyen alan sınanıyordu;
  İ8 eski ileri tarihli çek kırmızı + tablo adı; İ10 Kasa özeti iki kez) + 2 ölçüm (İ4, İ9: yeni kapı sorguları ~+14–16 ms /
  10.000 cari; kapının kendisi ~1 sn/COMMIT → Aşama 2). HEPSİ düzeltildi (6ed1d40 … 4b5c76d); kırmızı kanıt
  `test/inceleme-226-2.test.mjs` bdd1be6'da 27'nin 17'si, `senaryo-226` 25'in 10'u. Son kodla npm test 1.189/1.189, mutabakat
  2.000 işlem, güvenilirlik 2×1.000, 7 arayüz senaryosu 0 hata. Kanıt `docs/2.0.26-KANIT.md` 4. bölüm.
  TESLİM + BİRLEŞTİRME (08.10.2026 ~16:1x; kullanıcı: "2.0.26 paketini bitirip teslim ettiğinde birlikte yükleyip canlıya
  alalım"): PR ceougur/ofis---y-netimi#26 CI 12/12 yeşil → squash, `master` = 5346ff8 (ağaç paketlenen b4c9853 ile aynı); dal
  master'a sıfırlandı. Güncelleme paketi sha256 ee76d7f4… (HEAD ile bayt bayt), kurulum .exe 191feb6a… (30,9 MB, simgeli),
  kılavuz PDF 63d536ad… (DEĞİŞTİ → yayından sonra site PR'ı); 24 arayüz senaryosu son kodla 0 hata. Arşiv 2 parça (30 MiB
  sınırı). Sırada: kullanıcı yayın açar (v2.0.26, 5 dosya; adlar/boyutlar teslimle karşılaştırılır) → "yayımladım" → bayt
  bayt + güncelleyici "available" → site kılavuz PR'ı → ANCAK SONRA 2.1.0 (Aşama 2+).
  YAYIMLANDI (08.10.2026 ~16:3x; `v2.0.26` = 5346ff8; yayımdan önce kullanıcının ekranındaki 5 ad/boyut teslimle karşılaştırıldı):
  yayındaki 5 dosya + latest/ (exe, json, zip, pdf) teslimle bayt bayt aynı, exe .sha256 OK; gerçek güncelleyici canlı GitHub'da
  2.0.25/24/23/22/21/20/19/18/17/2.0.4/1.7.0 olarak (API ve yedek yol) 2.0.26'yı "available" gördü, indirme sha256 ee76d7f4…
  eşleşti; 2.0.26 → "up-to-date". Site kılavuz PR'ı ceougur/destekofis#12 2.0.26 PDF'iyle (63d536ad…) güncellendi (başlık
  "Kılavuz PDF 2.0.26"); birleştirme kullanıcının "birleştir"iyle. 2.0.26 KAPANDI → 2.1.0 banka kodlaması başladı.
- 2.1.0 BANKA İLK TESLİM (dal `claude/kind-newton-fpmx3f`; plan §12.1: Aşama 2–9 + 13 + 14–16 dilimleri; kanıt `docs/2.1.0-KANIT.md`).
  [x] AŞAMA 2 finansal çekirdek (08–09.10.2026; 2cb93c5..72f72a6, 37 commit; arayüz DEĞİŞMEDİ): minor.mjs (kuruş tamsayı,
      özellik testi 1e12), iş günü + TR takvimi 2024–2031, config.now sahte saat, v20 göçü (banka/POS/ekstre tabloları, fin_ref/
      event_id, yetki göçü K4 + `bank.granted` işareti), kalıcı request_keys, İşlem No (BNK-yıl-sıra; sıfırlamada geri gitmez;
      tarih yılı değişse de kalıcı), bank.post + bütün mevcut para yazıcıları ondan geçer, K6 (statik test + izinli liste,
      money:event, store.raw), moneyLines tek kaynak (Kasa/Banka-POS raporu/ANLIK DURUM/defter; 2.0.26 ile altın test satır
      satır aynı), açılış onarımı, `npm run mutabakat -- --sirket`, göç zinciri 2.0.16→2.0.26→v20 (2.0.21–2.0.26 fikstürleri
      gerçek sürüm koduyla). KAPI §3.11 KARARI: iki aşamalı kapı (önce dokunulan varlıklar, şüphede v2.0.26'nın tam kapısı;
      testlerde ikisi birlikte + eşdeğerlik denetimi) → yazım başına kapı 100.000 satırda 7,96 sn → 7,1 ms, 1.000.000'da 129 sn →
      8,7 ms; 15 dk tam tarama ayrı iş parçacığında. Bağımsız gözden geçirme 3 bakış: 9 doğrulanmış + 11 düşük → hepsi kapandı
      (D7, D9 bilinen sınır). Son kod: npm test 1.421/1.421 (benim koşumum da, 7 dk 53 sn), mutabakat 2.000, güvenilirlik 1.000,
      14 arayüz koşusu 0 hata. Bilinen sınırlar: tam kapıya düşen işlem (kilit koyma, kilitli satıra dokunan düzeltme) büyük
      veride v2.0.26 kadar sürer; Mutabakat Testi düğmesi 100.000'de ~10 sn bekletir; 1M bellek ölçülmedi.
  [x] AŞAMA 3–4 banka hesapları + banka fişleri (09.10.2026; f46f748..b44d133): menüde Taksitler altında Banka, pencere, Kurulum
      Sihirbazı (geri alınabilir), Hesaplar/hesap kartı (IBAN), açılış + Bakiye Doğrulandı, Hesabı Atanmamış + Bu Hesaba Ata, Alt
      Hesap Mizanı verisi, Ayarlar (Temel/Gelişmiş, Varsayılanlara Dön); Banka Fişi (masraf BSMV/KDV dahil-hariç, faiz+stopaj, kart
      borcu, kredi), Ters Kaydet/Düzelt, Hareketler, İşlem Kartı, Benzer İşlem, Planlı İşlemler; 649 Tekdüzen adı. Gözden geçirme
      33 kayıt (28 ayrı: 5 yüksek) → 27 düzeltildi, 1 kısmen (Banka Masraf Raporu ekranı yok). npm test 1.598/1.598, mutabakat 2.000,
      güvenilirlik 2×1.000, senaryo-banka-210 238/238. Bilinen sınır: 1M harekette dönemli Alt Hesap Mizanı ~4 sn, yıllık Banka
      Masraf Raporu ~5 sn (tarih indeksi yok → 2.3.0 ölçek işi). Sırada (daraltılmış): modül ekranlarında hesap seçimi (+ eksi
      bakiye denetimi ve money.prime modül yazımlarında), transfer, raporlar, kabul 1–16 ekrandan, kılavuz, tek gözden geçirme, paket.
  [x] AŞAMA 5–6 daraltılmış (09.10.2026; 63f8aae, d000df3): cari tahsilat/ödeme ve Kasa↔Banka'da hesap seçimi (tek hesapta
      kendiliğinden, çok hesapta zorunlu, döviz/pasif 400, açılış/Devir öncesi 409), K7 eksi bakiye, istek kimliği, Benzer İşlem,
      banka bağlı cari silinmez (Pasife Al). npm test 1.630/1.630; senaryo-banka-210 257/257 (kabul 5, 9–14 ekrandan).
  [x] AŞAMA 7–8 hesap seçimi (fatura peşini, taksit/kayıt, stok, çek; 8fa8236, fc939d2) + hızlı Nasıl Bozarım (e69e1b9) + yargıç/
      eleştirmen düzeltmeleri (cd4e7ac..cdb3646: kart silme 409 plan-bank-linked, geri yükleme K7/pasif, pasif hesap, Vazgeç, toplu
      iptal, lineKey) + Canlı Hata 2 (aa2520d: iade+geri ödeme kartı büyütmesi, açılış onarımı, model). npm test 1.691.
  [x] AŞAMA 9 bankalar arası transfer (ac5305b..825b198): ücret/BSMV, kanal, valör, planlı, Ters Kaydet/Düzelt, kredi, bank:transfer
      kapısı, Genel Bakış "Bugün ve Bu Ay"; kabul 13–16 ekrandan; transfer 23 test (eski kodda 22 kırmızı); npm test 1.714; mutabakat
      tohum 1/2/3 tutarlı; güvenilirlik 2×1.000; senaryo-banka-210 330/330. Sırada: banka raporları + K10 (ANLIK DURUM, Birleşik Rapor,
      Banka ve POS Hareketleri'nde transfer bacakları), eşleme tablosundaki eksik testler, kabul 1–16, kılavuz, son yargıç+eleştirmen.
  İSTEK (kullanıcı, 09.10.2026): "hızlı bir şekilde nasıl bozarım testi de yaptır, düzeltilmesi gereken yerler olursa düzelt"
      → Aşama 7–8 doğrulaması bitince hesap seçimi işi (cari, Kasa↔Banka, fatura peşini, taksit/kayıt, stok, çek) için ayrı
      bağımsız saldırgan test ajanı; bulunan her açık önce kırmızı test, sonra düzeltme; sonuç kullanıcıya listelenir.
      EK (kullanıcı, aynı gün): "yargıç ve eleştirmenden de geçsin" → saldırgan test bitince iki bağımsız, kod değiştirmeyen
      ajan: ELEŞTİRMEN (düzeltmelerin ve testlerin açığını, kaçan bozma yollarını arar) + YARGIÇ (her bulgu/iddiayı yeniden
      üreterek doğrular, önem ve "teslime engel mi" kararını verir); engel bulgular kırmızı test → düzeltme; sonuç kullanıcıya.
      KARAR (kullanıcı, 09.10.2026: "plana uy her koşulda"): karar gerektiren bulgularda `docs/BANKA-MODULU-PLAN.md` neyi
      söylüyorsa o uygulanır, kullanıcıya sorulmaz. Plan susuyorsa en yaygın ve modern seçenek (önceki karar). Kapsam daraltması
      (ertelenenler) kullanıcı kararı olarak geçerli kalır. DÜZELTME (yargıç): §5.1'in "2'den çok ondalık 400" kuralı yalnız BANKA
      uçları içindir; modül uçları (cari, fatura, taksit…) plana göre "bugünkü gibi" 1,005 → 1,01 yuvarlar (kullanıcıya düzeltildi).
      Yargıç (09.10.2026): H1–H3b doğrulandı, kapalı; K1 geri yükleme K7/pasif hesabı deliyor (Ziraat −50.000) → 2.1.0'da düzeltilir;
      Y1 pasif hesap silme/taşıma, Y2/K3 toplu iptal-silme negativeOk, K2 lineKey yinelenmesi → aynı düzeltme turunda.
  İSTEK (kullanıcı, 09.10.2026): "yapılan işlemlerin tutarlılığı, tüm raporlarla uyumluluğu için raporda yazan uzman yazılım ve
      muhasebe mühendisi testleri atlanmasın, rapora uy"; DÜZELTME (aynı gün): "rapora uy yanlış söyledim, plana uy!" → planın (`docs/BANKA-MODULU-PLAN.md`) test maddeleri HİÇBİRİ atlanmaz:
      §12.2 (npm test, test:mutabakat, test:guvenilirlik, göç zinciri, arayüz senaryoları; iş akışı testi sıfırdan, ARAYÜZDEN,
      bağımsız beklenenle, ekran görüntüsüyle), teslim edilen her aşamanın "Çalışıyor Mu / Nasıl Bozarım / Kabul" satırları (2.1.0
      kapsamına giren her madde), §12.4 Nasıl Bozarım ana listesi (kapsamdaki maddeler), §12.5 kabul 1–16 sayılarla + mizan bağımsız
      modelle, Aşama 14 (her rapor × süzgeç × ekran/PDF/Excel; bağımsız beklenenle açıklanmamış fark 0; TOPLAM = satırlar),
      Aşama 15 (yetki matrisi, ?hofCompany=, salt okunur), Aşama 16 dilimleri. Kapsam dışı (ertelenen) maddeler "DENENMEYEN —
      ertelendi" diye KANIT'ta tek tek listelenir; sessizce düşülmez. Teslimden önce plan-test eşleme tablosu (madde → test → sonuç).
      EŞLEME (09.10.2026, `docs/2.1.0-PLAN-TEST-ESLEME.md`): 268 madde; kapsamda 229 → 148 VAR, 50 KISMEN, 31 YOK (19'u yapılmamış iş:
      transfer, kabul 15–16, banka raporları, K10 ANLIK DURUM + Birleşik Rapor, kılavuz). Eksik testler: 27 mevcut rapor bankalı veriyle
      bağımsız modele karşı hiç sınanmadı (raporlar-224 verisine iki hesap + her modülde bağlı havale eklenecek); kabul 16 sonu mizanı
      bağımsız modelle; mutabakat motoru/rastgele testte fatura/stok/kayıt peşini ve transfer bağlı değil; eşleşmiş satır koruması
      yalnız cari + fiş; yetki matrisi, `previous` statik taraması, salt okunur lisans, iki oturumlu eşzamanlılık; ekrandan kayıt
      tahsilatı/stok peşini/çek ödemesi/Düzenle'de hesap taşıma; Banka "Bugün Çıkış"/"Transfer" satırı (kabul 13–14) yok. Eleştirmen
      + eşleme ayrı ayrı buldu: taksit KARTI silme bağlı banka tahsilatını sessizce düşürüyor (yüksek) → düzeltme turunda.
  CANLI HATA 2 (09.10.2026; mutabakat tohum 1 incelemesinde; 2.0.24 G1 düzeltmesinin GERİLEMESİ, v2.0.24/25/26'da VAR, v2.0.23'te yok;
      gerçek etiket kodlarıyla API'den ölçüldü): peşinli + taksitli satış faturasında iade + peşinin geri ödenmesi taksit kartını
      yeniden BÜYÜTÜYOR. Ör. 1.000 (500 peşin, 500 taksit) → malın tamamı iade, 500 nakit geri → cari 0, fatura açığı 0, Kasa 0 ama
      kart Kalan 500, bugün vadeli → Geciken Taksitler, Alacak Yaşlandırma, ANLIK DURUM "Geciken Alacak", cari kartı, Vade Takip,
      (koddan) takvim/zil/WhatsApp hatırlatma borçsuz müşteriyi gecikmiş gösterir. Para/defter/mutabakat kapısı doğru. Kök neden
      `invoices.mjs` ~1304 hedef = açık(0'da kırpılı) + Σ geri ödeme → doğrusu max(0, imzalı açık + geri ödeme); model
      (`test/mutabakat/motor.mjs` 122/124/273) aynı hatayı taşıyıp gizliyordu. Önem YÜKSEK. Öncek kararın örneğiyle (Kasa çift
      sayım: "2.1.0 ile gelsin") 2.1.0'da düzeltilir + mevcut veride yanlış büyümüş kartlar için açılış onarımı; kullanıcıya bildirildi.
  [x] AŞAMA 14 daraltılmış (0beded4): Banka Bakiye/Hareket/Masraf + Alt Hesap Mizanı; ANLIK DURUM "Gerçek Banka" (K10); Birleşik Rapor 3
      banka sütunu; Banka ve POS Hareketleri'nde transfer iç hareket; banka-210-raporlar 14 (eski kodda 14 kırmızı). Açık: Nakit Akış
      başlangıcı K10'a çevrilmedi, Vade Takip/zil banka kalemleri yok.
  EKSİK TEST TURU (10.10.2026; worktree dalı `worktree-agent-a9996cccca67b1040`, kapsayıcı yeniden başlayınca yarıda kaldı → yeni
      ajan tamamlıyor, ana dala birleştirilecek) BULDUĞU HATALAR (önce kırmızı test, düzeltildi; kullanıcıya listelendi):
      R1 CANLI (v2.0.23–2.0.26'da da var): iadenin müşteriye geri ödenen kısmı fatura kapamada BAŞKA açık satış faturasını "Ödendi"
      gösteriyor / aynı carinin alış faturasını ödüyordu (1249a0c). R2: Gider Raporu bütün gider türlerini TEK satırda birleştiriyordu
      (SQL takma ad çakışması; b5f2ba3). R3: ekstreyle eşleşmiş satırda çek geri alma ve fatura Düzenle/İptal/Sil 409 yerine 200
      (31b7117; eşleşme 2.1.0'da ekrandan yapılamadığı için canlı etkisi yok). R4 CANLI (v2.0.20–2.0.26; büyük/küçük harf duyarlı
      dosya sisteminde): şirket adı yalnız büyük/küçük harf farkıyla değişince silinmiş şirketten kalan yedek klasörü veriliyor, yedekler
      oraya taşınıyordu (güvenilirlik tohum 2 işlem 2331; f241559 → af83d46). R5 CANLI (v2.0.24–2.0.26): fazla tahsilatlı taksit kartında
      iade iptali kartı faturanın açığına kadar büyütmüyordu (açık 1.500 ↔ kart kalanı 1.000; mutabakat 5.000 tohum 2 işlem 3414;
      9340b9c → 326b87b). R4/R5 kullanıcıya listelendi (10.10.2026); ana oturum kırmızı/yeşil doğrulaması birleştirmeden önce.
  BAĞIMSIZ KÂHİN + HAKEM (10.10.2026; `test/bagimsiz/`, kanıt `docs/kanit/2026-10-10/kahin/`): plandan, program kodunu görmeden iki
      Python modeli + program; kabul 1–16 üç tarafta fark 0 (planın 28 sayısı); tohum 1–30 × 500 + 31–33 × 2.000 işlem → 13 fark sınıfı,
      açıklanamayan 0; bilinen nedenler nötrlenince 474.000 yaprakta yalnız 259 fark (BANKA-EKSI-KODU). HAKEM (her sınıf en küçük
      senaryoya indirildi, v2.0.26 gerçek koduyla ölçüldü) — PROGRAM YANLIŞ, kullanıcıya listelendi, DÜZELTİLECEK:
      K1 İADE KAPANIŞI (orta, v2.0.26'da VAR; R1'den AYRI kök): geri ödenen iade asıl faturanın açığından da düşüyor (aynı alacak iki
         kez) → "ödenen 240" hayalet kapatan, kalan alacak hiçbir açık belgede/yaşlandırmada yok; taksitli komşuda fatura 360 ↔ kart 600.
      K2 KARTLA ÖDEME KURUMSAL KART HESABINA BAĞLANMIYOR (YÜKSEK, 2.1.0 teslime engel; plan §3.5/§3.7 #3 #5): pickRef yalnız havale;
         satır 108.00'e düşüyor, kart limiti (K7) çalışmıyor, iki kartta seçim istenmiyor, yanlış türde hesap sessizce kabul.
      K3 KASA ELLE HAREKETİ İSTEK KİMLİĞİ YOK (orta, v2.0.26'da VAR; plan §7/§3.10): çift gönderimde Kasa + 770 çift; istemci de göndermiyor.
      K4 Nakit ön denetimi istek kimliğinden ÖNCE (düşük–orta; plan §3.3 sırası): Kasa'yı sıfırlayan ödemenin yeniden gönderimi 409
         "Kasa eksiye düşer" (accounts.mjs:655, cash.mjs:274; plans/stock/cheques aynı kalıp, koşulmadı).
      K5 Banka eksi bakiye ret kodu bank-negative/bank-blocked + negativeOk (düşük; plan §7 cash-negative/cash-blocked + accountId, cashForce).
      K6 Kasa açılışı/devir yolu yok — devreden nakit 649'a (gelir) yazılıyor (düşük, v2.0.26'da VAR; plan susuyor → yaygın: 500).
      K7 KMH: API Ticari/Diğer/Vadeli'de KMH kabul ediyor; Vadesiz→Ticari çevrilince KMH kalıyor → Engelle atlatılıyor (düşük, ekrandan).
      K8 Kredi: Ters Kaydet/Düzelt'te yanlış ret metni; geri ödeme tarihe bakmıyor (ara dönemde ters bakiye); Açılışı Düzelt deliği (düşük).
      TEST AÇIKLARI: vadeli hesapta other_in/other_out/interest_out → 400 kalıcı testte yok; rastgele kâhin koşusunda Kasa elle hareketi
      silinmedi (model_b hatası). PROGRAM DOĞRU çıkanlar: KDV dahil iskonto (dil yanlıştı), vadeli fiş, kredi anapara aşımı, KMH açılışı.
      Kâhin araç hataları (düzeltilecek): model_a K-4, koşucu alış numarası, model_b Kasa silme geçerliliği.
  İSTEK (kullanıcı, 09.10.2026): "tüm işlemler bitince bağımsız yargıç ve yargıç kararını eleştirmenden tekrar geçir, sonra plana
      uy!" → 2.1.0'ın BÜTÜN işleri (düzeltme turu, eksik testler, transfer, raporlar, K10, yetki, kabul 1–16, kılavuz) bitince, paketten
      ÖNCE: (1) bağımsız YARGIÇ (kod değiştirmez; bütün 2.1.0'ı ve bulguları yeniden üreterek doğrular, önem + teslime engel kararı);
      (2) ELEŞTİRMEN yargıcın KARARINI denetler (yanlış "engel değil", kaçan yol, zayıf kanıt); (3) ikisinin sonucuna göre plana uyulur
      (karar gerektiren yerde plan, plan susarsa en yaygın/modern); engel bulgular kırmızı test → düzeltme → sonra paket.
  CANLI HATA (gözden geçirmede bulundu, v2.0.26'da da VAR, gerçek v2.0.26 koduyla yeniden üretildi): Taksite Aktar (var olan
  bağsız karta) → taşınan tahsilatı sil → aktarımı geri al → Silinenler'den geri yükle → Kasa ÇİFT sayılır (1.000 yerine 2.000),
  Mutabakat Testi "tamam" der. 2.1.0'da düzeldi (bir olay = bir para hareketi, 409 `event-in-use`). Kullanıcıya bildirildi.
  KARAR (kullanıcı, 09.10.2026): "2.1.0 ile gelsin" → ayrı 2.0.27 YOK; 2.1.0 teslim notunda/CHANGELOG'da bu düzeltme ayrıca yazılır.
  KAPSAM DARALDI (kullanıcı, 09.10.2026; haftalık limit %62, yenileme Perşembe 15.10; önerdiğim 1. yol kabul): 2.1.0 =
  Aşama 2 ✓ + 3–4 (banka hesapları, fişler, ekranlar) + HER FORMDA havale/EFT için HESAP SEÇİMİ (cari, Kasa↔Banka, fatura
  peşini, taksit/kayıt tahsilatı, stok peşini, çek tahsil/ödeme) + bankalar arası transfer + temel banka raporları (Banka
  Bakiye, Banka Hareket, Banka Masraf, Alt Hesap Mizanı, ANLIK DURUM K10) + yetki + kabul 1–16 EKRANDAN + kılavuz Banka bölümü
  + TEK bağımsız gözden geçirme + paket. ERTELENEN (15.10 sonrası, 2.1.x/2.2.0): döviz/kur ve değerleme (Aşama 13), Bankaya
  Tahsile Ver, fatura iade/iptalinin bankalı ayrıntısı + TCMB önerisi, K8 taksit kuralları (plan-paid/plan-overpay), toplu
  kesim ayrıntısı, kalan banka raporları; POS 2.2.0, ekstre 2.3.0 (zaten planlı). Ertelenenler 2.1.0'da GÖRÜNMEZ.
  Kullanıcı sorusu: daraltılmış 2.1.0 bitince canlıya mı, yoksa Perşembe sonrası tamamı mı? → önerim: daraltılmış 2.1.0
  testler + kabul 1–16 + gözden geçirme temizse canlıya (Kasa çift sayım düzeltmesi de erken gider). KARAR (kullanıcı,
  09.10.2026: "önerdiğin yoldan devam edelim") → daraltılmış 2.1.0 temiz çıkınca CANLIYA; ertelenenler 15.10 sonrası.
  Planlı test (trig_0144BJLRwsZFizXTTYrJVszA) kullanıcı isteğiyle Pazar 11.10'dan CUMA 16.10.2026 09:00 TR'ye (06:00 UTC) ertelendi.
  KARAR (kullanıcı, 10.10.2026: "limit sorunumuz ortadan kalktı, daraltılmış olarak değil plana uygun olarak devam et") → KAPSAM
      DARALTMASI KALKTI: 2.1.0 planın §12.1'deki tam hâli (Aşama 2–9 + 13 döviz + 14–16 dilimleri; Bankaya Tahsile Ver, fatura
      iade/iptalinin bankalı ayrıntısı + TCMB önerisi, K8 taksit kuralları, toplu kesim ayrıntısı, kalan banka raporları DAHİL).
      POS (2.2.0) ve ekstre (2.3.0) planın kendi sırasında kalır. Not: aynı anda iki ajan "haftalık sınır, 14.10 23:00 UTC'de
      sıfırlanır" hatasıyla durdu (eksik test turu, kılavuz); yarım işleri worktree'de ve ana ağaçta yerinde.
  KARAR (kullanıcı, 10.10.2026: "limit sorunu ortadan kalktı; arka planda çalışan ajan, yargıç, eleştirici kısıtlamaları kaldıysa
      kaldır, ihtiyaç duyulan kadar ajanı, yargıcı, eleştirmeni çalıştır. plana tam uy!") → ajan/yargıç/eleştirmen sayısında kısıt
      YOK; her iz (track) için uygulama → bağımsız yargıç → eleştirmen → düzeltme döngüsü, engel bulgu kalmayana kadar; sonunda
      bütün 2.1.0 için yargıç + yargıcın kararını denetleyen eleştirmen (önceki istek). Plan (`docs/BANKA-MODULU-PLAN.md`) her koşulda.
      Kalan izler: Aşama 13 döviz; Aşama 8 kalanı (K8 taksit kuralları, Bankaya Tahsile Ver); Aşama 7 kalanı (iade/iptal bankalı
      ayrıntı §4.6, Fatura Ayarları → Banka Hesapları, gider türleri 770/653, toplu kesim, bağ türleri, TCMB önerisi); Aşama 14–15
      kalanı (§8.10 raporları, Nakit Akış K10, Vade Takip/zil, SOURCE_LABELS/EVENT_LABELS, Silinenler kuralı); kılavuz; kabul.
- SÜRE VE TEMEL BANKA SÜRÜMÜ (kullanıcı, 10.10.2026): "kaç gündür 1-2 gün diyordun, şimdi 6-9 gün; nedeni, nasıl iyileştiririz?" → neden
  (kapsam 10.10'da tam plana döndü, doğrulama çıtası, bulunan ~15 hata, benim madde saymadan verdiğim tahminler) ve öneriler (sürümü böl,
  uzun koşuları GitHub CI'de paralel, ağır doğrulama bir kez, günlük plan↔gerçek tablosu) verildi; seçim sorusu kullanıcı tarafından
  kapatıldı. Ardından: "müşterilerin kullanacağı TEMEL banka modülünü bitirip yüklesek mi, ne kadar sürer? HEMEN YAPMA, ÖNCE KONUŞALIM"
  → kapsam/süre önerisi verildi.
  KARAR (kullanıcı, 10.10.2026: "TEMEL SÜRÜME BAŞLA"): 2.1.0 = TEMEL BANKA SÜRÜMÜ (bitmiş banka kısmı: hesaplar/sihirbaz, fişler, her
  formda havale hesabı, transfer, 4 banka raporu + ANLIK DURUM Gerçek Banka + Birleşik Rapor, yetki, eşleşme koruması) + bugün bulunan
  bütün hata düzeltmeleri (R1–R5, D2, K1, K3, K4, K5, K7, K8) + KURUMSAL KART BAĞI (K2; önerim uygulandı — kullanıcı "önerin uygulanır"
  kararı) + Nakit Akış K10 başlangıcı + ertelenenlerin görünmediği denetimi + kılavuz Banka bölümü + yargıç/eleştirmen + plan alt
  sınırında son doğrulama (UZUN KOŞULAR GitHub CI'de paralel — önerim; depo herkese açık, dakika ücretsiz) + paket. TAHMİN DÜZELTMESİ (kullanıcı
  "paketi 2 dk'da veriyordun, neden 0,5 gün?"): paket 1–2 saat (iş 30–45 dk + PR CI ~25 dk; Wine/Inno/windres kurulu); 0,5 gün
  şişirilmiş pay idi. Kritik yol kart → yargıç/eleştirmen → son doğrulama → paket: toplam 2,5–3,5 iş günü.
  KAZANÇ (kullanıcı "bu iki önerim zaman kazandıracak mı?"): zorunlu görevi CI 517 ile kapatmak birkaç saat + odak; ağır testleri
  sona ve GitHub'a almak ~1 gün (20.000 yerel 5–8 sa ve ölçek 30/1M 3–5 sa kritik yoldan çıktı; ajanların ara uzun koşuları kısaltıldı,
  K1 ve K2 ajanlarına iletildi). YENİ TAHMİN 2–3 iş günü. ERTELENEN 2.1.1/2.2.0:
  döviz/kur/değerleme (Aşama 13), Bankaya Tahsile Ver, K8 taksit avans/fazla ödeme kuralları, faturanın bankalı iade/iptal ayrıntısı ve
  toplu kesim, kalan §8.10 raporları, Kasa açılış/devir (K6); POS 2.2.0, ekstre 2.3.0 yerinde. Tahmin 3–4 iş günü. Plan sırası bu
  kararla değişti (döviz 2.1.0'dan çıktı).
  ZORUNLU GÖREV KAPANDI (kullanıcı önerisi, 10.10.2026: "CI 517 ile zorunlu görevi mühürle ve kapat; tek kararsız test için süreci
  durdurma, gerekiyorsa karantinaya al" — karar bende): KAPATILDI, KARANTİNA YOK. Mühür CI 517 + art arda 518–521 (dört platform
  1885/1886, Windows 5 koşu yeşil). Kapıyı kırmızı tutan tek şey bilinçli `todo` (Nakit Akış K10) — kararsız test değil; atlamak kapının
  "atlanan = doğrulanmadı" kuralını deler. T4 ile kapanır. Rapor `docs/kanit/2026-10-10/ZORUNLU-GOREV-RAPORU.md` (8 başlık, açıklar 7.).
  MALİYET (kullanıcı, 10.10.2026: "GitHub'da Hobby planım, limitimi etkileyemiyor doğru mu? maliyet çıksın istemiyorum"): depo HERKESE
  AÇIK → standart Linux/Windows koşucuları ücretsiz; GitHub'dan okundu: CI 509 19,5 dk sürdü, faturalanan 0 ms; Uzun Doğrulama ve CI 521
  faturalanan 0. Gerçek sınır eşzamanlı iş sayısı (Free: 20, CI ile paylaşılır) → Uzun Doğrulama #1 (22 iş aynı anda) İPTAL edildi;
  iş akışı her matriste en çok 6 iş (CI'ye 8 yuva kalır) ve depo özel yapılırsa HİÇ başlamaz (if: private değil). Test ci-kapi-listesi
  bunları denetler. Kural: ücretli koşucu (büyük/GPU), özel depoda uzun iş, ücretli eylem yok.
  YAYIN KARARI (kullanıcı, 10.10.2026: "eski ve yeni hataları düzeltilmiş temel paket banka modülü bitince yükleyelim"): ayrı ara
  düzeltme sürümü (2.0.27) YOK; canlıdaki eski hatalar (Canlı Hata Kasa çift sayım, Canlı Hata 2, R1, R4, R5, K1, K3 — v2.0.26'da da var)
  ve yeni hatalar 2.1.0 TEMEL SÜRÜMLE birlikte gider. Temel sürüm bitince (kapsam yukarıda; yargıç + eleştirmen + son doğrulama temiz,
  CI ve Uzun Doğrulama Kapısı yeşil) 2.0.26'daki "birlikte yükleyip canlıya alalım" düzeniyle: paket + PR + CI yeşil → birleştir →
  5 dosya + yayın bağlantısı + elle kabul listesi → kullanıcı yayımlar → bayt bayt + güncelleyici → site kılavuz PR'ı. Teslimde
  "bitti" demeden önce kullanıcıya DENENEN / DENENMEYEN / BİLİNEN SINIRLAR ve ertelenenler listesi açıkça verilir.
  T4 BİRLEŞTİ (10.10.2026; 2f89d81, ana oturum: değişen testler 115/115, eski kodda 8/82 kırmızı; senaryo-banka-210-temel CI'de 8b3c65c):
  Nakit Akış başlangıcı = Nakit Kasa + Gerçek Banka (K10); ertelenen banka ayarları API'den de değiştirilemez (400 bank-setting-later),
  Elle Banka Fişi kapalı (önceden API'den Kambiyo Kârı fişi yazılabiliyordu). YENİ BULGU (T4 ajanı, gerçek v2.0.23 koduyla üretildi;
  kullanıcıya listelendi, düzeltme ajanda): ORTA — ileri tarihli eski hesapsız havale Kurulum Sihirbazı'nı ve "Bu Hesaba Ata"yı 409
  ledger-integrity ile kilitliyor (geçmiş tarihliler de aktarılamıyor; plan madde 42/A13'e aykırı); DÜŞÜK — Hesabı Atanmamış toplamı
  ileri tarihliyi sayıyor; DÜŞÜK — Nakit Akış "Tahmini Kasa" adları artık nakit+banka. Kılavuz satırı ("bugünkü kasadan başlayan") T5'e.
  K1 BİRLEŞTİ (10.10.2026; ca8ea75; ana oturum: birleşik kodda 177/177, yeni test eski kodda 16/18 kırmızı): geri ödenen iade asıl faturaya
  mahsup edilmez (aynı alacak iki kez kullanılmıyor); kart kalanı = fatura açığı; mahsup edilmemiş iade belgesinin açığı fatura kartında ve
  Açık Faturalar raporunda görünür (yaşlandırma/nakit akış/vade takip/ANLIK DURUM'a girmez — bakiye zaten net). Açılış onarımı gerekmedi
  (ödeme durumu saklanmıyor, her açılışta yeniden hesaplanıyor). KARAR (baş mimar; plan susuyor → yaygın): kâhinde kalan tek desen —
  geri ödenmemiş iadenin asıl faturayı AŞAN alacağı carinin en eski açık borcunu kapatır (2.0.15'ten beri R1c; 2.0.17 m5 yön kuralıyla
  tutarlı; Logo/Mikro otomatik kapaması gibi). Kâhin dili §7 kural 6'ya bu SPEC olarak eklenir (programdan türetilmiş beklenen değil);
  modelleri program kodunu görmeyen ajan günceller (T6/T7 son kâhin koşusundan önce).
  İSTEK (kullanıcı, 10.10.2026: "sheets bağlanırsa programın oraya da yedek alıp almadığını da denetle"). KODDAN İLK BAKIŞ: program
  Sheets'e HİÇ yazmaz (sheets.mjs yalnız dışa aktarım adresinden okur; yedek kodunda Sheets yok); bulut yedeği ayrı ayar (Yönetim → Drive:
  klasör yolu ya da Drive bağlantısı, cloud-backup.mjs). Sheets'ten gelen tablo satırları şirket veri tabanına kopyalanır → yedeğin içinde
  olmalı. DENETİM ajanda (test: Sheets bağlı şirkette yedek → Sheets'e yazma isteği yok, yedek dosyasında tablo satırları var, Drive
  kapalıyken yalnız yerel, Drive klasörü açıkken kopya orada, iki şirket, geri yükleme sonrası Sheets bağı); sonuç kullanıcıya.
  ŞİKÂYET (kullanıcı, 10.10.2026: "yedek için Drive bağlanınca Drive'a otomatik yedek ya da Şimdi Yedek Al ile yedek almadığı
  kanaatindeyim") → İLK ÖNCELİK, aynı ajanda: klasör ve bağlantı kipi × Şimdi Yedek Al (Tüm/Yalnız), otomatik, güvenlik yedeği,
  bootstrap yedek, iki şirket; bağlantı kipinin lisans servisi ucu üretimde var mı; 2.0.20 şirket klasörü taşımasından sonra gerileme
  var mı. Hata çıkarsa önce kullanıcıya listelenir, kırmızı test → düzeltme (temel 2.1.0'a).
  İLK BULGU (ana oturum, 10.10.2026; GitHub'dan + koddan): Google Drive BAĞLANTISI kipi (https://drive.google.com/drive/folders/…) hiç
  çalışmıyor — program lisans servisinden `POST /v1/yedek/oturum` ister, ama site deposu ceougur/destekofis `web/api/lisans/v1/` altında
  yalnız activate/check/durum var, yedek/oturum YOK (docs/DRIVE-YEDEK.md'de tasarlanmış, hiç yapılmamış). 2.0.2'den (27.09.2026) beri bu
  kipte hiçbir yedek Drive'a gitmedi; yerel yedek alınıyor, hata yalnız Yönetim'deki durum satırında (lastError). KLASÖR kipi (Drive
  masaüstü uygulamasının senkron klasörü) ayrı; ölçümü ajanda. Kullanıcıya bildirildi.
  KARAR (kullanıcı, 10.10.2026: "programın Drive yedekleme bölümünü kaldıralım, kılavuzdan ve web sitesinden de kaldıralım; şimdilik gerek
  yok; müşterileri de yanlış yönlendirmiş olmayalım"): Drive yedeği (bağlantı ve klasör kipi) 2.1.0'da PROGRAMDAN KALKAR — Yönetim'deki
  bölüm, ayar ucu, yedek sonrası kopya (afterBackup/mirror), ilgili bildirim/yazılar; yerel yedek (backups\<kod> - <ad>\) aynen kalır.
  Eski kurulumda kayıtlı Drive ayarı yok sayılır (veri silinmez, kopya alınmaz). KILAVUZ'dan Drive anlatımı ve SİTE'den (ceougur/destekofis)
  Drive yedeği vaadi kalkar (site PR'ı yayın teslimiyle). Teslim notunda açıkça yazılır: "Drive'a yedek kaldırıldı; yedekler bilgisayardaki
  backups klasöründe". "Google Drive'a Bağlan" (OAuth) ileride, kullanıcı isterse.
  KALAN İŞ LİSTESİ (kullanıcı, 10.10.2026: "temel paket için kalan işleri kısa başlıklar olarak söyle" → "işlem yapılıp bittikçe maddenin
  üzerini çiz, bildir"): her madde bitince listenin tamamı ~~üzeri çizili~~ biçimde yeniden gönderilir. Liste: 1 kurumsal kart bağı ·
  2 Drive yedeğinin kaldırılması · 3 Windows ara sıra "yedek alınamadı" · 4 küçük düzeltmeler (Nakit Akış kaynak adı, başlık yazımı, sihirbaz
  sonrası eski liste) · 5 kılavuz (Banka bölümü + Drive'ı çıkar) · 6 kâhin güncellemesi (iade kuralı) · 7 yargıç + eleştirmen · 8 son
  doğrulama (Uzun Doğrulama, ölçek 10/20, bütün e2e, göç) · 9 paket (sürüm, CHANGELOG/KANIT, imzalı, kurulum, PDF, PR, elle kabul listesi) ·
  10 yayın (birleştir, 5 dosya, bağlantı, site kılavuz PR'ı).
  DURUM (10.10.2026 akşam): 1 BİTTİ (f30a75b, CI yeşil) · 2 BİTTİ (1e23940) · 3 gerçek Windows 1/2 yeşil (windows.yml #38, 740be05:
  hizmet çalışırken yedek bütünlük ok) — ikinci gerçek Windows koşusu bekleniyor · 5 BİTTİ (9201af0; 8. Banka bölümü, PDF 34 sayfa
  ee64ce5f…, ana oturum yeniden üretti: metin aynı, pdf-denetle 28/28). Kılavuz ajanının ekranda gördüğü 5 küçük bulgu (Eksi Bakiye
  Denetimi metni eskimiş, cari Ödeme formu yol ne olursa olsun "Kasa'dan çıkar", ANLIK DURUM ipucunda olmayan menü, Banka Bakiye Raporu
  "Bu Yıl"da ileri tarihli eski havaleyi Hesabı Atanmamış sayıyor ↔ Genel Bakış 0, Planlı İşlemler düğmesinde olası yarış) madde 4'e
  eklendi; "İleri tarihli hareket" tarama uyarısı hata değil (saat geri alınınca çıkar). CI 536 (098eb56) e2e kırmızısı = 534'le aynı
  test yarışı, düzeltmesi 15d5631'de.
  6 BİTTİ (a375e80; kâhin dili sürüm 2): iade artanı kuralı + cash-negative + kart 309 + yineleme; BAŞ MİMAR KARARI: D5 (KMH yalnız Vadesiz)
  ve D6 (Vadeli'de yalnız transfer ve faiz) plan §3.5 tablo satır 316/318 dayanaklı → ONAYLANDI; BELİRSİZ-23..26 kâhin dışı. Sonuç: kabul 1–16
  fark 0 (plan 28/28); tohum 1–5×500, 31×2000, yoğun 1–5 → açıklanamayan 0; kalan iki bilinen sınıf: KDV-DAHIL-ISKONTO (hakem: program doğru,
  kâhin kuralı 1 kuruş sapıyor; programdan türetilmiş kural temiz odaya konmaz) ve KASA-ACILIS-649 (K6, 2.1.1'e ertelendi — BİLİNEN SINIR).
  Ana oturum yeniden koşusu: tohum 3 + ajanın koşmadığı tohum 7 (nötrlü) + kabul + birim.
  Kâhin yeniden koşusu SONUÇ: birim 18/18, kabul fark 0, tohum 3 ajanınkiyle birebir (148, açıklanamayan 0), tohum 7 nötrlü 8.069 yaprak fark 0.
  4 BİRLEŞTİ (ede7049; ana oturum kırmızı c8ec274 5/6, f3edc16 6/11 → yeşil 25/25): Nakit Akış/Vade Takip ileri tarihli satır kaynağı,
  Toplamlar yazımı, Eski Hareketler önbelleği, A–D (Eksi Bakiye metni, cari Ödeme açıklaması yola göre, ANLIK DURUM ipucu, Banka Bakiye
  Raporu ileri tarihli eski havale); E (Planlı İşlemler yarışı) zorlamayla ÜRETİLEMEDİ. Aynı ajanın YENİ bulguları (kullanıcıya listelendi,
  ikinci küçük bulgular ajanında): kurumsal kart seçicisi önbelleği bayat (ikinci kart açılınca ödeme yanlış karta gidebilir — ÖNCELİKLİ;
  senaryo-banka-210b bir koşuda kırmızı), istemcide "invoice" kaynak adı ham, rapor başlıkları küçük harf (Cari ekstre/Vade takip/Nakit akış),
  fatura Tahsilat/Ödeme formu ve Bankadan Kasaya Aktar açıklaması eskimiş, Gerçek Banka toplamına tarih sınırı yok (üretilebilirliği
  denetlenecek), Nakit Akış PDF alt başlığı kesik, Vade Takip'te hesapsız eski banka satırları banka yetkisi olmayana görünüyor.
  KAPSAYICI YENİDEN BAŞLADI (10.10.2026 gece): otomatik güncelleme ajanı (worktree aeb30608…, 5 commit: b0bcc78 kapalıyken denetim,
  1f499e6 gerçek tarayıcı/Windows sınaması, f5039d3) ve küçük bulgular 2 ajanı (worktree a52cd8d5…, kırmızı test 7a6011c + işlenmemiş
  düzeltme) yarıda kaldı → ikisi de AYNI worktree'lerinde yeniden başlatıldı. ÖLÇÜM (f5039d3, gerçek Chromium + gerçek saat 20 dk): açık
  duran DestekOfis sayfası GİZLİ sekmede bile 5 dk'da bir istek atıyor (çalışma tablosu eşitleme zamanlayıcısı) → herhangi bir bilgisayarda
  sayfa açıksa sunucu 15 dk boşta sayılmaz, kendiliğinden kurulum MESAİ DIŞINA (hafta içi 20:00–07:00, hafta sonu) kalır. Ürün kodu
  değişmedi; önerim: BÖYLE KALSIN (form doldururken servis yeniden başlamasın; güvenli taraf) — kullanıcıya bildirildi, karar onda.
  OTOMATİK GÜNCELLEME (kullanıcı, 10.10.2026: "sunucu açıkken aralıklarla sorgulanıp alınıyor mu, açılışta sorguluyor mu, şüphelerim var" →
  koddan cevap verildi: açılışta + 6 saatte bir (+≤30 dk kayma); "kendiliğinden kur" açıkken boşta (15 dk) ya da mesai dışında kurulur,
  mesai içinde çalışılıyorsa "hazır" bekler, saatte bir yeniden bakar; güncelleme testleri 30/30. AÇIK: kendiliğinden kur KAPALIYKEN hiç
  sorulmuyor). KARAR (kullanıcı: "ekle, ayrıca kodda olan, teoride olan, güncelleme uyarısı ya da 15 dk boş kalınca program otomatik
  güncelleme alıyor mu doğrula"): (11) kapalıyken de açılışta + 6 saatte bir sorulur, kurulmaz, yöneticiye "hazır" bildirimi; (12) GERÇEK
  ÇALIŞTIRMAYLA doğrulama (sahte saat değil): gerçek servis + yerel sahte yayın kaynağı (imzalı bildirge + paket), kullanıcı etkinliği varken
  "hazır" uyarısı ekranda (zil/Yönetim, ekran görüntüsü), etkinlik kesilince gerçek 15 dk sonra kendiliğinden kurulum, açılışta sorgu ve
  kurulum, mesai dışı kuralı; Windows'ta CI kurulum testinde de. Eskimiş kod açıklaması ("gün içinde kendiliğinden güncelleme yapılmaz") düzelir.
- KREDİ KARTI ÖDEMESİ POS GİBİ GÖRÜNÜYOR (kullanıcı, 10.10.2026; ekran 2.0.26 ANLIK DURUM: "Banka / POS ₺1.343,90 · Banka ₺10.000 ·
  POS −₺8.656"; soru: "banka modülü ile bu sorunlar çözülecek mi?"). KÖK NEDEN (koddan, v2.0.26 `pay-method.mjs`): tek kayıt değeri
  `card` hem POS tahsilatı (para girişi, 108) hem kurumsal kartla ödeme (borç, 309) için; ANLIK DURUM "POS" = Σ kart giriş − Σ kart
  çıkış → kartla ödeme bankadan çıkmış gibi Banka/POS toplamını düşürüyor (yanlış: kartla ödeme kart BORCUDUR, para ekstre ödenince
  bankadan çıkar). 2.1.0 DALINDA ÖLÇÜLDÜ (`docs/kanit/2026-10-10/kart-pos-sonda.mjs`, aynı rakamlar): Gerçek Banka 10.000 (kart
  ödemesi düşmüyor), 8.656 "Hesabı Atanmamış Eski Hareketler" uyarısında (hiçbir toplamda değil); "Kart Borcuna Aktar" ile kurumsal
  kart hesabına → "Kart ve Kredi Borcu 8.656", mutabakat tamam. AÇIK (2.1.0'da plan gereği yapılacak, §4.6 / madde 27 / §3.5 tablo
  satır 3 ve 5): yeni kartla ödemede kurumsal kart hesabı SEÇİLEMİYOR — `pickRef` yalnız havaleyi bağlıyor, gönderilen
  bankAccountId sessizce yok sayılıyor (ölçüldü: 500 TL yine Hesabı Atanmamış'a düştü); düzeltme: ödeme formlarında (cari ödeme,
  alış faturası, stok, çek değil) "Kredi Kartı" seçilince kurumsal kart seçimi → 309; POS tahsilatı (108, komisyon, valör,
  blokeli) 2.2.0. Yanıt kullanıcıya verildi.
- 2.0.20 YAPILACAKLAR (kullanıcı "yapılacaklara not al" dedi, 03.10.2026; "yap" denince başlanır; ayrıntı ve
  kanıt hemen altındaki ADAYI maddesinde):
  [x] 1. Bütün raporların (43) tablosunun altında kalın TOPLAM satırı — ekran, PDF, Excel aynı; yalnız toplanabilir
         kolonlar (tutar, matrah, KDV, borç, alacak, miktar); birim fiyat, yürüyen bakiye, oran, tarih boş.
  [x] 2. Cari Listesi ve Bakiyeler özetine "Toplam Borç (Anlaşılan)", "Toplam Tahsilat (Ödenen)", "Kalan".
  [x] 3. Dönemli raporlar ilk açılışta "Bu Yıl"; sonra kullanıcının son seçtiği dönem hatırlanır.
  [x] 4. Dönemde kayıt yoksa ipucu: "Bu dönemde kayıt yok — Tüm Zamanlar'ı deneyin".
  [x] 5. Test: 43 raporda TOPLAM satırı = satırların toplamı (ekran/PDF/Excel); boş dönem; tek kayıt; 10 cari × 10.000,
         ilk taksitler ödenmiş → 100.000 / 10.000 / 90.000 (Taksit Kartları, Cari Mizanı, Cari Listesi); arayüzden senaryo.
  [x] 6. Kılavuza kısa hap bilgi: "Ciro ve toplam alacak hangi raporda".
  [x] 7. Sol üstteki ŞİRKET kutusunda şirket sayısını gösteren yeşil rozet ("001 · Şirket 1  (2)") KALKAR — kullanıcı
         (03.10.2026, ekran): "kafa karıştırıyor, o sayı yazmasın". Kod: `client/assets/hof-companies.js:132`
         (`hof-session-count`); açılır listede şirketler zaten görünür. Test: 1 ve 2 şirketle rozet yok.
  [x] 8. "CARİ BAZINDA TAHSİLAT RAPORU ÇALIŞMIYOR" (kullanıcı, 03.10.2026 — açık sorunun cevabı). Arayüzden yeniden
         üretildi: Taksit Excel'i "Ödenen" kolonuyla (10 kişi × 10.000, her biri 1.000 ödenmiş) yüklenince ödenen tutar
         AÇILIŞ (devir, `plan_entries.opening = 1`, Kasa dışı) yazılır; rapor (`report-center.mjs` cari-tahsilat)
         açılışı bilinçli SAYMIYOR → "Bu Ay" da "Tüm Zamanlar" da "Cari 0 · Toplam 0 · Bu süzgeçte kayıt yok" (Taksit
         Kartları aynı veride Ödenen 10.000 gösteriyor). Programa girilen tahsilatların hepsi doğru sayılıyor (API ile
         9 tür denendi: cari nakit/havale/POS, fatura peşin nakit/POS/havale, taksit, cariden çek, faturayla çek → 4.500).
         Öneri: rapora "Önceden Ödenen (Açılış)" kolonu + özet kutusu (dönem tahsilatı "Toplam"ından AYRI; açılış
         tarihi = yükleme günü); açılışı olan cari de listede görünür; rapor boşsa ve açılış varsa altta açıklama
         ("Excel'den yüklenen n TL ödenmiş tutar açılış olarak yazıldı; Taksit Kartları → Ödenen"). Test: bu senaryo
         arayüzden (Bu Ay / Tüm Zamanlar), açılış + gerçek tahsilat karışık, geçen ayın tahsilatı Bu Ay'da yok.
         KARAR (kullanıcı, 03.10.2026: "taksitleri Excel ile toplu yüklemiştik"; "tamam ama hepsini toplasın raporlar da"):
         tahsilat raporlarında TOPLAM açılış (Excel'de ödenmiş) DAHİL her şeyi toplar — Cari Bazında Tahsilat (Toplam =
         nakit/havale + taksit + çek/senet + Önceden Ödenen), Taksit Tahsilatları (bugün açılış ayrı satır, "Tahsilat"
         toplamı dışında → "Toplam Tahsil Edilen" açılış dahil), Taksit Tahsilat Performansı, Cari Listesi "Toplam Tahsilat
         (Ödenen)". Kırılım kolonları kalır (kaynağı görünsün). KASA raporları DEĞİŞMEZ (açılış Kasa'ya hiç girmedi; Kasa
         fiziki nakit, mutabakat bozulmasın) — kullanıcıya söylendi.
  [x] 9. YEDEK VE ÇOKLU ŞİRKET (kullanıcı, 03.10.2026: "001 dolu ama yedek klasöründe 002 dolu yedeklemiş"). Ölçüldü
         (API, 001'de 5 cari, 002'de 2 cari): veri KARIŞMIYOR — 002 seçiliyken Yedek Al → `backups/sirket-002/…-manuel.sqlite`
         (yalnız 002), 001 seçiliyken → `backups/…-manuel.sqlite` (yalnız 001). AÇIKLAR: (a) `/api/admin/backups` HUB_ONLY
         değil → Yedek Al ve Yedekler listesi yalnız SEÇİLİ şirket (`app.mjs` dispatch); (b) dosya adında şirket kodu yok
         (001 ve 002 aynı adla, ayrım yalnız klasörde; Drive'da ayırt edilemez); (c) otomatik zamanlayıcı 001'de hep,
         öbür şirketlerde yalnız o şirket bu açılışta açıldıysa (`appFor` tembel) → girilmeyen şirket yedeklenmez;
         (d) supervisor `restoreDatabase` yalnız kök `backupDir` + kök db — şirket yedeği geri yüklemesi denetlenecek.
         Öneri: Yedek Al → "Tüm Şirketler" (varsayılan) / "Yalnız <kod · ad>"; ad `destekofis-<kod>-<zaman>-<etiket>`;
         Yedekler listesi bütün şirketler + Şirket kolonu; otomatik yedek ve Drive kopyası bütün şirketler (açılmamış olsa
         da); yedeğin içine şirket kimliği yazılır, geri yüklemede yanlış şirkete yükleme reddedilir. Test: iki şirket
         farklı veri; tümü/tek; otomatik; geri yükleme; yanlış şirkete yükleme 409. Kullanıcıya soruldu: yedek alınırken
         002 mi seçiliydi / baktığı klasör sirket-002 mi (ekran bekleniyor).
         CEVAP (kullanıcı, aynı gün): "001'de çalışıyoruz; yedekte şirketler klasöründe 001 yok, 002 klasöründe şirket
         datası var; bu veriler aslında 001'in". ÖLÇÜLDÜ (arayüz + dosya içi sayım): 001 KÖK klasörde (`data/destekofis.sqlite`,
         yedekleri `backups/` kökünde, alt klasörsüz); 002 `data/sirketler/002/` ve `backups/sirket-002/`. Yeni şirket BOŞ
         açılıyor (001'in carisi/tablosu kopyalanmıyor: 002'de accounts=0, dataset_rows=0); boş şirket dosyası bile ~0,8 MB
         (şema + kullanıcı kopyası + WAL) → "dolu" görünür. Yani karışma yok ama düzen yanıltıcı. Ek öneri (madde 9'a):
         001'in YENİ yedekleri de `backups/sirket-001/` altına, ad `destekofis-<kod>-…` (001 veri dosyası yerinde kalır, göç
         riski yok); Yönetim → Şirketler'de her şirketin veri dosyası yolu, boyutu, cari/kayıt sayısı ve son yedeği; Yedekler
         ekranında "001 · Şirket 1 → …\backups\sirket-001" açıklaması. Kullanıcıdan teyit: 002'ye geçince Cari boş mu.
         KARAR (kullanıcı, 03.10.2026): "her şirketin yedeği kendi isminde klasör açılıp buna girmeli". Uygulama: her
         şirketin yedekleri `backups\<kod> - <ad>\` (ör. `backups\001 - Şirket 1\`, `backups\002 - Şirket 2\`); Windows'ta
         geçersiz karakterler (\ / : * ? " < > |) temizlenir; ad/kod değişince klasör yeniden adlandırılır (içindekiler
         korunur); göçte mevcut yedekler taşınır: `backups\` kökündeki 001 yedekleri → `001 - <ad>\`, `sirket-002\` →
         `002 - <ad>\` (silme yok, taşıma; taşınamayan yerinde kalır, listelenir). Dosya adı `destekofis-<kod>-<zaman>-<etiket>`.
         Geri yükleme ve Yedekler listesi yeni klasörlerden okur; eski yerdeki yedek de tanınır. Test: iki şirket, ad değişimi,
         göç (kökte ve sirket-002'de eski yedekler), Türkçe/özel karakterli ad.
  Açık soru CEVAPLANDI: "getirmiyor" = Cari Bazında Tahsilat (madde 8).
- 2.0.20 ADAYI — RAPORLARDA ALT TOPLAM (kullanıcı, 03.10.2026): "toplam cari alacağı yani ciroyu hangi rapordan
  görürüm?" → yanıt: ciro = Raporlar → Fatura → Satış Faturaları / Cari Bazında Satış ve Alış (Net Satış); toplam
  alacak = Raporlar → Cari → Cari Listesi ve Bakiyeler (Borçlular) / Cari Mizanı. Kullanıcı: "raporları getirmiyor ya da
  alt toplamları getirmiyor gibi, anlamadım". ARAYÜZDEN DENENDİ (3 cari, 3 satış faturası 12.000 + 6.000 (2.000 peşin)
  + 3.300): sayılar DOĞRU (Matrah 18.000, Ödenecek 21.300, Kalan/Borçlular 19.300). Açıklar: (a) toplam yalnız tablonun
  ÜSTÜNDE kart olarak; tablonun altında TOPLAM satırı YOK (ekran, PDF; Excel'de toplam yalnız ayrı "Özet" sayfasında) —
  yaygın programlarda kolon altında toplam satırı olur; (b) dönemli raporlar "Bu Ay" ile açılır — ayın başında (bugün
  3'ü) eski faturalar görünmez, "getirmiyor" sanılır. Öneri (kullanıcı "yap" derse): her rapor tablosunun altında
  kalın TOPLAM satırı (ekran + PDF + Excel aynı satır, Excel'de SUM formülü değil değer), yalnız toplanabilir kolonlarda
  (tutar, matrah, KDV, borç, alacak, miktar); yürüyen bakiye, birim fiyat, oran, tarih kolonları boş; rapor bazında
  kolon listesi tanımlanır; Ciro/fatura/cari raporlarında varsayılan dönem kullanıcının son seçtiği dönem (ilk açılışta
  "Bu Yıl"); boş sonuçta "Bu dönemde kayıt yok — Tüm Zamanlar'ı deneyin" ipucu. Test: 43 raporun her birinde TOPLAM satırı
  = satır toplamı (ekran/PDF/Excel), boş dönem, tek kayıt. Kullanıcıdan: hangi raporda "getirmiyor" gördüğü (ekran).
  EK İSTEK (kullanıcı, aynı gün): "10 müşteride toplam 100 bin alacak, ilk taksitler ödenmiş; raporda 100 bin toplam
  (ilk anlaşılan), ödenen 10 bin, kalan 90 bin görmek istiyorum." API ile kuruldu (10 cari × 10.000, 10 taksit, her
  birinden 1.000 tahsilat): Taksit Kartları raporu ZATEN Toplam 100.000 · Ödenen 10.000 · Kalan 90.000 (satırda da);
  Cari Mizanı (Tüm Zamanlar) Dönem Borç 100.000 · Dönem Alacak 10.000 · Borçlular 90.000. AÇIK: Cari Listesi ve
  Bakiyeler özetinde yalnız Borçlular/Alacaklılar var, toplam Borç (anlaşılan) ve toplam Alacak (ödenen) yok. Öneri:
  Cari Listesi özetine "Toplam Borç (Anlaşılan)", "Toplam Tahsilat (Ödenen)", "Kalan" eklenir + alt TOPLAM satırı.
- 2.0.17 HAZIR (02.10.2026; dal `claude/nice-euler-jvajxv`; 14 madde yapıldı, kanıt `docs/2.0.17-KANIT.md`): şema göçü 19
  (fatura bağı + mahsup); çoklu şirket hub/çocuk mimarisi (`docs/MIMARI.md` → 2.0.17); teslim `dist/teslim-2.0.17/`
  (3 zip + SHA256SUMS; imza anahtarı kullanıcının yüklediği .pem). Sırada: kullanıcı "birleştir" → CI → birleştir →
  yayın (tag v2.0.17, 5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" denetimi → site kılavuz PR'ı.
- 2.0.17 TESLİMLE BİRLİKTE İSTENEN 3 ŞEY (kullanıcı, 02.10.2026; "müşterilerimize mahçup etme"): (1) 14 maddenin başlık
  başlık alt alta kontrol listesi, karşısında yapıldı tiki; (2) uzman mali müşavir gözüyle GERÇEK şirket işlemleri —
  programın bütün özellikleriyle, gerçek ortamda, etkilediği her yere doğru mantık ve tutarla geçtiğinin testi;
  (3) uzman UI + UX gözüyle bütün kartlar/piller tasarım uygunluğu ve kodun uçtan uca doğru çalıştığı; baş mimar/baş
  mühendis şapkasıyla GERÇEK STRES TESTİ. EK (kullanıcı, aynı gün): mali müşavir FATURA modülünü de HER VARYASYONLA
  kullanır — 8 senaryo (stoktan satış, hizmet satışı, fiyat farkı, SMM, satıştan iade, stoğa mal alışı, hizmet/gider
  alışı, alıştan iade), KDV %1/%10/%20, KDV dahil/hariç, iskonto, tevkifat/stopaj, ödeme biçimleri (nakit, havale, POS,
  alınan/verilen çek-senet, ciro, taksit, açık, karma), taslak → kaydet, düzenle, iptal, sil, kopyala, toplu, Mahsup Et,
  Kapatılacak Fatura, PDF/Excel/UBL; (kullanıcı, 3. mesaj) çeşitli ödemelerle alım, satım, iade, iptal ve her birinin
  RAPORLARA etkisi (Kasa, banka/POS, cari ekstre/mizan, stok, taksit, çek/senet, KDV özeti, hesap mizanı, ANLIK DURUM,
  açık faturalar, birleşik şirket raporu) beklenen tutarla karşılaştırılır. Çıktılar: `docs/2.0.17-KONTROL-LISTESI.md`, `docs/2.0.17-MALI-MUSAVIR-TESTI.md`
  (senaryo + beklenen/gerçek sayılar), `docs/2.0.17-UI-UX-DENETIMI.md` (ekran görüntüleri + bulgular + düzeltmeler).
  DURUM (02.10.2026): üçü de yapıldı. Mali müşavir 160/160; UI/UX 316/316 (46 ekran). Denetimde bulunup düzeltilen gerçek
  hatalar: sayfa şeridi ↔ takvim şeridi sonsuz yer kavgası (`hof-sessions.js` place sırası), stres testinde iade iptalinde
  taksit kartı geri büyümüyor (`plans.mjs` growForInvoice satır yoksa açar), kontrast/tıklama hedefi/pasif düğme nedeni/yazım.
  Stres: `test:mutabakat --islem 5000 --tohum 3 --tohumlar 2 --her 1` (sonuç CHANGELOG "Doğrulama"). Kod değiştiği için
  güncelleme paketi ve kurulum .exe YENİDEN üretilir (release.mjs + build:windows), zipler yeniden kapatılır.
  TESLİM EDİLDİ (02.10.2026 18:13): PR ceougur/ofis---y-netimi#17 açık (birleştirme kullanıcı onayıyla); zipler + .exe
  kullanıcıya gönderildi (Kaynak-ve-Denetim 38 MB sınırı aştı → A-kaynak / B-denetim iki parça). Kurulum .exe sha256
  c406cf19…; güncelleme paketi sha256 4702dfee…. Sırada: "birleştir" → CI → birleştir → yayın → "yayımladım" → bayt bayt +
  güncelleyici denetimi → site kılavuz PR'ı.
  YAYIMLANDI (02.10.2026 18:5x; `v2.0.17` = 6b0a811): 5 dosya ve latest/ adresleri (Kurulum.exe, guncelleme.json) bayt
  bayt doğrulandı; gerçek güncelleyici 2.0.16/15/14/2.0.4/1.7.0 olarak (Node 24.21, bootstrap 2) canlı yayında 2.0.17'yi
  "available" gördü (anahtar destekofis-2026-1), indirilen paket sha256 teslimdekiyle eşleşti. Site kılavuz PR'ı
  ceougur/destekofis#5 BİRLEŞTİRİLDİ (main 00dff72; eskimiş #4 kapatıldı). Site metni: kullanıcı yalnız manşet alt cümlesi
  + SSS'ye 2 soru istedi (özellik kartları/yenilik şeridi İSTEMEDİ), PR #6 birleşti (main 4b611ed). "Farklı konular karışmaz"
  kartı hâlâ "oturum" anlatıyor (kullanıcıya söylendi, dokunulmadı). 2.0.17 KAPANDI.
- e-Belge kararı (kullanıcı, 01.10.2026): vergi dairesi/entegratör bağlantısı KAPALI — "sana entegre et diyene kadar".
  Fatura modülü tam çalışır; belge "Müşteri Fişi" (resmî hükmü yok) basılır; e-Fatura/e-Arşiv/XML ekranda görünmez.
  Entegratör altyapısı (müşteri kendi API bilgisini girer, kontörü kendisi alır) hazır tutulur ama `config.edocEnabled`
  false; yalnız testler açar. Açma: kullanıcı açıkça "entegre et" derse.
- Gönderim kararı (kullanıcı, 02.10.2026): kesimde "Kes ve Gönder" ya da "Kes, Sonra Gönder". Sonra gönderde bütün
  etkiler hemen işlenir; belge "Gönderilecekler" sekmesinde bekler, e-Belge numarası gönderim anında verilir. Oradan
  "Listeden Sil" etkileri GERİ ALMAZ (kullanıcı: "tüm etkilerle birlikte geri alınmaz!"); belge Müşteri Fişi olarak kalır.
- Entegratör kararı (kullanıcı, 01.10.2026): şimdilik YALNIZ EDM Bilişim (`server/lib/einvoice/edm.mjs`; WSDL'i
  sunucudan okur, Logout çağırmaz). Firmayla anlaşılamazsa anlaşılan entegratöre göre yapılır (İzibiz istemcisi git
  geçmişinde: 167eefa). Fatura modülü bitince: (1) yalnız proje sahibine özel, deneyimsiz birinin anlayacağı ayrıntılı
  kılavuz (entegrasyona kadar); (2) ana testten ÖNCE güncel resmî/resmî olmayan kaynak araştırması → karşılaştırma →
  düzeltme (`docs/FATURA-KARSILASTIRMA.md`), sonra testler.
- Pro — uzaktan görüntüleme: `docs/PRO-UZAKTAN-GORUNTULEME.md` (önce en alttaki "Oturum devri"); genel durum
  `docs/DURUM-VE-DEVAM.md`.
