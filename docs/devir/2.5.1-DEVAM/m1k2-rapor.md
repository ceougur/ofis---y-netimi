# M1 KÜÇÜK TUR 2 — KDV Özeti: karma ay (S-M1K-1 = A) — RAPOR

Taban `t251-m1k` (52fb473f, küçük turun dal ucu) → dal ucu: bu raporun son commit'i (`worktree-agent-a341390f4f549e487`). PUSH YOK. KDV Mahsup Fişi, ön izlemesi ve
defter DEĞİŞMEDİ (kabul B: taban = yeni BİREBİR) — yalnız Rapor Merkezi'nin KDV Özeti görünümü.
Ortam (son okuma 19:35 UTC): yük 5,15 / 4 çekirdek (öbür ajanlar; benim koşularım bitti), bellek boş 2 GB (kullanılabilir 10 GB), disk boş 13 GB. Arka plan işim YOK.

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

## TARAMA (ders 10 — komşular `git grep`)
| Değişen | Çağıranlar / okuyanlar | Sınama |
|---|---|---|
| `vatView` (tax.mjs; `settle`, zincir döngüsü) | yalnız `report-center.mjs` KDV Özeti (tanım + tek çağrı); `offsetState` yalnız KDV Özeti özeti okur | komşu listesi |
| KDV Özeti özeti (report-center.mjs) | ekran (`hof-report-center.js`, DEĞİŞMEDİ), PDF, Excel | `sameFiles`, ekran senaryoları |
| Geniş tarama ("vatView, offsetState, Mahsuptan Sonra, mahsup fişi güncel değil, kdv-ozeti, KDV Özeti, vat-offset, Zincirle Uyuşmayan, Mahsup Edilmemiş" — server, client, test) | 60 dosya; `.test.mjs` olanların HEPSİ küçük turun 50 dosyalık komşu listesinde + bu turun yeni testi; e2e'lerin hepsi kabul D listesinde; öbürleri kâhin (`test/bagimsiz/**` — kâhin-defter koşuldu), mutabakat motoru / mali müşavir / qa (yalnız 391 / 191 satırını okur — DEĞİŞMEDİ), Excel denetim betiği (CI dışı; mahsup fişi yok) | — |

## 3. YENİ / DEĞİŞEN TESTLER — kırmızı nedeni ve yeşil (iki TZ)
Kâhin ELLE (karar metni + elle hesap; programın kodundan türetilmedi). Taban: ayrı kopya `/dev/shm/m1k2-kdv/eski` (worktree --detach t251-m1k; içine YALNIZ yeni test dosyası ve
değişen ekran senaryosu kopyalandı). Koşu `m1k2-betik/yeni-test.sh` (karma + mahsup-sonrasi + zincir + devreden).
| Koşu | Taban | Yeni |
|---|---|---|
| 4 dosya (34 sınama) UTC | 28/34, **6 kırmızı** | 34/34 |
| aynı, Europe/Istanbul | 28/34, **6 kırmızı** | 34/34 |
| `senaryo-kdv-mahsup-sonrasi-251` | 14/18, **4 kırmızı** (yalnız C adımı) | 18/18 |
Kırmızıların NEDENİ (günlükten okundu — `m1k2-ham/m1k2-yeni-test-taban-utc.log`, ist aynı): d1 it 1 "Ocak 600 — actual 110000, expected 60000"; d1 it 2 "Ocak–Mart actual 220000 /
expected 170000"; d1 it 3 "Ocak 400 — actual 90000"; d2 it 1 "Mart devreden actual 30000 / expected 70000"; d2 it 2 "Aralık actual [0, 20000, 0] / expected [0, 0, 30000]"; d3
"002 ikisi birden: Ocak 800,00 (özet: 'mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin')". Ekran tabanı: "Bu Yıl 1.100" (beklenen 600), ay satırları Ocak 0 /
Şubat 700, eski not metni, uyuşmazlık notu yok. Hepsi BEKLENEN neden (taban karma ayı "güncel değil" sayıp bugünkü kayıtlardan hesaplıyor, sonraki aya fişin devredenini taşıyor).
Tutarlılık tablosunun öbür dört satırı (hiçbiri / yalnız azalma / yalnız 391 / İ arttı) TABANDA da YEŞİL — beklenen: o durumların davranışı DEĞİŞMEDİ (S-DKM1-1, S-M1-3 aynen);
dişleri K5 / N2 / N3 / N5 / N8 mutantlarında.

## 4. KABUL KOŞULLARI
- **A** §3 (iki TZ): yeni sınamalar tabanda beklenen nedenle kırmızı (6 + ekran 4), yenide yeşil (34/34 iki TZ, ekran 18/18).
- **B** ön izleme / fiş (`m1k2-betik/onizleme-esit.sh` = küçük turun betiği AYNEN, yalnız yollar; dar kontrol senaryoları A, B, C, E, F, J, L, L2 `m1k-betik/dk-senaryo-kopya.mjs`
  DEĞİŞTİRİLMEDEN): UTC ve İstanbul ön izleme / fiş / geri al / iptal / kilit satırları taban 26 = yeni 26, **BİREBİR EVET**; o senaryoların rapor satırlarında fark **0**. Ek: karma
  yoklaması (`m1k-betik/karma-yoklama.mjs`) fiş satırları taban 3 = yeni 3 BİREBİR; rapor Ocak 1.100 → 600, Ocak–Şubat 1.800 → 1.300 (iki TZ).
- **C** komşular (`m1k2-betik/komsu.sh`: küçük turun 50 dosyası + yeni test): UTC **623/623**, İstanbul **623/623**, 0 başarısız / iptal / atlanan.
  `npm run test:kahin-defter` (dokunmadan): UTC **187/187**, İstanbul **187/187**, 0 fark, 0 yakalanmayan mutasyon.
- **D** ekran senaryoları (yeni kod, `m1k2-betik/e2e.sh`): senaryo-kdv-mahsup-sonrasi-251 18/18, senaryo-kdv-zincir-251 12/12, senaryo-kdv-devreden-251 14/14, senaryo-kdv-donemi-250
  23/23, senaryo-defter-243 33/33, senaryo-c7b-kabul-250 39/39, senaryo-mobil-247 77/77, senaryo-banka-210 429/429. Beklentisi değişen eski senaryo YOK (mahsup-sonrasi'ye yalnız
  C adımı eklendi; A / B adımları aynen). Görüntü: `m1k2-ekran/yeni/m1k2-kdv-ozeti-karma-bu-yil.png` (baktım: özet Ödenecek 600, 391 600, 191 0; karma notu ve uyuşmazlık notu not
  kartlarında tam genişlikte; Ocak "Sonraki Döneme Devreden KDV 500", Şubat "Önceki Dönemden Devreden KDV 500" + "Ödenecek KDV 200"); taban: `m1k2-ekran/taban/…`.
- **E** mutantlar — §5: 34/34 ÖLDÜ, iki TZ.

## 5. MUTANT TABLOSU
Ayrı kopya `/dev/shm/m1k2-kdv/mut` (archive 4b67b240: server, test, client, tools, package.json); testler karma + mahsup-sonrasi + zincir + devreden + defter-243-ux24-toplam +
c7b-kdv-ozeti-donem-250 + c7b-kdv-s4-250 (tek `node --test`, 46 sınama); `m1k2-ham/mutant-utc.json`, `mutant-ist.json`. Küçük turun 28 mutantı AYNEN (Z2, Z7, N2, N3 yalnız metin
olarak yeni satırlara uyarlandı — anlamları aynı; betikte yazılı) + bu turun K1–K6'sı. "Başarısız" = node --test üst düzey `# fail`.
| Mutant | Başarısız UTC / İst | Sonuç |
|---|---|---|
| D1 devredeni sıfır al (rapor görünümü) | 15 / 15 (iptal 0 / 0) | ÖLDÜ |
| D2 devredeni iki kez düş | 15 / 15 (iptal 0 / 0) | ÖLDÜ |
| D3 çok aylı aralıkta ilk ay yerine son ayın devredeni 'önceki dönem' | 10 / 10 (iptal 0 / 0) | ÖLDÜ |
| D4 mahsup formülü yerine eski dönem farkı (391 − 191) | 18 / 18 (iptal 0 / 0) | ÖLDÜ |
| D5 ödenecek ile devredeni ters yaz | 34 / 34 (iptal 0 / 0) | ÖLDÜ |
| D6 ödenecek yalnız son hareketli ay (toplam yerine) | 22 / 22 (iptal 0 / 0) | ÖLDÜ |
| D7 sonraki döneme devreden = aralığın son ayının görünümü | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| D8 'Mahsup Edilmemiş Ay' notu hiç yazılmaz | 9 / 9 (iptal 0 / 0) | ÖLDÜ |
| D9 ay satırlarında kullanılan devreden satırı yok | 8 / 8 (iptal 0 / 0) | ÖLDÜ |
| D10 S4 taşıması zincirde unutulur | 15 / 15 (iptal 0 / 0) | ÖLDÜ |
| Z1 mahsupsuz ayı zincirden atla | 11 / 11 (iptal 0 / 0) | ÖLDÜ |
| Z2 ödenecek aydan sonra devredeni taşı | 4 / 4 (iptal 0 / 0) | ÖLDÜ |
| Z3 zinciri aralığın ilk ayından başlat | 17 / 17 (iptal 0 / 0) | ÖLDÜ |
| Z4 kopuk zincir notunu yazma | 6 / 6 (iptal 0 / 0) | ÖLDÜ |
| Z5 A ↔ B anahtarını ters çevir | 18 / 18 (iptal 0 / 0) | ÖLDÜ |
| Z6 fişin devredeni zincirle karşılaştırılmaz | 7 / 7 (iptal 0 / 0) | ÖLDÜ |
| Z7 geçerli fişte fişin devredeni yerine hesaplanan taşınır | 4 / 4 (iptal 0 / 0) | ÖLDÜ |
| M3 zincirde S4 emilimi yok | 3 / 3 (iptal 0 / 0) | ÖLDÜ |
| M4 aralığın sonraki devredeni = fişin devredeni (carryAfter) | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| M7 Mahsup Edilmemiş Ay 6 sınırı 5 | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N1 fiş zincirde sayılırken S4 emilimi karşılaştırılmaz | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N2 S-DKM1-1 yok: zincirdeki fişin ayı bugünkü kayıtlardan | 14 / 14 (iptal 0 / 0) | ÖLDÜ |
| N3 S-M1-3 yok: güncel olmayan fişte de sonuç fişten | 8 / 8 (iptal 0 / 0) | ÖLDÜ |
| N4 'reduced' notu düzeltilmiş İ'den | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N5 azalan ay notu yazılmaz | 7 / 7 (iptal 0 / 0) | ÖLDÜ |
| N6 yön farkı notta yazılmaz (S-M1-2) | 2 / 2 (iptal 0 / 0) | ÖLDÜ |
| N7 devredeni aynı uyuşmazlıkta da devreden cümlesi | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| N8 güncel değil notunun eski metni | 3 / 3 (iptal 0 / 0) | ÖLDÜ |
| **K1** karma ayda İndirilecek KDV bugünkü kayıtlardan (istenen 1) | 6 / 6 (iptal 0 / 0) | ÖLDÜ |
| **K2** karma ayda 391 fişten (istenen 2) | 6 / 6 (iptal 0 / 0) | ÖLDÜ |
| **K3** karma ayda not çıkmaz (istenen 3) | 5 / 5 (iptal 0 / 0) | ÖLDÜ |
| K4 karma ayda sonraki aya fişin eski devredeni taşınır | 2 / 2 (iptal 0 / 0) | ÖLDÜ |
| K5 yalnız 391 değişiminde de karma kuralı (S-M1-3 = C bozulur) | 1 / 1 (iptal 0 / 0) | ÖLDÜ |
| K6 karma ay 'güncel değil' notunda ikinci kez yazılır | 5 / 5 (iptal 0 / 0) | ÖLDÜ |

## 6. HIZ
Ölçülmedi (DOĞRULANMADI). Değişen yol yalnız ETKİN MAHSUP FİŞİ olan ayda birkaç karşılaştırma + bir çıkarma ekler (yeni sorgu, yeni döngü yok); `settle` zaten her fişli ayda
çağrılıyordu. Ana oturum isterse `ana-kabul/betik/kabul.sh` ile KDV Özeti'ni yineler.

## 7. KULLANICIYA SORULMALI
**S-M1K2-1 — Yalnız 391 değişen mahsuplu ay DEVREDEN yönde (S-M1-3 = C'nin uç durumu; bu turda DEĞİŞMEDİ, taban = yeni)** (uç durum). Yoklama (`m1k2-betik/yalniz-391-devreden-yoklama.mjs`;
`m1k2-ham/yalniz391-yeni.txt` = `yalniz391-taban.txt`): Mart alış KDV 1.000, satış KDV 200 → Mart fişi devreden 800; sonra Mart'a satış KDV 100 (yalnız 391); Nisan satış KDV 1.000 →
Nisan fişi (defterin 800'üyle) 200. Rapor: Mart 0 / 0 / **700** (bugünkü), Nisan **800** / 200 (fiş), Mart–Nisan Ödenecek **200**; 391 1.300 − 191 1.000 = **300** — 391'deki 100'lük
artış aralık toplamında SAYILMIYOR ve ekranda "Mart sonraki 700 ↔ Nisan önceki 800" kopukluğu var (ödenecek yönde görünmez). Not "Mart 2026 (mahsup fişi güncel değil — mahsubu geri
alıp yeniden mahsup edin)" çıkıyor; kullanıcı notu izlerse düzelir.
- **A)** Karma kuralıyla aynı: "güncel değil" ayında da sonraki aya BU AYIN (bugünkü) devredeni taşınır — Mart 700, Nisan zincirde 700 devredenle 300 + "Zincirle Uyuşmayan Mahsup
  Fişi: Nisan 2026 fişi 800,00 TL devredenle kesilmiş, sırayla mahsupta 700,00 TL olmalıydı"; Mart–Nisan 300 = 391 − 191 (her değişiklik bir kez).
- **B)** Bugünkü gibi (S-M1-3 = C'nin harfi): Mart 700, Nisan 800 / 200, Mart–Nisan 200; not geri al + yeniden mahsubu söyler.
- **C)** Uç durum böyle kalsın (BİLİNEN SINIR) — sayılar B ile aynı; teslim notuna yazılır.
- **ÖNERİ: A** (S-M1K-1'in "her değişiklik bir kez" ilkesiyle tutarlı; aralık toplamı 391 − 191'e eşit kalır; değişiklik küçük — zincir döngüsünde "güncel değil" ayında da hesaplananı
  taşımak; uyuşmazlık notu mevcut). Para kuralı — KODLANMADI (ders 43). Yaygın programlarda nasıl: belgesi / ekranı bu turda okunmadı — dayanak yazılmadı.

## 8. BAŞ MİMAR KARARI GEREKİYOR (değerlendir)
1. **Devreden yönde karma ayda sonraki aya taşınan devreden**: karar metni ödenecek yönde örnek veriyor; devreden yönde sonraki aya karma hesabın devredeni taşındı (fişin eski devredeni
   DEĞİL), çünkü öbürü kararın "her değişiklik bir kez sayılır" cümlesine aykırı (391 değişimi aralık toplamından düşerdi — K4 mutantı). Sonuç: sonraki ayın fişi eski devredenle
   kesildiyse o fiş "Zincirle Uyuşmayan" olur (d2 it 1: Nisan; ekran C: Şubat). Bunu karar metninden TÜRETİLMİŞ sayıyorum (ikinci okuma kararla çelişiyor); baş mimar onayı / dar kontrol
   değerlendirmesi.
2. **Karma ayın notu**: tek notta birleşik metin ("mahsup fişi güncel değil — Hesaplanan KDV bugünkü kayıtlardan, İndirilecek KDV kesilmiş mahsup fişinden alındı, azalma sonraki
   mahsupta düşülür; mahsubu geri alıp yeniden mahsup edin"); ay "güncel değil" ve "azalan ay" listelerinde yinelenmez. Metin önerisi; değiştirilebilir (kod bir satır).
3. **"İ azaldı" ölçüsü**: zincirdeki ayın İ'si (ayın kendi İ'si + S4 taşıması) fişin saklı İ'sinden küçükse karma sayılır — ayın KENDİ İ'si değişmeyip önceki fişli ayın azalması bu aya
   S4 ile geldiyse ve bu ayın 391'i değiştiyse de karma (İ fişten, azalma sonraki mahsupta — bir kez). Sınaması yok (DOĞRULANMADI — seyrek).

## 9. SONRAKİ SÜRÜME
- Ekran senaryosu C adımı karma ayı satış İPTALİYLE kurar (391 azalır); kararın örneğindeki satış EKLEME ekranda kurulamadı: FIS serisinde Mart satışından sonra Ocak tarihli satış
  numara / tarih sırası kuralıyla reddediliyor (program davranışı, doğru). Satış ekleme birim sınamada (d1 it 1, d3 "ikisi birden").
- Mutant betiğinin "başarısız" sayısı node --test üst düzey `# fail`'dir; ayrıntılı not ok satırları JSON'da.

## 10. DOĞRULANMADI
- Hız (§6). Windows (CI) — yeni test dosyaya dokunmuyor; ana oturum CI'de okur.
- §8.3 (önceki ayın azalması + bu ayın 391 değişimi) — sınama yok.

## 11. DENENMEYEN
- Tam `npm test` (görev gereği ana oturum); `test:kahin-cari` (cari dokunulmadı); `test:guvenilirlik`; eski sürüm verisiyle göç; `test/excel-denetim/ekran-hafta.mjs` (CI dışı); karma
  adımının 1366 × 900 dışındaki ekran boyutları; A kipi (VAT_CARRY_MODE = "ledger") yalnız Z5 mutantıyla.

## 12. BİLİNEN SINIRLAR
- S-M1-3 = C: yalnız 391 değişen / İ artan ayda sayılar bugünkü kayıtlardan; devreden yönde aralık toplamı 391 − 191'den sapabilir (§7 — kullanıcıya sorulmalı).
- Karma ayda defter (360 / 190) fişi değiştirmez: rapor "olması gereken"i gösterir; defter geri al + yeniden mahsupla düzelir (not bunu söyler; onarım sınamaları toplamın aynı kaldığını
  gösterir).

## 13. CI LİSTESİNE EKLENECEK
- `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (küçük turdan; bu turda C adımı eklendi). Birim test `test/kdv-ozeti-karma-251.test.mjs` `npm test` deseniyle koşar.

## 14. KILAVUZ METNİ ÖNERİSİ (son adayda toplu; küçük turun maddesine ek)
- "Mahsup ettiğiniz bir ayda hem alış KDV'sini azaltan hem satış KDV'sini değiştiren kayıt yaparsanız KDV Özeti o ayın satış KDV'sini bugünkü kayıtlardan, indirilecek KDV'sini kesilmiş
  mahsup fişinden alır; azalan indirilecek KDV sonraki ayın mahsubunda düşülür. 'Mahsuptan Sonra Değişen Ay' satırı bu ayı söyler; o ayın ve sonraki ayların mahsubunu geri alıp ayları
  sırayla yeniden mahsup edin."

## 15. COMMIT LİSTESİ (t251-m1k..dal ucu)
- f12c0924 rapor taslağı: nasıl bozulur listesi (koddan önce)
- 5887217f KDV Özeti karma ay (S-M1K-1 = A) + tutarlılık tablosu sınaması + betik yeni-test.sh
- 08b3efd5 ekran senaryosuna karma ay adımı + betik e2e.sh
- 4b67b240 betikler: ön izleme eşitliği, mutantlar, komşular
- 87425a9b rapor taslağı + yalnız 391 devreden yoklaması
- 86232a7c Kanıt: ham çıktılar, ekran görüntüleri
- (son) rapor son hâli (bu belge)

## 16. ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
cd <dal ucu ağacı>   # node_modules bağlantısı gerekli
for tz in UTC Europe/Istanbul; do HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=$tz node --test test/kdv-ozeti-karma-251.test.mjs test/kdv-ozeti-mahsup-sonrasi-251.test.mjs test/kdv-ozeti-zincir-251.test.mjs test/kdv-ozeti-devreden-251.test.mjs; done   # 34/34
# taban kırmızısı: worktree add --detach <ayrı klasör> t251-m1k; test/kdv-ozeti-karma-251.test.mjs + test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs kopyala → 28/34 (6 kırmızı), ekran 14/18
bash docs/kanit/2026-11-27/m1k2-betik/komsu.sh utc <kök> <kanıt klasörü>       # 623/623 (ve ist)
npm run test:kahin-defter                                                        # 187/187, 0 fark
bash docs/kanit/2026-11-27/m1k2-betik/onizleme-esit.sh <çıktı klasörü>           # BİREBİR EVET (taban kopyası /dev/shm/m1k2-kdv/eski, ağaç yolu betikte)
PLAYWRIGHT_BROWSERS_PATH=<pw-1194> HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs   # 18/18
python3 -I docs/kanit/2026-11-27/m1k2-betik/mutant.py <ayrı kopya> <çıktı.json> UTC   # (ve Europe/Istanbul) 34/34
node docs/kanit/2026-11-27/m1k-betik/karma-yoklama.mjs <kök>                     # Ocak 600, Ocak–Şubat 1.300
node docs/kanit/2026-11-27/m1k2-betik/yalniz-391-devreden-yoklama.mjs <kök>      # §7 sayıları
```
Not: `/dev/shm/m1k2-kdv/eski` (worktree — `worktree remove` ile) ve `/dev/shm/m1k2-kdv/mut` (archive kopyası) duruyor; ana oturum işi bitince kaldırabilir.
