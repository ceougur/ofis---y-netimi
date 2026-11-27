# Ç5-A tur 2 — kod ajanının ARA raporu (tur 2a; 13.11.2026; AYNEN; ajan raporu kanıt DEĞİL; dar kontrole VERİLMEZ)

# Ç5-A TUR 2 — ARA RAPOR (bağlam daraldı; görev metni "Sıra ve ara rapor" kuralına göre durdum)

Dal: worktree-agent-a294d4187e1bf9872 (taban c5a2-taban 7e8d3228). PUSH YOK. Ağaç temiz (yalnız `?? node_modules` bağı).
Ortam (sonda): yük 1,49 / 4 çekirdek, boş bellek 8 GB (kullanılabilir 14), boş disk 9,0 GB.

**Durum:**
- **BİTTİ:** İş 0, İş 5, İş 6 (yeniden üretildi, soru olarak), İş 7'nin DÜŞÜK-1 / -3 / -4.
- **KALAN (yeni temiz ajana, ders 46):** İş 7 DÜŞÜK-2, İş 1, 2, 3, 4, 8.
- **YARIM iş yok.** Her bitmiş iş commit'li.

## BU TURUN DEĞİŞTİRDİĞİ GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

**1. Yönetim › Sistem › Dönem Kilidi ve Mutabakat satırı** (İş 0; EY-1, D 12.11 15:57 (4); tur 1d kararı "kural farkı uyarıdır").
- Veri: kilitli eski sürüm verisi (surum-2.0.26-zincir, kilit 05.10).
- Önce (KIRMIZI): "Mutabakat: 2 denetimde sapma var (Kural Değişikliği Farkı (Kilitli Dönem: 05.10.2026 ve Öncesi), İleri tarihli hareket … — eski sürümden kalan 1 satır …)".
- Sonra (SARI):
  - "Mutabakat: 1 denetimde eski sürümden kalan satır var; yeni işlemler engellenmez (İleri tarihli hareket (Çek/Senet Hareketleri): 1 satır). <eski ipucu> …"
  - ve ayrı cümle: "Uyarı (yeni işlemleri engellemez): Kural Değişikliği Farkı (Kilitli Dönem: 05.10.2026 ve Öncesi) — 44 madde, fark ₺127.800,00. Kilitli dönemin raporları donmuş defterden okunur, değişmez; fark Yönetim › Kural Farkı Düzeltme ile ilk açık güne alınır."
- Yalnız istemci değişti (client/assets/admin.js `loadIntegrity`). Sunucunun Mutabakat Testi sonucu, Mutabakat Günlüğü ve zil DEĞİŞMEDİ (günlük 1 → 1 satır).
- Gerçek sapma varsa satır yine kırmızı; kural farkı o zaman da ayrı cümlede.
- "Düzeltildi (Fiş …)" cümlesi İş 2'ye bağlı, yapılmadı.

**2. Fatura iptali ve silinmesi** (İş 5; S160 = A).
- Faturaya bağlı kilit tarihli ya da öncesi bir tahsilat varsa istek artık 409 `period-locked-bond`. Önce 200 dönüyordu, bağ sessizce düşüyordu.
- "Bağlı tahsilat" iki tür: cari hareketi `kind='in'` (invoice_id) ya da Kapatılacak Fatura ile bağlanmış alınan evrak olayı.
- İleti: "Bu faturanın iptali ya da silinmesi faturaya bağlı 09.10.2026 tarihli tahsilatın fatura bağını düşürür; 10.10.2026 ve öncesi kapatılmış (kilitli) dönemdir. Değişiklik için yönetici dönem kilidini açmalı."
- Kural şüpheli durumuna bağlı değil.
- Örnek madde (şüpheli caride, kilitli defter; ana oturumun ana-fb betiği):
  - Önce: iptal 200, kilitli dönemde "09.10 A 128 100" → "A 120 100".
  - Sonra: 409, kilitli defter farkı [].
- Aynı kontrol `cancel`'ın yazımında olduğu için onu çağıran her yol 409 alır: silme, e-Belge iptali (önce dryRun → EDM'ye gitmeden ret) ve **Banka'dan Ters Kaydet** (bank/vouchers.mjs:551 `cancel(fromBank)`).
  - Bu son yolda: POS komisyon faturasının kilitli aydaki komisyon iadesi (`in`) satırı faturaya bağlıysa ters kayıt artık 409.
  - Bu yol test edilmedi (DENENMEYEN). Baş mimar değerlendirmeli.

## İŞLER

### İş 0
- Yeniden üretim: ana oturumun yürüyüş betiği BOLUM=B, taban kodda. Ekran görüntüsüne baktım: kırmızı satır yukarıdaki metinle.
  - Önce: `docs/kanit/2026-11-13/c5a2-is0-once-yonetim.png`
  - Sonra: `docs/kanit/2026-11-13/c5a2-is0-sonra-yonetim.png` (baktım: sarı, iki cümle)
- Kök neden: istemci yalnız `notice` işaretini uyarı sayıyor. `ledger:rule-diff` sunucuda `severity: warning` ama `notice` değil. `notice` başka anlam taşıdığı için sunucuya dokunulmadı (noticeGrowth → günlük + zil).
- Yeni ekran senaryosu: `test/e2e/senaryo-acilis-duzeni-250.mjs` (fikstürden açılış, gerçek tıklama). **CI listesine eklenecek.**
  - Tabanda (DEPO=kopya) 6/10 kırmızı. Nedeni: satır kırmızı, "denetimde sapma var" yazıyor, uyarı cümlesi yok.
  - Yeni kodda 10/10, Istanbul ve UTC.
- Komşu ekran senaryoları (aynı öğeyi okuyanlar, taramayla), hepsi yeşil:

| Senaryo | Sonuç |
|---|---|
| senaryo-kasa-acilis-uyari-250 | 20/20 |
| senaryo-donem-kilidi-ilerleme-250 | 39/39 |
| senaryo-226 | 22/22 |
| senaryo-213 | 64/64 |
| yazim-duzeni testi | 6/6 |

### İş 5 (S160)
- **Bağı düşüren yolların TAM listesi** (tarama: `SET invoice_id`, `invoice_id = ''`, `DELETE FROM invoices`):
  - (a) routes/invoices.mjs `cancel` (2889: cari hareketi bağı; 2897: evrak olayı bağı) ve onu çağıranlar:
    - iptal ucu (3830),
    - e-Belge iptal akışları (3777 dryRun, 3799, 3816, 3827),
    - `deleteInvoice` (3498),
    - bank/vouchers.mjs:551 Banka'dan Ters Kaydet.
  - (b) accounts.mjs:1207 cari hareketi düzenleme: kilitli satırda zaten 409 (betikte C: 409).
  - (c) cheques.mjs:1006 Silinenler'den evrak geri yükleme ve cari hareketi geri yükleme: kilitli tarih `restoreDate` ile zaten 409.
  - (d) mahsup kaldırma (`removeOffset`): kilitli tarihte zaten 409; mahsup defteri değiştirmez.
  - Ayrıca bağ YAZAN yol: bank/pos.mjs:519 `linkFees` (İş 6).
- Değişen kod:
  - server/lib/period.mjs `assertBondOpen` (yeni yardımcı),
  - server/routes/invoices.mjs `cancel` içinde `assertOpen`'dan hemen sonra tek blok (iki dizinli sorgu, yalnız kilit varken; `idx_account_entries_invoice`, `idx_cheque_events_invoice` var).
- Yeni test `test/s160-kilitli-tahsilat-bagi-250.test.mjs`:
  - Yeni kodda 7/7, UTC ve Istanbul.
  - Tabanda 6/7 kırmızı (nedeni: "409 beklenir — 200"). Yalnız "kilit dışı serbest" testi yeşil, beklenen.
- Mutantlar M1–M5 hepsi öldü:

| Mutant | Değişiklik | Kırmızı test |
|---|---|---|
| M1 | ret kaldırılır | 6 |
| M2 | `<` kilit günü | 1 |
| M3 | evrak bağı sayılmaz | 1 |
| M4 | kural şüpheliye bağlanır | 2 |
| M5 | `in` yerine `out` | 5 |

- G2 komşular (taramayla: fatura iptali + dönem kilidi geçen 13 dosya + period.mjs'i anan testler):
  - 237/237 UTC, 237/237 Istanbul.
  - kilit-izi-alanlar-250: UTC 38/38 (S160'tan sonra), Istanbul 38/38 (S160'tan önce, DÜŞÜK-4'ten sonra).
- test/mutabakat/motor.mjs: modeli faturaya bağlı tahsilat (Kapatılacak Fatura) üretmiyor, kendi peşin satırları açık dönemde. Etkilenmez. Uzun koşu KOŞULMADI (son adayda).

### İş 6 — POS komisyon faturası
- Programın kendi yolundan ÜRETİLDİ. Taban ve yeni kodda aynı.
- Betik: `docs/kanit/2026-11-13/c5a2-betik/pos-bag*.mjs`
- Adımlar: KDV kipli POS, Eylül'de iki satış, kesinti 660 (04.09), tam iade ile komisyon iadesi `in` 300 (14.09), Eylül kilidi, Şimdi Oluştur (taslak 01.10), Kaydet. Bu noktada `linkFees` kilitli Eylül'ün İKİ satırına bağ yazıyor.
- Sağlayıcı carisi tedarikçiyse şüpheliye alınamıyor (409 doubtful-customer-only). Kilitli defter farkı 0.
- Sağlayıcı carisi MÜŞTERİ türündeyse (POS bunu kabul ediyor) ve 08.09'da 200 şüpheliye alınmışsa:
  - Kilitli dönemde 14.09 satırı "A 128 200 + A 120 100" → "A 120 300".
  - Tarama bulgusu yok, günlük 0, zil 0. Sessiz.
  - Cari bakiyesi iki okumada aynı: kayıttan önce 360, sonra 0. Fark yalnız 120 / 128 sınıflaması.
- KODLANMADI (aşağıda soru).

### İş 7
- **DÜŞÜK-1 (goc-243):**
  - Test açılışta bekleyen dondurmayı bekliyor (`runPending`) ve tek sonucu adıyla bekliyor: kilitli Masa açılışının 500 (+5.000) ↔ 519 (−5.000) kural farkı; başka sapma yok.
  - Yeni test: normal koşu UTC ve Istanbul yeşil; zorlama 'bitir' 2/2, 'gozlem' 1/1 ön koşullu yeşil.
  - Eski test tabanda 'bitir'de kırmızı, nedeni okundu: `failures`'ta `ledger:rule-diff`, 1 madde, 5.000.
  - Mevcut beklenti değişti; gerekçe: ders 20, ön koşul ürün durumundan.
- **DÜŞÜK-3:** defter-kaynak-iz-250'ye "istisnadaki sütun izde olmamalı" denetimi eklendi.
  - Mutant Y21 öldü; ileti: "istisna listesinde kilit izinde OLAN sütun: invoices.gl_json".
  - Test iki TZ'de 2/2.
- **DÜŞÜK-4:** integrity-scope.mjs'teki `plan_imports` dalı SİLİNDİ.
  - Gerekçe: tablo SCOPE_TABLES'ta yok (db.mjs:233; db.mjs dosya sınırı dışı). Dal hiç çalışmıyordu. Kapı dışı değişikliği `plans_import_lock` buluyor.
  - Not: integrity-scope.mjs dosya sınırı listesinde yoktu; görev DÜŞÜK-4'ü açıkça verdiği için yalnız bu dala dokundum.
- **DÜŞÜK-2: YAPILMADI, kalan iş.** Sekiz yaşayan mutant: Y2, Y3, Y5, Y10, Y11, Y12, Y18, Y23.
  - Mutant tanımları: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a1f-q/mutant.py
  - Y2: stok kaynaklı satırın başka nedenli harekete geçişi.
  - Y3: kaynaklı `in` satırında doubtful_skip 0 → 1.
  - Y5: carisiz kilitli karşılıksıza cari + kilit sonrası borç.
  - Y10, Y11, Y12: süzgeç ↔ kapı eşdeğerliği `[7]`.
  - Y18: since etiketi.
  - Y23: plan_entries opening.
  - Her biri v2.4.9 verisi gerektiriyor.

## KABUL KOŞULLARI

**A. Defter kâhini (yeni kod):** 187/187 Istanbul, 187/187 UTC. 0 fark, 0 atlanan, 0 reddedilen. Tabanı yeniden koşmadım; ana oturumun son sayısı 187/187.

**B. Cari kâhini (Istanbul):** taban 16.449/16.449, yeni 16.449/16.449. Yapım aşaması 41 → 41. `KAHIN_YAPIM_ASAMASI` ile liste farkı dökümü KOŞULMADI. Bu turda tamamlanan kural işi yok (İş 1–4 kalan), kapanması beklenen kayıt da yok.

**C. Muhasebe sürücüsü:** KOŞULMADI. İş 1–4 yapılmadı, beklenen değişiklik yok.

**D. v2.4.9 sınıf testi:** YAPILMADI (İş 1–2'ye bağlı).

**E. Hız:** ÖLÇÜLMEDİ.
- Değişen istek yalnız fatura iptali / silme: kilit varken iki dizinli MIN sorgusu.
- Yönetim satırı yalnız istemci.
- Ana oturumun hız kabul ölçümünde fatura iptali yolu kilitli / kilitsiz ölçülmeli.

**F. Değişmezler:** bu turda fiş yok. S160 bakiyeyi değiştirmiyor (409 ya da eskisi gibi).

**G. Ekran:** İş 0 için yukarıda. Üç yeni ekran YAPILMADI.

## KULLANICIYA SORULMALI (İş 6 — S160'ın söylemediği durum: bağ DÜŞÜRMEK değil YAZMAK)

**Durum:** POS sağlayıcısı müşteri türü cari, açık şüphelisi var, kilitli ayda komisyon iadesi var. Komisyon faturası kaydedilince kilitli ayın iade satırı faturaya bağlanıyor ve kilitli defterde 128 → 120 sınıflaması sessizce değişiyor. Bakiye değişmiyor.

**En küçük örnek:**
- 08.09 şüpheliye alma 200; 14.09 komisyon iadesi 300; Eylül kilitli; 01.10 komisyon faturası kaydı.
- Okuma 1 (bugün): kilitli defterde 14.09 "A 128 200 + A 120 100" → "A 120 300"; cari bakiyesi 360 → 0.
- Okuma 2 (bağ yazılmaz): kilitli defter aynı kalır; iade satırı bağsız kalır, komisyon faturası tam kapanmaz, sağlayıcıda 300 açık görünür.

**Seçenekler:**
- (A) Kilitli aydaki satırlara bağ yazılmaz, yalnız açık dönem satırları bağlanır. Fatura kapanışı eksik kalır.
- (B) Kaydet reddedilir (409; S160 ilkesi). Bu, Yargıç Y6'nın "kilitli ayın taslağı olduğu gibi kaydedilir" kararını her kilitli ayda bozar.
- (C) Uç durum böyle kalsın (BİLİNEN SINIR). Kural Farkı Düzeltme Fişi'nin ön izlemesi farkın bu satırdan geldiğini gösterecek.

**Öneri: C** (dört koşul birlikte gerekiyor: müşteri türü sağlayıcı + şüpheli + aynı ayda komisyon iadesi + kilit).

**Yaygın programlarda nasıl:** doğrulanmış kaynak yok, yazmıyorum.

## BAŞ MİMAR KARARI GEREKİYOR
1. **S160'ın kapsamı.** Karar metni "tahsilat" diyor; ret yalnız `in` cari hareketi ve alınan evrak (`receive`) bağında. Ödeme (`out`) ve verilen evrak (`issue`) bağı kurala ALINMADI.
   - Gerekçe: bu bağlar defteri değiştirmiyor (doubtfulSkipOf yalnız `in`).
   - Öneri: böyle kalsın.
2. **Banka'dan Ters Kaydet.** Komisyon faturasının kilitli aydaki iade (`in`) satırı bağlıysa ters kayıt artık 409 (S160'ın doğrudan uygulanışı).
   - Bu yol test edilmedi.
   - Onaylanırsa test eklenmeli; reddedilirse `fromBank` istisnası gerekir.

## KAPSAM DIŞI BULGULAR
- Yok. Program dışı yazım türü yeni açık görmedim.
- Kâhin koşusu /tmp/kahin-defter-* klasörleri bıraktı (aracın kendisi). Joker silme yasak olduğu için dokunmadım.

## DOĞRULANMADI / DENENMEYEN / KOŞULMADI
- **DENENMEYEN:**
  - Banka'dan Ters Kaydet yolunda 409.
  - e-Belge iptal akışında 409 (kod yolu: dryRun aynı `cancel`).
  - İş 0 satırında "kural farkı + gerçek sapma birlikte" hâli ekranda (yalnız kodla).
  - İki kişi aynı anda.
- **KOŞULMADI:** cari kâhini yapım aşaması liste farkı dökümü, muhasebe sürücüsü, tam npm test (kural gereği), DÜŞÜK-2.
- **ÖLÇÜLMEDİ:** hız (E).

## Commit'ler (sırayla)

| Commit | İçerik |
|---|---|
| 4b332a52 | Tasarım notu §17 (koddan önce) |
| f88bc969 | İş 0 |
| 6cb9f057 | İş 7 DÜŞÜK-1 |
| c4316e1b | İş 7 DÜŞÜK-3 / -4 |
| d4d59a30 | İş 5 (S160) |
| 0f2d44fe | Not §17.6 / §17.7 |
| c3dc4a36 | Kanıt: docs/kanit/2026-11-13/c5a2-* (koşu çıktıları, mutantlar, önce / sonra ekran görüntüsü, betikler) |

## Ana oturumun yeniden koşacağı komutlar (beklenen)
- `node --test test/s160-kilitli-tahsilat-bagi-250.test.mjs`: 7/7, iki TZ. Tabanda 6/7 kırmızı, neden "409 beklenir — 200".
- `node test/e2e/senaryo-acilis-duzeni-250.mjs`: 10/10. DEPO=taban kopyasıyla 6/10 kırmızı.
- `node --test test/goc-243-stok-acilis.test.mjs`: 1/1. Zorlama: `DONDURMA_YARIS=bitir node test/b7-dondurma-yaris-zorla.mjs test/goc-243-stok-acilis.test.mjs 2 --ad ''`, ön koşullu yeşil 2/2.
- `node --test test/defter-kaynak-iz-250.test.mjs`: 2/2.
- `npm run test:kahin-defter`: 187/187.
- `npm run test:kahin-cari`: 16.449/16.449 (yapım aşaması 41).

## Ekran yürüyüşü için (bu turun kısmı)
Kilitli eski sürüm verisi → Yönetim › Sistem → satır sarı, iki cümle (eski sürüm satırı + Kural Değişikliği Farkı uyarısı) → Raporlar › Mutabakat Günlüğü değişmemiş. Kalan adımlar (aday onayı, kural farkı fişi, eşleştirme fişi, mizan) İş 1–3'ten sonra.

## Sonraki ajan için
- İş 1–4, 8 ve DÜŞÜK-2 kalıyor.
- Tasarım notu §17.5'te planı var; §17.7'de durum.
- İş 0'ın "Düzeltildi" cümlesi İş 2'nin sunucu alanına (`ledger:rule-diff` öğesinde `corrected`) bağlanacak.
- Fiş türleri `opening-match` ve `rule-diff-correction` server/lib/ledger-vouchers.mjs:29 / :34'te zaten tanımlı.

## Windows'ta izlenecek testler (ders 48)
s160-kilitli-tahsilat-bagi-250 ve goc-243 (dosya / dondurma) — CI Windows'ta okunmalı.

## Not defteri klasörüm
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2-k7`
- `betik/`: pos-bag*.mjs ve kopyalanan ana-fb.mjs, k.mjs, h.mjs.
- `kanit/`, `yuruyus/` (taban ekran görüntüleri), `*.sh` / `*.py` koşu betikleri.
- Taban kopyasını sildim.
