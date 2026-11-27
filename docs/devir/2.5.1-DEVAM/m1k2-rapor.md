# M1 KÜÇÜK TUR 2 — KDV Özeti: karma ay (S-M1K-1 = A) — RAPOR

Taban `t251-m1k` (52fb473f, küçük turun dal ucu) → dal ucu: bu raporun son commit'i (`worktree-agent-a341390f4f549e487`). PUSH YOK. KDV Mahsup Fişi, ön izlemesi ve
defter DEĞİŞMEDİ (kabul B: taban = yeni BİREBİR) — yalnız Rapor Merkezi'nin KDV Özeti görünümü.
Ortam: ORTAM_SATIRI

## A. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce = taban t251-m1k → sonra; Raporlar → Tüm Raporlar → KDV Özeti (Beyanname Hazırlığı); ekran = PDF = Excel)
1. **Karma ay — kararın örneği AYNEN** (Ocak satış KDV 1.000, alış KDV 500 → Ocak fişi 500; sonra Ocak alışı İptal Et + Ocak'a KDV'si 100 olan satış; Şubat satış KDV 200 →
   Şubat fişi 700): Ocak ÖNCE 0 / **1.100** / 0 → SONRA 0 / **600** / 0 (İndirilecek KDV fişten 500, Hesaplanan KDV bugünkü 1.100). Ocak–Şubat ÖNCE **1.800** → SONRA **1.300**
   (= 391 1.300 − 191 0). Şubat 700 (değişmedi). Ay satırları Ocak 600 / Şubat 700.
2. **Not (Mahsuptan Sonra Değişen Ay)**: ÖNCE "Ocak 2026 (mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin)" → SONRA "Ocak 2026 (mahsup fişi güncel değil —
   Hesaplanan KDV bugünkü kayıtlardan, İndirilecek KDV kesilmiş mahsup fişinden alındı, azalma sonraki mahsupta düşülür; mahsubu geri alıp yeniden mahsup edin)". Karma ay
   tek notta yazılır ("güncel değil" ve "azalan ay" notlarında yinelenmez). YALNIZ karma ayda; öbür üç durumun notu değişmedi.
3. **Satış silinmesi + alış iptali (391 de azaldı)**: Ocak satış KDV 900 + 100, alış 500 → fiş 500; sonra 100'lük satış ve alış İptal Et; Şubat fişi 700. Ocak ÖNCE **900** → SONRA
   **400**; Ocak–Şubat ÖNCE **1.600** → SONRA **1.100** (= 391).
4. **Devreden yönde karma** (Mart alış KDV 600 + 400, satış 200 → Mart fişi devreden 800; sonra 400'lük alış İptal Et + Mart satış KDV 100; Nisan satış KDV 1.000 → Nisan fişi
   defterin 800'üyle 600): Mart ÖNCE 0 / 0 / **300** → SONRA 0 / 0 / **700** (300 − 1.000). Nisan ÖNCE 800 / **600** (fiş, zincirde) → SONRA **700 / 700** (zincir 700 devredenle) +
   YENİ not "Zincirle Uyuşmayan Mahsup Fişi: Nisan 2026 fişi 800,00 TL devredenle kesilmiş, sırayla mahsupta 700,00 TL olmalıydı (…)". Mart–Nisan ÖNCE **600** → SONRA **700**
   (= 391 1.300 − 191 600). Onarımda (Nisan ve Mart geri al, sırayla yeniden mahsup) fişler 300 devreden / 700 → toplam 700 = raporun söylediği; notlar kalkar.
5. **Yön dönmesi + yıl dönümü** (Aralık 2026 satış KDV 800 + 200, alış 500 → fiş ödenecek 500; Ocak 2027'de 800'lük satış ve alış İptal Et; Ocak 2027 satış KDV 200, mahsupsuz):
   Aralık ÖNCE ödenecek **200** → SONRA sonraki döneme devreden **300** (200 − 500); Ocak 2027 ÖNCE 0 / **700** → SONRA **300 / 400**; Aralık–Ocak ÖNCE **900** → SONRA **400**
   (= 391 400 − 191 0); Bu Yıl (2027) 300 / 400 / 0; 2026 yılı 0 / 0 / 300. Ocak 2027 fişi sonra ön izlemeyle (defterin 0 devredeniyle) kesilirse 700 → rapor 400 + "Zincirle
   Uyuşmayan" notu; onarımda fişler 200 / 200 (toplam 400).
6. **DEĞİŞMEYENLER**: yalnız İ azalması (S-DKM1-1 = A — sonuç fişten, "bu ayın kayıtları fişten sonra değişti" notu), yalnız 391 değişimi ve İ artışı (S-M1-3 = C — bugünkü
   kayıtlar, "güncel değil" notu, zincir fişin devredenini taşır), hiçbiri (fiş); KDV Mahsup Fişi penceresi, ön izleme, fiş satırları, defter; mahsupsuz ay zinciri; kopuk fiş
   (S4 emilim eşitliği) ve yön notu (S-M1-2); "Mahsup Edilmemiş Ay" 6 ay sınırı.

## B. DEĞİŞEN DOSYALAR
- `server/routes/tax.mjs` (yalnız `vatView`): `settle` — fiş zincirdeki ayda İ ARTMADI ve 391 DEĞİŞTİ ve İ AZALDI ise `offsetState: "mixed"`: outMinor = bugünkü 391, inMinor =
  fişin saklı İ'si, devreden = fişin (= zincirin) devredeni, sonuç bunlardan; yalnız 391 değişti (İ aynı) ya da İ arttı → "stale" AYNEN. Zincir döngüsü: karma ayda sonraki aya
  bu ayın hesabının devredeni taşınır (her değişiklik bir kez); "stale" / "kept" / "reduced" ayında fişinki AYNEN. A kipi (VAT_CARRY_MODE = "ledger") aynı `settle`'ı kullanır.
  `preview`, `monthPosition`, `carriedBefore`, `listOf`, fiş yazımı DEĞİŞMEDİ.
- `server/routes/report-center.mjs` (yalnız KDV Özeti özeti): karma ay notu; karma ay "güncel değil" listesinden çıkarılır (tek not).
- Testler: YENİ `test/kdv-ozeti-karma-251.test.mjs` (10 sınama: kararın örneği, aralıklar, satış silinmesi, devreden yönde, yön dönmesi + yıl dönümü, tutarlılık tablosu 5 satır;
  iki şirket); DEĞİŞEN `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (C adımı: karma ay — 13 → 18 denetim).
- Kanıt: `docs/kanit/2026-11-27/m1k2-*` (ham çıktılar), `m1k2-betik/` (betikler), `m1k2-ekran/` (görüntü).
- DOKUNULMADI: istemci, defter türetmesi, fiş / ön izleme yazımı, göçler, `.github/**`, `package.json`, `tools/**`, `test/bagimsiz/**`, kılavuz.

## 0. NASIL BOZULUR (koddan ÖNCE, f12c0924) → sınama eşlemesi (karma = yeni dosya; d1 / d2 / d3 = birinci / ikinci / üçüncü describe)
1 alış iptali + satış eklenmesi → d1 it 1, d3 "ikisi birden", ekran C adımı (satış iptali biçiminde — aşağıda §DENENMEYEN) · 2 satış silinmesi + alış iptali → d1 it 3 ·
3 yalnız 391 → d3 "yalnız 391" · 4 yalnız azalma → d3 "yalnız İ azaldı" · 5 hiçbiri → d3 "hiçbiri" · 6 İ arttı + 391 → d3 "İ arttı" · 7 devreden yönde → d2 it 1 (+ yön dönmesi d2 it 2,
ekran C) · 8 yıl dönümü → d2 it 2 · 9 iki şirket → her describe iki şirket (d1 it 3 001'in değişmediğini de okur) · 10 aralık özetleri = 391 − 191 → `balanced` (d1 it 1 / it 2,
d2 it 1, d3 her satır), Bu Yıl / Tüm Zamanlar d1 it 2, Bu Yıl / 2026 yılı / Aralık–Ocak d2 it 2; ekran = PDF = Excel `sameFiles` (d1 it 1 / it 3, d2 it 1 / it 2) · 11 not → d1 it 1 /
it 3, d2, d3 (tam metin) · 12 6 ay sınırı, kopuk fiş → komşular (mahsup-sonrasi d2 it 4, d1 it 4) + M7 / N1 mutantları · 13 A kipi → Z5 mutantı · 14 ön izleme / fiş → kabul B.
Ek değişmez (bu turun): her tutarlılık satırında ve devreden / yön dönmesi senaryolarında ONARIM (geri al + sırayla yeniden mahsup) sonrası fiş toplamı = raporun aralık toplamı.
