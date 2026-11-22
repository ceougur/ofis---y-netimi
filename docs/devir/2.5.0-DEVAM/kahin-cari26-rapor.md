# Cari kâhini bakımı 26: rapor

**Dal:** `worktree-agent-aba92b2d7bf349903`, uç **`edd5f828`**. Taban `izt2-sinama` = 3b420085. Push yapılmadı. Program kodunu okumadım.

**Özet:** Kâhinin 2.5.0 kural seti bu kararlarla güncellendi. Program iki saat diliminde de kâhinle yalnız 1 noktada ayrışıyor (aşağıdaki P-1); bu kayıt kâhinin bakım 24 kuralıyla programın okuması arasındaki fark. Yapım aşaması listesi 4 kayıttan 0'a indi.

**Açıkça (kural ihlali):** Ana oturumun özel ölçüm kilidi sürerken üç kısa python koşusunu (d56–d58 elle karşılaştırması ve hızlı mutant denetimi, toplam yaklaşık 1 dk) kilitsiz yaptım. O sırada süren ölçümü etkilemiş olabilir. Sonraki bütün koşular `flock -s` ile yapıldı.

## Denetimler (kural ve girdinin satırı)
| Konu | Ne yapıldı | Dayanak |
|---|---|---|
| Kendi kartında artırma (açık kart) | Kendi kartı Düzenle'nin planıyla, aynı taksit sayısı ve ilk vadeyle yeni tutarda yeniden kurulur. Eski kol (artış ayrı açık) kalktı. S242 = A yalnız Mevcut Borç kartında kaldı. | §1 S246 = B + KAPSAM |
| Kendi kartında artırma (kapanmış, tahsilatsız kart) | Kart AÇIK kurulur. | §1 S235 = B |
| Ödemeli açık kartta artırma | Değer yazılıyor: ödeme tek kuyrukta kalıyor. Bu benim okumam (Y26-3), program da böyle davranıyor. | Okuma — baş mimar görsün |
| Kendi kartında azaltma — ödemeli | SUS. Bakım 25'in d57 K3 kolu susturuldu. | §2 |
| Kendi kartında azaltma — kapanmış, tahsilatsız | SUS: S235 = B ile bakım 24'ün "iade gibi küçülür" kuralı (§36 KAPSAM (e)) farklı sayı veriyor. | Okuma (Y26-5 (b)) |
| Kendi kartında azaltma — açık, tahsilatsız | §36 KAPSAM (b) + (e) ile değer yazılıyor (vadesi en önce gelen taksitten küçülür). Program farklı okuyor → P-1. | §36 |
| Elle kart hangi faturayı alır | SK-45 SUS kalktı; kart en eski faturayı taşır. Elle borçlu S200 kolunda da uygulandı. | §3 S243 = A + KAPSAM |
| S244 (SK-46) | SUS aynen; neden metnine karar numarası eklendi. | §4 |
| S245 (SK-47) | SUS genişletildi: her art arda Düzenle ve yeniden kurulmuş kendi kartına iade; kartın göstergeleri de yazılmaz. | §4 |
| S247 / S248 | Kâhinin dilinde karşılığı yok (taksiti elle değiştirme / silme adımı yok; Düzenle yalnız miktarı değiştiriyor); KARARLAR.md'ye BİLİNEN SINIR diye yazıldı. | §4 |
| Yeni SUS SK-49 (UÇ) | Kapanmış + ödemeli kartta ya da daha önce iade gelmiş faturada artırma: kararda yok. | Kararın söylemediği alt durum |
| Yeni SUS SK-50 (UÇ) | İadesi olan faturanın Düzenle'si: kabul mü ret mi kararda yok; adım iki dünyada (kabul / yok) karşılaştırılıp farklı çıkanlar yazılmaz. İlk program koşusu kâhinin "kabul" varsayımının dayanaksız olduğunu gösterince eklendi (program `invoice-locked` ile reddetti). | Kararın söylemediği alt durum |

## Senaryolar ve öz test
- **Elle tablolar:** karar metinlerinden, kâhin koşulmadan yazıldı (üreteç `docs/kanit/2026-11-22/kahin-cari26-arac/uret-d58.py`).
  - d56 N1 / N2 → S243.
  - d57 K3 → SK-48 SUS; P1 → S246.
  - Yeni d58 (10 cari, 45 adım, bugün 08.10): R1–R4, T1–T3, N3, V1, V2.
- **Açıkça yapılan elle düzeltmeleri (beklenen kural değil):**
  - d56 FN2A `taksitte`: kartın payı iadeyle 0 olduğu için Y23-4 → `false`.
  - d58 IV1 açığı: SUS caride belge açığı yazılmadığı için kaldırıldı.
  - d58'de numaralı belgeler tarih sırasına alındı (Y7-1).
- **Mutantlar:** 348–354 eklendi, hepsi değerle yakalandı (351 / 353 / 354 SUS kuralı mutantı). 347 kaldırıldı (S243 = A ile kuralın kendisi oldu). 342 artık yalnız Mevcut Borç kartında.
- **Öz test:** 8.642/8.642, UTC ve İstanbul.
- **G3 (eski ↔ yeni kâhin):** 660/660, beklenmeyen değişiklik 0. Fark 181: S243 112, S246 10, SK-48/49 25, SK-50 15, SK-47 16, S234 3; yalnız d56 / d57 / d58'de. Eski kural setleri 528/528 bayt bayt aynı; döküm iki saat diliminde aynı.

## Program ↔ kâhin (taban programı, `npm run test:kahin-cari` düzeni)
| Koşu | UTC | İstanbul | Fark |
|---|---|---|---|
| Depodaki 4 kayıtlı listeyle | 24.349/24.354 | aynı | 4 "yapım aşaması kapandı" + P-1 |
| Yeni boş listeyle | 24.353/24.354 | aynı | yalnız P-1 |

- Yakalanmayan mutasyon 0; atlanan 12 senaryo eski kurallarla geçersiz olanlar.
- Program ↔ eski kâhin (d56–d58): 1.436/1.459.

## Yapım aşaması listesi: 4 → 0
- **Kapanan 4:** d57 P1 gecikmiş, FP1 toplam, FP1 kalan (S246 = B ile kâhin programla aynı); FK3 toplam (SK-48 SUS).
- **Yeni / değişen:** yok.
- Yeniden üretimde çıkan tek kayıt (d58 T3 gecikmiş, aracın verdiği etiket 'Ç5-B tur 2') programın henüz yapmadığı bir kısım değil, program şüphesi; bu yüzden listeye alınmadı. Liste ayrı commit'te: `1d6e82a3`.

## Eski kâhin kırmızısı
- Toplam 102/770 elle denetim kırmızı, kırmızılık nedeni okundu. Kural kural:
  - S243 42 (eski kâhinde SK-45 SUS)
  - S246 6
  - S235 4
  - SK-48 19
  - SK-49 8
  - SK-50 6
  - SK-47 11
  - T3'ün kendi kart satırları 3
- Kırmızısı olmayanlar: S244 (kural değişmedi), S247 / S248 (senaryo yok).

## P (program şüphesi) — kâhin programa uydurulmadı
- **P-1:** d58 T3 — fatura 900 (3 × 300; 05.10 / 05.11 / 05.12), tahsilat yok, kart açık; Düzenle 3 → 2 adet (600), bugün 08.10.
  - Kâhin: taksitler 0 / 300 / 300 → gecikmiş **0**.
  - Program: gecikmiş **200** (3 × 200 yeniden kurulmuş okumasıyla uyumlu).
  - Kart 600 / Kalan 600 / bakiye 600 iki tarafta aynı.
  - Hangisinin girdiye uymadığı: kâhinin tarafı §36 KAPSAM (e)'de açıkça yazılı, programınki S246 = B'nin gerekçesine (Düzenle'nin ödeme planı) uyuyor. Karar SK-48'in (c) kolu olarak kullanıcıya.

## KULLANICIYA SORULMALI
1. **SK-48 — kendi kartında Düzenle ile azaltma (para kuralı, ders 43; uç durum değil).** Örnek: fatura 900, kart 3 × 300, tahsilat 600, Düzenle 900 → 300.
   - **A:** kart Düzenle'nin planıyla yeniden kurulur: kart **300** (3 × 100), Tahsil Edilen 300, Kalan 0, avans **300**, bakiye **−300**.
   - **B (öneri):** iade gibi küçülür (S241 = A ve §36 KAPSAM (e)): kart **600** (300 / 300 / 0), Tahsil Edilen 600, Kalan 0, avans **300**, bakiye **−300**.
   - Bakiye ve avans iki seçenekte aynı; değişen kart tutarı, Tahsil Edilen ve taksit satırları (kısmi azaltmada gecikmiş de).
   - Alt kollar: (b) kapanmış tahsilatsız kart; (c) açık tahsilatsız kart → P-1 (B ile gecikmiş 0, A ile 200).
   - Gözlem (kural kaynağı değil): program bütün kollarda A gibi davranıyor (K3 kart 300, T2 kartı açık, T3 3 × 200). Öneriyi yine B tuttum, çünkü §36'nın yazılı kuralıyla tutarlı olan B.
   - Yaygın programlarda: doğrulanmış kaynak okunmadı.
2. **SK-49 (uç) — kapanmış + ödemeli kartta ya da iadeli faturada artırma.**
   - A: S246 aynen (kart yeni tutarla açık kurulur).
   - B: kapanış korunur / kart iade düşülmüş tutarla kurulur.
   - **C (öneri): Uç durum böyle kalsın (BİLİNEN SINIR).**
   - Bakiye her seçenekte aynı. Gözlem: program R3'te A gibi (kart 900 / Kalan 800, açık). Yaygın programlarda: okunmadı.
3. **SK-50 (uç) — iadesi olan faturanın Düzenle'si.**
   - **A (öneri):** reddedilir, "önce iadeleri iptal edin" (programın bugünkü davranışı). Bu, SK-49'un iadeli kolunu kendiliğinden kapatır.
   - B: kabul edilir, kart / iade yeniden hesaplanır.
   - C: Uç durum böyle kalsın (BİLİNEN SINIR).
   - Bakiye A'da Düzenle'siz, B'de Düzenle'li tutarla. Yaygın programlarda: okunmadı.

**Baş mimarın görmesi gereken okumalar:** Y26-3 (ödemeli kartta artırma), Y26-5 (b) (iki kararın çatışması), Y26-6 (S243'ün elle borçlu kolu), Y26-7 (S245 susmasında kart göstergeleri), FN2A `taksitte` = `false`.

## SONRAKİ SÜRÜME (2.5.1)
- S244'ün "kart Kalan'ı her seçenekte aynı" kolunun değerle denetimi.
- Rastgele üreticiye Düzenle / Kartı Kapat / iade + Düzenle adımları.
- Öz testin mutantı kuralın kendi senaryosunda yakalamayı zorlamaması.
- `kos.sh` adımının, özel ölçüm kilidi 1 saati aşınca `flock -w 3600` ile düşmesi: ilk koşu böyle düştü, yeniden koşuldu.

## DENENMEYEN
- Düzenle penceresindeki "kart yeniden açılacak" uyarısı (API'den okunmuyor; ekran yürüyüşüne kalır).
- Kapanış gününün ertesindeki gecikmiş: kapanış her zaman senaryonun bugünü olduğundan gözlenemiyor.
- S247 / S248 için dilde adım yok; S244 için yeni senaryo yok.
- Kendi kartına kart seçilerek Taksit Tahsilatı: dilde yok.
- Rastgele senaryolarda Düzenle yok.

## Değişen yollar
- `test/bagimsiz/cari/`: KARARLAR.md (§38), model.py, oz-test.py, YAPIM-ASAMASI.json, `senaryolar/` (d56, d57, yeni d58).
- `docs/kanit/2026-11-22/kahin-cari26-arac/` (araçlar), `docs/kanit/2026-11-22/kahin-cari26-kanit/` (ham çıktılar), `docs/kanit/2026-11-22/kahin-cari26-rapor-taslak.md`.

## Commit'ler
| Commit | İçerik |
|---|---|
| 1ced09e9 | §38 yorum |
| 8d33f6ab | Elle tablolar (koddan önce) |
| c0ddfd01 | Kural kodu |
| 8de6e4c5 | S245 / mutant 353 |
| f7204b18 | Araçlar |
| 225dcb3d | (ii) değişmezi / Y7-1 sırası |
| 19cef3d5 | N3 sırası |
| 9320049d | SK-50 / mutant 354 |
| 120c7796 | G3 aracına SK50 sınıfı |
| 1d6e82a3 | Liste 4 → 0 |
| 4ea4c31b | KARARLAR sonuç bölümü |
| edd5f828 | Kanıt |

## Ana oturumun yeniden koşacağı komutlar
Hepsi ağaç kökünden (`/home/user/ofis---y-netimi/.claude/worktrees/agent-aba92b2d7bf349903`), `flock -s` içinde:
- `bash docs/kanit/2026-11-22/kahin-cari26-arac/kos.sh utc temel` ve `ist temel` — öz test, G3, elle fark, yeni elle, eski kâhin kırmızısı. Eski kopya: `scratchpad/kc26-aba/eski` = `git archive izt2-sinama test/bagimsiz/cari`.
- `kos.sh utc program`, `kos.sh ist program` — program ↔ kâhin.
- `kos.sh utc program-eski` — program ↔ eski kâhin.
- `kos.sh utc yapim` — liste kendi kopyada yeniden üretilir.
- `python3 -I -B test/bagimsiz/cari/oz-test.py`.
- Elle tablolar kâhinden bağımsız yeniden üretilebilir: `python3 -I docs/kanit/2026-11-22/kahin-cari26-arac/uret-d58.py test/bagimsiz/cari/senaryolar` (çıktı depodakiyle aynı olmalı).

**Ortam (son okuma):** yük ~1,1 / 4 çekirdek, disk boş 7,6 GB.