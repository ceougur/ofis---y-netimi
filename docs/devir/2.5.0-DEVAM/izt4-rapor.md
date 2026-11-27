# İzleyen tur 4: S255 = A raporu

## Özet
- **Kural kodlandı, iki hesap aynı okumada:** Tek Yükümlülük Kuyruğu ve kapama defteri. Kartın içine aldığı faturaya bağlı ödeme artık önce faturanın gösterilen açığını kapatıyor. Fazlası bağsız ödeme gibi kuyruktan kartın taksitlerine gidiyor.
- **S255 A sayıları tuttu** (F 900, kart 600, 20.10):

| Bağlı tahsilat | Kart Tahsil / Kalan | Bakiye | Gecikmiş |
|---|---|---|---|
| 600 | 300 / 300 (05.10 ödendi, 05.11'den 100) | 300 | 0 |
| 900 | 600 / 0 | 0 | 0 |
| 1.200 | 600 / 0 | −300 (fazla 300) | 0 |

  Bağsız 900 ve bağlı 300 değişmedi.
- **Önemli bulgu (aşağıda BAŞ MİMAR KARARI GEREKEN):** S255'in gerekçesindeki "Ödeme Hatırlatma'nın okuduğu eski taksit gecikmişi" bu kuralla düzelmiyor. Bağsız 900'de de 200. Ç5-C'nin bilinen sınırı.
- **Gerileme yok:**
  - Kâhinler iki saat diliminde 0 fark.
  - Komşu dosyalar iki saat diliminde 3.984 / 3.984 geçti.
  - Temiz 100 bin veride 1.484 carinin kuyruk sonucu eski ile birebir aynı.
  - v2.4.9 verisinde kartsız carilerde fark 0.
  - Kötüleşen hız yolu yok.
- Göç yok. Yapım aşaması listesi 0 → 0. `YAPIM-ASAMASI.json`'a ve kâhinlere dokunulmadı.

## Taban, dal, commit'ler
Taban 6a1d19d1, dal `worktree-agent-ad3ee8a705a609628`, uç **725dc7ae**. Push yok.
- e85a39c2 — tasarım notu §22 (koddan önce)
- 20bd65d5 — kod + sınama
- beb3019b — ekran senaryosu + `package.json`
- c3187823 — sınama eki (B4a, B11)
- 8dbb125a, e1fb655d, 725dc7ae — kanıt
- 4c1bdffe, d32aca83 — hız düzeltmeleri, davranış aynı

## Değişen dosyalar
- **`server/lib/obligation-queue.mjs` (kuyruk):**
  - Önceki turun "tutulan kısım" ölçüsü genelleşti (`linkHolds`): kartın ön geçişte faturadan aldığı tutar, eksi o faturanın iadelerinin karttan kestiği tutar.
  - Sıra 3'teki bağ (faturaya bağlı ödeme) yalnız `target.left − tutulan` kadar kapatır. Kapatamadığı pay "fazla" sayılmaz.
  - Sıra 3 tutulan yüzünden kesildiyse, sıra 4 (iadenin mahsubu) da tutulanı korur.
  - Kartça tutulan faturada, iadeden sonra yazılmış bağlı ödeme iadeden sonra ayrılır (yazım sırası).
  - Kayıt anı işlevi yalnız gerektiğinde ve girdi başına bir kez kurulur.
- **`server/lib/invoice-settle.mjs` (kapama defteri):**
  - İade olmayan bağlı ödeme yalnız kapsanmamış kısmı kapatır.
  - Aynı yazım sırası kuralı.
  - Faturanın "fazla"sı, kartın kapsadığı açık kadar düşülür.
- Yeni dosyalar: `test/izt4-s255-bagli-odeme-250.test.mjs`, `test/e2e/senaryo-izt4-250.mjs`.
- `package.json` — `test:senaryo-izt4-250`. **ci.yml / release.yml'ye ana oturum ekleyecek.**
- `docs/erp/C7B-FATURA-TASARIM.md` §22, `docs/kanit/2026-11-22/izt4-*`.

## Bağlı ödeme yolları (tarama: `obligation-input.mjs` links, `INSERT INTO account_entries`)
Hepsi kuyrukta sıra 3, defterde adım 1; tek kural hepsine uygulanıyor:
1. Cari Tahsilat'ta Kapatılacak Fatura ve faturanın Tahsilat Ekle'si — aynı uç (banka yolu dahil).
2. Silinenler'den geri yüklenen tahsilat.
3. Faturanın peşini — karttan önce doğar, kural etkisiz.
4. Faturaya bağlı çek / senet / ciro.

Değişmeyenler: Mahsup Et, kart tahsilatı, POS komisyonu. **Tedarikçi yönünde aynı yapı yok:** Mevcut Borç kartı yalnız alacak tarafında.

## Sınama (17 senaryo)
**Sonuç iki saat diliminde de aynı:**

| Kod | Geçen / toplam |
|---|---|
| Yeni | 17 / 17 |
| Eski (6a1d19d1) | 3 / 17 |

- 14 kırmızının nedeni okundu, hepsinde aynı: kart penceresi `paid 0, left 600` (beklenen 300 / 300, 600 / 0).
- Eskide yeşil kalan 3 sınama bekçi: bağlı 300, bağsız 900, B9.
- **Kollar:**
  - B1: bağlı 300 / 600 / 900 / 1.200 ve bağsız 900.
  - B2: faturanın tamamı kartta.
  - B3: iki kart.
  - B4a: iade → bağlı.
  - B4b / B4c: bağlı → iade → iade iptali (bağsız ikiziyle aynı).
  - B4d: Düzenle → bağlı.
  - B5: silme + Silinenler'den geri yükleme.
  - B6: kilitli dönem.
  - B7: Vade Takip / zil / Alacak Yaşlandırma / Nakit Akışı.
  - B8: çek.
  - B9: bağ karttan önce (bekçi).
  - B10: yedek → geri yükleme.
  - B11: kart tahsilatı → bağlı → iade.
- **Mutantlar** (ayrı kopyada):
  - M1 (sıra 3'ün tutulanı yok): 13 kırmızı. M2 (defter kapsananı da kapatır): 3. M5 (fazla düzeltmesi yok): 3.
  - M3 (kuyrukta yazım sırası yok), M4 (sıra 4 koruması yok), M6 (defterde yazım sırası yok) önce yaşadı. B4a'ya kapatan ve defter denetimi, ayrıca B11 eklendi; üçü de kırmızı oldu.

## v2.4.9 sınıf karşılaştırması
Veri o sürümün gerçek koduyla üretildi; eski ve yeni kodla okundu (`izt4-kos/v249-fark.md`).
- **Fark yok:** kartsız bağlı 600, kartsız bağlı 1.200, kartsız bağsız, taksitli fatura, kart + bağlı 300, kart + bağsız 900, bağ karttan önce.
- **Fark beklenen yönde, yalnız bu kuralın sınıfı:** kart + bağlı 600 / 900 / 1.200, iade → bağlı, faturanın tamamı kartta, çek. Örnek 600: kart 0 / 600 → 300 / 300, gecikmiş 200 → 0.
- Bakiye hiçbir sınıfta değişmedi. Mutabakat Testi iki kodda da temiz.
- Bağlı → iade sınıfı: v2.4.9 kartı zaten 0'a indirmiş. Tek fark, kapama defterinin kapsamı (0 → 300).

## Komşular ve kâhin (son kod d32aca83)
- 367 dosya (`izt4-kos/komsu-liste.txt`), şema kapısı ve geri yükleme dahil:
  - UTC 3.984 / 3.984.
  - İstanbul 3.984 / 3.984. İlk İstanbul koşusu süre sınırında kesildi (kesildiğinde 495 sınama, kırmızı yoktu); yeniden tam koşuldu.
- Cari kâhini iki saat diliminde 24.613 / 24.613, 0 fark.
- Defter kâhini iki saat diliminde 187 / 187.
- Yapım listesi not defterine yazıldı: 0 kayıt, depodakiyle aynı.

## Hız (temiz 100 bin, eski 6a1d19d1 ↔ yeni d32aca83, 3 tur, başta yük ≤ 1,33)
| Yol | Ortanca | En iyi |
|---|---|---|
| cari kartı GET | +27,5% | +7,9% |
| kart penceresi GET | +16,6% | 0,0% |
| fatura kartı GET | +1,9% | −0,3% |
| bağlı yazım | +12,4% | +4,8% |
| bağsız yazım | +3,9% | −0,9% |
| Taksitler listesi | +6,2% | +0,6% |
| Cari listesi | +13,4% | −2,4% |
| Açık Faturalar | +17,9% | −0,1% |
| Anlık Durum | +5,6% | +2,8% |
| Vade Takip | +20,5% | −0,9% |
| Alacak Yaşlandırma | +9,4% | +2,7% |
| Nakit Akışı | +14,7% | +6,3% |

- Olay döngüsü en çok eskiyle aynı düzeyde (tam tablo `izt4-kos/hiz/tablo-2.md`).
- **Tek KÖTÜ işaret:** "Taksitler listesi (ilk — soğuk)", her turda tek ölçüm. Eski 2.332 / 2.461 / 3.207 ms, yeni 2.804 / 2.914 / 2.761 ms (+13,9% / +18,4%).
- Bunu ayrıca ölçtüm: 848 kartlı carinin kuyruğu 5 tekrar × 3 tur (`izt4-kos/hiz/mikro2-sonuc.txt`).
  - En iyi: eski 13.443,7, yeni 13.718,6 ms (+2,0%).
  - Ortanca: eski 16.085,3, yeni 14.710,5 ms (−8,6%).
  - 100 bin veride sonuç farkı 0. Bu yüzden soğuk liste işaretini gürültü sayıyorum. **Ana oturumun kendi kabul ölçümünde bakılmalı.**
- İlk ölçüm turunda (sonuc-1, tablo-1) "bağsız yazım" da KÖTÜ çıkmıştı. Kayıt anı haritasını yalnız gerektiğinde ve girdi başına bir kez kuran iki küçük değişiklik yaptım (4c1bdffe, d32aca83). İkinci ölçümde bu yol +3,9% / −0,9%.

## Ekran (`senaryo-izt4-250`)
Ekran görüntüleri `izt4-kos/ekran-yeni/`.
- **Sonuç:** yeni 21 / 21 (son kodda da 21 / 21), eski 12 / 21.
- **A (fatura kartından Tahsilat Ekle):**
  - Fatura kartında "Taksit Kartında · ₺600,00" satırı var.
  - Form 300 öneriyor; 600 yazıldı.
  - Fatura "Taksitte" görünüyor.
  - Kart penceresi Tahsil Edilen ₺300,00 · Kalan ₺300,00; taksit satırları 0 / 100 / 200.
  - Taksitler satırı ve cari kartındaki kart satırı 600 / 300 / 300.
  - Bakiye ₺300,00, Gecikmiş Borç ₺0,00.
  - Eskide: Tahsil 0 / Kalan 600, Gecikmiş Borç 200, satırlar 200 / 100 / 0.
- **B (cari kartından Kapatılacak Fatura ile 900):**
  - Beklenen soru geldi ("Taksite Yaz / Taksit Dışı Tahsilat"), Taksit Dışı Tahsilat seçildi.
  - Kart 600 / 600 / 0, bakiye 0, gecikmiş 0.

## KULLANICIYA SORULMALI
**Mahsup Et bu kurala girsin mi?** Karar metni açık değil; kodla karar vermedim. Uç durum, önceden var: bugünkü davranış eski kodla birebir aynı (`mahsup-p9.txt`). Örnek: F 900, kart 600, Alacak Yaz 900.
- Daha mahsuptan önce kart Tahsil 0 / Kalan 600, bakiye 0 (S92: karşı yönlü kalem kartın tahsilatı sayılmıyor).
- Mahsup 900 → F Ödendi, kart Kalan 600.
- Mahsup 600 → F'nin kapsamı {K:300}, kart Kalan 600.

Seçenekler:
- **A:** Mahsup da önce gösterilen açığı kapatsın, fazlası karşı belgede açık kalsın.
- **B:** Bugünkü gibi; mahsup faturanın tamamını kapatır.
- **C (öneri):** Uç durum böyle kalsın (BİLİNEN SINIR). Bakiye iki okumada da 0; Alacak Yaz'lı caride kart gösterimi mahsuptan önce de böyle (S92).

Yaygın programlarda: doğrulanmış kaynak okunmadı.

## BAŞ MİMAR KARARI GEREKEN
1. **Eski anlamdaki taksit gecikmişi düzelmiyor.** S255'in gerekçesindeki Ödeme Hatırlatma'nın okuduğu eski gecikmiş (`overdueInstallments`), kartın kendi hesabından okunuyor. Bu kural onu değiştirmiyor: bağlı 600 / 900'de de bağsız 900'de de 200. Ç5-C'ye bırakılan bilinen sınır. Sınamada bekçi var: bağlı ile bağsız aynı sayıyı veriyor.
2. **Kart iadede sıfırlanıyor (önceden var).** Kart tahsilatı olmadan kuyrukta ödenmiş kart, iadede ya da Düzenle azaltmasında carinin kalan borcuna kırpılıyor. Örnek: bağlı veya bağsız 600 → iade 300 → kart 600'den 0'a iniyor, "Tahsil Edilen 300" kayboluyor. Bakiye doğru (0). Bağsız yolda da, eski kodda da aynı; B4b'de bağlı ile bağsız eşit (`iptal-duzenle-p10.txt`). Kartı kırpan yardımcı, kuyruğu değil kartın kendi hesabını okuyor.

## SONRAKİ SÜRÜME (2.5.1)
- Kart 0'a kırpıldıktan sonra kapama defterinin kapsamı bağlı ödemede 300, bağsızda 600 kalıyor. Görünen sayı değişmiyor (v2.4.9 bağlı → iade sınıfı ve B4b'de görüldü).
- Yazım sırası kuralı: bağlı ödeme ile iadenin karışık sıralandığı (bağlı 1, iade 1, bağlı 2, iade 2) uç durum, bağ 2 iadelerden sonra ayrılıyor. Toplam ve bakiye aynı; yalnız kapatan listesinin dağılımı farklı olabilir. Ayrıca denenmedi.

## DENENMEYEN
- İki tarayıcılı canlı yenileme.
- İki şirket.
- Bağın düzeltmeyle sonradan kurulduğu bağlı ödeme (PUT ile Kapatılacak Fatura değişimi).
- Şüpheli alacak + bağlı ödeme.
- Gün / ay dönümü.
- Tam `npm test` (yalnız 367 komşu dosya koşuldu).
- Windows.

## BİLİNEN SINIRLAR
- Mahsup Et değişmedi (soru yukarıda).
- Eski anlamdaki taksit gecikmişi (Ç5-C).
- Kart tahsilatsız ödenmiş kartın iadede sıfıra kırpılması.

## Ana oturumun yeniden koşacağı komutlar
Hepsi `cd /home/user/ofis---y-netimi/.claude/worktrees/agent-ad3ee8a705a609628` içinden:
- **Sınama:** `TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9 flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 900 node --disable-warning=ExperimentalWarning --test --test-concurrency=1 test/izt4-s255-bagli-odeme-250.test.mjs` (aynısı `TZ=Europe/Istanbul` ile).
- **Ekran:** `EKRAN_DIR=<klasör> PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 HUKUK_LICENSE_URL=http://127.0.0.1:9 flock -s -w 3600 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 900 node test/e2e/senaryo-izt4-250.mjs`
- **Eski kod kırmızısı:** 6a1d19d1'in ayrı kopyasına (`git worktree add --detach`) iki yeni dosya kopyalanıp aynı komutlar koşulur. Eski kopyayı kaldırdım (`git worktree remove`).
- **Hız:** `flock -x -w 5400 /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock timeout -k 5 5000 bash /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3/hiz/kos.sh <çıktı>`. Betik eski kopyayı `izt4-ad3/eski`'de bekliyor; yeniden oluşturulması gerekiyor. Tablo: `python3 -I /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3/hiz/tablo.py <çıktı>`. Mikro ölçüm: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3/hiz/mikro2.sh`.
- **v2.4.9 karşılaştırması:** `ROOT=<kod> MODE=uret|oku DATA=<klasör> node /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3/arac/surum.mjs`, fark: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3/arac/surum-fark.py`.
- **Komşular / kâhin:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3/arac/komsu2.sh <ek>` (`TZLER` ile saat dilimi seçilir), `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3/arac/kahin.sh`.

## Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/izt4-ad3`. Betiklerin ve ham çıktıların kopyası depoda: `docs/kanit/2026-11-22/izt4-kos/`, ayrıca `docs/kanit/2026-11-22/izt4-rapor-taslak.md`.

Ortam: Yük 0,44 / 4 çekirdek, bellek boş 7 GB (kullanılabilir 14 GB), disk boş 8,9 GB.
