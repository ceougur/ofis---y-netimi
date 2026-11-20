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

## 5. G2 komşu — BULGU (ORTA): test/acilis-onarimi-hiz-250 son kodda KIRMIZI (iki TZ), tabanda YEŞİL (c7b3-komsu-*, c7b3-t2-onarim-*)
- Komşu listesi: önceki ajanın taraması (komsu.py, 44 dosya) + elle eklenen 8 (stok iadesi trimCovers yolu: c7b-eski-surum-sinif-250, defter-kaynak-iz-250, mutabakat-213, tyk-birlesik8-iade-250; açılış
  onarımı cutTargets yolu: acilis-onarimi-hiz-250, donmus-defter-tur3-250, donmus-defter-tur4-250; yazım düzeni) = 52 dosya. **Önceki taramanın deseni açılış onarımının testlerini yakalamıyordu**
  (acilis-onarimi-hiz-250 listede yoktu; savunma testi 'shrinkPlan' sözüyle girmişti).
- UTC: 716 sınama, 714 geçti, 2 kırmızı — YALNIZ acilis-onarimi-hiz-250: (1) 'ikinci koşu: onarılan 0 (beklenen 0), kilitli 4 (beklenen 3)'; (2) eşdeğerlik: repair / izler / kartlar / taksitler /
  faturaDurumlari / cariler / adayKartlar bölümleri eski dökümden ayrı. Tabanda (b85d9e27) iki TZ 3 / 3; yeni kodda iki TZ 1 / 3.
- KÖK NEDEN (yeniden üretildi; ders 6): mutant 1 (cutTargets'ı eski yöne — sondan — çevir) uygulanınca test yeni kodda 3 / 3 YEŞİL → fark karar (4)'ün küçülme yönünün açılış onarımına
  (shrinkPlan + kilit aynası cutTargets — (6) KABUL) girmesinden. Örnek (onarim-fark.mjs; v2.0.26 gerçek kodu fikstürü, bugün 06.11.2026, kilit 07.10.2026): FIS2026000000047'nin kartı
  kalan 1.300, hedef 1.250, taksitler 19.09.2026 666,66 · 19.10.2026 683,34. Eski kod 50'yi SON taksitten (19.10 — açık dönem) keserek ONARIYORDU (1.300 → 1.250); yeni kod 50'yi en önce gelen açık
  taksitten (19.09 — KİLİTLİ dönem) keseceği için onarmıyor, kartı 'kilitli' listesine koyuyor → kart 50 TL büyük kalır (cari bakiyesi değişmez; kartın kalanı / gecikmişi 50 fazla).
- Etki alanı: yalnız 2.0.24–2.0.26 kuralıyla yanlış büyümüş ve 2.1.0+ hiç açılmamış (onarımı hiç koşmamış) veri, ve küçülecek ilk açık taksiti kilitli dönemde olan kart. UÇ DURUM.
- KULLANICIYA SORULMALI (para / kart kuralı — ders 43): A) açılış onarımı karar (4) sırasıyla keser ama KİLİTLİ dönemdeki taksiti atlar (ilk açık ve kilitsiz taksitten) — kart onarılır;
  B) açılış onarımı eski yönde (sondan) keser — 2.1.0'dan beri bütün kurulumların aldığı onarımla aynı (davranış aynen); C) Uç durum böyle kalsın (BİLİNEN SINIR) — kart 'kilitli' listesinde kalır,
  kilit açılınca sonraki açılışta onarılır; testin beklentisi BİLEREK değişir (kilitli 4, onarılan 25). Yaygın programlarda: doğrulanmış kaynak okunmadı (dayanak yazılmadı). ÖNERİ: B — onarım eski bir
  hatayı geri alır; 2.1.0+ açılmış her kurulum bu kartları zaten eski yönle onardı, 2.5.0'da yalnız gecikmiş kurulumun farklı sonuç alması tutarsız olur; karar (4) yeni küçülmeler içindir.
  (Bu ajan kodu ve testi DEĞİŞTİRMEDİ — karar gerekiyor; kırmızı açık.)
- İstanbul: 716 sınama, 714 geçti, 2 kırmızı — aynı tek dosya (acilis-onarimi-hiz-250), aynı iki alt sınama. Öbür 51 dosya iki TZ yeşil.
- Ek komşu (taramayla bulunan, açılış onarımının öbür testleri): iade-210-onarim yeni 5 / 5 iki TZ, taban 5 / 5; banka-210-altin yeni 6 / 6 iki TZ, taban 6 / 6 (c7b3-t3-komsu2-*).

## 6. Kabul B — cari kâhini (c7b3-abc-*)
- Taban (b85d9e27): UTC 17.582 / 17.582, 0 fark; İstanbul (sürüyor — aşağıda).
- Yeni (7b6ec843): UTC 17.580 / 17.582, İstanbul 17.580 / 17.582 — AYNI 2 fark (d42'nin 13 farkı 7b6ec843 ile kapandı; önceki uçta 15 idi):
  d50-c5-s206-s25c-b1-iptal-havale `k1:kart:KI2:toplam` program 30000 · kâhin 90000 ve `k1:kart:KI3:toplam` program 0 · kâhin 90000 ('B1.3 kart tutarı = tablodaki kalan'; SINIF DIŞI).
  KARARLA AÇIKLAMA: KI2 = I2 'İpek Çok Kalemli' (elle Borç 400 + FI2 500 → Mevcut Borç kartı 900, kart tahsilatı 300, FI2 İptal Et) → **S210 = A** (D 20.11 04:15 (3): kart KAPANIR, elle borç kendi
  vadesiyle, tahsilat avans) — program kartı kapatıp tutarı net tahsilata (300) indiriyor; kâhinin kart tutarı denetimi hâlâ 900 (açık kart) bekliyor. KI3 = I3 'İsmet Tahsilatsız' (FI3 900 → kart 900,
  tahsilatsız, FI3 İptal Et) → **S211 = A** (iş listesi C 19.11 23:18: 'kart kapanır') — program kapatıp tutarı 0'a indiriyor; kâhin 900 bekliyor. Kâhin senaryosu bu iki kartı SK-41 (a) / (b)
  'sınırı SUS' diye işaretlemiş (elleYok: odenen / kalan; elleBelirsiz 'cari I2 / I3 tanımsız'), ama kart TOPLAMI denetimi susturulmamış → **S210 = A / S211 = A — cari kâhini bakımı bekliyor**
  (kâhin klasörüne DOKUNULMADI). Bakiye denetimleri (I2 100, I3 0) program = kâhin.
