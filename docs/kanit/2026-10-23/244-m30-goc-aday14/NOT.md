# 2.4.4 madde 30 (yargıç Y3) — göç karşılaştırması aday 14 (9b0f520) üzerinde, son tam takım

Yöntem, araçlar, "Nasıl bozulur?" (13–25) ve veri: `docs/kanit/2026-10-23/244-m30-goc-aday9/NOT.md`. Veri aynı: v2.4.3 gerçek kodu (163dd5d) ile üretilen taban
(tohum 7, buyuk; 2 şirket; 001: 3.211 cari, 1.178 fatura, 10.240 tablo satırı; 002: 926 / 620 / 1.780). Ölçü aday 9 ve aday 13 ile aynı taban üzerinde, aynı sabit an
(23.10.2026 17:00). Araç kodu is/goc9 587a4a4 (aday 14'ün içinde); ürün kodu aday 14. Kâhin kuralları karar metninden (CLAUDE.md "31e DAR KONTROL", "31e KONTROL TURU 2",
"2.4.4 kararları — son aday turu"); 2.4.4 kodundan türetilmedi (ders 5).

## Sonuç (aday 14; bekleme koşulu yok, ağır adımlar flock altında; disk 18 GB boş)
| Kayıt | Hüküm |
|---|---|
| olcu-v243-taban | GEÇTİ 2/2 |
| goc-v243-244-buyuk | GEÇTİ 2/2 (şema 30 → 32, göç öncesi yedek, integrity ok) |
| fark-v243-244-buyuk | GEÇTİ 100/100 — EŞİT 57 · BELGELİ 43 · BULGU 0 |
| tatbikat-buyuk | GEÇTİ 46/46 (C9 dahil — 625e9eb araç düzeltmesiyle; C10 30b; C2b; C11 E6; **C11k G1**) |
| donus-buyuk | GEÇTİ 6/6 |
| kesinti-buyuk | GEÇTİ 79/79 (v32 içi dahil; N1 mergeFloor'lu v32) |
| zincir-v2026-fikstur | GEÇTİ 185/185 (177 olgu: EŞİT 148 · BELGELİ 29 · BULGU 0) |
| zincir-v230-uretilen | GEÇTİ 104/104 (100 olgu: EŞİT 61 · BELGELİ 39 · BULGU 0) |

C11k (G1): 001'de kapanmış dönem (23.04.2026'ya kadar) tarihli silinmiş belge FIS2026000000215 (14.04.2026) Silinenler'den geri YÜKLENMEDİ (409), Silinenler'de kaldı;
Mutabakat Testi'nde yeni sapma yok; ardından Kasa girişi 200. 002'de kilit yok (denetim boş geçti). Aday 9'da aynı adımın karşılığı: geri yükleme 200 + period-lock sapması +
2.4.4'te Kasa 500 (`yeniden-uret-g1`, aday 9 kanıtı) — kırmızı → yeşil.

## Aday 9 → aday 13 → aday 14 farkı (aynı taban, aynı an)
- Göç farkı sınıflaması üç adayda AYNI: 100 olgu, EŞİT 57, BELGELİ 43, BULGU 0; her BELGELİ satırın ayrıntısı (Tablodaki Kişiler ayrıştırması 001: 13.689.000,00 TL, 002:
  1.927.500,00; Vade Takip / Takvim 30a; MM6; MM8; K-v32 + E6; K-UX18; K-23) aday 9 ile kuruşu kuruşuna aynı. Tek fark Nakit Akışı / Tablodaki Kişiler toplamlarının sayı
  gösterimi (aday 14 31cb7a3 kuruşta toplama: 374.331,05999999994 → 374.331,06) — kuruş değeri aynı.
- Aday 13 → 14: olgu bölümlerinden yalnız tablo raporu toplamları değişti (yukarıdaki gösterim); Tablodaki Kişiler grup sayısı (001: 9.638, 002: 1.622), her satırın grup
  adı ve kuruş değeri (001: 9.640, 002: 1.630 satır) aynı → aday 13'ün gruplama gerilemesi bu veride görünmedi (veride "ad tekrarı yüksek sekmede kişi sütunu bulunamaması"
  durumu oluşmamış; dosya no adıyla grup 0) — gerileme bu takımın dişinde değil, düzeltmesi cari kâhininde (9b0f520, 1967/1967).
- 31e kararları (T4 aynı sekme ayrı, T1 Kalan sütunu yoksa toplam − ödenen, A1 farklı sekme ayrı + not, Y1 Kasa yetkisi, N1 silinen fişin tarihi) bu veride sayı değiştirmedi:
  borç sekmelerinde aynı Dosya No'lu satır yok, Kalan sütunsuz Toplam + Ödenen tablosu yok, iki sekmede aynı Dosya No yalnız söz sekmesinde (söz tutarı borç değil);
  ölçüm yöneticiyle. Tablodaki Kişiler kâhini satırları sekmeden bağımsız topladığı için A1 ile uyumlu (aday 9'daki "bir kez" kuralıyla da sayı aynıydı).
- Aday 13 kısmi kanıtı (olcu 2/2, goc 2/2, fark 100/100) `244-m30-goc-aday13/`; tatbikat adımı kapsayıcı yeniden başlarken kesildi (kayıt yok, yarım veri kopyası silindi).

## DENENEN / DENENMEYEN / BİLİNEN SINIRLAR (aday 9 notuna ek)
DENENEN: aday 14'te bütün takım (yukarıda); ders 5, 6, 7 (C11k aday 9'da kırmızı → aday 14'te yeşil), 15, 17, 24, 36.
DENENMEYEN: T1 / T4 / A1 borç durumları ve Y1 (veride yok — kâhinler ve dar kontrol başka veride denedi); MM3, U1, E1/E4, ekran, gerçek Windows; tek tohum.
BİLİNEN SINIRLAR: aday 9 notundaki (1)–(4) aynen.
Ham olgular not defterinde: `v2.4.3-taban.json` sha256 a8b30446393d1049b769c40cb0960e32aeda38a11a934e7be919a55a8f0174ec, `guncel-goc.json` (aday 14) sha256 d250c9deb0156ffe6b832b6df6eb84a0e5d028445d128eaed3849cecd4dc423f.
