# Geçmiş Kararlar ve Sürüm Günlüğü (CLAUDE.md'nin 12.10.2026 tam hâli, aynen)

Kullanıcı kararı (12.10.2026: "harika bir yaklaşım, önerini yap"): CLAUDE.md her oturumda ve her ajanda yüklendiği için 201 KB'tan
kısaltıldı; kapanmış sürümlerin ayrıntısı ve eski kararlar burada AYNEN durur, hiçbir satır silinmedi. Bir karar/ayrıntı gerekirse burada
aranır (`grep -n`). Güncel kurallar ve açık işler CLAUDE.md'de.

---

# DestekOfis — çalışma kuralları (proje sahibinin talimatları)

Bu dosya oturumlar arasında taşınan hafızadır. Her oturumun başında okunur; kurallar pazarlıksızdır.

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
  KULLANICI SORUSU (10.10.2026): "5 dk'da bir istek varsa mesai dışında da sürmüyor mu, güncelleme nasıl alınacak?" → koddan cevap
  (update-orchestrator.mjs:103/120): kural "mesai dışıysa YA DA 15 dk boştaysa kur" — mesai dışında boşta sorusu SORULMAZ, açık sekme
  engellemez. KULLANICI: "genelde kullanıcılar mesai bitince ve hafta sonu sunucu bilgisayarı kapatır" → pratikte tek yol AÇILIŞ
  (startup → runCheck → install; açılışta etkinlik 0). Zayıflıklar: (a) açılışta ağ hazır değilse yeniden denemeler (1/3/10/20 dk)
  personel çalışmaya başlayınca "hazır" bekler, akşam kapanınca hiç kurulmaz; (b) indirme sabah iş başında; (c) gün içinde bulunan
  sürüm indirilmez. ÖNERİM (kullanıcının onayı bekleniyor): "arka planda indir, sonraki açılışta kur" — gün içinde indir + imza/sha256
  doğrula + hazırla (servis durmaz), zilde "2.x hazır, sonraki açılışta kurulacak / Şimdi Güncelle"; açılışta hazır paket uygulama
  kullanıcılara açılmadan ÖNCE kurulur (ağ gerekmez), deneme açılışı + geri dönüş aynen; mesai dışı kuralı açık kalan sunucularda sürer.
  KARAR (kullanıcı, 10.10.2026: "önerini yap") + SORU ("bir günde 2 ya da daha fazla güncelleme olursa nasıl davranacak?") → koddan:
  updater son 10 yayını sürüme göre sıralar, kurulabilen EN YENİSİNİ seçer, başarısız işaretlileri atlar; paket TAM program → ara
  sürüm atlanabilir, göçler açılışta sırayla. UYGULANACAK (otomatik güncelleme ajanına eklendi): (1) hazırda yalnız EN YENİ paket
  tutulur, daha yenisi inince eskisi silinir; (2) açılışta hazır paketi kurmadan önce ≤60 sn son denetim — daha yeni sürüm varsa o
  indirilip kurulur, ağ yoksa hazırdaki kurulur → tek yeniden başlatma, ara sürüm kurulmaz; (3) periyodik denetim 6 sa → 1 sa (gün
  içi yayın akşamdan önce iner); (4) deneme açılışı/geri dönüş/başarısız sürüm işareti aynen. Yayın kuralı: her yayın tam paket,
  sürüm numarası öncekinden büyük (release.mjs zaten öyle).
  YARGIÇ (11.10.2026, HEAD 3d0a2c8; betikler docs/kanit/2026-10-11/yargic/p1..p12; ana oturum B1/B2/B5'i yeniden üretti, sayılar aynı;
  kullanıcıya listelendi): B1 ORTA ENGEL — banka hesabı açılınca açılıştan önceki hesapsız havale/kart satırının tutarı/tarihi düzeltilemiyor,
  eski tarihli havale girilemiyor (409 bank-before-opening; v2.0.26'da yok = gerileme; gerçek 2.0.26 verisi göçünde de; module-ref.mjs 72-74,
  101-112); B2 ORTA/DÜŞÜK — Kurulum Sihirbazı Geri Al K7 Engelle'yi (−1.000) ve pasif hesabı deliyor; B3 DÜŞÜK — banka fişi Ters Kaydet /
  Açılışı Düzelt pasif hesabı değiştiriyor; B4 DÜŞÜK — Kart Borcuna Aktar / Devir Kapanışı yapılmış eski satır silinince karşı kayıt takılı
  kalıyor; B5 DÜŞÜK/ORTA — gün içinde hazırlanan güncelleme yayından geri çekilse de açılışta kuruluyor. Temiz: K7 15 yol, rapor 101/101,
  kurumsal kart, Drive. Sırada: eleştirmen (yargıç kararını denetler), sonra plana göre düzeltme (kırmızı test → düzeltme).
  ELEŞTİRMEN (11.10.2026; betikler docs/kanit/2026-10-11/elestirmen/e1..e4): B1 KATILIYOR (bütün modüllerde; silme/nakde çevir 200 ↔ düzelt 409
  tutarsız = Y2; çok hesapta açık "hesapsız" seçeneği gerekli); B2 KATILMIYOR → ORTA, bu turda (K1 emsali; Bu Hesaba Ata/sihirbaz eski ödemeyi
  Engelle'deki hesaba bağlayıp −1.500); B3 katılıyor; B4 KATILMIYOR → kök Y1; B5 KATILMIYOR → ORTA ENGEL (yayını silmek tek acil fren; hazırdan
  daha eski en yeni sürümde de kuruluyor). YENİ Y1 ORTA–YÜKSEK ENGEL (ana oturum yeniden üretti): Kart Borcuna Aktar yapılmış eski kartla ödeme
  500→450 düzeltilince kart borcu 950 (gerçek 450), 108.00 +500, yeni 520 kart ödemesi yanlış 409 cash-blocked; Bankaya Geçmiş Say komşusu
  108.00 −50; Mutabakat Testi "tamam". Dönem kilidi × banka, Şirket Verisini Sıfırla, yetki matrisi 22/22 temiz. KARAR (plana uy): B1+Y1+B4+Y2+
  B2+B3 tek düzeltme işi (banka), B5 ayrı iş (güncelleme); ikisi ajanlarda, önce kırmızı test.
  DÜZELDİ (11.10.2026): B5 67f00da (geri çekilen hazır sürüm kurulmaz, hazır silinir, Yönetim'de "yayından kaldırıldı"; hazırdan eski ama
  çalışandan yeni sürüm varsa o kurulur — kullanıcıya söylendi) — ana oturum eski kodda 1/4 → 4/4, CI 573 yeşil. B1+Y1+B4+Y2+B2+B3 a735a31
  (birleşme 699266f): pickRef satır tarihinde uygunluk, "Hesapsız (Açılıştan Önce)" seçeneği, havuz satırına para değiştiren işlem 409
  bank-reclass-active (Kurulum Geçmişi'nden Geri Al), Mutabakat Testi'ne bank:pool denetimi, Ata/sihirbaz/Geri Al K7 + pasif, fiş Ters Kaydet/
  Düzelt/Açılış pasifte 400. Ana oturum: gg3 eski sunucuda 0/12 → 39/39, npm test 2065/2065, senaryo-banka-210 407, 210b 89, 210-temel 79,
  210-eski-satir 12, mutabakat 2×1.000 tutarlı. Açık: "Hesapsız" seçilince cari formun yardım metni eski; kılavuzda Hesapsız/Geri Al yolu yok.
  UYARI BULGULARI (10.10.2026 gece; senaryo-225 incelemesinde, kullanıcıya listelendi; karar bekleyenler): (1) sağ alt bildirimde ilk 5'ten
  sonrası, özet bildirimi ekrana çıkmadan "görüldü" yazılıyor (hof-alerts.js enqueue) → sayfa erken değişirse bunlar 3 sa sağ altta görünmez,
  yalnız zilde (görmeden görüldü — düzeltilecek: özet gösterilince işaretle); (2) uyarı ufku sayfaya göre tutarsız: açık sayfanın son tarihleri
  7 gün ufukla, ÖBÜR sayfanınkiler ufuksuz (dues.mjs) → 1. sayfadayken 2. sayfanın 200+ gün sonraki kayıtları "SON GÜNE 2xx GÜN" uyarısı verir
  (müşterinin "42 gün" ekranı bu yoldan); hangisi doğru kullanıcıya soruldu; (3) iki pencerede sayfa seçimi kullanıcı başına (düşük); (4) yeni
  sayfa açılınca açık pencerenin takvimi yenilenmiyor (düşük). senaryo-225 C kırmızısı = testin kendi yarışı (216f76e, yalnız test; zorla 6/6).
  e2e NOT ADIMI (11.10, son aday yerel koşusu): ÜRÜN — analiz yanıtının "profil" olayı işlem geçmişini yeniden yüklerken listeyi
  "Yükleniyor…" ile siliyordu (başka bilgisayardaki tablo değişikliğinde açık geçmiş titriyordu); 4af88bd aynı kayıtta eski liste kalır.
  Zorla betik test/e2e/e2e-not-yaris.mjs (ajan: eski 0/6, yeni 6/6; doğal 10/10 iki kodda).
  MUTABAKAT TOHUM 4 (Uzun Doğrulama, 582409c; 22/23 yeşil, tek kırmızı): ÜRÜN HATASI, v2.0.26'da da VAR (2.0.15'ten beri) — faturada
  1.048.576 TL üstü ondalıklı birim fiyatların ~%10'u ve 16.777.216 üstü ondalıklı miktarlar "en çok dört/üç ondalık" diye REDDEDİLİYORDU
  (invoice-math.mjs computeLine: x × 10.000 − yuvarlanmış > 1e-6 mutlak tolerans; 1.234.567,89 × 10.000 = 12345678900,000002). Ekrandan da
  olur. Düzeltme 3069b26 (basamak 15 anlamlı basamakta artığı silinmiş en kısa gösterimden). Ana oturum: eski kopya 779c6a9'da 3/4 kırmızı,
  0a733dd'de 4/4 + komşu fatura testleri 68/68. Kullanıcıya listelendi. TOHUM 4 YENİDEN (ana oturum, 52ea195): 5.000 işlem, 5.002
  doğrulama, her işlemden sonra tutarlı, GEÇTİ çıkış 0 (yerelde 61,7 dk; GitHub'da ~43 dk); CI 592 (52ea195) ve 2824f22 dört platform + e2e YEŞİL.
  ÖLÇEK (11.10.2026; tools/olcek-210.mjs, 001'de 100.000 + 002'de 12.000 para satırı, gerçek API'den; kanıt docs/kanit/2026-10-11/olcek):
  DOĞRULUK tamam (10/20 kullanıcı: mutabakat TAMAM, bağımsız Kasa/banka farkı 0,00, yedekler bütün). HIZ plan bütçesini AŞIYOR (§3.11 madde 5:
  "Hareketler sayfası ve arama 1.000.000 satırda < 1 sn"): 100.000'de tek kullanıcıda bile Banka Hareketleri p50 2,7 sn, Cari arama 1,9 sn;
  10 kişide p95 9,8–12,1 sn, 20 kişide en çok 87 sn; olay döngüsü 6 sn'ye kadar tıkanıyor. KÖK NEDEN (CPU profili 1/3/5 kullanıcı, ana
  oturum çözümledi): meşgul sürenin %45–55'i banka raporlarında (report-center banka-bakiye/banka-hareket → money-lines classified: bütün
  para satırları her açılışta sıralanıp JS nesnesine çevriliyor, ilişkili alt sorgu; SQLite eşzamanlı → herkes bekliyor), %12–14 cari
  listesi (her aramada bütün cariler + toplamlar). 2.1.0'ın yeni banka raporları getirdi. KARAR (plana uy: bütçe kabul ölçütü): teslimden
  ÖNCE düzeltilir (ajan, worktree): rapor toplamları SQL'de, dönem öncesi devir toplamla, yalnız dönem satırları; eşdeğerlik testi (eski ↔
  yeni çıktı birebir) + aynı veriyle önce/sonra ölçüm. Kullanıcıya listelendi.
  KARAR (kullanıcı, 11.10.2026: "benim müşteri portföyüme göre sonraki ölçümler yeterli"): ajanın SONRA ölçümü (1 kişi tüm istekler p50 0,09
  sn; 10 kişi Cari arama p95 1,1 sn, Banka Hareketleri p95 0,95 sn, olay döngüsü en çok 1,3 sn; 20 kişi en uzun istek 15,7 sn, rapor açan p50
  7,5 sn; doğruluk her düzeyde tamam) YETERLİ → ek hız işi YOK. Bütçeyi az aşan kalanlar (10 kişide arama p95 1,1 sn / döngü 1,3 sn, 20 kişide
  rapor bekleyişi, kart/masraf raporunun iş parçacığı payı) teslimde BİLİNEN SINIRLAR'a yazılır. Doğrulama (eşdeğerlik, mutasyon, ana oturum
  ölçümü, ekran hataları, CI, e2e) aynen yapılır — karar yalnız hız yeterliliği içindir.
  SÜRÜM NOTU (kullanıcı, 11.10.2026: "sürüm notunda sadece; iyileştirmeler ve banka temel modülü eklendi gibi kısa yapalım"): CHANGELOG
  2.1.0 = iki satır (Banka modülü eklendi + iyileştirmeler ve hata düzeltmeleri); GitHub yayın metni de aynı kısalıkta. Ayrıntılı liste
  `docs/2.1.0-DEGISIKLIKLER.md` (müşteriye gösterilmez). Bu karar 10.10'daki "teslim notunda Drive kaldırıldı yazılır" satırını sürüm notu için
  DEĞİŞTİRDİ (Drive kaldırıldığı ayrıntılı listede ve kılavuzda yok/yazılı; kullanıcıya söylendi).
  ELLE KABUL LİSTESİ (kullanıcı, 11.10.2026: "bana vereceğin elle kabul listesini istemiyorum; ben kendi testimi yapabilirim canlıya alınca"):
  2.1.0 teslimde elle kabul listesi VERİLMEZ (kanıt kuralı madde 5'ten kullanıcı kararıyla sapma; kullanıcı canlıda kendisi dener). Listeyi
  ekrandan doğrulayan ajan durduruldu (worktree agent-a4337a23…, birleştirilmedi). `docs/2.1.0-ELLE-KABUL.md` depoda yalnız arşiv. Ajanın
  bulduğu tek şüphe kullanıcıya listelendi: Rapor Merkezi Excel çıktısında şirket adı/kodu yok (PDF'te var; v2.0.26'da da aynı; 2.0.17 m2).
  KARAR (kullanıcı, aynı gün): 2.1.1'e bırakıldı → 2.1.0 teslimde BİLİNEN SINIRLAR'a yazılır (report-center.mjs xlsx ucu; PDF office.name kullanıyor).
  KAPSAM SORUSU (kullanıcı, 11.10.2026: "neredeyse bütün program elden geçti diyebilir miyiz?") → HAYIR: para çekirdeği + banka derin;
  geri kalanı sürüm sürüm değişen yer kadar; satır kapsamı en son 2.0.21'de (%95,2 / dal %79,9 / arayüz %79,8; 52 yüksek riskli testsiz yer).
  KARAR (kullanıcı, aynı gün): kapsam ölçümü 2.1.0 temel banka sürümü CANLIYA ALINDIKTAN SONRA yapılır; kullanıcı yeni sürümü kendisi ve
  müşterilerde kullanarak dener. Teslimde DENENMEYEN'e yazılır: 2.1.0 kapsam ölçümü yok (yayın sonrası iş).
  HIZ DÜZELTMESİ BİRLEŞTİ (b3079e3; ana oturum eşdeğerlik+iş parçacığı+İ10 43/43; CI d4fa0ed ve c37fe13 dört platform + e2e YEŞİL). NOT:
  e2e senaryoları createApp'i doğrudan çağırır → iş parçacığı (üretim yolu) e2e'de AÇIK (yalnız startTestServer kapatır); senaryo-banka-210'da
  13 iş parçacığı sayıldı. BAĞIMSIZ İNCELEME (wf_e324b8a2-ee9; 5 bakış + 4 doğrulayıcı; teslime ENGEL YOK; kullanıcıya listelendi):
  H1 ORTA (hızdan): rapor sürerken şirket geri yükleme/silme → rapor 500 "Sunucu işlemi tamamlayamadı" + günlükte ERROR (report-runner exit düz
  Error); kuyruktaki 503 "Sunucu kapanıyor" yanlış metin. H2 düşük (hızdan): zaman aşımında close() iş parçacığı bitmeden çözülüyor, max 2 aşılıyor
  (Windows'ta ardından geri yükleme EBUSY riski, koddan). H3 düşük (hızdan): iş parçacığı hatası günlüğe yazılmıyor, kullanıcıya ham İngilizce
  metin. H4 ORTA (banka istemcisi, hızdan DEĞİL; 07b8f60'ta da): Banka → Hareketler "Daha Fazla Göster" sürerken arka plan yenilemesi gelirse sayfa
  sınırındaki hareket ekranda görünmüyor (hof-core.js:328/332, hof-bank.js:1266/1271). H5 düşük: + Masraf kaydı sonrası reload Daha Fazla'yı 50'ye
  geri alıyor = ölçek aracının "banka süzgeç" 30 sn hatasının kaynağı (araç Daha Fazla zaman aşımını süzgeç diye etiketliyordu). H6 düşük:
  hesap başı kuruş toplamı 2^53 (~90 trilyon TL) aşınca banka raporları 500 — eski kodun summary yolu da aynı ölçekte kırık → BİLİNEN SINIR.
  H7 test: eşdeğerlik testinin eski yolu Alt Hesap Mizanı'nda yeni moneyLines'ı kullanıyor (ayrı kopya HTTP karşılaştırmasında fark 0). Temiz:
  şirket ayrımı/yetki/denetim kaydı (26 sorgu × 2 yol fark 0), SQL eşdeğerliği (2 tohum × 1.443 + uç durumlar + 3 eski sürüm fikstürü fark 0),
  cari arama ve eksi bakiye kararları eski kodla aynı. KARAR (plan: engel değil ama yeni kod + ucuz): H1–H5 + H7 + araç etiketi düzeltilir
  (ajan, kırmızı test → düzeltme); H6 bilinen sınır.
  SÜRE (kullanıcı, 11.10.2026: "tüm işlemler 5 saat sürer mi?") → sıralı 7–8 sa; KARAR (baş mimar, kullanıcıya söylendi): Uzun Doğrulama
  ŞİMDİ 3c9f8d3'te başlatıldı (koşu 38149023983, #82; "yalnız son adayda" kuralından BİLİNÇLİ sapma: kalan düzeltmeler rapor iş parçacığı + banka istemcisi; mutabakat/
  güvenilirlik koşuları ikisini de kullanmıyor). Birleşmeden sonra diff para/şirket yoluna (server/ altında report-runner/worker dışı) dokunursa
  ilgili Uzun Doğrulama işleri son adayda YENİDEN koşulur. Hedef toplam ~4,5–5 sa.
  H1–H5 + H7 DÜZELDİ (ajan 16ec9cf, 9cb72bc, 7ee39f4; birleşme 39698bd). Ana oturum kendi ayrı kopyasında (git archive 3c9f8d3 + yalnız sınama
  girişi yaması, diff ile denetlendi): kapanış 0/5, liste kapısı 1/4, kâhin 0/1, e2e Daha Fazla yarışı 16/31 (15 değişkenin 15'i) KIRMIZI →
  39698bd'de 26/26 ve 31/31 YEŞİL. Ajan: npm test 2099/2099, senaryo-banka-210 407, 210b 89, 210-temel 79, ekran-aciklama 11, 222 56, 216 53.
  H4 komşuları da kapandı (Cari, Fatura, Stok, Çek/Senet listeleri aynı liste kapısında; Fatura/Stok/Çek arka plan yenilemesi Daha Fazla
  satırlarını korur). server/app.mjs değişikliği yalnız kapanış nedeni (reportWorker kapalı test sunucularında etkisiz) → Uzun Doğrulama
  (3c9f8d3) para/şirket yolu için geçerli, yeniden koşu GEREKMEZ. İstemci değiştiği için CI dışı e2e (210–218, rapor, taslak, whatsapp,
  ui-ux-217, senaryo) son adayda yeniden koşulur. Denenmeyen: Fatura/Stok/Çek pencerelerinde e2e yarış testi yok (kapı birim testi + 216/222).
  (1) ve (4) DÜZELDİ (609f459, birleşme 6d6375f): özet taşıdığı bildirimleri ekrana çıkınca "görüldü" yazar; başka sayfanın değişikliği
  `live:page.changed` ile takvim + şerit sayısını yeniler (kök neden hof-live.js v2.0.1 kuralı; yeni sayfa açma zaten çalışıyordu). Ana oturum:
  eski istemcide senaryo-225-uyari 14/23 kırmızı → 23/23, senaryo-225 46/46. (2) kullanıcı kararı bekliyor; (3) aynı kullanıcının öbür
  penceresi yeni sayfa açılınca "sayfa silindi" diyor — ek bulgu, kullanıcıya listelendi.
  KARAR (kullanıcı, 11.10.2026: "A"): uyarı ufku BÜTÜN sayfalarda aynı — her kayıt yalnız son 7 gün kala uyarır (öbür sayfaların ufuksuz
  uyarısı kalkar; müşterinin "SON GÜNE 42 GÜN" ekranı bu yoldandı). Uygulama: önce kırmızı test → düzeltme (2.1.0'a).
  DÜZELDİ (11.10.2026): kök neden routes/dues.mjs — öbür sayfaların son tarihleri raporların bir yıllık takviminden (reports.mjs AHEAD
  366 gün) süzülmeden geliyordu; açık sayfanınki computeDeadlines 7 gün (sabit DUE_WINDOW.aheadDays, ayar YOK). Öbür sayfa son tarihi de
  days ≤ 7 süzülür; geçmiş taraf (30 gün) aynı; Tahsilat Takvimi kalemleri ve Vade Takip değişmedi. Kırmızı: uyari-ufku-225 eski kodda
  2/4, senaryo-225-uyari eski sunucuda 33/36 ("SON GÜNE 42 GÜN · Öbür 42 Gün Firması" sağ altta ve zilde) → 4/4, 36/36; senaryo-225
  hedefi 10 → 5 gün (46/46), npm test 2069/2069. Kanıt docs/kanit/2026-10-11/uyari-ufku.
  HESAPSIZ METNİ + KILAVUZ (9f82aec, b08a17a; birleşme): "Hesapsız (Açılıştan Önce)" seçilince cari/fatura/Kasa↔Banka açıklaması ve seçici notu
  doğru; kılavuz 8. Banka'ya iki kısa bilgi, PDF b326df68… (34 sayfa). Ana oturum: eski istemcide senaryo-banka-210-eski-satir 20/25 → 25/25,
  senaryo-banka-210 407/407, yazım 2/2.
  OTOMATİK GÜNCELLEME (kullanıcı, 10.10.2026: "sunucu açıkken aralıklarla sorgulanıp alınıyor mu, açılışta sorguluyor mu, şüphelerim var" →
  koddan cevap verildi: açılışta + 6 saatte bir (+≤30 dk kayma); "kendiliğinden kur" açıkken boşta (15 dk) ya da mesai dışında kurulur,
  mesai içinde çalışılıyorsa "hazır" bekler, saatte bir yeniden bakar; güncelleme testleri 30/30. AÇIK: kendiliğinden kur KAPALIYKEN hiç
  sorulmuyor). KARAR (kullanıcı: "ekle, ayrıca kodda olan, teoride olan, güncelleme uyarısı ya da 15 dk boş kalınca program otomatik
  güncelleme alıyor mu doğrula"): (11) kapalıyken de açılışta + 6 saatte bir sorulur, kurulmaz, yöneticiye "hazır" bildirimi; (12) GERÇEK
  ÇALIŞTIRMAYLA doğrulama (sahte saat değil): gerçek servis + yerel sahte yayın kaynağı (imzalı bildirge + paket), kullanıcı etkinliği varken
  "hazır" uyarısı ekranda (zil/Yönetim, ekran görüntüsü), etkinlik kesilince gerçek 15 dk sonra kendiliğinden kurulum, açılışta sorgu ve
  kurulum, mesai dışı kuralı; Windows'ta CI kurulum testinde de. Eskimiş kod açıklaması ("gün içinde kendiliğinden güncelleme yapılmaz") düzelir.
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

---

## Arşiv 17.10.2026 (CLAUDE.md "Açık iş"ten AYNEN taşındı; kapanan 2.1.0–2.4.2 maddeleri ve uygulanmış kararlar)

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
- FATURA / e-BELGE (EDM) (kullanıcı, 13.10.2026): EDM'den API belgeleri + test/canlı adresleri geldi → BÜTÜN BİLGİ `docs/fatura/E-BELGE-EDM.md`
  ("fatura modülünü yap" denince oradan başlanır). Plan: XML uygunluğu (şema/şematron, ağsız) → EDM test ortamı → kullanıcı "entegre et" → açma.
  Test kimlik bilgisi depoya YAZILMAZ. Bu ortam test.edmbilisim.com.tr'ye bağlanamıyor (ağ politikası) → izin ya da GitHub Actions; karar kullanıcıda.
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
- 2.3.0 TESLİM (15.10.2026 ~21:20 UTC): paketlenen commit d7e66bd (ürün kodu 91e6dea); imzalı zip 2de92b82…, bildirge cd356847…, kılavuz PDF 879d1df4…, kurulum exe 6f0c61a6… (37,2 MB → iki parça + BIRLESTIR.md); arşiv 4 zip (1 belge+kanıt, 2–4 bundle parçaları; birleştirilip klonlandı). Dosyalar kullanıcıya gönderildi; PR açıldı (ceougur/ofis---y-netimi, master). SIRADA: PR CI + kapı yeşil → squash birleştirme (kullanıcı izni: "sen birleştirmeleri yapınca ben yüklerim") → kullanıcı yayın açar (v2.3.0, 5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" → site kılavuz PR'ı (ceougur/destekofis web/indir/). Sonra: İz 4.3? (yok — bitti), ölçek-30/1M planlı test Cuma 16.10, güncelleyici (b) saveState yarışı, kapsam ölçümü.
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
  İSTEK (kullanıcı, aynı gün, EDM görünümü ekran görüntüsü: "alttaki kesilen kişiyi buraya alsak… senin kararın nedir"; "bunu da taşıyalım" e-Arşiv) →
  YAPILDI: SAYIN bloğu üst bölümün sol sütununda satıcının altında (GİB örnek düzeni); e-Fatura + e-Arşiv tek şablon; kanıt docs/kanit/2026-10-16/gorunum-alici.
  SORU (kullanıcı, aynı gün): "canlı kesilince kırmızı test ortamı yazısı olmayacak doğru mu" → EVET (şerit yalnız TEF/TEA/TES serisinde; canlı seri bunlar olamaz);
  test eklendi (edoc-uretim: canlı görünüm + PDF'te TEST yok; mutasyon 0/1 kırmızı, b02a171).
  ELEŞTİRİ (kullanıcı, aynı gün: "anayasamızdaki kör noktamı bulma ilkeni sorguluyorum") → baş mimar kör noktaları bildirdi: (1) GitHub'a yayın = OTOMATİK
  GÜNCELLEMEYLE BÜTÜN müşterilere gider; canlı hafta sonu denenmeden yayımlanırsa deneme müşteride olur → öneri: hafta sonu kurulum .exe ile kendi makinede dene,
  yayın sonra; (2) canlı adres https://portal2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc (EDM belgesinden) test adresinden farklı sürüm yolu ("EFaturaEDM21ea"
  ↔ "EFaturaEDM"); bu ortamdan erişilemiyor (ağ izni yok), WSDL/sözleşme aynılığı doğrulanmadı → EDM'ye sorulmalı ya da ilk canlı Bağlantıyı Test Et ile görülür;
  (3) birim kodu kabulü yalnız test ortamında ölçüldü. Karar kullanıcıda.
  KARAR (kullanıcı, aynı gün: "canlıda da müşterilere ben EDM üyeliği alıp kuracağım için henüz müşteri keser riski yok") → (1) kapandı: canlı EDM
  kimliği olmadan canlıya belge gidemez; yayın normal akışla (teslim → PR → yayın). (2)–(3) kullanıcının ilk canlı kurulumunda Bağlantıyı Test Et + ilk belgeyle görülür.
  (2) KAPANDI (kullanıcı ağ iznini açtı, "yaptım, dene"): canlı adres erişilebilir, SSL geçerli; WSDL + 7 şema test 21ea ile adres dışında AYNI; programın
  istemcisiyle bilerek yanlış giriş → canlı ve test aynı "Kullanıcı Bulunamadı!" (EDM 11010). Gerçek giriş canlı üyelikle. Kanıt docs/kanit/2026-10-16/canli-erisim.
  İSTEK (kullanıcı, aynı gün: "kartı kullandın mı… onu da dene, test portalına karekodlu son halini dener misin") → YAPILDI: (a) kartla EKRANDAN Canlı Ortam +
  bilerek yanlış kullanıcı → Durum "Bağlantı kurulamadı… Kullanıcı Bulunamadı! (EDM 11010)", adres boşken canlı adres (canli-kart); (b) canlı AÇIK üretim
  ayarıyla (edocLive) test ortamına 4 belge TEF2026250609970–72 + TEA2026250609970: GİB'den geçti, TEF/TEA + TEST şeridi, yeni SAYIN düzeni EDM resmî PDF'inde,
  karekod jsQR ile çözüldü, ödenecek 470/1200/900/740 (edm-son-hal-2).
  KARAR (kullanıcı, aynı gün: "bilgi eklentisini 2.4.1'e bırakalım") → 2.4.1 ADAYI: canlıda "Kullanıcı Bulunamadı!" (EDM 11010) iletisine yönlendirme
  ("Canlı Ortam için EDM'nin canlı kullanıcı adı ve parolasını girin"; testte test hesabı). 2.4.0'a girmez.
- 2.4.0 UZUN DOĞRULAMA run 38933795436 23/23 + kapı YEŞİL (16.10.2026 ~19:40 UTC); 6 CI yeşil. İmzalı paket 652bdc7: zip c226ed33…, kurulum exe 8aefa8fb… (35,5 MB,
  simgeli); paket denetimi 4/4 (imza, sha/boyut, kurcalanmış ret, zip = HEAD 251/251). SIRADA: teslim (5 dosya + arşiv) → PR → kullanıcı "birleştir" → yayın.
  TESLİM EDİLDİ (16.10.2026 ~19:45 UTC): 5 dosya (exe iki parça + BIRLESTIR.bat/.md; bildirge json 60b6bd7b…, kılavuz PDF ca4b478d…) + arşiv 6 zip
  (1 belge+kanıt, 2–6 bundle parçaları; birleştirilip klonlandı, a11b0a7). PR açıldı.
  PR ceougur/ofis---y-netimi#30; master çakışması "ours" birleştirmesiyle giderildi (515222c, ağaç aynı). KARAR (kullanıcı, 16.10.2026 ~19:50 UTC: "CI yeşil
  olunca birleştir") → PR CI + kapı yeşil olunca squash birleştirme; sonra kullanıcı yayını açar (bağlantı verildi).
  BİRLEŞTİ (16.10.2026 20:24 UTC): PR #30 squash → `master` = 5b45c5d (ağaç 4b4eca1 ile AYNI; uygulama dosyaları paket 652bdc7 ile aynı; head CI + kapı yeşil).
  SIRADA: kullanıcı yayın açar (v2.4.0 → master, 5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" → site kılavuz PR'ı (PDF ca4b478d…).
  YAYIMLANDI (16.10.2026 20:36 UTC; `v2.4.0` = 5b45c5d; yayımdan önce kullanıcının ekranındaki 5 ad/boyut teslimle karşılaştırıldı): yayındaki 5 dosya +
  latest/ teslimle bayt bayt aynı, exe .sha256 OK, latest = v2.4.0; gerçek eski güncelleyiciler (v2.3.0, v2.2.0, v2.1.0 kodu) canlı GitHub'da 2.4.0'ı
  "available" gördü, 2.4.0 → "up-to-date". Site kılavuz PR'ı ceougur/destekofis#16 açıldı (PDF ca4b478d…; kullanıcı "birleştir" bekleniyor).
  release.yml "Sürüm yayımla" master CI'yi bekliyor (sürümlü exe ekleyecek).
  Site kılavuz PR'ı ceougur/destekofis#16 BİRLEŞTİ (kullanıcı "kılavuza hap bilgiyi koyduysan birleştir"; PDF'te e-Fatura denemesi, Canlıya geçiş, ölçü birimi,
  görünüm maddeleri doğrulandı; main c8a7706, main PDF ca4b478d… doğrulandı). 30 dk raporu DURDU (site PR birleşti). 2.4.0 KAPANDI; açık: master 5b45c5d CI +
  release.yml sonucu okunacak. Sonra: Pazar 18.10 planlı test, 2.4.1 adayı (canlı giriş iletisi), fiyat/lisans kararları, devir modülü kararı (22.10).
- İSTEK (kullanıcı, 16.10.2026 ~20:45 UTC): "maliyeti olmayacak şekilde 4-5 saat sürecek; gerçek kullanıcılı, EDM test entegratörüne gönderilecek, sonra sonuçlar
  incelenecek; çeşitli sektör/ürün/vergi oranı; e-Arşiv + e-SMM + e-Fatura; logolu, kaşeli, karekodlu; dişli test" → BAŞLADI: betik + bağımsız Python kâhin
  + diş kanıtı (bozulmuş girdiyle kırmızı) docs/kanit/2026-10-16/edm-dayaniklilik (ajan yazıyor, yalnız sahte EDM'yle ayıklıyor); gerçek EDM koşusunu ana oturum
  başlatır (270 dk, 2 şirket × 5 kullanıcı, ekrandan). BULGU (YÜKSEK, ana oturum yeniden üretti): e-SMM EDM'ye GÖNDERİLEMİYOR — "e-SMM kullanıcısıyım"
  işaretlenince serbest meslek makbuzu TES/ESM serisinden numara alıyor (ProfileID ESMM) ama Gönder → 409 "Bu belge gönderilemez."; kartta işaret açık
  (hof-invoices.js:2804). Canlıda avukat müşteri işaretlerse numara harcanır, belge GİB'e gitmez. KARAR BEKLENİYOR: 2.4.1'de işareti gizle (hızlı) ve/veya
  EDM e-SMM servisini bağla (EDM paketi E-SMM klasörü; ayrı API).
  KARAR (kullanıcı, 16.10.2026 ~21:00 UTC, bir süre ekran başında değil): "dayanıklılık testlerini yap, 30 dk bir kontrol et, düzeltme gerektiren bulgular
  olursa uygula ve e-SMM gizli yaparak test sonucu ile zipi teslim et" → 2.4.1: e-SMM işareti gizli + sunucu reddeder (config.esmmEnabled, varsayılan kapalı;
  eski "esmm: true" kayıtta makbuz kâğıt kalır); dayanıklılık koşusu son kodla; bulgu → yeniden üret → kırmızı test → düzelt; teslim: 5 dosya + arşiv +
  test sonucu. Birleştirme/yayın kullanıcı dönünce. e-SMM gönderimi için EDM'den servis adresi + doküman + test yetkisi istenecek (metin kullanıcıya verildi).
  DURUM (16.10.2026 22:20 UTC): e-SMM gizli birleşti (465cc33; test 0/3 → 3/3, e2e 71/71); dayanıklılık betiği + kâhin + diş kanıtı ce6777f (sahte EDM 68/69;
  tek ✗ KDV yuvarlama KURAL FARKI: kâhin oran başına, program satır başına; 17/174 belge 1 kuruş, satır kuralıyla 174/174 aynı — hüküm: açıklanan fark).
  GERÇEK EDM KOŞUSU 22:14 UTC başladı (SURE_DK=270, 10 kullanıcı, TOHUM=1; günlük scratchpad/dayaniklilik-gercek/kosu.log; çıktı oraya, özet sonra depoya).
  Koşu sürerken server/ ve client/ DEĞİŞTİRİLMEZ. Ajan gözlemleri (BİLGİ): iptal edilmiş belgenin XML'i inmiyor (409), iptal PDF'inde karekod yok,
  PUT settings kısmi "start" haritası öbür serilerin başlangıcını sıfırlar (yalnız API; ekran tam harita gönderir).
  DURUM (17.10.2026 ~03:30 UTC): dayanıklılık A (tohum 2) 465 belge 69/70, B (tohum 3) 472 belge 63/70 — kalan 7'nin kök nedeni: EDM geçici 11059 ret (1 belge;
  koşudan sonra yeniden gönderildi → "Alıcıya ulaştı"), EDM 20005 resmî PDF (sonra indi), test aracının karekod çözücüsü 300 dpi istedi, KDV/tevkifat kalem başına
  yuvarlama kural farkı; ürün kusuru YOK. 2.4.1'e kullanıcının bıraktığı canlı giriş iletisi de girdi (fa01323; gerçek canlı adreste doğrulandı). KANIT
  `docs/2.4.1-KANIT.md`. Sırada: tam npm test + bağımsız gözden geçirme → son aday [uzun-dogrulama] → CI + Uzun yeşil → imzalı paket + kurulum → teslim. Birleştirme/yayın kullanıcı dönünce.
  2.4.1 TESLİM EDİLDİ (17.10.2026 ~05:50 UTC): paketlenen 40cb354 (ürün kodu cd15bf7; CI #798 YEŞİL; Uzun Doğrulama run 38999890454 23/23 + kapı YEŞİL;
  tam npm test 2664/2664). Kapsam: e-SMM gizli, canlı giriş yönlendirmesi, gözden geçirme G1–G4 + dar kontrol B1–B3 (kontrol-241). İmzalı zip 1deabc76…,
  bildirge f4819baf…, kılavuz PDF 1ed34558… (DEĞİŞTİ → yayından sonra site PR'ı), kurulum exe 860bb8f2… (iki parça + BIRLESTIR.bat/.md); arşiv 6 zip. PR açıldı
  (master; master 5b45c5d ağacı 4b4eca1 ile aynı → "ours" birleştirmesi). SIRADA: kullanıcı döner → "birleştir" → PR CI + kapı yeşil → squash → yayın (v2.4.1,
  "DestekOfis 2.4.1", not "İyileştirmeler", 5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" → site kılavuz PR'ı. e-SMM: kullanıcı EDM'den servis/belge/yetki ister.
  BİRLEŞTİ (kullanıcı, 17.10.2026: "geldim, githuba yüklemek için link ver, sende birleştir"): PR ceougur/ofis---y-netimi#31 squash → `master` = 34ed6cc
  (ağaç e188256 ile AYNI; uygulama dosyaları paket 40cb354 ile aynı; PR CI #800 + push #799 yeşil). Yayın bağlantısı verildi. SIRADA: kullanıcı v2.4.1'i açar
  (5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" → site kılavuz PR'ı (PDF 1ed34558…). Dal master'dan yeniden başlatıldı.
  YAYIMLANDI (kullanıcı "yayımladım", 17.10.2026 06:32 UTC; `v2.4.1` = 34ed6cc; yayımdan önce kullanıcının ekranındaki 5 ad/boyut teslimle karşılaştırıldı):
  yayındaki 5 dosya + latest/ teslimle bayt bayt aynı, exe .sha256 OK, latest = v2.4.1; gerçek eski güncelleyiciler (v2.4.0, v2.3.0, v2.2.0, v2.1.0 kodu) canlı
  GitHub'da 2.4.1'i "available" gördü, 2.4.1 → "up-to-date". Site kılavuz PR'ı ceougur/destekofis#17 BİRLEŞTİ (kullanıcı "birleştir"; main cccfb25, main PDF 1ed34558… doğrulandı). 2.4.1 KAPANDI;
  açık: release.yml run 39010296441 (sürümlü exe) sonucu okunacak. Sonra: Pazar 18.10 planlı test, e-SMM (EDM'den servis/belge/yetki), fiyat/lisans, devir (22.10).
- SORU (kullanıcı, 17.10.2026; bir videodan "canlıya çıkmadan 5 kontrol": hız sınırı, ortam değişkeni doğrulama, merkezi hata yönetimi, havuz + sağlık ucu,
  geri dönüş/yedek — "bizde karşılığı var mı?") → koddan cevap verildi: giriş/sohbet hız sınırı VAR (auth.mjs:17, chat.mjs:155), genel API sınırı YOK (yerel ağda
  yeterli; uzaktan bağlanma ile ZORUNLU); zorunlu gizli anahtar yok, varsayılan parola ilk girişte değişir; merkezi hata VAR (app.mjs:515 genel ileti) ama
  "şirket açılamadı" 503 iletisi ham hata metni içerebilir (app.mjs:497); /api/health VAR ama veri tabanına dokunmuyor (açık); güncellemede deneme kipi +
  kendiliğinden önceki sürüme dönüş + 6 saatte bir yedek/30 kopya/geri yükleme VAR. ÖNERİ 2.4.2 (KARAR BEKLENİYOR): (1) sağlık ucu her şirket dosyasına
  küçük okuma (dönüşü de tetikler) ~½ gün, (2) 503 iletisini sadeleştir, (3) hatalı ortam değeri açılışta uyarı; (4) genel hız sınırı uzaktan bağlanma işine bağlanır.
  KARAR (kullanıcı, 17.10.2026: "bunu istemiyorum şimdilik") → 2.4.2 önerisi YAPILMAZ (kayıtta kalır).
- İSTEK (kullanıcı, 17.10.2026): "web sitesinde ya da hem web sitesi GitHub'ında hem program GitHub'ında açık API, unutulmuş şifre, sızıntı var mı — maliyetsiz
  test yap" → BAŞLADI: iki deponun bütün git geçmişi (gitleaks + kendi desen taraması + bilinen gizlilerin parmak izi), GitHub gizli tarama, yayın dosyaları,
  canlı uçlara yalnız OKUMA denemesi (yetkisiz istek reddediliyor mu). Değişiklik yapılmaz; bulgu → kullanıcıya rapor + öneri.
  SONUÇ (17.10.2026; kullanıcı ek: "web sitesinin kodunu da okut"): SIZINTI YOK — gitleaks (iki depo, bütün geçmiş): site 0, program 20 (hepsi yanlış alarm:
  senaryo adı, açık keyId, test parolası); özel anahtar/JWT/service_role/sb_secret 0; imza anahtarı ve EDM test hesabı parmak izi 0; yayındaki güncelleme
  zip'i 251 dosya temiz. Site kodu okundu: gizliler Vercel ortamında, Supabase tabloları RLS + revoke, 3 RPC API sırrı ister (SHA-256), operatör parolası
  bcrypt, IP başına 5/15 dk kilit, oturum HttpOnly+SameSite=Strict+köken+özel başlık, panelde her değer esc() + CSP. İş akışları: imza anahtarı yalnız
  etiket push'unda, CI pull_request (fork'a sır yok). DÜŞÜK: operatör girişinde genel 100 hata/15 dk kilidi kötüye kullanılıp operatör kilitlenebilir;
  varsayılan yönetici parolası açık depoda (ilk girişte değişir). DENENMEYEN: canlı uçlar (destek-ofis.vercel.app ağ kuralıyla kapalı; Vercel bağlantısı
  projeye yetkisiz 403), Supabase doğrudan (adres depoda yok), kurulum .exe içi (sıkıştırılmış).
  CANLI (kullanıcı ağ iznini açtı, aynı gün): /.env, /.git/config, /supabase/lisans.sql, /vercel.json, /api/_lib/* → 404; /api/operator başlıksız/yabancı
  köken 403, oturumsuz/sahte çerez 401, bilinmeyen işlem 400, GET 405; lisans check bozuk/SQL denemesi 400, bilinmeyen lisans 409; /api/lisans/v1/durum
  yalnız keyId + signer/db (gizli yok); canlı sayfalarda anahtar/Supabase adresi yok (gitleaks 0); /admin CSP + DENY + HSTS + noindex. Operatör girişi
  denenmedi (sahte "hatalı giriş" kaydı düşmesin). Sonuç: canlıda da açık yok.
- SORU (kullanıcı, 17.10.2026; ekran: Entegratör Ayarları — EDM, Test Ortamı, kullanıcı adı/parola girili, Servis Adresi test adresi, GB/PK "Önce Etiketleri
  Getir"): "test denemelerine başlayacağım, ayarlar doğru mu?" → doğru; sıra: Kaydet → Bağlantıyı Test Et → Etiketleri Getir + GB/PK seç + Kaydet; Firma VKN =
  EDM test hesabının VKN'si; Servis Adresi boş da olabilir (canlıya geçerken boşalt); denemeyi ikinci şirkette yap.
- KUSUR (kullanıcı denemesi, 17.10.2026; ekran: onay "FIS2026000000001 … Kaydet ve Gönder … entegratöre gönderilir"): belge türü KAGIT (FIS serisi) olduğu hâlde
  form "Kaydet ve Gönder" düğmesini ve "entegratöre gönderilir" metnini gösteriyor (hof-invoices.js:1849 sendable: calc.profile yoksa "" ≠ KAGIT → true). Olası
  neden kullanıcıda Fatura Ayarları "e-Fatura mükellefiyim / e-Arşiv kullanıcısıyım" kapalı (invoices.mjs:1109 → KAGIT). Kullanıcıya yol verildi. 2.4.2 ADAYI:
  KAGIT'ta düğme "Kaydet", metin kâğıt belge; entegratör bağlıyken işaretler kapalıysa kartta uyarı. Yeniden üretilip kırmızı testle düzeltilecek (karar kullanıcıda).
- KUSUR (kullanıcı denemesi, 17.10.2026; ekran: TEA2026000000001 "Hata" — EDM 11048 "Daha önce gönderdiğiniz bir faturayı tekrar göndermeye çalıştınız";
  İptal Et → EDM 11017 "Fatura bulunamadı"): (a) test serisi TEF/TEA 000000001'den başlıyor, EDM test hesabı ORTAK → numara çakışır (bizim denemelerde başlangıç
  API'den rastgele verilmişti; ekranda test serisi "Sıradaki No" alanı yok — invoices.mjs testNumbers yalnız gösterir) → her müşterinin ilk test faturası düşer;
  (b) eStatus "error" + EDM'de yok (11017) belge ne iptal (remote iptal 11017) ne silinebiliyor; canLocalCancel "error"ı kapsamıyor (invoices.mjs:920).
  ÖNERİ 2.4.2 (KARAR BEKLENİYOR): test serisi firmaya özgü büyük başlangıç + elle Sıradaki No; "error"da Yalnız Programda İptal Et (11017'de); 11048'e açık ileti;
  + KAGIT'ta "Kaydet ve Gönder" kusuru. Kullanıcıya: test gönderimini düzeltmeye kadar beklet.
- 2.4.2 BAŞLADI (kullanıcı "BAŞLA", 17.10.2026): test serisi firmaya özgü rastgele büyük başlangıç (TEF/TEA/TES; kullanıcı: "e-Faturada, e-SMM'de de"),
  "Hata"daki belge İptal Et (EDM 11017 → programda), 11048 iletisi, kâğıt belgede "Kaydet ve Gönder" yok, Otomatik Seriler'de Test Ortamında Sıradaki No;
  gözden geçirme G1–G5 + kontrol turu K1 düzeltildi (docs/2.4.2-DEGISIKLIKLER.md). İSTEK (kullanıcı, aynı gün; ekran Yeni Cari → Edge "Adres kaydedilsin mi?"):
  "adres, numara, şifre doldururken Google 'kaydet' diyor, kafa karıştırıyor" → giriş dışı formlarda autocomplete off + parola alanları gizli yazılı metin
  (hof-core.js); Edge'in gerçekten dinlediği kullanıcının bilgisayarında doğrulanır. Dinlemezse öneri: başlatıcı ayrı tarayıcı profiliyle (öneriler kapalı)
  açar — kurulum değişikliği, gerçek Windows'ta denenmeli; karar kullanıcıda.
- KARAR (kullanıcı, 17.10.2026: "uzun doğrulamayı koş, kurala uyalım") → 2.4.2 son adayında Uzun Doğrulama GitHub'da bir kez; sonra imzalı paket + teslim + PR.
  İSTEK (aynı gün: "30 dk'da bir kontrol et") → send_later ile 30 dk denetimi (her seferinde yeniden kurulur); 2.4.2 teslim edilince ya da kullanıcı "durdur" deyince durur.
  2.4.2 TESLİM EDİLDİ (17.10.2026 ~13:15 UTC): Uzun Doğrulama run 39025035201 24/24 YEŞİL; paketlenen e780aea (CI #810 YEŞİL; tam npm test 2674/2674;
  yerel 33/33 e2e). İmzalı zip cd7846f5…, bildirge c50504dc…, kılavuz PDF 2f5fc5cd… (DEĞİŞTİ → yayından sonra site PR'ı), kurulum exe b93579ca… (iki parça +
  BIRLESTIR.bat/.md); arşiv 5 zip (bundle birleştirilip klonlandı, f8db38c). PR ceougur/ofis---y-netimi#32 açıldı (master; master 34ed6cc dalın atası).
  30 dk denetimi DURDU (teslim). SIRADA: kullanıcı "birleştir" → PR CI + kapı yeşil → squash → yayın (v2.4.2, "DestekOfis 2.4.2", not "İyileştirmeler",
  5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" → site kılavuz PR'ı (PDF 2f5fc5cd…).
  BİRLEŞTİ (kullanıcı "birleştir sen", 17.10.2026): PR #32 squash → `master` = b340bf6 (ağaç 825ba9a ile AYNI; PR CI #813 + kapı yeşil). Yayın bağlantısı
  verildi; dal master'dan yeniden başlatıldı. SIRADA: kullanıcı v2.4.2'yi açar (5 dosya) → "yayımladım" → bayt bayt + güncelleyici "available" → site kılavuz PR'ı.
  YAYIMLANDI (kullanıcı "yayımladım", 17.10.2026 14:05 UTC; `v2.4.2` = b340bf6; yayımdan önce kullanıcının ekranındaki 5 ad/boyut teslimle karşılaştırıldı):
  yayındaki 5 dosya + latest/ teslimle bayt bayt aynı, exe .sha256 OK, latest = v2.4.2; gerçek eski güncelleyiciler (v2.4.1, v2.4.0, v2.3.0, v2.2.0, v2.1.0 kodu)
  canlı GitHub'da 2.4.2'yi "available" gördü, 2.4.2 → "up-to-date". Site kılavuz PR'ı ceougur/destekofis#18 BİRLEŞTİ (kullanıcı "birleştir"; main 62883a0, main PDF 2f5fc5cd… doğrulandı). 2.4.2 KAPANDI;
  açık: kullanıcı Edge kaydetme önerilerinin kalktığını kendi makinesinde doğrulayacak (kalkmazsa ayrı tarayıcı profili önerisi). Sonra: Pazar 18.10 planlı test, e-SMM, fiyat/lisans, devir (22.10).
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

## Arşiv 21.10.2026 (CLAUDE.md "Açık iş"ten AYNEN taşındı; kapanan 2.4.3 maddeleri, 2.3.0'da kapanan SIRA, uzun hâlleri ve uygulanmış kararlar)
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
  karar verilince ona göre yaparız"). Hatırlatıcı 22.10.2026 Perşembe 09:00 TR (trig_01NEGfcTp7hAnHG1tgw6mFAv).
  BELGE (kullanıcı, 20.10.2026: "DestekOfis_Yil_Sonu_Devir_Modeli_Tamamlanmis_2.pdf — sadece değerlendirmeni istiyorum, programımıza uygun mu?"): Kip 1 varsayılan +
  Kip 2 sihirbaz ÖZÜ UYGUN; değerlendirme verildi (kod değişmedi). Belgede eksik/yanlış: gelir-gider kapanışı (6xx→690→590/591) ve açılış bilançosu yok;
  stok maliyeti programda SON ALIŞ (ortalama/FIFO motoru yok; LIFO TMS 2'de yok, VUK teyidi); Ocak'ta gelen Aralık faturaları/e-Arşiv iptali/KDV beyanı için
  arşiv hemen salt okunur olamaz → "Devri Güncelle" (yeniden aktar, fark) Faz 3'e; kayıt/görev/belge/kullanıcı/ayar/e-Belge seri ve Gönderilecekler kapsam dışı
  kalmış; Connection Manager zaten var (şirket = ayrı dosya, readOnly açılış); terminaller HTTP ile tek sunucuya bağlı → "database is locked" riski yok;
  para kuruş tamsayı → kuruş toleransı KABUL EDİLMEZ (fark = hata); özel kip için sunucu tarafı yazma kilidi gerekir.
  ARKADAŞIN YANITI (20.10.2026, docs/devir/DEVIR-MODULU.md §10): devir Ocak–Şubat'ta, "Son İşlem Tarihi" 31.12 ile; devirden sonra eski yıla kayıt
  girilmez; şikâyet az. → Wolvox yöntemi: kesim tarihinde dosyayı ikiye ayır (eski yıl salt okunur; yeni yıl açılış + kesim sonrası hareketler); "Devri Güncelle"
  ilk sürümde yok. Kesimden sonraki (Ocak–Şubat) kayıtlar yeni yıla hareket olarak geçer (kullanıcı teyidi, 20.10.2026). YÖNTEM KARARI: Wolvox yöntemi.
  UYGULAMA PLANI (kullanıcı, 20.10.2026: "2.4.4'ten sonrası için planlayalım, devir dosyası olarak tüm detayları ile yazalım; yeni sohbetten de
  bulup yapabil"): `docs/devir/DEVIR-PLANI.md` — TEK BAŞINA YETERLİ (karar özeti, akış, mimari "yerinde budama + arşiv kopyası", modül modül kesim
  tablosu, açılışlar, kapanış/açılış fişi, ön denetim, Geri Al, teknik ayrıntılar dosya:satır, Nasıl Bozulur, test/kanıt, aşamalar D0–D6, açık sorular §11).
  2.4.4'ten SONRA, sürüm 2.5.0; başlamadan D0 (koda karşı yeniden doğrula). §11 KARARLARI VERİLDİ (kullanıcı, 20.10.2026: "en yaygın ve
  uygun hali neyse öyle yapalım"): 590/591 aynen açılır (570/580 mali müşavirde); Borç ve Alacakları Aktar varsayılan + Sadece Bakiye seçeneği; bütün cari
  kartlar kalır, minimum bakiye yok; stok ağırlıklı ortalama alış fiyatı (fark arşivde 153↔621); vergi karşılığı/yıl sonu düzeltmeleri programda yok. Kullanım sınırı (13.10 %83):
  para çekirdeğine dokunan iş Perşembe 02:00 sıfırlamasından önce başlatılmaz.
- SIRA (kullanıcı, 13.10.2026): Perşembe (sıfırlamadan sonra) → (1) banka kalan işleri — ŞÜPHELİ ALACAKLAR (İz 4.3, plan §3.11b) DAHİL
  (kullanıcı: "banka kalan işlerine say") + ölçek-20 kök neden ve öbür ertelenen banka maddeleri → (2) fatura/e-Belge (EDM) → (3) devir modülü.
  WhatsApp paylaşımı (emlakçı isteği) ŞİMDİLİK BEKLER (kullanıcı: "şimdilik kalsın").
  2.3.0 BANKA EKSTRESİ (ekstre yükleme + eşleştirme) LİSTEDEN ÇIKTI (kullanıcı, 13.10.2026: "müşteri portföyüm pek ilgilenmez, sonra ihtiyaç
  duyulursa yaparız") — plan bölümü yerinde kalır, ihtiyaç olursa açılır.
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
- UZMAN UI (5966ac3): YÜKSEK yok; ORTA UI1 WhatsApp düğmesi kontrast 1,98:1, UI2 fatura formunda bildirim alanları örtüyor + ileti 3 kopya, UI3 stok kodu/
  barkod kesiliyor (kalem, PDF, liste), UI4 kodda Tab ürünü seçmiyor; DÜŞÜK UI5–UI11 (yazım düzeni kaçakları + yazım testinin kör noktası "e-…" ve React
  paketi, kontrast, biçim tutarlılığı). UZMAN UX: YÜKSEK UX1 cari eşzamanlı düzenlemede kayıp güncelleme, UX2 tam iade Düzenle'de kaydedilemiyor, UX3 gece
  yarısını geçen açık fatura penceresi dünün tarihiyle keser, UX4 onayda odak yıkıcı düğmede (Esc+Enter doldurulmuş faturayı siler) — ana oturum dördünü
  koddan doğruladı; ORTA UX5–UX13, DÜŞÜK UX14–UX28. Tam listeler: scratchpad uzman-ui-243-betikler/BULGULAR.md, uzman-ux-243-betikler/BULGULAR.md (kanıtla
  depoya alınacak).
  KARAR (kullanıcı, 18.10.2026 ~17:20 UTC): KÖ1 "Nihai Tüketici" hızlı seçeneği → 2.4.3; KÖ2 "Listeden Sil" adı → "Müşteri Fişi Olarak Bırak" (onay metni
  açık; kılavuz/testler güncellenir) → 2.4.3; KÖ3 "Başlarken" kontrol listesi → 2.4.4 (yeni özellik). KÖ4 (e-Fatura işareti elle kaldırılınca bilgi iletisi)
  UX5 ile birlikte yapılır.
- UI/UX A PAKETİ (dal uiux-a-243, 5 commit; ana oturum birim eski 7/9 kırmızı → 9/9): UX1, UX4, UX5(cari)/KÖ4, UX7, UX8, UX10(çekirdek), UX11, UX13, UX19
  (ad "Tahsilat / Ödeme" — yalnız nakit para çekirdeğine dokunurdu), UX21, UX22, UI1, UI3b/c, UI6–UI10, UI11 (fatura dışı); 24 madde B paketine (fatura ekranı).
  KARAR (kullanıcı, 18.10.2026 ~18:30 UTC: "önerin gibi yap"): UI11 dışa aktarım düğmeleri bütün modüllerde tek ad ("PDF" / "Excel", aynı görünüm) → B paketi.
- KARAR (kullanıcı, 18.10.2026 ~19:10 UTC: "uygula"; token tasarrufu): (1) DAR KONTROL 3 kapsamı = e-Belge numara/gönderim akışı (sunucu + ekrandaki
  Tümünü Gönder döngüsü) + Vergi Ödemesi / KDV Mahsup kayıtları + stok açılışının deftere girmesi; genel UI/UX değişiklikleri dışarıda (ajan testleri +
  tam e2e sınar). (2) 30 dk denetim raporu değişiklik yoksa TEK SATIR; kırmızı/yeni bulgu/karar gerekince ayrıntılı. Kalan iş tahmini ~20 sa, ~3,5–5 M token.
- KARAR (kullanıcı, 18.10.2026 ~19:30 UTC; B paketi kapsamı): 2.4.3'te → UX2, UX3, UX5 (fatura), UX6, UX28, UI4, UI2, UX12, UX24, UX23, UX14, UX26, KÖ1, KÖ2.
  2.4.4'e ERTELENDİ → UI11 (düğme adlarının birleştirilmesi + fatura penceresi çift başlık), UI5, UI9 (fatura), UI3a, UX15, UX16, UX17, UX18, UX20, UX25,
  UX27, UX9, UX10 (fatura). Ertelenenler iş listesinde "2.4.4", sürüm notunda ve teslimde BİLİNEN SINIRLAR'da yazılır.
- KARAR (kullanıcı önerisi, 18.10.2026 ~21:45 UTC; baş mimar anayasaya uygun buldu): son aday Uzun Doğrulama'da (GitHub) koşarken AYNI commit'te gerçek EDM test
  ortamı denemesi (MM1 dahil) ve imzalı paket + kurulum hazırlanır; TESLİM ancak Uzun Doğrulama yeşil okunduktan sonra. Ön koşul: sürüm belgeleri ve kılavuz
  PDF son adaydan ÖNCE biter (paketin içinde). Uzun Doğrulama kırmızı çıkıp kod değişirse paket ve etkilenen EDM adımı yeni commit'te yeniden yapılır.
- DAR KONTROL 3 (19.10.2026, fc42855): B-1 ORTA gerileme (vekil sunucu kapalıyken numara veriliyordu; B3 oturum önbelleği kaynaklı), B-2 DÜŞÜK (tur sürerken
  imleç öncesi belge), B-3 DÜŞÜK (stok açılışı Düzenle gidiş-dönüşü), kâhin eşitleme hatası — ana oturum B-1/B-2/B-3'ü yeniden üretti; düzeltme bbb6d3c (eski 5/16 →
  16/16; kâhin 9–12 fark 0; defter kâhini 147/147). Vergi Ödemesi/KDV Mahsup ve KÖ1 sorunsuz. Görüş: silinen üründe açılış 153'te kalır (bilinçli).
- SON ADAY (19.10.2026): 3673956 CI #841 YEŞİL; Uzun Doğrulama run 39200937044: 24/24 iş YEŞİL, "Uzun Doğrulama Kapısı" ARAÇ HATASIYLA çöktü (kâhin --cikti JSON'ları
  kayıt sanıldı; ürün değil) → düzeltme b68aafe (kanit.mjs readRecords; test eski araçta kırmızı → 48/48). KARAR (kullanıcı, 19.10.2026 ~07:00 UTC, "uygun"):
  b68aafe CI yeşil olunca TESLİM (5 dosya + arşiv) şimdi; aynı anda b68aafe'de Uzun Doğrulama baştan; kullanıcı GitHub YAYININI kapı yeşil bildirilene kadar AÇMAZ
  (kapı kırmızıysa yayın açılmaz). Gerçek EDM 05e64d0'da 7/7 (ürün kodu 3673956/b68aafe ile aynı).
  SONUÇ (19.10.2026 ~10:30 UTC): Uzun Doğrulama b68aafe run 39212127100 KAPI YEŞİL (24/24; tohum 2 koşucu kopması → tek yeniden koşu GEÇTİ); CI #842 b68aafe
  yeniden koşuda YEŞİL (D2 ön koşul zamanlaması — 2.4.4: belirlenimci yap); PR ceougur/ofis---y-netimi#33 CI YEŞİL. Kullanıcıya "yayını açabilirsiniz" bildirildi.
  KALAN: kullanıcı "birleştir" → PR birleşir; kullanıcı yayın açar (v2.4.3, 5 dosya) → "yayımladım" → yayındaki dosyalar bayt bayt + güncelleyici "available"
  → site PR'ı (ceougur/destekofis web/indir kılavuz).
- 2.4.3 YAYIMLANDI (19.10.2026): PR #33 → master 163dd5d; kullanıcı v2.4.3 yayınını açtı; 5 dosya bayt bayt aynı; güncelleyici 2.4.2/2.4.0/2.3.0/2.0.12 gözüyle
  2.4.3 "available" (yedek yol), indirilen zip sha256 aynı; site kılavuz PR ceougur/destekofis#19 birleşti, sitedeki PDF 6687435d… doğrulandı. Yayın sonrası
  "Sürüm yayımla" + master CI 163dd5d sonucu bir sonraki oturumda okunacak.
- SORU (kullanıcının yardımcısı, 19.10.2026): "EDM'de tüm bilgileri getirmek 1 kontör; kontör düşmesin dersen yalnız ticari unvan + posta kutusu gelir". KODDAN: Mükellef
  Sorgula yalnız CheckUser çağırır (edm.mjs checkUser: unvan, PK etiketleri, tür) — adres / vergi dairesi GETİRMEZ, kontörlü sorgu YOK. EDM WSDL'inde GetCompany /
  GetCompanyBasic / GetTurmob var (hangisinin kontörlü olduğu ve döndürdüğü alanlar doğrulanmadı). KARAR (kullanıcı, 19.10.2026: "şu anki durum şimdilik yeterli, sonraki zamanlarda talebe
  göre bakarız"): kontörlü "Tüm Bilgileri Getir" YAPILMAZ, 2.4.4 kapsamında DEĞİL; müşteri talebi gelirse yeniden değerlendirilir.
- MEVZUAT (kullanıcı, 20.10.2026: "bunları maliye ve vergi kanunlarından, mevzuatlardan bul") → GİB ebelge.gib.gov.tr/dosyalar/509_SN_VUK_GT.pdf (509 s. VUK GT,
  GİB'deki metin) okundu: IV.2.2 e-Arşiv'e İSTEĞE BAĞLI dahil olmanın şartı (a) e-Fatura uygulamasına dahil olmak; IV.2.4.1 e-Fatura'ya dahil olanlar e-Arşiv'e
  de GEÇMEK ZORUNDA (faturalar e-Fatura ya da e-Arşiv); IV.1 (s.~483) e-Fatura'lılar arası fatura e-Fatura zorunlu; IV.2.4.3 e-Arşiv'e dahil olmayan mükellef
  sınırı aşan faturayı "Başkanlıkça sunulan e-Belge düzenleme portali" (GİB e-Arşiv Portalı) üzerinden e-Arşiv düzenler; s.~640 e-Arşiv alıcıya talebine göre
  kâğıt ya da elektronik iletilir. Sınır (GİB dosyası 30 bin / 5 bin TL; ikincil kaynak TÜRMOB: 2025 3 bin TL, 1.1.2026'dan itibaren tutara bakılmaksızın)
  — güncel tutar resmî Gazete metniyle DOĞRULANMADI. Program etkisi: "e-Arşiv kullanıcısıyım" işaretli ama "e-Fatura mükellefiyim" işaretsiz durum GİB portalı
  kullanan mükellef olabilir (EDM ile kesemez) → 2.4.4'te kutu açıklaması/uyarı değerlendirilir (karar kullanıcıda).
  EK (kullanıcı, 20.10.2026: "e-Fatura mükellefi entegratörden, e-Arşiv mükellefi GİB'den keser; vergi kaydında e-Arşiv seçmiş olan programdan kesemez — teyit
  gerekir") → 509 V.1 okundu: YÖNTEM belge türünden BAĞIMSIZ — her e-Belge (e-Fatura ve e-Arşiv) üç yoldan biriyle: GİB Portal, Özel Entegratör (EDM), Doğrudan
  Entegrasyon; V.1.4 entegratörün mükellefi GİB'e yükleyip onay alması gerekir. Belirleyici olan belge türü değil KAYIT YÖNTEMİ: GİB Portal kullanıcısı EDM ile
  kesemez (önce EDM sözleşmesi + GİB'de entegratör kaydı). İki yöntemin aynı anda kullanılıp kullanılamayacağı tebliğ metninde BULUNAMADI (EDM/mali müşavir).
  2.4.4 ADAYI: kutu metinleri "EDM üzerinden e-Fatura / e-Arşiv kullanıcısıyım" + kısa açıklama (GİB Portal kullanıcısıysanız işaretlemeyin).
  KARAR (kullanıcı, 20.10.2026: "teyit edilecek kısımlar önemsiz; böyle dursun, geri bildirim olursa kutuları netleştiririz") → kutular DEĞİŞMEZ, 2.4.4
  kapsamında DEĞİL; müşteri geri bildirimi gelirse yeniden ele alınır. Teyit soruları (iki yöntem aynı anda, 2025/2026 tutar sınırı) kapatıldı.

## Arşiv 22.10.2026 (CLAUDE.md "Açık iş"ten AYNEN taşındı; 2.4.4 sürerken kapanan sorular, kararlar ve istekler)
(Kullanıcı, 22.10.2026 ~14:50 UTC: "anayasamızı ve dersleri gözden geçir" → GÖZDEN GEÇİRME 3, anayasa "kısa tutulur". Maddeler CLAUDE.md'deki sırasıyla, hiç
değiştirilmeden; kalıcı olanların özeti CLAUDE.md "Kalıcı ürün kararları" → "2.4.4 kararları".)
- 2.4.4 "BAŞLA" KONTROL LİSTESİ (atlanmaz, sırayla): (1) yukarıdaki iki belge + bu Açık iş dosyadan okunur; (2) RAPOR DÜZENİ için CronCreate 30 dk işi
  kurulur ("7,37 * * * *"; 2.4.4 bitince silinir); (3) iş listesi madde 1 (npm ci — bağ yok; git fetch --unshallow --tags; master CI 163dd5d + "Sürüm yayımla"
  okunur); (4) yüklenen dosyalar yerinde mi (HAZIRLIK 3) — yoksa kullanıcıdan istenir; EDM test hesabı sohbette verildi, dosyaya YAZILMAZ, kaybolduysa
  kullanıcıdan istenir; (5) her ajan AJAN EFORU kuralıyla (effort verilir, fork yok); (6) biten madde iş listesinde üstü çizilir + commit (yalnız belge, CI
  koşmaz) ve 30 dk raporda gösterilir; (7) para çekirdeği maddelerinde kırmızı test + mutasyon + dar kontrol; her push'un CI'si ayrı okunur.
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
  GERİ ALINDI (kullanıcı, 22.10.2026: "kimsenin o sürümde e-SMM kesmediğine eminim"): 22a İPTAL — böyle makbuz yok; koruma yazılmaz (gereksiz iş). Bilinen sınır olarak
  teslim notunda kalır: 2.4.0'da kesilmiş numaralı ESMM makbuzu olsaydı e-SMM açılınca Gönderilecekler'de görünürdü.
- SORU (22.10.2026, madde 15 UX18; kullanıcıya baş mimar önerisiyle soruldu): "karşılıksız dönünce fatura yeniden açılır" kuralı tutarlılık için faturanın KENDİ evrakına
  (fatura kesilirken alınan çek) ve faturayla ciroya da uygulandı (taksitli hariç) → güncellemeden sonra eski verideki karşılıksız evraklı faturalar "Ödendi"den "Açık"a
  döner; cari bakiye DEĞİŞMEZ (tutar "Faturasız Cari Alacağı"ndan faturaya geçer). ÖNERİ: kalsın (muhasebece doğru: karşılıksız evrakla ödenmiş fatura ödenmemiştir) +
  sürüm notuna bir cümle. Alternatif: yalnız Kapatılacak Fatura bağlarına daralt.
  KARAR (kullanıcı, 22.10.2026: "önerini uygula"): kural uygulandığı hâliyle KALIR (faturanın kendi evrakı ve faturayla ciro dahil, taksitli hariç) + sürüm notuna cümle
  ("karşılıksız dönen evrakla ödenmiş görünen faturalar artık Açık görünür; cari bakiye değişmez").
- İSTEK (kullanıcı, 22.10.2026: "test için kesip EDM'ye gönderdiğin e-SMM numaralarını bana verirsen EDM test portalına girip ben de görebilirim"): madde 24 gerçek EDM
  koşusundan sonra kullanıcıya gönderilen her belgenin listesi verilir (tür, Belge No, ETTN, tarih, gönderim saati, alıcı, tutarlar, EDM durumu, iptal saati) — betik
  docs/kanit/2026-10-22/244-edm/OZET.md üretir; kimlik bilgisi girmez.
- SORU (kullanıcı, 22.10.2026, EDM test portalı ekranlarıyla): "bunlar bizim mi" → HAYIR (QZA/QZY serili, 1 TL, "İzole TEST sözleşme denemesi" — depoda/kanıtta yok;
  EDM test hesabı VKN 3230512384 ORTAK, başka firmaların denemeleri de görünür). "Kestiğimiz e-SMM'lerin karekodları doğru hesabı veriyor mu?" → HAYIR: e-SMM görüntüsünü
  ve karekodunu EDM'nin şablonu çizer, karekod YALNIZ ETTN içerir; GİB Karekod Standardı V1.2 §2.4 e-SMM'de vkntckn, avkntckn, tarih, no, ettn, parabirimi, brutucret,
  tahsilkdv, kdvtevkifat, gvstopaj, kdvtutari, netucret, tahsilat ister. Programın şablonu e-SMM'ye gömülemiyor (EDM 11032, deney). e-Arşiv/e-Fatura karekodu programın,
  standarda uygun (22.10: 300/60/360 doğru). → EDM'ye soru metni kullanıcıya verildi (canlıda uygun mu, test ortamı düzelecek mi, özel şablon desteği, VKN'li
  düzenleyende unvan). Aynı ekranlardan: resmî PDF'te adres iki kez (düzeltildi 959b667), VKN'li düzenleyende unvan yok (düzeltildi 32e59c0, EDM yalnız Person'dan basar).
  Portal kullanıcı adı/parolası kullanıcı tarafından teyit edildi (web servisle aynı; dosyaya YAZILMAZ).
- SORU (22.10.2026, madde 31a kâhin F3; kullanıcıya soruldu): Kapatılacak Fatura SEÇİLMEDEN alınan (bağsız) çek/senet karşılıksız dönünce, onun kapattığı faturalar
  da yeniden açılsın mı? Bugün açılmıyor (bakiye artıyor, açık faturalar toplamı bakiyeyle ayrışıyor: G1 0, G2 500, bakiye 2.000). ÖNERİ: evet (bağlı evrak için
  verilen kararla aynı mantık: karşılıksız evrakla ödenmiş fatura ödenmemiştir; Σ açık = cari bakiye korunur).
  KARAR (kullanıcı, 22.10.2026: "F3 için en yaygın uygulama ne ise onu yapalım"): uluslararası yaygın uygulama (QuickBooks "Record bounced check", Xero, Sage: ödeme
  geri alınır, fatura ödenmemiş olur) + UX18 kararıyla aynı mantık → BAĞSIZ evrak karşılıksız dönünce kapattığı faturalar da yeniden açılır (kalan ödemeler en eski
  açıktan yeniden dağılır; cari bakiye ve yevmiye değişmez; taksitli değişmez) — ux18 ajanı (is/f2-ux18) F2 ile birlikte; sürüm notu cümlesi genişler.
  EDM'YE MAİL (kullanıcı, 22.10.2026: "maili gönderdim"): e-SMM karekodu (§2.4), özel şablon (11032), VKN'li düzenleyende unvan soruldu — YANIT BEKLENİYOR; gelene dek
  teslim notunda BİLİNEN SINIR (karekod EDM'nin, yalnız ETTN).
  DEVAM (22.10.2026): teknik@ otomatik yanıtı konu başında kayıtlı VKN/TCKN istedi; kullanıcının canlı EDM hesabı YOK → talep test portalından ("Destek Talebi
  Oluştur", test kullanıcısı adıyla) açıldı. Zip'teki belgeler (kullanıcı: "yeterli gelmiyor mu") entegrasyona yeterli, karekoda değil: örnek XML EDM'nin
  general-esmm.xslt şablonuna işaret ediyor; TEMPLATE_CONTENT iki biçimde denendi, kullanılmadı; kullanıcı portalda EDM şablonunu doğruladı.
  EDM YANITI (22.10.2026 14:43 TR, Teknik Operasyon Yöneticisi; kullanıcıya e-posta): (1) karekodlar GİB standardına uygun, CANLIDA e-SMM karekodu da uygun; (2) özel
  XSLT desteği var, şablon dosyası .xslt uzantılı olmalı; (3) VKN'li mükellefte unvan cac:PartyName'den, şahısta FirstName + FamilyName'den. → TEMPLATE_CONTENT
  "XSLT" türüyle de denendi (deney-template3), kullanılmadı (özel şablon büyük olasılıkla portala yüklenir). KARAR (baş mimar): EDM'nin canlı şablonuna güvenilir,
  kendi e-SMM şablonu YAPILMAZ (gerekirse ayrı iş); VKN'li düzenleyende unvan yalnız PartyName'de (32e59c0 Person bölmesi geri alınır, esmm2 ajanı); test
  ortamının e-SMM görüntüsü canlıdan farklı → BİLİNEN SINIR + kılavuza not; ilk canlı deneme makbuzunda karekod ve unvan okunur.
- KARAR (baş mimar, 22.10.2026; kullanıcının "en yaygın ve doğru uygulama" ilkesiyle — kullanıcıya bildirildi): (1) e-SMM makbuzu Gönderilecekler'den bırakılınca
  KÂĞIT SMM serisinden numara alır, ekranda "Kâğıt Makbuz Olarak Bırak" (faturada "Müşteri Fişi Olarak Bırak" aynen) — kâhin bulgusu, is/esmm-fis 7502485; (2) verilmiş
  kâğıt/fiş numarası (FIS, SMM) BİR DAHA KULLANILMAZ: bırakılan belge sonra e-Belge olarak gönderilse de numarası seride kullanılmış sayılır (bugün 2.4.3'ten beri
  sıradaki bırakılan belge aynı numarayı alıyordu — esmm2 ajanının bulgusu); (3) e-Fatura/e-Arşiv/e-SMM XML'i GİB UBL-TR 1.2.1 XSD'siyle de denetlenir (EDM 11029'u
  yerelde yakalamak için; şemalar tools/ebelge/sema/ubl-tr-1.2.1, sha256 KAYNAK.md).
  EK (baş mimar, 22.10.2026, esmm2 raporu): 2.4.3 verisinde bırakılmış en büyük fiş/makbuz numarası hiçbir yerde kayıtlı değildi (güncellemeden sonraki ilk
  bırakmada bir kez daha verilirdi) → tek seferlik tarama is/esmm-fis'e: her şirket, seri/yıl, programın biçimindeki Kâğıt Fatura No'lardan; taban yalnız yükselir; işaret
  veri tabanında (eski yedek geri yüklenince de koşar). I23 (kâhin: ön hesap ile "Kes, Sonra Gönder" kaydının kronoloji iletisi farklıydı) aday 5 c1598c7 ile kapandı:
  ileti düğmeye bakmaz, tek ileti.
- SORU (kullanıcı, 22.10.2026 ~12:15 UTC: "e-SMM kesen kullanıcının kaşe imzası ve logosu e-fatura yapılırken eklenen yerden mi eklenecek?") → YANIT (koddan): evet,
  Fatura Ayarları → Firma Bilgisi (Logo, Kaşe / İmza); programın PDF'inde e-SMM'de de basılır (invoice-pdf.mjs: kaşe e-Fatura dışında basılır); RESMÎ e-SMM görüntüsünde
  (EDM'nin) basılmaz (invoices.mjs ublFor: ESMM'ye görünüm şablonu gömülmez; EDM gömüleni 11032 ile reddetti, TEMPLATE_CONTENT'i kullanmadı); e-SMM'de ıslak imza/kaşe
  gerekmez (mali mühür). ÖNERİ: Ayarlar'daki Kaşe / İmza açıklamasına ve kılavuza tek cümle ("e-SMM'de yalnız programın PDF'ine basılır; resmî görüntüyü EDM
  çizer"). KARAR (kullanıcı, 22.10.2026: "ekle"): aday 5'te — Fatura Ayarları açıklaması (yalnız e-SMM kullanıcısında) "Logo ve kaşe e-SMM'de yalnız programın PDF'ine
  basılır; resmî görüntüyü EDM çizer."; kılavuzun e-SMM maddesine aynı cümle + "Test Ortamı'ndaki görüntü canlıdakinden farklı olabilir"; e2e gg244-esmm-gonder ■ 4.
- SORU (kullanıcı, 22.10.2026 ~12:20 UTC; ekran: çalıştığı kurumun e-SMM'si — kurum ve müşteri bilgisi YAZILMAZ): "logo imzayı EDM mi imzalamış?" → YANIT: hayır; imza ve logo
  düzenleyenin yüklediği resim (gerçek imza XML'deki mali mühür/e-imza); daha önce yüklenen aynı tür makbuzun PDF üreticisi wkhtmltopdf + GİB standart e-SMM görünümü
  (EDM test PDF'leri IronPdf + EDM tasarımı) → başka sistem; canlı EDM'de e-SMM görünümüne logo/kaşe eklenip eklenemediği EDM'ye sorulacak (soru metni kullanıcıya verildi).
- EK BULGULAR → 2.4.4 (kullanıcı, 21.10.2026: "önerin uygun"; e için "küçük bir işse önce doğrula, sorun varsa 2.4.4'e girsin"): iş listesi 25–29 —
  a) salt okunur lisansta tax.manage, b) Brütü Hesapla kişi alıcı, c) defter kâhini CI'da, d) vekil sunucu parolası açık metin, e) 002'ye yetki/lisans olayı canlı
  ulaşmıyor: KODDAN DOĞRULANDI (app.mjs:182 şirket başına kanal, :441 çocuğa kanal verilmez, license.mjs:331) → 2.4.4'te kırmızı testle.

## Arşiv 23.10.2026 (CLAUDE.md "Açık iş"ten AYNEN taşındı — GÖZDEN GEÇİRME 5 "kısa tutulur"; 2.4.4 sürerken kapanan gözden geçirmeler, sorular, kararlar ve istekler)

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
- GÖZDEN GEÇİRME 2 (kullanıcı, 22.10.2026 ~12:45 UTC: "anayasamızı ve derslere göz gezdir"): (1) ders 38 eklendi (kaşe e2e'sinde kırmızı yanlış nedenle;
  seçici düzeltildi, geçerli kırmızı + yeşil alındı); (2) ders 21: yalnız-belge push 3099efa'nın CI hükmü okunmamıştı → okundu (ata f6e265b, bilinen senaryo-222
  kırmızısı, düzeltmesi aday 4'te); (3) Verimlilik: arka plan koşularına birkaç kez elle bakıldı → bundan sonra bildirim beklenir; (4) ders 18: madde 18 e-Fatura
  Portalı'nın "gerçek Windows + Edge" denemesi bu kapsayıcıda yapılamaz → madde 18 CI yeşili + kullanıcının kendi Windows'unda kısa elle kabul adımıyla çizilir
  (teslimde verilir; 2.4.2 Edge kaydetme önerisi de); (5) ders 32: I23 düzeltmesi ve v32 numara taraması e-Belge numarasına dokunur → 31e dar kontrolde.
- GÖZDEN GEÇİRME 3 (kullanıcı, 22.10.2026 ~14:50 UTC: "anayasamızı ve dersleri gözden geçir"): (1) DERS 18: N4 (EDM aynı anda gelen girişlerden birini reddediyor —
  EDM'ye özgü davranış) düzeltmesinin gerçek yeşili TEK koşuda (koşu 2) görülmüştü → 24b çizilmez; aday 6 kodunda (dal is/gercek6 = e070d42, /home/user/wt/edm-eszamanli)
  gerçek koşu 3 (--eszamanli) + tam takım gercek-6 (e-Arşiv, e-SMM, iptal, "bulunamadı" — ders 9/10: N4 bütün EDM çağrılarının taşıma katmanında) başlatıldı; kimlik yalnız
  o komutun ortam değişkeninde. (2) "KISA TUTULUR": CLAUDE.md 84 KB'a çıkmıştı (her oturum ve her ajan yükler; 31 turunda 4 xhigh ajan) → 2.4.4'te kapanan 22 Açık iş
  maddesi `docs/GECMIS-KARARLAR.md` "Arşiv 22.10.2026"ya AYNEN (satır satır denetlendi); özetleri "Kalıcı ürün kararları" → "2.4.4 kararları". (3) DİL: araç
  çağrılarının kullanıcıya görünen kısa açıklamaları İngilizceydi → bu turdan beri Türkçe. (4) KALİTE ÇITASI: ana oturumun kullanıcı gözüyle iş akışı yürüyüşü
  (GÖZDEN GEÇİRME (7)) hâlâ yapılmadı → aday 6 kapısının e2e'si bitince ilk iş (4 çekirdek; kapı + 2 ajan koşarken ekran yürüyüşü onların sürelerini bozar).
  (5) KURAL "her istek Açık iş'e": 24b SONUÇ 2, "18'de ben ne yapacağım", zaman çizelgesi, sıkıştırma hazırlığı iş listesi/devam notundaydı, Açık iş'te yoktu →
  eklendi. (6) TEMİZ ÇIKANLAR: son ~6 saatin 85 commit'i (bütün dallar) model adsız, Co-Authored-By + Claude-Session'lı; uzakta yalnız çalışma dalı (is/*, aday*
  gönderilmedi); EDM parolası depoda, worktree'lerde, not defterinde, git geçmişinde YOK (yalnız Claude Code'un kendi oturum günlüğünde — sohbetin kaydı, kapsayıcıyla
  gider); N4 kırmızısının nedeni iletide doğru ("Login sayısı 20; beklenen 1" — ders 38); ajan eforları kurala uygun (m30-e2e high, m30-goc ve edm-eszamanli xhigh);
  disk 12 → 20 GB boş (bitmiş ajanların not defteri kopyaları tam yolla silindi — ders 24/36). (7) DERS 21: f013e57 / af751c5 (yalnız belge) hükmü ata 0c1ae0d'nin
  CI #860'ından okunur (sürüyor). (8) YORUM (kullanıcıya bildirildi): "giriş başarısızsa yeniden denenmez" yanlış kimlik / hesap kilitlenmesi içindir; koşu 1'de aynı
  kimlikle 19 giriş kabul edildi, 1'i eşzamanlılıktan reddedildi → koşu 2 ve 3 yeni planlı koşu sayıldı; betik giriş reddinde yine hemen durur (çıkış 2).
- GÖZDEN GEÇİRME 4 (kullanıcı, 22.10.2026 ~18:00 UTC: "anayasamıza ve derslere gözat tekrar"; GG3'ten beri): (1) DERS 26 METNİ ↔ UYGULAMA: çalışma dalına 13 yalnız-belge
  push (hepsi BELGE_YOLLARI; 13.10 kararıyla CI başlatmaz, Stop kancası gönderilmemiş commit'te durur); ders 26 "yalnız belge değişikliği kodla birlikte gönderilir" der →
  kullanıcıya soruldu: ders 26'ya "BELGE_YOLLARI içindeki belge tek başına gönderilebilir; dışındaki (kanıt, testin okuduğu belge) kodla birlikte" açıklaması. (2) DERS 21/1:
  CI #861 (158d9c0, aday 6 birleşimi) e2e KIRMIZI — senaryo-personel-244 12/23 (yerel kapıda 64/64 geçmişti); aday kök neden: testin `.hof-modal-backdrop.is-visible:last-of-type`
  seçicisi body'ye pencereden sonra eklenen bir div ile boşa düşer, açık kalan form sonraki tıklamaları yutar (zincirleme 11 kırmızı); yerelde yavaşlatılmış + tanılı koşu
  sürüyor (ders 20/38), Windows işleri okunacak; çalışma dalının hükmü bu arada KIRMIZI. Kök neden doğrulanınca ders 39 adayı (konuma bağlı seçici). (3) VERİMLİLİK: CI
  günlüğü iki kez büyük kuyrukla okundu (çoğu aynı satırlar) → bir kez, dar; tanı eki ilk koşuda kendi hatasıyla düştü (playwright yolu) → bir koşu boşa. (4) KOddan/EKRANDAN
  DOĞRULA: gezintide bir gözlem ("resmî unvan yalnız bildirimde") ekranın düğmeleri okunmadan söylendi, aynı adımda düzeltildi ("Unvanı Bununla Değiştir" var); sürücünün
  alan kayması ürün bulgusu sanılmadan ayıklandı → gezinti bulgusu ekranın tamamı (düğmeler dahil) okunduktan sonra yazılır. (5) ZAMAN: yeni maddeler (30a, 30b, 30d G1–G6)
  ve CI #861 → aday 7 kapısı ~1,5–2 sa kayar (kullanıcıya bildirildi). (6) TEMİZ: 27 commit (bütün dallar) model adsız, satırlar tam; uzakta yalnız çalışma dalı; parola
  dosyada/geçmişte yok; ajan eforları kurala uygun (30a high, 30b high, 30d medium); ajan raporları ham kanıttan denetlendi (m30-e2e, m30-goc, 30b; kırmızı nedenleri
  iletide — ders 16/38); disk 18 GB; kullanıcının her sorusu/kararı Açık iş'te; ders 18 ikinci gerçek EDM yeşili alındı; kalite çıtası gezintisi yapıldı.
  İSTEK (~17:50 UTC: "diğer çalışan ajanlar durdu, sorun mu var?") → hayır: 30a/30d e2e'lerini ortak kilit sırasıyla bekliyor (ders 15); 30b bitti.
- SORU → 5 dk YETKİSİYLE UYGULANDI (22.10.2026 18:50 → 18:56 UTC; 30e ajanının kapsam dışı bulgusu, ana oturum koddan doğruladı — server/lib/reports.mjs nakitAkis yalnız
  tarih, Sayfa ve Sekme; client/assets/hof-reports.js süzgeç formu bütün rapor türlerinde aynı): Tablodaki Nakit Akışı "Kişi / Kimlik", "Durum", "En Az Tutar"
  süzgeçlerini gösteriyor ama uygulamıyor (2.4.3'te de; ders 11). ÖNERİ (en yaygın: nakit akışı şirket düzeyinde rapor; kişi bazı Vade Takip / Cari Ekstre'de):
  Nakit Akışı'nda bu üç alan gizlenir, Sayfa/Sekme kalır. Alternatif (yalnız Beklenen'e uygula; Gerçekleşen ve Kasa şirket geneli kalırdı) seçilmedi. Yanıt
  gelmedi → önerilen uygulandı: iş listesi 30f (30a ajanı, is/b1-kalan). TEYİT (kullanıcı, 22.10.2026 ~18:58 UTC: "önerin uygun").
- GÖZLEM (kullanıcı, 22.10.2026 ~19:25 UTC: "devam eden G1G3 arayüzü düzeltmeleri işi görünüyor") → işi bitmişti (f3c3f08 denetlendi, aday 7'de); ajanın e2e özetini izleyen
  `tail -f` iş bitince kapanmadığından görev açık görünüyordu → görev durduruldu (TaskStop), süreç kapandı. Ajan kurallarına (ajan-ortak.md, inceleme-ortak.md) eklendi:
  izleme komutu ilk eşleşmede kendiliğinden biter (`grep -m1`).
- SORU (22.10.2026 ~21:06 UTC, 31c yargıç bulguları; 5 dk kuralıyla kullanıcıya soruldu): Y5 — windows.yml (gerçek Windows) yalnız master push'ta/elle koşar; 2.4.4'ün
  Windows'a özgü değişiklikleri (madde 6 hosts engeli, lisans nöbetçisi) gerçek Windows'ta hiç koşmadı → ÖNERİ PR'dan önce çalışma dalında elle iki koşu (ders 18,
  ücretsiz). Y16 — CLAUDE.md ölçek koşusu (10/20 kullanıcı, 100.000 satır) "temel sürümde"; iş listesinde yok → ÖNERİ 2.4.4 yama sürümü sayılır (2.1.0 ölçümleri
  geçerli), ölçek koşusu temel sürüm 2.5.0'da (Devir). Yargıcın öbür bulguları (Y1 tam test CI #862'den, Y2 CI dışı 14 senaryo son adayda koşuyor, Y3 göç karşılaştırması
  yeniden, Y4/Y7/Y8 31e kapsamı iş listesinde, Y6 kâhin kural kaynağı depoya, Y10–Y15 teslim notları/kılavuz/CHANGELOG) ana oturumda.
  5 dk YETKİSİYLE UYGULANDI (21:12 UTC, yanıt yok): Y5 EVET (windows.yml PR'dan önce çalışma dalında elle iki koşu — iş listesi 32a); Y16 2.4.4 yama sürümü,
  ölçek koşusu 2.5.0'da.
- SORU (22.10.2026 ~21:14 UTC, 31d eleştirmen bulguları; ana oturum E1/E2/E5'i betikleriyle yeniden üretti; 5 dk kuralıyla kullanıcıya soruldu): E1 YÜKSEK —
  gönderim EDM'ye ulaşıp yanıt gelmeden program kapanırsa belge "Gönderilmedi" görünür; Yeniden Gönder 11048 → Hata, Sil numarayı yeniden verir (EDM'deki geçerli
  makbuz programdan düşer), Düzenle tutarı değiştirir (e-Arşiv'de 2.4.3'te de; e-SMM yolu yeni) → ÖNERİ 2.4.4'te: ağdan önce kalıcı "gönderim başladı" izi
  (kesintide Sonucu Belirsiz; Sil/Düzenle kapalı, Durum Sorgula önerilir) + 11048'de dönen numara belgeninse önce Durum Sorgula; E4 (iptal yanıtı kaybolunca süre
  dolduysa EDM'ye sormadan "süre doldu") aynı kalıpla. E6 — silinen kâğıt/fiş belgenin numarası yeniden veriliyor (Silinenler'den geri yüklenince iki belge aynı
  numara; 2.4.3'te de) → ÖNERİ numara kullanılmış sayılır (22.10 "verilmiş fiş numarası bir daha kullanılmaz" kararıyla aynı). E7 — "Yalnız Programda İptal" EDM'nin
  kabul ettiği belgede sunucudan 200 → ÖNERİ sunucu da K4'e göre yalnız belirsiz/portal taslağında izin verir. KARAR GEREKMEYEN düzeltmeler başladı: E2 (30a gerilemesi:
  Kalan hücresi boş satırda raporlar ayrışıyor — satır kuralı tek yardımcıda, boşsa Toplam), E3 ("Kalan Gün" gibi gün/adet sütunu borç sayılmaz), E5 (Personel'de
  iki kişi aynı kartı düzenleyince sessiz geri alma → 409 bayat yazım).
  5 dk YETKİSİYLE UYGULANDI (21:20 UTC, yanıt yok): E1 (+E4) 2.4.4'te, E6 numara kullanılmış sayılır, E7 sunucu K4'e göre → ajanlar is/e1, is/e67.
- SORU → 5 dk YETKİSİYLE UYGULANDI (22.10.2026 21:21 → 21:27 UTC; 31b mali müşavir: YÜKSEK yok, iki şirkette ~30 işlemin yevmiye/mizanı el hesabıyla kuruşu kuruşuna
  tuttu): 2.4.4'te — MM4 bırakılan kâğıt makbuzun PDF'i "Müşteri Fişi" diyor → Serbest Meslek Makbuzu + onay metninde 509 V.7 koşulu (arıza/bakımda matbu), "sonra
  yine e-SMM gönderebilirsiniz" kalkar; MM7/MM11 makbuz formu/PDF'i fatura dilinde → GİB e-SMM adları + Net Ücret; MM10 aynı matrah/oranda KDV 40,02 / stopaj 40,01
  → tek yuvarlama kuralı; MM1 yalnız metin ("gerçek kişide stopaj varsayılan uygulanmaz; tacir/serbest meslekse girin"); MM6 Nakit Akışı Kasa giriş bütün nakit
  hareketleri; MM3 Stopaj/Tevkifat Özeti satıştan iadeyi "bizim kestiğimiz" sayıyor → ters yön; MM8 yevmiye aynı gün sırası (ders 31). SONRAYA (2.4.5+): MM1 cari kartında
  "Stopaj Yapar", MM2 KDV mahsubu yapılmış ayda iptal uyarısı, MM5 aynı dosya no iki sekmede borç (kural kararı), MM9, MM12; 30.000 TL nihai tüketici engeli değişmez
  (mevzuat doğrulanamadı; kullanıcının mali müşavirine sorulur). ALT KARAR (21:28 UTC soruldu): bırakılan kâğıt makbuzun sonradan e-SMM olarak gönderilmesi kapansın
  (öneri; müşteri fişi değişmez). → 5 dk YETKİSİYLE UYGULANDI (21:34 UTC): bırakılan kâğıt makbuz e-SMM'e gönderilmez (kalıcı engel, nedeni görünür).
- CI #862 (50e3bd0 = aday 7) BÜTÜN İŞLER YEŞİL (22.10 ~21:40 UTC okundu): 7d, 24b, 30b, 30d, 30e, 30f çizildi; 30a (E2/U2 sürüyor) ve 30 (göç karşılaştırması
  düzeltmelerden sonra yeniden, yargıç Y3) açık.
- SORU → 5 dk YETKİSİYLE UYGULANDI (22.10.2026 21:34 → 21:41 UTC; 31f uzman UI/UX, ~95 adım, 111 ekran; U1'i ana oturum koddan doğruladı): (a) U2 (2.4.4 GERİLEMESİ,
  31a F4 ile): Tablodaki Kişiler söz tutarını ve aynı dosya no'nun Kalan'ını ayrı borç sayıyor (kapalı dosya 15.000; toplam 98.000 → 198.500) + MM5 + U8 → borç DOSYA
  NO başına tek kaynaktan (Kalan Borç), aynı dosya no farklı sekmede aynı kayıt, söz borç değil, 5b ön dolumu aynı kural (is/e23). (b) U1 YÜKSEK (2.4.3'te de): "Nihai
  Tüketici" 11111111111'li EN ESKİ cariyi seçiyor (adı belli kişiye borç) → kendi işaretli carisi, adı belli caride 11111111111 uyarısı (is/u1). (c) 2.4.4'te U3 tablo
  raporu çıktıları kendi adıyla + TOPLAM + bölünmeyen tutar + yerel tarih (is/mm-rapor), U4+U6 makbuz kartı "iade" metni + e-Arşiv/e-SMM tür notu görünür + onayda tür
  adı (is/mm-smm), U5 600 TL'de yanlış "gerçek alıcı gerekir", U7 odak kayıpları, Personel Türkçe arama, Veriyi Sıfırla kırmızı, Seçilenleri Gönder güvenli odak,
  UX17 kısmi ödenmişte kalan (ui-son, mm-smm'den sonra); SONRAYA dar pencereler, ad/yazım ayrıntıları, UI11 küçükleri.
- SORU → 5 dk YETKİSİYLE UYGULANDI (22.10.2026 23:22 → 23:28 UTC; e23 ajanı U2 kuralını genişletmişti: tek tutar sütunu taksit/kira/aidat/ücret/"Ödenecek" ise borç
  sayılmıyordu → okul servisi "Aylık Ücret" tablosu Tablodaki Kişiler'de boş, "Ödenecek" borç değil; 2.4.3'te ikisi de borçtu) → DARALTILDI: yalnız Ödeme Sözü tutarı borç
  dışı; öbür tek tutarlı tablolar 2.4.3'teki gibi borç (Türkçede "Ödenecek" çoğu zaman kalan borç; müşteri tabloları sessizce boş görünmesin). Kalan Borç önceliği,
  Kalan boşsa Toplam, gün/adet dışlama, dosya no başına tek kayıt, MM6 aynen. KARARLAR (baş mimar): MM8 yevmiye aynı gün sırası belge → tahsilat/ödeme (yaygın düzen);
  MM10 GERİ ALINDI (plan modeli + kâhin: KDV kalem, stopaj belge düzeyinde; çok kalemli makbuzda ≤ 1 kuruş fark — BİLİNEN SINIR/açıklama); makbuzda kronoloji engeli
  "Kâğıt Makbuz Olarak Bırak" önermez (V.7); "Şirketi Sil" de kırmızı (G6 kalıbı); kısmi makbuzda "Makbuz Tutarı (Net)" etiketi (mali müşavirce teyit — teslim notu);
  birden çok TOPLAM satırlı raporda yapışkan satırların üst üste binmesi (2.4.3'ten) SONRAYA.
- SORU → 5 dk YETKİSİYLE UYGULANDI (23.10.2026 01:20 → 01:26 UTC; 31a kâhin tur 2 İNCELE 1, ana oturum koddan doğruladı — invoices.mjs uncertainLocalCheck → iptal-suresi.mjs
  attemptWindow e-Faturada null): sonucu belirsiz e-Faturada "Yalnız Programda İptal" EDM'ye hiç sormadan yapılıyordu (alıcıya ulaşmış e-Fatura programda "İptal"; 22.10 kararı
  e-Arşiv/e-SMM için yazılmıştı) → e-Faturaya da aynı kural: son gönderim girişiminden 8 gün geçtiyse önce EDM durum sorgusu (bulunamadı → serbest, var → reddedilir, ulaşılamadı →
  reddedilir); 8 gün içinde K4 çıkışı + e-Faturaya uygun ileti; e-Faturanın normal iptali değişmez. Alternatif (her zaman sor) seçilmedi: EDM'ye ulaşılamayınca K4 çıkışı kapanırdı.
  Ajanlar: ürün is/efatura-iptal (af758d0efa275c16f), kâhin kuralı ayrı elden is/kahin-244 (a273b1175b2d0e124). Kâhin tur 2 sonucu (31a): BULGU yok; İNCELE 2 (30.000 TL
  sınırı stopaj/tevkifat düşülmüş tutara mı vergiler dahil toplama mı — kâhinde çatal; teslimde BİLİNEN SINIR, mali müşavire sorulur); İNCELE 3 (yalnız API: Seçilenleri
  Gönder'e Silinenler'deki belge → boş sonuç kodu) SONRAYA. Aday 8 kapısı KIRMIZI (3276/3279: fatura-217 E6 beklentisi ×2, banka-210-altin U3 PDF yerleşimi; ürün hatası
  değil, testler bilerek güncellendi); aday 9 (6dc52d6) tam npm test 3283/3283, e2e sürüyor. SONRAYA: altın testin m6 kuralı "…"dan sonra her metni kabul ediyor.
- BULGU G1 (23.10.2026 ~02:15 UTC, madde 30 göç ajanı ae9ec21f91121d745, v2.4.3'te de yeniden üretildi; karar gerekmez — v2.0.13 kilit kuralı): Silinenler'den geri yüklenen
  kapanmış dönem tarihli fatura 200 dönüyor (beklenen 409); ardından Mutabakat Testi period-lock, aynı oturumda sonraki işlemler 2.4.3'te 409 ledger-integrity, 2.4.4'te 500
  gate-equivalence (yeniden açılışta geçer). Neden: server/routes/trash.mjs fatura kolu restoreDate çağırmıyor (tahsilat/Kasa/taksit çağırıyor), invoices.mjs restoreDeleted'da
  kilit yok. Düzeltme is/g1-kilit (af758d0efa275c16f, taban aday 10 247d6a7) → aday 11 tam kapı + göç son koşusu. Aday 10 (6e360c0: + e-Fatura belirsiz yerel iptal + kâhin
  K41b) npm test 3293/3293, 3/64 e2e yeşil, kapı bu yüzden durduruldu. Göç (aday 9): olcu/goc/fark 100/100/donus 6/6/kesinti 79/79 GEÇTİ; tatbikat C9 kırmızısı ARAÇ (geri
  yüklemede olay sayacı bilerek geri gitmez → sistemin yeniden yazdığı POS gün sonu yeni numara alır; iki sürümde aynı).
- İSTEKLER (kullanıcı, 22.10.2026 ~14:00–14:50 UTC; hepsi yanıtlandı): "18 numarada portalda ben ne yapacağım" → elle kabul adımları iş listesi 18 (teslimde
  kurulumla); "kalan işler için zaman çizelgesi, aynı anda yapılanları tek süre say" → verildi (devam notu ZAMAN ÇİZELGESİ); "compact talimatı vereceğim, veri kaybı
  olmasın" → devam notu 00 + ajan kayıtları yazıldı ve gönderildi (f013e57); EDM test hesabı ~14:45 UTC yeniden verildi (yalnız oturumda; dosyaya yazılmadı).
- İSTEK (kullanıcı, 22.10.2026 ~12:55 UTC: "aynı anda 20-30 tane esmm kesip edm'ye gönderip sonuçlarını kontrol eder misin") → iş listesi 24b: gerçek EDM test
  ortamında 30 e-SMM — A) 20 "Kaydet ve Gönder" AYNI ANDA, 3 kullanıcı oturumundan (VKN/TCKN alıcı karışık), B) 10 "Kes, Sonra Gönder" aynı anda → "Tümünü Gönder";
  sonra Durum Sorgula + 3 resmî PDF. Değişmezler kuraldan: 30 belge, tekil ETTN, TES ardışık/tekil, EDM'de her ETTN ve numara aynı, 5xx/askı yok; Login sayısı bilgi.
  Belgeler İPTAL EDİLMEZ (kullanıcı portalda bakacak). Düzeneği ajan yazar (tools/edm-gercek.mjs --eszamanli, kuru + zorla gecikme + hata enjeksiyonu), gerçek
  koşuyu ana oturum yapar (kimlik yalnız ortam değişkeninde); sonuç OZET.md kullanıcıya.
  SONUÇ 1 (16:41 TR): 19/20 Kaydet ve Gönder EDM'de kabul (TES2026412701048–066); 20 eşzamanlı Login'den biri EDM'ce reddedildi ("The caller was not authenticated
  by the service.") → belge numarasız Gönderilecekler'de, betik durdu (B gönderilmedi). KARAR (baş mimar): EDM girişi tek uçuş (edm.mjs) + gerçek koşu 2 (iş listesi 24b).
  SONUÇ 2 (17:07 TR, N4 düzeltmeli): 136/136, 30/30 kabul (TES2026475826020–049), Login 1; kullanıcı portalda gördü (17:12 TR). DERS 18 (GÖZDEN GEÇİRME 3): gerçek
  yeşil iki koşuda görülmeden 24b çizilmez → koşu 3 + tam takım gercek-6 (aday 6 kodu, dal is/gercek6; 22.10 ~14:56 UTC başladı).
- SORU (22.10.2026 ~16:50 UTC, madde 30 göç ajanı ae9ec21f91121d745 bulguları, yeniden üretildi; kullanıcıya baş mimar önerisiyle soruldu): B1 — madde 5b (7d51d60)
  "Kalan/Bakiye" sütununu ortak seçicide (server/lib/insight/dues.mjs classifyColumns) öne aldı; yan etkiyle hem Toplam Borç hem Kalan Borç sütunu olan tablolarda
  ödeme sözü, vade kalemi, zil, Tahsilat Takvimi, Vade Takip ve Nakit Akışı "Beklenen" tutarı Toplam'dan Kalan'a geçti (v2.4.3 163dd5d 11.500 → aday 6 7.600; 2.4.3
  verisinde 001'de 965 kayıt, 19.634.400 → 14.700.500 TL, Beklenen −5.593.000 TL); Tablodaki Kişiler (server/lib/reports.mjs:64, ilk eşleşen sütun) Toplam'da
  kaldı → aynı kişi iki yerde farklı tutar. ÖNERİ: Kalan Borç KALSIN (ödenmiş kısım tahsil edilecek görünmez; kodun kendi kuralı da "birden çok tutar sütunu varsa
  yalnız kalan borç" diyordu, 2.4.3 sütun sırasına bağlı eksikti) + Tablodaki Kişiler de aynı kurala + sürüm notu cümlesi + kırmızı/yeşil test + 31e dar kontrol.
  B2 — yedekten geri yüklemeden sonra, yedekten SONRA EDM'ye gitmiş e-Arşiv/e-SMM numarası ve verilmiş fiş numarası yeniden verilir; EDM 11048 ile reddeder
  (mükerrer e-Belge oluşmaz; canlı seride ileti "Fatura Ayarları → Numaralar'dan sıradaki numarayı ileri alın" der, test serisinde yalnız "ortak test hesabı");
  v2.4.3'te de aynı (gerileme değil). ÖNERİ: 2.4.4'te küçük güvence — geri yüklemeden sonra Fatura'da tek seferlik uyarı + 11048 iletisine geri yükleme
  olasılığı; EDM'den son numarayı kendiliğinden sorma 2.4.4 sonrası ayrı iş. BİLİNEN SINIR (karar gerekmez): 2.4.3 verisinde iki belgeye verilmiş 16 + 6 fiş
  numarası göçle düzelmez (v32 yalnız yeniden verilmesini önler).
  KARAR (kullanıcı, 22.10.2026 ~16:55 UTC: "1. önerin uygun ama 2. önerinde programın edm den otomatik kendi sorup ayarlaması daha kaliteli ve sağlam iş olur"):
  B1 öneri AYNEN (iş listesi 30a). B2 TAM ÇÖZÜM 2.4.4'te (iş listesi 30b): program serinin EDM'deki son numarasını (ve tarihini) KENDİSİ sorar ve seriyi ayarlar —
  geri yüklemeden sonra, EDM 11048 reddinde ve Fatura Ayarları → Numaralar'dan elle; taban yalnız YÜKSELİR, kronoloji tabanı da EDM'nin son belge tarihi; e-Fatura,
  e-Arşiv, e-SMM (test serileri dahil); kâğıt/fiş numarası EDM'de olmadığından eşitlenmez (geri yükleme notunda söylenir). e-Belge numarası + EDM bağlantısı → [XH],
  kırmızı test + mutasyon + 31e dar kontrol + gerçek EDM test ortamında (salt okuma) deneme (ders 18).
  KARAR DEĞİŞTİ (kullanıcı, 22.10.2026 ~17:00 UTC: "yedekten geri yükleyince aslında sık görülen bir durum değil, ilk önerin daha makul"): B2 = İLK ÖNERİ — geri
  yüklemeden sonra Fatura'da tek seferlik uyarı (yedekten sonra EDM'ye gönderilmiş e-Belge numarası ve verilmiş kâğıt/fiş numarası yeniden verilebilir; göndermeden
  önce Fatura Ayarları → Numaralar'dan sıradaki numarayı ileri alın) + 11048 iletisine (test ve canlı seri) geri yükleme olasılığı; numaralama mantığı DEĞİŞMEZ.
  EDM'den kendiliğinden eşitleme (GetInvoiceSerial / GetSMMSerial ya da belge listesi) 2.4.4 SONRASI ayrı iş.
  TEYİT (kullanıcı, ~17:05 UTC: "hayır" + "2.4.4 e girsin" → soruldu, seçti: "Yalnız küçük güvence"): 2.4.4'e yalnız uyarı + 11048 iletisi (30b, ajan çalışıyor).
- SORU (kullanıcı, 22.10.2026 ~17:20 UTC; gezinti ekranı "Başlarken"): "bu ekran eski kullanıcılar sürümü güncelleyince gelecek mi? istenir açılacak bir yer var mı" →
  YANIT (koddan, server/lib/getting-started.mjs + client/assets/hof-getting-started.js): kendiliğinden GELMEZ — 2.4.4 şirketin veri dosyasını ilk açtığında iş verisi ya da
  kaydedilmiş Fatura Ayarları varsa şirket "zaten kurulu" sayılır, liste hiç çıkmaz; yalnız boş şirkette, yalnız yöneticiye, açılış ekranında (pencere açılmaz).
  Elle: kullanıcı menüsü → "Başlarken" ve Hızlı Arama (Ctrl+K) "Başlarken" (yalnız yönetici); adım durumu veriden; "Gizle" kişi + şirket başına.
- SORU (kullanıcı, 22.10.2026 ~17:30 UTC: "butonların bazıları neden koyu yeşil bazıları beyaz") → YANIT (koddan, hof-getting-started.js:109): renk durumdan bağımsız
  sabit (company + seller hep koyu). ÖNERİ yalnız İLK EKSİK adım koyu. KARAR (kullanıcı: "uygun") → G4, 30d ajanına eklendi. AYNI İLETİDE: "şirketleri aç değil de şirket
  aç yazması gerekmez mi" → baş mimar görüşü soruldu: "Şirket Aç" Türkçede yeni şirket açmak/kurmak anlamına gelir (Şirketler'de "+ Yeni Şirket" ve 2 şirket
  sınırı var) → ÖNERİ "Şirket Adını Yaz" + doğrudan ad değiştirme penceresi. KARAR (kullanıcı, ~17:45 UTC: "önerin uygun") → G5, 30d ajanına eklendi.
- SORU (22.10.2026 ~17:55 UTC, 30b ajanının kapsam dışı bulgusu, ana oturum koddan doğruladı; kullanıcıya baş mimar önerisiyle soruldu): Yönetim → Şirketler →
  Verisini Sıfırla'daki "Fatura Serisi Sayaçları da Sıfırlansın" kutusu (admin.js:1586, 2.0.17'den beri) yalnız TAHSİLAT MAKBUZU sayacını (plans.receiptSeq,
  app.mjs:655) siler; fatura/fiş serileri kutu işaretsizken de baştan başlar (faturalar ve invoice.numberFloor silinir). Ad ↔ davranış uyuşmuyor; gerileme değil.
  ÖNERİ (B2 ile aynı ölçü — seyrek iş): 2.4.4'te kutunun adı "Tahsilat Makbuzu Numaraları da Sıfırlansın" + altına tek cümle (fatura/fiş numaraları seride baştan
  başlar; e-Belge gönderdiyseniz Fatura Ayarları → Numaralar'dan sıradaki numarayı ileri alın); fatura serisini sıfırlamada koruma seçeneği 2.4.4 sonrası.
  KARAR (kullanıcı, ~18:00 UTC: "uygun") → G6, 30d ajanına eklendi (davranış değişmez, yalnız metin).

## Arşiv 23.10.2026 (2) — GÖZDEN GEÇİRME 6 (CLAUDE.md Açık iş'ten AYNEN taşındı)

- GÖZDEN GEÇİRME 5 (kullanıcı, 23.10.2026 ~04:50 UTC: "anayasamızı ve derslerimize göz gezdir"; GG4'ten beri): (1) "KISA TUTULUR": CLAUDE.md yine 84,7 KB → kapanan 20 Açık iş
  maddesi (GG1–GG4, 22.10 18:50 → 23.10 02:15 SORU/KARAR'ları, İSTEK'ler) `docs/GECMIS-KARARLAR.md` "Arşiv 23.10.2026"ya AYNEN (satır satır denetlendi: eksik 0) → 61 KB;
  özetleri "2.4.4 kararları — son aday turu". (2) VERİMLİLİK: aday 9–13 kapıları 5 kez e2e'den önce durduruldu (bulgular aday kurulduktan sonra geldi) → Verimlilik'e "ADAY
  KAPISI SON DALGADA" kuralı. (3) DERS 32: 31e kontrol turundan SONRA A1, A3/K45 ve kişi gruplama düzeltmesi girdi → aday 14'te bu üçüne dar kapsamlı bağımsız kontrol (xhigh;
  kâhinler zaten koşuyor, cari kâhini gruplama gerilemesini rastgele senaryoda yakaladı). (4) DERS 5: K43–K45 kâhin kural metinleri kısmen kodu yazan ajanın raporundaki
  "kâhin için kural" bölümünden alındı (kullanıcının E1 kararı + 31e bulgularıyla uyumlu, ama aynı el riski) → bundan sonra kâhin kuralı YALNIZ karar metninden ve bağımsız
  incelemecinin bulgusundan yazılır; kodu yazanın "kâhin için kural" bölümü kâhine iletilmez. K45'teki "süre dolunca sorulmaz" ayrıntısı benim yorumumdu (kararda yok) —
  gerçek bir küçük kusuru yakaladı, düzeltildi. (5) KALİTE ÇITASI: yeni ekran öğeleri (birden çok sekme notu raporda ve Takvim şeridinde, Nakit Akışı'nda yetkisiz Kasa notu,
  geri yükleme 409 iletileri, A3 iletisi) yalnız birim/API düzeyinde denendi → aday 14'te ekran gezintisi + ekran görüntüsü. (6) DERS 37/8: bütün e2e listesi en son aday 7'de
  (CI #862) koştu; son adayda 64 e2e + CI dışı 14 zorunlu. (7) KANIT: teslim notu adayları not defterindeydi (kapsayıcıyla gider) → iş listesi "Teslim notları"na taşındı.
  (8) YETKİ: kullanıcı döndü → 5 dk yetkisiyle verilen kararların özeti yanıtta verildi. (9) TEMİZ: GG4'ten beri 116 commit (bütün dallar) model adsız, Co-Authored-By +
  Claude-Session tam; uzakta yalnız çalışma dalı; EDM parolası dosyada / not defterinde / git geçmişinde YOK (tarama 0; yalnız komutun ortam değişkeninde); yalnız kendi
  görevleri durduruldu (TaskStop), yalnız temiz worktree'ler kaldırıldı (ders 36); ajan eforları kurala uygun (para/e-Belge xhigh); her düzeltmede kırmızı/yeşil + mutasyon +
  komşular; ajan raporları ham kanıttan (kanit JSON) denetlendi, T4/Y1/N1 ve gruplama gerilemesi ana oturumca yeniden üretildi (ders 16); disk 20 GB. (10) SAPMA (aynı gün): ana oturum yeni "ADAY KAPISI SON DALGADA" kuralını yazdıktan
  hemen sonra aday 14 kapısını dar kontrol bitmeden başlattı; ~2 dk sonra fark edildi, yalnız kendi görevi durduruldu (yarım kayıt yok). (11) KAPSAYICI 05:05 UTC'de yeniden
  başladı: göç ve dar kontrol görevleri kesildi, 30 dk rapor işi kayboldu → yeniden kuruldu (2e260437); ajanlar kaldıkları yerden sürdürüldü.- 31e DAR KONTROL (23.10.2026 ~03:00 UTC, bağımsız ajan, aday 11 88aaf09; ana oturum T4/Y1/N1'i v2.4.3 ↔ aday 11 yeniden üretti): T4 YÜKSEK (U2 gerilemesi: AYNI sekmede aynı
  Dosya No'lu satırlar tek kayıt sayılıyor — 3.900 → 1.700, takvim 4 → 2 kalem); Y1 YÜKSEK (Kasa yetkisi olmayan Nakit Akışı'nda Kasa girişini görüyor; MM6 genişletti,
  2.4.3'te de dar); E1-Y ORTA (Durum Sorgula "bulunamadı" ile eşzamanlı Gönder izi siliyor; 2.4.3'te de); T1 ORTA (Kalan'sız "Tutar + Tahsil Edilen" tablosu Tablodaki
  Kişiler'den düşüyor; 32.000 → 2.500); N1 ORTA (E6 sonucu: yanlış tarihli silinen fiş doğru eski tarihle yeniden kesilemiyor); İNCELE 11048 ETTN yankısı, E4 izi kesin
  retten sonra; mutasyon Y7 (m21 U5: değişmez ikinci savunma, test dişli — OKU-BENI "13/13" ölçüte aykırı, düzeltilecek), Y8 (M6q yaşıyor → olumlu test eksik).
  KARAR GEREKMEYENLER: T4 aynı sekme ayrı (2.4.3 gibi), Y1 yetki, E1-Y, İNCELE, Y8. SORU → 5 dk YETKİSİYLE UYGULANDI (03:07 → 03:12 UTC): (a) farklı sekmede aynı Dosya No
  bir kez (U2 aynen) + raporda görünür not; (b) Kalan sütunu yoksa borç = Tutar − Ödenen, tek yardımcı, bütün raporlar aynı; (c) silinen fişin numarası kullanılmış, tarihi
  sıra-tarih denetimini bağlamaz, sırayı bozan geri yükleme 409. Alternatifler seçilmedi: (a) 2.4.3 gibi ayrı (kopya sekmede çift sayım). Ajanlar: is/r31e-rapor
  (a4c6a5adce2fe84a1), is/r31e-n1 (af758d0efa275c16f), is/r31e-e1 (aa6d8a7ea376869f6), kâhin kuralları karar metninden (a273b1175b2d0e124). Aday 11 npm test 3301/3301,
  kapı e2e'den önce durduruldu → ADAY 12 + tam kapı + göç son koşusu + 31e kontrol turu (Verimlilik: yeniden üretilmiş bulgu → düzeltme + bir kontrol turu).- 31e KONTROL TURU 2 (23.10.2026 ~04:00 UTC, aday 12 2fd232a): T4, T1, Y1, N1, E1-Y, Y8 KAPANDI (yeni sayılarla, v2.4.3 ↔ aday 12). Yeni: A1 ORTA ((a) kararının yan etkisi: dönem
  sekmesinin vade kalemleri Tahsilat Takvimi / zil / Ödeme Sözü'nde notsuz düşüyor — 2026 aidat hatırlatması gelmez), A2 ORTA (Sekme süzgecinde tahsilat başka sekmenin kaydına;
  2.4.3'te de → BİLİNEN SINIR), A3 DÜŞÜK (eşzamanlı Durum Sorgula iletisi yanlış), A4 DÜŞÜK (taksit sayısı sütunlu tabloda kalan ilk taksit gününe; 2.4.3 kuralı → BİLİNEN SINIR).
  SORU → 5 dk YETKİSİYLE UYGULANDI (04:04 → 04:09 UTC): A1 = ÖNERİ A — FARKLI sekmede aynı Dosya No AYRI borç ve AYRI vade kalemi (2.4.3 gibi); raporlarda ve Takvim'de "N dosya
  no birden çok sekmede; ayrı sayıldı" notu ((a) kararı DEĞİŞTİ; söz tutarı borç olmadığından söz sekmesi çift saymaz). Alternatif B (bir kez + Takvim notu; 2026 kalemleri
  Takvim'de görünmezdi) seçilmedi. Ajanlar: is/r31e-a1 (a4c6a5adce2fe84a1), is/r31e-a3 (aa6d8a7ea376869f6; A3 iletisi + K45 iptal izi süre dolunca kesin yanıtla kapanır — kâhin
  aday 12k'da 26/27, tek fark bu), kâhin K2 (a273b1175b2d0e124). Gerçek EDM (23.10 ~03:40 UTC, kullanıcı test hesabını yeniden verdi — yalnız oturumda): tam takım 52/52 +
  GetSMMStatus kendi ETTN'ini taşıyor. → ADAY 13 (aday 12 + is/kahin-244 + A1 + A3) tam kapı + kâhinler + göç + CI dışı 14.- ADAY 13 → 14 → 15 (23.10.2026 04:35 → 06:00 UTC): aday 13 (f24bc41) npm test 3329/3329, kâhinler e-Belge 27/27 · defter 176 · tutar 3559 · cari 1953/1967 → cari kâhini
  GERİLEME yakaladı (Tablodaki Kişiler'de ad tekrarı yüksek sekmede kişi ikiye bölünüyor; kök neden 36830cd 31a F4; ana oturum v2.4.3 ile yeniden üretti) → is/r31e-ad 95ac3d1
  + kuruş toplamı 31cb7a3 → ADAY 14 (9b0f520): cari kâhini 1967/1967; göç tam takım BULGU 0 (fark 100/100, tatbikat 46/46 C11k dahil, dönüş 6/6, kesinti 79/79, zincir 185 + 104).
  31e KONTROL TURU 3 (ders 32; aday 14): A1/A3/K45/gruplama/kuruş sorunsuz; yeni C1 ORTA (sekme süzgeçli Vade/Nakit'te başka sekmenin tahsilatı kalemi kapatıyor; 9c44652
  gerilemesi), C2 DÜŞÜK (kuruş altı hücrede özet ↔ TOPLAM 1 kuruş), C3 ORTA (aynı ad farklı TCKN tek grup) — C1/C3 ana oturumca yeniden üretildi; karar gerekmedi (C1 2.4.3
  yolu, C3 farklı kimlik = farklı kişi) → is/r31e-c 17cc5f4 (kırmızı 6/27 → yeşil, mutasyon 3/3, komşu 891/891, kâhin-cari 1967, 6 e2e). YAN BULGU (sürüyor, a4c6a5adce2fe84a1,
  aynı dal): istemci Excel'i ham sayıyla okuyor (sheet_to_json raw), insight/validators.mjs parseAmount "12.125" gibi tam 3 ondalıklı SAYIYI binlik sanıyor → 12125 (1000 kat);
  düzeltme: sayı türündeki hücre sayı olarak alınır, Türkçe yazım tahmini yalnız dizgede; v2.4.3'te de var mı ajan bakıyor. SONRA: ADAY 15 = aday 14 + is/r31e-c → dar kontrol
  (yalnız C1–C3 + sayı hücresi betikleri) + kâhin-cari + kısa göç farkı → TAM KAPI (aday-kos.sh + cidisi-kos.sh) → ekran gezintisi → çalışma dalı + CI → windows.yml ×2 →
  Uzun Doğrulama ∥ paket → teslim → PR.- İSTEK (kullanıcı, 23.10.2026 ~06:00 UTC: "compact talimatı vereceğim, hazırlığını yap") → devam notu 00 "GÜNCEL (23.10 ~06:00 UTC)" + bu madde yazıldı ve gönderildi; ajan
  kimlikleri devam notunda.- KARAR (kullanıcı, 23.10.2026 ~05:48 UTC; "pek bir ilerleme olmamış biten işlerde" üzerine sorulan dondurma sorusu): "B" — aday 15'ten sonra da DONDURMA YOK; her yeniden üretilmiş bulgu (v2.4.3'te de olsa, ORTA/DÜŞÜK da olsa) düzeltilir ve yeni aday açılır. Önerilen (A: yalnız 2.4.4 gerilemesi + YÜKSEK para hatası adayı açar) seçilmedi. Hız için: ekran gezintisi aday 14'te paralel başladı (yeniden koşulabilir betik scratchpad/ekran-g/kos.sh; aday 15'te yinelenir); Verimlilik "ADAY KAPISI SON DALGADA" sürer.- ADAY 15 (23.10.2026 ~06:15 UTC; /home/user/wt/aday15 0e539a4 = aday 14 + is/r31e-c edfff71 + is/goc9): birleşim dar 35/35, cari kâhini 1967/1967, göç kısa fark 100/100 BULGU 0 (is/goc9 b7d85db). 31e DAR KONTROL (aday 15): C1/C2/C3 KAPANDI; sayı hücresi 8 değer × 6 yol kurala uygun. YENİ D1 ORTA (gerileme, 17cc5f4 C3): reports.mjs personIndex keyOf kimlik varsa ada bakmıyor → AYNI kimlikli FARKLI adlar Tablodaki Kişiler'de tek kişi (6 → 3; ör. nihai tüketici 11111111111); ana oturum koddan + ham çıktıdan doğruladı; karar gerekmedi (C3 metni: kimlik yalnız aynı adı ayırır). NOT'lar (B kararıyla düzeltilecek): cari içe almada 0,005 açılış yazılmıyor (EPS eşiği); "1,234.56" money.mjs ↔ validators farklı. → is/r31e-d (a4c6a5adce2fe84a1); cari kâhinine karar metninden kimlik/ad kuralı (a273b1175b2d0e124; kâhin D1'i kaçırmıştı). Sonra ADAY 16.- D1 → V1/V2 (23.10.2026 ~06:40 UTC): is/r31e-d 3e04e9b D1/N1/N2 (kırmızı 4, yeşil 39/39, mutasyon 3/3, komşu 1013, kâhin-cari 1967, e2e 8/8; ana oturum kanıttan denetledi). Yan etki: aynı kimlikli farklı yazım ("A. Can Er" / "Can Er") iki kişi (v2.4.3 gibi) → SONRAYA: sağlama tutan, yer tutucu olmayan kimlikte farklı yazım birleşsin. Cari kâhinine C3 kuralları karar metninden (c3300c0; aday 15 KIRMIZI 92 fark, hepsi D1). Kâhinin İNCELE'leri: V1 "Vergi No" başlıklı, sağlama tutmayan sütun TUTAR sanılıyor (columns.mjs; ana oturum yeniden üretti) → kimlik/numara başlıklı sütun tutar sayılmaz, sağlama tutmayan değer gruplamada kimlik sayılmaz; V2 BAŞ MİMAR KARARI: iki kimlikli adın kimliksiz satırı aynı Dosya No'lu kimlikli satırın kişisine katılır, yoksa ayrı. İkisi is/r31e-d'de (a4c6a5adce2fe84a1); kâhine aynı kurallar karar metninden (a273b1175b2d0e124). Ayrıca is/toast-tire (bildirimde "e-Belge" kısa çizgiden bölünmesin; a4d82302457ab587f). Sonra ADAY 16 = aday 15 + is/r31e-d + is/toast-tire + is/kahin-244.- ADAY 16 (23.10.2026 ~06:40 UTC; /home/user/wt/aday16 6abad84 = aday 15 + is/r31e-d dcb76c0 + is/toast-tire db4095f + is/kahin-244 f7476db): birleşim dar 43/43, cari kâhini 2745/2745 (ana oturum koştu), ekran gezintisi 124/124 (kanıt 624810b). 31e DAR KONTROL: D1/V1/V2 KAPANDI; YENİ E1 ORTA (V1 gerilemesi: sağlamasız "Vergi No" kayıt kimliği adayı olunca 2.4.3 tablosu "Yerine koy"da anahtar değiştiriyor, kayıt tahsilatı/notları kopuyor) → BAŞ MİMAR: V1 rolü kayıt kimliği adayı olmaz; E2 ORTA (T1 ailesi: Tutar + KDV + Genel Toplam tablosu Tablodaki Kişiler'den notsuz düşüyor; 2.4.3 6.000 → 0) → vergi sütunları borç adayı değil, seçilemezse görünür not. SORU (06:43) → 5 dk YETKİSİYLE UYGULANDI (06:49): (A) Tutar + Genel Toplam birlikteyse borç GENEL TOPLAM (KDV dahil); (B) Tutar (2.4.3 gibi) seçilmedi. → is/r31e-e (a4c6a5adce2fe84a1), kâhine karar metni (a273b1175b2d0e124). Sonra ADAY 17.- E1/E2 → B1 (23.10.2026 ~07:30 UTC): is/r31e-e 6838d3e E1/E2 (kırmızı, yeşil 48/48, mutasyon 4/4, komşu 1049, kâhin 2745, e2e 702/702; ana oturum denetledi). Güncel kâhin (57de29a; karar A + kayıt anahtarı) is/r31e-e'de 2934/2936 → kalan 2 fark daha geniş bulgunun parçası. 31e TUR 6 (bağımsız; 21 yol × 3 sürüm çifti): B1 YÜKSEK (v2.4.3'te DE): Dosya No'suz tabloda satır içeriği değişince ya da kolon eklenince Yerine koy / Devamı olarak ekle / Sheets eşitlemesi kayda bağlı tahsilat, not, düzeltme, "Ödendi say", cari bağını SESSİZCE koparıyor (case_key = hücre parmak izi); B2 ORTA kimlik kolonu eklenince/silinince bağlar kopuyor, onay metni yanıltıcı; B3 DÜŞÜK Devamı olarak ekle çift kayıt; İNCELE var olmayan kayda tahsilat 200. KARAR (kullanıcı B: her bulgu düzeltilir; tasarım baş mimar): sessiz kopma yok; güvenli eşleşmede (aynı kişi değeri + tek eşleşme, ya da aynı konum + aynı kişi) bağ taşınır; eşleşmeyen için önizlemede adlı uyarı + onay, Sheets eşitlemesi bekletilir (yönetici onayı); eşleşmeyen veri silinmez; Devamı'nda çift görünen satır uyarısı. → is/r31e-b (xhigh, a9e1cd5e8d7dc429d, taban is/r31e-e); kâhine karar metni (a273b1175b2d0e124). Sonra ADAY 17 = aday 16 + is/r31e-e + is/r31e-b + is/kahin-244.- KULLANICI EKRANI (23.10.2026 ~07:20 UTC; soru "yerine koy butonu tam olarak nerede" → yanıtlandı: Ayarlar → Veri ve Eşitleme → Veri Ekle veya Değiştir → "Yeni veri" penceresi; kullanıcı kendi ekranında buldu): ekran görüntüsünde kolon eşleme ipucu "50 farklı değer: [object Object], …" (columns.mjs ~465 topValues nesnelerini join ediyor; 2.0.2'den beri) → is/kolon-ipucu (medium, ad1874f7a59c40639) → aday 17'ye girer. Kâhinin ek bulgusu (Devamı Olarak Ekle Dosya No'suz tabloda mevcut satırı aynı sıradaki başka kişiyle eziyor) B1 ajanına verildi.- ADAY 17 (23.10.2026 ~09:00 UTC; /home/user/wt/aday17 30e9c90 = aday 16 + is/r31e-b 9de331a [E1/E2 + B1–B3 kayıt bağı sürekliliği, a9e1cd5e8d7dc429d] + is/kolon-ipucu d603b33 + ci/release.yml'e senaryo-kayit-bag-31e): B1 kanıtı denetlendi (kırmızı 23/24, yeşil 27/27, mutasyon 14/14, v2.4.3 göç 46/46, komşu 1039, e2e 34/35 — tek kırmızı bilerek kırmızı üreten betik); birleşim dar 42/42, ekran gezintisi 124/124, eşleme penceresi ipucu ekranda (aday 16 [object Object] → aday 17 adlar), CI liste denetimi 54/54; cari kâhini netleştirmelerden sonra 3201/3201 (949ac68). KARARLAR (baş mimar, kâhin netleştirmesi): içeriği aynı satır mevcut kayıt (onay yok); Devamı'nda güvenli eşleşen satır güncellemedir; kişi bir tabloda birden çok satırdaysa konum eşleşmesi yok (uyarı + onay). 31e TUR 7 (aday 17): B1/B2/B3/E1/E2 KAPANDI; YENİ N3 ORTA (aynı adlı iki kişi yer değiştirip tutarları değişince bağ yanlış kişiye), N2 ORTA (hız: 20.000 satırda Yerine Koy 2,1 → 17,9 sn, eşitleme 2,0 → 61,8 sn, sunucu donuyor), N4 ORTA (tek tutar kolonu "Vergi Tutarı" → Kişiler'den notsuz düşüyor; KARAR: vergi kolonu yalnız başka tutar kolonu varken borç dışı), N5 ORTA ("Sheet'te Olmayanları Kaldır" bağları uyarısız koparıyor), N6 (DÜŞÜK etiketli, veri kaybı → ORTA: ölü anahtara belge/görev/düzeltme 200), N7 DÜŞÜK → SONRAYA (2.5.0): kişisiz tabloda uyarıdaki ad ilk hücre. N1 ORTA SORU (09:24) → 5 dk YETKİSİYLE UYGULANDI (09:30): (A) açık kimlikli (Dosya No) kayıtlar arasında bağ taşınmaz, eski dosyada kalır, onayda adıyla; (B) aynı kişinin bağları yeni dosyaya seçilmedi. TEYİT (kullanıcı, ~09:33 UTC: "a"). → is/r31e-f (a9e1cd5e8d7dc429d), kâhine karar metinleri (a273b1175b2d0e124). Sonra ADAY 18.- ADAY 18 (23.10.2026 ~10:30 UTC; /home/user/wt/aday18 983af10 = aday 17 + is/r31e-f [82e2791 N1–N6 + 26c452e b3g içerik ikizi] + is/kahin-244): N1–N6 kanıtı denetlendi (kırmızı 9, mutasyon 27/27, komşu 1061, göç 46/46, 7 e2e; hız 20.000 satır Yerine Koy 1,25×, eşitleme 1,36× aday 16); birleşim dar 92/92, gezinti 124/124, cari kâhini 3329/3335 (b3g: aynı adlı iki satırdan değişmeyenin bağı da düşüyordu — N3 eksiği, düzeltildi 26c452e) → 3335/3335. 31e TUR 8: N1–N6 KAPANDI (hız, eşzamanlılık, yarıda kesilme, 002, 20 rapor senaryosu aday 17 ile aynı); YENİ Y1 YÜKSEK (sparseDebtColumn "Borçlu Telefon"/"Borçlu TC"yi borç sayıyor: Kişiler'de 5,3 milyar TL; Takvim/Vade/Nakit/5b'de v2.4.3'ten beri) → KARAR: borç yalnız para kolonu; Y3 ORTA (v2.4.3'te de: seyrek Kalan'ı boş satır Kişiler'den notsuz düşüyor) → Kalan boşsa ana tutar, belirlenemezse not; Y2 (DÜŞÜK etiketli, bağ → ORTA) aynı adlı iki kişi telefonla ayrılmıyor → ad + telefon/kimlik tekse güvenli eşleşme. → is/r31e-f (a9e1cd5e8d7dc429d), kâhine karar metinleri (a273b1175b2d0e124). Sonra ADAY 19.- ADAY 19 (23.10.2026 ~11:45 UTC; /home/user/wt/aday19 a9f84b5 = aday 18 + is/r31e-f 34d3399 [975217f Y1–Y3 + 5b] + is/kahin-244 72b66ce): Y1–Y3 kanıtı denetlendi (kırmızı 10/11, kâhin 3511/3511, mutasyon 40/40, komşu 1179, e2e 9/9, göç 46/46); birleşim dar 82/82, cari kâhini 3511/3511 (ana oturum), gezinti 124/124. BAŞ MİMAR ONAYI: ay kolonlu / aylık ödemeli sekmede aylık ücret Açılış Bakiyesi sayılmaz (8871ccf kuralı; istisnasız hâli okul servisi Tablodan Aktar'ı bozuyordu). 31e TUR 9: Y1/Y2/Y3 ve bütün bağ bulguları KAPALI (78 yol sonucu aday 18 ile aynı; hız ≤1,45×; 22 tablo kararı senaryosu aynı); YENİ Z1 ORTA (975217f gerilemesi: tek vadeli taksit tablosunda Takvim/Vade/Nakit kalemi taksit yerine bütün Kalan — 1.000 → 9.000) → KARAR (baş mimar): takvim kalemi = min(dönem/taksit tutarı, Kalan); Kişiler ve Açılış Bakiyesi Kalan. → is/r31e-f (a9e1cd5e8d7dc429d), kâhine karar metni (a273b1175b2d0e124). Sonra ADAY 20.

## Arşiv 24.10.2026 (2.4.4 kapandı; CLAUDE.md Açık iş'ten AYNEN taşındı)

- 2.4.4 BAŞLADI (kullanıcı "başla", 22.10.2026 03:25 UTC); 30 dk rapor işi CronCreate 615db56b (kapsayıcı 04:36'da yeniden başladı, fc078609 silindi; 2.4.4 bitince
  silinir). GÜNCEL DURUM VE NASIL DEVAM: `docs/DURUM-VE-DEVAM.md` → "### 00. 2.4.4 SÜRÜYOR — DEVAM NOTU" (sıkıştırma sonrası ÖNCE o okunur). Çalışma düzeni: her iş
  grubu ayrı git worktree'de (/home/user/wt/<ad>, dal is/<ad>), ajan commit eder, ana oturum youthful-euler dalına birleştirir, testler + push + CI.
  DALGA 1 (22.10 ~03:35 UTC; ajan kuralları not defteri ajan-ortak.md — kapsayıcıyla gider): kucuk [M] 3,25,4 · test-altyapi [H] 6,27 · d2 [XH] 7 · esmm [XH]
  20,21 · sunucu [H] 28,29 · personel [H] 19. SONRAKİLER: kayit [XH] 5 (4'ten sonra) · fatura-ui [M] 9,10,13,14,UX16 · UI11 [H] 8 · UX9/UX10 [H] 11 · UX15 [XH] ·
  UX18 [XH] 15 · KÖ3 [H] 16 · E6 [XH] 17 · E7 [H] 18 · brüt [XH] 26 · esmm-2 [XH] 22,23 · esmm-3 [XH] 24 (gerçek EDM). Biten dalga birleştirilince iş listesinde üstü çizilir.
- GÖZDEN GEÇİRME 6 (kullanıcı, 23.10.2026 ~12:35 UTC: "anayasamızı ve derslerimize göz at"; GG5'ten beri): (1) DERS 5 → YENİ DERS 40: kâhin–program farkında beş kural netleştirmesi program davranışı görüldükten sonra verildi (gerekçeli; iş listesi "BAŞ MİMAR KARARLARI"nda kullanıcının gözden geçirmesine). (2) VERİMLİLİK "bir tur + bir kontrol turu": 31e turları 4–10 (7 tur) — kullanıcı kararı "B" (her bulgu) ve revizyonuyla bilerek aşıldı; döngü riski kullanıcıya soruldu → DURMA KURALI. (3) DERS 19: aday 17'de ci.yml commit'i `node --test … | grep … && git commit` ile denetim testi KIRMIZIYKEN atıldı (&& grep'in kodunu okudu); hemen fark edildi, release.yml eksiği eklendi, test 54/54 (aday dalı, gönderilmedi) → bundan sonra test çıktısı dosyaya, kod `rc=$?` ile ayrı. (4) KANIT/TESLİM: aday 15–20'nin sürüm notu cümleleri yalnız ajan raporlarında ve Açık iş'teydi → iş listesi "Teslim notları"na taşındı; eski bir BİLİNEN SINIR (Açılış Bakiyesi) düzeltildi. (5) KISA TUTULUR: CLAUDE.md 78,5 KB → kapanan 14 Açık iş maddesi (GG5, 31e DAR KONTROL/KONTROL TURU 2, ADAY 13–19, İSTEK, eski KARAR B, KULLANICI EKRANI) `docs/GECMIS-KARARLAR.md` "Arşiv 23.10.2026 (2)"ya AYNEN; özetleri "2.4.4 kararları — son aday turu 2". (6) KÖR NOKTA (kullanıcıya bildirildi): B1 kayıt bağı sürekliliği sürümün sonunda giren BÜYÜK bir değişiklik (yeni modül dataset-bonds.mjs, yükleme/eşitleme çekirdeği) → tam kapı + Uzun Doğrulama + kullanıcının kendi verisiyle kısa elle kabul (Yerine Koy / Devamı / eşitleme) önerilir. (7) TEMİZ: GG5'ten beri 83 commit (bütün dallar) model adsız, Co-Authored-By + Claude-Session tam; uzakta yeni dal yok (yalnız çalışma dalı gönderildi); yalnız kendi temiz worktree'leri kaldırıldı (16, ders 36); ajan eforları kurala uygun (kayıt bağı ve para düzeltmeleri xhigh, küçük UI medium; tablo borcu D1/E1/E2 high — sınırda, sonraki para düzeltmeleri xhigh ajanda); her düzeltmenin kırmızı/yeşil + mutasyon + komşu + göç kanıtı ana oturumca JSON'dan okundu, kâhin her adayda ana oturumca koşuldu (ders 16); disk 16 GB. EDM parolası bu bağlamda yok (sıkıştırmayla gitti) → dosya taraması parola değeriyle yapılamadı; parola hiçbir komuta bu dönemde verilmedi. (8) İSTEK kaydı: "düzeltme ne kadar sürer" (~09:40 UTC) yanıtlandı (tahmin), buraya yazıldı.
- KARAR REVİZYONU (kullanıcı, 23.10.2026 ~08:15 UTC: "çıkacak tüm bulguları düzelt kararımı revize ediyorum, yüksek ve orta bulguları düzeltelim, çıkacak küçük bulguları erteleme de sakınca olmazsa devir modülü sürümüne erteleyelim. anayasamıza uygunsa böyle yap") → yukarıdaki "B" kararının YERİNE: YÜKSEK ve ORTA bulgular 2.4.4'te düzeltilir (yeni aday); DÜŞÜK bulgular 2.5.0'a (devir sürümü) ertelenir, iş listesi "SONRAYA (2.5.0)" ve teslimde BİLİNEN SINIRLAR'a yazılır. ANAYASA DENETİMİ (baş mimar): uygun — karar ürün sahibinin; kalite çıtası ve kanıt kuralı aynen. SAKINCA SÜZGECİ (her DÜŞÜK için yazılı gerekçe): yanlış para/borç/bakiye, veri kaybı ya da kopan bağ, e-Belge/GİB/numara, yevmiye/defter, yetki/KVKK, 2.4.4 gerilemesi → "düşük" etiketli olsa da ERTELENMEZ (ORTA sayılır). Zaten yapılmış/sürmekte olan DÜŞÜK düzeltmeler (bildirim tiresi, B3) geri alınmaz.
- DURMA KURALI (kullanıcı, 23.10.2026 ~12:17 UTC; soru "sonsuz bir döngüye girmedik değil mi?" → tur sayıları 1/2/6/3/1 ve öneri verildi; yanıt: "önerin uygun ama yüksek ya da orta bulgu olursa düzeltilsin"): aday 20'den itibaren dar kontrol YALNIZ son düzeltmenin değiştirdiği kod + doğrudan komşuları (yeni alan taraması yok); çıkan YÜKSEK/ORTA her bulgu düzeltilir (v2.4.3'te de olsa); DÜŞÜK 2.5.0'a (sakınca süzgeciyle); her tur kullanıcıya sayılarla bildirilir.
- ADAY 20 (23.10.2026 ~12:25 UTC; /home/user/wt/aday20 c38d549 = aday 19 + is/r31e-f [9550df7 + a97cd52 Z1] + is/kahin-244 0f23768): Z1 kanıtı denetlendi (kırmızı 4/6, kâhin 3574, mutasyon 43/43, komşu 1182, 13 e2e, göç 46/46); birleşim dar 48/48, cari kâhini 3574/3574 (ana oturum), gezinti 124/124. BAŞ MİMAR KARARI (kâhin çatalı): satır borcu belirlenemeyen satırda (Aidat + Gecikme Faizi, Kalan boş) takvim kalemi dönem tutarı, Kişiler/Açılış Bakiyesi'nde not. 31e TUR 10 (durma kuralı: yalnız Z1 farkı + komşuları): Z1 KAPANDI; Z2 ORTA (v2.4.3'te de: eksi Kalan'lı satır dönem tutarıyla gecikmiş) → kalem yok; Z3 ORTA (v2.4.3'te de: taksit sütunlu tabloda söz kalemi taksit tutarı) → söz kalemi söz tutarı. → is/r31e-f (a9e1cd5e8d7dc429d), kâhine karar metinleri. Sonra ADAY 21 (dar kontrol yalnız Z2/Z3 farkı).
- ADAY 21 (23.10.2026 ~13:20 UTC; /home/user/wt/aday21 8def842 = aday 20 + is/r31e-f [7465080 + 007eb2e Z2/Z3] + is/kahin-244 27b2fb8): Z2/Z3 kanıtı denetlendi (kırmızı 4/4, kâhin 3632, mutasyon 46/46, komşu 1186, 13 e2e, göç 46/46). 31e TUR 11 (durma kuralı): Z2/Z3 KAPANDI; YENİ Z4 YÜKSEK (007eb2e gerilemesi: söz kalıbı soz\w* "Sözleşme Tutarı"nı söz tutarı sanıyor — söz kalemi 3.000 → 50.000, Nakit 12.800 → 153.300) → KARAR: söz tutarı yalnız "Söz/Ödeme Sözü/Taahhüt Tutarı", "Sözleşme…" söz değil. → is/r31e-f (a9e1cd5e8d7dc429d), kâhine karar metni. Sonra ADAY 22.
- ADAY 22 (23.10.2026 ~13:40 UTC; /home/user/wt/aday22 e5667af = aday 21 + is/r31e-f [26e6573 + b0ef5eb + e83b7ce Z4] + is/kahin-244 6bc10ff): Z4 kanıtı denetlendi (kırmızı 2/2, kâhin 3701, mutasyon 48/49 → eksik test eklendi, 3/3; komşu 1188, 13 e2e, göç 46/46); birleşim dar 56/56, cari kâhini 3701/3701 (ana oturum), gezinti 124/124. Kararlar: "Sözleşme Tarihi"/"Başlangıç" vade açmaz; "Sözleşme Bitiş" tutarsız Yaklaşan satırı (v2.4.3'te de, para değil) → SONRAYA 2.5.0. 31e TUR 12: Z4 KAPANDI; Z5 (DÜŞÜK etiketli, gerileme + beklenen tahsilat → ORTA: "Taahhütname Tarihi" söz sayılmıyor) → taahhüt ailesi önek; Z6 (v2.4.3'te de, para: "Söz Miktarı" söz tutarı değil) → "tutar" ya da "miktar". → is/r31e-f, kâhine karar metni. Sonra ADAY 23. Z5/Z6 TAMAM (is/r31e-f 96cadc0 + 63b28b4; ana oturum JSON'dan: kırmızı 2/2, tablo-borç 66/66, komşu 1192/1192, mutasyon 12/12, e2e 50/46/90/153, kâhin e5d2cda 3744/3744; kâhin aday 22'de 3736/3744 kırmızı — beklenen). Ajanın açık bulgusu: debt-column söz tutarı başlığı tam sözcük → yalnız "Taahhütname Tutarı" sütunlu sekme Kişiler'de borç 700, Takvim söz sayıyor (aday 22'de de) → SÜZGEÇ: borç tutarı → ORTA, ertelenmez. KARAR (A1 + Z5/Z6 metninden): söz tutarı sütunu tek tanım, iki yol aynı yardımcı, hiçbir yolda borç değil; "Taahhütlü Ücret" borç kalır. → aynı ajan (is/r31e-f) + kâhin senaryosu (is/kahin-244). TUR 13 TAMAM (f8e9ae4 + 40c9d99; JSON: kırmızı 2/2 aday 22 + 2/2 63b28b4, 8/8, komşu 1194, mutasyon 12/12, 9 e2e, göç 46/46, kâhin ee3111e 3789/3789). Ajan yorumu 1 ONAY (BAŞ MİMAR KARARI (9)); yorum 2 RED: yalın "Ödeme Sözü"/"Söz"/"Taahhüt" para kolonu artık borç olabiliyordu (aday 22'de dışlanıyordu) → gerileme + para → ORTA, TUR 14: söz ailesi başlığı tutar/miktarsız ve dönem sözcüksüzse borç adayı değil (A1). Kâhine (a)–(c) senaryoları: e546d4b (b3x) aday 22'de 3817/3845 (JSON okundu; b3x 14 beklenen fark). Kâhin kendi not okumasındaki deliği düzeltti (not artık satırın sekmesini adlandırmalı) → b3n'de YENİ: tutar kolonsuz "Takip" sekmesinin kişileri Kişiler'de yok, kendi sekmesine not yok (Y1 kararı: "satır görünür ya da görünür not") → yeniden üretilirse ORTA → TUR 15 (aynı ajan, tur 14'ten sonra ayrı commit). Sonra ADAY 23.
- DONDURMA (kullanıcı, 23.10.2026 ~14:42 UTC; soru "sürekli başa mı sarıyor bu testler?" → yanıt: başa sarmıyor, tam kapı hiç yeniden koşulmadı; son 4 tur (12–15) aynı alanda — başlık tahmini — her düzeltme yeni uç durum açtı, kâhine son iki turda yeni başlık türleri de denettirildi (durma kuralından sapma, baş mimarın hatası); öneri verildi → "onaylıyorum"): (1) tur 14 + tur 15 SON düzeltmeler; kâhine son düzeltmenin farkı dışında yeni senaryo EKLENMEZ. (2) Aday 23 → dar kontrol YALNIZ tur 13–15 farkı → tam kapı → paket. (3) Bundan sonra tablo başlığı/borç sütunu alanında yalnız GERİLEME (aday 22'de doğru olup bozulan) ve YÜKSEK bulgular düzeltilir. (4) Aday 22'de de var olan ORTA başlık durumları 2.5.0'a ertelenir, teslimde BİLİNEN SINIRLAR (Excel–para YÖN'ü bu alanı küçültür). Durma kuralının "ORTA da düzeltilir" kısmının bu alan için yerine geçer. ADAY 23 (~15:15 UTC; /home/user/wt/aday23 0c42a85 = aday 22 + is/r31e-f affe774 [tur 12–15] + is/kahin-244 e546d4b): tur 14 (2bcaa71, kendi gerilemesi f8e9ae4) ve tur 15 (26bb456, Y1 not eksiği) kanıtı JSON'dan okundu (kırmızı 3/3+3/3 ve 2/2+2/2, tur 8 beklentisi 1/4 eski kodda; yeşil 13/13, 102/102, komşu 1199, mutasyon 17/17 + 8/8, 9 e2e, göç 46/46, kâhin 3845/3845). Birleşim dar + kâhin + gezinti koşuyor; dar kontrol (aacb5253c1e83b520) YALNIZ aday 22 → 23 server/ farkı: gerileme + YÜKSEK. Aday 23 kanıtı (439eb2d): birleşim dar 102/102, kâhin 3845/3845, gezinti 124/124. 31e TUR 13 (dar kontrol): Z5/Z6/söz tutarı/not KAPANDI, YÜKSEK yok; YENİ GERİLEMELER (tur 13–14 farkından): R1 ORTA ("Taahhüt Alacağı"/"Taahhüt Bakiyesi" yalın söz sanılıyor — kalem boş, Nakit 25.900 → 19.000, bakiye 2.100 yok sayılıyor), R2 DÜŞÜK ("Taahhüt Miktarı (Ay)" söz tutarı: 5.000 → 12) → DONDURMA gereği ikisi de düzeltilir: TUR 16 (aynı ajan) + kâhin (7) yorumu aynı eksiği taşıyabilir (ders 5) → muafiyet Y1/N4/K3 metninden. Kâhin 64eead7 (b3y) aday 23'te 3869/3883 (JSON okundu; önceki 3845 denetimde kâhin çıktısı bayt bayt aynı). ÇAKIŞMA: b3y (b) "Taahhüt Bakiyesi" Kalan sayılmalı — ürün v2.4.3'ten beri tanımıyor (2.5.0 adayı 2, DONDURMA) → kâhin beklentisi DEĞİŞMEZ; kâhine BİLİNEN SINIR listesi (tam kontrol adı + karar kaynağı + program değeri; ayrı yazılır, başarısız sayılmaz; kapanan/değişen kayıt BAŞARISIZ) — CI yeşil kalır, fark gizlenmez; teslimde BİLİNEN SINIRLAR (kâhin 83c3bd1 + 4e68411; liste mutantları 5/5). TUR 16 TAMAM (23cf851 + 43224dd; JSON: kırmızı 2/2 aday 23, yeşil 15/15, komşu 1201, mutasyon 9/9, 9 e2e, göç 46/46; kâhin 3873/3883 — kalan 10 fark yalnız b3y "Taahhüt Bakiyesi", aday 22'de de aynı). Tek aday 22 farkı: "Taahhüt Alacağı" tek tutar sütunu → Kişiler'de borç (onaylı tur 13 kuralı / BAŞ MİMAR (9) sonucu). ADAY 24 (/home/user/wt/aday24 550c2b0 = aday 23 + is/r31e-f 43224dd); kâhin BILINEN kayıtlarını aday 24 değerleriyle güncelliyor; dar kontrol tur 14 yalnız aday 23 → 24 server/ farkı. Kâhin d930959 aday 24'te 3883/3883 (11 bilinen; liste dışı 0; eski listeyle deneme "BİLİNEN DEĞİŞTİ" düştü) → aday 24'e birleşti (998bacd). 31e TUR 14 (dar kontrol): R1/R2 KAPANDI, yeni bulgu YOK (gerileme 0, YÜKSEK 0); "Toplam Taahhüt"/"Söz Bakiyesi" Kişiler'de borç (onaylı borç ailesi kuralı). DURMA: açık bulgu yok. Aday 24 kanıtı (3525c25): birleşim dar 104/104, cari kâhini 3883/3883, gezinti 124/124. TAM KAPI BAŞLADI (~16:00 UTC; <nd>/aday24-tam.sh: aday-kos.sh 24 [npm test + ci.yml 65 e2e] → cidisi-kos.sh 24 [14] → defter/tutar/e-Belge kâhinleri; çıktı <nd>/aday24-tam.out). Sonra: kanıt aday24 dalına → çalışma dalına merge → push → kanit.mjs ci --bekle 120. TAM KAPI KIRMIZI (~16:30 UTC): npm test 3438/3439 — banka-210-post-statik K6 "para tablosuna yazan her yer bank.post içinde": dataset-bonds.mjs move() payments.case_key UPDATE'i kapanışta (bank.post op assign çalışma zamanında doğru, sözcüksel değil) — B1 (aday 17) tam kapıdan hiç geçmemişti (aday 15–24 yalnız dar). İzinli liste "bag" denendi → testin 4. denetimi reddetti (payments.case_key para bağı) → test GEVŞETİLMEZ; düzeltme a9e1cd5e8d7dc429d is/r31e-f (sözcüksel bank.post + çalışma zamanı testi) → ADAY 25 (/home/user/wt/aday25 d8aa7f6 = aday 24 + is/r31e-f 6908b5b [cfb1405 K6]; JSON: statik eski kodda 5/6, yenide 6/6; çalışma anı K6 testi; B1 38/38; komşu 1208; mutasyon 3/3; 2 e2e; göç 46/46; birleşim dar 40/40 a38dbb5). 31e TUR 15 (dar kontrol): davranış AYNI (39+39 yol, k-ozel 9/9, k-kaldır 6/6, bank.post izi aynı), yeni bulgu YOK. TAM KAPI 2 BAŞLADI (~16:45 UTC; <nd>/aday25-tam.sh → <nd>/aday25-tam.out). TAM KAPI 2 YEŞİL (~18:30 UTC; kanıt aday25 02c795c; ana oturum çıktıdan okudu): npm test 3440/3440, ci.yml e2e 65/65, CI dışı 14/14, kâhinler defter 176/176, tutar 3559/3559, e-Belge model 114/114 + mutasyon 55/55 + senaryo 27/27 — hepsi çıkış 0. Çalışma dalına birleşti 432beb0 (kod aday 25 ile aynı) ve gönderildi; CI #863 432beb0 YEŞİL (ana oturum kanit.mjs ci: Linux 22/24, Windows 22/24, Uçtan uca, Doğrulama Kapısı, Dağıtım paketi) → iş listesi 30, 30a, 31, 32 çizildi. 32a windows.yml ×2 tetiklendi (~19:32 UTC, c928d15 = kod 432beb0): koşu 40012156441 (#51) + 40012160327 (#52). 33 UZUN DOĞRULAMA tetiklendi aynı anda (40012183423, #586; ~6 saat; plan alt sınırları varsayılan 5000/10000). 34 hazırlık: Wine 9.0 + mingw windres kuruldu; windows #51 YEŞİL; teslim belgeleri is/teslim-244b 48ad251 (DEGISIKLIKLER 3. bölüm aday 15–25 + BİLİNEN SINIRLAR + 2.5.0 + DENENEN/DENENMEYEN + BAŞ MİMAR (1)–(10); CHANGELOG bir cümle; kılavuz "Borç Sütunu Nasıl Tanınır" + "Aynı Tabloyu Yeniden Yüklemek"; belge testleri 106/106, pdf-denetle 39/39 kopyada) — PAKET COMMIT'İYLE birleşir: UD/windows sonuçları DENENEN'e, kılavuz PDF'i yeniden üretilip client/kilavuz'a (ders 26: tek push); paket UD + windows ×2 yeşil olunca (kırmızıda kod değişir → paket yeniden). Sonra 32a windows.yml ×2 → 33 Uzun Doğrulama ∥ 34 paket → 35 teslim.
- AÇIK (24.10.2026 ~04:30 UTC): CI #864 084fa8a (kod = 432beb0 + kılavuz PDF) "Uçtan uca" KIRMIZI — senaryo-banka-210 420/421, adım 15 "İşlem No ile arama" sonrası waitForFunction 10 sn zaman aşımı (Linux ×2 + Windows 24 yeşil). CI çıktısı adım 1–15 yerelle aynı (İşlem No BNK-2026-000011). Ürün okundu: HOF.listGate eski yanıtı yazmaz, keepFocus odaktaki arama metnini korur. Yerel 8 koşu YEŞİL 424/424: normal ×3, ağ gecikmesi 400/1500 ms (adım 15), CPU 6× (15), 6× (14–15), 12× (15) — kırmızı ZORLA ÜRETİLEMEDİ (ders 20). 4f9f909: senaryoya adım bazlı CPU_THROTTLE kancası + waitMoves zaman aşımında ekran durumu (süzgeç değerleri, satırlar, odak, liste metni). Gönderildi → yeni CI; kırmızı yinelenirse neden günlükte okunur ve kök neden düzeltilir; yeşilse #864 kırmızısı teslimde BİLİNEN SINIR/DENENMEYEN olarak açıkça yazılır (yeniden üretilemeyen tek seferlik e2e zaman aşımı), kapanmış sayılmaz.
- KARAR (kullanıcı, 24.10.2026 ~06:20 UTC: "sen birleştirmeyi yap, bana da yüklemek için github linki ver"): 2.4.4 PR → master açılır, PR CI + Doğrulama Kapısı yeşil olunca squash birleştirilir (önceki sürümler gibi); kullanıcıya yayın açma bağlantısı (v2.4.4) verilir. Kısa elle kabul (Yerine Koy / Devamı / eşitleme) ve portal Windows+Edge denemesi kullanıcı tarafından istenmedi → teslimde DENENMEYEN (KANIT KURALI 5'ten kullanıcı kararıyla sapma, 2.1.0 düzeni).
- İSTEK (kullanıcı, 23.10.2026 ~13:45 UTC: "hazırlık yap, sohbeti sıkıştırma komutu vereyim") → devam notu 00 "GÜNCEL (23.10 ~13:45 UTC)" yazıldı ve gönderildi (ajan kimlikleri, adımlar, komutlar).
- SON ADAY BAĞIMSIZ TURU (kullanıcı, 22.10.2026: "2.4.4 son aday uzun test koşusuna başlamadan kâhin (uzman mali müşavir), yargıç, eleştirmen testlerinden geçecek mi,
  regresyon testleri yapılıyor mu?" → EVET; "ekle" → uzman UI + uzman UX de): iş listesi madde 30–31 (31a kâhin, 31b mali müşavir, 31c yargıç, 31d eleştirmen, 31e dar kontrol,
  31f uzman UI/UX) Uzun Doğrulama'dan ÖNCE.
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

## Arşiv 29.10.2026 (2.4.7 sürerken; CLAUDE.md Açık iş'ten AYNEN taşındı — kapanan 2.4.4/2.4.5/2.4.6 maddeleri, tamamlanan altyapı, yapılmış istekler; kullanıcı 29.10: "eskiden kalan bitmiş işler token tasarrufu için temizleniyor mu?")

- YENİ OTURUM AÇILDI (26.10.2026 ~18:30 UTC, session_01YPtTa36rhoDHXGQsPrhcJ8): devir belgesi okundu, ilk 15 dk adımları uygulandı. DAL (kullanıcı: "kendi sistem talimatında sana atanan dalı kullan, yalnız oraya gönder … youthful-euler yalnız belge kaynağı"): iki depoda da `claude/compassionate-galileo-f9kghg`; program dalı origin/master'dan + belge farkı (devir §0 madde 2), site dalı origin/main'den. `docs/kanit/2026-10-25/246-paket` (BELGE_YOLLARI dışı) ilk kod gönderimiyle birlikte taşınır (ders 26). HATIRLATICI TAŞINDI: yeni trig_0144yLFe3Mqtv8rS1mQ3iGur (23.11.2026 09:00 TR, bu oturuma bağlı, aynı istem); eski trig_01DE8bFDurzMRT6thbptBrQM enabled=false. 2.4.7 kodu kullanıcının "başla"sını bekler; kullanıcı mobil v0.3 dosyalarını YÜKLEDİ (26.10 ~18:40 UTC: v0.3 teslim zip, demo zip, teknik sunum PDF, DOGRULAMA-SONUCLARI.md + iki ekran görüntüsü; toplu zip içindekilerle bayt bayt aynı; v0.3 kendi TAP'ı 12/12 + gerçek API 4/4 — 2.4.5'e karşı). KARAR (kullanıcı, 26.10.2026: "yüklediğim paketteki notu bir önceki oturumda değiştirdik, kendimize göre uyarladık. devir teslimde olanları dikkate alacaksın"): paketteki CLAUDE-ENTEGRASYON.md eski hâldir, iş tanımı DEĞİL; geçerli olan devir belgesi (docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md §3.1) ve 26.10 kararlarıdır.
- 2.4.7 DURAKLADI — DEVAM NOTU (kullanıcı, 27.10.2026: "kalan mobilden uzaktan erişimi işine başlama, mevcut yapılan işleri tamamla ve kaydet. perşembe günü kullanım limitim sıfırlanınca devam edeceğiz 2.4.7 ye. işi daraltmadan tam haliyle yapacağız"): DEVAM Perşembe 29.10.2026 (haftalık sınır sıfırlanınca, kullanıcının "devam"ıyla). KAPSAM DARALMAZ: M2 eşleme + 3 cihaz, M3 R2 özet + Worker kapıcı + m. sayfası, M4 tünel, M5 mobilden tahsilat/ödeme/stok — HEPSİ 2.4.7'de (önerilen "M5'i ayır" REDDEDİLDİ). Kalan diğer: E6 site C1/C2/D1 (sayım tablosu, Operatör Merkezi "e-Belge Kullanımı", KVKK satırı — kullanıcı onayı), E3 kullanıcıyla test faturası, D doğrulama. YAPILANLAR (çalışma dalı claude/compassionate-galileo-f9kghg, iki depoda): 0a, E1/E2 (destekofis30), E4/E5 (sayaç; kararlar S1–S6, F1/F2, Y2/Y5, son "a"; kâhin 47/50, kalan DENENMEYEN/BİLİNEN KÂHİN FARKI), M1 (mobil arayüz dalga 1, salt okunur, /mobil/), G1 (e-posta/site adresi; site dalı 76e0286), uiux-a-243 test yarışı. Ayrıntı ve kanıt: docs/2.4.7-IS-LISTESI.md. DURUM (28.10.2026, sıkıştırma öncesi): CI #889/#891/#895/#896 YEŞİL 7/7 (son kod 43ca3cdf); 0a, E1, E2, E4, E5, M1, G1 iş listesinde ÇİZİLDİ; iki depo temiz ve gönderildi (program 519c4f28+, site 76e0286); çalışan ajan / CI / 30 dk rapor görevi YOK (Perşembe "devam"da yeniden kurulur). Bu kapsayıcıda yüklü (yenilenirse silinir, yeniden istenir): imza anahtarı /root/.claude/uploads/2a941a30-cea4-5380-a679-f28a541c21a1/2d5a0de8-destekofis-imza-anahtari-GIZLI_1.pem (ed25519; genel anahtarı update-keys.mjs destekofis-2026-1 ile EŞLEŞTİ, 27.10 denetlendi; yalnız release.mjs --anahtar, hiçbir yere kopyalanmaz), mobil v0.3 zip + demo zip (dünküyle bayt bayt aynı; yalnız başvuru). Devir hatırlatıcısı trig_0144yLFe3Mqtv8rS1mQ3iGur (23.11.2026 09:00 TR, bu oturuma bağlı). DEVAMDA İLK İŞ: (1) [YAPILDI 27.10: CI yeşil, maddeler çizildi]; (2) M2 için KÂHİN ÖNCE (eşleme/güvenlik kâhini, kodu görmeyen ajan, xhigh) + M5 için cari kâhinine mobil yazma senaryoları; (3) M1 raporundaki dalga 2 riskleri (iş listesi "Mobil dalga 2 riskleri"). Yeni kapsayıcıda: mobil v0.3 zip'i ve sunum yeniden YÜKLENİR (uploads ve not defteri silinir); M1 artık depoda (client/mobil/, server/lib/mobile.mjs) olduğundan zip yalnız başvuru içindir.
- İSTEK (kullanıcı, 28.10.2026, ekran görüntüsüyle; "müşterinin duşakabin üretim sektörüne özel yaptığımız maliyet kartı için istekleri var, tek tek yazacağım. mümkünse bu sürüme ekleyelim"): Maliyet Hesap Kartı (2.4.6) müşteri istekleri → 2.4.7 KAPSAMINA (kullanıcının açık kararı; "işi büyütme" kararının istisnası). (1) "4 menüye de yazdır butonu isteriz PDF'ye aktarım yani" → dört sekmenin (Cam Maliyet, Bayi Fiyat Listesi 1, Mika Maliyet, Bayi Fiyat Listesi 2) her birinde PDF düğmesi. (2) "KDV 18 görünüyor, varsayılan boş görünsün. zaten formülleri olan bir modül bu. açılışı boş gelsin kdv oranı 18 olmasın. kullanıcı girsin kdv oranını" → Cam Maliyet'in 5 kartında etiket "KDV" (/18 yok), oran kutusu BOŞ gelir (boşken KDV 0), kullanıcı yazar; kod server/lib/maliyet/sablon.mjs:58–64 `yuzde: ["KDV/18", 18]`. EK (kullanıcı, 28.10.2026: "kdv karşısındaki pillerin içi de boş gelsin; 20 veya 18 yazmasın") → Cam kartlarında İKİ oran kutusu da (KDV 18 ve %20 Maliyet 20) BOŞ gelir; etiketler "KDV" ve "Maliyet" (ekran görüntüsündeki gibi, sayı yok). Bölenler (200/170/120, cm) DEĞİŞMEZ. Mika (kullanıcı, 28.10.2026, işaretli ekran görüntüsü: "mika kartı içinde oranlar boş gelsin % olsun sadece karşılarındaki pencerelerin içi de boş gelsin") → Mika kartlarında Masraf% (11–17) ve %15 Maliyet kutuları BOŞ gelir; etiketlerde sayı yok ("Masraf%", "Maliyet"), kutunun önünde yalnız "%" işareti. (3) "—" satırı Mika'da da var, aynı düzeltme. KAPSAM (kullanıcı, 28.10.2026: "sadece basit düzeltmeler istiyorum bu müşterinin istediklerinde, işi bunlarda genişletme. asıl iş mobil işini kusursuz tamamlamak") → Maliyet kartı istekleri (1)–(4) KÜÇÜK ve dar yapılır, ek özellik/ek tur yok; 2.4.7'nin asıl işi mobil (M2–M5) kusursuz. Müşterinin KAYDETTİĞİ kartlar değişmez (kullanıcı verisi ezilmez; yalnız şablon / kaydedilmemiş kart) — baş mimar varsayılanı, kullanıcı aksini derse değişir. (3) "arada boş buton var farkettiysen" (ekran görüntüsü: KDV ile %… Maliyet arasındaki "—" ✎ satırı) → zincirin "toplama" adımının etiketi boş (sablon.mjs zincir(): `toplama = ""`, satır 41); öneri: etiket "Toplam" (Excel'de etiketsizdi). (4) "Entera basınca sağa atlarsa iyi olur" → bugün Enter yalnız alanı kaydeder, odak yerinde kalır (client/assets/hof-maliyet.js:650–656); öneri: Enter kaydeder + odak sağdaki kutuya, satır sonunda alt satırın ilk kutusuna (Enter = Tab). (5) AYRINTILI CARİ EKSTRE (kullanıcı, 28.10.2026, işaretli ekran görüntüsü: "'fatura kalemleriyle' kelimelerinin kaldırılması ve … satış altındaki 'faturası' ibaresinin ayrıntılı cari ekstre raporunda görünmemesi. mantığı şu: fatura kesilmemiş değersiz fiş olarak kaydedilmiş olanlarda müşteri yanlış anlayabilirmiş") → yalnız Ayrıntılı Cari Ekstre'de (ekran/PDF/Excel): alt başlıkta YALNIZ "Cari No … · tarih aralığı" kalır — "Fatura kalemleriyle" ve "B: borçlu · A: alacaklı" kalkar (kullanıcı, 28.10.2026: "sadece cari no ve tarihler kalacak o satırda"; server/routes/report-center.mjs:2769); İşlem sütununda "Satış Faturası" yerine "Satış" (tür kısa adı, invoice-math.mjs INVOICE_KINDS `short`; alış/iade türleri de kısa adla). Açıklama sütununda da "Satış Faturası FIS…" yerine "Satış FIS…" (kullanıcı, 28.10.2026: "Satış yazsın orada da"; alış/iade de kısa adla). Kapsam dar (kullanıcı: basit düzeltmeler). (6) AYRINTILI CARİ EKSTRE — yeni istek (kullanıcı, 28.10.2026: "Ayrıntılı cari hareket de istenmeyen alanları müşteri kaldırabilecek ve stok kalemine eklenen açıklama oraya da gelecek") → (6a) sütun seçimi: kullanıcı istemediği sütunları kaldırabilir (ekran = PDF = Excel aynı); bugün rapor merkezinde sütun seçimi YOK (yeni iş, küçük değil ~0,5 g); (6b) kalem açıklaması rapora gelir — kodda iki aday: fatura satırının açıklaması (invoice_lines.description, migrations.mjs ~1009) ve stok kartının notu (stock_items.note, ~627); rapor bugün ikisini de okumuyor (report-center.mjs:2738 sorgusu). NETLEŞTİ (kullanıcı, 28.10.2026; önce stok kartı "Not" sanıldı, sonra düzeltti: "yanlış anlamışım ordaki not değil, faturada ürün ekleyince kenarda bi buton var ona basınca gelen açıklama kısmı") → FATURA SATIRININ AÇIKLAMASI (invoice_lines.description; o faturaya özel, kesildiği hâliyle); kalem satırında görünür, sütun seçimiyle gizlenebilir; açıklaması boş kalemde boş. Stok kartı notu (stock_items.note) GELMEZ. Sütun seçimi HATIRLANIR, kişi başına (kullanıcı, 28.10.2026: "hatırlansın"). Liste kullanıcı yazdıkça buraya eklenir. PARALEL PLAN (kullanıcı, 28.10.2026: "her görev için ayrı ajanlar başlatmayacak mısın, aynı anda yapılırsa süre uzamaz") → EVET, Perşembe "devam"da ayrı worktree dallarında aynı anda: (a) Maliyet kartı (1)–(4) MEDIUM; (b) Ayrıntılı Cari Ekstre (5)+(6) TEK ajan (aynı dosya report-center.mjs; çakışmasın) HIGH; (c) M2 eşleme/güvenlik kâhini XHIGH (kodu görmeyen) + (d) M5 için cari kâhini mobil yazma senaryoları XHIGH; (e) E6 site C1/C2/D1 MEDIUM; kâhinler bitince M2→M3→M4 (sıralı bağımlı) HIGH, M5 XHIGH (para). Birleştirme ana oturumda. Not (kullanıcıya söylendi): paralellik takvimi kısaltır, haftalık kullanımı azaltmaz (aynı iş + birleştirme payı).
- SIKIŞTIRMA SONRASI (26.10.2026 GÜNCEL — 2.4.7 MOBİL): 2.4.6 KAPANDI. SIRADAKİ = 2.4.7 (mobil), kullanıcının "başla"sıyla (29.10 Per 02:00 TR haftalık kullanım sınırı sıfırlanınca). Kararların hepsi aşağıda MOBİL / KARAR (26.10 ×3: öncelik, yöntem, 3 cihaz) / İSTEK (altyapı) / İSTEK → 2.4.7 KAPSAMI (e-posta, site adresi; lisans adresi DEĞİŞMEZ) ve 2.4.7 KAPSAMI — EDM İŞ ORTAKLIĞI maddelerinde. Kullanıcının mobil paketi uploads klasöründe: /root/.claude/uploads/456ebc12-8183-520e-989e-af270fef8a58/{101b501c-DestekOfis-Mobil-v0.3-Musteri-Raporlari-Claude-Teslim.zip, 398e124e-DestekOfis-Mobil-Demo-Acilabilir.zip, f0429bd0-…Roadmap_2026.pdf} (açılmış kopya not defteri mobil-inceleme/; v0.3 ayrı Node ağ geçidi + PWA public/, 12/12 test burada koştu; API uçları 2.4.6'da var). "başla"da İLK İŞ: docs/2.4.7-IS-LISTESI.md (madde 0a; BELGE_YOLLARI'na eklenir) + "nasıl bozulur" listesi + kâhin önce (eşleme/güvenlik + cari kâhinine mobil yazma), 30 dk ara rapor (kalıcı zamanlanmış görev), sonra kod dalgası. TAHMİN (kullanıcıya verildi 26.10): takvim 5–6,5 gün (iş 7–9 gün); Claude kullanımı API karşılığı ~635–1.015 $ (2.4.6 ölçülen ~430 $; testler ~%45–50); GitHub ~2.800–3.200 dk, 0 TL (depo açık kalmalı). KÖR NOKTALAR verildi: cloudflared ~20–60 MB → kuruluma koyma, ilk açılışta indir + imza denetle; Worker ücretsiz 100k istek/gün ~650 ofise kadar, üstü ~5 $/ay; Cloudflare Access KULLANILMAZ (program kendi karekod eşlemesi). Belirteçte Cloudflare Tunnel yazma izni olmayabilir (cfd_tunnel listesi okunuyor) → tünel adımında gerekirse kullanıcıya izin ekletilir. Devir 2.5.0: 1 Ocak yayında, en geç ~10 Aralık başla (hatırlatıcı 23.11). ESKİ — YENİ OTURUM / SIKIŞTIRMA SONRASI (25.10.2026 GÜNCEL): ÖNCE `docs/DURUM-VE-DEVAM.md` → "### 0000. MALİYET HESAP KARTI (M3) BAŞLANGIÇ — DEVAM NOTU" (2.4.5 yayımlandı; M3 sırada). M3 SÜRÜM 2.4.6 (kullanıcı 25.10 ~08:55 UTC: "sürüm numarası dediğin olsun"); 2.4.6 BAŞLADI (~09:10 UTC; kullanıcı: "anayasamıza ve derslerimize göre yap işi"); iş listesi docs/2.4.6-IS-LISTESI.md (madde 0a ile taşındı); 30 dk ara rapor işi kuruldu (oturum içi, :07/:37); KARAR (kullanıcı 25.10): "sadece duşakabin sektörü seçilince çıksın bu yapacağımız analiz kartı". Kullanıcı Excel'i yeniden yükledi (çözülmüş içerik öncekiyle bayt bayt aynı; parola dosyaya yazılmadı). ESKİ: "### 000. 2.4.5 BAŞLANGIÇ — DEVAM NOTU" (2.4.4 kapandı; 2.4.5 için "BAŞLA" VERİLDİ 24.10.2026 ~16:40 UTC — sıkıştırmadan sonra önce bu dosyanın anayasa + dersler bölümü okunur, sonra başlanır; plan `docs/2.4.5-IS-LISTESI.md` — 24.10.2026 ~16:30 UTC madde 0a ile docs/erp'ten taşındı, BELGE_YOLLARI'nda). Eski not: "DEVİR NOTU (21.10.2026)" (2.4.4 kapsam tablosu, devir 2.5.0, kalan işler,
  anayasa/ders yerleri) ve `docs/2.4.4-IS-LISTESI.md` (36 madde, efor sınıflı, TAM liste) DOSYADAN okunur; özetten anlatılmaz. DAL: bütün güncel belgeler
  `claude/youthful-euler-fl8ks4` dalında (master'da yok); eski `claude/hopeful-goodall-6nmtcj` dalı ESKİ — oradan belge ALINMAZ (yenilerini ezer).
- YETKİ (kullanıcı, 22.10.2026 ~18:40 UTC: "bir süre ekran başında olmayacağım, benim kararım gereken bir konu da 5 dk cevap vermezsem soruna; en yaygın kullanılan
  öneriye göre yap"): karar gereken soru iletide sorulur (bekletmeyen; 5 dk sonrasına kendine hatırlatma), 5 dk içinde yanıt yoksa en yaygın / önerilen seçenek
  uygulanır ve burada "5 dk yetkisiyle uygulandı" diye yazılır; kullanıcı dönünce özetlenir. YORUM (baş mimar): anayasanın kullanıcıya bıraktığı adımlar (PR →
  master "birleştir", yayın açma, müşteri/kimlik bilgisi isteme) bu yetkiye girmez, yine kullanıcıyı bekler. İLK UYGULAMA: ders 26 açıklaması (GÖZDEN GEÇİRME 4 (1),
  ~18:00'den beri yanıtsız) önerildiği gibi eklendi.
- 2.4.4 YAYIMLANDI (24.10.2026 07:28 UTC; PR #34 → master 5187561 squash, PR CI #866 YEŞİL 7/7): kullanıcı v2.4.4 yayınını açtı; 5 dosya teslimle bayt bayt aynı (GitHub digest + indirip cmp), exe .sha256 OK, latest/ bildirge aynı; gerçek eski güncelleyiciler (v2.4.3, v2.4.0, v2.3.0, v2.1.0, v2.0.12 kodu) canlıda 2.4.4'ü "available" gördü (anahtar destekofis-2026-1), 2.4.4 → "up-to-date". Site kılavuz PR ceougur/destekofis#20 birleşti (kullanıcı "birleştir"; main 7dbd178), canlı sitedeki PDF c2c2b19a… aynı. KULLANICI KABULÜ (canlı kurulumunda): BIRLESTIR.bat (yarım inen parçayı yakaladı), e-SMM TES2026829963052 EDM test ortamına gitti (EDM görüntüsü karekodlu; düzenleyen unvanı test görüntüsünde yok = BİLİNEN SINIR), Netten Brüte (net 1.000 → brüt 1.250, stopaj 250, KDV 250 doğru); "ilk izlenimim tamamı çalışıyor 2.4.4 ile gelenlerin". master CI #867 YEŞİL 7/7, Sürüm yayımla #37 YEŞİL (sürümlü DestekOfis-Kurulum-2.4.4.exe + .sha256 ekledi; kullanıcının 5 dosyası değişmedi). 30 dk rapor işi artık yok (CronList boş). 2.4.4 KAPANDI.
- 2.4.5 BAŞLADI (24.10.2026 ~16:30 UTC). İSTEK (kullanıcı ~16:55 UTC): "yapılacak işleri maddele, yapıldıkça üstünü çiz, 30 dk bir ara rapor ver" → iş listesi `docs/2.4.5-IS-LISTESI.md` maddeleri biten oldukça kanıtla çizilir; 30 dk ara rapor işi (CronCreate, oturum içi). Durum: devam notu "### 000" SÜRÜYOR satırı.
- 2.4.5 YAYIMLANDI (25.10.2026 ~07:55 UTC; PR #35 → master d0fd8b0 squash, PR CI #876 YEŞİL 7/7; UD #648 27/27; windows.yml #54 + #55): kullanıcı v2.4.5 yayınını açtı (Latest); 5 dosya teslimle bayt bayt aynı (GitHub digest + indirip cmp; exe .sha256 OK; latest/ bildirge aynı); gerçek eski güncelleyiciler (v2.4.4, v2.4.3, v2.4.0, v2.3.0, v2.1.0, v2.0.12 kodu) canlıda 2.4.5'i "available" gördü (anahtar destekofis-2026-1; 2.0.12 ilk denemede bu ortamın doğrudan çıkışında GitHub istek sınırı → NODE_USE_ENV_PROXY=1 ile available), 2.4.5 → "up-to-date". Site kılavuz PR ceougur/destekofis#21 açıldı (kullanıcının "birleştir"ini bekler). Site kılavuz PR ceougur/destekofis#21 BİRLEŞTİ (main e38fba4), canlı sitedeki PDF 1b6d554e… aynı. master CI #877 d0fd8b0 YEŞİL 7/7 (08:44 UTC); Sürüm yayımla #38 YEŞİL (09:23 UTC; Testler + Windows kurulum derle/kur-kaldır + Yayımla; sürümlü DestekOfis-Kurulum-2.4.5.exe + .sha256 ekledi, kullanıcının 5 dosyası değişmedi — yükleme zamanı 07:54, PDF digest 1b6d554e…). 2.4.5 KAPANDI.
- 2.4.6 YAYIMLANDI (26.10.2026 05:39 UTC; PR ceougur/ofis---y-netimi#36 → master d31b486 squash, PR CI #883 + master CI #884 YEŞİL 7/7; UD #698 27/27; windows.yml #57 + #58 + #59): kullanıcı v2.4.6 yayınını açtı (Latest); 5 dosya teslimle bayt bayt aynı (GitHub digest + indirip cmp; exe .sha256 OK; latest/ bildirge aynı); gerçek eski güncelleyiciler (v2.4.5, v2.4.4, v2.4.3, v2.4.0, v2.3.0, v2.1.0, v2.0.12 kodu, NODE_USE_ENV_PROXY=1) canlıda 2.4.6'yı "available" gördü (anahtar destekofis-2026-1), 2.4.6 → "up-to-date". Site kılavuz PR ceougur/destekofis#22 BİRLEŞTİ (kullanıcı "birleştir"; main 5e5838c), sitedeki PDF 996fb081… aynı. Sürüm yayımla #39 YEŞİL (Testler + Windows kurulum derle/kur-servis-kaldır + Yayımla; sürümlü DestekOfis-Kurulum-2.4.6.exe + .sha256 ekledi; kullanıcının 5 dosyası değişmedi — yükleme 05:37–05:38). 30 dk rapor zamanlayıcıları silindi. 2.4.6 KAPANDI. Ayrıntı docs/2.4.6-IS-LISTESI.md.
- İSTEK (kullanıcı, 26.10.2026: "şimdi cloud flare api işini çözelim ve destekofis.net alan adını alalım, hem vercele hemde flareye bağlayalım, google sahiplenme işlerini falan yapalım … perşembe limit sıfırlanınca başlarız ben başla derim"): 2.4.7 kodu 29.10 haftalık sınır sıfırlanınca kullanıcının "başla"sıyla. ŞİMDİ altyapı: destekofis.net (Vercel sorgusu: boşta) Cloudflare Registrar'dan alınır (satın almayı kullanıcı yapar), DNS Cloudflare'de; site Vercel projesine (destek-ofis) özel alan adı olarak eklenir, Cloudflare kayıtları gri bulut (DNS only); destek-ofis.vercel.app YÖNLENDİRİLMEZ (program lisans adresi https://destek-ofis.vercel.app/api/lisans kodda sabit); Google Search Console alan adı mülkü TXT ile; yeni API belirteci alan adı alındıktan sonra (Workers + R2 + DNS + Tunnel izinleri, bölge destekofis.net). Ayrılan alt adlar: m. (telefon sayfası), kapi. (kapıcı), ofis tünelleri ayrı alt ad. Vercel bağlayıcısı proje alan adlarını okuyamıyor (404) → Vercel adımı kullanıcıda. KARAR (kullanıcı, 26.10.2026: "önerin uygun"; soru "vercelden alsak?"): alan adı CLOUDFLARE'den alınır (Vercel 13,5 $/yıl + nameserver taşıma; Cloudflare ~10–11 $, DNS tünel için zaten orada). ALINDI (kullanıcı, 26.10.2026 ~10:25 UTC, ekran görüntüsü "Your domain is ready"): destekofis.net Cloudflare'de (hesap destekofis@proton…). Sırada: hazır bağlantıyla yeni API belirteci (kullanıcı), Vercel'de alan adı ekleme (kullanıcı), DNS + Google (Claude). YENİ BELİRTEÇ kaydedildi (kullanıcı "2 tamam") ama bu oturumda hâlâ 6111 → ayar yalnız YENİ oturumda geçer. KISA ALTYAPI OTURUMU YAPILACAKLAR: (1) GET /user/tokens/verify + GET /zones?name=destekofis.net (zon kimliği, durum); 6111 sürerse belirteç değeri "Bearer"/boşluk içeriyor olabilir → kullanıcıya yeniden kaydettir. (2) Kullanıcı Vercel destek-ofis → Settings → Domains'e destekofis.net (+ www → ana adrese yönlendir) ekler, gösterilen A/CNAME değerlerinin ekran görüntüsünü verir → Cloudflare DNS'e proxied=false girilir; destek-ofis.vercel.app'e YÖNLENDİRME YOK. (3) Google Search Console alan adı mülkü: kullanıcı TXT değerini verir → DNS'e eklenir → kullanıcı Doğrula. (4) İsteğe bağlı (kullanıcı onaylarsa) Email Routing destek@ → Gmail. (5) Sonuç buraya yazılır. SONUÇ (26.10.2026, yeni oturum session_01CJh8StkaTdyPcnq5eyEnbZ): (1) BAŞARISIZ — GET /user/tokens/verify, /zones?name=destekofis.net ve /accounts üçü de yeni oturumda da 6003/6111 "Invalid format for Authorization header" (vekil başlığı ekliyor ama biçim geçersiz) → belirteç ortamın Cloudflare bağlantısına büyük olasılıkla "Bearer " önekiyle, tırnakla ya da baş/son boşluk/satır sonuyla kaydedilmiş; kullanıcı YALNIZ çıplak belirteci (40 karakter, önek/boşluk yok) yeniden kaydeder, sonra yine YENİ oturum. Cloudflare Developer Platform bağlayıcısı (OAuth) çalışıyor (workers_list: 0 Worker) ama DNS/zon aracı yok — DNS işi API belirtecini bekler. (2)–(4) belirteç düzelene dek yapılmadı (DNS kaydı girilemez); kullanıcı bu arada Vercel destek-ofis → Domains'e destekofis.net + www ekleyip değerlerin ekran görüntüsünü ve Search Console TXT değerini hazırlayabilir. (2) TAMAM (26.10.2026 ~10:55 UTC; kayıtları kullanıcı girdi — Vercel bağlayıcısı add_project_domain 404 "Project not found", Cloudflare belirteci 6111): Cloudflare DNS A @ 76.76.21.21 + CNAME www cname.vercel-dns.com, ikisi DNS only; Vercel destek-ofis: destekofis.net Production, www.destekofis.net 308 → destekofis.net; destek-ofis.vercel.app DOKUNULMADI. Vercel get_domain_config iki ad için misconfigured=false. Vercel'in 'DNS Change Recommended' önerisi (CNAME @ → 974f95ce4d5dc9c6.vercel-dns-017.com) İSTEĞE BAĞLI, uygulanmadı (eski kayıtlar çalışır). DERS: yazma bağlayıcısı kullanıcıya iş vaat edilmeden ÖNCE denenir; çalışmıyorsa bir kez söylenir. Kalan: (3) Google TXT, (4) isteğe bağlı e-posta. BELİRTEÇ DÜZELDİ (26.10.2026 ~11:10 UTC, aynı oturumda — yeni oturum GEREKMEDİ): kullanıcı Ağ gizli anahtarlarında eski api.cloudflare.com kaydını silip yeniden ekledi (tür Bearer, başlık Authorization, Ön ek "Bearer", Değer yalnız belirteç; araç ön eke boşluğu kendisi ekler). tokens/verify active; zon destekofis.net a4521bf58a43349c69a0fdafb985bc83 active; dns_records okunuyor (A @ 76.76.21.21, CNAME www, ikisi proxied=false). Önceki 6111'in nedeni büyük olasılıkla değerde ikinci "Bearer"/boşluktu. (3) TAMAM (26.10.2026 ~11:20 UTC): Search Console alan adı mülkü destekofis.net "Sahiplik doğrulandı" (yöntem: Alan adı sağlayıcı — Google'ın Cloudflare Domain Connect akışı, kullanıcı tek seferlik yetkilendirdi); TXT google-site-verification kaydı zonda (API ile okundu) — SİLİNMEZ. ALTYAPI OTURUMU KAPANDI; açık yalnız (4) isteğe bağlı destek@ e-posta yönlendirmesi (kullanıcı isterse). Mobil 2.4.7 için ön koşullar (alan adı, belirteç: Workers/R2/Tunnel listeleri okunuyor) HAZIR; başlarken v0.3 zip'i yeniden yüklenir (kapsayıcıda yok) ve önce 2.4.7 iş listesi + kâhin. (4) İSTENDİ (kullanıcı 26.10.2026, hedef bilgi.ugurcetin@gmail.com): belirteçte Email Routing izni yok (10000) → panelden kullanıcı kurar (Email Routing → destek@ → Gmail; MX/SPF kayıtları panel ekler); yalnız GELEN posta, destek@ adıyla gönderim ayrı iş. (4) TAMAM (26.10.2026): Email Routing destek@destekofis.net → bilgi.ugurcetin@gmail.com (kullanıcı panelden; hedef Verified, Catch-all kapalı); Gmail "Farklı gönder" destek@ (smtp.gmail.com:587 TLS, Google uygulama şifresi — şifre hiçbir yere yazılmadı); DNS (kullanıcı "sen yap"): SPF → "v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all", DMARC _dmarc "v=DMARC1; p=none" eklendi. Gmail'de spam'a düşmeye karşı to:destek@ filtresi önerildi.
- KARAR (kullanıcı, 24.10.2026 ~19:26 UTC, 2.4.5 aday sorusu b): carinin vadeli borç pilinden/formundan girilen tahsilat FIFO ile en eski açık borcu kapatır; tahsilat formunda YALNIZ bilgi notu çıkar ("a yı uygula sadece bilgi notu çıksın önerinin diğer kısmına gerek yok") — kılavuz/sürüm notu maddesi ve "Kapatılacak Borç" bağı YOK.
- İSTEK (kullanıcı, 24.10.2026 ~20:50 UTC): "her yarım saatte bir ara rapor vermeyi sürdür, github uzun koşusu başlayınca da yarım saatte bir kontrol et" → 30 dk rapor işi yenilendi (CronCreate, oturum içi, :07/:37); Uzun Doğrulama başlayınca her turda bir kez durumu okunur ve rapora yazılır.
- KULLANICI BULGUSU → 2.4.5 DÜZELTME (24.10.2026 ~08:40 UTC; inceleme salt okuma, koddan): (H1, eski hata v2.0.15/v2.3.0'dan) Tahsilat Takvimi pil kartı ve zil fatura (source "invoice") ve planlı banka (source "bank") kalemlerini tablo kaydı gibi işliyor — client/assets/hof-promises.js openCard/pay, hof-alerts.js pay: "Kayda Git" → revealRecord("") "Kayıt tabloda bulunamadı" (+ arama kutusunu temizler); "Ödendi Say" → dues.mjs:138 400 "Kalem tanınmadı" (pil kalır; reddetmek doğru); "Tahsilat Gir" → workspace.payment({key:""}) SEÇİLİ kaydın carisine fatura tutarıyla dolu form (PARA RİSKİ; alış faturasında yön de yanlış); Vade Takip openRef invoice/bankPlan dalı yok. Kullanıcıya uyarı verildi: fatura pilinde Tahsilat Gir kullanılmaz, Fatura → + Tahsilat Ekle. KULLANICI İSTEĞİ: "pili tıklayıp kayda git dediğimde gelseydi daha kolay olacaktı" → fatura pilinde "Fatura Kartını Aç" (HOF.invoices.openDoc), Tahsilat Gir/Ödeme Gir faturanın kendi formu (payDoc), Ödendi Say yok; banka pili "Planlı İşlemleri Aç"; zil + Vade Takip aynı. (H2, 2.4.3 A18 gerilemesi) tablo hücre biçimleyicisi (paket app-*.js cT/hfCell) "Borçlu Telefon"/"Borçlu TC Kimlik No"yu "borç" sözcüğünden para sütunu sayıp 5.367.715.055,00 yazıyor; para/borç etkisi yok (sunucu debt-column telefonu borç saymıyor), kart ham değeri gösteriyor, ama tablo hücresinden WhatsApp sessizce açılmıyor → kimlik/iletişim başlıkları (telefon, tel, gsm, cep, tc, tckn, kimlik, vkn, iban, no, numara) para kalıbından önce metin. Testler: e2e (fatura pili düğmeleri, seçili başka kayıt varken; banka pili; zil; telefon hücresi + wa.me) + kaynak tarayan "her source için dal" — eski kodda kırmızı. KARAR (kullanıcı, 24.10.2026: "hepsini tek seferde 2.4.5 de yapsak") → tek 2.4.5: H1/H2 docs/2.4.5-IS-LISTESI.md madde 6a/6b, DALGA 1'in başında. Kullanıcıya açıklandı: kapı kapatma ikisini kendiliğinden çözmez (fatura pili takvimde kalır; telefon tablo görünümünde); risk penceresi (fatura pilinde Tahsilat Gir) 2.4.5 yayımlanana dek açık, kullanıcı uyarıldı. "başla" bekleniyor.
- MÜŞTERİ İSTEKLERİ (yeni müşteri kurulumu, 24.10.2026; kullanıcı sırayla yazıyor): (M1) "ekstrelerde tabela isimleri olsun, firma bilgisi kartına tabela ismi kısmı ekleyelim" + "raporlarda ve ekstrelerde görünsün, seçenek olsun: isterse sadece tabela ismi, isterse hem firma bilgisi hem tabela ismi" → Firma Bilgileri'ne **Tabela Adı** + **Rapor ve Ekstre Başlığı** seçeneği (Yalnız Tabela Adı / Tabela Adı ve Firma Bilgileri [unvan, VKN, vergi dairesi, adres]); bütün rapor/ekstre PDF + Excel başlıkları (bugün office.name, routes/accounts.mjs:42/885, report-pdf.mjs); fatura/e-Belge unvanı DEĞİŞMEZ (yasal). ~0,5–1 g; sürüm kararı istekler bitince.
  (M2) müşterinin eski programından "Ayrıntılı Cari Hareket Raporu" fotoğrafı: "bu şekilde ekstre istiyorlar, kesilen faturaların detayları, fatura tutarları, ödemeler ve en altta genel toplam" → BUGÜN: Cari Ekstre (report-center.mjs cari-ekstre; accounts ekstre.pdf) satır başına tek hareket (Tarih, İşlem, Açıklama, Borç, Alacak, Bakiye), fatura kalemi yok. ÖNERİ: Cari Ekstre'ye **Fatura Kalemlerini Göster** seçeneği (Ayrıntılı Cari Ekstre): her hareket satırında Belge No + yol (Nakit/Havale/POS/Çek) + yürüyen bakiye; fatura satırının altında girintili kalemler (Ürün / Hizmet, Miktar, Birim, Birim Fiyat, İsk. %, KDV'siz Tutar, KDV %, Toplam); devir + dönem toplamları + Genel Toplam (Toplam Borç / Toplam Alacak / Bakiye); ekran = PDF = Excel; başlık M1 Tabela Adı; cari kartından da açılır. Veri var (defter satırında source/sourceId, invoice_id). ~1–1,5 g.
  (M3) duşakabin üreticisi müşteri: "sektörde böyle bir maliyet kartı eksikmiş, yaparsak o sektörde yayılırız" → programdaki sektörlere **Duşakabin Üretimi**; seçen firmanın stok kartında **Maliyet Hesap** kartı: müşterinin Excel'indeki (şifreli, oturuma yüklendi; şifre ve içerik hiçbir dosyaya/depoya girmez) her alt sekme bir tablo başlığı, malzemeler + miktar + birim + fiyat + toplam, formüller Excel'deki gibi; malzeme başlıkları kalem ikonuyla değiştirilebilir, birimler kullanıcıca değiştirilebilir; "hesaplamayı yüklediğim exceldeki gibi yapacak". Ses kaydı (müşteri görüşmesi) da yüklendi. Salt okuma analiz ajanı başlatıldı (Excel yapısı + formüller + ses dökümü + tasarım girdisi; not defteri dusakabin-analiz/RAPOR.md). Kabul kâhini: Excel'in kendi hesapladığı değerler.
    KAPSAM KARARI (kullanıcı, 24.10.2026: "işi derinleştirme"): Stok penceresinde BİR KART (Maliyet Hesap Kartı); sipariş, stok kaydı, satış fiyatı ya da başka hiçbir yere BAĞLANMAZ; yalnız tablodaki değişkenlere göre tabloda basit hesap. Ana kalemler (tablo/malzeme başlıkları) kalem ikonuyla değiştirilir; birim, fiyat vb. yazılıp silinebilir (satır ekle/sil). Excel'deki tablolar ve formüller HAZIR KAYITLI gelir. Kullanıcı değişiklik yapıp karttan çıkarken "son hâli kaydedilsin mi?" sorulur (kaydedilmemiş değişiklik sorusu, esc-kapat düzeni); altta **Kaydet** ve **Çık** düğmeleri. AÇIK: yalnız "Duşakabin Üretimi" sektörü seçilince mi görünür (ilk istek) — kullanıcıya soruldu.
    DÜZEN (kullanıcı): Excel'in alt sekmeleri pencerenin ÜSTÜNDE düğme; her sekmedeki her bölüm (ör. "100X100 KÖŞE KABİN") ayrı kart. ANALİZ (salt okuma, not defteri dusakabin-analiz/RAPOR.md; 554/554 formül bağımsız yeniden hesapla aynı, LibreOffice ile mutasyon denendi; ses DÖKÜLEMEDİ — model indirme ağ politikasıyla 403): 4 sekme — Cam maliyet sekmesi (5 kart: 100X100 Oval, 100X100 Köşe, 170 2S2Ç H:182, 130 1S1Ç, 130 1S2Ç; satır = miktar × fiyat → ARA → +KDV/18 → +%20 → ÷ cm), Mika maliyet sekmesi (5 kart + 80'lik yan panel + profil gramaj tablosu; KDV yerine MASRAF% 11–17, +%15), iki BAYİ FİYAT LİSTESİ (2024, 2019; ölçü aralığı × renk/cam matrisi, maliyet kartı değil). Ölçüye bağlı miktar formülü yok, sekmeler arası bağ yok; 6 işlem türü yeter (çarpım, toplam, yüzde ekle, toplama, sabite bölme, sabit fark) — serbest formül motoru GEREKMEZ. 10 tutarsızlık (130/150 kabinde ÷120, elle yazılmış 1,79, aynı malzemeye iki fiyat, yan panel "%20" etiketi %15 formül …) "Excel'deki gibi" kuralıyla AYNEN gelir; müşteriye sorulacak 13 soru raporda. Kâhin: Excel'in değerleri (kart başına girdi→çıktı çiftleri, kahin-ciftleri.json; müşteri verisi depoya girmez, testte türetilmiş çiftler).
    KARAR (kullanıcı, 24.10.2026: "exceldeki alıştıkları neyse o olsun"): 4 sekmenin HEPSİ (iki maliyet sekmesi + iki bayi fiyat listesi) üstte düğme; kartlar, oranlar (KDV/18, %20, MASRAF%, %15), bölenler, fiyatlar ve 10 tutarsızlık Excel'deki gibi AYNEN; fiyat listeleri Excel'deki matris tablo olarak (taban + sabit fark formülleriyle, metin hücreler metin). Düzeltme yok; değiştirmek kullanıcının elinde (✎, satır ekle/sil, oran/birim/fiyat). Sektör görünürlüğü: öneri "yalnız Duşakabin Üretimi seçilince" (yanıt yok → öneri geçerli, itiraz edilirse değişir).
    SÜRÜM KARARI (kullanıcı, 24.10.2026: "bu excel işini sonraki sürümde yapalım, ama diğer söylediklerimi 2.4.5 sürümüne ekleyelim"): M1 → 2.4.5 madde 6c, M2 → 2.4.5 madde 6d (docs/2.4.5-IS-LISTESI.md); M3 (Maliyet Hesap Kartı) → 2.4.5'ten SONRAKİ sürüm (ses kaydı dökümü bekliyor: huggingface.co ağ izni ya da kullanıcının metni).
- YÖN (kullanıcı, 23.10.2026 ~12:45 UTC; "bu sadece içimi dökmekti" — KARAR DEĞİL, 2.4.4'te kod değişmez): "kasaya, cariye excelden / tablodan para giriş çıkış işlerinin olmaması gerekiyor; excel çok esnek, program tahmin ediyor … muhasebe ve para işinde riske atılabilecek bir durum değil … ileride excel tablosu ile para bağını komple koparıp cari üzerinden yapılmasını sağlayalım." BAŞ MİMAR NOTU (yanıtta verildi): bugün Excel'den paraya kalan yollar — (a) 2.4.3'ten kalan kayıt tahsilatları (case_key) ve onları koruyan B1 bağ sürekliliği, (b) "önce cari açın" Açılış Bakiyesi ön dolumu (tablo borcu, kullanıcı değiştirebilir), (c) Tablodan Aktar (tablodan taksit kartı, ön izlemeli), (d) Excel'den cari yükleme açılış bakiyesi (eşleme ekranlı), (e) API'de kayıt tahsilatı ucu (mutabakat/üreticiler). ÖNERİ (2.5.x'te ayrı sürüm, kullanıcı "başla" deyince): tablo yalnız bilgi + hatırlatma kaynağı; para yalnız Cari'den; eski kayıt tahsilatları kullanıcı onaylı göçle cariye; ön dolum ve Tablodan Aktar tutarları kullanıcı onayı olmadan paraya dönüşmez.
- İSTEK (kullanıcı, 23.10.2026 ~20:05 UTC): "excel / tablonun kasadan, paraya dokunan yerlerden tamamen koparılması ve ajanda / rehber gibi kalması ne kadarlık iş; 2.5.5'e kalan işleri de ekle — koparmayla bir kısmı kendiliğinden çözülür" → salt okuma analiz ajanı (koddan envanter + paketler + tahmin + ertelenenlerin çözülür/kısmen/hayır tablosu; not defteri tablo-kopar/RAPOR.md). NETLEŞTİ (kullanıcı: "bu sürümde bulunup ertelenen hatalardan bahsediyorum, 2.5.5'i yanlış yazmış olabilirim"): kapsam = 2.4.4'te bulunup ertelenen bulgular (iş listesi SONRAYA 2.5.0 / 2.5.0 adayı / DONDURMA / BİLİNEN SINIR). Kod değişmez (YÖN maddesi).
- YÖN KARARI (kullanıcı, 23.10.2026 ~20:15 UTC; 12:45'teki "içimi dökmek"in teyidi): "mevcut piyasadaki muhasebe programları gibi olmasını istiyorum, excelden sheetsden gelen verileri programın analizine bırakarak muhasebesel işleri riske atamayız." → HEDEF (2.4.4'ten SONRA ayrı sürüm; 2.4.4 kodu değişmez): para kaydı, borç tutarı, açılış bakiyesi programın tablo sezgisinden doğmaz; Excel/Sheets yalnız açık eşlemeli + ön izlemeli + onaylı tek seferlik içe aktarma (cari kartı, açılış fişi — Logo/Mikro/Wolvox/QuickBooks düzeni); tablo ajanda/rehber + hatırlatma ("tablodan, muhasebe kaydı değil"). Sürüm ve sıra koparma analiz raporundan sonra kullanıcıya önerilir. RAPOR (23.10 ~20:30 UTC): docs/erp/TABLO-PARA-KOPARMA-PLANI.md (envanter dosya:satır; ana oturum workspace.mjs:394 kayıt tahsilatı ucu, overview.mjs:374 Projeksiyon tablo kalemleri, general-ledger.mjs:192/267 A 602 iddialarını koddan doğruladı). Paketler P0–P9, 6–9 gün / 6–10 aday turu; ertelenen 25 bulgudan koparma + eşleme (B) ile 15 tamamen, 6 kısmen, 4 hayır. ÖNERİ verildi: 2.5.0 devir önce (tarih kritik) + küçük ara adım; koparma ayrı sürüm (2.6.0). Kararlar K0–K11 kullanıcıda. KAPI KAPATMA (kullanıcı ~20:50 UTC: "sadece giriş kanalını kapatmak … önce yapıp sonra koddan çıkartsak olmaz mı?" → EVET önerildi: özellik anahtarı — (1) kayıt tahsilatı yeni giriş/düzeltme kapalı (silme/geri yükleme açık), (2) Tablodan Aktar düğme + uç kapalı (Geri Al açık), (3) Açılış Bakiyesi / Tahsilat Gir ön dolumu boş, (4) Projeksiyon tablo kalemleri varsayılan kapalı; uç testler için anahtarla açılır). Kullanıcı: "eski müşteriler lisanslı birkaç kişi, artık yalnız cariyi kullanır; işin çoğu test sanırım" → eski veri dondurulur, uyumluluk yükü küçük. KARAR (kullanıcı ~21:00 UTC): "2.4.4'ten sonra olacak artık. Bu sürümü sabah aksilik olmazsa canlıya alalım. 2.4.5 için düşünüyorum: kapıları kapatalım ve ertelenen işleri de yapalım." → 2.4.4 OLDUĞU GİBİ (UD yeşilse sabah paket + teslim; yayın yine kullanıcının "birleştir"/yayın adımıyla). 2.4.5 KAPSAMI: kapı kapatma (1)–(4) + 2.4.4'te ertelenen bulgular (docs/erp/TABLO-PARA-KOPARMA-PLANI.md §4.1, 25 kalem). AÇIK KARAR (önerildi): başlık ailesi bulguları (1–4, 6, 8, 21, 23) tek tek mi (~3 gün, döngü riski) yoksa SEÇENEK B (sekme başına tutar sütununu kullanıcı bir kez seçer, program önerir) mi (öneri B). 2.4.5 başlamadan önce iş listesi docs/2.4.5-IS-LISTESI.md + kâhin önce (D0 düzeni). Devir 2.5.0 Aralık başına kadar yayında olmalı (hatırlatıcı 29.10). KULLANICI (~21:15 UTC): "uyarılar da tablodan gelmese, taksit ya da cari modülünden gelse; o kapıyı da kapatsak, yeni iş çıkar mı?" → KODDAN (routes/dues.mjs:60–112): zil/takvim bugün tablo kalemleri + tablo tarihleri (computeDeadlines) + taksit (plans.dueItems) + çek + fatura + planlı banka; carinin kendi ödeme sözü / vade hatırlatması YOK. Öneri verildi: tablo PARA hatırlatmaları kapanır; boşluk = "Cari'de Ödeme Sözü" (tarih + tutar + not → zil/takvim/Tahsil Et; yeni iş ~1,5–2 gün); tablonun tutarsız tarih hatırlatmaları (duruşma, sözleşme bitiş) ajanda olarak kalabilir (karar); Tablodaki Kişiler tablo borcu yerine cari bakiyesi. Böylece başlık ailesi bulguları tamamen anlamsızlaşır, B gerekmez. 2.4.5 tahmini ~3–4 gün. KARAR (kullanıcı ~21:25 UTC: "kalacaklarda önerin uygun"): tablonun TUTARSIZ tarih hatırlatmaları (duruşma, sözleşme bitiş, icra son tarihi) ajanda olarak KALIR. SORU: "caride ödeme sözü diye bir şey var mı genel muhasebe programlarında, yoksa borcun vadesi gelince uyarmaz mı?" → yanıt: piyasanın temeli VADE (alacak kaydının kendi vade tarihi + vadesi gelen/geçen uyarısı + yaşlandırma); "söz" ayrı nesne değil, tahsilat takibinde "beklenen ödeme tarihi" (Xero expected date / Sage promise to pay türü) ek alan. KODDAN: account_entries'te vade alanı YOK (migrations.mjs:607); fatura/taksit/çek vadeli. KARAR (kullanıcı ~21:35 UTC: "önerilerin uygun"): 2.4.5 = (0) iş listesi + kâhin önce; (1) kayıt tahsilatı yeni giriş/düzeltme kapalı (test anahtarı); (2) Tablodan Aktar kapalı (Geri Al açık); (3) Açılış Bakiyesi / Tahsilat Gir ön dolumu boş; (4) zil/takvim/Vade Takip/Projeksiyon'da tablo TUTAR kalemleri yok, tablo tarih hatırlatmaları kalır; (5) Tablodaki Kişiler tablo borcu yerine cari bakiyesi, Tablodaki Nakit Akışı kalkar; (6) cari borç kaydına Vade Tarihi + Beklenen Ödeme Tarihi → zil/takvim/Tahsil Et; (7) küçükler (Sözleşme Bitiş, N7, A. Can Er); (8) kılavuz + sürüm notu ("projeksiyon toplamı düşer"); (9) doğrulama. Tahmin ~6 iş günü, paralel ajanlarla 3,5–4,5 takvim günü (+1 gün pay); GitHub ücretsiz. 2.4.4 tesliminden SONRA, kullanıcı "başla" deyince. PLAN HAZIR (kullanıcı ~21:50 UTC: "2.4.5 planlamasını şimdiden yap, başla dediğimde başlayacak hale getir"): docs/2.4.5-IS-LISTESI.md (BELGE_YOLLARI içinde → CI/UD'ye yük yok; "başla"da docs/2.4.5-IS-LISTESI.md'ye taşınır, madde 0a). Kullanıcı "en sade" düzeltmesine yanıt vermeden plan istedi → madde 7 (Tablodaki Kişiler cari bakiyesi, küçükler) İSTEĞE BAĞLI yazıldı. Açık soru S1 FIFO (öneri evet). SAAT NOTU: bu bloktaki "~20:05 … ~21:50 UTC" etiketleri tahmindi; `date -u` 20:39 UTC'de okundu → gerçek aralık ~19:40–20:40 UTC (TR = UTC+3). UD #586 20:39 UTC: 19 iş yeşil, 7 sürüyor, başarısız 0.

## Arşiv 30.10.2026 (2.4.7 yayımlandı; CLAUDE.md Açık iş'ten AYNEN taşındı — kullanıcı 30.10: "sohbeti sıkıştırma talimatı vereceğim, hazırlık yap")

- YENİ OTURUM (kullanıcı, 26.10.2026: "2.4.7'yi yeni oturumda yapmaya karar verdim"): ÖNCE `docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md` (tam devir teslim belgesi: ilk 15 dk, çalışma prensipleri, 2.4.7 kapsamı, altyapı, ileride yapılacaklar, hatırlatıcı taşıma, yeniden yüklenecek dosyalar).
- (Arşiv 29.10) 2.4.7 oturumu 26.10 açıldı (session_01YPtTa36rhoDHXGQsPrhcJ8); dal iki depoda claude/compassionate-galileo-f9kghg; devir hatırlatıcısı trig_0144yLFe3Mqtv8rS1mQ3iGur (23.11.2026 09:00 TR, bu oturuma bağlı; eski trig_01DE8bFDurzMRT6thbptBrQM kapalı); paketteki CLAUDE-ENTEGRASYON.md eski hâl, geçerli olan devir belgesi §3.1.
- (Arşiv 29.10) 2.4.7 KAPSAMI DARALMAZ (kullanıcı 27.10): M2 eşleme + 3 cihaz, M3 R2 özet + kapıcı + m. sayfası, M4 tünel, M5 mobilden tahsilat/ödeme/stok HEPSİ 2.4.7. İmza anahtarı bu kapsayıcıda /root/.claude/uploads/2a941a30-cea4-5380-a679-f28a541c21a1/2d5a0de8-destekofis-imza-anahtari-GIZLI_1.pem (yalnız release.mjs --anahtar).
- (Arşiv 29.10) Maliyet Hesap Kartı müşteri istekleri (1)–(4) ve Ayrıntılı Cari Ekstre (5)+(6) 2.4.7'de YAPILDI (iş listesi; kararlar: KDV/Maliyet/Masraf kutuları boş, "Toplam" etiketi, Enter = Tab, ekstrede "Satış" kısa adı, sütun seçimi kişi başına hatırlanır, kalem açıklaması = invoice_lines.description). Tam metin arşivde.
- SIKIŞTIRMA ÖNCESİ DURUM 3 (29.10.2026 ~19:00 UTC; kullanıcı: "sohbet sıkıştırması için hazırlık yap") — ayrıntı ve kanıt docs/2.4.7-IS-LISTESI.md (BAĞIMSIZ GÖZDEN GEÇİRME altındaki DÜZELTMELER BİRLEŞTİ, BAŞ MİMAR KARARLARI, DAR KONTROL, DAR KONTROL 2, SON ADAY GEZİNTİSİ, KAPICI CANLIYA GÜNCELLENDİ, SON ADAY CI + UD + WINDOWS, SON ADAY TAM KAPI; SONRAKİ SÜRÜME). PROGRAM dalı = 5cd00d29 (yerel = origin, temiz). ÜRÜN KODU SON ADAY = fbeb8134 (sonrası yalnız belge/kanıt + sürüm paketi 044028d0 → 5cd00d29: package.json 2.4.7, CHANGELOG, docs/2.4.7-DEGISIKLIKLER.md, kılavuz 2.4.7 + PDF 39/39, pdf-denetle "Kasa ve Banka" mobil ekran istisnası; Maliyet Hesap Kartı sürüm notuna GİRMEZ — 2.4.6 düzeni). BİTENLER: B1–B5 + K1 (son kaydolan kazanır) + dönen ofis + tünel saat telafisi; gezinti 37 adım (B1/B2 ORTA + D1–D9 kullanıcı kararıyla düzeltildi, D7 "Tahsilat Yeri boş gelir"); CI #916 fbeb8134 YEŞİL 7/7; windows.yml #60 + #61 YEŞİL; TAM KAPI fbeb8134 (npm test 3906/3906, ci.yml 85/85, CI dışı 14/14, kâhinler — yalnız belgeli E02 + sayaç U44/U47/U48); kapıcı CANLI sürüm 5eaae21d (kullanıcı "çalıştır"; m. ve kapi. destekofis.net bu ortamdan doğrulandı — kullanıcı ağ iznine ekledi); tanıtım görseli docs/pazarlama/DestekOfis-Tanitim-Mobil.png; SİTE dalı claude/compassionate-galileo-f9kghg = 3704d4d (mobil kartı + üstte rozet + #mobil bölümü; YAYIN GÜNÜ kılavuz PDF'iyle aynı PR'da). SÜRÜYOR: Uzun Doğrulama #827 (run 40916441140, 5af83ffd = kod fbeb8134; 16:56 UTC başladı, ~20:30 biter; kâhin e-Belge/tutar/cari yeşil) ve CI 5cd00d29 (arka plan bl5aqne1b; ci-5cd00d29.txt not defterinde). KAPSAYICIDA HAZIR: Wine + windres (apt ile kuruldu), imza anahtarı /root/.claude/uploads/2a941a30-cea4-5380-a679-f28a541c21a1/2d5a0de8-destekofis-imza-anahtari-GIZLI_1.pem, wrangler not defteri wrangler-247; disk ~11 GB boş (birleşmiş 15 ajan kopyası silindi; kilitli kopyalar duruyor). SIRADAKİ: (1) UD #827 bütün işleri + CI 5cd00d29 7/7 ana oturumca okunur (ders 1, 21); (2) `node tools/release.mjs --anahtar <yukarıdaki pem>` + `npm run build:windows` (temiz ağaç + CI yeşil şart); (3) teslim TESLİM BİÇİMİ: 5 dosya ayrı (destekofis-guncelleme-2.4.7.zip, destekofis-guncelleme.json imzalı, DestekOfis-Kullanim-Kilavuzu.pdf, DestekOfis-Kurulum.exe [30 MB üstüyse parca0 + parca1 + BIRLESTIR.bat], .sha256) + arşiv zip (git fetch --unshallow → git bundle → klondan doğrula) + sürüm notu metni + DENENEN/DENENMEYEN/BİLİNEN SINIRLAR + kısa elle kabul listesi (mobil: gerçek telefon + gerçek tünel kullanıcının kendi 2.4.7 kurulumunda); (4) PR (claude/compassionate-galileo-f9kghg → master) aç, PR CI 7/7 → squash birleştir (TESLİM YETKİSİ), master CI oku; (5) kullanıcı yayını açar: https://github.com/ceougur/ofis---y-netimi/releases/new?tag=v2.4.7&target=master&title=DestekOfis%202.4.7 ; "yayımladım" → 5 dosya bayt bayt + eski güncelleyiciler "available"; (6) site PR'ı (kart + #mobil + kılavuz PDF web/indir/) aç, kullanıcının "birleştir"iyle; (7) tanıtım görseli yayından sonra paylaşılır. BİLİNEN SINIR adayları (teslim notu): D1 ~12 milyon TL üstü faturada 1366 px'te ekstre taşması (kutu içi kaydırma); D9 lisans elle denetlendikten sonraki ≤30 sn içinde açılan telefon "ofis kapalı" görebilir; günlük 50 yeni ofis tavanı küresel; kapıcı temizlik yarışı ve devralma sonrası boş özet (sonraki sürüm). 30 dk RAPOR görevi bu oturumda kurulu (sıkıştırmadan sonra da gelir).
- İSTEK (kullanıcı, 29.10.2026 ~18:55 UTC: "hız testi falan yaptık mı?" → yanıt: tam npm test + hiz-243-arka-plan e2e 13/13 koştu; büyük ölçek koşusu 2.5.0'a bırakılmıştı; MOBİLE ÖZEL hız ölçümü YOK (kör nokta) → öneri; kullanıcı: "uzun doğrulama bitene kadar yapalım, önerini uygula"): MOBİL ÖZET ÖLÇÜMÜ — tools/olcek-210.mjs veri aşaması (3.000 cari, ~112.000 para satırı, 2 şirket; programın kendi API'si) üzerinde: özetin hazırlanma süresi + boyutu (1–3 kullanıcı), özet hazırlanırken masaüstü istek süreleri (özetsiz hâlle karşılaştırmalı) + olay döngüsü gecikmesi. Kabul edilebilirse rakamlar teslim notuna; değilse kullanıcıya getirilir (kendiliğinden düzeltme yok). Ürün kodu değişmez; kanıt paketlemeden sonra depoya.
- 2.4.7 YAYIMLANDI (kullanıcı, 30.10.2026 ~03:25 UTC: "yayımladım"): yayındaki 5 dosya teslim edilenlerle BAYT BAYT AYNI (docs/kanit/2026-10-30/247-yayin/yayin.sha256); eski sürümlerin GERÇEK güncelleyicisi (v2.4.6, v2.4.5, v2.4.4 kodu) CANLI yayına karşı "available 2.4.7", anahtar destekofis-2026-1, paket indirildi + özet doğrulandı (bu ortamdan API kısıtlı → yedek yol latest/download; canli-247.out). "Sürüm yayımla" release.yml #40 v2.4.7'de başladı (sonucu okunacak). SİTE PR ceougur/destekofis#24 (mobil bölümü + kılavuz PDF 36942a0d) açıldı — kullanıcının "birleştir"ini bekler. Tanıtım görseli artık paylaşılabilir.
- 2.4.7 BİRLEŞTİ ve TESLİM EDİLDİ (30.10.2026 ~01:30 UTC, gece yetkisiyle): Uzun Doğrulama #840 03e0f55a 27/27 YEŞİL (uzun koşu 3 sa 27 dk), CI #920 7/7, windows.yml #62 + #63, PR ceougur/ofis---y-netimi#37 CI #922 7/7 → squash master 151b7119 (ağaç baf7bf47 ile aynı f340fe9e), master CI #923 7/7. Paket 6004b581'den (sonrası yalnız belge): zip 776cc7b6, bildirge 1c57ceed, kılavuz 36942a0d, kurulum fdcc2946 (parca0/1 + BIRLESTIR.bat); arşiv zip + kaynak paketi 4 parça; kanıt docs/kanit/2026-10-29/247-paket. Kullanıcıya gönderildi. SIRADAKİ (kullanıcı): yayını aç https://github.com/ceougur/ofis---y-netimi/releases/new?tag=v2.4.7&target=master&title=DestekOfis%202.4.7 → "yayımladım" → 5 dosya bayt bayt + eski güncelleyiciler available → site PR'ı (mobil kartı + #mobil + kılavuz PDF web/indir/, site dalı 3704d4d) kullanıcının "birleştir"iyle → tanıtım görseli paylaşımı. Dala master birleştirildi (6f6cc334; zorla gönderme otomatik izinde reddedildi, yıkıcı olmayan yol); sonraki iş bu dalda master üstünde.
- YETKİ (kullanıcı, 29.10.2026 ~20:57 UTC: "ben yatıyorum, 6 saat sonra gelirim. pr birleşmiş ve paket teslim edilmiş olursa linki verirsin yüklerim. aksi durumlarda 5 dk soruna cevap vermezsem eğer; piyasada uygulanan en modern ve yaygın önerini uygula. her yarım saatte bir testleri kontrol et"): CI #920 + UD #840 + windows.yml #62/#63 (03e0f55a) YEŞİL okununca ana oturum kendiliğinden: release.mjs --anahtar + build:windows → 5 dosya + arşiv zip (TESLİM BİÇİMİ) → PR → PR CI 7/7 → squash (TESLİM YETKİSİ) → master CI → yayın bağlantısı. Kırmızı/soru çıkarsa soru öneriyle sorulur, 5 dk yanıtsızsa en yaygın/modern öneri uygulanır ve "5 dk yetkisiyle" iş listesine yazılır; SINIRLAR aynen (yayını kullanıcı açar; canlı Supabase/DNS/kapıcı dağıtımı, müşteri/kimlik bilgisi, ders 43 para kuralı yetkiye girmez). Yarım saatte bir kontrol (30 dk RAPOR görevi).
- KARAR (kullanıcı, 29.10.2026 ~20:40 UTC, iki seçenekli soruya: "2.4.7'de düzelt, UD yeniden (Önerilen)"): mobil özet ölçümünün M-H1 (/api/mobil/cash bütün kasa hareketleri → 3 kullanıcıda özet > 8 MB, 413) ve M-H2 (özet iç istekleri arasında olay döngüsüne sıra yok → masaüstü ~10 sn bekler) bulguları 2.4.7'de düzeltilir: mobil Kasa yanıtından entries atılır + icIstek her çağrıda setImmediate; kırmızı/yeşil kalıcı testler, CI 7/7, mobil e2e'ler, tam npm test; ürün kodu değiştiği için Uzun Doğrulama yeni commit'te YENİDEN (29.10 KOŞUL kuralı); ölçüm yeniden koşulup teslim notuna. Ayrıntı docs/2.4.7-IS-LISTESI.md "MOBİL ÖZET ÖLÇÜMÜ".
- SORU/İSTEK (kullanıcı, 29.10.2026 ~14:20 UTC: "uzun koşuya başlamadan önce son adayı kendin windowsta çalıştırıp gerçek kullanıcı gibi kullanacaksın değil mi derslerimiz gereği?") → EVET, UD'den ÖNCE ve şu sırayla: (1) son aday tam kapı — tam npm test + ci.yml'nin bütün e2e'leri + CI dışı senaryolar (gerçek Chromium programı kullanıcı gibi sürer; ders 8/37) + günlük iş akışı baştan sona (kişi → cari → taksit → tahsilat → kasa → rapor) + MOBİL akış telefon boyutunda (eşleme karekodu, giriş, telefondan tahsilat, sunucu kapalıyken son özet, cihaz silme) yerel kapıcıyla, ekran görüntüleriyle; (2) GERÇEK WINDOWS: CI Windows Node 22/24 bütün testler (tünel süreç yönetimi sahte cloudflared ile dahil) + windows.yml ×2 (gerçek kurulum .exe: sessiz kurulum, servis, ilk giriş, veri kaydı, yedek, yeniden başlatma, otomatik güncelleme, yeniden kurulum, kaldırma; ders 18); (3) ancak sonra UD. SINIR (kullanıcıya söylendi): bu kapsayıcı Linux; Windows masaüstünde fareyle tıklama ve gerçek telefon + gerçek tünel buradan yapılamaz → teslimde kısa ELLE KABUL LİSTESİ (KANIT 5; mobil adımlar + beklenen sonuç), yayın açılmadan önce kullanıcının kendi Windows kurulumunda.
- KARAR (kullanıcı, 29.10.2026 ~14:25 UTC: "windows kurulum denemesi iki koşu ile uzun doğrulama github'da aynı anda ücretsiz yapılabilir mi? windows koşularında hata çıkarsa uzun koşu tekrar başlatılır, zamandan tasarruf") → EVET (derslere aykırı değil; 2.4.6'da UD #698 tam kapıyla paralel başlatılmıştı): depo açık → standart koşucular ücretsiz; aynı anda iş sınırı (~20) yalnız kuyruk yapar. KOŞUL: aynı son aday kodu (UD + windows.yml ×2 aynı commit), gezinti temiz + o commit'in CI'si 7/7 görülünce üçü BİRLİKTE başlatılır; yerel tam kapı paralel sürer. Windows ya da tam kapı ürün kodu değiştirirse UD yeni commit'te yeniden (bedeli yalnız süre). Ders 18: iki Windows koşusu ayrı ayrı yeşil okunur; ders 21: her koşu ayrı okunur.
- KARAR (kullanıcı, 29.10.2026 ~15:15 UTC: "ajanın düşük bulgularını inceledim, bence bunlar da düzeltilmeli") → 2.4.7 son aday gezintisinin DÜŞÜK bulguları D1–D9 BU SÜRÜMDE düzeltilir (27.10 "DÜŞÜK sonraki sürüme" kuralının bu liste için istisnası; baş mimar katıldı: çoğu metin/görünüm, ~1–2 saat, tam kapı henüz koşmadı). D7 (ders 43 sorusu, kullanıcı yanıtı "Boş gelsin, seçtirsin (Önerilen)"): telefondan Tahsilat Gir'de carinin AÇIK taksit kartı varsa Tahsilat Yeri BOŞ gelir, seçilmeden Kaydet çalışmaz (masaüstündeki "Taksite Yaz / Taksit Dışı" sorusuyla aynı düzen); taksit kartı yoksa bugünkü gibi. Ayrıntı docs/2.4.7-IS-LISTESI.md "SON ADAY GEZİNTİSİ".
- İSTEK (kullanıcı, 29.10.2026 ~17:05 UTC, tanıtım görseliyle: "buna artık cebinizde, mobil sürüm yayında gibi bir cümleyi ön plana çıkartarak hazırlar mısın") → YAPILDI: docs/pazarlama/DestekOfis-Tanitim-Mobil.png (1080×1350; aynı tasarım dili, Manrope + DM Sans, özgün logo; "YENİ · Mobil sürüm yayında" + "Artık cebinizde." + telefon çizimi; özellik listesi 5 madde; "Mobil dahil tüm özellikleriyle"), kaynak …-kaynak.html + çizim betiği. UYARI (kullanıcıya söylendi): "yayında" cümlesi 2.4.7 yayımlanınca paylaşılır.
- İSTEK (kullanıcı, 29.10.2026 ~17:10 UTC: "destekofis.net sitenin üst kısmına da bu mobil resmini, mobil içeriğini ekleyelim") → YAPILDI site dalında (claude/compassionate-galileo-f9kghg): hero rozeti "YENİ · Mobil sürüm yayında · Artık cebinizde" (#mobil), menüde "Mobil", hero altında #mobil bölümü (başlık "Artık cebinizde.", 4 madde, tanıtım görseli web/assets/destekofis-mobil.webp 720×900 69 KB); masaüstü/telefon/koyu tema ekran görüntüsüyle denetlendi (taşma yok, hata yok). YAYIN GÜNÜ kılavuz PDF'iyle aynı site PR'ında birleşir (önce değil).
- İSTEK (kullanıcı, 29.10.2026 ~12:20 UTC: "web sitesine yeni özelliği yazdın mı, kullanım kılavuzuna mobil hap bilgiyi ekledin mi?") → İKİSİ DE YAPILMAMIŞTI (kontrol edildi: kılavuzda mobil bölüm yok, sitede mobil kartı yok). 2.4.7'ye: (a) kılavuza "Telefondan Kullanım" hap bilgisi (eşleme karekodu, ana ekrana ekle, giriş, sunucu kapalıyken son özet, telefondan tahsilat/ödeme/stok, 3 cihaz, cihaz silme) — ekran adları koddan; PDF ve sürüm satırı paket adımında (ders 42); (b) site index.html özellikler bölümüne mobil kartı — site PR'ı yayın günü kılavuz PDF'iyle birlikte birleşir (yayından önce canlıya çıkmaz). EK (kullanıcı, 29.10.2026 ~12:25 UTC: "kılavuzun başında excel ve sheets konusu çok uzun geçiyorsa oraları da kısalt") → kılavuzun baştaki Excel / Google Sheets bölümleri kısaltılır (yalnız gereken adımlar; para sınırlaması cümleleri kalır).
- KARAR (kullanıcı, 29.10.2026 ~12:55 UTC: "demosu biten kullanıcı mobili de kullanamasın lisans alana kadar") → ZATEN BÖYLE (koddan: program mobile-remote.mjs licenseOk = lisans yazılabilir; deneme dolunca salt okunur → bütün uzak istekler + karekod 403 remote-license; kapıcı belirteç bitiş anında kapanır, kapi-247 testi). Kalıcı test eklendi: test/mobil-deneme-bitis-247.test.mjs (deneme bitince oturum/sayfa/giriş/karekod 403, eşleme silinmez, lisans alınınca aynı telefon döner) — mutasyonla (licenseOk hep true) KIRMIZI "deneme bitince eşli telefonun oturumu kapanmalı · actual 401", yeni kodda yeşil.
- TESLİM YETKİSİ (kullanıcı, 29.10.2026 ~12:10 UTC: "paket ve teslimde exe dosyası 30 mb üzerine çıkar muhtemelen, iki parça verip birleştir bat veriyordun eski oturumda, ayrıca uzun cl koşusu bitince birleştirme işini de yap. bana paketi yükleyeceğim github linkini ver"): 2.4.7 teslimi TESLİM BİÇİMİ düzeninde (5 dosya ayrı; exe 30 MB üstüyse parca0 + parca1 + BIRLESTIR.bat). PR → master BİRLEŞTİRME YETKİSİ VERİLDİ: Uzun Doğrulama (+ son aday tam kapı, PR CI 7/7, windows.yml ×2) YEŞİL görülünce ana oturum PR'ı kendisi birleştirir (squash), master CI'sini okur; yayını (etiket v2.4.7 + 5 dosya) kullanıcı açar: https://github.com/ceougur/ofis---y-netimi/releases/new?tag=v2.4.7&target=master&title=DestekOfis%202.4.7 .
- 2.4.7 BAŞLADI (kullanıcı, 27.10.2026 ~06:15 UTC: "edm için yapılacak düzenlemeyi medium, mobil arayüz işi için hıgh eforlu ajanlar görevlendirerek başla"): iş listesi docs/erp/2.4.7-IS-LISTESI.md (madde 0a ile docs/2.4.7-IS-LISTESI.md); EDM ajanı (A1/A2/B1/B2) MEDIUM — kullanıcının açık kararı, CLAUDE.md e-Belge xhigh kuralının yerine bu iş için; bağımsız sayaç kâhini xhigh (kâhin kuralı); mobil arayüz dalga 1 (salt okunur, program içinde) HIGH. Ajanlar ayrı git worktree dallarında (is/edm-247, is/mobil-arayuz-247, is/kahin-sayac-247); birleştirmeyi ana oturum yapar. 30 dk ara rapor görevi kuruldu. KARAR (kullanıcı, 27.10.2026: "önerilerin uygun"): EDM sayacı S1–S5 önerildiği gibi (gönderim ayı; şirket başına ayrı; kendi ETTN'li 11048 kesinleşme; geri yükleme/sıfırlama sayacı etkilemez → sayaç şirket dosyası dışında; son 3 ay = bu ay + önceki 2, ay başına satır) — ayrıntı docs/2.4.7-IS-LISTESI.md "KARARLAR". Üç dal çalışma dalında birleşti (27.10). KARAR (kullanıcı, 27.10.2026: "sorularına önerini uygula, kör nokta için en yaygın ve basit çözümü yap"): kâhin farkı F1 ikinci gönderimin ayı, F2 sayılır (ilk açık iz ayı); sayaç defteri her şirket yedeğine kopyalanır, geri yüklemede yalnız birleştirilir (azalmaz). KARAR (kullanıcı, 27.10.2026: "işi büyütme, genişletme"): 2.4.7 kapsamı iş listesindeki maddelerle sınırlı; yeni madde, ek senaryo turu, ek kâhin turu AÇILMAZ. Sayaç kâhini için son tur: devam eden iki iş (kâhine Y1/Y2/Y5, programda Y3) bitince BİR karşılaştırma; kalan fark müşteriye/paraya sorun değilse BİLİNEN SINIR ya da sonraki sürüm. KARAR (kullanıcı, 27.10.2026: "çıkacak küçük bulgular eğer programın çalışmasına, müşteri için soruna yol açmayacaksa bir sonraki sürümde düzeltilsin"): 2.4.7'de bulunan küçük bulgu (DÜŞÜK; programın çalışmasını, müşteri verisini/parasını, e-Belgeyi, güvenliği ve yetkiyi etkilemeyen) bu sürümde düzeltilmez, iş listesi "SONRAKİ SÜRÜME" bölümüne yazılır; YÜKSEK/ORTA ve müşteriye sorun çıkaran her şey bu sürümde düzeltilir (KARAR REVİZYONU ile aynı). Kuşkuda sınıf "müşteriye sorun çıkarır" sayılır.
- (Arşiv 29.10) 26.10 sıkıştırma notu (2.4.6 kapandı, 2.4.7 tahmini 5–6,5 gün, kör noktalar: cloudflared kuruluma konmaz, Worker ücretsiz ~100k istek/gün, Cloudflare Access kullanılmaz) arşivde.
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

## Arşiv 31.10.2026 (2.4.8 sürerken; CLAUDE.md Açık iş'ten AYNEN taşındı — kullanıcı 31.10: "derslerimizi ve anayasamızı gözden geçir"; yerini alan durum notları, WhatsApp yön araştırmasının uzun hâli, kapanan 2.4.7 canlı bulgusu, L1 ile yapılan erteleme)

- (YERİNE GEÇTİ → DURUM 8) SIKIŞTIRMA ÖNCESİ DURUM 7 (30.10.2026 ~19:35 UTC; kullanıcı: "sıkıştırma için hazırlık yap, yeni bulguları ve açık işleri 2.5.0'a göre ayarla"). DURUM 6'nın YERİNE GEÇER (WhatsApp yönü kararları sürer). KAYNAK: docs/2.4.8-IS-LISTESI.md (madde tablosu + "Kararlar" + "SON ADAY TEST PLANI" + "2.5.0'A DEVREDENLER"); plan docs/erp/WHATSAPP-API-PLANI-2.4.8.md (§7a 32 karar + R1–R3).
  2.4.8 BİTEN VE ANA DALDA (claude/compassionate-galileo-f9kghg ucu 67d36945): 0a, 0b, P0, MZ, K0 (kâhin test/bagimsiz/whatsapp-248, 145 senaryo), W1, W2, W3, W5, W6 (aydınlatma metni ONAYLANDI 2.4.8-1), W9, W4 (Otomatik Gönder + WhatsApp Web ile Gönder), M1–M5 (iPhone: simgede Karekodu Okut; Son Özeti Göster üstte); site deposu ceougur/destekofis aynı ad dal e6f6126: C1 Cloudflare (Mobil) kartı + DNS kaydı ölçüsü (canlı: destekofis.net Free, kota 200, 13 kayıt). CI: #925–#936 hepsi YEŞİL; #937 (13ee1890 W4) ve #938 (8ef48138 M4/M5) SÜRÜYOR → okunacak (gh 502 verirse mcp__github__actions_list ile).
  SÜREN (ajanlar, ayrı worktree, PUSH YOK; bitince ana oturum yeniden koşar → birleştirir → iş listesini çizer): (1) /home/user/wt-kapi-248 dal is/kapi-248 (taban 8ef48138) L1 lisans hoşgörüsü + silme (KARAR L1: deneme bitince mobil hemen kapanır, 30 günde kayıt silinir; ücretli lisans bitince 30 gün salt okunur, 30. gün kapanır + kayıt hemen silinir; engelli hemen kapanır, 30 günde silinir) → K1 kapıcı temizlik (a)–(c) → W7 WhatsApp'ı Bağla (kapi/wa/bagla; App Secret yalnız kapıcı); (2) /home/user/wt-ithal-248 dal is/ithal-248 I1 içe aktarma istek kimliği 4982bf30 — dar kontrol (ders 32) PARA YOLUNDA BULGU YOK; ORTA-1 (409 iletisi çift yüklemeye yönlendiriyordu) + DÜŞÜK-2 test düzeltmesi yapılıyor → sonra yalnız fark için dar kontrol (durma kuralı) → birleştir.
  SIRADAKİ: W8 kılavuz (HTML + PDF yeniden üret, ders 42: iPhone "Ana Ekrana Ekle → simgede Karekodu Okut", Elle Bağla adımları, aydınlatma, KVKK md. 9 standart sözleşmede 5 iş günü Kurul bildirimi, Bu Ay sayacı) → SON ADAY TEST PLANI T1–T16 (T1 K0 kâhin sürücüsü + karşılaştırma; T2 bağımsız gözden geçirme; T3 UI/UX ajanı + kullanıcıya 5–6 ekran görüntüsü; T4–T9 iş akışı/göç/arıza/tarih/güvenlik/ölçek; T10 tam kapı; T13 UD + windows.yml ×2 paralel; T15 paket; T16 canlı kapıcı dağıtımı kullanıcı onayıyla).
  KULLANICI KARARLARI (bu oturum): S1–S4 A (5 dk), K1–K3 A, R1–R3 (5 dk), M4 "iPhone'da yalnız simge" (Safari'de yeni eşleme yok), M5 "düğme üstte + uyarıda cümle", wa.me yolu kapanmaz, D0 (gerçek Meta denemesi) YAYINDAN SONRA kullanıcıda (tutmayan META_D0 varsayımı → ara düzeltme), L1 A, aydınlatma metni "en yaygın kullanımla" onaylı, açılış kayıtları düzeni 2.5.0'a.
  KULLANICININ İŞLERİ: (yayından sonra) Meta belirteci + Phone Number ID + WABA ID + App ID programa (Kurulum Rehberi); (site birleşince) Cloudflare salt okunur belirteç [Account Analytics/R2/Tunnel Read + Zone Read + DNS Read, yalnız destekofis.net] → Vercel CF_ACCOUNT_ID + CF_ANALYTICS_TOKEN → Redeploy; vergi kaydı / EDM sözleşmesi / lisans sözleşmesine veri işleme maddesi (sürer); kökte /kos-mutasyon.out (8 bayt, ajan hatası) elle silinebilir.
  ORTAM: 30 dk rapor görevi c13458ff (oturuma bağlı; yeni oturumda yeniden kurulur); e2e için Playwright bağı PLAYWRIGHT_BROWSERS_PATH=<not defteri>/w1-248-q7m3/pw (1194 → 1243); graph.facebook.com bu ortamdan erişilebilir (rupload kapalı, gerekmiyor); disk ~7 GB boş (5 GB altına düşerse eski worktree/not defteri kopyaları silinir — yalnız tam yol).
- (YERİNE GEÇTİ → DURUM 7) SIKIŞTIRMA ÖNCESİ DURUM 6 (30.10.2026 ~15:00 UTC; kullanıcı: "sohbet sıkıştırma için hazırlık yap"). WHATSAPP KONUSUNUN SON HÂLİ (ayrıntı aşağıdaki "KARAR → 2.4.8" maddesinde):
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

## Arşiv 31.10.2026 (2) (CLAUDE.md Açık iş'ten AYNEN — DURUM 9 yerine geçti)

- SIKIŞTIRMA ÖNCESİ DURUM 8 (31.10.2026 ~03:30 UTC; kullanıcı: "sıkıştırma hazırlığı yap"). DURUM 7'nin YERİNE GEÇER. KAYNAK: docs/2.4.8-IS-LISTESI.md (son maddeler "SON ADAY T BAŞLADI"dan sonrası; "2.5.0'A DEVREDENLER"). 2.4.8 BÜTÜN MADDELER ÇİZİLİ (D0 kullanıcıda, yayından sonra). ANA DAL (claude/compassionate-galileo-f9kghg) ucu fd52d049: L1/K1/W7/W8 + I1 birleşik; CI #941 (df238b99) Windows 22 + e2e YEŞİL, Windows 24 yalnız altın test (gün dönümü, TEST hatası; düzeltme is/altin-248). SON ADAY: T1 kâhin karşılaştırması (sürücü), T2 bağımsız gözden geçirme, T3 UI/UX (6 ekran kullanıcıya gönderildi), T5 göç (bulgu yok), T4 iş akışı 184/184 + T7 tarih 40/40, T6 arıza/yedek + T8 güvenlik BİTTİ; bulguları düzeltildi ya da 2.5.0'a. ADAY 1 (wt-aday1-248 is/aday1-248 aa76592c) tam npm test 4163/4163. SÜREN: wt-t2fix-248 is/t2fix-248 (uç 2afd1d53) — WhatsApp gönderim çekirdeği düzeltmeleri; ajan şu an dar kontrol 2 bulgularını (ORTA-A çift ileti Yol 2, ORTA-B https TLS testi + mutasyon, DÜŞÜK-1) bitiriyor, SONRA kullanıcı kararlarını kodlayacak: T2-1 A (donem.mjs; test/whatsapp-t2-1-248.kural-bekliyor.mjs → .test.mjs), P3 sayılmaz (defter.mjs R3). Ajan bitince: yalnız son farka DAR KONTROL 3 (xhigh; durma kuralı) → bulgu yoksa ADAY 2 = ana dal + is/t2fix-248 + is/altin-248 (gün dönümü test düzeltmeleri) + is/t4-248 (yeni e2e senaryo-is-akisi-248, senaryo-tarih-248) + is/t6-248 (betikler + kanıt) → tam npm test (ana oturum) → T9 ölçek TEK BAŞINA (2.000 carilik toplu gönderimde yanıt süresi/bellek + mobil özet ölçümü docs/kanit/2026-10-29/mobil-ozet-olcum yinelenir; not defteri olcum-mobil) → T10 tam kapı (tam npm test + ci.yml BÜTÜN e2e + CI dışı senaryolar; yeni iki e2e ana oturumca, ders 16) → push → CI → T13 Uzun Doğrulama + windows.yml ×2 AYNI commit'te paralel (ders 18: CRLF ve altın düzeltmeleri Windows'ta 2. yeşil) → T15 paket: package.json + CHANGELOG + kılavuz kapağı 2.4.8, kılavuza B1 notu ("Ödeme Hatırlatma vadesi geçmiş taksiti olan carilere gider") + Uygulama Kimliği "isteğe bağlı" + başlık "WhatsApp Business API Bağlantısı" (T3 DÜŞÜK-4), PDF yeniden üret + pdf-denetle (ders 42); release.mjs imza anahtarı kullanıcının yüklediği dosya (yoksa iste); build:windows; 5 dosya + arşiv; teslim notu DENENEN/DENENMEYEN/BİLİNEN SINIRLAR + BÜTÜN BAŞ MİMAR KARARLARI (iş listesinde) + elle kabul (ilk madde: canlı kapıcı dağıtımı onayı; gerçek Meta D0 — TTL kabulü, subscribed_apps override_callback_uri, şablon components) → PR → master BİRLEŞTİRME (kullanıcı talimatıyla ÖNCEDEN ONAYLI, koşul T1–T15 yeşil) → kullanıcıya yükle bağlantısı. T16 canlı kapıcı (wrangler deploy bulut/kapi + gizliler WA_UYGULAMA_SIRRI, WA_META_DOGRULAMA + saatlik cron) ONAYLANDI 31.10 ~03:15 UTC (yukarıda KARAR; birleştirmeden sonra, yayından önce). KULLANICI KARARLARI (bu oturumda, ayrıca): S-L1a/S-L1b A, P14–P17 A, S-PC A, P1/P2/P5 A (5 dk), T2-1 A, P3 sayılmaz, B1 B (kullanıcı). ORTAM: 30 dk rapor c13458ff (oturuma bağlı); güvenlik alarmı trig_01Tyxi6q9Kt2Kcd7nZE7xCVj 05:16 UTC (ortam kopmasına karşı; gerekirse yeniden kur); Playwright PLAYWRIGHT_BROWSERS_PATH=<not defteri>/w1-248-q7m3/pw; disk ~11 GB; developers.facebook.com ve developers.cloudflare.com ağ izninde YOK (Meta TTL üst sınırı ve Cloudflare alt istek sınırı doğrulanamadı — D0/BİLİNEN SINIR). Eski 2.4.7 .claude/worktrees/agent-* ve not defteri mobilerisim247-tasima kalıntıları (dokunulmadı).
