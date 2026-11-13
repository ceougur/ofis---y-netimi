# Cari kâhini bakımı 18 — ajanın raporu (13.11.2026; AYNEN)

**CARİ KÂHİNİ BAKIMI 18 — RAPOR (Türkçe)**

Bakım tamamlandı: yorum ayrı commit'te, ardından kod ve kanıt commit'leri geldi; kanıt iki saat diliminde koşuldu. Bütün adımlar çıkış 0 verdi. Programın kodu görülmedi, program koşulmadı. Push yapılmadı.

Dal `worktree-agent-a91efef1dcc98d5a8` (taban `kahin18-taban` = 261b1aec; bakım 17'nin üç commit'i dalda doğrulandı):
- **464d56ff** — yorum: KARARLAR.md §29, ders 40 gereği koddan önce.
- **7434dd1f** — kod: `model.py`, `oz-test.py`, yeni d46, d45 A6 ve d42 T6 güncellemesi, araçlar `docs/kanit/2026-11-13/kahineski18-arac/`.
- **b8b47593** — kanıt: G3, mutantlar, Kanıt bölümleri ve `docs/kanit/2026-11-13/kahineski18-*` dosyaları.

**Ortam (son okuma):** yük 1,31 / 4 çekirdek, boş bellek 7 GB (kullanılabilir 14 GB), boş disk 8,2 GB. Benden kalan arka plan işi yok.

---

### 1. Yorum: bakım 17'deki okuma ve yeni kural

**Bakım 17'de iki sınır vardı:**
- K = kart tutarı − karta doğrudan bağlı tahsilatlar.
- K' = K − avansla ödenmiş kısım (S101 `onceden`) − para dışı pay (iade / iade faturası artanı / Değersiz).
- K' < tutar ≤ K bölgesinde seçeneksiz adım SUS idi (SK-36, iki dünya). Aynı bölgede seçenekli adım kabul ediliyor ve `_s154x` izi kuruluyordu.

**Yeni kural (Y18-1 — S165 = A + S118 = B OKUMASI):** tek sınır K; K' okuması düştü. K'yı küçültmeyen üç şey var:
- avansla ödenmiş kısım;
- başka yerden gelip tek kuyrukta bu kartın taksitine sayılan para (S118'in örneğindeki "700, 600 değil");
- para dışı pay: faturasız iade, Değersiz ve iade faturasının artanı. Sonuncusu S165'teki "gibi para dışı pay" ve §27 Y16-8 ile tek okuma sayıldı.

**Kurallar:**
- tutar ≤ K → soru yok, KABUL. Seçenek etkisiz: seçenekli ve seçeneksiz aynı çıktıyı verir.
- tutar > K ve seçenekli → KABUL.
- tutar > K ve seçeneksiz → RET (bakım 17 ile aynı).
- SK-36 tamamen kalktı; `sus_s118` artık hiç dolmuyor.

**Bakım 17'de SK-36 ile susan ya da seçenekle kurtarılan adımlar (Y18-2):**
- **d45 A6** (S165'in kendi örneği): SUS → **KABUL**. Bakiye 400, 'Tahsil Edilen' 700, Kalan 0, taksitler 300 / 300 / 100, Z Kalan 400, gecikmiş 0 (A6B ile aynı değerler).
- **d30 Q1 / Q3 / Q5:** beklentiler aynı, seçenek artık etkisiz, adımlar değişmedi.
- **Hâlâ susan sınır adımı: YOK.**

**S154 = B ve S144 (c) ile etkileşim (Y18-3):** S154'ün alanı "tutar > K iken seçenekle kabul edilen adımla kapanan kart" olarak okundu. Dört alt durum:

| Alt durum | Bakım 17 | Bakım 18 |
|---|---|---|
| (1) tutar > K seçenekli, adımda para dışı pay var, avansla ödenmiş yok | SUS (`_s154x`) | **DEĞER**: 'Tahsil Edilen' = karttan alınan paranın tamamı |
| (2) tutar > K seçenekli, avansla ödenmiş kısım > 0 | SUS (S144 = C) | SUS aynen (S144 = C) |
| (3) tutar ≤ K, kart fazlası S101'den | SUS | SUS aynen; `_s154x` izi artık kurulmuyor |
| (4) ne para dışı pay ne avans (Y17-3'ün kendi alanı) | DEĞER | DEĞER aynen |

- Örnek (1), d46 A8: 700 sonrası 600 seçenekli → 'Tahsil Edilen 1.300 · Kalan 0', bakiye −200. Gerekçe: S158, S165 ve S154 aynı çizgide; iade para olmadığı için sayılmıyor.
- **BAŞ MİMAR'A — değerlendirin:** (1) yeni bir değer okumasıdır.
- (2)'de iki okuma kalıyor, ama bakiye iki okumada aynı ve durum zaten S144 = C bilinen sınırının içinde; bu yüzden yeni soru açmadım.

**S166 = B (Y18-4):** satış kartı kolunun susma anahtarları aynen duruyor (kart toplamı, taksit 'Ödenen', gecikmiş). Değişen yalnız neden metni: "BİLİNEN SINIR (kullanıcı kararı S166 = B) S166 (§29 Y18-4 — S162 = B satış kartında da)". İz `sk37` → `s166` oldu. d42 T6'nın `elleBelirsiz` kaydı da buna göre güncellendi.

### 2. Hâlâ susan sınırlar
Kart tahsilatı sınırında iki okumalı yer kalmadı. Tek kalan, Y18-3 (2) — avansla ödenmiş kartta 'Fazlasını Avans Yaz' sonrası 'Tahsil Edilen':
- Örnek d46 Q8: tahsilat 1.000 → satış 600 → karttan 700 seçenekli.
- Okuma A: 'Tahsil Edilen' = karttan alınan 700.
- Okuma B: avansla ödenmiş kısım da sayılır.
- Bakiye her iki okumada −1.100.
- Kâhin burada S144 = C gereği susuyor.

### 3. Yeni / değişen elle senaryolar (kâhin koşulmadan, karar metninden)
**d46-c5-s165-s118-sinir** (bugün 15.06.2026; 73 değer + 2 `elleYok` + 2 `elleBelirsiz` = 77 denetim):

| Cari | Kurgu | Sonuç |
|---|---|---|
| A7 | S165'in örneği AYNEN: Borç 900 + Borç Z 500 → kart 900 (3 × 300) → iade 300 → 700 | 700 sormadan KABUL (bakiye 400, 'Tahsil Edilen' 700, Kalan 0, taksit 300 / 300 / 100, Z Kalan 400); ardından 600 seçeneksiz RET (kalan 200), bakiye 400 kalır |
| A8 | A7'nin aynısı, 600 seçenekli | KABUL; bakiye −200, 'Tahsil Edilen' 1.300, taksit 300 / 300 / 300, Z Kalan 0 |
| Q7 | SK-36 (a) örneği: tahsilat 1.000 → satış 600 → karta 300 seçeneksiz | KABUL, bakiye −700 ('Tahsil Edilen' S144 SUS) |
| Q8 | aynı kurgu, 700 seçenekli | KABUL, bakiye −1.100 ('Tahsil Edilen' S144 SUS) |
| Q9 | aynı kurgu, 700 seçeneksiz | RET, bakiye −400 |
| R1 | S118'in kendi örneği: kart 1.000, karttan 300, başka karttan 100 avans → karta 700 seçeneksiz | KABUL; bakiye −100, 'Tahsil Edilen' 1.000 |
| R2 | aynı, 701 seçeneksiz | RET; bakiye 600, Kalan 600, 'Tahsil Edilen' 400, taksit 400 / 0, gecikmiş 600 |
| R3 | aynı, 701 seçenekli | KABUL, fazlası avans; bakiye −101, 'Tahsil Edilen' 1.001 |

- d46'nın 77 denetiminin hepsi ilk koşuda tuttu; hiçbir elle değer kâhine göre düzeltilmedi.
- **Bakım 17'nin elle beklentilerinden değişenler:**
  - d45 A6 (S165 A): SK-36 `elleYok` / `elleBelirsiz` kalktı, 9 değer eklendi.
  - d42 T6 (S166 = B): `elleBelirsiz` ["kart KT6","SK-37"] → ["kart KT6","S166 = B","BİLİNEN SINIR"].
  - Başka değişen yok.

### 4. Koşucu eşlemesi
Adım alanı **değişmedi** (`kart_tahsilat {kayit, tutar, tarih, fazlasiniAvansYaz}`); `kos.mjs` açılmadı. Değişen yalnız beklenti: kartta iade / Değersiz / avansla ödenmiş kısım varken tutar ≤ K ise program soru sormamalı ve seçeneksiz adım kabul okunmalı.

`model.py` değiştiği için mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli. Yapım aşaması listesini açmadım.

### 5. Mutantlar
- Yeni mutantlar değerle yakalanıyor:
  - **308** (S165 B — para dışı pay K'yı küçültür): d45 A6 ve d46 A7 / A8'de.
  - **309** (S118 A dar — avansla ödenmiş kısım K'yı küçültür): d46 Q7'de.
- **S118 A = 307**: tek kuyruk Kalan'ı; 307, 308 ile 309'un birleşimini de kapsar. d46 R1'de yakalanıyor (700 RET olur).
- 200–307 arası bütün mutantlar hâlâ yakalanıyor.
- d30 artık 305 / 307 / 309'u değerle yakalamıyor (seçenekli sınır adımı her durumda kabul); bu mutantlar başka senaryolarda yakalanıyor.

### 6. Test sayıları (UTC ve Europe/Istanbul aynı; hepsi çıkış 0; kâhin 7434dd1f, temiz ağaç)

| Koşu | Sonuç |
|---|---|
| cari öz test | 6.611/6.611 |
| mutasyon taraması | 276/276 |
| eşdeğerlik + G3 | 600/600 (2.4.9 / 2.4.6 / 2.4.5 / legacy: 480/480 bayt bayt aynı) |
| yeni / değişen elle tablolar | 275/275 |
| ESKİ (bakım 17) kâhinde kırmızı | 23 / 275 |
| eski elle tablo farkı | 99/99 izinli |
| G1 | 100/100 |
| mutant ↔ senaryo | 637/637 |
| geniş tarama | 2.201/2.201 |
| defter öz testi | 181/181 |

- Eski kâhindeki 23 kırmızının hepsi beklenen nedenle: SK-36 iki dünyası ya da KA8'in S144 SUS'u yüzünden "ANAHTAR YOK", bir de KT6'nın yeni neden metninin eski kâhinde bulunmaması.
- G3 dökümleri iki saat diliminde bayt bayt aynı.

### 7. G3 dökümü (bakım 17 ↔ bakım 18)
Eski 50.322 → yeni 50.357 denetim. Değişen / kalkan / yeni toplam **35**, hepsi YENİ: DEĞİŞEN 0, KALKAN 0, **BEKLENMEYEN 0**. Yalnız etiketi değişen 7.

| Sınıf | Adet | Nerede |
|---|---|---|
| S165 | 29 | d45 A6: 12 · d46 A7 / A8: 17 |
| S118-OKUMA | 2 | d46 Q7 |
| GENEL | 4 | d45 ve d46'nın Kasa ve Kasa raporu girişi |

Öbür 98 eski senaryo, d46'nın Q8 / Q9 / R1–R3 carileri ve 20 rastgele senaryoda fark 0. Üretici 20/20 aynı.

### 8. KULLANICIYA SORULMALI
**YOK.** Bakiyeyi değiştiren karar dışı alt durum bulmadım. Y18-3 (2) bakiyeyi değiştirmiyor ve S144 = C'nin içinde kalıyor; önceden sorulduğu için yinelemedim.

**GÖZLEM (soru değil):** d46 R2'de iki kartın 'Tahsil Edilen'i aynı parayı iki kez gösteriyor:
- Büyük kart 400 (S129 tek kuyruk; diğer kartın 100'lük fazlası onun taksitine sayılıyor).
- Küçük kart 300 (S154 B).
- Toplam 700 görünüyor, oysa karttan ödenen para 600; bakiye tek (600).
- İki karar da harfiyle bu sayıları veriyor; ekranda nasıl görüneceğine bakmanız önerilir.

### 9. DENENMEYEN
- Program koşulmadı.
- S165'in Değersiz ve iade faturası artanı kolları için elle senaryo yok (kural yolu aynı; 308 yalnız stok iadesi kolunda yakalandı).
- Tablodan Aktar kartında para dışı paylı sınır için elle senaryo yok.
- Şüpheli kayıtlı caride seçenekli tahsilat için elle senaryo yok.
- Kontrol anında sonradan doğan avansla ödenmiş kısım (Y18-3 (2)'nin o kolu) için elle senaryo yok.
- Rastgele üretici seçenek ve sınır bölgesi tahsilatı üretmiyor.

### 10. Ana oturumun yeniden koşacağı komutlar
Worktree `/home/user/ofis---y-netimi/.claude/worktrees/agent-a91efef1dcc98d5a8` içinde:
```
bash docs/kanit/2026-11-13/kahineski18-arac/kos.sh utc
bash docs/kanit/2026-11-13/kahineski18-arac/kos.sh ist
```
- Eski kopya: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahineski18-q7/eski` (`git archive kahin18-taban`); yoksa yeniden çıkarılmalı.
- Betik içindeki `W=` satırı bu worktree'yi gösteriyor.
- Yalnız öz test: `TZ=UTC python3 -I -B test/bagimsiz/cari/oz-test.py`
- Koşu günlükleri: `docs/kanit/2026-11-13/kahineski18-kos-utc.txt` / `-ist.txt`.

### 11. OKUNAN DOSYALARIN TAM LİSTESİ
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-eski18-istem.txt` (tamamı)
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-eski18-kararlar.md` (tamamı)
- `CLAUDE.md` (oturumla yüklenen tamamı; "Açık iş" kural kaynağı sayılmadı)
- `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` 1–82
- `test/bagimsiz/cari/KARARLAR.md`:
  - 3784–4061 (§28 tamamı)
  - 2994–3004 (S118 / S129)
  - 3368–3369 (Y15-14 S144)
  - 3644–3656 (Y16-8 / Y16-9)
  - başlık satırları taraması (`^## `)
  - 1–3783 arasında S118 / S144 / S154 / S158 / S151 geçen satırların ilk 160 karakteri
- `test/bagimsiz/cari/model.py`:
  - 66–74
  - 370–395
  - 591–598
  - 3921–3975 (`kart_tahsilat`)
  - 5050–5085 (`_sus17`)
  - 5230–5285 (kart göstergeleri)
  - 5605–5645 (`kos` iki dünya)
  - grep satırları (`sus_s118`, `_s154`, `SK-36/37`, `307`, `MUTASYONLAR`)
- `test/bagimsiz/cari/oz-test.py` 1–60, 312–322 ve grep satırları
- Senaryolar:
  - d45: A5 / A6 / A6B adımları ve beklentileri (betikle süzülerek)
  - d30: Q1 adımları ve beklentileri
- `docs/kanit/2026-11-13/kahineski17-arac/` araçları:
  - kos.sh, karsilastir.py, elle-fark.py, mutant-senaryo.py, mutasyon-tara.py, bicim.py (tamamı)
  - senaryolar17.py 1–60 ve 120–210
  - elle-karsilastir.py 1–20, g1-tara.py 1–20, genis-tarama.py 1–30
- `docs/kanit/2026-11-13/` klasör listesi (yalnız adlar)
- Kendi çıktılarım: kos-utc / kos-ist ve G3 dökümü.

**Okunmayanlar:** `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (kanit.mjs yalnız çalıştırıldı), `docs/devir/**`, iş listeleri, `YAPIM-ASAMASI.json`, `kos.mjs`, iki kâhin klasörü dışındaki `test/**`, başka ajanların kanıt dosyaları, git farkı / geçmiş içeriği.

Kâhinin kendi `model.py`'sini bir sonda betiğiyle koştum (`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahineski18-q7/prob/`). Amaç yalnız adımların hangi dala düştüğünü (K / onceden / pd) görmekti; elle beklentiler o çıktıdan türetilmedi.
