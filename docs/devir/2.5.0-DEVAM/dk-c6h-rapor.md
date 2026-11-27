# Ç6-HESAP DAR KONTROLÜ — RAPOR (inceleme ucu 01d82b6a; Ç6 öncesi = 0feb5b86^1 = b8f034d9)

Hazırlıkta `git reset --hard 01d82b6a` yaptım, `git log -1` ile doğruladım. Worktree temiz kaldı (yalnız node_modules bağı var). Kod değiştirmedim, commit / push yapmadım. Okuduğum belgeler: CLAUDE.md, prensip belgesi, kitabın ilgili bölümleri (§3-S, §3-N, §4, §5, §7, §8, KG-9/10/11), EK-1 M5 / M6 / M7, C6-HESAP-TASARIM §1–§10, çekirdek planı §7 / §8 / §9 / §13 ve karar dosyası. Yasaklı belgelerin (raporlar, istem dosyaları, KAYIT, docs/kanit) hiçbirini açmadım. Bütün betikler ve çıktılar şu klasörde: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c6h-a8a5/`. Eski kod kopyası işi bitince silindi.

## GERİLEME
**Gerileme yok.** Ürün farkı yalnız yeni dosyalardan ve app.mjs'teki 3 satırlık rota kaydından oluşuyor. Router ilk eşleşeni seçiyor; bu yolu gölgeleyen genel bir kalıp yok.

Betikle gösterdim (`s4.mjs`, `s4.sh`, `s4-100k.sh`): aynı verinin ayrı taze kopyasında eski ↔ yeni kodla 9 uç okundu. Uçlar: mizan (tüm zaman, yıl, önceki yıl sonu), Cari Listesi, Kasa, Stok, Mutabakat Testi, nakit akışı ve kilit bilgisi. Yanıtların sha256 özetleri karşılaştırıldı.
- v2.4.9 fikstürü: 12 sınıf × kilitsiz / kilitli, TZ=UTC ve Europe/Istanbul — 24 / 24 AYNI.
- temiz-100k (cash yanıtı 14,7 MB, nakit akışı 16,1 MB): iki saat diliminde de AYNI.

## BULGULAR — YÜKSEK yok, ORTA 3

### ORTA-1 — "Kural Değişikliği Farkı" hesap düzeyinde aranıyor; alt hesap farkını görmüyor (kilitli eski verinin .90 sınıflaması)
- **Yer:** `server/lib/financial-statements.mjs:319` ve `:331` (periodRuleDiff anahtarı `yıl|hesap`), `:404` (frozenPartOf `part.rule` yalnız hesapla tutuluyor).
- **Betik:** `s3.mjs`, çıktı `s3-utc.out`. v2.4.9'un gerçek koduyla üretilmiş, 30.06.2026'da kilitli fikstür kullanıldı.
- **Sayılar (kilitli ↔ aynı verinin kilitsiz kopyası):**
  - **pos, Gelir Tablosu 01.01–30.06.2026:** A satırının alt satırı kilitlide `602` (1.000,00), kilitsizde `602.90` (1.000,00). .90 dipnotu (6) kilitsizde "gelir 1.000,00 TL", kilitlide yok. Kesin Değil yalnız `bilgi-amacli`. Oysa Yönetim'in Kural Farkı ön izlemesi aynı veride "1 madde, B 602 1.000 / A 602.90 1.000" gösteriyor.
  - **kasa, 2026 H1:** dipnot 3 ("Kasa ve banka 'Diğer Gider' çıkışları") kilitlide **0,00 TL**, kilitsizde 300,00 TL. Kilitli dönemde 300 TL'lik Kasa çıkışı var; yani dipnotun söylediği tutar yanlış. 2025'te 649 → 649.90 farkı da aynı biçimde görünmüyor.
  - **stok, 2026 H1:** 600 → 600.90 (400,00) ve 610 → 610.90 (100,00) farkı var, Kesin Değil'de neden yok.
- **Kök neden:** Tasarım §7 "tabloyu değiştiren yalnız hesap toplamıdır" diyor. Bu doğru değil: Gelir Tablosu .90 alt satırlarını ve dipnot 3 / 6 tutarlarını gösteriyor (kitap §7.1, §7.5). Kitap §7.4 Ç3'ün kural farkını Kesin Değil nedeni sayıyor; Ç3 (Yönetim) bu farkları görüyor, tablo görmüyor. 2.4.9'dan kilitli veriyle gelen her müşteri bu durumda.
- **En küçük düzeltme:** `part.rule` ve periodRuleDiff anahtarına alt hesabı eklemek (`yıl|hesap|alt`; Bilanço için gerekirse cari). Ayrıntı metni zaten `row.sub` basmaya hazır.

### ORTA-2 — Kural Farkı Düzeltme Fişi yazıldıktan sonra Bilanço "Kural Değişikliği Farkı" demeye devam ediyor
- **Yer:** `financial-statements.mjs:781` (Bilanço'nun ruleDiff'i donmuş ↔ canlı; yazılmış fişler düşülmüyor) ve `:721`.
- **Betik:** `s2.mjs` (`s2-utc.out`) ve `s3.mjs`. Fişi programın kendi ucuyla yazdım (POST /api/admin/ledger/rule-diff-correction, 200).
- **Sayılar:**
  - **kasa (bugün 20.10.2026):** fişten önce `kural-farki ["2025 · 500: 5.000,00 TL", "2025 · 519: −5.000,00 TL"]`. Fişten sonra 500 = 0, 519 = −5.000 (artık güncel kuralla aynı); Yönetim "kalan satır 0, rule-diff-nothing" diyor. Bilanço ise aynı `kural-farki` nedenini aynı tutarlarla yazmaya devam ediyor.
  - Aynı sonuç satis-fatura, banka ve taksit sınıflarında da var (4 / 4).
  - Fişten önceki tarihlerin tabloları fişten sonra AYNI kalıyor (Bilanço 30.06, Bilanço 31.12.2025, GT 2025, GT 01.01–30.06); Aktif = Pasif her tarihte; fişin 6 / 7 satırları dönem kârını 0 değiştiriyor. Bu kısım doğru.
- **Kök neden:** t ≥ fiş tarihi olan Bilanço'da tutarlar güncel kurala eşit (EK-1 değişmez 9), ama neden donmuş ↔ canlı ham farktan üretiliyor. Bilanço Yönetim'in "Düzeltildi" bilgisiyle çelişiyor; Bilanço Esası'nda başka nedeni olmayan şirket bütün raporu boşuna "Kesin Değil" görür.
- **En küçük düzeltme:** Yönetim'in kullandığı `ruleDiffCorrectionPlan` kalanını (yazılmış fişler düşülmüş hâlini) okumak. t ≥ fiş tarihinde kalan 0 ise nedeni düşürmek ya da "Kural Farkı Düzeltildi (Fiş …)" bilgisine çevirmek. Metin seçimi BAŞ MİMAR kararıdır.

### ORTA-3 — Kilitli yılın Gelir Tablosu ve Bilanço'su, kilitten sonra ürün kartında yapılan değişiklikle değişiyor (KULLANICIYA SORULMALI)
- **Yer:** `server/lib/stock-valuation.mjs:57`, `:63`, `:119` (değerleme kartın güncel alış fiyatını, türünü ve silinme durumunu okuyor; bunların geçmişi tutulmuyor).
- **Betik:** `s5.mjs`, çıktı `s5-utc.out`. Kilit 31.12.2025, bugün 10.03.2026.
- **Elle beklenen:** K ürününde yalnız miktar girişi 10 Adet var; KG-10 A gereği kart alış fiyatı 50 → DSS 500,00, SMM −500,00. H ürünü: 4 × 25 = 100,00.
- **Gözlenen:**

  | Adım | Kilitli 2025 GT satışların maliyeti | Dönem net kârı | Bilanço 31.12.2025 153 |
  |---|---|---|---|
  | Kilitten sonra | −500,00 | 500,00 | 600,00 |
  | K kartının alış fiyatı 50 → 80 (200) | −800,00 | 800,00 | 900,00 |
  | H türü Ürün → Hizmet (200) | −700,00 | — | 800,00 |

  Bugünkü Bilanço'nun "Geçmiş Yıllar 2025" satırı da 500 → 800 → 700 oldu. Hiçbir adımda yeni Kesin Değil nedeni çıkmadı; Mutabakat Testi ok.
- **Kök neden:** Donmuş defterin 153 akışı kilitli yılda sabit, ama dönem sonu stoğu her açılışta güncel karttan yeniden hesaplanıyor. Silinmiş ürünü geri almak da benzer etki yapabilir; bunu üretmedim.
- **Bu bir para / tablo kuralı (ders 43); kullanıcıya sorulmalı.** Seçenekler:
  - **A (öneri):** Kilitli yılın değerlemesi kilit anında dondurulur (ürün başına birim maliyet / dayanak saklanır); kart düzeltmesi kilitli yılı değiştirmez.
  - **B:** Tahmini değerleme hep güncel kartla hesaplanır, ama kilitten sonra kart değiştiyse ayrı bir Kesin Değil nedeni çıkar.
  - **C:** Uç durum böyle kalsın (BİLİNEN SINIR). Yalnız KG-10 kart fiyatlı ürünlerde ve tür değişikliğinde olur.

## SONRAKİ SÜRÜME (2.5.1)
- **K5 beklentisinin dişi eksik (yalnız test):** `k5-dis.mjs` ile gösterdim. Fiş 500 / 519 + yalnız 500 / 519 kalırsa, yani Ç7b'nin 6 / 7 satırları düşerse yüklem yine yeşil. 6 / 7 tutarı yanlış ama fiş dengeliyse de yeşil. Öneri: 6 / 7 satırlarının neti 0 ve beklenen hesap kümesi denetlensin.
- **Sınıf testinde eksik sınıflar:** Hizmet ve Gider Alışı (770 / 760 / 255 Demirbaş), şirket kartı ve kredi (309 / 300 / 780), Serbest Meslek Makbuzu (193), iskontolu / tevkifatlı fatura, hizmet kalemi, silinmiş ürün / cari.
- **Doğrulanmamış kuşkular:**
  - Mali tablo uçlarında aynı anda gelen iki istek ayrı iş parçacığı açıyor, istemci vazgeçince iş parçacığı durmuyor (`routes/financial-statements.mjs` compute; 1 M satırda bedeli ölçülmedi).
  - Bilanço'nun Defter Mutabakatı sonucu t'nin değil bugünün; geçmiş tarihli Bilanço t'den sonra doğan bir farkı gösterebilir (üretmedim).
- **Ç6 dışı, görünüm:** Kural Farkı penceresinde 600.90 / 602.90 / 649.90 / 770.90 satırları ana hesabın adıyla çıkıyor (ör. "600.90 Yurt İçi Satışlar (Stok)"). Kaynak Ç5-A / Ç7b; e2e çıktısında görüldü.

## BAŞ MİMAR KARARLARI — DEĞERLENDİRME
- **K1:** Uyuyor.
  - B-a: c6h-ba testinde ve kitapta (EK-1 M6) aynı.
  - B-b (stok ↔ 153 farkı uyarı): s5'te `stok-153-farki` uyarısı göründü.
  - B-c / S224: bilinen sınır.
  - B-d (Defter Mutabakatı Bilanço'da): s1'de `defter-farki` göründü.
  - B-e (dipnot 3 = 770.90): yeni veride doğru; v2.4.9'dan kilitli dönemde 0 gösteriyor → ORTA-1.
  - S207 = A: silinen R ürünü silindiği günden 0 değerle ve `silinmis-urun` uyarısıyla.
  - S208 = B: aralık iki yıla taşarsa 400 `gelir-tablosu-tek-yil`.
  - S209 = B: Q ürünü 0'a kırpıldı, Kesin Değil'de "Ürün Q: −200,00 TL".
- **K2:** Uyuyor. (c) reddi doğru uygulanmış: Bilanço mutabakatı canlı okuyor. B-f (127 → 340) ve kapanmış yıl tanımı (closingDayOf) kodda kararla aynı.
- **K3 ve K4:** Uyuyor. Farkların etiketleri elle doğrulandı:
  - stok: 2025 DSS 1.104,92, SMM −306,92 (parasız giriş S-06); 30.06 670,61 / 335,31; 20.10 548,68 / 457,24.
  - alış: 600 / 1.470 / 1.340.
  - satış: SMM 100 / 350 / 350.
  - KG-8 191 / 391 yönleri ve KG-2 600.90 farkı yalnız kilitten sonraki kayıtlarda.
  - Yanlış etiketli fark yok. Sınıf testi iki saat diliminde yeşil.
- **K5:** Ç7b tasarımına ve M7'ye uyuyor. 01d82b6a'da e2e 27 / 27 geçti (ölçüm kilidi paylaşımlı alındı). Gerçek satırlar 500 / 519 + 600 / 600.90 / 602 / 602.90 / 649 / 649.90 / 671 / 681 / 770 / 770.90, toplam ₺602.313,28 = ₺602.313,28. Yüklem 1–5 sızıntısında, dengesiz fişte ve sıra bozulunca kırmızı oluyor; bir gerilemeyi örtmüyor. Zayıf yönü yukarıda (2.5.1).

## İLK MADDELER — ÖZET
1. **Mizan ↔ tablo:** Gelir Tablosu ↔ mizan 6 / 7 birebir (3 dönem; betiğin tek "FARK"ı nesne anahtar sırasından, değerler aynı). Aktif = Pasif 7 tarihte 0 (2024-12-31 boş dönem dahil). Hesaplanmış Dönem Net Kârı aynı tarihin Gelir Tablosu'na eşit. İki saat dilimi aynı.
2. **Değerleme ve satışların maliyeti:** elle bütün sayılar tuttu (s1: DSS 283,33; T 1.416,67; çeyrekler −200 / 743,33 / 0; eksi stok, kırpma, silinmiş ürün).
3. **Kilitli dönem:** 03.01 kilidinde (aynı gün hareket) 23 yanıt kilit öncesiyle AYNI. Kural kancası açıkken kilitli 2025 Gelir Tablosu değişmedi ve `kural-farki` nedeni çıktı. ORTA-1 / 2 / 3 bu maddeden.
4. **v2.4.9 sınıf testi:** yukarıda (K3 / K4).
5. **Yetki:** Yönetici ve Muhasebe 200; Personel ve Avukat 403; oturumsuz 401. Reddedilen 7 istekten ve kabul edilen 3 istekten sonra hiçbir tabloda satır sayısı değişmedi (s6).
7. **Testin dişi:** Ç6 öncesi kodda 16 / 16 kırmızı, beklenen nedenle (modül yok / uç 404). Yeni kodda 78 / 78, iki saat diliminde.

## DOĞRULANMADI / DENENMEYEN
- **Denenmeyen:** hız ölçümü (S224 bilinen sınır; ölçüm yapmadım), 1 M satır, mutasyon, Windows, tam npm test (görev gereği yok), Ç6-EKRAN (henüz yok).
- **Programın kendi yolundan denenemeyen:** N-01 / kapanış fişi yolu (D4 yok; tasarım dışı API gerekir).
- **Yalnız UTC'de koşanlar:** s2 / s3 / s5 / s6. Bulgular tarih metnine bağlı, saat dilimine değil.

## Ana oturumun dikkatine — ölçüm kilidi
Ölçüm kilidi (flock -x) yaklaşık 09:02–09:19 UTC arasında başka bir süreçteydi. Bu arada s1–s3, s4 fikstür, s5, s6 ve c6h test koşum (bitişi 09:02) tek node süreciyle çalıştı (yük 1,1–1,7). O aralıkta bir hız ölçümü alındıysa geçerliliğini gözden geçirin (ders 52). 100k gerilemesi ve e2e kilit `flock -s` ile alındıktan sonra koştu.
