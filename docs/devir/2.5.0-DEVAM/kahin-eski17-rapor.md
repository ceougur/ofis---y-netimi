# Cari kâhini bakımı 17 — ajanın İLK raporu (13.11.2026; AYNEN; bakım YARIM — kanıt koşuları yapılmadı)

# CARİ KÂHİNİ BAKIMI 17 — RAPOR (BAKIM YARIM KALDI: kod ve senaryolar hazır, kanıt koşusu YAPILMADI)

Yük 4'ün üstündeyken (4,03–4,28; ana oturumun `test/bagimsiz/muhasebe/mutasyon.py` koşusu 4 çekirdeği dolduruyordu) yeni koşu başlatmadım. Tam kanıt koşusunu (G3, iki saat dilimi) bu yüzden yapamadım; sonra rapor vermem istendi. Durum şöyle:
- Dal `worktree-agent-a443903fcdb8ea29f`, taban `kahin17-taban` (f61f058e). Bakım 16'nın commit'leri dalda var (7d2522e4, 72783564, d7c08ba9, 0c945d05). PUSH yok.
- **c922f576 (yalnız yorum):** KARARLAR.md'ye §28 eklendi (Y17-1 … Y17-9, alt durum tablosu, KULLANICIYA SORULMALI SK-36 / SK-37). Ders 40 gereği kuraldan önce ayrı commit.
- **750d066b (kod):** `model.py`, `oz-test.py` (yalnız açıklama), d45 (yeni), d30 / d42 / d43 / d44 güncellemeleri, araçlar `docs/kanit/2026-11-13/kahineski17-arac/`, KARARLAR.md'de §28'in kod bölümleri. §28'in G3 ve Kanıt bölümleri YAZILMADI.
- Ağaç temiz.
- Eski kâhin kopyası (bakım 16, değişiklikten önce `git archive HEAD`): `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahineski17-q7/eski/`.

## Yorum (önceki okuma → yeni kural)
**S159**
- Bakım 16: A > 0 → A' = 0, B' < 0 durumunda SUS idi (SK-35, iki dünya).
- Şimdi: adımdan sonra A' = 0 ise S155 bağlamaz, KABUL. Türü fark etmez (kararın gerekçesi genel; S155 "türü fark etmez").
- Y16-4 (adımdan önce kural zaten bozuk) aynen SUS.
- Şüpheliden ÖNCEYE tarihli aşan tahsilat: açık şüpheli kalıyor (900), S155 ile RET. Karar bunu söylüyor, soru değil.

**Adım seçeneği (S118 = B)**
- Sınır K = kart tutarı − karta doğrudan bağlı tahsilatlar (kartın Taksit Tahsilatları + Tablodan Aktar'ın taşıdığı / parça).
- Kart seçilmeden alınan tahsilatın S50 payı K'yı düşürmez. Dayanak S129 KARAR: sınır göstergelerden ayrı, "kartın KENDİ kalanı".
- Sınırın iki okuması var: K' = K − avansla ödenmiş kısım (S101) − para dışı iade/Değersiz payı.
- K' < tutar ≤ K iken seçeneksiz adım SUS (SK-36 — bakiye okumalar arasında farklı). Seçenekli adım iki okumada da kabul.

**S154 = B**
- Kartın kendi kalanını aşan bir 'Fazlasını Avans Yaz' adımıyla kapanan kartta (o adımda K' = K, kontrolde avansla ödenmiş kısım 0): 'Tahsil Edilen' = karttan alınan paranın tamamı.
- 'Kalan' ve taksit 'Ödenen' tek kuyruktan, değişmedi.
- S144 (c)'nin öbür alt durumları (S101 kaynaklı kuyruk fazlası — d30 KQ1 / KQ3 — ve sınır bölgesi) SUS aynen; neden metni yenilendi.

## Adımın yeni alanı (koşucu eşlemesi için)
- Adım biçimi: `kart_tahsilat {kayit, tutar, tarih, fazlasiniAvansYaz}`.
- `fazlasiniAvansYaz: true`: 'Kalanı Aşan Tutar' sorusuna 'Fazlasını Avans Yaz' yanıtı.
- Alan yok ya da `false`: yanıt yok / vazgeçildi.
- Alan yalnız 2.5.0'da okunur; kalanı aşmayan tahsilatta etkisiz.
- Ret'in senaryo dosyasındaki görünümü: `"elleBeklenen": {"adim:<id>:durum": "ret"}`. Kasa, bakiye ve kart değerleri adım yokmuş gibi kalır; ileti / kod denetlenmez.
- `kos.mjs` değiştirilmedi. Bugün `POST /api/workspace/plans/<kart>/entries {kind, amount, date, method: "cash", cashForce: true, similarOk: true}` gönderiyor. Seçenek varken 'Fazlasını Avans Yaz' yanıtı gönderilmeli, yokken gönderilmemeli. Programın alan adı bende yok.

## Kartın kendi kalanını aşan tahsilat taşıyan mevcut senaryoların TAM listesi
Tarama bütün elle senaryolarda ve rastgele s1 / ux18 tohum 1–10 × 120'de yapıldı. 71 kart tahsilatının 5'i K' < tutar; rastgelede 0.
1. **d43 U1** (`u1k`; K 1.000, tutar 1.100): seçenekli. Beklentiler aynı; KU1 odenen `elleYok` → 110000 (S154 B); S144 belirsiz kaydı kalktı.
2. **d43 U2** (`u2k`; K 400, tutar 600): seçenekli. KU2 odenen `elleYok` → 60000; S141 susması aynen; S144 kaydı kalktı.
3. **d30 Q1** (`q1k`; K 600, K' 0): seçenekli, çünkü S101 A "kartın tahsilatı avansa eklenir" kabul diyor. Beklentiler değişmedi; KQ1 odenen SUS aynen.
4. **d30 Q3** (`q3k`; K 600, K' 200, tutar 500): seçenekli; beklentiler değişmedi.
5. **d30 Q5** (`q5k`; K 600, K' 0; SK-14 alanı): seçenekli; beklentiler değişmedi.

Bu beş senaryonun hepsi kabul varsayıyordu ve kabulün tek yolu seçenek; amacı tek biçimde çıkmayan senaryo yok.

## S162 / S163 susma alanları
**S162** — koşullar kontrol anında okunur (kararın karşılaştırma örneğinde de sonradan yazılan borç sonucu değiştiriyor):
- Kartın taksitinde faturasız stok iadesi payı > 0.
- Carinin kuyruğunda kart taksitleri dışında açık borç yönlü kalem yok (taksitli fatura başka borç sayılır).
- Kart türü:
  - Satış kartı DEĞİLSE: BİLİNEN SINIR (S162 = B).
  - Satış kartıysa: SK-37 SUS.
- SUS anahtarlar: `kart:<no>:toplam`, `kart:<no>:taksit<i>:odenen`, `cari:<ad>:gecikmis`.
- DEĞER verilmeye devam eden: bakiye, `kalan`, `odenen`.
- **KAPSAM'dan sapma (değerlendirmen için):** KAPSAM 'Tahsil Edilen'i susma listesine koyuyordu; yazmaya devam ettim. İki okumada aynı, ve S158 A KARAR'ının kendi örneği (Tahsil Edilen 0, Kalan 600) tam bu alt durum.

**S163** — koşullar:
- Kart tek kuyruğun `s120` listesinde.
- Kart açılırken carinin kalanı 0 olan ve hiçbir kartın içine alınmamış elle borcu var (Borç Yaz / borçlu Açılış). Bu, kart adımı anındaki kuyruktan okunur.
- SUS anahtarlar (açık kalem dağılımı): satış faturası `acik`, borç yönlü elle `kalan`, takvim / Vade Takip / projeksiyon `hareket` ve `fatura` kalemleri, carinin kartlarının odenen / kalan / taksit odenen.
- Gecikmiş YALNIZ vadesi bugün ya da ileride olan açık bir kalem varsa SUS. Bütün açık kalemlerin vadesi geçmişse gecikmiş iki okumada aynıdır, yazılır (kararın "bugünkü 1.670 = 1.670"si).
- Bakiye ve toplamlar SUSMAZ: iki okuma da yalnız aynı borcun kalemler arasındaki dağılımını değiştirir.
- Kâhinin sınırı: kart adımından sonra girilen geriye tarihli bir kayıtla kapanan eski borç ölçüye girmez.

**S150 (BAŞ MİMAR YORUMU):** kâhinde alanı yok.
- Hazır aralık ve 'Gecikmiş Tahsilat' göstergesi kâhinin dilinde yok.
- Vade Takip denetimi kalem başına, bugün + 6'ya kadar; koşucu Vade Takip'i yalnız `preset=open` ile okuyor (`kos.mjs` eşlemesi okundu).
- Yorumun kapattığı kalem (söz bugün + 15) pencerenin dışında, hiçbir anahtar yazılmıyor. Çelişen beklenti yok, beklenti değişmedi.

## Yeni / değişen elle senaryolar ve değerleri
**d45-c5-s159-s154-s162-s163** (bugün 15.06; 115 elle denetim):
- **S159 komşuları** (borç 1.000 → şüpheli 900):

| Durum | Sonuç | Bakiye | Görünüm toplamı | Gecikmiş |
|---|---|---|---|---|
| Z2: bugün tahsilat 1.000 | KABUL | 0 | 0 | 0 |
| Z3: bugün tahsilat 300 | KABUL | 700 | 100 | 100 |
| Z4: şüpheliden önceye tarihli 1.100 | RET | 1.000 | 100 | – |
| Z5: bugün alınan çek 1.100 | KABUL | −100 | – | – |

- **Seçenek / S154** (borç 1.200 → kart 1.200 / 3):

| Durum | Sonuç | Tahsil Edilen · Kalan | Taksit Ödenen | Bakiye |
|---|---|---|---|---|
| A1: S154'ün örneği (karttan 500, sonra 800 seçenekli) | KABUL | 1.300 · 0 | 400 / 400 / 400 | −100 |
| A2: aynı, 800 seçeneksiz | RET | 500 · 700 | 400 / 100 / 0 | 700 (gecikmiş 700) |
| A3: kalanı aşmayan 500 seçenekli | KABUL — A2'nin ilk adımıyla aynı | 500 · 700 | 400 / 100 / 0 | 700 |
| A4: 500 + tam kalan 700 seçeneksiz | KABUL | 1.200 · 0 | 400 / 400 / 400 | 0 |

- **A5:** kart 900, karta bağlanmadan 500, sonra karttan 600 seçeneksiz → KABUL, çünkü sınır kartın kendi kalanı 900. Tahsil Edilen 900 · Kalan 0, bakiye −200.
- **A6:** Borç 900 + Borç Z 500 (vade 30.06), kart 900, stok iadesi 300, karttan 700 seçeneksiz → SK-36 SUS.
- **A6B:** aynı adım seçenekli → KABUL: bakiye 400, Tahsil Edilen 700, Kalan 0, taksit 300 / 300 / 100, Z Kalan 400.
- **S162:**
  - B1 (kararın örneği): toplam, taksit Ödenen ve gecikmiş SUS; Kalan 600, Tahsil Edilen 0, bakiye 600.
  - B2 (karşılaştırma örneği, aynen): kart 900, Kalan 600, taksit 0 / 0 / 0, gecikmiş 300, bakiye 1.100.
- **S163:**
  - C1: dağılım SUS, bakiye 1.500.
  - C2 (komşu, kapanmış borç yok): F açığı 600, E1 Kalan 500, E2 Kalan 400, kart 700 / 0 / 700, gecikmiş 800.
  - C3: bütün açık kalemler gecikmiş → dağılım SUS, gecikmiş 1.500 yazılır.

**Değişen mevcut senaryolar:**
- **d44 X12** (S159'un kendi örneği): ok, bakiye −100, gecikmiş 0; SK-35 kalktı.
- **d44 Y4:** taksit Ödenen, toplam ve gecikmiş `elleYok`'a.
- **d42 T7:** toplam ve taksit Ödenen `elleYok`'a; Tahsil Edilen 0, Kalan 600, bakiye aynen.
- **d42 T6** (SK-37): taksit Ödenen ve gecikmiş `elleYok`'a.
- **d43 / d30:** yukarıdaki listedeki gibi.

İlk koşuda 446/446 elle denetim tuttu (d45 115 + d30 138 + d42 77 + d43 40 + d44 76). Hiçbir elle değer kâhine göre düzeltilmedi.

## Mutantlar
Yeni mutantların hepsi `oz-test.py`'de DEĞERLE yakalandı:

| No | Ne bozar | Yakalandığı elle senaryo sayısı (ilk yakalayan) |
|---|---|---|
| 303 | S159 B — açık şüpheliyi sıfırlayan adımı RET | 2 (d44 X12) |
| 304 | Seçenek yok sayılır — her zaman kabul | 2 (d43 KU1) |
| 305 | Seçenek yok sayılır — her zaman ret | 3 (d30) |
| 306 | S154 A — Tahsil Edilen kart tutarını aşmaz | 2 (d43 KU1) |
| 307 | S118 A — sınır tek kuyruk Kalan'ı | 4 (d30 KQ4) |

Bakım 6 … 16 mutantları (200–302) da aynı öz testte yakalanıyor. 303–307'nin senaryo dökümü (`mutant-senaryo.py`) koşulmadı. §28 C10u'daki "hangi senaryolar" listesi elle yazıldı, o koşuyla doğrulanmalı.

## Test sayıları
- **Koşulan:** cari öz test 6514/6514, çıkış 0. Yalnız geliştirme ortamında, saat dilimi açıkça verilmeden koştu (ortam TZ'si); `flock -s -n` ile, iz dosyası `scratchpad/kahineski17-q7/gelistirme/oz1.txt`. Elle karşılaştırma 446/446.
- **Koşulmayan:** `kanit.mjs` ile UTC / Europe/Istanbul resmî koşusu, defter öz testi, mutasyon taraması, eşdeğerlik + G3, eski kâhinde kırmızı, elle-fark, G1 tarama, mutant ↔ senaryo, geniş tarama.

## G3 dökümü
YAPILMADI. Araç hazır: `kahineski17-arac/karsilastir.py`.
- Yeni sınıflar S159 / S118 / S154 / S162 / S163 / GENEL.
- Seçenek eklenen d30 / d43 adımları "yalnız `fazlasiniAvansYaz`" istisnasıyla denetleniyor; yeni hâlleri de "yeni:" önekiyle karşılaştırılıyor.
- Beklenen: eski d43 / d30 (seçeneksiz) yeni modelde S118 sınıfı (RET / SUS); d44 X12 S159; d42 T6 / T7 ve d44 Y4 S162; rastgelede fark 0. BEKLENMEYEN 0 olmalı.

## KULLANICIYA SORULMALI
- **SK-36 — 'kartın KENDİ kalanı'na avansla ödenmiş kısım ya da para dışı iade payı girer mi?** Bakiye okumalar arasında farklı.
  - (a) Avansla 'Bitti' kart: tahsilat 1.000 → stoktan taksitli satış 600 → karta 300, soru yanıtsız.
    - A — kendi kalanı 600, soru çıkmaz: KABUL, bakiye −700.
    - B — kendi kalanı 0, soru çıkar, yanıt yok: RET, bakiye −400.
  - (b) Para dışı pay: Borç 900 + Borç 500 (vade 30.06) → kart 900 → stok iadesi 300 → karta 700, yanıtsız.
    - A — kendi kalanı 900: KABUL, bakiye 400.
    - B — kendi kalanı 600: RET, bakiye 1.100.
  - C: Uç durum böyle kalsın (BİLİNEN SINIR).
- **SK-37 — S162 = B satış kartını da kapsar mı?** Bakiye her seçenekte aynı. Örnek: satış kartı 1.000 (2 × 500), karttan 300, faturasız iade 400; bakiye 300, Tahsil Edilen 300 · Kalan 300 iki okumada aynı.
  - A — S140 sırası: 1. taksit kapanır, 2. taksitte 300 açık, gecikmiş 0.
  - B — S162 kapsar: kart 600'e iner, 1. taksitte 200 açık, gecikmiş 200; BİLİNEN SINIR.
  - C: Uç durum böyle kalsın.
- **Not (kural değil):** S151 KARAR'ı "iade faturasıyla kart küçülür" diyor. Kâhin, iade faturasının artanının satış kartı olmayan kartı kapattığı durumda kart toplamını asıl tutarla yazıyor; bunun elle senaryosu yok.

## DENENMEYEN
§28 C12u'da yazılı. Özetle:
- Program koşulmadı.
- S163'te kart adımından sonra girilen geriye tarihli kayıt.
- S162'de faturalı iade, Değersiz, birden çok kart, kart açığından büyük iade.
- Seçenekte Tablodan Aktar kartı ve şüpheli caride seçenekli tahsilat.
- Rastgele üretici seçenek üretmiyor; üretici değişmedi.
- Kanıt koşularının tamamı (yukarıda).

## Ana oturumun koşacağı komutlar
`cat /proc/loadavg` yük ≤ 4 gösterdikten sonra, ayrı adımda:
```
bash docs/kanit/2026-11-13/kahineski17-arac/kos.sh utc   (sonra: … kos.sh ist)
```
- Çalışma dizini bu worktree, eski kopya `scratchpad/kahineski17-q7/eski`, KANIT_DIR `scratchpad/kahineski17-q7/kanit`.
- Sonra §28'e G3 / Kanıt bölümleri ve "Kanıt:" commit'i.
- Ayrıca gerekenler: koşucu eşlemesi, mobil yazma kâhininin `cari_model_sha256`'sı, yapım aşaması listesi.

## Okunan dosyalar (satır aralıklarıyla)
- **Görev ve karar:** `scratchpad/kahineski17-istem.txt` (1–39), `scratchpad/kahineski17-kararlar.md` (1–32).
- **Kurallar:** CLAUDE.md (sistemden, tamamı), `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (1–82).
- **KARARLAR.md:** 1–12, 716–724, 929–958, 2279–2307, 2988–3007, 3068–3081, 3233–3783; grep satırları (S118 / S120 / S144 / kartfazla / vadeTakip).
- **model.py:**
  - 1–40, 60–83, 374–389, 578–593
  - 1081–1086, 1300–1450, 1640–1674, 1750–1779
  - 3555–3630, 3827–3901
  - 4505–4539, 4993–5010, 5080–5227, 5400–5556
  - grep satırları
- **Diğer kâhin dosyaları:** `oz-test.py` (1–60, 270–340); `kos.mjs` yalnız 200–236 ve 595–625 (Vade Takip ve `kart_tahsilat` eşlemesi).
- **Senaryolar** (yalnız ilgili adımlar ve beklentiler): d30, d42, d43, d44.
- **Araçlar:** `docs/kanit/2026-11-13/kahineski16-arac/` (kos.sh, karsilastir.py, bicim.py, yeni-senaryolar16.py 1–40, elle-karsilastir.py 1–20, elle-fark.py, mutant-senaryo.py, mutasyon-tara.py 1–30, genis-tarama.py 1–25, g1-tara.py 1–15); `kahineski16-kos-utc.txt` (ilk 1.500 bayt).

Okunmayanlar: `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (kanit.mjs çalıştırılmadı), `docs/devir/**`, iş listeleri, YAPIM-ASAMASI.json, iki kâhin klasörü dışındaki `test/**`, git farkı / geçmiş içeriği. Bir istisna: `ps` çıktısında başka bir sürecin komut satırı (muhasebe mutasyon koşusu) yalnız yük nedenini görmek için okundu.

---

(EK RAPOR — 13.11.2026; AYNEN)

# Cari kâhini bakımı 17 — kanıt koşuları (ek rapor)

Kanıt koşuları iki saat diliminde de tamam: bütün adımlar çıkış 0 verdi, G3'te BEKLENMEYEN 0. Model ve senaryolara dokunmadım (SK-36 / SK-37 susması aynen sürüyor).

- **Dal:** `worktree-agent-a443903fcdb8ea29f`, ucu **261b1aec**. Ağaç temiz, push yok.
- **Commit'ler:** c922f576 (yorum) → 750d066b (kod) → 261b1aec ("Kanıt:" — §28'in G3 ve Kanıt bölümleri, C10u düzeltmesi, `docs/kanit/2026-11-13/kahineski17-*`).
- **Yük:** UTC koşusu başlarken 1,83, IST koşusu başlarken 2,42 (4 çekirdek); bekleme gerekmedi.

## Test sayıları
Kâhin `750d066b`, temiz ağaç. UTC ve Europe/Istanbul aynı sayıları verdi; çıktılar başlık satırları dışında bayt bayt aynı.

| Koşu | UTC | Europe/Istanbul |
|---|---|---|
| Cari öz test | 6514/6514 | 6514/6514 |
| Defter öz testi | 181/181 | 181/181 |
| Mutasyon taraması | 274/274 | 274/274 |
| Eşdeğerlik + G3 | 603/603 | 603/603 |
| Yeni / değişen elle tablolar | 446/446 | 446/446 |
| Eski kâhinde kırmızı | 56/56 | 56/56 |
| Eski elle tablo farkı (izinli) | 98/98 | 98/98 |
| G1 tarama | 99/99 | 99/99 |
| Mutant ↔ senaryo (d35…d45 × 261–307) | 517/517 | 517/517 |
| Geniş tarama | 2201/2201 | 2201/2201 |

- **Üretici:** 20/20 aynı dizi.
- **Adımlar:** eski kopyadaki 98 elle senaryonun hiçbirinin adımı değişmedi; d30 ve d43'e yalnız `fazlasiniAvansYaz` alanı eklendi.
- **Eski kurallar (2.4.9 / 2.4.6 / 2.4.5 / legacy):** 484/484 bayt bayt aynı.

## G3 dökümü (2.5.0)
Eski kâhinde 50.516, yeni kâhinde 50.454 denetim var. Değişen / kalkan / yeni toplam **140**, **BEKLENMEYEN 0**, yalnız etiketi değişen 13. Dökümler iki saat diliminde bayt bayt aynı.

| Sınıf | Adet | Nereden geliyor |
|---|---|---|
| S118 | 59 (26 değişen, 27 kalkan, 6 yeni) | Seçeneksiz eski d43 U1 / U2 artık RET; seçeneksiz eski d30 Q1 / Q3 / Q5 sınır bölgesinde SUS; d45 A2 RET, A6 SUS |
| S154 | 3 yeni | KA1 130000; d43'ün yeni hâlinde KU1 110000, KU2 60000 |
| S159 | 14 yeni | d44 X12 ve d45 Z5 |
| S162 | 19 kalkan | d42 T7 / T6 (9), d44 Y4 (5), d45 B1 (5) |
| S163 | 37 kalkan | d45 C1 / C3 |
| GENEL | 8 | Kasa / Kasa raporu, aynı kontroldeki sınıflı değişiklik yüzünden |

- Öbür 94 eski elle senaryo ve 20 rastgele senaryoda fark 0.
- Seçenek eklenmiş d30'un yeni hâlinde de fark 0.

## Mutantlar
Değerle yakalanma, bütün /3 elle senaryolar üzerinde koşuyla okundu:

| Mutant | Yakalayan senaryolar (kırmızı elle değer) |
|---|---|
| 303 | d44 X12 (3), d45 Z5 (2) |
| 304 | d43 (2), d45 (8) |
| 305 | d30 (14), d43 (11), d45 (16) |
| 306 | d43 (2), d45 (1) |
| 307 | d45 A5 (7), d30 / d31 / d32 KQ4 (5 / 5 / 6) |

Kod commit'inde elle yazdığım listede "307 … d43" diyordum; yanlıştı, d43'te 307 yakalanmıyor. C10u'yu koşu sonucuyla düzelttim. 200–302 arası mutantlar aynen yakalanıyor.

## Eski kâhinde kırmızı
446 elle denetimin 56'sı eski (bakım 16) kâhinde kırmızı: d45 34, d42 11, d44 9, d43 2, d30 0. Kırmızıların hepsi beklenen nedenle:
- S159 / S154 alanında "ANAHTAR YOK".
- Seçeneği bilmediği için d45 A2'yi kabul etmesi (RET yerine "ok").
- SK-36 / S162 / S163 alanında değer yazması.
- 7 yeni `belirsiz` kaydının eski kâhinde olmaması.

Kalan 390 denetim iki kâhinde aynı; d30'un 138'i de bunların içinde.

## Dosyalar
- `test/bagimsiz/cari/KARARLAR.md` (§28: C0u, Kanıt, C10u)
- `docs/kanit/2026-11-13/kahineski17-arac/kos.sh`
- `docs/kanit/2026-11-13/kahineski17-g3-dokum-utc.json`, `docs/kanit/2026-11-13/kahineski17-g3-dokum-ist.json`
- `docs/kanit/2026-11-13/kahineski17-kos-utc.txt`, `docs/kanit/2026-11-13/kahineski17-kos-ist.txt`

Yeniden koşmak için worktree'de: `bash docs/kanit/2026-11-13/kahineski17-arac/kos.sh utc`, sonra `… ist`.
