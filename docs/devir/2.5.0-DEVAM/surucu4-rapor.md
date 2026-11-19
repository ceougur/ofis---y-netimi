## Muhasebe sürücüsü bakımı 4 — rapor

Sürücüyü programın Ç7b sonrası hâline ve kâhinin bakım 13'e göre güncellenmiş hâline uyarladım. Son koşuda sınıflanmamış fark kalmadı. Kalan kırmızılar iki eski program hatası, bir eski belirsiz kural ve bir yeni belirsiz kural; yenisi kullanıcıya soru olarak aşağıda. İki bilinçli hatanın ikisi de yakalandı. Ç7b öncesi kodla karşılaştırmada çıkan farkların hepsi bir Ç7b kuralıyla açıklandı.

- **Dal:** `worktree-agent-afb4030486d151db9`, uç **616b07a5**. Push yapmadım.
- Program kodu, kâhin klasörleri ve zamanlanmış görev: dokunulmadı / kurulmadı.
- Ortam (son ölçüm): yük 2,0 / 4 çekirdek, boş bellek 4 GB, boş disk 5,5 GB. Kendi /dev/shm klasörümü sildim.

### Hazırlık ve önemli bir not
- `surucu4-taban` = 301c0e29, `git log` ile doğruladım.
- **Bu taban sürücü bakımı 3'ün kodunu taşımıyordu.** Sürücü 9c09f18d'deki hâlindeydi; bakım 3 yalnız ana dalda (8a5118ef). Bakım 3'ün yedi kod commit'ini (6156a84b..39f58844, yalnız `test/bagimsiz/muhasebe-surucu/`) önce cherry-pick ettim. Kanıt commit'ini almadım.

### Yapılan eşlemeler (commit'ler)
**61143a60:**
- BUGÜN görünümünden kalkan dönüşümler: KG2-H03, KG3-KAYIT, KG8-IADE-KDV, KG24-IHRACAT, F06-GIDER-TURU ve `KG7 = B`. Bugün dalı artık kâhinin dalıyla aynı.
- Alış faturasında `indirim_ayi` → programın `vatPeriod` alanı (gelen SMM için de). Sınır dışı dönemde program `400 vat-period-range` veriyor, kâhin `KDV_INDIRIM_DONEMI` reddi; red ikisinde de var, AYNI.
- S190: banka / kart açılışının Sil'i = Banka Hesapları › hesabı Sil (`DELETE /bank/accounts/:id`).
- `susmalar` S192: yalnız listelenen raporda, o carinin satırları karşılaştırılmıyor ve atlanan anahtar SUSMA olarak sayılıyor. Açık Faturalar'da carinin toplamı ayrıca karşılaştırılıyor.
- siniflama.json'dan 16 kural kalktı: P2, KG8/SONUC, s93, s108, s42, s51, s62, s111 (S180), s78, s104.

**70a206a8:**
- F-06'daki finansman (780) **U** olarak kaldı, kimliği `2.5.1-Ç7b-B1`. Dayanak: tasarım notu §9 "B-1 = B: 780 türü ve tanınmayan türün 770.90'ı 2.5.1". Bu yüzden görev metnindeki "F-06 / M14 artık U değil" ifadesi finansman için geçerli değil.
- Silinen hesabın alt hesap kodu eşlemede tutuluyor.
- s104: `yedekten` Kasa açılışı, eski sürüm aşamasında yedekten bloğunun başına alınıyor. v2.4.9 açılışı ilk hareketten sonra kabul etmiyor (409); yedekteki veri aynı kalıyor. Eski sürümden geçiş artık programdaki son eski olaydan sonra yapılıyor.

**362fbea9:** R kuralı `R-S192-BAG-SONRA` (rastgele-1 C4, rastgele-2 C3; aşağıda).

**be7ff30d:** Ateşlemeyen eskimiş kurallar kalktı: P5-S4 (Ç7b sonrası s43'te program = kâhin; c7b2-taban'da ateşliyordu), K6, K3.

**616b07a5:** Kanıt commit'i.

Uygulanamayan olay kalmadı (0).

### İki saat dilimi sınıf tablosu (120 senaryo; çıkış kodu 1, çünkü P ve R kırmızı sayılıyor)
| Koşu | AYNI | U | P | K | R | SINIFLANMADI | ÖLÇÜLEMEDİ | SUSMA | red farkı / uygulanamayan / sınıfsız adım | # fail |
|---|---|---|---|---|---|---|---|---|---|---|
| Önceki sürücü (bakım 3), aynı taban | 7.082 | 558 | 34 | 2 | 2 | 80 | 120 | 24 | 4 / 2 / 216 | 340 |
| Yeni sürücü, son koşu (be7ff30d) | 7.054 | 524 | 34 | 0 | 28 | **0** | 118 | 22 | **0 / 0 / 0** | 62 |

- UTC ile İstanbul aynı. Tek fark s91'deki R-B5: UTC'de 2, İstanbul'da 0 (eski R).
- Öz denetim bozuk 0, değişmez 0, koşu hatası 0.
- Kırmızı senaryolar:
  - rastgele-1: R 13 × 2.
  - rastgele-2: yalnız 3 R adım; rapor satırı yok.
  - s82: P6 (1 × 2).
  - s91: P7 (8 × 2) ve R-B5.
- Senaryo × sınıf tablosunun tamamı `docs/kanit/2026-11-19/surucu4-son-tablo.txt` içinde (önceki sürücü ve Ç7b öncesi kod için de tablo var).
- Kâhin bakımı 13'ün değiştirdiği senaryolar programla AYNI: s114, s115, s116, s117, s62 (127 eşleştirme reddi iki yanda), s111 (S197 = B), s108 (PKT reddi iki yanda), s51, s78, s104, s43, s05, s11, s02.
- Bekleyen U'lar (kimlik: senaryo / denetim, UTC): 2.5.1-Ç7b-B1 4/44 · D2–D4 28/30 · D4-(7) 1/1 · D4-GERI-AL 1/1 · GÖRÜNÜM-YOK 30/74 + 1/1 · Ç5-B1 1/1 · Ç5-C 25/135 · Ç7b (S15 = A) 2/3 · Ç7b-(4) 2/3 · Ç7b-(6) 2/12.
- SUSMA (UTC): S192 olarak s42'de 5, s81'de 2, s108'de 1 satır; S168 olarak s68'de 1; diğer 2 (s95). Ayrıca adım susması 4, ara adım susması 8.

### P / K / SINIFLANMADI ayrıntısı
- **Yeni P yok, K yok, SINIFLANMADI yok.**
- Eski P'ler değişmedi: P6 (s82, s103, s81, s94) ve P7 (s91).

**Yeni R — `R-S192-BAG-SONRA`** (bkz. KULLANICIYA SORULMALI 1):
- Durum: şüpheliye almadan ÖNCE bağsız ödemeyle kapanmış faturaya, şüpheliye almadan SONRA bağlı tahsilat geliyor.
- En küçük örnek (`docs/kanit/2026-11-19/surucu4-en-kucuk/ek-bag-sonra*`, iki saat diliminde aynı):
  - Olaylar: F1 1.000 (vade 10.01), F2 1.000 (vade 20.01), F3 2.000; P1 bağsız 1.000 (15.01); Şüpheliye Al 1.000 (01.02); P2 1.000, F1'e bağlı (10.02).
  - Kâhin: 120 = 2.000, 128 = 0.
  - Program: 120 = 1.000, 128 = 1.000.
- Kök neden:
  - Kâhin, 05.11 kararı (2) 24 = A'yı ("bağ hedefini her durumda kapatır; hedefi önceden kapatmış bağsız ödeme serbest kalır ve kendi tarihinde yeniden dağılır") S192 tek kuyruğuyla birlikte uyguluyor. Böylece F1 şüpheliye alma gününde açık sayılıyor ve tahsilat 128'den düşüyor.
  - Program şüpheli payını tahsilat anındaki kuyruktan alıyor. F1 bağsızla kapanmış göründüğü için pay 0 ve tahsilat 120'ye gidiyor.
- c7b2-taban'da da aynı (`ek-bag-sonra-c7b2-taban-UTC.out`), yani Ç7b gerilemesi değil.
- Daha önce görünmüyordu, çünkü kâhin bakım 12 rastgele-1 C4 ve rastgele-2 C3'te burada susuyordu; bakım 13 bu susmaları kaldırdı.
- rastgele-1'deki örnek: P308 (24.07, F109'a bağlı), 472.560 tutarında; karşılık çözülmesi 460.117 (644).
- rastgele-2'deki örnek: P253 (07.08, F88'e bağlı). Aynı carinin sonraki alacak satırları bu farkın sonucu.

**Ek gözlem (paket senaryolarında görünmüyor; yalnız en küçük örnekte, `ek-supheli-acik`):**
- Açık Faturalar raporunda şüpheliye alınmış faturayı program 1.000 ile gösteriyor, kâhin hiç listelemiyor (kâhinin `acik_faturalar`'ı şüpheli kuyruğunu dışarıda tutuyor).
- Bakiye aynı. Sorulmalı 2'ye yazdım.

### Gerileme dökümü (Ç7b öncesi kod `c7b2-taban` ↔ son koşu, aynı sürücü)
- 240 koşunun 182'si birebir, **58'i farklı** (iki saat diliminde 29'ar senaryo). Hepsi bir Ç7b kuralına atfedildi, **açıklanmayan 0** (`surucu4-gerileme.txt`, `surucu4-gerileme-atif.txt`).
- Atıf:
  - KG-2 (taksit Yeni Borç 602 → 600.90): 18 senaryo.
  - KG-24 (601): rastgele-1/2/3 ve s02.
  - KG-8 / F-08 + B-6 / KG-7: rastgele-1/2/3, s05, s114, s115, s28, s34, s43.
  - KG-3 336.90 (+ geçiş günü): s11, s114. Eski alt hesap 602.90: s111.
  - 649.90: s53, s64.
  - Red ya da kabulü değişen olaylar: s115'in iki faturası `vat-period-range` ile reddediliyor; s28'in Ocak mahsubu red → kabul.
- Her farklı senaryo, eski kodda sınıflanmamış kırmızı verirken yeni kodda 0 veriyor. Tek istisna s43: eski kodda P5 ile sınıflıydı, şimdi AYNI.
- Önceki tam koşu (362fbea9) ile son koşu (be7ff30d) arasında program çıktısı 240 / 240 birebir.

### Testin dişi (`surucu4-mutantlar.txt`)
Programın ayrı kopyasında, `general-ledger.mjs` içinde tek satırlık iki bilinçli hata:
- **mutant1 — satıştan iade KDV'si her zaman B 391:** 12 senaryoda fail 140 (red farkı 60, SINIFLANMADI 22, değişmez 4). Yakalayanlar: rastgele-1/2/3, s05, s114, s28, s34.
- **mutant2 — kayıt tahsilatı her zaman 602:** s11 ve s114'te fail 28 (SINIFLANMADI 20, red farkı 2, değişmez 4).
- İkisi de yakalandı.
- Kendi betik hatam: ilk mutant koşusunda çıktı klasörü mutant kopyasıyla aynı adı taşıyordu ve kopyayı sildi. `kod-mutantN` adıyla yeniden ürettim; sayılar ikinci koşunun.

### KULLANICIYA SORULMALI
1. **Şüpheliye almadan önce bağsızla kapanmış faturaya sonradan bağlı tahsilat.** Para / defter kuralı (ders 43); bakiyenin 120 / 128 / 644 dağılımı seçeneğe göre değişiyor. Uç durum değil: rastgele verinin ikisinde çıktı.
   - **A (kâhinin okuması, 24 = A ile S192'nin birlikte uygulanması):** serbest kalan bağsız ödeme yeniden dağılır, bağlı fatura şüpheli sayılır, tahsilat 128'den düşer. Örnekte 120 = 2.000, 128 = 0; şüpheli kaydı kapanır.
   - **B (program bugün):** şüpheli payı tahsilat anındaki kuyruktan alınır; fatura kapanmış sayıldığı için tahsilat 120'ye gider. Örnekte 120 = 1.000, 128 = 1.000; şüpheli kaydı 1.000 açık kalır.
   - **C:** uç durum böyle kalsın (BİLİNEN SINIR, kâhin susar).
   - Önerim A: B'de bütün borcunu ödemiş görünen cari şüpheli kaydını açık tutuyor. Yaygın programlarda nasıl yapıldığına dair doğrulanmış dayanak yok.
2. **Açık Faturalar raporu şüpheliye alınmış faturayı göstersin mi?** Rapor kuralı; bakiye aynı. Paket senaryolarında çıkmadı, yalnız en küçük örnekte.
   - **A:** göstermesin (kâhin).
   - **B:** göstersin (program bugün).
   - **C:** uç durum böyle kalsın.
   - Önerim B: fatura hâlâ ödenmemiş; şüpheli olduğu ayrı belirtilir. Öneriye dayanak bulmadım.

### DENENMEYEN
- S192'nin üç özel sınıfı ve S203 / S204: kâhin susuyor.
- KG-2, KG-24 ve .90 alt hesaplarının 2.4.9 farkı: kâhin bakımı 13'te de denenmedi.
- Kilitsiz güncellemede B-6: muhasebe kâhini bunu kuramıyor.
- KDV Özeti (B-11 ve gün yorumu): kâhinde yok.
- Faturayı Düzenle ile dönem değiştirme: senaryo yok.
- `indirim_ayi` taşıyan banka masrafı faturası ve POS komisyon faturası: senaryo yok, programda alan da yok (bu durumda "eksik" yazılıyor).
- Devir (D2–D4) ve Ödeme Sözü (Ç5-C): uygulanmadı (U).
- Açık kalem ve kilit bağ notu raporları programdan okunmuyor (GÖRÜNÜM-YOK).
- Fiş ters kaydı ekrandan değil, API'nin tarih alanıyla sınandı.
- Geçmiş günlü raporlarda ÖLÇÜLEMEDİ 118 satır var; önceki 120'nin altına indi.

### Ana oturumun yeniden koşacağı komutlar (worktree kökünde)
- Tam koşu (yaklaşık 15–20 dakika): `KANIT_DIR=<not defteri> flock -s -w 3600 <scratchpad>/olcum.lock node tools/kanit.mjs kos surucu4-yeniden -- node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/kos.mjs --cikti <klasör> --veri <klasör>`
  - Beklenen (iki saat dilimi toplam): AYNI 7.054 · U 524 · P 34 · K 0 · R 28 · SINIFLANMADI 0 · ÖLÇÜLEMEDİ 118 · SUSMA 22 · red farkı 0 · sınıfsız adım 0 · # fail 62.
- Ç7b öncesi kod: aynı komuta `--program /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/surucu4-afb4/eski` (bu kopya `git archive c7b2-taban` ile üretildi; iş bitince tam yoluyla silinebilir). Beklenen # fail 764.
- Gerileme: `python3 -I test/bagimsiz/muhasebe-surucu/gerileme.py <eski çıktı> <yeni çıktı>` → 58 / 240 farklı.
- Atıf: `python3 -I docs/kanit/2026-11-19/surucu4-arac/gerileme-atif.py <eski> <yeni> test/bagimsiz/muhasebe-surucu/gerileme.py` → açıklanmayan 0.
- Mutantlar: `python3 -I docs/kanit/2026-11-19/surucu4-arac/mutant.py <kopya> mutant1|mutant2`, ardından `bash docs/kanit/2026-11-19/surucu4-arac/kos-tam.sh <ad> <kopya> <süzgeç>`. Çıktı adı kopya adından farklı olmalı.
- En küçük örnekler:
  - Üretme: `python3 -I docs/kanit/2026-11-19/surucu4-arac/en-kucuk.py . <klasör> ek-bag-sonra|ek-supheli-acik`
  - Koşma: `bash docs/kanit/2026-11-19/surucu4-arac/kucuk-kos.sh <ad> <TZ> [program kökü]` (betik /dev/shm/surucu4-afb4/kucuk klasörünü kullanıyor).

### Dosyalar
- Sürücü: `test/bagimsiz/muhasebe-surucu/` altında `karsilastir.py`, `program.mjs`, `siniflama.json` (23 kural).
- Kanıt: `/home/user/ofis---y-netimi/.claude/worktrees/agent-afb4030486d151db9/docs/kanit/2026-11-19/surucu4-*` — koşu json + log.gz (onceki, s1, sinama, eski, son, mutant1, mutant2), tablolar, son-dokum, gerileme, gerileme-atif, mutantlar, ozet.json.gz, `surucu4-arac/`, `surucu4-en-kucuk/`.
