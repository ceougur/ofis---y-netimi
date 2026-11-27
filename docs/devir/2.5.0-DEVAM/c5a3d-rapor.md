# Ç5-A TUR 3d raporu

Bu bir ajan raporudur, kanıt sayılmaz. Ana oturum aşağıdaki komutları yeniden koşmalı.

**Dal ve durum**
- Dal: `worktree-agent-a58859d049073732b`, uç **42554382**.
- Push yapılmadı. Ağaç temiz; izlenmeyen tek şey `node_modules` bağı.
- Ortam (son okuma): yük 1,5 / 4 çekirdek, bellek boş 7 GB, disk boş 9,2 GB.

## 1. Değişen gözlenebilir davranış (önce → sonra)

Hepsi şüpheli kaydı açık müşteri carisinde geçerli. Örnekler S168 kurulumuyla:
- F1 1.000 → şüpheliye alma 1.000 → F2 500 → "Normal Cari Hesaba İşle" 400.

**Cari kartı, Hareketler sütunundaki etiket**
- Kapatılacak Fatura bağlı tahsilatın etiketi artık defter ayırıcısının o satıra verdiği şüpheli payından okunuyor.

| Durum | Önce | Sonra |
|---|---|---|
| F2'ye bağlı 300 (tamamı 128'den) | "Normal Cariye İşlendi" | etiket YOK |
| F2'ye bağlı 500 (400'ü 128, 100'ü 120) | "Normal Cariye İşlendi" | "Kısmen Normal Cariye İşlendi (₺100,00)"; title: "Tahsilatın ₺100,00 tutarı normal cari hesaba (120) işlendi; kalanı faturanın şüpheli alacaktaki payından (128) düştü" |
| Payı 0 olan bağlı 200 (işaretli tahsilat yokken) | "Normal Cariye İşlendi" | değişmedi |

- İşaretli ve fatura peşini satırları değişmedi (tam etiket).
- Bağsız tahsilatta etiket yine yok.
- API'de kısmi satıra yeni bir alan ekleniyor: `doubtfulNormalPart`, 120'ye düşen TL tutarı. Bu satırda `doubtfulNormal` false.
- Tutar ekranın para biçimiyle yazılıyor (₺100,00). Görev metni "tutar" diyordu, biçimi ekranın geri kalanıyla aynı seçtim.

**Fatura detayı, iptal penceresi (`cancelNotice`) ve iptal bildirimi**
- Tamamı 128'den düşen bağlı satır:
  - Önce: "300,00 TL tahsilat şu an normal cari hesaba işli …".
  - Sonra: bildirim yok, çünkü iptal o satırı normal cariden çıkarmıyor.
- Kısmi satır:
  - Önce: "… 500,00 TL tahsilat şu an normal cari hesaba işli …".
  - Sonra: "Bu faturaya bağlı 500,00 TL tahsilatın 100,00 TL'si şu an normal cari hesaba işli (cari şüpheli alacakta; kalanı faturanın şüpheli alacaktaki payından düşüyor). Fatura iptal edilince bağı kalkar ve bu kısım şüpheli alacaktan düşer. …"
  - İptalden sonra: "… 500,00 TL tahsilatın 100,00 TL'si artık şüpheli alacaktan düşüyor (faturayla bağı kalktı; kalanı zaten faturanın şüpheli alacaktaki payından düşmüştü). …"
- Payı olmayan satırda metin aynen eski metin.
- İşlem kaydının `doubtfulRelinked` alanları aynı. Listede artık yalnız normal kısmı olan satırlar var.

**Kılavuz ("Tahsilatta seçim" maddesi)**
- Önce: "Satış faturasının peşini ve Kapatılacak Fatura bağlı tahsilat kendiliğinden normal cari hesaba işlenir."
- Sonra: "Satış faturasının peşini kendiliğinden normal cari hesaba işlenir. Kapatılacak Fatura bağlı tahsilat, fatura şüpheliye alınan borcun içindeyse önce şüpheli alacaktan düşer, kalanı normal cari hesaba işlenir (kartta Normal Cariye İşlendi ya da Kısmen Normal Cariye İşlendi ve tutarı yazar)."
- HTML ve PDF birlikte; PDF `client/kilavuz/` altında yeniden üretildi.

**Tek kaynak ve maliyet**
- Pay `doubtfulState(store, {parties}).allocations`'dan okunuyor. Bu, sınırın `allocatedMinor`'ının kaynağıyla aynı; ikinci bir hesap yazılmadı.
- Cari kartında ayırma cari başına en çok bir kez, yalnız ilk bağlı satır gerektirince yapılıyor. Şüpheli kaydı olmayan ya da bağlı tahsilatı olmayan caride ek iş yok.
- Fatura bildiriminde de cari başına bir kez, yalnız aday satır varsa.
- Defter kuralı, kuyruk, sınır ve hız yoluna dokunulmadı.

## 2. Birleşim
- `reset --hard c5a3d-taban` (4ecbee10), ardından `merge --no-ff c5a3d-ana` (d2a37e3d) → **1ef58e5e**.
- Çakışma yalnız `docs/erp/C5-ACILIS-TASARIM.md`'de çıktı. İki tarafın bölümleri aynen korundu: §17.13 (tur 2e) önce, ardından §18–§19.
- Kod dosyasında çakışma yok.

## 3. Commit'ler
- 1ef58e5e: birleşim.
- 41f38493: kod (`server/routes/accounts.mjs`, `server/routes/invoices.mjs`, `client/assets/hof-accounts.js` yalnız etiket) ve yeni test `test/supheli-etiket-pay-250.test.mjs`.
- bf405be8: kılavuz HTML ve PDF.
- 17ba1c83: `test/e2e/senaryo-supheli-kuyruk-250.mjs` adım ■ 3 ve tasarım §19.8.
- 42554382: Kanıt commit'i (`docs/kanit/2026-11-14/c5a3d-*`).
- Dosya sınırının dışına çıkılmadı.

## 4. Yeni testler, taban kırmızısı, mutantlar

**`test/supheli-etiket-pay-250.test.mjs`**
- Üç vaka: pay = tutar, kısmi pay, pay 0.
- Beklenen sayılar S168 = B'nin ve kararın metninden alındı.
- Yeni kodda UTC 3/3, Europe/Istanbul 3/3.
- Tabanda (1ef58e5e, ayrı `git archive` kopyası) iki TZ'de de 1/3, çıkış 1. Neden: `expected 'yok' actual 'tam'` ve `expected 'kısmi 100' actual 'tam'`.
- Bildirim kırmızısı ayrıca görüldü: tabana yalnız yeni `accounts.mjs` konunca 1/3. Gelen metin eski "300,00 TL tahsilat şu an normal …" ve "500,00 TL tahsilat şu an normal …".
- Kısmi vakada iptalin S155 kapısından geçebilmesi için F2'den sonra elle Borç Yaz 500 var. Bu, kuyrukta F2'nin payını değiştirmiyor (en eski önce). İlk denemede onsuz iptal 409 ile reddedilmişti.

**`senaryo-supheli-kuyruk-250` adım ■ 3**
- Akış: kart yeniden açılır → etiket kümesi okunur → F2'ye bağlı 200 eklenir (API) → küme yeniden okunur.
- Beklenen: 128 = 600, 120 = 0; küme `{tam: [1], kısmi: ["Kısmen Normal Cariye İşlendi (₺100,00)"]}`.
- Yeni kodda iki TZ'de 15/15.
- Tabanda 13/15. Neden: tam etiket 2, sonra 3 kez görünüyor; kısmi etiket hiç yok.

**Mutantlar: 7 / 7 öldü** (`docs/kanit/2026-11-14/c5a3d-mutasyon.txt`, betik `c5a3d-mutasyon.py`)
- M1: etiket payı okumuyor.
- M2: kısmi tutar = pay.
- M3: pay = tutarken tam etiket.
- M4: pay 0'da etiket yok.
- M5: bildirim tutarın tamamını söylüyor.
- M6: tamamı 128 olan satır listede kalıyor.
- M7: bildirim payı görmüyor.

## 5. Komşular ve ekran senaryoları (hepsi `kanit.mjs kos` ile)
- Komşular: taramadaki 37 test dosyası (değişen dosyaları adıyla, `doubtfulNormal`, `cancelNotice`, "Normal Cariye", "normal cari hesaba işli" ya da `supheli` adını anan) ve 4 kılavuz okuyucusu. UTC 387/387, Europe/Istanbul 387/387.
- `senaryo-supheli-230`: iki TZ 67/67. Beklentisi değişmedi; payı 0 olan bağlı satırda tam etiket görünüyor.
- `senaryo-supheli-kuyruk-250`: iki TZ 15/15.
- Kılavuz: `pdf-denetle` 39/39, `test:kilavuz-metin` 948/948. Yeni cümle PDF metninde `pdftotext` ile görüldü.

## 6. Ana oturumun yeniden koşacağı komutlar ve beklenen sayılar
- `TZ=UTC` ve `TZ=Europe/Istanbul` ile `node --test test/supheli-etiket-pay-250.test.mjs` → 3/3. Tabanda 1/3, neden yukarıda.
- `node --test $(cat /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3d-k7/komsu.txt) test/kilavuz-surum.test.mjs test/kilavuz-pdf-surum.test.mjs test/gorunen-adres-247.test.mjs test/banka-220-kredi-karti-metin.test.mjs` → 387/387, iki TZ.
- `node test/e2e/senaryo-supheli-kuyruk-250.mjs` → 15/15. `node test/e2e/senaryo-supheli-230.mjs` → 67/67. İkisi de iki TZ.
- `python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3d-k7/mutasyon.py <ağaç> <çıktı>` → 7 ÖLDÜ.
- `node docs/kilavuz/pdf-denetle.mjs` → 39/39.

## 7. Ekran yürüyüşü (cari kartında üç etiket hâli)
1. S168 kurulumu.
2. F2'ye bağlı 300 → kart: işaretli 400 "Normal Cariye İşlendi", 300'lük satır etiketsiz.
3. Aynı gün F2'ye bağlı 200 → bir satırda "Kısmen Normal Cariye İşlendi (₺100,00)".
4. Pay 0 hâli: işaretli tahsilat olmayan caride F2'ye bağlı 200 → "Normal Cariye İşlendi".
5. Fatura detayında iptal penceresinin metni okunur.

Görüntü: `docs/kanit/2026-11-14/c5a3d-ekran-hareketler.png`. Okudum: 400 tam etiketli; 300 "Faturaya Bağlı" ve "Kısmen Normal Cariye İşlendi (₺100,00)"; 200 yalnız "Faturaya Bağlı".

## 8. Kapsam dışı bulgu (defter kuralı; dokunmadım)
- Aynı gün iki bağlı tahsilatta ayırıcı, alacakları `lib/doubtful-gl.mjs` `by` sıralamasında `tie: credit.key` ile, yani `account:<UUID>` ile sıralıyor.
- Bu yüzden hangi satırın kısmi olduğu kimliğe bağlı: ekranda önce girilen 300'lük satır sonradan "Kısmen" oldu, 200'lük satır etiketsiz kaldı.
- Toplam 120 / 128 ve etiket kümesi bu örnekte sıradan bağımsız. Satır başına dağılım ise ders 31'e aykırı olabilir; kayıtlar için `seq` var, alacaklar için yok.
- Dar kontrolün ya da baş mimarın değerlendirmesi gerekiyor. §19.8'e "GÖZLEM" olarak yazıldı.

## 9. KULLANICIYA SORULMALI
- Yok.

## 10. DOĞRULANMADI / DENENMEYEN
- HIZ ölçülmedi. Gerekçe: şüpheli kaydı olmayan carilerde yeni yol hiç çalışmıyor, temiz 100 bin satırlık veride de şüpheli carisi yok. Şüpheli ve bağlı tahsilatlı cari kartında ek iş, kart başına en çok bir `doubtfulState` çağrısı (özetle aynı iş); büyük veride önce / sonra ölçümü ana oturumda.
- İki şirket, yedekten geri yükleme ve Silinenler yolları denenmedi. Değişiklik yalnız okuma / görüntüleme.
- Toplu iptal yolunun bildirimi ayrıca koşulmadı. Aynı `doubtfulRelinkText` işlevini kullanıyor.
- Tam `npm test` ve CI koşulmadı.
- Kısmi etiketi yeni e2e adımı ve görüntü kapsıyor. Etiket tıklama ile değil API ile girilen tahsilattan sonra okundu.

## 11. Not defteri klasörü
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3d-k7`
- Taban kopyası: `taban/`.
- Ekran görüntüleri: `ekran/`.
- Betikler: `komsu.txt`, `mutasyon.py`, `kalan.sh`.
