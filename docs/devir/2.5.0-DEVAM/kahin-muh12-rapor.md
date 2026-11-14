## Muhasebe kâhini bakımı 12 + cari kâhini bakımı 20 — rapor

Bakım bitti; iki saat diliminde (UTC ve Europe/Istanbul) kanıt koşuları yapıldı ve sonuçlar aynı çıktı. Dal ucu **c2d503a8**, ağaç temiz, push yapılmadı. Testler ölçüldüğü commit **eab3aedc**; c2d503a8 yalnız belge ve kanıt ekler.

**Önce bilmeniz gerekenler**
- **Worktree / dal:** İlk worktree silinmişti, bu yüzden `git reset --hard` adımını uygulayamadım. Kendim yeni worktree açtım: `/home/user/ofis---y-netimi/.claude/worktrees/kahin-muh12-aa91`, dal `kahin-muh12-calisma`, taban `kahin-muh12-taban` = 807c70f6. 22b40bcf ve 1e63eaa7'nin dalda olduğu doğrulandı.
- **S168'in kendi örneği kâhinin kuyruk modeliyle çelişiyor.** Girdinin KAPSAM'ı "kalem görünümü = kâhinin kuyruğu (EK-1 M13)" diyor. Bu modelle kararın örneği RET çıkıyor; kararın metni ise KABUL, 128 = 700 diyor. Kural uydurmadım:
  - Kâhin, kararın örneğindeki tek kuyruk görünümünü yalnız karşılaştırma için ayrıca kuruyor.
  - Kabul / ret iki görünümde ayrışırsa kâhin susar.
  - Yalnız 120 / 128 payı ayrışırsa değeri M13'ten yazar; cari yeni `susmalar` çıktısıyla işaretlenir.
  - Bu ayrışma uç durum değil: s68 (C2) ile rastgele tohum 1 (C4) ve tohum 2 (C3) arşivlerinde görüldü. Soru 5'e bakın.
- **Girdideki "bakiye değişmez" sözü yalnız normal (120) tutar için doğru.** X9'da RET'ten KABUL'e dönünce carinin toplam bakiyesi değişir: 1.000 → 700. Açık şüpheli 900 → 600, normal 100 iki dünyada da 100, Kasa +300.
- **Süreç hataları (kendi yaptıklarım):**
  - Bir kez yükü okumakla koşu başlatmayı aynı komutta gönderdim.
  - Bir kez yoklama döngüsü kurdum; durdurdum, yerine tek seferlik `tail --pid` beklemesi kullandım.
  - İlk mutasyon koşusu ölçüm kilidi doluyken hemen döndü; tek seferlik bekleyen `flock -s -w` ile yeniden başlattım.
- **Kural başına yorumda iki düzeltme:**
  - S168 susma koşulunu yorum commit'inde dört sezgisel koşulla yazmıştım. İlk koşuda bunlar eski senaryoların ve rastgele tohumların çoğunu gereksiz susturdu. Kod commit'inde iki görünümün tam karşılaştırmasına çevirdim; README'de "Yorumun kod sırasında düzeltilen yeri" başlığında açıkça yazıyor.
  - s111'deki iki elle değer el hesabı hatasıydı (mizan birikimli bakiye verir). Model değişmeden, commit'ten önce düzelttim.

### Madde madde yorum
- **A1 — KG-19 = C (S175):** Valörlü kendi-hesap transferi işlem gününde B 102.alıcı / A 102.gönderen. 108.90 hiçbir yerde oluşmuyor, devirde yoldaki transfer açılışı da yok. Seçim tablosu "KG-19 C … BİLİNEN SINIR".
- **A2 — KG-6 (S177, S178):** Dil vergi kipini ve komisyon farkı olayını taşımıyor. Hiçbir şey değişmedi; ikisi de DENENMEYEN. Kâhinin POS'ları BSMV / vergisiz kip sayılıyor.
- **A3 — K-14 / K-15 (S179, S182 = C, S183, S184):**
  - Sınır, o yolun en geç açılışı.
  - Hesapsız havale sınırdan önceyse 519. Sınırdan sonrası "Hesabı Atanmamış"; kitapta hesabı olmadığı için kâhin susar.
  - Eski kart hareketi sınırdan önceyse 519, sonraysa 309.<kart>.
  - Kâhin susar: aynı gün, silinmiş açılış, K-15'in iki okuması ayrışırsa (bütün kartların en geç açılışı ↔ olayın kendi kartı), kilitten sonra yazılan açılış kilitli satırın sınıfını değiştirirse (S183).
  - Devir Kapanışı, hesapsız POS ve 'Bankaya Geçmiş Say' dilde yok: DENENMEYEN. S182'nin alanı da dilde yok.
- **A4 — S174, S180:** Kâhinin bakım 8 kuralı bunu zaten söylüyordu; model değişmedi. s111 eklendi, B112 / B112b mutantları onu öldürüyor. s111 eski kâhinde de yeşil.
- **A5 — S127:** 2.4.9 yapısı kâhine öğretilmedi. Yeni değişmez `s127_tek_yazim` eklendi; dişi birim testte. "Kilitli yıla kayıtlı kart + kilitten sonra yükleme" sırası kâhinde üretilemiyor: DENENMEYEN.
- **A6 — S181, S168:**
  - Faturaya bağlı tahsilat / evrakın 120'ye düşen kısmı = tutar − 128 payı; faturanın açığını aşan fazla da dahil.
  - Bu kısım kaydın günündeki 120'yi aşarsa RED; eşitlik KABUL.
  - Kâhin susar: gün ölçüsü ile S155'in toplam ölçüsü ayrışırsa; payın açık şüphelinin tamamını kapatıp 120'yi eksiye indirdiği alanda (S181 ↔ S159).
  - Eski "Kapatılacak Fatura bağlı tahsilat 120" istisnası bakım 4–6'da zaten "pay 128'den" kuralına dönmüştü; bu bakımda değişen fazla ve S168 susmasıdır.
- **A7 — R8 (S87):** Silinenler'den geri alınan Kasa açılışı ilk Kasa hareketinden sonra kalıyorsa `KASA_ACILIS_SONRA`. Yedekten gelen veri kapsam dışı kaldı. Senaryo s113.
- **A8 — D-07:** Değişiklik yok; s13 aynen geçiyor.
- **A9 — S185:** Dil kilidi geri alamıyor (`donem_kilitle` kilidi yalnız ileri götürür). SUS + DENENMEYEN; yeni olay eklenmedi.
- **B1 — cari d44 X9 ailesi:**
  - Pay = faturanın kuyruk kalanı − S130 görünen tutarı; adımın yazıldığı anda ölçülür, geri yüklemede yeniden ölçülür.
  - Düşen = min(tutar, pay). Faturaya bağlı evrak da artık yalnız payı kadar düşer.
  - RET ölçüsü S155'in toplam ölçüsü (B' < A').
  - Susma kodları: SK-38 (a) görünüm tanımsız, (b) fatura düz kalem değil, (c) karışık tarih, (d) S181 ↔ S159.

### SUS'a dönen anahtarlar
- **Muhasebe s74:** "Fazla, açık borç yokken avans" alanı (eski PB2'nin 3000'i). PB2'yi 13000'den 10000'e indirdim; değişen 45 anahtar README G3'te.
- **Muhasebe s68 (S168, C2; elle değer kâhinin M13 değeri olarak kaldı, programla karşılaştırılmaz):** `mz/satirlar/120|C2/bakiye`, `mz/satirlar/128|C2/bakiye`, `g2/gecikmis`, `g2/supheli`, `sk2/0–2/kalan` (ve id sırası), `hat/*`'ın C2 kısmı.
- **Muhasebe rastgele-1 (C4) ve rastgele-2 (C3):** Bu carilerin arşiv ve yeni yıldaki 120 / 128 ayrımı.
- **Cari d44 (S138 = C sonucu, 7 anahtar):** `k1:cari:X9:gecikmis`, `takvim` / `vadeTakip` / `projeksiyon` `:fatura:FX9` ve `:cariToplam:X9`.

### Yeni / değişen elle senaryolar
- **s110:** İki banka; H1 → 519. KB1 önce 309.KK1, kart açılınca 519. `mz2/519` = −60.000, `309.KK1` = −100.000.
- **s111:** Fiş 06.10: B 500 / A 602.90 70.000. İki kez `KURAL_FARKI_YOK`. 2027'de ters kayıt: 602.90 borç 70.000.
- **s112:** C1 çek 900 RED, 50.000 eşit KABUL, 1 kuruş RED. C3 pay 20.000; 60.000 RED, 50.000 KABUL → 128|C3 100.000, 120|C3 0.
- **s113:** Geri alma RED; hareket açılış gününe alınınca KABUL; 100 = 12.000.
- **Eski senaryolarda değişen:** s12 (102.B2 278.500 → 328.500, 108.90 → 0), s27 (108.90 → 102.B2), s74 (PB2 13000 → 10000). Bu üçü model değiştikten sonra elle yeniden hesaplandı; README'de yazılı.
- **Cari d47 (29 denetim):**
  - Z1 KABUL, bakiye 100.
  - Z2 S181'in örneği RET, bakiye 500.
  - Z3 eşitlik KABUL, bakiye 0.
  - Z6 pay 0: 600 RET / 500 KABUL.
  - Z7 bağlı çek 400 şüpheliden + 50 normal, bakiye 50.
  - Z8 geri yükleme, bakiye 100.
  - Z4 ve Z5 SUS.
  - Açık şüpheli tutar Değersiz'in kabul / reddiyle ölçüldü.
- **Cari d44:** X9 durumu "ok", bakiye 70.000.

### SÜRÜCÜ İÇİN
1. **`hesapsiz_hareket`:** "Açılıştan önce" artık senaryonun koşulu değil, en geç `banka_acilis`'ten türetiliyor. Programda tanımda olup açılış olayı olmayan banka hesabını açmayın; sınırdan sonrası kâhinde yok.
2. **`kart_borcuna_aktar.acilistan_once`:** Artık `kart_acilis`'ten türetiliyor; alan verilmişse türetilenle aynı olmak zorunda.
3. **`banka_transfer.valor`:** Yalnız bilgi.
4. **Yeni kök çıktı `susmalar`:** `[{kural, kaynak, cari, tarih, dosya, pay_m13, pay_tek_kuyruk}]`. Listelenen carinin 120 / 128 ayrımı, 128 / 129 kalanları ve gecikmiş / şüpheli raporları karşılaştırılmaz; 120 + 128 toplamı karşılaştırılır.
5. **s111'deki `fis_ters {fis: "fis2"}`:** "fis2" senaryonun Kural Farkı Düzeltme Fişi'dir.
6. **POS'lar:** BSMV / vergisiz kipte kurulur.
7. **`degismezler/*/s127_tek_yazim`:** Kâhinin kendi değişmezi; karşılaştırılmaz.
8. **Cari kâhini:** Adım alanları değişmedi; `kos.mjs` açılmadı.

### Mutantlar
- **Muhasebe:**
  - Yeni: B110, B110b, B111–B111f, B112, B112b, B113, B114–B114d, B115, B115b, B116.
  - Kaldırılan: M42 (yoldaki devri; kural yok) ve B51c (kural oldu; tersi B114).
  - Yeni koda taşınan: N33, B40c, B51, B62.
  - Liste 293 ve hepsi öldü.
  - Susma mutantları (B111b–e, B113, B114c/d, B115/b) yalnız birim testle ölüyor.
- **Cari:**
  - 313–315 değerle yakalanıyor.
  - 316 yalnız elle tablonun `elleYok` / `elleBelirsiz` satırıyla yakalanıyor (`oz-test.py`'de `SUSMA_MUTANTLARI = {316}`).
  - Eski 261–312 aynen yakalanıyor; tarama 283/283.

### Test sayıları (UTC ve Istanbul aynı)
| Kâhin | Denetim | Sonuç | Çıkış |
|---|---|---|---|
| Muhasebe | test_model | 198/198 | 0 |
| Muhasebe | mutasyon | 293/293 | 0 |
| Muhasebe | G3 | 60.948/60.948 | 0 |
| Muhasebe | eski model | 198'den 14 kırmızı | 1 (beklenen) |
| Cari | oz-test | 6.715/6.715 | 0 |
| Cari | mutasyon taraması | 283/283 | 0 |
| Cari | G3 | 605/605 | 0 |
| Cari | yeni elle | 108/108 | 0 |
| Cari | eski kâhin | 26 kırmızı | 0 (`--kirmizi-bekle`) |
| Cari | elle-fark | 100/100 | 0 |
| Cari | G1 | 101/101 | 0 |
| Cari | mutant ↔ senaryo | 784/784 | 0 |
| Cari | geniş tarama | 2.201/2.201 | 0 |

- Muhasebe eski modelde kırmızı 14'ün hepsi beklenen nedenle: s110 (K-15 bayrağı), s112 (S181 yok), s113 (R8 yok), s12 ve s27 (108.90), `test_K02`, `Bakim12` testleri (`test_S127` KeyError dahil), `Dosyalar`.
- Cari eski kâhinde kırmızı 26'nın nedeni: bağlı tahsilat düşmüyor, bağlı evrak tamamıyla düşüyor, susma yok.
- `muh-yeni-mutantlar` aracını kanıt aracı "BELİRSİZ" (özet satırı yok) diye yazıyor; ham çıktıda 22/22 ÖLDÜ. Asıl kanıt 293/293'lük mutasyon koşusu.

### G3
- **Muhasebe:** BEKLENMEYEN 0.
  - A5: 156 (her dalda yeni `s127_tek_yazim: []`).
  - A1: 37 (s12, s27, rastgele 1–3'te 108.90 satırı ve toplamlar).
  - A6-S181: 45 (s74).
  - A6-S168: 28 (`susmalar`: s68, rastgele-1, rastgele-2).
  - YENİ: 8 dosya.
  - s11 ve s37 değişmedi. Değişen birim testler: `test_K02_K14_K07`, hesapsız hareket hijyen testi.
- **Cari:** BEKLENMEYEN 0. Üretici 20/20 aynı; eski kurallarda eşdeğerlik 484/484.
  - Toplam 83 fark: S168 değişen 34 / kalkan 29 / yeni 16; GENEL değişen 2 / kalkan 2.
  - d44: X9 durum, bakiye, `fatura:FX9:acik` 100.000 → 70.000; Kasa 270.000 → 300.000; 7 kalkan (yukarıda).
  - Rastgele senaryolarda 0 fark.

### KULLANICIYA SORULMALI (tek liste)
1. **K-15'te kartı belli eski kart hareketinin sınırı:** Bütün kartların en geç açılışı mı, kendi kartının açılışı mı? Öneri: kendi kartı. Üçüncü seçenek: uç durum böyle kalsın (BİLİNEN SINIR).
2. **Hareket açılışla aynı gün:** Öneri: "önce" sayılmasın, 519'a gitmesin. Üçüncü seçenek: uç durum böyle kalsın (BİLİNEN SINIR).
3. **Silinmiş hesabın açılışı sınırı değiştirir mi:** Öneri: sayılmasın. Üçüncü seçenek: uç durum böyle kalsın (BİLİNEN SINIR).
4. **Bağlı tahsilatta sınır ölçüsü:** Kaydın günündeki 120 mı, S155'in toplam ölçüsü mü? Örnek: gün ölçüsüyle RED (bakiye 1.800), toplam ölçüyle KABUL (bakiye 1.200). Öneri: toplam. Yanıt toplam olursa S56 / S81 / S85'in Normal Cari yolu da ayrı bir bakımda bu ölçüye geçer.
5. **S168'in örneği ↔ EK-1 M13 (uç durum değil):** Tek kuyrukla KABUL (128 = 700, bakiye 800); M13 ile RET (128 = 1.000, bakiye 1.100). Sorunun iki kolu daha var: şüpheliye almadan sonra kesilip vadesi daha erken olan fatura, ve Şüpheliden Çıkar ile dönen fatura. Öneri: kararın kendi örneği (tek kuyruk) — bu M13 okumasında bir kâhin bakımı gerektirir.
6. **S181 ↔ S159:** Bağlı tahsilat açık şüphelinin tamamını kapatıp 120'yi eksiye indirirse: RET (bakiye 1.000) mı, KABUL ve avans (bakiye −200) mı? Öneri: KABUL. Üçüncü seçenek: uç durum böyle kalsın (BİLİNEN SINIR).
7. **Cari SK-38 (b), taksitli / karta alınmış faturaya bağlı tahsilat:** Öneri: uç durum böyle kalsın (BİLİNEN SINIR).
8. **Cari SK-38 (c), açık şüpheli kayıtlardan biri tahsilattan sonra tarihli:** Öneri: yalnız tahsilattan önceki kayıtlar sayılsın; bakiye iki okumada aynı. Üçüncü seçenek: uç durum böyle kalsın (BİLİNEN SINIR).
9. **Not (soru değil), SK-38 (e):** S138 = C, X9'un görünüm anahtarlarını susturuyor. Öneri: böyle kalsın.

### DENENMEYEN
- Programla karşılaştırma (sürücü güncellemesi ana oturumun işi).
- KG-6'nın KDV kipi ve komisyon farkı.
- Devir Kapanışı kolu, hesapsız POS, 'Bankaya Geçmiş Say', S182'nin alanı, hesabın pasif olması.
- S183'ün kilitli dönem kolu (kâhin susuyor), S185 (kilit geri alınamıyor), S127'nin asıl sırası.
- Cari: bağlı evrakın Silinenler'den geri yüklenmesi; pay ölçüldükten sonra faturanın iptali.
- Dinî bayram tarihleri.
- Defter ve mobil yazma kâhinleri bu bakımda koşulmadı (klasörleri okuma kapsamım dışında). Ana oturum `npm run test:kahin-defter` adımını koşmalı ve mobil kabul dosyası cari kâhininin çıktısından üretiliyorsa yeniden üretmeli.

### Ana oturumun yeniden koşacağı komutlar
- İki saat dilimi: `bash docs/kanit/2026-11-14/kahinmuh12-arac/kos.sh utc` ve `… ist`. Her biri yaklaşık 25 dakika sürüyor; ölçüm kilidini `flock -s -w` ile tek seferde bekliyor.
- Tek tek:
  - `python3 -I -B test/bagimsiz/muhasebe/test_model.py`
  - `python3 -I -B test/bagimsiz/muhasebe/mutasyon.py`
  - `python3 -I -B test/bagimsiz/cari/oz-test.py`
  - `python3 -I -B docs/kanit/2026-11-14/kahinmuh12-arac/karsilastir.py --eski <taban kopyası>/test/bagimsiz/cari --yeni test/bagimsiz/cari`
  - `python3 -I -B docs/kanit/2026-11-14/kahinmuh12-arac/g3-muh.py --eski <taban kopyası>/test/bagimsiz/muhasebe --yeni test/bagimsiz/muhasebe`
- Taban kopyası: `git archive 807c70f6 test/bagimsiz/muhasebe test/bagimsiz/cari | tar -x -C <benzersiz klasör>`.

### Okunan dosyalar
- `docs/devir/2.5.0-DEVAM/kahin-muh12-istem.txt` (tamamı)
- Girdi dosyası (1–123)
- `CLAUDE.md` (oturum bağlamında)
- `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (1–82)
- Muhasebe `README.md`: 1–246, 1222–1441, başlık listesi ve 246–1222 arasındaki K-14 / KG-19 / R8 / Y15 arama satırları
- Kural kitabı: KITABI.md satır 108, 179, 186, 187, 193, 194, 196, 306, 311, 401, 410, 414, 415; EK-1 satır 36, 43, 48–75, 206–223 (arama), 301–312 ve arama satırları; EK-2 / EK-2B yalnız arandı (sonuç yok)
- Muhasebe `model.py`: 1–191 (arama), 296–300, 422–556, 572–576, 760–1019, 1177–1198, 1392–1471, 1512–1591, 1691–1740, 1766–1900, 2181–2205, 2228–2397, 2508–2552, 2581–2686, 2755–2775, 2874–2896, 2907–2935, 2973–3083, 3581–3600, 3700–3760
- `senaryolar_elle.py`: 1–80, 254–321, 667–700, 735–790, 870–930, 1180–1215, s68 ve s74 bölümleri, 3040–3080, son 40 satır
- `test_model.py`: 1–80, 160–180, 783–812, 1000–1040, 1218–1235, son 60 satır
- `mutasyon.py`: 1–30, 570–657 ve mutant arama satırları
- `uretici.py`: 185–250, 283–295, 404–420
- `uret_beklenen.py`: tamamı
- Cari `KARARLAR.md`: başlıklar, 3555–3640, 4246–4300, X9 / d44 / SK-33 / SK-34 arama satırları
- Cari `model.py`: 395–404, 596–604, 1778–1790, 3281–3822, 4292–4320, 4690–4712, 5630–5785 ve arama satırları
- Cari `oz-test.py`: 1–56, 280–372
- d44 anahtarları (python ile)
- `docs/kanit/2026-11-13/kahineski19-arac/`: kos.sh, karsilastir.py, bicim.py, elle-karsilastir.py, mutant-senaryo.py, mutasyon-tara.py, elle-fark.py (tamamı); genis-tarama, g1-tara, ozet-tara (başları)
- `docs/kanit/2026-11-06/` yalnız dosya listesi
- Cari `kos.mjs` açılmadı.

### Dal ucu ve commit'ler
**c2d503a8** — sırasıyla: 77d42a88 (yorum), c3676a18 (muhasebe senaryoları), 33b01a59 (muhasebe modeli), dc113ea6 (cari elle tablolar), a8d62b4b (cari kod), eab3aedc (belge + araçlar), c2d503a8 (kanıt).
