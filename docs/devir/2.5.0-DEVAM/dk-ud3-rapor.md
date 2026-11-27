**DAR KONTROL UD3 raporu** (fark `e7934c5e..c767e765`; yalnız hata arandı, kod değiştirilmedi, commit / push yapılmadı)

Sonuç: **YÜKSEK yok, bir ORTA var (ORTA-1).** ORTA-1 S264 = A'nın eksik uygulanmasıdır ve önceden vardı (gerileme değil). Bir karar gerektiriyor; aşağıda "KULLANICIYA SORULMALI" başlığında.

Okunanlar: CLAUDE.md, BAGIMSIZ-DOGRULAMA-PRENSIBI (§3), C5B-TYK-TASARIM (başlıklar ve ilgili kısımlar), kahin-cari29-kararlar.md. Yasaklı belgeler ve git log okunmadı.

Not defteri: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-ud3-r8m4`
- Eski kod kopyaları e7934c5e, v2.4.9 ve mutant kopya `git archive` ile açıldı, iş bitince tam yolla silindi.
- Yeniden koşu için yalnız betikler ve çıktılar kaldı (552 KB). Ana oturum isterse bu klasörü tam yoluyla silebilir.
- Kendi worktree'mde geçici olarak c767e765'e geçmiştim ve node_modules bağı kurmuştum. Ağaç kendi dalına geri alındı, bağ silindi.

---

### ORTA-1 — S264 = A yalnız tek adımlı Değersiz'de uygulanıyor

**Ne oluyor:** Kaydın kalanı aynı günün bağlı payıyla 0'a inmişse Değersiz hiç yazılamıyor. Kısmi Değersiz'den sonra kalan kısım da yazılamıyor. Karar metni "Değersiz, o günün bağlı payından ÖNCE değerlendirilir, tam tutar kabul edilir" diyor; bu iki durumda karşılanmıyor.

**Yer:**
- `server/lib/bank/doubtful.mjs:539–547` (`openRecord`): `state.remaining <= 0` görülünce 409 `doubtful-closed` döner.
- Bu denetim `writeOff` (`:615–620`) ve Silinenler'den geri yükleme (`:756–757`) içinde, S264 sınırından (`room = state.remaining + boundSameDayShare(...)`) ÖNCE çalışıyor. Bu yüzden ek pay hiç hesaba katılmıyor.

**Betik:** `.../dk-ud3-r8m4/s264-probe.test.mjs` (gerçek program, `HUKUK_LICENSE_URL=http://127.0.0.1:9`). Çıktılar `yeni-s264.txt`, `eski-s264.txt`, `v249-s264.txt`. Ortak kurulum: Fatura G1 2.900 · Borç 3.400 · aynı gün tahsilat G1'e bağlı · Şüpheliye Al.

| Senaryo | Yeni kod c767e765 | Eski kod e7934c5e | v2.4.9 |
|---|---|---|---|
| P1: Değersiz 1.000, sonra 2.000 (17.09) | 1.000 → 200, kayıt "Değersiz Yazıldı" (kalan 0, tahsil 2.000); 2.000 → **409** "kapanmış"; bakiye **2.423,55** | 1.000 → 400 (sınır 123,55) | ikisi de 200; bakiye **423,55** |
| P2: Fatura 3.000, bağlı tahsilat 3.000, Şüpheliye Al 3.000; Değersiz 3.000 | Kayıt alınır alınmaz "Tahsil Edildi" (kalan 0); Değersiz → **409** "tamamı tahsil edilmiş"; bakiye **3.400** | aynı | 200; bakiye **400** |
| P3: aynı gün iki kayıt (1.500 + 1.500); R1'e Değersiz 1.500 | **409** (R2'ye 1.500 kabul) | — | 200 |
| P5: R2 aynı gün Şüpheliden Çıkar; R1'e Değersiz 1.500 | **409** | — | 200 |

- Tek adımda 3.000 kabul ediliyor (testteki (a) senaryosu); aynı tutar iki adımda yazılamıyor.
- Ekrandan bu duruma ulaşılamıyor: kayıt "open" değilse Değersiz Alacak Yaz düğmesi gizli (`client/assets/hof-accounts.js:1212`). Düğme yokken kullanıcı kaydı kapalı görüyor.
- API'den ulaşılabiliyor. KC-1'i üreten kâhin rastgele üreticisi bu sınıfı yeniden üretebilir; bu yüzden Uzun Doğrulama'daki kâhin karşılaştırması için de risk.
- Kâhinin `degersiz` kuralına göre (kalan = alınan − düşen tahsilatlar − değersiz, aynı gün sırası: al → değersiz → alacak) iki adımda da kabul beklenir. Kâhin bu senaryoyla koşulmadı (DOĞRULANMADI başlığında).

**Kök neden:** S264 sınırı yalnız tutar denetimine eklenmiş; "kayıt kapalı" denetimi gün sonu kalanına bakmaya devam ediyor. Kısmi Değersiz'den sonra aynı günün bağlı payı kalanı yine kapatıyor.

**En küçük düzeltme önerisi:** `writeOff` ve `restore` içinde kapalı denetimini `record.status !== "open" || state.remaining + boundSameDayShare(record, date) <= 0` yapmak. Bunun için `openRecord`'a ek pay alan bir değişken gerekir. Ayrıca P2'de düğme görünürlüğü ve P5 (aynı gün çıkarılmış kayıt; kapı reddedebilir) birlikte denenmeli.

**KULLANICIYA SORULMALI (ders 43; uç durum):**
- **A:** S264 sınırı kapalı denetiminden önce de uygulanır. P1'in ikinci 2.000'i ve P2'nin 3.000'i kabul edilir (v2.4.9 gibi); düğme bu kayıtlarda da görünür.
- **B:** Bugünkü hâl kalır.
- **C:** Uç durum böyle kalsın (BİLİNEN SINIR).
- **Önerim A.** Gerekçe: kararın metnine birebir uyuyor ve kâhin farkının yeniden çıkma riskini kapatıyor.
- Bakiyeye etkisi yalnız kullanıcı yazmak isterse: P1'de 2.423,55 yerine 423,55 (fark 2.000); P2'de 3.400 yerine 400 (fark 3.000). Veri bozulmuyor.

---

### DÜŞÜK bulgular

**DÜŞÜK-1 — güvenlik denetiminin ret iletisi yanıltıcı** (`doubtful.mjs:608–613`, `breaks: () => exceeds(room)`)
- Betik: `s264-probe.test.mjs` P8; çıktı `yeni-p8.txt`.
- Kurulum: R1 2.000 + R2 1.500 (17.09), bağlı tahsilat 1.500, R2'ye 18.09 Değersiz 1.500. Ardından R1'e 17.09 Değersiz 2.000 → 400.
- İleti: "Değersiz yazılacak tutar (2.000,00 TL) kalan şüpheli tutarı (2.000,00 TL) aşıyor."
- Geri alma doğru çalışıyor: cari satırı 4 → 4, olay 4 → 4, kayıtlar değişmedi; 500 sonra kabul edildi.
- Öneri: ayrı bir ileti, örneğin "carinin başka bir Değersiz satırını kalanın dışına taşır".

**DÜŞÜK-2 — Karşılık Ayır'da aynı sınıf (farkın dışında, önceden var; karar kapsamıyor)**
- P4: aynı gün bağlı tahsilat varken Karşılık 1.000 → 400 "en çok 123,55". v2.4.9'da 200.
- Cari bakiyesini değiştirmiyor (yalnız 129 / 644). S264'ün karşılık ikizi; ayrı karar gerekir.

---

### BAŞ MİMAR YORUMLARI DEĞERLENDİRMESİ

**Y-a (S264 sınırı)**
- Uyuyor: bağlı pay ekleniyor, bağsız pay eklenmiyor, sınır aynı güne özgü, Silinenler'den geri yükleme aynı sınırı kullanıyor.
- P6 (ertesi gün Değersiz) 400 / 123,55: yalnız aynı gün kuralıyla tutarlı.
- P7 (Değersiz'den sonra tahsilatın tarihi 16.09'a alındı): kabul edildi, bakiye 423,55, bütünlük denetimi geçti.
- Eksik: ORTA-1 (kapalı denetimi). Bir not: kod "şüpheliye almadan ÖNCE yazılmış" koşulunu ayrıca denetlemiyor. Ayırıcı aynı günde yazım sırasına değil sınıfa (al → değersiz → alacak) baktığı için sonuç aynı; bulgu değil.

**Y-b (ölçüm geçişlerinde para ↔ para eşleşmesi kapalı)**
- Karar metnine uyuyor: KS8 ("geri ödeme iadeye bağlanır") ve S266 KAPSAM ("iade geri ödemesinin kendi kuralları DEĞİŞMEZ").
- Değişiklik yalnız açık iade notu olan carileri etkiliyor.
- Saf kuyruk karıştırma denemesi (`fuzz.mjs`): 20.000 rastgele müşteri / tedarikçi carisinde (stok iadesi, alış iadesi, Ödeme, Alacak) toplam ≠ bakiye **0**.

**Y-c (kâhin 29'un iki okuması)**
- İkisi de karar metnine uyuyor:
  - S266 alanı girdinin saydığı iki türle sınırlı (Y29-1).
  - "Alacak yönlü kalem yoksa önce iade geri ödemesi" (Y29-3 (a)), KAPSAM'daki "yalnız avans ↔ Alacak kapama sırası" ifadesinden çıkıyor.
  - Alacak varken iade geri ödemesi değişiyorsa kâhin SUS'uyor (SK-54 = S267 C).
  - S265'in dört koşulu KAPSAM §2'deki bileşimle birebir.
- Uydurma kural görülmedi.

**Y-d (S98S99-d mutantı) — eşdeğer DEĞİL, eksik test**
- Saf kuyrukta mutant 10.000 müşterinin 69'unda, 10.000 tedarikçinin 169'unda sonucu değiştiriyor (`fz-mutd-c.json`, `fz-mutd-v.json`).
- Gerçek programda zorla üretildi (`yd-probe.test.mjs`). Senaryo: 13.02 faturasız stok iadesi 460 · 04.03 Ödeme 460 · 18.08 Alacak 290 · 17.09 stoktan satış 50 · 15.10 fatura 1.251,91.

| Kod | Bakiye | Fatura açığı (kart ve liste) |
|---|---|---|
| c767e765 | 1.011,91 | 1.011,91 |
| e7934c5e | 1.011,91 | 1.011,91 |
| v2.4.9 | 1.011,91 | 1.011,91 |
| Mutant | 1.011,91 | **1.251,91** (bakiyeden büyük) |

- Program doğru; bu senaryo hazır bir test olarak 2.5.1'e verilebilir.

**Y-e (S268 form ipucu)**
- C (BİLİNEN SINIR) kabul edilebilir: program tam tutarı kabul ediyor.
- Not: ipucuna uyan kullanıcı 123,55 yazarsa kayıt kapanıyor ve kalan kısmı yazamıyor. Bu ORTA-1'in P1 sonucuyla aynı; ORTA-1 düzeltilirse ipucunun da S264 sınırını göstermesi anlamlı olur.

---

### Doğrulanan iyi sonuçlar (bulgu yok)

- **Yeni testler iki saat diliminde:** S264, UD3 iade geri ödemesi ve kilit ölçümü testleri TZ=UTC'de 16/16, TZ=Europe/Istanbul'da 16/16; cancelled 0, skipped 0.
- **Testlerin dişi var:** Eski kopyada (yeni testlerle) 16'nın 13'ü kırmızı, beklenen nedenlerle:
  - S264: "kalan 123,55".
  - UD3: Açılış Kalan 824,66 ≠ 918,61; G7 açığı 950,32 ≠ 1.161,39.
  - Kilit: Σ kalem 211.926,73 ≠ 211.719,68; tohum 6 açığı 1.068,72 > 781,40; tohum 7001'den itibaren toplam ≠ bakiye.
  - Yeşil kalan 3'ü koruma testleri: (b), (c) ve "kilitsiz aynı".
- **Kilit yolu, genişletilmiş rastgele deneme:** `kilit-fuzz.test.mjs`, 100.000 cari (gürültüye faturasız iade ve Ödeme eklendi). Toplam ≠ bakiye **0**; taksitli fatura açığı kartın kendi kalanını hiç aşmadı. Kilidin kalemleri değiştirdiği cari 6.387, ön ödeme ölçümlü 649.
- **Hız:** Kilit izi olmayan ya da ölçümü değişmeyen caride ek geçiş yok. Yakınsamayan yolda bir ek geçiş var (önemsiz).

---

### DOĞRULANMADI
- Kâhinin P1 / P2 için beklediği sonuç: yalnız kâhin kural metninden çıkarıldı, kâhin koşulmadı.
- `runQueue`'da kilit sınırı düzeltildikten sonra ön ödeme yeniden değişirse sınırın yine uyumsuz kalabileceği (iç içe döngü yok). Rastgele denemede belirti görülmedi.
- Kâhin S265 alanında alış faturasının "belge durumu" alanının da susturulup susturulmadığı.

### DENENMEYEN
- Mutabakat 5.000, kâhin 1–30 × 120 ve tam `npm test` (görev gereği; ana oturum koşuyor).
- Ekran yürüyüşü.
- Tedarikçi tarafında Değersiz (şüpheli yalnız müşteride var).
- Yedekten tam geri yükleme ve iki şirket.

### SONRAKİ SÜRÜME (2.5.1)
- **Y-d:** S98S99-d için yukarıdaki API senaryosu test olarak eklensin (mutant şu anda yakalanmıyor).
- **Mutabakat motorunun S206 adayı benimsemesi (`motor.mjs`, `pendingS206`):** Model programın kapattığı aday kartı doğru kabul ediyor. Koşullar dar (tutar = kendi tahsilatı = modelin tahsilatı) ama bu bir kâhin zayıflaması: program yanlış adayı kapatırsa motor görmez.
- S263 sınıfının beklenen ret sayılması karara (C) uyuyor.

Ortam: Yük 0,45 / 4 çekirdek, bellek boş 9 GB (kullanılabilir 14 GB), disk boş 5,8 GB (en düşük 5,2 GB'a indi, 5 GB'ın altına düşmedi).
