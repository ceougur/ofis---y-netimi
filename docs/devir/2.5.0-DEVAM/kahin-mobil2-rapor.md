# Mobil yazma kâhini bakımı 2 — ajan raporu (AYNEN; ajan ae84e826635f4eb38; ajan raporu kanıt değildir — ana oturum yeniden koşar)

## Mobil yazma kâhini bakımı 2 (S154, S151, S158, S165): rapor

Bakım bitti. Kâhinin öz testi iki saat diliminde 162/162 geçti, kabul dosyasında kararla açıklanamayan değişiklik yok, eski kâhin yeni beklentilerde beklenen nedenle kırmızı. Bu kabulle CI'deki `test:kahin-mobil-yazma` adımı düşer: program sürücüsü yeni `stok_iade` adımını tanımıyor (ayrıntı aşağıda, eşleme sizde). Program koşulmadı, `program-surucu.mjs` değişmedi, push yok.

Dal: `worktree-agent-ae84e826635f4eb38`. Taban `kahinmobil2-taban` (b8b47593); `git log -- test/bagimsiz/cari` bakım 18'in iki commit'ini (7434dd1f, b8b47593) gösteriyor. Üç commit:
- `75aeb570` yalnız yorum (ders 40),
- `831e709b` kod ve kabul,
- `418a5d50` kanıt ve README kanıt bölümü.

### Yorum: eski okuma ve yeni kural
**Eski okuma (README "2.5.0 bakımı 2"):**
- 'Fazlasını Avans Yaz' ile kendi tahsilatı kart tutarını aşan kartta 'Tahsil Edilen' iki değerli listeydi: E05 [1.200, 1.300], E41 [1.000, 1.500], R1–R3'teki avanslı kartlar. Kalan da listeydi: [0, toplam − Ödenen].
- İadeyi sayıp saymama alanı dilde yoktu (kartlı caride iade adımı yoktu). Alan olsaydı kâhin iadeyi sayardı, çünkü göstergeleri `kart_odenen`'in ham taksit paylarından kuruyordu.
- Sınır K9'du: kart tutarı − kartın kendi tahsilatları. Bu dilde S165 / S118 okumasıyla ayrışan değer yoktu.
- Çeviri açığı: kâhin cari kâhinine `fazlasiniAvansYaz` geçirmiyordu. Cari kâhini bakım 17'den beri bu adımı reddettiği için E05, E41 ve R1–R3'te kâhin "adımı reddetti" diye çöküyordu.

**Yeni kural:**
- **Çeviri (YM2-1):** Fazlasını Avans Yaz ile yazılan kart tahsilatı cari kâhinine `fazlasiniAvansYaz: true` ile gider.
- **Göstergeler (YM2-2):** 'Tahsil Edilen', Kalan ve taksit 'Ödenen' artık cari kâhininin 2.5.0 kontrol çıktısından aynen alınıyor. Cari kâhini bir anahtarı yazmıyorsa bu kâhin de yazmaz; nedeni `sus_notlari`'nda ve `hesapla` komutunun stderr çıktısında ("# SUS …") durur, karşılaştırılan çıktıya girmez.
- **S154 = B:** tek değer, Kalan 0.
- **S151 = B / S158 = A:** iadenin payı 'Tahsil Edilen' ve 'Ödenen'e sayılmaz.
- **Sınır (S165 = A, S118 = B, BAŞ MİMAR OKUMASI):** K9 aynen kalıyor. İade de, kart seçilmeden alınan tahsilatın kuyruk payı da kartın kendi kalanını küçültmüyor.

### Değişen beklentiler
Döküm `docs/kanit/2026-11-13/kahinmobil2/kabul-fark-dokum.json` içinde; 50 anahtarın hepsi S154 = B'den, açıklanamayan 0.

| Senaryo | Alan | Eski → yeni | Sayı |
|---|---|---|---|
| E05 çifti, k2 | `KT1:odenen` | [120000, 130000] → 130000 | 2 |
| E05 çifti, k2 | `KT1:kalan` | [0, −10000] → 0 | 2 |
| E41 çifti, k1 | `KT:odenen` | [100000, 150000] → 150000 | 2 |
| E41 çifti, k1 | `KT:kalan` | [0, −50000] → 0 | 2 |
| R1 / R2 / R3 | avanslı kartların Ödenen'i ve Kalan'ı | liste → büyük değer / 0 | 6+6 / 8+8 / 7+7 |

- Eski kabulda 50 liste anahtarı vardı, yenide hiç yok.
- Adımlar aynı; E05 ve E41'de yalnız açıklama metni değişti.
- Bakiye, Kasa, taksit Ödenen'leri, `fazla`, `tahsilatSayisi` ve adım yanıtları hiçbir eski senaryoda değişmedi.
- E42'nin k2'si (bağsız tahsilattan sonra kart tahsilatı) yeni cari kâhininde de 900 / 600 yazılıyor; orada susma yok.
- Kabul artık 58 senaryo (55 elle, 3 rastgele), 8.218 adım.

### Adım dili: yeni masaüstü adımı (sürücü eşlemesi sizde)
- **Yeni adım:** `stok_iade {id, cari, tutar, tarih?, sirket?}`, yani masaüstünden faturasız stok satış iadesi.
  - Parasız: Kasa ve banka değişmez.
  - `hareketSayisi`'na girmez.
  - Kartın kendi kalanını küçültmez.
  - Mobil yolu yok.
  - Etkilenen senaryolar yalnız `E43-es-iade-sinir-mobil` ve `E43-es-iade-sinir-masaustu`.
  - Sürücüde `SETUP` listesine eklenmesi ve `kurulum adımı tanınmadı` dalına bir karşılık gerekiyor. Eşlenene ya da `--haric`'e konana kadar E43 çifti program karşılaştırmasında atar.
- **Sınır için yeni alan gerekmedi:** 'Fazlasını Avans Yaz' alanı dilde zaten var (`fazlaAvans`; sürücüde `overpay`).

### Elle senaryolar (beklentiler kâhin koşulmadan karar metninden yazıldı; ilk koşuda model = elle, hiçbir değer düzeltilmedi)
**S154'ün örneği:** E05 çifti (mobil ve masaüstü). Kart 1.200 / 3, karttan 500, ardından 800 'Fazlasını Avans Yaz' → 'Tahsil Edilen' 1.300, Kalan 0, fazla 100, bakiye −100.

**Yeni E43 çifti** (bugün 20.10.2026; iadeler masaüstünden, kart tahsilatları kanaldan):
- **K (S151'in sayıları, Mevcut Borç kartıyla):** açılış 1.000 → kart 1.000 / 2 → sonra fatura 500 → iade 300.
  - 'Tahsil Edilen' 0, Kalan 700, taksitler 0 / 0, bakiye 1.200.
- **L (S158'in örneği aynen):** açılış 900 → kart 900 / 3 → iade 300.
  - 'Tahsil Edilen' 0, Kalan 600, bakiye 600.
  - Taksit 'Ödenen'leri yazılmıyor: cari kâhini burada susuyor (S162 = B).
- **M (S165'in örneği):** açılış 900 → kart 900 / 3 → fatura 500 → iade 300.
  - Karta 700 → sormadan kabul. 'Tahsil Edilen' 700, Kalan 0, taksitler 300 / 300 / 100, bakiye 400.
  - Aynı karta 600 → 409 `plan-overpay` (kalan 200).
  - 600 'Fazlasını Avans Yaz' → kabul. 'Tahsil Edilen' 1.300, Kalan 0, taksitler 300 / 300 / 300, fazla 400, bakiye −200.
- **Parametre çeşitleri:** `taksit=yalniz_cari` kipinde kart adımları 4xx alıyor; `onay=gecemez` kipinde son 600 de 409 alıyor.

**Kararın örneğinden dil yüzünden sapan yer:** S165 ve S151'deki "Borç 500", kart açıldıktan sonra kesilen ve vadesi taksitlerden sonra olan fatura olarak yazıldı (dilde kart faturalı cariye açılamıyor). S151'in satış kartı ve Değersiz Alacak Yaz dilde yok.

### Hâlâ sustuğum yerler
- Cari kâhininin sustuğu her kart göstergesi: S144 = C, S143 = C, S162 = B, S163 = C, S166 = B, C13.4 (11) ve SK-18. Senaryolarda yalnız E43-L'nin taksit 'Ödenen'leri bu yüzden yazılmıyor.

### Mutantlar
**63/63 yakalanıyor**, hepsi elle ya da akış beklentisiyle.
- **51** (S154 A — 'Tahsil Edilen' kart tutarını aşmaz): E05, E41 ve E43'te değerle yakalanıyor.
- **62** (avanslı kartın Kalan'ı eksi): E05, E41 ve E43'te değerle. Eski anlamı (SM-1'in b okuması) S154 = B ile doğru değer oldu, o yüzden anlamı değişti.
- **63** (S151 A / S158 B — iade sayılır; yeni): E43'te değerle.
- Yeni **K1** testi bu üçünü iki kanalda, öneri ve eşdeğer birleşimde değerle doğruluyor.
- Önceki bakımın 60 ve 61'i hâlâ yakalanıyor (F ve J1).

### Öz test (temiz ağaç, `831e709`; ağaçta izlenmeyen tek şey kanıt klasörüydü)
- **TZ=UTC:** 162/162, çıkış 0.
- **TZ=Europe/Istanbul:** 162/162, çıkış 0.
- İki çıktı `[kanit]` satırı dışında bayt bayt aynı.
- A2 ("cari kâhini değişti") geçiyor; kabul yeniden üretildi.
- Üretici denetimi: 55 elle × 256 birleşim ve 3 rastgele tohum × 10 birleşim, model = elle / akış, çıkış 0. Kanıt aracı bu koşu için "BELİRSİZ" yazıyor; komut TAP özeti üretmediği için bu beklenen.
- Koşu sırasında yük 2,2'den 5,7'ye çıktı (başka işler). Sonuçlar belirlenimci.

### Eski kâhinde kırmızı (ders 7, 38)
Eski `kahin.py` ayrı kopyada, yeni elle beklentilerle, 55 senaryo × 2 birleşim = 110 koşu:
- **Cari kâhini bakım 18 ile:** 12 kırmızı, 98 aynı.
  - E05 / E41: "cari kâhini (2.5.0) adımı reddetti" (çeviri açığı).
  - E43: "bilinmeyen islem: 'stok_iade'".
- **Cari kâhini bakım 16 ile (`0c945d05`, eski kabulun kâhini):** 12 kırmızı, 98 aynı.
  - E05: Ödenen listesi ≠ 130000, Kalan listesi ≠ 0.
  - E41: Ödenen listesi ≠ 150000, Kalan listesi ≠ 0.
  - E43: `stok_iade` dilde yok.

### KULLANICIYA SORULMALI
Yok.

### DENENMEYEN
- Program koşulmadı.
- `stok_iade` sürücü eşlemesi yapılmadı, E43 program karşılaştırmasında henüz koşulamıyor.
- E41'de programın Kalan'ı: S154'ün kendi örneği E05'tir; E41 programda 0 dışında bir değer verirse önce hata sayılmalı (ders 6).
- Dilde olmayan ya da senaryosu olmayan durumlar: Değersiz Alacak Yaz, iade faturasının artanı, satış kartı, avansla ödenmiş kart (S101), Tablodan Aktar kartı.
- Rastgele üretici `stok_iade` üretmiyor.
- Bakımdan önceki öz testin kendisi koşulmadı (eski kâhinin çöküşü kırmızı kanıtında görülüyor).
- İki şirket ve yedekten geri yükleme `stok_iade` ile denenmedi.

### Ana oturumun yeniden koşacağı komutlar
Ağaç kökünden:
```
TZ=UTC KANIT_DIR=<klasör> node tools/kanit.mjs kos kahinmobil2-oz-utc -- python3 -I -B test/bagimsiz/mobil-yazma/kahin_test.py
TZ=Europe/Istanbul KANIT_DIR=<klasör> node tools/kanit.mjs kos kahinmobil2-oz-ist -- python3 -I -B test/bagimsiz/mobil-yazma/kahin_test.py
python3 -I -B test/bagimsiz/mobil-yazma/senaryolar.py --denetle
python3 -I docs/kanit/2026-11-13/kahinmobil2/arac/kabul-fark.py <eski kabul.json> test/bagimsiz/mobil-yazma/kabul.json <döküm.json>
python3 -I -B docs/kanit/2026-11-13/kahinmobil2/arac/eski-kirmizi.py <yeni ağaç> <eski kopya: kahinmobil2-taban'dan mobil-yazma + cari>
```
Toplu betik: `docs/kanit/2026-11-13/kahinmobil2/arac/kanit-kos.sh`. Eski kopyalar: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahinmobil2-q7` (cari bakım 18 ile) ve `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahinmobil2-q7/eski16` (cari bakım 16 ile).

### Okunan dosyaların tam listesi
- Görev metni ve girdi dosyası, tamamı.
- CLAUDE.md, tamamı (yüklenen).
- `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` 1–82.
- `test/bagimsiz/mobil-yazma/README.md`, tamamı.
- `test/bagimsiz/cari/KARARLAR.md` 3233–4244 (§26–§29), ayrıca dosya genelinde başlık satırları için grep.
- `test/bagimsiz/cari/model.py` (yalnız içe aktarıldı, değiştirilmedi):
  - Okunan satır aralıkları: 1760–1799, 3380–3425, 3916–3986, 4177–4200, 5069–5135, 5225–5314, 5540–5564.
  - Ayrıca grep ile tek tek görülen satırlar: 71, 399, 595, 638, 649–650 ve `pd` / `_s154` / `sus_kart` geçen satırlar.
- `mobil-yazma/kahin.py`: 1–145, 244–398, 477–571, 820–1190, 1307–1325, ayrıca grep ile ana hat.
- `mobil-yazma/senaryolar.py`: 33–82, 123–232, 280–304, 680–750, 824–856, 1499–1588, 1728–1747, `main` ile dosya sonu, ayrıca grep ile ana hat.
- `mobil-yazma/kahin_test.py`: 33–82, 436–590, 655–719, ayrıca grep.
- `program-surucu.mjs`: yalnız eşleme için grep (14, 66–69, 78, 263–273, 429–604'teki `case` satırları, 528–530, 584). Koşulmadı, değişmedi.
- Okunmadı: `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (yalnız `kanit.mjs` çalıştırıldı), `docs/devir/**`, iş listeleri, `docs/erp/` tasarım notları, `YAPIM-ASAMASI.json`, iki kâhin klasörü dışındaki `test/**`, başka ajanların kanıt dosyaları, git geçmişinin içeriği. Eski kopyalar `git archive` ile çıkarıldı.

Ortam (son okuma): yük 4,58 / 4 çekirdek, bellek boş 14 GB, disk boş 7,9 GB.
