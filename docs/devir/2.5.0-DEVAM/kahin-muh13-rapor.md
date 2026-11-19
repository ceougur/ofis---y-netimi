## Muhasebe kâhini bakımı 13 + defter kâhini bakımı 4 — RAPOR

İki kâhin bakımı bitti; kanıt koşuları iki saat diliminde yapıldı. Muhasebe kâhini 213/213 test, 317/317 mutant öldü. G3 61.837/61.837, BEKLENMEYEN 0. Defter kâhini öz test 263/263, G3 1.040/1.040. Program hiç koşulmadı, push yapılmadı.

**Dal ucu:** `worktree-agent-a1cc7f1375640faa7` = **e779340f** (taban `kahin-muh13-taban` = b9ba393e; bakım 12'nin kanıt commit'i c2d503a8 tabanda var).

Commit'ler:
- 0fe7bdd9 — yorum, koddan önce (ders 40).
- d8f3d3cc — muhasebe senaryo ve testleri, model değişmeden önce.
- 7e0c27ee — defter senaryoları, kâhin değişmeden önce. Muhasebenin s93 dosyalarının silinmesi de yanlışlıkla bu commit'e girdi; ileti amend ile bunu söylüyor.
- 376709b4 — muhasebe modeli ve mutantlar.
- 0442daac — defter kâhini.
- 9480a5d2 — belgeler.
- aab20223 — sağ kalan üç mutantın dişi.
- e779340f — kanıt.

### Yorumlar, madde madde
README "Kâhin bakımı 13" bölümünde Ü1–Ü21 var; defterde KARARLAR "2.5.0 Ç5 bakımı 4" bölümünde D11, D11′, D12.

**A1 (Ü1–Ü3):** Kâhin bu kuralları zaten kitabın kararlı sütunuyla kuruyordu:
- satıştan iade KDV'si B 191, alıştan iade KDV'si A 391;
- kayıt tahsilatı 336.90, carisiz Kasa girişi 649.90 (19.11 kararıyla aynı);
- KG-2 600.90 / 610.90, KG-4 602.90 / 770.90, KG-24 601, gider türleri M14.

Eksik bir şey vardı: s05 yalnız mahsup sonrasını denetlediği için iade KDV'sinin yönü elle değerde görünmüyordu. Mahsup öncesi satırları denetleyen birim test eklendi (`test_A1_iade_kdv_yonu`).

**A2 (Ü4–Ü7) — kural geçiş günü:**
- Geçiş günü = ilk `donem_kilitle {kural: "2.4.9"}` (göç) olayının tarihi. Bu olayın listedeki yeri güncelleme anıdır.
- Eski yönler:
  - KG-8 için kitabın KG-8 B sütunu: B 391.
  - F-08'in kitapta B sütunu yok; KG-8 B'nin aynası olarak A 191 alındı (kâhin yorumu).
  - KG-3 için girdinin BİLİNEN SINIR satırı ("602'de") kullanıldı; alt hesap kitabın G-8 kuralından **602.90** (kâhin yorumu).
- Tarihi geçiş günü ve öncesi olan kayıt eski yönde kalır. Donmuş defter de eski yönde olduğundan bu üç kuralda kural farkı çıkmaz.
- B-6: güncellemeden önce yazılmış ve ters kaydedilmemiş mahsubun ayındaki iadeler eski yönde kalır. Mahsup ters kaydedilince ay yeni yöne geçer.
- Güncelleme öncesi dönem 2.4.9 programı sayılır, mahsup tutarları eski yönle hesaplanır.
- Göç yoksa geçiş yoktur, her kayıt yeni yöndedir.
- KG-2, KG-24 ve .90 alt hesaplarının 2.4.9'daki davranışı kâhinin kaynaklarında yok → DENENMEYEN.

**A3 (Ü8–Ü9):**
- Alan dilde zaten var (`alis_faturasi.indirim_ayi`); yeni dil eki gerekmedi.
- Madde tarihi belge tarihidir; kitapla ayrışma yok.
- Yeni: dönem belge ayından önceyse ya da belge yılını izleyen yılın Aralık'ından sonraysa kayıt reddedilir: **RED `KDV_INDIRIM_DONEMI`**.
- KDV Özeti kâhinde yok → SUS + DENENMEYEN.

**A4 (Ü10–Ü11):**
- Açılışla aynı gün sınırın içinde sayılır: K-15 309.<kart>'a yazar. K-14 aynı gün "Hesabı Atanmamış" kovasına düşer, kitapta hesabı yok, kâhin susar (Ş3).
- Silinen açılış "en geç açılış"a sayılmaz. Bakım 12'nin Ş5 ve Ş6 susmaları kalktı.

**A5 (Ü12–Ü14) — S192 tek kuyruk:**
- Kararın örneği sınıfında şüpheli payı tek kuyruktan alınır: KABUL, 128 = 700, 120 = 100.
- Kâhinin kitabından kurulamayan üç sınıfta susma sürer:
  - vade sırası ile belge sırası farklı pay veriyorsa;
  - tahsilattan önce Şüpheliden Çıkar varsa;
  - şüpheli açıkken alttaki kalemi tüketen taksit kartı açıldıysa.
- Kalem raporlarında (gecikmiş, hatırlatma, açık kalem, açık fatura) iki görünüm ayrışırsa yeni `susmalar` kaydı yazılır: `{kural: "S192", rapor, …}`. s42 şüphesi kendiliğinden değil, böyle çözüldü.

**A6 (Ü15–Ü16):**
- S197 = B: ters kaydedilen Kural Farkı fişi farkı yeniden açar. s111'de yeni fiş 01.01.2027 tarihli, B 500 / A 671 70.000.
- S198 = A: 127 eşleştirmede hedef olamaz. s62 tam bunu yaptığı için artık RED bekliyor; 127'nin ters bakiye sınıflaması birim testte elle konan fişle korunuyor.

**A7 (Ü17–Ü21):**
- **s93:** Hizalanmadı. "Gerçek v2.4.9 koşusu" cümlesi bir koşu bilgisi, OKUMA KURALI'na göre kural kaynağı değil; ayrıca tek örnek veriyor. 2.4.9 kuralıyla donan dönemde şüpheli caride faturaya bağlı tahsilat varsa kâhin susar. s93 senaryosu kaldırıldı; B14'ün dişi birim testte elle konan donmuş farkla.
- **s78:** P1-b kurulamaz giriş olarak denetleniyor (kâhin susar). Senaryoya her müşteri için önceden kart ödemesi ve aynı gün eşit havale tahsilatı eklendi.
- **s104:** Kural değişmedi; P2 faturanın ardına alındı, F2 / P2 / KA yedekten. Beklenen dosyası bayt bayt aynı.
- **s108:** S155 artık taksit kartı tahsilatına da uygulanıyor; PKT RED. Öbür kayıt türleri için yalnız susma koruması var.
- **s51:** S110 / S120 kuruldu; senaryo S120 (a) düzenine çevrildi (BY1 70.000).

**B1 (defter):**
- D11: iade KDV'si kararlı sütunda.
- D11′: mahsup defterdeki 391 / 191'i sıfırlar; `kdv` çıktısı (KDV Özeti) 04:35 kararı gereği değişmez.
- D12: geçiş günü = `goc.kilit` + B-6.
- Sorulan dört anahtar (K_EYLUL 191 / 391, K_SON 191 / 391) iade yönüne dayanıyor. Bakım 1–3'te 2.4.3'ün eski yönündeydiler; yeni elle değerler K_EYLUL 3.035 / −2.274, K_SON 800 / −400.

### SUS'a dönen / SUS'tan çıkan anahtarlar
**Muhasebe kâhini — SUS'a dönen:**
- s42 C1: `g2`, `h2`, `g3`, `acik`, `h3` (S192 kalem raporu; A5 / A7 s42).
- s81 C3: `g3`, `g3b`, `hat` (A5).
- s93'ün bütün anahtarları (A7 s93).
- s62'nin eşleştirmeyle kurulan 127 anahtarları (A6 S198).
- s51'in eski hâli (A7 S120).

**Muhasebe kâhini — SUS'tan çıkan:** rastgele-1 C4 ve rastgele-2 C3'ün 120 / 128 ayrımı ve bunlara bağlı karşılık / gecikmiş / şüpheli değerleri (A5). Bu farkların tamamının S192'den geldiği `g3-atif.py` ile doğrulandı.

**Defter kâhini:** SUS'a dönen ya da çıkan anahtar yok.

### Yeni / değişen elle senaryolar
**Muhasebe (yeni):**
- s114 — A2. mzA: 391 −8000, 191 800, 360 −18000, 602.90 −30000, 336.90 −20000. Mahsup ters kaydedilince mzG: 391 −18000, 191 1800. Kural farkı {}.
- s115 — A3. İki `KDV_INDIRIM_DONEMI` reddi. 31.12'de 191 = 7000; 31.01'de 191 = 1000, 360 = −12000.
- s116 — A4. 519 = −92030, 309.KK1 = −1020.
- s117 — A5. 128 = 700, 120 = 100 (C1 ve C3).

**Muhasebe (değişen):** s51, s62, s78, s104, s108, s111. Hesaplar senaryo yorumlarında yazılı.

**Defter:**
- g10 (kilitli göç): K1 391 −116, 191 8, 360 −180.
- g11 (kilitsiz göç): K1 −300 / 128; K4 −80 / 8.

### SÜRÜCÜ İÇİN
- A3 alanı **değişmedi** (`indirim_ayi`, YYYY-AA). Yalnız yeni red geldi: belge ayından önce ya da izleyen yılın Aralık'ından sonra → `KDV_INDIRIM_DONEMI` (aynı sınır alanı taşıyan öbür olaylarda da).
- Güncelleme anı: 2.4.9 kilidi olayı. Ondan önceki `kdv_mahsup` güncellemeden önce yazılmış sayılır. KG-3'ün eski hesabı 602.90 (program 602 ana hesapta tutuyorsa fark yalnız alt hesapta).
- Yeni `susmalar` türü S192; rastgele tohumlardaki S168 susmaları kalktı.
- s93 kalktı. s62 artık RED bekliyor. s78, s104, s108, s51 değişti (yukarıda).
- Defter: `kos.mjs` değişmedi, yeni alan / olay yok. g10 / g11 göç senaryosu, programla koşulmaz.

### Mutantlar
- **Muhasebe yeni (26):**
  - A1: B117, B117b.
  - A2: B118, B118b–g.
  - A3: B119, B119b, B119c.
  - A4: B120, B120b.
  - A5: B121, B121b, B121c.
  - A6: B122, B123.
  - A7: B124, B125, B126, B126b, B126c, B127, B127b.
- **Muhasebe kalkan:** B111d (tersi B120) ve B112b (S197 ile model oldu; tersi B122).
- **Muhasebe yeniden bağlanan, anlam aynı:** N24, B50, B112, B114c, B115b. Toplam 317.
- **İlk tam koşuda (UTC, 9480a5d2) sağ kalan üç mutant: B50b, B91b, B115.** Dişleri eklendi (aab20223; B50b için modelde eşdeğer düzeltme, değerler bayt bayt aynı); son koşu 317/317.
- **Defter:** 40–45 eklendi, hepsi yakalanıyor. Mutant 42 ilk koşuda yakalanmadı; g10'a geçiş öncesi mahsupsuz bir ay (I5) kâhin değiştikten **sonra** eklendi.

### Test sayıları (ölçülen commit aab20223)
| Koşu | UTC | Europe/Istanbul |
|---|---|---|
| Muhasebe testleri | 213/213, çıkış 0 | 213/213, çıkış 0 |
| Muhasebe mutasyon | 317/317, çıkış 0 | 317/317, çıkış 0 (ayrı koşu) |
| Muhasebe G3 | 61.837/61.837, BEKLENMEYEN 0 | aynı (döküm bayt bayt aynı) |
| Muhasebe atıf | 3/3 | 3/3 |
| Defter öz test | 263/263 | 263/263 |
| Defter G3 | 1.040/1.040 | 1.040/1.040 |

**Eski kâhinde kırmızı (beklenen nedenle):**
- Muhasebe: 213 testten 21. Nedenler: S190 / S168 / Ş5 susmaları, red olmaması, P1-b yok, S120 yok, S155 sınırı yok, s93 susması yok, s108 120|C3 −50, s111 fark3 {}, s114 I1 191 ≠ 391, s62 kabul vb.
- Defter: 257'den 18, yalnız 191 / 391 anahtarları.

### G3 dökümü
**Muhasebe, sınıflar:**

| Sınıf | Anahtar |
|---|---|
| A5-S192-pay | 192 |
| A5-S192-susma | 61 |
| A6-S197 | 43 |
| A6-S198 | 32 |
| A7-s104-sira | 18 |
| A7-s108-S155 | 107 |
| A7-s51-S120 | 44 |
| A7-s78-P1b | 317 |
| A7-s93-KALKTI | 2 |
| YENİ | 8 |

Senaryo bazında ayrıntı README'nin G3 bölümünde.

**Defter:** fark yalnız `2.5.0` kuralında senaryo.json'un dört anahtarında ve yeni g10 / g11'de. `2.4.9` kuralında fark 0.

### KULLANICIYA SORULMALI
1. **S120 — kart tutarı elle borçların toplamından büyük (uç değil):** F1 50.000 + BY1 30.000, kart 60.000.
   - (a) Önce elle borçlar, eksik kısım faturalardan: 16.02'de gecikmiş 20.000.
   - (b) Kart elle borçların toplamına küçülür: 16.02'de gecikmiş 50.000.
   - Bakiye ikisinde de aynı. Öneri (a). C: uç durum böyle kalsın.
2. **S120 — "elle borç" kapsamı (uç):** açılış, karşılıksız evrak, ödeme, devir kalemleri elle borç mu; karta eşit birden çok elle kalem varsa hangisi.
   - (a) Fatura olmayan her borç elle sayılır, eşitlerden en eskisi seçilir.
   - (b) Yalnız Borç Yaz elle sayılır.
   - Öneri (a). C: uç durum böyle kalsın.
3. **S192 kalem raporlarında da tek kuyruk mu (uç değil):** s42'de 01.05 itibarıyla açık faturalar:
   - (a) F1 70.000 + F2 50.000 (tek kuyruk);
   - (b) F1 100.000 + F2 20.000 (M13).
   - Toplam aynı. Öneri (a).
4. **S192 (i) — şüpheliye almadan sonra kesilen, vadesi şüpheli kalemlerden önce gelen fatura (uç değil):**
   - (a) Şüpheli tutar vade sırasıyla dağılır: 128 = 700, 120 = 500.
   - (b) Belge sırasıyla dağılır: 128 = 1.000, 120 = 200.
   - Bakiye ikisinde 1.200. Öneri (a). C: uç durum böyle kalsın.
5. **S192 (ii) / (iii) — Şüpheliden Çıkar ve tüketen kart (uç):** s68 C2'de F7'nin şüpheli payı:
   - (a) 0 (dönen tutar kaydın kendi kalemleri);
   - (b) 2.000 (en yeni kalemden çıkar).
   - Öneri (a). C: uç durum böyle kalsın.

Bakım 12'nin KS 1, 4 ve 6'sı hâlâ yanıtsız; yinelenmedi.

**BAŞ MİMAR değerlendirmeli (kodlandı):**
- Ü4: F-08'in eski yönü A 191; KG-3'ün eski alt hesabı 602.90.
- Ü5: geçiş günü = ilk 2.4.9 kilidi.
- Ü6: güncelleme öncesi mahsubun tutarları eski yönle.
- Ü8: dönem sınırı için RED.
- Ü11: silinen hesap = Silinenler'deki açılış kaydı.
- Ü13: S192'nin üç susma ölçüsü.
- Ü17: s93 için hizalama yerine susma. Eski sürümün gerçek çıktısı ham dosya olarak kâhin kaynağına verilirse 2.4.9 S14 hizalanabilir.
- Ü18: P1-b'deki "varsa" okuması.
- Ü20: S155'in öbür kayıt türlerinde yalnız susma koruması.
- D11′: `kdv` çıktısının (KDV Özeti) değişmemesi. Dayanağı 04:35 kararıdır; girdideki "yalnız dört anahtar ayrışıyor" bilgisiyle uyumlu çıkıyor ama kural o bilgiden alınmadı.

### DENENMEYEN
- Programla karşılaştırma.
- KG-2 / KG-24 / .90'ın 2.4.9 farkı; kilit geri alma.
- KDV Özeti (B-11 ve gün yorumu); Faturayı Düzenle ile dönem değişikliği.
- Carisiz Excel kartı (127).
- S155'in öbür kayıt türleri (yalnız susma koruması var).
- S192'nin özel sınıfları ve kalem raporları (susuyor).
- 2.4.9'un S53 Defter Mutabakatı bilgisindeki S14 (kâhin orada hâlâ plan metniyle, susmuyor).
- Kilitsiz güncellemede B-6 muhasebe kâhininde kurulamıyor (defter g11'de kuruldu).
- g10 / g11 programla koşulamaz.

### Süreç notları
- İlk iki saat dilimi mutasyon koşusu aynı anda başladı. `mutasyon.py` kendi içinde paralel çalıştığı için yük 8'e çıktı; İstanbul koşusunu durdurdum.
- Sonra kodla testler değişti (sağ kalan üç mutantın dişi eklendi). Kanıt aab20223 üzerinde yeniden alındı: UTC kos.sh ile; İstanbul mutasyonu arka plan süre sınırı yüzünden kos.sh'nin içinden kesildi, ayrı koşuldu (`kahinmuh13-kos-ist-mutasyon.txt`).
- Her mutasyon koşusu başka bir işin özel ölçüm kilidini bekledi (tek seferlik `flock -s -w 3600`).
- İlk UTC koşusunun çıktıları (314/317) `docs/kanit/2026-11-19/kahinmuh13-ilk-kos/` altında.
- `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`'yi geç okudum (yorum commit'inden sonra, kanıt koşuları sırasında); işle çelişen bir yeri yok.

### Ana oturumun yeniden koşacağı komutlar
Worktree kökünde:
- `bash docs/kanit/2026-11-19/kahinmuh13-arac/kos.sh utc` ve `… ist` — eski kopya `scratchpad/kahinmuh13-eski` içinde (`git archive kahin-muh13-taban test/bagimsiz/muhasebe test/bagimsiz/defter`).
- Tek tek: `node tools/kanit.mjs kos <ad> -- python3 -I -B test/bagimsiz/muhasebe/test_model.py`, `… mutasyon.py`, `… test/bagimsiz/defter/oz-test.py`.
- G3: `docs/kanit/2026-11-19/kahinmuh13-arac/g3-muh.py`, `g3-atif.py`, `g3-defter.py`.
- Programla: `npm run test:kahin-defter`.

### Okunan dosyalar
- `/home/user/ofis---y-netimi/docs/devir/2.5.0-DEVAM/kahin-muh13-istem.txt` (tamamı; görev metnim) ve girdi `scratchpad/kahin-muh13-kararlar.md` (tamamı).
- CLAUDE.md (oturum bağlamında); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (tamamı, geç).
- `test/bagimsiz/muhasebe/README.md`: 1–247, bakım 11 (1325–1442), bakım 12 (1443–1614), başlık listesi, KG-7 / indirim_ayi / 2.4.9 arama satırları.
- Kural kitabı: 124–150 (3-F), 48–58 (G-6…G-8), 390–421 (§9), arama satırları (F-08, KG-3, KG-8, T-14, K-01, C-01, M-08, 602, satır 100).
- EK-1: M8 bölümü 225–250, arama satırları 30–38, 133–138, 202, 210–219, 244–256, 343–384.
- EK-2: satır 46, 188–189, 239, 258, 301 (arama). EK-2B: satır 58, 121, 191, 236, 243, 271 (arama).
- `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md`: başlık listesi ve bir arama; §1'in 21–22, §6'nın 70–71, §13'ün 155. satırları ekrana geldi, kullanılmadı.
- `test/bagimsiz/defter/KARARLAR.md` tamamı; `kahin.py` 1–175, 245–600, 690–732; `oz-test.py` tamamı; `karsilastir.mjs` tamamı; `kos.mjs` KDV satırları (grep; yalnız eşleme için); `senaryo.json` ilgili olaylar; `g2-goc-kilitli.json`.
- Muhasebe kâhini dosyaları: `model.py` 75–135, 255–300, 422–560, 572–870, 934–985, 1450–1460, 1745–1770, 1791–1950, 2371–2510, 2587–2632, 2642–2810, 3060–3280, 3592–3602, 3632–3645, 3760–3780; `senaryolar_elle.py` 1–80, s05, s11, s28, s37, s42, s51, s52 (1265–1276), s58, s62, s68, s78, s93, s104, s108, s111, uç kısmı; `test_model.py` 1–68, 112–262, 365–391, 1010–1110, 1265–1300, 1304–1375; `mutasyon.py` 1–60 ve ilgili mutant satırları; `uret_beklenen.py` tamamı; `uretici.py` grep.
- Kendi önceki araçlarım `docs/kanit/2026-11-14/kahinmuh12-arac/` (g3-muh.py, kos.sh, yeni-mutantlar-muh.py).
- **Okunmadı:** server, client, bulut, packaging, tools (yalnız `kanit.mjs` çalıştırıldı), muhasebe-surucu, cari kâhini, iş listesinin hiçbir sürümü, başka ajanların kanıtları, depo geçmişi / farkı.

### Dosyalar
- Muhasebe kâhini: `/home/user/ofis---y-netimi/.claude/worktrees/agent-a1cc7f1375640faa7/test/bagimsiz/muhasebe/` (README.md, model.py, senaryolar_elle.py, test_model.py, mutasyon.py, senaryolar/)
- Defter kâhini: `/home/user/ofis---y-netimi/.claude/worktrees/agent-a1cc7f1375640faa7/test/bagimsiz/defter/` (KARARLAR.md, kahin.py, senaryo.json, senaryolar/g10-a2-gecis-gunu-kilitli.json, senaryolar/g11-a2-gecis-kilitsiz-gocte-mahsup.json)
- Kanıt: `/home/user/ofis---y-netimi/.claude/worktrees/agent-a1cc7f1375640faa7/docs/kanit/2026-11-19/kahinmuh13-*` (araçlar `kahinmuh13-arac/` altında)
