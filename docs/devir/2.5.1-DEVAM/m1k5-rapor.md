# M1 KÜÇÜK TUR 5 — KDV Özeti: 'güncel değil' ay S4 birikimine bugünkü İndirilecek KDV'siyle (S-DKM1K-1 = A) — RAPOR (TASLAK — işler sürüyor)

Taban `t251-m1k4` (4850ae2a). PUSH YOK. Yalnız Rapor Merkezi'nin KDV Özeti görünümü; KDV Mahsup Fişi, ön izlemesi ve defter DEĞİŞMEDİ (taban = yeni BİREBİR, aşağıda).

## A. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce = taban → sonra; Raporlar → Tüm Raporlar → KDV Özeti (Beyanname Hazırlığı); ekran = PDF = Excel)
1. Kararın örneği AYNEN (Ocak alış KDV 1.000 fiş 0 / 0 / 1.000; Şubat satış 2.000 alış 500 fiş 1.000 / 500 / 0; Mart satış 1.000 alış 200 + 100 fiş 0 / 700 / 0; Nisan satış 500 fişsiz;
   sonra Şubat alış KDV +300, Mart'ın 200'lük alışı İptal Et): Ocak–Nisan Ödenecek 1.400 → **1.600** (= 391 3.500 − 191 1.900); Nisan 500 → **700**; Şubat 0 / 200 (bugünkü kayıtlar) ve
   Mart 700 (fişten) DEĞİŞMEDİ; "Mahsuptan Sonra Değişen Ay: Şubat 2026 (mahsup fişi güncel değil — …); Mart 2026 (bu ayın kayıtları fişten sonra değişti; …)" DEĞİŞMEDİ (Şubat notu durur).
   Nisan ön izlemesi 500 DEĞİŞMEDİ → Nisan raporu (700) ön izlemeden ayrılır (karar metni).
2. YAN ETKİ (iş 3 — ölçüldü): Nisan bu ön izlemeyle mahsup edilirse fiş 0 / 500 / 0 (taban ile aynı). Rapor Nisan 700 KALIR, YENİ not (ekranda okundu): "Zincirle Uyuşmayan Mahsup Fişi:
   Nisan 2026 fişi ödenecek KDV ₺500,00 yazmış, sırayla mahsupta ödenecek KDV ₺700,00 olmalıydı — İndirilecek KDV'deki azalma sırayla mahsupta daha önceki bir ayda düşülür (raporda
   sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)". Ocak–Nisan 1.600 = 391 − 191 (taban 1.400, not yok). Defter 360 = 1.700 (fişler
   500 + 700 + 500; taban aynı). Onarım (Nisan, Mart, Şubat geri al; sırayla yeniden): fişler Şubat 200 / Mart 900 / Nisan 500, rapor = fişler = 1.600, notlar kalkar, defter 360 = 1.600
   (taban da aynı). NOT METNİNİN NEDEN CÜMLESİ BU YÖNDE YANLIŞ — §BAŞ MİMAR KARARI GEREKİYOR.
3. Yıl dönümü (aynı örnek Kasım 2026 → Şubat 2027): Bu Yıl (2027) 1.200 → **1.400** (= 391 1.500 − 191 100); Şubat 2027 500 → **700**; Kasım–Şubat 1.400 → **1.600**; 2026 yılı 200 DEĞİŞMEDİ.
4. İki ardışık 'güncel değil' ay (Şubat İ +300, Mart İ +100), Nisan azalan ay (−200), Mayıs fişsiz: Ocak–Mayıs 2.100 → **2.300** (= 391 4.500 − 191 2.200); Mayıs 500 → **700**.
5. Devreden yönlü 'güncel değil' Şubat (devreden 500 → bugün 800) + Mart fişi 500 devredenle (zincirle uyuşmaz, not AYNEN eski kalıp) + Nisan azalan ay + Mayıs fişsiz: Ocak–Mayıs
   2.200 → **2.400** (= 391 4.500 − 191 2.100); Mayıs 500 → **700**.
6. DEĞİŞMEYENLER (tabanda da yeşil, sınamalı): yalnız İ artışı (azalma yok) — Nisan 500, 1.400 = 391 − 191; azalan ay ÖNCE, 'güncel değil' ay SONRA — Mart 700, Nisan 500, 1.700;
   kararların öbür örnekleri (S-DKM1-1, S-M1K-1, S-M1K2-1, S-M1K3-1 (a) / (b)) — mevcut 55 sınama yeşil (komşu koşusu); yalnız 391'i değişen 'güncel değil' ayda bugünkü İ = saklı İ.

## B. DEĞİŞEN DOSYALAR
- `server/routes/tax.mjs` (yalnız `vatView` zincir döngüsü + açıklama): `done.push({ month, inMinor: kept && settled.offsetState !== "stale" ? Number(offset.inMinor) : step.input })`
  (önce `kept ? …`). Dar kontrolün deneme yamasıyla AYNI satır. Kaynak yorumundaki "İ artışı S4 taşımasına girmez" savı düzeltildi (yanlıştı: saklı İ birikime girdiği için artış
  sonraki azalmayı götürüyordu); "S4 fişin saklı İ'siyle (… 'Güncel Değil' aylarında da)" cümlesi güncellendi. Yeni sorgu / döngü YOK. `report-center.mjs`, `preview`, `monthPosition`,
  `carriedBefore`, `listOf`, fiş yazımı, A kipi DEĞİŞMEDİ.
- YENİ `test/kdv-ozeti-s4-guncel-degil-251.test.mjs` (3 describe / 7 sınama, iki şirket), YENİ `test/kdv-ozeti-rastgele-251.test.mjs` (300 + 150 tohum), DEĞİŞEN
  `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (F adımı, dördüncü kurulum; 35 → 45 denetim; A–E AYNEN).
- Kanıt: `docs/kanit/2026-11-28/m1k5-betik/` (betikler), `m1k5-ham/` (ham çıktılar), `m1k5-ekran/` (görüntüler).

(Kalanı — tarama, testler, kabul, mutantlar — işler bittikçe.)
