# Cari kâhini bakımı 19 — kâhin ajanının raporu (13.11.2026; AYNEN; ajan raporu kanıt değil — ana oturum yeniden koşar)

## Cari kâhini bakımı 19 — rapor

Dört işin dördü de bitti ve iki saat diliminde (UTC ve Europe/Istanbul) koşuldu. Bütün koşuların çıkış kodu 0, BEKLENMEYEN fark 0. Yeni elle tabloların hiçbir değeri kâhine göre düzeltilmedi; değişen beş elle tablonun 512 denetimi ilk koşuda tuttu. Program koşulmadı, push yapılmadı.

**Dal:** `worktree-agent-a2ad151373ec5a9ff`, taban `kahin19-taban` = 418a5d50. Commit'ler:
- f1a3c9ba — yalnız yorum (ders 40)
- df767e9b — kod
- b7b229a5 — cari kanıtı
- 653224a7 — mobil kabul
- fa605f58 — mobil kanıtı

Hazırlıkta `git log` ile bakım 17, 18 ve mobil bakım 2 commit'lerinin dalda olduğu doğrulandı. Ağaç temiz.

### Yorum (KARARLAR.md §30, Y19-1 … Y19-8)
1. **S162 = B'nin ölçütü (BAŞ MİMAR KARARI, 21:21).** Ölçüt artık iadenin yazıldığı an; Y17-5 (2)'deki kontrol anının yerini alıyor.
   - Her faturasız iade yazılırken, o ana kadar yazılmış bütün kayıtlarla (tarihleri ne olursa olsun) carinin kuyruğu kuruluyor.
   - Kart taksitleri dışında açık borç yoksa iade "borcun tamamı taşınırken yazılmış" sayılıyor.
   - Alan şu: kartın taksitinde iade payı var ve böyle bir iade bu kart etkinken yazılmış.
   - SUS / DEĞER anahtarları bakım 17 ve 18'deki gibi.
   - Sonuçlar: (a) iade önce, borç sonra → SUS. (b) borç önce → DEĞER. (c) borcun tarihi sonra ama yazımı önce → DEĞER.
   - Öbür yön: iade yazılırken başka borç vardı, sonra o borç silindi → DEĞER.
2. **S170 = B (yetkiyle uygulanan karar, 21:29; kullanıcı dönünce değiştirebilir).** Alan, KAPSAM'ın harfiyle: etkin satış kartı olan caride faturasız iade var.
   - SUS: kart toplamı ve iadenin kısmen ya da tamamen kapattığı taksitlerin 'Ödenen'i.
   - DEĞER (aynen): Kalan, Tahsil Edilen, dokunulmayan taksitler, gecikmiş, elle borç, bakiye.
3. **S157 = C.** SK-31 nedeniyle tanımsız olan carinin kartlarının toplamı SUS. Kartın listede görünmesi ve bakiye yazılmaya devam ediyor.
4. **Madde 4.** Kalem düzeyinde SUS olan bir bilgiden hesaplanan toplam da SUS; bakiye her zaman yazılıyor.
   - S162, S166 ve S163 carilerinde üç pencere toplamı (Takvim, Vade Takip, Projeksiyon) SUS. S163'te sayaçlar da SUS (yazılıyorsa).
   - S149 carisinde yalnız Takvim pencere toplamı SUS.
   - Y19-6'da DEĞER kalanlar tek tek yazıldı.
- Madde 5 için yapılacak bir şey çıkmadı: S169'un beklentisi değişmiyor; S171 için kâhinde elle girilen Vade Takip aralığına ait beklenti yok.

### SUS'a dönen anahtarlar (G3'teki 27 kalkanın tamamı)
- **Madde 1:**
  - d45'in eski B2'si (iade önce, borç sonra): `kart:KB2:toplam`, `kart:KB2:taksit1/2/3:odenen`, `cari:B2:gecikmis`.
  - Yeni B3 (aynı yapı): `kart:KB3:toplam`, `kart:KB3:taksit1/2/3:odenen`, `cari:B3:gecikmis`.
- **Madde 2:**
  - d42 `KT1` toplam + taksit1 + taksit2; `KT2` toplam + taksit1; `KT3` toplam + taksit1 + taksit2.
  - d42 `KT4`, `KT5`, `KT8` toplamı (bunlar madde 3'ün de alanında).
  - d30 `KQ7` toplamı.
- **Madde 4:** d42 `takvim|vadeTakip|projeksiyon:cariToplam:T6`; d43 `takvim:cariToplam:U4` ve `U6`.
- Ayrıca DEĞER'e dönen 5 anahtar var: B6'nın toplamı, taksit Ödenen'leri ve gecikmişi. Eski kâhin bunlarda kontrol anı ölçüsüyle susuyordu.

**Hâlâ susulan öbür sınırlar:** S144, S143, S141, S149 (takvim kalemi), S156 / SK-30, S157 (göstergeler), S163 (dağılım), S137 / S138, SK-18, C13.4 (11) tanımsız cariler, S162 / S166.

### Yeni ve değişen elle senaryolar
Bugün 15.06; ortak yapı: Borç 900 → kart 900 (3 × 300) → iade 300 (10.06).

| Senaryo | Yapı | Beklenti |
|---|---|---|
| d45 B2 (b) | Borç 500 (01.06) iadeden önce yazıldı | kart 900, Kalan 600, Tahsil Edilen 0, taksit 0/0/0, gecikmiş 300, bakiye 1.100 |
| B3 (a) | iade önce, borç sonra | SUS (yukarıdaki anahtarlar) |
| B4 (c) | borcun tarihi 12.06, yazımı önce | B2 ile aynı |
| B5 | Borç 500, vadesi 01.05 (ilk taksitten önce) | iade o borcu kapatır: kart Kalan 900, gecikmiş 800, bakiye 1.100 |
| B6 | borç önce yazıldı, iadeden sonra silindi | B2'nin kart değerleri, bakiye 600 |

- d42, d30, d43 ve d44'te yalnız `elleYok` / `elleBelirsiz` eklendi; değeri değişen eski elle beklenti yok.

**Koşucu eşlemesi:** adım alanı değişmedi; `kos.mjs` açılmadı. B6 mevcut `hareket_sil` adımını kullanıyor. Adım sırası yazım sırası olduğu için B2 ve B4'te borç iadeden önce gönderilmeli.

### Mutantlar
- 310 (iade her zaman sondan küçültür): B2, B4, B6'nın toplamında değerle yakalandı.
- 311 (iade her zaman ilk taksitten): B5'te değerle yakalandı (ayrıca d45 A6/A6B, d46, d34, d35).
- 312 (ölçüt kontrol anı): B6'da değerle yakalandı.
- 200–309 hâlâ yakalanıyor; yaşayan mutant yok.
- Açık bir sınır: karşılaştırma carilerinde (B2 / B4) "ilk taksitten" mutantı değerle ayrılamaz, çünkü kararın (b)'si zaten "iade ilk taksitten düşer" diyor. Ayıran cari B5.

### Test sayıları
UTC ve Europe/Istanbul'da aynı sayılar; çıktılar ve G3 dökümü bayt bayt aynı.

| Koşu | Sonuç |
|---|---|
| Cari öz test | 6.678/6.678 |
| Mutasyon taraması | 279/279 |
| Eşdeğerlik + G3 | 605/605 (≤ 2.4.9 kipleri 484/484 bayt bayt aynı) |
| Yeni / değişen elle tablolar | 512/512 |
| Eski kâhinde kırmızı | 37 / 512 (beklenen nedenle) |
| Eski elle tablo farkı | 100/100 izinli |
| G1 tarama | 100/100 |
| Mutant ↔ senaryo | 676/676 |
| Geniş tarama | 2.201/2.201 |
| Defter öz testi | 181/181 |
| Madde 4 taraması | çıkış 0 |
| Mobil öz test | 162/162 (63/63 mutasyon) |

Kilit doluyken `flock -n` hemen döndü. Yerine tek seferlik bekleyen `flock -s -w 1800` kullandım; döngü yok.

### G3 dökümü (bakım 18 ↔ bakım 19)
- Denetim sayısı 50.797 → 50.775; değişen / kalkan / yeni toplam 32 (27 kalkan + 5 yeni, DEĞİŞEN 0); BEKLENMEYEN 0; yalnız etiketi değişen 0.
- Senaryo senaryo:
  - d30: S170, 1 kalkan
  - d42: S170, 11 kalkan; madde 4, 3 kalkan
  - d43: madde 4, 2 kalkan
  - d45 (eski adımlarıyla): S162 ölçütü, 5 kalkan
  - d45 (yeni adımlarıyla): S162 ölçütü, 5 kalkan + 5 yeni
- Öbür 96 elle senaryoda ve 20 rastgele senaryoda fark 0.

### Mobil yazma kâhini
- Kabul dosyası kendi üreticisiyle yeniden üretildi: 55 elle × 256 birleşim + 3 rastgele.
- Bakım 2'nin fark aracıyla döküm: değişen anahtar 0, BEKLENMEYEN 0; yalnız `cari_model_sha256` değişti. Bu dilde satış kartı yok; E43-L hâlâ S162 alanında, K / M değil.
- Kural, `kahin.py` ve `program-surucu.mjs` değişmedi.
- Üretici denetimi `--denetle`'nin kendi çıkışı 0; kanıt aracı TAP özeti bulamadığı için "BELİRSİZ" yazıp 1 döndü — bakım 2'deki gibi, komut TAP üretmiyor.

### KULLANICIYA SORULMALI
YOK.

**Baş mimara — değerlendirilsin:**
1. Ölçütün öbür yönü (B6 — borç silinince DEĞER) kararın harfinden çıkarıldı.
2. S170 KAPSAM'ın harfiyle iade karttan önce yazılmışsa da uygulandı (d30 Q7).
3. Madde 4 yüzünden Y17-6'nın S163 pencere toplamını DEĞER sayan kısmı düştü.
4. S163'te Σ açık ve "bütün kalemler gecikmişken gecikmiş" S163 KAPSAM'ının açık sözüyle DEĞER kaldı.
5. B5'in beklentisi mevcut S2 / C13.4 (4) kuralından geliyor; yeni kural değil.

### DENENMEYEN
- Program koşulmadı. Programın iadeyi yazıldığı anda mı değerlendirdiği ve borç sonradan silinince kartı yeniden hesaplayıp hesaplamadığı bilinmiyor.
- İki iade (biri borcun tamamı taşınırken, biri değil) aynı kartta; geri yükleme; satış kartında yazım sırası komşusu; S170'te Değersiz / iade faturası.
- Dişsiz kalanlar: madde 4 sayaç silme yolu, d44 Y4 ve d45 B1 pencere toplamları (iki kâhinde de anahtar hiç yazılmıyor).
- Rastgele üretici satış kartı + faturasız iade üretmiyor.
- Mobil A2'nin dişi koşulmadı; yalnız sha farkından (b458… ≠ 2701…) çıkarıldı.
- `YAPIM-ASAMASI.json` ve `kos.mjs` açılmadı.

### Ana oturumun yeniden koşacağı komutlar
- Eski kopya: `git archive kahin19-taban test/bagimsiz/defter test/bagimsiz/cari test/bagimsiz/mobil-yazma | tar -x -C <yeni klasör>`
- Cari kanıtı: `bash docs/kanit/2026-11-13/kahineski19-arac/kos.sh utc` ve `… ist`. Betikteki W / E / KANIT_DIR yolları sabit; kendi kopyanıza göre değiştirin.
- Mobil: `bash docs/kanit/2026-11-13/kahineski19-arac/mobil-kos.sh`
- Kabul farkı: `python3 -I -B docs/kanit/2026-11-13/kahinmobil2/arac/kabul-fark.py <eski kabul.json> test/bagimsiz/mobil-yazma/kabul.json <döküm.json>`
- Elle tablolar tek başına: `python3 -I -B docs/kanit/2026-11-13/kahineski19-arac/elle-karsilastir.py --model test/bagimsiz/cari <d45 d42 d30 d43 d44 senaryo dosyaları>`
- Kanıt dosyaları `docs/kanit/2026-11-13/` altında: `kahineski19-*` (cari) ve `kahineski19-mobil/`.

### Okunan dosyaların tam listesi
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-eski19-istem.txt` — tamamı
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-eski19-kararlar.md` — tamamı
- `CLAUDE.md` — tamamı (oturum yükledi)
- `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` — 1–82, tamamı
- `test/bagimsiz/cari/KARARLAR.md`:
  - başlık taraması
  - 3784–4244 (§28 ve §29 tamamı)
  - 3249–3256, 3325–3332, 3348–3353, 3435–3442, 3564–3570, 3644–3658, 3691–3694
  - SK-30 / SK-31 geçen satırlar (grep ile, kırpılmış)
- `test/bagimsiz/cari/model.py`:
  - 5060–5120 (eski `_sus17`), 3395–3420, 3847–3880, 1767–1790
  - 1455–1515, 1266–1292, 5222–5310
  - 4405–4575, 4600–4650, 4910–5040
  - 5555–5575, 596–600, 386–400, 3845–3849
  - anahtar adı grep'leri
- `test/bagimsiz/cari/oz-test.py` — 42–56, 280–494 ve grep satırları
- `test/bagimsiz/cari/senaryolar/`:
  - d45 (B / C carileri, adım listesi, elle kayıtlar)
  - d42 (adımlar ve elle kayıtlar tamamı)
  - d30 (Q7)
  - d43, d44, d46, d34 (elle kart / pencere toplamı anahtarları)
  - bütün senaryolarda stok iadesi ve satış kartı taraması
- `test/bagimsiz/mobil-yazma/README.md` — başlıklar ve 299–415
- `test/bagimsiz/mobil-yazma/senaryolar.py` — 1–12 ve grep satırları
- `docs/kanit/2026-11-13/kahineski18-arac/`:
  - `kos.sh`, `karsilastir.py` (1–340), `bicim.py`, `elle-fark.py`, `mutant-senaryo.py`, `mutasyon-tara.py` — tamamı
  - `senaryolar18.py` 1–30 ve 100–131; `elle-karsilastir.py` 1–30; `genis-tarama.py` 1–20; `g1-tara.py` 1–12
- `docs/kanit/2026-11-13/kahinmobil2/arac/`: `kanit-kos.sh` (tamamı), `kabul-fark.py` 1–30, `eski-kirmizi.py` 1–25
- `docs/kanit/2026-11-13/` dosya listesi (yalnız kahineski18 adları)
- `kos.mjs` ve `program-surucu.mjs` AÇILMADI.
