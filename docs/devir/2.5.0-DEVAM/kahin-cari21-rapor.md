## CARİ KÂHİNİ BAKIMI 21: rapor

Bakım bitti: C1–C5 cari kâhinine işlendi ve kanıt iki saat diliminde koşuldu. Kural değişikliği yalnız C1'de var (kayıt tahsilatının karşı hesabı 602 → 336). C2 ile C3 dilde kurulamıyor (SUS + DENENMEYEN). C4 ile C5'te kâhinin bugünkü kuralı karara zaten uyuyor; bu ikisi için yalnız yeni elle senaryo ve mutant eklendi.

**Dal ucu: `301c0e29`** (dal `worktree-agent-acf564cb2caf1de40`, taban `c7b2f-kahin` = e779340f, bakım 20 tabanda doğrulandı). Push yapılmadı. Ağaç temiz; yalnız `node_modules` bağlantısı izlenmeyen dosya olarak duruyor.

Commit'ler sırasıyla:
- `75ef9d97` yalnız yorum.
- `1690651b` senaryo ve beklenen; model değişmeden önce yazıldı.
- `4f9da850` model.
- `61e7d7a6` araçlar.
- `301c0e29` kanıt ve KARARLAR'ın kalan bölümleri.

### Girdide KESİK satırlar (ana oturuma)
`kahin-cari21-kararlar.md` dosyasının beş satırı cümle ortasında bitiyor:
- C1 KULLANICI KARARI: "…(taksitli"
- C3 KULLANICI KARARI: "(Alacak Yaz"
- C4 SORU, B seçeneği: "reddedilir,"
- C5 SORU (b): "…aşan"
- C5 KARAR (c): "nakit / havale / POS ile". **(c) kolunun kuralı elimde yok.**

Kesik kısımlardan kural türetmedim. C5 (c) doğrulanamadı; tam metin verilirse sonraki bakımda işlenir.

Ayrıca girdi KG-3 satırının sütun adlarını kitaptan farklı yazıyor; kitabın başlığı "KG | Konu | Seçenek A | Seçenek B | Öneri". Sonuç değişmiyor: kayıt tahsilatı B seçeneği, yani 336.90.

### Madde madde yorum (KARARLAR §32, Y21-1 … Y21-5)
- **C1 — KG-3 (KULLANICI):**
  - 2.5.0'da kayıt tahsilatı **B 100 / A 336** olarak beklenir; 2.4.9 ve öncesinde 602 aynen kalır.
  - Kâhinin mizanı ana hesap düzeyinde, aynı `649.90` → `mizan:649` düzeni gibi. Beklenen anahtar bu yüzden `mizan:336`.
  - Kasa + Tahsilat kolu (649.90) dilde yok, DENENMEYEN. Carisiz evrak (S49 → 649) KG-3'ün konusu değil, değişmedi. "Kesin Değil" işareti dilde yok, DENENMEYEN.
- **C2 — geçiş günü (BAŞ MİMAR KARARI):**
  - Dil "kilitli eski sürüm verisi + güncelleme" sırasını kuramıyor; `sunucu_yeniden` aynı programı yeniden açıyor.
  - Bu yüzden her senaryo kilitsiz güncellemedir: geçiş yok, bütün kayıt tahsilatları 336.
  - Kararın tek tanımından iki sonucu değerle kurdum:
    - (i) güncellemeden sonra konan kilit geçiş günü sayılmaz;
    - (ii) yeniden açılış ve kilidin açılıp yeniden konması da geçiş günü koymaz.
  - Geçişli dünya DENENMEYEN; aynı yorumda "SÜRÜCÜ İÇİN" diye işaretli.
  - B-6 (KDV) cari kâhininin konusu değil.
- **C3 — Kartı Kapat (KULLANICI):** dilde yok. Görev gereği dil eklemedim: SUS + DENENMEYEN + SÜRÜCÜ İÇİN. Dil eklendiğinde yazılacak beklenen yorumda duruyor. Mevcut hiçbir beklenen değişmedi.
- **C4 — S15 (KULLANICI):**
  - Kararın asıl durumu (faturanın kendi taksit kartına Taksit Tahsilatı) dilde yok, DENENMEYEN.
  - Kurulabilen komşu durum: Taksitler'den açılmış Mevcut Borç kartı faturayı içine almış, karta tahsilat girilmiş, fatura iptal ediliyor.
    - İptal kabul; bakiye −300 (kartın tahsilatı carinin alacağı olarak kalıyor); Kasa ve mizan iki okumada aynı.
    - Kart göstergeleri ve carinin kuyruğu SUS (bugünkü C13.4 (11) susması aynen), çünkü "kart kapanır" sözünün bu karta da geçerli olup olmadığı kararda yok (SK-40).
- **C5 — S25 (KULLANICI; yeni kural yok):** kâhin bunu bakım 20'nin `min(tutar, pay)` kuralıyla zaten modelliyor.
  - (a): d47 Z7 ve Z1 karara uyuyor, değerleri değişmedi.
  - (b): yeni d49 B1 / B2 ile gösterildi.
  - S181'in RET sınırı ve SK-38 (d) aynen.
  - (c): metin kesik, DENENMEYEN.

### SUS'a dönen / SUS'tan çıkan anahtarlar
**YOK.** C3 ile C4'ün kurulamayan alanları zaten tanımsızdı; bu bakımda yeni SUS eklenmedi.

### Yeni elle senaryolar ve değerleri (kâhin koşulmadan, karardan elle hesaplandı)
**`d48-c5-kg3-kayit-tahsilati-336`** — 29 elle denetim (24 değer + 5 `elleYok`). Anahtar `legacyCasePayments` açık.

| Kontrol | Öncesindeki adım | Kasa | mizan:100 | mizan:336 | mizan:602 |
|---|---|---|---|---|---|
| k1 | p1 400 (08.06) + p2 250 (10.06) | 650 | 650 | −650 | yok |
| k2 | kilit 09.06, sonra p3 100 (12.06) | 750 | 750 | −750 | yok |
| k3 | yeniden açılış (anahtar açık) | 750 | 750 | −750 | yok |
| k4 | kilit açıldı, 14.06'ya yeniden kondu | 750 | 750 | −750 | yok |
| k5 | yeniden açılış, anahtar kapalı | 750 | 750 | −750 | yok |

k1'de ayrıca mizan:120 = 0. Bütün adımlar ok.

**`d49-c5-s15-s25-iptal-ve-fazla`** — 21 elle denetim (20 değer + 1 `elleBelirsiz`):
- **A1:** FA1 900 → Mevcut Borç kartı KA1 900 → Taksit Tahsilatı 300 → iptal ok. Bakiye −300 (k1 ve k2), Kasa 300, belirsiz kaydı "cari A1 tanımsız / C13.4 (11)".
- **B1:** FB1a 600, FB1b 500, şüpheliye alma 800, FB1c 400; FB1b'ye bağlı çek 700.
  - Pay 200 → çekin 200'ü şüpheliden, 500'ü normalden düşer; işlem KABUL.
  - k1: bakiye 800; fatura açıkları FB1a 400, FB1b 0, FB1c 400.
  - Değersiz 601 RET, 600 KABUL; k2: bakiye 200.
- **B2:** FB2a 1.000, şüpheliye alma 1.000, FB2b 400; FB2a'ya bağlı çek 1.200.
  - 1.000 şüpheliden, 200 normalden; işlem KABUL (A' = 0, B' = 200 — SK-38 (d) değil).
  - k1: bakiye 200; FB2a 0, FB2b 200.
  - Değersiz 1 RET; k2: bakiye 200.

### SÜRÜCÜ İÇİN (`kos.mjs` yalnız okundu, değişmedi)
- `mizan:336` ana hesap kodu olarak beklenir. Program `336.90` alt hesap koduyla listeliyorsa eşleme gerekir; `649`'un bugün nasıl eşleştiği doğrulanmalı. Sabit sıfır listesine 336 eklenmez.
- "Kesin Değil" işareti okunmuyor.
- Kartı Kapat adımı yok (`kart_kapat` adımı ve kapanmış kartın okunuşu gerekir).
- Faturanın kendi taksit kartına `kart_tahsilat` yok.
- Geçişli C2 dünyası eski sürüm verisi ister (ders 17).

### Mutantlar (hepsi DEĞERLE yakalandı)
| No | Mutant | Yakalayan |
|---|---|---|
| 317 | KG-3 eski yön (602) | d48; mutasyon taramasında c1 ve c14g de |
| 318 | O anki kilit geçiş günü sayılır | d48 |
| 319 | Yeniden açılıştaki kilit geçiş günü sayılır | d48 |
| 320 | S25 (b) fazla şüpheliden düşer | d47 Z2 / Z6, d49 B1 |
| 321 | S25 (a) önce 120 düşer | d47 Z1 / Z7 |
| 322 | İptalde kartın tahsilatı kaybolur | d49 A1 |

Görevdeki "Kartı Kapat kalanı siler / bakiyeyi değiştirir" mutantları kurulamadı (dilde Kartı Kapat yok). "Geçiş günü yok sayılır" bu kâhinde doğru davranışın kendisi; tersini 318 ve 319 sınıyor.

### Test sayıları
UTC ve Europe/Istanbul; bütün çıkış kodları 0, iki saat diliminin ham çıktıları bayt bayt aynı; kâhin `61e7d7a6`, temiz ağaç.

| Koşu | Sonuç |
|---|---|
| oz-test | 6.779/6.779 |
| Mutasyon taraması (kos.mjs düzeni) | 289/289 |
| G3 | 614/614 |
| Yeni elle tablo | 50/50 |
| Eski kâhin kırmızısı | 10/50 |
| Elle fark | 101/101 |
| G1 taraması | 103/103 |
| Mutant ↔ senaryo | 992/992 |
| Geniş tarama | 2.201/2.201 |

- **Eski (bakım 20) modelde kırmızılar:** d48'de 10 kırmızı, beklenen nedenle: `mizan:336` ANAHTAR YOK ×5, `mizan:602` yazılıyor ×5. d49 eski modelde de yeşil; kural değişmediği için beklenen sonuç bu.
- **Yük kuralı ihlali:** Europe/Istanbul koşusu başlarken yük **4,10 / 4 çekirdek** idi (başka işlerden). Betik zincir hâlinde kendiliğinden başladığı için bekleme yapılmadı. Koşu zamana bağlı değil; çıktı UTC'yle bayt bayt aynı.

### G3 (bakım 20 ↔ 21)
- Kural 2.4.9 / 2.4.6 / 2.4.5 / `--legacy`: 492/492 bayt bayt aynı. Üretici 20/20 aynı dizi; eski senaryoların adımları ve elle tabloları değişmedi.
- 2.5.0: 50.765 → 50.765 denetim; **24 fark, hepsi KG3, BEKLENMEYEN 0.**
  - c1: k1 … k5 `mizan:602` (−90.000 / −90.000 / −20.000 / −90.000 / −70.000) kalktı, `mizan:336` aynı tutarlarla geldi.
  - c14g: k1, k2 −70.000.
  - d48: k1 … k5.
- Rastgele senaryolarda 0 fark; d49'da iki model aynı.

### KULLANICIYA SORULMALI
1. **SK-39 — Kartı Kapat'tan sonra vadesi gelmemiş kalan kalemin gecikmişi (C3, dil eklenince):** kart 3 × 300, 1. taksit ödenmiş, 10.04'te Kartı Kapat, bugün 15.04.
   - (i) Kararın harfi, "ertesi günden gecikmiş": gecikmiş 600.
   - (ii) KAPSAM'daki "kendi vadeleriyle": gecikmiş 0.
   - Bakiye iki okumada da 600. Öneri (i). Üçüncü seçenek: Uç durum böyle kalsın (BİLİNEN SINIR).
2. **SK-40 — Taksitler kartının (Mevcut Borç) içine aldığı faturanın iptali (C4):**
   - (i) S15 bu karta da uygulanır: kart kapanır, kartın 300'ü avans olur; sonradan kesilen 500'lük fatura 200 açık kalır.
   - (ii) Kart açık kalır (borcu kalmamış ama borçtan büyük bir kart); 500'lük fatura 500 açık.
   - Bakiye iki okumada aynı. Öneri (i). Üçüncü seçenek: Uç durum böyle kalsın (BİLİNEN SINIR).
- **Yeni soru değil:** SK-38 (d) S25 (b) ile kapanmadı, bakım 20'deki soru aynen geçerli. S25 (c)'nin metni girdide kesik.

### DENENMEYEN
- Programla karşılaştırma.
- C1: Kasa + Tahsilat'ın 649.90'ı, "Kesin Değil" işareti, kilitli dönemde kayıt tahsilatının silinmesi / düzeltilmesi.
- C2: geçişli dünya.
- C3: tamamı.
- C4: asıl durum; Taksitler kartı alanındaki göstergeler.
- C5 (c); POS yolu.
- Defter kâhini ve mobil yazma kâhini koşulmadı. Kayıt tahsilatının 602 → 336 değişikliği defter kâhinine de dokunuyorsa (`test:kahin-defter`) bu senin işin.

### Senin yeniden koşacağın komutlar
- Betik: `bash docs/kanit/2026-11-19/kahincari21-arac/kos.sh utc`, ardından aynısı `ist` ile. Betik çalışma dizini olarak bu worktree'yi ve eski kopya `scratchpad/kahincari21-eski`'yi kullanıyor (bakım 20 kâhini, `git archive c7b2f-kahin`); kendi kopyanda W/E değişkenlerini değiştirmen yeterli.
- Kâhin–program karşılaştırması: `npm run test:kahin-cari` (ben koşmadım).

### Okunan dosyaların tam listesi
- `docs/devir/2.5.0-DEVAM/kahin-cari21-istem.txt` 1–33.
- `scratchpad/kahin-cari21-kararlar.md` tamamı.
- `CLAUDE.md` tamamı.
- `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` 1–83. **İş bittikten sonra okudum** (görev "ÖNCE oku" diyordu); bu bakımı değiştiren bir kural içermiyor.
- `test/bagimsiz/cari/KARARLAR.md`:
  - Bütün başlık satırları ve 602 / 649 / mizan / Kartı Kapat / S15 / S25 / kilit / iptal için grep isabet satırları.
  - Bölümler: 1–47, 338–343, 366–382, 440–452, 920–930, 1720–1800, 4246–4250, 4451–4583.
  - Tek satırlar: 527, 536, 540, 547, 971, 983, 999, 1008, 1011, 1013, 3291.
- `test/bagimsiz/cari/model.py`:
  - Aralıklar: 8–9, 36–90, 395–406, 2108–2118, 2286–2296, 3287–3330, 3415–3472, 3525–3560, 3903–3915, 4017–4032, 4060–4140, 4250–4275, 4355–4372, 4442–4502, 5420–5560, 5810–5852.
  - Grep satırları: 600 / 606 / 613, 1152 / 1384 / 1597, 3020 / 3332 / 3358 / 3372 / 3473 / 3743 / 4218 / 4281.
- `test/bagimsiz/cari/oz-test.py` 1–200, 260–400.
- `test/bagimsiz/cari/kos.mjs` yalnız eşleme için: adım türleri (grep), 3–4, 152, 455–545, 781, 825–858, 1061–1065, 1208–1217.
- `test/bagimsiz/cari/uretici.py` yalnız grep satırları: 227, 254, 279–280, 336, 425.
- Senaryolar: c1 ve c14g (adımlar), d47 tamamı, d36 / d37'nin kart_ac / kart_tahsilat satırları, dosya listesi.
- `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` 160–175, 220–235, 380–420.
- `docs/kanit/2026-11-14/kahinmuh12-arac/` (önceki bakımların araçları): kos.sh, mutasyon-tara.py, mutant-senaryo.py, elle-fark.py, karsilastir.py ve elle-karsilastir.py tamamı; genis-tarama.py 1–30, ozet-tara.py 1–25, g1-tara.py 1–20, bicim.py 1–20. Görevin "önceki bakımların araçları" maddesine dayanarak açtım; başka ajanların başka kanıt dosyalarını açmadım.
- Yalnız dosya listesi (`ls`) olarak: `docs/kanit/2026-11-13`, `docs/kanit/2026-11-14`, `docs/kanit/2026-11-19`, `docs/erp/`.
- Açılmayanlar: `BILINEN.json`, `YAPIM-ASAMASI.json` (eski kopyada da), `server/`, `client/`, `tools/`, `docs/devir/**` (görev metni dışında), iş listeleri, `test/bagimsiz/muhasebe-surucu/`, git farkı / geçmiş içeriği.

### Dosyalar
- Değişen: `test/bagimsiz/cari/KARARLAR.md` (§32), `model.py`, `oz-test.py` (yalnız belge satırı).
- Yeni senaryolar: `senaryolar/d48-c5-kg3-kayit-tahsilati-336.json`, `senaryolar/d49-c5-s15-s25-iptal-ve-fazla.json`.
- Kanıt: `docs/kanit/2026-11-19/kahincari21-*` (araçlar `kahincari21-arac/` altında).
- Deneme araçları: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahincari21-dene/`.
- Eski kâhin kopyası (yeniden koşu için bıraktım): `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahincari21-eski/`.
- Ortam: yük 1,85 / 4 çekirdek, bellek boş ~7 GB, disk boş ~6,7 GB.
