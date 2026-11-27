# M1 TUR 2 — KDV Özeti: devreden KDV'nin ZİNCİRLİ hesabı (2.5.1; S-M1-1 = B) — RAPOR

Taban `t251-m1-tur1` (60f1a0a7) → dal ucu: bu raporun son commit'i (`worktree-agent-af18bb1989d74249b`). PUSH YOK. Defter, KDV Mahsup Fişi ve ön izlemesi DEĞİŞMEDİ — yalnız rapor.
Ortam (son okuma 08:26 UTC): yük 8,70 / 4 çekirdek (öbür ajanların koşuları), bellek boş 0 GB / kullanılabilir ~5 GB, disk boş 11 GB.

## A. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce = tur 1 → sonra = tur 2; Raporlar → Tüm Raporlar → KDV Özeti (Beyanname Hazırlığı))
1. **Mahsup fişi kesilmemiş aydan sonraki ay** (S-M1-1 örneği: Eylül sonu devreden 1.960, Ekim satış KDV 400 MAHSUPSUZ, Kasım satış KDV 1.000):
   - Kasım ÖNCE önceki 1.960 / ödenecek 0 / sonraki 960 → SONRA **1.560 / 0 / 560** (özet, tablo altı, PDF, Excel aynı). Ekim–Kasım aralığı ÖNCE 1.960 / 0 / 960 → SONRA 1.960 / 0 / 560; ay satırları Ekim "Önceki 1.960 · Sonraki 1.560", Kasım "Önceki 1.560 · Sonraki 560".
   - KDV Mahsup Fişi ön izlemesi DEĞİŞMEDİ: Kasım 1.960 / 0 / 960 (defterdeki 190). Rapor ile ön izleme bu durumda AYRIŞIR (karar (6)); not söyler.
2. **Hiç mahsup fişi kullanmayan şirket**: her ay öncekinin devredenini alır. Örnek (testte, elle): Ocak alış KDV 2.000 · Şubat satış KDV 1.000 · Mart hareketsiz · Nisan satış KDV 1.500 · Mayıs alış KDV 400 · Haziran satış KDV 200 → Haziran ÖNCE 0 / 200 / 0 → SONRA **400 / 0 / 200**; 2026 yılı ÖNCE 0 / 2.700 / 0 → SONRA **0 / 500 / 200**; Mart–Mayıs SONRA 1.000 / 500 / 400.
   100 bin verisi (hiç mahsup yok): yıllık "Sonraki Döneme Devreden KDV" tur 1'de 7.978,23 idi → tur 2 sayısı §6'da.
3. **Kopuk zincir** (önceki ay atlanıp sonraki ay mahsup edilmiş; karar (3)): Ocak mahsubu (devreden 2.000) · Şubat satış KDV 400 mahsupsuz · Mart satış KDV 1.000, Mart fişi defterdeki 2.000'le kesilir (fiş: sonraki 1.000). Mart raporu ÖNCE 2.000 / 0 / 1.000 → SONRA **1.600 / 0 / 600** + yeni özet satırı **"Zincirle Uyuşmayan Mahsup Fişi"**: "Mart 2026 fişi 2.000,00 TL devredenle kesilmiş, sırayla mahsupta 1.600,00 TL olmalıydı (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)". Nisan (satış KDV 800) SONRA 600 / 200 / 0 (ön izleme defterden 1.000 / 0 / 200). Onarımda (Mart geri al → Şubat, Mart sırayla) rapor sayıları DEĞİŞMEZ, ön izleme = rapor, notlar kalkar. Ekran: `docs/kanit/2026-11-27/m1t2-ekran/m1t2-kdv-ozeti-mart-kopuk.png`.
4. **"Mahsup Edilmemiş Ay" notu**: metin zincirli hesabı söyler — "Şubat 2026 (devreden ve ödenecek KDV bu aylar sırayla mahsup edilmiş gibi hesaplandı; KDV Mahsup Fişi ön izlemesi defterdeki devredeni gösterir, ayları sırayla mahsup edin)". Kapsam genişledi: aralığın sayılarını etkileyen BÜTÜN mahsupsuz KDV'li aylar (aralıktaki son KDV'li aydan — aralıkta yoksa aralığın başından — önceki); tur 1 yalnız aralıktan hemen önceki ayı ve aralık içini sayıyordu. En çok 6 ay adı + "ve N ay daha". Ekran: `m1t2-kdv-ozeti-mart-zincir.png`.
5. **"Tüm Zamanlar"**: "Önceki Dönemden Devreden KDV" = ilk KDV ayından önceki 190 bakiyesi (bugün her zaman 0 — §B karar (2)); tur 1'de sabit 0. Sayı değişmez.
6. **DEĞİŞMEYENLER:** bütün aylar sırayla mahsupluysa her sayı tur 1 ile aynı (A = B; tur 1'in mali müşavir beklentileri Şubat 2.000 / 0 / 800, Mayıs 1.140 / 60 / 0, Eylül 2.000 / 0 / 1.960 yeşil); KDV Mahsup Fişi penceresi, fiş satırları, defter / mizan / 190 (kâhin-defter 187/187 tur 1 = tur 2); "Güncel Değil" ve S4 aylarında rapor = ön izleme (tur 1 gibi).

## B. KOD (kararlar nasıl uygulandı) — DEĞİŞEN DOSYALAR
- `server/routes/tax.mjs`:
  - **A ↔ B TEK YER:** dosyanın başında `const VAT_CARRY_MODE = "chain";` (satır 45). `"ledger"` yazılınca tur 1'in sayıları birebir (tur 1'in 10 sınaması A kipinde 10/10 yeşil denendi; Z5 mutantı bu anahtarı ters çevirir → 10 sınama kırmızı).
  - `monthPosition(table, active, month, carryIn = null)`: isteğe bağlı devreden girdisi; verilmezse eskisi gibi defterdeki 190 (ön izleme / fiş davranışı AYNEN — c7b mahsup testleri komşularda yeşil). İkinci formül YOK (karar (1)).
  - `vatView()`: B'de KDV'li aylar (391 / 191 satırı ya da etkin mahsup fişi olan) takvim sırasıyla; başlangıç = ilk KDV ayından önceki 190 (karar (2)); her ay `monthPosition(..., zincirin devredeni)`; mahsupsuz ay "o an sırayla mahsup edilseydi" — devreden yön taşınır, ödenecek taşınmaz, S4 için ay mahsuplu sayılır (saklı İ = hesaplanan İ); mahsup fişi olan ayda fişin kullandığı devreden zincirinkine EŞİTSE fiş zincirdedir (sonraki aya fişin devredeni taşınır, S4 fişin saklı İ'siyle → bütün aylar sırayla mahsupluysa zincir = defter = ön izleme), FARKLIYSA ay zincirle hesaplanır ve uyuşmazlık listesine girer (karar (3)); hareketsiz ay devredeni aynen taşır. Yeni alanlar: `mode`, `openingMinor`, `pending(ilk, son)`, `mismatchesUntil(son)`.
  - Karar (2) koddan okundu: 190'a yalnız KDV Mahsup Fişi yazar (`server/lib/general-ledger.mjs` `vatOffsetLines`); fiş defteri (`server/lib/ledger-vouchers.mjs` `assertNotSubledger` — Açılış Fişi, Kapanış Fişi, Önceki Yıl Sonucu Fişi, Mahsup Fişi dahil) alt defter hesabı 190'ı 400 `voucher-subledger-account` ile reddeder. **190'a açılış yazan yol YOK** → başlangıç bugün her zaman 0 (kod yine defterden okur; devir sihirbazı ileride 190 açılışı yazarsa kendiliğinden girer).
- `server/routes/report-center.mjs` (yalnız KDV Özeti): `startMinor` başı olmayan aralıkta `view.openingMinor`; "Mahsup Edilmemiş Ay" `view.pending`; yeni "Zincirle Uyuşmayan Mahsup Fişi" satırı; not metni kipine göre; kullanılmayan `previousMonthOf` kaldırıldı. Aralık kuralları (karar (5), tur 1 §8) AYNEN.
- Testler: YENİ `test/kdv-ozeti-zincir-251.test.mjs` (5 sınama), YENİ `test/e2e/senaryo-kdv-zincir-251.mjs` (ekran, 12 denetim); beklentisi değişen `test/kdv-ozeti-devreden-251.test.mjs` (3 sınamada mahsupsuz ay beklentileri B'ye; yeni yardımcı `chainAndPreview` rapor ve ön izlemeyi ayrı ayrı elle yazılı sayıyla denetler).
- Belge / kanıt: bu rapor, `docs/kanit/2026-11-27/m1t2-*` (+ `m1t2-ekran/`, `m1t2-betik/`). İstemci, kılavuz, `.github`, `package.json`, `tools`, göçler, `test/bagimsiz/**` DOKUNULMADI.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı, 19d156d1) → sınama eşlemesi
1 hiç mahsup → zincir it 1 · 2 ortada atlanan ay → zincir it 1, devreden it 4 / 5 / 7 · 3 kopuk zincir → zincir it 3 + ekran · 4 ödenecek sonrası yeniden devreden → zincir it 1 (Nisan 500 → Mayıs önceki 0), devreden it 6 · 5 fiş geri al / yeniden kes → devreden it 5, zincir it 3 (onarım) · 6 hepsi sırayla mahsuplu (A = B), S4, Güncel Değil → zincir it 2 ve 5, devreden it 2 / 3 / 8 · 7 yıl dönümü → devreden it 6 · 8 veri öncesi / aralık öncesi aylar → zincir it 1 (2025, Mart–Mayıs) · 9 hareketsiz ay → zincir it 1 (Mart), devreden it 2 (Ağustos) · 10 190 açılışı → koddan (yol yok; §B) · 11 KDV İndirim Dönemi → devreden it 7 · 12 iade / tevkifat → devreden it 7 · 13 kilit → devreden it 9 · 14 iki şirket → zincir it 4, devreden it 4 · 15 gelecek / boş → zincir it 1, devreden it 4 · 16 ekran = PDF = Excel → iki dosyada `sameFiles` · 17 A ↔ B → Z5 mutantı + A kipinde tur 1 testleri 10/10.

## 3. YENİ / DEĞİŞEN TESTLER — kırmızı nedeni ve yeşil (iki TZ)
Kâhin ELLE (karar metni + elle hesap; programın kodundan türetilmedi). Sayılar yanıt gövdesinden / veri tabanından (mizan 190, `vat_offsets`). Tur 1 kodu ayrı kopya `/dev/shm/m1t2-kdv/eski` (`git worktree add --detach … t251-m1-tur1`); oraya YALNIZ iki test dosyası ve yeni ekran senaryosu kopyalandı.
| Koşu | Tur 1 (taban) | Tur 2 |
|---|---|---|
| `kdv-ozeti-zincir-251` + `kdv-ozeti-devreden-251` (15) UTC | 5/15 geçti, **10 kırmızı** | 15/15 |
| aynı, Europe/Istanbul | 5/15, **10 kırmızı** | 15/15 |
| `senaryo-kdv-zincir-251` (ekran) | 6/12, **6 kırmızı** | 12/12 |
Kırmızıların NEDENİ (günlükten okundu, `m1t2-yeni-test-taban-*.log`): zincir it 1 "001 2026-02 zincir … Önceki Dönemden Devreden KDV 0,00 · Ödenecek KDV 1.000,00" (B 2.000 / 0 / 1.000); zincir it 3 "Mart zincir … Önceki 2.000,00 · Sonraki 1.000,00" (B 1.600 / 600); devreden it 5 "2026-11 … Önceki 1.960,00 · Sonraki 960,00" (B 1.560 / 560 — görev metninin örneği); devreden it 4 "2026-06 … 2.000,00" (B 800); devreden it 7 "2026-04 … Önceki 800,00 · Sonraki 1.000,00" (B 1.000 / 1.200); ekran "Mart özet kartları … Önceki ₺2.000,00 … Sonraki ₺1.000,00", "kopuk zincir notu: undefined". Ardıl kırmızılar (beklenen neden değil, önceki sınamanın durumu kurulmadığı için): devreden it 6 ve 8, zincir it 2, 4, 5 — bunlar değişmez (A = B) sınamalarıdır; zincir it 2'nin tur 1'de ilk adımı kırmızı (Ocak mahsubundan sonra yıl 0 / 2.700 / 0 … değil 0 / 500 / 200 — hiç mahsupsuz başlangıç A'da farklı).
Değişmez sınamalar (karar (3)): zincir it 2 (aylar sırayla mahsup edilirken her adımda yıl ve ay satırları aynı; sonunda rapor = ön izleme = fiş = 190 = 200), zincir it 5 ("Güncel Değil" Haziran: rapor = ön izleme 400 / 0 / 300, Temmuz 200 = 190, Haziran–Temmuz 400 / 0 / 300), tur 1'in mali müşavir sınamaları (devreden it 2 / 3) — yeşil.
Ekran senaryosunun İLK koşusu (a61f334e) 11/12'ydi: notta tutar ekranda "₺2.000,00" (sunucu "2.000,00 TL"; istemcinin genel para gösterimi) — beklenti biçimden bağımsız yapıldı (fe27f518), ürün değişmedi; ikinci koşu 12/12.

## 4. KABUL KOŞULLARI
- **A. `npm run test:kahin-defter`**: tur 1 UTC / İstanbul 187/187, 0 fark · tur 2 UTC / İstanbul 187/187, 0 fark (`m1t2-kahin-defter-*`). Tur 1 ile AYNI.
- **B. Komşular** (`m1t2-betik/komsu.sh`; tur 1'in 40 dosyası + yeni zincir testi; `git grep -l "kdv-ozeti|vat-offset|KDV Özeti|Mahsup Edilmemiş|vatView|monthPosition"` → 24 test dosyasının hepsi listede): UTC 529/529 (a61f334e), İstanbul 529/529 (c97b1662 kodu + a61f334e testi — kod aynı), 0 başarısız / iptal / atlanan. Beklentisi değişen / dokunulan ekran senaryoları tur 2 kodunda: senaryo-kdv-zincir-251 12/12, senaryo-kdv-devreden-251 14/14, senaryo-kdv-donemi-250 23/23, senaryo-defter-243 33/33, senaryo-c7b-kabul-250 39/39.
- **C. Mutantlar** — §5: 17/17 ÖLDÜ, iki TZ.

## 5. MUTANT TABLOSU (ayrı kopya `/dev/shm/m1t2-kdv/mut` @c97b1662 + a61f334e zincir testi; testler: iki KDV Özeti dosyası + defter-243-ux24-toplam + c7b-kdv-ozeti-donem-250 + c7b-kdv-s4-250; `m1t2-mutant-utc.json`, `m1t2-mutant-ist.json`)
| Mutant | Başarısız sınama UTC / İst | Sonuç |
|---|---|---|
| D1 devredeni sıfır al | 14 / 14 | ÖLDÜ |
| D2 devredeni iki kez düş | 14 / 14 | ÖLDÜ |
| D3 aralıkta son ayın devredeni 'önceki' | 8 / 8 | ÖLDÜ |
| D4 mahsup formülü yerine 391 − 191 | 14 / 14 | ÖLDÜ |
| D5 ödenecek ↔ devreden ters | 16 / 16 | ÖLDÜ |
| D6 ödenecek yalnız son ay | 6 / 6 | ÖLDÜ |
| D7 sonraki = aralığın son ayının görünümü | 1 / 1 | ÖLDÜ (ilk turda YAŞADI → zincir it 5 eklendi) |
| D8 'Mahsup Edilmemiş Ay' yazılmaz | 7 / 7 | ÖLDÜ |
| D9 ay satırında önceki devreden yok | 7 / 7 | ÖLDÜ |
| D10 S4 zincirde unutulur | 1 / 1 | ÖLDÜ |
| Z1 mahsupsuz ayı zincirden atla | 9 / 9 | ÖLDÜ |
| Z2 ödenecek aydan sonra devredeni taşı | 4 / 4 | ÖLDÜ |
| Z3 zinciri aralığın ilk ayından başlat (öncesini unut) | 13 / 13 | ÖLDÜ |
| Z4 kopuk zincir notunu yazma | 1 / 1 | ÖLDÜ |
| Z5 A ↔ B anahtarını ters çevir | 10 / 10 | ÖLDÜ |
| Z6 fişin devredeni zincirle karşılaştırılmaz | 2 / 2 | ÖLDÜ |
| Z7 geçerli fişte fişin devredeni yerine hesaplanan taşınır | 2 / 2 | ÖLDÜ |

## 6. HIZ VE 100 BİN SAYISI
- **Hız ölçümü YAPILAMADI (DOĞRULANMADI):** `m1t2-betik/olc-kdv.sh` (tur 1 ↔ tur 2, taze `/dev/shm` kopyası, `flock -x`) 07:56'da yük 1,94'e inince başlatıldı; özel kilit 30 dk içinde alınamadı (öbür ajanların paylaşımlı yük koşuları), çıkış 1, ölçüm yok. Yük sonra 8,7'ye çıktı (geçersizlik sınırı 2). Ana oturum aynı betikle ölçmeli. Beklenti: tur 2 Ana Defter'i yine TEK kez kurar (tur 1 ile aynı); ek iş KDV'li ay sayısı kadar (100 bin verisinde ~13 ay) `monthPosition` + ayın 190 satırlarını tarama — ihmal edilebilir.
- **100 bin sayısı** (temiz 100 bin kopyası, tur 2 kodu, tek istek; `m1t2-100k-sayi.txt`; süreler yük 3,8'de — GEÇERSİZ, yalnız bilgi: yıllık 3.003 ms, tek ay 2.700 ms): veri Ekim 2022'den başlıyor, mahsup fişi HİÇ yok.
  - Yıllık 01.01–31.12.2026: **Önceki Dönemden Devreden KDV 8.785.405,02 · Ödenecek KDV 0,00 · Sonraki Döneme Devreden KDV 12.095.185,98** (tur 1: 0 / 0 / 7.978,23). Elle: 8.785.405,02 + 191 5.261.829,66 − 391 1.952.048,70 = 12.095.185,98 ✓ (yılın 391 − 191 farkı tabanın eski "Devreden KDV 3.309.780,96"sıyla aynı; artı 2022–2025'ten birikmiş 8.785.405,02).
  - ELLE ARA AY: Ağustos 2026 önceki 10.432.022,43 + 191 452.078,82 − 391 122.696,91 = sonraki **10.761.404,34** ✓; Eylül 2026 önceki **10.761.404,34** (= Ağustos'un sonrakisi ✓) + 1.396.635,75 − 70.832,34 = sonraki **12.087.207,75** ✓ (rapor aynı sayıları verdi).
  - Not: "Mahsup Edilmemiş Ay: Ekim 2022, Kasım 2022, Aralık 2022, Ocak 2023, Şubat 2023, Mart 2023 ve 42 ay daha (…)" (§8.2).

## 7. KULLANICIYA SORULMALI
**S-M1-2 — Kopuk zincirde mahsup fişinin YÖNÜ zincirle ters düşerse** (karar (3) son cümlesi: "KODLAMA — KULLANICIYA SORULMALI"; uç durum). Yoklama (`m1t2-betik/yon-yoklama.mjs`, tur 2 kodu): Ocak alış KDV 2.000 + Ocak mahsubu · Şubat satış KDV 1.800 MAHSUPSUZ · Mart satış KDV 1.000, Mart fişi defterdeki 2.000'le kesilmiş → fiş: önceki 2.000 / ödenecek 0 / sonraki 1.000 (defterde Mart sonu 190 = 1.000, 360 yok). Zincire göre Mart: önceki 200 / **ödenecek 800** / sonraki 0.
- Kodda ÖZEL bir şey yazılmadı: karar (3)'ün ilk cümlesi tek kural olarak uygulanıyor → rapor Mart 200 / 800 / 0 + "Zincirle Uyuşmayan Mahsup Fişi: Mart 2026 fişi 2.000,00 TL devredenle kesilmiş, sırayla mahsupta 200,00 TL olmalıydı (…)"; Nisan 0 / 0 / 0 (ön izleme 1.000 / 0 / 1.000).
- **A)** Böyle kalsın: rapor her durumda zinciri gösterir, not iki devredeni söyler (yön farkını ayrıca söylemez). **B)** Yön değişince rapor zinciri yine gösterir ama not yön farkını da yazar ("fiş 1.000,00 TL devreden yazmış; sırayla mahsupta 800,00 TL ödenecek çıkar") — ödenecek KDV atlanmasın diye. **C)** Uç durum böyle kalsın (BİLİNEN SINIR) — kod değişmez (A ile aynı).
- **ÖNERİ: B** (küçük metin eki; beyanname hazırlığında ödenecek KDV'nin defterde devreden göründüğü durum gözden kaçmamalı). Yaygın programlarda nasıl: belgesi / ekranı bu oturumda okunmadı — dayanak yazılmadı.
- Her okumada sayı: A / B / C'de rapor Mart 200 / 800 / 0 (aynı); yalnız notun metni değişir.

**S-M1-3 — Mahsuptan SONRA değişen ayın (S4 azaltan ya da "Güncel Değil" artıran) gösterilen sonucu ile sonraki aya taşınan farklı** (tur 1'den beri; uç durum). Örnek (devreden it 8, 002): Mart mahsubundan sonra Mart'ın tevkifatlı alışı İptal Et (191 −400) → Mart raporu bugünkü sayılarla önceki 800 / sonraki 600 gösterir (= Mart ön izlemesi; bu iki sayı koddan çıkarıldı, sınamada okunmadı — Nisan 1.000 / 0 / 800 ve yıl 800 sınamada okundu), Nisan'ın önceki devredeni 1.000'dir (= Mart fişi = defterdeki 190; azalan 400 S4 kuralıyla Nisan'da düşülür). Ekranda Mart "Sonraki 600" ↔ Nisan "Önceki 1.000". "Güncel Değil" (artıran) durumda "Mahsuptan Sonra Değişen Ay" notu var; S4 (azaltan) durumda NOT YOK.
- **A)** Böyle kalsın (rapor = ön izleme ay ay; karar (3) A = B korunur). **B)** Mahsuplu ayda raporun ay satırı fişin sayılarını göstersin (Mart 800 / 0 / 1.000; zincir görünür biçimde tutarlı; rapor bu ayda ön izlemeden ayrılır). **C)** Uç durum böyle kalsın (BİLİNEN SINIR) + S4 ayına kısa not ("Mahsuptan sonra azalan İndirilecek KDV sonraki mahsupta düşülür").
- **ÖNERİ: C** (seyrek; sayılar kendi içinde doğru — fiş ve defter değişmiyor; yalnız görünüm). Kodlanmadı.

## 8. BAŞ MİMAR KARARI GEREKİYOR / ÖNERİ
1. Karar (6) için öneri (ön izlemenin zincire uyması): en temiz çözüm ön izlemede "önceki KDV'li ay mahsup edilmeden sonraki ay mahsup edilemez" ENGELİ (bugün yalnız uyarı: "X mahsup edilmedi; … önce X ayını mahsup etmeniz önerilir"). Böylece kopuk zincir hiç oluşmaz, mahsuplu aylarda rapor = ön izleme = defter her zaman. Hareketsiz aylar engel sayılmamalı (fişsiz geçilebiliyor). Fiş davranışı değiştiği için kullanıcı kararı gerekir; bu turda kodlanmadı.
2. "Mahsup Edilmemiş Ay" kapsamı genişledi (§A.4): zincirde aralıktan önceki bütün mahsupsuz KDV'li aylar sayıları etkilediği için hepsi listelenir (en eskiden; en çok 6 + "ve N ay daha"). Mahsup fişini hiç kullanmayan şirkette not her raporda uzun kalır (100 bin verisinde yıllık raporda "Aralık 2025, Ocak 2026 … ve N ay daha"). Kısaltma (yalnız "N ay mahsup edilmedi") ana oturumun kararına.
3. Ay satırlarındaki aralık ve "Sonraki Döneme Devreden" kuralları tur 1 §8 ile AYNEN (karar (5)); D7 mutantının gösterdiği fark (son KDV'li ayın sonucu ↔ zincirin taşıdığı) yalnız S-M1-3 durumunda ayrışır ve A = B kuralıyla son KDV'li ayın sonucu seçildi.

## 9. SONRAKİ SÜRÜME
- `test/excel-denetim/ekran-hafta.mjs` (elle araç) eski KDV Özeti adlarını bekliyor (tur 1'den kalma; CI'de değil).
- `test/mali-musavir-217.mjs` KDV Özeti'ni "Bu Ay" açar; bütün faturalar bugünde olduğu için zincirden etkilenmez — ama ayın ilk günü koşulursa ve önceki ay KDV'liyse zincir önceki aydan devreden getirir (betik tarihe bağlı; ders 13; CI'de değil).
- Zincir testlerinde ardıl kırmızılar (tur 1'de önceki sınamanın durumu kurulmadığı için) — sınamalar bağımsız veri kursa kırmızı nedenleri daha temiz okunurdu.

## 10. DOĞRULANMADI
- Hız (§6). Windows (CI) — yeni testler dosyaya dokunmuyor; ana oturum CI'de okur.
- Kopuk zincir ekran görüntüsünde (`m1t2-kdv-ozeti-mart-kopuk.png`) tablo altındaki "Ödenecek KDV ₺0,00" satırı görünmüyor; aynı anda DOM okuması üç satırı da verdi (senaryo denetimi "tablo altı = özet" 12/12) ve mahsupsuz görüntüde (`m1t2-kdv-ozeti-mart-zincir.png`) üç satır görünüyor — fişten sonraki yeniden çizim anında çekilmiş olabilir; istemci bu turda değişmedi. Ana oturum ekran yürüyüşünde bakmalı.

## 11. DENENMEYEN
- Tam `npm test` (görev gereği ana oturum); muhasebe sürücüsü (KDV Özeti'ni okumuyor); `test:kahin-cari` (cari dokunulmadı); `test:guvenilirlik` (m30 üretici mahsubu her ay sırayla keser → A = B); eski sürüm verisiyle (v2.4.x) göç sonrası rapor; mobil (KDV Özeti mobilde yok); devreden it 6 / 8 ve zincir it 2 / 4 / 5'in tur 1'de tek başına koşusu (ardıl kırmızı).

## 12. CI LİSTESİNE EKLENECEK
- `test/e2e/senaryo-kdv-zincir-251.mjs` (yeni) ve tur 1'in `test/e2e/senaryo-kdv-devreden-251.mjs` (ders 37). Birim testler `npm test` deseniyle koşar.

## 13. KILAVUZ METNİ ÖNERİSİ (son adayda toplu; tur 1 §13'e ek)
- KDV Mahsup Fişi maddesine: "KDV Özeti, mahsup fişi kesilmemiş ayları sırayla mahsup edilmiş gibi hesaplar; özetteki 'Mahsup Edilmemiş Ay' satırı bu ayları söyler. Ayları en eskiden başlayarak sırayla mahsup edin. 'Zincirle Uyuşmayan Mahsup Fişi' görürseniz o ayın ve sonraki ayların mahsubunu geri alıp ayları sırayla yeniden mahsup edin."

## 14. COMMIT LİSTESİ (t251-m1-tur1..dal ucu)
- 19d156d1 M1 tur 2 rapor taslağı: nasıl bozulur listesi (koddan önce)
- c97b1662 M1 tur 2: KDV Özeti — devreden KDV zincirli (S-M1-1 = B); kopuk zincir notu; A ↔ B tek anahtar (VAT_CARRY_MODE)
- a61f334e M1 tur 2: 'Güncel Değil' ayında rapor = ön izleme sınaması (D7 mutantı yaşıyordu); zincirli KDV Özeti ekran senaryosu
- fe27f518 M1 tur 2: zincir ekran senaryosu — notun tutar biçimi ekranda ₺ önekli
- 66d318df Kanıt: M1 tur 2 (…)
- (son) Kanıt + rapor (bu belge)

## 15. ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
cd <dal ucu ağacı>
for tz in UTC Europe/Istanbul; do HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=$tz node --test test/kdv-ozeti-zincir-251.test.mjs test/kdv-ozeti-devreden-251.test.mjs; done   # 15/15
# tur 1 kırmızısı (ayrı kopya): git worktree add --detach /dev/shm/<ad>/eski t251-m1-tur1; iki test dosyasını kopyala → 10 başarısız; ilk neden "2026-11 … Önceki 1.960,00"
bash docs/kanit/2026-11-27/m1t2-betik/komsu.sh utc <kök> <kanıt klasörü>     # 529/529 (ve ist)
npm run test:kahin-defter                                                     # 187/187, 0 fark
PLAYWRIGHT_BROWSERS_PATH=<pw-1194> HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/e2e/senaryo-kdv-zincir-251.mjs   # 12/12
python3 -I docs/kanit/2026-11-27/m1t2-betik/mutant.py <ayrı kopya> <çıktı.json> UTC   # 17/17 ÖLDÜ (ve Europe/Istanbul)
flock -x <olcum.lock> bash docs/kanit/2026-11-27/m1t2-betik/olc-kdv.sh <çıktı>       # hız: tur 1 ↔ tur 2 (yollar betikte)
```
Not: `/dev/shm/m1t2-kdv/eski` ve `/dev/shm/m1t2-kdv/mut` git worktree kopyalarım duruyor (ana oturum yeniden koşusu için); işi bitince `git worktree remove /dev/shm/m1t2-kdv/eski` ve `.../mut` ile kaldırılabilir.
