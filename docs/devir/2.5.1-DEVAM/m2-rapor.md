# M2 — Değersiz Alacak sınırı kod turu: RAPOR (taslak; adım adım doldurulur)

Taban: `t251-m2-taban` (0e96418a). Görev metni `docs/devir/2.5.1-DEVAM/m2-istem.txt`; karar girdisi `m2-kararlar.md`; kâhin beklentisi `test/bagimsiz/cari/senaryolar/d62-c5-m2-degersiz-siniri.json`
(+ `test/bagimsiz/cari/KARARLAR.md` §42 'Bakım 30'). Kâhinin model kodu okunmadı; `test/bagimsiz/**` yazılmadı.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)

| # | Bozulma | Nereden | Test sınıfı |
|---|---|---|---|
| N1 | Sonradan gelen (Değersiz'den sonraki tarihli, önce yazılmış) bağsız tahsilat sınırı küçültmez → fazla yazım, bakiye eksi (geri alınan uygulama: 3.000, −576,45) | dk-ud4 YÜKSEK-1 / Q5c, girdi §3 m.6 | d62 A9 / A10 |
| N2 | Aynı gün bağsız 50 + bağlı tahsilat (altı yazım sırası): 2.950'den sonra 50 de kabul (toplam 3.000, bakiye 373,55) | dk-ud4 Q5 / Q5b / Q4, girdi m.7 | d62 A11–A18 |
| N3 | Sonraki tarihli Değersiz satırı sınırdan düşülmez (ekran 2.876,45 önerir, sunucu reddeder; @25.09 100'den sonra gerçek sınır 23,55) | dk-ud4 ORTA-1 Q1a / Q1b, girdi m.4 / m.5 | d62 A6 / A7 / A8 |
| N4 | Önceki günün bağlı payı düşülmez (S-M2-1 = B; @18.09 sınırı 123,55 değil 3.000) | girdi m.4 / m.14 | d62 A6 / A10 / A28 |
| N5 | O günün bağlı payı Değersiz'den ÖNCE düşülür (S264 yok; tam tutar ret) | dk-ud3 ORTA-1 P1 / P2 / P3, girdi m.1–m.3 | d62 A1–A4 |
| N6 | 'Kayıt kapalı' denetimi sınırdan önce (S269 yok): kısmi Değersiz'den sonra kalan yazılamaz; bağlı = şüpheli kayıtta hiç yazılamaz; düğme gizli | dk-ud3 ORTA-1, girdi m.2 / m.3 | d62 A2 / A3 / A4 + ekran |
| N7 | Değersiz cariyi eksi bakiyeye düşürür (aynı gün, şüpheliye almadan SONRA yazılmış bağlı tahsilat şüpheli tutarı kadar) | girdi §1 S270 (ii) | d62 A5 |
| N8 | Değişmez denetimi yok — Değersiz öbür kaydın / sonraki Değersiz'in kalanını dışarı taşır | dk-ud3 DÜŞÜK-1 P8, dk-ud4 F | d62 A20 / A21, P8 |
| N9 | Ret iletisi yanıltıcı ("kalan şüpheli tutarı (2.000,00 TL) aşıyor" — tutar = sınır; neden yok) | dk-ud3 DÜŞÜK-1, dk-ud4 'breaks' | ileti testleri |
| N10 | Bildirim "şüphelide kalan ₺0,00" (kayıt kısmi Değersiz'den sonra aynı günün bağlı payıyla 0 görünür, oysa yazılabilir tutar var) ve "toplam" yazılır (bu yazım değil) | plan taslağı M2 | ekran senaryosu |
| N11 | Ekran önerdiği tutar/tarihte sunucu reddeder (önerinin sınırı bilmemesi; S155 — bakiye kuralını bilmemesi) | dk-ud4 ORTA-1, kâhin Y30-6 / A26 | rastgele sıra (öneri kabul), A26 |
| N12 | Form tarihi kendiliğinden geriye kurulur (kayıp önceki aya / yıla sessizce yazılır) | dk-ud4 Y-2, girdi §2 m.5 | ekran senaryosu |
| N13 | Değersiz'den SONRA bağlı tahsilat silinir / bağı kalkar / tarihi 16.09 – 20.09 / tutarı 3.500 – 1.000 olur → bakiye ya da değişmez bozulur, ya da yeni değişmez meşru düzeltmeyi reddeder | girdi m.10 (3.300 / 423,55 × 3 / −200 / 2.300) | API m.10 |
| N14 | Silinenler'den Değersiz geri yüklemesi sınırı atlar (iki sıra: önce Değersiz sil → bağsız tahsilat → geri yükle; önce geri yükle → sonra yeni Değersiz) | girdi m.11 | API m.11 |
| N15 | Dönem Kilidi 17.09'u kapsıyor: @17.09 yazılamaz (period-locked), sınır kilit sonrası tarihler için (123,55); düğme / ipucu kilitli günü önermez | girdi m.12 | d62 A25 + API |
| N16 | Aynı gün iki kayıt (1.500 + 1.500); birine Değersiz; öbürüne bugün yazılmışken ilkine @17.09 önerisi (gerçek sınır 0) ; Şüpheliden Çıkar'ılmış ikinci kayıt | girdi m.8 / m.9, dk-ud3 P3 / P5 | d62 A20 / A21 + API m.9 |
| N17 | İki şirket: sınır işlevi başka şirketin verisini okur (bellek paylaşımı) | ders 17 | API (iki şirket) |
| N18 | Yedekten geri yükleme: geri yüklenen veride sınır / değişmez farklı çıkar | ders 17 | API (yedek → geri yükle → sınır aynı) |
| N19 | Geri alınan uygulamanın ürettiği bozuk durum (Değersiz 3.000, bakiye −576,45) Mutabakat Testi'nde ve kapıda GÖRÜNMEZ | dk-ud4 ("Mutabakat TAMAM") | SQL ile kurulan bozuk durum |
| N20 | Değişmez meşru sonraki işlemi reddeder: Değersiz'den SONRA yazılan avans / fazla tahsilat (cari alacaklıya geçer), m.10 düzeltmeleri, eski sürümden gelen veri (taban sapması) | yeni değişmezin yan etkisi | API + kâhin karşılaştırması |
| N21 | Hız: liste / Değersiz Yaz / cari kartı / geri yükleme ayırıcıyı tarih × ikili arama kez koşturur | ders 47, 53 (a) | hız ölçümü |
| N22 | Saat dilimi: 'bugün' ve kayıt günü UTC ↔ Europe/Istanbul farklı | ders 13 | iki TZ |

## 0b. TASARIM (koddan ÖNCE)

**Tek işlev:** `lib/bank/doubtful.mjs` içinde `writeOffLimit(record, date, { at })` — liste alanı, Değersiz Yaz, Silinenler'den geri yükleme ve formun uç noktası AYNI işlevi okur (üç kopya formül YOK).
Girdi: carinin kayıtları + karşılıkları + alacak satırları (bugünkü `doubtfulRows` / `doubtfulCredits`, BİR kez okunur) ve bugünkü ayırıcı `allocateDoubtful` (lib/doubtful-gl.mjs — DEĞİŞMEZ) ile `linkedShares`
(bağlı satırın payı — bugünkü kuyruk kesiti; `obligation-queue.mjs` DEĞİŞMEZ). Ayırıcının çıktılarından türetilenler:
1. **Bağlı satır kümesi:** tam koşuda `linked` geri çağrısının dizi döndürdüğü (null değil) alacak satırları (faturaya bağlı tahsilat / evrak — S25 (c), S168).
2. **F(S, D)** (S264 + S-M2-1 = B + S270 "sonradan gelen bağsız" + "sonraki Değersiz satırları"): D gününe ve SONRASINA ait bağlı satırlar girdiden çıkarılıp ayırıcı yeniden koşulur; S kaydının
   sondaki kalanı. (D'den önceki günlerin bağlı payı düşülmüş; bağsız satırlar hangi gün gelirse gelsin kaydın kalanından yararlanır; kayıttaki bütün Değersiz satırları düşülmüş.)
3. **Güvenlik denetimi (S270 değişmezi, yazım anı):** X tutarlı varsayımsal Değersiz satırı (D günü, o günün Değersiz'lerinin sonunda — yazım sırası en son; geri yüklemede satırın kendi
   yazım anı) girdiye EKLENİP ayırıcı koşulur (kuyruk kesitine de aynı satır eklenir — yazımdan sonraki hâlin birebiri): (a) yeni satır kaydın o anki kalanına sığar (dışarı taşan 0);
   (b) carinin öbür Değersiz satırlarının dışarı taşanı büyümez; (c) bakiye − X ≥ 0 (S270 (ii)).
4. **Sınır(S, D)** = (a)–(c)'yi sağlayan en büyük X ≤ min(F, bakiye). Önce X = üst uç denenir (çoğu durumda tek koşu), tutmazsa kuruş kuruş ikili arama (X büyüdükçe koşullar yalnız bozulur).
5. **Önerilen tutar (BAŞ MİMAR Y30-6):** Sınır ile S155'in (kayıttan sonra carinin borcu açık şüphelinin altına düşemez — kapının doubtful:balance kuralı) izin verdiğinin küçüğü — aynı varsayımsal koşudan
   (açık şüphelinin yeni toplamı). Ekranın önerdiği tutar ve tarih bu yüzden HER ZAMAN kabul edilir.
6. **Ret kodları (kâhin Y30-4):** sınır ≤ 0 → 409 `doubtful-closed`; tutar > sınır → 400 `doubtful-writeoff-exceeds`; ileti gerçek sınırı ve NEDENİ (kalan şüpheli / o günün bağlı tahsilatından önce sayılan
   kalan / sonraki satır ya da öbür kayıt / carinin bakiyesi) ve farklıysa başka tarihle yazılabilecek tutarı söyler. Çıkarılmış / iptal kayıt eskisi gibi `doubtful-closed`.
7. **Liste alanı:** açık durumlu her kayıtta `writeOff` = { bugünkü sınır ve öneri; kayıt gününün (kilitliyse ilk açık günün) sınırı ve önerisi; en çok yazdıran izinli gün }. Aday günler:
   ilk açık gün, bugün ve aradaki bağlı satır günleri (sınır yalnız bu günlerde değişebilir — bağlı satır yoksa F günden bağımsızdır). Düğme: herhangi bir aday günde sınır > 0.
8. **Form:** tarih BUGÜN gelir (kendiliğinden geriye kurulmaz); ipucu seçili tarihin sınırını ve (farklıysa) en çok yazdıran günü söyler; tarih değişince sunucudan (`GET …/:did/write-off?date=`) yeniden
   okunur, kullanıcı tutara dokunmadıysa önerilen tutar yenilenir. Bildirim: bu yazımın tutarı + yazımdan sonraki gerçek kalan (+ varsa aynı tarihle yazılabilecek tutar).
9. **Değişmez (Mutabakat Testi + kapı — `doubtfulProblems`):** (i) her Değersiz satırı W için, W'nin yazıldığı andaki dünyada (W'den sonra yazılmış Değersiz satırları yok; W.D gününe ve sonrasına ait
   bağlı satırlar yok; W'den SONRA yazılmış ya da değiştirilmiş, W.D'den sonraki tarihli bağsız satırlar yok) kaydın kalanı W'yi karşılar — geri alınan uygulamanın bozuk durumu burada görünür;
   (ii) carinin bakiyesi eksi, son işlemi bir Değersiz satırı ve o satırdan sonra cari için başka yazım / silme / geri yükleme yoksa → Değersiz cariyi eksiye düşürmüş. Yazım sırası ölçütü
   bugünkü (ders 31: created_at → rowid). Eski sürümden gelen veride ihlal varsa kapının taban kuralı (sayı büyümedikçe engellemez) geçerlidir.
10. **Hız (ders 47):** okuma (SQL) cari başına BİR kez; ayırıcı koşu sayısı: F için 1, denetim için üst uçta 1 (gerekirse ikili arama ~log2(tutar) ≈ 20). Bağlı satırı olmayan caride `linked` yok —
    koşular salt bellek içi (satır sayısıyla doğrusal). Liste: açık kayıt × aday gün; bağlı satırsız caride 2 gün. Değişmez yalnız Değersiz satırı olan carilerde çalışır.
