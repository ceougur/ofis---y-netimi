# M1 KÜÇÜK TUR 4 — KDV Özeti: her 'güncel değil' ayında sonraki aya bu ayın bugünkü devredeni (S-M1K3-1 = A) — RAPOR

Taban `t251-m1k3` (36b77d4b, küçük tur 3'ün dal ucu) → dal ucu: bu raporun son commit'i (dal `worktree-agent-a7d99fd88f55969de`). PUSH YOK. KDV Mahsup Fişi, ön izlemesi ve
defter DEĞİŞMEDİ (kabul B: taban = yeni BİREBİR) — yalnız Rapor Merkezi'nin KDV Özeti görünümü.
Ortam (son okuma): __ORTAM__

## A. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce = taban t251-m1k3 → sonra; Raporlar → Tüm Raporlar → KDV Özeti (Beyanname Hazırlığı); ekran = PDF = Excel)
1. **Sorunun (a) örneği AYNEN** (Mart satış KDV 800 + 200, alış 500 → Mart fişi ödenecek 500; sonra Mart'ın 800'lük satışı İptal Et → Mart bugün sonraki döneme devreden 300; Nisan
   satış KDV 200 → Nisan fişi (defterin 0'ıyla) 200): Mart 0 / 0 / 300 (DEĞİŞMEDİ). Nisan ÖNCE 0 / **200** / 0 → SONRA **300 / 0 / 100** + YENİ not, ekranda okundu AYNEN:
   "Zincirle Uyuşmayan Mahsup Fişi: Nisan 2026 fişi ₺0,00 devredenle kesilmiş, sırayla mahsupta ₺300,00 olmalıydı; fiş ödenecek KDV ₺200,00 yazmış, sırayla mahsupta sonraki
   döneme devreden KDV ₺100,00 çıkar (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)" (API / PDF / Excel'de "0,00 TL" biçimiyle).
   Mart–Nisan ÖNCE 0 / **200** / 0 → SONRA **0 / 0 / 100** (= 391 400 − 191 500); ay satırları Nisan "Ödenecek KDV 200" → "Önceki Dönemden Devreden KDV 300" + "Sonraki Döneme
   Devreden KDV 100". Mart'ın "Mahsuptan Sonra Değişen Ay: Mart 2026 (mahsup fişi güncel değil — …)" notu KALIR. Onarımda fişler 300 devreden / 300'le 100 devreden (toplam aynı).
2. **Sorunun (b) örneği AYNEN** (Mart fişi devreden 800; sonra Mart'a KDV'si 100 olan alış → Mart bugün 900; Nisan satış KDV 1.000 → Nisan fişi 800'le 200): Nisan ÖNCE 800 / 200
   → SONRA **900 / 100** + "Nisan 2026 fişi 800,00 TL devredenle kesilmiş, sırayla mahsupta 900,00 TL olmalıydı (…)"; Mart–Nisan 200 → **100** (= 391 1.200 − 191 1.100).
3. **İ ve 391 birlikte artar** (devreden fiş 800; Mart alış KDV 100 + satış KDV 300 → bugün 600; Nisan fişi 800'le 200): Nisan 800 / 200 → **600 / 400** + not; Mart–Nisan 200 → **400**.
4. **Ödenecek fişli ay İ artışıyla devredene döner** (Mart fişi 500; Mart alış KDV 700 → bugün devreden 200; Nisan satış 200 → fiş 0'la 200): Nisan 0 / 200 → **200 / 0 / 0** +
   "Nisan 2026 fişi 0,00 TL devredenle kesilmiş, sırayla mahsupta 200,00 TL olmalıydı (…)" (iki sonuç da ödenecek yönde — yön cümlesi yok); Mart–Nisan 200 → **0** (391 1.200 − 191 1.200).
5. **İki ardışık 'güncel değil' ay** (Mart fişi devreden 800, Mart İ ve 391 +100 (devreden yine 800); Nisan fişi 800'le ödenecek 700, sonra Nisan'ın 1.000'lik satışı İptal Et → Nisan
   bugün devreden 300; Mayıs fişi 0'la 400): Mayıs 0 / 400 → **300 / 100** + uyuşmazlık notu; Mart–Mayıs 400 → **100** (= 391 1.200 − 191 1.100); "Mahsuptan Sonra Değişen Ay: Mart
   2026, Nisan 2026 (…)".
6. **Yıl dönümü** (aynı (a) / (b) Aralık 2026 → Ocak 2027): Bu Yıl (2027) (a) 0 / 200 / 0 → **300 / 0 / 100** + yön cümleli not; (b) 800 / 200 → **900 / 100** + not; Aralık–Ocak
   (a) 200 → **0 / sonraki 100**, (b) 200 → **100**; 2026 yılı sonraki 300 / 900 (değişmedi).
7. **Mahsupsuz / hareketsiz sonraki ay** (tur 2 zincir testi: Haziran fişi devreden 200, sonra Haziran alış KDV 100 → Haziran bugün 300; Temmuz hareketsiz): Temmuz raporu ÖNCE 200 /
   0 / 200 → SONRA **300 / 0 / 300**; Temmuz ön izlemesi 200 / 0 / 200 (defterdeki 190) DEĞİŞMEDİ — rapor ile ön izleme bu ayda ayrışır (karar (6): mahsupsuz ayda ayrışabilir).
   Haziran–Temmuz 400 / 0 / 300 (değişmedi). Bu, tur 2'nin bir sınamasının beklentisi değişti demektir (§3).
8. **DEĞİŞMEYENLER** (tabanda da yeşil, sınamalı): ödenecek fişli ay ödenecek kalır (391 arttı ya da İ arttı — bugünkü devreden 0 = fişin 0'ı); 'güncel' (kept) ay; yalnız İ azaldı
   (S-DKM1-1 = A — fişin devredeni); karma ay (S-M1K-1 = A); yalnız 391 devreden yönde (S-M1K2-1 = A); S4 taşımalı karma; KDV Mahsup Fişi penceresi, ön izleme, fiş satırları,
   defter (360 / 190); not metinleri (yeni metin YOK — mevcut kalıplar); 6 ay sınırı; A kipi.

## B. DEĞİŞEN DOSYALAR
- `server/routes/tax.mjs` (yalnız `vatView` zincir döngüsü + açıklama; 1 koşul): `only391` (stale ∧ İ aynı ∧ fişin devredeni > 0) yerine
  `recount = kept && (offsetState === "mixed" || offsetState === "stale")`; `next = !kept ? step.carryOut : recount ? settled.carryOutMinor : fişin devredeni`. `settle`, `preview`,
  `monthPosition`, `carriedBefore`, `listOf`, fiş yazımı, A kipi, `report-center.mjs` DEĞİŞMEDİ. Yeni sorgu / döngü YOK.
- Testler: DEĞİŞEN `test/kdv-ozeti-yalniz391-251.test.mjs` (tablonun iki 'sapma sabitlendi' satırı A'ya döndü; `gap` / `fixed` yolu kaldırıldı — her satırda `balanced`; yeni üç
  describe / 6 sınama: İ + 391, ödenecek kalır, ödenecek → devreden (İ), iki ardışık, yıl dönümü (a) ve (b)); DEĞİŞEN `test/kdv-ozeti-zincir-251.test.mjs` (Temmuz beklentisi
  200 → 300; ön izleme 200 aynen); DEĞİŞEN `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (E adımı, üçüncü kurulumda — 26 → 35 denetim; A–D AYNEN).
- Kanıt: `docs/kanit/2026-11-27/m1k4-betik/` (betikler; tur 3'ünkiler AYNEN, yollar bu tura; mutant.py uyarlandı), `m1k4-ham/` (ham çıktılar), `m1k4-ekran/` (görüntüler).
- DOKUNULMADI: istemci, `report-center.mjs`, defter, fiş / ön izleme yazımı, göçler, `.github/**`, `package.json`, `tools/**`, `test/bagimsiz/**`, kılavuz.

## 0. NASIL BOZULUR (koddan ÖNCE, commit 1) → sınama eşlemesi (Y = yalniz391 dosyası; T = tablo; K4 = küçük tur 4 bölümleri)
1 (a) → T "ödenecek → devreden · yalnız 391 azaldı", ekran E, K4 yıl dönümü 001 · 2 (b) → T "devreden · İ arttı", K4 yıl dönümü 002, zincir Temmuz · 3 (c) ikisi birden → K4 "İ + 391
artar" · 4 ödenecek kalır → T "ödenecek · yalnız 391 arttı", K4 "ödenecek kalır" (DEĞİŞMEZ) · 5 güncel / yalnız İ azaldı → T "hiçbiri", "yalnız İ azaldı" + Y6 mutantı · 6 karma → T
"ikisi birden" · 7 araya mahsupsuz ay → Y zincir (tur 3) + zincir Temmuz · 8 yıl dönümü → K4 yıl dönümü · 9 iki ardışık → K4 "iki ardışık" · 10 onarım → her satır / her K4 sınaması
(`repair`) · 11 ön izleme / fiş / ekran = PDF = Excel / iki şirket / iki TZ → kabul B, `sameFiles`, her describe iki şirket · 12 S4 ile İ artışı bir kez → (b), İ + 391, iki ardışık
(hepsi `balanced`).

## TARAMA (ders 10 — `git grep`)
| Değişen | Çağıranlar / okuyanlar | Sınama |
|---|---|---|
| `vatView` zincir döngüsü (tax.mjs) | yalnız `report-center.mjs` KDV Özeti (`tax().vatView()`, tek çağrı) | komşu listesi |
| KDV Özeti özeti (DEĞİŞMEDİ) | ekran, PDF, Excel | `sameFiles`, ekran senaryoları |
| `git grep -l -E "vatView\|offsetState\|kdv-ozeti\|KDV Özeti\|vat-offset\|Mahsuptan Sonra\|Zincirle Uyuşmayan\|Mahsup Edilmemiş\|carryAfterMinor" -- 'test/*.test.mjs'` | 27 dosya; HEPSİ tur 3'ün 51 dosyalık komşu listesinde (yeni test dosyası açılmadı) | kabul C |
| Aynı tarama `test/e2e/*.mjs` | 8 senaryo = kabul D listesi (birebir) | kabul D |

## 3. YENİ / DEĞİŞEN TESTLER — kırmızı nedeni ve yeşil (iki TZ)
KÂHİN ELLE (karar metni + sorunun örnekleri + elle hesap; programın kodundan türetilmedi). Taban: ayrı kopya `/dev/shm/m1k4-kdv/eski` (`git worktree add --detach … t251-m1k3`; içine YALNIZ
değişen üç test dosyası kopyalandı). Koşu `m1k4-betik/yeni-test.sh` (yalniz391 + karma + mahsup-sonrasi + zincir + devreden).
| Koşu | Taban | Yeni |
|---|---|---|
| 5 dosya (55 sınama) UTC | 47/55, **8 kırmızı** | **55/55** |
| aynı, Europe/Istanbul | 47/55, **8 kırmızı** | **55/55** |
| `senaryo-kdv-mahsup-sonrasi-251` | 30/35, **5 kırmızı** (yalnız E adımı) | **35/35** |
Kırmızıların NEDENİ (günlükten okundu — `m1k4-ham/m1k4-yeni-test-taban-utc.log`, ist aynı; hepsinde sonraki ay FİŞİN eski devredenini alıyor, uyuşmazlık notu YOK): T (b) Nisan 800 / 200 / 0
(beklenen 900 / 100); T (a) Nisan 0 / 200 / 0 (beklenen 300 / 0 / 100); İ + 391 Nisan 800 / 200 (600 / 400); ödenecek → devreden (İ) Nisan 0 / 200 (200 / 0); iki ardışık Mayıs 0 / 400
(300 / 100); yıl dönümü (a) Bu Yıl 0 / 200 / 0 (300 / 0 / 100); (b) Bu Yıl 800 / 200 (900 / 100); zincir Temmuz [20000, 0, 20000] (beklenen [30000, 0, 30000]). Ekran tabanı: E adımında
Nisan 0 / 200 / 0, Mart–Nisan 0 / 200 / 0, ay satırları "Nisan Ödenecek KDV 200", Nisan notu YOK (fişler ve Mart notu tabanda da doğru — E'nin 4 denetimi tabanda yeşil). Hepsi BEKLENEN
neden. "Ödenecek kalır (DEĞİŞMEZ)" sınaması tabanda da yeşil — beklenen (sabitleme; dişi Y3b / Y6'da).

## 4. KABUL KOŞULLARI
- **A** §3: yeni / değişen sınamalar tabanda beklenen nedenle kırmızı (8 + ekran 5), yenide yeşil (55/55 iki TZ, ekran 35/35).
- **B** ön izleme / fiş (`m1k4-betik/onizleme-esit.sh` ve `fis-esit-391.sh` = tur 3'ünkiler AYNEN, yalnız yollar; dar kontrol senaryoları A, B, C, E, F, J, L, L2 değiştirilmeden): UTC ve
  İstanbul ön izleme / fiş / geri al / iptal / kilit satırları taban 26 = yeni 26 **BİREBİR EVET**, rapor satırlarında fark **0**; karma yoklaması fiş satırları 3 = 3 **BİREBİR**; kararın
  (S-M1K2-1) örneğinde fiş satırları 2 = 2 **BİREBİR** (iki TZ). Ayrıca her yeni sınamada Nisan / Mayıs ön izlemesi = fiş (DEĞİŞMEDİ) iddiası yeşil.
- **C** komşular (`m1k4-betik/komsu.sh`: tur 3'ün 51 dosyası — yeni dosya yok): UTC **644/644**, İstanbul __CIST__; 0 başarısız / iptal / atlanan (638 → 644: +6 yeni sınama).
  `npm run test:kahin-defter` (dokunmadan): UTC **187/187**, İstanbul __KIST__.
- **D** ekran senaryoları (yeni kod, `m1k4-betik/e2e.sh`): senaryo-kdv-mahsup-sonrasi-251 **35/35**, senaryo-kdv-zincir-251 12/12, senaryo-kdv-devreden-251 14/14, senaryo-kdv-donemi-250
  23/23, senaryo-defter-243 33/33, senaryo-c7b-kabul-250 39/39, senaryo-mobil-247 77/77, senaryo-banka-210 429/429. Beklentisi değişen eski adım YOK (mahsup-sonrasi'ye yalnız E eklendi).
  Görüntüler (baktım): `m1k4-ekran/m1k4-kdv-ozeti-guncel-degil-nisan.png` — özet Hesaplanan 200, İndirilecek 0, Önceki 300, Ödenecek 0, Sonraki 100; "Zincirle Uyuşmayan Mahsup Fişi"
  kartı yukarıdaki metinle tam genişlikte; tablo altı Önceki 300 / Ödenecek 0 / Sonraki 100. `m1k4-kdv-ozeti-guncel-degil-mart-nisan.png` — 391 400, 191 500, 0 / 0 / 100; "Mahsuptan
  Sonra Değişen Ay: Mart 2026 (…)" ve Nisan uyuşmazlık kartı; tabloda "Mart 2026 Sonraki Döneme Devreden KDV ₺300,00".
- **E** mutantlar — §5: __MUT__
- **F** hız: yeni sorgu / döngü YOK (bir koşulun genişlemesi) — **ÖLÇÜLMEDİ** (ders 47 gereği gerekmez; ana oturum isterse `ana-kabul/betik/kabul.sh`).

## 5. MUTANT TABLOSU
__MUTTABLO__

## 7. KULLANICIYA SORULMALI
YOK. Kararın (S-M1K3-1 = A: "her 'güncel değil' ayında sonraki aya BU AYIN (bugünkü) devredeni") söylemediği yeni bir durumda 391 − 191'den sapma görülmedi: bu turun bütün örneklerinde
(tablonun 10 satırı, 6 yeni sınama, tur 1–3'ün testleri) aralık toplamı = 391 − 191 (`balanced` her yerde; tabloda `gap` yolu kaldırıldı).

## 8. BAŞ MİMAR KARARI GEREKİYOR (değerlendir)
1. **Mahsupsuz / hareketsiz sonraki ayda rapor ≠ ön izleme, not yok** (§A.7): 'güncel değil' ayın ardındaki hareketsiz ayın raporu bugünkü devredeni gösterir (Temmuz 300), ön izleme
   ve defter 200 der; yalnız o ayı seçen rapor aralığında 'güncel değil' ay dışarıda kaldığından "Mahsuptan Sonra Değişen Ay" notu ÇIKMAZ (sonraki fişli ayda "Zincirle Uyuşmayan" notu
   çıkar). Bu kararın doğrudan sonucu (tur 3'teki S-M1K2-1 = A ile de aynı durum vardı) ve tur 2'nin karar (6)'sıyla (mahsupsuz ayda ayrışabilir) uyumlu — kodlanmadı, sayılar doğru;
   görünüm ayrıntısı olarak SONRAKİ SÜRÜME önerilir (aralık dışındaki 'güncel değil' ayı da nota yazmak).
2. Tur 2 zincir testinin Temmuz beklentisi değişti (200 → 300): kararın metni ("HER 'güncel değil' ayında") Haziran'ın İ artışını da kapsıyor; ön izleme iddiası (200) AYNEN kaldı.

## 9. SONRAKİ SÜRÜME
- §8.1 görünüm notu.
- Test yardımcılarının (`program`, `balanced`, `repair`) ortak dosyaya alınması (20.11 kuralı; tur 3'ten süren).

## 10. DOĞRULANMADI
- Hız (yeni sorgu yok — ölçülmedi). Windows (CI) — yeni testler dosyaya dokunmuyor (ekran senaryosunun üçüncü kurulumu mkdtemp + rmSync, D adımının kalıbı); ana oturum CI'de okur.

## 11. DENENMEYEN
- Tam `npm test` (ana oturum); `test:kahin-cari` (cari dokunulmadı); `test:guvenilirlik`; eski sürüm verisiyle göç; E adımının 1366 × 900 dışındaki boyutları; A kipi yalnız Z5 mutantıyla;
  6 aydan uzun 'güncel değil' zinciri; üç ardışık 'güncel değil' ay (iki ardışık sınandı).

## 12. BİLİNEN SINIRLAR
- Defter (360 / 190) fişi değiştirmez: rapor "olması gereken"i gösterir; geri al + sırayla yeniden mahsupla düzelir (uyuşmazlık notu söyler; onarım sınamaları toplamın aynı kaldığını gösterir).
- §8.1 (hareketsiz sonraki ayda ayrışma, o ayı seçen aralıkta not yok).

## 13. CI LİSTESİNE EKLENECEK
- `test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs` (küçük tur 2'den; bu turda E adımı). Birim testler `npm test` deseniyle koşar (yeni dosya yok).

## 14. KILAVUZ METNİ ÖNERİSİ (son adayda toplu; küçük turların maddesinin yerine)
- "Mahsup ettiğiniz bir aya sonradan fatura girer, iptal eder ya da alış eklerseniz KDV Özeti o ayı bugünkü kayıtlarla hesaplar ve sonraki aya bu ayın bugünkü devredenini taşır. Sonraki
  ayın mahsup fişi eski devredenle kesildiyse 'Zincirle Uyuşmayan Mahsup Fişi' satırı bunu söyler; o ayın ve sonraki ayların mahsubunu geri alıp ayları sırayla yeniden mahsup edin."

## 15. COMMIT LİSTESİ (t251-m1k3..dal ucu)
__COMMITS__

## 16. ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
cd <dal ucu ağacı>   # node_modules bağlantısı gerekli
for tz in UTC Europe/Istanbul; do HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=$tz node --test test/kdv-ozeti-yalniz391-251.test.mjs test/kdv-ozeti-karma-251.test.mjs test/kdv-ozeti-mahsup-sonrasi-251.test.mjs test/kdv-ozeti-zincir-251.test.mjs test/kdv-ozeti-devreden-251.test.mjs; done   # 55/55
# taban kırmızısı: worktree add --detach <ayrı klasör> t251-m1k3; test/kdv-ozeti-yalniz391-251.test.mjs, test/kdv-ozeti-zincir-251.test.mjs, test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs kopyala → 47/55 (8 kırmızı), ekran 30/35
bash docs/kanit/2026-11-27/m1k4-betik/yeni-test.sh ikisi <dal ucu> <kanıt klasörü>      # taban yolu betikte /dev/shm/m1k4-kdv/eski
bash docs/kanit/2026-11-27/m1k4-betik/komsu.sh utc <kök> <kanıt klasörü>                # (ve ist) 644/644
npm run test:kahin-defter                                                                  # 187/187 (iki TZ)
bash docs/kanit/2026-11-27/m1k4-betik/onizleme-esit.sh <çıktı>; bash docs/kanit/2026-11-27/m1k4-betik/fis-esit-391.sh <çıktı>   # BİREBİR EVET
PLAYWRIGHT_BROWSERS_PATH=<pw-1194> HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/e2e/senaryo-kdv-mahsup-sonrasi-251.mjs   # 35/35
python3 -I docs/kanit/2026-11-27/m1k4-betik/mutant.py <ayrı kopya> <çıktı.json> UTC      # (ve Europe/Istanbul) 40/40
```
Not: `/dev/shm/m1k4-kdv/eski` (worktree — `git worktree remove` ile) ve `/dev/shm/m1k4-kdv/mut` (archive kopyası) __TEMIZLIK__
