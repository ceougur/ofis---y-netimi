# Ç7b DK + S229 ALTIN birleşik küçük tur — RAPOR

**Dal ucu:** worktree-agent-ab2301e43d5e0964a = **de403915**. Taban dkfix-taban = 94a7b475. Hiçbir şey gönderilmedi.

Commit'ler (eskiden yeniye):
- 3eaa73b8 — tasarım §18 (koddan önce)
- 03f30733 — S234 = A
- 91b08696 — S229 ALTIN, ownPayState, mutabakat motoru
- 7b091d40 — S235 = B, ekran senaryosu ve ekran görüntüleri
- afcc9551, 69343f29, 4dd4c14c, 7e03669e, 135d37f9, de403915 — kanıt
- 80e495f4 — tasarım §18.7

Yazar Claude; model adı hiçbir yere yazılmadı.

**Değişen dosyalar** (docs/kanit hariç; toplam +697 / −23):

| Dosya | + / − |
|---|---|
| `server/routes/plans.mjs` | +17 / −9 |
| `server/routes/invoices.mjs` | +2 / −1 (yalnız `ownPayState`) |
| `client/assets/hof-invoices.js` | +5 / −1 (yalnız Düzenle onay metni) |
| `test/dkfix-s234-kapali-kart-250.test.mjs` | yeni, 262 satır |
| `test/e2e/senaryo-dkfix-250.mjs` | yeni, 288 satır |
| `test/banka-210-altin.test.mjs` | +34 |
| `test/guvenilirlik/kapama-k1-fark.mjs` | +12 |
| `test/mutabakat/motor.mjs` | +18 |
| `docs/erp/C7B-FATURA-TASARIM.md` | §18 + §18.7 |

Kâhin ve sürücü dosyalarına (`test/bagimsiz/**`) dokunulmadı.

## İşler — bugün (taban) → yeni (sayılar)

**S234 = A** (`plans.mjs`):
- Yeni yüklem `shrinkable`: açık kart, ya da kalanı düşülmemiş kapalı kart. `order "tail"` (açılış onarımı) kapalı kartı yine atlar.
- `shrinkPlan`, `trimCovers` ve `growForInvoice` bu yüklemi okur. Küçülmenin tersi `growForInvoice`'tır; o da kapalı karta uygulanmazsa iade iptalinden sonra kart borçtan küçük kalır.
- İptal yolu `settleCoverOnCancel` artık `trimCovers(..., { closed: false })` çağırır; S226 = C aynen kalır.
- Kapalı Mevcut Borç kartı + iade 300 (taban → yeni):
  - Kart penceresi, cari kartı özeti ve Taksitler listesi: **Kalan 600 → 300**.
  - Tutar 900 → 600. Kesilen taksit 10.11 (en önce gelen açık); 10.12 kalır.
  - Yeniden Aç → Kartı Kapat onayı **600 → 300**, tek istekte 200.
  - Bakiye 300, gecikmiş 08.10 0 / 09.10 300, Mizan 120 300, Mutabakat Testi temiz — tabanla aynı.
- Kendi kart (taksitli fatura) Borçta Kalsın kapalı + iade:
  - Tutar 900 → 600; Tahsil Edilen 600 → 300; Kalan 300 aynı.
  - İade iptalinde kart 900'e geri büyür, Kalan 600.
- Eski kurallı ('2.4.9') kapalı kart ve iptal yolu: değişmez (T5 / T6).
- Önce / sonra yoklaması (dokuz senaryo; dkfix-hiz/pk-taban.txt ve pk-yeni.txt): bakiye ve 120 hepsinde aynı. Gecikmiş farkı yalnız iki senaryoda var (aşağıda KULLANICIYA SORULMALI 1 ve BULGU 1).

**S235 = B** (istemci):
- Fatura kartı GET'i zaten `plan.status` taşıyor; `form.modifyPlanClosed` eklendi.
- "Değişiklikler Kaydedilsin mi?" onayına yalnız kapalı kendi kart varken bir cümle eklenir:
  - Taksitlendir seçiliyse: "Bu faturanın kapatılmış taksit kartı yeniden açılır; kalan borç yeni ödeme planına girer."
  - Açık Hesap seçiliyse: "Bu faturanın kapatılmış taksit kartı kaldırılır; kalan borç faturanın vadesiyle açık hesapta izlenir."
- Davranış değişmedi.

**S229 ALTIN:**
- (a) `shape` artık `ownPayState` döndürür (yalnız `inPlan` varken). K1 yardımcısı faturanın kendi açığını ve durumunu okur; yeni denetim: ödenen + gösterilen açık + inPlan = ödenecek.
- (b) Altın teste ANLIK DURUM için S230 katlaması eklendi (BEKLENTİ BİLEREK DEĞİŞTİ + karar numarası). Katlanan tutar sayıyla: açık **1.840,97 TL**, vadesi geçen **1.840,97 TL** (1 yanıt).
- (c) Tarama: `open` / `payState` / K1 okuyan testler — altın, göç zinciri, iade-kapama-k1, kapama-rastgele-223, s229, tyk ve öbürleri. Hepsi G2 listesinde koşuldu.

## Kabul

**A. Yeni testler:**
- dkfix-s234: 9/9, iki TZ'de (G2 içinde).
- Tabanda 6 kırmızı, beklenen nedenle: "kart tutarı 900 !== 600 / 300". T5 / T6 / T9 iki kodda da yeşil; değişmeyen davranışın bekçisi.
- Altın test: tabanda (eski test) 3 fark. ANLIK DURUM openSale ve overdueSale −1.840,97; K1'de "ödenen 106368 + açık 0 ≠ 290465" ve "iadesi olmayan caride durum değişti". Yenide 6/6.
- senaryo-dkfix-250: yenide 21/21. Tabanda 4 kırmızı: pencere ₺600,00, onay ₺600,00, iki onay cümlesi yok.

**B. G2 komşu** (54 dosya; liste not defterinde g2-liste.txt):
- İstanbul: 268/268 + 432/432. UTC: 268/268 + 432/432. Atlanan 0.
- banka-210-altin listede, iki TZ yeşil.
- Ekran: senaryo-c7b-tur3-250 39/39, senaryo-c7b-kabul-250 39/39. v2.4.9 etiketi bu worktree'de var.
- Motor testleri (mutabakat-cekirdek, fatura-model, mutabakat-yil-donumu): 8/8.

**C. Kâhinler** (iki TZ):
- Cari: 21673/21673, 0 fark. 7 bilinen sınır var, 12 senaryo 2.4.5 kararıyla atlanıyor.
- Yapım aşaması listesi **0 kayıt (BOŞ)**.
- Defter: 187/187, 0 fark.

**D. Mutasyon** (mut.sh, ayrı kopyada; sonra geri alındı):

| Mutant | Sonuç |
|---|---|
| M1 kapalı kartı yine atla | 6 kırmızı |
| M2 ters: yalnız eski kurallı kart küçülsün | 7 kırmızı |
| M3 iptal yolunda kapalı kartı da kırp | T6 kırmızı |
| M4 büyüme kapalı karta uygulanmasın | T4 / T7 kırmızı |

**E. Hız** (özel kilit, temiz 100 bin, 3 tur dönüşümlü; başta yük 1,0–1,27, geçersiz tur yok):

| Yol | af655afd | taban | son (ortanca) | son / taban | olay döngüsü en çok (son) |
|---|---|---|---|---|---|
| kart penceresi GET | 37,6 | 38,9 | 36,9 | −5,1% | 0 |
| fatura kartı GET | 47,5 | 75,8 | 71,4 | −5,8% | 0 |
| Kartı Kapat | 1084,9 | 1053,6 | 1057,0 | +0,3% | 1138,8 |
| iade yazımı (kapalı kart) | 279,9 | 152,3 | 144,9 | −4,9% | 210,2 |
| iade yazımı (açık kart) | 280,8 | 148,2 | 147,9 | −0,2% | 0 |
| iade iptali (kapalı kart) | 57,8 | 63,5 | 57,0 | −10,2% | 0 |
| iade iptali (açık kart) | 56,7 | 57,0 | 61,7 | +8,2% | 0 |
| fatura iptali | 55,7 | 109,8 | 110,6 | +0,7% | 149,0 |
| Taksitler listesi | 1188,9 | 1142,5 | 1146,5 | +0,4% | 2334,1 |
| Faturalar listesi | 647,1 | 620,0 | 648,2 | +4,5% | 699,4 |

- Bütün yollarda ortanca ve en iyi değer tabanın %10'u içinde. İade iptalinde (açık kart) en iyi değerler 55,9 ↔ 55,3.
- Taksitler listesinin olay döngüsü en çok değeri 15 örnekte bir kez 2,3 sn; ortanca aynı.
- **Fatura kartı GET** (Ç7b dar kontrolünün DOĞRULANMADI'sı) Ç7b öncesine göre +~26 ms. Tanı: aynı kopyada, 3 tur × 30 okuma.
  - Kod olduğu gibi: 71,5 / 75,3 / 75,7.
  - İptal notundaki kapsam metni (`coverCancelText`) kapatılınca: 49,5 / 45,2 / 48,9.
  - Fatura kartının kapsam satırı (`inPlans`, S230) kapatılınca: 75,7 / 82,2 / 81,0 — etkisiz.
  - Kök neden: her kapsamlı fatura kartı okumasında `coverState` → `settledFor` (carinin bütün defteri + kapama).
  - Bu tur yeni bir kötüleşme getirmedi. Düzeltme `invoices.mjs`'te gerekiyor; dosya sınırı dışında olduğu için kodlanmadı (aşağıda).

**F. Ekran:** görüntüler `docs/kanit/2026-11-21/dkfix-ekran/` (8 dosya). Baktım: kart penceresi Kalan ₺300,00; Kartı Kapat sorusu ₺300,00; Düzenle onayında iki cümle; açık kartta cümle yok.

## KULLANICIYA SORULMALI
1. **(S234 alt durumu; gecikmiş tutarı — ders 43; UÇ DURUM)** Kapalı kartın kapanıştan önce vadesi geçmiş açık taksiti varken iade.
   - Örnek: kart 900 (05.10 / 05.11 / 05.12), 08.10 Kartı Kapat, 08.10 iade 300.
   - Bakiye her seçenekte 600; 09.10'dan itibaren gecikmiş her seçenekte 600.
   - Kapanış günü gecikmişi: tabanda 300, çünkü kuyruk iade alacağını kartın son kalemine kapatıyordu ve 05.10 gecikmiş kalıyordu. Yenide 0, çünkü karar (4) en önce gelen açık taksiti keser.
   - Seçenekler:
     - A (öneri): kararın harfi — kapanış günü 0. Açık kartta da böyle; kodlanan bu.
     - B: kapalı kartta kesim, kuyruğun kapattığı kalemle aynı yerden yapılsın.
     - C: Uç durum böyle kalsın (BİLİNEN SINIR).
   - Yaygın programlarda nasıl yapıldığı: doğrulanmış kaynak okunmadı.

## BAŞ MİMAR KARARI GEREKEN
1. **S234-c (Düzenle ile azaltma) KODLANMADI — dosya sınırı.**
   - Fatura Düzenle, kapsayan Mevcut Borç kartına hiç dokunmuyor. Tabanda AÇIK kartta da Düzenle 900 → 300 sonrası Kalan 900 / bakiye 300 (önceden var).
   - Düzeltme ancak `invoices.mjs editInvoice`'a çağrı eklenerek yapılabilir.
   - Öneri: iadedeki gibi `coverState` önce / sonra farkı kadar küçült + `trimCovers`; açık ve kapalı kartta aynı olsun; ayrı küçük tur.
2. **BULGU-1 (ORTA aday; kuyruk ↔ kapama defteri).**
   - Durum: aynı caride iki Mevcut Borç kartı var; eski kart ilk faturayı (900), yeni kart sonraki faturayı (300) içine almış. İlk faturaya iade 300 yapılınca eski kart küçülüyor.
   - Kapama defteri (`cardLedgerState`) ikinci faturayı yeni kartça kapsanmış sayıyor (covered 300). Tek Yükümlülük Kuyruğu ise ikinci faturayı kapsamsız "Gecikti", yeni kartın taksitlerini "Ödendi" gösteriyor.
   - Bu tabanda AÇIK iki kartta da var: gecikmiş 300; doğrusu 0.
   - S234 = A bunu kapalı karta da taşıyor: gecikmiş 08.10 0 → 300, 09.10 600 → 900; doğrusu 0 / 600.
   - Kök neden kuyrukta (`lib/obligation-*` / `invoice-settle`; dosya sınırı dışı).
   - Karar gereken: birleşmeden önce kuyruk düzeltmesi mi yapılsın, yoksa iki kartlı durum bulgu turuna mı bırakılsın?
   - Yeniden üretim: not defteri `dkfix-ab23/probe/pk3.mjs` / `pk4.mjs`, T8acik ve T8sonra senaryoları.
3. **BULGU-2 (önceden var, en az v2.4.9'dan; kullanıcıyı etkiler).**
   - Kaydedilmiş taksitli faturanın Düzenle formu, kalan ödemeyi "Açık Hesap (Vadeli)" seçili açıyor. İstemcideki `payFrom` `payment.rest === "installments"` arıyor; kaydedilmiş belgede `rest` tutar, `mode` "installments".
   - Değiştirmeden Kaydet'e basılınca taksit kartı kalkıyor (ekran senaryosu E gözlemi; kart silindi, bakiye 900).
   - S235 cümlesi bu yüzden varsayılan olarak "kaldırılır" diyor (doğru söylüyor).
   - Düzeltme `payFrom`'da; görev metni yalnız onay metnine izin veriyordu.
4. **Fatura kartı GET +26 ms** (Ç7b'den; yukarıdaki tanı). `coverCancelText`'in kapsam okuması ancak `invoices.mjs`'te düzeltilebilir. Kabul mü, ayrı tur mu?
5. **Kapsam yorumları** (ana oturum onaylamalı):
   - S234 kapalı KENDİ karta da uygulandı. DK'nin "en küçük düzeltme"si `shrinkPlan`; karar (4) ise genel. Sonucu: Tahsil Edilen 600 → 300.
   - Faturasız stok iadesi (`stock.mjs` → `trimCovers`) de kapalı kartı küçültüyor; "iade borçtan düşülünce" sayıldı.
   - `growForInvoice` küçülmenin tersi olarak kapsama alındı.
   - Uç durum: kart iadeyle küçüldükten sonra başka faturanın iptaliyle kapanmış (S206 / S210) ve sonra iade iptal edilmişse, kart artık büyüyor (önceden büyümüyordu). S226 ailesinden; denenmedi.

## SONRAKİ SÜRÜME (2.5.1)
- Aşırı iadeden sonra (iade > kalan) kartın Kalan'ı 300 görünüyor ama satırlar 0. Açık kartta da aynı; önceden var. Ç7b DK'nin "Alacak Yaz sonrası Kalan ≠ satırlar" ailesinden.
- Taksitler listesi GET'inde olay döngüsü en çok değeri bir kez 2,3 sn (tek örnek).

## DENENMEYEN
- Faturasız stok iadesi + kapalı kart (yalnız mutabakat motorunun rastgele işlemleriyle; ayrı test yok).
- Kilitli dönemde kart küçülmesi.
- v2.4.9 gerçek-kod verisiyle S234 (yalnız '2.4.9' işaretinin elle verildiği T5).
- İki şirket.
- Yedek → geri yükleme.
- Düzenle sunucu yolunun hızı (sunucu kodu değişmedi).
- Tam `npm test` (görev gereği ana oturumda).
- e2e senaryoları tek TZ'de koşuldu.

## Not defteri
/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dkfix-ab23
- İçerik: probe/ (p2–p7, pk*.mjs, pj.mjs), hiz/, g2-liste.txt, g2-kos.sh, kahin.sh, e2e-kos.sh, mut.sh, günlükler.
- Kod kopyaları (eski / mut / oncesi) silindi.
- Kanıt depoda: `docs/kanit/2026-11-21/dkfix-kos/`, `dkfix-hiz/`, `dkfix-ekran/`, `dkfix-rapor-taslak.md`.

Ortam: yük 1,0 / 4 çekirdek, bellek boş 13 GB, disk boş 10 GB.
