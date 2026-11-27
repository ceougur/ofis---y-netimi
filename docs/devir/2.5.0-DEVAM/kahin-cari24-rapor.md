## CARİ KÂHİNİ BAKIMI 24 (S234 = A / S237 = A): rapor

**Özet:** İki saat diliminde de program ile kâhin 22.775/22.832 denetimde aynı. 57 fark var, hepsi yeni senaryolarda:
- 38'i Düzenle ile azaltma. Program kesilmiş faturayı düzenletmiyor; bu fark girdinin "programın henüz yapmadığı" kısmı olarak yapım aşaması listesine girdi.
- 19'u iki program şüphesi (P-1 ve P-2, aşağıda). Bunları listeye koymadım. `npm run test:kahin-cari` bu 19 farkla kırmızı kalır; düzeltme mi, soru mu, karar sizin.

**Taban ve dal:** Taban `de403915` (reset doğrulandı). Dal `worktree-agent-af6968001b29cf05e`, uç **`12994e50`**. Push yok, zamanlanmış görev yok.
Ortam (son ölçüm): yük 2,09 / 4 çekirdek, bellek boş 4 GB (kullanılabilir 11 GB), disk boş 8,0 GB. Arka planda iş kalmadı.

### Yapılan eşleme (kara kutu yoklaması; kural kaynağı değil)
Betikler `docs/kanit/2026-11-21/kahin-cari24-arac/yokla1.mjs`, `yokla3.mjs` ve `yokla4.mjs`.
- **Kartı Kapat:** `PUT /api/workspace/plans/:id {status:"closed"}`. Yeniden Aç aynı uca `{status:"active"}` ile gidiyor.
- **Kapanış günü:** her zaman sunucunun bugünü. Gövdedeki `closedAt` yok sayılıyor.
- **Taksitli faturanın kendi kartı:** fatura kartının `planId` alanından bulunuyor. Plan listesinde faturaya bağ alanı yok.
- **Fatura Düzenle:** `PUT /invoices/:id` var, ama kesilmiş faturada 409 `invoice-not-draft` dönüyor.
- **İade iptali:** `/invoices/:id/cancel`.
- **`ownPayState`:** ham çıktıya yazılıyor, denetlenmiyor (girdide kuralı yok).

### Yeni denetimin kuralı (KARARLAR.md §36)
- **Yeni dil adımları:** `kart_kapat {kart|fatura}`, `kart_yeniden_ac`, `fatura_duzenle {fatura, adet}`. Yeni anahtarlar `kart:<ad>:kapali` ve `kart:fatura:<F>:kapali/toplam/kalan`.
- **Kapanmış kart (KG-23, S205, S220):** bakiye, Kasa ve Kalan değişmez. Gecikme günü = min(taksitin vadesi, kapanış günü).
- **Kart küçülmesi (girdi §1 KAPSAM (a) + karar (4) + S234 / S237 + KAPSAM (b)):** iadenin yazıldığı anda, faturayı tamamen içine almış tek kalemli Mevcut Borç kartı (ya da taksitli faturanın kendi kartı) küçülür. Küçülme planın vadesi sırasıyla, her taksitin açık kısmı kadar yapılır; fazlası carinin avansı olur. Açık kartta ve kapanmış kartta kural aynı.
- **İade iptali (KAPSAM (c)):** küçülmenin tersi — tutar aynı taksitlere geri gelir.
- **Düzenle (KAPSAM (e)):** azaltılan tutar iade gibi işlenir.
- **İki kart (KAPSAM (f)):** iade yalnız faturayı içine almış kartı küçültür.
- **Fatura İptali + kapanmış kart (KAPSAM (d), S226 = C):** kâhin susuyor.
- **Kararın söylemediği alt durumlar:** SUS ve `belirsiz` kaydı (SK-42, SK-43, SK-44; kapanmış karta tahsilat; tutarı 0'a inen taksit satırı).

### Öz test ve mutasyon
- **Öz test:** 7.678/7.678, iki saat diliminde bayt bayt aynı.
- **Mutantlar 334–340:** yedisi de elle tabloda değerle yakalandı. Görev metnindeki üçü dahil: 334 kapanmış kartı küçültmüyor, 335 son taksitten küçültüyor, 336 iade iptalinde büyümüyor. Ayrıca 337, 338, 339 ve 340.
- **`kos.mjs` mutasyon taraması:** yakalanmayan 0.

### Program ↔ kâhin (iki saat dilimi, taban programı)
- **Yeni kâhin:** UTC ve Europe/Istanbul 22.775/22.832, fark listeleri birebir aynı.
- **Eski senaryolar ve rastgele senaryolar:** programla aynı. d8 B'nin karar gereği yeni değerleri de programla tutuyor.
- **Kararların kendi örnekleri programla aynı:**
  - S234 (d53 P1): Kalan 300, bakiye 300.
  - S237 (d53 P2): 08.10 gecikmişi 0, bakiye 600.
  - Yeniden Aç / yeniden kapat sonrası Kalan 300.
  - Kendi kartlı fatura, iki kart ve açık karttaki (4) senaryoları.
- **P-1 (5 fark) — iade iptali, KAPSAM (c) "küçülmenin tersi"ne uymuyor:** program geri gelen tutarı son taksite ekliyor.
  - En küçük örnek d55 B1: kart 900 (05.10 / 05.11 / 05.12), tahsilat 300, 10.11'de iade 300, 20.11'de iade iptali.
  - 20.11 gecikmişi: program 0, kâhin 300.
  - Kapanmış kartta yalnız taksit satırı farkı var.
- **P-2 (14 fark) — küçülme kartın açık kalanını aşınca, (4)'ün "fazlası carinin avansı" sözüne uymuyor:**
  - En küçük örnek d55 B2: kart 900, kart tahsilatı 600, iade 600.
  - Program: Tahsil Edilen 300, Kalan 300, iade belgesinin açığı 0.
  - Kâhin: Tahsil Edilen 600, Kalan 0, fazlası 300 avans.
  - Bakiye iki tarafta da −300; program cari alacaklıyken kartta 300 borç gösteriyor.
- **Program ↔ eski kâhin (d54 / d55):** 295/308. 13 fark: 10'u kart tutarı (eski kâhin küçültmüyor; 900 ↔ 600), 3'ü P-1.

### Yapım aşaması listesi
| | Kayıt |
|---|---|
| Eski liste | 0 |
| Kendi kopyada üretilen | 57 |
| Depoya giren (`YAPIM-ASAMASI.json`, paket "Ç7b") | 38 — yalnız Düzenle (d53 P4 / A4) |
| Yeni / kapanan / değişen | 38 / 0 / 0 |

- İki kart fark vermedi, o yüzden kaydı yok.
- Bağdaştırıcıya "Ç7b" paket etiketi eklendi. Paket kuralını görmek için `.mjs` / `.json` dosyalarında `grep -l` yaptım; çıktıda yalnız `server/**` ve üç program test dosyasının adları göründü, içerikleri açılmadı (§36'da yazılı).

### Eski kâhin kırmızısı
- **Toplam:** 340/471 elle denetim kırmızı, hepsi beklenen nedenle.
  - d53: 271/271 — eski kâhin `kart_kapat`'ı bilmiyor.
  - d54: 49/128 ve d55: 20/72 — kart tutarı 900 kalıyor, öbür anahtarlar yok (tanımsız).
  - d8 B: 2/2.
- **G3:** 639/639, BEKLENMEYEN 0. 226 fark var, hepsi S234 sınıfında. Eski kural setleri 512/512 bayt bayt aynı.

### KULLANICIYA SORULMALI
- **SK-43 (uç durum):** kısmen kartta olan faturaya iade. Öneri: iade önce kartın dışındaki açığı kapatsın.
- **SK-44 (uç durum):** çok kalemli kartta iade. Öneri: S126 sırası aynen kalsın.
- **SK-42 (a)/(b):** Düzenle ile kartın açık kalanından fazla azaltma ve Düzenle ile artırma. Düzenle kodlanınca sorulur.
- **P-1 ve P-2 için soru gerekirse:** önerilen seçenekler §36'da. İkisinde de bakiye aynı. P-1 açık kartta gecikmişi değiştirdiği için para kuralı sorusu (ders 43).

### SONRAKİ SÜRÜME (2.5.1)
- Tutarı 0'a inen taksit satırının listede kalıp kalmadığı (görünüm).
- Taksitli faturanın kendi kartında Tahsil Edilen ve taksit satırlarının denetimi.
- Rastgele senaryo üreticisine Kartı Kapat / iade adımı eklenmesi.

### DENENMEYEN
- **S205'in "ertesi günden gecikmiş" kuralı:** kapanış hep sunucunun bugünü olduğu için tek günlük senaryoda gözlenemiyor.
- Hatırlatma.
- `ownPayState` (kural yok).
- **Senaryo yazılmayanlar:** SK-42 / SK-43 / SK-44 alanları, S226 = C, kapanmış karta tahsilat, iadeden sonra kart silme / fatura iptali, nakit geri ödemeli iade.
- Satış kartı ve Tablodan Aktar kartı.
- Defter ve mobil yazma kâhinleri açılmadı.

### Açıkça bildirdiklerim
- **Ön program koşusu:** yük 6,45 iken başladı; görev metnindeki "4'ün üstündeyse bir kez bekle" uygulanmadı. Bu ilk koşu kanıt sayılmadı.
- **G3 Europe/Istanbul:** ilk denemede paylaşılan kilidi beklerken 40 dakika sınırında kesildi (çıkış 124). Tek başına yeniden koşuldu: 639/639, döküm UTC ile aynı.
- **P6 / A6 senaryosu ilk koşudan sonra değiştirildi:** ikinci kart bir faturayı alınca kâhinin mevcut SK-20 susmasına düşüyordu. İkinci kart tek bir elle Borç'a denk açılacak biçimde değiştirildi. Bir beklenen değer kâhine uydurulmadı; değişiklik üreteçte notlu.

### Değişen yollar
- `test/bagimsiz/cari/model.py`, `kos.mjs`, `oz-test.py`, `KARARLAR.md` (§36), `YAPIM-ASAMASI.json`
- `test/bagimsiz/cari/senaryolar/d53-c5-s234-kapali-kart-iade.json`, `d54-c5-s234-acik-kart-iade.json`, `d55-c5-s234-iade-iptal-gecikmis.json` (yeni) ve `d8-c5-tanimsiz.json` (karar gereği)
- `docs/kanit/2026-11-21/kahin-cari24-arac/*`, `docs/kanit/2026-11-21/kahin-cari24-kanit/*`, `docs/kanit/2026-11-21/kahin-cari24-rapor-taslak.md`

### Commit listesi
- `023408a3` yorum + yoklama
- `250ea8d6` elle senaryolar
- `a7e999f2` kod
- `62e6e96c` kanıt (UTC + temel)
- `12994e50` kanıt (İstanbul program, eski kâhin, yapım aşaması) + §36 sonuç bölümleri

### Ana oturumun yeniden koşacağı komutlar
Ajan ağacında çalıştırılır. Eski kopya `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kc24/eski` içinde (`git archive de403915 test/bagimsiz/cari`).
- `bash docs/kanit/2026-11-21/kahin-cari24-arac/kos.sh utc temel` ve `kos.sh ist temel`
- `bash docs/kanit/2026-11-21/kahin-cari24-arac/kos.sh utc program` ve `kos.sh ist program`
- `bash docs/kanit/2026-11-21/kahin-cari24-arac/kos.sh utc program-eski`
- `bash docs/kanit/2026-11-21/kahin-cari24-arac/kos.sh utc yapim`, sonra `python3 -I docs/kanit/2026-11-21/kahin-cari24-arac/yapim-ayir.py <üretilen> test/bagimsiz/cari/YAPIM-ASAMASI.json <hedef> <döküm>`

Betiklerdeki bütün koşular `flock -s` ile; her parça 40 dakikayla sınırlı.