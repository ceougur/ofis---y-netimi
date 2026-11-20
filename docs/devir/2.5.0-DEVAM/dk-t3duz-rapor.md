# Dar kontrol raporu: tek aday düzeltme turu (b55f7b34; eski kod b55f7b34^1)

**Sonuç: YÜKSEK ve ORTA bulgu yok. Gerileme de yok.** Kod değiştirmedim, commit ya da push yapmadım. Worktree temiz: `b55f7b34`, izlenmeyen tek şey görev gereği kurduğum `node_modules` bağı.

Ortam: yük 1,59 / 4 çekirdek, boş bellek 10 GB, boş disk 6,9 GB. Yük koşuları `flock -s` altında ve sırayla çalıştı. Bütün betikler `HUKUK_LICENSE_URL=http://127.0.0.1:9` ile, gerçek programda koştu.

## GERİLEMELER
Yok. Temiz 100 bin satırlık veride eski ve yeni kodun çıktılarını karşılaştırdım. Her koşuda 299 anahtar vardı: 63 Rapor Merkezi raporu × 3 dönem, Banka ve POS Hareketleri 5 Yol × 5 Hesap × 4 dönem, mizan, alt hesap mizanı, Kasa penceresi (rapordan önce ve sonra), Şüpheli Alacaklar, cari listesi, Genel Bakış, Mutabakat Testi ve şüpheli kaydı olan carilerin kartları.
- **Bilerek değişen tek yer:** Banka ve POS Hareketleri, Tüm Hesaplar seçimi; Tümü, Havale ve POS yolları.
- **Değişmeyenler:** öbür 88 Banka ve POS kombinasyonu (tek hesap, Hesabı Atanmamış, Kart, Kredi), öbür 62 rapor, mizan, Mutabakat Testi ve Kasa penceresi birebir aynı.
- **Tek ek fark:** 001'in İşlem Geçmişi. Nedeni ölçüm aracımın kendi oturum açma kayıtlarının sırası; beklenen bir fark.
- **İki şirket ve iki saat dilimi:**
  - Şirket seçimi kalıcı kaldığı için "UTC 001" koşusu fiilen 002'yi okudu.
  - Sonuç: 001 yalnız İstanbul saat diliminde, 002 iki saat diliminde karşılaştırıldı.

## İLK MADDELER

**1. G1 (betikler `b/g1.mjs`; çeşitler: Devir Kapanışlı ve Devir Kapanışsız, ek kaynaklar EXTRA, yıl dönümü YIL)**
- **Denenen kaynaklar:** hesapsız havale, hesapsız POS, hesapsız kurumsal kart çıkışı, Devir Kapanışı fişi, peşinli faturanın havale ve POS ödemesi, taksit tahsilatı (havale ve POS), hesapsız Kasa ↔ Banka transferi. Hepsi beş Yol × 5–8 dönem × (Tümü / Hesabı Atanmamış) ile koşuldu.
- **Rapor = defter = kova, her durumda:**
  - Devir Kapanışlı: 102 103.500 + 108 700 = **104.200**, rapor 104.200.
  - Devir Kapanışsız: 102 103.500 + 108 3.700 = **107.200**, rapor 107.200.
  - Ek kaynaklarla, Devir Kapanışsız: **108.300**, rapor 108.300.
  - Hesap + Hesabı Atanmamış kovası her durumda aynı toplamı veriyor.
- **Ara dönemler** defterin o günkü değerini veriyor. Örnek: 01.10–01.10, Devir 3.450, Dönem Sonu 104.350.
- **Sınırlar:**
  - Açılış günündeki hesapsız havale sayılmıyor, kovaya düşüyor (S189 = A'ya uygun).
  - 31.12.2025 tarihli hesapsız havale sayılıyor; "Bu Yıl" devri 0.
- **Büyük veride:**
  - 001: rapor 60.023.076,74 = 102 4.190.643,47 + 108 55.832.433,27 (eski kodda 21.823.914,66).
  - 002: rapor 14.551.990,97 = defter (eski kodda 20.089.924,49).
  - Bu büyüklük farkı S215'te bilinen etki.
- **Kasa raporları değişmedi:** beş Kasa raporu ve Kasa penceresi eski ↔ yeni birebir aynı. Banka ve POS raporu açıldıktan sonra, saklı okuma varken de aynı.

**2. B1 (`b/b1.mjs`, `b1-par.out`)**
- **Yazım sırası kaynağı:** `created_at`; faturada `issued_at`; kart kapanışında `updated_at`. Eşitlik hâlinde rowid.
- **Yeni kod:**
  - Önce bağsız, sonra bağlı yazılınca: 120 0 / 128 600.
  - Önce bağlı, sonra bağsız yazılınca: 120 100 / 128 500.
  - İki yükleyici aynı sonucu veriyor (SQL kalanı = 128 = kart kuyruğu), tarama bulgusuz.
- **Eski kod:** sonuç kimlik sırasına bağlı. Aynı yazım sırası üç koşuda hem 100/500 hem 0/600 verdi.
- **Korunuyor mu:**
  - Düzenleme, yedeğin yöntemi olan VACUUM INTO (rowid korunuyor) ve yedekten açılış sonrasında dağılım aynı.
  - Gerçek saatte sil + geri al sonrasında da aynı (geri alma `created_at`'i koruyor).
  - Eşzamanlı iki istek (3 koşu): sunucu sırayla işliyor, sonuç yazım sırasına uyuyor.
- **Toplam değişmiyor:** bakiye ve kart bakiyesi bütün sıralarda 600.

**3. S212 (`b/s212.mjs`)**
- **Karar örneği:** yeni kodda 120 2.000 / 128 0, kayıt kapanıyor; eski kodda 1.000 / 1.000. Karar metnine (A) uyuyor.
- **Sıra varyantları aynı sonucu veriyor:** önce şüpheliye alma yazılıp sonra öncesine tarihli P1; ya da önce P2, sonra P1.
- **Sil ve geri al:** P2 silinince 2.000 / 1.000, geri alınınca 2.000 / 0. Geri alındıktan sonra Şüpheliden Çıkar 409 doubtful-closed veriyor.
- **Öbür durumlar:**
  - Kısmi bağ 400: 2.000 / 600.
  - Bağlı çek: 2.000 / 0.
  - P2 şüpheliye almadan önce tarihli: iki kodda 1.000 / 1.000.
  - Değersiz Alacak 300 sonra P2: 1.700 / 0, kart bakiyesi 1.700.
  - P2 F2'ye bağlı: iki kodda 2.000 / 0.
- **Serbest kalan bağsız ödeme:** kuyrukta vadesi en eski açık faturaya (F2) gidiyor; karar metnindeki "kendi tarihinde yeniden dağılır" ile uyumlu.

**4. e2e senaryo-banka-210**
- Yeni kod: **429/429 GEÇTİ**. Eski kod, eski senaryoyla: **428/428 GEÇTİ**.
- **Adım 46'yı senaryonun kendi elle hesabından kontrol ettim:** Gerçek Banka 160.484,25; Giriş 21.500 (ABC 20.000 + 1.500); adım 45'te 102.00 yok, 108 = 0.
  - Tümü = 160.484,25, Dönem Giriş 21.500.
  - Eski 26.500 / 165.484,25 değerleri, açılışta sayılan 5.000'lik eski havaleyi fazladan içeriyordu.
  - Yeni beklenti S214 = A'dan geliyor; bir gerilemeyi örtmüyor.

**5. Hız değişikliklerinin eşdeğerliği**
- Yukarıdaki büyük veri karşılaştırmasında, G1/B1/S212'nin bilerek değiştirdiği yerlerin dışında her şey birebir.
- Tüm Hesaplar'ın yeni değerleri defterle aynı.
- Ürünle aynı elden çıkan eşdeğerlik testine dayanmadım; karşılaştırma benim betiğimle.

**6. Testin dişi**
- Değişen 10 test dosyası yeni kodda: UTC 100/100, İstanbul 100/100.
- Yeni testler eski kodda beklenen nedenle kırmızı:
  - S181: eski ileti.
  - S212: üç değer farkı.
  - B1: değer farkı.
  - hesapsiz-tumu: 3; gg2-gosterge: 1; banka-210-raporlar: 2; raporlar-230: 1; defter-kaynak-iz: 1.
- N7, N8 ve N11 testleri eski kodda yeşil; bunlar mevcut davranışı kilitliyor, dişleri mutantta.
- Mutasyon aracı üç kez koşuldu (İstanbul / UTC / İstanbul): **18/18 × 3 YAKALANDI**. Ara sıra yaşayan mutant yok.

**7. S181 (`b/s181.mjs`)**
- **Çek ve senette ret aynı biçimde:** 409 ledger-integrity, ileti "… Tutarı 500,00 TL'ye indirin ya da Kapatılacak Fatura bağını kaldırın.", `suggestedMinor` 50000. Nakit yolu aynı öneriyi veriyor.
- **Veri tabanında iz yok:** reddedilen istekten sonra altı tablonun sayıları aynı.
- **Sınır:** 500,01 reddediliyor (öneri 500); tam 500 KABUL ediliyor (120 = 0).
- **Düzeltme ve bağ:** tutarı 600'e çeken düzeltme aynı öneriyle reddediliyor; bağı kaldırmak kabul ediliyor.
- Faturanın şüpheli payı 400 olan senaryoda da önerilen tutar doğru.

## BAŞ MİMAR KARARLARI (K1–K5)
Beşi de karar metnine uyuyor; yukarıdaki betik çıktıları dayanak.
- **K1 (B1):** uygulanmış. Kalıcı test 2 yazım × 2 kimlik sırasını kapsıyor.
- **K2 (S212 = A):** karar örneği aynen tutuyor (2.000 / 0).
- **K3:** DÜŞÜK'ler birleşik turda; S181 iletisi doğru.
- **K4 (S214 = A):** rapor = defter = kova; hem küçük hem büyük veride doğrulandı.
- **K5:** hız değişikliği davranışı değiştirmemiş.

## KULLANICIYA SORULMALI
Yok.

## SONRAKİ SÜRÜME (2.5.1)
Hepsi DÜŞÜK. Süzgeçten geçirdim: para, bakiye ya da defter toplamında bozulma, veri kaybı, KVKK ya da gerileme yok.
1. **Aynı milisaniyede yazılmış iki alacak sil + geri al sonrasında yer değiştiriyor.** Geri alma rowid'i yeniliyor; `created_at` eşit olduğunda (sabit saatle zorladım) sıra çeviriyor: 120/128 dağılımı 0/600 → 100/500.
   - Gerçek saatte etki yok. Ancak aynı milisaniyede yazım (toplu yükleme) + aynı gün bağlı bir satır + silip geri alma birlikte gerekiyor.
   - Bakiye değişmiyor, iki yükleyici tutarlı kalıyor.
   - Dosya: `server/lib/bank/doubtful.mjs` (doubtfulCredits'in `seq` kolonu).
2. **Kart kapanışının yazım anı kararsız.** Kart kapanışı (vazgeçilen kalan) satırının yazım anı `plans.updated_at`'ten okunuyor; carinin adı değişince kapalı kartın `updated_at`'i yenileniyor (doğrulandı: 09:00:00.632 → .717).
   - 12 tutar × 2 sıra denedim; dağılım hiçbirinde değişmedi, çünkü kuyrukta kart kapanışı yalnız kendi kartını kapatıyor.
   - Etkisi üretilemedi; DOĞRULANMADI olarak 2.5.1'e. Betik `b/b1kart.mjs`, çıktı `b1kart.out`.

## GÖZLEM: güncelleme notu için
Bu bir hata değil. Eski kodla S212 ve B1 örüntüsü üretip dönemi 28.02'ye kilitledim, sonra veriyi yeni kodla açtım (`b/goc.mjs`, `goc2.mjs`):
- Kilitli dönemin mizanı donmuş değerinde kalıyor: 120 1.100 / 128 1.500.
- Mutabakat Testi yalnız `ledger:rule-diff` gösteriyor (tasarımda uyarı düzeyinde). Kural Farkı Düzeltme Fişi bunu alt defter hesabı diye dışarıda bırakıyor; çözüm Kilidi Aç → Yeniden Kilitle.
- Şüpheli Alacaklar ekranı ise yeni kuralı gösteriyor (S212 örneğinde kayıt kapalı).
- Bu örüntüye sahip müşteriler güncellemeden sonra "Kural Değişikliği Farkı" uyarısı görecek. Güncelleme notunda söylenmesi önerilir.

## DOĞRULANMADI
- 2.5.1 listesinin 2. maddesi (kart kapanışının yazım anı).

## DENENMEYEN
- Rol × değişen uç yetki tablosu. Kodu okudum: `requirePermission` yazımdan önce çağrılıyor. Betikle denemedim.
- Aynı anda çek girişi ve şüpheliye alma.
- Tarayıcıyla ekran yürüyüşü (e2e dışında).
- Yeni e2e beklentisinin eski kodda kırmızısı; eski değerler betikle görüldü.
- Kilitli veri olarak v2.4.9'un GERÇEK koduyla üretilmiş veri yerine b55f7b34^1 ile üretilmiş veri kullandım. v2.4.9 verisini kullanan "Kabul D" testi yeni kodda yeşil.
- 001 için UTC saat dilimi (şirket seçimi kalıcılığı yüzünden).
- kural-farki-yil'in v2.4.9 etiketli bölümü git'siz eski kopyada sayılmadı.
- Hız süre ölçümü yapmadım; yalnız eşdeğerliğe baktım.

## Not defteri
- Klasör: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-t3duz-a6`
  - Betikler `b/`, adım adım taslak `rapor-taslak.md`.
  - Çıktılar: `g1*.out`, `b1*.out`, `s212-*.out`, `s181-*.out`, `goc.out`, `esd-*.jsonl` / `.log`, `test-*.out`, `mut-*.out`, `e2e-*.out`.
  - Kanıt aracı çıktıları `kanit/` altında.
- `/dev/shm/dk-t3duz-a6` altındaki kopyalarımı tam yollarıyla sildim.
