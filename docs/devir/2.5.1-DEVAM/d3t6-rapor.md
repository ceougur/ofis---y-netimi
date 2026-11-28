# D3 TUR 6 — RAPOR (devir saf hesabı; dar kontrol D3 tur 1–5 ORTA-1)

Taban `t251-d3t6-taban` = d183d780 (doğrulandı). Dal `worktree-agent-a3502020a3b9af408`. D3 hâlâ HİÇBİR ŞEY YAZMAZ. PUSH YOK.
Ortam (son okuma): yük 3,6–5,1 / 4 çekirdek (başka ajanlar; her koşudan önce okundu, 4'ün üstündeyken tek seferlik beklendi), bellek boş 1 GB (kullanılabilir 8 GB), disk boş 7,3 GB.

## 0. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞ (önce → sonra)
Yalnız 2.0.13'ten ÖNCE kapatılmış (kapanış günü alanı boş kalmış) taksit kartında; 2.0.13 ve sonrası kapatılan kartta HİÇBİR şey değişmez.
- **Devir ön izlemesi / Devir Raporu (Modüller — Taksit Kartı)**: v2.0.12'de 25.06.2026'da kapatılmış 1.000 TL kart (300 TL tahsilat; kalanı program 'Kart kapatıldı' ile düşmüş, carisinin
  bakiyesi 0): önce 'açık, kalan 700,00 TL' ve 'Kalan 0 Taksit — 700,00 TL' satırı; sonra 'kapalı, kalan 0', satır yok. Örnek veride (5 kart) Taksit Kartı özeti
  önce '5 açık (3.500,00 TL) · 0 kapalı' → sonra '2 açık (1.400,00 TL) · 3 kapalı' (ön izleme sayısı `taksitKarti` {acik 5, kalan 350.000, kapali 0} → {acik 2, kalan 140.000, kapali 3}).
- **Yeni yıl açılışı (planın kart satırı)**: aynı kart yeni yılda 700 TL kalanla açılacaktı (devirli ≠ devirsiz) → kapalı kart tek açılış, kalan 0 (devirli = devirsiz).
- **K günü kapanış**: 31.12.2026'da (K günü) kapatılmış eski kart önce açık → sonra kapalı. **K'den SONRA** (03.01.2027) kapatılmış eski kart: önce de sonra da K'de AÇIK, kalan 700 (değişmedi —
  carinin K bakiyesi gerçekten 700).
- **Carisiz eski kapalı kart** (DOĞRULANMADI maddesi — ölçüldü, ÜRETİLDİ): önce ön denetim 'Hesap Bakiyesi Modülle Tutmuyor' ile DURDURUYORDU (127 · kart: Ana Defter 0,00 TL, modül
  açılışında 700,00 TL) → sonra durdurma yok, kart kapalı, 127 karşılığı 0.
- Carinin devir satırı (Borç / Alacak Toplamı, açık kalemler), Ana Defter, cari ekstresi, tek borç sırası: DEĞİŞMEDİ (zaten programın tanımıyla doğruydu — testte önce de sonra da yeşil).
- İleti kataloğu: yeni ileti YOK; katalog tur 5'inkiyle bayt bayt AYNI.

## 1. DEĞİŞEN DOSYALAR
- `server/lib/devir/plan-reader.mjs` (cardsAt: kapanış günü `closeDaySql("p")`; içe aktarma).
- `test/devir-d3-eski-kapali-kart.test.mjs` (YENİ, 8 sınama), `test/fixtures/d3t6-v2012/` (YENİ: `destekofis.sqlite.gz`, `v2012.json`, `uret.mjs.txt`), `test/devir-d3-mutasyon.mjs` (taban + M65, M66).
- `docs/devir/2.5.1-DEVAM/d3t6-rapor.md`, `docs/devir/2.5.1-DEVAM/d3t6-iletiler.md`, `docs/kanit/2026-11-28/d3t6-*` (kanıt).
- DOKUNULMADI: plan.mjs, tek borç sırası ve girdisi, defter rotası, şüpheli defter türetmesi, göçler, istemci, `.github/**`, `package.json`, `tools/**`, kılavuz.

## 2. NASIL BOZULUR (koddan ÖNCE yazıldı — commit ffec3f73)
Kapanış günü = programın tanımı `MAX(COALESCE(closed_at, substr(updated_at, 1, 10)), Kayıt Tarihi)`:
1. `closed_at` BOŞ (2.0.13 öncesi) × son güncelleme günü K ÖNCESİ → K'de KAPALI (bulgu). — SINANDI (v2.0.12 verisi)
2. `closed_at` BOŞ × K GÜNÜ → KAPALI (`<=` sınırı). — SINANDI
3. `closed_at` BOŞ × K SONRASI → K'de AÇIK, kalan devreder ("tarihsiz yedek" hatası). — SINANDI (+ M66)
4. `closed_at` DOLU (2.0.13+) × K öncesi / günü / sonrası → AYNEN. — gerçek veri (v2.5.0) 6/6 + D3'ün 172 testi (değişmedi)
5. `close_rule` '2.4.9' × Borçta Kalsın (2.5.0+; closed_at hep dolu) → 'kart-kalani' sınıfı değişmez. — mevcut D3 testleri + gerçek veri (Borçta Kalsın kartlı)
6. Carili × CARİSİZ → 127 karşılığı. — SINANDI (cari bağı elle boşaltılarak; program API'siyle üretilemez — §4)
7. Kayıt Tarihi > son güncelleme günü → kapanış Kayıt Tarihi'ne çekilir (MAX). — K kararında EŞDEĞER: kart planda yalnız Kayıt Tarihi ≤ K ise var; o zaman MAX ≤ K ⇔ ikisi de ≤ K
   (mutant 'MAX'sız' K'de ayırt edilemez → mutant listesine konmadı; bilinçli).
8. Faturası iptal edilmiş kapalı kart (program `closed_at = bugün` yazar) → madde 4.
9. Veri kaynağı: v2.0.12 (closed_at sütunu YOK — fikstürde `closedAtSutunu: false`), v2.5.0 (gerçek veri karşılaştırması). v2.4.9: kapatma closed_at yazar → madde 4 (ayrı veri üretilmedi).
10. Saat dilimi: program UTC günü (`substr(updated_at,1,10)`) alır; devir aynı ifadeyi kullanır; kapanış anları öğlen +03 → iki TZ aynı sonuç. — iki TZ yeşil.
11. Ön izleme sayıları + Devir Raporu satırları + carinin devir satırı + 127 birlikte. — SINANDI

## 3. TARAMA (kod değiştirmeden ÖNCE; kanıt `docs/kanit/2026-11-28/d3t6-tarama-*.txt`)
Devir modülünde kart kapanış gününü okuyan yer (taban `git grep -n "closed_at" t251-d3t6-taban -- server/lib/devir`): TEK yer — `server/lib/devir/plan-reader.mjs:186`
`COALESCE(p.closed_at, '')` (cardsAt → `closedAtK`). plan.mjs (kart durumu / kalan / 'kart-kalani' / carisiz 127), report.mjs (Taksit Kartı satırları) yalnız `closedAtK` / `durum`'u tüketir;
preflight, iletiler, archives, archive-open, devir-backups, maintenance, plan-worker kapanış günü okumaz.

| Programdaki yer (dosya:satır) | Ne için | Devir (taban) bu tanımla |
|---|---|---|
| server/lib/accounts.mjs:32 `closeDaySql` | 689'un / S205'in günü — tek SQL yardımcısı | UYUMSUZ → düzeltmeden sonra AYNI işlev |
| server/lib/accounts.mjs:46 `closeDayOfPlan` | JS ikizi | UYUMSUZ → uyumlu |
| server/lib/accounts.mjs:173 | cari ekstresi 'Kart kapatıldı' satırının günü | UYUMSUZ → uyumlu |
| server/routes/ledger.mjs:152 + server/lib/general-ledger.mjs:584 | genel defter 689 maddesi (`closedOn > date ? closedOn : date`) | UYUMSUZ → uyumlu |
| server/lib/integrity.mjs:186, :311 | mutabakat / kilit izi | UYUMSUZ → uyumlu |
| server/lib/bank/doubtful.mjs:116 | şüpheli yükleyicisinin kart kapanış satırı | UYUMSUZ → uyumlu |
| server/routes/plans.mjs:856 `closeDayOf` | kilitli dönemde kartı yeniden açma reddi | UYUMSUZ → uyumlu |
| server/lib/integrity-scope.mjs:408, :421 | kilit kapsamı | UYUMSUZ → uyumlu |
| server/lib/ledger-rule-249/ledger-rows.mjs:87 | 2.4.9 kuralı (kural farkı) | UYUMSUZ → uyumlu |
Not: JS kolları (`closedAt || updatedAt`) boş metni de "yok" sayar, SQL `COALESCE` yalnız NULL'u; program `closed_at`'a yalnız `today()` ya da NULL yazar (plans.mjs:989, :1965; göç sütunu NULL
ile ekler) → eşdeğer.

## 4. DÜZELTME (commit 0b84ea49)
cardsAt: `COALESCE(p.closed_at, '')` → programın tek yardımcısı `closeDaySql("p")` (lib/accounts.mjs'ten içe aktarılır, KOPYALANMAZ). Sütunu eksik depoda (2.0.13 öncesi şema, göçten
geçmemiş — çalışan programda olmaz) aynı tanımın yedek kolu. `closedAtK` (`status = 'closed'` VE kapanış günü ≤ K) AYNEN. Tek SQL'in bir ifadesi — öğe başına okuma yok (ders 47).
DOĞRULANMADI maddesi ölçüldü: taban kodda ÜRETİLDİ (plan sorunu `modul-farki` 127 `plan:<kart>` beklenen 0 / bulunan 70.000 kuruş → ön denetim DURDURUR); düzeltmeden sonra yok.
Carisiz kart neden elle: v2.0.6'dan beri kart cariyle açılır (göç eski kartları cariye bağlar), kartı olan cari v2.0.12'de silinmez (accounts.mjs:377 "kapatılan kartlar da sayılır"),
bugün de hareketi olan cari silinmez (deleteBlock) → program API'siyle üretilemiyor; v2.0.12'nin ürettiği veride YALNIZ cari bağı boşaltıldı (ek denetim).

## 5. KALICI TEST — test/devir-d3-eski-kapali-kart.test.mjs (8 sınama)
Veri `test/fixtures/d3t6-v2012/`: v2.0.12'nin GERÇEK kodu (`git worktree add --detach /dev/shm/d3t6-v2012/kod v2.0.12`; iş bitince `git worktree remove`), kendi API'siyle (üretici
`uret.mjs.txt`). v2.0.12'de sahte saat yok → süreç saati (test/fixtures/surec-saati.mjs) ile her adım kendi gününde; saat ileri alınınca oturum düşüyor → her adımda yeniden giriş.
Beş kart (1.000 TL / 2 taksit, Kayıt 01.05.2026, 20.06.2026 300 TL tahsilat): 25.06.2026 kapalı (iki kart; biri ikinci bölümde carisiz yapılır), 31.12.2026 (K günü) kapalı,
03.01.2027 (K sonrası) kapalı, biri açık. Yeni kod 05.01.2027 sahte saatle açar (göç 53 '2.4.9' yazar, closed_at boş kalır), K = 31.12.2026.
TASARIM NOTU (görev metni: "test sürüm etiketi isteyen kopyayı `git worktree add --detach` ile açar"): kopya ÜRETİMDE açıldı / kaldırıldı; kalıcı test üretilmiş veriyi (gzip'li veri dosyası)
okur, etiket istemez — depodaki emsal düzen (test/fixtures/supheli-kuyruk-v249, m2-degersiz-v249). Gerekçe: CI Windows'unda eski sürüm kopyası (yol uzunluğu kırmızısı — devir ön koşulları
tur 1) ve eski sürümü her koşuda yeni node_modules ile başlatmak kırılgan; veri yine eski sürümün gerçek kodunun ürünü. Ana oturum aynı üreticiyle yeniden üretebilir (§16). Değiştirilmesi
istenirse BAŞ MİMAR KARARI.
Beklenenler karar metninden (ders 5; programın devirsiz hesabından türetilmedi): kapalı kartın carisi bakiye 0 / planRemaining 0; K öncesi ve K günü kapanan kart KAPALI kalan 0; K sonrası
kapanan kart AÇIK kalan 700; `taksitKarti` {acik 2, kalanMinor 140.000, kapali 3}; Devir Raporu '2 açık (1.400,00 TL) · 3 kapalı', 'Kalan 0 Taksit' YOK, iki 'Kalan 2 Taksit — 700,00 TL';
durduran 0, sorun 0. Sayılar veri tabanından ve yanıt gövdesinden (ders 3): göç sonrası `closed_at` NULL / `close_rule` '2.4.9' / son güncelleme günleri; cari kartı `totals`; Ana Defter 120 / 127.

| Koşu | Sonuç | Kırmızının NEDENİ (ders 38) |
|---|---|---|
| taban kopyası (`/dev/shm/d3t6-eski/eski`, yalnız yeni test + fikstür), UTC | **4/8 — 4 kırmızı** | (1) Haziran / K günü kartı `durum: 'acik'` (beklenen 'kapali'); (2) rapor `["5 açık (3.500,00 TL) · 0 kapalı"], üç "Kalan 0 Taksit — 700,00 TL"`; (3) carisiz kart 'acik'; (4) `modul-farki` 127 `plan:plan-6f48…` beklenen 0 / bulunan 70000 |
| taban kopyası, İstanbul | **4/8 — aynı 4 kırmızı, aynı neden** | aynı |
| yeni kod, UTC | **8/8** | — |
| yeni kod, İstanbul | **8/8** | — |
Tabanda yeşil kalan 4 sınama çapraz denetimdir (veri tabanı, devirsiz program, carinin devir satırı, 127 = 0) — bunların tabanda da doğru olması beklenen (hata yalnız kart okuyucusunda).

## 6. KABUL KOŞULLARI
- **A** yeni test tabanda beklenen nedenle kırmızı (4/8, iki TZ, nedenler §5), yenide yeşil iki TZ (8/8). ✔
- **B** D3 testleri + komşular iki TZ **193/193** (D3'ün 27 test dosyası — 172 sınama — + maliyet-bagsizlik, platform-tasinabilirlik, lisans-servisi-izolasyonu, yazim-duzeni); gerçek veri
  **6/6 koşu 22/22** (§7); `test:kahin-defter` **187/187** iki TZ; `test:kahin-cari` **25.957/25.957** iki TZ; mutasyon **66/66** iki TZ (tur 1–5'in 64'ü AYNEN + M65, M66; taban 172/172).
  Açıklanmamış fark **0**. ✔
- **C** ileti kataloğu (D3'ün üreticisi): 56 neden (durdurur 46, uyarı 10), 176 ileti, tarama ihlali **0**; `d3t6-iletiler.md` = `d3t5-iletiler.md` BAYT BAYT (yeni ileti yok). ✔
- **D** hız: öğe başına okuma eklenmedi — aynı tek kart SQL'inde `COALESCE(closed_at, '')` yerine `MAX(COALESCE(closed_at, substr(updated_at,1,10)), Kayıt Tarihi)` (ders 47). Ölçüm: §9. ✔ (yapıca)

## 7. GERÇEK VERİ (v2.5.0 GERÇEK kodu → yeni kod; `git archive v2.5.0` kopyası /dev/shm/d3t6-v250/kod), 3 tohum × 2 TZ
| Koşu | Sonuç | Devirsiz eşdeğer (karşılaştırma / sınıf dışı fark) | S-T4-1 sayacı (AYRI) | S-T2-1 ayırımı | Süre |
|---|---|---|---|---|---|
| utc t11 | **22/22** | 3684 / **0** | 1 cari, 12 karşılaştırma, kayan 128,00 (tur 5 AYNEN) | 8 (6 / 2) | 754 sn |
| ist t11 | **22/22** | 3684 / **0** | 1 cari, 12 (128,00) | 8 (6 / 2) | 764 sn |
| utc t7 | **22/22** | 3684 / **0** | 0 | 8 (6 / 2) | 752 sn |
| ist t7 | **22/22** | 3684 / **0** | 0 | 8 (6 / 2) | 814 sn |
| utc t23 | **22/22** | 3852 / **0** | 0 | 8 (6 / 2) | 773 sn |
| ist t23 | **22/22** | 3852 / **0** | 0 | 8 (6 / 2) | 679 sn |
Tur 5'in tablosuyla birebir (v2.5.0'da kapatılan kartta closed_at dolu — düzeltme etkilemez, beklenen).

## 8. MUTANT TABLOSU (test/devir-d3-mutasyon.mjs; kopya `git archive HEAD`; iki TZ aynı)
| No | Mutant | Sonuç |
|---|---|---|
| M1–M64 | tur 1–5 AYNEN | 64/64 YAKALANDI (iki TZ) |
| M65 | kart kapanış günü yalnız closed_at'tan okunur (tur 1–5 hâli) | YAKALANDI — 4 kırmızı, neden "devir planı (K = 31.12.2026)" |
| M66 | son güncelleme yedeği tarihsiz okunur (K sonrası kapanan kart K'de kapalı) | YAKALANDI — 2 kırmızı, neden "devir planı (K = 31.12.2026)" |
'MAX'sız' (Kayıt Tarihi'ne çekmeme) mutantı K kararında eşdeğer (§2 madde 7) — konmadı.

## 9. HIZ
Ölçüm YAPILMADI (DENENMEYEN): yük ajan süresince 3,6–6,7 (başka ajanlar) — ders 52 ölçümü geçersiz kılar. Değişiklik aynı tek SQL'de satır başına bir MAX / COALESCE (öğe başına sorgu yok).
Ana oturumun ölçüm penceresine: ön izleme okuma süresi (`timings.okuma`) temiz-100k'de önce / sonra (§16).

## 10. KULLANICIYA SORULMALI
YOK (para kuralı sorusu gerekmedi — programın kendi kapanış tanımına uyum; BAŞ MİMAR KARARI 27.11 23:01 aynı yönde).

## 11. BAŞ MİMAR KARARI GEREKİYOR
- **BM-T6-1 (gözlem; bu turun kök nedeni DEĞİL, dokunulmadı):** Devir Raporu 'Taşınan Hareket' satırı ("X hareket yeni yılda kalır · Y hareket arşivde kalır") A sınıfı tablolarda (taksit
  kartı, taksit satırı, çek / senet, POS, şüpheli …) "açık olan kalır" kuralını uygulamıyor: tarihe göre ≤K her satırı "arşivde kalır" sayıyor. Ölçüm (v2.0.12 fikstürü, yeni kod): rapor
  "0 hareket yeni yılda kalır · 20 hareket arşivde kalır" — iki AÇIK kart ve 4 taksit satırı yeni yılda kalacakken arşivde sayılıyor (plan_items 10/10, plans 5/5 kOncesi). Kullanıcının gördüğü
  sayı. Öneri: D4a TUR 1'e (devir yeri; bu dosyalar tek borç sırası zincirinde DEĞİL) "A sınıfı sayımı budama kuralıyla aynı ölçüt (açık / kapalı, kapanış günü programın tanımıyla)" şartı.

## 12. SONRAKİ SÜRÜME (20.11 kuralı)
- Yok (bu turda program davranışını değiştirmeyen husus kovalanmadı).

## 13. DOĞRULANMADI
- Carisiz eski kapalı kartın ÜRÜN içinden oluşması (program API'siyle üretilemedi — §4); durdurma yalnız elle boşaltılmış cari bağıyla ölçüldü.
- v2.4.9 gerçek koduyla üretilmiş kapalı kart (closed_at dolu → kod yolu madde 4; ayrı veri üretilmedi).
- Fikstürün kalıcı test olarak Windows'ta koşusu (dosya silen / taşıyan test DEĞİL; geçici klasörü helpers removeTestDir ile siler) — CI'de ana oturum okur.

## 14. DENENMEYEN
- Hız ölçümü (§9; yük). Tam `npm test` (görev metni gereği ana oturumda). Ekran senaryosu (D3'ün ekranı yok). Windows (CI).
- Ders uygulaması: 2 (çıkış kodu + sayı kanit.mjs ile), 3 (veri tabanı / yanıt gövdesi), 5 (beklenen karar metninden), 7 / 38 (taban kırmızısı nedeniyle), 10 (komşu `git grep` taramasıyla),
  13 (sahte saat; v2.0.12'de süreç saati), 17 (eski sürümün gerçek verisi), 23 / 25 (ayrı, benzersiz kopyalar), 27 (yeni kaynak tarayan test yok), 30 (HUKUK_LICENSE_URL), 33 (dosya adları),
  36 (yalnız kendi tam yolları silindi), 44 (yalnız kendi yolları commit), 47 (öğe başına okuma yok), 51 (eski kopyaya yalnız yeni test + fikstür), 54 (GIT_DIR yok), 55 (adım başına sınır).

## 15. CI LİSTESİNE EKLENECEK
- YOK: `test/devir-d3-eski-kapali-kart.test.mjs` npm test deseniyle kendiliğinden girer; ci.yml değişmez. Yeni ekran senaryosu yok.
- CI DIŞI (aynen): gerçek veri, mutasyon, katalog (§16).

## 16. ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR
```
cd <bu dal>; export HUKUK_LICENSE_URL=http://127.0.0.1:9
for tz in UTC Europe/Istanbul; do TZ=$tz node tools/kanit.mjs kos d3t6-yeni-$tz -- node --test test/devir-d3-eski-kapali-kart.test.mjs; done                      # 8/8
# eski kod kırmızısı: git worktree add --detach <yer>/eski t251-d3t6-taban; yalnız test/devir-d3-eski-kapali-kart.test.mjs + test/fixtures/d3t6-v2012/ → 4/8 (nedenler §5)
T=$(ls test/devir-d3-*.test.mjs); for tz in UTC Europe/Istanbul; do TZ=$tz node --test --test-concurrency=1 $T test/maliyet-bagsizlik.test.mjs test/platform-tasinabilirlik.test.mjs test/lisans-servisi-izolasyonu.test.mjs test/yazim-duzeni.test.mjs; done   # 193/193
# mutasyon: git archive HEAD server test client tools package.json | tar -x -C <kopya>; ln -s <node_modules> <kopya>/node_modules; node test/devir-d3-mutasyon.mjs --kopya <kopya>   # 66/66
# gerçek veri: git archive v2.5.0 client server test tools vendor package.json package-lock.json | tar -x -C <yer>/v250; node test/devir-d3-gercek-veri.mjs --eski <yer>/v250 --tohum 11   # 22/22, S-T4-1 1 cari / 12
# katalog: D3T3_KATALOG_DIR=<k> node --test $T; node test/devir-d3-ileti-katalog.mjs <k> <md>   # = d3t5-iletiler.md bayt bayt
npm run test:kahin-defter; npm run test:kahin-cari    # 187 / 25.957
# fikstürü yeniden üretmek (v2.0.12 GERÇEK kodu): git worktree add --detach <yer>/kod v2.0.12; ln -s <node_modules> <yer>/kod/node_modules; cp test/fixtures/d3t6-v2012/uret.mjs.txt <yer>/uret.mjs
#   ROOT=<yer>/kod OUT=<yer>/cikti SAAT=$PWD/test/fixtures/surec-saati.mjs node <yer>/uret.mjs   # kart / cari kimlikleri yeni üretimde değişir — testi yeni v2012.json okur
# hız (ölçüm penceresi): temiz-100k'de ön izleme timings.okuma önce (t251-d3t6-taban) / sonra (bu dal), flock -x
```

## 17. KILAVUZ METNİ ÖNERİSİ (D5'te; kılavuza DOKUNULMADI)
"**Eski sürümlerde kapattığınız taksit kartları** devirde kapalı sayılır: kalanı kapatırken düşüldüyse yeni yıla taşınmaz; kartı yıl sonundan sonra kapattıysanız kart yeni yıla açık geçer."

## 18. COMMIT LİSTESİ VE DAL UCU
Dal `worktree-agent-a3502020a3b9af408`, taban d183d780 (`t251-d3t6-taban`):
- ffec3f73 D3 tur 6: NASIL BOZULUR listesi (koddan önce)
- 0b84ea49 D3 tur 6: devir planı taksit kartının kapanış gününü programın tanımıyla okur (ORTA-1) — kod + kalıcı test + v2.0.12 fikstürü
- f3a2dc66 D3 tur 6: test adı D3 düzenine (devir-d3-eski-kapali-kart); mutasyon tabanına eklendi + M65, M66
- 4d5231ec D3 tur 6: rapor taslağı
- 9fd2f90c Kanıt: D3 tur 6 koşuları
- (son) D3 tur 6: rapor + ileti kataloğu — DAL UCU bu commit (`git log -1`)
Temizlik: /dev/shm/d3t6-v2012 (v2.0.12 worktree — `git worktree remove`), /dev/shm/d3t6-eski (taban worktree — `git worktree remove`), /dev/shm/d3t6-v250, /dev/shm/d3t6-mut kaldırıldı;
not defteri scratchpad/d3t6/ (ham çıktılar docs/kanit'te) duruyor.
