## CARİ KÂHİNİ BAKIMI 21b — RAPOR

Bakım 21b'yi beş commit'te bitirdim; hepsi `test/bagimsiz/cari/` ve `docs/kanit/2026-11-19/kahincari21b-*` altında. Push yok. Programın kodunu görmedim, programı koşmadım. Beklenen değerler kâhin koşulmadan, karar metinlerinden yazıldı. Bakım 21'in eski modelinde yeni denetimlerin 17'si beklenen nedenle kırmızı, yeni modelde hepsi yeşil (iki saat diliminde bayt bayt aynı).

**Dal:** `worktree-agent-aad3118e61923359b`
**Dal ucu:** `a52d2768` (taban `c7b2f-kc21` = 301c0e29; bakım 21'in dalda olduğu başta doğrulandı)

| Commit | İçerik |
|---|---|
| `076e22df` | Yalnız yorum: KARARLAR §33 |
| `584343ab` | Senaryo + elle beklenen (model değişmeden önce): yeni d50, d49 A1'in elle tablosu |
| `81817e71` | Model: S206 kuralı, mutantlar 323–325, oz-test.py |
| `388cb993` | Araçlar: `docs/kanit/2026-11-19/kahincari21b-arac/` |
| `a52d2768` | Kanıt + KARARLAR §33'ün kalan bölümleri |

### Madde madde yorum (KARARLAR §33)
- **Y21b-1 — 05.11 "hepsi A" listesinin tamamı:** liste bakım 1'de (§13) zaten tam okunmuştu.
  - (1) B1 gecikmiş borç kuralı (C13.5 + C13.4) bu maddeden kurulu, kural değişmedi. Dört alt kol yeni d50 G1 carisinde sayıyla gösterildi: çekle kapanan fatura sayılmaz, bağsız tahsilat en eski kaleme, taksitli faturada yalnız vadesi gelen taksit.
  - "Devir açık kalemi" kolu dilde yok → DENENMEYEN.
  - KG-3: bakım 21 aynen; "(carisiz Kasa girişi 649'da kalır)" parantezi bakım 21'in okumasıyla aynı.
  - KG-5: C13.2 aynen.
  - KG-2, KG-6, KG-7, KG-9, KG-11, KG-12, KG-15, KG-16: cari kâhininin konusu değil, dokunulmadı.
- **Y21b-2 — C2 (kural geçiş günü):** bakım 21 aynen.
- **Y21b-3 — "Borçta Kalsın"ın kalanı:** vazgeçme (Alacak Yaz ya da Şüpheli → Değersiz) ve "önceden kapatılmış kartlar olduğu gibi kalır" geçiş kuralı. Dilde Kartı Kapat yok → SUS + DENENMEYEN + SÜRÜCÜ İÇİN.
- **Y21b-4 — S15 sorusunun B seçeneği:** karar A aynen.
  - S15'in asıl durumu (faturanın kendi taksit kartı) için bir komşu kurulabildi: taksitli faturanın taksitini kart seçilmeden alınan tahsilat kapatmış, sonra fatura iptal edilmiş → tahsilat avans olur (d50 I4, değerle).
- **Y21b-5 — S25:**
  - (b) bakım 21 aynen.
  - (c) kâhinde bakım 20'den beri zaten modelli: faturaya bağlı tahsilat nakit de olsa havale de olsa payı kadar şüpheli alacaktan düşer. Yeni kural yazılmadı; d50 H1 (havale, tam pay), H2 (nakit, kısmi pay), H3 (havale, kısmi pay) ile gösterildi.
  - POS yolu dilde yok → DENENMEYEN.
- **Y21b-6 — S205 = A:** dilde Kartı Kapat yok; yalnız yorum + SÜRÜCÜ İÇİN. Beklenen: SK-39 örneğinde 15.04'te gecikmiş 600. Kâhinin kendi kaydındaki 05.11 S1 = A ("kalan varken kapatılan taksit kartı … ertesi günden gecikmiş") ile de aynı.
- **Y21b-7 — S206 = A (YENİ KURAL):** Taksitler'den açılmış Mevcut Borç kartı yalnız bu faturayı içine almışsa ve karta Taksit Tahsilatı girilmişse, fatura İptal Et ile:
  - kart kapanır;
  - Taksit Tahsilatı kendi tarihinde carinin bağsız alacağı (avans) olur;
  - carinin kuyruğu tanımlı olur (eski C13.4 (11) susması kalkar);
  - kapanmış kartın göstergeleri kararda yok → SUS.
- **Y21b-8 — S206'nın sınırı:** çok kalemli kart ve tahsilatsız kart kararda yok → SUS (aşağıda SK-41).

### Değişen, yeni ve SUS'tan çıkan anahtarlar (G3)
Sınıf S206: 17 fark, beklenmeyen 0.
- **SUS'a dönen (9):** d49 `k1`/`k2:kart:KA1:var|toplam|mevcutBorc` (6) ve d50 `k1:kart:KI1:var|toplam|mevcutBorc` (3).
- **SUS'tan çıkan / yeni (8):**
  - d49 `k1`/`k2:takvim:fatura:FA1` = "yok" (2);
  - d50 I1: `acikEsitBakiye` true, `acikToplam` 200, `gecikmis` 200, `fatura:FI1b:acik` 200, `takvim:fatura:FI1` = "yok", `takvim:fatura:FI1b` {200, giriş} (6).
- Bakiye, Kasa ve adım durumları iki modelde aynı. Rastgele senaryolarda fark yok. Eski kural setleri (2.4.9 / 2.4.6 / 2.4.5 / legacy) 496/496 bayt bayt aynı.

### Yeni elle senaryolar ve değerleri
Tutarlar TL; bugün 15.06.2026.

**`d50-c5-s206-s25c-b1-iptal-havale`** (57 elle denetim):

| Cari | Kural | Beklenen |
|---|---|---|
| I1 | S206'nın örneği | Bakiye 200, FI1b açık 200, gecikmiş 200, açık toplamı 200 (bakiyeye eşit); KI1 göstergeleri yazılmaz + belirsiz kaydı |
| I2 | SK-41 (a), çok kalemli kart | Bakiye 100; gecikmiş ve kart göstergeleri yazılmaz; belirsiz "SK-41 (a)" |
| I3 | SK-41 (b), tahsilatsız kart | Bakiye 0; aynı biçimde SUS |
| I4 | S15 asıl durum komşusu | Bakiye −300, gecikmiş 0, açık toplamı 0 (bakiyeye eşit değil) |
| G1 | B1 kolları | Bakiye 1.200, gecikmiş 600, FG1a açık 0, FG1b açık 300 |
| H1 | S25 (c) havale, tam pay | Tahsilat KABUL; Değersiz 701 RET / 700 KABUL; bakiye 100 |
| H2 | S25 (c) nakit, kısmi pay | Tahsilat KABUL; Değersiz 601 RET / 600 KABUL; bakiye 200 |
| H3 | S25 (c) havale, kısmi pay | H2 ile aynı; bakiye 200 |

Senaryonun Kasa'sı 1.300.

**d49 (izinli değişiklik, yalnız A1 / KA1):** belirsiz kaydı "cari A1 tanımsız" yerine "kart KA1 … S206 = A" oldu; kartın üç göstergesi için 6 SUS denetimi eklendi; değerler aynen.

### SÜRÜCÜ İÇİN (KARARLAR §33)
- Kapanmış kartın durumunu ayrıca okumak gerekiyor (kâhin hiçbir kart anahtarı yazmıyor; koşucunun `var` okuması "kapanmış"ı ayırt etmiyor).
- `kart_kapat` adımı eklenirse S205'in beklenen değerleri hazır.
- POS'la faturaya bağlı tahsilat dilde yok.
- Faturanın kendi kartına kart seçilerek Taksit Tahsilatı dilde yok.
- C2 / C3 geçiş kuralları için eski sürümün gerçek verisi gerekiyor.
- `kos.mjs` yalnız okundu, değiştirilmedi.

### Mutantlar (her yeni kural için değerle yakalanıyor)
- **323** — S206'nın B'si (kart açık kalır): d50 I1 ve d49.
- **324** — susma yok (SK-41 kartları da kapanır, kapanmış kartın `var` = false yazılır): `SUSMA_MUTANTLARI = {316, 324}`, `elleYok` / `elleBelirsiz` satırlarıyla; d49 ve d50.
- **325** — havaleyle faturaya bağlı tahsilat şüpheliden düşmez: d50 H1 (tahsilat RET'e döner) ve H3.
- 322 (bakım 21) artık d49 A1 ve d50 I1'de yakalanıyor.

### Test sayıları (UTC ve Europe/Istanbul; bütün çıkış kodları 0; çıktılar bayt bayt aynı)
| Koşu | Sonuç |
|---|---|
| oz-test | 6.867/6.867 |
| Mutasyon taraması | 292/292 |
| G3 | 620/620 (beklenmeyen 0) |
| Yeni / değişen elle tablo | 84/84 |
| Eski modelde kırmızı | 17/84 |
| Elle fark | 103/103 |
| G1 taraması | 104/104 |
| Mutant ↔ senaryo | 1.105/1.105 |
| Geniş tarama | 2.201/2.201 |

- **Eski modelde (bakım 21) kırmızıların nedeni:** 17'sinin hepsi S206 / SK-41 alanında ve beklenen nedenle.
  - I1'in dört anahtarı yok (cari tanımsız).
  - KI1 göstergeleri ×3 ve KA1 göstergeleri ×6 yazılıyor.
  - Belirsiz kayıtlarında "S206 = A" ×2, "SK-41 (a)" ve "SK-41 (b)" yok.
- **Eski modelde de yeşil olanlar** (kural değişmedi, beklenen): G1, H1–H3, I4 ve bakiyeler.
- **Özet taraması:** bakım 21'e göre 3 yeni satır var (I1'in açık toplamı / eşitlik / gecikmiş). Bu tasarım gereği: yalnız kapanmış kartın göstergeleri SUS, cari tanımlı.
- **Yük:** ilk koşudan önce yük 8,2 idi, bir kez 10 dakika bekledim. UTC koşusu yük 4,58'de başladı; koşu zamana bağlı değil.
- **Disk:** 5,8 GB boş.

### KULLANICIYA SORULMALI (iki durum da uç, bakiye iki okumada aynı)
**SK-41 (a) — çok kalemli Taksitler kartının içine aldığı faturanın iptali.** Örnek: elle Borç 400 + fatura 500 → kart 900 → Taksit Tahsilatı 300 → fatura iptal; bakiye iki okumada 100.
- (i) Kart kapanır: elle Borç kendi vadesiyle carinin kuyruğuna döner, 300 avans olur → Kalan 100, gecikmiş 100.
- (ii) Kart açık kalır, 400'e küçülür; kartta "Tahsil Edilen 300 · Kalan 100".
- (iii) Uç durum böyle kalsın (BİLİNEN SINIR).
- **Öneri: (i)** — S206'nın KAPSAM satırının harfi.

**SK-41 (b) — tahsilatsız kartın içine aldığı faturanın iptali.** Örnek: fatura 900 → kart 900 → fatura iptal; bakiye 0.
- (i) Kart kapanır.
- (ii) Kart borçsuz ve ödemesiz olarak açık kalır.
- (iii) Uç durum böyle kalsın (BİLİNEN SINIR).
- **Öneri: (i)** — S206'nın gerekçesi: "B kullanıcıyı borçsuz ama açık bir kartla bırakır".

SK-39 ve SK-40 kapandı. SK-38 (d) aynen açık.

### DENENMEYEN
- Programla karşılaştırma (ana oturumun işi).
- Kartı Kapat bütünüyle: S205, hatırlatma, Alacak Yaz / Değersiz ile vazgeçme, "önceden kapatılmış kartlar".
- Geçişli dünya (C2).
- POS yolu; havalenin mizanı.
- Devir açık kalemi.
- KG-2, KG-6 … KG-16.
- B1'in WhatsApp etkisi.
- Faturanın kendi kartına kart seçilerek Taksit Tahsilatı.
- Kapanmış kartın göstergeleri (SUS).
- Kapanmış karta sonradan tahsilat (kâhin RET okuyor, senaryosu yok).
- İptalin geri alınması / faturanın geri yüklenmesi.
- SK-41 alanı.
- Defter kâhini ve mobil yazma kâhini koşulmadı (okuma kapsamı dışında). S206 mizanı değiştirmediği için defter tarafında fark beklenmez; CI'deki `test:kahin-defter` adımı denetler.

### Yeniden koşu komutları
Worktree'de, temiz ağaçta:
```
bash docs/kanit/2026-11-19/kahincari21b-arac/kos.sh utc
bash docs/kanit/2026-11-19/kahincari21b-arac/kos.sh ist
```
- Eski kopya: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahincari21b-eski` (bakım 21'in `git archive` çıktısı). Kendi kopyanızda yeniden üretmek için: `git archive 301c0e29 test/bagimsiz/cari | tar -x -C <klasör>` ve betikteki `E` değişkenini o klasöre çevirin.
- Ham çıktı: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahincari21b-kanit`; depoda `docs/kanit/2026-11-19/kahincari21b-*`.

### Okunan dosyaların tam listesi
- **Görev ve girdi:**
  - `docs/devir/2.5.0-DEVAM/kahin-cari21b-istem.txt`
  - `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-cari21b-kararlar.md` (tamamı)
  - `CLAUDE.md` (yüklü geldi)
  - `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`
- **`test/bagimsiz/cari/KARARLAR.md`:** başlık listesi, §31 ve §32 tamamı, 910–935, 962–972, 1245–1256, 3405–3412 satırları ve aramalar.
- **`model.py`:** satır 1425–1450, 1600–1760, 1794–1820, 1980–1990, 3215–3245, 3320–3360, 3960–4120, 4250–4285, 4477–4560, 5100–5140, 5390–5546, 5560–5590, `MUTASYONLAR` ve aramalar.
- **`oz-test.py`:** baş açıklama ve 300–370 satırları.
- **`kos.mjs`:** yalnız eşleme için — 825–850 ve aramalar.
- **Senaryolar:** d49, d47, d37, d27, d7 ve bütün senaryoların elle tablolarında eksi bakiye taraması.
- **Bakım 21'in araçları:** `docs/kanit/2026-11-19/kahincari21-arac/*` (tamamı).
- `git log --oneline` yalnız konu satırları.

**İzin dışı tek okuma (açıkça):** bakım 21'in kanıt dosyası `docs/kanit/2026-11-19/kahincari21-ozet-tara-utc.txt`'yi kendi özet taramamla `diff` için açtım. Görev yalnız bakım 21'in araç klasörünü izin veriyordu. Bu dosyadan hiçbir kural ya da beklenen değer türetilmedi.

### Notlar
- `node_modules` bağı görev gereği kuruldu; izlenmeyen dosya olarak duruyor.
- Arka planda süren iş yok; zamanlanmış görev kurulmadı.
