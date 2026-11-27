# Ç5-A tur 1f — DAR KONTROL raporu (13.11.2026; AYNEN; ajan raporu kanıt DEĞİL — bulgular ana oturumca yeniden üretilir)

# DAR KONTROL — Ç5-A tur 1f (birleşim 3e2e73a2; fark 3e2e73a2^1..3e2e73a2)

Worktree'yi `claude/epic-thompson-w0lc2l` ucuna (0c1d6707) sıfırladım. Düzeltme, commit ve push yapmadım. Mutantları kendi worktree'mde tek tek açıp her birinden sonra dosyayı geri yazdım; sonda `git status -s` yalnız `?? node_modules` gösteriyor. Düzeltme ajanının raporunu, görev metnini, D'deki tur 1f kaydını, KAYIT'taki tur 1f kayıtlarını ve docs/kanit/2026-11-13/c5a1f-* dosyalarını okumadım.

**Ortam (sonda):** yük 1,37 / 4 çekirdek, boş bellek 10 GB, boş disk 11 GB.

**Sonuç:**
- YÜKSEK yok.
- ORTA 1: G-3. Bu bir gerileme (G-1' ailesinin dışarıda kalan bir sınıfı).
- DÜŞÜK 4.
- Kullanıcıya sorulacak yeni soru yok.

## GERİLEMELER

### G-3 (ORTA) — Kilitli tahsilatı olup Kayıt Tarihi kilitten sonra olan kartta "Mevcut Borcu Taksitlendir" alanı kapı dışından değişirse hiçbir denetim görmüyor
**Neye göre gerileme:**
- **8e90f9cf^1'e (Ç5-A öncesi) göre gerileme.** Orada aynı yazım kural farkının imzasını değiştiriyordu: satır içi taramada `ledger:rule-diff` bulgusu, Mutabakat Günlüğü 1, zil 1.
- 3e2e73a2^1'e göre gerileme değil: orada da hiçbir denetim görmüyor. Yani tur 1f bunu kapatmadı.
- v2.4.9'a göre gerileme değil: kilit izi bu alanı orada da görmüyordu.

**Betik:** `probe.mjs` + `cases.sh`, CASE=`late-covers`.
- Veri v2.4.9'un gerçek koduyla API'den üretildi. Kart B carisine bağlı, Kayıt Tarihi 15.10, tahsilatı 09.10 (150 TL). Carinin 08.10 tarihli şüpheli kaydı var. Kilit 10.10, bugün 20.10.
- v2.4.9 kilitten önce Kayıt Tarihi'nden önceki tarihli tahsilatı kabul etti (200).
- Kapı dışı yazım: ayrı bağlantıyla `UPDATE plans SET covers_balance = 1`.

| Kod | Kilitli canlı türetme | Açıkken (satır içi + arka plan) | Kapalıyken + yeniden açılış |
|---|---|---|---|
| 3e2e73a2 | 2 satır değişti: `plan-entry:… 09.10` alacağı **120 → 128** (150 TL) | bulgu [], günlük 0, zil 0 | sapma yok |
| 3e2e73a2^1 | aynı 2 satır | 0 / 0 / 0 | sapma yok |
| 8e90f9cf^1 | aynı 2 satır | `ledger:rule-diff` bulgusu, günlük 1, zil 1 | `ledger:rule-diff` sapması kalıyor |

UTC ve Europe/Istanbul'da sonuç aynı.

**Kök neden** (`server/lib/integrity.mjs` LOCK_SQL):
- `plans` girdisi yalnız `registered_on <= kilit` olan kartları kapsıyor.
- `plans_party_lock` girdisi yalnız `id, account_id` alıyor.
- Türetme ise taksit satırında `planCovers` ve `planDate` alanlarını kartın bu değerlerinden okuyor (`server/lib/general-ledger.mjs`, `doubtful openedOn`; ayrıca `row.opening && row.planImported && !planCovers` dalı).
- Bu yüzden Kayıt Tarihi kilitten sonra olan kartın `covers_balance` alanı izde yok.
- Kalıcı kaynak tarama testi bunu göremez: sütun başka satırlarda izde olduğu için "izde" sayılıyor (aşağıda "Kaynak tarama testi").

**Meşru yazım:** `covers_balance` yalnız kart açılırken yazılıyor (`server/routes/plans.mjs:726`). Kapıdan geçen başka yazım yok. Kayıt Tarihi 15.10 → 18.10 (200) ve toplam 600 → 700 (200) türetmeyi değiştirmedi (fark 0).

**En küçük düzeltme önerisi:**
- `since: "2.5.0"` ile yeni bir iz girdisi: `SELECT p.id, p.covers_balance FROM plans p WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM plan_entries pe WHERE pe.plan_id = p.id AND pe.date <= ?1) ORDER BY p.id`.
- Süzgeçteki "kartın kilitli tahsilatı" koşuluna `covers_balance` eklenmeli (`server/lib/integrity-scope.mjs:405` dolayı).
- Meşru yazımı olmadığı için yanlış alarm ya da yeni 409 beklenmez.

**Sakınca:** kilitli dönemde 120 ↔ 128 dağılımı sessizce değişiyor. Tur 2'nin Kural Farkı Düzeltme Fişi bunu "kural farkı" diye açık döneme yazar. Ön koşullar: carinin şüpheli kaydı olması ve kapı dışı yazım.

**Ders 46 / 53 (c):** bu ailenin üçüncü dar kontrolü de gerileme sınıfı verdi.

## Önceki bulguların kapanışı (önce = 3e2e73a2^1 → sonra = 3e2e73a2)
**G-1' — `kd2.mjs`, fikstür surum-2.0.26-zincir, kilit 05.10:**

| Kip | Önce | Sonra |
|---|---|---|
| `plan-entry-opening` (açık) | bulgu 0, günlük 0, zil 0 | ledger:snapshot + period-lock, günlük 1, zil 1 |
| `plan-entry-opening` (kapalı + açılış) | sapma yok | ledger:snapshot sapması kalıyor; zil yok (tasarım) |
| `acct-source` | önce 0 / 0 / 0 | aynı biçimde **kapandı** |
| `cash-flag`, `acct-swap` (tur 1e) | — | bulunmaya devam ediyor |
| `cheque-status` (olaysız karşılıksız) | — | türetme değişmiyor (kural farkı 44 = taban), bulgu yok — doğru |
| `cash-transfer` | bu fikstürde uygun satır yok | — |

Kendi v2.4.9 verimde (`probe.mjs`):
- `pe-opening` ve `acct-source` önce 0 / 0 / 0, sonra bulgu + günlük 1 + zil 1. İki saat diliminde de aynı.
- Kasa ↔ banka transfer bağı için bu veride betik koşmadım. O alanın kanıtı Y1 mutantının kalıcı testte `[1] … Kasa ↔ Banka transferinin bağı temizlenir` ile öldürülmesi ve testin yeşil koşusu.

**DÜŞÜK-A (önceki raporun yaşayan mutantları):**

| Mutant | Önce | Sonra |
|---|---|---|
| N3 | yaşıyordu | öldü (kaynak tarama testi) |
| N17 | yaşıyordu | öldü (`[8]`) |
| N18 | yaşıyordu | öldü (`[8]`) |
| N7 | yaşıyordu | hâlâ yaşıyor — eşdeğer |

N7 neden eşdeğer: `plan_imports` tablosu `server/lib/db.mjs:233` SCOPE_TABLES'ta değil, bu yüzden süzgecin `server/lib/integrity-scope.mjs:421` dalı hiçbir yazımda çalışmaz (ölü dal). Kapı dışı değişikliği taramadaki `plans_import_lock` görüyor.

## Yeni bulgular (DÜŞÜK)
**DÜŞÜK-1 — goc-243 testinin ara sıra kırmızısının nedeni zorlanarak üretildi (yalnız test; gerileme değil)**
- Nedeni dondurmanın bitiş anına bağlı bir yarış. Açılıştaki bekleyen 2.4.9 dondurması GET integrity'den önce biterse `failures` içinde `ledger:rule-diff` uyarısı (500 ↔ 519, 5.000 TL) çıkıyor. `test/goc-243-stok-acilis.test.mjs:79` ise `failures` boş olsun diyor.
- `DONDURMA_YARIS=bitir node test/b7-dondurma-yaris-zorla.mjs test/goc-243-stok-acilis.test.mjs 2 --ad ''` ile ön koşul gerçekleşti ve test kırmızı oldu:
  - 3e2e73a2'de 2 / 2,
  - 3e2e73a2^1'de 2 / 2.
- Normal koşuda 5 / 5 sırayla ve 4 / 4 eşzamanlı yeşil. Bir mutant koşusunda (Y22, yük 5) kendiliğinden de çıktı.
- Öneri: test, banka-220-senet-121'deki gibi ön koşulu ürünün durumundan kursun (`runPending`'i beklesin) ve kural farkını yalnız 500 / 519 için beklesin.

**DÜŞÜK-2 — yaşayan yeni mutantlar (eksik test; kod bugün doğru).** Sakınca süzgecinden geçtiler: yanlış para yok, gerileme yok.
- **Y2:** `account_source_lock`'tan `source_id` sütunu çıkarılınca hiçbir test kırmızı olmuyor. Kalıcı testin "başka evrağa" durumu `cheques_free_lock` üzerinden yakalanıyor. Stok kaynaklı satırda nedeni farklı bir harekete geçiş (600 → 610) sınanmıyor.
- **Y3:** `doubtful_skip` sütunu çıkarılınca yaşıyor. Sınanan satırın kaynağı boş olduğu için WHERE onu zaten yakalıyor; kaynaklı (ör. banka kaynaklı) bir satırda 0 → 1 sınanmıyor.
- **Y5:** `cheques_bounce_lock`'tan `has_debt` çıkarılınca yaşıyor. Bunu yalnız bu sütunun gördüğü bir hâl var: carisiz kilitli karşılıksıza dışarıdan cari yazılıp kilitten sonraya borç satırı eklenmesi. Sınanmıyor.
- **Y10:** süzgeçteki tahsil kaydı bloğundan `event_id` çıkarılınca yaşıyor.
- **Y11:** evrak yardımcısının cari satırı koşulu ters çevrilince yaşıyor.
- **Y12:** "kilitli evrağın carisi" dalı silinince yaşıyor. Y10, Y11 ve Y12'yi süzgeç ↔ kapı eşdeğerliği testi `[7]` görmüyor.
- **Y18:** `invoices_gl_lock` `since` 2.4.2 yapılınca yaşıyor.
- **Y23:** `plan_entries_bond_lock`'tan `opening` sütunu çıkarılınca yaşıyor.
- Y2, Y3, Y5, Y10, Y11, Y12, Y18 ve Y23 ikinci, daha geniş bir test listesinde de (banka-210-goc, banka-220-senet-121, banka-230-supheli-bozma, kilit-izi-alanlar) yaşadı.

**DÜŞÜK-3 — kaynak tarama testi istisna listesinin dürüstlüğünü denetlemiyor**
- Y21: izlenen bir sütun (`invoices.gl_json`) istisna listesine eklenince test yeşil kalıyor.
- Öneri: "istisnadaki sütun izde olmamalı" diye bir denetim eklenmeli.

**DÜŞÜK-4 — süzgeçte ulaşılamayan dal** (N7 ile aynı). Ya dal silinmeli ya da SCOPE_TABLES'a `plan_imports` eklenmeli.

## Türetme girdileri tablosu (kendi okumam: `server/routes/ledger.mjs` rows + `server/lib/general-ledger.mjs` journal)
Tarama belgesindeki 17 alanın hepsi bu farkla izde ya da olgu olarak kapsandı. **Listede olmayan sınıf: satır alt kümesi.** Sütun izde ama türetmenin okuduğu bazı satırlar izin satır koşulunun dışında kalıyor.

| Girdi | İzde mi | Kapı dışı değişiklik bulunuyor mu (açık / kapalı / arka plan) | Kilitli türetme değişiyor mu |
|---|---|---|---|
| plan_entries.opening, account_entries.source | evet | evet / sapma / evet | 2 / 4 satır |
| cheques.account_id (carili kilitli karşılıksız → başka cari) | olgu (free) | evet / sapma / evet | 4 satır |
| cheque_collections status / closed (iade edilmiş kayıt) | evet | evet / sapma / evet | 4 / 2 satır |
| carili kilitli karşılıksızın durumu → portföy | olgu (bounce) | alarm veriyor | 0 (türetme değişmiyor; kapı dışı, kabul edilebilir) |
| olaysız karşılıksız; carisiz → cari; kilitli karşılıksız carisiz → cari; tek karşılıksız olayının `created_at`'ı | yok | yok | **0** (K-a dayanağı doğru) |
| **plans.covers_balance** (Kayıt Tarihi kilit sonrası, tahsilatı kilitli kart) | **satır koşulu dışında** | **hayır / hayır / hayır** | **2 satır (G-3)** |
| plans.registered_on / created_at / import_id (aynı kart) | koşul dışında | — | 0 (kilit sonrası → kilit sonrası; şüpheli günü kilitte) |
| **account_entries.invoice_id** (K-b) | istisna | hayır / hayır / hayır | **2 satır** (8e90f9cf^1'de rule-diff görüyordu) |

## Kaynak tarama testinin istisnaları ve göremedikleri
- **Yöntemin sınırı:** "bir sütun herhangi bir satırda izi değiştiriyorsa izde" sayılıyor. Satır alt kümesi açıklarını göremiyor; G-3 ve invoice_id bu türden.
- **Dişi var:** türetmeye yeni sütun okuması eklenince (Y20, `cheques.due_date`) test kırmızı oluyor.
- **İstisnalar:**
  - `account_entries.invoice_id` kilitli türetmeyi GERÇEKTEN değiştiriyor (2 satır). Bilinen K-b / S160.
  - `bank_accounts.*` ve `pos_terminals.gl_sub` alt hesabı değiştirir (SINIF 3).
  - Açıklama alanlarını tek tek koşmadım.
- **Göremediği okumalar:**
  - dizin sırasıyla okunan sütun (kendisi belirtmiş),
  - yalnız eski kurallı donmuş koşu varken çalışan `oldRulePinnedPlans` sorguları (test verisinde yok),
  - satır alt kümesi.
- JSON alanlarının içi sorun değil: sütunun tamamı izde. Ayar tablosu okuması yakalanırdı, yok.

## Meşru yollar (`mesru.mjs`; kilitli v2.4.9 verisi; 30 adım; önce = 3e2e73a2^1)
- 30 adımın hepsinde yanıt kodu önce = sonra.
- Hepsi sessiz: satır içi ve arka plan taraması bulgusu yok, period-lock / ledger:snapshot sapması yok, günlük 0, zil 0, kilitli türetme farkı 0.
- Tek istisna "Geç fatura iptali": 200, fark 2, ama sessiz. Bu S160'ın durumu, iki kodda da aynı.

Denenen adımlar:
- **Evrak (bugün):** carisiz evrakın cirosu ve geri alınması; tahsili ve geri alınması; karşılıksız + cari seçimi → geri alma → yeniden karşılıksız; carili evrağı tahsile verme ve bankadan geri alma; kilitte tahsile verilmiş evrağı bankadan geri alma; carisiz tahsildeki evrağın bankada karşılıksızı (cari seçmeden, geri alma, cari seçerek). Hepsi 200.
- **Kilitli evrak:** açıklama / no düzenleme 200. Tutar düzenleme, kilitli karşılıksızı geri alma ve kilitli evrağı silme 409 (önce de 409).
- **Geç kart:** Kayıt Tarihi değişikliği, toplam değişikliği, tahsilat ve kapatma 200; silme 409.
- **Şüpheli ve tahsilat:** şüpheliden çıkarma, karşılık ayırma, açık faturaya bağlı tahsilat 200.
- **Dönem kilidi:** ilerletme, kaldırma ve yeniden koyma 200.

Yeni 409 alan istek yok.

Eski sürüm verisi:
- v2.4.9 verisinde ilk açılış + ilk tarama + yeniden açılış: bulgu yok; görünen tek şey kural farkı (EY-1).
- v2.0.26-zincir'de aynı. Ek olarak eskiden kalan bir ileri tarihli hareket satırı görünüyor; bu 3e2e73a2^1'de de var.

## Önbellek tablosu (K-c)
| Durum | Bayat iz mi |
|---|---|
| başka bağlantıdan yazım (aynı süreç ve başka süreç) | hayır — `data_version` 2 → 3 → 4 → 5 arttı (`dv.mjs`) |
| aynı bağlantıda geri alınan işlem | hayır — `total_changes` arttı (yeniden hesaplanır) |
| değer değiştirmeyen UPDATE, eklenen (ATTACH) dosyaya yazım | hayır — sayaç arttı |
| açık işlem içinde okuma | hayır — önbellek kullanılmıyor |
| kilit tarihinin değişmesi, tanım sürümü | hayır — anahtarda |
| bağlantının yeniden açılması (geri yükleme, şirket değiştirme) | hayır — her bağlantıya yeni depo nesnesi, önbellek ona bağlı |

- **Eşdeğerlik:** önbellek kapatılınca (`dataStamp` hep "") 20 / 20 sonda durumu ve 30 / 30 meşru adım birebir aynı.
- **Önbellek mutantları:** Y14 (`data_version` düşer) 25 test, Y15 (`total_changes` düşer) 2, Y16 (açık işlemde de kullanılır) 2, Y17 (sürüm düşer) 1 test kırdı.
- Bayat iz bulamadım.

## Birleşik tur 7 ile etkileşim
- `r.mjs` (satır içi ve iş parçacığı) ile `k.mjs`'in çıktıları yeni ve eski kodda aynı; yalnız rastgele kimlikler farklı.
- Komşu testler (kasa-acilis-kimlik-b7-250, acilis-519-250, sema-kapisi-bs7, kilit-izi-alanlar-250, defter-kaynak-iz-250, koruma-taban-ailesi-250): UTC 93 / 93, İstanbul 93 / 93.
- Bozulma görmedim.

## Test değişikliği (K-d)
- **Zorunlu:** eski test yeni kodda iki koşuda da kırmızı ("kilit izi göç öncesiyle aynı"; iz farklı).
- **Dişi duruyor:** Y19 (`stock_opening_lock` since 2.4.2) ve Y17 bu testte öldü.
- **Aynı deseni taşıyan başka göç testi:** grep'le bulamadım. banka-220-senet-121 eski sürümün kendi kodunu kullanıyor.
- **Ara sıra kırmızı:** nedeni yukarıda (DÜŞÜK-1); bu birleşimden gelmiyor.

## Yeni mutantlar (27 koşu; taban 103 / 103)
- **Öldü (18):** N3, N17, N18, Y1, Y4, Y6, Y7, Y8, Y9, Y13, Y14, Y15, Y16, Y17, Y19, Y20, Y22.
- **Yaşadı:** Y2, Y3, Y5, Y10, Y11, Y12, Y18, Y23 (DÜŞÜK-2) ve Y21 (DÜŞÜK-3).
- **Eşdeğer:** N7.

## Ölçüm
Ölçümün çoğu geçersiz; kilit konunca arka planda çalışan dondurma için **geçerli bir eski ↔ yeni çifti ÖLÇÜLEMEDİ**.
- İlk koşuda ölçüm kilidini aldım. Eski kodun turu yük 1,23'te geçerli: dondurma 8.168 ms.
- Yeni kodun turu yük 1,35'te başladı ama koşu sırasında yük 10,9'a çıktı (başka bir süreç): 37.308 ms, GEÇERSİZ.
- İkinci tur yük 13,5 / 2,4'te başladı, GEÇERSİZ: eski 8.478 ms, yeni 8.772 ms.
- Üçüncü denemede kilit doluydu.
- Kabaca +4 … +7 %, S161'den (+18 %) belirgin farklı değil.

Kilit izinin önbelleksiz yolları:
- İşlem içindeki kilit izi: eski ~2,1 sn → yeni ~2,9 sn (+37 %, bilinen).
- Yazımdan sonraki ilk Mutabakat Testi daha kötü değil: eski 13,4–14,0 sn, yeni 12,5–13,3 sn.
- Yazım olmadan yinelenen Mutabakat Testi: eski 13,5 sn → yeni 8,9 sn.

**Kilitsiz okuma yolları:** sayaçla gösterildi.
- Kilitsiz veride Mizan, Alacak Yaşlandırma, evrak yazımı ve Mutabakat Testi boyunca hazırlanan SQL'ler sayıldı. Önbellek damgası, yeni iz girdileri, evrak olgu sorgusu ve LOCK_SQL'in kendisi: **0** kez.
- Kod da aynı şeyi söylüyor: `lockDigestOf` ve `lockRelevant` kilit yoksa hemen dönüyor.
- Yani bu fark kilitsiz yollarda çalışmıyor; ana oturumun gördüğü küçük pay bu koddan gelemez.

## Baş mimar kararlarının değerlendirmesi
- **K-a — doğru.**
  - Olaysız karşılıksız durumu ve carisiz evrağa cari yazımı türetmeyi değiştirmiyor (fark 0, sayıyla).
  - Olguların dışında türetmeyi değiştiren tek evrak hâli carili evrağın başka cariye geçmesi; o da `cheques_free_lock` ile bulunuyor.
  - Kapıdan geçen 14 evrak işlemi sessiz.
  - Kapı dışından yalnız durum değişikliği (türetme değişmeden) alarm veriyor. Meşru yolu yok, kabul edilebilir.
- **K-b:**
  - (i) Kilitli tahsilatın bağını meşru yoldan değiştiren yollar:
    - fatura iptali (S160'ta var; fark 2, sessiz),
    - fatura silme (iptali çağırıyor; S160'ta var),
    - cari hareketi düzenleme: 409,
    - **POS komisyon faturası kaydı** (`linkFees`, `server/lib/bank/pos.mjs:519`): kilit denetimi yok; kilitli aydaki banka kaynaklı kesinti / iade satırlarına bağ yazar. Etkisi yalnız sağlayıcı carisinin şüphelisi varsa olur. Betikle denemedim: DOĞRULANMADI.
    - Cari birleştirme programda yok. Mahsup / Kapatılacak Fatura yalnız yeni satıra bağ yazar.
  - (ii) Bağ kapı dışından değişince yeni ve eski kodda hiçbir denetim görmüyor (`bind-set`, `bind-clear`: fark 2; 0 / 0 / 0). 8e90f9cf^1'de `ledger:rule-diff` görüyordu. S160 yalnız meşru yolları reddediyor, kapı dışını kapatmıyor → tur 2'de iz girdisi de gerekir. POS yolunun 409'a dönmemesine dikkat edilmeli.
- **K-c — doğru** (önbellek tablosu).
- **K-d — doğru;** ara sıra kırmızının nedeni ayrı ve birleşimden gelmiyor.
- **K-e — doğru.**
  - Pencereler body'ye ekleniyor (`client/assets/hof-core.js:1195`). Yeni seçici en sondaki görünür, yani en üstteki pencereyi seçiyor.
  - Doğal koşu 25 / 25, `HOF_ZORLA=div` ile 25 / 25 (14 zorlama satırı).
  - Diş kaybı görmedim.

## Tur 2 için
**Kural farkı fişine bugün karışabilecek bozulmalar:**
- G-3 (Kayıt Tarihi kilitten sonra olan kartın Mevcut Borcu Taksitlendir alanı),
- `account_entries.invoice_id`: S160 yolları, POS bağlama ve kapı dışı,
- "Açılış Olabilir" durumu ile kopyasının birlikte değişmesi,
- SINIF 3: POS alt hesabı, sunucunun saat dilimi, satır sırası,
- yüklenen kartın kilit sonrası tarihli açılış satırı.

**Fişten önce temiz olması gerekenler:** ledger:snapshot, period-lock, opening:review, money:event, opening:519, bank:sub, cheque:collections, gl:101, ve G-3 ile invoice_id için konacak iz girdileri.

## KULLANICIYA SORULMALI
Yeni soru yok. invoice_id para kuralı S160'ta yanıtlanmış.

## DOĞRULANMADI
- POS `linkFees` yolunun kilitli defteri değiştirmesi.
- `bank_accounts.kind` dışarıdan değişince bank:sub denetiminin görmesi.
- Açıklama istisnalarının her biri.

## DENENMEYEN
- Geçerli dondurma ölçüm çifti.
- Kilit = bugün / dün / yıl sonu.
- Dondurma sürerken işlemler.
- Şirket Verisini Sıfırla, iki şirket ve geri yükleme (kendi betiğimle; kalıcı test `[5]` yeşil).
- Bütün ekran senaryoları (yalnız senaryo-220 koştu).
- Sıfırla / geri yükle sırasında önbellek.
- Yarıda kesilme.

## Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a1f-q`

- **Betikler:** `probe.mjs`, `cases.sh`, `mesru.mjs`, `mesru.sh`, `kd2.mjs`, `sonra.sh`, `b7/`, `mutant.py`, `mutkos.sh`, `kos.sh`, `onbelleksiz.py`, `zorla.sh`, `s220.sh`, `olc.mjs`, `olc.sh`, `dv.mjs`.
- **v2.4.9 verisi:** `tpl/`.
- **Çıktılar:** `yeni.jsonl`, `eski.jsonl`, `c5aonce.jsonl`, `yeni-utc.jsonl`, `onbelleksiz.jsonl`, `mesru-*.jsonl`, `kd2-*.jsonl`, `b7-*.json`, `kos-*.out`, `zorla-*.out`, `olc-1.jsonl`.
- Eski kod kopyalarımı (3e2e73a2^1, 8e90f9cf^1) sildim.
