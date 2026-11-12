# DAR KONTROL — Ç5-A tur 1 (birleşim 8e90f9cf)

Worktree `claude/epic-thompson-w0lc2l` ucuna (277d3eaa) sıfırlandı. Düzeltme, commit ve push yapılmadı.
Ortam (sonda): yük 0,97 / 4 çekirdek, boş bellek 6 GB, boş disk **4,8 GB — 5 GB sınırının altında**. Benim kopyalarım silindi (not defterim 3,6 MB). Düşüş başka işlerden.

**Sonuç: YÜKSEK yok. ORTA 3; bunların ikisi gerileme (G-1, G-2).**

## GERİLEMELER (ders 46 izleme — bu aile önceden de üst üste gerileme vermişti)

### G-1 (ORTA) — Kilitli dönemde kapı dışından yapılan bozulma artık bulunmuyor
**Neye göre:** 8e90f9cf^1'e göre (açılış tanıma girdisi açısından v2.4.9'a göre de).

**Betik:** `.../dk-c5a1-x9/kd.mjs`, fikstür surum-2.0.26-zincir (kilit 2026-10-05). Değişiklik dondurmadan sonra ayrı bağlantıyla yazıldı. Sonuç UTC'de ve Europe/Istanbul'da aynı.

| Kapı dışı değişiklik (kilitli dönem) | 8e90f9cf^1 | 8e90f9cf |
|---|---|---|
| `cash_entries.is_opening` 0→1 (563,57 TL; defterde 649 ↔ 519) | bulgu `ledger:rule-diff`, günlük 1, zil var | bulgu yok, günlük 0, zil yok (kural farkı 44→45 madde, yalnız uyarı) |
| `account_entries.note` → "Açılış…" (eski kural açıklamadan tanıyordu) | günlük 1, zil var | türetmeyi etkilemiyor |
| `account_entries.is_opening` 0→1 (5.095,04 TL) | türetmede yoktu | günlük 0, zil yok |
| `account_entries.is_opening` 1→0 (900 TL; 519 → 602) | türetmede yoktu | günlük 0; kural farkının sayısı (44) ve tutarı (127.800) bile **değişmiyor**, yalnız hesap dağılımı değişiyor |
| `plans.import_id` konuldu (28.000 TL kart) | türetmede yoktu | günlük 0, zil yok |

**Kök neden:**
- `server/lib/integrity.mjs:838` `driftsOf`, kural farkını sapma kümesinden çıkarıyor.
- Türetmenin yeni girdileri kilit izinde (LOCK_SQL, :124–236) yok: `cash_entries.is_opening`, `account_entries.is_opening` / `opening_review`, `cheques.is_opening`, `plans.import_id`, `plan_imports.created_at`. Göç 48 / 49 yorumu ve B4 bunu "bilinçli sınır" diye yazıyor.
- "Açılış Karşılığı" denetimi iki yanı da canlı türetmeden okuyor; bu yüzden yakalamıyor (opening:519 ok, defter = alt defter).
- Sonuç: kapı dışı bozulma yalnız uyarı satırında kalıyor. Tur 2'nin Kural Farkı Düzeltme Fişi bu bozulmayı "kural farkı" diye açık döneme yazar.

**En küçük düzeltme önerisi:** kural farkı sapma kümesinin dışında kalsın, ama dökümünün parmak izi (yıl / hesap / alt hesap / cari + sayı) taban olarak tutulsun. Taban her biten dondurmada ve kapının kabul ettiği her KG-16 kararından sonra yenilensin. Açıklanamayan değişim günlüğe ve zile "kural farkı değişti (kapının görmediği yazım)" diye yazılsın (`noticeGrowth` gibi). İkinci yol: bayrakları kilit izine `since` ile eklemek. Ama `opening_review` kilitli satırda kapıdan geçerek değişebiliyor (K8-2), o yüzden ikinci yol tek başına yetmez.

**Test eksiği:** kural-farki-alarm-250 [3] yalnız tutar değişimini (LOCK_SQL'deki alan) deniyor. Bayrak değişimini deneyen test yok.

### G-2 (ORTA) — Onaylı açılış Silinenler'den geri alınınca gelire düşüyor
**Neye göre:** v2.4.9'a ve 8e90f9cf^1'e göre.

**Betik:** `.../dk-c5a1-x9/s51.mjs`.
1. v2.4.9'un gerçek koduyla cari açıldı (açılış 800 TL) ve "Açılış devri (ikinci)" açıklamalı 300 TL Borç Yaz girildi.
2. Güncel kodla açıldı: göç 48 satırı `candidate` yaptı; defterde 120 B 300 / 519 A 300.
3. Onaylandı (`confirmed`): defter aynı.
4. Silinip Silinenler'den geri alındı: `opening_review ''`; defterde **120 B 300 / 602 A 300**. Mutabakat Testi temiz, fark hiçbir yerde görünmüyor.

Eski kodda açıklama korunduğu için satır açılış (500) kalıyordu.

**Kök neden:**
- `server/routes/accounts.mjs:973` silme yükü `opening_review` taşımıyor.
- `server/routes/accounts.mjs:2075` geri alma INSERT'i `opening_review` yazmıyor.
- `lib/ledger-opening.mjs`'teki `restoredOpeningReview` (B8 / S51 bağlantı noktası) hiçbir yerden çağrılmıyor (grep).

D "11.11 07:20" S51'i tur 1'e koymuştu. D satır 442 (g) bunu "Ç5-B girdikten sonra" diye bıraktı; Ç5-B 8d6ea9c9 ile girdi, ama 8e90f9cf'de bağlanmadı. S51'in kendi örneği (açılış silinir, cari başka açılış alır, eskisi geri alınır) koda göre aynı yoldan `''` döner. Bu örneği ayrıca koşmadım.

**En küçük düzeltme önerisi:** silme yüküne `openingReview` eklensin; geri alma INSERT'i `restoredOpeningReview(payload, restoredOpening(...))` yazsın; test eklensin.

## Öbür bulgular

- **ORTA-3 (uç; sakınca süzgeciyle — yanlış defter):** göç 48'in SQL ön süzgeci (`migrations.mjs`, `ltrim(note, ' \t\n\r nbsp') LIKE 'a%'`) JS katlamasından dar.
  - Başında U+2003, U+FEFF, U+3000 ya da U+2028 olan "Açılış…" açıklaması aday olmuyor (betik `bosluk.mjs`: sql 0, js true).
  - v2.4.9 bu satırları açılış sayıyordu (500, `.trim()` ile); güncel kod 602 / 770'e yazıyor.
  - `restoredOpeningReview` aynı açıklamaya aday diyor (iç tutarsızlık).
  - Düzeltme: ön süzgeç kaldırılsın ya da JS'teki boşluk kümesiyle aynı yapılsın.
- **DÜŞÜK-1 (yaşayan mutantlar = eksik test; kod doğru):**
  - A1: S127 bölgesinin `<=` sınırı `<` yapılınca yakalanmıyor. Kilit günündeki madde denenmemiş. Sakınca süzgeci: kod bozulursa yanlış defter olur — test eklenmeli.
  - A8: taksite bağlı carisiz evrak Alacak Yaşlandırması'ndan düşse de yakalanmıyor.
  - A16: göç 49'un "ilk olay" şartı kalksa da yakalanmıyor.
- **DÜŞÜK-2:** `test/b7-dondurma-yaris-zorla.mjs` süresi dolan yinelemeyi kanıtsız "ön koşul GERÇEKLEŞTİ" sayıyor. Sonuç kırmızı sayıldığı için yanlış yeşil üretmiyor; sayaç şişiyor. Sakınca yok.
- **DÜŞÜK-3 (tur 2 için):** "Açılış Olabilir" uçlarında sayfalama ve toplu karar yok. Göçten sonra yüzlerce aday satırın her biri tek tek ve ayrı kapıdan geçer. Karar verilmiş satır adaya geri döndürülemiyor (yalnız onay ↔ ret).

## Sapma kümesi değerlendirmesi
Kilit izindeki alanların değişimi hâlâ bulunuyor: kural-farki-alarm [3] (tutar) yeşil; A3 mutantı (bütün `ledger:*` sapma dışı) bu testle yakalandı. Bulunmayanlar G-1 tablosundaki bayraklar.

Taban ↔ yazım kapısı: tam kapı `run({events})` ile koşuyor; donmuş defter denetimleri orada koşmuyor. Tabanda olmayan kural farkı yazımı ne tam kapıya düşürüyor ne engelliyor (koddan; koruma-taban testi yeşil).

## Göç fark tablosu (aynı fikstür; 8e90f9cf^1 → 8e90f9cf, Ana Defter mizanı)
- **2.0.24-zincir 001 (kilitli):** mizan aynı; canlı türetmede 500 → 519: −127.800. 002 / 007 / 004: 500 → 519 (−29.300 / −44.200 / −32.200).
- **2.0.26-zincir 001:** 602 +750, 649 −750 (S49 formdan carisiz evrak). Öbür şirketlerde 500 → 519.
- **2.0.26-turler 001:** 500 −126.650 → −127.800 (donmuş), 519 −3.650, 602 +5.550, 649 −750. KG-5 (T = 4.800, P = 1.150) + S49 ile açıklanıyor. 002: 500 −28.150 → 0, 519 −32.950, 602 +4.800.
- **2.4.3-baslarken:** fark yok.
- **2.4.9-s127 (kilitli):** 500 −10.100 → −11.900 (donmuş), 519 −4.000, 602 −16.200 → −10.400. Toplam −26.300 aynı (S127 + KG-5).
- **2.4.9-s127-kilitsiz:** 500 → 0, 519 −26.300, 602 → 0.

Hepsi karar numaralı (KG-1, KG-5, S49, S127); açıklanmamış fark yok. Ek bulgu: Mutabakat Testi'nde yeni gelen tek satır `ledger:rule-diff` (uyarı).

(Betiğim 002+ şirketlerin canlı türetmesini yanlış şirketten okudu; o satırlar için yalnız mizan değeri geçerli.)

## Mutantlar (16; depodaki listelerden farklı; 39 değişen test dosyası; tabanda 455/455 yeşil)
- **YAKALANDI (13):** A2 ters yön, A3 sapma süzgecinin genişlemesi, A4 göç 48'de Alacak Yaz, A5 süzgeçli yolun kapsamı, A6 S47 geri, A7 carisiz karşılıksız 602, A9 bekleyen kesit, A10 ikinci yükleyicide çift sayım, A11 kilit geri çekilmesinin (thaw) kırpması, A12 K8-1, A13 B15 takma adı, A14 sıralama sınıfı, A15 karşılıksızın sınıfı.
- **YAŞADI (3):** A1, A8, A16 (DÜŞÜK-1).

Sonuçlar `.../dk-c5a1-x9/mutant-sonuc.json` ve `kos-mut-*.out` dosyalarında.

## Test değişikliklerinin değerlendirmesi (gevşetme yok)
- **koruma-taban-ailesi-250:** sapma süzgeci `driftsOf` ile aynı yapıldı. Kararın zorunlu sonucu, ama G-1'i göremez.
- **banka-220-senet-121:** eşitlik yerine kesin döküm denetleniyor (count 2, fark 100.200, dört hesap) ve "günlükte tarama satırı 0" denetimi eklendi. Sıkılaştı.
- **senaryo-iz1-kasa-acilis:** 500 beklentisi 519 + "500 boş" oldu. Sıkılaştı.
- **banka-210-gg-tarama:** eski test dondurmanın bitmesini bekliyor; "sürerken / bitince" yeni testte. Net kayıp yok.
- Mutantlarla diş görüldü: A2 / A5 / A9 / A11 s127 testlerinde, A3 kural farkı testinde yakalandı.

## Hız ve geçersiz kılma
- Bu farkta yeni önbellek yok (grep). Süzgeçli ↔ süzgeçsiz S127 kararı A5 / A9 mutantlarıyla sınandı, yakalandı.
- **Soğuk ilk çağrı ölçümü** (temiz-100k, eski kodla 2026-06-30'a kilitlendi; `flock -x`; tur 1 eski GEÇERSİZ, yük 2,10):

| Yol | eski (tur 2, yük 1,10) | yeni (tur 1, yük 1,36) | yeni (tur 2, yük 1,05) |
|---|---|---|---|
| Ana Defter, İLK çağrı | 3.787 ms | 3.509 ms | 3.608 ms |
| Ana Defter, sonraki çağrılar | ~3.080–3.140 ms | ~2.920–3.220 ms | ~2.920–3.220 ms |
| Mutabakat Testi, İLK çağrı | 14.050 ms | 13.746 ms | 13.595 ms |
| Mutabakat Testi, sonraki çağrılar | 12.800–13.080 ms | 12.760–13.450 ms | 12.760–13.450 ms |
| Açılış | 25,96 s | 28,69 s | 26,59 s (+0,63 s, %2,4) |

  Gerileme yok. Hesap mizanı rapor adresini yanlış verdim (404) — ÖLÇÜLMEDİ.

## Baş mimar yorumlarının değerlendirmesi
- **12.11 03:57 (a):** uygun; s127'de toplam aynı (−26.300).
- **11.11 16:12 ters yön:** kodda var, testle sınanıyor (A2 yakalandı).
- **12.11 12:59 / tur 1d** ("kural farkı uyarıdır; kapı dışı değişiklik kendi denetimleriyle bulunur"): ilk taramadaki yanlış alarm gerçekten yanlıştı, bu kısım doğru. "Kendi denetimleriyle bulunur" kısmı Ç5-A'nın yeni bayrakları için **yanlış** (G-1).
- **11.11 07:20:** S51 tur 1'deydi, bağlanmadı (G-2).
- **B15:** doğru (A13 yakalandı).
- **EY-1:** başka bir yerde "sapma" diye görünmüyor. Yönetim ekranı (`admin.js:1144`) bilinen yer. Defter Mutabakatı kural farkını "Kural Değişikliği Farkı" diye ayırıyor. Zil ve açılış günlüğü `driftsOf` kullanıyor. Mobil özet ve yedek akışı Mutabakat sonucunu okumuyor (grep).

## Tur 2 için veri ve uç yeterliliği
- Açılış Eşleştirme için `openingCounterpart` parçaları ve Kural Farkı Düzeltme Fişi için yıl / hesap / alt hesap / cari dökümü yeterli.
- "Açılış Olabilir" ekranı için eksikler: sayfalama, toplu karar, `opening_review`'in Silinenler'den dönüşte korunması (G-2).
- Yetki `accounts.manage`; 403 testte var (A12 testi).

## KULLANICIYA SORULMALI
Yok. G-1 düzeltmesi bir mekanizma işi; G-2 kullanıcının S51 = A kararının uygulanması; ORTA-3 B6'nın uygulanması.

## DOĞRULANMADI
- S51'in kendi örneği betikle koşulmadı (koddan kesin).
- U+2003 / BOM'lu açıklamanın gerçek veride olup olmadığı bilinmiyor.

## DENENMEYEN
- Ekrandan yürüyüş (Ana Defter, Mizan, Yevmiye, Mutabakat Testi, Kural Değişikliği Farkı raporu).
- Dondurma yarışı, süreç ölümü, iki şirket, dondurma sürerken kilit kaldırma beklemesi.
- Yedekten geri yükleme ve kilit ilerletme / kaldırma senaryoları (yalnız mutantlarla).
- Gün / yıl dönümü.
- Raporların bütün süzgeçleri; Alacak Yaşlandırma toplamı ↔ cari toplamı.
- Rapor Merkezi hesap mizanının ölçümü.
- E2E senaryoları.

## Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a1-x9` — betikler `kd.mjs`, `mz.mjs`, `mzfark.py`, `s51.mjs`, `bosluk.mjs`, `mutant.py`, `soguk.mjs`, `olcum.sh` ve çıktılarıyla. Kod kopyalarım ve /dev/shm kopyası silindi.

Test yardımcısı (surumler.mjs) v2.4.9 kodunu ortak önbelleğe çıkarmış olabilir: /tmp/destekofis-surum-kodu.
