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

---

# RAPOR (M2 kod turu; dal ucu ve commit listesi en sonda)

## 1. DEĞİŞEN GÖZLENEBİLİR DAVRANIŞLAR (önce → sonra)

Taban T: Fatura 2.900 (10.09) + Borç 3.400 (12.09) · 17.09 faturaya bağlı tahsilat 2.876,45 · 17.09 Şüpheliye Al 3.000 (tahsilattan sonra). Bugün 15.10.2026.

| # | Ekran / yol | Önce (t251-m2-taban) | Sonra | Karar |
|---|---|---|---|---|
| 1 | Cari kartı → Şüpheli Alacak → **Değersiz Alacak Yaz**, kısmi Değersiz'den sonra (T + 1.000 @17.09; kayıt "Değersiz Yazıldı", kalan 0) | düğme YOK; API 2.000 @17.09 → 409 "değersiz yazılarak kapanmış"; bakiye 2.423,55'te kalır | düğme VAR; 2.000 @17.09 kabul; bakiye 423,55 | S269 = A |
| 2 | Bağlı tahsilat = şüpheli tutar (Fatura 3.000 + Borç 3.400, bağlı 3.000, Şüpheliye Al 3.000) | 3.000 @aynı gün → 409 "tamamı tahsil edilmiş"; bakiye 3.400 | kabul; bakiye 400 | S269 = A |
| 3 | Sonradan gelen bağsız tahsilat (T + 01.10 bağsız 1.000 önce yazılmış) | Değersiz @17.09 → 409 (kayıt kapalı) | @17.09 en çok **2.000** (3.000 ve 2.000,01 → 400), bakiye 423,55; @01.10 / @18.09 → 409 "yazılabilecek tutar kalmadı … 17.09.2026 tarihiyle en çok 2.000,00 TL" | S270 = A + S264 |
| 4 | Sonraki tarihli Değersiz satırı (T + 100 @25.09) | @17.09 sınır yanlış (400 iletisi "kalan şüpheli tutarı (… TL) aşıyor") | @17.09 en çok **23,55** (23,56 → 400, ileti "sınır: daha fazlası sonraki bir Değersiz Alacak satırını … kalanın dışına taşırırdı") | S270 (sonraki Değersiz satırları) |
| 5 | Ertesi gün (T + @18.09) | 123,55 (aynı) | 123,55; sonra @17.09 0,01 → 409 kapalı | S-M2-1 = B |
| 6 | Bakiye sınırı (Borç 400 + Fatura 3.000, Şüpheliye Al 3.000, SONRA bağlı tahsilat 3.000) | 400,01 → 409 kapalı; 400 → 409 | 400,01 → 400 (sınır: carinin borç bakiyesi), 400 kabul, bakiye 0; 0,01 → 409 | S270 (ii) |
| 7 | İki kayıt, öbürüne bugün Değersiz (A21) | 0,01 @17.09 → (taban) | → 409 kapalı (öbür kaydın satırı dışarı taşardı) | S270 değişmezi |
| 8 | Silinenler'den Değersiz geri yükleme, araya 01.10 bağsız 1.000 girmiş | taban: geri yükleme 409 ("kalan şüpheli tutar … artık karşılamıyor"), bakiye 2.423,55 | 409, ileti gerçek sınırı söyler ("… en çok tutarı (2.000,00 TL) aşıyor"); sonra 2.000 kabul, bakiye 423,55 | S270 + S269 (aynı işlev) |
| 9 | **Form**: tarih | bugün; önerilen = kayıttaki "kalan" | bugün (kendiliğinden geriye KURULMAZ); önerilen = bugünün ÖNERİSİ (sınır ∧ S155); yazılabilir tutar yoksa tutar BOŞ | S268 = A + girdi §2 m.5 |
| 10 | **Form**: ipucu | "En çok ₺… (kalan şüpheli)." | "15.10.2026 tarihiyle en çok ₺123,55 yazılabilir (kayıtta kalan şüpheli tutar). 17.09.2026 tarihiyle en çok ₺3.000,00 yazılabilir." — tarih değişince sunucudan (`GET …/write-off?date=`) yeniden okunur, dokunulmamış tutar yenilenir | S268 = A |
| 11 | **Bildirim** (Değersiz Yaz sonrası) | "Değersiz alacak yazıldı: ₺<TOPLAM> · şüphelide kalan ₺0,00." | "Değersiz alacak yazıldı: ₺1.000,00 · şüphelide kalan ₺0,00 · 17.09.2026 tarihiyle en çok ₺2.000,00 daha yazılabilir." (bu yazım; gerçek kalan; aynı tarihle kalan sınır) | plan M2 |
| 12 | Ret iletileri | "Değersiz yazılacak tutar (X) kalan şüpheli tutarı (Y) aşıyor." (Y = sınır, neden yok; güvenlik denetiminde aynı ileti) | "Değersiz yazılacak tutar (X) bu kayda GG.AA.YYYY tarihiyle yazılabilecek en çok tutarı (L) aşıyor; sınır: <neden>. [<başka tarih> tarihiyle en çok … yazılabilir.]" Kapalıda: "… tarihiyle değersiz alacak yazılamaz; yazılabilecek tutar kalmadı (<neden>)." | dk-ud3 DÜŞÜK-1, dk-ud4 'breaks' |
| 13 | Mutabakat Testi + kapı | geri alınan uygulamanın durumu (Değersiz 3.000, bakiye −576,45) "TAMAM" | "Şüpheli Alacak Kayıtları" KIRMIZI: "Değersiz Alacak satırı 17.09.2026 3.000,00 TL: yazıldığı andaki sınırı (2.000,00 TL) aşıyor …" + "… cariyi eksi bakiyeye (-576,45 TL) düşürdü (S270)"; kapı sonraki yazımı 409 ledger-integrity ile reddeder | S270 değişmezi |
| 14 | Y30-6 / S155 (T + 25.09 ikinci kayıt 500) | — | sınır 3.000, ÖNERİ 2.923,55 (öneri kabul; 3.000 ve 2.923,56 kapıda ret, bakiye 500) | BAŞ MİMAR Y30-6 |

Değişmeyen (bilerek): SK-55 (A19: aynı gün bağlı → bağsız 50 → Şüpheliye Al, Değersiz 100 @18.09) → taban gibi 400, sınır 73,55, bakiye 3.373,55 (SK-55 = C, bugünkü sayı). Şüpheliden Çıkar ve Karşılık Ayır kuralları değişmedi. Ayırıcı (`lib/doubtful-gl.mjs`) ve borç sırası (`lib/obligation-queue.mjs`) DEĞİŞMEDİ.

## 2. DEĞİŞEN DOSYALAR
- `server/lib/bank/doubtful.mjs` — tek sınır işlevi (`writeOffContextOf`, `writeOffLimitOf`, `writeOffDays`), `linkedShares` varsayımsal satır desteği (`withExtra`; kurulum paylaşılır), Değersiz Yaz / Silinenler'den geri yükleme / `listFor` ('writeOff' alanı) / `writeOffQuote`, değişmez `writeOffInvariantProblems` (+ `ledgerBalanceMinor`, `activityAfter`), `conflictReason` iki yeni tür, `summarize` (özet aynı ayırmadan) ve `ledgerBalanceMinor` (dışa açık; liste ve formun ucu bakiyeyi defter satırlarından okur — kartla eşitliği testte; yazım yolları kartın bakiyesinden). `boundSameDayShare` kalktı.
- `server/routes/doubtful.mjs` — `GET /api/workspace/accounts/:id/doubtful/:did/write-off?date=` (Carileri Görme); Değersiz Yaz yanıtına `writtenMinor` + `writeOffAfter`.
- `client/assets/hof-accounts.js` — Değersiz Alacak Yaz düğmesi `writeOff.anyMinor > 0` ile; form (tarih bugün, ipucu, tarih değişince sunucudan okuma, bildirim). `hof-ui.css` değişmedi.
- Testler: `test/supheli-degersiz-siniri-m2-251.test.mjs` (21 test), `test/supheli-degersiz-siniri-m2-v249-251.test.mjs` (3), `test/fixtures/m2-degersiz-senaryo.mjs`, `test/fixtures/m2-degersiz-v249/{uret.mjs.txt,v249.json}`, `test/e2e/senaryo-degersiz-siniri-m2-251.mjs` (24 denetim).
- Belge / kanıt: `docs/devir/2.5.1-DEVAM/m2-rapor.md`, `docs/kanit/2026-11-27/m2-*`.
- Dosya sınırı dışında HİÇBİR dosyaya dokunulmadı (`obligation-queue`, defter, Rapor Merkezi, WhatsApp, devir, `.github/**`, `package.json`, `tools/**`, göçler, kılavuz, `test/bagimsiz/**` — `git diff t251-m2-taban..HEAD -- test/bagimsiz` boş).

## 3. TARAMA TABLOSU (nasıl bozulur → test; §0 listesi)
| # | Kapsayan test / koşu | Sonuç |
|---|---|---|
| N1 | sınıf A9 / A10 (API, kâhin d62), bozuk durum testi (SQL), ekran §5, rastgele | yeşil |
| N2 | A11–A18 (altı sıra + ertesi gün) | 2.950 kabul, 50 kapalı, 423,55 ×8 |
| N3 | A6 / A7 / A8 + ileti testi | 123,55 / 23,55 / 1.500 |
| N4 | A6 / A10 / A28, liste-ucu testi (@18.09 123,55) | yeşil |
| N5 | A1–A4 | yeşil |
| N6 | A2 / A3 / A4 + liste alanı (Q2) + ekran §3–§4 (düğme durur) | yeşil |
| N7 | A5 + ileti ("sınır: carinin borç bakiyesi") | yeşil |
| N8 | A20 / A21, rastgele (iki kayıt dahil) | yeşil |
| N9 | "ret iletileri gerçek sınırı ve nedeni söyler" | yeşil |
| N10 | "bildirim verisi" + ekran §3 | yeşil |
| N11 | rastgele (öneri KABUL, sınır + 0,01 RET; 3 tohum × 10 cari × 14 adım), A26 / Q26 | yeşil |
| N12 | ekran §1 (tarih bugün) | yeşil |
| N13 | m.10 altı yol (sil / bağ kaldır / 16.09 / 20.09 / 3.500 / 1.000): 3.300 / 423,55 ×3 / −200 / 2.300 — girdi m.10 sayılarıyla birebir; Mutabakat TAMAM | yeşil |
| N14 | m.11 (a) sil → geri yükle 423,55; (b) sil → bağsız → geri yükle 409 → 2.000 kabul; (c) Değersiz'den SONRA avans → kabul, −576,45, Mutabakat TAMAM | yeşil |
| N15 | A25 (period-locked @17.09; @18.09 123,55) + liste en çok yazdıran gün 18.09 + uç "locked" | yeşil |
| N16 | A20 / A21 / M9 (öbür kayıt çıkarılmış → 1.500 kabul, 1.923,55) | yeşil |
| N17 | iki şirket: 002'de A1 / A7 / A9 / A10 / M11B / A26 001 ile birebir | yeşil |
| N18 | yedek → geri yükle: liste alanı ve Mutabakat birebir | yeşil |
| N19 | SQL bozuk durum: iki koşul kırmızı, kapı sonraki yazımı 409 ledger-integrity | yeşil (tabanda kırmızı: anahtarlar []) |
| N20 | m.10 / m.11 (c) / QR (Değersiz'den sonra Şüpheliden Çıkar) / 734 komşu test / kâhin 25.957 denetim | yeşil — BİR gerileme bulundu ve düzeltildi (aşağıda) |
| N21 | hız ölçümü (§7) | bkz. §7 |
| N22 | bütün koşular TZ=UTC ve TZ=Europe/Istanbul | yeşil, sayılar aynı |

KENDİ GERİLEMEM (bulundu, düzeltildi, kanıtlı): değişmezin (i) koşulu ilk hâlinde Şüpheliden Çıkar'ı (kalanı sıfırlar) Değersiz anının dünyasına katıyordu → komşu `test/banka-230-supheli-bozma.test.mjs` "R" (Değersiz 100 → Şüpheliden Çıkar) 409 ledger-integrity ile kırmızı (UTC komşu koşusu 733/734; `m2-onceki-kosu/m2-komsular-UTC.log`). Düzeltme 80ef0d12 (kayıt W'nin dünyasında açık sayılır) + gerileme testi (QR); düzeltme öncesi kodda (56d70add) aynı test 409 ledger-integrity ile kırmızı, sonra yeşil; komşular iki TZ 734/734.

## 4. YENİ / DEĞİŞEN TESTLER — kırmızı nedeni (taban 0e96418a, ayrı worktree `/dev/shm/m2-kod/eski`, yalnız yeni dosyalar kopyalandı) ve yeşil
| Test | Taban (UTC = Europe/Istanbul) | Yeni 80ef0d12 (UTC = Istanbul) |
|---|---|---|
| sınıflar — adım sonuçları | KIRMIZI: a2d2 / a3d2 / a3d3 / a4d1 / a5d2 / a9d3 "409 doubtful-closed … kapanmış / tamamı tahsil edilmiş"; a5d1 / a9d1 / a9d2 kod doubtful-closed (beklenen exceeds); a20d1 / a27d2 ret | yeşil |
| sınıflar — bakiyeler | KIRMIZI (A2 / A3 / A9 2.423,55; A4 3.400; A5 400; A20 3.423,55; A27 3.423,55) | yeşil |
| sınıflar — Mutabakat Testi tamam | yeşil (koruma testi: tabanda da tamam) | yeşil |
| ret iletileri | KIRMIZI (eski ileti "kalan şüpheli tutarı (…) aşıyor") | yeşil |
| kayıt durumları | KIRMIZI | yeşil |
| liste / form ucu / bildirim / S155 / kilit / QR (7) | KIRMIZI: uç 405 "Bu yöntem desteklenmiyor"; liste alanı yok (`writeOff` undefined) | yeşil |
| S270 bozuk durum | KIRMIZI, beklenen neden: `doubtfulProblems` anahtarları [] (taban bozuk durumu görmüyor) | yeşil |
| iki şirket + yedek | yeşil (koruma testi) | yeşil |
| rastgele tohum 1 / 2 / 3 | KIRMIZI (uç 405 ya da — ilk adım silme / geri yüklemeyse — 'ledgerBalanceMinor yok'; ikisi de değişiklik öncesi kodda olmayan yol) | yeşil (yazılan 12 / 5 / 12, sınır+0,01 ret 34 / 21 / 31, geri yükleme 1 / 0 / 1) |
| v2.4.9 karşılaştırma (3) | 2 KIRMIZI (açıklanmamış fark) + 1 koruma | yeşil |
| defter bakiyesi = kart bakiyesi (777c8bf8 ile) | KIRMIZI: 'ledgerBalanceMinor yok (değişiklik öncesi kod)' | yeşil |
| ekran senaryosu | 6/12 geçti, 6 kaldı: ipucu "" (yok), önerilen 123,55 (3.000 değil), bildirimde 'daha yazılabilir' yok, S269 düğmesi YOK, sonra kesildi | 24/24 |
| Kanıt | `m2-eski-taban-yeni-testler-{UTC,Europe-Istanbul}` 3/21 · `m2-eski-taban-e2e-degersiz-siniri` 6/12 | `m2-son-yeni-testler-*` 21/21 (25acf40c) · `m2-son-e2e-degersiz-siniri-*` 24/24 |

## 5. KABUL KOŞULLARI
- **A (kâhin):** `npm run test:kahin-cari` iki TZ (son kod 25acf40c; önce 80ef0d12'de de aynı): 25.957 denetim, 25.905 tuttu, 52 "başarısız" = **yapım aşaması listesindeki 52 kaydın 52'si artık TUTUYOR** ("YAPIM AŞAMASI KAPANDI — listeden silin"); bunun dışında fark **0** (öbür senaryoların hepsi tam; b3y'deki "BİLİNEN 7" önceden var — BILINEN.json 2.4.5'ten beri değişmedi). Liste yeniden yazılmadı (ana oturum üretecek). Çıkış kodu 1 bu yüzden (kapanan kayıtlar listede durdukça).
- **B:** yeni testler tabanda beklenen nedenle kırmızı, yenide yeşil, iki TZ (§4). Komşular (git grep "doubtful|şüpheli|supheli" 54 dosya + sema-kapisi-bs7, backup, banka-210-gg-geri-yukle, geri-yukleme-uyari-244, yedek-220, yazim-duzeni, platform-tasinabilirlik, lisans-servisi-izolasyonu; liste `m2-arac/komsular.txt`, 62 dosya): **734/734 iki TZ** (son kod 25acf40c; 80ef0d12'de de 734/734). Ekran komşuları (UTC, son kod): senaryo-supheli-230 67/67, senaryo-supheli-kuyruk-250 15/15, senaryo-banka-210 429/429. `npm run test:kahin-defter`: taban 187/187 = yeni 187/187.
- **C (mutantlar; değerle, ayrı kopya `/dev/shm/m2-kod/mut`, betik `m2-arac/mutant.py`):** 11/11 ÖLDÜ (tablo §6).
- **D:** beklentisi değişen mevcut test / ekran senaryosu YOK (S264 testi `supheli-degersiz-s264-250` iletileri sınırı hâlâ içeriyor, değiştirilmedi, yeşil); yeni ekran senaryosu iki TZ koşuldu.

## 6. MUTANT TABLOSU
| Mutant | Öldüren (ilk) | Sonuç |
|---|---|---|
| M1 sonradan gelen bağsız sınırı küçültmesin | a8d2 / a9d2 / a10d2 / a17d2, Q9, rastgele, v2.4.9 | 7 kırmızı |
| M2 sonraki tarihli Değersiz satırı sayılmasın | a8d2, v2.4.9 | 2 kırmızı |
| M3 önceki günün bağlı payı düşülmesin | a10d1 / a10d2, Q6 @18.09, kilit | 4 kırmızı |
| M4 o günün bağlı payı Değersiz'den önce düşülsün | A1–A4, Q2, bozuk durum, v2.4.9 … | 8 kırmızı (16 test) |
| M5a yazım anı güvenlik denetimi atlansın | a7d2 ileti / kod, rastgele | 3 kırmızı |
| M5b Mutabakat değişmezi atlansın | S270 bozuk durum testi | 1 kırmızı |
| M6 önerilen tutar bakiye (S155) kuralını bilmesin | Q26 (öneri 2.923,55) | 1 kırmızı |
| M6b bakiye sınırı (S270 (ii)) atlansın | A5, ileti, rastgele | 3 kırmızı |
| M7 geri yükleme sınırı atlansın | m11by, bakiye, v2.4.9 | 5 kırmızı |
| M8 form eski 'kalan'ı önersin | ekran §4 "tutar boş gelir" | **ilk koşuda YAŞADI** (bugünün tarihinde öneri = kalan olduğundan); ekran senaryosuna denetim eklendi (56d70add), yeniden koşu 1 kırmızı |
| M8b form ipucu eski 'kalan'ı göstersin | ekran §1 / §4 ipucu | 2 kırmızı |
Not: M1 / M2 / M3'te testlerin bir kısmı yeni değişmezin kapısına (409 ledger-integrity) takılıyor — iki katlı koruma; kod farkı yine kırmızı. Mutantlar 56d70add koduyla koşuldu; 80ef0d12 düzeltmesi mutasyona uğrayan satırlara dokunmuyor (yeniden koşulmadı — DENENMEYEN).

## 7. HIZ (ders 47, 53 (a))
Temiz 100 bin kopyası (`ana-kabul/temiz-100k` → kendi kopyam; her kod taze kopyada), şüpheli kaydı en çok olan cari (9 kayıt, 35 satır), özel kilit, tur başına 5 tekrar, sıra eski / yeni / eski / yeni; başta yük 1,03–1,18 (≤ 2 → GEÇERLİ). Ham çıktı `docs/kanit/2026-11-27/m2-hiz/`.

| Yol (ortanca ms) | taban 1. | yeni (80ef0d12) 1. | taban 2. | yeni (80ef0d12) 2. | Değerlendirme |
|---|---|---|---|---|---|
| şüpheli kayıt listesi | 9,4 | 11,4 | 10,2 | 11,1 | **+%9 – %21 (≈ +1,5 ms; en az 3,7 → 7,7)** — sınırı aşıyordu → 777c8bf8: özet aynı ayırmadan, bakiye defter satırlarından (bir ayırıcı koşusu ve kart listesi okuması eksildi; defter bakiyesi = kart bakiyesi testte) |
| cari kartı | 73,9 | 84,3 | 74,5 | 72,2 | gürültü içinde (en az 69,7 / 73,2 ↔ 71,5 / 70,7) |
| YAZIM Değersiz Yaz | 6.609 | 6.170 | 6.039 | 6.187 | aynı (iki kodda ~6 sn — kapının tam koşusu; bu turun değişikliği değil) |
| YAZIM Silinenler'den geri yükleme | 6.316 | 6.461 | 6.096 | 6.369 | +%2 – %4 (aynı ~6 sn içinde) |
| formun sınır ucu (yeni yol) | — | 5,6 | — | 4,2 | yeni |

**777c8bf8 sonrası ölçüm: ÖLÇÜLEMEDİ** — özel kilit iki denemede (12:47–13:17, 13:17–13:47 UTC) alınamadı (başka ajanların paylaşımlı kilitleri; kural gereği bekleme döngüsü kurulmadı). Ana oturumun hız kabulünde ŞÜPHELİ KAYIT LİSTESİ özellikle yeniden ölçülmeli (betikler `m2-arac/olc-m2.mjs`, `m2-arac/kabul-m2.sh`); kötüleşme sürüyorsa birleşmez (ders 53 (a)).

## 8. KULLANICIYA SORULMALI
- YOK (para / kapama kuralı ayrışması çıkmadı; bütün sınıflar karar metinlerinden ve kâhinin elle tablosundan tek okumayla).

## 9. BAŞ MİMAR KARARI GEREKİYOR (değerlendirmeye; kod bu okumalarla yazıldı)
- **BM-1 — Mutabakat değişmezinin durum biçimi yazım SIRASINI okur.** S270 değişmezi bir YAZIM kuralı: aynı son durum meşru sırayla (Değersiz'den SONRA gelen avans — m.11 (c), bakiye −576,45 kabul) da, bozuk sırayla (önce yazılmış sonraki tarihli bağsız tahsilat — geri alınan uygulama) da oluşur. Bu yüzden Mutabakat / kapı denetimi yazım sırasını (created_at → rowid; ders 31) ve satırın sonradan değişmesini (updated_at; evrakta cheques.updated_at) okur: (i) her Değersiz satırı yazıldığı andaki dünyada (o andan sonra yazılmış / değişmiş, W gününe ve sonrasına ait bağsız satırlar yok; W gününe ve sonrasına ait bağlı satırlar yok) sınırı aşmaz; (ii) bakiye eksi ve carinin son işlemi bir Değersiz satırı (sonra başka yazım / değişiklik / silme / geri yükleme yok) → ihlal. Bilinen yan etkiler: (a) eski sürüm verisinde ihlal varsa Mutabakat Testi kırmızı olur, kapı taban kuralıyla yazımı ENGELLEMEZ (sayı büyümedikçe); (b) (ii) Değersiz'den sonra BAŞKA hiçbir işlem olmadan borcun silinmesi gibi durumlarda yanıltabilir (Silinenler kaydı da "işlem" sayıldığından silme durumu korunuyor); (c) aynı milisaniyede yazılan satırlarda belirsizlik "işlem var" sayılır (yanlış alarm vermez). Alternatif: değişmezi yalnız yazım anında (kapıda) uygulamak — Mutabakat Testi geri alınan durumu göremezdi (görev metni yakalanmasını istiyor).
- **BM-2 — Düğme görünürlüğü aday günleri:** ilk açık gün (kayıt günü; kilitliyse kilidin ertesi), bugün ve aradaki bağlı satır günleri. Bağlı satır yoksa sınır günden bağımsız (gösterildi: bugün yazılan X hep kalan kadar sığar); bağlı satır günleri dışındaki ara günlerde sınırın daha büyük olabileceği bir durum bulunamadı ama kanıtlanmadı (DOĞRULANMADI).
- **BM-3 — Formda tarih kendiliğinden geriye KURULMAZ** (girdi §2 m.5); bugünün tarihiyle yazılabilecek tutar yoksa tutar boş gelir, ipucu en çok yazdıran günü söyler. Kullanıcı tarihi değiştirince önerilen tutar yenilenir (tutara dokunmadıysa).
- **BM-4 — 'Değersiz' S155 reddi kapıdan gelir** (A26: 3.000 sınır içinde ama kapı "doubtful:balance" ile 409 ledger-integrity; ileti kapının anlaşılır S155 cümlesi). Önerilen tutar bunu bildiğinden ekrandan oluşmaz; API'den sınırla yazılınca ret kodu `doubtful-writeoff-exceeds` değil ledger-integrity'dir (kâhin A26'da kodu denetlemiyor).

## 10. SONRAKİ SÜRÜME (2.5.1 — 20.11 kuralı)
- Değişmezin (ii) koşulu için ayrı yazım izi (yazım anındaki bakiyeyi saklamak) — durumdan çıkarım yerine (BM-1'in kesin hâli); göç ister, kapsam dışı.
- M1–M8 mutantlarının 80ef0d12 üzerinde yeniden koşusu (düzeltme mutasyon satırlarına dokunmuyor).
- Şüpheli kayıt listesinin 777c8bf8 sonrası hız ölçümü (ÖLÇÜLEMEDİ — kilit).
- Liste alanının aday günleri için "ara günde daha büyük sınır yok" önermesinin rastgele kanıtı (BM-2).
- Karşılık Ayır'daki aynı sınıf (dk-ud3 DÜŞÜK-2) — KAPSAM DIŞI, ayrı karar bekliyor.

## 11. DOĞRULANMADI
- BM-2 önermesi (yukarıda).
- Çok sayıda bağlı tahsilatı olan carilerde ikili aramanın kuyruk kesiti maliyeti (hız ölçümündeki cari bağlı tahsilatsız olabilir — §7).
- Kâhin dilinde olmayan yollar (Silinenler geri yükleme, bağlı tahsilatın Düzenle'si, dönem kilidinin yazımı) yalnız programın kendi testleriyle ve girdi §3 m.10 sayılarıyla doğrulandı; kâhinle karşılaştırılmadı.

## 12. DENENMEYEN
- Tam `npm test` (görev gereği; ana oturum koşar). `test:mutabakat` / `test:guvenilirlik` uzun koşuları (son adayda).
- Windows (CI'de görülecek; yeni testler dosya silmiyor / kilitlemiyor — yedekten geri yükleme testi var, ders 48 gereği CI Windows'ta okunmalı).
- Evrak (çek) bağının değişmesi ve evrakın silinmesi API testimde yok — kâhinin d62 A23 / A24'ünde (kâhin karşılaştırması tuttu).
- Tedarikçi carisi (şüpheli yalnız müşteride).
- Koşuların bir kısmı yük 4'ün üstündeyken başladı (başka ajanların yükü sürekli 4,4–7,5; tek seferlik bekleme sonrası `flock -s -w` ile başlatıldı) — açıkça yazıyorum.

## 13. CI LİSTESİNE EKLENECEK
- `test/e2e/senaryo-degersiz-siniri-m2-251.mjs` (ci.yml e2e listesi + yayın listesi; ana oturum ekler — ders 49 ayrıştırma). Yeni `*.test.mjs` dosyaları `npm test` desenine kendiliğinden girer.

## 14. KILAVUZ METNİ ÖNERİSİ (Şüpheli Alacak → Değersiz Alacak Yaz)
"Değersiz Alacak Yaz formu bugünün tarihiyle açılır. Formun altındaki bilgi, seçtiğiniz tarihle en çok ne kadar yazılabileceğini ve daha çok yazdıran bir tarih varsa onu söyler. Tarihi değiştirdiğinizde tutar ve bilgi kendiliğinden yenilenir. Kaydın durumu 'Değersiz Yazıldı' görünse de o günün faturaya bağlı tahsilatından önce yazılabilecek tutar kaldıysa düğme görünmeye devam eder."

## 15. COMMIT LİSTESİ (t251-m2-taban..dal ucu; push YOK)
- 2b60554c tasarım + nasıl bozulur (koddan önce) · b1e41b7b sınır işlevi + Değersiz Yaz / geri yükleme / liste / form / uç · cb0689fa değişmez + testler (sınıf, liste, SQL bozuk durum, iki şirket + yedek, rastgele, v2.4.9)
- f45bc9c2 ekran senaryosu + neden metni · af7ecc21 değişmez (ii) yazım sırası · 56d70add ekran: M8'i öldüren denetim · 80ef0d12 KENDİ GERİLEMEMİN düzeltmesi (Değersiz'den sonra Şüpheliden Çıkar)
- e2bfdc6c Kanıt (80ef0d12) · 777c8bf8 liste hızı · 25acf40c test içe aktarımı (eski kodda yalnız ilgili test kırmızı) · 7ffbaed0 Kanıt (son kod) · son commit bu rapor.
- Dal: `worktree-agent-afce913f2c07f70a9`; dal ucu = bu raporun commit'i.

## 16. ANA OTURUMUN YENİDEN KOŞACAĞI KOMUTLAR (dal ucunda; `HUKUK_LICENSE_URL=http://127.0.0.1:9`, iki TZ)
```
TZ=UTC|Europe/Istanbul node --test --test-concurrency=1 test/supheli-degersiz-siniri-m2-251.test.mjs test/supheli-degersiz-siniri-m2-v249-251.test.mjs   # 21/21
PLAYWRIGHT_BROWSERS_PATH=<pw-1194> node test/e2e/senaryo-degersiz-siniri-m2-251.mjs                                                               # 24/24
node --test --test-concurrency=1 $(cat docs/kanit/2026-11-27/m2-arac/komsular.txt)                                                                  # 734/734
npm run test:kahin-cari    # 25.905/25.957; 52 'başarısız' = yapım aşaması listesinin 52 kaydı KAPANDI → liste `--yapim-asamasi-yaz` ile yeniden üretilmeli (52 → 0)
npm run test:kahin-defter  # 187/187 (taban da 187/187)
# eski kod kırmızısı: git worktree add --detach <yer> t251-m2-taban; yalnız yeni test dosyalarını kopyala → 3/21, ekran 6/12 (betik m2-arac/eski-zincir.sh)
# mutantlar: m2-arac/mutant.py + mutant-kos.sh (ayrı kopyada) → 11/11 öldü
# hız: flock -x … bash m2-arac/kabul-m2.sh <taban kökü> <yeni kök> <çıktı>  (yük ≤ 2)
```
Ortam (son okuma): yük 6,11 / 4 çekirdek (başka ajanlar), bellek boş 3 GB (kullanılabilir 9 GB), disk boş 8,6 GB.
