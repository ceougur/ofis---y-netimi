# 2.4.5 G4 / G8 — v2.4.4 → 2.4.5 göçü (v33) gerçek kodla, zincirleme göç, yedek tatbikatı, takvim hız ölçümü

Aday: `aday245-1` = 6e58c0a (dal is/goc-245). Eski kod: git etiketleri v2.4.4 (= master 5187561, ürün kodu d2cef7c ile aynı), v2.4.3, v2.3.0 … v2.0.26 fikstürü;
ayrı kopyada (`test/guvenilirlik/surumler.mjs` önbelleği, TMPDIR = not defteri `245-goc-245/tmp`; ders 23, 25). Veri o sürümün GERÇEK koduyla, kendi API'sinden
(`test/guvenilirlik/m30-uretici.mjs`, `tools/goc245-hiz.mjs veri`); sahte EDM, sahte saat (ders 13), `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30).
Ürün kodu DEĞİŞMEDİ; yalnız araçlar (aşağıda).

## Nasıl bozulur? (işe başlamadan yazıldı; denetimler bu listeden)
1. v33 eski satırlara Vade / Beklenen yazar ya da kolon eklerken para satırını değiştirir → bakiye, mizan, Kasa, defter kayar.
2. Kalan (FIFO) cari kartında eski veride saçma değer verir (tutardan büyük, eksi) ya da kartın öbür alanlarını değiştirir.
3. Uyarı kapısı (madde 4) tablo kalemiyle birlikte taksit / fatura / çek kalemini de düşürür, ya da tablonun son tarihlerini siler; projeksiyon tablodan başka kalem kaybeder.
4. Tablo Raporları'nda (madde 5) etiketle birlikte rakam değişir; Kasa sütunu kalkarken beklenen/gerçekleşen kayar.
5. Yedek → çalış → geri yükle: yeni kolonlar yedekte yok ya da geri yüklemede düşer; Tabela Adı ayarı yedek anına dönmez; 001'in geri yüklenmesi 002'yi değiştirir.
6. Silinenler'den geri yüklenen vadeli borç Vade / Beklenen'i kaybeder (çöp kutusu yükünde yok) → takvimden sessizce düşer.
7. Aynı dosyayı iki sürüm açar: 2.4.5'ten sonra 2.4.4 açılır (geri dönüş) → v33 kolonları 2.4.4'ü bozar ya da 2.4.4 şemayı geri alır.
8. Eski sürümlerden (2.0.26 / 2.3.0 / 2.4.3) zincirleme göç: ara sürümle adım adım güncellenen ≠ doğrudan 2.4.5'e güncellenen.
9. Büyük veride takvim (GET /api/workspace/dues): carinin vadeli kalemleri her istekte bütün carilerin defterini yeniden kapatır (allEntryStates) → soğuk / yazımdan sonraki
   ilk yanıt 2.4.4'e göre çok yavaşlar.

## Araç güncellemesi (mantık değişmedi; yalnız şema beklentisi + v33 alanları + 2.4.5 kural takımı)
- `test/guvenilirlik/m30-olgular.mjs`: `SCHEMA = 33` (tek kaynak); her carinin kartı (hareketler yeni alanlar hariç, defter satırları, toplamlar) + yeni alanların
  sayımı (Vade / Beklenen dolu, Kalan 0 ≤ Kalan ≤ tutar); dosyadan `account_entries` kolonları ve due_date / expected_date dolu satır sayısı; Anlık Durum Nakit Akış
  Projeksiyonu (varsayılan + `?table=0`) ve Vade Takip (varsayılan + kaynak başına `?sources=`).
- `tools/m30-goc.mjs`, `tools/m30-goc-kesinti-adim.mjs`, `test/guvenilirlik/m30-tatbikat.mjs`: şema 32 → `SCHEMA`; göç öncesi yedek adı `pre-migration-v${SCHEMA}`;
  `donus --surum`; ölçümde 2.4.4 ve güncel kod üretimdeki gibi e-SMM açık, güncel kodda `legacy*` anahtarları KAPALI (ürün davranışı); `fark` önce = v2.4.4 ise profil
  `244-245`; yeni adım `tatbikat-245`.
- `test/guvenilirlik/m30-fark.mjs` profil `244-245` (kurallar dosya başında, karar metninden — K4.1 / K5 / K6): bkz. aşağı.
- Yeni: `test/guvenilirlik/goc245-tatbikat.mjs` (yedek tatbikatı), `test/guvenilirlik/m30-fark-mutasyon-245.mjs` (sınıflayıcının dişi), `tools/goc245-hiz.mjs` (G8 ölçüm).
- (kesinti adımı şema beklentisi güncellendi ama bu turda KOŞULMADI — DENENMEYEN.)

## Yeniden koşma (tohum 7 / 11 / 13 / 5; TMPDIR = not defteri; ağır adımlar ayrı, ölçüm `flock …/scratchpad/kos.lock` altında)
```
K="node tools/kanit.mjs kos"; N="node --disable-warning=ExperimentalWarning"; R=<kök>
$K 245-goc/uret-v244-buyuk     -- $N tools/m30-goc.mjs uret --kok $R --surum v2.4.4 --hacim buyuk --tohum 7
$K 245-goc/olcu-v244-taban     -- $N tools/m30-goc.mjs olcu --kok $R --surum v2.4.4 --veri taban --ad v2.4.4-taban
$K 245-goc/goc-v244-245-buyuk  -- $N tools/m30-goc.mjs goc --kok $R
$K 245-goc/fark-v244-245-buyuk -- $N tools/m30-goc.mjs fark --kok $R --once v2.4.4-taban --sonra guncel-goc
$K 245-goc/fark-mutasyon       -- $N test/guvenilirlik/m30-fark-mutasyon-245.mjs --kok $R
$K 245-goc/tatbikat-245        -- $N tools/m30-goc.mjs tatbikat-245 --kok $R
$K 245-goc/donus-v244          -- $N tools/m30-goc.mjs donus --kok $R --surum v2.4.4
$K 245-goc/uret-v230-kucuk     -- $N tools/m30-goc.mjs uret --kok $R --surum v2.3.0 --hedef zb-taban --hacim kucuk --tohum 11
$K 245-goc/zincir-v230-uretilen -- $N tools/m30-goc.mjs zincir --kok $R --ad zb --kaynak zb-taban --yol v2.4.0,v2.4.1,v2.4.2,v2.4.3,v2.4.4
$K 245-goc/uret-v243-kucuk     -- $N tools/m30-goc.mjs uret --kok $R --surum v2.4.3 --hedef zc-taban --hacim kucuk --tohum 13
$K 245-goc/zincir-v243-uretilen -- $N tools/m30-goc.mjs zincir --kok $R --ad zc --kaynak zc-taban --yol v2.4.4
$K 245-goc/zincir-v2026-fikstur -- $N tools/m30-goc.mjs zincir --kok $R --ad za --kaynak fikstur:surum-2.0.26-turler --yol v2.1.0,v2.2.0,v2.3.0,v2.4.3,v2.4.4
$K 245-goc/hiz-veri-v244       -- $N tools/goc245-hiz.mjs veri --kok <hız kökü> --tohum 5
$K 245-goc/hiz-vade-245        -- $N tools/goc245-hiz.mjs vade --kok <hız kökü>
flock …/kos.lock $K 245-goc/hiz-dues-olcum -- $N tools/goc245-hiz.mjs olc --kok <hız kökü> --tekrar 3
```
Önce ve sonra AYNI sabit sahte saatte (üretimin son günü 17:00) okundu. Ham olgular (2 × ~33 MB JSON) ve veri kopyaları not defterindeydi, silindi; depoda fark /
denetim / ölçüm çıktıları (`cikti/`).

## Veri (v2.4.4 GERÇEK kodu 5187561, API'den; 6.155 istek: 6.153 × 200, 2 × 409 beklenen silme/geri yükleme reddi; EDM gönderim 487, ihlal 0; 180 sn)
24.09.2025 → 24.10.2026 (13 ay). 001 Merkez Ticaret: 3.212 cari (Σ bakiye 10.895.256,56 TL), 1.164 fatura, 364 çek/senet, 231 taksit kartı, Kasa 2.060 satır, tablo
10.240 satır / 5 sekme, dönem kilidi 24.04.2026. 002 Yıldız Mali Müşavirlik: 925 cari, 607 fatura, 183 çek/senet, 82 kart, Kasa 881, tablo 1.780 satır.
(Kayıt tahsilatı 191, Tablodan Aktar 143 kart, e-Arşiv 438, e-Fatura 115, bırakılan 98, iptal 17, KDV Mahsup 26, 10 yedek.)

## Göç (2.4.5 adayı aynı klasörde; `goc-v244-245-buyuk`): iki şirkette şema 32 → 33, bütünlük ok, şirket başına bir `…-pre-migration-v33.sqlite`;
`account_entries` + due_date, expected_date, dolu satır 0. 001 açılışı (göç dahil) 675 ms, 002 ilk erişim 423 ms.

## Önce (v2.4.4) / sonra (2.4.5) — 98 olgu: EŞİT 74 · BEKLENEN (BELGELİ) 24 · BULGU 0 (`cikti/fark-v2.4.4-taban-guncel-goc.json`)
EŞİT (iki şirkette, tek tek): her carinin bakiyesi ve KARTI (3.212 + 925 kart: hareketler, defter satırları, toplamlar — yeni alanlar hariç), mizanın her hesabı, defter
mutabakatı, Mutabakat Testi, dönem kilidi, Kasa, banka, çek/senet, taksit kartları ve toplamları, stok, KDV mahsup, faturaların her alanı ve ödeme durumu (açıklar), e-Belge
kartları, sıradaki numaralar, Gönderilecekler, Silinenler, ANLIK DURUM, rapor merkezinin bütün raporları, yevmiye (bütün satırlar), kullanıcı yetkileri, roller.
BEKLENEN (her biri kuralıyla denetlendi; kural karar metninden):
| Olgu | 001 | 002 | Kural |
|---|---|---|---|
| Tahsilat Takvimi / zil | 5.082 → 1.764 kalem: tablo 3.318 kalem (47.076.900 TL) yok; taksit 1.050, çek 4, fatura 710 BİREBİR; son tarih 0/0 | 1.413 → 789: tablo 624 (8.021.387,67 TL) yok | K4.1 |
| Nakit Akış Projeksiyonu | 1.405 → 62 satır; giriş 20.238.385,54 → 277.485,54 TL = 2.4.4'ün tablosuz projeksiyonu (?table=0) birebir | 288 → 27; 3.530.951,26 → 123.451,26 | K4.1 (toplam düşer) |
| Anlık Durum Vade Takip | 5.128 → 1.810 kalem; tablo + söz kaynağı yok (3.318 kalem, 47.076.900 TL), öbür kaynaklar birebir; cari vadesi kaynağı boş | 624 kalem | K4.1 / K6.3 |
| Tablo Raporları | Tablodaki Kişiler / Vadeler / Nakit Akışı rakamları birebir; kolon adları "… (Muhasebe Kaydı Değil)", "Tahsil Edilen"; Nakit Akışı'nda Kasa sütunları yok | aynı | K5 |
| Cari hareketlerinin yeni alanları | Vade / Beklenen dolu 0; Kalan 798 satırda, hepsi 0 ≤ Kalan ≤ tutar | 210 satır | K6.2 / K6.4 |
| Veri dosyası | şema 33, yeni tablo yok, +2 kolon (boş), satır sayıları aynı | aynı | K6.4 |
Sınıflayıcının dişi (`fark-mutasyon`, 20/20): hatasız ölçüde BULGU 0; 19 enjekte hatanın (bakiye 1 kuruş, cari kartı, eski satıra Vade, Kalan > tutar, dosyada due_date,
takvimde tablo kalemi kalması / fatura kalemi düşmesi / taksit tutarı, projeksiyon satırı / toplamı, Vade Takip kaynağı / toplamı, Tablodaki Kişiler borcu, belgesiz kolon
adı, Nakit Akışı Beklenen, beklenenli dönem satırı düşmesi, mizan, Kasa, fatura açığı) HEPSİ BULGU.
NOT (ders 6, 40 — sınıflama netleştirmesi, ana oturumun onayına): ilk zincir koşusunda (v2.3.0 verisi) "Tablodaki Nakit Akışı 2025-09 satırı yok" BULGU çıktı; yeniden
üretildi: 2.4.4'te o ay yalnız Kasa hareketi taşıyordu (Beklenen 0, Gerçekleşen 0); Kasa sütunları kalkınca (madde 5) satırın gösterecek bir şeyi kalmıyor. Fikstürde
(2.0.26) 004 / 007 şirketlerinde bütün dönemler böyle → rapor boş, TOPLAM yok (kalıcı karar "boş raporda TOPLAM yok"). Sınıflayıcı yalnız Beklenen = Gerçekleşen = 0
satırları iki tarafta da süzer ve sayısını yazar; beklenenli satırın düşmesi BULGU kalır (mutasyon 20).

## Zincirleme göç (yol bağımsızlığı: adım adım güncellenen = doğrudan 2.4.5)
| Kaynak | Yol | Olgu | Sonuç |
|---|---|---|---|
| v2.3.0 GERÇEK kodu, küçük, tohum 11 (2.657 istek) | v2.4.0 → 2.4.1 → 2.4.2 → 2.4.3 → 2.4.4 → güncel | 102 | 98 olgu BULGU 0 + yol bağımsızlığı ✓ ×2 + şema 33 ×2 |
| v2.4.3 GERÇEK kodu, küçük, tohum 13 (3.130 istek) | v2.4.4 → güncel | 102 | BULGU 0 + ✓ |
| 2.0.26 fikstürü (4 şirket) | v2.1.0 → 2.2.0 → 2.3.0 → 2.4.3 → 2.4.4 → güncel | 201 | 193 olgu BULGU 0 + ✓ ×4 |

## Geri dönüş (`donus-v244`, 6/6): göçten sonra v2.4.4 açılınca gösterdiği = göçten önce gösterdiği (iki şirket), şemayı geri almaz (33 kalır); sonra yeniden
2.4.5 = göç ölçüsü.

## Yedek tatbikatı (`tatbikat-245`, 19/19; programın kendi Yedekle / Geri Yükle / Silinenler uçları; ürün ayarları)
Beklenen değerler S1 (FIFO) + K6 metninden elle: P carisi açılış 4.000 (Vade g−20, Beklenen g−10) + D1 5.000 (g−15, Vade g−5) + D2 3.000 (g−2, Vade g+5, Beklenen g+2),
tahsilat 6.000 → Kalan 0 / 3.000 / 3.000, bakiye 6.000; takvim D1 gecikmiş kısmi 3.000, D2 "(Ödeme Sözü)" g+2 3.000, açılış kalem değil — İKİ şirkette ✓. Tabela Adı
(Yalnız … / Tabela Adı ve Firma Bilgileri) kaydedildi, seri / sıradaki numaralar değişmedi ✓. Yedek → ara çalışma (tahsilat 1.000, D2 Vade g+6 / Beklenen boş, yeni
vadeli borç 1.500, Tabela değişti; hepsi yazıldı ✓) → geri yükle (001 yeniden açılışta) → olgular + cari kartları + Vade / Beklenen / Kalan + takvim + Tabela Adı yedek
anıyla AYNI ✓ (002 ve 001); öbür şirket değişmedi ✓ ×2. Yeniden çalış: D4 2.000 (Vade g+3) + tahsilat 2.500 → Kalan D1 500 / D2 3.000 / D4 2.000, bakiye 5.500, takvim
üç kalem, Mutabakat Testi'nde yeni sapma yok, mizan dengede ✓ ×2. Silinenler: D2 silindi (bakiye 2.500, takvimden çıktı) → geri yüklendi: Vade g+5, Beklenen g+2
KORUNDU, Kalan 3.000, takvimde yeniden "Ödeme Sözü" ✓ ×2.

## G8 — Takvim (GET /api/workspace/dues) hız ölçümü (`hiz-dues-olcum`, `cikti/hiz-olcum.json`; 3 tur, değişkenler tur içinde sırayla, ortanca; flock; load ~0,8–1,6)
Veri: v2.4.4 GERÇEK koduyla 18.100 istek (2.000 müşteri + 100 tedarikçi, 10.000 fatura: 4.844 vadeli açık, 1.777 kısmi peşin, 2.186 peşin, 1.193 alış; 4.000 elle Borç,
2.000 tahsilat; 12 ay) → 2.4.5 göçü → 1.997 Borç'a Vade (1.402) / Vade + Beklenen (595) (programın PUT ucu). Sunucu aynı süreçte, istemci HTTP (yerel).
| ms (ortanca) | A 2.4.4 (v2.4.4) | B 2.4.5 (vadeli) | C 2.4.5 (aynı veri, Vade boş) | B − A |
|---|---|---|---|---|
| Soğuk (açılıştan sonraki ilk istek) | 928 | 1.354 | 979 | +426 (+%46) |
| Sıcak (önbellekten, ×15) | 65 | 89 | 70 | +24 |
| "Değişmedi" (?since=, ×15) | 13 | 20 | 19 | +7 |
| Tahsilattan sonraki ilk yanıt (×8; en çok) | 909 (1.099) | 1.325 (1.436) | 928 (1.015) | +416 (+%46) |
| Tahsilattan sonra ikinci | 63 | 92 | 74 | +29 |
| Kalem / yanıt boyu | 7.205 / 2,7 MB | 8.846 (+1.641 cari) / 3,6 MB | 7.205 / 2,7 MB | |
Bütçe: 2.4.4'te takvim için yazılı ms bütçesi YOK (test/e2e/hiz-243-arka-plan yalnız istek sayısı / "değişmedi" yanıt boyu; docs/kanit/2026-10-17/hiz-fatura: yüksüz
55 ms sıcak, 2,8 MB). Sıcak ve "değişmedi" yolu bütçe düzeyinde; soğuk / yazımdan sonraki ilk yanıt +%46.
NEDEN (CPU profili, B, 1 tur: 9 yeniden hesaplamada `compute` 11.064 ms; `allEntryStates` 2.865 ms ≈ 318 ms / hesap, `openDueItems` 3.043, `allPaymentStates` 4.484,
`allLedgers` 4.180, `settleTables` 1.192; `cikti/hiz-profil-B-tur1.txt`): routes/invoices.mjs `allEntryStates` (2.4.5 madde 6) fatura kapamasının `allPaymentStates`'iyle
AYNI kuyruğu (settleTables + allLedgers + settleLedger) İKİNCİ KEZ kurar (önbellek anahtarları aynı, hesap ayrı). C − A ≈ +20–50 ms (kalemsiz yol + dueFingerprint).
Öneri (ürün kodu DEĞİŞTİRİLMEDİ): iki haritayı tek geçişte (allLedgers({ dated: true }) + bir settleLedger → invoices + entries) üretmek; beklenen kazanç ~300 ms / hesap.

## DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
- DENENEN: ders 2 (kanit kos, çıkış + sayı), 3 (her yanıt okundu; ara çalışma yazıldı mı denetlendi), 5 (beklenen = eski sürümün kendi gösterdiği + karar metninden
  elle sayılar), 6 (zincir BULGU'su yeniden üretildi, kök neden yazıldı), 7 (sınıflayıcı mutasyonu 20/20), 13 / 22 (sabit sahte saat, aynı gün), 15 (ölçüm flock, tek tek,
  taze kopya, değişkenler aynı turda), 17 (eski sürümlerin gerçek verisi, geri dönüş), 23 / 25 (eski kod ayrı kopya, benzersiz not defteri), 24 (df ≥ 7 GB), 30.
- DENENMEYEN: göç sırasında kesinti / disk dolu / kilitli dosya (`kesinti` adımı şema beklentisi güncellendi, KOŞULMADI); tablonun tutarsız tarih hatırlatmaları
  (son tarihler) üretilen veride yok (m30 tablolarında duruşma / sözleşme bitiş sütunu yok → deadlines 0/0; madde 4'ün "kalır" kuralı burada sınanmadı, kâhinde);
  2.4.4'ün e-SMM'li verisi (üretici 2.4.3 düzeninde, SMM kâğıt); 3+ şirketli üretilmiş veri (fikstürde 4 şirket); ölçüm ayrı süreçte / yükte ve arayüzden değil.
- BİLİNEN SINIR: ölçüm sunucusu ölçüm istemcisiyle aynı süreçte; makine paylaşımlı (başka ajanlar), mutlak ms ±%15 oynar — karşılaştırma aynı turdaki değişkenler arasında.
