# Ç7b tur 3 — devam 2 ajanının rapor taslağı (adım adım büyür)

Görev metni: docs/devir/2.5.0-DEVAM/c7b3-devam2-istem.txt (+ c7b3-istem.txt, c7b3-devam-istem.txt). Taban `c7b3-devam2` = 7b6ec843 (doğrulandı). ESKİ KOD `c7b3-taban` = b85d9e27
(önceki ajanın kopyası scratchpad/c7b3-d2/taban — YALNIZ OKUNDU; yeni testlerin dosyaları orada HEAD'dekiyle bayt bayt aynı, kopyalama yapılmadı). Not defteri scratchpad/c7b3-d3.
Bu ajan ÜRÜN KODUNA DOKUNMADI (yapılmış işler önceki ajanların; burada son kodda kabul A–G baştan).

## 1. Turun testleri son kodda (7b6ec843), iki TZ + taban kırmızısı — kanıt c7b3-t1-*

| Test | yeni UTC | yeni İstanbul | taban UTC | taban İstanbul | tabandaki kırmızının nedeni (ileti okundu) |
|---|---|---|---|---|---|
| c7b-tur3-kart-250 | 9 / 9 | 9 / 9 | 1 / 9 (8 kırmızı) | 1 / 9 | (4) '06.11 kesilir (en önce gelen açık), 06.12 kalır' — taban sondan keser; faturasız iade '01.07'den küçülme; S216 'iade: karar (4) — 06.11 kesildi' adımı; S15 İptal Et 409 plan-has-payments; S206 / S210 'kart kapalı, tutar = tahsilat'; S217 iletisi; trim 'kart 400 küçüldü (tutar 0) ve kapandı'. Geçen 1 test: 'iade kalanı aşarsa fazlası avans; parası geri verilen iade kartı küçültmez' (davranış değişmedi — beklenen) |
| c7b-tur3-eski-surum-250 (v2.4.9 gerçek kodu) | 5 / 5 | 5 / 5 | 2 / 5 | 2 / 5 | S15 iptal 409; S210 'kart kapalı, tutar = tahsilat'; S217 iletisi regex eşleşmedi. Geçen 2: üreticinin doğruluğu + güncellemeden sonra aynen (beklenen) |
| ertelenen-224 (beklenti bilerek değişti) | 35 / 35 | 35 / 35 | — | — | tabanda test dosyası farklı (eski beklenti) — koşulmadı |
| obligation-input-250 (beklenti bilerek değişti) | 2 / 2 | 2 / 2 | — | — | aynı |
| tyk-birlesik8-ekranlar-250 (beklenti bilerek değişti) | 12 / 12 | 12 / 12 | — | — | aynı |

## 2. Kabul A — defter kâhini (c7b3-abc-*)
`npm run test:kahin-defter`: taban (b85d9e27) UTC 187 / 187, İstanbul 187 / 187; yeni (7b6ec843) UTC 187 / 187, İstanbul 187 / 187 — 0 fark, 0 yakalanmayan mutasyon. Kırmızıya dönen denetim YOK.

## 3. Mutantlar (değerle; tek git worktree kopyası, her mutantta server/routes geri alınıp tek mutant; kart testi + eski sürüm testi (v2.4.9 gerçek kodu), iki TZ, İKİ koşu — c7b3-mut-*, c7b3-mut2-*)
| # | mutant | kart testi (iki TZ × 2 koşu) | eski sürüm testi | sonuç |
|---|---|---|---|---|
| 1 | küçülme son taksitten (eski yön) | 6 / 9 (3 kırmızı: '06.11 kesilir…', '01.07', 'iade: karar (4) — 06.11') | 5 / 5 | YAKALANDI |
| 2 | küçülme ödenmiş kısmı da keser | 6 / 9 | 5 / 5 | YAKALANDI |
| 3 | S15 iptali yine reddedilir | 7 / 9 | 3 / 5 | YAKALANDI |
| 4 | iptalde kartın tahsilatı silinir | 7 / 9 ('tahsilat carinin avansı') | 2 / 5 | YAKALANDI |
| 5 | kart küçültülmeden kapanır (kalan düşülür) | 6 / 9 | 2 / 5 | YAKALANDI |
| 6 | önceden kapatılmış tahsilatlı kartın faturası iptal edilir | 8 / 9 | 4 / 5 | YAKALANDI |
| 7 | kapsayan kart açık kalır (S206 trim yolu) | 8 / 9 ('kart 400 küçüldü (tutar 0) ve kapandı') | 5 / 5 | YAKALANDI |
| 8 | iptalde kapsayan kart küçülmez / kapanmaz | 6 / 9 | 4 / 5 | YAKALANDI |
Her mutant dört koşunun dördünde aynı sayıyla kırmızı (kararlı).
| 9 | S210: faturayı içine almış çok kalemli kart açık kalır (küçülür) | 8 / 9 ('S210: kart kapalı, tutar = tahsilat') | 4 / 5 | YAKALANDI |
| 10 | S210: kart payları iptalden önce okunmaz | 8 / 9 | 4 / 5 | YAKALANDI |
| 11 | S217: eski ileti | 8 / 9 | 4 / 5 | YAKALANDI |
| 12 | S216: büyüme ilk taksite | 8 / 9 ('iade iptali: 300 SON taksite eklenir') | 5 / 5 | YAKALANDI |
| 13 | S210: iptal penceresi kartın kapanacağını söylemez | 8 / 9 (ERR_ASSERTION — cancelNotice metni) | 5 / 5 | YAKALANDI |
| 14 | S206 / S210: kart kesilmeden kapanır | 7 / 9 | 3 / 5 | YAKALANDI |
| 15 | trimCovers'ta kuyruğun açık kısmı yok sayılır (7b6ec843 öncesi) | 8 / 9 ('küçülme kuyrukta açık kalan en önce gelen taksitten (01.07)') | 5 / 5 | YAKALANDI |
| 16 | cutTargets kuyruktan gelen açık kısmı okumaz | 8 / 9 (aynı) | 5 / 5 | YAKALANDI |
16 / 16 mutant yakalandı; her biri 2 koşu × 2 TZ'de aynı sayıyla kırmızı. Görev metnindeki 'kalanı sil' / 'gecikmeyi kalem vadesinden başlat' mutantları Borçta Kalsın'ındır (tur 3b; bu turda kod yok) — uygulanmadı.

## 4. Kabul C — muhasebe sürücüsü (DEĞİŞTİRİLMEDİ) taban ↔ yeni, aynı anda iki koşu (c7b3-abc-surucu-*; karşılaştırıcı c7b3-abc-surucu-fark.py)
- Taban (b85d9e27): 7.780 denetim, 7.578 geçti, 62 başarısız, 140 atlanan · AYNI 7.054 · U 524 · P 34 · K 0 · R 28 · SINIFLANMADI 0 · ÖLÇÜLEMEDİ 118 · SUSMA 22.
- Yeni (7b6ec843): 7.770 denetim, 7.568 geçti, 62 başarısız, 140 atlanan · AYNI 7.052 · U 516 · P 34 · K 0 · R 28 · SINIFLANMADI 0 · ÖLÇÜLEMEDİ 118 · SUSMA 22.
- Senaryo özetinde değişen YALNIZ s57, s58, s69 (öbür satır farkları yalnız yazılış sırası). Yeni fark 0 (yenide olup tabanda olmayan AYNI-dışı satır yok); SINIFLANMADI 0.
- KALKAN (12 satır = 6 × iki TZ): 'Ç7b-(4)' s57 TK1 kart (program artık kâhinle aynı: 01.03 / 01.04 açık) ve s57 C1 gecikmiş ('Ç5-B1|Ç7b-(4)': 6000 → kâhinle aynı 3000); 'Ç7b (S15 = A)' s58 red 11 (iptal reddi), s69 red 12 (iptal reddi), s69 durum_F1 (artık iptal = kâhin), s69 ak1b açık kalem satırı (artık AYNI). → 'Ç7b-(4)' (s57) ve 'Ç7b (S15 = A)' farklarının HEPSİ KALKTI.
- KALAN 'Ç7b-(4)' kimlikli 2 satır = s58 kt2 TK3 (iki TZ) — NİTELİĞİ DEĞİŞTİ: taban 'Açık 2026-03-01 3000/2000' (sondan küçülme), yeni 'Kapalı' ↔ kâhin 'Açık 2026-04-01 2000/2000'. Bu **S210 = A — kâhin bakımı bekliyor** farkıdır (faturayı içine almış çok kalemli Mevcut Borç kartı iptalde KAPANIR; kâhin karar (4)'ün genel metniyle küçülüp açık kalmayı bekliyor). Sınıflamadaki kimlik ana oturumca güncellenecek.
- s58 ak3 C3 (GÖRÜNÜM-YOK, kâhin tarafı) değişti: kâhin artık iptali de uyguluyor (program reddetmediği için) → 'tahsilat:P2 kalan −3000' (S15: tahsilat avans) — programda okunacak uç yok, sınıf aynı (U GÖRÜNÜM-YOK).
- Denetim sayısının 10 azalması: s58'de 2 / TZ (mizan 600 satırı ve red 11 satırı artık yok — iptal uygulandı), s69'da 3 / TZ (af1b F0, mz C1, red 12 — iptal uygulandı). AYNI → AYNI değer değişenler: s58 g3 C3 gecikmiş 3000 → 0 (program = kâhin), kt3 TK2 Açık → Kapalı (program = kâhin); s69 g1b 6000 → 0, kt1b Kapalı (program = kâhin).
- 'Ç7b-(6)' 12 satır KALDI (Borçta Kalsın — tur 3b; beklenen).
