## Ç6-HESAP DÜZELTME TURU 5 (yalnız hız) — rapor

**Özet**
- Seçenek (b) uygulandı. Gelir Tablosu'nun kendi donmuş toplam okuması ile KALAN'ın kapsam okuması artık tek `frozenSums` çağrısında. Tur 4'ün ikinci okuması kalktı; o okuma bütün geçmişi tarıyordu (kimlik öneki, madde sayımı ve firstSeen dahil).
- Yanıtlar tur 4 ile bayt bayt aynı. Bunu tur 4'ün gerçek koduyla, programın kendi uçlarından karşılaştırarak doğruladım: fikstürlerde 0 fark / 874 (iki saat dilimi), temiz 100 binde 0 / 57 ve 0 / 19.
- **Hız hâlâ KÖTÜ.** Fişten sonra, fişin dönemini içeren Gelir Tablosu eskiye (5ee4d99e) göre en iyi +%22, ortanca +%22 yavaş. Tur 4'te bu oran +%47 idi; kazanç yaklaşık 0,8 sn. Kararınızdaki kurala göre bu durum **BİLİNEN SINIR önerisiyle kullanıcıya gösterilmeli.**
- Öbür bütün yollar sınır içinde (en iyi ve ortanca birlikte %10'u aşan yok).

**Dal ve commit'ler**
Dal `worktree-agent-a32c17a0bb8351975`, uç **f3a234b0**, taban f73f4f5a. Push yok; ağaçta yalnız node_modules bağı var. Commit'lerde model adı yok.

| Commit | İçerik |
|---|---|
| 9d072092 | Tasarım notu §11.6 (koddan önce) |
| 30baa068 | İlk biçim: tek SQL (ölçümden sonra değişti) |
| 03c702af | Eşdeğerlik testi `test/c6h-tek-okuma.test.mjs`; `fullRuleDiff` dışa açıldı |
| 596253cf | Son biçim: `outside` ayrı, kaba SQL; alt defter kümesi hatırlaması geri alındı; §11.6 eki |
| dfff5a1a | Rapor taslağı |
| f3a234b0 | Kanıt: `docs/kanit/2026-11-21/c6h5-ham`, `c6h5-betik`, `c6h5-rapor-taslak.md` |

Dosya sınırı içinde kaldım: `financial-statements.mjs`, `ledger-snapshots.mjs` (yalnız `frozenSums` okuması), yeni test, tasarım §11.6, kanıt. Göç yok.

**Değişen yollar**
- `frozenSums(…, ruleThrough)`:
  - `groups`, `entries` ve `firstSeen` eskisiyle aynı SQL'ler.
  - Yeni `outside`: `date <= kapsam AND (date < from OR date > through) AND 'voucher' değil`, yıl × hesap × alt hesap × cari kaba toplamları.
  - `ruleThrough` verilmezse çıktı birebir eski.
- `fullRuleDiff(part, outside, live, cover)` = tablonun kendi `rule`'u + `outside`.
- Kullanıldığı yerler:
  - Gelir Tablosu: fiş dönemin içindeyken.
  - Bilanço: t < kapsam iken ve fiş varken. t ≥ kapsam ise tur 4 gibi.
- Ölçümle değiştirdiğim iki karar:
  - İlk tek-SQL biçimi yalnız madde sayımı kadar kazandırdı (0,70–0,87 sn ↔ 1,1–1,2 sn). Bütün geçmişin önekli gruplanması pahalıydı. Kaba, 'voucher' süzülü dışarı okuması saf SQL'de ~0,36 sn.
  - Alt defter kümesi hatırlamasını geri aldım. Üretimde her mali tablo isteği yeni iş parçacığında, yeni ledger nesnesiyle koşuyor (`financial-statements-worker.mjs`); hatırlama bir şey kazandırmıyordu.

**Eşdeğerlik**
- `c6h-tek-okuma` 17 sınama. Tur 4'ün `incomeStatementOf` / `balanceSheetOf` gövdesi testte başvuru olarak duruyor.
  - Kapsam: 13 kilitli fikstür × fişten önce / sonra / kilit 30.09 (through < kapsam); kasa'da KALAN ≠ 0; taksit'te ters kayıt; parça düzeyi (groups, entries, firstSeen, içeri + dışarı toplamları).
  - Fiş 9 sınıfta yazıldı; KALAN yolu 126 okumada koştu.
- Yeni kodda: UTC 17/17, İstanbul 17/17.
- Tur 4 kodunda kırmızı, iki saat diliminde 17/17, beklenen nedenlerle: 15 kez "fullRuleDiff işlevi yok", bir "Missing expected exception", bir "fiş yazılan sınıf 0".
- Tur 4'ün gerçek koduyla yanıt karşılaştırması (`fark5.mjs`):
  - 26 fikstür (kilitli + kilitsiz) × durumlar: UTC 0 / 874, İstanbul 0 / 874.
  - Temiz 100 bin kilitli (fiş + kilit 30.09): 0 / 57; kilitsiz: 0 / 19.

**Komşu, kâhin, mutasyon**
- Komşu yığını (tur 4'ün 140 dosyası + yeni test; tur 4'ün 15 testi dahil): UTC 1431/1431, İstanbul 1431/1431.
- `test:kahin-defter`: UTC 187 denetim 0 fark, İstanbul 187 denetim 0 fark (tur 4 ile aynı).
- Mutasyon: 9 mutanttan 8'i yakalandı, iki saat diliminde aynı sayılarla.
  - Kırmızı sınama sayıları: m1 14, m2 2, m3 11, m4 15, m6 5, m7 8, m8 15, m9 2.
  - m5 (alt defter kümesi boş) yaşadı: fikstürlerde alt defter farkı yok. Bu kod tur 4'ünkiyle aynı, bu turda değişmedi. 100 binde bu yol "dışlanan 7" ile koşuyor ve tur 4 ile aynı sonucu veriyor.
  - İlk mutasyon koşusu geçersizdi: kopyadaki test dosyası eskiydi. `gecersiz-mut1/` altında ayrı duruyor, kanıt sayılmaz.

**Hız** (temiz 100 bin, özel kilit, 3 tur × 3 kod dönüşümlü, her biri 5 tekrar, 14:48–15:46)
- Ölçüm başında yük 0,32–1,47; geçersiz ölçüm yok.
- Yanıt özeti her istekte tur 4 = yeni. Tablo: `c6h5-ham/hiz-tablo.out`.

| İstek | Eski (en iyi / ortanca, ms) | Tur 4 | Yeni | Yeni ÷ eski | Olay döngüsü en çok (e / t4 / y) |
|---|---|---|---|---|---|
| Kilitli Bilanço 31.12.2026 | 5646 / 5843 | 5549 / 6001 | 5528 / 6076 | 0,98 / 1,04 | 104 / 91 / 153 |
| Kilitli GT yıl 2026 | 3194 / 3379 | 3279 / 3590 | 3190 / 3480 | 1,00 / 1,03 | 14 / 20 / 91 |
| Kilitli GT ilk yarı | 3198 / 3395 | 3178 / 3437 | 3114 / 3469 | 0,97 / 1,02 | 20 / 199 / 13 |
| Fişten sonra Bilanço 31.12 | 5500 / 5786 | 5743 / 6360 | 5464 / 6115 | 0,99 / 1,06 | 35 / 36 / 17 |
| **Fişten sonra GT yıl 2026 (fiş içinde)** | 3206 / 3352 | 4720 / 4932 | 3920 / 4084 | **1,22 / 1,22 KÖTÜ** | 11 / 16 / 377 (tek sıçrama) |
| **Fişten sonra GT ikinci yarı (fiş içinde)** | 3128 / 3661 | 4643 / 4962 | 3771 / 4457 | **1,21 / 1,22 KÖTÜ** | 33 / 134 / 132 |
| Fişten sonra GT ilk yarı (fiş dışında) | 2908 / 3432 | 3251 / 3542 | 3110 / 3619 | 1,07 / 1,05 | 101 / 51 / 111 |
| Kilitsiz Bilanço 31.12 | 4931 / 5418 | 4620 / 5616 | 4786 / 5155 | 0,97 / 0,95 | 137 / 127 / 138 |
| Kilitsiz GT yıl 2026 | 3223 / 3531 | 3011 / 3353 | 3172 / 3357 | 0,98 / 0,95 | 21 / 20 / 12 |
| Kilitsiz GT ilk yarı | 2978 / 3424 | 3118 / 3270 | 3110 / 3436 | 1,04 / 1,00 | 12 / 19 / 14 |

Dondurma koşusu (en iyi / ortanca): eski 9761 / 10363, tur 4 8995 / 10326, yeni 10546 / 10860 ms. Bu tur dondurmaya dokunmadı.

**Parça ayrıştırması** (iş parçacığısız, aynı süreç; `parca.out`, `parca-tekcagri.out`, `sql-bench*.out`)
- Kalan ek süre ≈ +0,7 sn. Kaynakları:
  - Dışarı SQL'i: 274 bin satır (2022–2025) gruplanıyor; saf SQL'de ~0,36 sn, süreç içinde ~0,45 sn.
  - Tam canlı `periodRuleDiff`: ~0,15–0,2 sn.
  - Alt defter listesi: ~0,07–0,1 sn.
- Tablonun kendi okuması 127–133 ms; tur 4'ün ikinci okuması 1,06–1,31 sn.
- Daha ileri gidilecek yer kalmadı:
  - Yıl yıl sorgu saf SQL'de ancak ~75 ms kazandırıyor.
  - Önbellek işe yaramıyor, çünkü her istek yeni iş parçacığında koşuyor.
  - Bu yüzden durdum.

**KULLANICIYA SORULMALI**
- Hız, BİLİNEN SINIR önerisiyle. Etkin bir Kural Farkı Düzeltme Fişi'nin gününü içeren Gelir Tablosu, 100 binde ~3,2 sn yerine ~3,9–4,1 sn sürüyor (+%22; tur 4'te +%47 idi). Öbür bütün tablolar ve fişsiz şirket etkilenmiyor; önbellek tekrarı ms düzeyinde.
- Öneri: BİLİNEN SINIR. Öbür yol yeni bir saklama (göç) gerektirir: donmuş toplamları koşu başına saklamak.

**BAŞ MİMAR KARARI GEREKEN**
1. "Tek çağrı"nın okunuşu. Karar "ikinci SQL kalkar" diyordu. Son biçimde tek `frozenSums` çağrısı var, ama içinde dar ve kaba ayrı bir SQL (`outside`) bulunuyor. Ölçülen tek-SQL biçimi daha yavaştı. Kalkan şey tur 4'ün bütün geçmişi önek ve madde sayımıyla okuyan ikinci okuması. Davranış aynı.
2. Olay döngüsünde tek bir 377 ms sıçrama oldu (yeni kod, bir tekrar; öbür turlarda 10–15 ms). Hesap ayrı iş parçacığında koştuğu için ana döngüyle ilgisi belirsiz. Yeniden üretmedim.

**SONRAKİ SÜRÜME (2.5.1)**
- m5 mutantı yaşıyor (alt defter kümesi boş). Fikstürlerde alt defter farkı olan bir kurgu yok; kod tur 4'ünkiyle aynı. Yalnız test eksiği.
- Daha hızlı bir yol (koşu başına saklanan donmuş toplamlar) göç ister; bu turun sınırı dışında.

**DENENMEYEN**
1 M satır, Windows (CI), tam `npm test`, e2e ve ekran yürüyüşü, iki şirket, `kahin-cari` / maliyet / tutar kâhinleri (görev yalnız kahin-defter istiyordu), hızın İstanbul saat diliminde ölçümü (yalnız UTC).

**Ana oturumun yeniden koşacağı komutlar** (worktree: `/home/user/ofis---y-netimi/.claude/worktrees/agent-a32c17a0bb8351975`)
- Yeni test, iki TZ:
  `cd <worktree> && HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 2400 node --test test/c6h-tek-okuma.test.mjs test/c6h-alt-hesap-farki.test.mjs test/c6h-kural-farki-fis.test.mjs test/c6h-degerleme-dondurma.test.mjs` → 32/32. Aynısı `TZ=Europe/Istanbul` ile.
- Betikler `docs/kanit/2026-11-21/c6h5-betik/` içinde ve not defteri yollarını içeriyor. Eski kod kopyaları silindi; yeniden kurmak için `git worktree add --detach --no-checkout <yol> <commit>`, sparse-checkout ile `docs/kanit` dışarıda, sonra node_modules bağı. Sıralı:
  - `hiz.sh <1|2|3>` — özel kilit
  - `parca.sh` — özel kilit
  - `yuk.sh komsu mutasyon kahin fark` — paylaşılan kilit, parça başına; önce `mutasyon-ic.sh`'nin kullandığı `/dev/shm/c6h5-mut` kopyası güncel `git archive` ile kurulmalı
  - `fark5.py <tur4.json> <yeni.json>`

**Not defteri ve ortam**
- Not defteri: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h5-ag`.
- Eski kod worktree'leri, `/dev/shm/c6h5-*` ve node_modules bağları kaldırıldı.
- Yük 2,76 / 4 çekirdek, bellek boş 5 GB (kullanılabilir 10 GB), disk boş 11 GB.
