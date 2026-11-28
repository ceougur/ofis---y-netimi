# M1 KÜÇÜK TUR 3 — KDV Özeti: yalnız satış KDV'si değişen devreden yönlü mahsuplu ay (S-M1K2-1 = A) — RAPOR

Taban `t251-m1k2` (f2412ba9, küçük tur 2'nin dal ucu) → dal ucu: bu raporun son commit'i (`worktree-agent-a4aaa7373bd6d8d91`). PUSH YOK. KDV Mahsup Fişi, ön izlemesi ve
defter DEĞİŞMEDİ (kabul B: taban = yeni BİREBİR) — yalnız Rapor Merkezi'nin KDV Özeti görünümü.
Ortam: son okuma (bitiş): yük 2,13 / 4 çekirdek (koşu sırasında öbür ajanlarla 4–7 arası; her ağır koşudan önce bir kez beklendi), bellek boş 4 GB (kullanılabilir 13 GB), disk boş 12 GB. Arka plan işim YOK.

## A. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce = taban t251-m1k2 → sonra; Raporlar → Tüm Raporlar → KDV Özeti (Beyanname Hazırlığı); ekran = PDF = Excel)
1. **Kararın örneği AYNEN** (Mart alış KDV 1.000, satış KDV 200 → Mart fişi sonraki döneme devreden 800; sonra Mart'a KDV'si 100 olan satış; Nisan satış KDV 1.000 → Nisan fişi
   defterin 800'üyle 200): Mart 0 / 0 / 700 (DEĞİŞMEDİ). Nisan ÖNCE 800 / **200** / 0 → SONRA **700 / 300** / 0 + YENİ not "Zincirle Uyuşmayan Mahsup Fişi: Nisan 2026 fişi
   800,00 TL devredenle kesilmiş, sırayla mahsupta 700,00 TL olmalıydı (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)".
   Mart–Nisan ÖNCE **200** → SONRA **300** (= 391 1.300 − 191 1.000); ay satırları Mart "Sonraki Döneme Devreden KDV 700" / Nisan "Önceki Dönemden Devreden KDV 800 → 700" +
   "Ödenecek KDV 200 → 300". Mart'ın "Mahsuptan Sonra Değişen Ay: Mart 2026 (mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin)" notu KALIR. Tüm Zamanlar ve
   2026 yılı 200 → 300. Onarımda (Nisan ve Mart geri al, sırayla yeniden mahsup) fişler devreden 700 / 300 → toplam 300 = raporun söylediği; notlar kalkar.
2. **Yıl dönümü** (aynı sayılar Aralık 2026 / Ocak 2027): Bu Yıl (2027) ÖNCE 800 / 200 / 0 → SONRA **700 / 300** / 0 + "Ocak 2027 fişi 800,00 TL devredenle kesilmiş, sırayla
   mahsupta 700,00 TL olmalıydı"; 2026 yılı 0 / 0 / 700 (değişmedi); Aralık–Ocak 200 → 300.
3. **Yalnız 391 azalışı, devreden yönde** (Mart fişi 800 devreden; Mart'ın tek satışı İptal Et → bugünkü devreden 1.000): Nisan ÖNCE 800 / 200 → SONRA **1.000 / 0** + not
   ("… sırayla mahsupta 1.000,00 TL olmalıydı"); Mart–Nisan 200 → **0** (= 391 1.000 − 191 1.000).
4. **Yön dönmesi, devreden → ödenecek** (Mart fişi 800 devreden; Mart'a KDV'si 1.000 olan satış → Mart bugün ödenecek 200): Nisan ÖNCE 800 / 200 → SONRA **0 / 1.000** + not
   ("… 800,00 TL devredenle kesilmiş, sırayla mahsupta 0,00 TL olmalıydı"); Mart–Nisan 400 → **1.200** (= 391 2.200 − 191 1.000).
5. **Arada mahsupsuz ay** (Mart fişi 800, Mart'a satış 100; Nisan satış KDV 300 mahsupsuz; Mayıs fişi defterin 800'üyle 200): Nisan ÖNCE 800 / 0 / 500 → SONRA **700 / 0 / 400**;
   Mayıs ÖNCE 500 / 500 → SONRA **400 / 600** + "Mayıs 2026 fişi 800,00 TL devredenle kesilmiş, sırayla mahsupta 400,00 TL olmalıydı" (önce 500,00 TL); Mart–Mayıs 500 → **600**
   (= 391 − 191). "Mahsup Edilmemiş Ay: Nisan 2026" aynen.
6. **Karma ay + sonraki ayda yalnız 391** (Ocak karma; Şubat fişi devreden 500, sonra Şubat satışı 100 İptal Et; Mart fişi defterin 500'üyle 500): Şubat sonraki devreden 600
   (bugünkü; DEĞİŞMEDİ), Mart ÖNCE 500 / 500 (fiş, zincirde) → SONRA **600 / 400** + "Mart 2026 fişi 500,00 TL devredenle kesilmiş, sırayla mahsupta 600,00 TL olmalıydı";
   Ocak–Mart 1.000 → **900** (= 391 2.200 − 191 1.300).
7. **DEĞİŞMEYENLER** (tabanda da yeşil; tutarlılık tablosunda sabitlendi): ödenecek yönde kesilmiş fişte yalnız 391 değişimi (yön aynı ya da devredene dönen — §7 S-M1K3-1);
   İ artan "güncel değil" ayı (§7 S-M1K3-1); yalnız İ azalması (S-DKM1-1 = A); karma ay (S-M1K-1 = A); hiçbiri; mahsupsuz ay zinciri; KDV Mahsup Fişi penceresi, ön izleme,
   fiş satırları, defter; not metinleri (yeni metin YOK — mevcut "güncel değil" ve "Zincirle Uyuşmayan" notları); "Mahsup Edilmemiş Ay" 6 ay sınırı; A kipi.

## B. DEĞİŞEN DOSYALAR
- `server/routes/tax.mjs` (yalnız `vatView` zincir döngüsü + açıklama): `only391 = kept && offsetState === "stale" && step.input === fişin İ'si && fişin sonraki döneme devredeni > 0`;
  `next = !kept ? step.carryOut : (mixed || only391) ? settled.carryOutMinor : fişin devredeni`. `settle`, `preview`, `monthPosition`, `carriedBefore`, `listOf`, fiş yazımı,
  A kipi DEĞİŞMEDİ. `report-center.mjs` DEĞİŞMEDİ (uyuşmazlık notu mevcut `mismatches` listesinden).
- Testler: YENİ `test/kdv-ozeti-yalniz391-251.test.mjs` (15 sınama: kararın örneği + yıl dönümü + iki şirket; tutarlılık tablosu 10 satır; zincir — arada mahsupsuz ay, karma + yalnız
  391; S4 taşımalı karma); DEĞİŞEN `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (D adımı, ikinci kurulumda — 18 → 26 denetim; A / B / C adımları AYNEN).
- Kanıt: `docs/kanit/2026-11-27/m1k3-betik/` (betikler), `m1k3-ham/` (ham çıktılar), `m1k3-ekran/` (görüntü).
- DOKUNULMADI: istemci, `report-center.mjs`, defter türetmesi, fiş / ön izleme yazımı, göçler, `.github/**`, `package.json`, `tools/**`, `test/bagimsiz/**`, kılavuz.

## 0. NASIL BOZULUR (koddan ÖNCE, 76fedcef) → sınama eşlemesi (Y = yeni dosya; d1 kararın örneği, d2 tablo, d3 zincir, d4 S4)
1 devreden yönde 391 artışı → d1 it 1, d2 "yalnız 391 arttı", ekran D · 2 391 azalışı → d2 "yalnız 391 azaldı" · 3 devreden → ödenecek dönüşü → d2 "yön döndü (S-M1K2-1)" ·
4 ödenecek yönde yön aynı → d2 "ödenecek · yalnız 391 arttı (DEĞİŞMEZ)" · 5 ödenecek → devreden dönüşü → d2 "(DEĞİŞMEZ, karar dışı)" + Y3 mutantı + §7 · 6 eski / yeni devredenle
kesilmiş sonraki fiş → uyuşmazlık notu her satırda; yeni devredenle = onarım (her satır, d1, d3) · 7 arada mahsupsuz ay → d3 it 1 · 8 yıl dönümü → d1 it 2 · 9 iki şirket → her describe
iki şirket (d1 it 2 001'i de okur) · 10 aralık özetleri = 391 − 191 → `balanced` her yerde (sapan iki karar dışı satırda sapma sayısı sabitlendi); Bu Yıl / Tüm Zamanlar / 2026 yılı
d1; ekran = PDF = Excel `sameFiles` (d1, d3) · 11 6 ay sınırı / kopuk fiş → komşular (M7, N1, Z4 mutantları) · 12 karma ile birlikte → d3 it 2 + d2 "ikisi birden" · 13 İ arttı →
d2 "İ arttı (karar dışı)" + Y4 mutantı + §7 · 14 S4 taşımalı karma → d4 + Y5 mutantı · 15 A kipi → Z5 mutantı · 16 ön izleme / fiş → kabul B (+ her tablo satırında Nisan ön izlemesi
= fiş).

## TARAMA (ders 10 — komşular `git grep`)
| Değişen | Çağıranlar / okuyanlar | Sınama |
|---|---|---|
| `vatView` zincir döngüsü (tax.mjs) | yalnız `report-center.mjs` KDV Özeti (tek çağrı, satır 2080); `carryAfterMinor` / `mismatches` yalnız KDV Özeti özeti okur | komşu listesi |
| KDV Özeti özeti (report-center.mjs, DEĞİŞMEDİ) | ekran (`hof-report-center.js`), PDF, Excel | `sameFiles`, ekran senaryoları |
| Geniş tarama `git grep -l -E "vatView|offsetState|kdv-ozeti|KDV Özeti|vat-offset|Mahsuptan Sonra|Zincirle Uyuşmayan|Mahsup Edilmemiş|carryAfterMinor" -- 'test/*.test.mjs'` | 27 dosya; yeni test dışında HEPSİ tur 2'nin 50 dosyalık komşu listesinde → liste + yeni test (51) | kabul C |
| Aynı tarama `test/e2e/*.mjs` | 8 senaryo = kabul D listesi (birebir) | kabul D |

## 3. YENİ / DEĞİŞEN TESTLER — kırmızı nedeni ve yeşil (iki TZ)
KÂHİN ELLE (karar metni + elle hesap; programın kodundan türetilmedi). Taban: ayrı kopya `/dev/shm/m1k3-kdv/eski` (worktree --detach t251-m1k2; içine YALNIZ yeni test dosyası ve
değişen ekran senaryosu kopyalandı). Koşu `m1k3-betik/yeni-test.sh` (yeni + küçük turların dört KDV Özeti testi).
| Koşu | Taban | Yeni |
|---|---|---|
| 5 dosya (49 sınama) UTC | 42/49, **7 kırmızı** | 49/49 |
| aynı, Europe/Istanbul | 42/49, **7 kırmızı** | 49/49 |
| `senaryo-kdv-mahsup-sonrasi-251` | 22/26, **4 kırmızı** (yalnız D adımı) | 26/26 |
Kırmızıların NEDENİ (günlükten okundu — `m1k3-ham/m1k3-yeni-test-taban-utc.log`, ist aynı): d1 it 1 ve it 2 "Nisan / Bu Yıl actual [80000, 20000, 0] / expected [70000, 30000, 0]";
d2 "yalnız 391 arttı" Nisan actual [80000, 20000, 0] / expected [70000, 30000, 0]; "yalnız 391 azaldı" actual [80000, 20000, 0] / expected [100000, 0, 0]; "yön döndü" actual
[80000, 20000, 0] / expected [0, 100000, 0] (özet: Önceki 800, Ödenecek 200, uyuşmazlık notu yok); d3 it 1 Nisan actual [80000, 0, 50000] / expected [70000, 0, 40000]; d3 it 2
Ocak–Mart actual 100000 / expected 90000. Ekran tabanı: "Mart–Nisan 0 / 200 / 0", ay satırları "Nisan Önceki Dönemden Devreden 800 / Ödenecek 200", "Zincirle Uyuşmayan" notu YOK,
Bu Yıl 200. Hepsi BEKLENEN neden (taban "güncel değil" ayında sonraki aya fişin eski devredenini taşıyor). Öbür sekiz sınama (tablonun yedi satırı + S4 taşımalı karma) TABANDA DA
YEŞİL — beklenen: o durumların davranışı DEĞİŞMEDİ (sabitleme); dişleri Y3 / Y4 / Y5 ve tur 2'nin mutantlarında.

## 4. KABUL KOŞULLARI
- **A** §3 (iki TZ): yeni sınamalar tabanda beklenen nedenle kırmızı (7 + ekran 4), yenide yeşil (49/49 iki TZ, ekran 26/26).
- **B** ön izleme / fiş (`m1k3-betik/onizleme-esit.sh` = tur 2'nin betiği AYNEN, yalnız yollar; dar kontrol senaryoları A, B, C, E, F, J, L, L2 `m1k-betik/dk-senaryo-kopya.mjs`
  DEĞİŞTİRİLMEDEN): UTC ve İstanbul ön izleme / fiş / geri al / iptal / kilit satırları taban 26 = yeni 26, **BİREBİR EVET**; o senaryoların rapor satırlarında fark **0**; karma
  yoklaması fiş satırları 3 = 3 BİREBİR. Ek (`m1k3-betik/fis-esit-391.sh`; kararın örneği, `m1k2-betik/yalniz-391-devreden-yoklama.mjs` değiştirilmeden): fiş satırları 2 = 2
  BİREBİR (iki TZ); rapor Nisan 800 / 200 → 700 / 300 + uyuşmazlık notu, Mart–Nisan 200 → 300.
- **C** komşular (`m1k3-betik/komsu.sh`: tur 2'nin 50 dosyası + yeni test = 51 dosya): UTC **638/638**, İstanbul **638/638**, 0 başarısız / iptal / atlanan.
  `npm run test:kahin-defter` (dokunmadan): UTC **187/187**, İstanbul **187/187**.
- **D** ekran senaryoları (yeni kod, `m1k3-betik/e2e.sh`): senaryo-kdv-mahsup-sonrasi-251 26/26, senaryo-kdv-zincir-251 12/12, senaryo-kdv-devreden-251 14/14, senaryo-kdv-donemi-250
  23/23, senaryo-defter-243 33/33, senaryo-c7b-kabul-250 39/39, senaryo-mobil-247 77/77, senaryo-banka-210 429/429. Beklentisi değişen eski adım YOK (mahsup-sonrasi'ye yalnız D
  adımı eklendi). Görüntü `m1k3-ekran/yeni/m1k3-kdv-ozeti-yalniz391-mart-nisan.png` (baktım: özet Hesaplanan 1.300, İndirilecek 1.000, Önceki 0, Ödenecek 300, Sonraki 0; "Mahsuptan
  Sonra Değişen Ay: Mart 2026 (mahsup fişi güncel değil …)" ve "Zincirle Uyuşmayan Mahsup Fişi: Nisan 2026 fişi ₺800,00 devredenle kesilmiş, sırayla mahsupta ₺700,00 olmalıydı …"
  not kartlarında tam genişlikte; tabloda Mart "Sonraki Döneme Devreden KDV ₺700,00").
- **E** mutantlar — §5: 39/39 ÖLDÜ, iki TZ (istenen üçü Y1 7 / Y2 6 / Y3 1 başarısız).

## 5. MUTANT TABLOSU
Ayrı kopya `/dev/shm/m1k3-kdv/mut` (archive 256b03ef: server, test, client, tools, package.json); testler yalniz391 + karma + mahsup-sonrasi + zincir + devreden +
defter-243-ux24-toplam + c7b-kdv-ozeti-donem-250 + c7b-kdv-s4-250 (tek `node --test`, 61 sınama); `m1k3-ham/mutant-utc.json`, `mutant-ist.json`. Tur 2'nin 34 mutantı AYNEN
(NEXT satırına dokunan Z2, Z7, K4 yalnız metin olarak yeni satıra uyarlandı — anlamları aynı; betikte yazılı) + bu turun Y1–Y5'i (görev metninin istediği üç: Y1, Y2, Y3).
"Başarısız" = node --test üst düzey `# fail`. Tek mutant ~13 sn.
| Mutant | Başarısız UTC / İst | Sonuç |
|---|---|---|
| D1 devredeni sıfır al (rapor görünümü) | 22 / 22 (iptal 0 / 0) | ÖLDÜ |
| D2 devredeni iki kez düş | 22 / 22 (iptal 0 / 0) | ÖLDÜ |
| D3 çok aylı aralıkta ilk ay yerine son ayın devredeni 'önceki dönem' | 21 / 21 (iptal 0 / 0) | ÖLDÜ |
| D4 mahsup formülü yerine eski dönem farkı (391 − 191) | 28 / 28 (iptal 0 / 0) | ÖLDÜ |
| D5 ödenecek ile devredeni ters yaz | 49 / 49 (iptal 0 / 0) | ÖLDÜ |
| D6 ödenecek yalnız son hareketli ay (toplam yerine) | 27 / 27 (iptal 0 / 0) | ÖLDÜ |
| D7 sonraki döneme devreden = aralığın son ayının görünümü (hareketli ay yerine) | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| D8 'Mahsup Edilmemiş Ay' notu hiç yazılmaz | 10 / 10 (iptal 0 / 0) | ÖLDÜ |
| D9 ay satırlarında kullanılan devreden satırı yok | 11 / 11 (iptal 0 / 0) | ÖLDÜ |
| D10 S4 taşıması zincirde unutulur (carried yok) | 19 / 19 (iptal 0 / 0) | ÖLDÜ |
| Z1 mahsupsuz ayı zincirden atla (devredeni değiştirmez) | 12 / 12 (iptal 0 / 0) | ÖLDÜ |
| Z2 ödenecek aydan sonra devredeni taşı | 4 / 4 (iptal 0 / 0) | ÖLDÜ |
| Z3 zinciri aralığın ilk ayından başlat (öncesini unut) | 26 / 26 (iptal 0 / 0) | ÖLDÜ |
| Z4 kopuk zincir notunu yazma | 14 / 14 (iptal 0 / 0) | ÖLDÜ |
| Z5 A ↔ B anahtarını ters çevir | 26 / 26 (iptal 0 / 0) | ÖLDÜ |
| Z6 fişin devredeni zincirle karşılaştırılmaz (her fiş geçerli) | 15 / 15 (iptal 0 / 0) | ÖLDÜ |
| Z7 geçerli fişte fişin devredeni yerine hesaplanan taşınır | 8 / 8 (iptal 0 / 0) | ÖLDÜ |
| M3 zincirde S4 emilimi yok (mahsupsuz ayın saklı İ'si = bugünkü İ) | 3 / 3 (iptal 0 / 0) | ÖLDÜ |
| M4 aralığın sonraki devredeni = fişin devredeni (carryAfter) | 3 / 3 (iptal 0 / 0) | ÖLDÜ |
| M7 Mahsup Edilmemiş Ay 6 sınırı 5 | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N1 fiş zincirde sayılırken S4 emilimi karşılaştırılmaz (yalnız devreden) | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N2 S-DKM1-1 yok: zincirdeki fişin ayı bugünkü kayıtlardan | 24 / 24 (iptal 0 / 0) | ÖLDÜ |
| N3 S-M1-3 yok: güncel olmayan fişte de sonuç fişten | 20 / 20 (iptal 0 / 0) | ÖLDÜ |
| N4 'reduced' notu ayın kendi İ'si yerine düzeltilmiş İ'den (önceki ayın azalması bu aya yazılır) | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N5 azalan ay notu yazılmaz | 9 / 9 (iptal 0 / 0) | ÖLDÜ |
| N6 yön farkı notta yazılmaz (S-M1-2) | 2 / 2 (iptal 0 / 0) | ÖLDÜ |
| N7 devredeni aynı uyuşmazlıkta da devreden cümlesi | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| K1 karma ayda İndirilecek KDV bugünkü kayıtlardan | 9 / 9 (iptal 0 / 0) | ÖLDÜ |
| K2 karma ayda 391 fişten | 9 / 9 (iptal 0 / 0) | ÖLDÜ |
| K3 karma ayda not çıkmaz | 8 / 8 (iptal 0 / 0) | ÖLDÜ |
| K4 karma ayda sonraki aya fişin eski devredeni taşınır | 3 / 3 (iptal 0 / 0) | ÖLDÜ |
| K5 yalnız 391 değişiminde de karma kuralı (S-M1-3 = C bozulur) | 10 / 10 (iptal 0 / 0) | ÖLDÜ |
| K6 karma ay 'güncel değil' notunda ikinci kez yazılır | 8 / 8 (iptal 0 / 0) | ÖLDÜ |
| **Y1 devreden yönde yalnız 391 ayında sonraki aya fişin eski devredeni taşınır** | 7 / 7 (iptal 0 / 0) | ÖLDÜ |
| **Y2 yalnız 391 ayından sonraki fişin uyuşmazlık notu çıkmaz** | 6 / 6 (iptal 0 / 0) | ÖLDÜ |
| **Y3 ödenecek yönde kesilmiş fişte de yeni kural (yön dönen ayda bugünkü devreden)** | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| **Y4 İ artan güncel değil ayında da yeni kural (karar yalnız satış KDV'si)** | 2 / 2 (iptal 0 / 0) | ÖLDÜ |
| **Y5 S4 karma: 'İ azaldı' ölçüsü ayın kendi İ'si (S4 taşıması sayılmaz)** | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N8 güncel değil notunun eski metni | 13 / 13 (iptal 0 / 0) | ÖLDÜ |

## 6. HIZ
Ölçülmedi (DOĞRULANMADI). Değişen yol: zincir döngüsünde fişli her ay için dört karşılaştırma (yeni sorgu, yeni döngü yok). Ana oturum isterse `ana-kabul/betik/kabul.sh` ile KDV
Özeti'ni yineler (küçük tur 2 ile aynı ölçüm penceresinde).

## 7. KULLANICIYA SORULMALI
**S-M1K3-1 — Kararın söylemediği iki 'güncel değil' ayı: aralık toplamı 391 − 191'den sapıyor (bu turda KODLANMADI — ders 43; tabloda bugünkü davranışla sabitlendi)** (uç durum).
(a) Ödenecek yönde kesilmiş fişli ay YALNIZ satış KDV'sinin azalmasıyla devredene döner (Mart satış KDV 800 + 200, alış 500 → Mart fişi ödenecek 500; sonra Mart'ın 800'lük satışı
İptal Et → Mart bugünkü kayıtlarla sonraki döneme devreden 300; Nisan satış KDV 200 → Nisan fişi 200). Bugün: Mart 0 / 0 / 300, Nisan 0 / 200 / 0 (fişin 0 devredeniyle; zincirde),
Mart–Nisan Ödenecek 200, Sonraki 0 — 391 400 − 191 500 = −100 olmalıydı; **300 sapma** (Mart'ın 300 devredeni Nisan'a geçmiyor). (b) Devreden yönde kesilmiş fişli ayda İndirilecek
KDV ARTAR (geç gelen alış: Mart fişi devreden 800, sonra Mart'a KDV'si 100 olan alış → Mart bugünkü devreden 900): Nisan 800 / 200 (fiş), Mart–Nisan 200; 391 1.200 − 191 1.100 =
100 olmalıydı; **100 sapma**. İki durumda da Mart'ın "güncel değil" notu çıkıyor; kullanıcı geri alıp sırayla yeniden mahsup ederse düzelir (onarım sınamalı: (a) fişler 300 devreden
/ 100 devreden, (b) 900 devreden / 100).
- **A)** S-M1K2-1 ile aynı çizgi: her 'güncel değil' ayında sonraki aya BU AYIN (bugünkü) devredeni taşınır — (a) Nisan 300 devredenle: 200 − 300 → Sonraki Döneme Devreden 100,
  Mart–Nisan Ödenecek 0, Sonraki 100 (= 391 − 191) + "Nisan 2026 fişi 0,00 TL devredenle kesilmiş, sırayla mahsupta 300,00 TL olmalıydı; fiş ödenecek KDV 200,00 TL yazmış, sırayla
  mahsupta sonraki döneme devreden KDV 100,00 TL çıkar" (not metni programın mevcut kalıbından; sayılar Y3 koşusundan — `m1k3-ham/secenek-a.txt`: Nisan özeti Önceki 300, Ödenecek 0,
  Sonraki 100; metnin tamamı okunmadı); (b) Nisan 900 devredenle 100, Mart–Nisan 100 + "Nisan 2026 fişi 800,00 TL devredenle kesilmiş, sırayla mahsupta 900,00 TL
  olmalıydı" (Y4 koşusu: Nisan Önceki 900, Ödenecek 100). (Kod bir koşulun kaldırılması; Y3 / Y4 mutantları tam bu davranıştır — tabloda yakalanan sayılar §5.)
- **B)** Bugünkü gibi (karar 'YALNIZ satış KDV'si, DEVREDEN yönde' dedi; baş mimar okuması ödenecek yönde DEĞİŞMEZ): sayılar yukarıdaki "bugün"; not geri al + yeniden mahsubu söyler.
- **C)** Uç durum böyle kalsın (BİLİNEN SINIR) — sayılar B ile aynı; teslim notuna yazılır.
- **ÖNERİ: A** (S-M1K-1 / S-M1K2-1'in "her değişiklik bir kez" ilkesi; aralık toplamı her durumda 391 − 191; mevcut uyuşmazlık notu kullanıcıya onarımı söyler). Para kuralı —
  KODLANMADI. Yaygın programlarda nasıl: belgesi / ekranı bu turda okunmadı — dayanak yazılmadı.

## 8. BAŞ MİMAR KARARI GEREKİYOR (değerlendir)
1. **"Devreden yönde" = fişin yönü** (fişin sonraki döneme devredeni > 0). Fiş devreden yazmış, ayın 391'i artıp ay bugün ÖDENECEK yöne dönmüşse kural uygulanır: sonraki aya bugünkü
   devreden (0) taşınır, sonraki ayın 800'lü fişi uyuşmazlık notu alır (A.4; Mart–Nisan 1.200 = 391 − 191). İkinci okuma ("bugünkü yön") bu ayda fişin 800'ünü taşırdı → Mart–Nisan 400,
   391 − 191'den 800 sapma; kararın "her değişiklik bir kez" cümlesiyle çelişir — bu yüzden karardan TÜRETİLMİŞ sayıyorum. Ödenecek fişli ayın devredene dönmesi bu okumada kural
   DIŞINDA kalır (§7 (a)).
2. **S4 taşımalı karma (tur 2 §8.3) — tek okuma, sabitlendi** (d4): Ocak fişi 500, Şubat fişi 500; sonra Ocak'ın 200'lük alışı İptal Et (S-DKM1-1: Ocak sonucu fişten 500) + Şubat'ın
   100'lük satışı İptal Et. Şubat'ın İ'si (kendi 300 + S4 −200 = 100) fişin 300'ünden az ve 391'i değişti → karma: İ fişten 300, 391 bugünkü 700 → **400**; Mart (mahsupsuz, satış
   500, alış 100) S4 −200 ile **600**. Ocak–Şubat 900 (391 − 191 = 1.100'den 200 eksik — azalma Mart'ta düşülür), Ocak–Mart **1.500 = 391 − 191**; Mart fişi ön izlemeyle 600 = rapor
   (zincirde, not yok); onarımda fişler 700 / 400 / 400 = 1.500. İkinci okuma ("Şubat'ın kendi İ'si değişmedi → yalnız 391, bugünkü kayıtlardan 700 − 100 = 600") azalmayı Şubat'ta VE
   Mart'ın mahsubunda (ön izleme / fiş −200 düşer) iki kez sayar (Ocak–Mart 1.700 ≠ 1.500) — karar metniyle çelişir; Y5 mutantı tam bu okumadır, d4'te kırmızı. Tek okuma bu.
3. **Ekran senaryosunda ikinci kurulum**: D adımı aynı senaryo dosyasında ikinci sunucuyla (saat 15.05.2026) — ilk kurulumun verisi Ocak–Mart'ta, saati 15.04.2026 (Nisan mahsup
   edilemez; Ocak'tan önceki aya mahsup yapılamaz). Veri API'den (senaryonun A–C adımları gibi), rapor ekrandan; ikinci kurulumun klasörü ve sunucusu `finally`'de kapanır / silinir.

## 9. SONRAKİ SÜRÜME
- Yeni test dosyasının API yardımcıları (`program`, `balanced`) karma testinden KOPYA — ortak test yardımcısına alınabilir (test düzeni; 20.11 kuralı).
- Ekran senaryosu D adımında satış ekranı kullanılmadı (veri API'den — senaryonun öbür adımları gibi); kayıt ekranından girişi ayrı senaryolar kapsıyor.

## 10. DOĞRULANMADI
- Hız (§6). Windows (CI) — yeni test dosyaya dokunmuyor (ikinci kurulumun klasörü mkdtemp + rmSync, senaryonun ilk kurulumu gibi); ana oturum CI'de okur.

## 11. DENENMEYEN
- Tam `npm test` (görev gereği ana oturum); `test:kahin-cari` (cari dokunulmadı); `test:guvenilirlik`; eski sürüm verisiyle göç; `test/excel-denetim/ekran-hafta.mjs` (CI dışı);
  D adımının 1366 × 900 dışındaki boyutları; A kipi (VAT_CARRY_MODE = "ledger") yalnız Z5 mutantıyla; 6 aydan uzun "güncel değil" zinciri.

## 12. BİLİNEN SINIRLAR
- §7 (yanıt gelene kadar): ödenecek fişli ayın yalnız 391 azalışıyla devredene dönmesi ve İ artan devreden ay — aralık toplamı 391 − 191'den sapar; "güncel değil" notu onarımı söyler.
- Defter (360 / 190) fişi değiştirmez: rapor "olması gereken"i gösterir; geri al + sırayla yeniden mahsupla düzelir (uyuşmazlık notu söyler; onarım sınamaları toplamın aynı kaldığını
  gösterir).

## 13. CI LİSTESİNE EKLENECEK
- `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (küçük turdan; bu turda D adımı eklendi). Birim test `test/kdv-ozeti-yalniz391-251.test.mjs` `npm test` deseniyle koşar.

## 14. KILAVUZ METNİ ÖNERİSİ (son adayda toplu; küçük turların maddesine ek)
- "Sonraki döneme devreden KDV ile mahsup ettiğiniz bir aya sonradan satış girer ya da satış iptal ederseniz KDV Özeti o ayın devredenini bugünkü kayıtlardan hesaplar ve sonraki aya bu
  tutarı taşır. Sonraki ayın mahsup fişi eski devredenle kesildiyse 'Zincirle Uyuşmayan Mahsup Fişi' satırı bunu söyler; o ayın ve sonraki ayların mahsubunu geri alıp ayları sırayla
  yeniden mahsup edin."

## 15. COMMIT LİSTESİ (t251-m1k2..dal ucu)
- 76fedcef rapor taslağı: nasıl bozulur listesi (koddan önce)
- 256b03ef KDV Özeti kodu (S-M1K2-1 = A) + yeni test dosyası
- f26ad359 ekran senaryosuna D adımı + betikler (yeni test, ekran, mutant)
- 3155c885 betikler: komşular, ön izleme eşitliği, kararın örneğinde fiş eşitliği
- 9a9fa22e betik: kabul B / C adımları
- f5dc0c61 rapor taslağı
- 69e28f5e Kanıt: ham çıktılar, ekran görüntüleri, seçenek A sayıları betiği
- (son) rapor son hâli (bu belge)

## 16. ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
cd <dal ucu ağacı>   # node_modules bağlantısı gerekli
for tz in UTC Europe/Istanbul; do HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=$tz node --test test/kdv-ozeti-yalniz391-251.test.mjs test/kdv-ozeti-karma-251.test.mjs test/kdv-ozeti-mahsup-sonrasi-251.test.mjs test/kdv-ozeti-zincir-251.test.mjs test/kdv-ozeti-devreden-251.test.mjs; done   # 49/49
# taban kırmızısı: worktree add --detach <ayrı klasör> t251-m1k2; test/kdv-ozeti-yalniz391-251.test.mjs + test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs kopyala → 42/49 (7 kırmızı), ekran 22/26
bash docs/kanit/2026-11-27/m1k3-betik/yeni-test.sh ikisi <dal ucu> <kanıt klasörü>       # taban yolu betikte /dev/shm/m1k3-kdv/eski
bash docs/kanit/2026-11-27/m1k3-betik/komsu.sh utc <kök> <kanıt klasörü>                 # (ve ist)
npm run test:kahin-defter                                                                   # 187/187, 0 fark (iki TZ)
bash docs/kanit/2026-11-27/m1k3-betik/onizleme-esit.sh <çıktı>; bash docs/kanit/2026-11-27/m1k3-betik/fis-esit-391.sh <çıktı>   # BİREBİR EVET
PLAYWRIGHT_BROWSERS_PATH=<pw-1194> HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs   # 26/26
python3 -I docs/kanit/2026-11-27/m1k3-betik/mutant.py <ayrı kopya> <çıktı.json> UTC       # (ve Europe/Istanbul) 39/39
node docs/kanit/2026-11-27/m1k2-betik/yalniz-391-devreden-yoklama.mjs <kök>                # Nisan 700 / 300, Mart–Nisan 300
```
Not: `/dev/shm/m1k3-kdv/eski` (worktree — `worktree remove` ile) ve `/dev/shm/m1k3-kdv/mut` (archive kopyası) duruyor; ana oturum işi bitince kaldırabilir.
