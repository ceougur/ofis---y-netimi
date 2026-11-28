# D3 TUR 6 — rapor taslağı (adım adım yazılır)

Taban: t251-d3t6-taban = d183d780 (doğrulandı: `git log --oneline -1` → d183d780 Merge branch 't251-sinama-3').
Görev: ORTA-1 — eski sürümde (2.0.13 öncesi) kapatılmış taksit kartı devir planında 'açık' sayılıyor; okuyucu kartın kapanış gününü programın tanımıyla okusun.

## 0. NASIL BOZULUR (koddan ÖNCE)
Kartın kapanış bilgisinin her biçimi (kapanış günü = programın tanımı `MAX(COALESCE(closed_at, substr(updated_at, 1, 10)), Kayıt Tarihi)`):
1. `closed_at` BOŞ (2.0.13 öncesi kapatılmış; göç 17 geriye doldurmadı) × kapanış (son güncelleme günü) K ÖNCESİ → K'de KAPALI olmalı (bulgu: planda AÇIK, kalan 700).
2. `closed_at` BOŞ × son güncelleme günü = K günü → K'de KAPALI (sınır: `<=` K).
3. `closed_at` BOŞ × son güncelleme günü K SONRASI (kart K'den sonra kapatılmış) → K'de AÇIK, kalan devreder (yedek "tarihsiz" okunursa yanlışlıkla kapalı sayılır).
4. `closed_at` DOLU (2.0.13+) × K öncesi / K günü / K sonrası → bugünkü davranış AYNEN (düzeltme bunu değiştirmemeli).
5. `close_rule` '2.4.9' (kalan silinir — göç 53 eski kapalı kartlara yazar) × Borçta Kalsın (2.5.0+; `closed_at` her zaman dolu) → kalanın carinin borcunda kalıp kalmaması (plan.mjs `kart-kalani`) değişmemeli.
6. Carili × CARİSİZ kart: carisiz kapalı kartın kalanı 127'ye 'cover' edilir; kapalı sayılmazsa 700 beklenir, defterde 0 → sebepsiz 'Hesap Bakiyesi Modülle Tutmuyor' durdurması (dar kontrolün DOĞRULANMADI maddesi). Carisiz kart program API'siyle (v2.0.6'dan beri her kart cariyle açılır; kartı olan cari silinmez) üretilebilir mi — ölçülecek.
7. Kayıt Tarihi kapanış gününden SONRA (kart geriye dönük açılıp eski güncelleme günüyle) → kapanış günü Kayıt Tarihi'ne çekilir (MAX); Kayıt Tarihi > K ise kart planda zaten yok.
8. Faturası iptal edilmiş kapalı kart (program `closed_at = bugün` yazar) ve Borçta Kalsın ile kapanmış kart → `closed_at` dolu, madde 4.
9. Veri kaynağı: v2.0.12 GERÇEK kodu (closed_at sütunu yok), v2.4.9 ve v2.5.0 (closed_at dolu) — eski sürümden gelen veri, sonra yeni kodla açılış (göç).
10. Saat dilimi: `updated_at` UTC anı; program günü `substr(…, 1, 10)` (UTC günü) alır — devir de aynı ifadeyi kullanmalı (iki TZ'de aynı sonuç).
11. Ön izleme sayıları (`sayilar.taksitKarti` açık / kalan / kapalı), Devir Raporu satırları ('n açık (… TL) · m kapalı', 'Kalan n Taksit'), carinin devir satırı ve 127 karşılığı birlikte.

## 1. ÖNCE ÖLÇ (kod değiştirmeden) — TARAMA
Kanıt: `docs/kanit/2026-11-28/d3t6-tarama-*.txt` (`git grep` taban etiketinde ve programda).

Devir modülünde kart kapanış gününü okuyan yer (taban `git grep -n "closed_at" t251-d3t6-taban -- server/lib/devir`): TEK yer —
`server/lib/devir/plan-reader.mjs:186` `COALESCE(p.closed_at, '')` (cardsAt → `closedAtK`; plan.mjs bunu kart durumu / kalan / 'kart-kalani' sınıfı / carisiz 127 karşılığı için okur).
Devirin öbür dosyalarında (plan.mjs, preflight.mjs, report.mjs, iletiler.mjs, archives.mjs, archive-open.mjs, devir-backups.mjs, maintenance.mjs, plan-worker.mjs) kapanış günü okunmuyor
(yalnız `closedAtK` / `durum` tüketiliyor).

Programın kendi tanımı (hepsi AYNI kural: `closed_at`; boşsa `substr(updated_at, 1, 10)`; Kayıt Tarihi'nden önce değil):
| Yer | Ne için | Devirle uyum (taban) |
|---|---|---|
| server/lib/accounts.mjs:32 `closeDaySql` | 689'un ve S205'in günü (SQL; tek yardımcı) | UYUMSUZ (devir yedeği yok) |
| server/lib/accounts.mjs:46 `closeDayOfPlan` | JS ikizi | UYUMSUZ |
| server/lib/accounts.mjs:173 | cari ekstresi 'Kart kapatıldı' satırının günü | UYUMSUZ |
| server/routes/ledger.mjs:152 + server/lib/general-ledger.mjs:584 | genel defter 689 maddesinin günü (`closedOn > date ? closedOn : date`) | UYUMSUZ |
| server/lib/integrity.mjs:186, :311 | mutabakat / kilit izi | UYUMSUZ |
| server/lib/bank/doubtful.mjs:116 | şüpheli yükleyicisinin kapanış satırı | UYUMSUZ |
| server/routes/plans.mjs:856 `closeDayOf` | kilitli dönemde kartın yeniden açılması | UYUMSUZ |
| server/lib/integrity-scope.mjs:408, :421 | kilit kapsamı | UYUMSUZ |
| server/lib/ledger-rule-249/ledger-rows.mjs:87 | 2.4.9 kuralı (kural farkı) | UYUMSUZ |
Not: JS kolları (`closedAt || updatedAt`) boş metni de "yok" sayar, SQL `COALESCE` yalnız NULL'u; program `closed_at`'a yalnız `today()` ya da NULL yazar (plans.mjs:989, :1965; göç 17 sütunu
NULL ile ekler) → iki kol eşdeğer.

Taban kodda ölçüm (yeni kalıcı test, taban kopyasında; §3): v2.0.12'de 25.06.2026 ve 31.12.2026'da kapatılan kartlar planda AÇIK, kalan 700 (Devir Raporu '5 açık (3.500,00 TL) · 0 kapalı',
üç 'Kalan 0 Taksit — 700,00 TL' satırı). DOĞRULANMADI maddesi ÜRETİLDİ: carisiz kapalı kartta plan sorunu `modul-farki` 127 `plan:<kart>` beklenen 0 / bulunan 70.000 kuruş → ön denetim
'Hesap Bakiyesi Modülle Tutmuyor' DURDURUR (genel defterde 127 = 0).

## 2. DÜZELTME (commit 0b84ea49)
`server/lib/devir/plan-reader.mjs` cardsAt: kapanış günü `COALESCE(p.closed_at, '')` yerine programın tek yardımcısı `closeDaySql("p")` (lib/accounts.mjs; içe aktarılır, kopyalanmaz) —
`MAX(COALESCE(closed_at, substr(updated_at, 1, 10)), Kayıt Tarihi)`. Sütunu eksik (2.0.13 öncesi şema, göçten geçmemiş) depoda aynı tanımın yedek kolu. `closedAtK` kuralı (`status = 'closed'`
VE kapanış günü ≤ K) AYNEN. Başka dosya değişmedi (plan.mjs, tek borç sırası, defter rotası, şüpheli türetmesi, göçler, istemci DOKUNULMADI). Aynı tek SQL'in bir ifadesi — öğe başına okuma yok.

## 3. KALICI TEST — test/devir-d3-eski-kapali-kart.test.mjs (8 sınama)
Veri: `test/fixtures/d3t6-v2012/` — v2.0.12'nin GERÇEK kodu (`git worktree add --detach /dev/shm/d3t6-v2012/kod v2.0.12`), kendi API'siyle (üretici `uret.mjs.txt`; çıktısı
`v2012.json`: `closedAtSutunu: false`). v2.0.12'de sahte saat yok → süreç saati (test/fixtures/surec-saati.mjs) ile her adım kendi gününde; saat ileri alınınca oturum düşüyor → her adımda
yeniden giriş. Beş kart (1.000 TL / 2 taksit, Kayıt 01.05.2026, 20.06.2026 300 TL tahsilat): 25.06.2026 kapalı (iki kart), 31.12.2026 (K günü) kapalı, 03.01.2027 (K sonrası) kapalı, biri açık.
Yeni kod 05.01.2027 sahte saatle açar (göç 53 '2.4.9' yazar; closed_at boş kalır), K = 31.12.2026 ön izleme.
TASARIM NOTU (görev metni "test kopyayı `git worktree add --detach` ile açar"): kopya üretim sırasında açıldı ve kaldırıldı; kalıcı test ÜRETİLMİŞ veriyi (gzip'li veri dosyası) okur, etiket
istemez — depodaki emsal düzen (test/fixtures/supheli-kuyruk-v249, m2-degersiz-v249). Gerekçe: CI'de Windows'ta eski sürüm kopyası (yol uzunluğu kırmızısı — devir ön koşulları tur 1) ve
eski sürümü yeni node_modules ile her koşuda başlatmak kırılgan; veri yine eski sürümün gerçek kodunun ürünü. Ana oturum aynı üreticiyle veriyi yeniden üretebilir (§17).
Beklenenler karar metninden (ders 5): kapalı kartın carisi bakiye 0 / planRemaining 0; K öncesi ve K günü kapanan kart KAPALI kalan 0; K sonrası kapanan kart AÇIK kalan 700;
`taksitKarti` {acik 2, kalanMinor 140.000, kapali 3}; Devir Raporu '2 açık (1.400,00 TL) · 3 kapalı', 'Kalan 0 Taksit' YOK, iki 'Kalan 2 Taksit — 700,00 TL'; durduran 0, sorun 0.
İkinci bölüm (DOĞRULANMADI maddesi): aynı veride bir kartın cari bağı ELLE boşaltılır (carisiz kart program API'siyle üretilemez: v2.0.6'dan beri kart cariyle açılır, göç eski kartları cariye
bağlar, kartı / hareketi olan cari silinmez — v2.0.12 accounts.mjs:377 "kapatılan kartlar da sayılır", bugün deleteBlock) → genel defter 127 = 0; plan kart KAPALI kalan 0; modül farkı yok,
durdurma yok.
