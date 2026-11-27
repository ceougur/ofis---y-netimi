# İzleyen tur 2 — rapor (dal ucu dd6b4732)

Tam rapor şu dosyada: `docs/kanit/2026-11-21/izt2-rapor-taslak.md`.

## Özet
- **Kodlanan işler:** İş 1 (S241), İş 2 (kapsam seçimi tek yardımcıda), İş 4 (iade Düzenle'si), İş 5 (stok iadesi).
- **İş 3 (Düzenle'de azaltmanın hızı) kodlanmadı.** Kök neden ölçüldü ama düzeltilecek dosya (`lib/integrity-scope.mjs`) dosya sınırımın dışında. Öneriyi prototipte denedim: 8.004 ms → 228 ms.
- **Yeni sınama (17 test):** yeni kodda iki saat diliminde yeşil. Eski kodda (288b91dc) 5/17; 12 test beklenen nedenle kırmızı.
- **Mutasyon:** 4 mutantın 4'ü yakalandı.
- **G2 komşu taraması (183 dosya):** son kod değişikliğinden sonra iki saat diliminde 2145/2145.
- **Kâhin ↔ program:** cari 22.832 denetim ve defter 187 denetim, iki saat diliminde 0 fark. Yapım aşaması listesi 38 → 38, birebir aynı.
- **Hız:** ikinci ölçümde kötüleşen yol yok. İlk ölçüm kötüleşme gösterdi, kök nedeni bulunup düzeltildi.
- **Ekran:** yeni senaryo, yeni kodda 24/24, eski kodda 17/24 geçti. Komşu senaryolar 21/21 yeşil.
- Push yok, zamanlanmış görev yok, arka planda işim yok.

## Taban, dal, commit'ler
- Taban: 288b91dc. Dal: worktree-agent-a00386bc926cebc74.
- 17 commit var, hepsinde `Co-Authored-By: Claude <noreply@anthropic.com>`, model adı yok.
- Sıra: tasarım §20 ve sınama koddan önce (f9342aaa, 73a83274), sonra kod (a395ffcd, a89ed2a0, c25c53fd), ekran senaryosu, komşu beklentileri ve kanıt commit'leri.

## Değişen yollar (+1068 / −64)

| Dosya | Değişiklik |
|---|---|
| `server/lib/cover-scope.mjs` | YENİ, saf: `chooseCover`, `ownSaleOf`, `s2`, `editCutsOf`, `withEditCuts` |
| `server/lib/invoice-settle.mjs` | +60; kapama defterinin eski "en yeni borçtan" seçimi kalktı |
| `server/lib/obligation-queue.mjs` | +65 |
| `server/lib/obligation-input.mjs` | +11 |
| `server/routes/invoices.mjs` | +86 |
| `server/routes/stock.mjs` | +41, yalnız iade yolu |
| `test/izt2-izleyen-tur-250.test.mjs` | yeni |
| `test/e2e/senaryo-izt2-250.mjs` | yeni |
| `package.json` | `test:senaryo-izt2-250` betiği |
| `test/iade-224.test.mjs` | G2 beklentisi, karar numaralı (D 18:28 (2)) |
| `test/t3hiz-esdegerlik-250.test.mjs` | yeni sütun, karar numaralı (S241) |

- Tasarım notu: §20.1–§20.7.
- `lib/account-lines.mjs` önce değişti, hız yüzünden geri alındı.
- Göç yok. `ci.yml`, `release.yml`, `test/bagimsiz/**` ve YAPIM-ASAMASI.json'a dokunulmadı.

## İşler

**İş 1 — S241 = A**
- Düzenle bir kartı kestiğinde azalış faturanın `payment_json.editCuts` alanına kaydediliyor. Kuyruk ve kapama defteri bu kaydı faturaya o anda gelmiş bir iade gibi okuyor (`withEditCuts`).
- Sayılar (taban → yeni): kart penceresi Tahsil Edilen / Kalan 300 / 300 → 600 / 0. Cari kartı özeti ve Taksitler listesi de 600 / 0. Bakiye −300, değişmedi.
- S242 = A: Düzenle ile artırma kartı büyütmüyor (bekçi testlerle gösterildi).

**İş 2 — kapsam seçimi**
- Örnek: A 600 + B 600 faturası, elle kart 600.
- Kapama defteri artık kuyrukla aynı faturayı (A) seçiyor.

| İşlem | Tabanda | Yenide |
|---|---|---|
| B'nin İptal Et'i | kartı kapatıyordu | kartı değiştirmiyor |
| A'nın İptal Et'i | kartı değiştirmiyordu | kartı kapatıyor |
| B'ye iade | kartı küçültüyordu | kartı değiştirmiyor |

**İş 4 — iade Düzenle'si**
- İade iptali ile aynı yardımcıyı (`undoReturnCuts`) kullanıyor; kendi kart da kayıtlı taksitlere geri büyüyor.
- Örnek: kart 10.10 600 → 10.10 300 + 10.12 300. 20.11 gecikmişi 300 → 0.

**İş 5 — faturasız stok iadesi**
- Tabanda hareket silinince ya da düzeltilince kart geri büyümüyordu (gecikmiş 600).
- Düzeltildi:
  - Kesim kaydı denetim izine yazılıyor (`stock.return.cuts`).
  - Silme ve düzeltmede kart aynı taksitlere geri büyüyor; düzeltme sonra yeniden kesiyor.
  - Silinenler'den geri yükleme kartı yeniden küçültüyor.

**Yedek ve kilit:** S241 kaydı ve iade kesim kaydı yedekle taşınıyor. Geri yüklemeden sonra kart 600 / 600 / 0 ve iade iptali aynı taksitlere dönüyor. Kilitli dönemdeki faturanın Düzenle'si 409, bugünkü gibi.

## Hız (özel kilit, 3 tur, taze 100 bin veri; tablo `izt2-hiz/tablo-2.md`)
- Ortanca farkları: kart penceresi +0,9%, fatura kartı +0,5%, iade yazımı −0,4% / +3%, fatura İptal Et +5,8%, Kartı Kapat +8%, Taksitler listesi −5,4%.
- "Kötü" ölçütü (ortanca ve en iyi ikisi de +%10 üstü) hiçbir yolda tutmadı.
- İlk ölçüm kötüleşme göstermişti: kart penceresi +%44, iade yazımı +%45 / +%59. Neden, bütün satış faturalarını tarayan 17 ms'lik sorguydu. Kesinti artık girdinin kendi faturalarından ekleniyor (c25c53fd).
- Bazı satırlarda olay döngüsü 0,0 okundu (ölçüm aracının nüansı).

## Ekran (`izt2-ekran/`, görüntülere tek tek baktım)
- S241 sonrası kart: ₺600 / ₺600 / ₺0, durum "Tamamlandı".
- Faturalar listesi: A "Taksitte", B "Vadesi Geçti".
- B iptal edildikten sonra elle kart Kalan ₺600, kart değişmemiş.
- İade Düzenle'sinden sonra: 10.10 "Ödendi", 10.12 ₺300.

## KULLANICIYA SORULMALI
**SK-43:** iadeyle küçülen taksit sonradan elle değiştirilir ya da silinir, sonra iade iptal edilir.
- Bugünkü davranış: geri gelen tutar kayıtlı taksite yazılıyor.
  - Tutarı elle değiştirilmişse üstüne ekleniyor: taksit 250 olur, kart toplamı 900 ama taksitler 850.
  - Taksit silinmişse eski vadesiyle yeniden açılıyor.
- Seçenekler:
  - A: bugünkü gibi kalsın.
  - B: geri gelen tutar son taksite gitsin.
  - C (öneri): uç durum böyle kalsın (BİLİNEN SINIR).
- Yaygın programlarda nasıl yapıldığına dair doğrulanmış kaynak okumadım.

## BAŞ MİMAR KARARI GEREKEN
1. **İş 3:**
   - Kök neden: kapının tam denetimi (~7,1 sn). Gerekçesi `stock_moves: kimlik değişti` — aynı rowid yeniden kullanılınca süzgeç tam denetime düşüyor.
   - Öneri: süzgeçte aynı rowid + farklı kimlik, silinen + eklenen iki ayrı satır sayılsın.
   - Prototip ölçümü: 8.004 ms → 228 ms, kapı sınamaları 94/94 (gateVerify dahil).
   - Prototip kod değil, yalnız kanıtta: `izt2-kos/oneri-integrity-scope.py`.
2. Yeni dosya `lib/cover-scope.mjs`: görevdeki "kart kapsamı yardımcıları" iznine dayanarak açtım.
3. Stok iadesinin kesim kaydı denetim izinde tutuluyor (göç gerekmedi).
4. Düzenle kaydı cari değiştirilince ya da fatura taksitliye çevrilince düşüyor. Öneri: BİLİNEN SINIR.

## SONRAKİ SÜRÜME (2.5.1)
- Silinen taksitten sonra kalan taksitin sıra numarası ekranda "3." görünüyor (sayılar doğru).
- Stok hareketi düzeltilince ya da silinince kart ekranı canlı yenilenmiyor (yeniden açınca doğru).
- Olay döngüsü 0,0 okunan ölçüm satırları.
- Açılış onarımının toplu girdisi elle borcun Vade Tarihi'ni okumuyor (doğrulanmadı).

## DENENMEYEN
- Tam `npm test`, Windows, uzun koşular.
- Mutasyonlar c25c53fd'den önceki kodda koşuldu.
- İki şirket.
- Ekran senaryoları yalnız İstanbul saat diliminde koşuldu.
- S241'den sonra gerçek iade + iade iptali sırası sınanmadı.
- İş 3 prototipi tam testten geçmedi.

## Yeniden koşu
Komutlar raporun sonunda, tam yollarla ve kilitli hâlleriyle yazılı. Eski kod ve prototip ağaçları kaldırıldı; eski kod için `git worktree add --detach … 288b91dc` ile yeniden kurulmalı.

Not defteri: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt2-a00`

Ortam: yük 1,6 / 4 çekirdek, boş bellek 2 GB (kullanılabilir 8 GB), boş disk 8,6 GB.
