# DAR KONTROL UD4 — Rapor (fark `04124181..126aa068 -- server client test`)

**Sonuç: 1 YÜKSEK, 1 ORTA. "YÜKSEK/ORTA YOK" denemez.** İkisinin de kökü aynı yeni hesap: `writeOffRoomOf` ve `openRecord` içindeki `extra`.

## Nasıl çalıştım
- Okuduklarım: CLAUDE.md, BAGIMSIZ-DOGRULAMA-PRENSIBI §3 ve yalnız fark. Yasaklı dosyaları ve git log'u okumadım.
- Not defteri: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-ud4-r7x3`
- Kod kopyaları `git archive` ile ayrı klasörlere çıkarıldı: yeni = 126aa068, eski = 04124181, v2.4.9. Hepsinde `HUKUK_LICENSE_URL=http://127.0.0.1:9`.
- İş bitince kod kopyaları silindi; betikler, ham çıktılar ve ekran görüntüleri duruyor. Betikler `ROOT=<git archive kopyası; node_modules ana depoya bağlı>` ile yeniden koşulur.
- Hiçbir kodu değiştirmedim; commit / push yapmadım; worktree temiz.

---

## YÜKSEK-1 — Fazla Değersiz yazımı (126aa068 ile gelen gerileme)
Sonradan gelen bağsız tahsilatın sınırı küçültmesi kayboluyor. Program önerdiği tutarı kabul ediyor; cari bakiyesi eksiye düşüyor.

**Yer:**
- `server/lib/bank/doubtful.mjs:471-488` (`writeOffRoomOf`)
- `server/lib/bank/doubtful.mjs:601-602` (`openRecord` `extra`)
- `server/lib/bank/doubtful.mjs:673` ve `:811` (sınır = `state.remaining + share(gün)`)
- İstemcide düğme `client/assets/hof-accounts.js:1212`, form `:1275-1287`

**Kurulum (her şey arayüzden yapılabilir):** Fatura 2.900, Borç 3.400, 17.09 faturaya bağlı tahsilat 2.876,45, 17.09 Şüpheliye Al 3.000, ardından 01.10 bağsız tahsilat 1.000. Kayıt "Tahsil Edildi" görünüyor, kalan 0.

**Sayılar (betik `betik/q5c.mjs`, çıktılar `q5c-{yeni,eski,v249}.txt`):**

| | Değersiz toplamı | Cari bakiye | 659 |
|---|---|---|---|
| Yeni kod | 2.876,45 + 123,55 = 3.000 (ikisi de 200) | 2.423,55 → −452,90 → **−576,45** | 3.000 |
| Eski kod (04124181) | yazılamıyor (409 doubtful-closed) | 2.423,55 | 0 |
| v2.4.9 | 2.000 (sınır) | **423,55** | 2.000 |

- Yeni kodda Mutabakat TAMAM diyor, yani kapı bunu yakalamıyor.
- Fark v2.4.9'a göre 1.000 TL fazla gider. Cari alacaklı görünüyor; Vade Takip boş (`q6-yeni.txt`).

**Ekrandan da üretildi** (`betik/e2e-q5c.mjs`, çıktı `e2e-q5c.txt`, görüntüler `ekran/q5c-*.png`):
- "Tahsil Edildi" satırında Değersiz Alacak Yaz düğmesi görünüyor.
- Form 2.876,45 ve 21.11 tarihiyle doluyor. İpucu: "En çok ₺2.876,45 (kalan şüpheli ₺0,00 + … tarih o güne kuruldu)".
- Gerçek tıklama + Tab ile gönderilince kabul ediliyor. Düğme yeniden çıkıyor, 123,55 öneriyor, o da kabul.
- Veri tabanında Değersiz toplamı 3.000, bakiye −576,45. Sayfa hatası yok.

**Aynı ailenin küçük biçimi** (`betik/q5.mjs`, `q5b.mjs`, `q4.mjs`):
- Durum: bağlı 2.876,45 + şüpheli 3.000 + bağsız 50 (aynı gün ya da sonraki gün). Bağlı tahsilat bağsızdan önce yazılmışsa sorun çıkıyor (6 sıranın 3'ünde).
- Önce Değersiz 2.950 (doğru sınır) kabul ediliyor. Ardından düğme 50 öneriyor ve o da kabul ediliyor.
- Sonuç: toplam 3.000, bakiye 373,55. v2.4.9'da 423,55; eski kodda ikinci 50 için 409.
- İki saat diliminde (UTC ve Europe/Istanbul) aynı sonuç.

**Kök neden:**
- `share(D)`, Değersiz satırı yazıldıktan sonra yeniden hesaplanıyor. Bu durumda Değersiz'in yerinden ittiği bağlı tahsilat payı, bağsız tahsilatın yerini dolduruyor. Bağsız tahsilat da 120'ye düşüyor.
- `kalan + share(D)` bu payı yeniden "yazılabilir" sayıyor.
- Eski kodda "kayıt kapalı" denetimi bunu tesadüfen engelliyordu. S269 düzeltmesiyle denetim kalktı ve gerileme ortaya çıktı.
- Bu, karar metnine aykırı: S264 "tam tutar kabul (kâhin ve v2.4.9 böyle)", Y-1 "bağsız aynı gün tahsilatı eklenmez".

**En küçük düzeltme önerisi:**
- Sınırı şöyle kur: `oda(D) = min(kalan + share(D), kalanBağsız − Σ D'den önceki günlerin bağlı payı)`.
- `kalanBağsız` = aynı ayırıcı koşusu, faturaya bağlı alacak anahtarları (bound) dışarıda bırakılarak koşulduğunda kaydın kalanı.
- El hesabıyla tuttuğu durumlar: Q5c → 2.000; Q5 → 2.950 sonra 0; P1 → 3.000 sonra 2.000; P2 → 3.000; P3 → 1.500.
- Aynı formül üç yerde kullanılmalı: listede `writeOffRoomOf`, Değersiz Yaz'da `openRecord` + sınır, Silinenler'den geri yüklemede.
- Rastgele sırayla "Değersiz toplamı ≤ v2.4.9 sınırı" testi eklenmeli. Eski kodda kırmızı, v2.4.9'da beklenen sayı görülmeli.
- **Kâhin cevabı DOĞRULANMADI.** Kâhin farklı derse bu bir para kuralı olur ve kullanıcıya sorulmalı (ders 43).

---

## ORTA-1 — Liste ve form, sunucunun reddettiği tutar ve tarihi öneriyor (S268 A / S269 A eksik)
Hata iletisi de kendi içinde çelişkili.

**Yer:**
- `doubtful.mjs:471-488` — `writeOffRoomOf` aday günü, o günden sonraki Değersiz satırlarını hesaba katmıyor.
- `doubtful.mjs:681` — `breaks` durumunda `exceeds(room)` iletisi kullanılıyor.

**Sayılar (betik `betik/q1.mjs`; F durumu `betik/q2.mjs` / `q2-yeni.txt`):**
- **Q1a:** Değersiz 123,55 bugün (08.10) yazılıyor. Liste: kalan 0, oda 2.876,45, gün 17.09, yani düğme var. Önerilen 2.876,45 @17.09 → 400 «Değersiz yazılacak tutar (2.876,45 TL) kalan şüpheli tutarı (2.876,45 TL) aşıyor». Bugünün tarihiyle → 409. Bakiye 3.300'de takılı.
- **Q1b:** Değersiz 100 @25.09. Oda 2.900 @17.09 → 400; gerçekte yazılabilen 23,55.
- **F (iki kayıt):** Kayıt-2'ye bugün 123,55 yazılınca, Kayıt-1'in 1.500 önerisi 400 ile reddediliyor.

**Karşılaştırma:**

| | Durum |
|---|---|
| Eski kod (04124181) | Q1a 409; Q1b 400; düğme yoktu |
| v2.4.9 | Hepsinde kalanın tamamı kabul, bakiye 423,55 |

**Kök neden:** Önerilen güne yazılınca, ondan sonraki tarihli Değersiz satırı kalanın dışına itiliyor. Güvenlik denetimi bunu geri alıyor, ama öneri bu denetimi bilmiyor.

**En küçük düzeltme:** Aday gün yalnız o kaydın (ve carinin öbür kayıtlarının) son Değersiz satırının gününe eşit ya da ondan sonraysa sayılsın. Değilse oda = kalan, gün boş. `breaks` için ayrı, açık bir ileti yazılsın.

**KULLANICIYA SORULMALI (para kuralı, ders 43):** Bağlı payın düştüğü günden SONRA kısmi Değersiz yazılmış kayıtta kalan yazılabilsin mi?
- **A:** Evet (v2.4.9 gibi). Ayırıcı sırası değişir. Bakiye Q1a'da 3.300 → 423,55 olur (−2.876,45).
- **B:** Hayır; yalnız ekran gerçek sınırı göstersin (23,55 / 0). Bakiye değişmez.
- **C:** Uç durum böyle kalsın (BİLİNEN SINIR).
- Öneri: B + ekran düzeltmesi. Yaygın programlarda nasıl yapıldığı doğrulanmadı.

---

## Temiz geçen yollar
- **Bağlı tahsilatta değişiklik (Değersiz yazıldıktan sonra):** P2 ve P1'de sil / bağı kaldır / tarih 20.09 / tarih 16.09 / tutar 3.500 / tutar 1.000 denendi. Bakiyeler yeni kodda ve v2.4.9'da birebir aynı (P2: 3.400 / 400 / 400 / 400 / −100 / 2.400; P1: 3.300 / 423,55 ×3 / −200 / 2.300). Mutabakat TAMAM (`q3-*.txt`).
- **3 adımlı kısmi zincir (1.000 ×3):** kabul, 423,55.
- **Silinenler:** iki sırayla geri yükleme kabul, 423,55.
- **Karşılık:** 100 ve 123,55 ile kabul, 423,55.
- **Dönem Kilidi:** kilit 17.09'daysa oda 123,55 ve gün boş; 17.09 tarihli Değersiz 409 period-locked. Kilit 16.09'daysa 17.09 önerilir. Ortaya kilit girince, yarı yazılmış kayıt 409 olur (beklenen).
- **Aynı gün bağsız 50, önerilen tek adım:** 2.950, doğru.
- **Testin dişi:**

| Kontrol | Sonuç |
|---|---|
| Yeni test (`test/supheli-degersiz-s269-250.test.mjs`), yeni kod | 8/8 yeşil (TZ=UTC ve TZ=Europe/Istanbul) |
| Aynı test, eski kod | 1/8; kırmızılar beklenen nedenle (409 doubtful-closed, `writeOffRoomMinor` tanımsız); P1′ iki kodda da geçiyor (beklenen) |
| Mutasyon S1–S5 (`mut-api.txt`) | 5/5 öldü |

## BAŞ MİMAR YORUMLARI DEĞERLENDİRMESİ
- **Y-1:** Formül tek adımda ve kalan > 0 iken karar metniyle uyumlu. Ama çok adımda ve sonradan gelen bağsız tahsilatta "bağsız eklenmez" kuralı bozuluyor (YÜKSEK-1). Çıkarılmış / iptal kayıtta 0 ✓. Çıkar / Karşılık değişmedi ✓.
- **Y-2:** Tarihi otomatik geriye kurmak karar metninde yok (S268 A yalnız "ipucu ve önerilen tutar" diyor). Kullanıcıya gösterilmeli. Kullanıcı fark etmezse kayıp önceki aya, hatta önceki yıla yazılır. YÜKSEK-1 ve ORTA-1'in ekrandaki yolu bu tarih önerisi.
- **Y-3:** Kendi başına görünüm ayrıntısı, 2.5.1'e bırakılabilir. Ama "Değersiz Yazıldı" satırındaki düğme YÜKSEK-1'de fazla yazıma götürüyor; o durumda görünüm ayrıntısı değil.

## DOĞRULANMADI
- Kâhinin Q5c / Q1 için ne dediği.
- YÜKSEK-1'de "kalemler toplamı = bakiye" koşulu: kuyruk uç noktası okunmadı. Cari kartının kalemleri 0, bakiye −576,45, Vade Takip boş.

## DENENMEYEN
- Yedek dosyasından geri yükleme.
- İki eşzamanlı kullanıcı.
- Büyük veride hız ölçümü. Not: listede ayırıcı koşusu sayısı değişmedi (1 + özet); Değersiz Yaz'da 2'den 1'e indi.
- Mutasyon C1–C3 (e2e) ve farktaki e2e senaryosunun kendisi.
- ORTA-1'in ekrandan koşusu (yalnız API; ekran yolu YÜKSEK-1'deki yolla aynı).
- Silinenler'den Değersiz geri yüklemesinde fazla yazım (aynı formül; yalnız kod okumasıyla).

## SONRAKİ SÜRÜME (2.5.1)
- Y-3 görünümü (YÜKSEK-1 düzeldikten sonra).
- `breaks` iletisinin metni (ORTA-1 ile birlikte düzelmezse).

Yük 0,22 / 4 çekirdek, bellek boş 14 GB, disk boş 5,6 GB

