# UD DÜZELTME TURU 3 — RAPOR

Raporun tamamı `docs/devir/2.5.0-DEVAM/ud3-rapor.md` içinde (Kanıt commit'inde). Aşağıda özeti var.

**Kısaca:** kâhin cari farkı 598'den 22'ye indi. Kapanan 576 fark iki program hatasından geliyordu, ikisi de düzeltildi. Mutabakat 5.000 işlemde 2, 3, 6, 7, 8 ve 10 numaralı tohumların hepsi yeşil. Kalan 22 farkın hiçbiri bakiyeyi değiştirmiyor; biri kullanıcıya soru, öbürü kâhin bakımı.

**Taban:** ağacın ilk HEAD'i b7ac47a7'ydi (yanlış). `git reset --hard ud3-taban` ile 3974c939'a aldım ve yeniden okudum.
**Dal:** worktree-agent-acb2a64a5f6cdf8f2. PUSH YOK.
**Commit'ler:**
- 55270873 — S264 = A (ürün)
- 67813713 — KS8.1 ölçüm düzeltmesi (ürün)
- 0c860fab, c640dc52, 6ee50212 — yalnız mutabakat motoru. Net motor farkı yalnız S263; motorun S264 denemesini geri aldım.
- 6a2273f4 — Kanıt

Kâhine dokunmadım: `git diff 3974c939 -- test/bagimsiz` boş. Yapım aşaması listesi 0 kayıt. Commit'lerde model adı yok.

## Kâhin etiketleri nasıl konuyor (kos.mjs okundu, değiştirilmedi)
Kâhin her senaryoyu iki kural setiyle koşuyor: 2.5.0 ve bir önceki (2.4.9).
- **"2.5.0 kararıyla değişen":** iki kâhinin o anahtardaki beklentisi farklı, ya da anahtar 2.4.9'da yok.
- **"SINIF DIŞI":** iki kâhin aynı değeri bekliyor, program başka değer veriyor.
- **Değişen etiketli fark neden yine BAŞARISIZ:** etiket yalnız bilgi. BİLİNEN ve YAPIM AŞAMASI ayıklandıktan sonra kalan her fark `genelFark`'a girer, çıkış 1 olur. Beklenen değer her zaman 2.5.0 kâhinininki.

## KÂHİN FARKLARI — SINIF TABLOSU
Kümeleri, aynı 16 senaryoyu üç kodda koşarak ayırdım: taban → yalnız S264 düzeltmesi → son kod. Ayrıntı `ud3-ornek/kosu/sinif-tablosu.json` içinde.

| Küme | Fark (değişen / SINIF DIŞI) | Sınıf | En küçük örnek | Son kod / e7934c5e / v2.4.9 |
|---|---|---|---|---|
| K1 S264 (s1-13) | 163 (40 / 123) | (b) | kc1-asil, 6 adım | ✓ / Değersiz reddi "kalan 1.545,26" / ✓ |
| K2 KS8.1 geri ödeme ölçümü (s1-3, 4, 6, 7, 8, 12'nin 10'u, 17, 19, 20, 23, 24, 25, 27, 28) | 413 (374 / 39) | (b) | m-s1-28 (11 adım), m-s1-4 (4), m-s1-7 (6), m-s1-6 (17) | ✓ / ✗ / m-s1-28'de kâhinle aynı |
| K3 s1-12 tedarikçi, KS9 geri tahsilat | 15 (14 / 1) | (d) | m-s1-12A4b, 13 adım | A4 açığı 14,15, kâhin 0 / aynı / en küçük örnekte kâhinle aynı, tam senaryoda programla aynı |
| K4 s1-30, S104 "yalın olmayan" caride | 7 (3 / 4) | (e) | m-s1-30, 5 adım | avans kalemi yok, kâhin 175,38 / aynı / aynı (2.4.9'da avans kalemi zaten yok) |
| SINIFLANMADI | 0 | | | |
| **Toplam** | **598** (431 / 167) | | | |

**K1 kök neden:** Değersiz sınırı kaydın gün sonu kalanıydı. Bu kalan, aynı gün yazılmış bağlı tahsilatın şüpheli payını da içeriyordu, bu yüzden tam tutar reddediliyordu.
- **Dayanak (AYNEN):** S264 = A "'Değersiz' sınır denetimi aynı günün sırasına uyar — Değersiz, o günün bağlı payından ÖNCE değerlendirilir, tam tutar kabul edilir".

**K2 kök neden:** obligation-queue `implicitRefunds` iadenin geri ödemesini bir ölçüm geçişinde hesaplıyor. Tur 2b-2'nin S98 kuralı bu geçişte de çalışıyordu.
- Müşteriye yapılan Ödeme, müşterinin kendi tahsilatıyla eşleşiyor; KS8.1'in "yükümlülüklerden artan" kısmı eksik ölçülüyordu.
- Sonuç: geri ödeme eksik kalıyor, açılması gereken borç kapalı görünüyor, artan tutar sahte bir "Tahsil Edilecek Borç" oluyordu. Tedarikçi tarafında simetriği var.
- Örnek m-s1-4: e7934c5e'de Açılış Kalan 824,66 ve avans 564,84; kâhinde 918,61 ve 470,89. Bakiye ikisinde de 1.389,50.
- Hiçbir 2.5.0 kararı bu eşleşmeyi gerektirmiyor.
- **Dayanak (AYNEN):** KS8.1 "(a) karşı tarafın AÇIK iadesini kendi tarafının yükümlülükleriyle TEK sırada kapatır; (b) yükümlülüklerden ARTANI, bir borcu kapatmış iadenin (…) geri ödemesidir".

## DEĞİŞEN DOSYALAR / DÜZELTMELER
**`server/lib/bank/doubtful.mjs` (S264 = A):**
- Sınır artık "kalan + Değersiz'in günündeki bağlı (faturaya bağlı) alacakların bu kayda düşen payı".
- Bağsız tahsilat sınırı eskisi gibi küçültür; kâhin ve v2.4.9 da böyle.
- Yazımdan sonra bir güvenlik denetimi var: satır yerinde kalanı aşarsa ya da sonraki bir Değersiz satırını taşırırsa yazım geri alınır.
- Silinenler'den geri yükleme aynı sınırı kullanıyor.

**`server/lib/obligation-queue.mjs` (KS8.1):** ölçüm geçişleri para ↔ para eşleşmesi olmadan koşuyor (`pairMoney: false`). Son geçiş değişmedi.

**`test/mutabakat/motor.mjs` (S263 = C):** sınıf şu iki koşulun birlikte olması:
1. Aynı gün çıkarılmış bir kayıt ve aynı gün alınmış bir kayıt var.
2. Modelde tahsilat çıkarılan kayda düşüyor.

Bu sınıfta kapının `doubtful:balance` reddi beklenen ret sayılıyor; program kabul ederse akış normal sürüyor. Başka her ret eskisi gibi uyuşmazlık.

**Motorda iki ara hata yaptım, ikisini de düzelttim:**
- İlk sürüm "model 120 < 0" koşuluyla reddi zorunlu bekliyordu. Tohum 2 işlem 4790'da program kabul etti, kırmızı verdi; c640dc52 bu koşulu kaldırdı.
- İlk sürüm motorda S264'ü "bütün alacaklardan önce" diye modellemişti. Tohum 7 işlem 4160'ta program doğru olarak reddetti, motor kabul bekledi; 6ee50212 bunu geri aldı.

**Yeni testler ve mutasyon:**
- `test/supheli-degersiz-s264-250.test.mjs` (6 test) ve `test/tyk-iade-geri-odeme-ud3-250.test.mjs` (2 test). Yeni kodda iki saat diliminde de 8/8.
- Eski kodda (e7934c5e) iki saat diliminde de 2/8, beklenen nedenlerle: "kalan şüpheli tutarı (123,55 TL)" / "(1.500,00 TL)" aşıyor; Açılış Kalan 824,66 (beklenen 918,61); G7 açığı 950,32 (beklenen 1.161,39).
- `tyk-mutasyon-250.mjs`'e UD3-a, UD3-b, S264-a, S264-c, S264-d mutantlarını ekledim; 5/5 öldü.
- S264-b mutantını eşdeğer olduğu için listeye almadım; yazım sonrası denetim onu da reddediyor, notu dosyada.

## S263 / S264 UYGULAMASI
- **S264:** yukarıda.
- **S263:**
  - Yeni motor + yeni program, tohum 8 / 5.000: ✓ (1.254 beklenen ret; S263 reddi bir kez beklenen ret sayıldı).
  - Eski motor + yeni program: ✗, işlem 2608'de "beklenmeyen kapı reddi doubtful:balance 120 = -924.56", yani beklenen nedenle.

## YENİDEN KOŞULAR (ürün kodu aynı; `node tools/kanit.mjs kos`)
| Koşu | Sonuç |
|---|---|
| Kâhin cari 1-30 × 120 (mutasyonlu) | 175.649 / 175.671 — 22 fark (K3 + K4, ara koşuyla birebir); yakalanmayan mutasyon 0, okuma hatası 0, yapım aşaması 0 |
| CI kâhin cari | 25.164 / 25.164, iki saat dilimi |
| CI kâhin defter | 187 / 187, iki saat dilimi |
| Mutabakat 5.000 | tohum 2 ✓ (6ee5), 3 ✓, 6 ✓, 7 ✓ (6ee5), 8 ✓, 10 ✓ (c640) |
| Komşu taraması | 80 dosya, 874 / 874, iki saat dilimi |
| Motoru içe aktaran 8 test | 41 / 41 |
| Uzun 10.000 tohum 11 | koşulmadı (görev gereği) |
| Şema kapısı / geri yükleme | koşulmadı; yeni tablo, ayar ya da yedek alanı yok |

## KÂHİN BAKIMI GEREKİR
1. **S104 = A "yalın olmayan" caride (K4).** Kâhin bu carilerde (KARARLAR Y5-7: faturasız iade geri ödemesi, şüpheli / değersiz) tek taraflı kuyruğun artanını avans kalemi olarak yazıyor ve S104'ü uygulamıyor.
   - m-s1-30: program avans kalemi göstermiyor, müşteri 226,01 alacaklı; kâhin 'Tahsil Edilecek Borç' 175,38 bekliyor.
   - m-s1-3 (598'in dışında): program 633,00, kâhin 2.365,56.
   - İstek: kâhin bu alanda ya S104'ü modellemeli ya da SUS'malı.
   - **Dayanak (AYNEN):** "S104 = A: müşterinin bizdeki avansı ile ona borcumuz (Alacak) birlikte açıkken bağlamadan yaptığımız Ödeme VADE SIRASIYLA kapatır" — metin cari türü ayırmıyor.
2. **S25 (c) Değersiz sınırında (598'in dışında; s264-c).**
   - Adımlar: 15.09 Şüpheliye Al 3.000 → 17.09 bağlı tahsilat 2.876,45 → 18.09 Değersiz 3.000.
   - Program 400 veriyor ("kalan 123,55"); kâhin kabul bekliyor.
   - Kâhin bağlı tahsilatın şüpheli payını sınıra hiç katmıyor. S264'ün gerekçesindeki "kâhin ve v2.4.9 böyle" ifadesi kısmen bundan kaynaklanıyor.

## KULLANICIYA SORULMALI
**S-K3** (uç durum; bakiye değişmiyor: −1.389,13). Değişen yalnız alış faturasının belge durumu: A4 açığı 14,15 ↔ 0, A5 açığı 1.320,71 ↔ 741,89.
- **Soru:** tedarikçiden bağsız tahsilat (KS9 geri tahsilatı) gelirken, alış iadeleri ve aynı gün stok satışı + alış iadesi varken alış faturasının açığı nasıl hesaplanmalı?
- **A:** programın ve tam senaryoda v2.4.9'un sonucu kalsın (açık iade notuna).
- **B:** kâhinin "yaklaşık okuması" — artan, kapatıcı iadenin geri tahsilatıdır.
- **C (ÖNERİ):** Uç durum böyle kalsın (BİLİNEN SINIR); kâhin bu sınıfta SUS'ar.

**S-K4** (isteğe bağlı teyit): S104 yalın olmayan caride de geçerli mi?
- **A (ÖNERİ, programın bugünkü hâli):** evet.
- **B:** hayır (kâhinin okuması).
- **C:** BİLİNEN SINIR.
- Bakiye her seçenekte aynı (−226,01); değişen yalnız Vade Takip / zil kalemi (175,38).

## HIZ (ders 53 (a); ölçümü ana oturum yapar)
**KS8.1 değişikliği her cari kuyruğu kuruluşunu etkiliyor.** Etkilenen yollar:
- cari kartı, Cari Listesi
- fatura listesi / kartı
- Vade Takip, zil / takvim (/dues), nakit akışı projeksiyonu
- Taksitler listesi / kart penceresi ve kart yazım yanıtları
- Mizan / defter (linkedShares → doubtfulBefore da implicitRefunds çağırıyor)
- mutabakat kapısı

Geçiş sayısı aynı; ölçüm geçişinde eşleşme yapılmadığı için iş azalıyor ya da aynı kalıyor. Bunu ölçmedim.

**S264 değişikliği yalnız iki yazma yolunu etkiliyor:** Değersiz Alacak Yaz ve Silinenler'den Değersiz geri yükleme. İstek başına birkaç ek ayırma hesabı geliyor.

## DOĞRULANMADI
- K3'te hangi alış iadesi notunun açık sayıldığı.
- Tohum 3, 6, 8 ve 10 son motorla yeniden koşulmadı. Son motorda da yeşil kalacaklarını akıl yürütmeyle söylüyorum: iki motor düzeltmesi de beklentiyi yalnız gevşetiyor.
- Hız ölçümü, tam npm test ve ekran yürüyüşü yapılmadı; uzun 10.000 koşulmadı.

## SONRAKİ SÜRÜME (2.5.1)
- S264-b için ayrı bir test yok (eşdeğer mutant).
- Kâhin senaryosu indirgeyici (`indir.py`) kalıcı araç yapılabilir.
- Mutabakatta `--her` > 1 ile kısa koşu, ara 'raporlar' denetiminde yanlış uyuşmazlık veriyor.

## Dosyalar
- `docs/devir/2.5.0-DEVAM/ud3-rapor.md`
- `docs/kanit/2026-11-26/ud3-*` (koşu kanıtları)
- `docs/kanit/2026-11-26/ud3-ornek/` (en küçük örnekler, eski / yeni kırmızı çıktıları, sınıf tablosu, betikler)
- Not defteri: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud3-m8x4. Eski kod ve v2.4.9 kopyaları tam yolla silindi, v249 worktree'si kaldırıldı, ağaçtaki node_modules bağı silindi.

Yük 0,26 / 4 çekirdek, bellek boş 11 GB, disk boş 6,6 GB.