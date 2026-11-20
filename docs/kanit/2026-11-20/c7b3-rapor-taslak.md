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
- Taban İstanbul 17.582 / 17.582, 0 fark (taban iki TZ temiz).
- YAPIM AŞAMASI LİSTESİ (kendi kopyamda yeniden üretildi; c7b3-abc-YAPIM-ASAMASI-kendi-kopyam.json, c7b3-abc-yapim-yaz.out): depodaki liste 0 kayıt, yeniden üretilen **2 kayıt** — yukarıdaki d50 KI2 / KI3
  toplam satırları, üretici paketi 'AYRIŞTIRILMADI' ('kural metni paketi göstermiyor'). Adıyla: paketi **Ç7b (S210 = A / S211 = A)** olmalı — ELLE ETİKETLENMEDİ; depodaki liste DEĞİŞMEDİ. Liste BOŞ
  DEĞİL → kâhin bakımı (S210 / S211) yapılmadan Ç7b aday kapısına girmez.

## 7. Ekran (G) — senaryo-c7b-tur3-250 (önceki ajanın yazdığı; c7b3-e2e-*)
- Yeni kod: İstanbul 32 / 32, UTC 32 / 32. Taban: İstanbul 16 geçti / 14 kaldı, UTC 16 / 14 — nedenler beklenen (Sil / Düzenle nedeni İptal Et yolunu söylemiyor; iptal penceresi kartın ne olacağını
  söylemiyor; S15 iptal reddi → 'kart kapalı, tutar 0' / 'bakiye −300'; '08.11 taksiti kesildi (en önce gelen açık)'; S216 adımı; S210 'kart kapalı, tutar 300' (taban: active 900); S217 iletisi).
- Ekran görüntüleri bakıldı: 05 (S210 kapalı kart: Toplam 300, Tahsil Edilen 300, Kalan 0, Geciken 0) ve 06 (S217 reddi pencerede kırmızı: '… kapatılmış ve 1 tahsilatı var; fatura iptal edilemez.
  Önce kartı Yeniden Aç ile açın.').
- DÜŞÜK (gözlem): S217 durumunda İptal Et penceresi reddi ÖNCEDEN söylemiyor — kullanıcı iptal nedenini yazıp İptal Et'e bastıktan sonra 409 iletisi çıkıyor (planCancelText kapalı kartta boş döner;
  cancelBlock'a girmiyor). Daha iyisi: pencere açılırken nedeni göstermek / düğmeyi nedeniyle pasif yapmak. Karar / sonraki tur.

# Devam 3 ajanı (görev metni docs/devir/2.5.0-DEVAM/c7b3-devam3-istem.txt; taban c7b3-devam3 = da458f89 doğrulandı; not defteri scratchpad/c7b3-d4)

## 8. S218 = B kodu (379b07e7) — kanıt c7b3-d4-s218-*, c7b3-d4-mut-*
- Kod: `routes/plans.mjs cutTargets(..., { order: "tail" })` (eski döngünün birebiri: son taksitten geriye, taksit tutarından, ziyaret edilen her taksit) + `cutPlan` / `shrinkPlan` `order` geçirir
  (varsayılan "due" = karar (4)); `routes/invoices.mjs repairOwnCards` kilit aynası ve kesim `order: "tail"`. İade / iptal / silme / trimCovers DEĞİŞMEDİ. Tasarım §16.9.
- Yeni kodda (379b07e7) iki TZ: acilis-onarimi-hiz-250 3 / 3, acilis-onarimi-savunma-250 6 / 6, c7b-tur3-kart-250 9 / 9 (karar (4) testleri yeşil), c7b-tur3-eski-surum-250 5 / 5.
- Kırmızı kanıtı: önceki uçta (da458f89) acilis-onarimi-hiz-250 iki TZ 1 / 3 — 'ikinci koşu: onarılan 0 (beklenen 0), kilitli 4 (beklenen 3)' + eşdeğerlik bölümleri (devam 2'nin c7b3-t2-onarim-*; ileti okundu).
  Eski kodda (c7b3-taban) 3 / 3 (aynı kanıt).
- Karşı mutantlar (yerinde, her biri sonra geri alındı; iki TZ):
  | mutant | acilis-onarimi-hiz-250 | savunma | kart (karar 4) | sonuç |
  |---|---|---|---|---|
  | A: onarımın kesimi + aynası karar (4) yönünde (iki koşu) | 1 / 3 ('kilitli 4 (beklenen 3)' + eşdeğerlik) | 6 / 6 | 9 / 9 | YAKALANDI (4 / 4 koşu) |
  | B: yalnız kilit aynası karar (4) yönünde | 1 / 3 (aynı) | 6 / 6 | 9 / 9 | YAKALANDI |
  | C: yalnız kesim karar (4) yönünde (ayna eski) | 2 / 3 (eşdeğerlik: 'taksitler' / 'faturaDurumlari' / 'cariler' / 'adayKartlar' eski dökümden ayrı) | 6 / 6 | 9 / 9 | YAKALANDI |
  Savunma testi üç mutantta da yeşil — onarım yönünün koruyucusu acilis-onarimi-hiz-250'dir (savunmanın işi kart kesilemezse onarımın yazmaması).

## 9. G2 komşu son kodda (41d11469 — S218 = B dahil) — kanıt c7b3-d4-komsu-*
- Liste: devam 2'nin 52 dosyası (taramayla + elle eklenen açılış onarımı / stok iadesi yolları; onarımın ve plans.mjs küçülmesinin bütün testleri içinde) + açılış onarımının öbür iki testi
  (iade-210-onarim, banka-210-altin) = 54 dosya (c7b3-d4-komsu-liste.txt). UTC 727 / 727, Europe/Istanbul 727 / 727 — kırmızı YOK (önceki uçta tek kırmızı acilis-onarimi-hiz-250 idi; S218 = B ile kapandı).
- Kabul A / C'nin onarım yolundan etkilenmesi: defter kâhini ve muhasebe sürücüsü senaryoları açılış onarımını tetiklemez (onarım yalnız 2.0.24–2.0.26'da paralı iadeyle büyümüş kartta, açılışta
  çalışır; kâhin / sürücü verisi bugünkü kodla üretilir, böyle kart oluşmaz) → ETKİLENMEZ; kabul A / C yeniden koşulmadı. Eski sürüm (v2.4.9) testi c7b-tur3-eski-surum-250 iki TZ 5 / 5 (bölüm 8).

## 10. Kabul E'nin hız BULGUSU ve düzeltmesi (82c4ca0a) — kanıt c7b3-d4-hiz-bulgu-*, c7b3-d4-t2-hiz-*, c7b3-d4-komsu2-*
- Bulgu: devam 2 ajanının commit'siz bıraktığı kilitsiz ölçüm (scratchpad/c7b3-d3/hiz/hiz-kilitsiz.txt, da458f89 ↔ c7b3-taban; yük ≤ 1,4 — GEÇERLİ; c7b3-d4-hiz-bulgu-*) KÖTÜLEŞEN
  yollar gösterdi: fatura kartı 91 → 144, satış yazımı 171 → 229, tahsilatsız taksitli fatura iptali 102 → 322, kapsayan kartlı caride iptal 91 → 284, silme 105 → 310, Geciken listesi
  552 → 1.291 ms (en iyi).
- Tanı (ana kopyada, aynı veri, yazımdan önce / sonra tek tek; c7b3-d4-hiz-bulgu-tani-1.txt — yük 2–4, yalnız TANI): Geciken listesi YAZIMDAN ÖNCE iki kodda aynı (taban ~870–910, yeni
  ~810–1.070) → ölçümdeki fark kod değil VERİ ayrışması (yeni kodda döngünün iptalleri kartları kapatıp küçültüyor). Satış yazımı / fatura kartı / iptal ise gerçekten yavaş. CPU profili
  (c7b3-d4-hiz-bulgu-prof.txt): `coverCancelText` → `coverState` → `settledFor` (~104 ms / çağrı; satış yanıtı ve fatura kartı), iptalde `coverState` (~107 ms) + `trimCovers` (~229 ms,
  kuyruklu `accounts.detail`).
- Düzeltme (davranış AYNEN; tasarım §16.10): kapsam okuması yalnız faturadan SONRA (ya da aynı anda) açılmış etkin Mevcut Borç kartı varken (karttan sonra doğan borç kapsanmaz —
  lib/invoice-settle.mjs born <= plan.at); trimCovers defteri withRemaining: false ile okur.
- Yeni test test/c7b-tur3-hiz-250: yeni kodda iki TZ 3 / 3; eski kodda (4b568420, ayrı kopya) iki TZ 2 / 3 — beklenen nedenle: fatura kartı iki defter okuması
  [{withRemaining:false},{withRemaining:false}], iptal iki okuma biri kuyruklu [{false},{true}]. Eşdeğerlik sınamaları (kapsam kuralı; trimCovers girdisi her caride iki yolda aynı) eski kodda
  da yeşil (özellik testi).
- G2 komşu (55 dosya: 54 + yeni test) son kodda iki TZ 730 / 730.

## 11. Son kodda (7645fe0d = S218 + hız düzeltmesi) kâhinler, sürücü ve ekran senaryosu — kanıt c7b3-d4-abc-*, c7b3-d4-e2e-*
- Kabul A (defter kâhini) iki TZ 187 / 187, 0 fark, 0 yakalanmayan mutasyon (önceki uçla aynı).
- Kabul B (cari kâhini) iki TZ 17.580 / 17.582 — AYNI iki fark (d50 KI2 / KI3 toplam: S210 = A / S211 = A — cari kâhini bakımı bekliyor; bölüm 6). Yeni fark YOK. Yapım aşaması listesi
  yeniden üretilmedi (farklar bölüm 6'dakiyle birebir aynı; liste o farklardan üretilir — devam 2'nin kendi kopyasındaki 2 kayıt geçerli).
- Kabul C (muhasebe sürücüsü, DEĞİŞTİRİLMEDİ) yeni: 7.770 denetim, 7.568 geçti, 62 başarısız — sınıf dağılımı (AYNI 7.052 · U 516 · P 34 · K 0 · R 28 · SINIFLANMADI 0) önceki
  yeni koşuyla (7b6ec843, bölüm 4) satır satır AYNI (sınıf listesi farkı 0 satır).
- G: senaryo-c7b-tur3-250 yeni kodda UTC 32 / 32, Europe/Istanbul 32 / 32 (S206 / S210 iptal penceresi notu — kapsamdaki fatura — aynen; kapsamda olmayanın notu kartı anmaz).

## 12. Kabul E — hız KİLİTSİZ (son kod 6fccbf94 ↔ c7b3-taban; ÖZEL kilit 08:56; 4 blok, her blok taze 100 bin kopya, 5 tekrar; GEÇERSİZ blok 0, blok başı yük 1,05–1,44) — kanıt c7b3-d4-hiz-kilitsiz-*
Ölçüm betiğine devam 3 eki: 'Geciken listesi — yazımdan önce' (aynı veride iki kod). Tablo c7b3-d4-hiz-kilitsiz-tablo-kilitsiz.md. Hız düzeltmesinden ÖNCEKİ (da458f89) ölçümle karşılaştırma:
| yol | taban en iyi / ortanca | da458f89 (düzeltme öncesi) | 6fccbf94 en iyi / ortanca | hüküm |
|---|---|---|---|---|
| Fatura kartı (İptal Et notu) | 126,7 / 131,1 | ×1,58 | 128,1 / 133,2 | tamam (1,02) |
| Satış yazımı (taksitli) | 240,5 / 253,5 | ×1,30 | 245,5 / 261,7 | tamam (1,03) |
| Satış (kapsayan kartlı cari) | 198,4 / 208,6 | ×1,45 | 204,8 / 221,3 | tamam (1,06) |
| İade (kart küçülmesi) | 740,8 / 773,1 | 0,95 | 524,0 / 543,7 | tamam (0,70) |
| Faturasız stok iadesi (trimCovers) | 280,6 / 285,2 | 0,96 | 101,4 / 103,6 | tamam (0,36) |
| Fatura iptali (taksitli, tahsilatsız) | 134,1 / 143,0 | ×3,26 | 163,5 / 176,7 | KÖTÜLEŞEN (+~30 ms; 1,24) |
| Fatura iptali (kapsayan kartlı cari) | 126,6 / 133,8 | ×3,21 | 154,5 / 158,8 | KÖTÜLEŞEN (+~28 ms; 1,19) |
| Fatura silme (kapsayan kartlı cari) | 155,6 / 159,2 | ×2,85 | 181,2 / 188,4 | KÖTÜLEŞEN (+~26 ms; 1,18) |
| Geciken listesi — yazımdan ÖNCE | 780,2 / 892,1 | — | 797,5 / 854,6 | tamam (0,96) |
| Geciken listesi — döngünün yazımlarından SONRA | 780,4 / 848,3 | ×2,40 | 1.812,2 / 1.878,6 | KÖTÜLEŞEN (veri ayrışması mı — bölüm 13) |
| Cari kartı, kapsayan kartlı cari kartı, Mizan, Mutabakat Testi, taksit tahsilatı | — | tamam | oran 0,89–0,99 | tamam |
| S15 iptali (tabanda 409) | 41,1 (409) | — | 164,2 / 172,6 (200) | KARŞILAŞTIRILMAZ (durum farklı) |
- Kalan iptal / silme farkı (+26–30 ms): iptalin kart yolu `settleCoverOnCancel` → `trimCovers` (kuyruksuz `accounts.detail`, ~25–30 ms; S206 / S211 ailesinin 'borçtan büyük kalan kart küçülür, borcu kalmayan kapanır' kuralının okuması — carinin bakiyesi ve kart kalanları gerekir). Taban bu kuralı hiç uygulamıyordu.
