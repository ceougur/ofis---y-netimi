# S229 + S230 küçük program turu — ajan raporu (AYNEN; ajan a343eda2c3de7a0a1)

## S229 = A + S230 = A — küçük program turu raporu

Dal ucu **81e587b8**. Dal: `worktree-agent-a343eda2c3de7a0a1`, taban surucu5-uc = fce3d272. 12 commit, hepsi "Claude" adına, model adı yok. Push yapılmadı.

**Önemli:** cari kâhininde 46 yeni fark var (iki TZ'de aynı). Yapım aşaması listesi kendi kopyamda yeniden üretildiğinde 0'dan 46 kayda çıktı. Bu dal bu hâliyle birleşirse CI'nin cari kâhini adımı kırmızı olur. Karar aşağıda "BAŞ MİMAR KARARI GEREKİYOR 1"de.

### Değişen gözlenebilir davranış (önce → sonra)
İki en küçük örnek (tarihler sahte saate taşındı, durum 08.10):
- **Örnek 1:** F1 50.000 (vade 20.09) + Borç Yaz 30.000; 25.09'da kart 60.000.
- **Örnek 2:** F1 50.000; kart 50.000.

Ekran ekran:
- **Açık Faturalar** (ekran, PDF, Excel, TOPLAM, özet)
  - Örnek 1: F1 50.000 → **20.000** (18 gün gecikmiş).
  - Örnek 2: F1 50.000 → **satır yok**.
- **Anlık Durum fatura özeti** (masaüstünde kutusu yok; mobil `/overview` ve birleşik şirket raporu okur): açık ve vadesi geçen satış aynı kuralla düşer.
- **Fatura kartı**
  - Örnek 1: "Açık: 50.000" → "Açık: 20.000". Yeni satır: "Taksit Kartında: <kart> · 30.000"; bağlantı taksit kartını açıyor.
  - Örnek 1 başlığı: büyük rakam "Kalan 20.000", altında "Genel Toplam 50.000 · taksit kartında 30.000".
  - Örnek 2: "Vadesi Geçti / 50.000" → **"Taksitte"**; "+ Tahsilat Ekle" düğmesi görünmüyor.
- **Faturalar listesi**
  - Kalan: 50.000 → 20.000 (Örnek 2'de "—").
  - Açık Bakiye ve Vadesi Geçmiş kutucukları aynı kuralla düşer.
  - Kartın tamamını aldığı fatura: "Açık" süzgecinde VAR (taksitli fatura gibi), "Ödenmedi"de yok.
  - PDF ve Excel aynı değerleri verir.
- **Tahsilat Ekle ve Mahsup Et**
  - Önerilen tutar 50.000 / 30.000 → **20.000**.
  - Metne eklendi: "Taksit kartındaki X kartın taksitlerinden tahsil edilir."
  - Mahsup SINIRI (faturanın kendi açığı) ve kapama değişmedi.
- **Aynı kalem, aynı kural:** cari kartının fatura sekmesi, cari tahsilat formundaki "Kapatılacak Fatura" seçenekleri, Satış / Alış / İade Faturaları raporları ve paylaşım metnindeki vade satırı.
- Bakiye, gecikmiş, kart kalanı, kapama ve birleşik listeler (yaşlandırma, nakit akışı, Vade Takip, zil) değişmedi.

### Değişen dosyalar
- `server/routes/invoices.mjs`:
  - `shownState` tek yerde: gösterilen açık = open − covered; tamamı kartta ise "installment" (Taksitte); yeni alanlar `ownOpen` ve `inPlan`.
  - Bunu okuyanlar: `shape`, `leanRow` (LIST_SQL'e `plan_id` eklendi), `openItems`'ın net istemeyen yolu, fatura kartında kart adları için `inPlansOf` (tek sorgu), Mahsup adaylarında `offsetCandidates.suggest` ve `shownOpen`.
  - `openItems` yorumu güncellendi.
- `client/assets/hof-invoices.js`: yukarıdaki gösterim değişiklikleri.
- Kılavuz: HTML'e tek cümle eklendi; `client/kilavuz/…pdf` yeniden üretildi, pdf-denetle 39/39.
- Yeni testler ve araçlar:
  - `test/s229-acik-fatura-kart-payi-250.test.mjs`
  - `test/s229-eski-surum-250.test.mjs`
  - `test/s229-para-degismezi.mjs`
  - `test/s229-en-kucuk.mjs`
  - `test/e2e/yuruyus-s229-250.mjs`
- Beklentisi değişen 10 komşu test: bulgu-223, iade-210, iade-geri-odeme-246, iade-kapama-k1, kapama-rastgele-223, raporlar-210-banka, raporlar-224, tyk-kapanis-dis-250, tyk-son-250, ux18-cek-fatura-244.
- Göç, şema, dizin yok. Dosya sınırının dışına çıkılmadı.

### Tarama
Tablo `docs/kanit/2026-11-20/s229-rapor-taslak.md` §1'de.
- **Kapsam dışı, değişmedi:** birleşik listeler (`net: true`), kapama ve yazma yolları (`coverState`, `ownTarget`, `addOffset` sınırı, `editInvoice`), kart kalanı, defter, e-Belge.

### Testler: kırmızı nedeni ve yeşil
- **`s229-acik-fatura-kart-payi-250`** (13 test):
  - Yeni kod: 13/13, UTC ve İstanbul.
  - Taban: 11 kırmızı, iki TZ. İletiler: "Açık Faturalar F1: kalan 50000 (20.000 beklendi)", "kartın tamamını aldığı fatura listede: 50000", K5'te "Açık 40000", K8 / K10 / K12'de "50000 !== 20000".
  - K9 (iptal) ve K11 (iade belgesi) değişmezlik testleri; tabanda yeşil olmaları bekleniyordu.
- **`s229-eski-surum-250`:**
  - Yeni kod: 3/3, iki TZ.
  - Taban (surucu5-uc git worktree): 2 kırmızı, ileti "Açık Faturalar {P:50000,T:50000,I:50000}".
- **Komşu testler (G2, 77 dosya, iki TZ):**
  - İlk koşu: 1.003/1.021; 18 kırmızı, iki TZ'de aynı. Hepsi eski gösterimi bekliyordu ("fatura açığı = kart kalanı"; "ödenen + açık = tutar").
  - Güncellendi: kapama testleri artık `ownOpen` okuyor, gösterilen açık ayrıca denetleniyor. Rapor testlerinin bağımsız beklenenine kartın kalanı düşüldü. Değişmez artık "ödenen + açık + kartta = tutar".
  - Sonuç: güncel hâl 263/263 (iki TZ). Aynı 10 dosyanın özgün hâli tabanda 262/262.

### Kabul A–G ve G2
- **A — Defter kâhini:** yeni 187/187 ve taban 187/187, iki TZ. Değişen denetim yok; R-S200 farkı bu kümede değil, sürücüde.
- **B — Cari kâhini:**
  - Taban: 17.648/17.648, iki TZ.
  - Yeni: 17.602/17.648, iki TZ. 46 fark, hepsi Mevcut Borç kartlı senaryolarda (c11, d34, d36, d37, d38).
  - Farkların türü: `k*:fatura:<F>:acik` (program gösterilen açığı veriyor, kâhin faturanın kendi açığını bekliyor) ve bundan türeyen `acikToplam` + `acikEsitBakiye` (KS8.1).
  - Yapım aşaması listesi: 0 → 46 kayıt, hepsi "AYRIŞTIRILMADI".
- **C — Muhasebe sürücüsü** (değiştirilmedi), iki TZ:
  - s118 af1 / af3 **AYNI'ya döndü**.

    | | Yeni | Taban |
    |---|---|---|
    | AYNI | 7.252 | 7.248 |
    | U | 508 | 508 |
    | P | 18 | 18 |
    | K | 0 | 0 |
    | R | **4** (yalnız R-B5, UTC) | 10 |
    | SINIFLANMADI | 0 | 0 |
    | # fail | **22** | 28 |

  - Yeni fark yok. Program artık kâhinin listelemediği satırı vermediği için 2 denetim eksildi.
- **D — v2.4.9** (gerçek kod, `git worktree --detach`):
  - İki en küçük örnek 50.000 / 50.000 gösteriyor; bugünkü gösterim o sürümde de varmış, gerileme değil. Taban da aynı.
  - Yenide: 20.000 + "Örnek 1 Kartı · 30000"; Örnek 2'de satır yok, "Taksitte".
  - v2.4.9 verisi güncel kodla açılınca (yeni kapama ve eski kapama düzeni) P 20.000, T yok, I 20.000 + iki satır, Anlık Durum 150.000 → 40.000. Bakiye aynı.
- **E — Hız:** temiz 100 bin, özel kilit, eski ↔ yeni dönüşümlü 3 tur × 3, başta yük 1,07–1,59. **Kötüleşen yol 0.**

  | Yol | Taban en iyi / ortanca (ms) | Yeni en iyi / ortanca (ms) |
  |---|---|---|
  | Açık Faturalar | 703 / 1.548 | 692 / 1.626 |
  | Soğuk ilk Açık Faturalar (eşiğe en yakın) | 1.619 / 1.651 | 1.757 / 1.804 (+%8,5 / +%9,2) |
  | Anlık Durum | 139 / 145 | 137 / 145 |
  | Faturalar listesi | 597 / 611 | 585 / 641 |
  | Faturalar listesi "Açık" | 491 / 518 | 501 / 537 |
  | Fatura ayrıntısı | 74 / 86 | 73 / 88 |
  | Mahsup adayları | 29 / 35 | 32 / 34 |
  | Faturalar Excel | 7.814 / 8.219 | 8.139 / 8.294 |
  | Faturalar PDF | 3.796 / 3.989 | 3.775 / 4.182 |
  | Açık Faturalar PDF | 1.191 / 1.267 | 1.221 / 1.313 |

  - Olay döngüsü ölçeri soğuk istekte örneklerin çoğunda 0 yazdı (iki kodda aynı ölçer). Tablo: `s229-kanit/hiz-tablo.md`.
- **F — Para değişmezi:** 13 istekli dizi, eski ↔ yeni, iki TZ: **fark 0 (BİREBİR)**. Karşılaştırılanlar:
  - Cari satırları, kartlar, taksitler, kart tahsilatları, mahsup, şüpheli, fin_events, mizan, Mutabakat.
  - Raporlar: Alacak Yaşlandırma, Geciken Taksitler, Taksit Kartları, nakit akışı, Vade Takip, zil, Anlık Durum (fatura özeti hariç).
  - Mahsup sınırı iki kodda aynı: 45.000 kabul (gösterilen 40.000'in üstünde), 10.000 red ("5.000,00 TL'yi aşamaz").
- **G — Ekran yürüyüşü:**
  - Yeni kodda beklenen dışı 0, sayfa hatası yok; eski kodda 16 beklenen dışı.
  - Ekrandan insan hızıyla girilen 20.000 tahsilat: veri tabanında F1'e bağlı tek 20.000 satırı; F1 "Taksitte".
  - Ekran görüntülerine baktım: `docs/kanit/2026-11-20/s229-ekran/{yeni,eski}`.
  - Ders 28: Mevcut Borç kartı + fatura gösteren 6 ekran senaryosu 439/439 geçti.
  - Kılavuz ve yazım düzeni testleri 23/23.
- **G2 — Mutantlar:** 7/7 yakalandı.
  - Kart payını düşmeyi unut.
  - `net: true`'ya geç (K6, K11 kırmızı).
  - Tam alınan faturayı Taksitte gösterme.
  - Tam alınan faturayı Açık Faturalar'da bırak.
  - İki karttan yalnız birini düş (K3).
  - Mahsup önerisinde eski açığı bırak.
  - Anlık Durum'u eski hesapta bırak.
  - İstemcinin Tahsilat önerisi ekran yürüyüşünde yakalanıyor.

### KULLANICIYA SORULMALI
Yok.

### BAŞ MİMAR KARARI GEREKİYOR
1. **Cari kâhinindeki 46 fark.**
   - Durum: cari kâhini fatura kartının `open` alanını faturanın KENDİ açığı diye okuyor (C13.4, KS8.1). S230 = A ile `open` artık gösterilen açık; kendi açığı `ownOpen` alanında.
   - (a) — **önerim:** ana oturumun kâhin sürücü bakımında C13.4 ve KS8.1 için `ownOpen ?? open` okunur. Kapama kuralı değişmediği için kâhinin beklentisi de değişmez; S229 / S230 gösterim kuralı sonraki kâhin bakımında ayrı bir denetim olur.
   - (b): API'de `open` kendi açığı olarak kalır, gösterim yeni bir alana taşınır. Bu durumda her gösterim yolu tek tek o alana geçmeli; bir yol kaçarsa sessizce eski sayıyı gösterir.
   - Bu karar verilmeden ve uygulanmadan dalı birleştirirsek CI kırmızı olur.
2. Kartın tamamını aldığı karşı fatura artık Mahsup seçeneklerinde ve "Kapatılacak Fatura" seçeneklerinde görünmüyor (taksitli faturalar gibi). Sunucunun kabulü ve sınırı değişmedi. Bu bir yorum; işaretliyorum.
3. Kartın tamamını aldığı fatura her zaman "Taksitte" görünür, kartın taksiti gecikse bile "Vadesi Geçti" olmaz. Kart birden çok kalem taşıyabildiği için gecikme faturaya atanamıyor; karar metni de "Taksitte" diyor.

### SONRAKİ SÜRÜME (2.5.1)
- Faturalar Excel'inde ve Satış / Alış / İade Faturaları raporlarında "Taksit Kartında" sütunu yok. Ödenecek = Ödenen + Kalan + taksit kartında; sayılar doğru.
- Sürücüdeki R-S200 sınıflama kuralı artık ateşlemiyor.
- Hız ölçerinin olay döngüsü örneklemesi soğuk istekte 0 yazıyor.
- Cari süzgeçli Açık Faturalar'daki "Net" satırı cari bakiyesine eşit değil. Değişiklikten önce de böyleydi.

### DOĞRULANMADI
- Birleşik şirket raporunun "Açık Satış Faturası" sütunu (aynı `compute()`'u okur) iki şirketle açılmadı.
- Mobil `/overview` ayrıca açılmadı.

### DENENMEYEN
- Kilitli dönem, ileri tarihli kart / fatura, iki şirket, Değersiz yazılmış kısım (S227).
- Tam `npm test` ve ci.yml'nin bütün e2e listesi.
- Mutantlar yalnız UTC'de koşuldu.

### CI listesine eklenecek
- `test/e2e/yuruyus-s229-250.mjs` (ci.yml'ye eklenmedi).
- İki yeni `.test.mjs` dosyasının (`s229-acik-fatura-kart-payi-250`, `s229-eski-surum-250`) CI kümesine girdiğini denetleyin.

### Commit listesi
ad4f7d2e, 6e28069e, 6af09410, c25b4c10, 336c5f18, fe564bff, 3867a657, 0a63d44b, a100ca42, 06775841, 81e587b8 (+ taban fce3d272).

### Ana oturumun yeniden koşacağı komutlar
Betiklerin hepsi `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/s229-a343/` klasöründe. Eski kod kopyası `eski` (git archive surucu5-uc, `docs/kanit` silindi); kopyası `docs/kanit/2026-11-20/s229-kanit/`'te.
- **Yeni test / kırmızı kanıt:** `bash kos.sh <ad> <kök> <TZ> test/s229-acik-fatura-kart-payi-250.test.mjs` — `<kök>` dal ucu ya da `eski`.
- **v2.4.9 testi:** `test/s229-eski-surum-250.test.mjs`. Tabanda kırmızısını görmek için git worktree kopyası gerekir; arşiv kopyasında etiket olmadığından atlanır.
- **Para değişmezi:** `bash pd.sh` (beklenen "FARK SAYISI: 0", iki TZ).
- **Mutantlar:** `python3 -I mutant.py <kopya> <çıktı>`.
- **Kâhinler ve yapım aşaması listesi:** `bash kahin.sh`.
- **Muhasebe sürücüsü:** `bash surucu.sh`.
- **Ekran senaryoları:** `bash e2e.sh`.
- **Hız:** `bash hiz.sh`, sonra `python3 -I tablo.py hiz.txt`.
- **Ekran yürüyüşü:** `ROOT=<kök> OUT=<klasör> PLAYWRIGHT_BROWSERS_PATH=…/pw-1194 node test/e2e/yuruyus-s229-250.mjs`.

Rapor taslağı: `docs/kanit/2026-11-20/s229-rapor-taslak.md`. Kanıtlar: `docs/kanit/2026-11-20/s229-kanit/` ve `docs/kanit/2026-11-20/s229-ekran/`.
- **Temizlik:** /dev/shm'deki kopyalar ve geçici worktree'ler kaldırıldı.
- **Ortam:** disk 7,0 GB boş.
