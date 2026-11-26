# UD DÜZELTME TURU 3 — RAPOR

**Taban:** ağacın ilk HEAD'i b7ac47a7'ydi (yanlış). `git reset --hard ud3-taban` ile 3974c939'a alındı, ardından yeniden okundu.
**Dal:** worktree-agent-acb2a64a5f6cdf8f2. PUSH YAPILMADI.
**Commit'ler:**
- 55270873 — S264 = A
- 67813713 — TYK KS8.1 ölçümü
- 0c860fab, c640dc52, 6ee50212 — yalnız mutabakat motoru (S263). Motorun S264 denemesi 6ee50212'de geri alındı; net motor farkı yalnız S263.
- Kanıt commit'i ayrı.

**Kâhin:** test/bagimsiz/** değişmedi (`git diff 3974c939 -- test/bagimsiz` boş).
**Yapım aşaması listesi:** 0 kayıt.

## Kısaca
- **Kâhin cari 598 fark:**
  - 576'sı iki program hatasının düzeltilmesiyle kapandı:
    - S264 = A: 163 fark.
    - KS8.1 iade geri ödemesinin ölçümü: 413 fark.
  - 22'si kaldı:
    - s1-12'de 15 fark, sınıf (d) → KULLANICIYA SORULMALI.
    - s1-30'da 7 fark, sınıf (e) → KÂHİN BAKIMI GEREKİR.
  - Bakiye farkı yok. Kalan 22 farkın hiçbiri `cari:*:bakiye` anahtarında değil; değişen yalnız kalemlerin dağılımı.
- **Mutabakat tohum 8 (S263):** yeşil. Eski motor (yeni programla) beklenen nedenle kırmızı: işlem 2608, kapı doubtful:balance.
- Öbür mutabakat tohumları ve son kâhin koşuları için **SONUÇLAR** bölümüne bakın.

## Kâhin etiketleri nasıl konuyor (test/bagimsiz/cari/kos.mjs okundu, değiştirilmedi)

**"2.5.0 kararıyla değişen":** kâhin her senaryoyu iki kural setiyle koşuyor:
- `model(dosya)`: 2.5.0
- `model(dosya, 0, ONCEKI)`: 2.4.9

Bir anahtarın 2.5.0 beklentisi 2.4.9 beklentisinden farklıysa ya da anahtar 2.4.9'da yoksa, o anahtardaki programla fark bu etiketi alır (`degisen` kümesi, satır ~1350).

**"SINIF DIŞI":** iki kural seti aynı değeri bekliyor, program ise başka bir değer veriyor. Yani 2.5.0 kuralı bu anahtarı değiştirmemiş, ama program değiştirmiş.

**Değişen etiketli fark neden yine BAŞARISIZ sayılıyor:** etiket yalnız bilgi amaçlı.
- BİLİNEN ve YAPIM AŞAMASI ayıklandıktan sonra kalan her fark `genelFark`'a girer.
- Çıkış kodu 1 olur.
- Kâhinin beklentisi daima 2.5.0 beklentisidir.
- "Değişen", yalnız eski kodda bu farkın beklendiğini söyler. Programın 2.5.0 kuralını doğru uyguladığını göstermez.

## KÂHİN FARKLARI — SINIF TABLOSU

Kümeler, farkın hangi düzeltmede kapandığına göre ayrıldı. Hepsi aynı 16 senaryoda, aynı kâhinle, `--mutasyonsuz` koşuldu.
- **taban:** ud3-taban
- **yalnız S264:** ud3-taban + yeni doubtful.mjs (ayrı kopya)
- **son kod:** son commit

Tablo: `ud3-ornek/kosu/sinif-tablosu.json`.

| Küme | Fark | Etiket dağılımı | Sınıf | En küçük örnek | Son kod | e7934c5e | v2.4.9 |
|---|---|---|---|---|---|---|---|
| K1 S264 (s1-13) | 163 | değişen 40, SINIF DIŞI 123 | (b) | senaryo/kc1-asil.json (6 adım); s264-a (6 adım) | 33/33 ✓ | ret "kalan 1.545,26" | 33/33 ✓ |
| K2 KS8.1 ölçümü | 413 | değişen 374, SINIF DIŞI 39 | (b) | m-s1-28 (11), m-s1-4 (4), m-s1-7 (6), m-s1-6 (17) | hepsi ✓ | hepsi ✗ | aşağıda |
| K3 s1-12 tedarikçi, KS9 geri tahsilat | 15 | değişen 14, SINIF DIŞI 1 | (d) | m-s1-12A4b (13 adım) | A4 14,15 / kâhin 0 | aynı | en küçükte 30/30 = kâhin; tam senaryoda A4 14,15 = program |
| K4 s1-30, S104 yalın olmayan caride | 7 | değişen 3, SINIF DIŞI 4 | (e) | m-s1-30 (5 adım) | avans yok / kâhin 175,38 | aynı | aynı (S96 yok) |
| SINIFLANMADI | 0 | | | | | | |
| **Toplam** | **598** | 431 / 167 | | | | | |

**K2'nin senaryolara dağılımı:**
- s1-3: 42
- s1-4: 23
- s1-6: 11
- s1-7: 78
- s1-8: 17
- s1-12: 10
- s1-17: 57
- s1-19: 12
- s1-20: 23
- s1-23: 16
- s1-24: 18
- s1-25: 45
- s1-27: 6
- s1-28: 55

**K2'de v2.4.9 sonuçları:**
- m-s1-28: 51/51, kâhinle aynı.
- m-s1-4: Açılış Kalan 918,61, kâhinle aynı (S96 kalemi v2.4.9'da yok).
- m-s1-7: v2.4.9 eski programla aynı. Kâhinin 2.5.0 değeri S2 vade sırasından geliyor. Düzeltilen kod kâhinle aynı.

### K1 — S264 = A (b)
**Adım dizisi:**
1. Açılış 2.347,11
2. G1 2.900 (05.03)
3. Borç 3.400 (11.03)
4. 17.03 G1'e bağlı tahsilat 2.876,45
5. 17.03 Şüpheliye Al 4.421,71
6. 17.03 Değersiz 4.421,71

**Kök neden:** writeOff sınırı kaydın gün sonu kalanıydı (`state.remaining`). Bu kalan, aynı gündeki bağlı tahsilatın S25 (c) payını içeriyordu, bu yüzden Değersiz reddediliyordu.

**Dayanak (C, AYNEN):** S264 = A "'Değersiz' sınır denetimi aynı günün sırasına uyar — Değersiz, o günün bağlı payından ÖNCE değerlendirilir, tam tutar kabul edilir (kâhin ve v2.4.9 böyle)".

### K2 — KS8.1 geri ödeme ölçümü (b)

**En küçük örnek m-s1-4:**
1. Açılış 1.483,45
2. 25.06 faturasız stok iadesi 1.914,34
3. 26.06 tahsilat 564,84
4. 30.06 Ödeme 2.385,23

**Kâhin ve v2.4.9:**
- Açılış Kalan 918,61
- Ödeme avansı 470,89

**e7934c5e:**
- Açılış Kalan 824,66
- Avans 564,84

Bakiye her iki kodda 1.389,50.

**Kök neden:** lib/obligation-queue.mjs implicitRefunds, KS8.1 (b)'nin "yükümlülüklerden artanı"nı fatura durumu ölçüm geçişinde ölçüyor.
- Tur 2b-2'nin S98 kuralı (`againstOf`: karşı tarafın netleşmemiş bağsız parası gelen bağsız paranın karşısında kalemdir) bu ölçüm geçişlerinde de çalışıyordu.
- Müşteriye yapılan Ödeme, müşterinin tahsilatıyla eşleşiyordu (avans ↔ avans). Bu yüzden `left` küçülüyordu.
- Sonuçta iadenin geri ödemesi eksik kalıyor, açılması gereken borç kapalı görünüyor, artan tutar da 'Tahsil Edilecek Borç' oluyordu.
- Tedarikçide aynı hatanın simetriği var: KS9 geri tahsilatı.
- İz kanıtı: Ödemenin 211,07'si sonraki tahsilatla `payment` türü kapanış olarak eşleşmiş (`ud3-ornek/kosu`'daki uc-m-s1-28-*).

**Düzeltme:** ölçüm geçişleri `pairMoney: false` ile koşuyor. Son geçiş (runQueue) değişmedi.

**Hiçbir 2.5.0 kararı bu eşleşmeyi gerektirmiyor:**
- KS8.1 metni artanı yükümlülüklere göre tanımlar.
- S98 / S104 artan paraya uygulanır.
- v2.4.9'da bu ölçümde S98 eşleşmesi yoktu.

**Dayanak (AYNEN):** KS8.1 "(a) karşı tarafın AÇIK iadesini kendi tarafının yükümlülükleriyle TEK sırada kapatır; (b) yükümlülüklerden ARTANI, bir borcu kapatmış iadenin (…) geri ödemesidir".

### K3 — s1-12 tedarikçi (d)
**Adım dizisi (m-s1-12A4b, 13 adım):**
1. Alacaklı açılış 3.931,32
2. Alış iadesi ×2
3. Alacak 4.000
4. Ödemeler
5. Tedarikçiden tahsilat 1.160,31 (04.04)
6. A4 alış faturası 1.500 (06.05)
7. A4'e bağlı Ödeme 1.485,85
8. 03.06 tedarikçiye stoktan satış 896,14 + alış iadesi 1.250,28

**Sonuçlar:**
- Program A4 açığı 14,15; kâhin 0.
- Fark, en küçük örnekte e7934c5e'de de var. v2.4.9'da yok (30/30).
- **Tam s1-12'de ise v2.4.9 da 14,15 veriyor** (A4 / A5 farkları v2.4.9'da da aynı). Yani 598'in içindeki 15 fark ÖNCEDEN VAR.

**Program ne yapıyor:** tahsilatın 896,14'ü stok satışına, 264,17'si açık alış iadesi notuna gidiyor (KS8.1 (a)).

**Kâhin ne yapıyor:** kâhin kuralının kendi metni şöyle: "tedarikçinin bağsız Tahsilat'ı önce K-b FIFO'sunda (alacak tarafı + açık alış iadesi notu), artanı kapatıcı alış iadesinin geri tahsilatı — … — yaklaşık okuma (ks8_sinif)". Kâhin kendi okumasını "yaklaşık" diye işaretliyor.

**Kararlar bu bileşimi söylemiyor:** KS9 geri tahsilatı, S105 ve aynı gün belge durumu birlikte. Hangi iade notunun açık sayılacağı DOĞRULANMADI.

### K4 — s1-30 (e)
**Adım dizisi (m-s1-30):**
1. Açılış 1.677,10
2. 07.03 iki faturasız iade, toplam 2.999,50
3. 14.03 Ödeme 2.038,18 + tahsilat 2.078,49
4. 16.03 Ödeme 1.136,70

**Sonuçlar:**
- Bakiye −226,01 (müşteri alacaklı).
- Kâhin 'Tahsil Edilecek Borç' 175,38 bekliyor. Program avans göstermiyor; S104 ile Ödeme müşterinin avansını kapatıyor.

**Neden kâhin farklı:** kâhin bu cariyi "yalın olmayan" sayıyor (KARARLAR Y5-7: KS8 / iki yönde faturasız iade, şüpheli / değersiz). Bu carilerde tek taraflı kuyruğun artanını avans kalemi olarak yazıyor ve S104'ü uygulamıyor.

**Dayanak (D, AYNEN):** "S104 = A: müşterinin bizdeki avansı ile ona borcumuz (Alacak) birlikte açıkken bağlamadan yaptığımız Ödeme VADE SIRASIYLA kapatır". Metin tanım alanı ayırmıyor.

## KÂHİN BAKIMI GEREKİR

Bunlar kodu görmeyen kâhin ajanına verilecek girdi biçiminde.

**1. S104 = A yalın olmayan caride (K4; 598 dışında aynı aile m-s1-3).**
- **Karar:** S104 = A (D 10.11 18:28, yukarıda AYNEN).
- **Örnek m-s1-30:**
  - Program: avans kalemi yok, müşterinin alacağı 226,01.
  - Kâhin: `takvim | vadeTakip | projeksiyon:hareket:<ikinci Ödeme>` = 175,38. `hareket:<Borç>:kalan` Kalan, tam senaryoda 705,96.
- **Örnek m-s1-3 (şüpheli / değersiz):**
  1. Açılış 842,34
  2. Borç 3.900
  3. Şüpheliye Al + Değersiz 3.412,49 (28.03)
  4. Tahsilat 3.062,41 (19.04)
  5. Ödeme 2.365,56 (02.05)
  - Program avansı 633,00 (= bakiye), kâhin 2.365,56.
- **Bakım isteği:** Y5-7 alanında ya S104 modellenmeli ya da etkilenen avans kalemi / Kalan anahtarlarında SUS'ulmalı.

**2. S25 (c) / S168 = B, Değersiz sınırında (598 dışında; s264-c, kc1-degersiz-ertesi).**
- **Adım dizisi:**
  1. G1 2.900
  2. Borç 3.400
  3. 15.09 Şüpheliye Al 3.000
  4. 17.09 G1'e bağlı tahsilat 2.876,45
  5. 18.09 Değersiz 3.000
- Program 400 veriyor, kalan 123,55. Bağlı payın S25 (c) ile 128'den düşmesi ve kâhin ret beklentisi buradan.
- Kâhin "ok" ve bakiye 423,55 bekliyor. Kâhin bağlı tahsilatın şüpheli payını Değersiz sınırına hiç katmıyor.
- **Dayanak:** S25 = A (c) "nakit / havale / POS ile şüpheliye aktarılmış faturaya bağlı tahsilat → S14 ile aynı (şüpheli kısım 128'den düşer)".
- **Not:** S264'ün dayanağındaki "kâhin ve v2.4.9 böyle" kısmen bundan. İkisi de S25 (c)'yi uygulamıyor. S264'ün metni uygulandı (yalnız aynı gün).

**3. K3 (s1-12):** kullanıcı yanıtına göre. A seçilirse kâhin bu sınıfta SUS'malı ya da programın okumasını modellemeli.

## S263 / S264 UYGULAMASI

**S264 = A (server/lib/bank/doubtful.mjs):**
- Değersiz sınırı = kalan + Değersiz satırının günündeki bağlı (`linked`) alacakların bu kayda düşen payı.
- Bağsız alacaklar eskisi gibi sınırı küçültür (kâhin ve v2.4.9 aynı: s264-b, s264-f, s264-g).
- Yazımdan sonra ayırıcı denetimi var: satır kendi yerinde aşıyorsa ya da sonraki bir Değersiz satırını taşırıyorsa işlem geri alınır.
- Silinenler'den geri yükleme aynı sınırla çalışır.

**Kalıcı test test/supheli-degersiz-s264-250.test.mjs (6 test):**
- Yeni kod: UTC 6/6, Europe/Istanbul 6/6.
- Eski kod (e7934c5e): 2/6, iki saat diliminde de beklenen nedenle:
  - "(…) kalan şüpheli tutarı (123,55 TL) aşıyor."
  - "(1.500,00 TL)"

**Mutantlar:** S264-a, S264-c, S264-d ÖLDÜ. S264-b eşdeğer: yazım sonrası denetim aynı iletiyle reddediyor (notu tyk-mutasyon-250.mjs'te).

**S263 = C (test/mutabakat/motor.mjs; program değişmedi):** sınıf iki koşulla tanımlı:
1. Bugün çıkarılmış kayıt ve bugün alınmış kayıt var.
2. Modelde tahsilat çıkarılan kayda düşüyor.

Bu sınıfta kapının `ledger-integrity` + `doubtful:balance` reddi beklenen ret sayılır. Program kabul ederse yol eskisi gibi (mustOk + model). Sınıf dışı her ret yine uyuşmazlıktır. Rastgele çekimler değişmedi.

**Motor tarihçesi (dürüst kayıt):**
- 0c860fab ayrıca "(3) model 120 < 0" koşuluyla reddi ZORUNLU bekliyordu. Tohum 2 işlem 4790'da program kabul etti → kırmızı (`ud3-mutabakat-tohum2-islem5000`). c640dc52 koşulu kaldırdı.
- 0c860fab motorda S264'ü "Değersiz o günün BÜTÜN alacaklarından önce" diye de modellemişti. Tohum 7 işlem 4160'ta program (doğru olarak; tahsilat bağsız) 5.371,86 > 5.317,86 ile reddetti, motor kabul bekledi → kırmızı (`ud3-mutabakat-tohum7-islem5000`). 6ee50212 geri aldı: S264 yalnız BAĞLI payı söyler; motorun şüpheli müşteri tahsilatları bağsız.
- Eski motor sürümleriyle yeşil koşan tohumlar (3, 6, 8: 0c860fab; 10: c640dc52) son motorda da yeşil kalır. İki düzeltme de beklentiyi yalnız gevşetir: önceki sürümün kabul ettiği her ret sonrakinde de kabul; S264 modeli ancak "aşım + aynı gün alacak" durumunda kabul bekliyordu, o durumda program reddeder ve bu tohumlarda hiç oluşmadı. Bu akıl yürütmedir, son motorla yeniden koşu değil → DOĞRULANMADI'ya da yazıldı.

**Kanıt:**
- Yeni motor + yeni program, tohum 8 / 5.000: ✓, 1.254 beklenen ret.
- Eski motor (ud3-taban) + yeni program: ✗ işlem 2608 "beklenmeyen kapı reddi doubtful:balance … 120 = -924.56".
- Ham çıktı: `ud3-ornek/kosu/eski-motor-yeni-program-tohum8-islem5000.log`.

## KS8.1 DÜZELTMESİ — test ve mutasyon

**Kalıcı test test/tyk-iade-geri-odeme-ud3-250.test.mjs:**
- A: m-s1-4 sayıları.
- B: m-s1-28 sayıları.
- Beklenen değerler karar metninden elle türetildi; hesap testin başında.

**Sonuçlar:**
- Yeni kod: UTC 2/2, Europe/Istanbul 2/2.
- Eski kod: 0/2, iki saat diliminde de beklenen nedenle:
  - Açılış Kalan 824,66 ≠ 918,61
  - G7 açığı 950,32 ≠ 1.161,39

**Mutantlar:**
- UD3-a (ölçümde eşleşme açık): ÖLDÜ, 2/2 kırmızı.
- UD3-b (yalnız ikinci geçişte açık): ÖLDÜ.

**Mutasyon koşusu:** UD3-a, UD3-b, S264-a, S264-c, S264-d — 5/5 ÖLDÜ (`ud3-mutasyon`).

## SONUÇLAR (son kod 0c860fab)
Ürün kodu bütün koşularda aynı (55270873 + 67813713); yalnız motor sürümü farklı (kanıt JSON'larındaki commit).

| Koşu | Sonuç | Commit |
|---|---|---|
| Kâhin cari 1-30 × 120 (mutasyonlu) | 175.649 / 175.671 — 22 fark (K3 15 + K4 7; değişen 17, SINIF DIŞI 5), 0 yakalanmayan mutasyon, 0 okuma hatası, yapım aşaması 0; farklar ara koşuyla birebir | c640dc52 |
| CI kâhin cari | UTC 25.164 / 25.164 · Europe/Istanbul 25.164 / 25.164 | c640dc52 |
| CI kâhin defter | UTC 187 / 187 · Europe/Istanbul 187 / 187 | c640dc52 |
| Mutabakat 5.000 tohum 2 | ✓ 1.181 beklenen ret (ilk koşu 0c860fab ✗ işlem 4790 — motor) | 6ee50212 |
| tohum 3 | ✓ 1.235 | 0c860fab |
| tohum 6 | ✓ 1.170 | 0c860fab |
| tohum 7 | ✓ 1.198 (ilk koşu 0c860fab ✗ işlem 4160 — motor) | 6ee50212 |
| tohum 8 | ✓ 1.254 (S263 reddi 1 kez beklenen ret) | 0c860fab |
| tohum 10 | ✓ 1.269 | c640dc52 |
| Eski motor (ud3-taban) + yeni program, tohum 8 | ✗ işlem 2608, beklenen nedenle | ud3-taban motoru |
| Komşu taraması (80 dosya; test/ taraması: obligation-queue, bank/doubtful, doubtful-gl, write-off, iade geri ödeme, mutabakat/motor) | UTC 874 / 874 · Europe/Istanbul 874 / 874 | 0c860fab |
| Motoru içe aktaran 8 test (c640 sonrası) | 41 / 41 | c640dc52 |
| Yeni testler, iki TZ | yeni 8 / 8 · 8 / 8; eski kod 2 / 8 · 2 / 8 (beklenen nedenle) | son |
| Mutasyon (UD3-a, UD3-b, S264-a, S264-c, S264-d) | 5 / 5 ÖLDÜ | 0c860fab |
| Uzun 10.000 tohum 11 | KOŞULMADI (görev gereği; GitHub UD) | — |

**Şema kapısı / geri yükleme:** değişiklik yeni tablo, ayar ya da yedek alanı yazmıyor (Değersiz satırı eskisi gibi account_entries'e yazılıyor; kuyruk saf hesap). Bu yüzden koşulmadı. Silinenler'den Değersiz geri yükleme yolu yeni testin (d) alt testinde.

## HIZ (ders 53 (a); ölçümü ana oturum yapar)

**KS8.1 değişikliği (obligation-queue implicitRefunds):** her cari kuyruğu kuruluşunda koşuyor.
- **Etkilediği yollar:**
  - cari kartı (GET /api/workspace/accounts/:id) ve Cari Listesi
  - fatura listesi / kartı
  - Vade Takip (overview/vade-takip, reports/vade-takip)
  - zil / takvim (/api/workspace/dues)
  - nakit akışı projeksiyonu
  - Taksitler listesi / kart penceresi ve kart yazım yanıtları
  - Mizan / defter (linkedShares → doubtfulBefore da implicitRefunds çağırıyor)
  - mutabakat kapısı
- **Beklenti:** geçiş sayısı aynı kalıyor. Ölçüm geçişlerinde para ↔ para eşleşmesi yapılmadığı için iş azalıyor ya da aynı kalıyor. Ölçülmedi.

**S264 değişikliği (doubtful writeOff / restore 'writeoff'):** yalnız Değersiz Alacak Yaz ve Silinenler'den Değersiz geri yükleme yolları.
- Ek maliyet: istek başına üç ek ayırma (doubtfulRows, doubtfulCredits, allocateDoubtful).
- Okuma yolları değişmedi.

## KULLANICIYA SORULMALI

**S-K3** (UÇ DURUM; bakiye değişmez: −1.389,13 / tam senaryoda aynı; değişen alış faturasının belge durumu A4 14,15 ↔ 0 ve A5 1.320,71 ↔ 741,89).

Soru: tedarikçiden bağsız tahsilat geldiğinde (KS9 geri tahsilatı), alış iadeleri ve sonradan gelen stok satışı ile aynı gün alış iadesi varken alış faturasının açığı nasıl hesaplanır?
- **A:** Program ve tam senaryoda v2.4.9: tahsilat önce stok satışını, artanı açık alış iadesi notunu kapatır; A4 14,15 açık.
- **B:** Kâhinin "yaklaşık okuması": artan, kapatıcı alış iadesinin geri tahsilatıdır; A4 0.
- **C (ÖNERİ):** Uç durum böyle kalsın (BİLİNEN SINIR). Kâhin bu sınıfta SUS'ar; program değişmez.
- **Yaygın programlarda nasıl:** doğrulanmış dayanak yok.

**S-K4** (isteğe bağlı teyit; sınıf (e), öneri A uygulanmış sayılabilir): S104 = A yalın olmayan caride de geçerli mi (şüpheli / değersiz, faturasız iade geri ödemesi)?
- **A (ÖNERİ, program):** evet, Ödeme müşterinin avansını önce kapatır, 'Tahsil Edilecek Borç' kalmaz.
- **B (kâhin):** hayır, Ödemenin artanı ayrı avans kalemi.
- **C:** Uç durum böyle kalsın.
- Bakiye her seçenekte aynı: m-s1-30'da −226,01. Değişen Vade Takip / zil kalemi 175,38.

## DOĞRULANMADI
- Tohum 3, 6, 8, 10 son motorla (6ee50212) yeniden koşulmadı; yeşilliklerinin son motorda süreceği yukarıdaki akıl yürütmeye dayanıyor.
- K3'te hangi alış iadesi notunun "açık" sayıldığı. En küçük örnekte v2.4.9 = kâhin, tam senaryoda v2.4.9 = program; kök neden yazılamadı.
- Uzun 10.000 tohum 11: yerel koşulmadı (görev gereği).
- Hız ölçümü: ana oturum yapacak.
- Tam npm test: ana oturum koşacak.
- Ekran yürüyüşü yapılmadı.

## SONRAKİ SÜRÜME (2.5.1)
- S264-b mutantı eşdeğer (yazım sonrası denetim koruyor). Ön denetimin tarih süzgecini ayrı yakalayan test yok.
- `indir.py` (kâhin senaryosu ddmin indirgeyici) not defterinde. Kalıcı araç yapılabilir.
- `--her` > 1 ile kısa mutabakat koşusu ara kontrolde 'raporlar' uyuşmazlığı veriyor. S206 adayı bir sonraki denetime kadar bekliyor (UD turu 2'nin notu). Kısa S263 kanıtı bu yüzden 5.000 / --her 1 ile alındı.

## Dosyalar
- `docs/kanit/2026-11-26/ud3-*.json|log`: kanit.mjs kos koşuları.
- `docs/kanit/2026-11-26/ud3-ornek/`:
  - senaryo: en küçük örnekler ve s264 senaryoları
  - kirmizi: eski / yeni test çıktıları, iki saat dilimi
  - kosu: uc-*.log (yeni / eski / v249), ara2, ayrim-s264, sinif-tablosu.json, mutasyon, taban kâhin günlüğü
  - betik
- Not defteri: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud3-m8x4
  - `eski`: e7934c5e archive
  - `v249`: worktree --detach
  - `taban-s264`, `eskimotor`
